// Comment key: a line inside backtick text ends with ${/* comment */''}, an empty-string slot that holds a comment without changing the text on screen (full note at the top of the page).
/* =====================================================================
   Section 9.3 — Traditional UNIX Scheduling
   Priority numbers (lower = better), the priority bands, the once-a-second
   formula with a decaying CPU count, a second-by-second trace of three
   processor-bound processes, and an experiment with nice values and an
   I/O-bound newcomer. One simulation engine (UNIX_SIM) drives every
   number on screen; dev/qa-9.3/trace.test.mjs runs the same code.
   ===================================================================== */
(() => {  // wraps the whole section in a function that runs once, right away, so its names stay private to this section
  /* ------------------------------------------------------------------
     Model constants shared by every step
     ------------------------------------------------------------------ */
  const HZ = 60;            // clock ticks per second in the classic example
  const USER_TOP = 60;      // best (smallest) priority number in the user band, in this model
  const PMAX = 127;         // worst priority number in the classic 0..127 range
  const PCOL = { A: 'pa', B: 'pb', C: 'pc', D: 'pd' };   // CSS color class per process name

  /*ENGINE-START*/
  /* prioOf(p, count): the once-a-second priority formula.
     P = Base + CPU/2 + nice, whole-number division, kept inside the user band. */
  function prioOf(p, count) {  // prioOf(p, count): turns a process's halved CPU count into its priority number; every step and the simulation call it
    const raw = p.base + Math.floor(count / 2) + p.nice;  // raw: base priority + half the count (rounded down by Math.floor) + nice, the formula before any limit is applied
    return Math.min(PMAX, Math.max(USER_TOP, raw));  // keeps the number inside the user band: never smaller than 60 (USER_TOP) and never bigger than 127 (PMAX)
  }  // ends prioOf

  /* simulate(procs, seconds): the traditional UNIX scheduler, one clock tick at a time.
     procs[j] = { name, base, nice, start (second it is created, default 0),
                  io (optional) = { burst, wait }: run `burst` ticks, then sleep `wait` ticks }.
     Rules: every tick the running process's count goes up by 1; at each whole second every
     count is halved, every priority recomputed, the running process is preempted and the
     smallest priority number is dispatched (ties: the one that has waited longest, then
     creation order). A process that wakes from sleep preempts the runner only if its
     number is strictly smaller. rows[t] describes second t: the values at its start,
     who was picked, the owner of each of its 60 ticks and each count at its end.
     waits[j]: for each answered keystroke, the ticks it spent ready but not running between
     the key's arrival (the wake-up) and the end of its burst, including any wait after the
     burst was cut by a whole-second preemption. */
  function simulate(procs, seconds) {  // simulate(procs, seconds): runs the scheduler one clock tick at a time and returns everything the steps draw and quote
    const P = procs.map((p, j) => ({ name: p.name, base: p.base, nice: p.nice, start: p.start || 0, io: p.io || null,  // P: a working copy of each process's settings; a missing start means second 0, a missing io means processor-bound
      j, alive: false, count: 0, prio: 0, asleep: false, wake: -1, left: 0, since: 0, wokeAt: -1, lag: 0 }));  // plus its index j and live state: created yet, count, number, asleep, wake-up tick, ticks left in its burst, waiting-since tick, keystroke timing
    const rows = [], used = P.map(() => 0), waits = P.map(() => []);  // rows: one record per second; used: total ticks each process ran; waits: each process's list of keystroke waiting times
    let run = -1;  // run: the index of the process holding the processor; -1 means nobody (the processor is idle or a choice is due)
    const ready = (p) => p.alive && !p.asleep && p.j !== run;  // ready(p): true when p has been created, is awake and is not the process running right now
    const beats = (a, b) => (a.prio !== b.prio ? a.prio < b.prio : a.since !== b.since ? a.since < b.since : a.j < b.j);  // beats(a, b): true when a should be picked over b: the smaller number wins, then the one waiting longer, then the one created first
    const bestReady = () => P.filter(ready).reduce((b, p) => (!b || beats(p, b) ? p : b), null);  // bestReady(): scans the ready processes and keeps the one that beats every other, or null when nobody is ready
    const dispatch = (g) => {  // dispatch(g): gives the processor to the best ready process (g, the current tick, is passed in but not used)
      const b = bestReady();  // b: the winner, if there is one
      run = b ? b.j : -1;  // run becomes the winner's index, or -1 so the processor idles when nobody is ready
    };  // ends dispatch
    for (let g = 0; g < seconds * HZ; g++) {  // the main loop: g counts clock ticks from 0, 60 per simulated second, until the requested number of seconds is done
      const t = Math.floor(g / HZ), k = g % HZ;  // t: the second this tick belongs to; k: the tick's position inside that second (0 to 59), using whole-number division and remainder
      if (k === 0) P.forEach((p) => {  // on the first tick of every second, checks each process to see if it is created now
        if (!p.alive && p.start === t) { p.alive = true; p.since = g; p.left = p.io ? p.io.burst : 0; }  // a process whose start second has come is created: it begins waiting now, and an I/O-bound one gets its first burst of work
      });  // ends the creation check
      let woke = false;  // woke records whether any sleeping process wakes up on this tick
      P.forEach((p) => { if (p.alive && p.asleep && p.wake === g) { p.asleep = false; p.since = g; p.wokeAt = g; p.lag = 0; p.left = p.io.burst; woke = true; } });  // wakes each sleeper whose alarm tick is now: it becomes ready, starts timing a new keystroke (wokeAt, lag 0) and gets a fresh burst
      if (k === 0) {  // the once-a-second work, done on the first tick of every second
        P.forEach((p) => { if (!p.alive) return; if (t > 0) p.count = Math.floor(p.count / 2); p.prio = prioOf(p, p.count); });  // halves every live process's count (except at t = 0, when they are new) and recomputes its priority number with prioOf
        if (run >= 0) { P[run].since = g; run = -1; }  // one-second preemption: the running process loses the processor and counts as waiting from this tick
        dispatch(g);  // picks the best ready process for the new second
        rows.push({ t, pick: run, ticks: [], vals: P.map((p) => ({ count: p.count, prio: p.prio, since: p.since,  // saves the record for second t: who was picked, an empty list for its 60 tick owners, and each process's count, number, waiting-since tick
          state: !p.alive ? 'none' : p.j === run ? 'run' : p.asleep ? 'sleep' : 'ready' })) });  // and its state at the start of the second: not created yet, running, asleep or ready
      } else if (woke && run >= 0) {  // in the middle of a second, a wake-up matters only if some process is running
        const b = bestReady();  // b: the best process now ready, which may be the one that just woke
        if (b && b.prio < P[run].prio) { P[run].since = g; run = -1; dispatch(g); }  // it takes over only with a strictly smaller number: the runner goes back to waiting and a fresh choice is made
      }  // ends the mid-second wake-up check
      if (run < 0) dispatch(g);  // if nobody holds the processor (the runner just went to sleep, or nothing was ready), tries to pick someone now
      const row = rows[t];  // row: the record for the current second
      row.ticks.push(run);  // notes who owns this tick (-1 means idle); the tick-by-tick drawing in step 6 reads this list
      P.forEach((p) => { if (p.wokeAt >= 0 && p.j !== run) p.lag++; });  // every process with an unanswered keystroke that is not running this tick waits one more tick (lag)
      if (run >= 0) {  // the rest of the tick happens only if some process is running
        const p = P[run];  // p: the running process
        p.count++; used[run]++;  // the tick is charged to it: its CPU count and its total ticks used both go up by 1
        if (p.io && --p.left === 0) { if (p.wokeAt >= 0) { waits[run].push(p.lag); p.wokeAt = -1; } p.asleep = true; p.wake = g + 1 + p.io.wait; p.since = g + 1; run = -1; }  // an I/O-bound process that finishes its burst records its keystroke's wait, sleeps until its next key and frees the processor
      }  // ends the running-process work
      if (k === HZ - 1) row.vals.forEach((v, j) => { v.end = P[j].count; v.ran = row.ticks.filter((x) => x === j).length; });  // on the last tick of a second, stores each process's count at the end and how many ticks it ran during that second
    }  // ends the tick loop
    /* pending[j]: waiting ticks of a keystroke still unfinished when the run ends (-1 = none). */
    const pending = P.map((p) => (p.wokeAt >= 0 ? p.lag : -1));  // pending: for each process, how long its still-unanswered keystroke has waited, or -1 if it has none
    return { rows, used, waits, pending, names: P.map((p) => p.name) };  // returns the per-second rows, the ticks used, the keystroke waits, the pending waits and the process names
  }  // ends simulate
  const UNIX_SIM = { simulate, prioOf, HZ, USER_TOP, PMAX };  // UNIX_SIM: packs the engine and its constants into one object that the steps call
  /*ENGINE-END*/

  /* ------------------------------------------------------------------
     Small UI helpers
     ------------------------------------------------------------------ */
  function say(box, kind, head, html) {  // say(box, kind, head, html): fills a message box with an optional heading and some HTML, colored by kind
    box.className = 'msg ' + (kind || '');  // sets the box's classes: msg plus ok, bad or info, which pick its border and background color
    box.innerHTML = (head ? `<b class="h">${head}</b>` : '') + html;  // writes the heading in bold (if there is one) followed by the message HTML
  }  // ends say
  /* hot(el, fn): make an SVG group or div behave like a button (click, Enter, Space). */
  function hot(el, fn, label) {  // starts hot: label, if given, is the name a screen reader announces for the element
    el.setAttribute('role', 'button');  // role button tells screen readers the element acts like a button
    el.setAttribute('tabindex', '0');  // tabindex 0 lets the Tab key reach it
    if (label) el.setAttribute('aria-label', label);  // sets the spoken name only when a label was supplied
    el.addEventListener('click', fn);  // a mouse click runs fn
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } });  // Enter or Space also runs fn; preventDefault stops Space from scrolling the page
    return el;  // returns the element so the call can be used inline
  }  // ends hot
  const pchip = (n) => `<span class="pchip ${PCOL[n]}">${n}</span>`;  // pchip(n): HTML for a small chip showing a process letter in that process's color; captions, tables and buttons use it
  /* The three processor-bound processes of the classic example, plus the optional I/O-bound D. */
  const ABC = () => ['A', 'B', 'C'].map((name) => ({ name, base: 60, nice: 0 }));  // ABC(): fresh copies of A, B and C, each with base 60 and nice 0, no I/O and created at second 0
  const listOf = (a) => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);  // listOf(a): joins names as readable English: "A", "A and B" or "A, B and C"
  const secs = (tick) => (tick % HZ ? (tick / HZ).toFixed(2) : String(tick / HZ));  // secs(tick): turns a tick number into seconds for captions: a whole second stays plain ("3"), anything else gets two decimals

  /* arith(sim, procs, t, j): the once-a-second arithmetic for process j at second t, as HTML. */
  function arith(sim, procs, t, j) {  // starts arith, which builds the worked formula shown in the arithmetic panels and quiz feedback
    const v = sim.rows[t].vals[j], p = procs[j];  // v: process j's values at the start of second t; p: its settings, for the base and nice value
    if (v.state === 'none') return 'not created yet';  // a process that does not exist yet gets a short note instead of numbers
    const nice = p.nice ? ` + ${p.nice}` : ' + 0';  // nice: the "+ nice" part of the sum, written as "+ 0" when the nice value is 0
    if (t === 0 || sim.rows[t - 1].vals[j].state === 'none') return `new: count 0 · P = ${p.base} + 0${nice} = <b>${v.prio}</b>`;  // a process created at this second starts with count 0, so its number is simply base + 0 + nice
    const before = sim.rows[t - 1].vals[j].end;  // before: its count at the end of the previous second, before this second's halving
    return `⌊${before}/2⌋ = ${v.count} · P = ${p.base} + ${Math.floor(v.count / 2)}${nice} = <b>${v.prio}</b>`;  // shows the halving (the ⌊ ⌋ brackets mean round down), then the sum, with the resulting number in bold
  }  // ends arith
  /* whyPick(sim, t): one sentence on why the scheduler picked the process it did at second t. */
  function whyPick(sim, t) {  // starts whyPick, used under the trace tables, in captions and in feedback
    const row = sim.rows[t];  // row: the record for second t
    const cands = row.vals.map((v, j) => ({ v, j })).filter(({ v }) => v.state === 'ready' || v.state === 'run');  // cands: the processes competing at second t, that is every one ready or picked (sleepers and uncreated ones are left out)
    if (!cands.length) return 'Nobody is ready, so the processor idles.';  // no candidates means the processor has nothing to run
    const min = Math.min(...cands.map(({ v }) => v.prio));  // min: the smallest priority number among the candidates
    const tied = cands.filter(({ v }) => v.prio === min);  // tied: every candidate holding that smallest number
    const who = sim.names[row.pick];  // who: the name of the process the simulation actually picked
    if (tied.length === 1) return `The smallest number is ${min}, so ${pchip(who)} runs.`;  // a single smallest number gets a one-line reason
    const names = listOf(tied.map(({ j }) => pchip(sim.names[j])));  // names: the tied processes as chips in a readable list
    const oldest = Math.min(...tied.map(({ v }) => v.since));  // oldest: the earliest tick at which any tied process began waiting
    const same = tied.filter(({ v }) => v.since === oldest).length > 1;  // same: true when two or more tied processes began waiting at that same tick, so creation order must decide
    return `${names} tie at ${min}. Ties go to the process that has waited longest` +  // starts the tie explanation with the rule: the longest waiter wins
      (same ? `; they have ${tied.length > 2 ? 'all' : 'both'} waited since t = ${secs(oldest)}, so the one created first, ${pchip(who)}, runs.` : `: ${pchip(who)} has waited since t = ${secs(row.vals[row.pick].since)}, so it runs.`);  // finishes it one of two ways: equal waits go to the one created first, otherwise it names the longest waiter and when it began waiting
  }  // ends whyPick

  /* drawRun(ctx, svg, sim): every second as one row: who held each of its 60 ticks,
     then each process's priority number at the start of that second (the pick in bold). */
  const RUN_WIDE = { x0: 44, tw: 8, rh: 24, top: 28, pc: 556, pw: 50, head: 'who held the processor, tick by tick (60 per second)' };  // RUN_WIDE: wide-screen layout for the step 6 chart: tick bar start, 8 units per tick, row height, top margin, priority columns, heading
  /* Small screens: 3 units per tick instead of 8, so the whole drawing is about as wide as the phone and its labels stay readable. */
  const RUN_SLIM = { x0: 22, tw: 3, rh: 24, top: 28, pc: 224, pw: 28, head: 'who ran, tick by tick' };  // RUN_SLIM: the same layout for a small screen, with the priority columns closer together and a shorter heading
  function drawRun(ctx, svg, sim) {  // starts drawRun, which redraws the step 6 chart every time the experiment's settings change
    const RUN = ctx.narrow ? RUN_SLIM : RUN_WIDE;  // picks the layout: the shell's phone-width flag selects the slim one
    const { s } = ctx, n = sim.names.length, R = sim.rows.length;  // s: the SVG builder (SVG is the browser's drawing format); n: how many processes; R: how many seconds were simulated
    const W = RUN.pc + (n - 0.5) * RUN.pw + 10, H = RUN.top + R * RUN.rh + 4;  // W and H: the drawing's total width (just past the last priority column) and height (one row per second)
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);  // viewBox sets the drawing's coordinate system to W by H units, so it scales to fit its box
    const out = [  // out: the list of shapes and labels to draw, starting with the header row
      s('text', { x: 4, y: 18, 'font-size': 13, 'font-weight': 800, class: 's-sub' }, 't'),  // header: "t" above the column of second numbers
      s('text', { x: RUN.x0, y: 18, 'font-size': 13, 'font-weight': 800, class: 's-sub' }, RUN.head),  // header: the label above the tick bars
      ...sim.names.map((nm, j) => s('text', { x: RUN.pc + j * RUN.pw, y: 18, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, class: 's-sub' }, 'P' + nm)),  // header: one column label per process (PA, PB ...) above its priority numbers
    ];  // closes the header list
    sim.rows.forEach((row, t) => {  // one row of the chart for each simulated second
      const y = RUN.top + t * RUN.rh;  // y: the top edge of this second's row
      out.push(s('text', { x: 4, y: y + 15, 'font-size': 14, 'font-weight': 700 }, String(t)));  // the second's number at the left edge
      out.push(s('rect', { x: RUN.x0, y: y + 1, width: HZ * RUN.tw, height: 19, rx: 3, class: 's-panel' }));  // a plain background bar 60 ticks long; idle ticks leave it showing through
      for (let k = 0; k < row.ticks.length;) {  // walks along the second's 60 ticks, one stretch at a time, where a stretch is a run of ticks owned by the same process
        const who = row.ticks[k]; let e = k;  // who: the owner of tick k; e will find where that owner's stretch ends
        while (e < row.ticks.length && row.ticks[e] === who) e++;  // moves e forward while the same owner keeps the processor
        if (who >= 0) {  // draws a stretch only if a process owns it (-1 means idle, which stays blank)
          const nm = sim.names[who], x = RUN.x0 + k * RUN.tw, w = (e - k) * RUN.tw;  // nm: the owner's name; x: where its stretch starts; w: how wide the stretch is
          out.push(s('rect', { x, y: y + 1, width: w, height: 19, class: 'tk ' + PCOL[nm] }));  // a bar for the stretch, filled with the owner's color through the tk class and its PCOL class
          if (w >= 16) out.push(s('text', { x: x + w / 2, y: y + 15, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 800 }, nm));  // writes the process letter inside the bar when it is at least 16 units wide, wide enough to read
        }  // ends the owned-stretch case
        k = e;  // jumps to the start of the next stretch
      }  // ends the walk along the ticks
      row.vals.forEach((v, j) => {  // then one priority number per process, as it stood at the start of the second
        const pick = j === row.pick;  // pick: true for the process the scheduler chose this second
        out.push(s('text', { x: RUN.pc + j * RUN.pw, y: y + 15, 'text-anchor': 'middle', 'font-size': 14,  // the number goes in that process's column, centered
          'font-weight': pick ? 800 : 500, class: v.state === 'none' || v.state === 'sleep' ? 's-sub' : '',  // the chosen one is bold; processes asleep or not yet created are grey
          style: pick ? 'fill:var(--accent);text-decoration:underline' : null }, v.state === 'none' ? '–' : String(v.prio)));  // the chosen one is also accent-colored and underlined; a dash stands in for a process not created yet
      });  // ends the per-process numbers
    });  // ends the per-second rows
    svg.replaceChildren(...out);  // replaces the chart's old contents with the new shapes in one go
  }  // ends drawRun

  /* Numbers quoted in the study notes, computed by the same engine as the steps. */
  const NOTE = (() => {  // NOTE: a function that runs once, when the page loads, and works out every number the notes quote
    const sim = simulate(ABC(), 9);  // sim: the classic run of A, B and C for 9 seconds
    const trace = '<table><tr><th>t</th><th>A count / P</th><th>B count / P</th><th>C count / P</th><th>Runs</th></tr>' +  // trace: an HTML table for the notes, starting with its header row
      sim.rows.map((r) => `<tr><td>${r.t}</td>${r.vals.map((v) => `<td>${v.count} / ${v.prio}</td>`).join('')}<td>${sim.names[r.pick]}</td></tr>`).join('') + '</table>';  // then one row per second with each process's count and number and the one that ran
    const withD = (nice, io) => {  // withD(nice, io): runs A, B and C plus the editor D (created at t = 3 with this nice and burst pattern) for 10 seconds and sums up D
      const s = simulate([...ABC(), { name: 'D', base: 60, nice, start: 3, io }], 10), w = s.waits[3];  // s: that run; w: D's list of keystroke waits (D is process number 3, counting from 0)
      const live = s.rows.filter((r) => r.vals[3].state !== 'none');  // live: the seconds in which D exists
      return { used: s.used[3], n: w.length, avg: w.length ? w.reduce((a, b) => a + b, 0) / w.length : 0, max: w.length ? Math.max(...w) : 0,  // returns D's ticks used, its number of answered keys, and its average and worst wait in ticks
        cnt: Math.max(...live.map((r) => r.vals[3].count)), p: Math.max(...live.map((r) => r.vals[3].prio)) };  // plus the highest count and the highest priority number D reached
    };  // ends withD
    const shareA = (nice) => { const s = simulate([{ name: 'A', base: 60, nice }, ...ABC().slice(1)], 30); return Math.round((s.used[0] / (30 * HZ)) * 100); };  // shareA(nice): runs A with this nice value beside B and C for 30 seconds and returns A's share of the processor as a whole percent
    return { trace, light: withD(0, { burst: 2, wait: 23 }), nice2: withD(2, { burst: 2, wait: 23 }), nice5: withD(5, { burst: 2, wait: 23 }),  // the numbers the notes use: the trace table, then D with 2-tick bursts at nice 0, +2 and +5
      heavy: withD(0, { burst: 12, wait: 21 }), a6: shareA(6), a10: shareA(10) };  // then D with 12-tick bursts, and A's share at nice +6 and at nice +10
  })();  // ends the function and runs it at once, so NOTE holds the finished numbers

  Guide.section({  // registers this section with the guide's shell, which builds its pages, glossary and quiz from the object below
    id: '9.3',  // id: the section number used in links, saved progress and CSS class names (sec-9-3)
    title: 'Traditional UNIX Scheduling',  // title shown at the top of every step in this section
    short: 'UNIX scheduling',  // short name used in the table of contents where space is tight
    summary: 'Classic UNIX priority numbers climb with recent processor use and fade back while a process waits.',  // one-sentence summary shown on the chapter overview page
    objectives: [  // objectives: what a student should be able to do after this section, listed on the overview
      'Explain what the traditional UNIX scheduler was built for, and describe its structure: priority queues with round robin inside each and one-second preemption.',  // objective 1: what the scheduler was for, and its structure of queues, round robin and one-second preemption
      'Compute a process’s CPU count and priority with the once-a-second formula, including the nice value and whole-number division.',  // objective 2: compute the count and the priority number with the formula, nice and whole-number division
      'Name the priority bands from highest to lowest and explain why work that drives I/O devices sits above ordinary user processes.',  // objective 3: the bands in order, and why device work outranks user work
      'Trace several processes second by second and predict which one the scheduler picks next.',  // objective 4: trace processes second by second and predict the next pick
      'Explain why a decaying usage count gives I/O-bound processes quick service and keeps busy jobs of equal nice value from starving, and why a large nice value can still starve a job.',  // objective 5: why decay helps I/O-bound work and stops equal jobs starving, and why a large nice value still can starve one
    ],  // closes the objectives list
    terms: [  // terms: glossary entries as [term, definition] pairs; the shell links these words wherever they appear
      ['Priority number', 'In UNIX, a process’s priority written as a number in which a LOWER number means a HIGHER priority. The scheduler runs the ready process with the smallest number.'],  // glossary entry: defines a priority number, where a smaller number means more urgent
      ['Multilevel feedback queue', 'A scheduler with several ready queues, one per priority level. It always serves the best non-empty queue, and a process moves between queues according to how it has behaved recently.'],  // glossary entry: defines a multilevel feedback queue, one ready queue per level with processes moving between them
      ['One-second preemption', 'The traditional UNIX rule that a process that has run for a whole second without blocking or finishing is preempted, so the scheduler can make a fresh choice.'],  // glossary entry: defines one-second preemption
      ['Clock tick', 'One interrupt from the hardware timer. In the classic UNIX example the clock ticks 60 times a second, and each tick adds 1 to the running process’s CPU count.'],  // glossary entry: defines a clock tick, 60 a second in the classic example
      ['CPU count', 'A per-process number, written CPU_j, that measures recent processor use. It goes up by 1 on every clock tick the process runs and is halved once a second, so old use fades.'],  // glossary entry: defines the CPU count, which grows by 1 per tick of running and is halved every second
      ['Usage decay', 'Shrinking a usage count step by step (here, halving it every second) so that recent processor use weighs much more than use from long ago.'],  // glossary entry: defines usage decay
      ['Base priority', 'The fixed starting priority number of a process, written Base_j. It places the process in a priority band; the CPU and nice terms are added on top of it.'],  // glossary entry: defines the base priority, which picks a process's band
      ['Nice value', 'A number added to a process’s priority so it can be “nice” to other processes. An ordinary user can only raise it (making the process less urgent); only the superuser can lower it.'],  // glossary entry: defines the nice value and who may raise or lower it
      ['Superuser', 'The all-powerful administrator account on a UNIX system (usually named root), which may override the limits placed on ordinary users.'],  // glossary entry: defines the superuser (the root account)
      ['Priority band', 'A fixed range of priority numbers set aside for one kind of work. A process’s base priority picks its band, and its priority is kept inside that band.'],  // glossary entry: defines a priority band
      ['Block I/O device', 'A device that stores and moves data in fixed-size blocks that can be addressed one by one, such as a disk.'],  // glossary entry: defines a block I/O device, such as a disk
      ['Character I/O device', 'A device that sends or receives data as a stream of single characters, such as a terminal’s keyboard and screen.'],  // glossary entry: defines a character I/O device, such as a terminal
      ['Interactive process', 'A process that works with a person in real time, such as a shell or a text editor. What matters most for it is how quickly it reacts to each keystroke or command.'],  // glossary entry: defines an interactive process, for which reaction time matters most
      ['I/O-bound process', 'A process that spends most of its time waiting for input or output and uses the processor only in short bursts.'],  // glossary entry: defines an I/O-bound process
      ['Processor-bound process', 'A process that mostly computes, using the processor for long stretches with little I/O. Also called CPU-bound.'],  // glossary entry: defines a processor-bound (CPU-bound) process
    ],  // closes the terms list

    css: ` /* css: style rules for this section only; every rule starts with .sec-9-3 so it cannot affect other sections */
      .sec-9-3 .pa { --pc: var(--proc); --pb: color-mix(in srgb, var(--proc) 14%, var(--panel)); } /* process A's colors: teal outline (--pc) and a light fill (--pb, 14% teal mixed into the panel color) that chips, bars and cells read */
      .sec-9-3 .pb { --pc: var(--proc); --pb: color-mix(in srgb, var(--proc) 36%, var(--panel)); } /* process B: the same teal outline with a medium fill (36% teal), so B looks a shade darker than A */
      .sec-9-3 .pc { --pc: var(--proc); --pb: color-mix(in srgb, var(--proc) 58%, var(--panel)); } /* process C: the darkest teal fill (58%), so A, B and C are told apart by shade */
      .sec-9-3 .pd { --pc: var(--io); --pb: var(--io-bg); } /* process D, the I/O-bound editor, uses the orange I/O colors so it stands out from the three busy processes */
      .sec-9-3 .pchip { display: inline-flex; align-items: center; justify-content: center; min-width: 26px; height: 24px; padding: 0 7px; /* .pchip: the small process badge, a centered letter in a box at least 26 by 24 pixels */
        border-radius: 7px; border: 2px solid var(--pc); background: var(--pb); color: var(--ink); font-weight: 800; font-size: 14px; } /* rounded corners, an outline and fill in the process's own colors, and bold text */
      .sec-9-3 .msg { border-radius: 10px; padding: 9px 12px; background: var(--panel-2); border: 1px solid var(--line); font-size: 15px; line-height: 1.45; } /* .msg: the message box for explanations and feedback, a rounded padded panel with a thin border */
      .sec-9-3 .msg.ok { border-color: var(--ok); background: var(--ok-bg); } /* an ok message gets a green border and a pale green fill */
      .sec-9-3 .msg.bad { border-color: var(--bad); background: var(--bad-bg); } /* a bad message gets a red border and a pale red fill */
      .sec-9-3 .msg.info { border-color: var(--accent); background: var(--accent-bg); } /* an info message gets the accent indigo border and fill */
      .sec-9-3 .msg b.h { display: block; font-size: 13px; letter-spacing: .06em; text-transform: uppercase; margin-bottom: 2px; } /* the message heading sits on its own line in small, spaced-out capital letters */
      .sec-9-3 .msg.ok b.h { color: var(--ok); } /* the heading is green in an ok message */
      .sec-9-3 .msg.bad b.h { color: var(--bad); } /* red in a bad message */
      .sec-9-3 .msg.info b.h { color: var(--accent); } /* accent-colored in an info message */
      .sec-9-3 svg .nd { cursor: pointer; } /* the clickable stages of the step 1 cycle drawing show a pointing-hand cursor */
      .sec-9-3 svg .nd rect { stroke-width: 2; transition: stroke-width .15s; } /* each stage's box has a 2-unit outline that thickens smoothly over 0.15 seconds */
      .sec-9-3 svg .nd:hover rect { stroke-width: 3.2; } /* hovering a stage thickens its outline a little, a hint that it can be clicked */
      .sec-9-3 svg .nd.on rect { stroke-width: 4.5; } /* the selected stage (class on) gets the thickest outline */
      .sec-9-3 svg .nd text { pointer-events: none; } /* labels inside a stage ignore the mouse, so a click on the words still reaches the stage */
      .sec-9-3 .ladder { display: grid; grid-template-columns: 96px minmax(0, 1fr); gap: 10px; } /* .ladder: step 2's band ladder, a 96-pixel axis column beside the column of band buttons */
      .sec-9-3 .ladder .axis { position: relative; display: flex; flex-direction: column; justify-content: space-between; text-align: right; /* the axis: its two labels pushed to the top and the bottom, right-aligned */
        font-size: 12.5px; font-weight: 700; line-height: 1.25; color: var(--muted); padding: 14px 12px 0 0; border-right: 3px solid var(--line-2); } /* in small bold grey text, with a thick line down its right edge */
      .sec-9-3 .ladder .axis::before { content: ''; position: absolute; top: -2px; right: -9px; border: 7.5px solid transparent; border-bottom: 11px solid var(--line-2); border-top: 0; } /* an upward arrowhead made from CSS borders sits on top of that line, pointing toward higher priority */
      .sec-9-3 .band { display: flex; align-items: center; gap: 10px; width: 100%; height: 54px; padding: 0 12px; border-radius: 10px; /* .band: one band button, a full-width row 54 pixels tall holding the rank badge and the band's name */
        border: 2px solid var(--line-2); background: var(--panel); color: var(--ink); font-size: 15.5px; font-weight: 750; cursor: pointer; text-align: left; } /* a neutral outline and fill, bold text, a pointer cursor and left-aligned text */
      .sec-9-3 .band .rank { flex: none; width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center; font-size: 13px; /* .rank: the round number badge (1 to 5) at the left of each band button */
        background: var(--panel); border: 1.5px solid var(--line-2); } /* its own panel fill and thin outline, so it shows up on every band color */
      .sec-9-3 .band.os { border-color: var(--os); background: var(--os-bg); } /* the swapper band in the purple operating-system colors */
      .sec-9-3 .band.io { border-color: var(--io); background: var(--io-bg); } /* the two device bands in the orange I/O colors */
      .sec-9-3 .band.mem { border-color: var(--mem); background: var(--mem-bg); } /* the file manipulation band in the green memory colors */
      .sec-9-3 .band.proc { border-color: var(--proc); background: var(--proc-bg); } /* the user band in the teal process colors */
      .sec-9-3 .band:hover { filter: brightness(1.04); } /* hovering a band brightens it slightly */
      .sec-9-3 .band.on { outline: 3px solid var(--accent); outline-offset: 2px; } /* the selected band gets a thick accent outline drawn just outside its edge */
      .sec-9-3 .qcard.hit { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent-bg); } /* the user-band queue card lights up with an accent border and glow while the user band is selected */
      .sec-9-3 .lvrow { display: grid; grid-template-columns: 74px minmax(0, 1fr) auto; align-items: center; gap: 10px; padding: 5px 10px; /* .lvrow: one queue row in that card: the priority number, the process chips and a short label */
        border-radius: 9px; border: 1px solid var(--line); background: var(--panel); min-height: 38px; } /* rounded and outlined, at least 38 pixels tall so the rows keep their height */
      .sec-9-3 .lvrow.best { border-color: var(--ok); background: var(--ok-bg); } /* the best queue, the one being served, is green */
      .sec-9-3 .lvrow .lv { font-weight: 800; font-size: 14.5px; } /* the queue's priority number in bold */
      .sec-9-3 .formula { font-size: 18px; line-height: 1.55; } /* .formula: step 3's formula card, in large text with roomy lines */
      .sec-9-3 .formula sub { font-size: 12.5px; } /* the subscripts (the j and the i) are a little smaller */
      .sec-9-3 .work .wline { display: grid; grid-template-columns: 96px minmax(0, 1fr); gap: 10px; align-items: baseline; font-size: 15px; } /* .wline: one line of step 3's worked arithmetic: a 96-pixel label column, then the working */
      .sec-9-3 .work .wk { font-size: 12.5px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; color: var(--muted); } /* .wk: the small grey capital labels (1 · halve, 2 · priority, 3 · band) */
      .sec-9-3 .work .mono { font-size: 14.5px; } /* the arithmetic itself is slightly smaller than the surrounding text */
      .sec-9-3 table.trace th, .sec-9-3 table.trace td { text-align: center; vertical-align: middle; } /* trace table cells are centered both across and down */
      .sec-9-3 table.trace td { font-size: 15px; height: 33px; } /* trace table body cells: 15-pixel text and a fixed height, so a row does not jump when an end count appears */
      .sec-9-3 .tline { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 3px 4px; } /* .tline: step 4's "who held the processor" strip, six equal columns, one per second */
      .sec-9-3 .tline .tcell { height: 32px; border-radius: 7px; border: 2px solid var(--pc); background: var(--pb); display: grid; place-items: center; font-weight: 800; font-size: 15px; } /* .tcell: one second's cell, in the running process's outline and fill colors with its letter centered in bold */
      .sec-9-3 .tline .tcell.now { outline: 3px solid var(--accent); outline-offset: 1px; } /* the current second's cell gets an accent outline */
      .sec-9-3 .tline .tcell.fut { border: 2px dashed var(--line-2); background: transparent; color: var(--muted); } /* seconds not reached yet are dashed empty boxes with a grey question mark */
      .sec-9-3 .rules ul { padding-left: 18px; } /* indents the list of rules in step 4 */
      .sec-9-3 .rules li { margin: 1px 0; } /* keeps the rules close together */
      .sec-9-3 table.trace td.runc { background: var(--cpu-bg); } /* the cells of the process running that second get the pale CPU-blue fill */
      .sec-9-3 table.trace tr.on td { box-shadow: inset 0 2px 0 var(--accent), inset 0 -2px 0 var(--accent); } /* the current second's row gets accent lines along its top and bottom */
      .sec-9-3 table.trace tr.fut td { color: var(--muted); } /* rows not revealed yet are grey */
      .sec-9-3 table.trace .up { color: var(--cpu); font-size: 12.5px; font-weight: 800; margin-left: 5px; } /* .up: the small "→ end count" note beside a count, in CPU blue */
      .sec-9-3 table.trace.slim { display: table; } /* small screens: keeps the trace table a real table, overriding the shell rule that makes tables scroll sideways in their own box */
      .sec-9-3 table.trace.slim th, .sec-9-3 table.trace.slim td { padding: 4px 2px; font-size: 13.5px; } /* small screens: tighter padding and smaller text so all eight columns fit on a phone */
      .sec-9-3 table.trace.slim .up { display: block; margin-left: 0; } /* small screens: the end count moves onto its own line under the count */
      .sec-9-3 .aline { display: grid; grid-template-columns: 34px minmax(0, 1fr); align-items: center; gap: 8px; padding: 5px 9px; /* .aline: one line of worked arithmetic in steps 4 and 5: a 34-pixel chip column, then the working */
        border-radius: 9px; border: 1px solid var(--line); background: var(--panel); font-size: 15px; } /* a rounded, outlined panel */
      .sec-9-3 .aline .mono { font-size: 14.5px; } /* the working is slightly smaller than the label text */
      .sec-9-3 .aline.win { border-color: var(--ok); background: var(--ok-bg); } /* the winner's line is green */
      .sec-9-3 .aline.sm { padding: 2px 8px; margin-top: 4px; font-size: 14px; } /* .aline.sm: a more compact line used inside step 5's feedback */
      .sec-9-3 .aline.sm .mono { font-size: 13.5px; } /* with smaller working text */
      .sec-9-3 .pin { width: 84px; height: 34px; border-radius: 8px; border: 1px solid var(--line-2); background: var(--panel); color: var(--ink); /* .pin: step 5's number box where the student types C's priority, 84 by 34 pixels and rounded */
        font: inherit; font-family: var(--mono); font-weight: 700; padding: 0 8px; } /* it takes the page's font settings but with fixed-width bold digits */
      .sec-9-3 .pbtn { min-width: 64px; } /* .pbtn: each process button in step 5 is at least 64 pixels wide */
      .sec-9-3 .pbtn.right { border-color: var(--ok); background: var(--ok-bg); } /* the correct process button turns green once the answer is revealed */
      .sec-9-3 .pbtn.on:not(.right) { border-color: var(--bad); background: var(--bad-bg); } /* a chosen wrong button turns red (selected but not the right one) */
      .sec-9-3 .ctl .prow { display: grid; grid-template-columns: minmax(0, 1fr) 98px 98px; gap: 10px; align-items: center; } /* .prow: one row of step 6's control table: the name column, then 98-pixel nice and base columns */
      .sec-9-3 .ctl .prow.head span:not(:first-child) { text-align: center; } /* centers the nice and base headings over their columns */
      .sec-9-3 .ctl .prow.off { opacity: .45; } /* D's row fades while D is switched off */
      .sec-9-3 .stp { display: inline-flex; align-items: center; gap: 4px; } /* .stp: the minus, value, plus stepper, laid out in one line */
      .sec-9-3 .stp .btn { width: 30px; padding: 0; font-size: 17px; } /* its square 30-pixel buttons with large minus and plus signs */
      .sec-9-3 .stp .sv { min-width: 30px; text-align: center; font-size: 15px; } /* the value between them is centered with a fixed minimum width, so the buttons do not shift as it changes */
      .sec-9-3 svg .tk { fill: var(--pb); stroke: var(--pc); stroke-width: 1; } /* .tk: the tick bars in step 6's chart, filled and outlined in the process colors */
      .sec-9-3 .stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; } /* .stats: the row of four share boxes under the chart, all the same width */
      .sec-9-3 .stats .stat { padding: 6px 9px; border: 1px solid var(--line); border-radius: 9px; background: var(--panel); display: flex; flex-direction: column; gap: 5px; } /* each share box: a padded outlined panel with its lines stacked */
    `,  // end of the CSS text

    steps: [  // steps: the pages of this section, in order
      /* ---------------- 1. Big picture: the goals and the once-a-second cycle ---------------- */
      {  // opens step 1, the big picture
        title: 'Many terminals, one processor: who goes next?',  // step 1 title: the opening question of many terminals sharing one processor
        kind: 'story',  // kind 'story' labels this as a big-picture page rather than a lab or quiz
        render(el, ctx) {  // render(el, ctx): the shell calls this when the student arrives on the step; el is the empty page body, ctx holds the helpers
          const { h, s } = ctx;  // takes the HTML builder h and the SVG builder s out of ctx
          const STAGES = {  // STAGES: the four stages of the once-a-second cycle, each as [title, color, explanation, why it matters]
            run: ['Run the chosen process', 'cpu', 'The chosen process gets the processor. In the classic example the hardware clock interrupts 60 times a second, and every <span class="t">clock tick</span> adds 1 to the running process’s <span class="t">CPU count</span>. A process that runs for a whole second adds 60.',  // stage "run": CPU blue; explains that each clock tick adds 1 to the running process's CPU count
              'The count is the scheduler’s memory of who has been using the processor lately.'],  // why it matters: the count is the scheduler's memory of recent processor use
            cut: ['One second is up', 'intr', '<span class="t">One-second preemption</span>: a process that has neither blocked nor finished after one second is <span class="t" data-t="Preemption">preempted</span>. If it blocks sooner, for example to wait for a keystroke, the next process is picked at once.',  // stage "cut": interrupt red; explains one-second preemption and what happens if a process blocks sooner
              'No process can keep the processor for more than a second at a stretch, so the others get regular turns.'],  // why it matters: no process keeps the processor for more than a second at a stretch
            calc: ['Halve, then recompute', 'os', 'Once a second every CPU count is cut in half, and then every <span class="t">priority number</span> is recomputed: <b class="mono">P = Base + CPU/2 + nice</b>. Halving makes old processor use fade away, a trick called <span class="t">usage decay</span>.',  // stage "calc": operating-system purple; explains halving the counts, the formula and usage decay
              'A process that hogged the processor gets a worse (bigger) number for a while, but it is forgiven quickly once it stops.'],  // why it matters: a process that hogged the processor is pushed back, but only for a while
            pick: ['Pick smallest number', 'accent', 'The ready process with the <b>smallest</b> priority number runs next. Processes with the same number share one queue and take turns (<span class="t" data-t="Round-robin">round robin</span>). Queues per priority level, with priorities that move: a <span class="t">multilevel feedback queue</span>.',  // stage "pick": accent color; explains that the smallest number runs, ties take turns, and names the multilevel feedback queue
              'Lower number means higher priority. That convention is easy to get backwards, so watch for it all through this section.'],  // why it matters: a warning that a lower number means a higher priority
          };  // closes STAGES
          /* Small screens get the four stages in a column with the loop drawn up the right side, so labels stay readable. */
          const slim = ctx.narrow;  // slim: true on a small screen (the shell's phone-width flag), which switches the drawing to a single column
          const POS = slim ? { run: [130, 28], cut: [130, 92], calc: [130, 156], pick: [130, 220] }  // POS: the center point of each stage box; on a small screen the four are stacked in one column
            : { run: [260, 34], cut: [417, 130], calc: [260, 226], pick: [103, 130] };  // on a wide screen they sit around a loop: run at the top, cut at the right, calc at the bottom, pick at the left
          const svg = s('svg', { viewBox: slim ? '0 0 336 248' : '0 0 520 260', width: '100%', class: 'cyc', role: 'img', 'aria-label': 'The once-a-second scheduling cycle', style: slim ? null : 'height:262px' });  // svg: the cycle drawing, sized for the chosen layout; role and aria-label describe it to screen readers; fixed height when wide
          if (slim) svg.append(  // small screen: adds the arrows and side labels for the column layout
            ...[51, 115, 179].map((y) => s('path', { d: `M130,${y} L130,${y + 16}`, class: 's-line', 'marker-end': 'url(#arr)' })),  // three short downward arrows between the four stacked stages (url(#arr) points to the shell's shared arrowhead)
            s('path', { d: 'M228,220 C 266,220 280,210 280,190 L280,58 C 280,38 266,28 232,28', class: 's-line', 'marker-end': 'url(#arr)' }),  // the long return arrow up the right side, from the last stage back to the first
            s('text', { x: 298, y: 124, transform: 'rotate(90 298 124)', 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 14 }, 'repeats every second'),  // side label "repeats every second", turned 90 degrees so it runs down beside the return arrow
            s('text', { x: 318, y: 124, transform: 'rotate(90 318 124)', 'text-anchor': 'middle', class: 's-sub', 'font-size': 13 }, '(60 clock ticks)'));  // a smaller grey label next to it: (60 clock ticks)
          else svg.append(  // wide screen: the four curved arrows of the loop and the labels in its middle
            s('path', { d: 'M361,40 C 400,44 417,70 417,104', class: 's-line', 'marker-end': 'url(#arr)' }),  // curved arrow from run (top) to cut (right)
            s('path', { d: 'M417,156 C 417,196 400,220 361,224', class: 's-line', 'marker-end': 'url(#arr)' }),  // curved arrow from cut (right) to calc (bottom)
            s('path', { d: 'M159,224 C 120,220 103,196 103,156', class: 's-line', 'marker-end': 'url(#arr)' }),  // curved arrow from calc (bottom) to pick (left)
            s('path', { d: 'M103,104 C 103,70 120,44 159,40', class: 's-line', 'marker-end': 'url(#arr)' }),  // curved arrow from pick (left) back to run (top), closing the loop
            s('text', { x: 260, y: 120, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 17 }, 'repeats'),  // center label, first line: "repeats"
            s('text', { x: 260, y: 141, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 17 }, 'every second'),  // center label, second line: "every second"
            s('text', { x: 260, y: 161, 'text-anchor': 'middle', class: 's-sub', 'font-size': 14 }, '(60 clock ticks)'));  // center label in grey: (60 clock ticks)
          const nodes = {};  // nodes: each stage's drawn group by name, so pick can highlight one
          for (const [k, [x, y]] of Object.entries(POS)) {  // builds one clickable box per stage at its position in POS
            const st = STAGES[k];  // st: that stage's entry in STAGES
            const g = s('g', { class: 'nd' },  // g: an SVG group holding the box and its title; class nd gives it the hover and selected styles
              s('rect', { x: x - 98, y: y - 23, width: 196, height: 46, rx: 12, class: 's-' + st[1] }),  // the box: 196 by 46 units, centered on the position, rounded, filled with the stage's color class (s-cpu, s-intr, s-os or s-accent)
              s('text', { x, y: y + 5, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 14.5 }, st[0]));  // the stage title, centered inside the box
            hot(g, () => pick(k), st[0]);  // hot makes the group act like a button that calls pick for this stage, with the title as its spoken name
            nodes[k] = g; svg.append(g);  // remembers the group and adds it to the drawing
          }  // ends the loop over stages
          const info = h('div', { class: 'msg info', style: { minHeight: '138px' } });  // info: the box under the drawing that explains the selected stage; its minimum height keeps the layout from jumping
          function pick(k) {  // pick(k): runs when a stage is clicked and selects stage k
            Object.entries(nodes).forEach(([x, g]) => g.classList.toggle('on', x === k));  // marks stage k as selected (class on) and clears the others
            const st = STAGES[k];  // st: the chosen stage
            say(info, 'info', st[0], `${st[2]}<div class="small" style="margin-top:6px"><b>Why:</b> ${st[3]}</div>`);  // fills the info box: the title as its heading, the explanation, then a smaller "Why" line
          }  // ends pick
          pick('run');  // starts with the "run" stage selected, so the box is never empty
          el.append(h('div', { class: 'split l fill' },  // lays out the step: two columns, the left one smaller, filling the step's full height
            h('div', { class: 'stack' },  // left column: the story, stacked top to bottom
              h('p', { class: 'lead m0', html: 'A UNIX machine in the 1980s might serve dozens of people typing at terminals while a few long calculations churn in the background. One processor has to keep all of them happy.' }),  // opening sentence: a 1980s machine serving many people at terminals plus long background jobs
              h('p', { class: 'm0', html: 'The traditional UNIX scheduler (as in System V Release 3 and 4.3 BSD) was built for this <span class="t">time sharing</span> mix, with two goals that pull against each other:' }),  // paragraph: which systems used this scheduler and that it had two goals pulling against each other
              h('div', { class: 'grid-2' },  // two side-by-side cards, one per goal
                h('div', { class: 'card tight small', html: '<b>Snappy response.</b> An <span class="t">interactive process</span> such as an editor should react to each keystroke at once.' }),  // goal card 1: snappy response for interactive processes such as an editor
                h('div', { class: 'card tight small', html: '<b>No <span class="t">starvation</span>.</b> Low-priority background jobs must still make steady progress.' })),  // goal card 2: no starvation for low-priority background jobs; closes the pair of cards
              h('div', { class: 'callout analogy m0', 'data-label': 'Analogy', html: 'A discussion leader with one microphone hands it to whoever has spoken least lately. Someone who has been quiet gets it the moment they raise a hand. The leader’s memory fades, though: a minute ago counts fully, ten minutes ago hardly at all.' })),  // analogy callout: a discussion leader whose memory of who spoke lately fades; closes the left column
            h('div', { class: 'card white stack' },  // right column: a white card holding the cycle drawing
              h('h4', { class: 'm0' }, 'The scheduler’s cycle · click each stage'),  // card heading that invites the student to click each stage
              h('div', { style: { display: 'grid', placeItems: 'center' } }, svg),  // centers the drawing in its own box
              info,  // the explanation box under the drawing
              h('p', { class: 'xs muted m0', html: 'Coming up: the five priority bands, the formula itself, a second-by-second trace you can step through, and an experiment with an I/O-bound newcomer.' }))));  // small grey preview of the rest of the section; closes the card, the two-column layout and the append
        },  // ends render for step 1
      },  // closes step 1

      /* ---------------- 2. The priority bands, and the queues inside the user band ---------------- */
      {  // opens step 2
        title: 'Bands of priority: who outranks whom',  // step 2 title: the priority bands and which outranks which
        kind: 'explore',  // kind 'explore': a page for poking at a model
        render(el, ctx) {  // render(el, ctx): draws step 2 when the student arrives on it
          const { h } = ctx;  // takes the HTML builder h out of ctx
          const BANDS = [  // BANDS: the five priority bands from highest to lowest, each as [name, color, what it holds, example, why it sits there]
            ['Swapper', 'os', 'The <span class="t" data-t="Swapper (process 0)">swapper</span>, the kernel’s own process that moves whole processes between main memory and disk.',  // band 1, the swapper, in operating-system purple: the kernel process that moves whole processes between memory and disk
              'Memory is full and three processes are ready to run but sit on disk. None of them can run until the swapper makes room.',  // swapper example: ready processes stuck on disk until room is made in memory
              'Everything else may be waiting on memory. If the swapper waited behind ordinary work, a memory jam might never clear.'],  // why the swapper is highest: everything else may be waiting on memory
            ['Block I/O device control', 'io', 'Processes waiting inside the kernel for a <span class="t">block I/O device</span> such as a disk.',  // band 2, block I/O device control: processes waiting in the kernel for a disk
              'A process asked for part of a file, and the disk has just delivered the block.',  // block I/O example: the disk has just delivered a requested block
              'Running it at once lets it hand the disk its next request, so the disk stays busy, and it frees the memory buffer it was holding.'],  // why this high: the disk gets its next request at once, and a memory buffer is freed
            ['File manipulation', 'mem', 'Processes waiting inside the kernel while working on files, for example for a shared buffer or for a file’s record that another process is updating.',  // band 3, file manipulation, in memory green: processes waiting in the kernel while working on files
              'Two processes change the same directory; one waits until the other is finished with it.',  // file manipulation example: two processes changing the same directory
              'A process here usually holds file-system resources that others need too. Finishing its file work quickly unblocks them.'],  // why this high: these processes hold file-system resources other processes need
            ['Character I/O device control', 'io', 'Processes waiting for a <span class="t">character I/O device</span>: a terminal’s keyboard or screen, or a printer line.',  // band 4, character I/O device control: processes waiting on a terminal or a printer line
              'An editor is waiting for your next keystroke. You press a key and expect to see it echoed at once.',  // character I/O example: an editor waiting for the next keystroke
              'These processes need only a short burst of processor time per character or line, so serving them first keeps terminals responsive at almost no cost to anyone else.'],  // why this high: each needs only a short burst, so serving it first keeps terminals responsive at little cost
            ['User processes', 'proc', 'Ordinary programs running their own code: shells, editors, compilers, long calculations.',  // band 5, user processes, in process teal: ordinary programs running their own code
              'A compiler, a long simulation and your editor (between keystrokes) all compete in this band.',  // user band example: a compiler, a long simulation and an editor competing
              'Inside this band the CPU-count term does the sorting: <span class="t" data-t="Processor-bound process">processor-bound</span> processes drift to bigger numbers, <span class="t" data-t="I/O-bound process">I/O-bound</span> ones keep small numbers.'],  // why lowest, and how the CPU count sorts processes inside this band
          ];  // closes BANDS
          const info = h('div', { class: 'msg info', style: { minHeight: '182px' } });  // info: the box that explains the selected band; its minimum height keeps the layout steady
          const btns = BANDS.map((b, i) => h('button', { type: 'button', class: 'band ' + b[1], onclick: () => pick(i) },  // btns: one button per band, styled band plus its color class; a click calls pick
            h('span', { class: 'rank' }, String(i + 1)), h('span', { class: 'nm' }, b[0])));  // inside each button: the round rank badge (1 to 5) and the band's name
          const qcard = h('div', { class: 'card stack gap-s qcard' });  // qcard: the card showing the queues inside the user band; it lights up when the user band is chosen
          function pick(i) {  // pick(i): runs when band i is clicked
            btns.forEach((b, j) => b.classList.toggle('on', i === j));  // marks band i's button as selected and clears the others
            const b = BANDS[i];  // b: the chosen band
            say(info, 'info', `Band ${i + 1} of 5 · ${b[0]}`, `${b[2]}<div class="small" style="margin-top:6px"><b>Example:</b> ${b[3]}</div><div class="small" style="margin-top:4px"><b>${i === 4 ? 'Why lowest' : 'Why this high'}:</b> ${b[4]}</div>`);  // fills the info box: "Band n of 5" heading, the description, the example, and the reason ("Why lowest" for the user band)
            qcard.classList.toggle('hit', i === 4);  // highlights the queue card only when the user band (index 4, the fifth) is chosen
          }  // ends pick
          /* The user band, drawn from the simulation: one queue per priority number in use. */
          const sim = UNIX_SIM.simulate(ABC(), 4);  // sim: a 4-second run of A, B and C whose numbers fill the queue card
          const qbox = h('div', { class: 'stack gap-s' });  // qbox: the stack of queue rows inside the card
          const qcap = h('p', { class: 'small m0' });  // qcap: the caption under the queues that says which one is served and why
          function showQueues(t) {  // showQueues(t): draws the user band's queues as they stand at the start of second t
            const row = sim.rows[t];  // row: the simulation's record for second t
            const levels = [...new Set(row.vals.map((v) => v.prio))].sort((a, b) => a - b);  // levels: the different priority numbers in use, without repeats (a Set drops them), sorted smallest first
            qbox.replaceChildren(...levels.map((lv, li) => {  // rebuilds the queue rows, one per level; li = 0 is the best level
              const who = row.vals.map((v, j) => [v, j]).filter(([v]) => v.prio === lv)  // who: the processes holding this number
                .sort((a, b) => (a[1] === row.pick ? -1 : b[1] === row.pick ? 1 : 0)).map(([, j]) => sim.names[j]);  // with the one picked to run moved to the front, turned into names
              return h('div', { class: 'lvrow' + (li === 0 ? ' best' : '') },  // one queue row; the best one gets the green best style
                h('span', { class: 'lv mono' }, 'P = ' + lv),  // the level's number, for example P = 60
                h('span', { class: 'row gap-s', html: who.map((n) => pchip(n)).join('') }),  // the chips of the processes waiting in that queue
                h('span', { class: 'xs muted' }, li === 0 ? (who.length > 1 ? 'best queue · take turns' : 'best queue') : 'waits'));  // short label: "best queue" (with "take turns" when shared) or "waits"
            }));  // ends the queue rows and puts them in the card
            const run = sim.names[row.pick];  // run: the name of the process picked at second t
            qcap.innerHTML = `At t = ${t} the best non-empty queue is P = ${levels[0]}. ` +  // caption, first part: the best non-empty queue at this second
              (row.vals.filter((v) => v.prio === levels[0]).length > 1 ? whyPick(sim, t) : `${pchip(run)} is alone in it, so it runs.`);  // second part: whyPick explains a shared queue's tie; a process alone in it simply runs
          }  // ends showQueues
          const seg = ctx.ui.seg([1, 2, 3].map((t) => ({ value: t, label: 't = ' + t })), 1, showQueues);  // seg: a switch with buttons t = 1, 2 and 3, starting at 1; choosing one redraws the queues for that second
          showQueues(1);  // draws the queues for t = 1 when the step opens
          qcard.append(  // fills the queue card
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'Inside the user band'), seg),  // header row: the card title on the left and the time switch on the right
            qbox, qcap);  // then the queue rows and the caption
          pick(3);  // starts with band 4 (character I/O) selected, so the info box opens on a familiar example: typing in an editor
          el.append(h('div', { class: 'split l fill' },  // lays out step 2: two columns, the left one smaller, filling the step's height
            h('div', { class: 'stack' },  // left column, stacked
              h('p', { class: 'lead m0', html: 'Every process has a <span class="t">base priority</span> that puts it in one of five fixed <span class="t" data-t="Priority band">priority bands</span>. Click a band.' }),  // opening sentence: every process's base priority puts it in one of five bands; invites a click
              h('div', { class: 'ladder', style: ctx.narrow ? { gridTemplateColumns: '76px minmax(0, 1fr)' } : null },  // the band ladder; on a small screen its axis column shrinks from 96 to 76 pixels
                h('div', { class: 'axis', html: '<span>higher priority<br>smaller numbers</span><span>lower priority<br>bigger numbers</span>' }),  // axis labels: higher priority and smaller numbers at the top, lower priority and bigger numbers at the bottom
                h('div', { class: 'stack gap-s' }, ...btns)),  // the five band buttons stacked beside the axis; closes the ladder
              h('div', { class: 'callout why m0 small', 'data-label': 'Why this order', html: 'Work that drives I/O devices runs first, so each device gets its next request quickly and stays busy. That work needs only a short burst each time, so going first costs everyone else very little.' })),  // why callout: device work goes first so devices stay busy, and it costs others little; closes the left column
            h('div', { class: 'stack' }, info, qcard,  // right column: the band explanation, then the queue card
              h('div', { class: 'callout m0 small', 'data-label': 'Staying in the band', html: 'The CPU and nice terms are limited, so the formula moves a process only within its own band. A process sits in an upper band while it waits inside the kernel for that kind of event, and is back in the user band once it runs its own code again.' }))));  // callout: the limited CPU and nice terms keep a process inside its band; closes the columns and the append
        },  // ends render for step 2
      },  // closes step 2

      /* ---------------- 3. The formula explorer ---------------- */
      {  // opens step 3, the formula explorer
        title: 'The formula: recent use pushes the number up',  // step 3 title: recent processor use pushes the number up
        kind: 'explore',  // kind 'explore': a page for poking at a model
        render(el, ctx) {  // render(el, ctx): draws step 3 when the student arrives on it
          const { h, s } = ctx;  // takes the HTML builder h and the SVG builder s out of ctx
          const st = { ticks: 67, base: 60, nice: 0, who: 'user', next: 'stop' };  // st: the explorer's settings: the count at the end of the second (67, the worked example), base, nice, who sets nice, and the forecast choice
          const warn = h('div', { class: 'msg', style: { display: 'none' } });  // warn: a message box, hidden at first, for the "not allowed" warning about negative nice values
          const work = h('div', { class: 'stack gap-s work' });  // work: the box for the three lines of worked arithmetic
          const big = h('div', { class: 'big' });  // big: the large "P = ..." result
          /* Small screens get slimmer drawings (fewer viewBox units), so their labels are not shrunk below reading size. */
          const slim = ctx.narrow, SW = slim ? 340 : 600;  // slim: the phone-width flag; SW: the drawings' width in units, 340 on a small screen and 600 otherwise
          const scale = s('svg', { viewBox: `0 0 ${SW} 78`, width: '100%', role: 'img', 'aria-label': 'Where the priority number falls on the 0 to 127 range' });  // scale: the bar that shows where the result falls on the 0 to 127 range
          const decay = s('svg', { viewBox: `0 0 ${SW} 112`, width: '100%', role: 'img', 'aria-label': 'CPU count and priority over the next six seconds', style: 'flex:none' });  // decay: the small bar chart of the next six seconds; flex none stops it shrinking inside its stack
          const decayCap = h('p', { class: 'small m0' });  // decayCap: the caption under that chart
          const X = (p) => 20 + (p / PMAX) * (SW - 40);  // X(p): turns a priority number from 0 to 127 into a position across the bar, leaving 20 units of margin at each end
          function draw() {  // draw(): recomputes every number and redraws both drawings; it runs whenever a slider or switch changes
            const p = { base: st.base, nice: st.nice };  // p: the base and nice values in the shape prioOf expects
            const cpu = Math.floor(st.ticks / 2), term = Math.floor(cpu / 2), raw = st.base + term + st.nice, P = UNIX_SIM.prioOf(p, cpu);  // cpu: the count after halving; term: half of that again; raw: the sum before limits; P: the final number from prioOf
            work.innerHTML =  // fills the worked arithmetic with three labelled lines
              `<div class="wline"><span class="wk">1 · halve</span><span class="mono">CPU = ⌊${st.ticks} / 2⌋ = <b>${cpu}</b></span></div>` +  // line 1: the halving of the count, with the result in bold
              `<div class="wline"><span class="wk">2 · priority</span><span class="mono">P = ${st.base} + ⌊${cpu} / 2⌋ + (${st.nice}) = ${st.base} + ${term} + (${st.nice}) = <b>${raw}</b></span></div>` +  // line 2: the formula with the student's numbers filled in, step by step, and the raw sum in bold
              `<div class="wline"><span class="wk">3 · band</span><span>${raw === P ? `${raw} is inside the user band (60 to 127), so it stands.` : `${raw} would leave the user band, so it is held at the edge: <b>${P}</b>.`}</span></div>`;  // line 3: whether that sum lies inside the user band or is held at its edge
            big.innerHTML = `P = ${P}${raw !== P ? ' <span class="chip warn" style="font-size:14px;vertical-align:middle">held in band</span>' : ''}`;  // the large result, with a "held in band" tag when the band limit changed it
            scale.replaceChildren(  // redraws the range bar
              s('rect', { x: X(0), y: 26, width: X(USER_TOP) - X(0), height: 24, rx: 5, class: 's-os' }),  // the part of the bar from 0 to 60, in purple, for the four upper bands
              s('rect', { x: X(USER_TOP), y: 26, width: X(PMAX) - X(USER_TOP), height: 24, rx: 5, class: 's-proc' }),  // the part from 60 to 127, in teal, for the user band
              s('text', { x: (X(0) + X(USER_TOP)) / 2, y: 43, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 700 }, 'four upper bands'),  // label inside the purple part
              s('text', { x: (X(USER_TOP) + X(PMAX)) / 2 + (slim ? 10 : 40), y: 43, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 700 }, 'user band'),  // label inside the teal part, nudged right of its center
              /* The urgency hints share the bottom row with the numbers, so the P label above the bar never collides with them. */
              ...[[0, 'start', '0  ← more urgent'], [USER_TOP, 'middle', String(USER_TOP)], [PMAX, 'end', `less urgent →  ${PMAX}`]].map(([v, a, label]) =>  // three labels along the bottom: 0 with "more urgent", 60 at the band border, and "less urgent" with 127
                s('text', { x: X(v), y: 68, 'text-anchor': a, class: 's-sub', 'font-size': 13, style: 'white-space:pre' }, label)),  // each placed at its number's position and aligned left, centered or right; white-space pre keeps the double spaces
              s('line', { x1: X(P), y1: 20, x2: X(P), y2: 56, style: 'stroke:var(--bad);stroke-width:3' }),  // a red marker line at the result's position
              s('text', { x: Math.min(SW - 34, Math.max(34, X(P))), y: 14, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 14, style: 'fill:var(--bad)' }, 'P = ' + P));  // the result's label above the marker, kept at least 34 units from either edge so it is never cut off
            /* The next six seconds: keep halving (and add 60 first if it keeps running). */
            const cols = [{ cpu, P }];  // forecast: starts with the count and number for now
            for (let k = 1; k <= 6; k++) { const c = Math.floor((cols[k - 1].cpu + (st.next === 'run' ? HZ : 0)) / 2); cols.push({ cpu: c, P: UNIX_SIM.prioOf(p, c) }); }  // adds six more seconds: when the process keeps running it gains 60 ticks before each halving; then its new number
            const cw = slim ? 43 : 82, bw = slim ? 32 : 52, x0 = slim ? 26 : 30;  // column spacing, bar width and the first bar's left edge, all smaller on a small screen
            decay.replaceChildren(...(slim ? [s('text', { x: 4, y: 89, class: 's-sub', 'font-size': 14, 'font-weight': 800 }, 'P')] : []), ...cols.flatMap((c, k) => {  // redraws the forecast chart; on a small screen a "P" label marks the row of numbers
              const x = x0 + k * cw, bh = Math.round((c.cpu / 60) * 50);  // for each column: x is its left edge; bh is the bar height, 50 units for a count of 60
              return [s('rect', { x, y: 70 - bh, width: bw, height: Math.max(bh, 1), rx: 4, class: k ? 's-cpu' : 's-accent' }),  // the bar for the count (at least 1 unit tall, so a zero count still shows); "now" in accent, later seconds in CPU blue
                s('text', { x: x + bw / 2, y: 65 - bh, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700 }, String(c.cpu)),  // the count written above its bar
                s('text', { x: x + bw / 2, y: 89, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800 }, slim ? String(c.P) : 'P ' + c.P),  // the priority number under the bar (without the "P" prefix on a small screen, to save space)
                s('text', { x: x + bw / 2, y: 107, 'text-anchor': 'middle', class: 's-sub', 'font-size': 13.5 }, k ? '+' + k + ' s' : 'now')];  // grey time label at the bottom: "now", "+1 s", "+2 s" and so on
            }));  // ends the columns and the chart
            decayCap.innerHTML = st.next === 'stop'  // the forecast caption depends on the stop or keep running choice
              ? `Waiting, the count halves every second: ${cols.map((c) => c.cpu).join(' → ')}. The number falls back toward ${UNIX_SIM.prioOf(p, 0)}, so heavy use is forgiven within a few seconds.`  // stopping: lists the shrinking counts and says the number falls back toward base + nice
              : `Running, it gains 60 ticks each second before the halving: ${cols.map((c) => c.cpu).join(' → ')}. The count settles near 60, so the number settles near ${cols[6].P} instead of growing forever.`;  // running: lists the counts and says they settle near 60, so the number levels off instead of growing forever
          }  // ends draw
          const sTicks = ctx.ui.slider({ label: 'Count at end of second', min: 0, max: 120, value: st.ticks, onInput: (v) => { st.ticks = v; draw(); } });  // slider for the count at the end of the second, 0 to 120; moving it redraws
          const sBase = ctx.ui.slider({ label: 'Base priority', min: 60, max: 90, value: st.base, onInput: (v) => { st.base = v; draw(); } });  // slider for the base priority, 60 to 90
          const sNice = ctx.ui.slider({ label: 'nice', min: -20, max: 20, value: st.nice, format: (v) => (v > 0 ? '+' + v : String(v)), onInput: (v) => {  // slider for nice, -20 to +20, shown with a plus sign when positive; its handler checks who is allowed
            if (v < 0 && st.who === 'user') { sNice.set(0); st.nice = 0; warn.style.display = ''; say(warn, 'bad', 'Not allowed', 'An ordinary user may only make a process nicer (a bigger nice value). Only the superuser can lower it.'); }  // an ordinary user trying a negative value is snapped back to 0 and sees the "Not allowed" warning
            else { st.nice = v; warn.style.display = 'none'; }  // otherwise the value is accepted and any warning is hidden
            draw();  // redraws with the new value
          } });  // ends the nice handler and the slider settings
          const who = ctx.ui.seg([{ value: 'user', label: 'Ordinary user' }, { value: 'root', label: 'Superuser' }], st.who, (v) => {  // who: a switch between ordinary user and superuser; choosing one runs the code below
            st.who = v; warn.style.display = 'none';  // stores the choice and hides any warning
            if (v === 'user' && st.nice < 0) { st.nice = 0; sNice.set(0); }  // switching back to an ordinary user removes a negative nice value, which that user could not have set
            draw();  // redraws
          });  // ends the who switch
          const next = ctx.ui.seg([{ value: 'stop', label: 'stops running' }, { value: 'run', label: 'keeps running' }], st.next, (v) => { st.next = v; draw(); });  // next: a switch that chooses whether the forecast assumes the process stops or keeps running
          draw();  // first drawing with the starting settings
          el.append(h('div', { class: 'split l fill' },  // lays out step 3: two columns, the left one smaller
            h('div', { class: 'stack' },  // left column, stacked
              h('div', { class: 'card formula', style: ctx.narrow ? { fontSize: '15px' } : null, html: '<div class="mono">CPU<sub>j</sub>(i) = CPU<sub>j</sub>(i − 1) / 2</div><div class="mono">P<sub>j</sub>(i) = Base<sub>j</sub> + CPU<sub>j</sub>(i) / 2 + nice<sub>j</sub></div>' +  // formula card: the two formula lines with subscripts, smaller text on a small screen; continues on the next line
                '<div class="xs muted" style="margin-top:4px">j = which process · i = which one-second interval · every division rounds down</div>' }),  // small grey key under the formula: what j and i stand for, and that every division rounds down; closes the card
              h('div', { class: 'card stack gap-s' }, sTicks, sBase, sNice, h('div', { class: 'row' }, h('span', { class: 'small b', html: 'Who sets the <span class="t" data-t="Nice value">nice value</span>?' }), who), warn),  // controls card: the three sliders, a "Who sets the nice value?" row with its switch, and the warning box
              h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'Reading a bigger number as “more important”. In UNIX it is the reverse: P = 63 beats P = 76. Recent processor use only ever <b>adds</b> to the number.' }),  // common-mistake callout: reading a bigger number as more important
              h('div', { class: 'callout tip m0 small', 'data-label': 'Try this', html: 'Set the count to 0 and try a negative nice value as an ordinary user. Then switch to <span class="t">Superuser</span> and drag nice to −20: what keeps P from dropping below 60?' })),  // try-this callout: a negative nice value as an ordinary user, then as superuser; what stops P below 60; closes the left column
            h('div', { class: 'stack' },  // right column, stacked
              h('div', { class: 'card white stack gap-s' }, h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'This second’s arithmetic'), big), work, scale),  // arithmetic card: heading with the large result beside it, then the worked lines and the range bar
              h('div', { class: 'card white stack gap-s grow' },  // forecast card, which grows to fill the leftover height
                h('div', { class: 'row' }, h('h4', { class: 'm0' }, 'CPU count and priority if the process now'), next),  // its heading ("... if the process now") with the stops or keeps running switch beside it
                decay, decayCap))));  // the forecast chart and its caption; closes the cards, the columns and the append
        },  // ends render for step 3
      },  // closes step 3

      /* ---------------- 4. The classic trace, second by second ---------------- */
      {  // opens step 4, the classic trace
        title: 'Trace it: A, B and C, one second at a time',  // step 4 title: trace A, B and C one second at a time
        kind: 'lab',  // kind 'lab' marks this as a hands-on page
        core: true,  // core: true keeps this step on the shorter core route through the guide
        render(el, ctx) {  // render(el, ctx): draws step 4 when the student arrives on it
          const { h } = ctx;  // takes the HTML builder h out of ctx
          const procs = ABC(), T = 6;  // procs: the classic three processes; T: the trace covers six seconds, 0 to 5
          const sim = UNIX_SIM.simulate(procs, T);  // sim: the simulation run whose numbers fill every part of this step
          const N = sim.names;  // N: the process names A, B and C
          const tbl = h('table', { class: 'tbl compact trace' + (ctx.narrow ? ' slim' : '') });  // tbl: the trace table; on a small screen it also gets the slim class for tighter cells
          const head = `<tr><th></th>${N.map((n) => `<th colspan="2">${pchip(n)}</th>`).join('')}<th></th></tr>` +  // head: the table's two header rows; the first puts each process chip over its two columns
            `<tr><th>t</th>${N.map(() => '<th>CPU</th><th>P</th>').join('')}<th>runs</th></tr>`;  // the second names the columns: t, then CPU and P for each process, then who runs
          const work = h('div', { class: 'stack gap-s' });  // work: the arithmetic panel on the right
          const tline = h('div', { class: 'tline' });  // tline: the strip of six cells that shows who held the processor in each second
          const lastRun = (t, j) => { for (let r = t - 1; r >= 0; r--) if (sim.rows[r].pick === j) return r; return -1; };  // lastRun(t, j): the last second before t in which process j ran, or -1 if it never has
          function draw(f) {  // draw(f): draws frame f; there are two frames per second, the decision at its start and the second itself
            const t = Math.floor(f / 2), phase = f % 2;  // t: the second that frame f is about; phase: 0 for the decision, 1 for the running
            let html = head;  // html: the table text, starting with the header rows
            for (let r = 0; r < T; r++) {  // one table row per second
              if (r > t) { html += `<tr class="fut"><td class="mono">${r}</td>${N.map(() => '<td>?</td><td>?</td>').join('')}<td>?</td></tr>`; continue; }  // seconds not reached yet show grey question marks
              const row = sim.rows[r];  // row: the simulation's record for second r
              html += `<tr class="${r === t ? 'on' : ''}"><td class="mono b">${r}</td>` + row.vals.map((v, j) => {  // a reached row, highlighted if it is the current one: the second's number in bold, then each process's two cells
                const runs = j === row.pick, shown = runs && (r < t || phase === 1);  // runs: true for the process picked this second; shown: whether its end count appears (past rows, or the current row's second frame)
                return `<td class="mono${runs ? ' runc' : ''}">${v.count}${shown ? `<span class="up">→ ${v.end}</span>` : ''}</td><td class="mono b${runs ? ' runc' : ''}">${v.prio}</td>`;  // the count cell (plus "→ end count" when shown) and the P cell; the runner's cells get the CPU-blue fill
              }).join('') + `<td>${pchip(N[row.pick])}</td></tr>`;  // the last cell names who ran; closes the row
            }  // ends the row loop
            tbl.innerHTML = html;  // puts the finished table into the page
            tline.innerHTML = sim.rows.map((rw, r) => (r <= t ? `<div class="tcell ${PCOL[N[rw.pick]]}${r === t ? ' now' : ''}">${N[rw.pick]}</div>` : '<div class="tcell fut">?</div>')).join('') +  // the strip: reached seconds show the runner's letter in its colors (the current one outlined), later ones a dashed "?"
              sim.rows.map((rw, r) => `<div class="xs muted center">${ctx.narrow ? 's' : 'second '}${r}</div>`).join('');  // then a label under each cell: "second 0", "second 1" and so on, or just "s0" on a small screen
            const row = sim.rows[t], j = row.pick, v = row.vals[j];  // row: the current second's record; j: the runner; v: its values
            if (phase === 0) {  // phase 0: the decision at the start of the second
              work.innerHTML = `<h4 class="m0">At t = ${t}: ${t ? 'halve every count, then recompute' : 'three new processes'}</h4>` +  // heading: halve and recompute at t (or "three new processes" at t = 0)
                N.map((n, k) => `<div class="aline${k === j ? ' win' : ''}">${pchip(n)}<span class="mono">${arith(sim, procs, t, k)}</span></div>`).join('') +  // one line of arithmetic per process from arith; the winner's line is green
                `<div class="small">${whyPick(sim, t)}</div>`;  // then whyPick's one-sentence reason
            } else {  // phase 1: the second itself
              work.innerHTML = `<h4 class="m0">During second ${t}</h4>` +  // heading: during second t
                `<div class="aline win">${pchip(N[j])}<span>runs all ${v.ran} ticks: count ${v.count} + ${v.ran} = <b>${v.end}</b><div class="meter" style="margin-top:5px"><i style="width:${(v.ran / HZ) * 100}%"></i></div></span></div>` +  // the runner's line: it runs all its ticks and its count rises by that many; a meter bar shows its share of the 60 ticks
                N.map((n, k) => (k === j ? '' : `<div class="aline">${pchip(n)}<span>waits: count stays <b>${row.vals[k].count}</b></span></div>`)).join('') +  // a line for each waiting process: its count stays where it is
                `<div class="small">At t = ${t + 1} the one-second rule preempts ${pchip(N[j])}: it has neither blocked nor finished.</div>`;  // closing line: at the next second the one-second rule preempts the runner
            }  // ends the phase choice
          }  // ends draw
          function caption(f) {  // caption(f): the player's caption text for frame f
            const t = Math.floor(f / 2), row = sim.rows[t], j = row.pick, v = row.vals[j];  // t, the record for that second, the runner j and its values v
            if (f % 2 === 0) {  // phase 0 (an even frame number): the decision
              const lr = lastRun(t, j);  // lr: the last second the runner ran before this one
              const back = lr >= 0 ? ` ${pchip(N[j])} last ran in second ${lr}; its count has been halved ${t - lr} time${t - lr > 1 ? 's' : ''} since then (${sim.rows[lr].vals[j].end} → ${v.count}), so it is the most urgent again.` : '';  // back: if it ran before, how many halvings brought its count down so it is the most urgent again ("times" made plural as needed)
              return `<b>t = ${t}.</b> ` + (t === 0 ? 'A, B and C are created together: count 0, base 60, nice 0, so each starts at P = 60. ' : 'Every count is halved and every priority recomputed (see the arithmetic panel). ') + whyPick(sim, t) + back;  // the caption: t in bold, the creation note at t = 0 or the halving note later, then whyPick's reason and back
            }  // ends the phase 0 case
            return `<b>During second ${t}</b> nobody blocks, so ${pchip(N[j])} keeps the processor for all 60 clock ticks and its count climbs from ${v.count} to ${v.end}. The waiting counts do not move.` +  // phase 1 caption: nobody blocks, so the runner keeps all 60 ticks and its count climbs while the others stay put
              (t === T - 1 ? ' What happens at t = 6? Predict it in the next step.' : '');  // on the very last frame it invites the student to predict t = 6 on the next step
          }  // ends caption
          const player = ctx.ui.player({ count: T * 2, interval: 2600, render: (f) => { draw(f); return caption(f); } });  // player: the shell's animation player, 12 frames (two per second) 2.6 seconds apart; each frame redraws and returns its caption
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },  // lays out step 4: a stack filling the step, with 10-pixel gaps
            h('div', { class: 'split r grow', style: { gap: '14px' } },  // two columns, the right one smaller, growing to take the leftover height
              h('div', { class: 'card white tight stack gap-s' }, tbl,  // left card: the trace table
                h('p', { class: 'xs muted m0', html: 'CPU = the count at the start of the second (→ its value at the end, for the process that ran). P = the priority number; the smallest runs.' }),  // key under the table: what the CPU column (and its arrow) and the P column mean
                h('div', { class: 'stack gap-s', style: { marginTop: 'auto' } }, h('h4', { class: 'm0' }, 'Who held the processor'), tline)),  // pushed to the bottom of the card: the "Who held the processor" heading and the strip; closes the left card
              h('div', { class: 'card stack gap-s' }, work,  // right card: the arithmetic panel
                h('div', { class: 'card white tight rules', style: { marginTop: 'auto', fontSize: '13.5px' }, html: '<b>Rules in this example</b><ul class="m0"><li>60 clock ticks a second; each adds 1 to the running process’s count.</li><li>Every whole second: halve every count, recompute every P, preempt the runner.</li><li>Smallest P runs; on a tie, the one that has waited longest.</li></ul>' }))),  // pushed to the bottom: a small card listing the three rules this example follows; closes the card and the columns
            player.el));  // the player's controls under both columns; closes the layout
        },  // ends render for step 4
      },  // closes step 4

      /* ---------------- 5. Predict t = 6, then reveal it from the simulation ---------------- */
      {  // opens step 5, the prediction
        title: 'Predict: who runs at t = 6?',  // step 5 title: who runs at t = 6?
        kind: 'predict',  // kind 'predict' sets the header label for this step: the student guesses before the answer is shown
        render(el, ctx) {  // render(el, ctx): draws step 5 when the student arrives on it
          const { h } = ctx;  // takes the HTML builder h out of ctx
          const procs = ABC(), T = 9, Q = 6;  // procs: A, B and C; T: 9 seconds, enough to show the pattern continuing; Q: the second to predict, 6
          const sim = UNIX_SIM.simulate(procs, T);  // sim: the run whose numbers fill this step and check the answers
          const N = sim.names, cIdx = 2, target = sim.rows[Q].vals[cIdx].prio, runner = sim.rows[Q].pick;  // N: the names; cIdx: C's index (2); target: C's true number at t = 6; runner: the process that truly runs at t = 6
          let shown = Q, tries = 0, solved = false, picked = null;  // shown: how many rows are revealed (seconds 0 to 5 at first); tries: attempts on part 1; solved and picked record progress
          const tbl = h('table', { class: 'tbl compact trace' + (ctx.narrow ? ' slim' : '') });  // tbl: the trace table, slim on a small screen
          const after = h('p', { class: 'small m0' });  // after: the line under the table that sums up the order once it is revealed
          function drawTable() {  // drawTable(): redraws the table with as many seconds revealed as shown says
            let html = `<tr><th></th>${N.map((n) => `<th colspan="2">${pchip(n)}</th>`).join('')}<th></th></tr><tr><th>t</th>${N.map(() => '<th>CPU</th><th>P</th>').join('')}<th>runs</th></tr>`;  // html: the two header rows, the same as in step 4
            for (let r = 0; r < T; r++) {  // one row per second
              const row = sim.rows[r];  // row: the simulation's record for second r
              if (r >= shown) { html += `<tr class="fut${r === Q ? ' on' : ''}"><td class="mono${r === Q ? ' b' : ''}">${r}</td>${N.map(() => '<td>?</td><td>?</td>').join('')}<td>?</td></tr>`; continue; }  // hidden rows show question marks; the t = 6 row stays highlighted with a bold number even while hidden
              html += `<tr class="${r === Q ? 'on' : ''}"><td class="mono b">${r}</td>` + row.vals.map((v, j) => `<td class="mono${j === row.pick ? ' runc' : ''}">${v.count}</td><td class="mono b${j === row.pick ? ' runc' : ''}">${v.prio}</td>`).join('') + `<td>${pchip(N[row.pick])}</td></tr>`;  // revealed rows show each count and number with the runner's cells in CPU blue, then who ran
            }  // ends the row loop
            tbl.innerHTML = html;  // puts the table into the page
            const seq = sim.rows.slice(0, shown).map((r) => N[r.pick]).join(', ');  // seq: the runners so far, separated by commas
            const settled = shown > Q && sim.rows.slice(3, shown).every((r, k) => r.pick === sim.rows[k].pick);  // settled: true once revealed if every second from 3 on repeats the runner of three seconds before, a strict rotation
            after.innerHTML = shown > Q ? `Order so far: ${seq}.` + (settled ? ' From t = 3 each runs one second in three: round robin, and none of these equal processes starves.' : '') : '';  // once revealed, writes the order so far and, if settled, points out the round robin; empty before that
          }  // ends drawTable
          /* Part 1: C's priority number at t = 6 */
          const inp = h('input', { type: 'number', class: 'pin', 'aria-label': 'C’s priority number at t = 6', inputmode: 'numeric' });  // inp: the box where the student types C's number at t = 6; inputmode numeric brings up a number keypad on phones
          const fb1 = h('div', { class: 'msg', style: { display: 'none' } });  // fb1: part 1's feedback box, hidden until Check is pressed
          const check1 = () => {  // check1(): runs when the Check button is pressed
            const v = parseInt(inp.value, 10);  // v: the typed text read as a whole number (NaN, "not a number", if it is not one)
            if (Number.isNaN(v)) { fb1.style.display = ''; say(fb1, 'info', 'Type a number', 'Enter a whole number, then press Check.'); return; }  // anything that is not a number gets a gentle prompt and does not count as a try
            tries++;  // counts this attempt
            fb1.style.display = '';  // shows the feedback box
            if (v === target) { solved = true; say(fb1, 'ok', 'Correct', `C: ${arith(sim, procs, Q, cIdx)}. A whole second of running gives C the worst number.`); }  // right answer: marks it solved and shows C's full arithmetic from arith
            else if (tries < 2) say(fb1, 'bad', 'Not quite', `C ran all of second 5. Add those 60 ticks to its count of ${sim.rows[5].vals[cIdx].count} first, then halve, then use the formula.`);  // first wrong try: a hint to add the 60 ticks of second 5 to C's count before halving
            else say(fb1, 'bad', 'Here is the working', `C: count ${sim.rows[5].vals[cIdx].count} + 60 = ${sim.rows[5].vals[cIdx].end}, then ${arith(sim, procs, Q, cIdx)}.`);  // from the second wrong try on: the full working
          };  // ends check1
          /* Part 2: who runs during second 6? */
          const fb2 = h('div', { class: 'msg', style: { display: 'none' } });  // fb2: part 2's feedback box, hidden until a process is chosen
          const choose = (j) => {  // choose(j): runs when the student clicks process j's button
            picked = j;  // remembers the choice
            btns.forEach((b, k) => { b.classList.toggle('on', k === j); b.classList.toggle('right', k === runner); });  // marks the chosen button (on) and the true runner (right); the CSS colors them red or green
            shown = T; drawTable();  // reveals every row of the table, t = 6 and after included
            fb2.style.display = '';  // shows the feedback box
            const lines = N.map((n, k) => `<div class="aline sm${k === runner ? ' win' : ''}">${pchip(n)}<span class="mono">${arith(sim, procs, Q, k)}</span></div>`).join('');  // lines: each process's arithmetic at t = 6 in compact form, the true runner's line in green
            say(fb2, j === runner ? 'ok' : 'bad', j === runner ? 'Yes' : 'Not this time', (j === runner ? '' : `${pchip(N[j])} has P = ${sim.rows[Q].vals[j].prio} at t = ${Q}. `) + `${whyPick(sim, Q)}${lines}`);  // feedback: "Yes" or "Not this time" (with the chosen process's number), then whyPick's reason and the three lines
            ctx.refit();  // asks the shell to re-check that the step still fits now that the feedback has made it taller
          };  // ends choose
          const btns = N.map((n, j) => h('button', { type: 'button', class: 'btn pbtn', onclick: () => choose(j), html: pchip(n) }));  // btns: one button per process, showing its chip; a click calls choose
          const reset = h('button', { type: 'button', class: 'btn sm ghost', onclick: () => {  // reset: the "Start over" button; its click handler follows
            shown = Q; tries = 0; solved = false; picked = null; inp.value = '';  // hides the rows from t = 6 on again and clears the tries, the choice and the typed number
            fb1.style.display = 'none'; fb2.style.display = 'none';  // hides both feedback boxes
            btns.forEach((b) => b.classList.remove('on', 'right'));  // clears the red and green marks from the process buttons
            drawTable();  // redraws the table
          } }, 'Start over');  // ends the handler; the button's label
          drawTable();  // first drawing of the table
          el.append(h('div', { class: 'split fill' },  // lays out step 5: two equal columns filling the step
            h('div', { class: 'card white tight stack gap-s' }, tbl, after,  // left card: the table and its summary line
              h('div', { class: 'callout why m0 small', style: { marginTop: 'auto' }, 'data-label': 'Why it matters', html: 'Nobody wrote “take turns” into this scheduler. The rotation comes out of the arithmetic: running pushes a process’s number up, and waiting lets it drift back down until it is the most urgent again.' })),  // pushed to the bottom: a why callout, the rotation comes from the arithmetic alone; closes the left card
            h('div', { class: 'stack' },  // right column, stacked
              h('p', { class: 'm0 small', html: 'Seconds 0 to 5 come straight from the simulation. At t = 6 the scheduler halves every count, recomputes every number and picks again.' }),  // intro line: seconds 0 to 5 come from the simulation, and at t = 6 the scheduler decides again
              h('div', { class: 'card stack gap-s' },  // part 1 card
                h('h4', { class: 'm0' }, '1 · C’s priority number at t = 6'),  // its heading: C's priority number at t = 6
                h('div', { class: 'row' }, h('span', { class: 'small' }, 'P for C ='), inp, h('button', { type: 'button', class: 'btn sm primary', onclick: check1 }, 'Check')),  // a row with the "P for C =" label, the number box and the Check button
                fb1),  // part 1's feedback box; closes the card
              h('div', { class: 'card stack gap-s' },  // part 2 card
                h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, '2 · Who runs during second 6?'), reset),  // its heading on the left and the Start over button on the right
                h('div', { class: 'row' }, ...btns),  // the three process buttons in a row
                fb2))));  // part 2's feedback box; closes the card, the columns and the append
        },  // ends render for step 5
      },  // closes step 5

      /* ---------------- 6. Experiment: nice, base and an I/O-bound newcomer ---------------- */
      {  // opens step 6, the experiment
        title: 'Experiment: nice values and an I/O-bound editor',  // step 6 title: nice values and an I/O-bound editor
        kind: 'lab',  // kind 'lab' marks this as a hands-on page
        core: true,  // core: true keeps this step on the shorter core route
        render(el, ctx) {  // render(el, ctx): draws step 6 when the student arrives on it
          const { h, s } = ctx;  // takes the HTML builder h and the SVG builder s out of ctx
          const T = 10, DSTART = 3;  // T: each run lasts 10 seconds; DSTART: the editor D is created at second 3
          const MODES = { off: null, light: { burst: 2, wait: 23 }, heavy: { burst: 12, wait: 21 } };  // MODES: D's work per keystroke: no D, light (2 ticks of work then 23 asleep, a key about every 0.4 s) or heavy (12 then 21)
          const fresh = () => ({ nice: { A: 0, B: 0, C: 0, D: 0 }, base: { A: 60, B: 60, C: 60, D: 60 }, d: 'light' });  // fresh(): the starting settings: every nice 0, every base 60, D in light mode
          let st = fresh();  // st: the current settings, which the controls change
          const svg = s('svg', { width: '100%', role: 'img', 'aria-label': 'Who ran in each tick of each second, and every priority number', style: 'flex:none' });  // svg: the tick-by-tick chart; drawRun sets its size and contents; flex none keeps it from shrinking
          const stats = h('div', { class: 'stats' });  // stats: the row of share boxes, one per process
          const msg = h('div', { class: 'msg' });  // msg: the box that tells the story of the run
          const cells = {};  // cells: every stepper control by name, so run() can refresh its value and buttons
          const stepper = (nm, key, lo, hi, by) => {  // stepper(nm, key, lo, hi, by): a minus, value, plus control for one setting of process nm, kept between lo and hi
            const out = h('span', { class: 'mono b sv' });  // out: shows the setting's current value
            const minus = h('button', { type: 'button', class: 'btn sm', 'aria-label': `lower ${key} of ${nm}`, onclick: () => { st[key][nm] = Math.max(lo, st[key][nm] - by); run(); } }, '−');  // minus button: lowers the setting by one step but not below lo, then reruns; its aria-label names it for screen readers
            const plus = h('button', { type: 'button', class: 'btn sm', 'aria-label': `raise ${key} of ${nm}`, onclick: () => { st[key][nm] = Math.min(hi, st[key][nm] + by); run(); } }, '+');  // plus button: raises the setting by one step but not above hi, then reruns
            cells[nm + key] = { nm, key, out, minus, plus, lo, hi };  // records this stepper in cells
            return h('span', { class: 'stp' }, minus, out, plus);  // returns the three pieces wrapped in one stepper span
          };  // ends stepper
          const rowsEl = ['A', 'B', 'C', 'D'].map((nm) => h('div', { class: 'prow', 'data-p': nm },  // rowsEl: one control row per process
            h('span', { class: 'row gap-s', html: pchip(nm) + `<span class="xs muted">${nm === 'D' ? 'I/O-bound' : 'CPU-bound'}</span>` }),  // first column: the process chip and a grey "CPU-bound" or "I/O-bound" label
            stepper(nm, 'nice', 0, 10, 1), stepper(nm, 'base', 60, 80, 5)));  // then a nice stepper (0 to +10, by 1) and a base stepper (60 to 80, by 5); closes the row
          const dseg = ctx.ui.seg([{ value: 'off', label: 'no D' }, { value: 'light', label: '2 ticks' }, { value: 'heavy', label: '12 ticks' }], st.d, (v) => { st.d = v; run(); });  // dseg: a switch for D's work per key, no D, 2 ticks or 12 ticks; a change reruns
          function procs() {  // procs(): turns the settings into the process list that simulate expects
            const list = ['A', 'B', 'C'].map((name) => ({ name, base: st.base[name], nice: st.nice[name] }));  // A, B and C with their current base and nice values
            if (MODES[st.d]) list.push({ name: 'D', base: st.base.D, nice: st.nice.D, start: DSTART, io: MODES[st.d] });  // D is added (created at t = 3, with its burst pattern) unless it is switched off
            return list;  // returns the list
          }  // ends procs
          function run() {  // run(): reruns the simulation and redraws everything; it is called whenever a setting changes
            Object.values(cells).forEach(({ nm, key, out, minus, plus, lo, hi }) => {  // refreshes every stepper
              const v = st[key][nm], off = nm === 'D' && st.d === 'off';  // v: its current value; off: true for D's steppers while D is switched off
              out.textContent = key === 'nice' && v ? '+' + v : String(v);  // shows the value, with a plus sign for a positive nice value
              minus.disabled = off || v <= lo; plus.disabled = off || v >= hi;  // disables minus at the lower limit and plus at the upper one, and both while D is off
            });  // ends the stepper refresh
            rowsEl[3].classList.toggle('off', st.d === 'off');  // fades D's row (the fourth) while D is off
            const list = procs(), sim = UNIX_SIM.simulate(list, T), total = T * HZ;  // list: the processes; sim: a 10-second run; total: the number of ticks in the run (600)
            drawRun(ctx, svg, sim);  // redraws the chart
            stats.innerHTML = sim.names.map((nm, j) => {  // rebuilds the share boxes, one per process
              const pct = Math.round((sim.used[j] / total) * 100);  // pct: this process's share of all the ticks, as a whole percent
              return `<div class="stat ${PCOL[nm]}"><div class="row gap-s">${pchip(nm)}<b>${pct}%</b><span class="xs muted">${sim.used[j]} ticks</span></div><div class="meter"><i style="width:${pct}%;background:var(--pc)"></i></div></div>`;  // its box: chip, percent and tick count, then a meter filled to that percent in the process's color
            }).join('');  // ends the share boxes
            /* The story the numbers tell, all computed from this run. */
            const parts = [];  // parts: the sentences of the story, joined at the end
            let kind = 'info', head = 'What happened', locked = false;  // kind: the message color; head: its heading; locked: set when a process was shut out, which adds a closing note
            const dj = sim.names.indexOf('D');  // dj: D's index in this run, or -1 when D is off
            const shut = ['A', 'B', 'C'].filter((nm) => !sim.used[sim.names.indexOf(nm)]);  // shut: those of A, B and C that never ran at all
            const changed = ['A', 'B', 'C'].filter((nm) => st.nice[nm] || st.base[nm] !== 60);  // changed: those of A, B and C whose nice value or base differs from the start
            const niceOf = (nm) => (st.nice[nm] ? '+' + st.nice[nm] : '0');  // niceOf(nm): nm's nice value as text, with a plus sign when positive
            /* D's story; it is told briefly when A, B or C also has a story, so the box keeps its size. */
            const brief = shut.length > 0 || changed.length > 0;  // brief: true when A, B or C has its own story, so D's is told in short
            if (dj >= 0) {  // D's story, told only when D is part of this run
              const w = sim.waits[dj], live = sim.rows.filter((r) => r.vals[dj].state !== 'none'), pend = sim.pending[dj];  // w: D's keystroke waits; live: the seconds in which D exists; pend: how long its unanswered key has waited at the end (-1 if none)
              const maxCnt = Math.max(...live.map((r) => r.vals[dj].count)), maxP = Math.max(...live.map((r) => r.vals[dj].prio));  // maxCnt and maxP: the highest count and the highest priority number D reached
              const stuck = pend >= HZ;  // stuck: true when an unanswered key has been waiting for a whole second (60 ticks) or more
              if (!sim.used[dj] || !w.length) {  // D never ran, or never got to answer a single keystroke
                kind = 'bad'; head = 'D starved'; locked = true;  // a red "D starved" message, plus the closing note about lockout
                parts.push((sim.used[dj] ? 'D ran only its first burst; no keystroke was ever answered' : 'D never got the processor') +  // says whether D ran only its first burst or never ran at all
                  (brief ? '.' : `: at every choice some busy process had a smaller number than D’s ${sim.used[dj] ? `(up to ${maxP})` : maxP}.`));  // the long version adds why: some busy process always had a smaller number than D's
              } else {  // otherwise D answered at least one key
                const avg = w.reduce((a, b) => a + b, 0) / w.length, mx = Math.max(...w);  // avg: the average wait in ticks; mx: the worst wait
                if (mx === 0 && !stuck) {  // every key answered without waiting, and none left hanging
                  kind = 'ok'; head = 'Quick service';  // a green "Quick service" message
                  parts.push(brief ? `D still answered all ${w.length} keystrokes at once.`  // short version: D still answered every key at once
                    : `D answered all ${w.length} keystrokes at once: its number (at most ${maxP}, as its count never passed ${maxCnt}) was always smaller than the running process’s. Nobody told the scheduler D is interactive; its light use did that.`);  // long version: D's number stayed small because its count stayed small; its own light use made it get treated as interactive
                } else {  // otherwise some key had to wait
                  if (stuck) { kind = 'bad'; head = 'D falls behind'; }  // a key still unanswered after a second or more turns the message red: "D falls behind"
                  const late = stuck ? ` Its latest keystroke has waited ${ctx.util.fmt(pend / HZ, 1)} s and is still unanswered at the end.` : '';  // late: a sentence about that unanswered key and its wait in seconds (ctx.util.fmt rounds to 1 decimal place)
                  if (brief) parts.push(`D’s answered keystrokes waited up to ${ctx.util.fmt(mx / HZ, 2)} s.${stuck ? ' Its latest is still unanswered at the end.' : ''}`);  // short version: the worst wait in seconds, plus a note if a key is still unanswered
                  else parts.push((w.length > 1 ? `D’s ${w.length} answered keystrokes waited ${ctx.util.fmt(avg, 1)} ticks on average, ${mx} ticks (${ctx.util.fmt(mx / HZ, 2)} s) at worst.`  // long version: how many keys were answered, their average wait and their worst wait in ticks and seconds
                    : `D’s one answered keystroke waited ${mx} ticks (${ctx.util.fmt(mx / HZ, 2)} s).`) + late +  // or, for a single answered key, just its wait; then the late sentence
                    ` D’s number (up to ${maxP}) was not always below the runner’s, so some keys waited for a whole-second decision.`);  // and why: D's number was not always below the runner's, so some keys waited for the next whole-second decision
                }  // ends the waiting case
              }  // ends the answered case
            }  // ends D's story
            if (shut.length) { kind = 'bad'; head = 'Starvation'; locked = true; parts.unshift(`${listOf(shut)} never ran: ${shut.length > 1 ? 'their numbers stay' : 'its number stays'} above the best number the others keep falling back to.`); }  // if any of A, B and C never ran: a red "Starvation" message, its sentence put first (unshift adds to the front)
            else if (changed.length) parts.push(`${listOf(changed.map((nm) => `${nm} (nice ${niceOf(nm)}, base ${st.base[nm]})`))} got ${listOf(changed.map((nm) => Math.round((sim.used[sim.names.indexOf(nm)] / total) * 100) + '%'))} of the processor; a bigger number means fewer turns.`);  // otherwise, if their settings changed: each changed process's settings and its share of the processor
            else if (dj < 0) parts.push('Three equal processor-bound processes: each gets about a third of the processor, in strict rotation.');  // otherwise, with no D either: the plain result, an equal three-way rotation
            /* Decay protects a process that is behind only because of its own recent use; it never erases nice or base. */
            if (locked) parts.push('Halving erases recent use, never a nice value or a bigger base, so in this pure halving model a big enough penalty locks a process out (4.3 BSD’s slower decay on a busy system made that far rarer).');  // when a process was shut out, adds that halving never erases nice or base, and that a slower decay made this rarer in practice
            say(msg, kind, head, parts.join(' '));  // shows the story in the message box with its color and heading
          }  // ends run
          const reset = h('button', { type: 'button', class: 'btn sm', onclick: () => { st = fresh(); dseg.set(st.d); run(); } }, 'Back to the start');  // reset: "Back to the start" restores the starting settings, sets D's switch back without triggering it, and reruns
          run();  // first run when the step opens
          el.append(h('div', { class: 'split l3 fill' },  // lays out step 6: the left column one third wide, the right two thirds, filling the step
            h('div', { class: 'stack' },  // left column, stacked
              h('p', { class: 'm0', html: 'A, B and C are <span class="t" data-t="Processor-bound process">processor-bound</span>: they compute nonstop. At t = 3 you open an editor, <b>D</b>, which is <span class="t" data-t="I/O-bound process">I/O-bound</span>: each keystroke needs a short burst of processor time, then D sleeps until the next key arrives about 0.4 s later.' }),  // intro: A, B and C compute nonstop; D, an I/O-bound editor, arrives at t = 3 and needs a short burst per keystroke
              h('div', { class: 'card stack gap-s ctl' },  // controls card
                h('div', { class: 'prow head xs muted b' }, h('span', {}, 'process'), h('span', {}, 'nice'), h('span', {}, 'base')),  // its header row: process, nice, base
                ...rowsEl,  // the four process rows
                h('div', { class: 'row' }, h('span', { class: 'small b' }, 'D’s work per key'), dseg)),  // last row: the "D's work per key" label and its switch; closes the card
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'xs muted' }, 'nice 0 to +10 (ordinary user) · base 60 to 80'), reset),  // a row with the allowed ranges on the left and the reset button on the right
              h('div', { class: 'callout tip m0 small', 'data-label': 'Try this', html: 'Give D nice +2, then +5. Put it back to 0 and switch D to 12-tick bursts. Finally give A nice +6, then +10.' })),  // try-this callout: the settings to try, in order; closes the left column
            h('div', { class: 'stack' },  // right column, stacked
              h('div', { class: 'card white tight stack gap-s' }, svg,  // a white card holding the chart
                h('p', { class: 'xs muted m0' }, 'PA to PD: priority numbers at the start of each second; underlined = picked, grey = asleep, – = not created yet. Model rule: a key that wakes D lets it take over at once only if D’s number is strictly smaller than the running process’s.')),  // key under the chart: what PA to PD show, what underlined, grey and a dash mean, and the model's wake-up rule; closes the card
              stats, msg)));  // the share boxes and the story box; closes the columns and the append
        },  // ends render for step 6
      },  // closes step 6

      /* ---------------- 7. Recap ---------------- */
      {  // opens step 7, the recap
        title: 'Recap: six ideas to carry with you',  // step 7 title: six ideas to carry away
        kind: 'recap',  // kind 'recap': a review page, always on the core route
        render(el, ctx) {  // render(el, ctx): draws step 7 when the student arrives on it
          const { h } = ctx;  // takes the HTML builder h out of ctx
          el.append(h('div', { class: 'stack fill' },  // lays out the recap: one stack filling the step
            h('p', { class: 'lead m0' }, 'Click each card. Say the answer out loud before you flip it.'),  // instruction: click each card, but say the answer out loud first
            ctx.ui.flipcards([  // the shell's flip cards, each given as [front, back]
              ['Which wins: priority number 63 or 76?', '<b>63.</b> In UNIX a smaller number means a higher priority. Recent processor use only ever adds to the number.'],  // card 1: which wins, 63 or 76
              ['The once-a-second update, in two lines', 'Halve: <span class="mono">CPU = CPU / 2</span>. Then <span class="mono">P = Base + CPU/2 + nice</span>. Every division rounds down.'],  // card 2: the once-a-second update in two lines
              ['Why halve the count every second?', 'Usage decay: recent use counts fully, old use fades fast (60 → 30 → 15 → 7 → 3 → 1 → 0), so a heavy user is forgiven within seconds.'],  // card 3: why the count is halved, with the fading sequence from 60 down to 0
              ['The five bands, highest first', 'Swapper · block I/O device control · file manipulation · character I/O device control · user processes. Device work goes first so devices stay busy.'],  // card 4: the five bands from highest to lowest
              ['Why does an editor feel snappy?', 'It uses little processor time, so its count and its number stay small. When a key arrives, it outranks the busy processes.'],  // card 5: why an editor feels snappy
              ['What stops one busy process from hogging the processor?', 'One-second preemption plus its rising count: after a second it is preempted, its number is now the worst, and the others take turns.'],  // card 6: what stops one busy process from hogging the processor
            ], { cols: ctx.narrow ? 1 : 3, height: 150 }),  // closes the card list: one column on a small screen, three otherwise, each card 150 pixels tall
            h('div', { class: 'callout why m0', 'data-label': 'Then and now', html: 'The halving formula is the classic model, and real systems tuned it: 4.3 BSD, for one, let old use fade more slowly on a busy system, so a niced job was rarely shut out. Modern systems use different schedulers: Linux used the Completely Fair Scheduler from version 2.6.23 and replaced it with EEVDF in 6.6, and FreeBSD uses ULE. The idea you just practiced, that a process which has recently used a lot of processor time should step aside for lighter users, lives on in their designs, and the <code>nice</code> command still exists.' })));  // then-and-now callout: how real systems tuned the classic model and what replaced it; closes the layout
        },  // ends render for step 7
      },  // closes step 7

      /* ---------------- 8. Check yourself ---------------- */
      {  // opens step 8, the section quiz
        title: 'Check yourself',  // step 8 title
        kind: 'check',  // kind 'check': the quiz page whose first-try score counts toward mastery
        quiz: [  // quiz: the questions; the shell's quiz engine draws them, checks the answers and shows feedback
          { q: 'Under the traditional UNIX scheduler, ready process X has priority number 63 and ready process Y has priority number 76. What happens at the next scheduling decision?',  // question 1 (multiple choice): X at 63 and Y at 76, which runs next
            choices: ['Y runs, because a bigger number means a higher priority', 'X runs, because a smaller number means a higher priority', 'X and Y alternate on every clock tick, because both are user processes', 'Whichever has the smaller nice value runs, whatever the priority numbers say'],  // the four choices: Y because bigger, X because smaller, take turns each tick, the smaller nice value wins
            answer: 1,  // answer: choice 1 (counting from 0), X runs
            feedback: ['That is backwards. In UNIX a bigger number means less urgent: recent processor use is added to the number to push a busy process back.', null, 'Turns are taken only among processes with the same number, and a turn lasts up to a second, not a single tick.', 'The nice value is already part of the priority number. The scheduler compares the final numbers.'],  // feedback for each wrong choice (null for the right one): bigger is less urgent, turns only among equals, nice is already counted
            why: 'Lower number = higher priority. With 63 against 76, X is more urgent and runs first.' },  // explanation shown after answering: a lower number is a higher priority; closes question 1
          { type: 'num', q: 'A user process has base priority 60 and nice value 0. At the end of a second its CPU count is 50. Using whole-number division, what is its priority number after the once-a-second update?',  // question 2 (calculate): the priority number from a count of 50
            answer: 72, tol: 0,  // answer 72, which must be exact (tolerance 0)
            hint: 'Halve the count first, then halve again inside the formula.',  // hint shown after a wrong try: halve twice
            why: 'Halve: CPU = 50 / 2 = 25. Then P = 60 + ⌊25 / 2⌋ + 0 = 60 + 12 = 72.' },  // explanation: the worked arithmetic; closes question 2
          { type: 'num', q: 'A user process (base 60, nice 0) has a CPU count of 40 at the end of second 9. It does not run at all during seconds 10 and 11. What is its priority number at t = 12?',  // question 3 (calculate): a count of 40 and two idle seconds, then the number at t = 12
            answer: 62, tol: 0,  // answer 62, exact
            hint: 'Three updates happen: at t = 10, t = 11 and t = 12. Each one halves the count.',  // hint: three halvings happen, not two
            why: 'The count halves at each update: 40 → 20 (t = 10) → 10 (t = 11) → 5 (t = 12). So P = 60 + ⌊5 / 2⌋ + 0 = 62. Waiting lets the number drift back toward the base.' },  // explanation: the count halves three times on the way to t = 12; closes question 3
          { type: 'order', q: 'Put the traditional UNIX priority bands in order, from highest priority to lowest.',  // question 4 (put in order): the five bands, highest priority first
            items: ['Swapper', 'Block I/O device control', 'File manipulation', 'Character I/O device control', 'User processes'],  // the bands written in the correct order; the quiz engine shuffles them for the student
            why: 'The swapper comes first because everything may depend on memory; then the work that drives disks, then file work, then terminals and other character devices, and finally ordinary user processes.' },  // explanation: why each band sits where it does; closes question 4
          { type: 'tf', q: 'An ordinary user may give their own process a negative nice value so that it runs sooner than other users’ processes.',  // question 5 (true or false): an ordinary user giving a process a negative nice value
            answer: false,  // answer: false
            why: 'An ordinary user can only make a process “nicer”, raising its nice value and so its priority number. Only the superuser may lower a nice value to make a process more urgent.' },  // explanation: only the superuser may lower a nice value; closes question 5
          { type: 'multi', q: 'Which statements describe the traditional UNIX scheduler (as in System V Release 3 and 4.3 BSD)?',  // question 6 (select all that apply): which statements describe this scheduler
            choices: ['It keeps several priority queues and uses round robin inside each queue', 'A process that runs for a whole second without blocking or finishing is preempted', 'Every priority is recomputed on every clock tick', 'Each process’s recent processor use is shrunk once a second (halved, in the classic formula)', 'Each process must state its expected running time when it starts'],  // five statements: queues with round robin, one-second preemption, recompute on every tick, shrink once a second, running-time estimates
            answer: [0, 1, 3],  // the true ones: statements 0, 1 and 3
            why: 'It is a multilevel feedback scheme with round robin inside each level and one-second preemption. Counts grow on every tick but are shrunk (halved, in the classic formula) and turned into priorities only once a second, and no running-time estimates are needed.' },  // explanation: counts grow each tick but priorities are recomputed once a second, and no estimates are needed; closes question 6
          { q: 'Why does an I/O-bound text editor tend to get the processor quickly under this scheduler?',  // question 7 (multiple choice): why an I/O-bound editor gets the processor quickly
            choices: ['The system gives interactive programs such as editors a permanent negative nice value', 'I/O-bound processes are moved up into the swapper band, which is served before all others', 'It uses little processor time, so its CPU count and therefore its priority number stay small', 'Editors are usually started first, and among user processes the oldest one always wins'],  // choices: a permanent negative nice, the swapper band, little processor use keeps its number small, being started first
            answer: 2,  // answer: choice 2, its light processor use
            feedback: ['No special nice value is involved; the editor earns its small number by using little processor time.', 'The swapper band holds the swapper, the kernel process that moves processes between memory and disk.', null, 'Creation order only breaks exact ties between equal numbers; it does not make a process win in general.'],  // feedback for each wrong choice: no special nice value, the swapper band is for the swapper only, creation order only breaks exact ties
            why: 'The count rises only while a process runs. An editor runs in short bursts and then sleeps, so its count and number stay low and it outranks processor-bound processes when it wakes.' },  // explanation: the count rises only while a process runs, so an editor's number stays low; closes question 7
          { type: 'bucket', q: 'A user process has been using the processor heavily. Sort each change by its effect on the process’s priority number.',  // question 8 (sort into groups): how each change moves a busy process's number
            buckets: ['Number goes up (less urgent)', 'Number goes down (more urgent)'],  // the two groups: number goes up (less urgent) or number goes down (more urgent)
            items: [['The user raises its nice value by 5', 0], ['The superuser lowers its nice value by 5', 1], ['It sleeps for several seconds waiting for input', 1], ['Its base priority number is raised by 10', 0], ['Its CPU count rises from 10 to 50 before the update', 0]],  // five changes, each with its correct group (0 = up, 1 = down): raise nice, superuser lowers nice, sleep, bigger base, rising count
            why: 'Anything that adds to Base, CPU/2 or nice makes the number bigger. Lowering nice (superuser only) or letting the count shrink by sleeping makes it smaller.' },  // explanation: adding to any term raises the number; lowering nice or sleeping lowers it; closes question 8
          { type: 'match', q: 'Match each part of the UNIX priority formula to its meaning.',  // question 9 (match the pairs): each symbol of the formula and its meaning
            pairs: [['CPU<sub>j</sub>(i)', 'Recent processor use of process j, in clock ticks, halved each second'], ['P<sub>j</sub>(i)', 'Priority number of process j at the start of interval i'], ['Base<sub>j</sub>', 'Fixed starting priority that places process j in its band'], ['nice<sub>j</sub>', 'Adjustment a user can raise to make process j less urgent']],  // the four pairs: the CPU count, the priority number, the base and nice, each with its meaning
            why: 'CPU_j(i) is the decaying usage count, P_j(i) the result, Base_j the fixed starting point, and nice_j the user-controlled adjustment.' },  // explanation: one line naming the role of each part; closes question 9
          { q: 'Three user processes all have base priority 60. After the halving at t = 4 their CPU counts are X = 12, Y = 9 and Z = 20. X and Z have nice 0; Y has nice +4. Which process runs during second 4?',  // question 10 (multiple choice): X, Y and Z after the halving at t = 4, which one runs
            choices: ['X', 'Y', 'Z', 'X and Y share the second because they tie'],  // the choices: X, Y, Z, or a tie between X and Y
            answer: 0,  // answer: choice 0, X
            feedback: [null, 'Y has the smallest count, but its nice value pushes it to 60 + 4 + 4 = 68, worse than X’s 66.', 'Z has the biggest count: 60 + 10 + 0 = 70, the worst of the three.', 'There is no tie: X has 66 and Y has 68.'],  // feedback for each wrong choice: Y's nice value pushes it to 68, Z's count gives it 70, and there is no tie
            why: 'X: 60 + ⌊12/2⌋ + 0 = 66. Y: 60 + ⌊9/2⌋ + 4 = 68. Z: 60 + ⌊20/2⌋ + 0 = 70. The smallest number, 66, belongs to X.' },  // explanation: all three numbers worked out, with X smallest at 66; closes question 10
          { q: 'Why are the bands for processes that drive I/O devices placed above the user band?',  // question 11 (multiple choice): why the device bands sit above the user band
            choices: ['Because device-driving code is written by the superuser and has to be trusted more than ordinary user code', 'Because user processes running ahead of them could otherwise corrupt the data that is stored on the devices', 'So that device-driving processes can never be preempted once they have started a transfer to a device', 'So each device gets its next request quickly and stays busy, at little cost: that work needs only short bursts'],  // choices: trust in who wrote the code, protection from corruption, freedom from preemption, keeping devices busy cheaply
            answer: 3,  // answer: choice 3
            feedback: ['Who wrote the code has nothing to do with it; the ordering is about keeping devices busy.', 'Protection from corruption comes from the kernel’s control of devices, not from priority bands.', 'Being high priority does not make a process unpreemptable; the ordering simply lets it go first when it is ready.', null],  // feedback for each wrong choice: authorship does not matter, protection comes from the kernel, high priority can still be preempted
            why: 'A process waiting on a device needs the processor only briefly to start the next transfer. Running it first keeps disks and terminals busy and responsive while costing everyone else very little.' },  // explanation: device work needs only short bursts, so running it first keeps devices busy; closes question 11
          { q: 'Under the halving formula, three processor-bound user processes with base 60 and nice 0 compute nonstop. A fourth processor-bound process with base 60 is started with nice +5. What happens to it while the other three keep running?',  // question 12 (multiple choice): a fourth busy process started with nice +5, what happens to it
            choices: ['It gets about a quarter of the processor, because usage decay eventually makes every process take its turn', 'It runs ahead of the other three, because a bigger nice value gives a process a higher scheduling priority', 'It never runs: the busy processes keep falling back to numbers no worse than 64, and its nice value never decays', 'It waits a few seconds until halving brings its own priority number down to 64, then joins the rotation'],  // choices: a quarter share, it runs ahead, it never runs, it joins after a few seconds
            answer: 2,  // answer: choice 2, it never runs
            feedback: ['Decay only shrinks the CPU term. The nice value is a fixed penalty that halving never removes, so the fourth process is not guaranteed a turn.', 'A bigger nice value makes the priority number bigger, which means less urgent.', null, 'Its count is already 0, so halving cannot lower its number below 60 + 0 + 5 = 65, and the busy processes keep returning to 64 or better.'],  // feedback for each wrong choice: decay never removes nice, a bigger nice is less urgent, its number cannot drop below 65
            why: 'With three equal busy processes, the one that has waited longest is back to 64 or better at every decision, while the newcomer can never do better than 65. Usage decay protects a process that is behind only because of its own recent use; a large nice value can still starve a job in this pure halving model.' },  // explanation: the busy three keep returning to 64 or better, so a large nice value starves this job; closes question 12
        ],  // closes the quiz list
      },  // closes step 8

    ],  // closes the steps list

    notes: `${/* notes: the printable summary of this section, written as HTML; it appears in the notes drawer and the print view */''}
      <h3>Traditional UNIX scheduling</h3>${/* notes heading with the section title */''}
      <p>The traditional UNIX scheduler (as in System V Release 3 and 4.3 BSD) was designed for interactive time sharing: many people at terminals plus some long background jobs, all sharing one processor. It had two goals that pull against each other: give interactive users fast response, and make sure low-priority background jobs still make progress instead of starving.</p>${/* notes paragraph: what the scheduler was designed for and its two competing goals */''}
      <h4>Structure</h4>${/* notes heading for the structure */''}
      <ul>${/* starts the list of the four structural features */''}
        <li><b>Priority numbers, lower is better.</b> Every process has a priority number. The scheduler runs the ready process with the <b>smallest</b> number, so 63 beats 76.</li>${/* list item: priority numbers, where lower is better */''}
        <li><b>Multilevel feedback queues with round robin.</b> There is a ready queue for each priority level; the scheduler serves the best non-empty queue, and processes with the same number take turns (round robin). A process moves between levels as its recent behavior changes its number.</li>${/* list item: multilevel feedback queues with round robin inside each level */''}
        <li><b>One-second preemption.</b> A process that has run for a whole second without blocking or finishing is preempted, and a fresh choice is made. If it blocks sooner (for example to wait for a keystroke), the next process is picked at once.</li>${/* list item: one-second preemption, and what happens when a process blocks sooner */''}
        <li><b>Once-a-second recalculation.</b> The clock ticks 60 times a second and each tick adds 1 to the running process’s CPU count. Once a second every count is halved and every priority recomputed.</li>${/* list item: 60 ticks a second, then the once-a-second halving and recompute */''}
      </ul>${/* ends the structure list */''}
      <h4>The five priority bands</h4>${/* notes heading for the five bands */''}
      <p>Base priorities divide all processes into fixed bands. From highest priority to lowest:</p>${/* notes lead-in: base priorities divide processes into fixed bands */''}
      <ol>${/* starts the numbered list of bands */''}
        <li><b>Swapper</b>: the kernel process that moves whole processes between memory and disk. If it waited, a memory jam might never clear.</li>${/* band 1: the swapper, and why it comes first */''}
        <li><b>Block I/O device control</b>: processes waiting for disks and other block devices. Running them at once keeps the disk busy and frees buffers.</li>${/* band 2: block I/O device control, and why it is so high */''}
        <li><b>File manipulation</b>: processes waiting inside file-system code; they often hold resources other processes need.</li>${/* band 3: file manipulation, and why */''}
        <li><b>Character I/O device control</b>: processes waiting for terminals and other character devices; they need only short bursts, so serving them first keeps terminals responsive.</li>${/* band 4: character I/O device control, and why */''}
        <li><b>User processes</b>: ordinary programs running their own code. The formula below sorts processes inside this band.</li>${/* band 5: user processes, which the formula sorts */''}
      </ol>${/* ends the band list */''}
      <p>Putting device-driving work first keeps the I/O devices busy, and costs little because that work runs only briefly each time. The CPU and nice terms are limited so a process can never leave its band. (A process is in an upper band while it waits inside the kernel for that kind of event; once it runs its own code again it is back in the user band.)</p>${/* notes paragraph: why device work goes first, and why a process cannot leave its band */''}
      <h4>The formula</h4>${/* notes heading for the formula */''}
      <pre>CPU_j(i) = CPU_j(i - 1) / 2${/* the formula as preformatted text, line 1: the halving of the CPU count */''}
P_j(i)   = Base_j + CPU_j(i) / 2 + nice_j</pre>${/* formula line 2: the priority number; closes the preformatted block */''}
      <ul>${/* starts the list that explains each symbol */''}
        <li><b>j</b> names the process and <b>i</b> the one-second interval. All division rounds down (whole numbers only).</li>${/* list item: what j and i mean, and that every division rounds down */''}
        <li><b>CPU_j(i)</b>: process j’s recent processor use: +1 per clock tick while it runs, halved once a second.</li>${/* list item: the CPU count */''}
        <li><b>P_j(i)</b>: its priority number at the start of interval i (lower = more urgent).</li>${/* list item: the priority number */''}
        <li><b>Base_j</b>: its fixed base priority, which picks its band (60 for the user processes in the examples).</li>${/* list item: the base priority */''}
        <li><b>nice_j</b>: a user-controlled adjustment. An ordinary user can only raise it (be “nicer”, less urgent); only the superuser can lower it.</li>${/* list item: the nice value and who may move it which way */''}
      </ul>${/* ends the symbol list */''}
      <p><b>Worked example.</b> A process (base 60, nice 0) ends a second with count 67. Halve: ⌊67/2⌋ = 33. Then P = 60 + ⌊33/2⌋ + 0 = 60 + 16 = <b>76</b>.</p>${/* notes paragraph: the worked example, a count of 67 giving P = 76 */''}
      <p><b>Usage decay.</b> A process that stops running sees its count halve every second: 60 → 30 → 15 → 7 → 3 → 1 → 0, so its number drifts back to its base within a few seconds. A process that runs nonstop gains 60 before each halving, so its count levels off just under 60 and its number near base + 29, instead of growing forever. Recent use matters; old use is forgotten. (Halving is the classic form, close to System V’s; 4.3 BSD used the same idea with different weights, a 0.1-second time slice and a decay factor tied to the load average, so old use faded more slowly on a busy system.)</p>${/* notes paragraph: usage decay for an idle process and for a busy one, and how the 4.3 BSD version differed */''}
      <h4>The classic trace</h4>${/* notes heading for the classic trace */''}
      <p>A, B and C are created together with base 60 and nice 0; there are 60 ticks a second; ties go to the process that has waited longest (and, if that is equal too, the one created first). Values are shown at the start of each second, after the halving:</p>${/* notes paragraph: the setup and the tie rule behind the trace */''}
      ${NOTE.trace}${/* inserts the trace table that NOTE computed from the simulation */''}
      <p>At t = 6: A’s count 16 halves to 8, so P = 60 + 4 = 64; B: 33 → 16, P = 68; C ran in second 5, so 7 + 60 = 67 → 33, P = 76. A has the smallest number and runs. From t = 3 the order repeats A, B, C: the arithmetic itself produces round robin, and none of the three starves.</p>${/* notes paragraph: the t = 6 arithmetic and the round robin that comes out of it */''}
      <h4>Why I/O-bound processes get quick service</h4>${/* notes heading: why I/O-bound processes get quick service */''}
      <p>An I/O-bound process such as an editor runs in short bursts and then sleeps, so its count stays tiny and its number stays near its base. Processor-bound processes keep pushing their own numbers up. In the guide’s experiment, an editor D joins A, B and C at t = 3 and needs 2 ticks per keystroke: its count never passes ${NOTE.light.cnt}, its number never passes ${NOTE.light.p}, and each of its ${NOTE.light.n} keystrokes is served at once. (The model’s rule: a waking process takes over at once only if its number is strictly smaller than the running process’s; otherwise it waits for a whole-second decision.)</p>${/* notes paragraph: the light editor's numbers, filled in from NOTE, and the model's wake-up rule */''}
      <p>Nice values change this. With D at nice +2 its keystrokes wait ${NOTE.nice2.avg.toFixed(1)} ticks on average; at nice +5 it never runs at all, because the busy processes keep falling back to numbers below D’s. If D needs 12 ticks per keystroke instead, its count climbs to ${NOTE.heavy.cnt} and its number to ${NOTE.heavy.p}, and some keystrokes wait up to ${NOTE.heavy.max} ticks. Giving processor-bound A nice +6 cuts its share over 30 seconds to ${NOTE.a6}%; at nice +10 it gets ${NOTE.a10}% in this simple model, because B and C alternate and the waiting one is always below 70. Nice is a blunt tool.</p>${/* notes paragraph: how nice values and heavier bursts change the results, with NOTE's numbers */''}
      <h4>What decay does and does not guarantee</h4>${/* notes heading: what decay does and does not guarantee */''}
      <p>The design goal was that low-priority background jobs do not starve, and decay delivers that for jobs that are low only because of their <b>own recent use</b>: while such a job waits, its count halves every second until its number is back near its base, below the numbers of the processes that are running. That is why A, B and C, or a compiler running next to other busy jobs with the same base and nice value, all keep getting turns. Decay never touches a <b>nice value</b> or a bigger base, though. With three busy processes at nice 0, the one that has waited longest is back to 64 or better at every decision, so a fourth job at nice +5 (never better than 65) does not run at all while they stay busy. Real systems softened this: 4.3 BSD’s slower, load-based decay keeps busy processes’ numbers higher, which made such lockouts far rarer.</p>${/* notes paragraph: decay stops starvation caused by a job's own use, but not by a nice value or a bigger base */''}
      <h4>Today</h4>${/* notes heading: today */''}
      <p>Modern systems use different schedulers: Linux used the Completely Fair Scheduler from version 2.6.23 and replaced it with EEVDF in 6.6, and FreeBSD uses ULE. The idea that recent heavy processor use should lower a process’s priority, so lighter and interactive work goes first, lives on, and the nice command still exists.</p>${/* notes paragraph: the modern schedulers that replaced this one, and the idea that survives */''}
    `,  // end of the notes text
  });  // ends the section object and the Guide.section call
})();  // ends the wrapper function, and the () runs it at once
