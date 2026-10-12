// Comment key: a line inside backtick text ends with ${/* comment */''}, an empty-string slot that holds a comment without changing the text on screen (full note at the top of the page).
/* Chapter metadata for the third volume (chapters 10-13): titles, colours, overview text and objectives.
   Section content lives in sections/<id>.js. */
Guide.chapter({  // registers chapter 10 with the guide; Guide.chapter (in the shell script) stores this object and adds its CSS to the page
  num: 10,  // num: the chapter number; it sets the chapter's order, its color (--ch10) and page addresses such as #ch10
  title: 'Multiprocessor, Multicore, and Real-Time Scheduling',  // title shown on the chapter card, the chapter overview page and the top-bar tooltip
  tagline: 'Many processors, shared caches and hard deadlines: scheduling stops being about one queue and one CPU.',  // tagline: the one-sentence hook printed in the chapter color at the top of the chapter overview page
  intro: '<p>Chapter 9 scheduled one processor. This chapter spreads the work over many processors and cores, and then adds deadlines that must be met. It looks at how tightly processors cooperate, how threads of one program are placed together, how real-time systems guarantee timing, and how Linux, UNIX SVR4, FreeBSD and Windows schedule in practice.</p>',  // intro: the opening paragraph of the chapter overview page
  objectives: [  // objectives: the list shown under "After this chapter you will be able to" on the overview page and in the printed guide
    'Classify multiprocessor systems and the granularity of parallelism in an application.',  // objective 1: kinds of multiprocessor systems and grain sizes
    'Compare load sharing, gang scheduling, dedicated processor assignment and dynamic scheduling of threads.',  // objective 2: the four ways to schedule threads on many processors
    'Explain what makes a system real-time and schedule tasks with deadline and rate monotonic scheduling.',  // objective 3: real-time systems and their two classic scheduling methods
    'Describe priority inversion and how priority inheritance and priority ceilings prevent it.',  // objective 4: priority inversion and its two standard cures
    'Compare the schedulers of Linux, UNIX SVR4, FreeBSD and Windows.',  // objective 5: four real operating systems' schedulers
  ],  // closes the objectives list
  terms: [],  // terms: chapter-level glossary entries; the sections define this chapter's terms
  css: ` /* css: style rules used only by chapter 10's overview steps; each rule starts with .sec-ch10, the canvas class on these steps */
    .sec-ch10 .ch10-ctl { gap: 8px 10px; align-items: center; } /* .ch10-ctl: step 1's control row (the two switches and their labels), wrapping with small gaps */
    .sec-ch10 .ch10-vis { padding: 6px 8px; } /* .ch10-vis: the white card around step 1's timeline, with slim padding */
    .sec-ch10 .ch10-stats { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; } /* .ch10-stats: the row of result tags under the timeline, wrapping if it runs out of room */
    .sec-ch10 .ch10-cap { min-height: 70px; } /* .ch10-cap: the timeline's narration box keeps a minimum height so the controls under it stay still */
    .sec-ch10 .ch10-map { display: flex; gap: 10px; align-items: flex-start; text-align: left; padding: 7px 11px; border: 1px solid var(--line); border-left: 4px solid var(--line-2); border-radius: 10px; background: var(--panel-2); cursor: pointer; color: var(--ink); font: inherit; font-size: 15px; line-height: 1.35; } /* .ch10-map: one roadmap row of step 1: a section number and its title, left-aligned in a light rounded box with a thick left edge */
    .sec-ch10 .ch10-map:hover { border-color: var(--chc); } /* hovering a roadmap row outlines it in the chapter color */
    .sec-ch10 .ch10-map.on { border-color: var(--chc); border-left-color: var(--chc); background: color-mix(in srgb, var(--chc) 9%, var(--panel)); } /* .on: the open roadmap row gets a chapter-colored outline and a faint chapter-colored fill */
    .sec-ch10 .ch10-id { flex: none; display: inline-grid; place-items: center; min-width: 44px; height: 24px; padding: 0 6px; border-radius: 12px; background: var(--panel-3); font-weight: 800; font-size: 13px; } /* .ch10-id: the section number at the start of a roadmap row, in a grey pill */
    .sec-ch10 .ch10-map.on .ch10-id { background: var(--chc); color: var(--panel); } /* the open row's number pill is filled with the chapter color */
    .sec-ch10 .ch10-d { display: block; margin-top: 4px; font-weight: 400; } /* .ch10-d: the description that appears under the open row's title */
    .sec-ch10 .ch10-sc { min-height: 132px; border-left: 5px solid var(--chc); } /* .ch10-sc: step 2's scenario card, with a minimum height and a thick chapter-colored left edge */
    .sec-ch10 .ch10-text { font-size: 17.5px; line-height: 1.45; margin-top: 6px !important; } /* .ch10-text: the scenario's story, slightly larger than body text */
    .sec-ch10 .ch10-grp { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; } /* .ch10-grp: one family of idea buttons, three equal columns */
    .sec-ch10 .ch10-grp.g4 { grid-template-columns: repeat(4, minmax(0, 1fr)); } /* .g4: the real-systems family has four buttons, so four columns */
    .sec-ch10 .ch10-idea { display: flex; flex-direction: column; justify-content: center; align-items: flex-start; text-align: left; min-height: 48px; padding: 4px 10px; border: 1px solid var(--line); border-radius: 9px; background: var(--panel-2); color: var(--ink); font: inherit; font-size: 14.5px; font-weight: 700; line-height: 1.2; cursor: pointer; } /* .ch10-idea: one idea button: a bold name, left-aligned in a light rounded box at least 48px tall */
    .sec-ch10 .ch10-idea small { font-size: 12.5px; font-weight: 600; color: var(--muted); } /* the system name under a real-systems idea is small and grey */
    .sec-ch10 .ch10-idea:hover { border-color: var(--chc); } /* hovering an idea button outlines it in the chapter color */
    .sec-ch10 .ch10-idea.ok { border-color: var(--ok); background: var(--ok-bg); color: var(--ok); } /* a right pick turns the button green */
    .sec-ch10 .ch10-idea.bad { border-color: var(--bad); background: var(--bad-bg); color: var(--bad); } /* a wrong pick turns it red */
    .sec-ch10 .ch10-fb { min-height: 104px; } /* .ch10-fb: the feedback box keeps a minimum height so the layout stays still between answers */
    .sec-ch10 .ch10-list { display: flex; flex-direction: column; gap: 4px; } /* .ch10-list: the column of ten scenario rows on the right of step 2 */
    .sec-ch10 .ch10-row { display: flex; align-items: center; gap: 9px; min-height: 32px; text-align: left; padding: 3px 9px; border: 1px solid var(--line); border-radius: 9px; background: var(--panel-2); cursor: pointer; color: var(--ink); font: inherit; font-size: 14px; font-weight: 600; } /* .ch10-row: one scenario row: number, short name and result tag in a light rounded box */
    .sec-ch10 .ch10-row:hover { border-color: var(--chc); } /* hovering a scenario row outlines it in the chapter color */
    .sec-ch10 .ch10-row.on { border-color: var(--chc); box-shadow: 0 0 0 1px var(--chc); background: color-mix(in srgb, var(--chc) 8%, var(--panel)); } /* .on: the scenario on screen gets a chapter-colored ring and a faint fill */
    .sec-ch10 .ch10-row .chip { font-size: 12.5px; } /* the result tag in a row uses small text */
    .sec-ch10 .ch10-n { flex: none; display: inline-grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; background: var(--panel-3); font-weight: 800; font-size: 13px; } /* .ch10-n: the round number badge at the start of a scenario row */
    .sec-ch10 .ch10-row.on .ch10-n { background: var(--chc); color: var(--panel); } /* the current row's badge is filled with the chapter color */
    @media (max-width: 760px) { /* @media (max-width: 760px): these rules apply only on windows 760px wide or less */
      .sec-ch10 .ch10-grp, .sec-ch10 .ch10-grp.g4 { grid-template-columns: repeat(2, minmax(0, 1fr)); } /* on a small screen every family of idea buttons uses two columns */
    } /* ends the small-window rules */
  `,  // end of chapter 10's CSS text
  steps: [  // steps: the chapter's own overview steps, shown right after the chapter page and before section 10.1
    {  // step 1 of the chapter 10 overview
      title: 'From one processor to many, and to deadlines',  // title shown at the top of step 1
      kind: 'story',  // kind "story" labels the step "Big Picture" and keeps it on the shorter core path
      render(el, ctx) {  // render(el, ctx): builds the step when it is shown; el is the empty step area, ctx holds the shell's helpers
        const { h, s } = ctx;  // h builds HTML elements and s builds SVG (drawing) elements
        const TH = [['A', 3], ['B', 2], ['C', 4], ['D', 1], ['E', 2]];  // TH: the five ready threads in arrival order, each as [name, ticks of work it needs]
        const DT = 'C', DUE = 7;  // DT: the one thread with a deadline; DUE: the time by which it must be finished
        const WORK = TH.reduce((a, t) => a + t[1], 0);  // WORK: the total work of all five threads, 12 ticks
        const LONG = TH.reduce((a, t) => (t[1] > a[1] ? t : a));  // LONG: the thread that needs the most work (C, 4 ticks)
        const MAXC = 4;  // MAXC: the most processors the switch offers, so the drawing always has four lanes
        let cpus = 1, order = 'arr';  // cpus: how many processors the machine has; order: 'arr' (arrival order) or 'due' (the thread with a deadline goes first)
        function plan(n, ord) {  // plan(n, ord): the whole schedule on n processors when every free processor takes the thread at the front of one shared queue
          const q = ord === 'due' ? TH.filter((t) => t[0] === DT).concat(TH.filter((t) => t[0] !== DT)) : TH.slice();  // q: the queue, in arrival order or with C moved to the front
          const free = Array(n).fill(0);  // free[i]: the time processor i next becomes free; every processor is free at time 0
          const runs = q.map(([name, work]) => {  // for each thread, in queue order:
            const c = free.indexOf(Math.min(...free));  // c: the processor that frees up first (the lowest-numbered one on a tie)
            const r = { name, work, cpu: c, start: free[c], end: free[c] + work };  // r: the thread runs on processor c from the moment it is free until its work is done
            free[c] = r.end;  // that processor is busy until then
            return r;  // keeps the run
          });  // ends the queue loop
          const span = Math.max(...runs.map((r) => r.end));  // span: the time the last thread finishes
          return { runs, span, busy: WORK / (n * span), c: runs.find((r) => r.name === DT) };  // the runs, the finishing time, the share of processor time spent working, and C's run
        }  // ends plan()
        let P = plan(cpus, order);  // P: the schedule now on screen
        // drawing geometry: a phone gets a slimmer picture with larger text so the labels stay readable
        const G = ctx.narrow ? { W: 380, X0: 62, TW: 24, FS: 15, CW: 28 } : { W: 600, X0: 92, TW: 40, FS: 14, CW: 34 };  // G: total width, where the time axis starts, the width of one tick, the font size and the width of a queue chip
        const LANE0 = 66, LSTEP = 40, LH = 32, AXY = LANE0 + MAXC * LSTEP + 2, H = AXY + 26;  // LANE0: the top of the first lane; LSTEP: lane spacing; LH: lane height; AXY: the height of the time axis; H: the drawing's total height
        const X = (t) => G.X0 + t * G.TW;  // X(t): the horizontal position of time t
        const svg = s('svg', { viewBox: `0 0 ${G.W} ${H}`, width: '100%', role: 'img', 'aria-label': 'Timeline of five threads shared out over the chosen number of processors' });  // svg: the timeline drawing, labeled for screen readers
        function draw(t) {  // draw(t): redraws the timeline exactly as it stands at time t
          const k = [];  // k collects the shapes of the new picture
          const waiting = P.runs.filter((r) => r.start > t).map((r) => r.name);  // waiting: the threads still in the queue at time t, front first
          k.push(s('text', { x: 4, y: 30, 'font-size': G.FS, 'font-weight': 800 }, 'Queue'));  // the "Queue" label at the top left
          waiting.forEach((n, i) => {  // each waiting thread becomes a chip in the queue row
            const x = G.X0 + i * (G.CW + 6);  // x: the chips sit side by side from the start of the time axis
            k.push(s('rect', { x, y: 12, width: G.CW, height: 26, rx: 7, class: n === DT ? 's-warn' : 's-thread', 'stroke-width': 1.5 }));  // the chip: amber for C (it has a deadline), pink for the others
            k.push(s('text', { x: x + G.CW / 2, y: 30, 'text-anchor': 'middle', 'font-size': G.FS, 'font-weight': 800 }, n));  // the thread's letter in the chip
          });  // ends the queue chips
          if (!waiting.length) k.push(s('text', { x: G.X0, y: 30, 'font-size': G.FS, class: 's-sub' }, 'empty'));  // an empty queue says so
          for (let c = 0; c < MAXC; c++) {  // one lane per processor slot
            const y = LANE0 + c * LSTEP, on = c < cpus;  // y: the lane's top; on: whether this machine has that processor
            k.push(s('text', { x: 4, y: y + LH / 2 + 5, 'font-size': G.FS, 'font-weight': 800, class: on ? null : 's-sub' }, 'CPU ' + (c + 1)));  // the lane label, grey for a processor this machine lacks
            k.push(s('rect', { x: X(0), y, width: X(WORK) - X(0), height: LH, rx: 6, class: 's-panel', 'stroke-dasharray': on ? null : '4 4', style: on ? null : 'fill-opacity:.35' }));  // the lane background, dashed and pale when the processor is absent
            if (!on) k.push(s('text', { x: X(WORK / 2), y: y + LH / 2 + 5, 'text-anchor': 'middle', 'font-size': G.FS - 1, class: 's-sub' }, 'not in this machine'));  // an absent lane says so
          }  // ends the lanes
          P.runs.forEach((r) => {  // each thread's run on its processor
            const y = LANE0 + r.cpu * LSTEP, done = Math.max(0, Math.min(t, r.end) - r.start);  // y: its lane's top; done: how many of its ticks have run by time t
            const cls = r.name !== DT ? 's-thread' : r.end > t ? 's-warn' : r.end <= DUE ? 's-ok' : 's-bad';  // its color: pink, except C, which stays amber until it finishes and then turns green (on time) or red (late)
            k.push(s('rect', { x: X(r.start) + 1, y: y + 2, width: r.work * G.TW - 2, height: LH - 4, rx: 5, class: cls, style: 'fill-opacity:.22;stroke-opacity:.45' }));  // the whole run drawn faintly: the plan still to come
            if (done > 0) k.push(s('rect', { x: X(r.start) + 1, y: y + 2, width: done * G.TW - (done === r.work ? 2 : 0), height: LH - 4, rx: 5, class: cls, 'stroke-width': 1.5 }));  // the part already run, drawn solid
          });  // ends the runs
          k.push(s('line', { x1: X(DUE), y1: LANE0 - 6, x2: X(DUE), y2: AXY, style: 'stroke:var(--bad)', 'stroke-width': 2, 'stroke-dasharray': '6 4' }));  // C's deadline: a red dashed line at t = 7, drawn over the runs
          k.push(s('text', { x: X(DUE), y: LANE0 - 10, 'text-anchor': 'middle', 'font-size': G.FS - 1, 'font-weight': 800, style: 'fill:var(--bad)' }, 'C due'));  // its label just above the lanes
          k.push(s('line', { x1: X(t), y1: LANE0 - 4, x2: X(t), y2: AXY + 3, style: 'stroke:var(--chc)', 'stroke-width': 2.5 }));  // the "now" line at time t, in the chapter color
          P.runs.forEach((r) => k.push(s('text', { x: X(r.start) + (r.work * G.TW) / 2, y: LANE0 + r.cpu * LSTEP + LH / 2 + 5, 'text-anchor': 'middle', 'font-size': G.FS, 'font-weight': 800, style: 'paint-order:stroke;stroke:var(--panel);stroke-width:4px;stroke-linejoin:round' }, r.name)));  // each thread's letter in the middle of its run, drawn last with a halo so the lines never hide it
          k.push(s('line', { x1: X(0), y1: AXY, x2: X(WORK) + 12, y2: AXY, class: 's-line', 'marker-end': 'url(#arr)' }));  // the time axis, with an arrowhead
          k.push(s('text', { x: 4, y: AXY + 18, 'font-size': 13, class: 's-sub' }, 'time'));  // the axis label
          for (let i = 0; i <= WORK; i++) k.push(s('text', { x: X(i), y: AXY + 18, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': i === t ? 900 : 600, class: i === t ? null : 's-sub', style: i === t ? 'fill:var(--chc)' : null }, String(i)));  // the tick numbers; the current time is bold and chapter-colored
          svg.replaceChildren(...k);  // swaps the old picture for the new one
        }  // ends draw()
        const f2 = (x) => ctx.util.fmt(x, 2);  // f2(x): writes a number with at most two decimal places
        const who = (l) => (l.length === 1 ? l[0] : l.slice(0, -1).join(', ') + ' and ' + l[l.length - 1]);  // who(l): joins names as "A", "A and B" or "A, B and C"
        const cpuWord = (n) => n + (n === 1 ? ' processor' : ' processors');  // cpuWord(n): "1 processor" or "4 processors"
        function verdict() {  // verdict(): one sentence on whether C met its deadline in the current schedule
          const e = P.c.end;  // e: the time C finishes
          return e <= DUE ? `C finished at t = ${e}, in time for its deadline at t = ${DUE}.` : `C finished at t = ${e}, ${e - DUE} ticks after its deadline at t = ${DUE}: a miss.`;  // on time, or how late
        }  // ends verdict()
        function lesson() {  // lesson(): what this particular setting teaches, worked out from the schedule itself
          const pct = Math.round(P.busy * 100);  // pct: the percentage of processor time spent working
          if (cpus === 1) return order === 'arr' ? 'Only one thread can run at a time. Add processors, or let the deadline reorder the queue.' : 'Same processor, same work, yet C now makes it: choosing the order by deadline is the heart of real-time scheduling (10.2).';  // one processor: the bottleneck, or the deadline-first fix
          if (P.span * cpus === WORK) return `Every processor worked every tick (${pct}% busy). Now new questions appear: which processor should each thread use, and should one program’s threads run together? That is 10.1.`;  // a perfect split: the questions of section 10.1
          if (P.span === LONG[1]) return `Not ${cpus}× faster: ${LONG[0]} alone needs ${LONG[1]} ticks and a thread uses one processor at a time, so the processors were busy only ${pct}% of the time.`;  // the longest thread limits the speed-up
          return `This order left a processor idle at the end (${pct}% busy). Meeting a deadline and finishing everything soonest are different goals.`;  // otherwise the queue order left idle time
        }  // ends lesson()
        function caption(t) {  // caption(t): the narration for time t, built from the schedule
          if (t === P.span) return `<b>t = ${t}: all done.</b> ${WORK} ticks of work took ${t} ticks on ${cpuWord(cpus)}${cpus > 1 ? ` (${f2(WORK / t)}× as fast as one)` : ''}. ${verdict()} ${lesson()}`;  // the last frame: the totals, C's fate and the lesson
          const parts = [];  // parts: the events at time t
          const fin = P.runs.filter((r) => r.end === t).map((r) => `${r.name} finishes on CPU ${r.cpu + 1}`);  // fin: the threads finishing now
          const go = P.runs.filter((r) => r.start === t).map((r) => `CPU ${r.cpu + 1} takes ${r.name}`);  // go: the threads dispatched now
          if (fin.length) parts.push(who(fin));  // reports the finishes as one list
          if (go.length) parts.push(who(go) + ' from the front of the queue');  // reports the dispatches as one list
          const busy = new Set(P.runs.filter((r) => r.start <= t && t < r.end).map((r) => r.cpu));  // busy: the processors running a thread at time t
          const idle = Array.from({ length: cpus }, (_, c) => c).filter((c) => !busy.has(c)).map((c) => 'CPU ' + (c + 1));  // idle: the processors with nothing to run at time t
          if (idle.length) parts.push(`${who(idle)} ${idle.length > 1 ? 'sit' : 'sits'} idle`);  // says which processors are idle
          if (!parts.length) parts.push(P.runs.filter((r) => r.start < t && t < r.end).map((r) => `${r.name} keeps running on CPU ${r.cpu + 1}`).join('; '));  // a quiet tick: who keeps running
          const waiting = P.runs.filter((r) => r.start > t).map((r) => r.name);  // waiting: the threads still queued
          const lead = t === 0 ? `<b>t = 0.</b> Five ready <span class="t">threads</span>, ${WORK} ticks of work in all, wait in one shared queue. ` : `<b>t = ${t}.</b> `;  // the opening of the caption; the first frame introduces the threads
          return lead + parts.join('; ') + '. ' + (waiting.length ? `Waiting: ${who(waiting)}.` : 'The queue is empty.') + (t === 0 ? ' Press Play to watch.' : '');  // the events, then who is still waiting (and, on the first frame, how to start)
        }  // ends caption()
        const stats = h('div', { class: 'ch10-stats', 'aria-live': 'polite' });  // stats: the row of result tags for the whole schedule
        function paintStats() {  // paintStats(): refills the result tags from the current schedule
          const ok = P.c.end <= DUE;  // ok: whether C meets its deadline
          stats.replaceChildren(h('span', { class: 'xs muted b' }, 'THIS PLAN:'), h('span', { class: 'chip' }, `done at t = ${P.span}`), h('span', { class: 'chip' }, `speed-up ${f2(WORK / P.span)}×`), h('span', { class: 'chip' }, `${Math.round(P.busy * 100)}% busy`),  // the label, the finishing time, the speed-up over one processor and how busy the processors were
            h('span', { class: 'chip ' + (ok ? 'ok' : 'bad') }, ok ? `✓ C on time (${P.c.end} ≤ ${DUE})` : `✗ C late (${P.c.end} > ${DUE})`));  // C's result: green if it finished by its deadline, red if late
        }  // ends paintStats()
        const player = ctx.ui.player({ count: P.span + 1, interval: 1100, render: (t) => { draw(t); return caption(t); } });  // player: steps through time 0 to the finish; each frame redraws the timeline and returns its narration
        player.caption.classList.add('ch10-cap');  // gives the narration box its minimum height
        function replan() { player.stop(); P = plan(cpus, order); paintStats(); player.setCount(P.span + 1); ctx.refit(); }  // replan(): after a switch changes, stops playback, recomputes the schedule and the tags, and restarts the timeline at t = 0
        const procSeg = ctx.ui.seg([1, 2, 4].map((n) => ({ value: n, label: String(n) })), cpus, (v) => { cpus = v; replan(); });  // procSeg: the 1 / 2 / 4 processor switch
        const ordSeg = ctx.ui.seg([{ value: 'arr', label: 'Arrival order' }, { value: 'due', label: 'Deadline first' }], order, (v) => { order = v; replan(); });  // ordSeg: the queue-order switch
        const MAP = [  // MAP: the roadmap, one row per section as [number, title, what it covers]
          ['10.1', 'Multiprocessor and multicore', 'How tightly processors are coupled, how often a program’s threads must synchronize, and four ways to place threads: load sharing (the one shared queue on the left), gang scheduling, dedicated processors and dynamic scheduling. On a multicore chip, which threads share a cache matters too.'],  // 10.1: multiprocessor and multicore scheduling
          ['10.2', 'Real-time scheduling', 'Hard and soft deadlines, the five things a real-time OS must provide, and the classic policies: earliest deadline first and rate monotonic scheduling. Then priority inversion, and how priority inheritance and priority ceilings cure it.'],  // 10.2: real-time scheduling
          ['10.3', 'Linux', 'Real-time classes (SCHED_FIFO, SCHED_RR) above normal threads, the O(1) scheduler of the early 2.6 kernels, the Completely Fair Scheduler that runs whoever has had the least weighted processor time, and EEVDF, which replaced it in 2023.'],  // 10.3: Linux scheduling
          ['10.4', 'UNIX SVR4', 'One scale of 160 priorities shared by real-time, kernel and time-sharing classes, preemption points that shorten the wait for urgent work, and a tunable dispatch table that sets each time-sharing level’s quantum and next priority.'],  // 10.4: UNIX SVR4 scheduling
          ['10.5', 'UNIX FreeBSD', 'The ULE scheduler: priority classes, a run queue per core, an interactivity score that tells a person typing from a long computation, and load balancing that pulls and pushes threads between cores.'],  // 10.5: FreeBSD scheduling
          ['10.6', 'Windows', '32 priority levels (16 real-time, 16 variable), a boost for a thread that stops waiting, decay back to its base priority, rescue of threads that have waited too long, and processor affinity.'],  // 10.6: Windows scheduling
        ];  // closes the roadmap
        let pick = 0;  // pick: the roadmap row that is open, 10.1 at first
        const mapBox = h('div', { class: 'stack', style: { gap: '6px' } });  // mapBox: the column of roadmap rows
        function paintMap() {  // paintMap(): redraws the roadmap with the chosen row open
          mapBox.replaceChildren(...MAP.map(([id, name, d], i) => h('button', { class: 'ch10-map' + (i === pick ? ' on' : ''), type: 'button', 'aria-expanded': String(i === pick), onclick: () => { pick = i; paintMap(); ctx.refit(); } },  // one row per section; a click opens it
            h('span', { class: 'ch10-id' }, id), h('span', {}, h('b', {}, name), ...(i === pick ? [h('span', { class: 'small ch10-d' }, d)] : [])))));  // the number pill, the title, and for the open row its description
        }  // ends paintMap()
        el.append(h('div', { class: 'split r fill' },  // puts step 1 on screen: two columns, the larger one on the left
          h('div', { class: 'stack', style: { gap: '8px' } },  // left column, stacked 8px apart:
            h('div', { class: 'row ch10-ctl' }, h('div', { class: 'row nw', style: { gap: '8px' } }, h('span', { class: 'small b' }, 'Processors:'), procSeg), h('div', { class: 'row nw', style: { gap: '8px' } }, h('span', { class: 'small b' }, 'Queue order:'), ordSeg)),  // the two switches, each kept on one line with its label
            h('div', { class: 'card white ch10-vis' }, svg), stats, player.el),  // the timeline card, the result tags and the player; ends the left column
          h('div', { class: 'stack', style: { gap: '8px' } },  // right column, stacked 8px apart:
            h('h4', { class: 'm0' }, 'Where this chapter goes'), mapBox,  // the roadmap heading and rows
            h('div', { class: 'callout why m0 small', 'data-label': 'In the timeline', html: 'Every free processor taking the next thread from one shared queue is <span class="t">load sharing</span> (10.1). Letting a <span class="t">deadline</span> reorder that queue is where real-time scheduling (10.2) begins.' }))));  // blue callout linking the timeline to sections 10.1 and 10.2; ends the layout
        paintStats(); paintMap();  // fills the result tags and the roadmap when the step opens
      },  // ends render() for step 1
    },  // closes step 1
    {  // step 2 of the chapter 10 overview
      title: 'Which scheduler idea is this?',  // title shown at the top of step 2
      kind: 'explore',  // kind "explore" labels the step "Explore"
      render(el, ctx) {  // render(el, ctx): builds step 2 when it is shown
        const { h } = ctx;  // h is the helper that builds HTML elements
        const IDEAS = [  // IDEAS: the ten ideas to choose from, in three families, each with its glossary term, system, section and a plain definition
          { k: 'ls', fam: 0, name: 'Load sharing', term: 'Load sharing', where: '10.1', def: 'one global queue of ready threads; whichever processor goes idle takes the next thread from it, and no thread is tied to a processor.' },  // idea: load sharing
          { k: 'gang', fam: 0, name: 'Gang scheduling', term: 'Gang scheduling', where: '10.1', def: 'the related threads of one program are started together on a set of processors, one thread per processor, so they run at the same time.' },  // idea: gang scheduling
          { k: 'aff', fam: 0, name: 'Processor affinity', term: 'Processor affinity', where: '10.1 and 10.5', def: 'the scheduler prefers to run a thread on the processor that ran it last (or one that shares its cache), because that cache may still hold its data.' },  // idea: processor affinity
          { k: 'edf', fam: 1, name: 'Earliest deadline first', term: 'Earliest deadline first', where: '10.2', def: 'among the ready tasks, always run the one whose deadline is nearest, and choose again whenever a task arrives or finishes.' },  // idea: earliest deadline first
          { k: 'rms', fam: 1, name: 'Rate monotonic', term: 'Rate monotonic scheduling', where: '10.2', def: 'each periodic task gets a fixed priority from its period: the shorter the period (the higher the rate), the higher the priority.' },  // idea: rate monotonic scheduling
          { k: 'inh', fam: 1, name: 'Priority inheritance', term: 'Priority inheritance', where: '10.2', def: 'a task holding a lock that a higher-priority task is waiting for runs at the waiter’s priority until it releases the lock.' },  // idea: priority inheritance
          { k: 'cfs', fam: 2, name: 'Virtual runtime', sys: 'Linux CFS', term: 'Virtual runtime', where: '10.3', def: 'each normal task’s processor time is scaled by its weight, and the scheduler always runs the task with the smallest total, so each task’s share follows its weight.' },  // idea: virtual runtime in the Completely Fair Scheduler
          { k: 'tbl', fam: 2, name: 'Dispatch table', sys: 'UNIX SVR4', term: 'Dispatch table', where: '10.4', def: 'a tunable table with one row per time-sharing priority gives that level’s quantum and the new priority to use after a used-up quantum or a sleep.' },  // idea: the SVR4 dispatch table
          { k: 'ule', fam: 2, name: 'Interactivity score', sys: 'FreeBSD ULE', term: 'Interactivity score', where: '10.5', def: 'a score from 0 to 100 computed from a thread’s recent voluntary sleep time against its run time: low means interactive, high means batch.' },  // idea: the ULE interactivity score
          { k: 'boost', fam: 2, name: 'Priority boost', sys: 'Windows', term: 'Priority boost', where: '10.6', def: 'a thread that stops waiting, for example when its I/O completes, rises above its base priority for a while, then sinks back one level per full quantum it uses.' },  // idea: the Windows priority boost
        ];  // closes the ideas list
        const BY = Object.fromEntries(IDEAS.map((x) => [x.k, x]));  // BY: looks up an idea by its key
        const FAMS = ['WHERE THREADS RUN · 10.1', 'MEETING DEADLINES · 10.2', 'REAL KERNELS · 10.3 TO 10.6'];  // FAMS: the headings of the three families of ideas
        const SC = [  // SC: the ten scenarios, deliberately not in the order of the buttons; k names the idea each one shows
          { k: 'aff', short: 'The returning thread', text: 'A thread wakes up after a short sleep, and two processors are idle. The scheduler puts it back on the one it ran on a moment ago, because that processor’s cache probably still holds the thread’s data.' },  // scenario 1: processor affinity
          { k: 'edf', short: 'The controller', text: 'A controller has three ready jobs, due in 9 ms, 4 ms and 15 ms. It runs the job due in 4 ms first, and it decides again every time a new job arrives or one finishes.' },  // scenario 2: earliest deadline first
          { k: 'ls', short: 'The busy server', text: 'A server keeps a single list of ready threads. Whenever any of its eight processors runs out of work, it takes the thread at the front of that list, no matter which processor that thread used before.' },  // scenario 3: load sharing
          { k: 'boost', short: 'The key press', text: 'A thread has been blocked, waiting for keyboard input. When a key arrives, its priority jumps several levels above its usual level. Each full quantum it then uses lowers it one level, until it is back where it started.' },  // scenario 4: priority boost
          { k: 'gang', short: 'The simulation', text: 'A simulation runs as four threads that swap partial results every few microseconds. The OS starts all four at the same instant on four processors, so none of them waits for a partner that is not running.' },  // scenario 5: gang scheduling
          { k: 'rms', short: 'The sensor and the log', text: 'Before the device ships, each periodic task is given a fixed priority. A sensor read that repeats every 10 ms outranks a log write that repeats every 100 ms, simply because it repeats more often.' },  // scenario 6: rate monotonic scheduling
          { k: 'tbl', short: 'The used-up quantum', text: 'A time-sharing process uses up its whole quantum. The kernel looks up the row for its current priority in a table the administrator can tune, and that row gives its new, lower priority.' },  // scenario 7: the dispatch table
          { k: 'inh', short: 'The logger and the lock', text: 'A low-priority logging task holds a lock that a high-priority control task needs. While the control task waits, the logger runs at the control task’s priority, so medium-priority work cannot keep pushing it aside.' },  // scenario 8: priority inheritance
          { k: 'ule', short: 'The editor and the compiler', text: 'The scheduler compares how long each thread has recently slept by choice with how long it has run. A text editor that mostly waits for keystrokes is treated as interactive; a compiler that never pauses is treated as batch.' },  // scenario 9: the interactivity score
          { k: 'cfs', short: 'The ordinary tasks', text: 'For ordinary tasks, the scheduler keeps a running total of processor time, scaled by each task’s weight, and always picks the task with the smallest total. A task that has had a lot of time drifts to the back.' },  // scenario 10: virtual runtime
        ];  // closes the scenarios list
        const ans = SC.map(() => null);  // ans: the idea the student has picked for each scenario, null until picked
        let cur = 0;  // cur: the scenario on screen, counting from 0
        const scHead = h('div', { class: 'xs muted b' });  // scHead: the "SCENARIO n OF 10" label
        const scText = h('p', { class: 'ch10-text m0' });  // scText: the scenario's story
        const nextOpen = () => { for (let d = 1; d <= SC.length; d++) { const j = (cur + d) % SC.length; if (ans[j] !== SC[j].k) return j; } return (cur + 1) % SC.length; };  // nextOpen(): the next scenario not yet answered correctly, or simply the next one if all are done
        const nextBtn = h('button', { class: 'btn sm primary', type: 'button', style: { marginLeft: 'auto' }, onclick: () => { cur = nextOpen(); paint(); } }, 'Next scenario ▶');  // nextBtn: moves on to the next unsolved scenario
        const card = h('div', { class: 'card white ch10-sc', 'aria-live': 'polite' }, h('div', { class: 'row', style: { alignItems: 'center' } }, scHead, nextBtn), scText);  // card: the scenario card: its label and the Next button on one line, the story under them
        const ideaBtns = IDEAS.map((x) => h('button', { class: 'ch10-idea', type: 'button', onclick: () => { ans[cur] = x.k; paint(); } }, x.name, ...(x.sys ? [h('small', {}, x.sys)] : [])));  // ideaBtns: one button per idea (with its system's name under it for the real kernels); a click picks it for the current scenario
        const groups = FAMS.map((f, i) => h('div', { class: 'stack', style: { gap: '4px' } }, h('div', { class: 'xs muted b' }, f), h('div', { class: 'ch10-grp' + (i === 2 ? ' g4' : '') }, ...ideaBtns.filter((_, j) => IDEAS[j].fam === i))));  // groups: the three families, each a small heading over its buttons
        const fb = h('div', { class: 'callout m0 small ch10-fb', 'aria-live': 'polite' });  // fb: the feedback callout, read aloud when it changes
        const list = h('div', { class: 'ch10-list' });  // list: the column of scenario rows on the right
        const score = h('span', { class: 'big', style: { fontSize: '32px' } });  // score: the "n / 10" count
        function paint() {  // paint(): redraws the card, the buttons, the feedback, the list and the score after every click
          const sc = SC[cur], a = ans[cur], ok = a === sc.k;  // sc: the scenario on screen; a: the student's pick for it; ok: whether that pick is right
          scHead.textContent = `SCENARIO ${cur + 1} OF ${SC.length}: ${sc.short.toUpperCase()}`;  // the label, such as "SCENARIO 3 OF 10: THE BUSY SERVER"
          scText.textContent = sc.text;  // the story
          ideaBtns.forEach((b, i) => { const k = IDEAS[i].k; b.classList.toggle('ok', a === k && ok); b.classList.toggle('bad', a === k && !ok); b.setAttribute('aria-pressed', String(a === k)); });  // marks the picked button green or red and tells screen readers which one is pressed
          fb.className = 'callout m0 small ch10-fb ' + (a == null ? '' : ok ? 'tip' : 'bad');  // the feedback box's color: plain before a pick, green if right, red if wrong
          fb.dataset.label = a == null ? 'Your move' : ok ? 'Correct: ' + BY[sc.k].name : 'Not quite';  // its label
          fb.innerHTML = a == null ? 'Which idea is at work in this scenario? Pick one of the ten buttons.'  // before a pick: the instruction
            : ok ? `<span class="t">${BY[a].term}</span>${BY[a].sys ? ` (${BY[a].sys})` : ''}: ${BY[a].def} You will meet it in ${BY[a].where.includes(' and ') ? 'Sections' : 'Section'} ${BY[a].where}.`  // a right pick: the idea's definition and the section (or sections) that teach it
            : `<b>${BY[a].name}</b> means: ${BY[a].def} Does that fit this story? Try another idea.`;  // a wrong pick: what the chosen idea really means, and a nudge to try again
          list.replaceChildren(...SC.map((x, i) => {  // rebuilds the ten scenario rows
            const st = ans[i] == null ? '' : ans[i] === x.k ? 'ok' : 'bad';  // st: the row's state: unanswered, right or wrong
            return h('button', { class: 'ch10-row' + (i === cur ? ' on' : ''), type: 'button', 'aria-pressed': String(i === cur), onclick: () => { cur = i; paint(); } },  // one row; a click shows that scenario
              h('span', { class: 'ch10-n' }, String(i + 1)), h('span', { class: 'grow' }, x.short),  // the number badge and the short name
              st ? h('span', { class: 'chip ' + st }, (st === 'ok' ? '✓ ' : '✗ ') + BY[ans[i]].name) : h('span', { class: 'xs muted' }, 'not answered'));  // the tag: the pick with a check or a cross, or "not answered"
          }));  // ends the rows
          score.textContent = `${SC.filter((x, i) => ans[i] === x.k).length} / ${SC.length}`;  // the score: how many scenarios are matched correctly
          ctx.refit();  // re-checks that the step still fits
        }  // ends paint()
        el.append(h('div', { class: 'split r fill' },  // puts step 2 on screen: two columns, the larger one on the left
          h('div', { class: 'stack', style: { gap: '10px' } }, card, ...groups, fb),  // left column, stacked 10px apart: the scenario card, the three families of buttons and the feedback
          h('div', { class: 'stack', style: { gap: '8px' } },  // right column, stacked 8px apart:
            h('div', { class: 'row', style: { alignItems: 'baseline' } }, score, h('span', { class: 'small b' }, 'matched'), h('span', { class: 'xs muted' }, 'click a row to revisit it'),  // the score, the word "matched" and a hint
              h('button', { class: 'btn sm', type: 'button', style: { marginLeft: 'auto', alignSelf: 'center' }, onclick: () => { ans.fill(null); cur = 0; paint(); } }, 'Start over')),  // a "Start over" button pushed to the right that clears every answer
            list,  // the ten scenario rows
            h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: '<span class="t">Priority inheritance</span> and a <span class="t">priority boost</span> both raise a priority for a while, but for different reasons: inheritance because a more urgent task waits on a lock the low task holds, a boost because a wait has just ended.' }))));  // amber "Common mistake" callout contrasting inheritance with a boost; ends the layout
        paint();  // draws the step when it opens
      },  // ends render() for step 2
    },  // closes step 2
  ],  // closes the chapter's steps list

  notes: `${/* notes: the chapter 10 summary shown in the Notes drawer on the overview steps and in the printed guide */''}
    <h3>How Chapter 10 fits together</h3>${/* notes heading: how chapter 10 fits together */''}
    <p>Chapter 9 chose the next process for a single processor. Chapter 10 asks what changes when there are many processors, and what changes when work has deadlines. In the overview timeline, five threads needing 3, 2, 4, 1 and 2 ticks (12 in all) share one queue and finish at t = 12 on one processor, t = 6 on two and t = 4 on four. Four processors give only a 3× speed-up (75% busy), because C alone needs 4 ticks and a thread runs on one processor at a time. C is due at t = 7: in arrival order on one processor it finishes at t = 9 and misses; moved to the front of the queue it finishes at t = 4 and makes it.</p>${/* notes paragraph: the question of the chapter and the overview timeline's numbers */''}
    <h4>Many processors (10.1)</h4>${/* notes heading: many processors (section 10.1) */''}
    <p>Multiprocessors range from loosely coupled clusters to tightly coupled machines that share one memory, and granularity measures how often the parallel parts of a program must synchronize. The design issues are assigning processes to processors (statically or dynamically), multiprogramming on each processor, and dispatching. Threads are placed by <b>load sharing</b> (one global queue), <b>gang scheduling</b> (related threads run at the same time), <b>dedicated processor assignment</b> or <b>dynamic scheduling</b>. On a multicore chip, threads that share data do well on cores that share a cache, while threads that compete for cache space are better kept apart.</p>${/* notes paragraph: multiprocessor kinds, design issues, the four thread-scheduling approaches and multicore caches */''}
    <h4>Deadlines (10.2)</h4>${/* notes heading: deadlines (section 10.2) */''}
    <p>A <b>hard</b> real-time task must meet its deadline; a <b>soft</b> one should. A real-time OS needs determinism, responsiveness, user control, reliability and fail-soft operation. <b>Earliest deadline first</b> runs the task whose deadline is nearest; <b>rate monotonic scheduling</b> gives shorter periods higher fixed priorities and is guaranteed when total utilization stays within n(2<sup>1/n</sup> − 1). <b>Priority inversion</b>, a high-priority task stuck behind a low-priority lock holder, is cured by <b>priority inheritance</b> or a <b>priority ceiling</b>.</p>${/* notes paragraph: hard and soft tasks, real-time OS requirements, EDF, rate monotonic and priority inversion */''}
    <h4>Real systems (10.3 to 10.6)</h4>${/* notes heading: real systems (sections 10.3 to 10.6) */''}
    <p><b>Linux</b> puts real-time classes (SCHED_FIFO, SCHED_RR) above normal tasks; the 2.6 kernels brought the O(1) scheduler, and from 2.6.23 the Completely Fair Scheduler ran normal tasks by smallest virtual runtime until EEVDF replaced it in 6.6 (2023). <b>UNIX SVR4</b> ranks every process on 160 global priorities in real-time, kernel and time-sharing classes, with preemption points and a tunable dispatch table. <b>FreeBSD</b>’s ULE scheduler keeps a run queue per core, uses an interactivity score to favor threads that mostly sleep, and balances load by pulling and pushing threads. <b>Windows</b> has 32 levels (16 real-time, 16 variable), boosts threads that stop waiting, lets the boost decay and rescues threads that have waited too long.</p>${/* notes paragraph: the Linux, SVR4, FreeBSD and Windows schedulers in brief */''}
    <h4>Why it matters next</h4>${/* notes heading: why it matters next */''}
    <p>Scheduling decides when work runs. Chapter 11 turns to the slowest work of all, input and output, where the order in which disk requests are served matters as much as the order of threads.</p>`,  // notes paragraph: the link to chapter 11; end of the notes text
});  // ends chapter 10

Guide.chapter({  // registers chapter 11 with the guide
  num: 11,  // num: the chapter number; it sets the chapter's order, its color (--ch11) and page addresses such as #ch11
  title: 'I/O Management and Disk Scheduling',  // title shown on the chapter card, the chapter overview page and the top-bar tooltip
  tagline: 'Devices are slow, varied and everywhere. The OS hides their differences and keeps the disk arm from wasting time.',  // tagline: the one-sentence hook printed in the chapter color at the top of the chapter overview page
  intro: '<p>Input and output is where the computer meets the world, and it is the slowest and most varied part of any system. This chapter shows how I/O is organized, why buffers smooth out speed differences, how the order of disk requests changes performance, how RAID spreads data over many disks, how a disk cache avoids trips to the disk, and how UNIX, Linux and Windows build their I/O systems.</p>',  // intro: the opening paragraph of the chapter overview page
  objectives: [  // objectives: the list shown under "After this chapter you will be able to" on the overview page and in the printed guide
    'Summarize the kinds of I/O devices and the three ways to perform I/O.',  // objective 1: device kinds, and programmed I/O, interrupt-driven I/O and DMA
    'Explain the layered organization of the I/O function and the purpose of I/O buffering.',  // objective 2: I/O layers and buffering
    'Compute disk access times and compare disk scheduling policies.',  // objective 3: disk timing and scheduling policies
    'Describe the RAID levels and the design of a disk cache.',  // objective 4: RAID and disk caches
    'Compare the I/O facilities of UNIX SVR4, Linux and Windows.',  // objective 5: three real I/O systems
  ],  // closes the objectives list
  terms: [  // terms: chapter-level glossary entries as [term, definition] pairs, used by the overview steps; the sections define the rest
    ['Seek time', 'The time the disk arm takes to move the read/write heads to the track that holds the wanted data.'],  // glossary entry: defines seek time
    ['Rotational delay (rotational latency)', 'Once the head is on the right track, the time spent waiting for the wanted sector to spin around under it; on average half a revolution.'],  // glossary entry: defines rotational delay
    ['Transfer time', 'The time the wanted sectors take to pass under the head while their data is read or written.'],  // glossary entry: defines transfer time
    ['Disk scheduling', 'The operating system choosing which waiting disk request to serve next, mainly to cut the time the arm spends moving and to keep any request from waiting too long.'],  // glossary entry: defines disk scheduling
    ['I/O buffering', 'Holding data in a reserved area of main memory on its way between a device and a process, so input can arrive before it is asked for and output can leave after the process has moved on.'],  // glossary entry: defines I/O buffering
    ['Double buffering (buffer swapping)', 'Using two system buffers for one transfer: the device fills (or empties) one while the process empties (or fills) the other, and then the two swap roles.'],  // glossary entry: defines double buffering
    ['RAID (redundant array of independent disks)', 'Several physical disks that the operating system treats as one logical drive. Data is spread across them and, at every level except RAID 0, extra information lets the array survive a failed disk.'],  // glossary entry: defines RAID
    ['Striping', 'Laying consecutive strips of data across the disks of an array in turn, so several disks can work on the data at the same time.'],  // glossary entry: defines striping
    ['Mirroring', 'Keeping an identical copy of every strip on a second disk (RAID 1), so either copy can serve a read and one copy survives if a disk fails.'],  // glossary entry: defines mirroring
    ['Distributed parity', 'Parity strips, computed with exclusive-OR, placed on the disks of an array in rotation (RAID 5), so any one failed disk can be rebuilt and no single disk takes part in every write.'],  // glossary entry: defines distributed parity
    ['Spooler', 'A program that collects whole jobs for a shared slow device, such as a printer, in a queue on disk and feeds them to the device one at a time, so the programs that made them never wait for it.'],  // glossary entry: defines a spooler
  ],  // closes the terms list
  css: ` /* css: style rules used only by chapter 11's overview steps; each rule starts with .sec-ch11, the canvas class on these steps */
    .sec-ch11 .ch11-head, .sec-ch11 .ch11-row { display: grid; grid-template-columns: 24px minmax(0, 1fr) 150px 78px; gap: 8px; align-items: center; } /* .ch11-head and .ch11-row share four columns: stage number (24px), stage name, log-scale bar (150px) and time (78px) */
    .sec-ch11 .ch11-head { padding: 0 9px; font-size: 12.5px; font-weight: 700; color: var(--muted); } /* .ch11-head: the small grey column titles over the stage rows */
    .sec-ch11 .ch11-rows { display: flex; flex-direction: column; gap: 3px; } /* .ch11-rows: the nine stage rows stacked 3px apart */
    .sec-ch11 .ch11-row { min-height: 35px; padding: 2px 8px; border: 1px solid var(--line); border-radius: 9px; background: var(--panel-2); color: var(--ink); font: inherit; text-align: left; cursor: pointer; } /* .ch11-row: one stage of the read as a button: a light rounded box with left-aligned text */
    .sec-ch11 .ch11-row:hover { border-color: var(--chc); } /* hovering a stage outlines it in the chapter color */
    .sec-ch11 .ch11-row.on { border-color: var(--chc); box-shadow: 0 0 0 1px var(--chc); background: color-mix(in srgb, var(--chc) 10%, var(--panel)); } /* .on: the stage the request is at now gets a chapter-colored ring and a faint chapter-colored fill */
    .sec-ch11 .ch11-row.tag { border-left: 5px solid var(--chc); padding-left: 4px; } /* .tag: a stage covered by the roadmap section chosen on the right gets a thick chapter-colored left edge */
    .sec-ch11 .ch11-row:disabled { opacity: .45; cursor: default; } /* a stage skipped in this case is faded and cannot be clicked */
    .sec-ch11 .ch11-n { display: inline-grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; background: var(--panel-3); font-weight: 800; font-size: 12.5px; } /* .ch11-n: the round stage number */
    .sec-ch11 .ch11-row.past .ch11-n, .sec-ch11 .ch11-row.on .ch11-n { background: var(--chc); color: var(--panel); } /* the numbers of stages already reached are filled in the chapter color */
    .sec-ch11 .ch11-nm { display: flex; flex-direction: column; line-height: 1.15; min-width: 0; } /* .ch11-nm: the stage name over its layer description */
    .sec-ch11 .ch11-nm b { font-size: 14.5px; } /* the stage name is bold at 14.5px */
    .sec-ch11 .ch11-nm span { font-size: 12.5px; color: var(--muted); } /* the layer description under it is small and grey */
    .sec-ch11 .ch11-pill { display: inline-block; margin-left: 6px; padding: 0 6px; border-radius: 999px; font-size: 12px; font-weight: 800; color: var(--chc); border: 1px solid var(--chc); } /* .ch11-pill: the small "§11.5" tag beside a stage name that the chosen roadmap section covers */
    .sec-ch11 .ch11-log { position: relative; height: 12px; border-radius: 4px; overflow: hidden; background-color: var(--panel-3); background-image: repeating-linear-gradient(90deg, var(--line-2) 0 1px, transparent 1px 30px); } /* .ch11-log: the log-scale track: 150px wide, with a faint tick every 30px, one per power of ten */
    .sec-ch11 .ch11-log i { position: absolute; left: 0; top: 2px; bottom: 2px; border-radius: 3px; } /* the colored bar inside the track, its width set by the code */
    .sec-ch11 .ch11-t { font-family: var(--mono); font-size: 13px; text-align: right; white-space: nowrap; } /* .ch11-t: the stage's time, right-aligned in the fixed-width font */
    .sec-ch11 .k-sw { background: var(--os); } /* k-sw: software stages are drawn in OS violet */
    .sec-ch11 .k-seek { background: var(--io); } /* k-seek: the seek is drawn in I/O orange */
    .sec-ch11 .k-rot { background: repeating-linear-gradient(45deg, var(--io) 0 4px, color-mix(in srgb, var(--io) 35%, var(--panel)) 4px 8px); } /* k-rot: the rotational delay is drawn in orange stripes, waiting for the platter to spin */
    .sec-ch11 .k-xfer { background: var(--mem); } /* k-xfer: the transfer into memory is drawn in memory green */
    .sec-ch11 .ch11-cap { min-height: 108px; } /* .ch11-cap: the narration box keeps a minimum height so the layout stays still between stages */
    .sec-ch11 .ch11-lin { display: flex; height: 26px; border-radius: 7px; overflow: hidden; border: 1px solid var(--line); background: var(--panel-3); } /* .ch11-lin: the linear "where the time goes" bar: a 26px track that the stages fill from the left */
    .sec-ch11 .ch11-lin i { flex: none; height: 100%; } /* each stage's piece of the bar keeps exactly the width the code gives it */
    .sec-ch11 .ch11-leg { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 13px; } /* .ch11-leg: the legend under the bar, wrapping onto a second line if needed */
    .sec-ch11 .ch11-leg span { display: inline-flex; align-items: center; gap: 5px; } /* one legend item: a color square and its text side by side */
    .sec-ch11 .ch11-dot { display: inline-block; width: 12px; height: 12px; border-radius: 3px; } /* .ch11-dot: the small color square in the legend */
    .sec-ch11 .ch11-stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; } /* .ch11-stats: the two number cards side by side */
    .sec-ch11 .ch11-big { font-size: 24px; font-weight: 800; line-height: 1.15; color: var(--chc); font-variant-numeric: tabular-nums; } /* .ch11-big: the large number in a card, in the chapter color with digits of equal width */
    .sec-ch11 .ch11-map { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; } /* .ch11-map: the six roadmap buttons in two columns */
    .sec-ch11 .ch11-mb { display: flex; flex-direction: column; align-items: flex-start; text-align: left; padding: 4px 9px; border: 1px solid var(--line); border-radius: 9px; background: var(--panel-2); color: var(--ink); font: inherit; line-height: 1.2; cursor: pointer; } /* .ch11-mb: one roadmap button: the section and its name over a short description */
    .sec-ch11 .ch11-mb:hover { border-color: var(--chc); } /* hovering a roadmap button outlines it in the chapter color */
    .sec-ch11 .ch11-mb.on { border-color: var(--chc); box-shadow: 0 0 0 1px var(--chc); background: color-mix(in srgb, var(--chc) 10%, var(--panel)); } /* .on: the chosen roadmap section gets a chapter-colored ring and fill */
    .sec-ch11 .ch11-mb b { font-size: 14px; } /* the section and its name are bold at 14px */
    .sec-ch11 .ch11-mb span { font-size: 12.5px; color: var(--muted); } /* the short description under it is small and grey */
    .sec-ch11 .ch11-sc { min-height: 150px; border-left: 5px solid var(--chc); } /* .ch11-sc: step 2's problem card, with a minimum height and a thick chapter-colored left edge */
    .sec-ch11 .ch11-text { font-size: 18px; line-height: 1.45; margin-top: 4px !important; } /* .ch11-text: the problem's story at full reading size */
    .sec-ch11 .ch11-tools { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; } /* .ch11-tools: the eight tool buttons in four columns */
    .sec-ch11 .ch11-tool { display: flex; flex-direction: column; align-items: flex-start; text-align: left; padding: 8px 10px; border: 1px solid var(--line); border-radius: 10px; background: var(--panel-2); color: var(--ink); font: inherit; line-height: 1.2; cursor: pointer; } /* .ch11-tool: one tool button: its bold name over a short description, left-aligned in a light rounded box */
    .sec-ch11 .ch11-tool:hover { border-color: var(--chc); } /* hovering a tool button outlines it in the chapter color */
    .sec-ch11 .ch11-tool b { font-size: 14.5px; } /* the tool name is bold at 14.5px */
    .sec-ch11 .ch11-tool span { font-size: 12.5px; color: var(--muted); } /* the description under it is small and grey */
    .sec-ch11 .ch11-tool.ok { border-color: var(--ok); background: var(--ok-bg); } /* a right pick turns the button green */
    .sec-ch11 .ch11-tool.bad { border-color: var(--bad); background: var(--bad-bg); } /* a wrong pick turns it red */
    .sec-ch11 .ch11-fb { min-height: 118px; } /* .ch11-fb: the feedback box keeps a minimum height so the layout stays still between answers */
    .sec-ch11 .ch11-list { display: flex; flex-direction: column; gap: 4px; } /* .ch11-list: the nine problem rows on the right, 4px apart */
    .sec-ch11 .ch11-li { display: flex; align-items: center; gap: 9px; text-align: left; padding: 6px 10px; border: 1px solid var(--line); border-radius: 9px; background: var(--panel-2); color: var(--ink); font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; } /* .ch11-li: one problem row: its number, its short name and its answer tag, in a light rounded box */
    .sec-ch11 .ch11-li:hover { border-color: var(--chc); } /* hovering a problem row outlines it in the chapter color */
    .sec-ch11 .ch11-li.on { border-color: var(--chc); box-shadow: 0 0 0 1px var(--chc); background: color-mix(in srgb, var(--chc) 9%, var(--panel)); } /* .on: the problem on screen gets a chapter-colored ring and fill */
    .sec-ch11 .ch11-li .ch11-n { flex: none; } /* the round number in a problem row never shrinks */
    @media (max-width: 760px) { /* @media (max-width: 760px): these rules apply only on windows 760px wide or less */
      .sec-ch11 .ch11-tools { grid-template-columns: repeat(2, minmax(0, 1fr)); } /* on a small screen the tool buttons sit in two columns */
      .sec-ch11 .ch11-head, .sec-ch11 .ch11-row { grid-template-columns: 22px minmax(0, 1fr) 90px 64px; gap: 6px; } /* on a small screen the stage rows give the log bar 90px and the time 64px */
      .sec-ch11 .ch11-log { background-image: repeating-linear-gradient(90deg, var(--line-2) 0 1px, transparent 1px 18px); } /* and the log track's ticks sit 18px apart, still one per power of ten */
    } /* ends the small-window rules */
  `,  // end of chapter 11's CSS text
  steps: [  // steps: the chapter's own overview steps, shown right after the chapter page and before section 11.1
    {  // step 1 of the chapter 11 overview
      title: 'The slowest part of the computer',  // title shown at the top of step 1
      kind: 'story',  // kind "story" labels the step "Big Picture" and keeps it on the shorter core path
      render(el, ctx) {  // render(el, ctx): builds the step when it is shown; el is the empty step area, ctx holds the shell's helpers
        const { h } = ctx;  // h builds HTML elements
        const fmt = ctx.util.fmt;  // fmt(v, d): rounds v to at most d decimal places and adds thousands commas
        // the hard disk from section 11.5's worked example, and the one 4 KB block the program reads from it
        const DISK = { seek: 4, rpm: 7500, spt: 500, sector: 512, block: 4096 };  // DISK: average seek 4 ms, 7,500 rpm, 500 sectors of 512 bytes per track; the block is 4,096 bytes
        const REV = 60000 / DISK.rpm;  // REV: one revolution in ms: 60,000 ms in a minute ÷ 7,500 turns a minute = 8 ms
        const ROT = REV / 2;  // ROT: the average rotational delay, half a revolution (4 ms)
        const SECTS = DISK.block / DISK.sector;  // SECTS: sectors in one block, 4,096 ÷ 512 = 8
        const XFER = (SECTS / DISK.spt) * REV;  // XFER: transfer time, the 8/500 of a turn those sectors take to pass the head (0.128 ms)
        const FLASH = 0.1;  // FLASH: a typical SSD read of one block in ms, a round figure (real drives vary)
        const MEM = 0.0001;  // MEM: one main-memory access in ms, about 100 ns, a round figure
        const CYCLE = 1 / 3e6;  // CYCLE: one clock cycle of a 3 GHz processor in ms (3 billion a second is 3 million a millisecond)
        // the nine stages of one read(), down to the device and back up; t holds each stage's time in ms for the three cases:
        // hdd (hard disk), ssd (solid-state disk) and hit (the block is already in the disk cache). The software times are rough
        // typical figures; the disk times come from DISK above. 0 means the stage does not exist here; null means it is skipped.
        const STAGES = [  // STAGES: the nine stages, each with a key, name, layer description, color class and times
          { k: 'call', name: 'read() system call', layer: 'your program enters the kernel', cls: 'sw', t: { hdd: 0.0005, ssd: 0.0005, hit: 0.0005 } },  // stage 1: the system call, about 0.5 µs
          { k: 'fs', name: 'File system layers', layer: 'directory management, file system', cls: 'sw', t: { hdd: 0.001, ssd: 0.001, hit: 0.001 } },  // stage 2: rights check and block lookup, about 1 µs
          { k: 'cache', name: 'Disk cache lookup', layer: 'copies of blocks kept in main memory', cls: 'sw', t: { hdd: 0.0003, ssd: 0.0003, hit: 0.0003 } },  // stage 3: look for the block in the disk cache, about 0.3 µs
          { k: 'drv', name: 'Driver and device queue', layer: 'physical organization, device I/O, scheduling', cls: 'sw', t: { hdd: 0.002, ssd: 0.002, hit: null } },  // stage 4: disk address, controller commands and the queue, about 2 µs; skipped on a cache hit
          { k: 'seek', name: 'Seek', layer: 'the arm moves the heads to the track', cls: 'seek', t: { hdd: DISK.seek, ssd: 0, hit: null } },  // stage 5: the seek, 4 ms on the hard disk; an SSD has none
          { k: 'rot', name: 'Rotational delay', layer: 'the sector spins round to the head', cls: 'rot', t: { hdd: ROT, ssd: 0, hit: null } },  // stage 6: the rotational delay, 4 ms on the hard disk; an SSD has none
          { k: 'xfer', name: 'Transfer by DMA', layer: 'the data flows into a kernel buffer', cls: 'xfer', t: { hdd: XFER, ssd: FLASH, hit: null } },  // stage 7: the transfer, 0.128 ms from the hard disk or about 0.1 ms from flash
          { k: 'intr', name: 'Interrupt and wake-up', layer: 'the controller signals “done”', cls: 'sw', t: { hdd: 0.004, ssd: 0.004, hit: null } },  // stage 8: the interrupt, its handler and waking the process, about 4 µs
          { k: 'copy', name: 'Copy and return', layer: 'kernel buffer into your array', cls: 'sw', t: { hdd: 0.0005, ssd: 0.0005, hit: 0.0005 } },  // stage 9: copy the block to the program and return, about 0.5 µs
        ];  // closes the STAGES list
        const CASES = [{ value: 'hdd', label: 'Hard disk' }, { value: 'ssd', label: 'SSD' }, { value: 'hit', label: 'Already in the disk cache' }];  // CASES: the three choices on the switch
        const MAP = [  // MAP: the chapter roadmap as [sections, name, short description, stages it covers]
          ['11.1–11.3', 'Devices and organization', 'kinds, DMA, layers', ['call', 'fs', 'drv', 'xfer', 'intr']],  // sections 11.1-11.3: devices, I/O techniques and the layers
          ['11.4', 'I/O buffering', 'where data waits', ['xfer', 'copy']],  // section 11.4: buffering, the kernel buffer the data lands in and is copied from
          ['11.5', 'Disk scheduling', 'order of the queue', ['drv', 'seek', 'rot', 'xfer']],  // section 11.5: the queue order and the disk's timing
          ['11.6', 'RAID', 'many disks as one', ['seek', 'rot', 'xfer']],  // section 11.6: arrays of disks share and protect the device work
          ['11.7', 'Disk cache', 'skip the device', ['cache']],  // section 11.7: the disk cache lookup
          ['11.8–11.10', 'UNIX, Linux, Windows', 'real systems', STAGES.map((st) => st.k)],  // sections 11.8-11.10: real systems, which build every stage
        ];  // closes the MAP list
        let dev = 'hdd', mark = null, at = 0;  // dev: the chosen case; mark: the roadmap entry whose stages are tagged (null for none); at: the index of the stage the request is at
        const frames = () => STAGES.map((st, i) => i).filter((i) => STAGES[i].t[dev] > 0);  // frames(): the indexes of the stages that take time in the chosen case, in order
        const total = (d) => STAGES.reduce((a, st) => a + (st.t[d] || 0), 0);  // total(d): the time of the whole read in case d, in ms
        const sumOf = (d, cls) => STAGES.reduce((a, st) => a + (st.cls === cls ? st.t[d] || 0 : 0), 0);  // sumOf(d, cls): the time of all stages of one color class in case d
        const before = (k) => STAGES.slice(0, STAGES.findIndex((st) => st.k === k)).reduce((a, st) => a + (st.t[dev] || 0), 0);  // before(k): the time of every stage above stage k in the chosen case
        const sig2 = (x) => Number(x.toPrecision(2));  // sig2(x): x rounded to two significant digits, for "about" figures
        const tTxt = (t) => (t >= 0.01 ? fmt(t, 3) + ' ms' : fmt(t * 1000, 1) + ' µs');  // tTxt(t): a time in ms written in ms, or in µs when below 0.01 ms
        const pct = (t) => fmt((t / total(dev)) * 100, 1) + '%';  // pct(t): t as a percentage of the whole read in the chosen case
        const many = (n) => (n >= 1e6 ? fmt(sig2(n) / 1e6, 1) + ' million' : fmt(sig2(n), 0));  // many(n): a large count written as "24 million" or "320,000"
        const human = (sec) => sec < 120 ? fmt(sec, 0) + ' seconds' : sec < 5400 ? fmt(sec / 60, 0) + ' minutes' : sec < 172800 ? fmt(sec / 3600, 1) + ' hours' : sec < 5184000 ? fmt(sec / 86400, 1) + ' days' : fmt(sec / 86400 / 30.44, 1) + ' months';  // human(sec): a number of seconds in everyday units, from seconds up to months
        const logW = (t) => ctx.util.clamp((Math.log10(t) + 4) / 5, 0, 1) * 100;  // logW(t): a bar width in % on a log scale from 0.0001 ms (0.1 µs) to 10 ms, five powers of ten
        const nameOf = (st) => (dev === 'ssd' && st.k === 'xfer' ? 'Flash read by DMA' : st.name);  // nameOf(st): the stage's name, with the SSD's flash read named for what it is
        const SAY = {  // SAY: the narration for each stage, written from the numbers above
          call: () => 'Your program calls <code>read(fd, buf, 4096)</code>: “copy the next 4,096 bytes of open file <i>fd</i> into my array <i>buf</i>.” The <span class="t">system call</span> switches the processor into the kernel.',  // stage 1 narration: what the call asks for
          fs: () => 'The file system checks that you may read this file and works out which disk block holds those bytes. (The file’s name was looked up once, when it was opened.)',  // stage 2 narration: rights and block lookup
          cache: () => 'The OS looks in the <span class="t">disk cache</span> first: copies of disk blocks kept in <span class="t">main memory</span>. ' + (dev === 'hit' ? '<b>Hit!</b> The block was read a moment ago, so the device is never touched.' : '<b>Miss.</b> The block is not there, so the request must go to the device.'),  // stage 3 narration: a hit or a miss
          drv: () => `The block number becomes a ${dev === 'hdd' ? 'track and sector' : 'flash address'}, the <span class="t">device driver</span> writes the controller’s commands and the request joins the device queue (empty here). Your process <b>blocks</b>, so another process can use the processor.`,  // stage 4 narration: driver, queue and blocking
          seek: () => `<b>Seek:</b> the arm swings the heads to the right track, ${tTxt(DISK.seek)} on average. That one movement takes about ${fmt(sig2(DISK.seek / before('seek')), 0)} times as long as all the software stages so far.`,  // stage 5 narration: the seek, compared with the software before it
          rot: () => `<b>Rotational delay:</b> the head is on the track, but the sector is somewhere on the ring. At ${fmt(DISK.rpm, 0)} rpm one turn takes ${fmt(REV, 3)} ms, so the average wait is half a turn: ${tTxt(ROT)}.`,  // stage 6 narration: half a turn on average
          xfer: () => (dev === 'hdd' ? `<b>Transfer:</b> ${SECTS} sectors pass under the head, ${SECTS}/${DISK.spt} of a turn: ${tTxt(XFER)}. The controller moves them into a kernel buffer by <span class="t">DMA</span>, with no help from the processor.` : `<b>No arm, no platter:</b> the <span class="t">SSD</span> reads its flash chips and moves the block into a kernel buffer by <span class="t">DMA</span> in about ${tTxt(FLASH)}. The whole read ends up roughly ${fmt(sig2(total('hdd') / total('ssd')), 0)} times faster than from the hard disk.`),  // stage 7 narration: transfer from the platter, or from flash
          intr: () => 'Back up the stack: the controller raises an <span class="t">interrupt</span>. Its handler marks the request done and moves your process from Blocked back to Ready.',  // stage 8 narration: the interrupt wakes the process
          copy: () => `The kernel copies the block into <i>buf</i> and read() returns. <b>Done in ${tTxt(total(dev))}.</b> ` + (dev === 'hdd' ? `${pct(sumOf('hdd', 'seek') + sumOf('hdd', 'rot'))} of it was the arm and the platter moving; all the software together took ${pct(sumOf('hdd', 'sw'))}.` : dev === 'ssd' ? `With no moving parts, the software’s share grows to ${pct(sumOf('ssd', 'sw'))}: on fast devices, the OS path itself is worth speeding up.` : `About ${fmt(sig2(total('hdd') / total('hit')), 0)} times faster than the hard-disk read.`),  // stage 9 narration: the total, and where the time went in this case
        };  // closes the SAY table
        const rows = h('div', { class: 'ch11-rows' });  // rows: the column of stage buttons
        const cap = h('div', { class: 'player-cap small ch11-cap', 'aria-live': 'polite' });  // cap: the narration box on the right; screen readers read it when it changes
        const lin = h('div', { class: 'ch11-lin', role: 'img' });  // lin: the linear "where the time goes" bar
        const linTxt = h('span', { class: 'xs muted' });  // linTxt: the "elapsed so far" text above the bar
        const leg = h('div', { class: 'ch11-leg' });  // leg: the legend under the bar
        const stats = h('div', { class: 'ch11-stats' });  // stats: the two number cards
        const map = h('div', { class: 'ch11-map' });  // map: the roadmap buttons
        function paintRows() {  // paintRows(): redraws the nine stage rows for the chosen case, the current stage and the tagged section
          const fr = frames(), pos = fr.indexOf(at), tagged = mark === null ? [] : MAP[mark][3];  // fr: the active stages; pos: the current stage's place among them; tagged: the stages of the chosen roadmap entry
          rows.replaceChildren(...STAGES.map((st, i) => {  // rebuilds one row per stage
            const t = st.t[dev], live = t > 0, j = fr.indexOf(i), tag = tagged.includes(st.k);  // t: its time in this case; live: whether it takes part; j: its place among the active stages; tag: whether the chosen section covers it
            return h('button', { class: 'ch11-row' + (i === at ? ' on' : '') + (live && j < pos ? ' past' : '') + (tag ? ' tag' : ''), type: 'button', disabled: !live || null, 'aria-current': i === at ? 'step' : null, onclick: () => { player.stop(); player.go(j); } },  // the row as a button: ringed when current, numbered in color once passed, edged when tagged, faded and disabled when skipped; a click moves the request to this stage
              h('span', { class: 'ch11-n' }, String(i + 1)),  // the round stage number
              h('span', { class: 'ch11-nm' }, h('b', {}, nameOf(st), tag ? h('span', { class: 'ch11-pill' }, '§' + MAP[mark][0]) : null), h('span', {}, st.layer)),  // the stage name (with a section tag when tagged) over its layer description
              h('span', { class: 'ch11-log' }, live ? h('i', { class: 'k-' + st.cls, style: { width: logW(t) + '%' } }) : null),  // the log-scale bar, empty when the stage does not take part
              h('span', { class: 'ch11-t' }, live ? (st.cls === 'sw' ? '≈ ' : '') + tTxt(t) : t === 0 ? 'none' : 'skipped'));  // the time ("≈" marks the rough software figures), "none" for parts an SSD lacks, "skipped" on a cache hit
          }));  // ends the rows
        }  // ends paintRows()
        const LEG = { sw: 'Software, all layers', seek: 'Seek', rot: 'Rotation', xfer: 'Transfer' };  // LEG: the legend label of each color class
        function paintBar() {  // paintBar(): redraws the linear bar, its legend, the elapsed time and the two number cards
          const fr = frames(), pos = fr.indexOf(at), T = total(dev);  // fr: the active stages; pos: the current stage's place; T: the whole read's time
          const done = fr.slice(0, pos + 1).reduce((a, i) => a + STAGES[i].t[dev], 0);  // done: the time used up to and including the current stage
          lin.replaceChildren(...fr.slice(0, pos + 1).map((i) => h('i', { class: 'k-' + STAGES[i].cls, style: { width: (STAGES[i].t[dev] / T) * 100 + '%' } })));  // one piece per stage reached, each exactly as wide as its share of the whole read
          lin.setAttribute('aria-label', `Elapsed ${tTxt(done)} of ${tTxt(T)}`);  // describes the bar for screen readers
          linTxt.textContent = `elapsed ${tTxt(done)} of ${tTxt(T)}`;  // the elapsed text above the bar
          const lab = (c) => (dev === 'ssd' && c === 'xfer' ? 'Flash read' : LEG[c]);  // lab(c): the legend label, naming the SSD's flash read for what it is
          leg.replaceChildren(...Object.keys(LEG).filter((c) => sumOf(dev, c) > 0).map((c) => h('span', {}, h('i', { class: 'ch11-dot k-' + c }), `${lab(c)} ${tTxt(sumOf(dev, c))} · ${pct(sumOf(dev, c))}`)));  // one legend item per color class present: its label, its total time and its share of the read
          const cyc = T / CYCLE;  // cyc: the whole read measured in processor cycles
          stats.replaceChildren(  // rebuilds the two number cards
            h('div', { class: 'card tight' }, h('div', { class: 'xs muted b' }, 'THE WHOLE READ'), h('div', { class: 'ch11-big' }, tTxt(T)), h('div', { class: 'xs' }, `time for about ${many(T / MEM)} memory reads of about 100 ns each`)),  // card 1: the whole read's time, and how many main-memory reads would fit in it
            h('div', { class: 'card tight' }, h('div', { class: 'xs muted b' }, '3 GHz PROCESSOR CYCLES'), h('div', { class: 'ch11-big' }, many(cyc)), h('div', { class: 'xs' }, `If one cycle took a second, this read would take about ${human(cyc)}.`)));  // card 2: the read in processor cycles, and the same ratio in everyday time
        }  // ends paintBar()
        function paintMap() {  // paintMap(): redraws the six roadmap buttons
          map.replaceChildren(...MAP.map(([sec, name, sub], i) => h('button', { class: 'ch11-mb' + (mark === i ? ' on' : ''), type: 'button', 'aria-pressed': String(mark === i), onclick: () => { mark = mark === i ? null : i; paintMap(); paintRows(); ctx.refit(); } }, h('b', {}, name), h('span', {}, `§${sec} · ${sub}`))));  // one button per entry, its name over "§11.5 · description"; a click tags its stages on the left, a second click clears the tags
        }  // ends paintMap()
        const player = ctx.ui.player({ count: frames().length, caption: false, interval: 2600, render(i) { at = frames()[i]; paintRows(); paintBar(); cap.innerHTML = SAY[STAGES[at].k](); ctx.refit(); return null; } });  // player: steps the request through the active stages, 2.6 s apart when playing; its own caption is hidden because the narration box sits on the right
        const caseSeg = ctx.ui.seg(CASES, dev, (v) => { dev = v; player.setCount(frames().length); });  // caseSeg: the switch for the three cases; a new case restarts the request from stage 1
        paintMap();  // draws the roadmap buttons
        el.append(h('div', { class: 'split r fill' },  // puts step 1 on screen: two columns, the larger one on the left
          h('div', { class: 'stack', style: { gap: '7px' } },  // left column, stacked 7px apart:
            h('p', { class: 'm0 small', html: 'A program asks for 4 KB of a file. Follow the request down through the layers to the device and back up. Click any stage, or press Play.' }),  // the opening sentence
            h('div', { class: 'row' }, h('span', { class: 'small b' }, 'Where is the block?'), caseSeg),  // the case switch with its label
            h('div', { class: 'ch11-head' }, h('span'), h('span', {}, 'STAGE'), h('span', {}, 'LOG SCALE ×10/TICK'), h('span', { style: { textAlign: 'right' } }, 'TIME')),  // the column titles over the stage rows
            rows, player.el),  // the stage rows, then the player controls; ends the left column
          h('div', { class: 'stack', style: { gap: '9px' } },  // right column, stacked 9px apart:
            cap,  // the narration box
            h('div', { class: 'stack', style: { gap: '4px' } }, h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'xs muted b' }, 'WHERE THE TIME GOES, TO SCALE'), linTxt), lin, leg),  // the bar block: its title and the elapsed time, the linear bar and its legend
            stats,  // the two number cards
            h('div', { class: 'stack', style: { gap: '4px' } }, h('span', { class: 'xs muted b' }, 'THE CHAPTER: CLICK A SECTION TO MARK ITS STAGES'), map))));  // the roadmap title and buttons; ends the layout
      },  // ends render() for step 1
    },  // closes step 1
    {  // step 2 of the chapter 11 overview
      title: 'Which tool fixes this I/O problem?',  // title shown at the top of step 2
      kind: 'explore',  // kind "explore" labels the step "Explore"
      render(el, ctx) {  // render(el, ctx): builds step 2 when it is shown
        const { h } = ctx;  // h is the helper that builds HTML elements
        const TOOLS = {  // TOOLS: the eight tools as key: [button name, short description, what it does, section]
          dma: ['DMA', 'module moves the data', 'hands a whole transfer to a DMA module, which interrupts the processor once at the end', '11.2'],  // tool: direct memory access
          dbl: ['Double buffering', 'two buffers take turns', 'lets the device fill one system buffer while the process empties the other', '11.4'],  // tool: double buffering
          sched: ['Disk scheduling', 'reorder the queue', 'chooses the order in which waiting disk requests are served, to shorten arm movement or to keep any request from waiting forever', '11.5'],  // tool: disk scheduling
          cache: ['Disk cache', 'keep blocks in memory', 'keeps copies of recently used disk blocks in main memory, so a repeat read never reaches the disk', '11.7'],  // tool: the disk cache
          r0: ['RAID 0', 'striping only', 'stripes data over several disks so they work in parallel, with no redundancy at all', '11.6'],  // tool: RAID level 0
          r1: ['RAID 1', 'mirroring', 'keeps an identical copy of every strip on a second disk', '11.6'],  // tool: RAID level 1
          r5: ['RAID 5', 'distributed parity', 'adds one parity strip to every stripe, rotated over the disks, so any one failed disk can be rebuilt', '11.6'],  // tool: RAID level 5
          spool: ['Spooling', 'queue jobs on disk', 'collects whole output jobs in a queue on disk and feeds them to a slow device one at a time', '11.1'],  // tool: spooling
        };  // closes the TOOLS table
        // the nine problems: a short name, the right tool, the story, what the trouble is (for wrong picks), why the right
        // tool works, and replies to the most tempting wrong picks
        const SC = [  // SC: the nine problems, in the order they are shown
          { short: 'The busy network card', tool: 'dma', text: 'A network card receives a 64 KB burst of data. Using <span class="t">programmed I/O</span>, the processor copies it into memory one word at a time, checking the card’s status between words, and can do nothing else until the last word lands.',  // problem 1: the processor moves every word itself
            need: 'The trouble here is that the processor itself is moving every word.', ok: 'The processor tells a <span class="t">DMA</span> module what to move, from where, to where and how much. The module copies the data over the bus by itself and raises one interrupt at the end, so the processor is free for other work in between.',  // problem 1: its trouble and why DMA fixes it
            near: { dbl: 'Buffers decide where the data waits, but someone still has to move each word, and here that someone is the processor.' } },  // problem 1: the reply to the tempting wrong pick, double buffering
          { short: 'The stuttering video', tool: 'dbl', text: 'A video player reads a film in chunks through a single system buffer. The OS cannot fetch the next chunk until the player has copied the current one out of that buffer, so the picture stalls at every chunk boundary.',  // problem 2: the device and the player share one buffer
            need: 'The trouble here is that the device and the player keep waiting for the same single buffer.', ok: 'With <span class="t">double buffering</span> the device fills one system buffer while the player empties the other, and then they swap. Reading and decoding now overlap, so the stalls vanish as long as the device keeps up on average.',  // problem 2: its trouble and why double buffering fixes it
            near: { cache: 'A disk cache pays off mostly when blocks are read again, and this film is read once from start to end. What is missing is a second buffer, so the device and the player can work at the same time.' } },  // problem 2: the reply to the tempting wrong pick, the disk cache
          { short: 'The swinging arm', tool: 'sched', text: 'Forty read requests wait for one hard disk, for tracks scattered from the inner edge to the outer edge. Served in arrival order, the arm swings back and forth across the whole platter, and most of the time goes into seeking.',  // problem 3: arrival order makes the arm travel far
            need: 'The trouble here is the order in which the requests are served.', ok: 'A <span class="t">disk scheduling</span> policy such as shortest-service-time-first or SCAN serves the waiting requests in an order that moves the arm in short hops or steady sweeps, cutting the total seek time.',  // problem 3: its trouble and why disk scheduling fixes it
            near: { cache: 'A cache helps only when the same blocks are read again. These forty requests are for different blocks, so each must reach the disk; what can change is their order.' } },  // problem 3: the reply to the tempting wrong pick, the disk cache
          { short: 'The forgotten request', tool: 'sched', text: 'A disk always serves the waiting request nearest the arm. One program keeps reading blocks right beside the arm’s position, so a request for a track at the far edge of the disk waits for whole seconds.',  // problem 4: nearest-first keeps passing a far request over
            need: 'The trouble here is a rule for picking the next request that keeps passing one request over.', ok: 'Still <span class="t">disk scheduling</span>, but a different policy: one that sweeps across the disk, such as SCAN or C-SCAN, reaches every track on each pass, so no request is passed over indefinitely.',  // problem 4: its trouble and why a sweeping policy fixes it
            near: {} },  // problem 4: no special replies; a wrong pick gets the general one
          { short: 'The repeated headers', tool: 'cache', text: 'Building a large program, the compiler reads the same twenty header files for each of hundreds of source files. Every time, those blocks come from the disk again, though they were read a moment earlier.',  // problem 5: the same blocks are read again and again
            need: 'The trouble here is that the same blocks travel from the disk again and again.', ok: 'A <span class="t">disk cache</span> keeps recently used blocks in main memory. After the first read, each repeat is a hit served at memory speed, and the disk is not touched at all.',  // problem 5: its trouble and why the disk cache fixes it
            near: { sched: 'Reordering would shorten the seeks, but every one of these reads would still go to the disk. The blocks were just read: keeping them in memory removes the trip altogether.' } },  // problem 5: the reply to the tempting wrong pick, disk scheduling
          { short: 'The video editor', tool: 'r0', text: 'A video editor must read raw footage faster than any single disk can deliver it. The footage is a scratch copy of files kept safely elsewhere, so if a disk failed, the only loss would be the time to copy them again.',  // problem 6: speed matters, failure does not
            need: 'The trouble here is speed: one disk is too slow, and surviving a failure does not matter.', ok: 'RAID 0 uses <span class="t">striping</span>: each file is spread across several disks, so they all deliver parts of it at once. It keeps no redundant information, so all the space holds data, which suits a scratch copy.',  // problem 6: its trouble and why RAID 0 fixes it
            near: { r5: 'RAID 5 also stripes, so it would read fast too, but it gives up a disk’s worth of space to parity and slows small writes, to guard against a failure this editor does not care about.', r1: 'A mirror can serve reads from either copy, but it buys a second disk for every disk to survive a failure this editor does not care about.' } },  // problem 6: replies to the tempting wrong picks, RAID 5 and RAID 1
          { short: 'The clinic database', tool: 'r1', text: 'A clinic keeps its appointment database on one disk and cannot work if that disk dies. It makes many small updates all day, wants recovery to be as simple as carrying on with an identical disk, and can afford exactly one more disk.',  // problem 7: two disks, many small writes, simple recovery
            need: 'The trouble here is surviving a failure with just two disks while making many small writes.', ok: 'RAID 1 uses <span class="t">mirroring</span>: every write goes to both disks. If one dies, the other already holds everything, and a small write costs no extra reads. The price is twice the disk space.',  // problem 7: its trouble and why RAID 1 fixes it
            near: { r5: 'RAID 5 also survives one failed disk, but it needs at least three disks, and every small write must also read and rewrite parity. With two disks and many small writes, the fit is a mirror.' } },  // problem 7: the reply to the tempting wrong pick, RAID 5
          { short: 'The photo archive', tool: 'r5', text: 'A photo archive fills five disks and must survive any one disk failing. A complete second copy would mean buying five more disks, which is too expensive; buying one more disk is fine.',  // problem 8: survive one failure with one extra disk
            need: 'The trouble here is surviving one failure while paying for only one extra disk.', ok: 'RAID 5 uses <span class="t">distributed parity</span>: each stripe gets one parity strip, and those strips rotate across all six disks. Any one failed disk can be rebuilt from the others, for the cost of a single extra disk.',  // problem 8: its trouble and why RAID 5 fixes it
            near: { r1: 'A mirror would survive a failure, but it doubles the space: five more disks, not one.', r0: 'RAID 0 keeps no redundant information: losing any one disk loses a piece of almost every large file.' } },  // problem 8: replies to the tempting wrong picks, RAID 1 and RAID 0
          { short: 'The shared printer', tool: 'spool', text: 'Six programs print at the same moment on one shared printer. Their pages must not come out mixed together, and none of the programs should have to wait for the printer before it can finish.',  // problem 9: many programs, one printer
            need: 'The trouble here is many programs sharing one slow device that can serve only one job at a time.', ok: 'A <span class="t">spooler</span> writes each program’s whole print job to a queue on disk, so every program finishes right away. The jobs are then fed to the printer one after another, never mixed.',  // problem 9: its trouble and why spooling fixes it
            near: { dbl: 'Buffers smooth out the speed of one transfer, but they do not stop six programs’ pages from mixing on a printer that can serve only one job at a time.' } },  // problem 9: the reply to the tempting wrong pick, double buffering
        ];  // closes the SC list
        const keys = Object.keys(TOOLS);  // keys: the eight tool keys, in button order
        const ans = SC.map(() => null);  // ans: the tool picked for each problem, null until picked
        let cur = 0;  // cur: the problem on screen, counting from 0
        const scCard = h('div', { class: 'card white ch11-sc', 'aria-live': 'polite' });  // scCard: the problem card; screen readers read it when it changes
        const fb = h('div', { class: 'callout m0 small ch11-fb', 'aria-live': 'polite' });  // fb: the feedback callout, read aloud when it changes
        const toolBtns = keys.map((k) => h('button', { class: 'ch11-tool', type: 'button', onclick: () => { ans[cur] = k; paint(); } }, h('b', {}, TOOLS[k][0]), h('span', {}, TOOLS[k][1])));  // toolBtns: the eight tool buttons; a click picks that tool for the problem on screen
        const list = h('div', { class: 'ch11-list' });  // list: the column of problem rows on the right
        const score = h('span', { class: 'big', style: { fontSize: '30px' } });  // score: the "n / 9" count at 30px
        const nextOpen = () => { for (let d = 1; d <= SC.length; d++) { const j = (cur + d) % SC.length; if (ans[j] !== SC[j].tool) return j; } return (cur + 1) % SC.length; };  // nextOpen(): the next problem not yet solved, going round; the next one in order if all are solved
        function paint() {  // paint(): redraws the problem, the tool buttons, the feedback, the list and the score after every click
          const sc = SC[cur], a = ans[cur], ok = a === sc.tool, T = a ? TOOLS[a] : null;  // sc: the problem on screen; a: the tool picked for it; ok: whether that is right; T: the picked tool's entry
          scCard.innerHTML = `<div class="xs muted b">PROBLEM ${cur + 1} OF ${SC.length}: ${sc.short.toUpperCase()}</div><p class="ch11-text m0">${sc.text}</p>`;  // the problem card: a small heading with its number and name, then the story
          toolBtns.forEach((b, i) => { const k = keys[i]; b.classList.toggle('ok', a === k && ok); b.classList.toggle('bad', a === k && !ok); b.setAttribute('aria-pressed', String(a === k)); });  // marks the picked tool green or red and tells screen readers which one is pressed
          fb.className = 'callout m0 small ch11-fb ' + (a === null ? '' : ok ? 'tip' : 'bad');  // the feedback box's color: plain before a pick, green if right, red if wrong
          fb.dataset.label = a === null ? 'Your move' : ok ? `Correct: ${T[0]} (§${T[3]})` : 'Not quite';  // the feedback label: "Your move", "Correct:" with the tool and its section, or "Not quite"
          fb.innerHTML = a === null ? 'Which tool fixes this problem? Pick one of the eight. One tool fixes two of the nine problems.' : ok ? sc.ok : (sc.near[a] || `<b>${T[0]}</b> ${T[2]}. ${sc.need}`) + ' Try another tool.';  // the feedback text: the instruction, why the right tool works, or a reply to the wrong pick
          list.replaceChildren(...SC.map((x, i) => {  // rebuilds the nine problem rows
            const st = ans[i] === null ? '' : ans[i] === x.tool ? 'ok' : 'bad';  // st: the row's state: unanswered, right or wrong
            return h('button', { class: 'ch11-li' + (i === cur ? ' on' : ''), type: 'button', 'aria-current': i === cur ? 'true' : null, onclick: () => { cur = i; paint(); } },  // the row as a button, ringed when on screen; a click shows that problem
              h('span', { class: 'ch11-n' }, String(i + 1)), h('span', { class: 'grow' }, x.short),  // the round number and the short name
              st ? h('span', { class: 'chip ' + st }, (st === 'ok' ? '✓ ' : '✗ ') + TOOLS[ans[i]][0]) : h('span', { class: 'xs muted' }, 'not answered'));  // the tag: the picked tool with a green check or a red cross, or "not answered"
          }));  // ends the problem rows
          score.textContent = `${SC.filter((x, i) => ans[i] === x.tool).length} / ${SC.length}`;  // the score: how many problems have the right tool, out of nine
          ctx.refit();  // re-checks that the step still fits
        }  // ends paint()
        el.append(h('div', { class: 'split r fill' },  // puts step 2 on screen: two columns, the larger one on the left
          h('div', { class: 'stack', style: { gap: '9px' } },  // left column, stacked 9px apart:
            scCard, h('div', { class: 'ch11-tools' }, ...toolBtns), fb,  // the problem card, the eight tool buttons and the feedback
            h('div', { class: 'row nw', style: { alignItems: 'flex-start' } }, h('button', { class: 'btn sm primary', type: 'button', onclick: () => { cur = nextOpen(); paint(); } }, 'Next problem ▶'),  // the "Next problem" button, which skips problems already solved,
              h('span', { class: 'xs muted', html: 'Each tool is taught in this chapter: spooling §11.1 · DMA §11.2 · buffering §11.4 · disk scheduling §11.5 · RAID §11.6 · disk cache §11.7.' }))),  // beside a small note naming the section that teaches each tool; ends the left column
          h('div', { class: 'stack', style: { gap: '8px' } },  // right column, stacked 8px apart:
            h('div', { class: 'row', style: { alignItems: 'baseline' } }, score, h('span', { class: 'small b' }, 'fixed'), h('span', { class: 'xs muted' }, 'click a row to revisit it'),  // a row with the big score, the word "fixed" and a hint
              h('button', { class: 'btn sm', type: 'button', style: { marginLeft: 'auto', alignSelf: 'center' }, onclick: () => { ans.fill(null); cur = 0; paint(); } }, 'Start over')),  // and a "Start over" button pushed to the right that clears every answer
            list,  // the nine problem rows
            h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: '<span class="t">RAID</span> is not a backup. A mirror copies an accidental delete or a corrupted file onto both disks at once: RAID survives a disk failing, not a bad write.' }))));  // amber "Common mistake" callout: RAID protects against a failed disk, not against bad writes; ends the layout
        paint();  // draws the first problem when the step opens
      },  // ends render() for step 2
    },  // closes step 2
  ],  // closes the chapter's steps list
  notes: `${/* notes: the chapter 11 summary shown in the Notes drawer on the overview steps and in the printed guide */''}
    <h3>How Chapter 11 fits together</h3>${/* notes heading: how chapter 11 fits together */''}
    <p>I/O is the slowest and most varied part of a computer. The overview follows one read() of a 4 KB block down the layers to the disk and back up by DMA and an interrupt. On the example disk (average seek 4 ms, 7,500 rpm, 500 sectors of 512 bytes per track) the device time is 4 + 4 + 0.128 = 8.128 ms, while all the software together takes about 0.1% of the read. An SSD needs about 0.1 ms, and a disk-cache hit finishes in about 2 µs, roughly 3,500 times faster than the hard disk.</p>${/* notes paragraph: the overview's read() journey and its computed times */''}
    <h4>Devices and organization (11.1 to 11.3)</h4>${/* notes heading: sections 11.1 to 11.3 */''}
    <p>Devices serve people, machines or other computers, and differ in data rate, application, complexity of control, unit of transfer, data representation and error conditions. The OS performs I/O by programmed I/O, interrupt-driven I/O or DMA, which moves a whole block and interrupts once at the end. It aims at efficiency and generality, and organizes I/O in layers; for a file: directory management, file system, physical organization, device I/O, and scheduling and control.</p>${/* notes paragraph: device differences, the three I/O techniques and the layers */''}
    <h4>Buffering (11.4)</h4>${/* notes heading: section 11.4 */''}
    <p>System buffers let input be read ahead and output be written behind. Single, double and circular buffering let the device and the process overlap and smooth out bursts, but no buffer makes a device faster than its average rate.</p>${/* notes paragraph: what buffering can and cannot do */''}
    <h4>Disk scheduling (11.5)</h4>${/* notes heading: section 11.5 */''}
    <p>A disk operation costs seek time plus rotational delay (together the access time) plus transfer time. Seeks dominate, so the order of waiting requests matters: FIFO is fair but slow, SSTF cuts seeks but can starve far requests, SCAN, C-SCAN, LOOK and C-LOOK sweep the disk, and N-step-SCAN and FSCAN stop one busy process from holding the arm.</p>${/* notes paragraph: disk timing and the scheduling policies */''}
    <h4>RAID (11.6)</h4>${/* notes heading: section 11.6 */''}
    <p>RAID makes several disks act as one logical drive. RAID 0 stripes with no redundancy, RAID 1 mirrors, RAID 2 and 3 access all disks in parallel, and RAID 4, 5 and 6 use independent access with parity: on one disk (4), rotated across all disks (5) or doubled (6). RAID survives failed disks, not bad writes, so it is no backup.</p>${/* notes paragraph: the RAID levels in one breath */''}
    <h4>Disk cache (11.7)</h4>${/* notes heading: section 11.7 */''}
    <p>A disk cache keeps recently used blocks in main memory so a repeat read never reaches the device. LRU, LFU and frequency-based replacement choose which block to drop.</p>${/* notes paragraph: the disk cache and its replacement policies */''}
    <h4>Real systems (11.8 to 11.10)</h4>${/* notes heading: sections 11.8 to 11.10 */''}
    <p>UNIX SVR4 treats each device as a special file and moves data through the buffer cache, character queues or unbuffered DMA. Linux moved from single-queue I/O schedulers (deadline, anticipatory, CFQ) to the multi-queue block layer (mq-deadline, BFQ, Kyber) and writes dirty page-cache pages back later. Windows sends every request through its I/O manager as an I/O request packet, writes cached data lazily, offers asynchronous I/O and completion ports, and adds software RAID, shadow copies and BitLocker.</p>${/* notes paragraph: UNIX SVR4, Linux and Windows */''}
    <h4>Why it matters next</h4>${/* notes heading: why it matters next */''}
    <p>Chapter 12 builds file systems on exactly these pieces: blocks on a disk, buffers, the cache, and the layers between a file name and a sector.</p>`,  // notes paragraph: chapter 12 builds on these pieces; end of the notes text
});  // ends chapter 11

