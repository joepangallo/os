/* =====================================================================
   Section 3.5 — Execution of the Operating System
   The OS is software the processor runs like any other program, so
   where does it run? Three answers: a nonprocess kernel outside every
   process, OS routines executed inside each user process, and an OS
   built from system processes. Each is simulated, then weighed on
   switch overhead, modularity and protection.
   Helpers live in the IIFE so nothing leaks into the global scope.
   ===================================================================== */
(() => {
  /* ------------------------------------------------------------------
     Shared helpers
     ------------------------------------------------------------------ */
  /* Write a titled message into a feedback box (kinds: ok, bad, info, warn). */
  const say = (box, kind, title, html) => {
    box.className = 'msg ' + (kind || '');
    box.innerHTML = (title ? `<b>${title}</b>` : '') + (html || '');
  };

  /* The three designs, used by several steps. */
  const DESIGNS = [
    { key: 'np', n: 1, name: 'Nonprocess kernel', short: 'Separate kernel' },
    { key: 'wp', n: 2, name: 'Execution within user processes', short: 'Inside user processes' },
    { key: 'pb', n: 3, name: 'Process-based OS', short: 'OS as processes' },
  ];

  /* Tiny sketch of each design, used on the Big Picture step (viewBox 180 x 92). */
  const sketch = (ctx, n) => {
    const { s } = ctx;
    const svg = s('svg', { viewBox: '0 0 180 92', width: '100%', role: 'img', 'aria-label': 'Sketch of design ' + n });
    const box = (x, y, w, hh, cls, label, fs) => [
      s('rect', { x, y, width: w, height: hh, rx: 6, class: cls, 'stroke-width': 1.6 }),
      s('text', { x: x + w / 2, y: y + hh / 2 + 5, 'text-anchor': 'middle', 'font-size': fs || 15, 'font-weight': 700 }, label),
    ];
    if (n === 1) {
      [0, 1, 2].forEach((i) => svg.append(...box(6 + i * 59, 4, 50, 36, 's-proc', 'P' + (i + 1))));
      svg.append(s('line', { x1: 4, y1: 48, x2: 176, y2: 48, class: 's-muted', 'stroke-dasharray': '5 4' }));
      svg.append(...box(6, 56, 168, 32, 's-os', 'kernel, on its own', 14));
    } else if (n === 2) {
      [0, 1, 2].forEach((i) => {
        svg.append(s('rect', { x: 6 + i * 59, y: 4, width: 50, height: 84, rx: 6, class: 's-proc', 'stroke-width': 1.6 }));
        svg.append(s('text', { x: 31 + i * 59, y: 30, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700 }, 'P' + (i + 1)));
        svg.append(...box(10 + i * 59, 56, 42, 28, 's-os', 'OS', 14));
      });
    } else {
      [['P1', 's-proc'], ['P2', 's-proc'], ['FS', 's-os'], ['MM', 's-os']].forEach(([t, c], i) => svg.append(...box(6 + i * 43.5, 4, 37, 52, c, t)));
      svg.append(...box(6, 62, 168, 26, 's-os', 'switching code', 14));
    }
    return svg;
  };

  /* A small labelled value box for SVG panels: cls picks the colour. */
  const vbox = (ctx, x, y, w, hh, cls, label, fs) => ctx.s('g', {},
    ctx.s('rect', { x, y, width: w, height: hh, rx: 6, class: cls, 'stroke-width': 1.6 }),
    ctx.s('text', { x: x + w / 2, y: y + hh / 2 + 5, 'text-anchor': 'middle', 'font-size': fs || 13.5, 'font-weight': 700 }, label));
  const MODE_V = { user: ['s-proc', 'user'], kernel: ['s-os', 'kernel'] };
  const RUN_V = { P1: ['s-proc', 'P1'], P2: ['s-proc', 'P2'], K: ['s-os', 'kernel (no process)'] };
  const STK_V = { P1: ['s-proc', 'P1’s stack'], P2: ['s-proc', 'P2’s stack'], SYS: ['s-os', 'system stack'] };

  /* ------------------------------------------------------------------
     Step 2 scene: three user processes above the mode line, the kernel
     (its own memory region, process table and system stack) below it,
     and a CPU panel. set(st) redraws everything from one state object:
       mode 'user'|'kernel', run 'P1'|'P2'|'K', stack 'P1'|'P2'|'SYS',
       status {P1,P2,P3}, saved {P1: text|null, P2: text|null},
       frames [system stack frames, bottom first], arrow null|'call'|'P1'|'P2',
       ms, ps (mode / process switch counts)
     ------------------------------------------------------------------ */
  function npScene(ctx) {
    const { s } = ctx;
    const NW = ctx.narrow;
    const G = NW
      ? { W: 330, H: 494, PX: [4, 113, 222], PW: 104, K: [4, 170, 322, 150], tblW: 186, stk: [206, 198, 112, 112], cpu: [4, 332, 322, 158] }
      : { W: 660, H: 300, PX: [16, 176, 336], PW: 148, K: [16, 170, 468, 124], tblW: 240, stk: [300, 198, 170, 88], cpu: [498, 28, 156, 266] };
    const PY = 28, PH = 96;
    const svg = s('svg', { viewBox: `0 0 ${G.W} ${G.H}`, width: '100%', role: 'img', 'aria-label': 'Three user processes above the mode line, the kernel with its own memory and system stack below it, and the CPU state' });
    function set(st) {
      const kids = [s('text', { x: G.PX[0], y: 18, 'font-size': 13, 'font-weight': 700, class: 's-sub' }, 'User processes (user mode)')];
      ['P1', 'P2', 'P3'].forEach((p, i) => {
        const x = G.PX[i], run = st.run === p, stat = st.status[p];
        kids.push(s('rect', { x, y: PY, width: G.PW, height: PH, rx: 10, class: 's-proc', 'stroke-width': run ? 3.2 : 1.6, opacity: stat === 'Blocked' ? 0.6 : 1 }));
        kids.push(s('text', { x: x + 12, y: PY + 24, 'font-size': 17, 'font-weight': 800 }, p));
        kids.push(s('text', { x: x + 12, y: PY + 44, 'font-size': 13.5, 'font-weight': run ? 800 : 600, style: run ? 'fill:var(--proc)' : '', class: run ? '' : 's-sub' }, stat));
        const sx = x + G.PW - 58, inUse = st.stack === p;
        kids.push(s('rect', { x: sx, y: PY + PH - 38, width: 48, height: 30, rx: 5, class: inUse ? 's-accent' : 's-proc', 'stroke-width': inUse ? 3 : 1.2 }));
        kids.push(s('text', { x: sx + 24, y: PY + PH - 18, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 700 }, 'stack'));
        kids.push(s('text', { x: x + 12, y: PY + PH - 18, 'font-size': 12.5, class: 's-sub' }, NW ? 'code' : 'code, data'));
      });
      const ly = 148, right = G.K[0] + G.K[2];
      kids.push(s('line', { x1: G.K[0], y1: ly, x2: right, y2: ly, class: 's-muted', 'stroke-dasharray': '6 5' }));
      kids.push(s('text', { x: right, y: ly - 6, 'text-anchor': 'end', 'font-size': 12.5, class: 's-sub' }, NW ? 'user ↑' : 'user mode ↑'));
      kids.push(s('text', { x: right, y: ly + 16, 'text-anchor': 'end', 'font-size': 12.5, class: 's-sub' }, NW ? 'kernel ↓' : 'kernel mode ↓'));
      const [kx, ky, kw, kh] = G.K;
      kids.push(s('rect', { x: kx, y: ky, width: kw, height: kh, rx: 12, class: 's-os', 'stroke-width': st.run === 'K' ? 3.2 : 1.8 }));
      kids.push(s('text', { x: kx + 12, y: ky + 20, 'font-size': 14.5, 'font-weight': 800, style: 'fill:var(--os)' }, NW ? 'Kernel · own memory' : 'Kernel · its own memory'));
      kids.push(s('text', { x: kx + 12, y: ky + 40, 'font-size': 12.5, class: 's-sub' }, 'Process table (kernel data)'));
      ['P1', 'P2', 'P3'].forEach((p, i) => {
        const y = ky + 48 + i * 24, v = st.saved[p], on = (st.hl || []).includes(p);
        kids.push(s('rect', { x: kx + 12, y, width: G.tblW - 12, height: 21, rx: 4, class: on ? 's-accent' : 's-panel', 'stroke-width': on ? 2.2 : 1 }));
        kids.push(s('text', { x: kx + 20, y: y + 15, 'font-size': 12.5, 'font-weight': on ? 700 : 400 }, p + (NW ? '' : ' entry') + (v ? ' · ' + v : '')));
      });
      const [sx, sy, sw, sh] = G.stk, sysOn = st.stack === 'SYS';
      kids.push(s('text', { x: sx, y: sy - 8, 'font-size': 13.5, 'font-weight': 800 }, 'System stack'));
      kids.push(s('rect', { x: sx, y: sy, width: sw, height: sh, rx: 6, class: sysOn ? 's-accent' : 's-panel', 'stroke-width': sysOn ? 3 : 1.2 }));
      if (!st.frames.length) kids.push(s('text', { x: sx + sw / 2, y: sy + sh / 2 + 5, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, '(empty)'));
      st.frames.forEach((f, i) => {
        const y = sy + sh - 23 - i * 21;
        kids.push(s('rect', { x: sx + 6, y, width: sw - 12, height: 19, rx: 4, class: 's-os', 'stroke-width': 1.2 }));
        kids.push(s('text', { x: sx + 12, y: y + 14, 'font-size': 12.5, class: 's-monot' }, f));
      });
      /* arrows between a process and the kernel */
      if (st.arrow) {
        const up = st.arrow !== 'call', i = st.arrow === 'P2' ? 1 : 0, ax = G.PX[i] + 44;
        const lbl = st.arrow === 'call' ? 'supervisor call' : st.arrow === 'P1' ? 'resume P1' : 'dispatch P2';
        kids.push(s('line', { x1: ax, y1: up ? ky - 2 : PY + PH + 2, x2: ax, y2: up ? PY + PH + 4 : ky - 4, class: 's-line', stroke: 'var(--accent)', style: 'stroke:var(--accent)', 'stroke-width': 3, 'marker-end': 'url(#arr-accent)' }));
        kids.push(s('text', { x: ax + 8, y: ly + 16, 'font-size': 13, 'font-weight': 800, style: 'fill:var(--accent)' }, lbl));
      }
      /* CPU panel */
      const [cx, cy, cw, ch] = G.cpu, bw = NW ? 200 : cw - 24;
      kids.push(s('rect', { x: cx, y: cy, width: cw, height: ch, rx: 12, class: 's-cpu', 'stroke-width': 1.8 }));
      kids.push(s('text', { x: cx + 12, y: cy + 22, 'font-size': 15, 'font-weight': 800, style: 'fill:var(--cpu)' }, 'CPU'));
      const rows = [['Mode', MODE_V[st.mode]], ['Executing', RUN_V[st.run]], ['Stack in use', STK_V[st.stack]]];
      rows.forEach(([lab, [cls, val]], i) => {
        const [lx, lyy] = NW ? [cx + 12, cy + 36 + i * 30] : [cx + 12, cy + 48 + i * 54];
        if (NW) {
          kids.push(s('text', { x: lx, y: lyy + 16, 'font-size': 13, class: 's-sub' }, lab));
          kids.push(vbox(ctx, cx + cw - 12 - bw, lyy, bw, 24, cls, val, 13.5));
        } else {
          kids.push(s('text', { x: lx, y: lyy, 'font-size': 12.5, class: 's-sub' }, lab));
          kids.push(vbox(ctx, lx, lyy + 6, bw, 26, cls, val, val.length > 14 ? 12.5 : 13.5));
        }
      });
      /* [label x, y, value x (right edge)] for the two counters */
      const cnt = NW ? [[cx + 12, cy + 144, cx + 130], [cx + 150, cy + 144, cx + cw - 12]] : [[cx + 12, cy + 222, cx + cw - 12], [cx + 12, cy + 248, cx + cw - 12]];
      [['Mode switches', st.ms], ['Process switches', st.ps]].forEach(([lab, v], i) => {
        const [x, y, vx] = cnt[i];
        kids.push(s('text', { x, y, 'font-size': 13, 'font-weight': 600 }, lab));
        kids.push(s('text', { x: vx, y, 'font-size': 16, 'font-weight': 800, 'text-anchor': 'end', style: 'fill:var(--chc)' }, String(v)));
      });
      svg.replaceChildren(...kids);
    }
    return { svg, set };
  }

  /* ------------------------------------------------------------------
     Step 3 scene: the process images of P1 (running) and P2 (ready) when
     the OS executes within user processes, plus physical memory holding
     one shared copy of the OS. set(mode, pick) redraws; onPick(key) is
     called when a hot region is clicked.
     ------------------------------------------------------------------ */
  const REGIONS = [
    { k: 'pcb', y: 40, hh: 84, cls: 's-os', lines: ['Process control block'], sub: ['identification', 'processor state', 'control information'], locked: true },
    { k: 'ustack', y: 130, hh: 40, cls: 's-proc', lines: ['User stack'] },
    { k: 'priv', y: 176, hh: 70, cls: 's-proc', lines: ['Private user', 'address space'], sub: ['program, data'] },
    { k: 'kstack', y: 252, hh: 40, cls: 's-os', lines: ['Kernel stack'], locked: true },
    { k: 'shared', y: 298, hh: 60, cls: 's-os', lines: ['Shared address', 'space'], sub: ['OS code, data'], locked: true },
  ];
  function wpScene(ctx, onPick) {
    const { s } = ctx;
    const NW = ctx.narrow;
    const G = NW ? { W: 330, H: 456, P1: 30, P2: 182, PW: 144, os: [30, 396, 296, 50] } : { W: 640, H: 392, P1: 44, P2: 250, PW: 180, os: [468, 250, 164, 90] };
    const svg = s('svg', { viewBox: `0 0 ${G.W} ${G.H}`, width: '100%', role: 'img', 'aria-label': 'Process images of P1 and P2 when the OS runs inside user processes' });
    const byY = Object.fromEntries(REGIONS.map((r) => [r.k, r.y + r.hh / 2]));
    function image(x, who, mode, pick, live) {
      const kids = [s('text', { x, y: 28, 'font-size': 15, 'font-weight': 800 }, who === 'P1' ? 'P1 · Running' : 'P2 · Ready (idle)')];
      REGIONS.forEach((r) => {
        const locked = live && r.locked && mode === 'user';
        const inUse = live && ((mode === 'user' && r.k === 'ustack') || (mode === 'kernel' && r.k === 'kstack'));
        const running = live && ((mode === 'user' && r.k === 'priv') || (mode === 'kernel' && r.k === 'shared'));
        const g = s('g', { class: live ? 'hot' + (pick === r.k ? ' on' : '') : '', tabindex: live ? 0 : null, role: live ? 'button' : null, 'aria-label': live ? r.lines.join(' ') : null });
        g.append(s('rect', { class: (inUse ? 's-accent' : r.cls) + ' fr', x, y: r.y, width: G.PW, height: r.hh, rx: 7, 'stroke-width': inUse || running ? 3 : 1.6,
          'stroke-dasharray': locked ? '5 4' : null, opacity: locked ? (pick === r.k ? 0.9 : 0.45) : live ? 1 : 0.5 }));
        const lines = NW && r.k === 'pcb' ? ['PCB'] : r.lines;   /* the full name does not fit a phone-width column */
        lines.forEach((ln, i) => g.append(s('text', { x: x + 10, y: r.y + 18 + i * 16, 'font-size': 13, 'font-weight': 750, opacity: locked ? 0.6 : live ? 1 : 0.7 }, ln)));
        (r.sub || []).forEach((ln, i) => g.append(s('text', { x: x + 10, y: r.y + 18 + (lines.length + i) * 16 + 1, 'font-size': 12.5, class: 's-sub', opacity: locked ? 0.7 : 1 }, ln)));
        if (live) {
          g.addEventListener('click', () => onPick(r.k));
          g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(r.k); } });
        }
        kids.push(g);
      });
      return kids;
    }
    function set(mode, pick) {
      const kids = [...image(G.P1, 'P1', mode, pick, true), ...image(G.P2, 'P2', mode, pick, false)];
      /* PC and SP pointers beside P1 */
      [['PC', mode === 'user' ? 'priv' : 'shared', 'var(--cpu)'], ['SP', mode === 'user' ? 'ustack' : 'kstack', 'var(--accent)']].forEach(([lab, k, col]) => {
        const y = byY[k];
        kids.push(s('line', { x1: 4, y1: y, x2: G.P1 - 3, y2: y, 'stroke-width': 2.5, style: `stroke:${col}`, 'marker-end': lab === 'PC' ? 'url(#arr-cpu)' : 'url(#arr-accent)' }));
        kids.push(s('text', { x: 6, y: y - 6, 'font-size': 12.5, 'font-weight': 800, style: `fill:${col}` }, lab));
      });
      /* physical memory: one copy of the OS */
      const [ox, oy, ow, oh] = G.os, osOn = pick === 'phys';
      const og = s('g', { class: 'hot' + (osOn ? ' on' : ''), tabindex: 0, role: 'button', 'aria-label': 'Physical memory copy of the OS' });
      og.append(s('rect', { class: 's-os fr', x: ox, y: oy, width: ow, height: oh, rx: 8, 'stroke-width': 2 }));
      og.append(s('text', { x: ox + 10, y: oy + 20, 'font-size': 13, 'font-weight': 800 }, NW ? 'Physical memory: OS code and data' : 'OS code and data'));
      og.append(s('text', { x: ox + 10, y: oy + 38, 'font-size': 12.5, class: 's-sub' }, NW ? 'one copy, shared by every process' : 'one copy, shared'));
      if (!NW) og.append(s('text', { x: ox + 10, y: oy + 55, 'font-size': 12.5, class: 's-sub' }, 'by every process'));
      og.addEventListener('click', () => onPick('phys'));
      og.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick('phys'); } });
      const sh = REGIONS[4], sb = sh.y + sh.hh;
      const link = (d) => s('path', { d, fill: 'none', 'stroke-width': 2, 'stroke-dasharray': '4 3', style: 'stroke:var(--os)' });
      if (NW) {
        kids.push(link(`M${G.P1 + G.PW / 2},${sb} V${oy}`), link(`M${G.P2 + G.PW / 2},${sb} V${oy}`));
      } else {
        kids.push(s('text', { x: ox, y: 28, 'font-size': 15, 'font-weight': 800 }, 'Physical memory'));
        [['P1’s program, data', 40], ['P2’s program, data', 100]].forEach(([t, y]) => {
          kids.push(s('rect', { x: ox, y, width: ow, height: 50, rx: 8, class: 's-proc', 'stroke-width': 1.4, opacity: 0.85 }));
          kids.push(s('text', { x: ox + 10, y: y + 20, 'font-size': 13, 'font-weight': 700 }, t));
          kids.push(s('text', { x: ox + 10, y: y + 38, 'font-size': 12.5, class: 's-sub' }, 'private copy'));
        });
        kids.push(s('text', { x: ox, y: 180, 'font-size': 12.5, class: 's-sub' }, '⋮  other processes'));
        kids.push(link(`M${G.P2 + G.PW},${sh.y + 30} H${ox}`), link(`M${G.P1 + G.PW / 2},${sb} V${G.H - 10} H${ox + ow / 2} V${oy + oh}`));
      }
      kids.push(og);
      svg.replaceChildren(...kids);
    }
    return { svg, set };
  }

  /* ------------------------------------------------------------------
     Step 5 scene: user processes and system processes side by side above
     the process-switching code, then one or four processors with a
     12-slot timeline of who used each one. set(cpus, pick) redraws.
     ------------------------------------------------------------------ */
  const PB_TILES = [
    { k: 'P1', l: ['P1'], user: true }, { k: 'P2', l: ['P2'], user: true }, { k: 'P3', l: ['P3'], user: true },
    { k: 'FS', l: ['File', 'system'] }, { k: 'MM', l: ['Memory', 'manager'] }, { k: 'IO', l: ['I/O', 'manager'] }, { k: 'Mon', l: ['Usage', 'monitor'] },
  ];
  /* '.' = idle slot */
  const PB_TIME = {
    1: [['CPU 0', 'P1 P1 FS FS P2 P2 MM P1 Mon P3 FS P1']],
    4: [['CPU 0', 'P1 P1 P1 P1 P3 P3 P1 P1 P1 P1 P3 P3'], ['CPU 1', 'P2 P2 P2 P2 P2 P2 P3 P3 P2 P2 P2 P2'],
      ['CPU 2', 'FS FS . IO FS . . FS IO . FS .'], ['CPU 3', 'MM . Mon . MM . . Mon . MM . .']],
  };
  function pbScene(ctx, onPick) {
    const { s } = ctx;
    const NW = ctx.narrow;
    /* Wide: one row per processor, time runs left to right. Narrow: one column per processor, time runs downward. */
    const G = NW
      ? { W: 330, H: 490, tile: (i) => (i < 3 ? [4 + i * 82, 24] : [4 + (i - 3) * 82, 102]), tw: 76, th: 50, band: 164, x0: 40, top: 234, rp: 21, rh: 18, fs: 13 }
      : { W: 620, H: 332, tile: (i) => [6 + i * 87, 26], tw: 80, th: 64, band: 146, cx0: 62, pitch: 45, cw: 42, ry: 204, rh: 28, rp: 32, fs: 13 };
    const svg = s('svg', { viewBox: `0 0 ${G.W} ${G.H}`, width: '100%', role: 'img', 'aria-label': 'User and system processes above the process-switching code, and a timeline of processor use' });
    const hot = (k, label, kids) => {
      const g = s('g', { class: 'hot', tabindex: 0, role: 'button', 'aria-label': label }, ...kids);
      g.addEventListener('click', () => onPick(k));
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(k); } });
      return g;
    };
    /* true at slot c when the owner differs from slot c-1: a process switch */
    const switchesIn = (seq) => seq.map((w, c) => c > 0 && w !== '.' && seq[c - 1] !== '.' && w !== seq[c - 1]);
    function set(cpus, pick) {
      const kids = [];
      const [ux] = G.tile(0), [sx, sy] = G.tile(3);
      kids.push(s('text', { x: ux, y: NW ? 16 : 17, 'font-size': 13, 'font-weight': 800, style: 'fill:var(--proc)' }, 'User processes (user mode)'));
      kids.push(s('text', { x: sx, y: NW ? sy - 8 : 17, 'font-size': 13, 'font-weight': 800, style: 'fill:var(--os)' }, 'System processes (kernel mode)'));
      PB_TILES.forEach((tl, i) => {
        const [x, y] = G.tile(i);
        const g = hot(tl.k, tl.l.join(' '), [
          s('rect', { class: (tl.user ? 's-proc' : 's-os') + ' fr', x, y, width: G.tw, height: G.th, rx: 9, 'stroke-width': 1.8 }),
          ...tl.l.map((ln, j) => s('text', { x: x + G.tw / 2, y: y + G.th / 2 + (tl.l.length === 1 ? 6 : j * 17 - 3), 'text-anchor': 'middle', 'font-size': tl.l.length === 1 ? 17 : 13.5, 'font-weight': 750 }, ln))]);
        if (pick === tl.k) g.classList.add('on');
        kids.push(g);
      });
      /* a request from P1 to the file-system process, and back */
      const [p1x, p1y] = G.tile(0), [fx] = G.tile(3);
      if (!NW) {
        const y0 = p1y + G.th + 3, a = p1x + G.tw / 2, b = fx + G.tw / 2;
        kids.push(s('path', { d: `M${a},${y0} C${a},${y0 + 40} ${b},${y0 + 40} ${b},${y0 + 3}`, fill: 'none', class: 's-line', 'stroke-dasharray': '5 4', 'marker-end': 'url(#arr)' }));
        kids.push(s('text', { x: (a + b) / 2, y: y0 + 43, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, 'P1 sends a request; the reply comes back the same way'));
      }
      /* the process-switching code: the only part outside all processes */
      const bh = 28, bandOn = pick === 'SW';
      const bandG = hot('SW', 'Process-switching code', [
        s('rect', { class: 's-os fr', x: 4, y: G.band, width: G.W - 8, height: bh, rx: 8, 'stroke-width': 1.8, 'stroke-dasharray': '6 3' }),
        s('text', { x: G.W / 2, y: G.band + bh / 2 + 5, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 750 }, NW ? 'Switching code · outside all processes' : 'Process-switching code · the only part outside all processes')]);
      if (bandOn) bandG.classList.add('on');
      kids.push(bandG);
      /* one time slot, and one process-switch badge */
      const cell = (x, y, w, hh, who) => {
        const idle = who === '.', on = pick && who === pick;
        kids.push(s('rect', { x, y, width: w, height: hh, rx: 4, class: on ? 's-accent' : idle ? 's-panel' : /^P/.test(who) ? 's-proc' : 's-os', 'stroke-width': on ? 2.6 : 1.1, opacity: idle ? 0.6 : 1 }));
        kids.push(s('text', { x: x + w / 2, y: y + hh / 2 + 4.5, 'text-anchor': 'middle', 'font-size': G.fs, 'font-weight': 700, class: idle ? 's-sub' : '' }, idle ? '·' : who));
      };
      const badge = (x, y) => {
        const col = bandOn ? 'var(--accent)' : 'var(--intr)';
        kids.push(s('rect', { x: x - 9, y: y - 8, width: 18, height: 16, rx: 4, 'stroke-width': bandOn ? 2.4 : 1.4, style: `fill:var(--panel);stroke:${col}` }));
        kids.push(s('text', { x, y: y + 4.5, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 800, style: `fill:${col}` }, 'P'));
      };
      const rows = PB_TIME[cpus].map(([name, seq]) => [name, seq.split(' ')]);
      const nSw = switchesIn(rows[0][1]).filter(Boolean).length;
      if (!NW) {
        rows.forEach(([name, seq], r) => {
          const y = G.ry + r * G.rp;
          kids.push(s('text', { x: 6, y: y + G.rh / 2 + 5, 'font-size': 13, 'font-weight': 800, style: 'fill:var(--cpu)' }, name));
          seq.forEach((who, c) => cell(G.cx0 + c * G.pitch, y, G.cw, G.rh, who));
          if (cpus === 1) switchesIn(seq).forEach((sw, c) => sw && badge(G.cx0 + c * G.pitch - (G.pitch - G.cw) / 2, y + G.rh + 14));
        });
        kids.push(s('text', { x: G.cx0, y: G.ry - 7, 'font-size': 12.5, class: 's-sub' }, cpus === 1 ? 'One processor: time slots, left to right' : 'Four processors: CPU 2 and CPU 3 are dedicated to OS services'));
        if (cpus === 1) {
          kids.push(s('text', { x: G.cx0, y: G.ry + G.rh + 46, 'font-size': 13 }, `Each P marks a process switch: the owner changes ${nSw} times in 12 slots.`));
          kids.push(s('text', { x: G.cx0, y: G.ry + G.rh + 68, 'font-size': 12.5, class: 's-sub' }, 'Teal: user process · violet: system process. Click the switching code to see where it runs.'));
        }
      } else {
        const one = cpus === 1, cw = one ? 76 : 64, pitch = 71.5;
        kids.push(s('text', { x: 4, y: G.top - 24, 'font-size': 12.5, class: 's-sub' }, one ? 'One processor · time runs downward' : 'Four processors · CPU 2, 3 run OS services'));
        for (let r = 0; r < 12; r++) kids.push(s('text', { x: G.x0 - 8, y: G.top + r * G.rp + G.rh / 2 + 4.5, 'text-anchor': 'end', 'font-size': 12.5, class: 's-sub' }, String(r + 1)));
        rows.forEach(([name, seq], col) => {
          const x = G.x0 + col * pitch;
          kids.push(s('text', { x: x + cw / 2, y: G.top - 6, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, style: 'fill:var(--cpu)' }, name));
          seq.forEach((who, r) => cell(x, G.top + r * G.rp, cw, G.rh, who));
          if (one) switchesIn(seq).forEach((sw, r) => sw && badge(x + cw + 16, G.top + r * G.rp - (G.rp - G.rh) / 2));
        });
        if (one) ['Each P marks a', 'process switch:', 'the owner changes', `${nSw} times in 12 slots.`, '', 'Teal: user process', 'Violet: system process']
          .forEach((t, i) => kids.push(s('text', { x: 152, y: G.top + 14 + i * 20, 'font-size': 13, class: i > 4 ? 's-sub' : '' }, t)));
      }
      svg.replaceChildren(...kids);
    }
    return { svg, set };
  }

  /* ------------------------------------------------------------------
     Step 6 data: the same request under each design. Every frame adds one
     timeline segment [lane, mode, label lines, switches at its start].
     Lanes: P1, P2, SP (a system process, design 3 only), OUT (code that
     runs outside every process). A final frame with seg null is the tally.
     ------------------------------------------------------------------ */
  const RUN1 = ['P1', 'user', ['P1 runs', 'its program'], []];
  const LAB = {
    np: {
      quick: [
        [RUN1, '<b>Design 1, quick answer.</b> P1 runs its program in user mode. It is about to ask the OS for the time of day.'],
        [['OUT', 'kernel', ['save P1’s', 'context'], ['M']], '<b>Supervisor call: a mode switch.</b> The processor enters kernel mode, P1’s context is saved, and control passes to the kernel, which runs <b>outside every process</b> on its own system stack.'],
        [['OUT', 'kernel', ['kernel:', 'get time'], []], 'The kernel reads the clock and leaves the answer where P1 will find it. At this moment no process is running at all: only the kernel.'],
        [['P1', 'user', ['P1', 'continues'], ['M']], '<b>Mode switch back.</b> The kernel restores P1’s context and returns to user mode. P1 carries on right after its call.'],
        [null, '<b>Tally: 2 mode switches, 0 process switches.</b> The OS ran as a separate entity outside every process, yet P1 never lost its turn.'],
      ],
      wait: [
        [RUN1, '<b>Design 1, disk read.</b> P1 runs in user mode and P2 is Ready. P1 is about to read data that is still on the disk.'],
        [['OUT', 'kernel', ['save P1’s', 'context'], ['M']], '<b>Supervisor call: a mode switch.</b> The processor enters kernel mode, P1’s context is saved, and the kernel takes over on its own system stack.'],
        [['OUT', 'kernel', ['start disk,', 'P1 Blocked'], []], 'The kernel starts the disk and marks P1 Blocked. P1 cannot continue until the data arrives.'],
        [['OUT', 'kernel', ['dispatcher', 'picks P2'], []], 'The kernel’s dispatcher picks P2 from the Ready queue and loads P2’s saved context.'],
        [['P2', 'user', ['P2 runs', 'its program'], ['P', 'M']], '<b>A process switch and a mode switch.</b> The processor returns to user mode, now running P2 instead of P1.'],
        [null, '<b>Tally: 2 mode switches, 1 process switch.</b> The process switch was unavoidable: P1 must wait, and the processor should not sit idle.'],
      ],
    },
    wp: {
      quick: [
        [RUN1, '<b>Design 2, quick answer.</b> P1 runs its program in user mode, on its user stack.'],
        [['P1', 'kernel', ['OS routine:', 'get time'], ['M']], '<b>System call: a mode switch.</b> The processor enters kernel mode and runs the OS routine <b>inside P1</b>, on P1’s kernel stack. P1 is still the running process.'],
        [['P1', 'user', ['P1', 'continues'], ['M']], '<b>Mode switch back.</b> The routine returns, the processor drops back to user mode, and P1 carries on.'],
        [null, '<b>Tally: 2 mode switches, 0 process switches.</b> P1 borrowed the OS for a moment, much like calling a library routine that happens to have extra privileges.'],
      ],
      wait: [
        [RUN1, '<b>Design 2, disk read.</b> P1 runs in user mode and P2 is Ready.'],
        [['P1', 'kernel', ['OS routine:', 'start disk'], ['M']], '<b>System call: a mode switch.</b> Inside P1, in kernel mode, the OS routine starts the disk read on P1’s kernel stack.'],
        [['P1', 'kernel', ['P1 waits:', 'Blocked'], []], 'The data is not there yet, so the routine marks P1 Blocked. P1’s unfinished kernel work simply stays on P1’s kernel stack.'],
        [['OUT', 'kernel', ['switch', 'P1 → P2'], []], 'A process switch is needed, so control passes to the small process-switching routine. It may begin inside P1, but while it hands the processor over it belongs to neither process, so it is drawn <b>outside all processes</b>. It saves P1’s context and picks P2.'],
        [['P2', 'user', ['P2 runs', 'its program'], ['P', 'M']], '<b>A process switch and a mode switch.</b> P2’s context is loaded and P2 runs in user mode.'],
        [null, '<b>Tally: 2 mode switches, 1 process switch.</b> The same count as design 1: this process switch is caused by the waiting, not by the design.'],
      ],
    },
    pb: {
      quick: [
        [RUN1, '<b>Design 3, quick answer.</b> P1 runs in user mode. The time of day is provided by a clock-service system process.'],
        [['OUT', 'kernel', ['switch to', 'service'], ['M']], '<b>System call: a mode switch.</b> P1’s request enters the kernel. The switching code, outside all processes, saves P1’s context; P1 now waits for the reply.'],
        [['SP', 'kernel', ['read clock,', 'reply'], ['P']], '<b>A process switch.</b> The clock-service process runs, in kernel mode on its own stack. It reads the clock and sends the reply.'],
        [['OUT', 'kernel', ['switch', 'back to P1'], []], 'The service is finished, so the switching code runs again to hand the processor back to P1.'],
        [['P1', 'user', ['P1', 'continues'], ['P', 'M']], '<b>A process switch and a mode switch.</b> P1’s context is restored and P1 carries on in user mode.'],
        [null, '<b>Tally: 2 mode switches, 2 process switches.</b> Even a quick answer cost two process switches: the price of building the OS out of processes.'],
      ],
      wait: [
        [RUN1, '<b>Design 3, disk read.</b> P1 runs in user mode and P2 is Ready. File handling belongs to a file-system process.'],
        [['OUT', 'kernel', ['switch to', 'service'], ['M']], '<b>System call: a mode switch.</b> P1’s request enters the kernel. The switching code saves P1’s context, and P1 waits for the reply.'],
        [['SP', 'kernel', ['start', 'disk read'], ['P']], '<b>A process switch.</b> The file-system process runs and starts the disk read.'],
        [['OUT', 'kernel', ['FS waits,', 'pick P2'], []], 'The file-system process must now wait for the disk as well, so the switching code picks P2.'],
        [['P2', 'user', ['P2 runs', 'its program'], ['P', 'M']], '<b>A process switch and a mode switch.</b> P2 runs in user mode.'],
        [null, '<b>Tally: 2 mode switches, 2 process switches.</b> One more than designs 1 and 2, and when the disk finishes, more switches follow: first to the file system, then back to P1.'],
      ],
    },
  };
  const SVC_NAME = { quick: 'Clock service', wait: 'File system' };
  /* What the CPU is doing during one segment. */
  function cpuOf(design, scen, seg) {
    const [lane, mode] = seg;
    if (lane === 'OUT') return design === 'np'
      ? { mode, run: 'no process: the kernel', stack: 'the kernel’s system stack' }
      : { mode, run: 'no process: switching code', stack: 'a kernel-mode stack' };
    if (lane === 'SP') return { mode, run: SVC_NAME[scen] + ' process', stack: 'the service’s own stack' };
    return { mode, run: lane, stack: lane + '’s ' + (mode === 'user' ? 'user' : 'kernel') + ' stack' };
  }

  function labScene(ctx) {
    const { s } = ctx;
    const NW = ctx.narrow;
    const G = { W: 620, lab: 150, fs: 13.5 };   /* wide layout; phones use setNarrow below */
    const LANES = ['P1', 'P2', 'SP', 'OUT'], LY = (i) => 32 + i * 58, LH = 50, SLOT = (G.W - G.lab - 4) / 5;
    const svg = s('svg', { viewBox: NW ? '0 0 340 298' : `0 0 ${G.W} 262`, width: '100%', role: 'img', 'aria-label': 'Timeline of which code runs where while one request is served' });
    /* Phone layout: one column per lane and time running downward, so the labels stay readable. */
    function setNarrow(design, scen, upto) {
      const list = LAB[design][scen], kids = [], LX = 26, LW = 78.5, TOP = 44, RP = 50;
      const head = { P1: ['P1', 'user'], P2: ['P2', 'user'], SP: design === 'pb' ? SVC_NAME[scen].split(' ') : ['System', 'process'], OUT: design === 'np' ? ['Kernel', 'on its own'] : ['Switching', 'code'] };
      LANES.forEach((ln, i) => {
        const x = LX + i * LW, col = ln === 'P1' || ln === 'P2' ? 'var(--proc)' : 'var(--os)';
        head[ln].forEach((t, j) => kids.push(s('text', { x: x + LW / 2, y: 15 + j * 17, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, style: `fill:${col}` }, t)));
        kids.push(s('rect', { x: x + 2, y: TOP - 2, width: LW - 4, height: 5 * RP + 2, rx: 6, class: 's-panel', 'stroke-width': 1, opacity: 0.55 }));
        if (ln === 'SP' && design !== 'pb') ['not used', 'in this', 'design'].forEach((t, j) => kids.push(s('text', { x: x + LW / 2, y: TOP + 110 + j * 17, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, t)));
      });
      let row = 0;
      for (let f = 0; f <= upto; f++) {
        const seg = list[f][0];
        if (!seg) continue;
        const [lane, mode, lines, marks] = seg, x = LX + LANES.indexOf(lane) * LW, y = TOP + row * RP;
        kids.push(s('rect', { x: x + 4, y: y + 3, width: LW - 8, height: RP - 6, rx: 5, class: mode === 'user' ? 's-proc' : 's-os', 'stroke-width': f === upto ? 3 : 1.3 }));
        lines.forEach((t, j) => kids.push(s('text', { x: x + LW / 2, y: y + 21 + j * 16, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': j ? 500 : 700 }, t)));
        if (marks.length && row > 0) {
          kids.push(s('line', { x1: LX, y1: y, x2: 340, y2: y, 'stroke-width': 1.5, 'stroke-dasharray': '3 3', style: 'stroke:var(--line-2)' }));
          marks.forEach((m, k) => {
            const my = y + (marks.length === 2 ? (k ? 9 : -9) : 0), col = m === 'P' ? 'var(--intr)' : 'var(--os)';
            kids.push(s('rect', { x: 2, y: my - 8, width: 22, height: 16, rx: 4, 'stroke-width': 1.6, style: `fill:var(--panel);stroke:${col}` }));
            kids.push(s('text', { x: 13, y: my + 4.5, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 800, style: `fill:${col}` }, m));
          });
        }
        row++;
      }
      svg.replaceChildren(...kids);
    }
    function set(design, scen, upto) {
      if (NW) return setNarrow(design, scen, upto);
      const list = LAB[design][scen], kids = [];
      kids.push(s('text', { x: 0, y: 14, 'font-size': 12.5, class: 's-sub' }, 'switches here →'));
      LANES.forEach((ln, i) => {
        const y = LY(i);
        let name = ln, sub = ln === 'P1' || ln === 'P2' ? 'user process' : '';
        if (ln === 'SP') { name = design === 'pb' ? SVC_NAME[scen] : 'System process'; sub = design === 'pb' ? 'system process' : 'design 3 only'; }
        if (ln === 'OUT') { name = design === 'np' ? 'Kernel' : 'Switching code'; sub = 'outside every process'; }
        kids.push(s('text', { x: 0, y: y + (sub ? 21 : 30), 'font-size': 14.5, 'font-weight': 800, style: `fill:var(--${ln === 'P1' || ln === 'P2' ? 'proc' : 'os'})` }, name));
        if (sub) kids.push(s('text', { x: 0, y: y + 39, 'font-size': 12.5, class: 's-sub' }, sub));
        kids.push(s('rect', { x: G.lab, y, width: G.W - G.lab - 2, height: LH, rx: 6, class: 's-panel', 'stroke-width': 1, opacity: 0.55 }));
        if (ln === 'SP' && design !== 'pb') kids.push(s('text', { x: G.lab + 12, y: y + 30, 'font-size': 13, class: 's-sub' }, 'not used: this design has no system processes'));
      });
      let slot = 0;
      for (let f = 0; f <= upto; f++) {
        const seg = list[f][0];
        if (!seg) continue;
        const [lane, mode, lines, marks] = seg, x = G.lab + 2 + slot * SLOT, y = LY(LANES.indexOf(lane)), now = f === upto;
        kids.push(s('rect', { x: x + 2, y: y + 3, width: SLOT - 4, height: LH - 6, rx: 5, class: mode === 'user' ? 's-proc' : 's-os', 'stroke-width': now ? 3 : 1.3 }));
        lines.forEach((t, j) => kids.push(s('text', { x: x + SLOT / 2, y: y + 22 + j * 16, 'text-anchor': 'middle', 'font-size': G.fs, 'font-weight': j ? 500 : 700 }, t)));
        if (marks.length && slot > 0) {
          kids.push(s('line', { x1: x, y1: 20, x2: x, y2: LY(3) + LH, 'stroke-width': 1.5, 'stroke-dasharray': '3 3', style: 'stroke:var(--line-2)' }));
          marks.forEach((m, k) => {
            const mx = x + (marks.length === 2 ? (k ? 13 : -13) : 0), col = m === 'P' ? 'var(--intr)' : 'var(--os)';
            kids.push(s('rect', { x: mx - 11, y: 3, width: 22, height: 18, rx: 5, 'stroke-width': 1.6, style: `fill:var(--panel);stroke:${col}` }));
            kids.push(s('text', { x: mx, y: 16.5, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 800, style: `fill:${col}` }, m));
          });
        }
        slot++;
      }
      svg.replaceChildren(...kids);
    }
    return { svg, set };
  }


  Guide.section({
    id: '3.5',
    title: 'Execution of the Operating System',
    short: 'Executing the OS',
    summary: 'Where does OS code run: outside every process, inside each user process, or as processes of its own?',
    objectives: [
      'Explain why “is the operating system a process?” is a real design question, and name the three standard answers.',
      'Describe how a nonprocess kernel handles an interrupt or supervisor call, and which memory and stack it uses.',
      'Identify every part of a process image when the OS executes within user processes, including the kernel stack and the shared address space.',
      'Explain why a system call in that design costs a mode switch rather than a process switch, and estimate the switching overhead of each design.',
      'Weigh the modularity and multiprocessor benefits of a process-based OS against its extra switching cost.',
    ],
    terms: [
      ['Nonprocess kernel', 'A design in which the kernel runs outside every process. It has its own region of memory and its own system stack, and the idea of a process applies only to user programs.'],
      ['Execution within user processes', 'A design in which almost all OS code runs inside whichever user process was interrupted or asked for a service, in kernel mode, on that process’s kernel stack.'],
      ['Process-based operating system', 'A design in which the major OS functions are themselves separate system processes, scheduled like other processes, with only a small amount of switching code running outside all processes.'],
      ['System process', 'A process that carries out an operating-system function, such as file handling or memory management, rather than a user’s program. It runs in kernel mode.'],
      ['System stack of a nonprocess kernel', 'The stack a nonprocess kernel keeps in its own memory region for its procedure calls and returns while it works outside every process. Unlike the stacks in a process image (section 3.3), it belongs to no process; compare the kernel stack that each process has when the OS runs inside user processes.'],
      ['Kernel stack', 'A second stack inside each process image, used only while that process is running OS code in kernel mode. It holds the return addresses, parameters and local variables of kernel procedure calls, out of reach of the user program.'],
      ['User stack', 'The stack a process uses for the procedure calls of its own program while it runs in user mode.'],
      ['Private user address space', 'The part of a process’s address space that holds its own program and data. No other process can reach it.'],
      ['Shared address space', 'The part of every process’s address space that holds the OS code and data. It leads to the same physical memory in every process and can be used only in kernel mode.'],
      ['Mode switch', 'A change of the processor between user mode and kernel mode, for example on an interrupt or system call and again on the return. No process changes state and the memory map stays the same, so it is far cheaper than a process switch.'],
      ['System call (supervisor call)', 'A deliberate request from a running program for an OS service, such as reading a file. A special instruction switches the processor to kernel mode and enters the OS at a fixed, pre-arranged address.'],
      ['Trap', 'An entry into the OS caused by an error or exception in the instruction just executed, such as dividing by zero or trying a privileged instruction in user mode.'],
      ['Context (processor state)', 'Everything the processor needs to resume a program exactly where it stopped: the program counter, the status word, the stack pointer and the other registers.'],
      ['Dispatcher', 'A small piece of OS code that takes the processor away from one process and hands it to the next process chosen to run.'],
      ['Modularity', 'Building a system from separate parts that each do one job and talk to each other only through small, well-defined interfaces, so each part can be understood, tested and replaced on its own.'],
      ['Multiprocessor', 'A computer with two or more processors (or cores) that can execute instructions at the same moment.'],
      ['Multicomputer', 'A system made of several complete computers, each with its own processor and memory, linked by a network and working together on one job.'],
    ],
    css: `
      /* shell workaround: in narrow mode the nowrap eyebrow otherwise sets the canvas min-width */
      .sec-3-5 .step-eyebrow { contain: inline-size; }
      .sec-3-5 .msg { border-radius: 10px; padding: 9px 12px; background: var(--panel-2); border: 1px solid var(--line); font-size: 15px; line-height: 1.45; }
      .sec-3-5 .msg > b:first-child { display: block; margin-bottom: 2px; }
      .sec-3-5 .msg.ok { border-color: var(--ok); background: var(--ok-bg); }
      .sec-3-5 .msg.bad { border-color: var(--bad); background: var(--bad-bg); }
      .sec-3-5 .msg.info { border-color: var(--accent); background: var(--accent-bg); }
      .sec-3-5 .msg.warn { border-color: var(--warn); background: var(--warn-bg); }
      .sec-3-5 .msg.os { border-color: var(--os); background: var(--os-bg); }
      .sec-3-5 svg .hot { cursor: pointer; }
      .sec-3-5 svg .hot .fr { transition: stroke-width .15s, opacity .2s; }
      .sec-3-5 svg .hot:hover .fr { stroke-width: 3.5; }
      .sec-3-5 svg .hot.on .fr { stroke: var(--accent); stroke-width: 3.5; }
      .sec-3-5 svg .hot:focus { outline: none; }
      .sec-3-5 svg .hot:focus-visible .fr { stroke: var(--accent); stroke-width: 4; }
      /* step 1: the three-option preview */
      .sec-3-5 .opt { display: flex; flex-direction: column; gap: 6px; padding: 8px 10px 10px; border: 2px solid var(--line); border-radius: 12px; background: var(--panel); cursor: pointer; text-align: left; color: var(--ink); font: inherit; transition: border-color .15s, background .15s; }
      .sec-3-5 .opt:hover { border-color: var(--accent); }
      .sec-3-5 .opt.on { border-color: var(--accent); background: var(--accent-bg); }
      .sec-3-5 .opt .ot { font-size: 14.5px; font-weight: 750; line-height: 1.3; }
      .sec-3-5 .opt .on-tag { font-size: 12px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
      .sec-3-5 .opt.seen .on-tag { color: var(--ok); }
      .sec-3-5 .preview { min-height: 142px; }
      /* step 4: predict buttons and the cost bars */
      .sec-3-5 .pick3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
      .sec-3-5 .pick3 .btn { height: 46px; font-size: 18px; font-weight: 800; }
      .sec-3-5 .pick3 .btn.right { border-color: var(--ok); background: var(--ok-bg); color: var(--ok); }
      .sec-3-5 .pick3 .btn.wrong { border-color: var(--bad); background: var(--bad-bg); color: var(--bad); }
      .sec-3-5 .cost { display: grid; grid-template-columns: 178px minmax(0, 1fr) 118px; align-items: center; gap: 10px; font-size: 14.5px; }
      .sec-3-5 .cost .nm { font-weight: 700; line-height: 1.25; }
      .sec-3-5 .cost .nm small { display: block; font-weight: 500; color: var(--muted); font-size: 12.5px; }
      .sec-3-5 .cost .trk { height: 18px; border-radius: 99px; background: var(--panel-3); overflow: hidden; }
      .sec-3-5 .cost .trk > i { display: block; height: 100%; border-radius: 99px; background: var(--os); transition: width .25s; }
      .sec-3-5 .cost .trk > i.hot3 { background: var(--warn); }
      .sec-3-5 .cost .trk > i.over { background: var(--bad); }
      .sec-3-5 .cost .val { text-align: right; font-weight: 800; font-variant-numeric: tabular-nums; }
      .sec-3-5 .cost .val small { display: block; font-weight: 500; color: var(--muted); font-size: 12.5px; }
      .sec-3-5 .calc .ui-slider label { width: 164px; }
      .sec-3-5 .formula { font-family: var(--mono); font-size: 13.5px; background: var(--panel-3); border-radius: 10px; padding: 8px 10px; line-height: 1.5; }
      @media (max-width: 760px) { .sec-3-5 .cost { grid-template-columns: minmax(0, 1fr) 100px; } .sec-3-5 .cost .trk { grid-column: 1 / -1; grid-row: 2; } }
      /* step 6: the lab's status panel and tally table */
      .sec-3-5 .kv { display: grid; grid-template-columns: 104px minmax(0, 1fr); gap: 6px 10px; align-items: center; font-size: 14.5px; }
      .sec-3-5 .kv > span:nth-child(odd) { color: var(--muted); font-size: 13px; font-weight: 700; }
      .sec-3-5 .ctr { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      .sec-3-5 .ctr > div { border: 1px solid var(--line); border-radius: 10px; padding: 6px 10px; background: var(--panel); }
      .sec-3-5 .ctr .big { font-size: 32px; }
      .sec-3-5 .mk { display: inline-grid; place-items: center; width: 20px; height: 18px; border-radius: 5px; border: 1.6px solid; font-size: 12px; font-weight: 800; margin-right: 6px; vertical-align: 1px; }
      .sec-3-5 .mk.m { color: var(--os); border-color: var(--os); } .sec-3-5 .mk.p { color: var(--intr); border-color: var(--intr); }
      .sec-3-5 .tally td, .sec-3-5 .tally th { text-align: center; }
      .sec-3-5 .tally td:first-child, .sec-3-5 .tally th:first-child { text-align: left; }
      .sec-3-5 .tally td.cur { outline: 2px solid var(--accent); outline-offset: -2px; border-radius: 6px; }
      .sec-3-5 .tally td.p2 { color: var(--intr); font-weight: 800; }
      /* step 7: sorter and trade-off table */
      .sec-3-5 .stmt { font-size: 19px; font-weight: 650; line-height: 1.4; padding: 14px 16px; border-radius: 12px; background: var(--panel); border: 2px solid var(--line); min-height: 96px; display: flex; align-items: center; }
      .sec-3-5 .bins { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
      .sec-3-5 .bins .btn { height: auto; min-height: 44px; white-space: normal; line-height: 1.25; padding: 6px 10px; }
      .sec-3-5 .bins .btn.right { border-color: var(--ok); background: var(--ok-bg); color: var(--ok); }
      .sec-3-5 .bins .btn.wrong { border-color: var(--bad); background: var(--bad-bg); color: var(--bad); }
      .sec-3-5 .dots { display: flex; gap: 5px; flex-wrap: wrap; }
      .sec-3-5 .dots i { width: 16px; height: 16px; border-radius: 5px; background: var(--panel-3); border: 2px solid var(--line-2); }
      .sec-3-5 .dots i.cur { border-color: var(--accent); }
      .sec-3-5 .dots i.ok { background: var(--ok); border-color: var(--ok); }
      .sec-3-5 .dots i.late { background: var(--warn); border-color: var(--warn); }
      .sec-3-5 .tradeoff { position: relative; }
      .sec-3-5 .tradeoff table { font-size: 13.5px; }
      .sec-3-5 .tradeoff td, .sec-3-5 .tradeoff th { padding: 5px 7px; line-height: 1.3; }
      .sec-3-5 .tradeoff td:first-child { font-weight: 700; color: var(--ink-2); }
      .sec-3-5 .tradeoff .good { color: var(--ok); font-weight: 700; } .sec-3-5 .tradeoff .cost3 { color: var(--intr); font-weight: 700; }
      .sec-3-5 .tradeoff.veiled tbody { filter: blur(5px); opacity: .45; user-select: none; }
      .sec-3-5 .tradeoff .veil { position: absolute; inset: 40px 0 0 0; display: grid; place-items: center; text-align: center; }
      .sec-3-5 .tradeoff .veil > div { background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 12px 16px; box-shadow: var(--shadow); max-width: 320px; }
    `,
    steps: [
      /* ---------------- 1. Big Picture: is the OS a process? ---------------- */
      {
        title: 'Is the operating system a process?',
        kind: 'story',
        render(el, ctx) {
          const { h } = ctx;
          const INFO = [
            ['Design 1 · Nonprocess kernel',
              'The kernel is a separate program with its own memory and its own stack. Only user programs count as processes. When one of them needs the OS, its state is saved and the kernel takes over, outside every process.',
              'The caretaker works from an office in the basement. Tenants phone down, and the job is done down there.'],
            ['Design 2 · Execution within user processes',
              'The OS is a set of routines that every process can call. They run inside the caller’s own process, just with the processor switched to kernel mode.',
              'Every apartment has a locked service closet holding the same tools. When you need help, a technician unlocks it and works right there in your apartment.'],
            ['Design 3 · Process-based OS',
              'The OS itself is split into several processes (a file system, a memory manager and so on) that are scheduled like everyone else.',
              'The building has a team of specialists, each in an office of their own. You send your request to the right one and wait for the answer.'],
          ];
          const seen = new Set();
          const box = h('div', { class: 'msg preview' });
          const done = h('p', { class: 'small muted m0' }, 'Previewed 0 of 3.');
          say(box, 'info', 'Pick an option to preview it.', 'There is no trick here: all three answers have been used in real operating systems. The rest of this section takes each one apart.');
          const opts = [1, 2, 3].map((n) => {
            const tag = h('span', { class: 'on-tag' }, 'Option ' + n);
            const b = h('button', { class: 'opt', type: 'button', onclick: () => pick(n) },
              sketch(ctx, n), tag,
              h('span', { class: 'ot' }, ['Outside every process', 'Inside each user process', 'As processes of its own'][n - 1]));
            b.tag = tag;
            return b;
          });
          function pick(n) {
            seen.add(n);
            opts.forEach((b, i) => {
              b.classList.toggle('on', i === n - 1);
              b.classList.toggle('seen', seen.has(i + 1));
              b.tag.textContent = 'Option ' + (i + 1) + (seen.has(i + 1) ? ' ✓' : '');
            });
            const [t, what, pic] = INFO[n - 1];
            say(box, 'os', t, `<div>${what}</div><div class="mt small"><i>In the building:</i> ${pic}</div>`);
            done.innerHTML = seen.size < 3 ? `Previewed ${seen.size} of 3.`
              : '<b style="color:var(--ok)">All three previewed.</b> Next, each design in detail, then all three side by side on the same request.';
          }
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack' },
              h('p', { class: 'lead m0', html: 'The operating system is software. The <span class="t">processor</span> runs its instructions the same way it runs yours: fetch the next one, carry it out, repeat.' }),
              h('p', { class: 'm0', html: 'Yet we have been treating the OS as the <i>manager</i> of <span class="t">processes</span>: it creates them, switches between them and puts them to sleep. So here is the puzzle. <b>Is the OS itself a process?</b> If it is, who schedules the scheduler? If it is not, where does its code run, and whose stack holds its procedure calls?' }),
              h('div', { class: 'callout analogy m0', 'data-label': 'Analogy', html: 'An apartment building. The tenants are processes, each in an apartment of their own. The building also has staff who fix things. <b>Where do the staff work?</b>' }),
              h('div', { class: 'callout why m0', 'data-label': 'Why it matters', html: 'The answer decides how much every request to the OS costs, how memory is laid out, and how easily the OS can be split into parts or spread over several processors.' })),
            h('div', { class: 'card white stack' },
              h('h3', { class: 'm0' }, 'Where should the OS’s own code run?'),
              h('div', { class: 'grid-3' }, ...opts),
              box, done,
              h('div', { class: 'road', style: { marginTop: 'auto' } },
                h('h4', { class: 'm0' }, 'Coming up'),
                h('div', { class: 'row gap-s' },
                  ...['Each design up close', 'What a switch costs', 'One request, three designs', 'Sort the trade-offs']
                    .map((t, i) => h('span', { class: 'chip accent' }, (i + 1) + ' · ' + t)))))));
        },
      },

      /* ---------------- 2. Design 1: the nonprocess kernel ---------------- */
      {
        title: 'Design 1: a kernel outside every process',
        kind: 'explore',
        render(el, ctx) {
          const { h } = ctx;
          const scene = npScene(ctx);
          const base = { mode: 'user', run: 'P1', stack: 'P1', status: { P1: 'Running', P2: 'Ready', P3: 'Blocked' },
            saved: { P1: 'running', P2: 'context saved', P3: 'context saved' }, hl: [], frames: [], arrow: null, ms: 0, ps: 0 };
          const K = { mode: 'kernel', run: 'K', stack: 'SYS' };
          const savedP1 = { P1: 'context saved', P2: 'context saved', P3: 'context saved' };
          const common = [
            [{}, '<b>Before.</b> P1 runs its own program in user mode, on its own stack. Below the line sits the kernel, in a separate region of memory. Notice what the kernel is <i>not</i>: it has no PCB, no state and no place in any queue. It is not a process.'],
            [{ ...K, frames: ['entry()'], arrow: 'call', ms: 1 }, '<b>P1 makes a supervisor call</b> to read part of a file. The hardware switches the processor to kernel mode and jumps to the kernel’s fixed entry point: a <span class="t">mode switch</span>. The kernel now works on its <b>own</b> <span class="t" data-t="System stack of a nonprocess kernel">system stack</span>, not on P1’s. P1’s state is still Running: a mode switch changes no process’s state.'],
            [{ ...K, frames: ['entry()', 'save_ctx()'], saved: savedP1, hl: ['P1'], ms: 1 }, '<b>Save P1’s context.</b> P1’s program counter, status word and registers are copied into P1’s entry in the process table, which lives in the kernel’s memory. Now P1 can later continue exactly where it stopped.'],
            [{ ...K, frames: ['entry()', 'do_read()', 'find_block()'], saved: savedP1, ms: 1 }, '<b>The kernel does the work.</b> Each kernel procedure call pushes a frame onto the system stack and each return pops one, all inside the kernel’s own memory. P1’s stack is untouched.'],
          ];
          const tails = {
            quick: [
              [{ saved: base.saved, hl: ['P1'], arrow: 'P1', ms: 2 }, '<b>The block was already in memory.</b> The kernel copies it into P1’s buffer, restores P1’s context and switches back to user mode. P1 carries on right after its call. Total: <b>2 mode switches, 0 process switches</b>.'],
            ],
            wait: [
              [{ ...K, status: { P1: 'Blocked', P2: 'Ready', P3: 'Blocked' }, frames: ['entry()', 'do_read()', 'start_disk()'], saved: { ...savedP1, P1: 'saved · Blocked' }, hl: ['P1'], ms: 1 },
                '<b>The block must come from disk.</b> The kernel tells the disk to start reading and records in P1’s entry that P1 is now Blocked. P1 cannot continue, so the processor should go to someone else.'],
              [{ ...K, status: { P1: 'Blocked', P2: 'Ready', P3: 'Blocked' }, frames: ['entry()', 'dispatcher()'], saved: { ...savedP1, P1: 'saved · Blocked' }, hl: ['P2'], ms: 1 },
                '<b>Choose the next process.</b> The kernel’s <span class="t">dispatcher</span> looks at the Ready queue and picks P2. The kernel is still not a process: it is simply code running between processes.'],
              [{ status: { P1: 'Blocked', P2: 'Running', P3: 'Blocked' }, run: 'P2', stack: 'P2', saved: { P1: 'saved · Blocked', P2: 'running', P3: 'context saved' }, hl: ['P2'], arrow: 'P2', ms: 2, ps: 1 },
                '<b>Dispatch P2.</b> The kernel loads P2’s saved context and returns to user mode, so P2 runs. The system stack is empty again: P1’s unfinished read is recorded in kernel tables (P1’s entry and the disk’s request list), not on any stack. Total: <b>2 mode switches, 1 process switch</b>.'],
            ],
          };
          let outcome = 'quick';
          const frames = () => common.concat(tails[outcome]);
          const player = ctx.ui.player({ count: frames().length, interval: 2600, render: (i) => {
            const [patch, cap] = frames()[i];
            scene.set({ ...base, ...patch });
            return cap;
          } });
          const seg = ctx.ui.seg([{ value: 'quick', label: 'Data already in memory' }, { value: 'wait', label: 'Data must come from disk' }], outcome, (v) => {
            outcome = v; player.stop(); player.setCount(frames().length);
          });
          el.append(h('div', { class: 'split r fill' },
            h('div', { class: 'stack' }, h('div', { class: 'card white' }, scene.svg), player.el,
              h('p', { class: 'small muted m0', html: '<b>Watch the CPU panel:</b> while the kernel works, <b>Executing</b> names no process.' })),
            h('div', { class: 'stack' },
              h('p', { class: 'm0', html: 'The <b>traditional</b> <span class="t">nonprocess kernel</span>, used by many older operating systems, is a separate entity that runs in privileged <span class="t">kernel mode</span>.' }),
              h('ul', { class: 'm0 small', html: '<li>Only user programs are processes. The kernel has no <span class="t">PCB</span> and is never scheduled.</li>'
                + '<li>The kernel has its own region of memory and its own <span class="t" data-t="System stack of a nonprocess kernel">system stack</span> for its procedure calls and returns.</li>'
                + '<li>On an <span class="t">interrupt</span>, a <span class="t">trap</span> or a <span class="t">supervisor call</span>, the running process’s <span class="t">context</span> is saved and control passes to the kernel.</li>'
                + '<li>When it is done, the kernel either restores that same process or dispatches a different one.</li>' }),
              h('div', { class: 'card tight stack gap-s' },
                h('h4', { class: 'm0' }, 'P1 asks to read a file block. Where is the data?'), seg,
                h('p', { class: 'xs muted m0' }, 'Switching the outcome restarts the walkthrough.')),
              h('div', { class: 'callout why m0 small', 'data-label': 'One stack for every request', html: 'The kernel cannot leave half-done work on its single system stack for a process that must wait. So it records that work in its tables and empties the stack before it dispatches anyone else.' }))));
        },
      },

      /* ---------------- 3. Design 2: the process image when the OS runs inside processes ---------------- */
      {
        title: 'Design 2: the OS runs inside each user process',
        kind: 'explore',
        render(el, ctx) {
          const { h } = ctx;
          const INFO = {
            pcb: ['Process control block', 'The OS’s record of this process: <b>identification</b> (its PID, its parent), <b>processor state</b> (the saved registers, used while the process is not running) and <b>process control information</b> (state, priority, scheduling and memory details). Only OS code, in kernel mode, may read or change it.'],
            ustack: ['User stack', 'Holds the frames of the program’s <i>own</i> procedure calls: return addresses, parameters and local variables. It is the stack in use while P1 runs its program in user mode.'],
            priv: ['Private user address space', 'P1’s program code and data. It belongs to P1 alone: no other process can reach it. In user mode the program counter points in here.'],
            kstack: ['Kernel stack', 'A second, separate stack, used only while P1 runs OS code in kernel mode. Kernel calls push their frames here, never on the user stack, which the program controls and could have left in any state. Because every process has its own kernel stack, a system call that must wait halfway through can leave its unfinished work here while another process runs.'],
            shared: ['Shared address space', 'The OS code and data. It appears in <b>every</b> process’s address space and leads to the same physical memory each time, so the OS exists once yet can run inside any process. The hardware allows it to be used only in kernel mode.'],
            phys: ['One copy in physical memory', 'Each process has its own private pages, but the shared address space of every process is mapped onto this <b>same</b> physical memory. The OS code is never copied: the only OS-related pieces that exist once per process are its PCB and its kernel stack.'],
          };
          let mode = 'user', pick = null;
          const info = h('div', { class: 'msg info', style: { minHeight: '146px' } });
          const status = h('div', { class: 'msg', style: { padding: '7px 12px' } });
          const scene = wpScene(ctx, (k) => { pick = k; paint(); });
          function paint() {
            scene.set(mode, pick);
            status.innerHTML = mode === 'user'
              ? '<b>Running: P1</b>Code: P1’s program · Stack: P1’s user stack · Mode: user'
              : '<b>Running: still P1</b>Code: the OS routine <code>read()</code> · Stack: P1’s kernel stack · Mode: kernel';
            status.className = 'msg ' + (mode === 'user' ? 'ok' : 'os');
            if (pick) say(info, 'info', INFO[pick][0], INFO[pick][1]);
            else say(info, 'info', 'Click any part of P1’s image', 'or the physical-memory box. Then flip the mode and watch which parts P1 is allowed to use, where the program counter (PC) points and which stack the stack pointer (SP) uses.');
          }
          const seg = ctx.ui.seg([{ value: 'user', label: 'P1 runs its program' }, { value: 'kernel', label: 'P1 makes a system call' }], mode, (v) => { mode = v; paint(); });
          paint();
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack' },
              h('p', { class: 'lead m0', html: 'Common on PCs and workstations, <span class="t">execution within user processes</span> runs almost all OS software <b>in the context of a user process</b>.' }),
              h('p', { class: 'm0', html: 'The OS becomes a set of routines that programs call. On a <span class="t">system call</span> (or an interrupt or trap) the OS routine runs <i>inside P1</i>, the process that was running, in kernel mode: P1 is still the running process, just executing OS code for a while. So each <span class="t">process image</span> gains a <span class="t">kernel stack</span> and the <span class="t">shared address space</span>.' }),
              info,
              h('div', { class: 'callout warn m0', 'data-label': 'Common mistake', html: '“The OS is in my address space, so my program can change it.” No: that region is usable only in kernel mode, and in user mode the hardware blocks any access.' })),
            h('div', { class: 'card white stack gap-s' },
              h('div', { class: 'row' }, h('span', { class: 'small b' }, 'What is P1 doing?'), seg),
              status, scene.svg,
              h('div', { class: (ctx.narrow ? 'row' : 'row nw') + ' xs muted', style: { marginTop: 'auto', gap: '16px' } },
                h('span', {}, 'Dashed, faded: locked outside kernel mode'),
                h('span', {}, 'PC → code running now'),
                h('span', {}, 'SP → stack in use')))));
        },
      },

      /* ---------------- 4. Predict, then price: mode switch vs process switch ---------------- */
      {
        title: 'A mode switch, not a process switch: count the cost',
        kind: 'predict',
        core: true,
        render(el, ctx) {
          const { h, util } = ctx;
          /* ---- left: predict ---- */
          const FB = [
            ['ok', 'Right: zero.', 'Each request is one mode switch into the kernel and one back, so 2,000 mode switches. But P1 never stops being the running process: the OS code runs <i>inside</i> P1, so no process switch ever happens.'],
            ['bad', 'Not quite.', 'A process switch means the processor is taken away from P1 and given to another process. Does that ever need to happen here? The OS routine runs inside P1 and every answer is ready at once.'],
            ['bad', 'That is the count for a different design.', 'If the time service were a separate process (design 3), every request would need a switch to it and a switch back: 2,000 process switches. Here the OS runs inside P1, so the answer is 0.'],
          ];
          const fb = h('div', { class: 'msg', style: { minHeight: '118px' } });
          say(fb, '', 'Commit to a number first.', 'Then compare your answer with the explanation here, and put a price on it with the calculator.');
          let tries = 0, solved = false;
          const btns = ['0', '1,000', '2,000'].map((t, i) => h('button', { class: 'btn', type: 'button', onclick: () => {
            if (solved) return;
            tries++;
            btns.forEach((b, j) => b.classList.toggle(j === 0 ? 'right' : 'wrong', j === i || (i === 0 && j === 0)));
            if (i === 0) solved = true;
            const [k, title, body] = FB[i];
            say(fb, k, title, body + (i === 0 && tries > 1 ? ' <i>(second try)</i>' : ''));
          } }, t));
          const left = h('div', { class: 'stack' },
            h('div', { class: 'card stack gap-s' },
              h('h4', { class: 'm0' }, 'Predict'),
              h('p', { class: 'm0', html: 'A program asks the OS for the time of day <b>1,000 times</b>. The OS executes within user processes (design 2), and every answer is ready at once. How many <b>process switches</b> does that take?' }),
              h('div', { class: 'pick3' }, ...btns), fb),
            h('div', { class: 'callout why m0', 'data-label': 'Why the difference is so large', html: 'A <span class="t">mode switch</span> flips the mode bit, saves a few registers and switches to the OS’s stack. A <span class="t">process switch</span> saves a whole context, updates two PCBs and a queue, and changes the memory map. The new process then starts with caches full of the old one’s data, so it runs slowly at first.' }),
            h('p', { class: 'small muted m0', html: 'Section 3.4 walked through the seven steps of a process switch. Here we only need their price, compared with the price of a mode switch.' }));
          /* ---- right: the cost calculator ---- */
          let calls = 50000, mode = 0.2, proc = 3;
          const rows = DESIGNS.map((d) => {
            const bar = h('i'), val = h('div', { class: 'val' });
            const row = h('div', { class: 'cost' },
              h('div', { class: 'nm', html: `${d.n} · ${d.short}<small>${d.n === 3 ? '2 mode + 2 process switches per call' : '2 mode switches per call'}</small>` }),
              h('div', { class: 'trk' }, bar), val);
            return { d, bar, val, row };
          });
          const formula = h('div', { class: 'formula' });
          const fmtN = (n) => Math.round(n).toLocaleString('en-US');
          function update() {
            rows.forEach(({ d, bar, val }) => {
              const per = 2 * mode + (d.n === 3 ? 2 * proc : 0);          /* µs of switching per call */
              const ms = (calls * per) / 1000;                              /* ms of switching per second */
              const pct = ms / 10;                                          /* % of one processor (1000 ms) */
              bar.style.width = Math.min(100, pct) + '%';
              bar.className = pct > 100 ? 'over' : d.n === 3 ? 'hot3' : '';
              val.innerHTML = pct > 100 ? `over 100%<small>cannot keep up</small>` : `${util.fmt(pct, pct < 10 ? 1 : 0)}%<small>${util.fmt(ms, ms < 10 ? 1 : 0)} ms per second</small>`;
            });
            const p3 = 2 * mode + 2 * proc, us3 = calls * p3, us12 = calls * 2 * mode;
            const fmtMs = (us) => util.fmt(us / 1000, us < 10000 ? 1 : 0);
            formula.innerHTML = `Design 3: ${fmtN(calls)} × (2 × ${util.fmt(mode, 1)} + 2 × ${util.fmt(proc, 1)}) µs<br>= ${fmtN(us3)} µs = ${fmtMs(us3)} ms of every second`
              + `<br>Designs 1, 2: ${fmtN(calls)} × (2 × ${util.fmt(mode, 1)}) µs = ${fmtMs(us12)} ms`;
          }
          const sCalls = ctx.ui.slider({ label: 'Service requests / s', min: 1000, max: 200000, step: 1000, value: calls, format: fmtN, onInput: (v) => { calls = v; update(); } });
          const sMode = ctx.ui.slider({ label: 'Mode switch', min: 0.1, max: 1, step: 0.1, value: mode, format: (v) => util.fmt(v, 1) + ' µs', onInput: (v) => { mode = v; update(); } });
          const sProc = ctx.ui.slider({ label: 'Process switch', min: 1, max: 10, step: 0.5, value: proc, format: (v) => util.fmt(v, 1) + ' µs', onInput: (v) => { proc = v; update(); } });
          update();
          const preset = (label, c, m, p, note) => h('button', { class: 'btn sm', type: 'button', title: note, onclick: () => {
            calls = c; mode = m; proc = p; sCalls.set(c); sMode.set(m); sProc.set(p); update();
            ctx.toast(note);
          } }, label);
          const right = h('div', { class: 'card white stack calc', style: { gap: '10px' } },
            h('h3', { class: 'm0' }, 'Price it: processor time spent switching'),
            sCalls, sMode, sProc,
            h('div', { class: 'row gap-s' }, h('span', { class: 'xs muted b' }, 'TRY'),
              preset('Busy server', 150000, 0.2, 3, 'A busy server: design 3 now spends almost the whole processor on switching.'),
              preset('Cheaper process switch', 50000, 0.2, 1, 'Even at 1 µs, design 3 pays six times as much as designs 1 and 2.'),
              preset('Reset', 50000, 0.2, 3, 'Back to the starting prices.')),
            h('div', { class: 'stack gap-s' }, ...rows.map((r) => r.row)),
            formula,
            h('p', { class: 'xs muted m0' }, 'Illustrative prices; real ones depend on the hardware. Designs 1 and 2 tie on switch count. They differ in where a waiting request’s progress is kept (kernel tables versus the caller’s own kernel stack), not in how often they switch.'));
          el.append(h('div', { class: 'split fill' }, left, right));
        },
      },

      /* ---------------- 5. Design 3: the OS as a set of system processes ---------------- */
      {
        title: 'Design 3: the OS as a team of system processes',
        kind: 'explore',
        render(el, ctx) {
          const { h } = ctx;
          const INFO = {
            P1: ['A user process', 'P1 runs in user mode. To get a service it sends a request to the right system process and waits for the reply, instead of calling an OS routine directly.'],
            FS: ['File-system process', 'Turns requests such as open and read into disk operations. Others reach it only through its request interface, so its insides can change without breaking anyone: <b>modular design with small, clean interfaces</b>.'],
            MM: ['Memory-manager process', 'Hands out and reclaims memory. Like every system process it runs in kernel mode, yet the dispatcher schedules it like any other process.'],
            IO: ['I/O-manager process', 'Drives the devices. On a <span class="t">multiprocessor</span> it can live on a processor of its own, so device work goes on in parallel with the user programs.'],
            Mon: ['Usage monitor: a noncritical job', 'Records how busy the processor, memory and I/O channels are and how fast user processes progress. No process asks it for a service, so it fits naturally as a process: it gets its own low priority and runs whenever the dispatcher gives it a turn.'],
            SW: ['Process-switching code', 'The one part that cannot be a process: something must take the processor from one process and give it to the next. It is small, it runs outside all processes, and on the one-processor timeline it runs at every P mark.'],
          };
          INFO.P2 = INFO.P3 = INFO.P1;
          let cpus = 1, pick = null;
          const info = h('div', { class: 'msg info', style: { minHeight: '92px' } });
          const stat = h('p', { class: 'small m0' });
          const scene = pbScene(ctx, (k) => { pick = k; paint(); });
          function paint() {
            scene.set(cpus, pick);
            if (pick) say(info, 'info', INFO[pick][0], INFO[pick][1]);
            else say(info, 'info', 'Click any process, or the switching code.', 'Clicking a process also highlights its time slots in the processor timeline.');
            stat.innerHTML = cpus === 1
              ? '<b>One processor:</b> user programs get only 7 of 12 slots. The other 5 go to OS services, and every change of owner is a process switch.'
              : '<b>Four processors:</b> CPU 0 and 1 give all 24 slots to user programs; OS services run alongside on CPU 2 and 3.';
          }
          const seg = ctx.ui.seg([{ value: 1, label: 'One processor' }, { value: 4, label: 'Four processors' }], cpus, (v) => { cpus = v; paint(); });
          paint();
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack' },
              h('p', { class: 'lead m0', html: 'Take the idea all the way: a <span class="t" data-t="Process-based operating system">process-based OS</span> is a collection of <span class="t">system processes</span>.' }),
              h('p', { class: 'm0 small', html: 'The major kernel functions become separate processes. They run in kernel mode, but the <span class="t">dispatcher</span> schedules them like any other process. Only a small amount of process-switching code runs outside all processes.' }),
              h('h4', { class: 'm0' }, 'Three advantages'),
              h('ol', { class: 'm0 small', html: '<li><b>Modular by design.</b> Each function hides inside its own process and is reached only through a small, clean interface (<span class="t">modularity</span>).</li>'
                + '<li><b>Noncritical jobs fit neatly.</b> A usage monitor can run at its own low priority, interleaved with other work.</li>'
                + '<li><b>Ready for many processors.</b> Services can be shipped to dedicated processors, or to other machines of a <span class="t">multicomputer</span>, improving performance.</li>' }),
              h('div', { class: 'callout warn m0', 'data-label': 'The price', html: 'Every service request now travels from one process to another: a process switch to the service and another away from it. That is the overhead you priced in the previous step.' })),
            h('div', { class: 'card white stack gap-s' },
              h('div', { class: 'row' }, h('span', { class: 'small b' }, 'Processors:'), seg),
              scene.svg, stat, info)));
        },
      },

      /* ---------------- 6. Lab: one request, three designs (head to head) ---------------- */
      {
        title: 'Head to head: one request, three designs',
        kind: 'lab',
        core: true,
        render(el, ctx) {
          const { h } = ctx;
          let design = 'np', scen = 'quick';
          const results = {};
          const scene = labScene(ctx);
          const modeV = h('span', { class: 'chip' }), runV = h('span', { class: 'b' }), stackV = h('span');
          const msV = h('div', { class: 'big' }), psV = h('div', { class: 'big' });
          const tbody = h('tbody');
          const insight = h('div', { class: 'msg', style: { minHeight: '64px' } });
          const SCEN = { quick: 'Quick answer', wait: 'Must wait' };
          function paintTable() {
            tbody.replaceChildren(...DESIGNS.map((d) => h('tr', { class: d.key === design ? 'on' : '' },
              h('td', { class: 'b' }, d.n + ' · ' + d.short),
              ...['quick', 'wait'].map((sc) => {
                const r = results[d.key + sc];
                return h('td', { class: (d.key === design && sc === scen ? 'cur ' : '') + (r && r[1] === 2 ? 'p2' : ''), html: r ? `${r[0]} M · ${r[1]} P` : '<span class="muted">run it</span>' });
              }))));
            const n = Object.keys(results).length;
            if (n < 6) say(insight, 'info', `Tally: ${n} of 6 runs complete.`, 'Play each design with each request to the end. The last frame of every run records its switches here.');
            else say(insight, 'ok', 'Pattern found.', 'Designs 1 and 2 answer a quick request with <b>no</b> process switch. Design 3 pays <b>two process switches</b> per request, whether or not anyone has to wait.');
          }
          const player = ctx.ui.player({ count: LAB[design][scen].length, interval: 2300, render: (i) => {
            const list = LAB[design][scen];
            scene.set(design, scen, i);
            let ms = 0, ps = 0, cur = null;
            for (let f = 0; f <= i; f++) { const sg = list[f][0]; if (sg) { cur = sg; sg[3].forEach((m) => (m === 'M' ? ms++ : ps++)); } }
            const c = cpuOf(design, scen, cur);
            modeV.className = 'chip ' + (c.mode === 'user' ? 'proc' : 'os'); modeV.textContent = c.mode + ' mode';
            runV.textContent = c.run; stackV.textContent = c.stack;
            msV.textContent = ms; psV.textContent = ps;
            if (i === list.length - 1) results[design + scen] = [ms, ps];
            paintTable();
            return list[i][1];
          } });
          const restart = () => { player.stop(); player.setCount(LAB[design][scen].length); };
          const segD = ctx.ui.seg(DESIGNS.map((d) => ({ value: d.key, label: d.n + ' · ' + d.short })), design, (v) => { design = v; restart(); });
          const segS = ctx.ui.seg([{ value: 'quick', label: 'Quick answer: time of day' }, { value: 'wait', label: 'Must wait: disk read' }], scen, (v) => { scen = v; restart(); });
          el.append(h('div', { class: 'stack fill' },
            h('div', { class: 'row', style: { gap: '8px 18px' } },
              h('div', { class: 'row gap-s' }, h('span', { class: 'small b' }, 'Design'), segD),
              h('div', { class: 'row gap-s' }, h('span', { class: 'small b' }, 'Request'), segS)),
            h('div', { class: 'split r grow' },
              h('div', { class: 'stack' },
                h('div', { class: 'card white stack gap-s', style: { padding: '10px 12px' } }, scene.svg,
                  h('div', { class: 'row xs muted', style: { gap: '6px 16px' }, html: '<span><span class="chip proc">user mode</span></span><span><span class="chip os">kernel mode</span></span>'
                    + '<span><span class="mk m">M</span>mode switch</span><span><span class="mk p">P</span>process switch</span>' })),
                player.el),
              h('div', { class: 'stack' },
                h('div', { class: 'card tight stack gap-s' },
                  h('h4', { class: 'm0' }, 'The processor right now'),
                  h('div', { class: 'kv' }, h('span', {}, 'Mode'), h('span', {}, modeV), h('span', {}, 'Executing'), runV, h('span', {}, 'Stack in use'), stackV),
                  h('div', { class: 'ctr' },
                    h('div', {}, h('div', { class: 'xs b', html: '<span class="mk m">M</span>Mode switches' }), msV),
                    h('div', {}, h('div', { class: 'xs b', html: '<span class="mk p">P</span>Process switches' }), psV))),
                h('table', { class: 'tbl compact tally' },
                  h('thead', {}, h('tr', {}, h('th', {}, 'Design'), h('th', {}, SCEN.quick), h('th', {}, SCEN.wait))), tbody),
                insight))));
          paintTable();
        },
      },

      /* ---------------- 7. Trade-offs: sort the statements, unlock the summary ---------------- */
      {
        title: 'Trade-offs: which design is it?',
        kind: 'compare',
        render(el, ctx) {
          const { h } = ctx;
          /* [statement, design index, why] in a mixed order */
          const ITEMS = [
            ['The idea of a process applies only to user programs.', 0, 'In a nonprocess kernel the OS runs as a separate entity in kernel mode. It is never a process.'],
            ['Every process image contains a kernel stack as well as a user stack.', 1, 'OS routines run inside the process, so each process needs its own stack for kernel-mode calls.'],
            ['Every request for an OS service means a switch to a service process and a switch away from it.', 2, 'Services live in system processes, so reaching one takes process switches. That is design 3’s overhead.'],
            ['The kernel keeps a single system stack in its own region of memory.', 0, 'The nonprocess kernel has its own memory and its own stack, separate from every process.'],
            ['OS code and data sit in a region that appears in every process’s address space.', 1, 'That region is the shared address space. It leads to one physical copy and is usable only in kernel mode.'],
            ['The OS is forced into modules with small, clean interfaces.', 2, 'Each function is a separate process that others can reach only through requests, so modularity is built in.'],
            ['A system call runs OS code inside the caller’s own process: a mode switch, no process switch.', 1, 'The caller stays the running process; only the processor mode changes.'],
            ['The traditional approach, found in many older operating systems.', 0, 'Running the kernel outside every process is the classic design.'],
            ['A usage monitor can run at its own low priority, interleaved with other work by the dispatcher.', 2, 'As a process, a noncritical job gets its own priority and runs when the dispatcher allows.'],
            ['Common on smaller machines such as PCs and workstations.', 1, 'Running the OS inside user processes is the usual choice there, because it avoids process switches.'],
            ['Some OS services can be moved onto processors dedicated to them.', 2, 'Separate processes can be placed on separate processors, or other machines of a multicomputer.'],
            ['Apart from a little switching code, OS functions are scheduled just like user programs.', 2, 'System processes are dispatched like any other process; only the switching code sits outside them.'],
          ];
          let k = 0, tries = 0;
          const marks = [];
          const stmt = h('div', { class: 'stmt' });
          const counter = h('h4', { class: 'm0' });
          const fb = h('div', { class: 'msg', style: { minHeight: '84px' } });
          const dots = h('div', { class: 'dots' }, ...ITEMS.map(() => h('i')));
          const nextBtn = h('button', { class: 'btn primary sm', type: 'button', style: { visibility: 'hidden' }, onclick: () => {
            if (k >= ITEMS.length) { k = 0; marks.length = 0; } else k++;
            show();
          } }, 'Next statement →');
          const bins = DESIGNS.map((d, i) => h('button', { class: 'btn', type: 'button', onclick: () => choose(i) }, d.n + ' · ' + d.short));
          const table = h('div', { class: 'tradeoff veiled' });
          function show() {
            tries = 0;
            nextBtn.style.visibility = 'hidden';
            nextBtn.textContent = 'Next statement →';
            bins.forEach((b) => { b.classList.remove('right', 'wrong'); b.disabled = false; });
            [...dots.children].forEach((d, i) => { d.className = marks[i] || (i === k ? 'cur' : ''); });
            if (k >= ITEMS.length) {
              const first = marks.filter((m) => m === 'ok').length;
              counter.textContent = 'All 12 sorted';
              stmt.innerHTML = `<span>${first} of 12 right on the first try. The summary on the right is unlocked.</span>`;
              say(fb, 'ok', 'Done.', 'Read across each row of the summary: no design wins every row. That is why it is called a trade-off.');
              bins.forEach((b) => (b.disabled = true));
              nextBtn.textContent = 'Sort again';
              nextBtn.style.visibility = 'visible';
              unveil();
              return;
            }
            counter.textContent = `Statement ${k + 1} of ${ITEMS.length}`;
            stmt.textContent = ITEMS[k][0];
            say(fb, '', 'Pick a design.', 'Every statement fits exactly one of the three.');
          }
          function choose(i) {
            if (k >= ITEMS.length || nextBtn.style.visibility === 'visible') return;  /* finished, or waiting for Next */
            const [, ans, why] = ITEMS[k];
            tries++;
            if (i === ans) {
              bins[i].classList.add('right');
              marks[k] = tries === 1 ? 'ok' : 'late';
              dots.children[k].className = marks[k];
              say(fb, 'ok', 'Yes: ' + DESIGNS[ans].name + '.', why);
              nextBtn.style.visibility = 'visible';
            } else {
              bins[i].classList.add('wrong');
              bins[i].disabled = true;
              say(fb, 'bad', 'Not that one.', 'Think about where the OS code runs in design ' + (i + 1) + ', and whether this statement really describes it. Try another.');
            }
          }
          const ROWS = [
            ['Where OS code runs', 'Outside every process', 'Inside the calling process', 'In system processes'],
            ['Switch overhead', '<span class="good">Low:</span> 2 mode switches per request', '<span class="good">Low:</span> 2 mode switches per request', '<span class="cost3">Higher:</span> plus 2 process switches'],
            ['Waiting request’s progress', 'Recorded in kernel tables', 'Left on the caller’s kernel stack', 'Held by the service process'],
            ['Modularity', 'Up to the designers', 'Up to the designers', '<span class="good">Enforced</span> by process boundaries'],
            ['Protecting OS code', 'Separate kernel memory, kernel mode only', 'Shared region, locked outside kernel mode', 'Kernel mode; parts in separate address spaces'],
            ['Many processors', 'Runs on whichever processor entered it', 'Runs on the caller’s processor', '<span class="good">Services can get</span> dedicated processors'],
          ];
          function unveil() { table.classList.remove('veiled'); const v = table.querySelector('.veil'); if (v) v.remove(); }
          table.append(
            h('table', { class: 'tbl compact' },
              h('thead', {}, h('tr', {}, h('th', {}, ''), ...DESIGNS.map((d) => h('th', {}, d.n + ' · ' + d.short)))),
              h('tbody', {}, ...ROWS.map((r) => h('tr', {}, ...r.map((c) => h('td', { html: c })))))),
            h('div', { class: 'veil' }, h('div', { class: 'stack gap-s' },
              h('span', { class: 'small b' }, 'Sort all 12 statements to unlock this summary.'),
              h('button', { class: 'btn sm', type: 'button', onclick: unveil }, 'Show it now'))));
          show();
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'card stack' }, counter, stmt, h('div', { class: 'bins' }, ...bins), fb,
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, dots, nextBtn),
              h('div', { class: 'callout tip', 'data-label': 'Two questions settle most of them', style: { margin: 'auto 0 0' }, html: 'Where does the OS code run: outside every process, inside the caller, or in a process of its own? And does asking for a service switch processes?' })),
            h('div', { class: 'stack' },
              h('h3', { class: 'm0' }, 'The trade-off at a glance'),
              table,
              h('div', { class: 'callout why m0 small', 'data-label': 'In real systems', html: 'Designs are often mixed. UNIX, the subject of the next section, runs most OS code inside user processes and also keeps a few system processes for background jobs.' }))));
        },
      },

      /* ---------------- 8. Recap ---------------- */
      {
        title: 'Recap: six ideas to carry with you',
        kind: 'recap',
        render(el, ctx) {
          const { h } = ctx;
          const cards = ctx.ui.flipcards([
            ['Is the OS a process?', 'It depends on the design. The three standard answers: a nonprocess kernel, execution within user processes, and a process-based OS.'],
            ['Nonprocess kernel', 'The kernel runs outside every process, with its own memory and system stack; only user programs are processes. On a supervisor call the caller’s context is saved, then the kernel resumes it or dispatches another.'],
            ['Execution within user processes', 'OS routines run inside the calling process in kernel mode. Each image adds a kernel stack and the shared address space: one physical copy of the OS.'],
            ['Mode switch, not process switch', 'In design 2 a system call only changes the mode; the same process keeps running. If a switch is needed, a small routine may run outside all processes.'],
            ['Process-based OS', 'OS functions are system processes. Gains: modularity, noncritical jobs at their own priority, services on dedicated processors. Price: process switches.'],
            ['So which design wins?', 'None outright. Designs 1 and 2 serve a request without a process switch; design 3 pays process switches for modularity and flexibility on many processors. Real systems mix them.'],
          ], { cols: ctx.narrow ? 1 : 3, height: ctx.narrow ? 130 : 172 });
          el.append(h('div', { class: 'stack fill' },
            h('p', { class: 'lead m0' }, 'Say each answer out loud before you flip the card. The strip below is the whole section in one picture.'),
            cards,
            h('div', { class: 'grid-3', style: { marginTop: 'auto' } }, ...DESIGNS.map((d, i) => h('div', { class: 'card tight row nw', style: { gap: '12px' } },
              h('div', { style: { width: '150px', flex: 'none' } }, sketch(ctx, d.n)),
              h('div', { class: 'small', html: `<b>${d.n} · ${d.name}</b><br><span class="muted">${['OS outside every process', 'OS inside the caller, in kernel mode', 'OS functions as processes'][i]}</span>` }))))));
        },
      },

      /* ---------------- 9. Check yourself ---------------- */
      {
        title: 'Check yourself',
        kind: 'check',
        quiz: [
          { q: 'In a <b>nonprocess kernel</b>, what happens when the running process issues a supervisor call?',
            choices: ['The OS creates a new process to handle the call, and the dispatcher schedules that process.',
              'The kernel’s code runs inside the calling process, on that process’s own kernel stack.',
              'The process’s context is saved and the kernel takes over, outside any process, on its system stack.',
              'The call waits in the Ready queue until the kernel’s turn on the processor comes round.'],
            answer: 2,
            feedback: ['That describes a process-based OS, where services are processes. A nonprocess kernel is not a process at all.',
              'That is the “execution within user processes” design, where OS routines run inside the caller.',
              null,
              'The kernel is never scheduled like a process. It takes control at once, through the mode switch.'],
            why: 'In the nonprocess design the OS is a separate entity running in kernel mode, with its own memory region and system stack. The idea of a process applies only to user programs.' },
          { q: 'When the OS executes within user processes, why does each process image contain its own <b>kernel stack</b>, separate from its user stack?',
            choices: ['It holds that process’s private copy of the OS code, so that processes cannot interfere with each other’s OS.',
              'It gives kernel-mode calls a stack the user program cannot touch, and a system call that must wait can leave its half-finished kernel work there while other processes run.',
              'It stores the process control block while the process is running, and the user stack stores it while the process is waiting.',
              'It lets a system call run without any mode switch, because the kernel stack is already in kernel mode.'],
            answer: 1,
            feedback: ['There is only one copy of the OS code, in the shared address space that every process maps. A kernel stack holds call frames, not code.',
              null,
              'The PCB is a separate part of the image, kept by the OS whether or not the process is running. Neither stack stores it.',
              'Every entry into the OS still needs a mode switch into kernel mode; the kernel stack is simply where the OS routine’s calls are recorded once it is there.'],
            why: 'OS routines run inside the process, so their calls need a stack. Keeping it apart from the user stack protects the kernel’s frames, and because every process has one, the OS can pause a system call halfway (the process is Blocked) and resume it later from exactly that point.' },
          { type: 'multi', q: 'When the OS executes within user processes, which of these belong to each process image? Select all that apply.',
            choices: ['Process control block', 'User stack', 'Private user address space (program and data)', 'Kernel stack', 'Shared address space holding OS code and data', 'A private copy of all the OS code, stored separately for that process'],
            answer: [0, 1, 2, 3, 4],
            why: 'Each image has a PCB, a user stack, its private program and data, a kernel stack for kernel-mode calls, and the shared address space. That shared region leads to one physical copy of the OS, so the OS code is never duplicated.' },
          { type: 'bucket', q: 'Sort each feature into the design it describes.', buckets: ['Separate kernel', 'Inside user processes', 'OS as processes'],
            items: [['Only user programs are processes', 0], ['A kernel stack in every process', 1],
              ['OS code mapped into every process’s address space', 1], ['Kernel functions are processes', 2],
              ['A usage monitor as a process', 2]],
            why: 'Design 1 keeps the kernel outside every process. Design 2 runs OS routines inside each process, so each image carries a kernel stack and the shared region. Design 3 turns OS functions into processes, which also suits noncritical jobs like monitoring.' },
          { type: 'num', q: 'A process-based OS handles 40,000 service requests per second. Each request costs 2 mode switches and 2 process switches. A mode switch takes 0.5 µs and a process switch takes 4 µs. How many <b>milliseconds</b> of processor time per second go to switching?',
            answer: 360, tol: 1, unit: 'ms',
            why: 'Per request: 2 × 0.5 + 2 × 4 = 9 µs. Then 40,000 × 9 µs = 360,000 µs = 360 ms, over a third of one processor.' },
          { type: 'num', q: 'An OS that executes within user processes handles 40,000 quick service requests per second. Each costs 2 mode switches of 0.5 µs and no process switch. How many <b>milliseconds</b> of processor time per second go to switching?',
            answer: 40, tol: 0.5, unit: 'ms',
            why: 'Per request: 2 × 0.5 = 1 µs. Then 40,000 × 1 µs = 40,000 µs = 40 ms, about 4% of one processor.' },
          { q: 'Which of these is <b>not</b> an advantage of building the OS as a collection of system processes?',
            choices: ['It encourages a modular design with small, clean interfaces between parts.',
              'Noncritical functions, such as a resource-usage monitor, can run as processes at their own priority.',
              'Some OS services can be moved onto dedicated processors of a multiprocessor.',
              'Each request for an OS service becomes cheaper, because no process switch is needed to reach it.'],
            answer: 3,
            feedback: ['This is a genuine advantage: separate processes can only talk through defined interfaces.',
              'This is a genuine advantage: as a process, the monitor is scheduled and interleaved like any other.',
              'This is a genuine advantage: a service process can live on its own processor, which improves performance.', null],
            why: 'The opposite is true. Reaching a service that lives in another process costs process switches, which is the main overhead of this design.' },
          { type: 'order', q: 'Put these events in order for a quick system call when the OS executes within user processes.',
            items: ['P1 runs its program in user mode', 'P1 executes the system-call instruction', 'The processor switches to kernel mode (a mode switch)', 'The OS routine runs inside P1, using P1’s kernel stack', 'The processor returns to user mode and P1 continues'],
            why: 'The call enters kernel mode, the OS routine runs in the context of P1 on its kernel stack, and a second mode switch returns to P1’s program. No process switch occurs.' },
          { type: 'match', q: 'Match each stack to the moment it is in use.',
            pairs: [['User stack', 'A process is running its own program in user mode'], ['Kernel stack', 'A process is running an OS routine in kernel mode'],
              ['The kernel’s own system stack', 'A nonprocess kernel is working outside every process'], ['A system process’s stack', 'An OS function packaged as its own process is running']],
            why: 'Design 1 keeps one system stack for the kernel. Design 2 gives every process a user stack and a kernel stack. In design 3 each system process has a stack of its own, like any process.' },
          { type: 'tf', q: 'When the OS executes within user processes, a user program can change the OS code, because that code is mapped into its address space.', answer: false,
            why: 'The shared address space can be used only in kernel mode. In user mode the hardware blocks every access, so the OS is protected even though it appears in every address space.' },
          { type: 'tf', q: 'When the OS executes within user processes and a process switch turns out to be necessary, the small routine that performs the switch may run outside all processes.', answer: true,
            why: 'Depending on the system, the switching routine may or may not start in the current process. But while it takes the processor from one process and gives it to another it belongs to neither, so it is most natural to view it as running outside all processes.' },
          { type: 'multi', q: 'Which statements about a mode switch are true? Select all that apply.',
            choices: ['It changes the processor between user mode and kernel mode.', 'The same process remains the running process.', 'It requires switching the memory map to another process’s memory.', 'It costs much less than a process switch.'],
            answer: [0, 1, 3],
            why: 'A mode switch flips the processor’s mode and saves a little state. Changing the memory map belongs to a process switch, which is why a process switch costs so much more.' },
        ],
      },

    ],
    notes: `
<h3>The puzzle: is the operating system a process?</h3>
<p>The OS is software: the processor fetches and executes its instructions just as it does a user program’s. Yet the OS also manages processes: it creates, schedules and switches them. So where does OS code run, and is the OS itself a process? Three standard designs give different answers:</p>
<ol>
<li><b>Nonprocess kernel</b>: the kernel runs outside every process.</li>
<li><b>Execution within user processes</b>: OS routines run inside whichever user process needs them.</li>
<li><b>Process-based OS</b>: the OS itself is built from system processes.</li>
</ol>
<p>Analogy (an apartment building): the staff work from a basement office (1), work inside your apartment from a locked service closet that every apartment has (2), or are specialists in offices of their own that you send requests to (3).</p>

<h3>Design 1: the nonprocess kernel</h3>
<p>The traditional approach, used by many older operating systems. The kernel runs <b>outside of any process</b>, as a separate entity in privileged (kernel) mode, with its <b>own region of memory</b> and its <b>own system stack</b> for procedure calls and returns. The idea of a process applies <b>only to user programs</b>: the kernel has no PCB, no state and is never scheduled.</p>
<p>On an interrupt, a trap or a supervisor call, the processor switches to kernel mode (a mode switch), the running process’s context is saved, and control passes to the kernel. The process is still in the Running state: a mode switch changes no process’s state. Then:</p>
<ul>
<li><b>Service finishes at once</b> (data already in memory): the kernel does the work and restores the same process. Cost: 2 mode switches, 0 process switches.</li>
<li><b>Process must wait</b> (data must come from disk): the kernel starts the I/O, marks the process Blocked, and its dispatcher loads the context of a Ready process. Cost: 2 mode switches, 1 process switch.</li>
</ul>
<p>Because one system stack serves every request, the kernel cannot leave a waiting request’s half-done work on it. That progress is recorded in kernel tables instead (the process table, the device’s request list).</p>

<h3>Design 2: execution within user processes</h3>
<p>Common on smaller machines such as PCs and workstations. Virtually all OS software runs <b>in the context of a user process</b>: the OS is a collection of routines that programs call, and each routine runs within the calling process, in kernel mode. Each process image therefore contains:</p>
<table>
<tr><th>Part</th><th>What it holds, and when it is used</th></tr>
<tr><td>Process control block</td><td>Identification, processor state, process control information. Touched only by OS code in kernel mode.</td></tr>
<tr><td>User stack</td><td>Frames of the program’s own calls, in user mode.</td></tr>
<tr><td>Private user address space</td><td>The process’s own program and data; no other process can reach it.</td></tr>
<tr><td>Kernel stack</td><td>Frames of OS calls made in kernel mode, kept apart from the user stack so the program cannot touch them. A system call that must wait leaves its unfinished work here.</td></tr>
<tr><td>Shared address space</td><td>OS code and data, present in every address space but mapped to <b>one</b> physical copy. Usable only in kernel mode, so user programs cannot tamper with it.</td></tr>
</table>
<p>An interrupt, trap or supervisor call causes a <b>mode switch, not a process switch</b>: the same process stays Running, now executing OS code. If the OS then lets the process continue, another mode switch resumes it (quick request: 2 mode, 0 process switches). If a process switch is needed, control passes to a small process-switching routine. It may or may not start in the current process, but while it hands the processor over it is best viewed as running <b>outside all processes</b> (request that must wait: 2 mode, 1 process switch).</p>
<h3>Why a mode switch is cheap</h3>
<p>A mode switch flips the mode bit, saves a few registers and changes stacks; no process changes state. A process switch saves a whole context, updates PCBs and queues and changes the memory map, and the new process starts with caches full of the old one’s data.</p>
<p><b>Cost model:</b> switching time per second = requests per second × (switches per request × time per switch).</p>
<p><i>Worked example</i> (illustrative prices): 50,000 requests/s, mode switch 0.2 µs, process switch 3 µs.</p>
<ul>
<li>Designs 1 and 2: 50,000 × (2 × 0.2) µs = 20,000 µs = <b>20 ms per second</b> (2% of one processor).</li>
<li>Design 3: 50,000 × (2 × 0.2 + 2 × 3) µs = 320,000 µs = <b>320 ms per second</b> (32%).</li>
</ul>
<p>Designs 1 and 2 tie on switch count; they differ in where a waiting request’s progress lives (kernel tables versus the caller’s kernel stack).</p>

<h3>Design 3: the process-based operating system</h3>
<p>The OS is a <b>collection of system processes</b>. Major kernel functions (file system, memory manager, I/O manager and so on) are separate processes that run in kernel mode and are scheduled by the dispatcher like any other process. Only a <b>small amount of process-switching code</b> runs outside all processes. Advantages:</p>
<ol>
<li><b>Modular design</b>: each function lives in its own process, with minimal, clean interfaces to the rest.</li>
<li><b>Noncritical functions</b> fit neatly as processes, e.g. a monitor that records how busy the processor, memory and I/O channels are and how fast user processes progress. No process requests a service from it, so as a process it runs at its own priority, interleaved with other work by the dispatcher.</li>
<li><b>Multiprocessor and multicomputer fit</b>: some OS services can be moved to dedicated processors (or machines), improving performance.</li>
</ol>
<p>The price: reaching a service in another process costs process switches. A quick request costs 2 mode + 2 process switches; a request that must wait also costs 2 before another user process runs, and more when the I/O completes.</p>

<h3>Side by side</h3>
<table>
<tr><th></th><th>Nonprocess kernel</th><th>Within user processes</th><th>Process-based OS</th></tr>
<tr><td>Where OS code runs</td><td>Outside every process</td><td>Inside the calling process</td><td>In system processes</td></tr>
<tr><td>Stacks the OS uses</td><td>One system stack</td><td>A kernel stack per process</td><td>Each system process’s own stack</td></tr>
<tr><td>Quick request</td><td>2 mode, 0 process</td><td>2 mode, 0 process</td><td>2 mode, 2 process</td></tr>
<tr><td>Request that must wait</td><td>2 mode, 1 process</td><td>2 mode, 1 process</td><td>2 mode, 2 process</td></tr>
<tr><td>Waiting request’s progress</td><td>Kernel tables</td><td>Caller’s kernel stack</td><td>Inside the service process</td></tr>
<tr><td>Modularity</td><td>Up to the designers</td><td>Up to the designers</td><td>Enforced by process boundaries</td></tr>
<tr><td>Protecting OS code</td><td>Separate kernel memory, kernel mode only</td><td>Shared region, locked outside kernel mode</td><td>Kernel mode; parts in separate address spaces</td></tr>
<tr><td>Many processors</td><td>Runs on whichever processor entered it</td><td>Runs on the caller’s processor</td><td>Services can get dedicated processors</td></tr>
</table>
<p>No design wins every row: switch overhead trades against modularity and flexibility. Real systems mix designs; UNIX (next section) runs most OS code inside user processes and also keeps a few system processes for background work.</p>
    `,
  });
})();
