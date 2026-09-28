// Comment key: a line inside backtick text ends with ${/* comment */''}, an empty-string slot that holds a comment without changing the text on screen (full note at the top of the page).
/* Section 2.2 — The Evolution of Operating Systems
   Original teaching material. Built step by step. */
Guide.section({  // registers section 2.2 with the guide; the object below holds everything this section shows and teaches
  id: '2.2',  // the section number, used in links, the side menu and the saved progress
  title: 'The Evolution of Operating Systems',  // the full title shown at the top of every step of this section
  short: 'Evolution of OSs',  // the short name used in the side menu and the progress lists
  summary: 'From hands-on machines to batch monitors, multiprogramming and time sharing, and why each step came.',  // one-sentence summary shown under the section's name on the chapter page
  objectives: [  // objectives: the learning goals listed on the chapter page and in the printable version
    'Explain why operating systems keep evolving: hardware upgrades, new services and fixes.',  // goal 1: the three forces that keep an OS evolving
    'Describe serial processing and its two big problems, scheduling and setup time.',  // goal 2: serial processing and its scheduling and setup problems
    'Explain how a simple batch system works: the resident monitor, job control language, the hardware it needs, and user versus kernel mode.',  // goal 3: how a simple batch system works, including user and kernel mode
    'Calculate processor utilization and show how multiprogramming raises it compared with uniprogramming.',  // goal 4: calculating processor utilization with and without multiprogramming
    'Contrast batch multiprogramming with time sharing, and describe how CTSS shared one processor among many users.',  // goal 5: batch multiprogramming versus time sharing, and how CTSS worked
  ],  // closes the objectives list
  terms: [  // terms: glossary entries as [term, definition] pairs; they feed the glossary drawer, the key-term cards and the dotted-word popups
    ['Job', 'One unit of work handed to a computer: a program, its data, and the instructions for how to run it.'],  // glossary entry: job, one unit of work (program, data and run instructions)
    ['Serial processing', 'The earliest way of using a computer (late 1940s to mid-1950s): no operating system at all, and programmers took turns operating the hardware directly, one job after another.'],  // glossary entry: serial processing, the no-OS era of taking turns at the machine
    ['Setup time', 'Time spent getting a job ready to run (loading the compiler, the source program, linking and loading the result) during which the machine produces nothing useful.'],  // glossary entry: setup time, the unproductive time spent getting a job ready
    ['Batch system', 'A system in which users hand their jobs to an operator, who groups them into a batch; a monitor program then runs the jobs one after another with no human in between.'],  // glossary entry: batch system, jobs grouped by an operator and run by a monitor
    ['Resident monitor', 'The controlling program of a simple batch system. It stays in main memory at all times, reads each job, starts it, and takes control back when the job ends.'],  // glossary entry: resident monitor, the always-in-memory controller of a batch system
    ['Job control language (JCL)', 'A small command language whose statements, such as $JOB, $FTN, $LOAD, $RUN and $END, tell the monitor what to do with a job.'],  // glossary entry: job control language (JCL), the $ commands that direct the monitor
    ['Memory protection', 'Hardware that stops a running program from changing memory it does not own, such as the area that holds the monitor.'],  // glossary entry: memory protection, hardware that guards memory a program does not own
    ['Timer', 'A hardware countdown the OS sets before letting a program run. When it reaches zero it interrupts the program so the OS gets the processor back.'],  // glossary entry: timer, the hardware countdown that gives the OS the processor back
    ['Privileged instruction', 'A machine instruction (for example, one that starts I/O) that the hardware lets only the OS execute. If a user program tries it, the hardware stops it and hands control to the OS.'],  // glossary entry: privileged instruction, an instruction only the OS may execute
    ['User mode', 'The restricted processor mode in which ordinary programs run: protected memory and privileged instructions are off-limits.'],  // glossary entry: user mode, the restricted processor mode for ordinary programs
    ['Kernel mode', 'The unrestricted processor mode in which the OS runs: it may execute privileged instructions and touch protected memory. Also called system mode or control mode.'],  // glossary entry: kernel mode, the unrestricted mode the OS runs in
    ['Uniprogramming', 'Running just one user program at a time. The processor sits idle whenever that program waits for I/O.'],  // glossary entry: uniprogramming, one user program at a time
    ['Multiprogramming', 'Keeping several programs in memory at once so that when one must wait for I/O the processor can run another. Also called multitasking.'],  // glossary entry: multiprogramming, several programs in memory so the processor can switch
    ['Processor utilization', 'The fraction of time the processor is busy doing useful work: busy time divided by total time.'],  // glossary entry: processor utilization, busy time divided by total time
    ['Throughput', 'How much work a system finishes per unit of time, for example jobs completed per hour.'],  // glossary entry: throughput, work finished per unit of time
    ['Response time', 'The time from submitting a request or job until its result comes back.'],  // glossary entry: response time, from submitting a request to getting its result
    ['Time sharing', 'Sharing one processor among many interactive users at terminals by giving each a short turn in rotation, so every user gets quick answers.'],  // glossary entry: time sharing, one processor shared among many interactive users in turns
    ['Time slice', 'The short stretch of processor time a program gets before the OS may switch to another program. Also called a quantum.'],  // glossary entry: time slice (quantum), one program's short turn on the processor
    ['Swapping', 'Copying a program\'s memory image out to disk to make room for another program, and later copying it back so it can continue where it left off.'],  // glossary entry: swapping, moving a program's memory image to disk and back
    ['Compatible Time-Sharing System (CTSS)', 'One of the first time-sharing operating systems, built at MIT in 1961 for the IBM 709 and later the IBM 7094.'],  // glossary entry: CTSS, one of the first time-sharing systems (MIT, 1961)
  ],  // closes the terms list

  css: ` /* css: the style rules (CSS, the language that sets colors, sizes and layout) for this section, added to the page when it loads */
    /* shell workaround: in narrow mode the nowrap eyebrow otherwise sets the canvas min-width and the page gets clipped */
    .sec-2-2 .step-eyebrow { contain: inline-size; } /* keeps the long title line above each step from stretching the page sideways on a small screen */
    .sec-2-2 .era-card { transition: background .25s, border-color .25s; } /* the era card in step 1 fades its background and border colors over a quarter second when they change */
    .sec-2-2 .era-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; } /* the era card's two boxes ("problem it solved" and "problem it created") sit side by side */
    .sec-2-2 .era-grid > div { border-radius: 10px; padding: 8px 11px; font-size: 14.5px; line-height: 1.4; } /* each of those boxes gets rounded corners, padding and readable text */
    .sec-2-2 .era-grid .lbl { display: block; font-size: 11.5px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; margin-bottom: 2px; } /* the small colored label at the top of each box, in spaced-out capitals */
    .sec-2-2 .hot { cursor: pointer; } /* anything marked "hot" in this section is clickable, so the mouse pointer turns into a hand over it */
    .sec-2-2 .hot:hover rect, .sec-2-2 .hot:hover circle { stroke-width: 3.5; } /* hovering a clickable drawing part (a timeline dot or a machine part) thickens its outline */
    .sec-2-2 .deck { display: flex; flex-direction: column; gap: 5px; } /* the job deck in step 3: the card rows stacked top to bottom with small gaps */
    .sec-2-2 .deck-row { display: grid; grid-template-columns: 22px 1fr auto; align-items: center; gap: 8px; padding: 3px 6px 3px 8px; border: 2px solid var(--line); border-radius: 9px; background: var(--panel); font-size: 15px; line-height: 1.25; min-height: 42px; } /* each card row: a slim position column, the card's name and meaning, then the move buttons, in a rounded box */
    .sec-2-2 .deck-row .nm { font-family: var(--mono); font-weight: 800; } /* the card's name in a bold fixed-width font, like text punched on a card */
    .sec-2-2 .deck-row .nm.ctl { color: var(--os); } /* control cards (the ones starting with $) are shown in the purple OS color */
    .sec-2-2 .deck-row .nm.usr { color: var(--proc); font-family: var(--font); font-weight: 650; } /* the student's own cards (source program, data) are teal and use the normal font */
    .sec-2-2 .deck-row .ix { font-size: 12px; font-weight: 800; color: var(--muted); text-align: center; } /* the position number (or check mark) in small, bold, gray, centered type */
    .sec-2-2 .deck-row .mv { display: flex; gap: 3px; } /* the pair of move-up and move-down buttons side by side */
    .sec-2-2 .deck-row .mv button { width: 28px; height: 26px; border-radius: 7px; border: 1px solid var(--line-2); background: var(--panel-2); cursor: pointer; font-size: 12px; color: var(--ink-2); } /* each move button is a small rounded square */
    .sec-2-2 .deck-row .mv button:disabled { opacity: .35; cursor: default; } /* a move button that cannot be used (top card up, bottom card down) is faded */
    .sec-2-2 .deck-row.cur { border-color: var(--chc); background: color-mix(in srgb, var(--chc) 12%, var(--panel)); } /* the card the monitor is reading right now is outlined and tinted in the chapter color */
    .sec-2-2 .deck-row.done { border-color: color-mix(in srgb, var(--ok) 55%, transparent); } /* cards already read get a soft green border */
    .sec-2-2 .deck-row.bad { border-color: var(--bad); background: var(--bad-bg); } /* the card where the job went wrong is tinted red */
    .sec-2-2 .deck-row.skip { opacity: .45; } /* cards skipped after an aborted job are faded */
    .sec-2-2 .feat { display: grid; grid-template-columns: 1fr auto; gap: 1px 10px; align-items: center; padding: 6px 10px; border: 2px solid var(--line); border-radius: 10px; background: var(--panel); } /* each hardware feature card in step 4: name and switch on the first row, description underneath */
    .sec-2-2 .feat.on { border-color: color-mix(in srgb, var(--ok) 60%, transparent); } /* a feature that is switched on gets a soft green border */
    .sec-2-2 .feat.off { border-color: color-mix(in srgb, var(--bad) 60%, transparent); background: var(--bad-bg); } /* a feature that is switched off gets a red border and a pale red background */
    .sec-2-2 .feat .fn { font-weight: 750; font-size: 15px; } /* the feature's name in bold */
    .sec-2-2 .feat .fd { grid-column: 1 / 2; font-size: 13px; color: var(--ink-2); line-height: 1.3; } /* the feature's description, kept in the first column under the name, in smaller type */
    .sec-2-2 .feat .sw { grid-row: 1 / 3; grid-column: 2; min-width: 58px; } /* the ON/OFF switch spans both rows in the second column and has a minimum width */
    .sec-2-2 .sw.on { border-color: var(--ok); color: var(--ok); background: var(--ok-bg); } /* the switch in the ON state is green */
    .sec-2-2 .sw.off { border-color: var(--bad); color: var(--bad); background: var(--panel); } /* the switch in the OFF state is red on a plain background */
    .sec-2-2 .bars { display: flex; flex-direction: column; gap: 7px; } /* a list of horizontal bars stacked in a column (used by the utilization and resource charts) */
    .sec-2-2 .bar-row { display: grid; grid-template-columns: 92px minmax(0, 1fr) 48px; align-items: center; gap: 8px; font-size: 14px; } /* each bar row: a label column, the bar, and a value column */
    .sec-2-2 .bar-row .v { font-family: var(--mono); font-weight: 800; text-align: right; } /* the value at the end of each bar, in bold fixed-width type, right-aligned so the numbers line up */
    .sec-2-2 .bar { position: relative; height: 16px; border-radius: 6px; background: var(--panel-3); overflow: hidden; } /* the bar's gray track, with rounded ends; its filling is clipped to the track */
    .sec-2-2 .bar > i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 6px; transition: width .45s ease; } /* the colored filling of a bar, which slides smoothly to its new width when the numbers change */
    .sec-2-2 .bar > b { position: absolute; top: 0; bottom: 0; width: 3px; background: var(--ink-2); opacity: .55; transition: left .45s ease; } /* a thin marker on a bar showing the other mode's value, which slides smoothly too */
    .sec-2-2 .kpi { display: flex; flex-direction: column; gap: 0; } /* a stat block: a small label over a big number */
    .sec-2-2 .kpi .big { font-size: 34px; } /* the big number in a stat block, 34px tall */
    .sec-2-2 .res { display: grid; grid-template-columns: 38px 1fr; gap: 8px; align-items: center; padding: 4px 8px; border-radius: 9px; border: 1px solid var(--line); background: var(--panel); font-size: 14px; line-height: 1.35; } /* each job outcome row in step 4: the job label in a slim column, then the result text, in a bordered box */
    .sec-2-2 .res .jb { font-weight: 800; font-family: var(--mono); text-align: center; border-radius: 7px; padding: 2px 0; } /* the job label (J1 to J6) in bold fixed-width type, centered */
    .sec-2-2 .res.ok { border-color: color-mix(in srgb, var(--ok) 50%, transparent); } /* an outcome that went well gets a soft green border */
    .sec-2-2 .res.bad { border-color: var(--bad); background: var(--bad-bg); } /* an outcome that went badly is outlined and tinted red */
    .sec-2-2 .res.warn { border-color: var(--warn); background: var(--warn-bg); } /* an outcome that worked but not cleanly is outlined and tinted amber */
    .sec-2-2 .legend-sw { display: inline-block; width: 12px; height: 12px; border-radius: 3px; vertical-align: -1px; margin-right: 4px; border: 1.5px solid; } /* a small colored square used in legends to show what each color means */
    .sec-2-2 .f-setup { fill: color-mix(in srgb, var(--warn) 38%, var(--panel)); stroke: var(--warn); } /* drawing fill for setup time: pale amber with an amber outline */
    .sec-2-2 .f-run { fill: color-mix(in srgb, var(--proc) 45%, var(--panel)); stroke: var(--proc); } /* drawing fill for running (useful computing): teal with a teal outline */
    .sec-2-2 .f-lost { fill: color-mix(in srgb, var(--bad) 35%, var(--panel)); stroke: var(--bad); } /* drawing fill for time lost when a job is cut off: pale red with a red outline */
    .sec-2-2 .chain { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 26px; } /* the recap chain in step 9: four equal cards in a row with room for arrows between them */
    .sec-2-2 .chain > div { position: relative; } /* each chain card is positioned so its arrow can be placed next to it */
    .sec-2-2 .chain > div:not(:last-child)::after { content: '→'; position: absolute; right: -21px; top: 50%; transform: translateY(-50%); font-weight: 900; color: var(--chc); font-size: 18px; } /* draws a chapter-colored arrow to the right of every chain card except the last, pointing to the next era */
  `,  // end of this section's CSS text

  steps: [  // steps: the list of slides in this section, shown one at a time in this order
    /* ---------------- 1. Big picture: why OSs evolve + scrubbable era timeline ---------------- */
    {  // step 1 begins: why an OS keeps evolving, and a timeline of the four early eras
      title: 'An operating system is never finished',  // the title shown at the top of step 1
      kind: 'story',  // kind "story" labels this step as the Big Picture in the heading above the title
      render(el, ctx) {  // render(el, ctx) runs when the student arrives on this step; el is the empty step area and ctx holds the guide's helpers
        const { h, s } = ctx;  // pulls out h (builds one HTML element) and s (builds one SVG element; SVG is the browser's drawing format)
        const ERAS = [  // ERAS: the four early eras, each with names, years, a color, how it worked, what it solved and what it left open
          { name: 'Serial processing', short: 'Serial', years: 'late 1940s – mid-1950s', cls: 'io',  // era 1, serial processing: full name, short timeline label, years and chip color
            how: 'There is <b>no operating system</b>. Each programmer books time and runs the machine by hand: switches and lights on a console, a card reader for input, a printer for output.',  // how serial processing worked: no OS, the programmer runs the machine by hand
            solved: 'The first way to use a computer at all: a programmer gets the whole machine and can watch and fix a program directly.',  // what serial processing offered: the whole machine for one programmer
            created: 'Booked time is either wasted or too short, and much of every session goes on manual setup instead of computing.' },  // what serial processing left open: wasted booked time and long manual setup; closes era 1
          { name: 'Simple batch systems', short: 'Simple batch', years: 'mid-1950s onward', cls: 'os',  // era 2, simple batch systems, from the mid-1950s, in the OS color
            how: 'Users hand their jobs to an operator. A <b>resident monitor</b> program reads the jobs one after another and starts each one automatically.',  // how simple batch worked: an operator collects jobs and a resident monitor runs them in turn
            solved: 'No more idle gaps between jobs: the machine goes straight from one job to the next with no human in the way.',  // what simple batch solved: no idle gaps between jobs
            created: 'Only one job is in memory, so the processor sits idle every time that job waits for a slow I/O device.' },  // what simple batch left open: the processor idles whenever the one job in memory waits for I/O
          { name: 'Multiprogrammed batch systems', short: 'Multiprogrammed', years: '1960s', cls: 'proc',  // era 3, multiprogrammed batch systems, 1960s, in the process color
            how: 'Several jobs sit in memory together. When the running job must wait for I/O, the processor <b>switches to another job</b> that is ready.',  // how multiprogramming worked: several jobs in memory, switch when one must wait
            solved: 'The processor and the devices stay busy, so far more jobs finish per hour.',  // what multiprogramming solved: the processor and devices stay busy, so more jobs finish per hour
            created: 'Users still cannot talk to a running job. They submit it and wait, sometimes for hours, for printed output.' },  // what multiprogramming left open: users still cannot interact and wait hours for output
          { name: 'Time-sharing systems', short: 'Time sharing', years: '1960s onward (CTSS, 1961)', cls: 'cpu',  // era 4, time-sharing systems, 1960s onward with CTSS in 1961, in the processor color
            how: 'Many users sit at terminals. The processor gives each user a <b>short slice of time</b> in turn, fast enough that everyone feels they have the machine to themselves.',  // how time sharing worked: every terminal user gets a short slice of time in turn
            solved: 'Quick answers for interactive users: type a command, see the result in seconds.',  // what time sharing solved: quick answers for interactive users
            created: 'Users must be protected from one another, files need access control, and everyone competes for shared devices.' },  // what time sharing left open: protecting users and files from each other and sharing devices
        ];  // closes the ERAS list
        let cur = 0;  // cur is the era shown right now (0 to 3)
        const X = [78, 238, 398, 558];  // X: the horizontal position of each era's dot on the timeline drawing
        const svg = s('svg', { viewBox: '0 0 636 104', width: '100%' });  // the timeline drawing, 636 by 104 units, scaled to the column width
        const title = h('div', { class: 'row', style: { justifyContent: 'space-between', alignItems: 'baseline' } });  // the card's title row: era name on the left, years chip on the right, lined up on their text
        const how = h('p', { class: 'm0', style: { fontSize: '15.5px', lineHeight: '1.45' } });  // the paragraph that says how the chosen era worked
        const solved = h('div', { style: { background: 'var(--ok-bg)' } });  // the green box for the problem the era solved
        const created = h('div', { style: { background: 'var(--warn-bg)' } });  // the amber box for the problem the era created
        const card = h('div', { class: 'card white era-card stack', style: { gap: '9px' } }, title, how, h('div', { class: 'era-grid' }, solved, created));  // the era card: title row, how-it-worked paragraph, then the two boxes side by side
        const prev = h('button', { class: 'btn sm', onclick: () => show(cur - 1) }, '◀ Earlier');  // the "Earlier" button shows the previous era
        const next = h('button', { class: 'btn sm', onclick: () => show(cur + 1) }, 'Later ▶');  // the "Later" button shows the next era
        const slider = ctx.ui.slider({ label: 'Scrub', min: 0, max: 3, step: 1, value: 0, format: (v) => ERAS[v].short, onInput: (v) => show(v) });  // ctx.ui.slider makes a labeled slider from 0 to 3 whose readout shows the era's short name; dragging it shows that era
        function drawLine() {  // drawLine() redraws the timeline for the current era
          const kids = [  // kids collects the shapes to draw, starting with the two lines
            s('line', { x1: 40, y1: 44, x2: 600, y2: 44, class: 's-muted', 'stroke-width': 4 }),  // the full timeline as a thick gray line
            s('line', { x1: 40, y1: 44, x2: X[cur], y2: 44, style: 'stroke:var(--chc)', 'stroke-width': 4 }),  // the part of the line up to the current era, drawn over it in the chapter color
          ];  // closes the starting shapes
          ERAS.forEach((e, i) => {  // adds one clickable dot group per era
            const on = i === cur;  // on is true for the era shown right now
            kids.push(s('g', { class: 'hot', onclick: () => show(i), role: 'button', 'aria-label': e.name },  // the group for this era: clicking any part of it shows that era
              s('circle', { cx: X[i], cy: 44, r: on ? 19 : 15, class: on ? 's-accent' : 's-panel', 'stroke-width': on ? 3 : 2 }),  // the dot: larger, accent-colored and thicker for the current era
              s('text', { x: X[i], y: 50, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 800, style: on ? 'fill:var(--accent)' : '' }, String(i + 1)),  // the era number inside the dot
              s('text', { x: X[i], y: 16, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, e.years.replace(' (CTSS, 1961)', '')),  // the years above the dot, without the CTSS note so it fits
              s('text', { x: X[i], y: 86, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': on ? 800 : 600 }, e.short)));  // the short era name under the dot, bolder for the current era; closes the group
          });  // ends the loop over the eras
          svg.replaceChildren(...kids);  // replaces the old drawing with the new shapes
        }  // ends drawLine()
        function show(i) {  // show(i) switches to era i; it runs on every button click, slider move and dot click
          cur = ctx.util.clamp(i, 0, ERAS.length - 1);  // keeps i inside 0 to 3 (clamp) and remembers it
          const e = ERAS[cur];  // e is the chosen era's data
          drawLine();  // redraws the timeline
          slider.set(cur, false);  // moves the slider to match without triggering it again
          prev.disabled = cur === 0; next.disabled = cur === ERAS.length - 1;  // disables "Earlier" on the first era and "Later" on the last
          title.innerHTML = `<h3 class="m0">${cur + 1}. ${e.name}</h3><span class="chip ${e.cls}">${e.years}</span>`;  // fills the title row with the numbered era name and a chip showing its years
          how.innerHTML = e.how;  // fills the how-it-worked paragraph
          solved.innerHTML = `<span class="lbl" style="color:var(--ok)">${cur === 0 ? 'What it offered' : 'Problem it solved'}</span>${e.solved}`;  // fills the green box; the first era is labeled "What it offered" since there was nothing before it to fix
          created.innerHTML = `<span class="lbl" style="color:var(--warn)">Problem it created</span>${e.created}`;  // fills the amber box with the problem this era created
          card.classList.remove('fade-in'); void card.offsetWidth; card.classList.add('fade-in');  // restarts the fade-in animation: reading offsetWidth forces the browser to notice the removal before the class returns
        }  // ends show()
        const reasons = [  // reasons: the three forces that keep an OS changing, as [color, title, explanation]
          ['cpu', 'Hardware upgrades and new hardware', 'When chips gained several cores, the OS had to learn to spread work across them. New devices, from touchscreens to fast solid-state drives, need new support.'],  // force 1: hardware upgrades and new hardware, such as multicore chips and new devices
          ['proc', 'New services', 'People keep asking for more: networking, cloud sync, better security tools. The OS grows new features to supply them.'],  // force 2: new services people ask for, such as networking and cloud sync
          ['intr', 'Fixes', 'Every large program contains faults. Patches repair them (and sometimes add new ones), so the OS changes even when nobody asks for anything new.'],  // force 3: fixes, which can themselves add new faults
        ];  // closes the reasons list
        const left = h('div', { class: 'stack', style: { gap: '10px' } },  // left column of the step
          h('p', { class: 'lead m0', html: 'As section 2.1 showed, an <span class="t">operating system</span> is never done. Three forces keep changing it:' }),  // lead paragraph: an OS is never done, and three forces keep changing it
          ...reasons.map(([c, t, d], i) => h('div', { class: 'card tight ' + c, style: { display: 'grid', gridTemplateColumns: '30px 1fr', gap: '10px', alignItems: 'start' } },  // one tinted card per force, with a number column and a text column
            h('span', { class: 'chip ' + c, style: { justifyContent: 'center', padding: '2px 0' } }, String(i + 1)),  // the force's number in a colored chip
            h('div', {}, h('div', { class: 'b', style: { fontSize: '15.5px' } }, t), h('div', { class: 'small', style: { lineHeight: '1.4' } }, d)))),  // the force's title in bold and its explanation underneath; closes the card and the map
          h('div', { class: 'callout analogy m0', 'data-label': 'Analogy', html: 'Think of a city\'s transit system. New kinds of vehicles arrive, riders want new routes, and worn track must be repaired. The city never stops rebuilding, and neither does an OS.' }));  // analogy box: a city's transit system never stops rebuilding; closes the left column
        const right = h('div', { class: 'stack', style: { gap: '8px' } },  // right column of the step
          h('h4', { class: 'm0' }, 'Scrub through the early history (click a dot or drag)'),  // heading telling the student to click a dot or drag the slider
          svg,  // the timeline drawing
          h('div', { class: 'row nw' }, prev, h('div', { class: 'grow' }, slider), next),  // a row that does not wrap: Earlier button, the slider stretched in the middle, Later button
          card,  // the era card
          h('p', { class: 'small muted m0', html: 'Notice the pattern: each era\'s <b>new problem</b> is exactly what the next era set out to fix. The rest of this section lets you run each era yourself.' }),  // note: each era's new problem is what the next era set out to fix
          h('div', { class: 'callout why m0 small', 'data-label': 'Why it matters', html: 'Protection, scheduling, memory management and file security were not invented all at once. Each was a fix for a real waste or danger in one of these eras, so knowing the history explains why a modern OS looks the way it does.' }));  // "Why it matters" box: modern OS features were fixes for problems in these eras; closes the right column
        el.append(h('div', { class: 'split l fill' }, left, right));  // puts both columns on screen, side by side, filling the step area
        show(0);  // shows the first era right away
      },  // ends render() for step 1
    },  // ends step 1

    /* ---------------- 2. Serial processing: machine room hotspots + sign-up sheet simulator ---------------- */
    {  // step 2 begins: serial processing, with a clickable machine room and a sign-up sheet simulator
      title: 'Serial processing: the programmer is the OS',  // the title shown at the top of step 2
      kind: 'explore',  // kind "explore" labels this step as an Explore step
      render(el, ctx) {  // render(el, ctx) builds step 2 when the student arrives on it
        const { h, s } = ctx;  // pulls out the h (HTML) and s (SVG) element builders
        /* ---- left: the machine room with clickable parts ---- */
        const PARTS = {  // PARTS: what the info card says when each part of the machine is clicked
          console: '<b>Console.</b> Lights showed the registers; switches keyed in values. If an error halted the program, the lights showed it.',  // the console: lights showing the registers and switches for keying in values
          reader: '<b>Card reader.</b> The input device: the program, already in machine code, was fed in on a deck of punched cards.',  // the card reader: the input device, fed a deck of punched cards in machine code
          printer: '<b>Printer.</b> The output device: if the program ran to the end, its results were printed here.',  // the printer: the output device for results
        };  // closes the PARTS table
        const info = h('div', { class: 'card tight small', style: { lineHeight: '1.4', minHeight: '58px' }, html: '<span class="muted">Click a part of the machine to see what the programmer did with it.</span>' });  // the info card under the drawing, starting with a gray prompt to click a part
        const room = s('svg', { viewBox: '0 0 470 124', width: '100%' });  // the machine room drawing, 470 by 124 units
        const part = (key, x, w, cls, label, extra) => s('g', { class: 'hot', role: 'button', 'aria-label': label, onclick: () => { info.innerHTML = PARTS[key]; room.querySelectorAll('.hot > rect').forEach((r) => r.setAttribute('stroke-width', 2)); room.querySelector(`[data-k="${key}"]`).setAttribute('stroke-width', 4); } },  // part(): draws one clickable machine part; clicking it fills the info card and thickens only that part's outline
          s('rect', { x, y: 8, width: w, height: 86, rx: 10, class: cls, 'stroke-width': 2, 'data-k': key }), ...extra,  // the part's main rectangle (tagged with data-k so the click can find it), then its extra details
          s('text', { x: x + w / 2, y: 114, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700 }, label));  // the part's name under the rectangle; ends part()
        const lights = [], toggles = [];  // lists for the console's little lights and toggle switches
        for (let r = 0; r < 3; r++) for (let c = 0; c < 8; c++) lights.push(s('circle', { cx: 32 + c * 19, cy: 24 + r * 15, r: 4.5, style: (r * 8 + c) % 3 ? 'fill:var(--panel-3);stroke:var(--line-2)' : 'fill:var(--warn);stroke:var(--warn)' }));  // 3 rows of 8 lights; every third one is lit amber, the rest are dark
        for (let c = 0; c < 8; c++) toggles.push(s('line', { x1: 32 + c * 19, y1: 84, x2: 32 + c * 19 + (c % 2 ? 5 : -5), y2: 70, style: 'stroke:var(--ink-2)', 'stroke-width': 3, 'stroke-linecap': 'round' }));  // 8 toggle switches drawn as short thick lines, tilted alternately left and right
        room.append(  // puts the three parts into the machine room drawing
          part('console', 12, 190, 's-cpu', 'Console: lights + switches', [...lights, ...toggles]),  // the console on the left, with its lights and switches inside
          part('reader', 224, 110, 's-io', 'Card reader', [s('rect', { x: 246, y: 30, width: 66, height: 40, rx: 3, class: 's-panel', 'stroke-width': 1.5 }), s('rect', { x: 252, y: 24, width: 66, height: 40, rx: 3, class: 's-panel', 'stroke-width': 1.5 }), s('line', { x1: 262, y1: 36, x2: 306, y2: 36, class: 's-muted', 'stroke-dasharray': '3 4' }), s('line', { x1: 262, y1: 46, x2: 306, y2: 46, class: 's-muted', 'stroke-dasharray': '2 5' })]),  // the card reader in the middle, drawn with two stacked cards showing dashed punch rows
          part('printer', 352, 106, 's-io', 'Printer', [s('rect', { x: 372, y: 22, width: 66, height: 30, rx: 3, class: 's-panel', 'stroke-width': 1.5 }), s('rect', { x: 366, y: 50, width: 78, height: 26, rx: 5, class: 's-io', 'stroke-width': 1.5 })]));  // the printer on the right, drawn with paper coming out of it; closes the drawing
        const left = h('div', { class: 'stack', style: { gap: '9px' } },  // left column of the step
          h('p', { class: 'lead m0', html: 'From the late 1940s to the mid-1950s there was <b>no operating system</b>. Programmers ran the hardware themselves, one after another: <span class="t">serial processing</span>.' }),  // lead paragraph: from the late 1940s to the mid-1950s there was no OS, only serial processing
          h('div', { style: { flex: 'none' } }, room), info,  // the machine room drawing (kept at its natural height) and the info card under it
          h('div', { class: 'small', style: { lineHeight: '1.42' }, html: '<b>Problem 1, scheduling.</b> Time was booked on a paper sign-up sheet in fixed blocks. Finish early and the rest is wasted; run long and you are stopped unfinished.<br><b>Problem 2, <span class="t">setup time</span>.</b> One <span class="t">job</span> meant loading the compiler and the source program, saving the compiled result, then loading and linking it with common routines, often mounting tapes or card decks along the way. One error meant starting over.' }),  // the two problems: fixed sign-up blocks (scheduling) and the long chain of setup steps (setup time)
          h('div', { class: 'callout analogy m0 small', 'data-label': 'Analogy', html: 'A practice room booked by the hour: leave early and it sits empty; run over and the next band walks in mid-song.' }));  // analogy box: a practice room booked by the hour; closes the left column

        /* ---- right: sign-up sheet simulator ---- */
        const JOBS = [['Rosa', 20, 15], ['Tom', 25, 40], ['Mei', 15, 10], ['Sam', 30, 20], ['Lena', 20, 55]];  // JOBS: the five programmers as [name, setup minutes, running minutes]; nobody's times match the block exactly
        /* phones get a narrower drawing so its labels stay readable */
        const NW = ctx.narrow, MAXB = 90, X0 = NW ? 50 : 62, W = NW ? 220 : 420, RH = 27, GAP = 7, Y0 = 24, VW = NW ? 380 : 640;  // layout numbers: NW is true on a phone-width screen (smaller drawing), MAXB the longest block, then positions and sizes
        const sx = (m) => X0 + (m / MAXB) * W;  // sx(m) turns a number of minutes into a horizontal position on the sheet drawing
        const sheet = s('svg', { viewBox: `0 0 ${VW} ` + (Y0 + JOBS.length * (RH + GAP) + 2), width: '100%', style: 'flex:none' });  // the sign-up sheet drawing, its height worked out from the number of rows
        const stack = h('div', { style: { display: 'flex', height: '22px', borderRadius: '7px', overflow: 'hidden', border: '1px solid var(--line)' } });  // the stacked bar that splits all booked time into useful, setup, lost and idle
        const stackLbl = h('div', { class: 'row small', style: { gap: '14px' } });  // the legend under the stacked bar, with each part's percentage
        const verdict = h('div', { class: 'callout m0 small', style: { lineHeight: '1.4' } });  // the verdict box under the legend
        function run(B) {  // run(B) redraws the simulator for blocks of B minutes; it runs at the start and whenever the slider moves
          let useful = 0, setup = 0, wasted = 0, idle = 0, done = 0;  // counters for minutes of useful work, setup, time lost to cut-offs and idle time, plus jobs finished
          const kids = [s('text', { x: X0, y: 14, 'font-size': 12.5, class: 's-sub', 'text-anchor': NW ? 'middle' : 'start' }, NW ? '0' : '0 min')];  // kids collects the shapes to draw, starting with the "0" label at the start of the time scale
          for (let m = 15; m <= MAXB; m += 15) kids.push(s('line', { x1: sx(m), y1: 20, x2: sx(m), y2: Y0 + JOBS.length * (RH + GAP) - GAP, style: 'stroke:var(--line)', 'stroke-dasharray': '2 4' }), s('text', { x: sx(m), y: 14, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, m + ''));  // a dotted guide line and a minute label every 15 minutes along the scale
          JOBS.forEach(([name, su, rn], i) => {  // draws one row per programmer
            const y = Y0 + i * (RH + GAP);  // y is this row's vertical position
            const need = su + rn, ok = need <= B;  // need is the job's total time; ok is true when it fits in the block
            const suIn = Math.min(su, B), rnIn = Math.max(0, Math.min(rn, B - su));  // how much setup and how much running actually fit inside the block
            setup += suIn;  // adds this job's setup minutes to the total
            if (ok) { useful += rn; idle += B - need; done++; } else wasted += rnIn;  // a finished job adds its running time as useful and the rest of its block as idle; a cut-off job's running time is lost
            kids.push(s('text', { x: X0 - 8, y: y + RH / 2 + 5, 'text-anchor': 'end', 'font-size': 14, 'font-weight': 700 }, name));  // the programmer's name at the left of the row
            kids.push(s('rect', { x: sx(0), y, width: sx(B) - sx(0), height: RH, rx: 5, class: 's-muted', 'stroke-dasharray': '5 4', style: 'fill:var(--panel)' }));  // the whole booked block as a dashed outline
            kids.push(s('rect', { x: sx(0), y, width: sx(suIn) - sx(0), height: RH, rx: 5, class: 'f-setup', 'stroke-width': 1.5 }));  // the setup part of the block, in amber
            if (rnIn > 0) kids.push(s('rect', { x: sx(suIn), y, width: sx(suIn + rnIn) - sx(suIn), height: RH, rx: 5, class: ok ? 'f-run' : 'f-lost', 'stroke-width': 1.5 }));  // the running part: teal if the job finished, red if it was cut off (drawn only if it got to run at all)
            if (!ok) kids.push(s('text', { x: sx(B) - 7, y: y + RH / 2 + 6, 'text-anchor': 'end', 'font-size': 17, 'font-weight': 900, style: 'fill:var(--bad)' }, '✗'));  // a red cross at the end of the block when the job was cut off
            kids.push(s('text', { x: X0 + W + 16, y: y + RH / 2 + 5, 'font-size': 13.5, 'font-weight': 700, style: ok ? 'fill:var(--ok)' : 'fill:var(--bad)' },  // the row's status at the right, green for finished and red for cut off
              ok ? (B - need ? `✓ ${NW ? '' : 'done, '}${B - need} min idle` : (NW ? '✓ no idle' : '✓ done, no idle')) : (NW ? '✗ cut off' : `✗ cut off (needs ${need})`)));  // the status wording, shorter on a phone-width screen: minutes idle, "no idle", or "cut off" with the time it needed
          });  // ends the loop over the programmers
          sheet.replaceChildren(...kids);  // replaces the old sheet drawing with the new shapes
          const total = B * JOBS.length;  // total is all booked minutes: the block length times five programmers
          const segs = [['Useful computing', useful, 'color-mix(in srgb, var(--proc) 45%, var(--panel))', 'var(--proc)'], ['Setup', setup, 'color-mix(in srgb, var(--warn) 38%, var(--panel))', 'var(--warn)'], ['Lost to cut-offs', wasted, 'color-mix(in srgb, var(--bad) 35%, var(--panel))', 'var(--bad)'], ['Idle', idle, 'var(--panel-3)', 'var(--line-2)']];  // segs: the four parts of the stacked bar as [label, minutes, fill color, edge color]
          stack.replaceChildren(...segs.filter((g) => g[1] > 0).map(([l, v, c, b]) => h('div', { title: l, style: { width: (v / total) * 100 + '%', background: c, borderRight: '2px solid ' + b, transition: 'width .3s' } })));  // redraws the stacked bar, one part per nonzero kind, each as wide as its share of the total
          stackLbl.replaceChildren(...segs.map(([l, v, c, b]) => h('span', { html: `<span class="legend-sw" style="background:${c};border-color:${b}"></span>${l} <b>${Math.round((v / total) * 100)}%</b>` })));  // redraws the legend with a color square and a rounded percentage for every kind
          const pct = Math.round((useful / total) * 100);  // pct is the share of booked time that did useful computing
          verdict.className = 'callout m0 small ' + (done < JOBS.length ? 'bad' : 'warn');  // the verdict is red when someone was cut off and amber when everyone finished but time was wasted
          verdict.setAttribute('data-label', `${done} of ${JOBS.length} jobs finished · ${pct}% useful`);  // the verdict's label shows how many jobs finished and the useful percentage
          verdict.innerHTML = done < JOBS.length  // the verdict text depends on whether anyone was cut off
            ? `With ${B}-minute blocks, ${JOBS.length - done} programmer${JOBS.length - done > 1 ? 's were' : ' was'} stopped before finishing, so all of that time produced nothing. Longer blocks fix this, but then short jobs leave the machine idle.`  // someone was cut off: their time produced nothing, and longer blocks would leave short jobs idle
            : `Everyone finished, yet ${idle} of the ${total} booked minutes sat idle and ${setup} more went on setup. Only ${pct}% of the machine's time did useful computing.`;  // everyone finished: how many minutes sat idle, how many went on setup, and the useful percentage
        }  // ends run()
        const B0 = 60;  // the simulator starts with 60-minute blocks
        const slider = ctx.ui.slider({ label: 'Each block booked', min: 30, max: MAXB, step: 15, value: B0, format: (v) => v + ' min', onInput: run });  // the slider for the block length, 30 to 90 minutes in steps of 15; moving it calls run
        const right = h('div', { class: 'card white stack', style: { gap: '9px' } },  // right column: the simulator card
          h('h3', { class: 'm0' }, 'Sign-up sheet simulator'),  // heading: "Sign-up sheet simulator"
          h('p', { class: 'small m0 muted', html: 'Five programmers each book one block of the same length. Each job needs <span style="color:var(--warn);font-weight:700">setup</span>, then <span style="color:var(--proc);font-weight:700">running</span>; nobody knows the exact times in advance.' }),  // instructions, with the words setup and running colored to match the drawing
          slider, sheet, stack, stackLbl, verdict,  // the slider, the sheet drawing, the stacked bar, its legend and the verdict
          h('p', { class: 'small muted m0', html: '<b>Why it matters:</b> machines cost a fortune, so every idle minute was money wasted. That pressure produced the first operating systems.' }));  // "Why it matters" line: idle minutes on costly machines led to the first operating systems; closes the card
        el.append(h('div', { class: 'split l fill' }, left, right));  // puts both columns on screen, side by side, filling the step area
        run(B0);  // draws the simulator for the starting block length
      },  // ends render() for step 2
    },  // ends step 2

    /* ---------------- 3. Simple batch: build a JCL deck and watch the resident monitor run it ---------------- */
    {  // step 3 begins: the student orders a job deck and watches the resident monitor process it
      title: 'Simple batch: the monitor reads your job deck',  // the title shown at the top of step 3
      kind: 'lab',  // kind "lab" labels this step as a Hands-on Lab
      render(el, ctx) {  // render(el, ctx) builds step 3 when the student arrives on it
        const { h, s } = ctx;  // pulls out the h (HTML) and s (SVG) element builders
        const CARDS = {  // CARDS: the seven kinds of card in a job deck; ctl 1 marks a control card for the monitor, 0 a card for a program
          job: { nm: '$JOB', d: 'start of a job; names the account to charge', ctl: 1 },  // $JOB: starts a job and names the account to charge
          ftn: { nm: '$FTN', d: 'load the FORTRAN compiler', ctl: 1 },  // $FTN: tells the monitor to load the FORTRAN compiler
          src: { nm: 'FORTRAN source program', d: 'many cards of program text', ctl: 0 },  // the FORTRAN source program: the program text for the compiler
          load: { nm: '$LOAD', d: 'load the compiled program', ctl: 1 },  // $LOAD: tells the monitor to load the compiled program
          run: { nm: '$RUN', d: 'start the program', ctl: 1 },  // $RUN: tells the monitor to start the program
          data: { nm: 'Data for the program', d: 'many cards of input values', ctl: 0 },  // the data cards: input values the running program reads
          end: { nm: '$END', d: 'end of this job', ctl: 1 },  // $END: marks the end of the job
        };  // closes the CARDS table
        const RIGHT = ['job', 'ftn', 'src', 'load', 'run', 'data', 'end'];  // RIGHT: the correct order of the cards
        let deck = ['ftn', 'job', 'src', 'run', 'load', 'data', 'end'];  // deck: the order on screen; it starts wrong on purpose ($FTN before $JOB, $RUN before $LOAD)
        let frames = null;  // frames will hold the animation frames worked out for the current deck
        /* The monitor as a tiny interpreter: walk the deck in order and record one frame per card. */
        function interpret(order) {  // interpret(order): plays the monitor through the deck and returns one animation frame per event
          const F = [{ cur: -1, ex: 'mon', sub: 2, user: 'empty', cap: 'The operator has loaded your deck, behind other people\'s jobs, into the card reader. The <b>resident monitor</b> stays in memory all the time; the user area is empty. Press <b>Next</b> or <b>Play</b>.' }];  // frame 0: the deck is in the reader and the user area is empty (ex = who runs, sub = which monitor part is lit)
          let started = false, compiled = false, loaded = false, expect = null, user = 'empty';  // what the monitor knows so far: job started, compiled, loaded, which card it expects next, and what is in the user area
          const ok = (i, ex, sub, cap) => F.push({ cur: i, ex, sub, user, cap });  // ok() adds a normal frame: the card being read, who runs, which monitor part is lit, and the caption
          /* sub 3 = the control language interpreter spotted a bad card; sub 0 = a running program failed and control came back through interrupt processing */
          const fail = (i, why, sub = 3) => {  // fail() adds the frames for a failure and ends the run; by default the control language interpreter is lit
            F.push({ cur: i, bad: true, ex: 'mon', sub, user, cap: '<span style="color:var(--bad);font-weight:800">Problem:</span> ' + why });  // first failure frame: the card turns red and the caption says what went wrong
            F.push({ cur: i, bad: true, skipFrom: i + 1, ex: 'mon', sub: 2, user: 'empty', end: 'fail', cap: '<b>Job aborted.</b> The monitor prints an error, skips your remaining cards until the next job\'s $JOB card, and moves on. Nothing useful came out. Reorder the cards and try again.' });  // second failure frame: the job is aborted and the remaining cards are marked as skipped
            return F;  // hands back the frames so far, which stops the run here
          };  // ends fail()
          for (let i = 0; i < order.length; i++) {  // reads the deck card by card, in order
            const c = order[i], nm = '<b>' + CARDS[c].nm + '</b>';  // c is this card's kind; nm is its name in bold for the captions
            if (!started) {  // before $JOB has been seen
              if (c !== 'job') return fail(i, `the monitor expects every job to begin with <b>$JOB</b>, but the first card is ${nm}. It cannot tell whose job this is, so it rejects the deck.`);  // any other first card is rejected: the monitor cannot tell whose job it is
              started = true; ok(i, 'mon', 3, 'The monitor reads <b>$JOB</b>: a new job begins. It records which account to charge and clears the user area.');  // $JOB starts the job; the control language interpreter is lit
            } else if (expect === 'src') {  // right after $FTN the compiler expects program text
              if (c !== 'src') return fail(i, `the compiler expected program text right after $FTN but found ${nm}. It has nothing to translate, so it stops with an error and control returns to the monitor.`, 0);  // anything else stops the compiler with an error; control returns through interrupt processing
              compiled = true; expect = null;  // the program is now compiled
              ok(i, 'user', -1, 'Now the processor runs the <b>compiler</b>, not the monitor. The compiler reads your source cards and writes the translated machine code (object code) to tape, then hands control back to the monitor.');  // the compiler (a user-area program) runs, not the monitor, and writes object code to tape
            } else if (expect === 'data') {  // after $RUN the running program expects data cards
              if (c !== 'data') return fail(i, CARDS[c].ctl ? `your program asked for input but the next card is the control card ${nm}. The monitor never passes a control card to a program, so the program runs out of input and fails.` : 'your program asked for input but got program text instead of data, so it computes garbage.', 0);  // a control card or program text instead of data makes the running program fail
              expect = 'end';  // after the data, the monitor expects $END
              ok(i, 'mon', 1, 'Your program needs input, but it may not touch the card reader itself. It calls the monitor, whose <b>input routine</b> (a device driver) reads the next data card and hands it back. Then your program carries on computing.');  // the program asks the monitor's input routine (a device driver) to read a data card for it
            } else if (expect === 'end') {  // once the program has its data, the next card must be $END
              if (c !== 'end') return fail(i, `your program has finished and control is back with the monitor, but the next card is ${nm} instead of $END, so the rest of the deck makes no sense to it.`);  // any other card makes no sense to the monitor at this point
              user = 'done';  // the program has finished, so the user area now shows it as done
              ok(i, 'mon', 3, 'Your program finished and control returned to the monitor. The monitor reads <b>$END</b>: the job is over, so it wraps up the accounting.');  // the monitor reads $END and wraps up the accounting for the job
              F.push({ cur: order.length, ex: 'mon', sub: 3, user: 'empty', end: 'ok', cap: '<b>Success.</b> The monitor goes straight on to the next job\'s $JOB card with no human in between. Look back: control bounced <b>monitor → compiler → monitor → your program ⇄ monitor (for input) → monitor</b>.' });  // a final success frame: the monitor moves straight on to the next job and the caption recalls the whole path of control
              return F;  // hands back the finished list of frames
            } else if (c === 'ftn') {  // a $FTN card
              user = 'compiler'; expect = 'src';  // the compiler goes into the user area, and the next card must be program text
              ok(i, 'mon', 3, 'The monitor reads <b>$FTN</b>: it loads the FORTRAN compiler into the user area, then jumps to it.');  // the monitor reads $FTN, loads the compiler and jumps to it
            } else if (c === 'load') {  // a $LOAD card
              if (!compiled) return fail(i, 'the monitor read <b>$LOAD</b>, but nothing has been compiled yet, so there is no object code to load.');  // fails if nothing has been compiled yet
              user = 'prog'; loaded = true;  // the compiled program goes into the user area
              ok(i, 'mon', 3, 'The monitor reads <b>$LOAD</b>: its loader copies your compiled program from tape into the user area.');  // the monitor's loader copies the compiled program from tape into memory
            } else if (c === 'run') {  // a $RUN card
              if (!loaded) return fail(i, 'the monitor read <b>$RUN</b>, but no program has been loaded into memory, so there is nothing to run.');  // fails if no program has been loaded
              expect = 'data';  // the running program will want data cards next
              ok(i, 'user', -1, 'The monitor reads <b>$RUN</b> and jumps to the first instruction of your program. The processor is now executing <b>your code</b>.');  // the monitor jumps to the program, and the processor now runs the student's code
            } else if (c === 'job') return fail(i, 'a second <b>$JOB</b> card: the monitor thinks a brand-new job has started and abandons yours.');  // a second $JOB card: the monitor thinks a new job started and abandons this one
            else if (c === 'end') return fail(i, 'the monitor read <b>$END</b> before your program ever ran, so the job ends with no output.');  // an $END card before the program ran: the job ends with no output
            else return fail(i, `${nm} reached the monitor directly. The monitor only understands control cards that start with $, so it cannot make sense of it.`);  // a program or data card that reaches the monitor directly: it only understands $ control cards
          }  // ends the loop over the cards
          return F;  // hands back the frames (reached only if the deck ran out before $END)
        }  // ends interpret()
        /* ---- memory map ---- */
        const mem = s('svg', { viewBox: '0 0 270 400', width: '100%', style: 'max-width:300px;justify-self:center' });  // the memory map drawing, 270 by 400 units, at most 300 pixels wide and centered in its column
        const SUBS = ['Interrupt processing', 'Device drivers', 'Job sequencing', 'Control language interpreter'];  // SUBS: the four parts of the resident monitor, in the order drawn; a frame's sub number picks the one to light
        function drawMem(f) {  // drawMem(f) redraws the memory map for frame f
          const monOn = f.ex === 'mon', userOn = f.ex === 'user';  // monOn: the monitor is running; userOn: the program in the user area is running
          const uLabel = { empty: ['(empty)', ''], compiler: ['FORTRAN compiler', 'translates your source'], prog: ['Your program', 'compiled object code'], done: ['Your program', 'finished'] }[f.user];  // uLabel: the two lines of text shown in the user area for each thing it can hold
          const kids = [  // kids collects the shapes to draw
            s('text', { x: 8, y: 18, 'font-size': 14, 'font-weight': 700 }, 'Processor is running:'),  // the label "Processor is running:" at the top
            s('rect', { x: 162, y: 3, width: 102, height: 22, rx: 11, class: monOn ? 's-os' : 's-proc', 'stroke-width': 2 }),  // the badge's rounded box, purple for the monitor and teal otherwise
            s('text', { x: 213, y: 19, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 800, style: monOn ? 'fill:var(--os)' : 'fill:var(--proc)' }, monOn ? 'MONITOR' : (f.user === 'compiler' ? 'COMPILER' : 'YOUR CODE')),  // the badge's text: MONITOR, COMPILER or YOUR CODE
            s('rect', { x: 4, y: 36, width: 262, height: 176, rx: 10, class: 's-os', 'stroke-width': monOn ? 4 : 1.5, style: monOn ? 'stroke:var(--chc)' : '' }),  // the resident monitor's area, outlined thickly in the chapter color while the monitor runs
            s('text', { x: 16, y: 58, 'font-size': 15, 'font-weight': 800, style: 'fill:var(--os)' }, 'Resident monitor'),  // its title, "Resident monitor"
          ];  // closes the starting shapes
          SUBS.forEach((t, k) => {  // adds one bar per monitor part
            const on = f.sub === k;  // on is true for the part this frame lights up
            kids.push(s('rect', { x: 14, y: 68 + k * 35, width: 242, height: 29, rx: 6, class: on ? 's-accent' : 's-panel', 'stroke-width': on ? 2.5 : 1 }),  // the part's bar, highlighted in the accent color when lit
              s('text', { x: 24, y: 87 + k * 35, 'font-size': 13.5, 'font-weight': on ? 800 : 500 }, t));  // the part's name, bold when lit; closes the push
          });  // ends the loop over the parts
          kids.push(s('line', { x1: 0, y1: 222, x2: 270, y2: 222, class: 's-line', 'stroke-dasharray': '7 5' }),  // a dashed line marking the boundary between the monitor and the user area
            s('text', { x: 266, y: 236, 'text-anchor': 'end', 'font-size': 12.5, class: 's-sub' }, 'boundary'),  // the small gray word "boundary" beside that line
            s('rect', { x: 4, y: 244, width: 262, height: 152, rx: 10, class: f.user === 'empty' ? 's-panel' : 's-proc', 'stroke-width': userOn ? 4 : 1.5, style: userOn ? 'stroke:var(--chc)' : '' }),  // the user program area: plain when empty, teal when it holds something, thickly outlined while it runs
            s('text', { x: 16, y: 266, 'font-size': 15, 'font-weight': 800, style: 'fill:var(--proc)' }, 'User program area'),  // its title, "User program area"
            s('text', { x: 135, y: 322, 'text-anchor': 'middle', 'font-size': 18, 'font-weight': 800, class: f.user === 'empty' ? 's-sub' : '' }, uLabel[0]),  // the main line of what the user area holds, gray when empty
            s('text', { x: 135, y: 344, 'text-anchor': 'middle', 'font-size': 13.5, class: 's-sub' }, uLabel[1]));  // the second, smaller line (for example "translates your source"); closes the push
          mem.replaceChildren(...kids);  // replaces the old memory map with the new shapes
        }  // ends drawMem()
        /* ---- deck ---- */
        const deckEl = h('div', { class: 'deck' });  // the column that holds the card rows of the deck
        const status = h('span', { class: 'chip' });  // the status chip above the deck
        let curFrame = null;  // curFrame is the animation frame on screen now
        function paintDeck() {  // paintDeck() redraws the card rows and the status chip for the current frame
          const f = curFrame || {};  // f is the current frame, or an empty object before the first one
          deckEl.replaceChildren(...deck.map((c, i) => {  // rebuilds one row per card in the current deck order
            const cd = CARDS[c];  // cd is this card's kind
            let cls = 'deck-row';  // cls starts as the plain row style
            if (f.cur === i) cls += f.bad ? ' bad' : ' cur';  // the card being read now is outlined, or turned red if it caused the failure
            else if (f.cur > i) cls += ' done';  // cards before it have already been read
            if (f.skipFrom != null && i >= f.skipFrom) cls += ' skip';  // cards after a failure are faded as skipped
            const mv = (d) => () => { const j = i + d; [deck[i], deck[j]] = [deck[j], deck[i]]; rebuild(); };  // mv(d) makes a click handler that swaps this card with its neighbor above (-1) or below (+1), then rebuilds the run
            return h('div', { class: cls },  // builds the row
              h('span', { class: 'ix' }, f.cur > i && !(f.bad && f.cur === i) ? '✓' : String(i + 1)),  // the position number, or a check mark once the card has been read
              h('div', {}, h('span', { class: 'nm ' + (cd.ctl ? 'ctl' : 'usr') }, cd.nm), h('span', { class: 'xs muted' }, '  ' + cd.d)),  // the card's name, purple for control cards and teal for program cards, then its meaning in small gray text
              h('div', { class: 'mv' }, h('button', { type: 'button', title: 'Move up', 'aria-label': 'Move ' + cd.nm + ' up', disabled: i === 0, onclick: mv(-1) }, '▲'), h('button', { type: 'button', title: 'Move down', 'aria-label': 'Move ' + cd.nm + ' down', disabled: i === deck.length - 1, onclick: mv(1) }, '▼')));  // the move up and move down buttons, turned off at the top and bottom of the deck; closes the row
          }));  // closes the map over the deck and the redraw
          status.className = 'chip ' + (f.end === 'ok' ? 'ok' : f.end === 'fail' ? 'bad' : f.bad ? 'bad' : f.cur >= 0 ? 'os' : 'warn');  // the status chip turns green on success, red on failure or error, purple while reading, amber before starting
          status.textContent = f.end === 'ok' ? 'job ran correctly' : f.end === 'fail' ? 'job aborted' : f.bad ? 'error!' : f.cur >= 0 ? 'monitor reading…' : 'deck ready: press Play';  // the status chip's words for each of those states
        }  // ends paintDeck()
        frames = interpret(deck);  // works out the frames for the starting deck
        const player = ctx.ui.player({ count: frames.length, interval: 2300, render: (i) => { curFrame = frames[i] || frames[frames.length - 1]; drawMem(curFrame); paintDeck(); return curFrame.cap; } });  // the animation controls; each frame redraws the memory map and the deck and returns its caption
        function rebuild() { frames = interpret(deck); player.setCount(frames.length); }  // rebuild() re-plays the monitor over the new deck and restarts the animation from its first frame
        const text = h('div', { class: 'stack', style: { gap: '8px', fontSize: '15px', lineHeight: '1.45' } },  // the text column on the left
          h('p', { class: 'm0', html: '<b>Mid-1950s:</b> General Motors builds the first batch monitor for its IBM 701; its successor, GM-NAA I/O (1956), runs on the IBM 704. Users no longer touch the machine: an operator groups <span class="t">job</span> decks into a <span class="t" data-t="batch system">batch</span>, and a <span class="t" data-t="resident monitor">monitor</span> program runs them in turn.' }),  // history paragraph: the first batch monitors of the mid-1950s, and how operators batched jobs
          h('p', { class: 'm0', html: 'Each job carries <span class="t" data-t="job control language">job control language</span> (JCL) cards. They start with <code>$</code> and tell the monitor what to do.' }),  // paragraph: job control language cards start with $ and tell the monitor what to do
          h('div', { class: 'callout tip m0 small', 'data-label': 'Your task', html: 'Put the seven cards in order with ▲ ▼, then press Play. A wrong order shows what breaks.' }),  // "Your task" box: order the seven cards, then press Play
          h('div', { class: 'callout why m0 small', 'data-label': 'Watch the badge', html: 'The processor <b>alternates</b> between the monitor and a program: the FORTRAN <i>compiler</i> (it translates source text into machine code) or your own program.' }));  // "Watch the badge" box: the processor alternates between the monitor and a program; closes the text column
        const deckCol = h('div', { class: 'stack', style: { gap: '7px' } },  // the deck column on the right
          h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'Your job deck · top card first'), status),  // a row with the heading "Your job deck · top card first" and the status chip
          deckEl,  // the card rows
          h('div', { class: 'row' },  // a row of two buttons
            h('button', { class: 'btn sm', onclick: () => { deck = ctx.util.shuffle(deck); rebuild(); } }, 'Shuffle'),  // "Shuffle" puts the cards in a random order and rebuilds the run
            h('button', { class: 'btn sm', onclick: () => { deck = RIGHT.slice(); rebuild(); } }, 'Show the correct order')));  // "Show the correct order" puts the cards in the right order and rebuilds; closes the deck column
        el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },  // puts the step on screen: a column that fills the step area
          h('div', { class: 'split grow', style: { gridTemplateColumns: 'minmax(0, 1fr) 262px minmax(0, 1.45fr)', gap: '18px', height: 'auto' } }, text, mem, deckCol),  // three columns side by side: the text, the memory map (262 pixels wide) and the deck
          player.el));  // the animation controls and caption underneath; closes the layout
        rebuild();  // works out the frames and shows the first one
      },  // ends render() for step 3
    },  // ends step 3

    /* ---------------- 4. Hardware a monitor needs + user/kernel mode: switch features off and see the batch fail ---------------- */
    {  // step 4 begins: the hardware a batch monitor needs, with switches that turn each feature off
      title: 'The hardware a batch monitor needs',  // the title shown at the top of step 4
      kind: 'explore',  // kind "explore" labels this step as an Explore step
      render(el, ctx) {  // render(el, ctx) builds step 4 when the student arrives on it
        const { h, s } = ctx;  // pulls out the h (HTML) and s (SVG) element builders
        const FEAT = [  // FEAT: the four hardware features as [key, name, what it does]
          ['prot', 'Memory protection', 'A job cannot change the monitor\'s memory; any attempt traps to the monitor.'],  // memory protection: a job cannot change the monitor's memory
          ['timer', 'Timer', 'Set before each job. When it runs out, the monitor takes over.'],  // timer: set before each job so the monitor takes over when it runs out
          ['priv', 'Privileged instructions', 'I/O and other sensitive instructions work only for the monitor.'],  // privileged instructions: I/O and other sensitive instructions work only for the monitor
          ['intr', 'Interrupts', 'Devices and the timer can signal the processor, giving control back to the monitor.'],  // interrupts: devices and the timer can hand control back to the monitor
        ];  // closes the FEAT list
        const on = { prot: true, timer: true, priv: true, intr: true };  // on records which features are switched on; all four start on
        const featEls = {};  // featEls keeps each feature's card and switch button so paint() can restyle them
        const grid = h('div', { class: 'grid-2', style: { gap: '8px' } });  // the 2-column grid that holds the four feature cards
        FEAT.forEach(([k, name, d]) => {  // builds one card per feature
          const btn = h('button', { class: 'btn sm sw', type: 'button', 'aria-label': 'Toggle ' + name, onclick: () => { on[k] = !on[k]; paint(); } });  // the ON/OFF switch button; clicking flips that feature and redraws everything
          const card = h('div', { class: 'feat' }, h('span', { class: 'fn', html: k === 'intr' ? name : `<span class="t">${name}</span>` }), btn, h('span', { class: 'fd' }, d));  // the card: the feature's name (as a dotted glossary word, except interrupts), the switch, then the description
          featEls[k] = { card, btn };  // remembers the card and its switch under the feature's key
          grid.append(card);  // adds the card to the grid
        });  // ends the loop over the features
        const list = h('div', { class: 'stack', style: { gap: '5px' } });  // the list of job outcomes, J1 to J6
        const sum = h('div', { class: 'small b' });  // the summary line under the outcomes
        function outcomes() {  // outcomes() works out what happens to each of the six jobs with the current switches
          const R = [];  // R collects one result per job
          let halted = null;  // halted holds the reason the batch stopped, once something stops it
          const add = (job, what, st, txt) => R.push({ job, what, st: halted ? 'skip' : st, txt: halted ? 'Never ran: ' + halted : txt });  // add() records one job's result; after the batch has halted, every later job is marked as never having run
          add('J1', 'Normal job', 'ok', '✓ Runs and finishes.');  // J1, a normal job, always runs and finishes
          add('J2', 'Long tape read', on.intr ? 'ok' : 'warn', on.intr ? '✓ The tape signals "done" with an interrupt; no need to watch it.' : '⚠ Finishes, but the processor must poll (keep checking) the tape.');  // J2 reads a long tape: with interrupts the tape signals when done; without them the processor must keep checking
          add('J3', 'Bug: writes into the monitor', on.prot ? 'ok' : 'bad', on.prot ? '✓ Caught: the hardware traps and the monitor aborts J3.' : '✗ Monitor overwritten: the whole batch crashes.');  // J3 has a bug that writes into the monitor: protection traps it; without protection the whole batch crashes
          if (!on.prot) halted = 'the batch crashed at J3.';  // without memory protection the batch stops at J3
          const stop = on.timer && on.intr;  // an endless loop is stopped only if the timer exists and can interrupt
          add('J4', 'Bug: endless loop', stop ? 'ok' : 'bad', stop ? '✓ The timer runs out and interrupts J4; the monitor aborts it.' : !on.timer ? '✗ Loops forever; nothing takes the processor back.' : '✗ The timer expires but cannot interrupt: J4 keeps going.');  // J4 loops forever: stopped by the timer interrupt, or stuck because the timer is missing or cannot interrupt
          if (!stop && !halted) halted = 'the batch is stuck in J4\'s loop.';  // if J4 could not be stopped, the batch is stuck there (unless it already crashed at J3)
          add('J5', 'Reads cards itself', on.priv ? 'ok' : 'bad', on.priv ? '✓ Must ask the monitor, which never hands over J6\'s cards.' : '✗ Reads past its own data and swallows J6\'s $JOB card.');  // J5 tries to read cards itself: privileged I/O forces it through the monitor; without that it swallows J6's $JOB card
          add('J6', 'Normal job', on.priv ? 'ok' : 'bad', on.priv ? '✓ Runs and finishes.' : '✗ Lost: J5 ate its $JOB card.');  // J6, a normal job, finishes only if J5 could not eat its $JOB card
          return { R, halted };  // hands back the results and the reason the batch halted, if any
        }  // ends outcomes()
        function paint() {  // paint() redraws the switches, the outcome list and the summary after every click
          FEAT.forEach(([k]) => { const f = featEls[k]; f.card.className = 'feat ' + (on[k] ? 'on' : 'off'); f.btn.className = 'btn sm sw ' + (on[k] ? 'on' : 'off'); f.btn.textContent = on[k] ? 'ON' : 'OFF'; f.btn.setAttribute('aria-pressed', on[k]); });  // restyles each feature card and switch as on (green, "ON") or off (red, "OFF"), and tells screen readers its state
          const { R, halted } = outcomes();  // gets the current outcomes
          list.replaceChildren(...R.map((r) => h('div', { class: 'res ' + (r.st === 'skip' ? '' : r.st), style: r.st === 'skip' ? { opacity: '.5' } : {} },  // rebuilds the outcome list; jobs that never ran are faded to half strength
            h('span', { class: 'jb ' + (r.what === 'Normal job' ? 'chip proc' : 'chip warn'), style: { display: 'block' } }, r.job),  // the job label as a chip: teal for normal jobs, amber for the troublesome ones
            h('div', {}, h('b', {}, r.what), h('span', { class: 'muted' }, ' · '), h('span', {}, r.txt)))));  // the job's description in bold, a dot, then what happened to it; closes the row and the list
          const allOn = FEAT.every(([k]) => on[k]);  // allOn is true when every feature is switched on
          sum.innerHTML = allOn ? '<span style="color:var(--ok)">All four features on: every good job finishes and every bad job is stopped without harming anyone else.</span>'  // all on: a green line saying every good job finishes and every bad job is stopped
            : halted ? `<span style="color:var(--bad)">Batch halted: ${halted} Switch the features back on.</span>` : '<span style="color:var(--warn)">The batch finished, but not cleanly. Switch the features back on.</span>';  // otherwise: red if the batch halted (with the reason), amber if it finished but not cleanly
        }  // ends paint()
        const modes = s('svg', { viewBox: '0 0 460 176', width: '100%' },  // the two-mode diagram, 460 by 176 units: user mode on top, kernel mode below
          s('rect', { x: 6, y: 6, width: 448, height: 58, rx: 10, class: 's-proc', 'stroke-width': 2 }),  // the user-mode box, in the process color
          s('text', { x: 20, y: 30, 'font-size': 16, 'font-weight': 800, style: 'fill:var(--proc)' }, 'User mode'),  // its title, "User mode"
          s('text', { x: 20, y: 51, 'font-size': 13.5 }, 'jobs run here; some memory and instructions are off-limits'),  // what user mode means: jobs run here with some memory and instructions off-limits
          s('rect', { x: 6, y: 112, width: 448, height: 58, rx: 10, class: 's-os', 'stroke-width': 2 }),  // the kernel-mode box, in the OS color
          s('text', { x: 20, y: 136, 'font-size': 16, 'font-weight': 800, style: 'fill:var(--os)' }, 'Kernel mode'),  // its title, "Kernel mode"
          s('text', { x: 20, y: 157, 'font-size': 13.5 }, 'the monitor runs here with full access to everything'),  // what kernel mode means: the monitor runs here with full access
          s('line', { x1: 110, y1: 66, x2: 110, y2: 108, style: 'stroke:var(--intr)', 'stroke-width': 2.5, 'marker-end': 'url(#arr-intr)' }),  // a red arrow down from user mode to kernel mode
          s('text', { x: 120, y: 93, 'font-size': 13, style: 'fill:var(--intr)', 'font-weight': 700 }, 'trap or interrupt'),  // its label: "trap or interrupt"
          s('line', { x1: 280, y1: 110, x2: 280, y2: 68, style: 'stroke:var(--os)', 'stroke-width': 2.5, 'marker-end': 'url(#arr-os)' }),  // a purple arrow up from kernel mode to user mode
          s('text', { x: 290, y: 93, 'font-size': 13, style: 'fill:var(--os)', 'font-weight': 700 }, 'monitor resumes a job'));  // its label: "monitor resumes a job"; closes the diagram
        const left = h('div', { class: 'stack', style: { gap: '9px' } },  // left column of the step
          h('p', { class: 'm0', style: { fontSize: '16px', lineHeight: '1.45' }, html: 'A monitor only works if a buggy or greedy job cannot wreck it or hog the machine, so batch systems leaned on the <b>hardware</b>. The processor runs in one of two modes:' }),  // intro paragraph: a monitor needs hardware help, and the processor runs in one of two modes
          modes,  // the two-mode diagram
          h('p', { class: 'small m0', style: { lineHeight: '1.42' }, html: 'In <span class="t">user mode</span> some memory is off-limits and <span class="t">privileged instructions</span> are refused. In <span class="t">kernel mode</span> the monitor may do anything. A trap or <span class="t">interrupt</span> switches the processor into kernel mode; the monitor switches back when it resumes a job.' }),  // paragraph: what user and kernel mode allow, and what switches between them
          h('div', { class: 'callout warn m0 small', 'data-label': 'The price', html: 'The monitor takes up memory that jobs could have used, and it uses processor time every time it runs. Still a bargain: the machine stays far busier than under serial processing.' }),  // "The price" box: the monitor costs memory and processor time, but it is still a bargain
          h('p', { class: 'small muted m0', html: 'Early machines had no interrupts at all. Adding them let the OS give up the processor and win it back far more flexibly, and the next idea, multiprogramming, depends on exactly that.' }));  // note: early machines had no interrupts, and multiprogramming depends on them; closes the left column
        const right = h('div', { class: 'stack', style: { gap: '8px' } },  // right column of the step
          h('h3', { class: 'm0' }, 'Switch a feature off, then read what happens to the batch'),  // heading: switch a feature off, then read what happens to the batch
          grid, list, sum);  // the feature grid, the outcome list and the summary; closes the right column
        el.append(h('div', { class: 'split l fill' }, left, right));  // puts both columns on screen, side by side, filling the step area
        paint();  // draws the starting state, with every feature on
      },  // ends render() for step 4
    },  // ends step 4

    /* ---------------- 5. Multiprogramming: utilization calculator with a live processor timeline ---------------- */
    {  // step 5 begins: processor utilization, with a live timeline of 1, 2 or 3 programs
      title: 'Why the processor still sits idle, and the fix',  // the title shown at the top of step 5
      kind: 'explore',  // kind "explore" labels this step as an Explore step
      core: true, // on the shorter core path
      render(el, ctx) {  // render(el, ctx) builds step 5 when the student arrives on it
        const { h, s } = ctx;  // pulls out the h (HTML) and s (SVG) element builders
        const P = { r: 15, c: 1, w: 15, n: 1 };  // P holds the settings: read time r, compute time c and write time w in microseconds, and n programs in memory
        const NAMES = ['A', 'B', 'C'];  // NAMES: the letters for up to three programs
        const NW = ctx.narrow, X0 = NW ? 92 : 104, TW = NW ? 280 : 530, VW = NW ? 380 : 650;  // layout numbers: NW is true on a phone-width screen (smaller drawing), then the timeline's left edge, width and total width
        const svg = s('svg', { viewBox: `0 0 ${VW} 190`, width: '100%', style: 'flex:none' });  // the timeline drawing, 190 units tall, kept at its natural height
        const big = h('div', { class: 'big', style: { color: 'var(--chc)' } });  // the big utilization percentage, in the chapter color
        const busyTxt = h('div', { class: 'small muted' });  // the line under the big number (for example "busy 1 of every 31 µs")
        const compare = h('div', { class: 'bars', style: { gap: '5px' } });  // the bars comparing 1, 2 and 3 programs
        const formula = h('div', { class: 'mono', style: { fontSize: '15px', lineHeight: '1.5' } });  // the formula line under the sliders, in a fixed-width font
        const say = h('div', { class: 'callout m0 small', style: { lineHeight: '1.42' } });  // the explanation box under the stat
        const util = (n) => Math.min(1, (n * P.c) / (P.r + P.c + P.w));  // util(n): utilization with n programs = n × compute / (read + compute + write), never more than 1 (100%)
        const pct = (u) => (u >= 1 ? '100' : ctx.util.fmt(u * 100, 1)) + '%';  // pct(u) writes a utilization as a percentage with one decimal, or exactly 100%
        /* discrete-event simulation: one processor (first come, first served), each program has its own I/O device */
        function simulate(win) {  // simulate(win) plays the programs forward for win microseconds and returns what each did and when
          const T = P.r + P.c + P.w;  // T is the length of one program cycle
          const progs = NAMES.slice(0, P.n).map((nm, i) => ({ nm, i, ready: 0, segs: [] }));  // one record per program in memory: its name, number, when it is next ready, and its list of segments
          const cpu = [];  // cpu lists the processor's busy periods as [program, start, end]
          let free = 0;  // free is when the processor next becomes free
          for (let guard = 0; guard < 400; guard++) {  // repeats until the window is filled (the guard stops a runaway loop)
            const p = progs.slice().sort((a, b) => a.ready - b.ready || a.i - b.i)[0];  // picks the program that has been ready the longest (ties go to the lower number), first come first served
            const start = Math.max(free, p.ready);  // it starts when both it is ready and the processor is free
            if (start >= win) { progs.forEach((q) => { if (q.ready < win) q.segs.push(['wait', q.ready, win]); }); break; }  // past the end of the window: pad any program still waiting with a wait segment and stop
            if (start > p.ready) p.segs.push(['wait', p.ready, start]);  // if it had to wait for the processor, records a "ready, waiting its turn" segment
            p.segs.push(['run', start, start + P.c]); cpu.push([p.i, start, start + P.c]);  // records its computing on its own row and on the processor's row
            p.segs.push(['io', start + P.c, start + P.c + P.w + P.r]);  // then it writes its result and reads the next record on its own device
            p.ready = start + T; free = start + P.c;  // it will be ready again one full cycle after it started; the processor is free once its computing ends
          }  // ends the simulation loop
          return { progs, cpu };  // hands back every program's segments and the processor's busy periods
        }  // ends simulate()
        function draw() {  // draw() redraws the timeline, the numbers, the formula, the bars and the explanation
          const T = P.r + P.c + P.w, win = 3 * T;  // T is one cycle; the drawing shows three cycles
          const x = (t) => X0 + (Math.min(t, win) / win) * TW;  // x(t) turns a time into a horizontal position on the timeline
          const { progs, cpu } = simulate(win);  // runs the simulation for the three-cycle window
          const kids = [];  // kids collects the shapes to draw
          const step = NW ? (win > 120 ? 50 : win > 60 ? 40 : win > 30 ? 20 : 5) : (win > 60 ? 20 : win > 30 ? 10 : 5);  // picks the spacing of the time labels so they never crowd together (wider spacing on a phone-width screen)
          for (let t = 0; t <= win + 0.001; t += step) kids.push(s('line', { x1: x(t), y1: 18, x2: x(t), y2: 186, style: 'stroke:var(--line)', 'stroke-dasharray': '2 4' }), s('text', { x: x(t), y: 13, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, t + ' µs'));  // a dotted guide line and a "µs" label at each tick along the top
          const rowY = [26, 78, 116, 154];  // rowY: the vertical position of the processor row and the three program rows
          kids.push(s('text', { x: X0 - 10, y: rowY[0] + 23, 'text-anchor': 'end', 'font-size': 15, 'font-weight': 800, style: 'fill:var(--cpu)' }, 'Processor'),  // the label "Processor" at the left of the top row, in blue
            s('rect', { x: X0, y: rowY[0], width: TW, height: 36, rx: 5, class: 's-muted', 'stroke-dasharray': '4 4', style: 'fill:var(--panel-3)' }),  // the processor row's empty track: gray with a dashed outline, which reads as idle time
            s('text', { x: X0 + TW - 6, y: rowY[0] + 23, 'text-anchor': 'end', 'font-size': 12.5, class: 's-sub' }, util(P.n) >= 1 ? '' : 'idle'));  // the word "idle" at the right end of the track, unless the processor is always busy
          cpu.forEach(([i, a, b]) => {  // draws each busy period of the processor
            if (a >= win) return;  // skips anything that starts after the window ends
            kids.push(s('rect', { x: x(a), y: rowY[0], width: Math.max(1.5, x(b) - x(a)), height: 36, class: 'f-run', 'stroke-width': 1 }));  // a teal block for the time the processor computes for a program
            if (x(b) - x(a) > 14) kids.push(s('text', { x: (x(a) + x(b)) / 2, y: rowY[0] + 23, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800 }, NAMES[i]));  // the program's letter inside the block, if the block is wide enough to hold it
          });  // ends the loop over the busy periods
          NAMES.forEach((nm, i) => {  // draws one row for each of the three possible programs
            const y = rowY[i + 1], p = progs[i];  // y is this row's position; p is the program's record, missing if it is not in memory
            kids.push(s('text', { x: X0 - 10, y: y + 19, 'text-anchor': 'end', 'font-size': 14, 'font-weight': 700, class: p ? '' : 's-sub' }, 'Program ' + nm));  // the row label "Program A/B/C", gray if that program is not in memory
            if (!p) { kids.push(s('text', { x: X0 + 6, y: y + 19, 'font-size': 13, class: 's-sub' }, '(not in memory)')); return; }  // a program not in memory gets the note "(not in memory)" and nothing else
            p.segs.forEach(([k, a, b]) => {  // draws each of the program's segments
              if (a >= win) return;  // skips anything that starts after the window ends
              kids.push(s('rect', { x: x(a), y, width: Math.max(1.5, x(b) - x(a)), height: 28, rx: 3, class: k === 'run' ? 'f-run' : k === 'io' ? 's-io' : 's-warn', 'stroke-width': 1, 'stroke-dasharray': k === 'wait' ? '3 3' : null }));  // teal for computing, orange for I/O, dashed amber for ready but waiting its turn
              if (k === 'io' && x(b) - x(a) > 100) kids.push(s('text', { x: (x(a) + x(b)) / 2, y: y + 19, 'text-anchor': 'middle', 'font-size': 12.5, style: 'fill:var(--io)' }, 'waiting for I/O'));  // writes "waiting for I/O" inside an I/O block when it is wide enough
            });  // ends the loop over the segments
          });  // ends the loop over the program rows
          svg.replaceChildren(...kids);  // replaces the old timeline with the new shapes
          const u = util(P.n);  // u is the utilization for the chosen number of programs
          big.textContent = pct(u);  // shows it as the big percentage
          busyTxt.innerHTML = u >= 1 ? 'busy all the time: some program is always ready' : `busy ${P.n * P.c} of every ${T} µs`;  // the line under it: "busy all the time" when saturated, otherwise busy microseconds out of each cycle
          const num = `<b>${P.n > 1 ? P.n + ' × ' : ''}${P.c}</b> / (${P.r} + ${P.c} + ${P.w})`;  // num: the top and bottom of the formula with the current numbers filled in
          formula.innerHTML = P.n * P.c > T ? `U = ${num} &gt; 1 → <b style="color:var(--chc)">100%</b>` : `U = ${num} = <b style="color:var(--chc)">${pct(u)}</b>`;  // the formula line; when the demand passes one full cycle it shows "> 1 → 100%"
          compare.replaceChildren(...[1, 2, 3].map((n) => h('div', { class: 'bar-row', style: { fontWeight: n === P.n ? 800 : 500 } },  // rebuilds the three comparison bars for 1, 2 and 3 programs, bolding the chosen one
            h('span', {}, n === 1 ? '1 program' : n + ' programs'), h('div', { class: 'bar' }, h('i', { style: { width: util(n) * 100 + '%', background: n === P.n ? 'var(--chc)' : 'var(--line-2)' } })), h('span', { class: 'v' }, pct(util(n))))));  // each bar row: its label, a bar (chapter-colored for the chosen count) and the percentage; closes the rows
          say.className = 'callout m0 small ' + (u >= 1 ? 'tip' : P.n === 1 ? 'bad' : 'why');  // the explanation box turns green when saturated, red for one program and blue otherwise
          say.setAttribute('data-label', u >= 1 ? 'Saturated' : P.n === 1 ? 'Uniprogramming' : 'Multiprogramming');  // its label: Saturated, Uniprogramming or Multiprogramming
          say.innerHTML = P.n === 1 && u < 1 ? `With one program the processor must wait for every I/O operation to finish before the program can continue. It sits idle ${pct(1 - u)} of the time.`  // one program: the processor waits for every I/O operation and sits idle most of the time
            : u < 1 ? `While A waits for its device, the processor runs ${P.n === 2 ? 'B' : 'B, then C'}: one at a time, never at the same instant. Utilization rises ${P.n}×, yet the processor is still idle ${pct(1 - u)} of the time. Try a longer compute time.`  // two or three programs: they take turns on the processor while others wait for I/O, yet some idle time remains
              : 'There is always a program ready, so the processor never idles. Now programs queue for the processor (dashed), and adding more programs cannot raise utilization past 100%.';  // saturated: some program is always ready, so programs now queue and utilization cannot pass 100%
        }  // ends draw()
        const sl = (key, label) => ctx.ui.slider({ label, min: 1, max: 30, value: P[key], format: (v) => v + ' µs', onInput: (v) => { P[key] = v; draw(); } });  // sl() makes one slider from 1 to 30 µs for a timing setting; moving it stores the value and redraws
        const sR = sl('r', 'Read a record'), sC = sl('c', 'Compute (100 instr.)'), sW = sl('w', 'Write a record');  // the three sliders: read a record, compute (100 instructions) and write a record
        const seg = ctx.ui.seg([{ value: 1, label: '1 program' }, { value: 2, label: '2 programs' }, { value: 3, label: '3 programs' }], 1, (v) => { P.n = v; draw(); });  // three buttons for 1, 2 or 3 programs in memory; choosing one redraws
        const reset = h('button', { class: 'btn sm', onclick: () => { P.r = 15; P.c = 1; P.w = 15; sR.set(15); sC.set(1); sW.set(15); draw(); } }, 'Reset to 15 / 1 / 15');  // the Reset button puts the timings back to 15 / 1 / 15, moves the sliders to match and redraws
        const left = h('div', { class: 'stack', style: { gap: '9px' } },  // left column of the step
          h('p', { class: 'm0', style: { fontSize: '16px', lineHeight: '1.45' }, html: 'A batch <span class="t" data-t="Resident monitor">monitor</span> runs jobs back to back with no gaps, yet <span class="t">processor utilization</span> stays poor: I/O is slow next to the processor, so it keeps waiting. Take a program that processes a file one <b>record</b> (one entry, such as one customer) at a time:' }),  // intro paragraph: batch jobs run back to back, yet the processor keeps waiting for slow I/O
          h('div', { class: 'card tight stack', style: { gap: '6px' } }, sR, sC, sW, formula),  // a card holding the three sliders and the formula
          h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'small b' }, 'Programs in memory'), reset),  // a row with the label "Programs in memory" and the Reset button
          seg,  // the 1/2/3 programs buttons
          h('p', { class: 'small m0', html: 'One program at a time is <span class="t">uniprogramming</span>. Switch to 2 or 3 programs (each with its own I/O device) and watch the processor\'s idle gaps shrink.' }),  // paragraph: one program at a time is uniprogramming; try 2 or 3
          h('div', { class: 'callout why m0 small', 'data-label': 'The fix', html: '<span class="t">Multiprogramming</span>: keep several programs in memory, and when one must wait for I/O, switch the processor to another. The OS now needs memory management and scheduling; the hardware must supply I/O <span class="t">interrupts</span> and <span class="t" data-t="DMA">DMA</span> (direct memory access), so devices move data by themselves and signal when they are done.' }));  // "The fix" box: multiprogramming, and the interrupts and DMA hardware it needs; closes the left column
        const right = h('div', { class: 'stack', style: { gap: '8px' } },  // right column of the step
          h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { class: 'm0' }, 'What the processor does, microsecond by microsecond'), h('span', { class: 'chip ' + 'cpu' }, 'first 3 cycles')),  // a row with the heading and a blue chip reminding that the drawing shows the first 3 cycles
          svg,  // the timeline drawing
          h('div', { class: 'row small', style: { gap: '16px', marginTop: '-4px' }, html: '<span><span class="legend-sw" style="background:color-mix(in srgb, var(--proc) 45%, var(--panel));border-color:var(--proc)"></span>running on the processor</span><span><span class="legend-sw" style="background:var(--io-bg);border-color:var(--io)"></span>waiting for its I/O device</span><span><span class="legend-sw" style="background:var(--warn-bg);border-color:var(--warn);border-style:dashed"></span>ready, waiting its turn</span>' }),  // the legend: teal = running, orange = waiting for its device, dashed amber = ready and waiting its turn
          h('div', { class: 'split', style: { height: 'auto', gridTemplateColumns: '196px minmax(0, 1fr)', gap: '16px', alignItems: 'center' } },  // a two-column row: the utilization stat on the left, the comparison bars on the right
            h('div', { class: 'kpi' }, h('span', { class: 'xs muted b' }, 'PROCESSOR UTILIZATION'), big, busyTxt),  // the stat block: a small label, the big percentage and the busy line
            compare),  // the comparison bars; closes the row
          say,  // the explanation box
          h('div', { class: 'row' }, h('span', { class: 'small b' }, 'Try:'),  // a row of preset buttons, starting with the label "Try:"
            ...[[15, 10, 15, 'compute 10 µs'], [5, 20, 5, 'fast I/O (5 / 20 / 5)'], [15, 1, 15, 'the slow-I/O example']].map(([r, c, w, lbl]) => h('button', { class: 'btn sm', onclick: () => { P.r = r; P.c = c; P.w = w; sR.set(r); sC.set(c); sW.set(w); draw(); } }, lbl))));  // three presets (compute 10 µs, fast I/O, the slow-I/O example); each sets the timings, moves the sliders and redraws
        el.append(h('div', { class: 'split l fill' }, left, right));  // puts both columns on screen, side by side, filling the step area
        draw();  // draws the starting state
      },  // ends render() for step 5
    },  // ends step 5

    /* ---------------- 6. JOB1/JOB2/JOB3: toggle uniprogramming vs multiprogramming and watch every metric ---------------- */
    {  // step 6 begins: three jobs run one at a time or all together, with every measure compared
      title: 'Three jobs, two ways: one at a time or all at once',  // the title shown at the top of step 6
      kind: 'compare',  // kind "compare" labels this step as a Compare step
      render(el, ctx) {  // render(el, ctx) builds step 6 when the student arrives on it
        const { h, s } = ctx;  // pulls out the h (HTML) and s (SVG) element builders
        const MEM = 250;  // MEM: the machine has 250 MB of memory for user programs
        const JOBS = [  // JOBS: the three jobs with their kind, run time in minutes, memory in MB, devices and color
          { nm: 'JOB1', kind: 'heavy compute', dur: 5, mem: 50, dev: ['Processor'], cls: 'cpu' },  // JOB1: heavy computing, 5 minutes, 50 MB, uses mostly the processor
          { nm: 'JOB2', kind: 'heavy I/O', dur: 15, mem: 100, dev: ['Terminal'], cls: 'io' },  // JOB2: heavy I/O on the terminal, 15 minutes, 100 MB
          { nm: 'JOB3', kind: 'heavy I/O', dur: 10, mem: 75, dev: ['Disk', 'Printer'], cls: 'io' },  // JOB3: heavy I/O on the disk and printer, 10 minutes, 75 MB
        ];  // closes the JOBS list
        const sched = (mode) => { let t = 0; return JOBS.map((j) => { const st = mode === 'multi' ? 0 : t; t = st + j.dur; return [st, st + j.dur]; }); };  // sched(mode) gives each job's [start, end]: all start at 0 when multiprogrammed, one after another otherwise
        function metrics(mode) {  // metrics(mode) works out every measure for one mode
          const sc = sched(mode), elapsed = Math.max(...sc.map((x) => x[1]));  // sc is the schedule; elapsed is when the last job finishes
          const memMin = JOBS.reduce((a, j) => a + j.mem * j.dur, 0);  // memMin adds up memory × minutes over all jobs, for the average memory use
          return {  // hands back the measures
            elapsed, cpu: 6 / elapsed, mem: memMin / (MEM * elapsed), disk: 10 / elapsed, printer: 10 / elapsed,  // elapsed time, then average use of the processor (6 busy minutes), memory, disk and printer (10 minutes each)
            thr: (3 / elapsed) * 60, resp: sc.reduce((a, x) => a + x[1], 0) / 3, sc,  // throughput in jobs per hour, mean response time (the average finish time), and the schedule
          };  // closes the measures
        }  // ends metrics()
        const M = { uni: metrics('uni'), multi: metrics('multi') };  // M holds the measures for both modes, worked out once
        let mode = 'uni', tNow = 3;  // mode is the chosen mode; tNow is the time the cursor on the chart points at
        /* ---- left: job table + Gantt chart + time cursor ---- */
        const spec = h('table', { class: 'tbl compact' },  // the table describing the three jobs
          h('tr', {}, h('th', {}, 'The three jobs'), ...JOBS.map((j) => h('th', {}, j.nm))),  // header row: one column per job
          ...[['Kind of work', (j) => j.kind], ['Run time alone', (j) => j.dur + ' min'], ['Memory needed', (j) => j.mem + ' MB'], ['Devices used', (j) => j.dev.filter((d) => d !== 'Processor').join(' + ') || 'mostly the processor']]  // the four table rows as [label, how to get the value]; the devices row leaves out the processor
            .map(([l, f]) => h('tr', {}, h('td', { class: 'b' }, l), ...JOBS.map((j) => h('td', {}, f(j))))));  // builds each row with its label and one value per job; closes the table
        const NW = ctx.narrow, X0 = NW ? 60 : 64, TW = NW ? 285 : 460;  // layout numbers: NW is true on a phone-width screen (smaller chart), then the chart's left edge and width
        const gx = (m) => X0 + (m / 30) * TW;  // gx(m) turns a minute (0 to 30) into a horizontal position on the chart
        const gantt = s('svg', { viewBox: `0 0 ${NW ? 356 : 540} 142`, width: '100%' });  // the timeline chart of the jobs (a Gantt chart: one bar per job along a time axis)
        const memBar = h('div', { style: { display: 'flex', height: '20px', borderRadius: '6px', overflow: 'hidden', background: 'var(--panel-3)', border: '1px solid var(--line)' } });  // the memory bar: shows which jobs are in memory at the cursor time
        const memTxt = h('div', { class: 'small' });  // the line of text under the memory bar
        const devs = h('div', { class: 'row', style: { gap: '6px' } });  // the row of device chips showing what is busy at the cursor time
        function drawLeft() {  // drawLeft() redraws the chart, the memory bar, its text and the device chips
          const sc = M[mode].sc;  // sc is the schedule for the chosen mode
          const kids = [];  // kids collects the shapes to draw
          for (let m = 0; m <= 30; m += 5) kids.push(s('line', { x1: gx(m), y1: 16, x2: gx(m), y2: 136, style: 'stroke:var(--line)', 'stroke-dasharray': '2 4' }), s('text', { x: gx(m), y: 12, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, String(m)));  // a dotted guide line every 5 minutes from 0 to 30, each with its minute label at the top
          const labels = [];  // labels are collected separately so they can be drawn on top of the cursor line
          JOBS.forEach((j, i) => {  // draws one bar per job
            const y = 24 + i * 38, [a, b] = sc[i];  // y is the job's row; a and b are its start and end minutes in this mode
            kids.push(s('rect', { x: gx(a), y, width: gx(b) - gx(a), height: 28, rx: 5, class: 's-' + j.cls, 'stroke-width': 2 }));  // the job's bar from start to end, in the job's color
            labels.push(s('text', { x: X0 - 8, y: y + 19, 'text-anchor': 'end', 'font-size': 14, 'font-weight': 800 }, j.nm),  // the job's name at the left of its row
              s('text', { x: gx(b) + 6, y: y + 19, 'font-size': 13, 'font-weight': 700, style: b > 26 ? 'display:none' : '' }, (NW ? '' : 'done at ') + b + ' min'),  // "done at N min" just after the bar, hidden when the bar ends too far right to fit it
              s('text', { x: gx(b) - 6, y: y + 19, 'text-anchor': 'end', 'font-size': 13, 'font-weight': 700, style: b > 26 ? '' : 'display:none' }, (NW ? '' : 'done at ') + b + ' min'));  // the same label drawn inside the end of the bar instead, used only for bars that end past minute 26
          });  // ends the loop over the jobs
          kids.push(s('line', { x1: gx(tNow), y1: 16, x2: gx(tNow), y2: 138, style: 'stroke:var(--chc)', 'stroke-width': 2.5, opacity: 0.8 }), ...labels);  // the chapter-colored cursor line at the chosen time, then the labels on top of it
          kids.push(s('text', { x: 4, y: 12, 'font-size': 12.5, class: 's-sub' }, NW ? 'min' : 'minutes'));  // the axis title at the top left ("min" on a phone-width screen)
          gantt.replaceChildren(...kids);  // replaces the old chart with the new shapes
          const live = JOBS.filter((j, i) => sc[i][0] <= tNow && tNow < sc[i][1]);  // live: the jobs running at the cursor time
          const used = live.reduce((a, j) => a + j.mem, 0);  // used: the memory those jobs take up
          memBar.replaceChildren(...live.map((j) => h('div', { title: j.nm, style: { width: (j.mem / MEM) * 100 + '%', background: `var(--${j.cls}-bg)`, borderRight: `2px solid var(--${j.cls})`, fontSize: '12px', fontWeight: 800, textAlign: 'center', lineHeight: '19px' } }, j.nm)));  // redraws the memory bar with one colored part per running job, sized by its share of the 250 MB
          memTxt.innerHTML = tNow >= M[mode].elapsed ? `<b>At ${tNow} min:</b> all three jobs are finished; memory and devices are idle.` : `<b>At ${tNow} min:</b> ${used} of ${MEM} MB of memory in use (${Math.round((used / MEM) * 100)}%).`;  // the text under it: memory in use at that moment, or that all jobs are finished
          const busy = new Set(live.flatMap((j) => j.dev));  // busy: the set of devices the running jobs use
          /* the I/O-heavy jobs still use the processor a little (about 1 of the 6 processor-minutes) */
          const light = !busy.has('Processor') && live.length > 0;  // light is true when jobs are running but none of them is the compute-heavy one, so the processor is only a little busy
          devs.replaceChildren(h('span', { class: 'small b' }, 'Busy now:'), ...['Processor', 'Terminal', 'Disk', 'Printer'].map((d) => {  // redraws the device chips, starting with the label "Busy now:"
            const on = busy.has(d), lt = d === 'Processor' && light;  // on: this device is busy; lt: this is the processor and it is only lightly used
            return h('span', { class: 'chip ' + (on ? (d === 'Processor' ? 'cpu' : 'io') : ''), style: on ? {} : { opacity: lt ? '.8' : '.55' } }, (on ? '● ' : lt ? '◔ ' : '○ ') + d + (lt ? ' (a little)' : ''));  // a filled circle and colored chip for busy, a quarter circle and "(a little)" for light use, a faded empty circle for idle
          }));  // closes the device chips
        }  // ends drawLeft()
        const tSlider = ctx.ui.slider({ label: 'Time', min: 0, max: 30, step: 1, value: tNow, format: (v) => v + ' min', onInput: (v) => { tNow = v; drawLeft(); } });  // the time slider from 0 to 30 minutes; moving it moves the cursor and redraws the left side
        /* ---- right: utilization bars + metrics table ---- */
        const bars = h('div', { class: 'bars' });  // the resource-use bars on the right
        const tbl = h('table', { class: 'tbl compact' });  // the table of measures
        const note = h('div', { class: 'callout m0 small', style: { lineHeight: '1.42' } });  // the explanation box under the table
        const pc = (v) => Math.round(v * 100) + '%';  // pc(v) writes a fraction as a whole percentage
        function drawRight() {  // drawRight() redraws the resource bars, the measures table and the explanation box
          const cur = M[mode], oth = M[mode === 'uni' ? 'multi' : 'uni'];  // cur: measures for the chosen mode; oth: measures for the other mode
          bars.replaceChildren(...[['Processor', 'cpu', 'cpu'], ['Memory', 'mem', 'mem'], ['Disk', 'disk', 'io'], ['Printer', 'printer', 'io']].map(([l, k, c]) => h('div', { class: 'bar-row' },  // rebuilds four bars: processor, memory, disk and printer, as [label, measure key, color]
            h('span', { class: 'b' }, l), h('div', { class: 'bar' }, h('i', { style: { width: cur[k] * 100 + '%', background: `var(--${c})` } }), h('b', { style: { left: `calc(${oth[k] * 100}% - 1px)` }, title: 'the other mode' })), h('span', { class: 'v' }, pc(cur[k])))));  // each bar: its label, a filling for this mode, a thin mark at the other mode's value, and the percentage
          const rows = [['Elapsed time', (m) => m.elapsed + ' min'], ['<span class="t">Throughput</span>', (m) => m.thr + ' jobs/hr'], ['Mean <span class="t">response time</span>', (m) => (m.resp % 1 ? '≈ ' + Math.round(m.resp) : m.resp) + ' min']];  // rows of the measures table as [label, how to show the value]: elapsed time, throughput and mean response time
          tbl.replaceChildren(h('tr', {}, h('th', {}, 'Measure'), h('th', { style: mode === 'uni' ? { color: 'var(--chc)' } : {} }, ctx.narrow ? 'Uni' : 'Uniprogramming'), h('th', { style: mode === 'multi' ? { color: 'var(--chc)' } : {} }, ctx.narrow ? 'Multi' : 'Multiprogramming')),  // the table header: the chosen mode's column title is chapter-colored (short titles on a phone-width screen)
            ...rows.map(([l, f]) => h('tr', {}, h('td', { class: 'b', html: l }), h('td', { class: 'num', style: mode === 'uni' ? { background: 'var(--accent-bg)', fontWeight: 800 } : {} }, f(M.uni)), h('td', { class: 'num', style: mode === 'multi' ? { background: 'var(--accent-bg)', fontWeight: 800 } : {} }, f(M.multi)))));  // one row per measure with both modes' values; the chosen mode's cell is tinted and bold
          note.className = 'callout m0 small ' + (mode === 'uni' ? 'bad' : 'tip');  // the explanation box turns red for one at a time and green for all at once
          note.setAttribute('data-label', mode === 'uni' ? 'One at a time' : 'All at once');  // its label: "One at a time" or "All at once"
          note.innerHTML = mode === 'uni'  // its text depends on the mode
            ? 'JOB2 waits 5 minutes and JOB3 waits 20, even though neither needs the devices the running job is using. Responses: 5, 20 and 30 min, mean (5 + 20 + 30) / 3 ≈ 18 min.'  // one at a time: JOB2 and JOB3 wait for no good reason, so the mean response is about 18 min
            : 'The jobs need different resources, so they barely get in each other\'s way. Each finishes as if it ran alone: 5, 15 and 10 min, mean 10 min. The same work now fits in half the time.';  // all at once: the jobs barely get in each other's way, each finishes as if alone, mean 10 min
        }  // ends drawRight()
        function paint() { drawLeft(); drawRight(); }  // paint() redraws both sides
        const seg = ctx.ui.seg([{ value: 'uni', label: 'Uniprogramming' }, { value: 'multi', label: 'Multiprogramming' }], mode, (v) => { mode = v; if (tNow > M[mode].elapsed) { tNow = M[mode].elapsed; tSlider.set(tNow); } paint(); });  // two buttons for the mode; switching pulls the cursor back if it lies past the new finish time, then redraws
        const left = h('div', { class: 'stack', style: { gap: '8px' } }, spec, h('div', { class: 'card white tight stack', style: { gap: '6px' } }, gantt, tSlider, memBar, memTxt, devs));  // left column: the job table, then a card with the chart, time slider, memory bar, its text and the device chips
        const right = h('div', { class: 'stack', style: { gap: '9px' } },  // right column of the step
          h('div', { class: 'card tight' }, h('h4', {}, 'Resource use over the whole run'), bars, h('div', { class: 'xs muted', style: { marginTop: '5px' } }, 'Each bar is the average share in use over the run, e.g. processor 6 busy min ÷ 30 min = 20%. The thin mark shows the other mode.')),  // a card with the heading, the resource bars and a note on how each bar is calculated
          tbl, note,  // the measures table and the explanation box
          h('p', { class: 'small muted m0', html: 'Nothing about the hardware changed. The only difference is whether the OS keeps several jobs in memory and switches among them.' }));  // closing note: the hardware did not change, only how the OS runs the jobs; closes the right column
        el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },  // puts the step on screen: a column that fills the step area
          h('div', { class: ctx.narrow ? 'stack' : 'row nw', style: { justifyContent: 'space-between', gap: ctx.narrow ? '8px' : '16px' } },  // the top row: the intro and the mode buttons side by side (stacked on a phone-width screen)
            h('p', { class: 'm0', style: { fontSize: '15.5px', lineHeight: '1.4', flex: '1' }, html: 'A machine with 250 MB of memory for user programs, a disk, a terminal and a printer gets three jobs at the same moment. Together they need about 6 minutes of processor time.' }),  // intro: a 250 MB machine gets three jobs at once, needing about 6 processor-minutes in total
            h('div', { style: { flex: 'none' } }, seg)),  // the mode buttons, kept at their natural width; closes the top row
          h('div', { class: 'split grow', style: { gridTemplateColumns: 'minmax(0, 1.12fr) minmax(0, 1fr)', height: 'auto' } }, left, right)));  // the two columns side by side, the left one slightly wider; closes the layout
        paint();  // draws the starting state
      },  // ends render() for step 6
    },  // ends step 6

    /* ---------------- 7. Time sharing vs batch multiprogramming: response-time demo ---------------- */
    {  // step 7 begins: time sharing versus running each request to completion, as a response-time lab
      title: 'Time sharing: many users, one processor',  // the title shown at the top of step 7
      kind: 'compare',  // kind "compare" labels this step as a Compare step
      core: true, // on the shorter core path
      render(el, ctx) {  // render(el, ctx) builds step 7 when the student arrives on it
        const { h, s } = ctx;  // pulls out the h (HTML) and s (SVG) element builders
        const LONG = 20, OTHER = 0.3, MINE = 0.1;  // processor time needed, in seconds: the long job 20, each other user 0.3, and your command 0.1
        const P = { mode: 'ts', n: 6, q: 0.2, zoom: 'all' };  // P holds the settings: mode (batch or time slicing), number of users, time slice length and chart zoom
        /* Every request arrives at time 0 in this order: the long job, the other users, then you. */
        function schedule() {  // schedule() works out who uses the processor when, and when each request finishes
          const reqs = [{ who: 'long', need: LONG }];  // the request list starts with the long job
          for (let k = 0; k < P.n - 2; k++) reqs.push({ who: 'other', k, need: OTHER });  // then one request per other user (all users minus you and the long job)
          reqs.push({ who: 'you', need: MINE });  // your command comes last
          const segs = [], fin = {};  // segs lists processor periods as [who, start, end, which other user]; fin records when each kind of request finished
          let t = 0;  // t is the clock, starting at 0
          if (P.mode === 'batch') reqs.forEach((r) => { segs.push([r.who, t, t + r.need, r.k]); t += r.need; fin[r.who] = t; });  // run to completion: each request runs whole, in order
          else {  // time slicing:
            const q = reqs.map((r) => ({ ...r, left: r.need }));  // q is the round-robin queue (each request takes a turn, then goes to the back), with the time each still needs
            while (q.length) {  // keeps going until every request is done
              const r = q.shift(), run = Math.min(P.q, r.left);  // takes the request at the front and runs it for one slice, or less if it needs less
              const last = segs[segs.length - 1];  // last is the previous period on the chart
              if (last && last[0] === r.who && last[3] === r.k && Math.abs(last[2] - t) < 1e-9) last[2] = t + run; else segs.push([r.who, t, t + run, r.k]);  // if the same request ran just before with no gap, that block is stretched; otherwise a new block starts
              t += run; r.left -= run;  // moves the clock forward and takes the slice off what the request still needs
              if (r.left > 1e-9) q.push(r); else fin[r.who] = t;  // an unfinished request goes to the back of the queue; a finished one records its finish time
            }  // ends the round-robin loop
          }  // ends the time-slicing case
          return { segs, fin, total: t };  // hands back the periods, the finish times and the total time
        }  // ends schedule()
        const NW = ctx.narrow, X0 = NW ? 80 : 100, TW = NW ? 270 : 424;  // layout numbers: NW is true on a phone-width screen (smaller chart), then the chart's left edge and width
        const svg = s('svg', { viewBox: `0 0 ${NW ? 360 : 536} 150`, width: '100%', style: 'flex:none' });  // the chart of who uses the processor, 150 units tall, kept at its natural height
        const you = h('div', { class: 'big' }), longT = h('div', { class: 'b', style: { fontSize: '22px' } }), feel = h('span', { class: 'chip' });  // the big "your response time" number, the "long job done at" number and a chip that says how it feels
        const say = h('div', { class: 'callout m0 small', style: { lineHeight: '1.42' } });  // the explanation box under the numbers
        function draw() {  // draw() redraws the chart, the numbers and the explanation
          const { segs, fin, total } = schedule();  // gets the schedule for the current settings
          const span = P.zoom === 'all' ? total : 3;  // span is how many seconds the chart shows: the whole run, or only the first 3 seconds
          const x = (tt) => X0 + (Math.min(tt, span) / span) * TW;  // x(tt) turns a time into a horizontal position on the chart
          const rows = { long: 30, other: 68, you: 106 };  // the vertical position of each row: the long job, the other users, and you
          const kids = [];  // kids collects the shapes to draw
          const step = span > 20 ? 5 : span > 5 ? 2 : 0.5;  // picks the spacing of the time labels to suit the span shown
          for (let tt = 0; tt <= span + 1e-9; tt += step) kids.push(s('line', { x1: x(tt), y1: 20, x2: x(tt), y2: 132, style: 'stroke:var(--line)', 'stroke-dasharray': '2 4' }), s('text', { x: x(tt), y: 14, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, tt + ' s'));  // a dotted guide line and a seconds label at each tick
          [['long', 'Long job'], ['other', `${P.n - 2} other${P.n > 3 ? 's' : ''}`], ['you', 'You']].forEach(([k, l]) => kids.push(  // for each of the three rows (the "others" label says how many other users there are):
            s('rect', { x: X0, y: rows[k], width: TW, height: 26, rx: 4, style: 'fill:var(--panel-3);stroke:none' }),  // the row's empty gray track
            s('text', { x: X0 - 8, y: rows[k] + 18, 'text-anchor': 'end', 'font-size': 14, 'font-weight': 800, style: k === 'you' ? 'fill:var(--accent)' : '' }, l)));  // the row's label at the left, with "You" in the accent color; closes the row
          segs.filter((g) => g[1] < span).forEach(([who, a, b, k]) => kids.push(s('rect', { x: x(a), y: rows[who], width: Math.max(1.2, x(b) - x(a)), height: 26, class: who === 'long' ? 's-cpu' : who === 'you' ? 's-accent' : (k % 2 ? 'f-run' : 's-proc'), 'stroke-width': who === 'you' ? 2.5 : 0.8 })));  // each processor period that starts inside the span: blue for the long job, accent for you, two alternating teals for the others
          const fx = x(fin.you), off = fin.you > span;  // fx is where your request finishes on the chart; off is true when that is past the right edge
          kids.push(s('line', { x1: fx, y1: 100, x2: fx, y2: 140, style: 'stroke:var(--accent)', 'stroke-width': 2.5, 'stroke-dasharray': off ? '3 3' : null }),  // a vertical accent line marking when you get your answer, dashed if it is off the chart
            s('text', { x: Math.min(Math.max(fx, X0 + (NW ? 90 : 130)), X0 + TW - (NW ? 90 : 130)), y: 147, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, style: 'fill:var(--accent)' },  // its label under the chart, kept far enough from both edges to fit
              off ? (NW ? `answer at ${ctx.util.fmt(fin.you, 1)} s, off chart →` : `your answer comes at ${ctx.util.fmt(fin.you, 1)} s, off this chart →`) : `${NW ? 'answer' : 'you get your answer'} at ${ctx.util.fmt(fin.you, 1)} s`));  // the label says when you get your answer, or that it comes later, off the chart (shorter wording on a phone-width screen)
          svg.replaceChildren(...kids);  // replaces the old chart with the new shapes
          const r = fin.you;  // r is your response time
          you.textContent = ctx.util.fmt(r, 1) + ' s';  // shows it as the big number, to one decimal
          you.style.color = r < 2 ? 'var(--ok)' : r < 10 ? 'var(--warn)' : 'var(--bad)';  // colors it green under 2 s, amber under 10 s, red beyond that
          longT.textContent = ctx.util.fmt(fin.long, 1) + ' s';  // shows when the long job finished
          feel.className = 'chip ' + (r < 2 ? 'ok' : r < 10 ? 'warn' : 'bad');  // the "feel" chip uses the same green, amber and red thresholds
          feel.textContent = r < 0.5 ? 'feels instant' : r < 2 ? 'feels snappy' : r < 10 ? 'noticeably sluggish' : 'useless for interactive work';  // its words: instant, snappy, sluggish, or useless for interactive work
          say.className = 'callout m0 small ' + (P.mode === 'batch' ? 'bad' : 'why');  // the explanation box is red for run to completion and blue for time slicing
          say.setAttribute('data-label', P.mode === 'batch' ? 'Run to completion' : 'Time slicing');  // its label names the mode
          say.innerHTML = P.mode === 'batch'  // its text depends on the mode
            ? `Your 0.1-second command waits behind the whole 20-second job. Fine for a batch system, whose goal is keeping the processor busy, but a person at a terminal gives up.`  // run to completion: your tiny command waits behind the 20-second job
            : `Each request gets ${ctx.util.fmt(P.q, 1)} s in turn, so your tiny command finishes in the first round. The long job ends later (${ctx.util.fmt(fin.long, 1)} s, not 20 s): the same total work in a friendlier order.${P.n > 15 ? ' More users means a longer round for everyone.' : ''}`;  // time slicing: your command finishes in the first round, and the long job ends a little later; many users lengthen each round
        }  // ends draw()
        const seg = ctx.ui.seg([{ value: 'batch', label: 'Run each to completion' }, { value: 'ts', label: 'Time slicing' }], P.mode, (v) => { P.mode = v; draw(); });  // two buttons for the mode: run each to completion, or time slicing; choosing one redraws
        const sN = ctx.ui.slider({ label: 'Users, including you', min: 3, max: 30, value: P.n, onInput: (v) => { P.n = v; draw(); } });  // slider for the number of users, 3 to 30, you included; moving it redraws
        const sQ = ctx.ui.slider({ label: 'Time slice', min: 0.1, max: 1, step: 0.1, value: P.q, format: (v) => ctx.util.fmt(v, 1) + ' s', onInput: (v) => { P.q = v; draw(); } });  // slider for the time slice, 0.1 to 1 second; moving it redraws
        const left = h('div', { class: 'stack', style: { gap: '9px' } },  // left column of the step
          h('p', { class: 'm0', style: { fontSize: '16px', lineHeight: '1.45' }, html: 'Multiprogramming kept the processor busy, but batch users still handed in a job and waited, often for hours. In the 1960s, <span class="t">time sharing</span> applied multiprogramming to <b>interactive</b> work: many users at terminals share one processor, each getting a short <span class="t">time slice</span> in turn.' }),  // intro paragraph: time sharing applied multiprogramming to interactive users at terminals
          h('p', { class: 'small m0', style: { lineHeight: '1.42' }, html: 'With <i>n</i> active users, each gets roughly 1/<i>n</i> of the processor, minus the OS\'s own overhead. People think and type slowly next to a computer, so a well-run system still feels like a private machine.' }),  // paragraph: each of n users gets about 1/n of the processor, yet it still feels private
          h('table', { class: 'tbl compact' },  // a small comparison table
            h('tr', {}, h('th', {}, ''), h('th', {}, ctx.narrow ? 'Batch' : 'Batch multiprogramming'), h('th', {}, 'Time sharing')),  // header row: batch multiprogramming versus time sharing (short title on a phone-width screen)
            h('tr', {}, h('td', { class: 'b' }, 'Main goal'), h('td', {}, 'Maximize processor use'), h('td', { html: 'Minimize <span class="t">response time</span>' })),  // row: the main goal of each (processor use versus response time)
            h('tr', {}, h('td', { class: 'b' }, 'Instructions to the OS come from'), h('td', {}, 'Job control language commands sent with the job'), h('td', {}, 'Commands the user types at the terminal'))),  // row: where each gets its instructions (job control cards versus typed commands); closes the table
          h('div', { class: 'callout analogy m0 small', 'data-label': 'Analogy', html: 'A chess champion playing twenty boards at once makes one move at each in turn. Nobody waits long, yet only one board is ever being played.' }),  // analogy box: a chess champion playing twenty boards, one move at a time
          h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'Time sharing does not make the processor faster or do more work. It changes the <i>order</i>, so short requests stop waiting behind long ones.' }));  // "Common mistake" box: time sharing changes the order of work, not the amount; closes the left column
        const right = h('div', { class: 'card white stack', style: { gap: '8px' } },  // right column: the response-time lab card
          h('p', { class: 'small m0', html: '<b style="font-size:17px">Response-time lab.</b> <span class="muted">Everyone presses Enter at once. First in line: a 20-second computation. Then other users, each needing 0.3 s. Last: <b style="color:var(--accent)">your</b> command, needing only 0.1 s.</span>' }),  // lab intro: everyone presses Enter at once, with the long job first and your 0.1-second command last
          h('div', { class: 'row', style: { justifyContent: 'space-between' } }, seg, ctx.ui.seg([{ value: 'all', label: 'Whole run' }, { value: 'zoom', label: 'First 3 s' }], P.zoom, (v) => { P.zoom = v; draw(); })), sN, sQ, svg,  // a row with the mode buttons and the zoom buttons (whole run or first 3 s), then the two sliders and the chart
          h('div', { class: 'row nw', style: { gap: '22px', alignItems: 'flex-end' } },  // a row that does not wrap, for the numbers
            h('div', { class: 'kpi' }, h('span', { class: 'xs muted b' }, 'YOUR RESPONSE TIME'), you),  // stat block: your response time
            h('div', { class: 'kpi' }, h('span', { class: 'xs muted b' }, 'LONG JOB DONE AT'), longT),  // stat block: when the long job was done
            h('div', { style: { marginBottom: '8px' } }, feel)),  // the "feel" chip, lined up with the numbers; closes the row
          say);  // the explanation box; closes the card
        el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.18fr)' } }, left, right));  // puts both columns on screen, the lab slightly wider, filling the step area
        draw();  // draws the starting state
      },  // ends render() for step 7
    },  // ends step 7

    /* ---------------- 8. CTSS: clock-driven swapping, only the overwritten words go to disk ---------------- */
    {  // step 8 begins: how CTSS swapped users in and out of memory, with a player and a pick-your-own-turns mode
      title: 'CTSS: time sharing on a 1961 machine',  // the title shown at the top of step 8
      kind: 'explore',  // kind "explore" labels this step as an Explore step
      render(el, ctx) {  // render(el, ctx) builds step 8 when the student arrives on it
        const { h, s } = ctx;  // pulls out the h (HTML) and s (SVG) element builders
        const SIZE = { 1: 10000, 2: 24000, 3: 4000, 4: 14000 };  // SIZE: how many words each of the four users' programs takes
        const COL = { 1: 'proc', 2: 'thread', 3: 'warn', 4: 'cpu' };  // COL: the color used for each job in the drawing
        const TURNS = [1, 2, 3, 1, 4, 2];  // TURNS: the order of turns in the example: JOB1, JOB2, JOB3, JOB1, JOB4, JOB2
        const n0 = (v) => v.toLocaleString('en-US');  // n0(v) writes a number with thousands separators, such as 10,000
        /* Replay a list of turns: for each turn record what is written out, what is read in, and what stays resident.
           cs = words moved by CTSS (only overwritten words go out); cn = words moved if whole programs were swapped. */
        function build(turns) {  // build(turns) replays a list of turns and returns one frame per turn, plus a starting frame
          const res = { 1: [], 2: [], 3: [], 4: [] };  // res: for each job, the ranges of memory words [start, end) of it that are still in memory; all empty at first
          const out0 = [{ t: null, run: null, res: JSON.parse(JSON.stringify(res)), out: [], inW: 0, cs: 0, cn: 0 }];  // the starting frame: no turn, nothing running, nothing moved (JSON copy makes a snapshot of res)
          let cs = 0, cn = 0;  // running totals: cs = words moved the CTSS way, cn = words moved if whole programs were swapped
          turns.forEach((J, i) => {  // handles each turn in order; J is the job that runs, i is the turn number
            const lo = 5000, hi = 5000 + SIZE[J], out = [];  // J will occupy words 5,000 up to 5,000 + its size; out will list what must be written to disk
            for (const K of [1, 2, 3, 4]) {  // checks every other job
              if (K === J) continue;  // the job about to run is not written out
              const keep = []; let w = 0;  // keep collects the parts of job K that survive; w counts the words of K that will be overwritten
              for (const [a, b] of res[K]) {  // looks at each range of K that is in memory
                const oa = Math.max(a, lo), ob = Math.min(b, hi);  // oa to ob is the part of this range that J's space covers
                if (ob > oa) { w += ob - oa; if (a < oa) keep.push([a, oa]); if (b > ob) keep.push([ob, b]); } else keep.push([a, b]);  // if they overlap: count those words as written out and keep any piece above or below; otherwise keep the whole range
              }  // ends the loop over K's ranges
              res[K] = keep; if (w) out.push([K, w]);  // stores what is left of K, and records how many words of K go to disk, if any
            }  // ends the loop over the other jobs
            const inW = SIZE[J] - res[J].reduce((a, [x, y]) => a + y - x, 0);  // inW: the words of J that must be read in, which is its size minus the words of it still in memory
            res[J] = [[lo, hi]];  // now J fills its whole space
            const prev = turns[i - 1];  // prev is the job that ran on the turn before
            cs += out.reduce((a, x) => a + x[1], 0) + inW;  // the CTSS total grows by the words written out plus the words read in
            if (!i) cn += SIZE[J]; else if (prev !== J) cn += SIZE[prev] + SIZE[J];  // whole-program total: the first turn reads J whole; later, a change of job writes the old one whole and reads the new one whole
            out0.push({ t: i * 0.2, run: J, res: JSON.parse(JSON.stringify(res)), out, inW, cs, cn });  // saves this turn's frame: time (0.2 s per turn), the running job, a snapshot of memory, what moved, and both totals
          });  // ends the loop over the turns
          return out0;  // hands back all the frames
        }  // ends build()
        const F = build(TURNS);  // F holds the frames for the example turns
        F.push(Object.assign({}, F[F.length - 1], { summary: true }));  // adds a final summary frame: the same as the last turn, marked as the summary
        const CAP = [  // CAP: one caption per frame of the example
          'Four users are logged in at terminals; their programs wait on disk. The monitor always holds words 0 to 4,999, and every user program is loaded starting at word 5,000.',  // caption 0: four users are logged in; the monitor holds words 0 to 4,999 and programs load at 5,000
          '<b>t = 0.0 s.</b> JOB1 (10,000 words) is read in at word 5,000 and starts running. Nothing needs to be written out yet.',  // caption 1: JOB1 is read in and starts; nothing is written out yet
          '<b>Clock interrupt at 0.2 s.</b> The monitor takes the processor back and picks JOB2. JOB2 (24,000 words) would cover all of JOB1, so JOB1\'s 10,000 words go to disk first; then JOB2 is read in.',  // caption 2: the clock interrupt at 0.2 s; JOB2 covers all of JOB1, so JOB1 goes to disk first
          '<b>0.4 s: JOB3\'s turn.</b> JOB3 is small (4,000 words), so it overwrites only the first 4,000 words of JOB2 (words 5,000 to 8,999). Only those are written out; JOB2\'s other 20,000 words stay in memory.',  // caption 3: small JOB3 overwrites only 4,000 words of JOB2, so only those are written out
          '<b>0.6 s: JOB1 again.</b> Its space holds JOB3 and 6,000 more words of JOB2, so both are written out (10,000 words) and JOB1 is read back in. 14,000 words of JOB2 are still in memory.',  // caption 4: JOB1 returns; JOB3 and 6,000 more words of JOB2 are written out
          '<b>0.8 s: JOB4</b> (14,000 words) needs words 5,000 to 18,999, so JOB1 and 4,000 more words of JOB2 go to disk. JOB2\'s last 10,000 words (19,000 to 28,999) have never been disturbed.',  // caption 5: JOB4 displaces JOB1 and 4,000 more words of JOB2; JOB2's last 10,000 words are untouched
          '<b>1.0 s: JOB2 again.</b> JOB4 is written out, but only 14,000 words of JOB2 must be read in: its last 10,000 words never left memory.',  // caption 6: JOB2 returns and needs only 14,000 words read in
          '<b>The payoff.</b> Six turns moved 128,000 words between memory and disk. Writing every outgoing program out whole and reading every incoming one whole would have moved 148,000.',  // caption 7: the payoff, 128,000 words moved instead of 148,000
        ];  // closes the CAP list
        /* on phones the per-job disk panel is dropped so the memory map can be drawn larger */
        const NW = ctx.narrow;  // NW is true on a phone-width screen, where the disk panel is left out
        const svg = s('svg', { viewBox: `0 0 ${NW ? 400 : 640} 336`, width: '100%' });  // the drawing, 336 units tall, and 400 or 640 units wide depending on the layout
        const Y0 = 40, K = 288 / 32000, MX = 70, MW = 196;  // layout numbers: top of the memory map, units per word (288 for 32,000 words), and its left edge and width
        const ya = (a) => Y0 + a * K;  // ya(a) turns a word address into a vertical position on the memory map
        const tallyA = h('div', { class: 'bar' }, h('i', { style: { background: 'var(--ok)' } }));  // the green tally bar for the words CTSS moved
        const tallyB = h('div', { class: 'bar' }, h('i', { style: { background: 'var(--bad)' } }));  // the red tally bar for the words whole-program swapping would move
        const tA = h('span', { class: 'v', style: { width: 'auto' } }), tB = h('span', { class: 'v' });  // the number printed at the end of each tally bar
        function draw(f) {  // draw(f) redraws the memory map, the transfer arrows, the disk panel and the tallies for frame f
          const kids = [  // kids collects the shapes to draw, starting with the fixed parts
            s('text', { x: 0, y: 18, 'font-size': 16, 'font-weight': 800 }, f.t == null ? 'Before the first turn' : `t = ${f.t.toFixed(1)} s`),  // the time at the top left, or "Before the first turn"
            s('text', { x: NW ? 396 : 282, y: 18, 'text-anchor': NW ? 'end' : 'start', 'font-size': 14, 'font-weight': 700, style: f.run ? `fill:var(--${COL[f.run]})` : '' }, f.run ? `processor: JOB${f.run}` : 'processor: monitor'),  // who has the processor, in that job's color, or "processor: monitor" before the first turn
            s('rect', { x: MX, y: ya(0), width: MW, height: ya(5000) - ya(0), rx: 4, class: 's-os', 'stroke-width': 2 }),  // the monitor's block at the top of memory, words 0 to 4,999
            s('text', { x: MX + MW / 2, y: (ya(0) + ya(5000)) / 2 + 5, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 800, style: 'fill:var(--os)' }, 'Monitor · 5,000 words'),  // its label, "Monitor · 5,000 words"
            s('rect', { x: MX, y: ya(5000), width: MW, height: ya(32000) - ya(5000), rx: 4, class: 's-muted', 'stroke-dasharray': '5 4', style: 'fill:var(--panel)' }),  // the user area below it, words 5,000 to 31,999, as a dashed empty box
            s('text', { x: MX + MW / 2, y: ya(31000) + 4, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, 'user area: 27,000 words'),  // its label near the bottom: "user area: 27,000 words"
          ];  // closes the fixed parts
          const ticks = new Set([0, 5000, 32000]);  // ticks: the word addresses to label on the left; always 0, 5,000 and 32,000
          [1, 2, 3, 4].forEach((j) => f.res[j].forEach(([a, b]) => {  // draws every range of every job that is in memory in this frame
            const run = f.run === j && !f.summary, y1 = ya(a), y2 = ya(b);  // run is true for the running job (except on the summary frame); y1 and y2 are the range's top and bottom
            ticks.add(a); ticks.add(b);  // labels the range's start and end addresses too
            kids.push(s('rect', { x: MX + 3, y: y1 + 1.5, width: MW - 6, height: y2 - y1 - 3, rx: 4, class: 's-' + COL[j], 'stroke-width': run ? 3 : 1.5, 'stroke-dasharray': run ? null : '4 3', style: run ? '' : 'fill-opacity:.45' }),  // the range as a block in the job's color: solid and thick if it is running, faded and dashed otherwise
              s('text', { x: MX + MW / 2, y: (y1 + y2) / 2 + 5, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 800 }, `JOB${j}${run ? ' ▶ running' : b - a < SIZE[j] ? ' (part)' : ' (waiting)'}`));  // its label: "running", "(part)" if only some of the job is in memory, or "(waiting)"; closes the push
          }));  // ends the loops over jobs and ranges
          [...ticks].forEach((a) => kids.push(s('text', { x: MX - 6, y: ya(a) + 4, 'text-anchor': 'end', 'font-size': 12, class: 's-sub' }, n0(a))));  // writes each collected address at the left edge of the memory map
          const outW = f.out.reduce((a, x) => a + x[1], 0);  // outW is the total number of words written out in this frame
          const arrow = (y, dir, txt, on) => [  // arrow() draws a transfer arrow between memory and disk, orange when words move and gray when nothing does
            s('line', { x1: dir > 0 ? 280 : 392, y1: y, x2: dir > 0 ? 388 : 284, y2: y, style: on ? 'stroke:var(--io)' : 'stroke:var(--line-2)', 'stroke-width': 3, 'marker-end': on ? 'url(#arr-io)' : 'url(#arr-muted)' }),  // the arrow line: pointing right (out to disk) or left (in from disk)
            s('text', { x: 336, y: y - 8, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 700, style: on ? 'fill:var(--io)' : '', class: on ? '' : 's-sub' }, txt)];  // the arrow's label above it; ends arrow()
          if (!f.summary) kids.push(...arrow(150, 1, outW ? `out ${n0(outW)} words` : 'nothing out', outW > 0), ...arrow(210, -1, f.inW ? `in ${n0(f.inW)} words` : 'nothing in', f.inW > 0));  // except on the summary frame: an "out" arrow and an "in" arrow with the word counts, or "nothing out/in"
          if (!NW) kids.push(s('rect', { x: 398, y: 30, width: 240, height: 288, rx: 12, class: 's-io', 'stroke-width': 2 }),  // the disk panel on the right (left out on a phone-width screen)
            s('text', { x: 412, y: 54, 'font-size': 15, 'font-weight': 800, style: 'fill:var(--io)' }, 'Where each job\'s words are'));  // its title: "Where each job's words are"
          if (!NW) [1, 2, 3, 4].forEach((j, r) => {  // one line in the disk panel per job
            const y = 76 + r * 58, bw = (SIZE[j] / 24000) * 212;  // y is this job's line; bw is its bar width, scaled so the biggest job (24,000 words) fills the panel
            kids.push(s('text', { x: 412, y: y + 12, 'font-size': 13.5, 'font-weight': 800, style: `fill:var(--${COL[j]})` }, `JOB${j}`), s('text', { x: 456, y: y + 12, 'font-size': 12.5, class: 's-sub' }, `${n0(SIZE[j])} words`),  // the job's name in its color and its size in words
              s('rect', { x: 412, y: y + 20, width: bw, height: 18, rx: 3, style: 'fill:var(--panel-3);stroke:var(--line-2)', 'stroke-dasharray': '3 3' }));  // a gray dashed bar the length of the whole job; any part left gray is on disk only
            f.res[j].forEach(([a, b]) => kids.push(s('rect', { x: 412 + ((a - 5000) / SIZE[j]) * bw, y: y + 20, width: ((b - a) / SIZE[j]) * bw, height: 18, rx: 3, class: 's-' + COL[j], 'stroke-width': 1.5 })));  // colored pieces over it for the parts that are in memory right now, placed by their offset in the job
          });  // ends the loop over the disk panel lines
          if (!NW) kids.push(s('text', { x: 412, y: 310, 'font-size': 12.5, class: 's-sub' }, 'colour: in memory · grey: on disk only'));  // the key under the panel: color means in memory, gray means on disk only
          svg.replaceChildren(...kids);  // replaces the old drawing with the new shapes
          const top = Math.max(148000, f.cn);  // top is the scale for the tallies: at least 148,000 words, or more if the student's turns moved more
          tallyA.firstChild.style.width = (f.cs / top) * 100 + '%'; tallyB.firstChild.style.width = (f.cn / top) * 100 + '%';  // stretches both tally bars to their share of that scale
          tA.textContent = n0(f.cs); tB.textContent = n0(f.cn);  // prints both totals with thousands separators
        }  // ends draw()
        const player = ctx.ui.player({ count: F.length, interval: 3200, render: (i) => { draw(F[i]); return CAP[i]; } });  // the animation controls for the example; each frame redraws the drawing and returns its caption
        /* ---- "you pick the turns" mode: the student acts as the monitor's scheduler ---- */
        const MAXT = 8;  // MAXT: the student may pick at most 8 turns
        let mine = [];  // mine is the list of turns the student has picked so far
        function describe(f, n) {  // describe(f, n) writes the caption for the student's latest turn
          if (!n) return '<b>You are the monitor.</b> At each clock interrupt, pick the job that runs next and watch which words must move. Try a small job right after a big one, or the same job twice.';  // before any turn: invites the student to act as the monitor and suggests things to try
          const outW = f.out.reduce((a, x) => a + x[1], 0);  // outW is the total written out on this turn
          const outs = f.out.map(([K, w], i) => `${n0(w)}${i ? '' : ' words'} of JOB${K}`).join(' and ');  // outs lists what was written out, job by job, such as "4,000 words of JOB2 and 6,000 of JOB3"
          return `<b>t = ${f.t.toFixed(1)} s: JOB${f.run}</b> (${n0(SIZE[f.run])} words) runs. ` + (outW ? `Written out: ${outs}. ` : 'Nothing written out. ')  // names the turn's time and job, then what was written out
            + (f.inW ? `Read in: ${n0(f.inW)} words.` : 'Nothing read in: all of it was still in memory.') + (n >= MAXT ? ' <b>Last turn:</b> compare the two tallies above.' : '');  // then what was read in, and a note on the last allowed turn; ends the caption
        }  // ends describe()
        const pickCap = h('div', { class: 'player-cap', 'aria-live': 'polite' });  // the caption box for this mode, styled like the player's caption and read out by screen readers
        const turnCt = h('span', { class: 'player-count' });  // the "Turn 3 / 8" counter
        const jobBtns = [1, 2, 3, 4].map((j) => h('button', { class: 'btn sm', type: 'button', style: { borderColor: `var(--${COL[j]})`, color: `var(--${COL[j]})`, fontWeight: 800 }, onclick: () => { if (mine.length < MAXT) { mine.push(j); showMine(); } } }, 'JOB' + j));  // one button per job, in that job's color; clicking adds a turn for it (until 8 turns) and redraws
        const undo = h('button', { class: 'btn sm', type: 'button', onclick: () => { mine.pop(); showMine(); } }, 'Undo');  // the Undo button removes the last turn
        const clear = h('button', { class: 'btn sm', type: 'button', onclick: () => { mine = []; showMine(); } }, 'Start over');  // the "Start over" button removes every turn
        const pick = h('div', { class: 'player', style: { display: 'none' } }, pickCap,  // the pick-your-turns panel, styled like the animation player and hidden at first; its caption on top
          h('div', { class: 'player-ctl' }, h('span', { class: 'small b' }, 'Run next:'), ...jobBtns, turnCt, h('span', { class: 'grow' }), undo, clear));  // its control row: "Run next:", the four job buttons, the turn counter, a spacer, then Undo and Start over
        function showMine() {  // showMine() replays the student's turns and shows the result of the latest one
          const fr = build(mine), f = fr[fr.length - 1];  // builds the frames for the picked turns and takes the last one
          draw(f);  // draws that frame
          pickCap.innerHTML = describe(f, mine.length);  // writes its caption
          jobBtns.forEach((b) => { b.disabled = mine.length >= MAXT; });  // turns the job buttons off once 8 turns are used
          undo.disabled = clear.disabled = !mine.length;  // turns Undo and Start over off while there are no turns
          turnCt.textContent = `Turn ${mine.length} / ${MAXT}`;  // updates the turn counter
        }  // ends showMine()
        const modeSeg = ctx.ui.seg([{ value: 'ex', label: 'Watch the example' }, { value: 'you', label: 'You pick the turns' }], 'ex', (v) => {  // two buttons that switch between watching the example and picking the turns
          if (v === 'you') { player.stop(); player.el.style.display = 'none'; pick.style.display = ''; showMine(); }  // picking: stops and hides the example player, shows the pick panel and draws the student's turns
          else { pick.style.display = 'none'; player.el.style.display = ''; player.refresh(); }  // watching: hides the pick panel, shows the player again and redraws its current frame
        });  // ends the mode switch's handler
        const left = h('div', { class: 'stack', style: { gap: '9px' } },  // left column of the step
          h('p', { class: 'm0', style: { fontSize: '16px', lineHeight: '1.45' }, html: 'One of the first time-sharing systems was the <span class="t" data-t="CTSS">Compatible Time-Sharing System (CTSS)</span>, built at MIT in 1961 for the IBM 709 and later run on the IBM 7094.' }),  // intro paragraph: CTSS, built at MIT in 1961 for the IBM 709 and later the IBM 7094
          h('ul', { class: 'small m0', style: { lineHeight: '1.42', display: 'flex', flexDirection: 'column', gap: '4px' } },  // a list of four facts about CTSS
            h('li', { html: '<b>Memory:</b> 32,000 words of 36 bits. The resident monitor took 5,000, leaving 27,000 words for one user program at a time.' }),  // fact: 32,000 words of memory, 5,000 of them for the monitor
            h('li', { html: '<b>Same address every time:</b> each user program was loaded starting at word 5,000, which kept the monitor simple.' }),  // fact: every user program was loaded at word 5,000
            h('li', { html: '<b>Clock:</b> an <span class="t">interrupt</span> about every 0.2 s let the OS take the processor back and give it to another user.' }),  // fact: a clock interrupt about every 0.2 s let the OS switch users
            h('li', { html: '<b><span class="t">Swapping</span>:</b> the outgoing user\'s program and data went to disk before the next one came in. To save disk traffic, only the words the newcomer would overwrite were written out.' })),  // fact: swapping wrote out only the words the newcomer would overwrite; closes the list
          h('div', { class: 'card tight intr' }, h('h4', {}, 'New problems time sharing created'),  // a red-tinted card: the new problems time sharing created
            h('ul', { class: 'small m0', style: { lineHeight: '1.4' } },  // its list of problems
              h('li', { html: '<b>Protection among users:</b> many users\' programs share one machine and must not interfere.' }),  // protection among users
              h('li', { html: '<b>File system protection:</b> only authorized users may open a given file.' }),  // file system protection
              h('li', { html: '<b>Contention for resources:</b> users compete for printers and disks, so conflicting requests must be settled.' }))),  // contention for shared devices; closes the list and the card
          h('div', { class: 'row', style: { gap: '10px' } }, h('span', { class: 'small b' }, 'Simulator:'), modeSeg));  // a row with the label "Simulator:" and the mode buttons; closes the left column
        const right = h('div', { class: 'stack', style: { gap: '6px' } }, svg,  // right column: the drawing first
          h('div', { class: 'bars', style: { gap: '4px' } },  // the two tally bars under the drawing
            h('div', { class: 'xs muted b' }, 'WORDS MOVED BETWEEN MEMORY AND DISK SO FAR'),  // their heading: words moved between memory and disk so far
            h('div', { class: 'bar-row', style: { gridTemplateColumns: (NW ? '120px' : '250px') + ' minmax(0, 1fr) 64px' } }, h('span', { class: 'small b' }, NW ? 'CTSS way' : 'CTSS: only overwritten words'), tallyA, tA),  // tally row: the CTSS way, moving only overwritten words
            h('div', { class: 'bar-row', style: { gridTemplateColumns: (NW ? '120px' : '250px') + ' minmax(0, 1fr) 64px' } }, h('span', { class: 'small b' }, NW ? 'Whole programs' : 'Swapping whole programs'), tallyB, tB)),  // tally row: swapping whole programs; closes the tallies
          player.el, pick);  // the example player and the (hidden) pick panel; closes the right column
        el.append(h('div', { class: 'split l fill' }, left, right));  // puts both columns on screen, side by side, filling the step area
      },  // ends render() for step 8
    },  // ends step 8

    /* ---------------- 9. Recap: the chain of eras + flip cards ---------------- */
    {  // step 9 begins: a recap chain of the four eras plus flip cards
      title: 'Recap: each era fixed the last one\'s biggest waste',  // the title shown at the top of step 9
      kind: 'recap',  // kind "recap" labels this step as a Recap
      render(el, ctx) {  // render(el, ctx) builds step 9 when the student arrives on it
        const { h } = ctx;  // pulls the h element-building helper out of ctx
        const ERAS = [  // ERAS: the four eras as [color, name, main idea, problem left open]
          ['io', 'Serial processing', 'No OS. Programmers run the machine by hand, one booking at a time.', 'Idle time from sign-up blocks and manual setup'],  // serial processing: no OS; left open idle time from sign-up blocks and setup
          ['os', 'Simple batch', 'A resident monitor runs jobs back to back, guided by JCL cards.', 'Processor idle while the one job waits for I/O'],  // simple batch: a resident monitor with JCL cards; left open idle time during I/O
          ['proc', 'Multiprogrammed batch', 'Several jobs in memory; switch whenever one waits for I/O.', 'No way to interact; results arrive hours later'],  // multiprogrammed batch: several jobs in memory; left open interaction and long waits
          ['cpu', 'Time sharing', 'Short time slices for many terminal users (CTSS, 1961).', 'Protection, file security, resource contention'],  // time sharing: short slices for many terminal users; left open protection, file security and contention
        ];  // closes the ERAS list
        el.append(h('div', { class: 'stack fill', style: { gap: '12px' } },  // puts the step on screen: a column that fills the step area
          h('div', { class: ctx.narrow ? 'stack' : 'chain', style: ctx.narrow ? { gap: '8px' } : {} }, ERAS.map(([c, t, idea, left]) => h('div', { class: 'card tight ' + c, style: { display: 'flex', flexDirection: 'column', gap: '4px' } },  // the four era cards in a chain with arrows (a plain stack on a phone-width screen), each tinted in its era color
            h('div', { class: 'b', style: { fontSize: '16px', color: `var(--${c})` } }, t),  // the era's name in bold, in its color
            h('div', { class: 'small', style: { lineHeight: '1.35' } }, idea),  // the era's main idea
            h('div', { class: 'xs', style: { marginTop: 'auto', lineHeight: '1.35' } }, h('b', { style: { color: 'var(--warn)' } }, 'Left open: '), left)))),  // "Left open:" in amber and the problem the era left, pushed to the bottom of the card; closes the card and the chain
          h('p', { class: 'm0 muted small' }, 'Say each answer out loud before you click the card to check it.'),  // instruction line: say each answer out loud before clicking the card
          ctx.ui.flipcards([  // flip cards: question on the front, answer on the back
            ['The two problems of serial processing', '<b>Scheduling:</b> fixed sign-up blocks were wasted or too short. <b>Setup time:</b> loading the compiler and source, then linking and loading, ate the session.'],  // card: the two problems of serial processing
            ['What does the resident monitor do?', 'It stays in memory, reads each job\'s JCL cards, loads and starts programs, and takes control back when each job ends.'],  // card: what the resident monitor does
            ['Four hardware features a batch monitor needs', 'Memory protection, a timer, privileged instructions and interrupts, plus two processor modes: user and kernel.'],  // card: the four hardware features a batch monitor needs, plus the two modes
            ['Read 15 µs, compute 1 µs, write 15 µs: utilization?', '1 / 31 ≈ <b>3.2%</b> with one program. About 6.5% with two and 9.7% with three.'],  // card: the 15 / 1 / 15 utilization example with 1, 2 and 3 programs
            ['JOB1, JOB2, JOB3: what does multiprogramming change?', 'Elapsed time 30 → 15 min, throughput 6 → 12 jobs/hr, mean response 18 → 10 min, and every resource is busier.'],  // card: what multiprogramming changes for JOB1, JOB2 and JOB3
            ['Batch multiprogramming vs time sharing', 'Batch: maximize processor use; directions come from JCL. Time sharing: minimize response time; directions are typed at a terminal.'],  // card: batch multiprogramming versus time sharing
            ['User mode vs kernel mode', 'User mode: jobs run with protected memory and privileged instructions off-limits. Kernel mode: the OS may do anything. Traps and interrupts switch to kernel mode.'],  // card: user mode versus kernel mode
            ['CTSS in numbers', 'MIT, 1961. 32,000 words of 36 bits, 5,000 for the monitor. A clock interrupt about every 0.2 s; only the words a newcomer overwrites are swapped out.'],  // card: CTSS in numbers
          ].map(([f, bk]) => ['<div>' + f + '</div>', '<div>' + bk + '</div>']), { cols: 4, height: 150 })));  // wraps both sides of each card in a div, and lays the cards out 4 per row, 150 pixels tall; closes the layout
      },  // ends render() for step 9
    },  // ends step 9

    /* ---------------- 10. Check yourself ---------------- */
    {  // step 10 begins: the section quiz
      title: 'Check yourself',  // the title shown at the top of step 10
      kind: 'check',  // kind "check" labels this step as Check Yourself
      quiz: [  // quiz: the questions the guide's quiz engine shows one at a time on this step
        { q: 'In the serial-processing era (late 1940s to mid-1950s), how did a programmer get time on the computer?',  // question 1 (multiple choice): how a programmer got machine time in the serial era
          choices: ['By reserving a block of time on a paper sign-up sheet', 'The operating system\'s scheduler gave each job a time slice', 'An operator grouped jobs into a batch on tape', 'By typing commands at a terminal whenever they liked'], answer: 0,  // the choices (sign-up sheet, time slice, operator batch, terminal); the right answer is the sign-up sheet (choice 0)
          feedback: [null, 'There was no operating system at all in this era, so nothing could hand out time slices.', 'Operators batching jobs came later, with simple batch systems in the mid-1950s.', 'Interactive terminals arrived with time sharing in the 1960s.'],  // feedback for the three wrong choices: each belongs to a later era
          why: 'With no OS, programmers booked the machine by hand. A booked block was either partly wasted (finish early) or too short (stopped before finishing).' },  // explanation: programmers booked blocks by hand, which were wasted or too short
        { type: 'order', q: 'In a simple batch system, put a FORTRAN job\'s cards in the order the resident monitor reads them (first card first).',  // question 2 (put in order): a FORTRAN job's cards in the order the monitor reads them
          items: ['$JOB', '$FTN', 'FORTRAN source program', '$LOAD', '$RUN', 'Data for the program', '$END'],  // the seven cards, listed here in the correct order; the quiz shuffles them for the student
          why: '$JOB starts the job; $FTN loads the compiler, which reads the source cards right after it; $LOAD loads the compiled program; $RUN starts it, and it reads the data cards; $END closes the job.' },  // explanation: what each card does, in order
        { type: 'match', q: 'Match each hardware feature to the trouble it prevents in a batch system.',  // question 3 (match pairs): each hardware feature to the trouble it prevents
          pairs: [['Memory protection', 'A buggy job overwriting the monitor'], ['Timer', 'One job keeping the processor forever'], ['Privileged instructions', 'A job reading the card reader directly and swallowing the next job\'s cards'], ['Interrupts', 'The OS having no way to regain control when a device finishes']],  // the pairs: protection, timer, privileged instructions and interrupts, each with its trouble
          why: 'Protection guards the monitor\'s memory, the timer bounds each job\'s time, privileged instructions keep I/O in the monitor\'s hands, and interrupts let events hand control back to the OS.' },  // explanation: how each feature keeps the monitor in control
        { type: 'tf', q: 'In kernel mode the processor refuses privileged instructions, so the monitor has to ask user programs to perform I/O for it.', answer: false,  // question 4 (true or false): kernel mode refuses privileged instructions; false
          why: 'It is the other way round. User mode refuses privileged instructions and protects some memory; the monitor runs in kernel mode, where it may execute privileged instructions and touch protected memory.' },  // explanation: it is user mode that refuses them; the monitor runs in kernel mode
        { type: 'num', q: 'A program reads a record in 15 µs, executes 100 instructions on it in 1 µs, and writes the result in 15 µs. Running alone (uniprogramming), what percentage of the time is the processor busy?', answer: 3.2, tol: 0.1, unit: '%',  // question 5 (calculate): utilization for 15 / 1 / 15 µs with one program; the answer is 3.2%, within 0.1
          why: 'The processor is busy 1 µs out of every 15 + 1 + 15 = 31 µs: 1 / 31 ≈ 0.032, or 3.2%. It idles almost 97% of the time.' },  // explanation: 1 / 31 ≈ 3.2%, so the processor idles almost 97% of the time
        { type: 'num', q: 'Each program repeats: read a record (20 µs), compute (10 µs), write a record (20 µs). Three such programs are multiprogrammed, each with its own I/O device. What is the processor utilization, in percent?', answer: 60, tol: 0.5, unit: '%',  // question 6 (calculate): utilization for three programs at 20 / 10 / 20 µs; the answer is 60%, within 0.5
          hint: 'How much processor time do three programs need per cycle, and how long is a cycle?',  // hint: processor time needed per cycle versus the cycle length
          why: 'Each program needs 10 µs of processor per 50 µs cycle. Three need 30 µs of every 50 µs: 30 / 50 = 60%. (It could never go past 100%.)' },  // explanation: 30 of every 50 µs is 60%
        { type: 'num', q: 'Three jobs arrive together and run one after another (uniprogramming), taking 5, then 15, then 10 minutes. What is their mean response time, in minutes?', answer: 18.33, tol: 0.4, unit: 'min',  // question 7 (calculate): mean response time for jobs of 5, 15 and 10 minutes run one after another; about 18.33 minutes
          why: 'They finish at 5, 20 and 30 minutes, so the mean is (5 + 20 + 30) / 3 = 55 / 3 ≈ 18.3 min. Run together under multiprogramming they would finish at 5, 15 and 10: a mean of 10 min.' },  // explanation: they finish at 5, 20 and 30 minutes, averaging about 18.3
        { q: 'Three jobs take 30 minutes in total under uniprogramming but only 15 minutes under multiprogramming. What happens to throughput?',  // question 8 (multiple choice): what happens to throughput when 30 minutes become 15
          choices: ['It doubles, from 6 to 12 jobs per hour', 'It halves, from 12 to 6 jobs per hour', 'It stays the same, because the same three jobs ran', 'It rises from 3 to 6 jobs per hour'], answer: 0,  // the choices; the right one is that it doubles from 6 to 12 jobs per hour (choice 0)
          feedback: [null, 'Doing the same work in less time raises throughput; it does not lower it.', 'Throughput is work per unit of time. The same work in half the time is twice the rate.', 'Three jobs in 30 minutes is 6 per hour, not 3.'],  // feedback for the three wrong choices
          why: 'Throughput = jobs finished per unit of time: 3 jobs in 0.5 h = 6 jobs/h, and 3 jobs in 0.25 h = 12 jobs/h.' },  // explanation: throughput is jobs finished per unit of time
        { type: 'bucket', q: 'Does each statement describe batch multiprogramming or time sharing?', buckets: ['Batch multiprogramming', 'Time sharing'],  // question 9 (sort into groups): statements about batch multiprogramming or time sharing
          items: [['Main goal: keep the processor as busy as possible', 0], ['Main goal: answer each user quickly', 1], ['Instructions come from job control language cards sent with the job', 0], ['Instructions are commands typed at a terminal', 1], ['A clock interrupt takes the processor back every fraction of a second', 1], ['Users hand in a job and collect printed output later', 0]],  // six statements, each [text, group]: goals, where instructions come from, the clock, and printed output later
          why: 'Batch multiprogramming maximizes processor use and is steered by JCL; time sharing minimizes response time, is steered by commands typed at terminals, and slices time with a clock.' },  // explanation: what each approach aims for and how it is steered
        { type: 'multi', q: 'Which problems did time sharing bring to the fore? Select all that apply.',  // question 10 (select all): problems time sharing brought to the fore
          choices: ['Protecting users\' programs from one another', 'Protecting files so only authorized users can open them', 'Settling contention for shared devices such as printers and disks', 'Booking machine time on paper sign-up sheets', 'Loading the compiler by hand for every job'], answer: [0, 1, 2],  // five options; the right ones are protecting programs, protecting files and settling contention
          why: 'With many users on one machine at once, the OS must keep them apart, guard their files, and referee shared resources. Sign-up sheets and hand-loaded compilers belong to the serial era.' },  // explanation: many users at once need separation, file guards and a referee; the other two belong to the serial era
        { type: 'num', q: 'CTSS ran on a machine with 32,000 words of memory, and its resident monitor used 5,000 of them. How many words were left for a user program?', answer: 27000, tol: 0, unit: 'words',  // question 11 (calculate): words left for a user program in CTSS; exactly 27,000
          why: '32,000 − 5,000 = 27,000 words, and every user program was loaded starting at word 5,000.' },  // explanation: 32,000 − 5,000 = 27,000, with programs loaded at word 5,000
        { q: 'When CTSS switched from one user to the next, why did it sometimes write only part of the old program to disk?',  // question 12 (multiple choice): why CTSS sometimes wrote only part of a program to disk
          choices: ['To cut disk traffic: only the words the incoming program would overwrite had to be saved', 'Because the disk was too small to hold whole programs', 'Because the 0.2-second clock left too little time to copy everything', 'To give the old program more memory when it resumed'], answer: 0,  // the choices; the right one is that it cut disk traffic (choice 0)
          feedback: [null, 'Disk space was not the reason; the goal was fewer transfers.', 'The monitor copies what it needs before loading the newcomer; the clock does not cut it short.', 'A resumed program still used the same space, starting at word 5,000.'],  // feedback for the three wrong choices
          why: 'Words the newcomer did not overwrite were still intact in memory, so saving them and later reading them back would have been wasted disk work.' },  // explanation: words the newcomer did not overwrite were still intact in memory
      ],  // closes the quiz list
    },  // ends step 10
  ],  // closes the list of steps

  notes: `${/* notes: a summary of the whole section as HTML, shown in the Notes panel and in the printable version */''}
    <h3>Why operating systems evolve</h3>${/* heading: why operating systems evolve */''}
    <p>An OS is never finished. It changes because of <b>hardware upgrades and new kinds of hardware</b> (multicore chips, new devices), <b>new services</b> that users ask for, and <b>fixes</b> for faults (which can bring new faults). Its early history is a chain in which each era removed the previous era's biggest waste:</p>${/* notes paragraph: the three forces, and the history as a chain of fixes */''}
    <table>${/* starts the table of eras */''}
      <tr><th>Era</th><th>Main idea</th><th>Problem left open</th></tr>${/* table header: era, main idea, problem left open */''}
      <tr><td>Serial processing (late 1940s to mid-1950s)</td><td>No OS; programmers run the machine by hand</td><td>Wasted booked time, long setup</td></tr>${/* table row: serial processing */''}
      <tr><td>Simple batch (mid-1950s)</td><td>A resident monitor runs jobs back to back</td><td>Processor idle during each job's I/O</td></tr>${/* table row: simple batch */''}
      <tr><td>Multiprogrammed batch (1960s)</td><td>Several jobs in memory; switch when one waits</td><td>No interaction; long waits</td></tr>${/* table row: multiprogrammed batch */''}
      <tr><td>Time sharing (1960s on; CTSS 1961)</td><td>Short time slices for many terminal users</td><td>Protection, file security, contention</td></tr>${/* table row: time sharing */''}
    </table>${/* ends the table of eras */''}
    <h3>Serial processing</h3>${/* heading: serial processing */''}
    <p>No operating system. The programmer worked the hardware directly: a <b>console</b> of display lights and toggle switches, an <b>input device</b> such as a card reader (programs in machine code on cards), and a <b>printer</b>. After an error, the lights showed the problem. Two problems:</p>${/* notes paragraph: no OS, the console, card reader and printer */''}
    <ul>${/* starts the list of problems */''}
      <li><b>Scheduling:</b> time was booked on a paper sign-up sheet in fixed blocks, so a job either left part of its block idle or was cut off before finishing.</li>${/* list item: scheduling with fixed sign-up blocks */''}
      <li><b>Setup time:</b> loading the compiler and source program, saving the compiled program, then loading and linking it, often with tapes or card decks to mount. An error meant starting over.</li>${/* list item: setup time */''}
    </ul>${/* ends the list of problems */''}
    <h3>Simple batch systems</h3>${/* heading: simple batch systems */''}
    <p>General Motors developed the first batch monitor for its IBM 701 in the mid-1950s; its successor, GM-NAA I/O (1956), ran on the IBM 704. Users hand jobs to an <b>operator</b>, who groups them into a <b>batch</b>; a <b>monitor</b> program runs them one after another. The <b>resident monitor</b> stays in memory (interrupt processing, device drivers, job sequencing, control language interpreter); the rest is the user program area. The monitor reads a job, branches to it, and gets control back when the job ends or fails, so the processor <b>alternates between the monitor and a user program</b> with no human gap.</p>${/* notes paragraph: the first batch monitors, and how the resident monitor controls each job */''}
    <p><b>Job control language (JCL)</b> cards, in reading order: <b>$JOB</b> (start; account to charge) → <b>$FTN</b> (load the FORTRAN compiler) → source cards (compiled to object code) → <b>$LOAD</b> (load the object program) → <b>$RUN</b> (jump to it) → data cards (read through the monitor's input routine) → <b>$END</b>. Out of order (say, $RUN before $LOAD) the monitor aborts the job and skips to the next $JOB.</p>${/* notes paragraph: the JCL cards in reading order, and what happens when they are out of order */''}
    <p><b>Hardware a monitor needs:</b></p>${/* lead-in line for the hardware list */''}
    <ul>${/* starts the hardware list */''}
      <li><b>Memory protection:</b> a program may not alter the monitor's memory; an attempt traps to the monitor, which aborts the job.</li>${/* list item: memory protection */''}
      <li><b>Timer:</b> set for each job; when it expires, control returns to the monitor, so no job hogs the machine.</li>${/* list item: timer */''}
      <li><b>Privileged instructions:</b> I/O and similar instructions run only in the monitor, so a program cannot read the next job's control cards.</li>${/* list item: privileged instructions */''}
      <li><b>Interrupts:</b> absent on early machines; the timer and I/O devices use them to hand control back to the monitor, so the OS can give up the processor and win it back flexibly.</li>${/* list item: interrupts */''}
    </ul>${/* ends the hardware list */''}
    <p><b>User mode:</b> user programs run with protected memory and privileged instructions off-limits. <b>Kernel mode</b> (system or control mode): the monitor may execute privileged instructions and access protected memory. A trap or interrupt switches the processor to kernel mode; the monitor switches back when it resumes a job. <b>Costs:</b> the monitor uses memory and processor time, yet utilization is far better than with serial processing.</p>${/* notes paragraph: user mode, kernel mode and the cost of the monitor */''}
    <h3>Multiprogrammed batch systems</h3>${/* heading: multiprogrammed batch systems */''}
    <p>I/O is slow next to the processor, so even with automatic sequencing it sits idle. <b>Processor utilization</b> = busy time / total time. Example: read a record 15 µs, execute 100 instructions 1 µs, write a record 15 µs: utilization = 1 / 31 ≈ <b>3.2%</b>.</p>${/* notes paragraph: the definition of processor utilization and the 3.2% example */''}
    <p><b>Uniprogramming:</b> one program in memory; the processor waits for every I/O. <b>Multiprogramming</b> (multitasking): several programs in memory; when one waits for I/O, the processor runs another. If each program has its own device, utilization with n programs = n × compute / (read + compute + write), at most 100%. For 15/1/15: 3.2%, 6.5% and 9.7% with 1, 2 and 3 programs. For 20/10/20 with three programs: 30 / 50 = 60%. With one processor the programs still compute one at a time; what overlaps is one program's computing with the others' I/O. The OS needs <b>memory management</b> and <b>scheduling</b>; the hardware needs <b>I/O interrupts</b> and <b>DMA</b> (direct memory access) so devices work on their own and signal when done.</p>${/* notes paragraph: uniprogramming versus multiprogramming, with the utilization formula and its examples */''}
    <p><b>Three-job example.</b> 250 MB of user memory, a disk, a terminal, a printer. JOB1: heavy compute, 5 min, 50 MB. JOB2: heavy I/O on the terminal, 15 min, 100 MB. JOB3: heavy I/O on disk and printer, 10 min, 75 MB. About 6 processor-minutes in all; the jobs barely interfere. Each utilization is the average share in use over the run: processor 6 / 30 = 20% versus 6 / 15 = 40%.</p>${/* notes paragraph: the three-job example and how each utilization is averaged */''}
    <table>${/* starts the three-job table */''}
      <tr><th>Measure</th><th>Uniprogramming</th><th>Multiprogramming</th></tr>${/* table header: measure, uniprogramming, multiprogramming */''}
      <tr><td>Processor use</td><td>20%</td><td>40%</td></tr>${/* table row: processor use, 20% versus 40% */''}
      <tr><td>Memory, disk, printer use</td><td>33% each</td><td>67% each</td></tr>${/* table row: memory, disk and printer use, 33% versus 67% */''}
      <tr><td>Elapsed time</td><td>30 min</td><td>15 min</td></tr>${/* table row: elapsed time, 30 versus 15 minutes */''}
      <tr><td>Throughput</td><td>6 jobs/hr</td><td>12 jobs/hr</td></tr>${/* table row: throughput, 6 versus 12 jobs per hour */''}
      <tr><td>Mean response time</td><td>18 min</td><td>10 min</td></tr>${/* table row: mean response time, 18 versus 10 minutes */''}
    </table>${/* ends the three-job table */''}
    <p>One at a time, the jobs finish at 5, 20 and 30 min: mean (5 + 20 + 30) / 3 ≈ 18 min. Together they finish at 5, 15 and 10: mean 10 min. Throughput: 3 jobs in 0.5 h = 6/h versus 3 in 0.25 h = 12/h.</p>${/* notes paragraph: how the mean response times and throughputs are worked out */''}
    <h3>Time-sharing systems</h3>${/* heading: time-sharing systems */''}
    <p>The processor's time is shared among many interactive users at terminals, each getting a short <b>time slice</b> in turn. With n users each sees about 1/n of the machine, yet responses feel quick because people are slow next to a computer.</p>${/* notes paragraph: time slices for many users, and why it still feels quick */''}
    <table>${/* starts the batch versus time-sharing table */''}
      <tr><th></th><th>Batch multiprogramming</th><th>Time sharing</th></tr>${/* table header: the two approaches */''}
      <tr><td>Principal objective</td><td>Maximize processor use</td><td>Minimize response time</td></tr>${/* table row: principal objective of each */''}
      <tr><td>Directives to the OS</td><td>JCL commands provided with the job</td><td>Commands entered at the terminal</td></tr>${/* table row: where each gets its directives */''}
    </table>${/* ends the comparison table */''}
    <p>Example: a 20 s job, four users needing 0.3 s each and your 0.1 s command arrive together. Run to completion, you wait 21.3 s. With 0.2 s slices you wait 1.1 s, and the long job ends at 21.3 s instead of 20 s: same work, better order. More users means longer rounds.</p>${/* notes paragraph: the response-time example with and without 0.2-second slices */''}
    <h4>CTSS (MIT, 1961; IBM 709, later 7094)</h4>${/* heading: CTSS, with where and when it was built */''}
    <ul>${/* starts the list of CTSS facts */''}
      <li>32,000 words of 36 bits; the monitor used 5,000, leaving 27,000. Every user program was loaded at word 5,000.</li>${/* list item: memory size, the monitor's share, and the fixed load address */''}
      <li>A clock interrupt about every 0.2 s let the OS regain control and switch users.</li>${/* list item: the clock interrupt about every 0.2 s */''}
      <li><b>Swapping:</b> the old user's program and data went to disk before the next was read in, and came back at its next turn. To cut disk traffic, only words the incoming program would overwrite were written out.</li>${/* list item: swapping only the words the incoming program would overwrite */''}
    </ul>${/* ends the list of CTSS facts */''}
    <p>Example: JOB1 10,000, JOB2 24,000, JOB3 4,000, JOB4 14,000 words, turns 1, 2, 3, 1, 4, 2. Small JOB3 displaces only 4,000 words of JOB2, and when JOB2 returns only its 14,000 missing words are read. Total: 128,000 words moved versus 148,000 for whole-program swapping.</p>${/* notes paragraph: the swapping example, 128,000 words moved versus 148,000 */''}
    <p><b>New problems:</b> protection among users, file system protection (authorized access only), and contention for resources such as printers and storage.</p>${/* notes paragraph: the new problems time sharing created */''}
  `,  // end of the notes text
});  // closes the section object and the call that registers it
