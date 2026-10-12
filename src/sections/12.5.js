/* =====================================================================
   12.5 File Sharing
   Original teaching material. Helpers shared by several steps live inside
   this IIFE (no globals).
   ===================================================================== */
(function () {
  // The classic ladder of access rights. Level k includes every level below it.
  const RIGHTS = [
    { n: 'None', t: null, add: 'Nothing at all. The user cannot even find out that the file exists: the system refuses to let them read the directory that lists it.', ex: 'A private diary file: other users do not see it in any listing.' },
    { n: 'Knowledge', t: 'knowledge right', add: 'The user can learn that the file exists and who owns it, and can therefore ask the owner for more rights. They cannot open it.', ex: 'A shared drive shows the file name and owner, but opening it says “ask the owner for access”.' },
    { n: 'Execution', t: 'execution right', add: 'The user can load and run the file as a program, but cannot read it as data or copy it.', ex: 'A licensed program that staff may run but may not copy to a USB stick.' },
    { n: 'Reading', t: 'reading right', add: 'The user can read the file for any purpose: view it, print it, copy it and, if it is a program, run it.', ex: 'Course notes published to the whole class.' },
    { n: 'Appending', t: 'appending right', add: 'The user can add new data, normally only at the end, but cannot change or erase what is already there.', ex: 'A sign-up sheet or a log: you may add your line, not edit anyone else’s.' },
    { n: 'Updating', t: 'updating right', add: 'The user can change, erase and add data anywhere in the file, including writing it for the first time and rewriting it completely.', ex: 'A co-author of a shared report.' },
    { n: 'Changing protection', t: 'changing-protection right', add: 'The user can change the rights other users hold on the file. Normally only the owner has it; an owner who passes it on can usually limit which rights may be changed.', ex: 'Deciding who else may read or edit the report.' },
    { n: 'Deletion', t: 'deletion right', add: 'The user can delete the file from the file system altogether.', ex: 'Removing the report once the project is over.' },
  ];

  // Shared (S) / exclusive (X) lock on one record: who holds it, who waits, and two grant policies.
  // 'fifo': a request waits if anyone is queued ahead of it (fair; writers cannot starve).
  // 'readers': a read request jumps past waiting writers whenever no writer holds the lock.
  const rwFits = (L, mode) => L.holders.length === 0 || (mode === 'S' && L.holders.every((x) => x.mode === 'S'));
  function rwRequest(L, who, mode, policy) {
    const go = rwFits(L, mode) && (policy === 'readers' ? true : L.queue.length === 0);
    (go ? L.holders : L.queue).push({ who, mode });
    return go;
  }
  function rwRelease(L, who, policy) {
    L.holders = L.holders.filter((x) => x.who !== who);
    const granted = [];
    const grant = (i) => { const q = L.queue.splice(i, 1)[0]; L.holders.push(q); granted.push(q); };
    if (policy === 'readers') {
      for (let i = 0; i < L.queue.length;) { if (L.queue[i].mode === 'S' && rwFits(L, 'S')) grant(i); else i++; }
      if (!granted.length && L.queue.length && rwFits(L, L.queue[0].mode)) grant(0);
    } else {
      while (L.queue.length && rwFits(L, L.queue[0].mode)) grant(0);
    }
    return granted;
  }

  // Two transfers that each lock two records. Returns one frame per event, ending in success or deadlock.
  function transferFrames(ordered) {
    const T = [{ id: 'T1', who: 'Ana', from: 3, to: 8, amt: 100 }, { id: 'T2', who: 'Ben', from: 8, to: 3, amt: 50 }];
    T.forEach((t) => { t.order = ordered ? [Math.min(t.from, t.to), Math.max(t.from, t.to)] : [t.from, t.to]; t.pc = 0; t.st = 'ready'; t.wait = null; });
    const val = { 3: 500, 8: 200 }, held = {}, frames = [];
    const snap = (cap, cls) => frames.push({ val: { ...val }, held: { ...held }, wait: T.map((t) => t.wait), st: T.map((t) => t.st), cap, cls: cls || '' });
    snap(`Ana’s ${T[0].id} moves ${T[0].amt} from r3 to r8; Ben’s ${T[1].id} moves ${T[1].amt} from r8 to r3. Each must lock both records before changing them. ` +
      (ordered ? 'Rule now: always lock the <b>lower record number first</b>.' : 'Each locks in the order it happens to need them.'));
    let turn = 0;
    for (let guard = 0; guard < 30 && T.some((t) => t.st !== 'done'); guard++) {
      let i = turn % 2;
      if (T[i].st !== 'ready') i = 1 - i;
      if (T[i].st !== 'ready') break;
      const t = T[i], o = T[1 - i];
      turn++;
      if (t.pc < 2) {
        const r = t.order[t.pc];
        if (!held[r]) { held[r] = t.id; t.pc++; snap(`${t.id} locks r${r}` + (t.pc === 2 ? ', so it now holds both records it needs.' : '.')); }
        else {
          t.st = 'blocked'; t.wait = r;
          if (o.st === 'blocked') {
            snap(`${t.id} asks for r${r}, held by ${o.id}, and blocks. Now ${t.id} waits for ${o.id} and ${o.id} waits for ${t.id}: a circular wait. Neither will ever move: <b style="color:var(--bad)">deadlock</b>.`, 'bad');
            return frames;
          }
          snap(`${t.id} asks for r${r}, but ${o.id} holds it, so ${t.id} blocks.` + (ordered ? ` ${t.id} holds nothing yet, so it cannot be part of a cycle.` : ''), 'warn');
        }
      } else if (t.pc === 2) {
        val[t.from] -= t.amt; val[t.to] += t.amt; t.pc++;
        snap(`${t.id} moves ${t.amt}: r${t.from} = ${val[t.from]}, r${t.to} = ${val[t.to]}.`);
      } else {
        t.order.forEach((r) => { delete held[r]; });
        t.pc++; t.st = 'done';
        let woke = '';
        if (o.st === 'blocked' && !held[o.wait]) { held[o.wait] = o.id; woke = ` ${o.id} was waiting for r${o.wait}, so it now gets it and continues.`; o.st = 'ready'; o.wait = null; o.pc++; }
        const fin = T.every((x) => x.st === 'done');
        snap(`${t.id} unlocks r${t.order[0]} and r${t.order[1]}.` + woke + (fin ? ` <b>Both transfers finished: r3 = ${val[3]}, r8 = ${val[8]}.</b>` : ''), fin ? 'ok' : '');
      }
    }
    return frames;
  }

  Guide.section({
    id: '12.5',
    title: 'File Sharing',
    short: 'File sharing',
    summary: 'Who may do what to a shared file, and how locks keep simultaneous updates from destroying each other.',
    objectives: [
      'Name the two issues file sharing raises: access rights and the management of simultaneous access.',
      'List the classic access rights in order, from none to deletion, and explain what each one adds to the rights below it.',
      'Explain the role of the owner and grant rights to a specific user, a user group or all users, then decide whether a request is allowed.',
      'Show how two unprotected updates to the same record lose one of them, and how whole-file and record locking prevent it.',
      'Compare lock granularities by throughput and bookkeeping, and recognize the readers/writers and deadlock problems that locking brings back.',
    ],
    terms: [
      ['File sharing', 'Letting more than one user or process use the same file. The file system must then control who may do what to it, and what happens when several of them use it at the same moment.'],
      ['Access rights', 'The operations a particular user is allowed to perform on a particular file, such as reading it, adding to it or deleting it.'],
      ['Access-rights hierarchy', 'The classic ordering of file rights: none, knowledge, execution, reading, appending, updating, changing protection, deletion. Each right includes every right that comes before it.'],
      ['Knowledge right', 'The right to learn that a file exists and who owns it, so the user can ask the owner for more rights, without being able to open the file.'],
      ['Execution right', 'The right to load and run a program file without being able to read it as data or copy it. Often used for licensed programs.'],
      ['Reading right', 'The right to read a file for any purpose, which includes copying it and, for a program, running it.'],
      ['Appending right', 'The right to add new data to a file, usually only at its end, without changing or removing anything already in it.'],
      ['Updating right', 'The right to change, erase and add data anywhere in a file, including writing it for the first time and rewriting it completely.'],
      ['Changing-protection right', 'The right to change which access rights other users hold on a file. Normally only the owner has it.'],
      ['Deletion right', 'The right to remove a file from the file system altogether. It sits at the top of the classic hierarchy.'],
      ['Owner', 'The user in charge of a file, at first the user who created it. The owner holds every access right and decides which rights other users receive.'],
      ['User group', 'A named set of users that receives access rights together: every member gets the rights granted to the group, without being listed one by one.'],
      ['Public file', 'A file whose rights are granted to the class “all users”, so every user of the system receives them.'],
      ['Simultaneous access', 'Two or more users or processes using the same file during overlapping periods of time. Harmless while everyone only reads; it needs control as soon as anyone changes the file.'],
      ['Whole-file locking', 'Locking an entire file for the length of an update, so no other process can update any part of it until the lock is released.'],
      ['Record locking', 'Locking only the record, or byte range, being updated, so other processes can work on other parts of the same file at the same time.'],
      ['Lock granularity', 'The size of the unit one lock protects: a whole file is coarse, a single record is fine. Finer locks let more work run in parallel but need more locks and more bookkeeping.'],
      ['Shared lock (read lock)', 'A lock that many readers can hold at the same time. It keeps writers out while the readers work.'],
      ['Exclusive lock (write lock)', 'A lock that only one process can hold, and only while nobody holds any other lock on the same data. Writers take it.'],
      ['Advisory lock', 'A lock the system records but does not enforce on ordinary reads and writes: it protects only processes that all agree to ask for the lock first.'],
    ],
    css: `
      .sec-12-5 .narr { background: var(--panel-2); border: 1px solid var(--line); border-left: 5px solid var(--chc); border-radius: 12px; padding: 9px 13px; font-size: 15px; line-height: 1.45; }
      .sec-12-5 .narr.bad { border-left-color: var(--bad); background: var(--bad-bg); }
      .sec-12-5 .narr.ok { border-left-color: var(--ok); background: var(--ok-bg); }
      .sec-12-5 .narr.warn { border-left-color: var(--warn); background: var(--warn-bg); }
      .sec-12-5 .grid-2 > *, .sec-12-5 .grid-3 > *, .sec-12-5 .mw0 > * { min-width: 0; }
      .sec-12-5 .ladder { display: flex; flex-direction: column; gap: 4px; padding-left: 14px; border-left: 4px solid var(--line-2); }
      .sec-12-5 .rung { display: grid; grid-template-columns: 26px 1fr auto; align-items: center; gap: 8px; height: 34px; padding: 0 12px; border-radius: 10px; border: 1px solid var(--line-2); background: var(--panel); color: var(--ink); font-size: 15.5px; font-weight: 700; cursor: pointer; text-align: left; }
      .sec-12-5 .rung:hover { border-color: var(--accent); }
      .sec-12-5 .rung .k { font-family: var(--mono); color: var(--muted); font-size: 14px; }
      .sec-12-5 .rung .st { font-size: 13px; font-weight: 700; color: var(--ok); }
      .sec-12-5 .rung.held { background: var(--ok-bg); border-color: color-mix(in srgb, var(--ok) 45%, transparent); }
      .sec-12-5 .rung.cur { outline: 3px solid var(--chc); outline-offset: 1px; }
      .sec-12-5 .yes { color: var(--ok); font-weight: 800; }
      .sec-12-5 .no { color: var(--bad); font-weight: 800; }
      .sec-12-5 .ns { flex-shrink: 0; }
      .sec-12-5 .cls-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 10px; padding: 7px 10px; border: 1px solid var(--line); border-radius: 10px; background: var(--panel); }
      .sec-12-5 .cls-row .nm { font-weight: 800; font-size: 15.5px; line-height: 1.2; }
      .sec-12-5 .cls-row .sub { font-size: 13px; color: var(--muted); line-height: 1.25; }
      .sec-12-5 .stepper { display: flex; align-items: center; gap: 6px; }
      .sec-12-5 .stepper .lv { width: 168px; text-align: center; font-weight: 700; font-size: 14.5px; padding: 4px 6px; border-radius: 8px; background: var(--os-bg); color: var(--os); white-space: nowrap; }
      .sec-12-5 .stepper .btn { width: 30px; padding: 0; }
      .sec-12-5 .act-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
      .sec-12-5 .act-grid .btn { justify-content: flex-start; }
      .sec-12-5 .verdict-big { font-size: 20px; font-weight: 900; letter-spacing: .01em; }
      .sec-12-5 .why-list { margin: 0; padding-left: 20px; font-size: 14.5px; line-height: 1.42; }
      .sec-12-5 table.tbl.acts td { padding: 3px 9px; font-size: 14.5px; }
      .sec-12-5 table.tbl.acts th { padding: 5px 9px; }
      .sec-12-5 table.tbl.recs td { padding: 3px 10px; font-size: 15px; }
      .sec-12-5 table.tbl.recs th { padding: 4px 10px; }
      .sec-12-5 table.tbl.recs tr.dim td { color: var(--muted); }
      .sec-12-5 .rw-row { display: grid; grid-template-columns: minmax(0, 1fr) 96px 150px; align-items: center; gap: 10px; padding: 6px 10px; border: 1px solid var(--line); border-radius: 10px; background: var(--panel); }
      .sec-12-5 .rw-row .nm { font-weight: 800; font-size: 15.5px; }
      .sec-12-5 .rw-row .sub { font-size: 13px; color: var(--muted); }
      .sec-12-5 .rw-row .btn { width: 100%; }
      .sec-12-5 table.tbl.mx td, .sec-12-5 table.tbl.mx th { text-align: center; padding: 4px 8px; font-size: 14.5px; }
      .sec-12-5 table.tbl.mx td:first-child, .sec-12-5 table.tbl.mx th:first-child { text-align: left; }
      .sec-12-5 table.tbl.mx td.hit { outline: 3px solid var(--chc); outline-offset: -3px; border-radius: 6px; }
      .sec-12-5 .tabs-panel { padding-top: 10px; }
      .sec-12-5 table.tbl.prog td { padding: 2px 8px; font-size: 14px; vertical-align: middle; }
      .sec-12-5 table.tbl.prog td.cd { font-family: var(--mono); font-weight: 700; white-space: nowrap; }
      .sec-12-5 table.tbl.prog td.cm { color: var(--ink-2); font-size: 13.5px; }
      .sec-12-5 table.tbl.prog td.pt { width: 46px; text-align: center; font-size: 13px; font-weight: 800; }
      .sec-12-5 .pc-on { display: inline-block; padding: 0 6px; border-radius: 6px; background: var(--proc-bg); color: var(--proc); }
      .sec-12-5 .pc-on.pb { background: var(--thread-bg); color: var(--thread); }
      .sec-12-5 .pc-on.wt { background: var(--warn-bg); color: var(--warn); }
      .sec-12-5 .pcard2 { border: 2px solid var(--proc); background: var(--proc-bg); border-radius: 12px; padding: 7px 11px; display: flex; flex-direction: column; gap: 3px; min-width: 0; }
      .sec-12-5 .pcard2.pb { border-color: var(--thread); background: var(--thread-bg); }
      .sec-12-5 .pcard2 .nm { font-weight: 900; font-size: 16.5px; }
      .sec-12-5 .pcard2 .ln2 { font-size: 14px; display: flex; justify-content: space-between; gap: 8px; }
      .sec-12-5 .labbtns .btn { flex: 1; }
      .sec-12-5 .log { font-size: 13px; }
      .sec-12-5 table.tbl.cmp td { padding: 4px 8px; font-size: 14.5px; }
      .sec-12-5 table.tbl.cmp th { padding: 5px 8px; font-size: 12px; }
    `,
    steps: [
      {
        title: 'One file, many users',
        kind: 'story',
        html: `
          <div class="split fill">
            <div class="stack" style="gap:10px">
              <p class="lead m0">A file that only one person uses is easy to manage. Once several users share a file, the file system must answer two new questions.</p>
              <p class="m0">A team keeps its budget in one spreadsheet; a lab runs one shared program. <span class="t">File sharing</span> saves copies and keeps everyone on the same version, but it raises two issues:</p>
              <div class="card tight os m0"><b>1. Access rights: who may do what?</b> The owner decides which <span class="t">access rights</span> each user gets (see it, run it, read it, add to it, change it, delete it), and the OS checks every request.</div>
              <div class="card tight intr m0"><b>2. <span class="t">Simultaneous access</span>: what if two users change it at once?</b> Two updates to the same data can silently wipe each other out, so the OS needs a rule, usually a lock.</div>
              <div class="callout analogy m0" data-label="Analogy">An office whiteboard: someone decides who may read it, who may add a note and who may erase. And two people writing in the same box at once make a mess unless one waits for the other.</div>
              <div class="row gap-s small"><span class="chip os">climb the rights ladder</span><span class="chip proc">test requests</span><span class="chip intr">lose an update</span><span class="chip ok">fix it with locks</span></div>
            </div>
            <div class="card stack" style="gap:8px">
              <h4 class="m0">Four users, one shared file</h4>
              <div class="s1-seg"></div>
              <div class="card white grow s1-fig" style="display:grid;place-items:center;padding:6px"></div>
              <div class="narr s1-cap"></div>
            </div>
          </div>`,
        render(el, ctx) {
          const { s } = ctx;
          // two geometries: wide (arrow labels beside the arrows) and slim phone (labels between box and arrow)
          const slim = ctx.narrow;
          const G = slim
            ? { vb: '0 0 300 404', bw: 140, bh: 48, f: [75, 170, 150, 56], top: null }
            : { vb: '0 0 520 330', bw: 160, bh: 52, f: [180, 133, 160, 64], top: 226 };
          const svg = s('svg', { viewBox: G.vb, width: '100%', role: 'img', 'aria-label': 'Four users around one shared file' });
          ctx.$('.s1-fig').append(svg);
          const cap = ctx.$('.s1-cap');
          // users: name, role, box x, box y, arrow start and end, label x, label y, label anchor
          const NAMES = [['Ana', 'owner (created it)'], ['Ben', 'one named user'], ['Cara, Dev', 'group “lab”'], ['Eve, others', 'all users']];
          const GEO = slim
            ? [[0, 0, [70, 96, 120, 168], 70, 70, 'middle'], [160, 0, [230, 96, 180, 168], 230, 70, 'middle'], [0, 352, [70, 304, 120, 230], 70, 322, 'middle'], [160, 352, [230, 304, 180, 230], 230, 322, 'middle']]
            : [[10, 8, [120, 60, 205, 133], 150, 96, 'end'], [350, 8, [400, 60, 315, 133], 370, 96, 'start'], [10, 270, [120, 270, 205, 197], 150, 226, 'end'], [350, 270, [400, 270, 315, 197], 370, 226, 'start']];
          const users = NAMES.map(([n, r], i) => { const [x, y, a, lx, ly, anc] = GEO[i]; return { n, r, x, y, a, lx, ly, anc }; });
          const views = {
            all: { lab: [['wants to use it', ''], ['wants to use it', ''], ['wants to use it', ''], ['wants to use it', '']], cls: ['muted', 'muted', 'muted', 'muted'],
              cap: 'Four kinds of user reach for the same file <b>budget.csv</b>. Pick an issue above to see what the OS has to decide.' },
            rights: { lab: [['delete it ✓', 'owner: every right'], ['edit row 7 ✓', 'granted: updating'], ['read it ✓', 'group granted: reading'], ['read it ✗', 'all users: knowledge']], cls: ['ok', 'ok', 'ok', 'bad'],
              cap: '<b>Issue 1.</b> The same request can be allowed for one user and refused for another. Eve may see that the file exists and who owns it, but not open it. The OS checks each request against the rights the owner granted.' },
            simul: { lab: [['writes row 7 = 700', 'spent 300 of 1000'], ['writes row 7 = 800', 'spent 200 of 1000'], ['', ''], ['', '']], cls: ['bad', 'bad', 'muted', 'muted'],
              cap: '<b>Issue 2.</b> Ana and Ben both read “1000 left” from row 7, both subtract their spending, both write. The second write replaces the first, so one payment vanishes: 800 is stored, but only 500 is really left.' },
          };
          function draw(view) {
            const v = views[view];
            const kids = [];
            users.forEach((u, i) => {
              const dim = v.cls[i] === 'muted' && view === 'simul';
              const g = s('g', { opacity: dim ? 0.35 : 1 },
                s('rect', { x: u.x, y: u.y, width: G.bw, height: G.bh, rx: 12, class: i === 0 ? 's-os' : 's-proc', 'stroke-width': 2 }),
                s('text', { x: u.x + G.bw / 2, y: u.y + 21, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 16 }, u.n),
                s('text', { x: u.x + G.bw / 2, y: u.y + G.bh - 10, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, u.r),
                dim ? null : s('line', { x1: u.a[0], y1: u.a[1], x2: u.a[2], y2: u.a[3], class: 's-line', 'stroke-width': 2, style: v.cls[i] === 'muted' ? 'stroke:var(--muted)' : 'stroke:var(--' + v.cls[i] + ')', 'marker-end': 'url(#arr-' + v.cls[i] + ')' }),
                s('text', { x: u.lx, y: u.ly, 'text-anchor': u.anc, 'font-weight': 700, 'font-size': 14, style: v.cls[i] === 'muted' ? '' : 'fill:var(--' + v.cls[i] + ')' }, v.lab[i][0]),
                s('text', { x: u.lx, y: u.ly + 18, 'text-anchor': u.anc, 'font-size': 13, class: 's-sub' }, v.lab[i][1]));
              kids.push(g);
            });
            const [fx, fy, fw, fh] = G.f, mx = fx + fw / 2;
            kids.push(s('rect', { x: fx, y: fy, width: fw, height: fh, rx: 12, class: 's-io', 'stroke-width': 2.5 }),
              s('text', { x: mx, y: fy + fh / 2 - 3, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 17 }, 'budget.csv'),
              s('text', { x: mx, y: fy + fh / 2 + 17, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, 'one shared file'));
            if (view === 'simul' && G.top) kids.push(s('text', { x: mx, y: G.top, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 15, style: 'fill:var(--bad)' }, 'the second write wins'));
            svg.replaceChildren(...kids);
            cap.innerHTML = v.cap;
            cap.className = 'narr s1-cap' + (view === 'simul' ? ' bad' : view === 'rights' ? ' ok' : '');
          }
          ctx.$('.s1-seg').append(ctx.ui.seg([{ value: 'all', label: 'The users' }, { value: 'rights', label: 'Issue 1: rights' }, { value: 'simul', label: 'Issue 2: at once' }], 'all', draw));
          draw('all');
        },
      },
      {
        title: 'The rights ladder: each right includes the ones below',
        kind: 'explore',
        core: true,
        render(el, ctx) {
          const { h } = ctx;
          // what Ben might try with Ana's file, and the lowest right that allows it
          const acts = [
            ['See that it exists and who owns it', 1], ['Run it, if it is a program', 2],
            ['Open and read it', 3], ['Copy it', 3], ['Add new data at the end', 4], ['Change or erase data inside it', 5],
            ['Change other users’ rights on it', 6], ['Delete the file', 7],
          ];
          let lvl = 3;
          const slider = ctx.ui.slider({ label: 'Ben’s right', min: 0, max: 7, value: lvl, format: (v) => RIGHTS[v].n, onInput: (v) => set(v) });
          const rungs = [];
          for (let k = 7; k >= 0; k--) {
            const b = h('button', { class: 'rung', type: 'button', 'aria-label': 'Give Ben the right: ' + RIGHTS[k].n, onclick: () => { slider.set(k); set(k); } },
              h('span', { class: 'k' }, String(k)), h('span', {}, RIGHTS[k].n), h('span', { class: 'st' }));
            rungs[k] = b;
          }
          const ladder = h('div', { class: 'ladder' }, ...rungs.slice().reverse());
          const head = h('div', { class: 'row', style: { justifyContent: 'space-between' } });
          const add = h('p', { class: 'm0', style: { fontSize: '15.5px' } });
          const ex = h('p', { class: 'small muted m0' });
          const tbody = h('tbody');
          const tbl = h('table', { class: 'tbl acts ns' }, h('thead', {}, h('tr', {}, h('th', {}, 'Ben tries to …'), h('th', {}, 'Lowest right needed'), h('th', { style: { width: '92px' } }, 'Result'))), tbody);
          function set(v) {
            lvl = v;
            rungs.forEach((b, k) => {
              b.classList.toggle('held', k <= lvl && k > 0);
              b.classList.toggle('cur', k === lvl);
              b.querySelector('.st').textContent = k === lvl ? 'Ben is here' : (k < lvl && k > 0 ? 'included' : '');
            });
            const r = RIGHTS[lvl];
            head.replaceChildren(
              h('b', { style: { fontSize: '19px' }, html: `Level ${lvl}: ${r.t ? `<span class="t" data-t="${r.t}">${r.n}</span>` : r.n}` }),
              h('span', { class: 'chip ' + (lvl === 0 ? 'bad' : 'ok') }, lvl === 0 ? 'no rights at all' : lvl === 1 ? 'the lowest real right' : lvl === 2 ? 'also holds rung 1' : 'also holds rungs 1–' + (lvl - 1)));
            add.innerHTML = '<b>Adds:</b> ' + r.add;
            ex.innerHTML = 'Example: ' + r.ex;
            tbody.replaceChildren(...acts.map(([a, need]) => {
              const ok = lvl >= need;
              return h('tr', { class: need === lvl ? 'on' : '' }, h('td', {}, a), h('td', {}, RIGHTS[need].n),
                h('td', { html: ok ? '<span class="yes">✓ allowed</span>' : '<span class="no">✗ refused</span>' }));
            }));
          }
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack', style: { gap: '10px' } },
              h('p', { class: 'm0', html: 'Ana owns a file and decides what Ben may do with it. The classic <span class="t">access-rights hierarchy</span> has eight levels: move the slider or click a rung.' }),
              slider, ladder,
              h('div', { class: 'callout tip small m0', 'data-label': 'Real systems differ', html: 'The ladder is the classic model. Real systems mostly use separate switches: UNIX read, write and execute bits are independent, so a file can be writable but not readable.' })),
            h('div', { class: 'stack', style: { gap: '10px' } },
              h('div', { class: 'card tight stack ns', style: { gap: '6px' } }, head, add, ex),
              tbl,
              h('div', { class: 'callout why m0 small', 'data-label': 'Why this order?', html: 'Each rung allows strictly more. Execution sits <b>below</b> reading: a run-only program cannot be copied, but reading allows running and copying. Appending sits below updating: adding at the end cannot damage what is already there.' }))));
          set(lvl);
        },
      },
      {
        title: 'The owner grants rights to classes of users',
        kind: 'lab',
        render(el, ctx) {
          const { h } = ctx;
          const LAB = ['Ben', 'Cara', 'Dev'];
          const USERS = ['Ana', 'Ben', 'Cara', 'Dev', 'Eve'];
          const ACTS = [['See it listed', 1], ['Read it', 3], ['Copy it', 3], ['Add a row at the end', 4], ['Edit a row', 5], ['Change who may use it', 6], ['Delete it', 7]];
          const DEF = { named: 5, group: 3, all: 1 };
          const g = { ...DEF };
          let rule = 'combine', who = 'Ben', act = 4;
          const lvName = (k) => k + ' · ' + RIGHTS[k].n;
          const classes = [
            ['named', 'Specific user: Ben', 'one person, named by <span class="t">user ID</span>'],
            ['group', '<span class="t">User group</span> “lab”', 'members: Ben, Cara, Dev'],
            ['all', 'All users', 'everyone on the system: a <span class="t">public file</span>'],
          ];
          const lvEls = {};
          const rows = classes.map(([key, nm, sub]) => {
            const lv = h('span', { class: 'lv' });
            lvEls[key] = lv;
            const step = (d) => { g[key] = ctx.util.clamp(g[key] + d, 0, 7); update(); };
            return h('div', { class: 'cls-row', style: ctx.narrow ? { gridTemplateColumns: 'minmax(0, 1fr)' } : {} },
              h('div', {}, h('div', { class: 'nm', html: nm }), h('div', { class: 'sub', html: sub })),
              h('div', { class: 'stepper' },
                h('button', { class: 'btn sm', type: 'button', 'aria-label': 'Lower the right', onclick: () => step(-1) }, '−'), lv,
                h('button', { class: 'btn sm', type: 'button', 'aria-label': 'Raise the right', onclick: () => step(1) }, '+')));
          });
          const ownerRow = h('div', { class: 'cls-row', style: { background: 'var(--os-bg)' } },
            h('div', {}, h('div', { class: 'nm' }, 'Owner: Ana'), h('div', { class: 'sub' }, 'created the file, so Ana owns it')),
            h('span', { class: 'chip os' }, 'every right, fixed'));
          const ruleText = h('p', { class: 'small muted m0' });
          const ruleSeg = ctx.ui.seg([{ value: 'combine', label: 'Combine all matching classes' }, { value: 'specific', label: 'Most specific class only' }], rule, (v) => { rule = v; update(); });
          const whoSeg = ctx.ui.seg(USERS, who, (v) => { who = v; update(); });
          const actBtns = ACTS.map(([a], i) => h('button', { class: 'btn sm', type: 'button', onclick: () => { act = i; update(); } }, a));
          const verdict = h('div', { class: 'narr grow', style: { display: 'flex', flexDirection: 'column', gap: '6px' } });
          function memberOf(u) {
            const m = [];
            if (u === 'Ben') m.push(['named', 'named user Ben']);
            if (LAB.includes(u)) m.push(['group', 'group lab']);
            m.push(['all', 'all users']);
            return m;
          }
          function effective(u) {
            if (u === 'Ana') return { lvl: 7, by: 'owner' };
            const m = memberOf(u);
            if (rule === 'specific') return { lvl: g[m[0][0]], by: m[0][0] };
            let best = m[0];
            m.forEach((x) => { if (g[x[0]] > g[best[0]]) best = x; });
            return { lvl: g[best[0]], by: best[0] };
          }
          function update() {
            Object.keys(lvEls).forEach((k) => { lvEls[k].textContent = lvName(g[k]); });
            ruleText.innerHTML = rule === 'combine'
              ? 'A user gets the <b>highest</b> right granted to any class they belong to, so a grant can only add rights. Windows access lists add up allow entries this way, though an explicit deny entry still wins.'
              : 'Only the <b>most specific</b> matching class counts: owner, then named user, then group, then all users. Classic UNIX bits (owner, group, others) work this way; POSIX access lists add named users right after the owner.';
            actBtns.forEach((b, i) => b.classList.toggle('on', i === act));
            const [aName, need] = ACTS[act];
            const e = effective(who);
            const ok = e.lvl >= need;
            const lines = [];
            if (who === 'Ana') lines.push('Ana is the <b>owner</b> and holds every right, up to deletion. No class grant is even consulted.');
            else {
              const m = memberOf(who);
              lines.push(`<b>${who}</b> belongs to: ` + m.map(([k, label]) => `${label} (${RIGHTS[g[k]].n})`).join(', ') + '.');
              const src = m.find((x) => x[0] === e.by)[1];
              lines.push(rule === 'combine'
                ? `Combine rule: the highest of these is <b>${RIGHTS[e.lvl].n}</b> (from ${src}).`
                : `Most-specific rule: ${src} decides, so ${who} holds <b>${RIGHTS[e.lvl].n}</b>` + (m.length > 1 ? '; the broader classes are ignored.' : '.'));
              if (rule === 'combine' && who === 'Ben' && g.named < e.lvl) lines.push('Notice: the grant made to Ben by name cannot lower what the other classes give.');
              if (rule === 'specific' && m.length > 1 && Math.max(...m.map(([k]) => g[k])) > e.lvl) lines.push('Notice: a broader class offers more, but it is ignored. This is how an owner can shut out one person or group while everyone else gets in.');
            }
            lines.push(`“${aName}” needs <b>${RIGHTS[need].n}</b> (rung ${need}); ${who} holds rung ${e.lvl} → <b>${ok ? 'allowed' : 'refused'}</b>.` + (!ok ? ' The way forward is to ask Ana, the owner, for more.' : ''));
            verdict.className = 'narr grow ' + (ok ? 'ok' : 'bad');
            verdict.replaceChildren(
              h('div', { class: 'verdict-big', style: { color: ok ? 'var(--ok)' : 'var(--bad)' } }, (ok ? '✓ ALLOWED: ' : '✗ REFUSED: ') + who + ' · ' + aName.toLowerCase()),
              h('ul', { class: 'why-list' }, ...lines.map((l) => h('li', { html: l }))));
          }
          const preset = (named, group, all, u, a) => { Object.assign(g, { named, group, all }); who = u; act = a; whoSeg.set(u); update(); };
          el.append(h('div', { class: 'split fill' },
            h('div', { class: 'card stack', style: { gap: '8px' } },
              h('h4', { class: 'm0' }, 'Ana’s grant list for budget.csv'),
              h('p', { class: 'small m0', html: 'The <span class="t">owner</span> starts out as the file’s creator, holds every right, and may grant rights to others, one class of users at a time. Each grant is a rung of the ladder.' }),
              ownerRow, ...rows,
              h('div', { class: 'row gap-s' }, h('span', { class: 'small b' }, 'User in several classes:'), ruleSeg),
              ruleText,
              h('div', { class: 'row gap-s', style: { marginTop: 'auto' } },
                h('button', { class: 'btn sm', type: 'button', onclick: () => preset(DEF.named, DEF.group, DEF.all, 'Ben', 4) }, 'Default grants'),
                h('button', { class: 'btn sm', type: 'button', onclick: () => preset(0, 3, 3, 'Ben', 1) }, 'Try: block Ben, publish to all'))),
            h('div', { class: 'card stack', style: { gap: '8px' } },
              h('h4', { class: 'm0' }, 'Test a request'),
              h('div', { class: 'row gap-s' }, h('span', { class: 'small b' }, 'Who asks?'), whoSeg),
              h('div', { class: 'small b' }, 'To do what with budget.csv?'),
              h('div', { class: 'act-grid' }, ...actBtns),
              verdict)));
          update();
        },
      },
      {
        title: 'You are the scheduler: lose an update, then lock it',
        kind: 'lab',
        core: true,
        render(el, ctx) {
          const { h } = ctx;
          const ROWS = [[3, 'rent', 250], [7, 'travel', 1000], [9, 'snacks', 80], [12, 'equipment', 600]];
          let mode = 'none', bRow = 7, gen = 0, S;
          const keyOf = (p) => (mode === 'file' ? 'file' : 'row ' + p.row);
          const lockLabel = (k) => (k === 'file' ? 'the whole file' : k);
          const prog = () => (mode === 'none' ? ['read', 'compute', 'write'] : ['lock', 'read', 'compute', 'write', 'unlock']);
          function fresh() {
            const disk = {}, ver = {};
            ROWS.forEach(([r, , v]) => { disk[r] = v; ver[r] = 0; });
            return { disk, ver, locks: {}, queue: {}, t: 0, log: [], narr: '', ncls: '',
              procs: [
                { id: 'A', who: 'Ana', row: 7, amt: 300, pc: 0, x: null, readVer: null, st: 'ready', waited: 0 },
                { id: 'B', who: 'Ben', row: bRow, amt: bRow === 7 ? 200 : 150, pc: 0, x: null, readVer: null, st: 'ready', waited: 0 },
              ] };
          }
          const canRun = (p) => p.st === 'ready';
          function stepProc(i) {
            const p = S.procs[i], o = S.procs[1 - i], op = prog()[p.pc];
            S.t++;
            if (o.st === 'blocked') o.waited++;
            let n = '', cls = '';
            if (op === 'lock') {
              const k = keyOf(p);
              if (!S.locks[k]) { S.locks[k] = p.id; p.pc++; n = `${p.who} locks ${lockLabel(k)}. Nobody else held it, so ${p.who} carries on.`; S.log.push(`${p.id}: lock ${k} → granted`); }
              else {
                p.st = 'blocked'; (S.queue[k] = S.queue[k] || []).push(p.id);
                n = `${p.who} asks for ${lockLabel(k)}, but ${o.who} holds it. The OS blocks ${p.who} until ${o.who} unlocks.` + (mode === 'file' && p.row !== o.row ? ' Notice: they want different rows, yet a whole-file lock still makes one wait.' : '');
                cls = 'warn'; S.log.push(`${p.id}: lock ${k} → blocked`);
              }
            } else if (op === 'read') {
              p.x = S.disk[p.row]; p.readVer = S.ver[p.row]; p.pc++;
              const twin = o.row === p.row && o.x !== null && o.pc <= prog().indexOf('write');
              n = `${p.who} reads row ${p.row} into private memory: x = ${p.x}.` + (twin ? ` ${o.who} is also holding a private copy of row ${p.row} that has not been written back yet. Trouble ahead.` : '');
              if (twin) cls = 'warn';
              S.log.push(`${p.id}: x = read(row ${p.row}) = ${p.x}`);
            } else if (op === 'compute') {
              p.x -= p.amt; p.pc++;
              n = `${p.who} subtracts ${p.amt} from the private copy: x = ${p.x}. The file itself has not changed yet.`;
              S.log.push(`${p.id}: x = x − ${p.amt} = ${p.x}`);
            } else if (op === 'write') {
              const old = S.disk[p.row], stale = S.ver[p.row] !== p.readVer;
              S.disk[p.row] = p.x; S.ver[p.row]++; p.pc++;
              if (stale) { n = `${p.who} writes ${p.x} to row ${p.row}, replacing the ${old} that ${o.who} wrote after ${p.who} had read the row. ${o.who}’s change is gone: a <span class="t">lost update</span>.`; cls = 'bad'; }
              else n = `${p.who} writes ${p.x} back to row ${p.row}.`;
              S.log.push(`${p.id}: write(row ${p.row}, ${p.x})` + (stale ? '  ← overwrote ' + old : ''));
            } else if (op === 'unlock') {
              const k = keyOf(p);
              delete S.locks[k]; p.pc++;
              const q = (S.queue[k] || []).shift();
              if (q) { const w = S.procs.find((x) => x.id === q); S.locks[k] = w.id; w.st = 'ready'; w.pc++; n = `${p.who} unlocks ${lockLabel(k)}. The OS wakes ${w.who}, who now holds the lock and continues.`; S.log.push(`${p.id}: unlock ${k} → ${w.id} gets it`); }
              else { n = `${p.who} unlocks ${lockLabel(k)}. Nobody was waiting.`; S.log.push(`${p.id}: unlock ${k}`); }
              cls = 'ok';
            }
            if (p.pc >= prog().length) p.st = 'done';
            if (S.procs.every((x) => x.st === 'done')) {
              const exp = {};
              ROWS.forEach(([r, , v]) => { exp[r] = v; });
              S.procs.forEach((x) => { exp[x.row] -= x.amt; });
              const bad = ROWS.filter(([r]) => exp[r] !== S.disk[r]);
              if (bad.length) { n += ` <b>Both finished, but row ${bad[0][0]} holds ${S.disk[bad[0][0]]} instead of ${exp[bad[0][0]]}.</b>`; cls = 'bad'; }
              else { n += ` <b>Both finished and every row is correct</b> (${S.procs.map((x) => 'row ' + x.row + ' = ' + S.disk[x.row]).filter((v, j, a) => a.indexOf(v) === j).join(', ')}).`; cls = cls === 'bad' ? 'bad' : 'ok'; }
              const w = S.procs.find((x) => x.waited > 0);
              if (w) n += ` ${w.who} sat blocked while ${w.waited} of the ${S.t} lines ran` + (S.procs[0].row !== S.procs[1].row ? ', although the two rows never overlapped.' : '.');
            }
            S.narr = n; S.ncls = cls;
          }
          // ---- view ----
          const recBody = h('tbody'), fileChip = h('span');
          const recTbl = h('table', { class: 'tbl recs ns' }, h('thead', {}, h('tr', {}, h('th', {}, 'Row'), h('th', {}, 'Item'), h('th', {}, 'Left to spend'), h('th', {}, 'Lock'))), recBody);
          const progBody = h('tbody');
          const progTbl = h('table', { class: 'tbl prog ns' }, h('thead', {}, h('tr', {}, h('th', {}, 'Ana'), h('th', {}, 'Ben'), h('th', {}, 'Each process runs'), h('th', {}, 'What the line does'))), progBody);
          const cardA = h('div', { class: 'pcard2' }), cardB = h('div', { class: 'pcard2 pb' });
          const narr = h('div', { class: 'narr' });
          const log = h('div', { class: 'log grow' });
          const runA = h('button', { class: 'btn', type: 'button', onclick: () => { gen++; manual(0); } }, 'Run Ana’s next line');
          const runB = h('button', { class: 'btn', type: 'button', onclick: () => { gen++; manual(1); } }, 'Run Ben’s next line');
          const LINES = {
            lock: ['lock(L)', 'wait here until nobody else holds lock L'],
            read: ['x = read(r)', 'copy row r of the file into private memory'],
            compute: ['x = x − amount', 'change the private copy only'],
            write: ['write(r, x)', 'store the private copy back in row r'],
            unlock: ['unlock(L)', 'release the lock; the OS wakes one waiting process'],
          };
          function draw() {
            const A = S.procs[0], B = S.procs[1];
            recBody.replaceChildren(...ROWS.map(([r, item]) => {
              const lk = mode === 'record' && S.locks['row ' + r] ? 'held by ' + (S.locks['row ' + r] === 'A' ? 'Ana' : 'Ben') : '';
              const used = r === A.row || r === B.row;
              return h('tr', { class: used ? '' : 'dim' }, h('td', {}, String(r)), h('td', {}, item), h('td', { class: 'b mono' }, String(S.disk[r])), h('td', { html: lk ? `<span class="chip os">${lk}</span>` : '' }));
            }));
            const fl = S.locks.file;
            fileChip.innerHTML = mode === 'none' ? '<span class="chip">no locking</span>' : mode === 'record' ? '<span class="chip os">record locks</span>' : (fl ? `<span class="chip os">whole file locked by ${fl === 'A' ? 'Ana' : 'Ben'}</span>` : '<span class="chip">whole-file lock: free</span>');
            const lockName = mode === 'file' ? 'budget.csv' : 'row r';
            progBody.replaceChildren(...prog().map((op, j) => {
              const pt = (p, cls) => (p.st !== 'done' && p.pc === j ? `<span class="pc-on ${cls}${p.st === 'blocked' ? ' wt' : ''}">${p.st === 'blocked' ? 'wait' : '▶'}</span>` : '');
              const [code, cm] = LINES[op];
              return h('tr', {}, h('td', { class: 'pt', html: pt(A, '') }), h('td', { class: 'pt', html: pt(B, 'pb') }),
                h('td', { class: 'cd' }, code.replace('L', lockName)), h('td', { class: 'cm' }, cm.replace('lock L', 'the lock on ' + lockName)));
            }));
            [[cardA, A], [cardB, B]].forEach(([c, p]) => {
              const st = p.st === 'done' ? '<span class="chip ok">done</span>' : p.st === 'blocked' ? '<span class="chip warn">blocked</span>' : '<span class="chip">ready</span>';
              c.innerHTML = `<div class="ln2"><span class="nm">${p.who}</span>${st}</div><div class="ln2"><span>row ${p.row}, amount ${p.amt}</span><span>private x = <b class="mono">${p.x === null ? '—' : p.x}</b></span></div>`;
            });
            narr.innerHTML = S.narr || (mode === 'none'
              ? 'No locks. Try the worst order: Ana, Ben, Ana, Ben, Ana, Ben. Or press <b>Auto</b>.'
              : 'Now every update starts with <b>lock</b> and ends with <b>unlock</b>. Try the same alternating order and watch who has to wait.');
            narr.className = 'narr ' + (S.ncls || '');
            log.replaceChildren(...(S.log.length ? S.log : ['(no lines run yet)']).map((l, j) => h('div', {}, (S.log.length ? (j + 1) + '. ' : '') + l)));
            log.scrollTop = log.scrollHeight;
            runA.disabled = !canRun(A); runB.disabled = !canRun(B);
          }
          function manual(i) { if (canRun(S.procs[i])) { stepProc(i); draw(); } }
          function reset() { gen++; S = fresh(); draw(); }
          async function auto() {
            reset();
            const my = gen;
            let turn = 0;
            while (S.procs.some((p) => p.st !== 'done')) {
              await ctx.sleep(850);
              if (!ctx.alive || my !== gen) return;
              let i = turn % 2;
              if (!canRun(S.procs[i])) i = 1 - i;
              if (!canRun(S.procs[i])) return;
              stepProc(i); draw(); turn++;
            }
          }
          const modeSeg = ctx.ui.seg([{ value: 'none', label: 'No lock' }, { value: 'file', label: 'Lock whole file' }, { value: 'record', label: 'Lock the record' }], mode, (v) => { mode = v; reset(); });
          const rowSeg = ctx.ui.seg([{ value: 7, label: 'row 7 (same as Ana)' }, { value: 12, label: 'row 12 (different)' }], bRow, (v) => { bRow = v; reset(); });
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack', style: { gap: '9px' } },
              h('p', { class: 'm0', html: 'Ana and Ben pay bills from <b>budget.csv</b> at the same moment. Each update reads a row, changes it in private memory, then writes it back. <b>You are the scheduler</b>: choose whose next line runs.' }),
              h('div', { class: 'row gap-s' }, h('span', { class: 'small b', style: { width: '104px' } }, 'Locking:'), modeSeg),
              h('div', { class: 'row gap-s' }, h('span', { class: 'small b', style: { width: '104px' } }, 'Ben updates:'), rowSeg),
              h('div', { class: 'row gap-s labbtns' }, runA, runB),
              h('div', { class: 'row gap-s labbtns' },
                h('button', { class: 'btn primary', type: 'button', onclick: () => auto() }, 'Auto: alternate turns'),
                h('button', { class: 'btn', type: 'button', onclick: () => reset() }, 'Reset')),
              narr, log),
            h('div', { class: 'stack', style: { gap: '9px' } },
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'The shared file budget.csv'), fileChip),
              recTbl, progTbl,
              h('div', { class: 'grid-2', style: { gap: '9px' } }, cardA, cardB),
              h('div', { class: 'callout why small m0', 'data-label': 'Why it matters', html: 'The danger is the gap between read and write. A lock makes read, change, write one unit that no other process using the lock can break into.' }))));
          S = fresh(); draw();
          return () => { gen++; };
        },
      },
      {
        title: 'Lock the whole file, or just one record?',
        kind: 'compare',
        render(el, ctx) {
          const { h, s } = ctx;
          const T = 30; // ms each update holds its lock: read 10, change 10, write 10
          let n = 6, R = 8, seed = 1, mode = 'record';
          const MODES = [['none', 'No locks'], ['file', 'Whole-file lock'], ['record', 'Record locks']];
          function plan() {
            const rng = ctx.util.seeded(seed);
            const req = Array.from({ length: n }, () => 1 + Math.floor(rng() * R));
            const cnt = {};
            req.forEach((r) => { cnt[r] = (cnt[r] || 0) + 1; });
            const pos = {}, lastOf = {};
            const recStart = req.map((r, i) => { const j = pos[r] || 0; pos[r] = j + 1; lastOf[r] = i; return j * T; });
            const lost = Object.values(cnt).reduce((a, k) => a + k - 1, 0);
            const top = Math.max(...Object.values(cnt));
            return {
              req, cnt, lastOf, top,
              none: { start: req.map(() => 0), done: T, lost, locks: 0 },
              file: { start: req.map((_, i) => i * T), done: n * T, lost: 0, locks: 1 },
              record: { start: recStart, done: top * T, lost: 0, locks: Object.keys(cnt).length },
            };
          }
          const slim = ctx.narrow, W = slim ? 330 : 640;
          const svg = s('svg', { viewBox: `0 0 ${W} 300`, width: '100%', role: 'img', 'aria-label': 'Timeline of the updates' });
          const tbody = h('tbody');
          const tbl = h('table', { class: 'tbl cmp ns' }, h('thead', {}, h('tr', {}, h('th', {}, 'Locking'), h('th', {}, 'All done'), h('th', {}, 'Updates/s'), h('th', {}, 'Lost'), h('th', {}, 'Locks held'))), tbody);
          const narr = h('div', { class: 'narr' });
          function draw() {
            const P = plan(), M = P[mode];
            const x0 = slim ? 66 : 118, x1 = W - 12, scale = (x1 - x0) / (n * T), rh = Math.min(54, Math.floor(262 / n)), y0 = 30;
            const kids = [s('text', { x: 4, y: 16, 'font-size': 13, 'font-weight': 700, class: 's-sub' }, slim ? 'ms →' : 'user → record')];
            for (let k = 0; k <= n; k++) {
              const x = x0 + k * T * scale;
              kids.push(s('line', { x1: x, y1: y0 - 4, x2: x, y2: y0 + n * rh, class: 's-line', style: 'stroke:var(--line)' }),
                s('text', { x, y: 16, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, String(k * T)));
            }
            P.req.forEach((r, i) => {
              const y = y0 + i * rh, bh = rh - 8, st = M.start[i];
              const isLost = mode === 'none' && P.lastOf[r] !== i;
              kids.push(s('text', { x: 4, y: y + bh / 2 + 9, 'font-size': slim ? 13 : 14, 'font-weight': 700 }, slim ? `U${i + 1}→r${r}` : `U${i + 1} → r${r}`));
              if (st > 0) {
                kids.push(s('rect', { x: x0, y: y + 4, width: st * scale, height: bh, rx: 6, class: 's-warn', opacity: 0.35 }));
                if (st * scale > 64) kids.push(s('text', { x: x0 + st * scale / 2, y: y + bh / 2 + 9, 'text-anchor': 'middle', 'font-size': 13 }, 'waits'));
              }
              kids.push(s('rect', { x: x0 + st * scale + 1, y: y + 4, width: T * scale - 2, height: bh, rx: 6, class: isLost ? 's-bad' : 's-proc', 'stroke-width': 1.5 }),
                s('text', { x: x0 + (st + T / 2) * scale, y: y + bh / 2 + 9, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 }, isLost ? 'lost' : 'r' + r));
            });
            const xd = x0 + M.done * scale;
            kids.push(s('line', { x1: xd, y1: y0 - 6, x2: xd, y2: y0 + n * rh + 2, 'stroke-width': 3, style: 'stroke:var(--chc)' }));
            svg.replaceChildren(...kids);
            tbody.replaceChildren(...MODES.map(([k, label]) => {
              const m = P[k];
              return h('tr', { class: k === mode ? 'on' : '' }, h('td', { class: 'b' }, label), h('td', { class: 'mono' }, m.done + ' ms'),
                h('td', { class: 'mono' }, ctx.util.fmt(n * 1000 / m.done, 1)), h('td', { class: 'mono', style: { color: m.lost ? 'var(--bad)' : '' } }, String(m.lost)), h('td', { class: 'mono' }, String(m.locks)));
            }));
            const shared = Object.entries(P.cnt).filter(([, c]) => c > 1).map(([r, c]) => `r${r} (${c} users)`);
            let t = '';
            if (mode === 'none') t = P.none.lost
              ? `<b>No locks:</b> all ${n} updates overlap and finish at ${T} ms, fast but wrong. Records wanted by more than one user: ${shared.join(', ')}. In each group only the last write survives, so <b>${P.none.lost} update${P.none.lost > 1 ? 's are' : ' is'} lost</b>.`
              : `<b>No locks:</b> by luck no two users picked the same record, so nothing was lost this time. Nothing guarantees that next time.`;
            else if (mode === 'file') t = `<b>Whole-file lock:</b> one update at a time, even for different records: ${n} × ${T} ms = <b>${P.file.done} ms</b>. The OS keeps just one lock for the file.`;
            else t = `<b>Record locks:</b> only users who want the same record line up. The longest line has ${P.top} user${P.top > 1 ? 's' : ''}, so everything is done at ${P.top} × ${T} ms = <b>${P.record.done} ms</b>. The OS tracks ${P.record.locks} lock${P.record.locks > 1 ? 's' : ''} at once.` + (R === 1 ? ' With a one-record file this is exactly whole-file locking.' : '');
            narr.innerHTML = t;
            narr.className = 'narr ' + (mode === 'none' && P.none.lost ? 'bad' : mode === 'record' ? 'ok' : '');
          }
          const sN = ctx.ui.slider({ label: 'Users', min: 2, max: 8, value: n, onInput: (v) => { n = v; draw(); } });
          const sR = ctx.ui.slider({ label: 'Records in file', min: 1, max: 12, value: R, onInput: (v) => { R = v; draw(); } });
          const seg = ctx.ui.seg(MODES.map(([value, label]) => ({ value, label })), mode, (v) => { mode = v; draw(); });
          el.append(h('div', { class: 'split r fill' },
            h('div', { class: 'stack', style: { gap: '9px' } },
              h('p', { class: 'm0', html: `Each user updates one record, chosen at random, and holds its lock for ${T} ms (read, change, write). Compare <span class="t">whole-file locking</span> with <span class="t">record locking</span>: the difference is the <span class="t">lock granularity</span>.` }),
              h('div', { class: 'grid-2', style: { gap: '8px 18px' } }, sN, sR),
              h('div', { class: 'row gap-s' }, seg, h('button', { class: 'btn sm', type: 'button', onclick: () => { seed++; draw(); } }, 'New random requests')),
              h('div', { class: 'card white grow', style: { display: 'grid', placeItems: 'center', padding: '6px 10px' } }, svg),
              h('div', { class: 'row gap-s xs muted' }, h('span', { class: 'chip proc' }, 'holds the lock'), h('span', { class: 'chip warn' }, 'waits'), h('span', { class: 'chip bad' }, 'overwritten'), h('span', {}, 'Time axis in ms; the thick line marks “all done”.'))),
            h('div', { class: 'stack', style: { gap: '9px' } },
              tbl, narr,
              h('div', { class: 'callout warn small m0', 'data-label': 'Finer is not free', html: 'Every lock and unlock is extra work for the OS, a busy file can hold hundreds of record locks, and an update that locks two records can deadlock (next step).' }),
              h('div', { class: 'callout tip small m0', 'data-label': 'Real systems', html: 'UNIX and Linux lock byte ranges with <code>fcntl</code> (POSIX record locks), normally <span class="t" data-t="advisory lock">advisory</span>: only processes that ask for the lock are held back (Linux dropped its optional enforced mode in 5.15). Windows <code>LockFileEx</code> locks are mandatory: conflicting ordinary reads and writes are refused, though access through a memory-mapped view is not checked.' }))));
          draw();
        },
      },
      {
        title: 'Old problems return: readers, writers and deadlock',
        kind: 'explore',
        render(el, ctx) {
          const { h, s } = ctx;
          // ---- tab 1: shared and exclusive locks on one record ----
          function rwTab(panel) {
            const USERS = [['Cara', 'S'], ['Dev', 'S'], ['Ben', 'X'], ['Eve', 'S']];
            let policy = 'fifo', L = { holders: [], queue: [] }, last = null;
            const stateOf = (u) => (L.holders.some((x) => x.who === u) ? 'holds' : L.queue.some((x) => x.who === u) ? 'waits' : 'idle');
            const narr = h('div', { class: 'narr' });
            const holdEl = h('div', { class: 'row gap-s' }), queueEl = h('div', { class: 'row gap-s' });
            const mxBody = h('tbody');
            const rowsEl = h('div', { class: 'stack', style: { gap: '6px' } });
            const heldKind = () => (L.holders.length === 0 ? 'none' : L.holders[0].mode);
            function act(u, mode) {
              const st = stateOf(u);
              if (st === 'idle') {
                const before = heldKind(), qBefore = L.queue.length;
                const got = rwRequest(L, u, mode, policy);
                last = { held: before, asked: mode };
                const what = mode === 'S' ? 'a shared lock to read' : 'an exclusive lock to write';
                if (got) narr.innerHTML = `${u} asks for ${what} and <b>gets it</b>.` + (mode === 'S' && before === 'S' ? ' Readers do not disturb each other, so they share.' : '') + (mode === 'S' && qBefore && policy === 'readers' ? ' It jumped ahead of a waiting writer: readers come first under this policy.' : '');
                else narr.innerHTML = `${u} asks for ${what} and <b>must wait</b>: ` + (rwFits({ holders: L.holders, queue: [] }, mode) ? 'it could share with the current holders, but someone is already queued ahead of it, and this policy serves requests in arrival order.' : (mode === 'X' ? 'a writer needs the record to itself.' : 'a writer holds the record.'));
                narr.className = 'narr ' + (got ? 'ok' : 'warn');
              } else if (st === 'holds') {
                const g = rwRelease(L, u, policy);
                last = null;
                narr.innerHTML = `${u} finishes and releases the lock.` + (g.length ? ' The OS now grants it to ' + g.map((x) => `${x.who} (${x.mode === 'S' ? 'read' : 'write'})`).join(' and ') + '.' : '');
                narr.className = 'narr';
              }
              draw();
            }
            function draw() {
              rowsEl.replaceChildren(...USERS.map(([u, mode]) => {
                const st = stateOf(u);
                const chip = st === 'holds' ? `<span class="chip ok">holds ${mode}</span>` : st === 'waits' ? '<span class="chip warn">waiting</span>' : '<span class="chip">idle</span>';
                const label = st === 'holds' ? 'Finish' : st === 'waits' ? 'Waiting…' : (mode === 'S' ? 'Ask to read' : 'Ask to write');
                return h('div', { class: 'rw-row', style: ctx.narrow ? { gridTemplateColumns: 'minmax(0, 1fr) 76px 116px', gap: '6px' } : {} },
                  h('div', {}, h('div', { class: 'nm' }, u), h('div', { class: 'sub' }, mode === 'S' ? 'reader: wants a shared lock' : 'writer: wants an exclusive lock')),
                  h('div', { html: chip }),
                  h('button', { class: 'btn sm' + (st === 'idle' ? ' primary' : ''), type: 'button', disabled: st === 'waits', onclick: () => act(u, mode) }, label));
              }));
              holdEl.innerHTML = L.holders.length ? L.holders.map((x) => `<span class="chip ok">${x.mode} · ${x.who}</span>`).join('') : '<span class="small muted">nobody</span>';
              queueEl.innerHTML = L.queue.length ? L.queue.map((x, i) => `<span class="chip warn">${i + 1}. ${x.mode} · ${x.who}</span>`).join('') : '<span class="small muted">empty</span>';
              const cell = (held, asked, ok) => h('td', { class: last && last.held === held && last.asked === asked ? 'hit' : '', html: ok ? '<span class="yes">✓ share</span>' : '<span class="no">✗ wait</span>' });
              mxBody.replaceChildren(
                h('tr', {}, h('td', {}, 'nothing held'), cell('none', 'S', true), cell('none', 'X', true)),
                h('tr', {}, h('td', {}, 'shared (S) held'), cell('S', 'S', true), cell('S', 'X', false)),
                h('tr', {}, h('td', {}, 'exclusive (X) held'), cell('X', 'S', false), cell('X', 'X', false)));
            }
            const reset = () => { L = { holders: [], queue: [] }; last = null; narr.className = 'narr'; narr.innerHTML = 'Try: Cara reads, Ben asks to write, then Dev asks to read. Do it under both policies.'; draw(); };
            const pol = ctx.ui.seg([{ value: 'fifo', label: 'First come, first served' }, { value: 'readers', label: 'Readers first' }], policy, (v) => { policy = v; reset(); });
            panel.append(h('div', { class: 'split fill' },
              h('div', { class: 'stack', style: { gap: '8px' } },
                h('p', { class: 'm0 small', html: 'Readers can safely share a record; a writer cannot. So locks come in two kinds: a <span class="t">shared lock (read lock)</span> and an <span class="t">exclusive lock (write lock)</span>.' }),
                rowsEl,
                h('div', { class: 'row gap-s' }, pol, h('button', { class: 'btn sm', type: 'button', onclick: reset }, 'Reset')),
                narr),
              h('div', { class: 'stack', style: { gap: '8px' } },
                h('div', { class: 'card tight stack', style: { gap: '6px' } },
                  h('div', { class: 'row gap-s' }, h('b', { style: { width: '78px' } }, 'Holding:'), holdEl),
                  h('div', { class: 'row gap-s' }, h('b', { style: { width: '78px' } }, 'Queue:'), queueEl)),
                h('table', { class: 'tbl mx ns' }, h('thead', {}, h('tr', {}, h('th', {}, 'Already held'), h('th', {}, 'Asks S (read)'), h('th', {}, 'Asks X (write)'))), mxBody),
                h('div', { class: 'callout why small m0', 'data-label': 'Seen before', html: 'This is the <span class="t">readers/writers problem</span> of chapter 5 in file form. Under “readers first”, a steady stream of readers can keep a writer waiting forever (starvation); first come, first served prevents that.' }),
                h('div', { class: 'callout tip small m0', 'data-label': 'Real systems', html: 'Both kinds exist in practice. On UNIX, <code>flock</code> takes LOCK_SH or LOCK_EX and <code>fcntl</code> takes F_RDLCK or F_WRLCK; Windows <code>LockFileEx</code> gives a shared lock unless asked for an exclusive one.' }))));
            reset();
          }
          // ---- tab 2: two transfers, two records, one deadlock ----
          function dlTab(panel) {
            let ordered = false, frames = transferFrames(false);
            const svg = s('svg', { viewBox: '0 0 460 300', width: '100%', role: 'img', 'aria-label': 'Who holds and who waits for each record' });
            const P = { T1: [80, 150], T2: [380, 150] }, RB = { 3: 55, 8: 245 };
            const pair = (r, t) => (t === 'T1' ? [175, r === 3 ? 75 : 225, 112, r === 3 ? 124 : 176] : [285, r === 3 ? 75 : 225, 348, r === 3 ? 124 : 176]);
            function draw(f) {
              const kids = [];
              [3, 8].forEach((r) => {
                if (f.held[r]) { const [a, b, c, d] = pair(r, f.held[r]); kids.push(s('line', { x1: a, y1: b, x2: c, y2: d, 'stroke-width': 3, style: 'stroke:var(--os)', 'marker-end': 'url(#arr-os)' })); }
              });
              ['T1', 'T2'].forEach((t, i) => {
                const r = f.wait[i];
                if (r) { const [a, b, c, d] = pair(r, t); kids.push(s('line', { x1: c, y1: d, x2: a, y2: b, 'stroke-width': 3, 'stroke-dasharray': '7 5', style: 'stroke:var(--bad)', 'marker-end': 'url(#arr-bad)' })); }
              });
              [3, 8].forEach((r) => kids.push(
                s('rect', { x: 170, y: RB[r] - 28, width: 120, height: 56, rx: 10, class: 's-io', 'stroke-width': 2 }),
                s('text', { x: 230, y: RB[r] - 4, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 16 }, 'record r' + r),
                s('text', { x: 230, y: RB[r] + 16, 'text-anchor': 'middle', 'font-size': 14, class: 's-sub' }, 'value ' + f.val[r])));
              ['T1', 'T2'].forEach((t, i) => {
                const [x, y] = P[t], st = f.st[i];
                kids.push(s('circle', { cx: x, cy: y, r: 42, class: st === 'blocked' ? 's-warn' : st === 'done' ? 's-ok' : 's-proc', 'stroke-width': 2 }),
                  s('text', { x, y: y - 2, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 18 }, t),
                  s('text', { x, y: y + 18, 'text-anchor': 'middle', 'font-size': 13 }, st),
                  s('text', { x, y: y + 66, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, t === 'T1' ? 'Ana: r3 → r8' : 'Ben: r8 → r3'));
              });
              if (f.cls === 'bad') kids.push(s('text', { x: 230, y: 155, 'text-anchor': 'middle', 'font-weight': 900, 'font-size': 17, style: 'fill:var(--bad)' }, 'cycle: deadlock'));
              kids.push(s('text', { x: 8, y: 292, 'font-size': 13, class: 's-sub' }, 'solid arrow: record held by · dashed: waits for'));
              svg.replaceChildren(...kids);
            }
            const player = ctx.ui.player({ count: frames.length, interval: 1800, speed: false, render: (i) => { const f = frames[i]; draw(f); return (f.cls === 'bad' ? '<span class="chip bad">deadlock</span> ' : f.cls === 'ok' ? '<span class="chip ok">done</span> ' : '') + f.cap; } });
            const seg = ctx.ui.seg([{ value: 'free', label: 'Lock in the order needed' }, { value: 'ordered', label: 'Lowest record number first' }], 'free', (v) => { ordered = v === 'ordered'; frames = transferFrames(ordered); player.stop(); player.setCount(frames.length); player.go(0); });
            panel.append(h('div', { class: 'split l fill' },
              h('div', { class: 'stack', style: { gap: '9px' } },
                h('p', { class: 'm0 small', html: 'A transfer between two records must lock <b>both</b> before changing either. Two transfers in opposite directions can each grab one record and wait for the other: the <span class="t">hold and wait</span> and <span class="t">circular wait</span> of chapter 6.' }),
                seg, player.el,
                h('div', { class: 'callout tip small m0', 'data-label': 'The cure from chapter 6', html: '<span class="t">Resource ordering</span>: number the records and always lock in increasing order. A process can then never hold a higher record while waiting for a lower one, so no cycle can form.' })),
              h('div', { class: 'card white', style: { display: 'grid', placeItems: 'center', padding: '6px' } }, svg)));
            return () => player.stop();
          }
          el.append(ctx.ui.tabs([
            { label: 'Readers share, writers wait', render: (p) => rwTab(p) },
            { label: 'Two records, one deadlock', render: (p) => dlTab(p) },
          ]));
        },
      },
      {
        title: 'Recap: six things to remember',
        kind: 'recap',
        render(el, ctx) {
          el.append(ctx.h('div', { class: 'stack fill' },
            ctx.h('p', { class: 'lead m0' }, 'Say each answer out loud before you flip the card.'),
            ctx.ui.flipcards([
              ['The two issues file sharing raises', '<b>Access rights</b>: who may do what to the file. <b>Simultaneous access</b>: what happens when several users update it at the same time.'],
              ['The rights ladder, bottom to top', 'None → knowledge → execution → reading → appending → updating → changing protection → deletion. Each right includes every right below it.'],
              ['Execution versus reading', 'Execution: run the program, but not copy it. Reading: any use, including copying and running. So execution sits lower.'],
              ['Who receives rights, and from whom?', 'The <b>owner</b> (at first the creator) holds every right and grants rights to a specific user (by user ID), a user group, or all users (a public file).'],
              ['Why two updates need a lock', 'Read, change, write by two processes on the same record can lose one update. A lock lets one update finish before the next touches that data.'],
              ['Whole-file lock or record lock?', 'Whole file: one lock, but every update waits its turn. Record: different records update in parallel, at the cost of more locks and the risk of deadlock.'],
            ], { cols: 3, height: 228 })));
        },
      },
      {
        title: 'Check yourself',
        kind: 'check',
        quiz: [
          { type: 'order', q: 'Put the classic file access rights in order, from the weakest to the strongest.',
            items: ['None', 'Knowledge', 'Execution', 'Reading', 'Appending', 'Updating', 'Changing protection', 'Deletion'],
            why: 'Each right includes every right before it: knowing a file exists, running it, reading it, adding to it, changing it, changing who may use it, and finally deleting it.' },
          { q: 'A user can see that a file named payroll.db exists and who owns it, but every attempt to open it is refused. Which right does the user hold?',
            choices: ['None', 'Execution', 'Knowledge', 'Reading'], answer: 2,
            feedback: ['With no rights the user could not even learn that the file exists: it would not show up in any directory listing the user can read.', 'Execution would also let the user run the file as a program, which is more than seeing that it exists.', null, 'Reading would let the user open and copy the file, and opening is refused here.'],
            why: 'The knowledge right lets a user learn that a file exists and who owns it, so the user can ask the owner for more rights. Nothing more.' },
          { q: 'A company wants staff to run a licensed design program without being able to copy it. Which is the highest right it should grant them on the program file?',
            choices: ['Reading', 'Execution', 'Appending', 'Knowledge'], answer: 1,
            feedback: ['Reading allows any use of the file, including copying it, which the licence forbids.', null, 'Appending sits above reading, so it includes reading, and therefore copying, as well.', 'Knowledge only shows that the program exists; staff could not run it at all.'],
            why: 'Execution means “load and run, but do not copy”. That is why it sits below reading, which allows copying.' },
          { type: 'tf', q: 'In the classic scheme, the right to change which rights other users hold on a file (changing protection) is normally held only by the file’s owner.', answer: true,
            why: 'Changing protection sits above updating, so editing a file does not let you hand out rights. Normally only the owner holds it; an owner who passes it on can usually limit which rights may be changed.' },
          { type: 'match', q: 'Match each kind of entry in a file’s classic grant list to the people it covers.',
            pairs: [['Specific user', 'One person, identified by user ID'], ['User group', 'A named set of users who get the same rights'], ['All users', 'Everyone on the system: the file is public'], ['Owner', 'At first the creator; holds every right']],
            why: 'An owner can grant rights to one named user, to a group (a set of users defined once), or to all users, which makes the file public. The owner always holds every right.' },
          { q: 'A system uses only the most specific class that matches a user (owner, then named user, then group, then all users). The owner grants Ben the right None by name and grants all users Reading. What may Ben do with the file?',
            choices: ['Nothing; the named entry hides the file', 'Read it, since the public grant is higher', 'See that it exists, but never open it', 'Read it, but only through a group grant'], answer: 0,
            feedback: [null, 'That is the rule of combining every matching class. Here only the most specific match, the named entry, is consulted.', 'Seeing that the file exists needs the knowledge right, and Ben’s named entry is None.', 'The question names no group for Ben; and with a named entry present, a group grant would not be consulted anyway.'],
            why: 'Under the most-specific rule the named entry decides, so Ben gets None even though everyone else may read. UNIX checks owner, group, others in this way, and POSIX access-control lists add named-user entries right after the owner, which lets an owner shut out one person.' },
          { q: 'Two processes update record 7, which holds 1000. P subtracts 300 and Q subtracts 200. There is no locking: both read 1000 before either writes, then P writes, then Q writes. What does record 7 hold at the end?',
            choices: ['500', '700', '1000', '800'], answer: 3,
            feedback: ['500 is the correct total, but each process computed from its own stale copy of 1000, so neither saw the other’s change.', '700 is P’s value, but Q writes after P and replaces it.', 'Both writes did happen; the last one stays in the record.', null],
            why: 'Q computed 1000 − 200 = 800 from a stale copy and overwrote P’s 700. P’s update is lost: the classic lost update that a lock prevents.' },
          { type: 'num', q: 'Five processes each update a <b>different</b> record of the same file. They all arrive at the same moment, and each update holds its lock for 40 ms. With whole-file locking, how many milliseconds pass until all five are finished?',
            answer: 200, tol: 0, unit: 'ms',
            why: 'A whole-file lock lets only one update in at a time, even for different records: 5 × 40 ms = 200 ms.' },
          { type: 'num', q: 'Six updates arrive at the same moment and want records 2, 5, 2, 9, 5 and 2 of one file. Each holds its lock for 30 ms. With record locking, after how many milliseconds are all six finished?',
            answer: 90, tol: 0, unit: 'ms',
            why: 'Only updates to the same record wait for each other. Record 2 is wanted three times, so its updates queue: 3 × 30 ms = 90 ms. Records 5 and 9 finish sooner, in parallel.' },
          { type: 'num', q: 'Six updates want records 2, 5, 2, 9, 5 and 2 of one file, and there is no locking at all: every update reads its record before any of them writes. How many of the six updates are lost?',
            answer: 3, tol: 0,
            why: 'For each record, only the last write survives. Record 2 had three updates (2 lost), record 5 had two (1 lost), record 9 had one (0 lost): 2 + 1 + 0 = 3.' },
          { type: 'bucket', q: 'Which locking method does each statement describe?', buckets: ['Whole-file locking', 'Record locking'],
            items: [['Only one lock to keep track of for the file', 0], ['Updates to different records can proceed at the same time', 1], ['Two processes that update different records still wait for each other', 0], ['A transfer that locks two records one after the other can deadlock', 1]],
            why: 'A whole-file lock is simple but serializes every update. Record locks allow parallel work on different records, but need many locks, and an update that takes several of them can end up in a circular wait.' },
          { type: 'multi', q: 'Which statements about processes that lock shared files are true?',
            choices: ['Many readers may share a record, but a writer needs it alone (readers/writers)', 'Two processes can each hold a lock the other needs (deadlock)', 'A writer can wait forever if new readers keep jumping ahead (starvation)', 'A process waiting for a file lock must keep polling it in a loop'],
            answer: [0, 1, 2],
            why: 'Locking brings back the readers/writers problem, deadlock and starvation from earlier chapters. A waiting process does not poll: the OS blocks it and wakes it when the lock is released.' },
        ],
      },
    ],
    notes: `
      <h3>File sharing: two issues</h3>
      <p>When several users share a file, the file system must deal with two issues:</p>
      <ol>
        <li><b>Access rights</b>: who may do what to the file.</li>
        <li><b>Management of simultaneous access</b>: what happens when several users use, and especially update, the file at the same time.</li>
      </ol>

      <h3>Access rights: the classic hierarchy</h3>
      <p>The classic scheme lists eight levels. Each right <b>includes every right before it</b>, so granting one level grants all the levels below it.</p>
      <table>
        <tr><th>#</th><th>Right</th><th>What it adds</th></tr>
        <tr><td>0</td><td>None</td><td>The user may not even learn that the file exists. To enforce this, the user is not allowed to read the directory that lists the file.</td></tr>
        <tr><td>1</td><td>Knowledge</td><td>The user can learn that the file exists and who owns it, and can then ask the owner for more rights. The file cannot be opened.</td></tr>
        <tr><td>2</td><td>Execution</td><td>The user can load and run the file as a program but cannot copy it. Licensed (proprietary) programs are often shared this way.</td></tr>
        <tr><td>3</td><td>Reading</td><td>The user can read the file for any purpose, including copying it and running it.</td></tr>
        <tr><td>4</td><td>Appending</td><td>The user can add data, usually only at the end, but cannot modify or delete existing contents. Example: a sign-up sheet or a log.</td></tr>
        <tr><td>5</td><td>Updating</td><td>The user can modify, delete and add data anywhere, including the first writing of the file and rewriting it completely.</td></tr>
        <tr><td>6</td><td>Changing protection</td><td>The user can change the access rights other users hold. Normally only the owner has this right; an owner who extends it to others can usually limit which rights may be changed.</td></tr>
        <tr><td>7</td><td>Deletion</td><td>The user can delete the file from the file system.</td></tr>
      </table>
      <p><b>Why this order?</b> Each level allows strictly more. Execution is below reading because a run-only program cannot be copied, while reading allows copying and running. Appending is below updating because adding at the end cannot damage existing data.</p>
      <p><b>Real systems</b> often use independent switches instead of one ladder. Classic UNIX keeps read, write and execute bits for owner, group and others (write without read is possible, and deleting a file depends on write permission on its <i>directory</i>). Windows can grant append data, delete and change permissions separately.</p>

      <h3>The owner and classes of users</h3>
      <p>One user is the <b>owner</b> of each file, at first the user who created it. The owner holds every right and may grant rights to others. Rights can be granted to three classes of users:</p>
      <ul>
        <li><b>Specific user</b>: one individual, identified by user ID.</li>
        <li><b>User group</b>: a named set of users who all receive the same rights, without being listed one by one.</li>
        <li><b>All</b>: every user of the system. A file granted to all users is a <b>public file</b>.</li>
      </ul>
      <p>When a user belongs to several classes the system needs a rule. <b>Combining</b> takes the highest right any matching class grants, so a grant can only add rights. The <b>most-specific</b> rule checks owner, then named user, then group, then all users, and uses only the first class that matches. Classic UNIX permission bits work this way with three classes (owner, group, others); POSIX access-control lists add named-user entries, checked right after the owner. That lets an owner shut out one person (named entry None) while everyone else may read. Windows access-control lists lean towards combining: the allow entries for the user and every group the user is in add up, but an explicit deny entry wins.</p>
      <p>Example: Ben has Updating by name, group lab has Reading, all users have Knowledge. Combining gives Ben Updating: Ben may edit a row but not change rights. Eve, in no group, only has Knowledge.</p>

      <h3>Simultaneous access and the lost update</h3>
      <p>Reading together is harmless; updating is not. An update is three actions: <b>read</b> the record into private memory, <b>change</b> the private copy, <b>write</b> it back. If a second update reads the record in the gap before the first writes, one of the two changes is overwritten: a <b>lost update</b>.</p>
      <p>Worked example: record 7 holds 1000. Ana subtracts 300 and Ben subtracts 200. Both read 1000; Ana writes 700; Ben writes 800. The file says 800, but the true value is 1000 − 300 − 200 = 500. Ana's update is lost.</p>
      <p>The OS or file system must therefore impose a discipline, usually a <b>lock</b>: a process takes the lock before reading and releases it after writing, so read, change, write becomes one unit that no other process using the lock can break into. A process that finds the lock taken is <b>blocked</b> by the OS (it does not poll) and woken when the lock is released.</p>

      <h3>Whole-file locking versus record locking</h3>
      <ul>
        <li><b>Whole-file locking</b>: lock the entire file for the length of an update. Simple (one lock), but every update waits its turn, even for different records.</li>
        <li><b>Record locking</b>: lock only the record (or byte range) being updated. Updates to different records proceed in parallel; only updates to the same record wait. The cost: more locks and bookkeeping, and an update that locks several records can deadlock.</li>
      </ul>
      <p>The size of the unit one lock protects is the <b>lock granularity</b>. For n updates that all arrive together, each holding its lock for t ms:</p>
      <ul>
        <li>No locks: all done after t, but for every record wanted by k updates, k − 1 of them are lost.</li>
        <li>Whole-file lock: all done after n × t.</li>
        <li>Record locks: all done after t × (largest number of updates wanting one record).</li>
      </ul>
      <p>Example: six updates want records 6, 1, 5, 8, 8, 3 with t = 30 ms. No locks: 30 ms, 1 update lost (record 8). Whole file: 6 × 30 = 180 ms (33.3 updates per second). Record locks: record 8 is wanted twice, so 2 × 30 = 60 ms (100 updates per second), with 5 record locks held at once.</p>
      <p><b>Real systems.</b> UNIX and Linux lock byte ranges with <code>fcntl</code> (POSIX calls them record locks); these are normally <b>advisory</b>: they hold back only processes that also ask for the lock. Linux removed its optional mandatory mode in version 5.15. Windows byte-range locks (<code>LockFileEx</code>) are mandatory for ordinary file reads and writes: the OS refuses a conflicting ReadFile or WriteFile. Reads and writes through a memory-mapped view of the file are not checked against these locks, so mapped access needs its own coordination.</p>

      <h3>Old problems return: readers/writers and deadlock</h3>
      <p>Locks come in two kinds. Many readers can hold a <b>shared (read) lock</b> together; a writer needs an <b>exclusive (write) lock</b>, which no one else may hold at the same time.</p>
      <table>
        <tr><th>Already held</th><th>Asks shared</th><th>Asks exclusive</th></tr>
        <tr><td>nothing</td><td>granted</td><td>granted</td></tr>
        <tr><td>shared</td><td>granted (share)</td><td>waits</td></tr>
        <tr><td>exclusive</td><td>waits</td><td>waits</td></tr>
      </table>
      <p>This is the readers/writers problem again. If readers may jump ahead of a waiting writer ("readers first"), a steady stream of readers can starve the writer; serving requests first come, first served prevents that. UNIX <code>flock</code> and <code>fcntl</code> and Windows <code>LockFileEx</code> all offer both kinds.</p>
      <p><b>Deadlock.</b> A transfer from record 3 to record 8 locks r3 then r8; a transfer the other way locks r8 then r3. If each grabs its first record, each then waits for the record the other holds: hold and wait plus circular wait, so neither can ever continue. The chapter 6 cure is <b>resource ordering</b>: number the records and always lock them in increasing order. Then no process can hold a higher record while waiting for a lower one, and no cycle can form.</p>
`,
  });
})();
