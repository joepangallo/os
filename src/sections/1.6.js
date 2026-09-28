// Comment key: a line inside backtick text ends with ${/* comment */''}, an empty-string slot that holds a comment without changing the text on screen (full note at the top of the page).
/* Section 1.6 Cache Memory
   Original teaching material. Helpers live in this IIFE so nothing leaks into the global scope. */
(() => {  // wraps the whole section in a function that runs once, right away, so its names stay private to this file
  /* ------------------------------------------------------------------ shared helpers */
  const K = 4;                 // words per block in every small demo (so the word field is 2 bits)
  const NBLOCKS = 16;          // main memory in the small demos: 16 blocks x 4 words = 64 words
  const NSLOTS = 4;            // cache slots in the small demos
  const bin = (v, bits) => v.toString(2).padStart(bits, '0');  // bin(v, bits): writes the number v in binary, padded with leading zeros to exactly bits digits (bin(5, 4) = "0101")
  // multi-line SVG text: lines is a string or an array of strings (one tspan per line)
  function mtext(s, x, y, lines, attrs = {}, lh = 18) {  // mtext(s, x, y, lines): builds an SVG (the browser's drawing format) text label that can span several lines
    const arr = [].concat(lines);  // arr is the list of lines, even when a single string was passed
    const t = s('text', Object.assign({ x, y }, attrs));  // s is the SVG element builder passed in; the text element starts at (x, y) and takes any extra attributes
    arr.forEach((ln, i) => t.append(s('tspan', { x, dy: i === 0 ? 0 : lh }, ln)));  // adds one tspan (a line of SVG text) per line; each line after the first moves down by lh pixels
    return t;  // hands the finished text element back so the caller can place it in a drawing
  }  // ends mtext
  // a clickable SVG group that the student (and the fuzzer) can activate with mouse or keyboard
  function hotGroup(ctx, onAct, label, ...kids) {  // hotGroup(...): wraps drawing pieces in an SVG group that acts like a button; onAct runs when it is chosen
    const g = ctx.s('g', { class: 'hot', tabindex: 0, role: 'button', 'aria-label': label }, ...kids);  // the group gets the "hot" class for its hover style, joins the Tab order, and is announced as a button named label
    g.addEventListener('click', onAct);  // a normal mouse click or tap on the group runs the action
    // SVG elements have no .click() method, so test automation can only send synthetic pointer events;
    // accept those (never trusted user events, which arrive as the click above) so scripted checks reach the hotspot.
    g.addEventListener('pointerdown', (e) => { if (!e.isTrusted) onAct(); });  // a pointer event created by a script (isTrusted is false) also runs the action
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAct(); } });  // pressing Enter or Space while the group has keyboard focus runs it too, and stops the page from scrolling
    return g;  // returns the group so the caller can add it to the drawing
  }  // ends hotGroup
  /* A tiny cache model used by the simulator lab: 16 blocks x 4 words of memory, 4 slots.
     mode 'direct': slot = block mod 4 (forced).  mode 'assoc': any slot; when full, evict the least recently used. */
  function makeCache(mode) {  // makeCache(mode): creates an empty cache for the simulator lab, in 'direct' or 'assoc' mode
    return { mode, slots: [0, 1, 2, 3].map(() => ({ valid: false, block: -1, last: 0 })), t: 0, hits: 0, misses: 0 };  // four empty slots (valid false, no block, last used at time 0), a clock t, and hit and miss counters
  }  // ends makeCache
  function lruIndex(c) { return c.slots.reduce((m, sl, k) => (sl.last < c.slots[m].last ? k : m), 0); }  // lruIndex(c): finds the slot used least recently (smallest "last" time), the one LRU replacement throws out
  function cacheAccess(c, addr) {  // cacheAccess(c, addr): sends one read of word address addr through cache c and reports what happened
    const block = addr >> 2, word = addr & 3;  // splits the address: block number = address divided by 4 (shift right 2 bits), word = the last 2 bits
    c.t++;  // advances the cache's clock by one access
    let slot, hit, victim = null, reason = '', victimLast = 0;  // slot, hit and the details of any eviction (victim block, when it was last used, and why) are filled in below
    if (c.mode === 'direct') {  // direct mapping: each block has exactly one allowed slot
      slot = block & 3;  // the slot is the block number mod 4, which is its last 2 bits
      const sl = c.slots[slot];  // sl is that slot
      hit = sl.valid && sl.block === block;  // a hit only if the slot holds valid data and it is this very block
      if (!hit) { reason = sl.valid ? 'forced' : 'empty'; if (sl.valid) victim = sl.block; }  // on a miss, the reason is "forced" if another block must leave (it becomes the victim), else "empty"
    } else {  // associative mapping: the block may be in any slot
      slot = c.slots.findIndex((sl) => sl.valid && sl.block === block);  // searches every slot for this block
      hit = slot >= 0;  // a hit if some slot has it
      if (!hit) {  // on a miss, a slot must be chosen
        slot = c.slots.findIndex((sl) => !sl.valid);  // first choice: any empty slot
        if (slot >= 0) reason = 'empty';  // if one was found, the reason is simply "empty"
        else { slot = lruIndex(c); victim = c.slots[slot].block; victimLast = c.slots[slot].last; reason = 'lru'; }  // otherwise evict the least recently used block, remembering which block it was and when it was last used
      }  // ends the miss branch
    }  // ends the choice between the two mapping modes
    const sl = c.slots[slot];  // sl is the slot that ends up serving this access
    if (hit) c.hits++; else { c.misses++; sl.valid = true; sl.block = block; }  // a hit is counted; a miss is counted and the block is loaded into the slot, replacing whatever was there
    sl.last = c.t;  // marks the slot as used now, for LRU
    return { addr, block, word, slot, hit, victim, victimLast, reason, t: c.t };  // returns a record of the access for the lab to draw and explain
  }  // ends cacheAccess
  // preset reference strings (word addresses). Results verified: seq 12/16 both modes; loop 22/24 both;
  // random 3/16 both; pingpong 0/12 direct but 10/12 associative.
  const PROGRAMS = {  // PROGRAMS: the four preset reference strings (lists of word addresses) the simulator lab can run
    seq: { label: 'Array walk', refs: Array.from({ length: 16 }, (_, i) => i),  // "Array walk": words 0 to 15 in order
      what: 'Reads words 0, 1, 2, … 15 in order, like a loop adding up an array.',  // what it does: reads an array in order
      after: 'Each miss brings in a whole 4-word block, so the next 3 reads hit: <b>spatial locality</b> at work. Mapping makes no difference here.' },  // what it shows: one miss per block and three hits after it (spatial locality); mapping makes no difference
    loop: { label: 'Loop ×3', refs: [0, 1, 2].flatMap(() => [20, 21, 22, 23, 24, 25, 26, 27]),  // "Loop ×3": the loop body at addresses 20-27, fetched three times
      what: 'Fetches an 8-instruction loop body at addresses 20–27, three times.',  // what it does: fetches an 8-instruction loop three times
      after: 'Only the first pass misses (twice). Every later fetch reuses a cached block: <b>temporal locality</b>. This is why loops run fast.' },  // what it shows: only the first pass misses, twice; after that, temporal locality means every fetch hits
    rand: { label: 'Random', refs: [33, 0, 42, 12, 34, 4, 0, 58, 62, 13, 59, 24, 1, 3, 28, 50],  // "Random": 16 scattered addresses
      what: 'Reads addresses with no pattern, like jumping around a big table.',  // what it does: jumps around with no pattern
      after: 'Most blocks are touched once and then evicted before they are needed again, so only 3 reads hit. <b>Little locality, little benefit</b>: the cache only helps programs that reuse and stay near their data.' },  // what it shows: most blocks are used once and evicted, so little locality means little benefit
    ping: { label: 'Ping-pong', refs: [0, 16, 1, 17, 2, 18, 3, 19, 0, 16, 1, 17],  // "Ping-pong": alternates between block 0 and block 4
      what: 'Alternates between block 0 (words 0–3) and block 4 (words 16–19), like copying one array into another.',  // what it does: switches between two arrays, like copying one into another
      after: { direct: 'Direct mapping sends blocks 0 and 4 to the <b>same slot</b>, so each read evicts the other: every read misses while 3 slots sit empty. Now switch to associative mapping and run it again.',  // what it shows under direct mapping: blocks 0 and 4 share a slot and keep evicting each other, so every read misses
        assoc: 'Associative mapping lets blocks 0 and 4 sit in different slots, so after the first two misses every read hits. Under direct mapping the same program gets 0 hits.' } },  // what it shows under associative mapping: the two blocks sit in different slots, so later reads all hit
  };  // closes PROGRAMS

  Guide.section({  // registers this section with the guide; the object below holds everything the section shows
    id: '1.6',  // the section number, used in links, the side menu and saved progress
    title: 'Cache Memory',  // the full title shown at the top of every step
    short: 'Cache memory',  // the short name used in the side menu and progress list
    summary: 'How a small, fast cache hides slow main memory: blocks, tags, hits, mapping, replacement, writes.',  // one-sentence summary shown on the chapter page
    objectives: [  // what the student should be able to do after this section, shown on its first page
      'Explain why processors need a cache (the speed gap, every instruction fetch touches memory) and why a cache works (locality).',  // objective 1: why processors need a cache and why it works
      'Describe how main memory is divided into blocks, how cache slots and tags record which blocks are present, and trace a read through a hit and a miss.',  // objective 2: blocks, slots and tags, and tracing a hit and a miss
      'Split an address into tag, slot and word fields for a direct-mapped cache, and contrast direct mapping with associative mapping and LRU replacement.',  // objective 3: splitting an address into fields, and direct versus associative mapping with LRU
      'Explain how cache size, block size and write policy (write-through vs write-back) affect performance and correctness.',  // objective 4: cache size, block size and write policy
      'Describe why modern computers stack several levels of cache (L1, L2, L3).',  // objective 5: why computers have several levels of cache
    ],  // closes the objectives list
    terms: [  // key terms for the glossary, each written as [term, definition]
      ['Cache memory (cache)', 'A small, very fast memory placed between the processor and main memory that holds copies of the parts of main memory in current use. Hardware fills it and chooses what to replace without help from programs or, normally, from the OS.'],  // glossary entry: cache memory
      ['Word', 'The unit of data the processor reads or writes in one memory access. Every word in main memory has its own address.'],  // glossary entry: word
      ['Block', 'A fixed-size group of K neighbouring words. Blocks are the unit copied between main memory and the cache: a miss brings in a whole block, never a single word.'],  // glossary entry: block
      ['Slot (cache line)', 'One place in the cache that can hold exactly one block, together with the tag that says which block it is.'],  // glossary entry: slot (cache line)
      ['Tag', 'A few bits stored with each cache slot that identify which main-memory block the slot currently holds.'],  // glossary entry: tag
      ['Cache hit (hit)', 'A memory access whose word is already in the cache, so it is delivered at cache speed.'],  // glossary entry: cache hit
      ['Cache miss (miss)', 'A memory access whose word is not in the cache, so its whole block must first be copied in from slower main memory.'],  // glossary entry: cache miss
      ['Hit ratio', 'The fraction of memory accesses that are hits: hits ÷ total accesses. A higher hit ratio means the processor waits for main memory less often.'],  // glossary entry: hit ratio
      ['Locality of reference (locality)', 'The tendency of programs to reuse the same memory locations soon (temporal locality) and to use locations near recently used ones (spatial locality).'],  // glossary entry: locality of reference
      ['Mapping function', 'The rule that decides which cache slot (or slots) a given main-memory block is allowed to occupy.'],  // glossary entry: mapping function
      ['Direct mapping', 'A mapping function in which every block has exactly one slot it can use: slot = block number mod C. Simple and fast, but blocks that share a slot evict each other.'],  // glossary entry: direct mapping
      ['Associative mapping', 'A mapping function in which a block may be placed in any slot (also called fully associative). Flexible, but every slot’s tag must be checked on each access.'],  // glossary entry: associative mapping
      ['Set-associative mapping', 'A compromise mapping: slots are grouped into small sets; a block maps to one set (like direct mapping) but may use any slot within that set (like associative mapping).'],  // glossary entry: set-associative mapping
      ['Replacement algorithm', 'The rule that picks which block to throw out of the cache when a new block must be loaded and there is a choice of slot.'],  // glossary entry: replacement algorithm
      ['Least recently used (LRU)', 'A replacement algorithm that evicts the block that has gone unused for the longest time, betting that it is the least likely to be needed soon.'],  // glossary entry: least recently used (LRU)
      ['Write policy', 'The rule for when main memory is updated after the processor writes to a word that is in the cache.'],  // glossary entry: write policy
      ['Write-through', 'A write policy in which every write goes to both the cache and main memory at once, so main memory is never out of date.'],  // glossary entry: write-through
      ['Write-back', 'A write policy in which writes update only the cache; the changed block is copied to main memory later, when it is evicted.'],  // glossary entry: write-back
      ['Dirty bit', 'A one-bit flag per cache slot (also called the modified or update bit) that is set when the block has been written, so the cache knows it must be written back before being replaced.'],  // glossary entry: dirty bit
      ['Multilevel cache', 'A stack of caches (L1, L2, L3) between the processor and main memory, each larger and slower than the one above it.'],  // glossary entry: multilevel cache (L1, L2, L3)
    ],  // closes the key terms list
    css: ` /* style rules used only by this section; every selector starts with .sec-1-6 so it cannot affect other sections */
      .sec-1-6 .hot { cursor: pointer; } /* clickable drawing parts show a pointer cursor */
      .sec-1-6 .hot:hover rect, .sec-1-6 .hot:hover path { filter: brightness(0.97); } /* hovering over a clickable part darkens its shapes very slightly so the student sees it responds */
      .sec-1-6 .s-cache { fill: var(--accent-bg); stroke: var(--accent); } /* the cache's own shape style: accent-coloured fill and outline, used wherever the cache is drawn */
      .sec-1-6 .tx-acc { fill: var(--accent); } /* SVG text colour class: accent */
      .sec-1-6 .tx-ok { fill: var(--ok); } /* SVG text colour class: correct (green), used for hits */
      .sec-1-6 .tx-bad { fill: var(--bad); } /* SVG text colour class: wrong (red), used for misses */
      .sec-1-6 .tx-mem { fill: var(--mem); } /* SVG text colour class: memory colour */
      .sec-1-6 .tx-cpu { fill: var(--cpu); } /* SVG text colour class: processor colour */
      .sec-1-6 .tx-muted { fill: var(--muted); } /* SVG text colour class: muted grey */
      .sec-1-6 .c-acc { color: var(--accent); } /* HTML text colour class: accent */
      .sec-1-6 .c-ok { color: var(--ok); } /* HTML text colour class: correct (green) */
      .sec-1-6 .c-bad { color: var(--bad); } /* HTML text colour class: wrong (red) */
      .sec-1-6 .c-mem { color: var(--mem); } /* HTML text colour class: memory colour */
      .sec-1-6 .c-cpu { color: var(--cpu); } /* HTML text colour class: processor colour */
    `,  // end of this section's style rules
    steps: [  // steps: the list of screens in this section, shown one at a time in this order
      /* ---------------------------------------------------------------- 1. Big picture */
      {  // step 1 starts here
        title: 'The speed gap, and the small memory that hides it',  // title of step 1, shown at the top of the screen
        kind: 'story',  // kind "story" labels the step as the Big Picture
        render(el, ctx) {  // render(el, ctx) builds the step when the student arrives; el is the step's box, ctx carries the guide helpers
          const { h, s } = ctx;  // h builds HTML elements and s builds SVG drawing elements (both are guide helpers)
          const INFO = {  // INFO: the explanation for each clickable part of the drawing, as [title, colour, text]
            cpu: ['Processor', 'cpu', 'Runs billions of instructions per second. Every one begins with an <b>instruction fetch</b> from memory, so the processor asks memory for words constantly.'],  // part: the processor, which fetches an instruction from memory on every cycle
            word: ['Word transfer (fast)', 'cpu', 'On a <b>hit</b> the cache hands the processor just the one word it asked for, within a few processor cycles. No trip to main memory is needed.'],  // part: the one-word transfer between cache and processor on a hit
            cache: ['Cache', 'acc', 'Tens of kilobytes (the level nearest the processor) to tens of megabytes (the largest level) of very fast memory holding <b>copies</b> of recently used parts of main memory. Hardware runs it: neither your program nor the OS decides what goes in it.'],  // part: the cache, a small fast memory holding copies, run by hardware
            block: ['Block transfer (slower)', 'mem', 'On a <b>miss</b> the cache fetches the whole <b>block</b> of neighbouring words that contains the wanted word. Moving a block costs more than moving one word, but the neighbours are likely to be wanted next, so the trip pays off.'],  // part: the whole-block transfer from main memory on a miss
            mem: ['Main memory', 'mem', 'Gigabytes of space, but each access takes tens of nanoseconds: long enough for the processor to have run hundreds of instructions. It is divided into fixed-size blocks, the unit the cache copies.'],  // part: main memory, big but slow, divided into blocks
          };  // closes INFO
          const info = h('div', { class: 'card tight', style: { minHeight: '118px', flex: 'none' } });  // the explanation box under the drawing; its minimum height stops the layout from jumping
          let sel = null;  // sel remembers which part is selected
          const groups = {};  // groups will hold each clickable part of the drawing, keyed by name
          function pick(k) {  // pick(k): selects part k when it is clicked
            sel = k;  // remembers the selection
            const [t, c, body] = INFO[k];  // unpacks the part's title, colour and text
            info.innerHTML = `<div class="b c-${c === 'acc' ? 'acc' : c}" style="margin-bottom:2px">${t}</div><div class="small">${body}</div>`;  // shows the title in the part's colour with the explanation under it
            Object.entries(groups).forEach(([kk, g]) => g.style.opacity = kk === k ? '1' : '0.55');  // dims every other part so the chosen one stands out
          }  // ends pick
          const svg = s('svg', { viewBox: '0 0 640 250', width: '100%' });  // the drawing area, with its own 640 by 250 coordinate grid
          // processor
          groups.cpu = hotGroup(ctx, () => pick('cpu'), 'Processor',  // clickable processor part
            s('rect', { x: 10, y: 70, width: 130, height: 100, rx: 14, class: 's-cpu', 'stroke-width': 2.5 }),  // the processor box
            s('text', { x: 75, y: 115, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 18 }, 'Processor'),  // its name
            s('text', { x: 75, y: 140, 'text-anchor': 'middle', 'font-size': 14, class: 's-sub' }, 'cycle < 1 ns'));  // its cycle time, under one nanosecond
          // word transfer arrows
          groups.word = hotGroup(ctx, () => pick('word'), 'Word transfer',  // clickable word-transfer part
            s('rect', { x: 146, y: 88, width: 92, height: 64, fill: 'transparent', stroke: 'none' }),  // an invisible rectangle behind the arrows so the whole gap is easy to click
            s('line', { x1: 148, y1: 110, x2: 232, y2: 110, class: 's-line', 'marker-end': 'url(#arr-cpu)', style: 'stroke:var(--cpu)' }),  // arrow from the processor to the cache (the request)
            s('line', { x1: 232, y1: 130, x2: 148, y2: 130, class: 's-line', 'marker-end': 'url(#arr-cpu)', style: 'stroke:var(--cpu)' }),  // arrow from the cache back to the processor (the word)
            s('text', { x: 190, y: 80, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700, class: 'tx-cpu' }, 'one word'),  // label above the arrows: one word
            s('text', { x: 190, y: 160, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, 'fast'));  // label below the arrows: fast
          // cache
          groups.cache = hotGroup(ctx, () => pick('cache'), 'Cache',  // clickable cache part
            s('rect', { x: 240, y: 80, width: 120, height: 80, rx: 12, class: 's-cache', 'stroke-width': 2.5 }),  // the cache box
            s('text', { x: 300, y: 115, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 18, class: 'tx-acc' }, 'Cache'),  // its name
            s('text', { x: 300, y: 140, 'text-anchor': 'middle', 'font-size': 14, class: 's-sub' }, '≈ 1–10 ns'));  // its access time, about 1-10 ns
          // block transfer arrows
          groups.block = hotGroup(ctx, () => pick('block'), 'Block transfer',  // clickable block-transfer part
            s('rect', { x: 366, y: 70, width: 110, height: 100, fill: 'transparent', stroke: 'none' }),  // an invisible rectangle behind the arrows so the whole gap is easy to click
            s('line', { x1: 470, y1: 110, x2: 368, y2: 110, class: 's-line', 'marker-end': 'url(#arr-mem)', style: 'stroke:var(--mem)' }),  // arrow from main memory to the cache (the block coming in)
            s('line', { x1: 368, y1: 130, x2: 470, y2: 130, class: 's-line', 'marker-end': 'url(#arr-mem)', style: 'stroke:var(--mem)' }),  // arrow from the cache to main memory
            ...[0, 1, 2, 3].map((i) => s('rect', { x: 392 + i * 14, y: 90, width: 12, height: 12, rx: 2, class: 's-mem', 'stroke-width': 1.5 })),  // four small squares above the arrows showing the four words of one block
            s('text', { x: 420, y: 80, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700, class: 'tx-mem' }, 'whole block'),  // label above: whole block
            s('text', { x: 420, y: 162, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, 'slower'));  // label below: slower
          // main memory with block stripes
          const memKids = [s('rect', { x: 478, y: 10, width: 150, height: 220, rx: 12, class: 's-mem', 'stroke-width': 2.5 })];  // memKids starts with the big main memory box
          for (let i = 0; i < 8; i++) memKids.push(s('rect', { x: 492, y: 46 + i * 20, width: 122, height: 16, rx: 4, fill: 'var(--panel)', style: 'stroke:var(--mem);opacity:.9', 'stroke-width': 1 }));  // adds eight stripes inside it, one per block, to show that memory is divided into blocks
          memKids.push(s('text', { x: 553, y: 34, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 17 }, 'Main memory'));  // the main memory title
          memKids.push(s('text', { x: 553, y: 222, 'text-anchor': 'middle', 'font-size': 14, class: 's-sub' }, '≈ 50–100 ns'));  // its access time, about 50-100 ns
          groups.mem = hotGroup(ctx, () => pick('mem'), 'Main memory', ...memKids);  // wraps all of it as the clickable main memory part
          svg.append(groups.cpu, groups.word, groups.cache, groups.block, groups.mem,  // adds the five parts to the drawing
            s('text', { x: 300, y: 205, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, 'times are rough, typical figures'));  // plus a note that the times are rough, typical figures
          info.innerHTML = '<div class="b">Click any part of the picture.</div><div class="small muted">Each part explains its job. Try the two kinds of arrow too: they carry different amounts of data.</div>';  // starting text of the explanation box, inviting the student to click the parts

          el.append(h('div', { class: 'split l fill' },  // lays the step out in two columns: explanation on the left, the drawing on the right
            h('div', { class: 'stack' },  // left column
              h('p', { class: 'lead m0', html: 'A processor can finish a simple instruction in about a nanosecond, often less. Fetching one <span class="t">word</span> from main memory takes roughly <b>a hundred times longer</b>.' }),  // opening paragraph: a memory fetch takes about a hundred times longer than a simple instruction
              h('p', { class: 'm0', html: 'Every instruction cycle touches memory at least once, because the processor must <b>fetch the instruction</b> before it can run it. Memory speed therefore caps processor speed, and for decades processors have sped up far faster than memory chips.' }),  // paragraph: every instruction must be fetched from memory, so memory speed caps processor speed
              h('p', { class: 'm0', html: 'The fix is a <span class="t">cache</span>: a small, very fast memory between the two that keeps copies of the pieces of memory in use right now. It works because of <span class="t">locality of reference</span> (see 1.5): programs keep reusing the same and neighbouring locations.' }),  // paragraph: the fix is a cache, and it works because of locality
              h('div', { class: 'callout why m0', 'data-label': 'Why an OS course cares', html: 'The OS does not choose what the cache holds, but its choices (how often it switches programs, how it lays out memory) decide how well the cache works. The same idea returns later as virtual memory and disk caching.' })),  // callout: why an operating system course cares about the cache
            h('div', { class: 'stack' },  // right column
              h('div', { class: 'card white', style: { padding: '8px 10px' } }, svg),  // white card holding the drawing
              info,  // the explanation box that pick() fills
              h('div', { class: 'callout analogy m0', 'data-label': 'Analogy', html: 'A chef keeps tonight’s ingredients on the counter instead of walking to the storeroom for every pinch of salt. When something is missing, the chef brings back the whole crate, because the rest of it will probably be needed soon.' }))));  // callout: the chef analogy, bringing back the whole crate
        },  // ends render() for step 1
      },  // ends step 1
      /* ---------------------------------------------------------------- 2. Blocks, slots, tags */
      {  // step 2 starts here
        title: 'Blocks, slots and tags: how a cache is organized',  // title of step 2
        kind: 'learn',  // kind "learn" labels it a Learn screen
        render(el, ctx) {  // render() builds step 2 when the student arrives on it
          const { h, s } = ctx;  // h builds HTML elements and s builds SVG drawing elements
          const HELD = [12, 9, 2, 7];                    // block held by slot 0..3 (tag = block number here)
          const slotOf = (b) => HELD.indexOf(b);  // slotOf(b): which slot holds block b, or -1 if it is not in the cache
          const info = h('div', { class: 'card tight small', style: { minHeight: '74px' } });  // the explanation box under the drawing; its minimum height stops the layout from jumping
          const svg = s('svg', { viewBox: '0 0 640 430', width: '100%' });  // the drawing area: main memory on the left, the four cache slots on the right
          let selAddr = null, selSlot = null;  // the student's selection: a memory address, or a cache slot, or neither
          const rowBox = [], wordRect = [], slotRect = [];  // rowBox, wordRect and slotRect keep the outline shapes that update() highlights
          const kids = [  // kids collects every piece of the drawing before it is added in one go
            s('text', { x: 150, y: 18, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 15, class: 'tx-mem' }, 'Main memory: 64 words = 16 blocks of 4'),  // heading over the memory column: 64 words in 16 blocks of 4
            s('text', { x: 510, y: 18, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 15, class: 'tx-acc' }, 'Cache: 4 slots'),  // heading over the cache column: 4 slots
          ];  // closes the starting list of pieces
          for (let b = 0; b < NBLOCKS; b++) {  // draws main memory one block (one row of four words) at a time
            const y = 30 + b * 25, cached = slotOf(b) >= 0;  // y is the row's position; cached is true if a slot holds this block
            kids.push(s('text', { x: 40, y: y + 15, 'text-anchor': 'end', 'font-size': 13, 'font-weight': 700, class: cached ? 'tx-acc' : 'tx-muted' }, 'B' + b));  // the block's label, B0 to B15, in the accent colour if it is cached
            rowBox[b] = s('rect', { x: 45, y: y - 1, width: 216, height: 23, rx: 5, fill: 'none', 'stroke-width': 0 });  // an outline around the whole row, invisible until the block is selected
            kids.push(rowBox[b]);  // adds that outline to the drawing
            for (let w = 0; w < K; w++) {  // draws the four words of this block
              const a = b * K + w;  // a is the word's address: block number times 4 plus its place in the block
              wordRect[a] = s('rect', { x: 48 + w * 53, y: y + 1, width: 50, height: 19, rx: 4, class: cached ? 's-cache' : 's-mem', 'stroke-width': 1 });  // the word's box, tinted in the cache colour if its block is cached
              kids.push(hotGroup(ctx, () => { selAddr = a; selSlot = null; update(); }, 'Address ' + a, wordRect[a],  // makes the word clickable; clicking it selects this address and clears any slot selection
                s('text', { x: 73 + w * 53, y: y + 15, 'text-anchor': 'middle', 'font-size': 13, class: 's-monot' }, String(a))));  // the address number inside the word's box
            }  // ends the word loop
            if (cached) kids.push(s('text', { x: 268, y: y + 15, 'font-size': 12, class: 'tx-acc' }, '→ slot ' + slotOf(b)));  // for a cached block, an arrow note to the right saying which slot holds it
          }  // ends the block loop
          for (let i = 0; i < NSLOTS; i++) {  // draws the four cache slots
            const y = 36 + i * 96, b = HELD[i];  // each slot sits 96 units below the last; b is the block it holds
            slotRect[i] = s('rect', { x: 380, y, width: 256, height: 82, rx: 10, class: 's-cache', 'stroke-width': 1.5 });  // the slot's outline box
            kids.push(hotGroup(ctx, () => { selSlot = i; selAddr = null; update(); }, 'Slot ' + i, slotRect[i],  // makes the slot clickable; clicking it selects the slot and clears any address selection
              s('text', { x: 392, y: y + 22, 'font-weight': 800, 'font-size': 14 }, 'Slot ' + i),  // the slot's name
              s('rect', { x: 452, y: y + 7, width: 172, height: 22, rx: 5, fill: 'var(--panel)', stroke: 'var(--accent)' }),  // a small box that holds the tag
              s('text', { x: 538, y: y + 23, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 700, class: 'tx-acc' }, 'tag: block ' + b),  // the tag's text, naming the block this slot holds
              ...[0, 1, 2, 3].map((w) => s('g', {},  // the four word boxes inside the slot
                s('rect', { x: 392 + w * 60, y: y + 40, width: 54, height: 30, rx: 5, fill: 'var(--panel)', stroke: 'var(--line-2)' }),  // each word box's outline
                s('text', { x: 419 + w * 60, y: y + 60, 'text-anchor': 'middle', 'font-size': 13, class: 's-monot' }, 'm[' + (b * K + w) + ']')))));  // each word box's label, m[address], naming the memory word it is a copy of
          }  // ends the slot loop
          svg.append(...kids);  // adds all the pieces to the drawing
          function update() {  // update(): redraws the highlights and the explanation after each click
            const selBlock = selAddr != null ? selAddr >> 2 : (selSlot != null ? HELD[selSlot] : null);  // selBlock is the block to highlight: the chosen address's block, or the block in the chosen slot
            rowBox.forEach((r, b) => { r.setAttribute('stroke-width', b === selBlock ? 2.5 : 0); r.style.stroke = b === selBlock ? 'var(--ink)' : ''; });  // outlines the selected block's row in memory and hides the other row outlines
            wordRect.forEach((r, a) => { r.setAttribute('stroke-width', a === selAddr ? 2.5 : 1); r.style.stroke = a === selAddr ? 'var(--ink)' : ''; });  // outlines the selected word and returns the others to normal
            slotRect.forEach((r, i) => r.setAttribute('stroke-width', selSlot === i || HELD[i] === selBlock ? 3.5 : 1.5));  // thickens the outline of the chosen slot, or of the slot holding the selected block
            if (selAddr != null) {  // if an address is selected
              const b = selAddr >> 2, w = selAddr & 3, sl = slotOf(b);  // work out its block, its word within the block, and the slot holding it (if any)
              info.innerHTML = `<b>Address ${selAddr}</b> is word ${w} of <b>block ${b}</b> (${selAddr} ÷ ${K} = ${b} remainder ${w}); block ${b} holds addresses ${b * K}–${b * K + 3}. ` +  // explains the split: address ÷ 4 gives the block number and the remainder gives the word
                (sl >= 0 ? `<span class="c-ok b">In the cache:</span> slot ${sl}’s tag says “block ${b}”, so reading ${selAddr} would be a <b>hit</b>.`  // if a slot's tag names this block, reading the address would be a hit
                  : `<span class="c-bad b">Not in the cache:</span> no slot’s tag says “block ${b}”, so reading ${selAddr} would be a <b>miss</b> and the whole block would be copied in.`);  // otherwise it would be a miss, and the whole block would be copied in
            } else if (selSlot != null) {  // if a slot is selected instead
              const b = HELD[selSlot];  // b is the block that slot holds
              info.innerHTML = `<b>Slot ${selSlot}</b> holds a copy of <b>block ${b}</b> (addresses ${b * K}–${b * K + 3}). Sixteen blocks share four slots, so the <b>tag</b> is what records which block this slot holds right now. (Here the tag is simply the block number; step 4 shows how direct mapping stores fewer bits.)`;  // explains that the slot holds a copy of the block and that the tag records which one
            } else info.innerHTML = '<b>Click any memory word or any cache slot.</b> <span class="muted">Tinted words currently have a copy in the cache.</span>';  // with nothing selected, invites the student to click a word or a slot
          }  // ends update
          update();  // shows the starting invitation

          // live size calculator
          const out = h('div', { class: 'small', style: { lineHeight: '1.55' } });  // the result line of the size calculator
          let n = 16, ke = 2, ce = 8;  // starting settings: 16 address bits, 2^2 = 4 words per block, 2^8 = 256 cache slots (the sliders hold exponents)
          const calc = () => {  // calc(): recomputes the calculator result from the three settings
            const words = 2 ** n, kk = 2 ** ke, M = words / kk, C = 2 ** ce;  // words in memory = 2^n, words per block = 2^ke, blocks M = words / K, and slots C = 2^ce
            const pct = (100 * C) / M;  // pct is how much of memory the cache can hold at once, as a percentage
            // C is kept at most M / 4 (see fixC), so the cache is always much smaller than memory
            out.innerHTML = `2<sup>${n}</sup> = <b>${words.toLocaleString('en-US')}</b> words ÷ K = ${kk} → <b>M = ${M.toLocaleString('en-US')} blocks</b>. ` +  // result part 1: the number of words divided by K gives M blocks
              `<b>C = ${C.toLocaleString('en-US')} slots</b>: one per ${(M / C).toLocaleString('en-US')} blocks (${pct >= 0.01 ? ctx.util.fmt(pct, 2) : 'under 0.01'}% of memory).`;  // result part 2: C slots, one per M/C blocks, and the percentage of memory that is
          };  // ends calc
          const sC = ctx.ui.slider({ label: 'Cache slots C', min: 2, max: 12, value: ce, format: (v) => String(2 ** v), onInput: (v) => { ce = v; calc(); } });  // slider for the number of cache slots; it moves through powers of two from 4 to 4,096
          // n ≥ 10 and K ≤ 64 guarantee n − log2K − 2 ≥ 2, so the C slider's max never drops below its min
          const fixC = () => { const mx = Math.min(12, n - ke - 2); sC.input.max = mx; if (ce > mx) { ce = mx; sC.set(ce); } calc(); };  // fixC(): caps the slot slider at a quarter of the blocks (and at 4,096), lowering C if it is now too big
          const sN = ctx.ui.slider({ label: 'Address bits n', min: 10, max: 32, value: n, onInput: (v) => { n = v; fixC(); } });  // slider for the number of address bits, 10 to 32; moving it rechecks the slot limit
          const sK = ctx.ui.slider({ label: 'Words per block K', min: 0, max: 6, value: ke, format: (v) => String(2 ** v), onInput: (v) => { ke = v; fixC(); } });  // slider for the block size K, a power of two from 1 to 64; moving it rechecks the slot limit
          fixC();  // sets the slot limit and shows the first result

          el.append(h('div', { class: 'split l fill' },  // lays the step out in two columns: explanation and calculator on the left, the drawing on the right
            h('div', { class: 'stack' },  // left column
              h('p', { class: 'm0', html: 'Main memory is a long row of <span class="t">words</span>, each with an n-bit address, so there are <b>2<sup>n</sup></b> of them. For caching, memory is cut into fixed-size <span class="t">blocks</span> of <b>K</b> words each, giving <b>M = 2<sup>n</sup> / K</b> blocks.' }),  // paragraph: memory is 2^n words, cut into blocks of K words, giving M blocks
              h('p', { class: 'm0', html: 'The cache has <b>C</b> <span class="t">slots</span> (also called lines). Each slot holds one whole block of K words plus a <span class="t">tag</span> that names the block. Because <b>C is far smaller than M</b>, blocks take turns in the slots; only the tag records which block a slot holds right now.' }),  // paragraph: the cache has C slots, each holding one block plus a tag naming it
              h('div', { class: 'card stack gap-s', style: { padding: '10px 12px', flex: 'none' } }, h('h4', { class: 'm0' }, 'Size calculator'), sN, sK, sC, out),  // card holding the size calculator: its heading, three sliders and the result
              h('p', { class: 'small muted m0', html: 'At real scale (every byte has its own address), 16 GB of memory in 64-byte blocks is about 268 million blocks; a 32 KB first-level cache has just 512 slots.' })),  // note: at real scale, 16 GB in 64-byte blocks is about 268 million blocks, against 512 slots in a 32 KB cache
            h('div', { class: 'stack gap-s' }, h('div', { class: 'card white', style: { padding: '6px 8px' } }, svg), info)));  // right column: the drawing card and the explanation box
        },  // ends render() for step 2
      },  // ends step 2
      /* ---------------------------------------------------------------- 3. Read operation */
      {  // step 3 starts here
        title: 'A cache read, box by box: hit path vs miss path',  // title of step 3
        kind: 'explore',  // kind "explore" labels it an Explore screen
        core: true,  // core: true keeps this step on the shorter Core path
        render(el, ctx) {  // render() builds step 3 when the student arrives on it
          const { h, s } = ctx;  // h builds HTML elements and s builds SVG drawing elements
          const N = {  // N: the boxes of the read flowchart, each with its centre, size, shape and text lines
            start: { x: 280, y: 30, w: 360, h: 38, pill: 1, t: ['Receive address RA from the processor'] },  // start box (rounded pill): receive the address RA from the processor
            dec: { x: 280, y: 124, w: 300, h: 100, dia: 1, t: ['Is the block holding RA', 'already in the cache?'] },  // decision diamond: is the block holding RA already in the cache?
            fetch: { x: 460, y: 250, w: 190, h: 52, t: ['Fetch word RA', 'from its cache slot'] },  // hit path box: fetch word RA from its cache slot
            dlvH: { x: 460, y: 345, w: 190, h: 52, t: ['Deliver word RA', 'to the processor'] },  // hit path box: deliver word RA to the processor
            mem: { x: 110, y: 250, w: 210, h: 52, t: ['Read the whole block', 'holding RA from memory'] },  // miss path box: read the whole block holding RA from main memory
            alloc: { x: 110, y: 330, w: 210, h: 52, t: ['Allocate a cache slot', '(evict a block if needed)'] },  // miss path box: allocate a cache slot, evicting a block if needed
            load: { x: 60, y: 418, w: 108, h: 52, t: ['Load block', 'into slot'] },  // miss path box: load the block into the slot (happens alongside the next box)
            dlvM: { x: 172, y: 418, w: 108, h: 52, t: ['Deliver word', 'to processor'] },  // miss path box: deliver the word to the processor
            done: { x: 280, y: 494, w: 140, h: 34, pill: 1, t: ['Done'] },  // end box (rounded pill): done
          };  // closes N
          const E = {  // E: the flowchart's connecting lines, written as SVG path commands (M = move to, H and V = horizontal and vertical lines)
            s_d: 'M280,49 V72', d_f: 'M430,124 H460 V222', f_h: 'M460,276 V317', h_x: 'M460,371 V494 H352',  // lines: start to decision, decision to fetch (yes side), fetch to deliver, deliver to done
            d_m: 'M130,124 H110 V222', m_a: 'M110,276 V302', a_l: 'M110,356 V372 H60 V390', a_v: 'M110,372 H172 V390',  // lines: decision to memory read (no side), memory read to allocate, allocate splitting to load and to deliver
            l_x: 'M60,444 V494 H208', v_x: 'M172,444 V494',  // lines: load to done and deliver to done
          };  // closes E
          const HIT = [['start'], ['s_d', 'dec'], ['d_f', 'fetch'], ['f_h', 'dlvH'], ['h_x', 'done']];  // HIT: the order in which the flowchart lights up on a hit; each entry lists the lines and boxes lit at that moment
          const MISS = [['start'], ['s_d', 'dec'], ['d_m', 'mem'], ['m_a', 'alloc'], ['a_l', 'a_v', 'load', 'dlvM'], ['l_x', 'v_x', 'done']];  // MISS: the lighting order on a miss; the fifth entry lights "load" and "deliver" together because they happen at once
          const svg = s('svg', { viewBox: '0 0 560 516', width: '100%' });  // the flowchart drawing
          const nodeEl = {}, edgeEl = {};  // nodeEl and edgeEl will hold each box and each line, keyed by name, so paint() can recolour them
          for (const [k, d] of Object.entries(E)) edgeEl[k] = s('path', { d, class: 's-muted', fill: 'none', 'marker-end': 'url(#arr-muted)' });  // builds each connecting line as a grey path with a grey arrowhead
          for (const [k, n] of Object.entries(N)) {  // builds each box of the flowchart
            const shape = n.dia  // the decision box is drawn as a diamond
              ? s('polygon', { points: `${n.x},${n.y - n.h / 2} ${n.x + n.w / 2},${n.y} ${n.x},${n.y + n.h / 2} ${n.x - n.w / 2},${n.y}`, class: 's-panel', 'stroke-width': 2 })  // a diamond: four corners at the top, right, bottom and left of the box's centre
              : s('rect', { x: n.x - n.w / 2, y: n.y - n.h / 2, width: n.w, height: n.h, rx: n.pill ? n.h / 2 : 9, class: 's-panel', 'stroke-width': 2 });  // every other box is a rectangle, with fully rounded ends for the start and end pills
            const ty = n.y - (n.t.length - 1) * 8.5 + 5;  // ty is where the first text line goes so that the lines sit centred in the box
            nodeEl[k] = s('g', {}, shape, mtext(s, n.x, ty, n.t, { 'text-anchor': 'middle', 'font-size': 14, 'font-weight': k === 'dec' ? 700 : 600 }, 17));  // groups the shape with its centred text; the question in the diamond is bolder
          }  // ends the box loop
          svg.append(...Object.values(edgeEl), ...Object.values(nodeEl),  // adds all lines first (so boxes sit on top of them), then all boxes, then the labels
            s('text', { x: 440, y: 114, 'font-size': 13.5, 'font-weight': 800, class: 'tx-ok' }, 'Yes: hit'),  // label on the right branch of the diamond: yes, a hit
            s('text', { x: 120, y: 114, 'text-anchor': 'end', 'font-size': 13.5, 'font-weight': 800, class: 'tx-bad' }, 'No: miss'),  // label on the left branch: no, a miss
            s('text', { x: 232, y: 423, 'font-size': 12.5, class: 's-sub' }, '← at the'),  // note beside the load and deliver boxes, first line: "at the"
            s('text', { x: 232, y: 439, 'font-size': 12.5, class: 's-sub' }, 'same time'));  // second line: "same time"
          function paint(path, upto, kind) {  // paint(path, upto, kind): lights the first upto entries of a path, in green for a hit or red for a miss
            const lit = new Set(path.slice(0, upto).flat());  // lit collects the names of every box and line that should be lit
            for (const [k, g] of Object.entries(nodeEl)) g.firstChild.setAttribute('class', lit.has(k) ? (kind === 'hit' ? 's-ok' : 's-bad') : 's-panel');  // recolours each box: green or red if lit, plain grey otherwise
            for (const [k, p] of Object.entries(edgeEl)) {  // recolours each line
              const on = lit.has(k);  // on is true if this line is lit
              p.setAttribute('class', on ? 's-line' : 's-muted');  // lit lines are drawn solid, unlit ones grey
              p.style.stroke = on ? (kind === 'hit' ? 'var(--ok)' : 'var(--bad)') : '';  // a lit line takes the green or red colour
              p.setAttribute('marker-end', on ? (kind === 'hit' ? 'url(#arr-ok)' : 'url(#arr-bad)') : 'url(#arr-muted)');  // and its arrowhead matches
            }  // ends the line loop
          }  // ends paint
          // tiny cache model: 4 slots, first empty slot else least recently used
          let slots, t, hits, misses, token = 0;  // cache state for this step: slots, clock, hit and miss counts; token cancels an animation when a new one starts
          const cacheBox = h('div', { class: 'grid-2', style: { gap: '8px' } });  // the grid of four slot boxes under the buttons
          const narr = h('div', { class: 'card tight small', style: { minHeight: '98px' } });  // the explanation box that narrates each read; its minimum height stops the layout from jumping
          const score = h('div', { class: 'row', style: { gap: '8px' } });  // the hit and miss counters
          function drawCache(fresh) {  // drawCache(fresh): redraws the four slots; slot number fresh gets a flash effect because it was just loaded
            cacheBox.replaceChildren(...slots.map((sl, i) => h('div', {  // replaces the slot boxes with one box per slot
              class: 'box' + (i === fresh ? ' flash' : ''), style: { borderColor: 'var(--accent)', background: sl ? 'var(--accent-bg)' : 'var(--panel-2)', padding: '5px 8px', fontSize: '14.5px', textAlign: 'left' },  // each box has an accent border, a tinted background when full, and flashes if it was just loaded
              html: `<span class="xs muted">Slot ${i}</span><br>` + (sl ? `<b class="c-acc">block ${sl.b}</b> <span class="small muted">(${sl.b * K}–${sl.b * K + 3})</span>` : '<span class="muted">empty</span>'),  // the box shows the slot number and either the block it holds with its address range, or "empty"
            })));  // ends the slot boxes
            score.innerHTML = `<span class="chip ok">hits ${hits}</span><span class="chip bad">misses ${misses}</span>`;  // updates the hit and miss counters
          }  // ends drawCache
          function reset() { token++; slots = [null, null, null, null]; t = 0; hits = 0; misses = 0; paint(HIT, 0, 'hit'); drawCache(-1); narr.innerHTML = '<b>Click an address above.</b> <span class="muted">The cache starts empty. Try them left to right and predict each result first. In this cache a new block takes any empty slot; once all 4 are full, the block left unused the longest is evicted.</span>'; }  // reset(): empties the cache, clears the counts and flowchart, stops any animation, and shows the instructions
          async function read(a) {  // read(a): runs one read of address a, updating the cache first and then animating the flowchart path
            const my = ++token, b = a >> 2;  // my is this read's ticket (a newer click or reset makes it stale); b is the block holding address a
            drawCache(-1);  // redraws the slots with no flash
            t++;  // advances the clock
            let i = slots.findIndex((sl) => sl && sl.b === b);  // looks for a slot that already holds block b
            const hit = i >= 0;  // found means a hit
            let why = '';  // why will explain which slot a missed block went into
            if (hit) { slots[i].last = t; hits++; }  // on a hit: mark the slot as just used and count the hit
            else {  // on a miss
              misses++;  // count the miss
              i = slots.findIndex((sl) => !sl);  // look for an empty slot
              if (i >= 0) why = `slot ${i} was empty`;  // if there is one, the block goes there
              else { i = slots.reduce((m, sl, k) => (sl.last < slots[m].last ? k : m), 0); why = `evicting block ${slots[i].b}, the one unused for longest`; }  // otherwise evict the least recently used block
              slots[i] = { b, last: t };  // the new block takes the chosen slot, marked as used now
            }  // ends the miss branch
            narr.innerHTML = `<b>Read ${a}</b> → block ${b} (addresses ${b * K}–${b * K + 3}). Checking the tags…`;  // first narration: the address and its block, and that the tags are being checked
            const path = hit ? HIT : MISS;  // picks the hit path or the miss path
            for (let k = 1; k <= path.length; k++) {  // lights the path one stage at a time
              paint(path, k, hit ? 'hit' : 'miss');  // lights the stages up to k
              if (!hit && k === 5) drawCache(i);  // on a miss, the slot boxes show the block arriving when the "load block" stage lights
              await ctx.sleep(300);  // waits 0.3 s between stages
              if (!ctx.alive || my !== token) return;  // stops if the student left the step or clicked again, so two animations never overlap
            }  // ends the path loop
            drawCache(hit ? -1 : i);  // redraws the slots, flashing the newly loaded one after a miss
            narr.innerHTML = hit  // final narration depends on the result
              ? `<b>Read ${a}</b> → block ${b}. Slot ${i}’s tag says “block ${b}”: <b class="c-ok">HIT</b>. The word comes straight from the cache and main memory is never touched. This is the fast, common case.`  // hit narration: a tag matched, so the word came straight from the cache and memory was never touched
              : `<b>Read ${a}</b> → block ${b}. No tag matches: <b class="c-bad">MISS</b>. The cache reads <b>all four words</b> ${b * K}–${b * K + 3} from main memory into slot ${i} (${why}) and passes word ${a} to the processor as the block arrives.`;  // miss narration: no tag matched, so all four words were copied into a slot and the wanted word passed on
          }  // ends read
          const addrs = [13, 14, 40, 12, 41, 7, 60, 2];  // addrs: the addresses on the Read buttons, chosen so the student sees misses, hits and an eviction
          const btns = h('div', { class: ctx.narrow ? 'row' : 'row nw', style: { gap: '5px' } }, h('span', { class: 'small b', style: { marginRight: '2px' } }, 'Read:'),  // the button row; it may wrap onto more lines on a phone-width screen
            ...addrs.map((a) => h('button', { class: 'btn sm', style: { minWidth: '40px' }, title: 'Read address ' + a, onclick: () => read(a) }, String(a))),  // one button per address; clicking it reads that address
            h('button', { class: 'btn sm ghost', onclick: reset }, 'Empty cache'));  // a button that empties the cache and starts over
          reset();  // starts with an empty cache
          el.append(h('div', { class: 'split fill' },  // lays the step out in two equal columns: the flowchart on the left, the controls on the right
            h('div', { class: 'card white', style: { padding: '8px 10px', display: 'grid', placeItems: 'center' } }, svg),  // left column: white card with the flowchart, centred
            h('div', { class: 'stack' },  // right column
              h('p', { class: 'm0', html: 'Each time the processor issues a read address <b>RA</b>, the cache hardware runs this procedure. A hit is done in a few processor cycles; a miss must wait for main memory. Pick an address and watch which path lights up.' }),  // paragraph: the cache runs this procedure for every read address RA
              btns,  // the Read buttons
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'Cache contents (4 slots, 4 words per block)'), score),  // heading for the slot boxes, with the hit and miss counters on the right
              cacheBox, narr,  // the slot boxes and the narration box
              h('div', { class: 'callout tip m0 small', 'data-label': 'Notice', html: 'A <span class="t">hit</span> never touches main memory. A <span class="t">miss</span> on 13 brings in the whole block 12–15, so the later reads of 14 and 12 hit.' }))));  // callout: a hit never touches main memory, and a miss on 13 brings in 12-15 so later reads hit
        },  // ends render() for step 3
      },  // ends step 3
      /* ---------------------------------------------------------------- 4. Mapping function */
      {  // step 4 starts here
        title: 'Mapping: which slot is a block allowed to use?',  // title of step 4
        kind: 'explore',  // kind "explore" labels it an Explore screen
        render(el, ctx) {  // render() builds step 4 when the student arrives on it
          const { h, s } = ctx;  // h builds HTML elements and s builds SVG drawing elements
          let mode = 'direct', addr = 37;  // mode is 'direct' or 'assoc'; addr is the selected address (37 at start)
          const FIELD = { tag: 'var(--warn)', slot: 'var(--accent)', word: 'var(--mem)' };  // FIELD: the colour for each part of an address: tag, slot and word
          const bitsRow = h('div', { class: 'row nw', style: { gap: '4px', justifyContent: 'center' } });  // the row of six bit boxes for the selected address
          const labelsRow = h('div', { class: 'row nw', style: { gap: '4px', justifyContent: 'center' } });  // the row of field labels under the bits
          const decode = h('div', { class: 'card tight small', style: { lineHeight: '1.45' } });  // the card that explains how the address is decoded
          const pro = h('div', { class: 'callout m0 small' });  // the callout that gives the chosen mapping's strength and weakness
          const foot = h('span');  // a small note that update() fills
          function fieldsFor(m) { return m === 'direct' ? [['tag', 2], ['slot', 2], ['word', 2]] : [['tag', 4], ['word', 2]]; }  // fieldsFor(m): the address fields and their bit widths: direct = tag 2, slot 2, word 2; associative = tag 4, word 2
          // SVG: memory blocks (left) and cache slots (right)
          const svg = s('svg', { viewBox: '0 0 600 436', width: '100%' });  // the drawing: memory blocks on the left, cache slots on the right
          const rows = [], rowTxt = [], slotBox = [], slotTxt = [], arrows = [];  // rows, rowTxt, slotBox, slotTxt and arrows keep the pieces that change when the selection changes
          svg.append(s('text', { x: 130, y: 16, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 15, class: 'tx-mem' }, 'Memory blocks'),  // heading over the memory column: memory blocks
            s('text', { x: 510, y: 16, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 15, class: 'tx-acc' }, 'Cache slots'));  // heading over the cache column: cache slots
          for (let i = 0; i < 4; i++) {  // creates four arrows, one per slot, that will point from the selected block to the slots it may use
            arrows[i] = s('path', { fill: 'none', class: 's-line', 'marker-end': 'url(#arr-accent)', style: 'stroke:var(--accent)' });  // each arrow is an accent-coloured path with an arrowhead; update() sets its route
            svg.append(arrows[i]);  // adds the arrow to the drawing
          }  // ends the arrow loop
          for (let b = 0; b < NBLOCKS; b++) {  // draws the 16 memory blocks as rows
            const y = 26 + b * 25.5;  // y is this row's position
            rows[b] = s('rect', { x: 40, y, width: 190, height: 21, rx: 5, class: 's-mem', 'stroke-width': 1 });  // the row's box, which update() recolours
            rowTxt[b] = s('text', { x: 222, y: y + 15.5, 'text-anchor': 'end', 'font-size': 12.5, class: 's-sub' }, '');  // a note at the right end of the row, such as "→ slot 1", filled in by update()
            svg.append(hotGroup(ctx, () => { addr = b * K + (addr & 3); slider.set(addr); update(); }, 'Block ' + b, rows[b],  // makes the row clickable; clicking selects the same word position in this block and moves the slider to match
              s('text', { x: 34, y: y + 15.5, 'text-anchor': 'end', 'font-size': 13, 'font-weight': 700 }, 'B' + b),  // the block's label, B0 to B15
              s('text', { x: 50, y: y + 15.5, 'font-size': 12.5, class: 's-monot' }, `${b * K}–${b * K + 3}`), rowTxt[b]));  // the block's address range, such as "36–39", and the note
          }  // ends the row loop
          for (let i = 0; i < NSLOTS; i++) {  // draws the four cache slots
            const y = 44 + i * 98;  // y is this slot's position
            slotBox[i] = s('rect', { x: 430, y, width: 160, height: 76, rx: 10, class: 's-cache', 'stroke-width': 1.5 });  // the slot's box, thickened by update() when the block may go there
            slotTxt[i] = s('text', { x: 510, y: y + 52, 'text-anchor': 'middle', 'font-size': 13 }, '');  // a line of text inside the slot, filled in by update()
            svg.append(slotBox[i], s('text', { x: 510, y: y + 28, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 15 }, 'Slot ' + i + '  (' + bin(i, 2) + ')'), slotTxt[i]);  // adds the box, the slot's name with its number in binary (such as "Slot 1  (01)"), and the text line
          }  // ends the slot loop
          const arrowPath = (b, i) => { const y1 = 36.5 + b * 25.5, y2 = 82 + i * 98; return `M232,${y1} C330,${y1} 330,${y2} 426,${y2}`; };  // arrowPath(b, i): a smooth curve (C is an SVG curve command) from block b's row to slot i
          function update() {  // update(): redraws the address bits, the explanation, the rows, the arrows and the slots after any change
            const b = addr >> 2, w = addr & 3, slot = b & 3, tagD = b >> 2;  // splits the address: block, word (last 2 bits), slot (block mod 4) and the direct-mapped tag (block ÷ 4)
            const bits = bin(addr, 6).split('');  // the address as six binary digits, one per box
            let k = 0;  // k counts through the six bits as the fields take their share
            bitsRow.replaceChildren(); labelsRow.replaceChildren();  // clears the bit boxes and the field labels
            for (const [f, n] of fieldsFor(mode)) {  // goes through the fields for the chosen mapping, left to right
              for (let j = 0; j < n; j++, k++) bitsRow.append(h('div', { class: 'mono', style: { width: '50px', height: '44px', display: 'grid', placeItems: 'center', fontSize: '25px', fontWeight: 800, borderRadius: '8px', border: '2px solid ' + FIELD[f], background: 'color-mix(in srgb, ' + FIELD[f] + ' 14%, var(--panel))' } }, bits[k]));  // one large coloured box per bit, bordered and tinted in its field's colour
              labelsRow.append(h('div', { class: 'xs b center', style: { width: (n * 54 - 4) + 'px', color: FIELD[f] } }, `${f}: ${n} bits`));  // a label under the field's boxes giving its name and width, in the same colour
            }  // ends the field loop
            if (mode === 'direct') {  // explanation for direct mapping
              decode.innerHTML = `<div><b style="color:var(--mem)">word</b> = last 2 bits = ${w}: which of the block’s 4 words.</div>` +  // the word field: the last 2 bits pick one of the block's 4 words
                `<div><b style="color:var(--accent)">slot</b> = middle 2 bits = ${slot}: block ${b} mod 4 = ${slot}. No search needed.</div>` +  // the slot field: the middle 2 bits, block mod 4, so no search is needed
                `<div><b style="color:var(--warn)">tag</b> = first 2 bits = ${tagD}: block ${b} ÷ 4 = ${tagD}, remainder dropped. It tells apart the 4 blocks that share slot ${slot}.</div>` +  // the tag field: the first 2 bits, block ÷ 4, which tells apart the 4 blocks sharing a slot
                '<div class="muted" style="margin-top:3px">In general: word = log<sub>2</sub>K bits, slot = log<sub>2</sub>C bits, tag = the n − log<sub>2</sub>C − log<sub>2</sub>K bits left over.</div>';  // the general rule for the width of each field
              pro.className = 'callout warn m0 small'; pro.dataset.label = 'Trade-off';  // the trade-off callout uses the warning style
              pro.innerHTML = '<span class="t">Direct mapping</span> is cheap and fast: check <b>one</b> slot, compare <b>one</b> tag. But blocks that share a slot evict each other, even while other slots sit idle.';  // direct mapping trade-off: cheap and fast, but blocks sharing a slot evict each other
              foot.innerHTML = 'Click a block to jump to it. Tinted rows are its rivals for the same slot.';  // the note under the drawing: tinted rows are the selected block's rivals for its slot
            } else {  // explanation for associative mapping
              decode.innerHTML = `<div><b style="color:var(--mem)">word</b> = last 2 bits = ${w}: which of the block’s 4 words.</div>` +  // the word field is still the last 2 bits
                `<div><b style="color:var(--warn)">tag</b> = first 4 bits = ${b}: the whole block number (longer than the 2&#8209;bit direct-mapped tag).</div>` +  // the tag is the first 4 bits, the whole block number, longer than the direct-mapped tag
                `<div>No slot field: block ${b} may sit <b>anywhere</b>, so ${b} is compared with <b>all four tags at once</b>.</div>` +  // there is no slot field, so the tag is compared with all four slots at once
                '<div class="muted" style="margin-top:3px">In general: word = log<sub>2</sub>K bits, tag = the other n − log<sub>2</sub>K bits.</div>';  // the general rule for associative mapping's fields
              pro.className = 'callout tip m0 small'; pro.dataset.label = 'Trade-off';  // the trade-off callout uses the tip style
              pro.innerHTML = '<span class="t">Associative mapping</span> never evicts while a slot is free. The price: one comparator (a circuit that tests two tags for equality) per slot, and a <span class="t">replacement algorithm</span> to pick a victim when all are full.';  // associative mapping trade-off: no evictions while a slot is free, but one comparator per slot and a replacement rule
              foot.innerHTML = 'Click a block to jump to it. Here any block may use any slot.';  // the note under the drawing: here any block may use any slot
            }  // ends the choice of mapping
            for (let bb = 0; bb < NBLOCKS; bb++) {  // recolours every memory row
              const cur = bb === b, rival = mode === 'direct' && (bb & 3) === slot && !cur;  // cur is the selected block; a rival shares its slot under direct mapping
              rows[bb].setAttribute('class', cur ? 's-warn' : rival ? 's-cache' : 's-mem');  // the selected block is drawn in the warning colour, its rivals in the cache colour, the rest normally
              rows[bb].setAttribute('stroke-width', cur ? 2.5 : 1);  // the selected block's row gets a thicker outline
              rowTxt[bb].textContent = mode === 'direct' ? '→ slot ' + (bb & 3) : '';  // under direct mapping each row shows its slot; under associative mapping the note is blank
            }  // ends the row loop
            for (let i = 0; i < 4; i++) {  // updates each slot and its arrow
              const on = mode === 'assoc' || i === slot;  // on is true if the selected block may use this slot: always for associative, only its own slot for direct
              arrows[i].setAttribute('d', arrowPath(b, i));  // routes the arrow from the selected block to this slot
              arrows[i].style.display = on ? '' : 'none';  // hides the arrows to slots the block may not use
              arrows[i].style.strokeDasharray = mode === 'assoc' ? '6 5' : '';  // dashed arrows under associative mapping show that any of them is possible
              slotBox[i].setAttribute('stroke-width', on ? 3 : 1.5);  // thickens the outline of every slot the block may use
              slotTxt[i].textContent = mode === 'direct' ? (i === slot ? `block ${b} goes here, tag ${tagD}` : `blocks ${i}, ${i + 4}, ${i + 8}, ${i + 12}`) : `could hold block ${b}`;  // direct: the block's own slot says "goes here" with its tag, the others list their four blocks; associative: "could hold"
              slotTxt[i].setAttribute('class', on ? 'tx-acc' : 's-sub');  // the slot text is in the accent colour when the block may use the slot, grey otherwise
            }  // ends the slot loop
          }  // ends update
          const slider = ctx.ui.slider({ label: 'Address', min: 0, max: 63, value: addr, format: (v) => v + ' = ' + bin(v, 6), onInput: (v) => { addr = v; update(); } });  // slider for the address, 0 to 63, showing it in decimal and in binary
          const seg = ctx.ui.seg([{ value: 'direct', label: 'Direct mapping' }, { value: 'assoc', label: 'Associative mapping' }], mode, (v) => { mode = v; update(); });  // buttons to switch between direct and associative mapping
          update();  // draws everything once for the starting address 37 under direct mapping
          el.append(h('div', { class: 'split l fill' },  // lays the step out in two columns: controls and explanation on the left, the drawing on the right
            h('div', { class: 'stack', style: { gap: '10px' } },  // left column
              h('p', { class: 'm0', html: 'The <span class="t">mapping function</span> decides which slot a block may occupy, and so how the cache splits an address into <b>fields</b>. (Same demo: 64 words, blocks of 4, 4 slots.)' }),  // paragraph: the mapping function decides which slot a block may use, and so how the address splits into fields
              seg, slider,  // the mapping buttons and the address slider
              h('div', { class: 'stack', style: { gap: '4px', flex: 'none' } }, bitsRow, labelsRow),  // the bit boxes above their field labels
              decode, pro),  // the decoding explanation and the trade-off callout
            h('div', { class: 'stack gap-s' },  // right column
              h('div', { class: 'card white', style: { padding: '6px 8px' } }, svg),  // white card holding the drawing
              h('p', { class: 'xs muted m0' }, foot, ' Real caches mostly use a middle ground, ', h('span', { class: 't' }, 'set-associative mapping'), ': a block maps to one small set of slots and may use any slot inside it.'))));  // note under the drawing, followed by a mention of set-associative mapping, the middle ground used in practice
        },  // ends render() for step 4
      },  // ends step 4
      /* ---------------------------------------------------------------- 5. Simulator lab */
      {  // step 5 starts here
        title: 'Cache simulator: run programs, count hits and misses',  // title of step 5
        kind: 'lab',  // kind "lab" labels it a Hands-on Lab
        core: true,  // core: true keeps this step on the Core path
        render(el, ctx) {  // render() builds step 5 when the student arrives on it
          const { h, s } = ctx;  // h builds HTML elements and s builds SVG drawing elements
          let mode = 'direct', prog = 'seq', cache, pc, hist, last, timer = null;  // lab state: mapping mode, chosen program, the cache, position in the program, history, last result, and the run timer
          const FC = { tag: 'var(--warn)', slot: 'var(--accent)', word: 'var(--mem)' };  // FC: the colour for each address field, the same as in the mapping step
          // --- main memory (click a word to read it)
          const memSvg = s('svg', { viewBox: '0 0 270 462', width: '100%' });  // the main memory drawing on the left of the lab
          const rowRect = [], cellRect = [];  // rowRect and cellRect keep the row outlines and word boxes so they can be highlighted and tinted
          memSvg.append(s('text', { x: 135, y: 14, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 14, class: 'tx-mem' }, 'Main memory · click a word'),  // heading over memory: click a word to read it
            s('rect', { x: 33, y: 443, width: 16, height: 13, rx: 3, class: 's-cache' }), s('text', { x: 55, y: 454, 'font-size': 12.5, class: 's-sub' }, '= block has a copy in the cache'));  // a small key at the bottom: a tinted box means the block has a copy in the cache
          for (let b = 0; b < NBLOCKS; b++) {  // draws the 16 blocks as rows
            const y = 26 + b * 25.6;  // y is this row's position
            rowRect[b] = s('rect', { x: 29, y: y - 2, width: 238, height: 25, rx: 6, fill: 'none', 'stroke-width': 0 });  // an outline around the whole row, invisible until the block is used
            memSvg.append(rowRect[b], s('text', { x: 25, y: y + 15, 'text-anchor': 'end', 'font-size': 12.5, 'font-weight': 700 }, 'B' + b));  // adds the outline and the block's label, B0 to B15
            for (let w = 0; w < K; w++) {  // draws the four words of the block
              const a = b * K + w;  // a is the word's address
              cellRect[a] = s('rect', { x: 33 + w * 58, y, width: 54, height: 21, rx: 4, class: 's-mem', 'stroke-width': 1 });  // the word's box
              memSvg.append(hotGroup(ctx, () => { stop(); doAccess(a, true); }, 'Read address ' + a, cellRect[a],  // makes the word clickable; clicking stops any run and reads this address by hand
                s('text', { x: 60 + w * 58, y: y + 15, 'text-anchor': 'middle', 'font-size': 13, class: 's-monot' }, String(a))));  // the address number inside the word's box
            }  // ends the word loop
          }  // ends the block loop
          // --- cache slots
          const cSvg = s('svg', { viewBox: '0 0 520 302', width: '100%' });  // the cache drawing on the right of the lab, one wide box per slot
          const SL = [];  // SL will hold the changeable pieces of each slot
          for (let i = 0; i < NSLOTS; i++) {  // builds the four slots
            const y = 2 + i * 76, o = {};  // y is this slot's position; o collects its pieces
            o.box = s('rect', { x: 2, y, width: 516, height: 70, rx: 10, class: 's-cache', 'stroke-width': 1.5 });  // the slot's outline box, which turns green or red after the slot is used
            o.name = s('text', { x: 14, y: y + 28, 'font-weight': 800, 'font-size': 15 }, 'Slot ' + i);  // the slot's name
            o.sub = s('text', { x: 14, y: y + 50, 'font-size': 12.5, class: 's-sub' }, '');  // a small line under the name (the slot's bits under direct mapping)
            o.tagBox = s('rect', { x: 92, y: y + 12, width: 76, height: 46, rx: 7, fill: 'var(--panel)', 'stroke-width': 1.5, style: 'stroke:var(--warn)' });  // a box for the tag, bordered in the tag colour
            o.tagLbl = s('text', { x: 130, y: y + 26, 'text-anchor': 'middle', 'font-size': 11.5, 'font-weight': 700, style: 'fill:var(--warn)' }, 'TAG');  // the "TAG" label at the top of that box
            o.tag = s('text', { x: 130, y: y + 48, 'text-anchor': 'middle', 'font-size': 18, 'font-weight': 800, class: 's-monot' }, '');  // the tag value in binary, large and monospace
            o.blk = s('text', { x: 180, y: y + 30, 'font-size': 14.5, 'font-weight': 700 }, '');  // the block the slot holds, or "empty"
            o.info = s('text', { x: 180, y: y + 52, 'font-size': 12.5, class: 's-sub' }, '');  // an extra line: the block's words, the blocks allowed here, or when the slot was last used
            o.words = [0, 1, 2, 3].map((w) => { const r = s('rect', { x: 330 + w * 46, y: y + 18, width: 42, height: 34, rx: 5, fill: 'var(--panel)', stroke: 'var(--line-2)' }); const t = s('text', { x: 351 + w * 46, y: y + 40, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-monot' }, ''); return { r, t }; });  // four small word boxes, each with a label naming the memory word it copies
            cSvg.append(o.box, o.name, o.sub, o.tagBox, o.tagLbl, o.tag, o.blk, o.info, ...o.words.flatMap((q) => [q.r, q.t]));  // adds all of this slot's pieces to the drawing
            SL.push(o);  // keeps the slot's pieces for paintSlots()
          }  // ends the slot loop
          const addrLine = h('div', { class: 'card tight', style: { fontSize: '15px', minHeight: '46px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' } });  // the line that shows the last address split into its coloured fields
          // --- stats
          const big = h('div', { class: 'big' });  // the big hit ratio percentage
          const counts = h('div', { class: 'small muted' });  // the line with the hit, miss and read counts
          const meter = h('div', { class: 'meter' }, h('i'));  // a meter bar whose fill shows the hit ratio
          const strip = h('div', { class: 'row', style: { gap: '4px' } });  // the strip of address chips: reads done (green or red) followed by reads still to come
          const narr = h('div', { class: 'card tight small', style: { minHeight: '88px' } });  // the narration box that explains the last read; its minimum height stops the layout from jumping
          const note = h('div', { class: 'callout m0 small' });  // the callout that asks for a prediction before the run and explains the result after it

          function paintSlots() {  // paintSlots(): redraws the four slots and tints the memory words whose block is cached
            const full = cache.slots.every((q) => q.valid), lru = lruIndex(cache);  // full is true when every slot is in use; lru is the slot LRU would evict next
            cache.slots.forEach((q, i) => {  // updates each slot
              const o = SL[i], isLast = last && last.slot === i;  // o is the slot's pieces; isLast is true if the last read used this slot
              o.box.setAttribute('stroke-width', isLast ? 3.5 : 1.5);  // the slot used by the last read gets a thicker outline
              o.box.style.stroke = isLast ? (last.hit ? 'var(--ok)' : 'var(--bad)') : '';  // green for a hit, red for a miss
              o.sub.textContent = mode === 'direct' ? 'slot bits ' + bin(i, 2) : '';  // under direct mapping, shows the slot's own 2 bits; nothing under associative mapping
              o.tag.textContent = q.valid ? (mode === 'direct' ? bin(q.block >> 2, 2) : bin(q.block, 4)) : '–';  // the tag: 2 bits (block ÷ 4) for direct mapping, all 4 block bits for associative, or a dash if empty
              o.blk.textContent = q.valid ? 'block ' + q.block : 'empty';  // the block held, or "empty"
              o.blk.setAttribute('class', q.valid ? 'tx-acc' : 'tx-muted');  // accent colour for a full slot, grey for an empty one
              o.info.textContent = mode === 'assoc' ? (q.valid ? 'last used t=' + q.last + (full && i === lru ? '  ← LRU' : '') : '') : (q.valid ? 'words ' + q.block * K + '–' + (q.block * K + 3) : 'blocks ' + i + ', ' + (i + 4) + ', ' + (i + 8) + ', ' + (i + 12));  // associative: when it was last used, with "← LRU" on the next victim; direct: its words or the blocks allowed here
              o.info.setAttribute('class', mode === 'assoc' && full && i === lru ? 'tx-bad' : 's-sub');  // the next victim's line is red; other lines are grey
              o.words.forEach((wq, w) => { wq.t.textContent = q.valid ? 'm' + (q.block * K + w) : ''; wq.r.style.stroke = isLast && last.word === w ? 'var(--ink)' : ''; wq.r.setAttribute('stroke-width', isLast && last.word === w ? 2.5 : 1); });  // fills in the word labels and outlines the word the last read wanted
            });  // ends the slot loop
            const inCache = new Set(cache.slots.filter((q) => q.valid).map((q) => q.block));  // inCache lists the blocks now held in any slot
            for (let b = 0; b < NBLOCKS; b++) {  // updates every memory row
              const cur = last && last.block === b;  // cur is true for the block the last read used
              rowRect[b].setAttribute('stroke-width', cur ? 2.5 : 0);  // outlines that block's row
              rowRect[b].style.stroke = cur ? (last.hit ? 'var(--ok)' : 'var(--bad)') : '';  // green for a hit, red for a miss
              for (let w = 0; w < K; w++) cellRect[b * K + w].setAttribute('class', inCache.has(b) ? 's-cache' : 's-mem');  // tints the words of cached blocks in the cache colour
            }  // ends the row loop
          }  // ends paintSlots
          function bits(a) {  // bits(a): writes address a in binary with its fields coloured and separated by bars
            const b6 = bin(a, 6), sp = (t, c) => `<span class="mono b" style="color:${c};font-size:17px">${t}</span>`;  // b6 is the six-digit binary address; sp wraps a group of bits in its field colour
            return mode === 'direct' ? sp(b6.slice(0, 2), FC.tag) + '|' + sp(b6.slice(2, 4), FC.slot) + '|' + sp(b6.slice(4), FC.word)  // direct mapping: tag (2 bits) | slot (2 bits) | word (2 bits)
              : sp(b6.slice(0, 4), FC.tag) + '|' + sp(b6.slice(4), FC.word);  // associative mapping: tag (4 bits) | word (2 bits)
          }  // ends bits
          function narrate(r) {  // narrate(r): writes the explanation of one read result into the narration box
            const b = r.block, sl = r.slot, head = `<b>Read ${r.addr}</b> → block ${b}, word ${r.word}. `;  // b and sl are the block and slot; head names the address, block and word
            let body;  // body will hold the rest of the explanation
            if (mode === 'direct') {  // explanation under direct mapping
              const m = `Block ${b} may only use slot ${sl} (${b} mod 4). `;  // the block has only one allowed slot, block mod 4
              if (r.hit) body = m + `Slot ${sl}’s tag ${bin(b >> 2, 2)} matches the address’s tag: <b class="c-ok">HIT</b>.`;  // hit: that slot's tag matches the address's tag
              else if (r.reason === 'empty') body = m + `Slot ${sl} is empty: <b class="c-bad">MISS</b>. Block ${b} (words ${b * K}–${b * K + 3}) is copied in.`;  // miss into an empty slot: the block is copied in
              else body = m + `It holds block ${r.victim} (tag ${bin(r.victim >> 2, 2)}), not ${b}: <b class="c-bad">MISS</b>. Block ${r.victim} is thrown out with no choice, even if other slots are free.`;  // forced miss: another block is in the slot and is thrown out, even if other slots are free
            } else {  // explanation under associative mapping
              const m = `The tag ${bin(b, 4)} is compared with all four slots at once. `;  // the tag is compared with all four slots at once
              if (r.hit) body = m + `Slot ${sl} matches: <b class="c-ok">HIT</b>, and it becomes the most recently used.`;  // hit: one slot matches and becomes the most recently used
              else if (r.reason === 'empty') body = m + `No match: <b class="c-bad">MISS</b>. Block ${b} goes into free slot ${sl}.`;  // miss with a free slot: the block goes there
              else body = m + `No match and every slot is full: <b class="c-bad">MISS</b>. <span class="t">LRU</span> evicts block ${r.victim} from slot ${sl}: last used at t=${r.victimLast}, longer ago than any other.`;  // miss with every slot full: LRU evicts the block used longest ago, with its last-used time
            }  // ends the choice of mapping
            narr.innerHTML = head + body;  // shows the explanation
          }  // ends narrate
          function paint() {  // paint(): redraws the whole lab after every read, reset, or change of mode or program
            paintSlots();  // redraws the slots and memory
            const P = PROGRAMS[prog], n = P.refs.length, tot = cache.hits + cache.misses;  // P is the chosen program; n is its number of reads; tot counts all reads so far, including clicks
            addrLine.innerHTML = last ? `<span>Read <b>${last.addr}</b> =</span> ${bits(last.addr)} <span class="small muted">→ ${mode === 'direct' ? `tag ${last.block >> 2} · slot ${last.slot} · word ${last.word}` : `tag ${last.block} · word ${last.word}`}</span>`  // after a read, shows the address in colour-coded fields and what each field means
              : `<span class="small muted">The address fields appear here: ${mode === 'direct' ? '<b style="color:var(--warn)">tag</b> | <b style="color:var(--accent)">slot</b> | <b style="color:var(--mem)">word</b>. The slot field picks the only slot the block may use; the tag is compared with that slot’s tag' : '<b style="color:var(--warn)">tag</b> | <b style="color:var(--mem)">word</b> (no slot field)'}.</span>`;  // before any read, explains which fields the current mapping uses
            big.textContent = tot ? ctx.util.fmt((100 * cache.hits) / tot, 1) + '%' : '–';  // the hit ratio as a percentage, or a dash before any read
            big.style.color = !tot ? 'var(--muted)' : cache.hits / tot >= 0.6 ? 'var(--ok)' : cache.hits / tot >= 0.3 ? 'var(--warn)' : 'var(--bad)';  // colours it green at 60% or more, yellow at 30% or more, red below
            counts.innerHTML = `<b class="c-ok">${cache.hits} hits</b> · <b class="c-bad">${cache.misses} misses</b> · ${tot} reads`;  // shows the hit, miss and read counts
            meter.firstChild.style.width = (tot ? (100 * cache.hits) / tot : 0) + '%';  // sets the meter's fill to the hit ratio
            const rem = P.refs.slice(pc), shown = hist.slice(-Math.max(0, 30 - rem.length));  // rem lists the program's reads still to come; shown keeps just enough past reads for about 30 chips in all
            strip.replaceChildren(...shown.map((x) => h('span', { class: 'chip mono ' + (x.hit ? 'ok' : 'bad'), title: x.manual ? 'your click' : '', style: x.manual ? { outline: '2px dashed var(--line-2)' } : null }, String(x.a))),  // a green or red chip for each past read; the student's own clicks get a dashed outline
              ...rem.map((a, k) => h('span', { class: 'chip mono', style: k === 0 ? { outline: '2px solid var(--accent)' } : { opacity: '.7' } }, String(a))));  // a plain chip for each future read, with the next one outlined in the accent colour
            const progHist = hist.filter((x) => !x.manual), ph = progHist.filter((x) => x.hit).length;  // progHist is the history without the student's own clicks; ph counts its hits
            if (pc >= n) {  // when the program has finished
              note.className = 'callout why m0 small'; note.dataset.label = `Result: ${ph} / ${n} hits (${ctx.util.fmt((100 * ph) / n, 1)}%)`;  // the callout shows the program's result as its heading
              note.innerHTML = (typeof P.after === 'string' ? P.after : P.after[mode]) +  // and explains what the result shows (the ping-pong text depends on the mapping)
                (hist.some((x) => x.manual) ? ' <i>(Your own clicks also changed the cache, so press Reset to see the program’s result on its own.)</i>' : '');  // with a warning if the student's own clicks changed the cache too
            } else {  // before the program finishes
              note.className = 'callout tip m0 small'; note.dataset.label = 'Predict first';  // the callout asks for a prediction
              note.innerHTML = `${P.what} How many of the ${n} reads will hit? Then press <b>Run all</b>.`;  // describes the program and asks how many of its reads will hit
            }  // ends the choice of callout
            bStep.disabled = pc >= n;  // Step is disabled once the program has finished
            bRun.textContent = timer ? 'Pause' : 'Run all';  // the run button says Pause while running and Run all otherwise
            bRun.disabled = pc >= n && !timer;  // Run all is disabled once the program has finished (unless it is still running)
          }  // ends paint
          function doAccess(a, manual) {  // doAccess(a, manual): performs one read of address a, either the program's next read or a student's click
            last = cacheAccess(cache, a);  // runs the read through the cache model and keeps the result
            hist.push({ a, hit: last.hit, manual });  // records it in the history, marked if it was a click
            if (!manual) pc++;  // a program read advances the program's position; a click does not
            narrate(last);  // explains the read in the narration box
            paint();  // redraws the lab
          }  // ends doAccess
          function stepOnce() { const refs = PROGRAMS[prog].refs; if (pc < refs.length) doAccess(refs[pc], false); if (pc >= refs.length) stop(); }  // stepOnce(): performs the program's next read, if any, and stops the run when the program is finished
          function stop() { if (timer) { clearInterval(timer); timer = null; } if (cache) paint(); }  // stop(): cancels the run timer, if one is going, and repaints so the buttons show the right labels
          function run() { stop(); timer = ctx.every(420, stepOnce); paint(); }  // run(): starts reading automatically, one read every 0.42 s (ctx.every repeats a function and is cleaned up on leaving)
          function reset() {  // reset(): starts over with an empty cache in the current mode, at the start of the program
            if (timer) { clearInterval(timer); timer = null; }  // cancels any running timer
            cache = makeCache(mode); pc = 0; hist = []; last = null;  // a new empty cache, program position 0, no history, no last result
            narr.innerHTML = `<b>Empty cache.</b> <span class="muted">Press <b>Step</b> to issue the next read in the reference string, or click any word in memory to read it yourself. ${mode === 'direct' ? 'Direct mapping: each block has one fixed slot, so no choice is ever needed.' : 'Associative: any slot. When all four are full, the <span class="t">replacement algorithm</span> (here LRU) evicts the block whose “last used” time t (a count of reads) is oldest.'}</span>`;  // narration: how to use the lab, plus a note on how the chosen mapping picks a slot
            paint();  // redraws the lab
          }  // ends reset
          const bStep = h('button', { class: 'btn sm primary', onclick: () => { stop(); stepOnce(); } }, 'Step →');  // Step button: stops any run and performs the next read
          const bRun = h('button', { class: 'btn sm', onclick: () => (timer ? stop() : run()) }, 'Run all');  // Run all button: starts the automatic run, or pauses it if it is already going
          const bReset = h('button', { class: 'btn sm ghost', onclick: reset }, 'Reset');  // Reset button: empties the cache and restarts the program
          const segMode = ctx.ui.seg([{ value: 'direct', label: 'Direct-mapped' }, { value: 'assoc', label: 'Associative + LRU' }], mode, (v) => { mode = v; reset(); });  // buttons to choose the mapping; switching resets the lab
          const segProg = ctx.ui.seg(Object.entries(PROGRAMS).map(([k, p]) => ({ value: k, label: p.label })), prog, (v) => { prog = v; reset(); });  // buttons to choose the program; switching resets the lab
          reset();  // starts with an empty cache
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },  // lays the lab out as one column that fills the screen
            h('div', { class: 'row', style: { gap: '10px' } }, segMode, segProg, h('div', { class: 'grow' }), bStep, bRun, bReset),  // top row: mapping buttons, program buttons, a spacer, then Step, Run all and Reset
            h('div', { style: { display: 'grid', gridTemplateColumns: ctx.narrow ? '1fr' : '272px minmax(0, 1fr) 300px', gap: '14px', flex: '1', minHeight: '0' } },  // three columns below (memory, cache, results) on a wide screen, stacked into one on a phone-width screen
              h('div', { class: 'card white', style: { padding: '6px 6px 2px' } }, memSvg),  // first column: white card with the memory drawing
              h('div', { class: 'stack', style: { gap: '8px' } }, addrLine, h('div', { class: 'card white', style: { padding: '6px' } }, cSvg), narr),  // second column: the address fields line, the cache drawing card and the narration box
              h('div', { class: 'stack', style: { gap: '8px' } },  // third column
                h('div', { class: 'card tight stack', style: { gap: '4px' } }, h('h4', { class: 'm0', html: '<span class="t">Hit ratio</span> = hits ÷ reads' }), big, counts, meter),  // card with the hit ratio heading, the big percentage, the counts and the meter
                h('h4', { class: 'm0' }, 'Reference string'), strip, note))));  // heading and chip strip for the reference string, then the prediction or result callout
        },  // ends render() for step 5
      },  // ends step 5
      /* ---------------------------------------------------------------- 6. Cache size and block size */
      {  // step 6 starts here
        title: 'Design choices: cache size and block size',  // title of step 6
        kind: 'explore',  // kind "explore" labels it an Explore screen
        render(el, ctx) {  // render() builds step 6 when the student arrives on it
          const { h, s } = ctx;  // h builds HTML elements and s builds SVG drawing elements
          // A simulated program: walks array A, walks array B at half speed, reuses 2 locals and 12 scattered
          // objects, and makes an occasional random read. 2,400 loop iterations = 8,700 references.
          const rnd = ctx.util.seeded(5), trace = [];  // rnd is a seeded random number generator (a guide helper), so the trace is the same every time; trace holds the addresses
          const hot = Array.from({ length: 12 }, () => 16384 + Math.floor(rnd() * 16384));  // hot: 12 scattered addresses between 16384 and 32767 that the program keeps coming back to
          for (let i = 0; i < 2400; i++) {  // builds the trace one loop iteration at a time
            trace.push(i, 12000 + (i % 2), hot[Math.floor(rnd() * 12)]);  // each iteration reads array A (address i), one of two local variables, and one of the scattered objects
            if (i % 2 === 0) trace.push(8192 + (i >> 1));  // every other iteration also reads the next element of array B, starting at 8192
            if (i % 8 === 0) trace.push(16384 + Math.floor(rnd() * 16384));  // every eighth iteration also makes a random read
          }  // ends the trace loop
          function hitRatio(cap, B) {          // fully associative, LRU (a Map keeps blocks in recency order)
            const slots = cap / B, m = new Map(); let hits = 0;  // slots is the number of blocks the cache holds; m maps each cached block to 1, oldest-used first
            for (const a of trace) {  // replays every address in the trace
              const blk = Math.floor(a / B);  // blk is the block the address belongs to
              if (m.has(blk)) { hits++; m.delete(blk); } else if (m.size >= slots) m.delete(m.keys().next().value);  // a hit is counted and the block removed (to re-add it as newest); on a miss with no room, the oldest block is evicted
              m.set(blk, 1);  // adds the block as the most recently used
            }  // ends the replay
            return hits / trace.length;  // returns the fraction of references that hit
          }  // ends hitRatio
          const CAPS = [64, 128, 256, 512], BE = [0, 1, 2, 3, 4, 5, 6, 7];  // CAPS: the four cache sizes in words; BE: block sizes as powers of two (1 to 128 words)
          const data = {};  // data will hold each cache size's hit ratios, one per block size
          for (const c of CAPS) data[c] = BE.filter((e) => 2 ** e <= c / 4).map((e) => hitRatio(c, 2 ** e));  // for each cache size, simulates every block size up to a quarter of the cache (at least 4 slots)
          let cap = 256, be = 3;  // starting choice: a 256-word cache with 8-word blocks
          // the y axis starts at 40% (every curve stays above it) so the differences are easy to see
          const X = (e) => 70 + e * 70, Y = (v) => 272 - ((v - 0.4) / 0.6) * 250;  // X(e) and Y(v): where block size 2^e and hit ratio v fall on the graph
          const svg = s('svg', { viewBox: '0 0 600 320', width: '100%' });  // the graph drawing
          const grid = [];  // grid collects the fixed graph pieces: gridlines and labels
          for (const v of [0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]) grid.push(s('line', { x1: 60, x2: 580, y1: Y(v), y2: Y(v), class: 's-muted', 'stroke-width': 1, 'stroke-dasharray': v === 0.4 ? '' : '3 4' }), s('text', { x: 52, y: Y(v) + 5, 'text-anchor': 'end', 'font-size': 13, class: 's-sub' }, Math.round(v * 100) + '%'));  // a horizontal gridline and a percentage label every 10%, from 40% to 100% (solid at the bottom)
          for (const e of BE) grid.push(s('text', { x: X(e), y: 294, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, String(2 ** e)));  // a block size label under each column: 1, 2, 4 and so on up to 128
          grid.push(s('text', { x: 320, y: 315, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 700 }, 'Block size (words per block)'),  // horizontal axis title: block size in words per block
            s('text', { x: 14, y: 150, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 700, transform: 'rotate(-90 14 150)' }, 'Hit ratio'));  // vertical axis title "Hit ratio", turned sideways
          const layer = s('g');  // layer holds the curves and the marker, redrawn by draw()
          svg.append(...grid, layer);  // adds the fixed pieces and then that layer
          const readout = h('div', { class: 'card tight' });  // the readout card with the big hit ratio and the slot count
          const explain = h('div', { class: 'callout m0 small' });  // the callout that explains the current point on the curve
          const strip = s('svg', { viewBox: '0 0 600 34', width: '100%' });  // a thin strip drawing that shows the cache cut into its slots
          function draw() {  // draw(): redraws the curves, the marker, the readout, the strip and the explanation
            const kids = [];  // kids collects the new graph pieces
            for (const c of CAPS) {  // draws one curve per cache size
              const pts = data[c].map((v, e) => `${X(e)},${Y(v)}`).join(' ');  // the curve's points, one per block size
              const on = c === cap, lastE = data[c].length - 1;  // on is true for the chosen cache size; lastE is the curve's last point
              kids.push(s('polyline', { points: pts, fill: 'none', 'stroke-width': on ? 3.5 : 1.5, style: on ? 'stroke:var(--accent)' : 'stroke:var(--line-2)' }));  // the curve line: thick and accent-coloured for the chosen size, thin and grey for the others
              kids.push(s('text', { x: X(lastE), y: Y(data[c][lastE]) + 20, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': on ? 800 : 600, class: on ? 'tx-acc' : 's-sub' }, c + ' w'));  // a label under the curve's last point naming its size, such as "256 w"
            }  // ends the curve loop
            const v = data[cap][be], peakE = data[cap].indexOf(Math.max(...data[cap]));  // v is the hit ratio at the chosen settings; peakE is the block size where this curve is highest
            kids.push(s('line', { x1: X(be), x2: X(be), y1: Y(0.4), y2: Y(v), style: 'stroke:var(--accent)', 'stroke-dasharray': '4 4', 'stroke-width': 1.5 }),  // a dashed line up from the axis to the chosen point
              s('circle', { cx: X(be), cy: Y(v), r: 7, class: 's-cache', 'stroke-width': 3 }),  // the chosen point, a ringed dot
              s('text', { x: X(be), y: Y(v) - 14, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800, class: 'tx-acc' }, ctx.util.fmt(v * 100, 1) + '%'));  // its hit ratio written just above it
            layer.replaceChildren(...kids);  // swaps in the new graph pieces
            const B = 2 ** be, slots = cap / B;  // B is the block size in words and slots the number of slots it leaves
            readout.innerHTML = `<div class="row" style="gap:14px"><span class="big c-acc" style="font-size:34px">${ctx.util.fmt(v * 100, 1)}%</span><span class="small">${cap}-word cache ÷ ${B}-word blocks<br>= <b>${slots} slots</b></span></div>`;  // the readout: the hit ratio and how cache size divided by block size gives the slot count
            const sk = [s('rect', { x: 1, y: 4, width: 598, height: 26, rx: 6, class: 's-cache', 'stroke-width': 1.5 })];  // the strip starts as one long box representing the whole cache
            if (slots <= 128) for (let k = 1; k < slots; k++) sk.push(s('line', { x1: 1 + (598 * k) / slots, x2: 1 + (598 * k) / slots, y1: 4, y2: 30, style: 'stroke:var(--accent)', 'stroke-width': slots > 64 ? 0.8 : 1.5 }));  // draws a divider for each slot boundary (skipped above 128 slots, where they would blur together)
            strip.replaceChildren(...sk);  // swaps in the new strip
            if (be < peakE) {  // if the chosen block size is left of the peak
              explain.className = 'callout tip m0 small'; explain.dataset.label = 'Rising: bigger blocks help';  // a tip headed "Rising: bigger blocks help"
              explain.innerHTML = B === 1  // the text depends on whether blocks are a single word
                ? 'With 1-word blocks a miss brings in only the word asked for, so every step of an array walk misses again. Double the block size and watch the neighbours start to hit.'  // with 1-word blocks, every step of an array walk misses
                : `Each miss now brings in a block of ${B} words. The array walks read those neighbours next, so they hit: <b>spatial locality</b> pays off. Try doubling the block size again.`;  // with bigger blocks, the neighbours brought in hit: spatial locality
            } else if (be === peakE) {  // if the chosen block size is at the peak
              explain.className = 'callout why m0 small'; explain.dataset.label = 'The sweet spot';  // a callout headed "The sweet spot"
              explain.innerHTML = `For a ${cap}-word cache, ${B}-word blocks are best for this program: big enough to catch the array walks, while ${slots} slots still leave room for everything it keeps reusing.`;  // explains why this block size is best for this cache size
            } else {  // if the chosen block size is right of the peak
              explain.className = 'callout warn m0 small'; explain.dataset.label = 'Falling: blocks too big';  // a warning headed "Falling: blocks too big"
              explain.innerHTML = `Only ${slots} slots now. The two arrays, the locals and the dozen scattered objects each need a slot of their own, so they start evicting one another, and every big block drags in words that will never be used.`;  // too few slots, so the reused data evicts itself and big blocks bring in words that are never used
            }  // ends the choice of explanation
          }  // ends draw
          const slider = ctx.ui.slider({ label: 'Block size', min: 0, max: 6, value: be, format: (e) => 2 ** e + ' words', onInput: (e) => { be = e; draw(); } });  // block size slider: a power of two from 1 to 64 words; moving it redraws
          const seg = ctx.ui.seg(CAPS.map((c) => ({ value: c, label: c + ' words' })), cap, (c) => {  // cache size buttons; choosing a size redraws
            cap = c; const mx = data[c].length - 1; slider.input.max = mx; if (be > mx) { be = mx; slider.set(be); } draw();  // also lowers the slider's top end to the biggest block size this cache allows, pulling the slider back if needed
          });  // ends the cache size buttons
          draw();  // draws the chart once with the starting choices
          el.append(h('div', { class: 'split l fill' },  // lays the step out in two columns: controls and explanations on the left, the chart on the right
            h('div', { class: 'stack', style: { gap: '10px' } },  // left column
              h('p', { class: 'm0', html: 'Designers must pick the <b>cache size</b> and the <b>block size</b>. This chart is computed live from a simulated program (8,700 memory references), not drawn by hand. Move the controls.' }),  // paragraph: pick the cache size and block size; the chart is computed from a simulated program
              h('div', { class: 'stack gap-s' }, h('div', { class: 'xs b muted' }, 'CACHE SIZE'), seg), slider, readout, explain,  // the cache size buttons under their label, then the block size slider, the readout and the explanation
              h('div', { class: 'callout why m0 small', 'data-label': 'Cache size', html: `Even the smallest cache here, at its best block size, turns about three of every four references into hits. Each doubling adds less (best: ${CAPS.map((c) => Math.round(100 * Math.max(...data[c])) + '%').join(' → ')}). Bigger caches also cost more and respond more slowly, so fast caches stay small.` })),  // callout: bigger caches help less and less (with each size's best hit ratio listed) and respond more slowly
            h('div', { class: 'stack gap-s' },  // right column
              h('div', { class: 'card white', style: { padding: '8px 10px' } }, svg),  // white card holding the chart
              h('div', { class: 'xs b muted' }, 'THE SAME CACHE, CUT INTO SLOTS'), strip,  // label and drawing: the same cache cut into slots
              h('p', { class: 'xs muted m0', html: 'The program walks two arrays in order, reuses two local variables and a dozen objects scattered across memory, and sometimes reads a random location. Fully associative cache with LRU replacement; each block size keeps at least 4 slots. The hit-ratio axis starts at 40%. Real programs differ in detail, but the rise-then-fall shape is typical.' }))));  // small print: what the simulated program does and how the cache is modelled
        },  // ends render() for step 6
      },  // ends step 6
      /* ---------------------------------------------------------------- 7. Write policy */
      {  // step 7 starts here
        title: 'Write policy: write-through vs write-back',  // title of step 7
        kind: 'compare',  // kind "compare" labels it a Compare screen
        render(el, ctx) {  // render() builds step 7 when the student arrives on it
          const { h, s } = ctx;  // h builds HTML elements and s builds SVG drawing elements
          const F = [  // F: the frames of the write policy animation; each can store a value (op), trigger an I/O read (dma), or evict
            { cap: '<b>Start.</b> The program has already read variable x, so x’s block sits in a cache slot. Cache and main memory agree: x = 10. Now a loop starts updating x. The <span class="t">write policy</span> decides when main memory hears about each change.' },  // frame 0: x = 10 is cached and memory agrees; a loop is about to update x
            { op: 11, cap: '<b>Store x = 11.</b> <span class="t">Write-through</span> updates the cache <b>and</b> main memory. <span class="t">Write-back</span> updates only the cache and sets the slot’s <span class="t">dirty bit</span>; main memory still says 10.' },  // frame 1: store 11; write-through updates both, write-back only the cache and sets the dirty bit
            { op: 12, cap: '<b>Store x = 12.</b> Another store, another memory write for write-through (2 so far). Write-back has still made none.' },  // frame 2: store 12; write-through has made 2 memory writes, write-back none
            { op: 13, cap: '<b>Store x = 13.</b> Write-through: 3 memory writes. Write-back: 0, but main memory is now three updates behind.' },  // frame 3: store 13; write-back's memory is now three updates behind
            { dma: 1, cap: '<b>An I/O module reads x straight from main memory</b>, without going through the processor or its cache (this is direct memory access, DMA, covered in 1.7). Write-through hands it 13: correct. Write-back hands it <b>10, a stale value</b>. Hardware or the OS must prevent this, for example by writing dirty blocks back first.' },  // frame 4: an I/O module reads x straight from memory (DMA) and gets a stale 10 under write-back
            { op: 14, cap: '<b>Store x = 14.</b> Write-through: 4 memory writes. Write-back: still 0.' },  // frame 5: store 14; write-through 4 memory writes, write-back still 0
            { evict: 1, cap: '<b>The block is evicted</b> to make room. Write-through has nothing left to do. Write-back sees the dirty bit and copies the block to memory <b>once</b>. Totals: 4 writes vs 1. A loop of 1,000 updates would cost 1,000 vs 1.' },  // frame 6: the block is evicted; write-back writes it once because it is dirty, 4 writes against 1
          ];  // closes F
          function stateAt(i) {  // stateAt(i): replays frames 1 to i from the start and returns both policies' state for frame i
            const st = { wt: { c: 10, m: 10, n: 0, w: false, got: null }, wb: { c: 10, m: 10, n: 0, w: false, d: 0, got: null }, op: null, dma: false, evict: false };  // starting state for write-through (wt) and write-back (wb): cache c, memory m, write count n, write arrow w, DMA result got
            for (let k = 1; k <= i; k++) {  // applies each frame from 1 up to the one being shown
              const f = F[k], now = k === i;  // f is the frame being applied; now is true when it is the frame being shown
              st.wt.w = st.wb.w = false; st.wt.got = st.wb.got = null;  // clears the write arrows and DMA results left from the previous frame
              if (f.op != null) { st.wt.c = st.wt.m = f.op; st.wt.n++; st.wt.w = now; st.wb.c = f.op; st.wb.d = 1; }  // a store: write-through updates cache and memory and counts a write; write-back updates the cache and sets dirty
              if (f.dma) { st.wt.got = st.wt.m; st.wb.got = st.wb.m; }  // an I/O read: each policy's I/O module gets whatever that policy's main memory holds
              if (f.evict) { if (st.wb.d) { st.wb.m = st.wb.c; st.wb.n++; st.wb.w = true; st.wb.d = 0; } st.wt.c = st.wb.c = null; }  // an eviction: write-back copies a dirty block to memory and counts one write; both caches then lose the block
              if (now) { st.op = f.op ?? null; st.dma = !!f.dma; st.evict = !!f.evict; }  // for the frame being shown, remembers what happened so the drawings can show it
            }  // ends the replay loop
            return st;  // returns the state
          }  // ends stateAt
          function panel(kind) {  // panel(kind): builds one policy's drawing ('wt' or 'wb') with a draw function that redraws it from a state
            const svg = s('svg', { viewBox: '0 0 540 200', width: '100%' });  // the panel's drawing area
            return { svg, draw(st) {  // returns the drawing and its draw function
              const p = st[kind], stale = p.c != null && p.m !== p.c;  // p is this policy's state; stale is true when memory's x differs from the cached x
              const kids = [  // kids collects the drawing's pieces
                s('rect', { x: 6, y: 46, width: 104, height: 60, rx: 10, class: 's-cpu', 'stroke-width': 2 }),  // the processor box
                s('text', { x: 58, y: 81, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 15 }, 'Processor'),  // its name
                s('line', { x1: 112, y1: 76, x2: 164, y2: 76, 'marker-end': st.op != null ? 'url(#arr-cpu)' : 'url(#arr-muted)', class: st.op != null ? 's-line' : 's-muted', style: st.op != null ? 'stroke:var(--cpu)' : '' }),  // arrow from the processor to the cache, lit in the processor colour when a store happens
                s('text', { x: 138, y: 66, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 700, class: 'tx-cpu' }, st.op != null ? 'x=' + st.op : ''),  // the stored value above that arrow, such as "x=12"
                s('rect', { x: 168, y: 30, width: 160, height: 92, rx: 12, class: 's-cache', 'stroke-width': 2 }),  // the cache slot box
                s('text', { x: 248, y: 50, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 14, class: 'tx-acc' }, 'Cache slot'),  // its label
                s('text', { x: 248, y: 84, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': p.c != null ? 26 : 16, class: p.c != null ? 's-monot' : 's-sub' }, p.c != null ? 'x = ' + p.c : '(block evicted)'),  // the cached value of x, or "(block evicted)"
                s('line', { x1: 330, y1: 76, x2: 380, y2: 76, 'marker-end': p.w ? 'url(#arr-mem)' : 'url(#arr-muted)', class: p.w ? 's-line' : 's-muted', style: p.w ? 'stroke:var(--mem);stroke-width:4' : '' }),  // arrow from the cache to memory, thick and memory-coloured when a memory write happens
                s('text', { x: 355, y: 66, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 700, class: 'tx-mem' }, p.w ? 'write' : ''),  // the word "write" above that arrow when it is lit
                s('rect', { x: 384, y: 30, width: 150, height: 92, rx: 12, class: stale ? 's-bad' : 's-mem', 'stroke-width': 2 }),  // the main memory box, red when its value is stale
                s('text', { x: 459, y: 50, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 14 }, 'Main memory'),  // its label
                s('text', { x: 459, y: 84, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 26, class: 's-monot' }, 'x = ' + p.m),  // memory's value of x
                s('text', { x: 459, y: 110, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 800, class: stale ? 'tx-bad' : 'tx-ok' }, stale ? 'STALE (out of date)' : 'up to date'),  // "STALE (out of date)" in red, or "up to date" in green
                s('text', { x: 8, y: 156, 'font-size': 14, 'font-weight': 700 }, 'Memory writes so far'),  // label for the write counter
                s('text', { x: 8, y: 190, 'font-size': 32, 'font-weight': 800, style: 'fill:var(--' + (kind === 'wt' ? 'warn' : 'ok') + ')' }, String(p.n)),  // the write counter itself, yellow for write-through and green for write-back
              ];  // closes the list of pieces
              if (kind === 'wb') kids.push(s('rect', { x: 206, y: 96, width: 84, height: 20, rx: 6, fill: 'var(--panel)', 'stroke-width': 1.5, style: 'stroke:var(--' + (p.d ? 'warn' : 'line-2') + ')' }),  // write-back only: a small box inside the cache for the dirty bit, bordered in yellow when it is set
                s('text', { x: 248, y: 111, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 800, style: 'fill:var(--' + (p.d ? 'warn' : 'muted') + ')' }, 'dirty = ' + p.d));  // the dirty bit's value, "dirty = 0" or "dirty = 1"
              if (p.got != null) {  // if an I/O module read x in this frame
                const ok = p.got === (p.c ?? p.m);   // newest x lives in the cache, or in memory once evicted
                kids.push(s('line', { x1: 459, y1: 124, x2: 459, y2: 150, class: 's-line', 'marker-end': 'url(#arr-io)', style: 'stroke:var(--io)' }),  // an arrow down from memory to the I/O module
                  s('rect', { x: 296, y: 154, width: 238, height: 40, rx: 9, class: 's-io', 'stroke-width': 2 }),  // the I/O module's box
                  s('text', { x: 415, y: 179, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800, class: ok ? 'tx-ok' : 'tx-bad' }, `I/O (DMA) reads x = ${p.got} ${ok ? '✓' : '✗ stale'}`));  // what it read, with a tick if it is current or a cross and "stale" if not
              }  // ends the I/O branch
              svg.replaceChildren(...kids);  // swaps in the new pieces
            } };  // ends draw and the returned object
          }  // ends panel
          const A = panel('wt'), B = panel('wb');  // A is the write-through panel and B the write-back panel
          const drawBoth = (st) => { A.draw(st); B.draw(st); };  // drawBoth(st): redraws both panels from the same state, so they always show the same moment
          const player = ctx.ui.player({ count: F.length, interval: 2600, speed: false, render: (i) => { drawBoth(stateAt(i)); return F[i].cap; } });  // the frame player: each frame redraws both panels and returns its caption; speed buttons are hidden
          const playerCtl = player.el.querySelector('.player-ctl');  // the player's row of controls, where the mode buttons are added later
          // "Your turn": the student chooses the events; both policies react to the same sequence
          let ms, val;  // ms is the state in "Your turn" mode; val is the current value of x
          const manCap = h('div', { class: 'player-cap', 'aria-live': 'polite' });  // the caption box for "Your turn" mode, read aloud by screen readers when it changes
          const bStore = h('button', { class: 'btn sm primary', onclick: () => act('store') }, 'Store x = x + 1');  // button: store x = x + 1
          const bDma = h('button', { class: 'btn sm io', onclick: () => act('dma') }, 'I/O module reads x');  // button: an I/O module reads x
          const bEvict = h('button', { class: 'btn sm', onclick: () => act('evict') }, 'Evict the block');  // button: evict the block
          const manCtl = h('div', { class: 'player-ctl' }, bStore, bDma, bEvict, h('button', { class: 'btn sm ghost', onclick: () => manReset() }, 'Start over'), h('div', { class: 'grow' }));  // the row of "Your turn" buttons, with a Start over button and a spacer
          const manEl = h('div', { class: 'player', style: { display: 'none' } }, manCap, manCtl);  // the "Your turn" panel, hidden until the student switches to it
          function manReset() {  // manReset(): starts "Your turn" over with x = 10 cached and memory agreeing
            ms = { wt: { c: 10, m: 10, n: 0, w: false, got: null }, wb: { c: 10, m: 10, n: 0, w: false, d: 0, got: null }, op: null };  // a fresh state for both policies
            val = 10; bEvict.disabled = false; drawBoth(ms);  // x is 10, the Evict button is available again, and both panels are redrawn
            manCap.innerHTML = '<b>Your turn.</b> x = 10 is cached and memory agrees. Pick events in any order and predict both write counters before each click. Try several stores, then let the I/O module read x.';  // caption: pick events in any order and predict both counters before each click
          }  // ends manReset
          function act(k) {  // act(k): applies one event chosen by the student: 'store', 'dma' or 'evict'
            const st = ms; let cap;  // st is the "Your turn" state; cap will be the caption
            st.wt.w = st.wb.w = false; st.wt.got = st.wb.got = null; st.op = null;  // clears the arrows and DMA results from the last event
            if (k === 'store') {  // a store
              const miss = st.wt.c == null; val++;  // miss is true if the block had been evicted; x goes up by one
              st.wt.c = st.wt.m = val; st.wt.n++; st.wt.w = true;     // write-through: cache and memory
              st.wb.c = val; st.wb.d = 1; st.op = val;                 // write-back: cache only, mark dirty
              cap = `<b>Store x = ${val}.</b> ` + (miss ? 'The block had been evicted, so it is first read back into a slot (a miss). ' : '') +  // caption for a store: mentions the miss if the block first had to be read back in
                `Write-through also writes memory (write number ${st.wt.n}). Write-back changes only the cache and sets the dirty bit; memory still says ${st.wb.m}.`;  // the rest of the store caption: write-through's memory write count, and write-back's unchanged memory value
            } else if (k === 'dma') {  // an I/O read
              st.wt.got = st.wt.m; st.wb.got = st.wb.m;  // each policy's I/O module gets whatever that policy's main memory holds
              cap = `<b>An I/O module reads x from main memory</b>, bypassing the cache. Write-through hands it ${st.wt.m}: correct. ` +  // caption: write-through hands over the correct value
                (st.wb.m !== val ? `Write-back hands it <b>${st.wb.m}, a stale value</b>: the newest x (${val}) is still only in the cache.` : `Write-back hands it ${st.wb.m}, also correct: no newer value is waiting in the cache.`);  // write-back hands over a stale value if the newest x is only in the cache, otherwise the correct one
            } else {  // an eviction
              const dirty = st.wb.d === 1;  // dirty is true if write-back's cached block has been changed
              if (dirty) { st.wb.m = st.wb.c; st.wb.n++; st.wb.w = true; st.wb.d = 0; }  // if so, write-back copies it to memory, counts one write, lights the write arrow and clears the dirty bit
              st.wt.c = st.wb.c = null;  // both caches lose the block
              cap = '<b>The block is evicted.</b> Write-through has nothing to do: memory is already current. ' +  // caption: write-through has nothing to do because memory is already current
                (dirty ? `Write-back sees the dirty bit and copies the block to memory once (write number ${st.wb.n}).` : 'Write-back’s dirty bit is 0, so the block is simply dropped with no memory write.');  // write-back writes the block once if it is dirty, or simply drops it if not
            }  // ends the choice of event
            bEvict.disabled = st.wt.c == null;  // Evict is disabled while the block is not in the cache
            drawBoth(st);  // redraws both panels
            manCap.innerHTML = cap + ` <span class="muted">Memory writes so far: ${st.wt.n} vs ${st.wb.n}.</span>`;  // shows the caption with both memory write counts
          }  // ends act
          const modeSeg = ctx.ui.seg([{ value: 'tour', label: 'Guided tour' }, { value: 'you', label: 'Your turn' }], 'tour', (v) => {  // buttons to switch between the guided tour and "Your turn"; switching runs the function below
            const you = v === 'you';  // you is true for "Your turn"
            player.stop();  // stops the tour if it was playing
            player.el.style.display = you ? 'none' : '';  // hides the tour's player in "Your turn" mode
            manEl.style.display = you ? '' : 'none';  // shows the "Your turn" panel only in that mode
            (you ? manCtl : playerCtl).append(modeSeg);  // moves these mode buttons into whichever control row is showing
            if (you) manReset(); else player.refresh();  // "Your turn" starts fresh; the tour redraws its current frame
          });  // ends the mode buttons
          playerCtl.append(modeSeg);  // puts the mode buttons in the tour's control row to start with
          const card = (title, cls, p, pros) => h('div', { class: 'card white stack', style: { gap: '4px', padding: '8px 12px' } },  // card(title, cls, p, pros): one policy's card with its title, a summary chip, its drawing and its pros and cons
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { class: 'm0', style: { fontSize: '18px' } }, title), h('span', { class: 'chip ' + cls }, cls === 'warn' ? 'simple, safe' : 'fast, fewer writes')), p.svg,  // the card's top line: the title and a chip ("simple, safe" or "fast, fewer writes"), then the drawing
            h('div', { class: 'xs', style: { lineHeight: '1.45' }, html: pros }));  // the pros and cons text under the drawing
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },  // lays the step out as one column
            h('div', { class: 'grid-2' },  // the two policy cards side by side
              card('Write-through', 'warn', A, '<b class="c-ok">+</b> Main memory is always current, so an I/O module reading memory never gets stale data.<br><b class="c-bad">−</b> Every store becomes a memory write: heavy memory traffic that can become a bottleneck.'),  // write-through card: memory is always current, but every store becomes a memory write
              card('Write-back', 'ok', B, '<b class="c-ok">+</b> Memory is written only when a dirty block is evicted, so repeated stores cost one write.<br><b class="c-bad">−</b> Memory can be stale, so I/O that reads it directly needs care; more complex circuitry.')),  // write-back card: repeated stores cost one write, but memory can be stale
            player.el, manEl,  // the tour's player and the "Your turn" panel (only one shows at a time)
            h('div', { class: 'grid-2' },  // two callouts side by side
              h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'Write-back does <b>not</b> lose data. The newest value is safe in the cache; it simply reaches main memory later, when its block is evicted (or flushed on purpose).' }),  // callout: write-back does not lose data, it just writes it to memory later
              h('div', { class: 'callout why m0 small', 'data-label': 'Why it matters', html: 'With several processors, each cache may hold its own copy of x. Even under write-through, another processor’s cache can keep an old copy, so hardware must update or invalidate it (cache coherence, 1.8).' }))));  // callout: with several processors, other caches can hold old copies (cache coherence)
        },  // ends render() for step 7
      },  // ends step 7
      /* ---------------------------------------------------------------- 8. Cache levels */
      {  // step 8 starts here
        title: 'More than one level: L1, L2 and L3',  // title of step 8
        kind: 'explore',  // kind "explore" labels it an Explore screen
        render(el, ctx) {  // render() builds step 8 when the student arrives on it
          const { h, s } = ctx;  // h builds HTML elements and s builds SVG drawing elements
          const LV = [  // LV: where a read might be found, with a rough cycle count, time, and explanation
            { k: 'L1', cyc: 4, ns: 'about 1 ns', say: 'The level-1 data cache inside the core had it: the fastest case, and the most common one.' },  // L1: about 4 cycles, the fastest and most common case
            { k: 'L2', cyc: 12, ns: 'about 3 ns', say: 'L1 missed, so the core’s private L2 answered. Still inside the core, still quick.' },  // L2: about 12 cycles, the core's private second level
            { k: 'L3', cyc: 40, ns: 'about 10 ns', say: 'L1 and L2 missed, so the shared L3 answered. Slower: it is big and shared by every core.' },  // L3: about 40 cycles, big and shared by every core
            { k: 'Main memory', cyc: 200, ns: '50 ns or more', say: 'All three caches missed, so the core may sit idle for hundreds of cycles.' },  // main memory: about 200 cycles, the core may sit idle
          ];  // closes LV
          const svg = s('svg', { viewBox: '0 0 540 272', width: '100%' });  // the drawing of two cores, their caches, the shared L3 and main memory
          const box = (x, y, w, hh, cls, lines, fs = 14) => {  // box(...): a rounded rectangle with centred text lines; returns the rectangle (for recolouring) and the group
            const r = s('rect', { x, y, width: w, height: hh, rx: 9, class: cls, 'stroke-width': 1.5 });  // the rectangle
            return { r, g: s('g', {}, r, mtext(s, x + w / 2, y + hh / 2 + 5 - (lines.length - 1) * 8, lines, { 'text-anchor': 'middle', 'font-size': fs, 'font-weight': 700 }, 16)) };  // returns it together with a group holding it and its centred label
          };  // ends box
          const parts = [];  // parts collects the two core drawings
          const core = (ox, dim) => {  // core(ox, dim): draws one processor core at x = ox, faded if dim; returns its boxes
            const c = { frame: s('rect', { x: ox, y: 4, width: 252, height: 132, rx: 12, fill: 'none', 'stroke-width': 1.5, style: 'stroke:var(--line-2)', 'stroke-dasharray': '5 4' }) };  // a dashed frame around the core
            c.title = s('text', { x: ox + 12, y: 22, 'font-size': 13, 'font-weight': 800, class: 's-sub' }, dim ? 'Core 1' : 'Core 0 (asking)');  // the core's title: "Core 0 (asking)" or "Core 1"
            c.cpu = box(ox + 12, 30, 76, 40, 's-cpu', ['CPU']);  // the CPU box
            c.l1d = box(ox + 110, 30, 64, 40, 's-cache', ['L1-D', '32 KB'], 12.5);  // the level-1 data cache, 32 KB
            c.l1i = box(ox + 180, 30, 62, 40, 's-cache', ['L1-I', '32 KB'], 12.5);  // the level-1 instruction cache, 32 KB
            c.l2 = box(ox + 12, 84, 230, 44, 's-cache', ['L2 (private)', 'e.g. 1 MB'], 13.5);  // the private L2 cache, for example 1 MB
            const g = s('g', { style: dim ? 'opacity:.45' : '' }, c.frame, c.title, c.cpu.g, c.l1i.g, c.l1d.g, c.l2.g);  // groups all of the core's pieces, faded if this is the second core
            parts.push(g);  // adds the group to parts
            return c;  // returns the core's boxes so they can be lit up
          };  // ends core
          const c0 = core(8, false); core(280, true);  // draws core 0 (the one asking) and a faded core 1
          const l3 = box(8, 150, 524, 42, 's-cache', ['L3: shared by every core (e.g. 16 MB)'], 14.5);  // the L3 box, shared by every core
          const mem = box(8, 208, 524, 44, 's-mem', ['Main memory (e.g. 16 GB)'], 14.5);  // the main memory box
          const arr = [  // arr: the arrows showing the path of a read, from the CPU downward
            s('path', { d: 'M96,50 H116', fill: 'none' }),  // CPU to L1 data cache
            s('path', { d: 'M150,70 V82', fill: 'none' }),  // L1 to L2
            s('path', { d: 'M127,128 V148', fill: 'none' }),  // L2 to L3
            s('path', { d: 'M127,192 V206', fill: 'none' }),  // L3 to main memory
          ];  // closes arr
          svg.append(...parts, l3.g, mem.g, ...arr,  // adds the cores, L3, memory and arrows to the drawing
            s('text', { x: 532, y: 268, 'text-anchor': 'end', 'font-size': 12.5, class: 's-sub' }, 'Sizes and times are rough figures for a typical desktop processor.'));  // a note that the sizes and times are rough figures
          const cap = h('div', { class: 'card tight small', style: { minHeight: '64px', flex: 'none' } });  // the caption box under the drawing
          const targets = [c0.l1d, c0.l2, l3, mem];  // targets: the four places a read can be found, in the order they are checked
          function showLevel(i) {  // showLevel(i): shows a read found at level i: missed levels in yellow, the level that answered in green
            targets.forEach((t, k) => { t.r.setAttribute('class', k < i ? 's-warn' : k === i ? 's-ok' : (k === 3 ? 's-mem' : 's-cache')); t.r.setAttribute('stroke-width', k <= i ? 3 : 1.5); t.g.style.opacity = k > i ? '0.5' : ''; });  // recolours the four levels: missed, found, or not reached (faded)
            arr.forEach((a, k) => { const on = k <= i; a.setAttribute('class', on ? 's-line' : 's-muted'); a.style.stroke = on ? (k === i ? 'var(--ok)' : 'var(--warn)') : ''; a.setAttribute('marker-end', on ? (k === i ? 'url(#arr-ok)' : 'url(#arr-warn)') : 'url(#arr-muted)'); });  // lights the arrows up to the level that answered: yellow for missed steps, green for the last one
            const L = LV[i];  // L is the chosen level's record
            cap.innerHTML = `<b>Found in ${L.k}: ≈ ${L.cyc} cycles (${L.ns}).</b> ${L.say}`;  // caption: where it was found, how many cycles that takes, and what happened
          }  // ends showLevel
          const seg = ctx.ui.seg(LV.map((L, i) => ({ value: i, label: L.k })), 0, showLevel);  // buttons to choose where the read is found
          showLevel(0);  // starts with a read found in L1
          // average access time with 1, 2 or 3 levels (time = cycles to get the word from the level where it is found)
          const bars = h('div', { class: 'stack', style: { gap: '6px' } });  // bars holds the three average access time bars
          function avg(h1, n) {  // avg(h1, n): average cycles per read with n cache levels, when a fraction h1 of reads hit in L1
            const beyondL3 = 0.75 * 40 + 0.25 * 200, beyondL2 = n >= 3 ? 0.8 * 12 + 0.2 * beyondL3 : 0.8 * 12 + 0.2 * 200;  // beyond L1: L2 answers 80% of the rest in 12 cycles; beyond L2, L3 answers 75% in 40 cycles, else memory (200)
            return h1 * 4 + (1 - h1) * (n === 1 ? 200 : beyondL2);  // hits cost 4 cycles; misses cost what the lower levels charge (straight to memory if there is only L1)
          }  // ends avg
          let h1 = 0.9;  // h1 is the L1 hit ratio set by the slider
          function drawBars() {  // drawBars(): redraws the three bars for the current L1 hit ratio
            const vals = [1, 2, 3].map((n) => avg(h1, n)), mx = avg(0.8, 1);  // vals holds the averages for 1, 2 and 3 levels; mx (the worst case shown) sets the full bar width
            bars.replaceChildren(...['L1 only', 'L1 + L2', 'L1 + L2 + L3'].map((lab, k) => h('div', { style: { display: 'grid', gridTemplateColumns: '104px 1fr 92px', alignItems: 'center', gap: '8px' } },  // one row per setup: a label, a bar and a value, in three columns
              h('span', { class: 'small b' }, lab),  // the setup's label
              h('div', { class: 'meter', style: { height: '14px' } }, h('i', { style: { width: (100 * vals[k]) / mx + '%', background: k === 0 ? 'var(--bad)' : k === 1 ? 'var(--warn)' : 'var(--ok)' } })),  // the bar: red for L1 only, yellow for two levels, green for three
              h('span', { class: 'mono b small', style: { textAlign: 'right' } }, vals[k].toFixed(1) + ' cyc'))));  // the average in cycles, right-aligned; this ends the row and the list of rows
            const hp = Math.round(h1 * 100);  // hp is the L1 hit ratio as a whole percentage
            const hitPart = h1 * 4, missPart = (1 - h1) * 200;  // with L1 alone: the hits' share of the average (4 cycles each) and the misses' share (200 cycles each)
            insight.innerHTML = `<b class="c-bad">L1 alone:</b> the ${hp}% of hits add ${ctx.util.fmt(hitPart, 2)} cycles to the average, the ${100 - hp}% of misses add <b>${ctx.util.fmt(missPart, 2)}</b>. ` +  // the insight line: how many cycles the hits and the misses each add to the average
              (missPart >= 2 * hitPart ? 'Rare misses dominate, so extra levels pay off.' : 'Even these few misses cost more than all the hits combined.');  // the conclusion: rare misses dominate, or even these few misses cost more than all the hits together
          }  // ends drawBars
          const insight = h('p', { class: 'small m0', style: { lineHeight: '1.4' } });  // the insight paragraph under the bars (created here; drawBars first runs after this line)
          const sl = ctx.ui.slider({ label: 'L1 hit ratio', min: 80, max: 98, value: 90, format: (v) => v + '%', onInput: (v) => { h1 = v / 100; drawBars(); } });  // L1 hit ratio slider, 80% to 98%; moving it redraws the bars
          drawBars();  // draws the bars once at the starting 90%
          el.append(h('div', { class: 'split fill' },  // lays the step out in two equal columns: explanation and bars on the left, the drawing on the right
            h('div', { class: 'stack', style: { gap: '10px' } },  // left column
              h('p', { class: 'm0', html: 'One cache cannot be both big and very fast: a bigger memory has longer wires and more circuitry to select a word, so it takes longer to access. So designers stack a <span class="t">multilevel cache</span>, each level larger and slower than the one above.' }),  // paragraph: one cache cannot be both big and very fast, so caches are stacked in levels
              h('ul', { class: 'm0 small', style: { lineHeight: '1.5' }, html: '<li><b>L1</b>: tiny and fastest, inside each core, usually split into an instruction cache (L1-I) and a data cache (L1-D).</li><li><b>L2</b>: larger and a little slower, usually private to each core.</li><li><b>L3</b>: several megabytes, shared by all cores on the chip.</li><li>A miss at one level is looked up in the next; only a miss in every level goes to main memory.</li>' }),  // list: what L1, L2 and L3 are, and that only a miss in every level goes to main memory
              h('div', { class: 'card stack', style: { gap: '8px', padding: '10px 12px', flex: 'none' } },  // card holding the average time calculator
                h('h4', { class: 'm0' }, 'Average time per access'), sl, bars,  // its heading, the slider and the three bars
                h('p', { class: 'xs muted m0', html: 'Each access costs the total time to get the word from the level where it is found (4, 12, 40 or 200 cycles). Assumes L2 catches 80% of L1’s misses and L3 catches 75% of the rest.' }), insight)),  // small print: what each access costs and the assumed catch rates of L2 and L3, then the insight line
            h('div', { class: 'stack', style: { gap: '8px' } },  // right column
              h('div', { class: 'row', style: { gap: '8px' } }, h('span', { class: 'small b' }, 'Where is the word found?'), seg),  // the "where is the word found?" buttons
              h('div', { class: 'card white', style: { padding: '6px 8px' } }, svg), cap,  // white card holding the drawing, then the caption box
              h('div', { class: 'callout why m0 small', 'data-label': 'Where the OS feels it', html: 'After the OS switches to another process, the caches are still full of the old one’s blocks, so the new process starts with a burst of misses: a hidden cost of switching often.' }))));  // callout: after a process switch the caches hold the old process's blocks, so the new one starts with misses
        },  // ends render() for step 8
      },  // ends step 8
      /* ---------------------------------------------------------------- 9. Recap */
      {  // step 9 starts here
        title: 'Recap: eight ideas to carry away',  // title of step 9, the recap
        kind: 'recap',  // kind "recap" labels it a Recap screen
        render(el, ctx) {  // render() builds the recap when the student arrives on it
          const { h } = ctx;  // h builds HTML elements
          const issues = ['Cache size', 'Block size', 'Mapping function', 'Replacement algorithm', 'Write policy', 'Number of levels'];  // issues: the six design decisions shown as chips across the top
          const flipAll = (on) => ctx.$$('.flip').forEach((c) => c.classList.toggle('on', on));  // flipAll(on): turns every flip card in this step face up (true) or face down (false); ctx.$$ finds them all
          el.append(h('div', { class: 'stack fill', style: { gap: '12px' } },  // lays the recap out as one column
            h('div', { class: 'row', style: { gap: '8px' } }, h('span', { class: 'small b' }, 'The six design decisions:'), ...issues.map((t) => h('span', { class: 'chip accent' }, t))),  // the row of design decision chips
            h('div', { class: 'row', style: { gap: '8px' } }, h('p', { class: 'm0 muted small grow' }, 'Say each answer out loud before you flip the card. Click a card again to flip it back.'),  // instruction: say each answer aloud before flipping
              h('button', { class: 'btn sm', onclick: () => flipAll(true) }, 'Flip all'), h('button', { class: 'btn sm ghost', onclick: () => flipAll(false) }, 'Hide all')),  // buttons that flip all the cards up or back down
            ctx.ui.flipcards([  // flip cards (a guide helper): each card shows a prompt on the front and the answer on the back when clicked
              ['Why do caches exist?', 'Processors outran memory, and every instruction needs at least one memory access (its fetch). A small fast memory holding recently used blocks answers most accesses, thanks to locality.'],  // card: why caches exist
              ['Blocks, slots, tags', '<div>Memory: M = 2<sup>n</sup>/K blocks of K words. Cache: C slots (C ≪ M), each holding one block plus a tag that names the block.</div>'],  // card: blocks, slots and tags, with the formula for M
              ['Hit vs miss', 'Hit: the word comes straight from the cache. Miss: the whole block containing it is read into a slot and the word is delivered.'],  // card: what happens on a hit and on a miss
              ['Mapping function', 'Direct: slot = block mod C (cheap, but rivals evict each other). Associative: any slot (flexible, compare every tag). Set-associative sits between.'],  // card: the mapping functions
              ['Replacement (LRU)', 'When a new block must come in and there is a choice of slot, evict the block that has gone unused the longest. Direct mapping never has a choice.'],  // card: LRU replacement
              ['Cache size and block size', 'Size: even a small cache helps a lot; each doubling helps less, and bigger is slower. Block size: the hit ratio first rises (neighbours get used), then falls (too few, too large blocks push out data still in use).'],  // card: how cache size and block size affect the hit ratio
              ['Write-through vs write-back', 'Through: memory updated on every write (always current, heavy traffic). Back: written only when a dirty block is evicted (fewer writes, memory can be stale).'],  // card: write-through versus write-back
              ['L1, L2, L3', 'L1 tiny and fastest (per core, split into I and D), L2 larger, L3 shared by all cores. Each level catches misses before they reach main memory.'],  // card: the three cache levels
            ], { cols: 4, height: 206 })));  // four columns of 206-pixel-tall cards; this ends the layout
        },  // ends render() for the recap
      },  // ends step 9
      /* ---------------------------------------------------------------- 10. Check yourself */
      {  // step 10 starts here
        title: 'Check yourself: cache memory',  // title of step 10, the section quiz
        kind: 'check',  // kind "check" labels it a Check Yourself screen
        quiz: [  // quiz: the questions the guide's quiz engine shows, marks and saves; each has a why explaining the answer
          { q: 'Why does the speed of main memory limit how fast a processor can run, even for a program that touches very little data?',  // question 1 (multiple choice): why memory speed limits the processor even for data-light code
            choices: ['Every instruction must itself be fetched from memory before it can run.', 'The processor must copy the whole program into the cache before starting it.', 'The operating system checks main memory after every instruction.', 'The processor’s registers are stored in main memory.'],  // the four choices; only the first is right
            answer: 0,  // the index of the right choice, counting from 0 (the first choice)
            feedback: [null, 'Caches load blocks on demand, when a miss happens; nothing copies the whole program in advance.', 'The OS does not inspect memory after each instruction; the instruction cycle is run by hardware.', 'Registers are inside the processor; that is exactly why they are fast.'],  // feedback for each wrong choice (null for the right one)
            why: 'Each instruction cycle starts with an instruction fetch, which is a memory access. So even data-light code needs at least one memory access per instruction, and a slow memory would stall the processor constantly.' },  // explanation: every instruction cycle starts with a fetch from memory
          { type: 'tf', q: 'The operating system decides which blocks of main memory are copied into the cache.', answer: false,  // question 2 (true or false): the OS decides which blocks are cached; the answer is false
            why: 'Hardware loads blocks on a miss and picks which ones to replace, with no OS involvement. The OS shapes cache performance indirectly (for example through how often it switches processes), and occasionally it performs explicit cache maintenance, such as flushing or invalidating lines around a DMA transfer or when it changes memory mappings, but it never chooses which blocks are copied in.' },  // explanation: hardware loads and replaces blocks; the OS only affects the cache indirectly or through maintenance
          { type: 'num', q: 'A memory has 16-bit addresses, so it holds 2<sup>16</sup> words, and it is divided into blocks of K = 8 words. How many blocks M does it contain?', answer: 8192, tol: 0, unit: 'blocks',  // question 3 (calculate): how many blocks in a memory of 2^16 words with 8-word blocks; the answer is 8192 exactly
            why: 'M = 2<sup>n</sup> / K = 65,536 / 8 = 8,192 blocks.' },  // explanation: M = 65,536 / 8
          { type: 'order', q: 'Put the steps of a cache read that turns out to be a miss in order.',  // question 4 (put in order): the steps of a cache read that misses
            items: ['The processor issues read address RA', 'The cache checks the tags and finds the block containing RA is not present', 'The block containing RA is read from main memory', 'A cache slot is allocated for the block, evicting one if necessary', 'The block is loaded into the slot and the word is delivered to the processor'],  // the five steps, listed here in the right order; the quiz shuffles them for the student
            why: 'Receive the address, check for a hit, and on a miss fetch the whole block, find it a slot, then store it while passing the wanted word to the processor (those last two happen together).' },  // explanation: check, fetch the whole block, find a slot, then load it while passing the word on
          { type: 'num', q: 'A direct-mapped cache has C = 128 slots. Which slot can main-memory block number 1000 be stored in?', answer: 104, tol: 0,  // question 5 (calculate): the direct-mapped slot for block 1000 with 128 slots; the answer is 104
            why: 'Direct mapping uses slot = block mod C. 1000 = 7 × 128 + 104, so the block can only go in slot 104.' },  // explanation: slot = block mod C, and 1000 = 7 x 128 + 104
          { type: 'num', q: 'A direct-mapped cache is used with 16-bit addresses, blocks of 4 words and 64 slots. How many bits long is the tag field?', answer: 8, tol: 0, unit: 'bits',  // question 6 (calculate): the tag length for 16-bit addresses, 4-word blocks and 64 slots; the answer is 8 bits
            why: '4 words per block need a 2-bit word field; 64 slots need a 6-bit slot field. The tag is what is left: 16 − 2 − 6 = 8 bits.' },  // explanation: 16 bits minus a 2-bit word field and a 6-bit slot field
          { type: 'num', q: 'A processor has an L1 cache and an L2 cache. Getting a word takes 4 cycles when it is found in L1, 12 cycles when it is found in L2, and 200 cycles when it must come from main memory. 95% of accesses hit in L1, and L2 catches 80% of the accesses that miss in L1. What is the average number of cycles per access?', answer: 6.28, tol: 0.05, unit: 'cycles',  // question 7 (calculate): the average cycles per access with L1 and L2; the answer is 6.28, within 0.05
            why: 'Weight each time by how often it happens: 0.95 × 4 + 0.05 × (0.8 × 12 + 0.2 × 200) = 3.8 + 0.05 × 49.6 = 3.8 + 2.48 = 6.28 cycles. Without the L2 it would be 0.95 × 4 + 0.05 × 200 = 13.8 cycles, so the second level more than halves the average.' },  // explanation: weight each time by how often it happens, and compare with 13.8 cycles without L2
          { type: 'multi', q: 'Compared with direct mapping, which statements about associative (fully associative) mapping are true?',  // question 8 (select all that apply): what is true of associative mapping compared with direct mapping
            choices: ['A block can be placed in any slot.', 'The address’s tag must be compared with the tags of all slots.', 'A replacement algorithm such as LRU is needed to choose a victim when the cache is full.', 'Two busy blocks can keep evicting each other while other slots sit empty.', 'It needs fewer tag comparisons per access.', 'Its tag field is shorter.'],  // the six choices
            answer: [0, 1, 2],  // the right choices are the first three
            why: 'Freedom to use any slot means the hardware must search every slot at once and must choose a victim when all are full. Two blocks fighting over one slot while others sit empty is the weakness of direct mapping (for example, with 4 slots blocks 3 and 7 both map to slot 3); associative mapping avoids it. Its tag is the whole block number, so it is longer, not shorter.' },  // explanation: any slot means comparing every tag and needing a victim rule; its tag is longer
          { q: 'The cache size stays fixed while the block size grows from 1 word to very large blocks. What typically happens to the hit ratio?',  // question 9 (multiple choice): what happens to the hit ratio as blocks grow in a fixed-size cache
            choices: ['It rises at first, then falls.', 'It rises steadily, because each miss brings in more neighbouring words.', 'It falls steadily, because each miss takes longer to service.', 'It stays the same, because the cache holds the same number of words.'],  // the four choices
            answer: 0,  // the right choice is the first: it rises, then falls
            feedback: [null, 'It rises only up to a point: beyond it the cache holds too few blocks and throws out data that is still being reused.', 'Small increases help at first thanks to spatial locality, so the ratio does not fall from the start.', 'The number of words is the same, but how they are grouped into blocks changes what stays in the cache.'],  // feedback for each wrong choice
            why: 'Bigger blocks exploit spatial locality, so hits increase at first. Past a sweet spot, fewer, larger blocks mean useful data is evicted and much of each block is never used, so the hit ratio drops.' },  // explanation: spatial locality helps at first, then too few blocks push out data still in use
          { type: 'bucket', q: 'Sort each property under the write policy it describes.', buckets: ['Write-through', 'Write-back'],  // question 10 (sort into groups): write-through or write-back for each property
            items: [['Main memory is updated on every write', 0], ['Uses a dirty bit to remember which slots changed', 1], ['A loop that stores to one variable 1,000 times causes about 1,000 memory writes', 0], ['Main memory can hold stale data for a while', 1], ['A changed block is copied to memory when it is evicted', 1], ['An I/O module reading main memory always sees the newest value', 0]],  // the six properties, each with its correct group (0 = write-through, 1 = write-back)
            why: 'Write-through keeps memory current at the price of a memory write per store. Write-back saves traffic by writing a block only when a dirty one is evicted, so memory may lag behind the cache.' },  // explanation: memory always current versus fewer writes with possible stale data
          { type: 'match', q: 'Match each cache design issue to the question it answers.',  // question 11 (match the pairs): each design issue and the question it answers
            pairs: [['Mapping function', 'Which slot or slots may this block occupy?'], ['Replacement algorithm', 'Which block should be thrown out to make room?'], ['Write policy', 'When does main memory get updated after a store?'], ['Block size', 'How many words move on each miss?'], ['Number of levels', 'How many caches sit between the processor and main memory?']],  // the five issue-question pairs
            why: 'Together with cache size, these are the design decisions every cache designer must make.' },  // explanation: together with cache size, these are the decisions every cache designer makes
          { q: 'A 4-slot associative cache uses LRU replacement. It holds blocks A, B, C and D, last used at times 5, 9, 2 and 7. Block E is now needed. Which block is evicted?',  // question 12 (multiple choice): which block LRU evicts, given four last-used times
            choices: ['A', 'B', 'C', 'D'], answer: 2,  // the four choices; the right one is the third, C
            feedback: ['A was used at time 5, more recently than C.', 'B was used most recently (time 9); LRU keeps it.', null, 'D was used at time 7, more recently than C.'],  // feedback for each wrong choice
            why: 'Least recently used means the block with the oldest last-use time: C, last used at time 2. LRU bets that the block idle the longest is the least likely to be needed soon.' },  // explanation: C has the oldest last-use time, so LRU evicts it
        ],  // closes the quiz list
      },  // ends step 10
    ],  // closes the steps list
    notes: `${/* notes: the section's reading notes, written as HTML and shown in the Notes panel on any step of this section */''}
<h3>Why a cache is needed</h3>${/* heading for the notes part on why a cache is needed */''}
<p>Processor speed has grown much faster than memory speed: a simple instruction can run in about a nanosecond, while a main-memory access takes 50–100 nanoseconds, roughly a hundred times longer. Every instruction cycle touches memory at least once, because the instruction itself must be fetched, so memory speed caps processor speed.</p>${/* notes paragraph: processors outran memory, and every instruction must be fetched */''}
<p>A <b>cache</b> is a small, very fast memory between the processor and main memory that holds <b>copies</b> of the parts of main memory in current use. It works because of <b>locality of reference</b>: programs soon reuse locations they just used (temporal locality) and use locations near them (spatial locality). The hardware normally handles cache fills and replacement by itself, without help from programs or the operating system. The OS affects the cache mostly indirectly: after a process switch the cache is full of the old process’s blocks, so the new one starts with a burst of misses. The OS does occasionally perform explicit <b>cache maintenance</b>, for example flushing (writing back) or invalidating lines around a DMA transfer, or when it changes memory mappings, but it never decides which blocks are copied in.</p>${/* notes paragraph: what a cache is, why locality makes it work, and how the OS affects it */''}
<p>Processor and cache exchange single <b>words</b> (fast); cache and main memory exchange whole <b>blocks</b> (slower, but the neighbouring words are likely to be used soon).</p>${/* notes paragraph: words move between processor and cache, whole blocks between cache and memory */''}

<h3>Organization: blocks, slots and tags</h3>${/* heading for the notes part on blocks, slots and tags */''}
<ul>${/* start of the list about the cache's organization */''}
<li>Main memory has <b>2<sup>n</sup></b> addressable words (n-bit addresses), divided into fixed-length <b>blocks</b> of <b>K</b> words, so there are <b>M = 2<sup>n</sup> / K</b> blocks.</li>${/* list item: memory has 2^n words in M = 2^n / K blocks */''}
<li>The cache has <b>C slots</b> (also called <b>lines</b>). Each holds one block of K words plus a <b>tag</b> identifying which block it holds.</li>${/* list item: the cache has C slots, each holding one block plus a tag */''}
<li><b>C ≪ M</b>, so many blocks take turns in each slot; the tag is the only record of which one is there now.</li>${/* list item: C is far smaller than M, so the tag is the only record of which block is in a slot */''}
</ul>${/* end of the organization list */''}
<p><b>Example.</b> n = 16, K = 4: 2<sup>16</sup> = 65,536 words and M = 65,536 / 4 = 16,384 blocks. At real scale (every byte has an address), 16 GB in 64-byte blocks is about 268 million blocks, while a 32 KB level-1 cache has 512 slots.</p>${/* notes paragraph: worked example of M for n = 16 and K = 4, plus the real-scale figures */''}

<h3>The cache read operation</h3>${/* heading for the notes part on the read operation */''}
<ol>${/* start of the numbered read steps */''}
<li>The processor generates a read address <b>RA</b>.</li>${/* read step 1: the processor generates the read address RA */''}
<li>The cache checks (by comparing tags) whether the block containing RA is present.</li>${/* read step 2: the cache compares tags to see if RA's block is present */''}
<li><b>Hit:</b> fetch the word from its slot and deliver it to the processor; main memory is not touched.</li>${/* read step 3: on a hit the word comes from its slot and memory is not touched */''}
<li><b>Miss:</b> read the block containing RA from main memory; allocate a slot for it (evicting a block if necessary); load the block into the slot and deliver the word to the processor, these last two at the same time.</li>${/* read step 4: on a miss the block is read, a slot is allocated, and the block is loaded while the word is delivered */''}
</ol>${/* end of the numbered read steps */''}
<p>The <b>hit ratio</b> is hits ÷ total accesses, e.g. 340 hits in 400 accesses = 85%.</p>${/* notes paragraph: the hit ratio, with a worked example of 340 hits in 400 accesses */''}

<h3>Mapping function</h3>${/* heading for the notes part on the mapping function */''}
<p>The mapping function decides which slot(s) a block may occupy, and so how the cache splits an address into fields.</p>${/* notes paragraph: what the mapping function decides */''}
<p><b>Direct mapping:</b> each block has exactly one slot: <b>slot = block number mod C</b>. The address splits (high bits to low) into <b>tag | slot | word</b>: the word field has log<sub>2</sub>K bits, the slot field log<sub>2</sub>C bits, and the tag the remaining n − log<sub>2</sub>C − log<sub>2</sub>K bits. In block terms: slot = block mod C and tag = block ÷ C (whole part); the tag tells apart the blocks that share a slot. Only one tag is compared: simple, cheap, fast. Drawback: two busy blocks that map to the same slot keep evicting each other even while other slots are empty.</p>${/* notes paragraph: direct mapping, its tag, slot and word fields, and its drawback */''}
<p><b>Examples.</b> (a) 64 words, 4-word blocks, 4 slots: address 37 = 100101 → tag 10, slot 01, word 01 (word 1 of block 9; slot 9 mod 4 = 1; tag 9 ÷ 4 = 2, remainder dropped). (b) 20-bit addresses, 8-word blocks, 128 slots: word 3 bits, slot 7 bits, tag 20 − 3 − 7 = 10 bits. (c) With C = 64, block 200 goes to slot 200 mod 64 = 8. (d) With 8 slots, blocks 5 and 13 both map to slot 5, so alternating between them misses every time.</p>${/* notes paragraph: four worked direct-mapping examples, including splitting address 37 */''}
<p><b>Associative (fully associative) mapping:</b> a block may go into <b>any</b> slot. The address splits into <b>tag | word</b>; the tag is the whole block number, so it is longer than a direct-mapped tag. The hardware must compare it with every slot’s tag at once (one comparator per slot, more complex and costly), and a replacement algorithm must choose a victim when the cache is full. In return, no block is evicted while a slot is free. <b>Set-associative mapping</b>, used by most real caches, is the compromise: a block maps to one small set of slots and may use any slot in that set.</p>${/* notes paragraph: associative mapping and its costs, and set-associative mapping as the compromise */''}
<h3>Replacement algorithm</h3>${/* heading for the notes part on the replacement algorithm */''}
<p>When a block must be loaded and there is a choice of slot, the replacement algorithm picks the victim (direct mapping has no choice). The usual one is <b>least recently used (LRU)</b>: evict the block unused the longest, betting it is least likely to be needed soon. Example: blocks P, Q, R, S last used at times 8, 3, 6, 4: LRU evicts Q.</p>${/* notes paragraph: LRU, with a worked example of which block it evicts */''}

<p><b>Locality in the simulator</b> (4 slots, 4-word blocks): an array walk hits 12 of 16 reads (spatial locality); a loop run 3 times, 22 of 24 (temporal locality); random reads, 3 of 16; alternating blocks 0 and 4, 0 of 12 direct-mapped (both need slot 0), 10 of 12 associative.</p>${/* notes paragraph: the simulator lab's results for its four programs */''}

<h3>Cache size and block size</h3>${/* heading for the notes part on cache size and block size */''}
<p><b>Cache size:</b> even a small cache has a large effect, and each further doubling helps less. Larger caches also cost more and are slower, so the fastest caches stay small. (Simulated program: best hit ratio 76% at 64 words, 94% at 512.)</p>${/* notes paragraph: bigger caches help less and less, and the fastest caches stay small */''}
<p><b>Block size:</b> as blocks grow, the hit ratio <b>first rises</b>, because each miss brings in neighbouring words that are soon used (spatial locality), <b>then falls</b>: with the cache size fixed there are fewer, larger blocks, so data still being reused gets evicted, and much of each large block is never used. (Simulated 256-word cache: 55% with 1-word blocks, 91% with 8, 51% with 64.)</p>${/* notes paragraph: the hit ratio first rises, then falls, as blocks grow */''}

<h3>Write policy</h3>${/* heading for the notes part on the write policy */''}
<table>${/* start of the table comparing the two write policies */''}
<tr><th></th><th>Write-through</th><th>Write-back</th></tr>${/* table header row: write-through against write-back */''}
<tr><td>Main memory updated</td><td>On every write, with the cache</td><td>Only when a changed block is evicted (or flushed)</td></tr>${/* table row: when main memory is updated */''}
<tr><td>Extra hardware</td><td>None</td><td>A <b>dirty bit</b> (modified bit) per slot, set by a write</td></tr>${/* table row: extra hardware (the dirty bit) */''}
<tr><td>Memory traffic</td><td>High: a memory write per store</td><td>Low: one block write per dirty eviction</td></tr>${/* table row: memory traffic */''}
<tr><td>Main memory current?</td><td>Always</td><td>Not always: it can be <b>stale</b></td></tr>${/* table row: whether main memory is always current */''}
</table>${/* end of the table */''}
<p>Example: four stores to x, then its block is evicted: write-through makes 4 memory writes, write-back 1. <b>Direct memory access (DMA)</b> lets an I/O module use main memory without going through the processor or its cache; if it reads x before the eviction, write-back hands it a stale value, so hardware or the OS must write dirty blocks back first. With several processors, another cache can keep an old copy even under write-through, so hardware must update or invalidate it (<b>cache coherence</b>). Write-back never loses data: the newest value stays in the cache until written back.</p>${/* notes paragraph: the four-stores example, DMA and stale data, cache coherence, and why write-back loses nothing */''}

<h3>Multiple levels of cache</h3>${/* heading for the notes part on multiple levels of cache */''}
<p>One cache cannot be both large and very fast (a bigger memory takes longer to access), so processors stack levels. <b>L1</b>: tiny and fastest, in each core, usually split into instruction and data caches. <b>L2</b>: larger, a little slower, usually private to each core. <b>L3</b>: several megabytes, shared by all cores. A miss at one level goes to the next; only a miss at every level reaches main memory. Rough total times: L1 about 4 cycles, L2 12, L3 40, main memory 200+.</p>${/* notes paragraph: why caches come in levels, what L1, L2 and L3 are, and their rough times */''}
<p><b>Average access time</b> = sum over the levels of (fraction of accesses answered there × time to get the word from there). With a 90% L1 hit ratio: L1 only gives 0.9 × 4 + 0.1 × 200 = 23.6 cycles, 20 of them from the rare misses. An L2 that catches 80% of L1 misses gives 0.9 × 4 + 0.1 × (0.8 × 12 + 0.2 × 200) = 8.56 cycles. An L3 that catches 75% of what is left brings it to about 6.2 cycles.</p>${/* notes paragraph: average access time over the levels, worked for one, two and three levels */''}

<h3>The six cache design issues</h3>${/* heading for the notes part on the six design issues */''}
<p>(1) Cache size, (2) block size, (3) mapping function, (4) replacement algorithm, (5) write policy, (6) number of cache levels.</p>`,  // notes paragraph listing the six cache design issues; this ends the notes text
  });  // closes the object passed to Guide.section, which registers the section
})();  // closes and immediately runs the wrapping function from the top of the file
