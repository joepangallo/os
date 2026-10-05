// Comment key: a line inside backtick text ends with ${/* comment */''}, an empty-string slot that holds a comment without changing the text on screen (full note at the top of the page).
/* Chapter metadata for the second volume (chapters 6-9): titles, colours, overview text and objectives.
   Section content lives in sections/<id>.js. */
Guide.chapter({  // registers chapter 6 with the guide; Guide.chapter (in the shell script) stores this object and adds its CSS to the page
  num: 6,  // num: the chapter number; it sets the chapter's order, its color (--ch6) and page addresses such as #ch6
  title: 'Concurrency: Deadlock and Starvation',  // title shown on the chapter card, the chapter overview page and the top-bar tooltip
  tagline: 'Locks keep shared data safe. Used carelessly, they can freeze everything. Here is how systems prevent, avoid, detect and recover from that.',  // tagline: the one-sentence hook printed in the chapter color at the top of the chapter overview page
  intro: '<p>Chapter 5 made processes take turns on shared data. This chapter looks at the failure that turn-taking can cause: a <span class="t">deadlock</span>, where a group of processes each hold something another one needs and all of them wait forever. It explains the four conditions that make a deadlock possible, then the three ways an operating system can respond: rule one condition out (<b>prevention</b>), check every request against a safe plan (<b>avoidance</b>), or let deadlocks happen and then find and break them (<b>detection and recovery</b>). The classic dining philosophers puzzle ties the ideas together, and the chapter closes with the synchronization tools real systems offer: UNIX, Linux, Solaris, Windows and Android.</p>',  // intro paragraph for the overview page; the span class="t" words are key terms that show a definition when pointed at
  objectives: [  // objectives: the list shown under "After this chapter you will be able to" on the overview page and in the printed guide
    'List the four conditions for deadlock and use a resource allocation graph to spot one.',  // objective 1: the four deadlock conditions and spotting one in a resource allocation graph
    'Explain how deadlock prevention removes one of the conditions, and what each choice costs.',  // objective 2: how prevention removes one condition, and the price of each choice
    'Run the banker’s algorithm to decide whether a state is safe and whether a request may be granted.',  // objective 3: use the banker's algorithm to judge whether a state is safe and a request may be granted
    'Detect a deadlock with a detection algorithm and choose a recovery strategy.',  // objective 4: find a deadlock with a detection algorithm and pick a way to recover
    'Solve the dining philosophers problem without deadlock or starvation.',  // objective 5: a dining philosophers solution free of both deadlock and starvation
    'Compare the concurrency mechanisms of UNIX, Linux, Solaris, Windows and Android.',  // objective 6: compare the concurrency tools of five real operating systems
  ],  // closes the objectives list
  terms: [  // terms: chapter-level glossary entries as [term, definition] pairs; a section's own definition wins if both exist
    ['Deadlock', 'A set of processes is permanently blocked because each one is waiting for an event, such as the release of a resource, that only another blocked member of the set can cause.'],  // glossary entry: defines deadlock
    ['Starvation', 'A process that is able to run is passed over again and again, indefinitely, even though the system as a whole keeps making progress.'],  // glossary entry: defines starvation, and how it differs from deadlock
    ['Reusable resource', 'A resource that one process at a time can use and that is not used up by being used, such as a processor, a memory region, a file or a device; it is released for others afterwards.'],  // glossary entry: defines a reusable resource (not used up, released after use)
    ['Consumable resource', 'A resource that is created by one process and destroyed when another process takes it, such as a message, a signal or an interrupt.'],  // glossary entry: defines a consumable resource (made by one process, destroyed when taken)
    ['Safe state', 'A state in which there is at least one order in which every process can be given everything it may still need and run to completion, so deadlock can always be avoided.'],  // glossary entry: defines a safe state, the idea behind deadlock avoidance
  ],  // closes the terms list
  css: ` /* css: style rules used only by chapter 6's overview steps; each rule starts with .sec-ch6, the class the canvas gets on these steps */
    .sec-ch6 .ch6-stage { display: grid; grid-template-columns: 150px minmax(0, 1fr) 150px; grid-template-areas: "p g q"; gap: 10px; align-items: center; } /* .ch6-stage: a three-column grid for step 1: P's program (150px), the graph in the middle, Q's program (150px); the areas are named p, g, q */
    .sec-ch6 .ch6-prog { border: 1px solid var(--line); border-radius: 10px; padding: 7px 8px; background: var(--panel-2); } /* .ch6-prog: the box around each process's program, with a thin border, rounded corners and a light fill */
    .sec-ch6 .ch6-prog.p { grid-area: p; border-top: 4px solid var(--proc); } /* P's program box sits in area p (left) and gets a thick top edge in process teal */
    .sec-ch6 .ch6-prog.q { grid-area: q; border-top: 4px solid var(--accent); } /* Q's program box sits in area q (right) and gets a thick top edge in the accent color */
    .sec-ch6 .ch6-graph { grid-area: g; min-width: 0; } /* .ch6-graph: the drawing goes in the middle area g; min-width 0 lets it shrink instead of pushing the columns apart */
    .sec-ch6 .ch6-prog ol { margin: 4px 0 0 !important; padding: 0 !important; list-style: none; display: flex; flex-direction: column; gap: 4px; } /* the numbered program list loses its usual bullets and indent, and stacks its lines with 4px gaps */
    .sec-ch6 .ch6-prog li { margin: 0 !important; font-size: 13.5px; line-height: 1.25; padding: 4px 7px; border-radius: 7px; border: 1px solid transparent; color: var(--muted); } /* each program line: small grey text in a rounded box with an invisible border, so highlighting it later does not shift it */
    .sec-ch6 .ch6-prog li.cur { color: var(--ink); font-weight: 750; border-color: var(--chc); background: color-mix(in srgb, var(--chc) 10%, var(--panel)); } /* .cur: the line the process will run next is drawn bold in dark ink with a chapter-colored outline and light tint */
    .sec-ch6 .ch6-prog li.cur.wait { border-color: var(--bad); background: var(--bad-bg); } /* a current line that is stuck waiting turns red instead, so the student sees which process is blocked */
    .sec-ch6 .ch6-prog li.done { color: var(--ink-2); text-decoration: line-through; text-decoration-color: var(--line-2); } /* .done: lines already run are struck through with a pale line */
    .sec-ch6 .ch6-cap { min-height: 76px; } /* .ch6-cap: the narration box keeps a minimum height so the buttons around it do not jump as the text changes */
    .sec-ch6 .ch6-cond { display: flex; gap: 10px; align-items: flex-start; padding: 6px 10px; border: 1px solid var(--line); border-left: 4px solid var(--line-2); border-radius: 10px; background: var(--panel-2); font-size: 14px; line-height: 1.32; } /* .ch6-cond: one row of the four-conditions card, with a tag on the left and a thick grey left edge */
    .sec-ch6 .ch6-cond.on { border-left-color: var(--bad); background: color-mix(in srgb, var(--bad) 7%, var(--panel)); } /* a condition that holds right now (class "on") gets a red left edge and a faint red tint */
    .sec-ch6 .ch6-cond .chip { flex: none; margin-top: 1px; min-width: 74px; justify-content: center; } /* the tag in each condition row keeps a fixed minimum width and centers its text, so the four tags line up */
    .sec-ch6 .ch6-map { display: flex; flex-direction: column; gap: 2px; font-size: 14px; line-height: 1.3; } /* .ch6-map: the chapter map card, its section rows stacked in a column with small text */
    .sec-ch6 .ch6-map div { display: flex; gap: 8px; padding: 2px 6px; border-radius: 6px; } /* each map row lays out the section number and its description side by side */
    .sec-ch6 .ch6-map div.on { background: color-mix(in srgb, var(--chc) 12%, var(--panel)); box-shadow: inset 3px 0 0 var(--chc); } /* the highlighted map row (class "on") gets a chapter-colored tint and a thin colored bar on its left */
    .sec-ch6 .ch6-map b { flex: none; width: 66px; color: var(--chc); } /* the section number in each map row is bold, chapter-colored and a fixed 66px wide so the descriptions line up */
    @media (max-width: 760px) { /* @media (max-width: 760px): these rules apply only on windows 760px wide or less */
      .sec-ch6 .ch6-stage { grid-template-columns: 1fr 1fr; grid-template-areas: "p q" "g g"; } /* on a small screen the two programs sit side by side on top and the graph takes the full width below */
    } /* ends the small-window rules */
    .sec-ch6 .ch6-case { border-left: 5px solid var(--chc); min-height: 118px; } /* .ch6-case: the case card in step 2, with a thick chapter-colored left edge and a minimum height so it does not jump */
    .sec-ch6 .ch6-case p { font-size: 17.5px; line-height: 1.45; margin: 4px 0 0; } /* the case text itself is large and well spaced so it reads like a short story */
    .sec-ch6 .ch6-pick { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; } /* .ch6-pick: the four answer buttons in a two-by-two grid */
    .sec-ch6 .ch6-opt { display: flex; flex-direction: column; align-items: flex-start; gap: 1px; text-align: left; padding: 7px 11px; border: 1px solid var(--line); border-radius: 10px; background: var(--panel-2); color: var(--ink); cursor: pointer; font: inherit; } /* .ch6-opt: one answer button: a bold name over a short description, left-aligned, with a border and light fill */
    .sec-ch6 .ch6-opt:hover { border-color: var(--chc); } /* hovering an answer button outlines it in the chapter color */
    .sec-ch6 .ch6-opt b { font-size: 15.5px; } /* the strategy name inside an answer button is a little larger */
    .sec-ch6 .ch6-opt span { font-size: 13px; color: var(--muted); line-height: 1.3; } /* the one-line description under the name is small and grey */
    .sec-ch6 .ch6-opt.ok { border-color: var(--ok); background: var(--ok-bg); } /* .ok: the student's pick was right, so the button turns green */
    .sec-ch6 .ch6-opt.bad { border-color: var(--bad); background: var(--bad-bg); } /* .bad: the student's pick was wrong, so the button turns red */
    .sec-ch6 .ch6-fb { min-height: 96px; } /* .ch6-fb: the feedback callout keeps a minimum height so the layout stays still between answers */
    .sec-ch6 .ch6-tiles { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; } /* .ch6-tiles: the ten numbered case tiles on the right, five per row */
    .sec-ch6 .ch6-tile { height: 40px; border: 1px solid var(--line); border-radius: 9px; background: var(--panel-2); color: var(--ink); font-weight: 800; font-size: 14px; cursor: pointer; } /* .ch6-tile: one case tile, a 40px bold button with rounded corners; clicking it jumps to that case */
    .sec-ch6 .ch6-tile.on { box-shadow: 0 0 0 2px var(--chc); } /* the tile of the case on screen gets a chapter-colored ring */
    .sec-ch6 .ch6-tile.ok { background: var(--ok-bg); border-color: var(--ok); color: var(--ok); } /* a tile whose case was answered correctly turns green */
    .sec-ch6 .ch6-tile.bad { background: var(--bad-bg); border-color: var(--bad); color: var(--bad); } /* a tile whose case was answered wrongly turns red */
    .sec-ch6 table.tbl.ch6-sheet td, .sec-ch6 table.tbl.ch6-sheet th { font-size: 13px; line-height: 1.3; vertical-align: top; } /* the strategy summary table uses smaller text and lines up each cell's text at the top */
    .sec-ch6 .ch6-sheet tr.on td { background: var(--ok-bg); } /* the row for the strategy that matches the current right answer is tinted green */
    @media (max-width: 760px) { /* @media (max-width: 760px): these rules apply only on windows 760px wide or less */
      .sec-ch6 .ch6-pick { grid-template-columns: minmax(0, 1fr); } /* on a small screen the answer buttons stack in a single column */
      .sec-ch6 table.tbl.ch6-sheet td, .sec-ch6 table.tbl.ch6-sheet th { font-size: 12px; letter-spacing: 0; padding-left: 3px; padding-right: 3px; } /* and the summary table shrinks its text and side padding so all four columns fit */
    } /* ends the small-window rules */
  `,  // end of chapter 6's CSS text
  steps: [  // steps: the chapter's own overview steps, shown right after the chapter page and before section 6.1
    {  // step 1 of the chapter 6 overview
      title: 'Two locks, opposite orders',  // title shown at the top of step 1
      kind: 'story',  // kind "story" labels the step "Big Picture" and keeps it on the shorter core path
      render(el, ctx) {  // render(el, ctx): builds the step when it is shown; el is the empty step area, ctx holds the shell's helpers
        const { h, s } = ctx;  // h builds HTML elements and s builds SVG (the browser's drawing format) elements from a tag, settings and children
        // each program line: [what it says, what it does]; null = ordinary work, 'free' = unlock everything held
        const P_PROG = [['load a page', null], ['lock printer', 'printer'], ['lock scanner', 'scanner'], ['copy the page', null], ['unlock both', 'free']];  // P_PROG: process P's five-line program; it locks the printer first, then the scanner
        const Q_OPP = [['load a form', null], ['lock scanner', 'scanner'], ['lock printer', 'printer'], ['print, then scan', null], ['unlock both', 'free']];  // Q_OPP: process Q's program in the "opposite orders" setting: scanner first, then printer
        const Q_SAME = [['load a form', null], ['lock printer', 'printer'], ['lock scanner', 'scanner'], ['print, then scan', null], ['unlock both', 'free']];  // Q_SAME: Q's program after the fix: the same order as P, printer first, then scanner
        const W = ['P', 'Q'], RES = ['printer', 'scanner'], LAST = P_PROG.length;  // W: the two process names; RES: the two devices; LAST: the number of program lines, so pc = LAST means finished
        let order = 'opposite', S, gen = 0, seed = 1, trials = { n: 0, dead: 0 }, story = '';  // step state: the lock-order setting, the live state S, a run counter gen, the next random seed, batch totals and the narration text
        const prog = (w) => (w === 'P' ? P_PROG : order === 'opposite' ? Q_OPP : Q_SAME);  // prog(w): the program process w follows; Q's depends on the lock-order switch
        const fresh = () => ({ pc: { P: 0, Q: 0 }, held: { printer: null, scanner: null }, wait: { P: null, Q: null } });  // fresh(): a brand-new state: both program counters at line 0, both devices free, nobody waiting
        const other = (w) => (w === 'P' ? 'Q' : 'P');  // other(w): the name of the other process
        const done = (st, w) => st.pc[w] >= LAST;  // done(st, w): true once process w has run past its last line
        const runnable = (st, w) => !done(st, w) && !st.wait[w];  // runnable(st, w): w can take a step only if it has not finished and is not waiting for a device
        const holds = (st, w) => RES.filter((r) => st.held[r] === w);  // holds(st, w): the list of devices process w has locked right now
        const finished = (st) => W.every((w) => done(st, w));  // finished(st): true when both processes have run to the end
        const frozen = (st) => !finished(st) && W.every((w) => done(st, w) || st.wait[w]);  // frozen(st): true when the run is not over yet but nobody can move, because each one is finished or waiting
        const circular = (st) => W.every((w) => st.wait[w] && st.held[st.wait[w]] === other(w));  // circular(st): true when each process waits for a device the other one holds, the closed loop of a deadlock
        const holdWait = (st) => W.filter((w) => st.wait[w] && holds(st, w).length);  // holdWait(st): the processes that are waiting while still holding a device (the "hold and wait" condition)
        // one program line of process w, applied to state st; returns a sentence saying what happened
        function move(st, w) {  // move(st, w): runs one line of w's program on st and returns the narration sentence
          const [label, op] = prog(w)[st.pc[w]];  // looks up w's current line: label is the text shown, op says what the line does
          if (op === null) { st.pc[w]++; return `${w} does ordinary work: <b>${label}</b>.`; }  // an ordinary line just moves the program counter on and reports the work done
          if (op === 'free') {  // an "unlock both" line:
            const had = holds(st, w), o = other(w), wake = st.wait[o] && had.includes(st.wait[o]) ? st.wait[o] : null;  // had: the devices w holds; o: the other process; wake: the device o waits for, if w is about to release it
            had.forEach((r) => { st.held[r] = null; });  // releases every device w holds
            st.pc[w]++;  // moves w past its last line, so it counts as finished
            if (wake) { st.wait[o] = null; return `${w} unlocks both devices and finishes. ${o} was waiting for the ${wake}; it is free now, so ${o} can try again.`; }  // if the other process was waiting for one of these devices, it stops waiting and the sentence says it can try again
            return `${w} unlocks both devices and finishes.`;  // otherwise the sentence just says w finished
          }  // ends the unlock case
          if (st.held[op] === null) { st.held[op] = w; st.pc[w]++; return `${w} locks the <b>${op}</b>.`; }  // a lock line on a free device: w takes it, moves on and the sentence says so
          st.wait[w] = op;  // the device is locked by the other process, so w is marked as waiting for it and its program counter stays put
          return `${w} asks for the ${op}, but ${st.held[op]} holds it, so <b>${w} must wait</b>.`;  // returns the sentence saying who holds the device and that w must wait
        }  // ends move()
        // the conditions that the state st now shows, as extra narration
        function news(st) {  // news(st): extra narration added after each move, naming the deadlock condition the new state shows, if any
          if (finished(st)) return order === 'same' ? ' <b>Both processes finished.</b> With one agreed lock order, a loop of waits cannot form: this rule (resource ordering) prevents deadlock by design, as 6.2 shows.' : ' <b>Both processes finished.</b> No deadlock this time, but only because of the order you chose.';  // both finished: with the shared order the sentence credits resource ordering; with opposite orders it calls the success luck
          if (circular(st)) return ' P waits for a device Q holds, and Q waits for a device P holds: that loop is <span class="t">circular wait</span>. All four conditions hold at once, so this is a <b>deadlock</b>. Neither process can ever move again.';  // a closed loop of waits: the sentence names circular wait and announces the deadlock
          const hw = holdWait(st);  // hw: the processes now holding one device while waiting for the other
          if (hw.length) return ` ${hw[0]} keeps the ${holds(st, hw[0])[0]} while it waits: that is <span class="t">hold and wait</span>.`;  // if any, the sentence points out hold and wait, naming the process and the device it keeps
          return '';  // no condition worth mentioning: no extra narration
        }  // ends news()
        const caption = h('div', { class: 'player-cap ch6-cap', 'aria-live': 'polite' });  // caption: the narration box under the drawing; aria-live makes screen readers read each new sentence aloud
        const lists = { P: h('ol'), Q: h('ol') };  // lists: one numbered list per process, filled with its program lines by draw()
        const svg = s('svg', { viewBox: '0 0 340 236', width: '100%', role: 'img', 'aria-label': 'Resource allocation graph for P and Q' });  // svg: the resource allocation graph, a 340 x 236 drawing that stretches to its column; the label describes it for screen readers
        const condBox = h('div', { class: 'stack', style: { gap: '6px' } });  // condBox: the column that holds the four condition rows, refilled by draw()
        const mapBox = h('div', { class: 'ch6-map' });  // mapBox: the chapter map card's body, refilled by draw()
        const trialTxt = h('span', { class: 'small' });  // trialTxt: the result line next to the "Run 1,000 random schedules" button
        const btn = {};  // btn: will hold the two "Run P's next line" and "Run Q's next line" buttons, made further down
        // draws one edge between a process anchor and a resource anchor
        const edge = (x1, y1, x2, y2, kind, hot) => s('line', { x1, y1, x2, y2, class: 's-line', 'stroke-width': hot ? 3.5 : 2.2, 'stroke-dasharray': kind === 'req' ? '7 5' : null,  // edge(...): draws one arrow from (x1, y1) to (x2, y2); a request edge is dashed amber, a holding edge solid, and both turn thick red when hot
          style: hot ? 'stroke:var(--bad)' : kind === 'req' ? 'stroke:var(--warn)' : '', 'marker-end': hot ? 'url(#arr-bad)' : kind === 'req' ? 'url(#arr-warn)' : 'url(#arr)' });  // the color and arrowhead: red for a deadlock loop, amber for a request, the default ink color for a held device
        const ANCH = { P: { printer: [66, 100, 122, 52], scanner: [66, 136, 122, 184] }, Q: { printer: [274, 100, 218, 52], scanner: [274, 136, 218, 184] } };  // ANCH: the start and end points of each possible arrow, [process x, process y, device x, device y], so arrows meet the shapes' edges
        function draw() {  // draw(): redraws everything from the current state S after every move, reset or switch
          const cyc = circular(S), kids = [];  // cyc: whether the state is a deadlock loop (its arrows are drawn red); kids collects the shapes for the drawing
          W.forEach((w) => RES.forEach((r) => {  // looks at every process and device pair
            const [px, py, rx, ry] = ANCH[w][r];  // reads the two end points for this pair
            if (S.held[r] === w) kids.push(edge(rx, ry, px, py, 'asg', cyc));  // a device held by w gets a solid arrow from the device to w (an assignment edge)
            if (S.wait[w] === r) kids.push(edge(px, py, rx, ry, 'req', cyc));  // a device w waits for gets a dashed arrow from w to the device (a request edge)
          }));  // ends the loop over pairs
          RES.forEach((r, i) => {  // draws the two device boxes
            const y = i ? 176 : 10;  // the printer box sits at the top of the drawing, the scanner box at the bottom
            kids.push(s('rect', { x: 122, y, width: 96, height: 50, rx: 8, class: 's-io', 'stroke-width': 2 }),  // the device box itself, filled in I/O orange
              s('text', { x: 170, y: y + 21, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800 }, r),  // the device name in bold, centered in the box
              s('text', { x: 170, y: y + 40, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, S.held[r] ? 'held by ' + S.held[r] : 'free'));  // a small grey line under it: who holds the device, or "free"
          });  // ends the loop over devices
          W.forEach((w, i) => {  // draws the two process circles
            const cx = i ? 300 : 40, st = done(S, w) ? ['finished'] : S.wait[w] ? ['waits for', S.wait[w]] : ['can run'];  // P sits at the left (x 40) and Q at the right (x 300); st holds the status lines printed under each circle
            kids.push(s('circle', { cx, cy: 118, r: 30, class: i ? 's-accent' : 's-proc', 'stroke-width': S.wait[w] ? 4 : 2, style: S.wait[w] ? 'stroke:var(--bad)' : '' }),  // the circle: teal for P, accent color for Q; a waiting process gets a thick red outline
              s('text', { x: cx, y: 124, 'text-anchor': 'middle', 'font-size': 18, 'font-weight': 800 }, w),  // the process letter in the middle of the circle
              ...st.map((line, k) => s('text', { x: cx, y: 166 + k * 16, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, style: S.wait[w] ? 'fill:var(--bad)' : '' }, line)));  // the status lines under the circle (finished, can run, or waits for a device), red while the process waits
          });  // ends the loop over processes
          svg.replaceChildren(...kids);  // swaps the old drawing's shapes for the new ones in one go
          W.forEach((w) => lists[w].replaceChildren(...prog(w).map(([label], k) => h('li', { class: k < S.pc[w] ? 'done' : k === S.pc[w] ? 'cur' + (S.wait[w] ? ' wait' : '') : '' }, (k + 1) + '. ' + label))));  // rebuilds both program lists: lines already run are struck through, the next line is highlighted, red if it is blocked
          W.forEach((w) => { btn[w].disabled = !runnable(S, w); });  // greys out the Run button of any process that cannot take a step now
          const hw = holdWait(S), cw = circular(S);  // hw and cw: the hold-and-wait processes and whether there is a circular wait, for the conditions card
          const COND = [  // COND: the four deadlock conditions, each as [name, description, tag text, tag color]
            ['Mutual exclusion', 'Each device serves one process at a time.', 'always', 'warn'],  // mutual exclusion: always true here, so its tag always reads "always" in amber
            ['Hold and wait', hw.length ? `${hw.join(' and ')} ${hw.length > 1 ? 'hold' : 'holds'} one device while waiting for the other.` : 'A process keeps what it has while it waits for more.', hw.length ? 'now' : 'not now', hw.length ? 'bad' : ''],  // hold and wait: names the process (or both) doing it right now and tags it "now" in red, otherwise "not now"
            ['No preemption', 'The OS never takes a device away from a process.', 'always', 'warn'],  // no preemption: also always true here, because this OS never takes a device back
            ['Circular wait', cw ? 'P waits for Q, and Q waits for P: a closed loop.' : 'A closed loop of processes, each waiting for the next.', cw ? 'now' : 'not now', cw ? 'bad' : ''],  // circular wait: describes the P-to-Q loop and tags it "now" in red when it exists
          ];  // closes the COND list
          condBox.replaceChildren(...COND.map(([name, d, tag, cls]) => h('div', { class: 'ch6-cond' + (cls === 'bad' ? ' on' : '') },  // refills the conditions card with one row per condition; a row whose tag is red gets the "on" class and a red edge
            h('span', { class: 'chip ' + cls }, tag), h('span', {}, h('b', {}, name), ' ', h('span', { class: 'muted' }, d)))));  // each row: the colored tag, then the condition name in bold and its description in grey
          const MAP = [['6.1', 'Principles: the four conditions, allocation graphs'], ['6.2', 'Prevention: design one condition out'], ['6.3', 'Avoidance: the banker checks each request'], ['6.4', 'Detection: find a deadlock, then recover'], ['6.5', 'An integrated strategy for mixed resources'], ['6.6', 'Dining philosophers: the classic test'], ['6.7–6.11', 'UNIX, Linux, Solaris, Windows, Android']];  // MAP: the chapter's sections as [number, one-line summary], shown in the chapter map card
          const hot = order === 'same' ? '6.2' : cw ? '6.1' : null;  // hot: the map row to highlight: 6.2 (prevention) once the fix is on, 6.1 when a deadlock has just formed, otherwise none
          mapBox.replaceChildren(...MAP.map(([n, d]) => h('div', { class: n === hot ? 'on' : '' }, h('b', {}, n), h('span', {}, d))));  // refills the map card with one row per section, the hot row tinted
          caption.innerHTML = story;  // puts the current narration into the caption box
          ctx.refit();  // asks the shell to re-check that the step still fits now that the text has changed
        }  // ends draw()
        function reset(msg) {  // reset(msg): starts a fresh run, with msg (or a default message) as the narration
          gen++; S = fresh();  // gen++ cancels any random schedule still playing (its timer sees a newer number and stops); S gets a new starting state
          story = msg || (order === 'opposite' ? 'P and Q both need the printer and the scanner, but they lock them in <b>opposite orders</b>. Choose who runs next, one line at a time. Can you make them freeze?' : '<b>Fix applied:</b> both processes now lock the printer first, then the scanner. Try every order you like: nobody can hold the scanner while waiting for the printer, so no loop can form.');  // default narration: a challenge to make the processes freeze, or, with the fix on, an invitation to try every order
          draw();  // draws the fresh state
        }  // ends reset()
        function stepBy(w) {  // stepBy(w): runs process w's next line when a button is clicked or the random schedule picks it
          if (!runnable(S, w)) return;  // does nothing if w is finished or waiting
          story = move(S, w); story += news(S);  // runs the line and builds the narration: what happened plus any condition it reveals
          draw();  // redraws everything
        }  // ends stepBy()
        // plays one random schedule, a line every 650 ms, until the run finishes or freezes; Reset cancels it
        function play() {  // play(): runs when "Play a random schedule" is clicked
          reset('A random schedule: at every moment one of the processes that can run is picked at random.');  // starts a fresh run with a narration that explains how the schedule is chosen
          const g = gen, rng = ctx.util.seeded(seed++);  // g remembers this run's number so a later reset can stop it; rng is a seeded random generator, a new seed each time
          const tick = () => {  // tick(): one beat of the schedule
            if (g !== gen || !ctx.alive) return;  // stops quietly if a newer run has started or the student has left the step
            const can = W.filter((w) => runnable(S, w));  // can: the processes able to take a step right now
            if (!can.length) return;  // if neither can move, the run is over
            stepBy(can[Math.floor(rng() * can.length)]);  // picks one of them at random and runs its next line
            if (!finished(S) && !frozen(S)) ctx.after(650, tick);  // unless the run has finished or frozen, schedules the next beat 650 ms later
          };  // ends tick()
          ctx.after(500, tick);  // the first beat comes half a second after the click
        }  // ends play()
        // the same engine, run 1,000 times without drawing, to count how often a random schedule freezes
        function manyRuns() {  // manyRuns(): runs when "Run 1,000 random schedules" is clicked
          const rng = ctx.util.seeded(1000 + trials.n);  // a seeded generator whose seed depends on how many runs came before, so each batch is different but repeatable
          let dead = 0;  // dead counts the runs in this batch that froze
          for (let t = 0; t < 1000; t++) {  // repeats 1,000 times
            const st = fresh();  // each run starts from a fresh state of its own, separate from the one on screen
            for (let guard = 0; guard < 40 && !finished(st) && !frozen(st); guard++) {  // keeps moving until the run finishes or freezes; guard caps it at 40 moves as a safety limit
              const can = W.filter((w) => runnable(st, w));  // the processes that can move now
              move(st, can[Math.floor(rng() * can.length)]);  // one of them, chosen at random, runs its next line
            }  // ends the moves of this run
            if (frozen(st)) dead++;  // a run that ended frozen is counted as a deadlock
          }  // ends the 1,000 runs
          trials.n += 1000; trials.dead += dead;  // adds this batch to the running totals for the current lock order
          trialTxt.innerHTML = `This batch: <b>${dead}</b> of 1,000 froze. All batches with this lock order: <b>${trials.dead.toLocaleString('en-US')}</b> of ${trials.n.toLocaleString('en-US')} (${ctx.util.fmt((100 * trials.dead) / trials.n, 1)}%).`;  // shows this batch's count, the overall count and the percentage that froze; toLocaleString adds thousands commas
          ctx.refit();  // re-checks that the step still fits after the result text changed
        }  // ends manyRuns()
        W.forEach((w) => { btn[w] = h('button', { class: 'btn sm ' + (w === 'P' ? 'proc' : ''), type: 'button', onclick: () => { gen++; stepBy(w); } }, `Run ${w}’s next line`); });  // makes the two Run buttons (P's in process teal); a click stops any random schedule, then runs that process's next line
        const seg = ctx.ui.seg([{ value: 'opposite', label: 'Opposite orders' }, { value: 'same', label: 'Same order (the fix)' }], order, (v) => { order = v; trials = { n: 0, dead: 0 }; trialTxt.textContent = 'How often does a random schedule freeze?'; reset(); });  // seg: the lock-order switch; choosing an order clears the batch totals and the result line, then resets the run
        trialTxt.textContent = 'How often does a random schedule freeze?';  // the result line starts with the question the batch button answers
        el.append(h('div', { class: 'split r fill' },  // puts the step on screen: two columns, the larger one on the left (split r), filling the step's height
          h('div', { class: 'stack', style: { gap: '10px' } },  // left column: the controls, the stage, the buttons, the narration and the batch line, stacked 10px apart
            h('div', { class: 'row' }, h('span', { class: 'small b' }, 'Lock order:'), seg),  // top row: the "Lock order:" label and the opposite/same switch
            h('div', { class: 'ch6-stage' }, h('div', { class: 'ch6-prog p' }, h('div', { class: 'small b' }, 'Process P'), lists.P), h('div', { class: 'ch6-graph' }, svg, h('div', { class: 'xs muted center', html: '<b>Solid arrow:</b> device → the process that holds it.<br><b>Dashed arrow:</b> process → the device it waits for.' })), h('div', { class: 'ch6-prog q' }, h('div', { class: 'small b' }, 'Process Q'), lists.Q)),  // the stage: P's program on the left, the graph with its arrow legend in the middle, Q's program on the right
            h('div', { class: 'row' }, btn.P, btn.Q, h('button', { class: 'btn sm primary', type: 'button', onclick: play }, 'Play a random schedule'), h('button', { class: 'btn sm ghost', type: 'button', onclick: () => reset() }, 'Reset')),  // button row: Run P, Run Q, "Play a random schedule" (the main action) and a quiet Reset button
            caption,  // the narration box
            h('div', { class: 'row nw' }, h('button', { class: 'btn sm', type: 'button', style: { flex: 'none' }, onclick: manyRuns }, 'Run 1,000 random schedules'), trialTxt)),  // bottom row (never wrapping): the "Run 1,000 random schedules" button and its result text; ends the left column
          h('div', { class: 'stack', style: { gap: '10px' } },  // right column: two cards stacked 10px apart
            h('div', { class: 'card tight stack', style: { gap: '6px' } }, h('h4', { class: 'm0', html: 'The four conditions for <span class="t">deadlock</span>' }), condBox),  // card: the four deadlock conditions, with their live "now / not now / always" tags
            h('div', { class: 'card tight' }, h('h4', { class: 'm0', style: { marginBottom: '4px' } }, 'The chapter map: four answers, then real systems'), mapBox))));  // card: the chapter map; ends the right column and the step's layout
        reset();  // shows the starting state as soon as the step opens
      },  // ends render() for step 1
    },  // closes step 1
    {  // step 2 of the chapter 6 overview
      title: 'Prevent, avoid or detect?',  // title shown at the top of step 2
      kind: 'explore',  // kind "explore" labels the step "Explore"
      render(el, ctx) {  // render(el, ctx): builds step 2 when it is shown
        const { h } = ctx;  // h is the helper that builds HTML elements
        const OPTS = [  // OPTS: the four answer buttons as [key, name, one-line description]
          ['prev', 'Prevention', 'A rule fixed in advance makes one of the four conditions impossible.'],  // answer: prevention, a rule set in advance
          ['avoid', 'Avoidance', 'Each request is checked, as it comes, against what processes may still claim.'],  // answer: avoidance, a check made at each request
          ['detect', 'Detection and recovery', 'Grant freely, look for a deadlock now and then, and break it.'],  // answer: detection and recovery, find it afterwards and break it
          ['starve', 'Starvation, not deadlock', 'Nothing is frozen; one process just keeps losing.'],  // the trap answer: starvation, a different problem from deadlock
        ];  // closes the OPTS list
        const NAME = Object.fromEntries(OPTS.map(([k, n]) => [k, n]));  // NAME: looks up an answer's full name from its key, e.g. NAME.prev is "Prevention"
        const CASES = [  // CASES: the ten short cases; a is the right answer's key, t is the case text, why is the explanation shown when answered right
          { a: 'prev', t: 'Every resource type gets a number. A process may only request a resource whose number is higher than that of every resource it already holds.', why: 'A fixed rule, decided before anything runs, means a chain of waits can only climb in number, so it can never loop back: circular wait is designed out. This is resource ordering (6.2).' },  // case 1 (prevention): number the resources and request them in increasing order, which rules out circular wait
          { a: 'avoid', t: 'Before it starts, each process declares the most it will ever need of each resource. A request is granted only if, afterwards, there is still some order in which every process could finish.', why: 'Checking every request against declared maximum claims, and granting it only if the result is a safe state, is avoidance: the banker’s algorithm (6.3).' },  // case 2 (avoidance): declared maximum needs, and a request granted only if every process can still finish
          { a: 'detect', t: 'Requests are granted whenever the resources are free. Every half hour the OS runs an algorithm that marks each process that could still finish, then aborts the unmarked ones.', why: 'Nothing is refused in advance. The OS looks for deadlocked processes after the fact and then breaks the deadlock: detection and recovery (6.4).' },  // case 3 (detection): grant freely, check every half hour, abort the processes that cannot finish
          { a: 'prev', t: 'A process must request every resource it will need in a single request, and it does not start until all of them can be granted together.', why: 'If everything arrives at once, no process ever holds one resource while waiting for another: hold and wait is ruled out by design (6.2). The price is resources held long before they are used.' },  // case 4 (prevention): ask for everything at once, which rules out hold and wait
          { a: 'starve', t: 'A low-priority report job is ready to run, but higher-priority jobs keep arriving. Hours later the system is still busy, and the report has not started.', why: 'No group of processes is stuck waiting on each other; the system keeps making progress. One ready process is simply passed over again and again: that is <span class="t">starvation</span>.' },  // case 5 (starvation): a low-priority job that never gets its turn while the system stays busy
          { a: 'detect', t: 'A database spots a cycle in its wait-for graph. It rolls one transaction back to its last checkpoint and restarts it, which releases that transaction’s locks.', why: 'The cycle was found after it formed, then broken by rolling back a victim to a checkpoint: detection and recovery (6.4).' },  // case 6 (detection): a database finds a cycle in its wait-for graph and rolls one transaction back
          { a: 'prev', t: 'A process that holds a tape drive asks for a printer that is busy. The OS makes it give up the tape drive and request both again later.', why: 'Making a waiting process release what it holds removes the no-preemption condition. It is a rule applied every time, not a calculation about the future: prevention (6.2).' },  // case 7 (prevention): a waiting process must give up what it holds, which removes no preemption
          { a: 'avoid', t: 'Two buffers are free and a process asks for two. The OS refuses for now, because granting the request could leave a state in which some processes might never finish.', why: 'The request could be met right now, but it leads to an unsafe state. Refusing requests that would lead to an unsafe state is avoidance (6.3).' },  // case 8 (avoidance): a request that could be met is refused because it leads to an unsafe state
          { a: 'prev', t: 'Five philosophers share five forks around a table, but only four of them are allowed to sit down at the same time.', why: 'With at most four diners and five forks, at least one diner can always get both forks, so the circle of waits can never close. The limit is part of the design: it prevents circular wait (6.6).' },  // case 9 (prevention): only four of five philosophers may sit, so the circle of waits can never close
          { a: 'starve', t: 'Philosophers pick up both forks in one step, and only when both are free. One philosopher’s two neighbours keep eating in overlapping turns, so its forks are never both free at once, although the table never freezes.', why: 'The table keeps moving, so this is not deadlock. One process is endlessly unlucky: starvation. Section 6.6 shows that a solution can be deadlock-free and still allow it.' },  // case 10 (starvation): a philosopher whose neighbours keep eating, so it never gets both forks
        ];  // closes the CASES list
        const ans = CASES.map(() => null);  // ans: the student's answer for each case, null until one is picked
        let cur = 0;  // cur: the number of the case on screen, counting from 0
        const caseCard = h('div', { class: 'card white ch6-case', 'aria-live': 'polite' });  // caseCard: the white card showing the case text; aria-live makes screen readers read each new case
        const fb = h('div', { class: 'callout m0 small ch6-fb' });  // fb: the feedback callout under the answer buttons
        const optBtns = OPTS.map(([k, n, d]) => h('button', { class: 'ch6-opt', type: 'button', onclick: () => { ans[cur] = k; paint(); } }, h('b', {}, n), h('span', {}, d)));  // optBtns: the four answer buttons; clicking one records it as the answer to the current case and repaints
        const tiles = h('div', { class: 'ch6-tiles' });  // tiles: the grid of ten numbered case tiles
        const score = h('span', { class: 'big' });  // score: the large "right" count at the top of the right column
        const sheetRows = {};  // sheetRows: the three table rows by strategy key, kept so paint() can highlight one
        const SHEET = [  // SHEET: the summary table's rows as [key, strategy, when it acts, what it must know, main cost]
          ['prev', 'Prevention', 'At design time, before any request', 'Nothing about the future', 'Resources often idle or held too early'],  // row for prevention: acts at design time, needs no knowledge of the future, often leaves resources idle
          ['avoid', 'Avoidance', 'At every request', 'Each process’s maximum claim', 'A check per request; some grantable requests must wait'],  // row for avoidance: acts on every request, needs each maximum claim, makes some requests wait
          ['detect', 'Detection', 'Now and then, after granting', 'Only the current state', 'Lost work when a victim is rolled back'],  // row for detection: acts now and then, needs only the current state, can lose work
        ];  // closes the SHEET list
        const sheet = h('table', { class: 'tbl compact ch6-sheet' },  // sheet: the summary table, compact and with the chapter's smaller text
          h('thead', {}, h('tr', {}, h('th', {}, 'Strategy'), h('th', {}, 'Acts when'), h('th', {}, 'Needs to know'), h('th', {}, 'Main cost'))),  // header row: Strategy, Acts when, Needs to know, Main cost
          h('tbody', {}, ...SHEET.map(([k, ...cells]) => (sheetRows[k] = h('tr', {}, ...cells.map((c, i) => h('td', {}, i ? c : h('b', {}, c))))))));  // one body row per strategy, each saved in sheetRows; the first cell (the name) is bold
        const nextOpen = () => { for (let k = 1; k <= CASES.length; k++) { const j = (cur + k) % CASES.length; if (ans[j] !== CASES[j].a) return j; } return (cur + 1) % CASES.length; };  // nextOpen(): the next case after the current one that is not yet right, wrapping round; if all are right, simply the next case
        function paint() {  // paint(): redraws the case, the buttons, the feedback, the tiles, the score and the table highlight after every click
          const c = CASES[cur], a = ans[cur], ok = a === c.a;  // c is the current case, a the student's answer to it, ok whether that answer is right
          caseCard.innerHTML = `<div class="xs muted b">CASE ${cur + 1} OF ${CASES.length}</div><p>${c.t}</p>`;  // fills the case card with "CASE n OF 10" in small grey capitals and the case text
          optBtns.forEach((b, i) => { const k = OPTS[i][0]; b.classList.toggle('ok', a === k && ok); b.classList.toggle('bad', a === k && !ok); b.setAttribute('aria-pressed', String(a === k)); });  // marks the picked button green if right or red if wrong, and tells screen readers which one is pressed
          fb.className = 'callout m0 small ch6-fb ' + (a === null ? '' : ok ? 'tip' : 'bad');  // sets the feedback box's color: plain before an answer, green tip if right, red if wrong
          fb.setAttribute('data-label', a === null ? 'Your call' : ok ? 'Right: ' + NAME[c.a] : 'Not quite');  // the feedback box's small label: "Your call", "Right: " plus the strategy, or "Not quite"
          fb.innerHTML = a === null ? 'Read the case, then pick the strategy it describes. One choice is not a deadlock strategy at all: it names a different problem.'  // feedback text, before an answer: the instruction, with a warning that one choice names a different problem
            : ok ? c.why  // right answer: the case's own explanation
            : a === 'starve' ? 'Here processes really are stuck waiting on each other, or the rule is there to stop that. Look again at when the OS acts.'  // wrongly picked starvation: a hint that here something really is stuck, or a rule stops it
            : c.a === 'starve' ? 'No group of processes is frozen in this case. Is anything actually stuck for good, or is one process just losing every time?'  // the case was starvation but a strategy was picked: a hint to ask whether anything is truly stuck
            : `${NAME[a]} would ${a === 'prev' ? 'impose a fixed rule before anything happens' : a === 'avoid' ? 'check each request against declared maximum claims' : 'let the deadlock happen, find it later and break it'}. Is that what this OS does? Look at <b>when</b> it acts and <b>what it needs to know</b>.`;  // any other wrong pick: says what the chosen strategy would do and asks the student to check when it acts and what it needs
          tiles.replaceChildren(...CASES.map((x, i) => {  // rebuilds the ten case tiles
            const st = ans[i] === null ? '' : ans[i] === x.a ? ' ok' : ' bad';  // st: the tile's color class: none if unanswered, ok if right, bad if wrong
            return h('button', { class: 'ch6-tile' + st + (i === cur ? ' on' : ''), type: 'button', 'aria-label': `Case ${i + 1}`, onclick: () => { cur = i; paint(); } }, (st === ' ok' ? '✓ ' : st === ' bad' ? '✗ ' : '') + (i + 1));  // each tile shows its number, with a check or cross mark once answered; clicking it opens that case
          }));  // ends the tiles
          score.textContent = `${CASES.filter((x, i) => ans[i] === x.a).length} / ${CASES.length}`;  // the score: how many cases are answered right, out of ten
          Object.entries(sheetRows).forEach(([k, r]) => r.classList.toggle('on', ok && c.a === k));  // highlights the table row of the right strategy, but only after the student has answered this case correctly
          ctx.refit();  // re-checks that the step still fits
        }  // ends paint()
        el.append(h('div', { class: 'split r fill' },  // puts step 2 on screen: two columns, the larger one on the left
          h('div', { class: 'stack', style: { gap: '10px' } },  // left column, stacked 10px apart:
            caseCard, h('div', { class: 'ch6-pick' }, ...optBtns), fb,  // the case card, the grid of answer buttons and the feedback box
            h('div', { class: 'row' }, h('button', { class: 'btn sm primary', type: 'button', onclick: () => { cur = nextOpen(); paint(); } }, 'Next case ▶'), h('span', { class: 'xs muted' }, 'Cases you got wrong come round again.')),  // "Next case" button (jumps to the next case not yet right) with a note that missed cases come round again
            h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'Starvation is not a small deadlock. In a deadlock nobody in the group can ever move; under starvation the system keeps working and one process is always passed over.' })),  // amber "Common mistake" callout: starvation is not a small deadlock; ends the left column
          h('div', { class: 'stack', style: { gap: '10px' } },  // right column, stacked 10px apart:
            h('div', { class: 'row', style: { alignItems: 'baseline' } }, score, h('span', { class: 'small b' }, 'right'),  // a row with the big score and the word "right"
              h('button', { class: 'btn sm', type: 'button', style: { marginLeft: 'auto', alignSelf: 'center' }, onclick: () => { ans.fill(null); cur = 0; paint(); } }, 'Start over')),  // "Start over" button, pushed to the right: clears every answer, goes back to case 1 and repaints
            tiles,  // the case tiles
            h('div', { class: 'card tight' }, h('h4', { class: 'm0', style: { marginBottom: '4px' } }, 'The three deadlock strategies at a glance'), sheet))));  // card holding the strategy summary table; ends the right column and the layout
        paint();  // draws the first case when the step opens
      },  // ends render() for step 2
    },  // closes step 2
  ],  // closes the chapter's steps list
  notes: `${/* notes: the chapter 6 summary shown in the Notes drawer (N key) on the overview steps and in the printed guide */''}
    <h3>How Chapter 6 fits together</h3>${/* notes heading: how chapter 6 fits together */''}
    <p>Chapter 5’s locks bring a new danger. A set of processes is in <b>deadlock</b> when each is blocked waiting for something only another blocked member can provide. In the overview, P locks the printer then the scanner and Q the opposite order; if each gets its first device, both wait forever (3 random schedules in 8, on average). With one agreed order, none freezes. <b>Starvation</b> differs: the system keeps working, but one ready process is passed over again and again.</p>${/* notes paragraph: what a deadlock is, how often the overview's random schedules froze, and how starvation differs */''}
    <h4>The principles (6.1)</h4>${/* notes heading: the principles (section 6.1) */''}
    <p>Resources are <b>reusable</b> (devices, memory, files) or <b>consumable</b> (messages, signals). Deadlock needs four conditions: <b>mutual exclusion</b>, <b>hold and wait</b> and <b>no preemption</b> make it possible, and a <b>circular wait</b> (a closed chain of processes, each waiting for a resource the next one holds) makes it happen. A resource allocation graph draws request edges (process → resource) and assignment edges (resource → process); a cycle among single-unit resources means deadlock.</p>${/* notes paragraph: reusable and consumable resources, the four conditions, and allocation graphs */''}
    <h4>Three ways to respond (6.2 to 6.4)</h4>${/* notes heading: the three responses (sections 6.2 to 6.4) */''}
    <ul>${/* starts the bulleted list of the three strategies */''}
      <li><b>Prevention (6.2)</b> designs one condition out in advance: request everything at once (no hold and wait), make a waiting process give up what it holds (no preemption), or number the resources and request them in increasing order (no circular wait). No future knowledge is needed, but resources are often idle or held early.</li>${/* bullet: prevention and the three conditions it can design out */''}
      <li><b>Avoidance (6.3)</b> rules out no condition in advance. Knowing each process’s maximum claim, the <b>banker’s algorithm</b> grants a request only if the result is a <b>safe state</b> (one with an order in which every process can finish), so some grantable requests wait.</li>${/* bullet: avoidance, the banker's algorithm and safe states */''}
      <li><b>Detection and recovery (6.4)</b> grants freely, runs a detection algorithm now and then, and breaks any deadlock by aborting processes, rolling them back to a checkpoint or preempting resources. The cost is lost work.</li>${/* bullet: detection and recovery, and its cost in lost work */''}
    </ul>${/* ends the bulleted list */''}
    <h4>Mixing strategies and a classic test (6.5, 6.6)</h4>${/* notes heading: mixing strategies and the dining philosophers (sections 6.5 and 6.6) */''}
    <p>An <b>integrated strategy</b> (6.5) sorts resources into ordered classes and uses the best method inside each class. The <b>dining philosophers</b> (6.6) share five forks; the obvious solution deadlocks, while seating at most four, one philosopher reaching right first, or a monitor each break circular wait. A deadlock-free solution can still allow starvation.</p>${/* notes paragraph: the integrated strategy and the dining philosophers, and why deadlock-free can still starve */''}
    <h4>Real systems (6.7 to 6.11)</h4>${/* notes heading: real systems (sections 6.7 to 6.11) */''}
    <p>UNIX (6.7): pipes, message queues, shared memory, semaphores, signals. Linux (6.8): real-time signals, atomic operations, spinlocks, semaphores, barriers, RCU. Solaris (6.9): mutexes, semaphores, readers/writer locks, condition variables. Windows (6.10): dispatcher objects, critical sections, slim reader-writer locks, interlocked operations. Android (6.11): Binder.</p>${/* notes paragraph: the concurrency tools of UNIX, Linux, Solaris, Windows and Android, one sentence each */''}
    <h4>Why it matters next</h4>${/* notes heading: why it matters next */''}
    <p>Main memory is the resource every process needs; Chapter 7 shows how the OS divides it.</p>`,  // notes paragraph: memory is the next shared resource, taken up in chapter 7; end of the notes text
});  // closes the chapter 6 object and the Guide.chapter call
Guide.chapter({  // registers chapter 7 with the guide
  num: 7,  // num: the chapter number; it sets the chapter's order, its color (--ch7) and page addresses such as #ch7
  title: 'Memory Management',  // title shown on the chapter card, the chapter overview page and the top-bar tooltip
  tagline: 'Many programs, one physical memory. The OS decides who lives where, and keeps them from trampling each other.',  // tagline: the one-sentence hook printed in the chapter color at the top of the chapter overview page
  intro: '<p>Every running process needs part of <span class="t">main memory</span>, and there is never enough of it. This chapter sets out the five requirements any memory manager must meet (relocation, protection, sharing, logical organization and physical organization), then follows the history of solutions: carving memory into fixed or variable <b>partitions</b>, the <b>buddy system</b>, and finally cutting programs into small pieces with <b>paging</b> and <b>segmentation</b>. Along the way it shows how a <span class="t">logical address</span> used by a program becomes a physical address in memory. An appendix explains how a program is loaded into memory and linked with the code it calls.</p>',  // intro paragraph for the overview page; the span class="t" words show a definition when pointed at
  objectives: [  // objectives: the list shown under "After this chapter you will be able to" on the overview page and in the printed guide
    'Describe the five requirements of memory management.',  // objective 1: the five requirements of memory management
    'Compare fixed partitioning, dynamic partitioning and the buddy system, including internal and external fragmentation.',  // objective 2: fixed and dynamic partitions and the buddy system, with internal and external fragmentation
    'Simulate the first-fit, best-fit and next-fit placement algorithms.',  // objective 3: simulate first-fit, best-fit and next-fit placement
    'Translate a logical address to a physical address under paging and under segmentation.',  // objective 4: turn a logical address into a physical one under paging and under segmentation
    'Explain loading and linking: absolute, relocatable and dynamic run-time loading, and static versus dynamic linking.',  // objective 5: the kinds of loading and linking
  ],  // closes the objectives list
  terms: [  // terms: chapter-level glossary entries as [term, definition] pairs
    ['Main memory', 'The volatile memory that holds the instructions and data of running programs, organised as a row of numbered cells; a cell’s number is its address.'],  // glossary entry: defines main memory and what an address is
    ['Logical address', 'An address as the program sees it, measured from the start of the program or of one of its pieces; it must be translated before memory can be accessed.'],  // glossary entry: defines a logical address, the address as the program sees it
    ['Physical address', 'An actual location in main memory, the address that goes out to the memory hardware.'],  // glossary entry: defines a physical address, the real location sent to the memory hardware
    ['Fragmentation', 'Memory that is free but wasted, either inside an allocated block that is bigger than needed (internal) or in free gaps too small or scattered to use (external).'],  // glossary entry: defines fragmentation, both internal and external
  ],  // closes the terms list
  css: ` /* css: style rules used only by chapter 7's overview steps; each rule starts with .sec-ch7, the canvas class on these steps */
    .sec-ch7 .ch7-vis { padding: 6px 8px; } /* .ch7-vis: a little padding inside the white card that holds step 1's memory drawing */
    .sec-ch7 .ch7-req { display: flex; gap: 10px; align-items: flex-start; text-align: left; padding: 6px 10px; border: 1px solid var(--line); border-left: 4px solid var(--line-2); border-radius: 10px; background: var(--panel-2); cursor: pointer; color: var(--ink); font: inherit; font-size: 15px; line-height: 1.32; } /* .ch7-req: one of the scene buttons in step 1's "Five jobs" list: number and name side by side, left-aligned, with a grey left edge */
    .sec-ch7 .ch7-req:hover { border-color: var(--chc); } /* hovering a scene button outlines it in the chapter color */
    .sec-ch7 .ch7-req.on { border-color: var(--chc); border-left-color: var(--chc); background: color-mix(in srgb, var(--chc) 9%, var(--panel)); } /* the chosen scene (class "on") gets a chapter-colored outline, left edge and light tint */
    .sec-ch7 .ch7-n { flex: none; display: inline-grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; background: var(--panel-3); font-weight: 800; font-size: 12.5px; } /* .ch7-n: the small round number badge at the start of each scene button */
    .sec-ch7 .ch7-req.on .ch7-n { background: var(--chc); color: var(--panel); } /* the chosen scene's badge is filled with the chapter color, its number in the panel color */
    .sec-ch7 .ch7-d { display: block; margin-top: 2px; font-size: 13.5px; color: var(--ink-2); } /* .ch7-d: the one-line description that appears under the chosen scene's name */
    .sec-ch7 .ch7-tl { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; } /* .ch7-tl: the timeline of techniques in step 1, a wrapping row of small buttons with arrows between them */
    .sec-ch7 .ch7-tl .btn { padding: 3px 9px; font-size: 13.5px; } /* the timeline buttons are a little smaller than usual */
    .sec-ch7 .ch7-tl .ar { color: var(--muted); font-weight: 800; } /* .ar: the grey arrows (and the final dot) between timeline buttons */
    .sec-ch7 .ch7-tdesc { font-size: 13.5px; line-height: 1.35; min-height: 54px; margin-top: 4px; } /* .ch7-tdesc: the description under the timeline, with a minimum height so the card does not jump */
    .sec-ch7 .ch7-story .player-cap { min-height: 78px; } /* step 1's player caption keeps a minimum height so the controls stay still between frames */
    .sec-ch7 .ch7-tabs { height: 100%; } /* .ch7-tabs: the tab set in step 2 fills the step's height */
    .sec-ch7 .ch7-pane { padding-top: 10px; height: 100%; } /* .ch7-pane: each tab's panel, with a little space at the top and the full height */
    .sec-ch7 .ch7-meas .player-cap { min-height: 74px; } /* the caption in step 2's "measure the waste" tab keeps a minimum height so the controls do not jump */
    .sec-ch7 table.tbl.ch7-tbl td, .sec-ch7 table.tbl.ch7-tbl th { font-size: 14px; } /* the comparison table in step 2 uses slightly smaller text */
    .sec-ch7 table.tbl.ch7-tbl td.n { font-family: var(--mono); font-weight: 700; } /* number cells (class "n") in that table use the fixed-width font in bold so the digits line up */
    .sec-ch7 .ch7-cards { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; } /* .ch7-cards: the eight case cards in step 2's second tab, laid out in four equal columns (two rows) */
    .sec-ch7 .ch7-card { display: flex; flex-direction: column; justify-content: space-between; gap: 8px; padding: 9px 11px; border: 1px solid var(--line); border-left: 4px solid var(--line-2); border-radius: 10px; background: var(--panel-2); font-size: 14.5px; line-height: 1.38; } /* .ch7-card: one case card: its text above, its three answer buttons pushed to the bottom, with a grey left edge */
    .sec-ch7 .ch7-card.ok { border-left-color: var(--ok); background: color-mix(in srgb, var(--ok) 7%, var(--panel)); } /* a card answered correctly gets a green left edge and a faint green tint */
    .sec-ch7 .ch7-card.bad { border-left-color: var(--bad); background: color-mix(in srgb, var(--bad) 7%, var(--panel)); } /* a card answered wrongly gets a red left edge and a faint red tint */
    .sec-ch7 .ch7-card.on { box-shadow: 0 0 0 2px var(--chc); } /* the card answered last (class "on"), whose feedback is showing, gets a chapter-colored ring */
    .sec-ch7 .ch7-card .row { gap: 4px; } /* the buttons inside a card sit closer together */
    .sec-ch7 .ch7-card .btn { padding: 2px 8px; font-size: 13px; } /* and are smaller than usual */
    .sec-ch7 .ch7-card .btn.ok { border-color: var(--ok); color: var(--ok); background: var(--ok-bg); } /* a chosen button that was right turns green */
    .sec-ch7 .ch7-card .btn.bad { border-color: var(--bad); color: var(--bad); background: var(--bad-bg); } /* a chosen button that was wrong turns red */
    .sec-ch7 .ch7-sfb { min-height: 92px; } /* .ch7-sfb: the feedback box under the cards keeps a minimum height so the layout stays still */
    @media (max-width: 760px) { /* @media (max-width: 760px): these rules apply only on windows 760px wide or less */
      .sec-ch7 .ch7-cards { grid-template-columns: minmax(0, 1fr); } /* on a small screen the case cards stack in one column */
      .sec-ch7 table.tbl.ch7-tbl td, .sec-ch7 table.tbl.ch7-tbl th { font-size: 12px; letter-spacing: 0; padding-left: 3px; padding-right: 3px; } /* and the comparison table shrinks its text and side padding to fit */
    } /* ends the small-window rules */
  `,  // end of chapter 7's CSS text
  steps: [  // steps: the chapter's own overview steps, shown right after the chapter page and before section 7.1
    {  // step 1 of the chapter 7 overview
      title: 'Many programs, one memory',  // title shown at the top of step 1
      kind: 'story',  // kind "story" labels the step "Big Picture" and keeps it on the shorter core path
      render(el, ctx) {  // render(el, ctx): builds the step when it is shown; el is the empty step area, ctx holds the shell's helpers
        const { h, s } = ctx;  // h builds HTML elements and s builds SVG (drawing) elements
        const KB = 64, X0 = 20, X1 = 620, BY = 76, BH = 84, DY = 234;  // drawing sizes: 64 KB of memory, the bar from x 20 to x 620, its top (BY) and height (BH), and the top of the disk strip (DY)
        const big = ctx.narrow ? 1.7 : 1;  // labels grow on a small screen, where the whole picture is scaled down
        const X = (a) => X0 + (a / KB) * (X1 - X0);  // X(a): turns an address in KB into a horizontal position along the memory bar
        const kb = (n) => n + ' KB';  // kb(n): writes a size with its unit, e.g. 12 becomes "12 KB"
        const OS = { a: 0, b: 8, label: 'OS', cls: 's-os' };  // OS: the operating system's block, the first 8 KB, drawn in OS purple
        const P = (label, a, size, sub, cls) => ({ a, b: a + size, label, cls: cls || 's-proc', sub });  // P(label, a, size, sub, cls): makes a block from address a to a + size, teal by default, with an optional small subtitle
        // the free gaps between blocks, lowest address first
        function gaps(blocks) {  // gaps(blocks): the free stretches of memory that no block covers
          const out = []; let at = 0;  // out collects the gaps; at is the first address not yet known to be used
          blocks.slice().sort((p, q) => p.a - q.a).forEach((b) => { if (b.a > at) out.push({ a: at, b: b.a }); at = Math.max(at, b.b); });  // walks the blocks by start address; space between at and a block's start is a gap, then at moves past the block
          if (at < KB) out.push({ a: at, b: KB });  // space after the last block, up to 64 KB, is a gap too
          return out;  // returns the gaps
        }  // ends gaps()
        // first fit: the start of the lowest gap that is big enough, or null
        const firstFit = (blocks, size) => { const g = gaps(blocks).find((x) => x.b - x.a >= size); return g ? g.a : null; };  // firstFit(blocks, size): the start address of the first gap big enough for size, or null if none is
        // scene 0: processes arrive and leave; frame i replays events 1..i with first fit
        const EVENTS = [null, ['in', 'A', 16], ['in', 'B', 12], ['in', 'C', 20], ['out', 'A'], ['in', 'D', 14], ['in', 'E', 10]];  // EVENTS: scene 0's arrivals and departures in order: A, B and C arrive, A leaves, then D and E arrive (slot 0 is the empty start)
        function comeAndGo(i) {  // comeAndGo(i): builds frame i of scene 0 by replaying events 1 to i from an empty memory
          let blocks = [OS], marks = [], cap = 'Only the operating system is loaded; it keeps the first 8 KB. The other 56 KB is free for processes.';  // starts with only the OS loaded, no marks, and the opening caption
          for (let k = 1; k <= i; k++) {  // replays each event up to frame i
            const [kind, name, size] = EVENTS[k];  // reads the event: in or out, the process name and its size
            if (kind === 'out') { const b = blocks.find((x) => x.label === name); blocks = blocks.filter((x) => x !== b); cap = `${name} finishes and leaves. Its ${kb(b.b - b.a)} at ${b.a}–${b.b} KB becomes a free gap in the middle of memory.`; continue; }  // a departure: removes that process's block, and the caption says its space is now a gap in the middle; continue moves on
            const at = firstFit(blocks, size);  // an arrival: at is where first fit would put it
            if (at === null) {  // no gap is big enough:
              const g = gaps(blocks).map((x) => x.b - x.a), tot = g.reduce((p, q) => p + q, 0);  // g: the sizes of the gaps; tot: how much is free in total
              marks = [{ t: 'wait', text: `${name} needs ${kb(size)}: waits` }];  // marks adds the amber "waits" box at the top of the drawing
              cap = `${name} needs ${kb(size)}. There is ${kb(tot)} free in total, but only as gaps of ${g.map(kb).join(' and ')}, so ${name} must wait. Free memory split into unusable pieces is <span class="t">external fragmentation</span>.`;  // the caption shows that enough memory is free in total, but split into gaps too small: external fragmentation
            } else {  // otherwise:
              blocks.push(P(name, at, size));  // the process gets a block at that address
              cap = `${name} arrives needing ${kb(size)} and goes into the first gap that is big enough, at ${kb(at)}.` + (k === 5 ? ` Nobody could know that address when ${name} was written: a program must run wherever it lands.` : '');  // the caption says where it went; for event 5 it adds that the address could not have been known when the program was written
            }  // ends the if/else
          }  // ends the replay
          const later = EVENTS.slice(i + 1).filter((e) => e && e[0] === 'in').map((e) => e[1]).concat(marks.length ? [EVENTS[i][1]] : []);  // later: the processes still on disk, the arrivals after this frame plus the one that just had to wait
          return { blocks, marks, cap, disk: later.length ? later.map((n) => 'program ' + n) : ['programs already loaded'] };  // returns the scene: blocks, marks, caption, and the disk's contents (or a note that everything is loaded)
        }  // ends comeAndGo()
        // scene 1: relocation; B leaves, F takes its place, B returns somewhere else
        const R0 = [OS, P('A', 8, 16), P('C', 36, 12)], JUMP = 5;  // R0: the blocks that stay put in the relocation scene (OS, A and C); JUMP: how far into itself B's instruction jumps
        const relocation = [  // relocation: the three frames of scene 1, each a function that builds its picture when the player asks for it
          () => ({ blocks: [...R0, P('B', 24, 12, 'starts at 24 KB')], marks: [{ t: 'ptr', at: 24 + JUMP, text: `B jumps ${JUMP} KB into itself: 24 + ${JUMP} = ${24 + JUMP} KB`, cls: 'accent' }],  // frame 1: B loaded at 24 KB; an accent arrow marks the spot its jump reaches, 24 + 5 = 29 KB
            cap: `Process B is loaded at 24 KB. One of its instructions says “jump to the spot ${JUMP} KB from my start”. Right now that spot is 24 + ${JUMP} = <b>${24 + JUMP} KB</b>.` }),  // frame 1 caption: the jump is measured from B's start, so right now it lands at 29 KB
          () => ({ blocks: [...R0, P('F', 24, 12)], disk: ['B (swapped out)'], marks: [],  // frame 2: B is swapped out to disk and a new process F takes its old place at 24 KB
            cap: 'While B waits for slow input, it is <span class="t" data-t="swapping">swapped out</span> to disk to make room. Process F arrives and takes the gap B left at 24 KB.' }),  // frame 2 caption: what swapping out means and why B's place is gone
          () => {  // frame 3 is computed, so it can work out where B lands:
            const rest = [...R0, P('F', 24, 12)], at = firstFit(rest, 12);  // rest: the blocks without B; at: where first fit puts B now (48 KB, after C)
            return { blocks: [...rest, P('B', at, 12, `starts at ${at} KB`)], marks: [{ t: 'ptr', at: at + JUMP, text: `same jump: ${at} + ${JUMP} = ${at + JUMP} KB`, cls: 'ok' }],  // B drawn at its new place, with a green arrow showing the same jump now landing 5 KB past the new start
              cap: `B comes back, but its old place is taken, so it is loaded at <b>${kb(at)}</b>. The same jump must now reach ${kb(at + JUMP)}. That is <span class="t">relocation</span>: B’s addresses must follow B wherever it is put.` };  // frame 3 caption: B's addresses must follow it to the new place; that is relocation
          },  // ends frame 3
        ];  // closes the relocation frames
        // scene 2: protection; C may only touch its own range
        const PR = [OS, P('A', 8, 16), P('B', 24, 12), P('C', 36, 20)], LIM = { t: 'brk', a: 36, b: 56, text: 'C may use 36–56 KB only' }, BAD = 33;  // PR: the layout for scene 2 (OS, A, B, C); LIM: a bracket marking C's allowed range 36-56 KB; BAD: the stray address 33 KB, inside B
        const protection = [  // protection: the three frames of scene 2
          () => ({ blocks: PR, marks: [LIM], cap: 'Process C is running. The hardware knows C’s limits: C may use addresses from 36 KB up to 56 KB, and nothing else.' }),  // frame 1: only the bracket; the caption says the hardware knows C's limits
          () => ({ blocks: PR, marks: [LIM, { t: 'ptr', at: BAD, text: `C tries to write at ${BAD} KB, inside B`, cls: 'bad' }], cap: `A bug in C produces the address ${BAD} KB, which lies inside B. If that write went through, B would be damaged without having done anything wrong.` }),  // frame 2: a red arrow at 33 KB, inside B; the caption says what damage the write would do
          () => ({ blocks: PR, marks: [LIM, { t: 'ptr', at: BAD, text: 'blocked: trap to the OS', cls: 'bad' }, { t: 'x', at: BAD }], cap: `${BAD} is outside 36–56, so the processor stops the access and traps to the OS before memory is touched. <span class="t">Memory protection</span> must be checked by hardware on every access: nobody can know in advance where a relocated program’s addresses will point.` }),  // frame 3: the arrow now reads "blocked" and a red cross sits at 33 KB; the caption says the hardware checks every access and traps
        ];  // closes the protection frames
        // scene 3: sharing; two users of one editor
        const CODE = 12, DATA = 6;  // CODE and DATA: sizes in KB of the editor's code and of each user's private data in scene 3
        const sharing = [  // sharing: the two frames of scene 3
          () => ({ blocks: [OS, P('editor code', 8, CODE, 'copy 1'), P('data 1', 8 + CODE, DATA, '', 's-panel'), P('editor code', 8 + CODE + DATA, CODE, 'copy 2'), P('data 2', 8 + 2 * CODE + DATA, DATA, '', 's-panel')], marks: [],  // frame 1: two separate copies of the editor's code, each followed by its user's grey data block
            cap: `Two people run the same ${kb(CODE)} text editor. Loaded separately, memory holds two identical copies of its code: ${kb(2 * CODE)} for one program.` }),  // frame 1 caption: the same code sits in memory twice
          () => ({ blocks: [OS, P('editor code', 8, CODE, 'read-only'), P('data 1', 8 + CODE, DATA, '', 's-panel'), P('data 2', 8 + CODE + DATA, DATA, '', 's-panel')], marks: [{ t: 'arc', from: 8 + CODE + DATA / 2, to: 8 + CODE / 2 }, { t: 'arc', from: 8 + CODE + 1.5 * DATA, to: 8 + CODE / 2 }],  // frame 2: one read-only copy of the code, with two curved arrows from the users' data blocks back to it
            cap: `<span class="t" data-t="Controlled sharing">Sharing</span>: one copy of the code serves both users, and each keeps private data. That frees ${kb(CODE)}. It must be <b>controlled</b>: both may run the code, neither may change it.` }),  // frame 2 caption: one copy serves both, frees 12 KB, and must be controlled so neither user can change it
        ];  // closes the sharing frames
        // scene 4: logical organization; one flat block versus the modules it was built from
        const logical = [  // logical: the two frames of scene 4
          () => ({ blocks: [OS, P('A', 8, 32, 'one run of bytes'), P('B', 40, 12)], marks: [], cap: 'To the hardware, memory is one long row of numbered bytes, and process A is simply 32 KB of that row.' }),  // frame 1: process A as one 32 KB stretch of bytes, the way the hardware sees it
          () => ({ blocks: [OS, P('main', 8, 12, 'run only'), P('library', 20, 10, 'run, shared'), P('data', 30, 10, 'read, write', 's-panel'), P('B', 40, 12)], marks: [{ t: 'brk', a: 8, b: 40, text: 'process A, as its programmer built it' }],  // frame 2: the same 32 KB split into main code, a shared library and data, each with its own rights, under one bracket
            cap: 'But A was written as <b>modules</b>: main code, a library and data. Each can be compiled on its own, protected differently and shared on its own. <span class="t">Logical organization</span> asks memory to respect these units; <span class="t">segmentation</span> (7.4) does.' }),  // frame 2 caption: memory should respect a program's modules; segmentation does that
        ];  // closes the logical organization frames
        // scene 5: physical organization; a program bigger than free memory, done with overlays
        const G = { main: 10, part: 30 };  // G: program G's sizes: a 10 KB main part and two parts of 30 KB each
        const physical = [  // physical: the three frames of scene 5
          () => ({ blocks: [OS, P('A', 8, 16), P('B', 24, 12)], disk: ['files', 'swapped-out processes', 'programs not running yet'], marks: [], cap: 'Storage comes in two levels. <span class="t">Main memory</span> is fast but small and forgets everything when the power goes off; the disk is large and permanent but far slower.' }),  // frame 1: an ordinary layout with a busy disk below; the caption contrasts fast, small memory with the big, slow disk
          () => ({ blocks: [OS, P('G main', 8, G.main), P('G part 1', 8 + G.main, G.part, 'overlay area', 's-warn')], disk: ['G part 2'], marks: [],  // frame 2: G's main part plus part 1 in an amber overlay area, with part 2 waiting on disk
            cap: `Program G needs ${kb(G.main + 2 * G.part)} but only 56 KB is free. The old answer was <span class="t" data-t="Overlay">overlays</span>: the programmer splits G so parts 1 and 2 take turns in one ${kb(G.part)} area, using ${kb(G.main + G.part)} in all.` }),  // frame 2 caption: G needs 70 KB but 56 KB is free, so overlays let its two parts take turns in one area
          () => ({ blocks: [OS, P('G main', 8, G.main), P('G part 2', 8 + G.main, G.part, 'overlay area', 's-warn')], disk: ['G part 1'], marks: [{ t: 'swap', at: 8 + G.main + G.part / 2 }],  // frame 3: part 2 now fills the overlay area, part 1 is back on disk, and orange arrows show the swap
            cap: 'Now part 2 replaces part 1. Programmers should not have to plan this, and cannot know how much memory a machine will have free. Moving data between the two levels is the system’s job: <span class="t">physical organization</span>. Chapter 8 automates it.' }),  // frame 3 caption: moving data between the two levels should be the system's job (physical organization)
        ];  // closes the physical organization frames
        const MODES = [  // MODES: the six scenes listed in the right column, each with a name, a one-line description and its frames
          { name: 'Processes come and go', d: 'Watch memory fill up and break into gaps as processes arrive and leave.', frames: EVENTS.map((_, i) => () => comeAndGo(i)) },  // scene 0: processes come and go; one frame for each EVENTS entry, built by comeAndGo
          { name: 'Relocation', d: 'A process may be loaded, or brought back, anywhere. Its addresses must follow it.', frames: relocation },  // scene 1: relocation
          { name: 'Protection', d: 'No process may touch another’s memory, or the OS’s, without permission.', frames: protection },  // scene 2: protection
          { name: 'Sharing', d: 'Processes that run the same code should share one copy, under control.', frames: sharing },  // scene 3: sharing
          { name: 'Logical organization', d: 'Programs are built from modules with different needs; memory should see them that way.', frames: logical },  // scene 4: logical organization
          { name: 'Physical organization', d: 'Fast small memory, slow big disk: moving data between them is the system’s job.', frames: physical },  // scene 5: physical organization
        ];  // closes the MODES list
        const svg = s('svg', { viewBox: '0 0 640 292', width: '100%', role: 'img', 'aria-label': 'Main memory drawn as a bar of addresses from 0 to 64 KB, with the disk below it' });  // svg: the memory drawing, 640 x 292, stretched to its card; the label describes it for screen readers
        const T = (x, y, txt, size, more = {}) => s('text', { x, y, 'text-anchor': 'middle', 'font-size': size * big, ...more }, txt);  // T(x, y, txt, size, more): a centered text label; its size is multiplied by big so it stays readable on small screens
        const mid = (x, room) => Math.min(640 - room, Math.max(room, x));  // mid(x, room): keeps a label's center at least room pixels from either edge of the drawing, so long labels are not cut off
        // draws one scene: free gaps, blocks, the address scale, then the scene's marks
        function draw(sc) {  // draw(sc): redraws the memory picture for scene frame sc
          const k = [];  // k collects the shapes of the new picture
          gaps(sc.blocks).forEach((g) => {  // for every free gap:
            const w = X(g.b) - X(g.a);  // w: the gap's width in the drawing
            k.push(s('rect', { x: X(g.a) + 1, y: BY + 1, width: w - 2, height: BH - 2, class: 's-muted', 'stroke-dasharray': '5 4' }));  // a dashed, faint outline just inside the gap
            if (w > 52 * big) k.push(T(X(g.a) + w / 2, BY + BH / 2 + 5, `${g.b - g.a} KB free`, 13, { class: 's-sub' }));  // a "N KB free" label in the middle, but only if the gap is wide enough to hold it
          });  // ends the gaps
          sc.blocks.forEach((b) => {  // for every block:
            const w = X(b.b) - X(b.a), sub = b.sub && !ctx.narrow;  // w: its width; sub: whether to show its subtitle (only on wider screens)
            const label = ctx.narrow && b.label.length * 13 > w ? b.label.split(' ').pop() : b.label;  // on a small screen a long label that would not fit is cut down to its last word
            k.push(s('rect', { x: X(b.a), y: BY, width: w, height: BH, rx: 4, class: b.cls, 'stroke-width': 1.5 }), T(X(b.a) + w / 2, BY + BH / 2 + (sub ? -4 : 6), label, 16, { 'font-weight': 800 }));  // the block in its color with its bold label in the middle, raised a little when a subtitle goes under it
            if (sub) k.push(T(X(b.a) + w / 2, BY + BH / 2 + 16, b.sub, 12.5, { class: 's-sub' }));  // the small grey subtitle under the label
          });  // ends the blocks
          for (let a = 0; a <= KB; a += 8) k.push(s('line', { x1: X(a), x2: X(a), y1: BY + BH, y2: BY + BH + 5, class: 's-line' }), T(X(a), BY + BH + 9 + 11 * big, a === KB ? '64 KB' : String(a), 12.5, { class: 's-sub', 'text-anchor': a === KB ? 'end' : a ? 'middle' : 'start' }));  // the address scale: a tick and a number every 8 KB under the bar, the last one written "64 KB"
          (sc.marks || []).forEach((m) => {  // then the scene's marks (arrows, brackets, crosses...):
            const col = 'var(--' + (m.cls || 'chc') + ')';  // col: the mark's color, or the chapter color if it names none
            if (m.t === 'ptr') k.push(s('line', { x1: X(m.at), x2: X(m.at), y1: 34, y2: BY - 3, class: 's-line', 'stroke-width': 2.5, style: 'stroke:' + col, 'marker-end': `url(#arr-${m.cls})` }), T(mid(X(m.at), 150 * big), 24, m.text, 13.5, { 'font-weight': 800, style: 'fill:' + col }));  // 'ptr': an arrow pointing down at one address, with a bold label above it kept inside the drawing
            if (m.t === 'x') k.push(T(X(m.at), BY + BH / 2 + 12, '✗', 36, { 'font-weight': 900, style: 'fill:var(--bad)' }));  // 'x': a large red cross over an address, for a blocked access
            if (m.t === 'brk') { const y = BY + BH + 34; k.push(s('path', { d: `M${X(m.a)} ${y - 6} V${y} H${X(m.b)} V${y - 6}`, class: 's-line', fill: 'none', 'stroke-width': 2, style: 'stroke:var(--chc)' }), T(mid((X(m.a) + X(m.b)) / 2, 130 * big), y + 18 * big, m.text, 13.5, { 'font-weight': 700, style: 'fill:var(--chc)' })); }  // 'brk': a bracket under the scale from address a to b, with a label below it, in the chapter color
            if (m.t === 'arc') k.push(s('path', { d: `M${X(m.from)} ${BY} Q${(X(m.from) + X(m.to)) / 2} ${BY - 56} ${X(m.to)} ${BY - 2}`, class: 's-line', fill: 'none', 'stroke-width': 2, style: 'stroke:var(--proc)', 'marker-end': 'url(#arr-proc)' }));  // 'arc': a curved teal arrow over the bar from one block to another, for sharing
            if (m.t === 'wait') k.push(s('rect', { x: 400, y: 8, width: 220, height: 38, rx: 8, class: 's-warn', 'stroke-width': 1.5 }), T(510, 32, m.text, 14, { 'font-weight': 800 }));  // 'wait': an amber box in the top right corner, for a process that must wait
            if (m.t === 'swap') k.push(s('path', { d: `M${X(m.at) - 14} ${BY + BH + 30} V${DY - 4}`, class: 's-line', 'stroke-width': 2.5, style: 'stroke:var(--io)', 'marker-end': 'url(#arr-io)' }), s('path', { d: `M${X(m.at) + 14} ${DY - 4} V${BY + BH + 32}`, class: 's-line', 'stroke-width': 2.5, style: 'stroke:var(--io)', 'marker-end': 'url(#arr-io)' }));  // 'swap': two orange arrows, one down to the disk and one back up, for an overlay swap
          });  // ends the marks
          // the disk is always there; scenes that do not use it show it faded
          const disk = sc.disk || ['files', 'programs not running yet'];  // disk: the items to show on the disk, the scene's own list or a default pair
          const dg = s('g', { style: sc.disk ? '' : 'opacity:.45' });  // dg: a group for the disk, faded to 45% when the scene does not use it
          dg.append(s('rect', { x: 20, y: DY, width: 600, height: 50, rx: 10, class: 's-io', 'stroke-width': 1.5 }), T(54, DY + 30, 'Disk', 14, { 'font-weight': 800 }));  // the long orange disk strip with "Disk" written at its left
          let x = 92;  // x: where the first item box on the disk starts
          const wide = disk.reduce((sum, d) => sum + d.length * 7.4 * big + 28, 0) > 520;  // wide: whether the items' estimated widths would overflow the strip; if so, each label is shortened to its last word
          disk.map((d) => (wide ? d.split(' ').pop() : d)).forEach((d) => { const w = d.length * 7.4 * big + 20; dg.append(s('rect', { x, y: DY + 10, width: w, height: 30, rx: 6, class: 's-panel' }), T(x + w / 2, DY + 30, d, 13, { 'font-weight': 700 })); x += w + 8; });  // draws each item as a small grey box with its label, side by side from left to right
          k.push(dg);  // adds the disk group to the picture
          svg.replaceChildren(...k);  // swaps the old picture for the new one
        }  // ends draw()
        let mode = 0, tech = 3, pl = null;  // mode: the scene on screen; tech: the technique chosen in the timeline (3, paging, at first); pl: the current scene's player
        const playHost = h('div', { class: 'ch7-story' });  // playHost: the box that holds the current scene's player
        const list = h('div', { class: 'stack', style: { gap: '6px' } });  // list: the column of scene buttons
        function paintList() {  // paintList(): redraws the scene buttons so the chosen one is highlighted
          list.replaceChildren(...MODES.map((m, i) => h('button', { class: 'ch7-req' + (i === mode ? ' on' : ''), type: 'button', 'aria-pressed': String(i === mode), onclick: () => setMode(i) },  // one button per scene; the chosen one gets "on" and aria-pressed; a click switches to that scene
            h('span', { class: 'ch7-n' }, i ? String(i) : '▶'), h('span', {}, h('b', {}, m.name), ...(i === mode ? [h('span', { class: 'ch7-d' }, m.d)] : [])))));  // its badge (a play sign for scene 0, 1 to 5 for the five jobs), its name, and for the chosen scene its description
        }  // ends paintList()
        function setMode(i) {  // setMode(i): switches to scene i
          mode = i;  // remembers the choice
          const fr = MODES[i].frames;  // fr: the new scene's frames
          if (pl) pl.stop();  // the old scene's player must not keep drawing into the shared picture
          pl = ctx.ui.player({ count: fr.length, interval: 2800, captionBelow: true, render: (f) => { const sc = fr[f](); draw(sc); return sc.cap; } });  // a new player: one step per frame, 2.8 seconds each when playing, caption under the controls; each step draws its frame and returns the caption
          playHost.replaceChildren(pl.el);  // puts the new player in place of the old one
          paintList();  // redraws the scene buttons
          ctx.refit();  // re-checks that the step still fits, since the list and player may have changed height
        }  // ends setMode()
        const TECH = [  // TECH: the timeline of techniques as [name, section, description], in the order the chapter teaches them
          ['Fixed partitions', '7.2', 'Memory is cut into partitions of set sizes at start-up. Each process takes a whole partition, so the unused end of each one is wasted.'],  // technique: fixed partitions (7.2), where the unused end of each partition is wasted
          ['Dynamic partitions', '7.2', 'Each process gets exactly what it asks for, but as processes come and go, free memory breaks into gaps, as in the first scene.'],  // technique: dynamic partitions (7.2), where free memory breaks into gaps
          ['Buddy system', '7.2', 'Blocks come in powers of two and are split in half on demand; two free halves (buddies) merge again. A compromise between the first two.'],  // technique: the buddy system (7.2), with power-of-two blocks that split and merge
          ['Paging', '7.3', 'Memory is cut into small equal frames and each process into pages of the same size, so any page fits in any free frame.'],  // technique: paging (7.3), equal frames and pages so any page fits any frame
          ['Segmentation', '7.4', 'Each process is cut into variable-length segments that match its logical parts (code, data, stack), each placed wherever it fits.'],  // technique: segmentation (7.4), variable-length pieces that match a program's parts
          ['Loading and linking', '7A', 'Underneath them all: a linker joins separately compiled modules into one load module, and a loader places it in memory and fixes its addresses.'],  // technique: loading and linking (appendix 7A), which every other technique relies on
        ];  // closes the TECH list
        const tl = h('div', { class: 'ch7-tl' }), tdesc = h('div', { class: 'ch7-tdesc', 'aria-live': 'polite' });  // tl: the row of technique buttons; tdesc: the description under it, read aloud by screen readers when it changes
        function paintTech() {  // paintTech(): redraws the timeline with the chosen technique highlighted, and its description
          const kids = [];  // kids collects the buttons and arrows
          TECH.forEach(([n], i) => {  // for each technique:
            if (i) kids.push(h('span', { class: 'ar' }, i === 5 ? '·' : '→'));  // an arrow before every button but the first; the last gets a dot instead, since loading and linking sits under all the others
            kids.push(h('button', { class: 'btn sm' + (i === tech ? ' on' : ''), type: 'button', 'aria-pressed': String(i === tech), onclick: () => { tech = i; paintTech(); } }, n));  // a small button with the technique's name, marked on when chosen; a click chooses it and repaints
          });  // ends the loop
          tl.replaceChildren(...kids);  // puts the buttons and arrows in the timeline
          const [n, sec, d] = TECH[tech];  // reads the chosen technique's name, section and description
          tdesc.innerHTML = `<b>${n}</b> <span class="chip">${sec}</span> ${d}`;  // shows the name in bold, a tag with its section number, and the description
          ctx.refit();  // re-checks that the step still fits
        }  // ends paintTech()
        el.append(h('div', { class: 'split r fill' },  // puts step 1 on screen: two columns, the larger one on the left
          h('div', { class: 'stack', style: { gap: '8px' } },  // left column, stacked 8px apart:
            h('p', { class: 'm0', html: 'Every process needs a place in <span class="t">main memory</span>, and processes keep arriving and leaving. Pick one of the scenes listed under “Five jobs”, then step through it.' }),  // the opening sentence telling the student to pick a scene and step through it
            h('div', { class: 'card white ch7-vis' }, svg), playHost),  // the white card with the memory drawing, then the scene's player; ends the left column
          h('div', { class: 'stack', style: { gap: '8px' } },  // right column:
            h('h4', { class: 'm0' }, 'Five jobs every memory manager must do'), list,  // the "Five jobs" heading and the scene buttons
            h('div', { class: 'card tight' }, h('h4', { class: 'm0', style: { marginBottom: '6px' } }, 'How the chapter answers them'), tl, tdesc))));  // card: "How the chapter answers them", with the technique timeline and its description; ends the layout
        paintTech();  // draws the timeline with paging chosen
        setMode(0);  // starts on scene 0, processes coming and going
      },  // ends render() for step 1
    },  // closes step 1
    {  // step 2 of the chapter 7 overview
      title: 'Where did the memory go?',  // title shown at the top of step 2
      kind: 'explore',  // kind "explore" labels the step "Explore"
      render(el, ctx) {  // render(el, ctx): builds step 2 when it is shown
        const { h, s } = ctx;  // h builds HTML elements and s builds SVG (drawing) elements
        const MEM = 48, PART = 12, PAGE = 4, NPART = MEM / PART, NFR = MEM / PAGE;  // sizes: 48 KB of memory, 12 KB partitions, 4 KB pages, so 4 partitions or 12 frames
        const EV = [null, ['in', 'A', 7], ['in', 'B', 11], ['in', 'C', 9], ['in', 'D', 10], ['out', 'B'], ['in', 'E', 4], ['in', 'F', 12]];  // EV: the arrivals and departures replayed under every technique: A, B, C, D arrive, B leaves, then E and F arrive (slot 0 is the empty start)
        const TECHS = [['fixed', 'Fixed partitions'], ['dyn', 'Dynamic partitions'], ['paging', 'Paging']];  // TECHS: the three techniques to compare, as [key, name]
        const kb = (n) => n + ' KB';  // kb(n): writes a size with its unit, e.g. 7 becomes "7 KB"
        const list = (a) => (a.length > 1 ? a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1] : String(a[0]));  // list(a): joins a list in plain English, e.g. [1, 2, 3] becomes "1, 2 and 3"
        // replays events 1..upto under one technique: the memory layout, who waits, and a sentence about the last event
        function run(tech, upto) {  // run(tech, upto): replays the events under one technique and reports the result
          const size = {}, parts = Array(NPART).fill(null), frames = Array(NFR).fill(null), waiting = [];  // size: each process's size by name; parts: who is in each partition; frames: what each frame holds; waiting: who could not be loaded
          let blocks = [];  // blocks: the processes' blocks under dynamic partitions
          const gaps = () => { const out = []; let at = 0; blocks.slice().sort((p, q) => p.a - q.a).forEach((b) => { if (b.a > at) out.push({ a: at, b: b.a }); at = b.b; }); if (at < MEM) out.push({ a: at, b: MEM }); return out; };  // gaps(): the free stretches between the dynamic blocks, lowest first, including the space after the last block
          // tries to load a process; returns a sentence, or null if it must wait
          function place(n) {  // place(n): tries to load process n under the chosen technique
            const z = size[n];  // z: the process's size
            if (tech === 'fixed') { const p = parts.indexOf(null); if (p < 0) return null; parts[p] = n; return `${n} (${kb(z)}) takes partition ${p + 1}, leaving ${kb(PART - z)} unused inside it.`; }  // fixed: takes the first empty partition (or waits) and says how much of the partition goes unused
            if (tech === 'dyn') { const g = gaps().find((x) => x.b - x.a >= z); if (!g) return null; blocks.push({ n, a: g.a, b: g.a + z }); return `${n} (${kb(z)}) gets exactly ${kb(z)}, in the first gap big enough: ${g.a}–${g.a + z} KB.`; }  // dynamic: the first gap big enough gets a block of exactly the size asked for (or the process waits)
            const need = Math.ceil(z / PAGE), free = frames.map((f, i) => (f ? -1 : i)).filter((i) => i >= 0);  // paging: need is the number of pages (size divided by 4, rounded up); free lists the empty frames
            if (free.length < need) return null;  // too few empty frames: the process must wait
            const got = free.slice(0, need);  // got: the first empty frames, one per page
            got.forEach((f, p) => { frames[f] = { n, p, used: Math.min(PAGE, z - p * PAGE) }; });  // each frame records the process, which of its pages it holds and how many KB of that page are used
            const apart = got.some((f, k) => k && f !== got[k - 1] + 1);  // apart: whether the frames are scattered rather than side by side
            const last = z - (need - 1) * PAGE;  // last: how many KB the final page holds
            return `${n} (${kb(z)}) needs ${need} page${need > 1 ? 's' : ''}: frame${need > 1 ? 's' : ''} ${list(got)}${apart ? ', which need not sit side by side' : ''}. ` + (last === PAGE ? 'Every page is full, so nothing is wasted.' : `Its last page holds ${kb(last)} of ${PAGE}, wasting ${kb(PAGE - last)}.`);  // the sentence: the pages and frames used, a note if they are scattered, and the space wasted in the last page, if any
          }  // ends place()
          function why(n) {  // why(n): the reason process n cannot be loaded, worded for the chosen technique
            if (tech === 'fixed') return `every partition is taken, so ${n} must wait`;  // fixed: every partition is in use
            if (tech === 'dyn') { const g = gaps().map((x) => x.b - x.a); return `the free memory is only gaps of ${list(g.map(kb))} (${kb(g.reduce((p, q) => p + q, 0))} in all), so ${n} must wait`; }  // dynamic: the free memory is only small gaps, listed with their total
            return `only ${frames.filter((f) => !f).length} frame${frames.filter((f) => !f).length === 1 ? ' is' : 's are'} free, so ${n} must wait`;  // paging: only a few frames are free
          }  // ends why()
          let say = { fixed: 'Memory is cut into four 12 KB partitions before anything arrives.', dyn: 'Memory starts as one free 48 KB block; each process will get exactly what it asks for.', paging: 'Memory is cut into twelve 4 KB frames; each process will be cut into 4 KB pages.' }[tech];  // say: the opening sentence for each technique, replaced as events are replayed
          for (let k = 1; k <= upto; k++) {  // replays each event up to the chosen one
            const [kind, n, z] = EV[k];  // reads the event: in or out, the name and the size
            if (kind === 'in') { size[n] = z; const r = place(n); say = r || `${n} (${kb(z)}) arrives, but ${why(n)}.`; if (!r) waiting.push(n); continue; }  // an arrival: records its size and tries to place it; the sentence is the placement or the reason to wait; continue moves on
            if (tech === 'fixed') { const p = parts.indexOf(n); parts[p] = null; say = `${n} leaves; partition ${p + 1} is free again.`; }  // a departure under fixed partitions: its partition is emptied
            else if (tech === 'dyn') { const b = blocks.find((x) => x.n === n); blocks = blocks.filter((x) => x !== b); say = `${n} leaves, opening a ${kb(b.b - b.a)} gap at ${b.a}–${b.b} KB.`; }  // under dynamic partitions: its block is removed, opening a gap
            else { const f = frames.map((x, i) => (x && x.n === n ? i : -1)).filter((i) => i >= 0); f.forEach((i) => { frames[i] = null; }); say = `${n} leaves; frames ${list(f)} are free again.`; }  // under paging: every frame it held is freed
            waiting.slice().forEach((w) => { const r = place(w); if (r) { waiting.splice(waiting.indexOf(w), 1); say += ' ' + r; } });  // after a departure, each waiting process tries again in arrival order; any that now fit are loaded and their sentences added
          }  // ends the replay
          const loaded = Object.keys(size).filter((n) => !waiting.includes(n) && (tech === 'fixed' ? parts.includes(n) : tech === 'dyn' ? blocks.some((b) => b.n === n) : frames.some((f) => f && f.n === n)));  // loaded: the processes that are in memory now
          const used = loaded.reduce((a, n) => a + size[n], 0);  // used: the memory those processes really need
          const alloc = tech === 'fixed' ? PART * parts.filter(Boolean).length : tech === 'dyn' ? used : PAGE * frames.filter(Boolean).length;  // alloc: the memory handed out: whole partitions, exact blocks or whole frames
          const g = gaps().map((x) => x.b - x.a);  // g: the sizes of the dynamic gaps
          const pieces = tech === 'fixed' ? parts.filter((p) => !p).length : tech === 'dyn' ? g.length : frames.filter((f) => !f).length;  // pieces: how many separate free pieces there are: empty partitions, gaps or empty frames
          const fits = tech === 'fixed' ? (pieces ? PART : 0) : tech === 'dyn' ? Math.max(0, ...g) : PAGE * pieces;  // fits: the largest single process that could be loaded now: a whole partition, the biggest gap, or all free frames together
          return { tech, parts, frames, blocks, size, waiting, say, used, internal: alloc - used, free: MEM - alloc, pieces, fits };  // returns the layout and the totals; internal is the space handed out but not used, free is what was never handed out
        }  // ends run()
        const big = ctx.narrow ? 1.6 : 1;  // labels grow on a small screen, where the picture is scaled down
        const X = (a) => 20 + (a / MEM) * 600;  // X(a): turns an address in KB into a horizontal position on the 600-pixel bar
        const T = (x, y, txt, size, more = {}) => s('text', { x, y, 'text-anchor': 'middle', 'font-size': size * big, ...more }, txt);  // T(x, y, txt, size, more): a centered text label, enlarged by big on small screens
        const BY = 32, BH = 118, LY = BY + BH / 2 + 5;  // BY and BH: the bar's top and height; LY: the baseline for labels in the middle of the bar
        const R = (x, w, cls, more = {}) => s('rect', { x, y: BY, width: w, height: BH, class: cls, 'stroke-width': 1.5, ...more });  // R(x, w, cls, more): a rectangle as tall as the bar, starting at x and w wide
        const fitsIn = (txt, w, size) => txt.length * size * 0.56 * big < w - 4;  // fitsIn(txt, w, size): estimates whether a label is short enough to fit in a space w pixels wide
        // one allocated piece: the used part in process colour, the unused rest amber with a dashed edge
        function piece(k, a, room, used, label) {  // piece(k, a, room, used, label): draws one piece at address a, room KB handed out, of which used KB is needed
          const wu = (used / MEM) * 600, wr = (room / MEM) * 600;  // wu and wr: the widths of the used part and of the whole piece
          k.push(R(X(a), wu, 's-proc'));  // the used part, in process teal
          if (fitsIn(label, wu, 15)) k.push(T(X(a) + wu / 2, LY, label, 15, { 'font-weight': 800 }));  // the process's label, only if it fits in the used part
          if (room > used) {  // if some of the piece is left over:
            const left = room - used, w = wr - wu, txt = `${left} KB unused`;  // left: the unused KB; w: its width; txt: its label
            k.push(R(X(a) + wu, w, 's-warn', { 'stroke-dasharray': '4 3' }));  // the unused rest in amber with a dashed edge
            k.push(T(X(a) + wu + w / 2, LY, fitsIn(txt, w, 13) ? txt : fitsIn(String(left), w, 13) ? String(left) : '', 13, { 'font-weight': 700, style: 'fill:var(--warn)' }));  // its label in amber: the full text if it fits, otherwise just the number, otherwise nothing
          }  // ends the leftover part
        }  // ends piece()
        const svg = s('svg', { viewBox: '0 0 640 176', width: '100%', role: 'img', 'aria-label': 'The 48 KB of memory under the chosen technique' });  // svg: step 2's memory drawing, 640 x 176, stretched to its card; the label describes it for screen readers
        function drawMem(r) {  // drawMem(r): draws the memory picture for one result r of run()
          const k = [T(20, 18, TECHS.find((x) => x[0] === r.tech)[1] + (r.tech === 'paging' ? ': twelve 4 KB frames, numbered below' : ': 48 KB for processes'), 13.5, { 'text-anchor': 'start', 'font-weight': 800 })];  // k starts with a bold heading at the top left: the technique's name and how its memory is divided
          if (r.waiting.length) k.push(T(620, 18, 'waiting: ' + r.waiting.map((n) => `${n} (${kb(r.size[n])})`).join(', '), 13.5, { 'text-anchor': 'end', 'font-weight': 800, style: 'fill:var(--bad)' }));  // if anyone is waiting, a red "waiting:" list with their sizes goes at the top right
          if (r.tech === 'fixed') r.parts.forEach((n, p) => {  // fixed partitions: for each of the four partitions
            k.push(R(X(p * PART), 150, 's-panel', { 'stroke-width': 2.5 }));  // the partition's grey box, 150 pixels wide (12 of 48 KB), with a thick border
            if (n) piece(k, p * PART, PART, r.size[n], n); else k.push(T(X(p * PART) + 75, LY, 'free', 13, { class: 's-sub' }));  // an occupied partition gets its process drawn in it (with the unused end in amber); an empty one says "free"
            k.push(R(X(p * PART), 150, 's-line', { fill: 'none', 'stroke-width': 2.5 }));  // the thick outline again on top, so the partition edges stay crisp over the colored piece
          });  // ends the partitions
          if (r.tech === 'dyn') {  // dynamic partitions:
            let at = 0;  // at: where the previous block ended
            r.blocks.slice().sort((p, q) => p.a - q.a).concat([{ a: MEM, b: MEM }]).forEach((b) => {  // walks the blocks by address, plus a zero-width marker at 48 KB so the gap at the end is drawn too
              if (b.a > at) { const w = X(b.a) - X(at), txt = `${b.a - at} KB free`; k.push(R(X(at) + 1, w - 2, 's-muted', { 'stroke-dasharray': '5 4' })); k.push(T(X(at) + w / 2, LY, fitsIn(txt, w, 13) ? txt : String(b.a - at), 13, { class: 's-sub' })); }  // space before a block is a gap: a dashed faint outline with its "N KB free" label (or just the number if space is short)
              if (b.b > b.a) piece(k, b.a, b.b - b.a, b.b - b.a, b.n);  // the block itself, fully used, since dynamic partitions give exactly the size asked for; the end marker is skipped
              at = Math.max(at, b.b);  // moves at past this block
            });  // ends the walk over blocks
          }  // ends the dynamic case
          if (r.tech === 'paging') r.frames.forEach((f, i) => {  // paging: for each of the twelve frames
            k.push(R(X(i * PAGE), 50, 's-panel', { 'stroke-width': 2.5 }));  // the frame's grey box, 50 pixels wide (4 of 48 KB)
            if (f) piece(k, i * PAGE, PAGE, f.used, f.n + f.p);  // a frame holding a page draws it labeled with the process and page number (such as B2), with any unused part in amber
            k.push(R(X(i * PAGE), 50, 's-line', { fill: 'none', 'stroke-width': 2 }));  // the frame's outline again on top
            k.push(T(X(i * PAGE) + 25, BY + BH + 12 + 7 * big, String(i), ctx.narrow ? 14 : 12.5, { class: 's-sub' }));  // the frame number under each frame
          });  // ends the frames
          if (r.tech !== 'paging') for (let a = 0; a <= MEM; a += 8) k.push(T(X(a), BY + BH + 12 + 7 * big, a === MEM ? '48 KB' : String(a), ctx.narrow ? 14 : 12, { class: 's-sub', 'text-anchor': a === MEM ? 'end' : a ? 'middle' : 'start' }));  // fixed and dynamic: an address scale every 8 KB under the bar, the last one written "48 KB"
          svg.replaceChildren(...k);  // swaps the old picture for the new one
        }  // ends drawMem()
        let tech = 'fixed', at = 0;  // tech: the technique in the drawing (fixed at first); at: the event the player is on, kept when tabs are switched
        const sAns = [], tbl = h('table', { class: 'tbl compact ch7-tbl' }), verdict = h('div', { class: 'callout m0 small' });  // sAns: the answers in the second tab; tbl: the comparison table; verdict: the callout under the table
        function paintMeasure() {  // paintMeasure(): runs at every player step: draws the chosen technique, fills the table and returns the caption
          const all = TECHS.map(([t]) => run(t, at)), cur = all.find((x) => x.tech === tech);  // all: the three techniques replayed up to the same event; cur: the one chosen for the drawing
          drawMem(cur);  // draws the chosen technique
          tbl.replaceChildren(h('thead', {}, h('tr', {}, ...['Technique', 'Unused inside', 'Free (pieces)', 'Fits now', 'Waiting'].map((c) => h('th', {}, c)))),  // refills the table, starting with its header: Technique, Unused inside, Free (pieces), Fits now, Waiting
            h('tbody', {}, ...all.map((x, i) => h('tr', { class: x.tech === tech ? 'on' : '' }, h('td', {}, h('b', {}, TECHS[i][1].split(' ')[0])), h('td', { class: 'n' }, kb(x.internal)), h('td', { class: 'n' }, `${kb(x.free)} (${x.pieces})`), h('td', { class: 'n' }, x.fits ? kb(x.fits) : 'nothing'), h('td', { class: 'n' }, x.waiting.join(', ') || '—')))));  // one row per technique, the chosen one highlighted: the name's first word, internal waste, free memory and its pieces, the largest fit, who waits
          const who = (x) => (x.waiting.length ? `${list(x.waiting)} must wait` : 'everyone is loaded');  // who(x): "A and B must wait", or "everyone is loaded"
          const [F, D, Pg] = all;  // F, D and Pg: the results for fixed partitions, dynamic partitions and paging
          if (at === EV.length - 1) { verdict.className = 'callout why m0 small'; verdict.dataset.label = 'Same processes, three outcomes'; verdict.innerHTML = `<b>Fixed:</b> ${who(F)} while ${kb(F.internal)} sits unused inside partitions (<span class="t">internal fragmentation</span>). <b>Dynamic:</b> ${who(D)} while ${kb(D.free)} is free in ${D.pieces} gaps, none bigger than ${kb(D.fits)} (<span class="t">external fragmentation</span>). <b>Paging:</b> ${who(Pg)}; the only waste is ${kb(Pg.internal)} at the ends of last pages.`; }  // at the last event: a blue callout comparing the outcomes, naming internal and external fragmentation and paging's small waste
          else { verdict.className = 'callout tip m0 small'; verdict.dataset.label = 'Two kinds of waste'; verdict.innerHTML = '<b>Internal:</b> memory handed to a process that it never uses (the amber ends of blocks). <b>External:</b> free memory left between blocks in pieces too small to use (the dashed gaps). Step to the end: who gets F in?'; }  // before the end: a green tip that defines the two kinds of waste and asks who manages to load F
          ctx.refit();  // re-checks that the step still fits
          return cur.say;  // returns the chosen technique's sentence about the latest event, which the player shows as its caption
        }  // ends paintMeasure()
        const ST = [  // ST: the eight cases of the second tab as [text, right answer (0 internal, 1 external, 2 no waste), explanation]
          ['A 5 KB process is placed in a 12 KB fixed partition.', 0, '7 KB inside the partition belongs to the process but is never used. Waste inside an allocated block is internal fragmentation.'],  // case 1 (internal): a 5 KB process in a 12 KB fixed partition
          ['18 KB is free, but as gaps of 7 KB and 11 KB, so a 12 KB process cannot be loaded.', 1, 'Free memory outside every block, in pieces too small to use, is external fragmentation. Compaction could slide the blocks together and merge the gaps.'],  // case 2 (external): 18 KB free, but only as 7 KB and 11 KB gaps; the explanation mentions compaction
          ['A 9 KB process gets three 4 KB frames, and its last frame is only a quarter full.', 0, 'The last page holds 1 KB of a 4 KB frame, so 3 KB inside an allocated frame is unused: internal fragmentation, the only kind paging has.'],  // case 3 (internal): a 9 KB process whose last 4 KB frame is a quarter full
          ['The buddy system hands a 64 KB block to a request for 40 KB.', 0, 'Blocks come in powers of two, so 24 KB of the 64 KB block is allocated but unused: internal fragmentation.'],  // case 4 (internal): the buddy system handing a 64 KB block to a 40 KB request
          ['Under dynamic partitioning, the holes left between processes get smaller and more scattered over time.', 1, 'This is how external fragmentation grows: free memory between blocks, chopped into ever smaller pieces.'],  // case 5 (external): holes between processes getting smaller and more scattered
          ['Free frames are scattered all over memory, but any page can be placed in any one of them.', 2, 'Scattered frames are not wasted: every frame is exactly one page in size, so each is usable. That is why paging has no external fragmentation.'],  // case 6 (no waste): scattered free frames, each still usable for any page
          ['Segments of different lengths come and go, leaving gaps between them too small for the next segment.', 1, 'Segmentation places variable-size pieces just as dynamic partitioning does, so it suffers external fragmentation in the same way.'],  // case 7 (external): variable-length segments leaving gaps too small to use
          ['A process needs exactly 12 KB, is given exactly 12 KB, and fills it completely.', 2, 'Nothing is allocated but unused and no gap is created, so nothing is wasted.'],  // case 8 (no waste): a 12 KB process given exactly 12 KB
        ];  // closes the ST list
        const KINDS = ['Internal', 'External', 'No waste'];  // KINDS: the three answer button labels, in the order of the answer numbers
        let sCur = null;  // sCur: the case answered most recently, whose feedback is shown; null before any answer
        function classify(panel) {  // classify(panel): draws the "Internal, external or no waste?" tab when it is opened
          const cards = h('div', { class: 'ch7-cards' }), score = h('b', {}), fb = h('div', { class: 'callout m0 small ch7-sfb' });  // cards: the grid of case cards; score: the "n / 8 right" count; fb: the feedback callout
          function paint() {  // paint(): redraws the cards, the score and the feedback after every click
            cards.replaceChildren(...ST.map(([txt, right], i) => {  // rebuilds every card
              const a = sAns[i], st = a == null ? '' : a === right ? ' ok' : ' bad';  // a: the student's answer to this case; st: its green or red class once answered
              return h('div', { class: 'ch7-card' + st + (i === sCur ? ' on' : '') }, h('div', {}, txt),  // the card with its colors and, if answered last, a ring; the case text on top
                h('div', { class: 'row' }, ...KINDS.map((kd, j) => h('button', { class: 'btn sm' + (a === j ? (j === right ? ' ok' : ' bad') : ''), type: 'button', 'aria-pressed': String(a === j), onclick: () => { sAns[i] = j; sCur = i; paint(); } }, kd))));  // its three answer buttons; the chosen one turns green or red, and a click records the answer and makes this the current case
            }));  // ends the cards
            score.textContent = `${ST.filter((x, i) => sAns[i] === x[1]).length} / ${ST.length} right`;  // updates the score
            if (sCur == null) { fb.className = 'callout m0 small ch7-sfb'; fb.dataset.label = 'How to decide'; fb.innerHTML = 'Ask one question: is the wasted memory <b>inside</b> a block that was handed to a process (internal), <b>outside</b> every block, in free pieces too small to use (external), or is nothing wasted at all?'; }  // before any answer: a neutral "How to decide" callout with the one question to ask
            else { const [, right, why] = ST[sCur], ok = sAns[sCur] === right; fb.className = 'callout m0 small ch7-sfb ' + (ok ? 'tip' : 'bad'); fb.dataset.label = ok ? 'Right: ' + KINDS[right] : 'Not quite'; fb.innerHTML = ok ? why : `Not ${KINDS[sAns[sCur]].toLowerCase()}. Is the wasted memory inside a block that was handed out, or free memory between blocks? Or is anything wasted at all? Try again.`; }  // after an answer: the explanation in green if right, or a red "Not quite" hint asking the student to try again
            ctx.refit();  // re-checks that the step still fits
          }  // ends paint()
          panel.append(h('div', { class: 'stack ch7-pane', style: { gap: '10px' } },  // puts the tab's content in its panel, stacked 10px apart
            h('div', { class: 'row' }, h('span', { class: 'grow' }, 'Where is the memory lost in each case: inside a block, between blocks, or nowhere?'), score, h('button', { class: 'btn sm', type: 'button', onclick: () => { sAns.length = 0; sCur = null; paint(); } }, 'Start over')),  // top row: the question (stretched to fill the row), the score and a "Start over" button that clears every answer
            cards, fb,  // the cards and the feedback box
            h('div', { class: 'card tight small', html: '<b>Which technique wastes what:</b> fixed partitions → internal · dynamic partitions → external · buddy system → mostly internal, some external · paging → internal, only in each process’s last page · segmentation → external.' })));  // a small summary card: which technique wastes memory in which way
          paint();  // draws everything for the first time
        }  // ends classify()
        function measure(panel) {  // measure(panel): draws the "Measure the waste" tab when it is opened
          const seg = ctx.ui.seg(TECHS.map(([value, label]) => ({ value, label })), tech, (v) => { tech = v; pl.refresh(); });  // seg: the technique switch; choosing one redraws the current player step with that technique
          const host = h('div', { class: 'ch7-meas' });  // host: holds the player; its class gives the caption a minimum height
          panel.append(h('div', { class: 'split r fill ch7-pane' },  // two columns, the larger one on the left
            h('div', { class: 'stack', style: { gap: '8px' } }, h('div', { class: 'row' }, h('span', { class: 'small b' }, 'Technique:'), seg),  // left column: a row with the "Technique:" label and the switch
              h('div', { class: 'card white', style: { padding: '6px 8px' } }, svg,  // the white card holding the drawing
                h('div', { class: 'row xs', style: { justifyContent: 'center', gap: '8px' } }, h('span', { class: 'chip proc' }, 'used by a process'), h('span', { class: 'chip warn' }, 'allocated but unused'), h('span', { class: 'chip' }, 'dashed: free'))), host),  // a centered legend of three tags (used, allocated but unused, dashed free); then the player; ends the left column
            h('div', { class: 'stack', style: { gap: '10px' } }, h('div', { class: 'small', html: '<b>Seven events, replayed under each technique:</b> A (7 KB), B (11), C (9) and D (10) arrive, B leaves, then E (4) and F (12) arrive.' }), tbl, verdict,  // right column: the list of the seven events, the comparison table and the verdict callout
              h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'Paging does not remove all waste. It removes <b>external</b> fragmentation; the last page of a process is usually only partly full, so a little <b>internal</b> fragmentation remains.' }))));  // amber "Common mistake" callout: paging still leaves a little internal fragmentation; ends the layout
          const pl = ctx.ui.player({ count: EV.length, start: at, interval: 2200, captionBelow: true, render: (i) => { at = i; return paintMeasure(); } });  // the player: one step per event (counting the empty start), starting where the student left off, 2.2 seconds each
          host.append(pl.el);  // puts the player in its box
          return () => pl.stop();  // leaving the tab stops playback, so a hidden player cannot repaint the shared picture and table
        }  // ends measure()
        el.append(h('div', { class: 'fill ch7-tabs' }, ctx.ui.tabs([{ label: 'Measure the waste', render: measure }, { label: 'Internal, external or no waste?', render: classify }])));  // puts step 2 on screen: a full-height set of two tabs, measuring first and classifying second
      },  // ends render() for step 2
    },  // closes step 2
  ],  // closes the chapter's steps list
  notes: `${/* notes: the chapter 7 summary shown in the Notes drawer on the overview steps and in the printed guide */''}
    <h3>How Chapter 7 fits together</h3>${/* notes heading: how chapter 7 fits together */''}
    <p>Processes share one main memory and come and go. Section 7.1 lists five jobs of a memory manager:</p>${/* notes paragraph: processes share one memory, and section 7.1 lists five jobs for the manager */''}
    <ol>${/* starts the numbered list of the five jobs */''}
      <li><b>Relocation:</b> a process may be loaded, or swapped back in, at any address, so its addresses must be translated to wherever it lands.</li>${/* list item: relocation */''}
      <li><b>Protection:</b> no process may touch another’s memory, or the OS’s, without permission; hardware checks every address as it is used.</li>${/* list item: protection, checked by hardware on every access */''}
      <li><b>Sharing:</b> processes running the same code share one copy, under control.</li>${/* list item: sharing under control */''}
      <li><b>Logical organization:</b> programs are modules with different needs (read-only code, writable data).</li>${/* list item: logical organization into modules */''}
      <li><b>Physical organization:</b> memory is fast but small and volatile, the disk large and slow; moving data between them is the system’s job, not the programmer’s (the old answer was overlays).</li>${/* list item: physical organization, and overlays as the old answer */''}
    </ol>${/* ends the numbered list */''}
    <h4>Partitioning (7.2)</h4>${/* notes heading: partitioning (section 7.2) */''}
    <p><b>Fixed partitioning</b> cuts memory into set partitions; each process takes a whole one, so the unused end is lost to <b>internal fragmentation</b>. <b>Dynamic partitioning</b> gives each process exactly what it asks for, but departures leave holes, and free memory split into pieces too small to use is <b>external fragmentation</b>; compaction merges the holes at a cost. Placement chooses a hole: first-fit, best-fit or next-fit. The <b>buddy system</b> splits power-of-two blocks in half and merges free buddies. Base and bounds registers relocate and protect each process.</p>${/* notes paragraph: fixed and dynamic partitions, both kinds of fragmentation, placement, buddies, base and bounds */''}
    <h4>Paging and segmentation (7.3, 7.4)</h4>${/* notes heading: paging and segmentation (sections 7.3 and 7.4) */''}
    <p><b>Paging</b> cuts memory into equal frames and processes into pages of the same size; a page table maps each page to any free frame, and an address is (page number, offset). There is no external fragmentation, only a little internal fragmentation in each process’s last page. <b>Segmentation</b> cuts a process into variable-length segments that match its logical parts; an address is (segment number, offset), checked against the segment’s length. It suits protection and sharing but suffers external fragmentation.</p>${/* notes paragraph: page tables and (page, offset) addresses, then segments and their trade-off */''}
    <h4>A worked comparison</h4>${/* notes heading: a worked comparison */''}
    <p>In 48 KB of memory, A (7 KB), B (11), C (9) and D (10) arrive, B leaves, then E (4) and F (12) arrive. With four 12 KB fixed partitions, F waits while 5 + 8 + 3 + 2 = 18 KB sits unused inside partitions. With dynamic partitions and first fit, F waits because the 18 KB that is free lies in gaps of 7 KB and 11 KB. With 4 KB pages, F fits in three scattered frames, and the only waste is 1 + 3 + 2 = 6 KB at the ends of last pages.</p>${/* notes paragraph: step 2's seven events worked through under fixed partitions, dynamic partitions and paging */''}
    <h4>Loading and linking (7A)</h4>${/* notes heading: loading and linking (appendix 7A) */''}
    <p>A <b>linker</b> joins object modules into one load module; a <b>loader</b> puts it in memory using absolute, relocatable or dynamic run-time loading. Linking can be static, or dynamic at load time or run time with shared libraries.</p>${/* notes paragraph: what a linker and a loader do, and the kinds of loading and linking */''}
    <h4>Why it matters next</h4>${/* notes heading: why it matters next */''}
    <p>Chapter 8 leaves some pieces on disk entirely: virtual memory.</p>`,  // notes paragraph: chapter 8 leaves some pieces on disk, which is virtual memory; end of the notes text
});  // closes the chapter 7 object and the Guide.chapter call
Guide.chapter({  // registers chapter 8 with the guide
  num: 8,  // num: the chapter number; it sets the chapter's order, its color (--ch8) and page addresses such as #ch8
  title: 'Virtual Memory',  // title shown on the chapter card, the chapter overview page and the top-bar tooltip
  tagline: 'A program can run with only part of itself in memory. The trick is guessing which part, and paying as little as possible when the guess is wrong.',  // tagline: the one-sentence hook printed in the chapter color at the top of the chapter overview page
  intro: '<p>Paging and segmentation make it possible to keep only the pieces of a process that are actually in use in <span class="t">main memory</span> and leave the rest on disk. This is <span class="t">virtual memory</span>: each process sees a large private address space, and the hardware and the operating system bring pieces in on demand. The chapter first covers the hardware: page tables, multilevel and inverted tables, the translation lookaside buffer, page size and segmentation with paging. It then covers the operating system’s decisions: when to fetch a page, where to put it, which page to replace (OPT, LRU, FIFO, clock), how many frames each process gets, when to write changed pages back, and how to avoid thrashing. It ends with how UNIX, Solaris, Linux, Windows and Android manage memory.</p>',  // intro paragraph for the overview page; the span class="t" words show a definition when pointed at
  objectives: [  // objectives: the list shown under "After this chapter you will be able to" on the overview page and in the printed guide
    'Explain why virtual memory works, using the principle of locality, and what thrashing is.',  // objective 1: why locality makes virtual memory work, and what thrashing is
    'Translate addresses through single-level, two-level and inverted page tables and a TLB.',  // objective 2: address translation through the different kinds of page table and the TLB
    'Simulate the OPT, LRU, FIFO and clock replacement policies and count page faults.',  // objective 3: simulate four replacement policies and count page faults
    'Describe resident set management, the working set idea, cleaning policy and load control.',  // objective 4: resident sets, working sets, cleaning and load control
    'Compare the memory managers of UNIX, Solaris, Linux, Windows and Android.',  // objective 5: compare the memory managers of five real operating systems
  ],  // closes the objectives list
  terms: [  // terms: chapter-level glossary entries as [term, definition] pairs
    ['Virtual memory', 'A scheme in which a process can run with only part of its address space in main memory, the rest kept on disk and brought in when needed, so programs can be larger than physical memory.'],  // glossary entry: defines virtual memory
    ['Page fault', 'The interrupt that occurs when a process touches a page that is not in main memory; the OS must bring the page in before the instruction can continue.'],  // glossary entry: defines a page fault
    ['Thrashing', 'A state in which the system spends most of its time moving pages between memory and disk instead of doing useful work, because processes keep needing pages that were just thrown out.'],  // glossary entry: defines thrashing
    ['Principle of locality', 'Programs tend to use memory locations near the ones they used recently, so over a short period a process needs only a small part of its address space.'],  // glossary entry: defines the principle of locality
  ],  // closes the terms list
  css: ` /* css: style rules used only by chapter 8's overview steps; each rule starts with .sec-ch8, the canvas class on these steps */
    .sec-ch8 .ch8-pages { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 6px; } /* .ch8-pages: the twelve page buttons of step 1, six per row */
    .sec-ch8 .ch8-page { display: flex; flex-direction: column; align-items: center; gap: 1px; padding: 8px 2px; border: 1px solid var(--line-2); border-radius: 9px; background: var(--panel-2); color: var(--ink); cursor: pointer; font: inherit; line-height: 1.25; } /* .ch8-page: one page button: a bold name over a small status line, centered, in a light box with a hand cursor */
    .sec-ch8 .ch8-page:hover { border-color: var(--chc); } /* hovering a page button outlines it in the chapter color */
    .sec-ch8 .ch8-page b { font-size: 17px; } /* the page's name ("page 3") is fairly large */
    .sec-ch8 .ch8-page span { font-size: 13px; color: var(--muted); } /* the status line under it ("on disk") is small and grey */
    .sec-ch8 .ch8-page.in { border-color: var(--mem); background: var(--mem-bg); } /* .in: a page that is in memory is drawn in memory green */
    .sec-ch8 .ch8-page.in span { color: var(--mem); font-weight: 700; } /* and its status line ("in frame 2") turns bold green */
    .sec-ch8 .ch8-page.hot { box-shadow: 0 0 0 3px var(--chc); } /* .hot: the page touched last gets a thick chapter-colored ring */
    .sec-ch8 .ch8-frames { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; } /* .ch8-frames: the four memory frames side by side */
    .sec-ch8 .ch8-frame { border: 2px solid var(--mem); background: var(--mem-bg); border-radius: 10px; padding: 7px 8px; text-align: center; line-height: 1.3; min-height: 84px; } /* .ch8-frame: one frame: a green box with centered text and a minimum height so empty and full frames match */
    .sec-ch8 .ch8-frame.empty { border-style: dashed; border-color: var(--line-2); background: var(--panel-2); } /* .empty: an empty frame has a dashed grey outline and a neutral fill */
    .sec-ch8 .ch8-frame.new { border-color: var(--chc); } /* .new: the frame that has just received a page gets a chapter-colored border */
    .sec-ch8 .ch8-frame .big { font-size: 26px; line-height: 1.25; } /* the page name inside a frame is large */
    .sec-ch8 .ch8-strip { display: grid; grid-template-columns: repeat(15, 28px); gap: 4px; min-height: 60px; align-content: start; } /* .ch8-strip: the row of recent touches, fifteen 28px squares per row, with a minimum height so the layout does not jump */
    .sec-ch8 .ch8-strip span { width: 28px; height: 28px; display: inline-grid; place-items: center; border-radius: 5px; font: 700 12.5px var(--mono); } /* each square is 28px with its page number centered in the bold fixed-width font */
    .sec-ch8 .ch8-strip .h { background: var(--ok-bg); color: var(--ok); } /* .h: a hit is a green square */
    .sec-ch8 .ch8-strip .f { background: var(--bad-bg); color: var(--bad); } /* .f: a fault is a red square */
    .sec-ch8 .ch8-cap { min-height: 74px; } /* .ch8-cap: the narration box keeps a minimum height so the controls stay still */
    .sec-ch8 .ch8-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; } /* .ch8-stats: the three counters (references, faults, fault rate) side by side */
    .sec-ch8 .ch8-stat { text-align: center; padding: 6px 4px; } /* .ch8-stat: each counter card is centered with a little padding */
    .sec-ch8 .ch8-stat .big { font-size: 30px; line-height: 1.1; } /* the counter's number is large, but a little smaller than the usual big number */
    .sec-ch8 .ch8-map { display: flex; flex-direction: column; gap: 1px; font-size: 14px; line-height: 1.3; } /* .ch8-map: the chapter map card's body, its rows stacked in small text */
    .sec-ch8 .ch8-map div { display: flex; gap: 8px; } /* each map row puts the section number and its description side by side */
    .sec-ch8 .ch8-map b { flex: none; width: 34px; color: var(--chc); } /* the section number is bold, chapter-colored and a fixed 34px wide so the descriptions line up */
    @media (max-width: 760px) { /* @media (max-width: 760px): these rules apply only on windows 760px wide or less */
      .sec-ch8 .ch8-pages { grid-template-columns: repeat(4, minmax(0, 1fr)); } /* on a small screen the page buttons go four per row */
      .sec-ch8 .ch8-frames { grid-template-columns: repeat(2, minmax(0, 1fr)); } /* the frames go two per row */
      .sec-ch8 .ch8-strip { grid-template-columns: repeat(8, 28px); } /* and the strip of touches eight per row */
    } /* ends the small-window rules */
    .sec-ch8 .ch8-sit { border-left: 5px solid var(--chc); min-height: 128px; } /* .ch8-sit: the situation card of step 2, with a thick chapter-colored left edge and a minimum height */
    .sec-ch8 .ch8-sit p { font-size: 17.5px; line-height: 1.45; margin: 4px 0 0; } /* the situation text itself is large and well spaced */
    .sec-ch8 .ch8-pols { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; } /* .ch8-pols: the six policy buttons in two columns */
    .sec-ch8 .ch8-pol { display: flex; flex-direction: column; align-items: flex-start; gap: 3px; text-align: left; padding: 12px 14px; border: 1px solid var(--line); border-top: 4px solid var(--line-2); border-radius: 10px; background: var(--panel-2); color: var(--ink); cursor: pointer; font: inherit; line-height: 1.3; } /* .ch8-pol: one policy button: name, question and classic choices stacked and left-aligned, with a grey top edge */
    .sec-ch8 .ch8-pol:hover { border-color: var(--chc); } /* hovering a policy button outlines it in the chapter color */
    .sec-ch8 .ch8-pol b { font-size: 16px; } /* the policy name is bold at 16px */
    .sec-ch8 .ch8-pol .q { font-size: 14px; } /* .q: the question the policy answers */
    .sec-ch8 .ch8-pol .c { font-size: 12.5px; color: var(--muted); } /* .c: the classic choices for it, small and grey */
    .sec-ch8 .ch8-pol.ok { border-color: var(--ok); background: var(--ok-bg); } /* a right pick turns the button green */
    .sec-ch8 .ch8-pol.bad { border-color: var(--bad); background: var(--bad-bg); } /* a wrong pick turns it red */
    .sec-ch8 .ch8-fb { min-height: 100px; } /* .ch8-fb: the feedback box keeps a minimum height so the layout stays still */
    .sec-ch8 .ch8-tiles { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 5px; } /* .ch8-tiles: the twelve situation tiles, six per row */
    .sec-ch8 .ch8-tile { height: 34px; border: 1px solid var(--line); border-radius: 8px; background: var(--panel-2); color: var(--ink); font-weight: 800; font-size: 13.5px; cursor: pointer; } /* .ch8-tile: one tile, a 34px bold button; clicking it opens that situation */
    .sec-ch8 .ch8-tile.on { box-shadow: 0 0 0 2px var(--chc); } /* the tile of the situation on screen gets a chapter-colored ring */
    .sec-ch8 .ch8-tile.ok { background: var(--ok-bg); border-color: var(--ok); color: var(--ok); } /* a tile answered correctly turns green */
    .sec-ch8 .ch8-tile.bad { background: var(--bad-bg); border-color: var(--bad); color: var(--bad); } /* a tile answered wrongly turns red */
    @media (max-width: 760px) { /* @media (max-width: 760px): these rules apply only on windows 760px wide or less */
      .sec-ch8 .ch8-pols { grid-template-columns: minmax(0, 1fr); } /* on a small screen the policy buttons stack in one column */
    } /* ends the small-window rules */
  `,  // end of chapter 8's CSS text
  steps: [  // steps: the chapter's own overview steps, shown right after the chapter page and before section 8.1
    {  // step 1 of the chapter 8 overview
      title: 'A program bigger than memory',  // title shown at the top of step 1
      kind: 'story',  // kind "story" labels the step "Big Picture" and keeps it on the shorter core path
      render(el, ctx) {  // render(el, ctx): builds the step when it is shown; el is the empty step area, ctx holds the shell's helpers
        const { h } = ctx;  // h builds HTML elements; this step needs no drawing
        const NP = 12, NF = 4, RUN = 30, PHASE = 10, SHOW = 30;  // sizes: 12 pages, 4 frames, 30 references per played run, a clustered run moves on every 10 references, the strip shows the last 30
        let st, gen = 0, seed = 1, runs = [], story = '', mood = null;  // state: st (the live state), gen (run counter), seed, finished runs, the narration and mood (the kind of run that just ended)
        const fresh = () => ({ frames: Array(NF).fill(null), queue: [], refs: [], faults: 0, last: null });  // fresh(): empty memory: four empty frames, an empty load-order queue, no references, no faults, nothing touched yet
        // one reference to page p, with first-in-first-out replacement; returns a sentence about what happened
        function touch(p) {  // touch(p): one reference to page p, called by a page click or by a played run
          const f = st.frames.indexOf(p);  // f: the frame that holds page p, or -1 if it is on disk
          if (f >= 0) { st.refs.push({ p, hit: true }); st.last = { p, f, hit: true }; return `Page ${p} is already in frame ${f}: a <b>hit</b>. The access runs at full memory speed.`; }  // in memory: the reference is recorded as a hit and remembered as the last touch; the sentence says it ran at full speed
          st.faults++;  // otherwise it is a page fault, and the fault count goes up
          let into = st.frames.indexOf(null), out = null;  // into: the first empty frame; out: the page that will be thrown out, if any
          if (into < 0) { out = st.queue.shift(); into = st.frames.indexOf(out); }  // no empty frame: FIFO takes the page at the front of the queue, the one loaded longest ago, and reuses its frame
          st.frames[into] = p; st.queue.push(p);  // page p goes into that frame and joins the back of the queue
          st.refs.push({ p, hit: false }); st.last = { p, f: into, hit: false };  // the reference is recorded as a fault and remembered as the last touch
          return `Page ${p} is not in memory: a <span class="t">page fault</span>. ` + (out === null ? `The OS reads it from disk into empty frame ${into}.` : `All ${NF} frames are full, so <span class="t" data-t="First-in-first-out (FIFO)">FIFO</span> evicts page ${out}, the page that has been in memory longest, and reads page ${p} into frame ${into}.`);  // the sentence names the page fault and says either that an empty frame was used or which page FIFO threw out
        }  // ends touch()
        // a run of references: random over all pages, or clustered (three neighbouring pages at a time, moving on every PHASE references)
        function makeRefs(kind, rng) {  // makeRefs(kind, rng): builds a list of 30 page numbers, random or clustered, using the seeded generator rng
          const out = [];  // out collects the page numbers
          let base = 0;  // base: the lowest page of the cluster a clustered run is working in
          for (let i = 0; i < RUN; i++) {  // makes 30 references
            if (kind === 'rand') { out.push(Math.floor(rng() * NP)); continue; }  // a random run: any of the 12 pages, equally likely; continue moves on to the next reference
            if (i % PHASE === 0) base = Math.floor(rng() * (NP - 2));  // a clustered run picks a new base every 10 references, from 0 to 9 so three neighbouring pages always exist
            out.push(base + Math.floor(rng() * 3));  // each reference is one of the three pages starting at base
          }  // ends the loop
          return out;  // returns the list of page numbers
        }  // ends makeRefs()
        const pageBox = h('div', { class: 'ch8-pages' }), frameBox = h('div', { class: 'ch8-frames' }), strip = h('div', { class: 'ch8-strip', 'aria-label': 'Recent references: green hit, red fault' });  // pageBox: the grid of page buttons; frameBox: the four frames; strip: the recent touches, labeled for screen readers
        const caption = h('div', { class: 'player-cap ch8-cap', 'aria-live': 'polite' });  // caption: the narration box; aria-live makes screen readers read each new sentence
        const stats = h('div', { class: 'ch8-stats' }), runBox = h('div', { class: 'small' }), note = h('div', { class: 'callout m0 small' });  // stats: the three counters; runBox: the results of recent full runs; note: the callout that explains what the last run showed
        const pageBtns = [];  // pageBtns: the 12 page buttons, filled in by draw()
        for (let p = 0; p < NP; p++) pageBtns.push(h('button', { class: 'ch8-page', type: 'button', onclick: () => { gen++; story = touch(p); mood = null; draw(); } }));  // one button per page; a click stops any run that is playing, touches that page, clears the note's mood and redraws
        pageBox.append(...pageBtns);  // puts the buttons in the page grid
        function draw() {  // draw(): redraws pages, frames, strip, counters and notes from the state st
          pageBtns.forEach((b, p) => {  // for each page button:
            const f = st.frames.indexOf(p);  // f: the frame holding the page, or -1
            b.className = 'ch8-page' + (f >= 0 ? ' in' : '') + (st.last && st.last.p === p ? ' hot' : '');  // the button turns green if the page is in memory and gets a ring if it was touched last
            b.replaceChildren(h('b', {}, 'page ' + p), h('span', {}, f >= 0 ? 'in frame ' + f : 'on disk'));  // its text: "page n" and either "in frame f" or "on disk"
            b.setAttribute('aria-label', `Touch page ${p} (${f >= 0 ? 'in frame ' + f : 'on disk'})`);  // a label that tells screen readers what clicking it will do and where the page is
          });  // ends the page buttons
          const full = st.frames.every((x) => x !== null);  // full: whether every frame holds a page
          frameBox.replaceChildren(...st.frames.map((p, f) => h('div', { class: 'ch8-frame' + (p === null ? ' empty' : '') + (st.last && st.last.f === f && !st.last.hit ? ' new' : '') },  // rebuilds the four frames: an empty one is dashed, and the one that just took a page after a fault is marked new
            h('div', { class: 'xs muted b' }, 'FRAME ' + f), h('div', { class: 'big' }, p === null ? '—' : 'page ' + p),  // each frame shows "FRAME n" in small capitals and its page in large text (a dash if empty)
            h('div', { class: 'xs' }, p === null ? 'empty' : full && st.queue[0] === p ? 'oldest: next out' : 'loaded ' + ordinal(st.queue.indexOf(p) + 1)))));  // under it: "empty", "oldest: next out" for FIFO's next victim when memory is full, or its load order such as "loaded 2nd"
          strip.replaceChildren(...st.refs.slice(-SHOW).map((r) => h('span', { class: r.hit ? 'h' : 'f', title: r.hit ? 'hit' : 'fault' }, String(r.p))));  // the strip: the last 30 references as small squares with the page number, green for a hit, red for a fault
          const n = st.refs.length;  // n: the number of references so far
          stats.replaceChildren(...[['REFERENCES', n], ['PAGE FAULTS', st.faults], ['FAULT RATE', n ? Math.round((100 * st.faults) / n) + '%' : '—']].map(([l, v]) => h('div', { class: 'card tight ch8-stat' }, h('div', { class: 'xs muted b' }, l), h('div', { class: 'big' }, String(v)))));  // three counter cards: references, page faults and the fault rate as a percentage (a dash before any reference)
          runBox.innerHTML = runs.length ? runs.slice(-3).map((r) => `<div>${r.kind === 'loc' ? 'Clustered' : 'Random'} run: <b>${r.faults}</b> faults in ${r.n} references (${Math.round((100 * r.faults) / r.n)}%)</div>`).join('') : '<div class="muted">No full runs yet. Each run starts with empty memory.</div>';  // runBox: the last three full runs, each with its kind, its faults and its fault rate; or a note that none has run yet
          caption.innerHTML = story;  // puts the narration in the caption box
          const NOTE = {  // NOTE: the three possible notes, each as [callout color, label, text]
            loc: ['tip', 'Locality at work', 'The program stays in a few neighbouring pages for a while, so after the first faults of each phase almost every reference hits. That is the <span class="t">principle of locality</span>, and it is why <span class="t">virtual memory</span> works.'],  // after a clustered run: a green tip explaining locality and why virtual memory works
            rand: ['bad', 'This is what thrashing looks like', 'With no locality, any 4 pages are as good a guess as any other 4, so most references fault and wait for the disk. A system that spends most of its time moving pages instead of running is <span class="t">thrashing</span>.'],  // after a random run: a red note explaining that this is what thrashing looks like
            none: ['why', 'Why only part of a program?', 'A process seldom needs all its pages at once. Keep the pages in use in memory, leave the rest on disk, and fetch a page only when it is touched. Compare the two kinds of run.'],  // otherwise: a blue note on why only part of a program needs to be in memory
          }[mood || 'none'];  // picks the note that matches the latest run, or the default one
          note.className = 'callout m0 small ' + NOTE[0]; note.dataset.label = NOTE[1]; note.innerHTML = NOTE[2];  // sets the note callout's color, label and text
          ctx.refit();  // re-checks that the step still fits
        }  // ends draw()
        const ordinal = (k) => k + (k === 1 ? 'st' : k === 2 ? 'nd' : k === 3 ? 'rd' : 'th');  // ordinal(k): writes 1, 2, 3, 4 as 1st, 2nd, 3rd, 4th for the "loaded" labels
        function reset() { gen++; st = fresh(); mood = null; story = `Process P has ${NP} pages but only ${NF} frames of <span class="t">main memory</span>. Click the pages the program touches, or play a whole run of ${RUN} references.`; draw(); }  // reset(): stops any run, empties memory, sets the opening narration and redraws
        // plays one run of references from empty memory, one every 260 ms; Reset or a click cancels it
        function play(kind) {  // play(kind): runs when one of the two play buttons is clicked
          gen++; const g = gen; st = fresh(); mood = null;  // gen++ stops any earlier run and g remembers this one; memory starts empty and the note goes back to its default
          const refs = makeRefs(kind, ctx.util.seeded(seed++));  // refs: a new list of 30 references from a newly seeded generator, so each run differs
          story = kind === 'loc' ? 'A run with locality: the program works in three neighbouring pages, then moves on to another three.' : 'A run with no locality: every reference picks any of the 12 pages at random.';  // the narration explains how this kind of run picks its pages
          draw();  // draws the empty starting state
          let i = 0;  // i: the position of the next reference in the list
          const tick = () => {  // tick(): makes one reference
            if (g !== gen || !ctx.alive) return;  // stops quietly if a newer run has started or the student has left the step
            story = `Reference ${i + 1} of ${RUN}. ` + touch(refs[i]); i++;  // the narration counts the reference and adds what happened; i moves on
            if (i === RUN) { runs.push({ kind, faults: st.faults, n: RUN }); mood = kind; }  // after the last reference the run's result is saved and the mood is set, so the matching note appears
            draw();  // redraws everything
            if (i < RUN) ctx.after(260, tick);  // schedules the next reference 260 ms later until all 30 are done
          };  // ends tick()
          ctx.after(400, tick);  // the first reference comes 400 ms after the click
        }  // ends play()
        const MAP = [['8.1', 'Hardware: page tables, the TLB, page size, segmentation'], ['8.2', 'Six OS policies, from fetch to load control'], ['8.3', 'UNIX and Solaris'], ['8.4', 'Linux'], ['8.5', 'Windows'], ['8.6', 'Android']];  // MAP: the chapter's sections as [number, one-line summary] for the chapter map card
        el.append(h('div', { class: 'split r fill' },  // puts step 1 on screen: two columns, the larger one on the left
          h('div', { class: 'stack', style: { gap: '8px' } },  // left column, stacked 8px apart:
            h('div', { class: 'small b' }, 'Process P’s 12 pages (click one to touch it)'), pageBox,  // the label "Process P's 12 pages (click one to touch it)" and the page buttons
            h('div', { class: 'small b' }, 'Main memory: 4 frames'), frameBox,  // the label "Main memory: 4 frames" and the frames
            h('div', { class: 'row nw', style: { gap: '10px', alignItems: 'flex-start' } }, h('span', { class: 'xs muted b', style: { flex: 'none', width: '64px', marginTop: '5px' } }, 'LAST 30 TOUCHES'), strip),  // a non-wrapping row: the small "LAST 30 TOUCHES" label at a fixed 64px width, then the strip
            caption,  // the narration box
            h('div', { class: 'callout analogy m0 small', 'data-label': 'Analogy', html: 'Your desk holds four open books; the rest stay on a shelf down the hall. Fetching a book (a page fault) is slow, so you want the desk to hold the books you are using right now. If each next book is a random one, the whole evening goes on walks to the shelf.' })),  // purple analogy callout: four open books on a desk and a shelf down the hall; ends the left column
          h('div', { class: 'stack', style: { gap: '8px' } },  // right column, stacked 8px apart:
            stats,  // the three counters
            h('div', { class: 'xs muted' }, 'A hit costs one memory access (around 100 ns). A fault waits for the disk: thousands to hundreds of thousands of times longer, depending on the drive.'),  // small grey note: a hit costs about one memory access, a fault thousands of times more
            h('div', { class: 'row' }, h('button', { class: 'btn sm primary', type: 'button', onclick: () => play('loc') }, 'Play a run with locality'), h('button', { class: 'btn sm', type: 'button', onclick: () => play('rand') }, 'Play a random run'), h('button', { class: 'btn sm ghost', type: 'button', onclick: reset }, 'Reset')),  // button row: "Play a run with locality" (the main action), "Play a random run" and a quiet Reset
            runBox, note,  // the recent runs and the note callout
            h('div', { class: 'card tight' }, h('h4', { class: 'm0', style: { marginBottom: '4px' } }, 'The chapter map'), h('div', { class: 'ch8-map' }, ...MAP.map(([n, d]) => h('div', {}, h('b', {}, n), h('span', {}, d))))))));  // card: the chapter map; ends the layout
        reset();  // starts with empty memory when the step opens
      },  // ends render() for step 1
    },  // closes step 1
    {  // step 2 of the chapter 8 overview
      title: 'Six decisions every virtual memory system makes',  // title shown at the top of step 2
      kind: 'explore',  // kind "explore" labels the step "Explore"
      render(el, ctx) {  // render(el, ctx): builds step 2 when it is shown
        const { h } = ctx;  // h is the helper that builds HTML elements
        const POL = [  // POL: the six policy cards as [key, name, the question it answers, the classic choices]
          ['fetch', 'Fetch policy', 'When is a page brought into memory?', 'demand paging · prepaging'],  // decision: fetch policy, when a page comes in
          ['place', 'Placement policy', 'Where in real memory does a piece go?', 'first fit, best fit (segments) · any frame (pages)'],  // decision: placement policy, where a piece goes
          ['replace', 'Replacement policy', 'Which page leaves when memory is full?', 'OPT · LRU · FIFO · clock'],  // decision: replacement policy, which page leaves
          ['resident', 'Resident set management', 'How many frames per process, and whose page may go?', 'fixed or variable · local or global'],  // decision: resident set management, how many frames and whose pages may go
          ['clean', 'Cleaning policy', 'When is a changed page written back to disk?', 'demand cleaning · precleaning'],  // decision: cleaning policy, when changed pages are written back
          ['load', 'Load control', 'How many processes are in memory at once?', 'admit more · suspend some'],  // decision: load control, how many processes are in memory
        ];  // closes the POL list
        const NAME = Object.fromEntries(POL.map(([k, n]) => [k, n]));  // NAME: looks up a decision's full name from its key
        const SIT = [  // SIT: the twelve situations as [right key, situation text, explanation shown when answered right]
          ['fetch', 'A program has just started. Should the OS bring in only the pages it touches, when it touches them, or also the pages stored next to them on disk?', 'When pages come in is the <span class="t">fetch policy</span>. <span class="t">Demand paging</span> loads a page only when it faults; <span class="t">prepaging</span> also brings its neighbours, betting they will be needed soon.'],  // situation 1 (fetch): only the touched pages, or their neighbours on disk too
          ['replace', 'A page fault occurs and every frame is full. The OS must choose one page to throw out.', 'Choosing the victim is the <span class="t">replacement policy</span>. OPT, LRU, FIFO and clock are the classic answers, each a different guess about which page will not be needed soon.'],  // situation 2 (replacement): every frame is full and one page must go
          ['resident', 'A process keeps faulting. Should it get more frames, and when it needs one, may it take a frame from another process?', 'How many frames a process holds (fixed or variable) and whether a victim may belong to another process (local or global scope) is resident set management: the <span class="t">resident set</span> is the part of a process that is in memory.'],  // situation 3 (resident set): more frames for a busy process, and whether it may take another's
          ['clean', 'A page that was changed in memory must reach the disk at some point. Should it be written only when it is chosen to leave, or ahead of time in batches?', 'When modified pages are written back is the <span class="t">cleaning policy</span>: demand cleaning writes a page only when it is replaced; precleaning writes ahead of time, often in batches.'],  // situation 4 (cleaning): write a changed page when it leaves, or earlier in batches
          ['load', 'So many processes are loaded that each has too few frames and the disk is busy all the time. The OS suspends a few processes to give the others room.', 'Deciding how many processes share memory at once is <span class="t">load control</span>. Too many and every process faults constantly; suspending some is the cure for that kind of thrashing.'],  // situation 5 (load control): suspend some processes so the rest have room
          ['place', 'In a system that uses pure segmentation, a new segment must go into a free hole. First fit or best fit?', 'Where a piece goes in real memory is the <span class="t">placement policy</span>. It matters for segmentation, which has holes of different sizes, and hardly at all for paging.'],  // situation 6 (placement): first fit or best fit for a new segment
          ['replace', 'The frames that hold the kernel’s most important code are locked, so they are never chosen when a page must go.', 'Locked frames are simply not candidates for replacement. <span class="t">Frame locking</span> is a rule inside the replacement policy.'],  // situation 7 (replacement): locked kernel frames are never chosen
          ['resident', 'The OS watches which pages each process used during its last few thousand references and tries to keep that many frames for it.', 'Sizing each process’s share of memory from its recent behaviour is resident set management; the set of recently used pages is its <span class="t">working set</span>.'],  // situation 8 (resident set): keep as many frames as the pages recently used, the working set
          ['place', 'On a paging system, an incoming page can go into any free frame, because every frame works the same way.', 'That is still the placement decision, and for plain paging it is trivial: every frame is equally good. (On machines where some memory is closer to some processors, placement matters again.)'],  // situation 9 (placement): on paging, any free frame will do
          ['fetch', 'When a suspended process is brought back into memory, the OS loads a whole group of its pages at once instead of waiting for faults.', 'Bringing in pages before they are asked for is prepaging, one answer to the fetch policy question.'],  // situation 10 (fetch): load a group of pages when a suspended process returns
          ['clean', 'A background task writes modified pages to disk while the system is quiet, so they are already clean when they are chosen to leave.', 'Writing changed pages ahead of need is precleaning, one answer to the cleaning policy question.'],  // situation 11 (cleaning): write changed pages in the background while the system is quiet
          ['load', 'A new process is admitted only while the processes already in memory are faulting rarely.', 'Admitting processes only while faults are rare keeps the number of processes in memory, the multiprogramming level, where the system works best: load control.'],  // situation 12 (load control): admit a new process only while faults are rare
        ];  // closes the SIT list
        const ans = SIT.map(() => null);  // ans: the student's answer for each situation, null until one is picked
        let cur = 0;  // cur: the situation on screen, counting from 0
        const sit = h('div', { class: 'card white ch8-sit', 'aria-live': 'polite' }), fb = h('div', { class: 'callout m0 small ch8-fb' }), tiles = h('div', { class: 'ch8-tiles' }), score = h('span', { class: 'big', style: { fontSize: '30px' } });  // sit: the situation card; fb: the feedback callout; tiles: the twelve situation tiles; score: the "n / 12" count at 30px
        const btns = POL.map(([k, n, q, c]) => h('button', { class: 'ch8-pol', type: 'button', onclick: () => { ans[cur] = k; paint(); } }, h('b', {}, n), h('span', { class: 'q' }, q), h('span', { class: 'c' }, c)));  // btns: the six policy cards; clicking one records it as the answer to the current situation and repaints
        const nextOpen = () => { for (let k = 1; k <= SIT.length; k++) { const j = (cur + k) % SIT.length; if (ans[j] !== SIT[j][0]) return j; } return (cur + 1) % SIT.length; };  // nextOpen(): the next situation after the current one that is not yet right, wrapping round; if all are right, simply the next
        function paint() {  // paint(): redraws the situation, the cards, the feedback, the tiles and the score after every click
          const [right, text, why] = SIT[cur], a = ans[cur], ok = a === right;  // right: the correct decision's key; text and why: the situation and its explanation; a: the student's answer; ok: whether it is right
          sit.innerHTML = `<div class="xs muted b">SITUATION ${cur + 1} OF ${SIT.length}</div><p>${text}</p>`;  // fills the situation card with "SITUATION n OF 12" in small grey capitals and the text
          btns.forEach((b, i) => { const k = POL[i][0]; b.classList.toggle('ok', a === k && ok); b.classList.toggle('bad', a === k && !ok); b.setAttribute('aria-pressed', String(a === k)); });  // marks the chosen card green if right or red if wrong, and tells screen readers which one is pressed
          fb.className = 'callout m0 small ch8-fb ' + (a === null ? '' : ok ? 'tip' : 'bad');  // sets the feedback box's color: plain before an answer, green tip if right, red if wrong
          fb.dataset.label = a === null ? 'Your call' : ok ? 'Right: ' + NAME[right] : 'Not quite';  // the feedback box's small label: "Your call", "Right: " plus the decision, or "Not quite"
          const qOf = (k) => POL.find((p) => p[0] === k)[2].toLowerCase();  // qOf(k): a decision's question in lower case, used in the wrong-answer hint
          fb.innerHTML = a === null ? 'Which of the six decisions is this situation about? Click that decision’s card.' : ok ? why : `${NAME[a]} answers “${qOf(a)}” Is that the question here? Try another.`;  // feedback text: the instruction before an answer, the explanation if right, or the question the chosen decision answers if wrong
          tiles.replaceChildren(...SIT.map((x, i) => {  // rebuilds the twelve situation tiles
            const stt = ans[i] === null ? '' : ans[i] === x[0] ? ' ok' : ' bad';  // stt: the tile's color class: none if unanswered, ok if right, bad if wrong
            return h('button', { class: 'ch8-tile' + stt + (i === cur ? ' on' : ''), type: 'button', 'aria-label': `Situation ${i + 1}`, onclick: () => { cur = i; paint(); } }, (stt === ' ok' ? '✓' : stt === ' bad' ? '✗' : '') + (i + 1));  // each tile shows its number, with a check or cross mark once answered; clicking it opens that situation
          }));  // ends the tiles
          score.textContent = `${SIT.filter((x, i) => ans[i] === x[0]).length} / ${SIT.length}`;  // the score: how many situations are answered right, out of twelve
          ctx.refit();  // re-checks that the step still fits
        }  // ends paint()
        el.append(h('div', { class: 'split l fill' },  // puts step 2 on screen: two columns, the smaller one on the left this time (split l)
          h('div', { class: 'stack', style: { gap: '9px' } }, sit, fb,  // left column, stacked 9px apart: the situation card and the feedback
            h('div', { class: 'row' }, h('button', { class: 'btn sm primary', type: 'button', onclick: () => { cur = nextOpen(); paint(); } }, 'Next situation ▶'), h('span', { class: 'grow' }), score, h('span', { class: 'small b' }, 'right'),  // a row: "Next situation" (jumps to the next one not yet right), a spacer that pushes the score and the word "right" to the end
              h('button', { class: 'btn sm', type: 'button', onclick: () => { ans.fill(null); cur = 0; paint(); } }, 'Start over')),  // and a "Start over" button that clears every answer and returns to situation 1
            tiles,  // the situation tiles
            h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'Replacement decides <b>which page</b> leaves. Resident set management decides <b>how many frames</b> a process may have and <b>whose</b> pages are candidates. They work together, but they are different questions.' })),  // amber "Common mistake" callout: replacement picks which page, resident set management how many and whose; ends the left column
          h('div', { class: 'stack', style: { gap: '9px' } },  // right column, stacked 9px apart:
            h('div', { class: 'small b' }, 'The six decisions (section 8.2 covers each one):'),  // the label over the policy cards
            h('div', { class: 'ch8-pols' }, ...btns),  // the six policy cards in two columns
            h('div', { class: 'callout why m0 small', 'data-label': 'Why it matters', html: 'One page fault can touch five of them at once: the fault is a fetch, a full memory needs a victim (replacement) chosen within the process’s allowance (resident set), a changed victim must be written back (cleaning), and the new page needs a frame (placement). Load control watches the whole system.' }))));  // blue "Why it matters" callout: one page fault can involve five of the decisions at once; ends the layout
        paint();  // draws the first situation when the step opens
      },  // ends render() for step 2
    },  // closes step 2
  ],  // closes the chapter's steps list
  notes: `${/* notes: the chapter 8 summary shown in the Notes drawer on the overview steps and in the printed guide */''}
    <h3>How Chapter 8 fits together</h3>${/* notes heading: how chapter 8 fits together */''}
    <p><b>Virtual memory</b> lets a process run with only some of its pieces in memory. The pieces that are present form the process’s <b>resident set</b>; touching any other piece causes a <b>page fault</b>: the process is blocked while the OS reads the page from disk, often evicting another page. In the overview, 12 pages share 4 frames under first-in-first-out replacement: clustered references fault mainly when the program moves to a new cluster, random ones most of the time.</p>${/* notes paragraph: virtual memory, the resident set and what happens on a page fault */''}
    <p>This works because of the <b>principle of locality</b>: over a short period, a program uses only a few of its pages (a loop, the function it is in, the data it walks through), so the recent past predicts the near future. When that fails, or each process has too few frames for the pages it is using, the system spends most of its time moving pages instead of running programs. That is <b>thrashing</b>.</p>${/* notes paragraph: the principle of locality, and thrashing when it fails */''}
    <h4>The hardware (8.1)</h4>${/* notes heading: the hardware (section 8.1) */''}
    <p>Each page table entry holds a frame number plus a present bit and a modified bit. Tables too big to keep whole are split into two or more levels, or replaced by an inverted table with one entry per frame. A translation lookaside buffer (TLB) caches recent translations so most references skip the table. Page size is a trade-off between internal fragmentation and table size, and segmentation can be combined with paging.</p>${/* notes paragraph: page table entries, multilevel and inverted tables, the TLB, page size and segmentation with paging */''}
    <h4>The operating system’s six decisions (8.2)</h4>${/* notes heading: the operating system's six decisions (section 8.2) */''}
    <ul>${/* starts the bulleted list of the six decisions */''}
      <li><b>Fetch policy:</b> when a page comes in: demand paging (only on a fault) or prepaging (neighbours too).</li>${/* bullet: fetch policy, demand paging or prepaging */''}
      <li><b>Placement policy:</b> where it goes; important for segmentation, trivial for plain paging.</li>${/* bullet: placement policy, which matters for segmentation */''}
      <li><b>Replacement policy:</b> which page leaves: OPT (the ideal, needs the future), LRU, FIFO and clock; locked frames are never chosen.</li>${/* bullet: replacement policy, its four classic answers and locked frames */''}
      <li><b>Resident set management:</b> how many frames each process gets (fixed or variable) and whether a victim may come from another process (local or global scope); the working set guides the size.</li>${/* bullet: resident set management, its size and scope, guided by the working set */''}
      <li><b>Cleaning policy:</b> when changed pages are written back: on demand or ahead of time (precleaning).</li>${/* bullet: cleaning policy, on demand or ahead of time */''}
      <li><b>Load control:</b> how many processes are in memory at once; suspending some is the cure for thrashing caused by overcrowding.</li>${/* bullet: load control, the cure for thrashing caused by overcrowding */''}
    </ul>${/* ends the bulleted list */''}
    <h4>Real systems (8.3 to 8.6)</h4>${/* notes heading: real systems (sections 8.3 to 8.6) */''}
    <p>UNIX SVR4 and Solaris keep four paging tables, use copy on write, a two-handed clock and a lazy buddy kernel allocator (8.3). Linux describes its multilevel page tables the same way on every processor, with a buddy allocator, active and inactive lists and the slab allocator (8.4). Windows lets a process reserve and commit regions and grows and trims working sets (8.5). Android adds ashmem, ION, zram compression, trim requests to apps and a low-memory killer (8.6).</p>${/* notes paragraph: how UNIX and Solaris, Linux, Windows and Android manage memory */''}
    <h4>Why it matters next</h4>${/* notes heading: why it matters next */''}
    <p>Chapter 9 turns to the processor: which ready process runs next.</p>`,  // notes paragraph: chapter 9 turns to scheduling the processor; end of the notes text
});  // closes the chapter 8 object and the Guide.chapter call
Guide.chapter({  // registers chapter 9 with the guide
  num: 9,  // num: the chapter number; it sets the chapter's order, its color (--ch9) and page addresses such as #ch9
  title: 'Uniprocessor Scheduling',  // title shown on the chapter card, the chapter overview page and the top-bar tooltip
  tagline: 'One processor, many ready processes. Who runs next decides how fast, fair and responsive the whole system feels.',  // tagline: the one-sentence hook printed in the chapter color at the top of the chapter overview page
  intro: '<p>On a computer with one processor, only one process can run at a time, so the operating system must keep choosing which one runs next. This chapter separates scheduling into long-term, medium-term and short-term decisions, then focuses on the short-term scheduler (the <span class="t">dispatcher</span>). It defines the goals a scheduler is judged by, such as response time, turnaround time, throughput and fairness, and then lets you run the classic algorithms side by side: first-come-first-served, round robin, shortest process next, shortest remaining time, highest response ratio next and feedback. It ends with fair-share scheduling and the traditional UNIX scheduler.</p>',  // intro paragraph for the overview page; the span class="t" words show a definition when pointed at
  objectives: [  // objectives: the list shown under "After this chapter you will be able to" on the overview page and in the printed guide
    'Distinguish long-term, medium-term and short-term scheduling.',  // objective 1: tell the three levels of scheduling apart
    'Define user-oriented and system-oriented scheduling criteria and the idea of priorities.',  // objective 2: user-oriented and system-oriented criteria, and priorities
    'Simulate FCFS, round robin, SPN, SRT, HRRN and feedback scheduling and compute turnaround and normalized turnaround times.',  // objective 3: simulate six scheduling policies and work out turnaround times
    'Explain preemptive versus nonpreemptive scheduling and the effect of the time quantum.',  // objective 4: preemptive versus nonpreemptive, and how the time quantum matters
    'Describe fair-share scheduling and the traditional UNIX priority calculation.',  // objective 5: fair-share scheduling and the traditional UNIX priority formula
  ],  // closes the objectives list
  terms: [  // terms: chapter-level glossary entries as [term, definition] pairs
    ['Dispatcher', 'The short-term scheduler: the part of the OS that picks which ready process runs next and switches the processor to it.'],  // glossary entry: defines the dispatcher
    ['Turnaround time', 'The total time from a process’s arrival to its completion, including waiting and running.'],  // glossary entry: defines turnaround time
    ['Response time', 'For an interactive process, the time from submitting a request until the first response starts to appear.'],  // glossary entry: defines response time
    ['Throughput', 'How many processes (or jobs) the system completes per unit of time.'],  // glossary entry: defines throughput
    ['Long-term scheduling', 'The decision to admit a new program into the system as a process, which sets how many processes compete for the processor.'],  // glossary entry: defines long-term scheduling
    ['Medium-term scheduling', 'The decision to swap a process out of main memory to disk, or back in; it is part of the swapping function.'],  // glossary entry: defines medium-term scheduling
    ['Short-term scheduling', 'The frequent decision about which ready process runs on the processor next; it is made by the dispatcher.'],  // glossary entry: defines short-term scheduling
    ['Waiting time', 'The total time a process spends ready to run but not running, sitting in the ready queue while others use the processor.'],  // glossary entry: defines waiting time
  ],  // closes the terms list
  css: ` /* css: style rules used only by chapter 9's overview steps; each rule starts with .sec-ch9, the canvas class on these steps */
    .sec-ch9 .ch9-desc { min-height: 104px; border-left: 5px solid var(--chc); } /* .ch9-desc: the card under step 1's state diagram, with a minimum height and a thick chapter-colored left edge */
    .sec-ch9 .ch9-prow { display: grid; grid-template-columns: 104px minmax(0, 1fr) minmax(0, 1fr); gap: 10px; align-items: center; padding: 6px 8px; border: 1px solid var(--line); border-radius: 10px; background: var(--panel-2); } /* .ch9-prow: one process row in the dispatcher game: name (104px), work done and time waited, in a light rounded box */
    .sec-ch9 .ch9-prow.done { opacity: .75; } /* .done: a finished process's row fades slightly */
    .sec-ch9 .ch9-pips { display: flex; gap: 3px; flex-wrap: wrap; align-items: center; } /* .ch9-pips: a wrapping row of small squares, one per tick */
    .sec-ch9 .ch9-pips i { width: 16px; height: 16px; border-radius: 4px; border: 1.5px solid var(--cpu); background: var(--panel); } /* each square is 16px with a processor-blue outline and a plain fill */
    .sec-ch9 .ch9-pips i.on { background: var(--cpu); } /* .on: a tick of work already done is filled blue */
    .sec-ch9 .ch9-pips i.w { border-color: var(--bad); background: var(--bad-bg); } /* .w: a tick spent waiting is drawn in red */
    .sec-ch9 .ch9-gantt { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 3px; } /* .ch9-gantt: the processor's timeline in the game, seven equal cells, one per tick */
    .sec-ch9 .ch9-gantt span { height: 30px; display: grid; place-items: center; border-radius: 6px; font-weight: 800; font-size: 14px; background: var(--panel-3); color: var(--muted); } /* each timeline cell is a 30px rounded box with a bold grey tick number until a process uses it */
    .sec-ch9 .ch9-gantt span.on { background: var(--cpu-bg); color: var(--cpu); border: 1.5px solid var(--cpu); } /* .on: a used tick turns processor blue with an outline and shows the letter of the process that ran */
    .sec-ch9 .ch9-cap { min-height: 66px; } /* .ch9-cap: the game's narration box keeps a minimum height so the controls stay still */
    .sec-ch9 .ch9-srow { display: grid; grid-template-columns: 82px minmax(0, 1fr) 132px; gap: 8px; align-items: center; } /* .ch9-srow: one row of step 2: the "Strip n" button (82px), the strip of cells, and the answer tag (132px) */
    .sec-ch9 .ch9-sbtn { height: 34px; border: 1px solid var(--line); border-radius: 9px; background: var(--panel-2); color: var(--ink); font: inherit; font-weight: 800; font-size: 14px; cursor: pointer; } /* .ch9-sbtn: the "Strip n" button, bold and 34px tall */
    .sec-ch9 .ch9-sbtn.on { border-color: var(--chc); box-shadow: 0 0 0 2px var(--chc); } /* .on: the strip being named gets a chapter-colored ring */
    .sec-ch9 .ch9-cells { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 2px; } /* .ch9-cells: twelve equal cells, one per tick of the workload */
    .sec-ch9 .ch9-cells span { height: 31px; display: grid; place-items: center; border-radius: 5px; border: 1.5px solid; font-weight: 800; font-size: 14px; } /* each cell is 31px tall with a colored outline and the process letter in bold */
    .sec-ch9 .ch9-cells .pA { border-color: var(--cpu); background: color-mix(in srgb, var(--cpu) 20%, var(--panel)); } /* process A's ticks are drawn in processor blue, on a fill mixed from 20% blue and the panel color */
    .sec-ch9 .ch9-cells .pB { border-color: var(--mem); background: color-mix(in srgb, var(--mem) 20%, var(--panel)); } /* process B's ticks in memory green */
    .sec-ch9 .ch9-cells .pC { border-color: var(--io); background: color-mix(in srgb, var(--io) 20%, var(--panel)); } /* process C's ticks in I/O orange */
    .sec-ch9 .ch9-cells .pD { border-color: var(--os); background: color-mix(in srgb, var(--os) 20%, var(--panel)); } /* process D's ticks in OS purple */
    .sec-ch9 .ch9-cells.ch9-axis span { border: 0; height: auto; display: block; text-align: center; font-size: 12.5px; font-weight: 700; color: var(--muted); font-family: var(--mono); line-height: 1.2; } /* the time axis row uses the same twelve columns but shows plain small grey numbers in the fixed-width font, without boxes */
    .sec-ch9 .ch9-axis b { display: block; color: var(--chc); font-family: var(--sans, inherit); font-size: 12.5px; } /* an arrival mark under a time (such as the arrow and A) is bold and chapter-colored, in the normal font */
    .sec-ch9 .ch9-pols { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; } /* .ch9-pols: the six policy buttons of step 2, in two columns */
    .sec-ch9 .ch9-pol { display: flex; flex-direction: column; align-items: flex-start; text-align: left; padding: 6px 10px; border: 1px solid var(--line); border-radius: 10px; background: var(--panel-2); color: var(--ink); cursor: pointer; font: inherit; line-height: 1.25; } /* .ch9-pol: one policy button: the bold name over a short description, left-aligned in a light rounded box */
    .sec-ch9 .ch9-pol:hover { border-color: var(--chc); } /* hovering a policy button outlines it in the chapter color */
    .sec-ch9 .ch9-pol b { font-size: 15px; } /* the policy name is bold at 15px */
    .sec-ch9 .ch9-pol span { font-size: 12.5px; color: var(--muted); } /* the description under it is small and grey */
    .sec-ch9 .ch9-pol.ok { border-color: var(--ok); background: var(--ok-bg); } /* a right pick turns the button green */
    .sec-ch9 .ch9-pol.bad { border-color: var(--bad); background: var(--bad-bg); } /* a wrong pick turns it red */
    .sec-ch9 .ch9-fb { min-height: 128px; } /* .ch9-fb: the feedback box keeps a minimum height so the layout stays still between answers */
    .sec-ch9 table.tbl.ch9-key td, .sec-ch9 table.tbl.ch9-key th { font-size: 13px; line-height: 1.25; padding-top: 3px; padding-bottom: 3px; } /* the policy summary table under the strips uses small text and tight rows */
    @media (max-width: 760px) { /* @media (max-width: 760px): these rules apply only on windows 760px wide or less */
      .sec-ch9 .ch9-srow { grid-template-columns: 64px minmax(0, 1fr); } /* on a small screen each strip row keeps only two columns: the button (64px) and the cells */
      .sec-ch9 .ch9-srow > .chip { grid-column: 2; justify-self: start; } /* and the answer tag moves to a second line under the cells, lined up at their left */
      .sec-ch9 .ch9-cells span { font-size: 11px; height: 28px; } /* the strip cells get smaller text and are a little shorter */
    } /* ends the small-window rules */
  `,  // end of chapter 9's CSS text
  steps: [  // steps: the chapter's own overview steps, shown right after the chapter page and before section 9.1
    {  // step 1 of the chapter 9 overview
      title: 'One processor, a queue of processes',  // title shown at the top of step 1
      kind: 'story',  // kind "story" labels the step "Big Picture" and keeps it on the shorter core path
      render(el, ctx) {  // render(el, ctx): builds the step when it is shown; el is the empty step area, ctx holds the shell's helpers
        const { h, s } = ctx;  // h builds HTML elements and s builds SVG (drawing) elements
        // layout: three columns and three rows of states; on a small screen the boxes are slimmer and the
        // columns further apart, so the larger labels between them have room
        const XL = ctx.narrow ? 60 : 82, XM = ctx.narrow ? 270 : 260, XR = ctx.narrow ? 478 : 455, W2 = ctx.narrow ? 52 : 62, HH = ctx.narrow ? 23 : 21;  // XL, XM, XR: the centers of the three columns of states; W2 and HH: half the width and half the height of a state box
        const Y0 = 34, Y1 = 132, Y2 = 246;  // Y0, Y1, Y2: the centers of the three rows of states
        // the seven-state model: [id, label, centre x, centre y, shape class, dashed]
        const NODES = [['new', 'New', XM, Y0, 's-panel'], ['exit', 'Exit', XR, Y0, 's-panel'], ['rs', 'Ready/Suspend', XL, Y1, 's-proc', 1], ['ready', 'Ready', XM, Y1, 's-proc'], ['run', 'Running', XR, Y1, 's-cpu'], ['bs', 'Blocked/Suspend', XL, Y2, 's-proc', 1], ['blocked', 'Blocked', XM, Y2, 's-proc']];  // NODES: the seven states: New and Exit on top, Ready/Suspend, Ready and Running in the middle, the two blocked states below; suspended ones dashed
        // transitions: [level, label, path, label x, label y, label anchor]
        const across = (y, from, to) => `M${from} ${y} H${to}`;  // across(y, from, to): the drawing path for a straight horizontal arrow at height y from x = from to x = to
        const EDGES = [  // EDGES: the twelve transitions, each tagged with the level that controls it
          ['long', 'admit', `M${XM} ${Y0 + HH - 2} V${Y1 - HH - 1}`, XM + 8, (Y0 + Y1) / 2 + 3, 'start'], ['long', 'admit', `M${XM - W2 + 8} ${Y0 + 12} L${XL + 38} ${Y1 - HH - 1}`, XL + 68, Y0 + 36, 'end'],  // long-term: the two "admit" arrows, New down to Ready and New across to Ready/Suspend
          ['mid', 'activate', across(Y1 - 8, XL + W2 + 2, XM - W2 - 4), (XL + XM) / 2, Y1 - 18, 'middle'], ['mid', 'suspend', across(Y1 + 10, XM - W2 - 4, XL + W2 + 2), (XL + XM) / 2, Y1 + 26, 'middle'],  // medium-term: "activate" from Ready/Suspend to Ready, and "suspend" back the other way
          ['mid', 'suspend', across(Y2 - 8, XM - W2 - 4, XL + W2 + 2), (XL + XM) / 2, Y2 - 18, 'middle'], ['mid', 'activate', across(Y2 + 10, XL + W2 + 2, XM - W2 - 4), (XL + XM) / 2, Y2 + 26, 'middle'],  // medium-term: "suspend" from Blocked to Blocked/Suspend, and "activate" back the other way
          ['short', 'dispatch', across(Y1 - 8, XM + W2 + 4, XR - W2 - 4), (XM + XR) / 2, Y1 - 18, 'middle'], ['event', 'timeout', across(Y1 + 10, XR - W2 - 4, XM + W2 + 4), (XM + XR) / 2, Y1 + 26, 'middle'],  // short-term: "dispatch" from Ready to Running; not scheduling: "timeout" from Running back to Ready
          ['event', 'event wait', `M${XR - 15} ${Y1 + HH + 1} L${XM + W2 - 4} ${Y2 - 14}`, (XR + XM + W2) / 2 + 11, (Y1 + Y2) / 2 + 17, 'start'], ['event', 'event occurs', `M${XM - 8} ${Y2 - HH - 1} V${Y1 + HH + 3}`, XM + 2, (Y1 + Y2) / 2 + 5, 'start'],  // not scheduling: "event wait" from Running down to Blocked, and "event occurs" from Blocked up to Ready
          ['event', 'event occurs', `M${XL} ${Y2 - HH - 1} V${Y1 + HH + 3}`, XL + 8, (Y1 + Y2) / 2 + 5, 'start'], ['event', 'release', `M${XR} ${Y1 - HH - 1} V${Y0 + HH + 1}`, ctx.narrow ? XR - 8 : XR + 8, (Y0 + Y1) / 2 + 3, ctx.narrow ? 'end' : 'start'],  // not scheduling: "event occurs" between the suspended states, and "release" from Running up to Exit (label on the left on small screens)
        ];  // closes the EDGES list
        const LEVELS = [  // LEVELS: the four choices on the switch, each as [key, button label, glossary term or null, explanation]
          ['long', 'Long-term', 'Long-term scheduling', 'Decides which new programs are admitted as processes. It runs rarely, for example when a job ends, and it sets the degree of multiprogramming: the more processes admitted, the smaller each one’s share of the processor.'],  // long-term scheduling: admits new processes and sets the degree of multiprogramming
          ['mid', 'Medium-term', 'Medium-term scheduling', 'Part of swapping: decides which processes are suspended (moved out to disk) and which are brought back. It runs when memory is tight, far less often than the dispatcher.'],  // medium-term scheduling: suspends and brings back processes as part of swapping
          ['short', 'Short-term', 'Short-term scheduling', 'The dispatcher: picks which ready process runs next (Ready → Running). It runs most often of all, whenever a clock interrupt, I/O interrupt, system call or signal might change who should be running. The rest of this chapter is mostly about it.'],  // short-term scheduling: the dispatcher, which runs most often and is the focus of the chapter
          ['event', 'Not scheduling', null, 'A time-out (the clock ends a turn), waiting for an event, the event happening and finishing are caused by the clock, by what the process does or by what the hardware reports. No scheduler chooses them, but most of them call the dispatcher to pick the next process.'],  // the transitions caused by the clock, the process or the hardware rather than by a scheduler
        ];  // closes the LEVELS list
        let level = 'short';  // level: the level whose transitions are highlighted, short-term at first
        const svg = s('svg', { viewBox: '0 0 540 284', width: '100%', role: 'img', 'aria-label': 'The seven-state process model with the transitions each scheduling level controls' });  // svg: the seven-state diagram, 540 x 284, stretched to its card; the label describes it for screen readers
        const desc = h('div', { class: 'card tight ch9-desc', 'aria-live': 'polite' });  // desc: the card under the diagram that explains the chosen level; screen readers read it when it changes
        const segHost = h('div');  // segHost: a box for the level switch
        function drawStates() {  // drawStates(): redraws the diagram and the description for the chosen level
          const k = [];  // k collects the shapes of the new picture
          EDGES.forEach(([lv, label, d, lx, ly, anchor]) => {  // for each transition:
            const on = lv === level;  // on: whether it belongs to the chosen level
            k.push(s('path', { d, fill: 'none', class: 's-line', 'stroke-width': on ? 3.2 : 1.6, style: on ? 'stroke:var(--accent)' : 'stroke:var(--line-2)', 'marker-end': on ? 'url(#arr-accent)' : 'url(#arr-muted)' }));  // the arrow: thick and in the accent color if on, otherwise thin and pale with a faint arrowhead
            if (on) k.push(s('text', { x: lx, y: ly, 'text-anchor': anchor, 'font-size': ctx.narrow ? 18 : 13, 'font-weight': 800, style: 'fill:var(--accent)' }, label));  // only the highlighted arrows get their label, in bold accent text (larger on small screens)
          });  // ends the transitions
          NODES.forEach(([, label, x, y, cls, dash]) => {  // for each state:
            // on a small screen the picture shrinks, so labels grow and the long ones break at the slash
            const lines = ctx.narrow && label.includes('/') ? [label.split('/')[0] + '/', label.split('/')[1]] : [label];  // lines: on a small screen a label with a slash breaks into two lines just after the slash
            const fz = ctx.narrow ? (lines.length > 1 ? 17.5 : 20) : label.length > 10 ? 13 : 15;  // fz: the font size, larger on small screens and a little smaller for long labels on wide ones
            k.push(s('rect', { x: x - W2, y: y - HH, width: 2 * W2, height: 2 * HH, rx: 10, class: cls, 'stroke-width': 1.8, 'stroke-dasharray': dash ? '5 3' : null }),  // the state's rounded box in its color, dashed for the two suspended states
              ...lines.map((ln, i) => s('text', { x, y: y + 6 + (lines.length > 1 ? (i - 0.5) * 18 : 0), 'text-anchor': 'middle', 'font-size': fz, 'font-weight': 800 }, ln)));  // the label, centered in the box; two lines sit 18 units apart around the middle
          });  // ends the states
          svg.replaceChildren(...k);  // swaps the old picture for the new one
          const L = LEVELS.find((x) => x[0] === level);  // L: the chosen level's entry in LEVELS
          desc.innerHTML = `<b>${L[2] ? `<span class="t">${L[2]}</span>` : 'Transitions no scheduler chooses'}</b><div class="small" style="margin-top:3px">${L[3]}</div>`;  // the description: a bold title (a dotted glossary term if there is one) and the explanation under it
          ctx.refit();  // re-checks that the step still fits
        }  // ends drawStates()
        segHost.append(ctx.ui.seg(LEVELS.map(([value, label]) => ({ value, label })), level, (v) => { level = v; drawStates(); }));  // puts the four-button level switch in its box; choosing a level redraws the diagram
        // the dispatcher game: three processes, all ready at time 0; each click runs one for one tick
        const NEED = { A: 4, B: 1, C: 2 }, NAMES = Object.keys(NEED), TOTAL = NAMES.reduce((a, n) => a + NEED[n], 0);  // NEED: the ticks of work each process needs (A 4, B 1, C 2); NAMES: their letters; TOTAL: 7 ticks in all
        let seq = [];  // seq: the schedule so far, the letter of the process that ran in each tick
        const doneBy = (sq, n) => sq.filter((x) => x === n).length;  // doneBy(sq, n): how many ticks process n has run in schedule sq
        const finishOf = (sq, n) => { let c = 0; for (let t = 0; t < sq.length; t++) if (sq[t] === n && ++c === NEED[n]) return t + 1; return null; };  // finishOf(sq, n): the time process n finishes (the end of its last needed tick), or null if it has not finished yet
        const waitedSoFar = (sq, n) => { const f = finishOf(sq, n); return (f === null ? sq.length : f) - doneBy(sq.slice(0, f === null ? sq.length : f), n); };  // waitedSoFar(sq, n): how long n has waited: the time passed so far (or up to its finish) minus the ticks it ran
        const avgWait = (sq) => NAMES.reduce((a, n) => a + (finishOf(sq, n) - NEED[n]), 0) / NAMES.length;  // avgWait(sq): the average waiting time of a complete schedule; each process waits its finish time minus its work, since all start at 0
        // every possible complete schedule (one tick at a time), to find the best and worst average waiting time honestly
        const ALL = [];  // ALL: will hold every possible complete schedule
        (function grow(sq) { if (sq.length === TOTAL) { ALL.push(sq.slice()); return; } NAMES.forEach((n) => { if (doneBy(sq, n) < NEED[n]) { sq.push(n); grow(sq); sq.pop(); } }); })([]);  // grow(sq): a recursive function (one that calls itself) that extends sq with each process still needing work, saving each full schedule
        const best = ALL.reduce((b, x) => (avgWait(x) < avgWait(b) ? x : b)), worst = ALL.reduce((b, x) => (avgWait(x) > avgWait(b) ? x : b));  // best and worst: the schedules with the lowest and the highest average waiting time
        const f2 = (x) => ctx.util.fmt(x, 2);  // f2(x): writes a number with at most two decimal places
        const rows = h('div', { class: 'stack', style: { gap: '6px' } }), gantt = h('div', { class: 'ch9-gantt', 'aria-label': 'Who ran in each tick' }), cap = h('div', { class: 'player-cap ch9-cap', 'aria-live': 'polite' });  // rows: the three process rows; gantt: the processor timeline, labeled for screen readers; cap: the narration box
        const runBtns = h('div', { class: 'row' });  // runBtns: the row of Run buttons, rebuilt on every repaint
        let story = '';  // story: the narration text
        function paintDemo() {  // paintDemo(): redraws the game after every click
          rows.replaceChildren(...NAMES.map((n) => {  // rebuilds one row per process
            const did = doneBy(seq, n), fin = did === NEED[n], w = waitedSoFar(seq, n);  // did: ticks run so far; fin: whether it has finished; w: ticks waited so far
            return h('div', { class: 'ch9-prow' + (fin ? ' done' : '') },  // the row's box, faded once the process has finished
              h('div', {}, h('b', { style: { whiteSpace: 'nowrap' } }, 'Process ' + n), h('div', { class: 'xs muted' }, `needs ${NEED[n]} tick${NEED[n] > 1 ? 's' : ''}`)),  // first column: "Process A" kept on one line, and how many ticks it needs
              h('div', {}, h('div', { class: 'xs muted b' }, fin ? `FINISHED AT ${finishOf(seq, n)}` : 'WORK DONE'), h('div', { class: 'ch9-pips' }, ...Array.from({ length: NEED[n] }, (_, i) => h('i', { class: i < did ? 'on' : '' })))),  // second column: "WORK DONE" (or "FINISHED AT t") over one square per needed tick, filled for each tick done
              h('div', {}, h('div', { class: 'xs muted b' }, `WAITED ${w}`), h('div', { class: 'ch9-pips' }, ...Array.from({ length: w }, () => h('i', { class: 'w' })))));  // third column: "WAITED n" over one red square per tick waited
          }));  // ends the rows
          gantt.replaceChildren(...Array.from({ length: TOTAL }, (_, t) => h('span', { class: seq[t] ? 'on' : '' }, seq[t] || String(t))));  // the timeline: seven cells, each showing the letter of the process that ran in that tick, or the tick number if still open
          runBtns.replaceChildren(...NAMES.map((n) => h('button', { class: 'btn sm cpu', type: 'button', disabled: doneBy(seq, n) >= NEED[n] || null, onclick: () => tick(n) }, `Run ${n} for one tick`)),  // one blue Run button per process, greyed out once it has finished; a click runs it for one tick
            h('button', { class: 'btn sm ghost', type: 'button', onclick: () => { seq = []; story = start(); paintDemo(); } }, 'Reset'));  // a quiet Reset button that clears the schedule and the narration
          cap.innerHTML = story;  // puts the narration in the caption box
          ctx.refit();  // re-checks that the step still fits
        }  // ends paintDemo()
        const start = () => `Three processes are ready at time 0. You are the <span class="t">dispatcher</span>: pick who gets the processor for each tick. Every tick, the others pile up <span class="t">waiting time</span>.`;  // start(): the opening narration, telling the student they are the dispatcher
        function tick(n) {  // tick(n): gives the processor to process n for the next tick
          if (doneBy(seq, n) >= NEED[n]) return;  // ignores a process that has already finished
          seq.push(n);  // adds n to the schedule
          const others = NAMES.filter((x) => x !== n && doneBy(seq, x) < NEED[x]);  // others: the unfinished processes that did not get this tick
          story = `Tick ${seq.length - 1}: ${n} runs` + (others.length ? `, while ${others.join(' and ')} wait${others.length > 1 ? '' : 's'}.` : ' alone.');  // narration: "Tick t: B runs, while A and C wait." (or "alone" when nobody else is left)
          if (seq.length === TOTAL) {  // once every tick has been handed out:
            const mine = avgWait(seq);  // mine: the student's average waiting time
            story = `All done. Your average waiting time: <b>${f2(mine)}</b> ticks. Best possible: <b>${f2(avgWait(best))}</b> (run ${best.filter((x, i) => best.indexOf(x) === i).join(', ')}, shortest first). Worst: ${f2(avgWait(worst))}. ` + (mine === avgWait(best) ? 'You found the best order.' : 'Short jobs first means fewer processes are left waiting.');  // final narration: the student's average, the best possible with its order (shortest first), the worst, and a verdict
          }  // ends the end-of-game case
          paintDemo();  // redraws the game
        }  // ends tick()
        story = start();  // starts the narration with the opening message
        el.append(h('div', { class: 'split fill' },  // puts step 1 on screen: two equal columns
          h('div', { class: 'stack', style: { gap: '8px' } },  // left column, stacked 8px apart:
            h('div', { class: 'row' }, h('span', { class: 'small b' }, 'Show the transitions chosen by:'), segHost),  // a row with the label "Show the transitions chosen by:" and the level switch
            h('div', { class: 'card white', style: { padding: '6px 8px' } }, svg), desc),  // the white card with the state diagram, then the description card; ends the left column
          h('div', { class: 'stack', style: { gap: '8px' } },  // right column, stacked 8px apart:
            h('h4', { class: 'm0' }, 'Try it: you are the short-term scheduler'), rows, runBtns,  // the heading "Try it: you are the short-term scheduler", the process rows and the Run buttons
            h('div', {}, h('div', { class: 'xs muted b', style: { marginBottom: '3px' } }, 'THE PROCESSOR, TICK BY TICK'), gantt), cap,  // the small "THE PROCESSOR, TICK BY TICK" label over the timeline, then the narration
            h('div', { class: 'callout why m0 small', 'data-label': 'The catch', html: 'Running the shortest work first gives the lowest average waiting time, but if short jobs keep arriving, a long one may wait forever: <span class="t">starvation</span>. The chapter: 9.1 the three levels (left), 9.2 six policies that weigh this trade-off, 9.3 the traditional UNIX scheduler.' }))));  // blue "The catch" callout: shortest-first can starve a long job, plus a map of sections 9.1 to 9.3; ends the layout
        drawStates(); paintDemo();  // draws the diagram and the game when the step opens
      },  // ends render() for step 1
    },  // closes step 1
    {  // step 2 of the chapter 9 overview
      title: 'Name that policy',  // title shown at the top of step 2
      kind: 'explore',  // kind "explore" labels the step "Explore"
      render(el, ctx) {  // render(el, ctx): builds step 2 when it is shown
        const { h } = ctx;  // h is the helper that builds HTML elements
        const W = [['A', 0, 5], ['B', 1, 3], ['C', 2, 2], ['D', 4, 2]];  // [name, arrival time, service time]
        const POLS = [['fcfs', 'FCFS', 'first-come-first-served'], ['rr', 'Round robin (q = 1)', 'one-tick turns'], ['spn', 'SPN', 'shortest process next'], ['srt', 'SRT', 'shortest remaining time'], ['hrrn', 'HRRN', 'highest response ratio next'], ['fb', 'Feedback (q = 1)', 'drop a level after each turn']];  // POLS: the six policies as [key, button name, short description]
        const NAME = Object.fromEntries(POLS.map(([k, n]) => [k, n]));  // NAME: looks up a policy's button name from its key
        // one complete run, one tick at a time. At each instant: a finished process leaves, arrivals join the queue,
        // then a used-up turn or a preemption sends the runner back (behind the arrivals), then the dispatcher picks.
        function sim(pol) {  // sim(pol): plays the whole workload under policy pol, one tick at a time, and records who ran when
          const P = W.map(([n, arr, svc]) => ({ n, arr, svc, rem: svc, lvl: 0, fin: null }));  // P: a working copy of each process with its remaining work (rem), feedback level (lvl) and finish time (fin)
          const q = [[], [], [], []], seq = [], log = [];  // q: four ready queues (feedback uses all four levels, the other policies only the first); seq: who ran each tick; log: notes for the explanations
          let t = 0, run = null, used = 0, done = 0;  // t: the clock; run: the process on the processor; used: ticks in its current turn; done: how many have finished
          const ratio = (p) => (t - p.arr - (p.svc - p.rem) + p.svc) / p.svc;  // ratio(p): the response ratio, (time spent waiting + service time) divided by service time
          const key = (p) => (pol === 'spn' ? [p.svc, p.arr] : pol === 'srt' ? [p.rem, p.arr] : pol === 'hrrn' ? [-ratio(p), p.arr] : [0, 0]);  // key(p): what the policy compares: service time (SPN), work left (SRT) or the ratio, negated so higher wins (HRRN), then arrival time
          const less = (a, b) => a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);  // less(a, b): true if key a comes first: a smaller first value, or the same value and an earlier arrival
          const best = (l) => l.reduce((b, p) => (less(key(p), key(b)) ? p : b), l[0]);  // best(l): the process in list l whose key comes first
          while (t < 100) {  // loops until every process has finished; 100 ticks is only a safety limit
            if (run && run.rem === 0) { run.fin = t; done++; run = null; }  // a runner with no work left finishes now: its finish time is recorded and the processor is freed
            if (done === P.length) break;  // everyone has finished: stop
            P.forEach((p) => { if (p.arr === t) q[0].push(p); });  // processes arriving at this moment join the back of the top queue
            if (run && pol === 'rr' && used >= 1) { q[0].push(run); run = null; }  // round robin: a runner that has used its one-tick turn goes to the back of the queue, behind the newcomers
            else if (run && pol === 'fb' && used >= 1) { if (q.some((x) => x.length)) { run.lvl = Math.min(run.lvl + 1, 3); q[run.lvl].push(run); run = null; } else used = 0; }  // feedback: after a used turn, if anyone else is waiting the runner drops a level (3 at most) and queues there; if not, it simply keeps going
            else if (run && pol === 'srt' && q[0].length) { const b = best(q[0]); if (less(key(b), key(run))) { log.push({ k: 'pre', t, p: run.n, rem: run.rem, by: b.n, need: b.rem }); q[0].push(run); run = null; } }  // SRT: if the best waiting process has less work left than the runner, the preemption is logged and the runner goes back to the queue
            if (!run) {  // when the processor is free:
              const lv = q.findIndex((x) => x.length);  // lv: the highest-priority queue that has anyone in it
              if (lv >= 0) {  // if someone is waiting:
                const pick = ['spn', 'srt', 'hrrn'].includes(pol) ? best(q[lv]) : q[lv][0];  // pick: the best by key for SPN, SRT and HRRN, otherwise simply the process at the head of the queue
                log.push({ k: 'go', t, p: pick.n, lvl: lv, cands: q[lv].map((c) => ({ n: c.n, svc: c.svc, r: ratio(c) })), lower: q.slice(lv + 1).flat().map((c) => c.n) });  // logs the dispatch: the time, the pick, its level, the candidates with their service times and ratios, and who waits at lower levels
                q[lv].splice(q[lv].indexOf(pick), 1); run = pick; used = 0;  // takes the pick out of its queue, puts it on the processor and starts a new turn
              }  // ends the case with someone waiting
            }  // ends the case with a free processor
            seq.push(run ? run.n : null);  // records who runs during this tick (null if the processor is idle)
            if (run) { run.rem--; used++; }  // the runner does one tick of work and its turn grows by one tick
            t++;  // the clock moves on
          }  // ends the loop
          return { seq, fin: Object.fromEntries(P.map((p) => [p.n, p.fin])), log };  // returns the schedule, every process's finish time and the log
        }  // ends sim()
        const R = Object.fromEntries(POLS.map(([k]) => [k, sim(k)]));  // R: the results of all six policies, computed once when the step opens
        const f2 = (x) => x.toFixed(2);  // f2(x): writes a number with exactly two decimal places
        const order = (r) => r.seq.filter((x, i) => x && r.seq.indexOf(x) === i).join(', ');  // order(r): the processes in the order they first ran, such as "A, B, C, D"
        const multi = (r) => r.log.filter((x) => x.k === 'go' && x.cands.length > 1);  // multi(r): the dispatches where the policy had more than one process to choose from
        // the explanation for each policy, built from that policy's own run
        const WHY = {  // WHY: the explanation shown when a strip is named correctly, each built from that policy's own run
          fcfs: (r) => `Every process runs to the end without a break, strictly in arrival order: ${order(r)}. Short C waits behind long A and B.`,  // FCFS: each process runs to the end in arrival order, so short C waits behind long A and B
          rr: (r) => { const lng = W.reduce((a, b) => (b[2] > a[2] ? b : a))[0]; return `Everyone takes one-tick turns in queue order, so the strip switches almost every tick and nobody waits long for a first turn. ${lng}, with the most work, finishes last, at t = ${r.fin[lng]}.`; },  // round robin: one-tick turns in queue order; the process with the most work finishes last, at the time the run gives
          spn: (r) => { const d = multi(r)[0]; return `No process is ever interrupted, but when the processor frees up the shortest waiting job goes first. At t = ${d.t} the choices are ${d.cands.map((c) => `${c.n} (${c.svc})`).join(', ')}, and ${d.p} wins (a tie goes to the earlier arrival). B keeps being passed over.`; },  // SPN: never interrupts; at the first real choice it lists the candidates and their service times, and B keeps being passed over
          srt: (r) => { const p = r.log.find((x) => x.k === 'pre'); return `Preemptive: at t = ${p.t}, ${p.by} arrives needing ${p.need} while ${p.p} still needs ${p.rem}, so ${p.p} is cut off at once. Whoever has the least work left always takes over, and ${p.p} finishes last.`; },  // SRT: uses the logged preemption to say who cut in, how much work each had left, and that the interrupted one finishes last
          hrrn: (r) => `No interruptions; at each choice the highest ratio (time waiting + service) ÷ service wins. ` + multi(r).map((d) => `At t = ${d.t}: ${d.cands.map((c) => `${c.n} ${f2(c.r)}`).join(', ')} → ${d.p}.`).join(' ') + ' Waiting raises a ratio, so B is not passed over forever.',  // HRRN: lists the ratios at each real choice and shows that waiting raises B's ratio, so it is not passed over forever
          fb: (r) => { const d = r.log.filter((x) => x.k === 'go' && x.lvl === 0).reduce((m, x) => (x.lower.length > m.lower.length ? x : m)); return `One-tick turns, and every used turn drops a process one priority level, so newcomers go first: at t = ${d.t}, ${d.p} has just arrived and runs ahead of ${d.lower.length > 1 ? d.lower.slice(0, -1).join(', ') + ' and ' + d.lower[d.lower.length - 1] : d.lower[0]}, which ${d.lower.length > 1 ? 'have already had turns' : 'has already had a turn'}.`; },  // feedback: finds the moment a newcomer at the top level ran ahead of the most processes that had already had turns
        };  // closes the WHY table
        const HINT = {  // HINT: a one-line reminder of how each policy behaves, shown when the student names a strip wrongly
          fcfs: 'FCFS never interrupts anyone and serves strictly in arrival order.',  // hint: FCFS never interrupts and serves in arrival order
          rr: 'Round robin with one-tick turns switches at nearly every tick, taking processes in queue order.',  // hint: round robin switches at nearly every tick
          spn: 'SPN never interrupts a running process; it only picks the shortest job when the processor frees up.',  // hint: SPN picks the shortest job only when the processor frees up
          srt: 'SRT interrupts the runner as soon as a newcomer has less work left.',  // hint: SRT interrupts as soon as a newcomer has less work left
          hrrn: 'HRRN never interrupts; it picks by response ratio, which favours jobs that have waited long.',  // hint: HRRN never interrupts and favours jobs that have waited long
          fb: 'Feedback uses one-tick turns but lets newcomers jump ahead of processes that have already run.',  // hint: feedback lets newcomers jump ahead of processes that already ran
        };  // closes the HINT table
        const STRIPS = ['srt', 'fcfs', 'fb', 'hrrn', 'rr', 'spn'];  // the order the strips are shown in, deliberately not the order of the buttons
        const ans = STRIPS.map(() => null);  // ans: the policy the student has named for each strip, null until named
        let cur = 0;  // cur: the strip being named, counting from 0
        const strips = h('div', { class: 'stack', style: { gap: '6px' } }), fb = h('div', { class: 'callout m0 small ch9-fb', 'aria-live': 'polite' }), score = h('span', { class: 'big', style: { fontSize: '30px' } });  // strips: the column of strip rows; fb: the feedback callout, read aloud when it changes; score: the "n / 6" count at 30px
        const polBtns = POLS.map(([k, n, d]) => h('button', { class: 'ch9-pol', type: 'button', onclick: () => { ans[cur] = k; paint(); } }, h('b', {}, n), h('span', {}, d)));  // polBtns: the six policy buttons; clicking one names the current strip with that policy and repaints
        const T = R.fcfs.seq.length;  // T: the number of ticks in a run (12), taken from the FCFS schedule
        const axis = h('div', { class: 'ch9-srow' }, h('span', { class: 'xs muted b' }, 'TIME'),  // axis: the time row above the strips: the "TIME" label,
          h('div', { class: 'ch9-cells ch9-axis' }, ...Array.from({ length: T }, (_, t) => h('span', {}, String(t), ...W.filter((w) => w[1] === t).map((w) => h('b', {}, '↓' + w[0]))))), h('span'));  // then one cell per tick with its number and an arrival mark under each arrival time, and an empty third column
        function paint() {  // paint(): redraws the strips, the buttons, the feedback and the score after every click
          strips.replaceChildren(...STRIPS.map((k, i) => {  // rebuilds the six strip rows
            const a = ans[i], ok = a === k;  // a: the policy named for this strip; ok: whether it is right
            return h('div', { class: 'ch9-srow' },  // one row in the three-column strip layout
              h('button', { class: 'ch9-sbtn' + (i === cur ? ' on' : ''), type: 'button', 'aria-pressed': String(i === cur), onclick: () => { cur = i; paint(); } }, 'Strip ' + (i + 1)),  // the "Strip n" button, ringed when it is the current one; a click makes it current
              h('div', { class: 'ch9-cells', role: 'img', 'aria-label': `Strip ${i + 1}: ${R[k].seq.join(' ')}` }, ...R[k].seq.map((p) => h('span', { class: 'p' + p }, p))),  // the strip: one colored cell per tick with the process letter; a label spells out the sequence for screen readers
              a == null ? h('span', { class: 'chip' }, 'not named yet') : h('span', { class: 'chip ' + (ok ? 'ok' : 'bad') }, (ok ? '✓ ' : '✗ ') + NAME[a]));  // the tag: "not named yet", or the named policy with a check in green or a cross in red
          }));  // ends the strip rows
          const k = STRIPS[cur], a = ans[cur], ok = a === k;  // k: the right policy for the current strip; a: the student's answer; ok: whether they match
          polBtns.forEach((b, i) => { const pk = POLS[i][0]; b.classList.toggle('ok', a === pk && ok); b.classList.toggle('bad', a === pk && !ok); b.setAttribute('aria-pressed', String(a === pk)); });  // marks the chosen policy button green or red and tells screen readers which one is pressed
          fb.className = 'callout m0 small ch9-fb ' + (a == null ? '' : ok ? 'tip' : 'bad');  // sets the feedback box's color: plain before an answer, green if right, red if wrong
          fb.dataset.label = a == null ? `Strip ${cur + 1}: your call` : ok ? `Strip ${cur + 1} is ${NAME[k]}` : 'Not quite';  // the feedback label: "Strip n: your call", "Strip n is" plus the policy, or "Not quite"
          fb.innerHTML = a == null ? 'Look at where the strip switches from one process to another. Does a running process ever get interrupted? Who goes next when the processor frees up?' : ok ? WHY[k](R[k]) : `${HINT[a]} Does strip ${cur + 1} behave like that? Look at where it switches.`;  // feedback text: what to look for before an answer, the explanation if right, or the chosen policy's hint if wrong
          score.textContent = `${STRIPS.filter((x, i) => ans[i] === x).length} / ${STRIPS.length}`;  // the score: how many strips are named correctly, out of six
          ctx.refit();  // re-checks that the step still fits
        }  // ends paint()
        el.append(h('div', { class: 'split r fill' },  // puts step 2 on screen: two columns, the larger one on the left
          h('div', { class: 'stack', style: { gap: '8px' } },  // left column, stacked 8px apart:
            h('p', { class: 'm0', html: 'One workload, six policies. Arrivals (↓): ' + W.map(([n, a, sv]) => `<b>${n}</b> at ${a}, needs ${sv}`).join(' · ') + '. Pick a strip, then name its policy.' }),  // the opening sentence, listing each process's arrival time and service time
            axis, strips,  // the time axis and the six strips
            h('table', { class: 'tbl compact ch9-key', html: '<thead><tr><th>Policy</th><th>Picks the process with</th><th>Interrupts?</th></tr></thead><tbody>' +  // the policy summary table: Policy, Picks the process with, Interrupts?
              [['FCFS', 'the longest wait so far', 'no'], ['RR', 'the next turn in the queue', 'yes, when a turn ends'], ['SPN', 'the shortest service time', 'no'], ['SRT', 'the least work left', 'yes, when a shorter job arrives'], ['HRRN', 'the highest (wait + service) ÷ service', 'no'], ['Feedback', 'the highest queue level, oldest first', 'yes, when a turn ends']].map((r) => `<tr><td><b>${r[0]}</b></td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('') + '</tbody>' })),  // its six rows, one per policy, built from a list and joined into the table; ends the left column
          h('div', { class: 'stack', style: { gap: '8px' } },  // right column, stacked 8px apart:
            h('div', { class: 'row', style: { alignItems: 'baseline' } }, score, h('span', { class: 'small b' }, 'named'), h('button', { class: 'btn sm', type: 'button', style: { marginLeft: 'auto', alignSelf: 'center' }, onclick: () => { ans.fill(null); cur = 0; paint(); } }, 'Start over')),  // a row with the big score, the word "named" and a "Start over" button pushed to the right that clears every answer
            h('div', { class: 'ch9-pols' }, ...polBtns), fb,  // the six policy buttons in two columns, then the feedback box
            h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'SPN and SRT both favour short jobs, but only SRT interrupts. If a running process is never cut off, the policy is nonpreemptive: FCFS, SPN or HRRN.' }))));  // amber "Common mistake" callout: SPN and SRT both favour short jobs, but only SRT interrupts; ends the layout
        paint();  // draws the strips when the step opens
      },  // ends render() for step 2
    },  // closes step 2
  ],  // closes the chapter's steps list
  notes: `${/* notes: the chapter 9 summary shown in the Notes drawer on the overview steps and in the printed guide */''}
    <h3>How Chapter 9 fits together</h3>${/* notes heading: how chapter 9 fits together */''}
    <p>One processor runs one process at a time. Section 9.1 splits the choice into three levels, each tied to seven-state model transitions:</p>${/* notes paragraph: one process runs at a time, and section 9.1 splits the choice into three levels */''}
    <ul>${/* starts the bulleted list of the three levels */''}
      <li><b>Long-term scheduling</b> admits new programs as processes (New → Ready or Ready/Suspend). It runs rarely and sets the degree of multiprogramming.</li>${/* bullet: long-term scheduling and the transitions it controls */''}
      <li><b>Medium-term scheduling</b> is part of swapping: it suspends processes to disk and brings them back (Ready ↔ Ready/Suspend, Blocked ↔ Blocked/Suspend).</li>${/* bullet: medium-term scheduling, part of swapping */''}
      <li><b>Short-term scheduling</b>, the <b>dispatcher</b>, picks which ready process runs next (Ready → Running). It runs most often, on interrupts, system calls and signals.</li>${/* bullet: short-term scheduling, the dispatcher */''}
    </ul>${/* ends the bulleted list */''}
    <p>Time-outs, event waits, event occurrences and exits are not scheduling decisions, though most of them call the dispatcher. In the overview game, A needs 4 ticks, B 1 and C 2, all ready at time 0. Running the shortest first (B, C, A) gives waiting times 0, 1 and 3, an average of 4 ÷ 3 ≈ 1.33 ticks; the worst of all 105 schedules averages 11 ÷ 3 ≈ 3.67.</p>${/* notes paragraph: the transitions no scheduler chooses, and the dispatcher game's best and worst averages */''}
    <h4>The algorithms (9.2)</h4>${/* notes heading: the algorithms (section 9.2) */''}
    <p>Criteria are user-oriented (turnaround, response time, deadlines) or system-oriented (throughput, utilization, fairness). A policy has a selection function and a decision mode: <b>nonpreemptive</b> (runs until it finishes or blocks) or <b>preemptive</b>.</p>${/* notes paragraph: user-oriented and system-oriented criteria, and preemptive versus nonpreemptive decisions */''}
    <table>${/* starts the table of the six policies */''}
      <tr><th>Policy</th><th>Picks</th><th>Preemptive?</th></tr>${/* table header: Policy, Picks, Preemptive? */''}
      <tr><td>FCFS</td><td>the process that has waited longest</td><td>no</td></tr>${/* table row: FCFS */''}
      <tr><td>Round robin</td><td>the next in the queue, for one time quantum</td><td>yes, at the end of a quantum</td></tr>${/* table row: round robin */''}
      <tr><td>SPN</td><td>the shortest expected service time</td><td>no</td></tr>${/* table row: SPN */''}
      <tr><td>SRT</td><td>the least expected work left</td><td>yes, when a shorter job arrives</td></tr>${/* table row: SRT */''}
      <tr><td>HRRN</td><td>the highest ratio (waiting + service) ÷ service</td><td>no</td></tr>${/* table row: HRRN */''}
      <tr><td>Feedback</td><td>the head of the highest non-empty queue; a used quantum drops a level</td><td>yes, at the end of a quantum</td></tr>${/* table row: feedback */''}
    </table>${/* ends the table */''}
    <p>For the workload A (arrives 0, needs 5), B (1, 3), C (2, 2), D (4, 2), one tick per letter: FCFS gives AAAAABBBCCDD; round robin (q = 1) ABACBADCBADA; SPN AAAAACCDDBBB; SRT ABBBCCDDAAAA (B cuts in at t = 1); HRRN AAAAACCBBBDD (ratios at t = 5: B 2.33, C 2.50, D 1.50; at t = 7: B 3.00, D 2.50); feedback (q = 1) ABCADBCDABAA. Fair-share scheduling divides the processor between groups of users.</p>${/* notes paragraph: the step 2 workload worked out under each policy, then fair-share scheduling */''}
    <h4>Traditional UNIX (9.3)</h4>${/* notes heading: traditional UNIX (section 9.3) */''}
    <p>Classic UNIX ran round robin within priority levels and each second recomputed every priority from a base value, recent processor use (decayed over time) and the nice value, so processor-hungry processes sink and interactive ones stay responsive.</p>${/* notes paragraph: how classic UNIX recomputed priorities every second */''}
    <h4>Why it matters</h4>${/* notes heading: why it matters */''}
    <p>Process states, lock waits and page faults all end up as processes entering and leaving the ready queue: scheduling ties the course together.</p>`,  // notes paragraph: scheduling ties the whole course together; end of the notes text
});  // closes the chapter 9 object and the Guide.chapter call
