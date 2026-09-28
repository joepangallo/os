/* Section 2.2 — The Evolution of Operating Systems
   Original teaching material. Built step by step. */
Guide.section({
  id: '2.2',
  title: 'The Evolution of Operating Systems',
  short: 'Evolution of OSs',
  summary: 'From hands-on machines to batch monitors, multiprogramming and time sharing, and why each step came.',
  objectives: [
    'Explain why operating systems keep evolving: hardware upgrades, new services and fixes.',
    'Describe serial processing and its two big problems, scheduling and setup time.',
    'Explain how a simple batch system works: the resident monitor, job control language, the hardware it needs, and user versus kernel mode.',
    'Calculate processor utilization and show how multiprogramming raises it compared with uniprogramming.',
    'Contrast batch multiprogramming with time sharing, and describe how CTSS shared one processor among many users.',
  ],
  terms: [
    ['Job', 'One unit of work handed to a computer: a program, its data, and the instructions for how to run it.'],
    ['Serial processing', 'The earliest way of using a computer (late 1940s to mid-1950s): no operating system at all, and programmers took turns operating the hardware directly, one job after another.'],
    ['Setup time', 'Time spent getting a job ready to run (loading the compiler, the source program, linking and loading the result) during which the machine produces nothing useful.'],
    ['Batch system', 'A system in which users hand their jobs to an operator, who groups them into a batch; a monitor program then runs the jobs one after another with no human in between.'],
    ['Resident monitor', 'The controlling program of a simple batch system. It stays in main memory at all times, reads each job, starts it, and takes control back when the job ends.'],
    ['Job control language (JCL)', 'A small command language whose statements, such as $JOB, $FTN, $LOAD, $RUN and $END, tell the monitor what to do with a job.'],
    ['Memory protection', 'Hardware that stops a running program from changing memory it does not own, such as the area that holds the monitor.'],
    ['Timer', 'A hardware countdown the OS sets before letting a program run. When it reaches zero it interrupts the program so the OS gets the processor back.'],
    ['Privileged instruction', 'A machine instruction (for example, one that starts I/O) that the hardware lets only the OS execute. If a user program tries it, the hardware stops it and hands control to the OS.'],
    ['User mode', 'The restricted processor mode in which ordinary programs run: protected memory and privileged instructions are off-limits.'],
    ['Kernel mode', 'The unrestricted processor mode in which the OS runs: it may execute privileged instructions and touch protected memory. Also called system mode or control mode.'],
    ['Uniprogramming', 'Running just one user program at a time. The processor sits idle whenever that program waits for I/O.'],
    ['Multiprogramming', 'Keeping several programs in memory at once so that when one must wait for I/O the processor can run another. Also called multitasking.'],
    ['Processor utilization', 'The fraction of time the processor is busy doing useful work: busy time divided by total time.'],
    ['Throughput', 'How much work a system finishes per unit of time, for example jobs completed per hour.'],
    ['Response time', 'The time from submitting a request or job until its result comes back.'],
    ['Time sharing', 'Sharing one processor among many interactive users at terminals by giving each a short turn in rotation, so every user gets quick answers.'],
    ['Time slice', 'The short stretch of processor time a program gets before the OS may switch to another program. Also called a quantum.'],
    ['Swapping', 'Copying a program\'s memory image out to disk to make room for another program, and later copying it back so it can continue where it left off.'],
    ['Compatible Time-Sharing System (CTSS)', 'One of the first time-sharing operating systems, built at MIT in 1961 for the IBM 709 and later the IBM 7094.'],
  ],

  css: `
    /* shell workaround: in narrow mode the nowrap eyebrow otherwise sets the canvas min-width and the page gets clipped */
    .sec-2-2 .step-eyebrow { contain: inline-size; }
    .sec-2-2 .era-card { transition: background .25s, border-color .25s; }
    .sec-2-2 .era-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .sec-2-2 .era-grid > div { border-radius: 10px; padding: 8px 11px; font-size: 14.5px; line-height: 1.4; }
    .sec-2-2 .era-grid .lbl { display: block; font-size: 11.5px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; margin-bottom: 2px; }
    .sec-2-2 .hot { cursor: pointer; }
    .sec-2-2 .hot:hover rect, .sec-2-2 .hot:hover circle { stroke-width: 3.5; }
    .sec-2-2 .deck { display: flex; flex-direction: column; gap: 5px; }
    .sec-2-2 .deck-row { display: grid; grid-template-columns: 22px 1fr auto; align-items: center; gap: 8px; padding: 3px 6px 3px 8px; border: 2px solid var(--line); border-radius: 9px; background: var(--panel); font-size: 15px; line-height: 1.25; min-height: 42px; }
    .sec-2-2 .deck-row .nm { font-family: var(--mono); font-weight: 800; }
    .sec-2-2 .deck-row .nm.ctl { color: var(--os); }
    .sec-2-2 .deck-row .nm.usr { color: var(--proc); font-family: var(--font); font-weight: 650; }
    .sec-2-2 .deck-row .ix { font-size: 12px; font-weight: 800; color: var(--muted); text-align: center; }
    .sec-2-2 .deck-row .mv { display: flex; gap: 3px; }
    .sec-2-2 .deck-row .mv button { width: 28px; height: 26px; border-radius: 7px; border: 1px solid var(--line-2); background: var(--panel-2); cursor: pointer; font-size: 12px; color: var(--ink-2); }
    .sec-2-2 .deck-row .mv button:disabled { opacity: .35; cursor: default; }
    .sec-2-2 .deck-row.cur { border-color: var(--chc); background: color-mix(in srgb, var(--chc) 12%, var(--panel)); }
    .sec-2-2 .deck-row.done { border-color: color-mix(in srgb, var(--ok) 55%, transparent); }
    .sec-2-2 .deck-row.bad { border-color: var(--bad); background: var(--bad-bg); }
    .sec-2-2 .deck-row.skip { opacity: .45; }
    .sec-2-2 .feat { display: grid; grid-template-columns: 1fr auto; gap: 1px 10px; align-items: center; padding: 6px 10px; border: 2px solid var(--line); border-radius: 10px; background: var(--panel); }
    .sec-2-2 .feat.on { border-color: color-mix(in srgb, var(--ok) 60%, transparent); }
    .sec-2-2 .feat.off { border-color: color-mix(in srgb, var(--bad) 60%, transparent); background: var(--bad-bg); }
    .sec-2-2 .feat .fn { font-weight: 750; font-size: 15px; }
    .sec-2-2 .feat .fd { grid-column: 1 / 2; font-size: 13px; color: var(--ink-2); line-height: 1.3; }
    .sec-2-2 .feat .sw { grid-row: 1 / 3; grid-column: 2; min-width: 58px; }
    .sec-2-2 .sw.on { border-color: var(--ok); color: var(--ok); background: var(--ok-bg); }
    .sec-2-2 .sw.off { border-color: var(--bad); color: var(--bad); background: var(--panel); }
    .sec-2-2 .bars { display: flex; flex-direction: column; gap: 7px; }
    .sec-2-2 .bar-row { display: grid; grid-template-columns: 92px minmax(0, 1fr) 48px; align-items: center; gap: 8px; font-size: 14px; }
    .sec-2-2 .bar-row .v { font-family: var(--mono); font-weight: 800; text-align: right; }
    .sec-2-2 .bar { position: relative; height: 16px; border-radius: 6px; background: var(--panel-3); overflow: hidden; }
    .sec-2-2 .bar > i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 6px; transition: width .45s ease; }
    .sec-2-2 .bar > b { position: absolute; top: 0; bottom: 0; width: 3px; background: var(--ink-2); opacity: .55; transition: left .45s ease; }
    .sec-2-2 .kpi { display: flex; flex-direction: column; gap: 0; }
    .sec-2-2 .kpi .big { font-size: 34px; }
    .sec-2-2 .res { display: grid; grid-template-columns: 38px 1fr; gap: 8px; align-items: center; padding: 4px 8px; border-radius: 9px; border: 1px solid var(--line); background: var(--panel); font-size: 14px; line-height: 1.35; }
    .sec-2-2 .res .jb { font-weight: 800; font-family: var(--mono); text-align: center; border-radius: 7px; padding: 2px 0; }
    .sec-2-2 .res.ok { border-color: color-mix(in srgb, var(--ok) 50%, transparent); }
    .sec-2-2 .res.bad { border-color: var(--bad); background: var(--bad-bg); }
    .sec-2-2 .res.warn { border-color: var(--warn); background: var(--warn-bg); }
    .sec-2-2 .legend-sw { display: inline-block; width: 12px; height: 12px; border-radius: 3px; vertical-align: -1px; margin-right: 4px; border: 1.5px solid; }
    .sec-2-2 .f-setup { fill: color-mix(in srgb, var(--warn) 38%, var(--panel)); stroke: var(--warn); }
    .sec-2-2 .f-run { fill: color-mix(in srgb, var(--proc) 45%, var(--panel)); stroke: var(--proc); }
    .sec-2-2 .f-lost { fill: color-mix(in srgb, var(--bad) 35%, var(--panel)); stroke: var(--bad); }
    .sec-2-2 .chain { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 26px; }
    .sec-2-2 .chain > div { position: relative; }
    .sec-2-2 .chain > div:not(:last-child)::after { content: '→'; position: absolute; right: -21px; top: 50%; transform: translateY(-50%); font-weight: 900; color: var(--chc); font-size: 18px; }
  `,

  steps: [
    /* ---------------- 1. Big picture: why OSs evolve + scrubbable era timeline ---------------- */
    {
      title: 'An operating system is never finished',
      kind: 'story',
      render(el, ctx) {
        const { h, s } = ctx;
        const ERAS = [
          { name: 'Serial processing', short: 'Serial', years: 'late 1940s – mid-1950s', cls: 'io',
            how: 'There is <b>no operating system</b>. Each programmer books time and runs the machine by hand: switches and lights on a console, a card reader for input, a printer for output.',
            solved: 'The first way to use a computer at all: a programmer gets the whole machine and can watch and fix a program directly.',
            created: 'Booked time is either wasted or too short, and much of every session goes on manual setup instead of computing.' },
          { name: 'Simple batch systems', short: 'Simple batch', years: 'mid-1950s onward', cls: 'os',
            how: 'Users hand their jobs to an operator. A <b>resident monitor</b> program reads the jobs one after another and starts each one automatically.',
            solved: 'No more idle gaps between jobs: the machine goes straight from one job to the next with no human in the way.',
            created: 'Only one job is in memory, so the processor sits idle every time that job waits for a slow I/O device.' },
          { name: 'Multiprogrammed batch systems', short: 'Multiprogrammed', years: '1960s', cls: 'proc',
            how: 'Several jobs sit in memory together. When the running job must wait for I/O, the processor <b>switches to another job</b> that is ready.',
            solved: 'The processor and the devices stay busy, so far more jobs finish per hour.',
            created: 'Users still cannot talk to a running job. They submit it and wait, sometimes for hours, for printed output.' },
          { name: 'Time-sharing systems', short: 'Time sharing', years: '1960s onward (CTSS, 1961)', cls: 'cpu',
            how: 'Many users sit at terminals. The processor gives each user a <b>short slice of time</b> in turn, fast enough that everyone feels they have the machine to themselves.',
            solved: 'Quick answers for interactive users: type a command, see the result in seconds.',
            created: 'Users must be protected from one another, files need access control, and everyone competes for shared devices.' },
        ];
        let cur = 0;
        const X = [78, 238, 398, 558];
        const svg = s('svg', { viewBox: '0 0 636 104', width: '100%' });
        const title = h('div', { class: 'row', style: { justifyContent: 'space-between', alignItems: 'baseline' } });
        const how = h('p', { class: 'm0', style: { fontSize: '15.5px', lineHeight: '1.45' } });
        const solved = h('div', { style: { background: 'var(--ok-bg)' } });
        const created = h('div', { style: { background: 'var(--warn-bg)' } });
        const card = h('div', { class: 'card white era-card stack', style: { gap: '9px' } }, title, how, h('div', { class: 'era-grid' }, solved, created));
        const prev = h('button', { class: 'btn sm', onclick: () => show(cur - 1) }, '◀ Earlier');
        const next = h('button', { class: 'btn sm', onclick: () => show(cur + 1) }, 'Later ▶');
        const slider = ctx.ui.slider({ label: 'Scrub', min: 0, max: 3, step: 1, value: 0, format: (v) => ERAS[v].short, onInput: (v) => show(v) });
        function drawLine() {
          const kids = [
            s('line', { x1: 40, y1: 44, x2: 600, y2: 44, class: 's-muted', 'stroke-width': 4 }),
            s('line', { x1: 40, y1: 44, x2: X[cur], y2: 44, style: 'stroke:var(--chc)', 'stroke-width': 4 }),
          ];
          ERAS.forEach((e, i) => {
            const on = i === cur;
            kids.push(s('g', { class: 'hot', onclick: () => show(i), role: 'button', 'aria-label': e.name },
              s('circle', { cx: X[i], cy: 44, r: on ? 19 : 15, class: on ? 's-accent' : 's-panel', 'stroke-width': on ? 3 : 2 }),
              s('text', { x: X[i], y: 50, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 800, style: on ? 'fill:var(--accent)' : '' }, String(i + 1)),
              s('text', { x: X[i], y: 16, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, e.years.replace(' (CTSS, 1961)', '')),
              s('text', { x: X[i], y: 86, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': on ? 800 : 600 }, e.short)));
          });
          svg.replaceChildren(...kids);
        }
        function show(i) {
          cur = ctx.util.clamp(i, 0, ERAS.length - 1);
          const e = ERAS[cur];
          drawLine();
          slider.set(cur, false);
          prev.disabled = cur === 0; next.disabled = cur === ERAS.length - 1;
          title.innerHTML = `<h3 class="m0">${cur + 1}. ${e.name}</h3><span class="chip ${e.cls}">${e.years}</span>`;
          how.innerHTML = e.how;
          solved.innerHTML = `<span class="lbl" style="color:var(--ok)">${cur === 0 ? 'What it offered' : 'Problem it solved'}</span>${e.solved}`;
          created.innerHTML = `<span class="lbl" style="color:var(--warn)">Problem it created</span>${e.created}`;
          card.classList.remove('fade-in'); void card.offsetWidth; card.classList.add('fade-in');
        }
        const reasons = [
          ['cpu', 'Hardware upgrades and new hardware', 'When chips gained several cores, the OS had to learn to spread work across them. New devices, from touchscreens to fast solid-state drives, need new support.'],
          ['proc', 'New services', 'People keep asking for more: networking, cloud sync, better security tools. The OS grows new features to supply them.'],
          ['intr', 'Fixes', 'Every large program contains faults. Patches repair them (and sometimes add new ones), so the OS changes even when nobody asks for anything new.'],
        ];
        const left = h('div', { class: 'stack', style: { gap: '10px' } },
          h('p', { class: 'lead m0', html: 'As section 2.1 showed, an <span class="t">operating system</span> is never done. Three forces keep changing it:' }),
          ...reasons.map(([c, t, d], i) => h('div', { class: 'card tight ' + c, style: { display: 'grid', gridTemplateColumns: '30px 1fr', gap: '10px', alignItems: 'start' } },
            h('span', { class: 'chip ' + c, style: { justifyContent: 'center', padding: '2px 0' } }, String(i + 1)),
            h('div', {}, h('div', { class: 'b', style: { fontSize: '15.5px' } }, t), h('div', { class: 'small', style: { lineHeight: '1.4' } }, d)))),
          h('div', { class: 'callout analogy m0', 'data-label': 'Analogy', html: 'Think of a city\'s transit system. New kinds of vehicles arrive, riders want new routes, and worn track must be repaired. The city never stops rebuilding, and neither does an OS.' }));
        const right = h('div', { class: 'stack', style: { gap: '8px' } },
          h('h4', { class: 'm0' }, 'Scrub through the early history (click a dot or drag)'),
          svg,
          h('div', { class: 'row nw' }, prev, h('div', { class: 'grow' }, slider), next),
          card,
          h('p', { class: 'small muted m0', html: 'Notice the pattern: each era\'s <b>new problem</b> is exactly what the next era set out to fix. The rest of this section lets you run each era yourself.' }),
          h('div', { class: 'callout why m0 small', 'data-label': 'Why it matters', html: 'Protection, scheduling, memory management and file security were not invented all at once. Each was a fix for a real waste or danger in one of these eras, so knowing the history explains why a modern OS looks the way it does.' }));
        el.append(h('div', { class: 'split l fill' }, left, right));
        show(0);
      },
    },

    /* ---------------- 2. Serial processing: machine room hotspots + sign-up sheet simulator ---------------- */
    {
      title: 'Serial processing: the programmer is the OS',
      kind: 'explore',
      render(el, ctx) {
        const { h, s } = ctx;
        /* ---- left: the machine room with clickable parts ---- */
        const PARTS = {
          console: '<b>Console.</b> Lights showed the registers; switches keyed in values. If an error halted the program, the lights showed it.',
          reader: '<b>Card reader.</b> The input device: the program, already in machine code, was fed in on a deck of punched cards.',
          printer: '<b>Printer.</b> The output device: if the program ran to the end, its results were printed here.',
        };
        const info = h('div', { class: 'card tight small', style: { lineHeight: '1.4', minHeight: '58px' }, html: '<span class="muted">Click a part of the machine to see what the programmer did with it.</span>' });
        const room = s('svg', { viewBox: '0 0 470 124', width: '100%' });
        const part = (key, x, w, cls, label, extra) => s('g', { class: 'hot', role: 'button', 'aria-label': label, onclick: () => { info.innerHTML = PARTS[key]; room.querySelectorAll('.hot > rect').forEach((r) => r.setAttribute('stroke-width', 2)); room.querySelector(`[data-k="${key}"]`).setAttribute('stroke-width', 4); } },
          s('rect', { x, y: 8, width: w, height: 86, rx: 10, class: cls, 'stroke-width': 2, 'data-k': key }), ...extra,
          s('text', { x: x + w / 2, y: 114, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700 }, label));
        const lights = [], toggles = [];
        for (let r = 0; r < 3; r++) for (let c = 0; c < 8; c++) lights.push(s('circle', { cx: 32 + c * 19, cy: 24 + r * 15, r: 4.5, style: (r * 8 + c) % 3 ? 'fill:var(--panel-3);stroke:var(--line-2)' : 'fill:var(--warn);stroke:var(--warn)' }));
        for (let c = 0; c < 8; c++) toggles.push(s('line', { x1: 32 + c * 19, y1: 84, x2: 32 + c * 19 + (c % 2 ? 5 : -5), y2: 70, style: 'stroke:var(--ink-2)', 'stroke-width': 3, 'stroke-linecap': 'round' }));
        room.append(
          part('console', 12, 190, 's-cpu', 'Console: lights + switches', [...lights, ...toggles]),
          part('reader', 224, 110, 's-io', 'Card reader', [s('rect', { x: 246, y: 30, width: 66, height: 40, rx: 3, class: 's-panel', 'stroke-width': 1.5 }), s('rect', { x: 252, y: 24, width: 66, height: 40, rx: 3, class: 's-panel', 'stroke-width': 1.5 }), s('line', { x1: 262, y1: 36, x2: 306, y2: 36, class: 's-muted', 'stroke-dasharray': '3 4' }), s('line', { x1: 262, y1: 46, x2: 306, y2: 46, class: 's-muted', 'stroke-dasharray': '2 5' })]),
          part('printer', 352, 106, 's-io', 'Printer', [s('rect', { x: 372, y: 22, width: 66, height: 30, rx: 3, class: 's-panel', 'stroke-width': 1.5 }), s('rect', { x: 366, y: 50, width: 78, height: 26, rx: 5, class: 's-io', 'stroke-width': 1.5 })]));
        const left = h('div', { class: 'stack', style: { gap: '9px' } },
          h('p', { class: 'lead m0', html: 'From the late 1940s to the mid-1950s there was <b>no operating system</b>. Programmers ran the hardware themselves, one after another: <span class="t">serial processing</span>.' }),
          h('div', { style: { flex: 'none' } }, room), info,
          h('div', { class: 'small', style: { lineHeight: '1.42' }, html: '<b>Problem 1, scheduling.</b> Time was booked on a paper sign-up sheet in fixed blocks. Finish early and the rest is wasted; run long and you are stopped unfinished.<br><b>Problem 2, <span class="t">setup time</span>.</b> One <span class="t">job</span> meant loading the compiler and the source program, saving the compiled result, then loading and linking it with common routines, often mounting tapes or card decks along the way. One error meant starting over.' }),
          h('div', { class: 'callout analogy m0 small', 'data-label': 'Analogy', html: 'A practice room booked by the hour: leave early and it sits empty; run over and the next band walks in mid-song.' }));

        /* ---- right: sign-up sheet simulator ---- */
        const JOBS = [['Rosa', 20, 15], ['Tom', 25, 40], ['Mei', 15, 10], ['Sam', 30, 20], ['Lena', 20, 55]];
        /* phones get a narrower drawing so its labels stay readable */
        const NW = ctx.narrow, MAXB = 90, X0 = NW ? 50 : 62, W = NW ? 220 : 420, RH = 27, GAP = 7, Y0 = 24, VW = NW ? 380 : 640;
        const sx = (m) => X0 + (m / MAXB) * W;
        const sheet = s('svg', { viewBox: `0 0 ${VW} ` + (Y0 + JOBS.length * (RH + GAP) + 2), width: '100%', style: 'flex:none' });
        const stack = h('div', { style: { display: 'flex', height: '22px', borderRadius: '7px', overflow: 'hidden', border: '1px solid var(--line)' } });
        const stackLbl = h('div', { class: 'row small', style: { gap: '14px' } });
        const verdict = h('div', { class: 'callout m0 small', style: { lineHeight: '1.4' } });
        function run(B) {
          let useful = 0, setup = 0, wasted = 0, idle = 0, done = 0;
          const kids = [s('text', { x: X0, y: 14, 'font-size': 12.5, class: 's-sub', 'text-anchor': NW ? 'middle' : 'start' }, NW ? '0' : '0 min')];
          for (let m = 15; m <= MAXB; m += 15) kids.push(s('line', { x1: sx(m), y1: 20, x2: sx(m), y2: Y0 + JOBS.length * (RH + GAP) - GAP, style: 'stroke:var(--line)', 'stroke-dasharray': '2 4' }), s('text', { x: sx(m), y: 14, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, m + ''));
          JOBS.forEach(([name, su, rn], i) => {
            const y = Y0 + i * (RH + GAP);
            const need = su + rn, ok = need <= B;
            const suIn = Math.min(su, B), rnIn = Math.max(0, Math.min(rn, B - su));
            setup += suIn;
            if (ok) { useful += rn; idle += B - need; done++; } else wasted += rnIn;
            kids.push(s('text', { x: X0 - 8, y: y + RH / 2 + 5, 'text-anchor': 'end', 'font-size': 14, 'font-weight': 700 }, name));
            kids.push(s('rect', { x: sx(0), y, width: sx(B) - sx(0), height: RH, rx: 5, class: 's-muted', 'stroke-dasharray': '5 4', style: 'fill:var(--panel)' }));
            kids.push(s('rect', { x: sx(0), y, width: sx(suIn) - sx(0), height: RH, rx: 5, class: 'f-setup', 'stroke-width': 1.5 }));
            if (rnIn > 0) kids.push(s('rect', { x: sx(suIn), y, width: sx(suIn + rnIn) - sx(suIn), height: RH, rx: 5, class: ok ? 'f-run' : 'f-lost', 'stroke-width': 1.5 }));
            if (!ok) kids.push(s('text', { x: sx(B) - 7, y: y + RH / 2 + 6, 'text-anchor': 'end', 'font-size': 17, 'font-weight': 900, style: 'fill:var(--bad)' }, '✗'));
            kids.push(s('text', { x: X0 + W + 16, y: y + RH / 2 + 5, 'font-size': 13.5, 'font-weight': 700, style: ok ? 'fill:var(--ok)' : 'fill:var(--bad)' },
              ok ? (B - need ? `✓ ${NW ? '' : 'done, '}${B - need} min idle` : (NW ? '✓ no idle' : '✓ done, no idle')) : (NW ? '✗ cut off' : `✗ cut off (needs ${need})`)));
          });
          sheet.replaceChildren(...kids);
          const total = B * JOBS.length;
          const segs = [['Useful computing', useful, 'color-mix(in srgb, var(--proc) 45%, var(--panel))', 'var(--proc)'], ['Setup', setup, 'color-mix(in srgb, var(--warn) 38%, var(--panel))', 'var(--warn)'], ['Lost to cut-offs', wasted, 'color-mix(in srgb, var(--bad) 35%, var(--panel))', 'var(--bad)'], ['Idle', idle, 'var(--panel-3)', 'var(--line-2)']];
          stack.replaceChildren(...segs.filter((g) => g[1] > 0).map(([l, v, c, b]) => h('div', { title: l, style: { width: (v / total) * 100 + '%', background: c, borderRight: '2px solid ' + b, transition: 'width .3s' } })));
          stackLbl.replaceChildren(...segs.map(([l, v, c, b]) => h('span', { html: `<span class="legend-sw" style="background:${c};border-color:${b}"></span>${l} <b>${Math.round((v / total) * 100)}%</b>` })));
          const pct = Math.round((useful / total) * 100);
          verdict.className = 'callout m0 small ' + (done < JOBS.length ? 'bad' : 'warn');
          verdict.setAttribute('data-label', `${done} of ${JOBS.length} jobs finished · ${pct}% useful`);
          verdict.innerHTML = done < JOBS.length
            ? `With ${B}-minute blocks, ${JOBS.length - done} programmer${JOBS.length - done > 1 ? 's were' : ' was'} stopped before finishing, so all of that time produced nothing. Longer blocks fix this, but then short jobs leave the machine idle.`
            : `Everyone finished, yet ${idle} of the ${total} booked minutes sat idle and ${setup} more went on setup. Only ${pct}% of the machine's time did useful computing.`;
        }
        const B0 = 60;
        const slider = ctx.ui.slider({ label: 'Each block booked', min: 30, max: MAXB, step: 15, value: B0, format: (v) => v + ' min', onInput: run });
        const right = h('div', { class: 'card white stack', style: { gap: '9px' } },
          h('h3', { class: 'm0' }, 'Sign-up sheet simulator'),
          h('p', { class: 'small m0 muted', html: 'Five programmers each book one block of the same length. Each job needs <span style="color:var(--warn);font-weight:700">setup</span>, then <span style="color:var(--proc);font-weight:700">running</span>; nobody knows the exact times in advance.' }),
          slider, sheet, stack, stackLbl, verdict,
          h('p', { class: 'small muted m0', html: '<b>Why it matters:</b> machines cost a fortune, so every idle minute was money wasted. That pressure produced the first operating systems.' }));
        el.append(h('div', { class: 'split l fill' }, left, right));
        run(B0);
      },
    },

    /* ---------------- 3. Simple batch: build a JCL deck and watch the resident monitor run it ---------------- */
    {
      title: 'Simple batch: the monitor reads your job deck',
      kind: 'lab',
      render(el, ctx) {
        const { h, s } = ctx;
        const CARDS = {
          job: { nm: '$JOB', d: 'start of a job; names the account to charge', ctl: 1 },
          ftn: { nm: '$FTN', d: 'load the FORTRAN compiler', ctl: 1 },
          src: { nm: 'FORTRAN source program', d: 'many cards of program text', ctl: 0 },
          load: { nm: '$LOAD', d: 'load the compiled program', ctl: 1 },
          run: { nm: '$RUN', d: 'start the program', ctl: 1 },
          data: { nm: 'Data for the program', d: 'many cards of input values', ctl: 0 },
          end: { nm: '$END', d: 'end of this job', ctl: 1 },
        };
        const RIGHT = ['job', 'ftn', 'src', 'load', 'run', 'data', 'end'];
        let deck = ['ftn', 'job', 'src', 'run', 'load', 'data', 'end'];
        let frames = null;
        /* The monitor as a tiny interpreter: walk the deck in order and record one frame per card. */
        function interpret(order) {
          const F = [{ cur: -1, ex: 'mon', sub: 2, user: 'empty', cap: 'The operator has loaded your deck, behind other people\'s jobs, into the card reader. The <b>resident monitor</b> stays in memory all the time; the user area is empty. Press <b>Next</b> or <b>Play</b>.' }];
          let started = false, compiled = false, loaded = false, expect = null, user = 'empty';
          const ok = (i, ex, sub, cap) => F.push({ cur: i, ex, sub, user, cap });
          /* sub 3 = the control language interpreter spotted a bad card; sub 0 = a running program failed and control came back through interrupt processing */
          const fail = (i, why, sub = 3) => {
            F.push({ cur: i, bad: true, ex: 'mon', sub, user, cap: '<span style="color:var(--bad);font-weight:800">Problem:</span> ' + why });
            F.push({ cur: i, bad: true, skipFrom: i + 1, ex: 'mon', sub: 2, user: 'empty', end: 'fail', cap: '<b>Job aborted.</b> The monitor prints an error, skips your remaining cards until the next job\'s $JOB card, and moves on. Nothing useful came out. Reorder the cards and try again.' });
            return F;
          };
          for (let i = 0; i < order.length; i++) {
            const c = order[i], nm = '<b>' + CARDS[c].nm + '</b>';
            if (!started) {
              if (c !== 'job') return fail(i, `the monitor expects every job to begin with <b>$JOB</b>, but the first card is ${nm}. It cannot tell whose job this is, so it rejects the deck.`);
              started = true; ok(i, 'mon', 3, 'The monitor reads <b>$JOB</b>: a new job begins. It records which account to charge and clears the user area.');
            } else if (expect === 'src') {
              if (c !== 'src') return fail(i, `the compiler expected program text right after $FTN but found ${nm}. It has nothing to translate, so it stops with an error and control returns to the monitor.`, 0);
              compiled = true; expect = null;
              ok(i, 'user', -1, 'Now the processor runs the <b>compiler</b>, not the monitor. The compiler reads your source cards and writes the translated machine code (object code) to tape, then hands control back to the monitor.');
            } else if (expect === 'data') {
              if (c !== 'data') return fail(i, CARDS[c].ctl ? `your program asked for input but the next card is the control card ${nm}. The monitor never passes a control card to a program, so the program runs out of input and fails.` : 'your program asked for input but got program text instead of data, so it computes garbage.', 0);
              expect = 'end';
              ok(i, 'mon', 1, 'Your program needs input, but it may not touch the card reader itself. It calls the monitor, whose <b>input routine</b> (a device driver) reads the next data card and hands it back. Then your program carries on computing.');
            } else if (expect === 'end') {
              if (c !== 'end') return fail(i, `your program has finished and control is back with the monitor, but the next card is ${nm} instead of $END, so the rest of the deck makes no sense to it.`);
              user = 'done';
              ok(i, 'mon', 3, 'Your program finished and control returned to the monitor. The monitor reads <b>$END</b>: the job is over, so it wraps up the accounting.');
              F.push({ cur: order.length, ex: 'mon', sub: 3, user: 'empty', end: 'ok', cap: '<b>Success.</b> The monitor goes straight on to the next job\'s $JOB card with no human in between. Look back: control bounced <b>monitor → compiler → monitor → your program ⇄ monitor (for input) → monitor</b>.' });
              return F;
            } else if (c === 'ftn') {
              user = 'compiler'; expect = 'src';
              ok(i, 'mon', 3, 'The monitor reads <b>$FTN</b>: it loads the FORTRAN compiler into the user area, then jumps to it.');
            } else if (c === 'load') {
              if (!compiled) return fail(i, 'the monitor read <b>$LOAD</b>, but nothing has been compiled yet, so there is no object code to load.');
              user = 'prog'; loaded = true;
              ok(i, 'mon', 3, 'The monitor reads <b>$LOAD</b>: its loader copies your compiled program from tape into the user area.');
            } else if (c === 'run') {
              if (!loaded) return fail(i, 'the monitor read <b>$RUN</b>, but no program has been loaded into memory, so there is nothing to run.');
              expect = 'data';
              ok(i, 'user', -1, 'The monitor reads <b>$RUN</b> and jumps to the first instruction of your program. The processor is now executing <b>your code</b>.');
            } else if (c === 'job') return fail(i, 'a second <b>$JOB</b> card: the monitor thinks a brand-new job has started and abandons yours.');
            else if (c === 'end') return fail(i, 'the monitor read <b>$END</b> before your program ever ran, so the job ends with no output.');
            else return fail(i, `${nm} reached the monitor directly. The monitor only understands control cards that start with $, so it cannot make sense of it.`);
          }
          return F;
        }
        /* ---- memory map ---- */
        const mem = s('svg', { viewBox: '0 0 270 400', width: '100%', style: 'max-width:300px;justify-self:center' });
        const SUBS = ['Interrupt processing', 'Device drivers', 'Job sequencing', 'Control language interpreter'];
        function drawMem(f) {
          const monOn = f.ex === 'mon', userOn = f.ex === 'user';
          const uLabel = { empty: ['(empty)', ''], compiler: ['FORTRAN compiler', 'translates your source'], prog: ['Your program', 'compiled object code'], done: ['Your program', 'finished'] }[f.user];
          const kids = [
            s('text', { x: 8, y: 18, 'font-size': 14, 'font-weight': 700 }, 'Processor is running:'),
            s('rect', { x: 162, y: 3, width: 102, height: 22, rx: 11, class: monOn ? 's-os' : 's-proc', 'stroke-width': 2 }),
            s('text', { x: 213, y: 19, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 800, style: monOn ? 'fill:var(--os)' : 'fill:var(--proc)' }, monOn ? 'MONITOR' : (f.user === 'compiler' ? 'COMPILER' : 'YOUR CODE')),
            s('rect', { x: 4, y: 36, width: 262, height: 176, rx: 10, class: 's-os', 'stroke-width': monOn ? 4 : 1.5, style: monOn ? 'stroke:var(--chc)' : '' }),
            s('text', { x: 16, y: 58, 'font-size': 15, 'font-weight': 800, style: 'fill:var(--os)' }, 'Resident monitor'),
          ];
          SUBS.forEach((t, k) => {
            const on = f.sub === k;
            kids.push(s('rect', { x: 14, y: 68 + k * 35, width: 242, height: 29, rx: 6, class: on ? 's-accent' : 's-panel', 'stroke-width': on ? 2.5 : 1 }),
              s('text', { x: 24, y: 87 + k * 35, 'font-size': 13.5, 'font-weight': on ? 800 : 500 }, t));
          });
          kids.push(s('line', { x1: 0, y1: 222, x2: 270, y2: 222, class: 's-line', 'stroke-dasharray': '7 5' }),
            s('text', { x: 266, y: 236, 'text-anchor': 'end', 'font-size': 12.5, class: 's-sub' }, 'boundary'),
            s('rect', { x: 4, y: 244, width: 262, height: 152, rx: 10, class: f.user === 'empty' ? 's-panel' : 's-proc', 'stroke-width': userOn ? 4 : 1.5, style: userOn ? 'stroke:var(--chc)' : '' }),
            s('text', { x: 16, y: 266, 'font-size': 15, 'font-weight': 800, style: 'fill:var(--proc)' }, 'User program area'),
            s('text', { x: 135, y: 322, 'text-anchor': 'middle', 'font-size': 18, 'font-weight': 800, class: f.user === 'empty' ? 's-sub' : '' }, uLabel[0]),
            s('text', { x: 135, y: 344, 'text-anchor': 'middle', 'font-size': 13.5, class: 's-sub' }, uLabel[1]));
          mem.replaceChildren(...kids);
        }
        /* ---- deck ---- */
        const deckEl = h('div', { class: 'deck' });
        const status = h('span', { class: 'chip' });
        let curFrame = null;
        function paintDeck() {
          const f = curFrame || {};
          deckEl.replaceChildren(...deck.map((c, i) => {
            const cd = CARDS[c];
            let cls = 'deck-row';
            if (f.cur === i) cls += f.bad ? ' bad' : ' cur';
            else if (f.cur > i) cls += ' done';
            if (f.skipFrom != null && i >= f.skipFrom) cls += ' skip';
            const mv = (d) => () => { const j = i + d; [deck[i], deck[j]] = [deck[j], deck[i]]; rebuild(); };
            return h('div', { class: cls },
              h('span', { class: 'ix' }, f.cur > i && !(f.bad && f.cur === i) ? '✓' : String(i + 1)),
              h('div', {}, h('span', { class: 'nm ' + (cd.ctl ? 'ctl' : 'usr') }, cd.nm), h('span', { class: 'xs muted' }, '  ' + cd.d)),
              h('div', { class: 'mv' }, h('button', { type: 'button', title: 'Move up', 'aria-label': 'Move ' + cd.nm + ' up', disabled: i === 0, onclick: mv(-1) }, '▲'), h('button', { type: 'button', title: 'Move down', 'aria-label': 'Move ' + cd.nm + ' down', disabled: i === deck.length - 1, onclick: mv(1) }, '▼')));
          }));
          status.className = 'chip ' + (f.end === 'ok' ? 'ok' : f.end === 'fail' ? 'bad' : f.bad ? 'bad' : f.cur >= 0 ? 'os' : 'warn');
          status.textContent = f.end === 'ok' ? 'job ran correctly' : f.end === 'fail' ? 'job aborted' : f.bad ? 'error!' : f.cur >= 0 ? 'monitor reading…' : 'deck ready: press Play';
        }
        frames = interpret(deck);
        const player = ctx.ui.player({ count: frames.length, interval: 2300, render: (i) => { curFrame = frames[i] || frames[frames.length - 1]; drawMem(curFrame); paintDeck(); return curFrame.cap; } });
        function rebuild() { frames = interpret(deck); player.setCount(frames.length); }
        const text = h('div', { class: 'stack', style: { gap: '8px', fontSize: '15px', lineHeight: '1.45' } },
          h('p', { class: 'm0', html: '<b>Mid-1950s:</b> General Motors builds the first batch monitor for its IBM 701; its successor, GM-NAA I/O (1956), runs on the IBM 704. Users no longer touch the machine: an operator groups <span class="t">job</span> decks into a <span class="t" data-t="batch system">batch</span>, and a <span class="t" data-t="resident monitor">monitor</span> program runs them in turn.' }),
          h('p', { class: 'm0', html: 'Each job carries <span class="t" data-t="job control language">job control language</span> (JCL) cards. They start with <code>$</code> and tell the monitor what to do.' }),
          h('div', { class: 'callout tip m0 small', 'data-label': 'Your task', html: 'Put the seven cards in order with ▲ ▼, then press Play. A wrong order shows what breaks.' }),
          h('div', { class: 'callout why m0 small', 'data-label': 'Watch the badge', html: 'The processor <b>alternates</b> between the monitor and a program: the FORTRAN <i>compiler</i> (it translates source text into machine code) or your own program.' }));
        const deckCol = h('div', { class: 'stack', style: { gap: '7px' } },
          h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'Your job deck · top card first'), status),
          deckEl,
          h('div', { class: 'row' },
            h('button', { class: 'btn sm', onclick: () => { deck = ctx.util.shuffle(deck); rebuild(); } }, 'Shuffle'),
            h('button', { class: 'btn sm', onclick: () => { deck = RIGHT.slice(); rebuild(); } }, 'Show the correct order')));
        el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },
          h('div', { class: 'split grow', style: { gridTemplateColumns: 'minmax(0, 1fr) 262px minmax(0, 1.45fr)', gap: '18px', height: 'auto' } }, text, mem, deckCol),
          player.el));
        rebuild();
      },
    },

    /* ---------------- 4. Hardware a monitor needs + user/kernel mode: switch features off and see the batch fail ---------------- */
    {
      title: 'The hardware a batch monitor needs',
      kind: 'explore',
      render(el, ctx) {
        const { h, s } = ctx;
        const FEAT = [
          ['prot', 'Memory protection', 'A job cannot change the monitor\'s memory; any attempt traps to the monitor.'],
          ['timer', 'Timer', 'Set before each job. When it runs out, the monitor takes over.'],
          ['priv', 'Privileged instructions', 'I/O and other sensitive instructions work only for the monitor.'],
          ['intr', 'Interrupts', 'Devices and the timer can signal the processor, giving control back to the monitor.'],
        ];
        const on = { prot: true, timer: true, priv: true, intr: true };
        const featEls = {};
        const grid = h('div', { class: 'grid-2', style: { gap: '8px' } });
        FEAT.forEach(([k, name, d]) => {
          const btn = h('button', { class: 'btn sm sw', type: 'button', 'aria-label': 'Toggle ' + name, onclick: () => { on[k] = !on[k]; paint(); } });
          const card = h('div', { class: 'feat' }, h('span', { class: 'fn', html: k === 'intr' ? name : `<span class="t">${name}</span>` }), btn, h('span', { class: 'fd' }, d));
          featEls[k] = { card, btn };
          grid.append(card);
        });
        const list = h('div', { class: 'stack', style: { gap: '5px' } });
        const sum = h('div', { class: 'small b' });
        function outcomes() {
          const R = [];
          let halted = null;
          const add = (job, what, st, txt) => R.push({ job, what, st: halted ? 'skip' : st, txt: halted ? 'Never ran: ' + halted : txt });
          add('J1', 'Normal job', 'ok', '✓ Runs and finishes.');
          add('J2', 'Long tape read', on.intr ? 'ok' : 'warn', on.intr ? '✓ The tape signals "done" with an interrupt; no need to watch it.' : '⚠ Finishes, but the processor must poll (keep checking) the tape.');
          add('J3', 'Bug: writes into the monitor', on.prot ? 'ok' : 'bad', on.prot ? '✓ Caught: the hardware traps and the monitor aborts J3.' : '✗ Monitor overwritten: the whole batch crashes.');
          if (!on.prot) halted = 'the batch crashed at J3.';
          const stop = on.timer && on.intr;
          add('J4', 'Bug: endless loop', stop ? 'ok' : 'bad', stop ? '✓ The timer runs out and interrupts J4; the monitor aborts it.' : !on.timer ? '✗ Loops forever; nothing takes the processor back.' : '✗ The timer expires but cannot interrupt: J4 keeps going.');
          if (!stop && !halted) halted = 'the batch is stuck in J4\'s loop.';
          add('J5', 'Reads cards itself', on.priv ? 'ok' : 'bad', on.priv ? '✓ Must ask the monitor, which never hands over J6\'s cards.' : '✗ Reads past its own data and swallows J6\'s $JOB card.');
          add('J6', 'Normal job', on.priv ? 'ok' : 'bad', on.priv ? '✓ Runs and finishes.' : '✗ Lost: J5 ate its $JOB card.');
          return { R, halted };
        }
        function paint() {
          FEAT.forEach(([k]) => { const f = featEls[k]; f.card.className = 'feat ' + (on[k] ? 'on' : 'off'); f.btn.className = 'btn sm sw ' + (on[k] ? 'on' : 'off'); f.btn.textContent = on[k] ? 'ON' : 'OFF'; f.btn.setAttribute('aria-pressed', on[k]); });
          const { R, halted } = outcomes();
          list.replaceChildren(...R.map((r) => h('div', { class: 'res ' + (r.st === 'skip' ? '' : r.st), style: r.st === 'skip' ? { opacity: '.5' } : {} },
            h('span', { class: 'jb ' + (r.what === 'Normal job' ? 'chip proc' : 'chip warn'), style: { display: 'block' } }, r.job),
            h('div', {}, h('b', {}, r.what), h('span', { class: 'muted' }, ' · '), h('span', {}, r.txt)))));
          const allOn = FEAT.every(([k]) => on[k]);
          sum.innerHTML = allOn ? '<span style="color:var(--ok)">All four features on: every good job finishes and every bad job is stopped without harming anyone else.</span>'
            : halted ? `<span style="color:var(--bad)">Batch halted: ${halted} Switch the features back on.</span>` : '<span style="color:var(--warn)">The batch finished, but not cleanly. Switch the features back on.</span>';
        }
        const modes = s('svg', { viewBox: '0 0 460 176', width: '100%' },
          s('rect', { x: 6, y: 6, width: 448, height: 58, rx: 10, class: 's-proc', 'stroke-width': 2 }),
          s('text', { x: 20, y: 30, 'font-size': 16, 'font-weight': 800, style: 'fill:var(--proc)' }, 'User mode'),
          s('text', { x: 20, y: 51, 'font-size': 13.5 }, 'jobs run here; some memory and instructions are off-limits'),
          s('rect', { x: 6, y: 112, width: 448, height: 58, rx: 10, class: 's-os', 'stroke-width': 2 }),
          s('text', { x: 20, y: 136, 'font-size': 16, 'font-weight': 800, style: 'fill:var(--os)' }, 'Kernel mode'),
          s('text', { x: 20, y: 157, 'font-size': 13.5 }, 'the monitor runs here with full access to everything'),
          s('line', { x1: 110, y1: 66, x2: 110, y2: 108, style: 'stroke:var(--intr)', 'stroke-width': 2.5, 'marker-end': 'url(#arr-intr)' }),
          s('text', { x: 120, y: 93, 'font-size': 13, style: 'fill:var(--intr)', 'font-weight': 700 }, 'trap or interrupt'),
          s('line', { x1: 280, y1: 110, x2: 280, y2: 68, style: 'stroke:var(--os)', 'stroke-width': 2.5, 'marker-end': 'url(#arr-os)' }),
          s('text', { x: 290, y: 93, 'font-size': 13, style: 'fill:var(--os)', 'font-weight': 700 }, 'monitor resumes a job'));
        const left = h('div', { class: 'stack', style: { gap: '9px' } },
          h('p', { class: 'm0', style: { fontSize: '16px', lineHeight: '1.45' }, html: 'A monitor only works if a buggy or greedy job cannot wreck it or hog the machine, so batch systems leaned on the <b>hardware</b>. The processor runs in one of two modes:' }),
          modes,
          h('p', { class: 'small m0', style: { lineHeight: '1.42' }, html: 'In <span class="t">user mode</span> some memory is off-limits and <span class="t">privileged instructions</span> are refused. In <span class="t">kernel mode</span> the monitor may do anything. A trap or <span class="t">interrupt</span> switches the processor into kernel mode; the monitor switches back when it resumes a job.' }),
          h('div', { class: 'callout warn m0 small', 'data-label': 'The price', html: 'The monitor takes up memory that jobs could have used, and it uses processor time every time it runs. Still a bargain: the machine stays far busier than under serial processing.' }),
          h('p', { class: 'small muted m0', html: 'Early machines had no interrupts at all. Adding them let the OS give up the processor and win it back far more flexibly, and the next idea, multiprogramming, depends on exactly that.' }));
        const right = h('div', { class: 'stack', style: { gap: '8px' } },
          h('h3', { class: 'm0' }, 'Switch a feature off, then read what happens to the batch'),
          grid, list, sum);
        el.append(h('div', { class: 'split l fill' }, left, right));
        paint();
      },
    },

    /* ---------------- 5. Multiprogramming: utilization calculator with a live processor timeline ---------------- */
    {
      title: 'Why the processor still sits idle, and the fix',
      kind: 'explore',
      core: true, // on the shorter core path
      render(el, ctx) {
        const { h, s } = ctx;
        const P = { r: 15, c: 1, w: 15, n: 1 };
        const NAMES = ['A', 'B', 'C'];
        const NW = ctx.narrow, X0 = NW ? 92 : 104, TW = NW ? 280 : 530, VW = NW ? 380 : 650;
        const svg = s('svg', { viewBox: `0 0 ${VW} 190`, width: '100%', style: 'flex:none' });
        const big = h('div', { class: 'big', style: { color: 'var(--chc)' } });
        const busyTxt = h('div', { class: 'small muted' });
        const compare = h('div', { class: 'bars', style: { gap: '5px' } });
        const formula = h('div', { class: 'mono', style: { fontSize: '15px', lineHeight: '1.5' } });
        const say = h('div', { class: 'callout m0 small', style: { lineHeight: '1.42' } });
        const util = (n) => Math.min(1, (n * P.c) / (P.r + P.c + P.w));
        const pct = (u) => (u >= 1 ? '100' : ctx.util.fmt(u * 100, 1)) + '%';
        /* discrete-event simulation: one processor (first come, first served), each program has its own I/O device */
        function simulate(win) {
          const T = P.r + P.c + P.w;
          const progs = NAMES.slice(0, P.n).map((nm, i) => ({ nm, i, ready: 0, segs: [] }));
          const cpu = [];
          let free = 0;
          for (let guard = 0; guard < 400; guard++) {
            const p = progs.slice().sort((a, b) => a.ready - b.ready || a.i - b.i)[0];
            const start = Math.max(free, p.ready);
            if (start >= win) { progs.forEach((q) => { if (q.ready < win) q.segs.push(['wait', q.ready, win]); }); break; }
            if (start > p.ready) p.segs.push(['wait', p.ready, start]);
            p.segs.push(['run', start, start + P.c]); cpu.push([p.i, start, start + P.c]);
            p.segs.push(['io', start + P.c, start + P.c + P.w + P.r]);
            p.ready = start + T; free = start + P.c;
          }
          return { progs, cpu };
        }
        function draw() {
          const T = P.r + P.c + P.w, win = 3 * T;
          const x = (t) => X0 + (Math.min(t, win) / win) * TW;
          const { progs, cpu } = simulate(win);
          const kids = [];
          const step = NW ? (win > 120 ? 50 : win > 60 ? 40 : win > 30 ? 20 : 5) : (win > 60 ? 20 : win > 30 ? 10 : 5);
          for (let t = 0; t <= win + 0.001; t += step) kids.push(s('line', { x1: x(t), y1: 18, x2: x(t), y2: 186, style: 'stroke:var(--line)', 'stroke-dasharray': '2 4' }), s('text', { x: x(t), y: 13, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, t + ' µs'));
          const rowY = [26, 78, 116, 154];
          kids.push(s('text', { x: X0 - 10, y: rowY[0] + 23, 'text-anchor': 'end', 'font-size': 15, 'font-weight': 800, style: 'fill:var(--cpu)' }, 'Processor'),
            s('rect', { x: X0, y: rowY[0], width: TW, height: 36, rx: 5, class: 's-muted', 'stroke-dasharray': '4 4', style: 'fill:var(--panel-3)' }),
            s('text', { x: X0 + TW - 6, y: rowY[0] + 23, 'text-anchor': 'end', 'font-size': 12.5, class: 's-sub' }, util(P.n) >= 1 ? '' : 'idle'));
          cpu.forEach(([i, a, b]) => {
            if (a >= win) return;
            kids.push(s('rect', { x: x(a), y: rowY[0], width: Math.max(1.5, x(b) - x(a)), height: 36, class: 'f-run', 'stroke-width': 1 }));
            if (x(b) - x(a) > 14) kids.push(s('text', { x: (x(a) + x(b)) / 2, y: rowY[0] + 23, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800 }, NAMES[i]));
          });
          NAMES.forEach((nm, i) => {
            const y = rowY[i + 1], p = progs[i];
            kids.push(s('text', { x: X0 - 10, y: y + 19, 'text-anchor': 'end', 'font-size': 14, 'font-weight': 700, class: p ? '' : 's-sub' }, 'Program ' + nm));
            if (!p) { kids.push(s('text', { x: X0 + 6, y: y + 19, 'font-size': 13, class: 's-sub' }, '(not in memory)')); return; }
            p.segs.forEach(([k, a, b]) => {
              if (a >= win) return;
              kids.push(s('rect', { x: x(a), y, width: Math.max(1.5, x(b) - x(a)), height: 28, rx: 3, class: k === 'run' ? 'f-run' : k === 'io' ? 's-io' : 's-warn', 'stroke-width': 1, 'stroke-dasharray': k === 'wait' ? '3 3' : null }));
              if (k === 'io' && x(b) - x(a) > 100) kids.push(s('text', { x: (x(a) + x(b)) / 2, y: y + 19, 'text-anchor': 'middle', 'font-size': 12.5, style: 'fill:var(--io)' }, 'waiting for I/O'));
            });
          });
          svg.replaceChildren(...kids);
          const u = util(P.n);
          big.textContent = pct(u);
          busyTxt.innerHTML = u >= 1 ? 'busy all the time: some program is always ready' : `busy ${P.n * P.c} of every ${T} µs`;
          const num = `<b>${P.n > 1 ? P.n + ' × ' : ''}${P.c}</b> / (${P.r} + ${P.c} + ${P.w})`;
          formula.innerHTML = P.n * P.c > T ? `U = ${num} &gt; 1 → <b style="color:var(--chc)">100%</b>` : `U = ${num} = <b style="color:var(--chc)">${pct(u)}</b>`;
          compare.replaceChildren(...[1, 2, 3].map((n) => h('div', { class: 'bar-row', style: { fontWeight: n === P.n ? 800 : 500 } },
            h('span', {}, n === 1 ? '1 program' : n + ' programs'), h('div', { class: 'bar' }, h('i', { style: { width: util(n) * 100 + '%', background: n === P.n ? 'var(--chc)' : 'var(--line-2)' } })), h('span', { class: 'v' }, pct(util(n))))));
          say.className = 'callout m0 small ' + (u >= 1 ? 'tip' : P.n === 1 ? 'bad' : 'why');
          say.setAttribute('data-label', u >= 1 ? 'Saturated' : P.n === 1 ? 'Uniprogramming' : 'Multiprogramming');
          say.innerHTML = P.n === 1 && u < 1 ? `With one program the processor must wait for every I/O operation to finish before the program can continue. It sits idle ${pct(1 - u)} of the time.`
            : u < 1 ? `While A waits for its device, the processor runs ${P.n === 2 ? 'B' : 'B, then C'}: one at a time, never at the same instant. Utilization rises ${P.n}×, yet the processor is still idle ${pct(1 - u)} of the time. Try a longer compute time.`
              : 'There is always a program ready, so the processor never idles. Now programs queue for the processor (dashed), and adding more programs cannot raise utilization past 100%.';
        }
        const sl = (key, label) => ctx.ui.slider({ label, min: 1, max: 30, value: P[key], format: (v) => v + ' µs', onInput: (v) => { P[key] = v; draw(); } });
        const sR = sl('r', 'Read a record'), sC = sl('c', 'Compute (100 instr.)'), sW = sl('w', 'Write a record');
        const seg = ctx.ui.seg([{ value: 1, label: '1 program' }, { value: 2, label: '2 programs' }, { value: 3, label: '3 programs' }], 1, (v) => { P.n = v; draw(); });
        const reset = h('button', { class: 'btn sm', onclick: () => { P.r = 15; P.c = 1; P.w = 15; sR.set(15); sC.set(1); sW.set(15); draw(); } }, 'Reset to 15 / 1 / 15');
        const left = h('div', { class: 'stack', style: { gap: '9px' } },
          h('p', { class: 'm0', style: { fontSize: '16px', lineHeight: '1.45' }, html: 'A batch <span class="t" data-t="Resident monitor">monitor</span> runs jobs back to back with no gaps, yet <span class="t">processor utilization</span> stays poor: I/O is slow next to the processor, so it keeps waiting. Take a program that processes a file one <b>record</b> (one entry, such as one customer) at a time:' }),
          h('div', { class: 'card tight stack', style: { gap: '6px' } }, sR, sC, sW, formula),
          h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'small b' }, 'Programs in memory'), reset),
          seg,
          h('p', { class: 'small m0', html: 'One program at a time is <span class="t">uniprogramming</span>. Switch to 2 or 3 programs (each with its own I/O device) and watch the processor\'s idle gaps shrink.' }),
          h('div', { class: 'callout why m0 small', 'data-label': 'The fix', html: '<span class="t">Multiprogramming</span>: keep several programs in memory, and when one must wait for I/O, switch the processor to another. The OS now needs memory management and scheduling; the hardware must supply I/O <span class="t">interrupts</span> and <span class="t" data-t="DMA">DMA</span> (direct memory access), so devices move data by themselves and signal when they are done.' }));
        const right = h('div', { class: 'stack', style: { gap: '8px' } },
          h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { class: 'm0' }, 'What the processor does, microsecond by microsecond'), h('span', { class: 'chip ' + 'cpu' }, 'first 3 cycles')),
          svg,
          h('div', { class: 'row small', style: { gap: '16px', marginTop: '-4px' }, html: '<span><span class="legend-sw" style="background:color-mix(in srgb, var(--proc) 45%, var(--panel));border-color:var(--proc)"></span>running on the processor</span><span><span class="legend-sw" style="background:var(--io-bg);border-color:var(--io)"></span>waiting for its I/O device</span><span><span class="legend-sw" style="background:var(--warn-bg);border-color:var(--warn);border-style:dashed"></span>ready, waiting its turn</span>' }),
          h('div', { class: 'split', style: { height: 'auto', gridTemplateColumns: '196px minmax(0, 1fr)', gap: '16px', alignItems: 'center' } },
            h('div', { class: 'kpi' }, h('span', { class: 'xs muted b' }, 'PROCESSOR UTILIZATION'), big, busyTxt),
            compare),
          say,
          h('div', { class: 'row' }, h('span', { class: 'small b' }, 'Try:'),
            ...[[15, 10, 15, 'compute 10 µs'], [5, 20, 5, 'fast I/O (5 / 20 / 5)'], [15, 1, 15, 'the slow-I/O example']].map(([r, c, w, lbl]) => h('button', { class: 'btn sm', onclick: () => { P.r = r; P.c = c; P.w = w; sR.set(r); sC.set(c); sW.set(w); draw(); } }, lbl))));
        el.append(h('div', { class: 'split l fill' }, left, right));
        draw();
      },
    },

    /* ---------------- 6. JOB1/JOB2/JOB3: toggle uniprogramming vs multiprogramming and watch every metric ---------------- */
    {
      title: 'Three jobs, two ways: one at a time or all at once',
      kind: 'compare',
      render(el, ctx) {
        const { h, s } = ctx;
        const MEM = 250;
        const JOBS = [
          { nm: 'JOB1', kind: 'heavy compute', dur: 5, mem: 50, dev: ['Processor'], cls: 'cpu' },
          { nm: 'JOB2', kind: 'heavy I/O', dur: 15, mem: 100, dev: ['Terminal'], cls: 'io' },
          { nm: 'JOB3', kind: 'heavy I/O', dur: 10, mem: 75, dev: ['Disk', 'Printer'], cls: 'io' },
        ];
        const sched = (mode) => { let t = 0; return JOBS.map((j) => { const st = mode === 'multi' ? 0 : t; t = st + j.dur; return [st, st + j.dur]; }); };
        function metrics(mode) {
          const sc = sched(mode), elapsed = Math.max(...sc.map((x) => x[1]));
          const memMin = JOBS.reduce((a, j) => a + j.mem * j.dur, 0);
          return {
            elapsed, cpu: 6 / elapsed, mem: memMin / (MEM * elapsed), disk: 10 / elapsed, printer: 10 / elapsed,
            thr: (3 / elapsed) * 60, resp: sc.reduce((a, x) => a + x[1], 0) / 3, sc,
          };
        }
        const M = { uni: metrics('uni'), multi: metrics('multi') };
        let mode = 'uni', tNow = 3;
        /* ---- left: job table + Gantt chart + time cursor ---- */
        const spec = h('table', { class: 'tbl compact' },
          h('tr', {}, h('th', {}, 'The three jobs'), ...JOBS.map((j) => h('th', {}, j.nm))),
          ...[['Kind of work', (j) => j.kind], ['Run time alone', (j) => j.dur + ' min'], ['Memory needed', (j) => j.mem + ' MB'], ['Devices used', (j) => j.dev.filter((d) => d !== 'Processor').join(' + ') || 'mostly the processor']]
            .map(([l, f]) => h('tr', {}, h('td', { class: 'b' }, l), ...JOBS.map((j) => h('td', {}, f(j))))));
        const NW = ctx.narrow, X0 = NW ? 60 : 64, TW = NW ? 285 : 460;
        const gx = (m) => X0 + (m / 30) * TW;
        const gantt = s('svg', { viewBox: `0 0 ${NW ? 356 : 540} 142`, width: '100%' });
        const memBar = h('div', { style: { display: 'flex', height: '20px', borderRadius: '6px', overflow: 'hidden', background: 'var(--panel-3)', border: '1px solid var(--line)' } });
        const memTxt = h('div', { class: 'small' });
        const devs = h('div', { class: 'row', style: { gap: '6px' } });
        function drawLeft() {
          const sc = M[mode].sc;
          const kids = [];
          for (let m = 0; m <= 30; m += 5) kids.push(s('line', { x1: gx(m), y1: 16, x2: gx(m), y2: 136, style: 'stroke:var(--line)', 'stroke-dasharray': '2 4' }), s('text', { x: gx(m), y: 12, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, String(m)));
          const labels = [];
          JOBS.forEach((j, i) => {
            const y = 24 + i * 38, [a, b] = sc[i];
            kids.push(s('rect', { x: gx(a), y, width: gx(b) - gx(a), height: 28, rx: 5, class: 's-' + j.cls, 'stroke-width': 2 }));
            labels.push(s('text', { x: X0 - 8, y: y + 19, 'text-anchor': 'end', 'font-size': 14, 'font-weight': 800 }, j.nm),
              s('text', { x: gx(b) + 6, y: y + 19, 'font-size': 13, 'font-weight': 700, style: b > 26 ? 'display:none' : '' }, (NW ? '' : 'done at ') + b + ' min'),
              s('text', { x: gx(b) - 6, y: y + 19, 'text-anchor': 'end', 'font-size': 13, 'font-weight': 700, style: b > 26 ? '' : 'display:none' }, (NW ? '' : 'done at ') + b + ' min'));
          });
          kids.push(s('line', { x1: gx(tNow), y1: 16, x2: gx(tNow), y2: 138, style: 'stroke:var(--chc)', 'stroke-width': 2.5, opacity: 0.8 }), ...labels);
          kids.push(s('text', { x: 4, y: 12, 'font-size': 12.5, class: 's-sub' }, NW ? 'min' : 'minutes'));
          gantt.replaceChildren(...kids);
          const live = JOBS.filter((j, i) => sc[i][0] <= tNow && tNow < sc[i][1]);
          const used = live.reduce((a, j) => a + j.mem, 0);
          memBar.replaceChildren(...live.map((j) => h('div', { title: j.nm, style: { width: (j.mem / MEM) * 100 + '%', background: `var(--${j.cls}-bg)`, borderRight: `2px solid var(--${j.cls})`, fontSize: '12px', fontWeight: 800, textAlign: 'center', lineHeight: '19px' } }, j.nm)));
          memTxt.innerHTML = tNow >= M[mode].elapsed ? `<b>At ${tNow} min:</b> all three jobs are finished; memory and devices are idle.` : `<b>At ${tNow} min:</b> ${used} of ${MEM} MB of memory in use (${Math.round((used / MEM) * 100)}%).`;
          const busy = new Set(live.flatMap((j) => j.dev));
          /* the I/O-heavy jobs still use the processor a little (about 1 of the 6 processor-minutes) */
          const light = !busy.has('Processor') && live.length > 0;
          devs.replaceChildren(h('span', { class: 'small b' }, 'Busy now:'), ...['Processor', 'Terminal', 'Disk', 'Printer'].map((d) => {
            const on = busy.has(d), lt = d === 'Processor' && light;
            return h('span', { class: 'chip ' + (on ? (d === 'Processor' ? 'cpu' : 'io') : ''), style: on ? {} : { opacity: lt ? '.8' : '.55' } }, (on ? '● ' : lt ? '◔ ' : '○ ') + d + (lt ? ' (a little)' : ''));
          }));
        }
        const tSlider = ctx.ui.slider({ label: 'Time', min: 0, max: 30, step: 1, value: tNow, format: (v) => v + ' min', onInput: (v) => { tNow = v; drawLeft(); } });
        /* ---- right: utilization bars + metrics table ---- */
        const bars = h('div', { class: 'bars' });
        const tbl = h('table', { class: 'tbl compact' });
        const note = h('div', { class: 'callout m0 small', style: { lineHeight: '1.42' } });
        const pc = (v) => Math.round(v * 100) + '%';
        function drawRight() {
          const cur = M[mode], oth = M[mode === 'uni' ? 'multi' : 'uni'];
          bars.replaceChildren(...[['Processor', 'cpu', 'cpu'], ['Memory', 'mem', 'mem'], ['Disk', 'disk', 'io'], ['Printer', 'printer', 'io']].map(([l, k, c]) => h('div', { class: 'bar-row' },
            h('span', { class: 'b' }, l), h('div', { class: 'bar' }, h('i', { style: { width: cur[k] * 100 + '%', background: `var(--${c})` } }), h('b', { style: { left: `calc(${oth[k] * 100}% - 1px)` }, title: 'the other mode' })), h('span', { class: 'v' }, pc(cur[k])))));
          const rows = [['Elapsed time', (m) => m.elapsed + ' min'], ['<span class="t">Throughput</span>', (m) => m.thr + ' jobs/hr'], ['Mean <span class="t">response time</span>', (m) => (m.resp % 1 ? '≈ ' + Math.round(m.resp) : m.resp) + ' min']];
          tbl.replaceChildren(h('tr', {}, h('th', {}, 'Measure'), h('th', { style: mode === 'uni' ? { color: 'var(--chc)' } : {} }, ctx.narrow ? 'Uni' : 'Uniprogramming'), h('th', { style: mode === 'multi' ? { color: 'var(--chc)' } : {} }, ctx.narrow ? 'Multi' : 'Multiprogramming')),
            ...rows.map(([l, f]) => h('tr', {}, h('td', { class: 'b', html: l }), h('td', { class: 'num', style: mode === 'uni' ? { background: 'var(--accent-bg)', fontWeight: 800 } : {} }, f(M.uni)), h('td', { class: 'num', style: mode === 'multi' ? { background: 'var(--accent-bg)', fontWeight: 800 } : {} }, f(M.multi)))));
          note.className = 'callout m0 small ' + (mode === 'uni' ? 'bad' : 'tip');
          note.setAttribute('data-label', mode === 'uni' ? 'One at a time' : 'All at once');
          note.innerHTML = mode === 'uni'
            ? 'JOB2 waits 5 minutes and JOB3 waits 20, even though neither needs the devices the running job is using. Responses: 5, 20 and 30 min, mean (5 + 20 + 30) / 3 ≈ 18 min.'
            : 'The jobs need different resources, so they barely get in each other\'s way. Each finishes as if it ran alone: 5, 15 and 10 min, mean 10 min. The same work now fits in half the time.';
        }
        function paint() { drawLeft(); drawRight(); }
        const seg = ctx.ui.seg([{ value: 'uni', label: 'Uniprogramming' }, { value: 'multi', label: 'Multiprogramming' }], mode, (v) => { mode = v; if (tNow > M[mode].elapsed) { tNow = M[mode].elapsed; tSlider.set(tNow); } paint(); });
        const left = h('div', { class: 'stack', style: { gap: '8px' } }, spec, h('div', { class: 'card white tight stack', style: { gap: '6px' } }, gantt, tSlider, memBar, memTxt, devs));
        const right = h('div', { class: 'stack', style: { gap: '9px' } },
          h('div', { class: 'card tight' }, h('h4', {}, 'Resource use over the whole run'), bars, h('div', { class: 'xs muted', style: { marginTop: '5px' } }, 'Each bar is the average share in use over the run, e.g. processor 6 busy min ÷ 30 min = 20%. The thin mark shows the other mode.')),
          tbl, note,
          h('p', { class: 'small muted m0', html: 'Nothing about the hardware changed. The only difference is whether the OS keeps several jobs in memory and switches among them.' }));
        el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },
          h('div', { class: ctx.narrow ? 'stack' : 'row nw', style: { justifyContent: 'space-between', gap: ctx.narrow ? '8px' : '16px' } },
            h('p', { class: 'm0', style: { fontSize: '15.5px', lineHeight: '1.4', flex: '1' }, html: 'A machine with 250 MB of memory for user programs, a disk, a terminal and a printer gets three jobs at the same moment. Together they need about 6 minutes of processor time.' }),
            h('div', { style: { flex: 'none' } }, seg)),
          h('div', { class: 'split grow', style: { gridTemplateColumns: 'minmax(0, 1.12fr) minmax(0, 1fr)', height: 'auto' } }, left, right)));
        paint();
      },
    },

    /* ---------------- 7. Time sharing vs batch multiprogramming: response-time demo ---------------- */
    {
      title: 'Time sharing: many users, one processor',
      kind: 'compare',
      core: true, // on the shorter core path
      render(el, ctx) {
        const { h, s } = ctx;
        const LONG = 20, OTHER = 0.3, MINE = 0.1;
        const P = { mode: 'ts', n: 6, q: 0.2, zoom: 'all' };
        /* Every request arrives at time 0 in this order: the long job, the other users, then you. */
        function schedule() {
          const reqs = [{ who: 'long', need: LONG }];
          for (let k = 0; k < P.n - 2; k++) reqs.push({ who: 'other', k, need: OTHER });
          reqs.push({ who: 'you', need: MINE });
          const segs = [], fin = {};
          let t = 0;
          if (P.mode === 'batch') reqs.forEach((r) => { segs.push([r.who, t, t + r.need, r.k]); t += r.need; fin[r.who] = t; });
          else {
            const q = reqs.map((r) => ({ ...r, left: r.need }));
            while (q.length) {
              const r = q.shift(), run = Math.min(P.q, r.left);
              const last = segs[segs.length - 1];
              if (last && last[0] === r.who && last[3] === r.k && Math.abs(last[2] - t) < 1e-9) last[2] = t + run; else segs.push([r.who, t, t + run, r.k]);
              t += run; r.left -= run;
              if (r.left > 1e-9) q.push(r); else fin[r.who] = t;
            }
          }
          return { segs, fin, total: t };
        }
        const NW = ctx.narrow, X0 = NW ? 80 : 100, TW = NW ? 270 : 424;
        const svg = s('svg', { viewBox: `0 0 ${NW ? 360 : 536} 150`, width: '100%', style: 'flex:none' });
        const you = h('div', { class: 'big' }), longT = h('div', { class: 'b', style: { fontSize: '22px' } }), feel = h('span', { class: 'chip' });
        const say = h('div', { class: 'callout m0 small', style: { lineHeight: '1.42' } });
        function draw() {
          const { segs, fin, total } = schedule();
          const span = P.zoom === 'all' ? total : 3;
          const x = (tt) => X0 + (Math.min(tt, span) / span) * TW;
          const rows = { long: 30, other: 68, you: 106 };
          const kids = [];
          const step = span > 20 ? 5 : span > 5 ? 2 : 0.5;
          for (let tt = 0; tt <= span + 1e-9; tt += step) kids.push(s('line', { x1: x(tt), y1: 20, x2: x(tt), y2: 132, style: 'stroke:var(--line)', 'stroke-dasharray': '2 4' }), s('text', { x: x(tt), y: 14, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, tt + ' s'));
          [['long', 'Long job'], ['other', `${P.n - 2} other${P.n > 3 ? 's' : ''}`], ['you', 'You']].forEach(([k, l]) => kids.push(
            s('rect', { x: X0, y: rows[k], width: TW, height: 26, rx: 4, style: 'fill:var(--panel-3);stroke:none' }),
            s('text', { x: X0 - 8, y: rows[k] + 18, 'text-anchor': 'end', 'font-size': 14, 'font-weight': 800, style: k === 'you' ? 'fill:var(--accent)' : '' }, l)));
          segs.filter((g) => g[1] < span).forEach(([who, a, b, k]) => kids.push(s('rect', { x: x(a), y: rows[who], width: Math.max(1.2, x(b) - x(a)), height: 26, class: who === 'long' ? 's-cpu' : who === 'you' ? 's-accent' : (k % 2 ? 'f-run' : 's-proc'), 'stroke-width': who === 'you' ? 2.5 : 0.8 })));
          const fx = x(fin.you), off = fin.you > span;
          kids.push(s('line', { x1: fx, y1: 100, x2: fx, y2: 140, style: 'stroke:var(--accent)', 'stroke-width': 2.5, 'stroke-dasharray': off ? '3 3' : null }),
            s('text', { x: Math.min(Math.max(fx, X0 + (NW ? 90 : 130)), X0 + TW - (NW ? 90 : 130)), y: 147, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, style: 'fill:var(--accent)' },
              off ? (NW ? `answer at ${ctx.util.fmt(fin.you, 1)} s, off chart →` : `your answer comes at ${ctx.util.fmt(fin.you, 1)} s, off this chart →`) : `${NW ? 'answer' : 'you get your answer'} at ${ctx.util.fmt(fin.you, 1)} s`));
          svg.replaceChildren(...kids);
          const r = fin.you;
          you.textContent = ctx.util.fmt(r, 1) + ' s';
          you.style.color = r < 2 ? 'var(--ok)' : r < 10 ? 'var(--warn)' : 'var(--bad)';
          longT.textContent = ctx.util.fmt(fin.long, 1) + ' s';
          feel.className = 'chip ' + (r < 2 ? 'ok' : r < 10 ? 'warn' : 'bad');
          feel.textContent = r < 0.5 ? 'feels instant' : r < 2 ? 'feels snappy' : r < 10 ? 'noticeably sluggish' : 'useless for interactive work';
          say.className = 'callout m0 small ' + (P.mode === 'batch' ? 'bad' : 'why');
          say.setAttribute('data-label', P.mode === 'batch' ? 'Run to completion' : 'Time slicing');
          say.innerHTML = P.mode === 'batch'
            ? `Your 0.1-second command waits behind the whole 20-second job. Fine for a batch system, whose goal is keeping the processor busy, but a person at a terminal gives up.`
            : `Each request gets ${ctx.util.fmt(P.q, 1)} s in turn, so your tiny command finishes in the first round. The long job ends later (${ctx.util.fmt(fin.long, 1)} s, not 20 s): the same total work in a friendlier order.${P.n > 15 ? ' More users means a longer round for everyone.' : ''}`;
        }
        const seg = ctx.ui.seg([{ value: 'batch', label: 'Run each to completion' }, { value: 'ts', label: 'Time slicing' }], P.mode, (v) => { P.mode = v; draw(); });
        const sN = ctx.ui.slider({ label: 'Users, including you', min: 3, max: 30, value: P.n, onInput: (v) => { P.n = v; draw(); } });
        const sQ = ctx.ui.slider({ label: 'Time slice', min: 0.1, max: 1, step: 0.1, value: P.q, format: (v) => ctx.util.fmt(v, 1) + ' s', onInput: (v) => { P.q = v; draw(); } });
        const left = h('div', { class: 'stack', style: { gap: '9px' } },
          h('p', { class: 'm0', style: { fontSize: '16px', lineHeight: '1.45' }, html: 'Multiprogramming kept the processor busy, but batch users still handed in a job and waited, often for hours. In the 1960s, <span class="t">time sharing</span> applied multiprogramming to <b>interactive</b> work: many users at terminals share one processor, each getting a short <span class="t">time slice</span> in turn.' }),
          h('p', { class: 'small m0', style: { lineHeight: '1.42' }, html: 'With <i>n</i> active users, each gets roughly 1/<i>n</i> of the processor, minus the OS\'s own overhead. People think and type slowly next to a computer, so a well-run system still feels like a private machine.' }),
          h('table', { class: 'tbl compact' },
            h('tr', {}, h('th', {}, ''), h('th', {}, ctx.narrow ? 'Batch' : 'Batch multiprogramming'), h('th', {}, 'Time sharing')),
            h('tr', {}, h('td', { class: 'b' }, 'Main goal'), h('td', {}, 'Maximize processor use'), h('td', { html: 'Minimize <span class="t">response time</span>' })),
            h('tr', {}, h('td', { class: 'b' }, 'Instructions to the OS come from'), h('td', {}, 'Job control language commands sent with the job'), h('td', {}, 'Commands the user types at the terminal'))),
          h('div', { class: 'callout analogy m0 small', 'data-label': 'Analogy', html: 'A chess champion playing twenty boards at once makes one move at each in turn. Nobody waits long, yet only one board is ever being played.' }),
          h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'Time sharing does not make the processor faster or do more work. It changes the <i>order</i>, so short requests stop waiting behind long ones.' }));
        const right = h('div', { class: 'card white stack', style: { gap: '8px' } },
          h('p', { class: 'small m0', html: '<b style="font-size:17px">Response-time lab.</b> <span class="muted">Everyone presses Enter at once. First in line: a 20-second computation. Then other users, each needing 0.3 s. Last: <b style="color:var(--accent)">your</b> command, needing only 0.1 s.</span>' }),
          h('div', { class: 'row', style: { justifyContent: 'space-between' } }, seg, ctx.ui.seg([{ value: 'all', label: 'Whole run' }, { value: 'zoom', label: 'First 3 s' }], P.zoom, (v) => { P.zoom = v; draw(); })), sN, sQ, svg,
          h('div', { class: 'row nw', style: { gap: '22px', alignItems: 'flex-end' } },
            h('div', { class: 'kpi' }, h('span', { class: 'xs muted b' }, 'YOUR RESPONSE TIME'), you),
            h('div', { class: 'kpi' }, h('span', { class: 'xs muted b' }, 'LONG JOB DONE AT'), longT),
            h('div', { style: { marginBottom: '8px' } }, feel)),
          say);
        el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.18fr)' } }, left, right));
        draw();
      },
    },

    /* ---------------- 8. CTSS: clock-driven swapping, only the overwritten words go to disk ---------------- */
    {
      title: 'CTSS: time sharing on a 1961 machine',
      kind: 'explore',
      render(el, ctx) {
        const { h, s } = ctx;
        const SIZE = { 1: 10000, 2: 24000, 3: 4000, 4: 14000 };
        const COL = { 1: 'proc', 2: 'thread', 3: 'warn', 4: 'cpu' };
        const TURNS = [1, 2, 3, 1, 4, 2];
        const n0 = (v) => v.toLocaleString('en-US');
        /* Replay a list of turns: for each turn record what is written out, what is read in, and what stays resident.
           cs = words moved by CTSS (only overwritten words go out); cn = words moved if whole programs were swapped. */
        function build(turns) {
          const res = { 1: [], 2: [], 3: [], 4: [] };
          const out0 = [{ t: null, run: null, res: JSON.parse(JSON.stringify(res)), out: [], inW: 0, cs: 0, cn: 0 }];
          let cs = 0, cn = 0;
          turns.forEach((J, i) => {
            const lo = 5000, hi = 5000 + SIZE[J], out = [];
            for (const K of [1, 2, 3, 4]) {
              if (K === J) continue;
              const keep = []; let w = 0;
              for (const [a, b] of res[K]) {
                const oa = Math.max(a, lo), ob = Math.min(b, hi);
                if (ob > oa) { w += ob - oa; if (a < oa) keep.push([a, oa]); if (b > ob) keep.push([ob, b]); } else keep.push([a, b]);
              }
              res[K] = keep; if (w) out.push([K, w]);
            }
            const inW = SIZE[J] - res[J].reduce((a, [x, y]) => a + y - x, 0);
            res[J] = [[lo, hi]];
            const prev = turns[i - 1];
            cs += out.reduce((a, x) => a + x[1], 0) + inW;
            if (!i) cn += SIZE[J]; else if (prev !== J) cn += SIZE[prev] + SIZE[J];
            out0.push({ t: i * 0.2, run: J, res: JSON.parse(JSON.stringify(res)), out, inW, cs, cn });
          });
          return out0;
        }
        const F = build(TURNS);
        F.push(Object.assign({}, F[F.length - 1], { summary: true }));
        const CAP = [
          'Four users are logged in at terminals; their programs wait on disk. The monitor always holds words 0 to 4,999, and every user program is loaded starting at word 5,000.',
          '<b>t = 0.0 s.</b> JOB1 (10,000 words) is read in at word 5,000 and starts running. Nothing needs to be written out yet.',
          '<b>Clock interrupt at 0.2 s.</b> The monitor takes the processor back and picks JOB2. JOB2 (24,000 words) would cover all of JOB1, so JOB1\'s 10,000 words go to disk first; then JOB2 is read in.',
          '<b>0.4 s: JOB3\'s turn.</b> JOB3 is small (4,000 words), so it overwrites only the first 4,000 words of JOB2 (words 5,000 to 8,999). Only those are written out; JOB2\'s other 20,000 words stay in memory.',
          '<b>0.6 s: JOB1 again.</b> Its space holds JOB3 and 6,000 more words of JOB2, so both are written out (10,000 words) and JOB1 is read back in. 14,000 words of JOB2 are still in memory.',
          '<b>0.8 s: JOB4</b> (14,000 words) needs words 5,000 to 18,999, so JOB1 and 4,000 more words of JOB2 go to disk. JOB2\'s last 10,000 words (19,000 to 28,999) have never been disturbed.',
          '<b>1.0 s: JOB2 again.</b> JOB4 is written out, but only 14,000 words of JOB2 must be read in: its last 10,000 words never left memory.',
          '<b>The payoff.</b> Six turns moved 128,000 words between memory and disk. Writing every outgoing program out whole and reading every incoming one whole would have moved 148,000.',
        ];
        /* on phones the per-job disk panel is dropped so the memory map can be drawn larger */
        const NW = ctx.narrow;
        const svg = s('svg', { viewBox: `0 0 ${NW ? 400 : 640} 336`, width: '100%' });
        const Y0 = 40, K = 288 / 32000, MX = 70, MW = 196;
        const ya = (a) => Y0 + a * K;
        const tallyA = h('div', { class: 'bar' }, h('i', { style: { background: 'var(--ok)' } }));
        const tallyB = h('div', { class: 'bar' }, h('i', { style: { background: 'var(--bad)' } }));
        const tA = h('span', { class: 'v', style: { width: 'auto' } }), tB = h('span', { class: 'v' });
        function draw(f) {
          const kids = [
            s('text', { x: 0, y: 18, 'font-size': 16, 'font-weight': 800 }, f.t == null ? 'Before the first turn' : `t = ${f.t.toFixed(1)} s`),
            s('text', { x: NW ? 396 : 282, y: 18, 'text-anchor': NW ? 'end' : 'start', 'font-size': 14, 'font-weight': 700, style: f.run ? `fill:var(--${COL[f.run]})` : '' }, f.run ? `processor: JOB${f.run}` : 'processor: monitor'),
            s('rect', { x: MX, y: ya(0), width: MW, height: ya(5000) - ya(0), rx: 4, class: 's-os', 'stroke-width': 2 }),
            s('text', { x: MX + MW / 2, y: (ya(0) + ya(5000)) / 2 + 5, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 800, style: 'fill:var(--os)' }, 'Monitor · 5,000 words'),
            s('rect', { x: MX, y: ya(5000), width: MW, height: ya(32000) - ya(5000), rx: 4, class: 's-muted', 'stroke-dasharray': '5 4', style: 'fill:var(--panel)' }),
            s('text', { x: MX + MW / 2, y: ya(31000) + 4, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, 'user area: 27,000 words'),
          ];
          const ticks = new Set([0, 5000, 32000]);
          [1, 2, 3, 4].forEach((j) => f.res[j].forEach(([a, b]) => {
            const run = f.run === j && !f.summary, y1 = ya(a), y2 = ya(b);
            ticks.add(a); ticks.add(b);
            kids.push(s('rect', { x: MX + 3, y: y1 + 1.5, width: MW - 6, height: y2 - y1 - 3, rx: 4, class: 's-' + COL[j], 'stroke-width': run ? 3 : 1.5, 'stroke-dasharray': run ? null : '4 3', style: run ? '' : 'fill-opacity:.45' }),
              s('text', { x: MX + MW / 2, y: (y1 + y2) / 2 + 5, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 800 }, `JOB${j}${run ? ' ▶ running' : b - a < SIZE[j] ? ' (part)' : ' (waiting)'}`));
          }));
          [...ticks].forEach((a) => kids.push(s('text', { x: MX - 6, y: ya(a) + 4, 'text-anchor': 'end', 'font-size': 12, class: 's-sub' }, n0(a))));
          const outW = f.out.reduce((a, x) => a + x[1], 0);
          const arrow = (y, dir, txt, on) => [
            s('line', { x1: dir > 0 ? 280 : 392, y1: y, x2: dir > 0 ? 388 : 284, y2: y, style: on ? 'stroke:var(--io)' : 'stroke:var(--line-2)', 'stroke-width': 3, 'marker-end': on ? 'url(#arr-io)' : 'url(#arr-muted)' }),
            s('text', { x: 336, y: y - 8, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 700, style: on ? 'fill:var(--io)' : '', class: on ? '' : 's-sub' }, txt)];
          if (!f.summary) kids.push(...arrow(150, 1, outW ? `out ${n0(outW)} words` : 'nothing out', outW > 0), ...arrow(210, -1, f.inW ? `in ${n0(f.inW)} words` : 'nothing in', f.inW > 0));
          if (!NW) kids.push(s('rect', { x: 398, y: 30, width: 240, height: 288, rx: 12, class: 's-io', 'stroke-width': 2 }),
            s('text', { x: 412, y: 54, 'font-size': 15, 'font-weight': 800, style: 'fill:var(--io)' }, 'Where each job\'s words are'));
          if (!NW) [1, 2, 3, 4].forEach((j, r) => {
            const y = 76 + r * 58, bw = (SIZE[j] / 24000) * 212;
            kids.push(s('text', { x: 412, y: y + 12, 'font-size': 13.5, 'font-weight': 800, style: `fill:var(--${COL[j]})` }, `JOB${j}`), s('text', { x: 456, y: y + 12, 'font-size': 12.5, class: 's-sub' }, `${n0(SIZE[j])} words`),
              s('rect', { x: 412, y: y + 20, width: bw, height: 18, rx: 3, style: 'fill:var(--panel-3);stroke:var(--line-2)', 'stroke-dasharray': '3 3' }));
            f.res[j].forEach(([a, b]) => kids.push(s('rect', { x: 412 + ((a - 5000) / SIZE[j]) * bw, y: y + 20, width: ((b - a) / SIZE[j]) * bw, height: 18, rx: 3, class: 's-' + COL[j], 'stroke-width': 1.5 })));
          });
          if (!NW) kids.push(s('text', { x: 412, y: 310, 'font-size': 12.5, class: 's-sub' }, 'colour: in memory · grey: on disk only'));
          svg.replaceChildren(...kids);
          const top = Math.max(148000, f.cn);
          tallyA.firstChild.style.width = (f.cs / top) * 100 + '%'; tallyB.firstChild.style.width = (f.cn / top) * 100 + '%';
          tA.textContent = n0(f.cs); tB.textContent = n0(f.cn);
        }
        const player = ctx.ui.player({ count: F.length, interval: 3200, render: (i) => { draw(F[i]); return CAP[i]; } });
        /* ---- "you pick the turns" mode: the student acts as the monitor's scheduler ---- */
        const MAXT = 8;
        let mine = [];
        function describe(f, n) {
          if (!n) return '<b>You are the monitor.</b> At each clock interrupt, pick the job that runs next and watch which words must move. Try a small job right after a big one, or the same job twice.';
          const outW = f.out.reduce((a, x) => a + x[1], 0);
          const outs = f.out.map(([K, w], i) => `${n0(w)}${i ? '' : ' words'} of JOB${K}`).join(' and ');
          return `<b>t = ${f.t.toFixed(1)} s: JOB${f.run}</b> (${n0(SIZE[f.run])} words) runs. ` + (outW ? `Written out: ${outs}. ` : 'Nothing written out. ')
            + (f.inW ? `Read in: ${n0(f.inW)} words.` : 'Nothing read in: all of it was still in memory.') + (n >= MAXT ? ' <b>Last turn:</b> compare the two tallies above.' : '');
        }
        const pickCap = h('div', { class: 'player-cap', 'aria-live': 'polite' });
        const turnCt = h('span', { class: 'player-count' });
        const jobBtns = [1, 2, 3, 4].map((j) => h('button', { class: 'btn sm', type: 'button', style: { borderColor: `var(--${COL[j]})`, color: `var(--${COL[j]})`, fontWeight: 800 }, onclick: () => { if (mine.length < MAXT) { mine.push(j); showMine(); } } }, 'JOB' + j));
        const undo = h('button', { class: 'btn sm', type: 'button', onclick: () => { mine.pop(); showMine(); } }, 'Undo');
        const clear = h('button', { class: 'btn sm', type: 'button', onclick: () => { mine = []; showMine(); } }, 'Start over');
        const pick = h('div', { class: 'player', style: { display: 'none' } }, pickCap,
          h('div', { class: 'player-ctl' }, h('span', { class: 'small b' }, 'Run next:'), ...jobBtns, turnCt, h('span', { class: 'grow' }), undo, clear));
        function showMine() {
          const fr = build(mine), f = fr[fr.length - 1];
          draw(f);
          pickCap.innerHTML = describe(f, mine.length);
          jobBtns.forEach((b) => { b.disabled = mine.length >= MAXT; });
          undo.disabled = clear.disabled = !mine.length;
          turnCt.textContent = `Turn ${mine.length} / ${MAXT}`;
        }
        const modeSeg = ctx.ui.seg([{ value: 'ex', label: 'Watch the example' }, { value: 'you', label: 'You pick the turns' }], 'ex', (v) => {
          if (v === 'you') { player.stop(); player.el.style.display = 'none'; pick.style.display = ''; showMine(); }
          else { pick.style.display = 'none'; player.el.style.display = ''; player.refresh(); }
        });
        const left = h('div', { class: 'stack', style: { gap: '9px' } },
          h('p', { class: 'm0', style: { fontSize: '16px', lineHeight: '1.45' }, html: 'One of the first time-sharing systems was the <span class="t" data-t="CTSS">Compatible Time-Sharing System (CTSS)</span>, built at MIT in 1961 for the IBM 709 and later run on the IBM 7094.' }),
          h('ul', { class: 'small m0', style: { lineHeight: '1.42', display: 'flex', flexDirection: 'column', gap: '4px' } },
            h('li', { html: '<b>Memory:</b> 32,000 words of 36 bits. The resident monitor took 5,000, leaving 27,000 words for one user program at a time.' }),
            h('li', { html: '<b>Same address every time:</b> each user program was loaded starting at word 5,000, which kept the monitor simple.' }),
            h('li', { html: '<b>Clock:</b> an <span class="t">interrupt</span> about every 0.2 s let the OS take the processor back and give it to another user.' }),
            h('li', { html: '<b><span class="t">Swapping</span>:</b> the outgoing user\'s program and data went to disk before the next one came in. To save disk traffic, only the words the newcomer would overwrite were written out.' })),
          h('div', { class: 'card tight intr' }, h('h4', {}, 'New problems time sharing created'),
            h('ul', { class: 'small m0', style: { lineHeight: '1.4' } },
              h('li', { html: '<b>Protection among users:</b> many users\' programs share one machine and must not interfere.' }),
              h('li', { html: '<b>File system protection:</b> only authorized users may open a given file.' }),
              h('li', { html: '<b>Contention for resources:</b> users compete for printers and disks, so conflicting requests must be settled.' }))),
          h('div', { class: 'row', style: { gap: '10px' } }, h('span', { class: 'small b' }, 'Simulator:'), modeSeg));
        const right = h('div', { class: 'stack', style: { gap: '6px' } }, svg,
          h('div', { class: 'bars', style: { gap: '4px' } },
            h('div', { class: 'xs muted b' }, 'WORDS MOVED BETWEEN MEMORY AND DISK SO FAR'),
            h('div', { class: 'bar-row', style: { gridTemplateColumns: (NW ? '120px' : '250px') + ' minmax(0, 1fr) 64px' } }, h('span', { class: 'small b' }, NW ? 'CTSS way' : 'CTSS: only overwritten words'), tallyA, tA),
            h('div', { class: 'bar-row', style: { gridTemplateColumns: (NW ? '120px' : '250px') + ' minmax(0, 1fr) 64px' } }, h('span', { class: 'small b' }, NW ? 'Whole programs' : 'Swapping whole programs'), tallyB, tB)),
          player.el, pick);
        el.append(h('div', { class: 'split l fill' }, left, right));
      },
    },

    /* ---------------- 9. Recap: the chain of eras + flip cards ---------------- */
    {
      title: 'Recap: each era fixed the last one\'s biggest waste',
      kind: 'recap',
      render(el, ctx) {
        const { h } = ctx;
        const ERAS = [
          ['io', 'Serial processing', 'No OS. Programmers run the machine by hand, one booking at a time.', 'Idle time from sign-up blocks and manual setup'],
          ['os', 'Simple batch', 'A resident monitor runs jobs back to back, guided by JCL cards.', 'Processor idle while the one job waits for I/O'],
          ['proc', 'Multiprogrammed batch', 'Several jobs in memory; switch whenever one waits for I/O.', 'No way to interact; results arrive hours later'],
          ['cpu', 'Time sharing', 'Short time slices for many terminal users (CTSS, 1961).', 'Protection, file security, resource contention'],
        ];
        el.append(h('div', { class: 'stack fill', style: { gap: '12px' } },
          h('div', { class: ctx.narrow ? 'stack' : 'chain', style: ctx.narrow ? { gap: '8px' } : {} }, ERAS.map(([c, t, idea, left]) => h('div', { class: 'card tight ' + c, style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
            h('div', { class: 'b', style: { fontSize: '16px', color: `var(--${c})` } }, t),
            h('div', { class: 'small', style: { lineHeight: '1.35' } }, idea),
            h('div', { class: 'xs', style: { marginTop: 'auto', lineHeight: '1.35' } }, h('b', { style: { color: 'var(--warn)' } }, 'Left open: '), left)))),
          h('p', { class: 'm0 muted small' }, 'Say each answer out loud before you click the card to check it.'),
          ctx.ui.flipcards([
            ['The two problems of serial processing', '<b>Scheduling:</b> fixed sign-up blocks were wasted or too short. <b>Setup time:</b> loading the compiler and source, then linking and loading, ate the session.'],
            ['What does the resident monitor do?', 'It stays in memory, reads each job\'s JCL cards, loads and starts programs, and takes control back when each job ends.'],
            ['Four hardware features a batch monitor needs', 'Memory protection, a timer, privileged instructions and interrupts, plus two processor modes: user and kernel.'],
            ['Read 15 µs, compute 1 µs, write 15 µs: utilization?', '1 / 31 ≈ <b>3.2%</b> with one program. About 6.5% with two and 9.7% with three.'],
            ['JOB1, JOB2, JOB3: what does multiprogramming change?', 'Elapsed time 30 → 15 min, throughput 6 → 12 jobs/hr, mean response 18 → 10 min, and every resource is busier.'],
            ['Batch multiprogramming vs time sharing', 'Batch: maximize processor use; directions come from JCL. Time sharing: minimize response time; directions are typed at a terminal.'],
            ['User mode vs kernel mode', 'User mode: jobs run with protected memory and privileged instructions off-limits. Kernel mode: the OS may do anything. Traps and interrupts switch to kernel mode.'],
            ['CTSS in numbers', 'MIT, 1961. 32,000 words of 36 bits, 5,000 for the monitor. A clock interrupt about every 0.2 s; only the words a newcomer overwrites are swapped out.'],
          ].map(([f, bk]) => ['<div>' + f + '</div>', '<div>' + bk + '</div>']), { cols: 4, height: 150 })));
      },
    },

    /* ---------------- 10. Check yourself ---------------- */
    {
      title: 'Check yourself',
      kind: 'check',
      quiz: [
        { q: 'In the serial-processing era (late 1940s to mid-1950s), how did a programmer get time on the computer?',
          choices: ['By reserving a block of time on a paper sign-up sheet', 'The operating system\'s scheduler gave each job a time slice', 'An operator grouped jobs into a batch on tape', 'By typing commands at a terminal whenever they liked'], answer: 0,
          feedback: [null, 'There was no operating system at all in this era, so nothing could hand out time slices.', 'Operators batching jobs came later, with simple batch systems in the mid-1950s.', 'Interactive terminals arrived with time sharing in the 1960s.'],
          why: 'With no OS, programmers booked the machine by hand. A booked block was either partly wasted (finish early) or too short (stopped before finishing).' },
        { type: 'order', q: 'In a simple batch system, put a FORTRAN job\'s cards in the order the resident monitor reads them (first card first).',
          items: ['$JOB', '$FTN', 'FORTRAN source program', '$LOAD', '$RUN', 'Data for the program', '$END'],
          why: '$JOB starts the job; $FTN loads the compiler, which reads the source cards right after it; $LOAD loads the compiled program; $RUN starts it, and it reads the data cards; $END closes the job.' },
        { type: 'match', q: 'Match each hardware feature to the trouble it prevents in a batch system.',
          pairs: [['Memory protection', 'A buggy job overwriting the monitor'], ['Timer', 'One job keeping the processor forever'], ['Privileged instructions', 'A job reading the card reader directly and swallowing the next job\'s cards'], ['Interrupts', 'The OS having no way to regain control when a device finishes']],
          why: 'Protection guards the monitor\'s memory, the timer bounds each job\'s time, privileged instructions keep I/O in the monitor\'s hands, and interrupts let events hand control back to the OS.' },
        { type: 'tf', q: 'In kernel mode the processor refuses privileged instructions, so the monitor has to ask user programs to perform I/O for it.', answer: false,
          why: 'It is the other way round. User mode refuses privileged instructions and protects some memory; the monitor runs in kernel mode, where it may execute privileged instructions and touch protected memory.' },
        { type: 'num', q: 'A program reads a record in 15 µs, executes 100 instructions on it in 1 µs, and writes the result in 15 µs. Running alone (uniprogramming), what percentage of the time is the processor busy?', answer: 3.2, tol: 0.1, unit: '%',
          why: 'The processor is busy 1 µs out of every 15 + 1 + 15 = 31 µs: 1 / 31 ≈ 0.032, or 3.2%. It idles almost 97% of the time.' },
        { type: 'num', q: 'Each program repeats: read a record (20 µs), compute (10 µs), write a record (20 µs). Three such programs are multiprogrammed, each with its own I/O device. What is the processor utilization, in percent?', answer: 60, tol: 0.5, unit: '%',
          hint: 'How much processor time do three programs need per cycle, and how long is a cycle?',
          why: 'Each program needs 10 µs of processor per 50 µs cycle. Three need 30 µs of every 50 µs: 30 / 50 = 60%. (It could never go past 100%.)' },
        { type: 'num', q: 'Three jobs arrive together and run one after another (uniprogramming), taking 5, then 15, then 10 minutes. What is their mean response time, in minutes?', answer: 18.33, tol: 0.4, unit: 'min',
          why: 'They finish at 5, 20 and 30 minutes, so the mean is (5 + 20 + 30) / 3 = 55 / 3 ≈ 18.3 min. Run together under multiprogramming they would finish at 5, 15 and 10: a mean of 10 min.' },
        { q: 'Three jobs take 30 minutes in total under uniprogramming but only 15 minutes under multiprogramming. What happens to throughput?',
          choices: ['It doubles, from 6 to 12 jobs per hour', 'It halves, from 12 to 6 jobs per hour', 'It stays the same, because the same three jobs ran', 'It rises from 3 to 6 jobs per hour'], answer: 0,
          feedback: [null, 'Doing the same work in less time raises throughput; it does not lower it.', 'Throughput is work per unit of time. The same work in half the time is twice the rate.', 'Three jobs in 30 minutes is 6 per hour, not 3.'],
          why: 'Throughput = jobs finished per unit of time: 3 jobs in 0.5 h = 6 jobs/h, and 3 jobs in 0.25 h = 12 jobs/h.' },
        { type: 'bucket', q: 'Does each statement describe batch multiprogramming or time sharing?', buckets: ['Batch multiprogramming', 'Time sharing'],
          items: [['Main goal: keep the processor as busy as possible', 0], ['Main goal: answer each user quickly', 1], ['Instructions come from job control language cards sent with the job', 0], ['Instructions are commands typed at a terminal', 1], ['A clock interrupt takes the processor back every fraction of a second', 1], ['Users hand in a job and collect printed output later', 0]],
          why: 'Batch multiprogramming maximizes processor use and is steered by JCL; time sharing minimizes response time, is steered by commands typed at terminals, and slices time with a clock.' },
        { type: 'multi', q: 'Which problems did time sharing bring to the fore? Select all that apply.',
          choices: ['Protecting users\' programs from one another', 'Protecting files so only authorized users can open them', 'Settling contention for shared devices such as printers and disks', 'Booking machine time on paper sign-up sheets', 'Loading the compiler by hand for every job'], answer: [0, 1, 2],
          why: 'With many users on one machine at once, the OS must keep them apart, guard their files, and referee shared resources. Sign-up sheets and hand-loaded compilers belong to the serial era.' },
        { type: 'num', q: 'CTSS ran on a machine with 32,000 words of memory, and its resident monitor used 5,000 of them. How many words were left for a user program?', answer: 27000, tol: 0, unit: 'words',
          why: '32,000 − 5,000 = 27,000 words, and every user program was loaded starting at word 5,000.' },
        { q: 'When CTSS switched from one user to the next, why did it sometimes write only part of the old program to disk?',
          choices: ['To cut disk traffic: only the words the incoming program would overwrite had to be saved', 'Because the disk was too small to hold whole programs', 'Because the 0.2-second clock left too little time to copy everything', 'To give the old program more memory when it resumed'], answer: 0,
          feedback: [null, 'Disk space was not the reason; the goal was fewer transfers.', 'The monitor copies what it needs before loading the newcomer; the clock does not cut it short.', 'A resumed program still used the same space, starting at word 5,000.'],
          why: 'Words the newcomer did not overwrite were still intact in memory, so saving them and later reading them back would have been wasted disk work.' },
      ],
    },
  ],

  notes: `
    <h3>Why operating systems evolve</h3>
    <p>An OS is never finished. It changes because of <b>hardware upgrades and new kinds of hardware</b> (multicore chips, new devices), <b>new services</b> that users ask for, and <b>fixes</b> for faults (which can bring new faults). Its early history is a chain in which each era removed the previous era's biggest waste:</p>
    <table>
      <tr><th>Era</th><th>Main idea</th><th>Problem left open</th></tr>
      <tr><td>Serial processing (late 1940s to mid-1950s)</td><td>No OS; programmers run the machine by hand</td><td>Wasted booked time, long setup</td></tr>
      <tr><td>Simple batch (mid-1950s)</td><td>A resident monitor runs jobs back to back</td><td>Processor idle during each job's I/O</td></tr>
      <tr><td>Multiprogrammed batch (1960s)</td><td>Several jobs in memory; switch when one waits</td><td>No interaction; long waits</td></tr>
      <tr><td>Time sharing (1960s on; CTSS 1961)</td><td>Short time slices for many terminal users</td><td>Protection, file security, contention</td></tr>
    </table>
    <h3>Serial processing</h3>
    <p>No operating system. The programmer worked the hardware directly: a <b>console</b> of display lights and toggle switches, an <b>input device</b> such as a card reader (programs in machine code on cards), and a <b>printer</b>. After an error, the lights showed the problem. Two problems:</p>
    <ul>
      <li><b>Scheduling:</b> time was booked on a paper sign-up sheet in fixed blocks, so a job either left part of its block idle or was cut off before finishing.</li>
      <li><b>Setup time:</b> loading the compiler and source program, saving the compiled program, then loading and linking it, often with tapes or card decks to mount. An error meant starting over.</li>
    </ul>
    <h3>Simple batch systems</h3>
    <p>General Motors developed the first batch monitor for its IBM 701 in the mid-1950s; its successor, GM-NAA I/O (1956), ran on the IBM 704. Users hand jobs to an <b>operator</b>, who groups them into a <b>batch</b>; a <b>monitor</b> program runs them one after another. The <b>resident monitor</b> stays in memory (interrupt processing, device drivers, job sequencing, control language interpreter); the rest is the user program area. The monitor reads a job, branches to it, and gets control back when the job ends or fails, so the processor <b>alternates between the monitor and a user program</b> with no human gap.</p>
    <p><b>Job control language (JCL)</b> cards, in reading order: <b>$JOB</b> (start; account to charge) → <b>$FTN</b> (load the FORTRAN compiler) → source cards (compiled to object code) → <b>$LOAD</b> (load the object program) → <b>$RUN</b> (jump to it) → data cards (read through the monitor's input routine) → <b>$END</b>. Out of order (say, $RUN before $LOAD) the monitor aborts the job and skips to the next $JOB.</p>
    <p><b>Hardware a monitor needs:</b></p>
    <ul>
      <li><b>Memory protection:</b> a program may not alter the monitor's memory; an attempt traps to the monitor, which aborts the job.</li>
      <li><b>Timer:</b> set for each job; when it expires, control returns to the monitor, so no job hogs the machine.</li>
      <li><b>Privileged instructions:</b> I/O and similar instructions run only in the monitor, so a program cannot read the next job's control cards.</li>
      <li><b>Interrupts:</b> absent on early machines; the timer and I/O devices use them to hand control back to the monitor, so the OS can give up the processor and win it back flexibly.</li>
    </ul>
    <p><b>User mode:</b> user programs run with protected memory and privileged instructions off-limits. <b>Kernel mode</b> (system or control mode): the monitor may execute privileged instructions and access protected memory. A trap or interrupt switches the processor to kernel mode; the monitor switches back when it resumes a job. <b>Costs:</b> the monitor uses memory and processor time, yet utilization is far better than with serial processing.</p>
    <h3>Multiprogrammed batch systems</h3>
    <p>I/O is slow next to the processor, so even with automatic sequencing it sits idle. <b>Processor utilization</b> = busy time / total time. Example: read a record 15 µs, execute 100 instructions 1 µs, write a record 15 µs: utilization = 1 / 31 ≈ <b>3.2%</b>.</p>
    <p><b>Uniprogramming:</b> one program in memory; the processor waits for every I/O. <b>Multiprogramming</b> (multitasking): several programs in memory; when one waits for I/O, the processor runs another. If each program has its own device, utilization with n programs = n × compute / (read + compute + write), at most 100%. For 15/1/15: 3.2%, 6.5% and 9.7% with 1, 2 and 3 programs. For 20/10/20 with three programs: 30 / 50 = 60%. With one processor the programs still compute one at a time; what overlaps is one program's computing with the others' I/O. The OS needs <b>memory management</b> and <b>scheduling</b>; the hardware needs <b>I/O interrupts</b> and <b>DMA</b> (direct memory access) so devices work on their own and signal when done.</p>
    <p><b>Three-job example.</b> 250 MB of user memory, a disk, a terminal, a printer. JOB1: heavy compute, 5 min, 50 MB. JOB2: heavy I/O on the terminal, 15 min, 100 MB. JOB3: heavy I/O on disk and printer, 10 min, 75 MB. About 6 processor-minutes in all; the jobs barely interfere. Each utilization is the average share in use over the run: processor 6 / 30 = 20% versus 6 / 15 = 40%.</p>
    <table>
      <tr><th>Measure</th><th>Uniprogramming</th><th>Multiprogramming</th></tr>
      <tr><td>Processor use</td><td>20%</td><td>40%</td></tr>
      <tr><td>Memory, disk, printer use</td><td>33% each</td><td>67% each</td></tr>
      <tr><td>Elapsed time</td><td>30 min</td><td>15 min</td></tr>
      <tr><td>Throughput</td><td>6 jobs/hr</td><td>12 jobs/hr</td></tr>
      <tr><td>Mean response time</td><td>18 min</td><td>10 min</td></tr>
    </table>
    <p>One at a time, the jobs finish at 5, 20 and 30 min: mean (5 + 20 + 30) / 3 ≈ 18 min. Together they finish at 5, 15 and 10: mean 10 min. Throughput: 3 jobs in 0.5 h = 6/h versus 3 in 0.25 h = 12/h.</p>
    <h3>Time-sharing systems</h3>
    <p>The processor's time is shared among many interactive users at terminals, each getting a short <b>time slice</b> in turn. With n users each sees about 1/n of the machine, yet responses feel quick because people are slow next to a computer.</p>
    <table>
      <tr><th></th><th>Batch multiprogramming</th><th>Time sharing</th></tr>
      <tr><td>Principal objective</td><td>Maximize processor use</td><td>Minimize response time</td></tr>
      <tr><td>Directives to the OS</td><td>JCL commands provided with the job</td><td>Commands entered at the terminal</td></tr>
    </table>
    <p>Example: a 20 s job, four users needing 0.3 s each and your 0.1 s command arrive together. Run to completion, you wait 21.3 s. With 0.2 s slices you wait 1.1 s, and the long job ends at 21.3 s instead of 20 s: same work, better order. More users means longer rounds.</p>
    <h4>CTSS (MIT, 1961; IBM 709, later 7094)</h4>
    <ul>
      <li>32,000 words of 36 bits; the monitor used 5,000, leaving 27,000. Every user program was loaded at word 5,000.</li>
      <li>A clock interrupt about every 0.2 s let the OS regain control and switch users.</li>
      <li><b>Swapping:</b> the old user's program and data went to disk before the next was read in, and came back at its next turn. To cut disk traffic, only words the incoming program would overwrite were written out.</li>
    </ul>
    <p>Example: JOB1 10,000, JOB2 24,000, JOB3 4,000, JOB4 14,000 words, turns 1, 2, 3, 1, 4, 2. Small JOB3 displaces only 4,000 words of JOB2, and when JOB2 returns only its 14,000 missing words are read. Total: 128,000 words moved versus 148,000 for whole-program swapping.</p>
    <p><b>New problems:</b> protection among users, file system protection (authorized access only), and contention for resources such as printers and storage.</p>
  `,
});
