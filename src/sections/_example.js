/* =====================================================================
   REFERENCE EXAMPLE — not part of the published guide.
   Shows every building block the shell provides. Copy patterns, not text.
   Build + view:  node build.mjs --example  →  dev/_example.html#1.9/1
   ===================================================================== */
Guide.section({
  id: '1.9',                       // must match the file name, e.g. sections/1.3.js → '1.3'
  title: 'API Example: A Print Queue',
  short: 'API example',            // optional shorter title for tight spaces
  summary: 'A toy topic used only to demonstrate the building blocks.',
  objectives: ['See how a step is written.', 'See every quiz type.'],
  terms: [                         // every <span class="t"> used in the section must resolve here (or in another section/chapter)
    ['Queue', 'A waiting line where the first item added is the first item removed (first-in, first-out).'],
    ['Spooler', 'A program that holds jobs for a slow device (such as a printer) in a queue and feeds them to it one at a time.'],
    ['Throughput', 'How much work a system finishes per unit of time.'],
    ['Busy waiting', 'Repeatedly checking a condition in a loop instead of sleeping until it becomes true.'],
  ],

  /* Scoped CSS: ALWAYS prefix selectors with the section class (.sec-1-9 for id 1.9). */
  css: `
    .sec-1-9 .job { display:inline-grid; place-items:center; width:44px; height:44px; border-radius:10px; font-weight:800; }
  `,

  steps: [
    /* ---------------- 1. Plain explanation with HTML only ---------------- */
    {
      title: 'Why computers keep a print queue',
      kind: 'story',
      html: `
        <div class="split l fill">
          <div class="stack">
            <p class="lead">Many programs may want the printer at once, but a printer can only print one page at a time.</p>
            <p>The operating system therefore keeps a <span class="t">queue</span> of jobs. A small program called a <span class="t">spooler</span> takes the job at the front, sends it to the printer, and moves on.</p>
            <div class="callout analogy" data-label="Analogy">A deli counter with numbered tickets: customers can arrive any time, but they are served strictly in ticket order.</div>
            <div class="callout why" data-label="Why it matters">Programs can hand off their output instantly and keep working instead of waiting for the slow printer.</div>
          </div>
          <div class="card stack">
            <h4>Colour language</h4>
            <div class="row"><span class="box proc">Program</span> → <span class="box os">Spooler (OS)</span> → <span class="box io">Printer (I/O)</span></div>
            <p class="small muted m0">Processes are teal, the OS is violet, I/O devices are orange, in every diagram in the guide.</p>
          </div>
        </div>`,
    },

    /* ---------------- 2. Step-through simulation with ui.player ---------------- */
    {
      title: 'Watch the spooler work, one step at a time',
      kind: 'explore',
      render(el, ctx) {
        const { h, s } = ctx;
        // 1) build the visuals FIRST (the player calls render(0) immediately)
        const svg = s('svg', { viewBox: '0 0 700 220', width: '100%' });
        const frames = [
          { q: ['A', 'B', 'C'], printing: null, cap: '<b>Start.</b> Three jobs wait in the queue. The printer is idle.' },
          { q: ['B', 'C'], printing: 'A', cap: 'The spooler takes the job at the <b>front</b> (A) and sends it to the printer.' },
          { q: ['C'], printing: 'B', cap: 'A finished. B was next in line, so B prints. First in, first out.' },
          { q: [], printing: 'C', cap: 'C prints. The queue is now empty.' },
          { q: [], printing: null, cap: 'All done. The spooler sleeps until a new job arrives, so it wastes no CPU time (no <span class="t">busy waiting</span>).' },
        ];
        function draw(f) {
          svg.replaceChildren(
            s('rect', { x: 10, y: 60, width: 330, height: 100, rx: 14, class: 's-os', 'stroke-width': 2 }),
            s('text', { x: 20, y: 50, 'font-weight': 700 }, 'Queue (front on the right)'),
            ...f.q.slice().reverse().map((j, k) => s('g', {}, s('rect', { x: 30 + k * 100, y: 80, width: 80, height: 60, rx: 10, class: 's-proc', 'stroke-width': 2 }), s('text', { x: 70 + k * 100, y: 118, 'text-anchor': 'middle', 'font-weight': 800 }, j))),
            s('line', { x1: 345, y1: 110, x2: 450, y2: 110, class: 's-line', 'marker-end': 'url(#arr)' }),
            s('rect', { x: 460, y: 50, width: 220, height: 120, rx: 14, class: 's-io', 'stroke-width': 2 }),
            s('text', { x: 570, y: 40, 'text-anchor': 'middle', 'font-weight': 700 }, 'Printer'),
            s('text', { x: 570, y: 118, 'text-anchor': 'middle', 'font-size': 22, 'font-weight': 800 }, f.printing ? 'printing ' + f.printing : 'idle'),
          );
        }
        // 2) create the player: render(i) redraws state i from scratch and returns the caption
        const player = ctx.ui.player({ count: frames.length, render: (i) => { draw(frames[i]); return frames[i].cap; }, interval: 1800 });
        el.append(h('div', { class: 'stack fill' }, h('div', { class: 'card white grow', style: { display: 'grid', placeItems: 'center' } }, svg), player.el));
      },
    },

    /* ---------------- 3. Live parameter exploration with sliders + tabs ---------------- */
    {
      title: 'Experiment: how fast does the queue drain?',
      kind: 'explore',
      render(el, ctx) {
        const { h } = ctx;
        const out = h('div', { class: 'big' });
        const note = h('p', { class: 'muted' });
        let jobs = 6, secs = 10;
        const update = () => { out.textContent = jobs * secs + ' s'; note.innerHTML = `${jobs} jobs × ${secs} s each = <b>${jobs * secs} seconds</b> until the queue is empty. <span class="t">Throughput</span> is ${ctx.util.fmt(60 / secs, 1)} jobs per minute.`; };
        const s1 = ctx.ui.slider({ label: 'Jobs waiting', min: 1, max: 20, value: jobs, onInput: (v) => { jobs = v; update(); } });
        const s2 = ctx.ui.slider({ label: 'Seconds per job', min: 1, max: 60, value: secs, format: (v) => v + ' s', onInput: (v) => { secs = v; update(); } });
        const tabs = ctx.ui.tabs([
          { label: 'Result', render: (p) => { p.append(out, note); update(); } },
          { label: 'Explain', html: '<p>Total time grows <b>linearly</b>: twice the jobs means twice the wait. That is why a slow device needs a queue.</p>' },
          { label: 'Code', render: (p) => {
              const code = ctx.ui.code(`
while (true) {                 // the spooler runs forever
  job = queue.removeFront();   // take the oldest job (blocks if empty)
  printer.print(job);          // send it to the slow device
}`, { lang: 'c' });
              p.append(code);
              code.mark(2);        // highlight line 2
            } },
        ]);
        el.append(h('div', { class: 'split l fill' }, h('div', { class: 'stack' }, s1, s2, ctx.ui.reveal('Show a hint', '<p class="small">Multiply the two sliders.</p>')), tabs));
      },
    },

    /* ---------------- 4. Recap with flip cards ---------------- */
    {
      title: 'Recap: the three ideas to remember',
      kind: 'recap',
      render(el, ctx) {
        el.append(ctx.h('div', { class: 'stack fill' },
          ctx.h('p', { class: 'lead' }, 'Click each card to reveal the answer. Try to say it before you flip.'),
          ctx.ui.flipcards([
            ['What order does a queue use?', 'First in, first out (FIFO).'],
            ['Who feeds the printer?', 'The spooler, part of the OS.'],
            ['Why not let programs wait?', 'They would sit idle while the slow printer works.'],
          ], { cols: 3, height: 130 })));
      },
    },

    /* ---------------- 5. Quiz: every supported question type ---------------- */
    {
      title: 'Check yourself',
      kind: 'check',
      quiz: [
        { q: 'Which job prints first?', choices: ['The newest job', 'The oldest job', 'The shortest job', 'A random job'], answer: 1,
          feedback: ['Newest-first is a stack (LIFO), not a queue.', null, 'That is a different scheduling policy.', 'The spooler is not random.'],
          why: 'A queue is first-in, first-out, so the oldest waiting job goes next.' },
        { type: 'tf', q: 'The spooler busy-waits while the queue is empty.', answer: false, why: 'It sleeps (blocks) until a job arrives, so it uses no CPU time.' },
        { type: 'multi', q: 'Which are benefits of spooling?', choices: ['Programs do not wait for the printer', 'Jobs never interleave pages', 'The printer becomes faster', 'Many programs can submit work at once'], answer: [0, 1, 3], why: 'Spooling hides the printer’s slowness and serializes jobs; it cannot make the printer faster.' },
        { type: 'order', q: 'Put the life of a print job in order.', items: ['Program submits job', 'Job waits in queue', 'Spooler sends job to printer', 'Printer finishes job'], why: 'Submit, wait, send, finish.' },
        { type: 'match', q: 'Match each part to its role.', pairs: [['Queue', 'Holds waiting jobs'], ['Spooler', 'Feeds jobs to the device'], ['Printer', 'Slow I/O device']], why: 'Each part does one job.' },
        { type: 'bucket', q: 'Hardware or software?', buckets: ['Hardware', 'Software'], items: [['Printer', 0], ['Spooler', 1], ['Print queue', 1], ['USB cable', 0]], why: 'Physical devices are hardware; programs and data structures are software.' },
        { type: 'num', q: '8 jobs, 15 seconds each. How many seconds until the queue is empty?', answer: 120, unit: 's', why: '8 × 15 = 120 seconds.' },
      ],
    },
  ],

  /* Static study notes: shown in the Notes drawer (N) and printed in the PDF study guide.
     Plain HTML, no scripts. Use h3/h4, p, ul, table, and optional small inline SVG. */
  notes: `
    <h3>Print queues and spooling</h3>
    <p>A printer can do one job at a time, so the OS keeps a <b>queue</b> of print jobs and a <b>spooler</b> feeds them to the printer in first-in, first-out order.</p>
    <ul><li>Programs hand off output instantly and keep running.</li><li>Total drain time = jobs × time per job.</li></ul>`,
});