Guide.chapter({  // registers chapter 12 with the guide
  num: 12,  // num: the chapter number; it sets the chapter's order, its color (--ch12) and page addresses such as #ch12
  title: 'File Management',  // title shown on the chapter card, the chapter overview page and the top-bar tooltip
  tagline: 'Files outlive the programs that make them. The file system decides how they are named, found, shared and stored.',  // tagline: the one-sentence hook printed in the chapter color at the top of the chapter overview page
  intro: '<p>A file is data that must survive after its program ends. This chapter covers what a file system must provide, how records are organized and found, how B-trees keep large indexes fast, how directories name files, how files are shared and protected, how records are packed into blocks, and how disk space is allocated and tracked, then shows the file systems of UNIX, Linux, Windows and Android.</p>',  // intro: the opening paragraph of the chapter overview page
  objectives: [  // objectives: the list shown under "After this chapter you will be able to" on the overview page and in the printed guide
    'Describe the basic concepts of files and the layered structure of a file system.',  // objective 1: files and file system layers
    'Compare the main file organizations and explain how a B-tree index works.',  // objective 2: file organizations and B-trees
    'Explain file directories, file sharing and record blocking.',  // objective 3: directories, sharing and blocking
    'Compare file allocation methods and free-space management techniques.',  // objective 4: allocation and free space
    'Describe the file systems of UNIX, Linux, Windows and Android.',  // objective 5: four real file systems
  ],  // closes the objectives list
  terms: [],  // terms: chapter-level glossary entries; the sections define this chapter's terms, and the overview steps reuse them
  css: ` /* css: style rules used only by chapter 12's overview steps; each rule starts with .sec-ch12, the canvas class on these steps */
    .sec-ch12 .ch12-rows { display: flex; flex-direction: column; gap: 4px; } /* .ch12-rows: the five layer rows stacked 4px apart */
    .sec-ch12 .ch12-row { display: grid; grid-template-columns: 24px minmax(0, 1fr) 150px; gap: 9px; align-items: center; min-height: 46px; padding: 3px 9px; border: 1px solid var(--line); border-radius: 9px; background: var(--panel-2); color: var(--ink); font: inherit; text-align: left; cursor: pointer; } /* .ch12-row: one layer as a button in three columns: number (24px), name over description, and its disk reads (150px) */
    .sec-ch12 .ch12-row:hover { border-color: var(--chc); } /* hovering a layer outlines it in the chapter color */
    .sec-ch12 .ch12-row.on { border-color: var(--chc); box-shadow: 0 0 0 1px var(--chc); background: color-mix(in srgb, var(--chc) 10%, var(--panel)); } /* .on: the layer the lookup is at now gets a chapter-colored ring and a faint chapter-colored fill */
    .sec-ch12 .ch12-row.tag { border-left: 5px solid var(--chc); padding-left: 5px; } /* .tag: a layer covered by the chapter group chosen on the right gets a thick chapter-colored left edge */
    .sec-ch12 .ch12-n { display: inline-grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; background: var(--panel-3); font-weight: 800; font-size: 12.5px; } /* .ch12-n: the round layer or problem number */
    .sec-ch12 .ch12-row.past .ch12-n, .sec-ch12 .ch12-row.on .ch12-n { background: var(--chc); color: var(--panel); } /* the numbers of layers already reached are filled in the chapter color */
    .sec-ch12 .ch12-nm, .sec-ch12 .ch12-rd { display: flex; flex-direction: column; line-height: 1.2; min-width: 0; } /* .ch12-nm (name over description) and .ch12-rd (read count over block numbers) stack two lines */
    .sec-ch12 .ch12-rd { align-items: flex-end; text-align: right; } /* the read column is right-aligned */
    .sec-ch12 .ch12-nm b { font-size: 14.5px; } /* the layer name is bold at 14.5px */
    .sec-ch12 .ch12-rd b { font-size: 14px; font-variant-numeric: tabular-nums; } /* the read count is bold at 14px with digits of equal width */
    .sec-ch12 .ch12-nm span, .sec-ch12 .ch12-rd span { font-size: 12.5px; color: var(--muted); } /* the second line of both columns is small and grey */
    .sec-ch12 .ch12-nm .ch12-pill { display: inline-block; margin-left: 6px; padding: 0 6px; border-radius: 999px; font-size: 12px; font-weight: 800; color: var(--chc); border: 1px solid var(--chc); } /* .ch12-pill: the small "§12.4–12.5" tag beside a layer name that the chosen group covers */
    .sec-ch12 .ch12-cap { min-height: 132px; } /* .ch12-cap: the narration box keeps a minimum height so the layout stays still between frames */
    .sec-ch12 .ch12-tot { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; padding: 6px 10px; } /* .ch12-tot: the card comparing the reads of the three allocation methods, its items in one wrapping row */
    .sec-ch12 .ch12-chip { padding: 1px 9px; border: 1px solid var(--line); border-radius: 999px; font-size: 13.5px; font-variant-numeric: tabular-nums; } /* .ch12-chip: one method and its read count in a small rounded tag */
    .sec-ch12 .ch12-chip.on { border-color: var(--chc); color: var(--chc); font-weight: 800; background: color-mix(in srgb, var(--chc) 10%, var(--panel)); } /* .on: the method chosen on the switch, in the chapter color */
    .sec-ch12 svg .ch12-free { fill: none; stroke: var(--line-2); stroke-dasharray: 4 3; } /* .ch12-free: a free block, drawn as an empty dashed outline */
    .sec-ch12 svg .ch12-mine { fill: color-mix(in srgb, var(--chc) 22%, var(--panel)); stroke: var(--chc); } /* .ch12-mine: a block of members.dat (data or index), tinted in the chapter color */
    .sec-ch12 svg .ch12-done { stroke: var(--chc); stroke-width: 2.5; } /* .ch12-done: a block already read during this lookup gets a chapter-colored outline */
    .sec-ch12 svg .ch12-cur { stroke: var(--chc); stroke-width: 4.5; } /* .ch12-cur: the block being read right now gets a thick chapter-colored outline */
    .sec-ch12 svg .ch12-badge { fill: var(--chc); stroke: none; } /* .ch12-badge: the round read-order badge, filled in the chapter color */
    .sec-ch12 .ch12-leg { display: flex; flex-wrap: wrap; gap: 3px 12px; font-size: 13px; } /* .ch12-leg: the legend under the volume map, wrapping onto a second line if needed */
    .sec-ch12 .ch12-leg span { display: inline-flex; align-items: center; gap: 5px; } /* one legend item: a color square and its text side by side */
    .sec-ch12 .ch12-sw { display: inline-block; width: 13px; height: 13px; border-radius: 3px; border: 1.5px solid var(--line-2); } /* .ch12-sw: the small square in a legend item */
    .sec-ch12 .ch12-sw.os { background: var(--os-bg); border-color: var(--os); } /* volume information and headers: violet, the OS color */
    .sec-ch12 .ch12-sw.proc { background: var(--proc-bg); border-color: var(--proc); } /* directory entries: teal */
    .sec-ch12 .ch12-sw.mine { background: color-mix(in srgb, var(--chc) 22%, var(--panel)); border-color: var(--chc); } /* members.dat: the chapter color */
    .sec-ch12 .ch12-sw.other { background: var(--panel-2); } /* other files: neutral grey */
    .sec-ch12 .ch12-sw.free { background: none; border-style: dashed; } /* free blocks: an empty dashed square */
    .sec-ch12 .ch12-map { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; } /* .ch12-map: the four chapter-group buttons in two columns */
    .sec-ch12 .ch12-mb { display: flex; flex-direction: column; align-items: flex-start; text-align: left; padding: 4px 9px; border: 1px solid var(--line); border-radius: 9px; background: var(--panel-2); color: var(--ink); font: inherit; line-height: 1.2; cursor: pointer; } /* .ch12-mb: one chapter-group button: its name over its sections and a short description */
    .sec-ch12 .ch12-mb:hover { border-color: var(--chc); } /* hovering a group button outlines it in the chapter color */
    .sec-ch12 .ch12-mb.on { border-color: var(--chc); box-shadow: 0 0 0 1px var(--chc); background: color-mix(in srgb, var(--chc) 10%, var(--panel)); } /* .on: the chosen group gets a chapter-colored ring and fill */
    .sec-ch12 .ch12-mb b { font-size: 14px; } /* the group name is bold at 14px */
    .sec-ch12 .ch12-mb span { font-size: 12.5px; color: var(--muted); } /* the sections and description under it are small and grey */
    .sec-ch12 .ch12-sc { min-height: 132px; border-left: 5px solid var(--chc); } /* .ch12-sc: step 2's problem card, with a minimum height and a thick chapter-colored left edge */
    .sec-ch12 .ch12-text { font-size: 17px; line-height: 1.45; margin-top: 4px !important; } /* .ch12-text: the problem's story at reading size */
    .sec-ch12 .ch12-grp { display: flex; flex-direction: column; gap: 3px; } /* .ch12-grp: one group of choices: its small heading over its buttons */
    .sec-ch12 .ch12-tools { display: grid; gap: 6px; } /* .ch12-tools: a row of choice buttons */
    .sec-ch12 .ch12-tools.c5 { grid-template-columns: repeat(5, minmax(0, 1fr)); } /* the five ways to organize records sit in five columns */
    .sec-ch12 .ch12-tools.c3 { grid-template-columns: repeat(3, minmax(0, 1fr)); } /* the three allocation methods sit in three columns */
    .sec-ch12 .ch12-tool { display: flex; flex-direction: column; align-items: flex-start; justify-content: center; text-align: left; padding: 6px 9px; border: 1px solid var(--line); border-radius: 10px; background: var(--panel-2); color: var(--ink); font: inherit; line-height: 1.2; cursor: pointer; } /* .ch12-tool: one choice button: its bold name over a short description, left-aligned in a light rounded box */
    .sec-ch12 .ch12-tool:hover { border-color: var(--chc); } /* hovering a choice outlines it in the chapter color */
    .sec-ch12 .ch12-tool b { font-size: 14.5px; } /* the choice's name is bold at 14.5px */
    .sec-ch12 .ch12-tool span { font-size: 12.5px; color: var(--muted); } /* the description under it is small and grey */
    .sec-ch12 .ch12-tool.ok { border-color: var(--ok); background: var(--ok-bg); } /* a right pick turns the button green */
    .sec-ch12 .ch12-tool.bad { border-color: var(--bad); background: var(--bad-bg); } /* a wrong pick turns it red */
    .sec-ch12 .ch12-fb { min-height: 112px; } /* .ch12-fb: the feedback box keeps a minimum height so the layout stays still between answers */
    .sec-ch12 .ch12-list { display: flex; flex-direction: column; gap: 4px; } /* .ch12-list: the nine problem rows on the right, 4px apart */
    .sec-ch12 .ch12-li { display: flex; align-items: center; gap: 9px; text-align: left; padding: 5px 10px; border: 1px solid var(--line); border-radius: 9px; background: var(--panel-2); color: var(--ink); font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; } /* .ch12-li: one problem row: its number, its short name and its answer tag, in a light rounded box */
    .sec-ch12 .ch12-li:hover { border-color: var(--chc); } /* hovering a problem row outlines it in the chapter color */
    .sec-ch12 .ch12-li.on { border-color: var(--chc); box-shadow: 0 0 0 1px var(--chc); background: color-mix(in srgb, var(--chc) 9%, var(--panel)); } /* .on: the problem on screen gets a chapter-colored ring and fill */
    .sec-ch12 .ch12-li .ch12-n { flex: none; } /* the round number in a problem row never shrinks */
    @media (max-width: 760px) { /* @media (max-width: 760px): these rules apply only on windows 760px wide or less */
      .sec-ch12 .ch12-row { grid-template-columns: 22px minmax(0, 1fr) 112px; gap: 6px; } /* on a small screen the read column of a layer row shrinks to 112px */
      .sec-ch12 .ch12-tools.c5, .sec-ch12 .ch12-tools.c3 { grid-template-columns: repeat(2, minmax(0, 1fr)); } /* and the choice buttons sit in two columns */
    } /* ends the small-window rules */
  `,  // end of chapter 12's CSS text
  steps: [  // steps: the chapter's own overview steps, shown right after the chapter page and before section 12.1
    {  // step 1 of the chapter 12 overview
      title: 'Where does a file really live?',  // title shown at the top of step 1
      kind: 'story',  // kind "story" labels the step "Big Picture" and keeps it on the shorter core path
      render(el, ctx) {  // render(el, ctx): builds the step when it is shown; el is the empty step area, ctx holds the shell's helpers
        const { h, s } = ctx;  // h builds HTML elements, s builds SVG drawing elements
        const fmt = ctx.util.fmt;  // fmt(v, d): rounds v to at most d decimal places and adds thousands commas
        const VOL = { blocks: 40, cols: 8, size: 4096, hdrStart: 1, hdrPer: 8, hdrBlocks: 5 };  // VOL: a toy volume of 40 blocks of 4,096 bytes, drawn 8 to a row; block 0 holds the volume information and blocks 1-5 the header table, 8 headers of 512 bytes per block
        const FILE = { path: '/home/maya/members.dat', rec: 100, nrec: 103, want: 85, owner: 'maya' };  // FILE: the file looked up: 103 fixed-length records of 100 bytes, owned by maya; the program wants the 85th record
        const BF = Math.floor(VOL.size / FILE.rec);  // BF: the blocking factor, ⌊4,096 ÷ 100⌋ = 40 records per block
        const NB = Math.ceil(FILE.nrec / BF);  // NB: the blocks the file needs, ⌈103 ÷ 40⌉ = 3
        const FB = Math.ceil(FILE.want / BF);  // FB: the file block (counting from 1) that holds the wanted record, ⌈85 ÷ 40⌉ = 3
        const OFF = ((FILE.want - 1) % BF) * FILE.rec;  // OFF: where that record starts inside its block: it is the 5th record there, so it starts at byte (5 − 1) × 100 = 400
        const hdrBlock = (n) => VOL.hdrStart + Math.floor(n / VOL.hdrPer);  // hdrBlock(n): the block that holds header number n, 1 + ⌊n ÷ 8⌋
        const DIRS = [['/', 2, 9], ['home', 13, 14], ['maya', 22, 20]];  // DIRS: the directories on the path as [name, header number, block of its entries]; the root's header number (2) is fixed and known in advance
        const LOOK = ['home', 'maya', 'members.dat'];  // LOOK: the name searched for in each of those directories, in order
        const FHDR = 37;  // FHDR: the header number of members.dat itself
        const PLACE = {  // PLACE: where the file's blocks sit under each allocation method: its data blocks in file order, and its index block if it has one
          contig: { data: [29, 30, 31], index: null },  // contiguous: one run of three blocks starting at block 29
          chain: { data: [26, 17, 34], index: null },  // chained: three blocks anywhere, each ending with the number of the next
          index: { data: [26, 17, 34], index: 11 },  // indexed: the same scattered blocks, listed in file order in index block 11
        };  // closes the PLACE table
        const OTHER = new Set([6, 7, 8, 10, 12, 13, 15, 16, 19, 22, 23, 24, 27, 28, 33, 36, 37]);  // OTHER: blocks that belong to other files (none of them is used by the walk above)
        const MODES = [{ value: 'contig', label: 'Contiguous' }, { value: 'chain', label: 'Chained' }, { value: 'index', label: 'Indexed' }];  // MODES: the three choices on the allocation switch
        function walk(m) {  // walk(m): the whole lookup under allocation method m, as a list of frames { layer, block (null when nothing is read), say(n) }, where n is the read's number
          const P = PLACE[m], tgt = P.data[FB - 1], out = [];  // P: where the file's blocks are; tgt: the disk block that holds file block 3; out: the frames being built
          out.push({ layer: 'req', block: null, say: () => `Your program asks for the <b>${FILE.want}th record</b> of <code>${FILE.path}</code>. The <span class="t">access method</span> knows the file holds ${FILE.rec}-byte records, ${BF} to a ${fmt(VOL.size, 0)}-byte <span class="t">block</span> (the <span class="t">blocking factor</span>), so record ${FILE.want} is in <b>file block ${FB}</b>, from byte ${OFF}. But where on the disk is that block?` });  // frame 1: the request, worked out in memory before any read
          DIRS.forEach(([name, hn, eb], i) => {  // two reads for each directory on the path: its header, then its entries
            const who = name === '/' ? 'the root directory' : 'directory <b>' + name + '</b>';  // who: how the narration names this directory
            const next = i + 1 < DIRS.length ? DIRS[i + 1][1] : FHDR;  // next: the header number its entries give for the name searched for
            out.push({ layer: 'dir', block: hdrBlock(hn), say: (n) => i === 0 ? `Read ${n}: a <span class="t">pathname</span> walk starts at the <span class="t">root directory</span>, whose <span class="t">file header</span> is number ${hn}. Headers sit ${VOL.hdrPer} to a block from block ${VOL.hdrStart}, so it is in block ${hdrBlock(hn)}. It says the root’s entries are in block ${eb}.` : `Read ${n}: header ${hn} is in block ${VOL.hdrStart} + ⌊${hn} ÷ ${VOL.hdrPer}⌋ = ${hdrBlock(hn)}. It describes ${who}, whose entries are in block ${eb}.` });  // the header read: where the directory's entries are
            out.push({ layer: 'dir', block: eb, say: (n) => `Read ${n}: block ${eb} holds ${who}’s entries, a list of (name, header number) pairs. Searching it for <b>${LOOK[i]}</b> finds header <b>${next}</b>.` + (i === DIRS.length - 1 ? ' The name has done its job: from here on the file is known by its number.' : '') });  // the entries read: the name found, and the header it points to
          });  // ends the directory frames
          out.push({ layer: 'hdr', block: hdrBlock(FHDR), say: (n) => `Read ${n}: header ${FHDR}, in block ${hdrBlock(FHDR)}, holds the file’s <span class="t">metadata</span>: owner ${FILE.owner}, ${fmt(FILE.rec * FILE.nrec, 0)} bytes in ${NB} blocks, dates, where the blocks are, and the <span class="t">access rights</span> (${FILE.owner} may read and write, the group may only read), checked before any data moves.` });  // the file's own header
          if (m === 'contig') out.push({ layer: 'alloc', block: null, say: () => `<span class="t">Contiguous allocation</span>: the header says “start ${P.data[0]}, length ${NB}”. The blocks sit side by side, so file block ${FB} is block ${P.data[0]} + ${FB - 1} = <b>${tgt}</b>. Plain arithmetic, with no read at all.` });  // contiguous: the block number is computed, not read
          if (m === 'chain') for (let k = 0; k < FB - 1; k++) out.push({ layer: 'alloc', block: P.data[k], say: (n) => `Read ${n}: ` + (k === 0 ? `<span class="t">chained allocation</span>. The header knows only the first block, ${P.data[0]}, and each block ends with the number of the next. Reading block ${P.data[0]} shows that file block 2 is block ${P.data[1]}.` : `block ${P.data[k]} shows that file block ${k + 2} is block ${P.data[k + 1]}.`) + (k === FB - 2 ? ' Reaching file block <i>k</i> costs <i>k</i> − 1 extra reads: harmless here, painful for block 5,000 of a big file.' : '') });  // chained: one read per block before the wanted one, just to learn the next pointer
          if (m === 'index') out.push({ layer: 'alloc', block: P.index, say: (n) => `Read ${n}: <span class="t">indexed allocation</span>. The header points to <span class="t">index block</span> ${P.index}, which lists the file’s blocks in order: ${P.data.join(', ')}. Entry ${FB} says <b>${tgt}</b>. One read of the index reaches any block, near or far.` });  // indexed: one read of the index block
          out.push({ layer: 'disk', block: tgt, say: (n) => `Read ${n}: block ${tgt} arrives, and record ${FILE.want} is bytes ${OFF}–${OFF + FILE.rec - 1} of it. <b>${n} reads to fetch ${FILE.rec} bytes</b>, and only this last one carried them. Real systems keep recent directory entries and headers in memory, so the next lookup skips most of these reads.` });  // the data block itself, and the total
          return out;  // hands back the frames
        }  // ends walk()
        const readsIn = (m) => walk(m).filter((f) => f.block !== null).length;  // readsIn(m): the disk reads of the whole lookup under method m
        const LAYERS = [  // LAYERS: the five layers of the lookup as { k, name, sub(P) }; sub gives the short description under the name
          { k: 'req', name: 'The request', sub: () => `record ${FILE.want} → file block ${FB} (${BF} records of ${FILE.rec} bytes per block)` },  // layer 1: the record becomes a file block
          { k: 'dir', name: 'Directories', sub: () => '/ → home → maya: a header and a list of entries for each' },  // layer 2: the directory walk
          { k: 'hdr', name: 'File header (metadata)', sub: () => 'owner, size, rights, dates, and where the blocks are' },  // layer 3: the file's header
          { k: 'alloc', name: 'Allocation structure', sub: (P) => mode === 'contig' ? `start ${P.data[0]}, length ${NB}: compute block ${P.data[FB - 1]}` : mode === 'chain' ? `first block ${P.data[0]}, then follow the chain` : `index block ${P.index} lists blocks ${P.data.join(', ')}` },  // layer 4: how the file block becomes a disk block, by method
          { k: 'disk', name: 'Blocks on disk', sub: (P) => `block ${P.data[FB - 1]}: record ${FILE.want} is bytes ${OFF}–${OFF + FILE.rec - 1} of it` },  // layer 5: the data block
        ];  // closes the LAYERS list
        const ALL = LAYERS.map((L) => L.k);  // ALL: every layer key, for the group that covers them all
        const MAP = [  // MAP: the chapter roadmap as [sections, name, short description, layers it covers]
          ['12.1–12.3', 'Files and organization', 'records, layers, B-trees', ['req', 'disk']],  // sections 12.1-12.3: records and the access method on top, physical I/O at the bottom
          ['12.4–12.5', 'Directories and sharing', 'names, headers, rights', ['dir', 'hdr']],  // sections 12.4-12.5: directories, headers and access rights
          ['12.6–12.7', 'Blocking and storage', 'blocking, allocation', ['req', 'alloc', 'disk']],  // sections 12.6-12.7: records packed into blocks, and where the blocks go
          ['12.8–12.11', 'Real file systems', 'UNIX to Android', ALL],  // sections 12.8-12.11: UNIX, Linux, Windows and Android, which build every layer
        ];  // closes the MAP list
        let mode = 'contig', mark = null, at = 0;  // mode: the chosen allocation method; mark: the roadmap group whose layers are tagged (null for none); at: the frame on screen
        const CW = 55, CH = 38, GAP = 4;  // CW, CH: the size of one block's cell in the volume map; GAP: the space between cells
        const ROWS = Math.ceil(VOL.blocks / VOL.cols), W = VOL.cols * CW + (VOL.cols - 1) * GAP, H = ROWS * CH + (ROWS - 1) * GAP;  // ROWS: 5 rows of 8; W, H: the drawing's size, 8 × 55 + 7 × 4 = 468 by 5 × 38 + 4 × 4 = 206
        const rows = h('div', { class: 'ch12-rows' });  // rows: the column of layer buttons
        const cap = h('div', { class: 'player-cap small ch12-cap', 'aria-live': 'polite' });  // cap: the narration box on the right; screen readers read it when it changes
        const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img' });  // svg: the volume map, scaled to the column's width
        const readTxt = h('span', { class: 'xs muted' });  // readTxt: the "disk reads so far" count above the map
        const tot = h('div', { class: 'card tight ch12-tot' });  // tot: the card comparing the reads of the three methods
        const map = h('div', { class: 'ch12-map' });  // map: the chapter-group buttons
        const leg = h('div', { class: 'ch12-leg' }, ...[['os', 'volume info; header table, 8 headers a block'], ['proc', 'directory entries'], ['mine', 'members.dat'], ['other', 'other files'], ['free', 'free']].map(([c, t]) => h('span', {}, h('i', { class: 'ch12-sw ' + c }), t)));  // leg: the legend under the map, one color square and label per kind of block
        function kindOf(b) {  // kindOf(b): what block b holds under the chosen method, as [shape class, label]
          const P = PLACE[mode], d = DIRS.find((x) => x[2] === b), j = P.data.indexOf(b);  // P: the file's blocks; d: the directory whose entries are in b, if any; j: b's place among the file's data blocks (-1 if none)
          if (b === 0) return ['s-os', 'vol'];  // block 0: the volume information
          if (b >= VOL.hdrStart && b < VOL.hdrStart + VOL.hdrBlocks) { const f = (b - VOL.hdrStart) * VOL.hdrPer; return ['s-os', `${f}–${f + VOL.hdrPer - 1}`]; }  // blocks 1-5: the header table, labelled with the header numbers they hold (0–7, 8–15...)
          if (d) return ['s-proc', d[0]];  // a directory's list of entries, labelled with its name
          if (P.index === b) return ['ch12-mine', 'index'];  // the file's index block (indexed allocation only)
          if (j >= 0) return ['ch12-mine', 'data ' + (j + 1)];  // one of the file's data blocks, labelled with its place in the file
          return OTHER.has(b) ? ['s-panel', ''] : ['ch12-free', ''];  // a block of another file, or a free block
        }  // ends kindOf()
        function readsSoFar() { return walk(mode).slice(0, at + 1).filter((f) => f.block !== null).map((f) => f.block); }  // readsSoFar(): the blocks read up to and including the frame on screen, in order
        function paintRows() {  // paintRows(): redraws the five layer rows for the chosen method, the current frame and the tagged group
          const fr = walk(mode), P = PLACE[mode], cur = LAYERS.findIndex((L) => L.k === fr[at].layer), tagged = mark === null ? [] : MAP[mark][3];  // fr: the frames; P: the file's blocks; cur: the index of the layer on screen; tagged: the layers of the chosen group
          rows.replaceChildren(...LAYERS.map((L, i) => {  // rebuilds one row per layer
            const blocks = fr.filter((f) => f.layer === L.k && f.block !== null).map((f) => f.block), first = fr.findIndex((f) => f.layer === L.k), tag = tagged.includes(L.k);  // blocks: the blocks this layer reads; first: its first frame; tag: whether the chosen group covers it
            return h('button', { class: 'ch12-row' + (i === cur ? ' on' : '') + (i < cur ? ' past' : '') + (tag ? ' tag' : ''), type: 'button', 'aria-current': i === cur ? 'step' : null, onclick: () => { player.stop(); player.go(first); } },  // the row as a button: ringed when current, numbered in color once passed, edged when tagged; a click jumps to the layer's first frame
              h('span', { class: 'ch12-n' }, String(i + 1)),  // the round layer number
              h('span', { class: 'ch12-nm' }, h('b', {}, L.name, tag ? h('span', { class: 'ch12-pill' }, '§' + MAP[mark][0]) : null), h('span', {}, L.sub(P))),  // the layer name (with a section tag when tagged) over its description
              h('span', { class: 'ch12-rd' }, h('b', {}, blocks.length + (blocks.length === 1 ? ' disk read' : ' disk reads')), h('span', {}, blocks.length ? (blocks.length === 1 ? 'block ' : 'blocks ') + blocks.join(', ') : 'just arithmetic')));  // its disk reads: how many and which blocks, or "just arithmetic" when it reads nothing
          }));  // ends the rows
        }  // ends paintRows()
        function paintVol() {  // paintVol(): redraws the volume map, marking every block read so far with its read number
          const read = readsSoFar(), now = walk(mode)[at].block;  // read: the blocks read so far, in order; now: the block read in this frame (null if none)
          svg.replaceChildren(...ctx.util.range(VOL.blocks).map((b) => {  // one cell per block
            const x = (b % VOL.cols) * (CW + GAP), y = Math.floor(b / VOL.cols) * (CH + GAP), [cls, lab] = kindOf(b), r = read.indexOf(b);  // x, y: the cell's top-left corner; cls, lab: its color class and label; r: its place in the read order (-1 if not read)
            return s('g', {},  // the cell's group:
              s('rect', { x: x + 2.5, y: y + 2.5, width: CW - 5, height: CH - 5, rx: 6, class: cls + (b === now ? ' ch12-cur' : r >= 0 ? ' ch12-done' : '') }),  // the block, outlined thickly when read now and in the chapter color once read
              s('text', { x: x + 7, y: y + 17, class: 's-sub', 'font-size': 13 }, String(b)),  // its block number, small and grey at the top left
              lab ? s('text', { x: x + 7, y: y + 32, 'font-size': 13, 'font-weight': cls === 's-os' && b > 0 ? 400 : 700 }, lab) : null,  // its label below the number, if it has one: bold, except the longer header-range labels, which stay regular so they fit the cell
              r >= 0 ? s('circle', { cx: x + CW - 13.5, cy: y + 12, r: 9, class: 'ch12-badge' }) : null,  // a round badge at the top right once the block has been read
              r >= 0 ? s('text', { x: x + CW - 13.5, y: y + 16.5, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, style: 'fill:var(--panel)' }, String(r + 1)) : null);  // the read's number inside the badge
          }));  // ends the cells
          svg.setAttribute('aria-label', read.length ? `Blocks read so far, in order: ${read.join(', ')}` : 'No block read yet');  // describes the map for screen readers
          readTxt.innerHTML = `disk reads so far: <b>${read.length}</b> of ${readsIn(mode)}`;  // the count above the map
        }  // ends paintVol()
        function paintTot() { tot.replaceChildren(h('span', { class: 'xs muted b' }, 'DISK READS FOR THIS ONE RECORD'), ...MODES.map((o) => h('span', { class: 'ch12-chip' + (o.value === mode ? ' on' : '') }, `${o.label}: ${readsIn(o.value)}`))); }  // paintTot(): the comparison card: each method with the reads its whole lookup takes, the chosen one highlighted
        function paintMap() {  // paintMap(): redraws the four chapter-group buttons
          map.replaceChildren(...MAP.map(([sec, name, sub], i) => h('button', { class: 'ch12-mb' + (mark === i ? ' on' : ''), type: 'button', 'aria-pressed': String(mark === i), onclick: () => { mark = mark === i ? null : i; paintMap(); paintRows(); ctx.refit(); } }, h('b', {}, name), h('span', {}, `§${sec} · ${sub}`))));  // one button per group, its name over "§12.4–12.5 · description"; a click tags its layers on the left, a second click clears the tags
        }  // ends paintMap()
        const player = ctx.ui.player({ count: walk(mode).length, caption: false, interval: 2600, render(i) {  // player: steps through the lookup's frames, 2.6 s apart when playing; its own caption is hidden because the narration box sits on the right
          at = i; const fr = walk(mode), n = fr.slice(0, i + 1).filter((f) => f.block !== null).length;  // at: the frame on screen; fr: the frames; n: the reads so far, which is the number of this frame's read
          cap.innerHTML = fr[i].say(n); paintRows(); paintVol(); paintTot(); ctx.refit(); return null;  // writes the narration, redraws everything from the current state and re-checks the fit
        } });  // ends the player
        const modeSeg = ctx.ui.seg(MODES, mode, (v) => {  // modeSeg: the allocation switch; a new method keeps the lookup at the same layer
          const old = walk(mode), lay = old[at].layer, end = at === old.length - 1;  // lay: the layer on screen; end: whether the lookup had finished
          mode = v; const fr = walk(mode);  // switches the method and rebuilds its frames
          player.setCount(fr.length, true); player.go(end ? fr.length - 1 : fr.findIndex((f) => f.layer === lay));  // shows the same layer under the new method, or its last frame if the lookup had finished
        });  // ends the switch
        paintMap();  // draws the chapter-group buttons
        const intro = h('p', { class: 'm0 small', html: `A program wants one record of <code>${FILE.path}</code>. Follow the lookup from the name down to the block on the disk. Click a layer, or press Play.` });  // intro: the opening sentence
        const segRow = h('div', { class: 'row' }, h('span', { class: 'small b' }, 'How are the file’s blocks placed?'), modeSeg);  // segRow: the allocation switch with its label
        const why = h('div', { class: 'callout why m0 small', 'data-label': 'Why it matters', html: 'Name, header and data sit in three separate places. That is how one file can have two names, and why a crash between two writes can leave them disagreeing.' });  // why: the "Why it matters" callout: the three pieces are stored apart, with two consequences the chapter returns to
        const volBlock = h('div', { class: 'stack', style: { gap: '4px' } }, h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'xs muted b' }, `THE VOLUME: ${VOL.blocks} BLOCKS OF ${VOL.size / 1024} KB`), readTxt), svg, leg);  // volBlock: the map's title and read count, the map and its legend
        const roadBlock = h('div', { class: 'stack', style: { gap: '4px' } }, h('span', { class: 'xs muted b' }, 'THE CHAPTER: CLICK A GROUP TO MARK ITS LAYERS'), map);  // roadBlock: the roadmap title and buttons
        const left = ctx.narrow ? [intro, segRow, rows, player.el, cap, volBlock] : [intro, segRow, rows, player.el, tot, why];  // left: what the first column holds; on a phone the columns stack, so the narration and the map follow the player directly
        const right = ctx.narrow ? [tot, why, roadBlock] : [cap, volBlock, roadBlock];  // right: what the second column holds (below the first one on a phone)
        el.append(h('div', { class: 'split r fill' },  // puts step 1 on screen: two columns, the larger one on the left
          h('div', { class: 'stack', style: { gap: '8px' } }, ...left),  // left column, stacked 8px apart
          h('div', { class: 'stack', style: { gap: '9px' } }, ...right)));  // right column, stacked 9px apart; ends the layout
      },  // ends render() for step 1
    },  // closes step 1
    {  // step 2 of the chapter 12 overview
      title: 'Which organization or allocation fits?',  // title shown at the top of step 2
      kind: 'explore',  // kind "explore" labels the step "Explore"
      render(el, ctx) {  // render(el, ctx): builds step 2 when it is shown
        const { h } = ctx;  // h is the helper that builds HTML elements
        const TOOLS = {  // TOOLS: the eight choices as key: [button name, short description, what it does, section, full name]
          pile: ['Pile', 'arrival order', 'A pile stores records in arrival order and finds one only by searching them all', '12.2', 'A pile'],  // choice: the pile
          seq: ['Sequential file', 'sorted by one key', 'A sequential file keeps fixed-format records sorted by one key, ideal for reading them all in that order', '12.2', 'A sequential file'],  // choice: the sequential file
          iseq: ['Indexed sequential', 'key order + index', 'An indexed sequential file keeps key order and adds an index and an overflow file', '12.2', 'An indexed sequential file'],  // choice: the indexed sequential file
          idx: ['Indexed file', 'an index per field', 'An indexed file reaches records only through indexes, one for each field people search by', '12.2', 'An indexed file'],  // choice: the indexed file
          hash: ['Hashed file', 'key → address', 'A hashed file turns a key into a block address with a hash function', '12.2', 'A hashed file'],  // choice: the hashed (direct) file
          contig: ['Contiguous', 'one run of blocks', 'Contiguous allocation gives the file one run of consecutive blocks when it is created', '12.7', 'Contiguous allocation'],  // choice: contiguous allocation
          chain: ['Chained', 'each block names the next', 'Chained allocation lets blocks sit anywhere, each holding the number of the next', '12.7', 'Chained allocation'],  // choice: chained allocation
          ialloc: ['Indexed allocation', 'an index of the blocks', 'Indexed allocation keeps an index block that lists the file’s blocks in order', '12.7', 'Indexed allocation'],  // choice: indexed allocation
        };  // closes the TOOLS table
        const GROUPS = [['ORGANIZE THE RECORDS INSIDE A FILE · §12.2', ['pile', 'seq', 'iseq', 'idx', 'hash'], 'c5'], ['PLACE A FILE’S BLOCKS ON THE DISK · §12.7', ['contig', 'chain', 'ialloc'], 'c3']];  // GROUPS: the two groups of choice buttons as [heading, choice keys, column class]
        // the nine problems: a short name, the right choice, the story, what the trouble is (for wrong picks), why the right
        // choice works, and replies to the most tempting wrong picks
        const SC = [  // SC: the nine problems, in the order they are shown; records problems and blocks problems take turns
          { short: 'The field notebook', tool: 'pile', text: 'A wildlife team logs sightings from phones all season. One note has a GPS fix and a photo, the next only a species name and a temperature. Nobody searches the notes until the season ends, when a program reads every one of them once.',  // problem 1: records of many shapes, read all at once later
            need: 'The trouble here is records of many different shapes, gathered before anyone knows how they will be searched.', ok: 'A <span class="t">pile</span> stores records in arrival order and each field carries its own name, so notes of any shape fit with no wasted space. Finding one note means searching them all, but this team reads every note anyway.',  // problem 1: its trouble and why a pile fits
            near: { seq: 'A sequential file needs every record to have the same fields in the same order, and these notes do not.', idx: 'Indexes speed up searches, but nobody searches these notes: they are all read once, so building indexes would be wasted work.' } },  // problem 1: replies to the tempting wrong picks
          { short: 'The movie file', tool: 'contig', text: 'A video service writes each movie once, at a size it knows in advance, and never changes it. Viewers then stream the movie straight through from start to finish, so its blocks should come off the disk with as little arm movement as possible.',  // problem 2: a fixed-size file read straight through
            need: 'The trouble here is placing a file of known, fixed size so that it streams with almost no seeking.', ok: '<span class="t">Contiguous allocation</span> gives the movie one run of consecutive blocks when it is created. Streaming it needs almost no seeking, and the allocation table holds just a start block and a length.',  // problem 2: its trouble and why contiguous allocation fits
            near: { chain: 'Chained blocks may sit anywhere, so streaming could send the arm all over the disk. The size is known in advance, so one run is possible, and faster.', ialloc: 'An index works, but scattered blocks cost seeks. A file of known, fixed size read straight through is exactly where one run shines.' } },  // problem 2: replies to the tempting wrong picks
          { short: 'The monthly payroll', tool: 'seq', text: 'Once a month, a payroll program reads every employee’s record in employee-number order and prints a pay slip for each. Changes made during the month are collected in a separate list and merged in just before the run.',  // problem 3: a batch run over every record in key order
            need: 'The trouble here is a batch run that reads every record, in key order, once a month.', ok: 'A <span class="t">sequential file</span> keeps fixed-format records sorted by a key field, exactly the order the run needs. Collecting changes in a separate log and merging them in before each run is the usual way to update it.',  // problem 3: its trouble and why a sequential file fits
            near: { hash: 'Hashing scatters records with no order, so a run in employee-number order would have to sort them first.', iseq: 'The index would never be used: nothing here looks up a single employee. It would only cost space and upkeep.' } },  // problem 3: replies to the tempting wrong picks
          { short: 'The data logger', tool: 'chain', text: 'A weather station appends a few lines to its log every minute for months, so the log’s final size is unknown. Its tiny file system stores nothing per file except the first block and the length, and the log is only ever read from start to end.',  // problem 4: a file that grows forever, read from start to end
            need: 'The trouble here is a file that grows a block at a time, with nothing stored per file but where it starts and how long it is.', ok: '<span class="t">Chained allocation</span> adds any free block to the end of the chain whenever the log grows, and each block names the next. The table needs only the first block and the length, and a start-to-end read simply follows the chain.',  // problem 4: its trouble and why chained allocation fits
            near: { contig: 'A contiguous file gets its whole run when it is created, and this log’s final size is unknown: the run would soon bump into a block that is already taken.', ialloc: 'Indexed allocation keeps a separate index block for each file, and this file system stores nothing per file but the first block and the length.' } },  // problem 4: replies to the tempting wrong picks
          { short: 'The bank accounts', tool: 'iseq', text: 'Every night, a bank’s program updates all accounts in account-number order. During the day, tellers must call up any single account by its number within a moment.',  // problem 5: a key-order batch run plus single lookups by the same key
            need: 'The trouble here is serving two kinds of use at once: a key-order batch run and fast single lookups by the same key.', ok: 'An <span class="t">indexed sequential file</span> keeps the records in key order for the nightly run and adds an index that jumps close to any one account. New accounts wait in an overflow file until the next reorganization.',  // problem 5: its trouble and why an indexed sequential file fits
            near: { seq: 'A sequential file suits the nightly run, but finding one account means searching on average half the file: far too slow for a teller.', hash: 'Hashing finds one account fast, but it throws away the key order the nightly run needs.' } },  // problem 5: replies to the tempting wrong picks
          { short: 'The jumping database', tool: 'ialloc', text: 'A database file grows by unpredictable amounts, and its program jumps straight to block 9,000 of the file, then block 12, then block 6,500, in no particular order.',  // problem 6: random jumps into a growing file
            need: 'The trouble here is reaching any block of a growing file directly, without reading the blocks before it.', ok: '<span class="t">Indexed allocation</span> keeps a list of the file’s blocks in order, so block 9,000 is found with one look in the index, and the file can grow by any free block.',  // problem 6: its trouble and why indexed allocation fits
            near: { chain: 'In a chain, block 9,000 is found only by reading the 8,999 blocks before it, one pointer at a time.', contig: 'One run would find block 9,000 by arithmetic, but this file grows by unpredictable amounts, and a run cannot grow once the next block is taken.', idx: 'An indexed file finds records by key inside a file. The problem here is finding the file’s own blocks on the disk.' } },  // problem 6: replies to the tempting wrong picks
          { short: 'The airline bookings', tool: 'idx', text: 'An airline must find any booking at once by passenger name, by booking code or by flight number. Bookings differ in length: one passenger or nine, one flight or four.',  // problem 7: fast searches on several fields of variable-length records
            need: 'The trouble here is fast searches on several different fields of variable-length records.', ok: 'An <span class="t">indexed file</span> drops the single key order and keeps one index for each field people search by. Records may vary in length, and each search goes straight through the matching index.',  // problem 7: its trouble and why an indexed file fits
            near: { iseq: 'Indexed sequential is built around one key order, and here three different fields must each be searched quickly.', hash: 'A hash finds a record by one key only, and these bookings must be found by three different fields.', ialloc: 'Indexed allocation finds a file’s blocks on the disk; the searches here are for records by name, code and flight inside the file.' } },  // problem 7: replies to the tempting wrong picks
          { short: 'The scattered free space', tool: 'ialloc', text: 'A disk has 40 MB free in total, but no free run is longer than 2 MB. A new 10 MB file must be created right now, and its program will read it at random positions.',  // problem 8: scattered free space plus random reads
            need: 'The trouble here is building a file from scattered free blocks and still reaching any of them directly.', ok: 'Again <span class="t">indexed allocation</span>: it builds the file from scattered blocks, which one contiguous run cannot, and its index still reaches any block in one step, which a chain cannot.',  // problem 8: its trouble and why indexed allocation fits
            near: { contig: 'No free run is long enough: contiguous allocation would first need compaction to gather 10 MB in one place.', chain: 'A chain can use the scattered blocks, but every random read would have to follow it from the start.' } },  // problem 8: replies to the tempting wrong picks
          { short: 'The checkout scanner', tool: 'hash', text: 'At a supermarket checkout, every beep looks up one product by its barcode, as fast as possible. The records are all the same length, and nobody ever needs the products in order.',  // problem 9: the fastest lookup of one record by one key
            need: 'The trouble here is the fastest possible lookup of one record by one key, with no need for order.', ok: 'A <span class="t">hashed file</span> turns the barcode into a block address with a hash function, so a lookup usually takes about one access and no searching.',  // problem 9: its trouble and why a hashed file fits
            near: { iseq: 'An index finds the product, but costs extra index reads on every beep; with no need for order, hashing goes straight to the block.', idx: 'An index per field is for searching on many fields. Here there is one key, and hashing reaches it in about one access.' } },  // problem 9: replies to the tempting wrong picks
        ];  // closes the SC list
        const keys = Object.keys(TOOLS);  // keys: the eight choice keys
        const ans = SC.map(() => null);  // ans: the choice picked for each problem, null until picked
        let cur = 0;  // cur: the problem on screen, counting from 0
        const scCard = h('div', { class: 'card white ch12-sc', 'aria-live': 'polite' });  // scCard: the problem card; screen readers read it when it changes
        const fb = h('div', { class: 'callout m0 small ch12-fb', 'aria-live': 'polite' });  // fb: the feedback callout, read aloud when it changes
        const btn = {};  // btn: the eight choice buttons, by key
        keys.forEach((k) => { btn[k] = h('button', { class: 'ch12-tool', type: 'button', onclick: () => { ans[cur] = k; paint(); } }, h('b', {}, TOOLS[k][0]), h('span', {}, TOOLS[k][1])); });  // one button per choice, its name over its short description; a click picks it for the problem on screen
        const list = h('div', { class: 'ch12-list' });  // list: the column of problem rows on the right
        const score = h('span', { class: 'big', style: { fontSize: '30px' } });  // score: the "n / 9" count at 30px
        const nextOpen = () => { for (let d = 1; d <= SC.length; d++) { const j = (cur + d) % SC.length; if (ans[j] !== SC[j].tool) return j; } return (cur + 1) % SC.length; };  // nextOpen(): the next problem not yet solved, going round; the next one in order if all are solved
        const LAYER = {  // LAYER: the reply when a pick comes from the wrong group, by the section of the right answer
          '12.2': (T) => `<b>${T[4]}</b> decides where a file’s blocks sit on the disk, but this problem is about how the records inside the file are arranged and found, so the answer is in the top group.`,  // a block choice for a records problem
          '12.7': (T) => `<b>${T[4]}</b> is a way to arrange the records inside a file, but this problem is about where the file’s blocks go on the disk, so the answer is in the bottom group.`,  // a records choice for a blocks problem
        };  // closes the LAYER table
        function paint() {  // paint(): redraws the problem, the buttons, the feedback, the list and the score after every click
          const sc = SC[cur], a = ans[cur], ok = a === sc.tool, T = a ? TOOLS[a] : null, home = TOOLS[sc.tool][3];  // sc: the problem on screen; a: the choice picked for it; ok: whether that is right; T: the picked choice's entry; home: the section of the right answer
          scCard.innerHTML = `<div class="xs muted b">PROBLEM ${cur + 1} OF ${SC.length}: ${sc.short.toUpperCase()}</div><p class="ch12-text m0">${sc.text}</p>`;  // the problem card: a small heading with its number and name, then the story
          keys.forEach((k) => { btn[k].classList.toggle('ok', a === k && ok); btn[k].classList.toggle('bad', a === k && !ok); btn[k].setAttribute('aria-pressed', String(a === k)); });  // marks the picked choice green or red and tells screen readers which one is pressed
          fb.className = 'callout m0 small ch12-fb ' + (a === null ? '' : ok ? 'tip' : 'bad');  // the feedback box's color: plain before a pick, green if right, red if wrong
          fb.dataset.label = a === null ? 'Your move' : ok ? `Correct: ${T[0]} (§${T[3]})` : 'Not quite';  // the feedback label: "Your move", "Correct:" with the choice and its section, or "Not quite"
          fb.innerHTML = a === null ? 'Which choice fits best? Each problem is about either the records inside a file or the blocks on the disk. One choice fits two of the nine problems.' : ok ? sc.ok : (sc.near[a] || (T[3] !== home ? LAYER[home](T) : `${T[2]}. ${sc.need}`)) + ' Try another.';  // the feedback text: the instruction, why the right choice works, or a reply to the wrong pick (a specific one, a wrong-group one, or a general one)
          list.replaceChildren(...SC.map((x, i) => {  // rebuilds the nine problem rows
            const st = ans[i] === null ? '' : ans[i] === x.tool ? 'ok' : 'bad';  // st: the row's state: unanswered, right or wrong
            return h('button', { class: 'ch12-li' + (i === cur ? ' on' : ''), type: 'button', 'aria-current': i === cur ? 'true' : null, onclick: () => { cur = i; paint(); } },  // the row as a button, ringed when on screen; a click shows that problem
              h('span', { class: 'ch12-n' }, String(i + 1)), h('span', { class: 'grow' }, x.short),  // the round number and the short name
              st ? h('span', { class: 'chip ' + st }, (st === 'ok' ? '✓ ' : '✗ ') + TOOLS[ans[i]][0]) : h('span', { class: 'xs muted' }, 'not answered'));  // the tag: the picked choice with a green check or a red cross, or "not answered"
          }));  // ends the problem rows
          score.textContent = `${SC.filter((x, i) => ans[i] === x.tool).length} / ${SC.length}`;  // the score: how many problems have the right choice, out of nine
          ctx.refit();  // re-checks that the step still fits
        }  // ends paint()
        el.append(h('div', { class: 'split r fill' },  // puts step 2 on screen: two columns, the larger one on the left
          h('div', { class: 'stack', style: { gap: '8px' } },  // left column, stacked 8px apart:
            scCard,  // the problem card
            ...GROUPS.map(([head, ks, c]) => h('div', { class: 'ch12-grp' }, h('span', { class: 'xs muted b' }, head), h('div', { class: 'ch12-tools ' + c }, ...ks.map((k) => btn[k])))),  // the two groups of choice buttons, each under its small heading
            fb,  // the feedback
            h('div', { class: 'row nw', style: { alignItems: 'center' } }, h('button', { class: 'btn sm primary', type: 'button', onclick: () => { cur = nextOpen(); paint(); } }, 'Next problem ▶'),  // the "Next problem" button, which skips problems already solved,
              h('span', { class: 'xs muted', html: 'Ways to organize records: §12.2, with B-trees for big indexes in §12.3. Ways to place blocks: §12.7.' }))),  // beside a small note naming the sections that teach the choices; ends the left column
          h('div', { class: 'stack', style: { gap: '8px' } },  // right column, stacked 8px apart:
            h('div', { class: 'row', style: { alignItems: 'baseline' } }, score, h('span', { class: 'small b' }, 'solved'), h('span', { class: 'xs muted' }, 'click a row to revisit it'),  // a row with the big score, the word "solved" and a hint
              h('button', { class: 'btn sm', type: 'button', style: { marginLeft: 'auto', alignSelf: 'center' }, onclick: () => { ans.fill(null); cur = 0; paint(); } }, 'Start over')),  // and a "Start over" button pushed to the right that clears every answer
            list,  // the nine problem rows
            h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: '“Indexed” names two different ideas. An <span class="t">indexed file</span> finds records by a key inside the file (§12.2); <span class="t">indexed allocation</span> finds the file’s own blocks on the disk (§12.7). A file can use both, or either one alone.' }))));  // amber "Common mistake" callout: the two meanings of "indexed"; ends the layout
        paint();  // draws the first problem when the step opens
      },  // ends render() for step 2
    },  // closes step 2
  ],  // closes the chapter's steps list
  notes: `${/* notes: the chapter 12 summary shown in the Notes drawer on the overview steps and in the printed guide */''}
    <h3>How Chapter 12 fits together</h3>${/* notes heading: how chapter 12 fits together */''}
    <p>A file system keeps a file's name, its attributes and its data in different places. The overview fetches the 85th record of /home/maya/members.dat: with 100-byte records, 40 to a 4,096-byte block, it is in file block 3. Each directory on the path costs two reads (header, then entries), 6 for /, home and maya, and the file's header 1 more. Locating file block 3 then takes no read with contiguous allocation, 2 with chained and 1 with indexed, plus the block itself: 8, 10 or 9 reads for 100 bytes, which is why systems cache directory entries and headers.</p>${/* notes paragraph: the overview's lookup and its computed read counts */''}
    <h4>Files, layers and organization (12.1 to 12.3)</h4>${/* notes heading: sections 12.1 to 12.3 */''}
    <p>Fields form records, records form files, and linked data forms a database. File software is layered: access method, logical I/O, basic I/O supervisor, basic file system, device drivers. The organization follows the use: pile (arrival order), sequential (key order, for batch runs), indexed sequential (key order plus an index and an overflow file), indexed (one index per searched field) or hashed (key turned into a block address). B-trees keep big indexes short and wide: a few block reads find one key among millions.</p>${/* notes paragraph: sections 12.1 to 12.3 in brief */''}
    <h4>Directories and sharing (12.4 and 12.5)</h4>${/* notes heading: sections 12.4 and 12.5 */''}
    <p>A directory maps names to files; an entry holds the attributes or points to a file header. A tree of directories gives every file a pathname, absolute from the root or relative to the working directory. Sharing needs access rights (knowledge up to deletion, for the owner, groups or everyone) and locks on files or records, so simultaneous updates cannot wreck each other.</p>${/* notes paragraph: sections 12.4 and 12.5 in brief */''}
    <h4>Blocking and storage (12.6 and 12.7)</h4>${/* notes heading: sections 12.6 and 12.7 */''}
    <p>Programs read records but disks move blocks. Fixed blocking fits ⌊B / R⌋ records per block; variable-length spanned and unspanned blocking trade wasted space against simplicity. Contiguous allocation gives one run (fast, but free space fragments), chained allocation links the blocks (any free block will do, random access is slow) and indexed allocation lists them in an index block (good for both). Free space is tracked by a bit table, chained free portions, an index or a free block list.</p>${/* notes paragraph: sections 12.6 and 12.7 in brief */''}
    <h4>Real file systems (12.8 to 12.11)</h4>${/* notes heading: sections 12.8 to 12.11 */''}
    <p>UNIX keeps everything about a file but its name in an inode, whose direct and indirect pointers reach its blocks. Linux serves every file system through the VFS objects (superblock, inode, dentry, file) and a dentry cache. NTFS describes each file as attributes in a master file table record and logs metadata changes to recover after a crash. Android puts ext4 or F2FS in fixed partitions, gives each app its own Linux user and private directory, and keeps app data in SQLite databases.</p>${/* notes paragraph: sections 12.8 to 12.11 in brief */''}
    <h4>Why it matters next</h4>${/* notes heading: why it matters next */''}
    <p>Chapter 13 turns to embedded systems, whose storage is often flash that is erased in large blocks and wears out: the same questions (where blocks go, how they are found, how they survive a power cut) with far fewer resources.</p>`,  // notes paragraph: chapter 13 meets the same questions on flash; end of the notes text
});  // ends chapter 12

