// Comment key: a line inside backtick text ends with ${/* comment */''}, an empty-string slot that holds a comment without changing the text on screen (full note at the top of the page).
/* Section 1.5 The Memory Hierarchy
   Original teaching material. Helpers live in this IIFE so nothing leaks into the global scope. */
(() => {  // wraps the whole section in a function that runs once, right away, so its names stay private to this file
  /* ------------------------------------------------------------------ shared helpers */
  const fmt = (v, d = 3) => {                       // trim trailing zeros: 0.150 -> 0.15
    const s = Number(v).toFixed(d);  // toFixed(d) writes the number with exactly d digits after the decimal point, as text (0.15 becomes "0.150")
    return s.indexOf('.') >= 0 ? s.replace(/0+$/, '').replace(/\.$/, '') : s;  // if there is a decimal point, strip trailing zeros and then a dangling point, so 2.000 prints as "2"
  };  // ends fmt, the number formatter used by every readout in this section
  // Average access time of a two-level memory: a hit costs T1, a miss costs T1 + T2.
  const avgTime = (H, T1, T2) => H * T1 + (1 - H) * (T1 + T2);  // avgTime(H, T1, T2): hits (fraction H) cost T1, misses cost T1 + T2; the result feeds the calculator and charts
  // multi-line SVG text: one tspan per line
  function mtext(s, x, y, lines, attrs = {}, lh = 17) {  // mtext(s, x, y, lines): builds an SVG (the browser's drawing format) text label that can span several lines
    const t = s('text', Object.assign({ x, y }, attrs));  // s is the SVG element builder passed in; the text element starts at (x, y) and takes any extra attributes
    [].concat(lines).forEach((ln, i) => t.append(s('tspan', { x, dy: i === 0 ? 0 : lh }, ln)));  // adds one tspan (a line of SVG text) per line; each line after the first moves down by lh pixels
    return t;  // hands the finished text element back so the caller can place it in a drawing
  }  // ends mtext
  // a clickable SVG group usable with mouse, keyboard and scripted (synthetic) pointer events
  function hotGroup(ctx, onAct, label, ...kids) {  // hotGroup(...): wraps drawing pieces in an SVG group that acts like a button; onAct runs when it is chosen
    const g = ctx.s('g', { class: 'hot', tabindex: 0, role: 'button', 'aria-label': label }, ...kids);  // the group gets the "hot" class for its hover style, joins the Tab order, and is announced as a button named label
    g.addEventListener('click', onAct);  // a normal mouse click or tap on the group runs the action
    g.addEventListener('pointerdown', (e) => { if (!e.isTrusted) onAct(); });  // a pointer event created by a script (not a real hand, so isTrusted is false) also runs it, for scripted demos
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAct(); } });  // pressing Enter or Space while the group has keyboard focus runs it too, and stops the page from scrolling
    return g;  // returns the group so the caller can add it to the drawing
  }  // ends hotGroup

  /* ------------------------------------------------------------------ locality lab model
     Memory = 256 words (addresses 0..255). The fast memory holds N blocks of B words;
     when it is full, the block that has gone unused the longest is sent back down. */
  const LOC_N = 64;                                  // references per pattern
  function locPattern(k) {  // locPattern(k): builds the list of 64 memory addresses a program touches for pattern k in the locality lab
    const r = [];  // r collects the addresses in the order the program uses them
    if (k === 'loop') { while (r.length < LOC_N) for (let a = 64; a <= 71 && r.length < LOC_N; a++) r.push(a); }   // 8-instruction loop, 8 passes
    else if (k === 'array') { for (let i = 0; i < 16; i++) r.push(32, 160 + i, 33, 34); }  // "array" pattern: three loop instructions (32, 33, 34) plus one new array element (160, 161, ...) per pass
    else if (k === 'sub') { for (let j = 0; j < 8; j++) r.push(8 + 2 * j, 9 + 2 * j, 200, 201, 202, 203, 204, 205); }  // "sub" pattern: two main-program words at a time, then a call into the subroutine at 200-205, eight times
    else if (k === 'seq') { for (let a = 96; a < 96 + LOC_N; a++) r.push(a); }  // "seq" pattern: 64 addresses in a row starting at 96, like straight-line code with no jumps
    else { let x = 20250917; for (let i = 0; i < LOC_N; i++) { x = (Math.imul(x, 1103515245) + 12345) >>> 0; r.push((x >>> 8) % 256); } }  // any other name ("random"): a fixed-seed number generator gives the same scattered addresses 0-255 every time
    return r;  // returns the finished address list
  }  // ends locPattern
  function locSimulate(refs, B, N) {  // locSimulate(refs, B, N): replays the addresses through a fast memory of N blocks of B words and records each result
    const slots = [];                                // { blk, last }
    const seen = new Set();  // seen remembers every address used so far, to tell a repeat use (temporal) from a neighbour (spatial)
    let hits = 0, misses = 0;  // running totals of hits and misses, copied into every step's record so the lab can show the score at any step
    return refs.map((a, t) => {  // turns each address a, used at time t, into one record describing what happened on that access
      const blk = Math.floor(a / B);  // the block number is the address divided by the block size, rounded down (with B = 4, addresses 8-11 are block 2)
      const s = slots.find((x) => x.blk === blk);  // looks for a slot in the fast memory that already holds this block
      let hit = !!s, victim = null, kind = null;  // hit is true when the block was found; victim will name a block pushed out; kind says why a hit happened
      if (hit) { hits++; s.last = t; kind = seen.has(a) ? 'temporal' : 'spatial'; }  // on a hit: count it, mark the slot as just used, and call it temporal if this exact address was used before
      else {  // on a miss the block has to be brought up from the slow memory
        misses++;  // counts the miss
        if (slots.length < N) slots.push({ blk, last: t });  // if a slot is still free, the block simply moves into it
        else {  // otherwise a block must be sent back down to make room
          const lru = slots.reduce((m, x) => (x.last < m.last ? x : m), slots[0]);  // finds the least recently used slot (LRU: the smallest "last used" time)
          victim = lru.blk; lru.blk = blk; lru.last = t;  // records the evicted block as the victim and puts the new block in its slot, marked as used now
        }  // ends the eviction branch
      }  // ends the miss branch
      seen.add(a);  // remembers this address so a later use of it counts as temporal locality
      return { a, blk, hit, victim, kind, hits, misses, resident: slots.map((x) => x.blk).sort((p, q) => p - q) };  // the step record: address, block, hit or miss, evicted block, hit kind, running totals and the blocks now held
    });  // closes the map over the references
  }  // ends locSimulate

  Guide.section({  // registers this section with the guide; the object below holds everything the section shows
    id: '1.5',  // the section number, used in links, the side menu and saved progress
    title: 'The Memory Hierarchy',  // the full title shown at the top of every step
    short: 'Memory hierarchy',  // the short name used in the side menu and progress list
    summary: 'Why memory comes in levels: the speed, size and cost trade-off, hit ratio, locality and the disk cache.',  // one-sentence summary shown on the chapter page
    objectives: [  // what the student should be able to do after this section, shown on its first page
      'State the three design constraints on memory (capacity, access time, cost) and the three relationships that link them.',  // objective 1: capacity, access time and cost, and how they pull against each other
      'Name the levels of the memory hierarchy, group them into inboard, outboard and off-line storage, and describe the four trends going down it.',  // objective 2: the levels of the hierarchy and the trends going down it
      'Compute the average access time of a two-level memory from the hit ratio H and the access times T1 and T2.',  // objective 3: computing average access time from H, T1 and T2
      'Explain locality of reference (temporal and spatial) and why it makes a hierarchy fast and cheap at the same time.',  // objective 4: temporal and spatial locality
      'Describe secondary memory and how the operating system uses part of main memory as a disk cache.',  // objective 5: secondary memory and the disk cache
    ],  // closes the objectives list
    terms: [  // key terms for the glossary, each written as [term, definition]
      ['Memory hierarchy', 'The arrangement of a computer’s storage into levels, from small, fast, expensive memory next to the processor down to huge, slow, cheap storage far from it.'],  // glossary entry: memory hierarchy
      ['Capacity', 'How much data a memory can hold, measured in bytes (KB, MB, GB, TB).'],  // glossary entry: capacity
      ['Access time', 'How long a memory takes to deliver (or store) a piece of data after the processor asks for it.'],  // glossary entry: access time
      ['Cost per bit', 'The price of storing one bit in a memory technology; in practice quoted as dollars per gigabyte.'],  // glossary entry: cost per bit
      ['Inboard memory', 'The levels the processor reaches directly or over the system bus: registers, cache and main memory.'],  // glossary entry: inboard memory
      ['Outboard storage', 'Large storage attached through I/O modules, such as solid-state disks, magnetic disks and optical discs.'],  // glossary entry: outboard storage
      ['Off-line storage', 'Storage media kept outside the running system, such as magnetic tape cartridges, that must be mounted before use; used for backup and archives.'],  // glossary entry: off-line storage
      ['Hit', 'An access whose data is already in the faster level, so it is served at that level’s speed.'],  // glossary entry: hit
      ['Miss', 'An access whose data is not in the faster level, so it must be fetched from the slower level below (and copied up).'],  // glossary entry: miss
      ['Hit ratio (H)', 'The fraction of all memory accesses that are hits in the faster memory: hits ÷ total accesses, a number from 0 to 1.'],  // glossary entry: hit ratio H
      ['Average access time (Ts)', 'The mean time per access over many accesses. For two levels: Ts = H × T1 + (1 − H) × (T1 + T2).'],  // glossary entry: average access time Ts, with the two-level formula
      ['Locality of reference (locality)', 'The tendency of a program’s memory references to cluster: over a short period it uses only a small set of locations, and that set changes slowly.'],  // glossary entry: locality of reference
      ['Temporal locality', 'A location used recently is likely to be used again soon, as with a loop’s instructions or a counter variable.'],  // glossary entry: temporal locality
      ['Spatial locality', 'A location near one used recently is likely to be used soon, as with consecutive instructions or neighbouring array elements.'],  // glossary entry: spatial locality
      ['Block', 'A fixed-size group of neighbouring words that moves between two levels as one unit. A miss copies up the whole block, so the neighbours of the word you asked for arrive too.'],  // glossary entry: block, the unit copied between levels
      ['Secondary memory (auxiliary memory)', 'Large, nonvolatile storage outside main memory, such as disks, that holds programs and files permanently.'],  // glossary entry: secondary (auxiliary) memory
      ['Volatile memory', 'Memory that loses its contents when the power is turned off, such as registers, cache and main memory.'],  // glossary entry: volatile memory
      ['Nonvolatile memory', 'Memory that keeps its contents without power, such as solid-state disks, magnetic disks, optical discs and tape.'],  // glossary entry: nonvolatile memory
      ['Disk cache', 'A portion of main memory that the operating system uses as a buffer for disk data. It is a software technique, not a separate hardware memory.'],  // glossary entry: disk cache
      ['Solid-state disk (SSD)', 'Nonvolatile storage built from flash memory chips with no moving parts, also called a solid-state drive; much faster than a magnetic disk but more expensive per bit.'],  // glossary entry: solid-state disk (SSD)
    ],  // closes the key terms list
    css: ` /* style rules used only by this section; every selector starts with .sec-1-5 so it cannot affect other sections */
      .sec-1-5 .hot { cursor: pointer; outline: none; } /* clickable drawing parts show a pointer cursor and no browser focus outline (the frame thickens instead) */
      .sec-1-5 .hot:hover .fr, .sec-1-5 .hot:focus-visible .fr { stroke-width: 3.5; } /* hovering over a clickable part, or reaching it with the Tab key, thickens its frame line */
      .sec-1-5 .tx-cpu { fill: var(--cpu); } .sec-1-5 .tx-mem { fill: var(--mem); } .sec-1-5 .tx-io { fill: var(--io); } /* text colour classes for drawings: processor, memory and I/O colours from the guide's theme */
      .sec-1-5 .tx-os { fill: var(--os); } .sec-1-5 .tx-ok { fill: var(--ok); } .sec-1-5 .tx-bad { fill: var(--bad); } /* more text colour classes: operating system, correct (green) and wrong (red) */
      .sec-1-5 .tx-acc { fill: var(--accent); } .sec-1-5 .tx-warn { fill: var(--warn); } /* text colour classes for the accent colour and the warning colour */
      .sec-1-5 .c-cpu { color: var(--cpu); } .sec-1-5 .c-mem { color: var(--mem); } .sec-1-5 .c-io { color: var(--io); } /* HTML text colour classes matching the drawing colours: processor, memory and I/O */
      .sec-1-5 .c-os { color: var(--os); } .sec-1-5 .c-ok { color: var(--ok); } .sec-1-5 .c-bad { color: var(--bad); } /* more HTML text colour classes: operating system, correct and wrong */
      .sec-1-5 .c-acc { color: var(--accent); } .sec-1-5 .c-warn { color: var(--warn); } /* HTML text colour classes for the accent and warning colours */
      .sec-1-5 .sc-row { display: grid; grid-template-columns: 230px minmax(0, 1fr) 210px; align-items: center; gap: 14px; padding: 5px 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--panel-2); min-height: 43px; } /* one row of the "feel the gaps" table: level name, guess area and scale bar side by side in three columns */
      .sec-1-5 .sc-row.done { background: var(--panel); } /* a row the student has already revealed gets the plain panel background so finished rows look settled */
      .sec-1-5 .sc-row.sc-head { background: none; border: 0; min-height: 0; padding: 0 13px; letter-spacing: .06em; flex: none; } /* the header row of that table has no box, small spaced-out letters, and does not stretch */
      .sec-1-5 .sc-row .btn.sm { height: 28px; padding: 0 9px; } /* makes the small buttons inside a table row a little shorter so every row keeps the same height */
      .sec-1-5 .sc-bar { height: 12px; border-radius: 99px; background: var(--panel-3); overflow: hidden; } /* the empty track of the log-scale bar in each row, rounded at both ends */
      .sec-1-5 .sc-bar > i { display: block; height: 100%; width: 0; border-radius: 99px; transition: width .6s ease; } /* the coloured fill of that bar starts at zero width and grows over 0.6 s when its time is revealed */
      .sec-1-5 .dc-lane { display: flex; flex-direction: column; gap: 6px; } /* a disk cache lane (one computer) stacks its title, boxes and action line vertically */
      .sec-1-5 .dc-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 8px; } /* puts the main memory box and the disk box side by side, in two equal columns, inside a lane */
      .sec-1-5 .dc-box { border: 2px solid var(--line-2); border-radius: 10px; padding: 4px 8px 5px; min-height: 62px; } /* the outlined box that holds a list of blocks in the disk cache comparison */
      .sec-1-5 .dc-box.mem { border-color: var(--mem); background: var(--mem-bg); } /* the main memory box uses the memory colour for its border and background */
      .sec-1-5 .dc-box.io { border-color: var(--io); background: var(--io-bg); } /* the disk box uses the I/O colour */
      .sec-1-5 .dc-box .lab { font-size: 12.5px; font-weight: 800; letter-spacing: .04em; color: var(--ink-2); } /* the small bold label at the top of each box ("MAIN MEMORY", "DISK") */
      .sec-1-5 .dc-blk { display: inline-grid; place-items: center; min-width: 36px; height: 25px; padding: 0 5px; margin: 2px 2px 0 0; border-radius: 6px; font: 700 13px var(--mono); background: var(--panel); border: 1.5px solid var(--line-2); color: var(--ink); } /* one disk block drawn as a small monospace tile showing its block number */
      .sec-1-5 .dc-blk.dirty { border-color: var(--warn); background: var(--warn-bg); color: var(--warn); } /* a changed (dirty) block waiting in the disk cache is drawn in the warning colour */
      .sec-1-5 .dc-blk.stale { border-style: dashed; border-color: var(--warn); color: var(--warn); } /* a disk block whose newest data is still only in memory gets a dashed warning border (out of date) */
      .sec-1-5 .dc-blk.hl { box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 55%, transparent); } /* the block touched by the current request gets a glowing ring in the accent colour */
      .sec-1-5 .dc-blk.gone { opacity: .45; border-style: dashed; } /* after a power cut, a clean cached block fades out with a dashed border: it is gone, but nothing was lost */
      .sec-1-5 .dc-blk.lost { background: var(--bad-bg); border-color: var(--bad); color: var(--bad); text-decoration: line-through; } /* after a power cut, a changed block turns red and is crossed out: its new data never reached the disk */
      .sec-1-5 .dc-req { display: inline-grid; place-items: center; min-width: 50px; height: 28px; padding: 0 6px; border-radius: 8px; font: 700 13px var(--mono); border: 1.5px solid var(--line-2); background: var(--panel); color: var(--ink-2); } /* one request tile in the strip across the top of the disk cache demo ("R 12", "W 13", "flush") */
      .sec-1-5 .dc-req.done { opacity: .5; } /* requests already carried out are faded */
      .sec-1-5 .dc-req.on { border-color: var(--accent); background: var(--accent-bg); color: var(--accent); } /* the request being carried out right now is highlighted in the accent colour */
      .sec-1-5 .fn-row { display: grid; grid-template-columns: 136px minmax(0, 1fr) 222px; align-items: center; gap: 12px; padding: 6px 12px; border-radius: 10px; border: 1.5px solid var(--line); background: var(--panel); } /* one row of the funnel step: level name, bar of references that arrive, and the counts, in three columns */
      .sec-1-5 .fn-bar { height: 22px; border-radius: 6px; background: var(--panel-3); overflow: hidden; } /* the empty track behind each funnel bar */
      .sec-1-5 .fn-bar > i { display: block; height: 100%; min-width: 3px; border-radius: 6px; transition: width .35s ease; } /* the funnel bar fill keeps at least 3 pixels so a tiny share stays visible, and resizes over 0.35 s */
      .sec-1-5 .fn-down { padding: 1px 0 1px 162px; font-size: 14px; color: var(--bad); font-weight: 700; } /* the red "misses go on down" line between funnel rows, indented to sit under the bar column */
      .sec-1-5 .fn-time { display: flex; height: 22px; border-radius: 6px; overflow: hidden; background: var(--panel-3); } /* the stacked bar that splits the average access time into the part paid at each level */
      .sec-1-5 .fn-time > i { display: block; height: 100%; transition: width .35s ease; } /* each coloured piece of that time bar slides to its new width over 0.35 s when a slider moves */
      .sec-1-5 .fn-key { display: inline-block; width: 11px; height: 11px; border-radius: 3px; vertical-align: -1px; margin-right: 4px; } /* the small coloured square in the key under the time bar, one per level */
      @media (max-width: 760px) { /* the rules below apply only when the window is 760 pixels wide or less (phones and small windows) */
        .sec-1-5 .sc-row { grid-template-columns: minmax(0, 1fr); gap: 6px; } /* on a small screen, each gaps table row stacks its three parts vertically */
        .sec-1-5 .sc-row.sc-head { display: none; } /* the gaps table header is hidden on a small screen because the columns are gone */
        .sec-1-5 .fn-row { grid-template-columns: minmax(0, 1fr); gap: 4px; } /* on a small screen, each funnel row stacks its three parts vertically */
        .sec-1-5 .fn-down { padding-left: 12px; } /* the "misses go down" line loses its big indent once the bar no longer sits in a second column */
      } /* closes the small-screen rules */
    `,  // end of this section's style rules
    steps: [  // steps: the list of screens in this section, shown one at a time in this order
      /* ---------------------------------------------------------------- 1. Big picture */
      {  // step 1 starts here
        title: 'Fast, big and cheap: pick any two',  // title of step 1, shown at the top of the screen
        kind: 'story',  // kind "story" labels the step as the Big Picture
        render(el, ctx) {  // render(el, ctx) builds the step when the student arrives; el is the step's box, ctx carries the guide helpers
          const { h, s } = ctx;  // h builds HTML elements and s builds SVG drawing elements (both are guide helpers)
          // [place, level, shape class, text class, colour name, what the pairing means]
          const ROWS = [  // ROWS: the five wardrobe places, each paired with the memory level it stands for
            ['The clothes you are wearing', 'Registers', 's-cpu', 'tx-cpu', 'cpu', 'The processor works <b>directly</b> on the values in its registers, just as you already have these clothes on. There are only a handful, and using them costs no trip at all.'],  // row 1: clothes you are wearing = registers, used with no trip at all
            ['Tomorrow’s outfit on the chair', 'Cache', 's-accent', 'tx-acc', 'accent', 'The cache holds <b>copies</b> of what the processor will probably need next, like the outfit you laid out in advance: a few items, grabbed in a moment.'],  // row 2: tomorrow's outfit on the chair = cache, copies laid out ahead of time
            ['Your closet', 'Main memory', 's-mem', 'tx-mem', 'mem', 'Main memory holds <b>every running program</b> and its data: plenty of room, a few steps away. Most things you reach for today come from here or closer.'],  // row 3: your closet = main memory, where the running programs live
            ['Boxes in the basement', 'Disk', 's-io', 'tx-io', 'io', 'The disk keeps <b>everything you own</b>, even things untouched for months, and it survives a power cut. Fetching from it is a slow trip downstairs, so you batch your trips.'],  // row 4: boxes in the basement = disk, which keeps everything and survives a power cut
            ['A storage unit across town', 'Tape', 's-io', 'tx-io', 'io', 'Tape holds <b>backups and archives</b>. Space there is the cheapest of all, but a visit takes ages, so you go only when something is lost or must be kept for years.'],  // row 5: a storage unit across town = tape, for backups and archives
          ];  // closes ROWS
          let pickRow = -1;  // pickRow remembers which row is selected (-1 means none yet)
          const rowInfo = h('div', { class: 'card tight small', style: { minHeight: '92px' } });  // the box under the drawing that explains the chosen row; its fixed height stops the layout from jumping
          const frames = [];  // frames will hold the coloured rectangle around each level name, so the chosen one can be thickened
          const svg = s('svg', { viewBox: '0 0 600 282', width: '100%', role: 'img', 'aria-label': 'Wardrobe analogy for the memory hierarchy' });  // the drawing area; viewBox sets its own 600 by 282 coordinate grid, which then scales to the box width
          function showRow(i) {  // showRow(i): selects row i, when a row is clicked or at start-up
            pickRow = i;  // remembers the chosen row
            frames.forEach((f, k) => f.setAttribute('stroke-width', k === i ? 4 : 2));  // thickens the frame of the chosen level and returns every other frame to normal
            const r = ROWS[i];  // r is the chosen row's data
            rowInfo.innerHTML = i < 0 ? '<b>Click any row</b> to see why each place stands for its level of memory.'  // with nothing chosen yet, the box shows an invitation to click a row
              : `<b class="c-${r[4] === 'accent' ? 'acc' : r[4]}">${r[1]}</b> = ${r[0].toLowerCase()}. ${r[5]}`;  // otherwise it shows the level name in its colour, the matching place, and the explanation
          }  // ends showRow
          ROWS.forEach(([place, level, cls, tx], i) => {  // draws one clickable row of the drawing for each wardrobe place
            const y = 10 + i * 54;  // each row sits 54 units below the previous one
            const fr = s('rect', { x: 326, y, width: 168, height: 44, rx: 10, class: 'fr ' + cls, 'stroke-width': 2 });  // the coloured frame around the memory level's name on the right
            frames.push(fr);  // keeps the frame so showRow can thicken it later
            svg.append(hotGroup(ctx, () => showRow(i), level + ': ' + place,  // adds the row as one clickable group (see hotGroup above); clicking anywhere on it calls showRow
              s('rect', { x: 6, y, width: 262, height: 44, rx: 10, class: 's-panel', 'stroke-width': 1.5 }),  // the grey box on the left that holds the place name
              s('text', { x: 20, y: y + 27, 'font-size': 15, 'font-weight': 600 }, place),  // the place name, such as "Your closet"
              s('line', { x1: 274, y1: y + 22, x2: 318, y2: y + 22, class: 's-line', 'marker-end': 'url(#arr)' }),  // an arrow from the place to the level (arr is an arrowhead shape defined once by the guide)
              fr,  // the level's coloured frame
              s('text', { x: 410, y: y + 28, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 800, class: tx }, level)));  // the level name, centred in its frame and coloured to match
          });  // ends the loop that draws the rows
          svg.append(  // adds the side arrow and its two labels to the drawing
            s('line', { x1: 526, y1: 14, x2: 526, y2: 266, class: 's-line', 'marker-end': 'url(#arr)' }),  // a long arrow down the right side, pointing from the top level to the bottom level
            s('text', { x: 548, y: 140, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 700, transform: 'rotate(90 548 140)' }, 'more room, cheaper per item'),  // label turned sideways along that arrow: lower levels have more room and cost less per item
            s('text', { x: 572, y: 140, 'text-anchor': 'middle', 'font-size': 13.5, class: 's-sub', transform: 'rotate(90 572 140)' }, 'slower to reach, used less often'));  // second sideways label: lower levels are slower to reach and used less often
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: 'minmax(0,1.05fr) minmax(0,1fr)' } },  // lays the step out in two columns: explanation on the left, the drawing on the right
            h('div', { class: 'stack' },  // left column, stacked vertically
              h('p', { class: 'lead m0', html: 'Every program wants memory that is <b>huge</b>, <b>instant</b> and <b>nearly free</b>. No single technology is all three, so computers stack several kinds of memory in levels: a <span class="t">memory hierarchy</span>.' }),  // opening paragraph: nothing is huge, instant and nearly free, so memory comes in levels
              h('div', { class: 'grid-3', style: { gap: '10px' } },  // three small cards, one per design question
                h('div', { class: 'card tight', html: '<h4>How much?</h4><div class="small"><span class="t">Capacity</span>: room for every program and its data.</div>' }),  // card: capacity (how much)
                h('div', { class: 'card tight', html: '<h4>How fast?</h4><div class="small"><span class="t">Access time</span>: keep up with a processor that wants a word every nanosecond.</div>' }),  // card: access time (how fast)
                h('div', { class: 'card tight', html: '<h4>How expensive?</h4><div class="small"><span class="t">Cost per bit</span>: low enough not to dominate the price of the machine.</div>' })),  // card: cost per bit (how expensive)
              h('div', { class: 'card white tight', html: '<h4>In this section you will</h4><ul class="small m0"><li>see why no one memory technology can win on all three</li><li>climb the hierarchy level by level and feel its speed gaps</li><li>calculate how fast a two-level memory really is</li><li>discover <b>locality</b>, the habit of programs that makes it all work</li><li>see how the OS turns main memory into a <b>disk cache</b></li></ul>' }),  // card: the list of things the student will do in this section
              h('div', { class: 'callout why m0', 'data-label': 'Why an OS course cares', html: 'The OS manages the lower levels: it decides what stays in <span class="t">main memory</span> and what waits on disk. Processes, virtual memory and file systems all sit on this hierarchy.' })),  // callout: why an operating system course cares about the hierarchy
            h('div', { class: 'stack' },  // right column, stacked vertically
              h('div', { class: 'card white', style: { padding: '10px 12px' } }, ctx.narrow  // white card holding either the drawing or, on a phone-width screen (the guide's phone-layout flag), a list of buttons instead
                ? h('div', { class: 'stack gap-s' }, ...ROWS.map(([place, level, , , col], i) => h('button', { class: 'btn', type: 'button', style: { justifyContent: 'space-between', width: '100%', height: 'auto', padding: '6px 10px', whiteSpace: 'normal', textAlign: 'left' }, onclick: () => showRow(i) },  // phone-width version: one full-width button per row that calls showRow when tapped
                    h('span', { class: 'small b', text: place + ' →' }),  // left side of the button: the place name with an arrow
                    h('span', { class: 'box', style: { minWidth: '112px', padding: '3px 8px', borderColor: `var(--${col})`, background: `var(--${col}-bg)` }, text: level }))),  // right side: the level name in a small box coloured for that level
                  h('div', { class: 'small muted', text: '↓ going down: more room and cheaper per item, but slower to reach and used less often' }))  // a note under the buttons that says what changes going down the list
                : svg),  // on a wide screen the card holds the SVG drawing instead
              rowInfo,  // the explanation box that showRow fills in
              h('div', { class: 'callout analogy m0', 'data-label': 'Analogy: your clothes', html: 'You keep what you use most within arm’s reach and everything else further away. Most days you never visit the basement, so your wardrobe <b>feels</b> as quick as the chair yet <b>holds</b> as much as the storage unit. A memory hierarchy plays the same trick.' }))));  // callout: the wardrobe analogy, which feels as quick as the chair yet holds as much as the storage unit
          showRow(-1);  // starts with no row selected, so the box shows its invitation
        },  // ends render() for step 1
      },  // ends step 1
      /* ---------------------------------------------------------------- 2. The dilemma */
      {  // step 2 starts here
        title: 'The dilemma: build everything from one technology',  // title of step 2
        kind: 'explore',  // kind "explore" labels the step as an Explore screen
        render(el, ctx) {  // render() builds step 2 when the student arrives on it
          const { h } = ctx;  // h is the guide's helper that builds HTML elements
          // Rough mid-2020s figures. Only the ratios matter; they are stable even as prices fall.
          const TECH = [  // TECH: four storage technologies with rough speed, price and size figures for the what-if calculator
            { k: 'sram', name: 'SRAM', long: 'SRAM (cache chips)', ns: 1, time: '≈ 1 ns', perGB: 1000, per: '≈ $1,000', devGB: 0.032, dev: '≈ 32 MB', vol: true },  // SRAM: about 1 ns per access, about $1,000 per GB, 32 MB per device, loses data without power (vol)
            { k: 'dram', name: 'DRAM', long: 'DRAM (main memory)', ns: 100, time: '≈ 100 ns', perGB: 5, per: '≈ $5', devGB: 32, dev: '≈ 32 GB', vol: true },  // DRAM: about 100 ns per access, about $5 per GB, 32 GB per module, also volatile
            { k: 'ssd', name: 'Flash SSD', long: 'Flash (solid-state disk)', ns: 1e5, time: '≈ 100 µs', perGB: 0.08, per: '≈ $0.08', devGB: 4000, dev: '≈ 4 TB', vol: false },  // flash SSD: about 100 microseconds per access (1e5 ns), 8 cents per GB, 4 TB per drive, keeps data without power
            { k: 'hdd', name: 'Magnetic disk', long: 'Magnetic disk', ns: 5e6, time: '≈ 5 ms', perGB: 0.02, per: '≈ $0.02', devGB: 20000, dev: '≈ 20 TB', vol: false },  // magnetic disk: about 5 ms per access (5e6 ns), 2 cents per GB, 20 TB per drive, keeps data without power
          ];  // closes TECH
          const CAPS = [1, 4, 16, 64, 256, 1000, 4000];  // CAPS: the storage sizes, in GB, that the "Storage needed" slider steps through (1 GB up to 4 TB)
          const capLabel = (gb) => (gb >= 1000 ? gb / 1000 + ' TB' : gb + ' GB');  // capLabel(gb): shows a size in GB, or in TB from 1,000 GB up
          const money = (x) => (x >= 1e6 ? '$' + fmt(x / 1e6, 1) + ' million' : x >= 100 ? '$' + Math.round(x).toLocaleString('en-US') : '$' + x.toFixed(2));  // money(x): shows a price as dollars and cents, whole dollars with commas, or millions
          // seconds -> readable duration (hours up to two days, so 10^5 s reads "27.8 hours", not "1 days")
          const human = (sec) => (sec < 60 ? fmt(sec, 1) + ' s' : sec < 3600 ? fmt(sec / 60, 1) + ' min' : sec < 172800 ? fmt(sec / 3600, 1) + ' hours' : Math.round(sec / 86400) + ' days');  // human(sec): turns a number of seconds into seconds, minutes, hours or days so large times are easy to read
          let pick = 1, capIdx = 5;  // pick is the chosen technology (1 = DRAM at start); capIdx is the slider position (5 = 1 TB)
          const costOut = h('div', { class: 'big', style: { fontSize: '30px' } });  // the big "cost to build" number
          const timeOut = h('div', { class: 'big', style: { fontSize: '30px' } });  // the big "time for a billion accesses" number
          const devOut = h('div', { class: 'big', style: { fontSize: '30px' } });  // the big "devices needed" number
          const verdict = h('div', { class: 'callout m0' });  // the coloured verdict box under the numbers
          const rows = TECH.map((t, i) => h('tr', { role: 'button', tabindex: 0, style: { cursor: 'pointer' }, onclick: () => choose(i), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(i); } } },  // one table row per technology; clicking it, or pressing Enter or Space on it, chooses that technology
            h('td', { class: 'b', text: t.long }), h('td', { class: 'num', text: t.time }), h('td', { class: 'num', text: t.per }), h('td', { class: 'num', text: t.dev })));  // the row's four cells: name, access time, cost per GB and how much one device holds
          const seg = ctx.ui.seg(TECH.map((t, i) => ({ value: i, label: t.name })), pick, (v) => choose(v));  // segmented buttons (a row of toggle buttons, a guide helper) that also choose the technology
          const slider = ctx.ui.slider({ label: 'Storage needed', min: 0, max: CAPS.length - 1, step: 1, value: capIdx, format: (v) => capLabel(CAPS[v]), onInput: (v) => { capIdx = v; paint(); } });  // the storage-size slider; moving it updates capIdx and recalculates everything
          function choose(i) { pick = i; seg.set(i); paint(); }  // choose(i): selects technology i from a row or a button, keeps the buttons in step, and repaints
          function paint() {  // paint(): recalculates the three readouts and the verdict; runs on every choice and slider move
            const t = TECH[pick], gb = CAPS[capIdx];  // t is the chosen technology and gb the storage size in GB
            const cost = t.perGB * gb, secs = t.ns;            // 10^9 accesses × t.ns ns = t.ns seconds
            const devs = Math.ceil(gb / t.devGB);  // devices needed: size divided by one device's size, rounded up, since half a drive cannot be bought
            costOut.textContent = money(cost);  // shows the total cost
            timeOut.textContent = human(secs);  // shows how long a billion accesses would take
            devOut.textContent = devs.toLocaleString('en-US');  // shows the device count with thousands separators
            rows.forEach((r, i) => r.classList.toggle('on', i === pick));  // highlights the chosen technology's row in the table
            const forget = t.vol ? ' And it <b>forgets everything</b> when the power goes off.' : '';  // extra sentence for volatile technologies: they lose everything when the power goes off
            const msg = {  // msg picks the verdict for the chosen technology: [colour style, heading, explanation]
              sram: [`bad`, 'Too expensive', `Blazing fast, but ${capLabel(gb)} costs about <b>${money(cost)}</b> and needs <b>${devs.toLocaleString('en-US')}</b> chips’ worth of SRAM, far too many to sit next to the processor.${forget}`],  // SRAM verdict: fast but far too expensive and too many chips to fit next to the processor
              dram: ['warn', gb > 64 ? 'Costly and forgetful' : 'Affordable, but forgetful', `A billion accesses take <b>${human(secs)}</b>, a hundred times slower than SRAM. ${capLabel(gb)} costs <b>${money(cost)}</b>${devs > 4 ? ` and needs ${devs} modules, more than a typical machine has slots for` : ''}.${forget} Every saved file would vanish too, which is why DRAM serves as main memory but never as the only storage.`],  // DRAM verdict: affordable at small sizes, a hundred times slower than SRAM, and it forgets saved files
              ssd: ['warn', 'Cheap and big, but slow', `${capLabel(gb)} for only <b>${money(cost)}</b>, and it keeps data without power. But each access takes about <b>1,000×</b> longer than DRAM: a billion accesses take <b>${human(secs)}</b>. The processor would spend almost all its time waiting.`],  // SSD verdict: cheap, big and nonvolatile, but about a thousand times slower than DRAM
              hdd: ['bad', 'Cheapest, and far too slow', `${capLabel(gb)} costs just <b>${money(cost)}</b>, but every access waits for a spinning platter: a billion accesses take <b>${human(secs)}</b>, about <b>50,000×</b> longer than DRAM.`],  // magnetic disk verdict: cheapest of all, but about fifty thousand times slower than DRAM
            }[t.k];  // looks up the entry for the chosen technology's key
            verdict.className = 'callout m0 ' + msg[0];  // gives the verdict box the colour style for this verdict
            verdict.setAttribute('data-label', msg[1]);  // sets the verdict heading, which the box's style displays above the text
            verdict.innerHTML = msg[2];  // puts the explanation text into the verdict box
          }  // ends paint
          const readout = (label, out, sub) => h('div', { class: 'card tight center' }, h('h4', { text: label }), out, h('div', { class: 'xs muted', text: sub }));  // readout(label, out, sub): builds one small card with a heading, a big number and a small note underneath
          el.append(h('div', { class: 'split l fill' },  // lays the step out in two columns, the left one smaller than the right
            h('div', { class: 'stack' },  // left column: explanation
              h('p', { class: 'lead m0', html: 'Suppose you had to build <b>all</b> of a computer’s storage from <b>one</b> technology. Pick one and see what goes wrong.' }),  // opening paragraph: build everything from one technology and see what goes wrong
              h('div', { class: 'card white tight stack gap-s', html: `<h4>Three relationships that always hold</h4>${/* card with the three relationships that always hold, one per coloured row */''}
                <div class="row gap-s"><span class="chip cpu">faster access time</span>→<span class="chip bad">greater cost per bit</span></div>${/* relationship 1: faster access time means greater cost per bit */''}
                <div class="row gap-s"><span class="chip mem">greater capacity</span>→<span class="chip ok">smaller cost per bit</span></div>${/* relationship 2: greater capacity means smaller cost per bit */''}
                <div class="row gap-s"><span class="chip mem">greater capacity</span>→<span class="chip warn">greater (slower) access time</span></div>${/* relationship 3: greater capacity means slower access time */''}
                <div class="xs muted">Read the table down any column to see all three at once.</div>` }),  // note under the card: the table shows all three at once; this line ends the card's text
              h('div', { class: 'callout warn m0', 'data-label': 'The dilemma', html: 'We want <b>large capacity</b>, because it is cheap per bit and programs need room. We also want <b>fast access</b>. But the big technologies are slow and the fast ones are expensive.' }),  // callout: the dilemma, since we want both large capacity and fast access
              h('div', { class: 'callout tip m0', 'data-label': 'The way out', html: 'Do not choose. Use a <b>little</b> of the fast, costly memory and a <b>lot</b> of the slow, cheap memory, stacked in levels, and keep the data in use near the top.' })),  // callout: the way out is a little fast memory plus a lot of cheap memory, stacked in levels
            h('div', { class: 'stack' },  // right column: the calculator
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, seg, h('div', { style: { flex: '1', minWidth: '260px' } }, slider)),  // top row: the technology buttons on the left and the size slider on the right
              h('div', { class: 'grid-3', style: { gap: '10px' } },  // three readout cards side by side
                readout('Cost to build', costOut, 'at the price per GB below'),  // readout card: cost to build
                readout('Time for 10⁹ accesses', timeOut, 'a fast processor needs ≤ 1 s'),  // readout card: time for a billion accesses (a fast processor needs one second or less)
                readout('Devices needed', devOut, 'chips, modules or drives')),  // readout card: number of devices needed
              verdict,  // the verdict box that paint() fills
              h('table', { class: 'tbl compact' },  // the comparison table of the four technologies
                h('thead', {}, h('tr', {}, h('th', { text: 'Technology' }), h('th', { text: 'Access time' }), h('th', { text: 'Cost per GB' }), h('th', { text: 'One device holds' }))),  // table header row: technology, access time, cost per GB, one device holds
                h('tbody', {}, ...rows)),  // table body holding the clickable rows built above
              h('div', { class: 'xs muted', html: '<b>Units:</b> 1 ns (nanosecond) = a billionth of a second; 1 µs = 1,000 ns; 1 ms = 1,000 µs. <b>SRAM</b> (static RAM) is fast but bulky; <b>DRAM</b> (dynamic RAM) packs bits densely but is slower. Figures are rough mid-2020s values: prices fall, but the ratios between rows barely change.' }))));  // small print: time units, what SRAM and DRAM are, and why the rough figures still make the point
          paint();  // fills the readouts once so the step opens with DRAM at 1 TB already worked out
        },  // ends render() for step 2
      },  // ends step 2
      /* ---------------------------------------------------------------- 3. The pyramid */
      {  // step 3 starts here
        title: 'The hierarchy pyramid, level by level',  // title of step 3
        kind: 'explore',  // kind "explore" labels it an Explore screen
        render(el, ctx) {  // render() builds step 3 when the student arrives on it
          const { h, s } = ctx;  // h builds HTML elements and s builds SVG drawing elements
          const GROUP = ['Inboard memory', 'Outboard storage', 'Off-line storage'];  // GROUP: the names of the three groups of levels, looked up by each level's g number
          // tier: 0..4 (tier 3 holds three side-by-side cells). v = pyramid labels for the four trends.
          const L = [  // L: one record per level of the pyramid, from the top (registers) to the bottom (tape)
            { k: 'reg', name: 'Registers', tier: 0, cls: 's-cpu', tx: 'tx-cpu', c: 'c-cpu', g: 0, vol: true,  // registers: top tier, processor colour, inboard group (g 0), volatile
              v: { cost: 'highest', cap: '≈ 1 KB', time: '≈ 0.3 ns', freq: 'constantly' },  // short labels shown on the pyramid for registers under each of the four trends
              cap: 'about a kilobyte in total', time: '≈ 0.3 ns (within one clock tick)', cost: 'the highest of all: part of the processor', freq: 'several times in almost every instruction', who: 'the program (the compiler picks them)',  // registers detail: about 1 KB, within one clock tick, highest cost, used constantly, chosen by the compiler
              d: 'Tiny storage slots inside the processor itself. Instructions name registers directly, so reading one is simply part of carrying out the instruction.' },  // registers description shown in the detail panel
            { k: 'cache', name: 'Cache', tier: 1, cls: 's-accent', tx: 'tx-acc', c: 'c-acc', g: 0, vol: true,  // cache: tier 1, accent colour, inboard group, volatile
              v: { cost: '≈ $1,000 / GB', cap: '≈ 64 KB–64 MB', time: '≈ 1–10 ns', freq: 'very often' },  // short pyramid labels for the cache
              cap: 'kilobytes to tens of megabytes', time: '≈ 1–10 ns', cost: 'very high (≈ $1,000 per GB)', freq: 'on most memory accesses', who: 'hardware, automatically',  // cache detail: kilobytes to tens of megabytes, 1-10 ns, very high cost, managed by hardware
              d: 'Fast SRAM on the processor chip that keeps copies of recently used blocks of main memory. Hardware fills it and picks what to replace automatically; programs never manage it, and the OS steps in only for occasional maintenance such as flushing. Section 1.6 opens it up.' },  // cache description: SRAM copies of recently used blocks, filled automatically by the hardware
            { k: 'main', name: 'Main memory', tier: 2, cls: 's-mem', tx: 'tx-mem', c: 'c-mem', g: 0, vol: true,  // main memory: tier 2, memory colour, inboard group, volatile
              v: { cost: '≈ $5 / GB', cap: '≈ 8–64 GB', time: '≈ 50–100 ns', freq: 'often' },  // short pyramid labels for main memory
              cap: 'gigabytes (8–64 GB is typical)', time: '≈ 50–100 ns', cost: 'moderate (≈ $5 per GB)', freq: 'only when the cache misses', who: 'the operating system',  // main memory detail: gigabytes, 50-100 ns, moderate cost, managed by the operating system
              d: 'The computer’s working memory, built from DRAM chips. A program’s instructions and data must be here while it runs, and the OS decides which program gets how much.' },  // main memory description: DRAM working memory that every running program must be in
            { k: 'ssd', name: 'SSD', tier: 3, cell: 0, cls: 's-io', tx: 'tx-io', c: 'c-io', g: 1, vol: false,  // SSD: tier 3, the first of three side-by-side cells, I/O colour, outboard group, nonvolatile
              v: { cost: '≈ 8¢ / GB', cap: '≈ 0.5–4 TB', time: '≈ 0.1 ms', freq: 'occasionally' },  // short pyramid labels for the SSD
              cap: 'about 0.5–4 TB per drive', time: '≈ 0.1 ms (100 µs)', cost: 'low (≈ 8 cents per GB)', freq: 'only when data is not in main memory', who: 'the OS, through an I/O module',  // SSD detail: up to about 4 TB, about 0.1 ms, low cost, reached by the OS through an I/O module
              d: 'A <span class="t">solid-state disk</span>: flash memory chips with no moving parts. Far faster than a spinning disk, but several times more expensive per bit.' },  // SSD description: flash chips with no moving parts, faster than a spinning disk but pricier per bit
            { k: 'hdd', name: 'Magnetic disk', tier: 3, cell: 1, cls: 's-io', tx: 'tx-io', c: 'c-io', g: 1, vol: false,  // magnetic disk: tier 3, second cell, I/O colour, outboard group, nonvolatile
              v: { cost: '≈ 2¢ / GB', cap: '≈ 1–20 TB', time: '≈ 5–10 ms', freq: 'occasionally' },  // short pyramid labels for the magnetic disk
              cap: 'about 1–20 TB per drive', time: '≈ 5–10 ms', cost: 'very low (≈ 2 cents per GB)', freq: 'only when data is not in main memory', who: 'the OS, through an I/O module',  // magnetic disk detail: up to about 20 TB, 5-10 ms, very low cost, reached through an I/O module
              d: 'Spinning platters read by a moving arm. Huge and cheap per bit, but every access waits for the arm to move and the platter to turn under it.' },  // magnetic disk description: spinning platters and a moving arm, so every access waits for mechanical motion
            { k: 'opt', name: 'Optical discs', tier: 3, cell: 2, cls: 's-io', tx: 'tx-io', c: 'c-io', g: 1, vol: false,  // optical discs: tier 3, third cell, I/O colour, outboard group, nonvolatile
              v: { cost: '≈ 5¢ / GB', cap: '≤ 100 GB / disc', time: '≈ 100 ms', freq: 'occasionally' },  // short pyramid labels for optical discs
              cap: 'up to about 100 GB per disc', time: '≈ 100 ms', cost: '≈ 5 cents per GB: more than a magnetic disk (a niche product now)', freq: 'only when a disc is in the drive', who: 'the OS, through an I/O module',  // optical disc detail: up to about 100 GB per disc, about 100 ms, costs a little more per GB than a magnetic disk
              d: 'CDs, DVDs and Blu-ray discs read by a laser. One disc holds less than a hard disk, but discs are removable, so a shelf of them holds as much as you like.' },  // optical disc description: CDs, DVDs and Blu-ray read by a laser; removable, so a shelf holds any amount
            { k: 'tape', name: 'Magnetic tape', tier: 4, cls: 's-io', tx: 'tx-io', c: 'c-io', g: 2, vol: false, dash: true,  // magnetic tape: bottom tier, I/O colour, off-line group (g 2), nonvolatile, drawn with a dashed outline
              v: { cost: '≈ 0.5¢ / GB', cap: '≈ 10–30 TB each', time: 'seconds to minutes', freq: 'rarely' },  // short pyramid labels for tape
              cap: 'about 10–30 TB per cartridge', time: 'seconds to minutes (load, then wind to the spot)', cost: 'the lowest (≈ half a cent per GB)', freq: 'rarely: backups and restores', who: 'operators and backup software',  // tape detail: 10-30 TB per cartridge, seconds to minutes to reach data, lowest cost, used for backups
              d: 'Cartridges kept on a shelf or in a robot library and mounted only when needed. Tape is sequential: reaching one spot means winding past everything before it.' },  // tape description: mounted only when needed, and sequential, so reaching one spot means winding past the rest
          ];  // closes the list of levels
          const TRENDS = [  // TRENDS: the four things that change going down the hierarchy; each has a button and an arrow label
            { k: 'cost', lab: '(a) Decreasing <b>cost per bit</b>', arrow: 'cost per bit decreases' },  // trend (a): cost per bit falls going down
            { k: 'cap', lab: '(b) Increasing <b>capacity</b>', arrow: 'capacity increases' },  // trend (b): capacity grows going down
            { k: 'time', lab: '(c) Increasing <b>access time</b>', arrow: 'access time increases' },  // trend (c): access time grows (gets slower) going down
            { k: 'freq', lab: '(d) Decreasing <b>frequency of access</b> by the processor', arrow: 'processor uses it less often' },  // trend (d): the processor uses each lower level less often
          ];  // closes TRENDS
          let sel = 2, trend = 0;  // sel is the selected level (2 = main memory at start); trend is the chosen trend (0 = cost)
          const NW = ctx.narrow;                        // phones: crop the side labels and enlarge the text
          const svg = s('svg', { viewBox: NW ? '146 4 474 363' : '0 0 660 371', width: '100%', role: 'img', 'aria-label': 'Memory hierarchy pyramid' });  // the pyramid drawing; on a phone-width screen the viewBox crops off the side labels so the text is larger
          const SHORT = { 'Magnetic disk': 'Disk', 'Optical discs': 'Optical' };  // shorter names for the two long level names, used on small screens
          const cx = 392, Y0 = 10, TH = 66, GAP = 4;  // pyramid geometry: centre line x, top y, height of each tier, and the gap between tiers
          const wAt = (y) => 120 + 340 * (y - Y0) / (5 * TH + 4 * GAP);  // wAt(y): the pyramid's width at height y, growing in a straight line from 120 at the top to 460 at the bottom
          const valText = [];  // valText will hold each level's second text line, which shows the value for the chosen trend
          const polys = [];  // polys will hold each level's outline shape so the selected one can be thickened
          L.forEach((lv, i) => {  // draws each level as a trapezoid slice of the pyramid
            const top = Y0 + lv.tier * (TH + GAP), bot = top + TH;  // top and bottom y of this level's tier
            let xl0 = cx - wAt(top) / 2, xr0 = cx + wAt(top) / 2, xl1 = cx - wAt(bot) / 2, xr1 = cx + wAt(bot) / 2;  // left and right x at the top and at the bottom of the tier, taken from the pyramid's width there
            if (lv.cell != null) {       // split the outboard tier into three cells
              const a = lv.cell / 3, b = (lv.cell + 1) / 3, g = lv.cell === 0 ? 0 : 2, g2 = lv.cell === 2 ? 0 : 2;  // a and b are the cell's start and end as fractions of the tier; g and g2 leave a small gap between cells
              [xl0, xr0] = [xl0 + (xr0 - xl0) * a + g, xl0 + (xr0 - xl0) * b - g2];  // moves the top corners in to this cell's share of the tier
              [xl1, xr1] = [xl1 + (xr1 - xl1) * a + g, xl1 + (xr1 - xl1) * b - g2];  // moves the bottom corners the same way
            }  // ends the three-cell split
            const mid = (xl0 + xr0 + xl1 + xr1) / 4, small = lv.cell != null;  // mid is the horizontal centre of the shape; small marks the three thinner outboard cells
            const poly = s('polygon', { points: `${xl0},${top} ${xr0},${top} ${xr1},${bot} ${xl1},${bot}`, class: 'fr ' + lv.cls, 'stroke-width': 2, 'stroke-dasharray': lv.dash ? '7 4' : null });  // the four-cornered outline of this level, filled in its colour; tape gets a dashed border
            const vt = s('text', { x: mid, y: top + (NW ? 54 : 51), 'text-anchor': 'middle', 'font-size': NW ? (small ? 14.5 : 18) : (small ? 13.5 : 15), 'font-weight': 700, class: lv.tx });  // the value line under the level name (filled in by paint); larger text on a phone-width screen
            polys.push(poly); valText.push(vt);  // keeps the outline and the value text so paint() can update them
            svg.append(hotGroup(ctx, () => { sel = i; paint(); }, lv.name, poly,  // adds the level as a clickable group; clicking it selects the level and repaints
              s('text', { x: mid, y: top + (NW ? 29 : 28), 'text-anchor': 'middle', 'font-size': NW ? (small ? 17 : 21) : (small ? 15 : 17), 'font-weight': 800 }, NW && SHORT[lv.name] ? SHORT[lv.name] : lv.name), vt));  // the level's name, using the shorter name on small screens where one exists
          });  // ends the loop that draws the levels
          // brackets for the three groups
          const brk = (y1, y2, lines) => [s('path', { d: `M142 ${y1} H132 V${y2} H142`, class: 's-line', 'stroke-width': 1.8 }),  // brk(y1, y2, lines): draws a bracket on the left from y1 to y2 with a two-line label beside it
            mtext(s, 122, (y1 + y2) / 2 - (lines.length - 1) * 8.5 + 5, lines, { 'text-anchor': 'end', 'font-size': 15, 'font-weight': 800 })];  // the label is centred beside the bracket and right-aligned so it ends just left of it
          svg.append(...brk(Y0 + 2, Y0 + 3 * TH + 2 * GAP - 2, ['Inboard', 'memory']),  // bracket around the top three tiers: inboard memory
            ...brk(Y0 + 3 * (TH + GAP) + 2, Y0 + 4 * TH + 3 * GAP - 2, ['Outboard', 'storage']),  // bracket around the fourth tier: outboard storage
            ...brk(Y0 + 4 * (TH + GAP) + 2, Y0 + 5 * TH + 4 * GAP - 2, ['Off-line', 'storage']));  // bracket around the bottom tier: off-line storage
          const arrowLab = s('text', { x: 648, y: 186, 'text-anchor': 'middle', 'font-size': 14.5, 'font-weight': 800, class: 'tx-acc', transform: 'rotate(90 648 186)' });  // the sideways label along the arrow on the right; paint() changes its words with the trend
          svg.append(s('line', { x1: 626, y1: 18, x2: 626, y2: 353, class: 's-line', 'marker-end': 'url(#arr-accent)', style: 'stroke:var(--accent)', 'stroke-width': 2.5 }), arrowLab);  // the long accent-coloured arrow down the right side of the pyramid, plus its label

          const info = h('div', { class: 'card white tight stack gap-s', style: { flex: 'none' } });  // the detail card for the selected level, filled in by paint()
          const tbtns = TRENDS.map((t, i) => h('button', { class: 'btn sm', type: 'button', style: { justifyContent: 'flex-start', width: '100%', whiteSpace: 'normal', height: 'auto', minHeight: '32px', padding: '4px 10px', textAlign: 'left' }, onclick: () => { trend = i; paint(); }, html: '<span>↓ ' + t.lab + '</span>' }));  // one button per trend; clicking it chooses that trend and relabels the pyramid
          function paint() {  // paint(): redraws the selection, the pyramid values and the detail card; runs on every click
            const lv = L[sel], tr = TRENDS[trend];  // lv is the selected level and tr the chosen trend
            polys.forEach((p, i) => p.setAttribute('stroke-width', i === sel ? 4.5 : 2));  // thickens the outline of the selected level and resets the others
            valText.forEach((vt, i) => { vt.textContent = L[i].v[tr.k]; });  // writes each level's value for the chosen trend onto the pyramid
            arrowLab.textContent = 'going down: ' + tr.arrow;  // updates the side arrow label to name the chosen trend
            tbtns.forEach((b, i) => b.classList.toggle('on', i === trend));  // highlights the chosen trend button
            info.innerHTML = `<div class="row" style="justify-content:space-between"><span class="b ${lv.c}" style="font-size:19px">${lv.name}</span>${/* detail card top line: the level name in its colour */''}
                <span class="row gap-s"><span class="chip accent">${GROUP[lv.g]}</span><span class="chip ${lv.vol ? 'warn' : 'ok'}"><span class="t" data-t="${lv.vol ? 'volatile memory' : 'nonvolatile memory'}">${lv.vol ? 'volatile' : 'nonvolatile'}</span></span></span></div>${/* chips for its group (inboard, outboard or off-line) and whether it is volatile or nonvolatile */''}
              <div class="small">${lv.d}</div>${/* the level's description */''}
              <table class="tbl compact"><tbody>${/* a small table of the level's facts */''}
                <tr><td class="b">Capacity</td><td>${lv.cap}</td></tr>${/* table row: capacity */''}
                <tr><td class="b">Access time</td><td>${lv.time}</td></tr>${/* table row: access time */''}
                <tr><td class="b">Cost per bit</td><td>${lv.cost}</td></tr>${/* table row: cost per bit */''}
                <tr><td class="b">Processor uses it</td><td>${lv.freq}</td></tr>${/* table row: how often the processor uses it */''}
                <tr><td class="b">Managed by</td><td>${lv.who}</td></tr></tbody></table>`;  // table row: who manages it; this ends the card's HTML
          }  // ends paint
          el.append(h('div', { class: 'split r fill' },  // lays the step out in two columns, the wider one on the left
            h('div', { class: 'stack gap-s' },  // left column: pyramid and notes
              h('div', { class: 'small', html: 'The brackets group the levels into <span class="t">inboard memory</span>, <span class="t">outboard storage</span> and <span class="t">off-line storage</span>. <span class="muted">Click any level; the trend buttons relabel the pyramid. (Figures approximate.)</span>' }),  // note above the pyramid: the brackets name the three groups; click a level, use the trend buttons
              h('div', { class: 'card white', style: { padding: '6px 10px' } }, svg),  // white card holding the pyramid drawing
              h('div', { class: 'small', html: '<b>Why a pyramid?</b> Each level is wider than the one above: it holds more and costs less per bit, but it is slower and the processor visits it less often. The three outboard cells are alternatives on one level, not steps down. <b>One exception:</b> optical discs (≈&nbsp;5¢ per GB) cost more per bit than magnetic disk (≈&nbsp;2¢), because discs are now a niche medium.' })),  // note: why the shape is a pyramid, and the one exception (optical discs cost more per bit than disk)
            h('div', { class: 'stack gap-s' }, info,  // right column: the detail card
              h('div', { class: 'card tight stack gap-s', style: { flex: 'none' } }, h('h4', { class: 'm0', text: 'Going down the hierarchy' }), ...tbtns))));  // card listing the four trend buttons under the heading "Going down the hierarchy"
          paint();  // fills the drawing once, with main memory selected and the cost trend shown
        },  // ends render() for step 3
      },  // ends step 3
      /* ---------------------------------------------------------------- 4. Scale analogy */
      {  // step 4 starts here
        title: 'Feel the gaps: if a register access took 1 second',  // title of step 4
        kind: 'predict',  // kind "predict": the student guesses before seeing the answer
        render(el, ctx) {  // render() builds step 4 when the student arrives on it
          const { h } = ctx;  // h builds HTML elements
          const CATS = ['Seconds', 'Minutes', 'Hours', 'Days', 'Months', 'Years', 'Millennia'];  // CATS: the time categories the student can guess from, seconds up to millennia
          const REG = 0.3e-9;                                   // one register access, in seconds
          // real = rough typical access time in seconds; stretched = real / REG seconds
          const LV = [  // LV: the seven levels with their real access times and the times stretched so a register access takes 1 s
            { name: 'Register', real: REG, rt: '≈ 0.3 ns', cat: null, st: '1 second', like: 'glancing at a note in your hand', col: 'var(--cpu)' },  // register: 0.3 ns stretched to 1 second, like glancing at a note in your hand (no guess needed)
            { name: 'Cache', real: 1e-9, rt: '≈ 1 ns', cat: 'Seconds', st: '≈ 3.3 seconds', like: 'reaching across your desk', col: 'var(--accent)' },  // cache: about 1 ns becomes about 3.3 seconds, like reaching across your desk
            { name: 'Main memory', real: 100e-9, rt: '≈ 100 ns', cat: 'Minutes', st: '≈ 5.6 minutes', like: 'walking down the hall to a coworker and back', col: 'var(--mem)' },  // main memory: about 100 ns becomes about 5.6 minutes, like walking down the hall and back
            { name: 'Solid-state disk', real: 100e-6, rt: '≈ 100 µs', cat: 'Days', st: '≈ 3.9 days', like: 'waiting for a parcel to arrive by post', col: 'var(--io)' },  // solid-state disk: about 100 microseconds becomes about 3.9 days, like waiting for a parcel
            { name: 'Magnetic disk', real: 5e-3, rt: '≈ 5 ms', cat: 'Months', st: '≈ 6.3 months', like: 'a whole semester, plus summer break', col: 'var(--io)' },  // magnetic disk: about 5 ms becomes about 6.3 months, a semester plus summer break
            { name: 'Optical disc', real: 0.1, rt: '≈ 100 ms', cat: 'Years', st: '≈ 10.6 years', like: 'a child growing from age 5 to 15', col: 'var(--io)' },  // optical disc: about 100 ms becomes about 10.6 years
            { name: 'Magnetic tape', real: 60, rt: '≈ 1 min to wind', cat: 'Millennia', st: '≈ 6,300 years', like: 'all of recorded history, and then some', col: 'var(--io)' },  // magnetic tape: about a minute to wind becomes about 6,300 years
          ];  // closes LV
          const MAXLOG = Math.log10(LV[LV.length - 1].real / REG) + 0.4;  // MAXLOG: the widest bar's length in powers of ten (tape vs register), plus a little so no bar starts at zero
          const barW = (lv) => ((Math.log10(lv.real / REG) + 0.4) / MAXLOG * 100).toFixed(1) + '%';  // barW(lv): the bar length for a level on a log scale (each power of ten adds the same length), as a percentage
          const score = h('span', { class: 'chip accent' });  // the chip that shows the student's score
          let right = 0, answered = 0;  // right counts correct guesses; answered counts how many levels have been guessed
          const rows = LV.map((lv) => {  // builds one table row per level
            const mid = h('div', { class: 'row gap-s' });  // mid holds the guess buttons, and later the stretched time, in the middle column
            const bar = h('i', { style: { background: lv.col } });  // the coloured fill of this row's log-scale bar; it starts empty and grows when the row is revealed
            const row = h('div', { class: 'sc-row' },  // the row itself, laid out in three columns by the sc-row style
              h('div', { class: 'row nw', style: { gap: '8px', justifyContent: 'space-between' } }, h('span', { class: 'b', text: lv.name }), h('span', { class: 'xs muted', text: lv.rt })),  // first column: the level name with its real access time on the right
              mid, h('div', { class: 'sc-bar', title: 'log scale' }, bar));  // second column (mid) and third column (the bar track holding the fill; hovering says "log scale")
            const reveal = (guess) => {  // reveal(guess): runs when the student picks a unit (or presses Reveal all, with no guess) for this row
              const ok = guess === lv.cat;  // ok is true when the guess matches the level's real category
              const mark = guess == null ? '' : ok ? '<b class="c-ok">✓ ' + guess + '.</b> ' : `<b class="c-bad">✗ ${guess}?</b> No, <b>${lv.cat.toLowerCase()}</b>. `;  // mark is a green tick for a right guess, a red cross plus the right answer for a wrong one, or nothing
              mid.innerHTML = `<div class="small">${mark}<b>${lv.st}</b>: like ${lv.like}.</div>`;  // replaces the guess buttons with the mark, the stretched time and the everyday comparison
              bar.style.width = barW(lv);  // grows the bar to its log-scale length
              if (guess != null) { answered++; if (ok) right++; }  // counts the guess, and counts it as right if it matched; revealing without a guess counts nothing
              row.classList.add('done');  // marks the row as finished so it changes look and Reveal all skips it
              paintScore();  // updates the score chip
            };  // ends reveal
            row._reveal = reveal; row._lv = lv;  // stores reveal and the level on the row element so the Reveal all button can reach them
            if (!lv.cat) { mid.innerHTML = `<div class="small"><b>${lv.st}</b>: our starting point, like ${lv.like}.</div>`; ctx.after(60, () => { bar.style.width = barW(lv); }); }  // the register row needs no guess: it shows its 1 second at once and grows its bar just after the page appears
            else mid.append(...CATS.map((c) => h('button', { class: 'btn sm', type: 'button', text: c, onclick: () => reveal(c) })));  // every other row gets one guess button per time category
            return row;  // hands the finished row to the rows list
          });  // ends the loop that builds rows
          function paintScore() { score.textContent = answered ? `Guessed right: ${right} / ${answered}` : 'Make a guess for each row'; }  // paintScore(): shows "Guessed right: x / y", or an invitation before the first guess
          const revealAll = h('button', { class: 'btn sm', type: 'button', text: 'Reveal all', onclick: () => rows.forEach((r) => { if (!r.classList.contains('done')) r._reveal(null); }) });  // Reveal all button: reveals every row not yet finished, without counting a guess
          paintScore();  // shows the starting score text
          el.append(h('div', { class: 'stack fill gap-s' },  // lays the step out as one column that fills the screen
            h('div', { class: 'row', style: { justifyContent: 'space-between', alignItems: 'center', flex: 'none', gap: '10px 18px' } },  // top line: instructions on the left, score and Reveal all on the right
              h('p', { class: 'm0', style: { flex: '1 1 460px', minWidth: '0' }, html: 'Stretch every access time by the <b>same</b> factor (about 3.3 billion) so that a register access lasts <b>one second</b>. Guess the unit for each level, then compare. Real times are rough, typical values.' }),  // instructions: stretch every access time by the same factor so a register access lasts one second
              h('div', { class: 'row nw gap-s', style: { flex: 'none' } }, score, revealAll)),  // the score chip and the Reveal all button, kept together
            h('div', { class: 'sc-row sc-head xs muted b' }, h('div', { text: 'LEVEL · REAL TIME' }), h('div', { text: 'YOUR GUESS, THEN THE STRETCHED TIME' }), h('div', { text: 'LOG-SCALE BAR' })),  // column headings for the table (hidden on small screens)
            h('div', { class: 'stack', style: { gap: '5px', flex: 'none' } }, ...rows),  // the seven level rows, stacked with small gaps
            h('div', { class: 'callout why m0', 'data-label': 'Why it matters', html: 'At this scale a magnetic-disk access lasts months, so the OS does not let the processor sit idle waiting for one. It runs another program meanwhile and lets an interrupt announce that the data has arrived (see Interrupts, 1.4). The gaps also explain why the top levels must handle almost every access.' })));  // callout: at this scale a disk access lasts months, so the OS runs another program and waits for an interrupt
        },  // ends render() for step 4
      },  // ends step 4
      /* ---------------------------------------------------------------- 5. Two-level memory, read by read */
      {  // step 5 starts here
        title: 'A two-level memory, one read at a time',  // title of step 5
        kind: 'learn',  // kind "learn" labels it a Learn screen
        core: true,  // core: true keeps this step on the shorter Core path through the guide
        render(el, ctx) {  // render() builds step 5 when the student arrives on it
          const { h, s } = ctx;  // h builds HTML elements and s builds SVG drawing elements
          const T1 = 0.1, T2 = 1;                         // µs; the strip draws U pixels per 0.1 µs (see G below)
          // 20 reads: a loop reads a[0..3] five times. Only the very first read misses.
          const READS = Array.from({ length: 20 }, (_, r) => ({ n: r + 1, w: r % 4, hit: r !== 0 }));  // READS: the 20 reads, each with its number, which word a[0]-a[3] it reads (w), and whether it hits
          // frame -> how many reads are complete, which read is on screen, and the phase
          const F = [  // F: the animation frames; each says how many reads are finished, which read is shown, and the phase
            { done: 0, cur: null, ph: 'setup' }, { done: 0, cur: 0, ph: 'look' }, { done: 1, cur: 0, ph: 'fetch' },  // frames 0-2: setup, then read 1 looks in level 1, then read 1 fetches from level 2
            { done: 2, cur: 1, ph: 'hit' }, { done: 4, cur: 3, ph: 'hit' }, { done: 8, cur: 7, ph: 'hit' },  // frames 3-5: read 2, then reads up to 4, then up to 8, all hits
            { done: 20, cur: 19, ph: 'hit' }, { done: 20, cur: null, ph: 'sum' }, { done: 20, cur: null, ph: 'rule' },  // frames 6-8: all 20 reads done, then the totals, then the general rule
          ];  // closes F
          const CAP = [  // CAP: the caption for each frame, in the same order as F
            '<b>Setup.</b> A <b>two-level memory</b>, the simplest hierarchy: level 1 is small and fast (T1 = 0.1 µs), level 2 is large and slow (T2 = 1 µs). The processor reads only from level 1. A loop will read the four neighbouring words a[0], a[1], a[2], a[3] five times: <b>20 reads</b>. Level 1 starts empty.',  // caption 0: sets up level 1 (0.1 microseconds), level 2 (1 microsecond) and the loop of 20 reads
            '<b>Read 1: a[0].</b> The processor always looks in level 1 first, which takes T1 = 0.1 µs. Level 1 is empty, so this read is a <span class="t">miss</span>.',  // caption 1: read 1 looks in level 1 first and misses because level 1 is empty
            '<b>Still read 1.</b> The word must come up from level 2, costing another T2 = 1 µs. Level 2 sends the whole <span class="t">block</span> a[0]–a[3] into level 1, and the processor reads a[0] from there. So a miss costs <b>T1 + T2 = 1.1 µs</b>.',  // caption 2: the whole block comes up from level 2, so a miss costs T1 + T2 = 1.1 microseconds
            '<b>Read 2: a[1].</b> Already in level 1: a <span class="t">hit</span>, done in just 0.1 µs. It arrived together with a[0], because a whole block travels up at once: <b>spatial locality</b> paying off.',  // caption 3: read 2 hits because a[1] came up with a[0]: spatial locality
            '<b>Reads 3–4.</b> a[2] and a[3] are hits too. The first pass is over: 4 reads in 1.1 + 0.1 + 0.1 + 0.1 = <b>1.4 µs</b>.',  // caption 4: reads 3 and 4 hit too; the first pass took 1.4 microseconds
            '<b>Reads 5–8.</b> The loop starts again at a[0]. It is still in level 1, so all four reads hit. The same words are used again soon: <b>temporal locality</b>.',  // caption 5: the loop repeats and the same words hit again: temporal locality
            '<b>Reads 9–20.</b> Every one hits. Look at the strip: one long red bar and nineteen short green ones.',  // caption 6: reads 9-20 all hit, so the strip shows one long red bar and nineteen short green ones
            '<b>Totals.</b> 19 hits out of 20 reads, so the <span class="t">hit ratio</span> is <b>H = 19 / 20 = 0.95</b>. Total time = 19 × 0.1 + 1 × 1.1 = 3.0 µs, so the average is <b>3.0 / 20 = 0.15 µs</b> per read.',  // caption 7: 19 hits out of 20 gives H = 0.95 and an average of 0.15 microseconds per read
            '<b>The general rule</b> for the <span class="t">average access time</span>: Ts = H × T1 + (1 − H) × (T1 + T2) = 0.95 × 0.1 + 0.05 × 1.1 = 0.095 + 0.055 = <b>0.15 µs</b>. Without level 1, all 20 reads would take 1 µs each (20 µs), so the small memory made this loop about <b>6.7× faster</b>.',  // caption 8: the general formula gives the same 0.15, about 6.7 times faster than level 2 alone
          ];  // closes CAP
          // geometry: wide canvas (side by side) or phone (stacked)
          const NW = ctx.narrow;  // NW is true on a phone-width screen, where the drawing is stacked instead of side by side
          const G = NW ? {  // G: every position and size in the drawing, chosen for the current layout; this first set is the phone version
            vb: '0 0 420 470', U: 13, sx: 12,  // phone drawing: its coordinate grid, pixels per 0.1 microsecond on the strip (U), and the strip's left edge
            cpu: [8, 10, 132, 112], cpuT: [74, 36, 16], cpuS: [74, 66, 13], cpuB: [74, 100, 22],  // phone: processor box, its title, its status line and its big word slot
            l1: [190, 10, 222, 112], l1T: [301, 32, 15], l1S: [301, 116, 13], slot: [200, 51, 44, 46, 38, 13], l1St: [301, 100, 13],  // phone: level 1 box, title, subtitle, the four word slots and the status line
            l2: [8, 160, 404, 126], l2T: [210, 182, 15], l2S: [210, 279, 13], cell: [30, 45, 192, 19, 39, 15, 12.5], blk: [116, 208, 182, 21],  // phone: level 2 box, title, subtitle, the grid of memory cells, and the block outline
            ar1: [[143, 56, 186, 56], [186, 80, 143, 80]], ar1L: null, ar2: [300, 157, 300, 127], ar2L: [[310, 146, 'start', 'on a miss: + T2']],  // phone: arrows between processor and level 1, and the miss arrow up from level 2 with its label
            stripT: [12, 314, 13, 'Time taken by each read (width = time)'], strip: [322, 32, 343], axis: [360, 380, 12.5], tally: [[12, 412], [12, 436]], hLab: [12, 460, 'start'], fs: 14,  // phone: strip title, strip position, time axis, tally lines, hit-ratio label and base font size
          } : {  // this second set of positions is used on a wide screen, with everything side by side
            vb: '0 0 1100 350', U: 34, sx: 20,  // wide drawing: coordinate grid, pixels per 0.1 microsecond, and the strip's left edge
            cpu: [20, 40, 170, 124], cpuT: [105, 70, 18], cpuS: [105, 102, 14], cpuB: [105, 136, 26],  // wide: processor box, title, status line and word slot
            l1: [300, 30, 280, 144], l1T: [440, 56, 17], l1S: [440, 160, 13.5], slot: [318, 64, 76, 56, 46, 14], l1St: [440, 142, 14.5],  // wide: level 1 box, title, subtitle, word slots and status line
            l2: [690, 10, 392, 186], l2T: [886, 36, 17], l2S: [886, 184, 13.5], cell: [708, 45, 50, 30, 39, 24, 12.5], blk: [794, 76, 182, 32],  // wide: level 2 box, title, subtitle, memory cells and block outline
            ar1: [[194, 92, 294, 92], [294, 116, 194, 116]], ar1L: [[244, 82, 'request'], [244, 138, 'word']], ar2: [686, 104, 586, 104], ar2L: [[636, 92, 'middle', 'on a miss'], [636, 124, 'middle', '+ T2']],  // wide: request and word arrows with labels, and the miss arrow from level 2 with its labels
            stripT: [20, 222, 14.5, 'Time taken by each read (bar width = time)'], strip: [232, 40, 257], axis: [276, 299, 13], tally: [[20, 334], null], hLab: [1080, 334, 'end'], fs: 16,  // wide: strip title, strip position, time axis, tally position, hit-ratio label and base font size
          };  // closes G
          const U = G.U;  // U: pixels per 0.1 microsecond on the time strip, so a hit bar is U wide and a miss bar 11 U
          const svg = s('svg', { viewBox: G.vb, width: '100%', role: 'img', 'aria-label': 'Two-level memory simulation' });  // the drawing area, using the chosen coordinate grid
          const box = ([x, y, w, hh], cls) => s('rect', { x, y, width: w, height: hh, rx: 14, class: cls, 'stroke-width': 2.5 });  // box([x, y, w, h], cls): a rounded rectangle at the given place, in the given colour style
          const txt = ([x, y, fs], str, attrs = {}) => s('text', Object.assign({ x, y, 'text-anchor': 'middle', 'font-size': fs }, attrs), str);  // txt([x, y, size], str): centred text at the given place and size
          svg.append(  // adds the fixed parts of the drawing
            box(G.cpu, 's-cpu'), txt(G.cpuT, 'Processor', { 'font-weight': 800 }),  // processor box and its title
            box(G.l1, 's-accent'), txt(G.l1T, 'Level 1: small, fast', { 'font-weight': 800, class: 'tx-acc' }), txt(G.l1S, 'access time T1 = 0.1 µs', { class: 's-sub' }),  // level 1 box, title and "T1 = 0.1 µs" subtitle
            box(G.l2, 's-mem'), txt(G.l2T, 'Level 2: large, slow', { 'font-weight': 800, class: 'tx-mem' }), txt(G.l2S, 'access time T2 = 1 µs', { class: 's-sub' }),  // level 2 box, title and "T2 = 1 µs" subtitle
            s('text', { x: G.stripT[0], y: G.stripT[1], 'font-size': G.stripT[2], 'font-weight': 700 }, G.stripT[3]));  // the title above the time strip
          const [cx0, cdx, cy0, cdy, cw, chh, cfs] = G.cell;  // unpacks the memory cell grid settings: start, spacing, cell size and font size
          for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) {  // draws level 2's contents as 4 rows of 8 memory cells
            const inA = r === 1 && c >= 2 && c <= 5;  // inA is true for the four cells that hold a[0]-a[3] (row 1, columns 2 to 5)
            svg.append(s('rect', { x: cx0 + c * cdx, y: cy0 + r * cdy, width: cw, height: chh, rx: 4, class: inA ? 's-mem' : 's-panel', 'stroke-width': inA ? 2 : 1 }));  // each cell is a small rectangle; the array cells are drawn in the memory colour with a thicker edge
            if (inA) svg.append(s('text', { x: cx0 + c * cdx + cw / 2, y: cy0 + r * cdy + chh / 2 + cfs * 0.36, 'text-anchor': 'middle', 'font-size': cfs, 'font-weight': 700, class: 's-monot' }, `a[${c - 2}]`));  // the array cells also get their name, a[0] to a[3], in monospace text
          }  // ends the cell grid
          const [axY, axL, axF] = G.axis;  // unpacks the time axis settings: axis line y, label y and label size
          for (let k = 0; k <= 6; k++) {  // draws seven tick marks under the strip, one every half microsecond (0 to 3.0)
            const x = G.sx + k * 5 * U;  // each tick is 5 U apart, which is 0.5 microseconds
            svg.append(s('line', { x1: x, y1: axY, x2: x, y2: axY + 7, class: 's-line', 'stroke-width': 1.5 }),  // the tick mark itself
              s('text', { x, y: axL, 'text-anchor': k === 0 ? 'start' : 'middle', 'font-size': axF, class: 's-sub' }, k === 0 ? '0' : (k * 0.5).toFixed(1) + ' µs'));  // the tick label: "0" at the start, then 0.5 µs, 1.0 µs and so on
          }  // ends the tick loop
          svg.append(s('line', { x1: G.sx, y1: axY, x2: G.sx + 30 * U, y2: axY, class: 's-muted', 'stroke-width': 1.5 }));  // the axis line under the strip, 30 U long (3 microseconds, the total time of all 20 reads)
          const dyn = s('g');  // dyn is a group for everything that changes from frame to frame; draw() empties and refills it
          svg.append(dyn);  // adds that group to the drawing
          function draw(f) {  // draw(f): rebuilds the changing parts of the drawing for frame f
            const fr = F[f], kids = [];  // fr is this frame's record from F; kids collects the new drawing pieces
            const loaded = fr.done >= 1;  // loaded is true once read 1 has finished, because from then on level 1 holds the whole block
            const cur = fr.cur != null ? READS[fr.cur] : null;  // cur is the read shown in this frame, or null on the setup, totals and rule frames
            // processor: which word is being read
            kids.push(txt(G.cpuS, cur ? 'read ' + cur.n + ' wants' : fr.ph === 'setup' ? 'about to run' : 'all done', { class: 's-sub' }),  // the processor box shows what it wants ("read 5 wants"), or "about to run", or "all done"
              txt(G.cpuB, cur ? `a[${cur.w}]` : fr.ph === 'setup' ? '…' : '20 reads', { 'font-weight': 800, class: 's-monot tx-cpu' }));  // and below that the word in large monospace text: a[0]-a[3], "…" before starting, or "20 reads" at the end
            // level-1 slots
            const [sx0, sdx, sy, sw, sh, sfs] = G.slot;  // unpacks the level 1 slot settings: start x, spacing, y, width, height and font size
            for (let i = 0; i < 4; i++) {  // draws the four word slots of level 1
              const isCur = cur && cur.w === i && fr.ph !== 'setup';  // isCur is true for the slot holding the word the current read wants
              const cls = !loaded ? 's-panel' : isCur ? (fr.ph === 'hit' ? 's-ok' : 's-bad') : 's-mem';  // slot colour: grey while empty, green for the word being hit, red for the word just missed, memory colour otherwise
              kids.push(s('rect', { x: sx0 + i * sdx, y: sy, width: sw, height: sh, rx: 8, class: cls, 'stroke-width': isCur ? 3 : 1.5, 'stroke-dasharray': loaded ? null : '5 4' }),  // the slot rectangle, with a thicker edge for the current word and a dashed edge while empty
                s('text', { x: sx0 + i * sdx + sw / 2, y: sy + sh / 2 + sfs * 0.36, 'text-anchor': 'middle', 'font-size': sfs, 'font-weight': 700, class: 's-monot' + (loaded ? '' : ' s-sub') }, loaded ? `a[${i}]` : 'empty'));  // the slot's label: the word's name once loaded, "empty" before
            }  // ends the slot loop
            const st = (str, cls) => kids.push(txt(G.l1St, str, { 'font-weight': 800, class: cls }));  // st(str, cls): writes a bold status line under the level 1 slots in the given colour
            if (fr.ph === 'look') st('a[0] is not here: MISS', 'tx-bad');  // on the "look" frame the status says a[0] is not here: a miss
            if (fr.ph === 'fetch') { st('block a[0]–a[3] copied in', 'tx-mem'); kids.push(s('rect', { x: G.blk[0], y: G.blk[1], width: G.blk[2], height: G.blk[3], rx: 7, fill: 'none', style: 'stroke:var(--mem)', 'stroke-width': 3, 'stroke-dasharray': '6 4' })); }  // on the "fetch" frame the status says the block was copied in, and a dashed outline marks the block in level 2
            if (fr.ph === 'hit' && cur) st(`a[${cur.w}] found: HIT`, 'tx-ok');  // on a hit frame the status names the word that was found
            // arrows: processor <-> level 1, level 1 <-> level 2
            const a1 = fr.ph === 'look' || fr.ph === 'hit' || fr.ph === 'fetch';  // a1 is true when the processor is talking to level 1 in this frame
            G.ar1.forEach(([x1, y1, x2, y2], k) => {  // draws the two arrows between the processor and level 1 (request going out, word coming back)
              const on = a1 && (k === 0 || fr.ph !== 'look');  // the request arrow lights up whenever level 1 is in use; the word arrow waits until the data exists
              kids.push(s('line', { x1, y1, x2, y2, class: 's-line', 'stroke-width': on ? 3 : 1.5, 'marker-end': 'url(#arr-cpu)', style: on ? 'stroke:var(--cpu)' : '' }));  // a lit arrow is thicker and drawn in the processor colour; an unlit one is thin and grey
            });  // ends the arrow loop
            (G.ar1L || []).forEach(([x, y, str]) => kids.push(s('text', { x, y, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, str)));  // adds the "request" and "word" labels by the arrows (only in the wide layout, where there is room)
            const a2 = fr.ph === 'fetch';  // a2 is true only on the fetch frame, when level 2 sends the block up
            const [bx1, by1, bx2, by2] = G.ar2;  // unpacks the start and end points of the arrow from level 2 to level 1
            kids.push(s('line', { x1: bx1, y1: by1, x2: bx2, y2: by2, class: 's-line', 'stroke-width': a2 ? 4 : 1.5, 'marker-end': a2 ? 'url(#arr-mem)' : 'url(#arr-muted)', style: a2 ? 'stroke:var(--mem)' : 'stroke:var(--line-2)' }));  // that arrow is thick and memory-coloured during the fetch, thin and grey otherwise
            G.ar2L.forEach(([x, y, anc, str]) => kids.push(s('text', { x, y, 'text-anchor': anc, 'font-size': 13, class: a2 ? 'tx-mem' : 's-sub', 'font-weight': a2 ? 800 : 400 }, str)));  // its labels ("on a miss", "+ T2") are bold and coloured during the fetch, plain otherwise
            // time strip
            const [sy0, shh, sty] = G.strip;  // unpacks the strip settings: bar top, bar height and label line
            let x = G.sx;  // x is where the next bar starts; the bars sit end to end, so position shows elapsed time
            READS.forEach((rd, r) => {  // goes through the 20 reads, adding a bar for each finished read
              const partial = fr.ph === 'look' && r === 0;  // partial marks read 1 while it is still looking in level 1, before the fetch
              if (r >= fr.done && !partial) return;  // skips reads that have not happened yet in this frame
              const w = partial ? U : rd.hit ? U : 11 * U;  // bar width shows time: U for a hit (0.1 microsecond), 11 U for the miss (1.1 microseconds)
              kids.push(s('rect', { x: x + 1, y: sy0, width: w - 2, height: shh, rx: NW ? 3 : 5, class: partial ? 's-warn' : rd.hit ? 's-ok' : 's-bad', 'stroke-width': 1.5, 'stroke-dasharray': partial ? '4 3' : null }));  // draws the bar: dashed yellow while in progress, green for a hit, red for the miss
              if (!NW || !(rd.hit || partial)) kids.push(s('text', { x: x + w / 2, y: sty, 'text-anchor': 'middle', 'font-size': rd.hit ? 13 : NW ? 12.5 : 14, 'font-weight': 700 }, rd.hit || partial ? String(rd.n) : NW ? 'read 1: miss, 1.1 µs' : 'read 1: miss, 1.1 µs'));  // labels each bar with its read number; the miss bar says "read 1: miss, 1.1 µs" (phones label only the miss)
              x += w;  // moves x to the end of this bar
            });  // ends the strip loop
            // tally
            const done = fr.done, hits = READS.slice(0, done).filter((r) => r.hit).length, miss = done - hits;  // counts the finished reads, the hits among them, and the misses
            const tot = hits * T1 + miss * (T1 + T2) + (fr.ph === 'look' ? T1 : 0);   // while looking, T1 is already spent
            const items = [['Reads', done], ['Hits', hits], ['Misses', miss], [NW ? 'Time' : 'Time so far', tot.toFixed(1) + ' µs'], [NW ? 'Average' : 'Average per read', done ? fmt(tot / done, 3) + ' µs' : '—']];  // the tally items: reads, hits, misses, time so far and average per read (shorter names on phones)
            const lines = NW ? [items.slice(0, 3), items.slice(3)] : [items];  // phones split the tally over two lines; the wide layout uses one
            lines.forEach((ln, li) => {  // writes each tally line as one SVG text element
              const tl = s('text', { x: G.tally[li][0], y: G.tally[li][1], 'font-size': G.fs });  // the text element, placed at this line's tally position
              ln.forEach(([k, v], i) => tl.append(s('tspan', { class: 's-sub', dx: i ? (NW ? 16 : 26) : 0 }, k), s('tspan', { 'font-weight': 800, dx: 6 }, String(v))));  // each item is a grey name followed by its bold value, spaced apart
              kids.push(tl);  // adds the line to this frame's pieces
            });  // ends the tally loop
            if (fr.ph === 'sum' || fr.ph === 'rule') kids.push(s('text', { x: G.hLab[0], y: G.hLab[1], 'text-anchor': G.hLab[2], 'font-size': G.fs, 'font-weight': 800, class: 'tx-acc' }, 'H = 19 / 20 = 0.95'));  // on the totals and rule frames, shows "H = 19 / 20 = 0.95" in the accent colour
            dyn.replaceChildren(...kids);  // swaps the old changing pieces for this frame's pieces in one go
          }  // ends draw
          const player = ctx.ui.player({ count: F.length, render: (i) => { draw(i); return CAP[i]; }, interval: 2600 });  // the frame player (Play, Next, Back, speed, a guide helper): each frame redraws and returns its caption
          el.append(h('div', { class: 'stack fill' }, h('div', { class: 'card white', style: { padding: '8px 12px', flex: 'none' } }, svg), player.el));  // lays out the drawing card above the player
        },  // ends render() for step 5
      },  // ends step 5
      /* ---------------------------------------------------------------- 6. Calculator */
      {  // step 6 starts here
        title: 'Average access time calculator',  // title of step 6
        kind: 'explore',  // kind "explore" labels it an Explore screen
        render(el, ctx) {  // render() builds step 6 when the student arrives on it
          const { h, s } = ctx;  // h builds HTML elements and s builds SVG drawing elements
          let H = 0.95, T1 = 0.1, T2 = 1;  // the calculator's values, starting at the worked example: H = 0.95, T1 = 0.1, T2 = 1 (microseconds)
          const n2 = (v) => fmt(v, 2), n4 = (v) => fmt(v, 4);  // n2 and n4 format a number with up to 2 or 4 decimal places
          const sH = ctx.ui.slider({ label: '<span class="t" data-t="hit ratio">Hit ratio</span> H', min: 0, max: 1, step: 0.01, value: H, format: (v) => v.toFixed(2), onInput: (v) => { H = v; paint(); } });  // hit ratio slider from 0 to 1; moving it updates H and repaints
          const sT1 = ctx.ui.slider({ label: 'T1 (level 1)', min: 0.01, max: 0.5, step: 0.01, value: T1, format: (v) => v.toFixed(2) + ' µs', onInput: (v) => { T1 = v; paint(); } });  // T1 slider (level 1 access time) from 0.01 to 0.5 microseconds
          const sT2 = ctx.ui.slider({ label: 'T2 (level 2)', min: 0.5, max: 10, step: 0.1, value: T2, format: (v) => v.toFixed(1) + ' µs', onInput: (v) => { T2 = v; paint(); } });  // T2 slider (level 2 access time) from 0.5 to 10 microseconds
          const preset = (label, h1, t1, t2, cls = 'btn sm') => h('button', { class: cls, type: 'button', html: label, onclick: () => { H = h1; T1 = t1; T2 = t2; sH.set(H); sT1.set(T1); sT2.set(T2); paint(); } });  // preset(label, ...): a button that loads a ready-made set of H, T1 and T2 into the sliders and repaints
          const formula = h('div', { class: 'card white tight mono', style: { fontSize: '15.5px', lineHeight: '1.65' } });  // the worked formula card, in monospace so the lines of the working line up
          const outTs = h('div', { class: 'big', style: { fontSize: '32px' } });  // the big average access time number
          const outSlow = h('div', { class: 'big', style: { fontSize: '26px' } });  // the "how much slower than level 1" number
          const outFast = h('div', { class: 'big', style: { fontSize: '26px' } });  // the "how much faster than level 2" number
          const fastSub = h('div', { class: 'xs muted' });  // small note under the faster number
          const tip = h('div', { class: 'callout tip m0 small', 'data-label': 'What the graph shows' });  // the tip box under the graph that explains what it shows
          // graph: Ts against H. zoom = the smallest H shown (0 = full range, 0.8 = zoom on the useful region)
          let zoom = 0;  // zoom is the smallest H on the graph's horizontal axis: 0 shows the full range, 0.8 zooms in
          const NW = ctx.narrow, VBW = NW ? 420 : 640, VBH = NW ? 318 : 398;  // NW is true on a phone-width screen; the drawing's width and height are chosen to match
          const X0 = NW ? 52 : 74, X1 = VBW - 28, Y0 = 24, Y1 = VBH - 54;  // the plotting area's edges: left, right, top and bottom inside the drawing
          const svg = s('svg', { viewBox: `0 0 ${VBW} ${VBH}`, width: '100%', role: 'img', 'aria-label': 'Average access time versus hit ratio' });  // the graph drawing
          const gx = (hh) => X0 + (X1 - X0) * (hh - zoom) / (1 - zoom);  // gx(hh): the x position of hit ratio hh on the graph, taking the zoom into account
          const axes = s('g'), dyn = s('g');  // axes holds the H-axis ticks and labels; dyn holds the line, reference lines and markers; paint() redraws both
          svg.append(axes, dyn,  // adds both groups and the fixed axis lines and titles
            s('line', { x1: X0, y1: Y1, x2: X1 + 6, y2: Y1, class: 's-line', 'stroke-width': 1.5 }),  // the horizontal axis line
            s('line', { x1: X0, y1: Y1, x2: X0, y2: Y0 - 8, class: 's-line', 'stroke-width': 1.5 }),  // the vertical axis line
            s('text', { x: (X0 + X1) / 2, y: VBH - 7, 'text-anchor': 'middle', 'font-size': 14.5, 'font-weight': 700 }, NW ? 'Hit ratio H' : 'Hit ratio H  (fraction of accesses found in level 1)'),  // horizontal axis title (shorter on phones)
            s('text', { x: 16, y: (Y0 + Y1) / 2, 'text-anchor': 'middle', 'font-size': 14.5, 'font-weight': 700, transform: `rotate(-90 16 ${(Y0 + Y1) / 2})` }, NW ? 'Ts (µs)' : 'Average access time Ts (µs)'));  // vertical axis title, turned sideways (shorter on phones)
          const legCur = h('span');  // legend entry for the current point; paint() fills it
          const legEx = h('span', { html: '<span style="display:inline-block;width:12px;height:12px;border:2px dashed var(--warn);border-radius:50%;vertical-align:-1px"></span> worked example: <b class="c-warn">H = 0.95 → Ts = 0.15 µs</b>' });  // legend entry for the worked example: a dashed circle marking H = 0.95, Ts = 0.15
          const zoomSeg = ctx.ui.seg([{ value: 0, label: 'H from 0 to 1' }, { value: 0.8, label: 'Zoom: H from 0.8 to 1' }], 0, (v) => { zoom = v; paint(); });  // buttons to switch between the full range of H and a zoom on 0.8 to 1
          function paint() {  // paint(): recalculates the formula, the readouts and the graph; runs on every slider move or button
            const Ts = avgTime(H, T1, T2), yMax = avgTime(zoom, T1, T2) * 1.12;  // Ts is the average time now; yMax is the graph's top, a little above the slowest time shown
            const gy = (v) => Y1 - (Y1 - Y0) * v / yMax;  // gy(v): the y position of time v on the graph
            const miss = 1 - H;  // miss is the miss ratio, 1 - H
            formula.innerHTML = `Ts = H × T1 + (1 − H) × (T1 + T2)<br>${/* formula line 1: the general rule */''}
              &nbsp;&nbsp; = <b class="c-acc">${n2(H)}</b> × <b class="c-cpu">${n2(T1)}</b> + <b class="c-bad">${n2(miss)}</b> × (<b class="c-cpu">${n2(T1)}</b> + <b class="c-mem">${fmt(T2, 1)}</b>)<br>${/* formula line 2: the same rule with the current values filled in, each colour-coded */''}
              &nbsp;&nbsp; = ${n4(H * T1)} + ${n4(miss * (T1 + T2))}<br>${/* formula line 3: the hit part and the miss part worked out */''}
              &nbsp;&nbsp; = <b class="c-acc" style="font-size:18px">${n4(Ts)} µs</b>`;  // formula line 4: the result in large accent-coloured text; this ends the formula's HTML
            outTs.textContent = n4(Ts) + ' µs';  // shows the result in the big readout
            outSlow.textContent = fmt(Ts / T1, 2) + '×';  // how many times slower than level 1 alone the average is
            outFast.textContent = fmt(T2 / Ts, 1) + '×';  // how many times faster than level 2 alone the average is
            fastSub.textContent = T2 / Ts >= 1 ? 'T2 ÷ Ts: faster' : 'slower than level 2 alone!';  // note under the "vs level 2" number: normally "faster", but a warning if the settings make things slower
            const hMin = 1 - T1 / T2;  // hMin: the smallest hit ratio that keeps Ts within twice T1 (from solving the formula), quoted in the tip
            tip.innerHTML = T1 >= T2  // the tip box text depends on whether level 1 is actually faster than level 2
              ? `<b>Level 1 is no faster than level 2 here</b> (T1 = ${n2(T1)} µs, T2 = ${fmt(T2, 1)} µs), so it cannot help: every miss even pays for both. A real hierarchy puts the <b>faster</b> memory on top. Raise T2 or lower T1.`  // if T1 is not smaller than T2, the tip explains that level 1 cannot help and every miss pays for both
              : `The line is <b>straight</b>: each 0.01 drop in H adds 0.01 × T2 = ${fmt(0.01 * T2, 3)} µs. It runs from T1 + T2 at H = 0 down to T1 at H = 1. To keep Ts within <b>2 × T1</b>, H must be at least 1 − T1/T2 = <b>${hMin.toFixed(2)}</b>.`;  // otherwise it explains that the line is straight and states the minimum H needed to stay near level 1 speed
            // x ticks for the current range
            const ax = [];  // ax collects the tick marks and labels for the horizontal axis
            const step = zoom ? 0.02 : 0.1;  // ticks every 0.02 when zoomed in, every 0.1 for the full range
            for (let v = zoom; v <= 1.0001; v += step) {  // walks from the left end of the axis to H = 1 (the tiny extra allows for rounding in the repeated additions)
              const x = gx(v), major = zoom ? (!NW || Math.round(v * 100) % 4 === 0) : Math.round(v * 10) % 2 === 0;  // x is the tick's position; major picks labelled ticks: all of them when zoomed on a wide screen, else every other one
              ax.push(s('line', { x1: x, y1: Y1, x2: x, y2: Y1 + 6, class: 's-line', 'stroke-width': 1.2 }));  // the small tick line under the axis
              if (major) ax.push(s('text', { x, y: Y1 + 22, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, v.toFixed(zoom ? 2 : 1)));  // the tick label, with 2 decimals when zoomed and 1 otherwise
            }  // ends the tick loop
            axes.replaceChildren(...ax);  // replaces the old axis ticks with the new ones
            const kids = [];  // kids collects the rest of the changing graph pieces
            // dashed reference lines: T1 (the best possible) and, when visible, T1 + T2 (every access misses)
            const refs = [[T1, 'T1 = ' + n2(T1) + (NW ? '' : ' (every access hits)')]];  // refs: horizontal dashed lines to draw; T1 (every access hits) is always shown
            if (!zoom) refs.push([T1 + T2, 'T1 + T2 = ' + n2(T1 + T2) + (NW ? '' : ' (every access misses)')]);  // the T1 + T2 line (every access misses) is added only for the full range, since the zoom cuts it off
            refs.forEach(([v, lab], i) => {  // draws each reference line
              kids.push(s('line', { x1: X0, y1: gy(v), x2: X1, y2: gy(v), class: 's-muted', 'stroke-dasharray': '5 5', 'stroke-width': 1.3 }),  // the dashed line across the graph at that time
                s('text', { x: X0 - 6, y: gy(v) + 4, 'text-anchor': 'end', 'font-size': 12.5, class: 's-sub' }, fmt(v, 2)),  // its value, written on the vertical axis
                s('text', { x: i === 0 ? X0 + 8 : X1 - 4, y: gy(v) - 7, 'text-anchor': i === 0 ? 'start' : 'end', 'font-size': 13, class: 's-sub' }, lab));  // its label just above the line: on the left for T1, on the right for T1 + T2
            });  // ends the reference line loop
            if (gy(T1) < Y1 - 16) kids.push(s('text', { x: X0 - 6, y: Y1 + 4, 'text-anchor': 'end', 'font-size': 12.5, class: 's-sub' }, '0'));  // writes "0" at the bottom of the vertical axis unless the T1 line sits too close to it
            const top = avgTime(zoom, T1, T2);  // top is the time at the left edge of the graph (H = zoom), the highest point of the line
            kids.push(s('text', { x: X0 - 6, y: gy(top) + 4, 'text-anchor': 'end', 'font-size': 12.5, class: 's-sub' }, zoom ? fmt(top, 2) : ''));  // when zoomed, also labels that top value on the vertical axis
            kids.push(s('line', { x1: gx(zoom), y1: gy(top), x2: gx(1), y2: gy(T1), class: 's-line', 'stroke-width': 3, style: 'stroke:var(--accent)' }));  // draws the line of Ts against H, from the left edge down to T1 at H = 1; it is straight because the formula is
            const exOn = Math.abs(T1 - 0.1) < 1e-9 && Math.abs(T2 - 1) < 1e-9;  // exOn is true when T1 and T2 match the worked example (0.1 and 1)
            if (exOn) kids.push(s('circle', { cx: gx(0.95), cy: gy(0.15), r: 12, fill: 'none', style: 'stroke:var(--warn)', 'stroke-width': 2.5, 'stroke-dasharray': '4 3' }));  // if so, a dashed circle marks the worked example point H = 0.95, Ts = 0.15
            legEx.style.visibility = exOn ? 'visible' : 'hidden';  // the worked example's legend entry shows only while its circle is drawn
            legCur.innerHTML = `<b class="c-acc">●</b> your setting: <b class="c-acc">H = ${H.toFixed(2)} → Ts = ${n4(Ts)} µs</b>`;  // legend entry for the student's current point, with its H and Ts
            if (H >= zoom - 1e-9) {  // if the current H is inside the visible range, mark it on the line
              const px = gx(H), py = gy(Ts);  // px and py: where the current point sits on the graph
              kids.push(s('line', { x1: px, y1: py, x2: px, y2: Y1, class: 's-muted', 'stroke-dasharray': '3 4', style: 'stroke:var(--accent)', 'stroke-width': 1.5 }),  // a dotted line down from the point to the axis, so its H value can be read off
                s('circle', { cx: px, cy: py, r: 8, class: 's-accent', 'stroke-width': 3 }));  // the point itself, a filled accent-coloured dot
            } else {  // otherwise (H is below the zoomed range)
              kids.push(s('text', { x: X0 + 12, y: Y0 + 14, 'font-size': 14, 'font-weight': 700, class: 'tx-warn' }, `H = ${H.toFixed(2)} is left of this zoomed view`));  // a warning at the top of the graph that the current H is off to the left of the zoomed view
            }  // ends the in-range check
            dyn.replaceChildren(...kids);  // swaps in all the new graph pieces
          }  // ends paint
          const readout = (lab, out, sub) => h('div', { class: 'card tight center' }, h('h4', { text: lab }), out, typeof sub === 'string' ? h('div', { class: 'xs muted', text: sub }) : sub);  // readout(lab, out, sub): a small card with a heading, a big number and a note (text or an element)
          el.append(h('div', { class: 'split l fill' },  // lays the step out in two columns: controls on the left, graph on the right
            h('div', { class: 'stack gap-s' },  // left column
              sH, sT1, sT2,  // the three sliders: H, T1 and T2
              h('div', { class: 'row gap-s' }, h('span', { class: 'xs muted b', text: 'TRY:' }), preset('Worked example', 0.95, 0.1, 1, 'btn sm primary'), preset('H = 0.5', 0.5, 0.1, 1), preset('H = 0.99', 0.99, 0.1, 1), preset('Slow level 2', 0.95, 0.1, 10)),  // preset buttons: the worked example, H = 0.5, H = 0.99, and a ten times slower level 2
              h('div', { class: 'row gap-s' }, h('span', { class: 'xs muted b', text: 'GRAPH:' }), zoomSeg),  // the buttons that switch the graph between the full range and the zoom
              formula,  // the worked formula card
              h('div', { class: 'grid-3', style: { gap: '8px' } }, readout('Average Ts', outTs, 'per access'), readout('vs level 1', outSlow, 'Ts ÷ T1: slower'), readout('vs level 2', outFast, fastSub)),  // three readouts: the average Ts, how much slower than level 1, and how much faster than level 2
              h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'A miss costs <b>T1 + T2</b>, not just T2: the processor already spent T1 looking in level 1 before it went down to level 2.' })),  // callout: the common mistake of charging a miss only T2 instead of T1 + T2
            h('div', { class: 'stack gap-s' }, h('div', { class: 'card white', style: { padding: '8px 10px 6px', flex: 'none' } }, svg,  // right column: white card with the graph
              h('div', { class: 'row small', style: { justifyContent: 'center', gap: '22px' } }, legCur, legEx)), tip)));  // the legend under the graph, followed by the tip box
          paint();  // draws everything once with the worked example values
        },  // ends render() for step 6
      },  // ends step 6
      /* ---------------------------------------------------------------- 7. Locality lab */
      {  // step 7 starts here
        title: 'Locality lab: why most accesses hit',  // title of step 7
        kind: 'lab',  // kind "lab" labels it a Hands-on Lab
        core: true,  // core: true keeps this step on the Core path
        render(el, ctx) {  // render() builds step 7 when the student arrives on it
          const { h, s } = ctx;  // h builds HTML elements and s builds SVG drawing elements
          const PAT = {  // PAT: the five access patterns the student can choose, each with a button label and an explanation note
            loop: { label: 'Loop', note: 'An 8-instruction loop (addresses 64–71) runs 8 times: <b>temporal locality</b>. Only the first pass can miss. Pick block size 1 word and 8 blocks: pass 1 misses all 8 instructions, then every later pass hits. Now drop to 7 blocks: the loop no longer fits, each instruction is thrown out just before it is needed again, and the hits vanish.' },  // loop pattern note: temporal locality, and what happens when the loop no longer fits in fast memory
            array: { label: 'Array scan', note: 'A 3-instruction loop adds up an array that starts at address 160. The code repeats (<b>temporal</b>); the data marches forward one word at a time (<b>spatial</b>). Try block size 1: every array element misses.' },  // array scan note: the code repeats (temporal) while the data moves forward (spatial)
            sub: { label: 'Subroutine', note: 'The main program walks forward and calls the same 6-instruction subroutine (addresses 200–205) on every pass. The subroutine stays in fast memory because it keeps being reused.' },  // subroutine note: the same subroutine stays in fast memory because it keeps being reused
            seq: { label: 'Straight-line', note: 'Instructions run one after another with no loop: only <b>spatial</b> locality helps. Each miss brings the next few instructions along, so bigger blocks mean fewer misses. With block size 1, nothing ever hits.' },  // straight-line note: only spatial locality helps, so bigger blocks mean fewer misses
            rand: { label: 'Random', note: 'Addresses picked at random from all of memory: <b>no locality</b>. Almost every access misses, whatever you change. Real programs look nothing like this, which is exactly why hierarchies work.' },  // random note: no locality, so almost every access misses whatever the settings
          };  // closes PAT
          let pat = 'loop', B = 4, N = 4, sim = [];  // current choices: pattern, block size B (words per block) and number of blocks N; sim holds the replay results
          const NW = ctx.narrow, VBW = NW ? 420 : 660, VBH = NW ? 250 : 300;  // NW is true on a phone-width screen; the drawing's width and height are chosen to match
          const PX0 = NW ? 50 : 56, PX1 = VBW - 12, PY0 = 12, PY1 = VBH - 46, DOT = NW ? 3 : 4.2;  // the plot area's edges inside the drawing, and the dot radius
          const xOf = (t) => PX0 + (PX1 - PX0) * (t + 0.5) / LOC_N;  // xOf(t): the x position of reference number t (0-63), centred in its column
          const yOf = (a) => PY1 - (PY1 - PY0) * (a + 0.5) / 256;  // yOf(a): the y position of address a (0-255); higher addresses are drawn higher up
          const svg = s('svg', { viewBox: `0 0 ${VBW} ${VBH}`, width: '100%', role: 'img', 'aria-label': 'Memory address against time' });  // the drawing: memory address (up) against time (across)
          svg.append(s('rect', { x: PX0, y: PY0, width: PX1 - PX0, height: PY1 - PY0, class: 's-panel', 'stroke-width': 1 }));  // the plot area's grey background
          [0, 64, 128, 192, 255].forEach((a) => svg.append(s('text', { x: PX0 - 6, y: yOf(a) + 4, 'text-anchor': 'end', 'font-size': NW ? 11.5 : 12.5, class: 's-sub' }, String(a))));  // address labels on the vertical axis: 0, 64, 128, 192 and 255
          [1, 16, 32, 48, 64].forEach((n) => svg.append(s('text', { x: xOf(n - 1), y: PY1 + 17, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, String(n))));  // reference number labels on the horizontal axis: 1, 16, 32, 48 and 64
          svg.append(s('text', { x: (PX0 + PX1) / 2, y: VBH - 6, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700 }, 'Reference number (time →)'),  // horizontal axis title: reference number, time moving right
            s('text', { x: 12, y: (PY0 + PY1) / 2, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700, transform: `rotate(-90 12 ${(PY0 + PY1) / 2})` }, 'Address'));  // vertical axis title "Address", turned sideways
          const dyn = s('g');  // dyn is a group for the dots and bands, rebuilt by draw() on every step
          svg.append(dyn);  // adds that group to the drawing
          const slotsRow = h('div', { class: 'row gap-s' });  // the row of chips under the drawing that shows what each fast memory slot holds
          const stats = h('div', { class: 'row gap-s' });  // the row of hit, miss and hit ratio counters
          const note = h('div', { class: 'card tight small' });  // the note card that explains the chosen pattern
          const range = (blk) => (B === 1 ? String(blk) : `${blk * B}–${blk * B + B - 1}`);  // range(blk): the addresses a block covers, such as "8–11" for block 2 with 4-word blocks
          function draw(i) {  // draw(i): redraws the lab after the first i references; runs on every player step
            const kids = [];  // kids collects the new drawing pieces
            const last = i > 0 ? sim[i - 1] : null;  // last is the record for the most recent reference, or null before the first one
            // bands: the blocks sitting in fast memory right now
            (last ? last.resident : []).forEach((blk) => {  // for each block held in fast memory, draw a pale band across the plot at that block's addresses
              const yTop = yOf(blk * B + B - 1) - (PY1 - PY0) * 0.5 / 256, yBot = yOf(blk * B) + (PY1 - PY0) * 0.5 / 256;  // the band's top and bottom, padded by half an address on each side
              kids.push(s('rect', { x: PX0 + 1, y: Math.min(yTop, (yTop + yBot) / 2 - 1.5), width: PX1 - PX0 - 2, height: Math.max(3, yBot - yTop), style: 'fill:var(--accent);opacity:.16' }));  // the band itself, at least 3 units tall so a 1-word block is still visible
            });  // ends the band loop
            sim.slice(0, i).forEach((r, t) => kids.push(s('circle', { cx: xOf(t), cy: yOf(r.a), r: DOT, class: r.hit ? 's-ok' : 's-bad', 'stroke-width': 1.4 })));  // one dot per reference so far, at its time and address: green for a hit, red for a miss
            if (last) kids.push(s('circle', { cx: xOf(i - 1), cy: yOf(last.a), r: DOT * 2, fill: 'none', style: 'stroke:var(--accent)', 'stroke-width': 2.5 }));  // a larger ring around the latest reference so the student can see which one just happened
            dyn.replaceChildren(...kids);  // swaps the new pieces into the drawing
            // fast-memory slots
            const res = last ? last.resident : [];  // res lists the blocks now in fast memory
            slotsRow.replaceChildren(h('span', { class: 'xs muted b', text: `FAST MEMORY, ${N} × ${B}:` }),  // slot row: a label giving the fast memory's size (N blocks of B words)
              ...Array.from({ length: N }, (_, k) => h('span', { style: { fontSize: '12px', padding: '0 7px' }, class: 'chip mono ' + (res[k] != null ? (last && res[k] === last.blk ? (last.hit ? 'ok' : 'bad') : 'accent') : ''), text: res[k] != null ? range(res[k]) : 'empty' })));  // one chip per slot: its address range, green or red if it holds the block just used, accent if another, else "empty"
            const hits = last ? last.hits : 0, miss = last ? last.misses : 0;  // running hit and miss totals, read from the latest reference's record (zero before the first)
            const Hr = i ? hits / i : 0;  // Hr is the hit ratio so far: hits divided by references made
            stats.innerHTML = `<span class="chip">refs ${i}</span><span class="chip ok">hits ${hits}</span><span class="chip bad">misses ${miss}</span>${/* counter chips: references made, hits and misses */''}
              <span class="chip accent">H = ${i ? Hr.toFixed(3) : '—'}</span><span class="chip">Ts = ${i ? fmt(avgTime(Hr, 0.1, 1), 3) + ' µs' : '—'} <span class="muted" style="font-weight:600">(T1 = 0.1, T2 = 1)</span></span>`;  // more chips: the hit ratio and the average time it gives with T1 = 0.1 and T2 = 1; this ends the chips' HTML
            if (!last) return `<b>${PAT[pat].label}.</b> ${LOC_N} memory references are ready. Press play (or step) and watch where they land. Red = miss, green = hit; the shaded bands are the blocks now in fast memory.`;  // before the first reference, the caption introduces the chosen pattern and explains the colours and bands
            if (i === LOC_N) return `<b>Done.</b> ${hits} of ${LOC_N} references hit, so <b>H = ${hits}/${LOC_N} ≈ ${Hr.toFixed(3)}</b> and the average access time is <b>${fmt(avgTime(Hr, 0.1, 1), 3)} µs</b> (level 1 alone: 0.1 µs). ${Hr > 0.85 ? `Only ${miss} of ${LOC_N} references had to go down to the slow level: locality keeps its share of the work tiny.` : Hr > 0.5 ? `Locality helps, but ${miss} of ${LOC_N} references (${Math.round(miss / LOC_N * 100)}%) still went down to the slow level.` : 'Little usable locality with these settings: most accesses go to the slow level.'}`;  // after the last reference, the caption gives the final H and Ts and says how much locality helped
            if (last.hit) return `Ref ${i}: address <b>${last.a}</b> is in block ${range(last.blk)}, already in fast memory: <b>hit</b>. ${last.kind === 'temporal' ? 'This exact address was used before (temporal locality).' : 'Never used before, but it came up with a neighbour (spatial locality).'}`;  // caption for a hit: names the address and block, and says whether it was temporal or spatial locality
            return `Ref ${i}: address <b>${last.a}</b> is not in fast memory: <b>miss</b>. Block ${range(last.blk)} is copied up from the slow level${last.victim != null ? `, replacing block ${range(last.victim)}, the one unused the longest` : ''}.`;  // caption for a miss: the block is copied up, and names the block it replaced (the one unused the longest)
          }  // ends draw
          const player = ctx.ui.player({ count: LOC_N + 1, render: draw, interval: 360 });  // the player that steps through the 64 references (plus the starting frame), quickly when playing
          function rerun() { sim = locSimulate(locPattern(pat), B, N); note.innerHTML = PAT[pat].note; player.setCount(LOC_N + 1, true); }  // rerun(): replays the chosen pattern with the current block size and slot count, updates the note, keeps the position
          const segPat = ctx.ui.seg(Object.entries(PAT).map(([k, v]) => ({ value: k, label: v.label })), pat, (v) => { pat = v; rerun(); });  // pattern buttons; choosing one replays the lab with that pattern
          const segB = ctx.ui.seg([{ value: 1, label: '1 word' }, { value: 4, label: '4 words' }, { value: 8, label: '8 words' }], B, (v) => { B = v; rerun(); });  // block size buttons (1, 4 or 8 words); choosing one replays the lab
          const slN = ctx.ui.slider({ label: 'Fast memory size', min: 1, max: 8, step: 1, value: N, format: (v) => v + (v === 1 ? ' block' : ' blocks'), onInput: (v) => { N = v; rerun(); } });  // slider for how many blocks the fast memory holds (1 to 8); moving it replays the lab
          const toEnd = h('button', { class: 'btn sm', type: 'button', text: 'Jump to end', onclick: () => { player.stop(); player.go(LOC_N); } });  // Jump to end button: stops playing and shows the final state after all 64 references
          player.el.querySelector('.player-ctl').append(toEnd);  // adds the Jump to end button to the player's row of controls
          el.append(h('div', { class: 'split l fill' },  // lays the step out in two columns: explanation and controls on the left, the plot on the right
            h('div', { class: 'stack gap-s' },  // left column
              h('p', { class: 'm0', html: 'Programs do not touch memory at random. Over any short stretch of time their references <b>cluster</b> in a few small areas, and those areas drift slowly. This is <span class="t">locality of reference</span>.' }),  // opening paragraph: references cluster in a few small areas that drift slowly, which is locality of reference
              h('div', { class: 'grid-2', style: { gap: '8px' } },  // two cards side by side, one per kind of locality
                h('div', { class: 'card tight small', html: '<b class="c-acc"><span class="t">Temporal locality</span></b><br>The <b>same</b> address is used again soon: loop instructions, counters, a subroutine called repeatedly.' }),  // card: temporal locality means the same address is used again soon
                h('div', { class: 'card tight small', html: '<b class="c-acc"><span class="t">Spatial locality</span></b><br>Addresses <b>next to</b> recent ones are used soon: instructions in sequence, array elements in order.' })),  // card: spatial locality means neighbouring addresses are used soon
              h('div', { class: 'row gap-s' }, h('span', { class: 'xs muted b', text: 'PROGRAM' }), segPat),  // row with the pattern buttons
              h('div', { class: 'row gap-s' }, h('span', { class: 'xs muted b', text: 'BLOCK SIZE' }), segB),  // row with the block size buttons
              slN, note),  // the fast memory size slider and the pattern note
            h('div', { class: 'stack gap-s' },  // right column
              h('div', { class: 'card white', style: { padding: '6px 10px', flex: 'none' } }, svg),  // white card holding the address-against-time plot
              slotsRow, stats, player.el)));  // the slot chips, the counters and the player
          rerun();  // runs the first replay so the lab opens ready to play
        },  // ends render() for step 7
      },  // ends step 7
      /* ---------------------------------------------------------------- 8. The access funnel (three levels) */
      {  // step 8 starts here
        title: 'The funnel: each level down sees far fewer accesses',  // title of step 8
        kind: 'explore',  // kind "explore" labels it an Explore screen
        render(el, ctx) {  // render() builds step 8 when the student arrives on it
          const { h } = ctx;  // h builds HTML elements
          const TOTAL = 1e6;                                   // references issued by the processor
          const TC = 1, TM = 100, TD = 5e6;                    // access times in ns: cache, main memory, magnetic disk (5 ms)
          const ODDS = [100, 1e3, 1e4, 1e5, 1e6, 1e7];         // "1 in N" main-memory accesses must go on to the disk
          let hc = 0.95, oi = 3;  // hc is the cache hit ratio; oi picks the entry in ODDS (3 means 1 in 100,000)
          const num = (x) => (x >= 10 ? Math.round(x).toLocaleString('en-US') : fmt(x, x >= 1 ? 1 : 3));  // num(x): whole numbers with commas for 10 and up, a few decimals for small counts
          const share = (f) => (f >= 0.999 ? 'all of them' : f >= 0.01 ? fmt(f * 100, 1) + '% of all' : '1 in ' + Math.round(1 / f).toLocaleString('en-US'));  // share(f): describes a fraction as "all of them", a percentage, or "1 in N"
          const time = (ns) => (ns >= 1000 ? fmt(ns / 1000, 2) + ' µs' : fmt(ns, 2) + ' ns');  // time(ns): shows a time in nanoseconds, or in microseconds from 1,000 ns up
          const LV = [  // LV: the three levels in the funnel with their colours
            { name: 'Cache', t: '≈ 1 ns each', col: 'accent', c: 'c-acc' },  // level: cache, about 1 ns per access
            { name: 'Main memory', t: '≈ 100 ns each', col: 'mem', c: 'c-mem' },  // level: main memory, about 100 ns per access
            { name: 'Magnetic disk', t: '≈ 5 ms each', col: 'io', c: 'c-io' },  // level: magnetic disk, about 5 ms per access
          ];  // closes LV
          const rows = LV.map((lv) => {  // builds one funnel row per level
            const bar = h('i', { style: { background: `var(--${lv.col})` } });  // the bar fill that shows how many references reach this level
            const out = h('div', { class: 'small' });  // the text on the right that gives the counts
            const row = h('div', { class: 'fn-row' },  // the row itself, laid out in three columns by the fn-row style
              h('div', {}, h('div', { class: 'b ' + lv.c, text: lv.name }), h('div', { class: 'xs muted', text: lv.t })),  // first column: the level name in its colour and its access time
              h('div', { class: 'fn-bar' }, bar), out);  // second column: the bar track holding the fill; third column: the counts
            return { row, bar, out };  // keeps the pieces paint() will change
          });  // ends the row loop
          const downs = [h('div', { class: 'fn-down' }), h('div', { class: 'fn-down' })];  // the two red "misses go on down" lines between the rows
          const tsOut = h('span', { class: 'big', style: { fontSize: '30px' } });  // the big average access time number
          const tBar = h('div', { class: 'fn-time' }, ...LV.map((lv) => h('i', { style: { background: `var(--${lv.col})` } })));  // the stacked time bar, one coloured piece per level
          const tKey = h('div', { class: 'xs', style: { marginTop: '5px' } });  // the key under the time bar, naming each piece and its share of the time
          const say = h('div', { class: 'callout m0 small' });  // the message box at the bottom, whose colour and heading change with the result
          function paint() {  // paint(): recalculates the funnel; runs whenever a slider moves
            const N = ODDS[oi], m = 1 / N;  // N is the "1 in N" setting and m the fraction of main memory accesses that must go to the disk
            const reach = [TOTAL, TOTAL * (1 - hc), TOTAL * (1 - hc) * m];        // references that arrive at each level
            const served = [reach[0] - reach[1], reach[1] - reach[2], reach[2]];  // references finished at each level
            reach.forEach((r, i) => {  // for each level, sets its bar length and its counts
              rows[i].bar.style.width = (r / TOTAL * 100) + '%';  // the bar's width is the share of all references that reach this level
              rows[i].out.innerHTML = `<b style="font-size:17px">${num(r)}</b> arrive <span class="xs muted">(${share(r / TOTAL)})</span><br><span class="xs muted">${i < 2 ? num(served[i]) + ' finished here' : r < 1 ? 'on average; all finished here' : 'all finished here'}</span>`;  // the counts: how many arrive (and what share), and how many are finished at this level
            });  // ends the per-level loop
            downs[0].textContent = `↓ ${num(reach[1])} cache misses (${fmt((1 - hc) * 100, 0)}%) go on to main memory`;  // first "down" line: how many cache misses go on to main memory
            downs[1].textContent = `↓ of those, 1 in ${N.toLocaleString('en-US')} also misses and goes on to the disk`;  // second "down" line: of those, 1 in N also go on to the disk
            // every reference pays the cache time; a cache miss adds TM; a main-memory miss adds TD as well
            const part = [TC, (1 - hc) * TM, (1 - hc) * m * TD], Ts = part[0] + part[1] + part[2];  // part: the time each level adds to the average (in ns); Ts is their sum
            tsOut.textContent = time(Ts);  // shows the average time
            [...tBar.children].forEach((seg, i) => { seg.style.width = (part[i] / Ts * 100) + '%'; });  // sizes each piece of the time bar by its share of the average
            tKey.innerHTML = LV.map((lv, i) => `<span class="fn-key" style="background:var(--${lv.col})"></span>${lv.name.toLowerCase()} ${time(part[i])}`).join(' &nbsp;+&nbsp; ') + ` &nbsp;= <b>${time(Ts)}</b>`;  // the key: each level's contribution with a colour square, added up to the total
            const diskShare = part[2] / Ts;  // diskShare is the fraction of the average time caused by disk trips
            if (diskShare > 0.5) {  // if the disk causes more than half of the average time
              say.className = 'callout warn m0 small'; say.setAttribute('data-label', 'The disk dominates');  // the message box becomes a warning headed "The disk dominates"
              say.innerHTML = `Only ${num(reach[2])} of a million references reach the disk, yet they cause <b>${fmt(diskShare * 100, 0)}%</b> of the average time: each one costs as much as 50,000 main-memory accesses. The lower a level, the <b>more rarely</b> it must be visited. Drag “Main memory misses” to the right to make disk trips rarer.`;  // warning text: a handful of disk trips cause most of the time, so lower levels must be visited very rarely
            } else {  // otherwise
              say.className = 'callout tip m0 small'; say.setAttribute('data-label', 'Locality at work');  // the message box becomes a tip headed "Locality at work"
              say.innerHTML = `Every reference starts at the cache, ${fmt((1 - hc) * 100, 0)}% reach main memory and only 1 in ${Math.round(N / (1 - hc)).toLocaleString('en-US')} reach the disk. Each level down sees a <b>far smaller fraction</b> than the one above, so the average (<b>${time(Ts)}</b>) stays near cache speed while almost all the bits sit on the cheap disk.`;  // tip text: each level down sees a far smaller share, so the average stays near cache speed
            }  // ends the message choice
          }  // ends paint
          const sHc = ctx.ui.slider({ label: 'Cache hit ratio', min: 0.8, max: 0.99, step: 0.01, value: hc, format: (v) => v.toFixed(2), onInput: (v) => { hc = v; paint(); } });  // slider for the cache hit ratio, 0.80 to 0.99
          const sOdds = ctx.ui.slider({ label: 'Main memory misses', min: 0, max: ODDS.length - 1, step: 1, value: oi, format: (v) => '1 in ' + ODDS[v].toLocaleString('en-US'), onInput: (v) => { oi = v; paint(); } });  // slider that steps through the ODDS list: how often a main memory access must go to the disk
          el.append(h('div', { class: 'split l fill' },  // lays the step out in two columns: explanation and sliders on the left, the funnel on the right
            h('div', { class: 'stack gap-s' },  // left column
              h('p', { class: 'm0', html: 'Locality works at <b>every</b> level. Follow <b>one million</b> memory references from the processor down through the cache, main memory and the disk. Each level serves what it can; only its misses travel further down.' }),  // opening paragraph: follow a million references down through the levels
              sHc, sOdds,  // the two sliders
              h('div', { class: 'callout tip m0 small', 'data-label': 'Same rule, one more level', html: 'Every reference pays the cache time. A cache miss adds the main-memory time, and a main-memory miss adds the disk time too:<div class="mono" style="margin-top:4px">Ts = 1 ns + (1 − Hc) × (100 ns + m × 5 ms)</div>where Hc is the cache hit ratio and m is the fraction of main-memory accesses that go to disk.' }),  // callout: the three-level form of the average time formula
              h('div', { class: 'callout why m0 small', 'data-label': 'Why it matters', html: 'This is trend (d) from the pyramid: the frequency of access falls going down. It <b>must</b> fall steeply, because each level is far slower than the one above. The OS helps by keeping each program’s active data in main memory.' })),  // callout: this is trend (d), and why it must fall so steeply
            h('div', { class: 'stack gap-s' },  // right column
              rows[0].row, downs[0], rows[1].row, downs[1], rows[2].row,  // the three funnel rows with the two "down" lines between them
              h('div', { class: 'card white tight' },  // card holding the average time readout
                h('div', { class: 'row', style: { justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' } }, h('h4', { class: 'm0', text: 'Average access time Ts' }), tsOut),  // its heading on the left and the big number on the right
                tBar, tKey),  // the stacked time bar and its key
              say)));  // the message box; this ends the layout
          paint();  // fills the funnel once with the starting slider values
        },  // ends render() for step 8
      },  // ends step 8
      /* ---------------------------------------------------------------- 9. Secondary memory and the disk cache */
      {  // step 9 starts here
        title: 'Secondary memory and the disk cache',  // title of step 9
        kind: 'compare',  // kind "compare" labels it a Compare screen
        render(el, ctx) {  // render() builds step 9 when the student arrives on it
          const { h } = ctx;  // h builds HTML elements
          const REQ = [['R', 12], ['R', 13], ['R', 12], ['W', 12], ['W', 13], ['W', 12], ['R', 13], ['W', 14], ['R', 12], ['F']];  // REQ: the ten requests both computers run: reads (R) and writes (W) of disk blocks, then a flush (F)
          const reqLabel = (r) => (r[0] === 'F' ? 'flush' : (r[0] === 'R' ? 'read ' : 'write ') + r[1]);  // reqLabel(r): turns a request into words such as "read 12", "write 13" or "flush"
          const CAP = [  // CAP: the player caption for each frame (frame 0 is the setup, then one per request)
            'A program works on a file stored in disk blocks 10–15. Both computers run the same ten requests (R = read a block, W = write a block). The top lane has <b>no disk cache</b>; the bottom lane keeps a <b>disk cache</b> in main memory.',  // caption 0: the setup, one lane without a disk cache and one with
            '<b>Read block 12.</b> Neither lane has it in memory yet, so both make a disk trip (≈ 5 ms each). The bottom lane keeps a copy in its disk cache.',  // caption 1: read 12, both lanes make a disk trip and the bottom one keeps a copy
            '<b>Read block 13.</b> Both go to the disk again. First uses always miss, so the cache has not helped yet.',  // caption 2: read 13, both go to disk because first uses always miss
            '<b>Read block 12 again.</b> Top: another disk trip. Bottom: found in main memory, no trip at all. Data referenced again is often still in the disk cache.',  // caption 3: read 12 again, the bottom lane finds it in memory with no trip
            '<b>Write block 12.</b> Top: a disk trip. Bottom: the new data goes into the cached copy, marked <b>*</b> (changed). The disk copy is now out of date and will be updated later.',  // caption 4: write 12, the bottom lane changes its cached copy and marks it * instead of going to disk
            '<b>Write block 13.</b> Top: one more disk trip. Bottom: block 13 is already cached from the earlier read, so the new data simply replaces the cached copy, marked *. Two changed blocks now wait in memory.',  // caption 5: write 13, the bottom lane replaces its cached copy; two changed blocks now wait
            '<b>Write block 12 again.</b> The top lane writes it to disk a second time. Below, the cached copy is simply overwritten, so the first write never needed to reach the disk at all.',  // caption 6: write 12 again, the bottom lane overwrites the copy, so the first write never reached the disk
            '<b>Read block 13.</b> The bottom lane already holds the newest version in memory. The top lane goes back to the disk.',  // caption 7: read 13, the bottom lane already has the newest version
            '<b>Write block 14.</b> Top: a disk trip. Bottom: kept in the cache and marked changed.',  // caption 8: write 14, the bottom lane keeps it in the cache marked changed
            '<b>Read block 12.</b> Top: yet another trip. Bottom: a hit.',  // caption 9: read 12, a hit for the bottom lane
            '<b>Flush.</b> The OS writes every changed block (12, 13, 14) to disk in <b>one</b> clustered trip, since they sit side by side. Total: <b>9 trips (≈ 45 ms)</b> without a cache against <b>3 trips (≈ 15 ms)</b> with one.',  // caption 10: the flush writes all changed blocks in one trip: 9 trips without a cache against 3 with one
          ];  // closes CAP
          function stateAt(f) {  // stateAt(f): replays the first f requests from scratch and returns both lanes' state for frame f
            const A = { trips: 0, act: '', touch: null }, Bs = { trips: 0, act: '', touch: [], disk: [], cache: new Map(), stale: new Set() };  // A is the lane without a cache; Bs is the lane with one: its cache maps block to "changed?", stale lists out-of-date disk blocks
            REQ.slice(0, f).forEach((r, k) => {  // goes through the requests up to this frame; k is the request's position
              const last = k === f - 1;  // last is true for the request that belongs to this frame, whose action is described on screen
              if (r[0] !== 'F') { A.trips++; if (last) { A.act = `<span class="chip bad">disk trip</span> ${reqLabel(r)} goes to the disk`; A.touch = r[1]; } }  // without a cache, every read or write is a disk trip; the latest one's block is highlighted on its disk
              else if (last) { A.act = '<span class="chip">no trip</span> nothing to flush: every write already went to disk'; A.touch = null; }  // without a cache, a flush does nothing because every write already went to disk
              if (r[0] === 'R') {  // with a cache, a read
                if (Bs.cache.has(r[1])) { if (last) Bs.act = `<span class="chip ok">hit</span> block ${r[1]} found in the disk cache`; }  // a block already in the cache is a hit with no trip
                else { Bs.trips++; Bs.cache.set(r[1], false); if (last) { Bs.act = `<span class="chip bad">disk trip</span> block ${r[1]} read from disk into the cache`; Bs.disk = [r[1]]; } }  // otherwise it costs one disk trip and the block is kept in the cache, unchanged (false)
                if (last) Bs.touch = [r[1]];  // the block read is highlighted in the cache
              } else if (r[0] === 'W') {  // with a cache, a write
                Bs.cache.set(r[1], true); Bs.stale.add(r[1]);  // the block goes into the cache marked changed (true), and its disk copy is now out of date
                if (last) { Bs.act = `<span class="chip accent">no trip</span> written into the cached copy, marked *`; Bs.touch = [r[1]]; }  // a write costs no trip; the action line says so
              } else {  // with a cache, a flush
                const dirty = [...Bs.cache].filter(([, d]) => d).map(([b]) => b);  // dirty lists every block in the cache marked changed
                if (dirty.length) Bs.trips++;  // writing them costs one disk trip, if there is anything to write, because they sit side by side
                dirty.forEach((b) => Bs.cache.set(b, false)); Bs.stale.clear();  // every cached block is now clean and no disk block is out of date any more
                if (last) { Bs.act = `<span class="chip bad">1 disk trip</span> blocks ${dirty.join(', ')} written together`; Bs.touch = dirty; Bs.disk = dirty; }  // the action line names the blocks written together, and they are highlighted in both boxes
              }  // ends the request type choice
            });  // ends the replay loop
            return { A, B: Bs };  // returns both lanes' state (the lane with the cache is returned as B)
          }  // ends stateAt
          const strip = h('div', { class: 'row gap-s' });  // the strip of request tiles across the top
          const reqEls = REQ.map((r) => h('span', { class: 'dc-req', text: r[0] === 'F' ? 'flush' : r[0] + ' ' + r[1] }));  // one tile per request, such as "R 12" or "flush"
          strip.append(h('span', { class: 'xs muted b', text: 'REQUESTS:' }), ...reqEls);  // a "REQUESTS:" label followed by the tiles
          const lane = (title) => {  // lane(title): builds one computer's card, with a trip counter, a memory box, a disk box and an action line
            const trips = h('span', { class: 'big', style: { fontSize: '26px' } });  // the big disk trip count
            const ms = h('span', { class: 'small muted' });  // the time those trips take, at about 5 ms each
            const memBox = h('div', { class: 'dc-box mem' }), diskBox = h('div', { class: 'dc-box io' });  // the main memory box and the disk box
            const act = h('div', { class: 'small', style: { minHeight: '26px' } });  // the action line saying what the latest request did; its minimum height stops the card from jumping
            const card = h('div', { class: 'card white tight dc-lane' },  // the card itself
              h('div', { class: 'row nw', style: { justifyContent: 'space-between' } }, h('span', { class: 'b', html: title }), h('span', { class: 'row nw gap-s' }, h('span', { class: 'xs muted b', text: 'DISK TRIPS' }), trips, ms)),  // top line: the lane title on the left, the trip counter on the right
              h('div', { class: 'dc-grid' }, memBox, diskBox), act);  // the two boxes side by side, then the action line
            return { card, trips, ms, memBox, diskBox, act };  // returns the pieces paint() will fill
          };  // ends lane
          const LA = lane('Without a disk cache'), LB = lane('With a disk cache <span class="chip os">OS software</span>');  // LA is the lane without a disk cache; LB is the lane with one, tagged as OS software
          let cur = 0, cut = false;  // cur is the frame on screen; cut is true after the student presses the power cut button
          const blk = (txt, cls) => h('span', { class: 'dc-blk ' + (cls || ''), text: txt });  // blk(txt, cls): one block tile with the given text and style
          function paint(f) {  // paint(f): redraws both lanes for frame f
            cur = f;  // remembers the frame so the power cut button can repaint it
            const { A, B } = stateAt(f);  // gets both lanes' state for this frame
            reqEls.forEach((e, k) => { e.classList.toggle('on', k === f - 1); e.classList.toggle('done', k < f - 1); });  // highlights the current request tile and fades the ones already done
            LA.trips.textContent = A.trips; LA.ms.textContent = '≈ ' + A.trips * 5 + ' ms';  // top lane: trip count and the time it adds up to
            LB.trips.textContent = B.trips; LB.ms.textContent = '≈ ' + B.trips * 5 + ' ms';  // bottom lane: trip count and its time
            LA.memBox.replaceChildren(h('div', { class: 'lab', text: 'MAIN MEMORY' }), h('div', { class: 'small muted', text: cut ? 'wiped by the power cut' : 'no disk cache: every request goes to the disk' }));  // top lane's memory box: nothing cached, or "wiped" after a power cut
            const cached = [...B.cache.keys()].sort((p, q) => p - q);  // cached lists the blocks held in the bottom lane's disk cache, in number order
            LB.memBox.replaceChildren(h('div', { class: 'lab', text: 'MAIN MEMORY · DISK CACHE' }),  // bottom lane's memory box heading
              h('div', {}, ...(cached.length ? cached.map((b) => blk(b + (B.cache.get(b) ? '*' : ''), cut ? (B.cache.get(b) ? 'lost' : 'gone') : (B.cache.get(b) ? 'dirty' : '') + (B.touch.includes(b) ? ' hl' : ''))) : [h('span', { class: 'small muted', text: 'empty' })])));  // its block tiles (changed ones marked *), styled for a power cut, changed or just touched, or "empty"
            LA.diskBox.replaceChildren(h('div', { class: 'lab', text: 'DISK (nonvolatile)' }), h('div', {}, ...[10, 11, 12, 13, 14, 15].map((b) => blk(b, b === A.touch ? 'hl' : ''))));  // top lane's disk: blocks 10-15, with the one just used highlighted
            LB.diskBox.replaceChildren(h('div', { class: 'lab', text: 'DISK (nonvolatile)' }), h('div', {}, ...[10, 11, 12, 13, 14, 15].map((b) => blk(B.stale.has(b) ? b + ' old' : b, (B.stale.has(b) ? 'stale' : '') + (B.disk.includes(b) ? ' hl' : '')))));  // bottom lane's disk: blocks 10-15, out-of-date ones marked "old" and dashed, and the ones just written highlighted
            LA.act.innerHTML = f ? A.act : '<span class="muted">waiting for the first request</span>';  // top lane's action line, or a waiting message before the first request
            LB.act.innerHTML = f ? B.act : '<span class="muted">waiting for the first request</span>';  // bottom lane's action line, or the same waiting message
          }  // ends paint
          const player = ctx.ui.player({ count: REQ.length + 1, interval: 2600, render: (i) => { cut = false; paint(i); return CAP[i]; } });  // the frame player: each frame clears any power cut, repaints, and returns its caption
          const powerBtn = h('button', { class: 'btn sm intr', type: 'button', text: 'Power cut now?', onclick: () => {  // the "Power cut now?" button, which shows what a volatile disk cache risks
            player.stop(); cut = true; paint(cur);  // stops playing, marks the power cut, and repaints the current frame in its power cut look
            const dirty = [...stateAt(cur).B.cache].filter(([, d]) => d).map(([b]) => b);  // dirty lists the changed blocks that were only in the cache
            player.caption.innerHTML = dirty.length  // replaces the caption with an explanation of the power cut
              ? `<b>Power cut!</b> Main memory is <span class="t" data-t="volatile memory">volatile</span>, so the disk cache vanishes. The changes to block${dirty.length > 1 ? 's' : ''} <b>${dirty.join(', ')}</b> had not reached the disk yet and are <b>lost</b>. The disk is <span class="t" data-t="nonvolatile memory">nonvolatile</span>, so everything already written survives. This is why the OS writes changed blocks back regularly (typically within seconds) and flushes everything at shutdown. (The top lane loses nothing, but it paid a disk trip for every write.)`  // if changes were waiting: they are lost, and this is why the OS writes changed blocks back regularly
              : '<b>Power cut!</b> Main memory is <span class="t" data-t="volatile memory">volatile</span>, so the disk cache vanishes, but nothing is lost: no changes were waiting in it. The <span class="t" data-t="nonvolatile memory">nonvolatile</span> disk holds everything. Press next or back to resume.';  // if nothing was waiting: the cache vanishes but no data is lost
          } });  // ends the power cut button
          player.el.querySelector('.player-ctl').append(powerBtn);  // adds the power cut button to the player's row of controls
          el.append(h('div', { class: 'split l fill', style: { gridTemplateColumns: 'minmax(0,4fr) minmax(0,7fr)' } },  // lays the step out in two columns, the explanation taking less width than the demo
            h('div', { class: 'stack gap-s' },  // left column
              h('p', { class: 'm0', html: 'Below main memory sits <span class="t">secondary memory</span> (met in 1.1, also called auxiliary memory): SSDs and disks. It is <b>nonvolatile</b>, so files survive with the power off, but it is thousands of times slower than main memory.' }),  // paragraph: secondary memory is nonvolatile but thousands of times slower than main memory
              h('p', { class: 'm0', html: 'The OS plays the hierarchy trick again, one level down: it sets aside part of main memory as a <span class="t">disk cache</span>, a buffer for disk blocks. It is <b>software</b> (OS code plus ordinary RAM), not extra hardware.' }),  // paragraph: the OS sets aside part of main memory as a disk cache, which is software, not extra hardware
              h('div', { class: 'card tight small', html: '<b>Two payoffs</b><ul class="m0" style="margin-top:2px"><li><b>Clustered writes:</b> changes pile up in memory and go to disk later in a few large trips instead of many small ones.</li><li><b>Re-use:</b> data referenced again is often still in the cache, so it comes from memory, not the disk.</li></ul>' }),  // card: the two payoffs, clustered writes and re-use
              h('div', { class: 'callout warn m0 small', 'data-label': 'Do not mix them up', html: 'The processor <b>cache</b> (1.6) is hardware between processor and main memory. The <b>disk cache</b> is a slice of main memory, run by the OS, in front of the disk.' })),  // callout: do not confuse the processor cache (hardware) with the disk cache (part of main memory)
            h('div', { class: 'stack gap-s' }, strip, LA.card, LB.card, player.el)));  // right column: the request strip, both lanes and the player
        },  // ends render() for step 9
      },  // ends step 9
      /* ---------------------------------------------------------------- 9. Recap */
      {  // step 10 starts here
        title: 'Recap: six ideas to carry away',  // title of step 10, the recap
        kind: 'recap',  // kind "recap" labels it a Recap screen
        render(el, ctx) {  // render() builds the recap when the student arrives on it
          const { h } = ctx;  // h builds HTML elements
          el.append(h('div', { class: 'stack fill' },  // lays the recap out as one column that fills the screen
            h('p', { class: 'lead m0', html: 'Say each answer out loud <b>before</b> you flip the card. Click a card to check yourself.' }),  // instruction: say each answer aloud before flipping the card
            ctx.ui.flipcards([  // flip cards (a guide helper): each card shows a prompt on the front and the answer on the back when clicked
              ['The memory dilemma', 'Faster memory costs more per bit. Bigger memory is cheaper per bit but slower. No one technology is big, fast and cheap, so we build a <b>hierarchy</b>.'],  // card: the memory dilemma and why it leads to a hierarchy
              ['The levels, top to bottom', '<b>Inboard:</b> registers, cache, main memory. <b>Outboard:</b> SSD, magnetic disk, optical discs. <b>Off-line:</b> magnetic tape.'],  // card: the levels from top to bottom, in their three groups
              ['Going down the hierarchy…', 'Cost per bit <b>falls</b>, capacity <b>grows</b>, access time <b>grows</b>, and the processor uses the level <b>less often</b>.'],  // card: the four trends going down the hierarchy
              ['Average access time (two levels)', 'Ts = H × T1 + (1 − H) × (T1 + T2). With T1 = 0.1 µs, T2 = 1 µs and H = 0.95: <b>Ts = 0.15 µs</b>, close to the fast level.'],  // card: the two-level average access time formula with the worked example
              ['Why it works: locality', 'References <b>cluster</b>. Temporal: the same address again soon. Spatial: nearby addresses soon. So each lower level is accessed far less often than the one above.'],  // card: locality, the reason the hierarchy works
              ['The disk cache', 'A slice of <b>main memory</b> that the OS (software) uses to buffer disk blocks. Writes get clustered; data used again comes from memory, not the disk.'],  // card: the disk cache, a slice of main memory run by the OS
            ].map(([f, b]) => [`<div>${f}</div>`, `<div>${b}</div>`]), { cols: 3, height: 150 }),  // wraps each front and back in its own box, and asks for three columns of 150-pixel-tall cards
            h('div', { class: 'grid-2' },  // two callouts side by side under the cards
              h('div', { class: 'callout tip m0', 'data-label': 'If you remember one thing', html: 'A hierarchy is <b>fast</b> because locality keeps most accesses in the small top levels, and <b>cheap</b> because most of its bits live in the big bottom levels.' }),  // callout: the one thing to remember, fast thanks to locality and cheap thanks to the big bottom levels
              h('div', { class: 'callout warn m0', 'data-label': 'Common mistake', html: 'Using T2 alone as the cost of a miss. The processor checked level 1 first, so a miss costs <b>T1 + T2</b>.' }))));  // callout: the common mistake of charging a miss T2 instead of T1 + T2
        },  // ends render() for the recap
      },  // ends step 10
      /* ---------------------------------------------------------------- 10. Check yourself */
      {  // step 11 starts here
        title: 'Check yourself: the memory hierarchy',  // title of step 11, the section quiz
        kind: 'check',  // kind "check" labels it a Check Yourself screen
        quiz: [  // quiz: the questions the guide's quiz engine shows, marks and saves; each has a why explaining the answer
          { q: 'Which statement about memory technologies is correct?',  // question 1 (multiple choice): which relationship between memory technologies is correct
            choices: ['Faster access time goes with a smaller cost per bit.', 'Greater capacity goes with a greater cost per bit.', 'Greater capacity goes with a greater (slower) access time.', 'Capacity and access time are unrelated.'],  // the four choices; only the third states a real relationship
            answer: 2,  // the index of the right choice, counting from 0 (the third choice)
            feedback: ['It is the other way round: the fastest technologies (such as SRAM) cost the most per bit.', 'Technologies that pack in more bits are cheaper per bit, not more expensive.', null, 'They are linked: the technologies that hold the most data are also the slowest to reach.'],  // feedback for each wrong choice, shown when it is picked (null for the right one)
            why: 'Three relationships hold: faster access → greater cost per bit; greater capacity → smaller cost per bit; greater capacity → slower access time. That tension is why computers use a hierarchy.' },  // explanation shown after answering: the three relationships and why they lead to a hierarchy
          { type: 'order', q: 'Put these levels in order from the <b>top</b> of the memory hierarchy (closest to the processor) to the <b>bottom</b>.',  // question 2 (put in order): the levels from the top of the hierarchy to the bottom
            items: ['Registers', 'Cache', 'Main memory', 'Magnetic disk', 'Magnetic tape'],  // the levels, listed here in the right order; the quiz shuffles them for the student
            why: 'Registers and cache sit in the processor, main memory completes inboard memory, magnetic disk is outboard storage, and tape is off-line storage at the bottom.' },  // explanation: where each level sits and which group it belongs to
          { type: 'bucket', q: 'Moving <b>down</b> the memory hierarchy (from registers toward tape), does each quantity increase or decrease?',  // question 3 (sort into groups): does each quantity increase or decrease going down
            buckets: ['Increases', 'Decreases'],  // the two groups
            items: [['Cost per bit', 1], ['Capacity', 0], ['Access time', 0], ['How often the processor accesses the level', 1]],  // the items, each with the number of its correct group (0 = increases, 1 = decreases)
            why: 'Going down: cost per bit decreases, capacity increases, access time increases, and the frequency of access by the processor decreases.' },  // explanation: the four trends going down
          { type: 'match', q: 'Match each term to its meaning.',  // question 4 (match the pairs): terms and their meanings
            pairs: [['Hit ratio', 'Fraction of accesses found in the faster memory'], ['Temporal locality', 'A location used recently is likely to be used again soon'], ['Spatial locality', 'Locations near a recently used one are likely to be used soon'], ['Disk cache', 'Part of main memory the OS uses to buffer disk blocks'], ['Secondary memory', 'Nonvolatile storage below main memory, such as disks, that keeps files without power']],  // the five term-meaning pairs: hit ratio, temporal and spatial locality, disk cache, secondary memory
            why: 'H measures how well the fast level works, the two kinds of locality explain why it works, secondary memory is the permanent (nonvolatile) store below main memory, and the disk cache is the OS’s way of speeding it up.' },  // explanation: how the matched terms fit together
          { type: 'num', q: 'A two-level memory has T1 = 0.1 µs and T2 = 1 µs. The hit ratio is H = 0.95. What is the average access time Ts, in µs?',  // question 5 (calculate): the average access time for T1 = 0.1, T2 = 1 and H = 0.95
            answer: 0.15, tol: 0.001, unit: 'µs',  // the right answer is 0.15, and any answer within 0.001 of it counts
            hint: 'A hit costs T1; a miss costs T1 + T2.',  // hint offered after a wrong try: what a hit and a miss each cost
            why: 'Ts = H × T1 + (1 − H) × (T1 + T2) = 0.95 × 0.1 + 0.05 × 1.1 = 0.095 + 0.055 = 0.15 µs, close to the speed of the fast level.' },  // explanation: the formula worked through step by step
          { type: 'num', q: 'A two-level memory has T1 = 0.1 µs and T2 = 1 µs. What hit ratio H gives an average access time of 0.3 µs? (Answer as a decimal between 0 and 1.)',  // question 6 (calculate): what hit ratio gives an average of 0.3 microseconds
            answer: 0.8, tol: 0.005,  // the right answer is 0.8, within 0.005
            hint: 'Ts = H × T1 + (1 − H) × (T1 + T2) simplifies to Ts = T1 + (1 − H) × T2.',  // hint: the formula simplifies to Ts = T1 + (1 - H) x T2
            why: '0.3 = 0.1 + (1 − H) × 1, so 1 − H = 0.2 and H = 0.8. Dropping H from 0.95 to 0.8 doubles the average time (0.15 µs → 0.3 µs), which is why hit ratios must stay close to 1.' },  // explanation: solving for H, and why dropping H to 0.8 doubles the average time
          { q: 'In a two-level memory, how long does an access that <b>misses</b> in level 1 take?',  // question 7 (multiple choice): how long an access that misses in level 1 takes
            choices: ['T1', 'T2', 'T1 + T2', 'T2 − T1'],  // the four choices
            answer: 2,  // the right choice is the third one, T1 + T2
            feedback: ['T1 is the cost of a hit; a miss has to go further.', 'This forgets the time already spent looking in level 1 before going down to level 2.', null, 'Nothing is subtracted: the time spent checking level 1 is added to the level-2 time, not taken away from it.'],  // feedback for each wrong choice
            why: 'The processor first checks level 1 (T1). On a miss, the word is fetched from level 2 into level 1 (T2) and then read, so the total is T1 + T2.' },  // explanation: the processor checks level 1 first, then fetches from level 2
          { q: 'Why can a small, fast memory level satisfy most of the processor’s accesses?',  // question 8 (multiple choice): why a small fast level can satisfy most accesses
            choices: ['Programs’ memory references cluster in small regions for a while (locality of reference).', 'The OS copies all of main memory into it when the computer starts.', 'The processor slows down to match the speed of the lower levels.', 'The lower levels are volatile, so data must be kept in the top level.'],  // the four choices; only the first names locality
            answer: 0,  // the right choice is the first
            feedback: [null, 'The fast level is far too small to hold all of main memory; it holds only what is in use now.', 'The processor does not slow down; the hierarchy hides the slow levels instead.', 'Volatility has nothing to do with it, and the lower disk levels are actually nonvolatile.'],  // feedback for each wrong choice
            why: 'Because references cluster (temporal and spatial locality), the few blocks in use right now can sit in the fast level, and the lower levels are accessed far less often.' },  // explanation: references cluster, so the blocks in use fit in the fast level
          { type: 'bucket', q: 'Classify each example by the kind of locality it mainly shows.',  // question 9 (sort into groups): temporal or spatial locality for each example
            buckets: ['Temporal locality', 'Spatial locality'],  // the two groups
            items: [['A loop’s instructions executed again on every pass', 0], ['A counter variable updated in every iteration', 0], ['Reading array elements a[0], a[1], a[2] in order', 1], ['Executing straight-line instructions one after another', 1], ['Calling the same subroutine many times', 0]],  // the five examples with their correct group (0 = temporal, 1 = spatial)
            why: 'Temporal locality means re-using the same location soon (loops, counters, repeated calls). Spatial locality means using neighbouring locations soon (sequential instructions, array elements).' },  // explanation: re-using a location versus using its neighbours
          { type: 'tf', q: 'The disk cache that the operating system manages is a separate hardware memory chip placed between main memory and the disk.',  // question 10 (true or false): the disk cache is a separate hardware chip
            answer: false,  // the statement is false
            why: 'The OS’s disk cache is a portion of ordinary main memory that the operating system sets aside and manages in software as a buffer for disk blocks. No extra hardware is involved.' },  // explanation: the disk cache is ordinary main memory managed by OS software
          { type: 'multi', q: 'Which are benefits of a disk cache?',  // question 11 (select all that apply): the benefits of a disk cache
            choices: ['Writes can be clustered into fewer, larger disk transfers.', 'Data referenced again may be found in main memory instead of on the disk.', 'It makes main memory nonvolatile.', 'It removes the need for secondary memory.'],  // the four choices
            answer: [0, 1],  // the right choices are the first two
            why: 'Buffering disk blocks in main memory lets the OS batch writes and serve repeated references from memory. It cannot make RAM survive a power cut, and the disk is still needed to store data permanently.' },  // explanation: batched writes and repeated references, but no survival through a power cut
          { type: 'bucket', q: 'Sort each technology into its group of the memory hierarchy.',  // question 12 (sort into groups): inboard, outboard or off-line for each technology
            buckets: ['Inboard memory', 'Outboard storage', 'Off-line storage'],  // the three groups
            items: [['Registers', 0], ['Cache', 0], ['Main memory', 0], ['Solid-state disk', 1], ['Magnetic disk', 1], ['Optical disc (DVD, Blu-ray)', 1], ['Magnetic tape', 2]],  // the seven technologies with their correct group (0 = inboard, 1 = outboard, 2 = off-line)
            why: 'Inboard memory is what the processor reaches directly or over the system bus: registers, cache and main memory. Outboard storage is attached through I/O modules: SSDs, magnetic disks and optical discs. Off-line storage, such as tape, sits outside the running system and must be mounted before use.' },  // explanation: what defines each group
        ],  // closes the quiz list
      },  // ends step 11
    ],  // closes the steps list
    notes: `${/* notes: the section's reading notes, written as HTML and shown in the Notes panel on any step of this section */''}
      <h3>1. The memory designer’s dilemma</h3>${/* heading for part 1 of the notes: the dilemma */''}
      <p>A memory is judged on three design constraints: <b>capacity</b> (how much it holds), <b>access time</b> (how long it takes to deliver or store data once asked) and <b>cost per bit</b> (the price of storing one bit, usually quoted per GB). Across real technologies three relationships always hold:</p>${/* notes paragraph: the three design constraints on memory */''}
      <ol>${/* start of the numbered list of relationships */''}
        <li><b>Faster access time → greater cost per bit.</b></li>${/* relationship 1: faster access means greater cost per bit */''}
        <li><b>Greater capacity → smaller cost per bit.</b></li>${/* relationship 2: greater capacity means smaller cost per bit */''}
        <li><b>Greater capacity → greater (slower) access time.</b></li>${/* relationship 3: greater capacity means slower access */''}
      </ol>${/* end of the numbered list */''}
      <p><b>The dilemma:</b> we want large capacity (cheap per bit, room for programs) and fast access, but the big technologies are the slow ones. All-SRAM storage would cost a fortune and forget everything at power-off; all-disk storage would leave the processor waiting. <b>The solution:</b> do not rely on one technology. Use a little fast, expensive memory and a lot of slow, cheap memory, stacked in levels, and keep the data in use near the top. This is the <b>memory hierarchy</b>.</p>${/* notes paragraph: the dilemma and its solution, the memory hierarchy */''}
      <p><small>1 ns = a billionth of a second; 1 µs = 1,000 ns; 1 ms = 1,000 µs. Caches use fast, bulky SRAM; main memory uses denser, cheaper DRAM.</small></p>${/* small print: time units, and SRAM versus DRAM */''}

      <h3>2. The levels of the hierarchy</h3>${/* heading for part 2 of the notes: the levels */''}
      <ul>${/* start of the list of the three groups */''}
        <li><b>Inboard memory</b>: registers, cache, main memory (reached directly or over the system bus).</li>${/* group: inboard memory */''}
        <li><b>Outboard storage</b>: solid-state disks, magnetic disks, optical discs (attached through I/O modules).</li>${/* group: outboard storage */''}
        <li><b>Off-line storage</b>: magnetic tape, kept outside the running system and mounted when needed (backups, archives).</li>${/* group: off-line storage */''}
      </ul>${/* end of the list of groups */''}
      <table>${/* start of the table of levels */''}
        <tr><th>Level</th><th>Capacity</th><th>Access time</th><th>Cost per GB</th></tr>${/* table header row: level, capacity, access time, cost per GB */''}
        <tr><td>Registers</td><td>≈ 1 KB</td><td>≈ 0.3 ns</td><td>highest</td></tr>${/* table row: registers */''}
        <tr><td>Cache (SRAM)</td><td>64 KB–64 MB</td><td>1–10 ns</td><td>≈ $1,000</td></tr>${/* table row: cache */''}
        <tr><td>Main memory (DRAM)</td><td>8–64 GB</td><td>50–100 ns</td><td>≈ $5</td></tr>${/* table row: main memory */''}
        <tr><td>SSD</td><td>0.5–4 TB</td><td>≈ 0.1 ms</td><td>≈ 8¢</td></tr>${/* table row: SSD */''}
        <tr><td>Magnetic disk</td><td>1–20 TB</td><td>5–10 ms</td><td>≈ 2¢</td></tr>${/* table row: magnetic disk */''}
        <tr><td>Optical disc</td><td>≤ 100 GB per disc</td><td>≈ 100 ms</td><td>≈ 5¢</td></tr>${/* table row: optical disc */''}
        <tr><td>Magnetic tape</td><td>10–30 TB per cartridge</td><td>seconds–minutes</td><td>≈ 0.5¢</td></tr>${/* table row: magnetic tape */''}
      </table>${/* end of the table */''}
      <p>Rough mid-2020s figures; the ratios matter most. Registers, cache and main memory are <b>volatile</b> (they forget without power); the outboard and off-line levels are <b>nonvolatile</b>.</p>${/* notes paragraph: the figures are rough, and which levels are volatile or nonvolatile */''}
      <p><b>Going down the hierarchy:</b> (a) cost per bit <b>decreases</b>; (b) capacity <b>increases</b>; (c) access time <b>increases</b>; (d) frequency of access by the processor <b>decreases</b>. Point (d) is what makes (c) bearable. The trends compare levels. SSD, magnetic disk and optical disc are side-by-side alternatives on the same outboard level, so they need not line up with each other: optical discs (≈ 5¢ per GB) even cost more per bit than magnetic disk (≈ 2¢), because discs are now a niche medium.</p>${/* notes paragraph: the four trends going down, and why optical discs break the cost trend */''}
      <p><b>Feeling the gaps:</b> if a 0.3 ns register access took 1 second, a cache access would take ≈ 3 s, main memory ≈ 5.6 min, an SSD ≈ 4 days, a magnetic disk ≈ 6 months, an optical disc ≈ 10 years, and winding a tape ≈ 6,300 years. So the OS does not let the processor idle during a disk access: it runs another program and an interrupt announces the data.</p>${/* notes paragraph: the stretched-time comparison, and why the OS runs another program during a disk access */''}

      <h3>3. A two-level memory and its average access time</h3>${/* heading for part 3 of the notes: the two-level memory */''}
      <p>Level 1 is small and fast (access time <b>T1</b>); level 2 is large and slow (access time <b>T2</b>). The processor always looks in level 1 first.</p>${/* notes paragraph: level 1 and level 2, and the processor always looking in level 1 first */''}
      <ul>${/* start of the list of hit, miss and hit ratio */''}
        <li><b>Hit</b>: the word is in level 1; the access takes T1.</li>${/* list item: a hit costs T1 */''}
        <li><b>Miss</b>: the word’s <b>block</b> (a fixed-size group of neighbouring words) is copied up from level 2 and the word is then read from level 1; the access takes <b>T1 + T2</b>.</li>${/* list item: a miss copies the block up and costs T1 + T2 */''}
        <li><b>Hit ratio H</b> = hits ÷ total accesses, between 0 and 1.</li>${/* list item: the hit ratio H, from 0 to 1 */''}
      </ul>${/* end of the list */''}
      <p><b>Ts = H × T1 + (1 − H) × (T1 + T2)</b>, which simplifies to Ts = T1 + (1 − H) × T2.</p>${/* notes paragraph: the average access time formula and its simpler form */''}
      <p><b>Worked example</b> (T1 = 0.1 µs, T2 = 1 µs, H = 0.95): Ts = 0.95 × 0.1 + 0.05 × 1.1 = 0.095 + 0.055 = <b>0.15 µs</b>. Read by read: a loop reads a[0]–a[3] five times (20 reads); only the first misses (1.1 µs) and 19 hit (0.1 µs each), so the total is 3.0 µs, the average 0.15 µs and H = 19/20 = 0.95. Without level 1 the 20 reads would take 20 µs, so level 1 made the loop ≈ 6.7× faster.</p>${/* notes paragraph: the worked example, also traced read by read */''}
      <p>Other values: H = 0.9 → 0.2 µs; H = 0.8 → 0.3 µs; H = 0.99 → 0.11 µs; H = 0 → 1.1 µs (worse than level 2 alone). Ts against H is a straight line from T1 + T2 (H = 0) to T1 (H = 1); each 0.01 lost in H adds 0.01 × T2. Keeping Ts within 2 × T1 needs H ≥ 1 − T1/T2 (0.9 here): H must be close to 1.</p>${/* notes paragraph: Ts at other hit ratios, the straight line, and the minimum H to stay within 2 x T1 */''}
      <p><b>Common mistake:</b> charging only T2 for a miss. The processor already spent T1 checking level 1.</p>${/* notes paragraph: the common mistake of charging only T2 for a miss */''}

      <h3>4. Locality of reference: why the hierarchy works</h3>${/* heading for part 4 of the notes: locality of reference */''}
      <p>High hit ratios are possible because of <b>locality of reference</b>: over a short period, a program’s memory references cluster in a few small areas, and those clusters change only slowly. Causes: sequential instructions, loops, subroutines (the same code called repeatedly, touching a few local variables) and arrays or records processed item by item.</p>${/* notes paragraph: what locality is and what causes it in real programs */''}
      <ul>${/* start of the list of the two kinds of locality */''}
        <li><b>Temporal locality</b>: a location used recently is likely to be used again soon (loop instructions, counters, repeated calls).</li>${/* list item: temporal locality, with examples */''}
        <li><b>Spatial locality</b>: locations near a recently used one are likely to be used soon (straight-line code, array elements). Copying whole blocks exploits it.</li>${/* list item: spatial locality, and how copying whole blocks uses it */''}
      </ul>${/* end of the list */''}
      <p>A loop hits on later passes only if it fits in the fast memory; straight-line code has only spatial locality (bigger blocks, fewer misses); random addresses almost always miss.</p>${/* notes paragraph: what the locality lab's patterns show */''}
      <p><b>The funnel.</b> Because references cluster, data can be arranged so that the <b>fraction of accesses going to each lower level is much smaller</b> than the fraction going to the level above. Example: 1,000,000 references, cache hit ratio 0.95, and 1 in 100,000 main-memory accesses going on to disk. All million use the cache, 50,000 reach main memory and on average 0.5 reach the disk. The same rule with three levels (cache 1 ns, memory 100 ns, disk 5 ms) gives Ts = 1 + 0.05 × (100 + 0.00001 × 5,000,000) = 1 + 5 + 2.5 = <b>8.5 ns</b>. With 1 in 10,000 going to disk, Ts is 31 ns, 80% of it disk time: the slower a level, the rarer its use must be.</p>${/* notes paragraph: the funnel, worked through for a million references and three levels */''}

      <h3>5. Secondary memory and the disk cache</h3>${/* heading for part 5 of the notes: secondary memory and the disk cache */''}
      <p><b>Secondary (auxiliary) memory</b>, such as SSDs and magnetic disks, sits below main memory. It is <b>nonvolatile</b>, so it holds programs and files permanently, but it is thousands of times slower than main memory.</p>${/* notes paragraph: secondary memory is nonvolatile but thousands of times slower */''}
      <p>A <b>disk cache</b> is a portion of main memory that the OS uses as a buffer for disk blocks. It is a <b>software</b> technique (OS code plus ordinary RAM), not a separate hardware memory. (A drive may also carry a small hardware buffer of its own; that is a different thing.) Benefits:</p>${/* notes paragraph: the disk cache is software using part of main memory, not a hardware buffer */''}
      <ul>${/* start of the list of benefits */''}
        <li><b>Clustered writes:</b> changed blocks collect in memory and go out later in a few large transfers; a block written twice may reach the disk only once.</li>${/* list item: clustered writes */''}
        <li><b>Re-use:</b> data referenced again (read or just written) may still be in the disk cache, so it comes from memory instead of the disk.</li>${/* list item: re-use of data referenced again */''}
      </ul>${/* end of the list */''}
      <p><b>Example:</b> read 12, read 13, read 12, write 12, write 13, write 12, read 13, write 14, read 12, flush takes 9 disk trips (≈ 45 ms) without a disk cache but 3 (≈ 15 ms) with one: two first-time reads plus one clustered write of blocks 12–14.</p>${/* notes paragraph: the ten-request example, 9 disk trips without a cache against 3 with one */''}
      <p><b>The price:</b> main memory is volatile, so changes still waiting in the disk cache are lost if the power fails. The OS therefore writes changed blocks back regularly and flushes everything at shutdown.</p>${/* notes paragraph: the price of volatility, and why the OS writes changed blocks back regularly */''}
      <p><b>Do not confuse</b> the processor cache (hardware, between processor and main memory) with the disk cache (software, a slice of main memory in front of the disk).</p>${/* notes paragraph: do not confuse the processor cache with the disk cache */''}
`,  // end of the notes text
  });  // closes the object passed to Guide.section, which registers the section
})();  // closes and immediately runs the wrapping function from the top of the file
