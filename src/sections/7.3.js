// Comment key: a line inside backtick text ends with ${/* comment */''}, an empty-string slot that holds a comment without changing the text on screen (full note at the top of the page).
/* =====================================================================
   7.3 Paging
   Original teaching material. Shared models and helpers live in this
   IIFE so nothing leaks into the global scope.
   ===================================================================== */
(() => {  // wraps the whole section in an arrow function that runs once, right away, so its names stay private to this file
  const KB = 1024;                                   // the page size used by the loader and the comparison
  const fmtN = (v) => Number(v).toLocaleString('en-US');  // fmtN(v): writes a number with thousands commas (5300 → "5,300") so byte counts are easy to read
  const bin = (v, bits) => v.toString(2).padStart(bits, '0');  // bin(v, bits): writes v in binary, padded with leading zeros to exactly the given number of bits
  const pagesFor = (size, ps) => Math.ceil(size / ps);  // pagesFor(size, ps): how many pages a process of size bytes needs; Math.ceil rounds up, since a part-page still takes a whole page
  const wasteFor = (size, ps) => pagesFor(size, ps) * ps - size;  // wasteFor(size, ps): internal fragmentation, the bytes allocated in whole pages minus the bytes the process really uses

  /* The five processes used by the loader and the comparison. col is the shell colour family
     used only to tell processes apart on screen. */
  const PROCS = [  // PROCS: the list of five sample processes the loader game, the page-table view and the race all share
    { id: 'A', size: 3900, col: 'proc' },  // process A: 3,900 bytes, drawn in the process colour (teal); it needs 4 pages of 1 KB
    { id: 'B', size: 2600, col: 'io' },  // process B: 2,600 bytes, drawn in the I/O colour (orange); it needs 3 pages of 1 KB
    { id: 'C', size: 4500, col: 'thread' },  // process C: 4,500 bytes, drawn in the thread colour (pink); it needs 5 pages of 1 KB
    { id: 'D', size: 5900, col: 'cpu' },  // process D: 5,900 bytes, drawn in the processor colour (blue); at 6 pages it is the one that often has to wait
    { id: 'E', size: 1800, col: 'accent' },  // process E: 1,800 bytes, drawn in the accent colour (indigo); the last process to arrive in the race
  ];  // closes the PROCS list
  const PROC = Object.fromEntries(PROCS.map((p) => [p.id, p]));  // PROC: the same processes looked up by letter, so code can write PROC.D or PROC[id] instead of searching the list

  /* Paged memory: frames[f] is null or { p, pg }; free is the free-frame list (kept in frame order);
     tables[id] is that process's page table (entry i = frame holding page i). */
  function makePaged(nFrames, ps) {  // makePaged(nFrames, ps): builds an empty paged memory with nFrames frames of ps bytes each
    return { ps, n: nFrames, frames: Array(nFrames).fill(null), free: Array.from({ length: nFrames }, (_, i) => i), tables: {} };  // every frame starts empty (null), every frame number is on the free-frame list, and no process has a page table yet
  }  // ends makePaged
  function pagedLoad(m, proc) {  // pagedLoad(m, proc): what the OS does to load a process under paging; it returns whether it worked and which frames it used
    const need = pagesFor(proc.size, m.ps);  // need: the number of pages, and so frames, this process needs at the current page size
    if (need > m.free.length) return { ok: false, need, free: m.free.length };  // if fewer frames are free than needed the load is refused; only the count matters, never where the frames are
    const got = m.free.splice(0, need);  // takes the first need frame numbers off the front of the free-frame list (splice removes them from the list)
    got.forEach((f, pg) => { m.frames[f] = { p: proc.id, pg }; });  // marks each taken frame as holding one page of this process: the first frame gets page 0, the next page 1, and so on
    m.tables[proc.id] = got;  // the list of taken frames becomes this process's page table: entry i is the frame holding page i
    return { ok: true, need, frames: got };  // reports success, the page count and the frames used, so the narration can describe them
  }  // ends pagedLoad
  function pagedRemove(m, id) {  // pagedRemove(m, id): swaps a process out, giving all of its frames back to the free-frame list
    const t = m.tables[id] || [];  // t: the process's page table, or an empty list if the process is not in memory
    t.forEach((f) => { m.frames[f] = null; });  // empties every frame the process held
    m.free = m.free.concat(t).sort((a, b) => a - b);  // adds those frames back to the free-frame list and sorts it by frame number so it stays easy to read
    delete m.tables[id];  // throws the page table away; if the process comes back it gets a new one
    return t;  // returns the freed frames so the narration can name them
  }  // ends pagedRemove
  const pagedWaste = (m) => Object.keys(m.tables).reduce((s, id) => s + wasteFor(PROC[id].size, m.ps), 0);  // pagedWaste(m): total internal fragmentation in memory, adding up the unused end of every loaded process's last page

  /* A clickable SVG group that also works from the keyboard (Enter or Space). */
  function hotGroup(ctx, onAct, label, ...kids) {  // hotGroup(ctx, onAct, label, ...kids): wraps drawing parts in an SVG group (SVG is the browser's drawing format) that acts as a button
    const g = ctx.s('g', { class: 'hot', tabindex: 0, role: 'button', 'aria-label': label }, ...kids);  // the group gets the pointer cursor class, can be reached with the Tab key (tabindex 0), and is announced to screen readers as a button
    g.addEventListener('click', onAct);  // a mouse click or tap runs the action
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAct(); } });  // pressing Enter or Space while the group has keyboard focus runs the same action; preventDefault stops Space from scrolling the page
    return g;  // returns the finished group so it can be added to a drawing
  }  // ends hotGroup
  /* Sets the text and tone ('', 'ok', 'bad', 'warn') of a narration card. */
  function narrate(box, html, tone) {  // narrate(box, html, tone): writes a message into one of the step's explanation cards
    box.className = 'card tight small narr' + (tone ? ' ' + tone : '');  // resets the card's classes and adds the tone, which colours its left border green, red or amber (see the section CSS)
    box.innerHTML = html;  // puts the message, which may contain bold text and colours, inside the card
  }  // ends narrate
  /* Swaps entries so no page sits in the frame with its own number (that would make physical equal logical). */
  function derange(table) {  // derange(table): rearranges a made-up page table so no entry holds its own index, which would hide the effect of translation
    for (let i = table.findIndex((f, j) => f === j); i >= 0; i = table.findIndex((f, j) => f === j)) {  // finds the first entry whose frame equals its page number, fixes it, and searches again until there are none left
      const j = (i + 1) % table.length; [table[i], table[j]] = [table[j], table[i]];  // swaps that entry with the next one (wrapping round to entry 0 at the end), which moves the matching frame elsewhere
    }  // ends the loop
    return table;  // returns the same table, now changed in place
  }  // ends derange
  const listOf = (arr) => (arr.length < 2 ? arr.join('') : arr.slice(0, -1).join(', ') + ' and ' + arr[arr.length - 1]);  // listOf(arr): joins items as readable English, "4, 5 and 6"; a single item is written on its own

  /* Dynamic partitioning with first-fit: parts is a list of { p, start, size } kept sorted by start. */
  function makeDyn(total) { return { total, parts: [] }; }  // makeDyn(total): an empty memory of total bytes for dynamic partitioning; parts lists the blocks given to processes
  function dynHoles(m) {  // dynHoles(m): lists the free gaps (holes) between the blocks, each with its start address and size
    const out = []; let at = 0;  // out collects the holes; at is the first byte after the last block looked at so far
    m.parts.forEach((q) => { if (q.start > at) out.push({ start: at, size: q.start - at }); at = q.start + q.size; });  // walks the blocks in address order; any gap before a block is a hole, then at jumps to the end of that block
    if (at < m.total) out.push({ start: at, size: m.total - at });  // whatever is left after the last block, up to the end of memory, is a hole too
    return out;  // returns the list of holes
  }  // ends dynHoles
  function dynLoad(m, proc) {  // dynLoad(m, proc): places a process with first-fit, which means in the first hole big enough for the whole process
    const hs = dynHoles(m), h = hs.find((x) => x.size >= proc.size);  // hs: all the current holes; h: the first one that can hold the process, or nothing if none can
    const free = hs.reduce((s, x) => s + x.size, 0), largest = hs.reduce((mx, x) => Math.max(mx, x.size), 0);  // free: the total of all holes; largest: the biggest single hole; both go into the narration when a load fails
    if (!h) return { ok: false, free, largest };  // no hole is big enough: the load is refused, even if the free total would be plenty
    m.parts.push({ p: proc.id, start: h.start, size: proc.size });  // gives the process a new block starting at the beginning of the chosen hole, exactly the process's size
    m.parts.sort((a, b) => a.start - b.start);  // keeps the blocks sorted by start address so the hole search keeps working
    return { ok: true, start: h.start, free, largest };  // reports success and where the block starts
  }  // ends dynLoad
  function dynRemove(m, id) { m.parts = m.parts.filter((q) => q.p !== id); }  // dynRemove(m, id): swaps a process out by deleting its block; the space it used becomes a hole
  function dynCompact(m) {  // dynCompact(m): compaction, sliding every block down toward address 0 so all free space joins into one hole at the end
    let at = 0, moved = 0;  // at: where the next block should start; moved: how many bytes had to be copied
    m.parts.forEach((q) => { if (q.start !== at) { moved += q.size; q.start = at; } at += q.size; });  // every block that is not already in place is moved there, and its size is added to the bytes copied
    return moved;  // returns the bytes copied, which the race shows as the price of compaction
  }  // ends dynCompact

  /* The shared workload for the comparison step. Both schemes see the same events in the same order.
     A process that does not fit waits; at the 'retry' event partitioning first compacts memory. */
  const MEM = 16384;  // MEM: the memory size used by the race, 16,384 bytes (16 KB)
  const WORKLOAD = [  // WORKLOAD: the events of the race in the order they happen; t is the text shown for each event
    { t: 'Start: 16 KB of free memory' },  // event 0: the starting state with all memory free
    { t: 'A arrives (3,900 B)', load: 'A' },  // event 1: process A arrives and asks to be loaded
    { t: 'B arrives (2,600 B)', load: 'B' },  // event 2: process B arrives
    { t: 'C arrives (4,500 B)', load: 'C' },  // event 3: process C arrives
    { t: 'A is swapped out', remove: 'A' },  // event 4: A leaves memory, which leaves a hole under partitioning and free frames under paging
    { t: 'D arrives (5,900 B)', load: 'D' },  // event 5: D arrives; under partitioning no single hole is big enough
    { t: 'Waiting processes retry', retry: true },  // event 6: anything still waiting is tried again, after partitioning compacts its memory
    { t: 'E arrives (1,800 B)', load: 'E' },  // event 7: E arrives; with 2 KB pages it ends up waiting, which shows the cost of large pages
  ];  // closes the WORKLOAD list
  /* Runs events 0..upto on fresh models; returns both models plus what happened at the last event. */
  function runWorkload(ps, upto) {  // runWorkload(ps, upto): replays the race from the start up to event upto, so any step can be redrawn without remembering the past
    const dyn = makeDyn(MEM), pag = makePaged(MEM / ps, ps);  // two fresh memories of the same 16 KB: dyn for dynamic partitioning and pag for paging with ps-byte frames
    const st = { dyn: { waiting: [], copied: 0, last: '' }, pag: { waiting: [], last: '' } };  // st: the running story for each side: who is waiting, bytes copied by compaction (partitioning only), and what just happened
    const tryLoad = (side, id) => {  // tryLoad(side, id): tries to load one process on one side and keeps that side's waiting list up to date
      const r = side === 'dyn' ? dynLoad(dyn, PROC[id]) : pagedLoad(pag, PROC[id]);  // uses first-fit on the partitioning side and the free-frame list on the paging side
      if (r.ok) st[side].waiting = st[side].waiting.filter((w) => w !== id);  // on success the process is taken off the waiting list
      else if (!st[side].waiting.includes(id)) st[side].waiting.push(id);  // on failure it joins the waiting list, once only, so it can be tried again at the retry event
      return r;  // returns the load result so the caption can explain it
    };  // ends tryLoad
    for (let i = 0; i <= upto; i++) {  // plays every event from the first up to the chosen one, in order
      const e = WORKLOAD[i];  // e: the event being played
      st.dyn.last = ''; st.pag.last = '';  // clears last, the word that says what happened at this event on each side
      if (e.load) {  // an arrival event: both schemes try to load the same process
        ['dyn', 'pag'].forEach((side) => {  // does the same thing for the partitioning side and the paging side
          const r = tryLoad(side, e.load);  // r: the result of trying to load the arriving process on this side
          st[side].last = r.ok ? 'loaded' : 'refused';  // records whether this side loaded the process or refused it
          st[side].res = r;  // keeps the full result (frames used, hole sizes) for the caption
        });  // ends the loop over the two sides
      }  // ends the arrival case
      if (e.remove) { dynRemove(dyn, e.remove); pagedRemove(pag, e.remove); st.dyn.last = st.pag.last = 'removed'; }  // a swap-out event: both sides remove the process, leaving a hole (partitioning) or free frames (paging)
      if (e.retry) {  // the retry event: every waiting process is tried again
        ['dyn', 'pag'].forEach((side) => {  // handled separately on each side
          if (!st[side].waiting.length) { st[side].last = 'idle'; return; }  // if nothing is waiting on this side there is nothing to do, and it is marked idle
          if (side === 'dyn') { st.dyn.moved = dynCompact(dyn); st.dyn.copied += st.dyn.moved; }  // partitioning must compact first; the bytes moved are stored for the caption and added to the running copy total
          const ids = st[side].waiting.slice();  // ids: a copy of the waiting list, taken before tryLoad starts changing it
          st[side].retryOk = ids.filter((id) => tryLoad(side, id).ok);  // retryOk: the processes that load this time
          st[side].retried = ids;  // retried: every process that was tried, used when the caption reports one still cannot load
          st[side].last = side === 'dyn' ? 'compacted' : 'retried';  // records that partitioning compacted, or that paging simply retried
        });  // ends the loop over the two sides
      }  // ends the retry case
    }  // ends the loop over the events
    const holes = dynHoles(dyn);  // after the last event: the holes left under partitioning
    st.dyn.free = holes.reduce((s, x) => s + x.size, 0);  // total free bytes under partitioning, the sum of all holes
    st.dyn.largest = holes.reduce((mx, x) => Math.max(mx, x.size), 0);  // the largest single hole, which decides whether the next process can fit
    st.dyn.holes = holes;  // keeps the holes themselves so the bar can label them
    st.pag.free = pag.free.length * ps;  // free bytes under paging: the number of free frames times the frame size
    st.pag.waste = pagedWaste(pag);  // internal fragmentation under paging: the unused ends of last pages
    return { dyn, pag, st };  // returns both memories plus the story, which the race step draws and narrates
  }  // ends runWorkload

  Guide.section({  // registers this section with the guide; the object below holds everything the section shows
    id: '7.3',  // the section number, used in links, the progress list and saved progress
    title: 'Paging',  // the full title shown at the top of every step
    short: 'Paging',  // the short name used in the side menu and progress list
    summary: 'Equal-size pages placed in any free frames: page tables, free-frame lists and address translation.',  // one-sentence summary shown on the chapter page
    objectives: [  // what the student should be able to do after this section, shown on its first page
      'Explain how paging divides main memory into frames and each process into pages of the same size, and why that removes external fragmentation while leaving only a little internal fragmentation.',  // objective 1: frames and pages, and why only a little internal fragmentation is left
      'Load and swap out processes using a free-frame list and one page table per process, and read off where every page lives.',  // objective 2: loading and swapping with a free-frame list and page tables
      'Split a logical address into page number and offset and translate it into a physical address, both in binary and in decimal.',  // objective 3: splitting and translating a logical address
      'Explain why the page size is always a power of two, and spot an address whose page number lies beyond the end of the page table.',  // objective 4: why page sizes are powers of two, and spotting an out-of-range page number
      'Compare paging with fixed and dynamic partitioning, and run paging against dynamic partitioning on the same workload.',  // objective 5: comparing paging with fixed and dynamic partitioning
    ],  // closes the objectives list
    terms: [  // key terms for the glossary, each written as [term, definition]
      ['Paging', 'A memory-management scheme that cuts main memory into many small, equal frames and each process into pages of the same size, so any page can be loaded into any free frame and a process no longer needs one unbroken stretch of memory. In simple paging every page of a process is in memory while it runs.'],  // glossary entry: paging
      ['Frame (page frame)', 'One of the many equal, fixed-size chunks main memory is divided into. Each frame holds exactly one page.'],  // glossary entry: frame (page frame)
      ['Page', 'One of the equal, fixed-size chunks a process is divided into. A page is exactly the size of a frame, so it fits in any frame.'],  // glossary entry: page
      ['Page size', 'The number of bytes in one page (and so in one frame). It is always a power of two, such as 1,024 or 4,096 bytes.'],  // glossary entry: page size, always a power of two
      ['Page table', 'A table the OS keeps for each process: entry i holds the number of the frame that currently holds page i of that process. The processor uses it to translate every address the process issues.'],  // glossary entry: page table, one per process
      ['Free-frame list', 'The OS’s list of frames that hold no page right now. Loading a process takes frames from it; removing a process gives its frames back.'],  // glossary entry: free-frame list
      ['Page number', 'The left part of a logical address under paging: which page of the process the byte lies on. It is the index into the page table.'],  // glossary entry: page number, the left part of a logical address
      ['Offset', 'The right part of a logical address under paging: how many bytes past the start of its page the byte sits. Translation keeps it unchanged, because a page lands whole in a frame.'],  // glossary entry: offset, the right part of a logical address
      ['Relative address', 'An address counted from the start of the program, so the program’s first byte is address 0. With power-of-two pages its bits are exactly the page number followed by the offset.'],  // glossary entry: relative address, counted from the program's first byte
      ['Address translation', 'Turning the logical address a program uses into the physical address sent to the memory chips. Under paging the hardware swaps the page number for a frame number and keeps the offset.'],  // glossary entry: address translation
      ['Internal fragmentation', 'Wasted space inside an allocated piece of memory, because the piece is bigger than what it holds. Under paging it is only the unused tail of each process’s last page.'],  // glossary entry: internal fragmentation
      ['External fragmentation', 'Free memory split into separate holes between allocated regions, each too small for the next request, even though together they would be big enough.'],  // glossary entry: external fragmentation
      ['Compaction', 'Moving processes in memory so they sit next to each other and all the free space joins into one block. It cures external fragmentation but costs processor time spent copying.'],  // glossary entry: compaction
      ['Contiguous allocation', 'Placing a whole process in one unbroken run of addresses in main memory, as fixed and dynamic partitioning both do. Paging drops this requirement.'],  // glossary entry: contiguous allocation
      ['Dynamic partitioning', 'Giving each process one contiguous region of exactly the size it needs, created when the process is loaded. The holes left behind as processes leave cause external fragmentation.'],  // glossary entry: dynamic partitioning
      ['Fixed partitioning', 'Dividing memory, once at system start, into partitions whose boundaries never change; each process takes one whole partition, wasting whatever it does not fill.'],  // glossary entry: fixed partitioning
    ],  // closes the glossary list
    css: ` /* the section's own style rules (CSS, the language that sets colours, sizes and layout); every rule starts with .sec-7-3 so it stays inside this section */
      .sec-7-3 .hot { cursor: pointer; } /* clickable drawing parts (made by hotGroup) show the hand pointer, so students can tell they respond to clicks */
      .sec-7-3 .hot:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; } /* when one of them is reached with the Tab key it gets a 2-pixel accent outline, so keyboard users can see where they are */
      .sec-7-3 .tx-ok { fill: var(--ok); } .sec-7-3 .tx-bad { fill: var(--bad); } .sec-7-3 .tx-acc { fill: var(--accent); } /* text colour classes for SVG labels (fill sets the colour of drawn text): green for good, red for bad, accent */
      .sec-7-3 .tx-mem { fill: var(--mem); } .sec-7-3 .tx-warn { fill: var(--warn); } .sec-7-3 .tx-muted { fill: var(--muted); } /* more SVG text colours: memory, amber warning, and grey for "free" labels */
      .sec-7-3 .c-ok { color: var(--ok); } .sec-7-3 .c-bad { color: var(--bad); } .sec-7-3 .c-acc { color: var(--accent); } /* the same colours for ordinary HTML text (color instead of fill): good, bad and accent */
      .sec-7-3 .c-mem { color: var(--mem); } .sec-7-3 .c-warn { color: var(--warn); } /* memory and amber colours for HTML text */
      .sec-7-3 .narr { border-left: 4px solid var(--line-2); } /* narration cards get a thick grey bar down their left edge */
      .sec-7-3 .narr.ok { border-left-color: var(--ok); } .sec-7-3 .narr.bad { border-left-color: var(--bad); } .sec-7-3 .narr.warn { border-left-color: var(--warn); } /* that bar turns green, red or amber to match the tone narrate() gives the message */
    `,  // end of the CSS text
    steps: [  // steps: the screens of this section, shown one after another
      /* ---------------- 1. Big picture: one hole too small vs. paging ---------------- */
      {  // step 1 starts here
        title: 'Cut memory into frames, programs into pages',  // step 1 title, shown at the top of the screen
        kind: 'story',  // kind "story" marks this as the Big Picture page that opens the section
        render(el, ctx) {  // render(el, ctx): draws step 1 into el; ctx is the guide's toolbox for this screen
          const { h, s } = ctx;  // takes the two element builders out of the toolbox: h makes HTML elements and s makes SVG drawing elements
          // 12 frames of 1 KB; null = free. Holes and D's frames are computed from this layout.
          const LAYOUT = ['A', 'A', null, null, 'B', null, 'C', 'C', 'C', null, null, 'E'];  // LAYOUT: what each of the 12 frames holds, a process letter or null for free; the free ones form holes of 2, 1 and 2 KB
          const COLS = { A: 'proc', B: 'io', C: 'thread', D: 'cpu', E: 'accent' };  // COLS: the colour family of each process letter, matching the PROCS list
          const freeFrames = LAYOUT.map((x, i) => (x ? -1 : i)).filter((i) => i >= 0);  // freeFrames: the numbers of the free frames (2, 3, 5, 9 and 10), found by keeping the positions where LAYOUT is empty
          const holes = []; let run = 0;  // holes collects the size of each run of free frames; run counts the free frames in the current run
          LAYOUT.forEach((x, i) => { if (!x) run++; if ((x || i === LAYOUT.length - 1) && run) { holes.push(run); run = 0; } });  // walks the frames: a free one extends the run, and an occupied frame (or the last frame) ends the run and records its size
          // Geometry: one row of 12 frames on a wide screen, two rows of 6 on a small one.
          const need = 5, G = ctx.narrow  // need: process D's size in KB; G: the drawing's measurements, picked by the guide's phone-width layout flag
            ? { VW: 360, VH: 372, CW: 50, P: 56, X0: 8, PER: 6, MY: 118, RH: 116, DX: 40, DP: 58 }  // small-screen measurements: two rows of 6 frames in a taller picture
            : { VW: 620, VH: 250, CW: 48, P: 50, X0: 10, PER: 12, MY: 116, RH: 0, DX: 150, DP: 58 };  // wide-screen measurements: one row of 12 frames
          const CW = G.CW, X0 = G.X0;  // short names for the frame width and the left margin, used many times below
          const fx = (i) => X0 + (i % G.PER) * G.P, fy = (i) => G.MY + Math.floor(i / G.PER) * G.RH;  // fx(i) and fy(i): the left edge and top of frame i in the drawing, wrapping to a second row on small screens
          const svg = s('svg', { viewBox: `0 0 ${G.VW} ${G.VH}`, width: '100%' });  // the drawing area; viewBox sets its coordinate size and width 100% lets it stretch to fit the column
          const info = h('div', { class: 'card tight small narr', style: { minHeight: '92px', flex: 'none' } });  // info: the narration card under the drawing; a minimum height keeps the layout from jumping when the text changes
          function draw(mode) {  // draw(mode): redraws the whole picture, either as one unbroken block ('contig') or as paging ('paged')
            const kids = [s('text', { x: X0, y: 20, 'font-weight': 800, 'font-size': 15 }, `New process D needs ${need} KB`)];  // kids collects every shape of the new picture; it starts with the heading that says how much D needs
            const placed = mode === 'paged' ? freeFrames.slice(0, need) : [];  // placed: under paging, D's pages take the first 5 free frames in order; with one unbroken block nothing is placed
            // the incoming process: one solid block, or five separate pages
            for (let k = 0; k < need; k++) {  // draws D's five 1 KB pieces at the top, one per pass of this loop
              const x = mode === 'paged' ? G.DX + k * G.DP : G.DX + k * CW;  // x: where piece k goes; under paging the pieces are spaced apart, otherwise they touch
              kids.push(s('rect', { x, y: 30, width: CW, height: 40, rx: mode === 'paged' ? 7 : (k === 0 || k === need - 1 ? 7 : 0), class: 's-cpu', 'stroke-width': mode === 'paged' ? 2 : 0 }));  // piece k as a blue box; separate rounded pages under paging, or borderless pieces that will sit under one block outline
              kids.push(s('text', { x: x + CW / 2, y: 55, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 700 }, mode === 'paged' ? 'D' + k : ''));  // the page's name (D0, D1...) under paging; empty in the one-block view
              const f = placed[k];  // f: the frame this page is placed in under paging
              if (mode === 'paged') kids.push(s('line', { x1: x + CW / 2, y1: 72, x2: fx(f) + CW / 2, y2: fy(f) - 6, class: 's-line', style: 'stroke:var(--cpu)', 'stroke-width': 1.5, 'marker-end': 'url(#arr-cpu)' }));  // under paging, a blue arrow runs from the page down to its frame, using the arrowhead the guide defines for that colour
            }  // ends the loop over D's pieces
            if (mode !== 'paged') {  // the one-block view only:
              kids.push(s('rect', { x: G.DX, y: 30, width: need * CW, height: 40, rx: 7, class: 's-cpu', 'stroke-width': 2 }));  // one outlined 5 KB box drawn over the pieces, so D reads as a single block that needs 5 KB in a row
              kids.push(s('text', { x: G.DX + need * CW / 2, y: 55, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700 }, 'D: one 5 KB block'));  // the label inside that block
              kids.push(ctx.narrow  // the red "no hole is big enough" message, placed by the phone-width layout flag:
                ? s('text', { x: G.DX + need * CW / 2, y: 94, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800, class: 'tx-bad' }, '✗ no hole is big enough')  // on small screens, centred under the block
                : s('text', { x: G.DX + need * CW + 14, y: 55, 'font-size': 14, 'font-weight': 800, class: 'tx-bad' }, '✗ no hole is big enough'));  // on wide screens, to the right of the block
            }  // ends the one-block view
            // main memory: 12 frames
            kids.push(s('text', { x: X0, y: G.VH - 6, 'font-size': 13.5, 'font-weight': 700, class: 'tx-mem' }, ctx.narrow ? 'Memory: 12 frames of 1 KB' : 'Main memory: 12 frames of 1 KB each (f0 to f11)'));  // label under memory, shortened on small screens so it fits
            LAYOUT.forEach((p, i) => {  // draws the 12 frames of main memory, one pass per frame
              const d = placed.indexOf(i), y = fy(i);  // d: which page of D (if any) paging put in frame i, or -1; y: the top of frame i
              const who = p || (d >= 0 ? 'D' : null);  // who: the process in this frame, the letter from LAYOUT, or D if one of its pages was just placed here, or nobody
              kids.push(s('rect', { x: fx(i), y, width: CW, height: 54, rx: 6, class: who ? 's-' + COLS[who] : 's-panel', 'stroke-width': who ? 1.5 : 1, 'stroke-dasharray': who ? null : '4 3' }));  // the frame box in its owner's colour, or a dashed grey outline if it is free
              kids.push(s('text', { x: fx(i) + CW / 2, y: y + 32, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700, class: who ? '' : 'tx-muted' }, p ? p : d >= 0 ? 'D' + d : 'free'));  // the label in the middle of the frame: the process letter, D0 to D4 for placed pages, or a grey "free"
              kids.push(s('text', { x: fx(i) + CW / 2, y: y + 70, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, 'f' + i));  // the frame number (f0 to f11) under each box
            });  // ends the loop over the frames
            if (mode !== 'paged') {  // in the one-block view, the free frames are marked as holes:
              // bracket each run of free frames (a run is also cut at the end of a drawn row)
              let i = 0;  // i walks through the frames from the left
              while (i < LAYOUT.length) {  // keeps going until every frame has been checked
                if (LAYOUT[i]) { i++; continue; }  // an occupied frame is skipped
                let j = i; while (j < LAYOUT.length && !LAYOUT[j] && (j === i || j % G.PER !== 0)) j++;  // j moves right while frames stay free, stopping at the start of a new drawn row so a bracket never spans two rows
                const x1 = fx(i), x2 = fx(j - 1) + CW, y = fy(i);  // x1 and x2: the left and right ends of the bracket under frames i to j-1; y: the top of that row
                kids.push(s('path', { d: `M${x1},${y + 78} V${y + 84} H${x2} V${y + 78}`, fill: 'none', style: 'stroke:var(--warn)', 'stroke-width': 2 }));  // an amber bracket under the run: down, across and back up
                kids.push(s('text', { x: (x1 + x2) / 2, y: y + 100, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, class: 'tx-warn' }, `${j - i} KB hole`));  // the hole size under the bracket, such as "2 KB hole"
                i = j;  // jumps past this run to look for the next one
              }  // ends the search for holes
            } else {  // in the paging view, D's page table is written under memory instead:
              const pt = placed.map((f, k) => `${k}→f${f}`).join('  ');  // pt: the table as text, page → frame for each page, such as 0→f2
              if (ctx.narrow) kids.push(s('text', { x: X0, y: G.VH - 44, 'font-size': 13.5, 'font-weight': 700, style: 'fill:var(--cpu)' }, 'D’s page table (page→frame):'));  // on small screens the heading goes on a line of its own above the mappings
              kids.push(s('text', { x: X0, y: G.VH - 26, 'font-size': 13.5, 'font-weight': 700, style: 'fill:var(--cpu)' }, (ctx.narrow ? '' : 'D’s page table (page→frame):  ') + pt));  // the page table line in blue; on wide screens the heading and the mappings share it
            }  // ends the paging view
            svg.replaceChildren(...kids);  // swaps the old picture for the new shapes in one go
            info.className = 'card tight small narr ' + (mode === 'paged' ? 'ok' : 'bad');  // colours the narration card's left bar: green when D fits, red when it does not
            info.innerHTML = mode === 'paged'  // fills the narration card with the explanation for the chosen view:
              ? `<b class="c-ok">D fits.</b> Its ${need} pages go into frames ${placed.join(', ')}. D’s <span class="t">page table</span> records that list, so the processor can find every page. No hole is ever too small, because every hole is a whole number of frames and each page needs exactly one.`  // paging text: D fits, names its frames and says why no hole is ever too small
              : `<b class="c-bad">D does not fit.</b> ${freeFrames.length} KB is free in total, but it is split into holes of ${holes.join(' KB, ')} KB. With <span class="t">contiguous allocation</span> D must wait, or the OS must stop and slide the other processes together (<span class="t">compaction</span>).`;  // one-block text: D does not fit; gives the total free and the hole sizes, and names compaction as the costly cure
          }  // ends draw
          const seg = ctx.ui.seg([{ value: 'contig', label: 'One unbroken block' }, { value: 'paged', label: 'Paging' }], 'contig', draw);  // seg: a two-button switch between the one-block view and the paging view; each press redraws with the chosen mode
          draw('contig');  // draws the starting picture, the one-block view
          el.append(h('div', { class: 'split l fill' },  // puts the step on screen: two columns, the smaller one on the left, filling the step's height
            h('div', { class: 'stack' },  // left column: the explanation, stacked top to bottom
              h('p', { class: 'lead m0', html: 'Dynamic partitioning gives each process one unbroken block of exactly its size. After processes come and go, free memory is scattered in holes, and a new process can be turned away even when the total free space is plenty.' }),  // opening sentence: how holes under dynamic partitioning can turn a process away
              h('p', { class: 'm0', html: '<span class="t">Paging</span> stops handing out memory in odd sizes. Main memory is cut into many small, equal chunks called <span class="t">frames</span>. Every process is cut into chunks of exactly the same size, called <span class="t">pages</span>. Any page fits in any free frame, so one process’s pages can be spread all over memory.' }),  // paragraph introducing paging, frames and pages (the dotted words open their glossary entries)
              h('div', { class: 'callout analogy m0', 'data-label': 'Analogy', html: 'Five friends arrive late at a cinema. Five seats are empty, but no five together. If they agree to sit apart, everyone gets in, as long as someone keeps a note of who sits where. The friends are pages, the seats are frames, and the note is the page table.' }),  // analogy box: friends taking scattered cinema seats, with a note of who sits where as the page table
              h('p', { class: 'small muted m0', html: 'In this section you will load and swap processes by hand, translate addresses bit by bit, and race paging against partitioning on the same workload.' })),  // small grey preview of what the section's later steps let the student do
            h('div', { class: 'stack' },  // right column: the interactive picture
              h('div', { class: 'row', style: { gap: '8px' } }, h('span', { class: 'small b' }, 'Where can D go?'), seg),  // the "Where can D go?" heading with the switch beside it
              h('div', { class: 'card white', style: { padding: '8px 10px' } }, svg),  // a white card holding the drawing
              info,  // the narration card under it
              h('div', { class: 'grid-3', style: { gap: '8px' } },  // three small summary cards side by side
                h('div', { class: 'card tight small', html: '<b class="c-ok">No unusable holes.</b> Every free frame fits any page.' }),  // card 1 in green: paging leaves no unusable holes
                h('div', { class: 'card tight small', html: '<b class="c-warn">Tiny waste.</b> Only the unused end of each process’s last page.' }),  // card 2 in amber: the only waste is the end of each last page
                h('div', { class: 'card tight small', html: '<b class="c-acc">The price.</b> A page table per process, used on every access.' })))));  // card 3 in accent: the price is a page table per process; the brackets close the cards, both columns, the layout and append
        },  // ends render() for step 1
      },  // ends step 1
      /* ---------------- 2. Pages, frames and the only waste ---------------- */
      {  // step 2 starts here
        title: 'Pages, frames, and the only fragmentation paging leaves',  // step 2 title
        kind: 'learn',  // kind "learn": a teaching page with something to try
        render(el, ctx) {  // render(el, ctx): draws step 2 into el
          const { h, s } = ctx;  // takes the HTML builder h and the SVG builder s out of the toolbox
          let size = 5300, ps = 1024;  // size: the process size the slider sets, in bytes; ps: the chosen page size
          const MAXB = 12288, W = ctx.narrow ? 330 : 580, X0 = ctx.narrow ? 15 : 20;   // the bar's scale: 12,288 bytes across W units
          const svg = s('svg', { viewBox: ctx.narrow ? '0 0 360 148' : '0 0 620 128', width: '100%' });  // the drawing area, wider and shorter on wide screens and taller on small ones
          const stats = h('div', { style: { display: 'grid', gridTemplateColumns: `repeat(${ctx.narrow ? 2 : 4}, minmax(0, 1fr))`, gap: '8px' } });  // stats: a grid of number tiles, 4 across on wide screens and 2 across on small ones
          const formula = h('div', { class: 'card tight small', style: { lineHeight: '1.5' } });  // formula: the card that shows the arithmetic in words under the tiles
          const stat = (label, val, cls) => h('div', { class: 'card tight center', style: { padding: '6px 8px' } },  // stat(label, val, cls): builds one tile with a small grey label and a big bold number, optionally coloured
            h('div', { class: 'xs muted b' }, label), h('div', { class: 'mono b ' + (cls || ''), style: { fontSize: '21px' } }, val));  // the tile's two lines: the label, then the value in a fixed-width typeface at 21 pixels
          function update() {  // update(): recomputes everything for the current size and page size and redraws the bar, the tiles and the formula
            const n = pagesFor(size, ps), alloc = n * ps, waste = alloc - size, used = size - (n - 1) * ps;  // n: pages needed; alloc: bytes given in whole pages; waste: the unused bytes; used: bytes actually used in the last page
            const whole = Math.floor(size / ps), rest = size % ps, pct = (100 * waste) / ps;  // whole: how many pages the process fills completely; rest: the leftover bytes; pct: the waste as a share of one page
            const sc = W / MAXB, pw = ps * sc;  // sc: drawing units per byte, so 12,288 bytes span the bar; pw: the drawn width of one page
            const kids = [];  // kids collects the shapes of the bar
            for (let kb = 0; kb <= 12; kb += ctx.narrow ? 4 : 2) {  // a ruler above the bar: a tick every 2 KB on wide screens, every 4 KB on small ones
              const x = X0 + kb * KB * sc;  // x: where this tick sits
              kids.push(s('line', { x1: x, y1: 22, x2: x, y2: 28, class: 's-muted', 'stroke-width': 1 }));  // the short tick mark
              kids.push(s('text', { x, y: 16, 'text-anchor': kb === 12 ? 'end' : kb === 0 ? 'start' : 'middle', 'font-size': 12.5, class: 's-sub' }, kb + ' KB'));  // its label ("4 KB"); the first and last are aligned so they stay inside the drawing
            }  // ends the ruler loop
            for (let i = 0; i < n; i++) {  // draws one teal box for each page the process needs
              const x = X0 + i * pw, last = i === n - 1;  // x: the left edge of page i; last: whether this is the final page
              kids.push(s('rect', { x, y: 30, width: pw, height: 46, class: 's-proc', 'stroke-width': 1.5 }));  // the page box
              if (last && waste > 0) {  // the last page, when it is not completely full:
                const ux = x + used * sc;  // ux: where the process's real bytes end inside the last page
                kids.push(s('rect', { x: ux, y: 31, width: Math.max(0, x + pw - ux - 1), height: 44, class: 's-warn', 'stroke-width': 0 }));  // an amber box over the unused end of the last page, the internal fragmentation
                kids.push(s('line', { x1: ux, y1: 30, x2: ux, y2: 76, style: 'stroke:var(--warn)', 'stroke-width': 2, 'stroke-dasharray': '4 3' }));  // a dashed amber line marking exactly where the process's data stops
              }  // ends the last-page case
              if (pw >= 20) kids.push(s('text', { x: x + pw / 2, y: 92, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, String(i)));  // the page number under each page, left out when pages are drawn too thin for a label to fit
            }  // ends the loop over the pages
            kids.push(s('text', { x: X0, y: 120, 'font-size': 13.5, 'font-weight': 700, style: 'fill:var(--proc)' }, `${fmtN(size)} bytes of process`));  // teal label under the bar giving the process size in bytes
            if (waste > 0) {  // when some of the last page is unused, a label points at the waste:
              const wx = X0 + (alloc - waste / 2) * sc;  // wx: the middle of the amber part, where the label would ideally go
              if (ctx.narrow) kids.push(s('text', { x: X0, y: 142, 'font-size': 13.5, 'font-weight': 800, class: 'tx-warn' }, `Amber: ${fmtN(waste)} B unused in page ${n - 1}`));  // on small screens the label goes on its own line underneath, starting "Amber:" since it cannot point
              else kids.push(s('text', { x: Math.min(wx, 600), y: 120, 'text-anchor': wx > 420 ? 'end' : 'middle', 'font-size': 13.5, 'font-weight': 800, class: 'tx-warn' }, `↑ ${fmtN(waste)} B unused in page ${n - 1}`));  // on wide screens an arrow label sits under the amber part, kept inside the drawing and right-aligned near the end
            }  // ends the waste label
            svg.replaceChildren(...kids);  // swaps the old bar for the new one
            stats.replaceChildren(  // refills the row of number tiles:
              stat('Pages needed', String(n)),  // tile: how many pages the process needs
              stat('Allocated', fmtN(alloc) + ' B'),  // tile: how many bytes it is given in whole pages
              stat('Wasted (internal)', fmtN(waste) + ' B', 'c-warn'),  // tile in amber: the bytes wasted inside the last page
              stat('Wasted, % of a page', (waste && pct < 1 ? '<1' : pct > 99 ? '>99' : Math.round(pct)) + '%', 'c-warn'));  // tile in amber: that waste as a share of one page, shown as "<1%" or ">99%" at the extremes instead of a misleading 0 or 100
            formula.innerHTML = `<b>Pages</b> = ⌈${fmtN(size)} ÷ ${fmtN(ps)}⌉: ${fmtN(size)} = ${whole} × ${fmtN(ps)} + ${fmtN(rest)}` +  // formula card, part 1: the division written out, size = whole pages × page size + leftover
              (rest ? `, and the ${fmtN(rest)} leftover byte${rest === 1 ? '' : 's'} need one more page, so <b>${n}</b>. ` : `, exactly, so <b>${n}</b>. `) +  // part 2: whether the leftover bytes force one more page, giving the page count in bold
              `<b>Allocated</b> = ${n} × ${fmtN(ps)} = ${fmtN(alloc)} bytes. <b>Wasted</b> = ${fmtN(alloc)} − ${fmtN(size)} = <b class="c-warn">${fmtN(waste)} bytes</b>` +  // part 3: bytes allocated and bytes wasted, the waste in amber
              (waste === 0 ? ': the process fills its last page exactly.' : `, all at the end of page ${n - 1}. The page table needs ${n} entries.`);  // part 4: either the process fills its last page exactly, or where the waste sits and how many table entries are needed
          }  // ends update
          const slSize = ctx.ui.slider({ label: 'Process size', min: 500, max: 12000, step: 100, value: size, format: (v) => fmtN(v) + ' B', onInput: (v) => { size = v; update(); } });  // the process-size slider, 500 to 12,000 bytes in steps of 100; each move stores the new size and redraws
          const seg = ctx.ui.seg([512, 1024, 2048, 4096].map((v) => ({ value: v, label: fmtN(v) + ' B' })), ps, (v) => { ps = v; update(); });  // page-size switch with four powers of two, 512 to 4,096 bytes; a press stores the new size and redraws
          update();  // draws the starting picture
          el.append(h('div', { class: 'split l fill' },  // puts the step on screen: two columns, the smaller one on the left
            h('div', { class: 'stack' },  // left column: the explanation
              h('p', { class: 'm0', html: 'A <span class="t">frame</span> is a fixed-size slot in main memory. A <span class="t">page</span> is a chunk of a process of exactly the same size, so any page fits any frame. Simple paging uses one <span class="t">page size</span> for the whole machine, set by the processor’s design and always a power of two. 4 KB (4,096 bytes) is the most common today and some systems use 16 KB; modern processors can also map a few much larger pages for special purposes.' }),  // paragraph: frames and pages are the same size, and real page sizes are powers of two such as 4 KB
              h('p', { class: 'm0', html: 'A process of S bytes needs <b>⌈S ÷ page size⌉</b> pages: divide, then round up. Every page is full except, usually, the last one.' }),  // paragraph: the round-up rule for the number of pages
              h('p', { class: 'm0', html: 'The empty end of that last page is the <b>only</b> fragmentation paging leaves. It is <span class="t">internal fragmentation</span>: always less than one page per process, about half a page on average. There is no <span class="t">external fragmentation</span>, since a free frame is never too small for a page.' }),  // paragraph: the end of the last page is the only (internal) fragmentation, and there is no external fragmentation
              h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'Thinking a 4,100-byte process uses 4,100 bytes of memory. With 4 KB pages it needs two whole frames, 8,192 bytes: memory is handed out only in whole frames.' })),  // amber common-mistake box: a process is given whole frames, never just its own byte count
            h('div', { class: 'stack', style: { gap: '10px' } },  // right column: the controls and results
              h('div', { class: 'card stack', style: { gap: '8px', padding: '10px 12px', flex: 'none' } },  // a card grouping the slider, the page-size switch and the drawing
                slSize,  // the process-size slider
                h('div', { class: 'row', style: { gap: '8px' } }, h('span', { class: 'small b' }, 'Page size:'), seg),  // the "Page size:" label with its switch
                h('div', { class: 'card white', style: { padding: '6px 8px' } }, svg)),  // a white card holding the bar drawing
              stats, formula,  // the four number tiles and the formula card under them
              h('div', { class: 'callout why m0 small', 'data-label': 'Why not tiny pages?', html: 'Smaller pages waste less at the end, but a process then has more pages, so its page table gets longer and every process costs the OS more bookkeeping. Try 512 B versus 4,096 B above and compare Pages needed with Wasted.' }))));  // blue "why" box: smaller pages waste less but need longer page tables; the brackets close the columns, layout and append
        },  // ends render() for step 2
      },  // ends step 2
      /* ---------------- 3. Loader game: load, swap out, load again ---------------- */
      {  // step 3 starts here
        title: 'You are the loader: place pages in free frames',  // step 3 title
        kind: 'explore',  // kind "explore": a hands-on page where the student experiments freely
        core: true,  // core: true keeps this step on the shorter core route through the guide
        render(el, ctx) {  // render(el, ctx): draws step 3 into el
          const { h, s } = ctx;  // takes the HTML builder h and the SVG builder s out of the toolbox
          const NF = 16;  // NF: memory has 16 frames of 1 KB in this game
          let m, gen = 0, reveal = null;  // m: the paged memory; gen: an action counter that lets a newer click cancel an older animation; reveal: how far a load animation has got
          const PER = ctx.narrow ? 4 : 8;                    // frames per drawn row
          const svg = s('svg', { viewBox: ctx.narrow ? '0 0 328 362' : '0 0 640 192', width: '100%' });  // the drawing area: 4 rows of 4 frames on small screens, 2 rows of 8 on wide ones
          const procRow = h('div', { style: { display: 'grid', gridTemplateColumns: `repeat(${ctx.narrow ? 2 : 5}, minmax(0, 1fr))`, gap: '8px' } });  // procRow: the row of five process cards with their Load and Swap out buttons, 5 across (2 on small screens)
          const narr = h('div', { class: 'card tight small narr', style: { minHeight: '86px', flex: 'none' } });  // narr: the narration card that explains each action; its minimum height stops the layout jumping
          const freeBox = h('div', { class: 'row', style: { gap: '4px' } });  // freeBox: the row of chips showing the free-frame list
          const freeHead = h('h4', { class: 'm0' });  // freeHead: the heading over the free-frame list, which also shows how many frames are free
          const tables = h('div', { style: { display: 'grid', gridTemplateColumns: `repeat(${ctx.narrow ? 3 : 5}, minmax(0, 1fr))`, gap: '6px', alignItems: 'start' } });  // tables: one small page table per process, 5 across (3 on small screens), lined up at the top
          const totals = h('div', { class: 'small', style: { lineHeight: '1.5' } });  // totals: the card that adds up internal and external fragmentation
          // The view = the model, except pages of a process still being animated in are not placed yet.
          function view() {  // view(): what should be drawn right now: copies of the frames, free list and page tables, with unrevealed pages held back
            const frames = m.frames.slice(), free = m.free.slice(), tbl = {};  // copies, so hiding pages for the animation never changes the real model
            Object.keys(m.tables).forEach((id) => { tbl[id] = m.tables[id].slice(); });  // copies each page table the same way
            if (reveal) {  // during a load animation:
              const t = m.tables[reveal.id] || [];  // t: the page table of the process being loaded
              t.forEach((f, pg) => { if (pg >= reveal.k) { frames[f] = null; free.push(f); } });  // pages not revealed yet are drawn as free, and their frames appear on the free list
              tbl[reveal.id] = t.slice(0, reveal.k);  // the page table shows only the entries revealed so far
              free.sort((a, b) => a - b);  // keeps the shown free list in frame order
            }  // ends the animation case
            return { frames, free, tbl };  // returns the three things draw() needs
          }  // ends view
          function frameInfo(f) {  // frameInfo(f): runs when the student clicks frame f and describes what it holds in the narration card
            const c = view().frames[f];                      // what is drawn now, so a page still being animated in reads as free
            if (!c) { narrate(narr, `<b>Frame ${f}</b> is free. It sits on the <span class="t">free-frame list</span>, ready for any page of any process.`, ''); return; }  // a free frame: explains that it waits on the free-frame list for any page of any process
            const end = Math.min(c.pg * KB + KB, PROC[c.p].size) - 1, tail = c.pg * KB + KB - 1 - end;  // end: the last byte of the process stored in this page; tail: how many bytes at the end of the frame go unused
            narrate(narr, `<b>Frame ${f}</b> holds page ${c.pg} of ${c.p}: ${c.p}’s bytes ${fmtN(c.pg * KB)} to ${fmtN(end)}` + (tail ? `, and the last ${fmtN(tail)} bytes of the frame are unused (internal fragmentation)` : '') +  // an occupied frame: which page of which process, its byte range, and any unused tail (internal fragmentation)
              `. Entry ${c.pg} of ${c.p}’s <span class="t">page table</span> says “frame ${f}”, which is how the processor finds it.`, '');  // and which page-table entry points here, which is how the processor finds the page
          }  // ends frameInfo
          function draw() {  // draw(): redraws memory, the free-frame list, the page tables, the totals and the process cards from view()
            const v = view();  // v: what to show right now
            const kids = [s('text', { x: 6, y: 15, 'font-size': 13.5, 'font-weight': 800, class: 'tx-mem' }, ctx.narrow ? `Memory: ${NF} frames × 1 KB (click one)` : `Main memory: ${NF} frames × 1 KB (click a frame)`)];  // kids starts with the memory heading, shortened on small screens
            for (let f = 0; f < NF; f++) {  // one pass per frame of memory
              const c = v.frames[f], x = 6 + (f % PER) * 79, y = 26 + Math.floor(f / PER) * 84;  // c: what frame f holds; x and y: its position in the grid of rows
              const fresh = reveal && c && c.p === reveal.id && c.pg === reveal.k - 1;  // fresh: true for the page that just appeared in a load animation, so it can be outlined more thickly
              kids.push(hotGroup(ctx, () => frameInfo(f), 'Frame ' + f,  // each frame is a clickable group that calls frameInfo; "Frame f" is what a screen reader announces
                s('rect', { x, y, width: 74, height: 76, rx: 8, class: c ? 's-' + PROC[c.p].col : 's-panel', 'stroke-width': fresh ? 3.5 : c ? 1.5 : 1, 'stroke-dasharray': c ? null : '4 3' }),  // the frame box in its process's colour, thicker if fresh, and dashed grey if free
                s('text', { x: x + 7, y: y + 16, 'font-size': 12.5, class: 's-sub' }, 'f' + f),  // the small grey frame number in the top-left corner
                s('text', { x: x + 37, y: y + 50, 'text-anchor': 'middle', 'font-size': c ? 19 : 13.5, 'font-weight': 800, class: c ? '' : 'tx-muted' }, c ? c.p + c.pg : 'free')));  // the big label: process letter and page number (such as A0), or a grey "free"
            }  // ends the loop over the frames
            svg.replaceChildren(...kids);  // swaps the old drawing for the new frames
            freeHead.textContent = `Free-frame list (${v.free.length} free)`;  // updates the free-frame list heading with the current count
            freeBox.replaceChildren(...(v.free.length ? v.free.map((f) => h('span', { class: 'chip mem mono' }, String(f))) : [h('span', { class: 'small muted' }, 'empty: every frame is in use')]));  // one green chip per free frame number, or a grey note when every frame is in use
            tables.replaceChildren(...PROCS.map((p) => {  // rebuilds the page-table area with one entry for each process:
              const t = v.tbl[p.id];  // t: this process's page table as currently shown, if it is in memory
              if (!t) return h('div', { class: 'card tight center xs muted', style: { padding: '6px 4px' } }, h('div', { class: 'b' }, p.id), 'on disk');  // a process not in memory shows a small grey "on disk" card instead of a table
              return h('table', { class: 'tbl compact mono', style: { fontSize: '13.5px' } },  // a compact table in the fixed-width typeface
                h('tr', {}, h('th', { colspan: 2, class: 'center', style: { color: `var(--${p.col})`, padding: '2px 4px' } }, p.id)),  // header row: the process letter in its colour, across both columns
                ...t.map((f, pg) => h('tr', {}, h('td', { class: 'muted', style: { padding: '1px 6px' } }, String(pg)), h('td', { class: 'b', style: { padding: '1px 6px' } }, String(f)))));  // one row per page: the page number in grey, then the frame number in bold
            }));  // ends the page-table area
            const ins = Object.keys(m.tables);  // ins: the processes now in memory
            const parts = ins.map((id) => `${id} ${fmtN(wasteFor(PROC[id].size, KB))}`);  // parts: each one's internal fragmentation as text, such as "A 196"
            totals.innerHTML = `<b class="c-warn">Internal fragmentation:</b> ${ins.length ? parts.join(' + ') + ' = <b>' + fmtN(pagedWaste(m)) + ' B</b>' : '0 B'}, the unused ends of last pages.<br>` +  // totals card, line 1: the internal fragmentation of each process, added up (or 0 B when memory is empty)
              '<b class="c-ok">External fragmentation: 0 B.</b> Every free frame can take any page.';  // line 2: external fragmentation is always 0 under paging, since any free frame takes any page
            procRow.replaceChildren(...PROCS.map((p) => {  // rebuilds the five process cards so each button matches whether its process is in memory:
              const inMem = !!m.tables[p.id];  // inMem: true when the process has a page table, meaning it is loaded
              return h('div', { class: 'card tight stack', style: { gap: '4px', padding: '6px 8px' } },  // the card, a small stack of three lines
                h('span', { class: 'chip ' + p.col, style: { alignSelf: 'flex-start' } }, 'Process ' + p.id),  // a coloured tag with the process name, in the same colour as its frames
                h('div', { class: 'xs', style: { lineHeight: '1.35' } }, h('span', { class: 'mono' }, fmtN(p.size) + ' bytes'), h('br'), h('b', {}, pagesFor(p.size, KB) + ' pages of 1 KB')),  // the process size in bytes and how many 1 KB pages it needs
                h('button', { class: 'btn sm' + (inMem ? '' : ' primary'), onclick: () => (inMem ? swapOut(p.id) : load(p.id)) }, inMem ? 'Swap out' : 'Load'));  // the button: a highlighted "Load" when the process is on disk, a plain "Swap out" when it is in memory
            }));  // ends the process cards
          }  // ends draw
          async function load(id) {  // load(id): runs when Load is pressed; async lets it pause between pages so they appear one at a time
            const g = ++gen; reveal = null;  // g: this action's number (gen goes up by one); any animation still running from an earlier click will notice and stop
            const r = pagedLoad(m, PROC[id]);  // r: the result of asking the paged memory to load the process
            if (!r.ok) {  // not enough free frames:
              draw();  // redraws so any half-finished animation is cleared
              narrate(narr, `<b class="c-bad">${id} must wait.</b> It needs ${r.need} frames and only ${r.free} ${r.free === 1 ? 'is' : 'are'} free. Under paging that count is the <b>only</b> question; where the free frames sit never matters. Swap a process out to make room.`, 'bad');  // red narration: how many frames it needs, how many are free, and that only the count matters, never where they are
              return;  // stops here; nothing was loaded
            }  // ends the refusal case
            const contiguous = r.frames.every((f, i) => i === 0 || f === r.frames[i - 1] + 1);  // contiguous: true if the frames it got happen to be numbered one after another
            narrate(narr, `<b class="c-ok">Loaded ${id}.</b> The OS took the first ${r.need} frames on the free-frame list, ${listOf(r.frames)}, and filled in ${id}’s page table: page 0 → frame ${r.frames[0]}, page 1 → frame ${r.frames[1]}, and so on. ` +  // green narration: which frames were taken from the free-frame list and how the page table maps them
              (contiguous ? 'They happen to be side by side this time.' : '<b>They are not side by side, and that does not matter:</b> the page table remembers where every page went.') + ` ${m.free.length} ${m.free.length === 1 ? 'frame remains' : 'frames remain'} free.`, 'ok');  // adds whether the frames are side by side (and why it does not matter) and how many frames remain free
            for (let k = 0; k <= r.need; k++) {  // the animation: one pass per page, plus a final pass that shows everything
              reveal = k < r.need ? { id, k } : null;  // reveal says how many pages to show so far; on the last pass it is cleared
              draw();  // redraws with one more page placed
              if (k < r.need) { await ctx.sleep(220); if (!ctx.alive || g !== gen) return; }  // waits 220 ms between pages, and quits if the student left the step or pressed something else meanwhile
            }  // ends the animation loop
          }  // ends load
          function swapOut(id) {  // swapOut(id): runs when Swap out is pressed; it takes the process out of memory at once, with no animation
            gen++; reveal = null;  // bumps the action counter so any load animation stops, and clears reveal
            const back = pagedRemove(m, id);  // back: the frames the process gave up
            draw();  // redraws memory, the free list and the tables
            narrate(narr, `<b>Swapped out ${id}.</b> Its pages are copied to disk, and frames ${listOf(back)} go back on the free-frame list. ${id}’s page table is thrown away: when ${id} returns it will probably get different frames and a new table, and its program will never notice.`, 'warn');  // amber narration: the frames go back on the free-frame list and the page table is discarded
          }  // ends swapOut
          function reset() {  // reset(): empties memory, used at the start and by the Empty memory button
            gen++; reveal = null; m = makePaged(NF, KB); draw();  // stops any animation, makes a fresh 16-frame memory and redraws it
            narrate(narr, '<b>Memory is empty.</b> Each process shows its size and how many 1 KB pages it needs. Load processes, swap one out, and watch the free-frame list and the page tables change.', '');  // narration explaining what the student can do next
          }  // ends reset
          reset();  // starts the step with memory empty
          el.append(h('div', { class: 'split r fill' },  // puts the step on screen: two columns, the smaller one on the right
            h('div', { class: 'stack', style: { gap: '10px' } },  // left column: the game itself
              procRow,  // the row of process cards
              h('div', { class: 'card white', style: { padding: '6px 8px' } }, svg),  // a white card holding the memory drawing
              narr,  // the narration card
              h('div', { class: 'row', style: { gap: '8px', justifyContent: 'space-between' } },  // a row with a suggestion on the left and a reset button on the right
                h('span', { class: 'small', html: '<b>Try:</b> load A, B and C → try D → swap out B → load D.' }),  // the suggested sequence, which ends with D landing in frames that are not side by side
                h('button', { class: 'btn sm ghost', onclick: reset }, 'Empty memory'))),  // quiet button that empties memory and starts again
            h('div', { class: 'stack', style: { gap: '10px' } },  // right column: the OS's records
              h('div', { class: 'card tight stack', style: { gap: '6px', flex: 'none' } }, freeHead, freeBox),  // a card with the free-frame list heading and its chips
              h('div', { class: 'card tight stack', style: { gap: '6px', flex: 'none' } }, h('h4', { class: 'm0' }, 'Page tables: page (grey) → frame (bold)'), tables),  // a card with the page tables, headed with how to read them (page in grey, frame in bold)
              h('div', { class: 'card tight', style: { flex: 'none' } }, totals),  // the fragmentation totals card
              h('div', { class: 'callout tip m0 small', 'data-label': 'Real systems', html: 'A real OS usually does not keep its free frames in order; it takes whichever ones are handiest. This list is sorted only to make it easy to read.' }))));  // green tip box: real systems do not keep the free list sorted; the brackets close the columns, layout and append
        },  // ends render() for step 3
      },  // ends step 3
      /* ---------------- 4. Following a page through its page table ---------------- */
      {  // step 4 starts here
        title: 'Page tables: from (page, offset) to (frame, offset)',  // step 4 title
        kind: 'learn',  // kind "learn": a teaching page with something to try
        render(el, ctx) {  // render(el, ctx): draws step 4 into el
          const { h, s } = ctx;  // takes the HTML builder h and the SVG builder s out of the toolbox
          // Rebuild the loader's suggested ending: load A, B, C; swap out B; load D.
          const m = makePaged(16, KB);  // m: a fresh 16-frame memory with 1 KB pages
          ['A', 'B', 'C'].forEach((id) => pagedLoad(m, PROC[id]));  // loads A, B and C in that order
          pagedRemove(m, 'B');  // swaps B out, freeing frames 4, 5 and 6
          pagedLoad(m, PROC.D);  // loads D, which gets frames 4, 5, 6, 12, 13 and 14, not side by side
          const IN = Object.keys(m.tables).sort();  // IN: the processes now in memory, A, C and D in alphabetical order, one button each
          const OFF = 100;                                       // the sample offset used in the worked example
          let who = 'D', sel = 1;  // who: whose page table is shown, starting with D; sel: the selected page, starting with page 1
          // x positions of the three columns (pages, page table, memory) for a wide or a small screen
          const X = ctx.narrow  // X: the drawing's column positions and widths, picked by the phone-width layout flag
            ? { VW: 360, pg: 6, pgW: 110, tb: 150, tbW: 64, fr: 252, frW: 102, title2: 'table', title3: 'memory' }  // small-screen positions, with the shorter column headings "table" and "memory"
            : { VW: 640, pg: 10, pgW: 190, tb: 254, tbW: 96, fr: 456, frW: 178, title2: '', title3: 'Main memory' };  // wide-screen positions; an empty title2 means the heading is filled in as "D's page table"
          const svg = s('svg', { viewBox: `0 0 ${X.VW} 352`, width: '100%' });  // the drawing area, 352 units tall
          const info = h('div', { class: 'card tight small narr', style: { minHeight: '84px', flex: 'none', lineHeight: '1.45' } });  // info: the narration card under the drawing, with a minimum height so the layout does not jump
          const PY = 44, PH = 40, PG = 6, FY = 40, FH = 19;      // page rows and frame rows
          function draw() {  // draw(): redraws the pages, the page table, the arrows and memory for the chosen process and page
            const t = m.tables[who], col = PROC[who].col, n = t.length;  // t: the shown process's page table; col: its colour; n: how many pages it has
            const py = (i) => PY + i * (PH + PG), fy = (f) => FY + f * FH;  // py(i): the top of page i's row; fy(f): the top of frame f's thin row in the memory column
            const kids = [  // kids starts with the three column headings:
              s('text', { x: X.pg, y: 22, 'font-size': 13.5, 'font-weight': 800, style: `fill:var(--${col})` }, `${who}’s pages`),  // heading over the pages, such as "D's pages", in the process's colour
              s('text', { x: X.tb + X.tbW / 2, y: 22, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 800 }, X.title2 || `${who}’s page table`),  // heading over the page table
              s('text', { x: X.fr + X.frW / 2, y: 22, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 800, class: 'tx-mem' }, X.title3),  // heading over memory, in the memory colour
            ];  // ends the headings
            // arrows first, so boxes sit on top of them
            t.forEach((f, i) => {  // one pair of arrows per page:
              const on = i === sel, y = py(i) + PH / 2;  // on: whether this page is the selected one; y: the vertical middle of its row
              const stroke = on ? `var(--${col})` : 'var(--line-2)';  // the selected page's arrows use the process colour; the others are faint grey
              kids.push(s('line', { x1: X.pg + X.pgW + 2, y1: y, x2: X.tb - 2, y2: y, style: `stroke:${stroke}`, 'stroke-width': on ? 2.5 : 1.2, 'marker-end': on ? `url(#arr-${col})` : 'url(#arr-muted)' }));  // a straight arrow from the page to its page-table entry, thicker when selected
              const x1 = X.tb + X.tbW, x2 = X.fr - 4, cx = (x1 + x2) / 2;  // x1 and x2: where the curve from the entry to memory starts and ends; cx: halfway between them
              kids.push(s('path', { d: `M${x1},${y} C${cx},${y} ${cx},${fy(f) + FH / 2} ${x2},${fy(f) + FH / 2}`, fill: 'none', style: `stroke:${stroke}`, 'stroke-width': on ? 2.5 : 1.2, 'marker-end': on ? `url(#arr-${col})` : 'url(#arr-muted)' }));  // a curved arrow (a cubic curve, C in the path) from the entry to the frame it names
            });  // ends the arrows
            t.forEach((f, i) => {  // then the boxes, one row per page:
              const on = i === sel, y = py(i);  // on: whether this page is selected; y: the top of its row
              kids.push(hotGroup(ctx, () => { sel = i; draw(); }, `Page ${i} of ${who}`,  // the page box is clickable; choosing it selects that page and redraws
                s('rect', { x: X.pg, y, width: X.pgW, height: PH, rx: 7, class: 's-' + col, 'stroke-width': on ? 3 : 1.2 }),  // the page box in the process's colour, outlined more thickly when selected
                s('text', { x: X.pg + 12, y: y + 25, 'font-size': 15, 'font-weight': 800 }, 'page ' + i),  // its label, "page 0", "page 1" and so on
                ctx.narrow ? null : s('text', { x: X.pg + X.pgW - 10, y: y + 25, 'text-anchor': 'end', 'font-size': 12.5, class: 's-sub s-monot' }, `${fmtN(i * KB)}–${fmtN(i * KB + KB - 1)}`)));  // on wide screens, the page's range of relative addresses at the right end (left out on small screens)
              kids.push(hotGroup(ctx, () => { sel = i; draw(); }, `Page table entry ${i}`,  // the page-table entry is clickable too and selects the same page
                s('rect', { x: X.tb, y: y + 4, width: X.tbW, height: PH - 8, rx: 5, class: on ? 's-accent' : 's-panel', 'stroke-width': on ? 2.5 : 1 }),  // the entry box, in the accent colour when selected
                s('text', { x: X.tb + 9, y: y + 25, 'font-size': 13, class: 's-sub' }, String(i)),  // the entry's index in small grey type on the left
                s('line', { x1: X.tb + 24, y1: y + 6, x2: X.tb + 24, y2: y + PH - 6, class: 's-muted', 'stroke-width': 1 }),  // a thin divider between the index and the frame number
                s('text', { x: X.tb + 24 + (X.tbW - 24) / 2, y: y + 26, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 800, class: on ? 'tx-acc' : '' }, String(f))));  // the frame number the entry holds, in the accent colour when selected
            });  // ends the boxes
            for (let f = 0; f < m.n; f++) {  // draws all 16 frames of memory as thin rows on the right
              const c = m.frames[f], y = fy(f), on = c && c.p === who && c.pg === sel;  // c: what frame f holds; y: the top of its row; on: whether it holds the selected page
              kids.push(s('rect', { x: X.fr, y: y + 1, width: X.frW, height: FH - 2, rx: 4, class: c ? 's-' + PROC[c.p].col : 's-panel', 'stroke-width': on ? 3 : 1, 'stroke-dasharray': c ? null : '3 3', style: c && c.p !== who ? 'opacity:.45' : '' }));  // the frame row in its owner's colour; frames of other processes are faded, and the selected page's frame is outlined thickly
              kids.push(s('text', { x: X.fr + 8, y: y + 14, 'font-size': 12.5, class: 's-sub' }, 'f' + f));  // the frame number in small grey type on the left of the row
              kids.push(s('text', { x: X.fr + X.frW / 2 + 12, y: y + 14, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': c ? 700 : 400, class: c ? '' : 'tx-muted' }, c ? c.p + c.pg : 'free'));  // the frame's contents, such as D1, or a grey "free"
            }  // ends the loop over the frames
            kids.push(s('text', { x: X.pg, y: py(n) + 14, 'font-size': 12.5, class: 's-sub' }, `${n} pages, so ${n} table entries`));  // a grey note under the pages: the number of pages equals the number of table entries
            svg.replaceChildren(...kids);  // swaps the old drawing for the new one
            const f = t[sel], rel = sel * KB + OFF, phys = f * KB + OFF, last = sel === n - 1;  // f: the frame of the selected page; rel: a sample address 100 bytes into that page; phys: where it lands; last: whether it is the final page
            const used = PROC[who].size - (n - 1) * KB;  // used: how many bytes of the process's last page are really used
            info.innerHTML = `<b>Page ${sel}</b> of ${who} holds relative addresses ${fmtN(sel * KB)} to ${fmtN(sel * KB + KB - 1)}; <b>entry ${sel}</b> says <b class="c-acc">frame ${f}</b>, so they sit at physical ${fmtN(f * KB)} to ${fmtN(f * KB + KB - 1)}. ` +  // narration, part 1: the selected page's range of relative addresses, the frame its entry names and that frame's physical range
              (f === sel ? `Page ${sel} sits in frame ${f} only by chance (${who} was loaded first, into empty memory); Process D shows the usual case.`  // if the frame number happens to equal the page number (process A, loaded into empty memory), it says that is only chance
                : `Example: relative ${fmtN(rel)} = (page ${sel}, offset ${OFF}) → (frame ${f}, offset ${OFF}) = ${fmtN(f)} × 1,024 + ${OFF} = <b>${fmtN(phys)}</b>.`) +  // otherwise, a worked translation of the sample address, ending in frame × 1,024 + offset
              (last ? ` Only the first ${fmtN(used)} bytes of this last page are used; the other ${fmtN(KB - used)} are internal fragmentation.` : '');  // for the last page, adds how many of its bytes are used and how many are internal fragmentation
          }  // ends draw
          const seg = ctx.ui.seg(IN.map((id) => ({ value: id, label: 'Process ' + id })), who, (v) => { who = v; sel = 0; draw(); });  // seg: one button per process in memory; choosing one shows its page table and selects its page 0
          draw();  // draws the starting picture: process D with page 1 selected
          el.append(h('div', { class: 'split l fill' },  // puts the step on screen: two columns, the smaller one on the left
            h('div', { class: 'stack' },  // left column: the explanation
              h('p', { class: 'm0', html: 'The OS keeps one <span class="t">page table</span> per process, with one entry per page: entry <i>i</i> holds the frame number of page <i>i</i>. It also keeps one <span class="t">free-frame list</span>.' }),  // paragraph: one page table per process, with one entry per page, plus one free-frame list
              h('p', { class: 'm0', html: 'A program never sees frames. Each <span class="t">logical address</span> it uses is a <span class="t">relative address</span>, counted from its own byte 0. The processor reads each one as a pair: <b>(<span class="t">page number</span>, <span class="t">offset</span>)</b>, meaning which page, and how far into it.' }),  // paragraph: programs use relative addresses, read by the processor as (page number, offset)
              h('p', { class: 'm0', html: '<span class="t">Address translation</span> swaps the page number for a frame number: <b>(page, offset) → (frame, offset)</b>. The offset never changes, because a page is copied into its frame whole.' }),  // paragraph: translation replaces the page number with a frame number and leaves the offset alone
              h('div', { class: 'callout why m0 small', 'data-label': 'Who does the lookup?', html: 'The processor’s <span class="t">memory management unit</span>, on every access. At each process switch the OS loads the new table’s address and length into processor registers (many modern processors skip the length and mark unused entries invalid instead).' }),  // blue "why" box: the memory management unit does the lookup, using a table address the OS loads at each process switch
              h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'A page table holds frame <b>numbers</b>, not the pages themselves, and there is one per process, not one for all of memory.' })),  // amber common-mistake box: a page table holds frame numbers, and there is one per process
            h('div', { class: 'stack', style: { gap: '8px' } },  // right column: the interactive picture
              h('div', { class: 'row', style: { gap: '8px' } }, h('span', { class: 'small b' }, 'Show:'), seg, h('span', { class: 'xs muted' }, 'Click any page or table entry.')),  // a row with the "Show:" label, the process switch and a hint to click pages or entries
              h('div', { class: 'card white', style: { padding: '6px 8px' } }, svg),  // a white card holding the drawing
              info)));  // the narration card; the brackets close the right column, the layout and append
        },  // ends render() for step 4
      },  // ends step 4
      /* ---------------- 5. Why the page size is a power of two (step-through) ---------------- */
      {  // step 5 starts here
        title: 'Why page sizes are powers of two',  // step 5 title
        kind: 'explore',  // kind "explore": a hands-on page; here the student steps through an animation
        render(el, ctx) {  // render(el, ctx): draws step 5 into el
          const { h, s } = ctx;  // takes the HTML builder h and the SVG builder s out of the toolbox
          const N = 16, M = 10, PS = 2 ** M, ADDR = 3000, PT = [5, 12, 9, 3];  // N: addresses are 16 bits; M: the offset is 10 bits, so pages are 2^10 = 1,024 bytes; ADDR: the example address; PT: a 4-entry page table
          const pg = ADDR >> M, off = ADDR & (PS - 1), fr = PT[pg], PHYS = (fr << M) | off;  // pg: shifting right by 10 bits (>>) drops the offset, leaving page 2; off: & keeps only the low 10 bits (952); PHYS: frame 9's bits joined to the offset (|)
          const relBits = bin(ADDR, N), physBits = bin(PHYS, N);  // both addresses written as 16-character strings of 0s and 1s
          const powers = relBits.split('').map((b, i) => (b === '1' ? 2 ** (N - 1 - i) : 0)).filter(Boolean);  // powers: the place value of every 1 bit in 3,000 (2,048 + 512 + ...), shown in the decimal panel
          const SM = ctx.narrow, bx = (i) => (SM ? 10 + i * 21.25 : 14 + i * 41), CW = SM ? 19.5 : 38, BF = SM ? 14 : 18;  // SM: the phone-width layout flag; bx(i): left edge of bit box i; CW: bit box width; BF: font size of the bits
          const mid = (a, b) => (bx(a) + bx(b) + CW) / 2;  // mid(a, b): the horizontal middle of bit boxes a to b, used to aim arrows and labels
          const svg = s('svg', { viewBox: SM ? '0 0 360 374' : '0 0 760 352', width: '100%' });  // the drawing area, wider on wide screens and taller on small ones
          const dec = h('div', { class: 'stack', style: { gap: '6px' } });  // dec: the panel on the right that repeats each step in ordinary decimal arithmetic
          function bitsRow(y, bits, clsAt, shown) {  // bitsRow(y, bits, clsAt, shown): builds a row of 16 bit boxes at height y; clsAt(i) picks each box's colour
            const out = [];  // out collects the boxes and digits
            for (let i = 0; i < N; i++) {  // one pass per bit
              out.push(s('rect', { x: bx(i), y, width: CW, height: 44, rx: 6, class: shown ? clsAt(i) : 's-panel', 'stroke-width': 1.5, 'stroke-dasharray': shown ? null : '4 3' }));  // the bit's box, coloured by clsAt, or dashed grey while the row is still hidden
              out.push(s('text', { x: bx(i) + CW / 2, y: y + 28, 'text-anchor': 'middle', 'font-size': BF, 'font-weight': 700, class: 's-monot' + (shown ? '' : ' tx-muted') }, shown ? bits[i] : '?'));  // the bit itself in the middle of the box, or a grey "?" while hidden
            }  // ends the loop over the bits
            return out;  // returns all the shapes so the caller can add them to the picture
          }  // ends bitsRow
          function brace(a, b, y, label, cls) {  // brace(a, b, y, label, cls): a bracket under bit boxes a to b with a label beneath it, in colour cls
            const x1 = bx(a) + 2, x2 = bx(b) + CW - 2;  // x1 and x2: the left and right ends of the bracket, slightly inside the outer boxes
            return [s('path', { d: `M${x1},${y} V${y + 6} H${x2} V${y}`, fill: 'none', style: `stroke:var(--${cls})`, 'stroke-width': 2 }),  // the bracket: down, across and back up
              s('text', { x: (x1 + x2) / 2, y: y + 24, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800, style: `fill:var(--${cls})` }, label)];  // the label centred under the bracket; the function returns both shapes as a list
          }  // ends brace
          const arrow = (d, cls) => s('path', { d, fill: 'none', style: `stroke:var(--${cls})`, 'stroke-width': 2.5, 'marker-end': `url(#arr-${cls})` });  // arrow(d, cls): a thick coloured line following the path d, with an arrowhead of the same colour at its end
          function draw(f) {  // draw(f): draws frame f of the step-through (0 to 7); the player calls it each time the frame changes
            const split = f >= 2, kids = [];  // split: from frame 2 on, the address is shown cut into page number and offset; kids collects the shapes
            kids.push(...bitsRow(30, relBits, (i) => (!split ? 's-panel' : i < N - M ? 's-warn' : 's-mem'), f >= 1));  // top row: the relative address bits, hidden on frame 0, plain on frame 1, then amber page bits and green offset bits
            if (SM) kids.push(s('text', { x: 10, y: 20, 'font-size': 14, 'font-weight': 800 }, 'relative address = ' + fmtN(ADDR)));  // on small screens, the label "relative address = 3,000" goes above the row
            else kids.push(s('text', { x: 680, y: 46, 'font-size': 13, class: 's-sub' }, 'relative'), s('text', { x: 680, y: 68, 'font-size': 17, 'font-weight': 800 }, '= ' + fmtN(ADDR)));  // on wide screens, "relative" and "= 3,000" sit to the right of the row
            if (split) {  // from frame 2:
              kids.push(...brace(0, N - M - 1, 82, f >= 3 ? `page ${pg}` : `page number (${N - M} bits)`, 'warn'));  // an amber bracket under the 6 page-number bits, labelled with their count, then from frame 3 with their value
              kids.push(...brace(N - M, N - 1, 82, f >= 3 ? `offset ${fmtN(off)}` : `offset (${M} bits)`, 'mem'));  // a green bracket under the 10 offset bits, labelled the same way
            }  // ends the split brackets
            // the page table, under the page-number bits
            kids.push(SM ? s('text', { x: mid(0, N - M - 1) + 10, y: 138, 'font-size': 13.5, 'font-weight': 800, style: f >= 4 ? '' : 'opacity:.5' }, 'page table')  // the "page table" label, faded until frame 4 when the lookup happens; on small screens it sits beside the arrow
              : s('text', { x: 232, y: 166, 'font-size': 13.5, 'font-weight': 800, style: f >= 4 ? '' : 'opacity:.5' }, '← page table'));  // on wide screens "← page table" sits to the right of the table
            PT.forEach((frm, r) => {  // draws the 4 entries of the page table, one row each
              const y = 148 + r * 24, on = f >= 4 && r === pg;  // y: the top of row r; on: the entry that is looked up, highlighted from frame 4 on
              kids.push(s('g', { style: f >= 4 ? '' : 'opacity:.5' },  // the row is a group so the whole row can be faded until frame 4
                s('rect', { x: 50, y, width: 170, height: 22, rx: 4, class: on ? 's-accent' : 's-panel', 'stroke-width': on ? 2.5 : 1 }),  // the entry box, in the accent colour when it is the one looked up
                s('text', { x: 66, y: y + 16, 'font-size': 13, class: 's-sub' }, String(r)),  // the entry's index, in grey
                s('text', { x: 92, y: y + 16, 'font-size': 14, 'font-weight': 800, class: on ? 'tx-acc' : '' }, String(frm)),  // the frame number it holds, in decimal
                s('text', { x: 210, y: y + 16, 'text-anchor': 'end', 'font-size': 13, class: 's-monot s-sub' }, bin(frm, N - M))));  // the same frame number in 6-bit binary, at the right end of the row
            });  // ends the table rows
            if (f >= 4) kids.push(arrow(`M${mid(0, N - M - 1)},114 V144`, 'warn'));  // from frame 4: an amber arrow from the page-number bits down into the table
            if (f >= 5) {  // from frame 5:
              kids.push(arrow(`M${mid(0, N - M - 1)},246 V268`, 'accent'));  // an accent arrow from the table down to the frame bits of the physical address
              kids.push(arrow(`M${mid(N - M, N - 1)},114 V268`, 'mem'));  // a green arrow from the offset bits straight down to the physical address
              if (SM) kids.push(s('text', { x: mid(N - M, N - 1) + 8, y: 190, 'font-size': 13.5, 'font-weight': 700, class: 'tx-mem' }, 'copied'), s('text', { x: mid(N - M, N - 1) + 8, y: 207, 'font-size': 13.5, 'font-weight': 700, class: 'tx-mem' }, 'unchanged'));  // on small screens the label "copied unchanged" is split over two lines beside the green arrow
              else kids.push(s('text', { x: mid(N - M, N - 1) + 10, y: 196, 'font-size': 13.5, 'font-weight': 700, class: 'tx-mem' }, 'copied unchanged'));  // on wide screens it fits on one line
            }  // ends the frame 5 arrows
            kids.push(...bitsRow(272, physBits, (i) => (i < N - M ? 's-accent' : 's-mem'), f >= 5));  // bottom row: the physical address bits, revealed at frame 5, frame bits in accent and offset bits in green
            if (SM) kids.push(s('text', { x: 10, y: 370, 'font-size': 14, 'font-weight': 800 }, 'physical address = ' + (f >= 6 ? fmtN(PHYS) : '?')));  // on small screens, "physical address = ?" under the row, with the decimal value filled in from frame 6
            else kids.push(s('text', { x: 680, y: 288, 'font-size': 13, class: 's-sub' }, 'physical'), s('text', { x: 680, y: 310, 'font-size': 17, 'font-weight': 800 }, f >= 6 ? '= ' + fmtN(PHYS) : '= ?'));  // on wide screens, "physical" and its value sit to the right of the row
            if (f >= 5) {  // from frame 5:
              kids.push(...brace(0, N - M - 1, 322, `frame ${fr}`, 'accent'));  // an accent bracket under the frame-number bits
              kids.push(...brace(N - M, N - 1, 322, `offset ${fmtN(off)}`, 'mem'));  // a green bracket under the offset bits, which are the same as above
            }  // ends the physical brackets
            svg.replaceChildren(...kids);  // swaps the old drawing for the new one
            const lines = [`Page size = ${fmtN(PS)} = 2<sup>${M}</sup> bytes; addresses are ${N} bits.`];  // lines: the decimal panel's lines, starting with the page size and address width
            if (f >= 1) lines.push(`${fmtN(ADDR)} = ${powers.map(fmtN).join(' + ')}`);  // from frame 1: 3,000 written as a sum of powers of two, matching the 1 bits
            if (f >= 3) lines.push(`${fmtN(ADDR)} ÷ ${fmtN(PS)} = <b>${pg}</b> remainder <b>${fmtN(off)}</b>: page ${pg}, offset ${fmtN(off)}`);  // from frame 3: the same split as an ordinary division with remainder
            if (f >= 4) lines.push(`page table entry ${pg} → <b>frame ${fr}</b>`);  // from frame 4: the page-table lookup
            if (f >= 6) lines.push(`physical = ${fr} × ${fmtN(PS)} + ${fmtN(off)} = <b>${fmtN(PHYS)}</b>`);  // from frame 6: the physical address as frame × page size + offset
            if (f >= 7) lines.push(`1,000-byte pages: ${fmtN(ADDR)} ÷ 1,000 = ${Math.floor(ADDR / 1000)} remainder ${ADDR % 1000}, needs a real divider`);  // at frame 7: what 1,000-byte pages would need, a real division
            dec.replaceChildren(...lines.map((l, i) => h('div', { class: 'small' + (i === lines.length - 1 && f > 0 ? ' b' : ''), style: { lineHeight: '1.4' }, html: l })));  // rebuilds the panel, one small line each, with the newest line in bold
          }  // ends draw for step 5
          const CAPS = [  // CAPS: the caption for each of the 8 frames, shown by the player above its buttons
            `The program uses relative address <b>${fmtN(ADDR)}</b>. Pages are ${fmtN(PS)} bytes and addresses are ${N} bits wide. Where does this byte sit in physical memory?`,  // frame 0 caption: the question, where does relative address 3,000 sit in physical memory?
            `Write ${fmtN(ADDR)} as a ${N}-bit binary number: <span class="mono">${relBits}</span>. Nothing has been computed yet; this is simply how the hardware already holds the address.`,  // frame 1: the address written in binary, which is how the hardware already holds it
            `${fmtN(PS)} = 2<sup>${M}</sup>, so the lowest <b>${M} bits are the offset</b> and the <b>${N - M} bits to their left are the page number</b>. ${N - M} bits allow 2<sup>${N - M}</sup> = ${2 ** (N - M)} pages per process. The split is just a cut between two bits.`,  // frame 2: with 1,024-byte pages the low 10 bits are the offset and the other 6 the page number
            `Page bits <span class="mono">${relBits.slice(0, N - M)}</span> = <b>${pg}</b>; offset bits <span class="mono">${relBits.slice(N - M)}</span> = <b>${fmtN(off)}</b>. In binary, dividing by ${fmtN(PS)} costs nothing: quotient and remainder are already sitting in the two groups of bits.`,  // frame 3: reading the two groups of bits gives page 2 and offset 952, a division that costs nothing
            `The hardware uses the page number as an index into the running process’s page table. Entry ${pg} holds <b>frame ${fr}</b> (<span class="mono">${bin(fr, N - M)}</span>).`,  // frame 4: the page number indexes the page table, whose entry 2 holds frame 9
            `The physical address is the frame bits followed by the <b>same</b> offset bits. Only the top ${N - M} bits change; the offset is copied straight across.`,  // frame 5: the physical address is the frame bits followed by the unchanged offset bits
            `<span class="mono">${physBits}</span> = <b>${fmtN(PHYS)}</b>. In decimal that is frame × page size + offset = ${fr} × ${fmtN(PS)} + ${fmtN(off)}. Same answer, yet the hardware never divided, multiplied or added: it only placed bits side by side.`,  // frame 6: the result, 10,168, equals frame × page size + offset, yet the hardware only placed bits side by side
            `Why insist on powers of two? The machine stores addresses in binary, so with 1,000-byte pages ${fmtN(ADDR)} (page ${Math.floor(ADDR / 1000)}, offset ${ADDR % 1000}) could only be split by a real division on every access. For us, writing in decimal, 1,000 is the easy size: 3,952 splits into 3 and 952 just by reading the digits. A power of two plays that role for binary hardware.`,  // frame 7: why powers of two: with 1,000-byte pages every access would need a real division
          ];  // closes the caption list
          const player = ctx.ui.player({ count: CAPS.length, render: (i) => { draw(i); return CAPS[i]; }, interval: 2600 });  // player: the guide's step-through widget; each frame redraws the picture and returns its caption; Play advances every 2.6 seconds
          el.append(h('div', { class: 'split r3 fill' },  // puts the step on screen: two columns, the left one twice as wide
            h('div', { class: 'stack', style: { gap: '8px' } },  // left column: the drawing and the player
              h('div', { class: 'card white grow', style: { padding: '6px 8px', display: 'grid', placeItems: 'center' } }, svg),  // a white card that takes the spare height and centres the drawing inside it
              player.el),  // the player's caption and buttons
            h('div', { class: 'stack', style: { gap: '10px' } },  // right column: the key and the decimal working
              h('div', { class: 'row', style: { gap: '6px' } }, h('span', { class: 'chip warn' }, 'page number'), h('span', { class: 'chip mem' }, 'offset'), h('span', { class: 'chip accent' }, 'frame number')),  // colour key: amber for the page number, green for the offset, accent for the frame number
              h('div', { class: 'card tight stack', style: { gap: '6px', flex: 'none' } }, h('h4', { class: 'm0' }, 'The same steps in decimal'), dec),  // a card headed "The same steps in decimal" holding the decimal panel
              h('div', { class: 'callout why m0 small', 'data-label': 'Why it matters', html: 'Every memory access is translated, so translation must cost almost nothing. Power-of-two pages make it pure wiring: no divider, no multiplier, not even the adder a base register needs.' }),  // blue "why" box: translation happens on every access, so it must be as cheap as wiring
              h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'Adding the frame number to the address. The frame number <b>replaces</b> the page bits: frame × page size + offset, never address + frame.' }))));  // amber common-mistake box: the frame number replaces the page bits, it is never added to the address
        },  // ends render() for step 5
      },  // ends step 5
      /* ---------------- 6. Address translator lab ---------------- */
      {  // step 6 starts here
        title: 'Lab: the address translator',  // step 6 title
        kind: 'lab',  // kind "lab": a hands-on page with free controls
        core: true,  // core: true keeps this step on the shorter core route through the guide
        render(el, ctx) {  // render(el, ctx): draws step 6 into el
          const { h, s } = ctx;  // takes the HTML builder h and the SVG builder s out of the toolbox
          const LEN = 6;                                   // the process has 6 pages, so its page table has 6 entries
          let n = 12, m = 8, addr = 1000, table = [], tick = 1;  // n: address bits; m: offset bits, so pages are 2^m bytes; addr: the address being translated; table: the page table; tick: a counter for fresh random picks
          const SM = ctx.narrow;  // SM: the phone-width layout flag, read once
          const svg = s('svg', { viewBox: SM ? '0 0 360 410' : '0 0 740 396', width: '100%' });  // the drawing area, taller on small screens
          const narr = h('div', { class: 'card tight small narr', style: { minHeight: '104px', flex: 'none', lineHeight: '1.45' } });  // narr: the narration card that explains the translation or the trap
          const facts = h('div', { class: 'small', style: { lineHeight: '1.5' } });  // facts: a short line about the current page size and the valid range of addresses
          const inp = h('input', { type: 'text', inputmode: 'numeric', 'aria-label': 'Logical address', class: 'mono', style: { width: '110px', font: 'inherit', fontSize: '16px', padding: '4px 8px', borderRadius: '8px', border: '1px solid var(--line-2)', background: 'var(--panel)', color: 'var(--ink)' } });  // inp: the box where the student types an address; inputmode numeric brings up a number keypad on phones
          function makeTable() {  // makeTable(): invents a fresh 6-entry page table that suits the current address width and page size
            const rng = ctx.util.seeded(n * 100 + m), nf = 2 ** (n - m), pool = Array.from({ length: nf }, (_, i) => i);  // rng: a seeded random generator (same settings give the same table); nf: how many frames exist; pool: every frame number
            table = [];  // starts with an empty table
            for (let i = 0; i < LEN; i++) table.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);  // picks 6 different frames at random; splice removes each from the pool so no frame is used twice
            derange(table);  // makes sure no page sits in the frame with its own number, so translation always visibly changes the address
          }  // ends makeTable
          function draw() {  // draw(): redraws the bits, the page table and the result for the current settings and address
            const ps = 2 ** m, pb = n - m, cw = Math.min(42, (SM ? 340 : 600) / n), bx = (i) => (SM ? 10 : 14) + i * cw, kids = [];  // ps: page size; pb: page-number bits; cw: width of one bit box, shrinking as addresses get longer; bx(i): left edge of bit i
            const ok = Number.isInteger(addr) && addr >= 0 && addr < 2 ** n;  // ok: true when the address is a whole number that fits in n bits
            const pg = ok ? Math.floor(addr / ps) : null, off = ok ? addr % ps : null, valid = ok && pg < LEN;  // pg and off: the page number and offset; valid: true when the page number is smaller than the table length
            const fr = valid ? table[pg] : null, phys = valid ? fr * ps + off : null;  // fr and phys: the frame and the physical address, only worked out when the page exists
            const rowBits = (y, bits, cls, shown) => { for (let i = 0; i < n; i++) {  // rowBits(y, bits, cls, shown): adds a row of n bit boxes at height y; cls(i) picks each box's colour
              kids.push(s('rect', { x: bx(i) + 1, y, width: cw - 3, height: 40, rx: 5, class: shown ? cls(i) : 's-panel', 'stroke-width': 1.3, 'stroke-dasharray': shown ? null : '4 3' }));  // the bit's box, coloured, or dashed grey when hidden
              kids.push(s('text', { x: bx(i) + cw / 2 - 0.5, y: y + 26, 'text-anchor': 'middle', 'font-size': cw < 26 ? 14 : cw < 40 ? 16 : 17, 'font-weight': 700, class: 's-monot' + (shown ? '' : ' tx-muted') }, shown ? bits[i] : '?'));  // the bit itself, or a grey "?"; the font shrinks as the boxes get thinner
            } };  // ends rowBits
            const brace = (a, b, y, label, col) => { const x1 = bx(a) + 2, x2 = bx(b) + cw - 3;  // brace(a, b, y, label, col): adds a bracket under bit boxes a to b with a label; x1 and x2 are its ends
              kids.push(s('path', { d: `M${x1},${y} V${y + 6} H${x2} V${y}`, fill: 'none', style: `stroke:var(--${col})`, 'stroke-width': 2 }));  // the bracket: down, across and back up
              kids.push(s('text', { x: (x1 + x2) / 2, y: y + 23, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 800, style: `fill:var(--${col})` }, label)); };  // the label centred under it; ends brace
            const lx = Math.min(Math.max((bx(0) + bx(pb - 1) + cw) / 2, 40), 230), ox = bx(n - 1) + cw / 2 - 1;  // lx: where the page-number arrow runs, kept over the table; ox: where the offset arrow runs, under the last bit
            // logical address
            if (SM) kids.push(s('text', { x: 10, y: 16, 'font-size': 14, 'font-weight': 800 }, 'logical address ' + (ok ? '= ' + fmtN(addr) : '= ?')));  // on small screens, the label "logical address = ..." goes above the bits
            else kids.push(s('text', { x: 650, y: 36, 'font-size': 13, class: 's-sub' }, 'logical'));  // on wide screens, "logical" sits to the right of the bits
            rowBits(24, ok ? bin(addr, n) : '', (i) => (i < pb ? 's-warn' : 's-mem'), ok);  // the logical address in binary: amber page-number bits and green offset bits, or question marks if the input is not valid
            if (!SM) kids.push(s('text', { x: 650, y: 58, 'font-size': 17, 'font-weight': 800 }, ok ? '= ' + fmtN(addr) : '= ?'));  // on wide screens, its decimal value (or "= ?") goes under "logical"
            brace(0, pb - 1, 70, ok ? `page ${pg}` : `page (${pb} bits)`, 'warn');  // amber bracket under the page-number bits: the page number, or how many bits it uses
            brace(pb, n - 1, 70, ok ? `offset ${fmtN(off)}` : `offset (${m} bits)`, 'mem');  // green bracket under the offset bits: the offset, or how many bits it uses
            // page table with its length check
            const TY = 128, RH = 22;  // TY: the top of the page table; RH: the height of one row
            kids.push(s('rect', { x: 20, y: TY, width: 226, height: RH - 2, rx: 4, class: 's-panel', 'stroke-width': 1.5 }));  // the table's header box
            kids.push(s('text', { x: 133, y: TY + 15, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 800 }, `page table: ${LEN} entries`));  // header text giving the table's length, the number the hardware checks against
            table.forEach((f, r) => {  // one row per entry:
              const y = TY + (r + 1) * RH, on = valid && r === pg;  // y: the top of this row; on: whether this is the entry the address uses
              kids.push(s('rect', { x: 20, y, width: 226, height: RH - 2, rx: 4, class: on ? 's-accent' : 's-panel', 'stroke-width': on ? 2.5 : 1 }));  // the entry box, in the accent colour when used
              kids.push(s('text', { x: 34, y: y + 15, 'font-size': 12.5, class: 's-sub' }, String(r)));  // the entry's index in grey
              kids.push(s('text', { x: 58, y: y + 15, 'font-size': 13.5, 'font-weight': 800, class: on ? 'tx-acc' : '' }, String(f)));  // the frame number it holds
              kids.push(s('text', { x: 238, y: y + 15, 'text-anchor': 'end', 'font-size': 12.5, class: 's-monot s-sub' }, bin(f, pb)));  // the same frame number in binary, at the right end of the row
            });  // ends the table rows
            if (ok && !valid) {  // when the address is a number but its page is past the end of the table:
              const y = TY + (LEN + 1) * RH + 4;  // y: just below the last real entry
              kids.push(s('rect', { x: 20, y, width: 226, height: RH, rx: 4, class: 's-bad', 'stroke-width': 2, 'stroke-dasharray': '5 3' }));  // a dashed red box where the missing entry would be
              kids.push(s('text', { x: 133, y: y + 16, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 800, class: 'tx-bad' }, `page ${pg}: no such entry ✗`));  // red text "page N: no such entry"
            }  // ends the trap marker
            if (ok) kids.push(s('path', { d: `M${lx},102 V${TY - 4}`, fill: 'none', style: 'stroke:var(--warn)', 'stroke-width': 2.5, 'marker-end': 'url(#arr-warn)' }));  // whenever the address is a number, an amber arrow carries the page number down to the table
            if (valid) {  // when the page exists:
              kids.push(s('path', { d: `M${lx},${TY + (LEN + 1) * RH} V${310}`, fill: 'none', style: 'stroke:var(--accent)', 'stroke-width': 2.5, 'marker-end': 'url(#arr-accent)' }));  // an accent arrow from the table down to the frame bits of the physical address
              kids.push(s('path', { d: `M${ox},102 V310`, fill: 'none', style: 'stroke:var(--mem)', 'stroke-width': 2.5, 'marker-end': 'url(#arr-mem)' }));  // a green arrow straight down from the offset bits
              const tx = SM ? ox - 8 : ox + 8, ta = SM ? 'end' : 'start';  // tx and ta: the "offset copied" label goes left of the green arrow on small screens and right of it on wide ones
              kids.push(s('text', { x: tx, y: 214, 'text-anchor': ta, 'font-size': 13.5, 'font-weight': 700, class: 'tx-mem' }, 'offset'));  // first line of the label: "offset"
              kids.push(s('text', { x: tx, y: 231, 'text-anchor': ta, 'font-size': 13.5, 'font-weight': 700, class: 'tx-mem' }, 'copied'));  // second line: "copied"
            }  // ends the arrows for a valid address
            // physical address
            if (SM) kids.push(s('text', { x: 10, y: 404, 'font-size': 14, 'font-weight': 800, class: ok && !valid ? 'tx-bad' : '' }, (valid ? 'physical address = ' + fmtN(phys) : ok ? 'physical address: TRAP' : 'physical address = ?')));  // on small screens, the line under the bits: the physical address, a red "TRAP", or "?"
            else kids.push(s('text', { x: 650, y: 328, 'font-size': 13, class: 's-sub' }, 'physical'));  // on wide screens, "physical" sits to the right of the bits
            rowBits(316, valid ? bin(phys, n) : '', (i) => (i < pb ? 's-accent' : 's-mem'), valid);  // the physical address in binary: frame bits in accent and the copied offset bits in green, or question marks
            if (!SM) kids.push(s('text', { x: 650, y: 350, 'font-size': 17, 'font-weight': 800, class: ok && !valid ? 'tx-bad' : '' }, valid ? '= ' + fmtN(phys) : ok ? 'TRAP' : '= ?'));  // on wide screens, its value under "physical": "= ...", a red "TRAP", or "= ?"
            if (valid) { brace(0, pb - 1, 362, `frame ${fr}`, 'accent'); brace(pb, n - 1, 362, `offset ${fmtN(off)}`, 'mem'); }  // for a valid address, brackets under the frame bits and the offset bits
            svg.replaceChildren(...kids);  // swaps the old drawing for the new one
            facts.innerHTML = `Page size 2<sup>${m}</sup> = <b>${fmtN(ps)} B</b>, so <b>${m}</b> offset bits and <b>${pb}</b> page bits (up to ${fmtN(2 ** pb)} pages). ` +  // facts, part 1: the page size and how many offset and page-number bits that gives
              `This process has <b>${LEN} pages</b>: valid addresses 0 to ${fmtN(LEN * ps - 1)}.`;  // part 2: the process has 6 pages, so only addresses up to 6 × page size − 1 are valid
            if (!ok) narrate(narr, `<b>Type a whole number from 0 to ${fmtN(2 ** n - 1)}</b>, the range of a ${n}-bit address.`, 'warn');  // bad input: an amber prompt to type a whole number in the range an n-bit address can hold
            else if (!valid) narrate(narr, `<b class="c-bad">Trap!</b> ${fmtN(addr)} is on page ${pg}, but the page table has only ${LEN} entries (pages 0 to ${LEN - 1}). The hardware compares the page number with the table’s length <b>before</b> it looks anything up, finds ${pg} ≥ ${LEN}, and raises an <span class="t">interrupt</span> instead of touching memory. The OS then normally ends the process. This check is what keeps a process out of frames that belong to others.`, 'bad');  // trap: red narration explaining the length check, the interrupt and why it protects other processes' frames
            else narrate(narr, `<b class="c-ok">${fmtN(addr)}</b> = page <b>${pg}</b> (bits <span class="mono">${bin(pg, pb)}</span>), offset <b>${fmtN(off)}</b>. Page ${pg} &lt; ${LEN}, so the entry exists: <b>frame ${fr}</b>. Physical address = <span class="mono">${bin(fr, pb)}</span> followed by the offset bits = <b>${fmtN(phys)}</b>, which is ${fr} × ${fmtN(ps)} + ${fmtN(off)}.`, 'ok');  // success: green narration with the split, the lookup and the physical address in binary and decimal
          }  // ends draw
          function setAddr(v) { addr = v; inp.value = Number.isInteger(v) ? String(v) : inp.value; draw(); }  // setAddr(v): stores a new address, writes it into the box (a non-number leaves the typed text alone) and redraws
          const rng = () => ctx.util.seeded(97 * tick++)();  // rng(): one random number from 0 to 1, seeded freshly each time (tick goes up) so button presses give new picks
          const slN = ctx.ui.slider({ label: 'Address bits', min: 8, max: 16, value: n, onInput: (v) => { n = v; const mx = n - 3; slM.input.max = mx; if (m > mx) { m = mx; slM.set(m); } makeTable(); if (!(addr < 2 ** n)) addr = Math.floor(rng() * LEN * 2 ** m); setAddr(addr); } });  // address-width slider (8 to 16 bits); it keeps at least 3 page-number bits by capping the page size, rebuilds the table, and re-picks an address that no longer fits
          const slM = ctx.ui.slider({ label: 'Page size', min: 4, max: n - 3, value: m, format: (v) => fmtN(2 ** v) + ' B', onInput: (v) => { m = v; makeTable(); setAddr(addr); } });  // page-size slider in powers of two, 2^4 = 16 bytes up to 2^(n-3); it shows the size in bytes, rebuilds the table and keeps the address
          inp.addEventListener('input', () => { const t = inp.value.trim(); addr = /^\d+$/.test(t) ? parseInt(t, 10) : NaN; draw(); });  // reads the box on every keystroke; only digits count, anything else makes the address "not a number" so the picture shows "?"
          inp.addEventListener('keydown', (e) => e.stopPropagation());  // stops key presses in the box from reaching the guide's keyboard shortcuts, such as the arrows that change steps
          const bValid = h('button', { class: 'btn sm', onclick: () => setAddr(Math.floor(rng() * LEN * 2 ** m)) }, 'Random valid address');  // button that picks a random address inside the process's 6 pages
          const bPast = h('button', { class: 'btn sm', onclick: () => { const top = Math.min(2 ** (n - m), LEN + 4); const p = LEN + Math.floor(rng() * (top - LEN)); setAddr(p * 2 ** m + Math.floor(rng() * 2 ** m)); } }, 'Address past the end');  // button that picks a random address on a page just past the end of the table, to show the trap
          makeTable(); setAddr(addr);  // builds the first page table and draws the starting address, 1,000
          el.append(h('div', { class: 'split l3 fill' },  // puts the step on screen: two columns, the left one taking one third
            h('div', { class: 'stack', style: { gap: '10px' } },  // left column: the controls and suggestions
              h('div', { class: 'card stack', style: { gap: '8px', padding: '10px 12px', flex: 'none' } }, slN, slM,  // a card with the address-width slider and the page-size slider
                h('div', { class: 'row', style: { gap: '8px' } }, h('label', { class: 'small b' }, 'Logical address:'), inp),  // the "Logical address:" label and its typing box
                h('div', { class: 'row', style: { gap: '6px' } }, bValid, bPast)),  // the two address buttons side by side
              facts,  // the line of facts about the current page size and valid range
              h('div', { class: 'card tight small', style: { lineHeight: '1.45' } }, h('div', { class: 'b' }, 'Try this'),  // a "Try this" card with a bold heading
                h('ol', { class: 'm0', style: { paddingLeft: '20px' }, html: '<li>Address 0, then the last byte of page 5.</li><li>The first byte past the end of the process.</li><li>Keep the address, change the page size: the bits stay, the split moves.</li>' })),  // three suggested experiments as a numbered list, including keeping the address while the page size changes
              h('div', { class: 'callout tip m0 small', 'data-label': 'Notice', html: 'The check is on the page number only. A byte in the unused end of the last page passes it: protection works in whole pages.' })),  // green "Notice" box: the check covers whole pages, so the unused end of the last page still passes
            h('div', { class: 'stack', style: { gap: '8px' } },  // right column: the drawing and narration
              h('div', { class: 'card white', style: { padding: '6px 8px' } }, svg), narr)));  // a white card holding the drawing, then the narration card; the brackets close the layout and append
        },  // ends render() for step 6
      },  // ends step 6
      /* ---------------- 7. You are the MMU: translate or spot the trap ---------------- */
      {  // step 7 starts here
        title: 'You are the MMU: translate it, or spot the trap',  // step 7 title; the MMU is the memory management unit, the hardware that translates addresses
        kind: 'predict',  // kind "predict": the student works out the answer first, then checks it
        render(el, ctx) {  // render(el, ctx): draws step 7 into el
          const { h } = ctx;  // this step builds only HTML, so it takes just h from the toolbox
          const LEN = 5;  // LEN: every process in this exercise has 5 pages, so its page table has 5 entries
          let k = 0, P, tried = 0, solved = 0, checked = false, trapOn = false;  // k: which problem; P: the current problem; tried and solved: the score; checked: already marked once; trapOn: the trap button is pressed
          function makeProblem(i) {  // makeProblem(i): builds problem i; the same i always gives the same problem
            if (i === 0) return { ps: 512, table: [7, 19, 4, 26, 11], addr: 1300 };  // problem 0 is fixed: the worked example also used in the notes (512-byte pages, address 1,300)
            const rng = ctx.util.seeded(i * 7919 + 13), ps = [256, 512, 1024][Math.floor(rng() * 3)];  // rng: a generator seeded by the problem number; ps: a page size of 256, 512 or 1,024 bytes
            const pool = Array.from({ length: 32 }, (_, f) => f), table = [];  // pool: the frame numbers 0 to 31 to choose from; table: the page table being built
            for (let r = 0; r < LEN; r++) table.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);  // picks 5 different frames at random
            derange(table);  // makes sure no page sits in the frame with its own number
            const trap = i % 3 === 2, page = trap ? LEN + Math.floor(rng() * 3) : Math.floor(rng() * LEN);  // every third problem (2, 5, 8, ...) traps, using a page 5 to 7; the others use a real page 0 to 4
            return { ps, table, addr: page * ps + Math.floor(rng() * ps) };  // the address: the chosen page times the page size, plus a random offset within the page
          }  // ends makeProblem
          const solve = (p) => { const pg = Math.floor(p.addr / p.ps), off = p.addr % p.ps, trap = pg >= LEN; return { pg, off, trap, fr: trap ? null : p.table[pg], phys: trap ? null : p.table[pg] * p.ps + off }; };  // solve(p): the right answers for problem p: page number, offset, whether it traps, and otherwise the frame and physical address
          const field = (label) => {  // field(label): builds one answer box with its label and a space for a tick or cross
            const i = h('input', { type: 'text', inputmode: 'numeric', 'aria-label': label, class: 'mono', style: { width: '120px', font: 'inherit', fontSize: '16px', padding: '4px 8px', borderRadius: '8px', border: '1px solid var(--line-2)', background: 'var(--panel)', color: 'var(--ink)' } });  // the box itself, in the fixed-width typeface; inputmode numeric brings up a number keypad on phones
            i.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') check(); });  // keys typed here do not reach the guide's shortcuts, and Enter checks the answers
            const mark = h('span', { class: 'b', style: { minWidth: '18px' } });  // mark: where the tick or cross appears after checking
            return { i, mark, row: h('div', { class: 'row nw', style: { gap: '8px' } }, h('label', { class: 'small b', style: { width: '140px' } }, label), i, mark) };  // returns the box, the mark and a row holding label, box and mark that never wraps
          };  // ends field
          const fPg = field('Page number'), fOff = field('Offset'), fPhys = field('Physical address');  // the three answer boxes: page number, offset and physical address
          const bTrap = h('button', { class: 'btn sm', 'aria-pressed': 'false', onclick: () => { trapOn = !trapOn; bTrap.classList.toggle('on', trapOn); bTrap.setAttribute('aria-pressed', String(trapOn)); [fPg, fOff, fPhys].forEach((f) => { f.i.disabled = trapOn; }); } }, '✗ It traps: no such page');  // the "It traps" button switches on and off; while on it is highlighted and the three boxes are greyed out
          const problem = h('div', { class: 'stack', style: { gap: '8px' } });  // problem: the area that shows the address, page size and page table
          const hintBody = h('div', { class: 'small mono' });  // hintBody: the content of the binary hint, hidden until the student opens it
          const narr = h('div', { class: 'card tight small narr', style: { minHeight: '96px', flex: 'none', lineHeight: '1.45' } });  // narr: the narration card for feedback
          const score = h('span', { class: 'chip accent' });  // score: a tag showing how many problems were right first time
          function show() {  // show(): sets up problem k on screen
            P = makeProblem(k); checked = false; trapOn = false;  // builds the problem and clears the checked and trap flags
            bTrap.classList.remove('on'); bTrap.setAttribute('aria-pressed', 'false');  // releases the trap button
            [fPg, fOff, fPhys].forEach((f) => { f.i.value = ''; f.i.disabled = false; f.mark.textContent = ''; });  // empties, re-enables and unmarks the three boxes
            const m = Math.log2(P.ps), w = m + 3, bits = bin(P.addr, w);  // m: offset bits (log2 gives the power of two); w: bits shown in the hint, 3 more than the offset; bits: the address in binary
            problem.replaceChildren(  // replaces the problem area with:
              h('div', { class: 'row', style: { gap: '10px', alignItems: 'baseline' } }, h('span', { class: 'small b' }, 'Logical address'), h('span', { class: 'mono b', style: { fontSize: '30px', color: 'var(--accent)' } }, fmtN(P.addr))),  // the logical address in large accent-coloured digits
              h('div', { class: 'small' }, 'Page size ', h('b', {}, fmtN(P.ps) + ' bytes'), ' (2', h('sup', {}, String(m)), `). This process has ${LEN} pages.`),  // the page size with its power of two, and the reminder that the process has 5 pages
              h('table', { class: 'tbl compact', style: { width: 'auto' } },  // the page table as a small two-row table
                h('tr', {}, h('th', {}, 'Page'), ...P.table.map((_, r) => h('th', { style: { textAlign: 'center' } }, String(r)))),  // top row: "Page" and the page numbers 0 to 4
                h('tr', {}, h('td', { class: 'b' }, 'Frame'), ...P.table.map((f) => h('td', { class: 'mono b', style: { textAlign: 'center', minWidth: '44px' } }, String(f))))));  // bottom row: "Frame" and the frame number of each page
            hintBody.innerHTML = `${fmtN(P.addr)} in ${w} bits: <span class="c-warn b">${bits.slice(0, 3)}</span> <span class="c-mem b">${bits.slice(3)}</span><br><span class="xs muted">The lowest ${m} bits are the offset; the bits to their left are the page number.</span>`;  // the hint: the address in binary with the top 3 bits amber (page number) and the rest green (offset)
            narrate(narr, 'Work it out on paper, then fill in all three boxes, or press <b>It traps</b> if the page does not exist. Then press <b>Check</b>.', '');  // starting instruction in the narration card
            score.textContent = `${solved} of ${tried} right first time`;  // shows the current score
          }  // ends show
          function check() {  // check(): runs on Check or Enter and marks the answers
            const a = solve(P), num = (f) => (/^\d+$/.test(f.i.value.trim()) ? parseInt(f.i.value.trim(), 10) : NaN);  // a: the right answers; num(f): what a box holds as a whole number, or "not a number" if it is not plain digits
            const work = `${fmtN(P.addr)} ÷ ${fmtN(P.ps)} = ${a.pg} remainder ${fmtN(a.off)}, so page ${a.pg}, offset ${fmtN(a.off)}. `;  // work: the division written out, used in every feedback message
            if (!trapOn && !checked && [fPg, fOff, fPhys].every((f) => !f.i.value.trim())) {  // nothing entered and the trap button not pressed:
              narrate(narr, 'Nothing to check yet. Fill in the three boxes, or press <b>It traps</b> if you think the page does not exist.', 'warn');  // amber reminder to fill the boxes or press the trap button
              return;  // stops without marking or scoring
            }  // ends the empty-answer case
            let right;  // right: whether this answer counts as correct
            if (a.trap) {  // the address really traps:
              right = trapOn;  // right only if the student pressed the trap button
              [fPg, fOff, fPhys].forEach((f) => { f.mark.textContent = ''; });  // no ticks or crosses, since there are no numbers to mark
              narrate(narr, (right ? '<b class="c-ok">Right: it traps.</b> ' : '<b class="c-bad">Not quite: this one traps.</b> ') + work +  // feedback headline, then the division
                `The page table has only ${LEN} entries (pages 0 to ${LEN - 1}), and ${a.pg} ≥ ${LEN}, so the hardware raises an interrupt before any memory is touched. There is no physical address.`, right ? 'ok' : 'bad');  // explains why it traps: the page number is not smaller than the table length, so there is no physical address
            } else if (trapOn) {  // the student said it traps, but it does not:
              right = false;  // counted as wrong
              narrate(narr, `<b class="c-bad">No trap here.</b> ${work}Page ${a.pg} &lt; ${LEN}, so entry ${a.pg} exists: frame ${a.fr}. Physical = ${a.fr} × ${fmtN(P.ps)} + ${fmtN(a.off)} = <b>${fmtN(a.phys)}</b>.`, 'bad');  // red feedback with the full right answer
            } else {  // otherwise the student typed numbers:
              const ok = [num(fPg) === a.pg, num(fOff) === a.off, num(fPhys) === a.phys];  // ok: whether each of the three answers is right
              [fPg, fOff, fPhys].forEach((f, i) => { f.mark.textContent = ok[i] ? '✓' : '✗'; f.mark.className = 'b ' + (ok[i] ? 'c-ok' : 'c-bad'); });  // puts a green tick or a red cross next to each box
              right = ok.every(Boolean);  // right only if all three are
              narrate(narr, (right ? '<b class="c-ok">All three right.</b> ' : `<b class="c-bad">${ok.filter(Boolean).length} of 3 right.</b> `) + work +  // feedback headline with how many are right, then the division
                `Entry ${a.pg} of the page table holds frame ${a.fr}, so physical = ${a.fr} × ${fmtN(P.ps)} + ${fmtN(a.off)} = <b>${fmtN(a.phys)}</b>.` +  // the lookup and the physical address worked out in full
                (ok[2] || !ok[0] ? '' : ' Check the last step: the frame number replaces the page number; it is not added to the address.'), right ? 'ok' : 'bad');  // if the page number is right but the physical address is not, a reminder that the frame replaces the page number
            }  // ends the marking cases
            if (!checked) { tried++; if (right) solved++; checked = true; }  // only the first check of each problem counts toward the score
            score.textContent = `${solved} of ${tried} right first time`;  // shows the updated score
          }  // ends check
          show();  // shows the first problem
          el.append(h('div', { class: 'split fill' },  // puts the step on screen: two columns of equal width
            h('div', { class: 'stack' },  // left column: the problem
              h('p', { class: 'm0', html: 'Now you do the hardware’s job, in decimal. For each address: find the page number and offset (divide by the page size), check the page number against the table’s length, then build the physical address (frame × page size + offset).' }),  // instructions: the decimal recipe for doing the hardware's job by hand
              h('div', { class: 'card white', style: { flex: 'none' } }, problem),  // a white card holding the problem
              ctx.ui.reveal('Hint: show the address in binary', hintBody),  // a button that reveals the binary hint
              h('div', { class: 'callout warn m0 small', 'data-label': 'Spot the error', html: 'A page number equal to the table’s length is already too big: a table of 5 entries holds pages 0 to 4.' })),  // amber "Spot the error" box: a page number equal to the table length is already one too many; brackets close the left column
            h('div', { class: 'stack' },  // right column: the answers and feedback
              h('div', { class: 'card stack', style: { gap: '8px', flex: 'none' } }, fPg.row, fOff.row, fPhys.row,  // a card with the three answer rows
                h('div', { class: 'row', style: { gap: '8px' } }, bTrap),  // a row holding the "It traps" button
                h('div', { class: 'row', style: { gap: '8px' } },  // a row with the main buttons and the score:
                  h('button', { class: 'btn primary', onclick: check }, 'Check'),  // Check marks the answers
                  h('button', { class: 'btn', onclick: () => { k++; show(); } }, 'New address'), score)),  // New address moves to the next problem; the score tag sits at the end of the row
              narr,  // the feedback card
              h('div', { class: 'card tight small', style: { lineHeight: '1.5' } }, h('div', { class: 'b' }, 'The recipe'),  // a "The recipe" card with a bold heading
                h('ol', { class: 'm0', style: { paddingLeft: '20px' }, html: '<li>page = address ÷ page size (whole part); offset = the remainder.</li><li>If page ≥ the number of table entries: <b class="c-bad">trap</b>.</li><li>physical = frame[page] × page size + offset.</li>' })))));  // the three-step decimal recipe as a numbered list: divide, check the length, then frame × page size + offset
        },  // ends render() for step 7
      },  // ends step 7
      /* ---------------- 8. Compare: dynamic partitioning vs paging on one workload ---------------- */
      {  // step 8 starts here
        title: 'Race: dynamic partitioning vs paging',  // step 8 title
        kind: 'compare',  // kind "compare": a page that sets schemes side by side
        render(el, ctx) {  // render(el, ctx): draws step 8 into el
          const { h, s } = ctx;  // takes the HTML builder h and the SVG builder s out of the toolbox
          const SM = ctx.narrow, X0 = 10, W = SM ? 340 : 1080, sc = W / MEM;  // SM: the phone-width layout flag; X0: left margin; W: drawn width of each 16 KB memory bar; sc: drawing units per byte
          function workloadTab(panel) {  // workloadTab(panel): builds the first tab, the animated race; the tabs widget calls it when that tab opens
            let ps = KB;  // ps: the page size on the paging side, starting at 1 KB
            const svg = s('svg', { viewBox: SM ? '0 0 360 170' : '0 0 1100 170', width: '100%' });  // the drawing area for the two memory bars, much wider on wide screens
            const meters = h('div', { class: 'grid-2', style: { gap: '10px' } });  // meters: two cards side by side with the bar meters for each scheme
            const meterRow = (label, val, col) => h('div', { style: { display: 'grid', gridTemplateColumns: SM ? '132px 1fr 66px' : '190px 1fr 74px', alignItems: 'center', gap: '8px' } },  // meterRow(label, val, col): one meter line: a label, a bar filled in proportion to val out of 16 KB, and the byte count
              h('span', { class: 'xs b' }, label),  // the label in small bold type
              h('div', { class: 'meter', style: { height: '10px' } }, h('i', { style: { width: (100 * val) / MEM + '%', background: `var(--${col})` } })),  // the meter track; its inner bar is stretched to val's share of memory, in colour col
              h('span', { class: 'mono xs b', style: { textAlign: 'right' } }, fmtN(val) + ' B'));  // the byte count, right-aligned in the fixed-width typeface
            function draw(i) {  // draw(i): draws the race after event i; the player calls it, and what it returns becomes the caption
              const R = runWorkload(ps, i), D = R.st.dyn, P = R.st.pag, kids = [];  // R: the race replayed up to event i; D and P: what happened on each side; kids collects the shapes
              // dynamic partitioning bar
              kids.push(s('text', { x: X0, y: 16, 'font-size': 14, 'font-weight': 800 }, SM ? 'Dynamic partitioning (first-fit)' : 'Dynamic partitioning (first-fit), one block per process'));  // heading over the top bar, shorter on small screens
              if (D.waiting.length) kids.push(s('text', { x: X0 + W, y: 16, 'text-anchor': 'end', 'font-size': 14, 'font-weight': 800, class: 'tx-bad' }, 'waiting: ' + D.waiting.join(', ')));  // if any process is waiting under partitioning, a red "waiting:" list at the right end
              kids.push(s('rect', { x: X0, y: 24, width: W, height: 50, rx: 6, class: 's-panel', 'stroke-dasharray': '5 4' }));  // a dashed grey outline for the whole 16 KB
              R.dyn.parts.forEach((q) => {  // one coloured block for each process in memory:
                const x = X0 + q.start * sc, w = q.size * sc;  // x and w: where the block starts and how wide it is, scaled from bytes
                kids.push(s('rect', { x, y: 24, width: w, height: 50, rx: 4, class: 's-' + PROC[q.p].col, 'stroke-width': 1.5 }));  // the block in the process's colour
                kids.push(s('text', { x: x + w / 2, y: 54, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800 }, w > 110 ? `${q.p}  ${fmtN(q.size)} B` : q.p));  // its label: the letter and size when the block is wide enough, otherwise just the letter
              });  // ends the blocks
              D.holes.forEach((hl) => { const w = hl.size * sc; if (w > 90) kids.push(s('text', { x: X0 + hl.start * sc + w / 2, y: 54, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, class: 'tx-warn' }, `hole ${fmtN(hl.size)}`)); });  // an amber "hole N" label inside each hole wide enough to hold the text
              // paging bar
              kids.push(s('text', { x: X0, y: 104, 'font-size': 14, 'font-weight': 800 }, SM ? `Paging, ${fmtN(ps)} B pages` : `Paging, ${fmtN(ps)}-byte pages (${MEM / ps} frames)`));  // heading over the bottom bar with the page size (and, on wide screens, the number of frames)
              if (P.waiting.length) kids.push(s('text', { x: X0 + W, y: 104, 'text-anchor': 'end', 'font-size': 14, 'font-weight': 800, class: 'tx-bad' }, 'waiting: ' + P.waiting.join(', ')));  // if any process is waiting under paging, a red "waiting:" list at the right end
              const fw = ps * sc;  // fw: the drawn width of one frame
              R.pag.frames.forEach((c, f) => {  // one box per frame:
                const x = X0 + f * fw;  // x: where frame f starts
                kids.push(s('rect', { x, y: 112, width: fw, height: 50, class: c ? 's-' + PROC[c.p].col : 's-panel', 'stroke-width': 1, 'stroke-dasharray': c ? null : '4 3' }));  // the frame in its owner's colour, or a dashed grey outline if free
                if (c) {  // for an occupied frame:
                  const n = pagesFor(PROC[c.p].size, ps), waste = wasteFor(PROC[c.p].size, ps);  // n and waste: how many pages its owner needs and how many bytes of the last one go unused
                  if (c.pg === n - 1 && waste) kids.push(s('rect', { x: x + fw - waste * sc, y: 113, width: waste * sc - 1, height: 48, class: 's-warn', 'stroke-width': 0 }));  // in the owner's last page, an amber strip at the right end shows the unused bytes
                  if (fw >= 26) kids.push(s('text', { x: x + fw / 2, y: 142, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 }, c.p + c.pg));  // a label such as A0 when frames are drawn wide enough to fit it
                }  // ends the occupied case
              });  // ends the frames
              svg.replaceChildren(...kids);  // swaps the old drawing for the new one
              meters.replaceChildren(  // rebuilds the two meter cards:
                h('div', { class: 'card tight stack', style: { gap: '5px' } },  // the partitioning card
                  h('div', { class: 'small b' }, `Partitioning: ${fmtN(D.free)} B free in ${D.holes.length} hole${D.holes.length === 1 ? '' : 's'}`),  // its heading: total free bytes and how many holes they are split into
                  meterRow('Free outside the largest hole', D.free - D.largest, 'warn'), meterRow('Internal fragmentation', 0, 'warn'), meterRow('Copied by compaction', D.copied, 'bad')),  // its meters: free bytes outside the largest hole, no internal fragmentation, and bytes copied by compaction so far
                h('div', { class: 'card tight stack', style: { gap: '5px' } },  // the paging card
                  h('div', { class: 'small b' }, R.pag.free.length ? `Paging: ${fmtN(P.free)} B free in ${R.pag.free.length} frame${R.pag.free.length === 1 ? '' : 's'}, all usable` : 'Paging: no free frames left'),  // its heading: free bytes and frames, all usable, or a note that no frames are free
                  meterRow('Free but unusable', 0, 'warn'), meterRow('Internal fragmentation', P.waste, 'warn'), meterRow('Copied by compaction', 0, 'bad')));  // its meters: nothing unusable, the internal fragmentation in last pages, and nothing ever copied
              return caption(i, R);  // returns the caption for event i
            }  // ends draw
            function caption(i, R) {  // caption(i, R): the text explaining event i for both schemes
              const e = WORKLOAD[i], D = R.st.dyn, P = R.st.pag;  // e: the event; D and P: what happened on each side
              if (i === 0) return `<b>${e.t}.</b> Above, each process gets one block of exactly its size, in the first hole big enough. Below, it gets ${fmtN(ps)}-byte frames wherever they are free. Press Play or step through.`;  // event 0: an introduction to the two bars and how to step through
              let d = '', p = '';  // d and p will hold the partitioning part and the paging part
              if (e.load) {  // an arrival:
                d = D.last === 'loaded' ? `${e.load} gets bytes ${fmtN(D.res.start)}–${fmtN(D.res.start + PROC[e.load].size - 1)}.` : `<b class="c-bad">${e.load} does not fit:</b> ${fmtN(D.res.free)} B are free, but the largest hole is only ${fmtN(D.res.largest)} B.`;  // partitioning: the byte range it got, or a red "does not fit" with the free total and the largest hole
                p = P.last === 'loaded' ? `${e.load} takes ${P.res.need} frames (${listOf(P.res.frames)}), ${fmtN(wasteFor(PROC[e.load].size, ps))} B unused in its last page.` : `<b class="c-bad">${e.load} must wait:</b> it needs ${P.res.need} frame${P.res.need === 1 ? '' : 's'} and ${P.res.free ? 'only ' + P.res.free : 'none'} ${P.res.free === 1 ? 'is' : 'are'} free. The unused ends of last pages now add up to ${fmtN(P.waste)} B.`;  // paging: the frames it took and its waste, or a red "must wait" with the frames needed and free
              } else if (e.remove) {  // a swap-out:
                d = `${e.remove}’s block becomes a hole; free memory is now ${D.holes.length} separate pieces (${D.holes.map((x) => fmtN(x.size)).join(' and ')} B).`;  // partitioning: the block becomes a hole, and the free memory is now in separate pieces
                p = `${e.remove}’s ${pagesFor(PROC[e.remove].size, ps)} frames simply rejoin the free-frame list.`;  // paging: its frames simply go back on the free-frame list
              } else if (e.retry) {  // the retry:
                d = D.last === 'compacted' ? `The OS must <b>compact</b> memory: it copies ${fmtN(D.moved)} bytes to slide the blocks together, then ${D.retryOk.length ? 'loads ' + listOf(D.retryOk) : 'still cannot load ' + listOf(D.retried)}.` : 'Nothing is waiting.';  // partitioning: compaction copies bytes before anything waiting can load (or nothing was waiting)
                p = P.last === 'retried' ? `${P.retryOk.length ? 'Loads ' + listOf(P.retryOk) : 'Still cannot load ' + listOf(P.retried)}, with no copying.` : 'Nothing is waiting, so there is nothing to do.';  // paging: waiting processes load with no copying (or nothing was waiting)
              }  // ends the event cases
              let out = `<b>${e.t}.</b> <b>Partitioning:</b> ${d} <b>Paging:</b> ${p}`;  // out: the event text, then the two parts with bold headings
              if (i === WORKLOAD.length - 1) out += ` <b>Final score:</b> partitioning copied ${fmtN(D.copied)} B; paging copied none but wastes ${fmtN(P.waste)} B in last pages${P.waiting.length ? ', and ' + listOf(P.waiting) + ' is still waiting' : ''}.`;  // after the last event, a final score: bytes copied by partitioning against bytes wasted (and anyone still waiting) under paging
              return out;  // returns the caption
            }  // ends caption
            const player = ctx.ui.player({ count: WORKLOAD.length, render: draw, interval: 2800 });  // the player for the 8 events; Play moves on every 2.8 seconds
            const seg = ctx.ui.seg([512, 1024, 2048].map((v) => ({ value: v, label: fmtN(v) + ' B' })), ps, (v) => { ps = v; player.refresh(); });  // page-size switch for the paging side (512, 1,024 or 2,048 bytes); a change redraws the current event from scratch
            panel.append(h('div', { class: 'stack', style: { gap: '8px', height: '100%' } },  // fills the tab panel with a full-height stack:
              h('div', { class: 'row', style: { gap: '8px' } }, h('span', { class: 'small b' }, 'Page size for the paging side:'), seg,  // a row with the page-size label and switch
                h('span', { class: 'xs muted' }, 'Amber = memory wasted inside an allocation.')),  // and a grey note explaining that amber means memory wasted inside an allocation
              h('div', { class: 'card white', style: { padding: '6px 8px' } }, svg), meters, player.el));  // the white drawing card, the meter cards and the player
            return () => player.stop();  // returns a tidy-up function that stops playback when another tab is chosen or the step closes
          }  // ends workloadTab
          const ROWS = [  // ROWS: the rows of the comparison table, each [feature, fixed partitioning, dynamic partitioning, paging]
            ['Unit handed out', 'One whole partition, sizes fixed at start-up', 'One block, exactly the process’s size', 'Many equal frames'],  // row: what each scheme hands out
            ['Must a process be contiguous?', 'Yes', 'Yes', '<b class="c-ok">No</b>'],  // row: whether a process must sit in one unbroken block
            ['Internal fragmentation', '<b class="c-bad">Yes:</b> the rest of the partition', 'None', '<b class="c-warn">Small:</b> part of the last page'],  // row: internal fragmentation in each scheme
            ['External fragmentation', 'None (boundaries never move)', '<b class="c-bad">Yes:</b> holes multiply over time', '<b class="c-ok">None</b>'],  // row: external fragmentation in each scheme
            ['Compaction', 'Never', 'Needed from time to time', '<b class="c-ok">Never</b>'],  // row: how often compaction is needed
            ['Hardware per access', 'Usually base register + bounds check', 'Base register + bounds check', 'Page-table lookup + length check'],  // row: what the hardware does on each access
            ['OS bookkeeping', 'A table of partitions', 'A list of holes', 'A page table per process + a free-frame list'],  // row: what the OS has to keep track of
          ];  // closes ROWS
          const tableTab = (panel) => panel.append(h('div', { class: 'stack', style: { gap: '10px' } },  // tableTab(panel): builds the second tab, the side-by-side table and three notes
            h('table', { class: 'tbl', html: '<tr><th></th><th>Fixed partitioning</th><th>Dynamic partitioning</th><th>Paging</th></tr>' + ROWS.map((r) => `<tr><td class="b">${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td></tr>`).join('') }),  // the table: a header row with the three scheme names, then one row built from each entry of ROWS
            h('div', { class: 'grid-3', style: { gap: '10px' } },  // three notes side by side:
              h('div', { class: 'callout analogy m0 small', 'data-label': 'One way to see it', html: 'Paging is fixed partitioning with very small, equal partitions, where one process may hold several of them and they need not be next to each other.' }),  // purple analogy box: paging is fixed partitioning with tiny equal partitions that one process may hold several of
              h('div', { class: 'callout why m0 small', 'data-label': 'Invisible to the programmer', html: 'Programs and compilers still see one continuous range of relative addresses starting at 0. Only the OS and the processor know about frames, so paging is <b>transparent</b>.' }),  // blue box: paging is invisible to programmers, who still see one range of relative addresses from 0
              h('div', { class: 'callout tip m0 small', 'data-label': 'Simple for hardware', html: 'Translation is one table lookup plus wiring the frame bits in front of the offset bits. The length check happens alongside it.' }))));  // green box: translation is one lookup plus wiring; the brackets close the notes row, the stack and tableTab
          el.append(h('div', { class: 'fill' }, ctx.ui.tabs([  // puts the step on screen: a full-height box holding the guide's tabs widget with two tabs
            { label: 'Same workload, two schemes', render: workloadTab },  // tab 1: the animated race, drawn by workloadTab
            { label: 'Side by side: three schemes', render: tableTab },  // tab 2: the comparison table and notes, drawn by tableTab
          ])));  // closes the tab list, the box and append
        },  // ends render() for step 8
      },  // ends step 8
      /* ---------------- 9. Recap ---------------- */
      {  // step 9 starts here
        title: 'Recap: eight ideas to carry away',  // step 9 title
        kind: 'recap',  // kind "recap": the summary page near the end of the section
        render(el, ctx) {  // render(el, ctx): draws step 9 into el
          const { h } = ctx;  // this step builds only HTML, so it takes just h from the toolbox
          // the worked example on card 5 is computed, not typed
          const A = 3000, PS = 1024, pg = Math.floor(A / PS), off = A % PS, fr = 9;  // A: the example address 3,000; PS: 1,024-byte pages; pg and off: its page (2) and offset (952); fr: frame 9, as in step 5
          const flipAll = (on) => ctx.$$('.flip').forEach((c) => c.classList.toggle('on', on));  // flipAll(on): turns every card on this step face up (true) or face down (false); ctx.$$ finds all the cards
          el.append(h('div', { class: 'stack fill', style: { gap: '12px' } },  // puts the step on screen: a full-height stack
            h('div', { class: 'row', style: { gap: '8px' } }, h('p', { class: 'm0 muted small grow' }, 'Say each answer out loud before you flip the card. Click a card again to flip it back.'),  // a row with a grey instruction to answer out loud before flipping; grow lets it take the spare width
              h('button', { class: 'btn sm', onclick: () => flipAll(true) }, 'Flip all'), h('button', { class: 'btn sm ghost', onclick: () => flipAll(false) }, 'Hide all')),  // a Flip all button and a quieter Hide all button
            ctx.ui.flipcards([  // the flip cards: each pair is [front: the idea, back: the explanation]
              ['Frames and pages', 'Memory is cut into equal <b>frames</b>, each process into <b>pages</b> of the same size. Any page fits any free frame, so a process need not be contiguous.'],  // card 1: frames and pages, and why a process need not be contiguous
              ['The two records the OS keeps', 'A <b>page table</b> per process (entry i = the frame holding page i) and one <b>free-frame list</b> for the whole machine.'],  // card 2: the page table per process and the single free-frame list
              ['What translation does', 'A logical address is (page number, offset). Translation turns it into (frame number, offset); the offset never changes.'],  // card 3: translation keeps the offset and swaps page number for frame number
              ['Why powers of two', 'With 2<sup>m</sup>-byte pages the low m bits are the offset and the rest the page number. Physical = frame bits then offset bits = frame × 2<sup>m</sup> + offset.'],  // card 4: why powers of two make the split a matter of bits
              ['A worked example', `16-bit addresses, 1 KB pages: ${fmtN(A)} = page ${pg}, offset ${off}. If page ${pg} is in frame ${fr}: ${fr} × 1,024 + ${off} = <b>${fmtN(fr * PS + off)}</b>.`],  // card 5: the worked example, with its numbers computed from A, PS and fr above
              ['Fragmentation', 'No external fragmentation and never any compaction. Internal fragmentation only in each process’s last page: under one page, about half a page on average.'],  // card 6: no external fragmentation, little internal fragmentation
              ['Protection', 'The hardware checks the page number against the page-table length first. A page number that is too big traps before memory is touched.'],  // card 7: protection by the page-table length check
              ['Why it is a good design', 'Invisible to programmers, cheap for hardware, and like fixed partitioning with tiny partitions that one process may hold several of, scattered anywhere.'],  // card 8: why paging is a good design
            ], { cols: 4, height: ctx.narrow ? 140 : 184 }),  // 4 cards per row; cards are 140 pixels tall on small screens and 184 on wide ones
            h('div', { class: 'callout tip m0 small', 'data-label': 'Coming in Chapter 8', html: 'Reading a page table on every access would double memory traffic, so processors keep a small cache of recent translations. And once the page table can mark a page as “not in memory”, a process can run with only some of its pages loaded: that is virtual memory.' })));  // green box previewing Chapter 8: caching recent translations and running with only some pages loaded
        },  // ends render() for step 9
      },  // ends step 9
      /* ---------------- 10. Quiz ---------------- */
      {  // step 10 starts here
        title: 'Check yourself: paging',  // step 10 title
        kind: 'check',  // kind "check": the guide builds the quiz page from the list below
        quiz: [  // quiz: the questions, checked by the guide's quiz engine
          { q: 'Under paging, what does entry <i>i</i> of a process’s page table hold?',  // question 1 (multiple choice): what entry i of a page table holds
            choices: ['A copy of the bytes stored in page <i>i</i> of the process', 'The number of bytes the process actually uses in page <i>i</i>', 'The number of the next free frame after page <i>i</i>', 'The number of the frame that currently holds page <i>i</i>'],  // the four choices; only the last is right
            answer: 3,  // answer: the position of the right choice, counting from 0, so 3 is the fourth
            feedback: ['The pages themselves live in frames of main memory; the table only records where.', 'The table does not track how full a page is; it only maps page numbers to frame numbers. Every page is the same size anyway, and only the last one is partly empty.', 'Free frames are tracked separately, in the free-frame list.', null],  // feedback for each choice, explaining why the wrong ones are wrong; null for the right one
            why: 'A page table is a map from page numbers to frame numbers, one entry per page. The hardware indexes it with the page number to find the frame.' },  // why: the explanation shown after the question is answered
          { type: 'num', q: 'Pages are 1,024 bytes. A program uses relative address 5,000. What is the offset part of this address?', answer: 5000 % 1024, tol: 0, unit: 'bytes',  // question 2 (calculate): the offset of address 5,000 with 1,024-byte pages; the answer is computed (904) and tol 0 means exact
            why: '5,000 ÷ 1,024 = 4 remainder 904: the byte is on page 4, 904 bytes from the start of that page. In binary, the offset is simply the lowest 10 bits.' },  // why: the division with remainder, and the offset as the low 10 bits
          { type: 'num', q: 'Pages are 1,024 bytes, and page 4 of a process is held in frame 11. Which physical address does the process’s relative address 5,000 map to?', answer: 11 * 1024 + (5000 % 1024), tol: 0,  // question 3 (calculate): the physical address of 5,000 when page 4 is in frame 11, computed as 12,168
            why: '5,000 is page 4, offset 904. The frame number replaces the page number and the offset is kept: 11 × 1,024 + 904 = 12,168.' },  // why: the frame replaces the page and the offset is kept
          { type: 'num', q: 'A machine uses 20-bit logical addresses and 4,096-byte pages. How many bits of each address form the page number?', answer: 20 - 12, tol: 0, unit: 'bits',  // question 4 (calculate): page-number bits for 20-bit addresses and 4,096-byte pages (8)
            why: '4,096 = 2<sup>12</sup>, so 12 bits are the offset and the remaining 20 − 12 = 8 bits are the page number, allowing up to 2<sup>8</sup> = 256 pages per process.' },  // why: 4,096 = 2^12, so 12 offset bits and 8 page bits
          { type: 'num', q: 'A 9,000-byte process is loaded under paging with 2,048-byte pages. How many bytes of its frames are wasted (internal fragmentation)?', answer: Math.ceil(9000 / 2048) * 2048 - 9000, tol: 0, unit: 'bytes',  // question 5 (calculate): internal fragmentation of a 9,000-byte process in 2,048-byte pages (1,240)
            why: 'It needs ⌈9,000 ÷ 2,048⌉ = 5 pages, so it is given 5 × 2,048 = 10,240 bytes. 10,240 − 9,000 = 1,240 bytes sit unused at the end of the last page.' },  // why: 5 pages give 10,240 bytes, minus the 9,000 used
          { type: 'tf', q: 'A programmer writing a program for a paged system must know the page size and split the program into pages by hand.', answer: false,  // question 6 (true or false): must a programmer split the program into pages by hand? (false)
            why: 'Paging is transparent: the program sees one continuous range of relative addresses starting at 0. The OS splits the process into pages and the hardware translates every address.' },  // why: paging is transparent to the program
          { q: 'A process has a page table with 6 entries and the page size is 512 bytes. The process issues relative address 3,100. What happens?',  // question 7 (multiple choice): what happens when an address lies on page 6 of a 6-entry table
            choices: ['The access goes to frame 6, offset 28, because the page number is used directly as the frame number', 'The hardware raises an interrupt (a trap), because the address lies on page 6 and the table has no entry 6', 'The access goes to the frame in entry 5, offset 540, since entry 5 is the last page the table covers', 'The address is quietly cut down to 3,071, the last valid byte, so the access stays inside the process'],  // choices: frame used directly, a trap, wrapping to the last entry, or quietly clipping the address
            answer: 1,  // the second choice, the trap, is right
            feedback: ['The page number is not used as a frame number; it is an index into the page table, and here the index is out of range.', null, 'An offset can never be 512 or more with 512-byte pages; offsets run from 0 to 511.', 'Hardware never silently changes an address; an invalid page number is an error the OS must handle.'],  // feedback for each wrong choice
            why: '3,100 ÷ 512 = 6 remainder 28, so the byte is on page 6. A table of 6 entries covers pages 0 to 5, so the hardware traps before touching memory, which also stops the process from reaching anyone else’s frames.' },  // why: 3,100 is page 6, which a 6-entry table does not cover, so the hardware traps
          { q: 'Why is the page size always a power of two?',  // question 8 (multiple choice): why the page size is always a power of two
            choices: ['So every process gets a power-of-two number of pages, which lets the OS size each page table exactly', 'So a page can be split evenly into smaller frames, letting its pieces sit in different places in memory', 'So the page number and offset are just the high and low bits of the address, making translation simple bit wiring', 'So that no process ever has internal fragmentation, since every program size divides evenly into pages'],  // choices: page counts, splitting pages, a bit-level split, or no waste
            answer: 2,  // the third choice, the bit-level split, is right
            feedback: ['The number of pages a process needs depends on its size, which can be anything; its page table simply has one entry per page.', 'A page and a frame are always exactly the same size, so a page is never split across frames.', null, 'Program sizes can be anything, so the last page is usually only partly used, whatever the page size.'],  // feedback for each wrong choice
            why: 'With 2<sup>m</sup>-byte pages, dividing by the page size is free: the quotient is the high bits and the remainder the low m bits. The physical address is the frame bits written in front of the offset bits.' },  // why: dividing by a power of two is free in binary
          { type: 'multi', q: 'Which statements about simple paging are true?',  // question 9 (select all that apply): true statements about simple paging
            choices: ['The OS keeps one page table for each process in memory.', 'The OS keeps a list of free frames.', 'The only fragmentation is the unused end of each process’s last page.', 'The pages of one process may sit in frames that are far apart.', 'A process must fit into one free hole of memory.', 'Each page may be a different size, chosen to fit the process.'],  // six statements; the last two describe one-hole placement and pages of different sizes, which simple paging does not use
            answer: [0, 1, 2, 3],  // the first four statements are the true ones
            why: 'Paging uses equal pages, tracks free frames in a list and maps each process’s pages through its own table, so pages can be scattered and only the tail of the last page is wasted. Needing one big hole is the problem of contiguous allocation.' },  // why: equal pages, a free list and per-process tables; needing one big hole belongs to contiguous allocation
          { type: 'order', q: 'Put the steps the hardware follows to translate a logical address under paging in order.',  // question 10 (put in order): the hardware's steps to translate an address
            items: ['Split the logical address into page number and offset', 'Compare the page number with the page-table length', 'Read the frame number from the page-table entry', 'Put the frame number in front of the offset', 'Send the resulting physical address to memory'],  // the five steps, written in the right order (the quiz shuffles them for the student)
            why: 'Split, check, look up, assemble, access. If the check fails, the hardware traps instead of continuing.' },  // why: split, check, look up, assemble, access
          { type: 'match', q: 'Match each paging term to its meaning.',  // question 11 (match the pairs): paging terms with their meanings
            pairs: [['Frame', 'A fixed-size chunk of main memory'], ['Page', 'A same-size chunk of a process'], ['Page table', 'Maps one process’s page numbers to frame numbers'], ['Free-frame list', 'The frames ready to receive pages'], ['Offset', 'Where a byte sits inside its page']],  // five pairs: frame, page, page table, free-frame list and offset
            why: 'Frames are slots in memory, pages are pieces of a process, the page table connects the two, and the free-frame list tells the OS where it can put the next page.' },  // why: how the four records and pieces fit together
          { type: 'bucket', q: 'Sort each statement under the scheme it describes.', buckets: ['Dynamic partitioning', 'Paging'],  // question 12 (sort into groups): statements under dynamic partitioning (0) or paging (1)
            items: [['Needs compaction from time to time', 0], ['Wastes memory only at the end of each process’s last page', 1], ['Each process occupies one contiguous block', 0], ['A process can be spread over scattered frames', 1], ['Free memory can be useless because it is split into small holes', 0], ['Keeps a table per process mapping pieces to locations', 1]],  // six statements, each with the number of its correct group
            why: 'Dynamic partitioning gives each process one exact-size block, so holes appear between blocks and compaction is needed. Paging hands out equal frames anywhere, so nothing is ever too small, at the cost of a page table per process.' },  // why: exact-size blocks leave holes; equal frames never do, at the cost of a page table
        ],  // closes the quiz list
      },  // ends step 10
    ],  // closes the steps list
    notes: `${/* notes: the written summary of the section as HTML, shown in the notes panel (the N key) and when printing */''}
<h3>The idea of paging</h3>${/* notes heading: the idea of paging */''}
<p>Dynamic partitioning gives each process one unbroken (contiguous) block of exactly its size. As processes come and go, free memory ends up in scattered holes, and a process can be refused even though the total free space is enough. <b>Paging</b> avoids this. Main memory is divided into many small, equal, fixed-size chunks called <b>frames</b> (page frames). Each process is divided into chunks of exactly the same size called <b>pages</b>. Any page can be loaded into any free frame, so the pages of one process may be scattered anywhere in memory. In simple paging all pages of a process are in memory while it runs.</p>${/* notes paragraph: holes under dynamic partitioning, and how frames and pages avoid them */''}
<p>Example: 12 frames of 1 KB with 5 KB free in holes of 2, 1 and 2 KB. A 5 KB process cannot get one contiguous block, but under paging its 5 pages simply take the 5 free frames.</p>${/* notes example: a 5 KB process that fits in scattered frames but in no single hole */''}

<h3>Pages, frames and the only fragmentation</h3>${/* notes heading: pages, frames and the only fragmentation */''}
<ul>${/* start of a bulleted list */''}
<li>The <b>page size</b> (= frame size) is set by the processor’s design and is always a power of two; simple paging uses one size for the whole machine. 4 KB (4,096 bytes) is the most common today, some systems use 16 KB, and modern processors can also map a few much larger pages.</li>${/* bullet: the page size is set by the processor and is a power of two, typically 4 KB */''}
<li>A process of S bytes needs <b>⌈S ÷ page size⌉</b> pages. Every page is full except, usually, the last one.</li>${/* bullet: the round-up rule for the number of pages */''}
<li><b>Internal fragmentation</b> = pages × page size − S: only the unused end of the last page: under one page per process, about half a page on average.</li>${/* bullet: internal fragmentation is only the unused end of the last page */''}
<li><b>No external fragmentation:</b> a free frame is never too small, because every page needs exactly one frame. So paging never needs <b>compaction</b>.</li>${/* bullet: no external fragmentation, so never any compaction */''}
</ul>${/* end of the bulleted list */''}
<p>Example: S = 5,300 bytes, 1,024-byte pages: ⌈5.18⌉ = 6 pages, 6 × 1,024 = 6,144 bytes allocated, 844 bytes wasted at the end of page 5. Smaller pages waste less but give each process more pages and a longer page table.</p>${/* notes example: a 5,300-byte process with 1,024-byte pages wastes 844 bytes */''}

<h3>The OS’s records: page tables and the free-frame list</h3>${/* notes heading: page tables and the free-frame list */''}
<p>The OS keeps one <b>page table</b> per process: entry <i>i</i> holds the number of the frame holding page <i>i</i>, so the table has one entry per page. It holds frame <b>numbers</b>, not the pages themselves. The OS also keeps one <b>free-frame list</b> for the whole machine. Loading a process takes frames from the list and fills in its page table; swapping it out returns its frames to the list and discards its table (when it returns it will usually get different frames and a new table).</p>${/* notes paragraph: what a page table holds and how loading and swapping use the free-frame list */''}
<p>Example with 16 frames of 1 KB: A (3,900 B, 4 pages) gets frames 0–3; B (2,600 B, 3 pages) gets 4–6; C (4,500 B, 5 pages) gets 7–11. D (5,900 B, 6 pages) must wait: only 4 frames are free. Swapping B out frees 4, 5, 6; now 7 frames are free and D gets frames 4, 5, 6, 12, 13, 14, not side by side. Internal fragmentation: A 196 + C 620 + D 244 = 1,060 bytes; external fragmentation: none. The only question when loading is how many frames are free, never where they are.</p>${/* notes example: the loader game's suggested sequence, with the frames each process gets and the total waste */''}
<h3>Logical addresses and translation</h3>${/* notes heading: logical addresses and translation */''}
<p>Programs use <b>relative addresses</b> counted from their own byte 0. Under paging the processor reads each as a pair <b>(page number, offset)</b>: which page, and how far into it. <b>Address translation</b> turns (page, offset) into (frame, offset): the frame number replaces the page number, and the offset stays the same because a page is copied into its frame whole. The lookup is done by the processor’s memory management unit on every access; at each process switch the OS loads the address and length of the new process’s page table into processor registers (many modern processors keep no length and mark unused entries invalid instead).</p>${/* notes paragraph: (page, offset) becomes (frame, offset), done by the memory management unit on every access */''}

<h3>Why the page size is a power of two</h3>${/* notes heading: why the page size is a power of two */''}
<p>With n-bit addresses and pages of 2<sup>m</sup> bytes, the rightmost <b>m bits are the offset</b> and the leftmost <b>n − m bits are the page number</b> (so a process can have up to 2<sup>n−m</sup> pages). The physical address is the frame number’s bits written in front of the offset bits, which equals <b>frame × 2<sup>m</sup> + offset</b>. Dividing by the page size costs nothing in binary: quotient and remainder are already the two groups of bits, so translation is pure wiring, with no divider, multiplier or even an adder.</p>${/* notes paragraph: the low m bits are the offset, the rest the page number, so translation is pure wiring */''}
<p><b>Worked example.</b> 16-bit addresses, 1,024-byte pages (m = 10): 6 page bits, 10 offset bits, up to 64 pages. Relative address 3,000 = 000010 1110111000, so page 2, offset 952 (3,000 = 2 × 1,024 + 952). If page 2 is in frame 9 (001001), the physical address is 001001 1110111000 = 10,168 = 9 × 1,024 + 952. With 1,000-byte pages, finding page 3, offset 0 for address 3,000 would need a real division on every access: a power of two is to binary hardware what 1,000 is to us in decimal. A common mistake is to add the frame number to the address; it replaces the page number.</p>${/* notes worked example: address 3,000 translated in binary and decimal, and why 1,000-byte pages would need a divider */''}

<h3>Protection: the page-table length check</h3>${/* notes heading: protection by the page-table length check */''}
<p>Before looking anything up, the hardware compares the page number with the length of the page table. A page number that is too big (equal to or larger than the number of entries) makes the hardware raise an interrupt (a trap) instead of touching memory, and the OS normally ends the process. Example: 6 entries (pages 0–5), 512-byte pages, address 3,100 = 6 × 512 + 28, so page 6: trap. The check is on whole pages only: a byte in the unused end of the last page passes it.</p>${/* notes paragraph: a page number past the end of the table traps before memory is touched, with an example */''}

<h3>Translating by hand (decimal recipe)</h3>${/* notes heading: the decimal recipe for translating by hand */''}
<ol>${/* start of a numbered list */''}
<li>page = address ÷ page size (whole part); offset = the remainder.</li>${/* recipe step 1: divide to get the page number and offset */''}
<li>If page ≥ the number of page-table entries: trap.</li>${/* recipe step 2: trap if the page number is too big */''}
<li>physical = frame[page] × page size + offset.</li>${/* recipe step 3: frame × page size + offset */''}
</ol>${/* end of the numbered list */''}
<p>Example: page size 512, page table 0→7, 1→19, 2→4, 3→26, 4→11, address 1,300. 1,300 ÷ 512 = 2 remainder 276, so page 2, offset 276; entry 2 holds frame 4; physical = 4 × 512 + 276 = 2,324.</p>${/* notes example: the first problem of step 7 worked through to 2,324 */''}

<h3>Paging versus partitioning</h3>${/* notes heading: paging versus partitioning */''}
<p>Same workload in 16 KB: A, B, C arrive, A is swapped out, D (5,900 B) arrives, then E (1,800 B). <b>Dynamic partitioning (first-fit):</b> after A leaves, 9,284 bytes are free but in holes of 3,900 and 5,384 bytes, so D does not fit; the OS must compact, copying 7,100 bytes (B and C), before D loads. <b>Paging with 1 KB pages:</b> D takes 6 scattered frames at once, nothing is ever copied, and at the end 1,584 bytes are wasted inside last pages. With 2 KB pages the waste inside last pages grows to 3,384 bytes and E (needing 1 frame) has to wait: larger pages waste more.</p>${/* notes paragraph: the race's results, with compaction copying 7,100 bytes against paging's small waste */''}
<table>${/* start of the comparison table */''}
<tr><th></th><th>Fixed partitioning</th><th>Dynamic partitioning</th><th>Paging</th></tr>${/* table header row: the three schemes */''}
<tr><td>Unit handed out</td><td>One whole partition, fixed at start-up</td><td>One block of exactly the process’s size</td><td>Many equal frames</td></tr>${/* table row: the unit each scheme hands out */''}
<tr><td>Process contiguous?</td><td>Yes</td><td>Yes</td><td>No</td></tr>${/* table row: whether a process must be contiguous */''}
<tr><td>Internal fragmentation</td><td>Yes, rest of the partition</td><td>None</td><td>Small: part of the last page</td></tr>${/* table row: internal fragmentation */''}
<tr><td>External fragmentation</td><td>None</td><td>Yes, holes multiply</td><td>None</td></tr>${/* table row: external fragmentation */''}
<tr><td>Compaction</td><td>Never</td><td>From time to time</td><td>Never</td></tr>${/* table row: compaction */''}
<tr><td>Hardware per access</td><td>Base register + bounds</td><td>Base register + bounds</td><td>Page-table lookup + length check</td></tr>${/* table row: hardware work on each access */''}
<tr><td>OS bookkeeping</td><td>Partition table</td><td>List of holes</td><td>Page table per process + free-frame list</td></tr>${/* table row: what the OS keeps track of */''}
</table>${/* end of the comparison table */''}
<p>Three consequences: paging is <b>transparent</b> (programmers and compilers see one continuous range of relative addresses; only the OS and hardware know about frames); translation is <b>simple to do in hardware</b>; and paging is like <b>fixed partitioning with very small, equal partitions</b>, where one process may occupy several partitions that need not be next to each other.</p>${/* notes paragraph: three consequences, transparency, simple hardware and the link to fixed partitioning */''}

<h3>Looking ahead</h3>${/* notes heading: looking ahead */''}
<p>Reading the page table on every access would double the memory traffic, so processors cache recent translations, and large programs need page tables organised in other ways. Once a page-table entry can say “this page is not in memory”, a process can run with only some of its pages loaded: virtual memory (Chapter 8).</p>`,  // notes paragraph: caching translations and virtual memory, coming next; the backtick then ends the notes text
  });  // closes the object passed to Guide.section
})();  // ends the wrapping function and runs it at once
