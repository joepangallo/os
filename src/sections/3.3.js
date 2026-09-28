// Comment key: a line inside backtick text ends with ${/* comment */''}, an empty-string slot that holds a comment without changing the text on screen (full note at the top of the page).
/* =====================================================================
   Section 3.3 — Process Description
   How the OS records everything it manages: the four families of
   control tables (memory, I/O, file, process), the process image,
   the three groups of attributes in a process control block, the
   program status word (x86 EFLAGS), and why the PCB is the most
   important structure in the OS (queues + protection).
   Helpers live in the IIFE so nothing leaks into the global scope.
   ===================================================================== */
(() => {  // wraps the whole section in an arrow function that runs once, right away, so its names stay private to this file
  Guide.section({  // registers section 3.3 with the guide; the object below describes everything the section shows
    id: '3.3',  // id: the section number the guide uses in links, menus and saved progress
    title: 'Process Description',  // title: the full name shown at the top of the section
    short: 'Process description',  // short: the shorter name used in the contents list and other tight spaces
    summary: 'The tables the OS keeps, the parts of a process image, and everything a PCB records about a process.',  // summary: one-sentence description of the section shown in the contents
    objectives: [  // objectives: the list of learning goals shown when the section opens
      'Describe the four kinds of tables the OS keeps (memory, I/O, file and process) and explain why they must point at one another.',  // goal 1: the four kinds of OS tables and why they refer to one another
      'Name the four parts of a process image and explain how paging lets some of it sit on disk.',  // goal 2: the four parts of a process image, and paging
      'Sort PCB contents into process identification, processor state information and process control information.',  // goal 3: sorting PCB (process control block) contents into three groups
      'Explain how condition codes in the program status word (x86 EFLAGS) are set, and why they are saved with the process.',  // goal 4: condition codes in the program status word and why they are saved
      'Explain why the PCB is the most important OS data structure, how PCBs form queues, and how the OS protects them.',  // goal 5: why the PCB matters most, PCB queues, and how the OS protects PCBs
    ],  // closes the objectives list
    terms: [  // terms: glossary entries as [term, definition] pairs; they fill the glossary and the dotted-underline pop-ups
      ['Memory table', 'An OS table that records which parts of main memory and of secondary memory (disk) are allocated to each process, the protection settings of each region (including shared ones), and whatever is needed to manage virtual memory.'],  // glossary entry: defines a memory table (which memory each process has, and its protection)
      ['I/O table', 'An OS table that records every I/O device and channel (a small processor dedicated to running I/O transfers): whether it is free or assigned (and to whom), the status of any operation in progress, and the main-memory address used as the source or destination of the transfer.'],  // glossary entry: defines an I/O table, and what a channel is
      ['File table', 'An OS table that records which files exist, where each one is stored on secondary memory, its current status (for example open for writing) and its attributes. Often kept by a separate file management system.'],  // glossary entry: defines a file table (which files exist, where, and their status)
      ['Process table', 'The OS table with one entry per process. Each entry holds a pointer that leads to that process’s image, and so to its process control block.'],  // glossary entry: defines the process table (one entry per process, leading to its image)
      ['Process image', 'The complete set of things that make up one process: its user program, its user data, its stack(s) and its process control block.'],  // glossary entry: defines a process image as program, data, stack(s) and PCB
      ['Process control block (PCB)', 'The record the OS creates and maintains for each process, holding the attributes it needs to control it. Its elements (identifier, state, priority, program counter and the rest) fall into three groups: process identification, processor state information and process control information.'],  // glossary entry: defines the process control block and names its three groups
      ['User data', 'The part of a process image the program itself may change: its variables and working data, a user stack area, and any code that modifies itself.'],  // glossary entry: defines user data, the part of the image the program may change
      ['Frame (page frame)', 'A fixed-size slot of main memory (4 KB in this section\'s examples, so frame 4 covers addresses 0x4000–0x4FFF). With paging, a process is cut into pieces of the same size, called pages, and each page can be placed in any free frame.'],  // glossary entry: defines a page frame, a fixed 4 KB slot of main memory in this section
      ['System stack', 'A last-in, first-out area in the process image that remembers calls in progress: the parameters and return addresses of procedure calls and system calls. (Section 3.5 also meets the separate system stack that a nonprocess kernel keeps for itself, outside every process image.)'],  // glossary entry: defines the system stack that remembers calls in progress
      ['Process identification', 'The identifier part of the PCB: the ID of this process, the ID of the parent that created it, and the ID of the user it runs for.'],  // glossary entry: defines process identification (process, parent and user IDs)
      ['Processor state information', 'The part of the PCB that holds a copy of the processor registers for the process: user-visible registers, control and status registers, and stack pointers. It is saved when the process is interrupted and loaded back into the processor when it resumes.'],  // glossary entry: defines processor state information (the saved copy of the registers)
      ['Process control information', 'The part of the PCB the OS uses to manage and coordinate the process: scheduling and state details, links to other PCBs, interprocess communication, privileges, memory-management pointers and resource use.'],  // glossary entry: defines process control information (what the OS uses to manage the process)
      ['User-visible register', 'A processor register that a program’s own machine instructions can name and use, such as a general-purpose data register.'],  // glossary entry: defines a user-visible register
      ['Control and status registers', 'Processor registers that steer execution and report on it, such as the program counter, the condition codes and the status bits (interrupts on or off, user or kernel mode).'],  // glossary entry: defines control and status registers (program counter, condition codes, status bits)
      ['Condition codes', 'Bits the processor sets after an arithmetic or logic instruction to describe the result (sign, zero, carry, equal, overflow). Later instructions test them to decide whether to jump.'],  // glossary entry: defines condition codes, the result bits later jumps test
      ['EFLAGS', 'The 32-bit flags register of x86 processors, their version of the program status word. It holds the condition codes (carry, zero, sign, overflow and more) and control bits such as interrupt enable.'],  // glossary entry: defines EFLAGS, the x86 version of the program status word
      ['Interprocess communication (IPC)', 'The ways separate processes exchange information, such as signals, messages and shared flags. The PCB records what is pending for each process.'],  // glossary entry: defines interprocess communication (IPC)
      ['Process privileges', 'PCB entries that say what a process is allowed to do: which memory it may touch, which kinds of instructions it may execute and which system services it may use.'],  // glossary entry: defines process privileges (what memory, instructions and services a process may use)
      ['Program status word (PSW)', 'A processor register (or set of registers) holding status about the running program: its condition codes, whether interrupts are enabled, and whether the processor is in user or kernel mode.'],  // glossary entry: defines the program status word (PSW)
      ['Linked list', 'A chain of records in which each record holds a pointer to the next one. The OS builds its process queues by linking PCBs together this way.'],  // glossary entry: defines a linked list, the chain the OS uses for its process queues
    ],  // closes the terms list
    css: ` /* css: style rules for this section only; every selector starts with .sec-3-3 so it cannot affect other sections */
      .sec-3-3 .hot { cursor: pointer; } /* any clickable part of a drawing (class hot) shows a hand pointer so students know they can click it */
      .sec-3-3 .hot:hover rect, .sec-3-3 .hot:focus rect { stroke-width: 3; } /* hovering or tabbing to a clickable drawing part thickens its outline as feedback */
      .sec-3-3 .hot:focus { outline: none; } /* hides the browser's default focus ring on drawing parts, since the thicker outline already shows focus */
      .sec-3-3 .s33-split2 { grid-template-columns: minmax(0, 1.65fr) minmax(0, 1fr); } /* step 2 layout: the table cards get about 1.65 times the width of the quiz panel beside them */
      .sec-3-3 .card.s33-file { background: var(--accent-bg); border-color: color-mix(in srgb, var(--accent) 35%, transparent); } /* the File tables card gets the accent colour, since no built-in colour family exists for files */
      .sec-3-3 .btn.s33-file { border-color: var(--accent); color: var(--accent); } /* the File tables answer button in the quiz uses the same accent colour as its card */
      .sec-3-3 .s33-tc { padding: 10px 14px; } /* inner padding for each of the four table cards in step 2 */
      .sec-3-3 .s33-tc .tt { font-weight: 800; font-size: 17px; margin-bottom: 2px; } /* card title (such as "Memory tables"): bold and larger so it reads as a heading */
      .sec-3-3 .s33-tc .sub { font-size: 13px; color: var(--ink-2); margin-bottom: 4px; } /* the small grey line under each card title that says what the table covers */
      .sec-3-3 .s33-tc ul { margin: 0; padding-left: 18px; font-size: 14.5px; line-height: 1.38; } /* the bullet list inside each card: small indent and tight lines so four cards fit on one screen */
      .sec-3-3 .s33-tc li { margin: 1px 0; } /* a little space between the bullet points in each card */
      .sec-3-3 .tt.mem { color: var(--mem); } .sec-3-3 .tt.io { color: var(--io); } /* colours the Memory and I/O card titles to match their card colours */
      .sec-3-3 .tt.file { color: var(--accent); } .sec-3-3 .tt.proc { color: var(--proc); } /* colours the File and Process card titles to match their card colours */
      .sec-3-3 .s33-q { font-size: 18px; font-weight: 650; line-height: 1.4; min-height: 78px; } /* the quiz question text: large and bold, with a fixed minimum height so the buttons below do not jump */
      .sec-3-3 .s33-ans { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; } /* lays out the four answer buttons as a two-by-two grid */
      .sec-3-3 .s33-ans .btn { height: 44px; width: 100%; } /* every answer button has the same height and fills its grid cell */
      .sec-3-3 .s33-ans.locked .btn { pointer-events: none; } /* once the right answer is found (class locked), the buttons ignore further clicks */
      .sec-3-3 .btn.right { background: var(--ok-bg); border-color: var(--ok); color: var(--ok); } /* an answer button marked right turns green */
      .sec-3-3 .btn.wrong { background: var(--bad-bg); border-color: var(--bad); color: var(--bad); } /* an answer button marked wrong turns red */
      .sec-3-3 .s33-fb { min-height: 96px; font-size: 15px; line-height: 1.45; } /* the feedback box under the answers keeps a minimum height so the layout stays still as text changes */
      .sec-3-3 .s33-fb .v { font-weight: 900; font-size: 16px; } /* the verdict line (right or not) at the top of the feedback box: heavy and slightly larger */
      .sec-3-3 .s33-fb .v.ok { color: var(--ok); } .sec-3-3 .s33-fb .v.bad { color: var(--bad); } /* colours the verdict green when right and red when wrong */
      .sec-3-3 .s33-dsplit { grid-template-columns: minmax(0, 330px) minmax(0, 1fr); gap: 18px; } /* step 3 layout: a fixed-width explanation column (up to 330px) beside the four-table dashboard */
      .sec-3-3 .s33-dash table.tbl { font-size: 13.5px; } /* dashboard tables use a slightly smaller font so all four tables fit on the screen */
      .sec-3-3 .s33-dash table.tbl th { font-size: 12.5px; padding: 3px 6px; } /* dashboard column headers: smaller text and tight padding */
      .sec-3-3 .s33-dash table.tbl td { padding: 3px 6px; white-space: nowrap; transition: background .15s, opacity .15s; } /* dashboard cells: tight padding, no line breaks, and a quick fade when a row is highlighted or dimmed */
      .sec-3-3 .s33-dash.nar table.tbl td { white-space: normal; } /* on a phone-width screen (class nar), dashboard cells may wrap onto more lines so the tables fit */
      .sec-3-3 .s33-dash tr[role=button] { cursor: pointer; } /* clickable dashboard rows show a hand pointer */
      .sec-3-3 .s33-dash tr[role=button]:hover td { background: var(--panel-3); } /* hovering a dashboard row shades it so students see which row they are about to pick */
      .sec-3-3 .s33-dash tr.sel td { background: var(--hl); font-weight: 700; } /* the row the student clicked turns yellow and bold */
      .sec-3-3 .s33-dash tr.lk td { background: var(--accent-bg); } /* rows linked to the clicked row are shaded in the accent colour */
      .sec-3-3 .s33-dash.has-sel tr[role=button]:not(.sel):not(.lk) td { opacity: .42; } /* while a row is selected, every row that is neither picked nor linked fades out */
      .sec-3-3 .s33-dash .th { display: flex; align-items: baseline; gap: 8px; margin-bottom: 4px; } /* each table's heading line: its coloured label and grey note sit side by side on one baseline */
      .sec-3-3 .s33-dash .th b { font-size: 15.5px; } /* bold text inside a table heading line gets a slightly larger size */
      .sec-3-3 .s33-sw { display: inline-block; width: 22px; height: 14px; border-radius: 4px; border: 1px solid var(--line-2); } /* a small coloured swatch box, used in the dashboard key and on the part buttons of step 4 */
      .sec-3-3 .btn.s33-part { height: 46px; justify-content: flex-start; gap: 10px; white-space: normal; text-align: left; line-height: 1.2; } /* step 4 part buttons: fixed height, text left-aligned and allowed to wrap, swatch on the left */
      .sec-3-3 .btn.s33-part .s33-sw { flex: none; border-width: 2px; } /* the swatch inside a part button keeps its size and gets a thicker border */
      .sec-3-3 .s33-psplit { grid-template-columns: minmax(0, 190px) minmax(0, 1fr); gap: 18px; } /* step 5 layout: a 190px column for the small PCB picture beside the tabbed panel */
      .sec-3-3 .s33-mini { display: flex; flex-direction: column; gap: 6px; min-height: 0; } /* the small PCB picture: its three bands stacked top to bottom */
      .sec-3-3 .s33-band { display: flex; flex-direction: column; gap: 3px; text-align: left; border: 2px solid var(--line-2); border-radius: 10px; padding: 8px 10px; background: var(--panel-2); cursor: pointer; color: var(--ink); line-height: 1.3; } /* one band of the PCB picture: a clickable box with a coloured border, title on top and its fields below */
      .sec-3-3 .s33-band b { font-size: 15px; } /* the band title is bold */
      .sec-3-3 .s33-band.proc { border-color: var(--proc); background: var(--proc-bg); flex: 3; } /* the process identification band: process colours; flex 3 makes it the smallest of the three bands */
      .sec-3-3 .s33-band.cpu { border-color: var(--cpu); background: var(--cpu-bg); flex: 5; } /* the processor state band: processor colours and a medium height (flex 5) */
      .sec-3-3 .s33-band.os { border-color: var(--os); background: var(--os-bg); flex: 6; } /* the process control band: OS colours and the tallest height (flex 6), since it holds the most fields */
      .sec-3-3 .s33-band.on { box-shadow: 0 0 0 3px var(--hl); } /* the band for the tab now open gets a yellow ring around it */
      .sec-3-3 .s33-band:not(.on) { opacity: .7; } /* bands for the other tabs fade slightly so the open one stands out */
      .sec-3-3 .s33-pcbt td { font-size: 14px; line-height: 1.35; } /* step 5 field tables: slightly smaller text with comfortable line spacing */
      .sec-3-3 .s33-pcbt td.mono { font-size: 13px; } /* the value column uses fixed-width type, a bit smaller so long values fit */
      .sec-3-3 .s33-pcbt td:first-child { width: 20%; } .sec-3-3 .s33-pcbt td:nth-child(2) { width: 30%; } /* sets the width of the field-name column (20%) and the value column (30%); the rest is the explanation */
      .sec-3-3 .s33-tray { display: flex; flex-wrap: wrap; gap: 6px; min-height: 30px; } /* the sort game's tray of field buttons: they wrap onto new lines and keep a minimum height when empty */
      .sec-3-3 .s33-bucket { display: flex; flex-direction: column; gap: 6px; cursor: pointer; min-height: 120px; padding: 10px 12px; } /* a sort game bucket (one per PCB group): clickable, with its dropped fields listed inside it */
      .sec-3-3 .s33-bucket.armed { outline: 2px dashed var(--line-2); outline-offset: 2px; } /* while a field is selected, every bucket shows a dashed outline to invite a click */
      .sec-3-3 .s33-dropped { display: flex; flex-wrap: wrap; gap: 5px; } /* the fields already sorted into a bucket wrap as a row of small chips */
      .sec-3-3 .s33-ok { color: var(--ok); font-weight: 800; } .sec-3-3 .s33-no { color: var(--bad); font-weight: 800; } /* green bold for a right answer mark and red bold for a wrong one */
      .sec-3-3 .s33-fsplit { grid-template-columns: minmax(0, 350px) minmax(0, 1fr); gap: 20px; } /* step 6 layout: a 350px column of explanations beside the EFLAGS lab */
      .sec-3-3 .s33-fsplit > .stack > * { flex-shrink: 0; } /* items in the step 6 explanation column keep their natural height instead of being squeezed */
      .sec-3-3 .s33-at { border-collapse: collapse; font-size: 15px; } /* the step 6 arithmetic table (A, B and the result): lines between cells merge, 15px text */
      .sec-3-3 .s33-at td { padding: 1px 10px 1px 0; } /* arithmetic table cells: a little space on the right so the columns do not touch */
      .sec-3-3 .s33-at td.n { font-family: var(--mono); font-weight: 800; text-align: right; min-width: 3.5ch; } /* number column: fixed-width bold digits, right-aligned like a sum written on paper */
      .sec-3-3 .s33-at td.m { font-family: var(--mono); letter-spacing: .04em; padding-left: 10px; } /* bit column: fixed-width type with slightly spaced digits so the 8 bits are easy to count */
      .sec-3-3 .s33-at tr.res td { border-top: 2px solid var(--line-2); font-weight: 800; } /* result row: a line above it and bold text, like the line under a written sum */
      .sec-3-3 .s33-flag { padding: 7px 10px; } /* inner padding for each of the four flag cards (CF, ZF, SF, OF) */
      .sec-3-3 .s33-flag.set { background: var(--cpu-bg); border-color: var(--cpu); } /* a flag card whose flag is 1 takes the processor colours so set flags stand out */
      .sec-3-3 .s33-fv { font-family: var(--mono); font-weight: 900; font-size: 22px; line-height: 1; } /* the flag's value (0 or 1): large, heavy, fixed-width digit */
      .sec-3-3 .s33-flag.set .s33-fv, .sec-3-3 .s33-flag.set b { color: var(--cpu); } /* in a set flag card, the value and the flag name turn the processor colour */
      .sec-3-3 .s33-fw { font-size: 13px; line-height: 1.35; margin-top: 3px; } /* the one-line explanation under each flag: small text */
      .sec-3-3 .hot.dim { opacity: .38; } /* EFLAGS bits the lab does not need (class dim) fade out so the important ones stand out */
      .sec-3-3 .hot.dim:hover, .sec-3-3 .hot.dim:focus { opacity: .8; } /* a faded bit becomes clearer when hovered or focused, so students can still read it */
      .sec-3-3 .s33-chal { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; padding: 5px 12px; } /* the challenges bar: its items wrap onto new lines with small gaps */
      .sec-3-3 .s33-chal > div { white-space: nowrap; } /* each challenge item stays on one line */
      .sec-3-3 .s33-qsplit { grid-template-columns: minmax(0, 312px) minmax(0, 1fr); gap: 18px; } /* step 7 layout: a 312px explanation column beside the queue lab */
      .sec-3-3 .s33-qsplit > .stack > * { flex-shrink: 0; } /* items in that column keep their natural height */
      .sec-3-3 .s33-qsplit > .stack > .grow { flex-shrink: 1; } /* except the growing box (the narration), which may shrink so the column still fits */
    `,  // end of the section's CSS text
    steps: [  // steps: the list of screens in this section, shown one at a time with Next and Back
      /* ---------------- 1. Big picture: the OS as resource manager ---------------- */
      {  // opens step 1
        title: 'The OS keeps the books: who has what?',  // step 1 title shown at the top of the screen
        kind: 'story',  // kind story: the big-picture step, which the core path always keeps
        html: `${/* html: the fixed page layout for this step, placed on screen before render() runs */''}
          <div class="split l fill">${/* two-column layout; class l gives the left text column less width than the right one */''}
            <div class="stack">${/* left column: the paragraphs stacked top to bottom */''}
              <p class="lead m0">A computer has a limited number of processors (this one has just one), a fixed amount of <span class="t">main memory</span> and a few devices, yet many <span class="t">processes</span> want them at the same time.</p>${/* lead paragraph: few processors, fixed memory and devices, but many processes want them */''}
              <p class="m0">The operating system is the manager in the middle. It hands each resource to a process and later takes it back, so at every moment it must be able to answer: <b>where</b> is each process, <b>what</b> does it hold, and <b>what</b> is it waiting for?</p>${/* paragraph: the OS as manager must know where each process is, what it holds and what it waits for */''}
              <div class="callout analogy m0" data-label="Analogy">A hotel front desk keeps a room chart, a log of borrowed equipment, tickets for bags in the storage room and a guest register. Without that paperwork nobody knows who has what. The OS keeps the same kind of paperwork, in tables.</div>${/* analogy callout: a hotel front desk keeps paperwork the way the OS keeps tables */''}
              <div class="callout why m0" data-label="In this section">You will open the OS's books: its four kinds of tables, the <span class="t">process image</span>, and the <span class="t">process control block</span> at the heart of it all.</div>${/* preview callout: this section opens the tables, the process image and the PCB */''}
            </div>${/* closes the left column */''}
            <div class="stack s33-fig"></div>${/* empty right column (s33-fig); render() fills it with the clickable diagram */''}
          </div>`,  // closes the two-column layout and ends the html text
        render(el, ctx) {  // render(el, ctx): runs each time step 1 is shown; el is the step's box, ctx the guide's helper kit
          const { h } = ctx;  // takes h out of ctx: h(tag, props, children) builds an HTML element in one call
          const PROCS = [  // PROCS: the four example processes in the diagram
            { id: 'p1', x: 12, name: 'P1 · editor', st: 'Running', rel: { cpu: 'h', kbd: 'h', m1: 'h' },  // P1 editor, Running; rel lists what it touches: processor, keyboard, memory slot m1 ('h' = holds)
              info: '<b>P1 · editor: Running.</b> It has the processor right now, its image sits in main memory, and it owns the keyboard because its window has focus.' },  // click text for P1: running, in memory, owns the keyboard
            { id: 'p2', x: 176, name: 'P2 · music', st: 'Blocked', rel: { disk: 'h', m2: 'h' },  // P2 music player, Blocked; it holds the disk and memory slot m2
              info: '<b>P2 · music player: Blocked.</b> Its image is in memory and the disk drive is reading the next part of a song for it. Until that read finishes, P2 cannot run even if the processor is idle.' },  // click text for P2: blocked until the disk read finishes
            { id: 'p3', x: 340, name: 'P3 · backup', st: 'Ready/Suspend', rel: { swap: 'h', free: 'w' },  // P3 backup, Ready/Suspend; its image sits in the swap area and it waits ('w') for free memory
              info: '<b>P3 · backup: Ready/Suspend (swapped out).</b> Memory ran short, so the OS <span class="t" data-t="Swapping">swapped</span> P3\'s program, data and stack out to the swap area on disk. Only its PCB stays behind, among the OS tables, so the OS can still manage it. P3 cannot run until it is brought back in.' },  // click text for P3: swapped out, only its PCB stays with the OS tables
            { id: 'p4', x: 504, name: 'P4 · print job', st: 'Ready', rel: { prn: 'h', m4: 'h', cpu: 'w' },  // P4 print job, Ready; it holds the printer and slot m4 and waits for the processor
              info: '<b>P4 · print job: Ready.</b> Its image is in memory and it has been given the printer. It could run right now; it is only waiting for the processor.' },  // click text for P4: ready, holding the printer, waiting only for the processor
          ];  // closes PROCS
          const RES_INFO = {  // RES_INFO: the text shown when a resource box is clicked, keyed by resource name
            cpu: '<b>Processor.</b> It runs one process at a time: P1 now. P4 is ready and waiting for its turn.',  // click text for the processor: runs P1, P4 waits
            mem: '<b>Main memory.</b> It holds the OS itself (tables included) and the images of P1, P2 and P4. Of P3, only its PCB is here, with the OS tables; the rest needs free space before it can come back.',  // click text for main memory: holds the OS, three images, and P3's PCB only
            kbd: '<b>Keyboard.</b> Assigned to P1, the process whose window has focus.',  // click text for the keyboard: assigned to P1
            prn: '<b>Printer.</b> Assigned to P4. Any other process that wants it must wait until P4 releases it.',  // click text for the printer: held by P4, others must wait
            net: '<b>Network card.</b> Nobody holds it right now, so the OS records it as free.',  // click text for the network card: free
            disk: '<b>Disk drive.</b> Busy with a read for P2. It stores files, and part of it is a swap area holding the swapped-out image of P3, so the OS must track disk space per process too.',  // click text for the disk: reading for P2, and its swap area holds P3's image
          };  // closes RES_INFO
          const PART_RES = { cpu: 'cpu', kbd: 'kbd', prn: 'prn', disk: 'disk', swap: 'disk', m1: 'mem', m2: 'mem', m4: 'mem', free: 'mem' };  // PART_RES: which resource box each badge or slot sits in (swap is part of the disk, m1, m2, m4 and free are in memory)
          const holders = (r) => PROCS.filter((p) => Object.keys(p.rel).some((k) => PART_RES[k] === r)).map((p) => p.id);  // holders(r): the IDs of the processes that hold or wait for anything inside resource r
          let sel = null;  // sel: what the student picked, {t: 'p' or 'r', id}, or null to show everything
          const fig = el.querySelector('.s33-fig');  // fig: the empty right column from the html above
          const box = h('div', { class: 'card white tight grow', style: { display: 'grid', placeItems: 'center' } });  // box: the white card that will hold the drawing, centred in its space
          const info = h('div', { class: 'card tight small', style: { minHeight: '86px' } });  // info: the card under the drawing that explains the current pick; its minimum height stops jumping
          fig.append(box, info);  // puts the drawing card and the info card into the right column

          function paint() {  // paint(): redraws the diagram and the info text; runs at start and after every click
            const sp = sel && sel.t === 'p' ? PROCS.find((p) => p.id === sel.id) : null;  // sp: the selected process's record, when a process (not a resource) is picked
            const procOn = (p) => !sel || (sel.t === 'p' ? sel.id === p.id : holders(sel.id).includes(p.id));  // procOn(p): should process p be bright? yes if nothing is picked, if it is the pick, or if it uses the picked resource
            const resOn = (r) => !sel || (sel.t === 'r' ? sel.id === r : Object.keys(sp.rel).some((k) => PART_RES[k] === r));  // resOn(r): should resource box r be bright? yes if it is the pick or the picked process uses it
            const partOn = (pid, part) => !sel || (sel.t === 'p' ? sel.id === pid : PART_RES[part] === sel.id);  // partOn(pid, part): should a badge or slot be bright? yes if it belongs to the picked process or sits in the picked resource
            const op = (on) => `opacity="${on ? 1 : 0.35}"`;  // op(on): the opacity attribute: fully visible when bright, 35% when faded
            const hi = (on) => (sel && on ? 'style="stroke:var(--proc)" stroke-width="3.5"' : 'stroke-width="2"');  // hi(on): outline attributes; bright parts get a thick process-coloured outline while something is picked
            const badge = (x, y, text, pid, part, kind) => {  // badge(x, y, text, pid, part, kind): builds the SVG (the browser's drawing format) for a small pill label such as "P1 running"
              const w = Math.round(text.length * 7.3 + 16), on = partOn(pid, part);  // the pill's width grows with the text length; on says whether it is bright
              const cls = kind === 'free' ? 's-panel' : 's-proc';  // a "free" badge uses plain panel colours; the others use the process colours
              return `<g ${op(on)}><rect x="${x}" y="${y}" width="${w}" height="22" rx="11" class="${cls}" stroke-width="${sel && on ? 2.5 : 1.5}" ${kind === 'w' ? 'stroke-dasharray="5 3"' : ''}/><text x="${x + w / 2}" y="${y + 15.5}" text-anchor="middle" font-size="13" font-weight="700">${text}</text></g>`;  // returns the pill: a rounded box (dashed when kind is 'w', waiting) with the text centred in it
            };  // ends badge()
            // geometry: wide canvas vs phone (narrow) layout
            const G = ctx.narrow ? {  // G: positions and sizes of every box; this first set is for a phone-width screen (a tall 400 x 648 drawing)
              vb: '0 0 400 648', procs: [[8, 8], [204, 8], [8, 74], [204, 74]], pw: 188, ph: 58, lab: [8, 156, 'Resources the OS hands out and tracks'], frame: [2, 166, 396, 430],  // phone: drawing size, the four process boxes in a 2 x 2 grid, the resource label and the dashed frame
              cpu: [12, 178, 184, 100], cpuB: [[24, 212], [24, 244]], kbd: [204, 178, 184, 66], kbdB: [216, 208], prn: [204, 252, 184, 66], prnB: [216, 282],  // phone: processor box with its two badge spots, then the keyboard and printer boxes
              net: [204, 326, 184, 66], netB: [276, 356], mem: [12, 290, 184, 300], mx: 22, mw: 164, osY: 324, sY: [384, 434, 484], freeY: 534,  // phone: network card box, the main memory box and the y positions of its slots and free space
              disk: [204, 400, 184, 190], diskB: [212, 434], files: [216, 464, 160, 34], swapY: 516, p3: [216, 524, 160, 58], legend: 'row', legY: 612,  // phone: disk box, its files area, swap area and P3 image, with the key laid out in a row at the bottom
            } : {  // the second set, used on a normal wide screen
              vb: '0 0 660 432', procs: [[12, 8], [176, 8], [340, 8], [504, 8]], pw: 146, ph: 62, lab: [10, 96, 'Resources the OS hands out and keeps track of (and so on, up to process Pn)'], frame: [4, 106, 652, 322],  // wide: a 660 x 432 drawing, the four processes in one row, the resource label and the dashed frame
              cpu: [20, 118, 132, 104], cpuB: [[32, 152], [32, 184]], kbd: [384, 118, 124, 92], kbdB: [396, 152], prn: [384, 222, 124, 92], prnB: [396, 256],  // wide: processor box and badge spots, then keyboard and printer boxes on the right side
              net: [384, 326, 124, 94], netB: [424, 360], mem: [168, 118, 200, 302], mx: 182, mw: 172, osY: 152, sY: [212, 262, 312], freeY: 362,  // wide: network card box and the main memory column with its slot positions
              disk: [522, 118, 128, 302], diskB: [530, 152], files: [534, 186, 104, 70], swapY: 284, p3: [534, 294, 104, 112], legend: 'col', legY: 246,  // wide: disk column with files, swap area and P3 image, with the key stacked in a column
            };  // ends G
            const slot = (y, hh, label, pid, part) => {  // slot(y, hh, label, pid, part): builds one process-image slot inside the main memory box
              const on = partOn(pid, part);  // on: whether this slot should be bright
              return `<g ${op(on)}><rect x="${G.mx}" y="${y}" width="${G.mw}" height="${hh}" rx="7" class="s-proc" ${hi(on && sel)}/><text x="${G.mx + G.mw / 2}" y="${y + hh / 2 + 5}" text-anchor="middle" font-size="14" font-weight="700">${label}</text></g>`;  // returns the slot: a rounded box across the memory column with the label centred
            };  // ends slot()
            const res = (id, [x, y, w, hh], cls, title, inner) => `<g class="hot" role="button" tabindex="0" data-r="${id}" aria-label="${title}" ${op(resOn(id))}><rect x="${x}" y="${y}" width="${w}" height="${hh}" rx="12" class="${cls}" ${hi(resOn(id))}/><text x="${x + w / 2}" y="${y + 24}" text-anchor="middle" font-size="15" font-weight="800">${title}</text>${inner || ''}</g>`;  // res(id, box, cls, title, inner): builds a clickable resource box (it acts as a button and takes keyboard focus) with a title and contents
            const freeOn = partOn('p3', 'free');  // freeOn: whether the free-space slot is bright (it counts as P3's, since P3 is waiting for it)
            const p3sel = sp && sp.id === 'p3';  // p3sel: true when P3 is picked, so the free space relabels itself "P3 needs room here"
            const [fx, fy, fw, fh] = G.files, [qx, qy, qw, qh] = G.p3, mcx = G.mx + G.mw / 2;  // unpacks the files box and P3's swap box positions; mcx is the centre line of the memory column
            const legend = G.legend === 'col'  // legend: the key for the pills, in a column (wide screen) or a row (phone)
              ? `<g font-size="13"><rect x="22" y="${G.legY}" width="30" height="16" rx="8" class="s-proc" stroke-width="1.5"/><text x="60" y="${G.legY + 13}">holds / uses</text>${/* column key: a solid pill means "holds / uses" */''}
                <rect x="22" y="${G.legY + 28}" width="30" height="16" rx="8" class="s-proc" stroke-width="1.5" stroke-dasharray="5 3"/><text x="60" y="${G.legY + 41}">waiting for</text>${/* column key: a dashed pill means "waiting for" */''}
                <text x="22" y="${G.legY + 76}" class="s-sub">Click a process or</text><text x="22" y="${G.legY + 94}" class="s-sub">a resource box.</text>${/* column key: first half of the hint telling students to click a box */''}
                <text x="22" y="${G.legY + 126}" class="s-sub">Click it again to</text><text x="22" y="${G.legY + 144}" class="s-sub">see everything.</text></g>`  // column key: second half of the hint, click again to see everything; closes the column key
              : `<g font-size="13"><rect x="12" y="${G.legY}" width="30" height="16" rx="8" class="s-proc" stroke-width="1.5"/><text x="50" y="${G.legY + 13}">holds / uses</text>${/* row key for phones: a solid pill means "holds / uses" */''}
                <rect x="170" y="${G.legY}" width="30" height="16" rx="8" class="s-proc" stroke-width="1.5" stroke-dasharray="5 3"/><text x="208" y="${G.legY + 13}">waiting for</text>${/* row key: a dashed pill means "waiting for" */''}
                <text x="12" y="${G.legY + 34}" class="s-sub">Tap a box to focus on it; tap again to see all.</text></g>`;  // row key: the hint to tap a box to focus on it and tap again to see all; closes the row key
            box.innerHTML = `<svg viewBox="${G.vb}" width="100%" role="img" aria-label="Four processes and the resources the OS hands out to them">${/* replaces the drawing with a fresh SVG sized by G; role and aria-label describe it to screen readers */''}
              ${PROCS.map((p, i) => { const [x, y] = G.procs[i]; return `<g class="hot" role="button" tabindex="0" data-p="${p.id}" aria-label="${p.name}" ${op(procOn(p))}>${/* for each process, a clickable group (data-p holds its ID) placed at its G position, faded unless bright */''}
                <rect x="${x}" y="${y}" width="${G.pw}" height="${G.ph}" rx="12" class="s-proc" ${sel && procOn(p) ? 'stroke-width="3.5"' : 'stroke-width="2"'} ${p.id === 'p3' ? 'stroke-dasharray="7 4"' : ''}/>${/* the process box: thicker outline when bright during a pick, dashed for P3 because it is swapped out */''}
                <text x="${x + G.pw / 2}" y="${y + 25}" text-anchor="middle" font-size="15" font-weight="800">${p.name}</text>${/* the process name, centred in its box */''}
                <text x="${x + G.pw / 2}" y="${y + 46}" text-anchor="middle" font-size="13" class="s-sub">${p.st}</text></g>`; }).join('')}${/* the process state in grey under the name; closes the group, and join('') glues the four groups into one string */''}
              <text x="${G.lab[0]}" y="${G.lab[1]}" font-size="13" class="s-sub">${G.lab[2]}</text>${/* the grey label over the resource area */''}
              <rect x="${G.frame[0]}" y="${G.frame[1]}" width="${G.frame[2]}" height="${G.frame[3]}" rx="14" fill="none" style="stroke:var(--os)" stroke-width="1.5" stroke-dasharray="6 5"/>${/* dashed frame in the OS colour around all the resources the OS hands out */''}
              ${res('cpu', G.cpu, 's-cpu', 'Processor', badge(...G.cpuB[0], 'P1 running', 'p1', 'cpu', 'h') + badge(...G.cpuB[1], 'P4 waiting', 'p4', 'cpu', 'w'))}${/* processor box with two badges: P1 running and P4 waiting */''}
              ${res('mem', G.mem, 's-mem', 'Main memory',  // main memory box; its contents follow on the next lines
                `<rect x="${G.mx}" y="${G.osY}" width="${G.mw}" height="52" rx="7" class="s-os" stroke-width="2"/><text x="${mcx}" y="${G.osY + 31}" text-anchor="middle" font-size="14" font-weight="700">OS code + its tables</text>`  // inside memory: the band at the top for the OS code and its tables
                + slot(G.sY[0], 44, 'P1 image', 'p1', 'm1') + slot(G.sY[1], 44, 'P2 image', 'p2', 'm2') + slot(G.sY[2], 44, 'P4 image', 'p4', 'm4')  // the three image slots in memory: P1, P2 and P4
                + `<g ${op(freeOn)}><rect x="${G.mx}" y="${G.freeY}" width="${G.mw}" height="46" rx="7" class="${p3sel ? 's-warn' : 's-panel'}" stroke-width="2" stroke-dasharray="5 4"/><text x="${mcx}" y="${G.freeY + 28}" text-anchor="middle" font-size="13" ${p3sel ? 'font-weight="700"' : 'class="s-sub"'}>${p3sel ? 'P3 needs room here' : 'free space'}</text></g>`)}${/* the free-space slot; when P3 is picked it turns into a warning that says P3 needs room here; closes memory */''}
              ${res('kbd', G.kbd, 's-io', 'Keyboard', badge(...G.kbdB, 'in use by P1', 'p1', 'kbd', 'h'))}${/* keyboard box with its badge: in use by P1 */''}
              ${res('prn', G.prn, 's-io', 'Printer', badge(...G.prnB, 'held by P4', 'p4', 'prn', 'h'))}${/* printer box with its badge: held by P4 */''}
              ${res('net', G.net, 's-io', 'Network card', badge(...G.netB, 'free', null, 'net', 'free'))}${/* network card box with a "free" badge that belongs to no process */''}
              ${res('disk', G.disk, 's-io', 'Disk drive', badge(...G.diskB, 'reading for P2', 'p2', 'disk', 'h')  // disk box, starting with its badge: reading for P2
                + `<rect x="${fx}" y="${fy}" width="${fw}" height="${fh}" rx="7" class="s-panel"/><text x="${fx + fw / 2}" y="${fy + fh / 2 + 5}" text-anchor="middle" font-size="13" class="s-sub">files</text>`  // the files area inside the disk box
                + `<text x="${qx + qw / 2}" y="${G.swapY}" text-anchor="middle" font-size="13" font-weight="700">swap area</text>`  // the "swap area" label inside the disk box
                + `<g ${op(partOn('p3', 'swap'))}><rect x="${qx}" y="${qy}" width="${qw}" height="${qh}" rx="7" class="s-proc" stroke-dasharray="6 4" ${hi(partOn('p3', 'swap') && sel)}/><text x="${qx + qw / 2}" y="${qy + qh / 2 - 2}" text-anchor="middle" font-size="14" font-weight="700">P3 image</text><text x="${qx + qw / 2}" y="${qy + qh / 2 + 16}" text-anchor="middle" font-size="13" class="s-sub">(swapped out)</text></g>`)}${/* P3's swapped-out image in the swap area, dashed, bright when P3 or the disk is picked; closes the disk box */''}
              ${legend}${/* adds the key built above */''}
            </svg>`;  // ends the SVG drawing
            info.innerHTML = !sel ? '<b>Everything at once.</b> Click any process (top row) or any resource box to see what the OS must remember about it.'  // info text: with nothing picked, invites the student to click a process or resource
              : (sel.t === 'p' ? sp.info : RES_INFO[sel.id]) + ' <span class="muted">Every fact here is a row in one of the OS\'s tables.</span>';  // otherwise shows the picked process's or resource's text, plus a reminder that each fact is a table row
          }  // ends paint()
          function pick(t, id) { sel = sel && sel.t === t && sel.id === id ? null : { t, id }; paint(); }  // pick(t, id): selects a process ('p') or resource ('r'), or clears it if it was already selected, then redraws
          const hit = (e) => { const g = e.target.closest('[data-p],[data-r]'); if (!g) return false; if (g.dataset.p) pick('p', g.dataset.p); else pick('r', g.dataset.r); return true; };  // hit(e): finds the process or resource group under the click and picks it; returns false when the click missed
          ctx.on(box, 'click', hit);  // listens for clicks on the drawing; ctx.on also removes the listener when the student leaves the step
          ctx.on(box, 'keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && hit(e)) e.preventDefault(); });  // Enter or Space on a focused box acts like a click, so the diagram works from the keyboard
          paint();  // draws the diagram for the first time when the step opens
        },  // ends render() for step 1
      },  // closes step 1
      /* ---------------- 2. The four families of OS tables + "which table?" game ---------------- */
      {  // opens step 2
        title: 'Four kinds of tables the OS keeps',  // step 2 title
        kind: 'learn',  // kind learn: a teaching step
        html: `${/* html: the fixed layout for step 2: the four table cards on the left and an empty quiz card on the right */''}
          <div class="split s33-split2 fill">${/* two columns sized by the s33-split2 rule, so the cards get more width than the quiz */''}
            <div class="stack gap-s">${/* left column: intro sentence and the four cards */''}
              <p class="m0">To answer those questions, the OS keeps a <b>table of information about every entity it manages</b>. They fall into four families:</p>${/* intro paragraph: the OS keeps a table for every entity it manages, in four families */''}
              <div class="grid-2 grow" style="gap:10px">${/* a 2 x 2 grid that holds the four cards */''}
                <div class="card mem s33-tc"><div class="tt mem"><span class="t">Memory tables</span></div><div class="sub">main memory and secondary (virtual) memory</div>${/* Memory tables card: its title and the line saying it covers main and secondary memory */''}
                  <ul><li>main memory given to each process</li><li>secondary memory (disk) holding each process's data</li><li>protection of each region: who may read or write it, including shared regions</li><li>what virtual memory needs (the scheme that keeps parts of a process on disk and brings them in when used)</li></ul></div>${/* memory card bullets: memory given to each process, disk space, protection, virtual memory details */''}
                <div class="card io s33-tc"><div class="tt io"><span class="t">I/O tables</span></div><div class="sub">devices, and channels (small processors that run I/O transfers)</div>${/* I/O tables card: its title and the line explaining what a channel is */''}
                  <ul><li>each device and channel: free, or assigned to which process</li><li>the status of the operation in progress</li><li>the main-memory address that is the source or destination of the transfer</li></ul></div>${/* I/O card bullets: free or assigned, status of the operation, memory address of the transfer */''}
                <div class="card s33-file s33-tc"><div class="tt file"><span class="t">File tables</span></div><div class="sub">files · often run by a file management system</div>${/* File tables card: its title and the line saying a file management system often runs it */''}
                  <ul><li>which files exist</li><li>where each is stored on secondary memory</li><li>current status: open? by whom? for writing?</li><li>attributes: owner, permissions, size</li></ul></div>${/* file card bullets: which files exist, where, whether open, and their attributes */''}
                <div class="card proc s33-tc"><div class="tt proc"><span class="t">Process tables</span></div><div class="sub">the processes themselves</div>${/* Process tables card: its title and subtitle */''}
                  <ul><li>one entry for every process</li><li>each entry leads to the process's image and control block</li><li>other tables refer to processes by ID, so everything links back here</li></ul></div>${/* process card bullets: one entry per process, leading to its image, with other tables linking back by ID */''}
              </div>${/* closes the grid of cards */''}
            </div>${/* closes the left column */''}
            <div class="card white stack s33-game" style="gap:10px"></div>${/* empty right card (s33-game) that render() fills with the "which table?" quiz */''}
          </div>`,  // closes the layout and ends the html text
        render(el, ctx) {  // render(el, ctx): builds the "which table answers it?" quiz when step 2 is shown
          const { h } = ctx;  // takes h, the element-building helper, out of ctx
          const KIND = { mem: 'Memory', io: 'I/O', file: 'File', proc: 'Process' };  // KIND: the four table families by key, with the names used on the answer buttons
          const DESC = { mem: 'Memory tables describe regions of main and secondary memory and who may use them.', io: 'I/O tables describe devices and channels and the transfers they are doing.', file: 'File tables describe files: where they are stored and who has them open.', proc: 'The process table lists the processes themselves, one entry each, leading to each image.' };  // DESC: one-line reminder of what each family covers, shown after a wrong pick
          const Q = [  // Q: the nine questions, each written as [question, right family, explanation]
            ['Is the printer free right now, or is some process using it?', 'io', 'Whether each device is free or assigned, and to whom, is exactly what an I/O table records.'],  // question 1: is the printer free? (answer: I/O tables)
            ['Which parts of main memory belong to process 12?', 'mem', 'Memory tables record how main memory has been handed out to processes.'],  // question 2: which memory belongs to process 12? (memory tables)
            ['Where on the disk is the file <i>report.pdf</i> stored?', 'file', 'A file table records where each file lives on secondary memory.'],  // question 3: where on disk is report.pdf stored? (file tables)
            ['Where is the image of process 7, so the OS can reach its control block?', 'proc', 'The process table has one entry per process, and that entry leads to the process image.'],  // question 4: where is process 7's image? (process table)
            ['A disk read just finished. At which memory address should its data land?', 'io', 'An I/O table keeps the main-memory location used as the source or destination of each transfer.'],  // question 5: where should the data of a finished disk read land? (I/O tables, though it mentions memory)
            ['May process 9 write into the memory region it shares with process 4?', 'mem', 'Protection attributes of memory regions, including shared ones, live in the memory tables.'],  // question 6: may process 9 write into a shared region? (memory tables, because it is protection)
            ['Is <i>budget.xlsx</i> open at the moment, and if so by whom?', 'file', 'The current status of each file (open or closed, by whom, how) is kept in the file table.'],  // question 7: is budget.xlsx open, and by whom? (file tables)
            ['Which pieces of process 3 are out on disk rather than in main memory?', 'mem', 'Memory tables also cover secondary memory and the information needed to manage virtual memory.'],  // question 8: which pieces of process 3 are out on disk? (memory tables cover secondary memory too)
            ['How many processes exist right now, and which entry belongs to process 15?', 'proc', 'The process table lists every process, one entry each.'],  // question 9: how many processes exist? (process table)
          ];  // closes the question list
          const game = el.querySelector('.s33-game');  // game: the empty right card from the html
          let i = 0, right = 0, tried = false;  // i is the current question number (from 0), right counts first-try answers, tried notes a wrong pick on this question
          function paint() {  // paint(): redraws the quiz card; runs at start, after Next and after Play again
            game.innerHTML = '';  // empties the card before rebuilding it
            game.append(h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { class: 'm0' }, 'Which table answers it?'), h('span', { class: 'chip accent' }, i < Q.length ? `Question ${i + 1} of ${Q.length}` : 'Done')));  // header row: the quiz title and a chip saying "Question n of 9" or "Done"
            if (i >= Q.length) {  // once every question is answered, the card shows the score screen instead
              game.append(h('div', { class: 'grow stack', style: { justifyContent: 'center', alignItems: 'center', textAlign: 'center' } },  // a centred area for the score
                h('div', { class: 'big' }, `${right} / ${Q.length}`),  // the score in large type, such as "7 / 9"
                h('p', { class: 'm0' }, 'right on the first try.'),  // the words under the score
                h('p', { class: 'small muted m0', html: right === Q.length ? 'Perfect: you can already tell the four families apart.' : 'Look back at the four cards for any you missed, then try again.' }),  // a closing message: praise for a perfect score, or a pointer back to the four cards
                h('button', { class: 'btn primary', type: 'button', onclick: () => { i = 0; right = 0; tried = false; paint(); } }, 'Play again')));  // Play again button: resets the question number, score and miss flag, then redraws
              return;  // stops here, since there is no question left to show
            }  // ends the score-screen branch
            const [q, ans, why] = Q[i];  // unpacks the current question into its text, right answer and explanation
            game.append(h('p', { class: 'small muted m0' }, 'The OS needs to answer this. Which family of tables does it look in?'), h('div', { class: 's33-q', html: q }));  // adds the instruction line and the question itself (html allows the italic file names)
            const fb = h('div', { class: 'card tight s33-fb grow', html: '<span class="muted">Pick one. Right on the first try counts toward your score.</span>' });  // fb: the feedback box, starting with a hint about first-try scoring
            const next = h('button', { class: 'btn primary', type: 'button', disabled: true, onclick: () => { i++; tried = false; paint(); } }, i === Q.length - 1 ? 'See score ▶' : 'Next question ▶');  // next: the Next button, disabled until the right answer is found; on the last question it says See score
            const grid = h('div', { class: 's33-ans' });  // grid: the 2 x 2 box of answer buttons
            Object.entries(KIND).forEach(([k, lab]) => {  // makes one answer button for each of the four families
              grid.append(h('button', { class: 'btn ' + (k === 'file' ? 's33-file' : k), type: 'button', 'data-k': k, onclick: () => {  // the button takes its family's colour (File uses s33-file) and data-k remembers its key; the click handler starts
                if (grid.classList.contains('locked')) return;  // once the right answer is found, further clicks are ignored
                const b = grid.querySelector(`[data-k="${k}"]`);  // b: the button that was clicked, found by its data-k
                if (k === ans) {  // the student picked the right family
                  if (!tried) right++;  // it counts toward the score only if no wrong pick came first
                  b.classList.add('right'); grid.classList.add('locked'); next.disabled = false;  // marks the button green, locks the grid and enables Next
                  fb.innerHTML = `<div class="v ok">✓ ${KIND[ans]} tables</div>${why}`;  // feedback: a tick, the family name and the explanation
                } else {  // otherwise the pick was wrong
                  tried = true; b.classList.add('wrong');  // remembers the miss (so this question no longer scores) and marks the button red
                  fb.innerHTML = `<div class="v bad">✗ Not the ${KIND[k]} tables</div>${DESC[k]} Is this question really about a device, a region of memory, a file, or a process itself? Try again.`;  // feedback: a cross, what the picked family covers, and a hint to think again
                }  // ends the right/wrong branches
              } }, lab + ' tables'));  // closes the click handler; the button label reads, for example, "Memory tables"
            });  // closes the loop that makes the four answer buttons
            game.append(grid, fb, h('div', { class: 'row', style: { justifyContent: 'space-between', marginTop: 'auto' } }, h('span', { class: 'small muted' }, `${right} right so far`), next));  // adds the buttons, the feedback box and a bottom row with the running score and the Next button
          }  // ends paint()
          paint();  // shows the first question when the step opens
        },  // ends render() for step 2
      },  // closes step 2
      /* ---------------- 3. Cross-linked dashboard of the four tables ---------------- */
      {  // opens step 3
        title: 'The tables point at one another',  // step 3 title
        kind: 'explore',  // kind explore: a step for free clicking and exploring
        render(el, ctx) {  // render(el, ctx): step 3 has no html, so render builds the whole screen
          const { h } = ctx;  // takes h, the element-building helper, out of ctx
          const T = [  // T: the four tables of the dashboard, each with its columns and rows
            { key: 'proc', title: 'Process table', color: 'proc', note: 'one entry per process', cols: ['PID', 'Program', 'State', 'Image at'], rows: [  // the process table: its key, title, colour, grey note and column names; its rows follow
              { id: 'p1', pid: 1, c: ['1', 'editor', 'Running', 'frames 0, 1'], say: '<b>Process 1 · editor.</b> Its entry leads to its image. The memory table shows its code in frame 0, its data in frame 1 and a share of the library in frame 7. The I/O table gives it the keyboard, and the file table has <i>essay.txt</i> open for it.' },  // process 1 row (editor, frames 0 and 1); say is the text shown when the row is clicked
              { id: 'p2', pid: 2, c: ['2', 'music', 'Blocked', 'frames 3, 4 + disk'], say: '<b>Process 2 · music.</b> Code and data are in frames 3 and 4; its stack page is out on disk block 88. Disk 0 is reading <i>song.mp3</i> (open for reading by process 2) straight into 0x4200, inside frame 4. Four tables, one process.' },  // process 2 row (music, frames 3 and 4 plus disk); its text shows it appears in all four tables
              { id: 'p3', pid: 3, c: ['3', 'backup', 'Ready/Suspend', 'disk 90–92'], say: '<b>Process 3 · backup.</b> Ready/Suspend (swapped out): its program, data and stack are on disk blocks 90–92, so it owns no frames (its PCB stays in the OS\'s memory). Its <i>backup.zip</i> stays open while it is swapped out.' },  // process 3 row (backup, swapped out to disk blocks 90-92, so it owns no frames)
              { id: 'p4', pid: 4, c: ['4', 'print job', 'Ready', 'frame 5'], say: '<b>Process 4 · print job.</b> Its image is in frame 5 and it shares the library in frame 7 with process 1. The I/O table shows the printer assigned to it.' },  // process 4 row (print job, frame 5, shares the library with process 1)
            ] },  // closes the process table
            { key: 'file', title: 'File table', color: 'accent', note: 'files on disk', cols: ['File', 'Blocks', 'Status', 'Owner'], rows: [  // the file table: columns File, Blocks, Status and Owner
              { id: 'f1', own: [1], c: ['essay.txt', '210–213', 'open: 1, R/W', 'ana'], say: '<b>essay.txt</b> lives in disk blocks 210–213 and is open for reading and writing by process 1. Its owner attribute says it belongs to user ana.' },  // essay.txt row; own [1] links it to process 1
              { id: 'f2', own: [2], x: ['disk'], c: ['song.mp3', '400–1379', 'open: 2, read', 'ana'], say: '<b>song.mp3</b> is open for reading by process 2, and disk 0 is fetching part of it right now. The file table and the I/O table describe the same transfer from two sides.' },  // song.mp3 row; linked to process 2, and x adds a link to the Disk 0 row, which is reading it
              { id: 'f3', own: [3], c: ['backup.zip', '1500–2600', 'open: 3, write', 'root'], say: '<b>backup.zip</b> is open for writing by process 3, even though process 3 is swapped out.' },  // backup.zip row, open for writing by process 3 even while it is swapped out
              { id: 'f4', own: [], c: ['notes.txt', '300–301', 'closed', 'ana'], say: '<b>notes.txt</b> exists, so the file table records its location and attributes, but no process has it open. It links to nothing else.' },  // notes.txt row; own is empty because no process has it open, so it links to nothing
            ] },  // closes the file table
            { key: 'mem', title: 'Memory table', color: 'mem', note: 'frames are 4 KB: frame 4 = 0x4000–0x4FFF', cols: ['Region', 'Owner', 'Where', 'Access'], rows: [  // the memory table; its note explains that frame 4 covers addresses 0x4000-0x4FFF
              { id: 'm1', own: [1], c: ['P1 code', '1', 'frame 0', 'read, execute'], say: '<b>Frame 0</b> holds the code of process 1. Its protection is read and execute only, so even a buggy program cannot overwrite its own instructions.' },  // frame 0: process 1's code, read and execute only
              { id: 'm2', own: [1], x: ['kbd'], c: ['P1 data', '1', 'frame 1', 'read, write'], say: '<b>Frame 1</b> (0x1000–0x1FFF) holds process 1\'s data. The keyboard\'s transfer address, 0x1800, lies inside it, so typed characters land in P1\'s own data.' },  // frame 1: process 1's data; linked to the keyboard row, whose transfer address 0x1800 lies inside it
              { id: 'm3', own: [2], c: ['P2 code', '2', 'frame 3', 'read, execute'], say: '<b>Frame 3</b> holds the code of process 2, protected as read and execute only.' },  // frame 3: process 2's code
              { id: 'm4', own: [2], x: ['disk'], c: ['P2 data', '2', 'frame 4', 'read, write'], say: '<b>Frame 4</b> (0x4000–0x4FFF) holds process 2\'s data. The I/O table says disk 0 is filling address 0x4200, which is inside this frame: a cross-reference from the I/O table into the memory table.' },  // frame 4: process 2's data; linked to the Disk 0 row, which fills address 0x4200 inside it
              { id: 'm5', own: [2], c: ['P2 stack', '2', 'disk blk 88', 'read, write'], say: '<b>Not every page is in main memory.</b> Process 2\'s stack page is on disk block 88 for now. The memory table records where, so the OS can bring it back when it is needed.' },  // process 2's stack page, parked on disk block 88
              { id: 'm6', own: [3], c: ['P3 image', '3', 'disk 90–92', 'read, write'], say: '<b>Process 3\'s image</b> (all but its PCB) is out on disk blocks 90–92. Memory tables cover secondary memory too, not just main memory.' },  // process 3's image, out on disk blocks 90-92
              { id: 'm7', own: [4], c: ['P4 image', '4', 'frame 5', 'read, write'], say: '<b>Frame 5</b> holds the image of process 4.' },  // frame 5: process 4's image
              { id: 'm8', own: [1, 4], c: ['Shared lib', '1, 4', 'frame 7', 'read only'], say: '<b>One copy</b> of the library in frame 7 is shared by processes 1 and 4. Its protection attribute is read-only, which is what makes sharing it safe.' },  // frame 7: one shared library owned by processes 1 and 4, read only so sharing is safe
            ] },  // closes the memory table
            { key: 'io', title: 'I/O table', color: 'io', note: 'devices and channels', cols: ['Device', 'Status', 'For', 'Transfer'], rows: [  // the I/O table: columns Device, Status, For and Transfer
              { id: 'kbd', own: [1], x: ['m2'], c: ['Keyboard', 'assigned', '1', '→ 0x1800'], say: '<b>The keyboard</b> is assigned to process 1. Characters go to address 0x1800, which is inside frame 1: process 1\'s data.' },  // keyboard row: assigned to process 1, linked to frame 1 (row m2)
              { id: 'disk', own: [2], x: ['m4', 'f2'], c: ['Disk 0', 'reading', '2', '→ 0x4200'], say: '<b>Disk 0</b> is reading for process 2: from <i>song.mp3</i> (file table) into 0x4200 in frame 4 (memory table). One I/O row points into two other tables.' },  // Disk 0 row: reading for process 2, linked to frame 4 (m4) and to song.mp3 (f2)
              { id: 'prn', own: [4], c: ['Printer', 'assigned, idle', '4', '—'], say: '<b>The printer</b> is assigned to process 4 but idle. If process 1 asked for it now, the OS would find this row and make process 1 wait.' },  // printer row: assigned to process 4 but idle
              { id: 'net', own: [], c: ['Network', 'free', '—', '—'], say: '<b>The network card</b> is free. No process holds it, so the OS can give it to the first process that asks.' },  // network row: free, so it links to nothing
            ] },  // closes the I/O table
          ];  // closes the list of four tables
          const byId = {};  // byId: a lookup from a row ID to its row, so any row in any table can be found quickly
          T.forEach((t) => t.rows.forEach((r) => { byId[r.id] = r; }));  // fills byId with every row of every table when the step opens
          const linked = (r) => (r.pid ? Object.values(byId).filter((x) => (x.own || []).includes(r.pid)).map((x) => x.id) : (r.own || []).map((n) => 'p' + n).concat(r.x || []));  // linked(r): the rows linked to r; a process row links to every row that lists its PID, other rows link to their processes plus x
          const say = h('div', { class: 'card white small grow', style: { lineHeight: '1.5' } });  // say: the explanation card in the left column
          const dash = h('div', { class: 'grid-2 s33-dash' + (ctx.narrow ? ' nar' : ''), style: { alignItems: 'start', gap: '14px' } });  // dash: the two-column grid of four tables; it gets class nar on a phone-width screen so its cells may wrap
          const trs = {};  // trs: each table row element by row ID, so pick() can recolour them
          let sel = null;  // sel: the ID of the selected row, or null when nothing is selected
          const mkTable = (t) => {  // mkTable(t): builds one table of the dashboard with its heading
            const tbl = h('table', { class: 'tbl compact' }, h('tr', {}, ...t.cols.map((c) => h('th', {}, c))));  // tbl: a compact table whose first row holds the column names
            t.rows.forEach((r) => {  // adds one row for each entry in the table
              const tr = h('tr', { role: 'button', tabindex: 0, 'aria-label': t.title + ': ' + r.c[0], onclick: () => pick(r.id), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(r.id); } } }, ...r.c.map((c) => h('td', {}, c)));  // a row that acts as a button: click, Enter or Space picks it; aria-label names the table and first cell; one cell per value
              trs[r.id] = tr; tbl.append(tr);  // remembers the row element by its ID and adds it to the table
            });  // ends the loop over rows
            return h('div', {}, h('div', { class: 'th' }, h('span', { class: 'chip ' + t.color }, t.title), h('span', { class: 'xs muted' }, t.note)), tbl);  // returns the table under its heading: a coloured chip with the title and the grey note
          };  // ends mkTable()
          const tip = h('div', { class: 'callout tip small m0', 'data-label': 'Where the tables come from', html: 'At start-up the OS first learns its environment (how much main memory, which devices) from firmware, by probing the hardware, or from an administrator\'s settings. Only then can it build its tables, which themselves live in main memory and so are covered by memory management too.' });  // tip: a callout on how the OS learns its hardware at start-up before it can build its tables
          dash.append(h('div', { class: 'stack', style: { gap: '12px' } }, mkTable(T[0]), mkTable(T[1]), tip), h('div', { class: 'stack', style: { gap: '12px' } }, mkTable(T[2]), mkTable(T[3]),  // fills the dashboard: left column with the process table, file table and tip; right column with memory and I/O tables
            h('div', { class: 'row small', style: { gap: '8px' } }, h('span', { class: 's33-sw', style: { background: 'var(--hl)' } }), 'the row you clicked', h('span', { class: 's33-sw', style: { background: 'var(--accent-bg)', marginLeft: '8px' } }), 'rows linked to it')));  // a colour key under the right column: yellow swatch for the clicked row, accent swatch for linked rows
          function pick(id) {  // pick(id): selects a row, or clears it when clicked again, then recolours every row and updates the text
            sel = sel === id ? null : id;  // toggles the selection
            const lk = sel ? linked(byId[sel]) : [];  // lk: the IDs of rows linked to the selected one (none when nothing is selected)
            Object.entries(trs).forEach(([k, tr]) => { tr.classList.toggle('sel', k === sel); tr.classList.toggle('lk', lk.includes(k)); });  // goes over every row, marking the selected one (sel) and the linked ones (lk) for the CSS colours
            dash.classList.toggle('has-sel', !!sel);  // has-sel on the dashboard tells the CSS to fade every row that is neither picked nor linked
            say.innerHTML = sel ? byId[sel].say + `<div class="xs muted" style="margin-top:6px">${lk.length ? `Linked rows: ${lk.length}.` : 'No linked rows.'} Click the row again to clear.</div>` : '<b>Nothing selected.</b> Click any row in any table. Its row turns yellow and every row it is linked to in the other tables is shaded purple.';  // the explanation card: the row's text, how many rows link to it and how to clear, or a hint when nothing is picked
          }  // ends pick()
          el.append(h('div', { class: 'split s33-dsplit fill' },  // builds the step layout: explanation column on the left, dashboard on the right
            h('div', { class: 'stack', style: { gap: '10px' } },  // left column, stacked top to bottom
              h('p', { class: 'm0', html: 'Each table holds one slice of the truth. The slices only make sense together, so the tables are <b>cross-referenced</b>: they name processes by ID and point at each other\'s entries.' }),  // paragraph: each table holds one slice of the truth, so the tables are cross-referenced
              h('p', { class: 'm0 small', html: 'Memory is split into 4 KB <span class="t" data-t="Frame">frames</span>; 0x means hexadecimal, so frame 4 = 0x4000–0x4FFF.' }),  // small paragraph: memory comes in 4 KB frames, and 0x marks a hexadecimal number
              say,  // the explanation card
              h('div', { class: 'callout why small m0', 'data-label': 'Why it matters', html: 'When process 2 ends, the OS must clean up every table that mentions it, or a frame, a device or a file stays assigned to a process that no longer exists.' })),  // why-it-matters callout: when a process ends, every table that mentions it must be cleaned up; closes the left column
            dash));  // adds the dashboard as the right column and closes the layout
          pick('p2');  // starts with process 2 selected, because it appears in all four tables
        },  // ends render() for step 3
      },  // closes step 3
      /* ---------------- 4. Build a process image; contiguous vs paged ---------------- */
      {  // opens step 4
        title: 'Build a process image, then decide where it lives',  // step 4 title
        kind: 'lab',  // kind lab: a hands-on step
        core: true,  // core: keeps this step on the shorter core path
        render(el, ctx) {  // render(el, ctx): builds the process-image lab when step 4 is shown
          const { h } = ctx;  // takes h, the element-building helper, out of ctx
          const PARTS = [  // PARTS: the four parts of a process image, each with key, name, drawing colour class, swatch colours and click text
            { k: 'prog', name: 'User program', cls: 's-cpu', sw: 'var(--cpu-bg)', bd: 'var(--cpu)',  // user program part: processor colours
              say: '<b>User program.</b> The machine instructions the process executes, loaded from the program file on disk. Run the editor twice and you get two processes, each with its own image and PCB, though the code is identical.' },  // click text for the user program: the instructions, loaded from the program file
            { k: 'data', name: 'User data', cls: 's-mem', sw: 'var(--mem-bg)', bd: 'var(--mem)',  // user data part: memory colours
              say: '<b><span class="t">User data</span>.</b> The part of the image the program may change: its variables and buffers, a user stack area, and (rarely) code that rewrites itself. It is what makes your copy of the editor differ from someone else\'s.' },  // click text for user data: the variables, buffers and user stack the program changes
            { k: 'stack', name: 'Stack', cls: 's-warn', sw: 'var(--warn-bg)', bd: 'var(--warn)',  // stack part: warning (orange) colours
              say: '<b>Stack.</b> One or more last-in, first-out <span class="t" data-t="System stack">system stacks</span> that remember calls in progress: each procedure or system call pushes its parameters and return address, and each return pops them.' },  // click text for the stack: remembers calls in progress, last in first out
            { k: 'pcb', name: 'Process control block', cls: 's-accent', sw: 'var(--accent-bg)', bd: 'var(--accent)',  // PCB part: accent colours
              say: '<b>Process control block (PCB).</b> Not part of the program: the attributes the OS needs to control the process (IDs, saved registers, state, priority, pointers). The program itself cannot change it.' },  // click text for the PCB: the attributes the OS needs, which the program cannot change
          ];  // closes PARTS
          const P = Object.fromEntries(PARTS.map((p) => [p.k, p]));  // P: the same four parts looked up by key (prog, data, stack, pcb)
          const added = new Set();  // added: the set of part keys the student has added so far
          let layout = 'contig', last = null;  // layout: which memory layout is shown, 'contig' or 'paged'; last: the part clicked most recently
          // frame contents per layout: [part, label] for process 7, or a plain string for other owners
          const LAYOUT = {  // LAYOUT: what sits in each of the 16 memory frames, for each layout
            contig: { 0: 'OS', 1: 'OS', 2: 'P3', 3: 'P3', 4: 'P5', 5: 'P5', 6: ['pcb', 'PCB'], 7: ['prog', 'program p0'], 8: ['prog', 'program p1'], 9: ['data', 'data p0'], 10: ['data', 'data p1'], 11: ['data', 'data p2'], 12: ['stack', 'stack'], 13: 'P9', 14: '', 15: '' },  // contiguous: frames 0-1 OS, 2-5 other processes, 6-12 all of process 7 in one unbroken run, 13 process 9, 14-15 free
            paged: { 0: 'OS', 1: 'OS', 2: 'P3', 3: ['pcb', 'PCB'], 4: 'P5', 5: ['data', 'data p0'], 6: '', 7: 'P9', 8: 'P3', 9: ['stack', 'stack'], 10: 'P5', 11: '', 12: ['prog', 'program p0'], 13: 'P9', 14: ['data', 'data p1'], 15: '' },  // paged: process 7's pieces are scattered over frames 3, 5, 9, 12 and 14, mixed with other processes and free gaps
          };  // closes LAYOUT
          const ONDISK = { contig: [], paged: [['prog', 'program p1'], ['data', 'data p2']] };  // ONDISK: the pieces of process 7 waiting on disk; none when contiguous, program p1 and data p2 when paged
          const MAP = {  // MAP: the lines of the "P7 memory map" box for each layout
            contig: [['image', 'frames 6–12'], ['starts at', '0x6000'], ['size', '7 frames'], ['on disk', 'nothing']],  // contiguous map: a start address and a size are all the OS needs
            paged: [['PCB', 'frame 3'], ['program p0', 'frame 12'], ['program p1', 'disk'], ['data p0', 'frame 5'], ['data p1', 'frame 14'], ['data p2', 'disk'], ['stack', 'frame 9']],  // paged map: one line per piece, saying which frame holds it or that it is on disk
          };  // closes MAP
          const NW = ctx.narrow, FW = NW ? 180 : 132;  // NW is true on a phone-width screen; FW is the width of one frame box (wider on phones)
          const fx = NW ? (i) => 16 + (i < 8 ? 0 : 188) : (i) => 204 + (i < 8 ? 0 : 140), fy = NW ? (i) => 232 + (i % 8) * 36 : (i) => 64 + (i % 8) * 36;  // fx(i) and fy(i): where frame i is drawn; frames 0-7 fill the first column and 8-15 the second, 36 units apart
          const svgBox = h('div', { class: 'card white tight grow', style: { display: 'grid', placeItems: 'center' } });  // svgBox: the white card that holds the memory drawing
          const cap = h('div', { class: 'card tight small', style: { lineHeight: '1.45' } });  // cap: the caption card under the drawing that explains the chosen layout
          const say = h('div', { class: 'card white small grow', style: { lineHeight: '1.5' } });  // say: the card that explains the part clicked most recently
          const btns = {};  // btns: the four part buttons, looked up by part key
          const grid = h('div', { class: 'grid-2', style: { gap: '8px' } });  // grid: a 2 x 2 grid for the part buttons
          PARTS.forEach((p) => {  // makes one button per part of the image
            btns[p.k] = h('button', { class: 'btn s33-part', type: 'button', onclick: () => { added.add(p.k); last = p.k; paint(); } });  // clicking a part adds it to the image, remembers it as the last one clicked, and redraws
            grid.append(btns[p.k]);  // puts the button into the grid
          });  // ends the loop over parts
          const seg = ctx.ui.seg([{ value: 'contig', label: 'One contiguous block' }, { value: 'paged', label: 'Paged: scattered, some on disk' }], layout, (v) => { layout = v; paint(); });  // seg: a two-choice switch between the contiguous and paged layouts; switching redraws
          const reset = h('button', { class: 'btn sm ghost', type: 'button', onclick: () => { added.clear(); last = null; layout = 'contig'; seg.set('contig'); paint(); } }, 'Start over');  // reset: the Start over button clears the parts, goes back to the contiguous layout and switch, and redraws
          const count = h('span', { class: 'xs muted' });  // count: small grey text that says how many parts have been added

          function piece(x, y, w, hh, part, label) {  // piece(x, y, w, hh, part, label): draws one piece of process 7, coloured if added or a dashed "?" outline if not
            const on = added.has(part), tx = x + w / 2 + 8, ty = y + hh / 2 + 5;  // on: whether this part has been added; tx, ty: the text position, nudged right to leave room for the frame number
            return on ? `<rect x="${x}" y="${y}" width="${w}" height="${hh}" rx="6" class="${P[part].cls}" stroke-width="2.5"/><text x="${tx}" y="${ty}" text-anchor="middle" font-size="13" font-weight="800">${label}</text>`  // an added piece: a box filled in its part's colour with a bold label
              : `<rect x="${x}" y="${y}" width="${w}" height="${hh}" rx="6" fill="none" style="stroke:var(--proc)" stroke-width="1.5" stroke-dasharray="5 4"/><text x="${tx}" y="${ty}" text-anchor="middle" font-size="13" class="s-sub">${label} ?</text>`;  // a missing piece: a dashed outline with a grey label and a question mark
          }  // ends piece()
          function paint() {  // paint(): redraws the drawing, buttons and texts; runs at start and after every click
            const L = LAYOUT[layout];  // L: the frame contents for the layout now chosen
            let frames = '';  // frames: the SVG text for all 16 frames, built up by the loop below
            for (let i = 0; i < 16; i++) {  // goes over frames 0 to 15
              const v = L[i], x = fx(i), y = fy(i), W = FW, H = 31, tx = x + W / 2 + 8;  // v is what the frame holds; x, y, W and H place and size it; tx is the centre of its text
              if (Array.isArray(v)) frames += piece(x, y, W, H, v[0], v[1]);  // an array means a piece of process 7, drawn with piece()
              else if (v === 'OS') frames += `<rect x="${x}" y="${y}" width="${W}" height="${H}" rx="6" class="s-os" stroke-width="1.5"/><text x="${tx}" y="${y + 20}" text-anchor="middle" font-size="13">OS kernel</text>`;  // 'OS' means an OS-coloured box labelled "OS kernel"
              else if (v) frames += `<rect x="${x}" y="${y}" width="${W}" height="${H}" rx="6" class="s-panel" stroke-width="1.5"/><text x="${tx}" y="${y + 20}" text-anchor="middle" font-size="13" class="s-sub">process ${v.slice(1)}</text>`;  // any other name (such as 'P3') means a grey box labelled with that process number
              else frames += `<rect x="${x}" y="${y}" width="${W}" height="${H}" rx="6" fill="none" class="s-muted" stroke-dasharray="4 4" stroke-width="1.5"/><text x="${tx}" y="${y + 20}" text-anchor="middle" font-size="13" class="s-sub">free</text>`;  // an empty string means a dashed box labelled free
              frames += `<text x="${x + 11}" y="${y + 20}" text-anchor="middle" font-size="13" class="s-sub">${i}</text>`;  // the frame number, written at the left end of every box
            }  // ends the loop over frames
            const py = fy(layout === 'contig' ? 6 : 3) + 15.5;  // py: the height where the process-table arrow lands, at process 7's first piece (frame 6, or the PCB in frame 3 when paged)
            const ptRows = (x, y0, w) => ['P3', 'P5', 'P7', 'P9'].map((t, k) => `<rect x="${x}" y="${y0 + k * 26}" width="${w}" height="22" rx="5" class="${t === 'P7' ? 's-proc' : 's-panel'}" stroke-width="${t === 'P7' ? 2 : 1}"/><text x="${x + 10}" y="${y0 + 15.5 + k * 26}" font-size="13" font-weight="${t === 'P7' ? 800 : 400}">${t}${t === 'P7' ? ': image at →' : ''}</text>`).join('');  // ptRows(x, y0, w): draws the process table's four entries, with P7 highlighted and marked "image at"
            const mapRows = (x0, x1, y0) => MAP[layout].map(([a, b], k) => `<text x="${x0}" y="${y0 + k * 18}" font-size="13">${a}</text><text x="${x1}" y="${y0 + k * 18}" text-anchor="end" font-size="13" font-weight="700">${b}</text>`).join('');  // mapRows(x0, x1, y0): draws the memory map lines, the piece's name on the left and its location on the right
            const none = (x, y) => `<text x="${x}" y="${y}" text-anchor="middle" font-size="13" class="s-sub">no pages of process 7 here: all of it is in main memory</text>`;  // none(x, y): the message shown in the phone drawing's disk area when no page of process 7 is on disk
            if (NW) {  // on a phone-width screen, draw the tall version of the picture
              const disk = ONDISK[layout].map(([part, label], k) => piece(16 + k * 188, 586, 180, 34, part, label)).join('');  // the disk pieces for the phone drawing: boxes side by side in the swap area
              svgBox.innerHTML = `<svg viewBox="0 0 400 680" width="100%" role="img" aria-label="Memory frames holding the image of process 7">${/* starts the tall 400 x 680 SVG for phones */''}
                <text x="8" y="16" font-size="13" class="s-sub">Coloured = process 7; dashed = not added yet.</text>${/* a key line: coloured boxes belong to process 7, dashed ones are not added yet */''}
                <rect x="8" y="28" width="188" height="162" rx="10" class="s-os" stroke-width="2"/><text x="102" y="48" text-anchor="middle" font-size="14" font-weight="800">Process table</text>${/* the process table box and its title */''}
                ${ptRows(18, 60, 168)}${/* the four process table entries */''}
                <path d="M18 123 H4 V${py} H12" fill="none" style="stroke:var(--proc)" stroke-width="2.5" marker-end="url(#arr-proc)"/>${/* arrow from the P7 entry, around the left edge, to the first frame of its image */''}
                <rect x="204" y="28" width="188" height="162" rx="10" class="s-panel" stroke-width="1.5"/><text x="298" y="48" text-anchor="middle" font-size="14" font-weight="800">P7 memory map</text>${/* the "P7 memory map" box and its title */''}
                ${mapRows(214, 382, 72)}${/* the memory map lines for the current layout */''}
                <text x="200" y="214" text-anchor="middle" font-size="14" font-weight="800">Main memory (frames 0–15, 4 KB each)</text>${/* the heading over main memory: 16 frames of 4 KB */''}
                <rect x="8" y="222" width="384" height="300" rx="10" fill="none" style="stroke:var(--mem)" stroke-width="2"/>${/* the outline around all 16 frames */''}
                ${frames}${/* the 16 frames built in the loop */''}
                <rect x="8" y="536" width="384" height="138" rx="12" class="s-io" stroke-width="2"/><text x="200" y="556" text-anchor="middle" font-size="14" font-weight="800">Disk (secondary memory)</text>${/* the disk box and its title */''}
                <text x="16" y="578" font-size="13" font-weight="700">swap area</text>${/* the "swap area" label inside the disk box */''}
                ${disk || none(200, 608)}${/* process 7's pieces on disk, or the message that none are there */''}
                <rect x="16" y="630" width="368" height="34" rx="7" class="s-panel" stroke-width="1.5"/><text x="200" y="652" text-anchor="middle" font-size="13"><tspan font-weight="700">program file</tspan> (photo editor code)</text>${/* the program file on disk that holds the photo editor's code */''}
              </svg>`;  // ends the phone drawing
            } else {  // otherwise draw the wide version of the picture
              const disk = ONDISK[layout].map(([part, label], k) => piece(522, 116 + k * 46, 170, 34, part, label)).join('');  // the disk pieces for the wide drawing, stacked down the disk column
              svgBox.innerHTML = `<svg viewBox="0 0 720 360" width="100%" role="img" aria-label="Memory frames holding the image of process 7">${/* starts the wide 720 x 360 SVG */''}
                <text x="8" y="18" font-size="13" class="s-sub">Coloured pieces belong to process 7; dashed ones have not been added yet.</text>${/* a key line: coloured pieces belong to process 7, dashed ones are not added yet */''}
                <rect x="8" y="34" width="170" height="140" rx="10" class="s-os" stroke-width="2"/><text x="93" y="55" text-anchor="middle" font-size="14" font-weight="800">Process table</text>${/* the process table box and its title */''}
                ${ptRows(20, 66, 146)}${/* the four process table entries */''}
                <path d="M166 129 C 186 129, 180 ${py}, 200 ${py}" fill="none" style="stroke:var(--proc)" stroke-width="2.5" marker-end="url(#arr-proc)"/>${/* a curved arrow from the P7 entry to the first frame of its image */''}
                <rect x="8" y="186" width="170" height="168" rx="10" class="s-panel" stroke-width="1.5"/><text x="93" y="206" text-anchor="middle" font-size="14" font-weight="800">P7 memory map</text>${/* the "P7 memory map" box and its title */''}
                ${mapRows(20, 168, 228)}${/* the memory map lines for the current layout */''}
                <text x="344" y="46" text-anchor="middle" font-size="14" font-weight="800">Main memory (frames 0–15, 4 KB each)</text>${/* the heading over main memory: 16 frames of 4 KB */''}
                <rect x="196" y="54" width="296" height="300" rx="10" fill="none" style="stroke:var(--mem)" stroke-width="2"/>${/* the outline around all 16 frames */''}
                ${frames}${/* the 16 frames built in the loop */''}
                <rect x="506" y="34" width="202" height="320" rx="12" class="s-io" stroke-width="2"/><text x="607" y="56" text-anchor="middle" font-size="14" font-weight="800">Disk</text>${/* the disk column and its title */''}
                <text x="607" y="76" text-anchor="middle" font-size="13" class="s-sub">(secondary memory)</text>${/* the grey "(secondary memory)" subtitle */''}
                <text x="607" y="104" text-anchor="middle" font-size="13" font-weight="700">swap area</text>${/* the "swap area" label */''}
                ${disk || '<text x="607" y="150" text-anchor="middle" font-size="13" class="s-sub">no pages of process 7 here:</text><text x="607" y="168" text-anchor="middle" font-size="13" class="s-sub">all of it is in main memory</text>'}${/* process 7's pieces on disk, or a two-line message that none are there */''}
                <rect x="522" y="262" width="170" height="76" rx="7" class="s-panel" stroke-width="1.5"/><text x="607" y="292" text-anchor="middle" font-size="13" font-weight="700">program file</text><text x="607" y="312" text-anchor="middle" font-size="13" class="s-sub">(photo editor code)</text>${/* the program file on disk that holds the photo editor's code */''}
              </svg>`;  // ends the wide drawing
            }  // ends the phone/wide choice
            PARTS.forEach((p) => {  // updates each of the four part buttons
              const b = btns[p.k], on = added.has(p.k);  // b is the button; on says whether its part has been added
              b.innerHTML = `<span class="s33-sw" style="background:${p.sw};border-color:${p.bd}"></span>${p.name}${on ? ' ✓' : ''}`;  // the button shows a colour swatch, the part name and a tick once added
              b.classList.toggle('on', on);  // class on marks the button as pressed once its part is added
            });  // ends the loop over buttons
            const done = added.size === 4;  // done: true when all four parts are in the image
            say.innerHTML = (last ? P[last].say : `<b>Click a part</b> to add it to process 7's image. It appears in the memory diagram ${NW ? 'below' : 'on the right'}.`)  // explanation card: the last part's text, or a hint that parts appear below (phone) or on the right
              + (done ? '<div style="margin-top:6px"><span class="s33-ok">✓ Complete:</span> that is the whole <b>process image</b>. Now compare both layouts.</div>' : '');  // plus a "Complete" message once all four parts are in
            count.textContent = `${added.size} of 4 parts added · click one to re-read it`;  // updates the "n of 4 parts added" text
            cap.innerHTML = layout === 'contig'  // caption under the drawing, depending on the layout
              ? '<b>One contiguous block.</b> The whole image fills one unbroken run of frames (6–12), so a single pointer to its start (0x6000) is enough. The catch: the OS must find one gap big enough, and the whole image must be brought in before the process can run.'  // contiguous caption: one pointer is enough, but it needs one big gap and must be fully loaded to run
              : '<b>Paged.</b> The image is cut into equal-size pages, each placed in any free <span class="t" data-t="Frame">frame</span>. Pages not needed right now (program p1, data p2) wait on disk. The process table leads to the PCB, and the PCB points to the map of every page.';  // paged caption: equal pages in any free frames, unused ones on disk, and the PCB points to the page map
            ctx.refit();  // asks the guide to re-check that the step still fits on the screen now that its contents changed
          }  // ends paint()
          el.append(h('div', { class: 'split l3 fill' },  // builds the layout: class l3 gives the left column one third of the width and the drawing two thirds
            h('div', { class: 'stack', style: { gap: '10px' } },  // left column, stacked top to bottom
              h('p', { class: 'm0', html: 'A <span class="t">process image</span> is everything that makes up one process. Build the image of process 7, a photo editor, by clicking its four parts:' }),  // intro paragraph: a process image is everything that makes up a process; build process 7's
              grid, say,  // the part buttons and the explanation card
              h('div', { class: 'callout why small m0', 'data-label': 'The location rule', html: 'The OS can manage a process only while at least its PCB is in main memory, and can <i>run</i> it only when the parts in use are there too. So it must track where every part of every image is.' }),  // location-rule callout: the PCB must be in memory to manage a process, and the parts in use to run it
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, count, reset)),  // bottom row with the parts count and the Start over button; closes the left column
            h('div', { class: 'stack', style: { gap: '8px' } }, h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', { class: 'small' }, 'Where does the image live?'), seg), svgBox, cap)));  // right column: a heading with the layout switch, then the drawing and its caption; closes the layout
          paint();  // draws everything for the first time when the step opens
        },  // ends render() for step 4
      },  // closes step 4
      /* ---------------- 5. Inside the PCB: three groups of attributes (+ sort game) ---------------- */
      {  // opens step 5
        title: 'Inside the PCB: three groups of attributes',  // step 5 title
        kind: 'explore',  // kind explore: a step for free clicking and exploring
        core: true,  // core: keeps this step on the shorter core path
        render(el, ctx) {  // render(el, ctx): builds the tabbed PCB explorer and the sort game when step 5 is shown
          const { h } = ctx;  // takes h, the element-building helper, out of ctx
          const GROUPS = [  // GROUPS: the three groups of PCB attributes; each row is [field, example value in PCB 7, what it is for]
            { k: 'id', name: 'Process identification', short: 'Identification', color: 'proc', fields: ['process ID', 'parent ID', 'user ID'],  // group 1, process identification: its key, names, colour and the fields listed on its band
              intro: '<span class="t">Process identification</span>: numbers that say <b>who</b> this process is. They are small, but every other table uses them to refer to the process.',  // intro text for identification: the numbers that say who the process is
              rows: [  // the identification rows follow
                ['Process identifier', '7', 'A unique number for this process. The memory, I/O and file tables refer to the process by it, and it often doubles as its position in the process table.'],  // process identifier row: 7, the number every other table uses for this process
                ['Parent identifier', '2 (the desktop shell)', 'The process that created this one. The OS uses it to keep the family tree and to tell the parent when this child ends.'],  // parent identifier row: 2, the desktop shell that created process 7
                ['User identifier', '1004 (maria)', 'The user this process works for. It decides what the process may touch, for example which files it may open.'],  // user identifier row: 1004 (maria), which decides what the process may touch
              ] },  // closes the identification rows and group 1
            { k: 'cpu', name: 'Processor state information', short: 'Processor state', color: 'cpu', fields: ['user-visible registers', 'program counter', 'condition codes', 'status bits', 'stack pointers'],  // group 2, processor state information: its key, names, colour and band fields
              intro: '<span class="t">Processor state information</span> is a copy of the processor registers, saved when process 7 was last interrupted and loaded back when it resumes (while it runs, the values live in the processor itself). Three kinds: user-visible registers, <span class="t" data-t="Control and status registers">control and status registers</span> (the middle three rows) and stack pointers.',  // intro text for processor state: the saved copy of the registers, in three kinds
              rows: [  // the processor state rows follow
                ['<span class="t">User-visible registers</span>', 'R0 = 42, R1 = 0x9A10, … R7', 'The general-purpose registers the program\'s own instructions use (often 8 to 32 of them).'],  // user-visible registers row: R0 to R7, the registers the program's own instructions use
                ['Program counter<div class="xs muted">control / status</div>', '0x7124', 'The address of the next instruction. Restoring it makes the process resume at exactly the right spot.'],  // program counter row (a control/status register): the next instruction's address, 0x7124
                ['Condition codes<div class="xs muted">control / status</div>', 'zero 0 · sign 1 · carry 0 · overflow 0', 'Result flags of the last arithmetic or logic instruction (sign, zero, carry, equal, overflow). A pending "jump if equal" depends on them.'],  // condition codes row: the result flags of the last arithmetic or logic instruction
                ['Status information<div class="xs muted">control / status</div>', 'interrupts enabled · user mode', 'Whether interrupts are enabled or disabled, and the execution mode. With the condition codes, these form the program status word.'],  // status information row: interrupts enabled and user mode; with the flags these make the PSW
                ['Stack pointers', 'user 0xCFF0 · system 0x0F80', 'Where the top of each stack is (the user stack and the stack the OS uses for this process), so calls in progress can return correctly.'],  // stack pointers row: where the tops of the user stack and the system stack are
              ] },  // closes the processor state rows and group 2
            { k: 'ctl', name: 'Process control information', short: 'Process control', color: 'os', fields: ['scheduling + state', 'data structuring', 'communication', 'privileges', 'memory management', 'resources used'],  // group 3, process control information: its key, names, colour and band fields
              intro: '<span class="t">Process control information</span> is everything else the OS needs to <b>manage and coordinate</b> the process: when it may run, what it is linked to, what it may do and what it owns.',  // intro text for process control: everything else the OS needs to manage the process
              rows: [  // the process control rows follow
                ['Scheduling and state', 'Blocked · priority 12 · waited 340 ms · waiting for: disk read', 'Its state, its priority, facts the scheduler uses (such as time spent waiting) and the event it is waiting for.'],  // scheduling and state row: Blocked, priority 12, time waited, and the event it waits for
                ['Data structuring', 'next in disk queue → PCB 9 · parent → PCB 2 · children → 11, 12', 'Pointers to other PCBs: the queue it sits in and its parent and child links. This is how the OS builds lists and family trees.'],  // data structuring row: pointers to other PCBs (its queue, parent and children)
                ['<span class="t">Interprocess communication</span>', '1 signal pending · 2 messages waiting', 'Flags, signals and messages exchanged with other processes.'],  // interprocess communication row: pending signals and messages
                ['<span class="t">Process privileges</span>', 'own frames + shared lib (read-only) · no privileged instructions · print service allowed', 'Which memory it may access, which kinds of instructions it may execute, and which system services it may use.'],  // process privileges row: which memory, instructions and system services it may use
                ['Memory management', '→ P7 memory map (page table)', 'Pointers to its segment and/or page tables: the maps that say where each piece of its memory is, in a frame or on disk.'],  // memory management row: the pointer to its page table
                ['Resource ownership and utilization', 'open: photo.raw, settings.cfg · processor time 1.2 s', 'Resources it controls, such as open files, and a history of its use of the processor and other resources.'],  // resource ownership and utilization row: open files and processor time used
              ] },  // closes the process control rows and group 3
          ];  // closes GROUPS
          let tabs = null;  // tabs: the tab set, made further down; declared here so the band buttons can switch tabs
          const mini = h('div', { class: 's33-mini' });  // mini: the small PCB picture in the left column
          const paintMini = (cur) => {  // paintMini(cur): redraws the small picture with band cur highlighted; runs whenever the tab changes
            mini.innerHTML = '';  // empties the picture before rebuilding it
            mini.append(h('div', { class: 'xs muted b', style: { textAlign: 'center' } }, 'PCB of process 7'));  // the caption above the bands: "PCB of process 7"
            GROUPS.forEach((g, i) => mini.append(h('button', { type: 'button', class: 's33-band ' + g.color + (cur === i ? ' on' : ''), onclick: () => tabs.show(i) },  // one band button per group, ringed when its tab is open; clicking it opens that group's tab
              h('b', {}, g.short), h('span', { class: 'xs' }, g.fields.join(' · ')))));  // each band shows its group's short name and the fields it holds
            mini.append(h('div', { class: 'xs muted', style: { textAlign: 'center' }, html: cur === 3 ? 'Sort game: use the<br>three groups above.' : 'Click a band or a tab.' }));  // a hint under the bands: while the sort game (tab 4, index 3) is open it points at the groups, otherwise it invites a click
          };  // ends paintMini()
          const groupPanel = (g) => (p) => {  // groupPanel(g): returns the function that fills a tab panel with group g's contents
            p.append(h('div', { class: 'stack', style: { gap: '8px' } },  // adds a stack to the tab panel p
              h('p', { class: 'm0 small', html: g.intro }),  // the group's intro paragraph
              h('table', { class: 'tbl compact s33-pcbt' },  // the table of the group's fields
                h('tr', {}, h('th', {}, 'Field'), h('th', {}, 'Value in PCB 7'), h('th', {}, 'What it is for')),  // header row: Field, Value in PCB 7, What it is for
                ...g.rows.map(([f, v, w]) => h('tr', {}, h('td', { class: 'b', html: f }), h('td', { class: 'mono' }, v), h('td', { html: w })))),  // one row per field: its name (may contain a glossary link), its value in fixed-width type, and its purpose
              g.k === 'cpu' ? h('div', { class: 'callout why small m0', 'data-label': 'Why save them?', html: 'If process 7 is stopped between comparing two numbers and jumping on the result, the next process will overwrite the flags. Without the saved copy, process 7 would resume and take the wrong branch. The next step shows these flags inside x86\'s PSW, EFLAGS.' }) : null,  // only for processor state: a callout on why the flags must be saved between compare and jump
              g.k === 'id' ? h('div', { class: 'callout tip small m0', 'data-label': 'Cross-reference', html: 'In the OS’s tables, an I/O entry reads "Disk 0 · for 2" and a file entry reads "open: 2". That 2 is a process identifier. IDs are the glue between the tables.<br>The eight PCB elements of section 3.1 all fit these groups: the identifier here; program counter and context data under processor state; state, priority, memory pointers, I/O status and accounting under process control.' }) : null,  // only for identification: a callout showing IDs as the glue between tables, and how section 3.1's PCB list fits
              g.k === 'id' ? h('div', { class: 'callout warn small m0', 'data-label': 'Common mistake', html: 'A process ID is not the program\'s name. Open the photo editor twice and you get two processes with two different IDs, two images and two PCBs, all running the same code.' }) : null,  // only for identification: common mistake, a process ID is not the program's name
              g.k === 'ctl' ? h('div', { class: 'callout warn small m0', 'data-label': 'Common mistake', html: '"Processor time used" sounds like processor state, but it is not a register. It is a usage record the OS keeps for scheduling and accounting, so it belongs to process control information.' }) : null));  // only for process control: common mistake, processor time used is a usage record, not a register; closes the stack
          };  // ends groupPanel()
          const host = h('div', { style: { minHeight: 0, height: '100%' } });  // host: the box that will hold the tabs, using the full height
          el.append(h('div', { class: 'split s33-psplit fill' }, mini, host));  // step layout: the small PCB picture beside the tabs host (column widths from s33-psplit)
          tabs = ctx.ui.tabs([  // creates the tab set with the guide's tabs helper: a strip of tab buttons over one panel
            ...GROUPS.map((g, i) => ({ label: `${i + 1} · ${g.short}`, render: groupPanel(g) })),  // one tab per group, labelled like "1 · Identification" and filled by groupPanel
            { label: 'Sort game ▶', render: (p) => sortGame(p) },  // a fourth tab that holds the sort game
          ], { onChange: (i) => paintMini(i) });  // when the tab changes, the small picture is redrawn to match
          host.append(tabs);  // puts the tab set into the host box
          function sortGame(p) {  // sortGame(p): builds the sort game inside tab panel p; runs each time that tab is opened
            const ITEMS = [  // ITEMS: the 15 fields to sort, each [text, right group (0 identification, 1 processor state, 2 control), explanation]
              ['ID of this process', 0, 'It names the process, so it is identification.'],  // field: this process's ID (identification)
              ['ID of the parent process', 0, 'Still an identifier, just of the process that created this one.'],  // field: the parent's ID (identification)
              ['ID of the user it runs for', 0, 'The user ID is part of process identification.'],  // field: the user's ID (identification)
              ['Program counter', 1, 'It is a processor register, so it is saved with the processor state.'],  // field: program counter (processor state)
              ['Condition codes', 1, 'These result bits live in a processor register (the PSW).'],  // field: condition codes (processor state)
              ['Interrupts enabled/disabled flag', 1, 'A status bit inside the processor, part of the PSW.'],  // field: interrupts enabled/disabled flag (processor state)
              ['Execution mode (user or kernel)', 1, 'The current mode is status information held in the processor.'],  // field: execution mode (processor state)
              ['General-purpose register values', 1, 'User-visible registers are processor state.'],  // field: general-purpose register values (processor state)
              ['Process state (Ready, Blocked…)', 2, 'The scheduling state is not a register; the OS uses it to manage the process.'],  // field: process state such as Ready or Blocked (process control)
              ['Priority', 2, 'Priority is scheduling information: process control.'],  // field: priority (process control)
              ['Pointer to the next PCB in its queue', 2, 'A data-structuring link the OS uses to build queues.'],  // field: pointer to the next PCB in its queue (process control)
              ['Pending signals and messages', 2, 'Interprocess communication belongs to process control.'],  // field: pending signals and messages (process control)
              ['Pointer to its page table', 2, 'Memory-management information is process control.'],  // field: pointer to its page table (process control)
              ['List of open files', 2, 'Resource ownership is process control information.'],  // field: list of open files (process control)
              ['Processor time used so far', 2, 'Tricky: it mentions the processor, but it is a usage record the OS keeps (resource utilization), not a register.'],  // field: processor time used, the tricky one: a usage record, so process control
            ];  // closes ITEMS
            const rnd = ctx.util.seeded(33);  // rnd: a random-number maker with a fixed seed (33), so the tray has the same order on every visit
            const order = ctx.util.shuffle(ITEMS.map((_, i) => i), rnd);  // order: the item numbers shuffled with rnd; the tray shows fields in this order
            const placed = new Map();  // placed: the items sorted correctly so far, each mapped to its group
            const missed = new Set();  // missed: items that were dropped in a wrong group at least once, so they no longer count as first try
            let sel = null;  // sel: the item picked in the tray, or null when none is picked
            const score = h('span', { class: 'chip accent' });  // score: the chip showing how many fields are sorted
            const tray = h('div', { class: 's33-tray' });  // tray: the row of fields still waiting to be sorted
            const fb = h('div', { class: 'card tight small', style: { minHeight: '48px' } });  // fb: the feedback card under the buckets
            const bucketEls = GROUPS.map((g, b) => h('div', { class: `card ${g.color} s33-bucket`, role: 'button', tabindex: 0, 'aria-label': 'Put the selected field in ' + g.name, onclick: () => drop(b), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); drop(b); } } }));  // bucketEls: one clickable card per group in its group's colour; click, Enter or Space drops the picked field into it
            function drop(b) {  // drop(b): tries to put the picked field into bucket b
              if (sel == null) { fb.innerHTML = '<b>First pick a field</b> from the tray, then click the group it belongs to.'; return; }  // with no field picked, it tells the student to pick one first and stops
              const [text, ans, why] = ITEMS[sel];  // unpacks the picked item into its text, right group and explanation
              if (b === ans) {  // the field went into the right group
                placed.set(sel, b);  // records it as sorted
                fb.innerHTML = `<span class="s33-ok">✓ ${text}</span> belongs to <b>${GROUPS[b].name}</b>. ${why}`;  // feedback: a tick, the field, its group and why
                sel = null;  // clears the pick
              } else {  // otherwise the group was wrong
                missed.add(sel);  // remembers the miss for the first-try count
                fb.innerHTML = `<span class="s33-no">✗ Not ${GROUPS[b].short.toLowerCase()}.</span> ${why.startsWith('Tricky') ? 'Think about who keeps it and why.' : 'Ask: is it a name, a processor register, or something the OS uses to manage the process?'}`;  // feedback: a cross and the group missed; the tricky item gets its own hint, the others a question to ask about the field
                bucketEls[b].classList.remove('flash'); void bucketEls[b].offsetWidth; bucketEls[b].classList.add('flash');  // replays the red flash on the wrong bucket: remove the class, read offsetWidth so the browser notices, add it again
              }  // ends the right/wrong branches
              paint();  // redraws the game after every drop
            }  // ends drop()
            function paint() {  // paint(): redraws the tray, the buckets and the score
              tray.innerHTML = '';  // empties the tray before refilling it
              const left = order.filter((i) => !placed.has(i));  // left: the fields not yet sorted, in tray order
              left.forEach((i) => tray.append(h('button', { type: 'button', class: 'btn sm' + (sel === i ? ' on' : ''), onclick: () => { sel = sel === i ? null : i; paint(); } }, ITEMS[i][0])));  // one button per unsorted field; the picked one looks pressed, and clicking picks or unpicks it
              if (!left.length) tray.append(h('div', { class: 'small', html: `<b>All sorted!</b> ${ITEMS.length - missed.size} of ${ITEMS.length} placed right on the first try.` }));  // when the tray is empty, shows "All sorted!" with the first-try count
              GROUPS.forEach((g, b) => {  // redraws each of the three buckets
                const el2 = bucketEls[b];  // el2: this bucket's card
                el2.innerHTML = '';  // empties the bucket before refilling it
                el2.append(h('div', { class: 'b small' }, g.name), h('div', { class: 's33-dropped' }, ...order.filter((i) => placed.get(i) === b).map((i) => h('span', { class: 'chip ' + g.color }, ITEMS[i][0]))));  // the bucket shows its group name and a chip for each field already sorted into it
                el2.classList.toggle('armed', sel != null);  // while a field is picked, the bucket gets a dashed outline (armed) to invite a click
              });  // ends the loop over buckets
              score.textContent = `${placed.size} / ${ITEMS.length} sorted`;  // updates the score chip, such as "6 / 15 sorted"
            }  // ends paint()
            const again = h('button', { class: 'btn sm ghost', type: 'button', onclick: () => { placed.clear(); missed.clear(); sel = null; fb.innerHTML = 'Pick a field, then click its group.'; paint(); } }, 'Start over');  // again: the Start over button clears the sorted fields, misses, pick and feedback, then redraws
            fb.innerHTML = 'Pick a field from the tray, then click the group it belongs to.';  // the starting feedback text
            p.append(h('div', { class: 'stack fill', style: { gap: '8px' } },  // builds the game's layout inside the tab panel
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'small', html: 'Which of the three groups does each field belong to?' }), h('div', { class: 'row' }, score, again)),  // top row: the question on the left, the score chip and Start over on the right
              tray, h('div', { class: 'grid-3 grow', style: { gap: '10px' } }, ...bucketEls), fb));  // then the tray, a three-column grid of buckets, and the feedback card; closes the layout
            paint();  // draws the game for the first time
          }  // ends sortGame()
        },  // ends render() for step 5
      },  // closes step 5
      /* ---------------- 6. The program status word: x86 EFLAGS lab ---------------- */
      {  // opens step 6
        title: 'The program status word: watch EFLAGS change',  // step 6 title
        kind: 'lab',  // kind lab: a hands-on step
        render(el, ctx) {  // render(el, ctx): builds the EFLAGS lab when step 6 is shown
          const { h } = ctx;  // takes h, the element-building helper, out of ctx
          let op = 'add', A = 200, B = 100;  // op is the operation ('add' or 'sub'); A and B are the two 8-bit inputs, starting at 200 and 100
          const sgn = (v) => (v > 127 ? v - 256 : v);  // sgn(v): reads an 8-bit value as a signed two's complement number, so 128-255 become v - 256
          const sn = (v) => (v < 0 ? '−' + -v : String(v));  // sn(v): writes a number with a proper minus sign when it is negative
          const bits8 = (v) => { const b = v.toString(2).padStart(8, '0'); return b.slice(0, 4) + ' ' + b.slice(4); };  // bits8(v): writes v as 8 binary digits with a space in the middle
          function alu() {  // alu(): works out the result and every flag, the job of the processor's arithmetic logic unit (ALU)
            const raw = op === 'add' ? A + B : A - B;  // raw: the exact answer before it is cut down to 8 bits
            const r = ((raw % 256) + 256) % 256;  // r: the 8-bit result, raw wrapped into 0-255 (the double % also handles a negative raw from SUB)
            const sa = sgn(A), sb = sgn(B), sr = sgn(r);  // the signed readings of A, B and the result
            const CF = op === 'add' ? +(raw > 255) : +(A < B);  // CF (carry): for ADD, 1 when the sum is above 255; for SUB, 1 when A is less than B, which needs a borrow
            const OF = op === 'add' ? +((A & 128) === (B & 128) && (r & 128) !== (A & 128)) : +((A & 128) !== (B & 128) && (r & 128) !== (A & 128));  // OF (overflow): ADD overflows when A and B share a sign bit that the result lacks; SUB when A and B differ and the result's sign differs from A
            let ones = 0; for (let x = r; x; x >>= 1) ones += x & 1;  // counts the 1 bits of the result, for the parity flag
            return { raw, r, sa, sb, sr, CF, ZF: +(r === 0), SF: r >> 7, OF, PF: +(ones % 2 === 0), AF: +(((A ^ B ^ r) & 16) !== 0) };  // returns it all: ZF if the result is 0, SF the top bit, PF if the count of ones is even, AF if bit 3 carried into bit 4
          }  // ends alu()
          // EFLAGS low 16 bits, from bit 15 down to bit 0: [label, key, kind]
          const LAYOUT = [['0', 'r15', 'res'], ['NT', 'NT', 'ctl'], ['IOPL', 'IOPL', 'ctl', 2], ['OF', 'OF', 'cc'], ['DF', 'DF', 'ctl'], ['IF', 'IF', 'ctl'], ['TF', 'TF', 'ctl'], ['SF', 'SF', 'cc'], ['ZF', 'ZF', 'cc'], ['0', 'r5', 'res'], ['AF', 'AF', 'cc'], ['0', 'r3', 'res'], ['PF', 'PF', 'cc'], ['1', 'r1', 'res'], ['CF', 'CF', 'cc']];  // LAYOUT: the 15 boxes of the strip from bit 15 down, each [label, key, kind]; IOPL's extra 2 means it spans two bits
          const BITINFO = {  // BITINFO: the text shown under the strip when a bit is clicked
            CF: '<b>CF, carry (bit 0).</b> An unsigned result did not fit: a carry out of the top bit on ADD, or a borrow on SUB.',  // text for CF, the carry flag
            PF: '<b>PF, parity (bit 2).</b> 1 when the low byte of the result has an even number of 1 bits.',  // text for PF, the parity flag
            AF: '<b>AF, auxiliary carry (bit 4).</b> A carry out of bit 3, used by decimal (BCD) arithmetic instructions.',  // text for AF, the auxiliary carry flag
            ZF: '<b>ZF, zero (bit 6).</b> The result was 0. After SUB or CMP this means the two values were equal.',  // text for ZF, the zero flag, which means equal after SUB
            SF: '<b>SF, sign (bit 7).</b> A copy of the top bit of the result: 1 means negative when read as a signed number.',  // text for SF, the sign flag
            TF: '<b>TF, trap (bit 8).</b> When 1, the processor raises a debug exception after every instruction, handing control to a debugger. That is how single-stepping works.',  // text for TF, the trap flag that makes single-stepping in a debugger work
            IF: '<b>IF, interrupt enable (bit 9).</b> When 1, the processor responds to (maskable) interrupt requests from devices; when 0 they wait. Ordinary programs are normally not allowed to change it; the OS is.',  // text for IF, the interrupt enable flag, which the OS controls
            DF: '<b>DF, direction (bit 10).</b> Whether string instructions (which copy or scan a run of bytes) step up or down through memory.',  // text for DF, the direction flag for string instructions
            OF: '<b>OF, overflow (bit 11).</b> A signed result did not fit (for 8-bit values: outside −128 to 127).',  // text for OF, the overflow flag
            IOPL: '<b>IOPL, I/O privilege level (bits 12–13).</b> How privileged code must be to use I/O instructions directly.',  // text for IOPL, the I/O privilege level
            NT: '<b>NT, nested task (bit 14).</b> Used by the processor\'s built-in hardware task-switching feature.',  // text for NT, the nested task flag
            res: '<b>Reserved bit.</b> Fixed by the processor (bit 1 always reads 1, bits 3, 5 and 15 read 0).',  // text for the reserved bits that are fixed at 0 or 1
            high: '<b>Bits 16–31.</b> More control bits (RF resume, VM virtual-8086 mode, AC alignment check, VIF, VIP and ID) and, above bit 21, reserved bits.',  // text for the upper bits 16-31
            guide: '<b>Click any bit to read its job.</b> This lab needs only the four condition codes CF, ZF, SF and OF (plus IF, which the OS uses). The faded bits NT, IOPL, DF, TF, AF and PF have other jobs you can skip for now.',  // the starting text before any bit is clicked
          };  // closes BITINFO
          const DIM = new Set(['NT', 'IOPL', 'DF', 'TF', 'AF', 'PF', 'res']);  // DIM: the bits drawn faded because this lab does not need them
          let info = 'guide';  // info: the key of the bit whose text is showing; it starts with the guide text
          const opSeg = ctx.ui.seg([{ value: 'add', label: 'ADD  A + B' }, { value: 'sub', label: 'SUB  A − B' }], op, (v) => { op = v; paint(); });  // opSeg: a switch between ADD and SUB; switching recomputes everything
          const sA = ctx.ui.slider({ label: 'A', min: 0, max: 255, value: A, onInput: (v) => { A = v; paint(); } });  // sA: a slider for A from 0 to 255 (the guide's slider: a labelled range control with a value readout); moving it recomputes
          const sB = ctx.ui.slider({ label: 'B', min: 0, max: 255, value: B, onInput: (v) => { B = v; paint(); } });  // sB: the slider for B, working the same way
          const PRESETS = [['add', 5, 3], ['add', 200, 100], ['add', 100, 50], ['sub', 7, 7], ['sub', 3, 5], ['sub', 128, 1]];  // PRESETS: six ready-made examples [op, A, B] that show interesting flag patterns
          const presets = h('div', { class: 'row', style: { gap: '6px' } }, h('span', { class: 'xs muted b' }, 'TRY:'),  // the presets row: a "TRY:" label followed by one button per example
            ...PRESETS.map(([o, a, b]) => h('button', { class: 'btn sm', type: 'button', onclick: () => { op = o; A = a; B = b; opSeg.set(o); sA.set(a); sB.set(b); paint(); } }, `${a} ${o === 'add' ? '+' : '−'} ${b}`)));  // each preset button sets op, A and B, moves the switch and sliders to match, and recomputes; its label reads like "200 + 100"
          const arith = h('div', { class: 'card white tight s33-alu' });  // arith: the card for the arithmetic table
          const strip = h('div', { class: 'card white tight', style: { padding: '6px 10px' } });  // strip: the card for the EFLAGS bit drawing
          const bitInfo = h('div', { class: 'small', style: { minHeight: '42px', marginTop: '2px' } });  // bitInfo: the text under the strip that explains the clicked bit
          const cards = h('div', { class: 'grid-4', style: { gap: '8px' } });  // cards: a four-column grid of the flag cards (CF, ZF, SF, OF)
          const CH = [  // CH: the four challenges, each [text, test on the flags]
            ['ZF = 1 using <b>ADD</b>', (f) => op === 'add' && f.ZF],  // challenge: make ZF = 1 using ADD, which needs the sum to wrap round to 0
            ['OF = 1, CF = 0', (f) => f.OF && !f.CF],  // challenge: overflow without carry
            ['CF = 1, OF = 0', (f) => f.CF && !f.OF],  // challenge: carry without overflow
            ['Show A = B with <b>SUB</b>', (f) => op === 'sub' && f.ZF],  // challenge: show that A equals B using SUB
          ];  // closes CH
          const won = new Set();  // won: the challenges completed so far
          const chal = h('div', { class: 'card tight s33-chal' });  // chal: the challenges bar
          function paint() {  // paint(): recomputes and redraws the whole lab; runs at start and after every change
            const f = alu(), sym = op === 'add' ? '+' : '−';  // f holds the result and flags from alu(); sym is the operator sign to display
            // signed reading in two's complement: top bit set → value − 256 (shown so the rule is visible)
            const sgnTxt = (u, sv) => `signed ${sn(sv)}` + (u > 127 ? ` <span class="xs">(${u} − 256)</span>` : '');  // sgnTxt(u, sv): the signed reading, plus "(u - 256)" when the top bit is set, so the rule is visible
            arith.innerHTML = `<table class="s33-at"><tr><td>A</td><td class="n">${A}</td><td class="m">${bits8(A)}</td><td class="muted">${sgnTxt(A, f.sa)}</td></tr>${/* arithmetic table, row A: its name, decimal value, bits and signed reading */''}
              <tr><td>${sym} B</td><td class="n">${B}</td><td class="m">${bits8(B)}</td><td class="muted">${sgnTxt(B, f.sb)}</td></tr>${/* row B, with the operator in front */''}
              <tr class="res"><td>= result</td><td class="n">${f.r}</td><td class="m">${bits8(f.r)}</td><td class="muted">${sgnTxt(f.r, f.sr)}</td></tr></table>${/* the result row */''}
              <div class="xs muted" style="margin-top:4px">Exact answer: ${A} ${sym} ${B} = ${f.raw}. Only 8 bits fit in the result register${f.raw !== f.r ? `, so it holds ${f.r}` : ''}.</div>`;  // a note with the exact answer and, when it wrapped, what the 8-bit register holds instead
            const val = { ...f, TF: 0, IF: 1, DF: 0, NT: 0, IOPL: 0 };  // val: the values shown in the strip: the computed flags plus fixed control bits (TF 0, IF 1, DF 0, NT 0, IOPL 0)
            const NW = ctx.narrow, CW = NW ? 46 : 42;  // NW is true on a phone-width screen; CW is the width of one bit box
            let x = NW ? 6 : 12, dy = 0, cells = '';  // x is where the next box goes; dy moves the second row down on phones; cells collects the SVG text
            LAYOUT.forEach(([lab, key, kind, span], i) => {  // goes over each box in LAYOUT
              if (NW && i === 7) { x = 6; dy = 84; }  // on phones, the boxes from bit 7 down start a second row
              const w = (span || 1) * CW - 4, v = kind === 'res' ? lab : (key === 'IOPL' ? '00' : val[key]);  // w: the box width (double for IOPL); v: what goes inside (the fixed digit, "00" for IOPL, or the flag's value)
              const bitNo = 15 - i - (i > 2 ? 1 : 0);  // bitNo: the bit number over the box; boxes after IOPL are one lower because IOPL covers two bits
              const on = kind === 'cc' && val[key] === 1;  // on: true for a condition code that is 1
              const cls = kind === 'cc' ? (on ? 's-cpu' : 's-panel') : kind === 'ctl' ? 's-os' : 's-panel';  // cls: the box colour; a set condition code gets processor colours, control bits OS colours, the rest plain panel
              const ik = kind === 'res' ? 'res' : key;  // ik: the key used for the click text and fading; every reserved bit shares the key 'res'
              const dim = DIM.has(ik) && info !== ik ? ' dim' : '';  // dim: fades the bits this lab does not need, except the one whose text is showing
              cells += `<g class="hot${dim}" role="button" tabindex="0" data-b="${ik}" aria-label="${lab} bit">${/* each box is a clickable group that takes keyboard focus; data-b holds its key for the click handler */''}
                <text x="${x + w / 2}" y="${30 + dy}" text-anchor="middle" font-size="13" class="s-sub">${span ? '13–12' : bitNo}</text>${/* the bit number above the box ("13-12" for the two-bit IOPL) */''}
                <rect x="${x}" y="${36 + dy}" width="${w}" height="34" rx="6" class="${cls}" stroke-width="${on || info === ik ? 3 : 1.5}" ${info === ik ? 'style="stroke:var(--accent)"' : ''}/>${/* the box itself: thicker outline when set or when it is the bit being explained, accent outline for the explained bit */''}
                <text x="${x + w / 2}" y="${59 + dy}" text-anchor="middle" font-size="17" font-weight="800" ${on ? 'style="fill:var(--cpu)"' : ''}>${v}</text>${/* the value inside the box, coloured like the processor when the flag is set */''}
                <text x="${x + w / 2}" y="${88 + dy}" text-anchor="middle" font-size="13" font-weight="${kind === 'cc' ? 800 : 500}" ${kind === 'res' ? 'class="s-sub"' : ''}>${kind === 'res' ? '·' : lab}</text></g>`;  // the label under the box (a dot for reserved bits); closes the group
              x += w + 4;  // moves x past this box to where the next one starts
            });  // ends the loop over boxes
            const VW = NW ? 380 : 720;  // VW: the drawing's width, 380 on phones and 720 on wide screens
            strip.innerHTML = `<svg viewBox="0 0 ${VW} ${NW ? 180 : 96}" width="100%" role="img" aria-label="Low 16 bits of the EFLAGS register">${/* starts the strip's SVG; it is taller on phones to fit two rows of boxes */''}
              <text x="${NW ? 6 : 12}" y="13" font-size="13" font-weight="800">EFLAGS, bits 15 → 0</text>${/* the strip title: EFLAGS, bits 15 down to 0 */''}
              ${NW ? '' : `<text x="372" y="13" text-anchor="middle" font-size="13"><tspan style="fill:var(--cpu)" font-weight="700">blue</tspan> = flag set · <tspan style="fill:var(--os)" font-weight="700">violet</tspan> = OS control bit · <tspan class="s-sub">faded</tspan> = not needed here</text>`}${/* the colour key line, drawn only on wide screens (phones get it under the strip) */''}
              <g class="hot" role="button" tabindex="0" data-b="high"><text x="${VW - 12}" y="13" text-anchor="end" font-size="13" class="s-sub" ${info === 'high' ? 'style="fill:var(--accent)" font-weight="800"' : ''}>bits 16–31 ▸</text></g>${/* a clickable "bits 16-31" label at the top right, highlighted while its text is showing */''}
              ${cells}</svg>`;  // adds the boxes and ends the strip's SVG
            bitInfo.innerHTML = `<div>${BITINFO[info]}</div>` + (NW ? '<div class="xs muted">Blue = condition code set by the last result · violet = control bit set by the OS · faded = not needed in this lab.</div>' : '');  // the text under the strip: the clicked bit's job, plus the colour key on phones
            const why = {  // why: a one-line explanation for each of the four main flags, worked out from the current numbers
              CF: op === 'add' ? (f.CF ? `${A} + ${B} = ${f.raw}, more than 255: the carry out of bit 7 lands in CF.` : `${A} + ${B} = ${f.raw} fits in 8 bits (at most 255).`) : (f.CF ? `${A} is less than ${B} (unsigned), so a borrow was needed.` : `${A} ≥ ${B} (unsigned): no borrow needed.`),  // CF explanation: whether the sum passed 255 (ADD) or a borrow was needed (SUB)
              ZF: f.ZF ? (op === 'sub' ? 'The result is 0, so A and B are <b>equal</b>. "Jump if equal" tests this bit.' : (f.raw !== f.r ? `The 8-bit result is 0: the true sum ${f.raw} wrapped around to 0.` : 'The result is 0.')) : (op === 'sub' ? 'The result is not 0, so A ≠ B.' : 'The result is not 0.'),  // ZF explanation: equal values after SUB, a sum that wrapped to 0 after ADD, or simply not zero
              SF: f.SF ? `Bit 7 of the result is 1: read as signed, the result (${sn(f.sr)}) is negative.` : 'Bit 7 of the result is 0: as a signed number it is not negative.',  // SF explanation: whether bit 7 of the result makes it negative when read as signed
              OF: `Signed: ${sn(f.sa)} ${sym} ${f.sb < 0 ? '(' + sn(f.sb) + ')' : sn(f.sb)} = ${sn(op === 'add' ? f.sa + f.sb : f.sa - f.sb)}, ` + (f.OF ? 'outside −128…127, so the signed answer is wrong.' : 'which fits in −128…127.'),  // OF explanation: the signed sum written out, then whether it fits in -128 to 127
            };  // closes why
            cards.innerHTML = ['CF', 'ZF', 'SF', 'OF'].map((k) => `<div class="card tight s33-flag${f[k] ? ' set' : ''}"><div class="row" style="justify-content:space-between;align-items:baseline"><span><b>${k}</b> <span class="xs">${{ CF: 'carry', ZF: 'zero', SF: 'sign', OF: 'overflow' }[k]}</span></span><span class="s33-fv">${f[k]}</span></div><div class="s33-fw">${why[k]}</div></div>`).join('');  // builds the four flag cards: name, meaning, value and explanation; cards for set flags get class set
            CH.forEach(([, test], i) => { if (test(f)) won.add(i); });  // marks as won any challenge whose test passes now; won challenges stay won
            chal.innerHTML = `<div><b class="small">Challenges</b> <span class="chip ${won.size === CH.length ? 'ok' : 'accent'}">${won.size} / ${CH.length}</span></div>` +  // challenges bar heading with a count chip that turns green once all four are done
              CH.map(([t], i) => `<div class="small">${won.has(i) ? '<span class="s33-ok">✓</span>' : '<span class="muted">○</span>'} ${t}</div>`).join('');  // each challenge with a tick if won or a hollow circle if not
          }  // ends paint()
          const pick = (e) => { const g = e.target.closest('[data-b]'); if (!g) return false; info = g.dataset.b; paint(); return true; };  // pick(e): finds the clicked bit (data-b), shows its text and redraws; returns false when the click missed
          ctx.on(strip, 'click', pick);  // listens for clicks on the EFLAGS strip
          ctx.on(strip, 'keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && pick(e)) e.preventDefault(); });  // Enter or Space on a focused bit acts like a click
          el.append(h('div', { class: 'split s33-fsplit fill' },  // builds the layout: explanations on the left, the lab on the right (widths from s33-fsplit)
            h('div', { class: 'stack', style: { gap: '10px' } },  // left column, stacked top to bottom
              h('p', { class: 'm0', html: '<span class="t">Condition codes</span> and status bits share one register, the <span class="t">program status word (PSW)</span>. On x86 it is the 32-bit <span class="t">EFLAGS</span> register.' }),  // paragraph: condition codes and status bits share one register, the PSW, which is EFLAGS on x86
              h('p', { class: 'm0 small', html: 'Arithmetic instructions set the condition codes; later instructions test them (<i>jump if zero</i>, <i>jump if carry</i>…). The lab uses 8-bit values, like x86\'s AL and BL registers.' }),  // small paragraph: arithmetic sets the flags, later jumps test them; the lab uses 8-bit values
              h('div', { class: 'callout tip small m0', 'data-label': 'Negative numbers: two\'s complement', html: 'x86 does <b>not</b> use the sign-magnitude form from 1.3 (where 8005 hex meant −5). It uses <b>two\'s complement</b>: in 8 bits, a value whose top bit is 1 stands for <b>value − 256</b>. So 200 means 200 − 256 = −56, and 255 means −1.<br><b>CF</b> = the <i>unsigned</i> result did not fit in 0…255.<br><b>OF</b> = the <i>signed</i> result did not fit in −128…127.' }),  // tip callout: x86 stores negatives in two's complement; CF is the unsigned overflow, OF the signed one
              h('div', { class: 'callout why small m0', 'data-label': 'Why the OS cares', html: 'The flags describe the <b>running</b> process\'s last result, so the OS saves EFLAGS in the PCB and restores it before the process runs again.' })),  // why-the-OS-cares callout: EFLAGS is saved in the PCB and restored before the process runs; closes the left column
            h('div', { class: 'stack', style: { gap: '8px' } },  // right column, stacked top to bottom
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, opSeg, presets),  // top row: the ADD/SUB switch and the preset buttons
              h('div', { class: 'grid-2', style: { gap: '18px' } }, sA, sB),  // the A and B sliders side by side
              arith, h('div', {}, strip, bitInfo), cards, chal)));  // the arithmetic table, the strip with its bit text, the flag cards and the challenges; closes the layout
          paint();  // draws the lab for the first time when the step opens
        },  // ends render() for step 6
      },  // closes step 6
      /* ---------------- 7. The PCB at the centre: queues of PCBs and protecting them ---------------- */
      {  // opens step 7
        title: 'Every module touches PCBs: queues and protection',  // step 7 title
        kind: 'lab',  // kind lab: a hands-on step
        render(el, ctx) {  // render(el, ctx): builds the PCB queue lab when step 7 is shown
          const { h } = ctx;  // takes h, the element-building helper, out of ctx
          const MODS = [['sched', 'Scheduler'], ['alloc', 'Resource allocator'], ['intr', 'Interrupt handlers'], ['perf', 'Performance monitor']];  // MODS: the four OS modules drawn across the top, each [key, name]
          const INIT = () => ({ run: 5, ready: [3, 7, 9], disk: [12], cpu: { 3: 20, 5: 30, 7: 10, 9: 0, 12: 50 }, bad: null, lost: [], rewrite: false, lit: [], gate: false });  // INIT(): a fresh start: running PID, ready and disk queues, processor time per PCB, and the bug, redesign and highlight marks
          let S = INIT(), mode = 'direct';  // S: the lab's current state; mode: 'direct' (any routine writes PCBs) or 'handler' (only the PCB handler does)
          const say = h('div', { class: 'card white small grow', style: { lineHeight: '1.5' } });  // say: the narration card that explains each action
          const svgBox = h('div', { class: 'card white tight', style: { display: 'grid', placeItems: 'center' } });  // svgBox: the card that holds the queue drawing
          const B = {};  // B: the action buttons, looked up by key
          const act = (k, label, fn) => (B[k] = h('button', { class: 'btn sm', type: 'button', onclick: fn }, label));  // act(k, label, fn): makes an action button that runs fn and stores it in B under k
          const stateOf = (p) => (S.run === p ? 'Running' : S.ready.includes(p) ? 'Ready' : 'Blocked');  // stateOf(p): the state name for PCB p: Running, Ready or Blocked
          function narrate(html) { say.innerHTML = html; }  // narrate(html): puts a message in the narration card
          function dispatch() {  // dispatch(): moves the PCB at the head of the ready queue onto the processor
            const p = S.ready.shift(); S.run = p; S.lit = ['sched'];  // takes the first PCB off the ready queue, makes it the running one, and lights the scheduler
            narrate(`<b>Dispatch.</b> The scheduler unlinks PCB ${p} from the head of the ready queue (the head pointer now leads to ${S.ready.length ? 'PCB ' + S.ready[0] : 'nothing'}) and the dispatcher loads the processor state saved in it. Process ${p} runs. No PCB was copied or moved.`);  // narration: the PCB is unlinked from the head and its saved processor state is loaded; nothing is copied
          }  // ends dispatch()
          function timeout() {  // timeout(): a clock interrupt ends the running process's time slice
            const p = S.run; S.run = null; S.cpu[p] += 10; S.ready.push(p); S.lit = ['intr', 'sched'];  // the processor goes idle, the process gets 10 ms more processor time, and its PCB joins the tail of the ready queue
            narrate(`<b>Time slice over.</b> A clock interrupt stops process ${p}. Its registers are saved in PCB ${p}, its state becomes Ready, and PCB ${p} is linked onto the tail of the ready queue: the old tail's <i>next</i> field now points at it.`);  // narration: registers saved in the PCB, state Ready, linked onto the tail through the old tail's next field
          }  // ends timeout()
          function block() {  // block(): the running process asks for the disk and must wait
            const p = S.run; S.run = null; S.cpu[p] += 10; S.disk.push(p); S.lit = ['alloc', 'sched'];  // the processor goes idle, 10 ms is added, and the PCB joins the tail of the disk queue
            narrate(`<b>Waiting for the disk.</b> Process ${p} asked to read from the disk. The OS records the request, marks PCB ${p} Blocked (event: disk read) and links it onto the disk queue. Only a few <i>next</i> fields changed.`);  // narration: the request is recorded, the PCB marked Blocked and linked onto the disk queue
          }  // ends block()
          function done() {  // done(): the disk finishes the request at the head of its queue
            const p = S.disk.shift(); S.ready.push(p); S.lit = ['intr'];  // moves the first PCB of the disk queue to the tail of the ready queue and lights the interrupt handlers
            narrate(`<b>Disk finished.</b> The disk interrupt handler unlinks PCB ${p} from the disk queue, marks it Ready and links it onto the tail of the ready queue.`);  // narration: the disk interrupt handler unlinks the PCB, marks it Ready and relinks it
          }  // ends done()
          function monitor() {  // monitor(): the performance monitor reads the usage record in every PCB
            S.lit = ['perf'];  // lights only the performance monitor
            narrate(`<b>Performance monitor.</b> It walks every PCB and reads its usage record (processor time so far): ${Object.entries(S.cpu).map(([p, t]) => `PCB ${p}: ${t} ms`).join(' · ')}.`);  // narration: lists each PCB's processor time so far
          }  // ends monitor()
          function bug() {  // bug(): a buggy interrupt handler writes garbage into the next field of a queued PCB
            const t = S.ready[0] != null ? S.ready[0] : S.disk[0];  // t: the victim, the head of the ready queue, or the head of the disk queue if the ready queue is empty
            const q = S.ready[0] != null ? S.ready : S.disk;  // q: the queue the victim sits in
            S.lit = ['intr'];  // lights the interrupt handlers, since one of them is the culprit
            if (t == null) { narrate('The buggy handler found no queued PCB to damage this time. Put some processes in a queue first.'); return; }  // with no PCB in either queue there is nothing to damage, so it says so and stops
            if (mode === 'handler') {  // in the protected design, the write goes through the PCB handler
              S.gate = true;  // gate = true makes the drawing show the handler refusing
              narrate(`<b>Stopped at the gate.</b> The same buggy routine asked the PCB handler to set PCB ${t}'s <i>next</i> field to 0xBAD. The handler sees that 0xBAD is no PCB's address, refuses, and records who asked, so the bug is easy to find. The queues are untouched.`);  // narration: the handler rejects 0xBAD because it is no PCB's address and records who asked
              return;  // stops here; the queues are untouched
            }  // ends the protected branch
            S.bad = t; S.lost = q.slice(1);  // open design: marks the victim as corrupted and every PCB after it in its queue as lost
            narrate(`<b>Corrupted!</b> A buggy disk interrupt handler wrote garbage (0xBAD) into PCB ${t}'s <i>next</i> field. ` + (S.lost.length ? `The queue now dead-ends at PCB ${t}: ${S.lost.length > 1 ? 'PCBs ' + S.lost.slice(0, -1).join(', ') + ' and ' + S.lost[S.lost.length - 1] : 'PCB ' + S.lost[0]} can never be reached, so ${S.lost.length > 1 ? 'they' : 'it'} will never run again, though nothing is wrong with ${S.lost.length > 1 ? 'them' : 'it'}.` : 'The next routine that walks this queue will follow a garbage pointer and crash.') + ' Which of dozens of routines did it? Nobody can tell.');  // narration: which PCBs can never be reached again (with correct plural words), or a crash warning if none follow
          }  // ends bug()
          function redesign() {  // redesign(): the PCB layout changes, for example one new field
            S.rewrite = true; S.lit = [];  // marks the redesign for the drawing and clears the module lights
            narrate(mode === 'direct'  // the narration depends on the design chosen
              ? '<b>The PCB format changed</b> (say, one new field). Every routine that reads or writes PCBs directly must now be found, rewritten and re-tested: all four modules turn red.'  // open design: every routine that touches PCBs must be rewritten, so all four modules turn red
              : '<b>The PCB format changed.</b> Only the PCB handler knows the layout, so only it is rewritten. The four modules keep calling the handler exactly as before.');  // protected design: only the PCB handler is rewritten
          }  // ends redesign()
          const run = (fn) => () => { S.gate = false; S.rewrite = false; fn(); paint(); };  // run(fn): wraps an action so it clears the last refusal and redesign marks, runs the action, then redraws
          act('disp', 'Dispatch next', run(dispatch)); act('tout', 'Time slice ends', run(timeout)); act('blk', 'Running process asks for disk', run(block));  // makes the Dispatch next, Time slice ends and Running process asks for disk buttons
          act('done', 'Disk finishes', run(done)); act('perf', 'Monitor reads PCBs', run(monitor));  // makes the Disk finishes and Monitor reads PCBs buttons
          act('bug', '⚠ Buggy interrupt handler', run(bug)); act('redo', 'Change the PCB layout', run(redesign));  // makes the Buggy interrupt handler and Change the PCB layout buttons
          B.bug.classList.add('intr');  // gives the bug button the interrupt colour (class intr) so it looks like trouble
          const modeSeg = ctx.ui.seg([{ value: 'direct', label: 'Any routine writes PCBs' }, { value: 'handler', label: 'Only the PCB handler' }], mode, (v) => { mode = v; S = INIT(); narrate(v === 'handler' ? '<b>Protected design.</b> Every PCB read or write now goes through one PCB handler whose only job is to guard PCBs. The price: a small detour on every access, and it works only if every other routine can be trusted to use it. Queues reset; try the buggy handler again.' : '<b>Open design.</b> Any OS routine may read and write PCBs directly. Queues were reset.'); paint(); });  // modeSeg: a switch between the two designs; switching resets the queues and explains the design chosen
          const reset = h('button', { class: 'btn sm ghost', type: 'button', onclick: () => { S = INIT(); narrate('Reset: process 5 running, PCBs 3 → 7 → 9 in the ready queue, PCB 12 in the disk queue.'); paint(); } }, 'Reset');  // reset: the Reset button restores the starting state and says so in the narration

          function pcb(x, y, p, w = 84) {  // pcb(x, y, p, w): draws one PCB box showing its number, its state and its next field
            const lost = S.lost.includes(p), bad = S.bad === p, c = x + w / 2;  // lost: whether this PCB is unreachable; bad: whether it is the corrupted one; c: its centre line
            const q = S.ready.includes(p) ? S.ready : S.disk.includes(p) ? S.disk : null;  // q: the queue this PCB sits in (ready, disk, or none if it is running)
            const nxt = bad ? '0xBAD' : q ? (q[q.indexOf(p) + 1] != null ? q[q.indexOf(p) + 1] : 'null') : 'null';  // nxt: the next field: 0xBAD if corrupted, else the number of the PCB after it, or null at the end or when not queued
            return `<rect x="${x}" y="${y}" width="${w}" height="64" rx="8" class="${lost || bad ? 's-bad' : 's-proc'}" stroke-width="2"/>${/* the box: red when corrupted or unreachable, process colours otherwise */''}
              <text x="${c}" y="${y + 19}" text-anchor="middle" font-size="14" font-weight="800">PCB ${p}</text>${/* the title "PCB n" */''}
              <text x="${c}" y="${y + 37}" text-anchor="middle" font-size="13" class="s-sub">${lost ? 'unreachable' : stateOf(p)}</text>${/* its state, or "unreachable" once a bug has cut it off */''}
              <text x="${c}" y="${y + 55}" text-anchor="middle" font-size="13" font-weight="700" class="s-monot" ${bad ? 'style="fill:var(--bad)"' : ''}>next→${nxt === 'null' ? '∅' : nxt}</text>`;  // its next field in fixed-width type (an empty-set sign for null), red when it holds 0xBAD
          }  // ends pcb()
          // phone layout: each queue is a vertical column of PCBs
          function queueCol(xc, label, q) {  // queueCol(xc, label, q): draws one queue as a column (phone layout): label, head pointer, then PCBs joined by arrows
            let g = `<text x="${xc + 90}" y="284" text-anchor="middle" font-size="14" font-weight="800">${label}</text>${/* the queue's label */''}
              <rect x="${xc + 50}" y="292" width="80" height="30" rx="6" class="s-panel" stroke-width="1.5"/><text x="${xc + 90}" y="312" text-anchor="middle" font-size="13" font-weight="700">head</text>`;  // the head pointer box at the top of the column
            let py = 322;  // py: where the next arrow starts, just below the head box
            q.forEach((p, i) => {  // goes over each PCB in the queue
              const y = 342 + i * 84, broken = S.lost.includes(p);  // y: where this PCB is drawn; broken: whether it is unreachable
              g += `<path d="M${xc + 90} ${py} L${xc + 90} ${y - 3}" class="${broken ? 's-muted' : 's-line'}" ${broken ? 'stroke-dasharray="4 4"' : ''} marker-end="url(#arr${broken ? '-muted' : ''})"/>` + pcb(xc + 30, y, p, 120);  // an arrow down to this PCB (grey and dashed if unreachable), then the PCB box itself
              py = y + 64;  // the next arrow starts at the bottom of this PCB
            });  // ends the loop over PCBs
            if (!q.length) g += `<text x="${xc + 90}" y="350" text-anchor="middle" font-size="13" class="s-sub">empty (head → ∅)</text>`;  // an empty queue shows "empty (head → ∅)" instead
            return g;  // returns the SVG text for the column
          }  // ends queueCol()
          function queueRow(y, label, q) {  // queueRow(y, label, q): draws one queue as a row (wide layout): label, head pointer, then PCBs joined by arrows
            let g = `<text x="160" y="${y - 10}" font-size="14" font-weight="800">${label}</text>${/* the queue's label */''}
              <rect x="160" y="${y + 14}" width="54" height="36" rx="6" class="s-panel" stroke-width="1.5"/><text x="187" y="${y + 37}" text-anchor="middle" font-size="13" font-weight="700">head</text>`;  // the head pointer box at the left of the row
            let px = 214;  // px: where the next arrow starts, at the right edge of the head box
            q.forEach((p, i) => {  // goes over each PCB in the queue
              const x = 238 + i * 104;  // x: where this PCB is drawn; PCBs sit 104 units apart
              const broken = S.lost.includes(p);  // broken: whether this PCB is unreachable
              g += `<path d="M${px} ${y + 32} L${x - 3} ${y + 32}" class="${broken ? 's-muted' : 's-line'}" ${broken ? 'stroke-dasharray="4 4"' : ''} marker-end="url(#arr${broken ? '-muted' : ''})"/>` + pcb(x, y, p);  // an arrow to this PCB (grey and dashed if unreachable), then the PCB box itself
              px = x + 84;  // the next arrow starts at the right edge of this PCB
            });  // ends the loop over PCBs
            if (!q.length) g += `<text x="232" y="${y + 37}" font-size="13" class="s-sub">empty (head → ∅)</text>`;  // an empty queue shows "empty (head → ∅)" instead
            return g;  // returns the SVG text for the row
          }  // ends queueRow()
          function paintNarrow() {  // draws the tall version of the lab for phone-width screens
            const lit = (k) => S.lit.includes(k), red = S.rewrite && mode === 'direct';  // lit(k): whether module k is lit; red: after a layout change in the open design, every module turns red
            const mods = MODS.map(([k, n], i) => { const x = i % 2 ? 204 : 8, y = i < 2 ? 8 : 52;  // mods: the four module boxes in a 2 x 2 grid
              return `<rect x="${x}" y="${y}" width="188" height="36" rx="8" class="${red ? 's-bad' : 's-os'}" stroke-width="${lit(k) || red ? 3 : 1.5}" ${lit(k) ? 'style="stroke:var(--accent)"' : ''}/><text x="${x + 94}" y="${y + 23}" text-anchor="middle" font-size="${red ? 13 : 14}" font-weight="${lit(k) ? 800 : 600}">${n}${red ? ' ✗' : ''}</text>`; }).join('');  // each module box: red when it must be rewritten, accent outline when lit, with a cross after its name when red
            const gate = mode === 'handler'  // gate: in the protected design, a bar for the PCB handler that every access goes through
              ? `<rect x="8" y="98" width="384" height="36" rx="8" class="${S.rewrite ? 's-warn' : S.gate ? 's-ok' : 's-os'}" stroke-width="${S.lit.length || S.rewrite || S.gate ? 3 : 2}"/><text x="200" y="121" text-anchor="middle" font-size="13" font-weight="800">${S.rewrite ? 'PCB handler: rewritten (the only change)' : S.gate ? 'PCB handler: refused ✓ (0xBAD is no PCB)' : 'PCB handler: the only way to touch PCBs'}</text>`  // the handler bar turns orange when rewritten and green when it refused a bad write; its text says which
              : `<text x="200" y="121" text-anchor="middle" font-size="13"><tspan font-weight="700" style="fill:var(--bad)">direct access:</tspan> any routine, any PCB field</text>`;  // in the open design, a red "direct access: any routine, any PCB field" line instead
            const n = Math.max(S.ready.length, S.disk.length, 1), H = 342 + n * 84 + 6;  // n: the length of the longer queue (at least 1); H: a drawing height tall enough for that column
            svgBox.innerHTML = `<svg viewBox="0 0 400 ${H}" width="100%" role="img" aria-label="Ready and disk queues built from linked PCBs">${/* starts the phone SVG, H units tall */''}
              ${mods}${gate}${/* adds the modules and the gate */''}
              <rect x="4" y="146" width="392" height="${H - 150}" rx="12" fill="none" style="stroke:var(--line-2)" stroke-dasharray="6 5"/>${/* a dashed frame around the processor and the queues */''}
              <rect x="16" y="158" width="368" height="84" rx="12" class="s-cpu" stroke-width="2"/><text x="32" y="186" font-size="14" font-weight="800">Processor</text>${/* the processor box and its title */''}
              <text x="32" y="206" font-size="13" class="s-sub">running:</text>${/* the "running:" label */''}
              ${S.run != null ? pcb(248, 168, S.run, 120) : '<text x="308" y="206" text-anchor="middle" font-size="13" class="s-sub">idle</text>'}${/* the running PCB, or "idle" when no process has the processor */''}
              <text x="200" y="262" text-anchor="middle" font-size="13" class="s-sub">arrows = the <tspan font-weight="700">next</tspan> field inside each PCB</text>${/* a note that each arrow is the next field inside a PCB */''}
              ${queueCol(16, 'Ready queue', S.ready)}${/* the ready queue as the left column */''}
              ${queueCol(204, 'Disk queue (Blocked)', S.disk)}${/* the disk queue (Blocked processes) as the right column */''}
            </svg>`;  // ends the phone drawing
          }  // ends the phone drawing function
          function paint() {  // paint(): redraws the lab; runs at start and after every action
            const lit = (k) => S.lit.includes(k);  // lit(k): whether module k is lit for the last action
            if (ctx.narrow) { paintNarrow(); paintButtons(); return; }  // on a phone-width screen, draw the tall version, update the buttons and stop
            const mods = MODS.map(([k, n], i) => { const x = 10 + i * 188, red = S.rewrite && mode === 'direct';  // the four module boxes in one row; red marks the ones that must be rewritten
              return `<rect x="${x}" y="8" width="176" height="38" rx="8" class="${red ? 's-bad' : 's-os'}" stroke-width="${lit(k) || red ? 3 : 1.5}" ${lit(k) ? 'style="stroke:var(--accent)"' : ''}/><text x="${x + 88}" y="32" text-anchor="middle" font-size="${red ? 13 : 14}" font-weight="${lit(k) ? 800 : 600}">${n}${red ? ' ✗' : ''}</text>`  // each module box, outlined in accent when lit, with a cross after its name when red
                + (mode === 'direct' ? `<path d="M${x + 88} 46 L${x + 88} 100" class="${lit(k) ? '' : 's-muted'}" style="${lit(k) ? 'stroke:var(--accent);stroke-width:2.5' : ''}" stroke-dasharray="5 4" marker-end="url(#arr-${lit(k) ? 'accent' : 'muted'})"/>` : `<path d="M${x + 88} 46 L${x + 88} 58" class="s-muted"/>`); }).join('');  // open design: a dashed arrow from each module straight down to the PCBs; protected design: a short stub to the handler bar
            const gate = mode === 'handler'  // joins the four modules into one string
              ? `<rect x="10" y="60" width="740" height="34" rx="8" class="${S.rewrite ? 's-warn' : S.gate ? 's-ok' : 's-os'}" stroke-width="${S.lit.length || S.rewrite || S.gate ? 3 : 2}"/><text x="380" y="82" text-anchor="middle" font-size="14" font-weight="800">${S.rewrite ? 'PCB handler: rewritten for the new layout (the only change)' : S.gate ? 'PCB handler: request refused ✓ (0xBAD is not a PCB)' : 'PCB handler: the only routine allowed to read or write PCBs'}</text><path d="M380 94 L380 106" class="s-line" marker-end="url(#arr)"/>`  // protected design: the handler bar across the top, with an arrow down to the PCBs
              : `<text x="380" y="72" text-anchor="middle" font-size="13" font-weight="700" style="fill:var(--bad)">direct access:</text><text x="380" y="89" text-anchor="middle" font-size="13" class="s-sub">any routine, any PCB field</text>`;  // open design: red text saying any routine may touch any PCB field
            svgBox.innerHTML = `<svg viewBox="0 0 760 360" width="100%" role="img" aria-label="Ready and disk queues built from linked PCBs">${/* starts the wide 760 x 360 SVG */''}
              ${mods}${gate}${/* adds the modules and the gate */''}
              <rect x="4" y="112" width="752" height="244" rx="12" fill="none" style="stroke:var(--line-2)" stroke-dasharray="6 5"/>${/* a dashed frame around the processor and the queues */''}
              <rect x="14" y="140" width="128" height="200" rx="12" class="s-cpu" stroke-width="2"/><text x="78" y="162" text-anchor="middle" font-size="14" font-weight="800">Processor</text>${/* the processor box and its title */''}
              <text x="78" y="180" text-anchor="middle" font-size="13" class="s-sub">running:</text>${/* the "running:" label */''}
              ${S.run != null ? pcb(36, 196, S.run) : '<text x="78" y="232" text-anchor="middle" font-size="13" class="s-sub">idle</text>'}${/* the running PCB, or "idle" when no process has the processor */''}
              ${queueRow(152, 'Ready queue', S.ready)}${/* the ready queue as the upper row */''}
              ${queueRow(270, 'Disk queue (Blocked)', S.disk)}${/* the disk queue (Blocked processes) as the lower row */''}
              <text x="752" y="130" text-anchor="end" font-size="13" class="s-sub">arrows = the <tspan font-weight="700">next</tspan> field stored inside each PCB</text>${/* a note that each arrow is the next field stored inside a PCB */''}
            </svg>`;  // ends the wide drawing
            paintButtons();  // updates which buttons can be pressed
          }  // ends paint()
          function paintButtons() {  // paintButtons(): enables only the actions that make sense in the current state
            const broken = S.bad != null;  // broken: a PCB has been corrupted, so every action stays off until Reset
            B.disp.disabled = broken || S.run != null || !S.ready.length;  // Dispatch works only when the processor is idle and the ready queue has a PCB
            B.tout.disabled = broken || S.run == null;  // Time slice ends works only when a process is running
            B.blk.disabled = broken || S.run == null;  // asking for the disk works only when a process is running
            B.done.disabled = broken || !S.disk.length;  // Disk finishes works only when the disk queue has a PCB
            B.perf.disabled = broken;  // the monitor button is off once the queues are broken
            B.bug.disabled = broken;  // the bug button is off once the queues are broken
            B.redo.disabled = broken;  // the layout-change button is off once the queues are broken
            ctx.refit();  // asks the guide to re-check that the step still fits on the screen
          }  // ends paintButtons()
          narrate('<b>Start here.</b> Process 5 is running. PCBs 3 → 7 → 9 wait in the ready queue and PCB 12 waits for the disk. Use the buttons to move processes, then try to break things.');  // the starting narration: process 5 running, three PCBs ready, one waiting for the disk
          el.append(h('div', { class: 'split s33-qsplit fill' },  // builds the layout: explanation column on the left, lab on the right (widths from s33-qsplit)
            h('div', { class: 'stack', style: { gap: '10px' } },  // left column, stacked top to bottom
              h('p', { class: 'm0 small', html: 'The PCB is the <b>most important data structure</b> in the OS. Scheduling, resource allocation, interrupt handling and performance monitoring all read or change PCBs. The OS\'s queues are <span class="t">linked lists</span> of PCBs.' }),  // small paragraph: every major module uses PCBs, and the OS's queues are linked lists of PCBs
              ctx.narrow ? null : say,  // the narration card sits here on wide screens only
              h('div', { class: 'callout warn small m0', 'data-label': 'The protection problem', html: 'If any routine may write PCBs, one bug can wreck them, and a PCB layout change ripples through every module. The fix: one <b>PCB handler</b>, the only routine allowed to touch PCBs. Its cost: a little speed, and trust that every routine uses it.' })),  // callout on the protection problem and the PCB handler fix; closes the left column
            h('div', { class: 'stack', style: { gap: '8px' } },  // right column, stacked top to bottom
              h('div', { class: 'row', style: { gap: '6px' } }, B.disp, B.tout, B.blk, B.done, B.perf, h('span', { style: { flex: '1' } }), reset),  // the action buttons in a row, a spacer, then Reset at the right end
              svgBox,  // the queue drawing
              h('div', { class: 'row', style: { gap: '8px' } }, modeSeg, B.bug, B.redo),  // bottom row: the design switch, the bug button and the layout-change button
              ctx.narrow ? say : null)));  // on phones the narration card goes here, under the controls; closes the layout
          paint();  // draws the lab for the first time when the step opens
        },  // ends render() for step 7
      },  // closes step 7
      /* ---------------- 8. Recap ---------------- */
      {  // opens step 8
        title: 'Recap: eight things to remember',  // step 8 title
        kind: 'recap',  // kind recap: the summary step, always kept on the core path
        render(el, ctx) {  // render(el, ctx): builds the recap cards when step 8 is shown
          el.append(ctx.h('div', { class: 'stack fill' },  // a stack that fills the step; this step calls ctx.h directly instead of taking h out first
            ctx.h('p', { class: 'lead m0' }, 'Say each answer out loud before you flip the card. Next, section 3.4 shows how the OS creates and switches processes.'),  // lead paragraph: say each answer aloud before flipping, and a pointer to section 3.4
            ctx.ui.flipcards([  // the guide's flip cards: each card shows a question and turns over to its answer when clicked
              ['What four kinds of tables does the OS keep?', 'Memory, I/O, file and process tables. They are cross-referenced: they name processes by ID and point into one another.'],  // card 1: the four kinds of tables and how they are cross-referenced
              ['What does a memory table record?', 'Main and secondary memory given to each process, the protection of each region (shared ones too), and what virtual memory needs.'],  // card 2: what a memory table records
              ['What does an I/O table record?', 'Each device or channel: free or assigned (to whom), the status of the operation in progress, and the memory address of the transfer.'],  // card 3: what an I/O table records
              ['What are the four parts of a process image?', 'User program, user data, stack(s) and the process control block (the process\'s attributes).'],  // card 4: the four parts of a process image
              ['Contiguous or paged image?', 'Contiguous: one unbroken block and one pointer. Paged: pages in any free frames, some on disk, mapped page by page. Either way the PCB stays in main memory so the OS can manage the process.'],  // card 5: contiguous versus paged images, and why the PCB stays in memory
              ['The three groups of PCB information?', 'Process identification, processor state information, and process control information.'],  // card 6: the three groups of PCB information
              ['Why save EFLAGS (the PSW) in the PCB?', 'Its condition codes describe the process\'s own last result. Without the saved copy the process could resume and take the wrong branch.'],  // card 7: why EFLAGS (the PSW) is saved in the PCB
              ['Why guard PCBs with one handler?', 'Nearly every module uses PCBs (queues are linked PCBs). One gate stops a buggy routine from wrecking them and confines layout changes to one place. Cost: a little speed, and trust that every routine uses it.'],  // card 8: why one handler guards the PCBs, and what it costs
            ], { cols: 4, height: 230 })));  // closes the card list; the cards sit in four columns, each 230px tall
        },  // ends render() for step 8
      },  // closes step 8
      /* ---------------- 9. Check yourself ---------------- */
      {  // opens step 9
        title: 'Check yourself',  // step 9 title
        kind: 'check',  // kind check: the quiz step; the guide saves the best first-try score for this section
        quiz: [  // quiz: the questions, run by the guide's quiz engine; type picks the format, and no type means multiple choice
          { q: 'The OS must decide whether the printer can be given to a process right now. Which table does it consult?',  // quiz question 1 (multiple choice): which table says whether the printer is free
            choices: ['A memory table', 'An I/O table', 'A file table', 'The process table'], answer: 1,  // its four choices; answer 1 (counting from 0) is the I/O table
            feedback: ['Memory tables track main and secondary memory, not devices.', null, 'File tables track files on secondary memory, not the devices themselves.', 'The process table has one entry per process; it does not record who holds each device.'],  // feedback for each wrong choice (null marks the right one)
            why: 'I/O tables record every device and channel: whether it is free or assigned (and to which process), the status of any operation, and the memory address used for the transfer.' },  // why: the explanation shown after the question is answered
          { type: 'match', q: 'Match each OS table to something it records.',  // quiz question 2 (match): each OS table to something it records
            pairs: [['Memory table', 'Protection of a shared memory region'], ['I/O table', 'Memory address a disk transfer writes into'], ['File table', 'Where a file is stored on disk'], ['Process table', 'One entry per process, leading to its image']],  // the four pairs to match
            why: 'Memory tables hold allocation and protection; I/O tables hold device status and transfer addresses; file tables hold existence, location, status and attributes of files; the process table is the list of processes.' },  // why: a one-line summary of all four tables
          { type: 'multi', q: 'Which of these are parts of a process image?',  // quiz question 3 (pick all that apply): the parts of a process image
            choices: ['The user program', 'The user data', 'The stack', 'The process control block', 'The file table', 'The ready queue'], answer: [0, 1, 2, 3],  // six choices; the first four are right
            why: 'A process image is the user program, user data, stack(s) and PCB. The file table and the ready queue are OS-wide structures, not part of any one process image.' },  // why: the file table and ready queue belong to the whole OS, not to one process
          { type: 'bucket', q: 'Sort each PCB field into its group of attributes.',  // quiz question 4 (sort into buckets): PCB fields into their three groups
            buckets: ['Identification', 'Processor state', 'Process control'],  // the three bucket names
            items: [['ID of the parent process', 0], ['Program counter', 1], ['Condition codes', 1], ['Priority', 2], ['List of open files', 2]],  // the five fields, each with its right bucket
            why: 'Identifiers name the process; register contents (including the PSW bits) are processor state; everything the OS uses to schedule, link, protect and account for the process is process control information.' },  // why: names, registers, and everything else the OS uses to manage the process
          { type: 'tf', q: 'With paging, every page of a process image must stay in main memory for as long as the process exists.', answer: false,  // quiz question 5 (true or false): with paging every page must stay in memory (false)
            why: 'Pages can be spread over any free frames, and pages not needed right now can wait on disk. The memory tables record where each one is.' },  // why: pages not needed now can wait on disk, and the memory tables track them
          { q: 'Process 7 is interrupted just after a compare instruction and before its "jump if equal". Where are its condition codes while other processes run?',  // quiz question 6 (multiple choice): where process 7's condition codes wait while others run
            choices: ['In its PCB, as part of the processor state information', 'In its user data, next to its variables', 'In the I/O table entry for the interrupting device', 'Nowhere: the flags are recomputed when process 7 resumes'], answer: 0,  // its four choices; answer 0: in its PCB, with the processor state
            feedback: [null, 'User data is the program\'s own modifiable memory; the OS saves registers in the PCB instead.', 'The I/O table describes devices, not a process\'s registers.', 'The compare has already run; nothing would recompute the flags, so the jump would use another process\'s result.'],  // feedback for the wrong choices: user data, the I/O table, and recomputing the flags
            why: 'The PSW (EFLAGS on x86) is saved in the PCB when a process stops and restored before it runs again, so its pending jump sees its own result.' },  // why: the PSW is saved in the PCB and restored before the process runs again
          { type: 'num', q: 'An 8-bit register computes 200 + 100. What value does the 8-bit result register hold (as an unsigned number)?', answer: 44, tol: 0,  // quiz question 7 (type a number): what an 8-bit register holds after 200 + 100 (44, exactly)
            why: 'The true sum 300 needs 9 bits. Only the low 8 bits fit: 300 − 256 = 44, and the lost carry is recorded in the carry flag (CF = 1).' },  // why: 300 needs 9 bits, so 300 - 256 = 44 remains and the carry flag records the loss
          { type: 'multi', q: 'An 8-bit ADD computes 100 + 50. Which of the flags CF, ZF, SF and OF are set afterwards?',  // quiz question 8 (pick all that apply): which flags are set after 100 + 50
            choices: ['CF (carry)', 'ZF (zero)', 'SF (sign)', 'OF (overflow)'], answer: [2, 3],  // the four flags as choices; SF and OF are right
            why: '150 fits in 8 unsigned bits, so CF = 0, and it is not 0, so ZF = 0. But 150 is 1001 0110: the top bit is 1 (SF = 1), and as signed numbers 100 + 50 exceeds 127, so OF = 1.' },  // why: 150 fits unsigned but its top bit is 1, and as signed numbers the sum passes 127
          { type: 'order', q: 'Put in order the lookups the OS follows to find where process 8\'s stack page is right now.',  // quiz question 9 (put in order): the lookups that find where process 8's stack page is
            items: ['Use process ID 8 to find its entry in the process table', 'Follow that entry\'s pointer to the process image and its PCB', 'Read the memory-management pointer in the PCB (its page table)', 'Look up the stack page to find its frame, or its place on disk'],  // the four lookups, listed in the right order (the quiz shuffles them)
            why: 'The process table leads to the image and PCB; the PCB\'s memory-management information points to the page table; the page table says where each page is. This chain is the cross-referencing between tables in action.' },  // why: process table to PCB to page table to the page, the tables' cross-references at work
          { type: 'tf', q: 'Moving a process from the ready queue to a blocked queue normally means copying its whole PCB into the other queue.', answer: false,  // quiz question 10 (true or false): changing queues copies the whole PCB (false)
            why: 'Queues are linked lists of PCBs. The OS only changes a few pointer fields; the PCB itself stays where it is.' },  // why: queues are linked lists, so only a few pointers change
          { q: 'Why do many operating systems make every routine go through a single handler to read or write PCBs?',  // quiz question 11 (multiple choice): why every routine goes through one PCB handler
            choices: ['It makes each PCB access faster', 'A buggy routine cannot damage PCBs unchecked, and a change to the PCB layout only affects the handler', 'PCBs are stored on disk and need a special reader', 'It lets user programs edit their own PCBs safely'], answer: 1,  // its four choices; answer 1: it stops unchecked damage and confines layout changes
            feedback: ['It is actually a little slower: every access takes a detour through the handler.', null, 'PCBs are kept in main memory so the OS can reach them quickly.', 'User programs never edit PCBs; the handler is for OS routines.'],  // feedback for the wrong choices: speed, disk storage, and user programs editing PCBs
            why: 'Nearly every OS module uses PCBs. A single guard routine catches bad requests in one place and hides the PCB layout. The trade-off: a small detour on each access, and it only helps if every other routine can be trusted to go through it.' },  // why: one guard catches bad requests and hides the layout, at a small cost
          { q: 'An OS keeps a running total of the processor time each process has used, for scheduling and accounting. Where in the PCB does it belong?',  // quiz question 12 (multiple choice): where the running total of processor time belongs in the PCB
            choices: ['Process identification', 'Processor state information, since it is about the processor', 'Process control information (resource ownership and utilization)', 'Inside the saved program status word, next to the condition codes'], answer: 2,  // its four choices; answer 2: process control information
            feedback: ['Identification holds only identifiers: of the process, of its parent and of its user.', 'Processor state is a copy of the register contents saved at an interrupt. A usage total is not a register; it is a record the OS keeps about the process.', null, 'The PSW holds condition codes and control bits such as interrupt enable and execution mode, not usage totals.'],  // feedback for the wrong choices: identification, processor state and the PSW
            why: 'Resource ownership and utilization is part of process control information: it lists resources the process controls (such as open files) and a history of its use of the processor and other resources, which the scheduler and accounting rely on.' },  // why: resource ownership and utilization is part of process control information
        ],  // closes the quiz list
      },  // closes step 9
    ],  // closes the list of steps
    notes: `${/* notes: the section's reference text, opened with the Notes button in the top bar */''}
      <h3>The OS as the manager of resources</h3>${/* heading for notes part 1: the OS as the manager of resources */''}
      <p>Many processes (P1 … Pn) compete for a few processors, a fixed amount of main memory and some I/O devices. The OS hands these out and takes them back, so it must always know <b>where each process is, what it holds and what it is waiting for</b>. Example: P1 runs and owns the keyboard; P2 is blocked while the disk reads for it; P3 is swapped out (only its PCB stays in main memory); P4 is ready, holds the printer and waits for the processor.</p>${/* notes paragraph: many processes compete for few resources, with the P1-P4 example */''}

      <h3>OS control structures: four families of tables</h3>${/* heading for notes part 2: the four families of tables */''}
      <table>${/* starts the notes table that summarises the four families */''}
        <tr><th>Table</th><th>What it records</th></tr>${/* table header row: Table, What it records */''}
        <tr><td><b>Memory tables</b></td><td>Main memory allocated to each process; secondary memory (disk) allocated to each process; protection attributes of regions, e.g. who may read or write a shared region; information needed to manage virtual memory.</td></tr>${/* table row: what memory tables record */''}
        <tr><td><b>I/O tables</b></td><td>Each I/O device and channel (a small processor dedicated to I/O): available or assigned (to which process); status of the operation in progress; the main-memory location used as source or destination of the transfer.</td></tr>${/* table row: what I/O tables record, including what a channel is */''}
        <tr><td><b>File tables</b></td><td>Which files exist; their location on secondary memory; current status (e.g. open for writing by process 3); attributes (owner, permissions, size). May be kept by a separate file management system.</td></tr>${/* table row: what file tables record */''}
        <tr><td><b>Process tables</b></td><td>One entry per process; each entry points to that process's image (and so its PCB).</td></tr>${/* table row: what the process table records */''}
      </table>${/* closes the notes table */''}
      <p><b>The tables are cross-referenced.</b> Memory, I/O and file tables name processes by ID, and I/O entries point into memory that the memory tables allocate. Example with 4 KB <b>frames</b> (fixed-size slots of main memory; frame 4 = 0x4000–0x4FFF in hexadecimal): "Disk 0 reads for process 2 into 0x4200" matches a memory row "frame 4 belongs to process 2" and a file row "song.mp3 open for reading by process 2". When a process ends, every table that mentions it must be updated. The tables themselves live in main memory, so memory management covers them too.</p>${/* notes paragraph: the tables are cross-referenced, shown with the frame 4, Disk 0 and song.mp3 example */''}
      <p><b>Configuration comes first.</b> Before building tables, the OS must learn its environment (how much main memory, which I/O devices) from firmware, hardware probing or an administrator's settings.</p>${/* notes paragraph: the OS must learn its hardware before it builds its tables */''}

      <h3>The process image</h3>${/* heading for notes part 3: the process image */''}
      <ul>${/* starts the list of the four parts */''}
        <li><b>User program</b>: the instructions to be executed.</li>${/* list item: the user program */''}
        <li><b>User data</b>: the modifiable part of user space: program data, a user stack area, and programs that may be modified.</li>${/* list item: user data */''}
        <li><b>Stack</b>: one or more last-in, first-out system stacks holding parameters and return addresses of procedure and system calls.</li>${/* list item: the stack */''}
        <li><b>Process control block (PCB)</b>: the attributes the OS needs to control the process.</li>${/* list item: the process control block */''}
      </ul>${/* closes the list */''}
      <svg viewBox="0 0 520 52" width="100%" role="img" aria-label="Process image = PCB + user program + user data + stack"><rect x="4" y="6" width="120" height="40" rx="6" fill="#e8e7fd" stroke="#4f46e5"/><text x="64" y="31" text-anchor="middle" font-size="13">PCB</text><rect x="128" y="6" width="130" height="40" rx="6" fill="#e1eaff" stroke="#2563eb"/><text x="193" y="31" text-anchor="middle" font-size="13">User program</text><rect x="262" y="6" width="130" height="40" rx="6" fill="#d7f5e8" stroke="#059669"/><text x="327" y="31" text-anchor="middle" font-size="13">User data</text><rect x="396" y="6" width="120" height="40" rx="6" fill="#fff0d1" stroke="#b45309"/><text x="456" y="31" text-anchor="middle" font-size="13">Stack</text></svg>${/* a small picture of the process image as four boxes in a row, with fixed colours so it also prints well */''}
      <p><b>Location.</b> The image may be one <b>contiguous</b> block (one pointer to its start, but it needs one big enough gap and must be wholly loaded to run) or, with <b>paging</b>, cut into equal pages placed in any free frames, with pages not needed now left on disk. The OS can manage a process only if at least a small part of its image (the PCB) is in main memory, and the parts in use must be there for it to run. So the OS must know where every part of every image is: the process table points to each image, and the page tables map every page.</p>${/* notes paragraph: contiguous versus paged images, and why the OS must know where every part is */''}

      <h3>What a PCB holds: three groups</h3>${/* heading for notes part 4: what a PCB holds */''}
      <h4>1. Process identification</h4>${/* subheading: group 1, process identification */''}
      <p>Identifiers of this process (often its index into the process table), of its parent (creator), and of the user. Two runs of one program = two processes, two IDs.</p>${/* notes paragraph: the three identifiers, and two runs of one program giving two IDs */''}
      <h4>2. Processor state information</h4>${/* subheading: group 2, processor state information */''}
      <p>The register contents: in the processor while the process runs, saved in the PCB when it is interrupted, restored when it resumes. <b>User-visible registers</b> (often 8 to 32); <b>control and status registers</b>: the program counter, the <b>condition codes</b> (sign, zero, carry, equal, overflow) and status information (interrupts enabled/disabled, execution mode); and <b>stack pointers</b>. Condition codes and status bits usually share one register, the <b>program status word (PSW)</b>; on x86 it is the 32-bit <b>EFLAGS</b> register.</p>${/* notes paragraph: the saved registers, their three kinds, and the PSW (EFLAGS on x86) */''}
      <h4>3. Process control information</h4>${/* subheading: group 3, process control information */''}
      <ul>${/* starts the list of process control items */''}
        <li><b>Scheduling and state</b>: state, priority, scheduling data (e.g. time waiting), the event awaited.</li>${/* list item: scheduling and state information */''}
        <li><b>Data structuring</b>: pointers to other PCBs (queues, parent–child links).</li>${/* list item: data structuring, the pointers to other PCBs */''}
        <li><b>Interprocess communication</b>: flags, signals, messages.</li>${/* list item: interprocess communication */''}
        <li><b>Process privileges</b>: memory it may access, instruction types it may execute, system services it may use.</li>${/* list item: process privileges */''}
        <li><b>Memory management</b>: pointers to its segment and/or page tables.</li>${/* list item: memory management pointers */''}
        <li><b>Resource ownership and utilization</b>: resources such as open files, and processor-use history. (Processor time used is control information, not processor state.)</li>${/* list item: resource ownership and utilization, with the reminder about processor time */''}
      </ul>${/* closes the list */''}

      <h3>The PSW in action: x86 EFLAGS</h3>${/* heading for notes part 5: the PSW in action on x86 */''}
      <p>Key bits: CF carry (0), PF parity (2), AF auxiliary carry (4), ZF zero (6), SF sign (7), TF trap (8), IF interrupt enable (9), DF direction (10), OF overflow (11), IOPL I/O privilege level (12–13), NT nested task (14); bits 16–21 are more control bits, the rest reserved.</p>${/* notes paragraph: the key EFLAGS bits and their bit numbers */''}
      <p><b>Negative numbers on x86: two's complement.</b> The teaching machine in 1.3 used sign-magnitude (8005 hex = −5), but x86 stores negative numbers in <b>two's complement</b>. For 8 bits: if the top bit is 0 the value reads the same signed or unsigned (0 to 127); if the top bit is 1, the signed value is the unsigned value minus 256 (200 → −56, 255 → −1, 128 → −128). The same bit pattern can therefore be read two ways, which is why there are two "did not fit" flags: <b>CF</b> means the <i>unsigned</i> result did not fit in 0…255, and <b>OF</b> means the <i>signed</i> result did not fit in −128…127. The lab concentrates on CF, ZF, SF, OF (and IF); the other bits (NT, IOPL, DF, TF, AF, PF) have jobs this section does not need.</p>${/* notes paragraph: two's complement, and why there are two "did not fit" flags (CF and OF) */''}
      <p><b>Worked example (8 bits).</b> 200 + 100 = 300 needs 9 bits, so the register keeps 300 − 256 = <b>44</b> and <b>CF = 1</b>; ZF = 0, SF = 0, and as signed values −56 + 100 = 44 fits, so OF = 0. For 100 + 50 = 150 (1001 0110): CF = 0 and ZF = 0, but SF = 1 and <b>OF = 1</b>: two positives gave a signed sum above 127 (the register reads −106). After SUB, ZF = 1 means the values were <b>equal</b>; 3 − 5 needs a borrow (CF = 1) and leaves 254 (−2 signed, SF = 1).</p>${/* notes paragraph: worked 8-bit examples of the flags after ADD and SUB */''}
      <p>The flags describe the running process's own last result, so the OS saves EFLAGS in the PCB when stopping a process; otherwise a pending "jump if equal" could take the wrong branch.</p>${/* notes paragraph: why the OS saves EFLAGS in the PCB */''}

      <h3>The role of the PCB</h3>${/* heading for notes part 6: the role of the PCB */''}
      <p>The PCB is the <b>most important OS data structure</b>: virtually every module reads or modifies it (scheduling, resource allocation, interrupt processing, performance monitoring). The ready queue and blocked queues are <b>linked lists of PCBs</b>; moving a process between queues changes a few pointers, never copies the PCB.</p>${/* notes paragraph: the PCB is the most important OS structure, and queues are linked lists of PCBs */''}
      <p><b>Protection problem:</b> (1) a bug in one routine, such as an interrupt handler, can damage PCBs, e.g. a garbage <i>next</i> pointer makes every later PCB in the queue unreachable; (2) a change to the PCB's structure affects every module that uses it. <b>Solution:</b> all routines go through a single <b>handler routine whose only job is to protect PCBs</b>, the sole arbiter of reads and writes. It checks requests, and a layout change means rewriting only the handler. <b>Trade-off:</b> a small performance cost on every access, and it helps only as far as the rest of the OS can be trusted to use it.</p>`,  // notes paragraph: the protection problem, the PCB handler fix and its trade-off; end of the notes text
  });  // closes the section description and the Guide.section call
})();  // ends the wrapper function and runs it straight away
