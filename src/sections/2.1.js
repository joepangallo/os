// Comment key: a line inside backtick text ends with ${/* comment */''}, an empty-string slot that holds a comment without changing the text on screen (full note at the top of the page).
/* Section 2.1 — Operating System Objectives and Functions
   Original teaching material. Built step by step. */
Guide.section({  // registers section 2.1 with the guide; the object below holds everything this section shows and teaches
  id: '2.1',  // the section number, used in links, the side menu and the saved progress
  title: 'Operating System Objectives and Functions',  // the full title shown at the top of every step of this section
  short: 'OS objectives',  // the short name used in the side menu and the progress lists
  summary: 'What an OS is for: its three goals, the services it offers, the ISA/ABI/API, and how it manages resources.',  // one-sentence summary shown under the section's name on the chapter page
  objectives: [  // objectives: the learning goals listed on the chapter page and in the printable version
    'Define an operating system and explain its three objectives: convenience, efficiency and the ability to evolve.',  // goal 1: define an OS and its three objectives
    'Describe the layered view of a computer system and name the seven kinds of service an OS provides.',  // goal 2: the layered view and the seven kinds of OS service
    'Tell the ISA, ABI and API apart, and use them to predict whether a program will run on another machine as a binary or after recompiling.',  // goal 3: telling ISA, ABI and API apart and predicting portability
    'Explain how the OS manages resources even though it is itself a program that must give up the processor and win it back.',  // goal 4: how the OS manages resources while being a program itself
    'Explain why an OS must keep evolving and why that calls for modular construction with clear interfaces and good documentation.',  // goal 5: why an OS keeps evolving and needs modules with clear interfaces
  ],  // closes the objectives list
  terms: [  // terms: glossary entries as [term, definition] pairs; they feed the glossary drawer, the key-term cards and the dotted-word popups
    ['Operating system (OS)', 'A program that controls the execution of application programs and acts as the go-between for those programs and the computer hardware.'],  // glossary entry: defines operating system as the go-between for programs and hardware
    ['Convenience', 'The first objective of an OS: make the computer easier to use by hiding hardware details behind simple services.'],  // glossary entry: convenience, the first OS objective
    ['Efficiency', 'The second objective of an OS: keep the processor, memory and devices doing useful work instead of sitting idle or being wasted.'],  // glossary entry: efficiency, the second OS objective
    ['Ability to evolve', 'The third objective of an OS: be built so that new hardware, new services and fixes can be added without getting in the way of the services it already provides.'],  // glossary entry: ability to evolve, the third OS objective
    ['Utilities', 'System programs that come with the OS, such as editors, compilers, debuggers, command shells and file tools. They help people build programs and run the computer, but they are not the kernel itself.'],  // glossary entry: utilities, the system programs that ship with the OS but are not the kernel
    ['Library', 'A collection of ready-made routines (for example the C standard library, with fopen and printf) that programs call instead of writing that code themselves. Many library routines make system calls on the program\'s behalf.'],  // glossary entry: library, ready-made routines that often make system calls for the program
    ['Instruction set architecture (ISA)', 'The complete set of machine instructions a processor can carry out. It is the boundary between hardware and software.'],  // glossary entry: instruction set architecture (ISA), the hardware/software boundary
    ['User ISA', 'The part of the instruction set that any program may use: arithmetic, comparisons, jumps, loads and stores.'],  // glossary entry: user ISA, the instructions any program may use
    ['System ISA', 'The privileged part of the instruction set, such as instructions that control interrupts, memory-management hardware or I/O. Only the OS may use it.'],  // glossary entry: system ISA, the privileged instructions only the OS may use
    ['Application binary interface (ABI)', 'The rules a compiled (binary) program follows to use a system: the system call interface to the OS plus the user ISA, including details such as how arguments are passed. Systems with the same ABI run the same binary unchanged.'],  // glossary entry: application binary interface (ABI), what a compiled program relies on
    ['Application programming interface (API)', 'The set of calls a program\'s source code may use: library routines and OS services, on top of the user ISA. Source code written to an API moves to another system with the same API by recompiling it.'],  // glossary entry: application programming interface (API), what source code relies on
    ['System call', 'A request from a running program to the OS for a service, such as reading a file. A special instruction switches the processor into the OS to handle it.'],  // glossary entry: system call, a program's request for an OS service
    ['Kernel (nucleus)', 'The part of the OS that stays in main memory all the time and holds its most frequently used functions.'],  // glossary entry: kernel (nucleus), the always-in-memory core of the OS
    ['Resource manager', 'The view of the OS as the part of the system that decides how the processor, main memory, I/O devices and files are shared among programs.'],  // glossary entry: resource manager, the view of the OS as the one who shares out hardware
    ['Dispatch', 'To hand the processor to a chosen program by loading its saved state and jumping to its next instruction.'],  // glossary entry: dispatch, handing the processor to a chosen program
    ['Device driver', 'The part of the OS that knows the exact commands for one kind of device and turns general requests such as read or write into those commands.'],  // glossary entry: device driver, the OS part that speaks one device's commands
    ['Accounting', 'The OS service that records how much of each resource is used, for tuning performance, planning upgrades and, on shared systems, billing users.'],  // glossary entry: accounting, recording resource use for tuning, planning and billing
    ['Portability', 'How easily software moves to a different machine or OS. Binary portability: the compiled program runs unchanged. Source portability: the source code only needs recompiling.'],  // glossary entry: portability, with its binary and source kinds
    ['Module', 'A self-contained part of a program or OS that hides its insides and is used only through a clearly defined, documented interface.'],  // glossary entry: module, a self-contained part used only through its interface
  ],  // closes the terms list

  css: ` /* css: the style rules (CSS, the language that sets colors, sizes and layout) for this section, added to the page when it loads */
    /* shell workaround: in narrow mode the nowrap eyebrow otherwise sets the canvas min-width */
    .sec-2-1 .step-eyebrow { contain: inline-size; } /* keeps the long title line above each step from stretching the page sideways on a small screen */
    .sec-2-1 .hot { cursor: pointer; } /* anything marked "hot" in this section is clickable, so the mouse pointer turns into a hand over it */
    /* step 1: objectives */
    .sec-2-1 .obj-tiles { gap: 10px; } /* puts a 10px gap between the three objective tiles */
    .sec-2-1 .obj-tile { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; text-align: left; padding: 10px 12px; border: 2px solid var(--line); border-radius: 12px; background: var(--panel-2); cursor: pointer; color: var(--ink); font: inherit; } /* each objective tile is a button laid out as a column: number, name, tag line, with a light border and rounded corners */
    .sec-2-1 .obj-tile:hover { border-color: var(--chc); } /* hovering a tile outlines it in the chapter color to show it can be clicked */
    .sec-2-1 .obj-tile.on { border-color: var(--chc); background: color-mix(in srgb, var(--chc) 10%, var(--panel)); box-shadow: 0 0 0 1px var(--chc); } /* the selected tile gets a chapter-colored border, a faint tinted background and an extra outline */
    .sec-2-1 .obj-n { display: inline-grid; place-items: center; width: 26px; height: 26px; border-radius: 50%; background: var(--panel-3); font-weight: 800; font-size: 14px; } /* the round number badge at the top of each tile */
    .sec-2-1 .obj-tile.on .obj-n { background: var(--chc); color: var(--panel); } /* on the selected tile the number badge fills with the chapter color */
    .sec-2-1 .obj-name { font-weight: 800; font-size: 17px; line-height: 1.25; } /* the objective's name in bold, larger type */
    .sec-2-1 .obj-tag { font-size: 13.5px; color: var(--muted); line-height: 1.3; } /* the short tag line under the name, smaller and gray */
    .sec-2-1 .obj-detail { display: flex; flex-direction: column; gap: 10px; } /* the detail card on the right stacks its parts in a column with gaps */
    .sec-2-1 .obj-ww { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; } /* the "without" and "with" boxes sit side by side in two equal columns */
    .sec-2-1 .obj-w { border-radius: 10px; padding: 9px 12px; border-left: 5px solid; } /* each of those boxes gets rounded corners, padding and a thick colored left edge */
    .sec-2-1 .obj-w.bad { background: var(--bad-bg); border-color: var(--bad); } /* the "without an OS" box is tinted red to signal the bad case */
    .sec-2-1 .obj-w.ok { background: var(--ok-bg); border-color: var(--ok); } /* the "with the OS" box is tinted green to signal the good case */
    .sec-2-1 .obj-w > b { display: block; font-size: 12.5px; letter-spacing: .06em; text-transform: uppercase; margin-bottom: 3px; } /* the small bold label at the top of each box, in spaced-out capitals */
    .sec-2-1 .obj-w.bad > b { color: var(--bad); } .sec-2-1 .obj-w.ok > b { color: var(--ok); } /* the label is red in the bad box and green in the good box */
    .sec-2-1 .obj-how { padding: 7px 12px; border-radius: 10px; background: var(--os-bg); } /* the "How the OS gets there" line gets a light purple OS-colored background */
    @media (max-width: 760px) { .sec-2-1 .obj-ww { grid-template-columns: 1fr; } } /* on a small screen (760px wide or less) the two boxes stack instead of sitting side by side */
    /* step 2: layer cake */
    .sec-2-1 .lay-split { grid-template-columns: minmax(0, 11fr) minmax(0, 12fr); } /* step 2 layout: the layer stack column and the tabs column, the right one slightly wider */
    .sec-2-1 .lay-stack { display: flex; flex-direction: column; } /* the layer stack arranges its bars top to bottom */
    .sec-2-1 .lay { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 76px; padding: 8px 14px; border: 2px solid var(--line-2); border-radius: 12px; background: var(--panel-2); cursor: pointer; transition: opacity .2s, box-shadow .2s; } /* each layer is a tall rounded bar with its name on the left and a role badge on the right; it fades and glows smoothly when its state changes */
    .sec-2-1 .lay:hover { box-shadow: 0 0 0 2px color-mix(in srgb, var(--chc) 45%, transparent); } /* hovering a layer gives it a soft chapter-colored glow */
    .sec-2-1 .lay-nm { display: flex; flex-direction: column; line-height: 1.3; min-width: 0; } /* the layer's name and subtitle are stacked, and allowed to shrink so long text wraps */
    .sec-2-1 .lay-nm b { font-size: 17px; } /* the layer name is bold and slightly larger */
    .sec-2-1 .lay.c-user { border-style: dashed; } /* the "end user" layer has a dashed border because a person is not part of the machine */
    .sec-2-1 .lay.c-proc { border-color: var(--proc); background: var(--proc-bg); } /* the application layer uses the process color (teal) */
    .sec-2-1 .lay.c-util { border-color: var(--accent); background: var(--accent-bg); } /* the utilities and libraries layer uses the accent color */
    .sec-2-1 .lay.c-os { border-color: var(--os); background: var(--os-bg); } /* the operating system layer uses the OS color (purple) */
    .sec-2-1 .lay.c-hw { border-color: var(--cpu); background: var(--cpu-bg); } /* the hardware layer uses the processor color (blue) */
    .sec-2-1 .lay.dim { opacity: .33; } /* layers not involved in the current view or trace step fade to one third */
    .sec-2-1 .lay.sel { box-shadow: 0 0 0 3px var(--chc); } /* the layer the student clicked gets a chapter-colored outline */
    .sec-2-1 .lay.act { box-shadow: 0 0 0 4px var(--hl); } /* the layer active in the current trace frame gets a thick yellow highlight ring */
    .sec-2-1 .lay-role { flex: none; font-size: 13px; font-weight: 800; padding: 2px 10px; border-radius: 999px; background: var(--panel); color: var(--chc); border: 1.5px solid var(--chc); white-space: nowrap; } /* the role badge (for example "uses" or "builds"): a small pill with chapter-colored text and border that never wraps */
    .sec-2-1 .lay-gap { height: 34px; display: flex; align-items: center; gap: 10px; padding-left: 24px; } /* the space between two layers, which holds the arrow and the message that crosses that boundary */
    .sec-2-1 .lay-gap .ar { color: var(--muted); font-weight: 800; } /* the arrow between layers is gray and bold by default */
    .sec-2-1 .lay-gap .msg { font: 700 13px var(--mono); padding: 1px 10px; border-radius: 999px; background: var(--hl); color: var(--ink); } /* the message pill between layers (for example "system call") on a yellow highlight background */
    .sec-2-1 .lay-gap .msg:empty { display: none; } /* an empty message pill is hidden so no blank yellow blob shows */
    .sec-2-1 .lay-gap.on .ar { color: var(--chc); } /* when a boundary is active in the trace its arrow turns the chapter color */
    .sec-2-1 .lay-info { min-height: 84px; } /* gives the clicked-layer description card a minimum height so the layout does not jump as the text changes */
    /* step 3: services */
    .sec-2-1 .svc-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); grid-template-rows: 1fr 1fr; gap: 10px; height: 100%; } /* step 3 service cards: a 4-column grid with two equal rows filling the available height */
    .sec-2-1 .svc-card { display: flex; flex-direction: column; gap: 6px; } /* each service card stacks its heading, text and example in a column */
    .sec-2-1 .svc-card.svc-wide { grid-column: span 2; } /* a card marked "wide" spans two columns so seven cards fill the eight grid slots neatly */
    .sec-2-1 .svc-h { display: flex; align-items: center; gap: 8px; line-height: 1.25; } /* a card's heading row: the number badge and the service name side by side */
    .sec-2-1 .svc-n { flex: none; display: inline-grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; background: var(--os-bg); color: var(--os); font-size: 13px; font-weight: 800; } /* the round number badge on each service card, in purple OS colors */
    .sec-2-1 .svc-ex { margin-top: auto !important; padding-top: 5px; border-top: 1px dashed var(--line-2); } /* the example line is pushed to the bottom of the card and set off by a dashed line above it */
    .sec-2-1 .svc-game { display: grid; grid-template-columns: minmax(0, 7fr) minmax(0, 5fr); gap: 22px; height: 100%; } /* the classifier game layout: the scenario side is wider than the answer-button side */
    .sec-2-1 .svc-qcard { min-height: 132px; display: flex; align-items: center; } /* the card holding the scenario text keeps a minimum height and centers the text vertically */
    .sec-2-1 .svc-q { font-size: 19px; line-height: 1.45; font-weight: 600; } /* the scenario text itself, larger and semi-bold so it reads as the question */
    .sec-2-1 .svc-fb { min-height: 128px; padding: 11px 14px; border-radius: 12px; border: 1px solid var(--line); border-left: 5px solid var(--line-2); background: var(--panel-2); font-size: 15.5px; line-height: 1.5; } /* the feedback box under the scenario: fixed minimum height, left color bar, readable text size */
    .sec-2-1 .svc-fb.ok { background: var(--ok-bg); border-left-color: var(--ok); } /* correct feedback turns the box green */
    .sec-2-1 .svc-fb.ok .b { color: var(--ok); } /* the bold verdict word in correct feedback is green */
    .sec-2-1 .svc-fb.bad { background: var(--bad-bg); border-left-color: var(--bad); } /* wrong feedback turns the box red */
    .sec-2-1 .svc-fb.bad .b { color: var(--bad); } /* the bold verdict word in wrong feedback is red */
    .sec-2-1 .svc-btn { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 52px; text-align: left; padding: 7px 12px; border: 2px solid var(--line); border-radius: 10px; background: var(--panel); font: 650 15.5px var(--font); color: var(--ink); cursor: pointer; } /* each answer button fills the width, lines up its content in a row and is tall enough to tap easily */
    .sec-2-1 .svc-btn:hover:not(:disabled) { border-color: var(--chc); } /* hovering an answer button that is still active outlines it in the chapter color */
    .sec-2-1 .svc-btn.right { border-color: var(--ok); background: var(--ok-bg); } /* the answer the student got right is shown green */
    .sec-2-1 .svc-btn.wrong { border-color: var(--bad); background: var(--bad-bg); } /* a wrong answer the student picked is shown red */
    .sec-2-1 .svc-btn:disabled { cursor: default; } /* once answers are locked the buttons stop showing a hand pointer */
    .sec-2-1 .svc-btn:disabled:not(.right):not(.wrong) { opacity: .5; } /* locked answer buttons that were never picked fade to half strength so the chosen ones stand out */
    .sec-2-1 .svc-pill { width: 14px; height: 14px; border-radius: 4px; background: var(--panel-3); border: 1px solid var(--line-2); } /* each progress pill is a small gray square, one per scenario in the game */
    .sec-2-1 .svc-pill.ok { background: var(--ok); border-color: var(--ok); } /* a scenario answered right on the first try turns its pill green */
    .sec-2-1 .svc-pill.late { background: var(--warn); border-color: var(--warn); } /* a scenario that needed a second try turns its pill amber */
    .sec-2-1 .svc-pill.cur { outline: 2px solid var(--chc); outline-offset: 1px; } /* the pill for the scenario on screen now gets a chapter-colored outline */
    /* step 4: interfaces */
    .sec-2-1 .if-split { grid-template-columns: minmax(0, 14fr) minmax(0, 11fr); gap: 20px; } /* step 4 layout: the diagram column is a little wider than the explanation column */
    .sec-2-1 .if-code td.mono { white-space: nowrap; font-size: 13.5px; } /* the machine-code cells in the example table never wrap and use slightly smaller type */
    .sec-2-1 .if-code td { font-size: 14px; } /* all cells of the example table use a compact 14px font */
    .sec-2-1 .if-code th:first-child { white-space: normal; } /* the first header cell of the example table may wrap, unlike the code cells below it */
    .sec-2-1 .if-code tr.ok td { background: var(--ok-bg); } /* example lines an ordinary program may run are tinted green */
    .sec-2-1 .if-code tr.bad td { background: var(--bad-bg); } /* example lines only the OS may run (system ISA) are tinted red */
    .sec-2-1 .if-code tr.cur td { background: color-mix(in srgb, var(--chc) 14%, var(--panel)); } /* example lines being pointed out right now get a faint chapter-colored tint */
    .sec-2-1 .if-wrap { display: grid; place-items: center; padding: 8px 10px; } /* the white card around the diagram centers the drawing inside it */
    .sec-2-1 .if-ln { stroke: var(--line-2); stroke-width: 3; stroke-dasharray: 7 6; transition: stroke .2s, stroke-width .2s; } /* the interface lines in the diagram start as thin dashed gray lines and change color smoothly */
    .sec-2-1 .if-ln.thick { stroke-width: 5; stroke-dasharray: none; stroke: var(--ink-2); } /* the hardware/software line is drawn thicker and solid because it is the most basic boundary */
    .sec-2-1 .if-ln.on { stroke: var(--chc); stroke-width: 7; stroke-dasharray: none; } /* an interface line that belongs to the chosen interface turns thick, solid and chapter-colored */
    .sec-2-1 .if-lane { fill: var(--panel-2); stroke: var(--line-2); stroke-dasharray: 6 5; transition: fill .2s, stroke .2s; } /* the "user ISA" lane on the right of the diagram: a pale box with a dashed outline */
    .sec-2-1 .if-lane.on { fill: color-mix(in srgb, var(--chc) 14%, var(--panel)); stroke: var(--chc); stroke-width: 3; stroke-dasharray: none; } /* when the chosen interface includes the user ISA, the lane tints and gets a solid chapter-colored outline */
    .sec-2-1 .if-tag { fill: var(--panel); stroke: var(--ink-2); stroke-width: 1.5; } /* the clickable label pills in the diagram (library calls, system calls, hardware | software) */
    .sec-2-1 .hot:hover .if-tag, .sec-2-1 .hot:focus-visible .if-tag { stroke: var(--chc); stroke-width: 3; } /* hovering or keyboard-focusing a label pill thickens its outline in the chapter color */
    .sec-2-1 .if-card { min-height: 0; } /* lets the explanation card shrink instead of forcing the page to grow */
    .sec-2-1 .if-card .tbl td:first-child { width: 96px; white-space: nowrap; } /* in the "Made of / Gives you" table, the label column has a fixed width and never wraps */
    .sec-2-1 .if-real { padding: 6px 12px; border-radius: 10px; border-left: 4px solid var(--chc); background: var(--panel-2); line-height: 1.4; } /* the "In practice" line: a pale box with a chapter-colored bar on the left */
    /* step 5: portability */
    .sec-2-1 .port-tbl th { vertical-align: middle; font-size: 12px; line-height: 1.9; } /* step 5 table headers are centered vertically, small, with room for the two stacked chips */
    .sec-2-1 .port-tbl th .chip { text-transform: none; letter-spacing: 0; } /* the processor and OS chips in the headers keep normal capitalization and spacing */
    .sec-2-1 .port-tbl td { vertical-align: middle; } /* table cells are centered vertically so the buttons line up with the row labels */
    .sec-2-1 .port-tbl td:first-child { line-height: 1.25; } /* the row label (what you carry) uses tighter line spacing so its two lines stay compact */
    .sec-2-1 .port-cell { width: 100%; min-width: 74px; height: 38px; border-radius: 9px; border: 2px dashed var(--line-2); background: var(--panel); font: 800 15px var(--font); color: var(--muted); cursor: pointer; } /* each prediction cell is a dashed, rounded button showing "?" until the student predicts */
    .sec-2-1 .port-cell:hover { border-color: var(--chc); color: var(--chc); } /* hovering a prediction cell colors its border and "?" in the chapter color */
    .sec-2-1 .port-cell.ok { border: 2px solid var(--ok); background: var(--ok-bg); color: var(--ok); } /* a cell whose program runs turns solid green */
    .sec-2-1 .port-cell.bad { border: 2px solid var(--bad); background: var(--bad-bg); color: var(--bad); } /* a cell whose program does not run turns solid red */
    .sec-2-1 .port-cell.sel { box-shadow: 0 0 0 3px var(--chc); } /* the cell being explained on the right gets a chapter-colored ring */
    .sec-2-1 .port-detail { flex: 1; min-height: 0; } /* the explanation card grows to fill the space left under the table */
    .sec-2-1 .port-fork { margin-top: auto !important; padding: 6px 10px; border-radius: 8px; background: var(--panel-2); border: 1px dashed var(--line-2); line-height: 1.4; } /* the note explaining fork() sits at the bottom of the card in a pale dashed box */
    .sec-2-1 .btn.ok-b { border-color: var(--ok); color: var(--ok); } /* the "Predict: it runs" button gets a green border and text */
    .sec-2-1 .btn.bad-b { border-color: var(--bad); color: var(--bad); } /* the "Predict: it won't" button gets a red border and text */
    .sec-2-1 .port-verdict { font-weight: 800; font-size: 17px; padding: 5px 12px; border-radius: 10px; white-space: pre-wrap; } /* the verdict line after a prediction: bold, larger, and keeps the double space between its two sentences */
    .sec-2-1 .port-verdict.ok { background: var(--ok-bg); color: var(--ok); } /* a verdict of "it runs" is green */
    .sec-2-1 .port-verdict.bad { background: var(--bad-bg); color: var(--bad); } /* a verdict of "it will not run" is red */
    .sec-2-1 .port-checks { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; } /* the ISA, ABI and API check boxes sit side by side in three equal columns */
    .sec-2-1 .port-check { display: flex; flex-direction: column; padding: 5px 10px; border-radius: 10px; border: 2px solid var(--line); font-size: 13.5px; line-height: 1.3; } /* each check box is a rounded, bordered column holding the interface name and its result */
    .sec-2-1 .port-check b { font-size: 15px; } /* the interface name inside a check box is bold and slightly larger */
    .sec-2-1 .port-check.ok { border-color: var(--ok); } .sec-2-1 .port-check.ok span { color: var(--ok); font-weight: 700; } /* an interface that matches gets a green border and green result text */
    .sec-2-1 .port-check.bad { border-color: var(--bad); } .sec-2-1 .port-check.bad span { color: var(--bad); font-weight: 700; } /* an interface that differs gets a red border and red result text */
    .sec-2-1 .port-check.na { border-style: dashed; } .sec-2-1 .port-check.na span { color: var(--muted); } /* an interface that does not matter in this case gets a dashed border and gray text */
    /* step 6: resource manager */
    .sec-2-1 .rm-grid { display: grid; grid-template-columns: minmax(0, 1fr) 316px; gap: 16px; min-height: 0; } /* step 6 layout: the diagram area takes the free space and the resource list gets a fixed 316px column */
    .sec-2-1 .rm-main { padding: 8px 12px 10px; display: flex; flex-direction: column; gap: 6px; } /* the white card holding the diagram, the timer switch and the history strip, stacked in a column */
    .sec-2-1 .rm-strip-row { gap: 10px; } /* spacing between the "Who had the processor" label and its strip */
    .sec-2-1 .rm-what { margin-top: auto; gap: 12px; align-items: center; } /* pushes the "no timer" question row to the bottom of the card, vertically centered */
    .sec-2-1 .rm-strip { flex: 1; display: grid; grid-template-columns: repeat(11, minmax(0, 1fr)); gap: 4px; } /* the history strip: 11 equal columns, one for each moment of the animation */
    .sec-2-1 .rm-cell { height: 26px; border-radius: 6px; border: 1.5px dashed var(--line-2); display: grid; place-items: center; font: 800 12.5px var(--mono); } /* each history cell is a small dashed box that will show who had the processor at that moment */
    .sec-2-1 .rm-cell.os { border: 1.5px solid var(--os); background: var(--os-bg); color: var(--os); } /* a moment when the OS had the processor is filled in purple */
    .sec-2-1 .rm-cell.proc { border: 1.5px solid var(--proc); background: var(--proc-bg); color: var(--proc); } /* a moment when a program (A or B) had the processor is filled in teal */
    .sec-2-1 .rm-cell.now { box-shadow: 0 0 0 3px var(--hl); } /* the cell for the moment on screen now gets a yellow ring */
    .sec-2-1 .rm-res { display: grid; grid-template-columns: 112px minmax(0, 1fr); align-items: center; gap: 8px; line-height: 1.25; padding: 4px 8px; border: 2px solid var(--line); border-radius: 10px; background: var(--panel); transition: border-color .2s, background .2s; } /* each resource row: a fixed-width chip column and a description column, inside a bordered box */
    .sec-2-1 .rm-res.on { border-color: var(--chc); background: color-mix(in srgb, var(--chc) 9%, var(--panel)); } /* a resource being used at this moment gets a chapter-colored border and faint tint */
    .sec-2-1 .rm-res .chip { justify-self: start; } /* keeps each resource chip at the left of its column instead of stretching */
    .sec-2-1 .rm-ev { font-size: 14.5px; padding: 4px 10px; border-radius: 10px; background: var(--panel-2); border: 1px dashed var(--line-2); } /* the "Event:" box: small text in a pale dashed box */
    .sec-2-1 .rm-ev.hot-ev { background: var(--intr-bg); border: 1px solid var(--intr); } /* when something actually happens (a system call or an interrupt) the event box turns red */
    .sec-2-1 .rm-wrap .player-cap { min-height: 3.1em; } /* gives the animation caption a fixed minimum height so the page does not jump between moments */
    /* step 7: evolution */
    .sec-2-1 .evo-r { display: flex; flex-direction: column; gap: 1px; padding: 7px 12px; border-left: 4px solid var(--chc); background: var(--panel-2); border-radius: 10px; line-height: 1.35; } /* each reason card (hardware, services, fixes): a pale box with a chapter-colored left bar */
    .sec-2-1 .evo-btns { gap: 8px; } /* gap between the four change-request buttons */
    .sec-2-1 .evo-btn { display: flex; flex-direction: column; align-items: flex-start; gap: 0; text-align: left; padding: 5px 12px; border: 2px solid var(--line); border-radius: 10px; background: var(--panel); font: 650 15px var(--font); color: var(--ink); cursor: pointer; line-height: 1.3; } /* each change-request button stacks its category and its name, left-aligned */
    .sec-2-1 .evo-btn:hover { border-color: var(--chc); } /* hovering a change-request button outlines it in the chapter color */
    .sec-2-1 .evo-btn.done { border-color: color-mix(in srgb, var(--chc) 45%, var(--line)); } /* a change already applied keeps a faint chapter-colored border */
    .sec-2-1 .evo-btn.on { border-color: var(--chc); background: color-mix(in srgb, var(--chc) 10%, var(--panel)); box-shadow: 0 0 0 1px var(--chc); } /* the most recently applied change is fully highlighted */
    .sec-2-1 .evo-panel { display: flex; flex-direction: column; gap: 4px; } /* each design panel (tangled or modular) stacks its title, drawing and edit count */
    .sec-2-1 .evo-count { color: var(--ink-2); } /* the "Parts edited so far" line uses the secondary text color */
    .sec-2-1 .evo-why { font-size: 14.5px; line-height: 1.45; min-height: 92px; } /* the explanation box for the latest change keeps a minimum height so the panels above do not jump */
    .sec-2-1 .evo-board { padding: 8px 12px; border-radius: 10px; border: 1px dashed var(--line-2); background: var(--panel-2); line-height: 1.45; } /* the running-total board: a pale dashed box under the "build it from modules" callout */
    .sec-2-1 .evo-board.full { border: 1px solid var(--ok); background: var(--ok-bg); } /* once all four changes are applied the board turns green */
    @media (max-width: 760px) { /* phone-layout rules: everything inside applies only when the screen is 760px wide or less */
      .sec-2-1 .svc-grid, .sec-2-1 .svc-game { grid-template-columns: 1fr; grid-template-rows: none; height: auto; } /* the services grid and the game become a single column that grows to fit its content */
      .sec-2-1 .svc-card.svc-wide { grid-column: auto; } /* the wide service card no longer spans two columns */
      .sec-2-1 .rm-grid { grid-template-columns: minmax(0, 1fr); } /* the resource manager step puts the resource list below the diagram */
      .sec-2-1 .rm-strip-row { flex-wrap: wrap; } /* the history strip is allowed to wrap onto its own line */
      .sec-2-1 .rm-strip { flex: 1 1 100%; gap: 2px; } /* the history strip takes the full width and packs its cells closer */
      .sec-2-1 .port-tbl td:first-child .xs { font-size: 11px; line-height: 1.2; } /* the small description under each "You carry" label shrinks to fit the column */
      .sec-2-1 .port-tbl { table-layout: fixed; } /* the portability table uses fixed column widths so it cannot overflow the screen */
      .sec-2-1 .port-tbl th:first-child { width: 74px; } /* the first column (what you carry) is limited to 74px */
      .sec-2-1 .port-tbl th, .sec-2-1 .port-tbl td { padding: 4px 3px; } /* all table cells get tighter padding */
      .sec-2-1 .port-tbl th .chip { font-size: 11px; padding: 0 4px; } /* the header chips get smaller type and padding */
      .sec-2-1 .port-tbl th:first-child { font-size: 10.5px; } /* the first header cell gets smaller type */
      .sec-2-1 .port-tbl td:first-child { font-size: 13px; } /* the row labels get smaller type */
      .sec-2-1 .port-cell { min-width: 0; font-size: 13px; } /* the prediction buttons may shrink and use smaller type */
      .sec-2-1 .port-checks { grid-template-columns: minmax(0, 1fr); } /* the ISA, ABI and API check boxes stack in one column */
    } /* ends the phone-layout rules */
  `,  // end of this section's CSS text

  steps: [  // steps: the list of slides in this section, shown one at a time in this order
    /* ---------------- 1. Big picture: what an OS is for ---------------- */
    {  // step 1 begins: the three objectives of an OS, explored by clicking tiles
      title: 'What is an operating system for?',  // the title shown at the top of step 1
      kind: 'story',  // kind "story" labels this step as the Big Picture in the heading above the title
      render(el, ctx) {  // render(el, ctx) runs when the student arrives on this step; el is the empty step area and ctx holds the guide's helpers
        const { h } = ctx;  // pulls out h(tag, props, children), the guide's helper that builds one HTML element, so the step is assembled in code
        const GOALS = [  // GOALS: the three OS objectives, one object each, with the texts the detail card shows when a tile is clicked
          { key: 'conv', name: 'Convenience', term: 'Convenience', tag: 'Easy to use',  // objective 1, convenience: key, display name, glossary term and the short tag line for its tile
            without: 'To save one paragraph, your program would need your SSD\'s exact command codes, pick free storage blocks itself and poll the device until it finished. Every program would repeat that work for every device model.',  // convenience, the "without" case: every program would have to drive the storage device itself
            with: 'Your program says “write these bytes to essay.txt”. The OS deals with the device, the free space and the waiting, and the same request works on any drive.',  // convenience, the "with" case: one simple request that works on any drive
            how: 'Simple services and interfaces: files instead of disk blocks, windows instead of pixels, connections instead of network packets.' },  // convenience, how the OS achieves it: simple services such as files, windows and connections
          { key: 'eff', name: 'Efficiency', term: 'Efficiency', tag: 'Use hardware well',  // objective 2, efficiency: key, name, glossary term and tag line
            without: 'A program computes for 2 ms, then waits 8 ms for the disk, over and over. Run alone, the processor is idle 8 ms of every 10 ms: <b>80% of its time wasted</b>. Memory holds one program even though there is room for several.',  // efficiency, the "without" case: the 2 ms compute / 8 ms wait pattern leaves the processor 80% idle
            with: 'During those 8 ms of waiting, the OS hands the processor to another program, so the idle time is put to use. Memory is divided so several programs fit at once, and devices work in parallel with the processor.',  // efficiency, the "with" case: another program uses the waiting time and memory holds several programs
            how: 'Deciding which program gets the processor, how much memory, and which device, and when. That is the OS as resource manager.' },  // efficiency, how the OS achieves it: acting as the resource manager
          { key: 'evo', name: 'Ability to evolve', term: 'Ability to evolve', tag: 'Keep up with change',  // objective 3, ability to evolve: key, name, glossary term and tag line
            without: 'Plug in a new kind of graphics card and nothing can use it until the whole OS is rewritten. Every bug fix risks breaking some unrelated part, so fixes are rare and scary.',  // ability to evolve, the "without" case: new hardware needs a rewrite and every fix is risky
            with: 'A new driver or a new service slots in behind an interface that does not change, so existing programs keep working. Fixes ship as routine updates.',  // ability to evolve, the "with" case: new drivers and services slot in behind unchanged interfaces
            how: 'Building the OS from modules with clearly defined interfaces, and documenting them well.' },  // ability to evolve, how the OS achieves it: modules with clear, documented interfaces
        ];  // closes the GOALS list
        let cur = 0;  // cur remembers which objective tile is selected (0, 1 or 2)
        const tiles = GOALS.map((g, i) => h('button', { type: 'button', class: 'obj-tile', 'aria-label': 'Objective ' + (i + 1) + ': ' + g.name, onclick: () => pick(i) },  // builds one clickable tile button per objective; clicking it calls pick with that tile's position
          h('span', { class: 'obj-n' }, String(i + 1)),  // the tile's round number badge (1, 2 or 3)
          h('span', { class: 'obj-name' }, g.name),  // the tile's objective name in bold
          h('span', { class: 'obj-tag' }, g.tag)));  // the tile's short tag line; closes the tile and the map over GOALS
        const detail = h('div', { class: 'card white obj-detail', 'aria-live': 'polite' });  // the detail card that explains the chosen objective; aria-live makes screen readers announce its new text
        function pick(i) {  // pick(i) runs when a tile is clicked (and once at the start): it marks the tile and refills the detail card
          cur = i;  // remembers the chosen objective
          tiles.forEach((t, j) => t.classList.toggle('on', j === i));  // turns on the "on" style for the chosen tile and off for the other two
          const g = GOALS[i];  // g is the chosen objective's data
          detail.replaceChildren(  // replaces everything in the detail card with the new content listed below
            h('h3', { html: `Objective ${i + 1}: <span class="t" data-t="${g.term}">${g.name}</span>` }),  // the card heading, with the objective's name as a dotted glossary word the student can hover
            h('div', { class: 'obj-ww' },  // the two-column box that holds the "without" and "with" cases
              h('div', { class: 'obj-w bad' }, h('b', {}, 'Without an OS taking care of it'), h('p', { class: 'small m0', html: g.without })),  // red box: what the computer is like without this objective
              h('div', { class: 'obj-w ok' }, h('b', {}, 'With the OS doing its job'), h('p', { class: 'small m0', html: g.with }))),  // green box: what the OS does instead; closes the two-column box
            h('p', { class: 'small m0 obj-how', html: '<b>How the OS gets there:</b> ' + g.how }));  // the "How the OS gets there" line; closes the new card content
          detail.classList.remove('fade-in'); void detail.offsetWidth; detail.classList.add('fade-in');  // restarts the fade-in animation: reading offsetWidth forces the browser to notice the removal before the class returns
        }  // ends pick()
        const left = h('div', { class: 'stack' },  // left column of the step: definition, instructions, analogy and a preview of the section
          h('p', { class: 'lead m0', html: 'An <span class="t">operating system</span> is a program that <b>controls the execution of application programs</b> and acts as the <b>go-between</b> for those programs and the computer hardware.' }),  // lead paragraph: the definition of an operating system, with the key words in bold
          h('p', { class: 'm0', html: 'Almost every design decision inside an OS serves one of three objectives. Click each one ' + (ctx.narrow ? 'below' : 'on the right') + ' to see what a computer would be like without it.' }),  // instruction line; it says "below" on a phone-width screen (where the tiles move under the text) and "on the right" otherwise
          h('div', { class: 'callout analogy m0', 'data-label': 'Analogy: a big public library', html: 'The front desk lets you borrow any book just by asking, without learning how the stacks are shelved (<b>convenience</b>). Staff keep study rooms and computers booked so none sit empty while people wait (<b>efficiency</b>). Over the years the library adds e-books and a maker space without ever closing its doors (<b>ability to evolve</b>).' }),  // analogy box: a public library shows all three objectives at once
          h('div', { class: 'stack gap-s' },  // a small stack for the preview of what comes next
            h('h4', { class: 'm0' }, 'Coming up in this section'),  // heading: "Coming up in this section"
            h('div', { class: 'row gap-s' }, ...['the layers of a system', 'seven OS services', 'ISA · ABI · API', 'the OS as resource manager', 'built to change'].map((t) => h('span', { class: 'chip os' }, t)))));  // a row of purple chips, one per later step of this section; closes the preview and the left column
        const right = h('div', { class: 'stack' },  // right column of the step: the tiles, the detail card and a note about trade-offs
          h('div', { class: 'grid-3 obj-tiles' }, ...tiles),  // the three objective tiles in a 3-column grid
          detail,  // the detail card, placed under the tiles
          h('div', { class: 'callout why m0', 'data-label': 'Why it matters', html: 'The goals can pull against each other: a slick graphical interface (convenience) costs processor time and memory (efficiency). OS design is largely about balance.' }));  // "Why it matters" box: the objectives can pull against each other; closes the right column
        el.append(h('div', { class: 'split l fill' }, left, right));  // puts both columns on screen, side by side, filling the step area (they stack on a phone)
        pick(0);  // shows objective 1 right away so the detail card is never empty
      },  // ends render() for step 1
    },  // ends step 1

    /* ---------------- 2. Layers, viewpoints and a request that travels through them ---------------- */
    {  // step 2 begins: the layers of a computer system, seen by different people and by one request
      title: 'The OS as a user/computer interface: the layers',  // the title shown at the top of step 2
      kind: 'explore',  // kind "explore" labels this step as an Explore step
      core: true, // on the shorter core path
      render(el, ctx) {  // render(el, ctx) builds step 2 when the student arrives on it
        const { h } = ctx;  // pulls the h element-building helper out of ctx
        const LAYERS = [  // LAYERS: the five layers from top (the person) to bottom (the hardware), drawn as a stack of bars
          { id: 'user', name: 'End user', sub: 'the person at the screen', col: 'user',  // layer 1, the end user: id, name, subtitle and color group ("user" gives it a dashed border)
            d: 'The person using the computer. An end user sees the machine only through applications and never needs to know how the hardware works.' },  // description of the end-user layer, shown when that bar is clicked
          { id: 'apps', name: 'Application programs', sub: 'browser, spreadsheet, game', col: 'proc',  // layer 2, application programs, drawn in the process color
            d: 'Programs that do a job for the user. They are written against the services of the layers below, not against raw hardware, so they do not care which disk or screen is attached.' },  // description of the application layer: programs written against services, not hardware
          { id: 'utils', name: 'Utilities and libraries', sub: 'editors, compilers, debuggers, shells, file tools', col: 'util',  // layer 3, utilities and libraries, drawn in the accent color
            d: '<span class="t">Utilities</span> are system programs that ship with the OS. They help people build programs, manage files and control devices. <span class="t">Libraries</span> hold ready-made routines programs call. Useful, but not the kernel itself.' },  // description of utilities and libraries, with both names as glossary words
          { id: 'os', name: 'Operating system', sub: 'controls the hardware, offers services upward', col: 'os',  // layer 4, the operating system, drawn in the OS color
            d: 'Controls the hardware and offers services to everything above: running programs, files, device access, protection, error handling. It hides the messy hardware details behind those services.' },  // description of the OS layer: controls hardware, offers services upward
          { id: 'hw', name: 'Computer hardware', sub: 'processor, memory, I/O devices, storage', col: 'hw',  // layer 5, the computer hardware, drawn in the processor color
            d: 'The physical machine. It understands only machine instructions and device commands, nothing as friendly as a “file” or a “window”.' },  // description of the hardware layer: it knows only instructions and device commands
        ];  // closes the LAYERS list
        const VIEWS = {  // VIEWS: the three kinds of people who look at the stack, keyed by id
          user: { name: 'End user', roles: { user: 'you are here', apps: 'uses' },  // the end user: roles gives the badge text for each layer this person deals with
            d: 'An end user cares about <b>what an application does</b>, not how the computer works. The whole stack exists so that this person can ignore everything below the application.',  // what the end user cares about
            never: 'device commands, memory addresses, which program gets the processor' },  // what the end user never has to think about
          prog: { name: 'Application programmer', roles: { apps: 'writes', utils: 'uses', os: 'calls its services' },  // the application programmer: writes applications, uses utilities, calls OS services
            d: 'A programmer writes applications in a programming language, using the <b>utilities</b> that come with the system (editor, compiler, debugger, libraries) and the <b>services</b> the OS offers.',  // what the programmer works with
            never: 'the exact command codes of each disk or display model' },  // what the programmer never has to think about
          osd: { name: 'OS designer', roles: { utils: 'serves', os: 'builds', hw: 'must master' },  // the OS designer: serves the utilities, builds the OS, must master the hardware
            d: 'The people who build the OS work in the middle. They must understand the <b>hardware</b> below in detail and design clean <b>services</b> for the programs above.',  // what the OS designer works with
            never: 'what any particular application is for' },  // what the OS designer never has to think about
        };  // closes the VIEWS table
        const TRACE = [  // TRACE: the frames of the "save a document" animation; lay = layer to light up, gap = boundary to show, msg = what crosses it
          { lay: 'user', gap: 0, msg: 'Ctrl+S', cap: '<b>You</b> press Ctrl+S in your word processor. That is all you do, and all you see.' },  // frame 1: the student presses Ctrl+S in the word processor
          { lay: 'apps', gap: 1, msg: 'library call: fwrite(…)', cap: 'The <b>word processor</b> turns your document into bytes and calls the <span class="t">library</span> routine fwrite to write them to the file essay.docx.' },  // frame 2: the word processor calls the library routine fwrite
          { lay: 'utils', gap: 2, msg: 'system call', cap: 'The <b>library routine</b> packages the request and makes a <span class="t">system call</span>: the official way to ask the OS for a service. The processor switches into the OS, in <span class="t">kernel mode</span>.' },  // frame 3: the library routine makes a system call and the processor enters kernel mode
          { lay: 'os', gap: 3, msg: 'device commands', cap: 'The <b>OS</b> checks you may write this file and finds free space; its <span class="t">device driver</span> turns “write these bytes here” into the drive\'s own commands.' },  // frame 4: the OS checks permission and its device driver speaks the drive's commands
          { lay: 'hw', gap: 3, msg: '↑ interrupt: done', cap: 'The <b>drive</b> stores the data, then raises an <span class="t">interrupt</span> to tell the processor (and so the OS) that the job is finished.' },  // frame 5: the drive finishes and raises an interrupt back up to the OS
          { lay: 'all', gap: -1, msg: '', cap: 'The OS wakes the waiting program, the library routine returns, and the word processor shows “Saved”. <b>Five layers</b> took part; you saw one word.' },  // frame 6: every layer lights up as the result travels back and "Saved" appears
        ];  // closes the TRACE list
        const CROSS = [  // CROSS: the rows of the "Boundary crossed / What crosses it" table under the animation
          ['You → application', 'a keystroke or click'],  // row 1: from you to the application, a keystroke or click
          ['Application → library', 'a library call'],  // row 2: from the application to the library, a library call
          ['Library → OS', 'a system call'],  // row 3: from the library to the OS, a system call
          ['OS → hardware', 'device commands'],  // row 4: from the OS to the hardware, device commands
          ['Hardware → OS', 'an interrupt'],  // row 5: from the hardware back to the OS, an interrupt
        ];  // closes the CROSS table
        let traceRows = [];  // traceRows will hold the table rows of the trace tab while that tab is open
        let mode = 'view', view = 'user', selLayer = 'user', frame = 0;  // mode is "view" or "trace" (which tab is open); view is the chosen person; selLayer the clicked layer; frame the trace frame
        const layEls = {}, gapEls = [];  // layEls maps each layer id to its bar on screen; gapEls holds the four spaces between the bars
        const stack = h('div', { class: 'lay-stack' });  // stack is the column that will hold the five layer bars
        LAYERS.forEach((l, i) => {  // builds one bar for each layer, plus a gap below every layer except the last
          const role = h('span', { class: 'lay-role' });  // the role badge on the right of the bar, filled in later by paint()
          const b = h('div', { class: 'lay c-' + l.col, role: 'button', tabindex: 0, 'aria-label': l.name },  // the layer bar itself: acts as a button (role and tabindex let the keyboard reach it) and is colored by its group
            h('div', { class: 'lay-nm' }, h('b', {}, l.name), h('span', { class: 'xs muted' }, l.sub)), role);  // inside the bar: the layer's name in bold over its gray subtitle, then the role badge; closes the bar
          b._role = role;  // keeps a handle to the badge on the bar itself so paint() can change its text later
          const act = () => { selLayer = l.id; if (mode !== 'view') tabs.show(0); else paint(); };  // act: what a click does; it selects the layer and, if the trace tab is open, switches back to the first tab
          ctx.on(b, 'click', act);  // ctx.on adds a click listener that the guide removes automatically when the student leaves the step
          ctx.on(b, 'keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); } });  // Enter or Space on a focused bar does the same as a click, so the step works from the keyboard
          layEls[l.id] = b;  // remembers the bar under its layer id
          stack.append(b);  // adds the bar to the stack
          if (i < LAYERS.length - 1) {  // every layer except the last gets a gap under it
            const g = h('div', { class: 'lay-gap' }, h('span', { class: 'ar' }, '↕'), h('span', { class: 'msg' }));  // the gap holds an up-down arrow and an (empty at first) message pill for what crosses that boundary
            gapEls.push(g); stack.append(g);  // remembers the gap and adds it to the stack
          }  // ends the gap case
        });  // ends the loop over the layers
        const viewCard = h('div', { class: 'card white stack gap-s' });  // the card that describes the chosen person in the "Who sees what" tab
        const layerCard = h('div', { class: 'card tight lay-info', 'aria-live': 'polite' });  // the smaller card that describes the clicked layer; announced to screen readers when it changes
        function paint() {  // paint() redraws the whole step from the state variables: runs on every click, tab change and animation frame
          const v = VIEWS[view];  // v is the chosen person's data
          const f = TRACE[frame];  // f is the current frame of the save animation
          LAYERS.forEach((l) => {  // updates each layer bar in turn
            const e = layEls[l.id];  // e is this layer's bar
            const seen = mode === 'view' ? !!v.roles[l.id] : (f.lay === 'all' || f.lay === l.id);  // seen: in the view tab, whether this person deals with the layer; in the trace tab, whether this frame uses it
            e.classList.toggle('dim', !seen);  // layers not seen fade out
            e.classList.toggle('sel', mode === 'view' && selLayer === l.id);  // the clicked layer gets an outline, but only in the view tab
            e.classList.toggle('act', mode === 'trace' && seen);  // layers active in the trace get the yellow ring, but only in the trace tab
            e._role.textContent = mode === 'view' ? (v.roles[l.id] || '') : '';  // the badge shows the person's role for this layer in the view tab and is blank in the trace tab
            e._role.style.display = e._role.textContent ? '' : 'none';  // hides the badge completely when it has no text
          });  // ends the loop over the bars
          gapEls.forEach((g, i) => {  // updates each gap between the bars
            const on = mode === 'trace' && f.gap === i;  // a gap is lit only in the trace tab and only if this frame's request is crossing it
            g.classList.toggle('on', on);  // turns the gap's arrow chapter-colored when lit
            g.querySelector('.msg').textContent = on ? f.msg : '';  // shows what crosses the boundary (for example "system call") in the lit gap, nothing elsewhere
          });  // ends the loop over the gaps
          traceRows.forEach((r, i) => {  // updates the rows of the trace table
            const shown = i <= frame;  // a row is filled in once the animation has reached or passed its frame
            r.classList.toggle('on', i === frame);  // the row for the current frame is highlighted
            r.lastChild.textContent = shown ? CROSS[i][1] : '…';  // the second cell shows what crosses the boundary, or "…" if the animation has not reached it yet
          });  // ends the loop over the table rows
          if (mode === 'view') {  // the two cards only exist in the view tab, so they are refilled only there
            viewCard.replaceChildren(  // refills the person card
              h('h3', { class: 'm0' }, v.name),  // the person's name as the card heading
              h('p', { class: 'small m0', html: v.d }),  // what this person cares about
              h('p', { class: 'xs muted m0', html: '<b>Never has to think about:</b> ' + v.never }));  // what this person never has to think about; closes the person card
            const L = LAYERS.find((x) => x.id === selLayer);  // L is the data of the clicked layer
            layerCard.replaceChildren(h('h4', { class: 'm0' }, 'Layer: ' + L.name), h('p', { class: 'small m0', html: L.d }));  // refills the layer card with that layer's name and description
          }  // ends the view-tab case
        }  // ends paint()
        const tabs = ctx.ui.tabs([  // ctx.ui.tabs builds a row of tab buttons over one panel; each tab's render fills the panel when it is chosen
          { label: 'Who sees what', render: (p) => {  // tab 1, "Who sees what": p is the empty tab panel to fill
            mode = 'view';  // switches the step into view mode
            const seg = ctx.ui.seg([{ value: 'user', label: 'End user' }, { value: 'prog', label: 'Programmer' }, { value: 'osd', label: 'OS designer' }], view, (x) => { view = x; paint(); });  // three buttons (a segmented control) for choosing the person; choosing one repaints the step
            p.append(h('div', { class: 'stack' },  // fills the tab panel with a vertical stack
              h('p', { class: 'small m0' }, 'Pick a person. The layers they work with light up. Click any layer to read what it does.'),  // instruction line for this tab
              seg, viewCard, layerCard,  // the person buttons, then the person card and the layer card
              h('div', { class: 'callout warn m0', 'data-label': 'Common mistake', html: 'Calling the compiler or the file manager “the OS”. They ship with it, but they are ordinary programs that ask the OS for services, just like your applications do.' })));  // "Common mistake" box: utilities ship with the OS but are not the OS; closes the stack and the panel
            paint();  // paints once so the tab opens in the right state
          } },  // ends tab 1
          { label: 'Follow a request down and back', render: (p) => {  // tab 2, "Follow a request down and back": the save-a-document animation
            mode = 'trace'; frame = 0;  // switches into trace mode and starts at the first frame
            traceRows = CROSS.map((c) => h('tr', {}, h('td', { class: 'b' }, c[0]), h('td', {}, '…')));  // builds one table row per boundary, with "…" in the second cell until the animation gets there
            const tbl = h('table', { class: 'tbl compact' }, h('thead', {}, h('tr', {}, h('th', {}, 'Boundary crossed'), h('th', {}, 'What crosses it'))), h('tbody', {}, ...traceRows));  // the trace table: a header row and the five boundary rows
            const player = ctx.ui.player({ count: TRACE.length, interval: 2200, render: (i) => { frame = i; paint(); return TRACE[i].cap; } });  // ctx.ui.player makes the animation controls (play, pause, step); each frame repaints the step and returns its caption
            p.append(h('div', { class: 'stack' },  // fills the tab panel with a vertical stack
              h('p', { class: 'small m0', html: 'Saving a document looks like one action. Step through it: each layer talks <b>only to its neighbours</b>, through an agreed interface.' }),  // instruction line: each layer talks only to its neighbors, through an agreed interface
              player.el, tbl,  // the animation controls, then the table below them
              h('div', { class: 'callout tip m0', 'data-label': 'Notice', html: 'The word processor never learns which drive you own. Swap the SSD for a USB stick and it still works: only the OS layer changes.' })));  // "Notice" box: swapping the drive changes only the OS layer; closes the stack and the panel
            return () => { player.stop(); traceRows = []; };  // the cleanup the tabs run when this tab closes: stop the animation and forget the table rows
          } },  // ends tab 2
        ]);  // closes the list of tabs
        el.append(h('div', { class: 'split lay-split fill' },  // puts the step on screen: the layer stack on the left, the tabs on the right, filling the step area
          h('div', { class: 'stack' }, stack),  // left column holding the stack of layer bars
          tabs));  // right column holding the tabs; closes the layout
      },  // ends render() for step 2
    },  // ends step 2

    /* ---------------- 3. The seven services + a classifier game ---------------- */
    {  // step 3 begins: the seven services an OS provides, plus a game that practices telling them apart
      title: 'Seven services the OS provides',  // the title shown at the top of step 3
      kind: 'lab',  // kind "lab" labels this step as a Hands-on Lab
      render(el, ctx) {  // render(el, ctx) builds step 3 when the student arrives on it
        const { h } = ctx;  // pulls the h element-building helper out of ctx
        const SV = [  // SV: the seven services, each with a name, an everyday example, a description and a hint for wrong answers
          { name: 'Program development', ex: 'Stepping through your code in the debugger that came with the system.',  // service 1, program development, with its everyday example: the debugger that came with the system
            d: 'Editors, compilers and debuggers help people create programs. They come with the OS, but strictly they are <span class="t">utilities</span>, not part of the kernel.',  // description: editors, compilers and debuggers are utilities, not part of the kernel
            hint: 'Program development covers the tools for writing, compiling and debugging code.' },  // hint shown when a student wrongly picks program development in the game
          { name: 'Program execution', ex: 'You double-click an icon and the app simply starts.',  // service 2, program execution: double-clicking an icon starts the app
            d: 'Running a program takes many chores: load its instructions and data into memory, open its files, prepare its I/O devices and other resources. The OS does them all for you.',  // description: loading code and data and preparing files and devices before starting a program
            hint: 'Program execution is about getting a program loaded and started, with its resources ready.' },  // hint shown when program execution is picked wrongly
          { name: 'Access to I/O devices', ex: 'The same print request works for any printer model.',  // service 3, access to I/O devices: one print request works on any printer
            d: 'Every device has its own commands and control signals. The OS hides them behind one uniform interface, so a program simply reads or writes.',  // description: the OS hides each device's own commands behind one interface
            hint: 'Access to I/O devices is about hiding each device\'s own commands behind a uniform read/write interface.' },  // hint shown when access to I/O devices is picked wrongly
          { name: 'Controlled access to files', ex: '“Permission denied” when you open someone else\'s file.',  // service 4, controlled access to files: "Permission denied" on someone else's file
            d: 'The OS understands the storage device and how data is laid out on it, so programs can use file names. On shared systems it also enforces who may read or change each file.',  // description: file names instead of storage layout, plus per-file permissions on shared systems
            hint: 'Controlled access to files is about finding a file\'s data by name and enforcing each file\'s permissions.' },  // hint shown when controlled access to files is picked wrongly
          { name: 'System access', ex: 'Logging in before you see a desktop.',  // service 5, system access: logging in before you see a desktop
            d: 'On a shared or public system, the OS controls who may use the system at all and which system resources each user may reach. It protects them from unauthorized users and settles conflicts over resources.',  // description: who may use the system at all and which resources each user may reach
            hint: 'System access is about letting only authorized users into the system and its shared resources.' },  // hint shown when system access is picked wrongly
          { name: 'Error detection and response', ex: 'One program crashes; the OS ends it and everything else keeps running.',  // service 6, error detection and response: one crash does not bring down everything else
            d: 'Errors happen while the system runs. <b>Hardware errors:</b> a memory error, a device that fails or malfunctions. <b>Software errors:</b> division by zero, an attempt to reach a forbidden memory location, a request the OS cannot grant. The OS responds with the least damage it can: end the offending program, retry the operation, or simply report the error.',  // description: hardware and software errors, and the least-damage responses the OS chooses
            hint: 'Error detection and response is about catching hardware and software errors and limiting the damage.' },  // hint shown when error detection and response is picked wrongly
          { name: 'Accounting', ex: 'A task manager showing each program\'s processor and memory use.',  // service 7, accounting: a task manager showing each program's use of the processor and memory
            d: 'The OS gathers usage statistics for each resource and monitors performance, such as response time. That helps tune the system and plan upgrades. On multiuser systems the records can be used for billing.',  // description: usage statistics and performance monitoring, for tuning, planning and billing
            hint: 'Accounting is about recording resource usage and performance: for tuning, planning and billing.' },  // hint shown when accounting is picked wrongly; closes the accounting entry
        ];  // closes the SV list of services
        const SC = [  // SC: the 11 game scenarios; t is the situation, a the position (0-6) of the correct service in SV, why the explanation
          { t: 'You double-click a game\'s icon. Its code and data are copied into memory, its files are opened, and it starts running.', a: 1,  // scenario: double-clicking a game's icon; answer 1, program execution
            why: 'Getting a program from the disk to a running state means loading it, giving it memory and preparing its files and devices. That is <b>program execution</b>.' },  // explanation: loading, memory and ready files make it program execution
          { t: 'A spreadsheet divides a total by a cell that holds zero. The program is stopped and an error message appears.', a: 5,  // scenario: a spreadsheet divides by zero; answer 5, error detection and response
            why: 'Division by zero is a <b>software error</b>. The processor detects it, the OS takes over, and it responds, here by ending the program and reporting the problem.' },  // explanation: division by zero is a software error the OS responds to
          { t: 'A music app plays sound through whatever headphones are plugged in, using the same simple “play these samples” request for every model.', a: 2,  // scenario: the same "play these samples" request for any headphones; answer 2, access to I/O devices
            why: 'Each audio device has its own commands. The OS hides them behind one uniform interface: <b>access to I/O devices</b>.' },  // explanation: the OS hides each audio device's commands behind one interface
          { t: 'You must type a username and password before the lab computer lets you do anything at all.', a: 4,  // scenario: username and password on a lab computer; answer 4, system access
            why: 'Deciding who may use the system at all is <b>system access</b>. It protects the whole system and its resources from unauthorized users.' },  // explanation: deciding who may use the system at all is system access
          { t: 'An app asks for “settings.txt” by name. The OS works out where that file\'s bytes live on the drive and hands them over.', a: 3,  // scenario: an app asks for settings.txt by name; answer 3, controlled access to files
            why: 'The file service understands how files are laid out on the storage device, so programs use names instead of block numbers: <b>controlled access to files</b>.' },  // explanation: the file service maps names to where the bytes live
          { t: 'A disk sector fails while the OS is reading a file. The OS retries the read a few times, then reports that the data could not be read.', a: 5,  // scenario: a failing disk sector, retried then reported; answer 5, error detection and response
            why: 'A failing device is a <b>hardware error</b>. Retrying, then reporting, is a typical response that keeps the damage small.' },  // explanation: a failing device is a hardware error; retry then report keeps damage small
          { t: 'IT staff notice that the web server kept its processor 90% busy all month, so they order a faster machine.', a: 6,  // scenario: IT orders a faster server after a month of usage figures; answer 6, accounting
            why: 'Collecting usage statistics and performance figures, and using them to plan upgrades, is <b>accounting</b>.' },  // explanation: usage statistics used to plan upgrades are accounting
          { t: 'A student writes code in an editor, compiles it, then steps through it line by line in a debugger that came with the system.', a: 0,  // scenario: edit, compile, then debug with the system's tools; answer 0, program development
            why: 'Editors, compilers and debuggers are <b>program development</b> services, supplied with the OS as utilities.' },  // explanation: editors, compilers and debuggers are program development utilities
          { t: 'A classmate on a shared lab computer tries to open your homework file and gets “permission denied”.', a: 3,  // scenario: a classmate gets "permission denied" on your file; answer 3, controlled access to files
            why: 'Deciding who may read or change each individual file is part of <b>controlled access to files</b>. System access is about getting into the system at all.' },  // explanation: per-file permissions belong to files, not to system access
          { t: 'A program with a bad pointer tries to read memory that belongs to another program. It is stopped with a “segmentation fault”.', a: 5,  // scenario: a bad pointer causes a "segmentation fault"; answer 5, error detection and response
            why: 'An attempt to reach a forbidden memory location is a <b>software error</b>. The hardware catches it and the OS responds by stopping the program.' },  // explanation: reaching forbidden memory is a software error caught by the hardware
          { t: 'A cloud provider charges a company for the exact number of processor-hours its programs used last month.', a: 6,  // scenario: a cloud provider bills by processor-hours; answer 6, accounting
            why: 'On a multiuser system, <b>accounting</b> records can be used for billing.' },  // explanation: accounting records can be used for billing on multiuser systems
        ];  // closes the SC list of scenarios
        const learn = (p) => {  // learn(p) fills tab 1: one card per service in a grid
          const cards = SV.map((v, i) => h('div', { class: 'card tight svc-card' + (i === 5 ? ' svc-wide' : '') },  // builds a card for each service; the sixth card (errors, the longest text) is marked wide
            h('div', { class: 'svc-h' }, h('span', { class: 'svc-n' }, String(i + 1)), h('b', {}, v.name)),  // the card heading: a round number badge and the service name
            h('p', { class: 'small m0', html: v.d }),  // the service's description
            h('p', { class: 'xs muted m0 svc-ex', html: 'e.g. ' + v.ex })));  // the everyday example at the bottom of the card, starting with "e.g."; closes the card and the map
          p.append(h('div', { class: 'svc-grid' }, ...cards));  // puts all seven cards into the grid inside the tab panel
        };  // ends learn()
        const game = (p) => {  // game(p) fills tab 2: the "which service handles this?" game
          let order = SC.map((_, i) => i), k = 0, tried = new Set(), done = false, finished = false;  // order is the sequence of scenarios, k the position in it, tried the wrong picks so far, done/finished the round state
          const res = SC.map(() => null);  // res records each scenario's result: 1 = right first time, 0 = needed another try, null = not answered yet
          const pills = h('div', { class: 'row gap-s svc-pills' });  // the row of progress pills, one per scenario
          const num = h('div', { class: 'xs muted b' });  // the "Scenario 3 of 11" counter
          const text = h('p', { class: 'svc-q m0' });  // the paragraph that shows the scenario text
          const fb = h('div', { class: 'svc-fb', 'aria-live': 'polite' });  // the feedback box; aria-live makes screen readers read out each new verdict
          const nextB = h('button', { class: 'btn sm primary', type: 'button', onclick: () => (finished ? restart() : advance()) }, 'Next scenario →');  // the Next button: moves to the next scenario, or restarts the game once it is finished
          const scoreLine = h('div', { class: 'small muted svc-score' });  // the running score line under the feedback box
          const btns = SV.map((v, i) => h('button', { class: 'svc-btn', type: 'button', onclick: () => answer(i) }, h('span', { class: 'svc-n' }, String(i + 1)), v.name));  // one answer button per service, each showing its number badge and name; clicking calls answer with its position
          function show() {  // show() puts the current scenario on screen and resets the answer buttons
            const s = SC[order[k]];  // s is the scenario at the current position of the (possibly shuffled) order
            tried = new Set(); done = false;  // clears the wrong picks and marks the scenario as not yet solved
            num.textContent = `Scenario ${k + 1} of ${SC.length}`;  // updates the counter text
            text.innerHTML = s.t;  // shows the scenario text
            fb.className = 'svc-fb'; fb.innerHTML = '<span class="muted">Which of the seven services is at work here? Pick one ' + (ctx.narrow ? 'below' : 'on the right') + '.</span>';  // resets the feedback box to its prompt; the prompt says "below" on a phone-width screen and "on the right" otherwise
            btns.forEach((b) => { b.className = 'svc-btn'; b.disabled = false; });  // re-enables every answer button and clears its right/wrong color
            nextB.disabled = true;  // the Next button stays off until the right service is found
            paintPills();  // redraws the pills and the score line
          }  // ends show()
          function paintPills() {  // paintPills() redraws the progress pills and the score line from res
            const firstTry = res.filter((x) => x === 1).length, second = res.filter((x) => x === 0).length;  // counts the scenarios solved on the first try and those that needed another look
            scoreLine.innerHTML = `<b style="color:var(--ok)">${firstTry}</b> right on the first try · <b style="color:var(--warn)">${second}</b> needed another look`;  // writes the score line with the two counts in green and amber
            pills.replaceChildren(...order.map((q, j) => h('span', { class: 'svc-pill' + (res[q] === 1 ? ' ok' : res[q] === 0 ? ' late' : '') + (j === k ? ' cur' : '') })));  // rebuilds the pills in play order, colored by result, with the current one outlined
          }  // ends paintPills()
          function answer(i) {  // answer(i) runs when the student clicks the answer button for service i
            if (done) return;  // ignores clicks once the scenario is already solved
            const s = SC[order[k]];  // s is the current scenario
            if (i === s.a) {  // the correct service was picked
              done = true;  // marks the scenario as solved
              if (res[order[k]] == null) res[order[k]] = tried.size ? 0 : 1;  // records first-try (1) or later (0), but only the first time this scenario is solved
              btns[i].classList.add('right');  // colors the correct button green
              btns.forEach((b) => { b.disabled = true; });  // locks every answer button
              fb.className = 'svc-fb ok';  // turns the feedback box green
              fb.innerHTML = `<div class="b">${tried.size ? 'Got it.' : 'Correct!'}</div><div>${s.why}</div>`;  // shows "Correct!" (or "Got it." after a wrong try) and the explanation
              nextB.disabled = false;  // lets the student move on
              nextB.textContent = k === SC.length - 1 ? 'See your score' : 'Next scenario →';  // on the last scenario the button offers the score instead of another scenario
            } else {  // a wrong service was picked
              tried.add(i);  // remembers the wrong pick, which makes the later right answer count as a second try
              btns[i].classList.add('wrong');  // colors that button red
              btns[i].disabled = true;  // locks that button so it cannot be picked twice
              fb.className = 'svc-fb bad';  // turns the feedback box red
              fb.innerHTML = `<div class="b">Not this one.</div><div>${SV[i].hint} Look again at what the OS is actually doing in the scenario.</div>`;  // shows the wrong service's hint and asks the student to look again
            }  // ends the right/wrong branches
            paintPills();  // redraws the pills and score after every click
          }  // ends answer()
          function advance() {  // advance() runs when Next is clicked
            if (!done) return;  // does nothing until the current scenario is solved
            if (k < SC.length - 1) { k++; show(); return; }  // if more scenarios remain, moves to the next one and stops here
            const first = res.filter((x) => x === 1).length;  // otherwise counts the first-try successes for the final score
            num.textContent = 'Finished';  // the counter now reads "Finished"
            text.innerHTML = `You named the right service on the first try in <b>${first} of ${SC.length}</b> scenarios.`;  // the scenario box shows the final score
            fb.className = 'svc-fb ok';  // the feedback box turns green for the closing message
            fb.innerHTML = first >= 9 ? 'Excellent. You can tell the seven services apart.' : 'Reread the cards in the first tab for the ones you missed, then play again.';  // 9 or more first-try answers earns praise; otherwise the student is sent back to the cards
            btns.forEach((b) => { b.className = 'svc-btn'; b.disabled = true; });  // clears and locks every answer button
            nextB.textContent = 'Play again (new order)'; nextB.disabled = false;  // the Next button becomes "Play again (new order)"
            finished = true;  // marks the game as finished, so the next click restarts it
            paintPills();  // redraws the pills and score
          }  // ends advance()
          function restart() {  // restart() starts a new round
            finished = false; order = ctx.util.shuffle(order); k = 0; res.fill(null);  // clears the finished flag, shuffles the scenario order, goes back to the first and forgets all results
            nextB.textContent = 'Next scenario →';  // restores the Next button's normal label
            show();  // shows the first scenario of the new order
          }  // ends restart()
          p.append(h('div', { class: 'svc-game' },  // fills the tab panel with the game layout: scenario side and answer side
            h('div', { class: 'stack' },  // left side: a vertical stack
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, num, pills),  // top row: the scenario counter on the left, the progress pills on the right
              h('div', { class: 'card white svc-qcard' }, text),  // the white card that holds the scenario text
              fb,  // the feedback box, right under the scenario
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, scoreLine, nextB),  // bottom row: the score line on the left, the Next button on the right
              h('div', { class: 'callout analogy m0', 'data-label': 'Memory hook', html: '<b>Build</b> it (development) · <b>run</b> it (execution) · <b>talk</b> to devices (I/O) · <b>keep</b> data (files) · let the right people <b>in</b> (system access) · <b>survive</b> mistakes (errors) · <b>keep the books</b> (accounting).' })),  // "Memory hook" box: one verb per service (build, run, talk, keep, let in, survive, keep the books); closes the left side
            h('div', { class: 'stack gap-s' }, h('h4', { class: 'm0' }, 'Which service is it?'), ...btns)));  // right side: the heading "Which service is it?" over the seven answer buttons; closes the game layout
          show();  // shows the first scenario as soon as the tab opens
        };  // ends game()
        el.append(ctx.ui.tabs([  // puts two tabs into the step: the service cards and the game
          { label: 'The seven services', render: learn },  // tab 1 uses learn() to fill its panel
          { label: 'Play: which service handles this?', render: game },  // tab 2 uses game() to fill its panel
        ]));  // closes the tab list and the append
      },  // ends render() for step 3
    },  // ends step 3

    /* ---------------- 4. Three key interfaces: ISA, ABI, API ---------------- */
    {  // step 4 begins: the three key interfaces ISA, ABI and API, shown on one diagram
      title: 'Three key interfaces: ISA, ABI and API',  // the title shown at the top of step 4
      kind: 'explore',  // kind "explore" labels this step as an Explore step
      render(el, ctx) {  // render(el, ctx) builds step 4 when the student arrives on it
        const { h, s } = ctx;  // pulls out h (builds HTML elements) and s (builds SVG elements; SVG is the browser's drawing format)
        const IF = {  // IF: the three interfaces, keyed isa, abi and api, with everything the explanation card shows for each
          isa: { name: 'Instruction set architecture (ISA)', term: 'instruction set architecture',  // the ISA entry: full name and the glossary term used for its dotted-word popup
            d: 'Every machine-language instruction the processor understands. It is the <b>boundary between hardware and software</b>: below it is circuitry, above it is code.',  // what the ISA is: every instruction the processor understands, the hardware/software boundary
            made: '<b>User ISA</b> (any program) + <b>system ISA</b> (privileged, OS only)',  // what the ISA is made of: the user ISA plus the privileged system ISA
            gives: 'The most basic compatibility: machine code runs only on processors with the same ISA.',  // what the ISA gives: machine code runs only on processors with the same ISA
            label: 'Machine code', formula: 'ISA  =  user ISA  +  system ISA',  // the example table's column heading and the formula written under the diagram
            lines: [['add r1, r2, r3', 'user ISA: any program may add two registers', 'ok'],  // example lines as [code, meaning, row color]: an add any program may run
              ['load r4, [r5]', 'user ISA: read a word from memory', 'ok'],  // example: a load from memory, also user ISA
              ['disable_interrupts', 'system ISA: turn interrupts off (OS only)', 'bad'],  // example: turning interrupts off, system ISA, so red (OS only)
              ['load_page_table r6', 'system ISA: set up memory mapping (OS only)', 'bad']],  // example: setting up memory mapping, system ISA, also red; closes the ISA examples
            foot: 'Pseudo-assembly for illustration. If an ordinary program tries a system-ISA instruction, the processor refuses and hands control to the OS.',  // note under the ISA examples: the code is made-up assembly, and privileged instructions are refused
            real: 'x86-64 (most PCs) and ARM64 (phones, many laptops) are different ISAs: machine code for one means nothing to the other.' },  // real-world ISA example: x86-64 and ARM64 cannot run each other's machine code; closes the ISA entry
          abi: { name: 'Application binary interface (ABI)', term: 'application binary interface',  // the ABI entry: full name and glossary term
            d: 'The agreement a <b>compiled</b> program relies on: how to ask the OS for services, which registers carry arguments and results, how data is laid out.',  // what the ABI is: the rules a compiled program relies on (calls, registers, data layout)
            made: '<b>System call interface</b> to the OS + the <b>user ISA</b>',  // what the ABI is made of: the system call interface plus the user ISA
            gives: '<b>Binary portability</b>: the same executable runs unchanged on any system with the same ABI.',  // what the ABI gives: binary portability
            label: 'Machine code', formula: 'ABI  =  system call interface  +  user ISA',  // the example table's column heading and the ABI formula
            lines: [['mov r0, #5', 'ABI rule: the system call number goes in r0 (5 = open)', ''],  // example: an ABI rule puts the system call number in register r0
              ['mov r1, name', 'ABI rule: the first argument goes in r1', ''],  // example: an ABI rule puts the first argument in register r1
              ['syscall', 'trap into the OS, which runs in <span class="t">kernel mode</span>', 'cur'],  // example: the syscall instruction traps into the OS, highlighted as the current line
              ['cmp r0, #0', 'ABI rule: the OS leaves its result in r0, so check it', '']],  // example: the OS leaves its result in r0, so the program checks it; closes the ABI examples
            foot: 'Pseudo-assembly; the register and call numbers are illustrative. A binary bakes rules like these into its machine code, so it only runs where the same rules hold.',  // note under the ABI examples: the numbers are made up, and a binary bakes these rules in
            real: 'Downloads are labelled by OS + processor (“Windows x64”, “Linux ARM64”): that pair pins down the ABI. The wrong one will not start.' },  // real-world ABI example: downloads are labeled by OS plus processor; closes the ABI entry
          api: { name: 'Application programming interface (API)', term: 'application programming interface',  // the API entry: full name and glossary term
            d: 'What a programmer writing <b>source code</b> uses: the library routines and OS services the language offers, on top of the ordinary instructions the compiler generates.',  // what the API is: the library routines and OS services source code may use
            made: 'High-level <b>library calls</b> + the <b>user ISA</b>',  // what the API is made of: library calls plus the user ISA
            gives: '<b>Source portability</b>: recompile on any system that offers the same API.',  // what the API gives: source portability after recompiling
            label: 'C source code', formula: 'API  =  library calls  +  user ISA',  // the example table's column heading ("C source code") and the API formula
            lines: [['f = fopen("notes.txt", "r");', 'library call: open a file by name', 'cur'],  // example: fopen, a library call that opens a file by name, highlighted
              ['fgets(line, 80, f);', 'library call: read one line from it', 'cur'],  // example: fgets, a library call that reads one line, highlighted
              ['count = count + 1;', 'plain arithmetic: the compiler turns it into user-ISA instructions', '']],  // example: plain arithmetic that the compiler turns into user-ISA instructions; closes the API examples
            foot: 'fopen and fgets are library routines that make the system calls for you. That is why most programs never make a system call directly.',  // note under the API examples: library routines make the system calls for you
            real: 'Source code written to the POSIX API (the standard UNIX-style calls) builds on Linux, macOS and other UNIX-like systems after a recompile.' },  // real-world API example: POSIX source builds on Linux, macOS and similar systems; closes the API entry
        };  // closes the IF table
        let sel = 'isa';  // sel remembers which interface is chosen; the step starts on the ISA
        const formula = s('text', { x: 320, y: 500, 'text-anchor': 'middle', 'font-size': 19, 'font-weight': 800, style: 'fill:var(--chc)' });  // the formula line at the bottom of the diagram, centered, bold and chapter-colored; its text changes with the choice
        const svg = s('svg', { viewBox: '0 0 640 516', width: '100%', class: 'if-svg', role: 'img', 'aria-label': 'Layers of software above the hardware, with the three interfaces marked' });  // the SVG drawing, 640 by 516 units, scaled to the width of its card, with a description for screen readers
        const box = (x, y, w, hh, cls, label, sub) => s('g', {},  // box(): a helper that draws one labeled rounded rectangle in the diagram, optionally with a subtitle
          s('rect', { x, y, width: w, height: hh, rx: 12, class: cls, 'stroke-width': 2 }),  // the rectangle itself, with rounded corners and a color class
          s('text', { x: x + 16, y: y + (sub ? 26 : hh / 2 + 6), 'font-weight': 800, 'font-size': 17 }, label),  // the bold label, placed higher when there is a subtitle and centered vertically when there is not
          sub ? s('text', { x: x + 16, y: y + 47, 'font-size': 14, class: 's-sub' }, sub) : null);  // the gray subtitle under the label, only when one is given; ends box()
        // highlightable parts
        const part = {};  // part collects the diagram pieces that light up for the chosen interface
        const hot = (key, el) => { el.classList.add('hot'); el.setAttribute('role', 'button'); el.setAttribute('tabindex', '0'); ctx.on(el, 'click', () => pick(key)); ctx.on(el, 'keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(key); } }); return el; };  // hot(): makes a diagram label clickable and keyboard-reachable, calling pick with that label's interface
        part.lib = s('line', { x1: 14, y1: 98, x2: 466, y2: 98, class: 'if-ln' });  // the line where programs meet the libraries: the library-call (API) boundary
        part.sys = s('line', { x1: 14, y1: 202, x2: 466, y2: 202, class: 'if-ln' });  // the line where libraries meet the OS: the system-call (ABI) boundary
        part.isaS = s('line', { x1: 14, y1: 326, x2: 466, y2: 326, class: 'if-ln thick' });  // the hardware/software line under the software stack: the ISA boundary on the left
        part.isaU = s('line', { x1: 482, y1: 326, x2: 628, y2: 326, class: 'if-ln thick' });  // the same ISA line continued under the user-ISA lane on the right
        part.lane = s('rect', { x: 490, y: 14, width: 130, height: 296, rx: 12, class: 'if-lane', 'stroke-width': 2 });  // the user-ISA lane: a tall box on the right standing for ordinary instructions that run directly on the processor
        svg.append(  // adds every piece of the drawing, back to front
          box(20, 14, 440, 62, 's-proc', 'Application programs', 'your code, compiled'),  // box for application programs at the top
          box(20, 120, 440, 62, 's-accent', 'Libraries and utilities', 'fopen, printf, sort, math routines'),  // box for libraries and utilities in the middle
          box(20, 224, 440, 80, 's-os', 'Operating system', 'services, reached by system calls'),  // box for the operating system under them
          part.lane,  // the user-ISA lane to the right of the software boxes
          s('text', { x: 555, y: 42, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 16 }, 'user ISA'),  // the lane's title, "user ISA"
          ...['ordinary', 'instructions', '(add, load,', 'jump…) run', 'directly on', 'the processor'].map((t, i) => s('text', { x: 555, y: 76 + i * 22, 'text-anchor': 'middle', 'font-size': 14, class: 's-sub' }, t)),  // six short lines of text inside the lane saying ordinary instructions run directly on the processor
          s('line', { x1: 462, y1: 45, x2: 486, y2: 45, class: 's-line', 'marker-end': 'url(#arr)' }),  // arrow from the application box into the user-ISA lane
          s('line', { x1: 462, y1: 151, x2: 486, y2: 151, class: 's-line', 'marker-end': 'url(#arr)' }),  // arrow from the library box into the user-ISA lane
          s('line', { x1: 555, y1: 216, x2: 555, y2: 352, class: 's-line', 'marker-end': 'url(#arr)' }),  // arrow from the lane down to the execution hardware
          s('line', { x1: 240, y1: 306, x2: 240, y2: 352, class: 's-line', 'marker-end': 'url(#arr)' }),  // arrow from the OS box down to the execution hardware
          s('text', { x: 252, y: 346, 'font-size': 13.5, 'font-weight': 700, style: 'fill:var(--os)' }, 'user ISA + privileged system ISA'),  // label on that arrow: the OS may use the privileged system ISA as well as the user ISA
          s('rect', { x: 14, y: 356, width: 612, height: 104, rx: 14, class: 's-cpu', 'stroke-width': 2 }),  // the large box for the execution hardware at the bottom
          s('text', { x: 30, y: 382, 'font-weight': 800, 'font-size': 17 }, 'Execution hardware'),  // its title, "Execution hardware"
          ...[['Processor', 's-cpu', 30], ['Main memory', 's-mem', 230], ['I/O devices', 's-io', 430]].map(([t, c, x]) => s('g', {},  // three smaller boxes inside it: processor, main memory and I/O devices, each in its own color
            s('rect', { x, y: 396, width: 180, height: 50, rx: 10, class: c, 'stroke-width': 2 }),  // each small box's rectangle
            s('text', { x: x + 90, y: 427, 'text-anchor': 'middle', 'font-weight': 700, 'font-size': 15 }, t))),  // each small box's centered name; closes the three boxes
          part.lib, part.sys, part.isaS, part.isaU, formula,  // the interface lines and the formula, added last so they sit on top of the boxes
          hot('api', s('g', {}, s('rect', { x: 150, y: 86, width: 150, height: 24, rx: 12, class: 'if-tag' }), s('text', { x: 225, y: 103, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 800 }, 'library calls'))),  // clickable pill "library calls" on the API line; clicking it chooses the API
          hot('abi', s('g', {}, s('rect', { x: 150, y: 190, width: 150, height: 24, rx: 12, class: 'if-tag' }), s('text', { x: 225, y: 207, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 800 }, 'system calls'))),  // clickable pill "system calls" on the ABI line; clicking it chooses the ABI
          hot('isa', s('g', {}, s('rect', { x: 20, y: 314, width: 200, height: 24, rx: 12, class: 'if-tag' }), s('text', { x: 120, y: 331, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 800 }, 'hardware | software'))));  // clickable pill "hardware | software" on the ISA line; clicking it chooses the ISA; closes the drawing
        const USES = { isa: ['isaS', 'isaU'], abi: ['sys', 'lane', 'isaU'], api: ['lib', 'lane', 'isaU'] };  // USES: which diagram pieces light up for each interface (the ABI and API both include the user-ISA lane)
        const card = h('div', { class: 'stack gap-s if-card', 'aria-live': 'polite' });  // the explanation card on the right; announced to screen readers when it changes
        const seg = ctx.ui.seg([{ value: 'isa', label: 'ISA' }, { value: 'abi', label: 'ABI' }, { value: 'api', label: 'API' }], sel, (v) => pick(v));  // three buttons ISA / ABI / API above the card; choosing one calls pick
        function pick(k) {  // pick(k) runs when an interface is chosen (by button or diagram label) and once at the start
          sel = k; seg.set(k);  // remembers the choice and moves the ISA/ABI/API buttons to match
          Object.entries(part).forEach(([n, e]) => e.classList.toggle('on', USES[k].includes(n)));  // lights up exactly the diagram pieces listed for this interface
          const f = IF[k];  // f is the chosen interface's data
          formula.textContent = f.formula;  // writes the formula under the diagram
          const code = h('table', { class: 'tbl compact if-code' },  // builds the example table: code on the left, what it does on the right
            h('thead', {}, h('tr', {}, h('th', {}, f.label), h('th', {}, 'What this line does'))),  // the table's header row
            h('tbody', {}, ...f.lines.map(([c, w, cls]) => h('tr', { class: cls || null }, h('td', { class: 'mono' }, c), h('td', { html: w })))));  // one body row per example line, tinted by its color class, code on the left and meaning (which may hold HTML) on the right
          card.replaceChildren(  // refills the explanation card for the chosen interface
            h('h3', { class: 'm0', html: `<span class="t" data-t="${f.term}">${f.name}</span>` }),  // heading: the interface's full name as a dotted glossary word
            h('p', { class: 'small m0', html: f.d }),  // what the interface is
            h('table', { class: 'tbl compact' }, h('tbody', {},  // a small two-row table
              h('tr', {}, h('td', { class: 'b' }, 'Made of'), h('td', { html: f.made })),  // row "Made of": the interface's parts
              h('tr', {}, h('td', { class: 'b' }, 'Gives you'), h('td', { html: f.gives })))),  // row "Gives you": what the interface guarantees; closes the small table
            code,  // the example table built above
            h('p', { class: 'xs muted m0', html: f.foot }),  // the gray note under the examples
            h('p', { class: 'small m0 if-real', html: '<b>In practice:</b> ' + f.real }));  // the "In practice" line with a real-world example; closes the card content
        }  // ends pick()
        el.append(h('div', { class: 'split if-split fill' },  // puts the step on screen: diagram on the left, explanation on the right
          h('div', { class: 'card white if-wrap' }, svg),  // left: the white card with the drawing
          h('div', { class: 'stack' },  // right: a vertical stack
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, seg, h('span', { class: 'xs muted' }, 'or click a label in the diagram')),  // top row: the ISA/ABI/API buttons, with a hint that the diagram labels work too
            card)));  // the explanation card under them; closes the layout
        pick('isa');  // starts on the ISA so the diagram and card are filled from the start
      },  // ends render() for step 4
    },  // ends step 4

    /* ---------------- 5. Portability explorer: which interface must match? ---------------- */
    {  // step 5 begins: a lab where the student predicts whether a program runs on four other machines
      title: 'Portability lab: will it run on the new machine?',  // the title shown at the top of step 5
      kind: 'lab',  // kind "lab" labels this step as a Hands-on Lab
      render(el, ctx) {  // render(el, ctx) builds step 5 when the student arrives on it
        const { h } = ctx;  // pulls the h element-building helper out of ctx
        const CARRY = [  // CARRY: the three things the student can carry to a new machine, one per table row
          { id: 'bin', name: 'Compiled binary', sub: 'the executable file' },  // row 1: the compiled binary (the executable file)
          { id: 'srcC', name: 'Source code', sub: 'standard C library only' },  // row 2: source code that uses only the standard C library
          { id: 'srcP', name: 'Source code', sub: 'also calls fork(), a UNIX call that copies a running program', tag: 'also calls fork()' },  // row 3: source code that also calls fork(); tag is the shorter label used in headings
        ];  // closes the CARRY list
        const TGT = [  // TGT: the four target machines, one per table column, each a processor family plus an OS
          { cpu: 'x86', os: 'linux' }, { cpu: 'x86', os: 'win' }, { cpu: 'arm', os: 'linux' }, { cpu: 'arm', os: 'win' },  // x86-64 with Linux (the original machine), x86-64 with Windows, ARM64 with Linux, ARM64 with Windows
        ];  // closes the TGT list
        const CPU = { x86: 'x86-64', arm: 'ARM64' }, OS = { linux: 'Linux', win: 'Windows' };  // display names for the processor and OS codes, used in headers, chips and labels
        function judge(c, t) {  // judge(c, t) works out whether item c runs on target t and why; it is the answer key for every cell
          const isa = t.cpu === 'x86', abi = isa && t.os === 'linux';  // same ISA only if the target is x86-64; same ABI only if it is also Linux (the program was built on x86-64 Linux)
          const api = c === 'srcP' ? t.os === 'linux' : true;  // the API matters only for the fork() source: fork() exists on Linux but not on Windows; plain C works everywhere
          const bin = c === 'bin';  // bin is true when the student carries the compiled binary
          const runs = bin ? abi : api;  // a binary needs the same ABI; source code needs the same API
          let why;  // why will hold the explanation for this cell
          if (bin) {  // explanations for the binary row
            if (abi) why = 'Same processor family and same OS. The processor understands every instruction (same ISA) and the system calls follow the same rules (same ABI), so the file runs unchanged. That is <b>binary portability</b>.';  // same ISA and ABI: it runs unchanged (binary portability)
            else if (isa) why = 'The processor understands every instruction (same ISA), but the binary\'s system calls, register conventions and file format follow the Linux ABI. Windows expects different ones, so it will not run as is (unless a compatibility layer imitates the Linux ABI).';  // same ISA but Windows expects a different ABI, so it will not run as is
            else if (t.os === 'linux') why = 'Same OS, but an ARM processor cannot decode x86-64 machine code. The ISA differs, so the ABI (which includes the user ISA) differs too. It will not run as is (an emulator could translate it, at a cost).';  // same OS but an ARM processor cannot decode x86-64 code, so both the ISA and the ABI differ
            else why = 'Both the instruction set and the OS interface differ. Nothing in this binary fits the new machine.';  // different ISA and different OS: nothing fits
          } else if (!api) why = 'Recompiling is not enough: Windows\' own API has no fork(). The code must be rewritten to use the Windows way of creating processes (or built on a compatibility layer). For source code, the <b>API</b> is what has to match.';  // source code whose API is missing (fork() on Windows): recompiling is not enough
          else if (c === 'srcP') why = t.cpu === 'x86' ? 'The origin machine itself: of course it builds and runs.' : 'Linux on ARM offers the same POSIX API, fork() included. A compiler for ARM64 generates brand-new machine code that follows this system\'s ABI, and the source needs no changes: <b>source portability</b>.';  // fork() source on Linux: the origin machine, or Linux on ARM, where a recompile is enough
          else why = (t.cpu === 'x86' && t.os === 'linux') ? 'The origin machine itself: of course it builds and runs.' : 'Recompile with a compiler for the target. It generates new machine code for that ISA and that ABI, and the standard C library (the API) exists on all four systems, so the same source builds and runs: <b>source portability</b>.';  // plain C source: the origin machine, or any other target after a recompile (source portability)
          return { isa, abi, api, bin, runs, why };  // hands back every fact the verdict panel needs
        }  // ends judge()
        const state = {};  // state remembers each cell the student has predicted, keyed by "item|cpu|os"
        let sel = null, right = 0, made = 0;  // sel is the cell being explained; right and made count correct and total predictions
        const cells = {};  // cells maps each cell key to its button
        const score = h('div', { class: 'small b' });  // the "Predictions right" score line
        const detail = h('div', { class: 'card white stack gap-s port-detail', 'aria-live': 'polite' });  // the explanation card under the table; announced to screen readers when it changes
        const head = h('tr', {}, h('th', {}, 'You carry…'), ...TGT.map((t) => h('th', { class: 'center' },  // the table's header row: "You carry…" then one column per target machine
          h('span', { class: 'chip cpu' }, CPU[t.cpu]), h('br'), h('span', { class: 'chip os' }, OS[t.os]))));  // each target header shows a processor chip over an OS chip
        const rows = CARRY.map((c) => h('tr', {}, h('td', {}, h('b', {}, c.name), h('div', { class: 'xs muted' }, c.sub)),  // builds one table row per item the student can carry
          ...TGT.map((t) => {  // each row gets one cell per target machine
            const key = c.id + '|' + t.cpu + '|' + t.os;  // the cell's key combines item, processor and OS, for example "bin|arm|linux"
            const b = h('button', { type: 'button', class: 'port-cell', 'aria-label': `${c.name} (${c.sub}) on ${CPU[t.cpu]} ${OS[t.os]}`, onclick: () => pick(key) }, '?');  // the cell's button shows "?" and has a full spoken label; clicking it opens that cell in the card
            cells[key] = b;  // remembers the button under its key
            return h('td', { class: 'center' }, b);  // wraps the button in a centered table cell
          })));  // closes the cells, the row and the map over CARRY
        function paintCells() {  // paintCells() redraws every cell and the score after each click
          Object.entries(cells).forEach(([k, b]) => {  // goes through every cell button
            const st = state[k];  // st is the student's prediction for this cell, if any
            const [c, cpu, os] = k.split('|');  // splits the key back into item, processor and OS
            const r = judge(c, { cpu, os });  // gets the right answer for this cell
            b.className = 'port-cell' + (st ? (r.runs ? ' ok' : ' bad') : '') + (k === sel ? ' sel' : '');  // predicted cells turn green (runs) or red (does not run); the selected one gets a ring
            b.textContent = st ? (r.runs ? '✓ runs' : '✗ no') : '?';  // predicted cells say "runs" or "no" with a check or cross; the rest keep "?"
          });  // ends the loop over the cells
          score.innerHTML = made ? `Predictions right: <span style="color:var(--ok)">${right}</span> of ${made} · ${12 - made} cells left` : 'Predictions right: 0 of 0 · 12 cells left';  // updates the score line: right answers, predictions made and cells left out of 12
        }  // ends paintCells()
        function check(label, ok, na) {  // check(label, ok, na) builds one ISA/ABI/API result box for the verdict view
          return h('div', { class: 'port-check' + (na ? ' na' : ok ? ' ok' : ' bad') }, h('b', {}, label), h('span', {}, na || (ok ? '✓ matches' : '✗ differs')));  // green "matches", red "differs", or dashed with an explanation when that interface does not matter here
        }  // ends check()
        // only shown for the fork() row, where the term would otherwise be unexplained
        const forkNote = () => h('p', { class: 'xs m0 port-fork', html: '<b>What is fork()?</b> A standard call on UNIX-like systems (Linux, macOS) that makes a copy of a running program (section 3.6 covers it). It is part of <b>POSIX</b>, the API those systems share. Windows has no fork().' });  // forkNote(): the small box explaining fork() and POSIX, shown only for the fork() row
        function pick(key) {  // pick(key) runs when a cell is clicked (and once at the start): it fills the explanation card for that cell
          sel = key;  // remembers the chosen cell
          const [c, cpu, os] = key.split('|');  // splits the key into item, processor and OS
          const C = CARRY.find((x) => x.id === c);  // C is the carried item's data
          const r = judge(c, { cpu, os });  // r is the right answer and its reasons
          const title = h('h3', { class: 'm0', html: `${C.name} <span class="muted small">(${C.tag || C.sub})</span> →${CPU[cpu]} + ${OS[os]}` });  // the card heading: the item, its short label, an arrow and the target machine
          if (!state[key]) {  // not predicted yet: show the question and the two prediction buttons
            const ask = (yes) => { made++; if (yes === r.runs) right++; state[key] = { pred: yes }; pick(key); };  // ask(yes) records the prediction, counts it, scores it, then reopens the cell to show the verdict
            detail.replaceChildren(...[title,  // fills the card with the question view (filter(Boolean) drops the fork note when it is not needed)
              h('p', { class: 'm0', html: r.bin ? 'You copy the <b>executable file</b> across and double-click it. Will it run?' : 'You copy the <b>source code</b> across and <b>recompile</b> it there. Will it build and run?' }),  // the question: run the copied executable, or recompile the copied source?
              h('div', { class: 'row' }, h('button', { class: 'btn ok-b', type: 'button', onclick: () => ask(true) }, 'Predict: it runs'), h('button', { class: 'btn bad-b', type: 'button', onclick: () => ask(false) }, 'Predict: it won\'t')),  // two buttons: "Predict: it runs" and "Predict: it won't"
              h('h4', { class: 'm0 mt' }, 'Questions to ask yourself'),  // heading: "Questions to ask yourself"
              h('div', { class: 'port-checks' },  // three dashed boxes with the questions to think through
                h('div', { class: 'port-check na' }, h('b', {}, 'ISA ?'), h('span', {}, 'Can this processor decode the machine instructions?')),  // ISA question: can this processor decode the instructions?
                h('div', { class: 'port-check na' }, h('b', {}, 'ABI ?'), h('span', {}, 'Does this OS follow the same system-call rules?')),  // ABI question: does this OS follow the same system-call rules?
                h('div', { class: 'port-check na' }, h('b', {}, 'API ?'), h('span', {}, 'Does it offer every library call the source uses?'))),  // API question: does it offer every library call the source uses? closes the boxes
              h('p', { class: 'xs muted m0' }, 'Not every question matters in every case. Part of the skill is knowing which ones do.'),  // note: not every question matters in every case
              c === 'srcP' && forkNote()].filter(Boolean));  // adds the fork note for the fork() row only; closes the question view
          } else {  // already predicted: show the verdict view
            const good = state[key].pred === r.runs;  // good is true when the student's prediction matched the right answer
            const na = 'compiler makes new code';  // for source code the ISA and ABI boxes say the compiler makes new code, because those interfaces cannot block it
            detail.replaceChildren(...[title,  // fills the card with the verdict view
              h('div', { class: 'port-verdict ' + (r.runs ? 'ok' : 'bad') }, (r.runs ? '✓ It runs.' : '✗ It will not run as is.') + (good ? '  You predicted right.' : '  Your prediction missed.')),  // the verdict: runs or not, and whether the student's prediction was right
              h('div', { class: 'port-checks' },  // the three result boxes
                check('ISA', r.isa, r.bin ? null : na),  // ISA result box; for source code it shows the "compiler makes new code" note instead of a match
                check('ABI', r.abi, r.bin ? null : na),  // ABI result box, with the same note for source code
                check('API', r.api, r.bin ? 'not needed: nothing is rebuilt' : null)),  // API result box; for the binary it says nothing is rebuilt, so the API does not matter
              h('p', { class: 'small m0', html: r.why }),  // the explanation of why the program does or does not run
              c === 'srcP' && forkNote()].filter(Boolean));  // adds the fork note for the fork() row only; closes the verdict view
          }  // ends the predicted/not-predicted branches
          paintCells();  // redraws the table so the new prediction and selection show
        }  // ends pick()
        const rules = ctx.ui.reveal('Show the two rules', h('div', { class: 'callout why m0', 'data-label': 'The rules', html: '<b>Binary</b> runs unchanged only if the target has the <b>same ISA and the same ABI</b>.<br><b>Source</b> runs after recompiling if the target offers the <b>same API</b> (and a compiler for its ISA).' }));  // a "Show the two rules" button that reveals the binary rule (same ISA and ABI) and the source rule (same API)
        el.append(h('div', { class: 'split l fill' },  // puts the step on screen: introduction on the left, table and card on the right
          h('div', { class: 'stack' },  // left column
            h('p', { class: 'lead m0', html: 'You built a program on an <span class="chip cpu">x86-64</span> PC running <span class="chip os">Linux</span>. Now you want it on other machines.' }),  // lead paragraph: the program was built on an x86-64 PC running Linux
            h('p', { class: 'small m0', html: 'You can carry the <b>compiled binary</b>, or the <b>source code</b> and recompile it there. Pick any cell, predict, then see which interface decided the answer: the <span class="t">ISA</span>, the <span class="t">ABI</span> or the <span class="t">API</span>.' }),  // instructions: carry the binary or the source, pick a cell, predict, then see which interface decided it
            h('div', { class: 'callout analogy m0', 'data-label': 'Analogy', html: 'A binary is a recipe already converted for one kitchen: its oven, its measuring cups. Source code is the original recipe: any cook can adapt it, as long as their kitchen stocks every ingredient it calls for (the API).' }),  // analogy box: a converted recipe for one kitchen versus the original recipe any cook can adapt
            score, rules),  // the score line and the rules button; closes the left column
          h('div', { class: 'stack' },  // right column
            h('table', { class: 'tbl compact port-tbl' }, h('thead', {}, head), h('tbody', {}, ...rows)),  // the portability table: header row with the four targets, body with the three rows of buttons
            detail)));  // the explanation card under the table; closes the layout
        pick('bin|arm|linux');  // opens with the binary on an ARM64 Linux machine so the card has content from the start
      },  // ends render() for step 5
    },  // ends step 5

    /* ---------------- 6. The OS as resource manager: give the processor away, win it back ---------------- */
    {  // step 6 begins: an animation of the OS giving the processor away and winning it back
      title: 'The OS as resource manager: a manager that must let go',  // the title shown at the top of step 6
      kind: 'explore',  // kind "explore" labels this step as an Explore step
      core: true, // on the shorter core path
      render(el, ctx) {  // render(el, ctx) builds step 6 when the student arrives on it
        const { h, s } = ctx;  // pulls out h (builds HTML elements) and s (builds SVG drawing elements)
        // one frame per moment; every frame is drawn from scratch by draw(i).
        // The script depends on whether the machine has a timer, which the student can toggle.
        let timerOn = true;  // timerOn is true while the "Timer fitted" button is chosen
        function script(on) {  // script(on) returns the 11 animation frames, written for a machine with a timer (on) or without one
          const t = (x) => (on ? x : 'none in this machine');  // t(x) shows the timer text x on a machine with a timer, or "none in this machine" without one
          return [  // the list of frames; each gives who has the processor (cpu), the state of A and B, the timer, the disk, the event and the resources in use
            { cpu: 'OS', A: '', B: '', timer: t('off'), disk: 'idle', ev: '', res: ['mem'],  // frame 1: the kernel runs; the resources on show are memory, where the kernel lives
              cap: 'Meet the resources: the <b>processor</b>, <b>main memory</b>, <b>I/O devices</b> such as the disk, and the <b>files</b> stored there. The <span class="t">kernel</span> (nucleus), the most-used part of the OS, stays in main memory all the time. Right now the processor runs kernel code.' },  // caption 1: meets the four resources and explains that the kernel stays in memory
            { cpu: 'OS', A: 'ready', B: 'ready', timer: t('off'), disk: 'idle', ev: '', res: ['mem'],  // frame 2: programs A and B are ready and waiting
              cap: 'Programs A and B want to run. The OS decides <b>how much memory</b> each gets and <b>where</b>, and sets up the memory-management hardware so each can reach only its own part.' },  // caption 2: the OS decides how much memory each program gets and where
            { cpu: 'A', A: 'running', B: 'ready', timer: t('armed for A'), disk: 'idle', ev: 'dispatch', res: ['cpu'],  // frame 3: A is dispatched and runs; the timer is armed for A
              cap: (on ? 'The OS arms the <b>timer</b>, then <span class="t">dispatches</span> A' : 'There is no timer to arm. The OS <span class="t">dispatches</span> A') + ': it loads A\'s registers, switches the processor to restricted <b>user mode</b> and jumps to A\'s next instruction. From this instant the OS is <b>not running at all</b>.' },  // caption 3: dispatching A (with or without a timer); from here on the OS is not running
            { cpu: 'A', A: 'running', B: 'ready', timer: t('counting down'), disk: 'idle', ev: '', res: ['cpu'],  // frame 4: A keeps running while the timer counts down
              cap: 'A runs its own instructions directly on the processor. The OS is just bytes sitting in memory. It cannot watch A, and it cannot stop A by itself.' },  // caption 4: the OS is just bytes in memory and cannot stop A by itself
            { cpu: 'OS', A: 'in a system call', B: 'ready', timer: t('counting down'), disk: 'idle', ev: 'syscall', res: ['files'],  // frame 5: A makes a system call and the OS runs again
              cap: 'A needs data from the file scores.dat, so it makes a <span class="t">system call</span>. That special instruction switches the processor into <span class="t">kernel mode</span> and into the OS: control is back.' },  // caption 5: the system call switches the processor into kernel mode and back into the OS
            { cpu: 'B', A: 'waiting for disk', B: 'running', timer: t('armed for B'), disk: 'reading', ev: 'cmd', res: ['io', 'cpu'],  // frame 6: the OS starts the disk, A waits, B is dispatched
              cap: 'The OS finds where scores.dat lives, tells the disk to start reading, and marks A as waiting. Rather than leave the processor idle, it ' + (on ? 'arms the timer for B and dispatches B.' : 'dispatches B.') },  // caption 6: rather than leave the processor idle, the OS runs B while the disk works
            { cpu: 'B', A: 'waiting for disk', B: 'running', timer: t('counting down'), disk: 'reading', ev: '', res: ['io'],  // frame 7: B computes while the disk reads
              cap: 'B computes while the disk moves data <b>at the same time</b>. The OS is not running; nothing needs it right now.' },  // caption 7: the processor and the disk work at the same time; the OS is not needed
            { cpu: 'OS', A: 'ready', B: 'interrupted', timer: t('counting down'), disk: 'done', ev: 'diskint', res: ['io'],  // frame 8: the disk interrupt stops B and the OS runs
              cap: 'The disk finishes and raises an <span class="t">interrupt</span>. The processor stops B and jumps into the OS\'s interrupt handler. The OS marks A <b>ready</b>: its data has arrived.' },  // caption 8: the interrupt handler marks A ready because its data has arrived
            { cpu: 'B', A: 'ready', B: 'running', timer: t('counting down'), disk: 'idle', ev: 'dispatch', res: ['cpu'],  // frame 9: the OS returns the processor to B
              cap: on ? 'The OS returns to B so B can use the rest of its turn (its <b>time slice</b>, measured by the timer). Deciding <b>who runs next, and for how long</b>, is how the OS manages processor time.'  // caption 9 with a timer: B uses the rest of its time slice; the OS decides who runs and for how long
                : 'The OS returns to B. Deciding <b>who runs next</b> is how the OS manages processor time, but with no timer it has no way to limit <b>for how long</b>.' },  // caption 9 without a timer: the OS picks who runs but cannot limit for how long
            on ? { cpu: 'OS', A: 'ready', B: 'ready', timer: 'expired!', disk: 'idle', ev: 'timerint', res: ['cpu'],  // frame 10 with a timer: the timer expires and the OS takes the processor back
              cap: 'B\'s time is up. The timer raises an interrupt and the OS is back in control, even though B never asked to stop.' }  // caption 10 with a timer: B never asked to stop, yet the OS is back in control
              : { cpu: 'B', A: 'ready', B: 'running a long loop', timer: t(''), disk: 'idle', ev: '', res: ['cpu'],  // frame 10 without a timer: B enters a long loop and keeps the processor
              cap: 'Now B enters a long loop and makes no system call. A is ready, but with <b>no timer interrupt</b> nothing hands the processor back. The OS cannot step in on its own.' },  // caption 10 without a timer: A is ready but nothing hands the processor back
            on ? { cpu: 'A', A: 'running', B: 'ready', timer: 'armed for A', disk: 'idle', ev: 'dispatch', res: ['cpu'],  // frame 11 with a timer: the OS dispatches A
              cap: 'The OS dispatches A. It gave the processor away 4 times and got it back 3 times, always through <b>a system call or an interrupt</b> (from a device, the timer, or a program error such as dividing by zero). It has no other way back in.' }  // caption 11 with a timer: 4 times out, 3 times back, always through a system call or an interrupt
              : { cpu: 'B', A: 'ready', B: 'running a long loop', timer: t(''), disk: 'idle', ev: '', res: ['cpu'],  // frame 11 without a timer: B still runs its loop
              cap: 'Still B, and it could stay that way forever: A never runs and the OS never runs again. The OS <b>relies on the hardware</b> to win the processor back, which is why real machines have a timer. Switch it back on to compare.' },  // caption 11 without a timer: B could keep the processor forever, which is why real machines have a timer
          ];  // closes the frame list
        }  // ends script()
        let F = script(true);  // F holds the frames currently in use; the step starts with the timer fitted
        const EVN = { dispatch: 'dispatch', syscall: 'system call', cmd: 'disk told to read + dispatch B', diskint: 'interrupt from the disk', timerint: 'timer interrupt', '': '—' };  // EVN: the text shown in the "Event:" box for each event code (a dash when nothing happens)
        // On phones the disk moves to a second row so the drawing is narrower and its text stays readable.
        const N = ctx.narrow;  // N is true on a phone-width screen, where the drawing uses a taller layout
        const D = N ? { x: 10, y: 322, w: 470, h: 96, sx: 186, sy: 382 } : { x: 540, y: 34, w: 210, h: 130, sx: 556, sy: 138 };  // D places the disk box: under the other parts on a phone, to the right of memory otherwise (sx, sy place its status text)
        const svg = s('svg', { viewBox: N ? '0 0 490 424' : '0 0 760 300', width: '100%', class: 'rm-svg', role: 'img', 'aria-label': 'Processor, timer, main memory and disk, with the program the processor is running' });  // the SVG drawing, sized for the chosen layout, with a description for screen readers
        const strip = h('div', { class: 'rm-strip' });  // the history strip that records who had the processor at each moment
        const cellsEl = F.map(() => h('div', { class: 'rm-cell' }));  // one strip cell per frame
        strip.append(...cellsEl);  // puts the cells into the strip
        const RES = [  // RES: the four resources the OS manages, as [key, color, name, what the OS decides]
          ['cpu', 'cpu', 'Processor time', 'who runs next, and for how long'],  // processor time: who runs next, and for how long
          ['mem', 'mem', 'Main memory', 'who gets which part of memory'],  // main memory: who gets which part
          ['io', 'io', 'I/O devices', 'which program uses which device, when'],  // I/O devices: which program uses which device, and when
          ['files', 'io', 'Files', 'where data lives, and who may use it'],  // files: where data lives and who may use it (shown in the I/O color)
        ];  // closes the RES list
        const resEls = RES.map(([k, c, n, d]) => h('div', { class: 'rm-res' }, h('span', { class: 'chip ' + c }, n), h('span', { class: 'xs muted' }, d)));  // one resource row per entry: a colored chip with the name and a gray description
        const evEl = h('div', { class: 'rm-ev' });  // the "Event:" box that names what just happened
        const segY = { free: [66, 50], B: [122, 56], A: [184, 56], OS: [246, 42] };  // segY gives the top position and height of each slice of the memory box: free space, B, A and the OS kernel
        const T = (x, y, t, o = {}) => s('text', Object.assign({ x, y }, o), t);  // T(): a small helper that makes an SVG text element at x, y with optional attributes
        function seg(key, label, state, cls, on) {  // seg() draws one slice of the memory box, with an optional state line; on = the processor is running this slice
          const [y, hh] = segY[key];  // looks up where this slice sits and how tall it is
          return s('g', {},  // returns a group holding the slice's parts
            s('rect', { x: 292, y, width: 176, height: hh, rx: 8, class: cls, 'stroke-width': on ? 3.5 : 2, 'stroke-dasharray': cls === 's-panel' ? '5 4' : null }),  // the slice's rectangle; a thicker border when the processor is running it, dashed when the slice is free space
            T(304, y + (state ? 22 : hh / 2 + 5), label, { 'font-weight': 800, 'font-size': 15 }),  // the slice's name in bold, centered when there is no state line
            state ? T(304, y + 42, state, { 'font-size': 13.5, class: 's-sub' }) : null);  // the state line (for example "waiting for disk") in gray, only when given; closes the group
        }  // ends seg()
        function draw(i) {  // draw(i) redraws the whole picture for frame i, from scratch, every time the animation moves
          const f = F[i];  // f is the frame being drawn
          const own = f.cpu;  // own is who has the processor in this frame: OS, A or B
          const ownCol = own === 'OS' ? 'var(--os)' : 'var(--proc)';  // ownCol: purple when the OS runs, teal when a program runs
          const loaded = !!f.A;  // loaded is true once the programs have been placed in memory (from frame 2 on)
          const mid = { OS: 267, A: 212, B: 150 }[own];  // mid is the height of the memory slice that holds the running code, where the "runs" arrow ends
          svg.replaceChildren(...[  // replaces the whole drawing with the parts listed below (filter(Boolean) drops the parts that are off in this frame)
            // processor
            s('rect', { x: 10, y: 34, width: 210, height: 130, rx: 12, class: 's-cpu', 'stroke-width': 2 }),  // the processor box at the top left
            T(24, 58, 'Processor', { 'font-weight': 800, 'font-size': 17 }),  // its title, "Processor"
            T(24, 86, 'now running:', { 'font-size': 14, class: 's-sub' }),  // the gray label "now running:"
            T(24, 124, own === 'OS' ? 'OS kernel' : 'Program ' + own, { 'font-weight': 800, 'font-size': 27, style: 'fill:' + ownCol }),  // in large type: "OS kernel" in purple or "Program A/B" in teal, whoever has the processor
            T(24, 152, own !== 'OS' ? 'user mode' : f.ev === 'syscall' ? 'kernel mode · via system call' : (f.ev === 'diskint' || f.ev === 'timerint') ? 'kernel mode · via interrupt' : 'kernel mode', { 'font-size': 13.5, class: f.ev === 'syscall' || f.ev === 'diskint' || f.ev === 'timerint' ? null : 's-sub', style: f.ev === 'syscall' || f.ev === 'diskint' || f.ev === 'timerint' ? 'fill:var(--intr);font-weight:700' : null }),  // the mode line: user mode for a program; kernel mode for the OS, in red with "via system call/interrupt" when an event just brought it back
            // timer
            s('rect', { x: 10, y: 186, width: 210, height: 56, rx: 10, class: f.ev === 'timerint' ? 's-intr' : 's-panel', 'stroke-width': 2, 'stroke-dasharray': timerOn ? null : '6 5' }),  // the timer box; it turns red when the timer fires and has a dashed border when the machine has no timer
            T(24, 208, 'Timer', { 'font-weight': 800, 'font-size': 15 }),  // the timer's title
            T(24, 230, f.timer, { 'font-size': 14, class: f.ev === 'timerint' ? null : 's-sub', style: f.ev === 'timerint' ? 'fill:var(--intr);font-weight:800' : null }),  // the timer's status text (armed, counting down, expired, or none), in bold red when it fires
            // memory
            s('rect', { x: 280, y: 34, width: 200, height: 262, rx: 12, class: 's-mem', 'stroke-width': 2 }),  // the tall main-memory box in the middle
            T(380, 56, 'Main memory', { 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 16 }),  // its centered title, "Main memory"
            seg('free', 'free', '', 's-panel', false),  // the free slice at the top of memory
            loaded ? seg('B', 'Program B', f.B, 's-proc', own === 'B') : seg('B', 'free', '', 's-panel', false),  // program B's slice once programs are loaded (showing B's state), free space before that
            loaded ? seg('A', 'Program A', f.A, 's-proc', own === 'A') : seg('A', 'free', '', 's-panel', false),  // program A's slice once programs are loaded (showing A's state), free space before that
            seg('OS', 'OS kernel (resident)', '', 's-os', own === 'OS'),  // the resident OS kernel slice at the bottom, outlined thicker when the OS is running
            // the processor is executing the code of whoever owns it
            s('path', { d: `M 222 100 H 252 V ${mid} H 288`, class: 's-line', style: 'stroke:' + ownCol + ';stroke-width:3', 'marker-end': own === 'OS' ? 'url(#arr-os)' : 'url(#arr-proc)' }),  // the "runs" arrow from the processor to the memory slice whose code it is running, in that owner's color
            T(226, 92, 'runs', { 'font-size': 12.5, class: 's-sub' }),  // the small gray word "runs" on that arrow
            // disk + files
            s('rect', { x: D.x, y: D.y, width: D.w, height: D.h, rx: 12, class: 's-io', 'stroke-width': 2 }),  // the disk box, placed where D says for this layout
            T(D.x + 16, D.y + 24, 'Disk', { 'font-weight': 800, 'font-size': 17 }),  // its title, "Disk"
            T(D.x + 60, D.y + 24, '(an I/O device)', { 'font-size': 13.5, class: 's-sub' }),  // the gray note "(an I/O device)"
            s('rect', { x: D.x + 16, y: D.y + 38, width: 140, height: 32, rx: 7, class: 's-panel', 'stroke-width': f.res.includes('files') ? 3 : 1.5 }),  // the file scores.dat drawn as a small box on the disk, outlined thicker when files are the resource in use
            T(D.x + 86, D.y + 59, 'scores.dat', { 'text-anchor': 'middle', 'font-size': 14, class: 's-monot', 'font-weight': 700 }),  // the file's name in a fixed-width font
            T(D.sx, D.sy, f.disk === 'reading' ? 'reading…' : f.disk === 'done' ? 'done: data ready' : 'idle', { 'font-size': 15, 'font-weight': f.disk === 'idle' ? 400 : 800, style: f.disk === 'idle' ? 'fill:var(--muted)' : 'fill:var(--io)' }),  // the disk's status: "reading…", "done: data ready" or a gray "idle"
            // events
            f.ev === 'diskint' ? s('path', { d: N ? 'M 236 322 V 140 H 226' : 'M 645 34 V 14 H 115 V 30', class: 's-line', style: 'stroke:var(--intr);stroke-width:3', 'marker-end': 'url(#arr-intr)' }) : null,  // on the disk-interrupt frame: a red arrow from the disk to the processor
            f.ev === 'diskint' ? T(N ? 228 : 380, N ? 312 : 29, 'interrupt: disk done', { 'text-anchor': N ? 'end' : 'middle', 'font-size': 13.5, 'font-weight': 800, style: 'fill:var(--intr)' }) : null,  // on the disk-interrupt frame: the red label "interrupt: disk done"
            f.ev === 'timerint' ? s('line', { x1: 150, y1: 186, x2: 150, y2: 168, class: 's-line', style: 'stroke:var(--intr);stroke-width:3', 'marker-end': 'url(#arr-intr)' }) : null,  // on the timer-interrupt frame: a short red arrow from the timer up into the processor
            f.ev === 'cmd' ? s('path', { d: N ? 'M 380 288 V 318' : 'M 470 267 H 645 V 168', class: 's-line', style: 'stroke:var(--io);stroke-width:3', 'marker-end': 'url(#arr-io)' }) : null,  // on the frame where the OS starts the disk: an orange arrow from memory to the disk
            f.ev === 'cmd' ? T(N ? 390 : 560, N ? 313 : 259, 'start reading', { 'text-anchor': N ? 'start' : 'middle', 'font-size': 13.5, 'font-weight': 800, style: 'fill:var(--io)' }) : null,  // on that frame: the orange label "start reading"
          ].filter(Boolean));  // closes the list of parts and the redraw
          cellsEl.forEach((c, j) => {  // updates the history strip under the drawing
            const done = j <= i;  // cells up to and including this frame are filled in
            c.className = 'rm-cell' + (done ? (F[j].cpu === 'OS' ? ' os' : ' proc') : '') + (j === i ? ' now' : '');  // each filled cell is purple (OS) or teal (a program), and the current one gets a ring
            c.textContent = done ? F[j].cpu : '';  // each filled cell shows who had the processor; later cells stay blank
          });  // ends the loop over the strip cells
          resEls.forEach((r, j) => r.classList.toggle('on', f.res.includes(RES[j][0])));  // highlights the resources in use in this frame
          evEl.innerHTML = '<b>Event:</b> ' + EVN[f.ev];  // names this frame's event in the event box
          evEl.classList.toggle('hot-ev', !!f.ev);  // turns the event box red whenever something actually happens
        }  // ends draw()
        const player = ctx.ui.player({ count: F.length, interval: 2600, render: (i) => { draw(i); return F[i].cap; } });  // the animation controls; each frame redraws the picture and returns its caption
        const tSeg = ctx.ui.seg([{ value: 'on', label: 'Timer fitted' }, { value: 'off', label: 'No timer' }], 'on', (v) => {  // two buttons, "Timer fitted" and "No timer", that switch the machine's hardware
          timerOn = v === 'on'; F = script(timerOn); player.refresh();   // same moment, redrawn under the new hardware
          ctx.toast(timerOn ? 'Timer fitted: the OS can take the processor back on a schedule.' : 'No timer: watch the last two moments.');  // shows a short pop-up message at the bottom of the screen explaining what the switch changed
        });  // ends the timer switch's handler
        el.append(h('div', { class: 'stack fill rm-wrap' },  // puts the step on screen: a column that fills the step area
          h('div', { class: 'rm-grid' },  // the two-column grid: drawing card on the left, resource list on the right
            h('div', { class: 'card white rm-main' }, svg,  // the white card holding the drawing
              h('div', { class: 'row rm-what' }, h('span', { class: 'small b' }, 'What if the machine had no timer?'), tSeg),  // under the drawing: the question "What if the machine had no timer?" and the timer switch
              h('div', { class: 'row nw rm-strip-row' }, h('span', { class: 'xs muted b' }, 'Who had the processor'), strip)),  // under that: the label "Who had the processor" and the history strip; closes the card
            h('div', { class: 'stack gap-s' },  // right column: a tighter vertical stack
              h('h4', { class: 'm0' }, 'Resources the OS manages'), ...resEls, evEl,  // heading, the four resource rows and the event box
              h('div', { class: 'callout why m0 small', 'data-label': 'The unusual part', html: 'A thermostat sits outside the furnace it controls. The OS is <b>a program run by the very processor it manages</b>, so it must give the processor away and rely on the hardware to hand it back.' }))),  // "The unusual part" box: a thermostat sits outside its furnace, the OS does not; closes the grid
          player.el));  // the animation controls and caption below everything; closes the layout
      },  // ends render() for step 6
    },  // ends step 6

    /* ---------------- 7. Ease of evolution: tangled vs modular ---------------- */
    {  // step 7 begins: the same change requests applied to a tangled OS and a modular OS, side by side
      title: 'Built to change: why modular design wins',  // the title shown at the top of step 7
      kind: 'compare',  // kind "compare" labels this step as a Compare step
      render(el, ctx) {  // render(el, ctx) builds step 7 when the student arrives on it
        const { h, s } = ctx;  // pulls out h (builds HTML elements) and s (builds SVG drawing elements)
        const MODS = [['sched', 'Scheduler'], ['mem', 'Memory mgr'], ['fs', 'File system'], ['drv', 'Device drivers'], ['ui', 'User interface'], ['acct', 'Accounting']];  // MODS: the six OS parts drawn in both designs, as [id, name]
        const POS = MODS.map((_, i) => ({ x: i % 2 ? 184 : 16, y: 14 + Math.floor(i / 2) * 70 }));  // POS: where each part's box goes: two columns (left for even, right for odd) and three rows 70 units apart
        const CH = [  // CH: the four change requests; tangled and modular list the parts each design must edit, fault the part that breaks
          { id: 'page', cat: 'New hardware', name: 'Paging unit added', tangled: ['mem', 'sched', 'fs', 'drv'], modular: ['mem'], fault: null,  // change 1, new hardware (a paging unit): four parts change in the tangle, one in the modular design
            why: 'Paging hardware hands out memory in small fixed-size blocks called pages, so the memory tables change shape. In the tangle, the scheduler, file system and drivers all read those tables directly, so every one of them breaks. In the modular OS only the memory manager knows the layout; the others call its <b>allocate</b> and <b>free</b> operations, which did not change.' },  // explanation: only the memory manager knows the memory table layout in the modular design
          { id: 'gfx', cat: 'New kind of hardware', name: 'Graphics display replaces text terminal', tangled: ['drv', 'ui', 'fs', 'acct'], modular: ['drv', 'ui'], fault: null,  // change 2, a graphics display replaces the text terminal: four edits tangled, two modular
            why: 'In the tangle, the file system and accounting code wrote text straight to the terminal hardware, so all of them must change. In the modular OS everything prints through the user-interface module, so only it and the display driver change.' },  // explanation: in the modular design everything prints through the user-interface module
          { id: 'quota', cat: 'New service', name: 'Disk quotas per user', tangled: ['fs', 'acct', 'drv'], modular: ['fs', 'acct'], fault: null,  // change 3, a new service (disk quotas): three edits tangled, two modular
            why: 'A quota caps how much disk space each user may fill. A new service must touch the parts it really needs, but no more. In the tangle, disk-space bookkeeping is spread over the file code, the driver and accounting. In the modular OS the file system asks Accounting through one new, documented call.' },  // explanation: in the modular design the file system asks Accounting through one new documented call
          { id: 'fix', cat: 'Fix', name: 'Bug in long file names', tangled: ['fs', 'ui'], modular: ['fs'], fault: 'acct',  // change 4, a bug fix for long file names: two edits tangled plus a new fault in Accounting, one edit modular
            why: 'The fix changes the layout of the file-name table. In the tangle, the user interface read that table directly, so it must be edited too, and accounting code that also read it was missed and now miscounts: <b>the fix introduced a new fault</b>. In the modular OS the table is private to the file system, so nothing outside can notice the change.' },  // explanation: in the tangle the missed accounting code now miscounts; in the modular design the table is private
        ];  // closes the CH list
        const applied = new Set();  // applied remembers which change requests the student has applied so far
        let last = null;  // last is the most recently applied change, whose edits are drawn
        function panel(kind) {  // panel(kind) makes the drawing and counter for one design
          const svg = s('svg', { viewBox: '0 0 320 214', width: '100%', role: 'img', 'aria-label': kind === 'tangled' ? 'Tangled design: every part connected to every other part' : 'Modular design: every part connected only to a shared set of interfaces' });  // the empty SVG drawing for this design, with a screen-reader description of its wiring
          const count = h('div', { class: 'small evo-count' });  // the line under the drawing that counts edits and new faults
          return { kind, svg, count };  // hands back the design's kind, drawing and counter
        }  // ends panel()
        const P = { tangled: panel('tangled'), modular: panel('modular') };  // P holds the two panels, tangled and modular
        const center = (i) => [POS[i].x + 60, POS[i].y + 22];  // center(i) gives the middle point of part i's box, where the wires meet it
        function drawPanel(p) {  // drawPanel(p) redraws one design's drawing and counter
          const cur = last ? CH.find((c) => c.id === last) : null;  // cur is the change applied last, if any
          const edits = cur ? cur[p.kind] : [];  // edits lists the parts this design must edit for that change
          const fault = cur && p.kind === 'tangled' ? cur.fault : null;  // a new fault only ever appears in the tangled design
          const kids = [];  // kids collects the shapes to draw
          if (p.kind === 'tangled') {  // the tangled design: every part is wired to every other part
            for (let i = 0; i < MODS.length; i++) for (let j = i + 1; j < MODS.length; j++) {  // loops over every pair of parts exactly once
              const [x1, y1] = center(i), [x2, y2] = center(j);  // finds the middle points of the two boxes
              kids.push(s('line', { x1, y1, x2, y2, class: 's-muted', 'stroke-width': 1.6 }));  // draws a thin gray wire between them
            }  // ends the pair loop
          } else {  // the modular design: parts connect only to a shared interface bar
            kids.push(s('rect', { x: 150, y: 8, width: 20, height: 198, rx: 8, class: 's-accent', 'stroke-width': 1.5 }));  // the tall interface bar down the middle of the drawing
            MODS.forEach((_, i) => kids.push(s('line', { x1: i % 2 ? 184 : 136, y1: POS[i].y + 22, x2: i % 2 ? 170 : 150, y2: POS[i].y + 22, class: 's-line' })));  // a short wire from each part's box to the interface bar (left-column parts from the left, right-column parts from the right)
          }  // ends the choice between the two wiring styles
          MODS.forEach(([id, name], i) => {  // draws the six part boxes on top of the wires
            const isF = fault === id, isE = edits.includes(id);  // isF: this part is the new fault; isE: this part must be edited for the latest change
            const cls = isF ? 's-bad' : isE ? 's-warn' : 's-panel';  // red for a new fault, amber for a part to edit, plain otherwise
            kids.push(s('g', {},  // adds a group for this part
              s('rect', { x: POS[i].x, y: POS[i].y, width: 120, height: 44, rx: 9, class: cls, 'stroke-width': isF || isE ? 3 : 1.5 }),  // the part's box, with a thicker border when it is marked
              s('text', { x: POS[i].x + 60, y: POS[i].y + (isF || isE ? 19 : 27), 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700 }, name),  // the part's name, moved up when a label must fit under it
              isF || isE ? s('text', { x: POS[i].x + 60, y: POS[i].y + 36, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 800, style: isF ? 'fill:var(--bad)' : 'fill:var(--warn)' }, isF ? 'new fault!' : 'must edit') : null));  // under a marked part's name: "new fault!" in red or "must edit" in amber; closes the group
          });  // ends the loop over the parts
          p.svg.replaceChildren(...kids);  // puts the new drawing into this design's SVG
          let e = 0, f = 0;  // e counts the edits and f the new faults over every change applied so far
          applied.forEach((id) => { const c = CH.find((x) => x.id === id); e += c[p.kind].length; if (p.kind === 'tangled' && c.fault) f++; });  // adds up this design's edits for each applied change, and counts faults for the tangle only
          p.count.innerHTML = `Parts edited so far: <b>${e}</b> · new faults: <b style="color:${f ? 'var(--bad)' : 'var(--ok)'}">${f}</b>`;  // writes the counter line, with the fault count in red when there is one and green when there is none
        }  // ends drawPanel()
        const why = h('div', { class: 'card tight evo-why', 'aria-live': 'polite' });  // the explanation box for the latest change; announced to screen readers when it changes
        const board = h('div', { class: 'evo-board small' });  // the running-total board on the left of the step
        const btns = CH.map((c) => h('button', { type: 'button', class: 'evo-btn', onclick: () => apply(c.id) }, h('span', { class: 'xs muted b' }, c.cat), h('span', {}, c.name)));  // one button per change request, showing its category over its name; clicking applies it
        function apply(id) {  // apply(id) runs when a change-request button is clicked
          applied.add(id); last = id;  // records the change as applied and makes it the one drawn
          paint();  // redraws everything
        }  // ends apply()
        function paint() {  // paint() redraws the buttons, both designs, the explanation and the board
          btns.forEach((b, i) => { b.classList.toggle('on', CH[i].id === last); b.classList.toggle('done', applied.has(CH[i].id)); });  // outlines the latest change's button and marks every applied one as done
          drawPanel(P.tangled); drawPanel(P.modular);  // redraws the tangled and the modular drawing
          const c = CH.find((x) => x.id === last);  // c is the latest change, if any
          if (!c) why.innerHTML = '<span class="muted">Pick a change request above. Amber = a part that must be edited; red = a new fault the change caused.</span>';  // before any change: a gray prompt that also explains the amber and red colors
          else why.innerHTML = c.why;  // after a change: its explanation
          board.innerHTML = applied.size === CH.length  // the board shows the totals once all four changes are applied, and progress before that
            ? '<b>All four changes applied.</b> Tangled: <b>13</b> edits and a new fault. Modular: <b>6</b> edits and none. Fewer parts touched means fewer chances to break something.'  // totals text: 13 edits and a fault for the tangle, 6 edits and none for the modular design
            : `Changes applied: <b>${applied.size} of ${CH.length}</b>. Apply all four to compare the totals. (An illustrative model, not measurements.)`;  // progress text: how many changes are applied, with a reminder that the model is illustrative
          board.classList.toggle('full', applied.size === CH.length);  // the board turns green when all four changes are applied
        }  // ends paint()
        const reset = h('button', { type: 'button', class: 'btn sm ghost', onclick: () => { applied.clear(); last = null; paint(); } }, 'Reset');  // the Reset button clears every applied change and redraws
        el.append(h('div', { class: 'split l fill' },  // puts the step on screen: reasons on the left, the experiment on the right
          h('div', { class: 'stack' },  // left column
            h('p', { class: 'lead m0', html: 'An OS is never finished. It must keep evolving, for three reasons:' }),  // lead paragraph: an OS is never finished and must keep evolving for three reasons
            h('div', { class: 'stack gap-s' },  // a tighter stack for the three reason cards
              h('div', { class: 'evo-r' }, h('b', {}, '1 · Hardware upgrades and new kinds of hardware'), h('span', { class: 'small' }, 'Paging hardware added to a machine (memory handed out in fixed-size pages); graphics displays replacing text-only terminals.')),  // reason 1: hardware upgrades and new kinds of hardware, with examples
              h('div', { class: 'evo-r' }, h('b', {}, '2 · New services'), h('span', { class: 'small' }, 'Users and administrators keep asking the OS to do more.')),  // reason 2: new services that users and administrators ask for
              h('div', { class: 'evo-r' }, h('b', {}, '3 · Fixes'), h('span', { class: 'small' }, 'Every OS has faults. Worse, a fix can itself introduce new faults.'))),  // reason 3: fixes, which can themselves introduce new faults; closes the reason cards
            h('div', { class: 'callout why m0', 'data-label': 'So build it from modules', html: 'Split the OS into <span class="t">modules</span>, each hidden behind a <b>clearly defined interface</b>, and <b>document</b> those interfaces well. Then most changes stay inside one module, and the rest of the system never notices.' }),  // "So build it from modules" box: modules behind clear, documented interfaces keep changes contained
            board),  // the running-total board; closes the left column
          h('div', { class: 'stack gap-s' },  // right column
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'Apply a change request to both designs'), reset),  // a row with the heading "Apply a change request to both designs" and the Reset button
            h('div', { class: 'grid-2 evo-btns' }, ...btns),  // the four change-request buttons in a 2-column grid
            h('div', { class: 'grid-2' },  // the two design panels side by side
              h('div', { class: 'card white tight evo-panel' }, h('div', { class: 'small b' }, 'Tangled: parts reach into each other'), P.tangled.svg, P.tangled.count),  // tangled panel: its title, drawing and counter
              h('div', { class: 'card white tight evo-panel' }, h('div', { class: 'small b' }, 'Modular: parts meet only at interfaces'), P.modular.svg, P.modular.count)),  // modular panel: its title, drawing and counter; closes the pair
            why)));  // the explanation box under the panels; closes the layout
        paint();  // draws the starting state so both designs appear before any change
      },  // ends render() for step 7
    },  // ends step 7

    /* ---------------- 8. Recap ---------------- */
    {  // step 8 begins: a recap with flip cards
      title: 'Recap: six ideas to carry forward',  // the title shown at the top of step 8
      kind: 'recap',  // kind "recap" labels this step as a Recap
      render(el, ctx) {  // render(el, ctx) builds step 8 when the student arrives on it
        const { h } = ctx;  // pulls the h element-building helper out of ctx
        el.append(h('div', { class: 'stack fill' },  // puts a single column on screen that fills the step area
          h('p', { class: 'lead m0' }, 'Say each answer out loud before you flip the card. If you hesitate, revisit that step.'),  // instruction line: say each answer out loud before flipping
          ctx.ui.flipcards([  // ctx.ui.flipcards builds a grid of cards that turn over when clicked, question on the front, answer on the back
            ['What is an operating system?', 'A program that <b>controls the execution of application programs</b> and acts as the <b>interface</b> between those programs and the hardware.'],  // card 1: what an operating system is
            ['Its three objectives?', '<b>Convenience</b> (easy to use), <b>efficiency</b> (hardware used well) and the <b>ability to evolve</b> (new hardware, services and fixes without disruption).'],  // card 2: the three objectives
            ['The seven services?', 'Program development · program execution · access to I/O devices · controlled access to files · system access · error detection and response · accounting.'],  // card 3: the seven services
            ['ISA vs ABI vs API?', '<b>ISA</b>: user + system instructions, the hardware/software boundary. <b>ABI</b>: system call interface + user ISA → binary portability. <b>API</b>: library calls + user ISA → source portability by recompiling.'],  // card 4: ISA versus ABI versus API and what each gives
            ['Why is the OS an odd resource manager?', 'It is a <b>program run by the processor it manages</b>. It gives the processor away and wins it back only through <b>a system call or an interrupt</b> (device, timer, program error). It manages processor time, memory, I/O devices and files.'],  // card 5: why the OS is an unusual resource manager
            ['How do you build an OS that can evolve?', 'From <b>modules</b> with <b>clearly defined interfaces</b> and <b>good documentation</b>, since hardware, services and fixes keep coming, and fixes can add new faults.'],  // card 6: how to build an OS that can evolve
          ].map(([f, b]) => [f, '<div>' + b + '</div>']), { cols: 3, height: 214 }),  // wraps each answer in its own div, and lays the cards out 3 per row, 214 pixels tall
          h('p', { class: 'small muted m0', html: '<b>Next up (2.2):</b> how these same goals, convenience and efficiency above all, drove the history of operating systems from hands-on machines to time sharing.' })));  // "Next up" line pointing to section 2.2 on the history of operating systems; closes the layout
      },  // ends render() for step 8
    },  // ends step 8

    /* ---------------- 9. Check yourself ---------------- */
    {  // step 9 begins: the section quiz
      title: 'Check yourself',  // the title shown at the top of step 9
      kind: 'check',  // kind "check" labels this step as Check Yourself
      quiz: [  // quiz: the questions the guide's quiz engine shows one at a time on this step
        { q: 'Which statement best describes an operating system?',  // question 1 (multiple choice): which statement best describes an operating system
          choices: ['The complete collection of software installed on a computer, including every application program', 'A program that controls the execution of application programs and acts as the interface between them and the hardware', 'The circuitry inside the processor that fetches, decodes and executes each machine instruction', 'A translator that converts programs written in a high-level language into machine code the processor can run'],  // the four choices; the second is the definition, the others describe applications, the processor and a compiler
          answer: 1,  // the right answer is choice 1, counting from 0
          feedback: ['Applications are not part of the OS. They run on top of it and use its services.', null, 'That is the processor, which is hardware. The OS is software that the processor runs.', 'That is a compiler: a utility that comes with the OS, not the OS itself.'],  // feedback for each wrong choice; null marks the right one, which needs none
          why: 'An OS is software with two jobs: it controls how programs run, and it stands between those programs and the hardware, offering services so that programs never have to drive the hardware themselves.' },  // explanation shown after answering: an OS controls programs and stands between them and the hardware
        { type: 'multi', q: 'Which are the three standard objectives of an operating system? Select all that apply.',  // question 2 (select all): the three objectives of an OS
          choices: ['Efficiency', 'Keeping the hardware design secret from programmers', 'Ability to evolve', 'Convenience', 'Running only one program at a time, so programs never compete'],  // five options, two of which are distractors (secrecy, running one program at a time)
          answer: [0, 2, 3],  // the right options: efficiency, ability to evolve and convenience
          why: 'An OS aims to be convenient to use, to use the hardware efficiently, and to be able to evolve. It hides hardware details to make programming convenient, not to keep them secret, and running one program at a time would leave the processor idle during every wait, the opposite of efficiency.' },  // explanation: why the two distractors are wrong
        { type: 'num', q: 'A program works in a repeating pattern: it computes for 2 ms, then waits 8 ms for the disk to deliver its next block of data. If the OS runs no other program, what percentage of the time does the processor sit idle?',  // question 3 (calculate): the idle percentage for 2 ms of computing followed by 8 ms of waiting
          answer: 80, tol: 0.5, unit: '%', hint: 'Idle fraction = waiting time ÷ length of one whole cycle.',  // the answer is 80, accepted within half a point, in percent, with a hint about the formula
          why: 'One cycle lasts 2 + 8 = 10 ms, and the processor has nothing to do for 8 of them: 8 ÷ 10 = 80% idle. Handing the processor to another program during those waits is how an OS meets its efficiency objective.' },  // explanation: 8 of every 10 ms are idle, and filling those waits is the efficiency objective
        { type: 'match', q: 'Match each everyday event to the OS service at work.',  // question 4 (match pairs): everyday events to the OS service at work
          pairs: [  // the pairs to match, each [event, service]
            ['You type a password before you reach the desktop', 'System access'],  // pair: typing a password matches system access
            ['A program divides by zero and is stopped with an error message', 'Error detection and response'],  // pair: division by zero matches error detection and response
            ['The same print request works on any printer model', 'Access to I/O devices'],  // pair: one print request for any printer matches access to I/O devices
            ['A monthly report shows how much processor time each user consumed', 'Accounting'],  // pair: a monthly processor-time report matches accounting
            ['Double-clicking an icon loads a program into memory and starts it', 'Program execution'],  // pair: double-clicking an icon matches program execution
          ],  // closes the pairs
          why: 'Logging in controls who may use the system; a division by zero is a software error the OS must handle; a uniform interface hides device details; usage records are accounting; loading and starting a program is program execution.' },  // explanation: why each event belongs to its service
        { type: 'bucket', q: 'Sort each error the OS must detect and respond to into the right kind.', buckets: ['Hardware error', 'Software error'],  // question 5 (sort into groups): errors the OS handles, into hardware errors and software errors
          items: [['A memory chip returns a corrupted value', 0], ['A disk sector can no longer be read', 0], ['A device stops responding', 0], ['A program divides by zero', 1], ['A program tries to read a forbidden memory location', 1], ['A program requests something the OS cannot grant', 1]],  // the six items, each [text, group]: three failing-hardware cases (0) and three program mistakes (1)
          why: 'Hardware errors come from memory or devices that fail or malfunction. Software errors come from what a program tries to do. In both cases the OS responds with the least damage it can: ending the program, retrying the operation, or reporting the error.' },  // explanation: where each kind of error comes from and how the OS limits the damage
        { q: 'Which interface marks the boundary between hardware and software?',  // question 6 (multiple choice): which interface is the hardware/software boundary
          choices: ['The application binary interface (ABI)', 'The application programming interface (API)', 'The system call interface', 'The instruction set architecture (ISA)'],  // the choices: ABI, API, the system call interface and the ISA
          answer: 3,  // the right answer is the ISA (choice 3)
          feedback: ['The ABI sits above that boundary: it combines the system call interface with the user part of the ISA.', 'The API works at the source-code level: library calls plus the user ISA.', 'System calls connect programs to the OS. Both sides of that line are software.', null],  // feedback for the wrong choices: the ABI and API sit above the boundary; system calls join two pieces of software
          why: 'The ISA is the set of machine instructions the processor carries out. Below it is circuitry, above it is software. Its user part is open to every program; its system part is reserved for the OS.' },  // explanation: the ISA has circuitry below it and software above it
        { q: 'A game was compiled for an x86-64 PC running Linux. On which machine will the <b>same executable file</b> run without any changes?',  // question 7 (multiple choice): where the same x86-64 Linux executable runs unchanged
          choices: ['An x86-64 PC running Windows', 'An ARM64 laptop running Linux', 'Another x86-64 PC running Linux', 'Any machine at all, as long as the game\'s source code used only a standard API'],  // the choices: x86-64 Windows, ARM64 Linux, another x86-64 Linux PC, or anywhere with a standard API
          answer: 2,  // the right answer is another x86-64 PC running Linux (choice 2)
          feedback: ['Same ISA, but a different ABI: Windows has its own system call interface and conventions.', 'Same OS family, but an ARM processor cannot decode x86-64 instructions. The ISA differs, and so does the ABI.', null, 'A standard API helps only when you recompile the source. The question is about the unchanged executable.'],  // feedback: Windows changes the ABI, ARM changes the ISA, and an API only helps when recompiling
          why: 'A binary runs unchanged only where the ABI matches, which means the same system call interface and the same user ISA.' },  // explanation: a binary needs the same ABI, meaning the same system calls and the same user ISA
        { type: 'tf', q: 'Source code written only to a standard API can be moved to another system that offers the same API by recompiling it, even if the new system has a different processor (ISA).', answer: true,  // question 8 (true or false): source written to a standard API moves by recompiling, even to another ISA; true
          why: 'The compiler for the new system produces fresh machine code for its ISA that follows its ABI. For source code, the interface that must match is the API.' },  // explanation: the new compiler produces fresh machine code, so only the API has to match
        { q: 'Why is the operating system an unusual kind of control mechanism?',  // question 9 (multiple choice): why the OS is an unusual control mechanism
          choices: ['It is a program run by the same processor it manages, so it must give the processor away and depend on the hardware to get it back', 'It runs on a separate processor of its own that watches the main processor and every program continuously', 'It is permanently wired into the hardware circuits, so it can never be changed or updated after it ships', 'It never gives up control of the processor, so user programs can only run inside the OS itself'],  // the choices: runs on the processor it manages, has its own processor, is wired into hardware, or never lets go
          answer: 0,  // the right answer is the first choice
          feedback: [null, 'In an ordinary computer the OS runs on the same processor as the programs it manages. Nothing watches continuously.', 'The OS is software. It can be updated, and it constantly is.', 'If it never let go, user programs could not run directly on the processor, and they do.'],  // feedback for the three wrong choices
          why: 'A thermostat sits outside the furnace it controls; the OS does not. While a user program runs, the OS is not running at all. It regains control only when the hardware hands it back: a system call, or an interrupt from a device, the timer or a program error.' },  // explanation: the thermostat comparison, and the only ways control comes back to the OS
        { type: 'multi', q: 'Which statements about the OS as a resource manager are true? Select all that apply.',  // question 10 (select all): true statements about the OS as a resource manager
          choices: ['It runs on a separate processor of its own, so it can watch user programs continuously', 'It decides how processor time, main memory, I/O devices and files are shared among programs', 'The whole OS, including every utility, stays in main memory at all times', 'Its kernel (nucleus), which holds the most frequently used functions, stays in main memory', 'It decides which machine instructions the processor is able to understand'],  // five statements, including two traps: the whole OS staying in memory and the OS choosing the instruction set
          answer: [1, 3],  // the right statements: it shares out the resources, and its kernel stays in memory
          why: 'The OS allocates processor time, memory, devices and files. Only the kernel (nucleus) stays resident; other parts of the OS and the utilities are loaded when needed. The OS runs on the same processor it manages, and the instruction set is fixed by the hardware: the OS can only use it.' },  // explanation: only the kernel stays resident, and the instruction set is fixed by the hardware
        { type: 'order', q: 'Put these moments in order for an OS running a program that reads a file.',  // question 11 (put in order): the moments of an OS running a program that reads a file
          items: ['The OS gives the program memory and arms the timer', 'The OS dispatches the program', 'The program makes a system call to read a file', 'The OS starts the disk and runs another program meanwhile', 'The disk\'s interrupt hands control back to the OS'],  // the five moments, listed here in the correct order; the quiz shuffles them for the student
          why: 'The OS sets things up and hands over the processor, gets it back through the system call, keeps the processor busy while the disk works, and regains control when the disk interrupts.' },  // explanation: setup, dispatch, system call, disk plus another program, disk interrupt
        { q: 'Engineers must add support for a new kind of graphics display. Which OS design makes that change easiest and least risky?',  // question 12 (multiple choice): which OS design makes adding a new graphics display easiest
          choices: ['One where every part reads and changes every other part\'s data directly, for speed', 'One kept small and simple by skipping documentation of its internal interfaces', 'One built from modules with clearly defined, documented interfaces', 'One that is frozen and never updated after it ships, so nothing can break'],  // the choices: everything shares data directly, no documentation, documented modules, or never updated
          answer: 2,  // the right answer is the modular design with documented interfaces (choice 2)
          feedback: ['Then the change ripples into every part that touched the display, and each edit risks a new fault.', 'Without documentation nobody knows which parts depend on what, so every change is a gamble.', null, 'A frozen OS cannot use new hardware at all. The ability to evolve is one of its three objectives.'],  // feedback for the three wrong designs
          why: 'Hardware upgrades, new services and fixes keep arriving, and fixes can bring new faults. Modules behind clear, documented interfaces keep each change inside the part it concerns.' },  // explanation: modules behind documented interfaces keep each change inside one part
      ],  // closes the quiz list
    },  // ends step 9
  ],  // closes the list of steps

  notes: `${/* notes: a summary of the whole section as HTML, shown in the Notes panel and in the printable version */''}
    <h3>What an operating system is for</h3>${/* heading of the first notes part: what an OS is for */''}
    <p>An <b>operating system (OS)</b> is a program that <b>controls the execution of application programs</b> and acts as the <b>interface</b> between those programs and the computer hardware. It pursues three objectives:</p>${/* notes paragraph: the definition of an OS and the lead-in to its three objectives */''}
    <ul>${/* starts the list of objectives */''}
      <li><b>Convenience</b>: make the computer easy to use (files and windows instead of disk blocks and device commands).</li>${/* list item: convenience, with files and windows as examples */''}
      <li><b>Efficiency</b>: use the hardware well. Example: a program that computes for 2 ms, then waits 8 ms for the disk, leaves a processor that runs only it idle 8 ÷ 10 = <b>80%</b> of the time. The OS fills those waits by running another program.</li>${/* list item: efficiency, with the 80% idle calculation */''}
      <li><b>Ability to evolve</b>: let new hardware, new services and fixes be added without getting in the way of existing services.</li>${/* list item: ability to evolve */''}
    </ul>${/* ends the list of objectives */''}
    <p>The goals can conflict: a rich graphical interface (convenience) costs processor time and memory (efficiency).</p>${/* notes paragraph: the objectives can conflict */''}

    <h3>The OS as a user/computer interface</h3>${/* heading: the OS as a user/computer interface */''}
    <p>Layers, top to bottom: <b>end user → application programs → utilities (and libraries) → operating system → computer hardware</b>. Each layer uses the one below through an agreed interface and hides it from the layers above.</p>${/* notes paragraph: the five layers from end user down to hardware */''}
    <ul>${/* starts the list of viewpoints */''}
      <li><b>End user</b>: sees only applications and never needs to know how the hardware works.</li>${/* list item: what the end user sees */''}
      <li><b>Application programmer</b>: writes applications using the utilities (editors, compilers, debuggers, libraries) and the OS's services.</li>${/* list item: what the application programmer uses */''}
      <li><b>OS designer</b>: must master the hardware below and design services for the programs above.</li>${/* list item: what the OS designer must master */''}
    </ul>${/* ends the list of viewpoints */''}
    <p><b>Utilities</b> are system programs shipped with the OS. They are not the kernel: they ask the OS for services like any application. A <b>library</b> holds ready-made routines (such as <code>fopen</code> or <code>fwrite</code>) that often make system calls for the program.</p>${/* notes paragraph: utilities are not the kernel, and libraries often make system calls */''}
    <p><b>Saving a document:</b> Ctrl+S → application → library call → <b>system call</b> (the processor enters kernel mode, inside the OS) → the OS's <b>device driver</b> sends the drive its commands → the drive raises an <b>interrupt</b> when done → the result travels back up.</p>${/* notes paragraph: the path of a Ctrl+S save through every layer and back */''}

    <h4>The seven services an OS provides</h4>${/* heading: the seven services */''}
    <ol>${/* starts the numbered list of services */''}
      <li><b>Program development</b>: editors, compilers and debuggers. They come with the OS but are, strictly, utilities.</li>${/* list item: program development */''}
      <li><b>Program execution</b>: loading instructions and data into memory, preparing files and I/O devices, then starting the program.</li>${/* list item: program execution */''}
      <li><b>Access to I/O devices</b>: each device has its own commands and control signals; the OS offers one uniform interface (read, write).</li>${/* list item: access to I/O devices */''}
      <li><b>Controlled access to files</b>: the OS understands the storage device and how data is laid out on it, so programs use file names; on shared systems it enforces who may read or change each file.</li>${/* list item: controlled access to files */''}
      <li><b>System access</b>: on shared systems, controlling who may use the system at all and which resources each user may reach, and resolving conflicts over resources.</li>${/* list item: system access */''}
      <li><b>Error detection and response</b>: <i>hardware errors</i> (a memory error, a device that fails or malfunctions) and <i>software errors</i> (division by zero, an attempt to reach a forbidden memory location, a request the OS cannot grant). The OS responds with the least damage it can: end the program, retry the operation, or simply report the error.</li>${/* list item: error detection and response, with hardware and software examples */''}
      <li><b>Accounting</b>: usage statistics for each resource and performance monitoring (such as response time), for tuning, planning upgrades and, on multiuser systems, billing.</li>${/* list item: accounting */''}
    </ol>${/* ends the list of services */''}
    <h3>Three key interfaces</h3>${/* heading: the three key interfaces */''}
    <table>${/* starts the interfaces table */''}
      <tr><th>Interface</th><th>Made of</th><th>What it gives you</th></tr>${/* table header: interface, what it is made of, what it gives you */''}
      <tr><td><b>ISA</b> (instruction set architecture)</td><td>The <b>user ISA</b> (arithmetic, loads, jumps; any program) plus the <b>system ISA</b> (privileged: interrupts, memory management, I/O; OS only)</td><td>The boundary between hardware and software. Machine code runs only on processors with the same ISA.</td></tr>${/* table row: the ISA */''}
      <tr><td><b>ABI</b> (application binary interface)</td><td>The <b>system call interface</b> to the OS plus the <b>user ISA</b> (and conventions such as which registers carry arguments)</td><td><b>Binary portability</b>: the same executable runs unchanged on any system with the same ABI.</td></tr>${/* table row: the ABI */''}
      <tr><td><b>API</b> (application programming interface)</td><td>High-level-language <b>library calls</b> plus the <b>user ISA</b></td><td><b>Source portability</b>: recompile the source on any system that offers the same API.</td></tr>${/* table row: the API */''}
    </table>${/* ends the interfaces table */''}
    <p>Most programs reach system calls through library routines. If an ordinary program tries a system-ISA instruction, the processor refuses and hands control to the OS.</p>${/* notes paragraph: most system calls go through library routines; privileged instructions are refused */''}
    <h4>Portability rules, with a worked example</h4>${/* heading: the portability rules and a worked example */''}
    <ul>${/* starts the list of rules */''}
      <li>A <b>binary</b> runs unchanged only if the target has the <b>same ISA and the same ABI</b>.</li>${/* list item: the binary rule (same ISA and same ABI) */''}
      <li><b>Source code</b> runs after recompiling if the target offers the <b>same API</b> (the target's compiler makes new code for its ISA and ABI).</li>${/* list item: the source rule (same API) */''}
    </ul>${/* ends the list of rules */''}
    <table>${/* starts the worked-example table */''}
      <tr><th>Built on x86-64 + Linux, moved to…</th><th>x86-64 Linux</th><th>x86-64 Windows</th><th>ARM64 Linux</th><th>ARM64 Windows</th></tr>${/* table header: the four target machines */''}
      <tr><td>Compiled binary</td><td>runs</td><td>no: ABI differs</td><td>no: ISA differs</td><td>no: both differ</td></tr>${/* table row: the compiled binary */''}
      <tr><td>Source, standard C library only</td><td>runs</td><td>runs after recompiling</td><td>runs after recompiling</td><td>runs after recompiling</td></tr>${/* table row: source using only the standard C library */''}
      <tr><td>Source that also calls <code>fork()</code></td><td>runs</td><td>no: API lacks fork()</td><td>runs after recompiling</td><td>no: API lacks fork()</td></tr>${/* table row: source that also calls fork() */''}
    </table>${/* ends the worked-example table */''}
    <p><code>fork()</code> is a standard call on UNIX-like systems (Linux, macOS) that makes a copy of the running program as a new process; section 3.6 covers it in full. It is part of <b>POSIX</b>, the API those systems share. Windows has no fork().</p>${/* notes paragraph: what fork() is and why Windows lacks it */''}

    <h3>The OS as resource manager</h3>${/* heading: the OS as resource manager */''}
    <p>The OS manages <b>processor time</b> (who runs next, and for how long), <b>main memory</b> (who gets which part, together with memory-management hardware), <b>I/O devices</b> (when a program may use one) and <b>files</b> (where data lives, who may use it).</p>${/* notes paragraph: the four resources and what the OS decides for each */''}
    <p>It is an <b>unusual controller</b>. It is ordinary software executed by the very processor it manages, and it must <b>give up</b> the processor so programs can run. While a user program runs, the OS is not running at all; it relies on the hardware to get control back, through a <b>system call</b> or an <b>interrupt</b> (from a device, the <b>timer</b>, or a program error such as dividing by zero). Without a timer, a program stuck in a loop that makes no system call would keep the processor forever.</p>${/* notes paragraph: why the OS is an unusual controller, and the role of the timer */''}
    <p>The <b>kernel</b> (or <b>nucleus</b>) is the part of the OS that stays in main memory all the time and holds its most frequently used functions; other parts are loaded when needed.</p>${/* notes paragraph: the kernel (nucleus) stays in memory */''}
    <p><b>Trace:</b> the OS gives A and B memory, arms the timer, <b>dispatches</b> A → A's system call to read a file (OS back) → the OS starts the disk, dispatches B → disk interrupt (OS back; A ready) → B resumes → timer interrupt (OS back) → the OS dispatches A.</p>${/* notes paragraph: a one-line trace of the resource manager animation */''}

    <h3>Ease of evolution</h3>${/* heading: ease of evolution */''}
    <p>An OS keeps changing because of <b>hardware upgrades and new types of hardware</b> (paging hardware, which hands out memory in fixed-size pages; graphics displays replacing text terminals), <b>new services</b> requested by users, and <b>fixes</b>: every OS has faults, and a fix can itself introduce new faults.</p>${/* notes paragraph: the three reasons an OS keeps changing */''}
    <p>So an OS should be built from <b>modules</b> with <b>clearly defined interfaces</b> and <b>good documentation</b>, so a change stays inside the module it concerns. In a tangled design, where parts reach into each other's data, a change ripples into many parts, and every extra edit is another chance to add a fault (in this section's illustrative model: 13 edits and a new fault, versus 6 edits and none).</p>`,  // notes paragraph: why modules win, with the model's totals; end of the notes text
});  // closes the section object and the call that registers it
