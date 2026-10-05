// Comment key: a line inside backtick text ends with ${/* comment */''}, an empty-string slot that holds a comment without changing the text on screen (full note at the top of the page).
/* Section 8.4 Linux Memory Management
   Original teaching material. Helpers live in this IIFE so nothing leaks into the global scope. */
(() => {  // wraps the whole section in a function that runs once, right away, so its helper names stay private to this file
  const hex = (v, d) => '0x' + v.toString(16).toUpperCase().padStart(d || 1, '0');  // hex(v, d): writes v as hexadecimal with a 0x prefix, padded with zeros to at least d digits (e.g. hex(2620, 3) gives 0xA3C)
  // Multi-line SVG text.
  function mtext(s, x, y, lines, attrs = {}, lh = 18) {  // mtext(s, x, y, lines, attrs, lh): builds one SVG (the browser's drawing format) text label with several lines, lh pixels apart
    const t = s('text', Object.assign({ x, y }, attrs));  // t is the outer text element, placed at (x, y) and given any extra settings such as size, colour or alignment
    [].concat(lines).forEach((ln, i) => t.append(s('tspan', { x, dy: i === 0 ? 0 : lh }, ln)));  // each line becomes a tspan (a piece of SVG text) at the same x; every line after the first moves down by lh
    return t;  // hands back the finished label so the caller can add it to a drawing
  }  // ends mtext
  // A clickable SVG group that also works from the keyboard.
  function hotGroup(ctx, onAct, label, ...kids) {  // hotGroup(ctx, onAct, label, ...kids): wraps drawing parts in a group that acts like a button; onAct runs when it is chosen
    const g = ctx.s('g', { class: 'hot', tabindex: 0, role: 'button', 'aria-label': label }, ...kids);  // g is the SVG group: class hot gives the pointer cursor, tabindex 0 lets Tab reach it, role and aria-label tell screen readers it is a button
    g.addEventListener('click', onAct);  // a mouse click (or tap) on any part of the group runs onAct
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAct(); } });  // pressing Enter or Space while the group has keyboard focus also runs onAct; preventDefault stops Space from scrolling the page
    return g;  // hands back the group so the caller can add it to the SVG
  }  // ends hotGroup
  // Byte counts with binary units (1 KB = 1,024 bytes).
  function bytes(b) {  // bytes(b): turns a byte count into a short readable size such as "4 KB" or "256 TB", used in the step 3 captions
    const U = ['bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB'];  // U: the unit names, each one 1,024 times bigger than the one before it
    let u = 0, v = b;  // u is the position of the unit in use (starting at plain bytes); v is the number being shrunk
    while (v >= 1024 && u < U.length - 1) { v /= 1024; u++; }  // divides by 1,024 and moves up one unit for as long as the number is at least 1,024 and a bigger unit exists
    return (Number.isInteger(v) ? String(v) : v.toFixed(1)) + ' ' + U[u];  // writes whole numbers as they are and others with one decimal place, then adds the unit name
  }  // ends bytes

  /* ---- Step 3: Linux's five generic page-table levels and four example processors ---- */
  const LV = [  // LV: the five levels of Linux's generic page-table tree, top to bottom; the step 3 lab draws one row per level
    { k: 'pgd', name: 'PGD', long: 'global directory', fn: 'pgd_offset', col: 'os' },  // level 1, the page global directory: k is its short key, long its plain name, fn the kernel function that reads it, col its diagram colour
    { k: 'p4d', name: 'P4D', long: '4th-level directory', fn: 'p4d_offset', col: 'thread' },  // level 2, the 4th-level directory, used only by processors with five levels of tables
    { k: 'pud', name: 'PUD', long: 'upper directory', fn: 'pud_offset', col: 'io' },  // level 3, the page upper directory, added for processors with four levels
    { k: 'pmd', name: 'PMD', long: 'middle directory', fn: 'pmd_offset', col: 'cpu' },  // level 4, the page middle directory of the classic three-level tree
    { k: 'pte', name: 'PTE', long: 'page table', fn: 'pte_offset', col: 'proc' },  // level 5, the page table itself, whose entry holds the page's frame number
  ];  // closes the LV list
  // bits per level (PGD, P4D, PUD, PMD, PTE); 0 bits = the level is folded on that processor
  const WMODES = {  // WMODES: the four example processors of the step 3 lab, keyed by how many real levels they have
    2: { cpu: '32-bit x86', va: 32, bits: [10, 0, 0, 0, 10], entB: 4 },  // 2 levels: 32-bit addresses, 10 bits each for the global directory and the page table, 4-byte entries (entB)
    3: { cpu: '64-bit ARM or RISC-V, 39-bit mode', va: 39, bits: [9, 0, 0, 9, 9], entB: 8 },  // 3 levels: 39-bit addresses, 9 bits each for the global directory, middle directory and page table, 8-byte entries
    4: { cpu: 'x86-64', va: 48, bits: [9, 0, 9, 9, 9], entB: 8 },  // 4 levels: 48-bit addresses; the upper directory gets 9 bits too, and only the 4th-level directory is folded
    5: { cpu: 'x86-64 with 5-level paging', va: 57, bits: [9, 9, 9, 9, 9], entB: 8 },  // 5 levels: 57-bit addresses, with all five levels real at 9 bits each
  };  // closes the WMODES table
  // One small process per processor: three pages in use, one heap page never touched, one wild address.
  const WADDR = {  // WADDR: the five example addresses (in hexadecimal) for each processor, one per choice in the Address switch
    2: { code: '08049A3C', heap: '0A1C42F0', stack: 'BFFFE7D4', fresh: '0A1C52F0', wild: '60000ABC' },  // 32-bit addresses: a code page, a heap page, a stack page, an untouched heap page next to it, and a wild address no region covers
    3: { code: '5555556A3C', heap: '555578A2F0', stack: '7FFFFDE7D4', fresh: '555578B2F0', wild: '3000000ABC' },  // the same five kinds of address for the 39-bit processor
    4: { code: '555555556A3C', heap: '55555578A2F0', stack: '7FFFFFFDE7D4', fresh: '55555578B2F0', wild: '300000000ABC' },  // the same five kinds of address for the 48-bit processor
  };  // closes the WADDR table
  WADDR[5] = WADDR[4];   // Linux keeps user addresses below 128 TB unless a program asks for more
  const WHICH = [['code', 'code'], ['heap', 'heap'], ['stack', 'stack'], ['fresh', 'new heap page'], ['wild', 'bad pointer']];  // WHICH: the Address switch's choices, each as [key into WADDR, label shown on its button]
  function fnv(str) { let x = 0x811c9dc5; for (const c of str) { x ^= c.charCodeAt(0); x = Math.imul(x, 0x01000193) >>> 0; } return x >>> 0; }  // fnv(str): a quick hash (FNV-1a) that turns text into a 32-bit number; the same text always gives the same number
  const frameOf = (key) => 0x10000 + (fnv(key) % 0xEFFFF);   // a made-up but repeatable frame number (5 hex digits)
  const hx5 = (f) => hex(f, 5);  // hx5(f): writes a frame number as 5 hexadecimal digits, the format every frame number on screen uses
  // Index of every level for an address (null for a folded level).
  function idxOf(M, va) {  // idxOf(M, va): splits virtual address va into one index per level for processor M (null where the level is folded)
    let shift = 12 + M.bits.reduce((a, b) => a + b, 0);  // shift starts at the address's full width: 12 offset bits plus all the index bits of this processor
    return M.bits.map((b) => { if (!b) return null; shift -= b; return Number((va >> BigInt(shift)) & ((1n << BigInt(b)) - 1n)); });  // for each real level, moves shift down by its width and cuts out those bits; BigInt (whole numbers of any size) is needed because 57-bit addresses are too big for ordinary numbers
  }  // ends idxOf
  // Walk the tree for one address: every row is computed from the same small model of mapped pages.
  function walkOf(mode, which) {  // walkOf(mode, which): works out every row of the step 3 page walk for one processor and one example address
    const M = WMODES[mode], A = WADDR[mode];  // M is the processor's description and A its example addresses
    const va = BigInt('0x' + A[which]);  // va is the chosen address turned from hexadecimal text into a BigInt
    const mine = idxOf(M, va), maps = ['code', 'heap', 'stack'].map((k) => idxOf(M, BigInt('0x' + A[k])));  // mine holds this address's indexes; maps holds the indexes of the three pages the process really uses (code, heap, stack)
    // an entry (level l, index i) is present if some mapped page shares the path down to it
    const present = (l, i) => maps.some((m) => m[l] === i && mine.every((x, j) => j >= l || x === null || m[j] === x));  // present(l, i): true if entry i at level l is filled, meaning a used page has that index there and the same indexes on every real level above
    const keyAt = (l, i) => mode + '|' + mine.slice(0, l).join('.') + '|' + l + ':' + i;  // keyAt(l, i): a text label naming one table entry by processor, the path above it, level and index, so its made-up frame number is always the same
    const rows = [];  // rows collects one record per level for the drawing and the captions
    let table = frameOf(mode + '|root'), reads = 0, faultAt = -1, prevReal = null;  // table is the frame of the table being read (it starts at the global directory); reads counts table reads; faultAt stays -1 unless an entry is empty
    for (let l = 0; l < 5; l++) {  // visits the five levels from the top of the tree down
      const lv = LV[l];  // lv describes the level being visited
      if (mine[l] === null) { rows.push({ lv, folded: true, prevReal }); continue; }  // a folded level records a pass-through row (remembering the last real level, for its caption) and moves straight on
      const n = 2 ** M.bits[l], i = mine[l];  // n is how many entries this level's table has (2 to the power of its bits); i is the index this address picks
      const lo = Math.max(0, Math.min(i - 1, n - 3));  // lo is the first of three neighbouring entries to show, chosen so the picked entry sits in the middle unless it is at either end of the table
      const cells = [lo, lo + 1, lo + 2].map((j) => ({ i: j, present: present(l, j), value: present(l, j) ? frameOf(keyAt(l, j)) : null }));  // cells: those three entries, each with its index, whether it is filled, and the frame number it points to if it is
      const me = cells.find((c) => c.i === i);  // me is the cell this address actually picks
      reads++;  // every real level costs one memory read of a table entry
      rows.push({ lv, folded: false, idx: i, table, cells, present: me.present, value: me.value, read: reads });  // records this level's row: its index, the table's frame, the three cells, whether the picked entry is filled, and which read this was
      prevReal = lv;  // remembers this level as the last real one, for any folded level below it
      if (!me.present) { faultAt = l; break; }  // an empty entry ends the walk: the fault happened at this level
      table = me.value;  // otherwise the entry's frame number is where the next table lives
    }  // ends the loop over levels
    const off = Number(va & 0xFFFn);  // off is the lowest 12 bits of the address, the offset inside the 4 KB page
    const frame = faultAt < 0 ? table : null;  // frame is the frame number the last entry gave, or null if the walk hit a fault
    return { mode, M, which, va, mine, rows, faultAt, off, frame, phys: frame === null ? null : frame * 4096 + off, reads };  // hands back everything the lab draws; phys is frame × 4,096 + offset, the physical address (null after a fault)
  }  // ends walkOf
  /* ---- Step 4: a 16-frame buddy allocator (orders 0 to 4) ---- */
  const BN = 16, BMAX = 4;  // BN: the step 4 lab manages 16 frames; BMAX: its largest block is order 4, all 16 frames together
  const orderFor = (n) => { let k = 0; while (2 ** k < n) k++; return k; };  // orderFor(n): the smallest order k whose block of 2 to the power k frames is at least n pages (3 pages → order 2)
  const frRange = (b) => (b.order === 0 ? 'frame ' + b.start : `frames ${b.start}–${b.start + 2 ** b.order - 1}`);  // frRange(b): describes a block's frames in words, such as "frame 5" or "frames 8–11", for the log and the free-list table
  // Free blocks of one order, lowest frame first (the allocator always takes the first one).
  const freeOf = (blocks, k) => blocks.filter((b) => !b.owner && b.order === k).sort((a, b) => a.start - b.start);  // freeOf(blocks, k): the free blocks of order k, sorted by starting frame
  // One split of the first free block of order j: returns the two halves (the upper one stays free).
  function buddySplit(blocks, j) {  // buddySplit(blocks, j): halves the first free block of order j into two buddies of order j - 1
    const b = freeOf(blocks, j)[0], half = 2 ** (j - 1);  // b is the block being split; half is how many frames each half gets
    const lo = { start: b.start, order: j - 1, owner: null, pages: 0 }, hi = { start: b.start + half, order: j - 1, owner: null, pages: 0 };  // lo keeps the lower half's starting frame, hi starts half-way along; both are free blocks one order smaller
    blocks.splice(blocks.indexOf(b), 1, lo, hi);  // replaces b in the block list with its two halves, in place
    return { b, lo, hi };  // hands back the old block and both halves so the caller can highlight them and write the log
  }  // ends buddySplit
  // One merge attempt for a free block: returns the merged parent, or null if its buddy is busy or split.
  function buddyMerge(blocks, b) {  // buddyMerge(blocks, b): tries once to join free block b with its buddy into a block one order bigger
    if (b.order >= BMAX) return null;  // a block of the largest order has no buddy in this 16-frame demo, so nothing can merge
    const bs = b.start ^ (2 ** b.order), bud = blocks.find((x) => x.start === bs && x.order === b.order && !x.owner);  // bs: the buddy's start, b's start XOR (^, flips one bit) 2 to the power of its order; bud: that buddy, if it is free and the same order
    if (!bud) return null;  // no free buddy of the same order means no merge, so the caller stops trying
    const p = { start: Math.min(b.start, bs), order: b.order + 1, owner: null, pages: 0 };  // p is the merged parent block: it starts at the lower of the two starting frames and is one order bigger, and it is free
    blocks.splice(blocks.indexOf(b), 1); blocks.splice(blocks.indexOf(bud), 1, p);  // takes b out of the block list, then puts p where the buddy was, so the two halves become one entry
    return { p, bud, bs };  // hands back the parent, the buddy and the buddy's start so the caller can highlight them and explain the merge
  }  // ends buddyMerge

  Guide.section({  // registers section 8.4 with the guide; everything below is one settings object describing the section
    id: '8.4',  // id: the section number used in links, progress records and the contents panel
    title: 'Linux Memory Management',  // title: the full section name shown in headings
    short: 'Linux memory',  // short: the shorter name used where space is tight, such as the breadcrumb
    summary: 'Linux page tables on any CPU, the buddy page allocator, active/inactive page lists and the slab allocator.',  // summary: the one-sentence description shown in the contents panel and chapter overview
    objectives: [  // objectives: what the student should be able to do after this section
      'Describe Linux’s processor-independent page-table tree (page global directory, page middle directory, page table) and split a virtual address into its index fields and offset.',  // objective 1: describe the processor-independent page-table tree and split an address into index fields and offset
      'Walk an address through two-, three-, four- and five-level page tables, and explain how folded levels let one piece of code run on every processor.',  // objective 2: walk addresses through tables of two to five levels and explain folded levels
      'Use the buddy allocator’s free lists (orders 0, 1, 2, …) to allocate and free runs of contiguous page frames, splitting and merging buddies.',  // objective 3: allocate and free contiguous runs of frames with the buddy free lists
      'Contrast the old page-aging scheme with today’s split LRU (active and inactive lists, PG_referenced and PG_active flags) and trace pages between the lists.',  // objective 4: contrast old page aging with today's active and inactive lists
      'Explain how the slab allocator serves small kernel objects from caches of equal-size slots, and name the SLAB, SLOB and SLUB implementations.',  // objective 5: explain the slab allocator and name its three implementations
    ],  // closes the objectives list
    terms: [  // terms: glossary entries taught here, each as [term, definition]; dotted words on screen pop up these definitions
      ['Page global directory (PGD)', 'The top table of a Linux process’s page-table tree. Each process has exactly one, a single page in size, and it must be in main memory whenever the process runs, because every translation starts there.'],  // glossary entry: defines the page global directory, the top table that every translation starts from
      ['Page middle directory (PMD)', 'The level below the global directory in Linux’s classic three-level layout. It may span several pages; each of its entries points to one page of a page table.'],  // glossary entry: defines the page middle directory, the level below the global directory
      ['Page upper directory (PUD)', 'A level Linux inserted above the middle directory in 2005 (kernel 2.6.11), so that 64-bit processors with four levels of page tables run the same code.'],  // glossary entry: defines the page upper directory and why it was added
      ['Page 4th-level directory (P4D)', 'A level Linux inserted just below the global directory in 2017 for processors with five levels of page tables, such as recent x86-64 chips with 57-bit addresses. Elsewhere it is folded away.'],  // glossary entry: defines the 4th-level directory, added for five-level hardware
      ['Folded level', 'A page-table level that the processor does not really have. Linux defines it with one entry and zero address bits, so the walk passes straight through it and the same code works on 2-, 3-, 4- and 5-level hardware.'],  // glossary entry: defines a folded level, one entry and zero bits so the walk passes straight through
      ['Buddy allocator', 'Linux’s page allocator. It keeps free physical memory as blocks of 1, 2, 4, 8, … contiguous frames, halves a bigger block when no block of the right size is free, and merges a freed block with its buddy whenever both are free.'],  // glossary entry: defines the buddy allocator and its halving and merging of power-of-two blocks
      ['Order (of a block)', 'The size class of a block in the buddy allocator: a block of order k is 2<sup>k</sup> contiguous page frames and starts at a frame number that is a multiple of 2<sup>k</sup>.'],  // glossary entry: defines the order of a block, its size class as a power of two
      ['Page aging', 'The replacement scheme of older Linux kernels, used for the last time in 2.4.0 to 2.4.9 (2001): each page carried an 8-bit age that rose when the page was used and fell during a background sweep; pages whose age had fallen to 0 were evicted first.'],  // glossary entry: defines page aging, the older 8-bit age replacement scheme
      ['Least frequently used (LFU)', 'A replacement idea that evicts the page used the fewest times over a recent period, instead of the page that has gone unused the longest.'],  // glossary entry: defines least frequently used, evicting the page used the fewest times
      ['Split LRU', 'Linux’s page-replacement design since kernel 2.6.28 (2008): file-backed pages and anonymous pages each get their own active list and inactive list, and reclaim takes pages from the tail of an inactive list. It split the single active/inactive pair that Linux had used since 2.4.10 (2001).'],  // glossary entry: defines the split LRU, separate active and inactive lists per page type
      ['Active list', 'The list of pages that have shown they are in use (referenced at least twice). Pages that stop being used drift from its tail to the inactive list.'],  // glossary entry: defines the active list of pages that have proved busy
      ['Inactive list', 'The list of pages that are candidates for eviction. Newly read file pages start at its head, a page used again while on it is promoted to the active list, and reclaim takes pages from its tail.'],  // glossary entry: defines the inactive list of eviction candidates
      ['PG_referenced', 'A flag in each page’s descriptor that remembers one recent use. When a page whose flag is already set is used again, Linux treats that as proof the page is busy.'],  // glossary entry: defines the PG_referenced flag that remembers one recent use
      ['PG_active', 'A flag in each page’s descriptor that says the page is on an active list rather than an inactive one.'],  // glossary entry: defines the PG_active flag that marks a page as being on an active list
      ['File-backed page', 'A page whose contents come from a file on disk, such as program code or file data in the page cache. A clean one can be evicted for free, because it can be read from the file again.'],  // glossary entry: defines a file-backed page, which can be read again from its file
      ['Anonymous page', 'A page with no file behind it, such as heap or stack memory. Before its frame can be reused, its contents must be written to swap space.'],  // glossary entry: defines an anonymous page, which must go to swap before its frame is reused
      ['Page cache', 'The main memory Linux uses to keep copies of file data recently read or written, so the next access to that data needs no disk I/O.'],  // glossary entry: defines the page cache of recently used file data
      ['Slab allocator', 'The kernel’s allocator for small objects. It takes whole pages from the buddy allocator and cuts them into equal-size slots, keeping one cache of slots per object type or size.'],  // glossary entry: defines the slab allocator for small kernel objects
      ['Slab', 'One page (or a few contiguous pages) that a slab cache has cut into equal-size object slots. A slab is full, partial or empty depending on how many of its slots are in use.'],  // glossary entry: defines a slab, a page cut into equal-size object slots
      ['SLUB', 'The slab implementation that became Linux’s default in 2007 (kernel 2.6.23) and its only one since kernel 6.8 (2024), after the older SLOB and SLAB were removed.'],  // glossary entry: defines SLUB, today's only slab implementation
    ],  // closes the terms list
    css: ` /* css: style rules for this section only; every rule starts with .sec-8-4 so it cannot affect other sections */
      .sec-8-4 .hot { cursor: pointer; } /* a clickable drawing part (made by hotGroup) shows the pointing-hand cursor so students know they can click it */
      .sec-8-4 .hot:focus { outline: none; } /* removes the browser's default focus box, which looks wrong around an SVG group */
      .sec-8-4 .hot:focus-visible > :first-child { stroke-width: 3.5; } /* instead, when the keyboard brings focus to the group, its first shape gets a thicker outline */
      .sec-8-4 .tx-os { fill: var(--os); } .sec-8-4 .tx-io { fill: var(--io); } .sec-8-4 .tx-mem { fill: var(--mem); } /* tx- classes colour SVG text: purple for the system, orange for I/O, green for memory, matching the guide's colour key */
      .sec-8-4 .tx-cpu { fill: var(--cpu); } .sec-8-4 .tx-proc { fill: var(--proc); } .sec-8-4 .tx-thread { fill: var(--thread); } /* more tx- text colours: blue for the processor, teal for processes, pink (used for the 4th-level directory and kernel objects) */
      .sec-8-4 .tx-ok { fill: var(--ok); } .sec-8-4 .tx-bad { fill: var(--bad); } .sec-8-4 .tx-warn { fill: var(--warn); } .sec-8-4 .tx-acc { fill: var(--accent); } /* text colours for success (green), error (red), warning (amber) and the accent (indigo), used for faults and labels */
      .sec-8-4 .c-os { color: var(--os); } .sec-8-4 .c-io { color: var(--io); } .sec-8-4 .c-mem { color: var(--mem); } /* c- classes do the same for ordinary page text (HTML), which uses color instead of fill */
      .sec-8-4 .c-cpu { color: var(--cpu); } .sec-8-4 .c-proc { color: var(--proc); } .sec-8-4 .c-thread { color: var(--thread); } /* more c- text colours for the processor, process and thread colours */
      .sec-8-4 .c-ok { color: var(--ok); } .sec-8-4 .c-bad { color: var(--bad); } .sec-8-4 .c-warn { color: var(--warn); } .sec-8-4 .c-acc { color: var(--accent); } /* c- text colours for success, error, warning and accent, used in headings of the info cards and comparison boxes */
      .sec-8-4 .wf { border: 2px solid var(--line-2); border-radius: 8px; padding: 2px 8px; background: var(--panel); text-align: center; line-height: 1.3; } /* .wf: one field box in the step 3 lab's address strip, with a rounded border and centred text */
      .sec-8-4 .wf .bits { font-family: var(--mono); font-size: 14px; letter-spacing: .02em; } /* the bits inside a field box are in a fixed-width font so binary digits line up */
      .sec-8-4 .wf .lab { font-size: 13px; font-weight: 700; } /* the label under the bits (such as "PMD = 170") is small and bold */
      .sec-8-4 .wf.fold { border-style: dashed; color: var(--muted); } /* a folded level's box has a dashed border and grey text, since it uses 0 bits of the address */
      .sec-8-4 .wf.on { background: var(--hl); border-width: 3px; padding: 1px 7px; } /* the field being used in the current animation frame is highlighted yellow with a thicker border; padding shrinks so the box does not grow */
      .sec-8-4 .lru { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; min-height: 42px; } /* .lru: a row of page chips in the step 6 lists; chips wrap to a new line when the row is full, and the row keeps a minimum height when empty */
      .sec-8-4 .pg { display: inline-flex; align-items: center; gap: 5px; border: 2px solid var(--line-2); border-radius: 9px; padding: 4px 8px; background: var(--panel); font-weight: 800; font-size: 15px; } /* .pg: one page chip in the step 6 lists: its letter and its R flag side by side in a rounded box */
      .sec-8-4 .pg.act { border-color: var(--ok); } /* a page on the active list gets a green border */
      .sec-8-4 .pg.ina { border-color: var(--warn); } /* a page on the inactive list gets an amber border */
      .sec-8-4 .pg.hot { box-shadow: 0 0 0 3px var(--accent); } /* the page just used gets an indigo ring so the student can follow it after a click */
      .sec-8-4 .pg .rf { font-size: 12.5px; font-weight: 800; border-radius: 5px; padding: 0 4px; background: var(--panel-3); color: var(--muted); } /* .rf: the small R tag on each chip that shows the PG_referenced flag, grey while the flag is clear */
      .sec-8-4 .pg .rf.on { background: var(--ok-bg); color: var(--ok); } /* when the flag is set, the R tag turns green */
      .sec-8-4 .lru-end { font-size: 13px; color: var(--muted); white-space: nowrap; } /* .lru-end: the grey "head" and "tail" labels at each end of a list, kept on one line */
      .sec-8-4 .slab { display: grid; grid-template-columns: 74px repeat(8, minmax(0, 1fr)) 64px; gap: 4px; align-items: center; } /* .slab: one slab row in the step 7 lab, as a grid: a label column, 8 equal slot columns, then a column for the state tag */
      .sec-8-4 .slab.slim { grid-template-columns: repeat(8, minmax(0, 1fr)); } /* on phone-width screens a slab row has only the 8 slot columns; the label and tag move above it */
      .sec-8-4 .slot { height: 34px; border-radius: 7px; display: grid; place-items: center; font-size: 13px; font-weight: 700; border: 2px dashed var(--line-2); color: var(--muted); background: var(--panel); padding: 0; } /* .slot: one object slot; an empty slot has a dashed grey border and centred text */
      .sec-8-4 button.slot { border: 2px solid var(--os); background: var(--os-bg); color: var(--ink); cursor: pointer; } /* a slot holding an object is a purple button, because clicking it frees that object */
      .sec-8-4 button.slot:hover { filter: brightness(.96); border-color: var(--bad); } /* hovering over a used slot darkens it slightly and turns its border red, hinting that a click removes it */
      .sec-8-4 .slot.new { box-shadow: 0 0 0 3px var(--accent); } /* the slot just filled gets an indigo ring so the student sees where the new object went */
    `,  // end of the section's style rules
    steps: [  // steps: the slides of this section, in order
      /* ---------------- 1. Big picture: who uses the page frames ---------------- */
      {  // opens step 1, the overview of who uses the page frames
        title: 'One kernel, every machine: where each page frame goes',  // step 1 title, shown above the slide
        kind: 'story',  // kind story: an introduction slide
        render(el, ctx) {  // render(el, ctx): draws step 1 into the box el when the slide opens; ctx is the guide's toolbox for this slide
          const { h, s } = ctx;  // takes the HTML builder h and the SVG builder s out of the toolbox for short names
          // [key, label lines, x, width, shape class, text class, title, body]
          const SEG = [  // SEG: the five parts of main memory drawn as a bar, each with the details listed in the comment above
            ['code', ['Kernel', 'code'], 0, 70, 's-os', 'tx-os', 'Kernel code and static data',  // part 1, kernel code: purple, at the left edge of the bar, 70 units wide
              'The kernel’s own program and its fixed tables, loaded at boot. Linux never pages these out, so they stay in the same frames for as long as the machine runs.'],  // info text for kernel code: loaded at boot and never paged out
            ['slab', ['Kernel', 'objects'], 70, 96, 's-thread', 'tx-thread', 'Kernel objects (allocated on the fly)',  // part 2, kernel objects: pink, next to the kernel code
              'Things the kernel creates and frees all day long: a record per process, per open file, per network packet. Whole pages come from the buddy allocator, and the <span class="t">slab allocator</span> cuts them into small, equal-size objects. <b>Step 7.</b>'],  // info text for kernel objects: small records made all day long, cut from pages by the slab allocator
            ['cache', ['Page cache', '(file data)'], 166, 168, 's-io', 'tx-io', 'The page cache',  // part 3, the page cache: orange, the second-widest part
              'Copies of file data that was recently read or written. Linux fills otherwise idle frames with it, so the next read of the same file needs no disk access. These are <span class="t">file-backed pages</span>: a clean one can be dropped and simply read again later. <b>Steps 5–6</b> show how Linux picks pages to drop.'],  // info text for the page cache: copies of file data in otherwise idle frames, and why clean ones can be dropped
            ['proc', ['Process', 'pages'], 334, 176, 's-proc', 'tx-proc', 'Pages of user processes',  // part 4, process pages: teal, the widest part
              'Code, heap and stack of every running program. Each process reaches its pages through its own tree of page tables (<b>steps 2–3</b>). Heap and stack pages are <span class="t">anonymous pages</span>: no file holds a copy, so evicting one means writing it to swap space first.'],  // info text for process pages: reached through page tables; heap and stack are anonymous and need swap to evict
            ['free', ['Free'], 510, 90, 's-mem', 'tx-mem', 'Free frames',  // part 5, free frames: green, at the right edge
              'Frames nobody is using right now. The <span class="t">buddy allocator</span> keeps them in lists of runs of 1, 2, 4, 8, … neighbouring frames, so it can hand out a single frame or a long contiguous run quickly (<b>step 4</b>). When free memory runs low, the kernel reclaims pages from the page cache and from processes.'],  // info text for free frames: kept by the buddy allocator in power-of-two runs
          ];  // closes the SEG list
          const info = h('div', { class: 'card tight', style: { minHeight: '128px' } });  // info: the card under the drawing that explains whichever part was clicked; its minimum height stops the slide jumping
          const groups = {};  // groups: the clickable SVG group for each part, by key, so pick() can dim the others
          function pick(k) {  // pick(k): runs when a part is clicked; shows that part's details and highlights it
            const sg = SEG.find((x) => x[0] === k);  // sg is the SEG entry for the clicked key
            info.innerHTML = `<div class="b ${sg[5].replace('tx-', 'c-')}" style="margin-bottom:2px">${sg[6]}</div><div class="small">${sg[7]}</div>`;  // fills the info card with the part's title, coloured to match (its tx- class becomes the matching c- class), and its explanation
            Object.entries(groups).forEach(([kk, g]) => { g.style.opacity = kk === k ? '1' : '0.5'; });  // every other part fades to half opacity so the chosen one stands out
          }  // ends pick
          const slim = ctx.narrow;  // slim is true on phone-width screens (the toolbox's layout flag); the drawing then stacks the parts as rows
          const svg = s('svg', { viewBox: slim ? '0 0 330 304' : '0 0 600 168', width: '100%' });  // the SVG drawing: a tall 330 x 304 coordinate area on small screens, a wide 600 x 168 one otherwise; it stretches to the card's width
          svg.append(s('text', { x: slim ? 165 : 300, y: 16, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 15 }, slim ? 'Main memory: 4 KB page frames' : 'Main memory: millions of 4 KB page frames'));  // title along the top of the drawing, centred; the shorter wording is used on small screens
          SEG.forEach(([k, lab, x, w, cls, tcls, title], i) => {  // draws the five parts of memory one by one; i is the part's position, used for its row on small screens
            const kids = [];  // kids collects the shapes and labels of this part before they are grouped
            if (slim) {  // on phone-width screens each part becomes a full-width row
              // small screens: one full-width row per part, so the labels stay large
              const y = 28 + i * 42;  // y: the top of this part's row; each row sits 42 units below the one before it
              kids.push(s('rect', { x: 1, y, width: 328, height: 36, rx: 8, class: cls, 'stroke-width': 2 }));  // the row's coloured box, filled and outlined in the part's colour
              for (let tx = 200; tx < 322; tx += 10) kids.push(s('line', { x1: tx, y1: y + 24, x2: tx, y2: y + 32, class: 's-muted', 'stroke-width': 1 }));  // short grey tick marks along the right of the row, one every 10 units, hinting that each part is made of many frames
              kids.push(s('text', { x: 12, y: y + 23, 'font-size': 14.5, 'font-weight': 800, class: tcls }, lab.join(' ')));  // the part's name on one line at the left of the row, in its colour
            } else {  // on wider screens all parts sit side by side in one long bar
              kids.push(s('rect', { x: x + 1, y: 28, width: w - 2, height: 78, rx: 8, class: cls, 'stroke-width': 2 }));  // the part's box, starting at its x position, as wide as its share of the bar
              for (let tx = x + 10; tx < x + w - 4; tx += 10) kids.push(s('line', { x1: tx, y1: 96, x2: tx, y2: 104, class: 's-muted', 'stroke-width': 1 }));  // grey tick marks along the bottom of the box every 10 units, like a ruler of individual frames
              kids.push(mtext(s, x + w / 2, lab.length > 1 ? 61 : 71, lab, { 'text-anchor': 'middle', 'font-size': 14.5, 'font-weight': 800, class: tcls }, 18));  // the part's name centred in its box, on one or two lines (a one-line name sits lower so it stays centred)
            }  // ends the choice between the two layouts
            groups[k] = hotGroup(ctx, () => pick(k), title, ...kids);  // wraps the shapes in a clickable group that calls pick for this part; title becomes its screen-reader label
            svg.append(groups[k]);  // adds the group to the drawing
          });  // ends the loop over the five parts
          if (slim) svg.append(mtext(s, 165, 260, ['Every frame is handed out, and taken back,', 'by the buddy allocator, in runs of', '1, 2, 4, 8, … contiguous frames.'], { 'text-anchor': 'middle', 'font-size': 13.5, class: 's-sub' }, 18));  // on small screens, a three-line note under the rows: every frame comes from the buddy allocator in power-of-two runs
          else svg.append(  // on wider screens, a bracket under the whole bar with the same note
            s('line', { x1: 2, y1: 118, x2: 598, y2: 118, class: 's-line', 'stroke-width': 1.5 }),  // the long horizontal line of the bracket, spanning the full bar
            s('line', { x1: 2, y1: 112, x2: 2, y2: 124, class: 's-line', 'stroke-width': 1.5 }),  // the bracket's short upright tick at the left end
            s('line', { x1: 598, y1: 112, x2: 598, y2: 124, class: 's-line', 'stroke-width': 1.5 }),  // the bracket's short upright tick at the right end
            s('text', { x: 300, y: 140, 'text-anchor': 'middle', 'font-size': 13.5, class: 's-sub' }, 'Every frame is handed out, and taken back, by the buddy allocator'),  // first line of the note under the bracket: the buddy allocator hands out and takes back every frame
            s('text', { x: 300, y: 160, 'text-anchor': 'middle', 'font-size': 13.5, class: 's-sub' }, 'in runs of 1, 2, 4, 8, … contiguous frames.'));  // second line of the note: frames go out in runs of 1, 2, 4, 8 and so on
          info.innerHTML = '<div class="b">Click any part of memory.</div><div class="small muted">Each part says what it holds, which allocator hands out its frames, and which step of this section looks at it.</div>';  // the info card's starting text, before any part is clicked: an invitation to click and what each part will tell

          el.append(h('div', { class: 'split l fill' },  // builds the slide: a two-column layout (split l puts the smaller column on the left) that fills the step's height
            h('div', { class: 'stack' },  // left column: the reading text, stacked top to bottom
              h('p', { class: 'lead m0', html: 'Linux runs on phones, laptops and most of the world’s servers, built from about twenty families of processors. One memory manager has to work on all of them.' }),  // opening paragraph: Linux runs on very many kinds of machine, so one memory manager must fit them all
              h('p', { class: 'm0', html: 'Its work comes in two parts:' }),  // lead-in sentence for the two cards that follow
              h('div', { class: 'card proc tight small', html: '<b class="c-proc">1. Process virtual memory.</b> Give every process its own address space, translate its addresses through page tables (steps 2–3), find free frames for its pages (step 4), and choose which pages to evict when memory runs short (steps 5–6).' }),  // card 1 (teal): process virtual memory, with the steps of this section that cover each part
              h('div', { class: 'card os tight small', html: '<b class="c-os">2. Kernel memory allocation.</b> Feed the kernel’s own non-stop requests: whole runs of pages from the buddy allocator, small objects from the slab allocator (step 7).' }),  // card 2 (purple): kernel memory allocation, from the buddy and slab allocators
              h('div', { class: 'small', html: '<b>By the end you will be able to</b><ul class="m0" style="margin-top:4px"><li>walk an address through 2, 3, 4 or 5 levels of tables;</li><li>split and merge runs of frames by hand with the buddy lists;</li><li>predict which page Linux evicts, then and now;</li><li>explain why small kernel objects come from slabs.</li></ul>' })),  // the goals list: the four things the student will be able to do by the end of the section
            h('div', { class: 'stack' },  // right column: the interactive drawing and what it explains
              h('div', { class: 'card white', style: { padding: '8px 10px' } }, svg),  // a white card holding the memory drawing
              info,  // the info card that pick() fills when a part is clicked
              h('div', { class: 'callout analogy m0 small', 'data-label': 'Analogy', html: 'A self-storage company rents out lockers in runs of 1, 2, 4 or 8 side by side (the buddy allocator). Some lockers hold shelves of identical small bins for tiny items (slabs), and index cards tell each customer where its goods really sit (page tables).' }))));  // analogy box: a self-storage company with runs of lockers, bins for small items and index cards for page tables
        },  // ends render for step 1
      },  // ends step 1
      /* ---------------- 2. The classic three-level tree ---------------- */
      {  // opens step 2, the classic three-level page-table tree
        title: 'Three levels of page tables, one design for every CPU',  // step 2 title
        kind: 'learn',  // kind learn: a slide that teaches a new idea with a diagram
        render(el, ctx) {  // render(el, ctx): draws step 2 when the slide opens
          const { h, s } = ctx;  // takes the HTML builder h and the SVG builder s out of the toolbox
          const INFO = {  // INFO: what each clickable part of the diagram explains, as [colour name, title, explanation]
            gfield: ['os', 'Global directory index', 'The leftmost bits. They choose one entry of the process’s page global directory.'],  // the global directory index field: the leftmost bits, choosing a global directory entry
            mfield: ['cpu', 'Middle directory index', 'The next bits. They choose one entry inside the page of the middle directory that the global entry pointed to.'],  // the middle directory index field: the next bits, choosing an entry in a middle directory page
            tfield: ['proc', 'Page table index', 'The next bits. They choose the entry for this exact page inside the page-table page that the middle entry pointed to.'],  // the page table index field: the next bits, choosing the entry for this exact page
            ofield: ['mem', 'Offset', 'The rightmost bits (12 of them for 4 KB pages). They pick the byte inside the page and are copied into the physical address unchanged.'],  // the offset field: the rightmost 12 bits, copied unchanged into the physical address
            reg: ['acc', 'Page table pointer register', 'A processor register that holds the physical address of the running process’s global directory (on x86 it is called CR3). The kernel reloads it at every process switch, which is how each process gets its own address space.'],  // the register that holds the global directory's address and is reloaded at each process switch
            pgd: ['os', 'Page global directory (PGD)', 'One per process and exactly <b>one page</b> in size. It must be in main memory whenever the process is active, because every translation starts here. Each entry points to one page of a page middle directory, or is empty.'],  // the page global directory: one page per process, always in memory
            pmd: ['cpu', 'Page middle directory (PMD)', 'May span <b>several pages</b>: one page for each global entry in use. Each entry points to one page of a page table.'],  // the page middle directory: may span several pages, one per global entry in use
            pt: ['proc', 'Page table', 'Also spread over as many pages as needed. Each entry refers to <b>one virtual page</b>: the number of the frame holding it, plus control bits such as present, dirty, accessed and the access rights.'],  // the page table: each entry describes one virtual page with its frame number and control bits
            frame: ['mem', 'Page frame', 'The 4 KB frame of main memory that holds the page. Frame number × 4,096 + offset gives the physical address.'],  // the page frame: the 4 KB of memory holding the page, and how the physical address is formed
          };  // closes the INFO table
          const info = h('div', { class: 'card tight', style: { minHeight: '104px', flex: 'none' } });  // info: the card under the diagram that shows the clicked part's explanation; it keeps its size and does not stretch
          const groups = {};  // groups: the clickable SVG group of each part, by key
          const LINK = { gfield: 'pgd', mfield: 'pmd', tfield: 'pt', ofield: 'frame' };  // LINK: which table each address field indexes, so a field and its table light up together
          function pick(k) {  // pick(k): runs when part k is clicked; shows its explanation and highlights it with its partner
            const [c, t, body] = INFO[k];  // c is the colour name, t the title and body the explanation for this part
            info.innerHTML = `<div class="b c-${c}" style="margin-bottom:2px">${t}</div><div class="small">${body}</div>`;  // fills the info card with the coloured title and the explanation
            const lit = new Set([k, LINK[k], Object.keys(LINK).find((f) => LINK[f] === k)]);  // lit: the parts to keep bright: the clicked one, the table it indexes, and the field that indexes it
            Object.entries(groups).forEach(([kk, g]) => { g.style.opacity = lit.has(kk) ? '1' : '0.45'; });  // every part not in lit fades to 45% opacity
          }  // ends pick
          const slim = ctx.narrow;  // slim is true on phone-width screens; the diagram is then laid out as a tall column
          const svg = s('svg', { viewBox: slim ? '0 0 330 432' : '0 0 640 292', width: '100%' });  // the SVG drawing: 330 x 432 units on small screens, 640 x 292 otherwise, stretched to the card's width
          if (slim) {  // phone-width layout of the diagram
            // Small screens: the four fields in a 2 x 2 grid, then the tree as a vertical chain of wide rows.
            [['gfield', 0, 4, 's-os', 'tx-os', 'global dir. index'], ['mfield', 170, 4, 's-cpu', 'tx-cpu', 'middle dir. index'],  // the four address fields as [key, x, y, shape colour, text colour, label]: global and middle index on the first row
              ['tfield', 0, 46, 's-proc', 'tx-proc', 'page table index'], ['ofield', 170, 46, 's-mem', 'tx-mem', 'offset']].forEach(([k, x, y, cls, tcls, lab]) => {  // page table index and offset on the second row; each field is then drawn
              groups[k] = hotGroup(ctx, () => pick(k), INFO[k][1], s('rect', { x: x + 1, y, width: 158, height: 36, rx: 6, class: cls, 'stroke-width': 2 }),  // a clickable group for the field: its coloured box, 158 units wide
                s('text', { x: x + 80, y: y + 23, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700, class: tcls }, lab));  // and its label, centred in the box
              svg.append(groups[k]);  // adds the field to the drawing
            });  // ends the loop over the four fields
            groups.reg = hotGroup(ctx, () => pick('reg'), INFO.reg[1], s('rect', { x: 1, y: 96, width: 328, height: 40, rx: 8, class: 's-accent', 'stroke-width': 2 }),  // the register as a clickable full-width indigo box under the fields
              s('text', { x: 14, y: 121, 'font-size': 14, 'font-weight': 700 }, 'Register (CR3 on x86) → the PGD'));  // its label: the register (CR3 on x86) points to the global directory
            svg.append(groups.reg);  // adds the register to the drawing
            [['pgd', 'tx-os', 's-os', 'Page global directory', '1 page, resident', 1], ['pmd', 'tx-cpu', 's-cpu', 'Page middle directory', 'may span pages', 3],  // the tree as rows: [key, text colour, shape colour, name, note, which entry box is chosen]; global and middle directory first
              ['pt', 'tx-proc', 's-proc', 'Page table', 'may span pages', 0], ['frame', 'tx-mem', 's-mem', 'Page frame', '4 KB of data', 2]].forEach(([k, tcls, cls, name, foot, sel], i) => {  // then the page table and the page frame; each row is drawn below the one before it
              const y = 156 + i * 70, kids = [s('rect', { x: 1, y, width: 328, height: 54, rx: 8, class: cls, 'stroke-width': 2 }),  // y: this row's top (70 units apart); kids starts with the row's coloured box
                s('text', { x: 12, y: y + 22, 'font-size': 14.5, 'font-weight': 800, class: tcls }, name), s('text', { x: 12, y: y + 42, 'font-size': 13, class: 's-sub' }, foot)];  // the row's name in bold and its short note (such as "1 page, resident") underneath in grey
              for (let c = 0; c < 5; c++) kids.push(s('rect', { x: 206 + c * 23, y: y + 17, width: 19, height: 20, rx: 3, fill: c === sel ? 'var(--hl)' : 'var(--panel)', stroke: c === sel ? 'var(--ink)' : 'var(--line-2)', 'stroke-width': c === sel ? 1.5 : 1 }));  // five small entry boxes on the right of the row; the chosen one is yellow with a dark outline, the rest plain
              groups[k] = hotGroup(ctx, () => pick(k), INFO[k][1], ...kids);  // makes the row a clickable group that explains this table
              svg.append(s('line', { x1: 165, y1: y - 18, x2: 165, y2: y - 2, class: 's-line', 'stroke-width': 1.6, 'marker-end': 'url(#arr)' }), groups[k]);  // adds a downward arrow from the row above into this row, then the row itself
            });  // ends the loop over the rows
          } else {  // wider-screen layout of the diagram
            // Address fields sit right above the table they index.
            const F = [['gfield', 120, 128, 's-os', 'tx-os', ['global dir.', 'index']], ['mfield', 248, 138, 's-cpu', 'tx-cpu', ['middle dir.', 'index']],  // F: the four address fields as [key, x, width, shape colour, text colour, two-line label]; global and middle index first
              ['tfield', 386, 138, 's-proc', 'tx-proc', ['page table', 'index']], ['ofield', 524, 116, 's-mem', 'tx-mem', ['offset', '']]];  // page table index and offset; each field is placed right above the table it indexes
            svg.append(mtext(s, 112, 30, ['Virtual', 'address'], { 'text-anchor': 'end', 'font-size': 14, 'font-weight': 800 }, 17));  // the words "Virtual address" to the left of the fields, right-aligned so they end next to the first field
            F.forEach(([k, x, w, cls, tcls, lab]) => {  // draws each field in turn
              groups[k] = hotGroup(ctx, () => pick(k), INFO[k][1],  // a clickable group for the field that explains it when chosen
                s('rect', { x, y: 8, width: w, height: 46, rx: 6, class: cls, 'stroke-width': 2 }),  // the field's coloured box along the top of the drawing
                mtext(s, x + w / 2, lab[1] ? 27 : 36, lab.filter(Boolean), { 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700, class: tcls }, 17));  // its label centred in the box, on two lines (or one line, set lower, for "offset")
              svg.append(groups[k]);  // adds the field to the drawing
            });  // ends the loop over the fields
            // The tree: register, then PGD, PMD, page table, frame; each table has 7 rows and one chosen entry.
            const TY = 104, RH = 22;  // TY: the top of the four tables; RH: the height of one table row
            const T = [['pgd', 125, 'tx-os', 's-os', ['Page global', 'directory'], 2, '1 page, resident'], ['pmd', 263, 'tx-cpu', 's-cpu', ['Page middle', 'directory'], 4, 'may span pages'],  // T: the four tables as [key, x, text colour, shape colour, name lines, chosen row, note]; the global and middle directory first
              ['pt', 401, 'tx-proc', 's-proc', ['Page', 'table'], 1, 'may span pages'], ['frame', 529, 'tx-mem', 's-mem', ['Page', 'frame'], 5, '4 KB of data']];  // then the page table and the page frame
            const rowY = (r) => TY + 4 + r * RH;  // rowY(r): the y position of row r inside a table (rows start 4 units below the table's top)
            T.forEach(([k, x, tcls, cls, name, sel, foot], i) => {  // draws each table in turn; i is its position, used to find the next table for the arrow
              const w = 106, kids = [mtext(s, x + w / 2, TY - 26, name, { 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800, class: tcls }, 17)];  // w: every table is 106 units wide; kids starts with the table's two-line name above it
              kids.push(s('rect', { x, y: TY, width: w, height: 7 * RH + 8, rx: 8, class: cls, 'stroke-width': 2 }));  // the table's tall coloured box, big enough for 7 rows
              for (let r = 0; r < 7; r++) {  // draws the 7 rows inside the table
                const on = r === sel;  // on is true for the row this example address picks
                kids.push(s('rect', { x: x + 6, y: rowY(r) + 2, width: w - 12, height: RH - 4, rx: 4, fill: on ? 'var(--hl)' : 'var(--panel)', stroke: on ? 'var(--ink)' : 'var(--line-2)', 'stroke-width': on ? 1.5 : 1 }));  // a small row box: yellow with a dark outline for the chosen row, plain panel colour for the others
                if (on) kids.push(s('text', { x: x + w / 2, y: rowY(r) + 15, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 }, k === 'frame' ? 'byte' : 'entry'));  // the chosen row is labelled "entry" (or "byte" in the page frame, since the offset picks a byte there)
              }  // ends the loop over rows
              kids.push(s('text', { x: x + w / 2, y: TY + 7 * RH + 26, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, foot));  // the table's grey note under its box, such as "may span pages"
              groups[k] = hotGroup(ctx, () => pick(k), INFO[k][1], ...kids);  // makes the whole table a clickable group that explains it
              svg.append(groups[k]);  // adds the table to the drawing
              // arrow from the chosen entry to the next table
              if (i < 3) svg.append(s('path', { d: `M ${x + w - 6} ${rowY(sel) + RH / 2} L ${x + w + 14} ${rowY(sel) + RH / 2} L ${T[i + 1][1] - 2} ${TY + 14}`, class: 's-line', 'marker-end': 'url(#arr)', 'stroke-width': 1.6 }));  // for the first three tables, an arrow from the chosen row out to the right and down into the top of the next table
            });  // ends the loop over the tables
            groups.reg = hotGroup(ctx, () => pick('reg'), INFO.reg[1],  // the register as a clickable group that explains it when chosen
              s('rect', { x: 4, y: TY + 46, width: 96, height: 60, rx: 8, class: 's-accent', 'stroke-width': 2 }),  // its indigo box, to the left of the global directory
              mtext(s, 52, TY + 71, ['register', '(CR3 on x86)'], { 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 }, 17));  // its two-line label: "register (CR3 on x86)"
            svg.append(groups.reg, s('path', { d: `M 100 ${TY + 76} L 123 ${TY + 76}`, class: 's-line', 'marker-end': 'url(#arr)', 'stroke-width': 1.6 }));  // adds the register and a short arrow from it into the global directory
          }  // ends the choice between the two layouts
          info.innerHTML = '<div class="b">Click a field of the address, a table, or the register.</div><div class="small muted">A field and the table it indexes light up together.</div>';  // the info card's starting text: click a field, table or register; a field and its table light up together

          el.append(h('div', { class: 'split l fill' },  // builds the slide: a smaller left column of text and a larger right column with the diagram
            h('div', { class: 'stack', style: { gap: '10px' } },  // left column: the explanation
              h('p', { class: 'lead m0', html: 'One flat page table per process would be enormous (section 8.1), so Linux keeps each process’s table as a small <b>tree</b>, described the same way on every processor.' }),  // opening paragraph: one flat table per process is too big, so each process gets a small tree described the same way everywhere
              h('p', { class: 'm0', html: 'The classic Linux tree has three levels, so a virtual address is cut into four fields:' }),  // lead-in: three levels means a virtual address is cut into four fields
              h('ol', { class: 'm0 small', html: '<li>A register points to the process’s <span class="t">page global directory (PGD)</span>. The <b class="c-os">global directory index</b> picks an entry, which points to a page of the <span class="t">page middle directory (PMD)</span>.</li><li>The <b class="c-cpu">middle directory index</b> picks an entry there, which points to a page of a <span class="t">page table</span>.</li><li>The <b class="c-proc">page table index</b> picks the entry for the page itself, which holds its frame number.</li><li>Frame start + <b class="c-mem">offset</b> = the physical address.</li>' }),  // numbered list: how the register and the three indexes lead step by step to the physical address
              h('div', { class: 'callout why m0 small', 'data-label': 'Why describe it generically?', html: 'Each processor family has its own entry format and number of levels. Linux’s memory code is written once, against the generic tree; each processor supplies a few small definitions (table sizes, where the bits sit). Step 3 shows how that copes with fewer levels, or more.' })),  // why box: each processor family differs, so Linux writes its memory code once for the generic tree
            h('div', { class: 'stack', style: { gap: '10px' } },  // right column: the interactive diagram
              h('div', { class: 'card white', style: { padding: '8px 10px' } }, svg),  // a white card holding the diagram
              info,  // the info card that pick() fills
              h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'Picturing every table as fully built. Middle directories and page tables exist only for the parts of the address space a process really uses; most global-directory entries are simply empty.' }))));  // common-mistake box: middle directories and page tables exist only for the parts of memory a process uses
        },  // ends render for step 2
      },  // ends step 2
      /* ---------------- 3. Lab: the page walk on 2-, 3-, 4- and 5-level processors ---------------- */
      {  // opens step 3, the lab that walks an address through 2, 3, 4 or 5 levels
        title: 'Walk an address through 2, 3, 4 or 5 levels',  // step 3 title
        kind: 'lab',  // kind lab: a hands-on slide where the student changes the inputs
        core: true,  // core: true puts this step on the shorter core path through the guide
        render(el, ctx) {  // render(el, ctx): draws the page-walk lab when the slide opens
          const { h, s } = ctx;  // takes the HTML builder h and the SVG builder s out of the toolbox
          const slim = ctx.narrow;  // slim is true on phone-width screens, where the ladder shows only the chosen entry of each table
          let mode = 3, which = 'code', W = walkOf(mode, which);  // mode is the chosen processor (start: 3 levels) and which the chosen address (start: code); W holds the computed walk
          const VW = slim ? 380 : 600, NB = slim ? 78 : 92, RH = 46, FH = 28, GAP = 12;  // drawing sizes: VW total width, NB width of each level's name box, RH real-level row height, FH folded-row height, GAP space between rows
          const CX = NB + 12, CW = slim ? 210 : 140;  // CX: where the entry cells start (right of the name boxes); CW: the width of one entry cell
          const infoEl = h('div', { class: 'small', style: { flex: 'none' } });  // infoEl: the line that names the processor, its address size and the address being walked
          const fieldsEl = h('div', { class: 'row', style: { gap: '6px', flex: 'none' } });  // fieldsEl: the row of field boxes that shows the address cut into its bits
          const svg = s('svg', { viewBox: `0 0 ${VW} 300`, width: '100%' });  // the ladder drawing; its height is set again each time it is drawn
          const code = ctx.ui.code(`${/* code: a listing of the kernel's walk in simplified C, built by the guide's code widget so lines can be highlighted */''}
pgd = pgd_offset(mm, va);   // entry in this process's PGD${/* shown code, line 1: read the entry in this process's global directory */''}
p4d = p4d_offset(pgd, va);  // P4D entry, or pgd if folded${/* shown code, line 2: read the 4th-level entry, or pass the global entry on if that level is folded */''}
pud = pud_offset(p4d, va);  // PUD entry, or p4d if folded${/* shown code, line 3: read the upper directory entry, or pass the previous one on if folded */''}
pmd = pmd_offset(pud, va);  // PMD entry, or pud if folded${/* shown code, line 4: read the middle directory entry, or pass the previous one on if folded */''}
pte = pte_offset(pmd, va);  // PTE: this one page's entry${/* shown code, line 5: read the page table entry for this one page */''}
if (empty entry on the way) // found a present bit of 0?${/* shown code, line 6: check whether any entry on the way was empty */''}
    handle_fault(va);       // yes: the kernel steps in${/* shown code, line 7: if so, the kernel handles a page fault */''}
pa = pte_pfn(*pte) * 4096   // frame number × page size${/* shown code, line 8: frame number times the page size */''}
   + (va & 0xFFF);          // + the 12-bit offset`, { lang: 'c', nums: false, fontSize: 13 });  // shown code, line 9: plus the offset; the listing is coloured as C, without line numbers, in 13-pixel text
          const frameCount = (w) => (w.faultAt < 0 ? 7 : w.faultAt + 3);  // frameCount(w): animation frames for a walk: 7 if it succeeds (split, five levels, result), fewer if it stops at a fault
          const grp = (a) => a.replace(/(?=(?:[0-9A-F]{4})+$)/g, ' ').trim();  // grp(a): puts a space before every group of 4 hex digits counted from the right, so long addresses are easier to read

          function drawFields(cur, res) {  // drawFields(cur, res): redraws the row of field boxes; cur is the level being visited, res is true on the result frame
            const M = W.M;  // M is the chosen processor's description
            const boxes = LV.map((lv, l) => {  // makes one box per Linux level
              const b = M.bits[l];  // b is how many address bits this level uses on this processor
              if (!b) return h('div', { class: 'wf fold' }, h('div', { class: 'bits' }, '–'), h('div', { class: 'lab' }, lv.name + ': 0 bits'));  // a folded level gets a dashed box with a dash for bits and "0 bits" in its label
              const v = W.mine[l];  // v is the index this address picks at this level
              return h('div', { class: 'wf' + (cur === l ? ' on' : ''), style: { borderColor: `var(--${lv.col})` } },  // a real level's box, bordered in the level's colour and highlighted if it is the level being visited
                h('div', { class: 'bits' }, v.toString(2).padStart(b, '0')),  // the index written in binary, padded to the level's number of bits
                h('div', { class: 'lab', style: { color: `var(--${lv.col})` } }, `${lv.name} = ${v}`));  // the label under it, such as "PMD = 170", in the level's colour
            });  // ends the boxes for the five levels
            boxes.push(h('div', { class: 'wf' + (res && W.faultAt < 0 ? ' on' : ''), style: { borderColor: 'var(--mem)' } },  // adds the offset box, bordered green, highlighted on the result frame if the walk succeeded
              h('div', { class: 'bits' }, W.off.toString(2).padStart(12, '0')),  // the offset written as 12 binary digits
              h('div', { class: 'lab', style: { color: 'var(--mem)' } }, 'offset = ' + hex(W.off, 3))));  // the label "offset = 0x..." in green
            fieldsEl.replaceChildren(...boxes);  // swaps the new boxes in for the old ones
          }  // ends drawFields
          function cellG(x, y, c, sel, lit) {  // cellG(x, y, c, sel, lit): draws one table entry c as a small box at (x, y); sel marks the entry the address picks
            return s('g', {},  // hands back a group holding the entry's box and two text lines
              s('rect', { x, y: y + 4, width: CW, height: RH - 8, rx: 6, fill: sel && lit ? 'var(--hl)' : 'var(--panel)', stroke: sel ? 'var(--ink)' : 'var(--line-2)', 'stroke-width': sel ? 1.6 : 1 }),  // the box: yellow when it is the picked entry (and lit), outlined darker when picked
              s('text', { x: x + 8, y: y + 20, 'font-size': 13, class: sel ? null : 's-sub', 'font-weight': sel ? 700 : 400 }, 'entry ' + c.i),  // first line: "entry" and its index, bold for the picked entry and grey for its neighbours
              s('text', { x: x + 8, y: y + 36, 'font-size': 13, class: 's-monot ' + (c.present ? (sel ? '' : 's-sub') : 'tx-bad') }, c.present ? '→ ' + hx5(c.value) : 'empty'));  // second line: an arrow and the frame number it points to, or "empty" in red if its present bit is 0
          }  // ends cellG
          function drawLadder(cur, res) {  // drawLadder(cur, res): redraws the ladder of levels, from the global directory down to the page frame
            const M = W.M, kids = [];  // M is the processor's description; kids collects every row of the ladder
            let y = 2;  // y: where the next row starts, moving down as rows are added
            for (let l = 0; l < 5; l++) {  // goes through the five levels in order
              const lv = LV[l], r = W.rows[l], folded = !M.bits[l];  // lv is the level, r its row from the walk (missing if the walk stopped above it), folded is true if it uses 0 bits here
              const reached = !!r && (res || (cur !== null && l <= cur)), isCur = !res && cur === l;  // reached: the walk has got to this level by this frame; isCur: this is the level being visited right now
              const g = s('g', { opacity: reached ? 1 : 0.32 });  // g groups the row; rows not reached yet are faded to 32% opacity
              if (folded) {  // a folded level is drawn as a thin dashed bar
                g.append(s('rect', { x: 1, y, width: VW - 2, height: FH, rx: 7, class: 's-panel', 'stroke-dasharray': '5 4', 'stroke-width': isCur ? 2.5 : 1.2 }),  // the bar spans the full width; its outline thickens while it is the current level
                  s('text', { x: 12, y: y + 19, 'font-size': 14, 'font-weight': 800, class: 'tx-' + lv.col }, lv.name),  // the level's name at the left, in its colour
                  s('text', { x: 52, y: y + 19, 'font-size': 13, class: 's-sub' }, slim ? 'folded: passes the entry on' : `folded here: 1 entry, 0 bits; ${lv.fn}() passes the entry on`));  // the explanation: the level is folded, has 1 entry and 0 bits, and its function passes the entry on (shorter on small screens)
                kids.push(g); y += FH;  // adds the row and moves y down by the folded-row height
              } else {  // a real level gets a name box and entry cells
                g.append(s('rect', { x: 1, y, width: NB, height: RH, rx: 8, class: 's-' + lv.col, 'stroke-width': isCur ? 3 : 1.5 }),  // the name box in the level's colour, with a thick outline while it is the current level
                  s('text', { x: NB / 2 + 1, y: y + 20, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800 }, lv.name),  // the level's short name, centred in the box
                  s('text', { x: NB / 2 + 1, y: y + 37, 'text-anchor': 'middle', 'font-size': 13, class: 's-monot' }, reached ? (slim ? '' : 'at ') + hx5(r.table) : '…'));  // below it, the frame where this table sits (with "at" on wider screens), or "…" before the walk reaches it
                const cells = reached ? (slim ? r.cells.filter((c) => c.i === r.idx) : r.cells) : [];  // which entries to show: the three neighbours on wider screens, only the picked one on small screens, none before the walk gets here
                cells.forEach((c, j) => g.append(cellG(CX + j * (CW + 8), y, c, c.i === r.idx, true)));  // draws each of those entries side by side to the right of the name box
                if (!reached) for (let j = 0; j < (slim ? 1 : 3); j++) g.append(s('rect', { x: CX + j * (CW + 8), y: y + 4, width: CW, height: RH - 8, rx: 6, class: 's-panel', 'stroke-width': 1 }));  // before the walk reaches a level, empty placeholder boxes stand where its entries will appear (one on small screens, three otherwise)
                const sx = CX + (slim ? 1 : 3) * (CW + 8);  // sx: the x position just right of the entry cells, where the read count or fault is written
                if (reached) g.append(s('text', { x: sx + 2, y: y + 28, 'font-size': 13, 'font-weight': 700, class: r.present ? 's-sub' : 'tx-bad' }, r.present ? 'read ' + r.read : 'fault'));  // once reached, writes "read 1", "read 2" and so on in grey, or "fault" in red if the picked entry was empty
                kids.push(g); y += RH;  // adds the row and moves y down by a real row's height
              }  // ends the choice between a folded row and a real one
              kids.push(s('line', { x1: NB / 2 + 1, y1: y + 1, x2: NB / 2 + 1, y2: y + GAP - 2, class: 's-line', 'stroke-width': 1.5, 'marker-end': 'url(#arr)', opacity: reached ? 1 : 0.32 }));  // a short downward arrow under the name boxes, leading to the next row (faded if the walk has not got there)
              y += GAP;  // leaves the gap for that arrow before the next row
            }  // ends the loop over the five levels
            const ok = W.faultAt < 0, g = s('g', { opacity: res ? 1 : 0.32 });  // ok is true if the walk found a frame; g groups the final page-frame row, faded until the result frame
            g.append(s('rect', { x: 1, y, width: NB, height: RH + 4, rx: 8, class: ok || !res ? 's-mem' : 's-bad', 'stroke-width': res ? 3 : 1.5 }),  // the page frame's name box: green normally, red on the result frame of a walk that faulted
              mtext(s, NB / 2 + 1, y + 22, ['Page', 'frame'], { 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800 }, 17),  // its two-line label "Page frame"
              s('rect', { x: CX, y: y + 2, width: VW - CX - 2, height: RH, rx: 6, fill: res ? 'var(--hl)' : 'var(--panel)', stroke: 'var(--line-2)' }));  // the wide result box beside it, yellow on the result frame
            const l1 = !res ? '…' : ok ? `frame ${hx5(W.frame)} + offset ${hex(W.off, 3)}` : 'page fault: no frame reached';  // l1: the result's first line: the frame number plus the offset, or that a page fault stopped the walk ("…" before the end)
            const l2 = !res ? '' : ok ? `physical address ${hex(W.phys, 8)}` : (W.which === 'fresh' ? 'kernel maps a zeroed frame, retries' : 'no region here: SIGSEGV');  // l2: the second line: the physical address, or what the kernel does next (map a zeroed frame for a new heap page, or send SIGSEGV)
            g.append(s('text', { x: CX + 10, y: y + 21, 'font-size': 13.5, 'font-weight': 700, class: ok ? '' : 'tx-bad' }, l1),  // writes the first line, in red after a fault
              s('text', { x: CX + 10, y: y + 39, 'font-size': 13.5, class: 's-monot' }, l2));  // writes the second line in the fixed-width font
            kids.push(g);  // adds the final row to the ladder
            svg.setAttribute('viewBox', `0 0 ${VW} ${y + RH + 8}`);  // sets the drawing's height to fit exactly the rows drawn, since folded rows are shorter than real ones
            svg.replaceChildren(...kids);  // swaps the new ladder in for the old one
          }  // ends drawLadder
          function markCode(f, cur, res) {  // markCode(f, cur, res): highlights the lines of the code listing that match animation frame f
            code.clear();  // removes every highlight left by the previous frame
            code.mark(LV.map((_, l) => l + 1).filter((n) => !W.M.bits[n - 1]), 'dim');  // greys out the listing lines of levels that are folded on this processor (lines 1 to 5 match the five levels)
            if (f === 0) return;  // frame 0 only splits the address, so nothing more is highlighted
            if (!res) { code.mark(cur + 1, W.rows[cur].folded || W.rows[cur].present ? 'cur' : 'bad'); return; }  // during the walk, marks the current level's line (in red if its entry is empty) and stops
            if (W.faultAt < 0) code.mark([8, 9], 'ok'); else code.mark([W.faultAt + 1, 6, 7], 'bad');  // on the result frame: green on the address lines 8-9 if the walk succeeded, or red on the faulting level and the fault lines 6-7
          }  // ends markCode
          function caption(f, cur, res) {  // caption(f, cur, res): writes the explanation under the player for frame f
            const M = W.M, real = M.bits.filter(Boolean), folded = LV.filter((_, l) => !M.bits[l]).map((x) => x.name);  // real: the bit widths of the real levels; folded: the names of the levels this processor lacks
            if (f === 0) {  // frame 0 explains how the address is split
              const b = real[0], tb = 2 ** b * M.entB;  // b: the bits per real level (all are equal here); tb: one table's size in bytes, entries times entry size
              return `<b>Split the address.</b> ${M.va} bits = a 12-bit offset (4 KB pages) + ${real.length} index fields of ${b} bits. Each table holds 2<sup>${b}</sup> = ${(2 ** b).toLocaleString('en-US')} entries of ${M.entB} bytes = ${bytes(tb)}: exactly one page. ` +  // caption, frame 0: address width = offset + index fields, and each table fills exactly one page
                (folded.length ? `${folded.join(', ')} get 0 bits: ${folded.length > 1 ? 'those levels do' : 'that level does'} not exist on this processor, so Linux folds ${folded.length > 1 ? 'them' : 'it'}.` : 'All five Linux levels are real here.');  // then names the folded levels and why they get 0 bits, or says all five levels are real
            }  // ends the frame 0 caption
            if (!res) {  // frames during the walk explain one level each
              const r = W.rows[cur], lv = LV[cur];  // r is the walk's record for the current level and lv its description
              if (r.folded) return `<b>${lv.name} is folded.</b> This processor has no ${lv.long} level, so Linux defines one with a single entry and 0 index bits. <code>${lv.fn}()</code> hands back the ${r.prevReal.name} entry unchanged: no memory read, no cost.`;  // caption for a folded level: it has one entry and 0 bits, and its function hands back the entry above at no cost
              const where = cur === 0 ? `The page table pointer register (CR3 on x86) says this process’s PGD is in frame ${hx5(r.table)}.` : `The ${lv.long} page is in frame ${hx5(r.table)}, the frame the entry above named.`;  // where: how the walk found this table: from the register for the top level, or from the entry one level up
              if (!r.present) return `<b>${lv.name}: entry ${r.idx} is empty.</b> ${where} Index ${r.idx} picks an entry whose present bit is 0, so the walk stops and the hardware raises a <b>page fault</b>.`;  // caption for an empty entry: the present bit is 0, so the walk stops with a page fault
              const nxt = cur === 4 ? `present bit 1 and this page’s frame number, <b>${hx5(r.value)}</b>` : `frame ${hx5(r.value)}, where the next table lives`;  // nxt: what the picked entry holds: the page's frame number at the page-table level, otherwise the frame of the next table
              return `<b>${lv.name}, memory read ${r.read}.</b> ${where} Index ${r.idx} picks entry ${r.idx}, which holds ${nxt}.`;  // caption for a filled entry: which memory read this is, where the table is, and where its entry leads
            }  // ends the captions for the walk frames
            if (W.faultAt < 0) return `<b>Physical address.</b> Frame ${hx5(W.frame)} × 4,096 + offset ${hex(W.off, 3)} = <b>${hex(W.phys, 8)}</b>. It took ${W.reads} table reads before the data itself could be read, which is why the TLB (section 8.1) remembers the result.`;  // caption for the result of a successful walk: the physical address, and why the TLB caches it after so many reads
            if (W.which === 'fresh') return `<b>Page fault, then a fix.</b> The address is inside the heap, but this page was never touched, so its PTE is empty. The kernel takes a free frame from the buddy allocator (step 4), fills it with zeros, records it in the PTE with present = 1 and restarts the instruction. The second walk succeeds.`;  // caption for the new heap page: a fault the kernel fixes by mapping a fresh zero-filled frame and retrying
            return `<b>Page fault, then a crash.</b> The ${LV[W.faultAt].name} entry is empty. The kernel looks for a memory region of the process that covers this address, finds none, and sends the process the SIGSEGV signal (a segmentation fault).`;  // caption for the wild address: no region covers it, so the process gets SIGSEGV
          }  // ends caption
          const player = ctx.ui.player({ count: frameCount(W), interval: 1900, speed: false, render: (f) => {  // player: the guide's animation player with one frame per stage, 1.9 seconds apart when playing, without speed buttons
            const n = frameCount(W), res = f > 0 && f === n - 1, cur = f >= 1 && !res ? f - 1 : null;  // n: the frame count; res is true on the last frame; cur is the level being visited (frame 1 is level 0), or null
            drawFields(cur, res); drawLadder(cur, res); markCode(f, cur, res);  // redraws the field boxes, the ladder and the code highlights for this frame
            return caption(f, cur, res);  // returns the caption, which the player shows above its controls
          } });  // ends the player's settings
          function setup() {  // setup(): recomputes everything after the processor or the address changes
            W = walkOf(mode, which);  // works out the new walk
            const M = W.M;  // M is the processor's description
            infoEl.innerHTML = `<b>${M.cpu}</b> · ${M.va}-bit virtual addresses: 2<sup>${M.va}</sup> bytes = ${bytes(2 ** M.va)} that one tree can map · this address: <span class="mono b">0x${grp(WADDR[mode][which])}</span>`;  // fills the info line: processor name, address width, how much memory one tree can map, and the address grouped by fours
            player.setCount(frameCount(W));  // gives the player the new number of frames, which also sends it back to frame 0
          }  // ends setup
          const modeSeg = ctx.ui.seg([2, 3, 4, 5].map((m) => ({ value: m, label: m + '-level' })), mode, (v) => { mode = v; setup(); });  // the Processor switch: buttons for 2-, 3-, 4- and 5-level; choosing one stores it in mode and runs setup
          const whichSeg = ctx.ui.seg(WHICH.map(([v, l]) => ({ value: v, label: l })), which, (v) => { which = v; setup(); });  // the Address switch: code, heap, stack, new heap page or bad pointer; choosing one stores it in which and runs setup
          setup();  // runs setup once so the slide opens on the 3-level code address
          el.append(h('div', { class: 'stack fill', style: { gap: '8px' } },  // builds the slide as one column that fills the step's height
            h('div', { class: 'row', style: { gap: '10px', flex: 'none' } }, h('span', { class: 'small b' }, 'Processor'), modeSeg, h('span', { class: 'small b', style: { marginLeft: '6px' } }, 'Address'), whichSeg),  // top row: the "Processor" label and switch, then the "Address" label and switch
            infoEl, fieldsEl,  // the info line, then the row of field boxes
            h('div', { style: { display: 'grid', gridTemplateColumns: slim ? 'minmax(0,1fr)' : 'minmax(0,1fr) 490px', gap: '14px', flex: '1', minHeight: '0' } },  // below them a grid: one column on small screens, otherwise the ladder on the left and a 490-pixel column on the right
              h('div', { class: 'card white', style: { padding: '8px 10px', alignSelf: 'start' } }, svg),  // a white card holding the ladder drawing, kept at the top of its cell
              h('div', { class: 'stack', style: { gap: '6px' } }, code,  // the right column: the code listing first
                h('div', { class: 'xs muted', html: 'On most processors the MMU walks this tree in hardware on a TLB miss. The kernel walks it in software (above, simplified) whenever it must read or change a mapping.' }),  // small grey note: the MMU walks this tree in hardware on a TLB miss, and the kernel walks it in software to change mappings
                player.el))));  // the player's controls and caption; closes the layout
        },  // ends render for step 3
      },  // ends step 3
      /* ---------------- 4. Lab: the buddy allocator's free lists ---------------- */
      {  // opens step 4, the buddy allocator lab
        title: 'Runs of frames on demand: the buddy allocator',  // step 4 title
        kind: 'lab',  // kind lab: the student requests and frees blocks
        render(el, ctx) {  // render(el, ctx): draws the buddy allocator lab when the slide opens
          const { h, s } = ctx;  // takes the HTML builder h and the SVG builder s out of the toolbox
          const slim = ctx.narrow;  // slim is true on phone-width screens, where the 16 frames are drawn as two rows of 8
          const SCRIPT = [['A', 1], ['B', 3], ['C', 4], ['free', 'A'], ['D', 2], ['free', 'B'], ['free', 'D'], ['free', 'C']];  // SCRIPT: the sample run: A, B and C ask for 1, 3 and 4 pages, A frees, D asks for 2, then B, D and C free their blocks
          let blocks, pc, gen = 0, busy = false, hot = [], changed = new Set(), nextCh = 4;  // blocks: every block, free or used; pc: the next sample operation; gen: changes on reset to cancel an animation; busy: an animation is running; hot, changed: what to highlight; nextCh: letter rotation for new requests
          const cols = slim ? 8 : 16, FW = slim ? 42 : 38, X0 = 4, BH = 44, ROWH = BH + 24;  // cols: frames per drawn row; FW: width of one frame; X0: left margin; BH: block height; ROWH: a row's height including the frame numbers
          const svg = s('svg', { viewBox: `0 0 ${X0 * 2 + cols * FW} ${(BN / cols) * ROWH + 2}`, width: '100%' });  // the SVG drawing, sized to fit all rows of frames
          const lists = h('div'), stats = h('div', { class: 'row', style: { gap: '5px' } });  // lists: the free-list table; stats: the row of counters
          const log = h('div', { class: 'log', style: { minHeight: '0', height: '100%', fontFamily: 'var(--font)', fontSize: '13.5px' } });  // log: the message box, newest message on top; it fills the space it is given
          const bSample = h('button', { class: 'btn sm primary', onclick: () => sampleStep() });  // bSample: the button that runs the next operation of the sample; draw() writes its label
          const say = (html) => log.prepend(h('div', { html }));  // say(html): adds one message to the top of the log
          function reset() {  // reset(): puts the lab back to its starting state; runs at the start and from the Reset button
            gen++; busy = false; pc = 0; nextCh = 4; hot = []; changed = new Set([BMAX]);  // moving gen on stops any animation still running; clears the sample position, letters and highlights; lights up the order-4 list row
            blocks = [{ start: 0, order: BMAX, owner: null, pages: 0 }];  // one free order-4 block covering all 16 frames
            log.replaceChildren(h('div', { html: '16 free frames, kept as one order-4 block. Request pages, or run the sample.' }));  // the log's starting message
            draw();  // redraws everything
          }  // ends reset
          function draw() {  // draw(): redraws the frame strip, the free-list table, the counters and the buttons from blocks
            const kids = [];  // kids collects the drawing's parts
            blocks.slice().sort((a, b) => a.start - b.start).forEach((b) => {  // goes through the blocks in frame order
              const size = 2 ** b.order, isHot = hot.includes(b), segs = [];  // size: how many frames the block covers; isHot: it should be outlined; segs: its shapes
              for (let r = 0; r < BN / cols; r++) {  // goes through each drawn row of frames (one row on wider screens, two on small ones)
                const a = Math.max(b.start, r * cols), e = Math.min(b.start + size, (r + 1) * cols);  // a to e: the frames of this block that fall on row r
                if (a >= e) continue;  // skips rows the block does not touch
                const y = 2 + r * ROWH, x = X0 + (a - r * cols) * FW;  // y: the top of row r; x: the left edge of this part of the block
                // fill: free (green), or used part (teal) then the unused tail (amber); thin lines mark each frame
                const usedEnd = b.owner ? Math.min(e, Math.max(a, b.start + b.pages)) : a;  // usedEnd: where the used frames of this row end; a used block fills its first b.pages frames, a free block uses none
                const fx = (f) => X0 + (f - r * cols) * FW;  // fx(f): the x position of the left edge of frame f on this row
                if (usedEnd > a) segs.push(s('rect', { x: fx(a) + 1, y: y + 1, width: (usedEnd - a) * FW - 2, height: BH - 2, rx: 6, class: 's-proc', 'stroke-width': 0 }));  // the used frames as a teal bar
                if (e > usedEnd) segs.push(s('rect', { x: fx(usedEnd) + 1, y: y + 1, width: (e - usedEnd) * FW - 2, height: BH - 2, rx: 6, class: b.owner ? 's-warn' : 's-mem', 'stroke-width': 0 }));  // the rest of the part: amber if it was given out but is not needed, green if the block is free
                for (let f = a + 1; f < e; f++) segs.push(s('line', { x1: fx(f), y1: y + 6, x2: fx(f), y2: y + BH - 6, class: 's-muted', 'stroke-width': 1 }));  // thin grey dividers between neighbouring frames so each frame can be counted
                segs.push(s('rect', { x: x + 0.5, y, width: (e - a) * FW - 1, height: BH, rx: 7, fill: 'none', stroke: isHot ? 'var(--accent)' : 'var(--ink-2)', 'stroke-width': isHot ? 3 : 1.6 }));  // the block's outline over its fill: a thick indigo outline if it was just split, merged or given out, otherwise a dark thin one
                if (a === b.start) {  // the label goes only on the row where the block starts
                  const w = (e - a) * FW, l1 = b.owner || 'free', l2 = w > 60 ? (b.owner ? `${b.pages} of ${size}` : 'order ' + b.order) : '';  // w: the part's width; l1: the owner's letter or "free"; l2: "pages of size" for used blocks or the order for free ones, only if wide enough
                  const bw = Math.max(l1.length * 9, l2.length * 7.4) + 10, bh = l2 ? 34 : 20;  // bw, bh: the size of a backing patch for the label, estimated from the text lengths
                  if (w > 50) segs.push(s('rect', { x: x + w / 2 - bw / 2, y: y + BH / 2 - bh / 2, width: bw, height: bh, rx: 5, fill: 'var(--panel)', opacity: 0.85 }));  // on blocks wide enough, a slightly see-through patch behind the label so it stays readable over the colours and dividers
                  segs.push(s('text', { x: x + w / 2, y: y + (l2 ? 20 : 27), 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800, class: b.owner ? '' : 'tx-mem' }, l1));  // the label's first line, centred: the owner's letter, or "free" in green
                  if (l2) segs.push(s('text', { x: x + w / 2, y: y + 36, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, l2));  // the label's second line in grey, if there is one
                }  // ends the label
              }  // ends the loop over rows
              kids.push(b.owner && !busy ? hotGroup(ctx, () => free(b.owner), `Free block ${b.owner}`, ...segs) : s('g', {}, ...segs));  // a used block becomes clickable (to free it) when no animation is running; any other block is a plain group
            });  // ends the loop over blocks
            for (let f = 0; f < BN; f++) {  // numbers every frame from 0 to 15
              const r = Math.floor(f / cols);  // r: which drawn row this frame is on
              kids.push(s('text', { x: X0 + (f - r * cols) * FW + FW / 2, y: 2 + r * ROWH + BH + 16, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, String(f)));  // the frame number, centred under its frame
            }  // ends the frame numbers
            svg.replaceChildren(...kids);  // swaps the new drawing in for the old one
            lists.innerHTML = '<table class="tbl compact"><tr><th>Free list</th><th>Free blocks on it</th></tr>' + [0, 1, 2, 3, 4].map((k) => {  // rebuilds the free-list table: a heading row, then one row per order from 0 to 4
              const f = freeOf(blocks, k);  // f: the free blocks of order k
              return `<tr class="${changed.has(k) ? 'on' : ''}"><td class="b" style="white-space:nowrap">order ${k} <span class="muted" style="font-weight:400">(${2 ** k})</span></td><td>${f.length ? f.map((b) => `<span class="chip mem">${frRange(b)}</span>`).join(' ') : '<span class="muted">empty</span>'}</td></tr>`;  // a row, highlighted if this list just changed: the order and its block size, then a chip per free block or "empty"
            }).join('') + '</table>';  // ends the rows and closes the table
            const used = blocks.filter((b) => b.owner), freeN = blocks.filter((b) => !b.owner).reduce((t, b) => t + 2 ** b.order, 0);  // used: blocks that have an owner; freeN: how many frames are free in total
            const waste = used.reduce((t, b) => t + 2 ** b.order - b.pages, 0);  // waste: frames handed out but not needed, the cost of rounding requests up to a power of two
            stats.innerHTML = `<span class="chip mem">${freeN} free</span><span class="chip proc">${used.reduce((t, b) => t + b.pages, 0)} in use</span><span class="chip warn">${waste} unused inside blocks</span>`;  // three counters: free frames (green), frames in use (teal) and frames unused inside blocks (amber)
            const op = SCRIPT[pc];  // op: the next operation of the sample, or nothing once it is finished
            bSample.textContent = !op ? 'Sample finished' : op[0] === 'free' ? `Sample: ${op[1]} frees its block` : `Sample: ${op[0]} asks for ${op[1]} page${op[1] > 1 ? 's' : ''}`;  // the sample button says what the next operation will do, or that the sample is finished
            bSample.disabled = !op || busy;  // the sample button is greyed out once finished or while an animation runs
            el.querySelectorAll('.req').forEach((b) => { b.disabled = busy; });  // the "Ask for" buttons are also greyed out while an animation runs
          }  // ends draw
          async function alloc(who, n) {  // alloc(who, n): gives who a block for n pages, splitting bigger blocks one at a time with a pause; async lets it wait between splits
            if (busy) return;  // ignores clicks while another animation is running
            const k = orderFor(n);  // k: the order needed for n pages
            let j = k;  // j will become the smallest order that has a free block
            while (j <= BMAX && !freeOf(blocks, j).length) j++;  // moves up through the orders until a list with a free block is found
            if (j > BMAX) { changed = new Set(); hot = []; say(`<b>${who}</b> asks for ${n} page${n > 1 ? 's' : ''} (order ${k}), but no free block of order ${k} or more exists. <span class="c-bad b">The request fails</span> (a real kernel would first try to reclaim or compact memory).`); draw(); return; }  // if no list from k up has a block, the request fails: clears highlights, explains why in the log and redraws
            const g = gen; busy = true;  // g remembers the current reset count so a Reset during the pauses can be noticed; busy blocks other actions
            say(`<b>${who}</b> asks for ${n} page${n > 1 ? 's' : ''} → order ${k} (${2 ** k} frame${k ? 's' : ''}). ` + (j > k ? (j - 1 > k ? `Lists ${k}–${j - 1} are empty` : `The order-${k} list is empty`) + `; the smallest free block is order ${j}.` : `The order-${k} list has a block ready.`));  // log message: the request, the order it needs, and whether that list has a block or a bigger one must be split
            while (j > k) {  // splits until a block of order k exists
              const { b, hi } = buddySplit(blocks, j);  // halves the first free block of order j; b is the old block and hi its upper half
              hot = blocks.filter((x) => x.start >= b.start && x.start < b.start + 2 ** j && x.order === j - 1); changed = new Set([j, j - 1]);  // outlines the two new halves and highlights the two list rows that changed
              say(`Split the order-${j} block (${frRange(b)}) into two order-${j - 1} buddies; ${frRange(hi)} ${j > 1 ? 'join' : 'joins'} the order-${j - 1} list.`);  // log message: which block was split and which half joined the list one order down
              draw();  // redraws to show the split
              await ctx.sleep(600);  // waits 0.6 seconds so the student can see each split
              if (!ctx.alive || g !== gen) return;  // stops if the student left the slide or pressed Reset meanwhile
              j--;  // moves down one order for the next split
            }  // ends the splitting loop
            const b = freeOf(blocks, k)[0];  // b: the first free block of the needed order
            b.owner = who; b.pages = n; hot = [b]; changed = new Set([k]);  // gives it to who, records how many pages are really used, and highlights it and its list row
            say(`<b>${who}</b> gets ${frRange(b)}` + (2 ** k > n ? `; ${2 ** k - n} frame${2 ** k - n > 1 ? 's' : ''} inside it ${2 ** k - n > 1 ? 'go' : 'goes'} unused.` : '.'));  // log message: which frames who got, and how many frames inside the block go unused
            busy = false; draw();  // ends the animation and redraws
          }  // ends alloc
          async function free(who) {  // free(who): returns who's block and merges it with free buddies, one order at a time, with a pause between merges
            if (busy) return;  // ignores clicks while another animation is running
            let b = blocks.find((x) => x.owner === who);  // b: the block who owns
            if (!b) { say(`${who} holds no block, so there is nothing to free.`); draw(); return; }  // if who owns nothing, says so and stops
            const g = gen; busy = true;  // remembers the reset count and marks the lab busy
            b.owner = null; b.pages = 0; hot = [b]; changed = new Set([b.order]);  // marks the block free, outlines it and highlights its list row
            say(`<b>${who}</b> frees ${frRange(b)} (order ${b.order}).`);  // log message: which frames are freed and their order
            draw();  // redraws to show the freed block
            for (;;) {  // tries merges until one fails
              await ctx.sleep(600);  // waits 0.6 seconds before each merge attempt
              if (!ctx.alive || g !== gen) return;  // stops if the student left the slide or pressed Reset meanwhile
              const bs = b.start ^ (2 ** b.order), m = buddyMerge(blocks, b);  // bs: where the buddy starts (frame XOR block size); m: the merge result, or null if no merge was possible
              if (!m) {  // no merge this time
                if (b.order >= BMAX) say('This block is all 16 frames: nothing left to merge.');  // a block of all 16 frames has nothing left to merge with
                else {  // otherwise the buddy is busy or broken up
                  const c = blocks.find((x) => x.start <= bs && bs < x.start + 2 ** x.order);  // c: the block that holds the buddy's first frame
                  say(`Its buddy (frame ${bs} = ${b.start} XOR ${2 ** b.order}) is ${c.order === b.order ? 'in use by ' + c.owner : 'split into smaller blocks, some in use'}, so merging stops. The block stays on the order-${b.order} list.`);  // log message: the buddy's frame, worked out with XOR, and why it cannot merge (in use, or split into smaller blocks)
                }  // ends the explanation
                break;  // leaves the merge loop
              }  // ends the no-merge case
              say(`Its buddy at frame ${bs} (${b.start} XOR ${2 ** b.order}) is free too: merge into one order-${m.p.order} block, ${frRange(m.p)}.`);  // log message: the buddy is free, so the two join into one block one order bigger
              b = m.p; hot = [b]; changed = new Set([b.order - 1, b.order]);  // carries on with the merged block, outlining it and highlighting both list rows that changed
              draw();  // redraws to show the merge
            }  // ends the merge loop
            busy = false; draw();  // ends the animation and redraws
          }  // ends free
          function sampleStep() {  // sampleStep(): runs the next operation of the sample script; the sample button calls it
            if (busy || pc >= SCRIPT.length) return;  // does nothing while busy or once the script is finished
            const [a, n] = SCRIPT[pc++];  // reads the next operation and moves pc past it
            if (a === 'free') free(n); else alloc(a, n);  // a "free" operation frees that letter's block; any other asks for pages
          }  // ends sampleStep
          function custom(n) {  // custom(n): handles an "Ask for" button by picking an unused letter for the new request
            if (busy) return;  // ignores clicks while an animation runs
            const inUse = new Set(blocks.map((b) => b.owner));  // inUse: the letters that own a block now
            let who = null;  // who: the letter this request will use
            for (let i = 0; i < 22 && !who; i++) { const c = String.fromCharCode(69 + ((nextCh - 4 + i) % 22)); if (!inUse.has(c)) { who = c; nextCh = 4 + ((nextCh - 4 + i + 1) % 22); } }  // tries the letters E to Z in turn, starting after the last one handed out, and takes the first one not in use
            alloc(who, n);  // asks for n pages for that letter
          }  // ends custom
          reset();  // sets up the starting state before the controls are built
          const reqs = [1, 2, 3, 4, 8].map((n) => h('button', { class: 'btn sm req', onclick: () => custom(n) }, n + (n > 1 ? ' pages' : ' page')));  // the "Ask for" buttons for 1, 2, 3, 4 and 8 pages; class req lets draw() grey them out during animations
          el.append(h('div', { class: 'split l fill' },  // builds the slide: explanation on the left, the lab on the right
            h('div', { class: 'stack', style: { gap: '8px' } },  // left column: the explanation
              h('p', { class: 'lead m0', html: 'Some jobs need frames <b>side by side</b>: a device copying straight into memory, a 2 MB huge page, a big buffer. Linux finds such runs with a <span class="t">buddy allocator</span>.' }),  // opening paragraph: some jobs need frames side by side, and Linux finds them with a buddy allocator
              h('ol', { class: 'm0 small', html: '<li>Free frames are kept in blocks of 2<sup>k</sup> neighbours; k is the block’s <span class="t">order</span>. Each order has a free list (Linux: orders 0 to 10, up to 1,024 frames = 4 MB).</li><li>n pages get the smallest order with 2<sup>k</sup> ≥ n: 3 pages → order 2, four frames.</li><li>If that list is empty, take a bigger block and <b>halve</b> it until it fits; each spare half joins the list one order down.</li><li>On a free, if the block’s <b>buddy</b> is free and the same order, <b>merge</b> them, then try again one order up.</li>' }),  // numbered rules: blocks of 2 to the power k frames, picking the order, halving and merging
              h('div', { class: 'callout tip m0 small', 'data-label': 'Finding a buddy in one step', html: 'An order-k block at frame f has its buddy at f XOR 2<sup>k</sup>: the order-2 block at frame 12 pairs with 12 XOR 4 = 8, and the one at 8 pairs with 12.' }),  // tip box: the buddy of an order-k block at frame f is at f XOR 2 to the power k, with a worked pair
              h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'Merging any two free neighbours. Frames 2–3 and 4–5 are both order 1 and touch, but they are not buddies (the buddy of 2 is 2 XOR 2 = 0), so they never merge.' })),  // common-mistake box: touching free blocks of the same order are not always buddies, shown with frames 2-3 and 4-5
            h('div', { class: 'stack', style: { gap: '8px' } },  // right column: the lab itself
              h('div', { class: 'row', style: { gap: '8px' } }, bSample, h('button', { class: 'btn sm ghost', onclick: reset }, 'Reset'), stats),  // top row: the sample button, a Reset button and the counters
              h('div', { class: 'row', style: { gap: '6px' } }, h('span', { class: 'small b' }, 'Ask for'), ...reqs),  // second row: the "Ask for" label and the request buttons
              h('div', { class: 'card white', style: { padding: '6px 8px', flex: 'none' } }, svg),  // a white card holding the frame strip; it keeps its natural height
              h('div', { class: 'xs muted', html: 'Only orders 0–4 here. Green = free · teal = in use · amber = given out, unused. Click a used block to free it.' }),  // small grey key: only orders 0-4 here, what the three fill colours mean, and that a used block can be clicked
              h('div', { style: { display: 'grid', gridTemplateColumns: slim ? 'minmax(0,1fr)' : 'minmax(0,1.15fr) minmax(0,1fr)', gap: '10px', flex: '1', minHeight: slim ? '150px' : '0' } },  // below: a grid with the free-list table and the log side by side (stacked on small screens, where the log keeps at least 150 pixels)
                h('div', { class: 'stack', style: { gap: '8px' } }, lists,  // the left cell: the free-list table first
                  h('div', { class: 'callout why m0 small', 'data-label': 'In a real kernel', html: 'Linux keeps one set of these lists for each memory zone. Single pages usually come from small per-CPU caches first, so most one-page requests never touch the lists at all.' })),  // then a note: the real kernel keeps these lists per memory zone, with per-CPU caches serving most single pages
                log))));  // the right cell is the log; closes the layout
          draw();  // draws the lab now that the buttons exist, so the request buttons get their correct enabled state
        },  // ends render for step 4
      },  // ends step 4
      /* ---------------- 5. Compare: page aging (8-bit age) against a single use bit ---------------- */
      {  // opens step 5, which compares page aging with a single use bit
        title: 'Then: page aging, a use bit grown into an 8-bit age',  // step 5 title
        kind: 'compare',  // kind compare: a slide that sets two ideas side by side
        render(el, ctx) {  // render(el, ctx): draws the page-aging comparison when the slide opens
          const { h } = ctx;  // takes the HTML builder h out of the toolbox (this step draws no SVG)
          const SCRIPT = [  // SCRIPT: the sample run; each entry is an action, its details and the log text the sample button shows
            ['use', 'A', 5, 'A is in a busy loop: used 5 times.'], ['use', 'B', 2, 'B is used twice.'], ['use', 'C', 2, 'C is used twice.'],  // sample steps 1-3: A is used 5 times, B and C twice each
            ['sweep', 1, 'The background sweep passes.'], ['use', 'E', 1, 'E is used once.'], ['need', 'A new page is needed.'],  // sample steps 4-6: one sweep, E is used once, then a page must be replaced
            ['sweep', 2, 'Two more sweeps pass; nothing is used.'], ['need', 'Another new page is needed.'], ['need', 'And another.'],  // sample steps 7-9: two quiet sweeps, then two more replacements
          ];  // closes the SCRIPT list
          let frames, hand, pc, nextId, lastPick;  // frames: the six frames and their pages; hand: the sweep hand's position; pc: the next sample step; nextId: the next new page's letter; lastPick: the latest eviction
          const slim = ctx.narrow;  // slim is true on phone-width screens, where the table drops its age-bar column
          const tbl = h('div'), cmp = h('div', { class: 'grid-2', style: { gap: '8px' } });  // tbl: the frame table; cmp: two cards comparing what one bit and the age would choose
          const log = h('div', { class: 'log', style: { flex: '1', minHeight: '64px', fontFamily: 'var(--font)', fontSize: '13.5px' } });  // log: the message box, newest first; it takes the remaining height, at least 64 pixels
          const useRow = h('div', { class: 'row', style: { gap: '5px' } });  // useRow: the row of Use buttons, one per page
          const bSample = h('button', { class: 'btn sm primary', onclick: () => sampleStep() });  // bSample: the button that runs the next sample step; draw() writes its label
          const say = (html) => log.prepend(h('div', { html }));  // say(html): adds one message to the top of the log
          function reset() {  // reset(): puts the comparison back to its starting state
            frames = ['A', 'B', 'C', 'D', 'E', 'F'].map((id) => ({ id, age: 1, bit: 1 }));  // six pages A to F, each at age 1 with its use bit set
            hand = 0; pc = 0; nextId = 6; lastPick = null;  // the hand starts at frame 0, the sample at its first step, new pages at the letter G, and nothing has been evicted yet
            log.replaceChildren(h('div', { html: 'Six pages were just loaded: each starts at age 1 with its use bit set.' }));  // the log's starting message
            draw();  // redraws everything
          }  // ends reset
          function use(id, times) {  // use(id, times): records that page id was used, as many times as the times argument says
            const p = frames.find((f) => f.id === id);  // p: the page being used
            p.age = Math.min(255, p.age + times); p.bit = 1; lastPick = null;  // raises its age by one per use (never above 255, the most 8 bits can hold), sets its use bit, and clears the last eviction's display
          }  // ends use
          function sweep(n) {  // sweep(n): runs the background sweep n times
            for (let i = 0; i < n; i++) frames.forEach((f) => { f.age = Math.max(0, f.age - 1); f.bit = 0; });  // each sweep lowers every age by 1 (never below 0) and clears every use bit
            lastPick = null;  // clears the last eviction's display
          }  // ends sweep
          // Victim: the lowest age; ties go to the first one found from the sweep hand onward.
          function need() {  // need(): replaces one page to make room for a new one, and reports what happened
            const min = Math.min(...frames.map((f) => f.age));  // min: the lowest age among the six pages
            let k = hand;  // k starts at the sweep hand
            while (frames[k].age !== min) k = (k + 1) % frames.length;  // moves forward (wrapping round) until it finds a page with the lowest age
            const old = frames[k], zeroBit = frames.filter((f) => !f.bit).map((f) => f.id);  // old: the page to evict; zeroBit: the pages whose use bit is 0, which a single bit could not tell apart
            const id = String.fromCharCode(65 + nextId++ % 26);  // id: the new page's letter, G, H, I and so on, wrapping round after Z
            lastPick = { victim: old.id, age: old.age, zeroBit, frame: k };  // records the eviction so draw() can highlight the frame and fill the comparison cards
            frames[k] = { id, age: 1, bit: 1 };  // the new page takes the frame at age 1 with its use bit set
            hand = (k + 1) % frames.length;  // the hand moves to the frame after the one just filled
            return { old, id, k, zeroBit };  // hands back the details for the log message
          }  // ends need
          const bits8 = (v) => v.toString(2).padStart(8, '0');  // bits8(v): writes an age as exactly 8 binary digits
          function draw() {  // draw(): redraws the table, the comparison cards, the Use buttons and the sample button
            const maxA = Math.max(8, ...frames.map((f) => f.age));  // maxA: the largest age shown (at least 8), used to scale the age bars
            tbl.innerHTML = '<table class="tbl compact"><tr><th>Frame</th><th>Page</th><th>Age (8 bits)</th>' + (slim ? '' : '<th style="width:30%">Age</th>') + '<th>Use bit</th></tr>' + frames.map((f, k) =>  // the table's heading row (with an age-bar column on wider screens), followed by one row per frame
              `<tr class="${lastPick && lastPick.frame === k ? 'on' : ''}"><td class="num">${k === hand ? '<b class="c-acc">▶</b> ' : '<span style="visibility:hidden">▶</span> '}${k}</td><td class="b">${f.id}</td><td class="mono">${bits8(f.age)} <span class="muted">= ${f.age}</span></td>` +  // a row, highlighted if this frame was just refilled: frame number with the hand marker (or an invisible one to keep alignment), page letter, age in binary and decimal
              (slim ? '' : `<td><div class="meter" style="height:9px"><i style="width:${(100 * f.age) / maxA}%;background:${f.age ? 'var(--chc)' : 'var(--bad)'}"></i></div></td>`) + `<td class="mono b ${f.bit ? 'c-ok' : 'c-bad'}">${f.bit}</td></tr>`).join('') + '</table>';  // the age bar (wider screens only), red when the age is 0, then the use bit in green for 1 or red for 0
            if (lastPick) {  // after an eviction, the cards compare the two schemes' views of that choice
              cmp.innerHTML = `<div class="card tight small"><div class="b c-bad">One use bit sees</div>${lastPick.zeroBit.length ? `${lastPick.zeroBit.length} page${lastPick.zeroBit.length > 1 ? 's' : ''} with bit 0: <b>${lastPick.zeroBit.join(', ')}</b>, all equally “unused”.` : 'every bit set to 1: it would have to clear them all and go round again.'}</div>` +  // card 1: the pages a single use bit would have seen as equally unused (or that every bit was set)
                `<div class="card tight small"><div class="b c-ok">The 8-bit age sees</div>the lowest age, <b>${lastPick.age}</b>, so it evicted <b>${lastPick.victim}</b> from frame ${lastPick.frame}.</div>`;  // card 2: the lowest age and the page it evicted
            } else {  // before any eviction, the cards preview what each scheme would choose now
              const z = frames.filter((f) => !f.bit).map((f) => f.id), min = Math.min(...frames.map((f) => f.age)), lows = frames.filter((f) => f.age === min).map((f) => f.id);  // z: pages with use bit 0; min: the lowest age; lows: the pages with that age
              cmp.innerHTML = `<div class="card tight small"><div class="b">If a frame were needed now, one bit would offer</div>${z.length ? z.join(', ') : 'no one yet: every bit is 1, so a clock would clear them all and go round again'}</div><div class="card tight small"><div class="b">The age would offer</div>${lows.join(', ')} (age ${min})</div>`;  // the preview cards: one bit would offer z, the age would offer lows
            }  // ends the choice of card contents
            useRow.replaceChildren(h('span', { class: 'small b' }, 'Use'), ...frames.map((f) => h('button', { class: 'btn sm', onclick: () => { use(f.id, 1); say(`<b>${f.id}</b> is used: age ${f.age} (bit set to 1).`); draw(); } }, f.id)));  // rebuilds the Use buttons; each uses its page once, logs the new age and redraws
            const op = SCRIPT[pc];  // op: the next sample step, if any
            bSample.textContent = op ? 'Sample: ' + op[op.length - 1] : 'Sample finished';  // the sample button shows the next step's description, or that the sample is finished
            bSample.disabled = !op;  // it is greyed out when the sample is finished
          }  // ends draw
          function doNeed(label) {  // doNeed(label): runs a replacement and logs it, starting with label
            const r = need();  // r: what need() did
            say(`${label} Lowest age is ${r.old.age}: <b>${r.old.id}</b> (frame ${r.k}) is evicted and <b>${r.id}</b> is loaded at age 1. ${r.zeroBit.length > 1 ? `With one bit, ${r.zeroBit.join(', ')} would all have looked alike.` : ''}`);  // log message: the evicted page and its age, the new page, and the pages one bit would have confused
          }  // ends doNeed
          function sampleStep() {  // sampleStep(): runs the next step of the sample script
            const op = SCRIPT[pc++];  // reads the step and moves pc past it
            if (!op) return;  // does nothing once the script is finished
            if (op[0] === 'use') { use(op[1], op[2]); say(`${op[3]} Age of ${op[1]}: ${frames.find((f) => f.id === op[1]).age}.`); }  // a use step: uses the page and logs its new age
            else if (op[0] === 'sweep') { sweep(op[1]); say(`${op[2]} Every age drops by ${op[1]} (not below 0) and every use bit is cleared.`); }  // a sweep step: sweeps and logs that ages dropped and bits cleared
            else doNeed(op[1]);  // otherwise a need step: replaces a page
            draw();  // redraws after the step
          }  // ends sampleStep
          reset();  // sets up the starting state before the layout is built
          el.append(h('div', { class: 'split l fill' },  // builds the slide: explanation on the left, the comparison on the right
            h('div', { class: 'stack', style: { gap: '9px' } },  // left column: the explanation
              h('p', { class: 'lead m0', html: 'Older Linux kernels, the last being 2.4.0 to 2.4.9 (2001), used <span class="t">page aging</span>: a clock-like sweep in which each page’s single use bit grew into an 8-bit <b>age</b>.' }),  // opening paragraph: older kernels used page aging, a sweep with an 8-bit age per page
              h('ul', { class: 'm0 small', html: '<li>Each use <b>raises</b> the age; a background sweep over all pages <b>lowers</b> it (here both by 1, capped at 255 to fit 8 bits; real kernels used other step sizes and caps).</li><li>When a frame is needed, the page with the lowest age (ideally 0) is the victim; ties go to the first one at or after the sweep hand ▶.</li><li>One bit can only say “used since the last sweep, or not”. The age is a running score: uses minus sweeps.</li>' }),  // bullet list: uses raise the age, sweeps lower it, the lowest age is the victim, and an age is a running score
              h('div', { class: 'callout why m0 small', 'data-label': 'A least-frequently-used flavour', html: 'The score counts uses, so a page that was busy a while ago outranks one used once just now: a form of <span class="t">least frequently used (LFU)</span>. Popular pages are protected, but a page whose busy phase has ended lingers until sweeps wear its age down.' }),  // why box: counting uses makes this a least-frequently-used scheme, which protects busy pages but lets stale ones linger
              h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'Reading the age as the time since the last use. It is a score: a page used 50 times and then left alone stays high for many sweeps, while a page used once is back to 0 after one sweep.' })),  // common-mistake box: the age is a score, not the time since the last use
            h('div', { class: 'stack', style: { gap: '8px' } },  // right column: the interactive table
              h('div', { class: 'row', style: { gap: '6px' } }, bSample, h('button', { class: 'btn sm', onclick: () => { sweep(1); say('Sweep: every age drops by 1 (not below 0) and every use bit is cleared.'); draw(); } }, 'Sweep'),  // control row: the sample button, then a Sweep button that sweeps once and logs it
                h('button', { class: 'btn sm', onclick: () => { doNeed('A new page is needed.'); draw(); } }, 'New page needed'), h('button', { class: 'btn sm ghost', onclick: reset }, 'Reset')),  // a "New page needed" button that runs a replacement, and a Reset button
              useRow, tbl, cmp, log)));  // then the Use buttons, the frame table, the comparison cards and the log; closes the layout
        },  // ends render for step 5
      },  // ends step 5
      /* ---------------- 6. Lab: the split LRU (active and inactive lists) ---------------- */
      {  // opens step 6, the lab with the active and inactive lists
        title: 'Now: an active list and an inactive list',  // step 6 title
        kind: 'lab',  // kind lab: the student uses pages and watches them move between lists
        core: true,  // core: true puts this step on the shorter core path
        render(el, ctx) {  // render(el, ctx): draws the split LRU lab when the slide opens
          const { h, s } = ctx;  // takes the HTML builder h and the SVG builder s out of the toolbox
          const CAP = 8;  // CAP: memory has room for 8 pages in this lab
          let act, ina, onDisk, stream, hits, faults, evicts, hotId;  // act, ina: the two lists, head first; onDisk: pages not in memory; stream: count of streamed pages; hits, faults, evicts: counters; hotId: the page just used
          const log = h('div', { class: 'log', style: { flex: '1', minHeight: '80px', fontFamily: 'var(--font)', fontSize: '13.5px' } });  // log: the message box, newest first; it takes the remaining height, at least 80 pixels
          const actEl = h('div', { class: 'lru' }), inaEl = h('div', { class: 'lru' }), stats = h('div', { class: 'row', style: { gap: '5px' } });  // actEl, inaEl: the rows showing the active and inactive lists as page chips; stats: the counters
          const pageRow = h('div', { class: 'row', style: { gap: '5px' } });  // pageRow: the row of "Use page" buttons
          const say = (html) => log.prepend(h('div', { html }));  // say(html): adds one message to the top of the log
          const where = (id) => (act.some((p) => p.id === id) ? 'act' : ina.some((p) => p.id === id) ? 'ina' : null);  // where(id): which list page id is on, 'act' or 'ina', or null if it is not in memory
          function reset() {  // reset(): puts the lab back to its starting state
            act = [{ id: 'A', ref: 1 }, { id: 'B', ref: 1 }, { id: 'C', ref: 0 }];  // the starting active list: A and B with PG_referenced set, C without it
            ina = [{ id: 'D', ref: 1 }, { id: 'E', ref: 0 }, { id: 'F', ref: 0 }];  // the starting inactive list: D used once (flag set), E and F not used
            onDisk = ['G', 'H']; stream = 0; hits = 0; faults = 0; evicts = 0; hotId = null;  // G and H wait on disk; the stream counter, hit, fault and eviction counters start at 0, and nothing is highlighted
            log.replaceChildren(h('div', { html: 'Six file pages are in memory, two frames are free. A and B have proved themselves (active); D was used once on the inactive list.' }));  // the log's starting message: six pages in memory, two frames free, and how they got onto their lists
            draw();  // redraws everything
          }  // ends reset
          // One look at the tail of the active list: a referenced page gets another lap, an unreferenced one is deactivated.
          function ageOne() {  // ageOne(): checks the page at the active list's tail once, and returns the log message describing what happened
            if (!act.length) return 'The active list is empty: nothing to age.';  // an empty active list has nothing to age
            const p = act.pop();  // p: the page taken off the active list's tail
            if (p.ref) { p.ref = 0; act.unshift(p); return `Active tail <b>${p.id}</b> has PG_referenced set: the flag is cleared and ${p.id} goes back to the active head for another lap.`; }  // if its PG_referenced flag is set, the flag is cleared and the page goes back to the active head for another lap
            ina.unshift(p); return `Active tail <b>${p.id}</b> was not used since its last check: <b>deactivated</b> (PG_active cleared), it moves to the inactive head.`;  // otherwise it is deactivated: it moves to the head of the inactive list
          }  // ends ageOne
          // Free one frame: top up the inactive list from the active tail if it has become the shorter list, then evict the inactive tail.
          function reclaim() {  // reclaim(): frees one frame and returns the list of log messages explaining how
            const notes = [];  // notes collects the messages
            while (ina.length < act.length) notes.push(ageOne());  // while the inactive list is shorter than the active one, ages the active tail to top the inactive list up
            if (!ina.length) return notes.concat('Nothing to reclaim.');  // if the inactive list is still empty, there is nothing to evict
            const v = ina.pop(); evicts++;  // v: the page at the inactive tail, which is evicted; the eviction counter goes up
            if (!/^S\d/.test(v.id)) { onDisk.push(v.id); onDisk.sort(); }  // an ordinary page goes back on the on-disk list (kept in order); streamed pages (S1, S2, ...) are simply dropped
            notes.push(`Reclaim takes the inactive tail: <b>${v.id}</b> is evicted${v.ref ? ' (its single recent use was not enough)' : ''}; being a clean file page, its frame is reused at once.`);  // log message: the inactive tail is evicted, even if it was used once, and as a clean file page its frame is reused at once
            return notes;  // hands back the messages
          }  // ends reclaim
          function touch(id) {  // touch(id): the student (or the stream) uses page id; it applies the list rules and logs what happened
            hotId = id;  // marks this page to be ringed in the drawing
            const w = where(id);  // w: which list the page is on now
            if (w === 'ina') {  // case 1: the page is on the inactive list
              const i = ina.findIndex((p) => p.id === id), p = ina[i];  // i: its position in the list; p: the page itself
              hits++;  // it was in memory, so this is a hit
              if (!p.ref) { p.ref = 1; say(`<b>${id}</b> used on the inactive list: PG_referenced is set. One more use will promote it.`); }  // first use there: PG_referenced is set, and the log says one more use will promote it
              else { ina.splice(i, 1); p.ref = 0; act.unshift(p); say(`<b>${id}</b> used again while its flag was set: <b>promoted</b> to the head of the active list (PG_active set, PG_referenced cleared).`); }  // second use while the flag is set: it leaves the inactive list and goes to the active head, with the flag cleared
            } else if (w === 'act') {  // case 2: the page is on the active list
              const p = act.find((x) => x.id === id);  // p: the page itself
              hits++;  // a hit as well
              say(p.ref ? `<b>${id}</b> used again; it is already active and referenced, so nothing changes.` : `<b>${id}</b> used on the active list: PG_referenced is set, which buys it another lap.`);  // log message: nothing changes if the flag was already set, otherwise setting it buys the page another lap
              p.ref = 1;  // sets PG_referenced either way
            } else {  // case 3: the page is not in memory
              faults++;  // a page fault
              const full = act.length + ina.length >= CAP, lines = full ? reclaim() : [];  // full: all 8 frames are in use; if so, reclaim runs first and its messages are kept for the log
              onDisk = onDisk.filter((x) => x !== id);  // removes the page from the on-disk list
              ina.unshift({ id, ref: 1 });  // the page is read in and placed at the inactive head, with PG_referenced set for this first use
              say(`<b>${id}</b> is not in memory: page fault. ` + (full ? 'No frame is free, so the kernel reclaims one first. ' + lines.join(' ') + ' ' : '') + `${id} is read from its file into ${full ? 'that' : 'a free'} frame and starts at the <b>inactive head</b>; the read counts as its first use (PG_referenced set).`);  // log message: the fault, any reclaim that was needed, and where the new page starts
            }  // ends the three cases
          }  // ends touch
          function draw() {  // draw(): redraws both lists, the counters and the Use page buttons
            const pg = (p, cls) => `<span class="pg ${cls}${p.id === hotId ? ' hot' : ''}">${p.id}<span class="rf ${p.ref ? 'on' : ''}" title="PG_referenced">R</span></span>`;  // pg(p, cls): the HTML for one page chip: its letter and an R tag that turns green when PG_referenced is set; the page just used gets a ring
            actEl.innerHTML = '<span class="lru-end">head →</span>' + (act.length ? act.map((p) => pg(p, 'act')).join('') : '<span class="muted small">empty</span>') + '<span class="lru-end">→ tail: deactivate</span>';  // the active list row: "head", its chips in order (or "empty"), then "tail: deactivate"
            inaEl.innerHTML = '<span class="lru-end">head →</span>' + (ina.length ? ina.map((p) => pg(p, 'ina')).join('') : '<span class="muted small">empty</span>') + '<span class="lru-end">→ tail: evict</span>';  // the inactive list row: "head", its chips (or "empty"), then "tail: evict"
            const free = CAP - act.length - ina.length;  // free: how many of the 8 frames are unused
            stats.innerHTML = `<span class="chip ok">${act.length} active</span><span class="chip warn">${ina.length} inactive</span><span class="chip mem">${free} free frame${free === 1 ? '' : 's'}</span><span class="chip">${hits} hits · ${faults} faults · ${evicts} evicted</span>`;  // the counters: active and inactive list lengths, free frames, then hits, faults and evictions
            const ids = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];  // ids: the eight pages that have buttons
            pageRow.replaceChildren(h('span', { class: 'small b' }, 'Use page'), ...ids.map((id) => h('button', { class: 'btn sm', style: where(id) ? null : { borderStyle: 'dashed', color: 'var(--muted)' }, title: where(id) ? 'In memory' : 'On disk', onclick: () => { touch(id); draw(); } }, where(id) ? id : id + ' (disk)')));  // one Use page button per page; a page on disk gets a dashed grey button labelled "(disk)"; a click uses the page and redraws
          }  // ends draw
          function doStream() {  // doStream(): simulates reading a big file once from start to end
            say('<b>A big file is read once from start to end</b> (4 new pages, each used just once):');  // log message introducing the stream
            for (let i = 0; i < 4; i++) { stream++; touch('S' + stream); }  // uses four brand-new pages (S1, S2, ...) exactly once each
            hotId = null;  // clears the highlight, since no single page is the focus afterwards
          }  // ends doStream
          reset();  // sets up the starting state before the layout is built
          // Rules as a little state diagram.
          const st = s('svg', { viewBox: '0 0 460 192', width: '100%' });  // st: the small state diagram of the list rules, 460 x 192 units, stretched to its card's width
          const box = (x, y, t1, t2, cls) => s('g', {}, s('rect', { x, y, width: 128, height: 46, rx: 9, class: cls, 'stroke-width': 2 }),  // box(x, y, t1, t2, cls): one state box with a bold title and a grey second line
            s('text', { x: x + 64, y: y + 19, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800 }, t1), s('text', { x: x + 64, y: y + 37, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, t2));  // the box's two text lines, centred
          const arr = (d, lab, lx, ly, anchor) => s('g', {}, s('path', { d, class: 's-line', fill: 'none', 'stroke-width': 1.6, 'marker-end': 'url(#arr)' }),  // arr(d, lab, lx, ly, anchor): one arrow along the path d, with an indigo label at (lx, ly)
            s('text', { x: lx, y: ly, 'text-anchor': anchor || 'middle', 'font-size': 13, 'font-weight': 700, class: 'tx-acc' }, lab));  // the arrow's label text
          st.append(s('rect', { x: 2, y: 16, width: 348, height: 58, rx: 11, fill: 'none', class: 's-muted', 'stroke-dasharray': '5 4' }),  // a dashed outline around the two inactive states at the top
            s('rect', { x: 2, y: 112, width: 348, height: 58, rx: 11, fill: 'none', class: 's-muted', 'stroke-dasharray': '5 4' }),  // a dashed outline around the two active states at the bottom
            box(8, 22, 'Inactive', 'R = 0', 's-warn'), box(216, 22, 'Inactive', 'R = 1', 's-warn'), box(8, 118, 'Active', 'R = 0', 's-ok'), box(216, 118, 'Active', 'R = 1', 's-ok'),  // the four states: inactive with R clear or set (amber), active with R clear or set (green)
            s('rect', { x: 392, y: 22, width: 64, height: 46, rx: 9, class: 's-bad', 'stroke-width': 2 }), s('text', { x: 424, y: 50, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800 }, 'evicted'),  // a red "evicted" box at the right
            arr('M 138 38 L 214 38', 'use', 176, 32), arr('M 226 70 L 126 116', 'use: promote', 200, 100, 'start'),  // arrows: a use sets R on an inactive page, and a second use promotes it to the active list
            arr('M 138 134 L 214 134', 'use', 176, 128), arr('M 214 156 L 138 156', 'aging clears R', 176, 186),  // arrows: a use sets R on an active page, and aging clears it again
            arr('M 40 116 L 40 72', 'aging: deactivate', 48, 92, 'start'), arr('M 352 45 L 390 45', 'tail', 371, 38));  // arrows: aging moves an unreferenced active page to the inactive list, and the inactive tail is evicted
          el.append(h('div', { class: 'split l fill' },  // builds the slide: explanation and diagram on the left, the lab on the right
            h('div', { class: 'stack', style: { gap: '9px' } },  // left column: the explanation
              h('p', { class: 'lead m0', html: 'Since 2.4.10 (2001) Linux has kept an <span class="t">active list</span> of pages that have proved busy and an <span class="t">inactive list</span> of eviction candidates; since 2.6.28 (2008), one pair per page type: the <span class="t">split LRU</span>.' }),  // opening paragraph: Linux has kept an active and an inactive list since 2001, one pair per page type since 2008
              h('div', { class: 'card white', style: { padding: '6px 8px' } }, st),  // a white card holding the state diagram
              h('p', { class: 'm0 small', html: 'Two flags in each page’s descriptor drive it: <span class="t">PG_referenced</span> (R: one recent use) and <span class="t">PG_active</span> (on the active list). A page must be used <b>twice</b> to be promoted, and reclaim always takes the <b>inactive tail</b>.' }),  // paragraph: the two flags behind the lists, why a page must be used twice, and where reclaim takes pages from
              h('div', { class: 'callout why m0 small', 'data-label': 'Why two lists?', html: 'A big file read once fills memory with pages used one time each. They pass through the inactive list and leave, while the active list, the real working set, is untouched. Press <b>Stream a file</b> to see it.' })),  // why box: a file read once passes through the inactive list without disturbing the active list
            h('div', { class: 'stack', style: { gap: '8px' } },  // right column: the lab
              pageRow,  // the Use page buttons
              h('div', { class: 'row', style: { gap: '6px' } },  // a row of action buttons
                h('button', { class: 'btn sm primary', onclick: () => { doStream(); draw(); } }, 'Stream a file (4 pages, used once)'),  // Stream a file: uses four new pages once each, then redraws
                h('button', { class: 'btn sm', onclick: () => { hotId = null; reclaim().forEach((l) => say(l)); draw(); } }, 'Reclaim a page'),  // Reclaim a page: frees one frame, logs each message and redraws
                h('button', { class: 'btn sm', onclick: () => { hotId = null; say(ageOne()); draw(); } }, 'Age the active list'),  // Age the active list: checks the active tail once, logs the result and redraws
                h('button', { class: 'btn sm ghost', onclick: reset }, 'Reset')),  // Reset: back to the starting state
              h('div', { class: 'card tight', style: { borderColor: 'var(--ok)' } }, h('div', { class: 'small b c-ok', style: { marginBottom: '4px' } }, 'Active list (PG_active = 1)'), actEl),  // a green-bordered card titled "Active list (PG_active = 1)" holding the active list row
              h('div', { class: 'card tight', style: { borderColor: 'var(--warn)' } }, h('div', { class: 'small b c-warn', style: { marginBottom: '4px' } }, 'Inactive list (PG_active = 0)'), inaEl),  // an amber-bordered card titled "Inactive list (PG_active = 0)" holding the inactive list row
              stats,  // the counters
              h('div', { class: 'callout tip m0 small', 'data-label': 'In the real kernel', html: 'One pair of lists holds <span class="t">file-backed pages</span>, the other <span class="t">anonymous pages</span>, so the kernel can choose what to reclaim: a clean file page is free to drop, an anonymous page must first go to swap. For pages mapped into a process, the accessed bit in the page-table entry also counts as a use. Since kernel 6.1 (2022), Linux can instead use a multi-generational LRU, which sorts pages into several age groups.' }),  // tip box: the real kernel keeps one pair of lists for file pages and one for anonymous pages, and newer kernels can use a multi-generational LRU
              log)));  // the log; closes the layout
          draw();  // draws the lists and buttons for the first time
        },  // ends render for step 6
      },  // ends step 6
      /* ---------------- 7. Explore: the slab allocator ---------------- */
      {  // opens step 7, the slab allocator
        title: 'Small kernel objects: the slab allocator',  // step 7 title
        kind: 'explore',  // kind explore: a slide with tabs to look around in
        render(el, ctx) {  // render(el, ctx): draws the slab allocator slide when it opens
          const { h } = ctx;  // takes the HTML builder h out of the toolbox
          const PER = 8, MAXS = 4, slim = ctx.narrow;  // PER: slots per slab; MAXS: the most slabs this demo allows; slim: true on phone-width screens
          // Tab 1: one cache of 512-byte objects, 8 slots per 4 KB slab.
          function cacheTab(panel) {  // cacheTab(panel): builds the first tab, a single cache the student can fill and empty, inside panel
            let slabs, nextObj, fresh, fifo, told;  // slabs: the cache's slabs; nextObj: the next object number; fresh: the object just placed; fifo: objects oldest first; told: whether the partial-first hint was shown
            const rows = h('div', { class: 'stack', style: { gap: '6px' } }), stats = h('div', { class: 'row', style: { gap: '5px' } });  // rows: the slab rows stacked; stats: the counters
            const log = h('div', { class: 'log', style: { height: '84px', fontFamily: 'var(--font)', fontSize: '13.5px' } });  // log: a message box 84 pixels tall, newest message on top
            const say = (html) => log.prepend(h('div', { html }));  // say(html): adds one message to the top of the log
            function reset() {  // reset(): puts the cache back to its starting state
              slabs = [{ n: 1, slots: [1, 2, 3, 4, 5, 6, 7, 8] }, { n: 2, slots: [9, 10, 11, null, null, null, null, null] }];  // two slabs: slab 1 holds objects 1-8 (full), slab 2 holds 9-11 and has five free slots (null)
              nextObj = 12; fresh = null; told = false; fifo = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];  // the next object is #12; nothing is ringed; the hint has not been shown; objects 1 to 11 are listed oldest first
              log.replaceChildren(h('div', { html: 'The cache holds two slabs: slab 1 is full, slab 2 is partial.' }));  // the log's starting message
              draw();  // redraws the tab
            }  // ends reset
            const state = (sl) => { const u = sl.slots.filter((x) => x !== null).length; return u === PER ? 'full' : u ? 'partial' : 'empty'; };  // state(sl): counts a slab's used slots and calls it full, partial or empty
            function alloc() {  // alloc(): places one new object in the cache and logs where it went
              let sl = slabs.find((x) => state(x) === 'partial'), how = 'from a partial slab';  // first choice: a partial slab
              if (!sl) { sl = slabs.find((x) => state(x) === 'empty'); how = 'from an empty slab the cache kept'; }  // second choice: an empty slab the cache has kept
              if (!sl) {  // if neither exists, a new slab is needed
                if (slabs.length >= MAXS) { say('Every slab is full and this demo stops at 4 slabs; a real cache would ask the buddy allocator for another page.'); return; }  // this demo stops at 4 slabs and says so in the log; a real cache would get another page
                const n = Math.max(0, ...slabs.map((x) => x.n)) + 1;  // n: the new slab's number, one more than the highest so far
                sl = { n, slots: Array(PER).fill(null) }; slabs.push(sl); how = 'from a <b>new slab</b>: one fresh page from the buddy allocator, cut into 8 slots';  // adds a new, all-free slab and notes that it is a fresh page from the buddy allocator
              }  // ends the new-slab case
              const i = sl.slots.indexOf(null), id = nextObj++;  // i: the first free slot in the chosen slab; id: the new object's number
              sl.slots[i] = id; fresh = id; fifo.push(id);  // puts the object in that slot, rings it, and adds it to the end of the oldest-first list
              const why = how === 'from a partial slab' && !told ? ' Partial slabs are used first, so pages fill up instead of spreading thin.' : '';  // why: a one-time hint, shown the first time a partial slab is used, explaining why partial slabs come first
              if (why) told = true;  // remembers that the hint has been shown
              say(`Object #${id} gets slot ${i} of slab ${sl.n}, ${how}.${why}`);  // log message: which slot of which slab the object got, and why that slab was chosen
            }  // ends alloc
            function free(id) {  // free(id): removes object id from its slab and logs the result
              const sl = slabs.find((x) => x.slots.includes(id));  // sl: the slab holding the object
              if (!sl) return;  // stops if no slab holds it
              const before = state(sl);  // before: the slab's state before the free
              sl.slots[sl.slots.indexOf(id)] = null; fifo = fifo.filter((x) => x !== id); fresh = null;  // empties the slot, removes the object from the oldest-first list and clears the ring
              const after = state(sl);  // after: the slab's state after the free
              say(`Object #${id} is freed: its slot in slab ${sl.n} is free for the next object of this size.` + (before !== after ? ` Slab ${sl.n} goes from <b>${before}</b> to <b>${after}</b>.` : '') + (after === 'empty' ? ' The cache keeps it for now, in case more objects are needed soon.' : ''));  // log message: the slot is free again, whether the slab changed state, and that an empty slab is kept for now
            }  // ends free
            function shrink() {  // shrink(): what the kernel does when memory is tight: gives every empty slab back to the buddy allocator
              const empty = slabs.filter((x) => state(x) === 'empty');  // empty: the slabs with no objects
              slabs = slabs.filter((x) => state(x) !== 'empty'); fresh = null;  // keeps only the slabs that still hold objects, and clears the ring
              say(empty.length ? `Memory is tight: ${empty.length} empty slab${empty.length > 1 ? 's go' : ' goes'} back to the buddy allocator (${empty.length * 4} KB freed).` : 'No empty slab to give back: every slab still holds at least one object.');  // log message: how many slabs went back and how many KB that freed, or that no slab was empty
            }  // ends shrink
            function draw() {  // draw(): redraws the slab rows and the counters
              rows.replaceChildren(...(slabs.length ? slabs : []).map((sl) => {  // builds one row per slab
                const st = state(sl);  // st: the slab's state
                const chip = h('span', { class: 'chip ' + (st === 'full' ? 'os' : st === 'partial' ? 'accent' : 'mem') }, st);  // chip: a tag naming the state, purple for full, indigo for partial, green for empty
                const cells = sl.slots.map((x) => (x === null ? h('div', { class: 'slot' }, slim ? '·' : 'free') : h('button', { class: 'slot' + (x === fresh ? ' new' : ''), title: 'Free object #' + x, onclick: () => { free(x); draw(); } }, slim ? String(x) : '#' + x)));  // one cell per slot: a dashed "free" box (a dot on small screens), or a button showing the object that frees it when clicked
                if (slim) return h('div', { class: 'stack', style: { gap: '3px' } }, h('div', { class: 'small b' }, 'Slab ' + sl.n + ' ', chip), h('div', { class: 'slab slim' }, ...cells));  // on small screens: the slab's name and state tag on one line, then its 8 slots underneath
                return h('div', { class: 'slab' }, h('div', { class: 'small b' }, 'Slab ' + sl.n), ...cells, chip);  // on wider screens: name, 8 slots and state tag all in one grid row
              }));  // ends the slab rows
              if (!slabs.length) rows.append(h('div', { class: 'muted small' }, 'No slabs: the cache holds no pages at all.'));  // if the cache has no slabs left, says so instead
              const used = slabs.reduce((t, sl) => t + sl.slots.filter((x) => x !== null).length, 0);  // used: how many objects the cache holds
              stats.innerHTML = `<span class="chip os">${used} object${used === 1 ? '' : 's'} × 512 B = ${used * 512} B</span><span class="chip mem">${slabs.length} page${slabs.length === 1 ? '' : 's'} = ${slabs.length * 4096} B held</span><span class="chip warn">a page per object would need ${used * 4} KB</span>`;  // the counters: bytes the objects need, bytes the cache's pages hold, and what one page per object would cost instead
            }  // ends draw
            reset();  // sets up the starting state before the tab's layout is built
            panel.append(h('div', { class: 'stack', style: { gap: '8px' } },  // builds the tab: one column
              h('p', { class: 'small m0', html: 'A cache of <b>512-byte</b> objects: each slab is one 4 KB page cut into 8 slots. Click an object to free it.' }),  // a sentence describing the cache: 512-byte objects, 8 slots per 4 KB slab, and that objects can be clicked
              h('div', { class: 'row', style: { gap: '6px' } },  // a row of buttons
                h('button', { class: 'btn sm primary', onclick: () => { alloc(); draw(); } }, 'Allocate an object'),  // Allocate an object: places one object and redraws
                h('button', { class: 'btn sm', onclick: () => { for (let k = 0; k < 4; k++) alloc(); draw(); } }, 'Allocate 4'),  // Allocate 4: places four objects in a row, then redraws
                h('button', { class: 'btn sm', onclick: () => { if (fifo.length) free(fifo[0]); else say('The cache holds no objects.'); draw(); } }, 'Free the oldest'),  // Free the oldest: frees the object allocated longest ago (or says the cache is empty), then redraws
                h('button', { class: 'btn sm', onclick: () => { shrink(); draw(); } }, 'Memory is tight: shrink'),  // Memory is tight: gives empty slabs back, then redraws
                h('button', { class: 'btn sm ghost', onclick: reset }, 'Reset')),  // Reset: back to the starting cache
              rows, stats, log,  // then the slab rows, the counters and the log
              h('div', { class: 'callout analogy m0 small', 'data-label': 'Analogy', html: 'An egg carton: every cup is egg-sized, so nobody hunts for a gap that fits, and each carton is full, partly full or empty.' })));  // analogy box: an egg carton, where every cup fits one egg and each carton is full, partly full or empty
          }  // ends cacheTab
          // Tab 2: which kmalloc cache serves a request of a given size.
          function sizeTab(panel) {  // sizeTab(panel): builds the second tab, which shows the kmalloc size class a request lands in
            const CL = [8, 16, 32, 64, 96, 128, 192, 256, 512, 1024, 2048, 4096, 8192];  // CL: the general cache sizes in bytes, from 8 up to 8,192
            const nm = (z) => 'kmalloc-' + (z >= 1024 ? z / 1024 + 'k' : z);  // nm(z): the cache's name for size z, such as kmalloc-512 or kmalloc-2k
            const out = h('div', { class: 'stack', style: { gap: '8px' } }), chips = h('div', { class: 'row', style: { gap: '4px' } });  // out: the box with the result; chips: the row of size-class tags
            const toBytes = (v) => Math.max(1, Math.round(2 ** (v / 10)));  // toBytes(v): turns the slider position into bytes; every 10 steps doubles the size, so small and large requests both fit on one slider
            function calc(v) {  // calc(v): works out and shows where a request of slider position v goes; runs whenever the slider moves
              const n = toBytes(v), z = CL.find((c) => c >= n);  // n: the request in bytes; z: the smallest size class that fits it (none if it is over 8 KB)
              chips.innerHTML = CL.map((c) => `<span class="chip ${c === z ? 'os' : ''}">${nm(c)}</span>`).join('');  // one tag per size class, the chosen one in purple
              if (!z) {  // a request too big for any cache
                const pages = Math.ceil(n / 4096), k = orderFor(pages);  // pages: how many 4 KB pages it needs; k: the buddy order that covers them
                out.innerHTML = `<div class="big c-mem">buddy allocator</div><div class="small">${n.toLocaleString('en-US')} bytes is more than the largest cache (8 KB), so <code>kmalloc</code> passes the request straight to the buddy allocator: ${pages} pages round up to an order-${k} block of ${2 ** k} pages (${(2 ** k * 4).toLocaleString('en-US')} KB), and ${(2 ** k * 4096 - n).toLocaleString('en-US')} bytes of it go unused.</div>`;  // result: the request goes straight to the buddy allocator, with the block it gets and how many bytes go unused
                return;  // stops here, since no cache is involved
              }  // ends the too-big case
              const waste = z - n, per = z <= 4096 ? Math.floor(4096 / z) : 0;  // waste: unused bytes in the slot; per: how many such objects fit in one 4 KB page (0 for the 8 KB class)
              out.innerHTML = `<div class="big c-os">${nm(z)}</div>` +  // result heading: the chosen cache's name in large purple text
                `<div class="small"><code>kmalloc(${n})</code> ${n === z ? 'goes to' : 'rounds up to'} the ${z.toLocaleString('en-US')}-byte cache: ${waste ? `${waste.toLocaleString('en-US')} bytes of the slot (${Math.round((100 * waste) / z)}%) go unused.` : 'a perfect fit.'} ` +  // explanation: kmalloc(n) goes to (or rounds up to) this size class, and how many bytes and what share of the slot go unused
                (per ? `A 4 KB page holds <b>${per}</b> such objects${4096 - per * z ? `, with ${4096 - per * z} bytes left at the end of the page` : ''}.` : 'Each object fills two whole pages, so this cache’s slabs are runs of several pages.') + '</div>' +  // then how many objects share one page and what is left over, or that 8 KB objects need slabs of several pages
                `<div class="row nw small" style="gap:8px"><span style="width:150px">slot from ${nm(z)}</span><div class="meter grow" style="height:12px"><i style="width:${(100 * n) / z}%;background:var(--os)"></i></div><b style="width:96px;text-align:right">${Math.round((100 * n) / z)}% used</b></div>` +  // a bar showing how much of the slot the request really uses
                (n <= 4096 ? `<div class="row nw small" style="gap:8px"><span style="width:150px">a whole page</span><div class="meter grow" style="height:12px"><i style="width:${Math.max(0.6, (100 * n) / 4096)}%;background:var(--bad)"></i></div><b style="width:96px;text-align:right">${((100 * n) / 4096).toFixed(n < 41 ? 1 : 0)}% used</b></div>` : '');  // for requests up to 4 KB, a red bar showing how little of a whole page the request would use without slabs
            }  // ends calc
            const sl = ctx.ui.slider({ label: 'Request', min: 0, max: 135, value: 82, format: (v) => toBytes(v).toLocaleString('en-US') + ' B', onInput: calc });  // the Request slider: positions 0 to 135, starting at 82 (about 294 bytes); the readout shows bytes and every move runs calc
            calc(82);  // shows the result for the starting position before the student touches the slider
            panel.append(h('div', { class: 'stack', style: { gap: '10px' } },  // builds the tab: one column
              h('p', { class: 'small m0', html: 'Kernel code that just needs “n bytes” calls <code>kmalloc(n)</code>. Behind it sits a family of general caches, one per size class; the request goes to the smallest class that fits.' }),  // intro sentence: kernel code calls kmalloc(n), and the request goes to the smallest size class that fits
              sl, chips, out,  // then the slider, the size-class tags and the result box
              h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'Expecting <code>kmalloc(n)</code> to use exactly n bytes. It takes a whole slot of the next size class: <code>kmalloc(129)</code> occupies a 192-byte slot.' })));  // common-mistake box: kmalloc(n) takes a whole slot of the next size class, not exactly n bytes
          }  // ends sizeTab
          const histTab = `<table class="tbl compact"><tr><th></th><th>SLAB</th><th>SLOB</th><th>SLUB</th></tr>${/* histTab: the fixed HTML of the third tab, a table comparing the three slab implementations */''}
            <tr><td class="b">Idea</td><td>The original Linux slab allocator (1990s), modelled on the Solaris design: queues of free objects for each CPU and each memory node.</td><td>“Simple list of blocks”: a tiny allocator for machines with very little memory.</td><td>The “unqueued” allocator: simpler, less bookkeeping, scales to many CPUs.</td></tr>${/* table row "Idea": what SLAB, SLOB and SLUB were each designed for */''}
            <tr><td class="b">Status</td><td>Removed in kernel 6.8 (2024).</td><td>Removed in kernel 6.4 (2023).</td><td class="b">Default since 2.6.23 (2007); the only one since 6.8.</td></tr></table>${/* table row "Status": when SLAB and SLOB were removed and since when SLUB has been the default */''}
            <p class="small mt">All three offer the same interface: <code>kmem_cache_create</code> makes a cache, <code>kmem_cache_alloc</code> and <code>kmem_cache_free</code> take and return objects, and <code>kmalloc</code>/<code>kfree</code> use the size-class caches. So the rest of the kernel never noticed when one replaced another.</p>${/* paragraph under the table: all three share the same functions, so the rest of the kernel never noticed a switch */''}
            <p class="small m0">On a running Linux system, <code>/proc/slabinfo</code> (or the <code>slabtop</code> tool) lists every cache with its object size and how many objects and slabs it holds.</p>`;  // last paragraph: how to list a running system's caches and their sizes; ends the tab's HTML
          el.append(h('div', { class: 'split l fill' },  // builds the slide: explanation on the left, tabs on the right
            h('div', { class: 'stack', style: { gap: '8px' } },  // left column: the explanation
              h('p', { class: 'lead m0', html: 'The kernel constantly makes and destroys small objects: records for processes, open files, directory entries and network packets, a few bytes to a few KB each.' }),  // opening paragraph: the kernel constantly makes and destroys small objects
              h('p', { class: 'm0 small', html: 'A whole page from the buddy allocator for each one would waste most of every page. So the <span class="t">slab allocator</span> sits on top of it:' }),  // paragraph: a whole page per object would waste memory, so the slab allocator sits on top of the buddy allocator
              h('ol', { class: 'm0 small', html: '<li>It keeps a <b>cache</b> for each object type (process records, inode records, …) and for each <code>kmalloc</code> size (8, 16, 32, … 8,192 bytes).</li><li>A cache takes pages from the buddy allocator and cuts each one into equal slots. Such a page is a <span class="t">slab</span>.</li><li>An allocation takes a free slot, from a <b>partial</b> slab first; a free returns the slot. Slabs are <b>full</b>, <b>partial</b> or <b>empty</b>, and empty ones go back to the buddy allocator when memory is tight.</li>' }),  // numbered list: caches per object type and size, slabs cut from pages, and how allocation and freeing work
              h('div', { class: 'callout why m0 small', 'data-label': 'Why it is fast and tight', html: 'No searching, splitting or merging: just take a free slot of the right size. Slots fit their objects, so little space is lost, and a freed slot is reused while it is still in the processor’s cache.' })),  // why box: no searching, splitting or merging, slots fit their objects, and freed slots are reused while still in the processor's cache
            ctx.ui.tabs([{ label: 'Inside a cache', render: (p) => cacheTab(p) }, { label: 'Which cache?', render: (p) => sizeTab(p) }, { label: 'SLAB, SLOB, SLUB', html: histTab }])));  // right column: three tabs built by the guide's tabs widget: the cache demo, the size-class finder and the history table
        },  // ends render for step 7
      },  // ends step 7
      /* ---------------- 8. Recap ---------------- */
      {  // opens step 8, the recap
        title: 'Recap: eight ideas to carry away',  // step 8 title
        kind: 'recap',  // kind recap: a summary slide
        render(el, ctx) {  // render(el, ctx): draws the recap cards when the slide opens
          const { h } = ctx;  // takes the HTML builder h out of the toolbox
          const flipAll = (on) => ctx.$$('.flip').forEach((c) => c.classList.toggle('on', on));  // flipAll(on): turns every card on this slide face up (true) or face down (false); ctx.$$ finds them all inside this step
          const m4 = WMODES[4], bitsOf = (m) => m.bits.reduce((a, b) => a + b, 12);  // m4: the 4-level processor's description; bitsOf(m): its address width, 12 offset bits plus all index bits, so card 3 uses the same numbers as the lab
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },  // builds the slide as one column that fills the step's height
            h('div', { class: 'row', style: { gap: '8px' } }, h('p', { class: 'm0 muted small grow' }, 'Say each answer out loud before you flip the card. Click a card again to flip it back.'),  // top row: the instruction to answer out loud before flipping, stretched to take the spare width
              h('button', { class: 'btn sm', onclick: () => flipAll(true) }, 'Flip all'), h('button', { class: 'btn sm ghost', onclick: () => flipAll(false) }, 'Hide all')),  // Flip all and Hide all buttons at the end of that row
            ctx.ui.flipcards([  // the flip cards, built by the guide's widget from [front, back] pairs
              ['Linux’s page-table tree', 'Described the same way on every processor. Classic layout: page global directory (one page, resident) → page middle directory → page table → frame.'],  // card 1: Linux's page-table tree and its classic layout
              ['The classic address split', 'Global directory index | middle directory index | page table index | offset. Each index picks one entry at its level; the offset picks the byte.'],  // card 2: the classic address split into three indexes and an offset
              ['Folded levels', `A level the processor lacks gets one entry and 0 bits, so the walk passes through it. 32-bit x86: 2 real levels. x86-64: 4 (${m4.bits.filter(Boolean).join(' + ')} + 12 = ${bitsOf(m4)} bits), or 5 with 57-bit addresses.`],  // card 3: folded levels, with the x86-64 bit sum worked out from the step 3 data
              ['The buddy allocator', `Free lists for orders 0 to 10 (blocks of 2<sup>k</sup> frames). 3 pages → order ${orderFor(3)}. Halve bigger blocks to fit; merge a freed block with its buddy (f XOR 2<sup>k</sup>) when both are free.`],  // card 4: the buddy allocator, with the order for 3 pages worked out by orderFor
              ['Then: page aging', 'Up to 2.4.9 (2001). An 8-bit age per page: raised by each use, lowered by a background sweep. Age 0 = best victim. Counting uses makes it a least-frequently-used flavour.'],  // card 5: page aging, the older scheme
              ['Now: the split LRU', 'Active and inactive lists since 2.4.10; since 2.6.28 one pair each for file-backed and anonymous pages. Used twice on the inactive list → promoted; idle active pages drift down; reclaim takes the inactive tail.'],  // card 6: the split LRU used today
              ['The slab allocator', 'Caches of equal-size slots carved from buddy-allocator pages, one cache per object type or kmalloc size. Slabs are full, partial or empty; allocations fill partial slabs first.'],  // card 7: the slab allocator
              ['SLAB, SLOB, SLUB', 'Three implementations behind one interface. SLUB has been the default since 2.6.23 (2007) and the only one since 6.8 (2024).'],  // card 8: the three slab implementations and which one survives
            ], { cols: 4, height: 214 })));  // four columns of cards, each 214 pixels tall; closes the layout
        },  // ends render for step 8
      },  // ends step 8
      /* ---------------- 9. Quiz ---------------- */
      {  // opens step 9, the quiz
        title: 'Check yourself: Linux memory management',  // step 9 title
        kind: 'check',  // kind check: a quiz slide
        quiz: [  // quiz: the questions, which the guide's quiz engine shows one at a time
          { q: 'In the classic three-level Linux page-table layout, what does each entry of the page middle directory point to?',  // question 1 (multiple choice): what an entry of the page middle directory points to
            choices: ['The page frame that holds the process’s data', 'One page of the page global directory', 'One page of a page table', 'The page table pointer register'],  // choices: the data frame, a page of the global directory, a page of a page table, or the register
            answer: 2,  // answer: the third choice (positions count from 0)
            feedback: ['Pointing at the data frame is the job of a page table entry, one level further down.', 'The global directory sits above the middle directory, and each process has only one, a single page in size.', null, 'The register points to the global directory; table entries never point at registers.'],  // feedback for each wrong choice explaining the mix-up; null marks the right one
            why: 'A global directory entry points to a page of the middle directory, a middle directory entry points to a page of a page table, and a page table entry gives the frame that holds the page.' },  // why: the chain from global entry to middle directory to page table to frame
          { type: 'order', q: 'Put the fields of a virtual address in the classic three-level Linux layout in order, from the leftmost (most significant) bits to the rightmost.',  // question 2 (put in order): the four fields of a classic Linux address, left to right
            items: ['Global directory index', 'Middle directory index', 'Page table index', 'Offset'],  // the fields in the correct order; the quiz shuffles them before showing
            why: 'The walk starts at the top of the tree, so the leftmost bits index the global directory, then the middle directory, then the page table; the rightmost bits are the offset inside the page.' },  // why: the walk starts at the top of the tree, so the leftmost bits come first
          { type: 'tf', q: 'Because 32-bit x86 has only two levels of page tables, Linux needs a separate version of its page-table code for it that skips the middle directory.', answer: false,  // question 3 (true or false): whether two-level hardware needs separate page-table code; the answer is false
            why: 'Linux folds the middle level: it is defined with one entry and zero address bits, so the call that reads it simply hands back the entry it was given. The same generic code runs on two-, three-, four- and five-level hardware.' },  // why: the middle level is folded, so the same code runs everywhere
          { type: 'num', q: 'A 64-bit processor uses 4 KB pages and four levels of page tables. Every table fills exactly one 4 KB page with 8-byte entries. How many bits long are the virtual addresses these tables translate?', answer: 48, tol: 0, unit: 'bits',  // question 4 (calculate): the address width for four levels of one-page tables with 8-byte entries; answer 48 bits, exactly
            why: 'Each table holds 4,096 ÷ 8 = 512 = 2<sup>9</sup> entries, so each level uses 9 bits: 4 × 9 = 36, plus a 12-bit offset for 4 KB pages, gives 48 bits (as on x86-64). A fifth level adds 9 more: 57 bits.' },  // why: 512 entries per table means 9 bits per level, times 4, plus the 12-bit offset
          { type: 'match', q: 'Match each Linux page-table level to its description.',  // question 5 (match the pairs): each of the five Linux levels to its description
            pairs: [['PGD', 'The top table: one per process, kept in memory while it runs'], ['P4D', 'The level added for five-level hardware, folded elsewhere'], ['PUD', 'The level added so four-level 64-bit hardware fits'], ['PMD', 'The middle level of the classic three-level layout'], ['PTE', 'An entry describing one virtual page and its frame']],  // the five pairs; the quiz shuffles the descriptions into the dropdowns
            why: 'The classic tree was PGD → PMD → PTE. The PUD (2005) and P4D (2017) levels were inserted for deeper hardware; on machines without them they are folded.' },  // why: the classic three levels and when the two extra levels were inserted
          { type: 'num', q: 'Linux’s buddy allocator receives a request for 5 contiguous pages. How many page frames does the block it hands out contain?', answer: 8, tol: 0, unit: 'frames',  // question 6 (calculate): how many frames a 5-page request receives; answer 8
            why: 'Blocks come only in powers of two. The smallest order with 2<sup>k</sup> ≥ 5 is k = 3, a block of 8 frames, so 3 of them go unused.' },  // why: blocks come only in powers of two, so 5 rounds up to 8
          { type: 'num', q: 'In a buddy allocator, a free block of order 2 (4 frames) starts at frame 12. At which frame does its buddy start?', answer: 8, tol: 0,  // question 7 (calculate): where the buddy of the order-2 block at frame 12 starts; answer 8
            why: 'The buddy of an order-k block at frame f starts at f XOR 2<sup>k</sup> = 12 XOR 4 = 8. Frames 8–11 and 12–15 are the two halves of the order-3 block 8–15, so if both are free they merge back into it.' },  // why: 12 XOR 4 = 8, and the two halves together make the order-3 block 8-15
          { q: 'Under the page-aging scheme of older Linux kernels, which page is the best candidate for replacement?',  // question 8 (multiple choice): which page page aging evicts first
            choices: ['The page with the highest age', 'A page whose age has fallen to 0', 'The page that was loaded the longest time ago', 'A page whose use bit was set since the last sweep'],  // choices: highest age, age 0, the oldest load, or a page with its use bit set
            answer: 1,  // answer: the second choice, a page whose age has fallen to 0
            feedback: ['A high age means many recent uses: the last page to evict.', null, 'Load order is what FIFO uses; aging ignores it.', 'A set use bit means the page was used recently, which argues for keeping it.'],  // feedback: a high age means busy, load order belongs to FIFO, and a set bit argues for keeping the page
            why: 'Each use raises a page’s age and each background sweep lowers it, so age 0 means its uses have been outweighed by sweeps. Because the age counts uses, a page that was busy a while ago outranks one used once just now: a least-frequently-used flavour.' },  // why: uses raise the age and sweeps lower it, which makes the scheme a least-frequently-used flavour
          { type: 'multi', q: 'Which statements about Linux’s split LRU page replacement (kernel 2.6.28 and later) are true?',  // question 9 (select all that apply): true statements about the split LRU
            choices: ['Pages are reclaimed from the tail of an inactive list.', 'File-backed pages and anonymous pages each have their own active and inactive lists.', 'A page on the inactive list must be used again while its PG_referenced flag is set before it is promoted to the active list.', 'A newly read file page goes straight to the head of the active list.', 'Active pages that stop being used drift to the inactive list.', 'Reading a big file once pushes the whole active list out of memory.'],  // six statements: four true ones and two wrong ones about new pages and big file reads
            answer: [0, 1, 2, 4],  // answer: the first, second, third and fifth statements
            why: 'New file pages start on the inactive list, and only a second use there promotes them. That is why a one-time scan of a big file passes through the inactive list and leaves without disturbing the active pages. Reclaim always works from the inactive tail.' },  // why: new pages need a second use to be promoted, so a one-time scan cannot push out the active pages
          { type: 'order', q: 'A file page is read for the first time and is then used heavily for a while before going idle. Put the stages of its life under the split LRU in order.',  // question 10 (put in order): the life of a file page under the split LRU
            items: ['It is read from its file and joins the inactive list, its first use noted by PG_referenced', 'It is used again while on the inactive list and is promoted to the active list', 'It stops being used and is moved from the active tail back to the inactive list', 'It drifts down to the tail of the inactive list', 'Reclaim evicts it and its frame is reused'],  // the five stages in the correct order, from first read to eviction
            why: 'Pages enter at the inactive head, earn the active list by a second use, are demoted when they go idle, and are only ever reclaimed from the inactive tail.' },  // why: enter inactive, earn active by a second use, drift back when idle, leave from the inactive tail
          { type: 'bucket', q: 'Sort each statement under the allocator it describes.', buckets: ['Buddy allocator', 'Slab allocator'],  // question 11 (sort into groups): statements about the buddy allocator and the slab allocator
            items: [['Hands out runs of 1, 2, 4, 8, … contiguous page frames', 0], ['Halves a larger block when no free block of the right size exists', 0], ['Merges a freed block with its buddy when both are free', 0], ['Keeps a cache of equal-size slots for each object type or size', 1], ['Serves kmalloc(100) from its 128-byte size class', 1], ['Gets the pages it cuts up from the other allocator', 1]],  // the six statements, each with its group (0 = buddy, 1 = slab)
            why: 'The buddy allocator manages whole page frames in power-of-two runs. The slab allocator sits on top of it, cutting pages into equal slots for small kernel objects.' },  // why: the buddy allocator manages whole frames, the slab allocator cuts its pages into slots
          { q: 'Which slab implementation is Linux’s default today, and since kernel 6.8 its only one?',  // question 12 (multiple choice): which slab implementation is the default and the only one left
            choices: ['SLAB', 'SLOB', 'The buddy allocator', 'SLUB'],  // choices: SLAB, SLOB, the buddy allocator, SLUB
            answer: 3,  // answer: the fourth choice, SLUB
            feedback: ['SLAB was the original 1990s design; it was removed in kernel 6.8.', 'SLOB targeted machines with very little memory; it was removed in kernel 6.4.', 'The buddy allocator hands out whole pages; it is what the slab allocators get their pages from.', null],  // feedback: when SLAB and SLOB were removed, and that the buddy allocator is not a slab implementation
            why: 'SLUB, the simpler “unqueued” design, became the default in 2.6.23 (2007). All three implementations offer the same interface, so the rest of the kernel did not change when SLOB and SLAB were removed.' },  // why: SLUB became the default in 2007, and the shared interface meant nothing else had to change
        ],  // closes the quiz list
      },  // ends step 9
    ],  // closes the steps list
    notes: `${/* notes: the text of the section notes panel (HTML), opened with the Notes button */''}
<h3>Two jobs for one memory manager</h3>${/* heading for part 1 of the notes: the memory manager's two jobs */''}
<p>Linux runs on about twenty processor families, so its memory manager is portable. It has two parts: <b>process virtual memory</b> (page tables, finding frames, choosing pages to evict) and <b>kernel memory allocation</b>. Frames are shared by kernel code and static data (never paged out), kernel objects (from the <b>slab allocator</b>), the <b>page cache</b> (copies of file data: <b>file-backed pages</b>, droppable if clean), user process pages (heap and stack are <b>anonymous pages</b>, needing swap to evict), and free frames, kept by the <b>buddy allocator</b> in runs of 1, 2, 4, 8, … frames.</p>${/* notes paragraph: portability, the two parts of the work, and who uses the page frames */''}

<h3>Page tables: one tree, described the same way on every processor</h3>${/* heading for part 2 of the notes: the page-table tree */''}
<p>A flat table per process would be huge, so Linux keeps a tree of small tables, classically in <b>three levels</b>:</p>${/* notes paragraph: why Linux uses a tree of small tables with three classic levels */''}
<ul>${/* starts the list of the three classic levels */''}
<li><b>Page global directory (PGD)</b>: one per process, one page in size, in main memory whenever the process is active (every translation starts there). A register (CR3 on x86) holds its location and is reloaded at each process switch. Each entry points to a page of the middle directory.</li>${/* notes bullet: the page global directory and the register that points to it */''}
<li><b>Page middle directory (PMD)</b>: may span several pages; each entry points to a page of a page table.</li>${/* notes bullet: the page middle directory */''}
<li><b>Page table</b>: may span several pages; each entry refers to one virtual page (frame number plus control bits: present, dirty, accessed, access rights).</li>${/* notes bullet: the page table and what each entry holds */''}
</ul>${/* ends the list of levels */''}
<p>A virtual address splits into <b>global directory index | middle directory index | page table index | offset</b>. Tables exist only for regions in use. The code is written against this generic tree; each processor supplies a few definitions (table sizes, bit positions).</p>${/* notes paragraph: the four fields of an address, and that tables exist only for regions in use */''}
<p><b>Folding.</b> A level the hardware lacks is defined with one entry and zero address bits, so the call that reads it hands back the entry it was given: no memory read, no cost, and the same code runs everywhere. Today’s Linux has five named levels, <b>PGD → P4D → PUD → PMD → PTE</b> (the PUD level was added in 2005, kernel 2.6.11; the P4D level in 2017).</p>${/* notes paragraph: how folding works, and the five named levels with the years the extra two were added */''}
<p>Each table fills one 4 KB page: 512 eight-byte entries (9 index bits) or 1,024 four-byte entries (10 bits). So 32-bit x86 has 2 real levels, 10 + 10 + 12 = 32 bits (4 GB); 64-bit ARM or RISC-V in 39-bit mode has 3, 9 + 9 + 9 + 12 = 39 bits (512 GB); x86-64 has 4 (48 bits, 256 TB), or 5 with 5-level paging (57 bits, 128 PB).</p>${/* notes paragraph: table sizes and index bits, and the address width of each example processor */''}
<p><b>Worked example</b> (39-bit, three levels): address 0x55_5555_6A3C has offset 0xA3C and page number 0x5555556, whose 9-bit fields are 341 | 170 | 342. The walk reads PGD[341], PMD[170], PTE[342] to get frame f; physical address = f × 4,096 + 0xA3C. Three table reads precede the data read, which is why the TLB caches translations. Most MMUs walk the tree on a TLB miss; the kernel walks it in software to change mappings.</p>${/* notes paragraph: a worked walk of one 39-bit address through three levels */''}
<p>An <b>empty entry</b> at any level raises a <b>page fault</b>. If the address is inside a region of the process (a heap page never touched), the kernel zero-fills a free frame, records it in the PTE and restarts the instruction; if no region covers it, the process gets SIGSEGV.</p>${/* notes paragraph: an empty entry causes a page fault, which ends in a fresh frame or a SIGSEGV */''}

<h3>Page allocation: the buddy allocator</h3>${/* heading for part 3 of the notes: the buddy allocator */''}
<p>Devices copying straight into memory, huge pages and big buffers need <b>contiguous</b> frames. Linux keeps free memory as blocks of 2<sup>k</sup> contiguous frames (k = the block’s <b>order</b>), one free list per order (orders 0 to 10: up to 1,024 frames = 4 MB).</p>${/* notes paragraph: why contiguous frames are needed, and how orders and free lists are kept */''}
<ol>${/* starts the numbered list of buddy rules */''}
<li>A request for n pages is served from the smallest order with 2<sup>k</sup> ≥ n (5 pages → order 3 = 8 frames, 3 unused).</li>${/* buddy rule 1: a request gets the smallest order that fits */''}
<li>If that list is empty, take a block from the next larger non-empty list and halve it repeatedly; each spare half joins the list one order down.</li>${/* buddy rule 2: an empty list means halving a bigger block */''}
<li>On a free, the block’s <b>buddy</b> starts at f XOR 2<sup>k</sup>. If the buddy is free and of the same order, merge them and repeat one order up.</li>${/* buddy rule 3: a freed block merges with its buddy, found with XOR */''}
</ol>${/* ends the numbered list */''}
<p><b>Worked example</b> (16 free frames): A asks for 1 page → splits 16 → 8, 8 → 4, 4 → 2, 2 → 1; A gets frame 0 and the lists hold 1, 2–3, 4–7, 8–15. B asks for 3 → order 2: frames 4–7 (one unused). C asks for 4 → split 8–15; C gets 8–11. A frees frame 0 → merges with 1, then 2–3, giving 0–3; its buddy 4–7 is in use, so it stops. Neighbours need not be buddies: 2–3 and 4–5 touch, but the buddy of 2 is 0. Real Linux keeps these lists per memory zone, with per-CPU caches of single pages in front.</p>${/* notes paragraph: the step 4 sample worked through by hand, plus the neighbours-that-are-not-buddies trap */''}

<h3>Page replacement then: page aging</h3>${/* heading for part 4 of the notes: page aging */''}
<p>Older kernels (last in 2.4.0–2.4.9, 2001) used a clock-like sweep in which each page’s single use bit grew into an <b>8-bit age</b>. Each use raised the age, a background sweep lowered it, and a page whose age had fallen to 0 (the lowest) was the victim. The age is a running score of uses minus sweeps, not just “used or not”. Because it counts uses, the scheme is a form of <b>least frequently used (LFU)</b>: a page used 5 times and then left alone keeps a positive age for several sweeps, while a page used once is back to 0 after one sweep. Busy pages are protected; stale ones linger.</p>${/* notes paragraph: the 8-bit age, why it behaves like least frequently used, and its weakness */''}

<h3>Page replacement now: the split LRU</h3>${/* heading for part 5 of the notes: the split LRU */''}
<p>Since 2.4.10 (2001) Linux has kept an <b>active list</b> (pages that proved busy) and an <b>inactive list</b> (eviction candidates); since 2.6.28 (2008), one pair for <b>file-backed</b> and one for <b>anonymous</b> pages. Two page flags drive them: <b>PG_referenced</b> (one recent use) and <b>PG_active</b> (on an active list).</p>${/* notes paragraph: the two lists, the split by page type, and the two flags */''}
<ul>${/* starts the list of split LRU rules */''}
<li>A newly read file page starts at the head of the inactive list; its first use sets PG_referenced.</li>${/* notes bullet: a new file page starts at the inactive head */''}
<li>A page on the inactive list that is used again while PG_referenced is set is <b>promoted</b> to the head of the active list (PG_active set, PG_referenced cleared). So a page must be used twice to become active.</li>${/* notes bullet: a second use on the inactive list promotes the page */''}
<li>A use of an active page sets PG_referenced. Aging the active list looks at its tail: a referenced page has the flag cleared and goes round again; an unreferenced one is <b>deactivated</b> to the inactive head. Idle pages drift down.</li>${/* notes bullet: aging the active list clears flags or deactivates pages */''}
<li>Reclaim takes the page at the <b>tail of the inactive list</b>, topping that list up from the active tail when it gets too short.</li>${/* notes bullet: reclaim takes the inactive tail */''}
</ul>${/* ends the list of rules */''}
<p><b>Why two lists:</b> pages of a big file read once enter the inactive list, are never promoted and leave from its tail, so the active list (the working set) is untouched. Since kernel 6.1 (2022) Linux can instead use a multi-generational LRU with several age generations.</p>${/* notes paragraph: why two lists protect the working set, and the newer multi-generational LRU */''}

<h3>Kernel memory allocation: the slab allocator</h3>${/* heading for part 6 of the notes: the slab allocator */''}
<p>Whole runs of pages come from the buddy allocator, but most kernel objects are a few bytes to a few KB, so the <b>slab allocator</b> sits on top of it:</p>${/* notes paragraph: why small objects need an allocator on top of the buddy allocator */''}
<ul>${/* starts the list describing slabs */''}
<li>It keeps a <b>cache</b> for each object type and for each <code>kmalloc</code> size class (8, 16, 32, 64, 96, 128, 192, 256, 512 bytes, 1, 2, 4 and 8 KB). Larger <code>kmalloc</code> requests go straight to the buddy allocator.</li>${/* notes bullet: caches per object type and per kmalloc size class */''}
<li>A cache takes pages from the buddy allocator and cuts each into equal slots; such a page (or small run of pages) is a <b>slab</b>, which is <b>full</b>, <b>partial</b> or <b>empty</b>.</li>${/* notes bullet: slabs and their full, partial and empty states */''}
<li>An allocation takes a free slot, from a partial slab first (so pages fill up); a free returns the slot; empty slabs go back to the buddy allocator when memory is tight.</li>${/* notes bullet: how allocation, freeing and shrinking work */''}
</ul>${/* ends the list */''}
<p>Fast (no searching, splitting or merging) and thrifty (slots fit their objects). <b>Example:</b> <code>kmalloc(294)</code> uses the 512-byte cache: 218 bytes (43%) of the slot go unused and a 4 KB page holds 8 objects; a whole page would be about 7% used.</p>${/* notes paragraph: why slabs are fast and thrifty, with the kmalloc(294) example from the size-class tab */''}
<p>Implementations: <b>SLAB</b> (the original 1990s design, modelled on Solaris, with per-CPU queues; removed in 6.8, 2024), <b>SLOB</b> (“simple list of blocks” for tiny-memory machines; removed in 6.4, 2023) and <b>SLUB</b> (simpler, “unqueued”, scales to many CPUs; default since 2.6.23, 2007, and the only one since 6.8).</p>${/* notes paragraph: the three implementations and their history */''}
<p>All three share one interface (<code>kmem_cache_alloc</code>, <code>kmalloc</code>, <code>kfree</code>, …), so other code never changed.</p>`,  // last notes paragraph: the shared interface; ends the notes text
  });  // closes the settings object and the Guide.section call that registers the section
})();  // ends the wrapping function and runs it at once
