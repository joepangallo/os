/* =====================================================================
   5.6 Message Passing
   Original teaching material. Small helpers shared by several steps live
   inside this IIFE (no globals).
   ===================================================================== */
(function () {
  /* ---------- shared SVG helpers ---------- */
  // a small envelope icon centred on (x, y); cls picks the colour family
  function envelope(s, x, y, label, cls, w = 36, h = 24) {
    return s('g', { class: 'env' },
      s('rect', { x: x - w / 2, y: y - h / 2, width: w, height: h, rx: 4, class: cls || 's-mem', 'stroke-width': 2 }),
      s('path', { d: `M${x - w / 2 + 2} ${y - h / 2 + 2} L${x} ${y + 2} L${x + w / 2 - 2} ${y - h / 2 + 2}`, class: 's-muted', 'stroke-width': 1.5 }),
      label ? s('text', { x, y: y + h / 2 + 15, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 }, label) : null);
  }
  // a labelled rounded box (process, mailbox, CPU ...)
  function box(s, x, y, w, h, title, cls, sub, subCls) {
    return s('g', {},
      s('rect', { x, y, width: w, height: h, rx: 10, class: cls || 's-panel', 'stroke-width': 2 }),
      s('text', { x: x + w / 2, y: y + (sub ? h / 2 - 3 : h / 2 + 6), 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 16 }, title),
      sub ? s('text', { x: x + w / 2, y: y + h / 2 + 16, 'text-anchor': 'middle', 'font-size': 13, class: subCls || 's-sub' }, sub) : null);
  }
  // straight-line interpolation along a polyline, p in [0, 1]
  function along(pts, p) {
    const seg = [];
    let total = 0;
    for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(d); total += d; }
    let want = Math.max(0, Math.min(1, p)) * total;
    for (let i = 0; i < seg.length; i++) {
      if (want <= seg[i] || i === seg.length - 1) { const f = seg[i] ? Math.min(1, want / seg[i]) : 1; return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f]; }
      want -= seg[i];
    }
    return pts[pts.length - 1];
  }
  // a process box with a name and up to two short status lines (used by step 5)
  function pbox(s, x, y, name, l1, l2, cls, l2cls) {
    return s('g', {},
      s('rect', { x, y, width: 104, height: 60, rx: 10, class: cls || 's-proc', 'stroke-width': 2 }),
      s('text', { x: x + 52, y: y + 22, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 16 }, name),
      l1 ? s('text', { x: x + 52, y: y + 39, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, l1) : null,
      l2 ? s('text', { x: x + 52, y: y + 54, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, style: l2cls ? `fill:var(--${l2cls})` : '' }, l2) : null);
  }
  // a code listing with a plain-language comment on every line. Wide screens: comment to the right
  // of the code. Phones: each comment sits on its own line just above its code, so nothing scrolls
  // sideways. mark(n) always takes the row number of the listing and highlights the right lines.
  function listing(ctx, rows, o) {
    if (!ctx.narrow) {
      const w = Math.max(...rows.map((r) => r[0].length)) + 1;
      return ctx.ui.code(rows.map(([c, k]) => (k ? c.padEnd(w) + '// ' + k : c)).join('\n'), o);
    }
    const lines = [], map = [];
    rows.forEach(([c, k]) => {
      const own = [];
      if (k) { lines.push(c.match(/^\s*/)[0] + '// ' + k); own.push(lines.length); }
      lines.push(c); own.push(lines.length);
      map.push(own);
    });
    const pre = ctx.ui.code(lines.join('\n'), o);
    const mark0 = pre.mark;
    pre.mark = (nums, cls) => mark0([].concat(nums == null ? [] : nums).flatMap((n) => map[n - 1] || []), cls);
    return pre;
  }
  const YS = (n) => (n === 1 ? [96] : [12, 96, 180]);        // box tops for 1 or 3 processes
  const nm = (base, n, i) => (n === 1 ? base : base + (i + 1)); // 'S' or 'S1'..'S3'

  /* ---------- step 5, tab 1: direct vs indirect across the four patterns ---------- */
  function addressingTab(panel, ctx) {
    const { h, s } = ctx;
    const PATS = {
      '11': { ns: 1, nr: 1, mb: 'A', big: 'A', sub: 'mailbox', use: '<b>One-to-one:</b> a private link between two processes, such as two stages of a pipeline. It can be set up once and never change.' },
      'n1': { ns: 3, nr: 1, mb: 'portR', big: 'port of R', sub: 'mailbox', use: '<b>Many-to-one:</b> client/server. Many clients send requests to one server. With a mailbox, this is usually a <span class="t">port</span> that the server creates and owns.' },
      '1n': { ns: 1, nr: 3, mb: 'G', big: 'G', sub: 'group mailbox', use: '<b>One-to-many:</b> broadcast. One sender informs a whole group (“shutting down in 5 minutes”). One send to a group mailbox gives every member its own copy.' },
      'nn': { ns: 3, nr: 3, mb: 'A', big: 'A', sub: 'shared mailbox', use: '<b>Many-to-many:</b> a pool of servers sharing the work. Any client sends to the shared mailbox and whichever server asks first gets the next request.' },
    };
    let mode = 'ind', pat = 'n1', impl = true, st, anim = null;
    const P = () => PATS[pat];
    const YA = (n) => (n === 1 ? [74] : [4, 74, 144]); // compact rows: box tops for 1 or 3 processes
    const XA = (n) => (n === 1 ? [128] : [8, 128, 248]); // phones: box lefts for 1 or 3 processes in a row
    // geometry: senders | mailbox | receivers left to right, or (phones) top to bottom so the text stays readable
    const G = !ctx.narrow ? {
      vb: '0 0 640 208', sBox: (n, i) => [14, YA(n)[i]], rBox: (n, j) => [522, YA(n)[j]],
      sOut: (n, i) => [118, YA(n)[i] + 30], rIn: (n, j) => [522, YA(n)[j] + 30], rNear: (n, j) => [490, YA(n)[j] + 30],
      mb: [262, 70, 116, 68], mbIn: [262, 104], mbOut: [378, 104], title: [320, 101], sub: [320, 121], own: [[320, 158, 'middle', 'created and owned by R']],
    } : {
      vb: '0 0 360 300', sBox: (n, i) => [XA(n)[i], 4], rBox: (n, j) => [XA(n)[j], 236],
      sOut: (n, i) => [XA(n)[i] + 52, 64], rIn: (n, j) => [XA(n)[j] + 52, 236], rNear: (n, j) => [XA(n)[j] + 52, 212],
      mb: [122, 118, 116, 64], mbIn: [180, 118], mbOut: [180, 182], title: [180, 146], sub: [180, 166], own: [[246, 146, 'start', 'created and'], [246, 162, 'start', 'owned by R']],
    };
    const svg = s('svg', { viewBox: G.vb, width: '100%', role: 'img', 'aria-label': 'Senders, receivers and the route each message takes' });
    const fly = s('g', {});
    const calls = h('table', { class: 'tbl compact', style: { fontSize: '13.5px' } });
    const chip = h('span', { class: 'chip os' });
    const callsHead = h('h4', { class: 'm0' });
    const narr = h('div', { class: 'narr' });
    const use = h('div', { class: 'callout why m0 small', 'data-label': 'Where this pattern fits' });
    const sendRow = h('div', { class: 'row gap-s' });
    const fresh = () => { st = { k: 0, sends: 0, sent: [0, 0, 0], got: [0, 0, 0], last: [null, null, null], held: [0, 0, 0] }; };
    // in explicit direct mode each receiver names one sender: S (or S1) for a single receiver, S1..S3 in pairs for many-to-many
    const want = (j) => (P().ns === 1 || P().nr === 1 ? 0 : j);
    const dash = (a, b) => s('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: 's-muted', 'stroke-dasharray': '5 5' });
    const idx = (n) => (n === 1 ? [0] : [0, 1, 2]);
    function draw() {
      const { ns, nr } = P();
      const K = [];
      if (mode === 'dir') {
        idx(ns).forEach((i) => idx(nr).forEach((j) => K.push(dash(G.sOut(ns, i), G.rIn(nr, j)))));
      } else {
        idx(ns).forEach((i) => K.push(dash(G.sOut(ns, i), G.mbIn)));
        idx(nr).forEach((j) => K.push(dash(G.mbOut, G.rIn(nr, j))));
        const [mx, my, mw, mh] = G.mb;
        K.push(s('rect', { x: mx, y: my, width: mw, height: mh, rx: 12, class: 's-mem', 'stroke-width': 2.5 }));
        K.push(s('text', { x: G.title[0], y: G.title[1], 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 16 }, P().big));
        K.push(s('text', { x: G.sub[0], y: G.sub[1], 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, P().sub));
        if (pat === 'n1') G.own.forEach(([x, y, anchor, t]) => K.push(s('text', { x, y, 'text-anchor': anchor, 'font-size': 13, 'font-weight': 700, style: 'fill:var(--os)' }, t)));
      }
      idx(ns).forEach((i) => { const [x, y] = G.sBox(ns, i); K.push(pbox(s, x, y, nm('S', ns, i), 'sender', `sent ${st.sent[i]}`)); });
      idx(nr).forEach((j) => {
        const [x, y] = G.rBox(nr, j);
        const l2 = st.held[j] ? `${st.held[j]} not accepted` : st.last[j] || `got ${st.got[j]}`;
        K.push(pbox(s, x, y, nm('R', nr, j), st.last[j] ? `got ${st.got[j]}` : 'receiver', l2, null, st.held[j] ? 'bad' : null));
      });
      K.push(fly);
      svg.replaceChildren(...K);
      chip.textContent = `send calls so far: ${st.sends}`;
      use.innerHTML = P().use;
      sendRow.replaceChildren(h('span', { class: 'lbl' }, 'Send a message from'),
        ...YA(ns).map((_, i) => h('button', { class: 'btn sm primary', type: 'button', onclick: () => send(i) }, nm('S', ns, i))),
        h('div', { class: 'grow' }), h('button', { class: 'btn sm', type: 'button', onclick: restart }, 'Reset'));
    }
    const deliver = (j, i, id) => { st.got[j] += 1; st.last[j] = `${id} from ${nm('S', P().ns, i)}`; };
    function send(i) {
      const { ns, nr, mb } = P();
      st.k += 1; st.sent[i] += 1;
      const id = 'm' + st.k, S = nm('S', ns, i);
      const targets = pat === '1n' ? [0, 1, 2] : pat === 'nn' ? [(st.k - 1) % 3] : [0];
      const Rn = (j) => nm('R', nr, j);
      const rows = [], paths = [];
      let msg, tone = 'ok';
      if (mode === 'ind') {
        st.sends += 1;
        rows.push([S, `send(${mb}, ${id})`, 'names the mailbox, not a process']);
        targets.forEach((j) => { deliver(j, i, id); paths.push({ pts: [G.sOut(ns, i), G.mbIn, G.mbOut, G.rIn(nr, j)], cls: 's-ok' }); });
        rows.push([targets.length > 1 ? 'R1–R3' : Rn(targets[0]), `receive(${mb}, msg)`, targets.length > 1 ? 'each member takes its own copy' : `takes ${id} out of the mailbox`]);
        const R = Rn(targets[0]);
        msg = { '11': `${S} puts ${id} in mailbox A and R takes it out. Neither names the other; they share only the mailbox's name, so either side could be swapped for another process.`,
          'n1': `${S} sends ${id} to R's port. Every client uses the same port name, and R simply receives whatever arrives next, from any client.`,
          '1n': `<b>One send</b> to group G, and R1, R2 and R3 each get their own copy. The sender does not even need to know who is in the group.`,
          'nn': `${S} sends ${id} to the shared mailbox. ${R} asked first this time, so ${R} takes it. Senders never choose a server; a free server takes the next request.` }[pat];
      } else {
        targets.forEach((j) => { st.sends += 1; rows.push([S, `send(${Rn(j)}, ${id})`, targets.length > 1 ? 'one send per receiver' : 'names the receiving process']); });
        const out = targets.map((j) => {
          const ok = impl || want(j) === i;
          if (ok) deliver(j, i, id); else st.held[j] += 1;
          paths.push({ pts: [G.sOut(ns, i), ok ? G.rIn(nr, j) : G.rNear(nr, j)], cls: ok ? 's-ok' : 's-bad' });
          return ok;
        });
        const j0 = targets[0], R = Rn(j0), W = nm('S', ns, want(j0));
        if (targets.length > 1) rows.push(['R1–R3', impl ? 'receive(src, msg)' : 'receive(S, msg)', 'each gets its own copy']);
        else rows.push([R, impl ? 'receive(src, msg)' : `receive(${W}, msg)`, impl ? `gets ${id} and sets src = ${S}` : out[0] ? `names ${W}, so it gets ${id}` : `names ${W} only: ${id} is not accepted`]);
        if (pat === '1n') { msg = 'There is no way to name a group directly, so S makes <b>three separate sends</b> and must know every receiver\'s ID. Compare the single send with a group mailbox.'; tone = 'warn'; }
        else if (!out[0]) { msg = `${S} names ${R}, but ${R}'s receive asks for ${W} only, so <b>${id} is not accepted</b> and keeps waiting. A server cannot list every client in advance: that is why servers use implicit addressing.`; tone = 'bad'; }
        else msg = { '11': impl ? `${S} names R. R's receive leaves the source open (<b>implicit</b>), accepts ${id} and learns afterward that it came from S.` : `${S} names R and R names S (<b>explicit</b>). The link joins exactly this pair, and each side must know the other's ID in advance.`,
          'n1': impl ? `${S} names R. R accepts <b>any</b> sender and its source parameter comes back as ${S}, so R knows whom to reply to. This is how a server works with direct addressing.` : `${S} names R, and R is asking for S1's messages, so ${id} is delivered. Now try sending from S2.`,
          'nn': `${S} must <b>pick one receiver by name</b> and chose ${R}. The sender, not the system, decides who does the work, even if another receiver is idle.` }[pat];
      }
      calls.replaceChildren(h('tr', {}, h('th', {}, 'Who'), h('th', {}, 'Call'), h('th', {}, 'What it says')),
        ...rows.map(([w, c, m]) => h('tr', {}, h('td', { class: 'b' }, w), h('td', {}, h('code', {}, c)), h('td', {}, m))));
      callsHead.textContent = 'The calls just made';
      narr.className = 'narr ' + tone; narr.innerHTML = msg;
      draw();
      animate(paths);
    }
    function animate(paths) {
      if (anim) anim();
      const t0 = performance.now();
      anim = ctx.raf((t) => {
        const p = Math.min(1, (t - t0) / 850);
        fly.replaceChildren(...paths.map(({ pts, cls }) => { const [x, y] = along(pts, p); return s('g', { transform: `translate(${x.toFixed(1)} ${y.toFixed(1)})` }, envelope(s, 0, 0, null, cls, 30, 20)); }));
        if (p >= 1) { anim = null; if (paths.every((q) => q.cls === 's-ok')) fly.replaceChildren(); return false; }
        return true;
      });
    }
    function restart() {
      if (anim) { anim(); anim = null; }
      fly.replaceChildren(); fresh();
      const { ns, nr, mb } = P();
      const Ss = ns === 1 ? 'S' : 'S1–S3', Rs = nr === 1 ? 'R' : 'R1–R3';
      const tmpl = mode === 'ind'
        ? [[Ss, `send(${mb}, m)`, 'names the mailbox, not a process'], [Rs, `receive(${mb}, msg)`, 'takes the next message out']]
        : [[Ss, `send(${nr === 1 ? 'R' : 'Rj'}, m)`, 'names the receiving process'], [Rs, impl ? 'receive(src, msg)' : `receive(${ns === 1 ? 'S' : nr === 1 ? 'S1' : 'Sj'}, msg)`, impl ? 'accepts anyone; src says who sent it' : 'accepts only the named sender']];
      calls.replaceChildren(h('tr', {}, h('th', {}, 'Who'), h('th', {}, 'Call'), h('th', {}, 'What it says')),
        ...tmpl.map(([w, c, m]) => h('tr', {}, h('td', { class: 'b' }, w), h('td', {}, h('code', {}, c)), h('td', {}, m))));
      callsHead.textContent = 'The calls each side will make';
      narr.className = 'narr'; narr.innerHTML = mode === 'ind' ? 'With <span class="t">indirect addressing</span>, messages go <b>to a <span class="t">mailbox</span></b>, not to a process. Press a send button and follow the route.' : 'With <span class="t">direct addressing</span>, each send <b>names the receiving process</b>. Press a send button and read the exact calls on both sides.';
      rsRow.style.opacity = mode === 'dir' ? '1' : '.35';
      rsRow.style.pointerEvents = mode === 'dir' ? '' : 'none';
      glance.querySelectorAll('td:nth-child(2), th:nth-child(2)').forEach((c) => { c.style.background = mode === 'dir' ? 'var(--accent-bg)' : ''; });
      glance.querySelectorAll('td:nth-child(3), th:nth-child(3)').forEach((c) => { c.style.background = mode === 'ind' ? 'var(--accent-bg)' : ''; });
      draw();
    }
    const nw = (seg) => { if (!ctx.narrow) seg.style.flexWrap = 'nowrap'; return seg; };
    const ctlRow = (label, ...kids) => h('div', { class: 'row' + (ctx.narrow ? '' : ' nw'), style: { gap: '10px' } }, h('span', { class: 'lbl', style: { width: '84px' } }, label), ...kids);
    const modeSeg = nw(ctx.ui.seg([{ value: 'dir', label: 'Direct' }, { value: 'ind', label: 'Indirect (mailbox)' }], mode, (v) => { mode = v; restart(); }));
    const rsRow = ctlRow('receive', nw(ctx.ui.seg([{ value: 0, label: 'names one sender (explicit)' }, { value: 1, label: 'accepts anyone (implicit)' }], 1, (v) => { impl = !!v; restart(); })));
    const patSeg = nw(ctx.ui.seg(Object.keys(PATS).map((k) => ({ value: k, label: { '11': 'One-to-one', 'n1': 'Many-to-one', '1n': 'One-to-many', 'nn': 'Many-to-many' }[k] })), pat, (v) => { pat = v; restart(); }));
    const glance = h('table', { class: 'tbl compact', style: { fontSize: '13.5px' }, html:
      '<tr><th style="width:30%">At a glance</th><th>Direct</th><th>Indirect</th></tr>' +
      '<tr><td class="b">send names</td><td>a process</td><td>a mailbox</td></tr>' +
      '<tr><td class="b">receive names</td><td>a process, or anyone (<span class="t" data-t="Implicit addressing">implicit</span>)</td><td>the mailbox</td></tr>' +
      '<tr><td class="b">must know</td><td>the partner\'s ID</td><td>only the mailbox name</td></tr>' });
    const left = h('div', { class: 'stack', style: { gap: '8px' } },
      ctlRow('Addressing', modeSeg), rsRow, ctlRow('Pattern', patSeg),
      h('div', { class: 'card white grow', style: { padding: '6px 8px', display: 'grid', alignItems: 'center' } }, svg), sendRow, use);
    const right = h('div', { class: 'stack', style: { gap: '8px' } },
      h('div', { class: 'row', style: { justifyContent: 'space-between' } }, callsHead, chip), calls, narr, h('div', { class: 'grow' }),
      h('div', { class: 'small', html: '<b>Try this:</b> Direct + many-to-one + “names one sender”, then send from S2. Next compare the <b>send calls</b> count for one-to-many, direct vs indirect.' }), glance);
    panel.append(h('div', { class: 'split r fill', style: { gap: '18px' } }, left, right));
    fresh(); restart();
    return () => { if (anim) anim(); };
  }

  /* ---------- step 5, tab 2: binding (static/dynamic) and ownership of a mailbox ---------- */
  function ownershipTab(panel, ctx) {
    const { h, s } = ctx;
    let owner = 'port', bind = 'dyn', st;
    const OWN = {
      port: { label: 'Receiver R (a port)', who: 'R', row: 0 },
      creator: { label: 'Its creator, S1', who: 'S1', row: 1 },
      os: { label: 'The OS', who: 'OS', row: 2 },
    };
    // geometry: wide = senders left, mailbox centre, R right; phones = senders on top, mailbox, R below
    const G = !ctx.narrow ? {
      vb: '0 0 640 252', sBox: (i) => [14, YS(3)[i]], sOut: (i) => [118, YS(3)[i] + 30], sTag: (i) => [120, YS(3)[i] - 2],
      mb: [262, 92, 116, 68], mbIn: [262, 126], mbOut: [378, 126], rBox: [522, 96], rIn: [522, 126], rTag: [534, 72],
      os: [160, 200, 320, 40], osLine: [320, 162, 320, 198], osText: [[320, 225, 'Operating system: owner']],
    } : {
      vb: '0 0 360 316', sBox: (i) => [[8, 128, 248][i], 26], sOut: (i) => [[8, 128, 248][i] + 52, 86], sTag: (i) => [[8, 128, 248][i] + 25, 4],
      mb: [122, 128, 116, 68], mbIn: [180, 128], mbOut: [180, 196], rBox: [128, 250], rIn: [180, 250], rTag: [240, 271],
      os: [250, 136, 104, 52], osLine: [238, 162, 250, 162], osText: [[302, 158, 'OS'], [302, 176, 'owner']],
    };
    const svg = s('svg', { viewBox: G.vb, width: '100%', role: 'img', 'aria-label': 'Three senders, a mailbox and a receiver, with the owner marked' });
    // room for three lines, the longest message here, so the panel below never jumps as messages change
    const narr = h('div', { class: 'narr', style: { minHeight: '86px' } });
    const bindNote = h('div', { class: 'callout m0 small' });
    const tbl = h('table', { class: 'tbl compact', style: { fontSize: '13.5px' } });
    const say = (html, tone) => { narr.className = 'narr' + (tone ? ' ' + tone : ''); narr.innerHTML = html; };
    const fresh = () => { st = { alive: { S1: true, S2: true, S3: true, R: true }, conn: { S1: true, S2: true, S3: false }, mb: true, q: 0 }; };
    function draw() {
      const K = [];
      const who = OWN[owner].who;
      const [mx, my, mw, mh] = G.mb, mcx = mx + mw / 2;
      const ln = (a, b, on) => s('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: on ? 's-line' : 's-muted', 'stroke-dasharray': on ? null : '5 5', style: on ? 'stroke:var(--mem)' : '' });
      ['S1', 'S2', 'S3'].forEach((p, i) => { if (st.mb && st.alive[p]) K.push(ln(G.sOut(i), G.mbIn, st.conn[p])); });
      if (st.mb && st.alive.R) K.push(ln(G.mbOut, G.rIn, true));
      if (st.mb) {
        K.push(s('rect', { x: mx, y: my, width: mw, height: mh, rx: 12, class: 's-mem', 'stroke-width': 2.5 }));
        K.push(s('text', { x: mcx, y: my + 24, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 15 }, owner === 'port' ? 'port of R' : 'mailbox A'));
        if (!st.q) K.push(s('text', { x: mcx, y: my + 52, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, 'empty'));
        for (let k = 0; k < Math.min(st.q, 4); k++) K.push(envelope(s, mx + 22 + k * 24, my + 46, null, 's-panel', 20, 14));
        if (st.q > 4) K.push(s('text', { x: mx + 110, y: my + 62, 'text-anchor': 'end', 'font-size': 12, 'font-weight': 800 }, '+' + (st.q - 4)));
      } else {
        K.push(s('rect', { x: mx, y: my, width: mw, height: mh, rx: 12, class: 's-bad', 'stroke-dasharray': '6 5', 'stroke-width': 2 }));
        K.push(s('text', { x: mcx, y: my + 39, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 14, style: 'fill:var(--bad)' }, 'destroyed'));
      }
      const tag = ([x, y]) => K.push(s('rect', { x, y, width: 54, height: 18, rx: 9, class: 's-os', 'stroke-width': 1.5 }), s('text', { x: x + 27, y: y + 13, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 800, style: 'fill:var(--os)' }, 'owner'));
      ['S1', 'S2', 'S3'].forEach((p, i) => {
        const [x, y] = G.sBox(i);
        K.push(pbox(s, x, y, p, st.alive[p] ? 'sender' : 'ended', st.alive[p] ? (st.conn[p] ? 'connected' : 'not connected') : '', st.alive[p] ? 's-proc' : 's-bad', st.conn[p] ? 'mem' : null));
        if (who === p) tag(G.sTag(i));
      });
      K.push(pbox(s, G.rBox[0], G.rBox[1], 'R', st.alive.R ? 'receiver' : 'ended', '', st.alive.R ? 's-proc' : 's-bad'));
      if (who === 'R') tag(G.rTag);
      if (who === 'OS') {
        const [ox, oy, ow, oh] = G.os, [x1, y1, x2, y2] = G.osLine;
        K.push(s('rect', { x: ox, y: oy, width: ow, height: oh, rx: 10, class: 's-os', 'stroke-width': 2 }));
        G.osText.forEach(([x, y, t]) => K.push(s('text', { x, y, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800 }, t)));
        K.push(s('line', { x1, y1, x2, y2, class: 's-line', 'stroke-dasharray': '4 4', style: 'stroke:var(--os)' }));
      }
      svg.replaceChildren(...K);
      // buttons
      b.s1.disabled = !st.alive.S1; b.s3.disabled = !st.alive.S3;
      b.conn.disabled = bind === 'static' || !st.alive.S3 || !st.mb;
      b.conn.textContent = st.conn.S3 ? 'S3 disconnects' : 'S3 connects';
      b.recv.disabled = !st.alive.R;
      b.endR.textContent = st.alive.R ? 'End R' : 'Start a new R';
      b.endS1.disabled = !st.alive.S1;
      b.del.disabled = !st.mb;
      tbl.querySelectorAll('tr').forEach((tr, i) => tr.classList.toggle('on', i - 1 === OWN[owner].row));
      bindNote.className = 'callout m0 small ' + (bind === 'static' ? 'warn' : 'tip');
      bindNote.setAttribute('data-label', bind === 'static' ? 'Static association' : 'Dynamic association');
      bindNote.innerHTML = bind === 'static'
        ? 'With <span class="t" data-t="Dynamic association">static association</span> the link is fixed when the mailbox is set up: S1 and S2 are attached for good, and S3 can never join. Simple and cheap, and typical of a permanent one-to-one link.'
        : 'With <span class="t">dynamic association</span>, processes attach and detach while the system runs, using <code>connect</code> and <code>disconnect</code>. Needed when senders come and go, as with the many clients of a server.';
    }
    function sendFrom(p) {
      if (!st.mb) return say(`${p}'s send <b>fails with an error</b>: the mailbox no longer exists, so there is nowhere to deliver the message.`, 'bad'), draw();
      if (!st.conn[p]) return say(`${p} is <b>not connected</b> to this mailbox, so its send is refused.${bind === 'dyn' ? ' Press “S3 connects” first.' : ' With static association it can never join.'}`, 'warn'), draw();
      st.q += 1;
      say(`${p} sends a message. It waits in the mailbox until R receives it (${st.q} waiting).${st.alive.R ? '' : ' R has ended, so for now nobody is listening.'}`);
      draw();
    }
    function recv() {
      if (!st.mb) say('R\'s receive fails: the mailbox is gone.', 'bad');
      else if (!st.q) say('The mailbox is empty, so R\'s blocking receive would put R to sleep until a message arrives.');
      else { st.q -= 1; say(`R receives one message (${st.q} still waiting).`, 'ok'); }
      draw();
    }
    function endR() {
      if (!st.alive.R) {
        st.alive.R = true;
        say(st.mb ? `A new receiver starts and attaches to the <b>surviving</b> mailbox. ${st.q ? `The ${st.q} message${st.q > 1 ? 's' : ''} that piled up ${st.q > 1 ? 'are' : 'is'} still there, ready to receive.` : 'Nothing was lost.'}` : 'A new R starts, but the old mailbox is gone. The new R must create a new one, and every sender must learn its name again.', st.mb ? 'ok' : 'warn');
        return draw();
      }
      st.alive.R = false;
      if (owner === 'port' && st.mb) { st.mb = false; st.q = 0; say('R has ended. R <b>owned</b> the port, so the OS destroys the port with it, and any queued messages are thrown away. From now on, sends to it fail.', 'bad'); }
      else say(`R has ended, but R did not own the mailbox, so the mailbox <b>survives</b>. Messages can still be sent and simply wait until a new receiver comes along.`, 'warn');
      draw();
    }
    function endS1() {
      st.alive.S1 = false; st.conn.S1 = false;
      if (owner === 'creator' && st.mb) { st.mb = false; st.q = 0; say('S1 created the mailbox, so it <b>owned</b> it. When S1 ends, the mailbox is destroyed, even though S2, S3 and R still wanted it.', 'bad'); }
      else say('S1 has ended. It did not own the mailbox, so nothing else changes: the other processes carry on.');
      draw();
    }
    function destroy() {
      st.mb = false; st.q = 0;
      say(owner === 'os' ? 'An explicit <b>destroy</b> call removes the mailbox. Because the OS owns it, this is the only way it ever goes away: no process ending would do it.' : `The owner (${OWN[owner].who}) may destroy it explicitly at any time. Otherwise it disappears automatically when ${OWN[owner].who} ends.`, 'warn');
      draw();
    }
    function toggleConn() {
      st.conn.S3 = !st.conn.S3;
      say(st.conn.S3 ? '<code>connect</code>: S3 joins the mailbox while everything keeps running. It can send from now on.' : '<code>disconnect</code>: S3 leaves. The mailbox and everyone else are unaffected.', 'ok');
      draw();
    }
    const B = (label, fn, cls) => h('button', { class: 'btn sm ' + (cls || ''), type: 'button', onclick: fn }, label);
    const b = { s1: B('S1 sends', () => sendFrom('S1'), 'primary'), s3: B('S3 sends', () => sendFrom('S3'), 'primary'), conn: B('S3 connects', toggleConn), recv: B('R receives', recv, 'primary'),
      endR: B('End R', endR, 'danger'), endS1: B('End S1', endS1, 'danger'), del: B('Destroy mailbox', destroy) };
    function restart(msg) { fresh(); say(msg || 'Pick who owns the <span class="t">mailbox</span> (a <span class="t">port</span> is owned by its receiver), then end processes and see whether the mailbox survives.'); draw(); }
    tbl.append(h('tr', {}, h('th', {}, 'Owner'), h('th', {}, 'It is destroyed when')),
      h('tr', {}, h('td', { class: 'b' }, 'Receiving process (a port)'), h('td', {}, 'that receiver ends')),
      h('tr', {}, h('td', { class: 'b' }, 'The process that created it'), h('td', {}, 'its creator ends')),
      h('tr', {}, h('td', { class: 'b' }, 'The operating system'), h('td', {}, 'someone explicitly destroys it')));
    const nw = (seg) => { if (!ctx.narrow) seg.style.flexWrap = 'nowrap'; return seg; };
    const ownSeg = ctx.ui.seg(Object.keys(OWN).map((k) => ({ value: k, label: OWN[k].label })), owner, (v) => { owner = v; restart(`New owner: <b>${OWN[v].label}</b>. Fresh start.`); });
    const bindSeg = ctx.ui.seg([{ value: 'static', label: 'Static' }, { value: 'dyn', label: 'Dynamic' }], bind, (v) => { bind = v; restart(`${v === 'static' ? 'Static' : 'Dynamic'} association. Fresh start.`); });
    const left = h('div', { class: 'stack', style: { gap: '8px' } },
      h('div', { class: 'row nw', style: { gap: '10px' } }, h('span', { class: 'lbl', style: { width: '84px' } }, 'Owner'), nw(ownSeg)),
      h('div', { class: 'row nw', style: { gap: '10px' } }, h('span', { class: 'lbl', style: { width: '84px' } }, 'Association'), nw(bindSeg)),
      h('div', { class: 'card white grow', style: { padding: '6px 8px', display: 'grid', alignItems: 'center' } }, svg),
      h('div', { class: 'row gap-s' }, h('span', { class: 'lbl', style: { width: '84px' } }, 'Messages'), b.s1, b.s3, b.recv, b.conn),
      h('div', { class: 'row gap-s' }, h('span', { class: 'lbl', style: { width: '84px' } }, 'Lifecycle'), b.endS1, b.endR, b.del));
    const tryIt = h('ol', { class: 'small m0', style: { paddingLeft: '20px', lineHeight: 1.4 }, html:
      '<li>Owner = R: send twice, then <b>End R</b>. Where did the messages go?</li>' +
      '<li>Owner = OS: do the same, then <b>Start a new R</b> and receive.</li>' +
      '<li>Switch to <b>Static</b> and try to let S3 join.</li>' });
    // Reset sits in the heading row, so a long message can never push it off the slide
    const right = h('div', { class: 'stack', style: { gap: '8px' } },
      h('div', { class: 'row nw', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'What just happened'), h('button', { class: 'btn sm', type: 'button', onclick: () => restart() }, 'Reset')),
      narr, tbl, h('h4', { class: 'm0' }, 'Try this'), tryIt, h('div', { class: 'grow' }), bindNote);
    panel.append(h('div', { class: 'split r fill', style: { gap: '18px' } }, left, right));
    restart();
  }

  Guide.section({
    id: '5.6',
    title: 'Message Passing',
    short: 'Message passing',
    summary: 'Processes cooperate by sending and receiving messages, which carry data and make the receiver wait.',
    objectives: [
      'Explain how send and receive give processes both synchronization and communication, on one machine or many.',
      'Predict who blocks under each mix of blocking and nonblocking send and receive, and name the risk of each.',
      'Compare direct and indirect addressing, the four sender/receiver patterns, and how mailboxes and ports are bound and owned.',
      'Describe the header and body of a message and choose a queuing discipline for a mailbox.',
      'Use messages to enforce mutual exclusion and to solve the bounded-buffer producer/consumer problem.',
    ],
    terms: [
      ['Message passing', 'Cooperation in which processes hand each other information by calling send and receive instead of sharing variables. Because a receiver can wait for a message, the same calls also synchronize the processes.'],
      ['Message', 'A packet of information passed from one process to another: a header that describes it plus a body that holds the actual contents.'],
      ['Send primitive', 'send(destination, message): hands a message to a named process or mailbox.'],
      ['Receive primitive', 'receive(source, message): collects a message from a named process or mailbox and stores it in the caller\'s message variable.'],
      ['Blocking send', 'A send after which the sending process is suspended until its message has been received.'],
      ['Nonblocking send', 'A send that returns at once; the sender keeps running while its message waits to be received.'],
      ['Blocking receive', 'A receive that suspends the caller until a message is available, then returns with it.'],
      ['Nonblocking receive', 'A receive that returns at once: with a message if one is waiting, otherwise with a “no message” result. The caller continues either way.'],
      ['Test for arrival', 'A check that reports whether a message is waiting, without taking it and without blocking, so the process can decide whether to call receive.'],
      ['Rendezvous', 'The meeting that happens when send and receive are both blocking: whichever process arrives first waits, and the message passes when both are present.'],
      ['Receive timeout', 'A time limit placed on a blocking receive: if no message arrives in time, the call gives up and returns an error instead of waiting forever.'],
      ['Direct addressing', 'Naming a specific process: send gives the destination process\'s ID, and receive either names the expected sender or accepts any sender.'],
      ['Implicit addressing', 'A receive that does not name a sender. It accepts a message from any process and fills in the source parameter with the sender\'s ID when it completes.'],
      ['Indirect addressing', 'Sending to a shared mailbox instead of to a process. Receivers take messages from the mailbox, so senders and receivers do not need to know each other.'],
      ['Mailbox', 'A queue of messages kept as a shared data structure. Senders put messages in; receivers take them out.'],
      ['Port', 'A mailbox tied to one receiving process, usually created and owned by it, that many senders can use. It is destroyed when its owner ends.'],
      ['Dynamic association', 'Linking processes to a mailbox while the system runs, with connect and disconnect calls, so senders can come and go. Its opposite, static association, fixes the link once and for all when the mailbox is set up.'],
      ['Message header', 'The descriptive part of a message: message type, destination ID, source ID, message length and control information such as a sequence number or priority.'],
      ['Queuing discipline', 'The rule that picks which waiting message a receiver gets next: first-in-first-out by default, or by priority, or by the receiver\'s own choice.'],
      ['Bounded buffer', 'A buffer with a fixed number of slots; a producer must wait when all slots are full and a consumer must wait when all are empty.'],
    ],
    css: `
      .sec-5-6 .narr { background: var(--panel-2); border: 1px solid var(--line); border-left: 5px solid var(--chc); border-radius: 12px; padding: 9px 13px; font-size: 15px; line-height: 1.45; }
      .sec-5-6 .narr.ok { border-left-color: var(--ok); background: var(--ok-bg); }
      .sec-5-6 .narr.bad { border-left-color: var(--bad); background: var(--bad-bg); }
      .sec-5-6 .narr.warn { border-left-color: var(--warn); background: var(--warn-bg); }
      .sec-5-6 .lbl { font-size: 14px; font-weight: 700; color: var(--ink-2); white-space: nowrap; }
      .sec-5-6 .missions { list-style: none; padding-left: 0 !important; margin: 0 !important; }
      .sec-5-6 .missions li { display: flex; gap: 8px; align-items: flex-start; font-size: 14.5px; line-height: 1.35; margin: 0 0 6px !important; }
      .sec-5-6 .missions li .mk { flex: none; width: 20px; height: 20px; border-radius: 6px; border: 2px solid var(--line-2); display: grid; place-items: center; font-size: 13px; font-weight: 900; color: var(--ok); }
      .sec-5-6 .missions li.done .mk { background: var(--ok-bg); border-color: var(--ok); }
      .sec-5-6 .missions li.done { color: var(--ink-2); }
      .sec-5-6 .log { font-size: 13px; }
      .sec-5-6 .mw0 > * { min-width: 0; }
      .sec-5-6 pre.code { font-size: 13.5px; line-height: 1.45; }
      .sec-5-6 svg .env text { font-family: var(--mono); }
      .sec-5-6 .fmt { display: grid; grid-template-columns: 30px 34% minmax(0, 1fr); border: 1px solid var(--line); border-radius: 10px; overflow: hidden; font-size: 14px; }
      .sec-5-6 .fmt > div { padding: 4px 8px; border-bottom: 1px solid var(--line); cursor: pointer; min-width: 0; }
      .sec-5-6 .fmt > div.last { border-bottom: 0; }
      .sec-5-6 .fmt > div.side { padding: 0; display: grid; place-items: center; font-size: 11.5px; font-weight: 800; letter-spacing: .08em; writing-mode: vertical-rl; transform: rotate(180deg); cursor: default; }
      .sec-5-6 .fmt > div.side.hd { grid-row: span 5; background: var(--os-bg); color: var(--os); }
      .sec-5-6 .fmt > div.side.bd { background: var(--mem-bg); color: var(--mem); }
      .sec-5-6 .fmt > div.sel:not(.side) { background: var(--hl); }
      .sec-5-6 .fbar { display: flex; height: 26px; border-radius: 8px; overflow: hidden; border: 1px solid var(--line-2); font-size: 12px; font-weight: 800; }
      .sec-5-6 .fbar > span { display: grid; place-items: center; white-space: nowrap; overflow: hidden; min-width: 0; }
      .sec-5-6 .fbar .hd { background: var(--os-bg); color: var(--os); }
      .sec-5-6 .fbar .bd { background: var(--mem-bg); color: var(--mem); }
      .sec-5-6 .fbar .pad { background: repeating-linear-gradient(135deg, var(--panel-3) 0 5px, var(--panel) 5px 10px); color: var(--muted); }
      .sec-5-6 .fbar .cut { border-right: 3px solid var(--ink-2); }
      .sec-5-6 .mqrow { display: grid; grid-template-columns: 40px 78px 64px 58px minmax(0, 1fr) 50px; align-items: center; gap: 6px; width: 100%; padding: 3px 8px; border: 1px solid var(--line); border-radius: 8px; background: var(--panel); color: var(--ink); font-size: 13.5px; text-align: left; font-family: inherit; }
      .sec-5-6 button.mqrow { cursor: pointer; }
      .sec-5-6 button.mqrow:hover { border-color: var(--accent); }
      .sec-5-6 .mqrow.next { border: 2px solid var(--accent); background: var(--accent-bg); }
      .sec-5-6 .mqrow .nx { font-size: 11.5px; font-weight: 800; color: var(--accent); text-transform: uppercase; letter-spacing: .06em; text-align: right; }
      .sec-5-6 .mqrow .ell { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .sec-5-6 .mq-nar .mqrow { grid-template-columns: 32px 70px 52px 40px minmax(0, 1fr) 38px; gap: 4px; padding: 3px 6px; }
    `,
    steps: [
      /* ---------------- 1. Big picture ---------------- */
      {
        title: 'Talk instead of share: send and receive',
        kind: 'story',
        html: `
          <div class="split fill">
            <div class="stack" style="gap:9px">
              <p class="lead m0">Processes that work together need two things from each other: a way to stay in step (<b>synchronization</b>) and a way to hand over data (<b>communication</b>).</p>
              <p class="m0">Semaphores and monitors handle the first and assume shared variables for the second. <span class="t">Message passing</span> does both with just two calls, <span class="t" data-t="Send primitive">send</span> and <span class="t" data-t="Receive primitive">receive</span>. A <span class="t">message</span> carries the data, and a process that waits for a message cannot run ahead of the process that sends it.</p>
              <table class="tbl compact" style="font-size:14px">
                <tr><th style="width:46%">The two primitives</th><th>What the call means</th></tr>
                <tr><td><code>send(destination, message)</code></td><td>“Deliver this message to that destination.”</td></tr>
                <tr><td><code>receive(source, message)</code></td><td>“Get a message from that source; keep it here.”</td></tr>
              </table>
              <div class="callout analogy m0" data-label="Analogy">Think of the ticket rail in a restaurant kitchen. A server clips an order to the rail (send); a cook pulls the next ticket (receive). The ticket carries the information, and no cook can start an order before its ticket exists.</div>
              <div class="row gap-s small"><span class="chip os">pick blocking rules</span><span class="chip proc">drive both sides</span><span class="chip mem">use mailboxes</span><span class="chip intr">lock with one message</span></div>
            </div>
            <div class="card stack env-card" style="gap:8px"></div>
          </div>`,
        render(el, ctx) {
          const { h, s } = ctx;
          const card = ctx.$('.env-card');
          // wide layout is 520 units across; phones get a narrower 380-unit drawing so the labels stay readable
          const n = ctx.narrow, W = n ? 380 : 520, H = n ? 262 : 250;
          const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img', 'aria-label': 'Where message passing runs' });
          const cap = h('div', { class: 'narr small' });
          const count = h('span', { class: 'chip mem' }, '0 delivered');
          let env = 'uni', delivered = 0, stopAnim = null;
          const ENV = {
            uni: {
              pts: n ? [[62, 126], [62, 181], [318, 181], [318, 126]] : [[85, 126], [85, 181], [435, 181], [435, 126]],
              cap: 'P and Q <b>take turns</b> on one processor (<span class="t">interleaving</span>). The kernel copies the message into its own buffer, then into Q\'s memory when Q receives. P and Q never touch each other\'s variables.',
              draw: (trail) => [
                s('rect', { x: 8, y: 8, width: W - 16, height: 234, rx: 14, class: 's-panel', 'stroke-width': 1.5 }),
                s('text', { x: W - 20, y: 30, 'text-anchor': 'end', 'font-size': 13, class: 's-sub' }, n ? 'one processor' : 'one computer, one processor'),
                trail,
                box(s, n ? 22 : 30, n ? 40 : 30, n ? 176 : 170, 54, 'CPU', 's-cpu', 'runs P, then Q, in turns'),
                box(s, n ? 16 : 30, 150, n ? 92 : 110, 62, 'P', 's-proc', 'sender'),
                box(s, n ? 138 : 205, 140, n ? 104 : 110, 82, 'Kernel', 's-os', 'message buffer'),
                box(s, n ? 272 : 380, 150, n ? 92 : 110, 62, 'Q', 's-proc', 'receiver'),
              ],
            },
            multi: {
              pts: n ? [[95, 150], [95, 205], [285, 205], [285, 150]] : [[120, 150], [120, 205], [400, 205], [400, 150]],
              cap: 'With <span class="t">multiprocessing</span>, P and Q <b>really run at the same time</b> on different cores. The message is placed in a queue in the shared memory, and Q\'s receive takes it from there. The kernel keeps the queue safe from simultaneous updates.',
              draw: (trail) => [
                box(s, n ? 12 : 30, 16, n ? 166 : 180, 52, 'CPU 0', 's-cpu', 'running P'),
                box(s, n ? 202 : 310, 16, n ? 166 : 180, 52, 'CPU 1', 's-cpu', 'running Q'),
                box(s, n ? 40 : 65, 84, 110, 52, 'P', 's-proc', 'sender'),
                box(s, n ? 230 : 345, 84, 110, 52, 'Q', 's-proc', 'receiver'),
                s('rect', { x: 10, y: 168, width: W - 20, height: 74, rx: 12, class: 's-mem', 'stroke-width': 2 }),
                s('text', { x: 24, y: 190, 'font-size': 13, 'font-weight': 700, style: 'fill:var(--mem)' }, n ? 'shared' : 'shared memory'),
                n ? s('text', { x: 24, y: 206, 'font-size': 13, 'font-weight': 700, style: 'fill:var(--mem)' }, 'memory') : null,
                trail,
                box(s, n ? 130 : 200, 178, 120, 54, 'Queue', 's-os', 'kept by kernel'),
              ],
            },
            dist: {
              pts: n ? [[88, 133], [88, 212], [292, 212], [292, 133]] : [[115, 133], [115, 212], [405, 212], [405, 133]],
              cap: 'In <span class="t">distributed processing</span>, P and Q share <b>no memory at all</b>, so an ordinary semaphore or monitor, which lives in shared memory, has nowhere to live. Message passing works unchanged: each OS turns the message into network traffic and back.',
              draw: (trail) => {
                const a = n ? 88 : 115, b = n ? 292 : 405, bw = n ? 140 : 150, mw = n ? 164 : 214;
                return [
                  s('rect', { x: a - mw / 2, y: 8, width: mw, height: 234, rx: 14, class: 's-panel', 'stroke-width': 1.5 }),
                  s('rect', { x: b - mw / 2, y: 8, width: mw, height: 234, rx: 14, class: 's-panel', 'stroke-width': 1.5 }),
                  trail,
                  s('text', { x: a, y: 30, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800 }, 'Machine A'),
                  s('text', { x: b, y: 30, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800 }, 'Machine B'),
                  box(s, a - bw / 2, 44, bw, 58, 'P', 's-proc', 'sender'),
                  box(s, b - bw / 2, 44, bw, 58, 'Q', 's-proc', 'receiver'),
                  box(s, a - bw / 2, 164, bw, 58, 'OS', 's-os', 'network code'),
                  box(s, b - bw / 2, 164, bw, 58, 'OS', 's-os', 'network code'),
                  s('line', { x1: a + bw / 2, y1: 212, x2: b - bw / 2, y2: 212, class: 's-line', 'stroke-dasharray': '6 5', style: 'stroke:var(--io)' }),
                  s('text', { x: (a + b) / 2, y: n ? 256 : 234, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, style: 'fill:var(--io)' }, 'network'),
                ];
              },
            },
          };
          const mover = s('g', {});
          function place(p) {
            const [x, y] = along(ENV[env].pts, p);
            mover.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
          }
          function paint(p) {
            const E = ENV[env];
            const trail = s('polyline', { points: E.pts.map((q) => q.join(',')).join(' '), class: 's-muted', 'stroke-dasharray': '4 5', fill: 'none' });
            mover.replaceChildren(envelope(s, 0, 0, null, p >= 1 ? 's-ok' : 's-mem'));
            svg.replaceChildren(...E.draw(trail), mover);
            place(p);
          }
          function setEnv(v) {
            if (stopAnim) { stopAnim(); stopAnim = null; }
            env = v;
            paint(0);
            cap.innerHTML = ENV[v].cap;
          }
          function sendIt() {
            if (stopAnim) { stopAnim(); stopAnim = null; }
            paint(0);
            const t0 = performance.now();
            stopAnim = ctx.raf((t) => {
              const p = Math.min(1, (t - t0) / 1500);
              place(p);
              if (p >= 1) {
                stopAnim = null; delivered += 1;
                mover.replaceChildren(envelope(s, 0, 0, null, 's-ok'));
                count.textContent = delivered + ' delivered';
                cap.innerHTML = ENV[env].cap + ' <b>Delivered.</b> Q\'s receive now returns the message.';
                return false;
              }
              return true;
            });
          }
          const seg = ctx.ui.seg([{ value: 'uni', label: 'One processor' }, { value: 'multi', label: 'Multiprocessor' }, { value: 'dist', label: 'Distributed' }], env, setEnv);
          card.append(
            h('h4', { class: 'm0' }, 'One mechanism, three kinds of computer'),
            seg,
            h('div', { class: 'card white', style: { padding: '6px' } }, svg),
            h('div', { class: 'row' }, h('button', { class: 'btn primary sm', type: 'button', onclick: sendIt }, 'Send a message from P to Q'), count),
            cap);
          setEnv('uni');
          return () => { if (stopAnim) stopAnim(); };
        },
      },
      /* ---------------- 2. Design map (configurator) ---------------- */
      {
        title: 'Four design questions every message system answers',
        kind: 'learn',
        render(el, ctx) {
          const { h } = ctx;
          const ROWS = [
            { g: 0, key: 'send', label: 'send', opts: [['block', 'Blocking'], ['nb', 'Nonblocking']] },
            { g: 0, key: 'recv', label: 'receive', opts: [['block', 'Blocking'], ['nb', 'Nonblocking'], ['test', 'Test for arrival']] },
            { g: 1, key: 'addr', label: 'style', opts: [['dx', 'Direct, explicit'], ['di', 'Direct, implicit'], ['ind', 'Indirect (mailbox)']] },
            { g: 1, key: 'bind', label: 'mailbox binding', opts: [['static', 'Static'], ['dynamic', 'Dynamic']], ind: true },
            { g: 1, key: 'own', label: 'mailbox owner', opts: [['recv', 'Receiver (port)'], ['os', 'The OS'], ['creator', 'Its creator']], ind: true },
            { g: 2, key: 'len', label: 'length', opts: [['fixed', 'Fixed'], ['var', 'Variable']] },
            { g: 3, key: 'q', label: 'order', opts: [['fifo', 'FIFO'], ['prio', 'Priority'], ['pick', 'Receiver chooses']] },
          ];
          const GROUPS = [['Synchronization', 'os'], ['Addressing', 'mem'], ['Format', 'io'], ['Queuing discipline', 'proc']];
          const TXT = {
            send: { block: '<span class="t">Blocking send</span>: after <code>send</code>, the sender <b>waits</b> until its message has been received.', nb: '<span class="t">Nonblocking send</span>: after <code>send</code>, the sender <b>keeps running</b>; the message waits to be picked up.' },
            recv: { block: '<span class="t">Blocking receive</span>: with nothing waiting, <code>receive</code> <b>puts the receiver to sleep</b> until a message arrives.', nb: '<span class="t">Nonblocking receive</span>: with nothing waiting, <code>receive</code> <b>returns “no message”</b> at once and the receiver carries on.', test: 'The receiver first makes a <span class="t">test for arrival</span> (is anything there?) and calls receive only when the answer is yes.' },
            addr: { dx: '<span class="t">Direct addressing</span>, explicit: send names the receiving process; receive names the <b>one sender</b> it will accept.', di: '<span class="t">Direct addressing</span>, <span class="t" data-t="Implicit addressing">implicit</span>: send names the receiving process; receive <b>accepts anyone</b> and learns the sender\'s ID from its source parameter.', ind: '<span class="t">Indirect addressing</span>: messages go to a <span class="t">mailbox</span>, not a process, so senders and receivers never name each other.' },
            bind: { static: '<span class="t" data-t="Dynamic association">Static association</span>: the mailbox is bound to its processes <b>for good</b> when it is set up.', dynamic: '<span class="t">Dynamic association</span>: processes attach and detach with <code>connect</code> and <code>disconnect</code> while running.' },
            own: { recv: 'The receiving process created and owns it: a <span class="t">port</span> that <b>vanishes when its owner ends</b>.', os: 'The OS owns it: it lives on until someone <b>explicitly destroys</b> it.', creator: 'The process that created it owns it, and it is <b>destroyed when that process ends</b>.' },
            len: { fixed: '<b>Fixed length:</b> easy to store and queue, but short messages waste space and long ones must be split.', var: '<b>Variable length:</b> no wasted space, but the <span class="t" data-t="Message header">header</span> must record the length and space is allocated per message.' },
            q: { fifo: 'A FIFO <span class="t">queuing discipline</span>: messages leave in <b>arrival order</b> (the usual default). Fair, but an urgent message waits behind routine ones.', prio: 'A priority <span class="t">queuing discipline</span>: <b>urgent messages jump ahead</b>, by message type or by a priority the sender chooses.', pick: 'The <span class="t">queuing discipline</span> is left to the receiver: it <b>inspects the queue</b> and picks the message it wants next.' },
          };
          const cfg = { send: 'nb', recv: 'block', addr: 'ind', bind: 'dynamic', own: 'recv', len: 'var', q: 'fifo' };
          let last = null;
          const segs = {};
          const rowEls = {};
          const groupCard = (gi) => {
            const [name, col] = GROUPS[gi];
            const card = h('div', { class: 'card tight stack', style: { gap: '6px', borderLeft: `5px solid var(--${col})` } }, h('h4', { class: 'm0', style: { color: `var(--${col})` } }, name));
            ROWS.filter((r) => r.g === gi).forEach((r) => {
              segs[r.key] = ctx.ui.seg(r.opts.map(([v, l]) => ({ value: v, label: l })), cfg[r.key], (v) => { cfg[r.key] = v; last = r.key; paint(); });
              if (!ctx.narrow) segs[r.key].style.flexWrap = 'nowrap';
              // phones: label on its own line above the choices; wide: label column + choices on one line
              rowEls[r.key] = ctx.narrow ? h('div', { class: 'stack', style: { gap: '4px' } }, h('span', { class: 'lbl' }, r.label), segs[r.key])
                : h('div', { class: 'row nw', style: { gap: '10px' } }, h('span', { class: 'lbl', style: { width: gi > 1 ? '50px' : '124px' } }, r.label), segs[r.key]);
              card.append(rowEls[r.key]);
            });
            return card;
          };
          const left = h('div', { class: 'stack', style: { gap: '8px' } },
            h('p', { class: 'm0', html: 'Every message system makes the same handful of decisions. Change any choice and read, under <b>Your message system</b>, what it means for the processes. The next steps let you <b>try each one</b>.' }),
            groupCard(0), groupCard(1), h('div', { class: 'grid-2', style: { gap: '8px', gridTemplateColumns: ctx.narrow ? '' : 'max-content minmax(0, 1fr)' } }, groupCard(2), groupCard(3)));
          const list = h('ul', { class: 'small', style: { margin: 0, paddingLeft: '18px', lineHeight: 1.42 } });
          const verdict = h('div', { class: 'callout m0' });
          const right = h('div', { class: 'card stack', style: { gap: '8px' } }, h('h4', { class: 'm0' }, 'Your message system'), list, h('div', { class: 'grow' }), verdict);
          el.append(h('div', { class: 'split r fill' }, left, right));
          function paint() {
            const ind = cfg.addr === 'ind';
            ['bind', 'own'].forEach((k) => { rowEls[k].style.opacity = ind ? '1' : '.4'; });
            const items = [['send', TXT.send[cfg.send]], ['recv', TXT.recv[cfg.recv]], ['addr', TXT.addr[cfg.addr]]];
            if (ind) items.push(['bind', TXT.bind[cfg.bind]], ['own', TXT.own[cfg.own]]);
            else if (last === 'bind' || last === 'own') items.push([last, '<span class="muted">Mailbox binding and ownership only matter with indirect addressing. Switch the style to “Indirect” to use them.</span>']);
            items.push(['len', TXT.len[cfg.len]], ['q', TXT.q[cfg.q]]);
            list.replaceChildren(...items.map(([k, t]) => h('li', { class: k === last ? 'flash' : '', html: t })));
            const sy = cfg.send + '/' + cfg.recv;
            let v;
            if (sy === 'block/block') v = ['ok', 'Rendezvous', 'A <span class="t">rendezvous</span>: both sides wait for each other, giving tight synchronization, and only the one message being handed over needs storing. A blocking receive could wait forever if the message never comes, so real systems add a <span class="t" data-t="Receive timeout">timeout</span>.'];
            else if (sy === 'nb/block') v = ['ok', 'The most useful mix', 'Senders never stall, and an idle receiver sleeps without using the processor: ideal for a server. The risk is a buggy sender that sends over and over, flooding the system with messages.'];
            else if (sy === 'nb/nb') v = ['warn', 'Nobody ever waits', 'Fast and flexible, but the receiver must keep polling, and a message that arrives just after a receive returned empty can be missed.'];
            else if (sy === 'nb/test') v = ['warn', 'Nobody waits, but it peeks', 'Testing for arrival lets the receiver do other work instead of blocking. It still has to remember to check again.'];
            else v = ['warn', 'An unusual mix', 'The sender waits for delivery while the receiver never waits. It works, but it is rarely chosen: the sender pays the cost of waiting and the receiver must still poll.'];
            verdict.className = 'callout m0 ' + (v[0] === 'ok' ? 'tip' : 'warn');
            verdict.setAttribute('data-label', v[1]);
            verdict.innerHTML = '<span class="small">' + v[2] + '</span>';
          }
          paint();
        },
      },
      /* ---------------- 3. Three combinations (timeline player) ---------------- */
      {
        title: 'Who waits? The three common combinations',
        kind: 'explore',
        render(el, ctx) {
          const { h, s } = ctx;
          const R = 's-proc', W = 's-warn';
          // each tick: [P cell class, P label, Q cell class, Q label, caption]; msgs: sent at tick a, received at tick b (null = not yet)
          const SC = {
            bb: {
              send: 'Blocking send', recv: 'Blocking receive',
              risk: ['warn', 'Watch out', 'A blocking call can wait <b>forever</b> if the partner crashes or the message is lost. The usual fixes are a <span class="t" data-t="Receive timeout">timeout</span> on receive, or testing for arrival first.'],
              msgs: [['m1', 1, 3], ['m2', 7, 7]],
              ticks: [
                [R, 'work', R, 'work', '<b><span class="t">Blocking send</span>, <span class="t">blocking receive</span>.</b> Both processes are busy with their own work. Press play or step forward.'],
                [W, 'send m1', R, 'work', 'P calls <code>send(Q, m1)</code>. Q has not asked for a message yet, so <b>P is blocked</b>: a blocking send returns only once the message has been received.'],
                [W, 'blocked', R, 'work', 'P is still stuck. It can do nothing useful until Q gets around to receiving.'],
                [R, 'resumes', R, 'got m1', 'Q calls <code>receive(P, msg)</code>. The message passes across and <b>both</b> continue. This meeting point is a <span class="t">rendezvous</span>.'],
                [R, 'work', R, 'work', 'Both run freely again. Now watch what happens when Q is the early one.'],
                [R, 'work', W, 'receive', 'Q calls receive, but P has nothing to send yet, so <b>Q is blocked</b>.'],
                [R, 'work', W, 'blocked', 'Q waits. A blocked process uses no processor time, but it makes no progress either.'],
                [R, 'send m2', R, 'got m2', 'P sends m2. Q is already waiting, so the message is delivered at once and <b>neither</b> process waits any longer.'],
                [R, 'work', R, 'work', '<b>Rule:</b> whoever arrives first waits for the other. The two are tightly synchronized, and the system never has to store more than the one message being handed over.'],
              ],
            },
            nb: {
              send: 'Nonblocking send', recv: 'Blocking receive',
              risk: ['warn', 'Watch out', 'Nothing ever slows the sender, so a bug that sends in a loop can flood the system with messages. And P learns that a message arrived only if Q replies.'],
              msgs: [['m1', 1, 1], ['m2', 2, 4], ['m3', 3, 5], ['m4', 7, 7], ['m5', 8, null]],
              ticks: [
                [R, 'work', W, 'receive', '<b><span class="t">Nonblocking send</span>, blocking receive.</b> Q is a server. It calls receive and blocks, because no request has arrived. A blocked server uses no processor time.'],
                [R, 'send m1', R, 'got m1', 'P sends request m1 and <b>carries straight on</b>. The message wakes Q, which starts serving it.'],
                [R, 'send m2', R, 'serve m1', 'P sends m2 without waiting. Q is still busy, so m2 <b>waits in Q\'s queue</b> of incoming messages.'],
                [R, 'send m3', R, 'serve m1', 'And m3. The sender never stalls; the queue soaks up the burst.'],
                [R, 'work', R, 'got m2', 'Q finishes m1 and calls receive again. A message is waiting, so receive returns m2 <b>immediately</b>, with no waiting at all.'],
                [R, 'work', R, 'got m3', 'm2 was a quick request. Q receives again and gets m3 at once. Nothing is left waiting.'],
                [R, 'work', W, 'receive', 'Nothing left, so Q blocks until the next request. The sender never waits and the receiver sleeps when idle: <b>the most useful combination</b> in practice.'],
                [R, 'send m4', R, 'got m4', 'A new request wakes Q straight away.'],
                [R, 'send m5', R, 'serve m4', 'P keeps sending while Q works. Useful for a server, and also the danger: see the warning on the right.'],
              ],
            },
            nn: {
              send: 'Nonblocking send', recv: 'Nonblocking receive',
              risk: ['bad', 'Watch out', 'A message that arrives just after a receive came back empty is easily <b>missed</b>, and constant polling wastes processor time.'],
              msgs: [['m1', 1, 4], ['m2', 6, 7]],
              ticks: [
                [R, 'work', R, 'no msg', '<b>Nonblocking send, <span class="t">nonblocking receive</span>.</b> Q calls receive. Nothing is waiting, so receive returns “no message” at once and Q carries on.'],
                [R, 'send m1', R, 'work', 'P sends m1 and carries on. But Q already looked and <b>moved on</b>.'],
                [R, 'work', R, 'work', 'm1 sits in Q\'s queue <b>unnoticed</b>. If Q never looks again, the message is effectively lost.'],
                [R, 'work', R, 'work', 'Still unnoticed. Q cannot know a message is there unless it checks.'],
                [R, 'work', R, 'got m1', 'Q polls again and finally finds m1, three ticks late. Nobody blocked, but Q had to <b>keep asking</b>.'],
                [R, 'work', R, 'no msg', 'Q polls again: nothing. Every empty poll is wasted work.'],
                [R, 'send m2', R, 'work', 'P sends m2. Q is busy elsewhere.'],
                [R, 'work', R, 'got m2', 'Q polls and gets m2.'],
                [R, 'work', R, 'work', '<b>Nobody ever waits.</b> Maximum freedom, minimum coordination: the program must handle “no message yet” itself and poll often enough not to miss anything.'],
              ],
            },
          };
          let cur = 'bb';
          const nar = ctx.narrow;
          // wide: time runs left to right (P row above, Q row below). Phones: time runs downward (P column, Q column)
          const X0 = 84, CW = 74, PY = 44, QY = 200, CH = 64, MID = (44 + 64 + 200) / 2;
          const cx = (t) => X0 + t * CW + CW / 2;
          const NY0 = 34, RH = 40, NCH = 32, PX = 46, QX = 228, NW = 100, LANE = (PX + NW + QX) / 2;
          const ry = (t) => NY0 + t * RH + RH / 2; // centre of tick row t on phones
          const svg = s('svg', { viewBox: nar ? '0 0 360 426' : '0 0 760 318', width: '100%', role: 'img', 'aria-label': 'Timeline of sender P and receiver Q' });
          const side = h('div', { class: 'card stack', style: { gap: '8px' } });
          const cellText = (lab) => ({ 'font-size': 13, 'font-weight': /send|got|receive|no msg/.test(lab) ? 800 : 500 });
          function drawNarrow(S, i, K) {
            K.push(s('rect', { x: 2, y: NY0 + i * RH, width: 356, height: RH, rx: 8, class: 's-accent', 'stroke-width': 0, opacity: 0.55 }));
            K.push(s('text', { x: 4, y: 20, 'font-size': 13, class: 's-sub' }, 'time ↓'));
            K.push(s('text', { x: PX + NW / 2, y: 20, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800 }, 'P (sender)'));
            K.push(s('text', { x: QX + NW / 2, y: 20, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800 }, 'Q (receiver)'));
            for (let t = 0; t < 9; t++) {
              const tk = S.ticks[t], y = NY0 + t * RH + (RH - NCH) / 2;
              K.push(s('text', { x: 8, y: ry(t) + 5, 'font-size': 13, 'font-weight': t === i ? 800 : 400, class: t === i ? '' : 's-sub' }, 't' + t));
              [[PX, tk[0], tk[1]], [QX, tk[2], tk[3]]].forEach(([x, cls, lab]) => {
                if (t > i) { K.push(s('rect', { x, y, width: NW, height: NCH, rx: 8, class: 's-muted', 'stroke-dasharray': '4 4' })); return; }
                K.push(s('rect', { x, y, width: NW, height: NCH, rx: 8, class: cls, 'stroke-width': t === i ? 2.5 : 1.5 }));
                K.push(s('text', { x: x + NW / 2, y: y + NCH / 2 + 5, 'text-anchor': 'middle', ...cellText(lab) }, lab));
              });
            }
            S.msgs.forEach(([id, a, b]) => {
              if (a > i) return;
              if (b != null && b <= i) {
                const y1 = ry(a), y2 = ry(b);
                K.push(s('line', { x1: PX + NW + 2, y1, x2: QX - 4, y2, class: 's-line', style: 'stroke:var(--mem)', 'stroke-width': 2.5, 'marker-end': 'url(#arr-mem)' }));
                // label sits above the start of the arrow so it never lands on a sloping line
                K.push(s('text', a === b ? { x: LANE, y: y1 - 6, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, style: 'fill:var(--mem)' } : { x: PX + NW + 6, y: y1 - 7, 'font-size': 13, 'font-weight': 800, style: 'fill:var(--mem)' }, id));
              } else {
                const y = ry(a);
                K.push(s('line', { x1: PX + NW + 2, y1: y, x2: LANE - 16, y2: y, class: 's-line', style: 'stroke:var(--mem)', 'stroke-dasharray': '4 3' }));
                K.push(envelope(s, LANE - 2, y, null, 's-mem', 26, 18), s('text', { x: LANE + 14, y: y + 5, 'font-size': 13, 'font-weight': 800, style: 'fill:var(--mem)' }, id));
              }
            });
          }
          function draw(i) {
            const S = SC[cur];
            const K = [];
            if (nar) drawNarrow(S, i, K);
            else {
              K.push(s('rect', { x: X0 + i * CW + 1, y: 4, width: CW - 2, height: QY + CH + 8, rx: 8, class: 's-accent', 'stroke-width': 0, opacity: 0.55 }));
              K.push(s('text', { x: 6, y: 22, 'font-size': 13, class: 's-sub' }, 'time →'));
              for (let t = 0; t < 9; t++) K.push(s('text', { x: cx(t), y: 22, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': t === i ? 800 : 400, class: t === i ? '' : 's-sub' }, 't' + t));
              K.push(s('text', { x: 6, y: PY + 22, 'font-weight': 800, 'font-size': 16 }, 'P'), s('text', { x: 6, y: PY + 40, 'font-size': 13, class: 's-sub' }, 'sender'));
              K.push(s('text', { x: 6, y: QY + 22, 'font-weight': 800, 'font-size': 16 }, 'Q'), s('text', { x: 6, y: QY + 40, 'font-size': 13, class: 's-sub' }, 'receiver'));
              for (let t = 0; t < 9; t++) {
                const tk = S.ticks[t];
                [[PY, tk[0], tk[1]], [QY, tk[2], tk[3]]].forEach(([y, cls, lab]) => {
                  if (t > i) { K.push(s('rect', { x: X0 + t * CW + 4, y, width: CW - 8, height: CH, rx: 8, class: 's-muted', 'stroke-dasharray': '4 4' })); return; }
                  K.push(s('rect', { x: X0 + t * CW + 4, y, width: CW - 8, height: CH, rx: 8, class: cls, 'stroke-width': t === i ? 2.5 : 1.5 }));
                  K.push(s('text', { x: cx(t), y: y + CH / 2 + 5, 'text-anchor': 'middle', ...cellText(lab) }, lab));
                });
              }
              S.msgs.forEach(([id, a, b]) => {
                if (a > i) return;
                if (b != null && b <= i) {
                  const x1 = cx(a), x2 = cx(b);
                  K.push(s('line', { x1, y1: PY + CH + 2, x2, y2: QY - 4, class: 's-line', style: 'stroke:var(--mem)', 'stroke-width': 2.5, 'marker-end': 'url(#arr-mem)' }));
                  K.push(s('text', { x: (x1 + x2) / 2 + (x1 === x2 ? 16 : 10), y: MID + 4, 'font-size': 13, 'font-weight': 800, style: 'fill:var(--mem)' }, id));
                } else {
                  const x = cx(a);
                  K.push(s('line', { x1: x, y1: PY + CH + 2, x2: x, y2: MID - 12, class: 's-line', style: 'stroke:var(--mem)', 'stroke-dasharray': '4 3' }));
                  K.push(envelope(s, x, MID, null, 's-mem', 30, 20), s('text', { x: x + 20, y: MID + 5, 'font-size': 13, 'font-weight': 800, style: 'fill:var(--mem)' }, id));
                }
              });
            }
            const blk = (col) => S.ticks.slice(0, i + 1).filter((tk) => tk[col] === W).length;
            const bp = blk(0), bq = blk(2);
            K.push(s('text', { x: 6, y: nar ? 418 : 306, 'font-size': 14, 'font-weight': 700 }, `Time spent blocked so far:\u00a0\u00a0 P ${bp} tick${bp === 1 ? '' : 's'} \u00a0·\u00a0 Q ${bq} tick${bq === 1 ? '' : 's'}`));
            svg.replaceChildren(...K);
            const inBox = S.msgs.filter(([, a, b]) => a <= i && (b == null || b > i)).map((m) => m[0]);
            side.replaceChildren(
              h('h4', { class: 'm0' }, 'This system'),
              h('div', { class: 'row gap-s' }, h('span', { class: 'chip os' }, S.send), h('span', { class: 'chip os' }, S.recv)),
              h('h4', { style: { margin: '6px 0 0' } }, `Sent, not yet received, at t${i}`),
              h('div', { class: 'row gap-s', style: { minHeight: '30px' } }, ...(inBox.length ? inBox.map((m) => h('span', { class: 'chip mem' }, m)) : [h('span', { class: 'small muted' }, 'none')])),
              h('div', { class: 'grow' }),
              h('div', { class: `callout ${S.risk[0]} m0`, 'data-label': S.risk[1], html: `<span class="small">${S.risk[2]}</span>` }));
            return S.ticks[i][4];
          }
          const seg = ctx.ui.seg([{ value: 'bb', label: 'Blocking send + blocking receive' }, { value: 'nb', label: 'Nonblocking send + blocking receive' }, { value: 'nn', label: 'Nonblocking send + nonblocking receive' }], cur, (v) => { cur = v; player.reset(); });
          const legend = h('div', { class: 'row gap-s xs' }, h('span', { class: 'chip proc' }, 'running'), h('span', { class: 'chip warn' }, 'blocked'), h('span', { class: 'chip mem' }, 'message'));
          const main = h('div', { class: 'card white', style: { padding: '8px 10px' } }, svg);
          const player = ctx.ui.player({ count: 9, render: draw, interval: 2200 });
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, seg, legend),
            h('div', { class: 'grow', style: { display: 'grid', gridTemplateColumns: ctx.narrow ? 'minmax(0, 1fr)' : 'minmax(0, 2.5fr) minmax(0, 1fr)', gap: '14px' } }, main, side),
            player.el));
        },
      },
      /* ---------------- 4. Mailbox playground (lab) ---------------- */
      {
        title: 'Mailbox playground: you run the sender and receiver',
        kind: 'lab',
        core: true,
        render(el, ctx) {
          const { h, s } = ctx;
          let sendMode = 'block', recvMode = 'block';
          let P, Q, queue, n, tick, emptyPoll;
          const done = { rv: false, srv: false, miss: false, rescue: false };
          const MISSIONS = [
            ['rv', '<b><span class="t">Rendezvous</span>.</b> With blocking send and blocking receive, make one process wait for the other, then let the message pass.'],
            ['srv', '<b>Server pattern.</b> With nonblocking send and blocking receive, get 3 messages waiting in the mailbox at once.'],
            ['miss', '<b>Missed message.</b> With nonblocking receive, let a message arrive just after Q\'s receive came back empty.'],
            ['rescue', '<b>Stuck forever.</b> Crash P while Q waits in a blocking receive, then free Q with a <span class="t" data-t="Receive timeout">timeout</span>.'],
          ];
          const svg = s('svg', { viewBox: ctx.narrow ? '0 0 360 272' : '0 0 640 172', width: '100%', role: 'img', 'aria-label': 'Sender P, mailbox A and receiver Q' });
          const rules = h('div', { class: 'callout why m0 small', 'data-label': 'The rules right now' });
          const narr = h('div', { class: 'narr' });
          const mlist = h('ul', { class: 'missions' });
          const log = h('div', { class: 'log grow' });
          const say = (html, tone) => { narr.className = 'narr' + (tone ? ' ' + tone : ''); narr.innerHTML = html; };
          const note = (txt) => { log.append(h('div', {}, `t${tick}: ${txt}`)); log.scrollTop = log.scrollHeight; };
          function reset(msg) {
            P = { st: 'run', wait: null }; Q = { st: 'run', got: null }; queue = []; n = 0; tick = 0; emptyPoll = false;
            log.replaceChildren(h('div', {}, `start: send is ${sendMode === 'block' ? 'blocking' : 'nonblocking'}, receive is ${recvMode === 'block' ? 'blocking' : 'nonblocking'}`));
            say(msg || 'Fresh start. Use the buttons under P and Q to make calls, in any order you like, and watch who ends up waiting.');
            paint();
          }
          function win(k) { if (!done[k]) { done[k] = true; ctx.toast('Mission complete!'); } }
          // ---- P's calls ----
          function pSend() {
            if (P.st !== 'run') return;
            tick++;
            const id = 'm' + (++n);
            if (Q.st === 'blocked') {
              Q.st = 'run'; Q.got = id; emptyPoll = false;
              note(`P send(${id}) → handed straight to the waiting Q`);
              say(`P sends ${id}. Q was already <b>blocked in receive</b>, so ${id} goes straight to Q and Q wakes up. P ${sendMode === 'block' ? 'does not have to wait either, because its message was received at once' : 'carries on as usual'}.`, 'ok');
              if (sendMode === 'block' && recvMode === 'block') win('rv');
            } else {
              const unseen = recvMode === 'nb' && emptyPoll;
              queue.push({ id, waiting: sendMode === 'block', unseen });
              if (sendMode === 'block') {
                P.st = 'blocked'; P.wait = id;
                note(`P send(${id}) → P blocked until ${id} is received`);
                say(`P sends ${id}, but Q is not receiving right now. A blocking send does not return until the message is received, so <b>P is now blocked</b>.`, 'warn');
              } else {
                note(`P send(${id}) → queued, P keeps running`);
                say(`P sends ${id} and <b>keeps running</b> (nonblocking send). ${id} waits in the mailbox until someone receives it.`);
              }
              if (unseen) {
                win('miss');
                say(`P sends ${id}. But Q's last nonblocking receive already came back empty, so Q has <b>no idea</b> ${id} is here. If Q never asks again, ${id} is effectively lost.`, 'bad');
              }
              if (sendMode === 'nb' && recvMode === 'block' && queue.length >= 3) win('srv');
            }
            paint();
          }
          function pWork() { if (P.st !== 'run') return; tick++; note('P computes'); say('P does some of its own computing. Messages are only exchanged when a process calls send or receive.'); paint(); }
          function pCrash() {
            tick++;
            if (P.st === 'crashed') { P.st = 'run'; note('P restarted'); say('P is running again and can send.'); }
            else {
              P.st = 'crashed'; P.wait = null; queue.forEach((m) => { m.waiting = false; });
              note('P crashed');
              say(`P has <b>crashed</b>. It will never send again.${Q.st === 'blocked' ? ' Q is blocked in receive, waiting for a message that can now never come.' : ' If Q now makes a blocking receive on an empty mailbox, it will wait forever.'}`, 'bad');
            }
            paint();
          }
          // ---- Q's calls ----
          function qRecv() {
            if (Q.st !== 'run') return;
            tick++;
            if (queue.length) {
              const m = queue.shift();
              Q.got = m.id; emptyPoll = false;
              let extra = '';
              if (m.waiting && P.st === 'blocked' && P.wait === m.id) {
                P.st = 'run'; P.wait = null;
                extra = ' P was blocked until this delivery, so <b>P is released too</b>: the two processes met at a rendezvous.';
                if (sendMode === 'block' && recvMode === 'block') win('rv');
              }
              note(`Q receive → got ${m.id}`);
              say(`Q receives ${m.id}${m.unseen ? ' (at last: it had been sitting there unnoticed)' : ''}. A message was waiting, so receive returned at once.${extra}`, 'ok');
            } else if (recvMode === 'block') {
              Q.st = 'blocked';
              note('Q receive → mailbox empty, Q blocked');
              say(`The mailbox is empty, so <b>Q is blocked</b> until a message arrives.${P.st === 'crashed' ? ' But P has crashed, so nothing will ever arrive. Q is stuck for good unless the timeout fires.' : ''}`, 'warn');
            } else {
              emptyPoll = true; Q.got = 'none';
              note('Q receive → no message, Q keeps running');
              say('Nonblocking receive: nothing is waiting, so it returns <b>“no message”</b> immediately and Q carries on with other work.');
            }
            paint();
          }
          function qTest() {
            if (Q.st !== 'run') return;
            tick++;
            const seen = queue.some((m) => m.unseen);
            queue.forEach((m) => { m.unseen = false; }); emptyPoll = false; // Q now knows exactly what is waiting
            note(`Q test for arrival → ${queue.length} waiting`);
            say(`<span class="t">Test for arrival</span>: <b>${queue.length ? queue.length + ' message' + (queue.length > 1 ? 's' : '') + ' waiting' : 'nothing waiting'}</b>. Q took nothing and did not block; now it can decide whether to call receive.${seen ? ' The message it had missed is no longer unnoticed.' : ''}`);
            paint();
          }
          function qWork() { if (Q.st !== 'run') return; tick++; note('Q computes'); say('Q does some of its own computing and is not listening for messages.'); paint(); }
          function qTimeout() {
            if (Q.st !== 'blocked') return;
            tick++;
            Q.st = 'run'; Q.got = 'timeout';
            if (P.st === 'crashed') win('rescue');
            note('Q receive timed out → error returned');
            say('The <b>timeout</b> expires. receive gives up and returns an error, so Q can deal with the problem (report it, retry, pick another sender) instead of waiting forever.', 'ok');
            paint();
          }
          // ---- drawing ----
          // wide: P | mailbox | Q in one row. Phones: P and Q side by side, the mailbox underneath
          const G = !ctx.narrow ? {
            vb: '0 0 640 172', P: [10, 20, 150, 128], Q: [480, 20, 150, 128], mbLab: [320, 40], mb: [212, 52, 216, 64],
            env: (k) => [240 + k * 40, 78], arrows: [[162, 84, 208, 84], [430, 84, 476, 84]], more: [426, 136], oldest: [214, 136], red: [320, 162],
          } : {
            vb: '0 0 360 272', P: [8, 8, 164, 120], Q: [188, 8, 164, 120], mbLab: [180, 158], mb: [20, 166, 320, 60],
            env: (k) => [56 + k * 56, 188], arrows: [[90, 130, 90, 162], [270, 164, 270, 132]], more: [338, 244], oldest: [22, 244], red: [180, 266],
          };
          const stCls = (st) => (st === 'blocked' ? 's-warn' : st === 'crashed' ? 's-bad' : 's-proc');
          function procBox([x, y, w, hh], name, role, st, status, detail) {
            const c = x + w / 2, k = hh / 128; // text rows scale with the box height
            return s('g', {},
              s('rect', { x, y, width: w, height: hh, rx: 12, class: stCls(st), 'stroke-width': 2.5 }),
              s('text', { x: c, y: y + 30 * k, 'text-anchor': 'middle', 'font-weight': 900, 'font-size': 24 }, name),
              s('text', { x: c, y: y + 50 * k, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, role),
              s('text', { x: c, y: y + 80 * k, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800, style: st === 'run' ? '' : `fill:var(--${st === 'crashed' ? 'bad' : 'warn'})` }, status),
              s('text', { x: c, y: y + 102 * k, 'text-anchor': 'middle', 'font-size': 13 }, detail));
          }
          function paint() {
            const K = [];
            K.push(procBox(G.P, 'P', 'sender', P.st, P.st === 'run' ? 'running' : P.st === 'blocked' ? 'blocked in send' : 'crashed',
              P.st === 'blocked' ? `until ${P.wait} is received` : P.st === 'crashed' ? 'will never send' : `sent ${n} so far`));
            const qd = Q.st === 'blocked' ? 'waiting for a message' : Q.got == null ? 'nothing received yet' : Q.got === 'none' ? 'last try: no message' : Q.got === 'timeout' ? 'last try: timeout error' : `holding ${Q.got}`;
            K.push(procBox(G.Q, 'Q', 'receiver', Q.st, Q.st === 'run' ? 'running' : 'blocked in receive', qd));
            K.push(s('text', { x: G.mbLab[0], y: G.mbLab[1], 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 15 }, 'mailbox A'));
            const [mx, my, mw, mh] = G.mb;
            K.push(s('rect', { x: mx, y: my, width: mw, height: mh, rx: 10, class: 's-mem', 'stroke-width': 2 }));
            G.arrows.forEach(([x1, y1, x2, y2]) => K.push(s('line', { x1, y1, x2, y2, class: 's-line', 'marker-end': 'url(#arr)' })));
            const shown = queue.slice(0, 5);
            if (!shown.length) K.push(s('text', { x: mx + mw / 2, y: my + mh / 2 + 5, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, 'empty'));
            shown.forEach((m, k) => { const [x, y] = G.env(k); K.push(envelope(s, x, y, m.id, m.unseen ? 's-bad' : 's-panel', 32, 22)); });
            if (queue.length > 5) K.push(s('text', { x: G.more[0], y: G.more[1], 'text-anchor': 'end', 'font-size': 13, 'font-weight': 800 }, `+${queue.length - 5} more`));
            K.push(s('text', { x: G.oldest[0], y: G.oldest[1], 'font-size': 13, class: 's-sub' }, queue.length ? 'oldest on the left' : ''));
            K.push(s('text', { x: G.red[0], y: G.red[1], 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, queue.some((m) => m.unseen) ? 'red = arrived after Q\'s empty receive (unnoticed)' : ''));
            svg.replaceChildren(...K);
            rules.innerHTML = (sendMode === 'block' ? '<b><span class="t">Blocking send</span>:</b> P stops until its message has been received.' : '<b><span class="t">Nonblocking send</span>:</b> P always continues at once; the message waits in the mailbox.') + '<br>' +
              (recvMode === 'block' ? '<b><span class="t">Blocking receive</span>:</b> with an empty mailbox, Q sleeps until a message arrives.' : '<b><span class="t">Nonblocking receive</span>:</b> with an empty mailbox, Q gets “no message” and continues.');
            // buttons
            bP.send.disabled = P.st !== 'run'; bP.work.disabled = P.st !== 'run';
            bP.crash.textContent = P.st === 'crashed' ? 'restart P' : 'crash P';
            bQ.recv.disabled = Q.st !== 'run'; bQ.test.disabled = Q.st !== 'run'; bQ.work.disabled = Q.st !== 'run';
            bQ.to.disabled = Q.st !== 'blocked';
            mlist.replaceChildren(...MISSIONS.map(([k, t]) => h('li', { class: done[k] ? 'done' : '' }, h('span', { class: 'mk' }, done[k] ? '✓' : ''), h('span', { html: t }))));
          }
          const B = (label, fn, cls) => h('button', { class: 'btn sm ' + (cls || ''), type: 'button', onclick: fn }, label);
          const bP = { send: B('send(A, m)', pSend, 'primary'), work: B('compute', pWork), crash: B('crash P', pCrash, 'danger') };
          const bQ = { recv: B('receive(A, m)', qRecv, 'primary'), test: B('test for arrival', qTest), work: B('compute', qWork), to: B('timeout expires', qTimeout) };
          const segS = ctx.ui.seg([{ value: 'block', label: 'Blocking' }, { value: 'nb', label: 'Nonblocking' }], sendMode, (v) => { sendMode = v; reset('New rule for send. Fresh start.'); });
          const segR = ctx.ui.seg([{ value: 'block', label: 'Blocking' }, { value: 'nb', label: 'Nonblocking' }], recvMode, (v) => { recvMode = v; reset('New rule for receive. Fresh start.'); });
          const top = h('div', { class: 'row', style: { gap: '14px' } }, h('span', { class: 'lbl' }, 'send is'), segS, h('span', { class: 'lbl' }, 'receive is'), segR, h('div', { class: 'grow' }), B('Reset', () => reset()));
          const ctlP = h('div', { class: 'card tight proc row' + (ctx.narrow ? '' : ' nw'), style: { gap: '8px' } }, h('span', { class: 'lbl', style: { width: '124px' } }, 'P (sender) calls'), bP.send, bP.work, h('div', { class: 'grow' }), bP.crash);
          const ctlQ = h('div', { class: 'card tight proc row' + (ctx.narrow ? '' : ' nw'), style: { gap: '8px' } }, h('span', { class: 'lbl', style: { width: '124px' } }, 'Q (receiver) calls'), bQ.recv, bQ.test, bQ.work, h('div', { class: 'grow' }), bQ.to);
          const left = h('div', { class: 'stack', style: { gap: '10px' } }, top, h('div', { class: 'card white grow', style: { padding: '6px 8px', display: 'grid', alignItems: 'center' } }, svg), ctlP, ctlQ, rules);
          const right = h('div', { class: 'stack', style: { gap: '10px' } }, h('h4', { class: 'm0' }, 'What just happened'), narr, h('div', { class: 'card tight' }, h('h4', { class: 'm0 mb' }, 'Missions'), mlist), log);
          el.append(h('div', { class: 'split r fill' }, left, right));
          reset();
        },
      },
      /* ---------------- 5. Addressing explorer (two tabs) ---------------- */
      {
        title: 'Addressing explorer: who names whom?',
        kind: 'explore',
        render(el, ctx) {
          el.append(ctx.ui.tabs([
            { label: 'Direct or indirect, in four patterns', render: (p) => addressingTab(p, ctx) },
            { label: 'Mailboxes and ports: binding and ownership', render: (p) => ownershipTab(p, ctx) },
          ]));
        },
      },
      /* ---------------- 6. Message format builder + queuing discipline ---------------- */
      {
        title: 'Build a message, then choose the order it comes out',
        kind: 'lab',
        render(el, ctx) {
          const { h } = ctx;
          const HDR = 16, FIXED = 64, CAP = 6;
          const BODY = { ok: { text: '“ok”', short: 'ok', bytes: 2 }, print: { text: '“print report.pdf, 2 copies”', short: 'print…', bytes: 26 }, rec: { text: '[a 200-byte data record]', short: 'record', bytes: 200 } };
          const FIELD = {
            type: '<b>Message type</b>, the first field of the <span class="t" data-t="Message header">header</span>, says what kind of message this is (a request, a reply, an alarm), so the receiver knows how to handle it and a mailbox can sort by kind.',
            dest: '<b>Destination ID</b> says where it is going: a process (direct addressing) or a mailbox (indirect addressing).',
            src: '<b>Source ID</b> says who sent it, so the receiver knows whom to answer. With implicit receive, this is how the receiver finds out.',
            len: '<b>Message length</b> says how many bytes the body holds. Essential when lengths vary; with fixed-length messages every message is the same size.',
            ctl: '<b>Control information</b> is bookkeeping: a sequence number (to spot lost or out-of-order messages), a priority, or a link to the next message in the queue.',
            body: 'The <b>body</b> is the actual contents. The system only carries it; what it means is up to the sender and receiver.',
          };
          const m = { type: 'request', from: 'P2', prio: 2, body: 'print', fixed: false };
          let seq = 0, disc = 'fifo', queue = [], sel = 'type', hist = [];
          const histRow = h('div', { class: 'row gap-s', style: { minHeight: '26px' } });
          const card = h('div', { class: 'fmt' });   // a grid, so the HEADER label can span five rows without a rowspan cell
          const fieldNote = h('div', { class: 'narr small' });
          const bar = h('div', { class: 'fbar' });
          const barCap = h('div', { class: 'small muted' });
          const sendBtn = h('button', { class: 'btn sm primary', type: 'button', onclick: send });
          const list = h('div', { class: 'stack' + (ctx.narrow ? ' mq-nar' : ''), style: { gap: '4px' } });   // phones: tighter columns so a row fits in 390 px
          const fillChip = h('span', { class: 'chip mem' });
          const discNote = h('div', { class: 'small muted' });
          const narr = h('div', { class: 'narr' });
          const recvBtn = h('button', { class: 'btn sm primary', type: 'button', onclick: () => take(pick()) }, 'receive(A, msg)');
          const parts = () => (m.fixed ? Math.ceil(BODY[m.body].bytes / FIXED) : 1);
          function paintMsg() {
            const B = BODY[m.body], n = parts();
            const rows = [
              ['type', 'Message type', m.type], ['dest', 'Destination ID', 'mailbox A'], ['src', 'Source ID', m.from],
              ['len', 'Message length', m.fixed ? `${FIXED} bytes (every message)` : `${B.bytes} bytes`],
              ['ctl', 'Control info', `seq #${seq + 1}${n > 1 ? '–' + (seq + n) : ''} · priority ${m.prio}`], ['body', 'Body', B.text]];
            card.replaceChildren(...rows.flatMap(([k, label, val], i) => {
              const on = () => { sel = k; paintMsg(); }, cls = (k === sel ? 'sel' : '') + (k === 'body' ? ' last' : '');
              const cells = [];
              if (i === 0) cells.push(h('div', { class: 'side hd' }, 'HEADER'));
              if (k === 'body') cells.push(h('div', { class: 'side bd last' }, 'BODY'));
              cells.push(h('div', { class: 'b ' + cls, onclick: on }, label), h('div', { class: (k === 'body' || k === 'ctl' ? '' : 'mono ') + cls, onclick: on }, val));
              return cells;
            }));
            fieldNote.innerHTML = FIELD[sel];
            // size bar
            const segs = [];
            if (!m.fixed) segs.push(['hd', HDR, 'header'], ['bd', B.bytes, B.bytes + ' B']);
            else for (let p = 0; p < n; p++) { const used = Math.min(FIXED, B.bytes - p * FIXED); segs.push(['hd', HDR, n > 2 ? 'h' : 'header'], ['bd', used, used + ' B'], ['pad' + (p < n - 1 ? ' cut' : ''), FIXED - used, FIXED - used > 8 ? 'padding' : '']); }
            const tot = segs.reduce((a, q) => a + q[1], 0);
            bar.replaceChildren(...segs.filter((q) => q[1] > 0).map(([c, b, t]) => h('span', { class: c, style: { width: (100 * b / tot) + '%' }, title: b + ' bytes' }, 100 * b / tot > 7 ? t : '')));
            const pad = n * FIXED - B.bytes;
            barCap.innerHTML = !m.fixed ? `${HDR}-byte header + ${B.bytes}-byte body = <b>${HDR + B.bytes} bytes</b>. Nothing wasted, but the length field is essential and space must be found for each message.`
              : n === 1 ? `Every message is ${HDR} + ${FIXED} = ${HDR + FIXED} bytes. This body uses ${B.bytes} of its ${FIXED} bytes: <b>${pad} bytes are padding</b>, wasted.`
                : `${B.bytes} bytes do not fit in one ${FIXED}-byte body, so the sender must <b>split it into ${n} messages</b> (and ${pad} bytes of the last one are padding).`;
            sendBtn.textContent = n > 1 ? `send(A, msg) × ${n}` : 'send(A, msg)';
          }
          const pick = () => {
            if (!queue.length || disc === 'pick') return null;
            if (disc === 'fifo') return queue[0];
            return queue.reduce((best, q) => (q.prio > best.prio ? q : best), queue[0]); // highest priority; ties go to the oldest
          };
          function paintQueue() {
            const nx = pick();
            fillChip.textContent = `${queue.length} / ${CAP} slots used`;
            list.replaceChildren(...(queue.length ? queue.map((q) => {
              const kids = [h('span', { class: 'b mono' }, '#' + q.seq), h('span', { class: 'chip ' + (q.type === 'alarm' ? 'intr' : q.type === 'reply' ? 'ok' : 'proc') }, q.type), h('span', {}, 'from ' + q.from), h('span', {}, 'prio ' + q.prio), h('span', { class: 'ell muted' }, q.label), h('span', { class: 'nx' }, q === nx ? 'next' : '')];
              return disc === 'pick' ? h('button', { class: 'mqrow', type: 'button', onclick: () => take(q) }, ...kids) : h('div', { class: 'mqrow' + (q === nx ? ' next' : '') }, ...kids);
            }) : [h('div', { class: 'mqrow muted', style: { display: 'block' } }, 'The mailbox is empty. Build a message on the left and send it.')]));
            recvBtn.disabled = disc === 'pick' || !queue.length;
            histRow.replaceChildren(...(hist.length ? hist.map((q) => h('span', { class: 'chip ' + (q.type === 'alarm' ? 'intr' : q.type === 'reply' ? 'ok' : 'proc') }, '#' + q.seq + ' · p' + q.prio)) : [h('span', { class: 'small muted' }, 'nothing yet')]));
            discNote.innerHTML = { fifo: '<b>FIFO:</b> messages leave in arrival order. Simple and fair, but an urgent message waits behind older routine ones.',
              prio: '<b>Priority:</b> the highest priority leaves first (ties in arrival order). Urgent work goes first, but low-priority messages can wait a long time.',
              pick: '<b>Receiver chooses:</b> the receiver looks through the queue and takes the one it wants. <b>Click a message</b> to receive it.' }[disc];
          }
          function send() {
            const n = parts();
            if (queue.length + n > CAP) { narr.className = 'narr bad'; narr.innerHTML = `The mailbox has room for ${CAP} messages and ${queue.length} are waiting, so ${n > 1 ? 'these ' + n + ' messages do' : 'this message does'} not fit. A full mailbox makes the sender wait or fail. Receive some first.`; return; }
            for (let p = 1; p <= n; p++) queue.push({ seq: ++seq, type: m.type, from: m.from, prio: m.prio, label: n > 1 ? `part ${p}/${n}` : BODY[m.body].short });
            narr.className = 'narr ok';
            narr.innerHTML = n > 1 ? `Sent as <b>${n} separate messages</b>, #${seq - n + 1} to #${seq}, each with its own header. The receiver must put the parts back together.` : `Message #${seq} (${m.type}, priority ${m.prio}) joins the end of the queue in mailbox A.`;
            paintMsg(); paintQueue();
          }
          function take(q) {
            if (!q) return;
            const older = queue.indexOf(q);
            queue = queue.filter((x) => x !== q);
            hist.push(q);
            narr.className = 'narr';
            narr.innerHTML = `The receiver gets <b>#${q.seq}</b> (${q.type}, priority ${q.prio}). ` + (older === 0 ? 'It was the oldest message waiting.' : `It went ahead of <b>${older}</b> older message${older > 1 ? 's' : ''}: ${disc === 'prio' ? 'a higher priority beats arrival order.' : 'the receiver chose it.'}`);
            paintQueue();
          }
          function sample() {
            const S = [['request', 'P1', 1, 'print'], ['reply', 'P3', 2, 'ok'], ['request', 'P2', 1, 'ok'], ['alarm', 'P2', 3, 'ok']];
            let k = 0, alarm = false;
            for (const [type, from, prio, body] of S) { if (queue.length >= CAP) break; queue.push({ seq: ++seq, type, from, prio, label: BODY[body].short }); k++; alarm = alarm || type === 'alarm'; }
            narr.className = 'narr'; narr.innerHTML = !k ? 'The mailbox is already full. Receive some messages first.' : `${k} ready-made message${k > 1 ? 's' : ''} arrived${alarm ? ', with a high-priority alarm at the back' : ''}${k < S.length ? ' (the mailbox filled up before the rest fit)' : ''}. Now compare what each discipline delivers first.`;
            paintMsg(); paintQueue();
          }
          const setM = (k) => (v) => { m[k] = v; paintMsg(); };
          const nw = (seg) => { if (!ctx.narrow) seg.style.flexWrap = 'nowrap'; return seg; };
          const L = (t, w) => h('span', { class: 'lbl', style: { width: w || '58px' } }, t);
          // each control is a label + choices pair; wide screens put two pairs on a line, phones one pair per line
          const pair = (label, w, seg) => [L(label, ctx.narrow ? '64px' : w), nw(seg)];
          const line = (...pairs) => (ctx.narrow ? pairs.map((pp) => h('div', { class: 'row', style: { gap: '8px' } }, ...pp)) : [h('div', { class: 'row', style: { gap: '8px' } }, ...pairs.flat())]);
          const controls = h('div', { class: 'stack', style: { gap: '7px' } },
            ...line(pair('Type', '58px', ctx.ui.seg(['request', 'reply', 'alarm'], m.type, setM('type'))), pair('From', '40px', ctx.ui.seg(['P1', 'P2', 'P3'], m.from, setM('from')))),
            ...line(pair('Priority', '58px', ctx.ui.seg([{ value: 1, label: '1 low' }, { value: 2, label: '2' }, { value: 3, label: '3 high' }], m.prio, setM('prio'))), pair('Length', '52px', ctx.ui.seg([{ value: false, label: 'variable' }, { value: true, label: 'fixed 64 B' }], m.fixed, setM('fixed')))),
            ...line(pair('Body', '58px', ctx.ui.seg([{ value: 'ok', label: '“ok”' }, { value: 'print', label: 'print request' }, { value: 'rec', label: '200-byte record' }], m.body, setM('body')))));
          const left = h('div', { class: 'stack', style: { gap: '8px' } }, controls, card, fieldNote, bar, barCap, h('div', { class: 'row' }, sendBtn, h('span', { class: 'small muted' }, 'Click a row of the message to see what that field is for.')));
          const discSeg = nw(ctx.ui.seg([{ value: 'fifo', label: 'FIFO' }, { value: 'prio', label: 'Priority' }, { value: 'pick', label: 'Receiver chooses' }], disc, (v) => { disc = v; hist = []; narr.className = 'narr'; narr.innerHTML = 'New queuing discipline. The waiting messages have not moved; only the rule for which one leaves next has changed.'; paintQueue(); }));
          const right = h('div', { class: 'card stack', style: { gap: '8px' } },
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'Mailbox A, oldest at the top'), fillChip),
            h('div', { class: 'row', style: { gap: '8px' } }, h('span', { class: 'lbl', style: { width: '76px' }, html: '<span class="t" data-t="Queuing discipline">Discipline</span>' }), discSeg), discNote, list, h('div', { class: 'grow' }), h('h4', { class: 'm0' }, 'Received so far, in order'), histRow,
            h('div', { class: 'row gap-s' }, recvBtn, h('button', { class: 'btn sm', type: 'button', onclick: sample }, 'Add 4 sample messages'), h('button', { class: 'btn sm', type: 'button', onclick: () => { queue = []; hist = []; narr.className = 'narr'; narr.innerHTML = 'Mailbox emptied.'; paintQueue(); } }, 'Empty it')), narr);
          el.append(h('div', { class: 'split fill', style: { gap: '18px' } }, left, right));
          sample(); // start with four waiting messages so the disciplines can be compared straight away
          narr.innerHTML = 'Mailbox A already holds 4 messages, with a priority-3 <b>alarm</b> at the back. Receive a few with each discipline and compare the order. <b>Empty it</b> to start over.';
        },
      },
      /* ---------------- 7. Mutual exclusion with one token message ---------------- */
      {
        title: 'Mutual exclusion with a single message',
        kind: 'lab',
        core: true,
        render(el, ctx) {
          const { h, s } = ctx;
          const code = listing(ctx, [
            ['create_mailbox(box);', 'one mailbox, shared by all'],
            ['send(box, null);', 'put in ONE message: the token'],
            ['while (true) {', 'every process Pi loops forever'],
            ['  receive(box, msg);', 'take the token, or block'],
            ['  critical_section();', 'only the holder gets here'],
            ['  send(box, msg);', 'put the token back'],
            ['  remainder();', 'work that needs no token'],
            ['}', 'go round and ask again']], { fontSize: 13 });
          code.style.flex = 'none';
          const NAMES = ['P1', 'P2', 'P3'];
          let init = 1, pr, box, waitQ, maxIn, steps, auto = null, rng;
          const done = { enter: false, block: false, hand: false, break2: false };
          const MISSIONS = [['enter', 'Get a process into its critical section.'], ['block', 'While it is inside, make another process ask.'],
            ['hand', 'Pass the token straight to a waiting process.'], ['break2', '<b>Break it:</b> start with 2 messages; get 2 inside.']];
          // geometry: column centres for each place a process can be; phones get a narrower drawing with two-line headings
          const G7 = !ctx.narrow ? {
            vb: '0 0 660 250', top: 36, mb: [12, 146], cs: [505, 142], lane: [176, 500], pill: 104, RY: [70, 136, 202], COL: { rem: 272, blk: 420, cs: 575 },
            heads: [[['mailbox “box”'], 85], [['remainder'], 272], [['blocked in receive'], 420], [['critical section'], 575, true]],
          } : {
            vb: '0 0 380 256', top: 42, mb: [4, 86], cs: [276, 100], lane: [92, 272], pill: 84, RY: [78, 142, 206], COL: { rem: 138, blk: 226, cs: 326 },
            heads: [[['mailbox', '“box”'], 47], [['remainder'], 138], [['blocked in', 'receive'], 226], [['critical', 'section'], 326, true]],
          };
          const svg = s('svg', { viewBox: G7.vb, width: '100%', role: 'img', 'aria-label': 'Mailbox with the token, and where each process is' });
          const narr = h('div', { class: 'narr' });
          const mlist = h('ul', { class: 'missions' });
          const stat = h('div', { class: 'row gap-s' });
          const btns = NAMES.map((n, i) => h('button', { class: 'btn sm primary', type: 'button', onclick: () => stepP(i) }));
          const autoBtn = h('button', { class: 'btn sm', type: 'button', onclick: toggleAuto });
          const say = (html, tone) => { narr.className = 'narr' + (tone ? ' ' + tone : ''); narr.innerHTML = html; };
          const win = (k) => { if (!done[k]) { done[k] = true; ctx.toast('Mission complete!'); } };
          const inCS = () => pr.filter((p) => p === 'cs').length;
          function reset(msg) {
            pr = ['rem', 'rem', 'rem']; box = init; waitQ = []; maxIn = 0; steps = 0; rng = ctx.util.seeded(11);
            code.clear(); code.mark(init === 1 ? [1, 2] : 2, init === 1 ? 'cur' : 'bad');
            say(msg || (init === 1 ? 'Set-up done: the shared <span class="t">mailbox</span> holds <b>one</b> message, the token. Whoever holds it may run its <span class="t">critical section</span>, which gives <span class="t">mutual exclusion</span>. In 5.2, processes that only exchanged messages needed no lock; these share a resource, so a message becomes the lock. Click a process to run its next call: you are the scheduler.' : init === 0 ? 'Set-up forgot the token: the mailbox starts <b>empty</b>. Try to get anyone into the critical section.' : 'Set-up put <b>two</b> messages in the mailbox. See what that allows.'), init === 1 ? '' : 'warn');
            paint();
          }
          function stepP(i) {
            const N = NAMES[i];
            steps += 1;
            if (pr[i] === 'rem') {
              code.clear(); code.mark(4);
              if (box > 0) {
                box -= 1; pr[i] = 'cs';
                const n = inCS(); maxIn = Math.max(maxIn, n);
                code.mark(5, n > 1 ? 'bad' : 'ok');
                if (n > 1) { win('break2'); say(`${N}'s receive finds a message, so ${N} enters too. <b>${n} processes are in the critical section at once</b>: mutual exclusion is broken. The number of messages placed in the mailbox is how many processes may be inside together, just like the starting value of a semaphore.`, 'bad'); }
                else { win('enter'); say(`${N} calls <code>receive(box, msg)</code>. The token is there, so ${N} takes it and <b>enters its critical section</b>. The mailbox is now ${box ? 'still holding ' + box : 'empty'}.`, 'ok'); }
              } else {
                pr[i] = 'blk'; waitQ.push(i);
                if (inCS()) win('block');
                say(`${N} calls <code>receive(box, msg)</code>, but the mailbox is empty, so <b>${N} blocks</b>. It uses no processor time while it waits${inCS() > 1 ? ' for one of the tokens to come back' : inCS() ? ` for ${NAMES[pr.indexOf('cs')]} to return the token` : init === 0 ? ', and since no token exists, it will wait forever' : ''}. Position in line: ${waitQ.length}.`, init === 0 ? 'bad' : 'warn');
              }
            } else if (pr[i] === 'cs') {
              pr[i] = 'rem';
              code.clear(); code.mark(6);
              if (waitQ.length) {
                const j = waitQ.shift(); pr[j] = 'cs'; win('hand');
                code.mark(5, 'ok');
                say(`${N} leaves and calls <code>send(box, msg)</code>. ${NAMES[j]} was blocked in receive, so the token goes <b>straight to ${NAMES[j]}</b>, which wakes up inside its critical section. Only one waiter gets it; the others keep waiting.`, 'ok');
              } else {
                box += 1;
                say(`${N} leaves its critical section and calls <code>send(box, msg)</code>. Nobody is waiting, so the token goes back into the mailbox for whoever asks next.`);
              }
              maxIn = Math.max(maxIn, inCS());
            }
            paint();
          }
          function toggleAuto() {
            if (auto) { clearInterval(auto); auto = null; paint(); return; }
            auto = ctx.every(650, () => {
              const ok = pr.map((p, i) => (p === 'blk' ? -1 : i)).filter((i) => i >= 0);
              if (!ok.length || steps >= 400) { clearInterval(auto); auto = null; say(`The random scheduler stopped after ${steps} calls. <b>Most processes ever inside at once: ${maxIn}.</b>${!ok.length ? ' Every process is blocked: nobody holds a token, so nobody can ever run again.' : ''}`, maxIn > 1 || !ok.length ? 'bad' : 'ok'); paint(); return; }
              stepP(ok[Math.floor(rng() * ok.length)]);
            });
            paint();
          }
          function paint() {
            const K = [];
            const n = inCS(), bad = n > 1;
            const L = G7;
            K.push(s('rect', { x: L.cs[0], y: L.top, width: L.cs[1], height: 208, rx: 12, class: bad ? 's-bad' : 's-ok', 'stroke-width': 2 }));
            L.heads.forEach(([lines, x, isCs]) => lines.forEach((t, k) => K.push(s('text', { x, y: 22 + k * 15, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800, style: isCs ? `fill:var(--${bad ? 'bad' : 'ok'})` : '' }, t))));
            K.push(s('rect', { x: L.mb[0], y: L.top, width: L.mb[1], height: 208, rx: 12, class: 's-mem', 'stroke-width': 2 }));
            const mbc = L.mb[0] + L.mb[1] / 2;
            for (let k = 0; k < box; k++) K.push(envelope(s, mbc, L.top + 54 + k * 52, 'token', 's-warn', 44, 30));
            if (!box) K.push(s('text', { x: mbc, y: L.top + 82, 'text-anchor': 'middle', 'font-size': 14, class: 's-sub' }, 'empty'));
            const wl = waitQ.length ? ['waiting:', waitQ.map((j) => NAMES[j]).join(', ')] : ['no one', 'waiting'];
            (ctx.narrow ? wl : [wl.join(' ')]).forEach((t, k, arr) => K.push(s('text', { x: mbc, y: L.top + 198 - (arr.length - 1 - k) * 16, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 }, t)));
            pr.forEach((p, i) => {
              const y = L.RY[i], x = L.COL[p], pw = L.pill;
              K.push(s('line', { x1: L.lane[0], y1: y, x2: L.lane[1], y2: y, class: 's-muted', 'stroke-dasharray': '3 6' }));
              const g = s('g', { style: 'cursor:pointer', onclick: () => { if (pr[i] !== 'blk' && !auto) stepP(i); } },
                s('rect', { x: x - pw / 2, y: y - 23, width: pw, height: 46, rx: 23, class: p === 'cs' ? (bad ? 's-bad' : 's-ok') : p === 'blk' ? 's-warn' : 's-proc', 'stroke-width': 2.5 }),
                s('text', { x: p === 'cs' ? x - pw / 8 : x, y: y + 6, 'text-anchor': 'middle', 'font-weight': 900, 'font-size': 17 }, NAMES[i]));
              K.push(g);
              if (p === 'cs') K.push(envelope(s, x + pw / 4 - 2, y, null, 's-warn', 24, 17));
              if (p === 'blk') K.push(s('text', { x, y: y + 37, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, `#${waitQ.indexOf(i) + 1} in line`));
            });
            svg.replaceChildren(...K);
            btns.forEach((b, i) => { b.textContent = pr[i] === 'rem' ? `${NAMES[i]}: receive` : pr[i] === 'cs' ? `${NAMES[i]}: send back` : `${NAMES[i]}: blocked`; b.disabled = pr[i] === 'blk' || !!auto; });
            autoBtn.textContent = auto ? 'Stop the random scheduler' : 'Let a random scheduler run';
            const held = n;
            stat.replaceChildren(h('span', { class: 'chip ' + (bad ? 'bad' : 'ok') }, `inside now: ${n}`), h('span', { class: 'chip ' + (maxIn > 1 ? 'bad' : 'ok') }, `most ever inside: ${maxIn}`),
              h('span', { class: 'chip warn' }, `tokens: ${box} in box + ${held} held = ${box + held}`));
            mlist.replaceChildren(...MISSIONS.map(([k, t]) => h('li', { class: done[k] ? 'done' : '' }, h('span', { class: 'mk' }, done[k] ? '✓' : ''), h('span', { html: t }))));
          }
          const initSeg = ctx.ui.seg([{ value: 0, label: '0' }, { value: 1, label: '1 (correct)' }, { value: 2, label: '2' }], init, (v) => { if (auto) { clearInterval(auto); auto = null; } init = v; reset(); });
          const left = h('div', { class: 'stack', style: { gap: '8px' } }, h('h4', { class: 'm0' }, 'The code every process runs'), code,
            h('div', { class: 'card tight' }, h('h4', { class: 'm0 mb' }, 'Missions'), mlist),
            h('div', { class: 'callout why m0 small', 'data-label': 'Why it works', html: 'Receive blocks; send does not. Each receive is an <span class="t">atomic operation</span>, so two processes can never grab the same token.' }),
            h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'Forgetting to send the token back, or crashing while holding it, loses the token: every other process blocks forever.' }));
          const right = h('div', { class: 'stack', style: { gap: '8px' } },
            h('div', { class: 'row', style: { gap: '10px' } }, h('span', { class: 'lbl' }, 'Messages put in at set-up'), initSeg, h('div', { class: 'grow' }), h('button', { class: 'btn sm', type: 'button', onclick: () => { if (auto) { clearInterval(auto); auto = null; } reset(); } }, 'Reset')),
            h('div', { class: 'card white grow', style: { padding: '4px 8px', display: 'grid', alignItems: 'center' } }, svg),
            h('div', { class: 'row gap-s' }, ...btns, h('div', { class: 'grow' }), autoBtn), stat, narr);
          el.append(h('div', { class: 'split l fill', style: { gap: '18px' } }, left, right));
          reset();
          return () => { if (auto) clearInterval(auto); };
        },
      },
      /* ---------------- 8. Producer/consumer with mayproduce and mayconsume ---------------- */
      {
        title: 'Producer/consumer with two mailboxes',
        kind: 'lab',
        render(el, ctx) {
          const { h, s } = ctx;
          const pCode = listing(ctx, [
            ['while (true) {', 'loop forever'],
            ['  receive(mayproduce, pmsg);', 'take an empty = a free slot'],
            ['  pmsg = produce();', 'fill it with a new item'],
            ['  send(mayconsume, pmsg);', 'pass the full message on'],
            ['}', 'go round again']], { fontSize: 13 });
          const cCode = listing(ctx, [
            ['while (true) {', 'loop forever'],
            ['  receive(mayconsume, cmsg);', 'take a full one, or block'],
            ['  consume(cmsg);', 'use the item it carries'],
            ['  send(mayproduce, null);', 'return an empty = free slot'],
            ['}', 'go round again']], { fontSize: 13 });
          let N = 3, mode = 'manual', timer = null, tick = 0;
          let empties, full, P, C, made, used;
          const done = { pfull: false, cempty: false, wake: false };
          const MISSIONS = [['pfull', 'Fill the buffer until the <b>producer</b> blocks.'], ['cempty', 'Empty it until the <b>consumer</b> blocks.'], ['wake', 'Wake a blocked process with a send from the other.']];
          // geometry: a wide landscape layout, or a compact portrait one for phones
          const G = !ctx.narrow ? {
            vb: '0 0 1100 176', P: [16, 40], C: [904, 40], mc: [330, 4, 440, 66], mp: [330, 106, 440, 66], mcLab: [346, 31, 51], mpLab: [346, 133, 153],
            mcEnv: (k, n) => [736 - (n - 1 - k) * 50, 28], mpEnv: (k) => [564 + k * 50, 139], mcEmpty: [754, 42], mpEmpty: [564, 144], stat: [550, 93],
            arrows: [[196, 62, 326, 38], [770, 38, 900, 62], [904, 118, 774, 140], [330, 140, 200, 118]],
          } : {
            vb: '0 0 400 396', P: [10, 8], C: [210, 8], mc: [10, 146, 380, 96], mp: [10, 292, 380, 96], mcLab: [26, 170, 188], mpLab: [26, 316, 334],
            mcEnv: (k, n) => [360 - (n - 1 - k) * 50, 214], mpEnv: (k) => [40 + k * 50, 360], mcEmpty: [374, 219], mpEmpty: [180, 365], stat: [200, 270],
            arrows: [[100, 108, 100, 142], [300, 146, 300, 112], [390, 70, 397, 70, 397, 340, 393, 340], [10, 340, 3, 340, 3, 70, 7, 70]],
          };
          const svg = s('svg', { viewBox: G.vb, width: '100%', role: 'img', 'aria-label': 'Producer, consumer and the two mailboxes the messages circulate through' });
          const narr = h('div', { class: 'narr' });
          const mlist = h('ul', { class: 'missions' });
          const pBtn = h('button', { class: 'btn sm primary', type: 'button', onclick: () => stepP() });
          const cBtn = h('button', { class: 'btn sm primary', type: 'button', onclick: () => stepC() });
          const say = (html, tone) => { narr.className = 'narr' + (tone ? ' ' + tone : ''); narr.innerHTML = html; };
          const win = (k) => { if (!done[k]) { done[k] = true; ctx.toast('Mission complete!'); } };
          // P.pc / C.pc: 0 = about to receive, 'blk' = blocked in receive, 1 = holding a message, 2 = message ready to send
          function reset(msg) {
            empties = N; full = []; P = { pc: 0, item: null }; C = { pc: 0, item: null }; made = 0; used = 0;
            say(msg || `A <span class="t">bounded buffer</span> of capacity ${N}, built from two <span class="t">mailboxes</span>. Set-up sends <b>${N} empty messages</b> to mayproduce, one per slot; the full messages in mayconsume <b>are</b> the buffer. Step each process with its button.`);
            paint();
          }
          function stepP() {
            if (P.pc === 0) {
              if (empties > 0) { empties -= 1; P.pc = 1; say(`Producer: <code>receive(mayproduce, pmsg)</code> takes an <b>empty message</b>, which is permission to fill one slot. ${empties} empty left.`); }
              else { P.pc = 'blk'; win('pfull'); say('Producer: <code>receive(mayproduce, pmsg)</code> finds mayproduce <b>empty</b>. Every slot is full, so the producer <b>blocks</b> until the consumer hands back an empty message.', 'warn'); }
            } else if (P.pc === 1) { made += 1; P.item = made; P.pc = 2; say(`Producer: <code>produce()</code> writes item ${made} into the message it is holding.`); }
            else if (P.pc === 2) {
              const it = P.item; P.item = null; P.pc = 0;
              if (C.pc === 'blk') { C.pc = 1; C.item = it; win('wake'); say(`Producer: <code>send(mayconsume, pmsg)</code>. The consumer was blocked waiting for data, so item ${it} goes <b>straight to the consumer</b>, which wakes up.`, 'ok'); }
              else { full.push(it); say(`Producer: <code>send(mayconsume, pmsg)</code> puts item ${it} into mayconsume. The producer does not wait (nonblocking send). ${full.length} item${full.length > 1 ? 's' : ''} now in the buffer.`); }
            }
            paint();
          }
          function stepC() {
            if (C.pc === 0) {
              if (full.length) { C.item = full.shift(); C.pc = 1; say(`Consumer: <code>receive(mayconsume, cmsg)</code> takes the oldest full message, item ${C.item}.`); }
              else { C.pc = 'blk'; win('cempty'); say('Consumer: <code>receive(mayconsume, cmsg)</code> finds mayconsume <b>empty</b>: the buffer holds no data, so the consumer <b>blocks</b> until the producer sends some.', 'warn'); }
            } else if (C.pc === 1) { used += 1; say(`Consumer: <code>consume(cmsg)</code> uses item ${C.item}. The message it holds is now empty.`); C.item = null; C.pc = 2; }
            else if (C.pc === 2) {
              C.pc = 0;
              if (P.pc === 'blk') { P.pc = 1; win('wake'); say('Consumer: <code>send(mayproduce, null)</code>. The producer was blocked waiting for a free slot, so the empty message goes <b>straight to the producer</b>, which wakes up.', 'ok'); }
              else { empties += 1; say(`Consumer: <code>send(mayproduce, null)</code> returns an empty message: one more free slot (${empties} now).`); }
            }
            paint();
          }
          const LINE = { 0: 2, blk: 2, 1: 3, 2: 4 };
          function procBox(x, y, name, Q, isP) {
            const blk = Q.pc === 'blk';
            const state = blk ? (isP ? 'blocked: no free slot' : 'blocked: no data') : Q.pc === 0 ? 'about to receive' : isP ? (Q.pc === 1 ? 'holding an empty message' : `holding item ${Q.item}`) : (Q.pc === 1 ? `holding item ${Q.item}` : 'holding an empty message');
            const holds = !blk && Q.pc !== 0;
            return s('g', {},
              s('rect', { x, y, width: 180, height: 100, rx: 12, class: blk ? 's-warn' : 's-proc', 'stroke-width': 2.5 }),
              s('text', { x: x + 90, y: y + 24, 'text-anchor': 'middle', 'font-weight': 900, 'font-size': 17 }, name),
              s('text', { x: x + 90, y: y + 44, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, style: blk ? 'fill:var(--warn)' : '' }, state),
              holds ? envelope(s, x + 90, y + 72, null, Q.item != null ? 's-mem' : 's-panel', 40, 26) : null,
              holds ? s('text', { x: x + 118, y: y + 77, 'font-size': 12.5, 'font-weight': 800, class: 's-monot' }, Q.item != null ? 'i' + Q.item : 'empty') : null);
          }
          function paint() {
            const K = [];
            G.arrows.forEach((pts, k) => {
              const pp = []; for (let q = 0; q < pts.length; q += 2) pp.push(pts[q] + ',' + pts[q + 1]);
              K.push(s('polyline', { points: pp.join(' '), class: 's-line', 'marker-end': 'url(#arr)', style: k < 2 ? 'stroke:var(--mem)' : '' }));
            });
            const box2 = (r, cls, lab, name, sub) => K.push(s('rect', { x: r[0], y: r[1], width: r[2], height: r[3], rx: 12, class: cls, 'stroke-width': 2 }),
              s('text', { x: lab[0], y: lab[1], 'font-weight': 800, 'font-size': 16 }, name), s('text', { x: lab[0], y: lab[2], 'font-size': 13, class: 's-sub' }, sub));
            box2(G.mc, 's-mem', G.mcLab, 'mayconsume', 'full messages = the buffer');
            box2(G.mp, 's-panel', G.mpLab, 'mayproduce', 'empty messages = free slots');
            full.forEach((it, k) => { const [x, y] = G.mcEnv(k, full.length); K.push(envelope(s, x, y, 'i' + it, 's-mem', 36, 22)); });
            for (let k = 0; k < empties; k++) { const [x, y] = G.mpEnv(k); K.push(envelope(s, x, y, null, 's-panel', 36, 22)); }
            if (!full.length) K.push(s('text', { x: G.mcEmpty[0], y: G.mcEmpty[1], 'text-anchor': 'end', 'font-size': 13, class: 's-sub' }, 'no data waiting'));
            if (!empties) K.push(s('text', { x: G.mpEmpty[0], y: G.mpEmpty[1], 'font-size': 13, class: 's-sub' }, 'none: every slot is full'));
            const circ = empties + full.length + (P.pc === 1 || P.pc === 2 ? 1 : 0) + (C.pc === 1 || C.pc === 2 ? 1 : 0);
            K.push(s('text', { x: G.stat[0], y: G.stat[1], 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 },
              ctx.narrow ? `made ${made} · used ${used} · in circulation: ${circ} = N` : `produced ${made} · consumed ${used} · messages in circulation: ${circ} = N`));
            K.push(procBox(G.P[0], G.P[1], 'Producer', P, true), procBox(G.C[0], G.C[1], 'Consumer', C, false));
            svg.replaceChildren(...K);
            pCode.clear(); pCode.mark(LINE[P.pc], P.pc === 'blk' ? 'bad' : 'cur');
            cCode.clear(); cCode.mark(LINE[C.pc], C.pc === 'blk' ? 'bad' : 'cur');
            const lab = (Q, isP) => (Q.pc === 'blk' ? 'blocked' : Q.pc === 0 ? 'receive' : Q.pc === 1 ? (isP ? 'produce' : 'consume') : 'send');
            pBtn.textContent = 'Producer: ' + lab(P, true); cBtn.textContent = 'Consumer: ' + lab(C, false);
            pBtn.disabled = P.pc === 'blk' || mode !== 'manual'; cBtn.disabled = C.pc === 'blk' || mode !== 'manual';
            mlist.replaceChildren(...MISSIONS.map(([k, t]) => h('li', { class: done[k] ? 'done' : '' }, h('span', { class: 'mk' }, done[k] ? '✓' : ''), h('span', { html: t }))));
          }
          function setMode(v) {
            mode = v; if (timer) { clearInterval(timer); timer = null; }
            if (v !== 'manual') {
              const [pe, ce] = { pfast: [1, 3], cfast: [3, 1], same: [1, 1] }[v];
              tick = 0;
              timer = ctx.every(420, () => { tick += 1; if (tick % pe === 0 && P.pc !== 'blk') stepP(); if (tick % ce === 0 && C.pc !== 'blk') stepC(); });
            }
            paint();
          }
          const nSeg = ctx.ui.seg([1, 2, 3, 4, 5], N, (v) => { N = v; reset(); });
          const mSeg = ctx.ui.seg([{ value: 'manual', label: 'You step' }, { value: 'pfast', label: 'Producer faster' }, { value: 'cfast', label: 'Consumer faster' }, { value: 'same', label: 'Same speed' }], mode, setMode);
          const col = (title, codeEl, btn) => h('div', { class: 'card tight stack', style: { gap: '6px' } }, h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, title), btn), codeEl);
          el.append(h('div', { class: 'stack fill', style: { gap: '9px' } },
            h('div', { class: 'row', style: { gap: '10px' } }, h('span', { class: 'lbl' }, 'Capacity N'), nSeg, h('span', { class: 'lbl', style: { marginLeft: '8px' } }, 'Who runs'), mSeg, h('div', { class: 'grow' }),
              h('button', { class: 'btn sm', type: 'button', onclick: () => { mSeg.set('manual'); setMode('manual'); reset(); } }, 'Reset')),
            h('div', { class: 'card white', style: { padding: '4px 8px' } }, svg),
            h('div', { class: 'grid-2', style: { gap: '12px' } }, col('Producer', pCode, pBtn), col('Consumer', cCode, cBtn)),
            h('div', { class: 'grid-2 grow', style: { gap: '12px', gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 2fr)' } }, narr, h('div', { class: 'card tight' }, mlist))));
          reset();
          return () => { if (timer) clearInterval(timer); };
        },
      },
      /* ---------------- 9. Recap ---------------- */
      {
        title: 'Recap: six ideas to keep',
        kind: 'recap',
        render(el, ctx) {
          el.append(ctx.h('div', { class: 'stack fill', style: { gap: '12px' } },
            ctx.h('p', { class: 'lead m0' }, 'Say each answer out loud before you flip the card. If one surprises you, go back to that step.'),
            ctx.ui.flipcards([
              ['Two jobs, one mechanism', '<div><b>send</b> moves the data (communication), and a receiver that must wait for it stays in step (synchronization). It works even between machines that share no memory.</div>'],
              ['Who blocks?', '<div>Blocking send + blocking receive is a <b>rendezvous</b>. Nonblocking send + blocking receive is the most common mix. Timeouts and tests for arrival stop a receiver from waiting forever.</div>'],
              ['Direct or indirect?', '<div>Direct names a process, and receive may name one sender or accept anyone. Indirect names a <b>mailbox</b>, which makes one-to-one, many-to-one, one-to-many and many-to-many easy.</div>'],
              ['Who owns a mailbox?', '<div>A <b>port</b> belongs to its receiver and dies with it. A mailbox owned by its creator dies with the creator. One owned by the OS lasts until it is explicitly destroyed. Binding is static or dynamic.</div>'],
              ['What is inside a message?', '<div>A <b>header</b> (type, destination ID, source ID, length, control information such as a sequence number or priority) and a <b>body</b> with the contents. Delivery order: FIFO, priority, or receiver\'s choice.</div>'],
              ['Locks and buffers from messages', '<div>One <b>token</b> message in a shared mailbox gives mutual exclusion: receive to enter, send to leave. For a bounded buffer, <b>mayproduce</b> holds N empty messages and <b>mayconsume</b> holds the full ones.</div>'],
            ], { cols: 3, height: 184 }),
            ctx.h('div', { class: 'callout why m0 small', 'data-label': 'Why it matters', html: 'Message passing is how processes cooperate when they share no memory: across the network, between containers, and inside microkernel operating systems where even device drivers are separate processes that talk by messages.' })));
        },
      },
      /* ---------------- 10. Check yourself ---------------- */
      {
        title: 'Check yourself',
        kind: 'check',
        quiz: [
          { q: 'Which combination of send and receive produces a <b>rendezvous</b>?',
            choices: ['Blocking send and blocking receive', 'Nonblocking send and blocking receive', 'Nonblocking send and nonblocking receive', 'Blocking send and nonblocking receive'], answer: 0,
            feedback: [null, 'Here the sender never waits, so the two processes do not have to meet.', 'Nobody ever waits in this mix, so there is no meeting point at all.', 'The receiver never waits, so the two are not forced to meet; this mix is rarely used.'],
            why: 'When both calls block, whichever process arrives first waits for the other, and the message passes only when both are present. That tight meeting point is the rendezvous.' },
          { q: 'A server uses <b>direct</b> addressing and must accept requests from any client, then reply to each one. How should its receive work?',
            choices: ['Name one specific client as the source', 'Leave the source open, accept any sender and find out the sender\'s ID when the message arrives', 'Call receive once for each known client, naming them in turn', 'Use static association'], answer: 1,
            feedback: ['Then it would accept only that one client; requests from everyone else would sit unaccepted.', null, 'A server cannot know every client in advance, and while it waits on one named client it ignores requests that are already waiting from the others.', 'Static association concerns how processes are bound to a mailbox, not how a direct receive names its source.'],
            why: 'Implicit addressing lets a receive accept a message from anyone; the source parameter is filled in on return, so the server knows whom to answer.' },
          { type: 'tf', q: 'With a nonblocking send, a faulty process stuck in a loop can flood the system with messages, because nothing ever makes it wait.', answer: true,
            why: 'A nonblocking send returns at once, so no delay ever slows the sender. The system\'s buffers and processor time can be eaten up by the flood.' },
          { type: 'match', q: 'Match each way of owning or binding a mailbox with what it means.',
            pairs: [['Port (owned by its receiver)', 'Destroyed when that receiving process ends'], ['Mailbox owned by the process that created it', 'Destroyed when its creator ends'], ['Mailbox owned by the operating system', 'Lasts until someone explicitly destroys it'], ['Static association', 'The link is fixed once, when the mailbox is set up'], ['Dynamic association', 'Processes connect and disconnect while running']],
            why: 'Ownership decides a mailbox\'s lifetime: a port dies with its receiver, a creator-owned mailbox with its creator, and an OS-owned mailbox only on an explicit destroy. Association decides whether the set of attached processes is fixed (static) or can change with connect and disconnect (dynamic).' },
          { type: 'multi', q: 'Which of these belong in a message\'s <b>header</b>?',
            choices: ['Message type', 'Destination ID', 'Source ID', 'Message length', 'The data being delivered', 'Control information such as a sequence number or priority'], answer: [0, 1, 2, 3, 5],
            why: 'The header describes the message: its type, where it goes, who sent it, how long it is, and bookkeeping such as sequence numbers and priority. The data itself travels in the body.' },
          { type: 'match', q: 'Match each communication pattern with a typical use.',
            pairs: [['One-to-one', 'A private link between two stages of a pipeline'], ['Many-to-one', 'Many clients sending requests to one server'], ['One-to-many', 'Warning every member of a group about a shutdown'], ['Many-to-many', 'Several servers taking requests from one shared mailbox']],
            why: 'The patterns count senders and receivers. Many-to-one is client/server (usually a port), one-to-many is broadcast, and many-to-many lets a pool of servers share the work.' },
          { type: 'bucket', q: 'Does each call <b>block</b> the caller, or return at once?', buckets: ['Can block the caller', 'Always returns at once'],
            items: [['Blocking receive when the mailbox is empty', 0], ['Nonblocking receive when the mailbox is empty', 1], ['Blocking send before the message has been received', 0], ['Nonblocking send', 1], ['Test for arrival', 1]],
            why: 'Only the blocking forms ever suspend the caller. A nonblocking receive returns “no message”, and a test for arrival just reports whether something is waiting.' },
          { type: 'order', q: 'Put the steps of mutual exclusion with a single token message in order.',
            items: ['Create a mailbox that every process shares', 'Send exactly one (null) message into it', 'A process calls receive and gets the message', 'It runs its critical section', 'It sends the message back to the mailbox'],
            why: 'The single message is the token: set it up once, take it to enter, and put it back on the way out so the next process can enter.' },
          { type: 'num', q: 'Messages have a fixed-length body of 64 bytes. How many messages are needed to send a 200-byte record?', answer: 4, tol: 0, unit: 'messages',
            why: '200 ÷ 64 = 3.125, so three full messages carry 192 bytes and a fourth carries the last 8 (with 56 bytes of padding). Fixed length is simple to manage but wastes space and forces long data to be split.' },
          { type: 'num', q: 'A producer and consumer share a buffer of capacity 5, built from mailboxes <code>mayproduce</code> and <code>mayconsume</code>. So far the producer has sent 7 full messages and the consumer has consumed 4 of them, returning an empty message each time. Neither process is holding a message. How many empty messages are in mayproduce?', answer: 2, tol: 0, unit: 'messages',
            why: 'mayproduce started with 5. The producer took 7 out and the consumer put 4 back: 5 − 7 + 4 = 2. Check: 3 full messages wait in mayconsume, and 2 + 3 = 5, the capacity.' },
          { q: 'A mailbox holds four messages, oldest first: #1 (priority 1), #2 (priority 3), #3 (priority 2), #4 (priority 3). It uses priority order, with ties broken by arrival. Which message does the next receive get?',
            choices: ['#1', '#2', '#3', '#4'], answer: 1,
            feedback: ['That would be FIFO order; #1 has the lowest priority.', null, '#3 has priority 2, but two messages have priority 3.', '#4 has the top priority too, but #2 arrived earlier and wins the tie.'],
            why: 'Priority order picks the highest priority (3), and among #2 and #4 the older one, #2, goes first.' },
          { q: 'In the two-mailbox producer/consumer solution, what does a message waiting in <code>mayproduce</code> stand for?',
            choices: ['An item that is ready to be consumed', 'Permission to produce: one free slot in the buffer', 'A request from the consumer to stop producing', 'A lock on the whole buffer'], answer: 1,
            feedback: ['Items ready to consume travel in mayconsume.', null, 'The consumer never sends such requests; it simply returns empty messages.', 'No lock is needed: each message is taken by exactly one process.'],
            why: 'mayproduce starts with one empty message per slot. The producer must receive one before producing, so when all slots are full it blocks until the consumer returns an empty.' },
        ],
      },
    ],
    notes: `
      <h3>What message passing is</h3>
      <p>Cooperating processes need two things: <b>synchronization</b> (staying in step, for example not using data before it exists) and <b>communication</b> (handing data over). Semaphores and monitors provide synchronization and rely on shared variables for the data. <b>Message passing</b> provides both at once: a message carries the data, and a process waiting to receive it cannot run ahead of the sender. It works on a single processor, on a shared-memory multiprocessor and across a network of machines that share no memory at all.</p>
      <p>Message passing is how processes cooperate when they share no memory: across a network, and inside microkernel operating systems whose services run as separate processes. Two primitives do the work:</p>
      <ul>
        <li><code>send(destination, message)</code>: deliver this message to a process or mailbox.</li>
        <li><code>receive(source, message)</code>: collect a message from a process or mailbox into the caller's message variable.</li>
      </ul>
      <h3>Design characteristics</h3>
      <table>
        <tr><th>Question</th><th>Options</th></tr>
        <tr><td>Synchronization</td><td>send blocking or nonblocking; receive blocking, nonblocking, or test for arrival</td></tr>
        <tr><td>Addressing</td><td>direct (explicit or implicit) or indirect (mailbox), with static or dynamic association and some owner</td></tr>
        <tr><td>Format</td><td>header + body; fixed or variable length</td></tr>
        <tr><td>Queuing discipline</td><td>FIFO, priority, or receiver's choice</td></tr>
      </table>
      <h3>Blocking and nonblocking</h3>
      <ul>
        <li><b>Blocking send</b>: the sender waits until its message has been received. <b>Nonblocking send</b>: the sender continues at once; the message waits to be picked up.</li>
        <li><b>Blocking receive</b>: with no message waiting, the caller sleeps until one arrives. <b>Nonblocking receive</b>: it returns at once, with a message or with “no message”. <b>Test for arrival</b>: check whether anything is waiting without taking it or blocking.</li>
      </ul>
      <table>
        <tr><th>Combination</th><th>Behaviour</th><th>Risk</th></tr>
        <tr><td>Blocking send + blocking receive</td><td><b>Rendezvous</b>: whoever arrives first waits; tight synchronization; only the message being handed over needs storing.</td><td>Either side can wait forever if the partner crashes or the message is lost.</td></tr>
        <tr><td>Nonblocking send + blocking receive</td><td>The most useful mix: senders never stall; an idle receiver (such as a server) sleeps without using the processor.</td><td>A faulty sender can flood the system with messages; the sender learns of delivery only if the receiver replies.</td></tr>
        <tr><td>Nonblocking send + nonblocking receive</td><td>Nobody ever waits.</td><td>The receiver must keep polling; a message arriving just after an empty receive can go unnoticed.</td></tr>
      </table>
      <p>The fourth mix, blocking send with nonblocking receive, is possible but rarely chosen. A blocking receive that could wait forever is usually protected by a <b>timeout</b> (give up and return an error after a time limit) or by testing for arrival first.</p>
      <h3>Addressing</h3>
      <p><b>Direct addressing</b> names a process. send gives the destination process ID. receive either names the one sender it will accept (explicit, fine when the partner is known in advance) or accepts anyone (<b>implicit</b>): the source parameter comes back holding the sender's ID. A server needs implicit addressing, because it cannot list every client in advance. With direct addressing there is no way to name a group, so reaching three receivers takes three sends, and a sender must pick a specific receiver by name.</p>
      <p><b>Indirect addressing</b> sends to a shared <b>mailbox</b>, a queue of messages. Senders and receivers never name each other; they only share the mailbox name, which decouples them. It supports four patterns:</p>
      <ul>
        <li><b>One-to-one</b>: a private link between two processes (for example two pipeline stages).</li>
        <li><b>Many-to-one</b>: client/server; many clients send requests to one server. Such a mailbox is usually a <b>port</b>.</li>
        <li><b>One-to-many</b>: broadcast; one send and every member of the group gets a copy.</li>
        <li><b>Many-to-many</b>: several servers share one mailbox; whichever asks first gets the next request.</li>
      </ul>
      <h3>Binding and ownership of mailboxes</h3>
      <ul>
        <li><b>Static association</b>: the link between processes and a mailbox is fixed once, when it is set up. Typical for a permanent one-to-one link.</li>
        <li><b>Dynamic association</b>: processes attach and detach while running, with <code>connect</code> and <code>disconnect</code>. Needed when senders come and go, as with a server's clients.</li>
      </ul>
      <table>
        <tr><th>Owner</th><th>The mailbox is destroyed when</th></tr>
        <tr><td>The receiving process (a <b>port</b>)</td><td>that receiver ends; later sends fail and queued messages are lost</td></tr>
        <tr><td>The process that created it</td><td>its creator ends, even if others still use it</td></tr>
        <tr><td>The operating system</td><td>someone explicitly destroys it; it outlives any process, so a new receiver can take over the queued messages</td></tr>
      </table>
      <h3>Message format</h3>
      <p>A message has a <b>header</b> that describes it and a <b>body</b> that holds the contents. Header fields:</p>
      <ul>
        <li><b>Message type</b>: what kind of message it is (request, reply, alarm...).</li>
        <li><b>Destination ID</b> and <b>source ID</b>: where it goes and who sent it.</li>
        <li><b>Message length</b>: size of the body, essential for variable-length messages.</li>
        <li><b>Control information</b>: for example a sequence number, a priority, or a pointer that links messages into a queue.</li>
      </ul>
      <p><b>Fixed-length</b> messages are easy to store and queue but waste space on short data and force long data to be split. <b>Variable-length</b> messages waste nothing but need the length field and per-message space allocation. Worked example: with a 64-byte fixed body, a 200-byte record needs 4 messages (200 ÷ 64 = 3.125, round up), and the last one carries 8 bytes plus 56 bytes of padding.</p>
      <h3>Queuing discipline</h3>
      <p>The rule for which waiting message a receiver gets next. <b>FIFO</b> (arrival order) is the simple, fair default, but urgent messages wait behind routine ones. <b>Priority</b> order lets urgent messages go first (by type or a sender-chosen priority; ties by arrival), at the risk of low-priority messages waiting a long time. Or the <b>receiver chooses</b>: it inspects the queue and selects the message it wants. Example: messages #1 (priority 1), #2 (3), #3 (2), #4 (3) in arrival order: FIFO delivers #1 first; priority delivers #2 (highest priority, older than #4).</p>
      <h3>Mutual exclusion with one message</h3>
      <pre>create_mailbox(box);  // shared by all processes
send(box, null);      // exactly one message: the token
while (true) {        // each process loops forever
  receive(box, msg);  // take the token, or block
  critical_section(); // only the token holder is here
  send(box, msg);     // return the token
  remainder();        // work that needs no token
}</pre>
      <p>Receive is blocking and send is nonblocking. Whoever holds the single message is the only process in its critical section. If several processes call receive while the message is in the mailbox, exactly one gets it; if several are blocked when it is sent back, exactly one wakes. The number of messages placed in the mailbox at the start is how many processes may be inside together, just like a semaphore's initial value: 0 means nobody can ever enter, 2 breaks mutual exclusion. A process that crashes while holding the token (or forgets to send it back) leaves everyone else blocked forever.</p>
      <h3>Producer/consumer with two mailboxes</h3>
      <p>For a bounded buffer of capacity N, create mailboxes <b>mayproduce</b> and <b>mayconsume</b>, then send N empty (null) messages to mayproduce. Each empty message is permission to produce: one free slot.</p>
      <pre>producer: while (true) {      // loop forever
  receive(mayproduce, pmsg);  // wait for a free slot
  pmsg = produce();           // fill the message
  send(mayconsume, pmsg);     // pass it on
}                             // and repeat
consumer: while (true) {      // loop forever
  receive(mayconsume, cmsg);  // wait for data
  consume(cmsg);              // use the item
  send(mayproduce, null);     // return a free slot
}                             // and repeat</pre>
      <p>The full messages in mayconsume <b>are</b> the buffer. The producer blocks when mayproduce is empty (buffer full); the consumer blocks when mayconsume is empty (no data). A send from one side wakes the other. The total number of messages in circulation always equals N. Worked example: N = 5, producer has sent 7, consumer has consumed 4 and returned 4 empties, neither holds one: mayproduce has 5 − 7 + 4 = 2 empties and mayconsume holds 3 full messages (2 + 3 = 5). The scheme works unchanged with several producers and several consumers.</p>
    `,
  });
})();
