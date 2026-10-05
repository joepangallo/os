// Comment key: a line inside backtick text ends with ${/* comment */''}, an empty-string slot that holds a comment without changing the text on screen (full note at the top of the page).
/* Section 7.2 Memory Partitioning
   Original teaching material. Helpers live in this IIFE so nothing leaks into the global scope. */
(() => {  // wraps the whole section in a function that runs once, right away, so its helper names stay private to this file
  /* An SVG group that behaves like a button: click, keyboard (Enter/Space) and the checker's synthetic pointerdown. */
  function hotGroup(ctx, onAct, label, ...kids) {  // hotGroup(ctx, onAct, label, ...kids): bundles drawn shapes into one clickable SVG (the browser's drawing format) group
    const g = ctx.s('g', { class: 'hot', tabindex: 0, role: 'button', 'aria-label': label }, ...kids);  // builds the group: class hot gives it a pointer cursor, tabindex 0 lets Tab reach it, role and label tell screen readers it is a button
    g.addEventListener('click', onAct);  // a mouse click or tap on the group runs the action onAct
    g.addEventListener('pointerdown', (e) => { if (!e.isTrusted) onAct(); });  // a pointerdown made by a script (not a real hand, so isTrusted is false) also runs it, which lets the automatic page checker press it
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAct(); } });  // Enter or Space runs the action from the keyboard; preventDefault stops Space from scrolling the page
    return g;  // hands the finished group back to the caller
  }  // ends hotGroup
  const fmtN = (n) => Number(n).toLocaleString('en-US');  // fmtN(n): writes a number with thousands commas (76000 becomes 76,000) for the base and bounds step
  /* 'a' or 'an' before a number read aloud: an 8, an 11, an 18, an 80-something. */
  const art = (n) => (/^(8|11|18)(\D|$)|^8/.test(String(n)) ? 'an' : 'a');  // art(n): chooses "an" for numbers that start with an 8 sound or are 11 or 18, and "a" for every other number
  const Art = (n) => (art(n) === 'an' ? 'An' : 'A');  // Art(n): the same choice with a capital letter, for the start of a sentence

  /* Draws one horizontal memory bar into SVG elements.
     o: { x, y, w, hgt, total, blocks: [{ start, size, kind: 'os'|'proc'|'hole', label, sub, cls, act, hl }], ticks }
     Labels are dropped when a block is too slim for them, so the same code serves desktop and phone widths. */
  function memBar(ctx, o) {  // memBar(ctx, o): draws one horizontal strip of memory and returns its pieces; steps 4, 5 and 6 all reuse it
    const { s } = ctx, px = o.w / o.total, out = [], hgt = o.hgt || 44;  // s builds SVG shapes; px is how many screen pixels one MB takes; out collects the pieces; the bar is 44 pixels tall by default
    for (const b of o.blocks) {  // draws each block (OS, process or free hole) in turn
      const x = o.x + b.start * px, w = b.size * px;  // x is where the block starts on screen and w how wide it is, both scaled from MB to pixels
      const cls = b.cls || (b.kind === 'os' ? 's-os' : b.kind === 'proc' ? 's-proc' : 's-hole');  // picks the fill style: a caller's own class if given, otherwise purple for the OS, teal for a process, dashed for a hole
      const kids = [s('rect', { x, y: o.y, width: w, height: hgt, class: cls, 'stroke-width': b.hl ? 3 : 1.5, style: b.hl ? 'stroke:var(--accent)' : null })];  // the block's rectangle; a highlighted block (hl) gets a thicker outline in the accent color
      const lab = b.label != null ? String(b.label) : '', sub = b.sub != null ? String(b.sub) : '';  // the main label and the smaller second line, turned into text (empty when the block has none)
      const fits = (str, fs) => str.length * fs * 0.62 + 6 <= w;  // fits(str, fs): estimates whether a text at font size fs fits inside this block's width, with a little room to spare
      if (lab && fits(lab, 13)) kids.push(s('text', { x: x + w / 2, y: o.y + (sub && fits(sub, 12) ? hgt / 2 - 2 : hgt / 2 + 5), 'text-anchor': 'middle', 'font-size': 13, 'font-weight': b.kind === 'hole' ? 400 : 800, class: b.kind === 'hole' ? 's-sub' : b.kind === 'os' ? 'tx-os' : null }, lab));  // draws the main label centered in the block if it fits: higher up when a second line follows, grey and normal weight for a hole
      if (sub && fits(sub, 12)) kids.push(s('text', { x: x + w / 2, y: o.y + hgt / 2 + 14, 'text-anchor': 'middle', 'font-size': 12, class: 's-sub' }, sub));  // draws the smaller second line (such as the size in MB) under the label, again only if it fits
      out.push(b.act ? hotGroup(ctx, b.act, b.aria || lab, ...kids) : s('g', {}, ...kids));  // a block with an action (act) becomes a clickable hotGroup, for example to end a process; any other block is a plain group
    }  // ends the loop over blocks
    out.push(s('rect', { x: o.x, y: o.y, width: o.w, height: hgt, fill: 'none', class: 's-line', 'stroke-width': 2 }));  // a thick outline around the whole memory strip, drawn on top so the edges stay crisp
    for (const tk of o.ticks || []) {  // draws the optional scale marks (ticks) under the strip, each at an MB position
      const x = o.x + tk * px;  // the screen position of this tick
      out.push(s('line', { x1: x, x2: x, y1: o.y + hgt, y2: o.y + hgt + 5, class: 's-line', 'stroke-width': 1.2 }),  // a short vertical tick line hanging below the strip
        s('text', { x, y: o.y + hgt + 18, 'text-anchor': 'middle', 'font-size': 12, class: 's-sub' }, String(tk)));  // the MB number written under the tick
    }  // ends the loop over ticks
    return out;  // hands back every piece, ready to be placed in an SVG
  }  // ends memBar
  /* Free holes of a block list (sorted by start) inside [lo, total). */
  function holesOf(procs, lo, total) {  // holesOf(procs, lo, total): lists the free stretches of memory between lo (the end of the OS) and the top of memory
    const out = []; let a = lo;  // out collects the holes; a is a cursor that walks up through memory, starting just after the OS
    for (const p of procs.slice().sort((x, y) => x.start - y.start)) { if (p.start > a) out.push({ start: a, size: p.start - a }); a = Math.max(a, p.start + p.size); }  // visits the processes in address order: a gap before a process is a hole; then the cursor jumps to that process's end
    if (a < total) out.push({ start: a, size: total - a });  // whatever lies between the last process and the top of memory is one more hole
    return out;  // hands back the list of holes, each with a start and a size
  }  // ends holesOf

  /* Placement race engine (step 6). Pure functions, so the page and a test script can share them. */
  const RACE = { OS: 8, TOTAL: 128, N: 24, MIN: 4, MAX: 20, LMIN: 3, LSPAN: 10 };  // RACE: the race settings: 8 MB OS, 128 MB memory, 24 requests of 4 to 20 MB, each staying 3 to 12 time steps
  function raceSeq(rnd) {  // raceSeq(rnd): makes the list of 24 requests for one race, using rnd so the same sequence number always gives the same list
    return Array.from({ length: RACE.N }, (_, i) => ({ id: i + 1, size: RACE.MIN + Math.floor(rnd() * (RACE.MAX - RACE.MIN + 1)), life: RACE.LMIN + Math.floor(rnd() * RACE.LSPAN) }));  // each request gets an id (1 to 24), a random size from 4 to 20 MB and a random lifetime from 3 to 12 steps
  }  // ends raceSeq
  function raceNew() { return { procs: [], ptr: RACE.OS, comp: 0, moved: 0, exam: 0, rej: 0, tiny: 0, tinyMB: 0, last: null }; }  // raceNew(): a fresh memory for one algorithm: no processes, the next-fit pointer just past the OS, and every counter at zero
  /* Choose a hole for `size` with algorithm alg; counts every hole examined. */
  function racePick(st, alg, holes, size) {  // racePick(st, alg, holes, size): returns the hole that algorithm alg would choose for a request, counting each hole it looks at
    if (alg === 'first') { for (const g of holes) { st.exam++; if (g.size >= size) return g; } return null; }  // first-fit: looks at the holes from the bottom of memory and returns the first one big enough
    if (alg === 'best') { let b = null; for (const g of holes) { st.exam++; if (g.size >= size && (!b || g.size < b.size)) b = g; if (g.size === size) break; } return b; }  // best-fit: looks at every hole and keeps the smallest one big enough, stopping early only on an exact fit
    const k0 = Math.max(0, holes.findIndex((g) => g.start + g.size > st.ptr));  // next-fit: k0 is the first hole that ends after the pointer, where the last placement stopped (or the first hole if none)
    for (let j = 0; j < holes.length; j++) { const g = holes[(k0 + j) % holes.length]; st.exam++; if (g.size >= size) return g; }  // from there it looks at the holes in turn, wrapping round to the bottom of memory, and returns the first one big enough
    return null;  // no hole is big enough for this algorithm
  }  // ends racePick
  /* Time step t: processes whose time is up leave, then request req arrives and is placed (compacting first if needed). */
  function raceStep(st, alg, req, t) {  // raceStep(st, alg, req, t): plays one time step of the race for one algorithm
    st.procs = st.procs.filter((p) => p.end > t);  // first removes the processes whose lifetime has run out by time t, freeing their memory
    let holes = holesOf(st.procs, RACE.OS, RACE.TOTAL), g = racePick(st, alg, holes, req.size), moved = 0;  // works out the holes and asks the algorithm for one; moved will count the MB copied if compaction is needed
    if (!g) {  // no hole was big enough...
      const free = holes.reduce((a, x) => a + x.size, 0);  // ...so it adds up all the free memory
      if (free < req.size) { st.rej++; st.last = { kind: 'rej', req }; return; }  // if even the total is too small, the request is turned away: counted, recorded for the status line, and the step ends
      let a = RACE.OS;  // otherwise it compacts: a is where the next process will be slid to, starting just after the OS
      st.procs = st.procs.slice().sort((x, y) => x.start - y.start).map((p) => { const q = { ...p, start: a }; if (q.start !== p.start) moved += p.size; a += p.size; return q; });  // slides every process down in address order so they sit side by side, adding up the MB of each one that actually moves
      st.comp++; st.moved += moved; st.ptr = a;  // counts one more compaction and the MB moved; the next-fit pointer goes to the start of the one big free block
      holes = holesOf(st.procs, RACE.OS, RACE.TOTAL); g = racePick(st, alg, holes, req.size);  // recomputes the holes and asks the algorithm again; now the request is sure to fit
    }  // ends the compaction case
    st.procs.push({ id: req.id, start: g.start, size: req.size, end: t + req.life });  // places the request at the start of the chosen hole, with the time step when it will leave
    st.ptr = g.start + req.size;  // the next-fit pointer moves to just past the new process, where the next search will begin
    const left = g.size - req.size;  // left is the free space that remains in the chosen hole
    if (left > 0 && left < RACE.MIN) { st.tiny++; st.tinyMB += left; }  // a leftover above zero but under 4 MB is a sliver (too small for any request); it is counted with its size
    st.last = { kind: moved ? 'comp' : 'ok', req, hole: g.size, at: g.start, moved, left };  // records what happened (placed, or compacted then placed) so the status line beside the memory can describe it
  }  // ends raceStep


  Guide.section({  // registers this section with the guide; the object below holds everything the section shows
    id: '7.2',  // the section number, used in links, the progress list and saved progress
    title: 'Memory Partitioning',  // the full title shown at the top of every step
    short: 'Partitioning',  // the short name used in the side menu and progress list
    summary: 'Fixed and dynamic partitions, first/best/next-fit placement, the buddy system, and base-bounds relocation.',  // one-sentence summary shown on the chapter page
    objectives: [  // what the student should be able to do after this section, shown on its first page
      'Explain fixed partitioning with equal and unequal partitions, and identify internal fragmentation and the need for overlays.',  // objective 1: fixed partitions, internal fragmentation and overlays
      'Compare one queue per partition with a single queue, and choose which process to swap out when every partition is full.',  // objective 2: the two queue designs and choosing a process to swap out
      'Run dynamic partitioning by hand, recognise external fragmentation, and explain what compaction fixes and what it costs.',  // objective 3: dynamic partitioning, external fragmentation and compaction
      'Apply the first-fit, best-fit and next-fit placement algorithms and describe how each tends to behave.',  // objective 4: the three placement algorithms
      'Allocate and free blocks in a buddy system, and translate a relative address with base and bounds registers.',  // objective 5: the buddy system and base and bounds translation
    ],  // closes the objectives list
    terms: [  // key terms for the glossary, each written as [term, definition]
      ['Partition', 'One contiguous region of main memory set aside to hold a single process.'],  // glossary entry: partition
      ['Fixed partitioning', 'A scheme in which memory outside the OS is cut into partitions when the system starts; their number and sizes never change while it runs.'],  // glossary entry: fixed partitioning
      ['Overlay', 'A programming technique for a program too big for its memory space: the programmer splits it into modules that take turns occupying the same region, loading each when it is needed.'],  // glossary entry: overlay
      ['Internal fragmentation', 'Wasted memory inside an allocated partition or block, because the block handed out is bigger than what was loaded into it.'],  // glossary entry: internal fragmentation
      ['Dynamic partitioning', 'A scheme in which partitions are created as processes arrive, each one exactly as large as the process that needs it.'],  // glossary entry: dynamic partitioning
      ['Hole', 'A stretch of free memory lying between allocated regions.'],  // glossary entry: hole
      ['External fragmentation', 'Free memory broken into many separate holes between allocated regions, so that a request can fail even though the holes add up to enough space.'],  // glossary entry: external fragmentation
      ['Compaction', 'The OS slides the processes in memory together so that they sit side by side and all the free memory forms one single block.'],  // glossary entry: compaction
      ['Dynamic relocation', 'Turning a program’s addresses into physical addresses while it runs, on every reference, so the process can be moved to a new place in memory at any time.'],  // glossary entry: dynamic relocation
      ['Placement algorithm', 'The rule the OS uses to choose which free block of memory a new process is put into.'],  // glossary entry: placement algorithm
      ['First-fit', 'A placement algorithm that scans memory from the beginning and takes the first free block big enough for the request.'],  // glossary entry: first-fit
      ['Best-fit', 'A placement algorithm that takes the free block closest in size to the request, so the leftover is as small as possible.'],  // glossary entry: best-fit
      ['Next-fit', 'A placement algorithm that starts scanning where the previous placement ended and takes the next free block big enough for the request.'],  // glossary entry: next-fit
      ['Buddy system', 'An allocator whose blocks are always a power of two in size: a block is halved into two buddies until it just fits a request, and two free buddies are merged back into one block.'],  // glossary entry: buddy system
      ['Buddies', 'The two equal halves produced by splitting one block of size 2<sup>K</sup>; only these two partners may later merge back together.'],  // glossary entry: buddies (the two halves of one split block)
      ['Relative address', 'A logical address expressed as a distance from a known point, usually the start of the program.'],  // glossary entry: relative address
      ['Base register', 'A processor register loaded with the starting physical address of the running process; it is added to every relative address.'],  // glossary entry: base register
      ['Bounds register', 'A processor register loaded with the physical address where the running process’s partition ends (the first address past its last byte); any translated address at or beyond it causes an interrupt to the OS.'],  // glossary entry: bounds register
    ],  // closes the glossary terms list
    css: ` /* css: this section's own style rules; the .sec-7-2 prefix makes each rule apply only inside this section's steps */
      .sec-7-2 .hot { cursor: pointer; } /* clickable drawing parts (hotGroup) show a pointing-hand cursor so students know they can click them */
      .sec-7-2 .hot:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; } /* a clickable drawing part reached with the Tab key gets an accent outline, so keyboard users can see where they are */
      .sec-7-2 .tx-ok { fill: var(--ok); } .sec-7-2 .tx-bad { fill: var(--bad); } .sec-7-2 .tx-warn { fill: var(--warn); } /* text colors for drawings: green for success, red for errors, amber for warnings */
      .sec-7-2 .tx-proc { fill: var(--proc); } .sec-7-2 .tx-os { fill: var(--os); } .sec-7-2 .tx-mem { fill: var(--mem); } /* more drawing text colors: teal for processes, purple for the OS, green for memory */
      .sec-7-2 .tx-acc { fill: var(--accent); } .sec-7-2 .tx-cpu { fill: var(--cpu); } /* drawing text in the accent indigo (the next-fit label) or the processor blue */
      .sec-7-2 .c-ok { color: var(--ok); } .sec-7-2 .c-bad { color: var(--bad); } .sec-7-2 .c-warn { color: var(--warn); } /* the same success, error and warning colors for ordinary page text, used in the captions and tables */
      .sec-7-2 .c-proc { color: var(--proc); } .sec-7-2 .c-os { color: var(--os); } .sec-7-2 .c-acc { color: var(--accent); } /* page text colors for processes, the OS and the accent indigo */
      .sec-7-2 .c-mem { color: var(--mem); } .sec-7-2 .c-cpu { color: var(--cpu); } /* page text colors for memory and the processor */
      .sec-7-2 .s-hole { fill: var(--panel); stroke: var(--line-2); stroke-dasharray: 4 3; } /* a free hole in a memory drawing: the plain card fill (white, or navy in dark mode) with a dashed grey outline */
      .sec-7-2 .s-waste { fill: var(--warn-bg); stroke: var(--warn); } /* wasted space inside a partition or block: amber fill and outline, so internal fragmentation stands out */
      .sec-7-2 .stat { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; font-size: 14.5px; } /* a stat line: a label on the left and its number on the right of one row */
      .sec-7-2 .stat b { font-variant-numeric: tabular-nums; } /* the number in a stat line uses equal-width digits so columns of figures line up */
    `,  // end of the section's style rules
    steps: [  // steps: the slides of this section, in order
      /* ---------------- 1. Big picture ---------------- */
      {  // step 1 begins
        title: 'One memory, many processes: carve it into partitions',  // step 1 title, shown at the top of the slide
        kind: 'story',  // kind story: the guide labels this step "Big Picture"
        render(el, ctx) {  // render(el, ctx): draws step 1 into the slide body el; ctx is the guide's toolbox for the step
          const { h, s } = ctx;  // h builds page elements and s builds SVG drawing elements
          /* Four miniature 64 MB memories, one per scheme. part = a partition holding `used` MB of process. */
          const ROWS = {  // ROWS: the four example memories, one per scheme, each with its pieces, a waste tag and the explanation shown when picked
            eq: { name: 'Fixed, equal partitions', segs: [['os', 4], ['part', 10, 2], ['part', 10, 9], ['part', 10, 4], ['part', 10, 0], ['part', 10, 6], ['part', 10, 3]],  // equal fixed partitions: 4 MB OS, then six 10 MB partitions holding 2, 9, 4, nothing, 6 and 3 MB of process
              chip: ['warn', 'Waste: inside partitions'],  // tag for this memory: the waste sits inside partitions
              say: 'At start-up the memory after the OS is cut into <b>six 10 MB partitions</b> that never change. Any process up to 10 MB fits in any free one. But a 2 MB process still occupies all 10 MB (the amber part is wasted), and a 13 MB program fits nowhere. Early mainframe systems worked like this.' },  // explanation for equal partitions: any small job fits anywhere, but small jobs waste space and big ones fit nowhere
            uneq: { name: 'Fixed, unequal partitions', segs: [['os', 4], ['part', 3, 2], ['part', 5, 4], ['part', 7, 6], ['part', 10, 9], ['part', 15, 13], ['part', 20, 0]],  // unequal fixed partitions: 4 MB OS, then partitions of 3 to 20 MB, each holding a job close to its size (the 20 MB one empty)
              chip: ['warn', 'Waste: inside partitions, but less'],  // tag: still waste inside partitions, but less of it
              say: 'Still fixed at start-up, but the partitions come in <b>different sizes</b> (3, 5, 7, 10, 15 and 20 MB). Each process goes into a partition close to its size, so less space is wasted inside, and bigger programs (up to 20 MB) can run.' },  // explanation for unequal partitions: jobs land in a partition near their size, so less waste and bigger jobs fit
            dyn: { name: 'Dynamic partitions', segs: [['os', 4], ['proc', 18], ['hole', 6], ['proc', 12], ['hole', 3], ['proc', 14], ['hole', 7]],  // dynamic partitions: 4 MB OS, then processes of exactly 18, 12 and 14 MB with free holes of 6, 3 and 7 MB between them
              chip: ['bad', 'Waste: holes between partitions'],  // tag: the waste sits in the holes between partitions
              say: 'Partitions are cut <b>on demand</b>, each exactly the size of its process, so nothing is wasted inside them. But as processes come and go, free memory breaks into scattered <b>holes</b>: here 16 MB is free, yet a 10 MB process cannot be placed.' },  // explanation for dynamic partitions: no waste inside, but 16 MB of scattered holes cannot take a 10 MB process
            bud: { name: 'Buddy system', segs: [['part', 32, 20], ['part', 16, 9], ['hole', 8], ['part', 8, 5]],  // buddy system: blocks of 32, 16, 8 and 8 MB, one of the 8 MB blocks free, the others partly used
              chip: ['accent', 'A compromise between the two'],  // tag: the buddy system as a middle path between fixed and dynamic
              say: 'Blocks are always a <b>power of two</b> (here 32, 16, 8 and 8 MB of a 64 MB region). A request gets the smallest power of two that holds it, made by halving bigger blocks; freed halves merge back. Some waste inside blocks, but free space stays easy to reunite.' },  // explanation for the buddy system: power-of-two blocks made by halving, some waste inside but easy merging
          };  // closes ROWS
          const LAB = { eq: ['Fixed', 'equal sizes'], uneq: ['Fixed', 'unequal sizes'], dyn: ['Dynamic', 'exact sizes'], bud: ['Buddy', 'powers of two'] };  // LAB: the short two-part name written beside each bar, such as "Fixed" with "equal sizes"
          /* Small screens: each name sits on its own line above a full-width bar, so the labels stay readable. */
          const SL = ctx.narrow, VW = SL ? 340 : 600, W = SL ? 332 : 464, X0 = SL ? 4 : 130, PX = W / 64, RH = 36, PITCH = SL ? 82 : 62;  // layout numbers: SL is true on phone-width screens; picture width, bar width, bar start, pixels per MB, bar height and row spacing
          const svg = s('svg', { viewBox: `0 0 ${VW} ${SL ? 334 : 254}`, width: '100%' });  // the drawing; its height depends on the layout, and it stretches to the width of its card
          const groups = {};  // groups will hold the clickable group for each memory, so the picked one can be highlighted later
          Object.entries(ROWS).forEach(([k, row], r) => {  // draws the four memories one below the other; k is the scheme's key and r its row number
            const top = 6 + r * PITCH, y = SL ? top + 22 : top;  // top is where this row begins; on small screens the bar sits lower to leave room for its name above it
            const kids = SL ? [s('text', { x: 4, y: top + 14, 'font-size': 14 }, s('tspan', { 'font-weight': 800 }, LAB[k][0]), s('tspan', { class: 's-sub', 'font-size': 13 }, ' · ' + LAB[k][1]))]  // small screens: the name and its description go on one line above the bar...
              : [s('text', { x: 4, y: y + 15, 'font-weight': 800, 'font-size': 15 }, LAB[k][0]), s('text', { x: 4, y: y + 33, 'font-size': 13, class: 's-sub' }, LAB[k][1])];  // ...wide screens: the name in bold and its description below it, both to the left of the bar
            let x = X0;  // x walks along the bar from its left end as each piece is drawn
            for (const [kind, mb, used] of row.segs) {  // draws each piece of this memory: its kind, its size in MB, and for a partition how much of it a process uses
              const w = mb * PX;  // w is the piece's width in pixels
              if (kind === 'os') kids.push(s('rect', { x, y, width: w, height: RH, class: 's-os', 'stroke-width': 1.5 }), s('text', { x: x + w / 2, y: y + 23, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 700, class: 'tx-os' }, 'OS'));  // an OS piece: a purple rectangle labelled OS
              else if (kind === 'proc') kids.push(s('rect', { x, y, width: w, height: RH, class: 's-proc', 'stroke-width': 1.5 }), s('text', { x: x + w / 2, y: y + 23, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 }, mb + ' MB'));  // a process piece (dynamic memory): a teal rectangle labelled with its exact size
              else if (kind === 'hole') kids.push(s('rect', { x, y, width: w, height: RH, class: 's-hole', 'stroke-width': 1.5 }), s('text', { x: x + w / 2, y: y + 23, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, mb));  // a free hole: a dashed rectangle labelled with its size
              else {  // a partition (fixed or buddy) needs a few more shapes
                kids.push(s('rect', { x, y, width: w, height: RH, class: used ? 's-waste' : 's-hole', 'stroke-width': 1.5 }));  // the whole partition: amber (wasted) if a process is in it, dashed (free) if it is empty
                if (used) kids.push(s('rect', { x, y, width: used * PX, height: RH, class: 's-proc', 'stroke-width': 1.5 }));  // the part the process really uses is painted teal over the amber, so only the unused tail stays amber
                kids.push(s('line', { x1: x + w, x2: x + w, y1: y - 3, y2: y + RH + 3, class: 's-line', 'stroke-width': 2 }));  // a thick line at the partition's right edge shows where one partition ends and the next begins
                if (w >= 26) kids.push(s('text', { x: x + w / 2, y: y + RH + 15, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, String(mb)));  // the partition size written under the bar, if the partition is wide enough to hold the number
              }  // ends the partition case
              x += w;  // moves x along to where the next piece starts
            }  // ends the loop over pieces
            kids.push(s('rect', { x: X0, y, width: W, height: RH, fill: 'none', class: 's-line', 'stroke-width': 2 }));  // a thick outline around the whole bar
            groups[k] = hotGroup(ctx, () => pick(k), row.name, s('rect', { x: 0, y: top - 4, width: VW, height: PITCH - 2, fill: 'transparent' }), ...kids);  // wraps the row in a clickable group with an invisible full-width rectangle, so clicking anywhere on the row picks that memory
            svg.append(groups[k]);  // adds the row to the drawing
          });  // ends the loop over the four memories
          const info = h('div', { class: 'card tight', style: { minHeight: '112px', flex: 'none' } });  // info: the box under the drawing that explains the memory the student picked
          function pick(k) {  // pick(k): runs when a memory is clicked; shows its explanation and highlights its row
            const row = ROWS[k];  // row is the chosen memory's data
            info.innerHTML = `<div class="row" style="gap:8px;margin-bottom:4px"><b>${row.name}</b><span class="chip ${row.chip[0]}">${row.chip[1]}</span></div><div class="small">${row.say}</div>`;  // writes its name, its colored waste tag and its explanation into the info box
            Object.entries(groups).forEach(([kk, g]) => { g.style.opacity = kk === k ? '1' : '0.5'; });  // fades every other row to half strength so the chosen one stands out
          }  // ends pick
          info.innerHTML = '<div class="b">Click any of the four memories.</div><div class="small muted">Each is 64 MB; numbers are sizes in MB. Teal = a process, amber = space wasted inside a partition, dashed = free. The rest of this section builds each one for real.</div>';  // starting text in the info box: tells the student to click a memory and explains the colors
          el.append(h('div', { class: 'split l fill' },  // lays out the step in two columns, the left one smaller
            h('div', { class: 'stack' },  // left column: the introduction stacked top to bottom
              h('p', { class: 'lead m0', html: 'Many processes must share one <span class="t">main memory</span>. The oldest answer: give each process one unbroken slice of it, a <span class="t">partition</span>.' }),  // opening sentence: introduces main memory and the idea of a partition
              h('p', { class: 'm0', html: 'Every scheme in this section answers the same three questions. <b>How is memory carved up?</b> <b>Which slice does a newcomer get?</b> <b>What space ends up wasted?</b> The two kinds of waste, inside slices and between them, are called <span class="t">fragmentation</span>.' }),  // paragraph: the three questions every scheme answers, and the word fragmentation
              h('div', { class: 'callout analogy m0', 'data-label': 'Analogy', html: 'A parking lot with painted spaces is <b>fixed</b> partitioning: a motorbike still uses a whole space, and a bus fits nowhere. A street with no lines is <b>dynamic</b>: each car takes exactly its length, but as cars leave, the gaps are odd sizes: soon there are many gaps and none fits a van.' }),  // analogy box: painted parking spaces for fixed partitions and an unmarked street for dynamic ones
              h('div', { class: 'stack gap-s' }, h('h4', { class: 'm0' }, 'Coming up in this section'),  // a small heading over the list of topics coming up
                h('div', { class: 'row', style: { gap: '6px' } }, ...['Fixed partitions', 'Queues and swapping', 'Dynamic partitions', 'First, best, next fit', 'Buddy system', 'Base and bounds'].map((c) => h('span', { class: 'chip accent' }, c))))),  // the six topics of this section as accent tags in one wrapping row; closes the left column
            h('div', { class: 'stack' }, h('div', { class: 'card white', style: { padding: '6px 10px' } }, svg), info,  // right column: the drawing in a white card, then the info box
              h('div', { class: 'callout why m0 small', 'data-label': 'Why it matters', html: 'Modern systems mostly use paging (7.3) instead, but the problems met here and their fixes (placement rules, the buddy system, base and bounds registers) reappear inside kernel memory allocators today.' }))));  // why-it-matters note: these ideas return in today's kernel memory allocators; closes the columns
        },  // ends render for step 1
      },  // ends step 1
      /* ---------------- 2. Fixed partitions: equal vs unequal ---------------- */
      {  // step 2 begins
        title: 'Fixed partitions: equal sizes or unequal sizes?',  // step 2 title
        kind: 'explore',  // kind explore: labelled "Explore" above the title
        render(el, ctx) {  // render(el, ctx): draws step 2
          const { h, s } = ctx;  // h builds page elements and s builds SVG drawing elements
          const JOBS = [['A', 2], ['B', 9], ['C', 4], ['D', 13], ['E', 6], ['F', 3], ['G', 24]];  // JOBS: the seven jobs A to G with their sizes in MB; D (13) and G (24) are too big for some partitions
          const SIZE = Object.fromEntries(JOBS);  // SIZE: the same list as a lookup table, so SIZE['D'] gives 13
          const MEMS = {  // MEMS: the two fixed memories compared side by side
            eq: { title: 'Equal: 6 × 10 MB', sizes: [10, 10, 10, 10, 10, 10], rule: 'the first free partition' },  // equal memory: six 10 MB partitions; a job takes the first free one
            un: { title: 'Unequal: 3 to 20 MB', sizes: [3, 5, 7, 10, 15, 20], rule: 'the smallest free partition that holds it' },  // unequal memory: partitions of 3 to 20 MB; a job takes the smallest free one that holds it
          };  // closes MEMS
          let st, gen = 0;  // st records which job sits in each partition of each memory; gen counts actions so a stale automatic run can tell it was overtaken
          const svgs = {}, stats = h('div'), narr = h('div', { class: 'card tight small', style: { minHeight: '76px' } });  // svgs holds the two drawings; stats is the table box; narr is the box that describes what the last click did
          const warn = h('div', { class: 'callout warn m0 small', 'data-label': 'Two built-in problems' });  // warn: the amber box naming the two built-in problems of fixed partitions
          const btnBox = h('div', { class: 'row', style: { gap: '5px' } });  // btnBox: the row of job buttons, rebuilt after every change
          const PXM = (ctx.narrow ? 320 : 428) / 64, Y = (mb) => 30 + mb * PXM;  // PXM is pixels per MB (smaller on phone-width screens); Y(mb) turns an MB address into a height in the drawing, 0 MB at the top
          function reset() {  // reset(): empties both memories; runs at the start and when Reset is pressed
            gen++;  // bumps the counter, so any automatic loading still pending stops
            st = { eq: [null, null, null, null, null, null], un: [null, null, null, null, null, null] };  // every partition in both memories starts empty (null)
            narr.innerHTML = '<b>Both memories are empty.</b> <span class="muted">Click a job to send it to both at once. Predict first: where will it land in each, and how much space will it waste?</span>';  // starting message: both memories are empty; asks the student to predict before clicking a job
            draw();  // redraws everything
          }  // ends reset
          const where = (m, j) => st[m].indexOf(j);  // where(m, j): the partition number holding job j in memory m, or -1 if the job is not there
          function tryLoad(m, j) {  // tryLoad(m, j): tries to load job j into memory m and returns a sentence saying what happened
            const sz = SIZE[j], sizes = MEMS[m].sizes;  // sz is the job's size and sizes the partition sizes of this memory
            if (where(m, j) >= 0) return '';  // a job already in this memory is not loaded twice
            const max = Math.max(...sizes);  // max is the largest partition in this memory
            if (sz > max) return `<b class="c-bad">${j} (${sz} MB) fits nowhere</b>: the largest partition is ${max} MB. It could only run if rewritten with <span class="t">overlays</span>.`;  // message when the job is bigger than every partition: it fits nowhere and would need overlays
            const free = sizes.map((z, i) => i).filter((i) => !st[m][i] && sizes[i] >= sz);  // free lists the empty partitions that are big enough for the job
            if (!free.length) return `<b class="c-warn">No free partition holds ${j} right now.</b> It waits, or the OS swaps a process out to make room.`;  // message when none of them is free right now: the job waits, or the OS swaps a process out
            const i = m === 'eq' ? free[0] : free.reduce((a, b) => (sizes[b] < sizes[a] ? b : a));  // chooses the partition: the first free one in the equal memory, the smallest free one in the unequal memory
            st[m][i] = j;  // records the job in that partition
            return `${j} (${sz} MB) goes into ${MEMS[m].rule}: <b>${sizes[i]} MB</b>, wasting <b class="c-warn">${sizes[i] - sz} MB</b> inside it.`;  // message saying which partition the job went into and how many MB are wasted inside it
          }  // ends tryLoad
          function click(j) {  // click(j): runs when a job button is clicked: loads the job into both memories, or lets it finish if it is already in
            gen++;  // bumps the counter so a pending automatic run notices the student took over
            if (where('eq', j) >= 0 || where('un', j) >= 0) {  // if the job is already in either memory...
              ['eq', 'un'].forEach((m) => { const i = where(m, j); if (i >= 0) st[m][i] = null; });  // ...it is removed from every memory that holds it
              narr.innerHTML = `<b>Job ${j} finished.</b> Its partition is free again in each memory that held it, and the partition keeps its size: nothing is merged or resized.`;  // message: the job finished and its partition is free again, still the same size
            } else {  // otherwise the job is new...
              narr.innerHTML = `<div><b>Equal:</b> ${tryLoad('eq', j)}</div><div style="margin-top:4px"><b>Unequal:</b> ${tryLoad('un', j)}</div>`;  // ...so it is loaded into both memories, and the two outcome sentences are shown one under the other
            }  // ends the if
            draw();  // redraws everything
          }  // ends click
          function loadAll() {  // loadAll(): the "Load A to G in order" button: empties both memories and then sends the jobs in one by one
            reset();  // starts from empty memories
            const g = gen;  // g remembers the counter value of this run
            JOBS.forEach(([j], k) => ctx.after(260 * (k + 1), () => { if (g !== gen) return; click(j); gen = g; }));  // schedules one click every 260 ms; each checks it is still the current run, clicks, then restores the counter so the next one goes too
          }  // ends loadAll
          function drawMem(m) {  // drawMem(m): draws one memory as a tall column, its title on top
            const M = MEMS[m], svg = svgs[m], kids = [s('text', { x: 135, y: 18, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 15.5 }, M.title)];  // M is this memory's data, svg the group it is drawn into, and kids the shapes, starting with the title
            kids.push(s('rect', { x: 8, y: Y(0), width: 96, height: Y(4) - Y(0), class: 's-os', 'stroke-width': 1.5 }), s('text', { x: 56, y: Y(2) + 5, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 700, class: 'tx-os' }, 'OS 4 MB'));  // the OS at the top: a purple block for the first 4 MB
            let a = 4;  // a walks down the column in MB, starting just below the OS
            M.sizes.forEach((z, i) => {  // draws each partition in turn; z is its size and i its number
              const j = st[m][i], y0 = Y(a), y1 = Y(a + z), sz = j ? SIZE[j] : 0;  // j is the job in it (if any), y0 and y1 its top and bottom on screen, sz the job's size
              kids.push(s('rect', { x: 8, y: y0, width: 96, height: y1 - y0, class: j ? 's-waste' : 's-hole', 'stroke-width': 1.5 }));  // the partition: amber (wasted) if a job is inside, dashed (free) if empty
              if (j) kids.push(s('rect', { x: 8, y: y0, width: 96, height: Y(a + sz) - y0, class: 's-proc', 'stroke-width': 1.5 }),  // the part the job really uses is painted teal from the top, leaving the unused rest amber...
                s('text', { x: 56, y: y0 + Math.min(Y(a + sz) - y0, 22) / 2 + 5, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800 }, j));  // ...with the job's letter written inside the teal part
              kids.push(s('line', { x1: 2, x2: 110, y1: y1, y2: y1, class: 's-line', 'stroke-width': 2 }));  // a thick line marks the bottom edge of this partition
              kids.push(s('text', { x: 116, y: (y0 + y1) / 2 + 5, 'font-size': 13 },  // a label to the right of the partition...
                s('tspan', { 'font-weight': 700 }, z + ' MB'), s('tspan', { class: j ? 'tx-warn' : 's-sub' }, j ? `  ${j}: ${z - sz} wasted` : '  free')));  // ...its size in bold, then either how much the job wastes (amber) or the word free (grey)
              a += z;  // moves a down to the start of the next partition
            });  // ends the loop over partitions
            kids.push(s('line', { x1: 2, x2: 110, y1: Y(4), y2: Y(4), class: 's-line', 'stroke-width': 2 }), s('rect', { x: 8, y: Y(0), width: 96, height: Y(64) - Y(0), fill: 'none', class: 's-line', 'stroke-width': 2 }));  // a thick line under the OS and a thick outline around the whole 64 MB column
            svg.replaceChildren(...kids);  // replaces this memory's old drawing with the new shapes
          }  // ends drawMem
          function draw() {  // draw(): redraws both memories, the stats table and the job buttons; runs after every change
            drawMem('eq'); drawMem('un');  // draws the equal memory and then the unequal one
            const row = (m) => {  // row(m): works out the four numbers for one memory's column of the table
              const sizes = MEMS[m].sizes, used = st[m].map((j, i) => (j ? i : -1)).filter((i) => i >= 0);  // sizes are the partition sizes; used lists the partitions that hold a job
              const waste = used.reduce((t, i) => t + sizes[i] - SIZE[st[m][i]], 0), held = used.reduce((t, i) => t + sizes[i], 0);  // waste adds up the unused MB inside occupied partitions; held adds up the size of those partitions
              return [used.length, waste, held ? Math.round((100 * waste) / held) + '%' : '–', sizes.length - used.length];  // returns jobs in memory, MB wasted, the percentage of occupied space wasted (a dash if none), and free partitions
            };  // ends row
            const e = row('eq'), u = row('un');  // e and u hold the numbers for the equal and unequal memories
            stats.innerHTML = `<table class="tbl compact"><tr><th></th><th>Equal</th><th>Unequal</th></tr>${/* stats table header: a blank corner, then the Equal and Unequal columns */''}
              <tr><td>Jobs in memory</td><td class="b">${e[0]}</td><td class="b">${u[0]}</td></tr>${/* stats row: how many jobs each memory holds */''}
              <tr><td><span class="t">Internal fragmentation</span> (MB)</td><td class="b c-warn">${e[1]}</td><td class="b c-warn">${u[1]}</td></tr>${/* stats row: internal fragmentation in MB for each memory, in amber */''}
              <tr><td>Share of occupied partitions wasted</td><td class="b">${e[2]}</td><td class="b">${u[2]}</td></tr></table>`;  // stats row: the share of occupied partitions that is wasted; closes the table
            btnBox.replaceChildren(...JOBS.map(([j, z]) => {  // rebuilds the job buttons, one per job
              const on = where('eq', j) >= 0 || where('un', j) >= 0;  // on is true when the job is in either memory
              return h('button', { class: 'btn sm' + (on ? ' on' : ''), title: on ? 'Let job ' + j + ' finish' : 'Load job ' + j, onclick: () => click(j) }, `${j} ${z} MB`);  // the button shows the letter and size; it is highlighted while the job is loaded, and its tooltip says what a click will do
            }));  // ends the button list
          }  // ends draw
          const both = s('svg', { viewBox: ctx.narrow ? '0 0 278 716' : '0 0 548 466', width: '100%' });  // both: one drawing holding the two memories, side by side on wide screens and stacked on phone-width screens
          svgs.eq = s('g'); svgs.un = s('g', { transform: ctx.narrow ? 'translate(0 360)' : 'translate(278 0)' });  // the equal memory's group, and the unequal memory's group moved to the right (or down on small screens)
          both.append(svgs.eq, svgs.un);  // puts both groups into the drawing
          warn.innerHTML = '<b>Overlays:</b> a program bigger than every partition (like G) cannot run unless the programmer splits it into pieces that take turns in one partition. <b>Waste:</b> even a tiny job occupies a whole partition, and that unused space inside it is <span class="t">internal fragmentation</span>.';  // the warning box text: overlays for programs too big for any partition, and internal fragmentation for small ones
          reset();  // starts with both memories empty and draws them
          el.append(h('div', { class: 'split fill' },  // lays out the step in two equal columns
            h('div', { class: 'card white', style: { padding: '8px 6px', display: 'grid', placeItems: 'center' } }, both),  // left column: the two memories in a white card, centered
            h('div', { class: 'stack', style: { gap: '10px' } },  // right column: text and controls stacked top to bottom
              h('p', { class: 'm0', html: 'In <span class="t">fixed partitioning</span>, memory after the OS is cut up once, at start-up, so six partitions means at most six processes in memory. Click a job to load it into <b>both</b> memories; click it again to let it finish.' }),  // introduction: fixed partitioning cuts memory once, so the partition count caps the jobs; explains the click behavior
              btnBox,  // the job buttons
              h('div', { class: 'row', style: { gap: '8px' } }, h('button', { class: 'btn sm primary', onclick: loadAll }, 'Load A to G in order'), h('button', { class: 'btn sm ghost', onclick: reset }, 'Reset')),  // the "Load A to G in order" button and the Reset button
              narr, stats, warn)));  // then the outcome box, the stats table and the warning box; closes the columns
        },  // ends render for step 2
      },  // ends step 2
      /* ---------------- 3. Placement with unequal partitions: queues and swapping ---------------- */
      {  // step 3 begins
        title: 'Unequal partitions: who waits where, and who gets swapped out',  // step 3 title
        kind: 'compare',  // kind compare: labelled "Compare" above the title
        render(el, ctx) {  // render(el, ctx): draws step 3
          const { h, s } = ctx;  // h builds page elements and s builds SVG drawing elements
          const PARTS = [3, 5, 7, 10, 15, 20];  // PARTS: the six unequal partition sizes in MB, smallest first
          const ARR = [['J1', 2], ['J2', 1], ['J3', 3], ['J4', 2], ['J5', 6], ['J6', 2], ['J7', 1]];  // ARR: the seven small jobs J1 to J7 in arrival order, with their sizes in MB
          /* State after the first n arrivals, computed from scratch for both policies. No job finishes during the clip. */
          function simulate(n) {  // simulate(n): replays the first n arrivals under both policies from an empty start and returns what each one did
            const multi = { run: PARTS.map(() => null), q: PARTS.map(() => []) }, single = { run: PARTS.map(() => null), q: [] }, log = [];  // multi has a run slot and its own queue per partition; single has run slots and one shared queue; log keeps a sentence pair per arrival
            for (let k = 0; k < n; k++) {  // handles each of the first n arrivals in order
              const [id, sz] = ARR[k], job = { id, sz };  // id and sz are the arriving job's name and size; job bundles them
              const home = PARTS.findIndex((p) => p >= sz);  // home is the smallest partition that could ever hold this job (the partitions are listed smallest first)
              let mSay, sSay;  // mSay and sSay will describe what each policy did with the job
              if (!multi.run[home] && !multi.q[home].length) { multi.run[home] = job; mSay = `the smallest partition that can ever hold it is ${PARTS[home]} MB, and it is free: it loads at once`; }  // per-partition queues: if the home partition is empty and nobody is queued for it, the job loads at once
              else { multi.q[home].push(job); const idle = PARTS.filter((p, i) => !multi.run[i] && p >= sz); mSay = `it must queue for the ${PARTS[home]} MB partition (${multi.q[home].length} waiting there)` + (idle.length ? `, even though the ${idle.join(', ')} MB partitions sit idle` : ''); }  // otherwise it joins that partition's queue, and the sentence points out any bigger partitions sitting idle meanwhile
              const free = PARTS.map((p, i) => i).filter((i) => !single.run[i] && PARTS[i] >= sz);  // single queue: free lists the empty partitions big enough for the job, smallest first
              if (free.length) { const i = free[0]; single.run[i] = job; sSay = `it takes the smallest <i>free</i> partition that holds it, ${PARTS[i]} MB, wasting ${PARTS[i] - sz} MB`; }  // if there is one, the job takes the smallest of them, and the sentence gives the MB it wastes
              else { single.q.push(job); sSay = 'every partition is busy, so it waits in the one queue'; }  // if every suitable partition is busy, the job waits in the one shared queue
              log.push({ id, sz, mSay, sSay });  // records both sentences for the caption of this arrival
            }  // ends the loop over arrivals
            return { multi, single, log };  // hands back both memories and the log
          }  // ends simulate
          const figures = (m) => {  // figures(m): counts what the summary line under each panel shows
            const running = m.run.filter(Boolean).length, waiting = Array.isArray(m.q[0]) ? m.q.reduce((t, q) => t + q.length, 0) : m.q.length;  // running counts the busy partitions; waiting adds up every per-partition queue, or the length of the single queue
            const waste = m.run.reduce((t, j, i) => t + (j ? PARTS[i] - j.sz : 0), 0), idle = m.run.filter((j) => !j).length;  // waste adds the unused MB inside busy partitions; idle counts the empty partitions
            return { running, waiting, waste, idle };  // returns the four numbers
          };  // ends figures
          const SLIM = ctx.narrow, BW = SLIM ? 140 : 190, QX = SLIM ? 204 : 254, CW = SLIM ? 44 : 52, CS = SLIM ? 46 : 57;  // layout numbers: SLIM is true on phone-width screens; partition bar width, where queues start, chip width and chip spacing
          const svg = s('svg', { viewBox: SLIM ? '0 0 432 586' : '0 0 1120 318', width: '100%' });  // the drawing: a tall picture with the two panels stacked on small screens, a wide one with them side by side otherwise
          function chip(x, y, job, w = 52, dim = false, hot = false) {  // chip(x, y, job, w, dim, hot): draws one job as a rounded pill showing its name and size
            return s('g', { opacity: dim ? 0.45 : 1 },  // the pill is faded when dim is true (a job that has not arrived yet)
              s('rect', { x, y, width: w, height: 22, rx: 11, class: hot ? 's-accent' : 's-proc', 'stroke-width': hot ? 2.5 : 1.2 }),  // its rounded rectangle: teal normally, accent with a thicker edge when hot (the job that just arrived)
              s('text', { x: x + w / 2, y: y + 16, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 700 }, `${job.id} ${job.sz}`));  // the job's name and size written in the middle of the pill
          }  // ends chip
          function panel(x0, title, m, isMulti, fig) {  // panel(x0, title, m, isMulti, fig): draws one policy's six partitions, its queue or queues, and its summary line
            const kids = [s('text', { x: x0, y: 64, 'font-weight': 800, 'font-size': 16 }, title)];  // kids collects the shapes, starting with the panel's title
            PARTS.forEach((p, r) => {  // draws the six partitions one under the other; p is the size and r the row
              const y = 76 + r * 34, j = m.run[r];  // y is this row's top; j is the job running in this partition, if any
              kids.push(s('text', { x: x0 + 46, y: y + 19, 'text-anchor': 'end', 'font-size': 13.5, 'font-weight': 700 }, p + ' MB'));  // the partition size written to the left of its bar
              kids.push(s('rect', { x: x0 + 54, y, width: BW, height: 28, rx: 5, class: j ? 's-waste' : 's-hole', 'stroke-width': 1.5 }));  // the partition bar: amber (waste) if busy, dashed (free) if idle
              if (j) {  // if a job is running here...
                const tw = (BW * j.sz) / p, roomy = BW - tw >= 58, slimLab = !roomy && tw < 78;  // tw is the width of the job's share; roomy says there is space for the waste label to its right; slimLab drops the word "wasted" when space is tight
                kids.push(s('rect', { x: x0 + 54, y, width: tw, height: 28, rx: 5, class: 's-proc', 'stroke-width': 1.5 }),  // the teal part for the job, sized in proportion to the job within the partition...
                  s('text', { x: x0 + 60, y: y + 19, 'font-size': 13, 'font-weight': 800 }, j.id),  // ...the job's name at its left end...
                  s('text', { x: roomy ? x0 + 54 + BW - 6 : x0 + 54 + tw - 6, y: y + 19, 'text-anchor': 'end', 'font-size': 12.5, class: roomy ? 'tx-warn' : 's-sub' }, (p - j.sz) + (slimLab ? '' : ' wasted')));  // ...and how many MB are wasted: in amber at the bar's right end when there is room, otherwise in grey at the edge of the teal part
              }  // ends the busy case
              else kids.push(s('text', { x: x0 + 54 + BW / 2, y: y + 19, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, 'idle'));  // an empty partition is labelled idle
              if (isMulti) m.q[r].forEach((job, k) => kids.push(chip(x0 + QX + k * CS, y + 3, job, CW)));  // per-partition policy: the jobs waiting for this partition are drawn as pills in a row to its right
            });  // ends the loop over partitions
            if (!isMulti) {  // single-queue policy only:
              kids.push(s('rect', { x: x0 + QX + 6, y: 76, width: SLIM ? 220 : 280, height: 198, rx: 10, class: 's-panel', 'stroke-width': 1.5 }),  // a grey box to the right of the partitions holds the one shared queue...
                s('text', { x: x0 + QX + 18, y: 98, 'font-size': 13.5, 'font-weight': 700 }, 'The single queue'));  // ...with its heading
              m.q.forEach((job, k) => kids.push(chip(x0 + QX + 18 + (k % 4) * (CW + 6), 110 + Math.floor(k / 4) * 30, job, CW)));  // the waiting jobs as pills, four per row
              if (!m.q.length) kids.push(s('text', { x: x0 + QX + 18, y: 128, 'font-size': 13, class: 's-sub' }, '(empty)'));  // the word "(empty)" when nobody waits
            } else kids.push(s('text', { x: x0 + QX, y: 64, 'font-size': 13, class: 's-sub' }, 'queue of each partition →'));  // per-partition policy instead gets a small heading pointing to its row-by-row queues
            kids.push(s('text', { x: x0, y: 304, 'font-size': SLIM ? 12.5 : 14 },  // the summary line under the panel...
              s('tspan', { 'font-weight': 700 }, `Running ${fig.running}`), s('tspan', { class: 's-sub' }, '  ·  '),  // ...how many jobs are running...
              s('tspan', { 'font-weight': 700, class: fig.waiting ? 'tx-bad' : '' }, `Waiting ${fig.waiting}`), s('tspan', { class: 's-sub' }, '  ·  '),  // ...how many are waiting, in red if any are...
              s('tspan', {}, `Idle partitions ${fig.idle}`), s('tspan', { class: 's-sub' }, '  ·  '),  // ...how many partitions are idle...
              s('tspan', { class: 'tx-warn', 'font-weight': 700 }, `Wasted inside ${fig.waste} MB`)));  // ...and the MB wasted inside partitions, in amber
            return kids;  // hands back the panel's shapes
          }  // ends panel
          function render(n) {  // render(n): draws frame n of the player (the state after n arrivals) and returns its caption
            const { multi, single, log } = simulate(n), fm = figures(multi), fs = figures(single);  // replays the first n arrivals and counts the summary numbers for both policies
            const kids = [s('text', { x: 0, y: 24, 'font-size': 14, 'font-weight': 700 }, SLIM ? 'Arrivals:' : 'Arrivals (MB):')];  // kids starts with the label of the arrivals strip at the top
            ARR.forEach(([id, sz], k) => kids.push(chip((SLIM ? 70 : 108) + k * (SLIM ? 51 : 64), 8, { id, sz }, SLIM ? 48 : 56, k >= n, k === n - 1)));  // all seven arrivals as pills: those still to come are faded and the newest one is highlighted
            if (SLIM) kids.push(...panel(0, 'One queue per partition', multi, true, fm), s('g', { transform: 'translate(0 268)' }, ...panel(0, 'One queue for all partitions', single, false, fs)));  // phone-width screens: the per-partition panel on top and the single-queue panel moved down below it
            else kids.push(s('line', { x1: 560, x2: 560, y1: 46, y2: 312, class: 's-muted' }), ...panel(0, 'One queue per partition', multi, true, fm), ...panel(580, 'One queue for all partitions', single, false, fs));  // wide screens: a faint dividing line with the two panels side by side
            svg.replaceChildren(...kids);  // replaces the old drawing with the new one
            if (n === 0) return 'Seven small jobs are about to arrive. Each policy puts a job in the <b>smallest partition that holds it</b>, but they differ in what happens when that partition is busy. Press play or step forward.';  // caption for frame 0: seven jobs are coming, and the two policies differ only when the best partition is busy
            const L = log[n - 1];  // L is the record of the job that has just arrived
            let cap = `<b>${L.id} (${L.sz} MB) arrives.</b> Per-partition queues: ${L.mSay}. Single queue: ${L.sSay}.`;  // caption for an arrival: what each policy did with this job
            if (n === ARR.length) cap = `<b>All seven have arrived.</b> Per-partition queues: <b>${fm.waiting} jobs wait</b> while ${fm.idle} partitions sit idle, but only ${fm.waste} MB is wasted. Single queue: ${fs.running} jobs run and ${fs.waiting} waits, at the price of ${fs.waste} MB wasted inside partitions.`;  // caption for the last frame: totals showing per-partition queues waste less but leave jobs waiting while partitions idle
            return cap;  // hands the caption to the player
          }  // ends render
          const tab1 = (p) => {  // tab1(p): fills the first tab panel p with the drawing and its player
            const player = ctx.ui.player({ count: ARR.length + 1, render, interval: 1700 });  // the animation player: one frame for the empty start plus one per arrival, 1.7 seconds apart when playing
            p.append(h('div', { class: 'stack', style: { gap: '8px' } }, h('div', { class: 'card white', style: { padding: '8px 10px' } }, svg), player.el));  // the drawing in a white card with the player's controls and caption under it
          };  // ends tab1
          el.append(ctx.ui.tabs([  // the step is two tabs
            { label: 'One queue per partition, or one for all?', render: tab1 },  // tab 1: the two queue policies compared
            { label: 'Every partition full: who gets swapped out?', render: (p) => {  // tab 2: choosing which process to swap out; its render function follows
              const RES = [  // RES: the six residents of the full memory, one per partition, with the feedback for choosing each
                { part: 3, id: 'P1', sz: 2, state: 'Ready', pri: 'normal', fb: 'P1 sits in a 3 MB partition. Swapping it out frees a space that a 6 MB process cannot use, so P1 would be stopped for nothing. Only partitions of 6 MB or more are worth emptying.' },  // resident in the 3 MB partition: too small for the 6 MB newcomer, so swapping it out is useless
                { part: 5, id: 'P2', sz: 4, state: 'Blocked', pri: 'normal', fb: 'P2 is blocked, which is good, but its 5 MB partition is still too small for a 6 MB process. Emptying it does not help N at all.' },  // resident in the 5 MB partition: blocked, but its partition is still too small
                { part: 7, id: 'P3', sz: 5, state: 'Blocked', pri: 'normal', ok: true, fb: 'Best choice. The 7 MB partition is the <b>smallest one that holds N</b> (only 1 MB wasted), and P3 is <b>blocked</b>: it is waiting for an event and could not use the processor now anyway. P3 goes to disk in the Blocked/Suspend state and comes back later.' },  // resident in the 7 MB partition: the right answer (ok), the smallest partition that fits and a blocked owner
                { part: 10, id: 'P4', sz: 9, state: 'Ready', pri: 'high', fb: 'The 10 MB partition would hold N, but P4 is <b>ready</b> (it could run right now) and has <b>high priority</b>. Stopping it hurts more than parking a blocked process, and the partition is bigger than needed.' },  // resident in the 10 MB partition: big enough, but its owner is ready and high priority
                { part: 15, id: 'P5', sz: 12, state: 'Blocked', pri: 'normal', fb: 'P5 is blocked, a good sign, but its 15 MB partition would waste 9 MB on a 6 MB process. A smaller partition that holds N, also with a blocked owner, exists.' },  // resident in the 15 MB partition: blocked, but its partition would waste 9 MB
                { part: 20, id: 'P6', sz: 18, state: 'Ready', pri: 'normal', fb: 'The weakest workable choice: P6 is ready to run, and the 20 MB partition would waste 14 MB on N. Prefer the smallest partition that fits and a blocked owner.' },  // resident in the 20 MB partition: works, but its owner is ready and 14 MB would be wasted
              ];  // closes RES
              let chosen = null;  // chosen: the resident the student clicked, none at first
              const list = h('div', { class: 'stack', style: { gap: '6px' } });  // list: the stack of resident buttons
              const fb = h('div', { class: 'card tight small', style: { minHeight: '120px' } });  // fb: the box that explains the student's choice
              function draw() {  // draw(): rebuilds the list and the feedback; runs at the start and after every click
                list.replaceChildren(...RES.map((r) => {  // makes one button per resident
                  const swapped = chosen === r && r.ok;  // swapped is true only for the clicked resident when it is the right answer, so its row can show N instead
                  const mark = chosen === r ? (r.ok ? '<b class="c-ok">✓ swapped out</b>' : '<b class="c-bad">✗ poor choice</b>') : '';  // mark: a green "swapped out" tick or a red "poor choice" cross on the clicked row only
                  const who = swapped ? '<b>N</b> · 6 MB <span class="muted small">(P3 now on disk)</span>' : `<b>${r.id}</b> · ${r.sz} MB`;  // who: the newcomer N if the swap went ahead, otherwise the resident's name and size
                  const chips = swapped ? '<span class="chip ok">Ready</span>' : `<span class="chip ${r.state === 'Blocked' ? 'warn' : 'proc'}">${r.state}</span><span class="chip ${r.pri === 'high' ? 'accent' : ''}">${r.pri} priority</span>`;  // chips: N shows a green Ready tag; any other row shows its state (amber Blocked, teal Ready) and its priority
                  return h('button', { class: 'btn' + (chosen === r ? ' on' : ''), style: { height: '50px', justifyContent: 'stretch', textAlign: 'left', display: 'grid', gridTemplateColumns: '58px minmax(0,1fr) auto auto', gap: '10px' }, title: 'Swap out ' + r.id, onclick: () => { chosen = r; draw(); },  // the row is a button in four columns; clicking it makes this resident the choice and redraws
                    html: `<span class="b">${r.part} MB</span><span>${who}</span><span class="row" style="gap:4px">${chips}</span><span style="min-width:96px;text-align:right">${mark}</span>` });  // its four columns: partition size, who is inside, the tags, and the mark
                }));  // ends the button list
                fb.innerHTML = chosen ? `<div class="b ${chosen.ok ? 'c-ok' : 'c-bad'}" style="margin-bottom:3px">Swap out ${chosen.id}?</div>${chosen.fb}`  // feedback: a green or red heading with the explanation for the chosen resident...
                  : '<b>Click the process you would swap out.</b> <span class="muted">Think about three things: will its partition even hold N, can it run right now, and how important is it?</span>';  // ...or, before any click, the prompt naming the three things to weigh
              }  // ends draw
              draw();  // draws the starting state
              p.append(h('div', { class: 'split r fill' },  // tab 2 layout: two columns, the right one smaller
                h('div', { class: 'stack', style: { gap: '8px' } },  // left column, stacked top to bottom
                  h('p', { class: 'm0', html: 'Single-queue system, every partition occupied. A new process <b>N</b> needs <b>6 MB</b>, is ready to run and has normal priority. Which resident should the OS swap out to make room?' }),  // the scenario: a single-queue memory with every partition full and a 6 MB ready newcomer N
                  list,  // the six resident buttons
                  h('p', { class: 'xs muted m0', html: 'A swapped-out process moves to the Blocked/Suspend or Ready/Suspend state (see 3.2) and must be swapped back in before it can run again.' })),  // side note: a swapped-out process goes to a suspended state and must be swapped back in before it runs
                h('div', { class: 'stack', style: { gap: '10px' } },  // right column, stacked top to bottom
                  h('div', { class: 'card proc tight', html: '<div class="b">Newcomer N</div><div class="small">6 MB · ready · normal priority</div>' }),  // a teal card describing the newcomer N: 6 MB, ready, normal priority
                  fb,  // the feedback box
                  h('button', { class: 'btn sm ghost', style: { alignSelf: 'start' }, onclick: () => { chosen = null; draw(); } }, 'Reset'),  // Reset button: clears the choice and redraws
                  h('div', { class: 'callout why m0 small', 'data-label': 'The rule of thumb', html: 'Consider only partitions big enough for the newcomer, prefer the <b>smallest</b> of them, prefer a <b>blocked</b> owner over a ready one, and weigh <b>priority</b>. Swapping costs disk time, so the OS stops the process that loses least.' }))));  // rule-of-thumb box: big enough, smallest, blocked before ready, weigh priority; closes the columns
            } },  // ends tab 2's render function and its entry
          ]));  // closes the tab list and the tabs widget
        },  // ends render for step 3
      },  // ends step 3
      /* ---------------- 4. Dynamic partitioning playground + compaction ---------------- */
      {  // step 4 begins
        title: 'Dynamic partitions: exact fits, then holes appear',  // step 4 title
        kind: 'lab',  // kind lab: labelled "Hands-on Lab" above the title
        core: true,  // core: keeps this step on the shorter core route through the guide
        render(el, ctx) {  // render(el, ctx): draws step 4
          const { h, s } = ctx;  // h builds page elements and s builds SVG drawing elements
          const TOTAL = 64, OS = 4;  // a 64 MB memory whose first 4 MB belong to the OS
          const PROCS = [['P1', 18], ['P2', 12], ['P3', 20], ['P4', 8], ['P5', 14], ['P6', 6]];  // PROCS: the six processes the student can load, with their sizes in MB
          const W = ctx.narrow ? 380 : 1100;  // W: the width of the memory bar in drawing units, smaller on phone-width screens
          const svg = s('svg', { viewBox: `0 0 ${W + 20} 78`, width: '100%' });  // the drawing that holds the memory bar
          const btnBox = h('div', { class: 'row', style: { gap: '6px' } });  // btnBox: the row of process buttons
          const tiles = h('div', { class: 'grid-3', style: { gap: '8px' } });  // tiles: three number tiles (free total, number of holes, largest hole) side by side
          const narr = h('div', { class: 'card tight small', style: { minHeight: '96px' } });  // narr: the box that describes what the last action did
          const table = h('div');  // table: the box for the table of processes and their addresses
          let procs, prevStart, lastId, gen = 0, busy = false;  // procs lists the loaded processes; prevStart keeps addresses from before a compaction; lastId is the one to highlight; busy blocks clicks while animating
          function draw(view) {  // draw(view): redraws the bar; view is an in-between picture during the compaction animation, otherwise everything is redrawn
            const shown = view || procs;  // shown: the processes to draw, from the animation frame or the real list
            const blocks = [{ start: 0, size: OS, kind: 'os', label: 'OS' }];  // the bar's pieces start with the 4 MB OS
            shown.forEach((p) => blocks.push({ start: p.start, size: p.size, kind: 'proc', label: p.id, sub: p.size + ' MB', hl: p.id === lastId, act: () => end(p.id), aria: 'End ' + p.id }));  // each process becomes a block labelled with its name and size, highlighted if just placed; clicking it ends the process
            if (!view) holesOf(procs, OS, TOTAL).forEach((g) => blocks.push({ start: g.start, size: g.size, kind: 'hole', label: g.size + ' free' }));  // the free holes are added too, except mid-animation when processes are still sliding
            svg.replaceChildren(...memBar(ctx, { x: 10, y: 6, w: W, hgt: 46, total: TOTAL, blocks, ticks: ctx.narrow ? [0, 16, 32, 48, 64] : [0, 8, 16, 24, 32, 40, 48, 56, 64] }));  // draws the bar, with scale marks every 16 MB on phone-width screens and every 8 MB otherwise
            if (view) return;  // during the animation only the bar is redrawn
            const holes = holesOf(procs, OS, TOTAL), free = holes.reduce((a, g) => a + g.size, 0), big = Math.max(0, ...holes.map((g) => g.size));  // holes, the total free MB, and the size of the largest hole
            const tile = (lab, val, cls) => `<div class="card tight center"><div class="xs b muted">${lab}</div><div class="b ${cls || ''}" style="font-size:24px">${val}</div></div>`;  // tile(lab, val, cls): the HTML for one tile: a small grey label over a big number
            tiles.innerHTML = tile('Free in total', free + ' MB') + tile('Number of holes', holes.length, holes.length > 1 ? 'c-warn' : '') + tile('Largest hole', big + ' MB', big < free ? 'c-bad' : 'c-ok');  // the three tiles: holes in amber when there are several, and the largest hole in red when it is smaller than the total free
            const rows = procs.slice().sort((a, b) => a.start - b.start).map((p) => {  // builds one table row per process, in address order
              const was = prevStart && prevStart[p.id] != null && prevStart[p.id] !== p.start ? ` <span class="small c-warn">(was ${prevStart[p.id]})</span>` : '';  // after a compaction, a process that moved shows its old start address in amber
              return `<tr${p.id === lastId ? ' class="on"' : ''}><td class="b">${p.id}</td><td>${p.size} MB</td><td>${p.start} MB${was}</td><td>${p.start + p.size} MB</td></tr>`;  // the row: name, size, start and end address; the process just placed is highlighted
            }).join('');  // joins the rows into one piece of HTML
            table.innerHTML = `<table class="tbl compact"><tr><th>Process</th><th>Size</th><th>Starts at</th><th>Ends at</th></tr>${rows || '<tr><td colspan="4" class="muted">No processes yet.</td></tr>'}</table>`;  // the table with its heading row, or a "No processes yet" row when memory is empty
            btnBox.replaceChildren(...PROCS.map(([id, z]) => {  // rebuilds the process buttons
              const on = procs.some((p) => p.id === id);  // on is true when this process is in memory
              return h('button', { class: 'btn sm' + (on ? ' on' : ''), title: on ? 'End ' + id : 'Load ' + id, onclick: () => (on ? end(id) : load(id, z)) }, `${id} ${z} MB`);  // the button shows name and size; a click ends a loaded process or loads one that is not in memory
            }));  // ends the button list
          }  // ends draw
          function reset() {  // reset(): empties memory; runs at the start and when Reset is pressed
            gen++; busy = false; procs = []; prevStart = null; lastId = null;  // bumps the counter (stopping any animation), clears busy, removes every process and the highlights
            narr.innerHTML = '<b>Memory is empty</b> apart from the 4 MB OS. <span class="muted">Load a process with the buttons; click a process (in the bar or its button) to end it. Placement here: the first hole big enough.</span>';  // starting message: memory is empty, how to load and end processes, and that placement uses the first hole big enough
            draw();  // redraws everything
          }  // ends reset
          function load(id, z) {  // load(id, z): tries to place process id of z MB using first-fit
            if (busy) return;  // ignored while compaction is animating
            prevStart = null;  // clears the old-address notes from the last compaction
            const holes = holesOf(procs, OS, TOTAL), g = holes.find((x) => x.size >= z);  // finds the holes and the first one big enough
            if (!g) {  // if none is big enough...
              const free = holes.reduce((a, x) => a + x.size, 0), big = Math.max(0, ...holes.map((x) => x.size));  // ...adds up the free MB and finds the largest hole
              narr.innerHTML = free >= z  // two possible messages, chosen by whether the free MB would be enough in total:
                ? `<b class="c-bad">${id} (${z} MB) does not fit.</b> ${free} MB is free in total, but it is split into ${holes.length} holes and the largest is only ${big} MB. That is <span class="t">external fragmentation</span>. Press <b>Compact</b>, then try again.`  // enough in total but no single hole fits: external fragmentation, and a hint to press Compact
                : `<b class="c-bad">Not enough memory: ${id} needs ${z} MB</b> but only ${free} MB is free in total, so even compaction cannot help. The OS would have to swap a process out to disk, and choosing which one is a <b>replacement</b> decision.`;  // not enough in total: compaction cannot help, the OS would have to swap a process out (a replacement decision)
              lastId = null; draw(); return;  // no highlight, redraw, and stop
            }  // ends the no-fit case
            procs.push({ id, size: z, start: g.start }); lastId = id;  // places the process at the start of the hole and marks it as just placed
            narr.innerHTML = `<b>${id} (${z} MB)</b> gets a partition of exactly ${z} MB at ${g.start} MB, cut from the first hole big enough (${g.size} MB). ` + (g.size === z ? 'It fills the hole exactly.' : `${Art(g.size - z)} ${g.size - z} MB hole is left behind it.`);  // message: where it went, which hole it was cut from, and the size of any leftover hole (with "a" or "an" as needed)
            draw();  // redraws everything
          }  // ends load
          function end(id) {  // end(id): ends process id and frees its partition
            if (busy) return;  // ignored while compaction is animating
            const p = procs.find((x) => x.id === id); if (!p) return;  // finds the process; if it is not in memory, there is nothing to do
            prevStart = null; lastId = null;  // clears the old-address notes and the highlight
            procs = procs.filter((x) => x !== p);  // removes the process from memory
            const g = holesOf(procs, OS, TOTAL).find((x) => x.start <= p.start && x.start + x.size >= p.start + p.size);  // g is the hole that now covers the freed space
            narr.innerHTML = `<b>${id} ended.</b> Its ${p.size} MB becomes free` + (g && g.size > p.size ? `, and joins the free space beside it to form one ${g.size} MB hole.` : p.start + p.size === TOTAL ? ': a new hole at the end of memory.' : ': a new hole between the partitions around it.');  // message: the freed space either joins free space beside it, forms a new hole at the end of memory, or a new hole between partitions
            draw();  // redraws everything
          }  // ends end
          async function compact() {  // compact(): the Compact button: slides every process down toward the OS, animated, so all free memory forms one block
            if (busy) return;  // ignored if a compaction is already running
            const sorted = procs.slice().sort((a, b) => a.start - b.start);  // the processes in address order
            let a = OS; const target = {};  // a is where the next process will go, starting just after the OS; target will hold each process's new start
            sorted.forEach((p) => { target[p.id] = a; a += p.size; });  // gives each process the next free address, packing them side by side
            const moving = sorted.filter((p) => target[p.id] !== p.start);  // moving lists the processes whose address actually changes
            if (!moving.length) { narr.innerHTML = '<b>Nothing to compact.</b> The processes already sit side by side after the OS, so all free memory is already one block.'; return; }  // if none moves, memory is already compact; a message says so and nothing happens
            const g = ++gen; busy = true; lastId = null;  // starts a new animation run: remembers its number, blocks clicks and clears the highlight
            const from = Object.fromEntries(sorted.map((p) => [p.id, p.start]));  // from: each process's start address before the move
            narr.innerHTML = '<b>Compacting…</b> the OS copies each process toward the OS, one after another.';  // message shown while the processes slide
            for (let k = 1; k <= 16; k++) {  // the animation: 16 frames
              await ctx.sleep(45);  // waits 45 ms between frames
              if (!ctx.alive || g !== gen) return;  // stops if the student left the slide or pressed Reset meanwhile
              const f = k / 16, e = f * f * (3 - 2 * f);  // f is how far along the animation is (0 to 1); e eases it so the motion starts and ends gently
              draw(sorted.map((p) => ({ ...p, start: from[p.id] + (target[p.id] - from[p.id]) * e })));  // draws every process part of the way from its old address to its new one
            }  // ends the animation loop
            busy = false; prevStart = from;  // allows clicks again and keeps the old addresses so the table can show them
            procs = sorted.map((p) => ({ ...p, start: target[p.id] }));  // the processes now really sit at their new addresses
            const movedMB = moving.reduce((t, p) => t + p.size, 0), hole = TOTAL - a;  // movedMB adds up the sizes of the processes that moved; hole is the single free block left at the end
            narr.innerHTML = `<b>Compaction done.</b> ${moving.length} process${moving.length > 1 ? 'es' : ''} (${moving.map((p) => p.id).join(', ')}) moved, so the OS copied <b>${movedMB} MB</b> while ${moving.length > 1 ? 'they' : 'it'} waited. All free memory is now one <b>${hole} MB</b> hole at the end. The moved processes now live at new addresses, which only works with <span class="t">dynamic relocation</span>.`;  // message: which processes moved, how many MB were copied, the one big hole, and why this needs dynamic relocation
            draw();  // redraws everything
          }  // ends compact
          reset();  // starts with empty memory and draws it
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },  // lays out the step: the memory bar on top, two columns below it
            h('div', { class: 'card white', style: { padding: '6px 8px' } }, svg),  // the memory bar in a white card across the full width
            h('div', { class: 'split l', style: { flex: '1', minHeight: '0' } },  // two columns under it, the left one smaller, taking the remaining height
              h('div', { class: 'stack', style: { gap: '10px' } },  // left column, stacked top to bottom
                h('p', { class: 'm0', html: 'With <span class="t">dynamic partitioning</span> nothing is cut in advance: each process gets a partition exactly its own size. No space is wasted inside partitions, but watch what ending processes leaves behind.' }),  // introduction: dynamic partitions are cut to exact size, so watch the gaps that ending processes leave
                btnBox,  // the process buttons
                h('div', { class: 'row', style: { gap: '8px' } },  // a row with the two action buttons
                  h('button', { class: 'btn sm primary', onclick: compact }, 'Compact'),  // Compact button: runs the compaction animation
                  h('button', { class: 'btn sm ghost', onclick: reset }, 'Reset')),  // Reset button: empties memory again
                h('div', { class: 'callout tip m0 small', 'data-label': 'Try this', html: 'Load P1 to P4. End P2 and P4. Now load P5 (14 MB). Enough memory is free, so why does it fail? Then press Compact and try again.' }),  // try-this box: a recipe that makes a 14 MB process fail although enough memory is free, then fixes it with Compact
                h('div', { class: 'callout warn m0 small', 'data-label': 'Compaction is not free', html: 'Every moved byte is copied, moved processes cannot run meanwhile, and their addresses change.' })),  // warning box: the three costs of compaction (copying, waiting, changed addresses); closes the left column
              h('div', { class: 'stack', style: { gap: '10px' } }, tiles, narr, table))));  // right column: the three number tiles, the message box and the process table; closes the layout
        },  // ends render for step 4
      },  // ends step 4
      /* ---------------- 5. The three placement algorithms, scan by scan ---------------- */
      {  // step 5 begins
        title: 'First-fit, best-fit, next-fit: how each one chooses',  // step 5 title
        kind: 'explore',  // kind explore: labelled "Explore" above the title
        render(el, ctx) {  // render(el, ctx): draws step 5
          const { h, s } = ctx;  // h builds page elements and s builds SVG drawing elements
          const TOTAL = 128, OS = 8, PTR = 79;  // a 128 MB memory with an 8 MB OS; PTR (79 MB) is where the last placement ended, after process D
          const USED = [['A', 13, 10], ['B', 36, 14], ['C', 59, 8], ['D', 67, 12], ['E', 82, 6], ['F', 94, 14]].map(([id, start, size]) => ({ id, start, size }));  // USED: six fixed processes A to F, each given as name, start and size in MB, turned into objects
          const HOLES = holesOf(USED, OS, TOTAL).map((g, i) => ({ ...g, name: 'H' + (i + 1) }));  // HOLES: the six free holes between them, named H1 to H6 in address order (5, 13, 9, 3, 6 and 20 MB)
          const ALGS = [  // ALGS: the three placement algorithms with their one-line rules
            { key: 'first', name: 'First-fit', say: 'Scan from the start of memory; take the first hole big enough.' },  // first-fit and its rule
            { key: 'best', name: 'Best-fit', say: 'Look at every hole; take the smallest one big enough (stop early only on an exact fit).' },  // best-fit and its rule
            { key: 'next', name: 'Next-fit', say: 'Start where the last placement ended (after D); take the next hole big enough, wrapping round.' },  // next-fit and its rule
          ];  // closes ALGS
          /* The holes each algorithm examines, in order, and the one it picks (null if none fits). */
          function scan(key, req) {  // scan(key, req): runs one algorithm for a request of req MB and returns the holes it looked at and the hole it chose
            const seen = []; let pick = null;  // seen lists the holes examined, in order; pick is the chosen hole, none yet
            if (key === 'first') { for (const g of HOLES) { seen.push(g); if (g.size >= req) { pick = g; break; } } }  // first-fit: looks at the holes from the bottom of memory and stops at the first one big enough
            else if (key === 'best') { for (const g of HOLES) { seen.push(g); if (g.size >= req && (!pick || g.size < pick.size)) pick = g; if (g.size === req) break; } }  // best-fit: looks at every hole, keeping the smallest one big enough, and stops early only on an exact fit
            else { const k0 = Math.max(0, HOLES.findIndex((g) => g.start >= PTR)); for (let j = 0; j < HOLES.length; j++) { const g = HOLES[(k0 + j) % HOLES.length]; seen.push(g); if (g.size >= req) { pick = g; break; } } }  // next-fit: starts at the first hole after PTR and goes round, wrapping to the bottom, until a hole is big enough
            return { seen, pick };  // hands back both results
          }  // ends scan
          let req = 8, gen = 0, cursor = null, done = {}, shown = {};  // req is the request size (8 MB to start); gen stops old animations; cursor is the hole being looked at; done and shown hold each algorithm's result and trail
          const W = ctx.narrow ? 380 : 1100;  // W: the width of the memory bar, smaller on phone-width screens
          const svg = s('svg', { viewBox: `0 0 ${W + 20} 108`, width: '100%' });  // the drawing for the memory bar
          const rowsBox = h('div', { class: 'stack', style: { gap: '6px' } });  // rowsBox: the stack of three result rows, one per algorithm
          function drawBar() {  // drawBar(): redraws the memory bar with the current scan position and the chosen holes
            const blocks = [{ start: 0, size: OS, kind: 'os', label: 'OS' }];  // the bar's pieces start with the OS
            USED.forEach((p) => blocks.push({ start: p.start, size: p.size, kind: 'proc', label: p.id, sub: p.size }));  // each process as a teal block labelled with its name and size
            HOLES.forEach((g) => blocks.push({ start: g.start, size: g.size, kind: 'hole', label: g.name, sub: g.size + ' MB', hl: cursor === g, cls: cursor === g ? 's-accent' : null }));  // each hole as a dashed block labelled with its name and size; the hole being looked at right now is highlighted in the accent color
            const px = W / TOTAL, kids = memBar(ctx, { x: 10, y: 34, w: W, hgt: 50, total: TOTAL, blocks });  // px is pixels per MB; kids gets the bar's shapes from memBar
            kids.push(s('path', { d: `M${10 + PTR * px},30 l-6,-9 h12 z`, style: 'fill:var(--accent)' }),  // a small accent triangle above the bar at PTR...
              s('text', { x: 10 + PTR * px - 10, y: 16, 'text-anchor': 'end', 'font-size': 12.5, 'font-weight': 700, class: 'tx-acc' }, 'next-fit starts here'));  // ...labelled "next-fit starts here"
            const marks = {};  // marks will list, for each chosen hole, which algorithms chose it
            ALGS.forEach((a) => { const r = done[a.key]; if (r && r.pick) (marks[r.pick.name] = marks[r.pick.name] || []).push(a.name.split('-')[0]); });  // for every algorithm that has finished and found a hole, adds its short name (First, Best or Next) under that hole's name
            Object.entries(marks).forEach(([nm, who]) => { const g = HOLES.find((x) => x.name === nm); kids.push(s('text', { x: 10 + (g.start + g.size / 2) * px, y: 102, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 800, class: 'tx-ok' }, '▲ ' + who.join(', '))); });  // writes the names in green with an upward arrow under each chosen hole
            svg.replaceChildren(...kids);  // replaces the old drawing with the new one
          }  // ends drawBar
          function drawRows() {  // drawRows(): rebuilds the three result rows
            rowsBox.replaceChildren(...ALGS.map((a) => {  // one row per algorithm
              const r = done[a.key], vis = shown[a.key] || [];  // r is its finished result (if any) and vis the holes shown so far in its trail
              const trail = vis.map((g, k) => `<span class="chip ${g.size >= req ? 'ok' : 'bad'}">${g.name} ${g.size}${g.size >= req ? ' ✓' : ' ✗'}</span>`).join(' ');  // trail: one tag per hole examined, green with a tick if it is big enough, red with a cross if not
              const res = r ? (r.pick ? `<b class="c-ok">${r.pick.name}</b>, leaves ${r.pick.size - req} MB · examined ${r.seen.length}` : `<b class="c-bad">no hole fits</b>, though ${HOLES.reduce((a, g) => a + g.size, 0)} MB is free · examined ${r.seen.length}`) : '<span class="muted">?</span>';  // res: the chosen hole and the MB it leaves over, or "no hole fits" though enough is free, plus the number examined; a "?" before scanning
              return h('div', { class: 'card tight', style: { display: 'grid', gridTemplateColumns: ctx.narrow ? '1fr' : '160px minmax(0,1fr) 210px', gap: '8px', alignItems: 'center', padding: '6px 10px' } },  // the row is a card in three columns (one column on phone-width screens)
                h('div', { class: 'row', style: { gap: '8px' } }, h('span', { class: 'b', style: { minWidth: '76px' } }, a.name), h('button', { class: 'btn sm', onclick: () => run([a.key]) }, 'Scan')),  // first column: the algorithm's name and its own Scan button
                h('div', { class: 'stack gap-s' }, h('div', { class: 'xs muted' }, a.say), h('div', { class: 'row', style: { gap: '4px', minHeight: '22px' }, html: trail })),  // second column: the rule in small grey text, with the growing trail of tags under it
                h('div', { class: 'small', html: res }));  // third column: the result
            }));  // ends the row list
          }  // ends drawRows
          async function run(keys) {  // run(keys): animates the scans of the listed algorithms one after another
            const g = ++gen;  // starts a new run and remembers its number
            for (const key of keys) {  // one algorithm at a time
              const r = scan(key, req);  // works out the whole scan at once; the loop below only reveals it
              delete done[key]; shown[key] = [];  // clears this algorithm's old result and trail
              for (const hole of r.seen) {  // visits each examined hole in turn
                cursor = hole; shown[key] = shown[key].concat(hole); drawBar(); drawRows();  // highlights the hole, adds it to the trail and redraws the bar and rows
                await ctx.sleep(420);  // waits 420 ms so the student can follow the scan
                if (!ctx.alive || g !== gen) return;  // stops if the student left the slide or started something else meanwhile
              }  // ends the loop over holes
              done[key] = r; cursor = null; drawBar(); drawRows();  // stores the result, clears the highlight and redraws, so the chosen hole is marked
            }  // ends the loop over algorithms
          }  // ends run
          function setReq(v) { gen++; req = v; cursor = null; done = {}; shown = {}; drawBar(); drawRows(); }  // setReq(v): sets a new request size and clears every result, stopping any scan in progress
          const seg = ctx.ui.seg([4, 8, 12, 16, 24].map((v) => ({ value: v, label: v + ' MB' })), req, setReq);  // the request size switch: 4, 8, 12, 16 or 24 MB; picking one calls setReq
          setReq(req);  // draws the starting state for the default request
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },  // lays out the step top to bottom
            h('div', { class: 'card white', style: { padding: '4px 8px' } }, svg),  // the memory bar in a white card
            h('div', { class: 'row', style: { gap: '10px' } }, h('span', { class: 'small', html: 'A <span class="t">placement algorithm</span> picks the hole. A new process needs' }), seg,  // a control row: a sentence leading into the request switch...
              h('button', { class: 'btn sm primary', onclick: () => run(['first', 'best', 'next']) }, 'Scan all three'),  // ...the "Scan all three" button, which runs first-fit, then best-fit, then next-fit
              h('button', { class: 'btn sm ghost', onclick: () => setReq(req) }, 'Clear'),  // Clear button: removes every result for the same request
              h('span', { class: 'small muted grow', html: 'Predict each choice first.' })),  // a reminder to predict before scanning
            rowsBox,  // the three result rows
            h('div', { class: 'grid-3', style: { gap: '10px' } },  // three boxes side by side giving each algorithm's typical behavior
              h('div', { class: 'callout tip m0 small', 'data-label': 'First-fit: often the best', html: 'The simplest and fastest rule, and in classic studies often the best overall. Its cost: small leftovers pile up near the start of memory, and every search must step past them.' }),  // first-fit box: simplest, fastest and often best, but small leftovers gather near the start of memory
              h('div', { class: 'callout bad m0 small', 'data-label': 'Best-fit: usually the worst', html: 'Each placement leaves the smallest leftover possible, so memory soon fills with slivers too small for any request. It must also examine every hole unless it finds an exact fit.' }),  // best-fit box: usually the worst, because its tiny leftovers pile up, and it examines every hole
              h('div', { class: 'callout warn m0 small', 'data-label': 'Next-fit: compacts more often', html: 'Placements creep through memory and soon carve up the big free block at the end, so large requests fail and compaction is needed more often than with first-fit.' }))));  // next-fit box: it carves up the big free block at the end, so it needs compaction more often; closes the layout
        },  // ends render for step 5
      },  // ends step 5
      /* ---------------- 6. Placement race on one request sequence ---------------- */
      {  // step 6 begins
        title: 'Placement race: same requests, three algorithms',  // step 6 title
        kind: 'lab',  // kind lab: labelled "Hands-on Lab" above the title
        render(el, ctx) {  // render(el, ctx): draws step 6
          const { h, s } = ctx;  // h builds page elements and s builds SVG drawing elements
          const ALGS = [['first', 'First-fit'], ['best', 'Best-fit'], ['next', 'Next-fit']];  // ALGS: the three racers, each as [key, name]
          const W = ctx.narrow ? 380 : 1080;  // W: the width of each memory bar, smaller on phone-width screens
          let seed = 33, seq, step, st, timer = null, gen = 0;  // seed numbers the request sequence (33 first); seq is its 24 requests; step counts those handled; st holds each memory; timer runs Run to end
          const strip = h('div', { class: 'row', style: { gap: '3px' } });  // strip: the row of request tags at the top
          const counter = h('span', { class: 'small b' });  // counter: the "Sequence 33 · request 5 of 24" text at the right of the button row
          const cards = {}, svgs = {}, heads = {};  // cards, svgs and heads: for each algorithm, its card, its memory drawing and its row of counters
          const summary = h('div', { class: 'callout m0 small' });  // summary: the box under the three memories, a reading guide during the race and the results at the end
          ALGS.forEach(([k, name]) => {  // builds one card per algorithm
            svgs[k] = s('svg', { viewBox: `0 0 ${W + 20} 54`, width: '100%' });  // the drawing for this algorithm's memory bar
            heads[k] = h('div', { class: 'row', style: { gap: '6px' } });  // the row of counters above the bar
            cards[k] = h('div', { class: 'card tight', style: { padding: '6px 10px 2px' } }, heads[k], svgs[k]);  // the card holding the counters and the bar
          });  // ends the card loop
          function stop() { if (timer) { clearInterval(timer); timer = null; } }  // stop(): halts Run to end if it is playing
          function reset(newSeed) {  // reset(newSeed): starts the race over, with a different sequence if newSeed is given
            stop(); gen++;  // stops any run and bumps the counter so a pending tick is ignored
            if (newSeed != null) seed = newSeed;  // switches to the new sequence number if one was given
            seq = raceSeq(ctx.util.seeded(seed)); step = 0;  // makes the 24 requests with a seeded random generator (the same number always gives the same list) and rewinds to request 0
            st = Object.fromEntries(ALGS.map(([k]) => [k, raceNew()]));  // gives each algorithm a fresh, empty memory
            draw();  // redraws everything
          }  // ends reset
          function next() {  // next(): handles the next request in all three memories at once
            if (step >= seq.length) { stop(); return; }  // at the end of the list, just stops
            ALGS.forEach(([k]) => raceStep(st[k], k, seq[step], step));  // plays this time step in each memory: departures first, then the new request, with compaction if needed
            step++;  // moves on to the next request
            if (step >= seq.length) stop();  // stops Run to end after the last request
            draw();  // redraws everything
          }  // ends next
          function run() {  // run(): the Run to end / Pause button
            if (timer) { stop(); draw(); return; }  // if already running, pauses and redraws
            if (step >= seq.length) reset();  // if the race is over, starts it again from the beginning
            const g = gen;  // g remembers the current run
            timer = ctx.every(330, () => { if (g !== gen) { stop(); return; } next(); });  // handles one request every 330 ms until stopped; a tick from an outdated run stops itself
            draw();  // redraws so the button reads Pause
          }  // ends run
          function lastSay(x) {  // lastSay(x): describes the latest request in memory x for the right end of its counter row
            const L = x.last; if (!L) return '';  // L is the record of the latest request; before any request there is nothing to say
            if (L.kind === 'rej') return `<span class="c-bad">#${L.req.id} turned away: not enough free memory even in total</span>`;  // a turned-away request is reported in red
            const tail = L.left > 0 && L.left < RACE.MIN ? ` <span class="c-bad">(leaves a ${L.left} MB sliver)</span>` : '';  // tail: a red note when the placement left a sliver (a leftover under 4 MB)
            return (L.kind === 'comp' ? `<span class="c-warn b">compacted (moved ${L.moved} MB)</span>, then ` : '') + `#${L.req.id} (${L.req.size} MB) → ${L.at} MB${tail}`;  // "compacted (moved N MB), then" when compaction came first, followed by the request number, size and address
          }  // ends lastSay
          function draw() {  // draw(): redraws the request strip, the three memories and the summary
            strip.replaceChildren(h('span', { class: 'xs b muted', style: { marginRight: '4px' } }, 'REQUESTS (MB)'), ...seq.map((r, i) => h('span', {  // the request strip: a small heading, then one tag per request showing its size...
              class: 'chip mono' + (i < step ? ' proc' : ''), title: `#${r.id}: ${r.size} MB, stays ${r.life} steps`,  // ...teal once handled, with a tooltip giving its size and how long it stays...
              style: i === step - 1 ? { outline: '2px solid var(--accent)' } : i >= step ? { opacity: '.6' } : null }, String(r.size))));  // ...the latest one outlined in the accent color, the ones still to come faded
            counter.textContent = `Sequence ${seed} · request ${step} of ${seq.length}`;  // the counter text: sequence number and progress
            ALGS.forEach(([k, name]) => {  // redraws each algorithm's card
              const x = st[k], holes = holesOf(x.procs, RACE.OS, RACE.TOTAL);  // x is this algorithm's memory and holes its free holes
              heads[k].innerHTML = `<b style="min-width:76px">${name}</b><span class="chip ${x.comp ? 'warn' : ''}">compactions ${x.comp}${x.comp ? ' · ' + x.moved + ' MB moved' : ''}</span>` +  // counter row: the name, then compactions so far (amber, with MB moved, once there are any)...
                `<span class="chip">holes examined ${x.exam}</span><span class="chip ${x.tiny ? 'bad' : ''}" title="Leftover holes under ${RACE.MIN} MB that this algorithm has created so far">slivers made ${x.tiny}${x.tiny ? ' · ' + x.tinyMB + ' MB' : ''}</span><span class="small muted grow" style="text-align:right">${lastSay(x)}</span>`;  // ...holes examined, slivers made (red once there are any, with their total MB), and the latest action at the right
              const blocks = [{ start: 0, size: RACE.OS, kind: 'os', label: 'OS' }];  // the bar's pieces start with the OS
              x.procs.forEach((p) => blocks.push({ start: p.start, size: p.size, kind: 'proc', label: '#' + p.id, hl: x.last && x.last.req && x.last.req.id === p.id }));  // each process as a block labelled with its request number; the one just placed is highlighted
              holes.forEach((g) => blocks.push({ start: g.start, size: g.size, kind: 'hole', label: String(g.size), cls: g.size < RACE.MIN ? 's-bad' : null }));  // each hole as a block labelled with its size; a sliver is drawn in red
              const kids = memBar(ctx, { x: 10, y: 4, w: W, hgt: 40, total: RACE.TOTAL, blocks });  // draws the memory bar
              if (k === 'next') { const px = 10 + (x.ptr * W) / RACE.TOTAL; kids.push(s('path', { d: `M${px},44 l-6,9 h12 z`, style: 'fill:var(--accent)' })); }  // next-fit's card also gets an accent triangle under the bar where its next search will start
              svgs[k].replaceChildren(...kids);  // replaces the old drawing with the new one
            });  // ends the card loop
            bNext.disabled = step >= seq.length; bRun.textContent = timer ? 'Pause' : 'Run to end';  // greys out Next request at the end, and labels the run button Pause while playing
            if (step < seq.length) {  // during the race...
              summary.className = 'callout tip m0 small'; summary.dataset.label = 'How to read it';  // ...the summary is a green tip box headed "How to read it"...
              summary.innerHTML = `All three memories get the same 24 requests, and each process stays the same number of steps in every memory. If no hole is big enough, the OS compacts and then places the request (or turns it away if even the total free space is too small). A red hole is a <b>sliver</b>: a leftover under ${RACE.MIN} MB, smaller than any request here. The triangle marks where next-fit resumes.`;  // ...explaining the shared requests, compaction, rejections, red slivers and the next-fit triangle
            } else {  // when the race is over, the summary reports the results
              /* The algorithms that share the lowest (lo) or highest value of f, and that value. */
              const top = (f, lo) => { const v = ALGS.map(([k]) => f(st[k])), m = lo ? Math.min(...v) : Math.max(...v); return { m, keys: ALGS.filter((a, i) => v[i] === m).map((a) => a[0]) }; };  // top(f, lo): finds which algorithms share the lowest (lo) or highest value of a counter, and that value
              const names = (r) => (r.keys.length === ALGS.length ? 'all three' : r.keys.map((k) => ALGS.find((a) => a[0] === k)[1]).join(' and '));  // names(r): those algorithms written out, or "all three" if they all tie
              const sl = top((x) => x.tiny, false), cp = top((x) => x.comp, true), ex = top((x) => x.exam, false);  // sl: most slivers; cp: fewest compactions; ex: most holes examined
              let why = '';  // why: an explanation that depends on this particular race
              if (sl.m && sl.keys.includes('best')) {  // if there were slivers and best-fit made the most (alone or tied)...
                why = `Best-fit ${sl.keys.length > 1 ? 'tied for' : 'made'} the most slivers: that pile-up is why it usually ranks last.`;  // ...says that this pile-up is why best-fit usually ranks last
                if (cp.keys.includes('best') && cp.keys.length < ALGS.length) why += ' Yet it ' + (cp.m ? `needed ${cp.keys.length === 1 ? 'the fewest' : 'no more'} compactions` : 'never had to compact') + ' here: it tends to keep the big end hole whole for big requests' + (cp.m ? ', and each compaction sweeps its slivers away.' : '.');  // and if best-fit also had the fewest compactions (without a three-way tie), explains that it keeps the big end hole whole
              } else if (sl.m) why = 'Here best-fit did not make the most slivers: the mix of sizes and lifetimes decides.';  // if another algorithm made the most slivers, says that the mix of requests decides
              summary.className = 'callout why m0 small'; summary.dataset.label = 'Result of this sequence (computed)';  // the summary becomes a blue box headed "Result of this sequence (computed)"
              summary.innerHTML = `Most slivers: <b>${sl.m ? names(sl) + ' (' + sl.m + ')' : 'none'}</b> · fewest compactions: <b>${names(cp)} (${cp.m})</b> · most holes examined: <b>${names(ex)} (${ex.m})</b>. ${why}` +  // the computed results: most slivers, fewest compactions and most holes examined, with the explanation...
                '<div style="margin-top:3px"><b>The standard verdict to know:</b> first-fit is usually the simplest, the fastest and often the best; next-fit carves up the big end block, so it compacts more often; best-fit is usually the worst, because its slivers pile up. Real rankings depend on the workload.</div>';  // ...followed by the standard verdict on the three algorithms, which holds for typical workloads
            }  // ends the end-of-race case
          }  // ends draw
          const bNext = h('button', { class: 'btn sm primary', onclick: () => { stop(); next(); } }, 'Next request');  // Next request button: pauses any run and handles one request
          const bRun = h('button', { class: 'btn sm', onclick: run }, 'Run to end');  // Run to end button: plays the remaining requests automatically
          reset();  // sets up the first race
          el.append(h('div', { class: 'stack fill', style: { gap: '8px' } },  // lays out the step top to bottom
            h('div', { class: 'row', style: { gap: '8px' } }, bNext, bRun,  // a row of controls: Next request and Run to end...
              h('button', { class: 'btn sm', onclick: () => reset(seed + 1) }, 'New sequence'),  // ...New sequence, which moves to the next sequence number...
              h('button', { class: 'btn sm ghost', onclick: () => reset() }, 'Reset'), h('div', { class: 'grow' }), counter),  // ...Reset, a spacer, and the counter at the right end
            strip, cards.first, cards.best, cards.next, summary));  // then the request strip, the three memory cards and the summary
        },  // ends render for step 6
      },  // ends step 6
      /* ---------------- 7. Buddy system ---------------- */
      {  // step 7 begins
        title: 'The buddy system: split in halves, merge with your buddy',  // step 7 title
        kind: 'lab',  // kind lab: labelled "Hands-on Lab" above the title
        core: true,  // core: keeps this step on the shorter core route
        render(el, ctx) {  // render(el, ctx): draws step 7
          const { h, s } = ctx;  // h builds page elements and s builds SVG drawing elements
          const U = 1024, L = 64, SIZES = [1024, 512, 256, 128, 64];  // memory is 1024 KB (U), the smallest block is 64 KB (L), and SIZES lists the five block sizes from largest to smallest
          const SCRIPT = [['A', 90], ['B', 200], ['C', 40], ['D', 120], ['free', 'B'], ['E', 250], ['free', 'A'], ['free', 'C'], ['free', 'D'], ['free', 'E']];  // SCRIPT: the sample run: A to D ask for memory, B frees, E asks, then everyone frees in turn
          let leaves, pc, gen = 0, busy = false, nextLetter, hot = null;  // leaves lists the current blocks; pc is the next sample action; busy blocks clicks during an animation; nextLetter names custom requests; hot is the block to highlight
          const W = ctx.narrow ? 316 : 1020, X0 = ctx.narrow ? 68 : 84;  // W is the width of each level's bar and X0 the room on the left for the size labels; both smaller on phone-width screens
          const svg = s('svg', { viewBox: `0 0 ${X0 + W + 22} 200`, width: '100%' });  // the drawing: five levels of blocks and a memory row
          const lists = h('div'), log = h('div', { class: 'log', style: { height: '172px' } }), stats = h('div', { class: 'row', style: { gap: '5px', flex: 'none' } });  // lists: the free-list table; log: a scrolling list of every split and merge, newest first; stats: a row of summary tags
          const bScript = h('button', { class: 'btn sm primary', onclick: () => scriptStep() });  // bScript: the sample button that plays the next scripted action; its label changes as the script goes on
          let reqKB = 100;  // reqKB: the size the slider is set to for the student's own request, 100 KB at first
          const slider = ctx.ui.slider({ label: 'Request', min: 1, max: 1024, value: reqKB, format: (v) => v + ' KB', onInput: (v) => { reqKB = v; } });  // the request-size slider, 1 to 1024 KB, shown in KB; moving it only stores the value until Request it is pressed
          const blockFor = (kb) => { let z = L; while (z < kb) z *= 2; return z; };  // blockFor(kb): the buddy block size for a request: doubles from 64 KB until it holds kb (100 KB gives 128 KB)
          const say = (html) => { log.prepend(h('div', { html })); };  // say(html): adds a line to the top of the log, so the newest event is always visible
          function reset() {  // reset(): returns to one free 1024 KB block; runs at the start and when Reset is pressed
            gen++; busy = false; leaves = [{ addr: 0, size: U, owner: null, req: 0 }]; pc = 0; nextLetter = 5; hot = null;  // stops any animation, clears busy, makes one free block covering all memory, rewinds the sample, and restarts custom names at F
            log.replaceChildren(h('div', { html: 'One free block of 1024 KB. Smallest block allowed: 64 KB.' }));  // the log starts with one line describing the starting state
            draw();  // redraws everything
          }  // ends reset
          function draw() {  // draw(): redraws the levels, the memory row, the free-list table, the tags and the sample button
            const kids = [], px = W / U, RH = 21;  // kids collects the shapes; px is pixels per KB; RH is the height of one level's bar
            SIZES.forEach((z, d) => {  // one bar per block size, from 1024 KB at the top down to 64 KB; d is the level number
              const y = 4 + d * (RH + 3);  // y is this level's top
              kids.push(s('text', { x: X0 - 8, y: y + 15, 'text-anchor': 'end', 'font-size': 12.5, 'font-weight': 700, class: 's-sub' }, z + ' KB'));  // the block size written to the left of the level
              for (let a = 0; a < U; a += z) {  // walks along memory in steps of this level's block size; a is the start of each possible block
                const lf = leaves.find((b) => b.addr <= a && a < b.addr + b.size);  // lf is the current block that covers address a
                if (lf.size < z) kids.push(s('rect', { x: X0 + a * px, y, width: z * px, height: RH, class: 's-panel', 'stroke-width': 1, opacity: 0.8 }),  // if that block is smaller than this level's size, this slot has been split: a grey box...
                  ...(z * px > 40 ? [s('text', { x: X0 + (a + z / 2) * px, y: y + 15, 'text-anchor': 'middle', 'font-size': 12, class: 's-sub' }, 'split')] : []));  // ...labelled "split" when it is wide enough
                else if (lf.size === z) {  // if the block is exactly this level's size, it is drawn here:
                  const isHot = hot && hot.addr === a && hot.size === z;  // isHot is true for the block just split, given or merged, so it stands out
                  kids.push(s('rect', { x: X0 + a * px, y, width: z * px, height: RH, class: lf.owner ? 's-proc' : 's-hole', 'stroke-width': isHot ? 3 : 1.5, style: isHot ? 'stroke:var(--accent)' : null }));  // teal if someone owns it, dashed if free; the highlighted block gets a thick accent outline
                  const lab = lf.owner ? lf.owner : 'free';  // the label is the owner's letter, or "free"
                  if (z * px > 26) kids.push(s('text', { x: X0 + (a + z / 2) * px, y: y + 15, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': lf.owner ? 800 : 400, class: lf.owner ? null : 's-sub' }, lab));  // the label is written in the middle when the block is wide enough
                }  // ends the exact-size case (a bigger block draws nothing at this level, since it lives higher up)
              }  // ends the walk along memory
            });  // ends the loop over levels
            const by = 140, BH = 40;  // by and BH: the top and height of the memory row under the levels
            kids.push(s('text', { x: X0 - 8, y: by + 25, 'text-anchor': 'end', 'font-size': 12.5, 'font-weight': 700 }, 'Memory'));  // the word Memory to the left of that row
            leaves.slice().sort((a, b) => a.addr - b.addr).forEach((b) => {  // draws every current block in the memory row, in address order
              const x = X0 + b.addr * px, w = b.size * px, g = [];  // x and w place the block; g collects its shapes
              if (b.owner) {  // a used block...
                g.push(s('rect', { x, y: by, width: w, height: BH, class: 's-waste', 'stroke-width': 1.5 }), s('rect', { x, y: by, width: (b.req / b.size) * w, height: BH, class: 's-proc', 'stroke-width': 1.5 }));  // ...is amber (wasted) across its full size, with teal over the part the request really uses
                if (w > 44) g.push(s('text', { x: x + 6, y: by + 17, 'font-size': 13, 'font-weight': 800 }, b.owner), s('text', { x: x + 6, y: by + 33, 'font-size': 12, class: 's-sub' }, `${b.req}/${b.size}`));  // when wide enough, the owner's letter and "used/size" in KB are written inside it
              } else {  // a free block...
                g.push(s('rect', { x, y: by, width: w, height: BH, class: 's-hole', 'stroke-width': 1.5 }));  // ...is a dashed box...
                if (w > 40) g.push(s('text', { x: x + w / 2, y: by + 25, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, b.size + ' free'));  // ...labelled with its size and "free" when wide enough
              }  // ends the used-or-free choice
              kids.push(b.owner && !busy ? hotGroup(ctx, () => free(b.owner), 'Free block ' + b.owner, ...g) : s('g', {}, ...g));  // a used block can be clicked to free it, except during an animation; other blocks are plain groups
            });  // ends the memory row loop
            kids.push(s('rect', { x: X0, y: by, width: W, height: BH, fill: 'none', class: 's-line', 'stroke-width': 2 }));  // a thick outline around the memory row
            [0, 256, 512, 768, 1024].forEach((a) => kids.push(s('text', { x: X0 + a * px, y: by + BH + 16, 'text-anchor': 'middle', 'font-size': 12, class: 's-sub' }, String(a))));  // address marks under the row at 0, 256, 512, 768 and 1024 KB
            svg.replaceChildren(...kids);  // replaces the old drawing with the new one
            lists.innerHTML = '<table class="tbl compact"><tr><th>Free list</th><th>Free blocks (start, KB)</th></tr>' + SIZES.map((z) => {  // the free-list table: one row per block size...
              const f = leaves.filter((b) => !b.owner && b.size === z).map((b) => b.addr).sort((a, b) => a - b);  // ...f lists the start addresses of the free blocks of that size, lowest first...
              return `<tr><td class="b">${z} KB</td><td>${f.length ? f.map((a) => `<span class="chip mem">${a}</span>`).join(' ') : '<span class="muted">empty</span>'}</td></tr>`;  // ...shown as green tags, or the word "empty"
            }).join('') + '</table>';  // ends the table
            const used = leaves.filter((b) => b.owner), waste = used.reduce((t, b) => t + b.size - b.req, 0), freeKB = leaves.filter((b) => !b.owner).reduce((t, b) => t + b.size, 0);  // used lists the owned blocks; waste adds up their unused KB; freeKB adds up every free block
            stats.innerHTML = `<span class="chip mem">${freeKB} KB free</span><span class="chip proc">${used.length} block${used.length === 1 ? '' : 's'} in use</span><span class="chip warn">${waste} KB wasted inside blocks</span>`;  // the summary tags: KB free, blocks in use, and KB wasted inside blocks (internal fragmentation)
            const op = SCRIPT[pc];  // op is the next sample action
            bScript.textContent = !op ? 'Sample done' : op[0] === 'free' ? `Sample: ${op[1]} frees its block` : `Sample: ${op[0]} asks for ${op[1]} KB`;  // the sample button's label: the next request or free, or "Sample done" at the end
            bScript.disabled = !op || busy;  // the sample button is greyed out at the end and during an animation
          }  // ends draw
          async function alloc(who, kb) {  // alloc(who, kb): gives who a block for a request of kb KB, splitting bigger blocks in halves on screen
            const need = blockFor(kb);  // need is the block size this request requires
            if (kb > U) return;  // a request bigger than all of memory is ignored
            const cands = leaves.filter((b) => !b.owner && b.size >= need).sort((a, b) => a.size - b.size || a.addr - b.addr);  // cands: the free blocks of at least that size, smallest first, then lowest address
            if (!cands.length) { say(`<b>${who}</b> asks for ${kb} KB: needs a ${need} KB block, but no free block of ${need} KB or more exists. <span class="c-bad b">Request fails</span>.`); draw(); return; }  // if there is none, the log says the request fails and nothing else happens
            const g = gen; busy = true;  // remembers the current run and blocks clicks during the animation
            let b = cands[0];  // b starts as the smallest suitable free block
            say(`<b>${who}</b> asks for ${kb} KB → block size <b>${need} KB</b>, ` + (need > L ? `since ${need / 2} < ${kb} ≤ ${need}.` : `the smallest block allowed.`));  // logs the request and why that block size: half of it would be too small (or it is already the smallest allowed)
            while (b.size > need) {  // while the block is still bigger than needed...
              const half = b.size / 2, lo = { addr: b.addr, size: half, owner: null, req: 0 }, hi = { addr: b.addr + half, size: half, owner: null, req: 0 };  // ...cuts it into two halves (buddies): lo at the same start, hi starting half-way along
              leaves = leaves.filter((x) => x !== b).concat(lo, hi); hot = lo;  // replaces the block with its two halves and highlights the lower one
              say(`Split the ${b.size} KB block at ${b.addr} into two ${half} KB buddies (at ${lo.addr} and ${hi.addr}).`);  // logs the split with both new addresses
              draw(); await ctx.sleep(500);  // redraws and pauses half a second so the split can be seen
              if (!ctx.alive || g !== gen) return;  // stops if the student left the slide or pressed Reset meanwhile
              b = lo;  // carries on with the lower half
            }  // ends the splitting loop
            b.owner = who; b.req = kb; hot = b; busy = false;  // the block now has the right size: it is given to who, highlighted, and clicks are allowed again
            say(`<b>${who}</b> gets the ${need} KB block at ${b.addr}; ${need - kb} KB inside it is wasted.`);  // logs the result and the KB wasted inside the block
            draw();  // redraws everything
          }  // ends alloc
          async function free(who) {  // free(who): frees who's block and merges it with its buddy, again and again, as far as possible
            if (busy) return;  // ignored during an animation
            let b = leaves.find((x) => x.owner === who);  // b is the block who owns
            if (!b) { say(`${who} is not in memory, so there is nothing to free.`); draw(); return; }  // if who has no block, the log says so and nothing else happens
            const g = gen; busy = true;  // remembers the current run and blocks clicks during the animation
            b.owner = null; b.req = 0; hot = b;  // the block becomes free and is highlighted
            say(`<b>${who}</b> frees its ${b.size} KB block at ${b.addr}.`);  // logs the free
            draw();  // redraws everything
            while (b.size < U) {  // keeps trying to merge until the block is the whole memory
              const ba = b.addr ^ b.size, bud = leaves.find((x) => x.addr === ba && x.size === b.size && !x.owner);  // the buddy's address is the block's address with the bit worth its size flipped (XOR); bud is that block if it is free and the same size
              await ctx.sleep(500);  // pauses half a second before each merge step
              if (!ctx.alive || g !== gen) return;  // stops if the student left the slide or pressed Reset meanwhile
              if (!bud) { say(`Its buddy (the ${b.size} KB block at ${ba}) is in use or split, so merging stops here.`); break; }  // if the buddy is in use or split into smaller blocks, merging stops here, and the log says why
              const parent = { addr: Math.min(b.addr, ba), size: b.size * 2, owner: null, req: 0 };  // otherwise the two buddies become one parent block twice the size, starting at the lower address
              leaves = leaves.filter((x) => x !== b && x !== bud).concat(parent); hot = parent;  // replaces both buddies with the parent and highlights it
              say(`Its buddy at ${ba} is free too → merge into one ${parent.size} KB block at ${parent.addr}.`);  // logs the merge
              draw(); b = parent;  // redraws and carries on from the parent block
            }  // ends the merging loop
            busy = false; draw();  // allows clicks again and redraws
          }  // ends free
          function scriptStep() {  // scriptStep(): the sample button: plays the next scripted action
            if (busy || pc >= SCRIPT.length) return;  // ignored during an animation or once the script is finished
            const [a, b] = SCRIPT[pc++];  // reads the next action and moves the script position on
            if (a === 'free') free(b); else alloc(a, b);  // a free action frees that letter's block; any other action is a request
          }  // ends scriptStep
          /* Names your own requests F to Z, skipping any letter that still owns a block (at most 16 blocks exist at once). */
          function custom() {  // custom(): the Request it button: asks for the slider's size under the next unused letter
            if (busy) return;  // ignored during an animation
            let who;  // who will be the letter for this request
            do { who = String.fromCharCode(65 + nextLetter); nextLetter = nextLetter >= 25 ? 5 : nextLetter + 1; } while (leaves.some((b) => b.owner === who));  // tries letters from F onward (65 is the code of A), wrapping from Z back to F, and skips any letter that still owns a block
            alloc(who, reqKB);  // requests the slider's size under that letter
          }  // ends custom
          reset();  // starts with one free 1024 KB block and draws it
          el.append(h('div', { class: 'stack fill', style: { gap: '8px' } },  // lays out the step top to bottom
            h('div', { class: 'row', style: { gap: '10px' } }, bScript, h('div', { style: { width: '250px' } }, slider),  // a control row: the sample button, then the request slider in a 250-pixel box...
              h('button', { class: 'btn sm', onclick: custom }, 'Request it'), h('button', { class: 'btn sm ghost', onclick: reset }, 'Reset'),  // ...the Request it button for the slider's size and the Reset button...
              h('span', { class: 'small muted grow', html: 'Click a used block in the memory row to free it.' })),  // ...and a hint that a used block in the memory row can be clicked to free it
            h('div', { class: 'card white', style: { padding: '6px 8px' } }, svg),  // the levels and memory row in a white card
            h('div', { style: { display: 'grid', gridTemplateColumns: ctx.narrow ? '1fr' : '1.1fr 1.3fr 1fr', gap: '12px', flex: '1', minHeight: '0' } },  // three columns below (one on phone-width screens), filling the remaining height
              lists, log,  // the free-list table and the log
              h('div', { class: 'stack', style: { gap: '8px' } }, stats,  // third column: the summary tags...
                h('div', { class: 'callout why m0 small', 'data-label': 'The rules', html: 'Sizes are powers of two (here 64 to 1024 KB). A request gets the smallest one that holds it, made by halving bigger blocks. A freed block merges with its <span class="t">buddy</span> if that is free, level after level.' }),  // ...the rules box: power-of-two sizes, the smallest block that holds a request, halving, and merging with a free buddy
                h('p', { class: 'xs muted m0', html: 'Variants of this allocator manage physical pages inside real kernels, Linux’s page allocator among them.' })))));  // a small note that real kernels use variants of this allocator for physical pages; closes the layout
        },  // ends render for step 7
      },  // ends step 7
      /* ---------------- 8. Relocation: base and bounds registers ---------------- */
      {  // step 8 begins
        title: 'Relocation: base and bounds registers',  // step 8 title
        kind: 'lab',  // kind lab: labelled "Hands-on Lab" above the title
        render(el, ctx) {  // render(el, ctx): draws step 8
          const { h, s } = ctx;  // h builds page elements and s builds SVG drawing elements
          const MEM = 100000, LEN = 12000, OLD = 40000, NEW = 76000, LOOP = 1200;  // a 100,000-byte memory; process P is 12,000 bytes long, first at 40,000 then at 76,000; its loop starts 1,200 bytes into P
          /* ---- shared drawing of a 0..100,000 memory bar with labelled regions ---- */
          function bar(x, y, w, regions, mark) {  // bar(x, y, w, regions, mark): draws memory as a strip of labelled regions, used by both tabs of this step
            const px = w / MEM, out = [];  // px is pixels per byte; out collects the shapes
            regions.forEach(([a, b, lab, cls]) => {  // each region is [start, end, label, style class]
              out.push(s('rect', { x: x + a * px, y, width: (b - a) * px, height: 34, class: cls, 'stroke-width': 1.5 }));  // the region's rectangle, scaled from bytes to pixels
              if ((b - a) * px > 30) out.push(s('text', { x: x + ((a + b) / 2) * px, y: y + 22, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, class: cls === 's-hole' ? 's-sub' : null }, lab));  // its label in the middle, if the region is wide enough (grey for free space)
            });  // ends the loop over regions
            out.push(s('rect', { x, y, width: w, height: 34, fill: 'none', class: 's-line', 'stroke-width': 2 }));  // a thick outline around the whole strip
            if (mark) out.push(s('path', { d: `M${x + mark.at * px},${y - 2} l-6,-10 h12 z`, style: mark.ok ? 'fill:var(--ok)' : 'fill:var(--bad)' }));  // if mark is given, a triangle above the strip at that address: green if the access is allowed, red if not
            return out;  // hands back the shapes
          }  // ends bar
          /* ---- tab 1: the translation hardware ---- */
          const tabLab = (p) => {  // tabLab(p): fills the first tab with the translation hardware and its controls
            let base = OLD, rel = LOOP;  // base is P's start (40,000 at first); rel is the relative address being tried (the loop at 1,200 at first)
            const svg = s('svg', { viewBox: '0 0 640 262', width: '100%' });  // the drawing of the translation pipeline and memory
            const narr = h('div', { class: 'card tight small', style: { minHeight: '64px' } });  // narr: the box that spells out the sum and the verdict
            function draw() {  // draw(): redraws the pipeline, the memory strip and the explanation; runs after every change
              const bounds = base + LEN, phys = rel + base, ok = phys < bounds;  // bounds is the first address past P's partition; phys is the translated address; ok is true when phys is below the bounds
              const box = (x, y, w, t1, t2, cls) => [s('rect', { x, y, width: w, height: 46, rx: 8, class: cls, 'stroke-width': 2 }),  // box(): a rounded register box with a small grey caption on top...
                s('text', { x: x + w / 2, y: y + 18, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, t1),  // ...the caption line...
                s('text', { x: x + w / 2, y: y + 37, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 800, class: 's-monot' }, t2)];  // ...and the value in large fixed-width digits
              const verdict = (x, y, anchor) => [  // verdict(): the two-line result at the end of the pipeline...
                s('text', { x, y, 'text-anchor': anchor, 'font-size': 14, 'font-weight': 800, class: ok ? 'tx-ok' : 'tx-bad' }, ok ? 'yes:' : 'no:'),  // ...yes or no, in green or red...
                s('text', { x, y: y + 18, 'text-anchor': anchor, 'font-size': 13.5, 'font-weight': 700, class: ok ? 'tx-ok' : 'tx-bad' }, ok ? 'access memory' : 'interrupt to OS')];  // ...followed by "access memory" or "interrupt to OS"
              const regions = base === OLD  // regions: what memory holds; with P at 40,000:
                ? [[0, 12000, 'OS', 's-os'], [12000, 40000, 'Q', 's-proc'], [40000, 52000, 'P', 's-accent'], [52000, MEM, 'free', 's-hole']]  // OS, process Q, P itself (highlighted) and free space
                : [[0, 12000, 'OS', 's-os'], [12000, 40000, 'Q', 's-proc'], [40000, 52000, 'S', 's-proc'], [52000, 76000, 'free', 's-hole'], [76000, 88000, 'P', 's-accent'], [88000, MEM, 'free', 's-hole']];  // after P moves to 76,000: process S has taken P's old place, and P sits further up with free space around it
              if (ctx.narrow) {  // phone-width screens draw the pipeline differently:
                /* Slim screens: the same pipeline stacked top to bottom so its text stays readable. */
                svg.setAttribute('viewBox', '0 0 340 420');  // a tall picture
                svg.replaceChildren(  // fills it top to bottom:
                  ...box(4, 4, 160, 'relative address', fmtN(rel), 's-proc'), ...box(176, 4, 160, 'base register', fmtN(base), 's-cpu'),  // the relative address box and the base register box side by side
                  s('line', { x1: 84, y1: 50, x2: 150, y2: 80, class: 's-line', 'marker-end': 'url(#arr)' }), s('line', { x1: 256, y1: 50, x2: 190, y2: 80, class: 's-line', 'marker-end': 'url(#arr)' }),  // arrows from both boxes down to the adder
                  s('circle', { cx: 170, cy: 94, r: 18, class: 's-cpu', 'stroke-width': 2 }), s('text', { x: 170, y: 102, 'text-anchor': 'middle', 'font-size': 22, 'font-weight': 800 }, '+'),  // the adder: a blue circle with a plus sign
                  s('line', { x1: 170, y1: 112, x2: 170, y2: 126, class: 's-line', 'marker-end': 'url(#arr)' }),  // an arrow from the adder down to the result
                  ...box(90, 130, 160, 'physical address', fmtN(phys), ok ? 's-ok' : 's-bad'),  // the physical address box: green if allowed, red if not
                  s('line', { x1: 170, y1: 176, x2: 170, y2: 192, class: 's-line', 'marker-end': 'url(#arr)' }),  // an arrow down to the comparison
                  s('polygon', { points: '170,196 220,228 170,260 120,228', class: 's-panel', 'stroke-width': 2 }),  // the comparison: a diamond asking whether the address is below the bounds
                  s('text', { x: 170, y: 233, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 }, '< bounds?'),  // its question text
                  ...box(4, 280, 130, 'bounds register', fmtN(bounds), 's-cpu'),  // the bounds register box at the lower left
                  s('path', { d: 'M69,280 V228 H116', fill: 'none', class: 's-line', 'marker-end': 'url(#arr)' }),  // a bent arrow from the bounds register up into the comparison
                  s('path', { d: 'M220,228 H250 V278', fill: 'none', class: 's-line', 'marker-end': ok ? 'url(#arr-ok)' : 'url(#arr-bad)', style: ok ? 'stroke:var(--ok)' : 'stroke:var(--bad)' }),  // a bent arrow out of the comparison down to the verdict, green or red
                  ...verdict(250, 298, 'middle'),  // the verdict under that arrow
                  s('text', { x: 4, y: 352, 'font-size': 13, 'font-weight': 700 }, 'Physical memory (bytes)'),  // a heading over the memory strip
                  ...bar(4, 370, 332, regions, { at: Math.min(phys, MEM), ok }));  // the memory strip with a triangle at the physical address (kept on the strip even past its end); closes the picture
              }  // ends the phone-width drawing
              const kids = ctx.narrow ? [] : [  // the wide-screen picture runs left to right (it stays empty on phone-width screens, which are drawn above)
                ...box(4, 8, 130, 'relative address', fmtN(rel), 's-proc'),  // the relative address box at the top left
                ...box(4, 92, 130, 'base register', fmtN(base), 's-cpu'),  // the base register box under it
                s('line', { x1: 134, y1: 31, x2: 156, y2: 60, class: 's-line', 'marker-end': 'url(#arr)' }),  // an arrow from the relative address to the adder
                s('line', { x1: 134, y1: 115, x2: 156, y2: 84, class: 's-line', 'marker-end': 'url(#arr)' }),  // an arrow from the base register to the adder
                s('circle', { cx: 174, cy: 72, r: 18, class: 's-cpu', 'stroke-width': 2 }), s('text', { x: 174, y: 80, 'text-anchor': 'middle', 'font-size': 22, 'font-weight': 800 }, '+'),  // the adder: a blue circle with a plus sign
                s('line', { x1: 192, y1: 72, x2: 208, y2: 72, class: 's-line', 'marker-end': 'url(#arr)' }),  // an arrow from the adder to the result
                ...box(212, 49, 136, 'physical address', fmtN(phys), ok ? 's-ok' : 's-bad'),  // the physical address box: green if allowed, red if not
                ...box(212, 136, 136, 'bounds register', fmtN(bounds), 's-cpu'),  // the bounds register box under it
                s('line', { x1: 348, y1: 72, x2: 360, y2: 72, class: 's-line', 'marker-end': 'url(#arr)' }),  // an arrow from the physical address into the comparison
                s('line', { x1: 348, y1: 159, x2: 410, y2: 159, class: 's-line' }), s('line', { x1: 410, y1: 159, x2: 410, y2: 110, class: 's-line', 'marker-end': 'url(#arr)' }),  // a line from the bounds register that turns up into the comparison from below
                s('polygon', { points: '410,40 456,72 410,104 364,72', class: 's-panel', 'stroke-width': 2 }),  // the comparison: a diamond
                s('text', { x: 410, y: 77, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 }, '< bounds?'),  // its question: is the address below the bounds?
                s('line', { x1: 456, y1: 72, x2: 480, y2: 72, class: 's-line', 'marker-end': ok ? 'url(#arr-ok)' : 'url(#arr-bad)', style: ok ? 'stroke:var(--ok)' : 'stroke:var(--bad)' }),  // an arrow out of the comparison toward the verdict, green or red
                ...verdict(488, 66, 'start'),  // the verdict to the right of the arrow
                s('text', { x: 4, y: 206, 'font-size': 13, 'font-weight': 700 }, 'Physical memory (bytes)'),  // a heading over the memory strip
                ...bar(4, 222, 632, regions, { at: Math.min(phys, MEM), ok }),  // the full-width memory strip with a triangle at the physical address
              ];  // ends the wide-screen picture
              if (!ctx.narrow) svg.replaceChildren(...kids);  // on wide screens, replaces the old drawing with this one
              const hit = regions.find((r) => r[0] <= phys && phys < r[1]);  // hit is the memory region the physical address falls in, if any
              const where = !hit ? `past the end of the ${fmtN(MEM)}-byte memory` : hit[2] === 'free' ? 'into free memory' : hit[2] === 'OS' ? 'into the OS' : `into process ${hit[2]}`;  // where: what an unchecked access would have reached: past the end of memory, free space, the OS or another process
              narr.innerHTML = ok  // the explanation box, chosen by the verdict:
                ? `<b>${fmtN(rel)} + ${fmtN(base)} = ${fmtN(phys)}</b>, and ${fmtN(phys)} < ${fmtN(bounds)}, so the address is inside P’s partition. <b class="c-ok">The access goes ahead.</b>`  // allowed: the sum, the comparison with the bounds, and that the access goes ahead
                : `<b>${fmtN(rel)} + ${fmtN(base)} = ${fmtN(phys)}</b>, which is not below the bounds ${fmtN(bounds)}: unchecked, it would reach ${where}. <b class="c-bad">The hardware raises an interrupt</b> instead, and the OS takes over, usually ending P.`;  // refused: the sum, what it would have reached, and that the hardware interrupts and the OS takes over
            }  // ends draw
            const slider = ctx.ui.slider({ label: 'Relative address', min: 0, max: 16000, step: 1, value: rel, format: (v) => fmtN(v), onInput: (v) => { rel = v; draw(); } });  // the relative address slider, 0 to 16,000, written with commas; moving it redraws everything at once
            const preset = (lab, v) => h('button', { class: 'btn sm', onclick: () => { rel = v; slider.set(v); draw(); } }, lab);  // preset(lab, v): a button that sets the relative address to v, moves the slider to match and redraws
            const swap = h('button', { class: 'btn sm primary', onclick: () => { base = base === OLD ? NEW : OLD; swap.textContent = base === OLD ? 'Swap P out, back in at 76,000' : 'Swap P out, back in at 40,000'; draw(); } }, 'Swap P out, back in at 76,000');  // the swap button: moves P between 40,000 and 76,000 by changing only the base register, and updates its own label
            draw();  // draws the starting state
            p.append(h('div', { class: 'stack', style: { gap: '8px' } },  // lays out the tab top to bottom
              h('div', { class: 'card white', style: { padding: '6px 8px' } }, svg), slider,  // the pipeline drawing in a white card, then the slider
              h('div', { class: 'row', style: { gap: '6px' } }, preset('Loop start 1,200', LOOP), preset('Last byte 11,999', 11999), preset('Bad pointer 13,500', 13500), swap),  // three preset buttons (the loop, P's last byte, and a pointer past P's end) and the swap button, in one row
              narr));  // then the explanation box; closes the tab layout
          };  // ends tabLab
          /* ---- tab 2: why a program cannot keep absolute addresses ---- */
          const FR = [  // FR: the four frames of the second tab's animation, each with P's base (null while on disk), whether S is present, whether the jump happens, and a caption
            { base: OLD, s: false, jump: true, cap: 'P is loaded at 40,000. Its loop starts 1,200 bytes into the program. <b>Top:</b> the loader wrote the absolute address 41,200 into P’s jump instruction. <b>Bottom:</b> the jump keeps the relative address 1,200 and the base register holds 40,000. Both jumps land on the loop.' },  // frame 1 caption: P at 40,000; an absolute jump to 41,200 and a relative jump to 1,200 both reach the loop
            { base: null, s: true, jump: false, cap: 'P blocks for a long time, so the OS swaps it out to disk. Its old partition is soon handed to another process, S.' },  // frame 2 caption: P is swapped out to disk and process S takes its old partition
            { base: NEW, s: true, jump: false, cap: 'P is swapped back in. Its old place is taken, so the OS puts it at 76,000. (A single queue or a compaction could move it just the same.)' },  // frame 3 caption: P comes back at 76,000 because its old place is taken
            { base: NEW, s: true, jump: true, cap: 'P executes the jump. <b>Top:</b> it goes to 41,200, which is now inside S: P runs S’s bytes as code or corrupts S. <b>Bottom:</b> the hardware adds the new base, 1,200 + 76,000 = 77,200: exactly the loop in P’s new home.' },  // frame 4 caption: the absolute jump lands inside S, while base plus relative lands on P's loop at 77,200
          ];  // closes FR
          const tabWhy = (p) => {  // tabWhy(p): fills the second tab with the two-strip animation and its player
            const BWID = ctx.narrow ? 332 : 632;  // BWID: the width of each memory strip, smaller on phone-width screens
            const svg = s('svg', { viewBox: `0 0 ${BWID + 8} 236`, width: '100%' });  // the drawing for the two strips
            const render = (i) => {  // render(i): draws frame i of the animation and returns its caption
              const f = FR[i], kids = [];  // f is this frame's data; kids collects the shapes
              const regions = [[0, 12000, 'OS', 's-os'], [12000, 40000, 'Q', 's-proc']];  // regions always include the OS and process Q
              if (f.s) regions.push([40000, 52000, 'S', 's-proc']); else if (f.base === OLD) regions.push([40000, 52000, 'P', 's-accent']);  // then S in P's old place once it has arrived, or P itself while it is still at 40,000
              if (f.base === NEW) regions.push([76000, 88000, 'P', 's-accent']);  // and P at 76,000 once it is back from disk
              const used = regions.map((r) => [r[0], r[1]]).sort((a, b) => a[0] - b[0]);  // used: the start and end of every occupied region, in address order
              let a = 0; const full = [];  // a walks up through memory; full will hold the free gaps
              used.forEach(([x, y]) => { if (x > a) full.push([a, x, 'free', 's-hole']); a = y; });  // every gap between occupied regions becomes a free region
              if (a < MEM) full.push([a, MEM, 'free', 's-hole']);  // and so does any space above the last occupied region
              const all = regions.concat(full);  // all: the occupied and free regions together
              [['Absolute address written at load time', 30, OLD + LOOP], ['Relative address + base register', 150, f.base == null ? null : f.base + LOOP]].forEach(([lab, y, target], k) => {  // draws two strips: the top one for a jump fixed at load time (always 41,200), the bottom one for relative address plus base (none while P is on disk)
                const tgt = k === 0 ? OLD + LOOP : target;  // tgt is where this strip's jump goes
                kids.push(s('text', { x: 4, y: y - 12, 'font-size': 13.5, 'font-weight': 800 }, lab), ...bar(4, y, BWID, all, null));  // the strip's heading and the memory strip itself
                if (f.jump && tgt != null) {  // if this frame shows the jump and the target is known...
                  const good = f.base === OLD || k === 1, x = 4 + (tgt * BWID) / MEM;  // ...good is true when P still sits at 40,000 or on the bottom strip; x is the target's position on screen
                  kids.push(s('path', { d: `M${x},${y + 40} l-6,10 h12 z`, style: good ? 'fill:var(--ok)' : 'fill:var(--bad)' }),  // a triangle under the strip at the target, green if good, red if not...
                    s('text', { x, y: y + 66, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, class: good ? 'tx-ok' : 'tx-bad' }, `jump → ${fmtN(tgt)}` + (good ? ' ✓' : ' ✗ inside S')));  // ...with "jump → address" under it and a tick, or a cross with "inside S"
                }  // ends the jump case
              });  // ends the two strips
              if (f.base == null) kids.push(s('text', { x: BWID + 4, y: 18, 'text-anchor': 'end', 'font-size': 13, 'font-weight': 700, class: 'tx-warn' }, 'P is on disk'));  // while P is on disk, an amber note in the top right corner says so
              svg.replaceChildren(...kids);  // replaces the old drawing with the new one
              return f.cap;  // hands the caption to the player
            };  // ends render
            const player = ctx.ui.player({ count: FR.length, render, interval: 2600 });  // the animation player: four frames, 2.6 seconds apart when playing
            p.append(h('div', { class: 'stack', style: { gap: '8px' } }, h('div', { class: 'card white', style: { padding: '8px 10px' } }, svg), player.el));  // the drawing in a white card with the player's controls and caption under it
          };  // ends tabWhy
          el.append(h('div', { class: 'split l fill' },  // lays out step 8 in two columns, the left one smaller
            h('div', { class: 'stack', style: { gap: '10px' } },  // left column, stacked top to bottom
              h('p', { class: 'm0', html: 'With fixed partitions and <b>one queue per partition</b>, a process always returns to the same partition, so its addresses could be fixed once, at load time. A single queue, swapping or <span class="t">compaction</span> can put it somewhere new, so its addresses must not depend on where it sits.' }),  // introduction: when a process can come back to a different place, its addresses must not depend on where it sits
              h('div', { class: 'card tight small', html: '<div><b>Logical address:</b> a reference to a location that does not depend on where the data currently sits in memory.</div><div style="margin-top:4px"><b>Relative address:</b> a logical address given as a distance from a known point, usually the start of the program (byte 1,200 of P).</div><div style="margin-top:4px"><b>Physical (absolute) address:</b> an actual location in main memory.</div>' }),  // a card defining logical, relative and physical addresses
              h('p', { class: 'm0 small', html: 'When a process becomes Running, the OS loads its start into the <span class="t">base register</span> and its end into the <span class="t">bounds register</span>. On every reference the processor adds the base to the <span class="t">relative address</span> and compares the result with the bounds.' }),  // paragraph: the OS loads base and bounds when a process starts running, and the processor adds and compares on every reference
              h('div', { class: 'callout why m0 small', 'data-label': 'Two jobs, one mechanism', html: 'Moving a process just means loading a new base: that is <b>relocation</b>. The bounds check keeps it inside its own partition: that is <b>protection</b>.' }),  // why box: a new base gives relocation, and the bounds check gives protection
              h('p', { class: 'xs muted m0', html: 'Some processors store the length instead (a limit register) and compare the relative address with it before adding; the protection is the same.' })),  // side note: some processors keep a length (a limit register) instead of an end address, with the same protection
            ctx.ui.tabs([{ label: 'Base and bounds lab', render: tabLab }, { label: 'Why addresses must move', render: tabWhy }])));  // right column: two tabs, the base and bounds lab and the why-addresses-must-move animation; closes the layout
        },  // ends render for step 8
      },  // ends step 8
      /* ---------------- 9. Recap ---------------- */
      {  // step 9 begins
        title: 'Recap: partitioning in eight cards',  // step 9 title
        kind: 'recap',  // kind recap: labelled "Recap" above the title
        render(el, ctx) {  // render(el, ctx): draws step 9
          const { h } = ctx;  // h builds page elements
          const cards = () => ctx.ui.flipcards([  // cards(): builds eight flip cards, each a [front, back] pair, when the first tab opens
            ['Fixed partitioning', 'Cut once at start-up. Equal sizes: any job up to the partition size fits anywhere. Unequal sizes: less waste, bigger jobs fit. The partition count caps the number of active processes.'],  // card: fixed partitioning, equal and unequal sizes, and the cap on active processes
            ['Internal fragmentation', 'Waste <b>inside</b> an allocated block: a 2 MB job in a 10 MB partition wastes 8 MB. Found in fixed partitions and buddy blocks.'],  // card: internal fragmentation, with the 2 MB job in a 10 MB partition
            ['External fragmentation', 'Free memory split into holes <b>between</b> allocations: enough in total, no single hole big enough. The weakness of dynamic partitioning; compaction cures it at a price.'],  // card: external fragmentation and its cure, compaction
            ['Queue per partition vs one queue', 'Per partition: least waste, but a big partition can idle while a small one has a queue. One queue: the smallest <i>free</i> partition that fits; more jobs run.'],  // card: one queue per partition compared with one queue for all
            ['Whom to swap out?', 'Only partitions that hold the newcomer; prefer the smallest; prefer a blocked process over a ready one; weigh priority.'],  // card: the rule for choosing whom to swap out
            ['First, best, next fit', 'First: first big-enough hole from the start. Best: the smallest big-enough hole. Next: the first big-enough hole after the last placement.'],  // card: the three placement rules in one line each
            ['Buddy system', 'Blocks of 2<sup>K</sup>, L ≤ K ≤ U. Request s gets 2<sup>K</sup> with 2<sup>K−1</sup> &lt; s ≤ 2<sup>K</sup> (never below 2<sup>L</sup>), made by halving. A freed block merges with its free buddy, level after level.'],  // card: the buddy system's sizes, the block a request gets, halving and merging
            ['Base and bounds', 'Physical = base + relative. If the result is not below the bounds: interrupt to the OS. Loaded each time the process starts Running; gives relocation and protection.'],  // card: base and bounds translation and the interrupt
          ], { cols: ctx.narrow ? 1 : 4, height: 196 });  // one column on phone-width screens, four otherwise; each card 196 pixels tall
          const ROWS = [  // ROWS: the comparison table, one row per question, with columns for fixed, dynamic and buddy
            ['Partitions are', 'cut once at start-up, in equal or unequal sizes', 'made on demand, exactly the size of the process', 'powers of two, split and merged on demand'],  // row: how the partitions are made
            ['Placement rule', 'equal: any free one; unequal: the smallest that fits', 'first-fit, best-fit or next-fit', 'the smallest power of two that holds the request'],  // row: the placement rule
            ['Waste', 'internal', 'external (holes between partitions)', 'internal, plus a little external'],  // row: the kind of waste
            ['Cure for the waste', 'unequal sizes reduce it', 'compaction, which costs processor time', 'merging free buddies, which is cheap'],  // row: the cure for the waste
            ['Main limits', 'the partition count caps active processes; big programs need overlays', 'holes pile up; compaction needed', 'a block can be almost half empty'],  // row: the main limits
            ['Needs relocation when', 'a process may return to a different partition', 'processes are swapped or compacted', 'a process may return to a different block'],  // row: when relocation is needed
          ];  // closes ROWS
          const table = '<table class="tbl"><tr><th></th><th>Fixed</th><th>Dynamic</th><th>Buddy</th></tr>' +  // table: the comparison table's HTML, starting with its heading row...
            ROWS.map((r) => `<tr><td class="b">${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td></tr>`).join('') + '</table>';  // ...then one row per entry of ROWS, the question in bold
          const flipAll = (on) => ctx.$$('.flip').forEach((c) => c.classList.toggle('on', on));  // flipAll(on): turns every flip card in this step face up (true) or face down (false)
          el.append(ctx.ui.tabs([  // the step is two tabs
            { label: 'Flip cards', render: (p) => p.append(h('div', { class: 'stack', style: { gap: '10px' } },  // tab 1: the flip cards
              h('div', { class: 'row', style: { gap: '8px' } }, h('p', { class: 'm0 muted small grow' }, 'Say each answer before you flip. Click a card again to flip it back.'),  // a row with an instruction to answer before flipping...
                h('button', { class: 'btn sm', onclick: () => flipAll(true) }, 'Flip all'), h('button', { class: 'btn sm ghost', onclick: () => flipAll(false) }, 'Hide all')),  // ...and the Flip all and Hide all buttons
              cards())) },  // then the cards themselves; closes tab 1
            { label: 'The three schemes side by side', render: (p) => p.append(h('div', { class: 'stack', style: { gap: '12px' } }, h('div', { html: table }),  // tab 2: the comparison table...
              h('div', { class: 'callout tip m0', 'data-label': 'Remember', html: 'All three keep each process in <b>one contiguous block</b>. The next two sections drop that requirement: paging (7.3) cuts processes into equal pages, segmentation (7.4) into logical pieces.' }))) },  // ...and a reminder that all three keep each process in one block, which paging and segmentation drop; closes tab 2
          ]));  // closes the tab list and the tabs widget
        },  // ends render for step 9
      },  // ends step 9
      /* ---------------- 10. Check yourself ---------------- */
      {  // step 10 begins: the quiz
        title: 'Check yourself: memory partitioning',  // step 10 title
        kind: 'check',  // kind check: labelled "Check Yourself" above the title
        quiz: [  // quiz: the questions for this section; the guide builds the quiz from this list
          { type: 'bucket', q: 'Is each example internal or external fragmentation?', buckets: ['Internal fragmentation', 'External fragmentation'],  // question 1 (sort into groups): is each example internal or external fragmentation?
            items: [['A 5 MB process in an 8 MB fixed partition', 0], ['A 100 KB request served with a 128 KB buddy block', 0], ['Three separate 4 MB holes while a 10 MB process waits', 1], ['Free space that compaction could gather into one block', 1], ['Gaps left between dynamic partitions after processes end', 1], ['The unused tail of an allocated partition', 0]],  // the six examples, each with the number of its correct group (0 internal, 1 external)
            why: 'Internal fragmentation is waste inside a block that has been handed out. External fragmentation is free memory between allocated blocks, scattered in pieces too small to use.' },  // explanation shown after answering: waste inside a block versus free memory between blocks
          { q: 'A system uses unequal fixed partitions and keeps a separate queue for each partition (each job waits for the smallest partition that can hold it). What is the main drawback?',  // question 2 (multiple choice): the main drawback of one queue per partition
            choices: ['Each job wastes more space inside its partition than it would with a single queue.', 'Jobs must be relocated every time they are loaded.', 'A large partition can sit idle while jobs wait in the queue of a smaller partition.', 'The OS cannot tell which partition a job should wait for.'], answer: 2,  // the four choices; the third (idle large partition) is correct
            feedback: ['The opposite: waiting for the best-fitting partition keeps the waste inside partitions as small as possible.', 'A job always goes back to the same partition, so its addresses can even be fixed at load time.', null, 'The rule is simple: the smallest partition that can hold the job.'],  // feedback for each wrong choice (null for the correct one)
            why: 'Per-partition queues minimize internal fragmentation, but if many small jobs arrive they all queue for the small partitions while bigger partitions stay empty. A single queue would place them in the smallest free partition that fits.' },  // explanation: small jobs queue for small partitions while big ones stay empty
          { q: 'A system uses unequal fixed partitions with a single queue. Every partition is occupied, all residents have the same priority, and a 6 MB process must be brought in. Which resident is the best one to swap out?',  // question 3 (multiple choice): which resident to swap out for a 6 MB newcomer
            choices: ['A ready process in a 7 MB partition', 'A blocked process in a 4 MB partition', 'A blocked process in a 16 MB partition', 'A blocked process in a 7 MB partition'], answer: 3,  // the four choices; the blocked process in the 7 MB partition is correct
            feedback: ['Same partition size, but this process could run right now. A blocked process loses less by being swapped out.', 'A 4 MB partition cannot hold a 6 MB process, so swapping this one out frees nothing useful.', 'It would work, but 10 MB of the partition would be wasted on the newcomer. A smaller partition with a blocked owner is available.', null],  // feedback for each wrong choice: a ready owner, a partition too small, a partition too big (null for the correct one)
            why: 'Only partitions big enough for the newcomer are candidates. Among them, prefer the smallest, and prefer a process that is blocked (it cannot use the processor now anyway), also weighing priority.' },  // explanation: only big-enough partitions count; prefer the smallest and a blocked owner, and weigh priority
          { type: 'multi', q: 'Which statements about compaction are true?',  // question 4 (select all that apply): true statements about compaction
            choices: ['It moves processes so that all free memory forms one block.', 'It costs processor time, because the processes must be copied.', 'It only works if processes can be relocated while they are in memory.', 'It removes the internal fragmentation inside fixed partitions.', 'It is done by the compiler when the program is built.'],  // the five statements: one block, copying cost, needs relocation, internal waste, done by the compiler
            answer: [0, 1, 2],  // the first three statements are the true ones
            why: 'Compaction slides processes together so the holes join into one free block. Copying takes processor time, and each moved process now runs at a new address, so the hardware must translate addresses at run time. It fixes external fragmentation in dynamic partitioning, not waste inside fixed partitions, and it is done by the OS while the system runs.' },  // explanation: compaction is done by the OS at run time and fixes external, not internal, fragmentation
          { type: 'match', q: 'Free holes, in address order, are 14 MB, 6 MB, 9 MB and 20 MB. The most recent placement ended between the 9 MB hole and the 20 MB hole. A process needs 8 MB. Match each placement algorithm to the hole it chooses.',  // question 5 (match the pairs): which hole each placement algorithm picks for an 8 MB request
            pairs: [['First-fit', 'The 14 MB hole'], ['Best-fit', 'The 9 MB hole'], ['Next-fit', 'The 20 MB hole']],  // the correct pairs: first-fit with the 14 MB hole, best-fit with 9 MB, next-fit with 20 MB
            why: 'First-fit scans from the start and the first hole of at least 8 MB is the 14 MB one. Best-fit picks the smallest hole that is big enough: 9 MB. Next-fit resumes after the 9 MB hole, so the first big-enough hole it meets is the 20 MB one.' },  // explanation: how each algorithm's scan reaches its hole
          { q: 'Classic simulation studies of dynamic partitioning usually rank best-fit as the worst of the placement algorithms. Why?',  // question 6 (multiple choice): why best-fit usually ranks last in classic studies
            choices: ['It always takes the largest hole, so the big free blocks are used up first.', 'Each placement leaves the smallest leftover possible, so memory fills with slivers too small for any request.', 'It gives each process a block bigger than it needs, which causes internal fragmentation.', 'It resumes where the last placement ended, so it carves up the big free block at the end of memory.'], answer: 1,  // the four choices; the second (slivers pile up) is correct
            feedback: ['That describes worst-fit, the opposite rule. Best-fit takes the smallest hole that is big enough.', null, 'In dynamic partitioning each process gets a partition of exactly its own size, so there is no internal fragmentation; best-fit’s waste lies in the holes between partitions.', 'That is next-fit’s typical weakness. Best-fit looks at all the holes, wherever the last placement ended.'],  // feedback for each wrong choice: that is worst-fit, there is no internal waste here, that is next-fit (null for the correct one)
            why: 'Best-fit wastes the least on each single placement, but those tiny leftovers add up until memory is littered with slivers no request can use. Classic studies therefore usually put first-fit (simplest, fastest, often best) ahead, next-fit a little behind, and best-fit last; exact rankings depend on the workload.' },  // explanation: small leftovers add up, giving the usual ranking of first-fit, next-fit, then best-fit
          { type: 'tf', q: 'Compared with first-fit, next-fit tends to break up the large free block at the end of memory, so compaction is needed more often.', answer: true,  // question 7 (true or false): next-fit breaks up the big end block, so it compacts more often; the answer is true
            why: 'Next-fit keeps moving forward from its last placement, so it soon reaches the big block at the end and keeps slicing it. Large requests then find no room, and the OS must compact more often.' },  // explanation: next-fit keeps moving forward and slices the big block at the end of memory
          { type: 'num', q: 'A buddy system manages 1024 KB with a smallest block size of 32 KB. How big is the block given to a request for 130 KB?', answer: 256, tol: 0, unit: 'KB',  // question 8 (calculate): the buddy block size for a 130 KB request; the answer is 256 KB, with no tolerance
            why: 'The block must be the smallest power of two that holds the request: 128 &lt; 130 ≤ 256, so it gets a 256 KB block, and 126 KB of it is wasted inside.' },  // explanation: 128 is too small and 256 holds it, so 126 KB is wasted inside
          { type: 'order', q: 'A buddy system starts with one free 1024 KB block; its smallest block size is 64 KB. Put the steps that serve a 100 KB request in order.',  // question 9 (put in order): the splits that serve a 100 KB request in a 1024 KB buddy system
            items: ['Split the 1024 KB block into two 512 KB buddies', 'Split one 512 KB buddy into two 256 KB buddies', 'Split one 256 KB buddy into two 128 KB buddies', 'Hand one 128 KB block to the request (28 KB of it is wasted)'],  // the four steps in their correct order: three splits, then handing over a 128 KB block
            why: '64 &lt; 100 ≤ 128, so the request needs a 128 KB block. The allocator halves blocks one level at a time until it reaches that size; the other halves go on the free lists for their sizes.' },  // explanation: the request needs 128 KB, reached by halving one level at a time
          { type: 'num', q: 'A running process has 30,000 in its base register and 42,000 in its bounds register. It uses relative address 9,500. Which physical address is accessed?', answer: 39500, tol: 0,  // question 10 (calculate): base plus relative address; the answer is 39,500
            why: 'Physical address = base + relative address = 30,000 + 9,500 = 39,500. That is below the bounds 42,000, so the access goes ahead.' },  // explanation: 30,000 plus 9,500 is 39,500, which is below the bounds, so the access is allowed
          { q: 'A running process has 30,000 in its base register and 42,000 in its bounds register. It uses relative address 13,000. What happens?',  // question 11 (multiple choice): what happens when base plus relative address reaches the bounds
            choices: ['The result 43,000 is not below the bounds, so the hardware raises an interrupt and the OS takes over.', 'The access goes to physical address 13,000, since 13,000 is below the bounds and needs no translation.', 'The access goes ahead at 43,000, because the bounds are checked only once, when the program is loaded.', 'The hardware wraps the address round to 31,000, so the access stays inside the process’s own partition.'], answer: 0,  // the four choices; the first (interrupt to the OS) is correct
            feedback: [null, 'That forgets the base register: every relative address has the base added to it, and it is the sum that is compared with the bounds.', 'The comparison happens in hardware on every reference, not once at load time.', 'Nothing wraps round; an address outside the bounds is an error that the hardware reports to the OS.'],  // feedback for each wrong choice: forgets the base, checks only once, or wraps round (null for the correct one)
            why: '30,000 + 13,000 = 43,000, which lies beyond the end of the process’s partition. The hardware detects this on the spot and interrupts, so the process cannot touch memory that is not its own.' },  // explanation: 43,000 lies past the partition, so the hardware interrupts at once
          { type: 'match', q: 'Match each kind of address to its description.',  // question 12 (match the pairs): logical, relative and physical addresses
            pairs: [['Logical address', 'A reference that does not depend on where the data currently sits in memory'], ['Relative address', 'A distance from a known point, usually the start of the program'], ['Physical address', 'An actual location in main memory']],  // the correct pairs, each kind of address with its description
            why: 'Programs are written with logical addresses, most often relative ones (counted from the start of the program). The base register turns a relative address into a physical one each time it is used.' },  // explanation: programs use relative addresses, and the base register turns them into physical ones
        ],  // closes the quiz list
      },  // ends step 10
    ],  // closes the list of steps
    notes: `${/* notes: the section's reading notes, written in HTML, opened with the Notes button */''}
<h3>The problem</h3>${/* notes heading: the problem */''}
<p>The oldest way to share main memory is to give each process one contiguous slice, a <b>partition</b>. Two kinds of waste result: <b>internal fragmentation</b> (unused space inside an allocated block, because the block is bigger than what was loaded) and <b>external fragmentation</b> (free memory broken into holes between allocated blocks, so a request can fail although the holes add up to enough).</p>${/* notes paragraph: partitions and the two kinds of fragmentation */''}

<h3>Fixed partitioning</h3>${/* notes heading: fixed partitioning */''}
<p>Memory after the OS is cut into partitions at start-up; their number and sizes never change.</p>${/* notes paragraph: partitions are cut at start-up and never change */''}
<ul>${/* start of the list about fixed partitions */''}
<li><b>Equal sizes:</b> any process no larger than a partition fits in any free one; if all are full, the OS can swap one out.</li>${/* list item: equal sizes and swapping when all are full */''}
<li>A program bigger than a partition needs <b>overlays</b> (modules that take turns in the same region), and every process, however small, occupies a whole partition: internal fragmentation.</li>${/* list item: overlays for big programs, and internal fragmentation for small ones */''}
<li><b>Unequal sizes</b> ease both problems.</li>${/* list item: unequal sizes ease both problems */''}
</ul>${/* end of the list */''}
<p><b>Example</b> (64 MB, OS 4 MB; jobs 2, 9, 4, 13, 6, 3, 24 MB in order). Six 10 MB partitions: 13 and 24 fit nowhere; the other five waste 8 + 1 + 6 + 4 + 7 = 26 MB. Partitions of 3, 5, 7, 10, 15, 20 MB (smallest free one that fits): six jobs load, wasting 1 + 1 + 1 + 2 + 1 + 17 = 23 MB.</p>${/* notes example: the seven jobs A to G in equal and unequal partitions, with the MB wasted in each */''}
<p>Disadvantages: the number of partitions caps the number of active processes, and small jobs waste space. Used by early mainframe systems.</p>${/* notes paragraph: the disadvantages of fixed partitioning */''}

<h3>Placement with unequal partitions</h3>${/* notes heading: placement with unequal partitions */''}
<ul>${/* start of the list of the two queue designs */''}
<li><b>One queue per partition:</b> each process waits for the smallest partition that can hold it. Least waste inside partitions, but a large partition may sit idle while a small one has a long queue.</li>${/* list item: one queue per partition, least waste but idle partitions */''}
<li><b>Single queue:</b> a process takes the smallest <i>available</i> partition that holds it. More processes run, with more waste.</li>${/* list item: a single queue, more jobs running but more waste */''}
</ul>${/* end of the list */''}
<p>Example (partitions 3 to 20 MB; jobs 2, 1, 3, 2, 6, 2, 1 MB): per-partition queues run 2 jobs, 5 wait, 2 MB wasted; a single queue runs 6, 1 waits, 44 MB wasted.</p>${/* notes example: the seven small jobs under both queue designs, with their totals */''}
<p><b>When all partitions are full</b>, swap out a process from the smallest partition that will hold the newcomer, preferring a <b>blocked</b> process over a ready one and weighing priority.</p>${/* notes paragraph: whom to swap out when every partition is full */''}

<h3>Dynamic partitioning</h3>${/* notes heading: dynamic partitioning */''}
<p>Partitions are created as needed, each <b>exactly</b> the size of its process: no internal fragmentation. As processes end, holes appear between partitions: <b>external fragmentation</b>. Example (64 MB, OS 4): P1 18 MB at 4, P2 12 at 22, P3 20 at 34, P4 8 at 54; end P2 and P4: 22 MB free in holes of 12 and 10, yet a 14 MB process does not fit.</p>${/* notes paragraph: exact-size partitions, external fragmentation, and the P1 to P4 example */''}
<p><b>Compaction:</b> the OS shifts processes together so all free memory forms one block (here P3 moves from 34 to 22, copying 20 MB). It costs processor time and needs <b>dynamic relocation</b>, since moved processes run at new addresses.</p>${/* notes paragraph: compaction, its cost, and why it needs dynamic relocation */''}
<p><b>Replacement:</b> if every process in memory is blocked and there is no room even after compaction, the OS swaps a process out; which one is a replacement decision.</p>${/* notes paragraph: replacement when memory is full even after compaction */''}

<h3>Placement algorithms</h3>${/* notes heading: placement algorithms */''}
<ul>${/* start of the list of the three algorithms */''}
<li><b>Best-fit:</b> the free block closest in size to the request.</li>${/* list item: best-fit */''}
<li><b>First-fit:</b> scan from the beginning; the first block big enough.</li>${/* list item: first-fit */''}
<li><b>Next-fit:</b> scan from where the last placement ended; the next block big enough.</li>${/* list item: next-fit */''}
</ul>${/* end of the list */''}
<p><b>Example:</b> holes 5, 13, 9, 3, 6, 20 MB in order, last placement just before the 3 MB hole, request 8 MB. First-fit takes 13 (examines 2 holes), best-fit takes 9 (examines all 6, leaves 1), next-fit takes 20 (leaves 12). A 24 MB request fails under all three though 56 MB is free.</p>${/* notes example: the six holes of step 5 with an 8 MB request, and a 24 MB request that fails */''}
<p><b>Typical behaviour</b> (the standard verdict of classic simulation studies): <b>first-fit</b> is usually the simplest, the fastest and often the best, but it litters the front of memory with small blocks that every search must step past. <b>Next-fit</b> tends to break up the large free block at the end of memory, so compaction is needed more often than with first-fit. <b>Best-fit</b> is usually the worst: each placement leaves the smallest leftover possible, so memory fills with <b>slivers</b> too small for any request.</p>${/* notes paragraph: the typical behavior of each algorithm according to classic studies */''}
<p>Exact rankings depend on the workload. In a race on one request sequence, best-fit may even need fewer compactions than the others, because it keeps the big end block whole and each compaction sweeps its slivers away; counting the slivers each algorithm leaves shows the effect behind its usual last place. What holds on every placement: best-fit must examine every hole (unless it finds an exact fit) and leaves the smallest leftover.</p>${/* notes paragraph: why one race can differ from the usual ranking, and what always holds for best-fit */''}

<h3>Buddy system</h3>${/* notes heading: the buddy system */''}
<p>Block sizes are 2<sup>K</sup>, L ≤ K ≤ U (2<sup>L</sup> the smallest block, 2<sup>U</sup> usually all of memory). Start with one block of 2<sup>U</sup>. For a request s: if 2<sup>U−1</sup> &lt; s ≤ 2<sup>U</sup>, allocate the whole block; otherwise split it into two <b>buddies</b> of 2<sup>U−1</sup> and repeat on one of them, until reaching the smallest block of at least s. A list of free blocks (holes) is kept for each size. When a block is freed and its buddy is free, they merge into one block of the next size, and merging continues upward.</p>${/* notes paragraph: power-of-two block sizes, splitting into buddies, free lists, and merging */''}
<p><b>Example</b> (1024 KB, smallest 64 KB): A 90 KB splits 1024 → 512 → 256 → 128 and gets 128 KB at 0. B 200 KB gets 256 at 256; C 40 KB gets 64 at 128; D 120 KB gets 128 at 512. Later, freeing C merges 64 + 64 into 128 at 128 and, if A has gone, 128 + 128 into 256 at 0.</p>${/* notes example: the sample requests A to D from step 7 and how freeing merges blocks */''}
<p>Internal fragmentation (100 KB takes a 128 KB block) but free space easily re-forms large blocks. Variants are used in real kernels, for example Linux’s page allocator.</p>${/* notes paragraph: the buddy system's internal waste and its use in real kernels */''}

<h3>Relocation: base and bounds</h3>${/* notes heading: relocation with base and bounds */''}
<p>With fixed partitions and one queue per partition, a process always returns to the same partition, so absolute addresses could be set at load time. With a single queue, swapping or compaction its location changes, so programs use:</p>${/* notes paragraph: why a process that can move needs addresses independent of its location */''}
<ul>${/* start of the list of address kinds */''}
<li><b>Logical address:</b> a reference independent of where the data currently sits in memory.</li>${/* list item: logical address */''}
<li><b>Relative address:</b> a logical address relative to a known point, usually the program’s start.</li>${/* list item: relative address */''}
<li><b>Physical (absolute) address:</b> an actual location in main memory.</li>${/* list item: physical address */''}
</ul>${/* end of the list */''}
<p>When a process becomes Running, the <b>base register</b> gets its start address and the <b>bounds register</b> its end (the first address past its last byte). Each relative address is added to the base; the result is compared with the bounds; inside, the access proceeds; outside, an interrupt goes to the OS. This allows a process to be swapped back in anywhere (relocation) and keeps it out of others’ memory (protection). Example: base 40,000, bounds 52,000: relative 1,200 → 41,200, allowed; 13,500 → 53,500, interrupt. Swapped back in at 76,000, relative 1,200 → 77,200.</p>${/* notes paragraph: how base and bounds translate and check each address, with the numbers from step 8 */''}

<h3>Summary</h3>${/* notes heading: summary */''}
<table>${/* start of the summary table */''}
<tr><th>Scheme</th><th>Waste</th><th>Strength</th><th>Weakness</th></tr>${/* summary table heading row: scheme, waste, strength, weakness */''}
<tr><td>Fixed</td><td>internal</td><td>simple, little OS overhead</td><td>caps active processes; small jobs waste space</td></tr>${/* summary row: fixed partitioning */''}
<tr><td>Dynamic</td><td>external</td><td>no internal fragmentation</td><td>holes accumulate; compaction costs time</td></tr>${/* summary row: dynamic partitioning */''}
<tr><td>Buddy</td><td>internal (some external)</td><td>fast split and merge</td><td>a block can be nearly half wasted</td></tr>${/* summary row: the buddy system */''}
</table>${/* end of the summary table */''}
`,  // end of the notes text
  });  // closes the section object and the Guide.section call
})();  // ends and immediately runs the wrapping function
