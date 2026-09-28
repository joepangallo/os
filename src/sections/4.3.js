/* =====================================================================
   Section 4.3 — Multicore and Multithreading
   Amdahl's law, real-world overheads, the four kinds of multicore-friendly
   software, and how a game engine was re-threaded for many cores.
   ===================================================================== */
Guide.section({
  id: '4.3',
  title: 'Multicore and Multithreading',
  short: 'Multicore & threads',
  summary: "How much faster software runs on many cores: Amdahl's law, overheads, app types, game-engine threading.",
  objectives: [
    "Calculate the speedup of a program on N cores with Amdahl's law, and explain why the serial fraction puts a ceiling on it.",
    'Explain why real software can stop improving, or even slow down, as cores are added (communication, work distribution, cache coherence).',
    'Classify software into the four kinds that benefit from multicore: multithreaded native, multiprocess, Java and multi-instance applications.',
    'Compare coarse-grained, fine-grained and hybrid threading, using the way the Valve game engine was rebuilt for multicore.',
  ],
  terms: [
    ['Multicore processor', 'A single chip that holds two or more independent processing units (cores). Each core can run its own thread at the same moment as the others.'],
    ['Speedup', 'How many times faster a job finishes on N processors than on one: the time on one processor divided by the time on N processors.'],
    ["Amdahl's law", 'A formula for the best speedup N processors can give when only part of a program can run in parallel: speedup = 1 / ((1 − f) + f / N).'],
    ['Parallel fraction (f)', "The share of a program's one-processor running time that can be split perfectly across any number of processors. Amdahl's law assumes this part costs nothing extra to split."],
    ['Serial fraction', 'The share of the running time, 1 − f, that must run one step after another on a single processor. Adding cores does not shorten it at all.'],
    ['Parallel efficiency', 'Speedup divided by the number of processors: the average share of each core\'s time spent on useful work. 100% would mean no core ever waits or wastes effort.'],
    ['Diminishing returns', 'The pattern in which each extra core adds less speedup than the one before, because the serial part never shrinks.'],
    ['Scalability', 'How well a program keeps getting faster as processors are added. Software that scales well gains close to N times on N cores.'],
    ['Parallel overhead', 'Extra work that exists only because a job was split up: threads communicating, work being divided and handed out, threads waiting for each other, and caches being kept coherent.'],
    ['Multithreaded native application', 'Software made of a small number of processes, each running many threads, compiled to the machine\'s own instructions (native code). Examples: Lotus Domino, Siebel CRM.'],
    ['Multiprocess application', 'Software built from many separate single-threaded processes that the OS can place on different cores. Examples: Oracle database, SAP, PeopleSoft.'],
    ['Java virtual machine (JVM)', 'The program that runs Java code and manages its memory and threads. It is itself multithreaded: garbage collection (freeing unused memory), just-in-time compilation (turning Java code into machine instructions while it runs) and the application\'s threads can all run on different cores.'],
    ['Multi-instance application', 'Running several copies (instances) of the same program at once, often each in its own virtual machine, so the cores stay busy even if one copy could not use them.'],
    ['Coarse-grained threading', 'Giving each whole module of a program (for example rendering, AI or physics) its own thread, so each module runs on its own core. Each module stays single-threaded inside.'],
    ['Timeline thread', 'In a coarse-grained game engine, the thread that keeps the module threads in step, synchronizing them once per frame so that, for example, rendering uses the positions physics has just computed.'],
    ['Fine-grained threading', 'Splitting many similar or identical pieces of work, such as the iterations of one loop over an array, into small tasks spread across all the cores.'],
    ['Hybrid threading (game engines)', 'A game-engine strategy: use fine-grained threading only for the systems that benefit from it and leave the other systems single-threaded. (Not the same as the combined user-level/kernel-level thread model.)'],
    ['Single-writer, multiple-readers lock', 'A lock with two modes: any number of threads may hold it at once to read, but a thread that wants to write must hold it alone. It suits data that is read far more often than it is changed.'],
    ['Lock-free data structure', 'A shared structure (such as a queue) that threads update with an atomic instruction such as compare_and_swap, which changes a memory word only if it still holds the value the thread expects. If another thread got there first, the update simply retries. No lock is ever taken, so no thread sleeps waiting for another to release one.'],
    ['Scene list', 'In a game renderer, the list of objects visible from one viewpoint (the main camera, a reflection, a shadow) that must be drawn this frame.'],
  ],

  css: `
    .sec-4-3 .num { font-variant-numeric: tabular-nums; }
    .sec-4-3 .step-eyebrow { flex-wrap: wrap; row-gap: 2px; }   /* long section title: let the eyebrow wrap on phones instead of widening the page */
    .sec-4-3 .fl { font-size: 15px; padding: 1px 8px; border-radius: 7px; opacity: .22; border-left: 4px solid transparent; transition: opacity .25s, background .25s; }
    .sec-4-3 .fl.seen { opacity: 1; }
    .sec-4-3 .fl.on { background: var(--cpu-bg); border-left-color: var(--cpu); }
    .sec-4-3 .p43-in { font: inherit; font-family: var(--mono); font-size: 18px; width: 140px; height: 40px; border-radius: 10px; border: 2px solid var(--line-2); padding: 0 10px; background: var(--panel); color: var(--ink); }
    .sec-4-3 .p43-in:focus { outline: none; border-color: var(--chc); }
    .sec-4-3 .pp { width: 28px; height: 28px; border-radius: 8px; border: 2px solid var(--line-2); background: var(--panel); font-size: 13px; font-weight: 800; color: var(--ink-2); cursor: pointer; }
    .sec-4-3 .pp.on { border-color: var(--chc); color: var(--chc); }
    .sec-4-3 .pp.ok { background: var(--ok-bg); border-color: var(--ok); color: var(--ok); }
    .sec-4-3 .pp.warn { background: var(--warn-bg); border-color: var(--warn); color: var(--warn); }
    .sec-4-3 .pp.bad { background: var(--bad-bg); border-color: var(--bad); color: var(--bad); }
    .sec-4-3 .pp.on.ok, .sec-4-3 .pp.on.warn, .sec-4-3 .pp.on.bad { box-shadow: 0 0 0 2px var(--chc); }
    .sec-4-3 .sortcard { text-align: left; font: inherit; font-size: 14.5px; line-height: 1.35; padding: 10px 12px; border-radius: 10px; border: 2px solid var(--line); background: var(--panel); color: var(--ink); cursor: grab; }
    .sec-4-3 .sortcard:hover { border-color: var(--chc); }
    .sec-4-3 .sortcard.sel { border-color: var(--chc); background: color-mix(in srgb, var(--chc) 10%, var(--panel)); box-shadow: 0 0 0 2px color-mix(in srgb, var(--chc) 35%, transparent); }
    .sec-4-3 .bk { cursor: pointer; min-height: 136px; border-width: 2px; border-style: dashed; }
    .sec-4-3 .bk:hover { border-color: var(--chc); }
  `,

  steps: [
    /* ---------------- 1. Big picture: more cores, but not proportionally faster ---------------- */
    {
      title: 'Eight cores, eight times faster? Not quite',
      kind: 'story',
      render(el, ctx) {
        const { h, s } = ctx;
        const left = h('div', { class: 'stack', html: `
          <p class="lead m0">A chip with eight cores can run eight threads at the same instant. Does your program therefore finish eight times sooner? Almost never. This section explains exactly why.</p>
          <p class="m0">Sections 4.1 and 4.2 split a program into threads, and kernel-level threads can use several cores at once. Now we measure the payoff: the <span class="t">speedup</span> a real program gets from a <span class="t">multicore processor</span>.</p>
          <div class="callout analogy m0" data-label="Analogy">Ten friends help you cook lasagna for a party. Chopping gets ten times faster because everyone chops at once. But the dish still bakes for 40 minutes in your one oven, however many friends you have. The oven time is the <b>serial</b> part of the job.</div>
          <div><h4>In this section you will</h4>
          <ul class="small m0">
            <li>calculate speedup with Amdahl's law and find its ceiling,</li>
            <li>see why real software can get <i>slower</i> with too many cores,</li>
            <li>sort real applications into four multicore-friendly kinds,</li>
            <li>re-thread a game engine the way Valve did.</li>
          </ul></div>` });

        // ---- right: a 100-second job, 10 s serial + 90 s parallel, on N cores
        const NW = ctx.narrow, FS = NW ? 1.1 : 1;   // phones: narrower drawing, slightly larger text
        const SER = 10, PAR = 90, X0 = NW ? 60 : 70, X1 = NW ? 364 : 566, PX = (X1 - X0) / 100;
        const svg = s('svg', { viewBox: NW ? '0 0 380 290' : '0 0 600 290', width: '100%', role: 'img', 'aria-label': 'Timeline of the job on the chosen number of cores' });
        const finish = h('div', { class: 'big num' });
        const speed = h('div', { class: 'big num', style: { color: 'var(--cpu)' } });
        const say = h('p', { class: 'small m0' });
        function draw(n) {
          const inf = n === Infinity;
          const lanes = inf ? 16 : n;
          const top = 18, areaH = 226, gap = lanes > 8 ? 2 : 6;
          const lh = Math.min(40, (areaH - gap * (lanes - 1)) / lanes);
          const parT = inf ? 0.6 : PAR / n;          // with "infinite" cores draw a tiny sliver
          const done = SER + (inf ? 0 : PAR / n);
          const kids = [];
          for (let i = 0; i < lanes; i++) {
            const y = top + i * (lh + gap);
            kids.push(s('rect', { x: X0, y, width: X1 - X0, height: lh, rx: 4, class: 's-panel', 'stroke-width': 1 }));
            const lab = inf ? (i === 0 ? 'core 1' : i === lanes - 1 ? (NW ? 'core ∞' : '… core ∞') : '') : (lanes <= 8 || i % 3 === 0 || i === lanes - 1) ? 'core ' + (i + 1) : '';
            if (lab) kids.push(s('text', { x: X0 - 8, y: y + lh / 2 + 5, 'text-anchor': 'end', 'font-size': (lanes > 8 ? 12 : 14) * FS, class: 's-sub' }, lab));
            if (i === 0) kids.push(s('rect', { x: X0, y, width: SER * PX, height: lh, rx: 4, class: 's-warn', 'stroke-width': 2 }));
            kids.push(s('rect', { x: X0 + SER * PX, y, width: Math.max(2, parT * PX), height: lh, rx: 4, class: 's-cpu', 'stroke-width': lanes > 8 ? 1 : 2 }));
          }
          if (lanes <= 4) {
            if (SER * PX > 44) kids.push(s('text', { x: X0 + SER * PX / 2, y: top + lh / 2 + 5, 'text-anchor': 'middle', 'font-size': 13 * FS, 'font-weight': 700 }, 'serial'));
            if (parT * PX > 70) kids.push(s('text', { x: X0 + (SER + parT / 2) * PX, y: top + lh / 2 + 5, 'text-anchor': 'middle', 'font-size': 13 * FS, 'font-weight': 700 }, (n === 1 ? '90 s parallel' : ctx.util.fmt(parT, 2) + ' s each')));
          }
          // finish marker + axis
          const fx = X0 + done * PX, axisY = top + areaH + 14;
          kids.push(s('line', { x1: fx, y1: top - 6, x2: fx, y2: axisY, class: 's-line', 'stroke-dasharray': '5 4', style: { stroke: 'var(--ok)' } }));
          kids.push(s('text', { x: Math.min(fx + 6, X1 - 60), y: top + 2, 'font-size': 13 * FS, 'font-weight': 800, style: { fill: 'var(--ok)' } }, 'done'));
          kids.push(s('line', { x1: X0, y1: axisY, x2: X1, y2: axisY, class: 's-line' }));
          for (let t = 0; t <= 100; t += 20) {
            kids.push(s('line', { x1: X0 + t * PX, y1: axisY, x2: X0 + t * PX, y2: axisY + 5, class: 's-line' }));
            kids.push(s('text', { x: X0 + t * PX, y: axisY + 20, 'text-anchor': NW && t === 100 ? 'end' : 'middle', 'font-size': 13 * FS, class: 's-sub' }, t + ' s'));
          }
          svg.replaceChildren(...kids);
          finish.textContent = ctx.util.fmt(done, 2) + ' s';
          speed.textContent = ctx.util.fmt(100 / done, 2) + '×';
          say.innerHTML = inf
            ? 'With unlimited cores the 90 s of parallel work shrinks to almost nothing, but the 10 s serial part is untouched. The job can never beat 10 s, so the speedup can never beat <b>10×</b>.'
            : n === 1
              ? 'One core does everything: 10 s of serial work, then 90 s of parallel-friendly work. Pick more cores above.'
              : `The 90 s of parallel work splits into ${n} pieces of ${ctx.util.fmt(PAR / n, 2)} s, yet the 10 s serial part still runs alone. 100 ÷ ${ctx.util.fmt(done, 2)} = <b>${ctx.util.fmt(100 / done, 2)}×</b>, not ${n}×.`;
        }
        const seg = ctx.ui.seg([1, 2, 4, 8, 16, { value: Infinity, label: '∞' }].map((v) => (typeof v === 'object' ? v : { value: v, label: String(v) })), 4, draw);
        draw(4);
        const right = h('div', { class: 'card white stack', style: { gap: '8px' } },
          h('div', { class: 'row', style: { justifyContent: 'space-between' } },
            h('div', {}, h('h4', { class: 'm0' }, 'Try it: one 100-second job'), h('div', { class: 'small muted' }, h('span', { class: 'chip warn' }, '10 s serial'), ' + ', h('span', { class: 'chip cpu' }, '90 s parallel'))),
            h('div', { class: 'row', style: { gap: '6px' } }, h('span', { class: 'small b' }, 'Cores:'), seg)),
          svg,
          h('div', { style: { display: 'grid', gridTemplateColumns: ctx.narrow ? 'auto auto' : 'auto auto minmax(0, 1fr)', gap: '8px 18px', alignItems: 'center' } },
            h('div', {}, h('div', { class: 'xs muted b' }, 'FINISHES AFTER'), finish),
            h('div', {}, h('div', { class: 'xs muted b' }, 'SPEEDUP'), speed),
            ctx.narrow ? h('div', { style: { gridColumn: '1 / -1' } }, say) : say));
        el.append(h('div', { class: 'split l fill' }, left, right));
      },
    },

    /* ---------------- 2. Amdahl's law derived, frame by frame ---------------- */
    {
      title: "Amdahl's law, built one frame at a time",
      kind: 'learn',
      render(el, ctx) {
        const { h, s } = ctx; const fmt = ctx.util.fmt;
        // phones get a narrow drawing (viewBox close to the rendered width) so labels stay readable
        const NW = ctx.narrow, FS = NW ? 1.1 : 1;
        const F = 0.9, T = 100, X0 = NW ? 74 : 118, X1 = NW ? 370 : 1080, PX = (X1 - X0) / T;
        const svg = s('svg', { viewBox: NW ? '0 0 380 178' : '0 0 1100 178', width: '100%', role: 'img', 'aria-label': 'One-core and N-core timelines of the same job' });
        const lines = [
          'T<sub>1</sub> = (1 − f)·T + f·T = T',
          'T<sub>N</sub> = (1 − f)·T + f·T / N',
          'Speedup = T<sub>1</sub> / T<sub>N</sub> = T / ((1 − f)·T + f·T / N)',
          'Speedup = <b>1 / ((1 − f) + f / N)</b>',
          'As N → ∞: Speedup → <b>1 / (1 − f)</b>',
        ].map((x) => h('div', { class: 'fl mono', html: x }));
        const nums = h('div', { class: 'grid-2', style: { gap: '8px 14px' } });
        const frames = [
          { n: 1, upto: -1, cur: -1, cap: 'Every program has two kinds of work. The <span class="t">parallel fraction</span> f can be shared among any number of cores at no extra cost. The rest, 1 − f, is the <span class="t">serial fraction</span>: it must run one step at a time. Here f = 0.9 and the job takes T = 100 ms on one core.' },
          { n: 1, upto: 0, cur: 0, cap: 'On <b>one core</b> the two parts simply add up: 10 ms serial + 90 ms parallel = 100 ms. In symbols, T<sub>1</sub> = (1 − f)T + fT = T.' },
          { n: 2, upto: 1, cur: 1, cap: 'Give it <b>2 cores</b>. Only the parallel part is divided: 90 ÷ 2 = 45 ms on each core. The serial 10 ms is not divided at all. T<sub>2</sub> = 10 + 45 = 55 ms.' },
          { n: 2, upto: 2, cur: 2, cap: '<span class="t">Speedup</span> compares the two times: how many times faster is N cores than one? T<sub>1</sub> ÷ T<sub>2</sub> = 100 ÷ 55 = <b>1.82×</b>. Twice the cores, but not twice as fast, because the serial 10 ms did not shrink.' },
          { n: 2, upto: 3, cur: 3, cap: 'Divide the top and the bottom of that fraction by T: every T cancels. What is left is <span class="t">Amdahl\'s law</span>, which needs only f and N, not the job length. Check: 1 / (0.1 + 0.9 / 2) = 1 / 0.55 = <b>1.82×</b>.' },
          { n: 4, upto: 3, cur: 3, cap: '<b>4 cores:</b> 10 + 90/4 = 32.5 ms, so the speedup is 1 / (0.1 + 0.225) = <b>3.08×</b>. Twice the cores of the last frame, but not twice the speedup.' },
          { n: 8, upto: 3, cur: 3, cap: '<b>8 cores:</b> 10 + 11.25 = 21.25 ms, a speedup of <b>4.71×</b>. Eight times the hardware, under five times the speed. <span class="t" data-t="Parallel efficiency">Efficiency</span> = speedup ÷ N = 4.71 ÷ 8 = 59%: on average each core does useful work only 59% of the time.' },
          { n: 64, upto: 3, cur: 3, cap: '<b>64 cores:</b> 10 + 1.41 = 11.41 ms, only <b>8.77×</b>. The parallel part is now a sliver; almost all the time is the serial 10 ms. Each extra core buys less than the one before: <span class="t">diminishing returns</span>.' },
          { n: Infinity, upto: 4, cur: 4, cap: 'Let N grow without limit. f/N shrinks toward 0, so the time never drops below the serial 10 ms. The speedup can never pass 1 / (1 − f) = 1 / 0.1 = <b>10×</b>, not even with a million cores.' },
          { n: Infinity, upto: 4, cur: -1, cap: 'Two lessons. <b>1.</b> When f is small, extra cores barely help. <b>2.</b> Even when f is large, returns diminish and the speedup flattens at 1 / (1 − f). The way to go faster is to <b>shrink the serial part</b>.' },
        ];
        function draw(fr) {
          const inf = fr.n === Infinity, k = [];
          const tN = (1 - F) * T + (inf ? 0 : F * T / fr.n);
          // row 1: one core
          k.push(s('text', { x: X0 - 10, y: 30, 'text-anchor': 'end', 'font-weight': 700, 'font-size': 15 * FS }, '1 core'));
          k.push(s('rect', { x: X0, y: 8, width: (1 - F) * T * PX, height: 34, rx: 5, class: 's-warn', 'stroke-width': 2 }));
          k.push(s('rect', { x: X0 + (1 - F) * T * PX, y: 8, width: F * T * PX, height: 34, rx: 5, class: 's-cpu', 'stroke-width': 2 }));
          k.push(s('text', { x: X0 + 5 * PX, y: 30, 'text-anchor': 'middle', 'font-size': 13 * FS, 'font-weight': 700 }, NW ? '10' : '10 ms'));
          k.push(s('text', { x: X0 + 55 * PX, y: 30, 'text-anchor': 'middle', 'font-size': 13 * FS, 'font-weight': 700 }, 'parallel part: 90 ms'));
          // row 2: N cores
          if (fr.n > 1) {
            const lanes = inf ? 8 : Math.min(fr.n, 8), top = 54, area = 90, gap = 3;
            const lh = (area - gap * (lanes - 1)) / lanes;
            const pw = inf ? 2 : Math.max(2, F * T / fr.n * PX);
            k.push(s('text', { x: X0 - 10, y: top + area / 2 - 2, 'text-anchor': 'end', 'font-weight': 700, 'font-size': (NW ? 13.5 : 15) * FS }, inf ? '∞ cores' : fr.n + ' cores'));
            if (lanes < fr.n) k.push(s('text', { x: X0 - 10, y: top + area / 2 + 16, 'text-anchor': 'end', 'font-size': 12 * FS, class: 's-sub' }, NW ? '(8 shown)' : '(8 lanes shown)'));
            for (let i = 0; i < lanes; i++) {
              const y = top + i * (lh + gap);
              k.push(s('rect', { x: X0, y, width: X1 - X0, height: lh, rx: 3, class: 's-panel', 'stroke-width': 1 }));
              if (i === 0) k.push(s('rect', { x: X0, y, width: (1 - F) * T * PX, height: lh, rx: 3, class: 's-warn', 'stroke-width': 2 }));
              k.push(s('rect', { x: X0 + (1 - F) * T * PX, y, width: pw, height: lh, rx: 3, class: 's-cpu', 'stroke-width': 1.5 }));
            }
            const fx = X0 + tN * PX;
            k.push(s('line', { x1: fx, y1: top - 6, x2: fx, y2: top + area + 4, class: 's-line', 'stroke-dasharray': '5 4', style: { stroke: 'var(--ok)' } }));
            k.push(s('text', { x: fx + 8, y: top + 18, 'font-size': 15 * FS, 'font-weight': 800, style: { fill: 'var(--ok)' } }, 'T' + (inf ? '∞' : '') + ' = ' + fmt(tN, 2) + ' ms'));
          } else {
            k.push(s('text', { x: X0, y: 104, 'font-size': 15 * FS, class: 's-sub' }, NW ? 'Only one core so far.' : 'Only one core so far. The next frames add more.'));
          }
          k.push(s('line', { x1: X0, y1: 152, x2: X1, y2: 152, class: 's-line' }));
          for (let t = 0; t <= 100; t += NW ? 20 : 10) k.push(s('text', { x: X0 + t * PX, y: 171, 'text-anchor': NW && t === 100 ? 'end' : 'middle', 'font-size': 13 * FS, class: 's-sub' }, t + (t === 100 ? ' ms' : '')));
          svg.replaceChildren(...k);
          lines.forEach((l, i) => { l.classList.toggle('seen', i <= fr.upto); l.classList.toggle('on', i === fr.cur); });
          const sp = T / tN;
          const cell = (lab, val, cls) => h('div', {}, h('div', { class: 'xs muted b' }, lab), h('div', { class: 'num b', style: { fontSize: '26px', color: cls ? `var(--${cls})` : null } }, val));
          nums.replaceChildren(cell('CORES (N)', inf ? '∞' : String(fr.n)), cell('TIME ON N CORES', fmt(tN, 2) + ' ms'), cell('SPEEDUP', fmt(sp, 2) + '×', 'cpu'), cell('EFFICIENCY', inf ? '→ 0%' : Math.round(sp / fr.n * 100) + '%'));
          return fr.cap;
        }
        const player = ctx.ui.player({ count: frames.length, render: (i) => draw(frames[i]), interval: 3600 });
        el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },
          h('div', { class: 'card white tight' }, svg),
          h('div', { class: 'split r', style: { height: 'auto', gap: '14px' } },
            h('div', { class: 'card tight stack', style: { gap: '3px' } }, h('h4', { class: 'm0' }, 'The formula, line by line'), ...lines),
            h('div', { class: 'card tight' }, nums)),
          player.el));
      },
    },

    /* ---------------- 3. Amdahl lab: sliders, bars and the speedup curve ---------------- */
    {
      title: "Amdahl lab: drag f and N, watch the ceiling",
      kind: 'lab',
      core: true,
      render(el, ctx) {
        const { h, s } = ctx; const fmt = ctx.util.fmt;
        const amdahl = (f, n) => 1 / ((1 - f) + f / n);
        let f = 0.9, N = 8;
        // ---------- chart (right)
        const NW = ctx.narrow, FS = NW ? 1.1 : 1;   // phones: narrower chart geometry so the labels stay legible
        const W = NW ? 380 : 660, H = NW ? 340 : 492, L = NW ? 52 : 58, R = NW ? 366 : 640, TOP = 12, B = NW ? 286 : 440;
        const chart = s('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img', 'aria-label': 'Speedup versus number of cores for several parallel fractions' });
        const clipId = 'c43-' + Math.random().toString(36).slice(2, 7);
        const xs = (n) => L + (Math.log2(n) / 10) * (R - L);
        const niceUp = (v) => { const p = 10 ** Math.floor(Math.log10(v)); for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p; return 10 * p; };
        const niceStep = (v) => { const p = 10 ** Math.floor(Math.log10(v)); for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p; return 10 * p; };
        const REF = [0.5, 0.75, 0.9, 0.95, 0.99];
        function curvePath(ff, ys) {
          let d = '';
          for (let i = 0; i <= 200; i++) { const n = 2 ** (i / 20); d += (i ? 'L' : 'M') + xs(n).toFixed(1) + ' ' + ys(amdahl(ff, n)).toFixed(1); }
          return d;
        }
        function drawChart() {
          const ymax = niceUp(Math.max(3, amdahl(f, 1024) * 1.12));
          const ys = (v) => B - (v / ymax) * (B - TOP);
          const k = [s('defs', {}, s('clipPath', { id: clipId }, s('rect', { x: L, y: TOP, width: R - L, height: B - TOP })))];
          const st = niceStep(ymax / 5);
          for (let v = 0; v <= ymax + 1e-9; v += st) {
            k.push(s('line', { x1: L, y1: ys(v), x2: R, y2: ys(v), class: 's-muted', style: { strokeWidth: 1 } }));
            k.push(s('text', { x: L - 8, y: ys(v) + 5, 'text-anchor': 'end', 'font-size': 13 * FS, class: 's-sub' }, fmt(v, 1)));
          }
          for (let e = 0; e <= 10; e++) {
            k.push(s('line', { x1: xs(2 ** e), y1: TOP, x2: xs(2 ** e), y2: B, class: 's-muted', style: { strokeWidth: 1 } }));
            if (!NW || e % 2 === 0) k.push(s('text', { x: xs(2 ** e), y: B + 18, 'text-anchor': 'middle', 'font-size': 13 * FS, class: 's-sub' }, String(2 ** e)));
          }
          k.push(s('text', { x: (L + R) / 2, y: B + 40, 'text-anchor': 'middle', 'font-size': 14 * FS, 'font-weight': 700 }, 'cores N  (each grid line doubles N)'));
          k.push(s('text', { x: NW ? 12 : 16, y: (TOP + B) / 2, 'text-anchor': 'middle', 'font-size': 14 * FS, 'font-weight': 700, transform: `rotate(-90 ${NW ? 12 : 16} ${(TOP + B) / 2})` }, 'speedup'));
          const g = s('g', { 'clip-path': `url(#${clipId})` });
          let dI = ''; for (let i = 0; i <= 200; i++) { const n = 2 ** (i / 20); dI += (i ? 'L' : 'M') + xs(n).toFixed(1) + ' ' + ys(n).toFixed(1); }
          g.append(s('path', { d: dI, class: 's-line', 'stroke-dasharray': '6 5', style: { stroke: 'var(--ok)' } }));
          const labels = [];
          REF.forEach((rf) => {
            if (Math.abs(rf - f) < 0.005) return;
            g.append(s('path', { d: curvePath(rf, ys), class: 's-muted', 'stroke-width': 2 }));
            const end = amdahl(rf, 1024);
            if (end <= ymax) labels.push({ x: R - 4, y: ys(end) - 6, t: 'f = ' + rf });
            else { const n = rf / (1 / ymax - (1 - rf)); if (n > 0 && n < 1024) labels.push({ x: Math.min(R - 56 * FS, xs(n) + 6), y: TOP + 14, t: 'f = ' + rf, top: true }); }
          });
          if (f < 1) {
            const cap = 1 / (1 - f);
            if (cap <= ymax) {
              g.append(s('line', { x1: L, y1: ys(cap), x2: R, y2: ys(cap), class: 's-line', 'stroke-dasharray': '3 4', style: { stroke: 'var(--warn)' } }));
              k.push(s('text', { x: L + 8, y: ys(cap) - 7, 'font-size': 13 * FS, 'font-weight': 800, style: { fill: 'var(--warn)' } }, 'ceiling 1/(1−f) = ' + fmt(cap, 1) + '×'));
            }
          }
          g.append(s('path', { d: curvePath(f, ys), class: 's-line', 'stroke-width': 4, style: { stroke: 'var(--cpu)' } }));
          k.push(g);
          const shown = [];
          labels.forEach((lb) => { if (shown.some((o) => Math.abs(lb.y - o.y) < 14 * FS && Math.abs(lb.x - o.x) < 56 * FS)) return; shown.push(lb); k.push(s('text', { x: lb.x, y: lb.y, 'text-anchor': lb.top ? 'start' : 'end', 'font-size': 13.5 * FS, class: 's-sub' }, lb.t)); });
          const sp = amdahl(f, N), px = xs(N), py = ys(Math.min(sp, ymax));
          k.push(s('circle', { cx: px, cy: py, r: 7, class: 's-cpu', 'stroke-width': 3 }));
          const right = px > R - (NW ? 130 : 150);
          k.push(s('text', { x: right ? px - 12 : px + 12, y: right ? py - 14 : py + 22, 'text-anchor': right ? 'end' : 'start', 'font-size': 15 * FS, 'font-weight': 800, style: { fill: 'var(--cpu)' } }, `N = ${N}: ${fmt(sp, 2)}×`));
          chart.replaceChildren(...k);
        }
        // ---------- left: controls + readouts + time bars
        const bigS = h('div', { class: 'big num', style: { color: 'var(--cpu)' } });
        const eff = h('div', { class: 'num b', style: { fontSize: '26px' } });
        const ceil = h('div', { class: 'num b', style: { fontSize: '26px', color: 'var(--warn)' } });
        const BW = NW ? 380 : 470;
        const bars = s('svg', { viewBox: `0 0 ${BW} 84`, width: '100%', role: 'img', 'aria-label': 'Time on one core versus time on N cores' });
        const insight = h('div', { class: 'callout why small m0', 'data-label': 'What this tells you' });
        function drawBars() {
          const X = NW ? 84 : 92, WB = BW - X - 10, k = [];
          const row = (y, lab, ser, par) => {
            k.push(s('text', { x: X - 8, y: y + 19, 'text-anchor': 'end', 'font-size': 13.5, 'font-weight': 700 }, lab));
            k.push(s('rect', { x: X, y, width: Math.max(1.5, ser * WB), height: 28, rx: 4, class: 's-warn', 'stroke-width': 1.5 }));
            k.push(s('rect', { x: X + ser * WB, y, width: Math.max(1.5, par * WB), height: 28, rx: 4, class: 's-cpu', 'stroke-width': 1.5 }));
          };
          row(4, '1 core', 1 - f, f);
          if (f * WB > 120) k.push(s('text', { x: X + (1 - f) * WB + f * WB / 2, y: 23, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 700 }, 'parallel ' + fmt(f * 100, 0) + '%'));
          if ((1 - f) * WB > 70) k.push(s('text', { x: X + (1 - f) * WB / 2, y: 23, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 700 }, 'serial ' + fmt((1 - f) * 100, 0) + '%'));
          row(44, N + (N === 1 ? ' core' : ' cores'), 1 - f, f / N);
          const tot = (1 - f) + f / N, lx = X + tot * WB + 6;
          k.push(s('text', { x: Math.min(lx, BW - 4), y: 64, 'text-anchor': lx > BW - 118 ? 'end' : 'start', 'font-size': 13, 'font-weight': 800 }, fmt(tot * 100, 1) + '% of the time'));
          bars.replaceChildren(...k);
        }
        const sF = ctx.ui.slider({ label: 'Parallel fraction f', min: 0, max: 1, step: 0.01, value: f, format: (v) => v.toFixed(2), onInput: (v) => { f = v; update(); } });
        const toN = (p) => Math.max(1, Math.round(2 ** (p / 10)));
        const sN = ctx.ui.slider({ label: 'Cores N', min: 0, max: 100, step: 1, value: 30, format: (p) => String(toN(p)), onInput: (p) => { N = toN(p); update(); } });
        const setN = (n) => { N = n; sN.input.value = Math.round(10 * Math.log2(n)); update(); };
        const quick = h('div', { class: 'row', style: { gap: '6px' } }, h('span', { class: 'small b' }, 'Jump to N ='),
          ...[2, 4, 8, 16, 64].map((n) => h('button', { class: 'btn sm', type: 'button', onclick: () => setN(n) }, String(n))),
          h('button', { class: 'btn sm primary', type: 'button', onclick: () => setN(1000) }, 'What if N = 1000?'));
        function update() {
          const sp = amdahl(f, N);
          sN.querySelector('output').textContent = String(N);
          bigS.textContent = fmt(sp, 2) + '×';
          const e = (sp / N) * 100; eff.textContent = (e < 10 ? fmt(e, 1) : Math.round(e)) + '%';
          ceil.textContent = f >= 1 ? 'none' : fmt(1 / (1 - f), 1) + '×';
          if (f >= 1) insight.innerHTML = 'With f = 1 there is no serial part, so the speedup equals N: perfect scaling. Real programs always have some serial work (starting up, combining results), so this is the dream case.';
          else if (f <= 0) insight.innerHTML = 'With f = 0 nothing can be shared, so extra cores do nothing at all: the speedup stays 1×.';
          else {
            const cap = 1 / (1 - f);
            const pc = (sp / cap) * 100;
            insight.innerHTML = `You reach <b>${pc > 99 ? fmt(pc, 1) : Math.round(pc)}%</b> of the ceiling.` + (N < 1000 ? ` Even 1000 cores would give only ${fmt(amdahl(f, 1000), 2)}×.` : ' No number of extra cores can take you past it.') + ` Halve the serial part (${fmt((1 - f) * 100, 1)}% → ${fmt((1 - f) * 50, 1)}%) and the ceiling doubles to ${fmt(2 * cap, 1)}×.`;
          }
          drawBars(); drawChart();
        }
        const stat = (lab, node) => h('div', {}, h('div', { class: 'xs muted b' }, lab), node);
        const left = h('div', { class: 'stack', style: { gap: '10px' } },
          h('p', { class: 'small m0', html: 'Reminder: <span class="t">Amdahl\'s law</span> predicts speedup = 1 / ((1 − f) + f / N) on N cores, where f is the share of the one-core running time that can run in parallel. Move the sliders; the chart shows the whole curve for your f (thick blue) next to other values of f (grey).' }),
          sF, sN, quick,
          h('div', { class: 'row', style: { gap: '26px', alignItems: 'flex-end' } }, stat('SPEEDUP', bigS), stat('EFFICIENCY', eff), stat('CEILING (N → ∞)', ceil)),
          h('div', { class: 'card white tight' }, bars),
          insight);
        update();
        const key = (sw, lab) => h('span', { class: 'row', style: { gap: '6px' } }, h('span', { style: Object.assign({ display: 'inline-block', width: '26px', height: 0 }, sw) }), h('span', { class: 'xs b' }, lab));
        const legend = h('div', { class: 'row', style: { gap: '16px', justifyContent: 'center' } },
          key({ borderTop: '4px solid var(--cpu)' }, 'your f'), key({ borderTop: '2px solid var(--line-2)' }, 'other values of f'),
          key({ borderTop: '2px dashed var(--ok)' }, 'ideal: speedup = N'), key({ borderTop: '2px dotted var(--warn)' }, 'ceiling 1/(1 − f)'));
        el.append(h('div', { class: 'split l fill' }, left, h('div', { class: 'card white tight stack', style: { gap: '4px', justifyContent: 'center' } }, chart, legend)));
      },
    },

    /* ---------------- 4. Predict-then-check number puzzles ---------------- */
    {
      title: 'Predict, then check: eight speedup puzzles',
      kind: 'predict',
      render(el, ctx) {
        const { h, s } = ctx; const fmt = ctx.util.fmt;
        const amdahl = (f, n) => 1 / ((1 - f) + f / n);
        const C = [
          { kind: 'speedup', f: 0.9, n: 8, q: 'A photo filter can run 90% of its work in parallel. What speedup do <b>8 cores</b> give?',
            work: ['1 − f = 0.1 and f / N = 0.9 / 8 = 0.1125', 'Speedup = 1 / (0.1 + 0.1125) = 1 / 0.2125', '= <b>4.71×</b>'],
            lesson: 'On 8 cores the serial 10% fills almost half of the remaining running time (0.1 out of 0.2125), so eight cores give under five times the speed.' },
          { kind: 'speedup', f: 0.95, n: 16, q: 'A video encoder spends 95% of its time on frames that any core can encode. What speedup will <b>16 cores</b> give?',
            work: ['1 − f = 0.05 and f / N = 0.95 / 16 = 0.059375', 'Speedup = 1 / (0.05 + 0.059375) = 1 / 0.109375', '= <b>9.14×</b>'],
            lesson: 'Sixteen cores, yet only about 9 times faster: the 5% serial part now costs almost as much time as the whole parallel part.' },
          { kind: 'speedup', f: 0.5, n: 1000, q: 'Half of a report generator is serial. What speedup do <b>1000 cores</b> give?',
            work: ['1 − f = 0.5 and f / N = 0.5 / 1000 = 0.0005', 'Speedup = 1 / 0.5005', '= <b>2.00×</b> (1.998)'],
            lesson: 'A thousand cores cannot even double the speed of a half-serial program; its ceiling is 1 / 0.5 = 2×.' },
          { kind: 'speedup', f: 0.99, n: 100, q: 'A weather simulation is 99% parallel. What speedup do <b>100 cores</b> give?',
            work: ['1 − f = 0.01 and f / N = 0.99 / 100 = 0.0099', 'Speedup = 1 / (0.01 + 0.0099) = 1 / 0.0199', '= <b>50.25×</b>'],
            lesson: 'Even at 99% parallel, 100 cores deliver only half of the ideal 100×. At large N, a 1% serial part is a big deal.' },
          { kind: 'speedup', f: 0.75, n: 4, q: 'A build tool compiles files in parallel, but 25% of its time is serial linking. What speedup do <b>4 cores</b> give?',
            work: ['1 − f = 0.25 and f / N = 0.75 / 4 = 0.1875', 'Speedup = 1 / (0.25 + 0.1875) = 1 / 0.4375', '= <b>2.29×</b>'],
            lesson: 'Efficiency is 2.29 / 4 = 57%, so over 40% of the 4-core chip is wasted by a quarter of serial work.' },
          { kind: 'time', unit: 's', ans: 30 + 170 / 8, q: 'A job takes <b>200 s</b> on one core, and <b>30 s</b> of that is serial. How many seconds does it take on <b>8 cores</b>?',
            work: ['Serial part: 30 s (it cannot shrink)', 'Parallel part: 200 − 30 = 170 s, split 8 ways = 21.25 s', 'Total = 30 + 21.25 = <b>51.25 s</b> (speedup 200 / 51.25 = 3.90×)'],
            lesson: 'The law works in seconds too: keep the serial time as it is and divide only the parallel time by N.' },
          { kind: 'ceiling', f: 0.8, q: 'A program is 80% parallel. With an <b>unlimited</b> number of cores, what is the best speedup it can ever reach?',
            work: ['With unlimited cores, f / N shrinks to 0', 'Speedup → 1 / (1 − f) = 1 / 0.2', '= <b>5×</b>'],
            lesson: 'The ceiling depends only on the serial fraction: 20% serial means never more than 5×, whatever the hardware.' },
          { kind: 'reverse', ans: 0.875 / 0.9375, q: 'Your manager wants an <b>8×</b> speedup on <b>16 cores</b>. What is the smallest parallel fraction f that can deliver it? (Answer as a decimal, such as 0.8.)',
            work: ['Need 1 / ((1 − f) + f / 16) = 8, so (1 − f) + f / 16 = 1 / 8 = 0.125', 'Rearrange: 1 − f × (15/16) = 0.125, so f × 0.9375 = 0.875', 'f = 0.875 / 0.9375 = <b>0.933</b> (93.3% parallel)'],
            lesson: 'Just half the ideal speedup on 16 cores already demands that over 93% of the work be parallel. With f = 0.90 you would get only 1 / (0.1 + 0.05625) = 6.4×.' },
        ];
        C.forEach((c) => { if (c.kind === 'speedup') { c.ans = amdahl(c.f, c.n); c.unit = '×'; } if (c.kind === 'ceiling') { c.ans = 1 / (1 - c.f); c.unit = '×'; } if (c.kind === 'reverse') c.unit = ''; });
        const state = C.map(() => ({ guess: '', res: null }));
        let cur = 0;
        const pills = h('div', { class: 'row', style: { gap: '5px' } });
        const counter = h('div', { class: 'xs muted b' });
        const qText = h('p', { class: 'lead m0' });
        const chips = h('div', { class: 'row', style: { gap: '6px' } });
        const input = h('input', { type: 'number', step: 'any', class: 'p43-in', 'aria-label': 'Your prediction' });
        const unit = h('span', { class: 'b' });
        const score = h('div', { class: 'small muted' });
        const out = h('div', { class: 'stack', style: { gap: '10px' } });
        const bCheck = h('button', { class: 'btn primary', type: 'button', onclick: () => check() }, 'Check my prediction');
        const bPrev = h('button', { class: 'btn', type: 'button', onclick: () => show(cur - 1) }, '← Previous');
        const bNext = h('button', { class: 'btn', type: 'button', onclick: () => show(cur + 1) }, 'Next →');
        ctx.on(input, 'keydown', (e) => { if (e.key === 'Enter') check(); });
        ctx.on(input, 'input', () => { state[cur].guess = input.value; });
        // a fraction near 1 is graded on absolute distance: 0.90 instead of 0.933 is a big miss (it only gives 6.4×)
        const grade = (c, g) => { if (c.kind === 'reverse') { const d = Math.abs(g - c.ans); return d <= 0.005 ? 'ok' : d <= 0.02 ? 'warn' : 'bad'; } const rel = Math.abs(g - c.ans) / c.ans; return rel <= 0.03 ? 'ok' : rel <= 0.15 ? 'warn' : 'bad'; };
        const NW = ctx.narrow, VW = NW ? 380 : 600;   // phones: narrower drawings so the labels stay legible
        function numberLine(c, g) {
          const svg = s('svg', { viewBox: `0 0 ${VW} 100`, width: '100%', role: 'img', 'aria-label': 'Your guess compared with the answer' });
          const cap = c.kind === 'speedup' ? 1 / (1 - c.f) : null;
          const max = c.kind === 'reverse' ? 1 : Math.max(g, c.ans, cap && cap < c.ans * 2.5 ? cap : 0) * 1.2;
          const X0 = NW ? 18 : 24, X1 = VW - X0, LY = 54, xs = (v) => X0 + Math.min(1, Math.max(0, v / max)) * (X1 - X0);
          const anchor = (x) => (x > VW - (NW ? 70 : 100) ? 'end' : x < (NW ? 70 : 100) ? 'start' : 'middle');
          const k = [s('line', { x1: X0, y1: LY, x2: X1, y2: LY, class: 's-line' })];
          for (let i = 0; i <= 4; i++) { const v = max * i / 4; k.push(s('line', { x1: xs(v), y1: LY - 4, x2: xs(v), y2: LY + 4, class: 's-line' })); k.push(s('text', { x: xs(v), y: 97, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, fmt(v, c.kind === 'reverse' ? 2 : 1))); }
          if (cap && cap <= max) { k.push(s('line', { x1: xs(cap), y1: LY - 12, x2: xs(cap), y2: LY + 8, class: 's-line', 'stroke-dasharray': '3 3', style: { stroke: 'var(--warn)' } })); k.push(s('text', { x: xs(cap), y: 13, 'text-anchor': anchor(xs(cap)), 'font-size': 12.5, 'font-weight': 700, style: { fill: 'var(--warn)' } }, 'ceiling ' + fmt(cap, 1))); }
          k.push(s('circle', { cx: xs(g), cy: LY, r: 7, class: 's-cpu', 'stroke-width': 3 }));
          k.push(s('text', { x: xs(g), y: 34, 'text-anchor': anchor(xs(g)), 'font-size': 13.5, 'font-weight': 800, style: { fill: 'var(--cpu)' } }, '▼ you ' + fmt(g, 3)));
          k.push(s('circle', { cx: xs(c.ans), cy: LY, r: 5, style: { fill: 'var(--ok)', stroke: 'none' } }));
          k.push(s('text', { x: xs(c.ans), y: 78, 'text-anchor': anchor(xs(c.ans)), 'font-size': 13.5, 'font-weight': 800, style: { fill: 'var(--ok)' } }, '▲ answer ' + fmt(c.ans, c.kind === 'reverse' ? 3 : 2)));
          svg.replaceChildren(...k);
          return svg;
        }
        // one-core vs N-core bar picture of the puzzle (the N-core bar is a "?" until checked)
        function picture(c, solved) {
          const svg = s('svg', { viewBox: `0 0 ${VW} 78`, width: '100%', role: 'img', 'aria-label': 'Serial and parallel parts of the job' });
          const X = NW ? 80 : 96, WB = VW - X - (NW ? 8 : 24), k = [];
          const ser = c.kind === 'time' ? 30 / 200 : c.kind === 'reverse' ? (solved ? 1 - c.ans : null) : 1 - c.f;
          const n = c.kind === 'speedup' ? c.n : c.kind === 'time' ? 8 : c.kind === 'reverse' ? 16 : Infinity;
          const row = (y, lab) => k.push(s('text', { x: X - 10, y: y + 19, 'text-anchor': 'end', 'font-size': NW ? 13 : 13.5, 'font-weight': 700 }, lab));
          row(4, '1 core'); row(44, n === Infinity ? '∞ cores' : n + ' cores');
          if (ser == null) {
            k.push(s('rect', { x: X, y: 4, width: WB, height: 28, rx: 4, class: 's-panel', 'stroke-width': 1.5 }));
            k.push(s('text', { x: X + WB / 2, y: 23, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 }, NW ? 'serial ? + parallel ? (find f)' : 'serial ? + parallel ?  (that is what you must find)'));
          } else {
            k.push(s('rect', { x: X, y: 4, width: ser * WB, height: 28, rx: 4, class: 's-warn', 'stroke-width': 1.5 }));
            k.push(s('rect', { x: X + ser * WB, y: 4, width: (1 - ser) * WB, height: 28, rx: 4, class: 's-cpu', 'stroke-width': 1.5 }));
            k.push(s('text', { x: X + ser * WB + (1 - ser) * WB / 2, y: 23, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 700 }, 'parallel ' + fmt((1 - ser) * 100, 1) + '%'));
          }
          if (solved && ser != null) {
            const par = n === Infinity ? 0 : (1 - ser) / n;
            k.push(s('rect', { x: X, y: 44, width: ser * WB, height: 28, rx: 4, class: 's-warn', 'stroke-width': 1.5 }));
            k.push(s('rect', { x: X + ser * WB, y: 44, width: Math.max(2, par * WB), height: 28, rx: 4, class: 's-cpu', 'stroke-width': 1.5 }));
            k.push(s('text', { x: X + (ser + par) * WB + 8, y: 63, 'font-size': 13, 'font-weight': 800 }, fmt((ser + par) * 100, 1) + (NW ? '% of 1-core time' : '% of the one-core time')));
          } else {
            k.push(s('rect', { x: X, y: 44, width: WB, height: 28, rx: 4, class: 's-panel', 'stroke-width': 1.5, 'stroke-dasharray': '5 4' }));
            k.push(s('text', { x: X + WB / 2, y: 63, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800, class: 's-sub' }, '?'));
          }
          svg.replaceChildren(...k);
          return h('div', { class: 'card white tight' }, svg);
        }
        function renderOut() {
          const c = C[cur], st = state[cur];
          if (!st.res) {
            const tip = c.kind === 'time' ? 'Keep the serial seconds, divide only the parallel seconds by N, then add.'
              : c.kind === 'reverse' ? 'Set the formula equal to the target speedup and solve for f. The answer is between 0 and 1. Near 1, small changes in f matter a lot, so only answers within ±0.005 count as spot on here.'
                : c.kind === 'ceiling' ? 'Unlimited cores means f / N becomes 0. What is left in the formula?'
                  : `Sanity check before you type: the answer must be below N = ${c.n} and below the ceiling 1 / (1 − f) = ${fmt(1 / (1 - c.f), 1)}.`;
            out.replaceChildren(
              h('div', { class: 'card', html: '<h4>Your move</h4><p class="m0">Commit to a number first, even a rough one. Guessing before calculating is what trains your intuition. The worked answer will appear here.</p>' }),
              h('div', {}, h('h4', {}, 'Picture it'), picture(c, false)),
              h('div', { class: 'callout tip m0', 'data-label': 'Tip' }, tip));
            return;
          }
          const verdict = { ok: ['Spot on!', 'ok'], warn: ['Close.', 'warn'], bad: ['Not quite.', 'bad'] }[st.res];
          const g = parseFloat(st.guess);
          out.replaceChildren(
            h('div', { class: 'row', style: { gap: '10px', alignItems: 'baseline' } }, h('span', { class: 'b', style: { fontSize: '22px', color: `var(--${verdict[1]})` } }, verdict[0]),
              h('span', { class: 'small muted' }, `You said ${fmt(g, 3)}${c.unit}; the answer is ${fmt(c.ans, c.kind === 'reverse' ? 3 : 2)}${c.unit} (${fmt(Math.abs(g - c.ans) / c.ans * 100, 1)}% away).`)),
            h('div', { class: 'card white tight' }, numberLine(c, g)),
            h('div', { class: 'card tight stack', style: { gap: '3px' } }, h('h4', { class: 'm0' }, 'Worked answer'), ...c.work.map((w, i) => h('div', { class: 'mono small', html: (i + 1) + '. ' + w }))),
            picture(c, true),
            h('div', { class: 'callout why m0 small', 'data-label': 'The lesson' }, c.lesson));
        }
        function check() {
          const c = C[cur], raw = parseFloat(input.value);
          if (!isFinite(raw)) { ctx.toast('Type a number first.'); input.focus(); return; }
          let g = raw;
          if (c.kind === 'reverse' && g > 1 && g <= 100) g = g / 100;   // accept "93.3" meaning 93.3%
          state[cur].guess = String(g);
          state[cur].res = grade(c, g);
          paint();
        }
        function paint() {
          const c = C[cur], st = state[cur];
          counter.textContent = `PUZZLE ${cur + 1} OF ${C.length}`;
          qText.innerHTML = c.q;
          chips.replaceChildren(...(c.kind === 'speedup' ? [h('span', { class: 'chip cpu' }, 'f = ' + c.f), h('span', { class: 'chip' }, 'N = ' + c.n)]
            : c.kind === 'ceiling' ? [h('span', { class: 'chip cpu' }, 'f = ' + c.f), h('span', { class: 'chip' }, 'N → ∞')]
              : c.kind === 'time' ? [h('span', { class: 'chip warn' }, '30 s serial'), h('span', { class: 'chip cpu' }, '170 s parallel'), h('span', { class: 'chip' }, 'N = 8')]
                : [h('span', { class: 'chip ok' }, 'target 8×'), h('span', { class: 'chip' }, 'N = 16')]));
          input.value = st.guess;
          unit.textContent = c.unit === '×' ? '× faster' : c.unit === 's' ? 'seconds' : '(fraction)';
          bPrev.disabled = cur === 0; bNext.disabled = cur === C.length - 1;
          pills.replaceChildren(...C.map((_, i) => h('button', { type: 'button', class: 'pp ' + (state[i].res || '') + (i === cur ? ' on' : ''), onclick: () => show(i), 'aria-label': 'Puzzle ' + (i + 1) }, String(i + 1))));
          const done = state.filter((x) => x.res).length, good = state.filter((x) => x.res === 'ok').length;
          score.textContent = done ? `${good} of ${done} answered spot on (within 3%).` : 'Within 3% counts as spot on; within 15% counts as close.';
          renderOut();
        }
        function show(i) { cur = ctx.util.clamp(i, 0, C.length - 1); paint(); }
        const left = h('div', { class: 'card stack', style: { gap: '12px' } },
          h('div', { class: 'row', style: { justifyContent: 'space-between' } }, counter, pills),
          qText, chips,
          h('div', { class: 'row' }, h('span', { class: 'b' }, 'My prediction:'), input, unit),
          h('div', { class: 'row' }, bCheck, bPrev, bNext),
          score);
        const tool = h('div', { class: 'card cpu' }, h('h4', {}, 'The tool'), h('div', { class: 'mono b', style: { fontSize: '18px' } }, 'Speedup = 1 / ((1 − f) + f / N)'),
          h('p', { class: 'small m0 mt' }, 'Time on N cores, as a share of the one-core time, is (1 − f) + f / N. Speedup is 1 divided by that share.'));
        el.append(h('div', { class: 'split l fill' }, h('div', { class: 'stack' }, left, tool), out));
        paint();
      },
    },

    /* ---------------- 5. Overhead: when more cores make it slower ---------------- */
    {
      title: 'Real software: when more cores make it slower',
      kind: 'explore',
      render(el, ctx) {
        const { h, s } = ctx; const fmt = ctx.util.fmt;
        let f = 0.9, c = 0.01;
        const ideal = (n) => 1 / ((1 - f) + f / n);
        const real = (n) => 1 / ((1 - f) + f / n + c * (n - 1));
        const NW = ctx.narrow, FS = NW ? 1.1 : 1;   // phones: narrower chart geometry so the labels stay legible
        const W = NW ? 380 : 660, H = NW ? 330 : 434, L = NW ? 50 : 56, R = NW ? 366 : 640, TOP = 10, B = NW ? 282 : 386;
        const chart = s('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img', 'aria-label': 'Ideal and real speedup versus number of cores' });
        const xs = (n) => L + ((n - 1) / 63) * (R - L);
        const niceUp = (v) => { const p = 10 ** Math.floor(Math.log10(v)); for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p; return 10 * p; };
        const peakN = () => { let best = 1; for (let n = 2; n <= 64; n++) if (real(n) > real(best) + 1e-12) best = n; return best; };
        const bigPeak = h('div', { class: 'num b', style: { fontSize: '26px', color: 'var(--ok)' } });
        const big64 = h('div', { class: 'num b', style: { fontSize: '26px', color: 'var(--bad)' } });
        const bigIdeal = h('div', { class: 'num b', style: { fontSize: '26px', color: 'var(--cpu)' } });
        const say = h('div', { class: 'callout warn small m0', 'data-label': 'What you see' });
        function draw() {
          const ymax = niceUp(Math.max(2, ideal(64) * 1.1));
          const ys = (v) => B - (v / ymax) * (B - TOP);
          const pk = peakN(), k = [];
          const tie = pk < 64 && Math.abs(real(pk + 1) - real(pk)) < 1e-9;   // e.g. f = 0.9, 1%: 9 and 10 cores give exactly the same speedup
          const pkLab = tie ? `${pk}–${pk + 1}` : String(pk);
          if (pk < 64) {
            k.push(s('rect', { x: xs(pk), y: TOP, width: R - xs(pk), height: B - TOP, style: { fill: 'var(--bad-bg)', stroke: 'none' } }));
            k.push(s('text', { x: R - 8, y: B - 12, 'text-anchor': 'end', 'font-size': 13.5 * FS, 'font-weight': 800, style: { fill: 'var(--bad)' } }, NW ? 'past the peak: slower' : 'past the peak: extra cores no longer pay off'));
          }
          const step = ymax / 5;
          for (let i = 0; i <= 5; i++) { const v = step * i; k.push(s('line', { x1: L, y1: ys(v), x2: R, y2: ys(v), class: 's-muted', style: { strokeWidth: 1 } })); k.push(s('text', { x: L - 8, y: ys(v) + 5, 'text-anchor': 'end', 'font-size': 13 * FS, class: 's-sub' }, fmt(v, 1))); }
          (NW ? [1, 16, 32, 48, 64] : [1, 8, 16, 24, 32, 40, 48, 56, 64]).forEach((n) => { k.push(s('line', { x1: xs(n), y1: TOP, x2: xs(n), y2: B, class: 's-muted', style: { strokeWidth: 1 } })); k.push(s('text', { x: xs(n), y: B + 18, 'text-anchor': 'middle', 'font-size': 13 * FS, class: 's-sub' }, String(n))); });
          k.push(s('text', { x: (L + R) / 2, y: B + 42, 'text-anchor': 'middle', 'font-size': 14 * FS, 'font-weight': 700 }, 'cores N'));
          k.push(s('text', { x: NW ? 12 : 16, y: (TOP + B) / 2, 'text-anchor': 'middle', 'font-size': 14 * FS, 'font-weight': 700, transform: `rotate(-90 ${NW ? 12 : 16} ${(TOP + B) / 2})` }, 'speedup'));
          let dI = '', dR = '';
          for (let n = 1; n <= 64; n += 0.5) { dI += (n === 1 ? 'M' : 'L') + xs(n).toFixed(1) + ' ' + ys(ideal(n)).toFixed(1); dR += (n === 1 ? 'M' : 'L') + xs(n).toFixed(1) + ' ' + ys(real(n)).toFixed(1); }
          k.push(s('path', { d: dI, class: 's-line', 'stroke-width': 3, 'stroke-dasharray': '7 5', style: { stroke: 'var(--cpu)' } }));
          k.push(s('path', { d: dR, class: 's-line', 'stroke-width': 4, style: { stroke: 'var(--ink)' } }));
          k.push(s('text', { x: xs(64) - 6, y: ys(ideal(64)) - 10, 'text-anchor': 'end', 'font-size': 13.5 * FS, 'font-weight': 800, style: { fill: 'var(--cpu)' } }, "Amdahl's law (no overhead)"));
          const px = xs(pk), py = ys(real(pk));
          k.push(s('circle', { cx: px, cy: py, r: 8, class: 's-ok', 'stroke-width': 3 }));
          if (pk < 64) {
            k.push(s('text', { x: px + (pk > 44 ? -12 : 12), y: py - 12, 'text-anchor': pk > 44 ? 'end' : 'start', 'font-size': 15 * FS, 'font-weight': 800, style: { fill: 'var(--ok)' } }, `peak: ${pkLab} cores, ${fmt(real(pk), 2)}×`));
            const endY = ys(real(64));
            k.push(s('text', { x: xs(64) - 6, y: Math.min(B - 30 * FS, endY + (endY > ys(ideal(64)) + 30 ? -10 : 22)), 'text-anchor': 'end', 'font-size': 13.5 * FS, 'font-weight': 800 }, 'with overhead'));
          } else {
            k.push(s('text', { x: px - 12, y: py + 26, 'text-anchor': 'end', 'font-size': 14 * FS, 'font-weight': 800, style: { fill: 'var(--ok)' } }, NW ? `still climbing: ${fmt(real(64), 2)}×` : `with overhead: still climbing, ${fmt(real(64), 2)}× at 64`));
          }
          chart.replaceChildren(...k);
          bigPeak.textContent = `${fmt(real(pk), 2)}× @ ${pkLab}`;
          big64.textContent = fmt(real(64), 2) + '×';
          big64.style.color = pk >= 64 ? 'var(--ok)' : 'var(--bad)';
          bigIdeal.textContent = fmt(ideal(64), 2) + '×';
          if (c === 0) say.innerHTML = 'With zero overhead the two curves are the same: this is pure Amdahl, the best case. Now push the overhead slider up a little.';
          else if (pk >= 64) say.innerHTML = `Overhead is tiny compared with the parallel work, so the program keeps gaining all the way to 64 cores (${fmt(real(64), 1)}×). It <span class="t" data-t="Scalability">scales</span> well.`;
          else say.innerHTML = `Up to <b>${pk} cores</b>, each new core saves more time than it costs${tie ? ` (core ${pk + 1} exactly breaks even)` : ''}. Beyond that, coordinating costs more than the core adds: at 64 cores it runs at only ${fmt(real(64), 2)}×${real(64) < 1 ? ', slower than a single core' : ''}. Amdahl's law alone never predicts a drop; only overhead can.`;
        }
        const sF = ctx.ui.slider({ label: 'Parallel fraction f', min: 0.5, max: 1, step: 0.001, value: f, format: (v) => v.toFixed(3), onInput: (v) => { f = v; seg.set(null); draw(); } });
        const sC = ctx.ui.slider({ label: 'Overhead per extra core', min: 0, max: 2, step: 0.01, value: c * 100, format: (v) => v.toFixed(2) + '%', onInput: (v) => { c = v / 100; seg.set(null); draw(); } });
        const PRE = { typical: [0.9, 0.01], chatty: [0.95, 0.02], dbms: [0.999, 0.0001] };
        const seg = ctx.ui.seg([{ value: 'typical', label: 'Typical app' }, { value: 'chatty', label: 'Shares a lot of data' }, { value: 'dbms', label: 'Scales well (e.g. a DBMS)' }], 'typical', (v) => { [f, c] = PRE[v]; sF.set(f); sC.set(c * 100); draw(); });
        const stat = (lab, node) => h('div', {}, h('div', { class: 'xs muted b' }, lab), node);
        const left = h('div', { class: 'stack', style: { gap: '10px' } },
          h('p', { class: 'm0 small', html: 'Amdahl\'s law assumes that splitting work is free. Real programs pay a <span class="t">parallel overhead</span> that grows with every core added:' }),
          h('div', { class: 'stack small', style: { gap: '5px' }, html:
            '<div><span class="chip intr">communication</span> threads swap results and wait for each other</div>' +
            '<div><span class="chip intr">distributing work</span> cutting the job up and handing out the pieces</div>' +
            '<div><span class="chip intr">cache coherence</span> keeping cached copies of shared data consistent</div>' }),
          sF, sC,
          h('div', { class: 'row', style: { gap: '22px' } }, stat('BEST (CORES)', bigPeak), stat('AT 64 CORES', big64), stat('AMDAHL AT 64', bigIdeal)),
          say,
          h('div', { class: 'callout why small m0', 'data-label': 'Why it matters', html: 'Not everything hits the wall. Database management systems and Java server applications can scale well: they serve many independent requests at once, so almost all of the work is parallel (f close to 1) and each extra core simply takes on more requests.' }));
        draw();
        el.append(h('div', { class: 'split l fill' }, left, h('div', { class: 'card white tight stack', style: { gap: '6px' } },
          h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'small b' }, 'Try a kind of program:'), seg),
          chart,
          h('div', { class: 'xs muted center', html: 'Toy model used here (time as a share of the one-core time): <span class="mono">(1 − f) + f / N + overhead × (N − 1)</span>' }))));
      },
    },

    /* ---------------- 6. Four kinds of software that gain from multicore + sorting game ---------------- */
    {
      title: 'Four kinds of software that put many cores to work',
      kind: 'lab',
      types: [
        { name: 'Multithreaded native', term: 'Multithreaded native application', shape: 'A few processes, each running many threads.',
          desc: 'The OS spreads the threads of one process across all the cores. The code is compiled to run directly on the hardware.', ex: ['Lotus Domino', 'Siebel CRM'] },
        { name: 'Multiprocess', term: 'Multiprocess application', shape: 'Many processes, one thread each.',
          desc: 'The OS simply runs different single-threaded processes on different cores at the same time.', ex: ['Oracle database', 'SAP', 'PeopleSoft'] },
        { name: 'Java', term: 'Java virtual machine (JVM)', shape: 'Java code plus a multithreaded runtime.',
          desc: 'Java makes threads easy, and the JVM itself runs many threads (garbage collection, compiling). Java EE application servers serve many requests at once.', ex: ['Java EE servers', 'the JVM'] },
        { name: 'Multi-instance', term: 'Multi-instance application', shape: 'Several copies of the same program.',
          desc: 'Even a program that cannot use many cores itself gains: run several instances at once, often each in its own virtual machine for isolation.', ex: ['copies in parallel VMs'] },
      ],
      items: [
        { name: 'Lotus Domino', text: 'one server process running hundreds of threads', b: 0, hint: 'A single process with a great many threads is the signature of a multithreaded native application.' },
        { name: 'Siebel CRM', text: 'a handful of heavily threaded server processes', b: 0, hint: 'Few processes, each with many threads: multithreaded native.' },
        { name: 'Oracle database', text: 'many cooperating background processes, one thread each', b: 1, hint: 'Many separate single-threaded processes: a multiprocess application.' },
        { name: 'SAP', text: 'a pool of single-threaded work processes', b: 1, hint: 'Each work process has just one thread; the parallelism comes from having many processes.' },
        { name: 'PeopleSoft', text: 'many single-threaded server processes', b: 1, hint: 'Lots of one-thread processes: multiprocess.' },
        { name: 'Java EE server', text: 'an application server handling hundreds of web requests', b: 2, hint: 'Java application servers rely on the multithreaded Java platform to serve many requests at once.' },
        { name: 'The JVM', text: 'runs garbage collection and code compiling next to your program', b: 2, hint: 'The Java virtual machine is itself multithreaded, so even a simple Java program keeps several cores busy.' },
        { name: 'Video converter ×4', text: 'four copies of a single-threaded converter, each in its own VM', b: 3, hint: 'One copy uses one core; four copies in parallel virtual machines use four. That is multi-instance.' },
        { name: 'Web-shop hosting', text: '12 virtual machines, each running a copy of the same shop', b: 3, hint: 'Many instances of the same application side by side: multi-instance.' },
      ],
      render(el, ctx) {
        const { h, s } = ctx; const TY = this.types; const IT = this.items;
        const wave = (x, y, n) => { let d = `M${x} ${y}`; for (let i = 0; i < n; i++) d += ' q 5 4 0 8 q -5 4 0 8'; return s('path', { d, style: { fill: 'none', stroke: 'var(--thread)', strokeWidth: 2.5 } }); };
        function diagram(i) {
          const svg = s('svg', { viewBox: '0 6 250 104', width: '100%', role: 'img', 'aria-label': TY[i].shape });
          const k = [];
          if (i === 0) {
            k.push(s('rect', { x: 8, y: 6, width: 234, height: 104, rx: 10, class: 's-proc', 'stroke-width': 2 }), s('text', { x: 18, y: 24, 'font-size': 13, 'font-weight': 700 }, 'process'));
            for (let t = 0; t < 11; t++) k.push(wave(30 + t * 19, 34, 4));
          } else if (i === 1) {
            for (let p = 0; p < 6; p++) { k.push(s('rect', { x: 8 + p * 40, y: 22, width: 32, height: 84, rx: 7, class: 's-proc', 'stroke-width': 2 })); k.push(wave(24 + p * 40, 36, 4)); }
            k.push(s('text', { x: 8, y: 15, 'font-size': 13, 'font-weight': 700 }, '6 processes'));
          } else if (i === 2) {
            k.push(s('rect', { x: 8, y: 6, width: 234, height: 104, rx: 10, class: 's-os', 'stroke-width': 2 }), s('text', { x: 18, y: 24, 'font-size': 13, 'font-weight': 700 }, 'JVM'));
            for (let t = 0; t < 5; t++) k.push(wave(30 + t * 22, 36, 4));
            [['GC', 160], ['JIT', 205]].forEach(([lab, x]) => { k.push(wave(x, 36, 3)); k.push(s('text', { x, y: 102, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 700 }, lab)); });
            k.push(s('text', { x: 72, y: 102, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 700 }, 'app threads'));
          } else {
            for (let v = 0; v < 3; v++) {
              const x = 8 + v * 80;
              k.push(s('rect', { x, y: 6, width: 74, height: 104, rx: 9, class: 's-panel', 'stroke-width': 2, 'stroke-dasharray': '5 3' }), s('text', { x: x + 37, y: 22, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 700 }, 'VM ' + (v + 1)));
              k.push(s('rect', { x: x + 16, y: 32, width: 42, height: 70, rx: 7, class: 's-proc', 'stroke-width': 2 }), wave(x + 37, 42, 3));
            }
          }
          svg.replaceChildren(...k);
          return svg;
        }
        const learn = (p) => {
          p.append(h('div', { class: 'stack', style: { gap: '12px' } },
            h('div', { class: 'grid-4' }, ...TY.map((t, i) => h('div', { class: 'card stack', style: { gap: '6px' } },
              h('div', { class: 'b', style: { fontSize: '17px' } }, h('span', { class: 't', 'data-t': t.term }, t.name)),
              h('div', { class: 'card white tight' }, diagram(i)),
              h('div', { class: 'small b' }, t.shape),
              h('div', { class: 'small' }, t.desc),
              h('div', { class: 'row', style: { gap: '4px' } }, ...t.ex.map((e) => h('span', { class: 'chip proc' }, e)))))),
            h('div', { class: 'callout why small m0', 'data-label': 'The common thread', html: 'In all four cases the OS ends up with many runnable threads to place on different cores. What differs is who made them: the application itself, many processes, the Java runtime, or extra copies of the program (often each in its own virtual machine: a software copy of a whole computer, with its own operating system).' })));
        };
        const game = (p) => {
          let sel = null, placed = new Set(), mistakes = 0;
          const tray = h('div', { class: 'grid-3', style: { gap: '8px' } });
          const buckets = TY.map((t, i) => h('div', { class: 'card tight bk', 'data-b': i, role: 'button', tabindex: 0, onclick: () => drop(i) }, h('div', { class: 'b small' }, t.name), h('div', { class: 'xs muted' }, t.shape), h('div', { class: 'stack bk-items', style: { gap: '4px', marginTop: '6px' } })));
          buckets.forEach((b, i) => { ctx.on(b, 'dragover', (e) => e.preventDefault()); ctx.on(b, 'drop', (e) => { e.preventDefault(); const id = +e.dataTransfer.getData('text/plain'); if (!isNaN(id)) { sel = id; drop(i); } }); ctx.on(b, 'keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); drop(i); } }); });
          const msg = h('div', { class: 'callout tip small m0', 'data-label': 'How to play' }, 'Click a card, then click the kind of software it is (or drag the card onto it).');
          const prog = h('span', { class: 'small b' });
          function paintTray() {
            tray.replaceChildren(...IT.map((it, id) => placed.has(id) ? null : h('button', { type: 'button', class: 'sortcard' + (sel === id ? ' sel' : ''), draggable: 'true', onclick: () => { sel = sel === id ? null : id; paintTray(); },
              ondragstart: (e) => { e.dataTransfer.setData('text/plain', String(id)); } }, h('b', {}, it.name), ' · ' + it.text)).filter(Boolean));
            if (placed.size === IT.length) tray.replaceChildren(h('div', { class: 'card', style: { gridColumn: '1 / -1' }, html: `<b>All sorted${mistakes ? ` with ${mistakes} slip${mistakes > 1 ? 's' : ''}` : ' with no mistakes'}.</b> Notice that the clue is always the <i>shape</i>: how many processes, how many threads each, and whether the copies are separate instances.` }));
            prog.textContent = `${placed.size} / ${IT.length} sorted · ${mistakes} slip${mistakes === 1 ? '' : 's'}`;
          }
          function drop(bi) {
            if (sel == null) { msg.className = 'callout tip small m0'; msg.dataset.label = 'How to play'; msg.textContent = 'First click a card, then click the kind of software it belongs to.'; return; }
            const it = IT[sel], box = buckets[bi];
            if (it.b === bi) {
              placed.add(sel);
              box.querySelector('.bk-items').append(h('div', { class: 'chip ok', style: { whiteSpace: 'normal' } }, '✓ ' + it.name));
              msg.className = 'callout tip small m0'; msg.dataset.label = 'Correct'; msg.innerHTML = `<b>${it.name}</b>: ${it.hint}`;
              sel = null;
            } else {
              mistakes++;
              box.classList.remove('flash'); void box.offsetWidth; box.classList.add('flash');
              msg.className = 'callout bad small m0'; msg.dataset.label = 'Not that one'; msg.innerHTML = `<b>${it.name}</b> is not ${TY[bi].name.toLowerCase()}. Clue: ${it.text}.`;
            }
            paintTray();
          }
          const reset = h('button', { class: 'btn sm', type: 'button', onclick: () => { sel = null; placed = new Set(); mistakes = 0; buckets.forEach((b) => b.querySelector('.bk-items').replaceChildren()); msg.className = 'callout tip small m0'; msg.dataset.label = 'How to play'; msg.textContent = 'Click a card, then click the kind of software it is (or drag the card onto it).'; paintTray(); } }, 'Start over');
          paintTray();
          p.append(h('div', { class: 'stack', style: { gap: '10px' } }, tray, h('div', { class: 'grid-4' }, ...buckets), h('div', { class: 'split r3', style: { height: 'auto', alignItems: 'center', gap: '14px' } }, msg, h('div', { class: 'row', style: { justifyContent: 'flex-end' } }, prog, reset))));
        };
        el.append(h('div', { class: 'fill' }, ctx.ui.tabs([{ label: 'Meet the four kinds', render: learn }, { label: 'Sort them: which kind is it?', render: game }])));
      },
    },

    /* ---------------- 7. Valve: coarse vs fine vs hybrid threading on a 4-core frame ---------------- */
    {
      title: 'A game engine on four cores: coarse, fine or hybrid?',
      kind: 'lab',
      core: true,
      sys: [
        { id: 'render', name: 'Rendering', ab: 'R', w: 12, cls: 'cpu' }, { id: 'physics', name: 'Physics', ab: 'Ph', w: 6, cls: 'io' },
        { id: 'ai', name: 'AI', ab: 'AI', w: 2, cls: 'proc' }, { id: 'particles', name: 'Particles', ab: 'Pa', w: 2, cls: 'thread' },
        { id: 'sound', name: 'Sound', ab: 'S', w: 1, cls: 'os' }, { id: 'logic', name: 'Game logic', ab: 'L', w: 1, cls: 'mem' },
      ],
      render(el, ctx) {
        const { h, s } = ctx; const fmt = ctx.util.fmt; const SYS = this.sys;
        const CORES = 4, SYNC = 0.5, TOTAL = 24, BEST_HYB = 7.5;
        let mode = 'single', sel = null;
        const assign = { render: 0, physics: 0, ai: 1, particles: 1, sound: 2, logic: 2 };
        const split = new Set(['render']);
        function schedule() {
          const lanes = [[], [], [], []], t = [0, 0, 0, 0];
          const put = (c, sy, dur, kind) => { lanes[c].push({ sy, start: t[c], dur, kind }); t[c] += dur; };
          if (mode === 'single') SYS.forEach((sy) => put(0, sy, sy.w, 'work'));
          else if (mode === 'coarse') SYS.forEach((sy) => put(assign[sy.id], sy, sy.w, 'work'));
          else {
            const cut = mode === 'fine' ? SYS : SYS.filter((sy) => split.has(sy.id));
            cut.forEach((sy) => { for (let c = 0; c < CORES; c++) { put(c, sy, sy.w / CORES, 'work'); put(c, sy, SYNC, 'sync'); } });
            SYS.filter((sy) => !cut.includes(sy)).sort((a, b) => b.w - a.w).forEach((sy) => { const c = t.indexOf(Math.min(...t)); put(c, sy, sy.w, 'work'); });
          }
          return { lanes, loads: t, frame: Math.max(...t) };
        }
        // ---------- Gantt chart
        const NW = ctx.narrow;   // phones: a narrow drawing so the labels stay legible
        const X0 = NW ? 58 : 74, X1 = NW ? 370 : 644, PX = (X1 - X0) / TOTAL, LY = 26, LH = NW ? 42 : 50, GAP = NW ? 10 : 12;
        const gantt = s('svg', { viewBox: NW ? '0 0 380 262' : '0 0 660 300', width: '100%', role: 'img', 'aria-label': 'Timeline of one frame on four cores' });
        const cmp = s('svg', { viewBox: NW ? '0 0 380 118' : '0 0 660 118', width: '100%', role: 'img', 'aria-label': 'Frame time of each strategy you have tried' });
        const CL = NW ? 100 : 130, CB = NW ? 108 : 140, CW = NW ? 220 : 450;   // comparison chart: label edge, bar start, bar width
        const best = { single: null, coarse: null, fine: null, hybrid: null };
        const MODES = [['single', 'One thread'], ['coarse', 'Coarse-grained'], ['fine', 'Fine-grained'], ['hybrid', 'Hybrid']];
        function drawCmp() {
          const k = [s('text', { x: 0, y: 14, 'font-size': 13, 'font-weight': 800, class: 's-sub' }, NW ? 'LATEST FRAME TIME PER STRATEGY' : 'YOUR LATEST FRAME TIME FOR EACH STRATEGY')];
          MODES.forEach(([m, lab], i) => {
            const y = 26 + i * 23, v = best[m], on = m === mode;
            k.push(s('text', { x: CL, y: y + 14, 'text-anchor': 'end', 'font-size': 13.5, 'font-weight': on ? 800 : 500 }, lab));
            k.push(s('rect', { x: CB, y, width: CW, height: 18, rx: 4, class: 's-panel', 'stroke-width': 1 }));
            if (v != null) { k.push(s('rect', { x: CB, y, width: CW * v / TOTAL, height: 18, rx: 4, class: on ? 's-accent' : 's-cpu', 'stroke-width': on ? 2 : 1 })); k.push(s('text', { x: CB + 6 + CW * v / TOTAL, y: y + 14, 'font-size': 13, 'font-weight': 800 }, fmt(v, 2) + ' ms')); }
            else k.push(s('text', { x: CB + 8, y: y + 14, 'font-size': 13, class: 's-sub' }, 'not tried yet'));
          });
          cmp.replaceChildren(...k);
        }
        function drawGantt(sc) {
          const k = [];
          for (let c = 0; c < CORES; c++) {
            const y = LY + c * (LH + GAP);
            const lane = s('rect', { x: X0, y, width: X1 - X0, height: LH, rx: 6, class: 's-panel' + (mode === 'coarse' ? ' hot' : ''), 'stroke-width': mode === 'coarse' && sel ? 2 : 1, style: mode === 'coarse' ? { cursor: 'pointer' } : null,
              onclick: () => moveTo(c), ondragover: (e) => e.preventDefault(), ondrop: (e) => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); if (id) { sel = id; moveTo(c); } } });
            k.push(lane, s('text', { x: X0 - 10, y: y + LH / 2 + 5, 'text-anchor': 'end', 'font-size': 14, 'font-weight': 700 }, 'Core ' + (c + 1)));
            sc.lanes[c].forEach((b) => {
              const x = X0 + b.start * PX, w = b.dur * PX;
              if (b.kind === 'sync') { k.push(s('rect', { x, y: y + 3, width: w, height: LH - 6, rx: 2, class: 's-intr', 'stroke-width': 1 })); return; }
              const g = s('g', { style: mode === 'coarse' ? { cursor: 'pointer' } : null, onclick: mode === 'coarse' ? (e) => { e.stopPropagation(); sel = b.sy.id; paint(); } : null });
              g.append(s('rect', { x: x + 0.5, y: y + 3, width: Math.max(1, w - 1), height: LH - 6, rx: 5, class: 's-' + b.sy.cls, 'stroke-width': sel === b.sy.id && mode === 'coarse' ? 4 : 2 }));
              const lab = w > b.sy.name.length * 8 + 8 ? b.sy.name : w > b.sy.ab.length * 9 + 4 ? b.sy.ab : '';
              if (lab) g.append(s('text', { x: x + w / 2, y: y + LH / 2 + 5, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 700, style: { pointerEvents: 'none' } }, lab));
              k.push(g);
            });
          }
          const fx = X0 + sc.frame * PX, axY = LY + CORES * (LH + GAP) - GAP + 12;
          k.push(s('line', { x1: X0, y1: axY, x2: X1, y2: axY, class: 's-line' }));
          for (let m = 0; m <= TOTAL; m += 4) k.push(s('text', { x: X0 + m * PX + (m === TOTAL ? 8 : 0), y: axY + 18, 'text-anchor': m === TOTAL ? 'end' : 'middle', 'font-size': 13, class: 's-sub' }, m + (m === TOTAL ? ' ms' : '')));
          k.push(s('line', { x1: fx, y1: 8, x2: fx, y2: axY, class: 's-line', 'stroke-width': 2.5, 'stroke-dasharray': '6 4', style: { stroke: 'var(--bad)' } }));
          k.push(s('text', { x: Math.min(fx + 6, X1 - 4), y: 16, 'text-anchor': fx > X1 - 120 ? 'end' : 'start', 'font-size': 13.5, 'font-weight': 800, style: { fill: 'var(--bad)' } }, 'frame done: ' + fmt(sc.frame, 2) + ' ms'));
          gantt.replaceChildren(...k);
        }
        // ---------- controls + readouts
        const modeText = {
          single: '<b>Before multicore:</b> the whole game loop is one thread, so each frame runs the systems one after another on a single core. There is nothing to arrange.',
          coarse: '<span class="t">Coarse-grained threading</span>: each whole module runs as one thread on its own core; a <span class="t">timeline thread</span> keeps them in step each frame. <b>Drag a system button (under the chart) onto a core</b>, or click it, then a core.',
          fine: '<span class="t">Fine-grained threading</span>: split each system\'s work, like a loop over every object, into small pieces spread over all cores. All cores finish one system, meet at a sync point, then start the next. Every system is split automatically.',
          hybrid: '<span class="t" data-t="Hybrid threading (game engines)">Hybrid threading</span>: split only the systems worth splitting and leave the others single-threaded. <b>Click the buttons under the chart to toggle split / whole.</b>',
        };
        const explain = h('div', { class: 'small' });
        const ctrls = h('div', { class: 'row', style: { gap: '6px', justifyContent: 'center', minHeight: '66px', alignContent: 'center' } });
        const bigF = h('div', { class: 'big num' });
        const fps = h('div', { class: 'num b', style: { fontSize: '24px' } });
        const spd = h('div', { class: 'num b', style: { fontSize: '24px', color: 'var(--cpu)' } });
        const use = h('div', { class: 'num b', style: { fontSize: '24px' } });
        const say = h('div', { class: 'callout why small m0', 'data-label': 'What happened' });
        // what Valve actually measured or concluded for each strategy (the toy numbers above are idealised)
        const VERDICT = {
          single: 'This is what Valve had to move away from: all of a frame\'s work done by one thread, one system after another, however many cores the chip has.',
          coarse: 'On two processors: up to 2× only in contrived tests, about <b>1.2×</b> in real gameplay, since each frame still waits for its slowest module.',
          fine: 'Hard to apply well: each small unit of work takes a varying time, and keeping outcomes and their consequences in the right order made the code complex.',
          hybrid: 'The <b>most promising</b>, expected to scale best to 8 or 16 cores. Sound mixing (little user input, its own data, not tied to the frame) stays on one core; rendering spreads over many threads.',
        };
        const verdict = h('div', { class: 'callout tip small m0', 'data-label': "What Valve found" });
        function moveTo(c) {
          if (mode !== 'coarse') return;
          if (!sel) { ctx.toast('First pick a system (click it), then click a core.'); return; }
          assign[sel] = c; sel = null; paint();
        }
        function paintCtrls() {
          explain.innerHTML = modeText[mode];
          if (mode === 'coarse') ctrls.replaceChildren(...SYS.map((sy) => h('button', { type: 'button', class: `btn sm ${sy.cls}` + (sel === sy.id ? ' on' : ''), draggable: 'true', title: 'Drag onto a core, or click then click a core',
            onclick: () => { sel = sel === sy.id ? null : sy.id; paint(); }, ondragstart: (e) => e.dataTransfer.setData('text/plain', sy.id) }, `${sy.name} ${sy.w} ms → Core ${assign[sy.id] + 1}`)));
          else if (mode === 'hybrid') ctrls.replaceChildren(...SYS.map((sy) => h('button', { type: 'button', class: `btn sm ${sy.cls}` + (split.has(sy.id) ? ' on' : ''), 'aria-pressed': split.has(sy.id),
            onclick: () => { if (split.has(sy.id)) split.delete(sy.id); else split.add(sy.id); paint(); } }, split.has(sy.id) ? `✓ split: ${sy.name}` : `whole: ${sy.name}`)), h('span', { class: 'chip intr' }, 'red = sync overhead'));
          else ctrls.replaceChildren(...SYS.map((sy) => h('span', { class: 'chip ' + sy.cls }, `${sy.name} ${sy.w} ms`)), ...(mode === 'fine' ? [h('span', { class: 'chip intr' }, 'sync overhead')] : []));
        }
        function narrate(sc) {
          const busiest = sc.loads.indexOf(Math.max(...sc.loads));
          if (mode === 'single') return `Everything runs on Core 1: ${TOTAL} ms per frame (about ${fmt(1000 / TOTAL, 0)} frames per second) while three cores sit idle.`;
          if (mode === 'coarse' && sel) return `Now click a core lane in the chart to move <b>${SYS.find((x) => x.id === sel).name}</b> there (or click the button again to cancel).`;
          if (mode === 'coarse') return sc.frame > 12.001
            ? `The frame ends when the busiest core finishes: Core ${busiest + 1} has ${fmt(sc.frame, 1)} ms of work. Move systems to even out the cores. Can you reach 12 ms?`
            : '12 ms (2×) is the best coarse threading can do: Rendering alone takes 12 ms and cannot be split, so the other cores sit partly idle, even in this toy where modules never wait for each other.';
          if (mode === 'fine') return `All cores stay busy, but each of the 6 sync points costs ${SYNC} ms on every core: 3 of the 9 ms are pure overhead. Splitting a 1 ms system like Sound costs more than it saves.`;
          if (!split.has('render')) return 'Rendering is still whole, so no frame can be shorter than 12 ms. Split it.';
          if (!split.has('physics')) return 'Now Physics (6 ms) is the longest whole task and holds up the frame. What if you split it too?';
          if (sc.frame > BEST_HYB + 1e-9) return 'Each split system adds a sync point to every core. The small systems gain almost nothing from splitting. Try leaving them whole.';
          return `Best mix: split the two big systems and let the four small ones run whole, side by side on different cores. ${BEST_HYB} ms, ${fmt(TOTAL / BEST_HYB, 1)}× faster than one core, the best of all four strategies.`;
        }
        function paint() {
          const sc = schedule();
          best[mode] = sc.frame;
          drawGantt(sc); paintCtrls(); drawCmp();
          bigF.textContent = fmt(sc.frame, 2) + ' ms';
          fps.textContent = fmt(1000 / sc.frame, 0);
          spd.textContent = fmt(TOTAL / sc.frame, 2) + '×';
          use.textContent = Math.round((TOTAL / (CORES * sc.frame)) * 100) + '%';
          say.innerHTML = narrate(sc);
          verdict.innerHTML = VERDICT[mode];
          verdict.dataset.label = mode === 'single' ? 'The starting point' : 'What Valve found';
        }
        const seg = ctx.ui.seg([{ value: 'single', label: 'One thread' }, { value: 'coarse', label: 'Coarse-grained' }, { value: 'fine', label: 'Fine-grained' }, { value: 'hybrid', label: 'Hybrid' }], mode, (v) => { mode = v; sel = null; paint(); });
        const stat = (lab, node) => h('div', {}, h('div', { class: 'xs muted b' }, lab), node);
        const left = h('div', { class: 'stack', style: { gap: '10px' } },
          h('p', { class: 'small m0' }, 'Valve rebuilt its Source game engine for multicore chips. Try its choices on one toy frame (a single screen image; games draw dozens per second): six systems, 24 ms of work, 4 cores.'),
          seg,
          h('div', { class: 'card tight' }, explain),
          h('div', { class: 'row', style: { gap: '18px', alignItems: 'flex-end' } }, stat('FRAME TIME', bigF), stat('FRAMES/S', fps), stat('SPEEDUP', spd), stat('CORES BUSY', use)),
          say, verdict);
        el.append(h('div', { class: 'split l fill' }, left, h('div', { class: 'card white tight stack', style: { gap: '8px', justifyContent: 'center' } }, gantt, ctrls, cmp)));
        paint();
      },
    },

    /* ---------------- 8. Inside the re-threaded renderer (step-through) ---------------- */
    {
      title: 'Inside the re-threaded renderer, step by step',
      kind: 'explore',
      render(el, ctx) {
        const { h, s } = ctx;
        // times are in ms, sized so rendering on ONE core takes 12 ms, the same Rendering block as the previous step
        // (scene lists 1.8 + 1.5 + 1.2 ms, then 15 per-object tasks of 0.5 ms). Lanes show the first 5 ms of the frame;
        // phones get a narrow, taller drawing (queue, render thread and GPU move below the lanes)
        const NW = ctx.narrow;
        const LX = NW ? 62 : 72, LW = NW ? 308 : 440, TU = 5, PX = LW / TU, LY = NW ? 66 : 78, LH = NW ? 40 : 54, LG = NW ? 10 : 14;
        const laneY = (c) => LY + c * (LH + LG);
        const LISTS = [{ c: 0, d: 1.8, lab: 'Main view' }, { c: 1, d: 1.5, lab: 'Reflection' }, { c: 2, d: 1.2, lab: 'Shadows' }];
        const NOBJ = 15, OD = 0.5;   // per-object tasks: 15 of 0.5 ms each
        const r1 = (v) => Math.round(v * 10) / 10;   // keep sums like 1.8 + 0.5 exact to one decimal
        // 'barrier' = start after all lists; 'busy' = each core pulls work as soon as it is free
        function objTasks(busy) {
          const free = busy ? [1.8, 1.5, 1.2, 0.3] : [1.8, 1.8, 1.8, 1.8], out = [];
          for (let i = 0; i < NOBJ; i++) { const c = free.indexOf(Math.min(...free)); out.push({ c, s: free[c], d: OD }); free[c] = r1(free[c] + OD); }
          return out;
        }
        const single = () => { const out = []; let t0 = 0; LISTS.forEach((l) => { out.push({ c: 0, s: t0, d: l.d, lab: l.lab, list: true }); t0 = r1(t0 + l.d); }); for (let i = 0; i < NOBJ; i++) out.push({ c: 0, s: r1(t0 + i * OD), d: OD }); return out; };
        const par = (busy) => LISTS.map((l) => ({ c: l.c, s: 0, d: l.d, lab: l.lab, list: true })).concat(objTasks(busy));
        const F = [
          { tasks: single(), world: 0, read: 0, q: 0, rt: 0, goal: -1, cap: '<b>The problem.</b> Rendering is the biggest system in a frame (the 12 ms block of the previous step), so it is where Valve\'s re-threading mattered most. On one thread it builds a list of visible objects for each view, prepares every object and produces the drawing commands for the graphics card (GPU), one job after another, while three cores sit idle.' },
          { tasks: [], world: 2, read: 1, q: 0, rt: 0, goal: 0, cap: '<b>Many readers, one writer.</b> Threads read the shared world data about 95% of the time and write it at most 5%. Locking the whole world for each thread was far too slow, so a <span class="t">single-writer, multiple-readers lock</span> lets any number of readers in together; only a writer needs it alone. While a frame is built nobody writes, so readers never wait.' },
          { tasks: par(false).filter((x) => x.list), world: 1, read: 1, q: 0, rt: 0, goal: 1, cap: 'Build a <span class="t">scene list</span> for each view in parallel: the main camera view of the world, its reflection in the water, and the shadow view. The lists do not depend on each other, so each is a task on its own core. Core 4 has nothing to do yet.' },
          { tasks: par(false), world: 1, read: 0, q: 0, rt: 0, goal: 1, cap: 'Each object then needs work of its own: the bone transformations that pose every character in every scene, plus graphics simulation such as particle effects, overlapped with this work instead of waiting its turn. These many near-identical tasks are spread over all four cores: fine-grained threading inside the renderer.' },
          { tasks: par(false), world: 1, read: 0, q: 6, rt: 0, goal: 2, cap: 'Many threads now "draw" in parallel: each finished task appends its drawing commands to a shared queue. A lock would make workers wait in line, so the queue is a <span class="t">lock-free data structure</span>: an append is an atomic compare_and_swap (simply retried if another worker got there first), so no worker is ever put to sleep.' },
          { tasks: par(false), world: 1, read: 0, q: 3, rt: 1, goal: 3, cap: 'The graphics API (the library a program calls to command the GPU) accepted commands from one thread at a time, in order. Rather than put a lock around every call, exactly <b>one render thread</b> owns the API: it drains the queue and submits the commands. (It shares a core with the workers; it is drawn apart here.)' },
          { tasks: par(true), world: 1, read: 0, q: 3, rt: 1, goal: 4, cap: '<b>Keep every thread busy.</b> Workers pull the next task from a shared task list the moment they are free. Core 4 starts on per-object work as soon as the first objects are known, the idle gap disappears, and rendering ends at 3.3 ms instead of 3.8 ms.' },
          { tasks: par(true), world: 2, read: 0, q: 3, rt: 1, goal: 5, cap: 'The whole design: many readers with at most one writer, parallel scene lists, fine-grained per-object work, a lock-free queue and a single owner for the graphics API. Rendering takes 3.3 ms instead of 12 ms, close to the ideal 12 ÷ 4 = 3 ms, and the cores are about 91% busy, against 25% when one thread did it all.' },
        ];
        const GOALS = ['Many readers, one writer', 'Split the work across all cores', 'Avoid locking (lock-free queue)', 'One thread owns the graphics API', 'Keep every thread busy'];
        const svg = s('svg', { viewBox: NW ? '0 0 380 414' : '0 0 760 366', width: '100%', role: 'img', 'aria-label': 'Renderer threads, queue and GPU' });
        const goalList = h('div', { class: 'stack', style: { gap: '6px' } });
        const util = h('div', { class: 'num b', style: { fontSize: '26px' } });
        const finish = h('div', { class: 'small muted' });
        function draw(fr) {
          const k = [];
          k.push(s('rect', { x: LX, y: 6, width: LW, height: 44, rx: 10, class: 's-mem', 'stroke-width': fr.world === 2 ? 4 : 2 }));
          k.push(s('text', { x: LX + LW / 2, y: 26, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800 }, 'Game world data'));
          k.push(s('text', { x: LX + LW / 2, y: 43, 'text-anchor': 'middle', 'font-size': 13.5, class: 's-sub' }, fr.world ? (NW ? 'many readers · no writer this frame' : 'many readers at once · no writer while this frame is built') : 'positions, models, textures'));
          for (let c = 0; c < 4; c++) {
            const y = laneY(c);
            k.push(s('rect', { x: LX, y, width: LW, height: LH, rx: 6, class: 's-panel', 'stroke-width': 1 }));
            k.push(s('text', { x: LX - 8, y: y + LH / 2 + 5, 'text-anchor': 'end', 'font-size': 14, 'font-weight': 700, style: { fill: 'var(--cpu)' } }, 'Core ' + (c + 1)));
            const rx = LX + (NW ? 30 + c * 75 : 30 + c * 110);
            if (fr.read) k.push(s('line', { x1: rx, y1: 52, x2: rx, y2: y - 2, class: 's-line', 'stroke-dasharray': '4 4', 'marker-end': 'url(#arr-mem)', style: { stroke: 'var(--mem)' } }));
          }
          fr.tasks.forEach((tk) => {
            if (tk.s >= TU) return;
            const x = LX + tk.s * PX, y = laneY(tk.c) + 4, w = Math.min(tk.d, TU - tk.s) * PX;
            k.push(s('rect', { x: x + 1, y, width: w - 2, height: LH - 8, rx: 4, class: tk.list ? 's-accent' : 's-thread', 'stroke-width': 1.5 }));
            if (tk.lab && w > 50) k.push(s('text', { x: x + w / 2, y: y + LH / 2 + 1, 'text-anchor': 'middle', 'font-size': NW ? 12.5 : 13.5, 'font-weight': 700 }, tk.lab));
          });
          const end = fr.tasks.length ? Math.max(...fr.tasks.map((x) => x.s + x.d)) : 0;
          if (fr.tasks.length && end > TU) {
            for (let c = 1; c < 4; c++) k.push(s('text', { x: LX + LW / 2, y: laneY(c) + LH / 2 + 5, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, 'idle'));
            k.push(s('text', { x: LX + LW, y: laneY(3) + LH + 20, 'text-anchor': 'end', 'font-size': 13, 'font-weight': 700, style: { fill: 'var(--bad)' } }, NW ? 'Core 1 runs on until 12 ms →' : 'Core 1 runs on, off the chart, until 12 ms →'));
          }
          if (fr.tasks.length && end < TU) {
            k.push(s('line', { x1: LX + end * PX, y1: LY - 4, x2: LX + end * PX, y2: laneY(3) + LH + 4, class: 's-line', 'stroke-dasharray': '5 3', style: { stroke: 'var(--ok)' } }));
            k.push(s('text', { x: LX + end * PX + 4, y: laneY(3) + LH + 20, 'font-size': 13.5, 'font-weight': 800, style: { fill: 'var(--ok)' } }, (NW ? '' : 'done at ') + ctx.util.fmt(end, 1) + ' ms'));
          }
          if (fr.goal === 1 && !fr.tasks.some((x) => x.c === 3)) k.push(s('text', { x: LX + LW / 2, y: laneY(3) + LH / 2 + 5, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, 'idle'));
          // lock-free queue, render thread and GPU: a column on the right (wide) or rows below the lanes (phones)
          const thr = { class: 's-line', 'marker-end': 'url(#arr-thread)', style: { stroke: 'var(--thread)' } };
          const rtBox = (x, y, w, hh) => k.push(s('rect', { x, y, width: w, height: hh, rx: 10, class: 's-thread', 'stroke-width': fr.rt ? 4 : 1.5, style: fr.rt ? null : { opacity: 0.45 } }));
          const gpuBox = (x, y, w, hh) => k.push(s('rect', { x, y, width: w, height: hh, rx: 10, class: 's-io', 'stroke-width': fr.rt ? 3 : 1.5, style: fr.rt ? null : { opacity: 0.45 } }));
          const txt = (x, y, t, o = {}) => k.push(s('text', Object.assign({ x, y, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 800 }, o), t));
          if (!NW) {
            const QX = 552, QY = LY, QH = 4 * LH + 3 * LG;
            txt(QX + 30, QY - 18, 'lock-free'); txt(QX + 30, QY - 4, 'queue');
            k.push(s('rect', { x: QX, y: QY, width: 60, height: QH, rx: 8, class: 's-panel', 'stroke-width': fr.goal === 2 ? 4 : 1.5 }));
            for (let i = 0; i < 8; i++) k.push(s('rect', { x: QX + 10, y: QY + QH - 12 - (i + 1) * 28, width: 40, height: 22, rx: 4, class: i < fr.q ? 's-thread' : 's-muted', 'stroke-width': 1.5 }));
            if (fr.q) for (let c = 0; c < 4; c++) k.push(s('line', Object.assign({ x1: LX + LW + 2, y1: laneY(c) + LH / 2, x2: QX - 4, y2: laneY(c) + LH / 2 }, thr)));
            rtBox(648, LY, 106, 104);
            txt(701, LY + 44, 'Render', { 'font-size': 14 }); txt(701, LY + 62, 'thread', { 'font-size': 14 }); txt(701, LY + 82, '(only one)', { 'font-size': 13, 'font-weight': 400, class: 's-sub' });
            gpuBox(648, LY + 150, 106, QH - 150);
            txt(701, LY + 196, 'Graphics'); txt(701, LY + 214, 'API → GPU');
            if (fr.rt) {
              k.push(s('line', Object.assign({ x1: QX + 62, y1: LY + 52, x2: 644, y2: LY + 52 }, thr)));
              k.push(s('line', { x1: 701, y1: LY + 106, x2: 701, y2: LY + 146, class: 's-line', 'marker-end': 'url(#arr-io)', style: { stroke: 'var(--io)' } }));
            }
          } else {
            const QY = laneY(3) + LH + 46;                      // queue row under the lanes
            txt(LX, QY - 8, 'lock-free queue', { 'text-anchor': 'start', 'font-size': 13 });
            k.push(s('rect', { x: LX, y: QY, width: LW, height: 36, rx: 8, class: 's-panel', 'stroke-width': fr.goal === 2 ? 4 : 1.5 }));
            for (let i = 0; i < 8; i++) k.push(s('rect', { x: LX + 7 + i * 37.5, y: QY + 6, width: 32, height: 24, rx: 4, class: i < fr.q ? 's-thread' : 's-muted', 'stroke-width': 1.5 }));
            if (fr.q) k.push(s('path', Object.assign({ d: `M26 ${laneY(3) + LH + 4} V${QY + 18} H${LX - 4}`, fill: 'none' }, thr)));
            const RY = QY + 56;
            rtBox(LX, RY, 144, 50); txt(LX + 72, RY + 22, 'Render thread', { 'font-size': 14 }); txt(LX + 72, RY + 40, '(only one)', { 'font-size': 13, 'font-weight': 400, class: 's-sub' });
            gpuBox(LX + 164, RY, 144, 50); txt(LX + 236, RY + 22, 'Graphics API'); txt(LX + 236, RY + 40, '→ GPU');
            if (fr.rt) {
              k.push(s('line', Object.assign({ x1: LX + 72, y1: QY + 38, x2: LX + 72, y2: RY - 4 }, thr)));
              k.push(s('line', { x1: LX + 146, y1: RY + 25, x2: LX + 160, y2: RY + 25, class: 's-line', 'marker-end': 'url(#arr-io)', style: { stroke: 'var(--io)' } }));
            }
          }
          k.push(s('text', { x: LX, y: laneY(3) + LH + 20, 'font-size': 13.5, class: 's-sub' }, 'time (ms) →'));
          svg.replaceChildren(...k);
          goalList.replaceChildren(...GOALS.map((g, i) => h('div', { class: 'row nw small', style: { gap: '8px', opacity: i <= fr.goal ? 1 : 0.4, fontWeight: i === fr.goal ? 800 : 500 } },
            h('span', { class: 'chip ' + (i <= fr.goal ? 'ok' : ''), style: { minWidth: '26px', justifyContent: 'center' } }, i <= fr.goal ? '✓' : String(i + 1)), g)));
          if (fr.tasks.length) {
            const busy = fr.tasks.reduce((a, x) => a + x.d, 0);
            util.textContent = Math.round((busy / (4 * end)) * 100) + '%';
            finish.textContent = fr.tasks.every((x) => x.c === 0) ? 'Rendering done at 12 ms: all of it on one core.' : `Rendering done at ${ctx.util.fmt(end, 1)} ms (one core alone: 12 ms).`;
          } else { util.textContent = '–'; finish.textContent = 'No work scheduled yet in this frame.'; }
          return fr.cap;
        }
        const player = ctx.ui.player({ count: F.length, render: (i) => draw(F[i]), interval: 4200 });
        el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },
          h('div', { class: 'split r3', style: { height: 'auto', gap: '14px', flex: '1', minHeight: 0 } },
            h('div', { class: 'card white tight', style: { display: 'grid', placeItems: 'center' } }, svg),
            h('div', { class: 'card stack', style: { gap: '10px' } }, h('h4', { class: 'm0' }, 'Design goals'), goalList,
              h('div', {}, h('div', { class: 'xs muted b' }, 'CORES BUSY IN THIS FRAME'), util, finish),
              h('div', { class: 'row', style: { gap: '5px', marginTop: 'auto' } }, h('span', { class: 'chip accent' }, 'scene-list task'), h('span', { class: 'chip thread' }, 'per-object task'), h('span', { class: 'chip mem' }, 'shared world data')))),
          player.el));
      },
    },

    /* ---------------- 9. Recap ---------------- */
    {
      title: 'Recap: six ideas to carry with you',
      kind: 'recap',
      render(el, ctx) {
        const { h } = ctx;
        el.append(h('div', { class: 'stack fill', style: { gap: '14px' } },
          h('div', { class: 'row', style: { justifyContent: 'space-between', alignItems: 'center' } },
            h('p', { class: 'lead m0' }, 'Say each answer out loud before you flip the card.'),
            h('div', { class: 'card cpu tight row', style: { gap: '14px' } }, h('span', { class: 'xs b muted' }, "AMDAHL'S LAW"), h('span', { class: 'mono b', style: { fontSize: '19px' } }, 'Speedup = 1 / ((1 − f) + f / N)'))),
          ctx.ui.flipcards([
            ['What do f and 1 − f mean?', '<span><b>f</b> is the share of the one-core running time that can be spread perfectly over any number of cores. <b>1 − f</b> is inherently serial and never shrinks.</span>'],
            ['What is the ceiling on speedup?', '<span>As N → ∞, speedup → <b>1 / (1 − f)</b>. With f = 0.9 a program can never run more than 10× faster, however many cores you add.</span>'],
            ['Why can a real program get slower with more cores?', '<span>Overhead grows with every core: <b>communication</b>, <b>distributing the work</b> and <b>cache coherence</b>. Past a peak, each new core costs more than it gives.</span>'],
            ['Name the four kinds of multicore-friendly software.', '<span><b>Multithreaded native</b> (Lotus Domino, Siebel CRM), <b>multiprocess</b> (Oracle, SAP, PeopleSoft), <b>Java</b> (the JVM, Java EE servers) and <b>multi-instance</b> (copies, often in VMs).</span>'],
            ['Coarse vs fine vs hybrid threading?', '<span><b>Coarse:</b> one whole module per thread (only about 1.2× in real play). <b>Fine:</b> many similar small tasks over all cores (hard to manage). <b>Hybrid:</b> fine-grained only where it pays, single-threaded elsewhere: the winner.</span>'],
            ["The re-threaded renderer's ideas?", '<span>Scene lists for each view built <b>in parallel</b>, per-object work (bone transformations) spread over all cores, a <b>single-writer, multiple-readers</b> lock for world data, <b>lock-free</b> queues, and <b>one thread</b> owning the graphics API.</span>'],
          ], { cols: 3, height: 206 })));
      },
    },

    /* ---------------- 10. Check yourself ---------------- */
    {
      title: 'Check yourself',
      kind: 'check',
      quiz: [
        { q: "In Amdahl's law, speedup = 1 / ((1 − f) + f / N). What does <b>f</b> stand for?",
          choices: ['The fraction of the running time that must run on a single processor', 'The fraction of the running time that can be split perfectly across any number of processors', 'The fraction of the processors that are busy at any moment', 'The clock frequency of each core'],
          answer: 1,
          feedback: ['That is 1 − f, the serial fraction. f is the part that can be shared out.', null, 'That describes how busy the hardware is, not a property of the program.', "Amdahl's law says nothing about clock speed; f is a share of the running time."],
          why: 'f is the parallel fraction: the part of the one-processor running time that can be divided among N processors with no scheduling overhead. The rest, 1 − f, is inherently serial.' },
        { type: 'num', q: "A program is 90% parallelizable (f = 0.9). According to Amdahl's law, what speedup does it get on <b>8</b> processors? (Two decimal places.)", answer: 4.71, tol: 0.02, unit: '×',
          why: '1 / (0.1 + 0.9 / 8) = 1 / (0.1 + 0.1125) = 1 / 0.2125 ≈ 4.71. Eight processors, less than five times faster.' },
        { q: 'A game engine uses <b>hybrid</b> threading. Which system is the best candidate to leave <b>single-threaded</b>, running whole on one core?',
          choices: ['Scene rendering, the biggest system in each frame', 'Computing the bone transformations of every character in every scene', 'Building the scene lists for the main view, a reflection and the shadows', 'Sound mixing, a small system with little user interaction that works on its own data'],
          answer: 3,
          feedback: ['Rendering is the system that most needs spreading over many threads; left whole, it alone would set the frame time.', 'Many near-identical, independent calculations are the classic case for fine-grained threading, not for a single thread.', 'Each view\'s list is independent of the others, so the lists are built in parallel rather than on one thread.', null],
          why: 'Hybrid threading splits only the systems that gain from splitting. A small, self-contained system such as sound mixing runs well whole on one core, while big systems such as rendering are spread over many threads.' },
        { type: 'num', q: 'A program is 80% parallel (f = 0.8). With an <b>unlimited</b> number of processors, what is the largest speedup it can ever reach?', answer: 5, tol: 0.01, unit: '×',
          why: 'As N grows, f / N shrinks to 0, so speedup approaches 1 / (1 − f) = 1 / 0.2 = 5. The serial 20% sets the ceiling.' },
        { type: 'num', q: 'A job takes 100 s on one core, and 20 s of it is inherently serial. The rest parallelizes perfectly. How many seconds does it take on <b>4</b> cores?', answer: 40, tol: 0.1, unit: 's',
          why: 'The serial 20 s stays; the parallel 80 s is split four ways into 20 s. Total 20 + 20 = 40 s, a speedup of 2.5×.' },
        { type: 'tf', q: 'If 90% of a program can run in parallel, 1000 processors will make it roughly 900 times faster.', answer: false,
          why: 'The serial 10% caps the speedup at 1 / (1 − 0.9) = 10×. With 1000 processors Amdahl\'s law gives only about 9.9×.' },
        { type: 'multi', q: 'Which of these are sources of overhead that can make a real multithreaded program <b>slower</b> as more cores are added? Select all that apply.',
          choices: ['Threads communicating and waiting for each other', 'Cutting the job into pieces and handing the pieces out to the threads', "Keeping the cores' cached copies of shared data coherent", 'Each core having a smaller share of the parallel work to do', 'The serial part shrinking as cores are added'],
          answer: [0, 1, 2],
          why: 'Communication, distributing the work and cache coherence all cost more as cores are added. A smaller share of parallel work per core is the benefit, not a cost, and the serial part never shrinks at all.' },
        { type: 'bucket', q: 'Sort each application into the kind of multicore-friendly software it is.',
          buckets: ['Multithreaded native', 'Multiprocess', 'Java', 'Multi-instance'],
          items: [['Lotus Domino', 0], ['Siebel CRM', 0], ['Oracle database', 1], ['SAP', 1], ['PeopleSoft', 1], ['A Java EE application server', 2], ['Several copies of one program, each in its own virtual machine', 3]],
          why: 'A few processes with many threads each: multithreaded native. Many single-threaded processes: multiprocess. The multithreaded JVM and Java EE servers: Java. Running extra copies side by side: multi-instance.' },
        { type: 'match', q: 'Match each threading strategy used in game engines with its description.',
          pairs: [['Coarse-grained threading', 'Each whole module, such as rendering or AI, gets its own thread'], ['Fine-grained threading', 'Many similar tasks, such as the iterations of one loop, are spread over all cores'], ['Hybrid threading', 'Fine-grained threading for some systems, single threads for the others']],
          why: 'Coarse splits by module, fine splits one kind of work into many small pieces, and hybrid mixes the two, choosing per system.' },
        { q: 'A game frame on a 4-core chip has a 12 ms rendering module and 12 ms of other, smaller modules. Using <b>coarse-grained</b> threading only (a module can never be split) and assuming modules never wait for each other, what is the shortest possible frame time?',
          choices: ['3 ms', '6 ms', '12 ms', '24 ms'], answer: 2,
          feedback: ['3 ms is 12 ÷ 4, but coarse threading never splits a module across cores.', '6 ms would need all 24 ms of work shared perfectly, but the 12 ms rendering module cannot be split.', null, '24 ms is the one-core time; putting modules on different cores already helps.'],
          why: 'With coarse threading a frame cannot finish before its biggest module does, so 12 ms is the floor, however the other modules are arranged.' },
        { q: 'Threads in a game engine read the shared world data about 95% of the time and write it at most 5% of the time. Which way of protecting that data suits this pattern best?',
          choices: ['A single-writer, multiple-readers lock: readers hold it together, a writer holds it alone', 'One ordinary lock around the whole world that every thread must take, whether it reads or writes', 'A private copy of the whole world for every thread, merged at the end of each frame', 'No protection at all, because writes are rare'],
          answer: 0,
          feedback: [null, 'That makes readers wait for other readers even though reading together is safe; locking the whole world this way proved far too slow.', 'Copying the whole world for every thread wastes memory and time, and merging conflicting changes is hard.', 'Even a rare write can leave a reader seeing half-changed data; a writer still needs the data to itself.'],
          why: 'Reads do not interfere with each other, so letting all readers in together removes almost all waiting. Only the rare writer needs exclusive access.' },
        { type: 'order', q: 'Put the steps for building one frame in a renderer re-threaded for multicore in order.',
          items: ['Scene lists are built in parallel, one for each view (main camera, reflection, shadows)', 'Per-object work, such as bone transformations, is spread over all the cores', 'Workers append their drawing commands to a lock-free queue', 'The single render thread drains the queue and submits the commands to the GPU'],
          why: 'First find what is visible in each view, then do the work each of those objects needs, queue the resulting drawing commands without locks, and let the one thread that owns the graphics API feed the GPU.' },
      ],
    },

  ],

  notes: `
    <h3>More cores, but not proportionally more speed</h3>
    <p>A multicore processor puts several independent cores on one chip, so several threads can run at the same instant. Doubling the cores rarely doubles the speed of a program, because some of every program's work cannot be shared out. <b>Speedup</b> measures the gain: the time a job takes on one processor divided by the time it takes on N processors.</p>
    <p>Analogy: friends can chop vegetables for a lasagna in parallel, but it still bakes for the same time in your one oven. The oven time is the serial part of the job.</p>

    <h3>Amdahl's law</h3>
    <p>Split the one-processor running time T into two parts. A fraction <b>f</b> (the parallel fraction) can be divided among any number of processors perfectly, with no scheduling overhead. The rest, <b>1 − f</b> (the serial fraction), must run one step at a time and does not shrink however many processors you have.</p>
    <ul>
      <li>Time on one processor: T<sub>1</sub> = (1 − f)T + fT = T</li>
      <li>Time on N processors: T<sub>N</sub> = (1 − f)T + fT / N (only the parallel part is divided)</li>
      <li>Speedup = T<sub>1</sub> / T<sub>N</sub> = <b>1 / ((1 − f) + f / N)</b> (T cancels out)</li>
      <li>Ceiling: as N → ∞, f / N → 0, so speedup → <b>1 / (1 − f)</b></li>
      <li>Efficiency = speedup / N: how much of each core does useful work</li>
    </ul>
    <table>
      <tr><th>Cores N (f = 0.9, T = 100 ms)</th><th>Time on N cores</th><th>Speedup</th><th>Efficiency</th></tr>
      <tr><td>1</td><td>10 + 90 = 100 ms</td><td>1×</td><td>100%</td></tr>
      <tr><td>2</td><td>10 + 45 = 55 ms</td><td>1.82×</td><td>91%</td></tr>
      <tr><td>4</td><td>10 + 22.5 = 32.5 ms</td><td>3.08×</td><td>77%</td></tr>
      <tr><td>8</td><td>10 + 11.25 = 21.25 ms</td><td>4.71×</td><td>59%</td></tr>
      <tr><td>64</td><td>10 + 1.41 = 11.41 ms</td><td>8.77×</td><td>14%</td></tr>
      <tr><td>∞</td><td>10 ms</td><td>10× (the ceiling)</td><td>→ 0%</td></tr>
    </table>
    <p><b>Two lessons.</b> (1) When f is small, extra processors barely help. (2) Even when f is large, each extra core adds less than the one before (diminishing returns) and the speedup flattens at 1 / (1 − f). To go faster, shrink the serial part: halving it doubles the ceiling.</p>
    <h4>Worked examples</h4>
    <ul>
      <li>f = 0.95, N = 16: 1 / (0.05 + 0.059375) = 1 / 0.109375 ≈ <b>9.14×</b></li>
      <li>f = 0.9, N = 8: 1 / (0.1 + 0.1125) ≈ <b>4.71×</b>; the ceiling is 10×, and 1000 cores give about 9.91×</li>
      <li>f = 0.5, N = 1000: 1 / 0.5005 ≈ <b>2.00×</b> (ceiling 2×)</li>
      <li>f = 0.99, N = 100: 1 / 0.0199 ≈ <b>50.25×</b>, half of the ideal 100×</li>
      <li>f = 0.75, N = 4: 1 / 0.4375 ≈ <b>2.29×</b> (efficiency 57%)</li>
      <li>f = 0.8, unlimited cores: 1 / 0.2 = <b>5×</b></li>
      <li>In seconds: 200 s on one core with 30 s serial, on 8 cores: 30 + 170 / 8 = <b>51.25 s</b>. Likewise 100 s with 20 s serial on 4 cores: 20 + 80 / 4 = <b>40 s</b>.</li>
      <li>Working backwards: 8× on 16 cores needs (1 − f) + f / 16 = 0.125, so f × 15/16 = 0.875 and f = <b>0.933</b> (93.3% parallel).</li>
    </ul>
    <h3>Real software: overhead can make it slower</h3>
    <p>Amdahl's law is a best case, because it assumes that splitting work is free. Real programs pay a <b>parallel overhead</b> that grows with the number of cores:</p>
    <ul>
      <li><b>Communication</b>: threads exchange results and wait for each other at synchronization points.</li>
      <li><b>Distribution of work</b>: the job must be cut into pieces and handed out; more cores mean more pieces.</li>
      <li><b>Cache coherence</b>: when cores share data, the hardware must keep every core's cached copy consistent, which costs extra memory traffic.</li>
    </ul>
    <p>So real performance often rises, <b>peaks</b>, and then <b>falls</b> as cores are added: past the peak each new core costs more than it contributes. A simple illustrative model: time = (1 − f) + f / N + overhead × (N − 1). With f = 0.9 and 1% overhead per extra core, the best is about 3.57× at 9 or 10 cores, and 64 cores manage only 1.34×. Amdahl's law on its own never predicts a slowdown (its speedup always rises with N); only overhead can.</p>
    <p>Not all software hits this wall. <b>Database management systems</b> and <b>Java applications</b> are examples that can scale well on multicore: they serve many independent requests at once, so almost all of the work is parallel (f close to 1) and each extra core simply takes on more requests.</p>

    <h3>Four kinds of applications that benefit from multicore</h3>
    <table>
      <tr><th>Kind</th><th>Shape</th><th>Examples</th></tr>
      <tr><td>Multithreaded native applications</td><td>A few processes, each with many threads; compiled to run directly on the hardware</td><td>Lotus Domino, Siebel CRM</td></tr>
      <tr><td>Multiprocess applications</td><td>Many processes, each single-threaded; the OS runs them on different cores</td><td>Oracle database, SAP, PeopleSoft</td></tr>
      <tr><td>Java applications</td><td>Java supports threads directly and the Java virtual machine is itself multithreaded (garbage collection, compiling); Java EE application servers serve many requests in parallel</td><td>Java EE application servers, the JVM</td></tr>
      <tr><td>Multi-instance applications</td><td>Several copies of the same program run at once, often each in its own virtual machine for isolation; helps even if one copy cannot use many cores</td><td>Copies running in parallel virtual machines</td></tr>
    </table>
    <p>In every case the OS ends up with many runnable threads to place on different cores; the difference is who created them.</p>

    <h3>Game engine example: re-threading Valve's Source engine</h3>
    <p>Valve rebuilt its Source game engine to use multicore chips and weighed three threading strategies:</p>
    <ul>
      <li><b>Coarse-grained threading</b>: each module (rendering, AI, physics and so on) is its own single thread on its own processor, and a <b>timeline thread</b> keeps the module threads in step each frame. Simple, but a frame cannot finish before its biggest module does. Valve saw up to 2× on two processors only in contrived cases; in real gameplay the gain was about <b>1.2×</b>.</li>
      <li><b>Fine-grained threading</b>: many similar or identical tasks, such as the iterations of a loop over an array, are spread across all processors. Cores stay busy, but every split adds coordination overhead, and Valve found it hard to use well: each unit of work takes a variable time, and keeping outcomes and their consequences in order made the code complex.</li>
      <li><b>Hybrid threading</b>: fine-grained threading for the systems worth splitting, single threading for the others. Valve found this the <b>most promising</b>, expected to scale best to 8 or 16 processors. Sound mixing (little user interaction, its own data, not tied to the frame) stays on one processor; scene rendering is spread over many threads.</li>
    </ul>
    <table>
      <tr><th>Toy frame: 24 ms of work, 4 cores, 0.5 ms sync per split</th><th>Frame time</th></tr>
      <tr><td>One thread</td><td>24 ms</td></tr>
      <tr><td>Coarse-grained (best arrangement; the 12 ms renderer is the floor)</td><td>12 ms (2×)</td></tr>
      <tr><td>Fine-grained (every system split; 3 ms of the frame is sync overhead)</td><td>9 ms</td></tr>
      <tr><td>Hybrid (split only rendering and physics)</td><td>7.5 ms (3.2×)</td></tr>
    </table>
    <h4>Inside the re-threaded renderer</h4>
    <ol>
      <li><b>Many readers, one writer</b>: threads read the shared world data about 95% of the time and write it at most 5%. Locking the whole world for each thread was far too slow, so a <b>single-writer, multiple-readers lock</b> lets any number of readers in together; only a writer needs exclusive access.</li>
      <li><b>Scene lists</b> (the visible objects) for several views are built in parallel: the world from the main camera, its reflection in water, a shadow view.</li>
      <li><b>Per-object work</b>, such as the bone transformations of every character in every scene, is spread over all cores, and graphics simulation (such as particles) is overlapped with it.</li>
      <li>Several threads "draw" in parallel, appending drawing commands to a <b>lock-free queue</b> (an atomic compare_and_swap per append, retried on a clash), so no thread sleeps on a lock.</li>
      <li>A <b>single render thread</b> owns the graphics API (which took commands from one thread at a time), drains the queue and submits to the GPU in order.</li>
    </ol>
    <p>Goals: avoid locking, share data that is mostly read, keep every thread busy (workers pull the next task the moment they are free), and give the graphics API one owner. In the step-through model, the 12 ms of rendering work that one core needs (the same Rendering block as the four-core lab) finishes in about 3.3 ms on four cores, close to the ideal 12 ÷ 4 = 3 ms, with the cores about 91% busy instead of 25%.</p>`,
});
