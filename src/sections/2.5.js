// Comment key: a line inside backtick text ends with ${/* comment */''}, an empty-string slot that holds a comment without changing the text on screen (full note at the top of the page).
/* Section 2.5 — Fault Tolerance
   Original teaching material. Built step by step. */
Guide.section({  // registers section 2.5 with the guide; this one object holds its title, glossary, styles, steps, quiz and notes
  id: '2.5',  // id: the section number, used in links, saved progress and the "section 2.5" labels
  title: 'Fault Tolerance',  // title: the full section name shown at the top of every step
  short: 'Fault tolerance',  // short: the shorter name used in the table of contents and other tight spaces
  summary: 'Reliability, MTTF, MTTR and availability, the kinds of faults, and how redundancy and the OS mask them.',  // summary: one-sentence preview shown on the chapter's section list
  objectives: [  // objectives: the learning goals listed on the section's opening screen
    'Define fault tolerance and explain why it relies on redundancy, and what that redundancy costs.',  // goal 1: define fault tolerance and why it needs redundancy, which has a cost
    'Define reliability R(t), MTTF and MTTR, then calculate availability as MTTF / (MTTF + MTTR) and the downtime it allows per year.',  // goal 2: define R(t), MTTF and MTTR, then compute availability and yearly downtime
    'Place a system in the right availability class, from normal availability up to continuous.',  // goal 3: place a system in its availability class
    'Classify faults as permanent, transient or intermittent, and match spatial, temporal and information redundancy to the faults each one handles.',  // goal 4: sort faults by how long they last and match each kind of redundancy to them
    'Describe how process isolation, concurrency controls, virtual machines, and checkpoints with rollback help an operating system survive faults.',  // goal 5: name the four operating-system tools that help a system survive faults
  ],  // closes the objectives list
  terms: [  // terms: the glossary for this section; each pair is [term, definition] and powers the dotted-word pop-ups
    ['Fault tolerance', 'The ability of a system or component to keep operating normally even when some of its hardware or software has developed faults.'],  // glossary entry: defines fault tolerance
    ['Redundancy', 'Extra resources (spare parts, repeated work, or extra information) that are not needed while everything works but can take over or undo the damage when something fails.'],  // glossary entry: defines redundancy as spare resources held in reserve
    ['Reliability', 'Written R(t): the probability that a system operates correctly for the whole period from time 0 up to time t, given that it was operating correctly at time 0.'],  // glossary entry: defines reliability, written R(t)
    ['Mean time to failure (MTTF)', 'The average length of time a system runs correctly, from being started or repaired, until it next fails.'],  // glossary entry: defines mean time to failure (MTTF)
    ['Mean time to repair (MTTR)', 'The average time it takes to find a fault and repair or replace the failed part so that the system works again.'],  // glossary entry: defines mean time to repair (MTTR)
    ['Availability', 'The fraction of time a system is up and able to serve requests. Over the long run it equals MTTF / (MTTF + MTTR). The security goal of the same name (section 2.3) makes the same promise against attacks rather than failures.'],  // glossary entry: defines availability and links it to the security goal of the same name
    ['Fault', 'An erroneous state of hardware or software. Causes include a failed component, operator error, physical interference from the surroundings, a design error, a program error or a corrupted data structure.'],  // glossary entry: defines a fault and lists where faults come from
    ['Permanent fault', 'A fault that, once it occurs, is present all the time until the faulty part is repaired or replaced, such as a disk head crash or a software bug.'],  // glossary entry: defines a permanent fault, one that stays until repaired
    ['Temporary fault', 'A fault that is not present all the time. It comes in two kinds: transient and intermittent.'],  // glossary entry: defines a temporary fault, the umbrella for transient and intermittent
    ['Transient fault', 'A temporary fault that happens only once, such as a bit flipped by an electrical noise spike or by radiation. Trying the operation again usually succeeds.'],  // glossary entry: defines a transient fault, one that happens only once
    ['Intermittent fault', 'A temporary fault that comes and goes at several unpredictable times, such as a loose connection.'],  // glossary entry: defines an intermittent fault, one that comes and goes
    ['Spatial redundancy', 'Also called physical redundancy: several physical components perform the same function at the same time, or a spare stands by, ready to take over.'],  // glossary entry: defines spatial (physical) redundancy
    ['Temporal redundancy', 'Repeating an operation when an error is detected. It works well against temporary faults but cannot fix a permanent one.'],  // glossary entry: defines temporal redundancy, repeating work after an error
    ['Information redundancy', 'Storing extra bits (a code) or extra copies of data so that errors in the data can be detected and often corrected.'],  // glossary entry: defines information redundancy, extra bits or copies of data
    ['Triple modular redundancy (TMR)', 'Three identical units compute the same result and a voter outputs the majority answer, so a single faulty unit is outvoted.'],  // glossary entry: defines triple modular redundancy (TMR) and its majority voter
    ['Race condition', 'A fault that appears when two processes or threads read and write the same shared data and the final result depends on the exact order in which their steps happen to interleave.'],  // glossary entry: defines a race condition between processes sharing data
    ['Process isolation', 'The OS, helped by memory-protection hardware, keeps each process inside its own memory, files and flow of execution, so a faulty process cannot damage other processes or the OS.'],  // glossary entry: defines process isolation, enforced by memory-protection hardware
    ['Virtual machine (VM)', 'A software-made copy of a whole computer that runs its own operating system. Several VMs share one physical machine but are strongly isolated from one another.'],  // glossary entry: defines a virtual machine (VM)
    ['Checkpoint', 'A saved copy of a program\'s or system\'s state, taken at a moment when that state is consistent and kept in storage that the expected failure cannot destroy, so work can resume from there.'],  // glossary entry: defines a checkpoint, a saved consistent copy of state
    ['Rollback', 'Recovering from a failure by discarding the damaged current state, restoring the most recent checkpoint, and redoing the work done since then.'],  // glossary entry: defines rollback, returning to the last checkpoint after a failure
  ],  // closes the glossary list

  css: ` /* css: style rules added to the page only for this section; every rule starts with .sec-2-5 so it cannot affect other sections */
    /* shell workaround: in narrow mode the nowrap eyebrow otherwise sets the canvas min-width */
    .sec-2-5 .step-eyebrow { contain: inline-size; } /* stops the step's small heading line from forcing the whole page wider than a phone-width screen */
    .sec-2-5 .hot { cursor: pointer; } /* .hot marks clickable drawing parts with a pointing-hand cursor (no step in this file uses it at present) */
    .sec-2-5 .callout, .sec-2-5 .card.tight { flex-shrink: 0; } /* stops callouts and tight cards from being squeezed shorter when a column runs out of room */
    .sec-2-5 .hot:hover > rect { stroke-width: 3.5; } /* thickens the outline of a clickable drawing part while the mouse is over it */
    .sec-2-5 .kv { display: grid; grid-template-columns: auto 1fr; gap: 2px 12px; font-size: 14.5px; line-height: 1.4; } /* .kv lays out label/value pairs in two columns (a spare style; no step here uses it right now) */
    .sec-2-5 .kv b { font-family: var(--mono); } /* shows the label side of a .kv pair in the fixed-width code font */
    .sec-2-5 .formula { font-family: var(--mono); font-weight: 800; font-size: 19px; text-align: center; padding: 8px 10px; border-radius: 10px; background: var(--panel); border: 2px solid var(--chc); } /* .formula: the boxed, centered formula line in step 3 (A = MTTF / (MTTF + MTTR)), bordered in the chapter color */
    .sec-2-5 .lbl { display: block; font-size: 11.5px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); } /* .lbl: the small grey all-capitals label above a number or at the start of a button row */
    .sec-2-5 .tgl.on { background: var(--ok-bg); border-color: var(--ok); color: var(--ok); } /* a redundancy toggle button that is switched on turns green so the student sees which spares are installed */
    .sec-2-5 .flt { border-color: var(--intr); color: var(--intr); } /* .flt: fault buttons (inject a failure) are drawn in the interrupt color so they read as dangerous */
    .sec-2-5 .flt:hover { background: var(--intr-bg); color: var(--intr); } /* a fault button gets a light tinted background while the mouse is over it */
    .sec-2-5 .stat { display: flex; flex-direction: column; gap: 0; } /* .stat stacks a small label on top of its big number */
    .sec-2-5 .stat .big { font-size: 32px; } /* the big number inside a stat box */
    .sec-2-5 .stats { display: grid; grid-template-columns: repeat(var(--n), minmax(0, 1fr)); gap: 10px; } /* .stats: a row of equal stat boxes; the step sets --n (a CSS variable) to say how many columns */
    .sec-2-5 .nar .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); } /* on phone-width screens (.nar) the stat boxes wrap two per row instead */
    .sec-2-5 .nar .stat .big { font-size: 26px !important; } /* on phone-width screens the big stat numbers shrink so they fit in half the width */
    .sec-2-5 .nar .tmr-row { grid-template-columns: 46px repeat(8, minmax(0, 1fr)) 30px; gap: 4px; } /* phone-width layout of a TMR row in step 6: slimmer label and bit columns, no room for the status chip beside them */
    .sec-2-5 .nar .tmr-row .chip { grid-column: 2 / -1; } /* on phone-width screens the TMR status chip moves to its own line under the bits */
    .sec-2-5 .nar .tmr-row > .b { font-size: 13px; } /* on phone-width screens the unit name at the start of each TMR row uses a smaller font */
    .sec-2-5 .nar .tbit { height: 34px; font-size: 16px; } /* on phone-width screens the TMR bit buttons get shorter and use smaller digits */
    .sec-2-5 .nar .pgrid { grid-template-columns: 40px repeat(5, minmax(0, 1fr)) 26px; gap: 4px; } /* phone-width layout of the parity grid in step 6: columns stretch to share the space */
    .sec-2-5 .nar .pbit { height: 36px; font-size: 17px; } /* on phone-width screens the parity bit buttons get shorter and use smaller digits */
    .sec-2-5 .nar .txstrip { flex-wrap: wrap; } /* on phone-width screens the strip of transfers in step 9 may wrap onto a second line */
    .sec-2-5 .nar .tx { flex: 1 1 64px; } /* on phone-width screens each transfer box may grow or shrink around a 64-pixel base width */
    .sec-2-5 .rung { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 0 10px; align-items: baseline; padding: 5px 12px 7px; border: 2px solid var(--line); border-radius: 10px; background: var(--panel); transition: border-color .2s, background .2s; } /* .rung: one row of the "ladder of nines" in step 4, a bordered box with the class name on the left and availability on the right */
    .sec-2-5 .rung .nm { font-weight: 800; font-size: 15.5px; } /* the class name inside a ladder rung, in bold */
    .sec-2-5 .rung .av { font-family: var(--mono); font-weight: 800; font-size: 15px; } /* the availability number of a ladder rung, in the code font so the digits line up */
    .sec-2-5 .rung .dt { font-size: 13.5px; color: var(--ink-2); } /* the yearly-downtime text of a ladder rung, a little smaller and greyer */
    .sec-2-5 .rung .bar { grid-column: 1 / -1; height: 7px; margin-top: 3px; background: var(--panel-3); border-radius: 9px; overflow: hidden; } /* the grey track under each rung that holds its red downtime bar, spanning both columns */
    .sec-2-5 .rung .bar > i { display: block; height: 100%; background: var(--bad); opacity: .75; border-radius: 9px; } /* the red bar inside the track; its width (set in the code) shows the yearly downtime */
    .sec-2-5 .cause { display: flex; flex-direction: column; padding: 3px 10px 4px; border-radius: 9px; background: var(--intr-bg); border-left: 4px solid var(--intr); font-size: 13px; line-height: 1.3; color: var(--ink-2); } /* .cause: one small card in step 5 naming a source of faults, with a colored stripe on its left edge */
    .sec-2-5 .cause b { font-size: 14.5px; color: var(--ink); } /* the cause's name inside a .cause card, slightly larger and darker than its description */
    .sec-2-5 .fbtn { height: 46px; font-size: 16.5px; font-weight: 750; } /* .fbtn: the three big answer buttons (Permanent, Transient, Intermittent) in the fault classifier */
    .sec-2-5 .fbtn:disabled { opacity: .6; } /* answer buttons fade once the scenario has been answered and they are disabled */
    .sec-2-5 .fbtn.ok { background: var(--ok-bg); border-color: var(--ok); color: var(--ok); opacity: 1; } /* after an answer, the correct kind's button turns green (full strength even though it is disabled) */
    .sec-2-5 .fbtn.bad { background: var(--bad-bg); border-color: var(--bad); color: var(--bad); opacity: 1; } /* after a wrong answer, the button the student chose turns red */
    .sec-2-5 .fixrow { display: grid; grid-template-columns: 104px 1fr; gap: 8px; padding: 3px 8px; border-radius: 8px; font-size: 14px; line-height: 1.35; border: 1px solid transparent; } /* .fixrow: one row of the "what usually fixes it" table, fault kind on the left and the remedy on the right */
    .sec-2-5 .fixrow.on { background: var(--accent-bg); border-color: var(--accent); } /* the remedy row that matches the correct answer is highlighted after the student answers */
    .sec-2-5 .pill { flex: 1; height: 8px; border-radius: 9px; background: var(--panel-3); border: 1px solid var(--line-2); } /* .pill: one small progress bar segment per scenario in the fault classifier */
    .sec-2-5 .pill.ok { background: var(--ok); border-color: var(--ok); } /* a scenario answered correctly shows a green segment */
    .sec-2-5 .pill.bad { background: var(--bad); border-color: var(--bad); } /* a scenario answered wrongly shows a red segment */
    .sec-2-5 .pill.cur { outline: 2px solid var(--chc); outline-offset: 1px; } /* the segment for the current scenario gets an outline so the student sees where they are */
    .sec-2-5 .tmr-row { display: grid; grid-template-columns: 62px repeat(8, minmax(0, 1fr)) 44px 120px; gap: 5px; align-items: center; font-size: 14.5px; } /* .tmr-row: one row of the TMR demo, a label, eight bit buttons, the decimal value and a status chip */
    .sec-2-5 .tmr-row .chip { justify-self: start; } /* keeps the status chip at the left of its cell instead of stretching it */
    .sec-2-5 .tbit { height: 40px; border-radius: 7px; border: 2px solid var(--line-2); background: var(--panel); font-family: var(--mono); font-size: 19px; font-weight: 800; color: var(--ink); cursor: pointer; display: grid; place-items: center; padding: 0; } /* .tbit: one bit button in the TMR demo, a square with a large digit that can be clicked to flip it */
    .sec-2-5 button.tbit:hover { border-color: var(--chc); } /* a TMR bit button's border takes the chapter color while the mouse is over it */
    .sec-2-5 .tbit.wbit { background: var(--bad-bg); border-color: var(--bad); color: var(--bad); } /* .wbit: a bit that differs from the correct answer 42 is shown in red */
    .sec-2-5 .tbit.lose { text-decoration: line-through; } /* .lose: a bit that the voter overruled is struck through */
    .sec-2-5 .tbit.out { cursor: default; background: var(--os-bg); border-color: var(--os); } /* .out: the voter's output bits are not buttons, so they get a normal cursor and the OS color */
    .sec-2-5 .tbit.out.wbit { background: var(--bad-bg); border-color: var(--bad); } /* an output bit that is wrong is shown in red even though it belongs to the output row */
    .sec-2-5 .dec { font-family: var(--mono); font-weight: 800; font-size: 16px; text-align: right; } /* .dec: the decimal value at the end of each TMR row, right-aligned in the code font */
    .sec-2-5 .voter { text-align: center; font-size: 13px; font-weight: 800; letter-spacing: .04em; color: var(--os); background: var(--os-bg); border-radius: 8px; padding: 3px 0; } /* .voter: the strip between the three units and the output, explaining that the voter takes a majority */
    .sec-2-5 .pgrid { display: grid; grid-template-columns: 46px repeat(4, 44px) 50px 42px; gap: 5px; align-items: center; justify-items: stretch; } /* .pgrid: the parity grid in step 6, a label column, four data columns, a parity column and a check column */
    .sec-2-5 .pbit { height: 40px; border-radius: 7px; border: 2px solid var(--line-2); background: var(--panel); font-family: var(--mono); font-size: 19px; font-weight: 800; color: var(--ink); cursor: pointer; padding: 0; } /* .pbit: one clickable bit in the parity grid, a square with a large digit */
    .sec-2-5 .pbit:hover { border-color: var(--chc); } /* a parity grid bit's border takes the chapter color while the mouse is over it */
    .sec-2-5 .pbit.par { background: var(--os-bg); border-color: var(--os); } /* .par: parity bits are tinted in the OS color to set them apart from the data bits */
    .sec-2-5 .pbit.inrow, .sec-2-5 .pbit.incol { background: var(--warn-bg); } /* every bit in a failing row or failing column gets a yellow warning background */
    .sec-2-5 .pbit.wbit { color: var(--bad); border-color: var(--bad); } /* .wbit: a parity-grid bit that differs from the original is written in red */
    .sec-2-5 .pbit.hit { box-shadow: 0 0 0 3px var(--bad); background: var(--bad-bg); } /* .hit: the single bit where the failing row and failing column cross gets a red ring, since that is the flipped bit */
    .sec-2-5 .pchk { text-align: center; font-weight: 900; font-size: 18px; } /* .pchk: the check mark or cross at the end of each row and under each column */
    .sec-2-5 .pchk.ok { color: var(--ok); } .sec-2-5 .pchk.bad { color: var(--bad); } /* a passing check is drawn green and a failing check red */
    .sec-2-5 .mech { padding: 7px 12px; border-radius: 10px; border: 1px solid var(--line); border-left: 5px solid var(--c, var(--line-2)); background: var(--panel-2); font-size: 14px; line-height: 1.38; color: var(--ink-2); } /* .mech: a card in steps 7-9 describing one OS mechanism, with a thick colored stripe on its left (color from --c) */
    .sec-2-5 .mech > b { display: block; font-size: 15.5px; color: var(--c); } /* the mechanism's name at the top of a .mech card, on its own line and in the card's color */
    .sec-2-5 .mech.proc { --c: var(--proc); } .sec-2-5 .mech.thread { --c: var(--thread); } .sec-2-5 .mech.os { --c: var(--os); } .sec-2-5 .mech.mem { --c: var(--mem); } /* picks the stripe color per mechanism: process, thread, OS or memory color, stored in the --c variable */
    .sec-2-5 .flt.on { background: var(--intr-bg); } /* in step 7, the fault button the student last pressed stays tinted so they can see which fault is active */
    .sec-2-5 .txstrip { display: flex; gap: 5px; align-items: stretch; } /* .txstrip: the row of eight transfer boxes in the checkpoint demo of step 9 */
    .sec-2-5 .tx { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; padding: 4px 2px; border: 2px solid var(--line-2); border-radius: 9px; background: var(--panel); line-height: 1.25; } /* .tx: one transfer box (T1 to T8), a small bordered column holding its number, the transfer and its status */
    .sec-2-5 .tx b { font-size: 15px; } .sec-2-5 .tx span { font-size: 12px; white-space: nowrap; color: var(--ink-2); } .sec-2-5 .tx i { font-style: normal; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .03em; color: var(--muted); } /* inside a transfer box: bold number, small unbroken transfer text, and a tiny all-capitals status word */
    .sec-2-5 .tx.saved { background: var(--ok-bg); border-color: var(--ok); } .sec-2-5 .tx.saved i { color: var(--ok); } /* a transfer already covered by a checkpoint is green: that work is safe */
    .sec-2-5 .tx.unsaved { background: var(--warn-bg); border-color: var(--warn); } .sec-2-5 .tx.unsaved i { color: var(--warn); } /* a transfer done since the last checkpoint is yellow: that work would be lost in a crash */
    .sec-2-5 .tx.redo { background: var(--warn-bg); border-color: var(--warn); border-style: dashed; } .sec-2-5 .tx.redo i { color: var(--warn); } /* after a crash, work that must be redone gets a dashed yellow border */
    .sec-2-5 .tx.half { background: var(--bad-bg); border-color: var(--bad); } .sec-2-5 .tx.half i { color: var(--bad); } /* the transfer that was halfway done when the crash hit is red */
    .sec-2-5 .cpmark { flex: none; width: 22px; display: flex; align-items: center; justify-content: center; writing-mode: vertical-rl; transform: rotate(180deg); background: var(--os); color: var(--panel); border-radius: 6px; font-size: 10.5px; font-weight: 900; letter-spacing: .05em; text-transform: uppercase; } /* .cpmark: the thin dark "checkpoint" tab between transfer boxes, with its text turned sideways to read bottom to top */
    .sec-2-5 .rung.on { border-color: var(--chc); background: color-mix(in srgb, var(--chc) 11%, var(--panel)); } /* the ladder rung that matches the calculator's availability is highlighted in the chapter color */
    .sec-2-5 .cc-code { display: grid; grid-template-columns: 50px 50px auto minmax(0, 1fr); gap: 2px 10px; align-items: center; } /* .cc-code: the code table in step 8, four columns: P1 marker, P2 marker, code line, and its plain-language explanation */
    .sec-2-5 .cc-hd { font-size: 11.5px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); } /* .cc-hd: the small grey all-capitals column headings of the code table */
    .sec-2-5 .cc-line { font-family: var(--mono); font-size: 15px; font-weight: 700; padding: 2px 9px; border-radius: 7px; background: var(--panel-3); white-space: nowrap; } /* .cc-line: one line of the deposit code, in the code font on a grey pill, never wrapped */
    .sec-2-5 .cc-line.lk { background: var(--os-bg); color: var(--os); } /* .lk: the lock and unlock lines are tinted in the OS color, because the OS provides the lock */
    .sec-2-5 .cc-line.cur { box-shadow: inset 0 0 0 2px var(--chc); } /* .cur: the line that a process will run next gets an inner outline in the chapter color */
    .sec-2-5 .cc-com { font-size: 13.5px; color: var(--ink-2); line-height: 1.3; } /* .cc-com: the plain-language explanation beside each code line, smaller and greyer */
    .sec-2-5 .cc-mk { display: flex; justify-content: center; min-height: 24px; align-items: center; } /* .cc-mk: the cell holding a "P1 ▸" or "P2 ▸" marker, centered and tall enough that rows do not jump when it appears */
    .sec-2-5 .cc-trace { display: flex; flex-wrap: wrap; gap: 4px; align-content: flex-start; height: 74px; padding: 6px 8px; } /* .cc-trace: the fixed-height box of chips recording the order in which lines ran, so the layout does not move as it fills */
    .sec-2-5 .cc-trace > .chip { font-size: 12.5px; line-height: 1.4; padding: 0 7px; } /* makes each chip in the trace a little smaller so many fit in the box */
    .sec-2-5 .cc-card > .chip { align-self: flex-start; } /* keeps the status chip in a deposit card at its natural width instead of stretching it */
    .sec-2-5 .nar .cc-code { grid-template-columns: 44px 44px minmax(0, 1fr); } /* phone-width layout of the code table: the explanation column is dropped from the grid */
    .sec-2-5 .nar .cc-com { grid-column: 3; margin-bottom: 4px; } /* on phone-width screens each explanation sits under its code line, in the third column */
    .sec-2-5 .nar .cc-hd.cmt { display: none; } /* on phone-width screens the "what the line does" heading is hidden, since the explanations sit under the code */
    .sec-2-5 .btn.acc { border-color: var(--accent); color: var(--accent); } /* .acc: gives P2's run button the accent color, matching P2's chips and marker */
    .sec-2-5 .cc-card { display: flex; flex-direction: column; gap: 1px; padding: 6px 10px; border-radius: 10px; border: 2px solid var(--line); background: var(--panel-2); min-width: 0; } /* .cc-card: one of the three boxes in step 8 (P1's copy, the shared balance, P2's copy): label, big number, chip */
    .sec-2-5 .cc-card .big { font-size: 28px; } /* the big dollar figure inside a deposit card */
    .sec-2-5 .cc-card.shared { border-color: var(--mem); background: var(--mem-bg); } /* the shared-balance card is tinted in the memory color, since the balance lives in shared memory */
  `,  // end of the css text for this section

  steps: [  // steps: the list of screens in this section, shown one at a time as the student clicks Next
    /* ---------------- 1. Big picture: what fault tolerance is + break-it-yourself store ---------------- */
    {  // step 1 begins: the big-picture story with the break-it-yourself online store
      title: 'Parts will fail. The system should not.',  // title shown at the top of step 1
      kind: 'story',  // kind 'story' marks this as the section's opening big-picture screen (it stays on the shorter core path)
      render(el, ctx) {  // render(el, ctx) runs each time step 1 is shown; el is the empty step area and ctx holds the guide's helpers
        const { h, s } = ctx;  // h builds an HTML element and s builds an SVG element (SVG is the browser's drawing format)
        const st = { psu2: false, mirror: false, standby: false, fPsu: false, fDisk: false, fSw: false };  // st: what is installed and what is broken: three spares (second power, mirror disk, standby server) and three faults
        const nar = ctx.narrow; /* phones: Server B is drawn below Server A so the labels stay readable */
        const svg = s('svg', { viewBox: nar ? '0 0 410 412' : '0 0 640 226', width: '100%', style: 'flex:none' });  // the drawing; phones get a taller, thinner picture so Server B fits under Server A
        const status = h('div', { class: 'callout m0 small', style: { lineHeight: '1.4', minHeight: '84px', flex: 'none' } });  // status: the colored callout box that says whether the store is online and why
        const cost = h('div', { class: 'small', style: { lineHeight: '1.35', flex: '1' } });  // cost: the text beside the meter giving the price of the chosen spares and what they slow down
        const meter = h('div', { class: 'meter', style: { width: '120px', flex: 'none' } }, h('i'));  // meter: a short bar whose inner i element grows with the total cost
        const box = (x, y, w, label, cls, dashed) => s('g', {},  // box(...) draws one labelled rectangle in the drawing: a server part such as a disk or power supply
          s('rect', { x, y, width: w, height: 34, rx: 8, class: cls, 'stroke-width': 2, 'stroke-dasharray': dashed ? '6 5' : null }),  // the rectangle itself; a dashed outline means the part is missing
          s('text', { x: x + w / 2, y: y + 22, 'text-anchor': 'middle', 'font-size': 14.5, 'font-weight': 700, class: dashed ? 's-sub' : null }, label));  // the part's name centered in the rectangle, greyed out when the part is missing
        function aUp() { return !st.fSw && (!st.fPsu || st.psu2) && (!st.fDisk || st.mirror); }  // aUp(): Server A keeps working unless the OS crashed, or power failed with no spare, or the disk failed with no mirror
        function draw() {  // draw() rebuilds the picture, the status message, the cost and the button states; it runs after every click
          const up = aUp(), serving = up ? 'A' : st.standby ? 'B' : null;  // up says whether Server A still works; serving says which server customers are using now (A, B or none)
          const k = [];  // k collects every shape of the new drawing before it replaces the old one
          const cx = nar ? 100 : 220;  // cx: where the Customers box starts, further left on phones
          k.push(s('rect', { x: cx, y: 2, width: 200, height: 34, rx: 10, class: 's-proc', 'stroke-width': 2 }),  // draws the Customers box at the top of the picture
            s('text', { x: cx + 100, y: 24, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800 }, 'Customers'));  // writes "Customers" in the middle of that box
          const arrow = (d, on) => s('path', { d, fill: 'none', 'stroke-width': on ? 3 : 2, style: on ? 'stroke:var(--ok)' : 'stroke:var(--line-2)', 'stroke-dasharray': on ? null : '5 5', 'marker-end': on ? 'url(#arr-ok)' : 'url(#arr-muted)' });  // arrow(d, on): draws a connection from customers to a server; solid green with an arrowhead if in use, dashed grey if not
          k.push(arrow(nar ? 'M200 36V54' : 'M270 36L200 54', serving === 'A'), arrow(nar ? 'M300 19H402V325H238' : 'M370 36L520 54', serving === 'B'));  // the two connections: to Server A, and a longer path to Server B (routed around the side on phones)
          /* server A */
          k.push(s('rect', { x: 10, y: 56, width: 380, height: 166, rx: 14, class: up ? 's-panel' : 's-bad', 'stroke-width': 2 }),  // Server A's outer frame, turned red when the server is down
            s('text', { x: 26, y: 79, 'font-size': 15, 'font-weight': 800 }, 'Server A · primary'),  // Server A's title in the top-left corner of its frame
            s('text', { x: 374, y: 79, 'text-anchor': 'end', 'font-size': 14, 'font-weight': 900, style: up ? 'fill:var(--ok)' : 'fill:var(--bad)' }, up ? (serving === 'A' ? 'UP · SERVING' : 'UP') : 'DOWN'));  // Server A's state in the top-right corner: UP · SERVING, UP, or DOWN in red
          k.push(box(24, 90, 352, st.fSw ? '✗ OS crashed' : 'OS + store software', st.fSw ? 's-bad' : 's-os'));  // the OS and store software box, which becomes a red "OS crashed" box after an OS fault
          k.push(box(24, 132, 168, st.fPsu ? '✗ Power 1 burned out' : 'Power 1', st.fPsu ? 's-bad' : 's-io'));  // the first power supply, red after a power fault
          k.push(st.psu2 ? box(208, 132, 168, st.fPsu ? 'Power 2 · carrying load' : 'Power 2 · spare', st.fPsu ? 's-ok' : 's-io') : box(208, 132, 168, 'no spare power', 's-muted', true));  // the second power slot: a spare (green when it carries the load) or a dashed "no spare power" gap
          k.push(box(24, 176, 168, st.fDisk ? '✗ Disk 1 crashed' : 'Disk 1', st.fDisk ? 's-bad' : 's-mem'));  // the first disk, red after a disk crash
          k.push(st.mirror ? box(208, 176, 168, st.fDisk ? 'Mirror · has every file' : 'Mirror disk', st.fDisk ? 's-ok' : 's-mem') : box(208, 176, 168, 'no mirror disk', 's-muted', true));  // the mirror disk slot: a copy of every file (green when it takes over) or a dashed "no mirror disk" gap
          /* server B (on phones the whole group is moved below Server A) */
          const kB = [];  // kB collects the shapes for Server B separately so they can be moved as one group on phones
          if (st.standby) {  // when a standby server has been bought, draw it ready to take over
            kB.push(s('rect', { x: 410, y: 56, width: 220, height: 166, rx: 14, class: serving === 'B' ? 's-ok' : 's-panel', 'stroke-width': 2 }),  // Server B's frame, turned green when it is the one serving customers
              s('text', { x: 424, y: 79, 'font-size': 14.5, 'font-weight': 800 }, 'Server B'),  // Server B's title
              s('text', { x: 616, y: 79, 'text-anchor': 'end', 'font-size': 13, 'font-weight': 900, style: 'fill:var(--ok)' }, serving === 'B' ? 'SERVING' : 'STANDBY · READY'),  // Server B's state: SERVING once it has taken over, otherwise STANDBY · READY
              box(424, 90, 192, 'OS + store (own copy)', 's-os'), box(424, 132, 192, 'Power', 's-io'), box(424, 176, 192, 'Disk (synced copy)', 's-mem'));  // Server B's own software, power and disk, a complete second copy of Server A
          } else {  // otherwise there is no standby server
            kB.push(s('rect', { x: 410, y: 56, width: 220, height: 166, rx: 14, class: 's-muted', 'stroke-dasharray': '7 6' }),  // an empty dashed frame where Server B would be
              s('text', { x: 520, y: 144, 'text-anchor': 'middle', 'font-size': 14.5, 'font-weight': 700, class: 's-sub' }, 'no standby server'));  // the words "no standby server" in the empty frame
          }  // ends the Server B branch
          k.push(s('g', { transform: nar ? 'translate(-400 186)' : null }, ...kB));  // adds Server B's group; on phones it is shifted left and down so it sits below Server A
          svg.replaceChildren(...k);  // swaps the finished shapes into the drawing on screen in one go
          /* narration */
          const masked = [];  // masked lists the faults that a spare quietly covered
          if (st.fPsu && st.psu2) masked.push('Power 1 died, but Power 2 took over the load');  // a power failure is masked when the second power supply is installed
          if (st.fDisk && st.mirror) masked.push('Disk 1 crashed, but the mirror holds a copy of every file');  // a disk crash is masked when the mirror disk is installed
          const why = [];  // why lists the reasons Server A went down
          if (st.fSw) why.push('a bug crashed its OS (spare parts cannot fix software)');  // an OS crash always stops Server A: extra hardware cannot fix a software fault
          if (st.fPsu && !st.psu2) why.push('its only power supply died');  // a power failure stops Server A when there is no second power supply
          if (st.fDisk && !st.mirror) why.push('its only disk crashed' + (st.standby ? '' : ', maybe losing orders'));  // a disk crash stops Server A when there is no mirror; without a standby, orders may be lost too
          let cls, lab, msg;  // cls, lab and msg are the callout's color, heading and message, chosen below
          if (!st.fPsu && !st.fDisk && !st.fSw) {  // case 1: nothing is broken yet
            cls = 'tip'; lab = 'Store online';  // green callout headed "Store online"
            msg = (st.psu2 || st.mirror || st.standby) ? 'Nothing is broken. The spare parts sit idle, costing money, waiting for the day they are needed. Now inject a fault.' : 'Nothing is broken yet, but nothing is spare either: <b>any one</b> failure will take the store down. Try a fault, then add redundancy and try again.';  // message: spares cost money while idle, or, with no spares, any one fault will take the store down
          } else if (up) {  // case 2: something broke but Server A is still up, so a spare masked the fault
            cls = 'tip'; lab = 'Store online · fault tolerated';  // green callout headed "fault tolerated"
            msg = masked.join('; ') + '. Customers never noticed. That is <span class="t">fault tolerance</span>: normal operation continues despite the fault.';  // message: names the masked faults and introduces the term fault tolerance
          } else if (st.standby) {  // case 3: Server A is down but the standby server takes over (failover)
            cls = 'tip'; lab = 'Store online · failover to Server B';  // green callout headed "failover to Server B"
            msg = 'Server A is down: ' + why.join('; ') + '. Server B, kept in step all along, takes over in seconds.' + (st.fSw ? ' But identical copies share identical bugs: if the same input reaches B, it crashes too.' : '');  // message: why A went down, that B takes over, and that a shared software bug could crash B as well
          } else {  // case 4: Server A is down and nothing can take over
            cls = 'bad'; lab = 'Store offline';  // red callout headed "Store offline"
            msg = 'Server A is down: ' + why.join('; ') + '. Nothing was ready to take over, so every customer is turned away until someone repairs it.';  // message: why A went down and that customers are turned away until someone repairs it
          }  // ends the choice of status message
          status.className = 'callout m0 small ' + cls;  // colors the status callout: green (tip) when the store is online, red (bad) when it is offline
          status.setAttribute('data-label', lab);  // sets the callout's heading; the page's style sheet prints the data-label text above the message
          status.innerHTML = msg;  // puts the chosen message into the status callout
          /* a standby server is a full second copy of Server A, so it costs what A costs */
          const extra = (st.psu2 ? 200 : 0) + (st.mirror ? 300 : 0) + (st.standby ? 3000 : 0);  // extra: the price of the chosen spares: $200 power supply, $300 mirror disk, $3,000 standby server
          meter.firstChild.style.width = ((3000 + extra) / 6500) * 100 + '%';  // grows the cost meter; a full bar ($6,500) means a base server of $3,000 plus every spare
          const cov = [['power failure', st.psu2 || st.standby], ['disk crash', st.mirror || st.standby], [st.standby ? 'OS crash (usually)' : 'OS crash', st.standby]];  // cov: which faults the current set-up survives; a standby covers everything, but an OS crash only "usually"
          cover.replaceChildren(h('span', { class: 'lbl', style: { width: '98px' } }, 'Survives'),  // rebuilds the "Survives" row: a label followed by one chip per fault
            ...cov.map(([n, ok]) => h('span', { class: 'chip ' + (ok ? 'ok' : 'bad') }, (ok ? '✓ ' : '✗ ') + n)));  // each chip is green with a tick if that fault is covered, red with a cross if not
          const perf = [st.mirror ? 'writes go to two disks' : null, st.standby ? 'changes are copied to B' : null].filter(Boolean);  // perf lists the speed costs of the chosen spares; filter(Boolean) drops the empty entries
          cost.innerHTML = `<b>Cost $${(3000 + extra).toLocaleString('en-US')}</b>${extra ? ` (+${Math.round((extra / 3000) * 100)}%)` : ''} · ${perf.length ? 'slower: ' + perf.join(', ') : 'redundancy costs money and often speed'}`;  // cost text: the total price, the percentage it adds to the base server, and what the spares slow down
          tg.forEach(([b, key]) => { b.classList.toggle('on', st[key]); b.setAttribute('aria-pressed', st[key]); });  // marks each redundancy button as on or off; aria-pressed tells screen readers the same thing
          fl.forEach(([b, key]) => { b.disabled = st[key]; });  // disables a fault button once that fault has happened, since it cannot happen twice
        }  // ends draw()
        const tg = [['psu2', 'Second power supply'], ['mirror', 'Mirror disk'], ['standby', 'Standby server']].map(([key, label]) => [h('button', { class: 'btn sm tgl', type: 'button', onclick: () => { st[key] = !st[key]; draw(); } }, '+ ' + label), key]);  // tg: the three redundancy toggle buttons; each click installs or removes that spare and redraws
        const fl = [['fPsu', 'Power supply dies'], ['fDisk', 'Disk crashes'], ['fSw', 'OS crashes']].map(([key, label]) => [h('button', { class: 'btn sm flt', type: 'button', onclick: () => { st[key] = true; draw(); } }, label), key]);  // fl: the three fault buttons; each click breaks that part and redraws
        const repair = h('button', { class: 'btn sm ghost', type: 'button', onclick: () => { st.fPsu = st.fDisk = st.fSw = false; draw(); } }, 'Repair all');  // the Repair all button clears every fault but keeps the spares, so the student can try again
        const cover = h('div', { class: 'row', style: { gap: '6px' } });  // cover: the empty row that draw() fills with the "Survives" chips
        const left = h('div', { class: 'stack', style: { gap: '10px' } },  // left column of step 1: the explanation text
          h('p', { class: 'lead m0', html: 'Hardware wears out and software has bugs. <span class="t">Fault tolerance</span> is the ability of a system or component to <b>keep operating normally</b> even when some of its hardware or software has developed a <span class="t">fault</span>.' }),  // lead paragraph: defines fault tolerance as keeping normal operation despite a fault
          h('p', { class: 'm0', style: { fontSize: '16px' }, html: 'The usual recipe is <span class="t">redundancy</span>: spare parts, repeated work or extra information that can step in when something breaks. Redundancy is never free. It costs money, and it often costs some performance.' }),  // paragraph: redundancy is the usual recipe, and it costs money and often speed
          h('div', { class: 'callout analogy m0', 'data-label': 'Analogy', style: { fontSize: '15.5px' }, html: 'A hospital keeps a diesel generator that starts within seconds of a power cut. Nobody hopes to use it and it costs money every year, but it is why surgery never stops in the dark.' }),  // analogy callout: a hospital's backup generator, a spare nobody hopes to use
          h('div', { class: 'card tight', style: { fontSize: '14.5px', lineHeight: '1.4' } }, h('h4', {}, 'In this section you will'),  // card listing what the student will do in this section
            h('ol', { class: 'm0', style: { paddingLeft: '20px' }, html: '<li>measure reliability and availability with real numbers</li><li>place a system on the ladder of "nines"</li><li>classify faults: permanent, transient, intermittent</li><li>try spatial, temporal and information redundancy</li><li>see how the OS helps: isolation, virtual machines, locks, checkpoints</li>' })));  // the five goals of the section as a numbered list
        const right = h('div', { class: 'card white stack', style: { gap: '8px' } },  // right column of step 1: the online-store demo in a white card
          h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { class: 'm0' }, 'Break it yourself: an online store'), h('span', { class: 'small muted' }, 'add spares, then inject faults')),  // demo header: its title on the left and a short instruction on the right
          svg,  // the drawing of the customers and servers
          h('div', { class: 'row', style: { gap: '6px' } }, h('span', { class: 'lbl', style: { width: '98px' } }, 'Redundancy'), ...tg.map((x) => x[0])),  // row of redundancy buttons with a "Redundancy" label in front
          cover,  // the "Survives" row of chips
          h('div', { class: 'row', style: { gap: '6px' } }, h('span', { class: 'lbl', style: { width: '98px' } }, 'Faults'), ...fl.map((x) => x[0]), repair),  // row of fault buttons with a "Faults" label, followed by Repair all
          status,  // the status callout
          h('div', { class: 'row nw', style: { gap: '10px' } }, meter, cost));  // the cost meter and cost text side by side on one line that never wraps
        el.append(h('div', { class: 'split l fill' }, left, right));  // places the two columns side by side on the step (the "split l" layout gives the right column more room)
        draw();  // draws the first picture as soon as the step opens
      },  // ends render() for step 1
    },  // ends step 1

    /* ---------------- 2. Reliability R(t) and MTTF: a fleet of 100 machines ---------------- */
    {  // step 2 begins: reliability R(t) and MTTF, shown with a fleet of 100 machines
      title: 'Reliability: will it still be working at time t?',  // title shown at the top of step 2
      kind: 'explore',  // kind 'explore': a hands-on screen for trying values
      render(el, ctx) {  // render(el, ctx) runs when step 2 is shown
        const { h, s } = ctx;  // takes the HTML builder h and the SVG builder s from the guide's helpers
        if (ctx.narrow) el.classList.add('nar');  // on phone-width screens adds the nar class so the section's phone-width style rules apply
        const N = 100, TMAX = 4000;  // N: the number of machines in the fleet; TMAX: the right edge of the chart, 4,000 hours
        let mttf = 1000, t = 500, seed = 7, u = [];  // current slider values (MTTF and time t), the random seed, and u, one random number per machine
        const newFleet = () => { const r = ctx.util.seeded(seed); u = ctx.util.range(N).map(() => 1 - r()); };  // newFleet(): makes 100 new random numbers from a seeded generator (the same seed always gives the same fleet)
        const life = () => u.map((x) => -mttf * Math.log(x));  // life(): turns each random number into a lifetime so failures strike at random at a steady rate, averaging the MTTF
        const grid = s('svg', { viewBox: '0 0 250 250', width: '100%', style: 'max-width:222px;display:block;margin:0 auto' });  // grid: the 10 by 10 drawing of the machines, kept small and centered
        const chart = s('svg', { viewBox: '0 0 380 236', width: '100%' });  // chart: the drawing of R(t) against time
        const k1 = h('div', { class: 'big', style: { fontSize: '30px' } }), k2 = h('div', { class: 'big', style: { fontSize: '30px' } }), k3 = h('div', { class: 'big', style: { fontSize: '30px' } });  // k1, k2, k3: the three big numbers: machines still working, the formula's R(t), and the average lifetime
        const say = h('div', { class: 'callout m0 small', style: { lineHeight: '1.4', minHeight: '58px' } });  // say: the callout that explains what the student is seeing
        const X0 = 46, X1 = 368, Y0 = 12, Y1 = 192;  // the chart's plotting area: left, right, top and bottom edges in drawing units
        const px = (tt) => X0 + (tt / TMAX) * (X1 - X0), py = (r) => Y1 - r * (Y1 - Y0);  // px turns a time into a horizontal position on the chart; py turns a probability (0 to 1) into a height
        function draw() {  // draw() redraws the dots, the chart, the numbers and the message; it runs whenever a slider or button changes
          const L = life(), alive = L.filter((x) => x > t).length, f = Math.exp(-t / mttf);  // L: every machine's lifetime; alive: how many outlast time t; f: the formula R(t) = e to the power -t/MTTF
          const mean = L.reduce((a, b) => a + b, 0) / N;  // mean: the fleet's actual average lifetime, which is close to but rarely exactly the MTTF
          /* dot grid */
          const dots = [];  // dots collects the shapes of the machine grid
          L.forEach((x, i) => {  // one pass per machine
            const cx = 17 + (i % 10) * 24, cy = 17 + Math.floor(i / 10) * 24, ok = x > t;  // machine i sits in row i/10 and column i%10 of the grid; ok says it is still working at time t
            dots.push(s('circle', { cx, cy, r: 9, class: ok ? 's-ok' : 's-bad', 'stroke-width': 2 }));  // a green circle for a working machine, red for a failed one
            if (!ok) dots.push(s('path', { d: `M${cx - 4} ${cy - 4}L${cx + 4} ${cy + 4}M${cx + 4} ${cy - 4}L${cx - 4} ${cy + 4}`, style: 'stroke:var(--bad)', 'stroke-width': 2.2 }));  // a failed machine also gets an X drawn through its circle, so it reads without relying on color
          });  // ends the loop over machines
          grid.replaceChildren(...dots);  // swaps the new dots into the grid drawing
          /* chart */
          const kids = [];  // kids collects the shapes of the chart
          for (let r = 0; r <= 1.0001; r += 0.25) kids.push(s('line', { x1: X0, y1: py(r), x2: X1, y2: py(r), style: 'stroke:var(--line)' }), s('text', { x: X0 - 6, y: py(r) + 4, 'text-anchor': 'end', 'font-size': 12.5, class: 's-sub' }, r.toFixed(2)));  // horizontal grid lines at R = 0, 0.25, 0.5, 0.75 and 1, each labelled on the left
          for (let tt = 0; tt <= TMAX; tt += 1000) kids.push(s('text', { x: px(tt), y: Y1 + 18, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, tt === 0 ? '0' : (tt / 1000) + 'k h'));  // time labels along the bottom every 1,000 hours (0, 1k h, 2k h, ...)
          kids.push(s('text', { x: (X0 + X1) / 2, y: Y1 + 38, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, 'time t (hours)'));  // the axis title under the chart: time t (hours)
          let d = '';  // d will hold the path of the formula curve
          for (let i = 0; i <= 160; i++) { const tt = (i / 160) * TMAX; d += (i ? 'L' : 'M') + px(tt).toFixed(1) + ' ' + py(Math.exp(-tt / mttf)).toFixed(1); }  // samples the formula at 161 points across the chart and joins them into one smooth line
          kids.push(s('path', { d, fill: 'none', style: 'stroke:var(--chc)', 'stroke-width': 3 }));  // draws the formula curve in the chapter color
          const sorted = L.slice().sort((a, b) => a - b);  // sorted: the lifetimes from shortest to longest, the order in which the machines die
          let sd = `M${px(0)} ${py(1)}`, prev = 1;  // sd will hold the fleet's own survival curve, starting at R = 1 at time 0
          sorted.forEach((x, i) => { if (x > TMAX) return; const r = (N - i - 1) / N; sd += `L${px(x).toFixed(1)} ${py(prev).toFixed(1)}L${px(x).toFixed(1)} ${py(r).toFixed(1)}`; prev = r; });  // each failure drops the curve by one hundredth, giving a staircase (failures after 4,000 h are off the chart)
          sd += `L${px(TMAX)} ${py(prev).toFixed(1)}`;  // extends the staircase flat to the right edge of the chart
          kids.push(s('path', { d: sd, fill: 'none', style: 'stroke:var(--mem)', 'stroke-width': 2, 'stroke-dasharray': '5 3' }));  // draws the fleet's staircase as a dashed line in the memory color
          kids.push(s('line', { x1: px(mttf), y1: Y0, x2: px(mttf), y2: Y1, style: 'stroke:var(--muted)', 'stroke-dasharray': '2 4', 'stroke-width': 1.5 }),  // a dotted vertical line at t = MTTF
            s('text', { x: px(mttf) + 5, y: Y0 + 10, 'font-size': 12.5, 'font-weight': 700, class: 's-sub' }, 't = MTTF'),  // label for that line
            s('text', { x: px(mttf) + 9, y: py(Math.exp(-1)) - 7, 'font-size': 12.5, 'font-weight': 700, class: 's-sub' }, '0.37'),  // label "0.37" beside the point where the formula crosses t = MTTF (e to the -1 is about 0.37)
            s('circle', { cx: px(mttf), cy: py(Math.exp(-1)), r: 3.5, style: 'fill:var(--muted)' }));  // a small dot marking that crossing point
          kids.push(s('line', { x1: px(t), y1: Y0, x2: px(t), y2: Y1, style: 'stroke:var(--ink-2)', 'stroke-width': 2 }),  // a solid vertical line at the slider's current time t
            s('circle', { cx: px(t), cy: py(f), r: 6, style: 'fill:var(--chc);stroke:var(--panel)', 'stroke-width': 2 }));  // a colored dot where that line meets the formula curve
          chart.replaceChildren(...kids);  // swaps the new shapes into the chart drawing
          k1.textContent = alive + ' / 100';  // big number 1: machines still working, out of 100
          k2.textContent = f.toFixed(2);  // big number 2: the formula's R(t), to two decimal places
          k3.textContent = Math.round(mean).toLocaleString('en-US') + ' h';  // big number 3: the fleet's average lifetime in hours
          const atM = Math.abs(t - mttf) < 1;  // atM is true when the time slider sits exactly on the MTTF
          say.className = 'callout m0 small ' + (atM ? 'warn' : 'why');  // the callout is yellow (warn) at t = MTTF, blue (why) otherwise
          say.setAttribute('data-label', atM ? 'Look: t equals the MTTF' : 'What you see');  // callout heading: "Look: t equals the MTTF" or "What you see"
          say.innerHTML = atM  // picks one of three messages
            ? `${alive} of 100 machines still run at t = MTTF; the formula predicts 37, and with only 100 machines chance moves the count by several either way. Most machines fail <b>before</b> the MTTF: it is an <b>average</b> lifetime (${Math.round(mean).toLocaleString('en-US')} h for this fleet), not a promise.`  // at t = MTTF: only about 37 machines survive, because the MTTF is an average lifetime, not a promise
            : t === 0 ? 'At t = 0 every machine works, so R(0) = 1. Drag the time slider to the right and watch machines drop out.'  // at t = 0: every machine works, so R(0) = 1
              : `By ${t.toLocaleString('en-US')} h, ${N - alive} machines have failed, so R(${t.toLocaleString('en-US')} h) ≈ ${(alive / N).toFixed(2)} for this fleet. The formula says ${f.toFixed(2)}; the gap is chance.`;  // any other time: how many have failed, the fleet's R(t), and the formula's value, with the gap put down to chance
        }  // ends draw()
        const s1 = ctx.ui.slider({ label: 'MTTF', min: 200, max: 2000, step: 100, value: mttf, format: (v) => v.toLocaleString('en-US') + ' h', onInput: (v) => { mttf = v; draw(); } });  // MTTF slider, 200 to 2,000 hours; moving it redraws with the new average lifetime
        const s2 = ctx.ui.slider({ label: 'Time t', min: 0, max: TMAX, step: 50, value: t, format: (v) => v.toLocaleString('en-US') + ' h', onInput: (v) => { t = v; draw(); } });  // time slider, 0 to 4,000 hours; moving it redraws which machines have failed by then
        const again = h('button', { class: 'btn sm', type: 'button', onclick: () => { seed += 1; newFleet(); draw(); } }, 'New random fleet');  // New random fleet: moves to the next seed so the same MTTF produces a different set of lifetimes
        const atMttf = h('button', { class: 'btn sm', type: 'button', onclick: () => { t = mttf; s2.set(t); draw(); } }, 'Set t = MTTF');  // Set t = MTTF: jumps the time slider to the current MTTF, the moment the 37% surprise shows up
        const stat = (big, label) => h('div', { class: 'stat' }, h('span', { class: 'lbl' }, label), big);  // stat(big, label): wraps a big number with a small label above it
        const left = h('div', { class: 'stack', style: { gap: '10px' } },  // left column of step 2: the explanation text
          h('p', { class: 'lead m0', html: '<span class="t">Reliability</span>, written <b>R(t)</b>, is the probability that a system operates correctly <b>the whole time</b> from 0 up to time t, given that it was working at time 0.' }),  // lead paragraph: defines reliability R(t) as surviving the whole stretch from 0 to t
          h('p', { class: 'm0', style: { fontSize: '15.5px', lineHeight: '1.45' }, html: 'R(0) = 1, and R(t) never rises as t grows: a longer stretch gives more chances to break. The <span class="t">mean time to failure (MTTF)</span> is the average time a unit runs, from a fresh start, before it fails. A bigger MTTF means a more reliable unit.' }),  // paragraph: R(0) = 1, R(t) never rises, and a bigger MTTF means a more reliable unit
          h('div', { class: 'card tight small', style: { lineHeight: '1.4' }, html: '<b>How to read it:</b> R(500 h) = 0.61 means about 61% of identical machines started together run 500 hours with no failure.' }),  // reading tip: what R(500 h) = 0.61 means for a group of identical machines
          h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: '"MTTF is 1,000 hours, so it will run 1,000 hours." No: MTTF is an average. When failures strike at random at a steady rate (the model used here, R(t) = e<sup>−t/MTTF</sup>), only about 37% of units are still running at t = MTTF.' }),  // common-mistake callout: the MTTF is an average, so only about 37% still run at t = MTTF
          h('div', { class: 'callout why m0 small', 'data-label': 'Why it matters', html: 'Scale turns rare into routine: 10,000 disks with an MTTF of 1,000,000 hours each give 10,000 ÷ 1,000,000 = 0.01 failures per hour, a dead disk about <b>every 100 hours</b>.' }));  // why-it-matters callout: with 10,000 disks, even a huge MTTF means a dead disk every 100 hours
        const right = h('div', { class: 'card white stack', style: { gap: '8px' } },  // right column of step 2: the fleet demo in a white card
          h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { class: 'm0' }, '100 machines, all switched on at t = 0'), h('div', { class: 'row', style: { gap: '6px' } }, atMttf, again)),  // demo header: title plus the Set t = MTTF and New random fleet buttons
          s1, s2,  // the MTTF and time sliders
          h('div', { style: { display: 'grid', gridTemplateColumns: ctx.narrow ? '1fr' : 'minmax(0, 1fr) minmax(0, 1.55fr)', gap: '14px', alignItems: 'start' } },  // holds the dot grid and the chart side by side (stacked on phone-width screens)
            h('div', { class: 'stack', style: { gap: '2px' } }, grid, h('div', { class: 'xs muted center' }, 'green: still working · red: has failed')),  // the dot grid with its green/red legend underneath
            h('div', { class: 'stack', style: { gap: '2px' } }, chart, h('div', { class: 'xs muted center', html: '<b style="color:var(--chc)">━</b> formula e<sup>−t/MTTF</sup> &nbsp; <b style="color:var(--mem)">╍</b> this fleet' }))),  // the chart with a legend telling the formula curve apart from this fleet's staircase
          h('div', { class: 'stats', style: { '--n': 3 } }, stat(k1, 'still working at t'), stat(k2, 'formula R(t)'), stat(k3, 'average lifetime')),  // the three big numbers in a row of three stat boxes
          say);  // the explanation callout closes the right column
        el.append(h('div', { class: 'split l fill' }, left, right));  // places the two columns side by side on the step
        newFleet(); draw();  // creates the first fleet and draws it when the step opens
      },  // ends render() for step 2
    },  // ends step 2

    /* ---------------- 3. MTTR, uptime/downtime and availability: simulate a year ---------------- */
    {  // step 3 begins: MTTR, uptime and downtime, and availability, shown by simulating a year
      title: 'Up, down, repaired: measuring availability',  // title shown at the top of step 3
      kind: 'explore',  // kind 'explore': a hands-on screen for trying values
      core: true, // on the shorter core path
      render(el, ctx) {  // render(el, ctx) runs when step 3 is shown
        const { h, s } = ctx;  // takes the HTML builder h and the SVG builder s from the guide's helpers
        if (ctx.narrow) el.classList.add('nar');  // on phone-width screens adds the nar class so the phone-width style rules apply
        /* phones get a narrower drawing so the month labels stay readable */
        const YEAR = 8760, ROWS = 4, RW = YEAR / ROWS, BX = 44, BW = ctx.narrow ? 306 : 566;  // YEAR: hours in a year; ROWS: the year is drawn as 4 rows of 3 months; RW: hours per row; BX, BW: bar start and width
        let mttf = 500, mttr = 50, year = 1, longRun = null;  // slider values (MTTF 500 h, MTTR 50 h), which simulated year is shown, and the 100-year result once it is run
        const tl = s('svg', { viewBox: ctx.narrow ? '0 0 360 166' : '0 0 620 166', width: '100%', style: 'flex:none' });  // tl: the timeline drawing of the simulated year
        const kF = h('div', { class: 'big' }), kD = h('div', { class: 'big' }), kM = h('div', { class: 'big' }), kA = h('div', { class: 'big' });  // the four big numbers: failures, downtime, measured availability, formula availability
        const say = h('div', { class: 'callout why m0 small', 'data-label': 'Formula versus this year', style: { lineHeight: '1.42' } });  // say: the callout comparing the formula with this one simulated year
        function simulate(hours, seed) {  // simulate(hours, seed): plays out a repairable system as a run of random up periods and down (repair) periods
          const r = ctx.util.seeded(seed), ev = [];  // r: a seeded random-number generator, so the same seed replays the same year; ev collects the periods
          let t = 0, up = true, down = 0;  // t: the clock; up: whether the system is running now; down: total downtime so far
          while (t < hours) {  // keeps adding periods until the requested number of hours is covered
            const d = -(up ? mttf : mttr) * Math.log(1 - r());  // d: a random period length whose average is the MTTF while up, or the MTTR while down
            const e = Math.min(hours, t + d);  // e: when that period ends, cut off at the end of the simulated time
            ev.push([t, e, up]); if (!up) down += e - t;  // records the period as [start, end, up?]; down periods are added to the downtime total
            t = e; up = !up;  // moves the clock to the end of the period and flips between up and down
          }  // ends the loop
          return { ev, down, fails: ev.filter((x) => !x[2]).length };  // returns the periods, the total downtime, and the number of failures (one per down period)
        }  // ends simulate()
        const fA = (a) => a.toFixed(a >= 0.99 ? 4 : 3), pct = (a) => (100 * a).toFixed(a >= 0.99 ? 2 : 1) + '%';  // fA and pct format an availability as a decimal or a percentage, showing more digits once it passes 0.99
        function draw() {  // draw() redraws the timeline, the numbers and the message; it runs after every slider move or button press
          const A = mttf / (mttf + mttr);  // A: the formula availability, MTTF / (MTTF + MTTR)
          const sim = simulate(YEAR, 1000 + year * 17 + mttf * 3 + mttr);  // simulates one year; the seed mixes in the year number and both sliders, so each setting has its own repeatable year
          const k = [];  // k collects the shapes of the timeline
          for (let q = 0; q < ROWS; q++) {  // one row per quarter of the year
            const y = 6 + q * 40;  // y: the top of this row
            k.push(s('text', { x: 0, y: y + 20, 'font-size': 13, 'font-weight': 700, class: 's-sub' }, ['Jan', 'Apr', 'Jul', 'Oct'][q]));  // the row's month label on the left: Jan, Apr, Jul or Oct
            k.push(s('rect', { x: BX, y, width: BW, height: 30, rx: 5, class: 's-ok', 'stroke-width': 1.5 }));  // a full green bar for the row: the system is assumed up unless a red block says otherwise
          }  // ends the loop over rows
          sim.ev.forEach(([a, b, up]) => {  // goes through every simulated period
            if (up) return;  // up periods need nothing drawn, because the bar is already green
            for (let q = 0; q < ROWS; q++) {  // a down period may cross from one row into the next, so check each row
              const lo = Math.max(a, q * RW), hi = Math.min(b, (q + 1) * RW);  // lo and hi: the part of the down period that falls inside this row
              if (hi <= lo) continue;  // skips rows the period does not touch
              const x = BX + ((lo - q * RW) / RW) * BW, w = Math.max(2, ((hi - lo) / RW) * BW);  // x and w: where the red block starts in the row and how wide it is (at least 2 units so short repairs stay visible)
              k.push(s('rect', { x: Math.min(x, BX + BW - w), y: 6 + q * 40, width: w, height: 30, style: 'fill:var(--bad);opacity:.85' }));  // draws the red down block, kept from spilling past the end of the row
            }  // ends the loop over rows
          });  // ends the loop over periods
          tl.replaceChildren(...k);  // swaps the new shapes into the timeline drawing
          kF.textContent = sim.fails;  // big number: how many failures happened this year
          kD.textContent = Math.round(sim.down).toLocaleString('en-US') + ' h';  // big number: total hours of downtime this year
          const mA = 1 - sim.down / YEAR;  // mA: the availability measured from this year, 1 minus the fraction of the year spent down
          kM.textContent = pct(mA);  // big number: the measured availability as a percentage
          kA.textContent = pct(A);  // big number: the formula availability as a percentage
          say.innerHTML = `Formula: A = ${mttf.toLocaleString('en-US')} / (${mttf.toLocaleString('en-US')} + ${mttr}) = <b>${fA(A)}</b>, so expect about (1 − ${fA(A)}) × 8,760 ≈ <b>${ctx.util.fmt((1 - A) * YEAR, (1 - A) * YEAR < 10 ? 1 : 0)} h</b> of downtime a year. This simulated year measured ${pct(mA)}: one year is a small, lucky-or-unlucky sample.` +  // message: the formula worked through, the downtime it predicts, and how this one year compared
            (longRun ? ` Over <b>100 years</b> the measured availability was <b>${longRun}</b>, very close to the formula.` : ' Press <i>Run 100 years</i> to watch the average settle.');  // adds the 100-year result if it has been run, otherwise invites the student to run it
        }  // ends draw()
        const reset = () => { longRun = null; draw(); };  // reset(): forgets the 100-year result (it belonged to the old slider values) and redraws
        const s1 = ctx.ui.slider({ label: 'MTTF', min: 50, max: 2000, step: 50, value: mttf, format: (v) => v.toLocaleString('en-US') + ' h', onInput: (v) => { mttf = v; reset(); } });  // MTTF slider, 50 to 2,000 hours
        const s2 = ctx.ui.slider({ label: 'MTTR', min: 1, max: 200, step: 1, value: mttr, format: (v) => v + ' h', onInput: (v) => { mttr = v; reset(); } });  // MTTR slider, 1 to 200 hours
        const again = h('button', { class: 'btn sm', type: 'button', onclick: () => { year += 1; longRun = null; draw(); } }, 'Another year');  // Another year: moves to the next simulated year with the same settings, to show year-to-year luck
        const hundred = h('button', { class: 'btn sm primary', type: 'button', onclick: () => { const sim = simulate(YEAR * 100, 99 + year); longRun = pct(1 - sim.down / (YEAR * 100)); draw(); } }, 'Run 100 years');  // Run 100 years: simulates a century at once and keeps its measured availability for the message
        const stat = (big, label, color) => { if (color) big.style.color = color; return h('div', { class: 'stat' }, h('span', { class: 'lbl' }, label), big); };  // stat(big, label, color): wraps a big number with a label, optionally coloring the number
        const cycle = `<svg viewBox="0 0 460 92" width="100%">${/* cycle: a small fixed SVG drawing (written as text) of one up period followed by one repair period */''}
          <text x="85" y="14" text-anchor="middle" font-size="13" font-weight="700" style="fill:var(--ok)">time to failure (avg MTTF)</text>${/* drawing label over the green part: time to failure, on average the MTTF */''}
          <text x="196" y="14" text-anchor="middle" font-size="13" font-weight="700" style="fill:var(--bad)">MTTR</text>${/* drawing label over the red part: MTTR */''}
          <path d="M2 24v-4h166v4M174 24v-4h44v4" class="s-line" stroke-width="1.5"/>${/* brackets under those labels marking the length of each period */''}
          <rect x="2" y="28" width="168" height="26" rx="4" class="s-ok" stroke-width="1.5"/><text x="86" y="46" text-anchor="middle" font-size="13.5" font-weight="700">up</text>${/* a green "up" block */''}
          <rect x="172" y="28" width="48" height="26" rx="4" class="s-bad" stroke-width="1.5"/><text x="196" y="46" text-anchor="middle" font-size="13.5" font-weight="700">down</text>${/* a red "down" block, shorter than the up block */''}
          <rect x="222" y="28" width="150" height="26" rx="4" class="s-ok" stroke-width="1.5" opacity=".6"/><text x="297" y="46" text-anchor="middle" font-size="13.5" font-weight="700">up</text>${/* a fainter second "up" block, showing the pattern repeats */''}
          <rect x="374" y="28" width="40" height="26" rx="4" class="s-bad" stroke-width="1.5" opacity=".6"/><text x="394" y="46" text-anchor="middle" font-size="13" font-weight="700">down</text>${/* a fainter second "down" block */''}
          <text x="436" y="46" font-size="15" class="s-sub">…</text>${/* an ellipsis: the cycle keeps going */''}
          <path d="M2 60v4h216v-4" class="s-line" stroke-width="1.5"/>${/* a bracket under the first up and down blocks together */''}
          <text x="110" y="82" text-anchor="middle" font-size="13" class="s-sub">one cycle: MTTF + MTTR on average</text>${/* caption under that bracket: one cycle lasts MTTF + MTTR on average */''}
        </svg>`;  // end of the cycle drawing text
        const left = h('div', { class: 'stack', style: { gap: '9px' } },  // left column of step 3: the explanation text
          h('p', { class: 'lead m0', html: 'Real systems get repaired, so their life alternates between <b>uptime</b> and <b>downtime</b>.' }),  // lead paragraph: repaired systems alternate between uptime and downtime
          h('div', { html: cycle, style: { flex: 'none' } }),  // inserts the cycle drawing, kept at its natural height
          h('p', { class: 'm0', style: { fontSize: '15.5px', lineHeight: '1.45' }, html: 'Average uptime is the <span class="t" data-t="Mean time to failure (MTTF)">MTTF</span> (mean time to failure). Average downtime per failure is the <span class="t">mean time to repair (MTTR)</span>: noticing, finding and fixing the fault. <span class="t">Availability</span> is the fraction of time the system is up and serving:' }),  // paragraph: MTTF is the average uptime, MTTR the average repair time, and availability the fraction of time up
          h('div', { class: 'formula' }, 'A = MTTF / (MTTF + MTTR)'),  // the availability formula in its own highlighted box
          h('div', { class: 'card tight small', style: { lineHeight: '1.4' }, html: '<b>Worked example.</b> MTTF = 990 h, MTTR = 10 h. A = 990 / 1,000 = 0.99, so the system is down 1% of the year: 0.01 × 8,760 h ≈ <b>87.6&nbsp;h</b>.' }),  // worked example: MTTF 990 h and MTTR 10 h give 0.99, about 87.6 hours down a year
          h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'Reliability and availability are not the same. A server that crashes every hour but restarts in one second has poor reliability and excellent availability (about 99.97%).' }));  // common-mistake callout: reliability and availability differ, shown by a server that crashes hourly but restarts in a second
        const right = h('div', { class: 'card white stack', style: { gap: '9px' } },  // right column of step 3: the year simulation in a white card
          h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { class: 'm0' }, 'Simulate one year: 8,760 hours'), h('div', { class: 'row', style: { gap: '6px' } }, again, hundred)),  // demo header: title plus the Another year and Run 100 years buttons
          s1, s2,  // the MTTF and MTTR sliders
          h('div', { class: 'stack', style: { gap: '3px' } }, tl, h('div', { class: 'xs muted', html: '<b style="color:var(--ok)">green</b> = up, serving requests &nbsp;·&nbsp; <b style="color:var(--bad)">red</b> = down for repair &nbsp;·&nbsp; each row is three months' })),  // the timeline drawing with its legend: green is up, red is down for repair, each row three months
          h('div', { class: 'stats', style: { '--n': 4 } }, stat(kF, 'failures'), stat(kD, 'downtime'), stat(kM, 'measured A'), stat(kA, 'formula A', 'var(--chc)')),  // four stat boxes; the formula value is colored in the chapter color to set it apart from the measured ones
          say);  // the comparison callout closes the right column
        el.append(h('div', { class: 'split l fill' }, left, right));  // places the two columns side by side on the step
        draw();  // draws the first simulated year when the step opens
      },  // ends render() for step 3
    },  // ends step 3

    /* ---------------- 4. Availability classes: calculator + ladder of nines + predict ---------------- */
    {  // step 4 begins: the availability classes, with a calculator, the ladder of nines and a prediction
      title: 'Counting nines: the availability classes',  // title shown at the top of step 4
      kind: 'lab',  // kind 'lab': a screen built around an experiment the student runs
      render(el, ctx) {  // render(el, ctx) runs when step 4 is shown
        const { h } = ctx;  // takes the HTML builder h from the guide's helpers (this step draws no SVG)
        const Y = 8760;  // Y: hours in a year, used to turn an availability into yearly downtime
        const CLASSES = [  // CLASSES: the five availability classes, each [name, availability, downtime text, downtime in hours]
          ['Continuous', '1.0', 'none at all', 0],  // class row: continuous, availability 1.0, no downtime
          ['Fault tolerant', '0.99999', '≈ 5 minutes', 0.00001 * Y],  // class row: fault tolerant, five nines, about 5 minutes a year
          ['Fault resilient', '0.9999', '≈ 53 minutes', 0.0001 * Y],  // class row: fault resilient, four nines, about 53 minutes a year
          ['High availability', '0.999', '≈ 8.8 hours*', 0.001 * Y],  // class row: high availability, three nines, about 8.8 hours (the star points to a footnote)
          ['Normal availability', '0.99 – 0.995', '≈ 44 – 87 hours', 0.01 * Y],  // class row: normal availability, 0.99 to 0.995, about 44 to 87 hours
        ];  // closes the CLASSES table
        const barW = (hrs) => (hrs <= 0 ? 0 : Math.max(4, Math.min(100, (Math.log10(hrs * 60) / Math.log10(6000)) * 100)));  // barW(hrs): length of a red downtime bar, on a log scale of minutes so each extra nine shortens it by the same amount
        const rungs = CLASSES.map(([nm, av, dt, hrs], i) => h('div', { class: 'rung' },  // rungs: builds one ladder row per class
          h('span', { class: 'nm' }, nm), h('span', { class: 'av' }, av),  // the class name and its availability figure
          h('span', { class: 'dt' }, i === 0 ? 'never down: users see no outage at all' : 'down ' + dt + ' a year'), h('span', { class: 'xs muted', style: { textAlign: 'right' } }, i === 0 ? 'no downtime' : i === 4 ? '2 nines' : (6 - i) + ' nines'),  // the downtime text and, on the right, how many nines the class has
          h('div', { class: 'bar' }, h('i', { style: { width: (i === 4 ? barW(0.005 * Y) : barW(hrs)) + '%' } }))));  // the downtime bar; the normal class uses its better end (0.995) for the bar length
        const sig = (x) => { const p = Math.pow(10, Math.floor(Math.log10(x)) - 1); return Math.round(x / p) * p; };  // sig(x): rounds a number to two significant digits so slider readings stay tidy (e.g. 1,234 becomes 1,200)
        const fF = (hrs) => hrs.toLocaleString('en-US') + ' h' + (hrs >= 17520 ? ' ≈ ' + ctx.util.fmt(hrs / Y, 0) + ' yr' : hrs >= 240 ? ' ≈ ' + ctx.util.fmt(hrs / 24, 0) + ' days' : '');  // fF(hrs): writes an MTTF in hours, adding the same time in days or years once it gets large
        const fH = (hrs) => hrs >= 240 ? ctx.util.fmt(hrs / 24, 1) + ' days' : hrs >= 1 ? ctx.util.fmt(hrs, hrs < 10 ? 1 : 0) + ' h' : hrs * 60 >= 1 ? ctx.util.fmt(hrs * 60, hrs * 60 < 10 ? 1 : 0) + ' min' : ctx.util.fmt(hrs * 3600, 0) + ' s';  // fH(hrs): writes a length of time in the most readable unit: days, hours, minutes or seconds
        let mttf = 1000, mttr = 10;  // the calculator's starting values: MTTF 1,000 h, MTTR 10 h
        const bigA = h('div', { class: 'big', style: { color: 'var(--chc)' } }), bigD = h('div', { class: 'big' });  // bigA and bigD: the two big results, availability (in the chapter color) and downtime per year
        const cls = h('div', { class: 'small', style: { lineHeight: '1.4', minHeight: '42px' } });  // cls: the line naming the class the result falls in
        const eq = h('div', { class: 'mono small', style: { fontWeight: 700 } });  // eq: the formula worked through with the current numbers, in the code font
        function classify(A) {  // classify(A): finds which class an availability falls in; returns [rung number, name]
          const e = 1e-12;  // e: a tiny allowance so rounding errors in the arithmetic do not drop a value into the class below
          if (A >= 1 - e) return [0, 'Continuous'];  // exactly 1.0 is continuous
          if (A >= 0.99999 - e) return [1, 'Fault tolerant'];  // five nines or more is fault tolerant
          if (A >= 0.9999 - e) return [2, 'Fault resilient'];  // four nines or more is fault resilient
          if (A >= 0.999 - e) return [3, 'High availability'];  // three nines or more is high availability
          if (A > 0.995 + e) return [-2, 'Between normal and high'];  // above 0.995 but below 0.999 fits no class; -2 means "between normal and high"
          if (A >= 0.99 - e) return [4, 'Normal availability'];  // 0.99 up to 0.995 is normal availability
          return [-1, 'Below normal availability'];  // anything lower is below normal; -1 means no rung is highlighted
        }  // ends classify()
        function draw() {  // draw() updates the calculator and highlights the matching rung; it runs whenever a slider moves
          const A = mttf / (mttf + mttr), D = (1 - A) * Y;  // A: availability from the formula; D: the downtime it allows per year, in hours
          const nines = Math.max(0, Math.floor(-Math.log10(1 - A) + 1e-9));  // nines: how many leading nines A has (0.999 has three), found with a logarithm
          bigA.textContent = (100 * A).toFixed(Math.min(6, Math.max(1, nines))) + '%';  // big number: availability as a percentage, with more decimal places as the nines grow
          bigD.textContent = fH(D);  // big number: yearly downtime in the most readable unit
          eq.textContent = `A = ${mttf.toLocaleString('en-US')} / (${mttf.toLocaleString('en-US')} + ${ctx.util.fmt(mttr, 3)}) = ${A.toFixed(Math.min(8, nines + 3))}`;  // the worked formula line, e.g. A = 1,000 / (1,000 + 10) = 0.99010
          const [ix, name] = classify(A);  // looks up the class for this availability
          rungs.forEach((r, i) => r.classList.toggle('on', i === ix));  // highlights the matching ladder rung and clears the others
          cls.innerHTML = `<span class="chip ${ix === -1 ? 'bad' : ix === -2 ? 'warn' : ix <= 2 ? 'ok' : 'accent'}">${name}</span> <b>${nines} nine${nines === 1 ? '' : 's'}</b>. ` +  // class line: a colored chip with the class name and the count of nines
            (ix === -1 ? 'Down more than 1% of the year (over 87 hours). Raise the MTTF or cut the MTTR.'  // message when below normal: more than 1% downtime, so improve the MTTF or MTTR
              : ix === -2 ? 'Better than the normal range (0.99–0.995) but short of high availability (0.999). The classes are landmarks, not a continuous scale.'  // message when between classes: the classes are landmarks, not a smooth scale
                : ix === 1 ? 'At most about 5 minutes of downtime a year: users almost never notice.' : 'Each extra nine cuts the yearly downtime by a factor of ten.');  // message for five nines, or the general rule that each extra nine cuts downtime tenfold
        }  // ends draw()
        const sF = ctx.ui.slider({ label: 'MTTF', min: 1, max: 6, step: 'any', value: 3, format: (v) => fF(sig(Math.pow(10, v))), onInput: (v) => { mttf = sig(Math.pow(10, v)); draw(); } });  // MTTF slider on a log scale: the slider holds the power of ten, from 10 hours to 1,000,000 hours
        const sR = ctx.ui.slider({ label: 'MTTR', min: 0, max: 4, step: 'any', value: Math.log10(600), format: (v) => fH(sig(Math.pow(10, v)) / 60), onInput: (v) => { mttr = sig(Math.pow(10, v)) / 60; draw(); } });  // MTTR slider on a log scale in minutes, from 1 minute to about a week, starting at 600 minutes (10 hours)
        const setBoth = (f, r) => { mttf = f; mttr = r; sF.set(Math.log10(f)); sR.set(Math.log10(r * 60)); draw(); };  // setBoth(f, r): sets both values at once, moves both sliders to match, and redraws; used by the Try buttons
        /* predict-then-reveal */
        const fb = h('div', { class: 'small', style: { lineHeight: '1.42', display: 'none' } });  // fb: the feedback shown after the student makes a prediction, hidden until then
        const picks = [['a', 'Doubling the MTTF'], ['b', 'Halving the MTTR'], ['c', 'They tie exactly']].map(([k, label]) => h('button', { class: 'btn sm', type: 'button', onclick: () => choose(k) }, label));  // picks: the three prediction buttons, each calling choose() with its letter
        const tryA = h('button', { class: 'btn sm', type: 'button', onclick: () => setBoth(2000, 10) }, 'Try: MTTF 2,000 h, MTTR 10 h');  // Try button: sets MTTF 2,000 h with MTTR 10 h, the "double the MTTF" upgrade
        const tryB = h('button', { class: 'btn sm', type: 'button', onclick: () => setBoth(1000, 5) }, 'Try: MTTF 1,000 h, MTTR 5 h');  // Try button: sets MTTF 1,000 h with MTTR 5 h, the "halve the MTTR" upgrade
        const tries = h('div', { class: 'row', style: { gap: '6px', display: 'none' } }, tryA, tryB);  // tries: the row holding both Try buttons, hidden until the student predicts
        function choose(k) {  // choose(k): runs when a prediction button is clicked
          picks.forEach((b, i) => { b.classList.toggle('on', 'abc'[i] === k); b.setAttribute('aria-pressed', 'abc'[i] === k); });  // marks the chosen button as on and the others off
          fb.style.display = ''; tries.style.display = '';  // reveals the feedback and the Try buttons
          fb.innerHTML = (k === 'c' ? '<b style="color:var(--ok)">✓ Right, they tie.</b> ' : '<b style="color:var(--bad)">✗ Not quite: they tie.</b> ') +  // feedback opens with a green tick if the student chose "they tie", or a red cross otherwise
            'Divide top and bottom by MTTF: A = 1 / (1 + MTTR/MTTF). Only the <b>ratio</b> MTTR/MTTF matters, and both upgrades halve it, from 1/100 to 1/200: 2,000/2,010 = 1,000/1,005 = <b>99.50%</b>. Faster repair is worth exactly as much as sturdier parts.';  // explanation: only the ratio MTTR/MTTF matters, and both upgrades halve it, giving 99.50% either way
          ctx.refit();  // asks the guide to re-check that the step still fits on screen now that more text is showing
        }  // ends choose()
        const left = h('div', { class: 'stack', style: { gap: '7px' } },  // left column of step 4: the ladder of nines
          h('p', { class: 'm0', style: { fontSize: '16px', lineHeight: '1.45' }, html: 'People describe <span class="t">availability</span> by counting its nines: 0.999 is "three nines". The standard classes, with the downtime each allows per year:' }),  // intro paragraph: availability is described by counting nines, and here are the standard classes
          ...rungs,  // the five ladder rungs built above
          h('p', { class: 'xs muted m0', style: { lineHeight: '1.35' }, html: 'Red bars: yearly downtime on a log scale, so each extra nine removes the same length. *Many tables list this class as about 8.3 hours; the exact arithmetic, 0.001 × 8,760 h, gives 8.76 hours.' }));  // footnote: the bars use a log scale, and why the high-availability downtime is given as 8.8 hours
        const right = h('div', { class: 'card white stack', style: { gap: '9px' } },  // right column of step 4: the calculator in a white card
          h('h3', { class: 'm0' }, 'Availability calculator'),  // calculator heading
          sF, sR,  // the MTTF and MTTR sliders
          h('div', { class: 'grid-2', style: { gap: '12px' } }, h('div', { class: 'stat' }, h('span', { class: 'lbl' }, 'availability'), bigA), h('div', { class: 'stat' }, h('span', { class: 'lbl' }, 'downtime per year'), bigD)),  // two stat boxes side by side: availability and downtime per year
          eq, cls,  // the worked formula line and the class line
          h('div', { class: 'card tight stack', style: { gap: '7px' } },  // the predict-first card
            h('div', { class: 'small', style: { lineHeight: '1.4' }, html: '<b>Predict first.</b> Your system has MTTF = 1,000 h and MTTR = 10 h (99.01%). You can afford <b>one</b> upgrade. Which raises availability more?' }),  // the prediction question: which single upgrade raises availability more?
            h('div', { class: 'row', style: { gap: '6px' } }, ...picks), fb, tries),  // the three prediction buttons, then the feedback and the Try buttons
          h('p', { class: 'small muted m0', style: { marginTop: 'auto', lineHeight: '1.4' }, html: '<b>Reality check:</b> five nines with 1-hour repairs needs an MTTF near 100,000 h (over 11 years) for the whole system. Few parts are that good, which is why fault-tolerant systems use redundancy to hide failures.' }));  // reality check at the bottom: five nines with 1-hour repairs needs a huge MTTF, so real systems use redundancy
        el.append(h('div', { class: 'split l fill' }, left, right));  // places the two columns side by side on the step
        draw();  // fills in the calculator when the step opens
      },  // ends render() for step 4
    },  // ends step 4

    /* ---------------- 5. Faults: causes, three kinds, and a classifier game ---------------- */
    {  // step 5 begins: where faults come from, the three kinds, and a classifier game
      title: 'Faults: where they come from and how long they last',  // title shown at the top of step 5
      kind: 'lab',  // kind 'lab': a screen built around an activity
      render(el, ctx) {  // render(el, ctx) runs when step 5 is shown
        const { h } = ctx;  // takes the HTML builder h from the guide's helpers
        const KINDS = ['Permanent', 'Transient', 'Intermittent'];  // KINDS: the three answer choices, in the order the buttons appear (0, 1, 2)
        const SC = [  // SC: the ten scenarios of the classifier game, each [correct kind 0-2, cause, story, explanation]
          [0, 'Component failure', 'A disk\'s read/write head touches the spinning platter and gouges its surface. That part of the disk can never be read again.', 'The damage stays until the disk is replaced. A head crash is the classic permanent fault.'],  // scenario 1 (permanent, component failure): a disk head crash ruins part of the platter for good
          [1, 'Physical interference', 'Lightning strikes a few blocks away. A brief electrical spike on a network cable garbles one packet; every packet before and after arrives fine.', 'One burst of impulse noise, over in an instant and never repeated. Simply resending the packet works.'],  // scenario 2 (transient, interference): a lightning spike garbles one network packet, once
          [2, 'Component failure', 'A network cable\'s connector is slightly loose. Every so often, when someone bumps the desk, the link drops for a moment and then comes back.', 'It appears, vanishes and reappears at unpredictable times, and will keep doing so until someone reseats the connector.'],  // scenario 3 (intermittent, component failure): a loose connector drops the link whenever the desk is bumped
          [0, 'Program error', 'A programmer typed < where they meant <=. Every time a customer orders exactly 100 items, the invoice total comes out wrong.', 'The faulty line sits in the code <b>all the time</b>, even though only some inputs trigger it. A software bug stays until the code is fixed.'],  // scenario 4 (permanent, program error): a wrong comparison miscalculates every order of exactly 100 items
          [1, 'Physical interference', 'A particle from space strikes a memory chip and flips one bit. Once that memory word is rewritten, the chip works perfectly again.', 'The chip is undamaged and the flip happened once. Radiation-induced bit flips are the classic one-off fault.'],  // scenario 5 (transient, interference): a particle from space flips one memory bit, once
          [2, 'Component failure', 'A server with a cracked solder joint reboots itself at random: twice one week, not at all the next, depending on how warm the room is.', 'The crack opens and closes with temperature, so the fault comes and goes at moments nobody can predict.'],  // scenario 6 (intermittent, component failure): a cracked solder joint makes a server reboot at random
          [0, 'Operator error', 'An operator accidentally deletes a database server\'s configuration file. The server cannot start again until someone restores the file.', 'The erroneous state (a missing file) persists until a person repairs it. A human caused it, but it behaves like any permanent fault.'],  // scenario 7 (permanent, operator error): a deleted configuration file stops a server until it is restored
          [0, 'Design error', 'A processor\'s division circuit was designed with a few wrong entries in an internal table, so certain divisions always give a slightly wrong answer.', 'Every chip built from that design carries the flaw, all the time, until the design is corrected and the chip replaced.'],  // scenario 8 (permanent, design error): a flawed division table in a processor design gives wrong answers every time
          [1, 'Physical interference', 'During a storm the mains power flickers once for a few milliseconds and one calculation on a server comes out wrong. Everything after is normal.', 'A power-supply disturbance that happens once and is gone. Re-running the calculation gives the right answer.'],  // scenario 9 (transient, interference): one power flicker spoils one calculation
          [0, 'Data structure error', 'A bug corrupts a directory table on disk. From then on, every attempt to open files in that folder fails.', 'The damaged table stays damaged until it is rebuilt or restored, so the fault is always present.'],  // scenario 10 (permanent, data structure error): a corrupted directory table blocks a whole folder
        ];  // closes the scenario list
        let i = 0, answered = null, score = 0, results = [];  // game state: current scenario i, the button chosen (null until answered), the score, and a right/wrong record per scenario
        const pills = h('div', { class: 'row', style: { gap: '4px' } });  // pills: the row of progress segments, one per scenario
        const scoreEl = h('span', { class: 'chip accent' });  // scoreEl: the chip showing the running score
        const counter = h('span', { class: 'xs muted b' });  // counter: the small "Scenario n of 10" text
        const scen = h('div', { class: 'card', style: { fontSize: '16.5px', lineHeight: '1.45', minHeight: '104px', background: 'var(--panel-2)' } });  // scen: the card that shows the current scenario's story
        const btns = KINDS.map((k, j) => h('button', { class: 'btn fbtn', type: 'button', onclick: () => answer(j) }, k));  // btns: the three big answer buttons; clicking one calls answer() with its kind number
        const fb = h('div', { class: 'callout m0 small', style: { lineHeight: '1.42', minHeight: '96px' } });  // fb: the feedback callout under the buttons
        const next = h('button', { class: 'btn sm primary', type: 'button', onclick: () => { if (i < SC.length - 1) { i++; answered = null; draw(); } else { i = 0; score = 0; results = []; answered = null; draw(); } } });  // next: moves to the next scenario, or after the last one restarts the game from scenario 1 with a clean score
        const FIX = [['Permanent', 'Retrying is useless. Repair or replace the part, or switch to a spare that is already running.'], ['Transient', 'Simply try again: the fault is already gone.'], ['Intermittent', 'A retry usually works for now, but the fault will return until the cause is found and fixed.']];  // FIX: for each kind of fault, what usually fixes it
        const fixRows = FIX.map(([k, d]) => h('div', { class: 'fixrow' }, h('b', {}, k), h('span', {}, d)));  // fixRows: turns FIX into three table rows, the kind in bold and its remedy beside it
        function draw() {  // draw() shows the current scenario and its feedback; it runs after every answer and every Next
          const [kind, cause, text, why] = SC[i];  // unpacks the current scenario into its four parts
          fixRows.forEach((r, j) => r.classList.toggle('on', answered != null && j === kind));  // after an answer, highlights the remedy row for the correct kind
          pills.replaceChildren(...SC.map((_, j) => h('span', { class: 'pill' + (results[j] === true ? ' ok' : results[j] === false ? ' bad' : '') + (j === i ? ' cur' : '') })));  // rebuilds the progress segments: green if answered right, red if wrong, outlined if current
          scoreEl.textContent = `Score ${score} / ${results.filter((x) => x != null).length}`;  // score chip: correct answers out of the scenarios answered so far
          counter.textContent = `Scenario ${i + 1} of ${SC.length}`;  // counter text: which scenario this is
          scen.innerHTML = text;  // puts the scenario's story into its card
          btns.forEach((b, j) => { b.disabled = answered != null; b.classList.toggle('ok', answered != null && j === kind); b.classList.toggle('bad', answered != null && j === answered && j !== kind); });  // locks the buttons once answered, turns the correct one green and a wrong choice red
          if (answered == null) {  // before an answer: show a hint and hide Next
            fb.className = 'callout m0 small'; fb.setAttribute('data-label', 'Your call');  // plain callout headed "Your call"
            fb.innerHTML = 'Ask two questions. <b>Once it appears, is it there all the time?</b> Then it is permanent. If not, <b>did it happen once, or does it keep coming back?</b>';  // hint: two questions that sort any fault into the three kinds
            next.style.visibility = 'hidden';  // hides the Next button (visibility keeps its space so the layout does not jump)
          } else {  // after an answer: show whether it was right and why
            const ok = answered === kind;  // ok: did the student pick the correct kind?
            fb.className = 'callout m0 small ' + (ok ? 'tip' : 'bad');  // green callout when right, red when wrong
            fb.setAttribute('data-label', (ok ? '✓ Correct: ' : '✗ It is ') + KINDS[kind].toLowerCase() + (kind ? ' (a temporary fault)' : '') + ' · cause: ' + cause.toLowerCase());  // callout heading: right or wrong, the correct kind, "(a temporary fault)" for kinds 1 and 2, and the cause
            fb.innerHTML = why;  // the explanation of why the scenario is that kind
            next.style.visibility = '';  // shows the Next button again
            next.textContent = i < SC.length - 1 ? 'Next scenario ▶' : `Finished: ${score} / ${SC.length}. Play again`;  // button text: "Next scenario", or the final score with an offer to play again
          }  // ends the answered branch
        }  // ends draw()
        function answer(j) { if (answered != null) return; answered = j; results[i] = j === SC[i][0]; if (results[i]) score++; draw(); }  // answer(j): records the first click only, scores it, and redraws with the feedback
        const CAUSES = [['Component failure', 'a part wears out or burns out'], ['Operator error', 'a person does the wrong thing'], ['Physical interference', 'heat, noise, radiation, power dips'], ['Design error', 'a flaw in the design itself'], ['Program error', 'a bug in the code'], ['Data structure error', 'corrupted tables or lists']];  // CAUSES: the six sources of faults, each [name, short description], shown as cards on the left
        const sig = `<svg viewBox="0 0 470 146" width="100%">${/* sig: a fixed SVG drawing (written as text) comparing how long each kind of fault lasts along a time line */''}
          ${[['Permanent', 'always there once it occurs', 's-bad'], ['Transient', 'temporary: happens once', 's-warn'], ['Intermittent', 'temporary: comes and goes', 's-warn']].map(([n, sub], r) => `<text x="0" y="${r * 48 + 20}" font-size="15" font-weight="800">${n}</text><text x="0" y="${r * 48 + 37}" font-size="12.5" class="s-sub">${sub}</text><line x1="176" y1="${r * 48 + 26}" x2="462" y2="${r * 48 + 26}" class="s-muted"/>`).join('')}${/* builds the three rows of the drawing: each kind's name, a short description, and an empty time line */''}
          <rect x="250" y="17" width="212" height="18" rx="3" style="fill:var(--bad);opacity:.8"/><text x="356" y="12" text-anchor="middle" font-size="12" class="s-sub">present until repaired</text>${/* permanent row: one long red bar that starts and stays "present until repaired" */''}
          <rect x="318" y="65" width="9" height="18" rx="2" style="fill:var(--warn)"/>${/* transient row: a single short yellow blip */''}
          <rect x="204" y="113" width="10" height="18" rx="2" style="fill:var(--warn)"/><rect x="268" y="113" width="6" height="18" rx="2" style="fill:var(--warn)"/><rect x="352" y="113" width="14" height="18" rx="2" style="fill:var(--warn)"/><rect x="430" y="113" width="8" height="18" rx="2" style="fill:var(--warn)"/>${/* intermittent row: several short yellow blips at irregular times */''}
          <text x="462" y="144" text-anchor="end" font-size="12" class="s-sub">time →</text>${/* label at the bottom right: time runs to the right */''}
        </svg>`;  // end of the fault-duration drawing text
        const left = h('div', { class: 'stack', style: { gap: '7px' } },  // left column of step 5: what a fault is and its kinds
          h('p', { class: 'lead m0', html: 'A <span class="t">fault</span> is an erroneous state of the hardware or software. It can come from:' }),  // lead paragraph: a fault is an erroneous state of hardware or software, and it can come from:
          h('div', { class: 'grid-2', style: { gap: '6px' } }, ...CAUSES.map(([n, d]) => h('div', { class: 'cause' }, h('b', {}, n), h('span', {}, d)))),  // the six cause cards in a two-column grid
          h('h4', { class: 'm0', style: { marginTop: '2px' } }, 'How long it lasts: the three kinds'),  // heading for the three kinds of fault
          h('div', { html: sig, style: { flex: 'none' } }),  // inserts the fault-duration drawing
          h('p', { class: 'small m0', style: { lineHeight: '1.4' }, html: 'A <span class="t">permanent fault</span> is always there once it occurs. A <span class="t">temporary fault</span> is not: a <span class="t">transient fault</span> happens only once, while an <span class="t">intermittent fault</span> strikes at several unpredictable times.' }),  // paragraph: defines permanent, temporary, transient and intermittent faults
          h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', style: { lineHeight: '1.35', padding: '7px 12px' }, html: 'A bug that appears only for some inputs is still <b>permanent</b>: the faulty code is there all the time; only its trigger is rare.' }));  // common-mistake callout: a bug triggered only by some inputs is still permanent
        const right = h('div', { class: 'card white stack', style: { gap: '8px' } },  // right column of step 5: the classifier game in a white card
          h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { class: 'm0' }, 'Classify the fault'), h('div', { class: 'row', style: { gap: '10px' } }, counter, scoreEl)),  // game header: title on the left, scenario counter and score chip on the right
          pills, scen,  // progress segments and the scenario card
          h('div', { class: 'grid-3', style: { gap: '8px' } }, ...btns),  // the three answer buttons in a row of three
          fb,  // the feedback callout
          h('div', { class: 'stack', style: { gap: '3px', flex: 'none' } }, h('span', { class: 'lbl' }, 'What usually fixes it'), ...fixRows),  // the "What usually fixes it" table with its label
          h('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: 'auto' } }, next));  // the Next button, pushed to the bottom right of the card
        el.append(h('div', { class: 'split l fill' }, left, right));  // places the two columns side by side on the step
        draw();  // shows the first scenario when the step opens
      },  // ends render() for step 5
    },  // ends step 5

    /* ---------------- 6. Redundancy lab: spatial (TMR), temporal (retransmit), information (parity) ---------------- */
    {  // step 6 begins: the redundancy lab with three tabs, spatial, temporal and information
      title: 'Redundancy lab: extra hardware, extra time, extra bits',  // title shown at the top of step 6
      kind: 'lab',  // kind 'lab': a screen built around experiments
      core: true, // on the shorter core path
      render(el, ctx) {  // render(el, ctx) runs when step 6 is shown
        const { h, s } = ctx;  // takes the HTML builder h and the SVG builder s from the guide's helpers
        if (ctx.narrow) el.classList.add('nar');  // on phone-width screens adds the nar class so the phone-width style rules apply
        const side = (title, html) => h('div', { class: 'stack', style: { gap: '8px' } }, h('h3', { class: 'm0', html: title }), h('div', { class: 'stack', style: { gap: '8px', fontSize: '15px', lineHeight: '1.45' }, html }));  // side(title, html): builds the explanation column of a tab, a heading over a stack of paragraphs

        /* ---- spatial: triple modular redundancy ---- */
        function spatial(p) {  // spatial(p): fills tab 1 (the panel p) with the triple modular redundancy demo
          const GOOD = 42, BITS = 8;  // GOOD: the correct answer every unit should compute (42); BITS: each answer is shown as 8 bits
          const units = [GOOD, GOOD, GOOD];  // units: the answers of units A, B and C, all correct to begin with
          const rows = [], outCells = [];  // rows holds the bit buttons of each unit; outCells holds the voter's output bits
          const out = h('span', { class: 'dec' }), outChip = h('span', { class: 'chip' });  // out: the output's decimal value; outChip: says whether the output is correct
          const say = h('div', { class: 'callout m0 small', style: { lineHeight: '1.42', minHeight: '78px' } });  // say: the callout explaining what the voter did
          const bitOf = (v, b) => (v >> (BITS - 1 - b)) & 1;  // bitOf(v, b): reads bit b of the number v, counting from the left (b = 0 is the highest bit)
          let rng = ctx.util.seeded(5);  // rng: a seeded random generator for the Random bit flip button
          function draw() {  // draw() recomputes the vote and repaints all rows; it runs after every bit flip
            let maj = 0;  // maj will hold the voter's output, built one bit at a time
            for (let b = 0; b < BITS; b++) { const ones = units.reduce((n, v) => n + bitOf(v, b), 0); if (ones >= 2) maj |= 1 << (BITS - 1 - b); }  // for each bit column, counts the units with a 1 there; two or more ones set that bit in the output
            rows.forEach((r, u) => {  // repaints each unit's row
              r.cells.forEach((c, b) => { c.textContent = bitOf(units[u], b); c.classList.toggle('wbit', bitOf(units[u], b) !== bitOf(GOOD, b)); c.classList.toggle('lose', bitOf(units[u], b) !== bitOf(maj, b)); });  // shows each bit, red if it differs from 42's bit, struck through if the voter overruled it
              r.dec.textContent = units[u];  // shows the unit's value in decimal at the end of its row
              const bad = units[u] !== GOOD, out1 = units[u] !== maj;  // bad: this unit's answer is wrong; out1: the output differs from this unit (so it lost the vote)
              r.chip.className = 'chip ' + (!bad ? (out1 ? 'warn' : 'ok') : out1 ? 'warn' : 'bad');  // chip color: green if right and agreeing, yellow if outvoted, red if wrong yet it won the vote
              r.chip.textContent = !bad ? (out1 ? 'right, outvoted' : 'correct') : out1 ? 'wrong, outvoted' : 'wrong, won vote';  // chip text spelling out the same four cases
            });  // ends the loop over units
            outCells.forEach((c, b) => { c.textContent = bitOf(maj, b); c.classList.toggle('wbit', bitOf(maj, b) !== bitOf(GOOD, b)); });  // shows the voter's output bits, red where the output differs from the correct answer
            out.textContent = maj;  // shows the output's decimal value
            const okOut = maj === GOOD;  // okOut: did the vote still produce 42?
            outChip.className = 'chip ' + (okOut ? 'ok' : 'bad'); outChip.textContent = okOut ? '✓ correct' : '✗ wrong';  // output chip: green "correct" or red "wrong"
            const faulty = units.map((v, u) => (v !== GOOD ? 'ABC'[u] : null)).filter(Boolean);  // faulty: the letters of the units whose answers are wrong, e.g. ['B']
            let cls, lab, msg;  // cls, lab and msg: the callout's color, heading and message, chosen below
            if (!faulty.length) { cls = 'why'; lab = 'All three agree'; msg = 'Each unit computes 23 + 19 = 42 (binary 00101010). <b>Click any bit</b> in one unit to flip it, as a failing circuit might.'; }  // no faulty unit: explain the sum and invite the student to flip a bit
            else if (faulty.length === 1) { cls = 'tip'; lab = 'Fault masked'; msg = `Unit ${faulty[0]} is wrong (it says ${units['ABC'.indexOf(faulty[0])]}), but the other two outvote it 2 to 1 in every bit, so the output stays 42. The disagreement also tells the system that unit ${faulty[0]} needs repair.`; }  // one faulty unit: the other two outvote it in every bit, so the fault is masked and the unit flagged for repair
            else if (okOut) { cls = 'warn'; lab = 'Lucky'; msg = `${faulty.length === 3 ? 'All three units are' : 'Units ' + faulty.join(' and ') + ' are both'} wrong, but in <b>different</b> bits, so every bit column still has a correct majority. TMR only promises to survive <b>one</b> faulty unit.`; }  // two or three faulty units but the output is still right: lucky, because their wrong bits are in different columns
            else { cls = 'bad'; lab = 'Majority is wrong'; msg = `${faulty.length === 3 ? 'All three units are faulty, and at least two' : 'Two units'} are wrong in the <b>same</b> bit, so the majority there is wrong and the output becomes ${maj}. The voter only counts votes; it cannot tell which unit is right. TMR masks one faulty unit, not two.`; }  // otherwise the majority itself is wrong in some bit: TMR only masks one faulty unit
            say.className = 'callout m0 small ' + cls; say.setAttribute('data-label', lab); say.innerHTML = msg;  // paints the callout with the chosen color, heading and message
          }  // ends draw() for the TMR demo
          const bitRow = (label, cells, dec, chip, cls) => h('div', { class: 'tmr-row ' + (cls || '') }, h('span', { class: 'b' }, label), ...cells, dec, chip);  // bitRow(...): lays out one row of the demo: its label, the bit cells, the decimal value and a status chip
          ['A', 'B', 'C'].forEach((nm, u) => {  // builds the bit buttons for units A, B and C
            const cells = ctx.util.range(BITS).map((b) => h('button', { class: 'tbit', type: 'button', 'aria-label': `Flip bit ${BITS - 1 - b} of unit ${nm}`, onclick: () => { units[u] ^= 1 << (BITS - 1 - b); draw(); } }));  // eight buttons per unit; a click flips that bit with ^= (XOR, "exclusive or", turns just that bit 0 to 1 or 1 to 0) and redraws
            rows.push({ cells, dec: h('span', { class: 'dec' }), chip: h('span', { class: 'chip' }) });  // stores the unit's buttons with an empty decimal value and chip to fill in later
          });  // ends the loop over units
          ctx.util.range(BITS).forEach(() => outCells.push(h('span', { class: 'tbit out' })));  // the output row's eight bits are plain boxes, not buttons: only the voter decides them
          const reset = h('button', { class: 'btn sm', type: 'button', onclick: () => { units.fill(GOOD); draw(); } }, 'Repair all units');  // Repair all units: sets all three back to 42
          const rand = h('button', { class: 'btn sm intr', type: 'button', onclick: () => { const u = Math.floor(rng() * 3), b = Math.floor(rng() * BITS); units[u] ^= 1 << b; draw(); } }, 'Random bit flip');  // Random bit flip: flips one random bit in one random unit, as a real hardware fault might
          const demo = h('div', { class: 'card white stack', style: { gap: '7px' } },  // demo: the TMR card on the right of the tab
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'Triple modular redundancy'), h('div', { class: 'row', style: { gap: '6px' } }, rand, reset)),  // card header: title plus the Random bit flip and Repair all units buttons
            ...rows.map((r, u) => bitRow('Unit ' + 'ABC'[u], r.cells, r.dec, r.chip)),  // one row for each of units A, B and C
            h('div', { class: 'voter' }, '▼  voter: takes the majority in each bit column  ▼'),  // the voter strip between the units and the output
            bitRow('Output', outCells, out, outChip, 'outrow'),  // the output row, built the same way as the unit rows
            h('div', { class: 'xs muted', html: '<b style="color:var(--bad)">red</b> = differs from the correct answer · <s>struck through</s> = outvoted by the other two units' }),  // legend: red means differs from the correct answer, struck through means outvoted
            say);  // the explanation callout closes the card
          p.append(h('div', { class: 'split l fill' },  // fills the tab panel: explanation on the left, demo on the right
            side('<span class="t" data-t="Spatial redundancy">Spatial (physical) redundancy</span>', '<p class="m0">Several physical components do the same job <b>at the same time</b>, or a spare stands by, ready to take over.</p>' +  // explanation heading and first paragraph: several components do the same job at the same time, or a spare waits
              '<p class="m0"><b>Run in parallel and vote.</b> Three identical units compute the same result and a voter passes on the majority: <span class="t">triple modular redundancy (TMR)</span>.</p>' +  // paragraph: run in parallel and vote, which is triple modular redundancy (TMR)
              '<p class="m0"><b>Hot standby.</b> A spare runs alongside and takes over the moment the primary fails, such as a backup name server that answers when the main one is down.</p>' +  // paragraph: hot standby, a spare that takes over the moment the primary fails
              '<div class="callout tip m0 small" data-label="Handles">A fault of any kind in <b>one</b> unit, even a permanent one. It cannot help when every copy shares the same design flaw or bug.</div>' +  // "Handles" callout: any fault in one unit, but not a flaw shared by every copy
              '<div class="callout warn m0 small" data-label="Costs">Three units plus a voter: roughly triple the hardware, power and space. The voter itself must be extremely reliable, because if it fails, everything fails.</div>'),  // "Costs" callout: triple the hardware, and the voter must be extremely reliable
            demo));  // the demo card goes in the right column
          draw();  // paints the demo for the first time when the tab opens
        }  // ends spatial()

        /* ---- temporal: retransmit on error ---- */
        function temporal(p) {  // temporal(p): fills tab 2 with the resend-on-error animation
          const SEND = { pos: 'send', attempt: 1, cap: 'The sender computes a <b>checksum</b> from the frame\'s bits and attaches it to the frame.' };  // SEND: the first frame of every script, the sender attaching a checksum; shared so it is written only once
          const SCRIPTS = {  // SCRIPTS: three animations, each a list of frames; pos says where the data frame is drawn, cap is the caption
            clean: [SEND,  // script "clean": a transmission with no fault
              { pos: 'mid', attempt: 1, cap: 'The frame travels across the link.' },  // frame 2: the data frame crosses the link
              { pos: 'recv', attempt: 1, check: 'ok', cap: 'The receiver recomputes the checksum from the bits it got. It matches, so the frame is accepted.' },  // frame 3: the receiver's checksum matches, so the frame is accepted
              { pos: 'recv', attempt: 1, check: 'ok', back: 'ACK', done: 'ok', cap: 'The receiver returns an acknowledgment (ACK). One transmission, no time wasted.' }],  // frame 4: an ACK goes back; one transmission was enough
            noise: [SEND,  // script "noise": a transient fault fixed by resending
              { pos: 'mid', attempt: 1, noise: true, bad: true, cap: 'A burst of electrical noise hits the cable and flips some of the frame\'s bits: a <span class="t">transient fault</span>.' },  // frame 2: a noise burst flips bits in the frame while it is on the cable
              { pos: 'recv', attempt: 1, bad: true, check: 'bad', cap: 'The recomputed checksum does not match, so the error is <b>detected</b>. The receiver throws the damaged frame away.' },  // frame 3: the checksum does not match, so the error is detected and the frame thrown away
              { pos: 'recv', attempt: 1, bad: true, check: 'bad', back: 'NAK', log: 'corrupted, NAK', cap: 'It sends back a negative acknowledgment (NAK), which means "please send that again".' },  // frame 4: the receiver sends a NAK asking for the frame again (log adds a "corrupted" chip)
              { pos: 'send', attempt: 2, cap: 'The sender kept a copy, so it transmits the same frame again. Doing the work twice is the redundancy.' },  // frame 5: the sender kept a copy and sends it again; doing the work twice is the redundancy
              { pos: 'mid', attempt: 2, cap: 'The noise burst is over, so this time the frame crosses cleanly.' },  // frame 6: the burst is over and the frame crosses cleanly
              { pos: 'recv', attempt: 2, check: 'ok', back: 'ACK', done: 'ok', cap: 'Checksum matches, ACK sent. Repeating the work <b>masked</b> the transient fault, at the cost of one extra transmission time.' }],  // frame 7: checksum matches and an ACK is sent; the transient fault was masked at the cost of one extra send
            cut: [Object.assign({}, SEND, { cut: true, cap: 'Same frame, same checksum. But this time the cable has been cut: a <span class="t">permanent fault</span>.' }),  // script "cut": a permanent fault that retrying cannot fix; frame 1 reuses SEND with a cut cable and its own caption
              { pos: 'lost', attempt: 1, cut: true, log: 'lost', cap: 'The frame reaches the break and is lost. Nothing arrives, so nothing comes back.' },  // frame 2: the frame is lost at the break, so nothing comes back
              { pos: 'send', attempt: 2, cut: true, timeout: true, cap: 'The sender\'s timer runs out with no ACK, so it sends the frame again: attempt 2.' },  // frame 3: the sender's timer expires with no ACK, so it sends attempt 2
              { pos: 'lost', attempt: 2, cut: true, log: 'lost', cap: 'Lost at the break again. The fault has not gone away.' },  // frame 4: lost again at the break
              { pos: 'send', attempt: 3, cut: true, timeout: true, cap: 'The timer expires again: attempt 3.' },  // frame 5: the timer expires again, attempt 3
              { pos: 'lost', attempt: 3, cut: true, log: 'lost', done: 'fail', cap: 'Lost again. After 3 tries the sender gives up and reports the link as failed. Retrying cannot fix a <b>permanent</b> fault; that needs spatial redundancy, such as a second cable.' }],  // frame 6: lost again; after three tries the sender gives up, since only a second cable would help
          };  // closes the SCRIPTS table
          let mode = 'noise';  // mode: which script is playing, starting with the noise burst
          const svg = s('svg', { viewBox: ctx.narrow ? '0 0 360 176' : '0 0 600 176', width: '100%', style: 'flex:none' });  // svg: the drawing of sender, cable and receiver (a smaller layout on phones)
          const chips = h('div', { class: 'row', style: { gap: '6px', minHeight: '26px' } });  // chips: the row of status chips under the player, kept at least one chip tall
          /* geometry: the wide layout, or a narrower one for phones so the labels stay legible */
          const G = ctx.narrow  // G: every position used in the drawing; phones get a smaller set so the labels stay legible
            ? { sx: 4, sw: 88, rx: 268, cx: 178, noise: 'M226 14 L210 40 L222 40 L206 66', nx: 232, pos: { send: 126, mid: 162, recv: 228, lost: 132 }, fw: 62, a1: 264, a2: 96, al: 180 }  // phone positions: box x and width, cut position, noise zigzag, frame positions, frame width, ACK arrow ends
            : { sx: 8, sw: 118, rx: 474, cx: 301, noise: 'M318 14 L302 40 L314 40 L298 66', nx: 326, pos: { send: 168, mid: 238, recv: 432, lost: 262 }, fw: 72, a1: 470, a2: 134, al: 300 };  // wide-screen positions for the same things
          const SC = G.sx + G.sw / 2, RC = G.rx + G.sw / 2, L0 = G.sx + G.sw;  // SC and RC: the centers of the sender and receiver boxes; L0: where the cable starts
          function drawFrame(f) {  // drawFrame(f): draws one frame of the animation from its description f
            const k = [];  // k collects the shapes of this frame
            k.push(s('rect', { x: G.sx, y: 44, width: G.sw, height: 74, rx: 12, class: 's-proc', 'stroke-width': 2 }), s('text', { x: SC, y: 86, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800 }, 'Sender'),  // the Sender box and its label
              s('rect', { x: G.rx, y: 44, width: G.sw, height: 74, rx: 12, class: 's-proc', 'stroke-width': 2 }), s('text', { x: RC, y: 86, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800 }, 'Receiver'));  // the Receiver box and its label
            if (f.cut) {  // when the cable is cut, draw it in two pieces
              k.push(s('line', { x1: L0, y1: 81, x2: G.cx - 11, y2: 81, class: 's-line' }), s('line', { x1: G.cx + 11, y1: 81, x2: G.rx, y2: 81, class: 's-line' }),  // the two pieces of cable with a gap in the middle
                s('text', { x: G.cx, y: 88, 'text-anchor': 'middle', 'font-size': 22, 'font-weight': 900, style: 'fill:var(--bad)' }, '✗'),  // a red cross in the gap
                s('text', { x: G.cx, y: 110, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, style: 'fill:var(--bad)' }, 'cable cut'));  // the words "cable cut" under the cross
            } else k.push(s('line', { x1: L0, y1: 81, x2: G.rx, y2: 81, class: 's-line' }));  // otherwise one unbroken cable
            if (f.noise) k.push(s('path', { d: G.noise, fill: 'none', style: 'stroke:var(--warn)', 'stroke-width': 3, 'stroke-linejoin': 'round' }), s('text', { x: G.nx, y: 26, 'font-size': 13, 'font-weight': 700, style: 'fill:var(--warn)' }, 'noise burst'));  // during a noise burst, a yellow zigzag lightning mark over the cable with the label "noise burst"
            const X = G.pos[f.pos];  // X: the horizontal position of the data frame in this animation frame
            if (f.pos === 'lost') k.push(s('text', { x: X, y: 70, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 700, style: 'fill:var(--bad)' }, 'frame lost'));  // a lost frame is shown only as the red words "frame lost"
            else k.push(s('rect', { x: X - G.fw / 2, y: 66, width: G.fw, height: 30, rx: 6, class: f.bad ? 's-bad' : 's-accent', 'stroke-width': 2 }),  // otherwise a small box for the data frame, red if its bits were damaged
              s('text', { x: X, y: 86, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800 }, f.bad ? 'fr4me ✗' : 'frame'));  // its label: "frame", or the garbled "fr4me ✗" when damaged
            k.push(s('text', { x: SC, y: 36, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, class: 's-sub' }, 'attempt ' + f.attempt));  // "attempt n" over the sender
            if (f.timeout) k.push(s('text', { x: SC, y: 138, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, style: 'fill:var(--warn)' }, 'timer expired'));  // "timer expired" under the sender when a resend was forced by the timeout
            if (f.check) k.push(s('text', { x: RC, y: 36, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 800, style: f.check === 'ok' ? 'fill:var(--ok)' : 'fill:var(--bad)' }, f.check === 'ok' ? 'checksum ✓' : 'checksum ✗'));  // over the receiver: "checksum ✓" in green or "checksum ✗" in red
            if (f.back) { const ok = f.back === 'ACK'; k.push(s('line', { x1: G.a1, y1: 152, x2: G.a2, y2: 152, style: ok ? 'stroke:var(--ok)' : 'stroke:var(--bad)', 'stroke-width': 2.5, 'marker-end': ok ? 'url(#arr-ok)' : 'url(#arr-bad)' }), s('text', { x: G.al, y: 145, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800, style: ok ? 'fill:var(--ok)' : 'fill:var(--bad)' }, f.back)); }  // a reply arrow from receiver back to sender, green for ACK or red for NAK, with its label
            svg.replaceChildren(...k);  // swaps the finished shapes into the drawing
          }  // ends drawFrame()
          function drawChips(i) {  // drawChips(i): rebuilds the status chips for frame i of the current script
            const sc = SCRIPTS[mode], f = sc[i], done = [];  // sc: the current script; f: the current frame; done collects the outcomes so far
            sc.slice(0, i + 1).forEach((g) => { if (g.log) done.push(['bad', `Try ${g.attempt}: ${g.log}`]); if (g.done === 'ok') done.push(['ok', `Try ${g.attempt}: delivered, ACK`]); });  // walks the frames up to now, adding a red chip for each failed try and a green one for a delivery
            const tx = f.pos === 'send' ? f.attempt - 1 : f.attempt;  // tx: transmissions so far; a frame shown at the sender has not been sent yet, so it is not counted
            chips.replaceChildren(h('span', { class: 'chip accent' }, `Transmissions: ${tx}`), ...done.map(([c, t]) => h('span', { class: 'chip ' + c }, t)),  // rebuilds the chips: the transmission count first, then each outcome
              ...(f.done === 'fail' ? [h('span', { class: 'chip bad' }, 'Gave up: link failed')] : []));  // adds a final red "Gave up" chip when the script ends in failure
          }  // ends drawChips()
          const player = ctx.ui.player({ count: SCRIPTS[mode].length, interval: 1900, render: (i) => { const f = SCRIPTS[mode][i]; drawFrame(f); drawChips(i); return f.cap; } });  // player: the guide's step-by-step animation player (play, pause, next, back); each step draws its frame and returns its caption
          const seg = ctx.ui.seg([{ value: 'clean', label: 'Clean line' }, { value: 'noise', label: 'Noise burst (transient)' }, { value: 'cut', label: 'Cable cut (permanent)' }], mode, (v) => { mode = v; player.stop(); player.setCount(SCRIPTS[mode].length); });  // seg: a row of three buttons to pick the script; a change stops the player and restarts it on the new script
          const demo = h('div', { class: 'card white stack', style: { gap: '8px' } },  // demo: the animation card on the right of the tab
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'Resend on error'), seg),  // card header: title plus the script picker
            svg, player.el, chips);  // the drawing, the player controls with the caption, and the status chips
          p.append(h('div', { class: 'split l fill' },  // fills the tab panel: explanation on the left, demo on the right
            side('<span class="t">Temporal redundancy</span>', '<p class="m0"><b>Repeat an operation</b> when an error is detected. No extra hardware is needed: the extra resource is <b>time</b>.</p>' +  // explanation heading and first paragraph: repeat an operation when an error is detected; the extra resource is time
              '<p class="m0">Classic example: a network link sends data in blocks called <b>frames</b>. Each frame carries a <b>checksum</b>, a short number calculated from its bits. The receiver recalculates it; if the two disagree, the frame was damaged and is simply sent again.</p>' +  // paragraph: frames and checksums, the classic example of resending damaged data
              '<div class="callout tip m0 small" data-label="Works for">Temporary faults, both transient and intermittent: by the time you try again, the fault has usually passed.</div>' +  // "Works for" callout: temporary faults, which have usually passed by the next try
              '<div class="callout bad m0 small" data-label="Useless for">Permanent faults. Resending over a cut cable fails every time. Also, the error must first be <b>detected</b>, which is why the frame carries a checksum.</div>'),  // "Useless for" callout: permanent faults, and the error must be detected before it can be retried
            demo));  // the animation card goes in the right column
        }  // ends temporal()

        /* ---- information: row and column parity (detect and correct) ---- */
        function info(p) {  // info(p): fills tab 3 with the row-and-column parity demo
          const ORIG = [[1, 0, 1, 1], [0, 1, 1, 0], [0, 1, 0, 1], [1, 1, 0, 0]];  // ORIG: the original 4 by 4 block of data bits
          const par = (arr) => arr.reduce((a, b) => a ^ b, 0);  // par(arr): the parity of a list of bits, found by XOR-ing them together: 1 if the count of 1s is odd, 0 if even
          const col = (d, c) => d.map((r) => r[c]);  // col(d, c): collects column c of the block as a list
          const RP0 = ORIG.map(par), CP0 = [0, 1, 2, 3].map((c) => par(col(ORIG, c)));  // RP0 and CP0: the correct parity bit for each row and each column of the original data
          let d = ORIG.map((r) => r.slice()), rp = RP0.slice(), cp = CP0.slice();  // d, rp, cp: the current data and parity bits, which the student can damage; they start as copies of the originals
          const cell = (onclick, label) => h('button', { class: 'pbit', type: 'button', 'aria-label': label, onclick });  // cell(onclick, label): makes one clickable bit square; label is read aloud by screen readers
          const dCells = d.map((r, i) => r.map((_, j) => cell(() => { d[i][j] ^= 1; draw(); }, `Flip data bit row ${i + 1} column ${j + 1}`)));  // dCells: a 4 by 4 grid of data-bit buttons; each click flips that bit and redraws
          const rCells = rp.map((_, i) => cell(() => { rp[i] ^= 1; draw(); }, `Flip parity bit of row ${i + 1}`));  // rCells: the four row parity bits, also clickable, since parity bits can be hit by faults too
          const cCells = cp.map((_, j) => cell(() => { cp[j] ^= 1; draw(); }, `Flip parity bit of column ${j + 1}`));  // cCells: the four column parity bits, also clickable
          const rChk = [0, 1, 2, 3].map(() => h('span', { class: 'pchk' })), cChk = [0, 1, 2, 3].map(() => h('span', { class: 'pchk' }));  // rChk and cChk: the tick or cross shown beside each row and under each column
          const say = h('div', { class: 'callout m0 small', style: { lineHeight: '1.42' } });  // say: the callout explaining what the checks found
          let fix = null;  // fix: the repair the code can make right now, or null when it cannot correct anything
          const fixBtn = h('button', { class: 'btn sm primary', type: 'button', onclick: () => { if (fix) { fix(); draw(); } } }, 'Correct it');  // Correct it: applies the repair, if there is one, and redraws
          const restore = h('button', { class: 'btn sm', type: 'button', onclick: () => { d = ORIG.map((r) => r.slice()); rp = RP0.slice(); cp = CP0.slice(); draw(); } }, 'Restore original');  // Restore original: puts back the original data and parity bits
          function draw() {  // draw() recomputes every check and repaints the grid; it runs after every click
            const fr = [0, 1, 2, 3].filter((i) => par(d[i]) !== rp[i]), fc = [0, 1, 2, 3].filter((j) => par(col(d, j)) !== cp[j]);  // fr and fc: the rows and columns whose parity no longer matches their stored parity bit
            let wrong = 0;  // wrong counts how many bits differ from the original, known to the demo but not to the code
            d.forEach((r, i) => r.forEach((v, j) => { const c = dCells[i][j]; c.textContent = v; c.classList.toggle('wbit', v !== ORIG[i][j]); c.classList.toggle('hit', fr.includes(i) && fc.includes(j) && fr.length === 1 && fc.length === 1); if (v !== ORIG[i][j]) wrong++; c.classList.toggle('inrow', fr.includes(i)); c.classList.toggle('incol', fc.includes(j)); }));  // paints each data bit: red if changed, ringed if it sits where the one failing row and one failing column cross, yellow if in a failing line
            rCells.forEach((c, i) => { c.textContent = rp[i]; c.classList.toggle('wbit', rp[i] !== RP0[i]); if (rp[i] !== RP0[i]) wrong++; });  // paints the row parity bits, red if changed, and adds them to the wrong count
            cCells.forEach((c, j) => { c.textContent = cp[j]; c.classList.toggle('wbit', cp[j] !== CP0[j]); if (cp[j] !== CP0[j]) wrong++; });  // paints the column parity bits the same way
            rChk.forEach((c, i) => { const bad = fr.includes(i); c.textContent = bad ? '✗' : '✓'; c.className = 'pchk ' + (bad ? 'bad' : 'ok'); });  // row checks: a green tick if the row still has even parity, a red cross if not
            cChk.forEach((c, j) => { const bad = fc.includes(j); c.textContent = bad ? '✗' : '✓'; c.className = 'pchk ' + (bad ? 'bad' : 'ok'); });  // column checks: the same for each column
            fix = null;  // clears any old repair before deciding what can be done now
            let cls, lab, msg;  // cls, lab and msg: the callout's color, heading and message, chosen below
            if (!fr.length && !fc.length) {  // case: every check passes
              if (!wrong) { cls = 'why'; lab = 'All 8 checks pass'; msg = 'Every row and every column holds an even number of 1s. <b>Click any bit</b>, data or parity, to flip it the way noise or radiation might.'; }  // nothing changed: invite the student to flip a bit
              else { cls = 'bad'; lab = 'Undetected!'; msg = `Every check passes, yet ${wrong} bits differ from the original: the flips cancelled out in every row and column. No code catches everything; stronger codes just make such patterns far less likely.`; }  // bits changed but every check passes: the flips cancelled out, so the damage went undetected
            } else if (fr.length === 1 && fc.length === 1) {  // case: exactly one row and one column fail
              const [i] = fr, [j] = fc;  // i and j: the failing row and the failing column
              fix = () => { d[i][j] ^= 1; };  // the repair: flip the data bit where they cross
              cls = 'tip'; lab = 'Detected and located';  // green callout headed "Detected and located"
              msg = `Row ${i + 1} and column ${j + 1} both fail. If only one bit flipped, it must sit where they cross, so the code knows exactly which bit to flip back: press <b>Correct it</b>.`;  // message: a single flipped bit must sit at the crossing, so the code can fix it
            } else if (fr.length + fc.length === 1) {  // case: only one row or only one column fails
              const isRow = fr.length === 1, k = isRow ? fr[0] : fc[0];  // isRow: whether it is a row that failed; k: which one
              fix = () => { if (isRow) rp[k] ^= 1; else cp[k] ^= 1; };  // the repair: flip that line's own parity bit back
              cls = 'tip'; lab = 'Detected: a parity bit was hit';  // green callout headed "a parity bit was hit"
              msg = `Only ${isRow ? 'row' : 'column'} ${k + 1} fails and no ${isRow ? 'column' : 'row'} does. If only one bit flipped, the data is fine and the ${isRow ? 'row' : 'column'}'s own parity bit is the one that changed. <b>Correct it</b> recomputes that bit.`;  // message: the data is fine; the parity bit itself was the one that changed
            } else {  // case: any other pattern of failures
              cls = 'warn'; lab = 'Detected, but not correctable';  // yellow callout headed "Detected, but not correctable"
              msg = `${fr.length} row check${fr.length === 1 ? '' : 's'} and ${fc.length} column check${fc.length === 1 ? '' : 's'} fail: more than one bit is wrong, and the pattern no longer points to a single bit. The damage is <b>detected</b>, but the data must be re-read or restored from a copy.`;  // message: several bits are wrong, so the pattern no longer points to one bit; re-read or restore from a copy
            }  // ends the choice of case
            fixBtn.disabled = !fix;  // enables Correct it only when there is a repair to make
            say.className = 'callout m0 small ' + cls; say.setAttribute('data-label', lab); say.innerHTML = msg;  // paints the callout with the chosen color, heading and message
          }  // ends draw() for the parity demo
          const hdr = (t) => h('span', { class: 'xs muted b center' }, t);  // hdr(t): a small grey heading cell in the grid
          const grid = h('div', { class: 'pgrid' },  // grid: the parity block laid out as a 7-column grid
            hdr(''), hdr('c1'), hdr('c2'), hdr('c3'), hdr('c4'), hdr('parity'), hdr('check'),  // top row: column headings c1 to c4, then "parity" and "check"
            ...[0, 1, 2, 3].flatMap((i) => [hdr('r' + (i + 1)), ...dCells[i], rCells[i], rChk[i]]),  // four data rows: a heading r1 to r4, four data bits, the row's parity bit and its check mark
            hdr('parity'), ...cCells, h('span'), h('span'),  // row of column parity bits, with two empty cells to fill the last columns
            hdr('check'), ...cChk, h('span'), h('span'));  // row of column check marks, with two empty cells
          rCells.concat(cCells).forEach((c) => c.classList.add('par'));  // tints every parity bit so it stands apart from the data bits
          const demo = h('div', { class: 'card white stack', style: { gap: '9px' } },  // demo: the parity card on the right of the tab
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, '16 data bits + 8 parity bits'), h('div', { class: 'row', style: { gap: '6px' } }, fixBtn, restore)),  // card header: title plus the Correct it and Restore original buttons
            h('div', { style: { display: 'grid', gridTemplateColumns: ctx.narrow ? '1fr' : 'auto minmax(0, 1fr)', gap: '14px', alignItems: 'start' } }, grid, h('div', { class: 'stack', style: { gap: '8px' } }, say,  // grid on the left and the explanation on the right (stacked on phone-width screens)
              h('p', { class: 'xs muted m0', style: { lineHeight: '1.4' }, html: 'Each <b style="color:var(--os)">parity bit</b> makes its row or column hold an even number of 1s. A check shows ✗ when the count has turned odd.' }))),  // key: what a parity bit does and what a cross means
            h('div', { class: 'card tight small', style: { lineHeight: '1.4' }, html: '<b>Try these:</b> (1) flip one data bit; (2) flip a parity bit; (3) flip two bits in the same row; (4) flip the four corners of a rectangle, such as r1c1, r1c2, r2c1 and r2c2. Which ones does the code catch, and which can it fix?' }));  // card suggesting four experiments, from one flipped bit to a rectangle of four
          p.append(h('div', { class: 'split l fill' },  // fills the tab panel: explanation on the left, demo on the right
            side('<span class="t">Information redundancy</span>', '<p class="m0">Store <b>extra bits</b> computed from the data (a code), or extra copies of it, so that errors can be <b>detected</b> and often <b>corrected</b>.</p>' +  // explanation heading and first paragraph: store extra bits so errors can be detected and often corrected
              '<p class="m0"><b>Error-correcting code (ECC) memory</b> stores a few check bits with every memory word, enough to find and silently repair one flipped bit. <b>RAID</b> (a redundant array of independent disks) spreads data plus parity over several disks, so a dead disk\'s contents can be rebuilt from the others.</p>' +  // paragraph: ECC memory and RAID, two everyday uses of information redundancy
              '<p class="m0">The demo uses the simplest code: a <b>parity bit</b> (an extra bit that makes a group\'s count of 1s even) for each row and column.</p>' +  // paragraph: the demo uses the simplest code, one parity bit per row and column
              '<div class="callout tip m0 small" data-label="Handles, and costs">Bit flips from noise or radiation, and data lost with a failed disk. The price: extra storage and a little computation on every read and write.</div>' +  // "Handles, and costs" callout: bit flips and dead disks, paid for with storage and some computing
              '<div class="card tight small" style="line-height:1.4"><b>RAID parity in one line.</b> Three disks hold <code>1011</code>, <code>0110</code>, <code>0101</code>; a fourth holds their XOR, <code>1000</code>. Disk 2 dies? XOR the survivors: <code>1011 ⊕ 0101 ⊕ 1000 = 0110</code>, its lost contents.</div>'),  // card: RAID parity worked in one line, rebuilding a dead disk by XOR-ing the survivors
            demo));  // the parity card goes in the right column
          draw();  // paints the grid for the first time when the tab opens
        }  // ends info()

        const tabs = ctx.ui.tabs([  // tabs: the guide's tab strip; each tab's render function builds its panel when the tab is opened
          { label: 'Spatial: extra hardware', render: spatial },  // tab 1: spatial redundancy (TMR)
          { label: 'Temporal: do it again', render: temporal },  // tab 2: temporal redundancy (resend on error)
          { label: 'Information: extra bits', render: info },  // tab 3: information redundancy (parity)
        ]);  // closes the list of tabs
        el.append(h('div', { class: 'stack fill', style: { gap: '6px' } },  // step 6 layout: an intro sentence above the tabs
          h('p', { class: 'm0', style: { fontSize: '16.5px' }, html: 'Few parts are reliable enough on their own, so fault-tolerant systems add <span class="t">redundancy</span>. There are three kinds. Open each tab and try to break it.' }),  // intro: few parts are reliable enough alone, so systems add redundancy of three kinds
          h('div', { class: 'grow' }, tabs)));  // the tabs fill the rest of the step's height
      },  // ends render() for step 6
    },  // ends step 6

    /* ---------------- 7. OS support, part 1: contain the fault (process isolation, VMs) ---------------- */
    {  // step 7 begins: how the OS contains a fault with process isolation and virtual machines
      title: 'The OS contains faults: isolation and VMs',  // title shown at the top of step 7
      kind: 'explore',  // kind 'explore': a hands-on screen for trying set-ups
      render(el, ctx) {  // render(el, ctx) runs when step 7 is shown
        const { h, s } = ctx;  // takes the HTML builder h and the SVG builder s from the guide's helpers
        if (ctx.narrow) el.classList.add('nar');  // on phone-width screens adds the nar class so the phone-width style rules apply

        /* ---- demo: how far does a fault spread? ---- */
        function contain(p) {  // contain(p): builds the "how far does a fault spread" demo inside the element p
          let mode = 'proc', fault = null;  // mode: how the system is organised (none, proc or vm); fault: which fault was injected, or null
          const svg = s('svg', { viewBox: ctx.narrow ? '0 0 330 210' : '0 0 600 214', width: '100%', style: 'flex:none' });  // svg: the drawing of programs, operating systems and hardware (smaller on phones)
          const say = h('div', { class: 'callout m0 small', style: { lineHeight: '1.42', minHeight: '96px' } });  // say: the callout explaining how far the fault spread
          const box = (x, y, w, hh, label, cls, down, sub) => s('g', {},  // box(...): draws one labelled rectangle, turned red with a cross when that part is down
            s('rect', { x, y, width: w, height: hh, rx: 9, class: down ? 's-bad' : cls, 'stroke-width': 2 }),  // the rectangle, drawn red instead of its normal color when the part is down
            s('text', { x: x + w / 2, y: y + (sub ? hh / 2 - 2 : hh / 2 + 5), 'text-anchor': 'middle', 'font-size': ctx.narrow ? 13 : 14.5, 'font-weight': 800, style: down ? 'fill:var(--bad)' : '' }, (down ? '✗ ' : '') + label),  // the part's name, moved up when a subtitle follows, smaller on phones, and prefixed with a cross when down
            sub ? s('text', { x: x + w / 2, y: y + hh / 2 + 15, 'text-anchor': 'middle', 'font-size': 12, class: 's-sub' }, sub) : null);  // an optional grey subtitle under the name, such as "own memory"
          function outcome() {  // outcome(): works out which parts survive the chosen fault under the chosen organisation
            const all = { A: true, B: true, C: true, os1: true, os2: true, os3: true };  // all: every program (A, B, C) and every OS copy (os1 to os3) marked as up
            if (!fault) return [all, 'why', 'Nothing has gone wrong yet', 'Three programs, A, B and C, share one computer. Choose how the system is organised, then make program B misbehave.'];  // no fault yet: everything is up, with an invitation to choose a set-up and break B
            const dn = (keys) => { const o = Object.assign({}, all); keys.forEach((k) => { o[k] = false; }); return o; };  // dn(keys): a copy of "all up" with the listed parts marked down
            if (mode === 'none') return [dn(['A', 'B', 'C', 'os1']), 'bad', 'Everything is down',  // no isolation: either fault takes down A, B, C and the one OS
              fault === 'wild' ? 'With no walls, B\'s stray write lands in A\'s data and in the operating system\'s own tables. Everything sharing that memory is corrupted and the whole machine goes down.' : 'There is one OS and nothing separates it from the programs. When it crashes, it takes every program with it.'];  // message: a stray write corrupts everything in the shared memory, or an OS crash takes every program with it
            if (mode === 'proc') return fault === 'wild'  // process isolation: the result depends on which fault was injected
              ? [dn(['B']), 'tip', 'Contained by process isolation', 'Memory-protection hardware traps the stray write before it lands, and the OS terminates B. A and C never notice: <span class="t">process isolation</span> kept the fault inside one process.']  // stray write: the hardware traps it and only B is ended, so the fault is contained
              : [dn(['A', 'B', 'C', 'os1']), 'bad', 'Not contained', 'The processes are walled off from each other, but they all rely on <b>one</b> kernel. When it crashes, A, B and C all stop. Process isolation cannot contain a fault in the OS itself.'];  // OS crash: all processes depend on the one kernel, so everything stops; isolation cannot help here
            return fault === 'wild'  // virtual machines: both faults stay inside VM 2
              ? [dn(['B']), 'tip', 'Contained inside VM 2', 'B\'s own guest OS traps the stray write and ends B. Nothing outside VM 2 is even aware of it.']  // stray write: B's own guest OS ends B and nothing outside VM 2 notices
              : [dn(['B', 'os2']), 'tip', 'Contained inside VM 2', 'Only VM 2\'s guest OS crashed. VM 1 and VM 3 run their own copies of the OS and carry on, and the hypervisor can reboot VM 2, even on another machine. The price: running several whole OS copies.'];  // OS crash: only VM 2's guest OS goes down; the others run their own OS copies, at the price of running several
          }  // ends outcome()
          /* phones: the same three pictures redrawn 330 units wide so their labels stay legible */
          function narrowParts(k, up) {  // draws the phone versions of the three pictures into the shape list k, using the up/down map
            if (mode === 'none') {  // picture for "no isolation" on phones
              k.push(s('rect', { x: 4, y: 4, width: 322, height: 160, rx: 12, class: 's-muted', 'stroke-dasharray': '7 5' }), s('text', { x: 14, y: 22, 'font-size': 12.5, 'font-weight': 700, class: 's-sub' }, 'one shared memory: no walls'));  // a dashed frame labelled as one shared memory with no walls
              ['A', 'B', 'C'].forEach((n, i) => k.push(box(14 + i * 76, 32, 70, 50, n, 's-proc', !up[n], 'program')));  // programs A, B and C side by side
              k.push(box(244, 32, 72, 122, 'OS', 's-os', !up.os1, 'tables'));  // the one OS with its tables, on the right
              k.push(box(14, 92, 222, 62, fault === 'wild' ? 'corrupted by B' : 'data of A, B, C', 's-panel', fault === 'wild', 'all mixed together'));  // the shared data of all three programs, shown as corrupted after B's stray write
              k.push(box(4, 174, 322, 30, 'hardware', 's-panel', false));  // the hardware bar along the bottom
            } else if (mode === 'proc') {  // picture for "process isolation" on phones
              ['A', 'B', 'C'].forEach((n, i) => k.push(box(6 + i * 108, 6, 102, 60, 'Process ' + n, 's-proc', !up[n], 'own memory')));  // three process boxes, each with its own memory
              k.push(s('text', { x: 165, y: 86, 'text-anchor': 'middle', 'font-size': 12, class: 's-sub' }, 'walls enforced by memory-protection hardware'));  // a note that memory-protection hardware enforces the walls
              k.push(box(6, 96, 318, 44, 'one OS kernel, shared by all', 's-os', !up.os1));  // one kernel box spanning all three processes, shared by all
              k.push(box(6, 150, 318, 32, 'hardware', 's-panel', false));  // the hardware bar along the bottom
            } else {  // picture for "virtual machines" on phones
              ['A', 'B', 'C'].forEach((n, i) => {  // one virtual machine per program
                const x = 4 + i * 108, os = 'os' + (i + 1);  // x: where this VM's frame starts; os: the key of its guest OS in the up/down map
                k.push(s('rect', { x, y: 4, width: 104, height: 122, rx: 10, class: !up[os] ? 's-bad' : 's-accent', 'stroke-width': 2, 'stroke-dasharray': '6 4' }),  // the VM's dashed frame, red if its guest OS is down
                  s('text', { x: x + 8, y: 20, 'font-size': 12, 'font-weight': 800, class: 's-sub' }, 'VM ' + (i + 1)),  // the VM's name in its top-left corner
                  box(x + 6, 26, 92, 42, 'Process ' + n, 's-proc', !up[n]), box(x + 6, 76, 92, 42, 'guest OS', 's-os', !up[os]));  // inside the VM: the process box above its own guest OS box
              });  // ends the loop over VMs
              k.push(box(4, 134, 322, 34, 'hypervisor (virtual machine monitor)', 's-cpu', false));  // the hypervisor (virtual machine monitor) bar under all the VMs
              k.push(box(4, 176, 322, 30, 'hardware', 's-panel', false));  // the hardware bar along the bottom
            }  // ends the choice of picture
          }  // ends the phone drawing helper
          function draw() {  // draw() repaints the picture, the message and the fault buttons; it runs after every choice
            const [up, cls, lab, msg] = outcome();  // gets the up/down map and the callout's color, heading and message
            const k = [];  // k collects the shapes of the picture
            if (ctx.narrow) narrowParts(k, up);  // on phones, the smaller pictures come from the helper above
            else if (mode === 'none') {  // wide picture for "no isolation"
              k.push(s('rect', { x: 10, y: 8, width: 580, height: 150, rx: 14, class: 's-muted', 'stroke-dasharray': '7 5' }), s('text', { x: 24, y: 30, 'font-size': 13, 'font-weight': 700, class: 's-sub' }, 'one shared memory: no walls between anything'));  // a dashed frame labelled as one shared memory with no walls between anything
              ['A', 'B', 'C'].forEach((n, i) => k.push(box(30 + i * 138, 46, 120, 56, 'Program ' + n, 's-proc', !up[n])));  // three program boxes side by side
              k.push(box(444, 46, 128, 96, 'OS', 's-os', !up.os1, 'tables, buffers'));  // the one OS box holding tables and buffers
              k.push(box(30, 114, 396, 30, fault === 'wild' ? 'shared data: corrupted by B' : 'data of A, B and C, all mixed together', 's-panel', fault === 'wild'));  // the shared data of all three programs, red and marked corrupted after B's stray write
              k.push(box(10, 170, 580, 36, 'hardware', 's-panel', false));  // the hardware bar along the bottom
            } else if (mode === 'proc') {  // wide picture for "process isolation"
              ['A', 'B', 'C'].forEach((n, i) => k.push(box(10 + i * 196, 8, 184, 70, 'Process ' + n, 's-proc', !up[n], 'own memory space')));  // three process boxes, each with its own memory space
              k.push(s('text', { x: 300, y: 98, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, 'walls enforced by memory-protection hardware'));  // a note that memory-protection hardware enforces the walls
              k.push(box(10, 108, 576, 50, 'one OS kernel, shared by all', 's-os', !up.os1));  // one kernel box spanning all three processes
              k.push(box(10, 170, 576, 36, 'hardware', 's-panel', false));  // the hardware bar along the bottom
            } else {  // wide picture for "virtual machines"
              ['A', 'B', 'C'].forEach((n, i) => {  // one virtual machine per program
                const x = 10 + i * 196, os = 'os' + (i + 1);  // x: where this VM's frame starts; os: the key of its guest OS
                k.push(s('rect', { x, y: 4, width: 184, height: 118, rx: 12, class: !up[os] ? 's-bad' : 's-accent', 'stroke-width': 2, 'stroke-dasharray': '6 4' }),  // the VM's dashed frame, red if its guest OS is down
                  s('text', { x: x + 10, y: 21, 'font-size': 12.5, 'font-weight': 800, class: 's-sub' }, 'VM ' + (i + 1)),  // the VM's name in its top-left corner
                  box(x + 10, 28, 164, 42, 'Process ' + n, 's-proc', !up[n]), box(x + 10, 76, 164, 38, 'guest OS ' + (i + 1), 's-os', !up[os]));  // inside the VM: the process above its own numbered guest OS
              });  // ends the loop over VMs
              k.push(box(10, 130, 576, 34, 'hypervisor (virtual machine monitor)', 's-cpu', false));  // the hypervisor bar under all the VMs
              k.push(box(10, 172, 576, 34, 'hardware', 's-panel', false));  // the hardware bar along the bottom
            }  // ends the choice of picture
            svg.replaceChildren(...k);  // swaps the finished shapes into the drawing
            say.className = 'callout m0 small ' + cls; say.setAttribute('data-label', lab); say.innerHTML = msg;  // paints the callout with its color, heading and message
            fb.forEach(([b, f]) => b.classList.toggle('on', fault === f));  // tints the fault button that is currently active
          }  // ends draw()
          const seg = ctx.ui.seg([{ value: 'none', label: 'No isolation' }, { value: 'proc', label: 'Process isolation' }, { value: 'vm', label: 'Virtual machines' }], mode, (v) => { mode = v; draw(); });  // seg: three buttons to choose the organisation (none, process isolation, VMs); a change redraws
          const fb = [['wild', 'B writes to a wild address'], ['kernel', 'The OS under B crashes']].map(([f, l]) => [h('button', { class: 'btn sm flt', type: 'button', onclick: () => { fault = f; draw(); } }, l), f]);  // fb: the two fault buttons, a wild write by B or a crash of the OS under B, each paired with its fault name
          const reset = h('button', { class: 'btn sm ghost', type: 'button', onclick: () => { fault = null; draw(); } }, 'Reset');  // Reset: clears the fault so the student can try again
          p.append(h('div', { class: 'card white stack fill', style: { gap: '9px' } },  // builds the demo card inside p
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'Organise the system'), seg),  // card header: title plus the organisation picker
            svg,  // the drawing
            h('div', { class: 'row', style: { gap: '6px' } }, h('span', { class: 'lbl' }, 'Make B fail:'), ...fb.map((x) => x[0]), reset),  // row with the label "Make B fail:", the two fault buttons and Reset
            say,  // the explanation callout
            h('div', { class: 'xs muted', html: '<b>Try:</b> both faults under each organisation. Only one set-up contains both. Which one, and what does it cost?' })));  // a challenge: try both faults under each set-up and find the one that contains both
          draw();  // paints the demo for the first time
        }  // ends contain()

        const left = h('div', { class: 'stack', style: { gap: '9px' } },  // left column of step 7: the explanation text
          h('p', { class: 'm0', style: { fontSize: '16.5px', lineHeight: '1.45' }, html: 'Redundancy is not only hardware. The OS has four tools of its own. The first two, <b>process isolation</b> and <b>virtual machines</b>, stop a fault from <b>spreading</b>.' }),  // intro: the OS has four tools of its own, and the first two stop a fault from spreading
          h('div', { class: 'mech proc' }, h('b', { html: '<span class="t">Process isolation</span>' }),  // mechanism card: process isolation
            h('div', { html: 'Each process gets its own memory, files and flow of execution (as in section 2.3). Memory-protection hardware enforces the walls: a stray write is trapped before it lands, and the OS ends only the faulty process.' })),  // how it works: separate memory for each process, enforced by hardware, so only the faulty process is ended
          h('div', { class: 'mech os' }, h('b', { html: '<span class="t" data-t="Virtual machine (VM)">Virtual machines (VMs)</span>' }),  // mechanism card: virtual machines
            h('div', { html: 'Each VM runs a complete OS of its own on a <b>hypervisor</b>, the software layer that shares one physical machine among the VMs. Even an OS crash stays inside one VM, and a standby VM, ideally on another machine, can take over from a failed one.' })),  // how it works: each VM runs a full OS on a hypervisor, so even an OS crash stays inside one VM
          h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'Process isolation cannot survive a crash of the <b>kernel</b>: every process depends on that one shared kernel. VMs move the wall one level down, at the price of running several operating systems.' }),  // common-mistake callout: process isolation cannot survive a kernel crash; VMs move the wall one level down
          h('div', { class: 'callout why m0 small', 'data-label': 'Why it matters', html: 'Containment turns "the computer crashed" into "one program crashed", which a quick restart can fix.' }));  // why-it-matters callout: containment turns "the computer crashed" into "one program crashed"
        const right = h('div', { class: 'fill' });  // right: an empty column that contain() fills with the demo
        contain(right);  // builds the demo in the right column
        el.append(h('div', { class: 'split l fill' }, left, right));  // places the two columns side by side on the step
      },  // ends render() for step 7
    },  // ends step 7

    /* ---------------- 8. OS support, part 2: concurrency controls (be the scheduler: race vs lock) ---------------- */
    {  // step 8 begins: concurrency controls, where the student plays the scheduler to cause and then prevent a lost update
      title: 'Concurrency controls: stop the lost update',  // title shown at the top of step 8
      kind: 'lab',  // kind 'lab': a screen built around an experiment
      render(el, ctx) {  // render(el, ctx) runs when step 8 is shown
        const { h } = ctx;  // takes the HTML builder h from the guide's helpers
        if (ctx.narrow) el.classList.add('nar');  // on phone-width screens adds the nar class so the phone-width style rules apply
        /* each line of a deposit: [code, plain-language comment] */
        const LINES = {  // LINES: every line a deposit can run, each [code shown, plain-language explanation]
          lock: ['lock(acct)', 'wait until no other process holds the lock, then take it'],  // code line: lock(acct), wait for the lock and take it
          read: ['x = balance', 'copy the shared balance into my private variable x'],  // code line: x = balance, copy the shared balance into a private variable
          add: ['x = x + 100', 'add the $100 deposit to my private copy'],  // code line: x = x + 100, add the deposit to the private copy
          write: ['balance = x', 'write my copy back over the shared balance'],  // code line: balance = x, write the copy back over the shared balance
          unlock: ['unlock(acct)', 'release the lock so a waiting process may go in'],  // code line: unlock(acct), release the lock for a waiting process
        };  // closes the LINES table
        const PROG = { none: ['read', 'add', 'write'], lock: ['lock', 'read', 'add', 'write', 'unlock'] };  // PROG: the two versions of the deposit, three lines with no lock, or five lines wrapped in lock and unlock
        const NM = ['P1', 'P2'], CC = ['proc', 'accent'];  // NM: the two process names; CC: their colors (process color for P1, accent color for P2)
        const money = (n) => '$' + n.toLocaleString('en-US');  // money(n): writes a number of dollars, e.g. 1200 becomes "$1,200"
        let mode = 'none', st, runId = 0, cls, lab, msg;  // mode: which version runs; st: the machine state; runId: cancels an automatic run; cls, lab, msg: the callout contents
        const prog = () => PROG[mode];  // prog(): the list of lines for the current version
        const done = (p) => st.pc[p] >= prog().length;  // done(p): true once process p has run past its last line (pc is the number of the next line to run)
        /* has process k copied the balance but not yet written it back? */
        const pending = (k) => st.x[k] != null && st.pc[k] <= prog().indexOf('write');  // pending(k): true while process k holds a copy of the balance it has not yet written back, the dangerous moment
        function reset() {  // reset(): starts both deposits again from the beginning
          runId++;  // bumps runId so any automatic run still waiting will stop instead of carrying on
          st = { bal: 500, pc: [0, 0], x: [null, null], r: [null, null], holder: null, waiting: [false, false], writes: 0, trace: [] };  // fresh state: balance $500, both at line 0, no private copies, lock free, nobody waiting, no writes, empty trace
          cls = 'why'; lab = 'You are the scheduler';  // blue callout headed "You are the scheduler"
          msg = mode === 'none'  // the starting message depends on the version
            ? 'Each click runs <b>one line</b> of one process, just as the OS may switch processes after any step. Try to make a deposit vanish: let <b>both</b> processes copy the balance before either writes it back.'  // without a lock: each click runs one line; try to make a deposit vanish by letting both copy first
            : 'Same two deposits, now wrapped in <code>lock</code> and <code>unlock</code>. Try the same trick as before. Can you still make a deposit vanish?';  // with a lock: same deposits, now inside lock and unlock; can the trick still work?
        }  // ends reset()
        function step(p) {  // step(p): runs the next line of process p, as the scheduler would, and sets the explanation
          if (done(p)) return;  // a finished process has nothing left to run
          const op = prog()[st.pc[p]], q = 1 - p, me = NM[p], other = NM[q];  // op: the line to run; q: the other process; me and other: their names for the messages
          if (op === 'lock') {  // running lock(acct)
            if (st.holder === q) {  // if the other process holds the lock, this one cannot go on
              st.waiting[p] = true; st.trace.push([p, 'blocked']);  // marks it as waiting and records "blocked" in the trace; its line counter does not move
              cls = 'warn'; lab = me + ' is blocked';  // yellow callout: this process is blocked
              msg = `${me} tries to take the lock, but ${other} holds it, so ${me} is <b>blocked</b> (made to wait) until ${other} unlocks. This waiting is exactly what stops the two deposits from overlapping.`;  // message: it must wait until the other unlocks, and this waiting is what keeps the deposits apart
              return;  // stops here, so the lock line will be tried again on the next click
            }  // ends the blocked case
            st.holder = p; st.waiting[p] = false; st.pc[p]++; st.trace.push([p, 'lock']);  // the lock was free: this process takes it, stops waiting, moves to its next line and logs "lock"
            cls = 'why'; lab = me + ' takes the lock';  // blue callout: this process takes the lock
            msg = `The lock was free, so ${me} takes it. Until ${me} unlocks, no other process can run the lines that touch the balance.`;  // message: until it unlocks, no other process can touch the balance
          } else if (op === 'read') {  // running x = balance
            st.x[p] = st.r[p] = st.bal; st.pc[p]++; st.trace.push([p, 'x = ' + money(st.bal)]);  // copies the balance into the private x (r remembers the value read, for later messages) and logs it
            cls = pending(q) ? 'warn' : 'why'; lab = me + ' copies the balance';  // the callout turns yellow if the other process is also holding an unwritten copy
            msg = `${me} copies the shared balance, ${money(st.bal)}, into its private x.` + (pending(q)  // message: what was copied
              ? ` <b>Danger:</b> ${other} also holds a copy it has not written back. Whoever writes second will overwrite the other's deposit.` : '');  // adds a warning when both now hold copies: whoever writes second will wipe out the other's deposit
          } else if (op === 'add') {  // running x = x + 100
            st.x[p] += 100; st.pc[p]++; st.trace.push([p, 'x = ' + money(st.x[p])]);  // adds 100 to the private copy only, moves on, and logs the new x
            cls = 'why'; lab = me + ' adds 100';  // blue callout: this process adds 100
            msg = `${me} adds $100 to its <b>private</b> copy, making x = ${money(st.x[p])}. The shared balance is still ${money(st.bal)}: nothing has been written yet.`;  // message: only the private copy changed; the shared balance is untouched so far
          } else if (op === 'write') {  // running balance = x
            const before = st.bal;  // before: the balance just before this write, for the message
            st.bal = st.x[p]; st.writes++; st.pc[p]++; st.trace.push([p, 'balance = ' + money(st.bal)]);  // overwrites the shared balance with the private copy, counts the write, moves on and logs it
            if (st.bal !== 500 + 100 * st.writes) {  // after n writes the balance should be 500 + 100n; anything less means a deposit was lost
              cls = 'bad'; lab = 'Lost update';  // red callout headed "Lost update"
              msg = `${me} writes ${money(st.bal)} over ${money(before)}, but its copy was taken <b>before</b> ${other} wrote. ${other}'s $100 is wiped out.`;  // message: this write was based on an old copy, so the other process's $100 is wiped out
            } else if (pending(q)) {  // the write is correct, but the other process still holds an old copy
              cls = 'warn'; lab = me + ' writes';  // yellow callout: this process writes
              msg = `${me} writes ${money(st.bal)}: correct for now. But ${other} copied the balance back when it was ${money(st.r[q])}, so when ${other} writes, this deposit will be wiped out.`;  // message: correct for now, but the other's later write will wipe this deposit out
            } else { cls = 'why'; lab = me + ' writes'; msg = `${me} writes ${money(st.bal)} to the shared balance. Its deposit is safely recorded.`; }  // otherwise the write is simply safe, and the deposit is recorded
          } else {  // running unlock(acct)
            st.holder = null; st.pc[p]++; st.trace.push([p, 'unlock']);  // frees the lock, moves on and logs "unlock"
            cls = 'why'; lab = me + ' unlocks';  // blue callout: this process unlocks
            msg = `${me} releases the lock.` + (st.waiting[q] ? ` ${other} was waiting, so it may now take the lock and start its deposit.` : ' The next process to ask for it will get it at once.');  // message: if the other was waiting it may now go in; otherwise the next asker gets the lock at once
          }  // ends the choice of line
          if (done(0) && done(1)) {  // once both processes have finished, judge the result
            if (st.bal === 700) {  // $700 means both deposits were counted
              cls = 'tip'; lab = 'Both deposits counted: $700';  // green callout headed "Both deposits counted: $700"
              msg = mode === 'lock'  // the message depends on the version
                ? 'The lock let only one deposit at a time touch the balance, so the second always started from the first one\'s result. With the lock, <b>no</b> order of steps can lose a deposit.'  // with the lock: only one deposit at a time touched the balance, so no order can lose one
                : 'This order happened to be safe: one process wrote before the other copied. Press <b>Reset</b> and let both copy first; the code is the same, only the timing changes.';  // without the lock: this order was lucky; reset and let both copy first to see the problem
            } else {  // any other total means a deposit vanished
              cls = 'bad'; lab = 'Final balance ' + money(st.bal) + ', not $700';  // red callout naming the wrong final balance
              msg = 'Nothing crashed and no error appeared, yet a deposit vanished: a <span class="t">race condition</span>. The faulty code is there all the time; only the unlucky timing is rare. Now switch to <b>With a lock</b> and try the same order.';  // message: a race condition, a timing bug with no crash and no error; now try the locked version
            }  // ends the result check
          }  // ends the "both finished" check
        }  // ends step()
        /* ---- view ---- */
        const code = h('div', { class: 'cc-code' });  // code: the table of code lines with the P1 and P2 markers
        const cards = [0, 1].map(() => ({ x: h('div', { class: 'big' }), chip: h('span', { class: 'chip' }) }));  // cards: for each process, a big number showing its private x and a status chip
        const balBig = h('div', { class: 'big' });  // balBig: the big number showing the shared balance
        const trace = h('div', { class: 'log cc-trace' });  // trace: the log box listing, in order, every line that ran
        const say = h('div', { class: 'callout m0 small', style: { lineHeight: '1.42', minHeight: '80px' } });  // say: the explanation callout
        const bRun = [0, 1].map((p) => h('button', { class: 'btn sm ' + (p ? 'acc' : 'proc'), type: 'button', onclick: () => { runId++; step(p); draw(); } }, `Run ${NM[p]}'s next line`));  // two Run buttons, one per process; a click cancels any automatic run, runs one line and redraws
        const bAuto = h('button', { class: 'btn sm primary', type: 'button', onclick: () => autoRun() }, 'Take turns automatically');  // Take turns automatically: runs the lines alternately P1, P2, P1, ... by itself
        const bReset = h('button', { class: 'btn sm ghost', type: 'button', onclick: () => { reset(); draw(); } }, 'Reset');  // Reset: starts both deposits again
        function draw() {  // draw() repaints the code table, the cards, the balance, the trace and the callout; it runs after every line
          const P = prog(), kids = [h('span', { class: 'cc-hd center' }, 'P1 at'), h('span', { class: 'cc-hd center' }, 'P2 at'), h('span', { class: 'cc-hd' }, 'each deposit runs'), h('span', { class: 'cc-hd cmt' }, 'what the line does')];  // P: the current version's lines; kids starts with the four column headings of the code table
          P.forEach((op, i) => {  // one table row per code line
            const at = [0, 1].map((p) => !done(p) && st.pc[p] === i);  // at: which of the two processes will run this line next
            kids.push(...[0, 1].map((p) => h('span', { class: 'cc-mk' }, at[p] ? h('span', { class: 'chip ' + (st.waiting[p] ? 'warn' : CC[p]) }, NM[p] + ' ▸') : '')),  // the two marker cells: a colored "P1 ▸" or "P2 ▸" chip where that process is, yellow if it is blocked
              h('span', { class: 'cc-line' + (op === 'lock' || op === 'unlock' ? ' lk' : '') + (at[0] || at[1] ? ' cur' : '') }, LINES[op][0]),  // the code line itself, tinted if it is a lock line, outlined if a process is about to run it
              h('span', { class: 'cc-com' }, LINES[op][1]));  // the plain-language explanation of the line
          });  // ends the loop over lines
          code.replaceChildren(...kids);  // swaps the rebuilt rows into the code table
          [0, 1].forEach((p) => {  // updates both process cards
            const c = cards[p];  // c: this process's card parts
            c.x.textContent = st.x[p] == null ? '—' : money(st.x[p]);  // shows its private x, or a dash if it has not copied the balance yet
            const [k, t] = done(p) ? ['ok', 'finished'] : st.waiting[p] ? ['warn', 'blocked: waiting'] : st.holder === p ? ['os', 'holds the lock'] : st.pc[p] === 0 ? ['', 'not started'] : [CC[p], 'mid-deposit'];  // status chip: finished, blocked, holds the lock, not started, or mid-deposit
            c.chip.className = 'chip ' + k; c.chip.textContent = t;  // paints the chip with its color and text
            bRun[p].disabled = done(p);  // disables the Run button of a process that has finished
          });  // ends the loop over cards
          const end = done(0) && done(1);  // end: have both processes finished?
          balBig.textContent = money(st.bal);  // shows the shared balance
          balBig.style.color = end ? (st.bal === 700 ? 'var(--ok)' : 'var(--bad)') : '';  // once both are done, the balance turns green if it is $700 and red if a deposit was lost
          trace.replaceChildren(...(st.trace.length ? st.trace.map(([p, t]) => h('span', { class: 'chip ' + (t === 'blocked' ? 'warn' : CC[p]) }, NM[p] + ': ' + t)) : [h('span', { class: 'xs muted' }, 'The order in which lines ran will appear here.')]));  // rebuilds the trace as one chip per line run (yellow for "blocked"), or a hint while it is still empty
          trace.scrollTop = trace.scrollHeight;  // scrolls the trace to its newest entry
          say.className = 'callout m0 small ' + cls; say.setAttribute('data-label', lab); say.innerHTML = msg;  // paints the callout with its color, heading and message
        }  // ends draw()
        /* take turns: P1, P2, P1, P2 ... skipping a process that has finished */
        async function autoRun() {  // autoRun(): an async function (one that can pause with await without freezing the page) that plays both deposits
          reset(); draw();  // starts from a clean state and shows it
          const id = runId;  // remembers this run's number; a click on Reset or a Run button changes runId and so stops this run
          let p = 0;  // p: whose turn it is, starting with P1
          while (!(done(0) && done(1))) {  // keeps going until both deposits have finished
            if (done(p)) { p = 1 - p; continue; }  // skips a process that has finished and gives the turn to the other
            await ctx.sleep(650);  // waits 650 milliseconds so the student can follow each line
            if (!ctx.alive || id !== runId) return;  // stops if the student left the step or another action took over
            step(p); draw(); p = 1 - p;  // runs one line of process p, redraws, and passes the turn to the other process
          }  // ends the loop
        }  // ends autoRun()
        const seg = ctx.ui.seg([{ value: 'none', label: 'No lock' }, { value: 'lock', label: 'With a lock' }], mode, (v) => { mode = v; reset(); draw(); });  // seg: two buttons to choose No lock or With a lock; a change starts the deposits again
        const card = (label, big, extra, cl) => h('div', { class: 'cc-card' + (cl ? ' ' + cl : '') }, h('span', { class: 'lbl' }, label), big, extra);  // card(...): builds one of the three boxes: a label, a big number, an extra line, and an optional extra class
        const left = h('div', { class: 'stack', style: { gap: '9px' } },  // left column of step 8: the explanation text
          h('p', { class: 'lead m0', html: 'Processes that share data can corrupt it without anything crashing.' }),  // lead: processes sharing data can corrupt it without anything crashing
          h('p', { class: 'm0', style: { fontSize: '16px', lineHeight: '1.45' }, html: 'Two processes each deposit $100 into one shared balance in three steps: copy the balance, add 100, write it back. The OS may switch processes between <b>any</b> two steps. If both copy before either writes, one deposit is lost. A result that depends on such timing is a <span class="t">race condition</span>.' }),  // paragraph: two $100 deposits in three steps, and how switching between them can lose one (a race condition)
          h('div', { class: 'mech thread' }, h('b', {}, 'Concurrency controls'),  // mechanism card: concurrency controls
            h('div', { html: 'Locks and semaphores (Chapter 5 builds both) enforce <span class="t">mutual exclusion</span>: only one process at a time may run the lines that touch shared data. They bring a new hazard, <span class="t">deadlock</span> (processes waiting for each other forever), which the OS can detect and break, say by rolling one process back.' })),  // how they work: locks and semaphores give mutual exclusion, and bring the new hazard of deadlock
          h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: '"It passed every test, so there is no race." The faulty code is always there, but only an unlucky timing triggers it, so tests often miss it.' }),  // common-mistake callout: passing every test does not prove there is no race
          h('div', { class: 'callout why m0 small', 'data-label': 'Why it matters', html: 'Bank records, seat bookings and the OS\'s own tables are all shared. Without these controls, updates would quietly vanish.' }));  // why-it-matters callout: bank records, seat bookings and the OS's own tables are all shared data
        const right = h('div', { class: 'card white stack', style: { gap: '8px' } },  // right column of step 8: the scheduler game in a white card
          h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'Two deposits, one shared balance'), seg),  // card header: title plus the No lock / With a lock picker
          code,  // the code table
          h('div', { class: 'stats', style: { '--n': 3 } },  // a row of three boxes
            card('P1 · private x', cards[0].x, cards[0].chip),  // P1's private copy and status
            card('shared balance', balBig, h('span', { class: 'xs muted' }, 'correct after both: $700'), 'shared'),  // the shared balance in the middle, with a reminder that the right answer is $700
            card('P2 · private x', cards[1].x, cards[1].chip)),  // P2's private copy and status
          h('div', { class: 'row', style: { gap: '6px' } }, ...bRun, bAuto, bReset),  // the two Run buttons, Take turns automatically, and Reset
          trace, say);  // the trace log and the explanation callout close the card
        el.append(h('div', { class: 'split l fill' }, left, right));  // places the two columns side by side on the step
        reset(); draw();  // sets up the deposits and draws them when the step opens
      },  // ends render() for step 8
    },  // ends step 8

    /* ---------------- 9. OS support, part 3: checkpoints and rollbacks ---------------- */
    {  // step 9 begins: checkpoints and rollbacks, shown on a batch of bank transfers
      title: 'Checkpoints and rollbacks: undo the damage',  // title shown at the top of step 9
      kind: 'lab',  // kind 'lab': a screen built around an experiment
      render(el, ctx) {  // render(el, ctx) runs when step 9 is shown
        const { h } = ctx;  // takes the HTML builder h from the guide's helpers
        if (ctx.narrow) el.classList.add('nar');  // on phone-width screens adds the nar class so the phone-width style rules apply

        /* ---- demo: checkpoint and rollback on a batch of bank transfers ---- */
        function checkpoint(p) {  // checkpoint(p): builds the transfer demo inside the element p
          const TX = [['Ana', 'Ben', 50], ['Ben', 'Ana', 20], ['Ana', 'Ben', 70], ['Ben', 'Ana', 40], ['Ana', 'Ben', 30], ['Ben', 'Ana', 60], ['Ana', 'Ben', 25], ['Ben', 'Ana', 15]];  // TX: the eight transfers, each [from, to, amount], moving money back and forth between Ana and Ben
          const fresh = () => ({ bal: { Ana: 500, Ben: 500 }, next: 0, crashed: false, half: null });  // fresh(): a new job state: both accounts at $500, next transfer T1, no crash, no half-done transfer
          let st = fresh(), cp = { bal: { Ana: 500, Ben: 500 }, next: 0 }, cls = 'why', lab = 'The job', msg = '';  // st: the job's current state; cp: the saved checkpoint (the start, until one is saved); cls, lab, msg: the callout
          const strip = h('div', { class: 'txstrip' });  // strip: the row of transfer boxes
          const kAna = h('div', { class: 'big' }), kBen = h('div', { class: 'big' }), kTot = h('div', { class: 'big' }), kRisk = h('div', { class: 'big' });  // the four big numbers: Ana's balance, Ben's balance, their total, and the work at risk
          const say = h('div', { class: 'callout m0 small', style: { lineHeight: '1.42', minHeight: '98px' } });  // say: the explanation callout
          const $$ = (n) => '$' + n.toLocaleString('en-US');  // $$(n): writes a number of dollars with a dollar sign and commas
          const intro = () => { cls = 'why'; lab = 'The job'; msg = 'A batch job must apply eight transfers. Money only moves between the two accounts, so a correct state always totals <b>$1,000</b>. Do a few transfers, save a checkpoint, do some more, then crash.'; };  // intro(): sets the opening message: eight transfers, and a correct state always totals $1,000
          function doTx() {  // doTx(): applies the next transfer completely
            const [from, to, amt] = TX[st.next];  // from, to, amt: the details of the next transfer
            st.bal[from] -= amt; st.bal[to] += amt; st.next++;  // moves the money and advances to the following transfer
            const n = st.next - cp.next;  // n: how many transfers have been done since the last checkpoint
            cls = 'why'; lab = `T${st.next} applied`;  // blue callout naming the transfer just applied
            msg = `${from} −${$$(amt)}, ${to} +${$$(amt)}. ` + (st.next === TX.length ? `All eight transfers are done and the total is still $1,000.` : `${n} transfer${n === 1 ? '' : 's'} since the last checkpoint ${n === 1 ? 'is' : 'are'} not saved yet: that work is at risk.`);  // message: the money moved, plus either "all done" or how much unsaved work is now at risk
          }  // ends doTx()
          function save() {  // save(): takes a checkpoint by copying the balances and the position in the batch
            cp = { bal: Object.assign({}, st.bal), next: st.next };  // the copy is separate (Object.assign makes a new object), so later transfers do not change the saved one
            cls = 'tip'; lab = `Checkpoint saved after T${st.next}`;  // green callout: checkpoint saved after the current transfer
            msg = `Saved: Ana ${$$(st.bal.Ana)}, Ben ${$$(st.bal.Ben)}, ${st.next < TX.length ? 'next is T' + (st.next + 1) : 'batch complete'}. The total is $1,000, so this state is <b>consistent</b> and safe to return to. Checkpoints are taken only between transfers, never halfway through one, and each costs time to write.`;  // message: what was saved, and why it is consistent and safe to return to
          }  // ends save()
          function crash() {  // crash(): simulates a crash halfway through the next transfer
            const [from, to, amt] = TX[st.next];  // from, to, amt: the transfer that is interrupted
            st.bal[from] -= amt; st.half = st.next; st.crashed = true;  // takes the money out of one account but never adds it to the other, and marks the job as crashed
            cls = 'bad'; lab = 'Crash in the middle of T' + (st.next + 1);  // red callout: crash in the middle of this transfer
            msg = `T${st.next + 1} took ${$$(amt)} from ${from} but crashed before giving it to ${to}. The total is now ${$$(st.bal.Ana + st.bal.Ben)}: ${$$(amt)} has vanished. This state is <b>inconsistent</b> and must not be trusted. Roll back.`;  // message: money has vanished, so the state is inconsistent and must be rolled back
          }  // ends crash()
          function roll() {  // roll(): rolls back to the checkpoint after a crash
            const redo = st.half - cp.next + 1, without = st.half + 1;  // redo: transfers to repeat from the checkpoint; without: how many it would be with no checkpoint
            st = { bal: Object.assign({}, cp.bal), next: cp.next, crashed: false, half: null };  // replaces the damaged state with a fresh copy of the checkpoint
            cls = 'tip'; lab = 'Rolled back to the checkpoint';  // green callout: rolled back to the checkpoint
            msg = `Ana ${$$(st.bal.Ana)}, Ben ${$$(st.bal.Ben)}: the total is $1,000 again. ` + (cp.next  // message: the total is $1,000 again
              ? `Only <b>${redo}</b> transfer${redo === 1 ? '' : 's'} (T${cp.next + 1} onward) must be redone; with no checkpoint it would have been all ${without}.`  // with a checkpoint: only the work since it must be redone, compared with redoing everything
              : `No checkpoint was saved, so the job is back at the very beginning and all <b>${redo}</b> transfer${redo === 1 ? '' : 's'} must be redone.`);  // with no checkpoint: the job is back at the start and every transfer must be redone
          }  // ends roll()
          function draw() {  // draw() repaints the strip, the numbers, the callout and the buttons; it runs after every click
            const kids = [];  // kids collects the boxes of the strip
            TX.forEach(([from, to, amt], k) => {  // one box per transfer
              if (k === cp.next) kids.push(h('div', { class: 'cpmark', title: 'checkpoint' }, cp.next ? 'checkpoint' : 'start'));  // inserts the checkpoint tab just before the first transfer it does not cover ("start" if none was saved)
              const state = k === st.half ? 'half' : k < cp.next ? 'saved' : k < st.next ? (st.crashed ? 'redo' : 'unsaved') : 'todo';  // state: half done, saved, unsaved, redo after a crash, or still to do
              kids.push(h('div', { class: 'tx ' + state }, h('b', {}, 'T' + (k + 1)), h('span', {}, from[0] + '→' + to[0] + ' ' + $$(amt)), h('i', {}, { saved: 'saved', unsaved: 'unsaved', half: 'half done', redo: 'redo', todo: 'to do' }[state])));  // the transfer box: its number, a short form such as "A→B $50", and its status word
            });  // ends the loop over transfers
            if (cp.next === TX.length) kids.push(h('div', { class: 'cpmark', title: 'checkpoint' }, 'checkpoint'));  // if the checkpoint was taken after the last transfer, its tab goes at the very end
            strip.replaceChildren(...kids);  // swaps the rebuilt boxes into the strip
            const tot = st.bal.Ana + st.bal.Ben;  // tot: the two balances added together; anything but $1,000 means the state is broken
            kAna.textContent = $$(st.bal.Ana); kBen.textContent = $$(st.bal.Ben);  // big numbers: Ana's and Ben's balances
            kTot.textContent = $$(tot) + (tot === 1000 ? ' ✓' : ' ✗'); kTot.style.color = tot === 1000 ? 'var(--ok)' : 'var(--bad)';  // big number: the total, green with a tick at $1,000, red with a cross otherwise
            kRisk.textContent = st.crashed ? '—' : String(st.next - cp.next);  // big number: transfers done since the checkpoint, or a dash after a crash
            say.className = 'callout m0 small ' + cls; say.setAttribute('data-label', lab); say.innerHTML = msg;  // paints the callout with its color, heading and message
            bDo.disabled = st.crashed || st.next >= TX.length; bSave.disabled = st.crashed || st.next === cp.next;  // Do next is off after a crash or when all eight are done; Save is off after a crash or when nothing new has been done
            bCrash.disabled = st.crashed || st.next >= TX.length; bRoll.disabled = !st.crashed;  // Crash is off after a crash or when the batch is finished; Roll back is only available after a crash
          }  // ends draw()
          const act = (fn) => () => { fn(); draw(); };  // act(fn): wraps an action so every button runs it and then redraws
          const bDo = h('button', { class: 'btn sm primary', type: 'button', onclick: act(doTx) }, 'Do next transfer');  // Do next transfer: applies the next transfer in full
          const bSave = h('button', { class: 'btn sm mem', type: 'button', onclick: act(save) }, 'Save checkpoint');  // Save checkpoint: saves the current consistent state (memory-colored, since it copies state to storage)
          const bCrash = h('button', { class: 'btn sm flt', type: 'button', onclick: act(crash) }, 'Crash mid-transfer');  // Crash mid-transfer: breaks the next transfer halfway (drawn in the fault color)
          const bRoll = h('button', { class: 'btn sm os', type: 'button', onclick: act(roll) }, 'Roll back');  // Roll back: restores the checkpoint (OS-colored, since the system does the recovery)
          const bReset = h('button', { class: 'btn sm ghost', type: 'button', onclick: act(() => { st = fresh(); cp = { bal: { Ana: 500, Ben: 500 }, next: 0 }; intro(); }) }, 'Reset');  // Reset: fresh accounts, the checkpoint back at the start, and the opening message
          const stat = (big, label) => h('div', { class: 'stat' }, h('span', { class: 'lbl' }, label), big);  // stat(big, label): wraps a big number with a small label above it
          p.append(h('div', { class: 'card white stack fill', style: { gap: '10px' } },  // builds the demo card inside p
            h('h4', { class: 'm0' }, 'A batch of eight bank transfers'),  // card heading
            strip,  // the strip of transfer boxes
            h('div', { class: 'stats', style: { '--n': 4 } }, stat(kAna, 'Ana'), stat(kBen, 'Ben'), stat(kTot, 'total'), stat(kRisk, 'work at risk')),  // four stat boxes: Ana, Ben, their total, and the work at risk
            h('div', { class: 'row', style: { gap: '6px' } }, bDo, bSave, bCrash, bRoll, bReset),  // the five action buttons in one row
            say,  // the explanation callout
            h('div', { class: 'xs muted', html: '<b>Try:</b> do T1 to T3, save a checkpoint, do T4 and T5, crash, then roll back. Then reset and try it with no checkpoint at all.' }),  // a suggested sequence to try: three transfers, checkpoint, two more, crash, roll back, then again with no checkpoint
            h('div', { class: 'card tight small', style: { lineHeight: '1.4', marginTop: 'auto' }, html: '<b>The trade-off.</b> Checkpoint often and a crash loses little work, but every checkpoint takes time to write. Checkpoint rarely and the job runs faster, until a crash throws away much more. Real systems choose an interval in between.' })));  // trade-off card, pushed to the bottom: frequent checkpoints lose less work but cost more time
          intro(); draw();  // sets the opening message and paints the demo when the step opens
        }  // ends checkpoint()

        const left = h('div', { class: 'stack', style: { gap: '9px' } },  // left column of step 9: the explanation text
          h('p', { class: 'lead m0', html: 'Some faults cannot be hidden while they happen. The fallback: <b>go back</b> to a moment when everything was right.' }),  // lead: some faults cannot be hidden, so the fallback is to go back to a good moment
          h('div', { class: 'mech mem' }, h('b', { html: 'Take a <span class="t">checkpoint</span>' }),  // mechanism card: take a checkpoint
            h('div', { html: 'Every so often, save a copy of the state at a <b>consistent</b> moment (no job half done), in storage the expected failure cannot destroy, such as a separate disk.' })),  // how: save the state at a consistent moment, in storage the expected failure cannot destroy
          h('div', { class: 'mech mem' }, h('b', { html: 'After a failure, <span class="t">rollback</span>' }),  // mechanism card: rollback after a failure
            h('div', { html: 'Throw away the damaged state, restore the latest checkpoint, and redo only the work done since. Databases, transaction systems and jobs that run for days all rely on this.' })),  // how: throw away the damaged state, restore the checkpoint and redo only the work since
          h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'A checkpoint taken <b>halfway</b> through an update saves a broken state, and rolling back to it restores the damage. Checkpoints are only useful if the saved state is consistent.' }),  // common-mistake callout: a checkpoint taken halfway through an update saves a broken state
          h('div', { class: 'callout why m0 small', 'data-label': 'Why it matters', html: 'A week-long simulation or a bank\'s nightly batch cannot start over after every crash. Checkpoints cap how much work any one failure can destroy.' }));  // why-it-matters callout: long jobs cannot start over after every crash, so checkpoints cap the loss
        const right = h('div', { class: 'fill' });  // right: an empty column that checkpoint() fills with the demo
        checkpoint(right);  // builds the demo in the right column
        el.append(h('div', { class: 'split l fill' }, left, right));  // places the two columns side by side on the step
      },  // ends render() for step 9
    },  // ends step 9

    /* ---------------- 8. Recap ---------------- */
    {  // step 10 begins: the recap of the whole section
      title: 'Recap: measure it, name the fault, add redundancy',  // title shown at the top of the recap
      kind: 'recap',  // kind 'recap': a summary screen (it stays on the shorter core path)
      render(el, ctx) {  // render(el, ctx) runs when the recap is shown
        const { h } = ctx;  // takes the HTML builder h from the guide's helpers
        const SUM = [  // SUM: the four summary cards, each [color name, heading, list of key points]
          ['cpu', '1 · Measure', ['<b>R(t)</b>: chance of no failure from 0 to t', '<b>MTTF</b>: average time until a failure', '<b>MTTR</b>: average time to repair', '<b>A = MTTF / (MTTF + MTTR)</b>', 'Classes: 1.0 · 0.99999 · 0.9999 · 0.999 · 0.99–0.995']],  // card 1, measure: R(t), MTTF, MTTR, the availability formula and the classes
          ['intr', '2 · Name the fault', ['<b>Permanent</b>: always there once it occurs', '<b>Transient</b>: temporary, happens once', '<b>Intermittent</b>: temporary, comes and goes', 'Causes: parts, people, surroundings, design, code, data']],  // card 2, name the fault: permanent, transient, intermittent, and the causes
          ['mem', '3 · Add redundancy', ['<b>Spatial</b>: extra hardware (TMR, hot standby)', '<b>Temporal</b>: repeat on error (resend a frame); no use against permanent faults', '<b>Information</b>: extra bits (parity, ECC, RAID)', 'Always costs money or performance']],  // card 3, add redundancy: spatial, temporal and information, and their cost
          ['os', '4 · Let the OS help', ['<b>Process isolation</b>: a fault stays in one process', '<b>Virtual machines</b>: even an OS crash stays in one VM', '<b>Concurrency controls</b>: locks stop race conditions', '<b>Checkpoints and rollbacks</b>: redo only recent work']],  // card 4, let the OS help: isolation, virtual machines, concurrency controls, checkpoints
        ];  // closes the SUM table
        el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },  // recap layout: the summary cards on top, then the flip cards
          h('div', { class: 'grid-4', style: { gap: '10px' } }, ...SUM.map(([c, t, items]) => h('div', { class: 'card tight ' + c, style: { display: 'flex', flexDirection: 'column', gap: '3px' } },  // four cards side by side, each tinted in its own color
            h('div', { class: 'b', style: { color: `var(--${c})`, fontSize: '16px' } }, t),  // the card's heading in its color
            ...items.map((x) => h('div', { class: 'small', style: { lineHeight: '1.3' }, html: x }))))),  // one small line per key point
          h('p', { class: 'm0 muted small' }, 'Say each answer out loud before you click the card to check it.'),  // instruction: answer each flip card aloud before checking it
          ctx.ui.flipcards([  // flipcards: the guide's cards that turn over on a click to show the answer on the back
            ['MTTF 4,900 h and MTTR 100 h: what is the availability?', '4,900 / (4,900 + 100) = <b>0.98</b>. Down 2% of the year: about 175 hours.'],  // flip card: an availability calculation with MTTF 4,900 h and MTTR 100 h (answer 0.98)
            ['Which class allows about 53 minutes of downtime a year?', '<b>Fault resilient</b>, 0.9999 (four nines). Each extra nine cuts downtime tenfold.'],  // flip card: which class allows about 53 minutes of downtime (fault resilient)
            ['A loose connector drops the link now and then. What kind of fault?', '<b>Intermittent</b>: it comes and goes at unpredictable times until someone fixes it.'],  // flip card: a loose connector is an intermittent fault
            ['Two processes both copy a $500 balance, each adds $100, then both write. The result?', '<b>$600, not $700</b>: a lost update caused by a race condition. A lock gives $700 in every order.'],  // flip card: the lost-update result, $600 instead of $700
            ['What can triple modular redundancy survive?', 'A fault in <b>one</b> unit, which the other two outvote. Two units wrong in the same bit, or a bug shared by all three, defeats it.'],  // flip card: what TMR can and cannot survive
            ['What makes a checkpoint useful?', 'It saves a <b>consistent</b> state. After a crash, roll back to it and redo only the work since, instead of starting over.'],  // flip card: what makes a checkpoint useful (a consistent state)
          ].map(([f, b]) => ['<div>' + f + '</div>', '<div>' + b + '</div>']), { cols: 3, height: 126 })));  // wraps each question and answer in a div; the cards sit three per row, 126 pixels tall
      },  // ends render() for the recap
    },  // ends the recap step

    /* ---------------- 9. Check yourself ---------------- */
    {  // step 11 begins: the section quiz
      title: 'Check yourself',  // title shown at the top of the quiz step
      kind: 'check',  // kind 'check': the quiz screen, whose best first-try score is saved as this section's mastery
      quiz: [  // quiz: the list of questions; the guide's quiz engine draws and grades them
        { q: 'Which statement best describes <b>fault tolerance</b>?',  // question 1 (multiple choice): what fault tolerance means
          choices: ['A system that never develops hardware or software faults', 'The ability of a system to keep operating normally despite hardware or software faults', 'The ability to find and fix a fault quickly after the system has stopped', 'Detecting a fault and shutting the system down safely before it does damage'],  // the four choices; only the second describes fault tolerance
          answer: 1,  // answer: the index of the correct choice, counting from 0
          feedback: ['No real system is fault-free. Fault tolerance assumes faults will happen and keeps working anyway.', null, 'Fast repair lowers the MTTR and helps availability, but the system still stops. Fault tolerance keeps it running through the fault.', 'Shutting down safely prevents damage, but the system is no longer doing its job. Fault tolerance keeps it operating normally.'],  // feedback: an explanation for each wrong choice (null for the right one)
          why: 'Fault tolerance means continuing normal operation despite faults. It usually relies on redundancy, which costs money and often some performance.' },  // why: the explanation shown after the question is answered
        { type: 'num', q: 'A server has an MTTF of 1,980 hours and an MTTR of 20 hours. What is its availability, as a percentage?', answer: 99, tol: 0.05, unit: '%',  // question 2 (calculate): availability from MTTF 1,980 h and MTTR 20 h, accepted within 0.05 of 99%
          why: 'A = MTTF / (MTTF + MTTR) = 1,980 / (1,980 + 20) = 1,980 / 2,000 = 0.99, which is 99%.' },  // explanation: 1,980 / 2,000 = 0.99
        { type: 'num', q: 'A system has an availability of 0.9999. About how many <b>minutes</b> of downtime does that allow per year? (One year = 8,760 hours.)', answer: 52.56, tol: 1, unit: 'min',  // question 3 (calculate): minutes of downtime a year at 0.9999, accepted within 1 minute of 52.56
          why: '(1 − 0.9999) × 8,760 h = 0.876 h, and 0.876 × 60 = 52.56 minutes: about 53 minutes, the fault resilient class.' },  // explanation: 0.0001 × 8,760 h = 0.876 h, about 53 minutes
        { q: 'Reliability, R(t), is best defined as:',  // question 4 (multiple choice): the definition of reliability R(t)
          choices: ['the fraction of time the system is available to serve requests', 'the probability that the system operates correctly from time 0 up to time t, given that it worked at time 0', 'the average time from a failure until its repair is finished', 'the number of failures the system has had by time t'],  // the four choices: availability, reliability, MTTR, and a failure count
          answer: 1,  // answer: choice 2 (index 1) is the definition of R(t)
          feedback: ['That is availability, which also counts time after repairs. Reliability asks about one unbroken stretch with no failure.', null, 'That is the mean time to repair (MTTR).', 'That is a count. R(t) is a probability between 0 and 1.'],  // feedback naming what each wrong choice actually describes
          why: 'R(t) starts at 1 when t = 0 and falls as t grows, because a longer stretch gives more chances to fail.' },  // explanation: R(t) starts at 1 and falls as time goes on
        { type: 'bucket', q: 'Sort each fault by how long it lasts.', buckets: ['Permanent', 'Transient', 'Intermittent'],  // question 5 (sort into groups): classify faults as permanent, transient or intermittent
          items: [['A disk head crash', 0], ['A bug in a program', 0], ['Radiation flips one memory bit, once', 1], ['A noise burst garbles one transmission', 1], ['A loose connection that drops at random', 2], ['A cracked joint that fails at random times', 2]],  // the six faults, each with the number of its correct group
          why: 'Permanent faults stay until repaired (head crash, software bug). Transient faults happen once. Intermittent faults recur at unpredictable times.' },  // explanation of the three groups
        { type: 'match', q: 'Match each technique to the idea it relies on.',  // question 6 (match the pairs): each technique to the kind of redundancy it uses
          pairs: [['Three processors vote on every result', 'Spatial redundancy'], ['A data link resends a frame whose checksum failed', 'Temporal redundancy'], ['Memory stores check bits that let it fix a flipped bit', 'Information redundancy'], ['A long job restarts from its last saved consistent state', 'Checkpoint and rollback']],  // the four technique and idea pairs
          why: 'Extra hardware working in parallel is spatial redundancy, repeating work is temporal, extra coded bits are information redundancy, and restoring saved state is checkpoint and rollback.' },  // explanation of each match
        { type: 'tf', q: 'Doubling a system\'s MTTF raises its availability more than halving its MTTR does.', answer: false,  // question 7 (true or false): doubling MTTF beats halving MTTR (false: they tie)
          why: 'A = 1 / (1 + MTTR/MTTF) depends only on the ratio MTTR/MTTF. Both changes halve that ratio, so they give exactly the same availability.' },  // explanation: only the ratio MTTR/MTTF matters
        { type: 'multi', q: 'Which of these are operating system mechanisms that support fault tolerance?',  // question 8 (select all that apply): which are OS mechanisms for fault tolerance
          choices: ['Process isolation', 'Concurrency controls such as semaphores', 'Virtual machines', 'Checkpoints and rollbacks', 'Letting any program write anywhere in memory', 'Switching off the timer interrupt'],  // six choices; the last two are wrong choices that would make faults worse
          answer: [0, 1, 2, 3],  // answer: the first four choices are correct
          why: 'Isolation, concurrency controls, VMs and checkpoint/rollback all limit or undo damage. Unrestricted memory writes, or no timer, would let one faulty program wreck or monopolise the whole machine.' },  // explanation: the four real mechanisms limit or undo damage
        { type: 'order', q: 'Order these availability classes from the one that allows the <b>most</b> downtime per year to the one that allows the <b>least</b>.',  // question 9 (put in order): availability classes from most downtime to least
          items: ['Normal availability (0.99 to 0.995)', 'High availability (0.999)', 'Fault resilient (0.9999)', 'Fault tolerant (0.99999)', 'Continuous (1.0)'],  // the five classes, written here in the correct order (the quiz shuffles them)
          why: 'Each extra nine cuts yearly downtime by a factor of ten: about 44 to 87 hours, then about 8.8 hours (often listed as 8.3), about 53 minutes, about 5 minutes, and finally none at all.' },  // explanation: each extra nine cuts downtime tenfold
        { q: 'In triple modular redundancy, two of the three units suffer the <b>same</b> flipped bit. What does the voter output?',  // question 10 (multiple choice): what the TMR voter outputs when two units share the same wrong bit
          choices: ['The correct value, because a voter always masks errors', 'The wrong value, because the majority in that bit is now wrong', 'Nothing: the voter detects a tie and stops', 'The value from the one unit that is still correct'],  // the four choices
          answer: 1,  // answer: choice 2 (index 1), the wrong value
          feedback: ['The voter simply follows the majority. If two of three agree on a wrong bit, the majority is wrong.', null, 'With three units a bit can never tie: it is always at least two against one.', 'The voter has no idea which unit is correct. It only counts votes.'],  // feedback: why a voter never "always masks", why a tie is impossible, and why it cannot pick the good unit
          why: 'TMR masks a fault in one unit. When two units are wrong in the same way, they outvote the good one.' },  // explanation: TMR masks one faulty unit, but two matching faults outvote the good one
        { q: 'The only network cable between two buildings has been cut. Which remedy keeps data flowing?',  // question 11 (multiple choice): which remedy keeps data flowing over a cut cable
          choices: ['Resend every frame until it gets through', 'Add a checksum to every frame', 'Route the traffic over a second, independent link', 'Save a checkpoint before each transmission'],  // the four choices: resend, checksum, a second link, or a checkpoint
          answer: 2,  // answer: choice 3 (index 2), a second independent link
          feedback: ['Resending is temporal redundancy, which only beats temporary faults. A cut cable is permanent, so every retry is lost too.', 'A checksum only detects damaged frames. Across a cut cable nothing arrives to be checked.', null, 'A checkpoint lets a program restart from saved state, but the link is still cut afterwards.'],  // feedback: why resending, a checksum, or a checkpoint cannot beat a permanent fault
          why: 'A cut cable is a permanent fault: it stays until repaired. Only spatial redundancy, a spare path that is already in place, can mask it.' },  // explanation: a cut cable is permanent, so only spatial redundancy (a spare path) can mask it
        { type: 'num', q: 'Two processes each deposit $100 into a shared balance of $500, with no lock. Each deposit copies the balance into a private variable, adds 100 to the copy, then writes the copy back. Both processes copy the balance before either one writes. What is the final balance, in dollars?', answer: 600, tol: 0, unit: 'dollars', hint: 'Follow each private copy. What value does each process write back, and which write lands last?',  // question 12 (calculate): the final balance after two unlocked deposits that both copy first ($600), with a hint
          why: 'Both copy $500, both compute $600, and the second write overwrites the first: one deposit is lost. This lost update is a race condition; a lock (mutual exclusion) forces the correct $700.' },  // explanation: both write $600, so one deposit is lost to a race condition; a lock gives $700
      ],  // closes the quiz list
    },  // ends the quiz step
  ],  // closes the steps list

  notes: `${/* notes: the section's reference notes, opened from the notes button; written as HTML text */''}
    <h3>What fault tolerance means</h3>${/* notes heading: what fault tolerance means */''}
    <p><b>Fault tolerance</b> is the ability of a system or component to keep operating normally even when some of its hardware or software has developed faults. It relies on <b>redundancy</b>: spare parts, repeated work or extra information that can take over or undo the damage. Redundancy costs money and often performance (a mirrored disk writes everything twice; a standby server must be kept in step). Spares only cover the faults they duplicate: a second power supply cannot save a server whose OS crashes, while a standby server usually can (unless it hits the same bug).</p>${/* notes paragraph: fault tolerance relies on redundancy, which costs money and speed and only covers the faults it duplicates */''}

    <h3>Measuring it</h3>${/* notes heading: measuring it */''}
    <ul>${/* start of the list of measures */''}
      <li><b>Reliability R(t)</b>: the probability that a system operates correctly for the whole period from time 0 to time t, given that it worked at time 0. R(0) = 1 and R(t) never rises.</li>${/* notes item: reliability R(t) */''}
      <li><b>MTTF</b> (mean time to failure): the average time a system runs, from a fresh start or a repair, until it fails.</li>${/* notes item: MTTF */''}
      <li><b>MTTR</b> (mean time to repair): the average time to notice, locate and repair a fault.</li>${/* notes item: MTTR */''}
      <li><b>Availability</b>: the fraction of time the system is up and able to serve requests. <b>A = MTTF / (MTTF + MTTR)</b>; downtime per year = (1 − A) × 8,760 h.</li>${/* notes item: availability, its formula, and yearly downtime */''}
    </ul>${/* end of the list of measures */''}
    <p>MTTF is an average, not a promise: with failures striking at random at a steady rate, R(t) = e<sup>−t/MTTF</sup>, so only about 37% of units still run at t = MTTF. Scale makes failures routine: 10,000 disks with an MTTF of 1,000,000 h fail about 10,000 ÷ 1,000,000 = 0.01 times an hour, one every 100 hours.</p>${/* notes paragraph: MTTF is an average (only about 37% survive to t = MTTF), and scale makes failures routine */''}
    <p><b>Worked example.</b> MTTF = 990 h, MTTR = 10 h: A = 990 / 1,000 = 0.99, so the system is down 0.01 × 8,760 ≈ 87.6 h a year.</p>${/* notes paragraph: the worked example, MTTF 990 h and MTTR 10 h giving 0.99 */''}
    <p><b>Reliability is not availability:</b> a server that crashes hourly but restarts in one second has poor reliability yet about 99.97% availability. <b>Only the ratio matters:</b> A = 1 / (1 + MTTR/MTTF), so from MTTF 1,000 h and MTTR 10 h (99.01%), doubling the MTTF or halving the MTTR gives the same 2,000/2,010 = 1,000/1,005 ≈ 99.50%.</p>${/* notes paragraph: reliability is not availability, and only the ratio MTTR/MTTF matters */''}

    <h4>Availability classes</h4>${/* notes subheading: availability classes */''}
    <table>${/* start of the classes table */''}
      <tr><th>Class</th><th>Availability</th><th>Downtime per year</th></tr>${/* table header row: class, availability, downtime per year */''}
      <tr><td>Continuous</td><td>1.0</td><td>none</td></tr>${/* table row: continuous */''}
      <tr><td>Fault tolerant</td><td>0.99999 (five nines)</td><td>about 5 minutes</td></tr>${/* table row: fault tolerant, five nines */''}
      <tr><td>Fault resilient</td><td>0.9999 (four nines)</td><td>about 53 minutes</td></tr>${/* table row: fault resilient, four nines */''}
      <tr><td>High availability</td><td>0.999 (three nines)</td><td>about 8.8 h (often listed as 8.3 h)</td></tr>${/* table row: high availability, three nines */''}
      <tr><td>Normal availability</td><td>0.99 to 0.995</td><td>about 44 to 87 hours</td></tr>${/* table row: normal availability */''}
    </table>${/* end of the classes table */''}
    <p>Each extra nine cuts downtime tenfold. Five nines with 1-hour repairs needs an MTTF near 100,000 h, so real designs hide failures with redundancy.</p>${/* notes paragraph: each nine cuts downtime tenfold, so real designs lean on redundancy */''}

    <h3>Faults</h3>${/* notes heading: faults */''}
    <p>A <b>fault</b> is an erroneous state of hardware or software. Causes: component failure, operator error, physical interference from the surroundings (heat, noise, radiation, power dips), design error, program error and data structure error.</p>${/* notes paragraph: what a fault is and its six causes */''}
    <ul>${/* start of the list of fault kinds */''}
      <li><b>Permanent</b>: always present once it occurs, until the part is repaired or replaced (disk head crash, software bug, burned-out part). A bug that only some inputs trigger is still permanent. Retrying is useless; repair it or switch to a spare.</li>${/* notes item: permanent faults, and why retrying them is useless */''}
      <li><b>Temporary</b>, of two kinds. <b>Transient</b>: happens once (a noise burst garbles a frame, a power flicker, a radiation bit flip); a retry works. <b>Intermittent</b>: recurs at unpredictable times (a loose connection, a cracked solder joint); a retry works for now, but the fault returns until fixed.</li>${/* notes item: temporary faults, transient and intermittent, and how retrying helps each */''}
    </ul>${/* end of the list of fault kinds */''}

    <h3>Three kinds of redundancy</h3>${/* notes heading: three kinds of redundancy */''}
    <table>${/* start of the redundancy table */''}
      <tr><th>Kind</th><th>Idea</th><th>Examples</th><th>Limits and cost</th></tr>${/* table header row: kind, idea, examples, limits and cost */''}
      <tr><td>Spatial (physical)</td><td>Several components do the same job at once, or a spare stands by (hot standby).</td><td>Triple modular redundancy (TMR) with a majority voter; a backup name server.</td><td>Masks any fault in one unit, even a permanent one. Fails if two units are wrong in the same way or all copies share a flaw. TMR triples the hardware.</td></tr>${/* table row: spatial redundancy */''}
      <tr><td>Temporal</td><td>Repeat an operation when an error is detected.</td><td>A link resends a frame whose checksum failed.</td><td>Works for temporary faults; useless against a permanent one. Needs error detection first. Costs time.</td></tr>${/* table row: temporal redundancy */''}
      <tr><td>Information</td><td>Store extra bits (a code) or copies so errors can be detected and corrected.</td><td>Parity; error-correcting code (ECC) memory; RAID.</td><td>Costs storage and a little computation. Enough errors can fool any code.</td></tr>${/* table row: information redundancy */''}
    </table>${/* end of the redundancy table */''}
    <p><b>TMR:</b> three units each output 42 (00101010); the voter takes the majority in every bit, so one faulty unit is outvoted and flagged for repair. Two units wrong in the same bit outvote the good one.</p>${/* notes paragraph: how the TMR voter works bit by bit, and when it fails */''}
    <p><b>Retransmission:</b> each frame carries a checksum. If the receiver's recalculated checksum disagrees, the frame is sent again, masking a transient noise burst at the cost of one extra transmission. A cut cable is permanent: every resend is lost, and only a second, independent link (spatial redundancy) keeps data flowing.</p>${/* notes paragraph: retransmission beats a noise burst but not a cut cable */''}
    <p><b>Parity:</b> a parity bit makes a group's count of 1s even. With one per row and per column of a 4 × 4 block, a single flipped data bit fails one row check and one column check; their crossing locates it. Several flips are usually detected but not located; four flips on a rectangle's corners go undetected. <b>RAID:</b> disks hold 1011, 0110, 0101 and a parity disk their XOR, 1000; if disk 2 dies, 1011 ⊕ 0101 ⊕ 1000 = 0110 rebuilds it.</p>${/* notes paragraph: row and column parity, what it can locate or miss, and RAID parity by XOR */''}

    <h3>How the operating system helps</h3>${/* notes heading: how the operating system helps */''}
    <ul>${/* start of the list of OS mechanisms */''}
      <li><b>Process isolation</b>: each process has its own memory, files and flow of execution, enforced by memory-protection hardware; a stray write is trapped and only that process ends. It cannot contain a crash of the shared kernel.</li>${/* notes item: process isolation, and its limit (a kernel crash) */''}
      <li><b>Virtual machines</b>: each VM runs its own OS on a hypervisor, so even an OS crash stays inside one VM, and a standby VM (ideally on another machine) can take over. Cost: several OS copies.</li>${/* notes item: virtual machines, and their cost */''}
      <li><b>Concurrency controls</b>: processes sharing data can interleave their steps. If two $100 deposits to a $500 balance both copy it before either writes, the result is $600, not $700: a lost update from a <b>race condition</b> (the result depends on timing). Locks and semaphores enforce mutual exclusion, so every order gives $700. The OS can also detect deadlock and recover, for example by rolling one process back.</li>${/* notes item: concurrency controls, the lost-update example, and deadlock recovery */''}
      <li><b>Checkpoints and rollbacks</b>: save the state at a consistent moment, in storage the failure cannot destroy (checkpoint). After a failure, discard the damaged state, restore the checkpoint (rollback) and redo only the work since. Example: transfers between two accounts totalling $1,000; checkpoint after T3, crash halfway through T6 (total now wrong); roll back and redo T4 to T6 instead of all six. Frequent checkpoints lose less work but cost more time. Databases rely on this.</li>${/* notes item: checkpoints and rollbacks, the bank-transfer example, and the checkpoint trade-off */''}
    </ul>`,  // end of the notes text
});  // closes the section object and the call that registers it
