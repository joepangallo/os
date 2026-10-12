/* =====================================================================
   12.3 B-Trees
   Original teaching material. One B-tree engine (insert with top-down
   splitting, search, a rule checker, range scans and a small B+ tree)
   drives every tree, caption, counter and score in the section.
   Helpers live in this IIFE (no globals).
   ===================================================================== */
(function () {
  /* ENGINE-BEGIN ------------------------------------------------------
     Pure B-tree code (no DOM). dev/qa-12.3/engine.test.js extracts this
     exact block and checks every tree it builds with the checker below. */
  function newTree(d) { return { d, root: null, next: 1 }; }
  function mkNode(t, keys, kids) { return { id: t.next++, keys: keys || [], kids: kids || [] }; }
  const isLeaf = (x) => x.kids.length === 0;
  function cloneNode(x) { return { id: x.id, keys: x.keys.slice(), kids: x.kids.map(cloneNode) }; }
  function cloneTree(t) { return { d: t.d, next: t.next, root: t.root ? cloneNode(t.root) : null }; }
  /* childIndex(): the first key position whose key is >= k (keys are scanned in memory) */
  function childIndex(x, k) { let i = 0; while (i < x.keys.length && k > x.keys[i]) i++; return i; }
  /* search(): one node read per level; path lists every node read, in order */
  function search(t, k) {
    const path = [];
    let x = t.root;
    while (x) {
      const i = childIndex(x, k);
      const found = i < x.keys.length && x.keys[i] === k;
      path.push({ id: x.id, i, found, keys: x.keys.slice(), leaf: isLeaf(x) });
      if (found || isLeaf(x)) break;
      x = x.kids[i];
    }
    return { found: path.length > 0 && path[path.length - 1].found, path };
  }
  /* splitChild(): x.kids[i] is full (2d - 1 keys). Its median key moves up into x;
     the d - 1 keys on its left stay, the d - 1 keys on its right form a new node. */
  function splitChild(t, x, i) {
    const d = t.d, y = x.kids[i], before = y.keys.slice(), med = y.keys[d - 1];
    const z = mkNode(t, y.keys.slice(d), isLeaf(y) ? [] : y.kids.slice(d));
    y.keys = y.keys.slice(0, d - 1);
    if (!isLeaf(y)) y.kids = y.kids.slice(0, d);
    x.keys.splice(i, 0, med);
    x.kids.splice(i + 1, 0, z);
    return { parent: x.id, left: y.id, right: z.id, median: med, before, leaf: isLeaf(y) };
  }
  /* insert(): top-down, splitting every full node on the way down (so a parent always
     has room for a key that moves up). Returns the events, each with a snapshot. */
  function insert(t, k) {
    const ev = [];
    const snap = (e) => { e.tree = cloneTree(t); ev.push(e); };
    if (search(t, k).found) return { ok: false, dup: true, ev };
    const full = (x) => x.keys.length === 2 * t.d - 1;
    if (!t.root) { t.root = mkNode(t, [k]); snap({ type: 'place', node: t.root.id, key: k, path: [t.root.id], first: true }); return { ok: true, ev }; }
    if (full(t.root)) {
      const s = mkNode(t, [], [t.root]);
      t.root = s;
      snap(Object.assign({ type: 'rootsplit' }, splitChild(t, s, 0)));
    }
    let x = t.root;
    const path = [x.id];
    while (!isLeaf(x)) {
      let i = childIndex(x, k);
      if (full(x.kids[i])) {
        snap(Object.assign({ type: 'split' }, splitChild(t, x, i)));
        if (k > x.keys[i]) i++;
      }
      x = x.kids[i];
      path.push(x.id);
    }
    const i = childIndex(x, k);
    x.keys.splice(i, 0, k);
    snap({ type: 'place', node: x.id, key: k, path: path.slice() });
    return { ok: true, ev };
  }
  function build(d, keys) { const t = newTree(d); keys.forEach((k) => insert(t, k)); return t; }
  /* fromShape(): build a tree straight from nested arrays (used for the
     "valid or broken?" puzzles, which may break the rules on purpose).
     A shape is [keys] for a leaf or [keys, [childShape, ...]].          */
  function fromShape(d, shape) {
    const t = newTree(d);
    const mk = (sh) => mkNode(t, sh[0].slice(), (sh[1] || []).map(mk));
    t.root = mk(shape);
    return t;
  }
  /* check(): tests every B-tree rule. Returns {ok, rules:[{id, ok, bad:[{id,msg}]}]} */
  const RULES = ['max', 'min', 'kids', 'order', 'level'];
  function check(t) {
    const d = t.d, out = {};
    RULES.forEach((r) => { out[r] = []; });
    const leaves = [];
    const show = (x) => '[' + x.keys.join(' ') + ']';
    function walk(x, depth, lo, hi, isRoot) {
      const n = x.keys.length;
      if (n > 2 * d - 1) out.max.push({ id: x.id, msg: `${show(x)} holds ${n} keys; the most allowed is 2d − 1 = ${2 * d - 1}.` });
      if (isRoot && n < 1) out.min.push({ id: x.id, msg: 'The root holds no key; it needs at least 1.' });
      if (!isRoot && n < d - 1) out.min.push({ id: x.id, msg: `${show(x)} holds ${n} key${n === 1 ? '' : 's'}; a node other than the root needs at least d − 1 = ${d - 1}.` });
      let orderBad = null;
      for (let j = 1; j < n; j++) if (x.keys[j] <= x.keys[j - 1]) orderBad = `Inside ${show(x)} the keys are not in increasing order.`;
      for (const k of x.keys) {
        if (orderBad) break;
        if (lo !== null && k <= lo) orderBad = `${show(x)} sits in the subtree for keys above ${lo}, but holds ${k}.`;
        else if (hi !== null && k >= hi) orderBad = `${show(x)} sits in the subtree for keys below ${hi}, but holds ${k}.`;
      }
      if (orderBad) out.order.push({ id: x.id, msg: orderBad });
      if (isLeaf(x)) { leaves.push({ id: x.id, depth, x }); return; }
      if (x.kids.length !== n + 1) out.kids.push({ id: x.id, msg: `${show(x)} holds ${n} key${n === 1 ? '' : 's'}, so it needs ${n + 1} child pointers, but it has ${x.kids.length}.` });
      x.kids.forEach((c, j) => walk(c, depth + 1, j > 0 && n > 0 ? x.keys[Math.min(j - 1, n - 1)] : lo, j < n ? x.keys[j] : hi, false));
    }
    if (t.root) walk(t.root, 0, null, null, true);
    const deep = leaves.reduce((m, l) => Math.max(m, l.depth), 0);
    leaves.filter((l) => l.depth !== deep).forEach((l) => out.level.push({ id: l.id, msg: `Leaf ${show(l.x)} is on level ${l.depth}, but other leaves are on level ${deep}.` }));
    const rules = RULES.map((id) => ({ id, ok: out[id].length === 0, bad: out[id] }));
    return { ok: rules.every((r) => r.ok), rules };
  }
  function height(t) { let h = 0, x = t.root; if (!x) return -1; while (!isLeaf(x)) { x = x.kids[0]; h++; } return h; }
  function countKeys(x) { return x ? x.keys.length + x.kids.reduce((a, c) => a + countKeys(c), 0) : 0; }
  function countNodes(x) { return x ? 1 + x.kids.reduce((a, c) => a + countNodes(c), 0) : 0; }
  function inorder(x, out) { out = out || []; if (!x) return out; x.keys.forEach((k, i) => { if (!isLeaf(x)) inorder(x.kids[i], out); out.push(k); }); if (!isLeaf(x)) inorder(x.kids[x.keys.length], out); return out; }
  function findNode(x, id) { if (!x) return null; if (x.id === id) return x; for (const c of x.kids) { const f = findNode(c, id); if (f) return f; } return null; }
  /* rangeB(): list every key in [lo, hi] in order with an in-order walk that skips
     subtrees lying wholly outside the range. Returns the events in time order:
     {t:'read', id, depth} when a node is first read, {t:'emit', key, id, depth}
     when a key is handed out (the path above a node stays in memory meanwhile). */
  function rangeB(t, lo, hi) {
    const ev = [];
    function walk(x, depth) {
      ev.push({ t: 'read', id: x.id, depth });
      const n = x.keys.length;
      for (let i = 0; i <= n; i++) {
        const left = i > 0 ? x.keys[i - 1] : -Infinity, right = i < n ? x.keys[i] : Infinity;
        if (!isLeaf(x) && right > lo && left < hi) walk(x.kids[i], depth + 1);
        if (i < n && x.keys[i] >= lo && x.keys[i] <= hi) ev.push({ t: 'emit', key: x.keys[i], id: x.id, depth });
      }
    }
    if (t.root) walk(t.root, 0);
    return ev;
  }
  /* B+ tree, bulk-loaded from sorted keys: every key sits in a leaf, leaves are
     chained left to right, and each inner key is a copy of the smallest key of
     the subtree to its right. leafSize keys per leaf, fan children per inner node. */
  function buildPlus(sorted, leafSize, fan) {
    let next = 1;
    let level = [];
    for (let i = 0; i < sorted.length; i += leafSize) level.push({ id: next++, keys: sorted.slice(i, i + leafSize), kids: [], min: sorted[i] });
    level.forEach((l, i) => { l.link = i + 1 < level.length ? level[i + 1].id : null; });
    const leaves = level.slice();
    while (level.length > 1) {
      const up = [];
      for (let i = 0; i < level.length; i += fan) {
        const kids = level.slice(i, i + fan);
        up.push({ id: next++, keys: kids.slice(1).map((c) => c.min), kids, min: kids[0].min });
      }
      level = up;
    }
    return { root: level[0], leaves };
  }
  /* rangePlus(): read root-to-leaf for lo, then follow the leaf links, stopping once
     a leaf reaches hi. Same event format as rangeB.                              */
  function rangePlus(p, lo, hi) {
    const ev = [];
    let x = p.root, depth = 0;
    while (x.kids.length) { ev.push({ t: 'read', id: x.id, depth }); let i = 0; while (i < x.keys.length && lo >= x.keys[i]) i++; x = x.kids[i]; depth++; }
    let leaf = x;
    while (leaf) {
      ev.push({ t: 'read', id: leaf.id, depth });
      for (const k of leaf.keys) if (k >= lo && k <= hi) ev.push({ t: 'emit', key: k, id: leaf.id, depth });
      if (leaf.link === null || leaf.keys[leaf.keys.length - 1] >= hi) break;
      leaf = p.leaves.find((l) => l.id === leaf.link);
    }
    return ev;
  }
  /* heightBounds(): for n keys and minimum degree d.
     most: the tallest legal tree, h <= log_d((n + 1) / 2), rounded down.
     least: the shortest, every node full: (2d)^(h+1) - 1 >= n.
     binary: levels of a perfectly balanced binary search tree.        */
  function heightBounds(n, d) {
    const raw = Math.log((n + 1) / 2) / Math.log(d);
    const most = Math.floor(raw + 1e-9);
    let least = 0; while (Math.pow(2 * d, least + 1) - 1 < n) least++;
    const binary = Math.ceil(Math.log2(n + 1));
    return { raw, most, least, binary };
  }
  /* ENGINE-END ---------------------------------------------------------- */

  /* ---------- drawing ----------
     treeView(ctx, t, o) returns an element that shows tree t (t.root may be null).
     o.node {id: cls} colours whole nodes, o.key {key: cls} colours single keys
     (cls is an SVG class such as s-io, s-ok, s-warn, s-accent, s-bad),
     o.path [ids] colours the edges into those nodes, o.tag {id: text} writes a small
     label above a node, o.onKey(key, id) makes every key a button, o.links draws
     leaf-to-leaf arrows (B+ tree), o.vw / o.vh give the nominal drawing size.
     On small screens the same tree is shown as an indented outline instead.       */
  const CW = 30, PAD = 4, NH = 32, LH = 64, TOP = 24;
  const SHORT = { 's-io': 'c-io', 's-ok': 'c-ok', 's-warn': 'c-warn', 's-accent': 'c-accent', 's-bad': 'c-bad', 's-panel': '' };
  const keysOf = (x) => '[' + x.keys.join(' ') + ']';
  function treeView(ctx, t, o) {
    o = o || {};
    o.node = o.node || {}; o.key = o.key || {}; o.tag = o.tag || {};
    if (ctx.narrow) return outlineView(ctx, t, o);
    const { s } = ctx;
    const gap = o.gap || 12;
    const VW0 = o.vw || 640, VH0 = o.vh || 220;
    if (!t.root) {
      return s('svg', { viewBox: `0 0 ${VW0} ${VH0}`, width: '100%', class: 'bt-svg', role: 'img', 'aria-label': 'Empty tree' },
        s('text', { x: VW0 / 2, y: VH0 / 2, 'text-anchor': 'middle', class: 's-sub', 'font-size': 17 }, o.empty || 'The tree is empty.'));
    }
    const nw = (x) => Math.max(1, x.keys.length) * CW + 2 * PAD;
    const sw = new Map(), pos = new Map();
    let depthMax = 0;
    function measure(x, depth) {
      let w = nw(x);
      depthMax = Math.max(depthMax, depth);
      if (x.kids.length) w = Math.max(w, x.kids.reduce((a, c) => a + measure(c, depth + 1), 0) + gap * (x.kids.length - 1));
      sw.set(x, w);
      return w;
    }
    const leaves = [];
    function place(x, left, depth) {
      const w = sw.get(x);
      pos.set(x, { l: left + w / 2 - nw(x) / 2, y: TOP + depth * LH, w: nw(x) });
      if (!x.kids.length) { leaves.push(x); return; }
      const tot = x.kids.reduce((a, c) => a + sw.get(c), 0) + gap * (x.kids.length - 1);
      let l = left + (w - tot) / 2;
      x.kids.forEach((c) => { place(c, l, depth + 1); l += sw.get(c) + gap; });
    }
    const W = measure(t.root, 0);
    const VW = Math.max(W + 8, VW0), H = TOP + depthMax * LH + NH + 6, VH = Math.max(H, VH0);
    place(t.root, (VW - W) / 2, 0);
    const oy = Math.max(0, (VH - H) / 2);
    const svg = s('svg', { viewBox: `0 0 ${VW} ${VH}`, width: '100%', class: 'bt-svg', role: 'img', 'aria-label': o.aria || 'B-tree diagram' });
    if (o.fit) { svg.setAttribute('height', '100%'); svg.setAttribute('preserveAspectRatio', 'xMidYMid meet'); }
    const onPath = new Set(o.path || []);
    const edges = [], nodes = [];
    pos.forEach((p, x) => {
      const y = p.y + oy;
      x.kids.forEach((c, j) => {
        const q = pos.get(c), px = p.l + PAD + j * CW;
        const hot = onPath.has(c.id);
        edges.push(s('line', { x1: px, y1: y + NH, x2: q.l + q.w / 2, y2: q.y + oy, class: hot ? 'bt-edge hot' : 'bt-edge' }));
        edges.push(s('circle', { cx: px, cy: y + NH, r: 3, class: hot ? 'bt-dot hot' : 'bt-dot' }));
      });
      const g = s('g', {});
      g.append(s('rect', { x: p.l, y, width: p.w, height: NH, rx: 7, class: (o.node[x.id] || 's-panel') + ' bt-node', 'stroke-width': o.node[x.id] ? 2.5 : 1.5 }));
      x.keys.forEach((k, i) => {
        const kx = p.l + PAD + i * CW;
        if (i > 0) g.append(s('line', { x1: kx, y1: y + 6, x2: kx, y2: y + NH - 6, class: 'bt-div' }));
        if (o.key[k]) g.append(s('rect', { x: kx + 2, y: y + 4, width: CW - 4, height: NH - 8, rx: 5, class: o.key[k], 'stroke-width': 2 }));
        const txt = s('text', { x: kx + CW / 2, y: y + NH / 2 + 6, 'text-anchor': 'middle', class: 'bt-k' }, String(k));
        if (o.onKey) {
          const fn = () => o.onKey(k, x.id);
          g.append(s('g', { class: 'bt-hot', role: 'button', tabindex: 0, 'aria-label': 'Key ' + k, onclick: fn,
            onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } } },
          s('rect', { x: kx + 1, y: y + 2, width: CW - 2, height: NH - 4, rx: 5, class: 'bt-hit' }), txt));
        } else g.append(txt);
      });
      if (o.tag[x.id] != null) g.append(s('text', { x: p.l + p.w / 2, y: y - 7, 'text-anchor': 'middle', class: 'bt-tag' }, String(o.tag[x.id])));
      nodes.push(g);
    });
    if (o.links) {
      for (let i = 0; i + 1 < leaves.length; i++) {
        const a = pos.get(leaves[i]), b = pos.get(leaves[i + 1]);
        edges.push(s('line', { x1: a.l + a.w + 2, y1: a.y + oy + NH / 2, x2: b.l - 3, y2: b.y + oy + NH / 2, class: 'bt-link', 'marker-end': 'url(#arr-muted)' }));
      }
    }
    svg.append(...edges, ...nodes);
    return svg;
  }
  /* outlineView(): the small-screen form of treeView, an indented list of nodes. */
  function outlineView(ctx, t, o) {
    const { h } = ctx;
    const box = h('div', { class: 'bt-out', role: 'group', 'aria-label': o.aria || 'B-tree outline' });
    if (!t.root) { box.append(h('div', { class: 'muted small' }, o.empty || 'The tree is empty.')); return box; }
    (function walk(x, depth, last) {
      const row = h('div', { class: 'bt-row', style: { paddingLeft: depth * 18 + 'px' } });
      if (depth) row.append(h('span', { class: 'bt-elbow' }, '└'));
      const nd = h('span', { class: 'bt-onode ' + (SHORT[o.node[x.id]] || '') });
      x.keys.forEach((k) => {
        const c = 'bt-ok ' + (SHORT[o.key[k]] || '');
        nd.append(o.onKey ? h('button', { type: 'button', class: c + ' bt-obtn', 'aria-label': 'Key ' + k, onclick: () => o.onKey(k, x.id) }, String(k)) : h('span', { class: c }, String(k)));
      });
      row.append(nd);
      if (o.tag[x.id] != null) row.append(h('span', { class: 'bt-otag' }, String(o.tag[x.id])));
      if (o.links && !x.kids.length && !last) row.append(h('span', { class: 'bt-otag' }, '→ next leaf'));
      box.append(row);
      x.kids.forEach((c, j) => walk(c, depth + 1, last !== false && j === x.kids.length - 1));
    })(t.root, 0, true);
    return box;
  }

  /* listing(ctx, rows, o): pseudocode with a plain-language comment on every line.
     rows = [[code, comment], ...]. Wide screens put each comment beside its line;
     small screens put it on its own line just above, so nothing runs off the side.
     .mark(n or [n, ...]) highlights code line n (counted in rows) in either layout. */
  function listing(ctx, rows, o) {
    const slim = ctx.narrow, w = Math.max(...rows.map((r) => r[0].length));
    const src = slim ? rows.map(([c, m]) => c.match(/^\s*/)[0] + '// ' + m + '\n' + c).join('\n')
      : rows.map(([c, m]) => c.padEnd(w + 1) + '// ' + m).join('\n');
    const pre = ctx.ui.code(src, Object.assign({ lang: 'c', nums: !slim }, o));
    const lines = (n) => (slim ? [2 * n - 1, 2 * n] : [n]);
    return { el: pre, mark: (ns) => pre.mark([].concat(ns).flatMap(lines)), clear: () => pre.clear() };
  }

  /* insertFrames(before, k, res, d): turns the events of one insert into frames
     {tree, node, key, path, cap, line} that a player or an animation can draw.
     A split gives two frames (the full node, then the result); a placement gives one. */
  function insertFrames(before, k, res, d) {
    const frames = [];
    let prev = before;
    if (res.dup) return [{ tree: before, node: {}, key: { [k]: 's-ok' }, cap: `<b>${k}</b> is already in the tree. A B-tree index keeps each key once, so nothing changes.`, line: null }];
    res.ev.forEach((e, n) => {
      const head = n === 0 ? `<b>Insert ${k}.</b> ` : '';
      if (e.type === 'rootsplit' || e.type === 'split') {
        const root = e.type === 'rootsplit';
        const full = '[' + e.before.join(' ') + ']';
        frames.push({ tree: prev, node: { [e.left]: 's-warn' }, key: { [e.median]: 's-accent' }, line: root ? 1 : 5,
          cap: head + (root
            ? `The root ${full} is full: it holds 2d − 1 = ${2 * d - 1} keys. Split it first. Its median, <b>${e.median}</b>, will move up into a brand-new root.`
            : `The way down leads into ${full}, which is full (${2 * d - 1} keys). Split it before stepping in: its median, <b>${e.median}</b>, moves up into the parent, which has room.`) });
        const pn = findNode(e.tree.root, e.parent), ln = findNode(e.tree.root, e.left), rn = findNode(e.tree.root, e.right);
        frames.push({ tree: e.tree, node: { [e.left]: 's-warn', [e.right]: 's-warn' }, key: { [e.median]: 's-accent' }, line: root ? 1 : 5,
          cap: root
            ? `Root split: <b>${e.median}</b> sits alone in the new root, with ${keysOf(ln)} and ${keysOf(rn)} as its two children (d − 1 = ${d - 1} keys each). The tree is now one level taller: height ${height(e.tree)}.`
            : `<b>${e.median}</b> moved up into ${keysOf(pn)}. The old node became ${keysOf(ln)} and ${keysOf(rn)}, with d − 1 = ${d - 1} keys each.` });
      } else {
        const leaf = findNode(e.tree.root, e.node);
        const had = leaf.keys.length - 1;
        frames.push({ tree: e.tree, node: { [e.node]: 's-io' }, key: { [k]: 's-ok' }, path: e.path, line: 7,
          cap: head + (e.first
            ? `The tree was empty, so <b>${k}</b> becomes the root, which is also a leaf.`
            : `<b>${k}</b> goes into the leaf in sorted order: ${keysOf(leaf)}. That leaf had ${had} key${had === 1 ? '' : 's'}, fewer than 2d − 1 = ${2 * d - 1}, so there was room.`) });
      }
      prev = e.tree;
    });
    return frames;
  }

  /* the tree used by the search step: built by the engine from these inserts (d = 3) */
  const SEARCH_KEYS = [56, 82, 66, 88, 73, 29, 85, 55, 27, 54, 84, 74, 39, 93, 42, 4, 22, 36, 34, 43];
  /* the insertion walkthrough (d = 3): this starting tree, then these four inserts */
  const WALK_START = [[20, 40, 60, 80], [[[3, 7, 12]], [[24, 28, 33, 36]], [[44, 51]], [[63, 66, 70, 74, 77]], [[85, 91, 96]]]];
  const WALK_KEYS = [48, 72, 30, 26];
  /* the playground's first tree (d = 3): root [30 60] over three leaves */
  const PLAY_START = [50, 20, 80, 10, 30, 60, 90, 40, 70, 25, 65, 15];
  /* the B+ tree comparison: the same 15 keys as a B-tree (d = 2, built in this insert
     order) and as a bulk-loaded B+ tree with 3 keys per leaf and 3 children per inner node */
  const BP_KEYS = [6, 11, 17, 23, 29, 34, 40, 46, 52, 57, 63, 69, 75, 82, 88];
  const BP_ORDER = [52, 23, 75, 11, 40, 63, 88, 6, 17, 29, 34, 46, 57, 69, 82];
  /* predict-the-split rounds (d = 3): [starting tree shape, key to insert] */
  const ROUNDS = [
    [[[30, 60], [[[10, 15, 20, 25, 28]], [[40, 45]], [[70, 80, 90]]]], 22],
    [[[40, 70], [[[12, 25]], [[48, 53, 61]], [[77, 85, 92, 99]]]], 58],
    [[[20, 35, 50, 65, 80], [[[5, 10]], [[24, 28]], [[38, 44]], [[55, 60]], [[68, 73]], [[85, 90]]]], 41],
    [[[50], [[[8, 12, 19, 27, 33]], [[61, 74]]]], 3],
    [[[50], [[[8, 16, 24, 32, 40], [[[2, 5]], [[10, 13]], [[18, 21]], [[26, 29]], [[34, 37]], [[43, 47]]]], [[70, 85], [[[55, 62]], [[74, 79]], [[90, 95]]]]]], 27],
  ];

  Guide.section({
    id: '12.3',
    title: 'B-Trees',
    short: 'B-trees',
    summary: 'Short, wide trees whose nodes fill disk blocks, so a lookup among millions of keys takes only a few reads.',
    objectives: [
      'Explain why an index kept on disk needs a short, wide tree, and why each B-tree node is the size of one disk block.',
      'State the rules of a B-tree of minimum degree d and spot a tree that breaks one.',
      'Search a B-tree while counting disk reads, and insert keys with node splits, including the root split that makes the tree taller.',
      'Use the bound h ≤ log<sub>d</sub>((n + 1) / 2) to compute how many reads a lookup can need, and compare it with a binary search tree.',
      'Describe how a B+ tree differs from a B-tree and why file systems and databases favour it.',
    ],
    terms: [
      ['B-tree', 'A balanced search tree built for disks. Each node fills one disk block and holds many keys in sorted order, so a search reads only a few nodes even when the tree holds millions of keys.'],
      ['Index', 'A lookup structure that pairs each key with the place where its record is stored, so one record can be found without reading the whole file.'],
      ['Key', 'The value used to find a record, such as a file name or an account number. Inside a B-tree node the keys are kept in increasing order.'],
      ['Node (tree node)', 'One box of a tree. In a B-tree a node is one disk block holding a sorted list of keys and, unless it is a leaf, one pointer to a child for each gap between and around those keys.'],
      ['Root (root node)', 'The single node at the top of a tree, where every search starts.'],
      ['Leaf (leaf node)', 'A node with no children, at the bottom of a tree. In a B-tree every leaf sits on the same level.'],
      ['Internal node (nonleaf node)', 'A node that has children. In a B-tree an internal node with k keys has exactly k + 1 children.'],
      ['Minimum degree (d)', 'The number that fixes a B-tree\'s node sizes: every node holds at most 2d − 1 keys, and every node except the root holds at least d − 1 keys. d is at least 2.'],
      ['Fan-out (branching factor)', 'How many children a node has. A large fan-out makes a tree short and wide.'],
      ['Height (tree height)', 'The number of steps down from the root to a leaf. A tree whose root is its only node has height 0; a tree of height h has h + 1 levels.'],
      ['Balanced tree', 'A tree in which every path from the root to a leaf has (nearly) the same length, so no search is much slower than another. In a B-tree every leaf is on exactly the same level.'],
      ['Separator key', 'A key in an internal node that divides the key ranges of the two subtrees on its sides: smaller keys live to its left, larger keys to its right.'],
      ['Split (node split)', 'What a B-tree does to a full node: the middle (median) key moves up into the parent, and the keys on either side of it become two separate nodes.'],
      ['Median key', 'The middle key of a full node. With 2d − 1 keys it is the d-th key, with d − 1 keys on each side; it is the key that moves up when the node splits.'],
      ['Root split', 'The split of a full root. A new root is created to hold the median key, so the tree grows one level taller; it is the only way a B-tree gains height.'],
      ['Proactive splitting (top-down insertion)', 'An insertion method that splits every full node it meets on the way down, so a key that moves up always finds room in its parent and the insertion never has to climb back up.'],
      ['Binary search tree', 'A tree whose nodes each hold one key and have at most two children, smaller keys to the left and larger keys to the right.'],
      ['B+ tree', 'A B-tree variant that keeps every key and record in the leaves, uses internal nodes only to steer searches, and links the leaves in key order for fast sequential scans.'],
      ['Range query', 'A request for every record whose key lies between two values, such as all accounts numbered 300 to 400, returned in key order.'],
    ],
    css: `
      .sec-12-3 .bt-svg { display: block; }
      .sec-12-3 .bt-svg .bt-k { font-size: 16px; font-weight: 700; font-family: var(--mono); }
      .sec-12-3 .bt-svg .bt-tag { font-size: 13px; font-weight: 800; fill: var(--io); paint-order: stroke; stroke: var(--panel); stroke-width: 4px; stroke-linejoin: round; }
      .sec-12-3 .bt-svg .bt-edge { stroke: var(--line-2); stroke-width: 1.6; fill: none; }
      .sec-12-3 .bt-svg .bt-edge.hot { stroke: var(--io); stroke-width: 3; }
      .sec-12-3 .bt-svg .bt-dot { fill: var(--line-2); }
      .sec-12-3 .bt-svg .bt-dot.hot { fill: var(--io); }
      .sec-12-3 .bt-svg .bt-div { stroke: var(--line-2); stroke-width: 1; }
      .sec-12-3 .bt-svg .bt-link { stroke: var(--muted); stroke-width: 1.6; stroke-dasharray: 4 3; }
      .sec-12-3 .bt-svg .bt-hit { fill: transparent; stroke: none; }
      .sec-12-3 .bt-svg .bt-hot { cursor: pointer; outline: none; }
      .sec-12-3 .bt-svg .bt-hot:hover .bt-hit { fill: var(--hl); }
      .sec-12-3 .bt-svg .bt-hot:focus-visible .bt-hit { stroke: var(--accent); stroke-width: 2.5; }
      .sec-12-3 .bt-out { font-family: var(--mono); font-size: 14.5px; display: flex; flex-direction: column; gap: 3px; }
      .sec-12-3 .bt-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
      .sec-12-3 .bt-elbow { color: var(--muted); }
      .sec-12-3 .bt-onode { display: inline-flex; border: 1.5px solid var(--line-2); background: var(--panel-2); border-radius: 7px; padding: 1px 3px; gap: 2px; }
      .sec-12-3 .bt-ok { display: inline-block; min-width: 26px; text-align: center; font-weight: 700; border-radius: 5px; padding: 1px 2px; border: 1.5px solid transparent; }
      .sec-12-3 .bt-obtn { font: inherit; font-weight: 700; color: var(--ink); background: transparent; cursor: pointer; }
      .sec-12-3 .bt-otag { font-size: 13px; font-weight: 800; color: var(--io); }
      .sec-12-3 .c-io { border-color: var(--io) !important; background: var(--io-bg) !important; }
      .sec-12-3 .c-ok { border-color: var(--ok) !important; background: var(--ok-bg) !important; }
      .sec-12-3 .c-warn { border-color: var(--warn) !important; background: var(--warn-bg) !important; }
      .sec-12-3 .c-accent { border-color: var(--accent) !important; background: var(--accent-bg) !important; }
      .sec-12-3 .c-bad { border-color: var(--bad) !important; background: var(--bad-bg) !important; }
      .sec-12-3 .narr { background: var(--panel-2); border: 1px solid var(--line); border-left: 5px solid var(--chc); border-radius: 12px; padding: 9px 13px; font-size: 15.5px; line-height: 1.45; }
      .sec-12-3 .narr.ok { border-left-color: var(--ok); background: var(--ok-bg); }
      .sec-12-3 .narr.bad { border-left-color: var(--bad); background: var(--bad-bg); }
      .sec-12-3 .narr.warn { border-left-color: var(--warn); background: var(--warn-bg); }
      .sec-12-3 ol.rules { padding-left: 22px; font-size: 15px; line-height: 1.42; }
      .sec-12-3 ol.rules li { margin: 0 0 5px; padding: 1px 6px; border-radius: 6px; }
      .sec-12-3 ol.rules li.bad { background: var(--bad-bg); }
      .sec-12-3 ol.rules li.ok { background: var(--ok-bg); }
      .sec-12-3 .btn.ok-b { border-color: var(--ok); color: var(--ok); }
      .sec-12-3 .btn.bad-b { border-color: var(--bad); color: var(--bad); }
      .sec-12-3 input.kin { width: 76px; height: 30px; border: 1px solid var(--line-2); border-radius: 8px; background: var(--panel); color: var(--ink); font: inherit; font-size: 15px; padding: 0 8px; }
      .sec-12-3 .pg .log { font-size: 13px; }
      .sec-12-3 .ui-slider label { min-width: 150px; }
      .sec-12-3 .legend { display: flex; flex-wrap: wrap; gap: 6px 12px; font-size: 13.5px; color: var(--ink-2); }
      .sec-12-3 .legend i { display: inline-block; width: 14px; height: 14px; border-radius: 4px; border: 2px solid; vertical-align: -2px; margin-right: 5px; }
      .sec-12-3 table.ht th, .sec-12-3 table.ht td { white-space: nowrap; }
      .sec-12-3 table.ht sup { line-height: 0; }
      .sec-12-3 table.ht .chip { line-height: 1.35; }
      .sec-12-3 table.ht tr.gap td { padding-top: 1px; padding-bottom: 1px; line-height: 1.2; }
    `,
    steps: [
      /* ---------------- 1. Big picture ---------------- */
      {
        title: 'One key among millions, three disk reads',
        kind: 'story',
        html: `
          <div class="split fill">
            <div class="stack" style="gap:9px">
              <p class="lead m0">A file system or a database often has to find one entry, say a file name or an account number, among millions. The table that lists them is far too big for memory, so it lives on disk.</p>
              <p class="m0">That table is an <span class="t">index</span>: it pairs each <span class="t">key</span> with the place where its record is stored. Every step of a search through it costs one <span class="t" data-t="disk block">disk block</span> read, and a random read from a hard disk takes several milliseconds, roughly 100,000 times longer than a read from main memory. The goal is therefore not fewer comparisons but <b>fewer reads</b>.</p>
              <p class="m0">A <span class="t">B-tree</span> gets there by making every <span class="t" data-t="node">node</span> exactly one disk block and packing it with many sorted keys. One read then chooses among hundreds of branches instead of two, so a million keys sit three levels deep instead of twenty.</p>
              <div class="callout analogy m0" data-label="Analogy">A huge office campus. The gate sign says which building holds which department, the lobby board lists floors, the floor board lists rooms: three signs bring you to one door among thousands. Signs offering only “left or right” would need twelve stops to reach one of 4,000 rooms.</div>
            </div>
            <div class="card stack" style="gap:8px">
              <h4 class="m0">One node = one disk block. Click its parts.</h4>
              <div class="anat"></div>
              <div class="narr anat-say" aria-live="polite"></div>
              <p class="small muted m0 anat-cap"></p>
              <div class="row gap-s small" style="margin-top:auto"><span class="chip io">count disk reads</span><span class="chip warn">watch nodes split</span><span class="chip accent">predict a split</span><span class="chip ok">bound the height</span><span class="chip mem">meet the B+ tree</span></div>
            </div>
          </div>`,
        render(el, ctx) {
          const { s } = ctx;
          const slim = ctx.narrow;
          const W = slim ? 380 : 560, SL = slim ? 26 : 32, KW = slim ? 56 : 70;
          const NWID = 4 * SL + 3 * KW, NX = (W - NWID) / 2, NY = 10, NHT = 48;
          const CBW = slim ? 86 : 122, CG = (W - 8 - 4 * CBW) / 3, CY = 150, CHT = 58;
          const keys = [20, 45, 70];
          const rng = ['below 20', '20 to 45', '45 to 70', 'above 70'];
          const say = [
            'Child pointer 0 holds the disk address of the subtree with every key <b>below 20</b>. A search for 12 reads that child next.',
            'Key <b>20</b>, stored with a pointer to its record (the data it indexes). It is a <span class="t">separator key</span>: smaller keys live to its left, larger ones to its right.',
            'Child pointer 1 leads to the keys <b>between 20 and 45</b>. A search for 31 compares 31 with 20 (bigger) and with 45 (smaller), then reads this child.',
            'Key <b>45</b> with its record pointer. A search for 45 itself stops right here, found in the very first block it read.',
            'Child pointer 2 leads to the keys <b>between 45 and 70</b>. The comparisons happen in memory, which is fast; only the jump to the child costs a disk read.',
            'Key <b>70</b> with its record pointer, the largest key in this node. Keys inside a node are always kept in increasing order.',
            'Child pointer 3 leads to every key <b>above 70</b>. Three keys leave four gaps, so this node has four children: k keys always come with k + 1 child pointers.',
          ];
          let sel = 2;
          const svg = s('svg', { viewBox: `0 0 ${W} ${CY + CHT + 6}`, width: '100%', role: 'group', 'aria-label': 'Parts of one B-tree node' });
          ctx.$('.anat').append(svg);
          ctx.$('.anat-cap').innerHTML = 'Drawn with 3 keys so it fits. A real node fills its whole block: with 4,096-byte blocks and 8-byte keys and pointers, it holds 170 keys (each with a record pointer) and 171 child pointers, since 170 × 16 + 171 × 8 = 4,088 bytes.';
          function draw() {
            const lines = [], parts = [];
            let x = NX;
            for (let i = 0; i < 7; i++) {
              const ptr = i % 2 === 0, w = ptr ? SL : KW, on = i === sel, x0 = x;
              const fn = () => { sel = i; draw(); };
              parts.push(s('g', { class: 'bt-hot', role: 'button', tabindex: 0, 'aria-label': ptr ? 'Child pointer ' + i / 2 : 'Key ' + keys[(i - 1) / 2], 'aria-pressed': on ? 'true' : 'false', onclick: fn,
                onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } } },
              s('rect', { x: x0 + 1, y: NY, width: w - 2, height: NHT, rx: 7, class: on ? 's-accent' : (ptr ? 's-io' : 's-panel'), 'stroke-width': on ? 3 : 1.5 }),
              ptr ? s('circle', { cx: x0 + w / 2, cy: NY + NHT / 2, r: 4.5, style: 'fill:var(--io)' })
                : s('text', { x: x0 + w / 2, y: NY + NHT / 2 + 7, 'text-anchor': 'middle', 'font-size': 20, 'font-weight': 800, class: 'mono' }, String(keys[(i - 1) / 2]))));
              if (ptr) {
                const j = i / 2, cx = 4 + j * (CBW + CG);
                lines.push(s('line', { x1: x0 + w / 2, y1: NY + NHT, x2: cx + CBW / 2, y2: CY - 4, class: on ? '' : 's-muted', style: on ? 'stroke:var(--io);stroke-width:3' : '', 'marker-end': on ? 'url(#arr-io)' : 'url(#arr-muted)' }));
                parts.push(s('rect', { x: cx, y: CY, width: CBW, height: CHT, rx: 9, class: on ? 's-io' : 's-panel', 'stroke-width': on ? 2.5 : 1.5 }),
                  s('text', { x: cx + CBW / 2, y: CY + 24, 'text-anchor': 'middle', 'font-size': 14, class: 's-sub' }, 'child ' + j + ': keys'),
                  s('text', { x: cx + CBW / 2, y: CY + 45, 'text-anchor': 'middle', 'font-size': slim ? 14 : 15.5, 'font-weight': 700 }, rng[j]));
              }
              x += w;
            }
            svg.replaceChildren(...lines, ...parts);
            ctx.$('.anat-say').innerHTML = say[sel];
          }
          draw();
        },
      },
      /* ---------------- 2. The rules + a checker game ---------------- */
      {
        title: 'The rules of a B-tree, and a tree inspector',
        kind: 'learn',
        render(el, ctx) {
          const { h } = ctx;
          /* puzzles: [minimum degree, shape]; shape = [keys] or [keys, [child shapes]] */
          const P = [
            [3, [[30, 60], [[[10, 20]], [[40, 45, 50]], [[70, 80, 90, 95]]]]],
            [2, [[40], [[[10, 20, 30, 35]], [[50, 60]]]]],
            [3, [[50], [[[10, 20, 30]], [[60, 70]]]]],
            [3, [[50], [[[20]], [[60, 70, 80]]]]],
            [2, [[30, 60], [[[10, 20]], [[45], [[[35, 40]], [[50, 55]]]], [[70, 80]]]]],
            [2, [[40], [[[20], [[[10]], [[30]]]], [[60, 80], [[[50]], [[70]], [[90]]]]]]],
            [3, [[40], [[[10, 20, 45]], [[50, 60, 70]]]]],
            [2, [[30, 60], [[[10, 20]], [[40, 50]]]]],
          ];
          const NAMES = { max: 'Most keys', min: 'Fewest keys', kids: 'Pointers', order: 'Order', level: 'Balance' };
          let d = P[0][0], cur = 0, verdict = null, score = 0, tries = 0;
          const list = h('ol', { class: 'rules m0' });
          const seg = ctx.ui.seg([{ value: 2, label: 'd = 2' }, { value: 3, label: 'd = 3' }, { value: 4, label: 'd = 4' }, { value: 100, label: 'd = 100' }], d, (v) => { d = v; paintRules(); });
          function paintRules() {
            const broken = verdict && d === P[cur][0] ? new Set(verdict.rules.filter((r) => !r.ok).map((r) => r.id)) : new Set();
            const txt = {
              max: `<b>Most keys.</b> Every node holds at most 2d − 1 = <b>${2 * d - 1}</b> keys, so it has at most 2d = ${2 * d} children.`,
              min: `<b>Fewest keys.</b> Every node except the root holds at least d − 1 = <b>${d - 1}</b> key${d === 2 ? '' : 's'} (an internal one has at least d = ${d} children). The root needs only 1 key, and 2 children unless it is the only node.`,
              kids: '<b>Pointers.</b> An internal node with k keys has exactly k + 1 children; a leaf has none.',
              order: '<b>Order.</b> Keys in a node increase from left to right, and every key in the subtree between two keys lies between those two keys.',
              level: '<b>Balance.</b> Every leaf is on the same level.',
            };
            list.replaceChildren(...RULES.map((id) => h('li', { class: broken.has(id) ? 'bad' : (verdict && d === P[cur][0] ? 'ok' : ''), html: txt[id] })));
          }
          const head = h('div', { class: 'row', style: { justifyContent: 'space-between' } });
          const pic = h('div', { class: 'card white tight', style: { padding: '4px 8px' } });
          const say = h('div', { class: 'narr', 'aria-live': 'polite' });
          const bValid = h('button', { class: 'btn ok-b', type: 'button', onclick: () => answer(true) }, '✓ Valid B-tree');
          const bBroken = h('button', { class: 'btn bad-b', type: 'button', onclick: () => answer(false) }, '✗ Breaks a rule');
          const bNext = h('button', { class: 'btn primary', type: 'button', onclick: () => load(cur + 1) }, 'Next tree →');
          function load(i) {
            if (i >= P.length) { i = 0; score = 0; tries = 0; }
            cur = i; verdict = null;
            d = P[cur][0]; seg.set(d);
            bValid.disabled = false; bBroken.disabled = false; bNext.disabled = true;
            bNext.textContent = cur === P.length - 1 ? 'Start over' : 'Next tree →';
            say.className = 'narr';
            say.innerHTML = `Is this a legal B-tree of minimum degree <b>d = ${d}</b>? Check it against the five rules on the left, then choose.`;
            paint(null);
          }
          function paint(res) {
            const t = fromShape(P[cur][0], P[cur][1]);
            const node = {};
            if (res) res.rules.forEach((r) => r.bad.forEach((b) => { node[b.id] = 's-bad'; }));
            pic.replaceChildren(treeView(ctx, t, { node, vw: 470, vh: 172, aria: 'Tree to inspect' }));
            head.replaceChildren(h('b', {}, `Tree ${cur + 1} of ${P.length}`), h('span', { class: 'chip accent' }, `minimum degree d = ${P[cur][0]}`), h('span', { class: 'chip' }, `score ${score} / ${tries}`));
            paintRules();
          }
          function answer(saysValid) {
            const t = fromShape(P[cur][0], P[cur][1]), res = check(t), dd = P[cur][0];
            verdict = res; tries++;
            const right = saysValid === res.ok;
            if (right) score++;
            bValid.disabled = true; bBroken.disabled = true; bNext.disabled = false;
            let why;
            if (res.ok) {
              const r = t.root;
              why = `Every rule holds: no node has more than ${2 * dd - 1} keys, every node below the root has at least ${dd - 1}, each internal node has one more child than keys, the keys are in order, and all leaves are on level ${height(t)}.` +
                (r.keys.length < dd - 1 ? ' The root holding a single key is fine: only the root is exempt from the d − 1 minimum.' : '');
            } else why = res.rules.filter((r) => !r.ok).map((r) => `<b>${NAMES[r.id]}:</b> ${r.bad.map((b) => b.msg).join(' ')}`).join('<br>');
            say.className = 'narr ' + (right ? 'ok' : 'bad');
            say.innerHTML = (right ? '<b>Right.</b> ' : '<b>Not quite.</b> ') + (res.ok ? 'It is a valid B-tree. ' : 'It breaks a rule (red). ') + why;
            paint(res);
          }
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack', style: { gap: '10px' } },
              h('p', { class: 'm0', html: 'A B-tree is described by one number, its <span class="t">minimum degree</span> <b>d</b> (at least 2). Five rules then hold at every moment:' }),
              seg, list,
              h('div', { class: 'callout why m0', 'data-label': 'Why these rules', html: 'Half-full nodes guarantee a big <span class="t">fan-out</span>, and level leaves make it a perfectly <span class="t">balanced tree</span>: together they keep every search path short.' })),
            h('div', { class: 'stack', style: { gap: '8px' } },
              head, pic, h('div', { class: 'row' }, bValid, bBroken, h('span', { class: 'grow' }), bNext), say)));
          load(0);
        },
      },
      /* ---------------- 3. Search, one read per level ---------------- */
      {
        title: 'Search: one disk read per level',
        kind: 'explore',
        render(el, ctx) {
          const { h } = ctx;
          const t = build(3, SEARCH_KEYS), ht = height(t);
          const TARGETS = [82, 39, 55, 60];
          let k = TARGETS[0], frames = [];
          const code = listing(ctx, [
            ['x = read(root)', 'read 1: the root block'],
            ['loop:', 'once per level, downward'],
            ['  i = first slot, key >= k', 'scan in memory (cheap)'],
            ['  if i < n and key[i] == k', 'is k in this node?'],
            ['    return found', 'yes: k is found'],
            ['  if x is a leaf', 'no: any level below?'],
            ['    return not found', 'no: k is not stored'],
            ['  x = read(child[i])', 'read: the one child for k'],
          ], { fontSize: 13.5 });
          const reads = h('div', { class: 'big', style: { color: 'var(--io)' } }, '0');
          const readsNote = h('div', { class: 'small muted' });
          const pic = h('div', { class: 'card white tight grow', style: { display: 'grid', alignItems: 'center' } });
          const seg = ctx.ui.seg(TARGETS.map((v) => ({ value: v, label: 'find ' + v })), k, (v) => { k = v; plan(); player.setCount(frames.length); });
          function plan() {
            const res = search(t, k);
            frames = [{ line: null, node: {}, key: {}, path: [], tag: {}, n: 0, cap: `<b>Search for ${k}.</b> Nothing is in memory yet: the whole index sits on disk, one node per block.` }];
            const node = {}, tag = {}, path = [];
            res.path.forEach((p, j) => {
              node[p.id] = 's-io'; tag[p.id] = 'read ' + (j + 1); path.push(p.id);
              const keys = '[' + p.keys.join(' ') + ']';
              frames.push({ line: j === 0 ? 1 : 8, node: Object.assign({}, node), key: {}, path: path.slice(), tag: Object.assign({}, tag), n: j + 1,
                cap: `<b>Disk read ${j + 1}:</b> node ${keys} comes into memory. ` + (j === 0 ? 'Every search starts at the root.' : `It is the only child whose key range can hold ${k}.`) });
              let cap, line = 3;
              const key = {}, n = p.keys.length;
              if (p.found) { key[k] = 's-ok'; line = [4, 5]; cap = `Scanning the keys in memory finds <b>${k}</b> right here. Found after <b>${j + 1}</b> disk read${j ? 's' : ''}.`; }
              else {
                if (p.i > 0) key[p.keys[p.i - 1]] = 's-accent';
                if (p.i < n) key[p.keys[p.i]] = 's-accent';
                if (p.leaf) { line = [6, 7]; cap = `${k} is not in this node, and the node is a <span class="t" data-t="leaf">leaf</span>: no child is left to try, so <b>${k} is not in the index</b>. That took ${j + 1} reads, the height plus one.`; }
                else cap = p.i === 0 ? `${k} is smaller than ${p.keys[0]}, so it can only be in child 0, the subtree of keys below ${p.keys[0]}.`
                  : p.i === n ? `${k} is larger than ${p.keys[n - 1]}, so it can only be in the last child, the subtree of keys above ${p.keys[n - 1]}.`
                    : `${k} lies between the <span class="t" data-t="separator key">separators</span> ${p.keys[p.i - 1]} and ${p.keys[p.i]}, so it can only be in child ${p.i}.`;
              }
              frames.push({ line, node: Object.assign({}, node), key, path: path.slice(), tag: Object.assign({}, tag), n: j + 1, cap });
            });
          }
          function draw(i) {
            const f = frames[i];
            pic.replaceChildren(treeView(ctx, t, { node: f.node, key: f.key, path: f.path, tag: f.tag, vw: 560, vh: 196, aria: 'B-tree being searched' }));
            if (f.line) code.mark(f.line); else code.clear();
            reads.textContent = String(f.n);
            readsNote.innerHTML = `disk reads so far. Height ${ht} means no search ever needs more than ${ht} + 1 = <b>${ht + 1}</b> reads.`;
            return f.cap;
          }
          plan();
          const player = ctx.ui.player({ count: frames.length, render: draw, interval: 1900 });
          el.append(h('div', { class: 'split fill' },
            h('div', { class: 'stack', style: { gap: '10px' } },
              h('p', { class: 'm0', html: 'Searching a <span class="t">B-tree</span> works like searching a <span class="t">binary search tree</span>, except that each node offers many ways down. Pick a key and step through.' }),
              seg, code.el,
              h('div', { class: 'card io tight row nw', style: { gap: '14px' } }, reads, readsNote),
              h('div', { class: 'callout why m0', 'data-label': 'Why count reads, not comparisons', html: 'Scanning even 200 keys in memory takes well under a microsecond; one random disk read takes milliseconds. The disk reads are the whole cost: one for each level the search visits.' })),
            h('div', { class: 'stack', style: { gap: '8px' } }, pic, player.el)));
        },
      },
      /* ---------------- 4. Insertion and splits, step by step ---------------- */
      {
        title: 'Insert: fill a leaf, split what is full',
        kind: 'explore',
        core: true,
        render(el, ctx) {
          const { h } = ctx;
          const d = 3;
          let t = fromShape(d, WALK_START);
          const frames = [{ tree: cloneTree(t), node: {}, key: {}, line: null,
            cap: `<b>Start:</b> a B-tree with minimum degree d = 3, so every node except the root holds 2 to 5 keys. Its height is ${height(t)}. Step forward to insert ${WALK_KEYS.join(', ')}.` }];
          WALK_KEYS.forEach((k) => { const before = cloneTree(t); frames.push(...insertFrames(before, k, insert(t, k), d)); });
          frames.push({ tree: cloneTree(t), node: {}, key: {}, line: null,
            cap: `<b>Done.</b> Four inserts: one plain placement, two ordinary splits and one <span class="t">root split</span>. Only the root split made the tree taller (height ${height(frames[0].tree)} → ${height(t)}), and every leaf is still on the same level.` });
          const code = listing(ctx, [
            ['if root is full: split root', 'the only way to grow taller'],
            ['x = root', 'start at the top'],
            ['while x is not a leaf:', 'go down level by level'],
            ['  c = child whose range has k', 'same choice as a search'],
            ['  if c is full: split c', 'its median moves up into x'],
            ['  x = the half that holds k', 'step down one level'],
            ['put k into leaf x, in order', 'the leaf surely has room'],
          ], { fontSize: 14 });
          code.el.style.flex = 'none';
          const pic = h('div', { class: 'card white tight', style: { padding: '2px 8px' } });
          const status = h('div', { class: 'row gap-s small' });
          function draw(i) {
            const f = frames[i];
            pic.replaceChildren(treeView(ctx, f.tree, { node: f.node, key: f.key, path: f.path, vw: 1060, vh: 196, aria: 'B-tree during insertion' }));
            if (f.line) code.mark(f.line); else code.clear();
            const c = check(f.tree);
            status.replaceChildren(h('span', { class: 'chip accent' }, 'height ' + height(f.tree)), h('span', { class: 'chip' }, countKeys(f.tree.root) + ' keys'),
              h('span', { class: 'chip ' + (c.ok ? 'ok' : 'bad') }, c.ok ? '✓ all 5 rules hold' : '✗ a rule is broken'));
            return f.cap;
          }
          const player = ctx.ui.player({ count: frames.length, render: draw, interval: 2300 });
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },
            pic,
            h('div', { class: 'split grow', style: { gap: '18px' } },
              h('div', { class: 'stack', style: { gap: '8px' } }, code.el,
                h('div', { class: 'legend' }, h('span', { html: '<i style="border-color:var(--warn);background:var(--warn-bg)"></i>full node, then its two halves' }), h('span', { html: '<i style="border-color:var(--accent);background:var(--accent-bg)"></i><span class="t" data-t="median key">median</span> (moves up)' }), h('span', { html: '<i style="border-color:var(--ok);background:var(--ok-bg)"></i>new key' })),
                h('div', { class: 'card tight small', html: '<b>Splitting a full node</b> (2d − 1 keys): the first d − 1 keys stay put, the d-th key (the <b>median</b>) moves up into the parent, and the last d − 1 keys move to a new node next to it. With d = 3: [a b <b>c</b> d e] → c goes up, [a b] and [d e] remain.' })),
              h('div', { class: 'stack', style: { gap: '8px' } }, status, player.el,
                h('div', { class: 'callout tip m0 small', 'data-label': 'Our method', html: 'This guide uses <span class="t">proactive splitting</span>: full nodes are split on the way down, so the parent always has room. The other common method inserts first and splits overflowing nodes on the way back up. Both keep every rule; their trees can differ a little.' })))));
        },
      },
      /* ---------------- 5. Predict the split ---------------- */
      {
        title: 'Predict the split: which key moves up?',
        kind: 'predict',
        render(el, ctx) {
          const { h } = ctx;
          const d = 3;
          let r = 0, choice, score = 0, tries = 0, view = 'before', res = null, after = null, frames = [];
          const pic = h('div', { class: 'card white tight', style: { padding: '2px 8px' } });
          const head = h('div', { class: 'row', style: { justifyContent: 'space-between' } });
          const prompt = h('p', { class: 'm0' });
          const say = h('div', { class: 'narr', 'aria-live': 'polite' });
          const bNone = h('button', { class: 'btn', type: 'button', onclick: () => answer(null) }, 'No split needed');
          const bNew = h('button', { class: 'btn', type: 'button', onclick: () => answer('new') });
          const bView = h('button', { class: 'btn sm', type: 'button', onclick: () => { view = view === 'before' ? 'after' : 'before'; paint(); } });
          const bNext = h('button', { class: 'btn primary', type: 'button', onclick: () => load(r + 1) });
          const keysAt = (t, id) => '[' + findNode(t.root, id).keys.join(' ') + ']';
          function load(i) {
            if (i >= ROUNDS.length) { i = 0; score = 0; tries = 0; }
            r = i; choice = undefined; view = 'before';
            const k = ROUNDS[r][1], before = fromShape(d, ROUNDS[r][0]);
            const t = cloneTree(before);
            res = insert(t, k); after = t; frames = insertFrames(before, k, res, d);
            prompt.innerHTML = `<b>Insert ${k}</b> into this tree (d = 3, so a node is full at 5 keys). Before you press anything, trace the way down. Then <b>click the key that moves up</b>, or choose a button.`;
            bNew.textContent = `The new key ${k} moves up`;
            say.className = 'narr';
            say.innerHTML = 'Hint: a search for the new key visits one node per level. Is any node on that path already full?';
            [bNone, bNew].forEach((b) => { b.disabled = false; });
            bView.style.visibility = 'hidden'; bNext.disabled = true;
            bNext.textContent = r === ROUNDS.length - 1 ? 'Start over' : 'Next round →';
            paint();
          }
          function paint() {
            const k = ROUNDS[r][1], before = fromShape(d, ROUNDS[r][0]);
            head.replaceChildren(h('b', {}, `Round ${r + 1} of ${ROUNDS.length}`), h('span', { class: 'chip accent' }, view === 'before' ? 'before inserting ' + k : 'after inserting ' + k), h('span', { class: 'chip' }, `score ${score} / ${tries}`));
            if (view === 'after') {
              const node = {}, key = { [k]: 's-ok' };
              res.ev.forEach((e) => { if (e.type !== 'place') { node[e.left] = 's-warn'; node[e.right] = 's-warn'; key[e.median] = 's-accent'; } });
              pic.replaceChildren(treeView(ctx, after, { node, key, vw: 840, vh: 192, aria: 'Tree after the insert' }));
            } else {
              const key = {};
              if (typeof choice === 'number') key[choice] = choice === answerKey() ? 's-ok' : 's-bad';
              pic.replaceChildren(treeView(ctx, before, { key, vw: 840, vh: 192, onKey: choice === undefined ? (kk) => answer(kk) : null, aria: 'Tree before the insert; click a key to predict' }));
            }
            bView.textContent = view === 'before' ? 'Show the tree after' : 'Show the tree before';
          }
          function answerKey() { const sp = res.ev.find((e) => e.type !== 'place'); return sp ? sp.median : null; }
          function answer(c) {
            if (choice !== undefined) return;
            choice = c; tries++;
            const k = ROUNDS[r][1], before = fromShape(d, ROUNDS[r][0]), want = answerKey(), sp = res.ev.find((e) => e.type !== 'place');
            const right = c === want;
            if (right) score++;
            const path = search(before, k).path, full = path.find((p) => p.keys.length === 2 * d - 1);
            const pathTxt = path.map((p) => '[' + p.keys.join(' ') + ']').join(' → ');
            let why;
            if (right) why = want === null ? `No node on the way down (${pathTxt}) is full, so ${k} simply slides into its leaf.` : `[${sp.before.join(' ')}] is full and lies on the way down, so it splits before the search moves on; its median ${want} moves up.`;
            else if (c === 'new') why = want === null ? `Nothing splits here: no node on the way down (${pathTxt}) is full.` : `The full node splits <b>before</b> ${k} is added, so the key that moves up is its own median, ${want}, not the newcomer.`;
            else if (want === null) why = `No node on the way down (${pathTxt}) is full: each has fewer than 5 keys, so nothing splits and ${k} slides into its leaf.`;
            else if (c === null) why = `[${full.keys.join(' ')}] lies on the way down and is full (5 keys), so it must split first. Its median, ${want}, moves up.`;
            else {
              const owner = path.find((p) => p.keys.includes(c));
              if (owner && owner === full) why = `Right node, wrong key: [${full.keys.join(' ')}] does split, but the key that moves up is its median, the 3rd of its 5 keys: ${want}.`;
              else if (owner) why = `[${owner.keys.join(' ')}] is on the way down but has only ${owner.keys.length} keys, so it has room and stays whole. The full node on the path is [${full.keys.join(' ')}]; its median ${want} moves up.`;
              else why = `${c} is not on the way down: a search for ${k} reads only ${pathTxt}. The full node there is [${full.keys.join(' ')}]; its median ${want} moves up.`;
            }
            const leaf = res.ev[res.ev.length - 1];
            const what = sp ? (sp.type === 'rootsplit' ? ` What happens: the root splits, ${want} becomes a new root and the tree grows one level; then ${k} goes into ${keysAt(after, leaf.node)}.` : ` What happens: ${want} moves up into ${keysAt(after, sp.parent)}, and ${k} lands in ${keysAt(after, leaf.node)}.`) : ` It lands in ${keysAt(after, leaf.node)}.`;
            say.className = 'narr ' + (right ? 'ok' : 'bad');
            say.innerHTML = (right ? '<b>Correct.</b> ' : '<b>Not this time.</b> ') + why + what;
            [bNone, bNew].forEach((b) => { b.disabled = true; });
            bView.style.visibility = 'visible'; bNext.disabled = false;
            paint();
            ctx.after(900, () => { if (choice === c && view === 'before') { view = 'after'; paint(); } });
          }
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },
            pic,
            h('div', { class: 'split grow', style: { gap: '18px' } },
              h('div', { class: 'stack', style: { gap: '10px' } }, head, prompt, h('div', { class: 'row' }, bNone, bNew),
                h('div', { class: 'card tight small', html: '<b>How to decide:</b> (1) follow the new key\'s search path from the root down; (2) look for nodes on it that already hold 2d − 1 = 5 keys; (3) each one splits on the way down, and its middle key moves up.' })),
              h('div', { class: 'stack', style: { gap: '8px' } }, say, h('div', { class: 'row' }, bView, h('span', { class: 'grow' }), bNext)))));
          load(0);
        },
      },
      /* ---------------- 6. Playground ---------------- */
      {
        title: 'B-tree playground: insert, split, search',
        kind: 'lab',
        core: true,
        render(el, ctx) {
          const { h } = ctx;
          const MAX = 30, SPEED = 1100;
          let d = 3, hist = PLAY_START.slice(), t = build(d, hist), gen = 0;
          const pic = h('div', { class: 'card white tight', style: { padding: '2px 8px' } });
          const say = h('div', { class: 'narr', 'aria-live': 'polite' });
          const log = h('div', { class: 'log grow', 'aria-label': 'What happened so far' });
          const rulesEl = h('div', { class: 'stack', style: { gap: '3px' } });
          const stats = h('div', { class: 'small' });
          const inp = h('input', { type: 'number', min: 1, max: 99, class: 'kin', placeholder: '1–99', 'data-keys': '', 'aria-label': 'Key to insert or search for',
            onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); doInsert(); } } });
          const seg = ctx.ui.seg([{ value: 2, label: 'd = 2 (1–3 keys)' }, { value: 3, label: 'd = 3 (2–5 keys)' }], d, (v) => {
            gen++;
            const h0 = height(t);
            d = v; t = build(d, hist);
            draw({ tree: t });
            say.className = 'narr';
            say.innerHTML = hist.length ? `Rebuilt the same ${hist.length} keys, inserted in the same order, with <b>d = ${d}</b>. Height ${h0} → ${height(t)}: ${d === 2 ? 'smaller nodes mean more levels' : 'bigger nodes mean fewer levels'}.` : `Minimum degree is now <b>d = ${d}</b>. The tree is still empty.`;
            addLog(hist.length ? `d = ${d}: rebuilt ${hist.length} keys, height ${height(t)}` : `d = ${d} (empty tree)`);
            paintSide();
          });
          const NAMES = { max: `At most 2d − 1 keys per node`, min: 'At least d − 1 keys (root: 1)', kids: 'k keys ⇒ k + 1 children', order: 'Keys in order, ranges respected', level: 'All leaves on one level' };
          function draw(f) {
            pic.replaceChildren(treeView(ctx, f.tree, { node: f.node, key: f.key, path: f.path, tag: f.tag, vw: 1080, vh: 254, empty: 'The tree is empty. Insert a key to create the root.', aria: 'Playground B-tree' }));
          }
          function paintSide() {
            const c = check(t), n = countKeys(t.root), ht = height(t);
            rulesEl.replaceChildren(...c.rules.map((r) => h('div', { class: 'row nw small', style: { gap: '8px' } },
              h('span', { class: 'chip ' + (r.ok ? 'ok' : 'bad') }, r.ok ? '✓' : '✗'), h('span', {}, NAMES[r.id].replace('2d − 1', `2d − 1 = ${2 * d - 1}`).replace('d − 1 keys', `d − 1 = ${d - 1}`)))));
            stats.innerHTML = n ? `<b>${n}</b> keys · <b>${countNodes(t.root)}</b> nodes · height <b>${ht}</b>, so a search reads at most <b>${ht + 1}</b> nodes. Bound: log<sub>${d}</sub>((${n} + 1) / 2) = ${ctx.util.fmt(heightBounds(n, d).raw, 2)}, so h ≤ ${heightBounds(n, d).most}.` : 'No keys yet.';
          }
          function addLog(html) { log.prepend(h('div', { html })); while (log.children.length > 40) log.lastChild.remove(); }
          function readKey() {
            const v = Number(inp.value);
            if (inp.value === '' || !Number.isInteger(v) || v < 1 || v > 99) { say.className = 'narr warn'; say.innerHTML = 'Type a whole number from 1 to 99 first (or press <b>Random</b>).'; return null; }
            return v;
          }
          function play(frames, g, done) {
            let i = 0;
            const tick = () => {
              if (g !== gen || !ctx.alive) return;
              const f = frames[i];
              draw(f); say.className = 'narr'; say.innerHTML = f.cap;
              i++;
              if (i < frames.length) ctx.after(SPEED, tick); else if (done) done();
            };
            tick();
          }
          function doInsert(k) {
            if (k == null) k = readKey();
            if (k == null) return;
            gen++;
            const g = gen;
            if (countKeys(t.root) >= MAX && !search(t, k).found) { say.className = 'narr warn'; say.innerHTML = `The playground holds up to ${MAX} keys so the whole tree stays visible. Press <b>Undo</b> or <b>Clear</b>.`; draw({ tree: t }); return; }
            const before = cloneTree(t), res = insert(t, k);
            if (!res.dup) hist.push(k);
            const sp = res.ev.filter((e) => e.type !== 'place');
            addLog(res.dup ? `${k}: already there` : `insert ${k}: ` + (sp.length ? sp.map((e) => (e.type === 'rootsplit' ? 'root split' : 'split') + ', ' + e.median + ' up').join('; ') : 'placed') + (sp.some((e) => e.type === 'rootsplit') ? ' (taller)' : ''));
            paintSide();
            play(insertFrames(before, k, res, d), g, null);
          }
          function doSearch() {
            const k = readKey();
            if (k == null) return;
            gen++;
            const g = gen, res = search(t, k);
            if (!res.path.length) { say.className = 'narr'; say.innerHTML = 'The tree is empty, so there is nothing to read.'; return; }
            const frames = res.path.map((p, j) => {
              const node = {}, tag = {};
              res.path.slice(0, j + 1).forEach((q, m) => { node[q.id] = 's-io'; tag[q.id] = 'read ' + (m + 1); });
              const last = j === res.path.length - 1;
              return { tree: t, node, tag, path: res.path.slice(0, j + 1).map((q) => q.id), key: last && res.found ? { [k]: 's-ok' } : {},
                cap: `<b>Search ${k}: disk read ${j + 1}</b>, node [${p.keys.join(' ')}]. ` + (!last ? `${k} is not here; its range leads to child ${p.i}.` : res.found ? `Found after ${j + 1} read${j ? 's' : ''}.` : `Not here, and this is a leaf: ${k} is not in the tree (${j + 1} read${j ? 's' : ''}).`) };
            });
            addLog(`search ${k}: ${res.found ? 'found' : 'not found'}, ${res.path.length} read${res.path.length > 1 ? 's' : ''}`);
            play(frames, g, null);
          }
          function doRandom() {
            const have = new Set(inorder(t.root));
            const free = []; for (let v = 1; v <= 99; v++) if (!have.has(v)) free.push(v);
            const k = free[Math.floor(Math.random() * free.length)];
            inp.value = String(k);
            doInsert(k);
          }
          function doUndo() {
            gen++;
            if (!hist.length) { say.className = 'narr'; say.innerHTML = 'Nothing to undo.'; return; }
            const k = hist.pop();
            t = build(d, hist);
            draw({ tree: t }); paintSide();
            say.className = 'narr'; say.innerHTML = `Took back ${k}: the tree is rebuilt from the remaining ${hist.length} inserts, exactly as it was before ${k} arrived.`;
            addLog(`undo ${k}`);
          }
          function doClear() {
            gen++;
            hist = []; t = newTree(d);
            draw({ tree: t }); paintSide();
            say.className = 'narr'; say.innerHTML = 'Cleared. Try inserting 1, 2, 3, ... in order and watch how often the root splits.';
            addLog('cleared');
          }
          const btn = (label, fn, cls) => h('button', { class: 'btn sm ' + (cls || ''), type: 'button', onclick: fn }, label);
          draw({ tree: t }); paintSide();
          say.innerHTML = 'Type a key and press <b>Insert</b> (or Enter), or press <b>Random</b>. Splits play out step by step. Try filling the leftmost leaf first.';
          addLog(`start: ${hist.length} keys, d = ${d}`);
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },
            pic,
            h('div', { class: 'grid-3 grow pg', style: { minHeight: 0 } },
              h('div', { class: 'stack', style: { gap: '8px' } }, seg,
                h('div', { class: 'row nw', style: { gap: '6px' } }, inp, btn('Insert', () => doInsert(), 'primary'), btn('Search', doSearch, 'io')),
                h('div', { class: 'row', style: { gap: '6px' } }, btn('Random', doRandom), btn('Undo', doUndo), btn('Clear', doClear)),
                stats,
                h('p', { class: 'small muted m0', html: 'Try: insert 21, then 22, to fill the left leaf and split it; switch d with the same keys; Clear, then insert 1, 2, 3, … in order.' })),
              h('div', { class: 'stack', style: { gap: '8px', minHeight: 0 } }, say, log),
              h('div', { class: 'card tight stack', style: { gap: '6px' } }, h('h4', { class: 'm0' }, 'Rule checker, after every change'), rulesEl))));
        },
      },
      /* ---------------- 7. Height bound calculator ---------------- */
      {
        title: 'How tall can it get? The height bound',
        kind: 'explore',
        render(el, ctx) {
          const { h, s } = ctx;
          const DS = [2, 3, 4, 5, 10, 20, 50, 85, 100, 128, 200, 500];
          const NS = [100, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8, 1e9];
          const MS = 10;                                   // rough milliseconds per random hard-disk read
          const big = (v) => Math.round(v).toLocaleString('en-US');
          let di = DS.indexOf(100), ni = NS.indexOf(1e6);
          const sd = ctx.ui.slider({ label: 'Minimum degree d', min: 0, max: DS.length - 1, value: di, format: (v) => String(DS[v]), onInput: (v) => { di = v; paint(); } });
          const sn = ctx.ui.slider({ label: 'Keys n', min: 0, max: NS.length - 1, value: ni, format: (v) => big(NS[v]), onInput: (v) => { ni = v; paint(); } });
          sd.input.setAttribute('data-keys', ''); sn.input.setAttribute('data-keys', '');
          const res = h('div', { class: 'card white tight stack', style: { gap: '4px' } });
          const bars = h('div', {});
          const table = h('div', {});
          const preset = h('button', { class: 'btn sm', type: 'button', onclick: () => { di = DS.indexOf(100); ni = NS.indexOf(1e6); sd.set(di); sn.set(ni); paint(); } }, 'Worked example: d = 100, n = 1,000,000');
          function paint() {
            const d = DS[di], n = NS[ni], b = heightBounds(n, d);
            res.innerHTML = `<div class="row nw" style="gap:14px"><div class="big" style="color:var(--ok);white-space:nowrap">h ≤ ${b.most}</div><div class="small">so a lookup reads at most <b>${b.most + 1}</b> node${b.most ? 's' : ''}: about ${b.most + 1} × ${MS} ms = ${(b.most + 1) * MS} ms on a hard disk</div></div>` +
              `<div class="small">log<sub>${d}</sub>((${big(n)} + 1) / 2) = log<sub>${d}</sub>(${big(Math.floor((n + 1) / 2))}${(n + 1) % 2 ? '.5' : ''}) = <b>${ctx.util.fmt(b.raw, 2)}</b>. A height is a whole number, so h ≤ ${b.most}.</div>` +
              `<div class="small muted">Even with every node full (${2 * d - 1} keys), the tree needs height ${b.least}${b.least === b.most ? ', so this tree has exactly that height' : ''}.</div>`;
            const W = ctx.narrow ? 360 : 630, RH = 52, rows = [['B-tree, worst case', b.most + 1, 's-ok'], ['B-tree, every node full', b.least + 1, 's-ok'], ['Balanced binary search tree', b.binary, 's-warn']];
            const mx = Math.max(...rows.map((r) => r[1])), bw = Math.min(34, (W - 4) / mx);
            const svg = s('svg', { viewBox: `0 0 ${W} ${rows.length * RH - 7}`, width: '100%', role: 'img', 'aria-label': 'Disk reads per lookup', style: { display: 'block' } });
            rows.forEach(([lab, cnt, cls], r) => {
              const y = r * RH;
              svg.append(s('text', { x: 2, y: y + 16, 'font-size': 14.5, 'font-weight': 700 }, `${lab}: ${cnt} read${cnt === 1 ? '' : 's'} ≈ ${cnt * MS} ms`));
              for (let i = 0; i < cnt; i++) svg.append(s('rect', { x: 2 + i * bw, y: y + 23, width: Math.max(2, bw - 3), height: 21, rx: Math.min(5, bw / 4), class: cls, 'stroke-width': 1.5 }));
            });
            bars.replaceChildren(svg);
            const hs = [];
            for (let hh = 0; hh <= b.most + 1; hh++) hs.push(hh);
            const show = hs.length > 7 ? [0, 1, null, ...hs.slice(-4)] : hs;
            table.replaceChildren(h('table', { class: 'tbl compact' + (ctx.narrow ? '' : ' ht') },   // ht: one line per row, two-line headers, so the card is never taller than 7 rows (phones keep wrapping)
              h('thead', {}, h('tr', {}, h('th', { html: 'height<br>h' }), h('th', { html: 'bottom-level<br>nodes, at least' }), h('th', { html: 'keys in the tree,<br>at least' }), h('th', { html: `fits n =<br>${big(n)}?` }))),
              h('tbody', {}, ...show.map((hh) => {
                if (hh === null) return h('tr', { class: 'gap' }, h('td', { colspan: 4, class: 'muted' }, '…'));
                const nodes = hh === 0 ? 1 : 2 * Math.pow(d, hh - 1), keys = 2 * Math.pow(d, hh) - 1, ok = keys <= n;
                return h('tr', { class: hh === b.most ? 'on' : '' }, h('td', { class: 'num' }, String(hh)), h('td', { class: 'num' }, big(nodes)), h('td', { class: 'num', html: hh === 0 ? '1' : `2 × ${d}<sup>${hh}</sup> − 1 = ${big(keys)}` }), h('td', { html: ok ? '<span class="chip ok">yes</span>' : '<span class="chip bad">no: too few keys</span>' }));
              }))));
          }
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack', style: { gap: '10px' } },
              h('p', { class: 'm0', html: 'The <span class="t">height</span> h counts the steps from the root down to a leaf, so a tree has h + 1 levels and a lookup reads at most h + 1 nodes. The tallest legal tree is the thinnest one: a root with 1 key and every other node holding only d − 1 keys.' }),
              sd, sn, res, preset,
              h('div', { class: 'callout tip m0 small', 'data-label': 'In practice', html: 'The root, and often the level below it, is used by every lookup, so it stays cached in memory. A million-key lookup then costs only one or two real disk reads.' })),
            h('div', { class: 'stack', style: { gap: '10px' } },
              h('div', { class: 'card white tight' }, h('h4', { class: 'm0', style: { marginBottom: '6px' } }, 'Disk reads for one lookup'), bars),
              h('div', { class: 'card tight stack', style: { gap: '6px' } }, h('h4', { class: 'm0' }, 'Why the bound holds: the thinnest legal tree of each height'), table))));
          paint();
        },
      },
      /* ---------------- 8. B+ trees ---------------- */
      {
        title: 'The B+ tree: keys in the leaves, leaves in a chain',
        kind: 'compare',
        render(el, ctx) {
          const { h } = ctx;
          const bt = build(2, BP_ORDER), bp = buildPlus(BP_KEYS, 3, 3), bpt = { root: bp.root };
          const Q = [{ lo: 17, hi: 75, label: 'list 17 … 75' }, { lo: 40, hi: 60, label: 'list 40 … 60' }, { lo: 52, hi: 52, label: 'find 52' }];
          let q = Q[0], A = [], B = [], frames = [];
          const picA = h('div', { class: 'card white tight', style: { padding: '2px 6px' } });
          const picB = h('div', { class: 'card white tight', style: { padding: '2px 6px' } });
          const headA = h('div', { class: 'row gap-s' }), headB = h('div', { class: 'row gap-s' });
          const where = (t, id) => findNode(t.root, id);
          /* state(ev, upto): what one tree has done after its first `upto` emitted keys
             (upto = Infinity means every event, including any trailing reads) */
          function state(ev, upto) {
            const tag = {}, node = {}, key = {}, depths = [];
            let reads = 0, emitted = 0, cur = null;
            for (const e of ev) {
              if (emitted >= upto) break;
              if (e.t === 'emit') { emitted++; key[e.key] = 's-accent'; depths.push(e.depth); cur = e; }
              else { reads++; tag[e.id] = 'read ' + reads; node[e.id] = 's-io'; }
            }
            if (cur && upto !== Infinity) key[cur.key] = 's-ok';
            let hops = 0;
            for (let i = 1; i < depths.length; i++) if (depths[i] !== depths[i - 1]) hops++;
            return { tag, node, key, reads, hops, cur };
          }
          function plan() {
            A = rangeB(bt, q.lo, q.hi); B = rangePlus(bp, q.lo, q.hi);
            const n = A.filter((e) => e.t === 'emit').length;
            frames = [];
            for (let j = 1; j <= n; j++) frames.push(j);
            frames.push(Infinity);
          }
          function draw(i) {
            const upto = frames[i], a = state(A, upto), b = state(B, upto);
            picA.replaceChildren(treeView(ctx, bt, { node: a.node, key: a.key, tag: a.tag, vw: 500, vh: 182, aria: 'B-tree' }));
            picB.replaceChildren(treeView(ctx, bpt, { node: b.node, key: b.key, tag: b.tag, vw: 500, vh: 182, links: true, gap: 22, aria: 'B+ tree' }));
            headA.replaceChildren(h('b', {}, 'B-tree (d = 2)'), h('span', { class: 'chip io' }, `${a.reads} reads`), h('span', { class: 'chip warn' }, `${a.hops} level hops`));
            headB.replaceChildren(h('b', { html: '<span class="t">B+ tree</span>' }), h('span', { class: 'chip io' }, `${b.reads} reads`), h('span', { class: 'chip warn' }, `${b.hops} level hops`));
            if (upto === Infinity) {
              const n = A.filter((e) => e.t === 'emit').length;
              if (q.lo === q.hi) return `<b>Done.</b> The B-tree met ${q.lo} in an internal node and stopped after ${a.reads} reads; the B+ tree always goes on to a leaf: ${b.reads} reads. In return, every B+ lookup costs the same, and its record-free inner nodes pack in more keys.`;
              return `<b>Done: ${n} keys in order.</b> The B-tree read ${a.reads} nodes and hopped between levels ${a.hops} times, keeping a whole root-to-leaf path in memory as it went. The B+ tree read ${b.reads}: one trip down, then sideways along the leaf links, ${b.hops} hops.`;
            }
            const ka = where(bt, a.cur.id), kb = where(bpt, b.cur.id);
            return `Next key out: <b>${a.cur.key}</b>. The B-tree takes it from [${ka.keys.join(' ')}] on level ${a.cur.depth}; the B+ tree from the leaf [${kb.keys.join(' ')}] on level ${b.cur.depth}.`;
          }
          plan();
          const player = ctx.ui.player({ count: frames.length, render: draw, interval: 1500 });
          const seg = ctx.ui.seg(Q.map((x, i) => ({ value: i, label: x.label })), 0, (v) => { q = Q[v]; plan(); player.setCount(frames.length); });
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },
            h('div', { class: 'grid-2', style: { gap: '12px' } },
              h('div', { class: 'stack', style: { gap: '4px' } }, headA, picA),
              h('div', { class: 'stack', style: { gap: '4px' } }, headB, picB)),
            h('div', { class: 'split grow', style: { gap: '18px' } },
              h('div', { class: 'stack small', style: { gap: '6px' } },
                h('p', { class: 'm0', html: 'Many file systems and most databases use a variant, the <b>B+ tree</b>. Every key, with its record, lives in a <span class="t" data-t="leaf">leaf</span>; inner nodes keep only copies of keys as signposts; and the leaves are chained in key order. Record-free inner nodes hold more keys, so the tree is even shorter, and a <span class="t">range query</span> becomes one trip down plus a walk along the chain.' }),
                h('p', { class: 'm0 muted', html: 'NTFS indexes directory entries with B+ trees, XFS tracks free space and file extents with them, and most relational databases build their indexes on them.' }),
                h('div', { class: 'callout warn m0', 'data-label': 'Deletion, in one breath', html: 'Removing a key runs the same ideas backwards: a node that would drop below d − 1 keys borrows one from a sibling (through the parent) or merges with it, and if the root loses its last key the tree gets one level shorter.' })),
              h('div', { class: 'stack', style: { gap: '8px' } }, seg, player.el))));
        },
      },
      /* ---------------- 9. Recap ---------------- */
      {
        title: 'Recap: six things to remember',
        kind: 'recap',
        render(el, ctx) {
          const { h } = ctx;
          el.append(h('div', { class: 'stack fill', style: { gap: '12px' } },
            h('p', { class: 'lead m0' }, 'Say each answer out loud before you flip the card.'),
            ctx.ui.flipcards([
              ['Why is a B-tree node one disk block?', 'A disk read costs milliseconds; scanning a block in memory costs almost nothing. A block packed with keys gives a huge fan-out, so the tree stays a few levels tall and a lookup needs only a few reads.'],
              ['The rules for minimum degree d?', 'At most 2d − 1 keys (2d children) per node. At least d − 1 keys (d children) in every node but the root, which needs 1. k keys ⇒ k + 1 children. Keys in order. All leaves on one level.'],
              ['How does a search work?', 'Read the root, scan its keys in memory, and follow the one child whose key range holds the key. Repeat until it is found or a leaf rules it out: at most h + 1 reads.'],
              ['What happens to a full node on an insert\'s path?', 'It splits first: its median (the d-th key) moves up into the parent, and the d − 1 keys on each side become two nodes. Then the new key goes into a leaf, in order.'],
              ['How does a B-tree get taller, and how tall can it get?', 'Only by a root split, which makes a new root and keeps every leaf level. Height h ≤ log<sub>d</sub>((n + 1) / 2): with d = 100 and a million keys, h ≤ 2, so at most 3 reads.'],
              ['What does a B+ tree change?', 'All keys and records sit in leaves; inner nodes only steer (so they hold more keys); leaves are linked in key order, so a range query goes down once, then walks sideways.'],
            ], { cols: ctx.narrow ? 1 : 3, height: 200 })));
        },
      },
      /* ---------------- 10. Quiz ---------------- */
      {
        title: 'Check yourself',
        kind: 'check',
        quiz: [
          { q: 'Why is each node of a B-tree that indexes a file usually made exactly one disk block in size?',
            choices: ['Smaller nodes would make each key comparison slower in memory', 'One read then fetches a whole node, and many keys per node keep the tree short', 'A disk can only store tree nodes when they are exactly one block long', 'Block-sized nodes let the tree skip the balance rule on most levels'],
            answer: 1,
            feedback: ['Comparisons in memory are cheap whatever the node size; the cost that matters is the disk read.', null, 'A disk stores any bytes; the block is simply the unit it reads and writes, which is why matching it pays off.', 'Every B-tree keeps all leaves on one level no matter how big its nodes are.'],
            why: 'The disk moves whole blocks, so a block-sized node costs one read. Filling it with many keys gives a large fan-out, which keeps the tree only a few levels tall.' },
          { type: 'num', q: 'A B-tree has minimum degree d = 4. What is the largest number of keys any one node may hold?', answer: 7, tol: 0, unit: 'keys',
            why: 'The limit is 2d − 1 = 2 × 4 − 1 = 7 keys, which gives at most 2d = 8 children.' },
          { type: 'tf', q: 'In a B-tree of minimum degree d = 3, the root is allowed to hold just one key.', answer: true,
            why: 'Every node except the root needs at least d − 1 = 2 keys. The root only needs 1 key (and 2 children if it is not a leaf), because a root split leaves exactly one key in the new root.' },
          { q: 'Which event is the only way a B-tree becomes one level taller?',
            choices: ['A leaf receives its (2d − 1)-th key and becomes full', 'A full leaf splits and its median moves up into its parent', 'The full root splits and its median becomes a new root', 'A key larger than every key already stored is inserted'],
            answer: 2,
            feedback: ['A full leaf is still legal; nothing grows until a full node has to split.', 'That adds a key to the parent and a node beside the leaf, but no new level.', null, 'A large key just goes into the rightmost leaf; it may cause splits, but only a root split adds a level.'],
            why: 'Only a root split creates a new node above the old root. Every leaf moves down one level at the same moment, which is why the leaves always stay on one level.' },
          { type: 'num', q: 'A B-tree of minimum degree d = 3 inserts with top-down (proactive) splitting. A full leaf on the insert\'s path holds 12, 18, 25, 31, 40. Which key moves up into the parent when that leaf splits?', answer: 25, tol: 0,
            why: 'A full node holds 2d − 1 = 5 keys. Its median is the d-th key, the 3rd: 25. The keys 12, 18 stay in one node and 31, 40 form the other, d − 1 = 2 keys each.' },
          { type: 'order', q: 'Put the steps of inserting a key k with top-down (proactive) splitting in order.',
            items: ['If the root is full, split it and put its median in a new root', 'At the current node, pick the child whose key range holds k', 'If that child is full, split it and move its median up into the current node', 'Step down into the child (or half) that holds k, and repeat until a leaf', 'Place k into the leaf, keeping its keys in order'],
            why: 'The root is checked first, then the insertion walks down one level at a time, splitting any full child before entering it. That guarantees the leaf has room at the end.' },
          { type: 'num', q: 'A B-tree has minimum degree d = 100 and holds 1,000,000 keys. Using h ≤ log<sub>d</sub>((n + 1) / 2), where the height h counts the steps from the root down to a leaf, what is the largest number of nodes a single search can read?', answer: 3, tol: 0, unit: 'nodes',
            why: 'log<sub>100</sub>(500,000.5) ≈ 2.85, and a height is a whole number, so h ≤ 2. A search reads one node per level: h + 1 = 3 nodes. A balanced binary search tree with the same keys needs 20 levels.' },
          { type: 'bucket', q: 'Each line describes a tree that should be a B-tree of minimum degree d = 2 (1 to 3 keys per node). Is it valid, or does it break a rule?',
            buckets: ['Valid B-tree', 'Breaks a rule'],
            items: [['Root [40] with leaves [10 20] and [50 60 70]', 0], ['Root [40] with leaves [10 20 30 35] and [50]', 1], ['Root [30 60] with leaves [10], [40 50] and [70]', 0], ['Root [30 60] with just two leaves, [10 20] and [40 50]', 1], ['Root [40] with leaves [10 45] and [50 60]', 1], ['Root [40] with leaf [10 20] on the left and, on the right, node [60] over leaves [50] and [70]', 1]],
            why: 'The broken ones: a leaf with 4 keys exceeds 2d − 1 = 3; a root with 2 keys needs 3 children; 45 sits left of the separator 40; and the last tree has leaves on two different levels.' },
          { type: 'match', q: 'Match each term to what it does.',
            pairs: [['Minimum degree d', 'Sets each node\'s size limits: d − 1 to 2d − 1 keys'], ['Separator key', 'Divides the key ranges of the subtrees on its two sides'], ['Median key', 'Moves up into the parent when a full node splits'], ['Root split', 'The only operation that adds a level to the tree'], ['B+ tree leaf chain', 'Lets a range query walk sideways in key order']],
            why: 'd fixes the node sizes; separators steer each search; the median is what a split pushes up; only a root split adds a level; and linked leaves turn a range query into a sideways walk.' },
          { type: 'multi', q: 'Which statements are true of a B+ tree?',
            choices: ['Every key, together with its record, is stored in a leaf', 'The leaves are linked to each other in key order', 'Inner nodes hold copies of keys that only steer searches', 'A search may stop early at an inner node holding the key', 'Leaves may sit on different levels to save space'],
            answer: [0, 1, 2],
            why: 'A B+ tree keeps all data in leaves, chains the leaves, and uses inner nodes only as signposts, so every search ends at a leaf. Stopping early is a plain B-tree trait, and all leaves stay on one level.' },
          { q: 'A B-tree has height 3: every leaf is three steps below the root. A search for a key that is not stored in it reads how many nodes?',
            choices: ['1: the root\'s keys already show the key is absent', '3: one read for each step down from the root', 'It depends on how full each node happens to be', '4: one node on each level, down to a leaf'],
            answer: 3,
            feedback: ['The root only tells which subtree could hold the key; the search must go down to check.', 'The three steps reach three new nodes, but the root must be read first.', 'The number of keys in a node changes the in-memory scan, not the number of levels visited.', null],
            why: 'An unsuccessful search can only give up at a leaf, so it reads one node on every level: height + 1 = 4 nodes.' },
          { q: 'While searching a B-tree, why does it hardly matter how many keys are compared inside one node?',
            choices: ['A comparison in memory is far cheaper than one disk read', 'The disk controller compares all of a node\'s keys in one step', 'Each node holds so few keys that comparisons hardly ever happen', 'The comparisons for each node are remembered from earlier searches'],
            answer: 0,
            feedback: [null, 'The comparisons run on the CPU after the block is in memory, not in the disk hardware.', 'B-tree nodes usually hold hundreds of keys, so there are plenty of comparisons; they are just cheap.', 'Nothing about the comparisons is cached; they are simply fast compared with reading a block.'],
            why: 'Scanning even a few hundred keys in memory takes well under a microsecond, while one random disk read takes milliseconds. The number of reads, one per level, sets the cost.' },
        ],
      },
    ],
    notes: `
      <h3>Why file systems and databases use B-trees</h3>
      <p>An <b>index</b> pairs each <b>key</b> (a file name, an account number) with the place where its record is stored. Large indexes do not fit in memory, so they live on disk, and every step of a search costs one disk-block read. A random read from a hard disk takes several milliseconds, roughly 100,000 times longer than a memory read, so the goal is to make searches need <b>few reads</b>, not few comparisons.</p>
      <p>A <b>B-tree</b> is a balanced search tree whose <b>node is one disk block</b>, packed with many sorted keys. One read then chooses among hundreds of children instead of two, so the tree stays short. Example: with 4,096-byte blocks and 8-byte keys and pointers, a node holds 170 keys (each with a record pointer) and 171 child pointers: 170 × 16 + 171 × 8 = 4,088 bytes.</p>
      <h4>Inside a node</h4>
      <ul>
        <li>Keys are kept in increasing order; each key carries a pointer to its record (or the record itself).</li>
        <li>A node with k keys that is not a leaf has k + 1 child pointers, one for each gap below, between and above its keys. The keys act as <b>separator keys</b>: child i holds only keys that lie between key i − 1 and key i.</li>
        <li>Searching inside a node happens in memory and is cheap; only following a child pointer costs a disk read.</li>
      </ul>
      <h3>The rules (minimum degree d ≥ 2)</h3>
      <ol>
        <li><b>Most keys:</b> every node holds at most 2d − 1 keys, so at most 2d children.</li>
        <li><b>Fewest keys:</b> every node except the root holds at least d − 1 keys (an internal one has at least d children). The root needs at least 1 key, and 2 children unless it is the only node.</li>
        <li><b>Pointers:</b> an internal node with k keys has exactly k + 1 children; leaves have none.</li>
        <li><b>Order:</b> keys increase within a node, and every key in a subtree lies between the two separators around it.</li>
        <li><b>Balance:</b> all leaves are on the same level.</li>
      </ol>
      <table>
        <tr><th>d</th><th>keys per non-root node</th><th>children per internal non-root node</th></tr>
        <tr><td>2</td><td>1 to 3</td><td>2 to 4 (the "2-3-4 tree")</td></tr>
        <tr><td>3</td><td>2 to 5</td><td>3 to 6</td></tr>
        <tr><td>100</td><td>99 to 199</td><td>100 to 200</td></tr>
      </table>
      <p>Half-full nodes guarantee a large <b>fan-out</b>; level leaves make the tree perfectly balanced. To check a tree, test each rule: a root with a single key is legal, but any other node below d − 1 keys, any node above 2d − 1 keys, a node whose child count is not keys + 1, a key on the wrong side of a separator, or leaves on two levels all break the definition.</p>
      <h3>Search</h3>
      <ol>
        <li>Read the root block.</li>
        <li>Scan its keys in memory for the first key ≥ k. If it equals k, stop: found.</li>
        <li>If the node is a leaf, stop: k is not in the index.</li>
        <li>Otherwise read the one child whose range can hold k, and repeat from step 2.</li>
      </ol>
      <p>The <b>height</b> h is the number of steps from the root down to a leaf (a lone root has height 0, and a tree of height h has h + 1 levels). A search reads one node per level, so at most <b>h + 1</b> reads. A search for a missing key always ends at a leaf, so it reads exactly h + 1 nodes. Example: in the tree [55] / [27 39] [73 84] / [4 22] [29 34 36] [42 43 54] [56 66] [74 82] [85 88 93] (d = 3, height 2), 55 is found in 1 read, 39 in 2, 82 in 3, and 60 is reported missing after 3.</p>
      <h3>Insertion with node splits</h3>
      <p>This guide uses <b>proactive (top-down) splitting</b>:</p>
      <ol>
        <li>If the root is full (2d − 1 keys), split it first: its median goes into a brand-new root. This <b>root split</b> is the only way the tree gets taller, and it lowers every leaf by one level at once, so balance is kept.</li>
        <li>Walk down as in a search. Before stepping into a child, check it: if it is full, split it; its median moves up into the current node, which is guaranteed to have room because it was split earlier if it was full.</li>
        <li>At the leaf (which now surely has room), insert the key in sorted order.</li>
      </ol>
      <p><b>Splitting a full node</b> of 2d − 1 keys: the first d − 1 keys stay, the d-th key (the <b>median</b>) moves up into the parent, and the last d − 1 keys move to a new sibling node. With d = 3, [a b c d e] becomes [a b] and [d e], and c goes up. Because the split happens before the new key is added, the key that moves up is the full node's own median, never the newcomer. The other common method inserts first and splits overflowing nodes on the way back up; both keep every rule, though their trees can differ slightly.</p>
      <h4>Worked example (d = 3)</h4>
      <pre>start      [20 40 60 80]
           [3 7 12] [24 28 33 36] [44 51] [63 66 70 74 77] [85 91 96]
insert 48  leaf [44 51] has room          → [44 48 51]
insert 72  leaf [63 66 70 74 77] is full  → 70 moves up: root [20 40 60 70 80];
           leaves [63 66] and [72 74 77] (72 placed)
insert 30  root is full                   → root split: 60 alone in a new root,
           children [20 40] and [70 80]; height 1 → 2; 30 → [24 28 30 33 36]
insert 26  leaf [24 28 30 33 36] is full  → 30 moves up into [20 30 40];
           leaves [24 26 28] and [33 36]
final      [60] / [20 30 40] [70 80] /
           [3 7 12] [24 26 28] [33 36] [44 48 51] [63 66] [72 74 77] [85 91 96]</pre>
      <p><b>Predicting a split:</b> follow the search path of the new key; every node on it that already holds 2d − 1 keys splits as the walk reaches it (top one first), and its middle key moves up. If no node on the path is full, nothing splits. A full root splits even when the target leaf has room.</p>
      <h3>How tall can a B-tree get?</h3>
      <p>The tallest tree for n keys is the thinnest legal one: a root with 1 key, and every other node holding only d − 1 keys. Such a tree of height h ≥ 1 has at least 2 d<sup>h − 1</sup> nodes on its bottom level and at least 2d<sup>h</sup> − 1 keys in total. Since that cannot exceed n:</p>
      <p style="text-align:center"><b>h ≤ log<sub>d</sub>((n + 1) / 2)</b></p>
      <p><b>Worked example:</b> d = 100, n = 1,000,000. log<sub>100</sub>(500,000.5) ≈ 2.85, and a height is a whole number, so h ≤ 2 and a lookup reads at most 3 nodes (a height-3 tree would need at least 2 × 100<sup>3</sup> − 1 = 1,999,999 keys). Even with every node full (199 keys) the tree needs height 2, so it has exactly that height. A perfectly balanced binary search tree with a million keys has ⌈log<sub>2</sub>(1,000,001)⌉ = 20 levels: 20 reads, about 200 ms at roughly 10 ms per random hard-disk read, against about 30 ms for the B-tree. In practice the root, and often the next level, stays cached in memory, so a lookup costs only one or two real disk reads.</p>
      <h3>B+ trees</h3>
      <p>The variant that many file systems and most database indexes actually use. It changes three things:</p>
      <ul>
        <li>every key, with its record, lives in a <b>leaf</b>; internal nodes hold only copies of keys that steer searches;</li>
        <li>the leaves are <b>linked</b> left to right in key order;</li>
        <li>every search goes all the way to a leaf, so every lookup costs the same.</li>
        <li>as in any B-tree, all leaves stay on one level.</li>
      </ul>
      <p>Record-free internal nodes hold more keys, so the fan-out is larger and the tree shorter. A <b>range query</b> (all keys from 17 to 75, say) goes down once and then walks along the leaf chain, never hopping back up; a plain B-tree must walk in order through several levels, keeping a root-to-leaf path in memory. A plain B-tree can stop early when the key sits in an internal node (finding 52 took 2 reads in the guide's example, against 3 in the B+ tree). NTFS indexes directory entries with B+ trees, XFS uses them for free space and file extents, and most relational databases build their indexes on them.</p>
      <h3>Deletion (in brief)</h3>
      <p>Deletion runs the same ideas backwards: when a node would drop below d − 1 keys, it borrows a key from a sibling (through the parent) or merges with a sibling; if the root loses its last key, the tree becomes one level shorter.</p>`,
  });
})();
