/* =====================================================================
   12.4 File Directories
   Original teaching material. Small helpers shared by several steps live
   inside this IIFE (no globals).
   ===================================================================== */
(function () {
  /* ---- the example file tree used by the pathname steps ---- */
  const T = (name, kids) => ({ name, kids: kids || null });
  function makeTree() {
    const root = T('/', [
      T('ana', [T('notes.txt'), T('music', [T('song.mp3')]), T('school', [T('os', [T('hw1.txt'), T('lab2.c'), T('notes.txt')]), T('math', [T('notes.txt')])])]),
      T('ben', [T('notes.txt'), T('games', [T('chess.exe')])]),
      T('chen', [T('todo.txt')]),
    ]);
    const all = [];
    (function walk(n, p, d) {
      n.parent = p; n.depth = d; n.isDir = !!n.kids; n.id = all.length;
      n.abs = !p ? '/' : (p.parent ? p.abs + '/' : '/') + n.name;
      all.push(n);
      (n.kids || []).forEach((k) => walk(k, n, d + 1));
    })(root, null, 0);
    return { root, all, find: (abs) => all.find((n) => n.abs === abs) };
  }

  /* The Windows spelling of an absolute path in the example tree (drive C:). */
  const winPath = (n) => 'C:\\' + n.abs.slice(1).split('/').join('\\');

  /* Accept UNIX or Windows spelling; returns the UNIX form, whether Windows syntax was used and the drive letter. */
  function parseInput(raw) {
    let p = String(raw == null ? '' : raw).trim(), win = false, drive = null;
    if (/^[A-Za-z]:([\\/]|$)/.test(p)) { drive = p[0].toUpperCase(); p = '/' + p.slice(3); win = true; }
    if (p.includes('\\')) { p = p.replace(/\\/g, '/'); win = true; }
    return { path: p, win, drive };
  }

  /* Resolve a UNIX-style path one component at a time, exactly as a file system would.
     Each component is one directory search ('.' and '..' are real entries in UNIX-like directories).
     ci compares names without regard to case, as Windows does. */
  function resolve(tree, path, cwd, ci) {
    const absolute = path.startsWith('/');
    const start = absolute ? tree.root : cwd;
    const steps = [];
    let cur = start;
    for (const c of path.split('/').filter(Boolean)) {
      if (!cur.isDir) return { absolute, start, steps, end: null, err: { kind: 'file', at: cur, comp: c } };
      if (c === '.') { steps.push({ from: cur, comp: c, to: cur, kind: 'stay' }); continue; }
      if (c === '..') { const to = cur.parent || cur; steps.push({ from: cur, comp: c, to, kind: 'up' }); cur = to; continue; }
      const hit = cur.kids.find((k) => (ci ? k.name.toLowerCase() === c.toLowerCase() : k.name === c));
      if (!hit) return { absolute, start, steps, end: null, err: { kind: 'missing', at: cur, comp: c } };
      steps.push({ from: cur, comp: c, to: hit, kind: 'down' });
      cur = hit;
    }
    /* A trailing / asks for a directory, so 'hw1.txt/' fails with "Not a directory", as in POSIX. */
    if (path.endsWith('/') && !cur.isDir) return { absolute, start, steps, end: null, err: { kind: 'file', at: cur, comp: '' } };
    return { absolute, start, steps, end: cur, err: null };
  }
  /* Directory searches a resolution performed (a failed search still counts). */
  const lookups = (r) => r.steps.length + (r.err && r.err.kind === 'missing' ? 1 : 0);

  /* Shortest relative path from directory `from` to node `to`. */
  function rel(from, to) {
    const anc = new Set();
    for (let n = to; n; n = n.parent) anc.add(n);
    let c = from, ups = 0;
    while (!anc.has(c)) { c = c.parent; ups++; }
    const down = [];
    for (let n = to; n !== c; n = n.parent) down.unshift(n.name);
    const parts = Array(ups).fill('..').concat(down);
    return parts.length ? parts.join('/') : '.';
  }

  /* One round of the working-directory game: the shortest relative path plus three wrong ones built from
     typical slips (one .. too few or too many, forgetting to climb, an absolute path without its /, the
     wrong file with the same name). Every distractor is checked with resolve() so none of them reaches
     the target. rnd is a seeded generator so a round is repeatable. */
  function makeRound(tree, cwd, target, rnd, shuffle) {
    const right = rel(cwd, target);
    const parts = right.split('/'), ups = parts.filter((p) => p === '..').length, down = parts.slice(ups).filter((p) => p !== '.');
    const join = (k, d) => Array(Math.max(0, k)).fill('..').concat(d).join('/') || '.';
    const slips = [];
    if (ups > 0) slips.push(join(ups - 1, down), down.join('/'));
    slips.push(join(ups + 1, down), target.abs.slice(1));
    tree.all.filter((n) => n !== target && n.parent && n.name === target.name).forEach((tw) => slips.push(rel(cwd, tw)));
    if (down.length > 1) slips.push(join(ups, down.slice(1)));
    const ok = (p) => p && p !== right && resolve(tree, p, cwd).end !== target;
    const seen = new Set([right]), wrong = [];
    for (const p of shuffle(slips.filter(ok), rnd)) if (!seen.has(p) && wrong.length < 3) { seen.add(p); wrong.push(p); }
    for (const n of shuffle(tree.all.filter((n) => n.parent && n !== cwd), rnd)) { if (wrong.length >= 3) break; const p = rel(cwd, n); if (ok(p) && !seen.has(p)) { seen.add(p); wrong.push(p); } }
    const choices = shuffle([right, ...wrong], rnd);
    return { right, choices, answer: choices.indexOf(right) };
  }

  /* An indented, clickable view of the example tree. paint(st) redraws marks from the current state:
     st = { cwd, target, trail:Set, cur, hit, err, dim } (all optional). */
  function treeView(ctx, tree, o = {}) {
    const { h } = ctx;
    const rows = tree.all.map((n) => {
      const label = !n.parent ? '/ (root)' : n.name + (n.isDir ? '/' : '');
      const nm = o.onPick
        ? h('button', { class: 'nm', type: 'button', onclick: () => o.onPick(n), 'aria-label': (n.isDir ? 'directory ' : 'file ') + n.abs }, label)
        : h('span', { class: 'nm' }, label);
      const tags = h('span', { class: 'tags' });
      const cd = o.onCd && n.isDir ? h('button', { class: 'cdb', type: 'button', onclick: () => o.onCd(n), title: 'Make ' + n.abs + ' the working directory', 'aria-label': 'cd ' + n.abs }, 'cd') : null;
      const row = h('div', { class: 'trow' + (n.isDir ? ' dir' : ''), style: { paddingLeft: (6 + n.depth * 20) + 'px' } }, nm, tags, cd);
      return { n, row, tags };
    });
    const el = h('div', { class: 'tree' }, ...rows.map((r) => r.row));
    function paint(st = {}) {
      rows.forEach(({ n, row, tags }) => {
        row.classList.toggle('trail', !!(st.trail && st.trail.has(n)));
        row.classList.toggle('cur', st.cur === n);
        row.classList.toggle('hit', st.hit === n);
        row.classList.toggle('err', st.err === n);
        row.classList.toggle('dim', !!(st.dim && st.dim.has(n)));
        tags.replaceChildren();
        if (st.cwd === n) tags.append(h('span', { class: 'chip proc' }, 'cwd'));
        if (st.target === n) tags.append(h('span', { class: 'chip accent' }, 'target'));
      });
    }
    return { el, paint };
  }

  Guide.section({
    id: '12.4',
    title: 'File Directories',
    short: 'File directories',
    summary: 'A directory maps names to files: what an entry holds, five operations, three structures and pathnames.',
    objectives: [
      'List the four groups of information a directory can keep about a file, and explain why many systems move most of it into a file header such as a UNIX inode.',
      'Describe the five directory operations: search, create file, delete file, list directory and update directory.',
      'Compare single-level, two-level and tree-structured directories, including how each handles name clashes.',
      'Write absolute and relative pathnames, and resolve a path one directory lookup at a time, including . and ..',
    ],
    terms: [
      ['Directory entry', 'One record in a directory that describes one file or subdirectory. It always holds the name, plus either the file\'s attributes and location or a pointer to a separate record that holds them.'],
      ['File attributes (metadata)', 'Facts about a file that the file system keeps outside the file\'s contents: its type, size, owner, permissions, dates and where its data are stored.'],
      ['File header', 'A record kept apart from the directory that holds one file\'s attributes and the address of its data. When a system uses headers, a directory entry holds only a name and a pointer to the header.'],
      ['Inode (index node)', 'The file header of UNIX-like file systems: a numbered record that holds everything about one file except its name, such as type, permissions, owner, size, timestamps and the addresses of its data blocks. A directory entry pairs a name with an inode number.'],
      ['Single-level directory', 'A directory structure with one flat list of every file in the system, shared by all users.'],
      ['Two-level directory', 'A directory structure with a master directory that has one entry per user; each entry leads to that user\'s own flat directory of files.'],
      ['Master directory', 'The top directory of a two-level or tree-structured scheme. Its entries lead to the user directories; in a tree it is the root directory.'],
      ['User directory', 'A directory that belongs to one user and lists that user\'s files (and, in a tree, that user\'s subdirectories).'],
      ['Tree-structured directory (hierarchical directory)', 'A directory structure in which a master (root) directory leads to user directories, and any directory may hold both files and further subdirectories.'],
      ['Subdirectory', 'A directory that is listed as an entry inside another directory.'],
      ['Root directory', 'The directory at the top of the tree. It has no parent, and every absolute pathname starts there.'],
      ['Pathname', 'The name of a file written as the route to it: the directories passed through, then the file name, joined by a separator, as in /ana/school/os/hw1.txt.'],
      ['Path separator', 'The character placed between the names in a pathname: / in UNIX, Linux and macOS, \\ in Windows.'],
      ['Absolute pathname', 'A pathname that starts at the root directory (in UNIX it begins with /). It names the same file no matter which directory you are working in.'],
      ['Relative pathname', 'A pathname that does not start at the root. The system reads it starting from the working directory.'],
      ['Working directory (current directory)', 'The directory a process is currently "in". Each process has its own; relative pathnames are resolved from it, and a shell changes it with the cd command.'],
      ['Parent directory', 'The directory that contains a given directory, one level closer to the root. Pathnames write it as two dots (..).'],
      ['Name clash', 'An attempt to give a new file a name that another entry in the same directory already uses. The directory must refuse it, or lookups by name would become ambiguous.'],
    ],
    css: `
      .sec-12-4 .tree { display: flex; flex-direction: column; gap: 1px; font-size: 15px; }
      .sec-12-4 .trow { display: flex; align-items: center; gap: 6px; min-height: 23px; border-radius: 6px; padding-right: 4px; }
      .sec-12-4 .trow .nm { border: 0; background: none; font: inherit; color: var(--ink); padding: 1px 6px; border-radius: 5px; line-height: 1.3; text-align: left; }
      .sec-12-4 .trow button.nm { cursor: pointer; }
      .sec-12-4 .trow button.nm:hover { background: var(--accent-bg); }
      .sec-12-4 .trow.dir .nm { font-weight: 750; color: var(--os); }
      .sec-12-4 .trow .tags { display: inline-flex; gap: 4px; }
      .sec-12-4 .trow .tags .chip { font-size: 12.5px; line-height: 1.35; padding: 0 7px; }
      .sec-12-4 .trow .cdb { margin-left: auto; border: 1px solid var(--line-2); background: var(--panel); color: var(--ink-2); font: inherit; font-size: 12.5px; font-weight: 700; border-radius: 6px; padding: 0 7px; line-height: 1.5; cursor: pointer; }
      .sec-12-4 .trow .cdb:hover { border-color: var(--proc); color: var(--proc); }
      .sec-12-4 .trow.trail { background: var(--panel-3); }
      .sec-12-4 .trow.cur { box-shadow: inset 0 0 0 2px var(--accent); background: var(--accent-bg); }
      .sec-12-4 .trow.hit { background: var(--ok-bg); box-shadow: inset 0 0 0 2px var(--ok); }
      .sec-12-4 .trow.err { background: var(--bad-bg); box-shadow: inset 0 0 0 2px var(--bad); }
      .sec-12-4 .trow.dim { opacity: .45; }
      .sec-12-4 .narr { background: var(--panel-2); border: 1px solid var(--line); border-left: 5px solid var(--chc); border-radius: 12px; padding: 9px 13px; font-size: 15.5px; line-height: 1.45; }
      .sec-12-4 .narr.ok { border-left-color: var(--ok); background: var(--ok-bg); }
      .sec-12-4 .narr.bad { border-left-color: var(--bad); background: var(--bad-bg); }
      .sec-12-4 .mw0 > * { min-width: 0; }
      .sec-12-4 .dtab { display: flex; flex-direction: column; gap: 4px; }
      .sec-12-4 .dhead, .sec-12-4 .drow { display: grid; grid-template-columns: 1.25fr 1.6fr .8fr; gap: 8px; align-items: center; text-align: left; }
      .sec-12-4 .dhead { padding: 0 10px; color: var(--muted); font-weight: 800; }
      .sec-12-4 .drow { font: inherit; color: var(--ink); background: var(--panel); border: 2px solid var(--line); border-radius: 9px; padding: 5px 10px; cursor: pointer; }
      .sec-12-4 .drow:hover { border-color: var(--io); }
      .sec-12-4 .drow.on { border-color: var(--io); background: var(--io-bg); }
      .sec-12-4 .drow.self .b { color: var(--os); }
      .sec-12-4 .drow.self.on { border-color: var(--os); background: var(--os-bg); }
      .sec-12-4 .disk { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 4px; }
      .sec-12-4 .blk { height: 32px; display: grid; place-items: center; font-size: 13px; font-weight: 700; color: var(--muted); border: 1px solid var(--line); border-radius: 6px; background: var(--panel); }
      .sec-12-4 .blk.used { background: var(--panel-3); color: var(--ink-2); }
      .sec-12-4 .blk.pick { background: var(--io-bg); border: 2px solid var(--io); color: var(--io); }
      .sec-12-4 .blk.pickos { background: var(--os-bg); border: 2px solid var(--os); color: var(--os); }
      .sec-12-4 .fgrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; margin-top: 7px; }
      .sec-12-4 .fbtn { justify-content: flex-start; width: 100%; padding: 0 8px; font-size: 13.5px; background: var(--panel); }
      .sec-12-4 .fbtn.seen::after { content: '✓'; margin-left: auto; font-size: 12.5px; opacity: .75; }
      .sec-12-4 .fbtn.on { background: var(--hl); color: var(--ink); border-width: 2px; }
      .sec-12-4 .opgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(118px, 1fr)); gap: 6px; }
      .sec-12-4 .opgrid .btn { width: 100%; padding: 0 6px; }
      .sec-12-4 .tcap { margin: 0 0 4px; letter-spacing: .02em; }
      .sec-12-4 table.s3t { width: 100%; font-size: 15px; }
      .sec-12-4 table.s3t td, .sec-12-4 table.s3t th { padding: 5px 7px; white-space: nowrap; }
      .sec-12-4 table.s3t tr.scan td { background: var(--accent-bg); }
      .sec-12-4 table.s3t tr.hitrow td { background: var(--ok-bg); }
      .sec-12-4 table.s3t tr.newrow td { background: var(--hl); }
      .sec-12-4 table.s3t tr td.chg { background: var(--hl); font-weight: 800; }
      .sec-12-4 .ino { color: var(--os); }
      .sec-12-4 .dircol { flex: 0 0 auto; }
      .sec-12-4 .s3n { font-size: 15px; line-height: 1.4; }
      .sec-12-4 .oplist { display: grid; grid-template-columns: auto 1fr; gap: 2px 12px; border-top: 1px solid var(--line); padding-top: 8px; }
      .sec-12-4 .oplist > div { display: contents; }
      .sec-12-4 .oplist b { color: var(--os); }
      .sec-12-4 .s4-dg { display: flex; flex-direction: column; gap: 12px; }
      .sec-12-4 .dcard { border: 2px solid var(--line-2); border-radius: 10px; background: var(--panel-2); padding: 6px 8px 8px; min-width: 0; }
      .sec-12-4 .dcard.master { border-color: var(--os); background: var(--os-bg); }
      .sec-12-4 .dcard.master .ents { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .sec-12-4 .dcard.wide .ents { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .sec-12-4 .dcard.sub { border-style: dashed; }
      .sec-12-4 .dcard.visit { box-shadow: 0 0 0 3px var(--accent); }
      .sec-12-4 .dtitle { color: var(--muted); margin-bottom: 4px; letter-spacing: .02em; }
      .sec-12-4 .ents { display: grid; grid-template-columns: minmax(0, 1fr); gap: 4px; }
      .sec-12-4 .ent { display: flex; align-items: center; justify-content: space-between; gap: 6px; background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 2px 8px; font-size: 15px; min-width: 0; }
      .sec-12-4 .ent.isdir .mono { color: var(--os); font-weight: 800; }
      .sec-12-4 .ent.clash { background: var(--bad-bg); border: 2px solid var(--bad); }
      .sec-12-4 .ent.new { background: var(--hl); }
      .sec-12-4 .ent.hit { background: var(--ok-bg); border: 2px solid var(--ok); }
      .sec-12-4 .ent .own { background: var(--panel-3); color: var(--ink-2); border-radius: 99px; padding: 0 7px; font-weight: 700; }
      .sec-12-4 .ucols { grid-template-columns: 2fr 1fr 1fr; gap: 10px; align-items: start; }
      .sec-12-4 .subs { display: flex; flex-wrap: wrap; gap: 8px; }
      .sec-12-4 .subs > .dcard { flex: 1 1 120px; }
      .sec-12-4 .scalebox { margin-top: auto; border-top: 1px solid var(--line); padding-top: 8px; }
      .sec-12-4 table.s4s { width: 100%; font-size: 14px; }
      .sec-12-4 table.s4s td { padding: 3px 8px; white-space: nowrap; }
      .sec-12-4 table.s4s td.mono { white-space: normal; }
      .sec-12-4 table.s3t.slim { font-size: 14px; }
      .sec-12-4 table.s3t.slim td, .sec-12-4 table.s3t.slim th { padding: 4px 5px; }
      .sec-12-4 .act { justify-content: flex-start; width: 100%; }
      .sec-12-4 .pc { line-height: 1.4; }
      .sec-12-4 .defs { display: grid; grid-template-columns: 112px 1fr; gap: 7px 12px; font-size: 15.5px; line-height: 1.4; }
      .sec-12-4 .defs > div { display: contents; }
      .sec-12-4 .defs > div > b { color: var(--chc); }
      .sec-12-4 .tryit { margin-top: auto; background: var(--panel-2); border-radius: 8px; padding: 6px 9px; line-height: 1.5; }
      .sec-12-4 .pline { border-top: 1px solid var(--line); padding-top: 6px; }
      .sec-12-4 .pval { font-size: 16px; font-weight: 700; overflow-wrap: anywhere; }
      .sec-12-4 .pin { flex: 1; min-width: 0; height: 36px; border: 2px solid var(--line-2); border-radius: 9px; background: var(--panel); color: var(--ink); font-size: 16px; padding: 0 10px; }
      .sec-12-4 .pin:focus { outline: none; border-color: var(--accent); }
      .sec-12-4 .pre { font-family: var(--mono); font-size: 13px; padding: 0 8px; }
      .sec-12-4 .player-cap { min-height: 94px; }
      .sec-12-4 .gq { font-size: 18px; line-height: 1.45; }
      .sec-12-4 .gfb { min-height: 112px; }
      .sec-12-4 .gchoices { gap: 8px; }
      .sec-12-4 .gch { height: 46px; font-family: var(--mono); font-size: 16px; white-space: normal; line-height: 1.2; }
      .sec-12-4 .gch.right { background: var(--ok-bg); border: 2px solid var(--ok); color: var(--ok); }
      .sec-12-4 .gch.wrong { background: var(--bad-bg); border: 2px solid var(--bad); color: var(--bad); }
      .sec-12-4 .wrapchip { white-space: normal; line-height: 1.35; padding: 2px 9px; }
      .sec-12-4 .flip-face.back { font-size: 15.5px; line-height: 1.45; }
      .sec-12-4 .valbox { background: var(--panel-3); border-radius: 8px; padding: 7px 12px; font-size: 17px; font-weight: 700; }
    `,
    steps: [
      /* ---------------- 1. Big picture: names for people, block numbers for the disk ---------------- */
      {
        title: 'Names for people, block numbers for the disk',
        kind: 'story',
        html: `
          <div class="split fill mw0">
            <div class="stack" style="gap:10px">
              <p class="lead m0">You remember a file as <b>hw1.txt</b>. The disk only knows numbered blocks. A <span class="t">directory</span> is the table that connects the two.</p>
              <p class="m0">Whenever a program opens a file by name, the OS looks that name up in a directory. The matching <span class="t">directory entry</span> leads it to everything else it needs: where the data starts, how big the file is, and who may use it.</p>
              <p class="m0">A directory is itself a <span class="t">file</span>, stored in disk blocks like any other, but it belongs to the OS. Programs may ask to list it; they change it only by asking the OS to create, delete or rename a file. If any program could write into it directly, one bad write could make other files vanish.</p>
              <div class="callout analogy m0" data-label="Analogy">Your phone's contacts: tap a name and the phone finds the number. You never memorize numbers, and when a friend's number changes, only that one entry changes.</div>
              <div class="callout why m0" data-label="Why it matters">Names are for people; block numbers change when a file grows or moves. Programs only ever use the name, so the OS can move the data and fix up one entry.</div>
            </div>
            <div class="card stack" style="gap:10px">
              <h4 class="m0">Look a name up</h4>
              <p class="small muted m0">This is the directory <b class="mono">/ana/school/os</b>. Click a row to follow it to the disk.</p>
              <div class="s1-dir"></div>
              <div class="s1-disk"></div>
              <div class="narr s1-cap"></div>
              <div class="row gap-s small" style="margin-top:auto"><span class="xs b muted">COMING UP</span><span class="chip os">inspect an entry</span><span class="chip proc">five operations</span><span class="chip io">three structures</span><span class="chip accent">walk a pathname</span></div>
            </div>
          </div>`,
        render(el, ctx) {
          const { h } = ctx;
          const files = [
            { name: 'hw1.txt', blocks: [11, 12, 13], size: '9,500 bytes' },
            { name: 'lab2.c', blocks: [16, 17, 18, 19], size: '14,800 bytes' },
            { name: 'notes.txt', blocks: [5, 6], size: '6,100 bytes' },
            { name: 'the directory', blocks: [2], self: true },
          ];
          const used = new Set(files.flatMap((f) => f.blocks));
          const btns = files.map((f, i) => h('button', { class: 'drow' + (f.self ? ' self' : ''), type: 'button', onclick: () => show(i) },
            h('span', { class: f.self ? 'b' : 'mono b' }, f.name),
            h('span', { class: 'small' }, 'starts at block ' + f.blocks[0]),
            h('span', { class: 'small muted' }, f.self ? '1 block' : f.blocks.length + ' blocks')));
          ctx.$('.s1-dir').append(h('div', { class: 'dtab' }, h('div', { class: 'dhead xs' }, h('span', {}, 'NAME'), h('span', {}, 'WHERE THE DATA STARTS'), h('span', {}, 'SIZE')), ...btns));
          const cells = ctx.util.range(24).map((b) => h('div', { class: 'blk' + (used.has(b) ? ' used' : '') }, String(b)));
          ctx.$('.s1-disk').append(h('div', { class: 'xs muted b', style: { marginBottom: '4px' } }, 'DISK BLOCKS 0-23'), h('div', { class: 'disk' }, ...cells));
          const cap = ctx.$('.s1-cap');
          function show(i) {
            const f = files[i];
            btns.forEach((b, j) => b.classList.toggle('on', i === j));
            cells.forEach((c, b) => { c.classList.toggle('pick', !f.self && f.blocks.includes(b)); c.classList.toggle('pickos', !!f.self && f.blocks.includes(b)); });
            cap.innerHTML = f.self
              ? 'The directory is a file too: its entries are stored in <b>block 2</b>. The OS finds it the same way as any file, through an entry named <b class="mono">os</b> in its parent directory <b class="mono">/ana/school</b>.'
              : `<b class="mono">${f.name}</b>: the entry says the data starts at block <b>${f.blocks[0]}</b> and fills ${f.blocks.length} blocks (${f.blocks.join(', ')}), ${f.size} in all. The name never appears on the disk next to the data; only the directory links them.`;
            cap.classList.remove('fade-in'); void cap.offsetWidth; cap.classList.add('fade-in');
          }
          show(0);
        },
      },

      /* ---------------- 2. Directory entry inspector: four groups of information ---------------- */
      {
        title: 'What a directory entry can record',
        kind: 'explore',
        core: true,
        render(el, ctx) {
          const { h } = ctx;
          const G = [
            { key: 'basic', name: 'Basic information', cls: 'cpu', blurb: 'what the file is' },
            { key: 'addr', name: 'Address information', cls: 'io', blurb: 'where its data lives' },
            { key: 'acc', name: 'Access control information', cls: 'os', blurb: 'who may do what' },
            { key: 'use', name: 'Usage information', cls: 'proc', blurb: 'its history and current activity' },
          ];
          /* [group, short label, full name, example value for /ana/school/os/hw1.txt, what it is, note on real systems] */
          const F = [
            [0, 'Name', 'File name', 'hw1.txt', 'The name chosen by whoever created the file. It must be unique within this one directory (not across the whole disk), because the directory finds files by name.', 'Most current file systems allow names of up to 255 characters; the original MS-DOS FAT allowed only 8 characters plus a 3-character extension.'],
            [0, 'Type', 'File type', 'text', 'What kind of file it is: text, binary data, an executable program (a load module), a directory, and so on.', 'UNIX records only a coarse type (regular file, directory, link, device). Whether a regular file holds text or a program is left to its name or contents; Windows leans on the extension (.txt, .exe).'],
            [0, 'Organization', 'File organization', 'byte stream', 'For systems that support several file organizations (pile, sequential, indexed, hashed: section 12.2), which one this file uses, so the right access method reads it.', 'UNIX and Windows treat every ordinary file as a stream of bytes, so they need no such field. Record-oriented systems such as IBM mainframes do keep one.'],
            [1, 'Volume', 'Volume', 'vol1 (the main SSD)', 'The device or <span class="t">volume</span> that holds the file. A computer can have several disks, and one disk may be split into several volumes.', 'Windows shows the volume as the drive letter (C:, D:); UNIX instead attaches each volume somewhere in one big tree.'],
            [1, 'Start address', 'Starting address', 'block 11', 'Where the file\'s data begins on that volume: the number of its first block.', 'With linked or indexed allocation (section 12.7) this becomes a pointer to the first block of a chain or to an index block.'],
            [1, 'Size used', 'Size used', '9,500 bytes', 'How much data the file holds right now, in bytes (some systems count words or blocks instead).', 'This is the size that a file listing, such as <code>ls -l</code> or Explorer, shows you.'],
            [1, 'Size allocated', 'Size allocated', '3 blocks = 12,288 bytes', 'How much space is reserved for the file. With 4,096-byte blocks, 9,500 bytes need ⌈9,500 ÷ 4,096⌉ = 3 blocks, so 2,788 bytes of the last block are reserved but empty.', 'The gap between size used and size allocated is why a disk fills up a little faster than the file sizes add up to.'],
            [2, 'Owner', 'Owner', 'ana', 'The user who controls the file, usually its creator. The owner can grant and take away other users\' access.', 'UNIX stores an owner user ID and a group ID; the names you see are looked up from those numbers.'],
            [2, 'Access info', 'Access information', 'ben: read · group os-class: read', 'Who else may use the file. The simplest early form listed each authorized user\'s name with a password.', 'Modern systems store user and group IDs, often as an access control list with one line per user or group (section 12.5).'],
            [2, 'Permitted actions', 'Permitted actions', 'owner: read, write · others: read', 'What each authorized user may do: read, write, execute, or send the file across a network. The OS checks it whenever the file is opened.', 'UNIX packs the common case into 9 permission bits: read, write and execute for the owner, the group and everyone else.'],
            [3, 'Created', 'Date created', '2026-09-02 09:14', 'When the file was first made.', 'Classic UNIX never stored a creation time (its "ctime" means the last change of status). Newer file systems such as ext4, NTFS and APFS do store one.'],
            [3, 'Creator', 'Identity of creator', 'ana', 'The user who created the file. Usually the first owner too, though ownership can be handed on later.', 'Many systems keep only the current owner, not the original creator.'],
            [3, 'Last read', 'Date last read access', '2026-10-10 21:40', 'When anyone last read the file.', 'UNIX calls it atime. Updating it on every read costs a disk write, so since 2009 (kernel 2.6.30) Linux by default updates it only when it is older than the last change or more than a day old ("relatime").'],
            [3, 'Last reader', 'Identity of last reader', 'ben', 'Which user last read the file.', 'Everyday file systems do not record this; when it matters, security auditing writes such events to separate logs.'],
            [3, 'Last modified', 'Date last modified', '2026-10-09 18:05', 'When the contents last changed.', 'Backup programs and build tools such as make compare this time with other files\' times to decide what is out of date.'],
            [3, 'Last modifier', 'Identity of last modifier', 'ana', 'Which user made the latest change.', 'Like the last reader, rarely kept by everyday file systems; version control and audit logs track it instead.'],
            [3, 'Last backup', 'Date of last backup', '2026-10-10 02:00', 'When the file was last copied to backup storage. If the file was modified after this time, the backup is stale.', 'Windows file systems keep an "archive" flag for the same purpose: set on every change, cleared by the backup program.'],
            [3, 'Current usage', 'Current usage', 'open by 1 process · not locked · nothing waiting to be written', 'Live activity: which processes have the file open, whether one of them has locked it, and whether it was changed in main memory but not yet written to disk.', 'This changes constantly and means nothing after a reboot, so real systems keep it in main-memory tables of open files rather than on disk.'],
          ];
          const seen = new Set();
          const det = h('div', { class: 'card white stack grow', style: { gap: '8px' } });
          const prog = h('div', { class: 'small muted' });
          const meter = h('div', { class: 'meter' }, h('i'));
          const btns = [];
          const cards = G.map((g, gi) => {
            const list = F.map((f, fi) => [f, fi]).filter(([f]) => f[0] === gi);
            const grid = h('div', { class: 'fgrid' }, ...list.map(([f, fi]) => { const b = h('button', { class: 'btn sm ' + g.cls + ' fbtn', type: 'button', onclick: () => show(fi) }, f[1]); btns[fi] = b; return b; }));
            return h('div', { class: 'card tight ' + g.cls + ' gcard' }, h('b', { style: { color: 'var(--' + g.cls + ')' } }, g.name), grid);
          });
          function show(fi) {
            const f = F[fi], g = G[f[0]];
            seen.add(fi);
            btns.forEach((b, j) => { b.classList.toggle('on', j === fi); b.classList.toggle('seen', seen.has(j)); });
            det.replaceChildren(
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'chip wrapchip ' + g.cls }, g.name + ': ' + g.blurb), h('span', { class: 'xs muted' }, 'field ' + (fi + 1) + ' of ' + F.length)),
              h('h3', { class: 'm0' }, f[2]),
              h('div', { class: 'valbox mono' }, f[3]),
              h('p', { class: 'm0', style: { fontSize: '15.5px' }, html: f[4] }),
              h('div', { class: 'callout tip m0 small', 'data-label': 'In real systems', html: f[5] }));
            det.classList.remove('fade-in'); void det.offsetWidth; det.classList.add('fade-in');
            prog.textContent = 'Fields explored: ' + seen.size + ' of ' + F.length;
            meter.firstChild.style.width = (seen.size / F.length * 100) + '%';
          }
          el.append(h('div', { class: 'split r fill mw0' },
            h('div', { class: 'stack', style: { gap: '10px' } },
              h('p', { class: 'm0', html: 'Here is everything a directory <i>could</i> keep about one file, <b class="mono">/ana/school/os/hw1.txt</b>, sorted into four groups. Click any field.' }),
              /* two columns read row by row (basic | address, access | usage); one column on small screens keeps that order */
              ctx.narrow ? h('div', { class: 'stack', style: { gap: '10px' } }, ...cards)
                : h('div', { class: 'grid-2 mw0', style: { gap: '10px', alignItems: 'start' } }, h('div', { class: 'stack', style: { gap: '10px' } }, cards[0], cards[2]), h('div', { class: 'stack', style: { gap: '10px' } }, cards[1], cards[3])),
              h('div', { class: 'callout why m0', 'data-label': 'Why it matters', html: 'Each group serves a different part of the OS: the address group lets the file system find the data, the access group lets it refuse an unauthorized open, and the usage group feeds backups and tools.' })),
            h('div', { class: 'stack', style: { gap: '8px' } }, det,
              h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'Thinking every system stores all 18 fields. Real systems keep a subset, and UNIX keeps almost none of them in the directory itself: the next step shows where they go instead.' }),
              prog, meter)));
          show(0);
        },
      },

      /* ---------------- 3. The five operations, under two entry layouts ---------------- */
      {
        title: 'Five operations on a directory, two ways to lay it out',
        kind: 'explore',
        core: true,
        render(el, ctx) {
          const { h } = ctx;
          const NAMES = ['hw1.txt', 'lab2.c', 'notes.txt', 'draft.txt', 'plan.md'];
          const fresh = () => ({
            ents: [
              { name: 'hw1.txt', ino: 41, start: 11, size: 9500, mod: '10-09 18:05' },
              { name: 'lab2.c', ino: 57, start: 16, size: 14800, mod: '10-08 11:20' },
              { name: 'notes.txt', ino: 42, start: 5, size: 6100, mod: '10-10 08:30' },
            ],
            nextIno: 58, nextBlock: 30, minute: 0,
          });
          let st = fresh(), mode = 'full', pick = 'notes.txt', gen = 0;
          const fmtN = (n) => n.toLocaleString('en-US');
          const blocksOf = (e) => (e.size ? Math.ceil(e.size / 4096) : 0);
          const tick = () => { st.minute += 1; const m = 9 * 60 + st.minute; return '10-11 ' + String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
          const plural = (n, one, many) => n + ' ' + (n === 1 ? one : (many || one + 's'));
          const search = (ents, name) => { const i = ents.findIndex((e) => e.name === name); return { idx: i, cmp: i < 0 ? ents.length : i + 1 }; };

          const tables = h('div', { class: 's3-tabs' });
          const narr = h('div', { class: 'narr grow' });
          const sizeNote = h('p', { class: 'small muted m0' });

          /* Draw the directory (and inode table) for a list of entries with optional marks. */
          function draw(ents, mk = {}) {
            const rowCls = (e, i) => [mk.scan === i ? 'scan' : '', mk.hit === e.name ? 'hitrow' : '', mk.added === e.name ? 'newrow' : ''].join(' ').trim();
            const chg = (e, col) => (mk.chg === e.name && mk.cols && mk.cols.includes(col) ? 'chg' : '');
            const head = (...c) => h('thead', {}, h('tr', {}, ...c.map((x) => h('th', {}, x))));
            const slim = ctx.narrow, tcls = 'tbl compact s3t' + (slim ? ' slim' : '');
            const attrCells = (e) => [slim ? null : h('td', {}, 'ana'), h('td', { class: chg(e, 'start') }, e.start == null ? '-' : String(e.start)), h('td', { class: chg(e, 'size') }, fmtN(e.size)), h('td', { class: chg(e, 'mod') + ' mono' }, e.mod)];
            if (mode === 'full') {
              tables.replaceChildren(h('div', { class: 'xs b muted tcap' }, 'DIRECTORY FILE /ana/school/os (each entry holds everything)'),
                h('table', { class: tcls }, slim ? head('Name', 'Start', 'Size', 'Modified') : head('Name', 'Owner', 'Start block', 'Size (bytes)', 'Modified'),
                  h('tbody', {}, ...ents.map((e, i) => h('tr', { class: rowCls(e, i) }, h('td', { class: 'mono b' }, e.name), ...attrCells(e))))));
              sizeNote.innerHTML = 'Real example: an MS-DOS <b>FAT</b> entry is a fixed 32 bytes holding the name, attribute flags, dates, first block (cluster) and size.';
            } else {
              const inoSorted = ents.slice().sort((a, b) => a.ino - b.ino);
              tables.replaceChildren(h('div', { class: slim ? 'stack' : 'row nw', style: { gap: '12px', alignItems: 'flex-start' } },
                h('div', { class: 'dircol' }, h('div', { class: 'xs b muted tcap' }, 'DIRECTORY FILE'),
                  h('table', { class: tcls }, head('Name', 'Inode'),
                    h('tbody', {}, ...ents.map((e, i) => h('tr', { class: rowCls(e, i) }, h('td', { class: 'mono b' }, e.name), h('td', { class: 'b ino' }, '→ ' + e.ino)))))),
                h('div', { class: 'grow', style: { minWidth: 0 } }, h('div', { class: 'xs b muted tcap' }, 'INODE TABLE (file headers; sizes in bytes)'),
                  h('table', { class: tcls }, slim ? head('Inode', 'Start', 'Size', 'Modified') : head('Inode', 'Owner', 'Start', 'Size', 'Modified'),
                    h('tbody', {}, ...inoSorted.map((e) => h('tr', { class: mk.ino === e.ino ? 'hitrow' : (mk.added === e.name ? 'newrow' : '') }, h('td', { class: 'b ino' }, String(e.ino)), ...attrCells(e))))))));
              sizeNote.innerHTML = 'Real example: in Linux <b>ext4</b> the entry for hw1.txt takes 16 bytes: the inode number, two length fields, a type byte and the name. Smaller entries mean more names per block, so a search reads fewer blocks.';
            }
          }
          function say(html, cls) { narr.className = 'narr grow s3n ' + (cls || ''); narr.innerHTML = html; }

          /* Play the comparison scan over `before`, then show the result (a newer click cancels it). */
          function animate(before, cmp, finish) {
            const g = ++gen;
            for (let k = 0; k < cmp; k++) ctx.after(k * 260, () => { if (g === gen) draw(before, { scan: k }); });
            ctx.after(cmp * 260, () => { if (g === gen) finish(); });
          }
          function op(kind) {
            const name = pick, before = st.ents.map((x) => Object.assign({}, x));
            const r = search(st.ents, name), e = r.idx >= 0 ? st.ents[r.idx] : null;
            const inode = mode === 'inode';
            if (kind === 'list') {
              gen++; draw(st.ents);
              const n = st.ents.length;
              say(inode
                ? `<b>List directory</b>: the ${plural(n, 'name')} come straight from the directory file. A long listing that also shows sizes and dates must read each file's inode too: <b>${plural(n, 'extra read')}</b>. A names-only listing needs none.`
                : `<b>List directory</b>: the OS returns all ${plural(n, 'entry', 'entries')}, and every column comes straight from those entries: <b>no extra reads</b>.`);
              return;
            }
            if (kind === 'search') {
              animate(before, r.cmp, () => {
                draw(st.ents, e ? { hit: name, ino: inode ? e.ino : undefined } : {});
                if (!e) say(`<b>Search</b> for <b class="mono">${name}</b>: compared all ${plural(r.cmp, 'entry', 'entries')}, no match, so the answer is "no such file". A failed search always has to look at every entry.`, 'bad');
                else say(`<b>Search</b> for <b class="mono">${name}</b>: the OS reads the directory file and compares names in order. Match at entry ${r.idx + 1} after <b>${plural(r.cmp, 'comparison')}</b>. ` + (inode
                  ? `The entry holds only inode number <b>${e.ino}</b>, so the OS makes one more read, of inode ${e.ino}, to learn the start block (${e.start == null ? 'none yet' : e.start}) and size.`
                  : `The entry itself holds the rest: start block ${e.start == null ? 'none yet' : e.start}, ${fmtN(e.size)} bytes.`), 'ok');
              });
              return;
            }
            if (kind === 'create') {
              if (e) { animate(before, r.cmp, () => { draw(st.ents, { hit: name }); say(`<b>Refused: <span class="t">name clash</span>.</b> The search found <b class="mono">${name}</b> at entry ${r.idx + 1}. One directory cannot hold two entries with the same name, or a lookup could never tell them apart.`, 'bad'); }); return; }
              if (st.ents.length >= 6) { gen++; draw(st.ents); say('This demo directory holds at most 6 entries. Delete one first.', 'bad'); return; }
              const ne = { name, ino: st.nextIno++, start: null, size: 0, mod: tick() };
              st.ents.push(ne);
              animate(before, r.cmp, () => {
                draw(st.ents, { added: name });
                say(`<b>Create file</b> <b class="mono">${name}</b>: first a search, to be sure the name is free (${plural(r.cmp, 'comparison')}, no match). ` + (inode
                  ? `Then the OS takes a free inode (<b>${ne.ino}</b>), fills in its attributes, and adds the pair ${name} → ${ne.ino} to the directory.`
                  : `Then it adds a new entry holding all the attributes: size 0, no blocks yet, time ${ne.mod}.`), 'ok');
              });
              return;
            }
            if (kind === 'delete') {
              if (!e) { animate(before, r.cmp, () => { draw(st.ents); say(`<b>Delete file</b>: no entry named <b class="mono">${name}</b> (compared all ${r.cmp}), so there is nothing to delete.`, 'bad'); }); return; }
              const nb = blocksOf(e);
              st.ents.splice(r.idx, 1);
              animate(before, r.cmp, () => {
                draw(st.ents);
                say(`<b>Delete file</b> <b class="mono">${name}</b>: the search finds it at entry ${r.idx + 1} and the OS removes that entry. ` + (inode
                  ? `No other entry names inode ${e.ino} and no process has it open, so the inode is freed too` + (nb ? `, and its ${plural(nb, 'block')} ${nb === 1 ? 'returns' : 'return'} to free space.` : '; the file had no data blocks yet.')
                  : (nb ? `Its ${plural(nb, 'block')} ${nb === 1 ? 'returns' : 'return'} to free space.` : 'The file had no data blocks yet, so no space is freed.')), 'ok');
              });
              return;
            }
            if (kind === 'update') {
              if (!e) { animate(before, r.cmp, () => { draw(st.ents); say(`<b>Update</b>: no entry named <b class="mono">${name}</b>, so there is nothing to write to. Create it first.`, 'bad'); }); return; }
              const old = e.size, cols = ['size', 'mod'];
              let first = '';
              e.size += 500; e.mod = tick();
              if (e.start == null) { e.start = st.nextBlock++; cols.push('start'); first = ` It also got its first block, ${e.start}.`; }
              animate(before, r.cmp, () => {
                draw(st.ents, { chg: name, cols, ino: inode ? e.ino : undefined });
                say(`<b>Update</b>: ana writes 500 more bytes to <b class="mono">${name}</b>. Its size (${fmtN(old)} → ${fmtN(e.size)}) and modified time change.${first} ` + (inode
                  ? `Those attributes live in <b>inode ${e.ino}</b>, so only the inode is rewritten. The directory file is untouched: it changes only when a name is added, removed or renamed.`
                  : `Those attributes live in the directory entry, so the OS must <b>update the directory</b>, rewriting entry ${r.idx + 1}.`), 'ok');
              });
            }
          }
          const intro = { full: 'Each <span class="t">directory entry</span> holds the name <i>and</i> every attribute. Pick a name, then an operation.',
            inode: 'Now each entry holds just a <b>name</b> and an <b><span class="t">inode</span> number</b>. Every other attribute moved into a separate <span class="t">file header</span>, the inode. UNIX and Linux file systems work this way. Try the same operations again.' };
          const layoutSeg = ctx.ui.seg([{ value: 'full', label: 'Everything in the entry' }, { value: 'inode', label: 'Name + inode number' }], mode, (v) => { mode = v; gen++; draw(st.ents); say(intro[v]); });
          const nameSeg = ctx.ui.seg(NAMES.map((n) => ({ value: n, label: n })), pick, (v) => { pick = v; });
          const B = (label, kind) => h('button', { class: 'btn sm os', type: 'button', onclick: () => op(kind) }, label);
          const reset = h('button', { class: 'btn sm', type: 'button', onclick: () => { gen++; st = fresh(); draw(st.ents); say('Reset: the directory is back to its three original entries.'); } }, 'Reset');
          el.append(h('div', { class: 'split l fill mw0' },
            h('div', { class: 'stack', style: { gap: '8px' } },
              h('p', { class: 'm0', html: 'Five operations. The OS carries them out for programs, which never write a directory file themselves.' }),
              h('div', { class: 'xs b muted' }, 'LAYOUT OF EACH ENTRY'), layoutSeg,
              h('div', { class: 'xs b muted' }, 'FILE NAME TO USE'), nameSeg,
              h('div', { class: 'opgrid' }, B('Search', 'search'), B('Create file', 'create'), B('Delete file', 'delete'), B('List directory', 'list'), B('Update (+500 bytes)', 'update'), reset),
              narr,
              h('div', { class: 'callout tip m0 small', 'data-label': 'Big directories', html: 'Comparing names one by one is fine for a few dozen entries. Huge directories index their names with a hash table or a B-tree instead (sections 12.2-12.3), as ext4 and NTFS do.' })),
            h('div', { class: 'card white stack', style: { gap: '10px' } }, h('div', { class: 'grow' }, tables),
              h('div', { class: 'oplist small' }, ...[
                ['Search', 'find the entry whose name matches'], ['Create file', 'add a new entry (after checking the name is free)'], ['Delete file', 'remove an entry'],
                ['List directory', 'return all the entries, or some of them'], ['Update directory', 'rewrite an entry when an attribute stored in it changes'],
              ].map(([a, b]) => h('div', {}, h('b', {}, a), h('span', {}, b)))),
              h('div', { class: 'row small', style: { gap: '8px' } }, h('span', { class: 'chip', style: { background: 'var(--accent-bg)' } }, 'being compared'), h('span', { class: 'chip ok' }, 'found'), h('span', { class: 'chip', style: { background: 'var(--hl)', color: 'var(--ink)' } }, 'just written')),
              sizeNote)));
          draw(st.ents);
          say(intro.full);
        },
      },

      /* ---------------- 4. Single-level vs two-level vs tree ---------------- */
      {
        title: 'Three ways to arrange directories',
        kind: 'compare',
        core: true,
        render(el, ctx) {
          const { h } = ctx;
          const D = (name, kids) => ({ name, kids }), F = (name, owner) => ({ name, owner });
          function start(kind) {
            if (kind === 'single') return D('/', [F('notes.txt', 'ana'), F('song.mp3', 'ana'), F('hw1.txt', 'ana'), F('hw2.txt', 'ana'), F('chess.exe', 'ben'), F('todo.txt', 'chen'), F('plan.txt', 'chen')]);
            const ana = kind === 'tree'
              ? [F('notes.txt', 'ana'), F('song.mp3', 'ana'), D('school', [F('hw1.txt', 'ana'), F('hw2.txt', 'ana')])]
              : [F('notes.txt', 'ana'), F('song.mp3', 'ana'), F('hw1.txt', 'ana'), F('hw2.txt', 'ana')];
            return D('/', [D('ana', ana), D('ben', [F('chess.exe', 'ben')]), D('chen', [F('todo.txt', 'chen'), F('plan.txt', 'chen')])]);
          }
          const INFO = {
            single: { label: 'Single-level', term: 'single-level directory', desc: 'One directory holds every file of every user, one entry per file.',
              good: ['Simple: one list to search and update.'],
              bad: ['Every name must be unique across <b>all</b> users.', 'No way to group related files.', 'Slow and confusing once there are many files.'] },
            two: { label: 'Two-level', term: 'two-level directory', desc: 'A <span class="t">master directory</span> has one entry per user, leading to that user\'s own <span class="t">user directory</span>: a flat list of their files.',
              good: ['Names must be unique only within one user directory.', 'The master entry can carry access control, so each user\'s files are easy to protect.'],
              bad: ['Still flat inside: a user cannot group files into folders.'] },
            tree: { label: 'Tree', term: 'tree-structured directory', desc: 'The master directory, now the <span class="t">root directory</span>, leads to user directories, and <b>any</b> directory may hold files and further <span class="t">subdirectories</span>.',
              good: ['Names must be unique only within one directory.', 'Users group files as they like, as deep as they like.', 'Used by essentially every general-purpose OS today.'],
              bad: ['A file\'s full name becomes a path through several directories (next steps).'] },
          };
          let st, cur = 'single', marks = new Map(), visit = new Set();
          const resetAll = () => { st = { single: start('single'), two: start('two'), tree: start('tree') }; marks = new Map(); visit = new Set(); };
          resetAll();

          const info = h('div', { class: 'card tight stack', style: { gap: '6px' } });
          const narr = h('div', { class: 'narr s3n' });
          const diagram = h('div', { class: 'card white s4-dg' });
          const say = (html, cls) => { narr.className = 'narr s3n ' + (cls || ''); narr.innerHTML = html; };

          function entry(n) {
            const m = marks.get(n) || '';
            return h('div', { class: 'ent ' + (n.kids ? 'isdir ' : '') + m },
              h('span', { class: 'mono' }, n.name + (n.kids ? '/' : '')),
              cur === 'single' ? h('span', { class: 'own xs' }, n.owner) : (n.kids ? h('span', { class: 'xs', style: { color: 'var(--os)' } }, '→') : null));
          }
          function dcard(n, title, extra) {
            return h('div', { class: 'dcard' + (visit.has(n) ? ' visit' : '') + (extra ? ' ' + extra : '') }, h('div', { class: 'dtitle xs b' }, title), h('div', { class: 'ents' }, ...n.kids.map(entry)));
          }
          /* Average comparisons for a successful linear search at scale: (n + 1) / 2 per directory searched. */
          const U = 500, FN = 80, FOLD = 8, avg = (n) => (n + 1) / 2;
          const SCALE = [
            ['single', 'Single-level', `(${(U * FN).toLocaleString('en-US')}+1)÷2`, avg(U * FN)],
            ['two', 'Two-level', `(${U}+1)÷2 + (${FN}+1)÷2`, avg(U) + avg(FN)],
            ['tree', 'Tree', `(${U}+1)÷2 + (${FOLD}+1)÷2 + (${FN / FOLD}+1)÷2`, avg(U) + avg(FOLD) + avg(FN / FOLD)],
          ];
          function scaleBox() {
            return h('div', { class: 'scalebox' }, h('p', { class: 'small muted m0', style: { marginBottom: '4px' }, html: `<b>At scale:</b> ${U} users × ${FN} files each (in the tree, ${FOLD} folders of ${FN / FOLD} files). Average name comparisons to find one file:` }),
              h('table', { class: 'tbl compact s4s' }, h('tbody', {}, ...SCALE.map(([k, a, c, v]) => h('tr', { class: k === cur ? 'on' : '' }, h('td', { class: 'b' }, a), h('td', { class: 'mono' }, c), h('td', { class: 'b', style: { textAlign: 'right' } }, v.toLocaleString('en-US')))))));
          }
          function draw() {
            const root = st[cur];
            if (cur === 'single') {
              diagram.replaceChildren(dcard(root, 'THE ONE DIRECTORY (every user\'s files)', 'wide'),
                h('p', { class: 'small muted m0' }, 'Gray tags show each file\'s owner, kept inside the entry. The name itself must still be unique.'), scaleBox());
            } else {
              const users = root.kids;
              diagram.replaceChildren(dcard(root, cur === 'tree' ? 'ROOT (MASTER) DIRECTORY /' : 'MASTER DIRECTORY', 'master'),
                h('div', { class: 'grid-3 ucols' }, ...users.map((u) => h('div', { class: 'stack', style: { gap: '8px' } },
                  dcard(u, '/' + u.name + ' (USER)'),
                  ...(u.kids.some((k) => k.kids) ? [h('div', { class: 'subs' }, ...u.kids.filter((k) => k.kids).map((sd) => dcard(sd, '/' + u.name + '/' + sd.name, 'sub')))] : [])))), scaleBox());
            }
            const I = INFO[cur];
            info.replaceChildren(h('b', { html: `<span class="t" data-t="${I.term}">${I.label} directory</span>` }), h('p', { class: 'm0 small', html: I.desc }),
              ...I.good.map((g) => h('div', { class: 'small pc', html: '<b style="color:var(--ok)">✓</b> ' + g })), ...I.bad.map((b) => h('div', { class: 'small pc', html: '<b style="color:var(--bad)">✗</b> ' + b })));
          }
          function benNotes() {
            marks = new Map(); visit = new Set();
            const root = st[cur], dir = cur === 'single' ? root : root.kids.find((k) => k.name === 'ben');
            const clash = dir.kids.find((k) => k.name === 'notes.txt');
            visit.add(dir);
            if (clash) {
              marks.set(clash, 'clash'); draw();
              if (cur === 'single') say(`<b>Refused: <span class="t">name clash</span>.</b> notes.txt already exists, and it belongs to ana. In one shared list every name must be unique across all users, so ben has to invent another name, such as ben_notes.txt.`, 'bad');
              else say('<b>Refused:</b> /ben already has a notes.txt. Even in this structure, <b>one</b> directory cannot hold two entries with the same name.', 'bad');
              return;
            }
            const f = F('notes.txt', 'ben'); dir.kids.push(f); marks.set(f, 'new'); draw();
            say('<b>Saved.</b> ana\'s notes.txt and ben\'s notes.txt now coexist, because they sit in <b>different directories</b>. Names need to be unique only within one directory. Click again to see what happens inside /ben.', 'ok');
          }
          function anaMusic() {
            marks = new Map(); visit = new Set();
            const root = st[cur];
            if (cur !== 'tree') { draw(); say(`<b>Not possible.</b> In a ${cur === 'single' ? 'single-level' : 'two-level'} structure a ${cur === 'single' ? 'directory' : 'user directory'} can hold only files, never another directory, so ana\'s files stay in one flat list.`, 'bad'); return; }
            const ana = root.kids.find((k) => k.name === 'ana');
            if (ana.kids.some((k) => k.name === 'music')) { visit.add(ana); draw(); say('Already done: /ana/music exists. Press Reset to start over.'); return; }
            const i = ana.kids.findIndex((k) => k.name === 'song.mp3');
            const song = ana.kids.splice(i, 1)[0], music = D('music', [song]);
            ana.kids.push(music); marks.set(music, 'new'); marks.set(song, 'new'); visit.add(ana); draw();
            say('<b>Done.</b> /ana now holds a subdirectory, music/, and song.mp3 moved into it. Any directory can hold files and more directories, so every user can organize their own files.', 'ok');
          }
          function findHw1() {
            marks = new Map(); visit = new Set();
            const path = cur === 'single' ? ['hw1.txt'] : cur === 'two' ? ['ana', 'hw1.txt'] : ['ana', 'school', 'hw1.txt'];
            let dir = st[cur], total = 0;
            const parts = [], seen = [];
            for (const name of path) {
              const i = dir.kids.findIndex((k) => k.name === name);
              const where = !seen.length ? (cur === 'single' ? 'the one directory' : cur === 'tree' ? 'root' : 'master') : '/' + seen.join('/');
              visit.add(dir); total += i + 1;
              parts.push(`${where}: <b>${name}</b> is entry ${i + 1}`);
              marks.set(dir.kids[i], 'hit');
              seen.push(name);
              dir = dir.kids[i];
            }
            draw();
            say(`<b>Find hw1.txt</b>: ${parts.join(' · ')}. Total <b>${total}</b> comparisons here. With so few files every structure is quick; the table below the diagram shows what happens at scale.`, 'ok');
          }
          const seg = ctx.ui.seg([{ value: 'single', label: 'Single-level' }, { value: 'two', label: 'Two-level' }, { value: 'tree', label: 'Tree' }], cur, (v) => { cur = v; marks = new Map(); visit = new Set(); draw(); say('Same users, same files, a different structure. Try the three actions.'); });
          const A = (label, fn) => h('button', { class: 'btn sm act', type: 'button', onclick: fn }, label);
          el.append(h('div', { class: 'split l fill mw0' },
            h('div', { class: 'stack', style: { gap: '8px' } }, seg, info,
              h('div', { class: 'stack', style: { gap: '5px' } }, A('ben saves a file named notes.txt', benNotes), A('ana files song.mp3 in a new folder, music/', anaMusic), A('Find ana\'s hw1.txt', findHw1)),
              narr,
              h('div', { class: 'row', style: { marginTop: 'auto' } }, h('button', { class: 'btn sm', type: 'button', onclick: () => { resetAll(); draw(); say('Reset: all three structures are back to their starting files.'); } }, 'Reset'))),
            diagram));
          draw();
          say('Three users, ana, ben and chen, keep the same files under each structure. Switch structures above, then try the three actions.');
        },
      },

      /* ---------------- 5. Pathnames: absolute, relative, working directory ---------------- */
      {
        title: 'Pathnames: a file\'s full name is its route',
        kind: 'learn',
        html: `
          <div class="split l fill mw0">
            <div class="stack" style="gap:7px">
              <p class="lead m0">In a tree, a file is named by the route to it.</p>
              <div class="defs">
                <div><b><span class="t">Pathname</span></b><span>The directories you pass through from the top, then the file name, joined by a <span class="t">path separator</span>: <code>/ana/school/os/hw1.txt</code></span></div>
                <div><b>Separator</b><span><code>/</code> in UNIX, Linux and macOS. <code>\\</code> in Windows, where a full path also starts with a drive letter: <code>C:\\ana\\school\\os\\hw1.txt</code></span></div>
                <div><b><span class="t" data-t="absolute pathname">Absolute</span></b><span>Starts at the root (a leading <code>/</code>), so it names the same file wherever you are.</span></div>
                <div><b><span class="t" data-t="working directory">Working dir.</span></b><span>Each process has one current working directory (cwd). A shell's <code>cd</code> changes it and <code>pwd</code> prints it.</span></div>
                <div><b><span class="t" data-t="relative pathname">Relative</span></b><span>No leading <code>/</code>: read starting from the working directory. From <code>/ana/school</code>, <code>os/hw1.txt</code> is the same file.</span></div>
                <div><b><code>.</code> and <code>..</code></b><span><code>.</code> means this directory; <code>..</code> means the <span class="t">parent directory</span>, one level up.</span></div>
              </div>
              <div class="callout tip m0 small" data-label="Same name, different file">This tree holds four files called <code>notes.txt</code>. Their pathnames differ, so there is no clash: a name only has to be unique inside its own directory.</div>
            </div>
            <div class="grid-2 mw0 s5-right" style="gap:12px">
              <div class="card tight s5-tree"></div>
              <div class="card white stack s5-info" style="gap:7px"></div>
            </div>
          </div>`,
        render(el, ctx) {
          const { h } = ctx;
          const tree = makeTree();
          let cwd = tree.find('/ana/school'), target = tree.find('/ana/school/os/hw1.txt');
          const tv = treeView(ctx, tree, { onPick: (n) => { target = n; paint(); }, onCd: (n) => { cwd = n; paint(); } });
          ctx.$('.s5-tree').append(h('div', { class: 'xs muted b', style: { marginBottom: '4px' } }, 'CLICK A NAME · cd MOVES THE cwd'), tv.el);
          const info = ctx.$('.s5-info');
          const line = (label, val, sub) => h('div', { class: 'pline' }, h('div', { class: 'xs b muted' }, label), h('div', { class: 'mono pval' }, val), sub ? h('div', { class: 'xs muted' }, sub) : null);
          function paint() {
            const trail = new Set();
            for (let n = target; n; n = n.parent) trail.add(n);
            tv.paint({ cwd, target, trail });
            const relPath = rel(cwd, target);
            const ra = resolve(tree, target.abs, cwd), rr = resolve(tree, relPath, cwd);
            const twins = tree.all.filter((n) => n !== target && n.parent && n.name === target.name);
            info.replaceChildren(
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', { class: 'mono', style: { fontSize: '18px' } }, target.parent ? target.name + (target.isDir ? '/' : '') : '/'), h('span', { class: 'chip ' + (target.isDir ? 'os' : 'io') }, target.isDir ? 'directory' : 'file')),
              line('ABSOLUTE (UNIX)', target.abs, `${lookups(ra)} lookup${lookups(ra) === 1 ? '' : 's'}, starting at the root`),
              line('ABSOLUTE (WINDOWS)', winPath(target)),
              line('RELATIVE FROM THE WORKING DIRECTORY ' + cwd.abs, relPath, `${lookups(rr)} lookup${lookups(rr) === 1 ? '' : 's'}, starting at ${cwd.abs}`),
              h('div', { class: 'pline' }, h('div', { class: 'xs b muted' }, 'OTHER ENTRIES WITH THE SAME NAME'),
                twins.length ? h('div', { class: 'small' }, ...twins.map((n) => h('div', { class: 'mono' }, n.abs))) : h('div', { class: 'small muted' }, 'none: this name is unique in the tree')),
              h('div', { class: 'tryit small', html: '<b>Try:</b> click each <code>notes.txt</code> · <code>cd</code> into <code>/ben</code>, then click <code>hw1.txt</code> · click the root' }));
          }
          paint();
        },
      },

      /* ---------------- 6. Path resolver: one directory lookup per name ---------------- */
      {
        title: 'Resolve a path, one lookup at a time',
        kind: 'lab',
        core: true,
        render(el, ctx) {
          const { h } = ctx;
          const esc = ctx.util.esc;
          const tree = makeTree();
          const PRE = ['/ana/school/os/hw1.txt', 'os/hw1.txt', '../notes.txt', './math/notes.txt', '../../ben/games/chess.exe', '/ben/games/chess.exe', 'music/song.mp3', 'C:\\ana\\music\\song.mp3'];
          let cwd = tree.find('/ana/school'), frames = [], res = null;
          const tv = treeView(ctx, tree, { onCd: (n) => { cwd = n; run(input.value, false); } });
          const input = h('input', { type: 'text', class: 'pin mono', value: PRE[0], spellcheck: 'false', autocomplete: 'off', 'aria-label': 'Path to resolve', onkeydown: (e) => { if (e.key === 'Enter') run(input.value, true); } });
          const cwdLine = h('div', { class: 'row gap-s small' });
          const stats = h('div', { class: 'row gap-s' });

          /* Turn the current path into frames: start, one frame per lookup, then the result or the error. */
          function compute(raw) {
            const parsed = parseInput(raw);
            frames = [];
            if (!parsed.path) { res = null; frames.push({ st: { cwd }, cap: 'Type a path first, for example <code>os/hw1.txt</code>, or pick one above.' }); return; }
            if (parsed.drive && parsed.drive !== 'C') {
              res = { absolute: true, start: tree.root, steps: [], end: null, err: { kind: 'volume', at: tree.root, comp: parsed.drive + ':' } };
              frames.push({ st: { cwd }, cap: `<b>Stop: no volume ${parsed.drive}:</b> In Windows the drive letter picks the volume before any directory is searched. This example tree is drive <code>C:</code>, so the path cannot be found, and no directory is searched at all.` });
              return;
            }
            res = resolve(tree, parsed.path, cwd, parsed.win);
            const trail = new Set([res.start]);
            const lead = parsed.win ? (parsed.drive ? `<code>${parsed.drive}:\\</code>` : '<code>\\</code>') : '<code>/</code>';
            const why = res.absolute
              ? `The path begins with ${lead}, so it is <b>absolute</b>: the search starts at the <b>root</b>, whatever the working directory is.`
              : `No leading ${lead}, so it is <b>relative</b>: the search starts at the working directory <b class="mono">${cwd.abs}</b>.`;
            const win = parsed.win ? ` Windows spelling: <code>\\</code> separates names${parsed.drive ? ', <code>C:</code> names the volume' : ''} and case does not matter. Read as <span class="mono">${esc(parsed.path)}</span>.` : '';
            frames.push({ st: { cwd, cur: res.start, trail: new Set(trail) }, cap: '<b>Start.</b> ' + why + win });
            res.steps.forEach((s, k) => {
              trail.add(s.to);
              let cap;
              if (s.kind === 'down') cap = `<b>Lookup ${k + 1}:</b> search directory <b class="mono">${s.from.abs}</b> for the name <b class="mono">${esc(s.comp)}</b>. Found: ` + (s.to.isDir ? `a directory, so move into <b class="mono">${s.to.abs}</b>.` : 'a file.');
              else if (s.kind === 'up') cap = `<b>Lookup ${k + 1}:</b> <code>..</code> is the entry for the parent directory. Move up from <b class="mono">${s.from.abs}</b> to <b class="mono">${s.to.abs}</b>.` + (s.from === s.to ? ' The root has no parent, so <code>..</code> at the root stays at the root.' : '');
              else cap = `<b>Lookup ${k + 1}:</b> <code>.</code> is the entry for this same directory, so stay in <b class="mono">${s.to.abs}</b>.`;
              frames.push({ st: { cwd, cur: s.to, trail: new Set(trail) }, cap });
            });
            const n = lookups(res);
            if (res.err && res.err.kind === 'missing') frames.push({ st: { cwd, trail: new Set(trail), err: res.err.at }, cap: `<b>Lookup ${n}:</b> search <b class="mono">${res.err.at.abs}</b> for <b class="mono">${esc(res.err.comp)}</b>: <b>no such entry</b>. Resolution stops with the error "No such file or directory". Check where the path starts and which directory each name really sits in.` });
            else if (res.err) frames.push({ st: { cwd, trail: new Set(trail), err: res.err.at }, cap: `<b>Stop:</b> <b class="mono">${res.err.at.abs}</b> is a file, not a directory, so ` + (res.err.comp ? `it cannot be searched for <b class="mono">${esc(res.err.comp)}</b>.` : 'the trailing <code>/</code>, which asks for a directory, cannot be satisfied.') + ' The error is "Not a directory".' });
            else frames.push({ st: { cwd, trail: new Set(trail), hit: res.end }, cap: `<b>Done</b> after <b>${n} directory lookup${n === 1 ? '' : 's'}</b>: the path names the ${res.end.isDir ? 'directory' : 'file'} <b class="mono">${res.end.abs}</b> (Windows: <span class="mono">${winPath(res.end)}</span>). From this working directory its shortest relative path is <b class="mono">${rel(cwd, res.end)}</b>.` });
          }
          /* Lookup counts for the callout, always measured from /ana/school by the same resolver. */
          function whyHtml() {
            const w = tree.find('/ana/school'), L = (p) => lookups(resolve(tree, p, w));
            return `Nearby files get short names and fewer lookups: from <code>/ana/school</code>, <code>os/hw1.txt</code> takes ${L('os/hw1.txt')} lookups and <code>/ana/school/os/hw1.txt</code> takes ${L('/ana/school/os/hw1.txt')}. For distant files the absolute path can win: ${L('../../ben/games/chess.exe')} lookups versus ${L('/ben/games/chess.exe')} for chess.exe.`;
          }
          function paintStats() {
            cwdLine.replaceChildren(h('span', { class: 'b' }, 'Working directory:'), h('span', { class: 'chip proc mono' }, cwd.abs), h('span', { class: 'muted' }, 'press cd in the tree to change it'));
            stats.replaceChildren(...(res ? [
              h('span', { class: 'chip ' + (res.absolute ? 'os' : 'proc') }, res.absolute ? 'absolute: starts at /' : 'relative: starts at ' + cwd.abs),
              h('span', { class: 'chip accent' }, 'directory lookups: ' + lookups(res)),
              h('span', { class: 'chip ' + (res.err ? 'bad' : 'ok') }, res.err ? ({ missing: 'error: no such entry', file: 'error: not a directory', volume: 'error: no such volume' })[res.err.kind] : 'result: ' + res.end.abs),
            ] : [h('span', { class: 'chip' }, 'no path yet')]));
          }
          const player = ctx.ui.player({ count: 1, interval: 1500, render: (i) => { const f = frames[i]; if (!f) return ''; tv.paint(f.st); return f.cap; } });
          function run(raw, play) {
            compute(raw);
            paintStats();
            player.stop();
            player.setCount(frames.length);
            if (play) player.play();
          }
          el.append(h('div', { class: 'split l3 fill mw0' },
            h('div', { class: 'card tight' }, h('div', { class: 'xs muted b', style: { marginBottom: '4px' } }, 'THE TREE'), tv.el),
            h('div', { class: 'stack', style: { gap: '8px' } },
              h('p', { class: 'm0', html: 'The OS reads a path from left to right and makes <b>one directory search per name</b>. Type a path (UNIX <code>/</code> or Windows <code>\\</code> form) or pick one, then step through it.' }),
              cwdLine,
              h('div', { class: 'row nw', style: { gap: '8px' } }, input, h('button', { class: 'btn sm primary', type: 'button', onclick: () => run(input.value, true) }, 'Resolve')),
              h('div', { class: 'row', style: { gap: '5px' } }, ...PRE.map((p) => h('button', { class: 'btn sm pre', type: 'button', onclick: () => { input.value = p; run(p, true); } }, p))),
              stats, player.el,
              h('div', { class: 'grid-2', style: { gap: '10px' } },
                h('div', { class: 'callout why m0 small', 'data-label': 'Why keep a working directory?', html: whyHtml() }),
                h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'Forgetting that a relative path depends on the working directory. <code>music/song.mp3</code> fails from <code>/ana/school</code> but works after <code>cd /ana</code>. An absolute path never has this problem.' })))));
          run(PRE[0], false);
        },
      },

      /* ---------------- 7. Working-directory game ---------------- */
      {
        title: 'Game: find the relative path',
        kind: 'lab',
        render(el, ctx) {
          const { h } = ctx;
          const tree = makeTree();
          const tv = treeView(ctx, tree);
          /* Every (working directory, target) pair whose relative path has at least two names; the root is never
             the working directory. The first round is fixed, the rest follow a seeded shuffle. */
          const pairs = [];
          tree.all.filter((d) => d.isDir && d.parent).forEach((d) => tree.all.forEach((n) => { if (n.parent && n !== d && rel(d, n).split('/').length >= 2) pairs.push([d, n]); }));
          const order = [[tree.find('/ana/school/os'), tree.find('/ana/notes.txt')], ...ctx.util.shuffle(pairs, ctx.util.seeded(1204))];
          let round = 0, score = 0, played = 0, cur = null, answered = false;
          const head = h('div', { class: 'row', style: { justifyContent: 'space-between' } });
          const q = h('p', { class: 'm0 gq' });
          const grid = h('div', { class: 'grid-2 gchoices' });
          const fb = h('div', { class: 'narr s3n gfb' });
          const nextBtn = h('button', { class: 'btn sm primary', type: 'button', onclick: () => { round++; deal(); } }, 'Next round →');

          /* Why the right answer is right: climb to the closest directory that also leads to the target, then go down. */
          function explain(d, n) {
            const anc = new Set(); for (let x = n; x; x = x.parent) anc.add(x);
            let c = d, ups = 0; while (!anc.has(c)) { c = c.parent; ups++; }
            const downs = []; for (let x = n; x !== c; x = x.parent) downs.unshift(x.name);
            return (ups ? `Climb ${ups} level${ups === 1 ? '' : 's'} with <code>..</code> to <b class="mono">${c.abs}</b>, the closest directory on the target's route` : `<b class="mono">${c.abs}</b> already lies on the target's route, so no <code>..</code> is needed`)
              + `, then go down through <b class="mono">${downs.join(' → ')}</b>.`;
          }
          function deal() {
            const [d, n] = order[round % order.length];
            cur = { d, n, r: makeRound(tree, d, n, ctx.util.seeded(500 + round), ctx.util.shuffle) };
            answered = false;
            tv.paint({ cwd: d, target: n });
            head.replaceChildren(h('span', { class: 'chip accent' }, 'Round ' + (round + 1)), h('span', { class: 'chip ' + (played && score === played ? 'ok' : '') }, `Score: ${score} / ${played}`));
            q.innerHTML = `Your working directory is <b class="mono">${d.abs}</b>. Which <span class="t">relative pathname</span> reaches the ${n.isDir ? 'directory' : 'file'} <b class="mono">${n.abs}</b>?`;
            grid.replaceChildren(...cur.r.choices.map((c, i) => h('button', { class: 'btn gch', type: 'button', onclick: () => pickAns(i) }, c)));
            fb.className = 'narr s3n gfb';
            fb.innerHTML = 'Pick one. Every choice is checked by actually resolving it from the working directory, and the tree shows where it really goes.';
            nextBtn.disabled = true;
          }
          function pickAns(i) {
            const { d, n, r } = cur, path = r.choices[i], res = resolve(tree, path, d);
            const trail = new Set([d]); res.steps.forEach((s) => trail.add(s.to));
            const good = i === r.answer;
            if (!answered) { answered = true; played++; if (good) score++; }
            [...grid.children].forEach((b, j) => { b.classList.toggle('right', answered && j === r.answer); b.classList.toggle('wrong', j === i && !good); });
            tv.paint({ cwd: d, target: n, trail, hit: res.end || undefined, err: res.err ? res.err.at : undefined });
            const where = res.err
              ? (res.err.kind === 'missing' ? `fails: <b class="mono">${res.err.at.abs}</b> has no entry named <b class="mono">${res.err.comp}</b>` : `fails: <b class="mono">${res.err.at.abs}</b> is a file, not a directory`)
              : `leads to <b class="mono">${res.end.abs}</b>`;
            fb.className = 'narr s3n gfb ' + (good ? 'ok' : 'bad');
            fb.innerHTML = (good ? `<b>✓ Correct.</b> <code>${path}</code> ${where} in ${lookups(res)} lookups. ` : `<b>✗ Not this one.</b> From <b class="mono">${d.abs}</b>, <code>${path}</code> ${where}. `) + explain(d, n) + (good ? '' : ` The answer is <code>${r.right}</code>.`);
            head.lastChild.textContent = `Score: ${score} / ${played}`;
            head.lastChild.className = 'chip ' + (score === played ? 'ok' : '');
            nextBtn.disabled = false;
          }
          el.append(h('div', { class: 'split l3 fill mw0' },
            h('div', { class: 'card tight' }, h('div', { class: 'xs muted b', style: { marginBottom: '4px' } }, 'cwd = WORKING DIRECTORY'), tv.el),
            h('div', { class: 'stack', style: { gap: '10px' } },
              head, q, grid, fb,
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'small muted' }, 'Only your first pick counts; click the others to see where they go.'), nextBtn),
              h('div', { class: 'callout tip m0 small', 'data-label': 'A recipe that always works', html: '1. Write down the working directory and the target as absolute paths. 2. Find the deepest directory the two share. 3. Write one <code>..</code> for each level from the working directory up to it. 4. Add the names from there down to the target.' }))));
          deal();
        },
      },

      /* ---------------- 8. Recap ---------------- */
      {
        title: 'Recap: six things to remember about directories',
        kind: 'recap',
        render(el, ctx) {
          el.append(ctx.h('div', { class: 'stack fill' },
            ctx.h('p', { class: 'lead m0' }, 'Say each answer out loud before you flip the card.'),
            ctx.ui.flipcards([
              ['What is a directory, and who writes it?', 'A file that maps names to files. It belongs to the OS: programs ask the OS to create, delete or rename files and never write the directory directly.'],
              ['The four groups an entry can hold', '<b>Basic</b>: name, type, organization. <b>Address</b>: volume, start, size used, size allocated. <b>Access control</b>: owner, access info, permitted actions. <b>Usage</b>: dates and people for creation, last read, last change, last backup; current usage.'],
              ['Why keep only name + inode number?', 'Small entries fit many to a block, so searches read fewer blocks. Attributes live once, in the inode: writing to a file updates the inode and leaves the directory alone.'],
              ['The five directory operations', 'Search · create file · delete file · list directory · update directory. Create and delete both search first: create to rule out a name clash, delete to find the entry.'],
              ['Single-level, two-level, tree', 'One list for everyone (names clash, no grouping) · a master directory plus one flat directory per user · any directory may hold files and subdirectories: today\'s standard.'],
              ['Absolute vs relative pathname', 'Absolute starts at the root: <code>/ana/school/os/hw1.txt</code>. Relative starts at the working directory: from <code>/ana/school</code>, <code>os/hw1.txt</code>. <code>..</code> = parent, <code>.</code> = here.'],
            ], { cols: 3, height: 226 })));
        },
      },

      /* ---------------- 9. Quiz ---------------- */
      {
        title: 'Check yourself',
        kind: 'check',
        quiz: [
          { q: 'Which of these is <b>not</b> one of the standard operations on a directory?',
            choices: ['Update directory entries', 'Search for a file name', 'Read the data inside a file', 'List directory contents'], answer: 2,
            feedback: ['Updating an entry when an attribute stored in it changes is one of the five directory operations.', 'Searching for the entry that matches a name is the most frequent directory operation of all.', null, 'Listing all (or some) of the entries is one of the five directory operations.'],
            why: 'The five directory operations are search, create file, delete file, list directory and update directory. Reading a file\'s data is an operation on the file itself; the directory is only used to find it.' },
          { type: 'bucket', q: 'Sort each piece of information into the group of directory-entry information it belongs to.', buckets: ['Basic', 'Address', 'Access control', 'Usage'],
            items: [['File type', 0], ['File organization', 0], ['Starting address', 1], ['Size allocated', 1], ['Owner', 2], ['Permitted actions', 2], ['Date of last backup', 3], ['Which processes have it open', 3]],
            why: 'Basic information says what the file is; address information says where its data lives; access control says who may do what; usage information records its history and current activity.' },
          { type: 'tf', q: 'In a UNIX file system, appending data to a file rewrites that file\'s entry in its directory, because the entry records the file\'s size.', answer: false,
            why: 'A UNIX directory entry holds only a name and an inode number. The size and modification time live in the inode, so only the inode is rewritten; the directory changes only when a name is added, removed or renamed.' },
          { q: 'On a system with a two-level directory, users ana and ben each try to create a file named <code>notes.txt</code>. What happens?',
            choices: ['Refused: names must be unique across the whole system', 'Both succeed: names need only be unique per user directory', 'Both succeed, but only if one of them first makes a subdirectory', 'The OS silently renames the second file to notes(1).txt'], answer: 1,
            feedback: ['That rule belongs to a single-level directory, where everyone shares one list.', null, 'A two-level directory has no subdirectories at all; each user directory is a flat list of files.', 'Directories do not rename files on their own; a name is either free in that directory or refused.'],
            why: 'The master directory leads to a separate user directory for each user, and a name only has to be unique within one directory. ana\'s notes.txt and ben\'s notes.txt sit in different directories.' },
          { q: 'A process\'s working directory is <code>/home/kim/web</code>. Which file does the relative pathname <code>../photos/cat.jpg</code> name?',
            choices: ['/home/kim/web/photos/cat.jpg', '/home/photos/cat.jpg', '/photos/cat.jpg', '/home/kim/photos/cat.jpg'], answer: 3,
            feedback: ['That ignores the <code>..</code>, which first moves up one level.', 'That climbs two levels, but the path has only one <code>..</code>.', 'That treats the path as starting at the root, but it has no leading /.', null],
            why: 'Start at /home/kim/web, take <code>..</code> up to /home/kim, then go down into photos and find cat.jpg: /home/kim/photos/cat.jpg.' },
          { type: 'num', q: 'Starting at the root, how many directory searches does the OS make to resolve the absolute pathname <code>/usr/share/dict/words</code>?', answer: 4, tol: 0,
            why: 'One search per name after the root: search / for usr, usr for share, share for dict, and dict for words. That is 4 searches.' },
          { type: 'num', q: 'A two-level directory has 300 user entries in its master directory, and every user directory holds 60 files. Both are searched one entry at a time. On average, how many name comparisons does it take to find a file that exists (every user and file equally likely)?', answer: 181, tol: 0.5,
            why: 'A successful linear search of n entries averages (n + 1) ÷ 2 comparisons. (300 + 1) ÷ 2 + (60 + 1) ÷ 2 = 150.5 + 30.5 = 181. One flat list of all 18,000 files would average 9,000.5.' },
          { type: 'match', q: 'Match each term to its description.',
            pairs: [['Single-level directory', 'One list shared by every user'], ['Two-level directory', 'A master directory plus one flat directory per user'], ['Tree-structured directory', 'Any directory may hold files and subdirectories'], ['Working directory', 'Where a relative pathname starts'], ['Root directory', 'Where every absolute pathname starts']],
            why: 'The three structures add levels step by step; the working directory and the root are the two possible starting points of a path lookup.' },
          { type: 'multi', q: 'Which statements about pathnames are true?',
            choices: ['Two files may share a name if their pathnames differ', 'A relative pathname names the same file whatever the working directory is', '<code>..</code> refers to the parent directory', 'Windows separates names with <code>\\</code>, UNIX with <code>/</code>', 'An absolute pathname in UNIX begins with <code>/</code>'], answer: [0, 2, 3, 4],
            why: 'Names only have to be unique inside one directory, so full pathnames tell same-named files apart. A relative pathname depends on the working directory; an absolute one does not.' },
          { q: 'Why do many file systems keep only a name and a pointer in each directory entry, with the other attributes in a separate header (an inode in UNIX)?',
            choices: ['Small entries: more fit per block, so a search reads fewer blocks', 'It makes every file name unique across the whole disk, not just one directory', 'It lets user programs write directory entries directly, without the OS', 'It removes the need to store access control information for each file'], answer: 0,
            feedback: [null, 'Uniqueness is still only per directory; the layout of the entry does not change that.', 'Directories stay owned by the OS in every layout; programs still ask the OS to change them.', 'The access information is still stored; it simply moved into the header.'],
            why: 'A name plus a number is a few bytes, so a directory block holds many entries and a search reads fewer blocks. The attributes are still kept, once, in the header.' },
          { type: 'order', q: 'The working directory is <code>/ana/school/os</code>. Put the steps of resolving <code>../math/notes.txt</code> in order.',
            items: ['Start at the working directory, /ana/school/os', 'Look up .. and move to the parent, /ana/school', 'Search /ana/school for the name math', 'Search /ana/school/math for the name notes.txt', 'Return the file /ana/school/math/notes.txt'],
            why: 'A relative path starts at the working directory, and the OS handles one name at a time from left to right: .. first, then math, then notes.txt.' },
          { type: 'tf', q: 'In a tree-structured directory, a file and a subdirectory that sit in the same directory cannot have the same name.', answer: true,
            why: 'A lookup searches a directory by name only, so every name in one directory must be unique, whatever kind of entry it is. A second entry with that name would be a name clash.' },
        ],
      },
    ],
    notes: `
      <h3>What a directory is</h3>
      <p>A <b>directory</b> maps each file name to the file itself: its attributes and where its data are stored. Every open by name starts with a directory lookup. A directory is itself a file, stored in disk blocks, but it belongs to the OS: programs may ask to list it and change it only by asking the OS to create, delete or rename files. Because programs use only names, the OS can move a file's data and fix up one entry.</p>

      <h3>What a directory entry can hold</h3>
      <p>A <b>directory entry</b> describes one file or subdirectory. The full list of information a directory could keep falls into four groups:</p>
      <table>
        <tr><th>Group</th><th>Fields</th><th>Purpose</th></tr>
        <tr><td>Basic information</td><td>file name (unique within its directory), file type (text, binary, executable load module, directory, ...), file organization (for systems that offer several, such as pile, sequential, indexed or hashed)</td><td>what the file is</td></tr>
        <tr><td>Address information</td><td>volume (the device or volume holding the file), starting address (first block), size used, size allocated</td><td>where the data live</td></tr>
        <tr><td>Access control information</td><td>owner (usually the creator; grants rights to others), access information (who else may use it: once a name and password per authorized user, now user/group IDs or access control lists), permitted actions (read, write, execute, send over a network)</td><td>who may do what</td></tr>
        <tr><td>Usage information</td><td>date created, identity of creator, date of last read access, identity of last reader, date last modified, identity of last modifier, date of last backup, current usage (which processes have the file open, whether it is locked, whether it was changed in main memory but not yet written to disk)</td><td>history and current activity</td></tr>
      </table>
      <p><b>Worked example.</b> hw1.txt holds 9,500 bytes (size used). With 4,096-byte blocks it needs ⌈9,500 ÷ 4,096⌉ = 3 blocks, so its size allocated is 12,288 bytes and 2,788 bytes of the last block are reserved but empty.</p>
      <p><b>Real systems keep a subset.</b> Classic UNIX stored no creation time ("ctime" means last status change); ext4, NTFS and APFS do. Everyday file systems do not record the last reader or modifier. Current usage changes constantly, so it lives in main-memory tables of open files, not on disk.</p>

      <h3>Two layouts: everything in the entry, or name plus pointer</h3>
      <p>Some systems put every attribute in the entry (an MS-DOS FAT entry is a fixed 32 bytes: name, attribute flags, dates, first cluster, size). Others keep only the <b>name and a pointer</b> and move the rest into a separate <b>file header</b>. In UNIX-like systems the header is the <b>inode</b> (index node): a numbered record holding type, permissions, owner, size, timestamps and block addresses, everything except the name. A directory is then a list of (name, inode number) pairs; in ext4 the entry for hw1.txt is 16 bytes.</p>
      <ul>
        <li>Small entries pack many to a block, so a search reads fewer blocks.</li>
        <li>Writing to a file changes its size and modification time in the inode only; the directory changes only when a name is added, removed or renamed.</li>
        <li>The cost: when attributes are needed (an open, a long listing) the OS must also read the inode.</li>
      </ul>

      <h3>The five directory operations</h3>
      <ol>
        <li><b>Search</b>: find the entry whose name matches. A linear search compares names in order; a failed search must examine every entry.</li>
        <li><b>Create file</b>: search first to make sure the name is free (a duplicate is a <b>name clash</b> and is refused), then add an entry (and, in UNIX, allocate and fill an inode).</li>
        <li><b>Delete file</b>: search for the entry and remove it. In UNIX the inode and its blocks become free once no other entry names that inode and no process still has the file open.</li>
        <li><b>List directory</b>: return all the entries, or part of them.</li>
        <li><b>Update directory</b>: when an attribute stored in an entry changes (size, dates), rewrite that entry.</li>
      </ol>
      <p>Comparing names one by one gets slow in a directory with thousands of entries, so modern file systems index the names instead: ext4 with a hashed tree, NTFS with a B+-tree. Older designs such as FAT still search linearly.</p>

      <h3>Three directory structures</h3>
      <ul>
        <li><b>Single-level</b>: one list holds every file of every user. Simple, but every name must be unique across all users, files cannot be grouped, and a large list is slow.</li>
        <li><b>Two-level</b>: a <b>master directory</b> has one entry per user, leading to that user's own <b>user directory</b>, a flat list of their files. Names need only be unique within one user directory, and the master entry can carry access control. A user still cannot group files.</li>
        <li><b>Tree-structured (hierarchical)</b>: the master directory becomes the <b>root directory</b>; user directories, and any directory below them, may hold files and further <b>subdirectories</b>. Names need only be unique within one directory. This is the structure of essentially every general-purpose OS today.</li>
      </ul>
      <p><b>Search cost at scale.</b> A successful linear search of n equally likely entries averages (n + 1) ÷ 2 comparisons, once per directory searched. With 500 users × 80 files: a single list of 40,000 averages 20,000.5; two levels average (500 + 1) ÷ 2 + (80 + 1) ÷ 2 = 250.5 + 40.5 = 291; a tree in which each user splits 80 files into 8 folders of 10 averages 250.5 + 4.5 + 5.5 = 260.5.</p>

      <h3>Pathnames</h3>
      <pre>/
├── ana/  notes.txt · music/ song.mp3 · school/ (os/ hw1.txt lab2.c notes.txt · math/ notes.txt)
├── ben/  notes.txt · games/ chess.exe
└── chen/ todo.txt</pre>
      <ul>
        <li>A <b>pathname</b> names a file by its route: the directories passed through from the top, then the file name, joined by a <b>path separator</b>: <code>/ana/school/os/hw1.txt</code>. UNIX, Linux and macOS use <code>/</code>; Windows uses <code>\\</code> and begins a full path with a drive letter: <code>C:\\ana\\school\\os\\hw1.txt</code>.</li>
        <li>Two files may share a name if their pathnames differ: the example tree has four notes.txt files and no clash.</li>
        <li>An <b>absolute pathname</b> starts at the root (a leading <code>/</code>), so it names the same file wherever you are.</li>
        <li>Each process has a <b>working (current) directory</b>, changed by a shell's <code>cd</code> and printed by <code>pwd</code>. A <b>relative pathname</b> has no leading <code>/</code> and is read from the working directory: from <code>/ana/school</code>, <code>os/hw1.txt</code> is /ana/school/os/hw1.txt.</li>
        <li><code>.</code> means this directory and <code>..</code> the <b>parent directory</b>. Classic UNIX file systems, and ext4 today, store both as real entries in every directory (the root's <code>..</code> leads back to the root); Windows and some newer file systems handle them while parsing the path instead, with the same meaning.</li>
      </ul>

      <h3>Resolving a path</h3>
      <p>The OS reads a path from left to right and performs one directory search per name, starting at the root for an absolute path and at the working directory for a relative one. From working directory /ana/school:</p>
      <table>
        <tr><th>Path</th><th>Result</th><th>Searches</th></tr>
        <tr><td><code>/ana/school/os/hw1.txt</code></td><td>/ana/school/os/hw1.txt</td><td>4</td></tr>
        <tr><td><code>os/hw1.txt</code></td><td>the same file</td><td>2</td></tr>
        <tr><td><code>../notes.txt</code></td><td>/ana/notes.txt</td><td>2</td></tr>
        <tr><td><code>../../ben/games/chess.exe</code></td><td>/ben/games/chess.exe</td><td>5</td></tr>
        <tr><td><code>/ben/games/chess.exe</code></td><td>the same file</td><td>3</td></tr>
        <tr><td><code>music/song.mp3</code></td><td>error: no entry music in /ana/school</td><td>1</td></tr>
        <tr><td><code>os/hw1.txt/x</code></td><td>error: hw1.txt is not a directory</td><td>2</td></tr>
      </table>
      <p>A working directory gives nearby files short names and fewer searches; for distant files the absolute path can be shorter.</p>

      <h3>Writing a relative path</h3>
      <ol>
        <li>Write the working directory and the target as absolute paths.</li>
        <li>Find the deepest directory they share.</li>
        <li>Write one <code>..</code> for each level from the working directory up to it.</li>
        <li>Add the names from there down to the target.</li>
      </ol>
      <p>Example: from /ana/school/os to /ana/notes.txt, the deepest shared directory is /ana, two levels up, so the path is <code>../../notes.txt</code>.</p>
    `,
  });
})();
