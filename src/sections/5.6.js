// Comment key: a line inside backtick text ends with ${/* comment */''}, an empty-string slot that holds a comment without changing the text on screen (full note at the top of the page).
/* =====================================================================
   5.6 Message Passing
   Original teaching material. Small helpers shared by several steps live
   inside this IIFE (no globals).
   ===================================================================== */
(function () {  // wraps the whole section in a function that runs once, right away, so its helper names stay private to this file
  /* ---------- shared SVG helpers ---------- */
  // a small envelope icon centred on (x, y); cls picks the colour family
  function envelope(s, x, y, label, cls, w = 36, h = 24) {  // envelope(): draws a small letter icon for one message; s is the helper that makes SVG (the browser's drawing format) elements
    return s('g', { class: 'env' },  // the icon is a group (g) tagged "env" so the section's CSS can style its label text
      s('rect', { x: x - w / 2, y: y - h / 2, width: w, height: h, rx: 4, class: cls || 's-mem', 'stroke-width': 2 }),  // the envelope body: a rounded rectangle centred on (x, y), coloured by cls (mailbox colours unless told otherwise)
      s('path', { d: `M${x - w / 2 + 2} ${y - h / 2 + 2} L${x} ${y + 2} L${x + w / 2 - 2} ${y - h / 2 + 2}`, class: 's-muted', 'stroke-width': 1.5 }),  // the flap: a V-shaped line from the top corners down to just below the centre, like a sealed envelope
      label ? s('text', { x, y: y + h / 2 + 15, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 }, label) : null);  // an optional bold label (such as "m3") written just under the envelope; with no label nothing is added
  }  // ends envelope()
  // a labelled rounded box (process, mailbox, CPU ...)
  function box(s, x, y, w, h, title, cls, sub, subCls) {  // box(): draws a titled rounded box used for the CPU, processes, kernel and queue in the step 1 drawing
    return s('g', {},  // groups the box and its text so they are added to the drawing as one piece
      s('rect', { x, y, width: w, height: h, rx: 10, class: cls || 's-panel', 'stroke-width': 2 }),  // the box outline, coloured by cls (a plain panel colour if none is given)
      s('text', { x: x + w / 2, y: y + (sub ? h / 2 - 3 : h / 2 + 6), 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 16 }, title),  // the bold title, centred; it moves up a little when a subtitle line has to fit below it
      sub ? s('text', { x: x + w / 2, y: y + h / 2 + 16, 'text-anchor': 'middle', 'font-size': 13, class: subCls || 's-sub' }, sub) : null);  // an optional smaller subtitle under the title (for example "sender" or "message buffer")
  }  // ends box()
  // straight-line interpolation along a polyline, p in [0, 1]
  function along(pts, p) {  // along(): finds the point a fraction p of the way along a path of straight segments; animations use it to move envelopes
    const seg = [];  // seg will hold the length of each straight piece of the path
    let total = 0;  // total adds those lengths up to get the length of the whole path
    for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(d); total += d; }  // measures each piece with Math.hypot (the straight-line distance between two corners) and adds it to the total
    let want = Math.max(0, Math.min(1, p)) * total;  // turns the fraction p (kept between 0 and 1) into a distance along the path
    for (let i = 0; i < seg.length; i++) {  // walks the pieces in order to find the one that contains that distance
      if (want <= seg[i] || i === seg.length - 1) { const f = seg[i] ? Math.min(1, want / seg[i]) : 1; return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f]; }  // when the distance falls inside this piece (or it is the last one), returns the point that far along it
      want -= seg[i];  // otherwise skips past this piece and keeps looking in the next one
    }  // ends the search loop
    return pts[pts.length - 1];  // safety fallback for a path with only one point: stay at its end
  }  // ends along()
  // a process box with a name and up to two short status lines (used by step 5)
  function pbox(s, x, y, name, l1, l2, cls, l2cls) {  // pbox(): draws a small process box with a name and up to two status lines; the addressing and ownership tabs use it
    return s('g', {},  // groups the box and its text into one piece of the drawing
      s('rect', { x, y, width: 104, height: 60, rx: 10, class: cls || 's-proc', 'stroke-width': 2 }),  // the 104 by 60 box outline, in the process colour unless another colour class is passed in
      s('text', { x: x + 52, y: y + 22, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 16 }, name),  // the process name in bold near the top (for example S2 or R)
      l1 ? s('text', { x: x + 52, y: y + 39, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, l1) : null,  // first status line in grey, such as "sender" or "got 2"; skipped when empty
      l2 ? s('text', { x: x + 52, y: y + 54, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, style: l2cls ? `fill:var(--${l2cls})` : '' }, l2) : null);  // second status line in bold; l2cls can tint it with a theme colour such as red for "not accepted"
  }  // ends pbox()
  // a code listing with a plain-language comment on every line. Wide screens: comment to the right
  // of the code. Phones: each comment sits on its own line just above its code, so nothing scrolls
  // sideways. mark(n) always takes the row number of the listing and highlights the right lines.
  function listing(ctx, rows, o) {  // listing(): builds a code box whose every line carries a plain-language note; steps 7 and 8 show their pseudo-code with it
    if (!ctx.narrow) {  // on wide screens (not the phone-width layout) the note goes to the right of each code line
      const w = Math.max(...rows.map((r) => r[0].length)) + 1;  // w is the length of the longest code line plus one, so all the notes start in the same column
      return ctx.ui.code(rows.map(([c, k]) => (k ? c.padEnd(w) + '// ' + k : c)).join('\n'), o);  // pads each code line to width w, appends "// note", and lets ctx.ui.code build the highlighted, numbered code box
    }  // ends the wide-screen case
    const lines = [], map = [];  // phone-width case: lines collects the output lines; map remembers which output lines belong to each listing row
    rows.forEach(([c, k]) => {  // goes through the listing rows one by one
      const own = [];  // own collects the output line numbers used by this row
      if (k) { lines.push(c.match(/^\s*/)[0] + '// ' + k); own.push(lines.length); }  // if the row has a note, it goes on its own line first, indented like the code, and its number is recorded
      lines.push(c); own.push(lines.length);  // then the code line itself, whose number is recorded too
      map.push(own);  // saves this row's output line numbers in map
    });  // ends the loop over rows
    const pre = ctx.ui.code(lines.join('\n'), o);  // builds the code box from the expanded lines
    const mark0 = pre.mark;  // keeps the code box's original highlight function
    pre.mark = (nums, cls) => mark0([].concat(nums == null ? [] : nums).flatMap((n) => map[n - 1] || []), cls);  // replaces mark() so callers still pass row numbers; each is turned into that row's note line and code line
    return pre;  // hands back the finished code box
  }  // ends listing()
  const YS = (n) => (n === 1 ? [96] : [12, 96, 180]);        // box tops for 1 or 3 processes
  const nm = (base, n, i) => (n === 1 ? base : base + (i + 1)); // 'S' or 'S1'..'S3'

  /* ---------- step 5, tab 1: direct vs indirect across the four patterns ---------- */
  function addressingTab(panel, ctx) {  // addressingTab(): builds the first tab of step 5, where students send messages under direct or indirect addressing
    const { h, s } = ctx;  // pulls out h (makes HTML elements) and s (makes SVG elements) from the step context
    const PATS = {  // PATS: the four sender/receiver patterns, keyed by a short code (1 = one, n = many; senders first)
      '11': { ns: 1, nr: 1, mb: 'A', big: 'A', sub: 'mailbox', use: '<b>One-to-one:</b> a private link between two processes, such as two stages of a pipeline. It can be set up once and never change.' },  // one-to-one: 1 sender, 1 receiver, mailbox A; use is the "where this pattern fits" text shown under the drawing
      'n1': { ns: 3, nr: 1, mb: 'portR', big: 'port of R', sub: 'mailbox', use: '<b>Many-to-one:</b> client/server. Many clients send requests to one server. With a mailbox, this is usually a <span class="t">port</span> that the server creates and owns.' },  // many-to-one: 3 senders and 1 receiver, using a port owned by R (mb is the name used in the calls, big the label)
      '1n': { ns: 1, nr: 3, mb: 'G', big: 'G', sub: 'group mailbox', use: '<b>One-to-many:</b> broadcast. One sender informs a whole group (“shutting down in 5 minutes”). One send to a group mailbox gives every member its own copy.' },  // one-to-many: 1 sender and 3 receivers sharing group mailbox G, so one send reaches everyone
      'nn': { ns: 3, nr: 3, mb: 'A', big: 'A', sub: 'shared mailbox', use: '<b>Many-to-many:</b> a pool of servers sharing the work. Any client sends to the shared mailbox and whichever server asks first gets the next request.' },  // many-to-many: 3 senders and 3 receivers sharing mailbox A, like a pool of servers taking turns
    };  // closes the PATS table
    let mode = 'ind', pat = 'n1', impl = true, st, anim = null;  // current settings: mode (dir/ind), pattern (starts at many-to-one), implicit receive on, state st, running animation
    const P = () => PATS[pat];  // P() returns the settings of the pattern currently selected
    const YA = (n) => (n === 1 ? [74] : [4, 74, 144]); // compact rows: box tops for 1 or 3 processes
    const XA = (n) => (n === 1 ? [128] : [8, 128, 248]); // phones: box lefts for 1 or 3 processes in a row
    // geometry: senders | mailbox | receivers left to right, or (phones) top to bottom so the text stays readable
    const G = !ctx.narrow ? {  // G holds the drawing's coordinates; wide screens get this left-to-right layout (the phone-width layout comes after the colon)
      vb: '0 0 640 208', sBox: (n, i) => [14, YA(n)[i]], rBox: (n, j) => [522, YA(n)[j]],  // wide: the drawing's size, and where each sender box (left) and receiver box (right) sits
      sOut: (n, i) => [118, YA(n)[i] + 30], rIn: (n, j) => [522, YA(n)[j] + 30], rNear: (n, j) => [490, YA(n)[j] + 30],  // wide: where arrows leave a sender, reach a receiver, and stop short of a receiver when a message is refused
      mb: [262, 70, 116, 68], mbIn: [262, 104], mbOut: [378, 104], title: [320, 101], sub: [320, 121], own: [[320, 158, 'middle', 'created and owned by R']],  // wide: the mailbox box and its in/out points, its title and subtitle spots, and the "owned by R" note under it
    } : {  // the phone-width layout starts here
      vb: '0 0 360 300', sBox: (n, i) => [XA(n)[i], 4], rBox: (n, j) => [XA(n)[j], 236],  // phones: a taller drawing with the senders in a row at the top and the receivers in a row at the bottom
      sOut: (n, i) => [XA(n)[i] + 52, 64], rIn: (n, j) => [XA(n)[j] + 52, 236], rNear: (n, j) => [XA(n)[j] + 52, 212],  // phones: arrow start, end and stop-short points, pointing downward instead of sideways
      mb: [122, 118, 116, 64], mbIn: [180, 118], mbOut: [180, 182], title: [180, 146], sub: [180, 166], own: [[246, 146, 'start', 'created and'], [246, 162, 'start', 'owned by R']],  // phones: the mailbox in the middle, and the ownership note split over two lines beside it
    };  // closes the two layouts
    const svg = s('svg', { viewBox: G.vb, width: '100%', role: 'img', 'aria-label': 'Senders, receivers and the route each message takes' });  // the drawing area; role and aria-label describe it for screen readers
    const fly = s('g', {});  // fly: a layer on top of the drawing that holds the moving envelopes during an animation
    const calls = h('table', { class: 'tbl compact', style: { fontSize: '13.5px' } });  // calls: the table on the right that lists the exact send and receive calls just made
    const chip = h('span', { class: 'chip os' });  // chip: a small badge that counts the send calls made so far
    const callsHead = h('h4', { class: 'm0' });  // callsHead: the heading above the calls table; its wording changes after the first send
    const narr = h('div', { class: 'narr' });  // narr: the box that explains in words what just happened
    const use = h('div', { class: 'callout why m0 small', 'data-label': 'Where this pattern fits' });  // use: a callout under the drawing saying where the chosen pattern is useful
    const sendRow = h('div', { class: 'row gap-s' });  // sendRow: the row of "send from" buttons plus Reset, rebuilt whenever the pattern changes
    const fresh = () => { st = { k: 0, sends: 0, sent: [0, 0, 0], got: [0, 0, 0], last: [null, null, null], held: [0, 0, 0] }; };  // fresh(): clears all counts (messages sent, received, refused) to start a new run
    // in explicit direct mode each receiver names one sender: S (or S1) for a single receiver, S1..S3 in pairs for many-to-many
    const want = (j) => (P().ns === 1 || P().nr === 1 ? 0 : j);  // want(j): the position of the sender that receiver j asks for in explicit mode: the first one, or Sj in many-to-many
    const dash = (a, b) => s('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: 's-muted', 'stroke-dasharray': '5 5' });  // dash(a, b): a dashed grey line between two points, used to show the possible routes
    const idx = (n) => (n === 1 ? [0] : [0, 1, 2]);  // idx(n): the list of positions to draw: just [0] for one process, [0, 1, 2] for three
    function draw() {  // draw(): repaints the whole diagram, the send buttons and the side notes; runs after every send and every reset
      const { ns, nr } = P();  // ns and nr are how many senders and receivers the chosen pattern has (1 or 3)
      const K = [];  // K collects every shape of the new drawing before it replaces the old one
      if (mode === 'dir') {  // direct addressing: there is no mailbox, so every sender has its own route to every receiver
        idx(ns).forEach((i) => idx(nr).forEach((j) => K.push(dash(G.sOut(ns, i), G.rIn(nr, j)))));  // draws a dashed line from each sender straight to each receiver
      } else {  // indirect addressing: every route passes through the mailbox
        idx(ns).forEach((i) => K.push(dash(G.sOut(ns, i), G.mbIn)));  // a dashed line from each sender into the left (or top) side of the mailbox
        idx(nr).forEach((j) => K.push(dash(G.mbOut, G.rIn(nr, j))));  // a dashed line from the mailbox's far side to each receiver
        const [mx, my, mw, mh] = G.mb;  // unpacks the mailbox rectangle: left, top, width and height
        K.push(s('rect', { x: mx, y: my, width: mw, height: mh, rx: 12, class: 's-mem', 'stroke-width': 2.5 }));  // the mailbox itself, drawn in the memory colour with a thicker border
        K.push(s('text', { x: G.title[0], y: G.title[1], 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 16 }, P().big));  // the mailbox's name in bold (A, G or "port of R")
        K.push(s('text', { x: G.sub[0], y: G.sub[1], 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, P().sub));  // the smaller description under it (mailbox, group mailbox, shared mailbox)
        if (pat === 'n1') G.own.forEach(([x, y, anchor, t]) => K.push(s('text', { x, y, 'text-anchor': anchor, 'font-size': 13, 'font-weight': 700, style: 'fill:var(--os)' }, t)));  // only for many-to-one: adds the note that the port is created and owned by R
      }  // ends the indirect-addressing branch
      idx(ns).forEach((i) => { const [x, y] = G.sBox(ns, i); K.push(pbox(s, x, y, nm('S', ns, i), 'sender', `sent ${st.sent[i]}`)); });  // draws each sender box with its name (S or S1-S3) and how many messages it has sent
      idx(nr).forEach((j) => {  // draws each receiver box
        const [x, y] = G.rBox(nr, j);  // where receiver j's box goes in the current layout
        const l2 = st.held[j] ? `${st.held[j]} not accepted` : st.last[j] || `got ${st.got[j]}`;  // second status line: how many messages it refused, else the last message it got, else its total so far
        K.push(pbox(s, x, y, nm('R', nr, j), st.last[j] ? `got ${st.got[j]}` : 'receiver', l2, null, st.held[j] ? 'bad' : null));  // first line switches from "receiver" to "got N" after a delivery; the second line turns red when messages were refused
      });  // ends the loop over receivers
      K.push(fly);  // adds the moving-envelope layer last so envelopes appear on top of the boxes
      svg.replaceChildren(...K);  // swaps the old drawing for the new one in a single step
      chip.textContent = `send calls so far: ${st.sends}`;  // updates the badge that counts send calls
      use.innerHTML = P().use;  // shows where the current pattern is useful, under the drawing
      sendRow.replaceChildren(h('span', { class: 'lbl' }, 'Send a message from'),  // rebuilds the button row, starting with its label
        ...YA(ns).map((_, i) => h('button', { class: 'btn sm primary', type: 'button', onclick: () => send(i) }, nm('S', ns, i))),  // one "send" button per sender, labelled with that sender's name
        h('div', { class: 'grow' }), h('button', { class: 'btn sm', type: 'button', onclick: restart }, 'Reset'));  // a flexible spacer pushes the Reset button to the far right
    }  // ends draw()
    const deliver = (j, i, id) => { st.got[j] += 1; st.last[j] = `${id} from ${nm('S', P().ns, i)}`; };  // deliver(): counts a delivery to receiver j and remembers it as "m4 from S2" for its status line
    function send(i) {  // send(i): runs when a "send from" button is pressed; i is the position of the sender
      const { ns, nr, mb } = P();  // the chosen pattern's sender count, receiver count and mailbox name
      st.k += 1; st.sent[i] += 1;  // numbers this message and adds one to this sender's count
      const id = 'm' + st.k, S = nm('S', ns, i);  // id is the message name (m1, m2 ...); S is the sender's printed name
      const targets = pat === '1n' ? [0, 1, 2] : pat === 'nn' ? [(st.k - 1) % 3] : [0];  // which receivers get it: all three for one-to-many, the next in turn for many-to-many, otherwise the only one
      const Rn = (j) => nm('R', nr, j);  // Rn(j): the printed name of receiver j (R, or R1-R3)
      const rows = [], paths = [];  // rows will fill the calls table; paths lists the routes the envelopes will fly along
      let msg, tone = 'ok';  // msg is the explanation text; tone colours its box (ok = green unless changed)
      if (mode === 'ind') {  // indirect addressing
        st.sends += 1;  // always exactly one send call, even when a whole group receives the message
        rows.push([S, `send(${mb}, ${id})`, 'names the mailbox, not a process']);  // table row for the sender's call: it names the mailbox, never a process
        targets.forEach((j) => { deliver(j, i, id); paths.push({ pts: [G.sOut(ns, i), G.mbIn, G.mbOut, G.rIn(nr, j)], cls: 's-ok' }); });  // delivers to each target and plans a route sender, mailbox in, mailbox out, receiver
        rows.push([targets.length > 1 ? 'R1–R3' : Rn(targets[0]), `receive(${mb}, msg)`, targets.length > 1 ? 'each member takes its own copy' : `takes ${id} out of the mailbox`]);  // table row for the receiving side: one receiver takes it, or each group member takes its own copy
        const R = Rn(targets[0]);  // R is the name of the (first) receiver, used in the explanations below
        msg = { '11': `${S} puts ${id} in mailbox A and R takes it out. Neither names the other; they share only the mailbox's name, so either side could be swapped for another process.`,  // explanation for one-to-one: the two sides share only the mailbox name
          'n1': `${S} sends ${id} to R's port. Every client uses the same port name, and R simply receives whatever arrives next, from any client.`,  // explanation for many-to-one: every client sends to R's port and R takes whatever comes next
          '1n': `<b>One send</b> to group G, and R1, R2 and R3 each get their own copy. The sender does not even need to know who is in the group.`,  // explanation for one-to-many: a single send and every group member gets a copy
          'nn': `${S} sends ${id} to the shared mailbox. ${R} asked first this time, so ${R} takes it. Senders never choose a server; a free server takes the next request.` }[pat];  // explanation for many-to-many: whichever server asked first takes it; picks the text for the current pattern
      } else {  // direct addressing
        targets.forEach((j) => { st.sends += 1; rows.push([S, `send(${Rn(j)}, ${id})`, targets.length > 1 ? 'one send per receiver' : 'names the receiving process']); });  // one send call per receiver, each naming that receiving process (so one-to-many needs three)
        const out = targets.map((j) => {  // works out, for each target, whether its receive accepts this message
          const ok = impl || want(j) === i;  // accepted if receive is implicit (anyone) or if this is exactly the sender the receiver asked for
          if (ok) deliver(j, i, id); else st.held[j] += 1;  // delivers it, or counts it as refused (held) so the receiver's box shows it in red
          paths.push({ pts: [G.sOut(ns, i), ok ? G.rIn(nr, j) : G.rNear(nr, j)], cls: ok ? 's-ok' : 's-bad' });  // the envelope flies to the receiver in green, or stops short of it in red when refused
          return ok;  // reports whether this delivery was accepted
        });  // ends the per-target check
        const j0 = targets[0], R = Rn(j0), W = nm('S', ns, want(j0));  // j0 and R: the first receiver; W: the sender that receiver asks for in explicit mode
        if (targets.length > 1) rows.push(['R1–R3', impl ? 'receive(src, msg)' : 'receive(S, msg)', 'each gets its own copy']);  // with several receivers, one table row covers all of them
        else rows.push([R, impl ? 'receive(src, msg)' : `receive(${W}, msg)`, impl ? `gets ${id} and sets src = ${S}` : out[0] ? `names ${W}, so it gets ${id}` : `names ${W} only: ${id} is not accepted`]);  // with one receiver, its row shows the receive call and whether it accepted the message
        if (pat === '1n') { msg = 'There is no way to name a group directly, so S makes <b>three separate sends</b> and must know every receiver\'s ID. Compare the single send with a group mailbox.'; tone = 'warn'; }  // one-to-many under direct addressing: warns that it took three separate sends
        else if (!out[0]) { msg = `${S} names ${R}, but ${R}'s receive asks for ${W} only, so <b>${id} is not accepted</b> and keeps waiting. A server cannot list every client in advance: that is why servers use implicit addressing.`; tone = 'bad'; }  // a refused message: explains why, and why servers use implicit addressing instead
        else msg = { '11': impl ? `${S} names R. R's receive leaves the source open (<b>implicit</b>), accepts ${id} and learns afterward that it came from S.` : `${S} names R and R names S (<b>explicit</b>). The link joins exactly this pair, and each side must know the other's ID in advance.`,  // explanation for one-to-one, in its implicit and explicit versions
          'n1': impl ? `${S} names R. R accepts <b>any</b> sender and its source parameter comes back as ${S}, so R knows whom to reply to. This is how a server works with direct addressing.` : `${S} names R, and R is asking for S1's messages, so ${id} is delivered. Now try sending from S2.`,  // explanation for many-to-one: implicit is how a server works; the explicit case invites a send from S2
          'nn': `${S} must <b>pick one receiver by name</b> and chose ${R}. The sender, not the system, decides who does the work, even if another receiver is idle.` }[pat];  // explanation for many-to-many: the sender must pick one receiver by name; picks the text for the pattern
      }  // ends the direct-addressing branch
      calls.replaceChildren(h('tr', {}, h('th', {}, 'Who'), h('th', {}, 'Call'), h('th', {}, 'What it says')),  // refills the calls table, starting with its heading row
        ...rows.map(([w, c, m]) => h('tr', {}, h('td', { class: 'b' }, w), h('td', {}, h('code', {}, c)), h('td', {}, m))));  // one row per call: who made it, the call itself in code style, and what it means
      callsHead.textContent = 'The calls just made';  // retitles the table now that real calls are shown
      narr.className = 'narr ' + tone; narr.innerHTML = msg;  // shows the explanation, coloured by its tone (green, amber or red)
      draw();  // repaints the diagram with the new counts
      animate(paths);  // starts the envelopes flying along the planned routes
    }  // ends send()
    function animate(paths) {  // animate(): moves the envelopes along their routes over 850 milliseconds
      if (anim) anim();  // stops any animation still running from an earlier send
      const t0 = performance.now();  // t0 records the start time of this animation
      anim = ctx.raf((t) => {  // ctx.raf calls this function on every animation frame (about 60 times a second) until it returns false
        const p = Math.min(1, (t - t0) / 850);  // p is how far through the animation we are, from 0 to 1
        fly.replaceChildren(...paths.map(({ pts, cls }) => { const [x, y] = along(pts, p); return s('g', { transform: `translate(${x.toFixed(1)} ${y.toFixed(1)})` }, envelope(s, 0, 0, null, cls, 30, 20)); }));  // redraws each envelope at the point a fraction p along its route, colour-coded green or red
        if (p >= 1) { anim = null; if (paths.every((q) => q.cls === 's-ok')) fly.replaceChildren(); return false; }  // at the end: forget the stop function, clear the envelopes if all were delivered (refused ones stay), and stop
        return true;  // not finished yet, so ask for another frame
      });  // ends the per-frame function
    }  // ends animate()
    function restart() {  // restart(): starts the tab over; runs on Reset and whenever a setting changes
      if (anim) { anim(); anim = null; }  // stops any running animation
      fly.replaceChildren(); fresh();  // removes leftover envelopes and clears all counts
      const { ns, nr, mb } = P();  // the chosen pattern's sender count, receiver count and mailbox name
      const Ss = ns === 1 ? 'S' : 'S1–S3', Rs = nr === 1 ? 'R' : 'R1–R3';  // names for "all senders" and "all receivers" as they appear in the calls table
      const tmpl = mode === 'ind'  // builds a preview of the calls each side will make, for the current addressing mode
        ? [[Ss, `send(${mb}, m)`, 'names the mailbox, not a process'], [Rs, `receive(${mb}, msg)`, 'takes the next message out']]  // indirect preview: senders name the mailbox, receivers take the next message out of it
        : [[Ss, `send(${nr === 1 ? 'R' : 'Rj'}, m)`, 'names the receiving process'], [Rs, impl ? 'receive(src, msg)' : `receive(${ns === 1 ? 'S' : nr === 1 ? 'S1' : 'Sj'}, msg)`, impl ? 'accepts anyone; src says who sent it' : 'accepts only the named sender']];  // direct preview: send names a receiver; receive accepts anyone, or only the one named sender
      calls.replaceChildren(h('tr', {}, h('th', {}, 'Who'), h('th', {}, 'Call'), h('th', {}, 'What it says')),  // fills the calls table with that preview, starting with its heading row
        ...tmpl.map(([w, c, m]) => h('tr', {}, h('td', { class: 'b' }, w), h('td', {}, h('code', {}, c)), h('td', {}, m))));  // one row per previewed call
      callsHead.textContent = 'The calls each side will make';  // heading says these are the calls each side will make, not ones already made
      narr.className = 'narr'; narr.innerHTML = mode === 'ind' ? 'With <span class="t">indirect addressing</span>, messages go <b>to a <span class="t">mailbox</span></b>, not to a process. Press a send button and follow the route.' : 'With <span class="t">direct addressing</span>, each send <b>names the receiving process</b>. Press a send button and read the exact calls on both sides.';  // introduces the chosen addressing mode and invites the student to press a send button
      rsRow.style.opacity = mode === 'dir' ? '1' : '.35';  // the explicit/implicit choice matters only for direct addressing, so it is faded otherwise
      rsRow.style.pointerEvents = mode === 'dir' ? '' : 'none';  // and it cannot be clicked while faded
      glance.querySelectorAll('td:nth-child(2), th:nth-child(2)').forEach((c) => { c.style.background = mode === 'dir' ? 'var(--accent-bg)' : ''; });  // highlights the Direct column of the at-a-glance table when direct addressing is chosen
      glance.querySelectorAll('td:nth-child(3), th:nth-child(3)').forEach((c) => { c.style.background = mode === 'ind' ? 'var(--accent-bg)' : ''; });  // highlights the Indirect column when indirect addressing is chosen
      draw();  // draws the fresh diagram
    }  // ends restart()
    const nw = (seg) => { if (!ctx.narrow) seg.style.flexWrap = 'nowrap'; return seg; };  // nw(seg): on wide screens keeps a button group on one line instead of letting it wrap
    const ctlRow = (label, ...kids) => h('div', { class: 'row' + (ctx.narrow ? '' : ' nw'), style: { gap: '10px' } }, h('span', { class: 'lbl', style: { width: '84px' } }, label), ...kids);  // ctlRow(): a control row with a fixed-width label on the left; it may wrap on phones but stays on one line on wide screens
    const modeSeg = nw(ctx.ui.seg([{ value: 'dir', label: 'Direct' }, { value: 'ind', label: 'Indirect (mailbox)' }], mode, (v) => { mode = v; restart(); }));  // the Direct / Indirect (mailbox) buttons; choosing one restarts the tab in that mode
    const rsRow = ctlRow('receive', nw(ctx.ui.seg([{ value: 0, label: 'names one sender (explicit)' }, { value: 1, label: 'accepts anyone (implicit)' }], 1, (v) => { impl = !!v; restart(); })));  // the explicit/implicit receive choice (starts on implicit); it only matters for direct addressing
    const patSeg = nw(ctx.ui.seg(Object.keys(PATS).map((k) => ({ value: k, label: { '11': 'One-to-one', 'n1': 'Many-to-one', '1n': 'One-to-many', 'nn': 'Many-to-many' }[k] })), pat, (v) => { pat = v; restart(); }));  // the four pattern buttons, built from the PATS keys with readable labels; choosing one restarts the tab
    const glance = h('table', { class: 'tbl compact', style: { fontSize: '13.5px' }, html:  // glance: a small fixed table comparing direct and indirect addressing, written as plain HTML
      '<tr><th style="width:30%">At a glance</th><th>Direct</th><th>Indirect</th></tr>' +  // table text: heading row with the Direct and Indirect columns
      '<tr><td class="b">send names</td><td>a process</td><td>a mailbox</td></tr>' +  // table text: what a send names under each kind of addressing
      '<tr><td class="b">receive names</td><td>a process, or anyone (<span class="t" data-t="Implicit addressing">implicit</span>)</td><td>the mailbox</td></tr>' +  // table text: what a receive names; the dotted word links to the glossary entry for implicit addressing
      '<tr><td class="b">must know</td><td>the partner\'s ID</td><td>only the mailbox name</td></tr>' });  // table text: what each side must know in advance
    const left = h('div', { class: 'stack', style: { gap: '8px' } },  // left column: the controls, the drawing, the send buttons and the pattern note
      ctlRow('Addressing', modeSeg), rsRow, ctlRow('Pattern', patSeg),  // the three control rows: addressing mode, receive style, pattern
      h('div', { class: 'card white grow', style: { padding: '6px 8px', display: 'grid', alignItems: 'center' } }, svg), sendRow, use);  // the drawing in a white card that grows to fill the spare height, then the send buttons and the pattern note
    const right = h('div', { class: 'stack', style: { gap: '8px' } },  // right column: the calls table, the explanation, a hint and the comparison table
      h('div', { class: 'row', style: { justifyContent: 'space-between' } }, callsHead, chip), calls, narr, h('div', { class: 'grow' }),  // heading and send-count badge side by side, then the calls table, the explanation and a spacer
      h('div', { class: 'small', html: '<b>Try this:</b> Direct + many-to-one + “names one sender”, then send from S2. Next compare the <b>send calls</b> count for one-to-many, direct vs indirect.' }), glance);  // a short "try this" hint suggesting two comparisons, followed by the at-a-glance table
    panel.append(h('div', { class: 'split r fill', style: { gap: '18px' } }, left, right));  // puts the two columns side by side in the tab panel (they stack on phones)
    fresh(); restart();  // clears the counts and draws the starting picture
    return () => { if (anim) anim(); };  // gives the tab system a clean-up function that stops any animation when the student leaves this tab
  }  // ends addressingTab()

  /* ---------- step 5, tab 2: binding (static/dynamic) and ownership of a mailbox ---------- */
  function ownershipTab(panel, ctx) {  // ownershipTab(): builds the second tab of step 5, about how mailboxes are bound to processes and who owns them
    const { h, s } = ctx;  // pulls out the HTML and SVG element helpers from the step context
    let owner = 'port', bind = 'dyn', st;  // current settings: who owns the mailbox (starts as R's port), static or dynamic binding, and the live state st
    const OWN = {  // OWN: the three possible owners, with their button label, their name in the drawing and their table row
      port: { label: 'Receiver R (a port)', who: 'R', row: 0 },  // owner 1: the receiver R, which makes the mailbox a port
      creator: { label: 'Its creator, S1', who: 'S1', row: 1 },  // owner 2: S1, the process that created the mailbox
      os: { label: 'The OS', who: 'OS', row: 2 },  // owner 3: the operating system itself
    };  // closes the OWN table
    // geometry: wide = senders left, mailbox centre, R right; phones = senders on top, mailbox, R below
    const G = !ctx.narrow ? {  // G holds the drawing's coordinates; wide screens use this layout (the phone-width one follows the colon)
      vb: '0 0 640 252', sBox: (i) => [14, YS(3)[i]], sOut: (i) => [118, YS(3)[i] + 30], sTag: (i) => [120, YS(3)[i] - 2],  // wide: drawing size, the three sender boxes on the left, their arrow start points and "owner" badge spots
      mb: [262, 92, 116, 68], mbIn: [262, 126], mbOut: [378, 126], rBox: [522, 96], rIn: [522, 126], rTag: [534, 72],  // wide: the mailbox in the middle, receiver R on the right, and R's badge spot
      os: [160, 200, 320, 40], osLine: [320, 162, 320, 198], osText: [[320, 225, 'Operating system: owner']],  // wide: the OS box along the bottom, the line joining it to the mailbox, and its label
    } : {  // the phone-width layout starts here
      vb: '0 0 360 316', sBox: (i) => [[8, 128, 248][i], 26], sOut: (i) => [[8, 128, 248][i] + 52, 86], sTag: (i) => [[8, 128, 248][i] + 25, 4],  // phones: the three senders in a row across the top
      mb: [122, 128, 116, 68], mbIn: [180, 128], mbOut: [180, 196], rBox: [128, 250], rIn: [180, 250], rTag: [240, 271],  // phones: the mailbox in the middle and R below it
      os: [250, 136, 104, 52], osLine: [238, 162, 250, 162], osText: [[302, 158, 'OS'], [302, 176, 'owner']],  // phones: a small OS box to the right of the mailbox, a short joining line, and a two-line label
    };  // closes the two layouts
    const svg = s('svg', { viewBox: G.vb, width: '100%', role: 'img', 'aria-label': 'Three senders, a mailbox and a receiver, with the owner marked' });  // the drawing area, described for screen readers
    // room for three lines, the longest message here, so the panel below never jumps as messages change
    const narr = h('div', { class: 'narr', style: { minHeight: '86px' } });  // narr: the "what just happened" box; its minimum height keeps the layout still as messages change length
    const bindNote = h('div', { class: 'callout m0 small' });  // bindNote: a callout explaining the chosen binding (static or dynamic)
    const tbl = h('table', { class: 'tbl compact', style: { fontSize: '13.5px' } });  // tbl: the table of owners and when each kind of mailbox is destroyed
    const say = (html, tone) => { narr.className = 'narr' + (tone ? ' ' + tone : ''); narr.innerHTML = html; };  // say(): shows a message in narr, coloured by its tone (ok, warn, bad or plain)
    const fresh = () => { st = { alive: { S1: true, S2: true, S3: true, R: true }, conn: { S1: true, S2: true, S3: false }, mb: true, q: 0 }; };  // fresh(): everyone alive, S1 and S2 connected but not S3, the mailbox exists and holds 0 messages
    function draw() {  // draw(): repaints the drawing, the buttons, the owner table highlight and the binding note after every action
      const K = [];  // K collects every shape of the new drawing
      const who = OWN[owner].who;  // who is the name of the current owner (R, S1 or OS)
      const [mx, my, mw, mh] = G.mb, mcx = mx + mw / 2;  // unpacks the mailbox rectangle and finds its centre line
      const ln = (a, b, on) => s('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: on ? 's-line' : 's-muted', 'stroke-dasharray': on ? null : '5 5', style: on ? 'stroke:var(--mem)' : '' });  // ln(): a solid mailbox-coloured line for a live connection, or a dashed grey one when not connected
      ['S1', 'S2', 'S3'].forEach((p, i) => { if (st.mb && st.alive[p]) K.push(ln(G.sOut(i), G.mbIn, st.conn[p])); });  // draws a line from each living sender to the mailbox, while the mailbox still exists
      if (st.mb && st.alive.R) K.push(ln(G.mbOut, G.rIn, true));  // draws the line from the mailbox to R, while both exist
      if (st.mb) {  // the mailbox still exists
        K.push(s('rect', { x: mx, y: my, width: mw, height: mh, rx: 12, class: 's-mem', 'stroke-width': 2.5 }));  // the mailbox box in the memory colour
        K.push(s('text', { x: mcx, y: my + 24, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 15 }, owner === 'port' ? 'port of R' : 'mailbox A'));  // its title: "port of R" when R owns it, otherwise "mailbox A"
        if (!st.q) K.push(s('text', { x: mcx, y: my + 52, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, 'empty'));  // writes "empty" when no messages are waiting
        for (let k = 0; k < Math.min(st.q, 4); k++) K.push(envelope(s, mx + 22 + k * 24, my + 46, null, 's-panel', 20, 14));  // draws up to four small envelopes for the waiting messages
        if (st.q > 4) K.push(s('text', { x: mx + 110, y: my + 62, 'text-anchor': 'end', 'font-size': 12, 'font-weight': 800 }, '+' + (st.q - 4)));  // with more than four waiting, adds a "+N" count in the corner
      } else {  // the mailbox has been destroyed
        K.push(s('rect', { x: mx, y: my, width: mw, height: mh, rx: 12, class: 's-bad', 'stroke-dasharray': '6 5', 'stroke-width': 2 }));  // a dashed red outline where the mailbox used to be
        K.push(s('text', { x: mcx, y: my + 39, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 14, style: 'fill:var(--bad)' }, 'destroyed'));  // the word "destroyed" in red inside it
      }  // ends the mailbox drawing
      const tag = ([x, y]) => K.push(s('rect', { x, y, width: 54, height: 18, rx: 9, class: 's-os', 'stroke-width': 1.5 }), s('text', { x: x + 27, y: y + 13, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 800, style: 'fill:var(--os)' }, 'owner'));  // tag(): draws a small "owner" badge at the given spot, in the OS colour
      ['S1', 'S2', 'S3'].forEach((p, i) => {  // draws each of the three senders
        const [x, y] = G.sBox(i);  // where this sender's box goes
        K.push(pbox(s, x, y, p, st.alive[p] ? 'sender' : 'ended', st.alive[p] ? (st.conn[p] ? 'connected' : 'not connected') : '', st.alive[p] ? 's-proc' : 's-bad', st.conn[p] ? 'mem' : null));  // its box: "sender" or "ended", connected or not; red when ended, and "connected" tinted like the mailbox
        if (who === p) tag(G.sTag(i));  // puts the owner badge on this sender if it owns the mailbox
      });  // ends the loop over senders
      K.push(pbox(s, G.rBox[0], G.rBox[1], 'R', st.alive.R ? 'receiver' : 'ended', '', st.alive.R ? 's-proc' : 's-bad'));  // R's box: "receiver" while alive, "ended" in red after it ends
      if (who === 'R') tag(G.rTag);  // puts the owner badge on R when R owns the mailbox (the port case)
      if (who === 'OS') {  // when the OS owns the mailbox, draws an extra OS box
        const [ox, oy, ow, oh] = G.os, [x1, y1, x2, y2] = G.osLine;  // unpacks the OS box rectangle and the ends of its joining line
        K.push(s('rect', { x: ox, y: oy, width: ow, height: oh, rx: 10, class: 's-os', 'stroke-width': 2 }));  // the OS box in the OS colour
        G.osText.forEach(([x, y, t]) => K.push(s('text', { x, y, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800 }, t)));  // its label, on one or two lines depending on the layout
        K.push(s('line', { x1, y1, x2, y2, class: 's-line', 'stroke-dasharray': '4 4', style: 'stroke:var(--os)' }));  // a dashed line joining the mailbox to its owner, the OS
      }  // ends the OS-owner drawing
      svg.replaceChildren(...K);  // swaps the old drawing for the new one
      // buttons
      b.s1.disabled = !st.alive.S1; b.s3.disabled = !st.alive.S3;  // a sender that has ended cannot press its send button any more
      b.conn.disabled = bind === 'static' || !st.alive.S3 || !st.mb;  // S3's connect button is off with static binding, once S3 has ended, or when the mailbox is gone
      b.conn.textContent = st.conn.S3 ? 'S3 disconnects' : 'S3 connects';  // the same button reads "S3 connects" or "S3 disconnects" depending on S3's state
      b.recv.disabled = !st.alive.R;  // R cannot receive after it has ended
      b.endR.textContent = st.alive.R ? 'End R' : 'Start a new R';  // the End R button turns into "Start a new R" once R has ended
      b.endS1.disabled = !st.alive.S1;  // S1 can only be ended once
      b.del.disabled = !st.mb;  // Destroy is off once the mailbox is gone
      tbl.querySelectorAll('tr').forEach((tr, i) => tr.classList.toggle('on', i - 1 === OWN[owner].row));  // highlights the owner-table row that matches the current owner (the minus 1 skips the heading row)
      bindNote.className = 'callout m0 small ' + (bind === 'static' ? 'warn' : 'tip');  // the binding note is amber for static binding and green for dynamic
      bindNote.setAttribute('data-label', bind === 'static' ? 'Static association' : 'Dynamic association');  // its small heading names the binding in use
      bindNote.innerHTML = bind === 'static'  // picks the explanation text for the binding
        ? 'With <span class="t" data-t="Dynamic association">static association</span> the link is fixed when the mailbox is set up: S1 and S2 are attached for good, and S3 can never join. Simple and cheap, and typical of a permanent one-to-one link.'  // static text: the attached processes are fixed at set-up, so S3 can never join
        : 'With <span class="t">dynamic association</span>, processes attach and detach while the system runs, using <code>connect</code> and <code>disconnect</code>. Needed when senders come and go, as with the many clients of a server.';  // dynamic text: processes use connect and disconnect while the system runs
    }  // ends draw()
    function sendFrom(p) {  // sendFrom(p): runs when S1 or S3 presses send
      if (!st.mb) return say(`${p}'s send <b>fails with an error</b>: the mailbox no longer exists, so there is nowhere to deliver the message.`, 'bad'), draw();  // if the mailbox is gone, the send fails with an error (report it, then redraw)
      if (!st.conn[p]) return say(`${p} is <b>not connected</b> to this mailbox, so its send is refused.${bind === 'dyn' ? ' Press “S3 connects” first.' : ' With static association it can never join.'}`, 'warn'), draw();  // if the sender is not connected, the send is refused; the hint depends on the binding
      st.q += 1;  // otherwise one more message waits in the mailbox
      say(`${p} sends a message. It waits in the mailbox until R receives it (${st.q} waiting).${st.alive.R ? '' : ' R has ended, so for now nobody is listening.'}`);  // reports the send, and warns when R has ended so nobody is listening yet
      draw();  // repaints the drawing with the new envelope
    }  // ends sendFrom()
    function recv() {  // recv(): runs when the "R receives" button is pressed
      if (!st.mb) say('R\'s receive fails: the mailbox is gone.', 'bad');  // with the mailbox gone, the receive fails
      else if (!st.q) say('The mailbox is empty, so R\'s blocking receive would put R to sleep until a message arrives.');  // with an empty mailbox, explains that a blocking receive would put R to sleep
      else { st.q -= 1; say(`R receives one message (${st.q} still waiting).`, 'ok'); }  // otherwise R takes one message out and the waiting count drops
      draw();  // repaints the drawing
    }  // ends recv()
    function endR() {  // endR(): the End R button; after R has ended the same button starts a new R
      if (!st.alive.R) {  // R has already ended, so this press starts a new receiver
        st.alive.R = true;  // the new R is alive
        say(st.mb ? `A new receiver starts and attaches to the <b>surviving</b> mailbox. ${st.q ? `The ${st.q} message${st.q > 1 ? 's' : ''} that piled up ${st.q > 1 ? 'are' : 'is'} still there, ready to receive.` : 'Nothing was lost.'}` : 'A new R starts, but the old mailbox is gone. The new R must create a new one, and every sender must learn its name again.', st.mb ? 'ok' : 'warn');  // if the mailbox survived, the new R finds any piled-up messages; if not, it must make a new mailbox
        return draw();  // repaints and stops here
      }  // ends the "start a new R" case
      st.alive.R = false;  // otherwise R ends now
      if (owner === 'port' && st.mb) { st.mb = false; st.q = 0; say('R has ended. R <b>owned</b> the port, so the OS destroys the port with it, and any queued messages are thrown away. From now on, sends to it fail.', 'bad'); }  // if R owned the mailbox (a port), the OS destroys it along with every queued message
      else say(`R has ended, but R did not own the mailbox, so the mailbox <b>survives</b>. Messages can still be sent and simply wait until a new receiver comes along.`, 'warn');  // otherwise the mailbox survives and messages can keep arriving for a later receiver
      draw();  // repaints the drawing
    }  // ends endR()
    function endS1() {  // endS1(): the End S1 button
      st.alive.S1 = false; st.conn.S1 = false;  // S1 stops and is no longer connected to the mailbox
      if (owner === 'creator' && st.mb) { st.mb = false; st.q = 0; say('S1 created the mailbox, so it <b>owned</b> it. When S1 ends, the mailbox is destroyed, even though S2, S3 and R still wanted it.', 'bad'); }  // if S1 created and owned the mailbox, the mailbox is destroyed with it, even though others still use it
      else say('S1 has ended. It did not own the mailbox, so nothing else changes: the other processes carry on.');  // otherwise nothing else changes
      draw();  // repaints the drawing
    }  // ends endS1()
    function destroy() {  // destroy(): the "Destroy mailbox" button, an explicit destroy call
      st.mb = false; st.q = 0;  // the mailbox is gone and its messages with it
      say(owner === 'os' ? 'An explicit <b>destroy</b> call removes the mailbox. Because the OS owns it, this is the only way it ever goes away: no process ending would do it.' : `The owner (${OWN[owner].who}) may destroy it explicitly at any time. Otherwise it disappears automatically when ${OWN[owner].who} ends.`, 'warn');  // explains that for an OS-owned mailbox this is the only way it ends; other owners also lose it when they end
      draw();  // repaints the drawing
    }  // ends destroy()
    function toggleConn() {  // toggleConn(): the connect/disconnect button for S3 (only usable with dynamic binding)
      st.conn.S3 = !st.conn.S3;  // flips S3 between connected and not connected
      say(st.conn.S3 ? '<code>connect</code>: S3 joins the mailbox while everything keeps running. It can send from now on.' : '<code>disconnect</code>: S3 leaves. The mailbox and everyone else are unaffected.', 'ok');  // explains connect or disconnect: the mailbox and the other processes carry on untouched
      draw();  // repaints the drawing
    }  // ends toggleConn()
    const B = (label, fn, cls) => h('button', { class: 'btn sm ' + (cls || ''), type: 'button', onclick: fn }, label);  // B(): makes a small button with a label, a click handler and an optional style (primary or danger)
    const b = { s1: B('S1 sends', () => sendFrom('S1'), 'primary'), s3: B('S3 sends', () => sendFrom('S3'), 'primary'), conn: B('S3 connects', toggleConn), recv: B('R receives', recv, 'primary'),  // b holds every action button so draw() can turn them on and off: S1 sends, S3 sends, S3 connects, R receives
      endR: B('End R', endR, 'danger'), endS1: B('End S1', endS1, 'danger'), del: B('Destroy mailbox', destroy) };  // the lifecycle buttons, in red for the ones that end a process: End R, End S1, and Destroy mailbox
    function restart(msg) { fresh(); say(msg || 'Pick who owns the <span class="t">mailbox</span> (a <span class="t">port</span> is owned by its receiver), then end processes and see whether the mailbox survives.'); draw(); }  // restart(): puts everything back to the start and shows a message (a default one if none is given)
    tbl.append(h('tr', {}, h('th', {}, 'Owner'), h('th', {}, 'It is destroyed when')),  // fills the owner table: its heading row first
      h('tr', {}, h('td', { class: 'b' }, 'Receiving process (a port)'), h('td', {}, 'that receiver ends')),  // owner table row: a port is destroyed when its receiver ends
      h('tr', {}, h('td', { class: 'b' }, 'The process that created it'), h('td', {}, 'its creator ends')),  // owner table row: a creator-owned mailbox is destroyed when its creator ends
      h('tr', {}, h('td', { class: 'b' }, 'The operating system'), h('td', {}, 'someone explicitly destroys it')));  // owner table row: an OS-owned mailbox lasts until someone destroys it
    const nw = (seg) => { if (!ctx.narrow) seg.style.flexWrap = 'nowrap'; return seg; };  // nw(): keeps a button group on one line on wide screens
    const ownSeg = ctx.ui.seg(Object.keys(OWN).map((k) => ({ value: k, label: OWN[k].label })), owner, (v) => { owner = v; restart(`New owner: <b>${OWN[v].label}</b>. Fresh start.`); });  // the Owner buttons; choosing one restarts the tab and names the new owner
    const bindSeg = ctx.ui.seg([{ value: 'static', label: 'Static' }, { value: 'dyn', label: 'Dynamic' }], bind, (v) => { bind = v; restart(`${v === 'static' ? 'Static' : 'Dynamic'} association. Fresh start.`); });  // the Static / Dynamic buttons; choosing one restarts the tab with that binding
    const left = h('div', { class: 'stack', style: { gap: '8px' } },  // left column: settings, drawing and action buttons
      h('div', { class: 'row nw', style: { gap: '10px' } }, h('span', { class: 'lbl', style: { width: '84px' } }, 'Owner'), nw(ownSeg)),  // the Owner row: label plus owner buttons
      h('div', { class: 'row nw', style: { gap: '10px' } }, h('span', { class: 'lbl', style: { width: '84px' } }, 'Association'), nw(bindSeg)),  // the Association row: label plus Static / Dynamic buttons
      h('div', { class: 'card white grow', style: { padding: '6px 8px', display: 'grid', alignItems: 'center' } }, svg),  // the drawing in a white card that takes up the spare height
      h('div', { class: 'row gap-s' }, h('span', { class: 'lbl', style: { width: '84px' } }, 'Messages'), b.s1, b.s3, b.recv, b.conn),  // the Messages row: the two send buttons, receive, and S3's connect button
      h('div', { class: 'row gap-s' }, h('span', { class: 'lbl', style: { width: '84px' } }, 'Lifecycle'), b.endS1, b.endR, b.del));  // the Lifecycle row: End S1, End R and Destroy mailbox
    const tryIt = h('ol', { class: 'small m0', style: { paddingLeft: '20px', lineHeight: 1.4 }, html:  // tryIt: a numbered list of three short experiments, written as HTML
      '<li>Owner = R: send twice, then <b>End R</b>. Where did the messages go?</li>' +  // experiment 1: R owns the port; send twice, end R, and see the messages vanish
      '<li>Owner = OS: do the same, then <b>Start a new R</b> and receive.</li>' +  // experiment 2: the OS owns it; the messages survive for a new R
      '<li>Switch to <b>Static</b> and try to let S3 join.</li>' });  // experiment 3: static binding keeps S3 out
    // Reset sits in the heading row, so a long message can never push it off the slide
    const right = h('div', { class: 'stack', style: { gap: '8px' } },  // right column: explanation, owner table, experiments and binding note
      h('div', { class: 'row nw', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'What just happened'), h('button', { class: 'btn sm', type: 'button', onclick: () => restart() }, 'Reset')),  // heading row with the Reset button on the right
      narr, tbl, h('h4', { class: 'm0' }, 'Try this'), tryIt, h('div', { class: 'grow' }), bindNote);  // then the explanation, the owner table, the experiments, a spacer and the binding note at the bottom
    panel.append(h('div', { class: 'split r fill', style: { gap: '18px' } }, left, right));  // puts the two columns side by side (stacked on phones)
    restart();  // starts the tab fresh
  }  // ends ownershipTab()

  Guide.section({  // registers section 5.6 with the guide: its text, glossary terms, styles, steps, quiz and notes
    id: '5.6',  // the section number, used in links, saved progress and the table of contents
    title: 'Message Passing',  // the full title shown at the top of every step
    short: 'Message passing',  // a shorter title for tight spots such as the table of contents
    summary: 'Processes cooperate by sending and receiving messages, which carry data and make the receiver wait.',  // one-sentence summary shown in the chapter's list of sections
    objectives: [  // learning objectives: what a student should be able to do after this section
      'Explain how send and receive give processes both synchronization and communication, on one machine or many.',  // objective 1: send and receive give both synchronization and communication
      'Predict who blocks under each mix of blocking and nonblocking send and receive, and name the risk of each.',  // objective 2: predict who blocks under each blocking/nonblocking mix
      'Compare direct and indirect addressing, the four sender/receiver patterns, and how mailboxes and ports are bound and owned.',  // objective 3: compare the addressing choices and mailbox binding and ownership
      'Describe the header and body of a message and choose a queuing discipline for a mailbox.',  // objective 4: message format and queuing discipline
      'Use messages to enforce mutual exclusion and to solve the bounded-buffer producer/consumer problem.',  // objective 5: mutual exclusion and producer/consumer built from messages
    ],  // closes the objectives list
    terms: [  // glossary terms: each pair is a term and its definition; dotted words in the steps link here
      ['Message passing', 'Cooperation in which processes hand each other information by calling send and receive instead of sharing variables. Because a receiver can wait for a message, the same calls also synchronize the processes.'],  // glossary entry: defines message passing
      ['Message', 'A packet of information passed from one process to another: a header that describes it plus a body that holds the actual contents.'],  // glossary entry: defines a message (header plus body)
      ['Send primitive', 'send(destination, message): hands a message to a named process or mailbox.'],  // glossary entry: defines the send call
      ['Receive primitive', 'receive(source, message): collects a message from a named process or mailbox and stores it in the caller\'s message variable.'],  // glossary entry: defines the receive call
      ['Blocking send', 'A send after which the sending process is suspended until its message has been received.'],  // glossary entry: defines a blocking send
      ['Nonblocking send', 'A send that returns at once; the sender keeps running while its message waits to be received.'],  // glossary entry: defines a nonblocking send
      ['Blocking receive', 'A receive that suspends the caller until a message is available, then returns with it.'],  // glossary entry: defines a blocking receive
      ['Nonblocking receive', 'A receive that returns at once: with a message if one is waiting, otherwise with a “no message” result. The caller continues either way.'],  // glossary entry: defines a nonblocking receive
      ['Test for arrival', 'A check that reports whether a message is waiting, without taking it and without blocking, so the process can decide whether to call receive.'],  // glossary entry: defines test for arrival
      ['Rendezvous', 'The meeting that happens when send and receive are both blocking: whichever process arrives first waits, and the message passes when both are present.'],  // glossary entry: defines a rendezvous
      ['Receive timeout', 'A time limit placed on a blocking receive: if no message arrives in time, the call gives up and returns an error instead of waiting forever.'],  // glossary entry: defines a receive timeout
      ['Direct addressing', 'Naming a specific process: send gives the destination process\'s ID, and receive either names the expected sender or accepts any sender.'],  // glossary entry: defines direct addressing
      ['Implicit addressing', 'A receive that does not name a sender. It accepts a message from any process and fills in the source parameter with the sender\'s ID when it completes.'],  // glossary entry: defines implicit addressing
      ['Indirect addressing', 'Sending to a shared mailbox instead of to a process. Receivers take messages from the mailbox, so senders and receivers do not need to know each other.'],  // glossary entry: defines indirect addressing
      ['Mailbox', 'A queue of messages kept as a shared data structure. Senders put messages in; receivers take them out.'],  // glossary entry: defines a mailbox
      ['Port', 'A mailbox tied to one receiving process, usually created and owned by it, that many senders can use. It is destroyed when its owner ends.'],  // glossary entry: defines a port
      ['Dynamic association', 'Linking processes to a mailbox while the system runs, with connect and disconnect calls, so senders can come and go. Its opposite, static association, fixes the link once and for all when the mailbox is set up.'],  // glossary entry: defines dynamic association and, by contrast, static association
      ['Message header', 'The descriptive part of a message: message type, destination ID, source ID, message length and control information such as a sequence number or priority.'],  // glossary entry: defines the message header and its fields
      ['Queuing discipline', 'The rule that picks which waiting message a receiver gets next: first-in-first-out by default, or by priority, or by the receiver\'s own choice.'],  // glossary entry: defines a queuing discipline
      ['Bounded buffer', 'A buffer with a fixed number of slots; a producer must wait when all slots are full and a consumer must wait when all are empty.'],  // glossary entry: defines a bounded buffer
    ],  // closes the glossary terms
    css: ` /* CSS used only by this section; every rule starts with .sec-5-6 so it cannot affect other sections */
      .sec-5-6 .narr { background: var(--panel-2); border: 1px solid var(--line); border-left: 5px solid var(--chc); border-radius: 12px; padding: 9px 13px; font-size: 15px; line-height: 1.45; } /* .narr: the explanation box: soft background, thin border and a thick coloured stripe on the left */
      .sec-5-6 .narr.ok { border-left-color: var(--ok); background: var(--ok-bg); } /* a green stripe and background when the explanation reports success */
      .sec-5-6 .narr.bad { border-left-color: var(--bad); background: var(--bad-bg); } /* a red stripe and background when the explanation reports a failure */
      .sec-5-6 .narr.warn { border-left-color: var(--warn); background: var(--warn-bg); } /* an amber stripe and background when the explanation is a warning */
      .sec-5-6 .lbl { font-size: 14px; font-weight: 700; color: var(--ink-2); white-space: nowrap; } /* .lbl: the small labels in front of button groups: bold, grey, and never broken over two lines */
      .sec-5-6 .missions { list-style: none; padding-left: 0 !important; margin: 0 !important; } /* .missions: the mission checklists in steps 4, 7 and 8 have no bullets and no extra indent */
      .sec-5-6 .missions li { display: flex; gap: 8px; align-items: flex-start; font-size: 14.5px; line-height: 1.35; margin: 0 0 6px !important; } /* each mission puts its tick box beside its text, both aligned to the top */
      .sec-5-6 .missions li .mk { flex: none; width: 20px; height: 20px; border-radius: 6px; border: 2px solid var(--line-2); display: grid; place-items: center; font-size: 13px; font-weight: 900; color: var(--ok); } /* .mk: the tick box itself, a small rounded square that shows a green tick when done */
      .sec-5-6 .missions li.done .mk { background: var(--ok-bg); border-color: var(--ok); } /* a finished mission's box turns green */
      .sec-5-6 .missions li.done { color: var(--ink-2); } /* a finished mission's text fades to grey so the open ones stand out */
      .sec-5-6 .log { font-size: 13px; } /* .log: small text for the running event log in step 4 */
      .sec-5-6 .mw0 > * { min-width: 0; } /* .mw0: lets the children of such an element shrink below their content width (no element here uses it yet) */
      .sec-5-6 pre.code { font-size: 13.5px; line-height: 1.45; } /* code listings in this section use a slightly smaller font so the pseudo-code fits beside the drawings */
      .sec-5-6 svg .env text { font-family: var(--mono); } /* labels under envelopes (like m3) use the fixed-width code font */
      .sec-5-6 .fmt { display: grid; grid-template-columns: 30px 34% minmax(0, 1fr); border: 1px solid var(--line); border-radius: 10px; overflow: hidden; font-size: 14px; } /* .fmt: step 6's message card as a grid: a thin side label, a field-name column and a value column */
      .sec-5-6 .fmt > div { padding: 4px 8px; border-bottom: 1px solid var(--line); cursor: pointer; min-width: 0; } /* every cell gets padding and a divider line, can be clicked, and may shrink so long values do not overflow */
      .sec-5-6 .fmt > div.last { border-bottom: 0; } /* the last row needs no divider under it */
      .sec-5-6 .fmt > div.side { padding: 0; display: grid; place-items: center; font-size: 11.5px; font-weight: 800; letter-spacing: .08em; writing-mode: vertical-rl; transform: rotate(180deg); cursor: default; } /* side label cells: vertical text in small spaced capitals, reading from bottom to top */
      .sec-5-6 .fmt > div.side.hd { grid-row: span 5; background: var(--os-bg); color: var(--os); } /* the HEADER side label spans the five header rows and uses the OS colour */
      .sec-5-6 .fmt > div.side.bd { background: var(--mem-bg); color: var(--mem); } /* the BODY side label uses the memory colour */
      .sec-5-6 .fmt > div.sel:not(.side) { background: var(--hl); } /* the selected field row is highlighted in yellow */
      .sec-5-6 .fbar { display: flex; height: 26px; border-radius: 8px; overflow: hidden; border: 1px solid var(--line-2); font-size: 12px; font-weight: 800; } /* .fbar: step 6's size bar, a rounded strip divided into header, body and padding pieces */
      .sec-5-6 .fbar > span { display: grid; place-items: center; white-space: nowrap; overflow: hidden; min-width: 0; } /* each piece centres its label and hides any text that does not fit */
      .sec-5-6 .fbar .hd { background: var(--os-bg); color: var(--os); } /* header pieces use the OS colour, matching the HEADER label */
      .sec-5-6 .fbar .bd { background: var(--mem-bg); color: var(--mem); } /* body pieces use the memory colour, matching the BODY label */
      .sec-5-6 .fbar .pad { background: repeating-linear-gradient(135deg, var(--panel-3) 0 5px, var(--panel) 5px 10px); color: var(--muted); } /* padding pieces are striped to show wasted bytes */
      .sec-5-6 .fbar .cut { border-right: 3px solid var(--ink-2); } /* .cut: a dark line where one fixed-length message ends and the next begins */
      .sec-5-6 .mqrow { display: grid; grid-template-columns: 40px 78px 64px 58px minmax(0, 1fr) 50px; align-items: center; gap: 6px; width: 100%; padding: 3px 8px; border: 1px solid var(--line); border-radius: 8px; background: var(--panel); color: var(--ink); font-size: 13.5px; text-align: left; font-family: inherit; } /* .mqrow: one waiting message in step 6's mailbox list, a six-column grid (number, type, sender, priority, label, next tag) */
      .sec-5-6 button.mqrow { cursor: pointer; } /* rows are buttons when the receiver chooses, so the pointer shows they can be clicked */
      .sec-5-6 button.mqrow:hover { border-color: var(--accent); } /* a clickable row's border lights up under the mouse */
      .sec-5-6 .mqrow.next { border: 2px solid var(--accent); background: var(--accent-bg); } /* .next: the message the next receive will return gets a thick accent outline */
      .sec-5-6 .mqrow .nx { font-size: 11.5px; font-weight: 800; color: var(--accent); text-transform: uppercase; letter-spacing: .06em; text-align: right; } /* .nx: the small "next" tag at the end of that row */
      .sec-5-6 .mqrow .ell { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } /* .ell: a long label is cut short with "..." instead of wrapping */
      .sec-5-6 .mq-nar .mqrow { grid-template-columns: 32px 70px 52px 40px minmax(0, 1fr) 38px; gap: 4px; padding: 3px 6px; } /* .mq-nar: smaller columns on phones so a whole row fits the screen width */
    `,  // end of the section CSS
    steps: [  // steps: the ten screens of this section, in order
      /* ---------------- 1. Big picture ---------------- */
      {  // step 1 begins
        title: 'Talk instead of share: send and receive',  // the step's title
        kind: 'story',  // kind "story" marks it as the Big Picture step, which is always on the core path
        html: `${/* the step's fixed HTML layout; render() below adds the interactive drawing into it */''}
          <div class="split fill">${/* layout: two columns that fill the step's height */''}
            <div class="stack" style="gap:9px">${/* left column: paragraphs and boxes stacked with a small gap */''}
              <p class="lead m0">Processes that work together need two things from each other: a way to stay in step (<b>synchronization</b>) and a way to hand over data (<b>communication</b>).</p>${/* opening paragraph: cooperating processes need synchronization and communication */''}
              <p class="m0">Semaphores and monitors handle the first and assume shared variables for the second. <span class="t">Message passing</span> does both with just two calls, <span class="t" data-t="Send primitive">send</span> and <span class="t" data-t="Receive primitive">receive</span>. A <span class="t">message</span> carries the data, and a process that waits for a message cannot run ahead of the process that sends it.</p>${/* paragraph: message passing does both with send and receive; dotted words open glossary entries */''}
              <table class="tbl compact" style="font-size:14px">${/* a small table of the two calls */''}
                <tr><th style="width:46%">The two primitives</th><th>What the call means</th></tr>${/* table heading row */''}
                <tr><td><code>send(destination, message)</code></td><td>“Deliver this message to that destination.”</td></tr>${/* table row: what send(destination, message) means */''}
                <tr><td><code>receive(source, message)</code></td><td>“Get a message from that source; keep it here.”</td></tr>${/* table row: what receive(source, message) means */''}
              </table>${/* end of the table */''}
              <div class="callout analogy m0" data-label="Analogy">Think of the ticket rail in a restaurant kitchen. A server clips an order to the rail (send); a cook pulls the next ticket (receive). The ticket carries the information, and no cook can start an order before its ticket exists.</div>${/* analogy callout: the order rail in a restaurant kitchen */''}
              <div class="row gap-s small"><span class="chip os">pick blocking rules</span><span class="chip proc">drive both sides</span><span class="chip mem">use mailboxes</span><span class="chip intr">lock with one message</span></div>${/* coloured chips previewing the hands-on steps that come later */''}
            </div>${/* end of the left column */''}
            <div class="card stack env-card" style="gap:8px"></div>${/* right column: an empty card that render() fills with the drawing */''}
          </div>`,  // end of the two-column layout and of the html text
        render(el, ctx) {  // render(): runs when step 1 is shown and builds the "one mechanism, three kinds of computer" drawing
          const { h, s } = ctx;  // pulls out the HTML and SVG element helpers
          const card = ctx.$('.env-card');  // finds the empty card on the right side of the layout
          // wide layout is 520 units across; phones get a narrower 380-unit drawing so the labels stay readable
          const n = ctx.narrow, W = n ? 380 : 520, H = n ? 262 : 250;  // n is true on phones; W and H are the drawing's width and height for that layout
          const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', role: 'img', 'aria-label': 'Where message passing runs' });  // the drawing area, described for screen readers
          const cap = h('div', { class: 'narr small' });  // cap: the caption under the drawing explaining what happens in the chosen computer
          const count = h('span', { class: 'chip mem' }, '0 delivered');  // count: a badge showing how many messages have been delivered
          let env = 'uni', delivered = 0, stopAnim = null;  // env is the chosen kind of computer; delivered counts messages; stopAnim stops a running animation
          const ENV = {  // ENV: the three kinds of computer, each with an envelope path, a caption and a drawing
            uni: {  // one processor that takes turns running P and Q
              pts: n ? [[62, 126], [62, 181], [318, 181], [318, 126]] : [[85, 126], [85, 181], [435, 181], [435, 126]],  // envelope path: from above P, along the row of boxes through the kernel, up to above Q
              cap: 'P and Q <b>take turns</b> on one processor (<span class="t">interleaving</span>). The kernel copies the message into its own buffer, then into Q\'s memory when Q receives. P and Q never touch each other\'s variables.',  // caption: P and Q take turns and the kernel copies the message between them
              draw: (trail) => [  // draw(): builds this picture; trail is the dashed path line, passed in so it sits under the boxes
                s('rect', { x: 8, y: 8, width: W - 16, height: 234, rx: 14, class: 's-panel', 'stroke-width': 1.5 }),  // the outline of the one computer
                s('text', { x: W - 20, y: 30, 'text-anchor': 'end', 'font-size': 13, class: 's-sub' }, n ? 'one processor' : 'one computer, one processor'),  // a label in the top right corner (shorter on phones)
                trail,  // the dashed path the envelope will follow
                box(s, n ? 22 : 30, n ? 40 : 30, n ? 176 : 170, 54, 'CPU', 's-cpu', 'runs P, then Q, in turns'),  // the single CPU box, which runs P and Q in turns
                box(s, n ? 16 : 30, 150, n ? 92 : 110, 62, 'P', 's-proc', 'sender'),  // process P, the sender
                box(s, n ? 138 : 205, 140, n ? 104 : 110, 82, 'Kernel', 's-os', 'message buffer'),  // the kernel, which holds the message in its buffer
                box(s, n ? 272 : 380, 150, n ? 92 : 110, 62, 'Q', 's-proc', 'receiver'),  // process Q, the receiver
              ],  // ends the one-processor picture
            },  // ends the one-processor entry
            multi: {  // a multiprocessor: two cores running P and Q at the same time
              pts: n ? [[95, 150], [95, 205], [285, 205], [285, 150]] : [[120, 150], [120, 205], [400, 205], [400, 150]],  // envelope path: down from P into the shared memory, across, and up to Q
              cap: 'With <span class="t">multiprocessing</span>, P and Q <b>really run at the same time</b> on different cores. The message is placed in a queue in the shared memory, and Q\'s receive takes it from there. The kernel keeps the queue safe from simultaneous updates.',  // caption: the message goes through a queue in shared memory that the kernel protects
              draw: (trail) => [  // draw(): builds the multiprocessor picture
                box(s, n ? 12 : 30, 16, n ? 166 : 180, 52, 'CPU 0', 's-cpu', 'running P'),  // CPU 0, running P
                box(s, n ? 202 : 310, 16, n ? 166 : 180, 52, 'CPU 1', 's-cpu', 'running Q'),  // CPU 1, running Q
                box(s, n ? 40 : 65, 84, 110, 52, 'P', 's-proc', 'sender'),  // process P, the sender
                box(s, n ? 230 : 345, 84, 110, 52, 'Q', 's-proc', 'receiver'),  // process Q, the receiver
                s('rect', { x: 10, y: 168, width: W - 20, height: 74, rx: 12, class: 's-mem', 'stroke-width': 2 }),  // a band along the bottom for the shared memory
                s('text', { x: 24, y: 190, 'font-size': 13, 'font-weight': 700, style: 'fill:var(--mem)' }, n ? 'shared' : 'shared memory'),  // its label ("shared" on phones, "shared memory" on wide screens)
                n ? s('text', { x: 24, y: 206, 'font-size': 13, 'font-weight': 700, style: 'fill:var(--mem)' }, 'memory') : null,  // on phones, the second word of the label on its own line
                trail,  // the dashed path, drawn over the memory band
                box(s, n ? 130 : 200, 178, 120, 54, 'Queue', 's-os', 'kept by kernel'),  // the message queue, kept by the kernel, drawn on top of the path
              ],  // ends the multiprocessor picture
            },  // ends the multiprocessor entry
            dist: {  // distributed processing: two machines joined only by a network
              pts: n ? [[88, 133], [88, 212], [292, 212], [292, 133]] : [[115, 133], [115, 212], [405, 212], [405, 133]],  // envelope path: down from P to its OS, across the network, up to Q
              cap: 'In <span class="t">distributed processing</span>, P and Q share <b>no memory at all</b>, so an ordinary semaphore or monitor, which lives in shared memory, has nowhere to live. Message passing works unchanged: each OS turns the message into network traffic and back.',  // caption: with no shared memory, only message passing still works
              draw: (trail) => {  // draw(): builds the two-machine picture
                const a = n ? 88 : 115, b = n ? 292 : 405, bw = n ? 140 : 150, mw = n ? 164 : 214;  // a and b are the centres of the two machines; bw is the box width; mw the machine width
                return [  // returns the shapes of this picture
                  s('rect', { x: a - mw / 2, y: 8, width: mw, height: 234, rx: 14, class: 's-panel', 'stroke-width': 1.5 }),  // outline of machine A
                  s('rect', { x: b - mw / 2, y: 8, width: mw, height: 234, rx: 14, class: 's-panel', 'stroke-width': 1.5 }),  // outline of machine B
                  trail,  // the dashed path the envelope will follow
                  s('text', { x: a, y: 30, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800 }, 'Machine A'),  // the heading "Machine A"
                  s('text', { x: b, y: 30, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800 }, 'Machine B'),  // the heading "Machine B"
                  box(s, a - bw / 2, 44, bw, 58, 'P', 's-proc', 'sender'),  // process P on machine A, the sender
                  box(s, b - bw / 2, 44, bw, 58, 'Q', 's-proc', 'receiver'),  // process Q on machine B, the receiver
                  box(s, a - bw / 2, 164, bw, 58, 'OS', 's-os', 'network code'),  // machine A's operating system, whose network code turns the message into network traffic
                  box(s, b - bw / 2, 164, bw, 58, 'OS', 's-os', 'network code'),  // machine B's operating system, which turns the traffic back into a message
                  s('line', { x1: a + bw / 2, y1: 212, x2: b - bw / 2, y2: 212, class: 's-line', 'stroke-dasharray': '6 5', style: 'stroke:var(--io)' }),  // a dashed line between the two OS boxes: the network cable
                  s('text', { x: (a + b) / 2, y: n ? 256 : 234, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, style: 'fill:var(--io)' }, 'network'),  // the label "network" under that line
                ];  // ends the list of shapes
              },  // ends the two-machine draw()
            },  // ends the distributed entry
          };  // closes the ENV table
          const mover = s('g', {});  // mover: a group that holds the envelope, so moving it only changes one position setting
          function place(p) {  // place(p): moves the envelope to the point a fraction p along the current path
            const [x, y] = along(ENV[env].pts, p);  // asks along() for the point at that fraction
            mover.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);  // shifts the envelope group to that point (rounded to one decimal place)
          }  // ends place()
          function paint(p) {  // paint(p): redraws the whole picture for the current computer with the envelope at fraction p
            const E = ENV[env];  // E is the settings of the chosen computer
            const trail = s('polyline', { points: E.pts.map((q) => q.join(',')).join(' '), class: 's-muted', 'stroke-dasharray': '4 5', fill: 'none' });  // the dashed trail line, built from the path's corner points
            mover.replaceChildren(envelope(s, 0, 0, null, p >= 1 ? 's-ok' : 's-mem'));  // the envelope is green once it has arrived (p reaches 1), otherwise in the memory colour
            svg.replaceChildren(...E.draw(trail), mover);  // puts the picture's shapes into the drawing, with the envelope group on top
            place(p);  // moves the envelope to its spot on the path
          }  // ends paint()
          function setEnv(v) {  // setEnv(v): runs when a computer button is chosen (and once at the start)
            if (stopAnim) { stopAnim(); stopAnim = null; }  // stops any envelope still in flight
            env = v;  // remembers the chosen computer
            paint(0);  // redraws with the envelope back at the start, above P
            cap.innerHTML = ENV[v].cap;  // shows that computer's caption
          }  // ends setEnv()
          function sendIt() {  // sendIt(): runs when "Send a message from P to Q" is pressed
            if (stopAnim) { stopAnim(); stopAnim = null; }  // stops any envelope still in flight
            paint(0);  // puts the envelope back at the start
            const t0 = performance.now();  // t0 records when this send started
            stopAnim = ctx.raf((t) => {  // ctx.raf runs the function below on every animation frame until it returns false
              const p = Math.min(1, (t - t0) / 1500);  // p goes from 0 to 1 over one and a half seconds
              place(p);  // moves the envelope along the path
              if (p >= 1) {  // once the envelope has arrived
                stopAnim = null; delivered += 1;  // forget the stop function and count one more delivery
                mover.replaceChildren(envelope(s, 0, 0, null, 's-ok'));  // turn the envelope green
                count.textContent = delivered + ' delivered';  // update the delivered badge
                cap.innerHTML = ENV[env].cap + ' <b>Delivered.</b> Q\'s receive now returns the message.';  // adds "Delivered" to the caption: Q's receive now returns the message
                return false;  // stops the animation
              }  // ends the arrival case
              return true;  // not there yet, so keep animating
            });  // ends the per-frame function
          }  // ends sendIt()
          const seg = ctx.ui.seg([{ value: 'uni', label: 'One processor' }, { value: 'multi', label: 'Multiprocessor' }, { value: 'dist', label: 'Distributed' }], env, setEnv);  // the three computer buttons: one processor, multiprocessor, distributed
          card.append(  // fills the right-hand card, top to bottom
            h('h4', { class: 'm0' }, 'One mechanism, three kinds of computer'),  // the card's heading
            seg,  // the computer buttons
            h('div', { class: 'card white', style: { padding: '6px' } }, svg),  // the drawing, on a white background
            h('div', { class: 'row' }, h('button', { class: 'btn primary sm', type: 'button', onclick: sendIt }, 'Send a message from P to Q'), count),  // the send button with the delivered badge beside it
            cap);  // the caption at the bottom
          setEnv('uni');  // starts with the one-processor picture
          return () => { if (stopAnim) stopAnim(); };  // clean-up for when the student leaves the step: stop any animation
        },  // ends render() for step 1
      },  // ends step 1
      /* ---------------- 2. Design map (configurator) ---------------- */
      {  // step 2 begins: a configurator of the four design choices
        title: 'Four design questions every message system answers',  // the step's title
        kind: 'learn',  // kind "learn": an explanation step
        render(el, ctx) {  // render(): runs when step 2 is shown and builds the whole configurator
          const { h } = ctx;  // pulls out the HTML element helper
          const ROWS = [  // ROWS: one entry per design choice; g is which group card it goes in, key names it, opts are the buttons
            { g: 0, key: 'send', label: 'send', opts: [['block', 'Blocking'], ['nb', 'Nonblocking']] },  // choice: send is blocking or nonblocking
            { g: 0, key: 'recv', label: 'receive', opts: [['block', 'Blocking'], ['nb', 'Nonblocking'], ['test', 'Test for arrival']] },  // choice: receive is blocking, nonblocking, or tests for arrival first
            { g: 1, key: 'addr', label: 'style', opts: [['dx', 'Direct, explicit'], ['di', 'Direct, implicit'], ['ind', 'Indirect (mailbox)']] },  // choice: addressing style (direct explicit, direct implicit, or a mailbox)
            { g: 1, key: 'bind', label: 'mailbox binding', opts: [['static', 'Static'], ['dynamic', 'Dynamic']], ind: true },  // choice: static or dynamic mailbox binding; ind marks it as mattering only with a mailbox
            { g: 1, key: 'own', label: 'mailbox owner', opts: [['recv', 'Receiver (port)'], ['os', 'The OS'], ['creator', 'Its creator']], ind: true },  // choice: who owns the mailbox; also mailbox-only
            { g: 2, key: 'len', label: 'length', opts: [['fixed', 'Fixed'], ['var', 'Variable']] },  // choice: fixed or variable message length
            { g: 3, key: 'q', label: 'order', opts: [['fifo', 'FIFO'], ['prio', 'Priority'], ['pick', 'Receiver chooses']] },  // choice: the order messages are handed out (FIFO, priority, or the receiver picks)
          ];  // closes the ROWS list
          const GROUPS = [['Synchronization', 'os'], ['Addressing', 'mem'], ['Format', 'io'], ['Queuing discipline', 'proc']];  // GROUPS: the four group cards, each with its heading and theme colour
          const TXT = {  // TXT: the sentence shown for every option of every choice
            send: { block: '<span class="t">Blocking send</span>: after <code>send</code>, the sender <b>waits</b> until its message has been received.', nb: '<span class="t">Nonblocking send</span>: after <code>send</code>, the sender <b>keeps running</b>; the message waits to be picked up.' },  // send options: the sender waits, or keeps running
            recv: { block: '<span class="t">Blocking receive</span>: with nothing waiting, <code>receive</code> <b>puts the receiver to sleep</b> until a message arrives.', nb: '<span class="t">Nonblocking receive</span>: with nothing waiting, <code>receive</code> <b>returns “no message”</b> at once and the receiver carries on.', test: 'The receiver first makes a <span class="t">test for arrival</span> (is anything there?) and calls receive only when the answer is yes.' },  // receive options: sleep until a message arrives, return "no message", or test first
            addr: { dx: '<span class="t">Direct addressing</span>, explicit: send names the receiving process; receive names the <b>one sender</b> it will accept.', di: '<span class="t">Direct addressing</span>, <span class="t" data-t="Implicit addressing">implicit</span>: send names the receiving process; receive <b>accepts anyone</b> and learns the sender\'s ID from its source parameter.', ind: '<span class="t">Indirect addressing</span>: messages go to a <span class="t">mailbox</span>, not a process, so senders and receivers never name each other.' },  // addressing options: explicit direct, implicit direct, or indirect through a mailbox
            bind: { static: '<span class="t" data-t="Dynamic association">Static association</span>: the mailbox is bound to its processes <b>for good</b> when it is set up.', dynamic: '<span class="t">Dynamic association</span>: processes attach and detach with <code>connect</code> and <code>disconnect</code> while running.' },  // binding options: fixed for good, or connect and disconnect while running
            own: { recv: 'The receiving process created and owns it: a <span class="t">port</span> that <b>vanishes when its owner ends</b>.', os: 'The OS owns it: it lives on until someone <b>explicitly destroys</b> it.', creator: 'The process that created it owns it, and it is <b>destroyed when that process ends</b>.' },  // owner options: a port that ends with its receiver, the OS, or the creating process
            len: { fixed: '<b>Fixed length:</b> easy to store and queue, but short messages waste space and long ones must be split.', var: '<b>Variable length:</b> no wasted space, but the <span class="t" data-t="Message header">header</span> must record the length and space is allocated per message.' },  // length options: the trade-off between fixed and variable length
            q: { fifo: 'A FIFO <span class="t">queuing discipline</span>: messages leave in <b>arrival order</b> (the usual default). Fair, but an urgent message waits behind routine ones.', prio: 'A priority <span class="t">queuing discipline</span>: <b>urgent messages jump ahead</b>, by message type or by a priority the sender chooses.', pick: 'The <span class="t">queuing discipline</span> is left to the receiver: it <b>inspects the queue</b> and picks the message it wants next.' },  // order options: FIFO, priority, or receiver's choice, each with its drawback
          };  // closes the TXT table
          const cfg = { send: 'nb', recv: 'block', addr: 'ind', bind: 'dynamic', own: 'recv', len: 'var', q: 'fifo' };  // cfg: the choices currently selected, starting with nonblocking send and blocking receive through a port
          let last = null;  // last remembers which choice changed most recently, so its sentence can flash
          const segs = {};  // segs holds each choice's button group, by key
          const rowEls = {};  // rowEls holds each choice's whole row (label plus buttons), so it can be faded
          const groupCard = (gi) => {  // groupCard(gi): builds the card for group gi with all of its choices
            const [name, col] = GROUPS[gi];  // the group's heading and colour
            const card = h('div', { class: 'card tight stack', style: { gap: '6px', borderLeft: `5px solid var(--${col})` } }, h('h4', { class: 'm0', style: { color: `var(--${col})` } }, name));  // a card with a coloured stripe down its left edge and a heading in the same colour
            ROWS.filter((r) => r.g === gi).forEach((r) => {  // goes through the choices that belong to this group
              segs[r.key] = ctx.ui.seg(r.opts.map(([v, l]) => ({ value: v, label: l })), cfg[r.key], (v) => { cfg[r.key] = v; last = r.key; paint(); });  // makes the choice's buttons; a click saves the choice, marks it as last changed and repaints
              if (!ctx.narrow) segs[r.key].style.flexWrap = 'nowrap';  // on wide screens the buttons stay on one line
              // phones: label on its own line above the choices; wide: label column + choices on one line
              rowEls[r.key] = ctx.narrow ? h('div', { class: 'stack', style: { gap: '4px' } }, h('span', { class: 'lbl' }, r.label), segs[r.key])  // phones: the choice's label sits on its own line above the buttons
                : h('div', { class: 'row nw', style: { gap: '10px' } }, h('span', { class: 'lbl', style: { width: gi > 1 ? '50px' : '124px' } }, r.label), segs[r.key]);  // wide screens: a fixed-width label column with the buttons beside it on one line
              card.append(rowEls[r.key]);  // adds the row to the card
            });  // ends the loop over choices
            return card;  // hands back the finished card
          };  // ends groupCard()
          const left = h('div', { class: 'stack', style: { gap: '8px' } },  // left column: an introduction and the four group cards
            h('p', { class: 'm0', html: 'Every message system makes the same handful of decisions. Change any choice and read, under <b>Your message system</b>, what it means for the processes. The next steps let you <b>try each one</b>.' }),  // introduction paragraph telling the student to change choices and read the result on the right
            groupCard(0), groupCard(1), h('div', { class: 'grid-2', style: { gap: '8px', gridTemplateColumns: ctx.narrow ? '' : 'max-content minmax(0, 1fr)' } }, groupCard(2), groupCard(3)));  // the Synchronization and Addressing cards full width, then Format and Queuing side by side in a two-column grid
          const list = h('ul', { class: 'small', style: { margin: 0, paddingLeft: '18px', lineHeight: 1.42 } });  // list: the bullet list that describes the configured message system
          const verdict = h('div', { class: 'callout m0' });  // verdict: a callout at the bottom judging the chosen send/receive combination
          const right = h('div', { class: 'card stack', style: { gap: '8px' } }, h('h4', { class: 'm0' }, 'Your message system'), list, h('div', { class: 'grow' }), verdict);  // right column: a card with its heading, the list, a spacer, and the verdict at the bottom
          el.append(h('div', { class: 'split r fill' }, left, right));  // puts the two columns side by side (stacked on phones)
          function paint() {  // paint(): rewrites the description and the verdict; runs at the start and after every click
            const ind = cfg.addr === 'ind';  // ind is true when a mailbox is used (indirect addressing)
            ['bind', 'own'].forEach((k) => { rowEls[k].style.opacity = ind ? '1' : '.4'; });  // fades the binding and owner rows when there is no mailbox, since they do not apply
            const items = [['send', TXT.send[cfg.send]], ['recv', TXT.recv[cfg.recv]], ['addr', TXT.addr[cfg.addr]]];  // the description always starts with the send, receive and addressing sentences
            if (ind) items.push(['bind', TXT.bind[cfg.bind]], ['own', TXT.own[cfg.own]]);  // with a mailbox, the binding and owner sentences are added
            else if (last === 'bind' || last === 'own') items.push([last, '<span class="muted">Mailbox binding and ownership only matter with indirect addressing. Switch the style to “Indirect” to use them.</span>']);  // without one, a grey note explains why a just-clicked binding or owner choice has no effect
            items.push(['len', TXT.len[cfg.len]], ['q', TXT.q[cfg.q]]);  // then the length and order sentences
            list.replaceChildren(...items.map(([k, t]) => h('li', { class: k === last ? 'flash' : '', html: t })));  // rebuilds the list, flashing the sentence for the choice that just changed
            const sy = cfg.send + '/' + cfg.recv;  // sy names the send/receive mix, such as "nb/block"
            let v;  // v will hold the verdict: its tone, its heading and its text
            if (sy === 'block/block') v = ['ok', 'Rendezvous', 'A <span class="t">rendezvous</span>: both sides wait for each other, giving tight synchronization, and only the one message being handed over needs storing. A blocking receive could wait forever if the message never comes, so real systems add a <span class="t" data-t="Receive timeout">timeout</span>.'];  // both blocking: a rendezvous, with the advice to add a timeout
            else if (sy === 'nb/block') v = ['ok', 'The most useful mix', 'Senders never stall, and an idle receiver sleeps without using the processor: ideal for a server. The risk is a buggy sender that sends over and over, flooding the system with messages.'];  // nonblocking send with blocking receive: the most useful mix, ideal for a server
            else if (sy === 'nb/nb') v = ['warn', 'Nobody ever waits', 'Fast and flexible, but the receiver must keep polling, and a message that arrives just after a receive returned empty can be missed.'];  // both nonblocking: nobody waits, but the receiver must poll and can miss messages
            else if (sy === 'nb/test') v = ['warn', 'Nobody waits, but it peeks', 'Testing for arrival lets the receiver do other work instead of blocking. It still has to remember to check again.'];  // nonblocking send with test for arrival: the receiver peeks before receiving
            else v = ['warn', 'An unusual mix', 'The sender waits for delivery while the receiver never waits. It works, but it is rarely chosen: the sender pays the cost of waiting and the receiver must still poll.'];  // any mix with a blocking send and a receive that never blocks: possible but rarely chosen
            verdict.className = 'callout m0 ' + (v[0] === 'ok' ? 'tip' : 'warn');  // the verdict box is green for the good mixes and amber for the risky ones
            verdict.setAttribute('data-label', v[1]);  // its small heading shows the verdict's name
            verdict.innerHTML = '<span class="small">' + v[2] + '</span>';  // its text, in the smaller font
          }  // ends paint()
          paint();  // fills the description once when the step opens
        },  // ends render() for step 2
      },  // ends step 2
      /* ---------------- 3. Three combinations (timeline player) ---------------- */
      {  // step 3 begins: a timeline player for three send/receive combinations
        title: 'Who waits? The three common combinations',  // the step's title
        kind: 'explore',  // kind "explore": an interactive exploration step
        render(el, ctx) {  // render(): runs when step 3 is shown and builds the timeline, the side card and the player
          const { h, s } = ctx;  // pulls out the HTML and SVG element helpers
          const R = 's-proc', W = 's-warn';  // short names for the two cell colours: R for running (process colour), W for waiting (blocked, amber)
          // each tick: [P cell class, P label, Q cell class, Q label, caption]; msgs: sent at tick a, received at tick b (null = not yet)
          const SC = {  // SC: the three scenarios, each a script of nine ticks (moments in time) for P and Q
            bb: {  // scenario 1: blocking send with blocking receive
              send: 'Blocking send', recv: 'Blocking receive',  // the two chips shown in the side card
              risk: ['warn', 'Watch out', 'A blocking call can wait <b>forever</b> if the partner crashes or the message is lost. The usual fixes are a <span class="t" data-t="Receive timeout">timeout</span> on receive, or testing for arrival first.'],  // the warning callout: a blocking call can wait forever, so use a timeout or test first
              msgs: [['m1', 1, 3], ['m2', 7, 7]],  // messages: m1 is sent at tick 1 and received at tick 3; m2 is sent and received together at tick 7
              ticks: [  // the nine ticks of this scenario
                [R, 'work', R, 'work', '<b><span class="t">Blocking send</span>, <span class="t">blocking receive</span>.</b> Both processes are busy with their own work. Press play or step forward.'],  // tick 0: both processes are doing their own work
                [W, 'send m1', R, 'work', 'P calls <code>send(Q, m1)</code>. Q has not asked for a message yet, so <b>P is blocked</b>: a blocking send returns only once the message has been received.'],  // tick 1: P sends m1 before Q is ready, so P blocks
                [W, 'blocked', R, 'work', 'P is still stuck. It can do nothing useful until Q gets around to receiving.'],  // tick 2: P is still stuck
                [R, 'resumes', R, 'got m1', 'Q calls <code>receive(P, msg)</code>. The message passes across and <b>both</b> continue. This meeting point is a <span class="t">rendezvous</span>.'],  // tick 3: Q receives, the message passes and both carry on: a rendezvous
                [R, 'work', R, 'work', 'Both run freely again. Now watch what happens when Q is the early one.'],  // tick 4: both run freely again
                [R, 'work', W, 'receive', 'Q calls receive, but P has nothing to send yet, so <b>Q is blocked</b>.'],  // tick 5: this time Q asks first, so Q blocks
                [R, 'work', W, 'blocked', 'Q waits. A blocked process uses no processor time, but it makes no progress either.'],  // tick 6: Q waits, using no processor time
                [R, 'send m2', R, 'got m2', 'P sends m2. Q is already waiting, so the message is delivered at once and <b>neither</b> process waits any longer.'],  // tick 7: P sends m2 to the waiting Q, so neither waits any longer
                [R, 'work', R, 'work', '<b>Rule:</b> whoever arrives first waits for the other. The two are tightly synchronized, and the system never has to store more than the one message being handed over.'],  // tick 8: the rule: whoever arrives first waits for the other
              ],  // ends the tick list
            },  // ends scenario 1
            nb: {  // scenario 2: nonblocking send with blocking receive (a server)
              send: 'Nonblocking send', recv: 'Blocking receive',  // the two chips shown in the side card
              risk: ['warn', 'Watch out', 'Nothing ever slows the sender, so a bug that sends in a loop can flood the system with messages. And P learns that a message arrived only if Q replies.'],  // the warning callout: a looping sender can flood the system
              msgs: [['m1', 1, 1], ['m2', 2, 4], ['m3', 3, 5], ['m4', 7, 7], ['m5', 8, null]],  // messages m1 to m5; m5 is sent at tick 8 and is still waiting when the timeline ends (null)
              ticks: [  // the nine ticks of this scenario
                [R, 'work', W, 'receive', '<b><span class="t">Nonblocking send</span>, blocking receive.</b> Q is a server. It calls receive and blocks, because no request has arrived. A blocked server uses no processor time.'],  // tick 0: Q, the server, blocks in receive because no request has arrived
                [R, 'send m1', R, 'got m1', 'P sends request m1 and <b>carries straight on</b>. The message wakes Q, which starts serving it.'],  // tick 1: P sends m1 and carries on; m1 wakes Q
                [R, 'send m2', R, 'serve m1', 'P sends m2 without waiting. Q is still busy, so m2 <b>waits in Q\'s queue</b> of incoming messages.'],  // tick 2: P sends m2 while Q is busy, so m2 waits in Q's queue
                [R, 'send m3', R, 'serve m1', 'And m3. The sender never stalls; the queue soaks up the burst.'],  // tick 3: P sends m3; the queue absorbs the burst
                [R, 'work', R, 'got m2', 'Q finishes m1 and calls receive again. A message is waiting, so receive returns m2 <b>immediately</b>, with no waiting at all.'],  // tick 4: Q receives again and gets m2 at once
                [R, 'work', R, 'got m3', 'm2 was a quick request. Q receives again and gets m3 at once. Nothing is left waiting.'],  // tick 5: Q gets m3 at once
                [R, 'work', W, 'receive', 'Nothing left, so Q blocks until the next request. The sender never waits and the receiver sleeps when idle: <b>the most useful combination</b> in practice.'],  // tick 6: nothing left, so Q blocks: the most useful combination
                [R, 'send m4', R, 'got m4', 'A new request wakes Q straight away.'],  // tick 7: a new request m4 wakes Q straight away
                [R, 'send m5', R, 'serve m4', 'P keeps sending while Q works. Useful for a server, and also the danger: see the warning on the right.'],  // tick 8: P keeps sending while Q works, which is also the danger
              ],  // ends the tick list
            },  // ends scenario 2
            nn: {  // scenario 3: nonblocking send with nonblocking receive
              send: 'Nonblocking send', recv: 'Nonblocking receive',  // the two chips shown in the side card
              risk: ['bad', 'Watch out', 'A message that arrives just after a receive came back empty is easily <b>missed</b>, and constant polling wastes processor time.'],  // the warning callout, in red: messages can be missed and polling wastes time
              msgs: [['m1', 1, 4], ['m2', 6, 7]],  // messages: m1 is sent at tick 1 but noticed only at tick 4; m2 is sent at tick 6 and received at tick 7
              ticks: [  // the nine ticks of this scenario
                [R, 'work', R, 'no msg', '<b>Nonblocking send, <span class="t">nonblocking receive</span>.</b> Q calls receive. Nothing is waiting, so receive returns “no message” at once and Q carries on.'],  // tick 0: Q's receive finds nothing and returns "no message"
                [R, 'send m1', R, 'work', 'P sends m1 and carries on. But Q already looked and <b>moved on</b>.'],  // tick 1: P sends m1, but Q has already looked and moved on
                [R, 'work', R, 'work', 'm1 sits in Q\'s queue <b>unnoticed</b>. If Q never looks again, the message is effectively lost.'],  // tick 2: m1 sits in the queue unnoticed
                [R, 'work', R, 'work', 'Still unnoticed. Q cannot know a message is there unless it checks.'],  // tick 3: still unnoticed
                [R, 'work', R, 'got m1', 'Q polls again and finally finds m1, three ticks late. Nobody blocked, but Q had to <b>keep asking</b>.'],  // tick 4: Q polls again and finally finds m1, three ticks late
                [R, 'work', R, 'no msg', 'Q polls again: nothing. Every empty poll is wasted work.'],  // tick 5: another empty poll, wasted work
                [R, 'send m2', R, 'work', 'P sends m2. Q is busy elsewhere.'],  // tick 6: P sends m2 while Q is busy elsewhere
                [R, 'work', R, 'got m2', 'Q polls and gets m2.'],  // tick 7: Q polls and gets m2
                [R, 'work', R, 'work', '<b>Nobody ever waits.</b> Maximum freedom, minimum coordination: the program must handle “no message yet” itself and poll often enough not to miss anything.'],  // tick 8: nobody ever waits, but the program must cope with "no message yet"
              ],  // ends the tick list
            },  // ends scenario 3
          };  // closes the SC table
          let cur = 'bb';  // cur is the scenario being shown; it starts with the blocking pair
          const nar = ctx.narrow;  // nar is true in the phone-width layout, where time runs downward instead of across
          // wide: time runs left to right (P row above, Q row below). Phones: time runs downward (P column, Q column)
          const X0 = 84, CW = 74, PY = 44, QY = 200, CH = 64, MID = (44 + 64 + 200) / 2;  // wide layout sizes: left edge of tick 0, column width, P and Q row tops, cell height, and the middle between rows
          const cx = (t) => X0 + t * CW + CW / 2;  // cx(t): the horizontal centre of tick t's column on wide screens
          const NY0 = 34, RH = 40, NCH = 32, PX = 46, QX = 228, NW = 100, LANE = (PX + NW + QX) / 2;  // phone layout sizes: first row top, row height, cell height, P and Q column lefts, cell width, and the middle lane
          const ry = (t) => NY0 + t * RH + RH / 2; // centre of tick row t on phones
          const svg = s('svg', { viewBox: nar ? '0 0 360 426' : '0 0 760 318', width: '100%', role: 'img', 'aria-label': 'Timeline of sender P and receiver Q' });  // the timeline drawing: tall on phones, wide on bigger screens
          const side = h('div', { class: 'card stack', style: { gap: '8px' } });  // side: the card to the right that describes the system and what is waiting
          const cellText = (lab) => ({ 'font-size': 13, 'font-weight': /send|got|receive|no msg/.test(lab) ? 800 : 500 });  // cellText(): cell labels are bold for events (send, got, receive, no msg) and normal for plain work
          function drawNarrow(S, i, K) {  // draws the phone-width version: P and Q as two columns, one row per tick, time running down
            K.push(s('rect', { x: 2, y: NY0 + i * RH, width: 356, height: RH, rx: 8, class: 's-accent', 'stroke-width': 0, opacity: 0.55 }));  // a pale highlight behind the current tick's row
            K.push(s('text', { x: 4, y: 20, 'font-size': 13, class: 's-sub' }, 'time ↓'));  // the "time" label with a downward arrow in the top corner
            K.push(s('text', { x: PX + NW / 2, y: 20, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800 }, 'P (sender)'));  // the P (sender) column heading
            K.push(s('text', { x: QX + NW / 2, y: 20, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800 }, 'Q (receiver)'));  // the Q (receiver) column heading
            for (let t = 0; t < 9; t++) {  // goes through the nine ticks, one row each
              const tk = S.ticks[t], y = NY0 + t * RH + (RH - NCH) / 2;  // tk is this tick's script entry; y is the top of its cells, centred in the row
              K.push(s('text', { x: 8, y: ry(t) + 5, 'font-size': 13, 'font-weight': t === i ? 800 : 400, class: t === i ? '' : 's-sub' }, 't' + t));  // the tick number (t0 to t8) at the left, bold for the current tick and grey for the others
              [[PX, tk[0], tk[1]], [QX, tk[2], tk[3]]].forEach(([x, cls, lab]) => {  // draws P's cell and Q's cell for this tick
                if (t > i) { K.push(s('rect', { x, y, width: NW, height: NCH, rx: 8, class: 's-muted', 'stroke-dasharray': '4 4' })); return; }  // a tick that has not happened yet shows only a dashed empty outline
                K.push(s('rect', { x, y, width: NW, height: NCH, rx: 8, class: cls, 'stroke-width': t === i ? 2.5 : 1.5 }));  // a past or current cell, coloured running or blocked, with a thicker border on the current tick
                K.push(s('text', { x: x + NW / 2, y: y + NCH / 2 + 5, 'text-anchor': 'middle', ...cellText(lab) }, lab));  // the cell's label, such as "send m1" or "blocked"
              });  // ends the P/Q cell loop
            }  // ends the tick loop
            S.msgs.forEach(([id, a, b]) => {  // draws each message
              if (a > i) return;  // skips messages that have not been sent by the current tick
              if (b != null && b <= i) {  // a message already received: an arrow from the sending row to the receiving row
                const y1 = ry(a), y2 = ry(b);  // the heights of the send and receive rows
                K.push(s('line', { x1: PX + NW + 2, y1, x2: QX - 4, y2, class: 's-line', style: 'stroke:var(--mem)', 'stroke-width': 2.5, 'marker-end': 'url(#arr-mem)' }));  // the arrow from P's column to Q's column, with an arrowhead, in the message colour
                // label sits above the start of the arrow so it never lands on a sloping line
                K.push(s('text', a === b ? { x: LANE, y: y1 - 6, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, style: 'fill:var(--mem)' } : { x: PX + NW + 6, y: y1 - 7, 'font-size': 13, 'font-weight': 800, style: 'fill:var(--mem)' }, id));  // the message name: centred over a flat arrow, or at the start of a sloping one
              } else {  // a message sent but not yet received
                const y = ry(a);  // the height of the row where it was sent
                K.push(s('line', { x1: PX + NW + 2, y1: y, x2: LANE - 16, y2: y, class: 's-line', style: 'stroke:var(--mem)', 'stroke-dasharray': '4 3' }));  // a short dashed line from P toward the middle lane
                K.push(envelope(s, LANE - 2, y, null, 's-mem', 26, 18), s('text', { x: LANE + 14, y: y + 5, 'font-size': 13, 'font-weight': 800, style: 'fill:var(--mem)' }, id));  // an envelope waiting in the middle lane, with the message name beside it
              }  // ends the not-yet-received case
            });  // ends the message loop
          }  // ends the phone-width drawing function
          function draw(i) {  // draw(i): the player calls this for tick i; it redraws the timeline and side card and returns the caption
            const S = SC[cur];  // S is the scenario being shown
            const K = [];  // K collects the shapes of the new drawing
            if (nar) drawNarrow(S, i, K);  // phones use the downward timeline built above
            else {  // wide screens: time runs from left to right
              K.push(s('rect', { x: X0 + i * CW + 1, y: 4, width: CW - 2, height: QY + CH + 8, rx: 8, class: 's-accent', 'stroke-width': 0, opacity: 0.55 }));  // a pale highlight behind the current tick's column
              K.push(s('text', { x: 6, y: 22, 'font-size': 13, class: 's-sub' }, 'time →'));  // the "time" label with a rightward arrow
              for (let t = 0; t < 9; t++) K.push(s('text', { x: cx(t), y: 22, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': t === i ? 800 : 400, class: t === i ? '' : 's-sub' }, 't' + t));  // the tick numbers across the top, bold for the current tick
              K.push(s('text', { x: 6, y: PY + 22, 'font-weight': 800, 'font-size': 16 }, 'P'), s('text', { x: 6, y: PY + 40, 'font-size': 13, class: 's-sub' }, 'sender'));  // the P row label, with "sender" under it
              K.push(s('text', { x: 6, y: QY + 22, 'font-weight': 800, 'font-size': 16 }, 'Q'), s('text', { x: 6, y: QY + 40, 'font-size': 13, class: 's-sub' }, 'receiver'));  // the Q row label, with "receiver" under it
              for (let t = 0; t < 9; t++) {  // goes through the nine ticks, one column each
                const tk = S.ticks[t];  // tk is this tick's script entry
                [[PY, tk[0], tk[1]], [QY, tk[2], tk[3]]].forEach(([y, cls, lab]) => {  // draws P's cell (top row) and Q's cell (bottom row)
                  if (t > i) { K.push(s('rect', { x: X0 + t * CW + 4, y, width: CW - 8, height: CH, rx: 8, class: 's-muted', 'stroke-dasharray': '4 4' })); return; }  // a future tick shows only a dashed empty outline
                  K.push(s('rect', { x: X0 + t * CW + 4, y, width: CW - 8, height: CH, rx: 8, class: cls, 'stroke-width': t === i ? 2.5 : 1.5 }));  // a past or current cell, coloured running or blocked, thicker on the current tick
                  K.push(s('text', { x: cx(t), y: y + CH / 2 + 5, 'text-anchor': 'middle', ...cellText(lab) }, lab));  // the cell's label, centred
                });  // ends the P/Q cell loop
              }  // ends the tick loop
              S.msgs.forEach(([id, a, b]) => {  // draws each message
                if (a > i) return;  // skips messages not yet sent
                if (b != null && b <= i) {  // a message already received: an arrow from P's row down to Q's row
                  const x1 = cx(a), x2 = cx(b);  // the columns where it was sent and received
                  K.push(s('line', { x1, y1: PY + CH + 2, x2, y2: QY - 4, class: 's-line', style: 'stroke:var(--mem)', 'stroke-width': 2.5, 'marker-end': 'url(#arr-mem)' }));  // the arrow, sloping when the receive came later, straight down when both happened together
                  K.push(s('text', { x: (x1 + x2) / 2 + (x1 === x2 ? 16 : 10), y: MID + 4, 'font-size': 13, 'font-weight': 800, style: 'fill:var(--mem)' }, id));  // the message name beside the middle of the arrow
                } else {  // a message sent but not yet received
                  const x = cx(a);  // the column where it was sent
                  K.push(s('line', { x1: x, y1: PY + CH + 2, x2: x, y2: MID - 12, class: 's-line', style: 'stroke:var(--mem)', 'stroke-dasharray': '4 3' }));  // a short dashed line down from P's cell
                  K.push(envelope(s, x, MID, null, 's-mem', 30, 20), s('text', { x: x + 20, y: MID + 5, 'font-size': 13, 'font-weight': 800, style: 'fill:var(--mem)' }, id));  // an envelope waiting between the rows, with its name beside it
                }  // ends the not-yet-received case
              });  // ends the message loop
            }  // ends the wide-screen drawing
            const blk = (col) => S.ticks.slice(0, i + 1).filter((tk) => tk[col] === W).length;  // blk(col): counts how many ticks so far showed P (column 0) or Q (column 2) as blocked
            const bp = blk(0), bq = blk(2);  // blocked-time totals for P and Q up to the current tick
            K.push(s('text', { x: 6, y: nar ? 418 : 306, 'font-size': 14, 'font-weight': 700 }, `Time spent blocked so far:\u00a0\u00a0 P ${bp} tick${bp === 1 ? '' : 's'} \u00a0·\u00a0 Q ${bq} tick${bq === 1 ? '' : 's'}`));  // a line under the timeline reporting those totals, with "tick" or "ticks" as needed
            svg.replaceChildren(...K);  // swaps the old drawing for the new one
            const inBox = S.msgs.filter(([, a, b]) => a <= i && (b == null || b > i)).map((m) => m[0]);  // inBox: names of messages sent by now but not yet received
            side.replaceChildren(  // rebuilds the side card
              h('h4', { class: 'm0' }, 'This system'),  // its heading
              h('div', { class: 'row gap-s' }, h('span', { class: 'chip os' }, S.send), h('span', { class: 'chip os' }, S.recv)),  // chips naming the send and receive types of this scenario
              h('h4', { style: { margin: '6px 0 0' } }, `Sent, not yet received, at t${i}`),  // a heading for the messages still waiting at the current tick
              h('div', { class: 'row gap-s', style: { minHeight: '30px' } }, ...(inBox.length ? inBox.map((m) => h('span', { class: 'chip mem' }, m)) : [h('span', { class: 'small muted' }, 'none')])),  // one chip per waiting message, or "none"; the minimum height stops the card from jumping
              h('div', { class: 'grow' }),  // a spacer pushing the warning to the bottom
              h('div', { class: `callout ${S.risk[0]} m0`, 'data-label': S.risk[1], html: `<span class="small">${S.risk[2]}</span>` }));  // the scenario's warning callout
            return S.ticks[i][4];  // returns the caption for this tick, which the player shows above its controls
          }  // ends draw()
          const seg = ctx.ui.seg([{ value: 'bb', label: 'Blocking send + blocking receive' }, { value: 'nb', label: 'Nonblocking send + blocking receive' }, { value: 'nn', label: 'Nonblocking send + nonblocking receive' }], cur, (v) => { cur = v; player.reset(); });  // the three scenario buttons; choosing one rewinds the player to tick 0
          const legend = h('div', { class: 'row gap-s xs' }, h('span', { class: 'chip proc' }, 'running'), h('span', { class: 'chip warn' }, 'blocked'), h('span', { class: 'chip mem' }, 'message'));  // a legend of the three colours: running, blocked, message
          const main = h('div', { class: 'card white', style: { padding: '8px 10px' } }, svg);  // main: the timeline drawing on a white card
          const player = ctx.ui.player({ count: 9, render: draw, interval: 2200 });  // the player: Restart, Previous, Play/Pause and Next buttons over 9 ticks, auto-advancing every 2.2 seconds
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },  // builds the step's layout, top to bottom
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, seg, legend),  // the scenario buttons on the left and the legend on the right
            h('div', { class: 'grow', style: { display: 'grid', gridTemplateColumns: ctx.narrow ? 'minmax(0, 1fr)' : 'minmax(0, 2.5fr) minmax(0, 1fr)', gap: '14px' } }, main, side),  // the timeline beside the side card on wide screens, one above the other on phones
            player.el));  // the player controls at the bottom
        },  // ends render() for step 3
      },  // ends step 3
      /* ---------------- 4. Mailbox playground (lab) ---------------- */
      {  // step 4 begins: the mailbox playground, where the student drives both processes
        title: 'Mailbox playground: you run the sender and receiver',  // the step's title
        kind: 'lab',  // kind "lab": a hands-on step
        core: true,  // core: true keeps this step on the shorter core path through the guide
        render(el, ctx) {  // render(): runs when step 4 is shown and builds the playground
          const { h, s } = ctx;  // pulls out the HTML and SVG element helpers
          let sendMode = 'block', recvMode = 'block';  // the current rules: send and receive each start as blocking
          let P, Q, queue, n, tick, emptyPoll;  // P, Q: the two processes' states; queue: waiting messages; n: messages sent; tick: time; emptyPoll: last receive was empty
          const done = { rv: false, srv: false, miss: false, rescue: false };  // done records which missions the student has finished
          const MISSIONS = [  // MISSIONS: the four challenges, each with its key and its text
            ['rv', '<b><span class="t">Rendezvous</span>.</b> With blocking send and blocking receive, make one process wait for the other, then let the message pass.'],  // mission: make a rendezvous happen with both calls blocking
            ['srv', '<b>Server pattern.</b> With nonblocking send and blocking receive, get 3 messages waiting in the mailbox at once.'],  // mission: build up 3 waiting messages, the server pattern
            ['miss', '<b>Missed message.</b> With nonblocking receive, let a message arrive just after Q\'s receive came back empty.'],  // mission: let a message arrive just after an empty nonblocking receive
            ['rescue', '<b>Stuck forever.</b> Crash P while Q waits in a blocking receive, then free Q with a <span class="t" data-t="Receive timeout">timeout</span>.'],  // mission: crash P while Q is blocked, then free Q with a timeout
          ];  // closes the missions list
          const svg = s('svg', { viewBox: ctx.narrow ? '0 0 360 272' : '0 0 640 172', width: '100%', role: 'img', 'aria-label': 'Sender P, mailbox A and receiver Q' });  // the drawing of P, mailbox A and Q
          const rules = h('div', { class: 'callout why m0 small', 'data-label': 'The rules right now' });  // rules: a callout restating the current send and receive rules
          const narr = h('div', { class: 'narr' });  // narr: the "what just happened" explanation box
          const mlist = h('ul', { class: 'missions' });  // mlist: the mission checklist
          const log = h('div', { class: 'log grow' });  // log: a running list of every call, one line per tick
          const say = (html, tone) => { narr.className = 'narr' + (tone ? ' ' + tone : ''); narr.innerHTML = html; };  // say(): shows a message in the explanation box, coloured by its tone
          const note = (txt) => { log.append(h('div', {}, `t${tick}: ${txt}`)); log.scrollTop = log.scrollHeight; };  // note(): adds a line such as "t3: Q computes" to the log and scrolls it so the newest line is visible
          function reset(msg) {  // reset(msg): starts the playground over; runs at the start, on Reset, and when a rule changes
            P = { st: 'run', wait: null }; Q = { st: 'run', got: null }; queue = []; n = 0; tick = 0; emptyPoll = false;  // both processes running, empty mailbox, no messages sent, time back to 0
            log.replaceChildren(h('div', {}, `start: send is ${sendMode === 'block' ? 'blocking' : 'nonblocking'}, receive is ${recvMode === 'block' ? 'blocking' : 'nonblocking'}`));  // the log restarts with a line stating the current send and receive rules
            say(msg || 'Fresh start. Use the buttons under P and Q to make calls, in any order you like, and watch who ends up waiting.');  // shows the given message, or a default invitation to start making calls
            paint();  // draws the fresh state
          }  // ends reset()
          function win(k) { if (!done[k]) { done[k] = true; ctx.toast('Mission complete!'); } }  // win(k): marks mission k as done and pops up a short "Mission complete!" notice, only the first time
          // ---- P's calls ----
          function pSend() {  // pSend(): P's send button
            if (P.st !== 'run') return;  // does nothing unless P is running (not blocked or crashed)
            tick++;  // time moves on one tick
            const id = 'm' + (++n);  // gives the new message the next name: m1, m2, ...
            if (Q.st === 'blocked') {  // Q is already blocked in receive, waiting for a message
              Q.st = 'run'; Q.got = id; emptyPoll = false;  // the message goes straight to Q, which wakes up holding it
              note(`P send(${id}) → handed straight to the waiting Q`);  // logs the direct hand-over
              say(`P sends ${id}. Q was already <b>blocked in receive</b>, so ${id} goes straight to Q and Q wakes up. P ${sendMode === 'block' ? 'does not have to wait either, because its message was received at once' : 'carries on as usual'}.`, 'ok');  // explains it; a blocking send returns at once here because the message was received immediately
              if (sendMode === 'block' && recvMode === 'block') win('rv');  // with both calls blocking, this meeting completes the rendezvous mission
            } else {  // Q is not waiting, so the message goes into the mailbox
              const unseen = recvMode === 'nb' && emptyPoll;  // unseen: with nonblocking receive, Q's last look found nothing, so Q does not know this one is here
              queue.push({ id, waiting: sendMode === 'block', unseen });  // adds the message to the mailbox, noting whether P is waiting for it and whether Q has missed it
              if (sendMode === 'block') {  // with a blocking send
                P.st = 'blocked'; P.wait = id;  // P is blocked until this message is received
                note(`P send(${id}) → P blocked until ${id} is received`);  // logs that P is blocked
                say(`P sends ${id}, but Q is not receiving right now. A blocking send does not return until the message is received, so <b>P is now blocked</b>.`, 'warn');  // explains why P is now blocked
              } else {  // with a nonblocking send
                note(`P send(${id}) → queued, P keeps running`);  // logs that P keeps running
                say(`P sends ${id} and <b>keeps running</b> (nonblocking send). ${id} waits in the mailbox until someone receives it.`);  // explains that the message simply waits in the mailbox
              }  // ends the blocking/nonblocking choice
              if (unseen) {  // the message arrived right after an empty nonblocking receive
                win('miss');  // that completes the missed-message mission
                say(`P sends ${id}. But Q's last nonblocking receive already came back empty, so Q has <b>no idea</b> ${id} is here. If Q never asks again, ${id} is effectively lost.`, 'bad');  // replaces the explanation: Q has no idea the message is here
              }  // ends the missed-message case
              if (sendMode === 'nb' && recvMode === 'block' && queue.length >= 3) win('srv');  // three or more waiting under nonblocking send and blocking receive completes the server mission
            }  // ends the "into the mailbox" branch
            paint();  // repaints the drawing, rules, buttons and missions
          }  // ends pSend()
          function pWork() { if (P.st !== 'run') return; tick++; note('P computes'); say('P does some of its own computing. Messages are only exchanged when a process calls send or receive.'); paint(); }  // pWork(): P's compute button: time passes and P does its own work, with no messages involved
          function pCrash() {  // pCrash(): the crash / restart button for P
            tick++;  // time moves on one tick
            if (P.st === 'crashed') { P.st = 'run'; note('P restarted'); say('P is running again and can send.'); }  // if P had crashed, this press restarts it
            else {  // otherwise P crashes now
              P.st = 'crashed'; P.wait = null; queue.forEach((m) => { m.waiting = false; });  // P stops for good and stops waiting; no queued message has a blocked sender any more
              note('P crashed');  // logs the crash
              say(`P has <b>crashed</b>. It will never send again.${Q.st === 'blocked' ? ' Q is blocked in receive, waiting for a message that can now never come.' : ' If Q now makes a blocking receive on an empty mailbox, it will wait forever.'}`, 'bad');  // explains the danger: a blocked Q (or a later blocking receive) will wait forever
            }  // ends the crash case
            paint();  // repaints everything
          }  // ends pCrash()
          // ---- Q's calls ----
          function qRecv() {  // qRecv(): Q's receive button
            if (Q.st !== 'run') return;  // does nothing unless Q is running
            tick++;  // time moves on one tick
            if (queue.length) {  // a message is waiting in the mailbox
              const m = queue.shift();  // takes the oldest message out of the mailbox
              Q.got = m.id; emptyPoll = false;  // Q now holds it, and its last receive was not empty
              let extra = '';  // extra will hold any added note about P
              if (m.waiting && P.st === 'blocked' && P.wait === m.id) {  // if P was blocked waiting for exactly this message
                P.st = 'run'; P.wait = null;  // P is released
                extra = ' P was blocked until this delivery, so <b>P is released too</b>: the two processes met at a rendezvous.';  // the note says the two processes met at a rendezvous
                if (sendMode === 'block' && recvMode === 'block') win('rv');  // with both calls blocking, that completes the rendezvous mission
              }  // ends the release case
              note(`Q receive → got ${m.id}`);  // logs what Q got
              say(`Q receives ${m.id}${m.unseen ? ' (at last: it had been sitting there unnoticed)' : ''}. A message was waiting, so receive returned at once.${extra}`, 'ok');  // explains the receive, mentioning when the message had been sitting there unnoticed
            } else if (recvMode === 'block') {  // the mailbox is empty and receive is blocking
              Q.st = 'blocked';  // Q is blocked until a message arrives
              note('Q receive → mailbox empty, Q blocked');  // logs that Q is blocked
              say(`The mailbox is empty, so <b>Q is blocked</b> until a message arrives.${P.st === 'crashed' ? ' But P has crashed, so nothing will ever arrive. Q is stuck for good unless the timeout fires.' : ''}`, 'warn');  // explains it, warning that with P crashed nothing will ever arrive
            } else {  // the mailbox is empty and receive is nonblocking
              emptyPoll = true; Q.got = 'none';  // remembers the empty result so a message arriving next counts as missed
              note('Q receive → no message, Q keeps running');  // logs the empty result
              say('Nonblocking receive: nothing is waiting, so it returns <b>“no message”</b> immediately and Q carries on with other work.');  // explains that receive returned "no message" at once
            }  // ends the three receive cases
            paint();  // repaints everything
          }  // ends qRecv()
          function qTest() {  // qTest(): Q's "test for arrival" button
            if (Q.st !== 'run') return;  // does nothing unless Q is running
            tick++;  // time moves on one tick
            const seen = queue.some((m) => m.unseen);  // seen: whether any message had been sitting there unnoticed
            queue.forEach((m) => { m.unseen = false; }); emptyPoll = false; // Q now knows exactly what is waiting
            note(`Q test for arrival → ${queue.length} waiting`);  // logs how many messages are waiting
            say(`<span class="t">Test for arrival</span>: <b>${queue.length ? queue.length + ' message' + (queue.length > 1 ? 's' : '') + ' waiting' : 'nothing waiting'}</b>. Q took nothing and did not block; now it can decide whether to call receive.${seen ? ' The message it had missed is no longer unnoticed.' : ''}`);  // reports the count without taking anything and without blocking
            paint();  // repaints everything
          }  // ends qTest()
          function qWork() { if (Q.st !== 'run') return; tick++; note('Q computes'); say('Q does some of its own computing and is not listening for messages.'); paint(); }  // qWork(): Q's compute button: Q does its own work and is not listening for messages
          function qTimeout() {  // qTimeout(): the "timeout expires" button, usable only while Q is blocked
            if (Q.st !== 'blocked') return;  // does nothing unless Q is blocked in receive
            tick++;  // time moves on one tick
            Q.st = 'run'; Q.got = 'timeout';  // Q is running again and its last receive ended in a timeout error
            if (P.st === 'crashed') win('rescue');  // if P had crashed, this completes the rescue mission
            note('Q receive timed out → error returned');  // logs the timeout
            say('The <b>timeout</b> expires. receive gives up and returns an error, so Q can deal with the problem (report it, retry, pick another sender) instead of waiting forever.', 'ok');  // explains that the error lets Q handle the problem instead of waiting forever
            paint();  // repaints everything
          }  // ends qTimeout()
          // ---- drawing ----
          // wide: P | mailbox | Q in one row. Phones: P and Q side by side, the mailbox underneath
          const G = !ctx.narrow ? {  // G holds the drawing's coordinates; the wide layout comes first, the phone-width one after the colon
            vb: '0 0 640 172', P: [10, 20, 150, 128], Q: [480, 20, 150, 128], mbLab: [320, 40], mb: [212, 52, 216, 64],  // wide: drawing size, P's box on the left, Q's box on the right, and the mailbox label and box in between
            env: (k) => [240 + k * 40, 78], arrows: [[162, 84, 208, 84], [430, 84, 476, 84]], more: [426, 136], oldest: [214, 136], red: [320, 162],  // wide: envelope slots, the two arrows, and the spots for the "+N more", "oldest" and red-envelope notes
          } : {  // the phone-width layout starts here
            vb: '0 0 360 272', P: [8, 8, 164, 120], Q: [188, 8, 164, 120], mbLab: [180, 158], mb: [20, 166, 320, 60],  // phones: a taller drawing with P and Q side by side at the top and the mailbox label and box underneath
            env: (k) => [56 + k * 56, 188], arrows: [[90, 130, 90, 162], [270, 164, 270, 132]], more: [338, 244], oldest: [22, 244], red: [180, 266],  // phones: envelope slots, a down arrow from P and an up arrow to Q, and the note spots
          };  // closes the two layouts
          const stCls = (st) => (st === 'blocked' ? 's-warn' : st === 'crashed' ? 's-bad' : 's-proc');  // stCls(): box colour for a process state: amber when blocked, red when crashed, the process colour when running
          function procBox([x, y, w, hh], name, role, st, status, detail) {  // procBox(): draws a big process box with its name, role, status and one detail line
            const c = x + w / 2, k = hh / 128; // text rows scale with the box height
            return s('g', {},  // groups the box and its text into one piece
              s('rect', { x, y, width: w, height: hh, rx: 12, class: stCls(st), 'stroke-width': 2.5 }),  // the box outline, coloured by the process's state
              s('text', { x: c, y: y + 30 * k, 'text-anchor': 'middle', 'font-weight': 900, 'font-size': 24 }, name),  // the process name in large bold letters
              s('text', { x: c, y: y + 50 * k, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, role),  // its role ("sender" or "receiver") in grey
              s('text', { x: c, y: y + 80 * k, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800, style: st === 'run' ? '' : `fill:var(--${st === 'crashed' ? 'bad' : 'warn'})` }, status),  // its status in bold, tinted red when crashed or amber when blocked
              s('text', { x: c, y: y + 102 * k, 'text-anchor': 'middle', 'font-size': 13 }, detail));  // a detail line, such as "until m2 is received"
          }  // ends procBox()
          function paint() {  // paint(): redraws the playground after every call
            const K = [];  // K collects the shapes of the new drawing
            K.push(procBox(G.P, 'P', 'sender', P.st, P.st === 'run' ? 'running' : P.st === 'blocked' ? 'blocked in send' : 'crashed',  // P's box, with its status: running, blocked in send, or crashed
              P.st === 'blocked' ? `until ${P.wait} is received` : P.st === 'crashed' ? 'will never send' : `sent ${n} so far`));  // P's detail: the message it waits for, "will never send", or how many it has sent
            const qd = Q.st === 'blocked' ? 'waiting for a message' : Q.got == null ? 'nothing received yet' : Q.got === 'none' ? 'last try: no message' : Q.got === 'timeout' ? 'last try: timeout error' : `holding ${Q.got}`;  // qd: Q's detail line: waiting, nothing yet, last receive empty, timed out, or the message it holds
            K.push(procBox(G.Q, 'Q', 'receiver', Q.st, Q.st === 'run' ? 'running' : 'blocked in receive', qd));  // Q's box, running or blocked in receive
            K.push(s('text', { x: G.mbLab[0], y: G.mbLab[1], 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 15 }, 'mailbox A'));  // the "mailbox A" label
            const [mx, my, mw, mh] = G.mb;  // unpacks the mailbox rectangle
            K.push(s('rect', { x: mx, y: my, width: mw, height: mh, rx: 10, class: 's-mem', 'stroke-width': 2 }));  // the mailbox box in the memory colour
            G.arrows.forEach(([x1, y1, x2, y2]) => K.push(s('line', { x1, y1, x2, y2, class: 's-line', 'marker-end': 'url(#arr)' })));  // the two arrows: P into the mailbox, and the mailbox out to Q
            const shown = queue.slice(0, 5);  // at most five envelopes are drawn
            if (!shown.length) K.push(s('text', { x: mx + mw / 2, y: my + mh / 2 + 5, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, 'empty'));  // writes "empty" in the middle of an empty mailbox
            shown.forEach((m, k) => { const [x, y] = G.env(k); K.push(envelope(s, x, y, m.id, m.unseen ? 's-bad' : 's-panel', 32, 22)); });  // one envelope per waiting message with its name; red if Q has not noticed it
            if (queue.length > 5) K.push(s('text', { x: G.more[0], y: G.more[1], 'text-anchor': 'end', 'font-size': 13, 'font-weight': 800 }, `+${queue.length - 5} more`));  // with more than five waiting, a "+N more" count
            K.push(s('text', { x: G.oldest[0], y: G.oldest[1], 'font-size': 13, class: 's-sub' }, queue.length ? 'oldest on the left' : ''));  // a reminder that the oldest message is on the left (only when something is waiting)
            K.push(s('text', { x: G.red[0], y: G.red[1], 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, queue.some((m) => m.unseen) ? 'red = arrived after Q\'s empty receive (unnoticed)' : ''));  // explains red envelopes, but only while there is one
            svg.replaceChildren(...K);  // swaps the old drawing for the new one
            rules.innerHTML = (sendMode === 'block' ? '<b><span class="t">Blocking send</span>:</b> P stops until its message has been received.' : '<b><span class="t">Nonblocking send</span>:</b> P always continues at once; the message waits in the mailbox.') + '<br>' +  // restates the send rule in words, with glossary links
              (recvMode === 'block' ? '<b><span class="t">Blocking receive</span>:</b> with an empty mailbox, Q sleeps until a message arrives.' : '<b><span class="t">Nonblocking receive</span>:</b> with an empty mailbox, Q gets “no message” and continues.');  // restates the receive rule in words
            // buttons
            bP.send.disabled = P.st !== 'run'; bP.work.disabled = P.st !== 'run';  // P's send and compute buttons work only while P is running
            bP.crash.textContent = P.st === 'crashed' ? 'restart P' : 'crash P';  // the crash button reads "restart P" after a crash
            bQ.recv.disabled = Q.st !== 'run'; bQ.test.disabled = Q.st !== 'run'; bQ.work.disabled = Q.st !== 'run';  // Q's receive, test and compute buttons work only while Q is running
            bQ.to.disabled = Q.st !== 'blocked';  // the timeout button works only while Q is blocked
            mlist.replaceChildren(...MISSIONS.map(([k, t]) => h('li', { class: done[k] ? 'done' : '' }, h('span', { class: 'mk' }, done[k] ? '✓' : ''), h('span', { html: t }))));  // rebuilds the mission checklist, with a tick beside each finished mission
          }  // ends paint()
          const B = (label, fn, cls) => h('button', { class: 'btn sm ' + (cls || ''), type: 'button', onclick: fn }, label);  // B(): makes a small button with a label, a click handler and an optional style
          const bP = { send: B('send(A, m)', pSend, 'primary'), work: B('compute', pWork), crash: B('crash P', pCrash, 'danger') };  // P's buttons: send(A, m), compute, and a red crash button
          const bQ = { recv: B('receive(A, m)', qRecv, 'primary'), test: B('test for arrival', qTest), work: B('compute', qWork), to: B('timeout expires', qTimeout) };  // Q's buttons: receive(A, m), test for arrival, compute, and timeout expires
          const segS = ctx.ui.seg([{ value: 'block', label: 'Blocking' }, { value: 'nb', label: 'Nonblocking' }], sendMode, (v) => { sendMode = v; reset('New rule for send. Fresh start.'); });  // the send rule buttons; changing the rule starts the playground over
          const segR = ctx.ui.seg([{ value: 'block', label: 'Blocking' }, { value: 'nb', label: 'Nonblocking' }], recvMode, (v) => { recvMode = v; reset('New rule for receive. Fresh start.'); });  // the receive rule buttons; changing the rule starts the playground over
          const top = h('div', { class: 'row', style: { gap: '14px' } }, h('span', { class: 'lbl' }, 'send is'), segS, h('span', { class: 'lbl' }, 'receive is'), segR, h('div', { class: 'grow' }), B('Reset', () => reset()));  // the top row: both rule selectors, a spacer, and Reset
          const ctlP = h('div', { class: 'card tight proc row' + (ctx.narrow ? '' : ' nw'), style: { gap: '8px' } }, h('span', { class: 'lbl', style: { width: '124px' } }, 'P (sender) calls'), bP.send, bP.work, h('div', { class: 'grow' }), bP.crash);  // P's control strip: label, send, compute, a spacer and the crash button; one line on wide screens
          const ctlQ = h('div', { class: 'card tight proc row' + (ctx.narrow ? '' : ' nw'), style: { gap: '8px' } }, h('span', { class: 'lbl', style: { width: '124px' } }, 'Q (receiver) calls'), bQ.recv, bQ.test, bQ.work, h('div', { class: 'grow' }), bQ.to);  // Q's control strip: label, receive, test, compute, a spacer and the timeout button
          const left = h('div', { class: 'stack', style: { gap: '10px' } }, top, h('div', { class: 'card white grow', style: { padding: '6px 8px', display: 'grid', alignItems: 'center' } }, svg), ctlP, ctlQ, rules);  // left column: rules, the drawing (taking spare height), both control strips and the rules callout
          const right = h('div', { class: 'stack', style: { gap: '10px' } }, h('h4', { class: 'm0' }, 'What just happened'), narr, h('div', { class: 'card tight' }, h('h4', { class: 'm0 mb' }, 'Missions'), mlist), log);  // right column: the explanation, the missions card and the growing log
          el.append(h('div', { class: 'split r fill' }, left, right));  // puts the columns side by side (stacked on phones)
          reset();  // starts the playground fresh
        },  // ends render() for step 4
      },  // ends step 4
      /* ---------------- 5. Addressing explorer (two tabs) ---------------- */
      {  // step 5 begins: two tabs about addressing
        title: 'Addressing explorer: who names whom?',  // the step's title
        kind: 'explore',  // kind "explore": an interactive exploration step
        render(el, ctx) {  // render(): runs when step 5 is shown
          el.append(ctx.ui.tabs([  // builds a tab strip; switching tabs runs the new tab's builder and the old tab's clean-up
            { label: 'Direct or indirect, in four patterns', render: (p) => addressingTab(p, ctx) },  // tab 1: direct or indirect addressing in the four patterns, built by addressingTab()
            { label: 'Mailboxes and ports: binding and ownership', render: (p) => ownershipTab(p, ctx) },  // tab 2: mailbox binding and ownership, built by ownershipTab()
          ]));  // closes the tab list and adds the tabs to the step
        },  // ends render() for step 5
      },  // ends step 5
      /* ---------------- 6. Message format builder + queuing discipline ---------------- */
      {  // step 6 begins: build a message, then pick a queuing discipline
        title: 'Build a message, then choose the order it comes out',  // the step's title
        kind: 'lab',  // kind "lab": a hands-on step
        render(el, ctx) {  // render(): runs when step 6 is shown and builds the message builder and the mailbox
          const { h } = ctx;  // pulls out the HTML element helper
          const HDR = 16, FIXED = 64, CAP = 6;  // sizes: a 16-byte header, a 64-byte body for fixed-length messages, and room for 6 messages in the mailbox
          const BODY = { ok: { text: '“ok”', short: 'ok', bytes: 2 }, print: { text: '“print report.pdf, 2 copies”', short: 'print…', bytes: 26 }, rec: { text: '[a 200-byte data record]', short: 'record', bytes: 200 } };  // BODY: the three sample bodies, with their full text, short label and size in bytes
          const FIELD = {  // FIELD: the explanation shown when a row of the message card is clicked
            type: '<b>Message type</b>, the first field of the <span class="t" data-t="Message header">header</span>, says what kind of message this is (a request, a reply, an alarm), so the receiver knows how to handle it and a mailbox can sort by kind.',  // explains the message type field
            dest: '<b>Destination ID</b> says where it is going: a process (direct addressing) or a mailbox (indirect addressing).',  // explains the destination ID field
            src: '<b>Source ID</b> says who sent it, so the receiver knows whom to answer. With implicit receive, this is how the receiver finds out.',  // explains the source ID field
            len: '<b>Message length</b> says how many bytes the body holds. Essential when lengths vary; with fixed-length messages every message is the same size.',  // explains the message length field
            ctl: '<b>Control information</b> is bookkeeping: a sequence number (to spot lost or out-of-order messages), a priority, or a link to the next message in the queue.',  // explains the control information field
            body: 'The <b>body</b> is the actual contents. The system only carries it; what it means is up to the sender and receiver.',  // explains the body
          };  // closes the FIELD table
          const m = { type: 'request', from: 'P2', prio: 2, body: 'print', fixed: false };  // m: the message being built: its type, sender, priority, body, and fixed or variable length
          let seq = 0, disc = 'fifo', queue = [], sel = 'type', hist = [];  // seq numbers messages; disc is the queuing discipline; queue waits; sel is the chosen field; hist is received order
          const histRow = h('div', { class: 'row gap-s', style: { minHeight: '26px' } });  // histRow: chips showing the messages received so far, in order
          const card = h('div', { class: 'fmt' });   // a grid, so the HEADER label can span five rows without a rowspan cell
          const fieldNote = h('div', { class: 'narr small' });  // fieldNote: the explanation of the selected field
          const bar = h('div', { class: 'fbar' });  // bar: the size bar showing header, body and padding bytes
          const barCap = h('div', { class: 'small muted' });  // barCap: the sentence under the size bar
          const sendBtn = h('button', { class: 'btn sm primary', type: 'button', onclick: send });  // sendBtn: sends the built message into mailbox A
          const list = h('div', { class: 'stack' + (ctx.narrow ? ' mq-nar' : ''), style: { gap: '4px' } });   // phones: tighter columns so a row fits in 390 px
          const fillChip = h('span', { class: 'chip mem' });  // fillChip: a badge showing how many of the 6 mailbox slots are used
          const discNote = h('div', { class: 'small muted' });  // discNote: a sentence explaining the chosen queuing discipline
          const narr = h('div', { class: 'narr' });  // narr: the explanation of the last action
          const recvBtn = h('button', { class: 'btn sm primary', type: 'button', onclick: () => take(pick()) }, 'receive(A, msg)');  // recvBtn: receives the message the discipline picks
          const parts = () => (m.fixed ? Math.ceil(BODY[m.body].bytes / FIXED) : 1);  // parts(): how many messages the body needs: 1 for variable length, or body size / 64 rounded up for fixed
          function paintMsg() {  // paintMsg(): redraws the message card, field note, size bar and send button
            const B = BODY[m.body], n = parts();  // B is the chosen body; n is how many messages it needs
            const rows = [  // rows: each field's key, name and current value
              ['type', 'Message type', m.type], ['dest', 'Destination ID', 'mailbox A'], ['src', 'Source ID', m.from],  // rows: type, destination (always mailbox A) and source
              ['len', 'Message length', m.fixed ? `${FIXED} bytes (every message)` : `${B.bytes} bytes`],  // row: the length, which is always 64 for fixed-length messages
              ['ctl', 'Control info', `seq #${seq + 1}${n > 1 ? '–' + (seq + n) : ''} · priority ${m.prio}`], ['body', 'Body', B.text]];  // rows: control info (sequence number range and priority) and the body text
            card.replaceChildren(...rows.flatMap(([k, label, val], i) => {  // rebuilds the message card: each field becomes a row of grid cells
              const on = () => { sel = k; paintMsg(); }, cls = (k === sel ? 'sel' : '') + (k === 'body' ? ' last' : '');  // clicking a row selects that field and redraws; cls highlights the selected row and marks the last one
              const cells = [];  // cells collects this row's grid cells
              if (i === 0) cells.push(h('div', { class: 'side hd' }, 'HEADER'));  // before the first row, the tall HEADER side label that spans the five header rows
              if (k === 'body') cells.push(h('div', { class: 'side bd last' }, 'BODY'));  // before the body row, the BODY side label
              cells.push(h('div', { class: 'b ' + cls, onclick: on }, label), h('div', { class: (k === 'body' || k === 'ctl' ? '' : 'mono ') + cls, onclick: on }, val));  // the field name in bold and its value; IDs and sizes use the code font, the body and control info do not
              return cells;  // hands back this row's cells
            }));  // ends the rows and fills the card
            fieldNote.innerHTML = FIELD[sel];  // shows the explanation for the selected field
            // size bar
            const segs = [];  // segs will list the size bar's pieces: colour class, byte count and label
            if (!m.fixed) segs.push(['hd', HDR, 'header'], ['bd', B.bytes, B.bytes + ' B']);  // variable length: one header piece and one body piece of exactly the body's size
            else for (let p = 0; p < n; p++) { const used = Math.min(FIXED, B.bytes - p * FIXED); segs.push(['hd', HDR, n > 2 ? 'h' : 'header'], ['bd', used, used + ' B'], ['pad' + (p < n - 1 ? ' cut' : ''), FIXED - used, FIXED - used > 8 ? 'padding' : '']); }  // fixed length: for each part a header, the bytes used, and the padding, with a dark cut line between parts
            const tot = segs.reduce((a, q) => a + q[1], 0);  // tot is the total number of bytes, used to turn each piece into a share of the bar
            bar.replaceChildren(...segs.filter((q) => q[1] > 0).map(([c, b, t]) => h('span', { class: c, style: { width: (100 * b / tot) + '%' }, title: b + ' bytes' }, 100 * b / tot > 7 ? t : '')));  // draws each non-empty piece with a width in proportion to its bytes; tiny pieces get no label
            const pad = n * FIXED - B.bytes;  // pad: how many bytes of the fixed-length bodies go unused
            barCap.innerHTML = !m.fixed ? `${HDR}-byte header + ${B.bytes}-byte body = <b>${HDR + B.bytes} bytes</b>. Nothing wasted, but the length field is essential and space must be found for each message.`  // caption for variable length: header plus body, nothing wasted
              : n === 1 ? `Every message is ${HDR} + ${FIXED} = ${HDR + FIXED} bytes. This body uses ${B.bytes} of its ${FIXED} bytes: <b>${pad} bytes are padding</b>, wasted.`  // caption for fixed length that fits in one message: how many bytes are padding
                : `${B.bytes} bytes do not fit in one ${FIXED}-byte body, so the sender must <b>split it into ${n} messages</b> (and ${pad} bytes of the last one are padding).`;  // caption for fixed length that does not fit: the body must be split into several messages
            sendBtn.textContent = n > 1 ? `send(A, msg) × ${n}` : 'send(A, msg)';  // the send button shows "× n" when one send becomes several messages
          }  // ends paintMsg()
          const pick = () => {  // pick(): the message the current discipline would hand out next
            if (!queue.length || disc === 'pick') return null;  // none when the mailbox is empty or when the receiver chooses for itself
            if (disc === 'fifo') return queue[0];  // FIFO: the oldest message, at the front of the queue
            return queue.reduce((best, q) => (q.prio > best.prio ? q : best), queue[0]); // highest priority; ties go to the oldest
          };  // ends pick()
          function paintQueue() {  // paintQueue(): redraws the mailbox list, the fill badge, the receive button, the history and the discipline note
            const nx = pick();  // nx is the message the next receive would return
            fillChip.textContent = `${queue.length} / ${CAP} slots used`;  // updates the badge, for example "4 / 6 slots used"
            list.replaceChildren(...(queue.length ? queue.map((q) => {  // one row per waiting message, or an "empty" row
              const kids = [h('span', { class: 'b mono' }, '#' + q.seq), h('span', { class: 'chip ' + (q.type === 'alarm' ? 'intr' : q.type === 'reply' ? 'ok' : 'proc') }, q.type), h('span', {}, 'from ' + q.from), h('span', {}, 'prio ' + q.prio), h('span', { class: 'ell muted' }, q.label), h('span', { class: 'nx' }, q === nx ? 'next' : '')];  // a row's cells: number, type chip (alarm, reply and request in different colours), sender, priority, label, next tag
              return disc === 'pick' ? h('button', { class: 'mqrow', type: 'button', onclick: () => take(q) }, ...kids) : h('div', { class: 'mqrow' + (q === nx ? ' next' : '') }, ...kids);  // when the receiver chooses, each row is a clickable button; otherwise a plain row, outlined if it is next
            }) : [h('div', { class: 'mqrow muted', style: { display: 'block' } }, 'The mailbox is empty. Build a message on the left and send it.')]));  // the row shown when the mailbox is empty
            recvBtn.disabled = disc === 'pick' || !queue.length;  // the receive button is off when the receiver chooses by clicking, or when nothing is waiting
            histRow.replaceChildren(...(hist.length ? hist.map((q) => h('span', { class: 'chip ' + (q.type === 'alarm' ? 'intr' : q.type === 'reply' ? 'ok' : 'proc') }, '#' + q.seq + ' · p' + q.prio)) : [h('span', { class: 'small muted' }, 'nothing yet')]));  // the received-so-far chips, each showing number and priority, or "nothing yet"
            discNote.innerHTML = { fifo: '<b>FIFO:</b> messages leave in arrival order. Simple and fair, but an urgent message waits behind older routine ones.',  // discipline note for FIFO: simple and fair, but urgent messages wait
              prio: '<b>Priority:</b> the highest priority leaves first (ties in arrival order). Urgent work goes first, but low-priority messages can wait a long time.',  // discipline note for priority: urgent work first, but low priority can wait a long time
              pick: '<b>Receiver chooses:</b> the receiver looks through the queue and takes the one it wants. <b>Click a message</b> to receive it.' }[disc];  // discipline note for receiver's choice: click a message to receive it
          }  // ends paintQueue()
          function send() {  // send(): the send button: puts the built message (or its parts) into mailbox A
            const n = parts();  // n is how many messages this body needs
            if (queue.length + n > CAP) { narr.className = 'narr bad'; narr.innerHTML = `The mailbox has room for ${CAP} messages and ${queue.length} are waiting, so ${n > 1 ? 'these ' + n + ' messages do' : 'this message does'} not fit. A full mailbox makes the sender wait or fail. Receive some first.`; return; }  // if they will not fit in the 6 slots, explains that a full mailbox makes the sender wait or fail, and stops
            for (let p = 1; p <= n; p++) queue.push({ seq: ++seq, type: m.type, from: m.from, prio: m.prio, label: n > 1 ? `part ${p}/${n}` : BODY[m.body].short });  // adds each part to the back of the queue with its own sequence number
            narr.className = 'narr ok';  // the explanation turns green
            narr.innerHTML = n > 1 ? `Sent as <b>${n} separate messages</b>, #${seq - n + 1} to #${seq}, each with its own header. The receiver must put the parts back together.` : `Message #${seq} (${m.type}, priority ${m.prio}) joins the end of the queue in mailbox A.`;  // reports the send, or that the body went as several messages the receiver must reassemble
            paintMsg(); paintQueue();  // redraws the card (its next sequence number changes) and the mailbox
          }  // ends send()
          function take(q) {  // take(q): the receiver takes message q out of the mailbox
            if (!q) return;  // nothing to take, so do nothing
            const older = queue.indexOf(q);  // older is how many messages were ahead of it in the queue
            queue = queue.filter((x) => x !== q);  // removes it from the mailbox
            hist.push(q);  // adds it to the received-so-far history
            narr.className = 'narr';  // resets the explanation colour
            narr.innerHTML = `The receiver gets <b>#${q.seq}</b> (${q.type}, priority ${q.prio}). ` + (older === 0 ? 'It was the oldest message waiting.' : `It went ahead of <b>${older}</b> older message${older > 1 ? 's' : ''}: ${disc === 'prio' ? 'a higher priority beats arrival order.' : 'the receiver chose it.'}`);  // reports what was received and whether it jumped ahead of older messages, and why
            paintQueue();  // redraws the mailbox
          }  // ends take()
          function sample() {  // sample(): the "Add 4 sample messages" button, and the starting contents of the mailbox
            const S = [['request', 'P1', 1, 'print'], ['reply', 'P3', 2, 'ok'], ['request', 'P2', 1, 'ok'], ['alarm', 'P2', 3, 'ok']];  // the four samples: type, sender, priority and body; the high-priority alarm is last
            let k = 0, alarm = false;  // k counts how many fit; alarm records whether the alarm got in
            for (const [type, from, prio, body] of S) { if (queue.length >= CAP) break; queue.push({ seq: ++seq, type, from, prio, label: BODY[body].short }); k++; alarm = alarm || type === 'alarm'; }  // adds the samples one by one until the mailbox is full
            narr.className = 'narr'; narr.innerHTML = !k ? 'The mailbox is already full. Receive some messages first.' : `${k} ready-made message${k > 1 ? 's' : ''} arrived${alarm ? ', with a high-priority alarm at the back' : ''}${k < S.length ? ' (the mailbox filled up before the rest fit)' : ''}. Now compare what each discipline delivers first.`;  // reports how many arrived, points out the alarm at the back, and notes any that did not fit
            paintMsg(); paintQueue();  // redraws the card and the mailbox
          }  // ends sample()
          const setM = (k) => (v) => { m[k] = v; paintMsg(); };  // setM(k): makes the click handler for one message setting: store the value, then redraw the card
          const nw = (seg) => { if (!ctx.narrow) seg.style.flexWrap = 'nowrap'; return seg; };  // nw(): keeps a button group on one line on wide screens
          const L = (t, w) => h('span', { class: 'lbl', style: { width: w || '58px' } }, t);  // L(): a label with a fixed width so the controls line up
          // each control is a label + choices pair; wide screens put two pairs on a line, phones one pair per line
          const pair = (label, w, seg) => [L(label, ctx.narrow ? '64px' : w), nw(seg)];  // pair(): a label and its button group; phones use a wider label
          const line = (...pairs) => (ctx.narrow ? pairs.map((pp) => h('div', { class: 'row', style: { gap: '8px' } }, ...pp)) : [h('div', { class: 'row', style: { gap: '8px' } }, ...pairs.flat())]);  // line(): two pairs share a line on wide screens; on phones each pair gets its own line
          const controls = h('div', { class: 'stack', style: { gap: '7px' } },  // controls: the message settings, stacked
            ...line(pair('Type', '58px', ctx.ui.seg(['request', 'reply', 'alarm'], m.type, setM('type'))), pair('From', '40px', ctx.ui.seg(['P1', 'P2', 'P3'], m.from, setM('from')))),  // Type (request, reply, alarm) and From (P1 to P3)
            ...line(pair('Priority', '58px', ctx.ui.seg([{ value: 1, label: '1 low' }, { value: 2, label: '2' }, { value: 3, label: '3 high' }], m.prio, setM('prio'))), pair('Length', '52px', ctx.ui.seg([{ value: false, label: 'variable' }, { value: true, label: 'fixed 64 B' }], m.fixed, setM('fixed')))),  // Priority (1 to 3) and Length (variable or fixed 64 bytes)
            ...line(pair('Body', '58px', ctx.ui.seg([{ value: 'ok', label: '“ok”' }, { value: 'print', label: 'print request' }, { value: 'rec', label: '200-byte record' }], m.body, setM('body')))));  // Body: the short "ok", a print request, or a 200-byte record
          const left = h('div', { class: 'stack', style: { gap: '8px' } }, controls, card, fieldNote, bar, barCap, h('div', { class: 'row' }, sendBtn, h('span', { class: 'small muted' }, 'Click a row of the message to see what that field is for.')));  // left column: settings, the message card, the field note, the size bar and its caption, then Send with a hint
          const discSeg = nw(ctx.ui.seg([{ value: 'fifo', label: 'FIFO' }, { value: 'prio', label: 'Priority' }, { value: 'pick', label: 'Receiver chooses' }], disc, (v) => { disc = v; hist = []; narr.className = 'narr'; narr.innerHTML = 'New queuing discipline. The waiting messages have not moved; only the rule for which one leaves next has changed.'; paintQueue(); }));  // the discipline buttons; changing them clears the history but leaves the waiting messages where they are
          const right = h('div', { class: 'card stack', style: { gap: '8px' } },  // right column: the mailbox card
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'Mailbox A, oldest at the top'), fillChip),  // its heading, with the slots-used badge
            h('div', { class: 'row', style: { gap: '8px' } }, h('span', { class: 'lbl', style: { width: '76px' }, html: '<span class="t" data-t="Queuing discipline">Discipline</span>' }), discSeg), discNote, list, h('div', { class: 'grow' }), h('h4', { class: 'm0' }, 'Received so far, in order'), histRow,  // the discipline selector and note, the queue, a spacer, then the received history
            h('div', { class: 'row gap-s' }, recvBtn, h('button', { class: 'btn sm', type: 'button', onclick: sample }, 'Add 4 sample messages'), h('button', { class: 'btn sm', type: 'button', onclick: () => { queue = []; hist = []; narr.className = 'narr'; narr.innerHTML = 'Mailbox emptied.'; paintQueue(); } }, 'Empty it')), narr);  // receive, add samples, and "Empty it" (which clears the mailbox and history), then the explanation
          el.append(h('div', { class: 'split fill', style: { gap: '18px' } }, left, right));  // puts the two columns side by side (stacked on phones)
          sample(); // start with four waiting messages so the disciplines can be compared straight away
          narr.innerHTML = 'Mailbox A already holds 4 messages, with a priority-3 <b>alarm</b> at the back. Receive a few with each discipline and compare the order. <b>Empty it</b> to start over.';  // replaces the sample message with a welcome that points at the waiting alarm
        },  // ends render() for step 6
      },  // ends step 6
      /* ---------------- 7. Mutual exclusion with one token message ---------------- */
      {  // step 7 begins: mutual exclusion with a single token message
        title: 'Mutual exclusion with a single message',  // the step's title
        kind: 'lab',  // kind "lab": a hands-on step
        core: true,  // core: true keeps this step on the shorter core path
        render(el, ctx) {  // render(): runs when step 7 is shown and builds the code, the drawing and the controls
          const { h, s } = ctx;  // pulls out the HTML and SVG element helpers
          const code = listing(ctx, [  // code: the pseudo-code every process runs, with a note on each line, built by listing()
            ['create_mailbox(box);', 'one mailbox, shared by all'],  // shown code, row 1: create the shared mailbox
            ['send(box, null);', 'put in ONE message: the token'],  // shown code, row 2: put exactly one message in it, the token
            ['while (true) {', 'every process Pi loops forever'],  // shown code, row 3: each process loops forever
            ['  receive(box, msg);', 'take the token, or block'],  // shown code, row 4: receive the token, or block until it comes back
            ['  critical_section();', 'only the holder gets here'],  // shown code, row 5: the critical section, reached only while holding the token
            ['  send(box, msg);', 'put the token back'],  // shown code, row 6: send the token back
            ['  remainder();', 'work that needs no token'],  // shown code, row 7: the remainder, work that needs no token
            ['}', 'go round and ask again']], { fontSize: 13 });  // shown code, row 8: end of the loop; the options set a 13-pixel font
          code.style.flex = 'none';  // keeps the code box at its natural height so the layout never squeezes it
          const NAMES = ['P1', 'P2', 'P3'];  // the names of the three processes
          let init = 1, pr, box, waitQ, maxIn, steps, auto = null, rng;  // init: tokens at set-up; pr: where each process is; box: tokens in the mailbox; plus the wait line, counters, timer and random source
          const done = { enter: false, block: false, hand: false, break2: false };  // done records which missions the student has finished
          const MISSIONS = [['enter', 'Get a process into its critical section.'], ['block', 'While it is inside, make another process ask.'],  // missions 1 and 2: get a process inside, then make another ask while it is inside
            ['hand', 'Pass the token straight to a waiting process.'], ['break2', '<b>Break it:</b> start with 2 messages; get 2 inside.']];  // missions 3 and 4: hand the token to a waiter, and break mutual exclusion with 2 tokens
          // geometry: column centres for each place a process can be; phones get a narrower drawing with two-line headings
          const G7 = !ctx.narrow ? {  // G7 holds the drawing's coordinates; wide screens first, the phone-width layout after the colon
            vb: '0 0 660 250', top: 36, mb: [12, 146], cs: [505, 142], lane: [176, 500], pill: 104, RY: [70, 136, 202], COL: { rem: 272, blk: 420, cs: 575 },  // wide: drawing size, box top, mailbox and critical-section boxes, lane ends, pill width, row heights, column centres
            heads: [[['mailbox “box”'], 85], [['remainder'], 272], [['blocked in receive'], 420], [['critical section'], 575, true]],  // wide: the four column headings and where they sit; the last one is coloured like the critical section
          } : {  // the phone-width layout starts here
            vb: '0 0 380 256', top: 42, mb: [4, 86], cs: [276, 100], lane: [92, 272], pill: 84, RY: [78, 142, 206], COL: { rem: 138, blk: 226, cs: 326 },  // phones: the same pieces squeezed into a 380-unit-wide drawing
            heads: [[['mailbox', '“box”'], 47], [['remainder'], 138], [['blocked in', 'receive'], 226], [['critical', 'section'], 326, true]],  // phones: the headings split over two lines so they fit
          };  // closes the two layouts
          const svg = s('svg', { viewBox: G7.vb, width: '100%', role: 'img', 'aria-label': 'Mailbox with the token, and where each process is' });  // the drawing area, described for screen readers
          const narr = h('div', { class: 'narr' });  // narr: the explanation of the last call
          const mlist = h('ul', { class: 'missions' });  // mlist: the mission checklist
          const stat = h('div', { class: 'row gap-s' });  // stat: a row of badges with live counts
          const btns = NAMES.map((n, i) => h('button', { class: 'btn sm primary', type: 'button', onclick: () => stepP(i) }));  // one button per process; pressing it runs that process's next call
          const autoBtn = h('button', { class: 'btn sm', type: 'button', onclick: toggleAuto });  // autoBtn: starts or stops the random scheduler
          const say = (html, tone) => { narr.className = 'narr' + (tone ? ' ' + tone : ''); narr.innerHTML = html; };  // say(): shows a message in the explanation box, coloured by its tone
          const win = (k) => { if (!done[k]) { done[k] = true; ctx.toast('Mission complete!'); } };  // win(k): marks mission k as done and shows a short notice, only the first time
          const inCS = () => pr.filter((p) => p === 'cs').length;  // inCS(): how many processes are in the critical section right now
          function reset(msg) {  // reset(msg): starts over; runs at the start, on Reset, and when the token count changes
            pr = ['rem', 'rem', 'rem']; box = init; waitQ = []; maxIn = 0; steps = 0; rng = ctx.util.seeded(11);  // everyone in the remainder, init tokens in the mailbox, nobody waiting, counters at 0, a fresh seeded random source
            code.clear(); code.mark(init === 1 ? [1, 2] : 2, init === 1 ? 'cur' : 'bad');  // highlights the set-up rows of the code, or row 2 in red when the token count is wrong
            say(msg || (init === 1 ? 'Set-up done: the shared <span class="t">mailbox</span> holds <b>one</b> message, the token. Whoever holds it may run its <span class="t">critical section</span>, which gives <span class="t">mutual exclusion</span>. In 5.2, processes that only exchanged messages needed no lock; these share a resource, so a message becomes the lock. Click a process to run its next call: you are the scheduler.' : init === 0 ? 'Set-up forgot the token: the mailbox starts <b>empty</b>. Try to get anyone into the critical section.' : 'Set-up put <b>two</b> messages in the mailbox. See what that allows.'), init === 1 ? '' : 'warn');  // explains the set-up: one token means mutual exclusion; 0 or 2 invite the student to see what goes wrong
            paint();  // draws the fresh state
          }  // ends reset()
          function stepP(i) {  // stepP(i): runs process i's next call, from its button, its pill in the drawing, or the random scheduler
            const N = NAMES[i];  // N is the process's name
            steps += 1;  // counts one more call
            if (pr[i] === 'rem') {  // the process is in its remainder, so its next call is receive
              code.clear(); code.mark(4);  // highlights row 4 of the code, the receive
              if (box > 0) {  // a token is in the mailbox
                box -= 1; pr[i] = 'cs';  // takes it and enters the critical section
                const n = inCS(); maxIn = Math.max(maxIn, n);  // n is how many are inside now; maxIn keeps the highest number ever
                code.mark(5, n > 1 ? 'bad' : 'ok');  // highlights row 5: green when alone inside, red when mutual exclusion is broken
                if (n > 1) { win('break2'); say(`${N}'s receive finds a message, so ${N} enters too. <b>${n} processes are in the critical section at once</b>: mutual exclusion is broken. The number of messages placed in the mailbox is how many processes may be inside together, just like the starting value of a semaphore.`, 'bad'); }  // more than one inside: completes the break-it mission and explains that the token count works like a semaphore's start value
                else { win('enter'); say(`${N} calls <code>receive(box, msg)</code>. The token is there, so ${N} takes it and <b>enters its critical section</b>. The mailbox is now ${box ? 'still holding ' + box : 'empty'}.`, 'ok'); }  // alone inside: completes the first mission and explains the entry
              } else {  // the mailbox is empty
                pr[i] = 'blk'; waitQ.push(i);  // the process blocks and joins the end of the waiting line
                if (inCS()) win('block');  // if someone is inside while it asks, that completes the second mission
                say(`${N} calls <code>receive(box, msg)</code>, but the mailbox is empty, so <b>${N} blocks</b>. It uses no processor time while it waits${inCS() > 1 ? ' for one of the tokens to come back' : inCS() ? ` for ${NAMES[pr.indexOf('cs')]} to return the token` : init === 0 ? ', and since no token exists, it will wait forever' : ''}. Position in line: ${waitQ.length}.`, init === 0 ? 'bad' : 'warn');  // explains the block, saying whom it waits for, or that it will wait forever when no token exists
              }  // ends the receive case
            } else if (pr[i] === 'cs') {  // the process is in its critical section, so its next call is send
              pr[i] = 'rem';  // it goes back to its remainder
              code.clear(); code.mark(6);  // highlights row 6 of the code, the send
              if (waitQ.length) {  // someone is waiting in receive
                const j = waitQ.shift(); pr[j] = 'cs'; win('hand');  // the first waiter gets the token straight away and is now inside; completes the hand-over mission
                code.mark(5, 'ok');  // highlights row 5 too, for the process that just entered
                say(`${N} leaves and calls <code>send(box, msg)</code>. ${NAMES[j]} was blocked in receive, so the token goes <b>straight to ${NAMES[j]}</b>, which wakes up inside its critical section. Only one waiter gets it; the others keep waiting.`, 'ok');  // explains the direct hand-over: only one waiter wakes
              } else {  // nobody is waiting
                box += 1;  // the token goes back into the mailbox
                say(`${N} leaves its critical section and calls <code>send(box, msg)</code>. Nobody is waiting, so the token goes back into the mailbox for whoever asks next.`);  // explains that the token waits for whoever asks next
              }  // ends the hand-over choice
              maxIn = Math.max(maxIn, inCS());  // updates the most-ever-inside count
            }  // ends the send case
            paint();  // repaints the drawing and controls
          }  // ends stepP()
          function toggleAuto() {  // toggleAuto(): starts or stops a scheduler that picks a random process every 650 milliseconds
            if (auto) { clearInterval(auto); auto = null; paint(); return; }  // if it is running, stop it, repaint and return
            auto = ctx.every(650, () => {  // ctx.every runs the function below every 650 milliseconds until stopped (and stops by itself when the step closes)
              const ok = pr.map((p, i) => (p === 'blk' ? -1 : i)).filter((i) => i >= 0);  // ok lists the processes that are not blocked, the only ones that can run
              if (!ok.length || steps >= 400) { clearInterval(auto); auto = null; say(`The random scheduler stopped after ${steps} calls. <b>Most processes ever inside at once: ${maxIn}.</b>${!ok.length ? ' Every process is blocked: nobody holds a token, so nobody can ever run again.' : ''}`, maxIn > 1 || !ok.length ? 'bad' : 'ok'); paint(); return; }  // stops after 400 calls or when every process is blocked, and reports the most processes ever inside at once
              stepP(ok[Math.floor(rng() * ok.length)]);  // otherwise runs one randomly chosen runnable process
            });  // ends the scheduler function
            paint();  // repaints so the buttons show the scheduler is running
          }  // ends toggleAuto()
          function paint() {  // paint(): redraws the drawing, buttons, badges and missions after every call
            const K = [];  // K collects the shapes of the new drawing
            const n = inCS(), bad = n > 1;  // n is how many are inside; bad is true when more than one is
            const L = G7;  // L is short for the chosen layout
            K.push(s('rect', { x: L.cs[0], y: L.top, width: L.cs[1], height: 208, rx: 12, class: bad ? 's-bad' : 's-ok', 'stroke-width': 2 }));  // the critical-section box on the right: green normally, red when mutual exclusion is broken
            L.heads.forEach(([lines, x, isCs]) => lines.forEach((t, k) => K.push(s('text', { x, y: 22 + k * 15, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800, style: isCs ? `fill:var(--${bad ? 'bad' : 'ok'})` : '' }, t))));  // the column headings; the critical-section heading takes the same green or red
            K.push(s('rect', { x: L.mb[0], y: L.top, width: L.mb[1], height: 208, rx: 12, class: 's-mem', 'stroke-width': 2 }));  // the mailbox box on the left
            const mbc = L.mb[0] + L.mb[1] / 2;  // the mailbox's centre line
            for (let k = 0; k < box; k++) K.push(envelope(s, mbc, L.top + 54 + k * 52, 'token', 's-warn', 44, 30));  // one "token" envelope per token in the mailbox, stacked downward
            if (!box) K.push(s('text', { x: mbc, y: L.top + 82, 'text-anchor': 'middle', 'font-size': 14, class: 's-sub' }, 'empty'));  // writes "empty" when no token is in the mailbox
            const wl = waitQ.length ? ['waiting:', waitQ.map((j) => NAMES[j]).join(', ')] : ['no one', 'waiting'];  // wl: the waiting-line text, such as "waiting: P2, P3", or "no one waiting"
            (ctx.narrow ? wl : [wl.join(' ')]).forEach((t, k, arr) => K.push(s('text', { x: mbc, y: L.top + 198 - (arr.length - 1 - k) * 16, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 }, t)));  // on phones the two parts go on two lines; on wide screens they share one line at the bottom of the mailbox box
            pr.forEach((p, i) => {  // draws each process on its own row
              const y = L.RY[i], x = L.COL[p], pw = L.pill;  // y is the row, x the column for where the process is now, pw the pill width
              K.push(s('line', { x1: L.lane[0], y1: y, x2: L.lane[1], y2: y, class: 's-muted', 'stroke-dasharray': '3 6' }));  // a dotted lane across the row, so the path between columns is visible
              const g = s('g', { style: 'cursor:pointer', onclick: () => { if (pr[i] !== 'blk' && !auto) stepP(i); } },  // a clickable group; clicking runs the process's next call unless it is blocked or the scheduler is running
                s('rect', { x: x - pw / 2, y: y - 23, width: pw, height: 46, rx: 23, class: p === 'cs' ? (bad ? 's-bad' : 's-ok') : p === 'blk' ? 's-warn' : 's-proc', 'stroke-width': 2.5 }),  // the pill: green inside (red if broken), amber when blocked, the process colour in the remainder
                s('text', { x: p === 'cs' ? x - pw / 8 : x, y: y + 6, 'text-anchor': 'middle', 'font-weight': 900, 'font-size': 17 }, NAMES[i]));  // the process name, shifted left when inside so the token fits beside it
              K.push(g);  // adds the pill to the drawing
              if (p === 'cs') K.push(envelope(s, x + pw / 4 - 2, y, null, 's-warn', 24, 17));  // a small token envelope beside each process inside the critical section
              if (p === 'blk') K.push(s('text', { x, y: y + 37, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, `#${waitQ.indexOf(i) + 1} in line`));  // under each blocked process, its place in the waiting line
            });  // ends the loop over processes
            svg.replaceChildren(...K);  // swaps the old drawing for the new one
            btns.forEach((b, i) => { b.textContent = pr[i] === 'rem' ? `${NAMES[i]}: receive` : pr[i] === 'cs' ? `${NAMES[i]}: send back` : `${NAMES[i]}: blocked`; b.disabled = pr[i] === 'blk' || !!auto; });  // each process button names its next call (receive, send back, or blocked) and is off while blocked or automatic
            autoBtn.textContent = auto ? 'Stop the random scheduler' : 'Let a random scheduler run';  // the scheduler button's label shows whether it will start or stop
            const held = n;  // held: tokens held by processes, one per process inside
            stat.replaceChildren(h('span', { class: 'chip ' + (bad ? 'bad' : 'ok') }, `inside now: ${n}`), h('span', { class: 'chip ' + (maxIn > 1 ? 'bad' : 'ok') }, `most ever inside: ${maxIn}`),  // badges: how many are inside now, and the most ever; red if more than one
              h('span', { class: 'chip warn' }, `tokens: ${box} in box + ${held} held = ${box + held}`));  // a badge adding up tokens in the mailbox and tokens held, to show the total never changes
            mlist.replaceChildren(...MISSIONS.map(([k, t]) => h('li', { class: done[k] ? 'done' : '' }, h('span', { class: 'mk' }, done[k] ? '✓' : ''), h('span', { html: t }))));  // rebuilds the mission checklist
          }  // ends paint()
          const initSeg = ctx.ui.seg([{ value: 0, label: '0' }, { value: 1, label: '1 (correct)' }, { value: 2, label: '2' }], init, (v) => { if (auto) { clearInterval(auto); auto = null; } init = v; reset(); });  // the token-count buttons (0, 1, 2); a change stops the scheduler and starts over
          const left = h('div', { class: 'stack', style: { gap: '8px' } }, h('h4', { class: 'm0' }, 'The code every process runs'), code,  // left column: a heading and the code listing
            h('div', { class: 'card tight' }, h('h4', { class: 'm0 mb' }, 'Missions'), mlist),  // the missions card
            h('div', { class: 'callout why m0 small', 'data-label': 'Why it works', html: 'Receive blocks; send does not. Each receive is an <span class="t">atomic operation</span>, so two processes can never grab the same token.' }),  // callout: receive blocks and is atomic (it cannot be interrupted halfway), so no two processes grab the same token
            h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'Forgetting to send the token back, or crashing while holding it, loses the token: every other process blocks forever.' }));  // callout: losing the token (never sending it back, or crashing) blocks everyone forever
          const right = h('div', { class: 'stack', style: { gap: '8px' } },  // right column: settings, drawing, buttons, badges and explanation
            h('div', { class: 'row', style: { gap: '10px' } }, h('span', { class: 'lbl' }, 'Messages put in at set-up'), initSeg, h('div', { class: 'grow' }), h('button', { class: 'btn sm', type: 'button', onclick: () => { if (auto) { clearInterval(auto); auto = null; } reset(); } }, 'Reset')),  // a row with the token-count buttons, a spacer and Reset (which also stops the scheduler)
            h('div', { class: 'card white grow', style: { padding: '4px 8px', display: 'grid', alignItems: 'center' } }, svg),  // the drawing on a white card that takes the spare height
            h('div', { class: 'row gap-s' }, ...btns, h('div', { class: 'grow' }), autoBtn), stat, narr);  // the three process buttons, a spacer, the scheduler button, then the badges and the explanation
          el.append(h('div', { class: 'split l fill', style: { gap: '18px' } }, left, right));  // puts the two columns side by side, the code column the smaller one (stacked on phones)
          reset();  // starts fresh with one token
          return () => { if (auto) clearInterval(auto); };  // clean-up for when the student leaves the step: stop the random scheduler
        },  // ends render() for step 7
      },  // ends step 7
      /* ---------------- 8. Producer/consumer with mayproduce and mayconsume ---------------- */
      {  // step 8 begins: the bounded-buffer producer/consumer built from two mailboxes
        title: 'Producer/consumer with two mailboxes',  // the step's title
        kind: 'lab',  // kind "lab": a hands-on step
        render(el, ctx) {  // render(): runs when step 8 is shown and builds the drawing, both code listings and the controls
          const { h, s } = ctx;  // pulls out the HTML and SVG element helpers
          const pCode = listing(ctx, [  // pCode: the producer's pseudo-code, with a note on each line
            ['while (true) {', 'loop forever'],  // shown producer code, row 1: loop forever
            ['  receive(mayproduce, pmsg);', 'take an empty = a free slot'],  // shown producer code, row 2: receive an empty message, which means a slot is free
            ['  pmsg = produce();', 'fill it with a new item'],  // shown producer code, row 3: produce an item into that message
            ['  send(mayconsume, pmsg);', 'pass the full message on'],  // shown producer code, row 4: send the full message to mayconsume
            ['}', 'go round again']], { fontSize: 13 });  // shown producer code, row 5: end of the loop; the options set a 13-pixel font
          const cCode = listing(ctx, [  // cCode: the consumer's pseudo-code, with a note on each line
            ['while (true) {', 'loop forever'],  // shown consumer code, row 1: loop forever
            ['  receive(mayconsume, cmsg);', 'take a full one, or block'],  // shown consumer code, row 2: receive a full message, or block when none is there
            ['  consume(cmsg);', 'use the item it carries'],  // shown consumer code, row 3: consume the item it carries
            ['  send(mayproduce, null);', 'return an empty = free slot'],  // shown consumer code, row 4: send an empty message back to mayproduce, freeing a slot
            ['}', 'go round again']], { fontSize: 13 });  // shown consumer code, row 5: end of the loop, with the same 13-pixel font
          let N = 3, mode = 'manual', timer = null, tick = 0;  // N is the buffer capacity; mode is who drives (the student or an automatic speed); timer and tick drive auto mode
          let empties, full, P, C, made, used;  // empties: messages in mayproduce; full: items in mayconsume; P and C: the two processes; made and used: counts
          const done = { pfull: false, cempty: false, wake: false };  // done records which missions the student has finished
          const MISSIONS = [['pfull', 'Fill the buffer until the <b>producer</b> blocks.'], ['cempty', 'Empty it until the <b>consumer</b> blocks.'], ['wake', 'Wake a blocked process with a send from the other.']];  // MISSIONS: fill the buffer until the producer blocks, empty it until the consumer blocks, wake a blocked process
          // geometry: a wide landscape layout, or a compact portrait one for phones
          const G = !ctx.narrow ? {  // G holds the drawing's coordinates; the wide layout first, the phone-width one after the colon
            vb: '0 0 1100 176', P: [16, 40], C: [904, 40], mc: [330, 4, 440, 66], mp: [330, 106, 440, 66], mcLab: [346, 31, 51], mpLab: [346, 133, 153],  // wide: drawing size, producer box left, consumer box right, the two mailbox boxes stacked in the middle, their labels
            mcEnv: (k, n) => [736 - (n - 1 - k) * 50, 28], mpEnv: (k) => [564 + k * 50, 139], mcEmpty: [754, 42], mpEmpty: [564, 144], stat: [550, 93],  // wide: where envelopes go in each mailbox, where the "none" notes and the circulation line sit
            arrows: [[196, 62, 326, 38], [770, 38, 900, 62], [904, 118, 774, 140], [330, 140, 200, 118]],  // wide: four arrows forming a loop: producer to mayconsume to consumer to mayproduce and back to producer
          } : {  // the phone-width layout starts here
            vb: '0 0 400 396', P: [10, 8], C: [210, 8], mc: [10, 146, 380, 96], mp: [10, 292, 380, 96], mcLab: [26, 170, 188], mpLab: [26, 316, 334],  // phones: producer and consumer side by side at the top, the two mailboxes stacked below
            mcEnv: (k, n) => [360 - (n - 1 - k) * 50, 214], mpEnv: (k) => [40 + k * 50, 360], mcEmpty: [374, 219], mpEmpty: [180, 365], stat: [200, 270],  // phones: envelope slots, "none" note spots and the circulation line spot
            arrows: [[100, 108, 100, 142], [300, 146, 300, 112], [390, 70, 397, 70, 397, 340, 393, 340], [10, 340, 3, 340, 3, 70, 7, 70]],  // phones: the same loop of arrows, with the return arrows running down the sides of the drawing
          };  // closes the two layouts
          const svg = s('svg', { viewBox: G.vb, width: '100%', role: 'img', 'aria-label': 'Producer, consumer and the two mailboxes the messages circulate through' });  // the drawing area, described for screen readers
          const narr = h('div', { class: 'narr' });  // narr: the explanation of the last step
          const mlist = h('ul', { class: 'missions' });  // mlist: the mission checklist
          const pBtn = h('button', { class: 'btn sm primary', type: 'button', onclick: () => stepP() });  // pBtn: runs the producer's next line of code
          const cBtn = h('button', { class: 'btn sm primary', type: 'button', onclick: () => stepC() });  // cBtn: runs the consumer's next line of code
          const say = (html, tone) => { narr.className = 'narr' + (tone ? ' ' + tone : ''); narr.innerHTML = html; };  // say(): shows a message in the explanation box, coloured by its tone
          const win = (k) => { if (!done[k]) { done[k] = true; ctx.toast('Mission complete!'); } };  // win(k): marks mission k as done and shows a short notice, only the first time
          // P.pc / C.pc: 0 = about to receive, 'blk' = blocked in receive, 1 = holding a message, 2 = message ready to send
          function reset(msg) {  // reset(msg): starts over; runs at the start, on Reset and when the capacity changes
            empties = N; full = []; P = { pc: 0, item: null }; C = { pc: 0, item: null }; made = 0; used = 0;  // N empty messages in mayproduce, none in mayconsume, both processes about to receive, counts at 0
            say(msg || `A <span class="t">bounded buffer</span> of capacity ${N}, built from two <span class="t">mailboxes</span>. Set-up sends <b>${N} empty messages</b> to mayproduce, one per slot; the full messages in mayconsume <b>are</b> the buffer. Step each process with its button.`);  // explains the set-up: N empty messages, one per slot, and the full messages are the buffer
            paint();  // draws the fresh state
          }  // ends reset()
          function stepP() {  // stepP(): runs the producer's next line
            if (P.pc === 0) {  // about to receive from mayproduce
              if (empties > 0) { empties -= 1; P.pc = 1; say(`Producer: <code>receive(mayproduce, pmsg)</code> takes an <b>empty message</b>, which is permission to fill one slot. ${empties} empty left.`); }  // an empty message is there: take it, and one fewer remains
              else { P.pc = 'blk'; win('pfull'); say('Producer: <code>receive(mayproduce, pmsg)</code> finds mayproduce <b>empty</b>. Every slot is full, so the producer <b>blocks</b> until the consumer hands back an empty message.', 'warn'); }  // none left: every slot is full, so the producer blocks; that completes the first mission
            } else if (P.pc === 1) { made += 1; P.item = made; P.pc = 2; say(`Producer: <code>produce()</code> writes item ${made} into the message it is holding.`); }  // holding an empty message: produce the next item into it
            else if (P.pc === 2) {  // holding a full message: send it
              const it = P.item; P.item = null; P.pc = 0;  // hands the item over and goes back to the top of the loop
              if (C.pc === 'blk') { C.pc = 1; C.item = it; win('wake'); say(`Producer: <code>send(mayconsume, pmsg)</code>. The consumer was blocked waiting for data, so item ${it} goes <b>straight to the consumer</b>, which wakes up.`, 'ok'); }  // if the consumer was blocked for data, the item goes straight to it and wakes it (a mission)
              else { full.push(it); say(`Producer: <code>send(mayconsume, pmsg)</code> puts item ${it} into mayconsume. The producer does not wait (nonblocking send). ${full.length} item${full.length > 1 ? 's' : ''} now in the buffer.`); }  // otherwise the item joins mayconsume, and the producer does not wait
            }  // ends the three producer cases
            paint();  // repaints everything
          }  // ends stepP()
          function stepC() {  // stepC(): runs the consumer's next line
            if (C.pc === 0) {  // about to receive from mayconsume
              if (full.length) { C.item = full.shift(); C.pc = 1; say(`Consumer: <code>receive(mayconsume, cmsg)</code> takes the oldest full message, item ${C.item}.`); }  // a full message is there: take the oldest one
              else { C.pc = 'blk'; win('cempty'); say('Consumer: <code>receive(mayconsume, cmsg)</code> finds mayconsume <b>empty</b>: the buffer holds no data, so the consumer <b>blocks</b> until the producer sends some.', 'warn'); }  // none: the buffer holds no data, so the consumer blocks; that completes the second mission
            } else if (C.pc === 1) { used += 1; say(`Consumer: <code>consume(cmsg)</code> uses item ${C.item}. The message it holds is now empty.`); C.item = null; C.pc = 2; }  // holding an item: consume it, leaving an empty message ready to return
            else if (C.pc === 2) {  // holding an empty message: send it back
              C.pc = 0;  // goes back to the top of the loop
              if (P.pc === 'blk') { P.pc = 1; win('wake'); say('Consumer: <code>send(mayproduce, null)</code>. The producer was blocked waiting for a free slot, so the empty message goes <b>straight to the producer</b>, which wakes up.', 'ok'); }  // if the producer was blocked for a free slot, the empty message goes straight to it and wakes it (a mission)
              else { empties += 1; say(`Consumer: <code>send(mayproduce, null)</code> returns an empty message: one more free slot (${empties} now).`); }  // otherwise it joins mayproduce: one more free slot
            }  // ends the three consumer cases
            paint();  // repaints everything
          }  // ends stepC()
          const LINE = { 0: 2, blk: 2, 1: 3, 2: 4 };  // LINE: which code row to highlight for each state: row 2 to receive (or blocked there), row 3 holding, row 4 to send
          function procBox(x, y, name, Q, isP) {  // procBox(): draws the producer or consumer box with its state and any message it holds
            const blk = Q.pc === 'blk';  // blk is true when the process is blocked in receive
            const state = blk ? (isP ? 'blocked: no free slot' : 'blocked: no data') : Q.pc === 0 ? 'about to receive' : isP ? (Q.pc === 1 ? 'holding an empty message' : `holding item ${Q.item}`) : (Q.pc === 1 ? `holding item ${Q.item}` : 'holding an empty message');  // state: the reason it is blocked, "about to receive", or what it is holding
            const holds = !blk && Q.pc !== 0;  // holds is true when it has a message in hand
            return s('g', {},  // groups the box and its text into one piece
              s('rect', { x, y, width: 180, height: 100, rx: 12, class: blk ? 's-warn' : 's-proc', 'stroke-width': 2.5 }),  // the box outline: amber when blocked, the process colour otherwise
              s('text', { x: x + 90, y: y + 24, 'text-anchor': 'middle', 'font-weight': 900, 'font-size': 17 }, name),  // the name in bold
              s('text', { x: x + 90, y: y + 44, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, style: blk ? 'fill:var(--warn)' : '' }, state),  // the state line, in amber when blocked
              holds ? envelope(s, x + 90, y + 72, null, Q.item != null ? 's-mem' : 's-panel', 40, 26) : null,  // the message in hand: coloured when it carries an item, plain when empty
              holds ? s('text', { x: x + 118, y: y + 77, 'font-size': 12.5, 'font-weight': 800, class: 's-monot' }, Q.item != null ? 'i' + Q.item : 'empty') : null);  // its label: the item number (such as i3) or "empty"
          }  // ends procBox()
          function paint() {  // paint(): redraws the drawing, code highlights, buttons and missions after every step
            const K = [];  // K collects the shapes of the new drawing
            G.arrows.forEach((pts, k) => {  // draws the four arrows of the loop
              const pp = []; for (let q = 0; q < pts.length; q += 2) pp.push(pts[q] + ',' + pts[q + 1]);  // turns the flat list of numbers into "x,y" corner points
              K.push(s('polyline', { points: pp.join(' '), class: 's-line', 'marker-end': 'url(#arr)', style: k < 2 ? 'stroke:var(--mem)' : '' }));  // the first two arrows (the path of full messages) use the message colour; the return path is grey
            });  // ends the arrows loop
            const box2 = (r, cls, lab, name, sub) => K.push(s('rect', { x: r[0], y: r[1], width: r[2], height: r[3], rx: 12, class: cls, 'stroke-width': 2 }),  // box2(): draws one mailbox: its box, then (continued below) its name and description
              s('text', { x: lab[0], y: lab[1], 'font-weight': 800, 'font-size': 16 }, name), s('text', { x: lab[0], y: lab[2], 'font-size': 13, class: 's-sub' }, sub));  // the mailbox's name in bold and a grey description under it
            box2(G.mc, 's-mem', G.mcLab, 'mayconsume', 'full messages = the buffer');  // the mayconsume mailbox: its full messages are the buffer
            box2(G.mp, 's-panel', G.mpLab, 'mayproduce', 'empty messages = free slots');  // the mayproduce mailbox: its empty messages are the free slots
            full.forEach((it, k) => { const [x, y] = G.mcEnv(k, full.length); K.push(envelope(s, x, y, 'i' + it, 's-mem', 36, 22)); });  // one labelled envelope per item in mayconsume, lined up from the right so the oldest sits furthest left
            for (let k = 0; k < empties; k++) { const [x, y] = G.mpEnv(k); K.push(envelope(s, x, y, null, 's-panel', 36, 22)); }  // one plain envelope per empty message in mayproduce
            if (!full.length) K.push(s('text', { x: G.mcEmpty[0], y: G.mcEmpty[1], 'text-anchor': 'end', 'font-size': 13, class: 's-sub' }, 'no data waiting'));  // when mayconsume is empty, a note says no data is waiting
            if (!empties) K.push(s('text', { x: G.mpEmpty[0], y: G.mpEmpty[1], 'font-size': 13, class: 's-sub' }, 'none: every slot is full'));  // when mayproduce is empty, a note says every slot is full
            const circ = empties + full.length + (P.pc === 1 || P.pc === 2 ? 1 : 0) + (C.pc === 1 || C.pc === 2 ? 1 : 0);  // circ: every message in the system, in either mailbox or in a process's hand; it always equals N
            K.push(s('text', { x: G.stat[0], y: G.stat[1], 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 },  // a line between the mailboxes showing the counts and that circulation equals N
              ctx.narrow ? `made ${made} · used ${used} · in circulation: ${circ} = N` : `produced ${made} · consumed ${used} · messages in circulation: ${circ} = N`));  // the shorter wording is used on phones
            K.push(procBox(G.P[0], G.P[1], 'Producer', P, true), procBox(G.C[0], G.C[1], 'Consumer', C, false));  // the producer and consumer boxes
            svg.replaceChildren(...K);  // swaps the old drawing for the new one
            pCode.clear(); pCode.mark(LINE[P.pc], P.pc === 'blk' ? 'bad' : 'cur');  // highlights the producer's current code row, in red when it is blocked there
            cCode.clear(); cCode.mark(LINE[C.pc], C.pc === 'blk' ? 'bad' : 'cur');  // highlights the consumer's current code row, in red when it is blocked there
            const lab = (Q, isP) => (Q.pc === 'blk' ? 'blocked' : Q.pc === 0 ? 'receive' : Q.pc === 1 ? (isP ? 'produce' : 'consume') : 'send');  // lab(): the name of a process's next action: blocked, receive, produce or consume, or send
            pBtn.textContent = 'Producer: ' + lab(P, true); cBtn.textContent = 'Consumer: ' + lab(C, false);  // each button names its process's next action
            pBtn.disabled = P.pc === 'blk' || mode !== 'manual'; cBtn.disabled = C.pc === 'blk' || mode !== 'manual';  // a button is off while its process is blocked or while an automatic speed is running
            mlist.replaceChildren(...MISSIONS.map(([k, t]) => h('li', { class: done[k] ? 'done' : '' }, h('span', { class: 'mk' }, done[k] ? '✓' : ''), h('span', { html: t }))));  // rebuilds the mission checklist
          }  // ends paint()
          function setMode(v) {  // setMode(v): runs when a "who runs" option is chosen
            mode = v; if (timer) { clearInterval(timer); timer = null; }  // remembers the choice and stops any automatic timer already running
            if (v !== 'manual') {  // for the three automatic speeds
              const [pe, ce] = { pfast: [1, 3], cfast: [3, 1], same: [1, 1] }[v];  // how often each side acts, in ticks: the faster side acts every tick, the slower every third
              tick = 0;  // restarts the tick count
              timer = ctx.every(420, () => { tick += 1; if (tick % pe === 0 && P.pc !== 'blk') stepP(); if (tick % ce === 0 && C.pc !== 'blk') stepC(); });  // every 420 milliseconds, one tick: each process that is due and not blocked runs its next line
            }  // ends the automatic case
            paint();  // repaints so the buttons reflect the mode
          }  // ends setMode()
          const nSeg = ctx.ui.seg([1, 2, 3, 4, 5], N, (v) => { N = v; reset(); });  // capacity buttons, 1 to 5; changing it starts over
          const mSeg = ctx.ui.seg([{ value: 'manual', label: 'You step' }, { value: 'pfast', label: 'Producer faster' }, { value: 'cfast', label: 'Consumer faster' }, { value: 'same', label: 'Same speed' }], mode, setMode);  // "who runs" buttons: you step, producer faster, consumer faster, or same speed
          const col = (title, codeEl, btn) => h('div', { class: 'card tight stack', style: { gap: '6px' } }, h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, title), btn), codeEl);  // col(): a card with a heading, a step button on the right, and a code listing below
          el.append(h('div', { class: 'stack fill', style: { gap: '9px' } },  // builds the step's layout, top to bottom
            h('div', { class: 'row', style: { gap: '10px' } }, h('span', { class: 'lbl' }, 'Capacity N'), nSeg, h('span', { class: 'lbl', style: { marginLeft: '8px' } }, 'Who runs'), mSeg, h('div', { class: 'grow' }),  // top row: capacity, who runs, a spacer and
              h('button', { class: 'btn sm', type: 'button', onclick: () => { mSeg.set('manual'); setMode('manual'); reset(); } }, 'Reset')),  // a Reset button that switches back to manual stepping and starts over
            h('div', { class: 'card white', style: { padding: '4px 8px' } }, svg),  // the drawing on a white card
            h('div', { class: 'grid-2', style: { gap: '12px' } }, col('Producer', pCode, pBtn), col('Consumer', cCode, cBtn)),  // the producer and consumer code cards side by side
            h('div', { class: 'grid-2 grow', style: { gap: '12px', gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 2fr)' } }, narr, h('div', { class: 'card tight' }, mlist))));  // the explanation (wider) beside the missions card, filling the remaining height
          reset();  // starts fresh with capacity 3
          return () => { if (timer) clearInterval(timer); };  // clean-up for when the student leaves the step: stop the automatic timer
        },  // ends render() for step 8
      },  // ends step 8
      /* ---------------- 9. Recap ---------------- */
      {  // step 9 begins: the recap
        title: 'Recap: six ideas to keep',  // the step's title
        kind: 'recap',  // kind "recap": a summary step, always on the core path
        render(el, ctx) {  // render(): runs when step 9 is shown
          el.append(ctx.h('div', { class: 'stack fill', style: { gap: '12px' } },  // a single column filling the step's height
            ctx.h('p', { class: 'lead m0' }, 'Say each answer out loud before you flip the card. If one surprises you, go back to that step.'),  // an instruction to answer each card out loud before flipping it
            ctx.ui.flipcards([  // six flip cards: the front asks, the back answers when clicked
              ['Two jobs, one mechanism', '<div><b>send</b> moves the data (communication), and a receiver that must wait for it stays in step (synchronization). It works even between machines that share no memory.</div>'],  // recap card: send and receive give both communication and synchronization
              ['Who blocks?', '<div>Blocking send + blocking receive is a <b>rendezvous</b>. Nonblocking send + blocking receive is the most common mix. Timeouts and tests for arrival stop a receiver from waiting forever.</div>'],  // recap card: which combinations block, and the rendezvous
              ['Direct or indirect?', '<div>Direct names a process, and receive may name one sender or accept anyone. Indirect names a <b>mailbox</b>, which makes one-to-one, many-to-one, one-to-many and many-to-many easy.</div>'],  // recap card: direct versus indirect addressing and the four patterns
              ['Who owns a mailbox?', '<div>A <b>port</b> belongs to its receiver and dies with it. A mailbox owned by its creator dies with the creator. One owned by the OS lasts until it is explicitly destroyed. Binding is static or dynamic.</div>'],  // recap card: mailbox ownership decides its lifetime; binding is static or dynamic
              ['What is inside a message?', '<div>A <b>header</b> (type, destination ID, source ID, length, control information such as a sequence number or priority) and a <b>body</b> with the contents. Delivery order: FIFO, priority, or receiver\'s choice.</div>'],  // recap card: what goes in the header and body, and the delivery orders
              ['Locks and buffers from messages', '<div>One <b>token</b> message in a shared mailbox gives mutual exclusion: receive to enter, send to leave. For a bounded buffer, <b>mayproduce</b> holds N empty messages and <b>mayconsume</b> holds the full ones.</div>'],  // recap card: a lock from one token, and a bounded buffer from two mailboxes
            ], { cols: 3, height: 184 }),  // three cards per row, each 184 pixels tall
            ctx.h('div', { class: 'callout why m0 small', 'data-label': 'Why it matters', html: 'Message passing is how processes cooperate when they share no memory: across the network, between containers, and inside microkernel operating systems where even device drivers are separate processes that talk by messages.' })));  // callout: why message passing matters when processes share no memory
        },  // ends render() for step 9
      },  // ends step 9
      /* ---------------- 10. Check yourself ---------------- */
      {  // step 10 begins: the section quiz
        title: 'Check yourself',  // the step's title
        kind: 'check',  // kind "check": the quiz step, always on the core path
        quiz: [  // quiz: the list of questions; the guide's quiz engine draws and marks them
          { q: 'Which combination of send and receive produces a <b>rendezvous</b>?',  // quiz question 1 (multiple choice): which combination gives a rendezvous
            choices: ['Blocking send and blocking receive', 'Nonblocking send and blocking receive', 'Nonblocking send and nonblocking receive', 'Blocking send and nonblocking receive'], answer: 0,  // the four choices; answer 0 (both blocking) is correct
            feedback: [null, 'Here the sender never waits, so the two processes do not have to meet.', 'Nobody ever waits in this mix, so there is no meeting point at all.', 'The receiver never waits, so the two are not forced to meet; this mix is rarely used.'],  // feedback shown for each wrong choice (null for the right one)
            why: 'When both calls block, whichever process arrives first waits for the other, and the message passes only when both are present. That tight meeting point is the rendezvous.' },  // explanation shown after answering: whoever arrives first waits
          { q: 'A server uses <b>direct</b> addressing and must accept requests from any client, then reply to each one. How should its receive work?',  // quiz question 2 (multiple choice): how a direct-addressing server should receive
            choices: ['Name one specific client as the source', 'Leave the source open, accept any sender and find out the sender\'s ID when the message arrives', 'Call receive once for each known client, naming them in turn', 'Use static association'], answer: 1,  // the choices; answer 1 (leave the source open) is correct
            feedback: ['Then it would accept only that one client; requests from everyone else would sit unaccepted.', null, 'A server cannot know every client in advance, and while it waits on one named client it ignores requests that are already waiting from the others.', 'Static association concerns how processes are bound to a mailbox, not how a direct receive names its source.'],  // feedback: why naming one client, looping over clients, or static association fails
            why: 'Implicit addressing lets a receive accept a message from anyone; the source parameter is filled in on return, so the server knows whom to answer.' },  // explanation: implicit addressing fills in the source after the receive
          { type: 'tf', q: 'With a nonblocking send, a faulty process stuck in a loop can flood the system with messages, because nothing ever makes it wait.', answer: true,  // quiz question 3 (true or false): a looping nonblocking sender can flood the system; the answer is true
            why: 'A nonblocking send returns at once, so no delay ever slows the sender. The system\'s buffers and processor time can be eaten up by the flood.' },  // explanation: nothing ever slows a nonblocking sender
          { type: 'match', q: 'Match each way of owning or binding a mailbox with what it means.',  // quiz question 4 (match the pairs): mailbox owners and bindings with what they mean
            pairs: [['Port (owned by its receiver)', 'Destroyed when that receiving process ends'], ['Mailbox owned by the process that created it', 'Destroyed when its creator ends'], ['Mailbox owned by the operating system', 'Lasts until someone explicitly destroys it'], ['Static association', 'The link is fixed once, when the mailbox is set up'], ['Dynamic association', 'Processes connect and disconnect while running']],  // the five pairs: port, creator-owned, OS-owned, static and dynamic association
            why: 'Ownership decides a mailbox\'s lifetime: a port dies with its receiver, a creator-owned mailbox with its creator, and an OS-owned mailbox only on an explicit destroy. Association decides whether the set of attached processes is fixed (static) or can change with connect and disconnect (dynamic).' },  // explanation: ownership decides lifetime; association decides whether attachments can change
          { type: 'multi', q: 'Which of these belong in a message\'s <b>header</b>?',  // quiz question 5 (select all): which items belong in a message header
            choices: ['Message type', 'Destination ID', 'Source ID', 'Message length', 'The data being delivered', 'Control information such as a sequence number or priority'], answer: [0, 1, 2, 3, 5],  // the six choices; everything except the data itself (choice 4) is correct
            why: 'The header describes the message: its type, where it goes, who sent it, how long it is, and bookkeeping such as sequence numbers and priority. The data itself travels in the body.' },  // explanation: the header describes the message, the body carries the data
          { type: 'match', q: 'Match each communication pattern with a typical use.',  // quiz question 6 (match the pairs): each communication pattern with a typical use
            pairs: [['One-to-one', 'A private link between two stages of a pipeline'], ['Many-to-one', 'Many clients sending requests to one server'], ['One-to-many', 'Warning every member of a group about a shutdown'], ['Many-to-many', 'Several servers taking requests from one shared mailbox']],  // the four pairs: pipeline link, client/server, broadcast, server pool
            why: 'The patterns count senders and receivers. Many-to-one is client/server (usually a port), one-to-many is broadcast, and many-to-many lets a pool of servers share the work.' },  // explanation: the patterns count senders and receivers
          { type: 'bucket', q: 'Does each call <b>block</b> the caller, or return at once?', buckets: ['Can block the caller', 'Always returns at once'],  // quiz question 7 (sort into groups): does each call block or return at once
            items: [['Blocking receive when the mailbox is empty', 0], ['Nonblocking receive when the mailbox is empty', 1], ['Blocking send before the message has been received', 0], ['Nonblocking send', 1], ['Test for arrival', 1]],  // the five calls and their correct group (0 = can block, 1 = returns at once)
            why: 'Only the blocking forms ever suspend the caller. A nonblocking receive returns “no message”, and a test for arrival just reports whether something is waiting.' },  // explanation: only the blocking forms ever suspend the caller
          { type: 'order', q: 'Put the steps of mutual exclusion with a single token message in order.',  // quiz question 8 (put in order): the steps of mutual exclusion with one token
            items: ['Create a mailbox that every process shares', 'Send exactly one (null) message into it', 'A process calls receive and gets the message', 'It runs its critical section', 'It sends the message back to the mailbox'],  // the five steps, listed in the correct order (the quiz shuffles them)
            why: 'The single message is the token: set it up once, take it to enter, and put it back on the way out so the next process can enter.' },  // explanation: set the token up once, take it to enter, return it to leave
          { type: 'num', q: 'Messages have a fixed-length body of 64 bytes. How many messages are needed to send a 200-byte record?', answer: 4, tol: 0, unit: 'messages',  // quiz question 9 (calculate): messages needed for a 200-byte record with 64-byte bodies; answer 4, exact
            why: '200 ÷ 64 = 3.125, so three full messages carry 192 bytes and a fourth carries the last 8 (with 56 bytes of padding). Fixed length is simple to manage but wastes space and forces long data to be split.' },  // explanation: 200 divided by 64 is 3.125, so a fourth message carries the last 8 bytes
          { type: 'num', q: 'A producer and consumer share a buffer of capacity 5, built from mailboxes <code>mayproduce</code> and <code>mayconsume</code>. So far the producer has sent 7 full messages and the consumer has consumed 4 of them, returning an empty message each time. Neither process is holding a message. How many empty messages are in mayproduce?', answer: 2, tol: 0, unit: 'messages',  // quiz question 10 (calculate): empty messages left in mayproduce after 7 produced and 4 consumed; answer 2
            why: 'mayproduce started with 5. The producer took 7 out and the consumer put 4 back: 5 − 7 + 4 = 2. Check: 3 full messages wait in mayconsume, and 2 + 3 = 5, the capacity.' },  // explanation: 5 minus 7 plus 4 is 2, and 2 empty plus 3 full equals the capacity
          { q: 'A mailbox holds four messages, oldest first: #1 (priority 1), #2 (priority 3), #3 (priority 2), #4 (priority 3). It uses priority order, with ties broken by arrival. Which message does the next receive get?',  // quiz question 11 (multiple choice): which message a priority queue with ties by arrival hands out next
            choices: ['#1', '#2', '#3', '#4'], answer: 1,  // the choices; answer 1 (#2) is correct
            feedback: ['That would be FIFO order; #1 has the lowest priority.', null, '#3 has priority 2, but two messages have priority 3.', '#4 has the top priority too, but #2 arrived earlier and wins the tie.'],  // feedback: why #1, #3 and #4 are not next
            why: 'Priority order picks the highest priority (3), and among #2 and #4 the older one, #2, goes first.' },  // explanation: highest priority first, and the older one wins a tie
          { q: 'In the two-mailbox producer/consumer solution, what does a message waiting in <code>mayproduce</code> stand for?',  // quiz question 12 (multiple choice): what a message in mayproduce stands for
            choices: ['An item that is ready to be consumed', 'Permission to produce: one free slot in the buffer', 'A request from the consumer to stop producing', 'A lock on the whole buffer'], answer: 1,  // the choices; answer 1 (permission to produce, one free slot) is correct
            feedback: ['Items ready to consume travel in mayconsume.', null, 'The consumer never sends such requests; it simply returns empty messages.', 'No lock is needed: each message is taken by exactly one process.'],  // feedback: why the other meanings of a mayproduce message are wrong
            why: 'mayproduce starts with one empty message per slot. The producer must receive one before producing, so when all slots are full it blocks until the consumer returns an empty.' },  // explanation: the producer must take an empty message before producing, so a full buffer blocks it
        ],  // closes the quiz question list
      },  // ends step 10
    ],  // closes the list of steps
    notes: `${/* notes: the section's reading notes, written as HTML and shown in the Notes panel (the N key) */''}
      <h3>What message passing is</h3>${/* heading for part 1 of the notes: what message passing is */''}
      <p>Cooperating processes need two things: <b>synchronization</b> (staying in step, for example not using data before it exists) and <b>communication</b> (handing data over). Semaphores and monitors provide synchronization and rely on shared variables for the data. <b>Message passing</b> provides both at once: a message carries the data, and a process waiting to receive it cannot run ahead of the sender. It works on a single processor, on a shared-memory multiprocessor and across a network of machines that share no memory at all.</p>${/* notes paragraph: synchronization and communication, and why messages give both */''}
      <p>Message passing is how processes cooperate when they share no memory: across a network, and inside microkernel operating systems whose services run as separate processes. Two primitives do the work:</p>${/* notes paragraph: where message passing is used, introducing the two calls */''}
      <ul>${/* start of the list of the two calls */''}
        <li><code>send(destination, message)</code>: deliver this message to a process or mailbox.</li>${/* list item: what send(destination, message) does */''}
        <li><code>receive(source, message)</code>: collect a message from a process or mailbox into the caller's message variable.</li>${/* list item: what receive(source, message) does */''}
      </ul>${/* end of the list */''}
      <h3>Design characteristics</h3>${/* heading for part 2 of the notes: the four design questions */''}
      <table>${/* start of the design-choices table */''}
        <tr><th>Question</th><th>Options</th></tr>${/* table heading row: question and options */''}
        <tr><td>Synchronization</td><td>send blocking or nonblocking; receive blocking, nonblocking, or test for arrival</td></tr>${/* table row: synchronization choices */''}
        <tr><td>Addressing</td><td>direct (explicit or implicit) or indirect (mailbox), with static or dynamic association and some owner</td></tr>${/* table row: addressing choices */''}
        <tr><td>Format</td><td>header + body; fixed or variable length</td></tr>${/* table row: format choices */''}
        <tr><td>Queuing discipline</td><td>FIFO, priority, or receiver's choice</td></tr>${/* table row: queuing discipline choices */''}
      </table>${/* end of the table */''}
      <h3>Blocking and nonblocking</h3>${/* heading for part 3 of the notes: blocking and nonblocking calls */''}
      <ul>${/* start of the list of call types */''}
        <li><b>Blocking send</b>: the sender waits until its message has been received. <b>Nonblocking send</b>: the sender continues at once; the message waits to be picked up.</li>${/* list item: blocking and nonblocking send */''}
        <li><b>Blocking receive</b>: with no message waiting, the caller sleeps until one arrives. <b>Nonblocking receive</b>: it returns at once, with a message or with “no message”. <b>Test for arrival</b>: check whether anything is waiting without taking it or blocking.</li>${/* list item: blocking and nonblocking receive, and test for arrival */''}
      </ul>${/* end of the list */''}
      <table>${/* start of the table of combinations */''}
        <tr><th>Combination</th><th>Behaviour</th><th>Risk</th></tr>${/* table heading row: combination, behaviour, risk */''}
        <tr><td>Blocking send + blocking receive</td><td><b>Rendezvous</b>: whoever arrives first waits; tight synchronization; only the message being handed over needs storing.</td><td>Either side can wait forever if the partner crashes or the message is lost.</td></tr>${/* table row: blocking send with blocking receive, the rendezvous */''}
        <tr><td>Nonblocking send + blocking receive</td><td>The most useful mix: senders never stall; an idle receiver (such as a server) sleeps without using the processor.</td><td>A faulty sender can flood the system with messages; the sender learns of delivery only if the receiver replies.</td></tr>${/* table row: nonblocking send with blocking receive, the most useful mix */''}
        <tr><td>Nonblocking send + nonblocking receive</td><td>Nobody ever waits.</td><td>The receiver must keep polling; a message arriving just after an empty receive can go unnoticed.</td></tr>${/* table row: both nonblocking, where nobody waits */''}
      </table>${/* end of the table */''}
      <p>The fourth mix, blocking send with nonblocking receive, is possible but rarely chosen. A blocking receive that could wait forever is usually protected by a <b>timeout</b> (give up and return an error after a time limit) or by testing for arrival first.</p>${/* notes paragraph: the rare fourth mix, and protecting a blocking receive with a timeout */''}
      <h3>Addressing</h3>${/* heading for part 4 of the notes: addressing */''}
      <p><b>Direct addressing</b> names a process. send gives the destination process ID. receive either names the one sender it will accept (explicit, fine when the partner is known in advance) or accepts anyone (<b>implicit</b>): the source parameter comes back holding the sender's ID. A server needs implicit addressing, because it cannot list every client in advance. With direct addressing there is no way to name a group, so reaching three receivers takes three sends, and a sender must pick a specific receiver by name.</p>${/* notes paragraph: direct addressing, explicit and implicit, and its limits */''}
      <p><b>Indirect addressing</b> sends to a shared <b>mailbox</b>, a queue of messages. Senders and receivers never name each other; they only share the mailbox name, which decouples them. It supports four patterns:</p>${/* notes paragraph: indirect addressing through a mailbox, introducing the four patterns */''}
      <ul>${/* start of the pattern list */''}
        <li><b>One-to-one</b>: a private link between two processes (for example two pipeline stages).</li>${/* list item: one-to-one */''}
        <li><b>Many-to-one</b>: client/server; many clients send requests to one server. Such a mailbox is usually a <b>port</b>.</li>${/* list item: many-to-one, usually a port */''}
        <li><b>One-to-many</b>: broadcast; one send and every member of the group gets a copy.</li>${/* list item: one-to-many, a broadcast */''}
        <li><b>Many-to-many</b>: several servers share one mailbox; whichever asks first gets the next request.</li>${/* list item: many-to-many, a shared server pool */''}
      </ul>${/* end of the list */''}
      <h3>Binding and ownership of mailboxes</h3>${/* heading for part 5 of the notes: binding and ownership of mailboxes */''}
      <ul>${/* start of the binding list */''}
        <li><b>Static association</b>: the link between processes and a mailbox is fixed once, when it is set up. Typical for a permanent one-to-one link.</li>${/* list item: static association */''}
        <li><b>Dynamic association</b>: processes attach and detach while running, with <code>connect</code> and <code>disconnect</code>. Needed when senders come and go, as with a server's clients.</li>${/* list item: dynamic association with connect and disconnect */''}
      </ul>${/* end of the list */''}
      <table>${/* start of the ownership table */''}
        <tr><th>Owner</th><th>The mailbox is destroyed when</th></tr>${/* table heading row: owner, and when the mailbox is destroyed */''}
        <tr><td>The receiving process (a <b>port</b>)</td><td>that receiver ends; later sends fail and queued messages are lost</td></tr>${/* table row: a port dies with its receiver */''}
        <tr><td>The process that created it</td><td>its creator ends, even if others still use it</td></tr>${/* table row: a creator-owned mailbox dies with its creator */''}
        <tr><td>The operating system</td><td>someone explicitly destroys it; it outlives any process, so a new receiver can take over the queued messages</td></tr>${/* table row: an OS-owned mailbox lasts until explicitly destroyed */''}
      </table>${/* end of the table */''}
      <h3>Message format</h3>${/* heading for part 6 of the notes: message format */''}
      <p>A message has a <b>header</b> that describes it and a <b>body</b> that holds the contents. Header fields:</p>${/* notes paragraph: a header and a body */''}
      <ul>${/* start of the header-field list */''}
        <li><b>Message type</b>: what kind of message it is (request, reply, alarm...).</li>${/* list item: message type */''}
        <li><b>Destination ID</b> and <b>source ID</b>: where it goes and who sent it.</li>${/* list item: destination and source IDs */''}
        <li><b>Message length</b>: size of the body, essential for variable-length messages.</li>${/* list item: message length */''}
        <li><b>Control information</b>: for example a sequence number, a priority, or a pointer that links messages into a queue.</li>${/* list item: control information */''}
      </ul>${/* end of the list */''}
      <p><b>Fixed-length</b> messages are easy to store and queue but waste space on short data and force long data to be split. <b>Variable-length</b> messages waste nothing but need the length field and per-message space allocation. Worked example: with a 64-byte fixed body, a 200-byte record needs 4 messages (200 ÷ 64 = 3.125, round up), and the last one carries 8 bytes plus 56 bytes of padding.</p>${/* notes paragraph: fixed versus variable length, with the 200-byte worked example */''}
      <h3>Queuing discipline</h3>${/* heading for part 7 of the notes: queuing discipline */''}
      <p>The rule for which waiting message a receiver gets next. <b>FIFO</b> (arrival order) is the simple, fair default, but urgent messages wait behind routine ones. <b>Priority</b> order lets urgent messages go first (by type or a sender-chosen priority; ties by arrival), at the risk of low-priority messages waiting a long time. Or the <b>receiver chooses</b>: it inspects the queue and selects the message it wants. Example: messages #1 (priority 1), #2 (3), #3 (2), #4 (3) in arrival order: FIFO delivers #1 first; priority delivers #2 (highest priority, older than #4).</p>${/* notes paragraph: FIFO, priority and receiver's choice, with a worked example */''}
      <h3>Mutual exclusion with one message</h3>${/* heading for part 8 of the notes: mutual exclusion with one message */''}
      <pre>create_mailbox(box);  // shared by all processes${/* shown code, line 1: create the shared mailbox */''}
send(box, null);      // exactly one message: the token${/* shown code, line 2: send exactly one message, the token */''}
while (true) {        // each process loops forever${/* shown code, line 3: each process loops forever */''}
  receive(box, msg);  // take the token, or block${/* shown code, line 4: receive the token, or block */''}
  critical_section(); // only the token holder is here${/* shown code, line 5: the critical section */''}
  send(box, msg);     // return the token${/* shown code, line 6: send the token back */''}
  remainder();        // work that needs no token${/* shown code, line 7: the remainder */''}
}</pre>${/* shown code, line 8: end of the loop and of the code block */''}
      <p>Receive is blocking and send is nonblocking. Whoever holds the single message is the only process in its critical section. If several processes call receive while the message is in the mailbox, exactly one gets it; if several are blocked when it is sent back, exactly one wakes. The number of messages placed in the mailbox at the start is how many processes may be inside together, just like a semaphore's initial value: 0 means nobody can ever enter, 2 breaks mutual exclusion. A process that crashes while holding the token (or forgets to send it back) leaves everyone else blocked forever.</p>${/* notes paragraph: why it works, and what 0 or 2 starting tokens would do */''}
      <h3>Producer/consumer with two mailboxes</h3>${/* heading for part 9 of the notes: producer/consumer with two mailboxes */''}
      <p>For a bounded buffer of capacity N, create mailboxes <b>mayproduce</b> and <b>mayconsume</b>, then send N empty (null) messages to mayproduce. Each empty message is permission to produce: one free slot.</p>${/* notes paragraph: the set-up with N empty messages in mayproduce */''}
      <pre>producer: while (true) {      // loop forever${/* shown code, line 1: the producer's endless loop */''}
  receive(mayproduce, pmsg);  // wait for a free slot${/* shown code, line 2: the producer waits for a free slot */''}
  pmsg = produce();           // fill the message${/* shown code, line 3: the producer fills the message */''}
  send(mayconsume, pmsg);     // pass it on${/* shown code, line 4: the producer passes it to mayconsume */''}
}                             // and repeat${/* shown code, line 5: end of the producer's loop */''}
consumer: while (true) {      // loop forever${/* shown code, line 6: the consumer's endless loop */''}
  receive(mayconsume, cmsg);  // wait for data${/* shown code, line 7: the consumer waits for data */''}
  consume(cmsg);              // use the item${/* shown code, line 8: the consumer uses the item */''}
  send(mayproduce, null);     // return a free slot${/* shown code, line 9: the consumer returns a free slot */''}
}                             // and repeat</pre>${/* shown code, line 10: end of the consumer's loop and of the code block */''}
      <p>The full messages in mayconsume <b>are</b> the buffer. The producer blocks when mayproduce is empty (buffer full); the consumer blocks when mayconsume is empty (no data). A send from one side wakes the other. The total number of messages in circulation always equals N. Worked example: N = 5, producer has sent 7, consumer has consumed 4 and returned 4 empties, neither holds one: mayproduce has 5 − 7 + 4 = 2 empties and mayconsume holds 3 full messages (2 + 3 = 5). The scheme works unchanged with several producers and several consumers.</p>${/* notes paragraph: who blocks when, why circulation stays at N, and a worked example */''}
    `,  // end of the notes text
  });  // ends the Guide.section call that registers section 5.6
})();  // ends and immediately runs the wrapping function
