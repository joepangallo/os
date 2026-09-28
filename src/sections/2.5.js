/* Section 2.5 — Fault Tolerance
   Original teaching material. Built step by step (see AUTHORING.txt). */
Guide.section({
  id: '2.5',
  title: 'Fault Tolerance',
  short: 'Fault tolerance',
  summary: 'Reliability, MTTF, MTTR and availability, the kinds of faults, and how redundancy and the OS mask them.',
  objectives: [
    'Define fault tolerance and explain why it relies on redundancy, and what that redundancy costs.',
    'Define reliability R(t), MTTF and MTTR, then calculate availability as MTTF / (MTTF + MTTR) and the downtime it allows per year.',
    'Place a system in the right availability class, from normal availability up to continuous.',
    'Classify faults as permanent, transient or intermittent, and match spatial, temporal and information redundancy to the faults each one handles.',
    'Describe how process isolation, concurrency controls, virtual machines, and checkpoints with rollback help an operating system survive faults.',
  ],
  terms: [
    ['Fault tolerance', 'The ability of a system or component to keep operating normally even when some of its hardware or software has developed faults.'],
    ['Redundancy', 'Extra resources (spare parts, repeated work, or extra information) that are not needed while everything works but can take over or undo the damage when something fails.'],
    ['Reliability', 'Written R(t): the probability that a system operates correctly for the whole period from time 0 up to time t, given that it was operating correctly at time 0.'],
    ['Mean time to failure (MTTF)', 'The average length of time a system runs correctly, from being started or repaired, until it next fails.'],
    ['Mean time to repair (MTTR)', 'The average time it takes to find a fault and repair or replace the failed part so that the system works again.'],
    ['Availability', 'The fraction of time a system is up and able to serve requests. Over the long run it equals MTTF / (MTTF + MTTR). The security goal of the same name (section 2.3) makes the same promise against attacks rather than failures.'],
    ['Fault', 'An erroneous state of hardware or software. Causes include a failed component, operator error, physical interference from the surroundings, a design error, a program error or a corrupted data structure.'],
    ['Permanent fault', 'A fault that, once it occurs, is present all the time until the faulty part is repaired or replaced, such as a disk head crash or a software bug.'],
    ['Temporary fault', 'A fault that is not present all the time. It comes in two kinds: transient and intermittent.'],
    ['Transient fault', 'A temporary fault that happens only once, such as a bit flipped by an electrical noise spike or by radiation. Trying the operation again usually succeeds.'],
    ['Intermittent fault', 'A temporary fault that comes and goes at several unpredictable times, such as a loose connection.'],
    ['Spatial redundancy', 'Also called physical redundancy: several physical components perform the same function at the same time, or a spare stands by, ready to take over.'],
    ['Temporal redundancy', 'Repeating an operation when an error is detected. It works well against temporary faults but cannot fix a permanent one.'],
    ['Information redundancy', 'Storing extra bits (a code) or extra copies of data so that errors in the data can be detected and often corrected.'],
    ['Triple modular redundancy (TMR)', 'Three identical units compute the same result and a voter outputs the majority answer, so a single faulty unit is outvoted.'],
    ['Race condition', 'A fault that appears when two processes or threads read and write the same shared data and the final result depends on the exact order in which their steps happen to interleave.'],
    ['Process isolation', 'The OS, helped by memory-protection hardware, keeps each process inside its own memory, files and flow of execution, so a faulty process cannot damage other processes or the OS.'],
    ['Virtual machine (VM)', 'A software-made copy of a whole computer that runs its own operating system. Several VMs share one physical machine but are strongly isolated from one another.'],
    ['Checkpoint', 'A saved copy of a program\'s or system\'s state, taken at a moment when that state is consistent and kept in storage that the expected failure cannot destroy, so work can resume from there.'],
    ['Rollback', 'Recovering from a failure by discarding the damaged current state, restoring the most recent checkpoint, and redoing the work done since then.'],
  ],

  css: `
    /* shell workaround: in narrow mode the nowrap eyebrow otherwise sets the canvas min-width */
    .sec-2-5 .step-eyebrow { contain: inline-size; }
    .sec-2-5 .hot { cursor: pointer; }
    .sec-2-5 .callout, .sec-2-5 .card.tight { flex-shrink: 0; }
    .sec-2-5 .hot:hover > rect { stroke-width: 3.5; }
    .sec-2-5 .kv { display: grid; grid-template-columns: auto 1fr; gap: 2px 12px; font-size: 14.5px; line-height: 1.4; }
    .sec-2-5 .kv b { font-family: var(--mono); }
    .sec-2-5 .formula { font-family: var(--mono); font-weight: 800; font-size: 19px; text-align: center; padding: 8px 10px; border-radius: 10px; background: var(--panel); border: 2px solid var(--chc); }
    .sec-2-5 .lbl { display: block; font-size: 11.5px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
    .sec-2-5 .tgl.on { background: var(--ok-bg); border-color: var(--ok); color: var(--ok); }
    .sec-2-5 .flt { border-color: var(--intr); color: var(--intr); }
    .sec-2-5 .flt:hover { background: var(--intr-bg); color: var(--intr); }
    .sec-2-5 .stat { display: flex; flex-direction: column; gap: 0; }
    .sec-2-5 .stat .big { font-size: 32px; }
    .sec-2-5 .stats { display: grid; grid-template-columns: repeat(var(--n), minmax(0, 1fr)); gap: 10px; }
    .sec-2-5 .nar .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .sec-2-5 .nar .stat .big { font-size: 26px !important; }
    .sec-2-5 .nar .tmr-row { grid-template-columns: 46px repeat(8, minmax(0, 1fr)) 30px; gap: 4px; }
    .sec-2-5 .nar .tmr-row .chip { grid-column: 2 / -1; }
    .sec-2-5 .nar .tmr-row > .b { font-size: 13px; }
    .sec-2-5 .nar .tbit { height: 34px; font-size: 16px; }
    .sec-2-5 .nar .pgrid { grid-template-columns: 40px repeat(5, minmax(0, 1fr)) 26px; gap: 4px; }
    .sec-2-5 .nar .pbit { height: 36px; font-size: 17px; }
    .sec-2-5 .nar .txstrip { flex-wrap: wrap; }
    .sec-2-5 .nar .tx { flex: 1 1 64px; }
    .sec-2-5 .rung { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 0 10px; align-items: baseline; padding: 5px 12px 7px; border: 2px solid var(--line); border-radius: 10px; background: var(--panel); transition: border-color .2s, background .2s; }
    .sec-2-5 .rung .nm { font-weight: 800; font-size: 15.5px; }
    .sec-2-5 .rung .av { font-family: var(--mono); font-weight: 800; font-size: 15px; }
    .sec-2-5 .rung .dt { font-size: 13.5px; color: var(--ink-2); }
    .sec-2-5 .rung .bar { grid-column: 1 / -1; height: 7px; margin-top: 3px; background: var(--panel-3); border-radius: 9px; overflow: hidden; }
    .sec-2-5 .rung .bar > i { display: block; height: 100%; background: var(--bad); opacity: .75; border-radius: 9px; }
    .sec-2-5 .cause { display: flex; flex-direction: column; padding: 3px 10px 4px; border-radius: 9px; background: var(--intr-bg); border-left: 4px solid var(--intr); font-size: 13px; line-height: 1.3; color: var(--ink-2); }
    .sec-2-5 .cause b { font-size: 14.5px; color: var(--ink); }
    .sec-2-5 .fbtn { height: 46px; font-size: 16.5px; font-weight: 750; }
    .sec-2-5 .fbtn:disabled { opacity: .6; }
    .sec-2-5 .fbtn.ok { background: var(--ok-bg); border-color: var(--ok); color: var(--ok); opacity: 1; }
    .sec-2-5 .fbtn.bad { background: var(--bad-bg); border-color: var(--bad); color: var(--bad); opacity: 1; }
    .sec-2-5 .fixrow { display: grid; grid-template-columns: 104px 1fr; gap: 8px; padding: 3px 8px; border-radius: 8px; font-size: 14px; line-height: 1.35; border: 1px solid transparent; }
    .sec-2-5 .fixrow.on { background: var(--accent-bg); border-color: var(--accent); }
    .sec-2-5 .pill { flex: 1; height: 8px; border-radius: 9px; background: var(--panel-3); border: 1px solid var(--line-2); }
    .sec-2-5 .pill.ok { background: var(--ok); border-color: var(--ok); }
    .sec-2-5 .pill.bad { background: var(--bad); border-color: var(--bad); }
    .sec-2-5 .pill.cur { outline: 2px solid var(--chc); outline-offset: 1px; }
    .sec-2-5 .tmr-row { display: grid; grid-template-columns: 62px repeat(8, minmax(0, 1fr)) 44px 120px; gap: 5px; align-items: center; font-size: 14.5px; }
    .sec-2-5 .tmr-row .chip { justify-self: start; }
    .sec-2-5 .tbit { height: 40px; border-radius: 7px; border: 2px solid var(--line-2); background: var(--panel); font-family: var(--mono); font-size: 19px; font-weight: 800; color: var(--ink); cursor: pointer; display: grid; place-items: center; padding: 0; }
    .sec-2-5 button.tbit:hover { border-color: var(--chc); }
    .sec-2-5 .tbit.wbit { background: var(--bad-bg); border-color: var(--bad); color: var(--bad); }
    .sec-2-5 .tbit.lose { text-decoration: line-through; }
    .sec-2-5 .tbit.out { cursor: default; background: var(--os-bg); border-color: var(--os); }
    .sec-2-5 .tbit.out.wbit { background: var(--bad-bg); border-color: var(--bad); }
    .sec-2-5 .dec { font-family: var(--mono); font-weight: 800; font-size: 16px; text-align: right; }
    .sec-2-5 .voter { text-align: center; font-size: 13px; font-weight: 800; letter-spacing: .04em; color: var(--os); background: var(--os-bg); border-radius: 8px; padding: 3px 0; }
    .sec-2-5 .pgrid { display: grid; grid-template-columns: 46px repeat(4, 44px) 50px 42px; gap: 5px; align-items: center; justify-items: stretch; }
    .sec-2-5 .pbit { height: 40px; border-radius: 7px; border: 2px solid var(--line-2); background: var(--panel); font-family: var(--mono); font-size: 19px; font-weight: 800; color: var(--ink); cursor: pointer; padding: 0; }
    .sec-2-5 .pbit:hover { border-color: var(--chc); }
    .sec-2-5 .pbit.par { background: var(--os-bg); border-color: var(--os); }
    .sec-2-5 .pbit.inrow, .sec-2-5 .pbit.incol { background: var(--warn-bg); }
    .sec-2-5 .pbit.wbit { color: var(--bad); border-color: var(--bad); }
    .sec-2-5 .pbit.hit { box-shadow: 0 0 0 3px var(--bad); background: var(--bad-bg); }
    .sec-2-5 .pchk { text-align: center; font-weight: 900; font-size: 18px; }
    .sec-2-5 .pchk.ok { color: var(--ok); } .sec-2-5 .pchk.bad { color: var(--bad); }
    .sec-2-5 .mech { padding: 7px 12px; border-radius: 10px; border: 1px solid var(--line); border-left: 5px solid var(--c, var(--line-2)); background: var(--panel-2); font-size: 14px; line-height: 1.38; color: var(--ink-2); }
    .sec-2-5 .mech > b { display: block; font-size: 15.5px; color: var(--c); }
    .sec-2-5 .mech.proc { --c: var(--proc); } .sec-2-5 .mech.thread { --c: var(--thread); } .sec-2-5 .mech.os { --c: var(--os); } .sec-2-5 .mech.mem { --c: var(--mem); }
    .sec-2-5 .flt.on { background: var(--intr-bg); }
    .sec-2-5 .txstrip { display: flex; gap: 5px; align-items: stretch; }
    .sec-2-5 .tx { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; padding: 4px 2px; border: 2px solid var(--line-2); border-radius: 9px; background: var(--panel); line-height: 1.25; }
    .sec-2-5 .tx b { font-size: 15px; } .sec-2-5 .tx span { font-size: 12px; white-space: nowrap; color: var(--ink-2); } .sec-2-5 .tx i { font-style: normal; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .03em; color: var(--muted); }
    .sec-2-5 .tx.saved { background: var(--ok-bg); border-color: var(--ok); } .sec-2-5 .tx.saved i { color: var(--ok); }
    .sec-2-5 .tx.unsaved { background: var(--warn-bg); border-color: var(--warn); } .sec-2-5 .tx.unsaved i { color: var(--warn); }
    .sec-2-5 .tx.redo { background: var(--warn-bg); border-color: var(--warn); border-style: dashed; } .sec-2-5 .tx.redo i { color: var(--warn); }
    .sec-2-5 .tx.half { background: var(--bad-bg); border-color: var(--bad); } .sec-2-5 .tx.half i { color: var(--bad); }
    .sec-2-5 .cpmark { flex: none; width: 22px; display: flex; align-items: center; justify-content: center; writing-mode: vertical-rl; transform: rotate(180deg); background: var(--os); color: var(--panel); border-radius: 6px; font-size: 10.5px; font-weight: 900; letter-spacing: .05em; text-transform: uppercase; }
    .sec-2-5 .rung.on { border-color: var(--chc); background: color-mix(in srgb, var(--chc) 11%, var(--panel)); }
    .sec-2-5 .cc-code { display: grid; grid-template-columns: 50px 50px auto minmax(0, 1fr); gap: 2px 10px; align-items: center; }
    .sec-2-5 .cc-hd { font-size: 11.5px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
    .sec-2-5 .cc-line { font-family: var(--mono); font-size: 15px; font-weight: 700; padding: 2px 9px; border-radius: 7px; background: var(--panel-3); white-space: nowrap; }
    .sec-2-5 .cc-line.lk { background: var(--os-bg); color: var(--os); }
    .sec-2-5 .cc-line.cur { box-shadow: inset 0 0 0 2px var(--chc); }
    .sec-2-5 .cc-com { font-size: 13.5px; color: var(--ink-2); line-height: 1.3; }
    .sec-2-5 .cc-mk { display: flex; justify-content: center; min-height: 24px; align-items: center; }
    .sec-2-5 .cc-trace { display: flex; flex-wrap: wrap; gap: 4px; align-content: flex-start; height: 74px; padding: 6px 8px; }
    .sec-2-5 .cc-trace > .chip { font-size: 12.5px; line-height: 1.4; padding: 0 7px; }
    .sec-2-5 .cc-card > .chip { align-self: flex-start; }
    .sec-2-5 .nar .cc-code { grid-template-columns: 44px 44px minmax(0, 1fr); }
    .sec-2-5 .nar .cc-com { grid-column: 3; margin-bottom: 4px; }
    .sec-2-5 .nar .cc-hd.cmt { display: none; }
    .sec-2-5 .btn.acc { border-color: var(--accent); color: var(--accent); }
    .sec-2-5 .cc-card { display: flex; flex-direction: column; gap: 1px; padding: 6px 10px; border-radius: 10px; border: 2px solid var(--line); background: var(--panel-2); min-width: 0; }
    .sec-2-5 .cc-card .big { font-size: 28px; }
    .sec-2-5 .cc-card.shared { border-color: var(--mem); background: var(--mem-bg); }
  `,

  steps: [
    /* ---------------- 1. Big picture: what fault tolerance is + break-it-yourself store ---------------- */
    {
      title: 'Parts will fail. The system should not.',
      kind: 'story',
      render(el, ctx) {
        const { h, s } = ctx;
        const st = { psu2: false, mirror: false, standby: false, fPsu: false, fDisk: false, fSw: false };
        const nar = ctx.narrow; /* phones: Server B is drawn below Server A so the labels stay readable */
        const svg = s('svg', { viewBox: nar ? '0 0 410 412' : '0 0 640 226', width: '100%', style: 'flex:none' });
        const status = h('div', { class: 'callout m0 small', style: { lineHeight: '1.4', minHeight: '84px', flex: 'none' } });
        const cost = h('div', { class: 'small', style: { lineHeight: '1.35', flex: '1' } });
        const meter = h('div', { class: 'meter', style: { width: '120px', flex: 'none' } }, h('i'));
        const box = (x, y, w, label, cls, dashed) => s('g', {},
          s('rect', { x, y, width: w, height: 34, rx: 8, class: cls, 'stroke-width': 2, 'stroke-dasharray': dashed ? '6 5' : null }),
          s('text', { x: x + w / 2, y: y + 22, 'text-anchor': 'middle', 'font-size': 14.5, 'font-weight': 700, class: dashed ? 's-sub' : null }, label));
        function aUp() { return !st.fSw && (!st.fPsu || st.psu2) && (!st.fDisk || st.mirror); }
        function draw() {
          const up = aUp(), serving = up ? 'A' : st.standby ? 'B' : null;
          const k = [];
          const cx = nar ? 100 : 220;
          k.push(s('rect', { x: cx, y: 2, width: 200, height: 34, rx: 10, class: 's-proc', 'stroke-width': 2 }),
            s('text', { x: cx + 100, y: 24, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800 }, 'Customers'));
          const arrow = (d, on) => s('path', { d, fill: 'none', 'stroke-width': on ? 3 : 2, style: on ? 'stroke:var(--ok)' : 'stroke:var(--line-2)', 'stroke-dasharray': on ? null : '5 5', 'marker-end': on ? 'url(#arr-ok)' : 'url(#arr-muted)' });
          k.push(arrow(nar ? 'M200 36V54' : 'M270 36L200 54', serving === 'A'), arrow(nar ? 'M300 19H402V325H238' : 'M370 36L520 54', serving === 'B'));
          /* server A */
          k.push(s('rect', { x: 10, y: 56, width: 380, height: 166, rx: 14, class: up ? 's-panel' : 's-bad', 'stroke-width': 2 }),
            s('text', { x: 26, y: 79, 'font-size': 15, 'font-weight': 800 }, 'Server A · primary'),
            s('text', { x: 374, y: 79, 'text-anchor': 'end', 'font-size': 14, 'font-weight': 900, style: up ? 'fill:var(--ok)' : 'fill:var(--bad)' }, up ? (serving === 'A' ? 'UP · SERVING' : 'UP') : 'DOWN'));
          k.push(box(24, 90, 352, st.fSw ? '✗ OS crashed' : 'OS + store software', st.fSw ? 's-bad' : 's-os'));
          k.push(box(24, 132, 168, st.fPsu ? '✗ Power 1 burned out' : 'Power 1', st.fPsu ? 's-bad' : 's-io'));
          k.push(st.psu2 ? box(208, 132, 168, st.fPsu ? 'Power 2 · carrying load' : 'Power 2 · spare', st.fPsu ? 's-ok' : 's-io') : box(208, 132, 168, 'no spare power', 's-muted', true));
          k.push(box(24, 176, 168, st.fDisk ? '✗ Disk 1 crashed' : 'Disk 1', st.fDisk ? 's-bad' : 's-mem'));
          k.push(st.mirror ? box(208, 176, 168, st.fDisk ? 'Mirror · has every file' : 'Mirror disk', st.fDisk ? 's-ok' : 's-mem') : box(208, 176, 168, 'no mirror disk', 's-muted', true));
          /* server B (on phones the whole group is moved below Server A) */
          const kB = [];
          if (st.standby) {
            kB.push(s('rect', { x: 410, y: 56, width: 220, height: 166, rx: 14, class: serving === 'B' ? 's-ok' : 's-panel', 'stroke-width': 2 }),
              s('text', { x: 424, y: 79, 'font-size': 14.5, 'font-weight': 800 }, 'Server B'),
              s('text', { x: 616, y: 79, 'text-anchor': 'end', 'font-size': 13, 'font-weight': 900, style: 'fill:var(--ok)' }, serving === 'B' ? 'SERVING' : 'STANDBY · READY'),
              box(424, 90, 192, 'OS + store (own copy)', 's-os'), box(424, 132, 192, 'Power', 's-io'), box(424, 176, 192, 'Disk (synced copy)', 's-mem'));
          } else {
            kB.push(s('rect', { x: 410, y: 56, width: 220, height: 166, rx: 14, class: 's-muted', 'stroke-dasharray': '7 6' }),
              s('text', { x: 520, y: 144, 'text-anchor': 'middle', 'font-size': 14.5, 'font-weight': 700, class: 's-sub' }, 'no standby server'));
          }
          k.push(s('g', { transform: nar ? 'translate(-400 186)' : null }, ...kB));
          svg.replaceChildren(...k);
          /* narration */
          const masked = [];
          if (st.fPsu && st.psu2) masked.push('Power 1 died, but Power 2 took over the load');
          if (st.fDisk && st.mirror) masked.push('Disk 1 crashed, but the mirror holds a copy of every file');
          const why = [];
          if (st.fSw) why.push('a bug crashed its OS (spare parts cannot fix software)');
          if (st.fPsu && !st.psu2) why.push('its only power supply died');
          if (st.fDisk && !st.mirror) why.push('its only disk crashed' + (st.standby ? '' : ', maybe losing orders'));
          let cls, lab, msg;
          if (!st.fPsu && !st.fDisk && !st.fSw) {
            cls = 'tip'; lab = 'Store online';
            msg = (st.psu2 || st.mirror || st.standby) ? 'Nothing is broken. The spare parts sit idle, costing money, waiting for the day they are needed. Now inject a fault.' : 'Nothing is broken yet, but nothing is spare either: <b>any one</b> failure will take the store down. Try a fault, then add redundancy and try again.';
          } else if (up) {
            cls = 'tip'; lab = 'Store online · fault tolerated';
            msg = masked.join('; ') + '. Customers never noticed. That is <span class="t">fault tolerance</span>: normal operation continues despite the fault.';
          } else if (st.standby) {
            cls = 'tip'; lab = 'Store online · failover to Server B';
            msg = 'Server A is down: ' + why.join('; ') + '. Server B, kept in step all along, takes over in seconds.' + (st.fSw ? ' But identical copies share identical bugs: if the same input reaches B, it crashes too.' : '');
          } else {
            cls = 'bad'; lab = 'Store offline';
            msg = 'Server A is down: ' + why.join('; ') + '. Nothing was ready to take over, so every customer is turned away until someone repairs it.';
          }
          status.className = 'callout m0 small ' + cls;
          status.setAttribute('data-label', lab);
          status.innerHTML = msg;
          /* a standby server is a full second copy of Server A, so it costs what A costs */
          const extra = (st.psu2 ? 200 : 0) + (st.mirror ? 300 : 0) + (st.standby ? 3000 : 0);
          meter.firstChild.style.width = ((3000 + extra) / 6500) * 100 + '%';
          const cov = [['power failure', st.psu2 || st.standby], ['disk crash', st.mirror || st.standby], [st.standby ? 'OS crash (usually)' : 'OS crash', st.standby]];
          cover.replaceChildren(h('span', { class: 'lbl', style: { width: '98px' } }, 'Survives'),
            ...cov.map(([n, ok]) => h('span', { class: 'chip ' + (ok ? 'ok' : 'bad') }, (ok ? '✓ ' : '✗ ') + n)));
          const perf = [st.mirror ? 'writes go to two disks' : null, st.standby ? 'changes are copied to B' : null].filter(Boolean);
          cost.innerHTML = `<b>Cost $${(3000 + extra).toLocaleString('en-US')}</b>${extra ? ` (+${Math.round((extra / 3000) * 100)}%)` : ''} · ${perf.length ? 'slower: ' + perf.join(', ') : 'redundancy costs money and often speed'}`;
          tg.forEach(([b, key]) => { b.classList.toggle('on', st[key]); b.setAttribute('aria-pressed', st[key]); });
          fl.forEach(([b, key]) => { b.disabled = st[key]; });
        }
        const tg = [['psu2', 'Second power supply'], ['mirror', 'Mirror disk'], ['standby', 'Standby server']].map(([key, label]) => [h('button', { class: 'btn sm tgl', type: 'button', onclick: () => { st[key] = !st[key]; draw(); } }, '+ ' + label), key]);
        const fl = [['fPsu', 'Power supply dies'], ['fDisk', 'Disk crashes'], ['fSw', 'OS crashes']].map(([key, label]) => [h('button', { class: 'btn sm flt', type: 'button', onclick: () => { st[key] = true; draw(); } }, label), key]);
        const repair = h('button', { class: 'btn sm ghost', type: 'button', onclick: () => { st.fPsu = st.fDisk = st.fSw = false; draw(); } }, 'Repair all');
        const cover = h('div', { class: 'row', style: { gap: '6px' } });
        const left = h('div', { class: 'stack', style: { gap: '10px' } },
          h('p', { class: 'lead m0', html: 'Hardware wears out and software has bugs. <span class="t">Fault tolerance</span> is the ability of a system or component to <b>keep operating normally</b> even when some of its hardware or software has developed a <span class="t">fault</span>.' }),
          h('p', { class: 'm0', style: { fontSize: '16px' }, html: 'The usual recipe is <span class="t">redundancy</span>: spare parts, repeated work or extra information that can step in when something breaks. Redundancy is never free. It costs money, and it often costs some performance.' }),
          h('div', { class: 'callout analogy m0', 'data-label': 'Analogy', style: { fontSize: '15.5px' }, html: 'A hospital keeps a diesel generator that starts within seconds of a power cut. Nobody hopes to use it and it costs money every year, but it is why surgery never stops in the dark.' }),
          h('div', { class: 'card tight', style: { fontSize: '14.5px', lineHeight: '1.4' } }, h('h4', {}, 'In this section you will'),
            h('ol', { class: 'm0', style: { paddingLeft: '20px' }, html: '<li>measure reliability and availability with real numbers</li><li>place a system on the ladder of "nines"</li><li>classify faults: permanent, transient, intermittent</li><li>try spatial, temporal and information redundancy</li><li>see how the OS helps: isolation, virtual machines, locks, checkpoints</li>' })));
        const right = h('div', { class: 'card white stack', style: { gap: '8px' } },
          h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { class: 'm0' }, 'Break it yourself: an online store'), h('span', { class: 'small muted' }, 'add spares, then inject faults')),
          svg,
          h('div', { class: 'row', style: { gap: '6px' } }, h('span', { class: 'lbl', style: { width: '98px' } }, 'Redundancy'), ...tg.map((x) => x[0])),
          cover,
          h('div', { class: 'row', style: { gap: '6px' } }, h('span', { class: 'lbl', style: { width: '98px' } }, 'Faults'), ...fl.map((x) => x[0]), repair),
          status,
          h('div', { class: 'row nw', style: { gap: '10px' } }, meter, cost));
        el.append(h('div', { class: 'split l fill' }, left, right));
        draw();
      },
    },

    /* ---------------- 2. Reliability R(t) and MTTF: a fleet of 100 machines ---------------- */
    {
      title: 'Reliability: will it still be working at time t?',
      kind: 'explore',
      render(el, ctx) {
        const { h, s } = ctx;
        if (ctx.narrow) el.classList.add('nar');
        const N = 100, TMAX = 4000;
        let mttf = 1000, t = 500, seed = 7, u = [];
        const newFleet = () => { const r = ctx.util.seeded(seed); u = ctx.util.range(N).map(() => 1 - r()); };
        const life = () => u.map((x) => -mttf * Math.log(x));
        const grid = s('svg', { viewBox: '0 0 250 250', width: '100%', style: 'max-width:222px;display:block;margin:0 auto' });
        const chart = s('svg', { viewBox: '0 0 380 236', width: '100%' });
        const k1 = h('div', { class: 'big', style: { fontSize: '30px' } }), k2 = h('div', { class: 'big', style: { fontSize: '30px' } }), k3 = h('div', { class: 'big', style: { fontSize: '30px' } });
        const say = h('div', { class: 'callout m0 small', style: { lineHeight: '1.4', minHeight: '58px' } });
        const X0 = 46, X1 = 368, Y0 = 12, Y1 = 192;
        const px = (tt) => X0 + (tt / TMAX) * (X1 - X0), py = (r) => Y1 - r * (Y1 - Y0);
        function draw() {
          const L = life(), alive = L.filter((x) => x > t).length, f = Math.exp(-t / mttf);
          const mean = L.reduce((a, b) => a + b, 0) / N;
          /* dot grid */
          const dots = [];
          L.forEach((x, i) => {
            const cx = 17 + (i % 10) * 24, cy = 17 + Math.floor(i / 10) * 24, ok = x > t;
            dots.push(s('circle', { cx, cy, r: 9, class: ok ? 's-ok' : 's-bad', 'stroke-width': 2 }));
            if (!ok) dots.push(s('path', { d: `M${cx - 4} ${cy - 4}L${cx + 4} ${cy + 4}M${cx + 4} ${cy - 4}L${cx - 4} ${cy + 4}`, style: 'stroke:var(--bad)', 'stroke-width': 2.2 }));
          });
          grid.replaceChildren(...dots);
          /* chart */
          const kids = [];
          for (let r = 0; r <= 1.0001; r += 0.25) kids.push(s('line', { x1: X0, y1: py(r), x2: X1, y2: py(r), style: 'stroke:var(--line)' }), s('text', { x: X0 - 6, y: py(r) + 4, 'text-anchor': 'end', 'font-size': 12.5, class: 's-sub' }, r.toFixed(2)));
          for (let tt = 0; tt <= TMAX; tt += 1000) kids.push(s('text', { x: px(tt), y: Y1 + 18, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, tt === 0 ? '0' : (tt / 1000) + 'k h'));
          kids.push(s('text', { x: (X0 + X1) / 2, y: Y1 + 38, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, 'time t (hours)'));
          let d = '';
          for (let i = 0; i <= 160; i++) { const tt = (i / 160) * TMAX; d += (i ? 'L' : 'M') + px(tt).toFixed(1) + ' ' + py(Math.exp(-tt / mttf)).toFixed(1); }
          kids.push(s('path', { d, fill: 'none', style: 'stroke:var(--chc)', 'stroke-width': 3 }));
          const sorted = L.slice().sort((a, b) => a - b);
          let sd = `M${px(0)} ${py(1)}`, prev = 1;
          sorted.forEach((x, i) => { if (x > TMAX) return; const r = (N - i - 1) / N; sd += `L${px(x).toFixed(1)} ${py(prev).toFixed(1)}L${px(x).toFixed(1)} ${py(r).toFixed(1)}`; prev = r; });
          sd += `L${px(TMAX)} ${py(prev).toFixed(1)}`;
          kids.push(s('path', { d: sd, fill: 'none', style: 'stroke:var(--mem)', 'stroke-width': 2, 'stroke-dasharray': '5 3' }));
          kids.push(s('line', { x1: px(mttf), y1: Y0, x2: px(mttf), y2: Y1, style: 'stroke:var(--muted)', 'stroke-dasharray': '2 4', 'stroke-width': 1.5 }),
            s('text', { x: px(mttf) + 5, y: Y0 + 10, 'font-size': 12.5, 'font-weight': 700, class: 's-sub' }, 't = MTTF'),
            s('text', { x: px(mttf) + 9, y: py(Math.exp(-1)) - 7, 'font-size': 12.5, 'font-weight': 700, class: 's-sub' }, '0.37'),
            s('circle', { cx: px(mttf), cy: py(Math.exp(-1)), r: 3.5, style: 'fill:var(--muted)' }));
          kids.push(s('line', { x1: px(t), y1: Y0, x2: px(t), y2: Y1, style: 'stroke:var(--ink-2)', 'stroke-width': 2 }),
            s('circle', { cx: px(t), cy: py(f), r: 6, style: 'fill:var(--chc);stroke:var(--panel)', 'stroke-width': 2 }));
          chart.replaceChildren(...kids);
          k1.textContent = alive + ' / 100';
          k2.textContent = f.toFixed(2);
          k3.textContent = Math.round(mean).toLocaleString('en-US') + ' h';
          const atM = Math.abs(t - mttf) < 1;
          say.className = 'callout m0 small ' + (atM ? 'warn' : 'why');
          say.setAttribute('data-label', atM ? 'Look: t equals the MTTF' : 'What you see');
          say.innerHTML = atM
            ? `${alive} of 100 machines still run at t = MTTF; the formula predicts 37, and with only 100 machines chance moves the count by several either way. Most machines fail <b>before</b> the MTTF: it is an <b>average</b> lifetime (${Math.round(mean).toLocaleString('en-US')} h for this fleet), not a promise.`
            : t === 0 ? 'At t = 0 every machine works, so R(0) = 1. Drag the time slider to the right and watch machines drop out.'
              : `By ${t.toLocaleString('en-US')} h, ${N - alive} machines have failed, so R(${t.toLocaleString('en-US')} h) ≈ ${(alive / N).toFixed(2)} for this fleet. The formula says ${f.toFixed(2)}; the gap is chance.`;
        }
        const s1 = ctx.ui.slider({ label: 'MTTF', min: 200, max: 2000, step: 100, value: mttf, format: (v) => v.toLocaleString('en-US') + ' h', onInput: (v) => { mttf = v; draw(); } });
        const s2 = ctx.ui.slider({ label: 'Time t', min: 0, max: TMAX, step: 50, value: t, format: (v) => v.toLocaleString('en-US') + ' h', onInput: (v) => { t = v; draw(); } });
        const again = h('button', { class: 'btn sm', type: 'button', onclick: () => { seed += 1; newFleet(); draw(); } }, 'New random fleet');
        const atMttf = h('button', { class: 'btn sm', type: 'button', onclick: () => { t = mttf; s2.set(t); draw(); } }, 'Set t = MTTF');
        const stat = (big, label) => h('div', { class: 'stat' }, h('span', { class: 'lbl' }, label), big);
        const left = h('div', { class: 'stack', style: { gap: '10px' } },
          h('p', { class: 'lead m0', html: '<span class="t">Reliability</span>, written <b>R(t)</b>, is the probability that a system operates correctly <b>the whole time</b> from 0 up to time t, given that it was working at time 0.' }),
          h('p', { class: 'm0', style: { fontSize: '15.5px', lineHeight: '1.45' }, html: 'R(0) = 1, and R(t) never rises as t grows: a longer stretch gives more chances to break. The <span class="t">mean time to failure (MTTF)</span> is the average time a unit runs, from a fresh start, before it fails. A bigger MTTF means a more reliable unit.' }),
          h('div', { class: 'card tight small', style: { lineHeight: '1.4' }, html: '<b>How to read it:</b> R(500 h) = 0.61 means about 61% of identical machines started together run 500 hours with no failure.' }),
          h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: '"MTTF is 1,000 hours, so it will run 1,000 hours." No: MTTF is an average. When failures strike at random at a steady rate (the model used here, R(t) = e<sup>−t/MTTF</sup>), only about 37% of units are still running at t = MTTF.' }),
          h('div', { class: 'callout why m0 small', 'data-label': 'Why it matters', html: 'Scale turns rare into routine: 10,000 disks with an MTTF of 1,000,000 hours each give 10,000 ÷ 1,000,000 = 0.01 failures per hour, a dead disk about <b>every 100 hours</b>.' }));
        const right = h('div', { class: 'card white stack', style: { gap: '8px' } },
          h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { class: 'm0' }, '100 machines, all switched on at t = 0'), h('div', { class: 'row', style: { gap: '6px' } }, atMttf, again)),
          s1, s2,
          h('div', { style: { display: 'grid', gridTemplateColumns: ctx.narrow ? '1fr' : 'minmax(0, 1fr) minmax(0, 1.55fr)', gap: '14px', alignItems: 'start' } },
            h('div', { class: 'stack', style: { gap: '2px' } }, grid, h('div', { class: 'xs muted center' }, 'green: still working · red: has failed')),
            h('div', { class: 'stack', style: { gap: '2px' } }, chart, h('div', { class: 'xs muted center', html: '<b style="color:var(--chc)">━</b> formula e<sup>−t/MTTF</sup> &nbsp; <b style="color:var(--mem)">╍</b> this fleet' }))),
          h('div', { class: 'stats', style: { '--n': 3 } }, stat(k1, 'still working at t'), stat(k2, 'formula R(t)'), stat(k3, 'average lifetime')),
          say);
        el.append(h('div', { class: 'split l fill' }, left, right));
        newFleet(); draw();
      },
    },

    /* ---------------- 3. MTTR, uptime/downtime and availability: simulate a year ---------------- */
    {
      title: 'Up, down, repaired: measuring availability',
      kind: 'explore',
      core: true, // on the shorter core path
      render(el, ctx) {
        const { h, s } = ctx;
        if (ctx.narrow) el.classList.add('nar');
        /* phones get a narrower drawing so the month labels stay readable */
        const YEAR = 8760, ROWS = 4, RW = YEAR / ROWS, BX = 44, BW = ctx.narrow ? 306 : 566;
        let mttf = 500, mttr = 50, year = 1, longRun = null;
        const tl = s('svg', { viewBox: ctx.narrow ? '0 0 360 166' : '0 0 620 166', width: '100%', style: 'flex:none' });
        const kF = h('div', { class: 'big' }), kD = h('div', { class: 'big' }), kM = h('div', { class: 'big' }), kA = h('div', { class: 'big' });
        const say = h('div', { class: 'callout why m0 small', 'data-label': 'Formula versus this year', style: { lineHeight: '1.42' } });
        function simulate(hours, seed) {
          const r = ctx.util.seeded(seed), ev = [];
          let t = 0, up = true, down = 0;
          while (t < hours) {
            const d = -(up ? mttf : mttr) * Math.log(1 - r());
            const e = Math.min(hours, t + d);
            ev.push([t, e, up]); if (!up) down += e - t;
            t = e; up = !up;
          }
          return { ev, down, fails: ev.filter((x) => !x[2]).length };
        }
        const fA = (a) => a.toFixed(a >= 0.99 ? 4 : 3), pct = (a) => (100 * a).toFixed(a >= 0.99 ? 2 : 1) + '%';
        function draw() {
          const A = mttf / (mttf + mttr);
          const sim = simulate(YEAR, 1000 + year * 17 + mttf * 3 + mttr);
          const k = [];
          for (let q = 0; q < ROWS; q++) {
            const y = 6 + q * 40;
            k.push(s('text', { x: 0, y: y + 20, 'font-size': 13, 'font-weight': 700, class: 's-sub' }, ['Jan', 'Apr', 'Jul', 'Oct'][q]));
            k.push(s('rect', { x: BX, y, width: BW, height: 30, rx: 5, class: 's-ok', 'stroke-width': 1.5 }));
          }
          sim.ev.forEach(([a, b, up]) => {
            if (up) return;
            for (let q = 0; q < ROWS; q++) {
              const lo = Math.max(a, q * RW), hi = Math.min(b, (q + 1) * RW);
              if (hi <= lo) continue;
              const x = BX + ((lo - q * RW) / RW) * BW, w = Math.max(2, ((hi - lo) / RW) * BW);
              k.push(s('rect', { x: Math.min(x, BX + BW - w), y: 6 + q * 40, width: w, height: 30, style: 'fill:var(--bad);opacity:.85' }));
            }
          });
          tl.replaceChildren(...k);
          kF.textContent = sim.fails;
          kD.textContent = Math.round(sim.down).toLocaleString('en-US') + ' h';
          const mA = 1 - sim.down / YEAR;
          kM.textContent = pct(mA);
          kA.textContent = pct(A);
          say.innerHTML = `Formula: A = ${mttf.toLocaleString('en-US')} / (${mttf.toLocaleString('en-US')} + ${mttr}) = <b>${fA(A)}</b>, so expect about (1 − ${fA(A)}) × 8,760 ≈ <b>${ctx.util.fmt((1 - A) * YEAR, (1 - A) * YEAR < 10 ? 1 : 0)} h</b> of downtime a year. This simulated year measured ${pct(mA)}: one year is a small, lucky-or-unlucky sample.` +
            (longRun ? ` Over <b>100 years</b> the measured availability was <b>${longRun}</b>, very close to the formula.` : ' Press <i>Run 100 years</i> to watch the average settle.');
        }
        const reset = () => { longRun = null; draw(); };
        const s1 = ctx.ui.slider({ label: 'MTTF', min: 50, max: 2000, step: 50, value: mttf, format: (v) => v.toLocaleString('en-US') + ' h', onInput: (v) => { mttf = v; reset(); } });
        const s2 = ctx.ui.slider({ label: 'MTTR', min: 1, max: 200, step: 1, value: mttr, format: (v) => v + ' h', onInput: (v) => { mttr = v; reset(); } });
        const again = h('button', { class: 'btn sm', type: 'button', onclick: () => { year += 1; longRun = null; draw(); } }, 'Another year');
        const hundred = h('button', { class: 'btn sm primary', type: 'button', onclick: () => { const sim = simulate(YEAR * 100, 99 + year); longRun = pct(1 - sim.down / (YEAR * 100)); draw(); } }, 'Run 100 years');
        const stat = (big, label, color) => { if (color) big.style.color = color; return h('div', { class: 'stat' }, h('span', { class: 'lbl' }, label), big); };
        const cycle = `<svg viewBox="0 0 460 92" width="100%">
          <text x="85" y="14" text-anchor="middle" font-size="13" font-weight="700" style="fill:var(--ok)">time to failure (avg MTTF)</text>
          <text x="196" y="14" text-anchor="middle" font-size="13" font-weight="700" style="fill:var(--bad)">MTTR</text>
          <path d="M2 24v-4h166v4M174 24v-4h44v4" class="s-line" stroke-width="1.5"/>
          <rect x="2" y="28" width="168" height="26" rx="4" class="s-ok" stroke-width="1.5"/><text x="86" y="46" text-anchor="middle" font-size="13.5" font-weight="700">up</text>
          <rect x="172" y="28" width="48" height="26" rx="4" class="s-bad" stroke-width="1.5"/><text x="196" y="46" text-anchor="middle" font-size="13.5" font-weight="700">down</text>
          <rect x="222" y="28" width="150" height="26" rx="4" class="s-ok" stroke-width="1.5" opacity=".6"/><text x="297" y="46" text-anchor="middle" font-size="13.5" font-weight="700">up</text>
          <rect x="374" y="28" width="40" height="26" rx="4" class="s-bad" stroke-width="1.5" opacity=".6"/><text x="394" y="46" text-anchor="middle" font-size="13" font-weight="700">down</text>
          <text x="436" y="46" font-size="15" class="s-sub">…</text>
          <path d="M2 60v4h216v-4" class="s-line" stroke-width="1.5"/>
          <text x="110" y="82" text-anchor="middle" font-size="13" class="s-sub">one cycle: MTTF + MTTR on average</text>
        </svg>`;
        const left = h('div', { class: 'stack', style: { gap: '9px' } },
          h('p', { class: 'lead m0', html: 'Real systems get repaired, so their life alternates between <b>uptime</b> and <b>downtime</b>.' }),
          h('div', { html: cycle, style: { flex: 'none' } }),
          h('p', { class: 'm0', style: { fontSize: '15.5px', lineHeight: '1.45' }, html: 'Average uptime is the <span class="t" data-t="Mean time to failure (MTTF)">MTTF</span> (mean time to failure). Average downtime per failure is the <span class="t">mean time to repair (MTTR)</span>: noticing, finding and fixing the fault. <span class="t">Availability</span> is the fraction of time the system is up and serving:' }),
          h('div', { class: 'formula' }, 'A = MTTF / (MTTF + MTTR)'),
          h('div', { class: 'card tight small', style: { lineHeight: '1.4' }, html: '<b>Worked example.</b> MTTF = 990 h, MTTR = 10 h. A = 990 / 1,000 = 0.99, so the system is down 1% of the year: 0.01 × 8,760 h ≈ <b>87.6&nbsp;h</b>.' }),
          h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'Reliability and availability are not the same. A server that crashes every hour but restarts in one second has poor reliability and excellent availability (about 99.97%).' }));
        const right = h('div', { class: 'card white stack', style: { gap: '9px' } },
          h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { class: 'm0' }, 'Simulate one year: 8,760 hours'), h('div', { class: 'row', style: { gap: '6px' } }, again, hundred)),
          s1, s2,
          h('div', { class: 'stack', style: { gap: '3px' } }, tl, h('div', { class: 'xs muted', html: '<b style="color:var(--ok)">green</b> = up, serving requests &nbsp;·&nbsp; <b style="color:var(--bad)">red</b> = down for repair &nbsp;·&nbsp; each row is three months' })),
          h('div', { class: 'stats', style: { '--n': 4 } }, stat(kF, 'failures'), stat(kD, 'downtime'), stat(kM, 'measured A'), stat(kA, 'formula A', 'var(--chc)')),
          say);
        el.append(h('div', { class: 'split l fill' }, left, right));
        draw();
      },
    },

    /* ---------------- 4. Availability classes: calculator + ladder of nines + predict ---------------- */
    {
      title: 'Counting nines: the availability classes',
      kind: 'lab',
      render(el, ctx) {
        const { h } = ctx;
        const Y = 8760;
        const CLASSES = [
          ['Continuous', '1.0', 'none at all', 0],
          ['Fault tolerant', '0.99999', '≈ 5 minutes', 0.00001 * Y],
          ['Fault resilient', '0.9999', '≈ 53 minutes', 0.0001 * Y],
          ['High availability', '0.999', '≈ 8.8 hours*', 0.001 * Y],
          ['Normal availability', '0.99 – 0.995', '≈ 44 – 87 hours', 0.01 * Y],
        ];
        const barW = (hrs) => (hrs <= 0 ? 0 : Math.max(4, Math.min(100, (Math.log10(hrs * 60) / Math.log10(6000)) * 100)));
        const rungs = CLASSES.map(([nm, av, dt, hrs], i) => h('div', { class: 'rung' },
          h('span', { class: 'nm' }, nm), h('span', { class: 'av' }, av),
          h('span', { class: 'dt' }, i === 0 ? 'never down: users see no outage at all' : 'down ' + dt + ' a year'), h('span', { class: 'xs muted', style: { textAlign: 'right' } }, i === 0 ? 'no downtime' : i === 4 ? '2 nines' : (6 - i) + ' nines'),
          h('div', { class: 'bar' }, h('i', { style: { width: (i === 4 ? barW(0.005 * Y) : barW(hrs)) + '%' } }))));
        const sig = (x) => { const p = Math.pow(10, Math.floor(Math.log10(x)) - 1); return Math.round(x / p) * p; };
        const fF = (hrs) => hrs.toLocaleString('en-US') + ' h' + (hrs >= 17520 ? ' ≈ ' + ctx.util.fmt(hrs / Y, 0) + ' yr' : hrs >= 240 ? ' ≈ ' + ctx.util.fmt(hrs / 24, 0) + ' days' : '');
        const fH = (hrs) => hrs >= 240 ? ctx.util.fmt(hrs / 24, 1) + ' days' : hrs >= 1 ? ctx.util.fmt(hrs, hrs < 10 ? 1 : 0) + ' h' : hrs * 60 >= 1 ? ctx.util.fmt(hrs * 60, hrs * 60 < 10 ? 1 : 0) + ' min' : ctx.util.fmt(hrs * 3600, 0) + ' s';
        let mttf = 1000, mttr = 10;
        const bigA = h('div', { class: 'big', style: { color: 'var(--chc)' } }), bigD = h('div', { class: 'big' });
        const cls = h('div', { class: 'small', style: { lineHeight: '1.4', minHeight: '42px' } });
        const eq = h('div', { class: 'mono small', style: { fontWeight: 700 } });
        function classify(A) {
          const e = 1e-12;
          if (A >= 1 - e) return [0, 'Continuous'];
          if (A >= 0.99999 - e) return [1, 'Fault tolerant'];
          if (A >= 0.9999 - e) return [2, 'Fault resilient'];
          if (A >= 0.999 - e) return [3, 'High availability'];
          if (A > 0.995 + e) return [-2, 'Between normal and high'];
          if (A >= 0.99 - e) return [4, 'Normal availability'];
          return [-1, 'Below normal availability'];
        }
        function draw() {
          const A = mttf / (mttf + mttr), D = (1 - A) * Y;
          const nines = Math.max(0, Math.floor(-Math.log10(1 - A) + 1e-9));
          bigA.textContent = (100 * A).toFixed(Math.min(6, Math.max(1, nines))) + '%';
          bigD.textContent = fH(D);
          eq.textContent = `A = ${mttf.toLocaleString('en-US')} / (${mttf.toLocaleString('en-US')} + ${ctx.util.fmt(mttr, 3)}) = ${A.toFixed(Math.min(8, nines + 3))}`;
          const [ix, name] = classify(A);
          rungs.forEach((r, i) => r.classList.toggle('on', i === ix));
          cls.innerHTML = `<span class="chip ${ix === -1 ? 'bad' : ix === -2 ? 'warn' : ix <= 2 ? 'ok' : 'accent'}">${name}</span> <b>${nines} nine${nines === 1 ? '' : 's'}</b>. ` +
            (ix === -1 ? 'Down more than 1% of the year (over 87 hours). Raise the MTTF or cut the MTTR.'
              : ix === -2 ? 'Better than the normal range (0.99–0.995) but short of high availability (0.999). The classes are landmarks, not a continuous scale.'
                : ix === 1 ? 'At most about 5 minutes of downtime a year: users almost never notice.' : 'Each extra nine cuts the yearly downtime by a factor of ten.');
        }
        const sF = ctx.ui.slider({ label: 'MTTF', min: 1, max: 6, step: 'any', value: 3, format: (v) => fF(sig(Math.pow(10, v))), onInput: (v) => { mttf = sig(Math.pow(10, v)); draw(); } });
        const sR = ctx.ui.slider({ label: 'MTTR', min: 0, max: 4, step: 'any', value: Math.log10(600), format: (v) => fH(sig(Math.pow(10, v)) / 60), onInput: (v) => { mttr = sig(Math.pow(10, v)) / 60; draw(); } });
        const setBoth = (f, r) => { mttf = f; mttr = r; sF.set(Math.log10(f)); sR.set(Math.log10(r * 60)); draw(); };
        /* predict-then-reveal */
        const fb = h('div', { class: 'small', style: { lineHeight: '1.42', display: 'none' } });
        const picks = [['a', 'Doubling the MTTF'], ['b', 'Halving the MTTR'], ['c', 'They tie exactly']].map(([k, label]) => h('button', { class: 'btn sm', type: 'button', onclick: () => choose(k) }, label));
        const tryA = h('button', { class: 'btn sm', type: 'button', onclick: () => setBoth(2000, 10) }, 'Try: MTTF 2,000 h, MTTR 10 h');
        const tryB = h('button', { class: 'btn sm', type: 'button', onclick: () => setBoth(1000, 5) }, 'Try: MTTF 1,000 h, MTTR 5 h');
        const tries = h('div', { class: 'row', style: { gap: '6px', display: 'none' } }, tryA, tryB);
        function choose(k) {
          picks.forEach((b, i) => { b.classList.toggle('on', 'abc'[i] === k); b.setAttribute('aria-pressed', 'abc'[i] === k); });
          fb.style.display = ''; tries.style.display = '';
          fb.innerHTML = (k === 'c' ? '<b style="color:var(--ok)">✓ Right, they tie.</b> ' : '<b style="color:var(--bad)">✗ Not quite: they tie.</b> ') +
            'Divide top and bottom by MTTF: A = 1 / (1 + MTTR/MTTF). Only the <b>ratio</b> MTTR/MTTF matters, and both upgrades halve it, from 1/100 to 1/200: 2,000/2,010 = 1,000/1,005 = <b>99.50%</b>. Faster repair is worth exactly as much as sturdier parts.';
          ctx.refit();
        }
        const left = h('div', { class: 'stack', style: { gap: '7px' } },
          h('p', { class: 'm0', style: { fontSize: '16px', lineHeight: '1.45' }, html: 'People describe <span class="t">availability</span> by counting its nines: 0.999 is "three nines". The standard classes, with the downtime each allows per year:' }),
          ...rungs,
          h('p', { class: 'xs muted m0', style: { lineHeight: '1.35' }, html: 'Red bars: yearly downtime on a log scale, so each extra nine removes the same length. *Many tables list this class as about 8.3 hours; the exact arithmetic, 0.001 × 8,760 h, gives 8.76 hours.' }));
        const right = h('div', { class: 'card white stack', style: { gap: '9px' } },
          h('h3', { class: 'm0' }, 'Availability calculator'),
          sF, sR,
          h('div', { class: 'grid-2', style: { gap: '12px' } }, h('div', { class: 'stat' }, h('span', { class: 'lbl' }, 'availability'), bigA), h('div', { class: 'stat' }, h('span', { class: 'lbl' }, 'downtime per year'), bigD)),
          eq, cls,
          h('div', { class: 'card tight stack', style: { gap: '7px' } },
            h('div', { class: 'small', style: { lineHeight: '1.4' }, html: '<b>Predict first.</b> Your system has MTTF = 1,000 h and MTTR = 10 h (99.01%). You can afford <b>one</b> upgrade. Which raises availability more?' }),
            h('div', { class: 'row', style: { gap: '6px' } }, ...picks), fb, tries),
          h('p', { class: 'small muted m0', style: { marginTop: 'auto', lineHeight: '1.4' }, html: '<b>Reality check:</b> five nines with 1-hour repairs needs an MTTF near 100,000 h (over 11 years) for the whole system. Few parts are that good, which is why fault-tolerant systems use redundancy to hide failures.' }));
        el.append(h('div', { class: 'split l fill' }, left, right));
        draw();
      },
    },

    /* ---------------- 5. Faults: causes, three kinds, and a classifier game ---------------- */
    {
      title: 'Faults: where they come from and how long they last',
      kind: 'lab',
      render(el, ctx) {
        const { h } = ctx;
        const KINDS = ['Permanent', 'Transient', 'Intermittent'];
        const SC = [
          [0, 'Component failure', 'A disk\'s read/write head touches the spinning platter and gouges its surface. That part of the disk can never be read again.', 'The damage stays until the disk is replaced. A head crash is the classic permanent fault.'],
          [1, 'Physical interference', 'Lightning strikes a few blocks away. A brief electrical spike on a network cable garbles one packet; every packet before and after arrives fine.', 'One burst of impulse noise, over in an instant and never repeated. Simply resending the packet works.'],
          [2, 'Component failure', 'A network cable\'s connector is slightly loose. Every so often, when someone bumps the desk, the link drops for a moment and then comes back.', 'It appears, vanishes and reappears at unpredictable times, and will keep doing so until someone reseats the connector.'],
          [0, 'Program error', 'A programmer typed < where they meant <=. Every time a customer orders exactly 100 items, the invoice total comes out wrong.', 'The faulty line sits in the code <b>all the time</b>, even though only some inputs trigger it. A software bug stays until the code is fixed.'],
          [1, 'Physical interference', 'A particle from space strikes a memory chip and flips one bit. Once that memory word is rewritten, the chip works perfectly again.', 'The chip is undamaged and the flip happened once. Radiation-induced bit flips are the classic one-off fault.'],
          [2, 'Component failure', 'A server with a cracked solder joint reboots itself at random: twice one week, not at all the next, depending on how warm the room is.', 'The crack opens and closes with temperature, so the fault comes and goes at moments nobody can predict.'],
          [0, 'Operator error', 'An operator accidentally deletes a database server\'s configuration file. The server cannot start again until someone restores the file.', 'The erroneous state (a missing file) persists until a person repairs it. A human caused it, but it behaves like any permanent fault.'],
          [0, 'Design error', 'A processor\'s division circuit was designed with a few wrong entries in an internal table, so certain divisions always give a slightly wrong answer.', 'Every chip built from that design carries the flaw, all the time, until the design is corrected and the chip replaced.'],
          [1, 'Physical interference', 'During a storm the mains power flickers once for a few milliseconds and one calculation on a server comes out wrong. Everything after is normal.', 'A power-supply disturbance that happens once and is gone. Re-running the calculation gives the right answer.'],
          [0, 'Data structure error', 'A bug corrupts a directory table on disk. From then on, every attempt to open files in that folder fails.', 'The damaged table stays damaged until it is rebuilt or restored, so the fault is always present.'],
        ];
        let i = 0, answered = null, score = 0, results = [];
        const pills = h('div', { class: 'row', style: { gap: '4px' } });
        const scoreEl = h('span', { class: 'chip accent' });
        const counter = h('span', { class: 'xs muted b' });
        const scen = h('div', { class: 'card', style: { fontSize: '16.5px', lineHeight: '1.45', minHeight: '104px', background: 'var(--panel-2)' } });
        const btns = KINDS.map((k, j) => h('button', { class: 'btn fbtn', type: 'button', onclick: () => answer(j) }, k));
        const fb = h('div', { class: 'callout m0 small', style: { lineHeight: '1.42', minHeight: '96px' } });
        const next = h('button', { class: 'btn sm primary', type: 'button', onclick: () => { if (i < SC.length - 1) { i++; answered = null; draw(); } else { i = 0; score = 0; results = []; answered = null; draw(); } } });
        const FIX = [['Permanent', 'Retrying is useless. Repair or replace the part, or switch to a spare that is already running.'], ['Transient', 'Simply try again: the fault is already gone.'], ['Intermittent', 'A retry usually works for now, but the fault will return until the cause is found and fixed.']];
        const fixRows = FIX.map(([k, d]) => h('div', { class: 'fixrow' }, h('b', {}, k), h('span', {}, d)));
        function draw() {
          const [kind, cause, text, why] = SC[i];
          fixRows.forEach((r, j) => r.classList.toggle('on', answered != null && j === kind));
          pills.replaceChildren(...SC.map((_, j) => h('span', { class: 'pill' + (results[j] === true ? ' ok' : results[j] === false ? ' bad' : '') + (j === i ? ' cur' : '') })));
          scoreEl.textContent = `Score ${score} / ${results.filter((x) => x != null).length}`;
          counter.textContent = `Scenario ${i + 1} of ${SC.length}`;
          scen.innerHTML = text;
          btns.forEach((b, j) => { b.disabled = answered != null; b.classList.toggle('ok', answered != null && j === kind); b.classList.toggle('bad', answered != null && j === answered && j !== kind); });
          if (answered == null) {
            fb.className = 'callout m0 small'; fb.setAttribute('data-label', 'Your call');
            fb.innerHTML = 'Ask two questions. <b>Once it appears, is it there all the time?</b> Then it is permanent. If not, <b>did it happen once, or does it keep coming back?</b>';
            next.style.visibility = 'hidden';
          } else {
            const ok = answered === kind;
            fb.className = 'callout m0 small ' + (ok ? 'tip' : 'bad');
            fb.setAttribute('data-label', (ok ? '✓ Correct: ' : '✗ It is ') + KINDS[kind].toLowerCase() + (kind ? ' (a temporary fault)' : '') + ' · cause: ' + cause.toLowerCase());
            fb.innerHTML = why;
            next.style.visibility = '';
            next.textContent = i < SC.length - 1 ? 'Next scenario ▶' : `Finished: ${score} / ${SC.length}. Play again`;
          }
        }
        function answer(j) { if (answered != null) return; answered = j; results[i] = j === SC[i][0]; if (results[i]) score++; draw(); }
        const CAUSES = [['Component failure', 'a part wears out or burns out'], ['Operator error', 'a person does the wrong thing'], ['Physical interference', 'heat, noise, radiation, power dips'], ['Design error', 'a flaw in the design itself'], ['Program error', 'a bug in the code'], ['Data structure error', 'corrupted tables or lists']];
        const sig = `<svg viewBox="0 0 470 146" width="100%">
          ${[['Permanent', 'always there once it occurs', 's-bad'], ['Transient', 'temporary: happens once', 's-warn'], ['Intermittent', 'temporary: comes and goes', 's-warn']].map(([n, sub], r) => `<text x="0" y="${r * 48 + 20}" font-size="15" font-weight="800">${n}</text><text x="0" y="${r * 48 + 37}" font-size="12.5" class="s-sub">${sub}</text><line x1="176" y1="${r * 48 + 26}" x2="462" y2="${r * 48 + 26}" class="s-muted"/>`).join('')}
          <rect x="250" y="17" width="212" height="18" rx="3" style="fill:var(--bad);opacity:.8"/><text x="356" y="12" text-anchor="middle" font-size="12" class="s-sub">present until repaired</text>
          <rect x="318" y="65" width="9" height="18" rx="2" style="fill:var(--warn)"/>
          <rect x="204" y="113" width="10" height="18" rx="2" style="fill:var(--warn)"/><rect x="268" y="113" width="6" height="18" rx="2" style="fill:var(--warn)"/><rect x="352" y="113" width="14" height="18" rx="2" style="fill:var(--warn)"/><rect x="430" y="113" width="8" height="18" rx="2" style="fill:var(--warn)"/>
          <text x="462" y="144" text-anchor="end" font-size="12" class="s-sub">time →</text>
        </svg>`;
        const left = h('div', { class: 'stack', style: { gap: '7px' } },
          h('p', { class: 'lead m0', html: 'A <span class="t">fault</span> is an erroneous state of the hardware or software. It can come from:' }),
          h('div', { class: 'grid-2', style: { gap: '6px' } }, ...CAUSES.map(([n, d]) => h('div', { class: 'cause' }, h('b', {}, n), h('span', {}, d)))),
          h('h4', { class: 'm0', style: { marginTop: '2px' } }, 'How long it lasts: the three kinds'),
          h('div', { html: sig, style: { flex: 'none' } }),
          h('p', { class: 'small m0', style: { lineHeight: '1.4' }, html: 'A <span class="t">permanent fault</span> is always there once it occurs. A <span class="t">temporary fault</span> is not: a <span class="t">transient fault</span> happens only once, while an <span class="t">intermittent fault</span> strikes at several unpredictable times.' }),
          h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', style: { lineHeight: '1.35', padding: '7px 12px' }, html: 'A bug that appears only for some inputs is still <b>permanent</b>: the faulty code is there all the time; only its trigger is rare.' }));
        const right = h('div', { class: 'card white stack', style: { gap: '8px' } },
          h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { class: 'm0' }, 'Classify the fault'), h('div', { class: 'row', style: { gap: '10px' } }, counter, scoreEl)),
          pills, scen,
          h('div', { class: 'grid-3', style: { gap: '8px' } }, ...btns),
          fb,
          h('div', { class: 'stack', style: { gap: '3px', flex: 'none' } }, h('span', { class: 'lbl' }, 'What usually fixes it'), ...fixRows),
          h('div', { class: 'row', style: { justifyContent: 'flex-end', marginTop: 'auto' } }, next));
        el.append(h('div', { class: 'split l fill' }, left, right));
        draw();
      },
    },

    /* ---------------- 6. Redundancy lab: spatial (TMR), temporal (retransmit), information (parity) ---------------- */
    {
      title: 'Redundancy lab: extra hardware, extra time, extra bits',
      kind: 'lab',
      core: true, // on the shorter core path
      render(el, ctx) {
        const { h, s } = ctx;
        if (ctx.narrow) el.classList.add('nar');
        const side = (title, html) => h('div', { class: 'stack', style: { gap: '8px' } }, h('h3', { class: 'm0', html: title }), h('div', { class: 'stack', style: { gap: '8px', fontSize: '15px', lineHeight: '1.45' }, html }));

        /* ---- spatial: triple modular redundancy ---- */
        function spatial(p) {
          const GOOD = 42, BITS = 8;
          const units = [GOOD, GOOD, GOOD];
          const rows = [], outCells = [];
          const out = h('span', { class: 'dec' }), outChip = h('span', { class: 'chip' });
          const say = h('div', { class: 'callout m0 small', style: { lineHeight: '1.42', minHeight: '78px' } });
          const bitOf = (v, b) => (v >> (BITS - 1 - b)) & 1;
          let rng = ctx.util.seeded(5);
          function draw() {
            let maj = 0;
            for (let b = 0; b < BITS; b++) { const ones = units.reduce((n, v) => n + bitOf(v, b), 0); if (ones >= 2) maj |= 1 << (BITS - 1 - b); }
            rows.forEach((r, u) => {
              r.cells.forEach((c, b) => { c.textContent = bitOf(units[u], b); c.classList.toggle('wbit', bitOf(units[u], b) !== bitOf(GOOD, b)); c.classList.toggle('lose', bitOf(units[u], b) !== bitOf(maj, b)); });
              r.dec.textContent = units[u];
              const bad = units[u] !== GOOD, out1 = units[u] !== maj;
              r.chip.className = 'chip ' + (!bad ? (out1 ? 'warn' : 'ok') : out1 ? 'warn' : 'bad');
              r.chip.textContent = !bad ? (out1 ? 'right, outvoted' : 'correct') : out1 ? 'wrong, outvoted' : 'wrong, won vote';
            });
            outCells.forEach((c, b) => { c.textContent = bitOf(maj, b); c.classList.toggle('wbit', bitOf(maj, b) !== bitOf(GOOD, b)); });
            out.textContent = maj;
            const okOut = maj === GOOD;
            outChip.className = 'chip ' + (okOut ? 'ok' : 'bad'); outChip.textContent = okOut ? '✓ correct' : '✗ wrong';
            const faulty = units.map((v, u) => (v !== GOOD ? 'ABC'[u] : null)).filter(Boolean);
            let cls, lab, msg;
            if (!faulty.length) { cls = 'why'; lab = 'All three agree'; msg = 'Each unit computes 23 + 19 = 42 (binary 00101010). <b>Click any bit</b> in one unit to flip it, as a failing circuit might.'; }
            else if (faulty.length === 1) { cls = 'tip'; lab = 'Fault masked'; msg = `Unit ${faulty[0]} is wrong (it says ${units['ABC'.indexOf(faulty[0])]}), but the other two outvote it 2 to 1 in every bit, so the output stays 42. The disagreement also tells the system that unit ${faulty[0]} needs repair.`; }
            else if (okOut) { cls = 'warn'; lab = 'Lucky'; msg = `${faulty.length === 3 ? 'All three units are' : 'Units ' + faulty.join(' and ') + ' are both'} wrong, but in <b>different</b> bits, so every bit column still has a correct majority. TMR only promises to survive <b>one</b> faulty unit.`; }
            else { cls = 'bad'; lab = 'Majority is wrong'; msg = `${faulty.length === 3 ? 'All three units are faulty, and at least two' : 'Two units'} are wrong in the <b>same</b> bit, so the majority there is wrong and the output becomes ${maj}. The voter only counts votes; it cannot tell which unit is right. TMR masks one faulty unit, not two.`; }
            say.className = 'callout m0 small ' + cls; say.setAttribute('data-label', lab); say.innerHTML = msg;
          }
          const bitRow = (label, cells, dec, chip, cls) => h('div', { class: 'tmr-row ' + (cls || '') }, h('span', { class: 'b' }, label), ...cells, dec, chip);
          ['A', 'B', 'C'].forEach((nm, u) => {
            const cells = ctx.util.range(BITS).map((b) => h('button', { class: 'tbit', type: 'button', 'aria-label': `Flip bit ${BITS - 1 - b} of unit ${nm}`, onclick: () => { units[u] ^= 1 << (BITS - 1 - b); draw(); } }));
            rows.push({ cells, dec: h('span', { class: 'dec' }), chip: h('span', { class: 'chip' }) });
          });
          ctx.util.range(BITS).forEach(() => outCells.push(h('span', { class: 'tbit out' })));
          const reset = h('button', { class: 'btn sm', type: 'button', onclick: () => { units.fill(GOOD); draw(); } }, 'Repair all units');
          const rand = h('button', { class: 'btn sm intr', type: 'button', onclick: () => { const u = Math.floor(rng() * 3), b = Math.floor(rng() * BITS); units[u] ^= 1 << b; draw(); } }, 'Random bit flip');
          const demo = h('div', { class: 'card white stack', style: { gap: '7px' } },
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'Triple modular redundancy'), h('div', { class: 'row', style: { gap: '6px' } }, rand, reset)),
            ...rows.map((r, u) => bitRow('Unit ' + 'ABC'[u], r.cells, r.dec, r.chip)),
            h('div', { class: 'voter' }, '▼  voter: takes the majority in each bit column  ▼'),
            bitRow('Output', outCells, out, outChip, 'outrow'),
            h('div', { class: 'xs muted', html: '<b style="color:var(--bad)">red</b> = differs from the correct answer · <s>struck through</s> = outvoted by the other two units' }),
            say);
          p.append(h('div', { class: 'split l fill' },
            side('<span class="t" data-t="Spatial redundancy">Spatial (physical) redundancy</span>', '<p class="m0">Several physical components do the same job <b>at the same time</b>, or a spare stands by, ready to take over.</p>' +
              '<p class="m0"><b>Run in parallel and vote.</b> Three identical units compute the same result and a voter passes on the majority: <span class="t">triple modular redundancy (TMR)</span>.</p>' +
              '<p class="m0"><b>Hot standby.</b> A spare runs alongside and takes over the moment the primary fails, such as a backup name server that answers when the main one is down.</p>' +
              '<div class="callout tip m0 small" data-label="Handles">A fault of any kind in <b>one</b> unit, even a permanent one. It cannot help when every copy shares the same design flaw or bug.</div>' +
              '<div class="callout warn m0 small" data-label="Costs">Three units plus a voter: roughly triple the hardware, power and space. The voter itself must be extremely reliable, because if it fails, everything fails.</div>'),
            demo));
          draw();
        }

        /* ---- temporal: retransmit on error ---- */
        function temporal(p) {
          const SEND = { pos: 'send', attempt: 1, cap: 'The sender computes a <b>checksum</b> from the frame\'s bits and attaches it to the frame.' };
          const SCRIPTS = {
            clean: [SEND,
              { pos: 'mid', attempt: 1, cap: 'The frame travels across the link.' },
              { pos: 'recv', attempt: 1, check: 'ok', cap: 'The receiver recomputes the checksum from the bits it got. It matches, so the frame is accepted.' },
              { pos: 'recv', attempt: 1, check: 'ok', back: 'ACK', done: 'ok', cap: 'The receiver returns an acknowledgment (ACK). One transmission, no time wasted.' }],
            noise: [SEND,
              { pos: 'mid', attempt: 1, noise: true, bad: true, cap: 'A burst of electrical noise hits the cable and flips some of the frame\'s bits: a <span class="t">transient fault</span>.' },
              { pos: 'recv', attempt: 1, bad: true, check: 'bad', cap: 'The recomputed checksum does not match, so the error is <b>detected</b>. The receiver throws the damaged frame away.' },
              { pos: 'recv', attempt: 1, bad: true, check: 'bad', back: 'NAK', log: 'corrupted, NAK', cap: 'It sends back a negative acknowledgment (NAK), which means "please send that again".' },
              { pos: 'send', attempt: 2, cap: 'The sender kept a copy, so it transmits the same frame again. Doing the work twice is the redundancy.' },
              { pos: 'mid', attempt: 2, cap: 'The noise burst is over, so this time the frame crosses cleanly.' },
              { pos: 'recv', attempt: 2, check: 'ok', back: 'ACK', done: 'ok', cap: 'Checksum matches, ACK sent. Repeating the work <b>masked</b> the transient fault, at the cost of one extra transmission time.' }],
            cut: [Object.assign({}, SEND, { cut: true, cap: 'Same frame, same checksum. But this time the cable has been cut: a <span class="t">permanent fault</span>.' }),
              { pos: 'lost', attempt: 1, cut: true, log: 'lost', cap: 'The frame reaches the break and is lost. Nothing arrives, so nothing comes back.' },
              { pos: 'send', attempt: 2, cut: true, timeout: true, cap: 'The sender\'s timer runs out with no ACK, so it sends the frame again: attempt 2.' },
              { pos: 'lost', attempt: 2, cut: true, log: 'lost', cap: 'Lost at the break again. The fault has not gone away.' },
              { pos: 'send', attempt: 3, cut: true, timeout: true, cap: 'The timer expires again: attempt 3.' },
              { pos: 'lost', attempt: 3, cut: true, log: 'lost', done: 'fail', cap: 'Lost again. After 3 tries the sender gives up and reports the link as failed. Retrying cannot fix a <b>permanent</b> fault; that needs spatial redundancy, such as a second cable.' }],
          };
          let mode = 'noise';
          const svg = s('svg', { viewBox: ctx.narrow ? '0 0 360 176' : '0 0 600 176', width: '100%', style: 'flex:none' });
          const chips = h('div', { class: 'row', style: { gap: '6px', minHeight: '26px' } });
          /* geometry: the wide layout, or a narrower one for phones so the labels stay legible */
          const G = ctx.narrow
            ? { sx: 4, sw: 88, rx: 268, cx: 178, noise: 'M226 14 L210 40 L222 40 L206 66', nx: 232, pos: { send: 126, mid: 162, recv: 228, lost: 132 }, fw: 62, a1: 264, a2: 96, al: 180 }
            : { sx: 8, sw: 118, rx: 474, cx: 301, noise: 'M318 14 L302 40 L314 40 L298 66', nx: 326, pos: { send: 168, mid: 238, recv: 432, lost: 262 }, fw: 72, a1: 470, a2: 134, al: 300 };
          const SC = G.sx + G.sw / 2, RC = G.rx + G.sw / 2, L0 = G.sx + G.sw;
          function drawFrame(f) {
            const k = [];
            k.push(s('rect', { x: G.sx, y: 44, width: G.sw, height: 74, rx: 12, class: 's-proc', 'stroke-width': 2 }), s('text', { x: SC, y: 86, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800 }, 'Sender'),
              s('rect', { x: G.rx, y: 44, width: G.sw, height: 74, rx: 12, class: 's-proc', 'stroke-width': 2 }), s('text', { x: RC, y: 86, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800 }, 'Receiver'));
            if (f.cut) {
              k.push(s('line', { x1: L0, y1: 81, x2: G.cx - 11, y2: 81, class: 's-line' }), s('line', { x1: G.cx + 11, y1: 81, x2: G.rx, y2: 81, class: 's-line' }),
                s('text', { x: G.cx, y: 88, 'text-anchor': 'middle', 'font-size': 22, 'font-weight': 900, style: 'fill:var(--bad)' }, '✗'),
                s('text', { x: G.cx, y: 110, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, style: 'fill:var(--bad)' }, 'cable cut'));
            } else k.push(s('line', { x1: L0, y1: 81, x2: G.rx, y2: 81, class: 's-line' }));
            if (f.noise) k.push(s('path', { d: G.noise, fill: 'none', style: 'stroke:var(--warn)', 'stroke-width': 3, 'stroke-linejoin': 'round' }), s('text', { x: G.nx, y: 26, 'font-size': 13, 'font-weight': 700, style: 'fill:var(--warn)' }, 'noise burst'));
            const X = G.pos[f.pos];
            if (f.pos === 'lost') k.push(s('text', { x: X, y: 70, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 700, style: 'fill:var(--bad)' }, 'frame lost'));
            else k.push(s('rect', { x: X - G.fw / 2, y: 66, width: G.fw, height: 30, rx: 6, class: f.bad ? 's-bad' : 's-accent', 'stroke-width': 2 }),
              s('text', { x: X, y: 86, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800 }, f.bad ? 'fr4me ✗' : 'frame'));
            k.push(s('text', { x: SC, y: 36, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, class: 's-sub' }, 'attempt ' + f.attempt));
            if (f.timeout) k.push(s('text', { x: SC, y: 138, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, style: 'fill:var(--warn)' }, 'timer expired'));
            if (f.check) k.push(s('text', { x: RC, y: 36, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 800, style: f.check === 'ok' ? 'fill:var(--ok)' : 'fill:var(--bad)' }, f.check === 'ok' ? 'checksum ✓' : 'checksum ✗'));
            if (f.back) { const ok = f.back === 'ACK'; k.push(s('line', { x1: G.a1, y1: 152, x2: G.a2, y2: 152, style: ok ? 'stroke:var(--ok)' : 'stroke:var(--bad)', 'stroke-width': 2.5, 'marker-end': ok ? 'url(#arr-ok)' : 'url(#arr-bad)' }), s('text', { x: G.al, y: 145, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800, style: ok ? 'fill:var(--ok)' : 'fill:var(--bad)' }, f.back)); }
            svg.replaceChildren(...k);
          }
          function drawChips(i) {
            const sc = SCRIPTS[mode], f = sc[i], done = [];
            sc.slice(0, i + 1).forEach((g) => { if (g.log) done.push(['bad', `Try ${g.attempt}: ${g.log}`]); if (g.done === 'ok') done.push(['ok', `Try ${g.attempt}: delivered, ACK`]); });
            const tx = f.pos === 'send' ? f.attempt - 1 : f.attempt;
            chips.replaceChildren(h('span', { class: 'chip accent' }, `Transmissions: ${tx}`), ...done.map(([c, t]) => h('span', { class: 'chip ' + c }, t)),
              ...(f.done === 'fail' ? [h('span', { class: 'chip bad' }, 'Gave up: link failed')] : []));
          }
          const player = ctx.ui.player({ count: SCRIPTS[mode].length, interval: 1900, render: (i) => { const f = SCRIPTS[mode][i]; drawFrame(f); drawChips(i); return f.cap; } });
          const seg = ctx.ui.seg([{ value: 'clean', label: 'Clean line' }, { value: 'noise', label: 'Noise burst (transient)' }, { value: 'cut', label: 'Cable cut (permanent)' }], mode, (v) => { mode = v; player.stop(); player.setCount(SCRIPTS[mode].length); });
          const demo = h('div', { class: 'card white stack', style: { gap: '8px' } },
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'Resend on error'), seg),
            svg, player.el, chips);
          p.append(h('div', { class: 'split l fill' },
            side('<span class="t">Temporal redundancy</span>', '<p class="m0"><b>Repeat an operation</b> when an error is detected. No extra hardware is needed: the extra resource is <b>time</b>.</p>' +
              '<p class="m0">Classic example: a network link sends data in blocks called <b>frames</b>. Each frame carries a <b>checksum</b>, a short number calculated from its bits. The receiver recalculates it; if the two disagree, the frame was damaged and is simply sent again.</p>' +
              '<div class="callout tip m0 small" data-label="Works for">Temporary faults, both transient and intermittent: by the time you try again, the fault has usually passed.</div>' +
              '<div class="callout bad m0 small" data-label="Useless for">Permanent faults. Resending over a cut cable fails every time. Also, the error must first be <b>detected</b>, which is why the frame carries a checksum.</div>'),
            demo));
        }

        /* ---- information: row and column parity (detect and correct) ---- */
        function info(p) {
          const ORIG = [[1, 0, 1, 1], [0, 1, 1, 0], [0, 1, 0, 1], [1, 1, 0, 0]];
          const par = (arr) => arr.reduce((a, b) => a ^ b, 0);
          const col = (d, c) => d.map((r) => r[c]);
          const RP0 = ORIG.map(par), CP0 = [0, 1, 2, 3].map((c) => par(col(ORIG, c)));
          let d = ORIG.map((r) => r.slice()), rp = RP0.slice(), cp = CP0.slice();
          const cell = (onclick, label) => h('button', { class: 'pbit', type: 'button', 'aria-label': label, onclick });
          const dCells = d.map((r, i) => r.map((_, j) => cell(() => { d[i][j] ^= 1; draw(); }, `Flip data bit row ${i + 1} column ${j + 1}`)));
          const rCells = rp.map((_, i) => cell(() => { rp[i] ^= 1; draw(); }, `Flip parity bit of row ${i + 1}`));
          const cCells = cp.map((_, j) => cell(() => { cp[j] ^= 1; draw(); }, `Flip parity bit of column ${j + 1}`));
          const rChk = [0, 1, 2, 3].map(() => h('span', { class: 'pchk' })), cChk = [0, 1, 2, 3].map(() => h('span', { class: 'pchk' }));
          const say = h('div', { class: 'callout m0 small', style: { lineHeight: '1.42' } });
          let fix = null;
          const fixBtn = h('button', { class: 'btn sm primary', type: 'button', onclick: () => { if (fix) { fix(); draw(); } } }, 'Correct it');
          const restore = h('button', { class: 'btn sm', type: 'button', onclick: () => { d = ORIG.map((r) => r.slice()); rp = RP0.slice(); cp = CP0.slice(); draw(); } }, 'Restore original');
          function draw() {
            const fr = [0, 1, 2, 3].filter((i) => par(d[i]) !== rp[i]), fc = [0, 1, 2, 3].filter((j) => par(col(d, j)) !== cp[j]);
            let wrong = 0;
            d.forEach((r, i) => r.forEach((v, j) => { const c = dCells[i][j]; c.textContent = v; c.classList.toggle('wbit', v !== ORIG[i][j]); c.classList.toggle('hit', fr.includes(i) && fc.includes(j) && fr.length === 1 && fc.length === 1); if (v !== ORIG[i][j]) wrong++; c.classList.toggle('inrow', fr.includes(i)); c.classList.toggle('incol', fc.includes(j)); }));
            rCells.forEach((c, i) => { c.textContent = rp[i]; c.classList.toggle('wbit', rp[i] !== RP0[i]); if (rp[i] !== RP0[i]) wrong++; });
            cCells.forEach((c, j) => { c.textContent = cp[j]; c.classList.toggle('wbit', cp[j] !== CP0[j]); if (cp[j] !== CP0[j]) wrong++; });
            rChk.forEach((c, i) => { const bad = fr.includes(i); c.textContent = bad ? '✗' : '✓'; c.className = 'pchk ' + (bad ? 'bad' : 'ok'); });
            cChk.forEach((c, j) => { const bad = fc.includes(j); c.textContent = bad ? '✗' : '✓'; c.className = 'pchk ' + (bad ? 'bad' : 'ok'); });
            fix = null;
            let cls, lab, msg;
            if (!fr.length && !fc.length) {
              if (!wrong) { cls = 'why'; lab = 'All 8 checks pass'; msg = 'Every row and every column holds an even number of 1s. <b>Click any bit</b>, data or parity, to flip it the way noise or radiation might.'; }
              else { cls = 'bad'; lab = 'Undetected!'; msg = `Every check passes, yet ${wrong} bits differ from the original: the flips cancelled out in every row and column. No code catches everything; stronger codes just make such patterns far less likely.`; }
            } else if (fr.length === 1 && fc.length === 1) {
              const [i] = fr, [j] = fc;
              fix = () => { d[i][j] ^= 1; };
              cls = 'tip'; lab = 'Detected and located';
              msg = `Row ${i + 1} and column ${j + 1} both fail. If only one bit flipped, it must sit where they cross, so the code knows exactly which bit to flip back: press <b>Correct it</b>.`;
            } else if (fr.length + fc.length === 1) {
              const isRow = fr.length === 1, k = isRow ? fr[0] : fc[0];
              fix = () => { if (isRow) rp[k] ^= 1; else cp[k] ^= 1; };
              cls = 'tip'; lab = 'Detected: a parity bit was hit';
              msg = `Only ${isRow ? 'row' : 'column'} ${k + 1} fails and no ${isRow ? 'column' : 'row'} does. If only one bit flipped, the data is fine and the ${isRow ? 'row' : 'column'}'s own parity bit is the one that changed. <b>Correct it</b> recomputes that bit.`;
            } else {
              cls = 'warn'; lab = 'Detected, but not correctable';
              msg = `${fr.length} row check${fr.length === 1 ? '' : 's'} and ${fc.length} column check${fc.length === 1 ? '' : 's'} fail: more than one bit is wrong, and the pattern no longer points to a single bit. The damage is <b>detected</b>, but the data must be re-read or restored from a copy.`;
            }
            fixBtn.disabled = !fix;
            say.className = 'callout m0 small ' + cls; say.setAttribute('data-label', lab); say.innerHTML = msg;
          }
          const hdr = (t) => h('span', { class: 'xs muted b center' }, t);
          const grid = h('div', { class: 'pgrid' },
            hdr(''), hdr('c1'), hdr('c2'), hdr('c3'), hdr('c4'), hdr('parity'), hdr('check'),
            ...[0, 1, 2, 3].flatMap((i) => [hdr('r' + (i + 1)), ...dCells[i], rCells[i], rChk[i]]),
            hdr('parity'), ...cCells, h('span'), h('span'),
            hdr('check'), ...cChk, h('span'), h('span'));
          rCells.concat(cCells).forEach((c) => c.classList.add('par'));
          const demo = h('div', { class: 'card white stack', style: { gap: '9px' } },
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, '16 data bits + 8 parity bits'), h('div', { class: 'row', style: { gap: '6px' } }, fixBtn, restore)),
            h('div', { style: { display: 'grid', gridTemplateColumns: ctx.narrow ? '1fr' : 'auto minmax(0, 1fr)', gap: '14px', alignItems: 'start' } }, grid, h('div', { class: 'stack', style: { gap: '8px' } }, say,
              h('p', { class: 'xs muted m0', style: { lineHeight: '1.4' }, html: 'Each <b style="color:var(--os)">parity bit</b> makes its row or column hold an even number of 1s. A check shows ✗ when the count has turned odd.' }))),
            h('div', { class: 'card tight small', style: { lineHeight: '1.4' }, html: '<b>Try these:</b> (1) flip one data bit; (2) flip a parity bit; (3) flip two bits in the same row; (4) flip the four corners of a rectangle, such as r1c1, r1c2, r2c1 and r2c2. Which ones does the code catch, and which can it fix?' }));
          p.append(h('div', { class: 'split l fill' },
            side('<span class="t">Information redundancy</span>', '<p class="m0">Store <b>extra bits</b> computed from the data (a code), or extra copies of it, so that errors can be <b>detected</b> and often <b>corrected</b>.</p>' +
              '<p class="m0"><b>Error-correcting code (ECC) memory</b> stores a few check bits with every memory word, enough to find and silently repair one flipped bit. <b>RAID</b> (a redundant array of independent disks) spreads data plus parity over several disks, so a dead disk\'s contents can be rebuilt from the others.</p>' +
              '<p class="m0">The demo uses the simplest code: a <b>parity bit</b> (an extra bit that makes a group\'s count of 1s even) for each row and column.</p>' +
              '<div class="callout tip m0 small" data-label="Handles, and costs">Bit flips from noise or radiation, and data lost with a failed disk. The price: extra storage and a little computation on every read and write.</div>' +
              '<div class="card tight small" style="line-height:1.4"><b>RAID parity in one line.</b> Three disks hold <code>1011</code>, <code>0110</code>, <code>0101</code>; a fourth holds their XOR, <code>1000</code>. Disk 2 dies? XOR the survivors: <code>1011 ⊕ 0101 ⊕ 1000 = 0110</code>, its lost contents.</div>'),
            demo));
          draw();
        }

        const tabs = ctx.ui.tabs([
          { label: 'Spatial: extra hardware', render: spatial },
          { label: 'Temporal: do it again', render: temporal },
          { label: 'Information: extra bits', render: info },
        ]);
        el.append(h('div', { class: 'stack fill', style: { gap: '6px' } },
          h('p', { class: 'm0', style: { fontSize: '16.5px' }, html: 'Few parts are reliable enough on their own, so fault-tolerant systems add <span class="t">redundancy</span>. There are three kinds. Open each tab and try to break it.' }),
          h('div', { class: 'grow' }, tabs)));
      },
    },

    /* ---------------- 7. OS support, part 1: contain the fault (process isolation, VMs) ---------------- */
    {
      title: 'The OS contains faults: isolation and VMs',
      kind: 'explore',
      render(el, ctx) {
        const { h, s } = ctx;
        if (ctx.narrow) el.classList.add('nar');

        /* ---- demo: how far does a fault spread? ---- */
        function contain(p) {
          let mode = 'proc', fault = null;
          const svg = s('svg', { viewBox: ctx.narrow ? '0 0 330 210' : '0 0 600 214', width: '100%', style: 'flex:none' });
          const say = h('div', { class: 'callout m0 small', style: { lineHeight: '1.42', minHeight: '96px' } });
          const box = (x, y, w, hh, label, cls, down, sub) => s('g', {},
            s('rect', { x, y, width: w, height: hh, rx: 9, class: down ? 's-bad' : cls, 'stroke-width': 2 }),
            s('text', { x: x + w / 2, y: y + (sub ? hh / 2 - 2 : hh / 2 + 5), 'text-anchor': 'middle', 'font-size': ctx.narrow ? 13 : 14.5, 'font-weight': 800, style: down ? 'fill:var(--bad)' : '' }, (down ? '✗ ' : '') + label),
            sub ? s('text', { x: x + w / 2, y: y + hh / 2 + 15, 'text-anchor': 'middle', 'font-size': 12, class: 's-sub' }, sub) : null);
          function outcome() {
            const all = { A: true, B: true, C: true, os1: true, os2: true, os3: true };
            if (!fault) return [all, 'why', 'Nothing has gone wrong yet', 'Three programs, A, B and C, share one computer. Choose how the system is organised, then make program B misbehave.'];
            const dn = (keys) => { const o = Object.assign({}, all); keys.forEach((k) => { o[k] = false; }); return o; };
            if (mode === 'none') return [dn(['A', 'B', 'C', 'os1']), 'bad', 'Everything is down',
              fault === 'wild' ? 'With no walls, B\'s stray write lands in A\'s data and in the operating system\'s own tables. Everything sharing that memory is corrupted and the whole machine goes down.' : 'There is one OS and nothing separates it from the programs. When it crashes, it takes every program with it.'];
            if (mode === 'proc') return fault === 'wild'
              ? [dn(['B']), 'tip', 'Contained by process isolation', 'Memory-protection hardware traps the stray write before it lands, and the OS terminates B. A and C never notice: <span class="t">process isolation</span> kept the fault inside one process.']
              : [dn(['A', 'B', 'C', 'os1']), 'bad', 'Not contained', 'The processes are walled off from each other, but they all rely on <b>one</b> kernel. When it crashes, A, B and C all stop. Process isolation cannot contain a fault in the OS itself.'];
            return fault === 'wild'
              ? [dn(['B']), 'tip', 'Contained inside VM 2', 'B\'s own guest OS traps the stray write and ends B. Nothing outside VM 2 is even aware of it.']
              : [dn(['B', 'os2']), 'tip', 'Contained inside VM 2', 'Only VM 2\'s guest OS crashed. VM 1 and VM 3 run their own copies of the OS and carry on, and the hypervisor can reboot VM 2, even on another machine. The price: running several whole OS copies.'];
          }
          /* phones: the same three pictures redrawn 330 units wide so their labels stay legible */
          function narrowParts(k, up) {
            if (mode === 'none') {
              k.push(s('rect', { x: 4, y: 4, width: 322, height: 160, rx: 12, class: 's-muted', 'stroke-dasharray': '7 5' }), s('text', { x: 14, y: 22, 'font-size': 12.5, 'font-weight': 700, class: 's-sub' }, 'one shared memory: no walls'));
              ['A', 'B', 'C'].forEach((n, i) => k.push(box(14 + i * 76, 32, 70, 50, n, 's-proc', !up[n], 'program')));
              k.push(box(244, 32, 72, 122, 'OS', 's-os', !up.os1, 'tables'));
              k.push(box(14, 92, 222, 62, fault === 'wild' ? 'corrupted by B' : 'data of A, B, C', 's-panel', fault === 'wild', 'all mixed together'));
              k.push(box(4, 174, 322, 30, 'hardware', 's-panel', false));
            } else if (mode === 'proc') {
              ['A', 'B', 'C'].forEach((n, i) => k.push(box(6 + i * 108, 6, 102, 60, 'Process ' + n, 's-proc', !up[n], 'own memory')));
              k.push(s('text', { x: 165, y: 86, 'text-anchor': 'middle', 'font-size': 12, class: 's-sub' }, 'walls enforced by memory-protection hardware'));
              k.push(box(6, 96, 318, 44, 'one OS kernel, shared by all', 's-os', !up.os1));
              k.push(box(6, 150, 318, 32, 'hardware', 's-panel', false));
            } else {
              ['A', 'B', 'C'].forEach((n, i) => {
                const x = 4 + i * 108, os = 'os' + (i + 1);
                k.push(s('rect', { x, y: 4, width: 104, height: 122, rx: 10, class: !up[os] ? 's-bad' : 's-accent', 'stroke-width': 2, 'stroke-dasharray': '6 4' }),
                  s('text', { x: x + 8, y: 20, 'font-size': 12, 'font-weight': 800, class: 's-sub' }, 'VM ' + (i + 1)),
                  box(x + 6, 26, 92, 42, 'Process ' + n, 's-proc', !up[n]), box(x + 6, 76, 92, 42, 'guest OS', 's-os', !up[os]));
              });
              k.push(box(4, 134, 322, 34, 'hypervisor (virtual machine monitor)', 's-cpu', false));
              k.push(box(4, 176, 322, 30, 'hardware', 's-panel', false));
            }
          }
          function draw() {
            const [up, cls, lab, msg] = outcome();
            const k = [];
            if (ctx.narrow) narrowParts(k, up);
            else if (mode === 'none') {
              k.push(s('rect', { x: 10, y: 8, width: 580, height: 150, rx: 14, class: 's-muted', 'stroke-dasharray': '7 5' }), s('text', { x: 24, y: 30, 'font-size': 13, 'font-weight': 700, class: 's-sub' }, 'one shared memory: no walls between anything'));
              ['A', 'B', 'C'].forEach((n, i) => k.push(box(30 + i * 138, 46, 120, 56, 'Program ' + n, 's-proc', !up[n])));
              k.push(box(444, 46, 128, 96, 'OS', 's-os', !up.os1, 'tables, buffers'));
              k.push(box(30, 114, 396, 30, fault === 'wild' ? 'shared data: corrupted by B' : 'data of A, B and C, all mixed together', 's-panel', fault === 'wild'));
              k.push(box(10, 170, 580, 36, 'hardware', 's-panel', false));
            } else if (mode === 'proc') {
              ['A', 'B', 'C'].forEach((n, i) => k.push(box(10 + i * 196, 8, 184, 70, 'Process ' + n, 's-proc', !up[n], 'own memory space')));
              k.push(s('text', { x: 300, y: 98, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, 'walls enforced by memory-protection hardware'));
              k.push(box(10, 108, 576, 50, 'one OS kernel, shared by all', 's-os', !up.os1));
              k.push(box(10, 170, 576, 36, 'hardware', 's-panel', false));
            } else {
              ['A', 'B', 'C'].forEach((n, i) => {
                const x = 10 + i * 196, os = 'os' + (i + 1);
                k.push(s('rect', { x, y: 4, width: 184, height: 118, rx: 12, class: !up[os] ? 's-bad' : 's-accent', 'stroke-width': 2, 'stroke-dasharray': '6 4' }),
                  s('text', { x: x + 10, y: 21, 'font-size': 12.5, 'font-weight': 800, class: 's-sub' }, 'VM ' + (i + 1)),
                  box(x + 10, 28, 164, 42, 'Process ' + n, 's-proc', !up[n]), box(x + 10, 76, 164, 38, 'guest OS ' + (i + 1), 's-os', !up[os]));
              });
              k.push(box(10, 130, 576, 34, 'hypervisor (virtual machine monitor)', 's-cpu', false));
              k.push(box(10, 172, 576, 34, 'hardware', 's-panel', false));
            }
            svg.replaceChildren(...k);
            say.className = 'callout m0 small ' + cls; say.setAttribute('data-label', lab); say.innerHTML = msg;
            fb.forEach(([b, f]) => b.classList.toggle('on', fault === f));
          }
          const seg = ctx.ui.seg([{ value: 'none', label: 'No isolation' }, { value: 'proc', label: 'Process isolation' }, { value: 'vm', label: 'Virtual machines' }], mode, (v) => { mode = v; draw(); });
          const fb = [['wild', 'B writes to a wild address'], ['kernel', 'The OS under B crashes']].map(([f, l]) => [h('button', { class: 'btn sm flt', type: 'button', onclick: () => { fault = f; draw(); } }, l), f]);
          const reset = h('button', { class: 'btn sm ghost', type: 'button', onclick: () => { fault = null; draw(); } }, 'Reset');
          p.append(h('div', { class: 'card white stack fill', style: { gap: '9px' } },
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'Organise the system'), seg),
            svg,
            h('div', { class: 'row', style: { gap: '6px' } }, h('span', { class: 'lbl' }, 'Make B fail:'), ...fb.map((x) => x[0]), reset),
            say,
            h('div', { class: 'xs muted', html: '<b>Try:</b> both faults under each organisation. Only one set-up contains both. Which one, and what does it cost?' })));
          draw();
        }

        const left = h('div', { class: 'stack', style: { gap: '9px' } },
          h('p', { class: 'm0', style: { fontSize: '16.5px', lineHeight: '1.45' }, html: 'Redundancy is not only hardware. The OS has four tools of its own. The first two, <b>process isolation</b> and <b>virtual machines</b>, stop a fault from <b>spreading</b>.' }),
          h('div', { class: 'mech proc' }, h('b', { html: '<span class="t">Process isolation</span>' }),
            h('div', { html: 'Each process gets its own memory, files and flow of execution (as in section 2.3). Memory-protection hardware enforces the walls: a stray write is trapped before it lands, and the OS ends only the faulty process.' })),
          h('div', { class: 'mech os' }, h('b', { html: '<span class="t" data-t="Virtual machine (VM)">Virtual machines (VMs)</span>' }),
            h('div', { html: 'Each VM runs a complete OS of its own on a <b>hypervisor</b>, the software layer that shares one physical machine among the VMs. Even an OS crash stays inside one VM, and a standby VM, ideally on another machine, can take over from a failed one.' })),
          h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'Process isolation cannot survive a crash of the <b>kernel</b>: every process depends on that one shared kernel. VMs move the wall one level down, at the price of running several operating systems.' }),
          h('div', { class: 'callout why m0 small', 'data-label': 'Why it matters', html: 'Containment turns "the computer crashed" into "one program crashed", which a quick restart can fix.' }));
        const right = h('div', { class: 'fill' });
        contain(right);
        el.append(h('div', { class: 'split l fill' }, left, right));
      },
    },

    /* ---------------- 8. OS support, part 2: concurrency controls (be the scheduler: race vs lock) ---------------- */
    {
      title: 'Concurrency controls: stop the lost update',
      kind: 'lab',
      render(el, ctx) {
        const { h } = ctx;
        if (ctx.narrow) el.classList.add('nar');
        /* each line of a deposit: [code, plain-language comment] */
        const LINES = {
          lock: ['lock(acct)', 'wait until no other process holds the lock, then take it'],
          read: ['x = balance', 'copy the shared balance into my private variable x'],
          add: ['x = x + 100', 'add the $100 deposit to my private copy'],
          write: ['balance = x', 'write my copy back over the shared balance'],
          unlock: ['unlock(acct)', 'release the lock so a waiting process may go in'],
        };
        const PROG = { none: ['read', 'add', 'write'], lock: ['lock', 'read', 'add', 'write', 'unlock'] };
        const NM = ['P1', 'P2'], CC = ['proc', 'accent'];
        const money = (n) => '$' + n.toLocaleString('en-US');
        let mode = 'none', st, runId = 0, cls, lab, msg;
        const prog = () => PROG[mode];
        const done = (p) => st.pc[p] >= prog().length;
        /* has process k copied the balance but not yet written it back? */
        const pending = (k) => st.x[k] != null && st.pc[k] <= prog().indexOf('write');
        function reset() {
          runId++;
          st = { bal: 500, pc: [0, 0], x: [null, null], r: [null, null], holder: null, waiting: [false, false], writes: 0, trace: [] };
          cls = 'why'; lab = 'You are the scheduler';
          msg = mode === 'none'
            ? 'Each click runs <b>one line</b> of one process, just as the OS may switch processes after any step. Try to make a deposit vanish: let <b>both</b> processes copy the balance before either writes it back.'
            : 'Same two deposits, now wrapped in <code>lock</code> and <code>unlock</code>. Try the same trick as before. Can you still make a deposit vanish?';
        }
        function step(p) {
          if (done(p)) return;
          const op = prog()[st.pc[p]], q = 1 - p, me = NM[p], other = NM[q];
          if (op === 'lock') {
            if (st.holder === q) {
              st.waiting[p] = true; st.trace.push([p, 'blocked']);
              cls = 'warn'; lab = me + ' is blocked';
              msg = `${me} tries to take the lock, but ${other} holds it, so ${me} is <b>blocked</b> (made to wait) until ${other} unlocks. This waiting is exactly what stops the two deposits from overlapping.`;
              return;
            }
            st.holder = p; st.waiting[p] = false; st.pc[p]++; st.trace.push([p, 'lock']);
            cls = 'why'; lab = me + ' takes the lock';
            msg = `The lock was free, so ${me} takes it. Until ${me} unlocks, no other process can run the lines that touch the balance.`;
          } else if (op === 'read') {
            st.x[p] = st.r[p] = st.bal; st.pc[p]++; st.trace.push([p, 'x = ' + money(st.bal)]);
            cls = pending(q) ? 'warn' : 'why'; lab = me + ' copies the balance';
            msg = `${me} copies the shared balance, ${money(st.bal)}, into its private x.` + (pending(q)
              ? ` <b>Danger:</b> ${other} also holds a copy it has not written back. Whoever writes second will overwrite the other's deposit.` : '');
          } else if (op === 'add') {
            st.x[p] += 100; st.pc[p]++; st.trace.push([p, 'x = ' + money(st.x[p])]);
            cls = 'why'; lab = me + ' adds 100';
            msg = `${me} adds $100 to its <b>private</b> copy, making x = ${money(st.x[p])}. The shared balance is still ${money(st.bal)}: nothing has been written yet.`;
          } else if (op === 'write') {
            const before = st.bal;
            st.bal = st.x[p]; st.writes++; st.pc[p]++; st.trace.push([p, 'balance = ' + money(st.bal)]);
            if (st.bal !== 500 + 100 * st.writes) {
              cls = 'bad'; lab = 'Lost update';
              msg = `${me} writes ${money(st.bal)} over ${money(before)}, but its copy was taken <b>before</b> ${other} wrote. ${other}'s $100 is wiped out.`;
            } else if (pending(q)) {
              cls = 'warn'; lab = me + ' writes';
              msg = `${me} writes ${money(st.bal)}: correct for now. But ${other} copied the balance back when it was ${money(st.r[q])}, so when ${other} writes, this deposit will be wiped out.`;
            } else { cls = 'why'; lab = me + ' writes'; msg = `${me} writes ${money(st.bal)} to the shared balance. Its deposit is safely recorded.`; }
          } else {
            st.holder = null; st.pc[p]++; st.trace.push([p, 'unlock']);
            cls = 'why'; lab = me + ' unlocks';
            msg = `${me} releases the lock.` + (st.waiting[q] ? ` ${other} was waiting, so it may now take the lock and start its deposit.` : ' The next process to ask for it will get it at once.');
          }
          if (done(0) && done(1)) {
            if (st.bal === 700) {
              cls = 'tip'; lab = 'Both deposits counted: $700';
              msg = mode === 'lock'
                ? 'The lock let only one deposit at a time touch the balance, so the second always started from the first one\'s result. With the lock, <b>no</b> order of steps can lose a deposit.'
                : 'This order happened to be safe: one process wrote before the other copied. Press <b>Reset</b> and let both copy first; the code is the same, only the timing changes.';
            } else {
              cls = 'bad'; lab = 'Final balance ' + money(st.bal) + ', not $700';
              msg = 'Nothing crashed and no error appeared, yet a deposit vanished: a <span class="t">race condition</span>. The faulty code is there all the time; only the unlucky timing is rare. Now switch to <b>With a lock</b> and try the same order.';
            }
          }
        }
        /* ---- view ---- */
        const code = h('div', { class: 'cc-code' });
        const cards = [0, 1].map(() => ({ x: h('div', { class: 'big' }), chip: h('span', { class: 'chip' }) }));
        const balBig = h('div', { class: 'big' });
        const trace = h('div', { class: 'log cc-trace' });
        const say = h('div', { class: 'callout m0 small', style: { lineHeight: '1.42', minHeight: '80px' } });
        const bRun = [0, 1].map((p) => h('button', { class: 'btn sm ' + (p ? 'acc' : 'proc'), type: 'button', onclick: () => { runId++; step(p); draw(); } }, `Run ${NM[p]}'s next line`));
        const bAuto = h('button', { class: 'btn sm primary', type: 'button', onclick: () => autoRun() }, 'Take turns automatically');
        const bReset = h('button', { class: 'btn sm ghost', type: 'button', onclick: () => { reset(); draw(); } }, 'Reset');
        function draw() {
          const P = prog(), kids = [h('span', { class: 'cc-hd center' }, 'P1 at'), h('span', { class: 'cc-hd center' }, 'P2 at'), h('span', { class: 'cc-hd' }, 'each deposit runs'), h('span', { class: 'cc-hd cmt' }, 'what the line does')];
          P.forEach((op, i) => {
            const at = [0, 1].map((p) => !done(p) && st.pc[p] === i);
            kids.push(...[0, 1].map((p) => h('span', { class: 'cc-mk' }, at[p] ? h('span', { class: 'chip ' + (st.waiting[p] ? 'warn' : CC[p]) }, NM[p] + ' ▸') : '')),
              h('span', { class: 'cc-line' + (op === 'lock' || op === 'unlock' ? ' lk' : '') + (at[0] || at[1] ? ' cur' : '') }, LINES[op][0]),
              h('span', { class: 'cc-com' }, LINES[op][1]));
          });
          code.replaceChildren(...kids);
          [0, 1].forEach((p) => {
            const c = cards[p];
            c.x.textContent = st.x[p] == null ? '—' : money(st.x[p]);
            const [k, t] = done(p) ? ['ok', 'finished'] : st.waiting[p] ? ['warn', 'blocked: waiting'] : st.holder === p ? ['os', 'holds the lock'] : st.pc[p] === 0 ? ['', 'not started'] : [CC[p], 'mid-deposit'];
            c.chip.className = 'chip ' + k; c.chip.textContent = t;
            bRun[p].disabled = done(p);
          });
          const end = done(0) && done(1);
          balBig.textContent = money(st.bal);
          balBig.style.color = end ? (st.bal === 700 ? 'var(--ok)' : 'var(--bad)') : '';
          trace.replaceChildren(...(st.trace.length ? st.trace.map(([p, t]) => h('span', { class: 'chip ' + (t === 'blocked' ? 'warn' : CC[p]) }, NM[p] + ': ' + t)) : [h('span', { class: 'xs muted' }, 'The order in which lines ran will appear here.')]));
          trace.scrollTop = trace.scrollHeight;
          say.className = 'callout m0 small ' + cls; say.setAttribute('data-label', lab); say.innerHTML = msg;
        }
        /* take turns: P1, P2, P1, P2 ... skipping a process that has finished */
        async function autoRun() {
          reset(); draw();
          const id = runId;
          let p = 0;
          while (!(done(0) && done(1))) {
            if (done(p)) { p = 1 - p; continue; }
            await ctx.sleep(650);
            if (!ctx.alive || id !== runId) return;
            step(p); draw(); p = 1 - p;
          }
        }
        const seg = ctx.ui.seg([{ value: 'none', label: 'No lock' }, { value: 'lock', label: 'With a lock' }], mode, (v) => { mode = v; reset(); draw(); });
        const card = (label, big, extra, cl) => h('div', { class: 'cc-card' + (cl ? ' ' + cl : '') }, h('span', { class: 'lbl' }, label), big, extra);
        const left = h('div', { class: 'stack', style: { gap: '9px' } },
          h('p', { class: 'lead m0', html: 'Processes that share data can corrupt it without anything crashing.' }),
          h('p', { class: 'm0', style: { fontSize: '16px', lineHeight: '1.45' }, html: 'Two processes each deposit $100 into one shared balance in three steps: copy the balance, add 100, write it back. The OS may switch processes between <b>any</b> two steps. If both copy before either writes, one deposit is lost. A result that depends on such timing is a <span class="t">race condition</span>.' }),
          h('div', { class: 'mech thread' }, h('b', {}, 'Concurrency controls'),
            h('div', { html: 'Locks and semaphores (Chapter 5 builds both) enforce <span class="t">mutual exclusion</span>: only one process at a time may run the lines that touch shared data. They bring a new hazard, <span class="t">deadlock</span> (processes waiting for each other forever), which the OS can detect and break, say by rolling one process back.' })),
          h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: '"It passed every test, so there is no race." The faulty code is always there, but only an unlucky timing triggers it, so tests often miss it.' }),
          h('div', { class: 'callout why m0 small', 'data-label': 'Why it matters', html: 'Bank records, seat bookings and the OS\'s own tables are all shared. Without these controls, updates would quietly vanish.' }));
        const right = h('div', { class: 'card white stack', style: { gap: '8px' } },
          h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'Two deposits, one shared balance'), seg),
          code,
          h('div', { class: 'stats', style: { '--n': 3 } },
            card('P1 · private x', cards[0].x, cards[0].chip),
            card('shared balance', balBig, h('span', { class: 'xs muted' }, 'correct after both: $700'), 'shared'),
            card('P2 · private x', cards[1].x, cards[1].chip)),
          h('div', { class: 'row', style: { gap: '6px' } }, ...bRun, bAuto, bReset),
          trace, say);
        el.append(h('div', { class: 'split l fill' }, left, right));
        reset(); draw();
      },
    },

    /* ---------------- 9. OS support, part 3: checkpoints and rollbacks ---------------- */
    {
      title: 'Checkpoints and rollbacks: undo the damage',
      kind: 'lab',
      render(el, ctx) {
        const { h } = ctx;
        if (ctx.narrow) el.classList.add('nar');

        /* ---- demo: checkpoint and rollback on a batch of bank transfers ---- */
        function checkpoint(p) {
          const TX = [['Ana', 'Ben', 50], ['Ben', 'Ana', 20], ['Ana', 'Ben', 70], ['Ben', 'Ana', 40], ['Ana', 'Ben', 30], ['Ben', 'Ana', 60], ['Ana', 'Ben', 25], ['Ben', 'Ana', 15]];
          const fresh = () => ({ bal: { Ana: 500, Ben: 500 }, next: 0, crashed: false, half: null });
          let st = fresh(), cp = { bal: { Ana: 500, Ben: 500 }, next: 0 }, cls = 'why', lab = 'The job', msg = '';
          const strip = h('div', { class: 'txstrip' });
          const kAna = h('div', { class: 'big' }), kBen = h('div', { class: 'big' }), kTot = h('div', { class: 'big' }), kRisk = h('div', { class: 'big' });
          const say = h('div', { class: 'callout m0 small', style: { lineHeight: '1.42', minHeight: '98px' } });
          const $$ = (n) => '$' + n.toLocaleString('en-US');
          const intro = () => { cls = 'why'; lab = 'The job'; msg = 'A batch job must apply eight transfers. Money only moves between the two accounts, so a correct state always totals <b>$1,000</b>. Do a few transfers, save a checkpoint, do some more, then crash.'; };
          function doTx() {
            const [from, to, amt] = TX[st.next];
            st.bal[from] -= amt; st.bal[to] += amt; st.next++;
            const n = st.next - cp.next;
            cls = 'why'; lab = `T${st.next} applied`;
            msg = `${from} −${$$(amt)}, ${to} +${$$(amt)}. ` + (st.next === TX.length ? `All eight transfers are done and the total is still $1,000.` : `${n} transfer${n === 1 ? '' : 's'} since the last checkpoint ${n === 1 ? 'is' : 'are'} not saved yet: that work is at risk.`);
          }
          function save() {
            cp = { bal: Object.assign({}, st.bal), next: st.next };
            cls = 'tip'; lab = `Checkpoint saved after T${st.next}`;
            msg = `Saved: Ana ${$$(st.bal.Ana)}, Ben ${$$(st.bal.Ben)}, ${st.next < TX.length ? 'next is T' + (st.next + 1) : 'batch complete'}. The total is $1,000, so this state is <b>consistent</b> and safe to return to. Checkpoints are taken only between transfers, never halfway through one, and each costs time to write.`;
          }
          function crash() {
            const [from, to, amt] = TX[st.next];
            st.bal[from] -= amt; st.half = st.next; st.crashed = true;
            cls = 'bad'; lab = 'Crash in the middle of T' + (st.next + 1);
            msg = `T${st.next + 1} took ${$$(amt)} from ${from} but crashed before giving it to ${to}. The total is now ${$$(st.bal.Ana + st.bal.Ben)}: ${$$(amt)} has vanished. This state is <b>inconsistent</b> and must not be trusted. Roll back.`;
          }
          function roll() {
            const redo = st.half - cp.next + 1, without = st.half + 1;
            st = { bal: Object.assign({}, cp.bal), next: cp.next, crashed: false, half: null };
            cls = 'tip'; lab = 'Rolled back to the checkpoint';
            msg = `Ana ${$$(st.bal.Ana)}, Ben ${$$(st.bal.Ben)}: the total is $1,000 again. ` + (cp.next
              ? `Only <b>${redo}</b> transfer${redo === 1 ? '' : 's'} (T${cp.next + 1} onward) must be redone; with no checkpoint it would have been all ${without}.`
              : `No checkpoint was saved, so the job is back at the very beginning and all <b>${redo}</b> transfer${redo === 1 ? '' : 's'} must be redone.`);
          }
          function draw() {
            const kids = [];
            TX.forEach(([from, to, amt], k) => {
              if (k === cp.next) kids.push(h('div', { class: 'cpmark', title: 'checkpoint' }, cp.next ? 'checkpoint' : 'start'));
              const state = k === st.half ? 'half' : k < cp.next ? 'saved' : k < st.next ? (st.crashed ? 'redo' : 'unsaved') : 'todo';
              kids.push(h('div', { class: 'tx ' + state }, h('b', {}, 'T' + (k + 1)), h('span', {}, from[0] + '→' + to[0] + ' ' + $$(amt)), h('i', {}, { saved: 'saved', unsaved: 'unsaved', half: 'half done', redo: 'redo', todo: 'to do' }[state])));
            });
            if (cp.next === TX.length) kids.push(h('div', { class: 'cpmark', title: 'checkpoint' }, 'checkpoint'));
            strip.replaceChildren(...kids);
            const tot = st.bal.Ana + st.bal.Ben;
            kAna.textContent = $$(st.bal.Ana); kBen.textContent = $$(st.bal.Ben);
            kTot.textContent = $$(tot) + (tot === 1000 ? ' ✓' : ' ✗'); kTot.style.color = tot === 1000 ? 'var(--ok)' : 'var(--bad)';
            kRisk.textContent = st.crashed ? '—' : String(st.next - cp.next);
            say.className = 'callout m0 small ' + cls; say.setAttribute('data-label', lab); say.innerHTML = msg;
            bDo.disabled = st.crashed || st.next >= TX.length; bSave.disabled = st.crashed || st.next === cp.next;
            bCrash.disabled = st.crashed || st.next >= TX.length; bRoll.disabled = !st.crashed;
          }
          const act = (fn) => () => { fn(); draw(); };
          const bDo = h('button', { class: 'btn sm primary', type: 'button', onclick: act(doTx) }, 'Do next transfer');
          const bSave = h('button', { class: 'btn sm mem', type: 'button', onclick: act(save) }, 'Save checkpoint');
          const bCrash = h('button', { class: 'btn sm flt', type: 'button', onclick: act(crash) }, 'Crash mid-transfer');
          const bRoll = h('button', { class: 'btn sm os', type: 'button', onclick: act(roll) }, 'Roll back');
          const bReset = h('button', { class: 'btn sm ghost', type: 'button', onclick: act(() => { st = fresh(); cp = { bal: { Ana: 500, Ben: 500 }, next: 0 }; intro(); }) }, 'Reset');
          const stat = (big, label) => h('div', { class: 'stat' }, h('span', { class: 'lbl' }, label), big);
          p.append(h('div', { class: 'card white stack fill', style: { gap: '10px' } },
            h('h4', { class: 'm0' }, 'A batch of eight bank transfers'),
            strip,
            h('div', { class: 'stats', style: { '--n': 4 } }, stat(kAna, 'Ana'), stat(kBen, 'Ben'), stat(kTot, 'total'), stat(kRisk, 'work at risk')),
            h('div', { class: 'row', style: { gap: '6px' } }, bDo, bSave, bCrash, bRoll, bReset),
            say,
            h('div', { class: 'xs muted', html: '<b>Try:</b> do T1 to T3, save a checkpoint, do T4 and T5, crash, then roll back. Then reset and try it with no checkpoint at all.' }),
            h('div', { class: 'card tight small', style: { lineHeight: '1.4', marginTop: 'auto' }, html: '<b>The trade-off.</b> Checkpoint often and a crash loses little work, but every checkpoint takes time to write. Checkpoint rarely and the job runs faster, until a crash throws away much more. Real systems choose an interval in between.' })));
          intro(); draw();
        }

        const left = h('div', { class: 'stack', style: { gap: '9px' } },
          h('p', { class: 'lead m0', html: 'Some faults cannot be hidden while they happen. The fallback: <b>go back</b> to a moment when everything was right.' }),
          h('div', { class: 'mech mem' }, h('b', { html: 'Take a <span class="t">checkpoint</span>' }),
            h('div', { html: 'Every so often, save a copy of the state at a <b>consistent</b> moment (no job half done), in storage the expected failure cannot destroy, such as a separate disk.' })),
          h('div', { class: 'mech mem' }, h('b', { html: 'After a failure, <span class="t">rollback</span>' }),
            h('div', { html: 'Throw away the damaged state, restore the latest checkpoint, and redo only the work done since. Databases, transaction systems and jobs that run for days all rely on this.' })),
          h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'A checkpoint taken <b>halfway</b> through an update saves a broken state, and rolling back to it restores the damage. Checkpoints are only useful if the saved state is consistent.' }),
          h('div', { class: 'callout why m0 small', 'data-label': 'Why it matters', html: 'A week-long simulation or a bank\'s nightly batch cannot start over after every crash. Checkpoints cap how much work any one failure can destroy.' }));
        const right = h('div', { class: 'fill' });
        checkpoint(right);
        el.append(h('div', { class: 'split l fill' }, left, right));
      },
    },

    /* ---------------- 8. Recap ---------------- */
    {
      title: 'Recap: measure it, name the fault, add redundancy',
      kind: 'recap',
      render(el, ctx) {
        const { h } = ctx;
        const SUM = [
          ['cpu', '1 · Measure', ['<b>R(t)</b>: chance of no failure from 0 to t', '<b>MTTF</b>: average time until a failure', '<b>MTTR</b>: average time to repair', '<b>A = MTTF / (MTTF + MTTR)</b>', 'Classes: 1.0 · 0.99999 · 0.9999 · 0.999 · 0.99–0.995']],
          ['intr', '2 · Name the fault', ['<b>Permanent</b>: always there once it occurs', '<b>Transient</b>: temporary, happens once', '<b>Intermittent</b>: temporary, comes and goes', 'Causes: parts, people, surroundings, design, code, data']],
          ['mem', '3 · Add redundancy', ['<b>Spatial</b>: extra hardware (TMR, hot standby)', '<b>Temporal</b>: repeat on error (resend a frame); no use against permanent faults', '<b>Information</b>: extra bits (parity, ECC, RAID)', 'Always costs money or performance']],
          ['os', '4 · Let the OS help', ['<b>Process isolation</b>: a fault stays in one process', '<b>Virtual machines</b>: even an OS crash stays in one VM', '<b>Concurrency controls</b>: locks stop race conditions', '<b>Checkpoints and rollbacks</b>: redo only recent work']],
        ];
        el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },
          h('div', { class: 'grid-4', style: { gap: '10px' } }, ...SUM.map(([c, t, items]) => h('div', { class: 'card tight ' + c, style: { display: 'flex', flexDirection: 'column', gap: '3px' } },
            h('div', { class: 'b', style: { color: `var(--${c})`, fontSize: '16px' } }, t),
            ...items.map((x) => h('div', { class: 'small', style: { lineHeight: '1.3' }, html: x }))))),
          h('p', { class: 'm0 muted small' }, 'Say each answer out loud before you click the card to check it.'),
          ctx.ui.flipcards([
            ['MTTF 4,900 h and MTTR 100 h: what is the availability?', '4,900 / (4,900 + 100) = <b>0.98</b>. Down 2% of the year: about 175 hours.'],
            ['Which class allows about 53 minutes of downtime a year?', '<b>Fault resilient</b>, 0.9999 (four nines). Each extra nine cuts downtime tenfold.'],
            ['A loose connector drops the link now and then. What kind of fault?', '<b>Intermittent</b>: it comes and goes at unpredictable times until someone fixes it.'],
            ['Two processes both copy a $500 balance, each adds $100, then both write. The result?', '<b>$600, not $700</b>: a lost update caused by a race condition. A lock gives $700 in every order.'],
            ['What can triple modular redundancy survive?', 'A fault in <b>one</b> unit, which the other two outvote. Two units wrong in the same bit, or a bug shared by all three, defeats it.'],
            ['What makes a checkpoint useful?', 'It saves a <b>consistent</b> state. After a crash, roll back to it and redo only the work since, instead of starting over.'],
          ].map(([f, b]) => ['<div>' + f + '</div>', '<div>' + b + '</div>']), { cols: 3, height: 126 })));
      },
    },

    /* ---------------- 9. Check yourself ---------------- */
    {
      title: 'Check yourself',
      kind: 'check',
      quiz: [
        { q: 'Which statement best describes <b>fault tolerance</b>?',
          choices: ['A system that never develops hardware or software faults', 'The ability of a system to keep operating normally despite hardware or software faults', 'The ability to find and fix a fault quickly after the system has stopped', 'Detecting a fault and shutting the system down safely before it does damage'],
          answer: 1,
          feedback: ['No real system is fault-free. Fault tolerance assumes faults will happen and keeps working anyway.', null, 'Fast repair lowers the MTTR and helps availability, but the system still stops. Fault tolerance keeps it running through the fault.', 'Shutting down safely prevents damage, but the system is no longer doing its job. Fault tolerance keeps it operating normally.'],
          why: 'Fault tolerance means continuing normal operation despite faults. It usually relies on redundancy, which costs money and often some performance.' },
        { type: 'num', q: 'A server has an MTTF of 1,980 hours and an MTTR of 20 hours. What is its availability, as a percentage?', answer: 99, tol: 0.05, unit: '%',
          why: 'A = MTTF / (MTTF + MTTR) = 1,980 / (1,980 + 20) = 1,980 / 2,000 = 0.99, which is 99%.' },
        { type: 'num', q: 'A system has an availability of 0.9999. About how many <b>minutes</b> of downtime does that allow per year? (One year = 8,760 hours.)', answer: 52.56, tol: 1, unit: 'min',
          why: '(1 − 0.9999) × 8,760 h = 0.876 h, and 0.876 × 60 = 52.56 minutes: about 53 minutes, the fault resilient class.' },
        { q: 'Reliability, R(t), is best defined as:',
          choices: ['the fraction of time the system is available to serve requests', 'the probability that the system operates correctly from time 0 up to time t, given that it worked at time 0', 'the average time from a failure until its repair is finished', 'the number of failures the system has had by time t'],
          answer: 1,
          feedback: ['That is availability, which also counts time after repairs. Reliability asks about one unbroken stretch with no failure.', null, 'That is the mean time to repair (MTTR).', 'That is a count. R(t) is a probability between 0 and 1.'],
          why: 'R(t) starts at 1 when t = 0 and falls as t grows, because a longer stretch gives more chances to fail.' },
        { type: 'bucket', q: 'Sort each fault by how long it lasts.', buckets: ['Permanent', 'Transient', 'Intermittent'],
          items: [['A disk head crash', 0], ['A bug in a program', 0], ['Radiation flips one memory bit, once', 1], ['A noise burst garbles one transmission', 1], ['A loose connection that drops at random', 2], ['A cracked joint that fails at random times', 2]],
          why: 'Permanent faults stay until repaired (head crash, software bug). Transient faults happen once. Intermittent faults recur at unpredictable times.' },
        { type: 'match', q: 'Match each technique to the idea it relies on.',
          pairs: [['Three processors vote on every result', 'Spatial redundancy'], ['A data link resends a frame whose checksum failed', 'Temporal redundancy'], ['Memory stores check bits that let it fix a flipped bit', 'Information redundancy'], ['A long job restarts from its last saved consistent state', 'Checkpoint and rollback']],
          why: 'Extra hardware working in parallel is spatial redundancy, repeating work is temporal, extra coded bits are information redundancy, and restoring saved state is checkpoint and rollback.' },
        { type: 'tf', q: 'Doubling a system\'s MTTF raises its availability more than halving its MTTR does.', answer: false,
          why: 'A = 1 / (1 + MTTR/MTTF) depends only on the ratio MTTR/MTTF. Both changes halve that ratio, so they give exactly the same availability.' },
        { type: 'multi', q: 'Which of these are operating system mechanisms that support fault tolerance?',
          choices: ['Process isolation', 'Concurrency controls such as semaphores', 'Virtual machines', 'Checkpoints and rollbacks', 'Letting any program write anywhere in memory', 'Switching off the timer interrupt'],
          answer: [0, 1, 2, 3],
          why: 'Isolation, concurrency controls, VMs and checkpoint/rollback all limit or undo damage. Unrestricted memory writes, or no timer, would let one faulty program wreck or monopolise the whole machine.' },
        { type: 'order', q: 'Order these availability classes from the one that allows the <b>most</b> downtime per year to the one that allows the <b>least</b>.',
          items: ['Normal availability (0.99 to 0.995)', 'High availability (0.999)', 'Fault resilient (0.9999)', 'Fault tolerant (0.99999)', 'Continuous (1.0)'],
          why: 'Each extra nine cuts yearly downtime by a factor of ten: about 44 to 87 hours, then about 8.8 hours (often listed as 8.3), about 53 minutes, about 5 minutes, and finally none at all.' },
        { q: 'In triple modular redundancy, two of the three units suffer the <b>same</b> flipped bit. What does the voter output?',
          choices: ['The correct value, because a voter always masks errors', 'The wrong value, because the majority in that bit is now wrong', 'Nothing: the voter detects a tie and stops', 'The value from the one unit that is still correct'],
          answer: 1,
          feedback: ['The voter simply follows the majority. If two of three agree on a wrong bit, the majority is wrong.', null, 'With three units a bit can never tie: it is always at least two against one.', 'The voter has no idea which unit is correct. It only counts votes.'],
          why: 'TMR masks a fault in one unit. When two units are wrong in the same way, they outvote the good one.' },
        { q: 'The only network cable between two buildings has been cut. Which remedy keeps data flowing?',
          choices: ['Resend every frame until it gets through', 'Add a checksum to every frame', 'Route the traffic over a second, independent link', 'Save a checkpoint before each transmission'],
          answer: 2,
          feedback: ['Resending is temporal redundancy, which only beats temporary faults. A cut cable is permanent, so every retry is lost too.', 'A checksum only detects damaged frames. Across a cut cable nothing arrives to be checked.', null, 'A checkpoint lets a program restart from saved state, but the link is still cut afterwards.'],
          why: 'A cut cable is a permanent fault: it stays until repaired. Only spatial redundancy, a spare path that is already in place, can mask it.' },
        { type: 'num', q: 'Two processes each deposit $100 into a shared balance of $500, with no lock. Each deposit copies the balance into a private variable, adds 100 to the copy, then writes the copy back. Both processes copy the balance before either one writes. What is the final balance, in dollars?', answer: 600, tol: 0, unit: 'dollars', hint: 'Follow each private copy. What value does each process write back, and which write lands last?',
          why: 'Both copy $500, both compute $600, and the second write overwrites the first: one deposit is lost. This lost update is a race condition; a lock (mutual exclusion) forces the correct $700.' },
      ],
    },
  ],

  notes: `
    <h3>What fault tolerance means</h3>
    <p><b>Fault tolerance</b> is the ability of a system or component to keep operating normally even when some of its hardware or software has developed faults. It relies on <b>redundancy</b>: spare parts, repeated work or extra information that can take over or undo the damage. Redundancy costs money and often performance (a mirrored disk writes everything twice; a standby server must be kept in step). Spares only cover the faults they duplicate: a second power supply cannot save a server whose OS crashes, while a standby server usually can (unless it hits the same bug).</p>

    <h3>Measuring it</h3>
    <ul>
      <li><b>Reliability R(t)</b>: the probability that a system operates correctly for the whole period from time 0 to time t, given that it worked at time 0. R(0) = 1 and R(t) never rises.</li>
      <li><b>MTTF</b> (mean time to failure): the average time a system runs, from a fresh start or a repair, until it fails.</li>
      <li><b>MTTR</b> (mean time to repair): the average time to notice, locate and repair a fault.</li>
      <li><b>Availability</b>: the fraction of time the system is up and able to serve requests. <b>A = MTTF / (MTTF + MTTR)</b>; downtime per year = (1 − A) × 8,760 h.</li>
    </ul>
    <p>MTTF is an average, not a promise: with failures striking at random at a steady rate, R(t) = e<sup>−t/MTTF</sup>, so only about 37% of units still run at t = MTTF. Scale makes failures routine: 10,000 disks with an MTTF of 1,000,000 h fail about 10,000 ÷ 1,000,000 = 0.01 times an hour, one every 100 hours.</p>
    <p><b>Worked example.</b> MTTF = 990 h, MTTR = 10 h: A = 990 / 1,000 = 0.99, so the system is down 0.01 × 8,760 ≈ 87.6 h a year.</p>
    <p><b>Reliability is not availability:</b> a server that crashes hourly but restarts in one second has poor reliability yet about 99.97% availability. <b>Only the ratio matters:</b> A = 1 / (1 + MTTR/MTTF), so from MTTF 1,000 h and MTTR 10 h (99.01%), doubling the MTTF or halving the MTTR gives the same 2,000/2,010 = 1,000/1,005 ≈ 99.50%.</p>

    <h4>Availability classes</h4>
    <table>
      <tr><th>Class</th><th>Availability</th><th>Downtime per year</th></tr>
      <tr><td>Continuous</td><td>1.0</td><td>none</td></tr>
      <tr><td>Fault tolerant</td><td>0.99999 (five nines)</td><td>about 5 minutes</td></tr>
      <tr><td>Fault resilient</td><td>0.9999 (four nines)</td><td>about 53 minutes</td></tr>
      <tr><td>High availability</td><td>0.999 (three nines)</td><td>about 8.8 h (often listed as 8.3 h)</td></tr>
      <tr><td>Normal availability</td><td>0.99 to 0.995</td><td>about 44 to 87 hours</td></tr>
    </table>
    <p>Each extra nine cuts downtime tenfold. Five nines with 1-hour repairs needs an MTTF near 100,000 h, so real designs hide failures with redundancy.</p>

    <h3>Faults</h3>
    <p>A <b>fault</b> is an erroneous state of hardware or software. Causes: component failure, operator error, physical interference from the surroundings (heat, noise, radiation, power dips), design error, program error and data structure error.</p>
    <ul>
      <li><b>Permanent</b>: always present once it occurs, until the part is repaired or replaced (disk head crash, software bug, burned-out part). A bug that only some inputs trigger is still permanent. Retrying is useless; repair it or switch to a spare.</li>
      <li><b>Temporary</b>, of two kinds. <b>Transient</b>: happens once (a noise burst garbles a frame, a power flicker, a radiation bit flip); a retry works. <b>Intermittent</b>: recurs at unpredictable times (a loose connection, a cracked solder joint); a retry works for now, but the fault returns until fixed.</li>
    </ul>

    <h3>Three kinds of redundancy</h3>
    <table>
      <tr><th>Kind</th><th>Idea</th><th>Examples</th><th>Limits and cost</th></tr>
      <tr><td>Spatial (physical)</td><td>Several components do the same job at once, or a spare stands by (hot standby).</td><td>Triple modular redundancy (TMR) with a majority voter; a backup name server.</td><td>Masks any fault in one unit, even a permanent one. Fails if two units are wrong in the same way or all copies share a flaw. TMR triples the hardware.</td></tr>
      <tr><td>Temporal</td><td>Repeat an operation when an error is detected.</td><td>A link resends a frame whose checksum failed.</td><td>Works for temporary faults; useless against a permanent one. Needs error detection first. Costs time.</td></tr>
      <tr><td>Information</td><td>Store extra bits (a code) or copies so errors can be detected and corrected.</td><td>Parity; error-correcting code (ECC) memory; RAID.</td><td>Costs storage and a little computation. Enough errors can fool any code.</td></tr>
    </table>
    <p><b>TMR:</b> three units each output 42 (00101010); the voter takes the majority in every bit, so one faulty unit is outvoted and flagged for repair. Two units wrong in the same bit outvote the good one.</p>
    <p><b>Retransmission:</b> each frame carries a checksum. If the receiver's recalculated checksum disagrees, the frame is sent again, masking a transient noise burst at the cost of one extra transmission. A cut cable is permanent: every resend is lost, and only a second, independent link (spatial redundancy) keeps data flowing.</p>
    <p><b>Parity:</b> a parity bit makes a group's count of 1s even. With one per row and per column of a 4 × 4 block, a single flipped data bit fails one row check and one column check; their crossing locates it. Several flips are usually detected but not located; four flips on a rectangle's corners go undetected. <b>RAID:</b> disks hold 1011, 0110, 0101 and a parity disk their XOR, 1000; if disk 2 dies, 1011 ⊕ 0101 ⊕ 1000 = 0110 rebuilds it.</p>

    <h3>How the operating system helps</h3>
    <ul>
      <li><b>Process isolation</b>: each process has its own memory, files and flow of execution, enforced by memory-protection hardware; a stray write is trapped and only that process ends. It cannot contain a crash of the shared kernel.</li>
      <li><b>Virtual machines</b>: each VM runs its own OS on a hypervisor, so even an OS crash stays inside one VM, and a standby VM (ideally on another machine) can take over. Cost: several OS copies.</li>
      <li><b>Concurrency controls</b>: processes sharing data can interleave their steps. If two $100 deposits to a $500 balance both copy it before either writes, the result is $600, not $700: a lost update from a <b>race condition</b> (the result depends on timing). Locks and semaphores enforce mutual exclusion, so every order gives $700. The OS can also detect deadlock and recover, for example by rolling one process back.</li>
      <li><b>Checkpoints and rollbacks</b>: save the state at a consistent moment, in storage the failure cannot destroy (checkpoint). After a failure, discard the damaged state, restore the checkpoint (rollback) and redo only the work since. Example: transfers between two accounts totalling $1,000; checkpoint after T3, crash halfway through T6 (total now wrong); roll back and redo T4 to T6 instead of all six. Frequent checkpoints lose less work but cost more time. Databases rely on this.</li>
    </ul>`,
});