Guide.chapter({  // registers chapter 13 with the guide
  num: 13,  // num: the chapter number; it sets the chapter's order, its color (--ch13) and page addresses such as #ch13
  title: 'Embedded Operating Systems',  // title shown on the chapter card, the chapter overview page and the top-bar tooltip
  tagline: 'Most computers are hidden inside other things. Their operating systems must be small, fast to react and built for one job.',  // tagline: the one-sentence hook printed in the chapter color at the top of the chapter overview page
  intro: '<p>Far more processors live inside cars, appliances, sensors and phones than inside desktop computers. This chapter explains what an embedded system is, what its operating system must do differently, how Linux is slimmed down for embedded use, and how TinyOS runs on tiny wireless sensor nodes.</p>',  // intro: the opening paragraph of the chapter overview page
  objectives: [  // objectives: the list shown under "After this chapter you will be able to" on the overview page and in the printed guide
    'Explain what an embedded system is and how microcontrollers differ from microprocessors.',  // objective 1: embedded systems and microcontrollers
    'List the characteristics of an embedded operating system.',  // objective 2: what an embedded OS must provide
    'Describe how embedded Linux differs from desktop Linux.',  // objective 3: embedded Linux
    'Explain the component and task model of TinyOS.',  // objective 4: TinyOS
  ],  // closes the objectives list
  terms: [],  // terms: chapter-level glossary entries; the sections define this chapter's terms
  css: ` /* css: style rules used only by chapter 13's overview steps; each rule starts with .sec-ch13, the canvas class on these steps */
    .sec-ch13 .ch13-scene { padding: 4px 6px; } /* .ch13-scene: the white card around step 1's farm picture, with slim padding */
    .sec-ch13 .ch13-dev { cursor: pointer; outline: none; } /* .ch13-dev: one clickable device in the farm picture; its focus ring is drawn by .ch13-ring instead of the browser outline */
    .sec-ch13 .ch13-dev .ch13-ring { fill: none; stroke: var(--chc); stroke-width: 3; opacity: 0; } /* .ch13-ring: a chapter-colored circle around a device's number, hidden until the device is chosen or focused */
    .sec-ch13 .ch13-dev.on .ch13-ring { opacity: 1; } /* .on: the chosen device shows its ring */
    .sec-ch13 .ch13-dev:focus-visible .ch13-ring { opacity: 1; stroke-dasharray: 4 3; } /* a device reached with the Tab key shows a dashed ring */
    .sec-ch13 .ch13-dot { fill: var(--panel); stroke: var(--chc); stroke-width: 2; } /* .ch13-dot: the round badge that holds a device's number: background-colored, with a chapter-colored edge */
    .sec-ch13 .ch13-dev:hover .ch13-dot { stroke-width: 3.5; } /* hovering a device thickens its badge's edge */
    .sec-ch13 .ch13-dev.seen .ch13-dot { fill: var(--chc); } /* .seen: a device already opened gets a badge filled with the chapter color */
    .sec-ch13 .ch13-num { fill: var(--chc); font-weight: 800; } /* .ch13-num: the number inside a badge, in the chapter color */
    .sec-ch13 .ch13-dev.seen .ch13-num { fill: var(--panel); } /* once the badge is filled, its number takes the background color so it stays readable */
    .sec-ch13 .ch13-lab { font-weight: 700; } /* .ch13-lab: a device's name beside its badge, in bold */
    .sec-ch13 .ch13-dim { opacity: .22; } /* .ch13-dim: a device that the chosen roadmap section does not cover fades into the background */
    .sec-ch13 .ch13-cap { min-height: 94px; font-size: 15px; } /* .ch13-cap: the journey's narration box keeps a minimum height so the controls under it stay still */
    .sec-ch13 .ch13-info { min-height: 270px; border-left: 5px solid var(--chc); padding: 10px 14px; } /* .ch13-info: the device card on the right of step 1, with a minimum height and a thick chapter-colored left edge */
    .sec-ch13 .ch13-info p { font-size: 14.5px; line-height: 1.4; } /* the job and the explanation in the device card use slightly small text */
    .sec-ch13 .ch13-chips { display: flex; flex-wrap: wrap; gap: 4px; } /* .ch13-chips: a wrapping row of small tags (a device's limits, or the kinds of software found) */
    .sec-ch13 .ch13-legend { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 5px; } /* .ch13-legend: on a small screen, the numbered device buttons under the picture, in two columns */
    .sec-ch13 .ch13-lg, .sec-ch13 .ch13-pb { display: flex; align-items: center; gap: 6px; text-align: left; padding: 5px 8px; border: 1px solid var(--line); border-radius: 9px; background: var(--panel-2); color: var(--ink); font: inherit; font-size: 13.5px; font-weight: 700; line-height: 1.2; cursor: pointer; } /* .ch13-lg (a device button under the picture) and .ch13-pb (a device button in step 2): bold text in a light rounded box */
    .sec-ch13 .ch13-lg:hover, .sec-ch13 .ch13-pb:hover, .sec-ch13 .ch13-mb:hover, .sec-ch13 .ch13-tr:hover { border-color: var(--chc); } /* hovering any of these buttons outlines it in the chapter color */
    .sec-ch13 .ch13-lg.on, .sec-ch13 .ch13-pb.on, .sec-ch13 .ch13-mb.on, .sec-ch13 .ch13-tr.on { border-color: var(--chc); box-shadow: 0 0 0 1px var(--chc); background: color-mix(in srgb, var(--chc) 9%, var(--panel)); } /* .on: the chosen button gets a chapter-colored ring and a faint chapter-colored fill */
    .sec-ch13 .ch13-map { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; } /* .ch13-map: step 1's four roadmap buttons in two columns */
    .sec-ch13 .ch13-mb { display: flex; flex-direction: column; align-items: flex-start; text-align: left; padding: 5px 10px; border: 1px solid var(--line); border-radius: 9px; background: var(--panel-2); color: var(--ink); font: inherit; line-height: 1.25; cursor: pointer; } /* .ch13-mb: one roadmap button: the section and its name over a short description */
    .sec-ch13 .ch13-mb b { font-size: 14.5px; } /* the section and its name are bold */
    .sec-ch13 .ch13-mb span { font-size: 13px; color: var(--muted); } /* the short description under it is small and grey */
    .sec-ch13 .ch13-pre { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 5px; } /* .ch13-pre: step 2's nine device buttons in three columns */
    .sec-ch13 .ch13-req { display: grid; grid-template-columns: 84px minmax(0, 1fr); gap: 8px; align-items: center; } /* .ch13-req: one requirement row of step 2: its name in an 84px column, its switch beside it */
    .sec-ch13 .ch13-req > b { font-size: 14.5px; } /* the requirement's name */
    .sec-ch13 .ch13-req .seg button { padding: 4px 9px; font-size: 13.5px; } /* the requirement switches use slightly smaller buttons so three options fit on one line */
    .sec-ch13 .ch13-req .ui-slider { grid-template-columns: minmax(0, 1fr) auto; gap: 8px; } /* the memory slider drops its own label column (the row already names it) */
    .sec-ch13 .ch13-req .ui-slider label { display: none; } /* hides the slider's built-in label, since the row shows "Memory" */
    .sec-ch13 .ch13-verdict { min-height: 118px; } /* .ch13-verdict: the verdict box keeps a minimum height so the layout stays still as it changes */
    .sec-ch13 .ch13-tbl { display: flex; flex-direction: column; gap: 4px; } /* .ch13-tbl: the fit table: a header row over five candidate rows */
    .sec-ch13 .ch13-th, .sec-ch13 .ch13-tr { display: grid; grid-template-columns: minmax(0, 2.2fr) repeat(5, minmax(0, 1fr)); gap: 4px; align-items: center; } /* .ch13-th (header) and .ch13-tr (a candidate row) share six columns: the candidate's name (wide enough for one line), then one per requirement */
    .sec-ch13 .ch13-th { padding: 0 9px; font-size: 12.5px; font-weight: 700; color: var(--muted); text-align: center; } /* the header row: small grey column titles, centered over their icons */
    .sec-ch13 .ch13-th span:first-child { text-align: left; } /* except the first title, which sits over the left-aligned names */
    .sec-ch13 .ch13-tr { min-height: 34px; padding: 3px 8px; border: 1px solid var(--line); border-radius: 9px; background: var(--panel-2); color: var(--ink); font: inherit; text-align: left; cursor: pointer; } /* .ch13-tr: one candidate row as a button, in a light rounded box */
    .sec-ch13 .ch13-tr.rec { border-left: 5px solid var(--chc); padding-left: 4px; } /* .rec: the recommended candidate gets a thick chapter-colored left edge */
    .sec-ch13 .ch13-tn { display: flex; flex-direction: column; font-size: 14.5px; font-weight: 700; line-height: 1.15; min-width: 0; } /* .ch13-tn: a candidate's name, with its "smallest fit" tag under it when it has one */
    .sec-ch13 .ch13-tn small { font-size: 12px; font-weight: 800; color: var(--chc); } /* the small chapter-colored tag under the recommended candidate's name */
    .sec-ch13 .ch13-ic { justify-self: center; display: inline-grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; font-size: 13.5px; font-weight: 800; } /* .ch13-ic: one round result icon in the table (✓, ! or ✗) */
    .sec-ch13 .ch13-ic.ok { background: var(--ok-bg); color: var(--ok); } /* a requirement met: green */
    .sec-ch13 .ch13-ic.warn { background: var(--warn-bg); color: var(--warn); } /* met only with care: amber */
    .sec-ch13 .ch13-ic.bad { background: var(--bad-bg); color: var(--bad); } /* not met: red */
    .sec-ch13 .ch13-why { display: flex; flex-direction: column; gap: 5px; } /* .ch13-why: the list of reasons for the chosen candidate */
    .sec-ch13 .ch13-wr { display: grid; grid-template-columns: 24px minmax(0, 1fr); gap: 8px; align-items: start; font-size: 14px; line-height: 1.3; } /* .ch13-wr: one reason: its icon, then the requirement's name and the reason */
    @media (max-width: 760px) { /* @media (max-width: 760px): these rules apply only on windows 760px wide or less */
      .sec-ch13 .ch13-pre { grid-template-columns: repeat(2, minmax(0, 1fr)); } /* on a small screen the device buttons of step 2 use two columns */
      .sec-ch13 .ch13-req { grid-template-columns: minmax(0, 1fr); gap: 3px; } /* and each requirement's name sits above its switch */
      .sec-ch13 .ch13-th, .sec-ch13 .ch13-tr { grid-template-columns: minmax(0, 1.5fr) repeat(5, minmax(0, 1fr)); gap: 2px; } /* and the fit table gives its name column a little less room */
      .sec-ch13 .ch13-th { padding: 0 4px; font-size: 12px; } /* with slightly smaller column titles */
      .sec-ch13 .ch13-tr { padding: 3px 4px; } /* and slimmer rows */
      .sec-ch13 .ch13-tn { font-size: 13px; } /* and smaller candidate names */
    } /* ends the small-window rules */
  `,  // end of chapter 13's CSS text
  steps: [  // steps: the chapter's own overview steps, shown right after the chapter page and before section 13.1
    {  // step 1 of the chapter 13 overview
      title: 'A farm full of hidden computers',  // title shown at the top of step 1
      kind: 'story',  // kind "story" labels the step "Big Picture" and keeps it on the shorter core path
      render(el, ctx) {  // render(el, ctx): builds the step when it is shown; el is the empty step area, ctx holds the shell's helpers
        const { h, s } = ctx;  // h builds HTML elements and s builds SVG (drawing) elements
        const KIND = {  // KIND: the four kinds of software on the farm, each with its name, its tag color and the section that teaches it
          none: { name: 'No OS: a super loop', cls: 'mem', sec: '13.2' },  // a bare-metal program with no operating system under it
          rtos: { name: 'Small RTOS', cls: 'intr', sec: '13.2' },  // a small real-time operating system
          linux: { name: 'Embedded Linux', cls: 'os', sec: '13.3' },  // Linux trimmed down for one device
          tiny: { name: 'Sensor OS (TinyOS style)', cls: 'io', sec: '13.4' },  // an operating system built for sensor motes
        };  // closes KIND
        const LIM = {  // LIM: the words for each limit a device can have; step 2 offers the same choices
          pow: { wall: 'Wall or vehicle power', daily: 'Recharged daily', years: 'Battery for years' },  // where its energy comes from
          dl: { none: 'No deadlines', soft: 'Soft deadlines', hard: 'Hard deadlines' },  // how strict its timing is
          jobs: { one: 'One job', several: 'Several jobs at once' },  // how many jobs it juggles
          sw: { small: 'Small custom code', big: 'Big ready-made software', apps: 'Apps the user installs' },  // what software it must run
        };  // closes LIM
        const kb = (n) => (n < 1024 ? n + ' KB' : n < 1048576 ? n / 1024 + ' MB' : n / 1048576 + ' GB');  // kb(n): a memory size given in KB, written in KB, MB or GB
        const PUMP_MS = 10;  // PUMP_MS: how soon, in ms, the pump controller must stop the motor after a pressure spike
        // DEV: the seven devices, numbered in this order. x, y: the badge in the full-size picture; lab, lx, ly, la: the two-line
        // name label, where its first line sits and how it is aligned; kind: the software inside; mem (in KB), pow, dl, jobs, sw:
        // its limits, exactly the values step 2's device buttons load; job and why: the card's two explanations
        const DEV = [  // DEV: the devices, as described above
          { k: 'motes', name: 'Soil motes', lab: ['Soil', 'motes'], x: 190, y: 296, lx: 207, ly: 292, la: 'start', kind: 'tiny', mem: 8, pow: 'years', dl: 'soft', jobs: 'several', sw: 'small',  // device 1: the soil-moisture motes in the field
            job: 'Each one wakes every 10 minutes, measures how wet the soil is and radios the reading toward the barn, passing on its neighbours’ readings too.',  // device 1's job
            why: 'Kilobytes of RAM and two AA cells that must last years. A <span class="t">TinyOS</span>-style system is a few small components compiled with the application, asleep whenever it can be. Many newer motes run Contiki-NG, RIOT or Zephyr.' },  // device 1: why a sensor OS fits
          { k: 'gw', name: 'Barn gateway', lab: ['Barn gateway', '(base station)'], x: 495, y: 100, lx: 495, ly: 130, la: 'middle', kind: 'linux', mem: 131072, pow: 'wall', dl: 'soft', jobs: 'several', sw: 'big',  // device 2: the gateway in the barn
            job: 'The sensor network’s <span class="t">base station</span>: it collects every mote’s readings, stores them, decides when to water, and reports to the farmer’s phone over the mobile network.',  // device 2's job
            why: 'Networking, storage, a web page and security updates are big jobs that Linux already does well, and the gateway has megabytes of RAM and wall power. Trimming Linux beats writing all that from scratch.' },  // device 2: why embedded Linux fits
          { k: 'pump', name: 'Pump controller', lab: ['Pump', 'controller'], x: 266, y: 122, lx: 304, ly: 114, la: 'start', kind: 'rtos', mem: 32, pow: 'wall', dl: 'hard', jobs: 'several', sw: 'small',  // device 3: the irrigation pump's controller
            job: `Starts and stops the irrigation pump when the gateway says so, runs the motor smoothly, and must cut the motor within ${PUMP_MS} ms if the pressure spikes because a pipe has burst.`,  // device 3's job
            why: 'Several jobs share one <span class="t">microcontroller</span>, and the pressure check is a <span class="t">hard real-time task</span>. A small <span class="t">RTOS</span> gives each job a priority and bounds how long the urgent one can wait.' },  // device 3: why an RTOS fits
          { k: 'thermo', name: 'Greenhouse thermostat', lab: ['Greenhouse', 'thermostat'], x: 50, y: 118, lx: 68, ly: 114, la: 'start', kind: 'none', mem: 4, pow: 'wall', dl: 'soft', jobs: 'one', sw: 'small',  // device 4: the greenhouse thermostat
            job: 'Holds the greenhouse at 24 °C: it reads a temperature sensor, switches the heater on or off, and repeats every second.',  // device 4's job
            why: 'One <span class="t">feedback loop</span> and nothing to share or schedule. A <span class="t">super loop</span> runs it directly on the chip; an OS would only add size and more that could go wrong.' },  // device 4: why no OS is needed
          { k: 'gate', name: 'Gate remote', lab: ['Gate', 'remote'], x: 620, y: 132, lx: 620, ly: 180, la: 'middle', kind: 'none', mem: 1, pow: 'years', dl: 'none', jobs: 'one', sw: 'small',  // device 5: the remote that opens the gate
            job: 'Sleeps in the farmer’s pocket until its button is pressed, then sends one coded radio burst that opens the gate.',  // device 5's job
            why: 'One button, one job, one coin cell for years. A tiny <span class="t">bare-metal program</span> sleeps until the button’s <span class="t">interrupt</span> wakes it: there is nothing for an OS to manage.' },  // device 5: why no OS is needed
          { k: 'ecu', name: 'Engine controller', lab: ['Engine', 'controller'], x: 440, y: 277, lx: 434, ly: 238, la: 'middle', kind: 'rtos', mem: 512, pow: 'wall', dl: 'hard', jobs: 'several', sw: 'small',  // device 6: the tractor's engine controller
            job: 'The tractor’s engine <span class="t">electronic control unit</span>: it times each fuel injection to the crankshaft’s position, dozens of times a second, and watches temperatures and pressures.',  // device 6's job
            why: 'An injection even a fraction of a millisecond late wastes fuel or harms the engine, and the box lives in heat and constant vibration. Hard deadlines on a rugged microcontroller call for a small RTOS.' },  // device 6: why an RTOS fits
          { k: 'cab', name: 'Cab display', lab: ['Cab', 'display'], x: 513, y: 241, lx: 513, ly: 196, la: 'middle', kind: 'linux', mem: 524288, pow: 'wall', dl: 'soft', jobs: 'several', sw: 'big',  // device 7: the touch screen in the tractor cab
            job: 'A touch screen in the tractor cab: it shows the field map from satellite positioning, records where the seed went, and plays the rear camera’s video.',  // device 7's job
            why: 'Maps, video and a touch screen are big ready-made software, and a late screen update only annoys. Many such displays run <span class="t" data-t="embedded Linux distribution">embedded Linux</span>; some run Android, which is built on Linux too.' },  // device 7: why embedded Linux fits
        ];  // closes DEV
        const MAP = [['13.1', 'Embedded systems', 'one job inside a product'], ['13.2', 'Embedded OS traits', 'no OS, or a small RTOS'], ['13.3', 'Embedded Linux', 'Linux trimmed for one device'], ['13.4', 'TinyOS', 'an OS for sensor motes']]  // MAP: the roadmap as [section, name, what it covers], then each entry gains
          .map(([sec, name, sub]) => [sec, name, sub, DEV.filter((d) => sec === '13.1' || KIND[d.kind].sec === sec).map((d) => d.k)]);  // the devices that section explains: all of them for 13.1, otherwise those whose software it teaches
        const M = [[318, 222], [190, 262], [64, 300]];  // M: the three motes' places in the full-size picture, from the one nearest the barn to the farthest
        const BARN = [430, 150];  // BARN: the point on the barn wall where the last radio hop arrives
        const MOIST = 18, LIMIT = 25;  // MOIST: the soil moisture the farthest mote measures, in %; LIMIT: the moisture below which the farmer wants watering, in %
        const FR_DEV = [null, 'motes', 'motes', 'gw', 'pump', 'motes'];  // FR_DEV: the device each frame of the journey shows in the card (none on the opening frame)
        const k = ctx.narrow ? 0.6 : 1, W = 660, H = 340;  // k: the picture's scale (a small screen draws it at 60% size, with numbers but no name labels); W, H: its full-size width and height
        const P = (v) => Math.round(v * k * 10) / 10;  // P(v): a full-size coordinate scaled for this screen, to one decimal place
        const D = (d) => d.replace(/\d+(\.\d+)?/g, (m) => String(P(+m)));  // D(d): an SVG path with every number in it scaled the same way
        const FS = ctx.narrow ? 15 : 14, BR = 12;  // FS: the font size of the labels and badge numbers; BR: a badge's radius (never scaled, so numbers stay readable)
        const HALO = 'paint-order:stroke;stroke:var(--panel);stroke-width:4px;stroke-linejoin:round';  // HALO: an outline in the background color drawn under text, so lines behind it never hide it
        const rect = (x, y, w, hh, p) => s('rect', Object.assign({ x: P(x), y: P(y), width: P(w), height: P(hh) }, p));  // rect(...): a rectangle given in full-size coordinates
        const circ = (x, y, r, p) => s('circle', Object.assign({ cx: P(x), cy: P(y), r: P(r) }, p));  // circ(...): a circle given in full-size coordinates
        const path = (d, p) => s('path', Object.assign({ d: D(d) }, p));  // path(d, p): a path given in full-size coordinates
        function arrow(x1, y1, x2, y2) {  // arrow(...): a chapter-colored arrowhead with its tip at (x2, y2), pointing away from (x1, y1)
          const a = Math.atan2(y2 - y1, x2 - x1), L = 11, B = 5.5;  // a: the line's direction; L: the head's length; B: half its width
          const pt = (dx, dy) => `${P(x2 + dx)},${P(y2 + dy)}`;  // pt(dx, dy): one corner of the head, scaled
          const c = Math.cos(a), sn = Math.sin(a);  // c, sn: the direction as a cosine and a sine
          return s('polygon', { points: [pt(0, 0), pt(-L * c + B * sn, -L * sn - B * c), pt(-L * c - B * sn, -L * sn + B * c)].join(' '), style: 'fill:var(--chc)' });  // the triangle: the tip and two back corners
        }  // ends arrow()
        function link(a, b, cut) {  // link(a, b, cut): a solid chapter-colored line with an arrowhead from point a toward point b, stopping cut units short of b
          const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);  // the direction and distance from a to b
          const ex = b[0] - (dx / len) * cut, ey = b[1] - (dy / len) * cut;  // ex, ey: where the line stops
          return [path(`M${a[0]} ${a[1]} L${ex} ${ey}`, { style: 'stroke:var(--chc);stroke-width:3;fill:none' }), arrow(a[0], a[1], ex, ey)];  // the line and its head
        }  // ends link()
        let sel = null, mark = null, frame = 0;  // sel: the device shown in the card (null for none); mark: the roadmap entry whose devices stand out (null for none); frame: the journey frame on screen
        const seen = new Set();  // seen: the devices already opened, whose badges are filled in
        const svg = s('svg', { viewBox: `0 0 ${P(W)} ${P(H)}`, width: '100%', role: 'group', 'aria-label': 'A small farm with seven numbered devices that hide computers' });  // svg: the farm picture
        const glass = 'fill-opacity:.55';  // glass: the see-through look of the greenhouse
        svg.append(s('g', { 'aria-hidden': 'true' },  // the scenery, drawn once and hidden from screen readers:
          rect(0, 0, W, 112, { style: 'fill:var(--cpu-bg);opacity:.6' }), rect(0, 112, W, H - 112, { style: 'fill:var(--mem-bg);opacity:.6' }),  // the sky and the ground
          circ(612, 42, 17, { class: 's-warn' }),  // the sun
          rect(16, 196, 336, 136, { rx: P(8), style: 'fill:var(--mem-bg);stroke:var(--mem);stroke-opacity:.6' }),  // the crop field
          [212, 230, 248, 266, 284, 302, 320].map((y) => path(`M30 ${y} L340 ${y}`, { style: 'stroke:var(--mem);stroke-width:3;stroke-linecap:round;stroke-dasharray:1 9;opacity:.6' })),  // seven rows of crops, drawn as dotted lines
          path('M20 90 Q105 26 190 90 Z', { class: 's-cpu', style: glass }), rect(20, 90, 170, 50, { class: 's-cpu', style: glass }),  // the greenhouse: an arched glass roof over glass walls
          path('M232 104 L266 82 L300 104 Z', { class: 's-panel' }), rect(238, 104, 56, 38, { class: 's-panel' }),  // the pump house: a roof over a small shed
          s('ellipse', { cx: P(322), cy: P(156), rx: P(26), ry: P(8), class: 's-cpu' }),  // the pond the pump draws from
          path('M420 70 L495 28 L570 70 Z', { class: 's-intr' }), rect(430, 70, 130, 100, { class: 's-intr' }),  // the barn: a red roof over red walls
          path('M495 28 L495 10 M487 15 Q495 7 503 15', { class: 's-line', style: 'stroke-width:1.5' }),  // the gateway's antenna on the barn roof
          rect(588, 104, 8, 60, { class: 's-panel' }), rect(644, 104, 8, 60, { class: 's-panel' }),  // the two gate posts
          path('M596 114 L644 114 M596 132 L644 132 M596 150 L644 150 M596 150 L644 114', { class: 's-line', style: 'stroke-width:2' }),  // the gate's three bars and its brace
          rect(386, 262, 96, 34, { rx: P(6), class: 's-ok' }), rect(482, 218, 62, 78, { rx: P(6), class: 's-ok' }), rect(490, 226, 46, 30, { rx: P(4), class: 's-panel' }),  // the tractor: hood, cab and cab window
          [[520, 304, 30, 8], [414, 308, 20, 6]].map(([x, y, r, hub]) => [circ(x, y, r, { style: 'fill:var(--panel-3);stroke:var(--ink-2);stroke-width:4' }), circ(x, y, hub, { class: 's-panel' })])));  // the rear and front wheels, each with a hub; ends the scenery
        const jour = s('g', { 'aria-hidden': 'true' });  // jour: the journey's marks (radio hops, the command, the water), redrawn for each frame
        const devG = s('g');  // devG: the seven clickable devices, drawn on top of everything
        svg.append(jour, devG);  // stacks them over the scenery
        function drawJourney() {  // drawJourney(): redraws the journey's marks for the current frame
          const m = [];  // m collects the marks
          const chain = [M[2], M[1], M[0], BARN];  // chain: the radio path from the farthest mote, through the nearer ones, to the barn
          chain.slice(1).forEach((b, i) => m.push(frame === 2 ? link(chain[i], b, 12) : path(`M${chain[i][0]} ${chain[i][1]} L${b[0]} ${b[1]}`, { class: 's-muted', style: 'stroke-width:1.5;stroke-dasharray:3 5' })));  // each hop: solid with an arrow while the reading travels, otherwise a faint dashed radio link
          m.push(path('M266 142 L266 186 L24 186', frame >= 4 ? { style: 'stroke:var(--cpu);stroke-width:5;fill:none' } : { class: 's-muted', style: 'stroke-width:4' }));  // the irrigation pipe from the pump house to the field, blue while water flows
          if (frame === 1) m.push(circ(M[2][0], M[2][1], 15, { style: 'fill:none;stroke:var(--chc);stroke-width:3' }), s('text', { x: P(M[2][0] + 16), y: P(M[2][1] - 14), 'font-size': FS, 'font-weight': 800, style: 'fill:var(--chc);' + HALO }, MOIST + '%'));  // the waking mote: a ring around it and the reading it takes
          if (frame === 3) m.push(path('M430 96 Q365 58 300 92', { style: 'stroke:var(--chc);stroke-width:3;fill:none;stroke-dasharray:7 4' }), arrow(365, 58, 300, 92));  // the gateway's command to the pump: a dashed arc ending in an arrowhead
          if (frame === 5) M.forEach(([x, y]) => m.push(s('text', { x: P(x + 10), y: P(y - 15), 'font-size': FS - 1, 'font-weight': 700, 'font-style': 'italic', class: 's-sub' }, 'z z')));  // every mote asleep again: a small "z z" beside each
          jour.replaceChildren(...m.flat());  // swaps in the new marks
        }  // ends drawJourney()
        const devEl = DEV.map((d, i) => {  // devEl: one clickable group per device, built once (paint() only changes its classes, so keyboard focus is never lost)
          const kids = [];  // kids: the group's shapes
          if (d.k === 'motes') M.forEach(([x, y]) => kids.push(rect(x - 8, y - 6, 16, 12, { rx: P(2), class: 's-io' }), path(`M${x + 5} ${y - 6} L${x + 5} ${y - 16}`, { class: 's-line', style: 'stroke-width:1.5' })));  // the motes themselves: three small orange boxes with antennas, all part of the same button
          kids.push(s('circle', { cx: P(d.x), cy: P(d.y), r: BR + 5, class: 'ch13-ring' }), s('circle', { cx: P(d.x), cy: P(d.y), r: BR, class: 'ch13-dot' }));  // the ring (shown when chosen) and the round badge
          kids.push(s('text', { x: P(d.x), y: P(d.y) + FS * 0.36, 'text-anchor': 'middle', 'font-size': FS, class: 'ch13-num' }, String(i + 1)));  // the device's number in the badge
          if (!ctx.narrow) d.lab.forEach((t, j) => kids.push(s('text', { x: P(d.lx), y: P(d.ly) + j * 15, 'text-anchor': d.la, 'font-size': FS, class: 'ch13-lab', style: HALO }, t)));  // its two-line name label (a small screen lists the names under the picture instead)
          return s('g', { class: 'ch13-dev', role: 'button', tabindex: 0, 'aria-label': `${i + 1}: ${d.name}`, onclick: () => pick(d.k), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(d.k); } } }, kids);  // the group as a button: a click, Enter or Space opens the device
        });  // ends the device groups
        devG.append(...devEl);  // puts them in the picture
        const legBtns = DEV.map((d, i) => h('button', { class: 'ch13-lg', type: 'button', onclick: () => pick(d.k) }, h('span', { class: 'chip' }, String(i + 1)), d.name));  // legBtns: on a small screen, one numbered button per device under the picture
        const info = h('div', { class: 'card white ch13-info stack', style: { gap: '5px' }, 'aria-live': 'polite' });  // info: the device card; screen readers read it when it changes
        const found = h('div', { class: 'stack', style: { gap: '4px' } });  // found: the "kinds of software found" tags
        const mapBtns = MAP.map(([sec, name, sub], i) => h('button', { class: 'ch13-mb', type: 'button', onclick: () => { mark = mark === i ? null : i; paint(); } }, h('b', {}, `§${sec} ${name}`), h('span', {}, sub)));  // mapBtns: the four roadmap buttons; a click makes that section's devices stand out, a second click clears it
        function pick(key) { player.stop(); sel = key; seen.add(key); paint(); }  // pick(key): the student chose a device: pause the journey and show that device
        function paintInfo() {  // paintInfo(): fills the device card
          const d = DEV.find((x) => x.k === sel);  // d: the device to show, if any
          if (!d) { info.replaceChildren(h('div', { class: 'xs muted b' }, 'WHAT IS INSIDE?'), h('p', { class: 'm0', html: 'Each numbered device hides an <span class="t">embedded system</span>: a computer built into a product to do one job. Click one to see its job, its limits (memory, energy, timing) and the kind of software that fits them.' }), h('div', { class: 'callout why m0 small', 'data-label': 'The big idea', html: 'The limits pick the software. A device with a few kilobytes of memory, or a battery that must last for years, cannot carry the operating system of a laptop. The chapter is about what it carries instead.' })); return; }  // nothing chosen yet: an invitation to click and the chapter's big idea
          const K = KIND[d.kind];  // K: the kind of software inside it
          info.replaceChildren(  // rebuilds the card:
            h('div', { class: 'row nw', style: { justifyContent: 'space-between', alignItems: 'flex-start' } }, h('b', { style: { fontSize: '18px' } }, `${DEV.indexOf(d) + 1}. ${d.name}`), h('span', { class: 'chip ' + K.cls }, K.name)),  // the number and name, with the software kind as a colored tag
            h('div', { class: 'xs muted b' }, 'ITS JOB'), h('p', { class: 'm0', html: d.job }),  // the job
            h('div', { class: 'ch13-chips' }, h('span', { class: 'chip mem' }, 'RAM ' + kb(d.mem)), ['pow', 'dl', 'jobs', 'sw'].map((q) => h('span', { class: 'chip' }, LIM[q][d[q]]))),  // its limits as tags: memory, energy, deadlines, jobs, software
            h('div', { class: 'xs muted b' }, `WHY THIS SOFTWARE · §${K.sec}`), h('p', { class: 'm0', html: d.why }));  // why that kind of software fits, and the section that teaches it
        }  // ends paintInfo()
        function paint() {  // paint(): brings the picture, the buttons and the cards up to date after any change
          DEV.forEach((d, i) => {  // for each device:
            const lit = mark === null || MAP[mark][3].includes(d.k);  // lit: whether it stands out (no section chosen, or the chosen section explains it)
            devEl[i].setAttribute('class', 'ch13-dev' + (sel === d.k ? ' on' : '') + (seen.has(d.k) ? ' seen' : '') + (lit ? '' : ' ch13-dim'));  // its group: ringed when chosen, filled when seen, faded when another section is chosen
            devEl[i].setAttribute('aria-pressed', String(sel === d.k));  // tells screen readers which device is open
            legBtns[i].classList.toggle('on', sel === d.k); legBtns[i].setAttribute('aria-pressed', String(sel === d.k));  // the same for its button under the picture
          });  // ends the devices
          mapBtns.forEach((b, i) => { b.classList.toggle('on', mark === i); b.setAttribute('aria-pressed', String(mark === i)); });  // marks the chosen roadmap button
          paintInfo();  // refills the device card
          const got = new Set(DEV.filter((d) => seen.has(d.k)).map((d) => d.kind));  // got: the kinds of software found so far
          found.replaceChildren(h('div', { class: 'xs muted b' }, `KINDS OF SOFTWARE FOUND: ${got.size} OF ${Object.keys(KIND).length}`),  // the heading with the count
            h('div', { class: 'ch13-chips' }, Object.entries(KIND).map(([key, K]) => h('span', { class: 'chip' + (got.has(key) ? ' ' + K.cls : '') }, (got.has(key) ? '✓ ' : '') + K.name))));  // one tag per kind, colored with a check once found
          ctx.refit();  // re-checks that the step still fits
        }  // ends paint()
        const CAP = [  // CAP: the narration of the journey's six frames, built from the numbers above
          '<b>Follow one reading.</b> Press Play to follow a soil reading from the field to the pump, or click any numbered device to see what is inside it.',  // frame 0: the invitation
          `<b>A mote wakes.</b> A timer wakes the <span class="t">mote</span> farthest from the barn. It reads its soil sensor: ${MOIST}% moisture. Now that number has to reach the barn.`,  // frame 1: the reading is taken
          `<b>Hop by hop.</b> A mote’s low-power radio reaches only tens of metres, so the reading is passed from mote to mote: ${M.length} hops to the barn. Each mote on the way wakes just long enough to pass it on.`,  // frame 2: the radio hops, one per mote
          `<b>The gateway decides.</b> The barn gateway stores the reading. ${MOIST}% is ${MOIST < LIMIT ? 'below' : 'not below'} the farmer’s limit of ${LIMIT}%, so it ${MOIST < LIMIT ? 'tells the pump controller to start watering' : 'leaves the pump off'}.`,  // frame 3: the decision, worked out from the two numbers
          `<b>The pump starts.</b> The pump controller switches the motor on. While water flows, its most urgent task watches the pressure and must stop the motor within ${PUMP_MS} ms if a pipe bursts.`,  // frame 4: the pump runs under a hard deadline
          '<b>Back to sleep.</b> The motes doze until their next timer. Being awake only a tiny fraction of the time (a low <span class="t">duty cycle</span>) is how two AA cells can last for years.',  // frame 5: the motes sleep again
        ];  // closes CAP
        const player = ctx.ui.player({ count: CAP.length, interval: 2800, render(i) { frame = i; if (FR_DEV[i]) { sel = FR_DEV[i]; seen.add(sel); } drawJourney(); paint(); return CAP[i]; } });  // player: steps through the journey; each frame redraws its marks, opens its device in the card and returns its narration
        player.caption.classList.add('ch13-cap');  // gives the narration box its minimum height
        el.append(h('div', { class: 'split r fill' },  // puts step 1 on screen: two columns, the larger one on the left
          h('div', { class: 'stack', style: { gap: '8px' } },  // left column, stacked 8px apart:
            h('div', { class: 'card white ch13-scene' }, svg), ctx.narrow ? h('div', { class: 'ch13-legend' }, legBtns) : null, player.el),  // the farm picture, the device buttons on a small screen, and the journey's narration and controls
          h('div', { class: 'stack', style: { gap: '8px' } },  // right column, stacked 8px apart:
            info, found,  // the device card and the kinds found so far
            h('div', { class: 'stack', style: { gap: '4px' } }, h('span', { class: 'xs muted b' }, 'THE CHAPTER: CLICK A SECTION TO SEE ITS DEVICES'), h('div', { class: 'ch13-map' }, mapBtns)))));  // the roadmap title and its four buttons; ends the layout
      },  // ends render() for step 1
    },  // closes step 1
    {  // step 2 of the chapter 13 overview
      title: 'Desktop OS or embedded OS? Find the smallest fit',  // title shown at the top of step 2
      kind: 'explore',  // kind "explore" labels the step "Explore"
      render(el, ctx) {  // render(el, ctx): builds step 2 when it is shown
        const { h } = ctx;  // h is the helper that builds HTML elements
        const kb = (n) => (n < 1024 ? n + ' KB' : n < 1048576 ? n / 1024 + ' MB' : n / 1048576 + ' GB');  // kb(n): a memory size given in KB, written in KB, MB or GB
        const who = (l) => (l.length === 1 ? l[0] : l.slice(0, -1).join(', ') + ' and ' + l[l.length - 1]);  // who(l): joins words as "A", "A and B" or "A, B and C"
        const KEYS = ['mem', 'pow', 'dl', 'jobs', 'sw'];  // KEYS: the five requirements, in table order
        const REQ = { mem: ['Memory', 'RAM'], pow: ['Energy', 'Energy'], dl: ['Deadlines', 'Timing'], jobs: ['Jobs', 'Jobs'], sw: ['Software', 'Code'] };  // REQ: each requirement's column title, full and short (for a small screen)
        const CAND = [  // CAND: the five kinds of system software, smallest first, each with a full, a short and an in-sentence name, where it is taught, and min: roughly the least RAM it needs, in KB (typical round figures, not exact limits)
          { k: 'none', name: 'No OS (super loop)', short: 'No OS', brief: 'no OS', sec: '§13.2', min: 0 },  // a bare-metal program
          { k: 'tiny', name: 'Sensor OS (TinyOS style)', short: 'Sensor OS', brief: 'a sensor OS', sec: '§13.4', min: 4 },  // a sensor-mote OS: a few KB
          { k: 'rtos', name: 'Small RTOS', short: 'RTOS', brief: 'an RTOS', sec: '§13.2', min: 8 },  // a small real-time OS: a few KB of kernel plus a stack per task
          { k: 'linux', name: 'Embedded Linux', short: 'Emb. Linux', brief: 'embedded Linux', sec: '§13.3', min: 8192 },  // embedded Linux: megabytes
          { k: 'gp', name: 'General-purpose OS', short: 'General OS', brief: 'a general-purpose OS', sec: 'chapters 1–9', min: 2097152 },  // a desktop or phone OS: gigabytes
        ];  // closes CAND
        const ok = (why) => ({ st: 'ok', why }), warn = (why) => ({ st: 'warn', why }), bad = (why) => ({ st: 'bad', why });  // ok/warn/bad(why): one table cell (met, met only with care, not met) with its reason
        const BIG = (c) => c.k === 'linux' || c.k === 'gp';  // BIG(c): whether candidate c is one of the two large systems
        const FIXED = 'the maker builds one fixed image; users cannot install programs';  // FIXED: why the three small systems cannot take users' apps
        const RULE = {  // RULE: for each requirement, a function (c, q) that judges candidate c against the device's requirements q
          mem: (c, q) => (c.min === 0 ? ok('no OS takes up room, so all the memory is the program’s')  // memory: nothing to fit for a bare-metal program,
            : q.mem >= c.min ? ok(`needs about ${kb(c.min)} or more; this device has ${kb(q.mem)}`)  // enough memory for the others,
            : bad(`needs about ${kb(c.min)}; this device has only ${kb(q.mem)}${c.k === 'linux' ? ', and Linux normally needs an MMU too' : ''}`)),  // or too little
          pow: (c, q) => (q.pow === 'wall' ? ok('steady power: energy is no limit here')  // energy: a steady supply suits everything,
            : q.pow === 'daily' ? ok(BIG(c) ? 'like a phone or laptop: busy all day, charged at night' : 'it draws far less than one charge a day provides')  // so does a daily charge,
            : { none: ok('it sleeps between button presses or timer ticks, drawing almost nothing'), tiny: ok('built for this: the processor sleeps whenever the task queue is empty'),  // but years on one battery suits only systems that sleep deeply
              rtos: ok('it sleeps between events; many RTOSs even stop their clock tick while idle'), linux: bad('its processor and RAM draw too much, even idle, to last years on one battery'),  // the RTOS can, Linux cannot
              gp: bad('gigabytes of RAM and a busy processor would empty a small battery within hours') }[c.k]),  // and a general-purpose OS cannot either
          dl: (c, q) => (q.dl === 'none' ? ok('nothing has to happen by a fixed time') : q.dl === 'soft' ? ok('a late result only annoys, so fast on average is enough')  // deadlines: none or soft suit everything,
            : { none: q.jobs === 'one' ? ok('one job in one loop: its worst case can be worked out exactly') : warn('possible with careful interrupt priorities, but with no scheduler every deadline must be proved by hand'),  // hard ones are easy for one job in a loop, hard work for several
              tiny: bad('tasks run first in, first out, each to completion, with no priorities: an urgent task waits behind any other'), rtos: ok('preemptive priorities and a bounded interrupt latency: meeting deadlines is its whole purpose'),  // a sensor OS cannot promise them; an RTOS is built for them
              linux: warn('standard Linux promises no bound; PREEMPT_RT (in the mainline kernel since 6.12) bounds latency, but less tightly than an RTOS'),  // Linux only with the real-time changes merged in 2024
              gp: bad('built for throughput and fairness: no response time is ever promised') }[c.k]),  // and a general-purpose OS never promises a response time
          jobs: (c, q) => (q.jobs === 'one' ? ok('one job needs no sharing')  // jobs: one job is easy for everything,
            : { none: warn('a super loop can serve a few jobs in turn, but each one’s timing depends on the rest'), tiny: ok('tasks and events interleave sensing, computing and radio work on one stack'),  // several jobs strain a super loop
              rtos: ok('each job becomes a task with its own priority and stack'), linux: ok('processes and threads, scheduled as in earlier chapters'), gp: ok('processes and threads, scheduled as in earlier chapters') }[c.k]),  // and are routine for the others
          sw: (c, q) => (q.sw === 'small' ? ok({ none: 'the program is written for this chip and runs on it directly', tiny: 'the application is compiled together with the components it uses', rtos: 'the application is linked with the kernel into one image',  // software: small custom code runs anywhere,
              linux: 'it works, though most of the system would go unused', gp: 'it works, though most of the system would go unused' }[c.k])  // though a big system is wasted on it
            : q.sw === 'big' ? { none: bad('no file system, network stack or processes for big programs to run on'), tiny: bad('no file system, network stack or processes for big programs to run on'),  // big ready-made programs need a big system
              rtos: bad('it offers small networking and file libraries, but not the vast body of Linux software'), linux: ok('the whole Linux software world, cross-compiled for this processor'), gp: ok('big programs are exactly what it is built to run') }[c.k]  // which Linux and the general-purpose OSs are
            : { none: bad(FIXED), tiny: bad(FIXED), rtos: bad(FIXED), linux: warn('Android does this: Linux plus an app framework. A plain embedded distribution ships only the maker’s programs'), gp: ok('made for it: users install whatever they choose') }[c.k]),  // and users' apps need an OS made for them
        };  // closes RULE
        const PRE = [  // PRE: the device buttons; the first seven are step 1's farm devices with exactly the same limits (mem in KB)
          { name: 'Soil mote', mem: 8, pow: 'years', dl: 'soft', jobs: 'several', sw: 'small' },  // device 1 of the farm
          { name: 'Barn gateway', mem: 131072, pow: 'wall', dl: 'soft', jobs: 'several', sw: 'big' },  // device 2
          { name: 'Pump controller', mem: 32, pow: 'wall', dl: 'hard', jobs: 'several', sw: 'small' },  // device 3
          { name: 'Thermostat', mem: 4, pow: 'wall', dl: 'soft', jobs: 'one', sw: 'small' },  // device 4
          { name: 'Gate remote', mem: 1, pow: 'years', dl: 'none', jobs: 'one', sw: 'small' },  // device 5
          { name: 'Engine controller', mem: 512, pow: 'wall', dl: 'hard', jobs: 'several', sw: 'small' },  // device 6
          { name: 'Cab display', mem: 524288, pow: 'wall', dl: 'soft', jobs: 'several', sw: 'big' },  // device 7
          { name: 'Laptop', mem: 8388608, pow: 'daily', dl: 'soft', jobs: 'several', sw: 'apps' },  // a laptop, for comparison
          { name: 'Smartphone', mem: 4194304, pow: 'daily', dl: 'soft', jobs: 'several', sw: 'apps' },  // and a smartphone
        ];  // closes PRE
        const q = {};  // q: the requirements now set, one value per key
        KEYS.forEach((key) => { q[key] = PRE[2][key]; });  // starts with the pump controller, where smaller systems fall short in instructive ways
        const SEGS = {  // SEGS: the choices on each requirement's switch, as [value, label]
          pow: [['wall', 'Wall/vehicle'], ['daily', 'Daily charge'], ['years', 'Battery, years']],  // energy
          dl: [['none', 'None'], ['soft', 'Soft'], ['hard', 'Hard']],  // deadlines
          jobs: [['one', 'One job'], ['several', 'Several']],  // jobs
          sw: [['small', 'Small custom'], ['big', 'Big ready-made'], ['apps', 'User’s apps']],  // software
        };  // closes SEGS
        let pickRow = null;  // pickRow: the candidate row the student clicked to read its reasons, or null to show the recommended one
        const changed = () => { pickRow = null; paint(); };  // changed(): a requirement changed, so the reasons follow the new recommendation
        const memSl = ctx.ui.slider({ label: 'Memory', min: 0, max: 23, step: 1, value: Math.log2(q.mem), format: (v) => kb(2 ** v), onInput: (v) => { q.mem = 2 ** v; changed(); } });  // memSl: the memory slider, in doubling steps from 1 KB (2^0) to 8 GB (2^23 KB)
        const segs = {};  // segs: the four switches, by requirement
        Object.keys(SEGS).forEach((key) => { segs[key] = ctx.ui.seg(SEGS[key].map(([value, label]) => ({ value, label })), q[key], (v) => { q[key] = v; changed(); }); });  // builds each switch; a click stores the choice and redraws
        const preBtns = PRE.map((p) => h('button', { class: 'ch13-pb', type: 'button', onclick: () => { KEYS.forEach((key) => { q[key] = p[key]; }); memSl.set(Math.log2(q.mem)); Object.keys(SEGS).forEach((key) => segs[key].set(q[key])); changed(); } }, p.name));  // preBtns: one button per device; a click loads its requirements into the slider and the switches
        const ICON = { ok: '✓', warn: '!', bad: '✗' }, WORD = { ok: 'met', warn: 'met with care', bad: 'not met' };  // ICON: the mark for each cell state; WORD: the same state in words, for screen readers
        const tags = CAND.map(() => h('small'));  // tags: the tag under each candidate's name ("★ smallest fit" on the recommended one)
        const ics = CAND.map(() => KEYS.map(() => h('span', { class: 'ch13-ic' })));  // ics: the five result icons in each candidate's row
        const trs = CAND.map((c, i) => h('button', { class: 'ch13-tr', type: 'button', onclick: () => { pickRow = i; paint(); } }, h('span', { class: 'ch13-tn' }, ctx.narrow ? c.short : c.name, tags[i]), ics[i]));  // trs: one row per candidate; a click lists that candidate's reasons
        const verdict = h('div', { class: 'callout m0 small ch13-verdict', 'aria-live': 'polite' });  // verdict: the recommendation box, read aloud when it changes
        const whyHead = h('div', { class: 'small' });  // whyHead: the heading over the reasons
        const whyList = h('div', { class: 'ch13-why' });  // whyList: the five reasons for the candidate shown
        function paint() {  // paint(): judges every candidate against the requirements and redraws everything
          const rows = CAND.map((c) => KEYS.map((key) => RULE[key](c, q)));  // rows[i][j]: candidate i judged on requirement j
          const clean = rows.findIndex((r) => r.every((x) => x.st === 'ok'));  // clean: the smallest candidate that meets every requirement outright (-1 if none)
          const careful = rows.findIndex((r) => r.every((x) => x.st !== 'bad'));  // careful: the smallest candidate that fails no requirement (-1 if none)
          const rec = clean >= 0 ? clean : careful;  // rec: the recommendation: a clean fit if there is one, otherwise a fit that needs care, otherwise none (-1)
          const show = pickRow ?? (rec >= 0 ? rec : 0);  // show: the candidate whose reasons are listed
          preBtns.forEach((b, i) => { const on = KEYS.every((key) => PRE[i][key] === q[key]); b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });  // lights the device button whose requirements match the current ones exactly
          CAND.forEach((c, i) => {  // for each candidate row:
            trs[i].className = 'ch13-tr' + (i === rec ? ' rec' : '') + (i === show ? ' on' : '');  // the recommendation gets a thick edge; the row whose reasons are listed gets a ring
            trs[i].setAttribute('aria-pressed', String(i === show));  // tells screen readers which row is listed
            trs[i].setAttribute('aria-label', `${c.name}: ` + KEYS.map((key, j) => `${REQ[key][0].toLowerCase()} ${WORD[rows[i][j].st]}`).join(', ') + (i === rec ? '. Recommended.' : ''));  // and reads the whole row in words
            tags[i].textContent = i !== rec ? '' : ctx.narrow ? '★ best' : rec === clean ? '★ smallest fit' : '★ best, with care';  // the tag under the recommended name (a short one on a small screen)
            ics[i].forEach((ic, j) => { ic.className = 'ch13-ic ' + rows[i][j].st; ic.textContent = ICON[rows[i][j].st]; });  // the five icons
          });  // ends the rows
          if (rec >= 0 && rec === clean) {  // a clean fit:
            const short = CAND.slice(0, rec).map((c, i) => `${c.brief} on ${who(KEYS.filter((key, j) => rows[i][j].st !== 'ok').map((key) => REQ[key][0].toLowerCase()))}`);  // short: each smaller candidate and the requirements it does not fully meet
            verdict.className = 'callout tip m0 small ch13-verdict'; verdict.dataset.label = 'Smallest fit';  // a green box
            verdict.innerHTML = `<b>${CAND[rec].name}</b>, taught in ${CAND[rec].sec}, meets every requirement. ` + (short.length ? `Everything smaller falls short: ${short.join('; ')}.` : 'Nothing is smaller: the program runs on the bare chip.');  // names the fit and why nothing smaller works
          } else if (rec >= 0) {  // a fit only with care:
            const w = KEYS.filter((key, j) => rows[rec][j].st === 'warn').map((key) => REQ[key][0].toLowerCase());  // w: the requirements it meets only with care
            verdict.className = 'callout warn m0 small ch13-verdict'; verdict.dataset.label = 'Best fit, with care';  // an amber box
            verdict.innerHTML = `Nothing meets every requirement outright. <b>${CAND[rec].name}</b> (${CAND[rec].sec}) is the smallest with no ✗, but needs care on ${who(w)}.` + (q.dl === 'hard' && q.sw !== 'small' ? ' Real products often split such a device: an RTOS on a microcontroller meets the deadlines while Linux on a bigger processor runs the big software.' : '');  // names it and where care is needed; for hard deadlines plus big software, the usual two-processor design
          } else {  // nothing fits:
            verdict.className = 'callout bad m0 small ch13-verdict'; verdict.dataset.label = 'Nothing fits';  // a red box
            verdict.innerHTML = 'Every candidate has at least one ✗. Relax a requirement (more memory, steadier power, softer deadlines or smaller software) and watch the table change.';  // suggests what to relax
          }  // ends the verdict
          whyHead.innerHTML = `<span class="xs muted b">REASONS FOR</span> <b>${CAND[show].name}</b> <span class="xs muted">· ${show === rec ? 'the recommendation; ' : ''}click any row to compare</span>`;  // the heading over the reasons
          whyList.replaceChildren(...KEYS.map((key, j) => h('div', { class: 'ch13-wr' }, h('span', { class: 'ch13-ic ' + rows[show][j].st }, ICON[rows[show][j].st]), h('span', {}, h('b', {}, REQ[key][0] + ': '), rows[show][j].why))));  // one line per requirement: its icon, its name and the reason
          ctx.refit();  // re-checks that the step still fits
        }  // ends paint()
        const reqRow = (key, ctl) => h('div', { class: 'ch13-req' }, h('b', {}, REQ[key][0]), ctl);  // reqRow(key, ctl): one requirement row: its name, then its control
        el.append(h('div', { class: 'split l fill' },  // puts step 2 on screen: two columns, the larger one on the right
          h('div', { class: 'stack', style: { gap: '7px' } },  // left column, stacked 7px apart:
            h('div', { class: 'xs muted b' }, 'PICK A DEVICE…'), h('div', { class: 'ch13-pre' }, preBtns),  // the device buttons
            h('div', { class: 'xs muted b' }, '…OR SET ITS REQUIREMENTS YOURSELF'),  // the heading over the controls
            reqRow('mem', memSl), Object.keys(SEGS).map((key) => reqRow(key, segs[key])),  // the memory slider and the four switches
            verdict),  // the recommendation box; ends the left column
          h('div', { class: 'stack', style: { gap: '8px' } },  // right column, stacked 8px apart:
            h('div', { class: 'ch13-tbl' }, h('div', { class: 'ch13-th', 'aria-hidden': 'true' }, h('span', {}, 'Smallest first ↓'), KEYS.map((key) => h('span', {}, REQ[key][ctx.narrow ? 1 : 0]))), trs),  // the fit table: the column titles, then the five candidate rows
            h('div', { class: 'xs muted', html: '✓ met · ! met only with care · ✗ not met; memory needs are rough typical figures. <b>Why the smallest?</b> Every extra feature costs memory, energy and testing, and is one more thing that can fail.' }),  // the key to the table's marks, and why designers choose the smallest fit
            h('div', { class: 'card white stack', style: { gap: '6px', padding: '9px 13px', flex: 'none' } }, whyHead, whyList))));  // the reasons card, which never shrinks; ends the layout
        paint();  // draws the step when it opens
      },  // ends render() for step 2
    },  // closes step 2
  ],  // closes the chapter's steps list
  notes: `${/* notes: the chapter 13 summary shown in the Notes drawer on the overview steps and in the printed guide */''}
    <h3>How Chapter 13 fits together</h3>${/* notes heading: how chapter 13 fits together */''}
    <p>Most computers are not desktops or phones but small processors built into products, each doing one job. The overview’s farm hides seven of them, running four kinds of software: no OS at all (a greenhouse thermostat and a gate remote, each a super loop), a small RTOS (a pump controller and a tractor’s engine controller, both with hard deadlines), embedded Linux (a barn gateway and a cab display, which need big ready-made software) and a TinyOS-style sensor OS (soil motes that must last years on two AA cells). The rule behind every choice: use the smallest system software that meets every requirement, because each extra feature costs memory, energy and testing.</p>${/* notes paragraph: the overview farm, its four kinds of software and the smallest-fit rule */''}
    <h4>Embedded systems (13.1)</h4>${/* notes heading: embedded systems (section 13.1) */''}
    <p>An embedded system combines hardware, software and often mechanical parts to perform one dedicated function, usually inside a larger product, and such systems far outnumber general-purpose computers. Requirements range widely in cost, safety, reliability, timing, lifetime and environment. Sensors and actuators, A/D and D/A converters, a human interface, a diagnostic port and sometimes an FPGA or ASIC surround the processor and close a feedback loop with the physical world. A microcontroller puts processor, flash, RAM, clock and I/O on one cheap, frugal chip.</p>${/* notes paragraph: definition, requirements, elements and microcontrollers */''}
    <h4>Embedded operating systems (13.2)</h4>${/* notes heading: embedded operating systems (section 13.2) */''}
    <p>An embedded OS is set apart by real-time and reactive operation, configurability, I/O device flexibility, streamlined protection and direct use of interrupts. One road adapts a general-purpose OS such as Linux (rich and familiar, but larger and less predictable); the other is a purpose-built RTOS with fast switching, bounded interrupt latency, small size, fixed memory pools and timeouts.</p>${/* notes paragraph: the six traits and the two roads to an embedded OS */''}
    <h4>Embedded Linux (13.3)</h4>${/* notes heading: embedded Linux (section 13.3) */''}
    <p>An embedded distribution keeps only one device’s drivers and programs, is cross-compiled with tools such as Buildroot or the Yocto Project, often saves space with a small C library (musl, uClibc-ng) and BusyBox (some keep glibc), and stores its files on flash with squashfs, JFFS2 or UBIFS. Android is the largest embedded Linux; without an MMU (µClinux, mainline since 2.6) programs start others with vfork() instead of fork().</p>${/* notes paragraph: what makes a Linux distribution embedded */''}
    <h4>TinyOS (13.4)</h4>${/* notes heading: TinyOS (section 13.4) */''}
    <p>Motes have kilobytes of RAM and run for months or years on batteries. TinyOS compiles one image from nesC components wired through interfaces of commands and events. Tasks wait in a FIFO queue and run to completion, interrupts may preempt them, long operations are split-phase, and the processor sleeps whenever the queue is empty.</p>${/* notes paragraph: motes and the TinyOS component and task model */''}
    <h4>Why it matters</h4>${/* notes heading: why it matters */''}
    <p>Embedded systems gather the whole guide under tight limits: chapter 10’s deadlines, chapter 11’s interrupts and devices and chapter 12’s files on flash all return, cut down to fit one job.</p>`,  // notes paragraph: every earlier idea returns on embedded devices; end of the notes text
});  // ends chapter 13
