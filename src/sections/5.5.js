/* =====================================================================
   Section 5.5 — Monitors
   A monitor packages shared data with the only procedures allowed to use
   it, and gives mutual exclusion automatically. Condition variables
   (cwait / csignal, or cnotify / cbroadcast in Mesa style) let processes
   wait inside it. Helpers shared by several steps live in this IIFE.
   ===================================================================== */
(() => {
  /* ---------- helper 1: the monitor "building" used by the live lab and the Hoare/Mesa replay ----------
     st = { buf:[3 slots], nextin, nextout, count, inside:id|null, entry:[], urgent:[], notfull:[], notempty:[],
            done:[], labels:{id:text}, warn:[ids], bad:[ids], lost:'notfull'|'notempty'|null,
            mode:'hoare'|'mesa', activity:'text under the running process' }
     Process ids start with P (producer) or C (consumer). Chips glide between rooms (CSS transition). */
  const NSLOT = 3;
  function makeStage(ctx) {
    const { s } = ctx;
    const svg = s('svg', { viewBox: '0 0 620 362', width: '100%', role: 'img', 'aria-label': 'A monitor drawn as a building: entrance queue, one running process, urgent queue and two condition queues' });
    const T = (x, y, str, a) => s('text', Object.assign({ x, y, 'font-size': 13 }, a || {}), str);
    const B = (x, y, w, ht, cls, a) => s('rect', Object.assign({ x, y, width: w, height: ht, rx: 10, class: cls, 'stroke-width': 1.5 }, a || {}));
    const slotR = [], slotT = [], ptrT = [];
    const dataG = s('g');
    for (let i = 0; i < NSLOT; i++) {
      slotR.push(B(160 + i * 56, 58, 50, 36, 's-panel', { rx: 7 }));
      slotT.push(T(185 + i * 56, 83, '', { 'text-anchor': 'middle', 'font-size': 19, 'font-weight': 800, class: 's-monot' }));
      ptrT.push(T(185 + i * 56, 128, '', { 'text-anchor': 'middle', 'font-weight': 800, style: 'fill:var(--mem)' }));
      dataG.append(slotR[i], slotT[i], T(185 + i * 56, 110, '[' + i + ']', { 'text-anchor': 'middle', class: 's-sub' }), ptrT[i]);
    }
    const countT = T(346, 90, '0', { 'font-size': 30, 'font-weight': 800 });
    const inT = T(346, 112, '', { class: 's-sub' });
    const outT = T(346, 128, '', { class: 's-sub' });
    const urgG = s('g', {}, B(462, 34, 142, 106, 's-warn'), T(472, 51, 'urgent queue', { 'font-weight': 700 }), T(472, 67, 'signalers wait here', { class: 's-sub' }));
    const urgNote = T(533, 130, '', { 'text-anchor': 'middle', class: 's-sub' });
    const actT = T(253, 234, '', { 'text-anchor': 'middle', class: 's-sub' });
    const lostNF = T(362, 344, '', { 'text-anchor': 'end', 'font-weight': 800, style: 'fill:var(--bad)' });
    const lostNE = T(594, 344, '', { 'text-anchor': 'end', 'font-weight': 800, style: 'fill:var(--bad)' });
    const more = { entry: T(66, 346, '', { 'text-anchor': 'middle', class: 's-sub' }), notfull: T(160, 344, '', { class: 's-sub' }), notempty: T(394, 344, '', { class: 's-sub' }) };
    svg.append(
      B(136, 6, 478, 350, 's-panel', { rx: 16, 'stroke-width': 2.5 }),
      s('rect', { x: 129, y: 176, width: 14, height: 36, class: 'm5-door' }),
      T(150, 25, 'monitor boundedbuffer', { 'font-weight': 800, 'font-size': 15 }), T(346, 25, '(N = 3 slots)', { class: 's-sub' }),
      T(66, 150, 'entrance', { 'text-anchor': 'middle', 'font-weight': 700 }),
      T(66, 166, 'queue', { 'text-anchor': 'middle', 'font-weight': 700 }),
      s('line', { x1: 99, y1: 194, x2: 134, y2: 194, class: 's-line', 'marker-end': 'url(#arr)' }),
      B(150, 34, 300, 106, 's-mem'), T(160, 51, 'local data: buffer', { 'font-weight': 700 }), dataG,
      T(346, 51, 'count', { 'font-weight': 700 }), countT, inT, outT,
      urgG, urgNote,
      B(150, 150, 206, 92, 's-cpu'), T(160, 167, 'inside (one at a time)', { 'font-weight': 700 }), actT,
      B(368, 150, 236, 92, 's-panel', { 'stroke-dasharray': '6 4' }), T(378, 167, 'left the monitor', { 'font-weight': 700 }),
      B(150, 252, 222, 100, 's-os'), T(160, 269, 'cond notfull', { 'font-weight': 700 }), T(160, 285, 'producers wait here', { class: 's-sub' }),
      B(384, 252, 220, 100, 's-os'), T(394, 269, 'cond notempty', { 'font-weight': 700 }), T(394, 285, 'consumers wait here', { class: 's-sub' }),
      lostNF, lostNE, more.entry, more.notfull, more.notempty,
    );
    const layer = s('g');
    svg.append(layer);
    const chips = new Map();
    function chipEl(id) {
      let c = chips.get(id);
      if (c) return c;
      const txt = s('text', { x: 30, y: 20, 'text-anchor': 'middle' }, id);
      const g = s('g', { class: 'm5-chip m5-now m5-' + id[0] }, s('rect', { width: 60, height: 30, rx: 8 }), txt);
      c = { g, txt, fresh: true };
      chips.set(id, c);
      layer.append(g);
      return c;
    }
    function set(st, opt) {
      opt = opt || {};
      for (let i = 0; i < NSLOT; i++) {
        const v = st.buf[i];
        slotT[i].textContent = v == null ? '' : v;
        slotR[i].setAttribute('class', v == null ? 's-panel' : 's-mem');
        const tags = [];
        if (st.nextin === i) tags.push('in');
        if (st.nextout === i) tags.push('out');
        ptrT[i].textContent = tags.length ? '↑' + tags.join('/') : '';
      }
      countT.textContent = st.count;
      countT.style.fill = st.count < 0 || st.count > NSLOT ? 'var(--bad)' : '';
      inT.textContent = 'nextin = ' + st.nextin;
      outT.textContent = 'nextout = ' + st.nextout;
      const pos = new Map();
      const put = (arr, max, fx) => (arr || []).forEach((id, i) => pos.set(id, fx(Math.min(i, max - 1)).concat(i < max)));
      put(st.entry, 4, (i) => [36, 179 + i * 38]);
      if (st.inside) pos.set(st.inside, [223, 184, true]);
      put(st.urgent, 2, (i) => [472 + i * 66, 78]);
      put(st.notfull, 3, (i) => [160 + i * 68, 296]);
      put(st.notempty, 3, (i) => [394 + i * 68, 296]);
      const done = st.done || [];
      done.forEach((id, i) => { const j = i - (done.length - 3); pos.set(id, j >= 0 ? [378 + j * 74, 184, true] : [378, 184, false]); });
      for (const [id, p] of pos) {
        const c = chipEl(id);
        if (c.fresh && opt.slideIn) { c.g.style.transform = `translate(-70px, ${p[1]}px)`; c.g.getBoundingClientRect(); c.g.classList.remove('m5-now'); }
        c.fresh = false;
        c.g.style.transform = `translate(${p[0]}px, ${p[1]}px)`;
        c.g.style.opacity = p[2] ? 1 : 0;
        c.txt.textContent = (st.labels && st.labels[id]) || id;
        c.g.classList.toggle('m5-warn', !!(st.warn && st.warn.includes(id)));
        c.g.classList.toggle('m5-bad', !!(st.bad && st.bad.includes(id)));
      }
      for (const [id, c] of chips) if (!pos.has(id)) c.g.style.opacity = 0;
      ctx.after(60, () => chips.forEach((c) => c.g.classList.remove('m5-now')));
      const cnt = (a, max) => (a && a.length > max ? '+' + (a.length - max) + ' more' : '');
      more.entry.textContent = cnt(st.entry, 4);
      more.notfull.textContent = cnt(st.notfull, 3);
      more.notempty.textContent = cnt(st.notempty, 3);
      const mesa = st.mode === 'mesa';
      urgG.classList.toggle('m5-dim', mesa);
      urgNote.textContent = mesa ? 'not used in Mesa' : cnt(st.urgent, 2);
      lostNF.textContent = st.lost === 'notfull' ? 'signal lost!' : '';
      lostNE.textContent = st.lost === 'notempty' ? 'signal lost!' : '';
      actT.textContent = st.activity != null ? st.activity : st.inside ? '' : 'empty: next one may enter';
    }
    return { svg, set };
  }
  /* ---------- helper 3: phones. A wide diagram keeps a readable size and scrolls sideways inside its card
     (the same way code listings do) instead of shrinking its labels to a few pixels. ---------- */
  function wide(ctx, svg, minW) {
    if (!ctx.narrow) return svg;
    svg.style.minWidth = minW + 'px';
    svg.style.maxWidth = 'none';
    return ctx.h('div', { class: 'm5-widewrap' }, ctx.h('div', { class: 'm5-wide' }, svg), ctx.h('div', { class: 'xs muted center' }, 'Swipe the diagram sideways to see all of it.'));
  }
  const emptyState = (mode) => ({ buf: [null, null, null], nextin: 0, nextout: 0, count: 0, inside: null, entry: [], urgent: [], notfull: [], notempty: [], done: [], labels: {}, warn: [], bad: [], lost: null, mode: mode || 'hoare', activity: null });

  /* ---------- helper 2: the bounded-buffer procedures as a listing (every line commented) ----------
     style: 'hoare' (if + csignal) | 'mesa-if' (if + cnotify) | 'mesa-while' (while + cnotify).
     Line map: append() is lines 1-7, take() is lines 8-14; statement k of a procedure is line header+k. */
  function bbSource(style) {
    const mesa = style !== 'hoare';
    const w = style === 'mesa-while';
    const test = w ? 'while' : 'if';
    const sig = mesa ? 'cnotify' : 'csignal';
    const rows = [
      ['void append(char x) {', '// a producer enters'],
      [`  ${test} (count == N) cwait(notfull);`, w ? '// re-test on waking' : '// full? then sleep'],
      ['  buffer[nextin] = x;', '// store the item'],
      ['  nextin = (nextin + 1) % N;', '// advance, wrap at N'],
      ['  count++;', '// one more item'],
      [`  ${sig}(notempty);`, mesa ? '// hint a consumer' : '// wake a consumer'],
      ['}', '// leave the monitor'],
      ['void take(char &x) {', '// a consumer enters'],
      [`  ${test} (count == 0) cwait(notempty);`, w ? '// re-test on waking' : '// empty? then sleep'],
      ['  x = buffer[nextout];', '// copy oldest item'],
      ['  nextout = (nextout + 1) % N;', '// advance, wrap at N'],
      ['  count--;', '// one fewer item'],
      [`  ${sig}(notfull);`, mesa ? '// hint a producer' : '// wake a producer'],
      ['}', '// leave the monitor'],
    ];
    const pad = w ? 38 : 35;
    return rows.map(([c, k]) => c.padEnd(pad) + k).join('\n');
  }

  Guide.section({
    id: '5.5',
    title: 'Monitors',
    short: 'Monitors',
    summary: 'A language construct that gives mutual exclusion for free and lets processes wait on condition variables.',
    objectives: [
      'Explain why monitors were invented as a safer, language-level alternative to semaphore calls scattered through a program.',
      'Describe the parts of a monitor (local data, procedures, initialization) and its entrance, condition and urgent queues.',
      'Use cwait and csignal on condition variables, and explain why a signal sent when nobody waits is lost.',
      'Trace the bounded-buffer producer/consumer solution written as a monitor, line by line.',
      'Compare Hoare monitors (csignal) with Lampson/Redell Mesa monitors (cnotify, cbroadcast, watchdog timers), including why Mesa code re-tests with while.',
    ],
    terms: [
      ['Monitor', 'A programming-language construct that bundles shared data with the only procedures allowed to touch it, and guarantees that at most one process is executing inside those procedures at any moment.'],
      ['Condition variable', 'A named waiting line inside a monitor. A process that cannot continue waits on it with cwait; another process wakes it with csignal (or cnotify / cbroadcast). It stores no count and no value.'],
      ['cwait', 'cwait(c): the calling process always suspends itself on condition c and gives up the monitor, so another process may enter.'],
      ['csignal', 'csignal(c): resume one process that is waiting on condition c. If no process is waiting, nothing happens: the signal is lost.'],
      ['Entrance queue', 'The line of processes that have called a monitor procedure but must wait outside because another process is already inside.'],
      ['Condition queue', 'The line of processes suspended on one particular condition variable, waiting to be signaled.'],
      ['Urgent queue', 'In a Hoare monitor, the place where a process that issued csignal, and still has work to do inside, waits after handing the monitor to the process it woke. It gets back in before any newcomer from the entrance queue.'],
      ['Hoare monitor', 'The original monitor rules: csignal hands the monitor at once to the woken process, so the condition it waited for is guaranteed to still be true when it resumes.'],
      ['Mesa monitor', 'The Lampson and Redell rules, first used in the Mesa language: cnotify only makes a waiter ready, the notifier keeps running, and the waiter must re-test its condition with a while loop.'],
      ['cnotify', 'cnotify(x): tell one process waiting on condition x that its condition may now hold. It resumes at some convenient later time while the notifier carries on.'],
      ['cbroadcast', 'cbroadcast(x): make every process waiting on condition x ready. Each one re-tests its own condition when it gets the monitor.'],
      ['Watchdog timer', 'A time limit on a wait. If a waiting process is not notified in time, it is made ready anyway and re-tests its condition, so a missing notify cannot strand it forever.'],
      ['Lost signal', 'A csignal sent when no process is waiting on that condition. The monitor keeps no record of it, whereas a semaphore remembers a signal by increasing its count.'],
      ['Bounded buffer', 'A shared store with a fixed number of slots, filled by producers and emptied by consumers. Producers must wait when it is full, consumers when it is empty.'],
      ['Semaphore', 'An integer used for signaling between processes that is changed only by the atomic operations semWait (decrement, maybe block) and semSignal (increment, maybe unblock).'],
      ['Mutual exclusion', 'The guarantee that while one process is using a shared resource or critical section, no other process can be using it.'],
      ['Deadlock', 'A permanent standstill: each process in a group is waiting (blocked or spinning) for something that only another waiting member of the group can provide.'],
      ['Process switch', 'Taking the processor away from one process and giving it to another. It costs time to save one process’s state and restore the other’s.'],
    ],

    css: `
      .sec-5-5 .m5-chip { transition: transform .55s cubic-bezier(.3,.7,.2,1), opacity .35s; }
      .sec-5-5 .m5-chip.m5-now { transition: none; }
      .sec-5-5 .m5-chip rect { stroke-width: 2; }
      .sec-5-5 .m5-chip text { font-weight: 800; font-size: 14px; }
      .sec-5-5 .m5-P rect { fill: var(--proc-bg); stroke: var(--proc); }
      .sec-5-5 .m5-C rect { fill: var(--accent-bg); stroke: var(--accent); }
      .sec-5-5 .m5-chip.m5-warn rect { fill: var(--warn-bg); stroke: var(--warn); stroke-dasharray: 5 3; }
      .sec-5-5 .m5-chip.m5-bad rect { fill: var(--bad-bg); stroke: var(--bad); stroke-width: 3; }
      .sec-5-5 .m5-door { fill: var(--panel); stroke: none; }
      .sec-5-5 .m5-dim { opacity: .35; }
      .sec-5-5 .hot { cursor: pointer; fill: transparent; stroke: transparent; stroke-width: 3; }
      .sec-5-5 .hot:hover { stroke: var(--chc); stroke-dasharray: 6 4; }
      .sec-5-5 .hot.on { stroke: var(--chc); fill: color-mix(in srgb, var(--chc) 10%, transparent); }
      .sec-5-5 pre.code .ln.clickable { cursor: pointer; }
      .sec-5-5 pre.code .ln.clickable:hover { background: var(--panel-2); }
      .sec-5-5 .m5-rule { transition: background .2s, border-color .2s; }
      .sec-5-5 .m5-rule.on { border-color: var(--chc); background: color-mix(in srgb, var(--chc) 12%, var(--panel)); }
      .sec-5-5 .m5-info h4 { color: var(--chc); }
      .sec-5-5 .m5-row { display: grid; grid-template-columns: 124px minmax(0, 1fr); align-items: center; min-height: 34px; gap: 8px; }
      .sec-5-5 .m5-q .chip { font-size: 14px; padding: 3px 11px; }
      .sec-5-5 .m5-log { height: 112px; font-size: 13px; }
      .sec-5-5 .m5-bar { flex: none; display: flex; height: 46px; border-radius: 10px; overflow: hidden; border: 1px solid var(--line-2); background: var(--panel-3); }
      .sec-5-5 .m5-bar > div { display: grid; place-items: center; font-size: 13px; font-weight: 800; white-space: nowrap; overflow: hidden; transition: flex-basis .45s ease; border-right: 2px solid var(--panel); }
      .sec-5-5 .m5-bar .oth { background: var(--panel-3); color: var(--muted); }
      .sec-5-5 .m5-bar .fr { background: var(--mem-bg); color: var(--mem); }
      .sec-5-5 .m5-bar .fh { background: var(--io-bg); color: var(--io); }
      .sec-5-5 .m5-bar .rq { background: var(--proc-bg); color: var(--proc); }
      .sec-5-5 .m5-req { border: 2px solid var(--line); transition: border-color .25s, background .25s; }
      .sec-5-5 .m6-key { display: inline-block; width: 20px; height: 14px; border-radius: 4px; border: 1.5px solid var(--line-2); }
      .sec-5-5 .m6-key.proc { background: var(--proc-bg); border-color: var(--proc); }
      .sec-5-5 .m6-key.accent { background: var(--accent-bg); border-color: var(--accent); }
      .sec-5-5 .m6-key.bad { background: var(--bad-bg); border-color: var(--bad); }
      .sec-5-5 .m6-key.panel { background: var(--panel-2); border-color: var(--line-2); }
      .sec-5-5 .m5-widewrap { width: 100%; }
      .sec-5-5 .m5-wide { width: 100%; overflow-x: auto; overflow-y: hidden; contain: inline-size; -webkit-overflow-scrolling: touch; }
      .sec-5-5 .m5-req.focus { border-color: var(--chc); background: color-mix(in srgb, var(--chc) 8%, var(--panel)); }
    `,

    steps: [
      /* ---------------- 1. Big picture: why monitors ---------------- */
      {
        title: 'Why monitors? Semaphores leave too much to chance',
        kind: 'story',
        render(el, ctx) {
          const { h, s } = ctx;
          const left = ctx.frag(`
            <div class="stack">
              <p class="lead m0">A <span class="t">semaphore</span> can solve any synchronization problem, but it trusts every process to call <code>semWait</code> and <code>semSignal</code> in exactly the right places.</p>
              <p class="m0">Those calls end up scattered across many processes. Swap two, or forget one, and the program can <span class="t">deadlock</span> or corrupt data, often only on rare, unlucky timings. Finding the bug means reading every process that touches the shared data.</p>
              <p class="m0">A <span class="t">monitor</span> moves the job into the programming language. The shared data and every procedure allowed to touch it live in one module, and the language itself guarantees <span class="t">mutual exclusion</span>: one process inside at a time. It is as powerful as semaphores, and far easier to keep under control.</p>
              <div class="callout analogy m0" data-label="Analogy">A records office with one service window. The files stay behind the counter, you may only ask for the services on the list, the clerk serves one visitor at a time, and everyone else lines up at the door.</div>
            </div>`);
          const svg = s('svg', { viewBox: '0 0 600 330', width: '100%', role: 'img', 'aria-label': 'Where the synchronization code lives' });
          const cap = h('p', { class: 'small m0' });
          let view = 'sem', bug = false;
          const bugBtn = h('button', { class: 'btn sm', type: 'button', onclick: () => { bug = !bug; draw(); } });
          const seg = ctx.ui.seg([{ value: 'sem', label: 'With semaphores' }, { value: 'mon', label: 'With a monitor' }], view, (v) => { view = v; draw(); });
          const T = (x, y, str, a) => s('text', Object.assign({ x, y, 'font-size': 13 }, a || {}), str);
          const procs = [
            { x: 10, y: 8, name: 'Producer A', P: true }, { x: 10, y: 186, name: 'Producer B', P: true },
            { x: 410, y: 8, name: 'Consumer A', P: false }, { x: 410, y: 186, name: 'Consumer B', P: false },
          ];
          function draw() {
            const mon = view === 'mon';
            const kids = [];
            procs.forEach((p, k) => {
              let lines;
              if (mon) lines = p.P ? ['produce(x);', 'append(x);'] : ['take(x);', 'consume(x);'];
              else lines = p.P ? ['produce(x);', 'semWait(e);', 'semWait(s);', 'append(x);', 'semSignal(s);', 'semSignal(n);'] : ['semWait(n);', 'semWait(s);', 'take(x);', 'semSignal(s);', 'semSignal(e);', 'consume(x);'];
              const swapped = !mon && bug && k === 3;
              if (swapped) lines = ['semWait(s);', 'semWait(n);'].concat(lines.slice(2));
              kids.push(s('rect', { x: p.x, y: p.y, width: 180, height: 136, rx: 12, class: swapped ? 's-bad' : 's-proc', 'stroke-width': 2 }));
              kids.push(T(p.x + 12, p.y + 20, p.name, { 'font-weight': 800 }));
              lines.forEach((ln, j) => {
                const sync = /^sem/.test(ln);
                const style = swapped && j < 2 ? 'fill:var(--bad)' : sync ? 'fill:var(--warn)' : '';
                kids.push(T(p.x + 14, p.y + 42 + j * 16, ln, { class: 's-monot', 'font-weight': sync ? 800 : 400, style }));
              });
              if (mon) kids.push(T(p.x + 14, p.y + 104, 'no synchronization', { class: 's-sub' }), T(p.x + 14, p.y + 120, 'code in here', { class: 's-sub' }));
            });
            const ends = [[190, 76], [190, 254], [410, 76], [410, 254]];
            if (mon) {
              kids.push(s('rect', { x: 215, y: 58, width: 170, height: 214, rx: 14, class: 's-accent', 'stroke-width': 2.5 }),
                T(300, 82, 'monitor', { 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 15 }),
                s('rect', { x: 232, y: 94, width: 136, height: 38, rx: 8, class: 's-mem', 'stroke-width': 1.5 }),
                T(300, 118, 'buffer + count', { 'text-anchor': 'middle', 'font-weight': 700 }),
                T(300, 158, 'append()   take()', { 'text-anchor': 'middle', class: 's-monot', 'font-weight': 700, style: 'fill:var(--cpu)' }),
                T(300, 184, 'cwait / csignal', { 'text-anchor': 'middle', class: 's-monot', 'font-weight': 700, style: 'fill:var(--os)' }),
                T(300, 222, 'one process', { 'text-anchor': 'middle', class: 's-sub' }), T(300, 238, 'inside at a time', { 'text-anchor': 'middle', class: 's-sub' }),
                T(300, 30, '0 sync calls in the processes', { 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 14, style: 'fill:var(--ok)' }),
                T(300, 312, 'All of it lives in 1 module', { 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 14 }));
              ends.forEach(([x, y]) => kids.push(s('line', { x1: x, y1: y, x2: x < 300 ? 213 : 387, y2: y < 150 ? 130 : 200, class: 's-line', 'marker-end': 'url(#arr)' })));
            } else {
              kids.push(s('rect', { x: 225, y: 118, width: 150, height: 78, rx: 12, class: 's-mem', 'stroke-width': 2 }),
                T(300, 150, 'shared buffer', { 'text-anchor': 'middle', 'font-weight': 800 }),
                T(300, 172, 'semaphores s, n, e', { 'text-anchor': 'middle', class: 's-sub' }),
                T(300, 30, '16 sync calls in 4 places', { 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 14, style: 'fill:var(--warn)' }),
                T(300, 312, bug ? 'Now it can deadlock' : 'Every one must be right', { 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 14, style: bug ? 'fill:var(--bad)' : '' }));
              ends.forEach(([x, y]) => kids.push(s('line', { x1: x, y1: y, x2: x < 300 ? 223 : 377, y2: y < 150 ? 140 : 176, class: 's-line', 'marker-end': 'url(#arr)' })));
            }
            svg.replaceChildren(...kids);
            bugBtn.textContent = bug ? 'Undo the bug' : 'Inject a typical bug';
            bugBtn.classList.toggle('danger', !bug);
            if (mon) cap.innerHTML = bug
              ? '<b>Nothing to break here.</b> The callers contain no synchronization calls to misplace. The monitor’s code is written and checked once, in one place, and every caller is safe.'
              : '<b>Monitor version.</b> Processes just call <code>append</code> and <code>take</code>. Taking turns and waiting are handled inside the monitor, so there is one place to write, read and verify the synchronization.';
            else cap.innerHTML = bug
              ? '<b>One swapped pair in Consumer B.</b> It now grabs <code>s</code> before checking <code>n</code>. If the buffer is empty it sleeps on <code>n</code> while holding <code>s</code>, so no producer can get in to add an item: deadlock. Nothing in the other three processes hints at the mistake.'
              : '<b>Semaphore version.</b> <code>s</code> guards the buffer, <code>n</code> counts items, <code>e</code> counts empty slots. Each process carries 4 of these calls (highlighted), 16 in all, and the program is correct only if every one is present and in the right order.';
          }
          draw();
          el.append(h('div', { class: 'split l fill' }, left, h('div', { class: 'card white stack' }, h('div', { class: 'row' }, seg, bugBtn), wide(ctx, svg, 560), cap,
            ctx.frag('<div class="row gap-s"><span class="xs b muted">BUILT INTO</span><span class="chip os">Concurrent Pascal</span><span class="chip os">Pascal-Plus</span><span class="chip os">Modula-2</span><span class="chip os">Modula-3</span><span class="chip os">Java</span></div>'))));
        },
      },
      /* ---------------- 2. Anatomy: clickable monitor diagram ---------------- */
      {
        title: 'Inside a monitor: data, procedures and queues',
        kind: 'explore',
        render(el, ctx) {
          const { h, s } = ctx;
          const svg = s('svg', { viewBox: '0 0 640 480', width: '100%', role: 'img', 'aria-label': 'The parts of a monitor' });
          const T = (x, y, str, a) => s('text', Object.assign({ x, y, 'font-size': 13 }, a || {}), str);
          const R = (x, y, w, ht, cls, a) => s('rect', Object.assign({ x, y, width: w, height: ht, rx: 10, class: cls, 'stroke-width': 1.5 }, a || {}));
          const chip = (x, y, id) => s('g', { transform: `translate(${x},${y})`, class: 'm5-chip m5-P' }, s('rect', { width: 60, height: 30, rx: 8 }), s('text', { x: 30, y: 20, 'text-anchor': 'middle' }, id));
          const B = { 'font-weight': 700 };
          svg.append(
            R(150, 8, 370, 464, 's-panel', { rx: 18, 'stroke-width': 2.5 }),
            s('rect', { x: 144, y: 226, width: 12, height: 36, class: 'm5-door' }),
            T(166, 32, 'monitor', { 'font-weight': 800, 'font-size': 15 }),
            T(72, 190, 'entrance', Object.assign({ 'text-anchor': 'middle' }, B)), T(72, 206, 'queue', Object.assign({ 'text-anchor': 'middle' }, B)),
            chip(42, 229, 'P5'), chip(42, 267, 'P6'),
            s('line', { x1: 104, y1: 244, x2: 146, y2: 244, class: 's-line', 'marker-end': 'url(#arr)' }),
            R(168, 44, 334, 64, 's-mem'), T(180, 68, 'local data', B), T(180, 90, 'shared variables, private to the monitor', { class: 's-sub' }),
            R(168, 118, 334, 42, 's-os'), T(180, 144, 'condition c1', B), T(290, 144, 'cwait(c1)', { class: 's-monot s-sub' }), chip(430, 124, 'P2'),
            T(335, 177, '⋮', { 'text-anchor': 'middle', 'font-size': 16, class: 's-sub' }),
            R(168, 182, 334, 42, 's-os'), T(180, 208, 'condition cn', B), T(290, 208, 'cwait(cn)', { class: 's-monot s-sub' }), chip(430, 188, 'P3'),
            R(168, 236, 334, 118, 's-cpu'), T(180, 256, 'procedures: the only way in', B),
            R(180, 266, 100, 30, 's-panel', { rx: 7 }), T(230, 286, 'procedure 1', { 'text-anchor': 'middle' }),
            R(288, 266, 100, 30, 's-panel', { rx: 7 }), T(338, 286, 'procedure 2', { 'text-anchor': 'middle' }),
            R(396, 266, 94, 30, 's-panel', { rx: 7 }), T(443, 286, '… proc k', { 'text-anchor': 'middle' }),
            chip(180, 310, 'P1'), T(252, 330, 'P1 is running (only one inside)', { class: 's-sub' }),
            R(168, 366, 334, 40, 's-panel'), T(180, 391, 'initialization code', B), T(320, 391, 'runs once, at creation', { class: 's-sub' }),
            R(168, 418, 334, 44, 's-warn'), T(180, 445, 'urgent queue', B), T(280, 445, 'signalers wait', { class: 's-sub' }), chip(430, 425, 'P4'),
            s('line', { x1: 522, y1: 295, x2: 610, y2: 295, class: 's-line', 'marker-end': 'url(#arr)' }), T(566, 284, 'exit', Object.assign({ 'text-anchor': 'middle' }, B)),
          );
          const parts = [
            { r: [18, 172, 116, 134], rule: [2], t: 'Entrance queue', d: 'Processes that called a monitor procedure while another process was already inside. They are blocked here, in arrival order, until the monitor is free. This line is how rule 3 is enforced.' },
            { r: [162, 40, 346, 72], rule: [0], t: 'Local data', d: 'The shared variables the monitor protects, for example a buffer, its indexes and an item count. Outside code cannot even name them, so the only way to touch them is through a procedure, and therefore always under the monitor’s mutual exclusion.' },
            { r: [162, 114, 346, 114], rule: [], t: 'Condition queues', d: 'Each <span class="t">condition variable</span> has its own <span class="t">condition queue</span>. A process that cannot go on (say, the buffer is empty) calls <code>cwait(c1)</code>: it joins that queue and gives up the monitor so another process can enter. A later <code>csignal(c1)</code> resumes one of them. Waiting here does not count as being inside.' },
            { r: [162, 232, 346, 126], rule: [1, 2], t: 'Procedures', d: 'The monitor’s public entry points, such as <code>append</code> and <code>take</code>. Calling one is the only way in (rule 2). P1 is executing one right now, so it is the only process inside (rule 3); every other process is waiting in some queue.' },
            { r: [162, 362, 346, 48], rule: [0], t: 'Initialization code', d: 'Code that runs once, when the monitor is created, to put the local data into a correct starting state: for example <code>count = 0</code> and both buffer indexes at slot 0.' },
            { r: [162, 414, 346, 54], rule: [], t: 'Urgent queue', d: 'Used by the original (Hoare) monitor. When a process calls <code>csignal</code> and someone is waiting, the woken process must run next, so a signaler that still has work to do steps aside into the <span class="t">urgent queue</span>. (If <code>csignal</code> was its last statement it can simply leave.) When the monitor frees up, processes here get back in before anyone from the entrance queue.' },
            { r: [524, 262, 104, 64], rule: [], t: 'Exit', d: 'A process leaves when its procedure returns. The monitor is then free and the next process is admitted: first from the urgent queue, otherwise from the <span class="t">entrance queue</span>.' },
          ];
          const rules = [
            ['Private data', 'Its local data can be read or changed only by the monitor’s own procedures, never directly by outside code.'],
            ['One way in', 'A process enters the monitor only by calling one of its procedures.'],
            ['One at a time', 'Only one process may be executing inside the monitor at any moment. Other callers wait.'],
          ];
          const ruleEls = rules.map(([a, b], i) => h('div', { class: 'card tight m5-rule small', html: `<b>${i + 1} · ${a}.</b> ${b}` }));
          const info = h('div', { class: 'card m5-info grow' });
          const hots = parts.map((p, i) => s('rect', { x: p.r[0], y: p.r[1], width: p.r[2], height: p.r[3], rx: 12, class: 'hot', onclick: () => pick(i), onpointerdown: () => pick(i) }));
          svg.append(...hots);
          function pick(i) {
            hots.forEach((x, j) => x.classList.toggle('on', i === j));
            const p = parts[i];
            ruleEls.forEach((r, j) => r.classList.toggle('on', p.rule.includes(j)));
            info.innerHTML = `<h4>${p.t}</h4><p class="m0">${p.d}</p>`;
          }
          info.innerHTML = '<h4>Explore</h4><p class="m0">Click any part of the building on the left. Its job appears here, and the rule it enforces lights up above.</p><div class="callout why m0 mt small" data-label="Why it matters">Rule 3 gives you <span class="t">mutual exclusion</span> for free: no process ever writes a lock call around the shared data.</div>';
          el.append(h('div', { class: 'split r fill' },
            h('div', { class: 'card white', style: { display: 'grid', placeItems: 'center', padding: '6px 10px' } }, wide(ctx, svg, 560)),
            h('div', { class: 'stack' },
              h('p', { class: 'lead m0', html: 'A <span class="t">monitor</span> is a software module with three kinds of content, local data, procedures and start-up code, plus a few waiting lines. Three rules define it:' }),
              ...ruleEls, info)));
        },
      },
      /* ---------------- 3. cwait / csignal vs semWait / semSignal: the lost signal ---------------- */
      {
        title: 'cwait, csignal and the signal nobody hears',
        kind: 'compare',
        render(el, ctx) {
          const { h } = ctx;
          function side(title, ops) {
            const wait = h('div', { class: 'row gap-s m5-q' });
            const mem = h('div', { class: 'row gap-s' });
            const run = h('div', { class: 'row gap-s m5-q' });
            const log = h('div', { class: 'log m5-log' });
            const card = h('div', { class: 'card white stack gap-s' },
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { class: 'm0', html: title }), h('span', { class: 'small mono muted' }, ops)),
              h('div', { class: 'm5-row' }, h('span', { class: 'xs b muted' }, 'WAITING'), wait),
              h('div', { class: 'm5-row' }, h('span', { class: 'xs b muted' }, 'MEMORY'), mem),
              h('div', { class: 'm5-row' }, h('span', { class: 'xs b muted' }, 'RUNNING'), run),
              log);
            return { card, wait, mem, run, log };
          }
          const L = side('Monitor: condition <code>c</code>', 'cwait(c) · csignal(c)');
          const R = side('Semaphore <code>s</code> (starts at 0)', 'semWait(s) · semSignal(s)');
          const say = h('div', { class: 'card' });
          let mon, sem, n, lostFlash, gen = 0;   // gen: bumped to cancel a replay step still waiting to run
          function reset() {
            gen++;
            mon = { q: [], run: [] }; sem = { count: 0, q: [], run: [] }; n = 0; lostFlash = false;
            L.log.innerHTML = ''; R.log.innerHTML = '';
            say.innerHTML = '<b>Ready.</b> Each button does the same thing to both worlds at once. Press <b>Someone signals</b> while nobody is waiting, then <b>A process waits</b>, and compare.';
            paint();
          }
          const chips = (arr, cls) => (arr.length ? arr.slice(-5).map((id) => h('span', { class: 'chip ' + cls }, id)) : [h('span', { class: 'xs muted' }, 'none')]);
          function paint() {
            L.wait.replaceChildren(...chips(mon.q, 'proc'));
            R.wait.replaceChildren(...chips(sem.q, 'proc'));
            L.run.replaceChildren(...chips(mon.run, 'ok'));
            R.run.replaceChildren(...chips(sem.run, 'ok'));
            L.mem.replaceChildren(...[h('span', { class: 'b' }, 'none'), h('span', { class: 'xs muted' }, 'a condition stores nothing'),
              lostFlash ? h('span', { class: 'chip bad flash' }, 'signal lost!') : null].filter(Boolean));
            R.mem.replaceChildren(...[h('span', { class: 'b mono', style: { fontSize: '20px' } }, 'count = ' + sem.count),
              sem.count > 0 ? h('span', { class: 'chip ok' }, sem.count + ' signal' + (sem.count > 1 ? 's' : '') + ' saved') : null,
              sem.count < 0 ? h('span', { class: 'xs muted' }, 'negative: ' + -sem.count + ' blocked') : null].filter(Boolean));
            btnW.disabled = n >= 6;
          }
          const log = (side, html) => { side.log.append(h('div', { html })); side.log.scrollTop = side.log.scrollHeight; };
          function doWait() {
            if (n >= 6) return;
            const id = 'W' + (++n);
            lostFlash = false;
            mon.q.push(id);
            log(L, `${id}: cwait(c) → suspended (always)`);
            const before = sem.count;
            sem.count--;
            let passed = false;
            if (sem.count < 0) { sem.q.push(id); log(R, `${id}: semWait(s) → s = ${sem.count}, blocked`); }
            else { passed = true; sem.run.push(id); log(R, `${id}: semWait(s) → s = ${sem.count}, passes`); }
            say.innerHTML = passed
              ? `<b>${id}</b> waits in both worlds. The monitor suspends it: <span class="t">cwait</span> <b>always</b> blocks, and the earlier signal left no trace. The semaphore had ${before} saved signal${before > 1 ? 's' : ''}, so ${id} walks straight through.`
              : `<b>${id}</b> waits in both worlds and is suspended in both: no signal is saved anywhere. Now press <b>Someone signals</b>.`;
            paint();
          }
          function doSignal() {
            let mRes, sRes;
            if (mon.q.length) { mRes = mon.q.shift(); mon.run.push(mRes); log(L, `csignal(c) → resumes ${mRes}`); lostFlash = false; }
            else { mRes = null; log(L, 'csignal(c) → nobody waiting: lost'); lostFlash = true; }
            sem.count++;
            if (sem.count <= 0) { sRes = sem.q.shift(); sem.run.push(sRes); log(R, `semSignal(s) → s = ${sem.count}, wakes ${sRes}`); }
            else { sRes = null; log(R, `semSignal(s) → s = ${sem.count}, saved`); }
            if (mRes && sRes) say.innerHTML = `Someone was waiting, so both worlds wake a process (<b>${mRes}</b> / <b>${sRes}</b>). When a waiter exists, <span class="t">csignal</span> and semSignal behave alike.`;
            else if (!mRes) say.innerHTML = `A signal with <b>nobody waiting</b>. The monitor keeps no record, so it is a <span class="t" data-t="Lost signal">lost signal</span>. The semaphore saves it by raising its count to ${sem.count}; a later semWait will pass without blocking.`;
            else say.innerHTML = `The monitor wakes <b>${mRes}</b>, still suspended on c. In the semaphore world ${mRes} never blocked, so this signal is saved instead (count ${sem.count}).`;
            paint();
          }
          // a manual press takes over from a replay in progress, so its pending step is cancelled
          const btnW = h('button', { class: 'btn proc', type: 'button', onclick: () => { gen++; doWait(); } }, 'A process waits');
          const btnS = h('button', { class: 'btn intr', type: 'button', onclick: () => { gen++; doSignal(); } }, 'Someone signals');
          const demo = h('button', { class: 'btn sm', type: 'button', onclick: () => { reset(); doSignal(); const g = gen; ctx.after(900, () => { if (g === gen) doWait(); }); } }, 'Replay: signal, then wait');
          reset();
          el.append(h('div', { class: 'stack fill' },
            h('p', { class: 'm0', html: 'A <span class="t">condition variable</span> is a named waiting line inside the monitor. <code>cwait(c)</code> suspends the caller on <code>c</code> <b>and releases the monitor</b> so another process may enter; <code>csignal(c)</code> resumes one process waiting on <code>c</code>. How does that differ from a semaphore?' }),
            h('div', { class: 'grid-2' }, L.card, R.card),
            h('div', { class: 'row' }, btnW, btnS, h('button', { class: 'btn sm', type: 'button', onclick: reset }, 'Reset'), demo),
            h('div', { class: 'grid-2 grow' }, say,
              h('div', { class: 'callout warn m0', 'data-label': 'Common mistake', html: 'Treating <code>cwait</code> as a test. It has no value to check: it <b>always</b> suspends. So monitor code checks its own data first:<br><code>if (count == 0) cwait(notempty);</code>' }))));
        },
      },
      /* ---------------- 4. Code tour: the bounded-buffer monitor ---------------- */
      {
        title: 'The bounded buffer, written as a monitor',
        kind: 'learn',
        render(el, ctx) {
          const { h } = ctx;
          const MON = `
monitor boundedbuffer;                   // one module: data + code
char buffer[N];                          // N slots of shared storage
int nextin, nextout;                     // next slot to fill / empty
int count;                               // how many slots are full
cond notfull, notempty;                  // two waiting lines

void append(char x) {                    // producers call this
  if (count == N) cwait(notfull);        // full: sleep until space
  buffer[nextin] = x;                    // put item in its slot
  nextin = (nextin + 1) % N;             // move on, wrap to 0
  count++;                               // one more full slot
  csignal(notempty);                     // wake a waiting consumer
}                                        // return: leave monitor
void take(char &x) {                     // consumers call this
  if (count == 0) cwait(notempty);       // empty: sleep for an item
  x = buffer[nextout];                   // copy out oldest item
  nextout = (nextout + 1) % N;           // move on, wrap to 0
  count--;                               // one fewer full slot
  csignal(notfull);                      // wake a waiting producer
}                                        // return: leave monitor
{ nextin = 0; nextout = 0; count = 0; }  // runs once: start empty`;
          const PC = `
void producer() {             // each producer runs this
  char x;                     // the item it makes
  while (true) {              // repeat forever:
    produce(x);               //   make one (no monitor)
    append(x);                //   deposit via the monitor
  }                           // end of loop
}                             // end of producer
void consumer() {             // each consumer runs this
  char x;                     // the item it receives
  while (true) {              // repeat forever:
    take(x);                  //   fetch via the monitor
    consume(x);               //   use it (no monitor)
  }                           // end of loop
}                             // end of consumer`;
          const tours = {
            mon: [
              { l: [1], t: 'Declare the monitor', d: 'Everything down to the final block belongs to one module. Code outside can see only the procedure names <code>append</code> and <code>take</code>, nothing else.' },
              { l: [2, 3, 4], t: 'The local data', d: 'A <span class="t">bounded buffer</span> of N slots used as a ring. <code>nextin</code> is where the next item goes, <code>nextout</code> where the next item comes from, and <code>count</code> says how many slots are full. None of it is visible outside.' },
              { l: [5], t: 'Two condition variables', d: '<code>notfull</code> is where producers wait when there is no space; <code>notempty</code> is where consumers wait when there is nothing to take. They are waiting lines, not numbers.' },
              { l: [7], t: 'A producer enters', d: 'Calling <code>append(x)</code> is the only way in. If another process is already inside, the caller waits in the entrance queue first. That mutual exclusion is automatic: there is no <code>semWait</code> on a lock anywhere.' },
              { l: [8], t: 'Full? Then wait', d: 'With all N slots full the producer cannot go on, so it calls <code>cwait(notfull)</code>: it is suspended on <code>notfull</code> and the monitor is released, letting a consumer in to make space. The test is on the monitor’s own <code>count</code>; <code>cwait</code> tests nothing.' },
              { l: [9, 10], t: 'Store, then advance', d: 'The item goes into slot <code>nextin</code>, then <code>nextin</code> moves on. The <code>% N</code> wraps it from N−1 back to 0, so with N = 3 the slots are used 0, 1, 2, 0, 1, …' },
              { l: [11, 12], t: 'Count up, then signal', d: 'There is now at least one item, so <code>csignal(notempty)</code> resumes one consumer that was waiting for one; under Hoare rules it is the very next process to run inside. If no consumer waits, the signal is simply lost, and that is harmless: a later consumer will see <code>count &gt; 0</code> and never wait.' },
              { l: [13], t: 'Return = leave', d: 'Returning from the procedure leaves the monitor, and the next waiting process may enter.' },
              { l: [14, 15], t: 'A consumer enters. Empty? Then wait', d: 'The mirror image of <code>append</code>. With <code>count == 0</code> there is nothing to take, so the consumer sleeps on <code>notempty</code> and frees the monitor for a producer.' },
              { l: [16, 17, 18], t: 'Copy out, advance, count down', d: 'The oldest item is copied from slot <code>nextout</code>, the index moves on (wrapping at N), and <code>count</code> drops by one. Items come out in the order they went in.' },
              { l: [19, 20], t: 'Wake a producer, then leave', d: 'A slot just became free, so <code>csignal(notfull)</code> resumes one producer waiting for space, if there is one. Then the consumer returns and leaves.' },
              { l: [21], t: 'Initialization', d: 'Runs once, when the monitor is created: the buffer starts empty with both indexes at slot 0.' },
            ],
            pc: [
              { l: [1, 2, 3], t: 'A producer’s whole life', d: 'Each producer process runs this loop forever: make an item, deposit it, repeat.' },
              { l: [4], t: 'produce(x): no monitor needed', d: 'Making an item touches no shared data, so it runs outside the monitor, in parallel with every other process.' },
              { l: [5], t: 'append(x): the only shared step', d: 'All the waiting and turn-taking hides behind this one call. If the buffer is full, the producer sleeps inside <code>append</code> and returns only after its item is stored.' },
              { l: [8, 9, 10], t: 'A consumer’s whole life', d: 'The mirror image: fetch an item, use it, repeat.' },
              { l: [11], t: 'take(x)', d: 'If the buffer is empty the consumer sleeps inside <code>take</code>; otherwise it returns at once with the oldest item.' },
              { l: [12], t: 'consume(x): no monitor needed', d: 'Using the item happens outside, so the monitor is free for other producers and consumers meanwhile.' },
              { l: [5, 11], t: 'Compare with semaphores', d: 'With semaphores, each loop would also carry four <code>semWait</code>/<code>semSignal</code> calls in a precise order, and one slip in any process could deadlock everything. Here the loops hold no synchronization code at all.' },
            ],
          };
          const head = h('div', { class: 'xs b muted' });
          const ttl = h('h3', { class: 'm0' });
          const body = h('p', { class: 'm0' });
          const count = h('span', { class: 'player-count' });
          const prev = h('button', { class: 'btn sm', type: 'button', onclick: () => show(i - 1) }, '← Previous');
          const next = h('button', { class: 'btn sm primary', type: 'button', onclick: () => show(i + 1) }, 'Next →');
          let tour = tours.mon, i = 0, code = null;
          function show(k) {
            i = ctx.util.clamp(k, 0, tour.length - 1);
            const f = tour[i];
            code.clear();
            code.mark(f.l);
            head.textContent = f.l.length > 1 ? 'LINES ' + f.l.join(', ') : 'LINE ' + f.l[0];
            ttl.textContent = f.t;
            body.innerHTML = f.d;
            count.textContent = `${i + 1} / ${tour.length}`;
            prev.disabled = i === 0;
            next.disabled = i === tour.length - 1;
          }
          function mount(panel, src, key) {
            code = ctx.ui.code(src, { lang: 'c', fontSize: 13.5 });
            panel.append(code);
            tour = tours[key];
            code.querySelectorAll('.ln').forEach((ln, j) => {
              const f = tour.findIndex((fr) => fr.l.includes(j + 1));
              if (f >= 0) { ln.classList.add('clickable'); ln.addEventListener('click', () => show(f)); }
            });
            show(0);
          }
          const tabs = ctx.ui.tabs([
            { label: 'The monitor', render: (p) => mount(p, MON, 'mon') },
            { label: 'Producer &amp; consumer', render: (p) => mount(p, PC, 'pc') },
          ]);
          const predict = ctx.ui.reveal('Predict, then reveal',
            '<p class="small m0">It finds <code>count == N</code>, so it calls <code>cwait(notfull)</code>: it is suspended on <code>notfull</code> and the monitor is released. It resumes only after a consumer takes an item and calls <code>csignal(notfull)</code>, and then it continues at the line after its <code>cwait</code>.</p>');
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: '660px minmax(0, 1fr)' } },
            tabs,
            h('div', { class: 'stack' },
              h('div', { class: 'card stack gap-s grow' }, head, ttl, body),
              h('div', { class: 'row' }, prev, next, count, h('span', { class: 'xs muted' }, 'or click any line')),
              h('div', { class: 'card tight' }, h('p', { class: 'small b m0', html: 'N = 3 and all three slots are full. A producer calls <code>append</code>. What happens to it?' }), predict))));
        },
      },
      /* ---------------- 5. Lab: drive the bounded-buffer monitor (Hoare rules) ---------------- */
      {
        title: 'Lab: run the monitor yourself, one line at a time',
        kind: 'lab',
        core: true,
        render(el, ctx) {
          const { h } = ctx;
          const holder = h('div', { class: 'card white', style: { padding: '4px' } });
          const code = ctx.ui.code(bbSource('hoare'), { lang: 'c', nums: false, fontSize: 13 });
          const sayEl = h('div', { class: 'card tight small grow' });
          const goals = [
            ['ne', 'A consumer sleeps on notempty'],
            ['nf', 'A producer sleeps on notfull'],
            ['urgent', 'A signaler waits in the urgent queue'],
            ['lost', 'A csignal is lost (nobody waiting)'],
            ['wrap', 'nextin wraps from 2 back to 0'],
          ];
          const goalEls = goals.map(([, t]) => h('div', { class: 'small' }, t));
          let stage, st, procs, nP, nC, nItem, ach, auto = null;
          const PROC = (id) => (procs[id].kind === 'P' ? 'append' : 'take');
          function fresh() {
            stopAuto();
            stage = makeStage(ctx);
            holder.replaceChildren(wide(ctx, stage.svg, 580));
            st = emptyState('hoare');
            procs = {}; nP = 0; nC = 0; nItem = 0; ach = {};
            paint('<b>Reminder:</b> <code>cwait(c)</code> sleeps on condition c and lets the next process in; <code>csignal(c)</code> wakes one sleeper on c. <b>Start here.</b> Add a <b>consumer</b> first. The buffer is empty, so run its lines and watch where it goes. Then add producers. Highlighted code is the line the process inside will run <b>next</b>.');
          }
          function admit() {
            if (st.inside) return null;
            if (st.urgent.length) { st.inside = st.urgent.shift(); return { id: st.inside, from: 'urgent' }; }
            if (st.entry.length) { st.inside = st.entry.shift(); procs[st.inside].pc = 1; return { id: st.inside, from: 'entry' }; }
            return null;
          }
          const admitted = (a) => (a ? ` <b>${a.id}</b> ${a.from === 'urgent' ? 'comes back from the urgent queue first (it outranks the entrance queue).' : 'enters from the entrance queue.'}` : ' Nobody else is waiting to enter.');
          function add(kind) {
            const active = Object.values(procs).filter((p) => !p.done).length;
            if (active >= 8) { ctx.toast('Plenty of processes already: run some lines first.'); return; }
            const id = kind + (kind === 'P' ? ++nP : ++nC);
            procs[id] = { kind, pc: 0, item: kind === 'P' ? String.fromCharCode(97 + (nItem++ % 26)) : null };
            let txt;
            if (!st.inside && !st.entry.length && !st.urgent.length) { st.inside = id; procs[id].pc = 1; txt = `<b>${id}</b> calls ${PROC(id)}(). The monitor is empty, so it walks straight in.`; }
            else { st.entry.push(id); txt = `<b>${id}</b> calls ${PROC(id)}(), but <b>${st.inside}</b> is inside, so ${id} waits in the <span class="t">entrance queue</span>. Mutual exclusion, for free.`; }
            paint(txt, true);
          }
          function stepOnce() {
            st.lost = null;
            let txt;
            if (!st.inside) {
              const a = admit();
              paint(a ? `<b>${a.id}</b> enters the monitor.` : 'Nothing to run. Add a producer or a consumer.');
              if (!a) stopAuto();
              return;
            }
            const id = st.inside, p = procs[id], P = p.kind === 'P';
            if (p.pc === 1) {
              const blocked = P ? st.count === NSLOT : st.count === 0;
              if (blocked) {
                const q = P ? 'notfull' : 'notempty';
                st[q].push(id); st.inside = null; p.pc = 2; ach[P ? 'nf' : 'ne'] = true;
                txt = `<b>${id}</b> sees count = ${st.count}, so the buffer is ${P ? 'full' : 'empty'}. It calls <code>cwait(${q})</code>: it sleeps on ${q} and releases the monitor.` + admitted(admit());
              } else { p.pc = 2; txt = `<b>${id}</b> checks count = ${st.count}: ${P ? 'not full' : 'not empty'}, so there is no need to wait.`; }
            } else if (p.pc === 2) {
              if (P) { txt = `<b>${id}</b> stores item <b>${p.item}</b> in slot ${st.nextin}.`; st.buf[st.nextin] = p.item; p.item = null; }
              else { p.item = st.buf[st.nextout]; st.buf[st.nextout] = null; txt = `<b>${id}</b> copies item <b>${p.item}</b> out of slot ${st.nextout} (the oldest one).`; }
              p.pc = 3;
            } else if (p.pc === 3) {
              const k = P ? 'nextin' : 'nextout', o = st[k];
              st[k] = (o + 1) % NSLOT;
              if (P && st[k] === 0) ach.wrap = true;
              txt = `<code>${k}</code> moves from ${o} to ${st[k]}` + (st[k] === 0 ? ': the <code>% N</code> wraps it back to slot 0.' : '.');
              p.pc = 4;
            } else if (p.pc === 4) {
              st.count += P ? 1 : -1;
              txt = `count ${P ? 'rises' : 'drops'} to ${st.count}.`;
              p.pc = 5;
            } else if (p.pc === 5) {
              const q = P ? 'notempty' : 'notfull';
              p.pc = 6;
              if (st[q].length) {
                const w = st[q].shift();
                st.urgent.push(id); st.inside = w; ach.urgent = true;
                txt = `<b>${id}</b> calls <code>csignal(${q})</code> and <b>${w}</b> is waiting. Hoare rule: ${w} takes over the monitor <b>immediately</b>, so ${id} steps aside into the <span class="t">urgent queue</span>. (Only its closing brace is left; this lab applies the rule strictly so you can watch the queue.)`;
              } else {
                st.lost = q; ach.lost = true;
                txt = `<b>${id}</b> calls <code>csignal(${q})</code>, but nobody waits on ${q}: the signal is lost. That is harmless here, because a later arrival checks <code>count</code> itself.`;
              }
            } else {
              st.inside = null; st.done.push(id); p.done = true;
              txt = `<b>${id}</b> returns from ${PROC(id)}() and leaves the monitor${P ? '' : ' carrying item <b>' + p.item + '</b>'}.` + admitted(admit());
            }
            paint(txt);
          }
          function paint(txt, slide) {
            st.labels = {};
            for (const [id, p] of Object.entries(procs)) if (p.item) st.labels[id] = id + '·' + p.item;
            st.activity = st.inside ? 'running ' + PROC(st.inside) + '()' : null;
            stage.set(st, { slideIn: slide });
            code.clear();
            if (st.inside) {
              const P = procs[st.inside].kind === 'P';
              code.mark(P ? [8, 9, 10, 11, 12, 13, 14] : [1, 2, 3, 4, 5, 6, 7], 'dim');
              code.mark([(P ? 1 : 8) + procs[st.inside].pc], 'cur');
            }
            if (txt) sayEl.innerHTML = txt;
            goals.forEach(([k, t], i) => { goalEls[i].innerHTML = (ach[k] ? '<b style="color:var(--ok)">✓</b> ' : '<span class="muted">○</span> ') + t; });
            stepBtn.disabled = !st.inside && !st.entry.length && !st.urgent.length;
          }
          function stopAuto() { if (auto) { clearInterval(auto); auto = null; } if (autoBtn) { autoBtn.textContent = 'Auto-run'; autoBtn.classList.remove('on'); } }
          const stepBtn = h('button', { class: 'btn primary', type: 'button', onclick: () => { stopAuto(); stepOnce(); } }, 'Run next line ▸');
          const autoBtn = h('button', { class: 'btn', type: 'button', onclick: () => {
            if (auto) return stopAuto();
            auto = ctx.every(1100, stepOnce); autoBtn.textContent = 'Pause'; autoBtn.classList.add('on'); stepOnce();
          } }, 'Auto-run');
          const scen = (list) => () => { fresh(); list.forEach((k) => add(k)); };
          fresh();
          el.append(h('div', { class: 'stack fill' },
            h('div', { class: 'row' },
              h('button', { class: 'btn proc', type: 'button', onclick: () => add('P') }, '+ Producer calls append'),
              h('button', { class: 'btn', type: 'button', style: { borderColor: 'var(--accent)', color: 'var(--accent)' }, onclick: () => add('C') }, '+ Consumer calls take'),
              stepBtn, autoBtn,
              h('button', { class: 'btn sm', type: 'button', onclick: fresh }, 'Reset'),
              h('span', { class: 'xs b muted', style: { marginLeft: 'auto' } }, 'QUICK START'),
              h('button', { class: 'btn sm', type: 'button', onclick: scen(['C', 'P']) }, 'Empty buffer'),
              h('button', { class: 'btn sm', type: 'button', onclick: scen(['P', 'P', 'P', 'P', 'C']) }, 'Overflow')),
            h('div', { class: 'split grow', style: { gridTemplateColumns: '620px minmax(0, 1fr)', gap: '20px' } },
              h('div', { class: 'stack' }, holder, sayEl),
              h('div', { class: 'stack' },
                h('div', { class: 'stack', style: { gap: '4px', flex: 'none' } }, h('div', { class: 'xs b muted' }, 'HOARE RULES · HIGHLIGHT = NEXT LINE TO RUN'), code),
                h('div', { class: 'card tight stack', style: { gap: '2px' } }, h('div', { class: 'xs b muted' }, 'CAN YOU MAKE THESE HAPPEN?'), ...goalEls)))));
        },
      },
      /* ---------------- 6. Hoare's price: process switches on one CPU ---------------- */
      {
        title: 'Hoare’s hand-off has a price: extra process switches',
        kind: 'compare',
        render(el, ctx) {
          const { h, s } = ctx;
          const X0 = 184, U = 66, OUT = 2;
          const CLS = { P1: 's-proc', C1: 's-accent', F: 's-bad', N: 's-panel' };
          let left = 1; // monitor lines P1 still has to run after it signals (0, 1 or 2)
          // Events are [who, label, start, end]. F = forced switch caused by the Hoare hand-off;
          // N = ordinary switch (P1's time slice ends), which happens under both rules.
          function plan(k) {
            const ME = [['P1', 'work', 0, 1], ['P1', 'work', 1, 2], ['P1', 'cnotify', 2, 3]];
            const HO = [['P1', 'work', 0, 1], ['P1', 'work', 1, 2], ['P1', 'csignal', 2, 3]];
            // P1 runs its k remaining monitor lines, leaves, does OUT units of outside work, then its slice ends.
            const p1Rest = (ev, t) => {
              const labs = [];
              for (let j = 0; j < k; j++) labs.push('work');
              labs.push('leave');
              for (let j = 0; j < OUT; j++) labs.push('outside');
              labs.forEach((l) => { ev.push(['P1', l, t, t + 1]); t += 1; });
              ev.push(['N', '', t, t + 0.5]);
              return t + 0.5;
            };
            const c1 = (ev, t, first) => { ev.push(['C1', first, t, t + 1], ['C1', 'work', t + 1, t + 2], ['C1', 'leave', t + 2, t + 3]); return t + 3; };
            const meEnd = c1(ME, p1Rest(ME, 3), 're-test');
            let hoEnd;
            if (k === 0) hoEnd = c1(HO, p1Rest(HO, 3), 'resume'); // csignal was P1's last statement: it just leaves
            else {
              HO.push(['F', '', 3, 3.5]);            // P1 is suspended into the urgent queue
              const t = c1(HO, 3.5, 'resume');       // C1 runs inside at once
              HO.push(['F', '', t, t + 0.5]);        // P1 is resumed from the urgent queue
              hoEnd = p1Rest(HO, t + 0.5);
            }
            return { HO, ME, meEnd, hoEnd };
          }
          function script(k) {
            const { meEnd, hoEnd } = plan(k);
            if (k === 0) return [
              [0, '<b>Setup.</b> One CPU. P1 is inside the monitor and C1 sleeps on condition <code>c</code>. This time <code>csignal(c)</code> is the <b>last statement</b> of P1’s procedure. Press <b>Next</b>.'],
              [2, 'P1 runs two lines inside the monitor. So far both worlds are identical.'],
              [3, '<b>P1 signals as its very last act.</b> Hoare: P1 has nothing left to do inside, so it simply leaves instead of waiting in the urgent queue, and the monitor is kept for C1. Mesa: C1 is marked ready and P1 keeps the CPU.'],
              [6.5, 'Both worlds look the same: P1 leaves, does its outside work, and its time slice ends with an <b>ordinary</b> switch (grey) that gives C1 the CPU.'],
              [hoEnd, `<b>Result: 0 forced switches under both rules</b>, and both end at ${hoEnd}. The only difference: Hoare’s C1 may trust its condition, Mesa’s C1 re-tests it. Drawback 1 bites only when the signaler still has work after its signal.`],
            ];
            const L = k === 1 ? 'one more line' : k + ' more lines';
            return [
              [0, `<b>Setup.</b> One CPU. P1 is inside the monitor and C1 sleeps on condition <code>c</code>. P1 will signal c and still has <b>${L}</b> of monitor work after that. Press <b>Next</b>.`],
              [2, 'P1 runs two lines inside the monitor. So far both worlds are identical.'],
              [3, '<b>P1 signals.</b> Hoare <code>csignal(c)</code>: C1 must be the next to run inside, and P1 is not finished, so P1 is parked in the urgent queue. Mesa <code>cnotify(c)</code>: C1 is only marked ready, and P1 keeps the CPU.'],
              [4.5, '<b>Hoare:</b> forced <span class="t">process switch</span> #1 (red) hands the CPU to C1, which resumes knowing c is true. <b>Mesa:</b> P1 simply carries on with its remaining monitor work.'],
              [6.5, 'Hoare: C1 does its work and leaves the monitor. Mesa: P1 is still running, with no switch at all.'],
              [7, '<b>Hoare:</b> forced switch #2 brings P1 back from the urgent queue, only to finish a procedure it was already in the middle of. <b>Mesa:</b> still no switch.'],
              [8 + k, `Hoare: P1 runs its ${k === 1 ? 'last line' : 'last ' + k + ' lines'} and leaves. Mesa: P1’s time slice ends, and an <b>ordinary</b> switch (grey) that would have happened anyway gives C1 the CPU. C1 re-tests its condition first, since nothing guaranteed it.`],
              [meEnd, `<b>Mesa is finished:</b> all the work of both processes is done at time ${meEnd}. Hoare still has part of P1’s outside work to do.`],
              [hoEnd, `<b>Result.</b> Identical work, yet Hoare ends at ${hoEnd} instead of ${meEnd}. The gap is exactly <b>2 forced process switches</b> (0.5 each): one to suspend the signaler, one to resume it. Mesa paid only a cheap re-test. Try other settings above.`],
            ];
          }
          const svg = s('svg', { viewBox: '0 0 1080 132', width: '100%', role: 'img', 'aria-label': 'CPU timelines under Hoare and Mesa rules' });
          const T = (x, y, str, a) => s('text', Object.assign({ x, y, 'font-size': 13 }, a || {}), str);
          function lane(ev, y, name, sub, now) {
            const out = [];
            const forced = ev.filter((e) => e[0] === 'F' && e[3] <= now).length;
            out.push(T(12, y + 16, name, { 'font-weight': 800, 'font-size': 15 }), T(12, y + 32, sub, { class: 's-sub' }),
              T(12, y + 47, 'forced switches: ' + forced, { 'font-weight': 800, style: forced ? 'fill:var(--bad)' : 'fill:var(--ok)' }));
            ev.filter((e) => e[3] <= now).forEach(([who, lab, a, b]) => {
              const x = X0 + a * U, w = (b - a) * U - 3;
              out.push(s('rect', { x, y: y + 4, width: w, height: 42, rx: 7, class: CLS[who], 'stroke-width': 1.5 }));
              if (who === 'F' || who === 'N') out.push(T(x + w / 2, y + 30, '↔', { 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 800, style: who === 'F' ? 'fill:var(--bad)' : '' }));
              else out.push(T(x + w / 2, y + 21, who, { 'text-anchor': 'middle', 'font-weight': 800 }), T(x + w / 2, y + 39, lab, { 'text-anchor': 'middle', class: 's-monot' }));
            });
            return out;
          }
          let P = plan(left), frames = script(left);
          function draw(now) {
            const k = [s('line', { x1: X0, y1: 22, x2: X0 + 13 * U, y2: 22, class: 's-muted' }), T(12, 26, 'time →', { class: 's-sub' })];
            for (let t = 0; t <= 13; t += 1) k.push(s('line', { x1: X0 + t * U, y1: t % 2 ? 19 : 17, x2: X0 + t * U, y2: t % 2 ? 25 : 27, class: 's-muted' }), t % 2 ? '' : T(X0 + t * U, 13, String(t), { 'text-anchor': 'middle', class: 's-sub' }));
            k.push(...lane(P.HO, 28, 'Hoare', 'csignal hands over now', now), ...lane(P.ME, 80, 'Mesa', 'cnotify just marks ready', now));
            k.push(s('line', { x1: X0 + now * U, y1: 26, x2: X0 + now * U, y2: 130, stroke: 'var(--chc)', 'stroke-width': 2, 'stroke-dasharray': '5 4' }));
            svg.replaceChildren(...k.filter(Boolean));
            // phones: keep the "now" line in view inside the sideways-scrolling wrapper
            const sc = svg.parentElement;
            if (ctx.narrow && sc && sc.classList.contains('m5-wide')) sc.scrollLeft = Math.max(0, (X0 + now * U) * (svg.clientWidth / 1080) - sc.clientWidth / 2);
          }
          const player = ctx.ui.player({ count: frames.length, render: (i) => { draw(frames[i][0]); return frames[i][1]; }, interval: 2400 });
          const seg = ctx.ui.seg([{ value: 0, label: '0: signal is last' }, { value: 1, label: '1 line' }, { value: 2, label: '2 lines' }], left, (v) => {
            const atEnd = player.index >= player.count - 1;
            left = v; P = plan(v); frames = script(v);
            player.setCount(frames.length);
            if (atEnd) player.go(frames.length - 1);
          });
          const key = (cls, t) => h('span', { class: 'row gap-s xs b', style: { gap: '6px' } }, h('span', { class: 'm6-key ' + cls }), t);
          el.append(h('div', { class: 'stack fill' },
            h('p', { class: 'm0', html: 'In a <span class="t">Hoare monitor</span>, <code>csignal</code> hands the monitor to the woken process on the spot, so the condition it waited for is <b>guaranteed</b> to still hold. The <span class="t">Mesa monitor</span> relaxes that. Step through the same moment on one CPU under both rules.' }),
            h('div', { class: 'row', style: { justifyContent: 'space-between' } },
              h('div', { class: 'row gap-s' }, h('span', { class: 'small b' }, 'Monitor work P1 still has after its signal:'), seg),
              h('div', { class: 'row', style: { gap: '14px' } }, key('proc', 'P1 (signaler)'), key('accent', 'C1 (waiter)'), key('bad', 'forced switch'), key('panel', 'ordinary switch'))),
            h('div', { class: 'card white', style: { padding: '6px 12px' } }, wide(ctx, svg, 1000)),
            player.el,
            h('div', { class: 'grid-2' },
              h('div', { class: 'callout why m0', 'data-label': 'Drawback 1 · Cost', html: 'A signaler that has not finished costs <b>two extra process switches</b>: one to suspend it, one to resume it. 1 line left or 100, it is still 2.' }),
              h('div', { class: 'callout warn m0', 'data-label': 'Drawback 2 · Fragile', html: 'Scheduling must be <b>perfectly reliable</b>: the woken process must be the very next one to run inside. If anyone else slips in first, the condition may be false again.' }))));
        },
      },
      /* ---------------- 7. Mesa: cnotify, a process sneaks in, and if becomes while ---------------- */
      {
        title: 'Mesa monitors: notify, sneak in, re-test with while',
        kind: 'compare',
        core: true,
        render(el, ctx) {
          const { h } = ctx;
          function build(mode) {
            const mesa = mode !== 'hoare';
            const st = emptyState(mesa ? 'mesa' : 'hoare');
            const F = [];
            let sw = 0;
            const snap = (cap, mark, cls, outcome) => F.push({ st: JSON.parse(JSON.stringify(st)), mark, cls: cls || 'cur', cap, sw, outcome: outcome || null });
            st.inside = 'C1'; st.entry = ['P1', 'C2']; st.labels = { P1: 'P1·a' };
            snap('<b>Start.</b> The buffer is empty. Consumer C1 is inside <code>take()</code>; producer P1 and a second consumer C2 wait at the entrance.', [9]);
            st.notempty = ['C1']; st.inside = 'P1'; st.entry = ['C2'];
            snap('C1 finds <code>count == 0</code> and calls <code>cwait(notempty)</code>. It sleeps and releases the monitor, so P1 enters.', [9]);
            st.buf[0] = 'a'; st.nextin = 1; st.count = 1; st.labels = {};
            snap('P1 stores item <b>a</b> in slot 0, advances <code>nextin</code> and sets <code>count = 1</code>.', [3, 4, 5]);
            if (!mesa) {
              st.notempty = []; st.urgent = ['P1']; st.inside = 'C1'; sw = 1;
              snap('P1 calls <code>csignal(notempty)</code>. <b>Hoare:</b> C1 takes over <b>at once</b> (forced switch 1) and P1 waits in the urgent queue. C2 cannot slip in between.', [6]);
              st.buf[0] = null; st.nextout = 1; st.count = 0; st.labels = { C1: 'C1·a' };
              snap('C1 resumes right after its <code>cwait</code> and takes item <b>a</b>. It may trust its earlier test: nobody touched the buffer in between.', [10, 11, 12]);
              st.lost = 'notfull'; st.inside = 'P1'; st.urgent = []; st.done = ['C1']; sw = 2;
              snap('C1 signals <code>notfull</code> (nobody waits: lost) and leaves. The urgent queue outranks the entrance, so P1 comes back (forced switch 2) just to finish.', [13, 14]);
              st.lost = null; st.inside = 'C2'; st.done = ['C1', 'P1'];
              snap('P1 returns and leaves. Only now does C2 get in.', [7]);
              st.inside = null; st.notempty = ['C2'];
              snap('<b>Correct.</b> C2 finds the buffer empty and waits. The price: 2 extra switches, just to bring P1 back for its closing brace.', [9], 'ok', 'ok');
            } else {
              st.notempty = []; st.entry = ['C2', 'C1']; st.warn = ['C1'];
              snap('P1 calls <code>cnotify(notempty)</code>. <b>Mesa:</b> C1 is merely moved out of the condition queue and must re-enter like anyone else, <b>behind C2</b> (dashed = notified). P1 keeps running.', [6]);
              st.inside = 'C2'; st.entry = ['C1']; st.done = ['P1'];
              snap('P1 returns and leaves. The monitor is free, and the front of the entrance queue is <b>C2</b>, not C1: <b>C2 sneaks in first.</b>', [7]);
              st.buf[0] = null; st.nextout = 1; st.count = 0; st.labels = { C2: 'C2·a' };
              snap('C2 sees <code>count = 1</code>, so it never waits, and takes item <b>a</b>. The buffer is empty again, and C1 has no idea.', [9, 10, 11, 12]);
              st.lost = 'notfull'; st.inside = 'C1'; st.entry = []; st.done = ['P1', 'C2']; st.warn = [];
              snap(mode === 'mesa-if'
                ? 'C2 leaves. At last C1 gets back in and resumes right after its <code>cwait</code>. With <code>if</code> there is no second test: it goes straight on to take an item.'
                : 'C2 leaves. At last C1 gets back in and resumes right after its <code>cwait</code>, inside the <code>while</code> loop, so it goes back to the test.', mode === 'mesa-if' ? [10] : [9]);
              st.lost = null;
              if (mode === 'mesa-if') {
                st.nextout = 2; st.count = -1; st.labels.C1 = 'C1·?'; st.bad = ['C1'];
                snap('<b>Bug!</b> Trusting a stale test, C1 takes from an empty buffer: garbage from slot 1, and <code>count</code> falls to −1. Under Mesa rules <code>if</code> is wrong.', [10, 11, 12], 'bad', 'bad');
              } else {
                st.inside = null; st.notempty = ['C1'];
                snap('<b>Safe.</b> The <code>while</code> re-test finds <code>count == 0</code>, so C1 goes back to sleep and waits for the next item. No extra switches, no harm.', [9], 'ok', 'ok');
              }
            }
            return F;
          }
          let mode = 'mesa-if', frames = build(mode);
          const stage = makeStage(ctx);
          const codeBox = h('div');
          let code = null;
          const swBig = h('div', { class: 'big', style: { fontSize: '30px' } });
          const outChip = h('span', { class: 'chip' });
          function setCode() { code = ctx.ui.code(bbSource(mode), { lang: 'c', nums: false, fontSize: 13 }); codeBox.replaceChildren(code); }
          setCode();
          const player = ctx.ui.player({ count: frames.length, interval: 2800, render: (i) => {
            const f = frames[i];
            const st = f.st;
            st.activity = st.inside ? 'running ' + (st.inside[0] === 'P' ? 'append()' : 'take()') : null;
            stage.set(st);
            code.clear();
            code.mark(f.mark, f.cls);
            swBig.textContent = f.sw;
            swBig.style.color = f.sw ? 'var(--bad)' : 'var(--ok)';
            outChip.className = 'chip ' + (f.outcome === 'bad' ? 'bad' : f.outcome === 'ok' ? 'ok' : '');
            outChip.textContent = f.outcome === 'bad' ? 'wrong: count = −1' : f.outcome === 'ok' ? 'correct' : 'still running';
            return f.cap;
          } });
          const seg = ctx.ui.seg([{ value: 'hoare', label: 'Hoare · csignal + if' }, { value: 'mesa-if', label: 'Mesa · cnotify + if' }, { value: 'mesa-while', label: 'Mesa · cnotify + while' }], mode, (v) => {
            mode = v; frames = build(v); setCode(); player.refresh();
          });
          el.append(h('div', { class: 'stack fill' },
            h('div', { class: 'row' }, seg, h('span', { class: 'small muted', html: 'Hoare’s csignal hands over the monitor at once; Mesa’s <span class="t">cnotify</span> only makes a waiter ready.' })),
            h('div', { class: 'split grow', style: { gridTemplateColumns: '600px minmax(0, 1fr)', gap: '20px' } },
              h('div', { class: 'card white', style: { padding: '4px' } }, wide(ctx, stage.svg, 580)),
              h('div', { class: 'stack' }, codeBox,
                h('div', { class: 'card tight row', style: { justifyContent: 'space-between' } },
                  h('div', { class: 'row gap-s' }, h('span', { class: 'xs b muted' }, 'EXTRA SWITCHES'), swBig),
                  h('div', { class: 'row gap-s' }, h('span', { class: 'xs b muted' }, 'OUTCOME'), outChip)))),
            player.el));
        },
      },
      /* ---------------- 8. cbroadcast: variable-size memory requests ---------------- */
      {
        title: 'cbroadcast: wake everyone, let each one re-check',
        kind: 'explore',
        render(el, ctx) {
          const { h } = ctx;
          const WANT = { R1: 40, R2: 10, R3: 25 };
          const IDS = ['R1', 'R2', 'R3'];
          let mode = 'notify', X = 30;
          function build() {
            let free = 5, q = IDS.slice(), released = false;
            const got = {}, status = { R1: 'asleep', R2: 'asleep', R3: 'asleep' };
            const F = [];
            const snap = (cap, mark, focus) => F.push({ free, got: Object.assign({}, got), status: Object.assign({}, status), released, cap, mark: mark || [], focus: focus || null });
            snap(`<b>Start.</b> Only 5 KB is free and process F holds ${X} KB. R1, R2 and R3 each asked for more than 5 KB, so all three sleep on <code>memfree</code>, in that order.`);
            free += X; released = true;
            const woken = mode === 'notify' ? [q[0]] : q.slice();
            woken.forEach((r) => { status[r] = 'woken'; });
            q = q.filter((r) => !woken.includes(r));
            snap(`F releases ${X} KB, so <b>${free} KB</b> is free, then calls <code>${mode === 'notify' ? 'cnotify' : 'cbroadcast'}(memfree)</code>. ` + (mode === 'notify' ? `Only <b>${woken[0]}</b>, first in line, is made ready.` : '<b>All three</b> are made ready. Each will re-test when it gets the monitor.'), [6, 7]);
            woken.forEach((r) => {
              if (free >= WANT[r]) { free -= WANT[r]; got[r] = WANT[r]; status[r] = 'got'; snap(`${r} gets the monitor and re-tests: is ${free + WANT[r]} ≥ ${WANT[r]}? <b>Yes.</b> It takes ${WANT[r]} KB and leaves; ${free} KB remain.`, [2, 3], r); }
              else { status[r] = 'again'; q.push(r); snap(`${r} gets the monitor and re-tests: is ${free} ≥ ${WANT[r]}? <b>No.</b> The <code>while</code> loop sends it back to sleep on memfree.`, [2], r); }
            });
            const fit = q.filter((r) => WANT[r] <= free);
            const winners = IDS.filter((r) => got[r]);
            let sum;
            const left = free ? 'only ' + free + ' KB is left' : 'no memory is left';
            if (mode === 'notify' && fit.length) sum = `<b>Stuck.</b> ${free} KB sits idle while ${fit.join(' and ')} ${fit.length > 1 ? 'wait, though each would fit' : 'waits, though it would fit'}. ` + (got.R1 ? 'cnotify woke only R1, so nobody told the others that memory was left over.' : 'F could not know which waiter to wake, and cnotify picked R1, which did not fit.');
            else if (winners.length) sum = `<b>Done.</b> ${winners.join(' and ')} got memory${q.length ? '; ' + q.join(' and ') + ' still wait' + (q.length > 1 ? '' : 's') + ', correctly, since ' + left : ''}.` + (mode === 'broadcast' ? ' Broadcast let every waiter decide for itself.' : ' Here one wake-up happened to be enough.');
            else sum = `<b>Nobody fits yet</b> (${free} KB free). Every woken process re-tested and went back to sleep: a few cheap re-tests, no harm.`;
            snap(sum);
            return F;
          }
          const bar = h('div', { class: 'm5-bar' });
          const reqEls = IDS.map((r) => h('div', { class: 'card tight m5-req stack gap-s' }));
          const freeBig = h('span', { class: 'b', style: { color: 'var(--mem)' } });
          const codeBox = h('div');
          let code = null, frames = build();
          function setCode() {
            code = ctx.ui.code(`
void allocate(int want) {             // need 'want' KB
  while (free < want) cwait(memfree); // too little: sleep
  free = free - want;                 // take the memory
}                                     // leave the monitor
void release(int amount) {            // give memory back
  free = free + amount;               // return it to pool
  ${(mode === 'notify' ? 'cnotify(memfree);' : 'cbroadcast(memfree);').padEnd(36)}// ${mode === 'notify' ? 'wake only one' : 'wake ALL waiters'}
}                                     // leave the monitor`, { lang: 'c', nums: false, fontSize: 13 });
            codeBox.replaceChildren(code);
          }
          setCode();
          function draw(f) {
            const segs = [['oth', 95 - X, 'other programs']];
            IDS.forEach((r) => { if (f.got[r]) segs.push(['rq', f.got[r], r + ' ' + f.got[r]]); });
            if (!f.released) segs.push(['fh', X, 'F ' + X]);
            segs.push(['fr', f.free, 'free ' + f.free]);
            bar.replaceChildren(...segs.filter((x) => x[1] > 0).map(([c, v, t]) => h('div', { class: c, style: { flex: `0 0 ${v}%` }, title: t + ' KB' }, v >= 9 ? t : '')));
            freeBig.textContent = f.free + ' KB free';
            IDS.forEach((r, i) => {
              const st = f.status[r];
              const lab = { asleep: ['os', 'asleep on memfree'], woken: ['warn', 'woken: will re-test'], again: ['os', 're-tested: asleep again'], got: ['ok', `got ${WANT[r]} KB ✓`] }[st];
              reqEls[i].className = 'card tight m5-req stack gap-s' + (f.focus === r ? ' focus' : '');
              reqEls[i].innerHTML = `<div class="row" style="justify-content:space-between"><b>${r}</b><span class="small muted">wants <b>${WANT[r]} KB</b></span></div><span class="chip ${lab[0]}">${lab[1]}</span>`;
            });
            code.clear();
            code.mark(f.mark);
          }
          const player = ctx.ui.player({ count: frames.length, interval: 2400, render: (i) => { draw(frames[i]); return frames[i].cap; } });
          const rebuild = () => { frames = build(); setCode(); player.setCount(frames.length); };
          const seg = ctx.ui.seg([{ value: 'notify', label: 'release uses cnotify' }, { value: 'broadcast', label: 'release uses cbroadcast' }], mode, (v) => { mode = v; rebuild(); });
          const slider = ctx.ui.slider({ label: 'F frees', min: 5, max: 60, step: 5, value: X, format: (v) => v + ' KB', onInput: (v) => { X = v; rebuild(); } });
          el.append(h('div', { class: 'stack fill' },
            h('p', { class: 'm0', html: 'Sometimes one event could satisfy several waiters, and the signaler cannot tell which ones, or how many. Mesa monitors add <span class="t">cbroadcast</span>(x): <b>every</b> process waiting on x becomes ready, and each re-tests its own condition. Example: processes waiting for memory blocks of different sizes.' }),
            h('div', { class: 'split grow', style: { gridTemplateColumns: '620px minmax(0, 1fr)', gap: '22px' } },
              h('div', { class: 'stack' },
                h('div', { class: 'row' }, seg, h('div', { class: 'grow', style: { minWidth: '200px' } }, slider)),
                h('div', { class: 'card white stack gap-s' },
                  h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'xs b muted' }, 'MEMORY POOL · 100 KB'), freeBig),
                  bar,
                  h('div', { class: 'grid-3' }, ...reqEls)),
                player.el,
                h('div', { class: 'callout why m0 small', 'data-label': 'Why it matters', html: 'Real thread libraries work this way. POSIX threads: <code>pthread_cond_signal</code> / <code>pthread_cond_broadcast</code>. Java: <code>notify</code> / <code>notifyAll</code>. Both follow Mesa rules, so waits always sit in a <code>while</code> loop.' })),
              h('div', { class: 'stack' },
                codeBox,
                h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'Pairing <code>cbroadcast</code> with <code>if</code>. Every woken process would carry on, even those whose request still does not fit. Broadcast relies on <code>while</code>.' }),
                h('div', { class: 'callout tip m0 small', 'data-label': 'The trade-off', html: 'Broadcast is never <b>wrong</b> with <code>while</code>, but it can be wasteful: every woken process gets a turn in the monitor, and those that still do not fit just re-test and sleep again. Use <code>cnotify</code> when exactly one waiter can use the change; use <code>cbroadcast</code> when several might, or you cannot tell which.' })))));
        },
      },
      /* ---------------- 9. Watchdog timer + why Mesa won ---------------- */
      {
        title: 'Mesa safety nets: watchdog timers and re-tests',
        kind: 'explore',
        render(el, ctx) {
          const { h, s } = ctx;
          const ITEM = 8, END = 24, X0 = 150, U = 38; // item a is stored at t = 8; timeline runs 0..24 ticks
          let notify = true, W = 0, test = 'while';
          // Consumer C calls take() at t = 0, finds the buffer empty and waits on notempty from t = 1.
          // Each wait ends at the first of: the producer's cnotify (t = 8, if it is sent) or the watchdog limit.
          function run() {
            const ev = [];
            let ws = 1, got = null, bug = null, wasted = 0;
            for (let guard = 0; guard < 40; guard++) {
              const tTimer = W ? ws + W : Infinity;
              const tNote = notify ? ITEM : Infinity;
              const tw = Math.min(tTimer, tNote);
              if (tw > END) break;                                // nothing will ever wake C
              const why = tNote <= tTimer ? 'notify' : 'timer';
              if (tw >= ITEM) { ev.push({ ws, t: tw, why, res: 'take' }); got = tw; break; }
              if (test === 'if') { ev.push({ ws, t: tw, why, res: 'bug' }); bug = tw; break; }
              ev.push({ ws, t: tw, why, res: 'sleep' }); wasted++; ws = tw; // while: re-test fails, wait again
            }
            return { ev, got, bug, wasted, ws, stranded: got == null && bug == null };
          }
          const svg = s('svg', { viewBox: '0 0 1100 166', width: '100%', role: 'img', 'aria-label': 'Timeline of consumer C waiting for an item, with an optional watchdog timer' });
          const T = (x, y, str, a) => s('text', Object.assign({ x, y, 'font-size': 13 }, a || {}), str);
          const X = (t) => X0 + t * U;
          const bar = (a, b, y, hh, cls, label, style) => [s('rect', { x: X(a), y, width: Math.max(4, (b - a) * U - 2), height: hh, rx: 6, class: cls, 'stroke-width': 1.5 }),
            label ? T((X(a) + X(b)) / 2, y + hh / 2 + 5, label, { 'text-anchor': 'middle', 'font-weight': 700, style: style || '' }) : null];
          function draw(r) {
            const k = [s('line', { x1: X(0), y1: 18, x2: X(END), y2: 18, class: 's-muted' }), T(12, 22, 'time (ticks) →', { class: 's-sub' })];
            for (let t = 0; t <= END; t += 2) k.push(s('line', { x1: X(t), y1: 14, x2: X(t), y2: 22, class: 's-muted' }), T(X(t), 11, String(t), { 'text-anchor': 'middle', class: 's-sub' }));
            // producer lane
            k.push(T(12, 47, 'Producer P', { 'font-weight': 800 }), ...bar(0, 6, 26, 34, 's-proc', 'produce(a): no monitor'), ...bar(6, 8, 26, 34, 's-proc', 'append(a)'));
            k.push(T(X(8) + 8, 48, notify ? 'stores a, then cnotify(notempty)' : 'stores a, but FORGETS cnotify', { class: 's-monot', 'font-weight': 700, style: notify ? 'fill:var(--ok)' : 'fill:var(--bad)' }));
            // consumer lane
            k.push(T(12, 108, 'Consumer C', { 'font-weight': 800 }), ...bar(0, 1, 84, 38, 's-accent', 'take'));
            r.ev.forEach((e) => {
              k.push(...bar(e.ws, e.t, 84, 38, 's-os', e.t - e.ws >= 3 ? 'asleep on notempty' : e.t - e.ws >= 2 ? 'asleep' : ''));
              k.push(T(X(e.t), 78, e.why === 'timer' ? 'timer' : 'notify', { 'text-anchor': 'middle', 'font-weight': 800, style: e.why === 'timer' ? 'fill:var(--warn)' : 'fill:var(--ok)' }));
              if (e.res === 'take') k.push(...bar(e.t, e.t + 2.5, 84, 38, 's-ok', 'takes a ✓'));
              if (e.res === 'bug') k.push(...bar(e.t, e.t + 3.5, 84, 38, 's-bad', 'takes from empty!', 'fill:var(--bad)'));
            });
            if (r.stranded) k.push(...bar(r.ws, END, 84, 38, 's-os', 'asleep ... forever: nothing will ever wake C', 'fill:var(--bad)'));
            // buffer lane
            k.push(T(12, 152, 'Buffer', { 'font-weight': 800 }));
            if (r.bug != null) k.push(...bar(0, r.bug, 134, 26, 's-panel', 'empty'), ...bar(r.bug, ITEM, 134, 26, 's-bad', ITEM - r.bug >= 3 ? 'count = −1' : '−1', 'fill:var(--bad)'),
              ...bar(ITEM, END, 134, 26, 's-bad', 'a stored, yet count = 0: the monitor’s data is now corrupt', 'fill:var(--bad)'));
            else {
              k.push(...bar(0, ITEM, 134, 26, 's-panel', 'empty'));
              const until = r.got != null ? r.got : END;
              k.push(...bar(ITEM, until, 134, 26, 's-mem', r.stranded ? 'item a sits here unused' : until - ITEM >= 1 ? 'a' : ''));
              if (r.got != null) k.push(...bar(r.got, END, 134, 26, 's-panel', 'empty'));
            }
            svg.replaceChildren(...k.filter(Boolean));
          }
          const sayTxt = h('div');
          const stats = h('div', { class: 'row gap-s', style: { marginTop: 'auto' } });
          const say = h('div', { class: 'card grow stack gap-s' }, sayTxt, stats);
          const stat = (label, val, cls) => h('span', { class: 'chip ' + (cls || '') }, h('span', { class: 'xs muted', style: { marginRight: '5px' } }, label), val);
          function update() {
            const r = run();
            draw(r);
            const late = r.got != null ? r.got - ITEM : null;
            const n = r.wasted, wk = n === 1 ? 'wake-up' : 'wake-ups';
            let msg;
            if (r.bug != null) msg = `<b>Danger.</b> The watchdog woke C at t = ${r.bug}, before any item existed. With <code>if</code> there is no re-test, so C goes straight on and takes from an empty buffer. A watchdog is only safe because Mesa waiters loop with <code>while</code>.`;
            else if (r.stranded) msg = '<b>Stranded.</b> The producer stored <b>a</b> but never called <code>cnotify</code>, and C has no time limit. Nobody will ever tell C, so it sleeps forever next to the very item it wants. Give the wait a watchdog limit.';
            else if (!notify) msg = `<b>Rescued by the watchdog.</b> The producer forgot <code>cnotify</code>, but the timer woke C every ${W} ticks. ` + (n ? `${n} early ${wk} found <code>count == 0</code>, so the <code>while</code> loop sent C back to sleep. ` : '') + `At t = ${r.got} the re-test finds item a and C takes it, ${late} tick${late === 1 ? '' : 's'} late. A missing notify cost a delay, not a stuck process.` + (test === 'if' ? ' (With <code>if</code> this only worked by luck: pick a shorter limit and it breaks.)' : '');
            else if (n) msg = `The notify wakes C at t = 8 as usual. Before that the watchdog fired ${n} time${n === 1 ? '' : 's'} too early; each time the <code>while</code> re-test found <code>count == 0</code> and C went back to sleep. Harmless, just a little wasted work. A shorter limit means more wasted wake-ups; a longer one means a longer delay if a notify is ever missed.`;
            else msg = 'The normal case. The producer’s <code>cnotify</code> wakes C at t = 8; its re-test finds <code>count == 1</code> and it takes item a at once.' + (W ? ' The watchdog never fired early, so it cost nothing.' : ' Now make the producer forget its notify.');
            sayTxt.innerHTML = msg;
            stats.replaceChildren(
              stat('C gets item a:', r.got != null ? 't = ' + r.got : 'never', r.got != null ? 'ok' : 'bad'),
              stat('late by:', late != null ? late + ' tick' + (late === 1 ? '' : 's') : '—'),
              stat('wasted wake-ups:', String(n), n ? 'warn' : ''),
              stat('outcome:', r.bug != null ? 'wrong: count = −1' : r.stranded ? 'stranded forever' : 'correct', r.bug != null || r.stranded ? 'bad' : 'ok'));
          }
          const segN = ctx.ui.seg([{ value: true, label: 'Producer calls cnotify' }, { value: false, label: 'Producer forgets it (bug)' }], notify, (v) => { notify = v; update(); });
          const slider = ctx.ui.slider({ label: 'Watchdog limit', min: 0, max: 12, step: 2, value: W, format: (v) => (v ? v + ' ticks' : 'off'), onInput: (v) => { W = v; update(); } });
          const segT = ctx.ui.seg([{ value: 'while', label: 'while' }, { value: 'if', label: 'if' }], test, (v) => { test = v; update(); });
          update();
          el.append(h('div', { class: 'stack fill' },
            h('p', { class: 'm0', html: 'What if a producer <b>forgets</b> its <code>cnotify</code>? Under Mesa rules a wait may carry a <span class="t">watchdog timer</span>: once the limit passes, the waiter is made ready anyway and re-tests. Consumer C starts waiting at t = 1; the producer stores item a at t = 8.' }),
            h('div', { class: 'row', style: { gap: '16px' } }, segN, h('div', { style: { width: '270px' } }, slider), h('div', { class: 'row gap-s' }, h('span', { class: 'small b' }, 'C re-tests with'), segT)),
            h('div', { class: 'card white', style: { padding: '6px 10px' } }, wide(ctx, svg, 1000)),
            h('div', { class: 'split', style: { gridTemplateColumns: 'minmax(0, 7fr) minmax(0, 5fr)' } },
              say,
              h('div', { class: 'card tight small' }, h('h4', { class: 'm0' }, 'Why Mesa-style monitors won'),
                h('ul', { class: 'm0', html: '<li><b>Fewer process switches:</b> a notify never forces the notifier off the CPU.</li><li><b>Less error-prone:</b> every waiter re-tests, so an early, extra or stray wake-up (a timer, a broadcast, a mistaken notify) does no harm.</li><li><b>More modular:</b> a notifier only announces that something changed; it need not know who waits or what each one needs.</li>' })))));
        },
      },
      /* ---------------- 10. Recap ---------------- */
      {
        title: 'Recap: monitors in eight cards and one table',
        kind: 'recap',
        render(el, ctx) {
          const { h } = ctx;
          el.append(h('div', { class: 'stack fill' },
            h('p', { class: 'm0 muted', html: 'Say each answer out loud before you flip the card.' }),
            ctx.ui.flipcards([
              ['What is a monitor?', 'A language construct: private data, the only procedures allowed to touch it, and start-up code. At most one process runs inside at a time.'],
              ['What does cwait(c) do?', 'Always suspends the caller on condition c and releases the monitor, so another process can enter.'],
              ['csignal(c) with nobody waiting?', 'Nothing happens: the signal is lost. A semaphore would have remembered it in its count.'],
              ['Who waits in the urgent queue?', 'A Hoare signaler that handed the monitor to the process it woke while it still had work left. It gets back in before any newcomer.'],
              ['Why while instead of if (Mesa)?', 'cnotify only means “worth a look”. Another process may get in first, so the waiter must re-test when it resumes.'],
              ['When is cbroadcast the right call?', 'When a change may satisfy several waiters, or you cannot tell which: e.g. memory freed for requests of different sizes.'],
              ['When does csignal cost 2 extra switches?', 'When the Hoare signaler still has work inside: one switch parks it in the urgent queue, one resumes it. If csignal is its last statement, it can just leave.'],
              ['What does a watchdog timer add?', 'A time limit on a Mesa wait. When it expires the waiter is made ready and re-tests, so a forgotten notify costs a delay, not a process stuck forever.'],
            ], { cols: 4, height: 128 }),
            h('table', { class: 'tbl compact', html: `
              <tr><th></th><th>Hoare monitor (csignal)</th><th>Mesa monitor (cnotify, cbroadcast)</th></tr>
              <tr><td class="b">After a signal</td><td>The woken process runs <b>immediately</b>; a signaler with work left waits in the urgent queue</td><td>The signaler <b>keeps running</b>; the waiter resumes at some later, convenient time</td></tr>
              <tr><td class="b">Waiter’s test</td><td><code>if</code> is enough: the condition is guaranteed</td><td><code>while</code> is required: re-test after every wake-up</td></tr>
              <tr><td class="b">Cost</td><td>2 extra process switches if the signaler is not finished</td><td>No extra switches, just a cheap re-test</td></tr>
              <tr><td class="b">Scheduling</td><td>Must be perfectly reliable</td><td>Tolerant: a stray, early or broadcast notify is harmless</td></tr>
              <tr><td class="b">Extras</td><td>None</td><td><code>cbroadcast</code> wakes all waiters; optional watchdog timer on waits</td></tr>` })));
        },
      },
      /* ---------------- 11. Check yourself ---------------- */
      {
        title: 'Check yourself: monitors',
        kind: 'check',
        quiz: [
          { q: 'Which guarantee does a monitor give automatically, without the programmer writing any lock calls?',
            choices: ['At most one process is executing inside the monitor at any moment', 'Processes enter the monitor in priority order', 'A signal sent while nobody waits is saved for later', 'Waiting processes never need to re-check their condition'], answer: 0,
            feedback: [null, 'Monitors give mutual exclusion, not priority ordering: callers simply wait in the entrance queue.', 'That describes a semaphore. A csignal with no waiter is lost.', 'That depends on the rules in use: under Mesa rules a woken process must re-check.'],
            why: 'Mutual exclusion is built in. A process can enter only by calling one of the monitor’s procedures, and only one process may be executing inside at a time.' },
          { type: 'num', q: 'No process is waiting on condition variable <code>c</code>. Three processes call <code>csignal(c)</code>, one after another. Then four processes each call <code>cwait(c)</code>. How many of those four end up suspended?', answer: 4, tol: 0, unit: 'processes',
            why: 'A condition variable keeps no count, so all three signals found nobody waiting and were lost; every one of the four <code>cwait</code> calls suspends. A semaphore starting at 0 would have saved the three signals (count = 3), so only the fourth <code>semWait</code> would block.' },
          { type: 'multi', q: 'Which statements about <code>cwait(c)</code> are true?',
            choices: ['It always suspends the calling process', 'It releases the monitor so another process can enter', 'It tests a counter and returns at once if the counter is positive', 'Monitor code normally checks its own data (such as count) before calling it'], answer: [0, 1, 3],
            why: '<code>cwait</code> is unconditional: it suspends the caller on c and frees the monitor. Because it tests nothing, monitor code checks its own variables first and calls <code>cwait</code> only when it really must wait.' },
          { type: 'match', q: 'Match each part of a monitor to its job.',
            pairs: [['Entrance queue', 'Callers waiting to get in while someone is inside'], ['Condition queue', 'Processes suspended by cwait on one condition'], ['Urgent queue', 'Hoare signalers waiting to get back in'], ['Local data', 'Variables that only the monitor’s procedures can touch'], ['Initialization code', 'Sets the starting state once, when the monitor is created']],
            why: 'The entrance queue enforces one-at-a-time entry, each condition variable has its own queue, the urgent queue holds Hoare signalers, and the local data and initialization code live privately inside the module.' },
          { type: 'order', q: 'In a Hoare monitor, process Q waits on condition <code>c</code>. Process P later signals <code>c</code> while it still has work left inside the monitor. Put the events in order.',
            items: ['Q calls cwait(c): it is suspended and the monitor is released', 'P enters the monitor and calls csignal(c)', 'Q resumes inside the monitor at once, while P waits in the urgent queue', 'Q returns from its procedure and leaves the monitor', 'P re-enters from the urgent queue, ahead of any newcomers', 'P finishes its remaining work and leaves'],
            why: 'Hoare rules hand the monitor straight to the woken process and park an unfinished signaler in the urgent queue. When the woken process leaves, the urgent queue is served before the entrance queue, so P gets back in first.' },
          { type: 'num', q: 'Under Hoare rules, a process signals a condition (and someone is waiting) while it still has more work to do inside the monitor. How many extra process switches does that signal cause?', answer: 2, tol: 0, unit: 'switches',
            why: 'One switch suspends the signaler so the woken process can run at once, and a second one resumes the signaler later. A Mesa-style <code>cnotify</code> causes neither.' },
          { q: 'In a Mesa (Lampson/Redell) monitor, why should a consumer write <code>while (count == 0) cwait(notempty);</code> rather than <code>if</code>?',
            choices: ['cnotify only makes the waiter ready, and another process may change count before the waiter runs again', 'A while loop makes the consumer run faster', 'Mesa monitors do not provide mutual exclusion', 'cwait returns immediately in Mesa monitors'], answer: 0,
            feedback: [null, 'The loop adds a re-test; it is about correctness, not speed.', 'Mesa monitors still allow only one process inside at a time.', 'cwait still suspends the caller; the question is what is true once it resumes.'],
            why: 'Between the notify and the moment the waiter gets the monitor back, a third process can slip in and take the item. Only a re-test catches that.' },
          { type: 'bucket', q: 'Hoare-style or Mesa-style monitor?', buckets: ['Hoare (csignal)', 'Mesa (cnotify)'],
            items: [['An unfinished signaler steps aside into an urgent queue', 0], ['The signaler keeps running after it signals', 1], ['A waiter can safely use if', 0], ['A waiter must re-test with while', 1], ['Needs perfectly reliable scheduling', 0], ['Offers broadcast and wait timeouts', 1]],
            why: 'Hoare signals hand the monitor over at once, which makes if safe but costs switches and demands reliable scheduling. Mesa notifies are hints, so waiters loop, and broadcast and timeouts become safe additions.' },
          { q: 'A memory manager frees a block. Several processes are waiting for blocks of different sizes. Why is <code>cbroadcast</code> a better choice than <code>cnotify</code>?',
            choices: ['The manager cannot tell which waiters can now proceed, so it wakes them all and each re-tests', 'cbroadcast hands the memory to the largest request first', 'cbroadcast guarantees every waiting process gets its memory', 'cnotify would wake all of them anyway'], answer: 0,
            feedback: [null, 'Broadcast chooses nobody: each woken process checks its own request.', 'Only requests that still fit succeed; the others go back to sleep.', 'cnotify wakes just one waiter.'],
            why: 'Waking a single waiter may pick one that still does not fit, leaving memory idle while others could run. Broadcasting lets every waiter re-test: those that fit proceed, the rest sleep again.' },
          { type: 'tf', q: 'A watchdog timer on a Mesa-style wait lets a process resume after a time limit even if no notify arrives, and this is safe because the process re-tests its condition.', answer: true,
            why: 'Since Mesa waiters always re-check with while, waking early does no harm. The timer turns a forgotten notify into a delay instead of a process stuck forever.' },
          { type: 'num', q: 'A bounded buffer has N = 5 slots, and <code>nextin</code> is 4. After one more <code>append</code>, what is <code>nextin</code>?', answer: 0, tol: 0,
            why: '<code>nextin = (4 + 1) % 5 = 0</code>: the index wraps around to the first slot, so the array is used as a ring.' },
          { q: 'Semaphores can already solve any synchronization problem. Why were monitors introduced?',
            choices: ['Semaphore calls end up scattered across many processes, so one misplaced call is easy to make and hard to find', 'Semaphores cannot solve the producer/consumer problem', 'Monitors always run faster than semaphores', 'Semaphores work only on single-processor machines'], answer: 0,
            feedback: [null, 'Semaphores can solve it with care; monitors are equally powerful, not more powerful.', 'Speed is not the point: monitors make correct code easier to write and check.', 'Semaphores work on multiprocessors too.'],
            why: 'A monitor gathers the shared data and all of its synchronization into one module, so correctness is easier to control and verify.' },
        ],
      },
    ],

    notes: `
<h3>Why monitors?</h3>
<p>Semaphores can solve any synchronization problem, but every process must call <code>semWait</code> and <code>semSignal</code> in exactly the right places. For a bounded buffer shared by 2 producers and 2 consumers that means 16 calls spread over 4 processes (4 each; semaphore s guards the buffer, n counts items, e counts empty slots). Swap one pair, say a consumer taking s before n, and an empty buffer causes <b>deadlock</b>: the consumer sleeps on n while holding s, so no producer can get in. A <b>monitor</b> is a programming-language construct with the same power that is far easier to control: the shared data and all code touching it live in one module, and the language enforces mutual exclusion. Monitors are built into Concurrent Pascal, Pascal-Plus, Modula-2, Modula-3 and Java.</p>

<h3>Structure of a monitor</h3>
<p>A software module made of <b>local data</b>, one or more <b>procedures</b>, and an <b>initialization sequence</b> that runs once when the monitor is created. Three characteristics define it:</p>
<ol>
<li><b>Private data:</b> only the monitor's own procedures can access the local data.</li>
<li><b>One way in:</b> a process enters only by calling one of its procedures.</li>
<li><b>One at a time:</b> only one process may be executing inside; other callers wait. Mutual exclusion comes for free.</li>
</ol>
<ul>
<li><b>Entrance queue:</b> callers blocked because another process is inside.</li>
<li><b>Condition queues:</b> one per condition variable, holding processes suspended by <code>cwait</code>. They do not count as being inside.</li>
<li><b>Urgent queue</b> (Hoare): signalers that still have work to do, parked after handing the monitor to the process they woke. When the monitor frees up, it is served before the entrance queue.</li>
</ul>

<h3>cwait, csignal and the lost signal</h3>
<p><b>Condition variables</b> are named waiting lines that exist only inside the monitor. <b>cwait(c)</b> always suspends the caller on c and releases the monitor. It tests nothing, so code checks its own data first: <code>if (count == 0) cwait(notempty);</code>. <b>csignal(c)</b> resumes one process waiting on c; if none is waiting, nothing happens and the signal is <b>lost</b>. A semaphore instead remembers signals in its count. Example: with nobody waiting, 3 <code>csignal(c)</code> calls followed by 4 <code>cwait(c)</code> calls leave all <b>4</b> suspended; with a semaphore starting at 0, the 3 signals are saved (count = 3) and only 1 of 4 <code>semWait</code> calls blocks. In correct monitor code a lost signal is harmless, because a later arrival checks the variables itself.</p>

<h3>The bounded buffer as a monitor</h3>
<p>N slots used as a ring: <code>nextin</code> is the next slot to fill, <code>nextout</code> the next to empty, <code>count</code> the number of full slots. Producers wait on <code>notfull</code>, consumers on <code>notempty</code>.</p>
<pre>monitor boundedbuffer;
char buffer[N];  int nextin, nextout, count;
cond notfull, notempty;
void append(char x) {
  if (count == N) cwait(notfull);  /* full: sleep */
  buffer[nextin] = x;              /* store item */
  nextin = (nextin + 1) % N;       /* advance, wrap */
  count++;                         /* one more item */
  csignal(notempty);               /* wake a consumer */
}
void take(char &amp;x) {
  if (count == 0) cwait(notempty); /* empty: sleep */
  x = buffer[nextout];             /* oldest item */
  nextout = (nextout + 1) % N;     /* advance, wrap */
  count--;                         /* one fewer item */
  csignal(notfull);                /* wake a producer */
}
{ nextin = 0; nextout = 0; count = 0; }  /* init */</pre>
<p>Producers loop <code>produce(x); append(x);</code> and consumers loop <code>take(x); consume(x);</code> with no synchronization of their own. <b>Ring index:</b> with N = 5 and <code>nextin = 4</code>, the next append stores into slot 4 and sets <code>nextin = (4 + 1) % 5 = 0</code>. <b>Traced run</b> (N = 3, Hoare): P1-P3 fill slots 0-2 (their signals are lost; nextin wraps to 0); P4 waits on <code>notfull</code>; C1 takes a and signals <code>notfull</code>, so P4 takes over at once while C1 waits in the urgent queue.</p>

<h3>Hoare monitors and their drawbacks</h3>
<p>Hoare's <code>csignal</code> hands the monitor <b>immediately</b> to the woken process, so its condition is guaranteed to hold and <code>if</code> is enough. The signaler must either leave at once (possible when csignal is its last statement) or wait in the urgent queue. Two drawbacks:</p>
<ol>
<li><b>Extra process switches:</b> if the signaler has not finished, the signal costs <b>two</b> extra switches, one to suspend it and one to resume it, however much work is left. Example: with switches of 0.5 ticks, identical work ends at 11.5 under Hoare versus 10.5 under Mesa.</li>
<li><b>Perfectly reliable scheduling:</b> the woken process must be the next one inside. If another gets in first, the condition may be false again.</li>
</ol>

<h3>Lampson/Redell (Mesa) monitors</h3>
<p>Mesa replaces csignal with <b>cnotify(x)</b>: a waiter on x becomes ready but the notifier keeps running. The waiter resumes at some later, convenient time, and others may enter first. Example: C1 waits on an empty buffer; P1 stores a, notifies and leaves; C2, already at the entrance, gets in first and takes a. With <code>if</code>, C1 then takes from an empty buffer (count = -1). The fix costs only a cheap re-test:</p>
<pre>while (count == 0) cwait(notempty);   /* consumer */
while (count == N) cwait(notfull);    /* producer */</pre>
<p><b>cbroadcast(x)</b> makes every waiter on x ready, and each re-tests. Use it when one change may satisfy several waiters and the signaler cannot tell which. Example: 5 KB free, requests for 40, 10 and 25 KB wait; a release of 30 KB leaves 35 KB. cnotify wakes only the 40 KB request, which fails, so 35 KB sits idle; cbroadcast lets the 10 and 25 KB requests succeed. Broadcast is wasteful when only one waiter can benefit. POSIX threads (<code>pthread_cond_signal</code>, <code>pthread_cond_broadcast</code>) and Java (<code>notify</code>, <code>notifyAll</code>) follow Mesa rules.</p>
<p><b>Watchdog timer:</b> a wait may carry a time limit; when it expires the waiter is made ready anyway and re-tests. Example: C waits from t = 1; a producer stores an item at t = 8 but forgets cnotify. No timer: C sleeps forever. Limit 2: C wakes at 3, 5 and 7 (count = 0, back to sleep) and takes the item at 9, 1 tick late. With <code>if</code>, the wake-up at 3 would take from an empty buffer, so timers are safe only with <code>while</code>.</p>
<p><b>Advantages of Mesa:</b> fewer process switches; less error-prone (early, extra or stray wake-ups are harmless because every waiter re-tests); more modular (a notifier need not know who waits or why).</p>

<h3>Summary: Hoare vs Mesa</h3>
<table>
<tr><th></th><th>Hoare (csignal)</th><th>Mesa (cnotify, cbroadcast)</th></tr>
<tr><td>After a signal</td><td>Woken process runs at once; an unfinished signaler waits (urgent queue)</td><td>Signaler keeps running; waiter resumes later</td></tr>
<tr><td>Waiter's test</td><td>if is enough</td><td>while is required</td></tr>
<tr><td>Cost</td><td>2 extra switches if the signaler is not done</td><td>No extra switches, a cheap re-test</td></tr>
<tr><td>Scheduling</td><td>Must be perfectly reliable</td><td>Tolerant of extra or early wake-ups</td></tr>
<tr><td>Extras</td><td>None</td><td>cbroadcast; optional watchdog timer</td></tr>
</table>`,
  });
})();
