// Comment key: a line inside backtick text ends with ${/* comment */''}, an empty-string slot that holds a comment without changing the text on screen (full note at the top of the page).
/* =====================================================================
   7.4 Segmentation
   Original teaching material. Shared data and small helpers live inside
   this IIFE so nothing leaks into the global scope.
   ===================================================================== */
(function () {  // wraps the whole section in a function that runs once, right away, so its names stay private to this file

  /* The running example: 16-bit logical addresses, 4-bit segment number, 12-bit offset. */
  const SEG_BITS = 4, OFF_BITS = 12, MAX_SEG = 1 << OFF_BITS;  // the running example's split: a 4-bit segment number and a 12-bit offset; MAX_SEG = 1 << 12 = 4,096 bytes, the largest segment

  /* Process P, a small music player, used in steps 1, 4 and 7. Bases are physical byte addresses. */
  const P_TABLE = [  // P_TABLE: the segment table of process P (a music player), one entry per segment, used by steps 1, 4 and 7
    { name: 'Main code', short: 'code', base: 21000, len: 2600, perm: 'R-X', what: 'The instructions of the main program: start-up, the menu loop, the play and pause logic.' },  // segment 0, the main code: 2,600 bytes starting at physical address 21,000, read and execute only (R-X)
    { name: 'Sort routine', short: 'sort', base: 9400, len: 900, perm: 'R-X', what: 'A library routine that sorts the song list. It was compiled separately and linked in.' },  // segment 1, the sort routine: a separately compiled library piece, 900 bytes at 9,400, also read and execute only
    { name: 'Song table', short: 'songs', base: 30500, len: 3000, perm: 'RW-', what: 'A data table: one record per song (title, artist, length). The program reads and updates it.' },  // segment 2, the song table: 3,000 bytes of data at 30,500, readable and writable but never run as code (RW-)
    { name: 'Stack', short: 'stack', base: 14200, len: 1100, perm: 'RW-', what: 'Local variables and return addresses for procedure calls. It grows and shrinks as calls are made and return.' },  // segment 3, the stack: 1,100 bytes at 14,200, read-write data that grows and shrinks with procedure calls
  ];  // closes P_TABLE

  const bin = (v, bits) => (v >>> 0).toString(2).padStart(bits, '0');  // bin(v, bits): writes v as a binary string padded with zeros to the given width (>>> 0 treats v as unsigned)
  const hex = (v, d = 4) => '0x' + (v >>> 0).toString(16).toUpperCase().padStart(d, '0');  // hex(v, d): writes v in hexadecimal with a 0x prefix, uppercase, padded to d digits (4 unless told otherwise)
  const nf = (v) => Number(v).toLocaleString('en-US');  // nf(v): adds thousands commas (21000 becomes 21,000), used for every number shown on screen

  /* The translation rule itself. Every number the student is shown comes out of this function. */
  function translate(table, addr) {  // translate(table, addr): the hardware rule as a function; takes a segment table and a logical address and reports the outcome
    const seg = addr >>> OFF_BITS, off = addr & (MAX_SEG - 1);  // splits the address: shifting right 12 bits leaves the segment number; AND with 4,095 (twelve 1 bits) keeps only the offset
    if (seg >= table.length) return { addr, seg, off, ok: false, why: 'noseg' };  // no table entry with that number: returns a failure marked noseg (the hardware would trap: no such segment)
    const e = table[seg];  // e is the table entry for this segment, holding its base and length
    if (off >= e.len) return { addr, seg, off, e, ok: false, why: 'len' };  // offset at or past the length: returns a failure marked len (trap: the offset falls outside the segment)
    return { addr, seg, off, e, ok: true, phys: e.base + off };  // both checks passed: the physical address is the entry's base plus the offset
  }  // ends translate
  const mkAddr = (seg, off) => ((seg << OFF_BITS) | off) >>> 0;  // mkAddr(seg, off): builds a logical address by shifting the segment number 12 bits left and OR-ing the offset into the low bits

  /* A clickable SVG group that behaves like a button (mouse, keyboard and the checker's fuzzer). */
  function hotGroup(ctx, label, onAct, ...kids) {  // hotGroup(ctx, label, onAct, ...kids): wraps SVG shapes (SVG is the browser's drawing format) in a group that acts like a button
    const g = ctx.s('g', { class: 'hot', tabindex: 0, role: 'button', 'aria-label': label }, ...kids);  // builds the group with ctx.s, the SVG builder: class hot gives a hand cursor, tabindex 0 makes Tab reach it, role and label speak to screen readers
    g.addEventListener('click', onAct);  // a mouse click runs the action
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAct(); } });  // Enter or Space run it from the keyboard too; preventDefault stops Space from scrolling the page
    return g;  // hands the finished group back to the caller
  }  // ends hotGroup

  /* Narration box shared by the interactive steps: tone is '', 'ok', 'bad' or 'warn'. */
  function narrate(box, html, tone) {  // narrate(box, html, tone): writes a message into one of the narration boxes and colours it by its tone
    box.className = 'narr' + (tone ? ' ' + tone : '');  // resets the box's classes: always narr, plus ok (green), bad (red) or warn (amber) when a tone is given
    box.innerHTML = html;  // puts the message in the box; it may contain HTML such as bold words or dotted glossary terms
  }  // ends narrate

  Guide.section({  // registers section 7.4 with the guide; the object below holds its steps, glossary terms, styles, quiz and notes
    id: '7.4',  // the section number, used in links, the contents list and saved progress
    title: 'Segmentation',  // the full title shown at the top of every step
    short: 'Segmentation',  // the short name used in the side menu and progress list
    summary: 'Cutting a program into variable-length segments that match its logical parts, and translating (segment, offset).',  // one-sentence summary shown beside the section in the contents and on the chapter page
    objectives: [  // objectives: what a student should be able to do after this section, shown on its first page
      'Explain what a segment is, why segments follow a program’s logical parts, and why segmentation is visible to the programmer.',  // objective 1: what a segment is, why it follows a program's logical parts, and why the programmer sees it
      'Split a logical address into a segment number and an offset, and state the maximum segment length for a given bit split.',  // objective 2: split an address into segment number and offset, and give the maximum segment length for a split
      'Translate a logical address with a segment table: look up base and length, check the offset, then add or trap.',  // objective 3: translate an address with a segment table: look up, check the offset, then add or trap
      'Describe how segments are placed in memory holes, and why segmentation has external but no internal fragmentation.',  // objective 4: placing segments into holes, and why there is external but no internal fragmentation
      'Use per-segment permissions and shared segments to explain protection and sharing, and compare the four memory techniques of this chapter.',  // objective 5: protection bits and shared segments, plus comparing the four memory techniques of the chapter
    ],  // closes the objectives list
    terms: [  // key terms for the glossary, each written as [term, definition]; dotted words in the steps show these definitions
      ['Segmentation', 'A memory-management scheme that divides a program and its data into segments of different lengths, each loaded into its own block of memory; the blocks need not be next to each other.'],  // glossary entry: segmentation as a whole scheme
      ['Segment', 'A variable-length piece of a program that matches one logical part of it, such as the main code, a library routine, a data table or the stack. Each segment has its own addresses starting at 0.'],  // glossary entry: segment, one logical part of a program
      ['Segment number', 'The part of a segmented logical address that says which segment is meant: the leftmost n bits. It is an index into the process’s segment table.'],  // glossary entry: segment number, the leftmost bits that index the table
      ['Offset (within a segment)', 'How many bytes past the start of its segment a location lies: the rightmost m bits of the logical address. Valid offsets run from 0 to the segment’s length minus 1.'],  // glossary entry: offset within a segment, the rightmost bits
      ['Maximum segment length', 'The largest size any one segment may have. With an m-bit offset field it is 2^m bytes; a larger object has to be split across segments.'],  // glossary entry: maximum segment length, set by the width of the offset field
      ['Segment table', 'A per-process table, kept by the OS and used by the processor, with one entry per segment holding the segment’s base and length (and usually its protection bits).'],  // glossary entry: segment table, one per process
      ['Segment base (base)', 'The physical address where a segment starts in main memory; it is stored in the segment’s table entry.'],  // glossary entry: segment base, where a segment starts in physical memory
      ['Segment length (limit)', 'The size of a segment in bytes, stored in its table entry so the hardware can reject any offset that falls outside the segment.'],  // glossary entry: segment length (limit), used for the hardware range check
      ['Segmentation fault (segfault)', 'The trap to the OS that happens when a logical address fails the hardware check: no such segment, an offset at or beyond the segment’s length, or an access its protection bits forbid.'],  // glossary entry: segmentation fault and the three ways an address can fail
      ['Free-block list', 'The OS’s list of the holes (free blocks) in main memory, with their start addresses and sizes, consulted whenever segments must be placed.'],  // glossary entry: free-block list, the OS's record of holes
      ['Hole', 'A free block of main memory lying between allocated areas.'],  // glossary entry: hole, a free block between allocated areas
      ['External fragmentation', 'Free memory that is split into many holes, each too small for the next request, even though their total would be enough.'],  // glossary entry: external fragmentation, free space split into pieces too small to use
      ['Internal fragmentation', 'Space wasted inside an allocated piece because the piece is bigger than what it holds.'],  // glossary entry: internal fragmentation, waste inside an allocated piece
      ['Dynamic partitioning', 'Placing each whole process in one block of memory created at exactly the process’s size.'],  // glossary entry: dynamic partitioning, one exact-size block per whole process
      ['Paging', 'Dividing memory into equal frames and each process into pages of the same size, so any page can go in any free frame.'],  // glossary entry: paging, equal frames and pages, for contrast
      ['Protection bits (access rights)', 'Flags in a segment table entry such as read, write and execute that say which kinds of access to that segment are allowed; the hardware checks them on every reference.'],  // glossary entry: protection bits (access rights) such as read, write and execute
      ['Shared segment', 'A segment whose entry appears in the segment tables of several processes, so one physical copy serves all of them.'],  // glossary entry: shared segment, one copy listed in several tables
    ],  // closes the terms list
    css: ` /* css: style rules for this section only, one text block the guide adds to the page; .sec-7-4 limits each rule to these slides */
      .sec-7-4 { --sg0: var(--cpu); --sg1: var(--thread); --sg2: var(--mem); --sg3: var(--io); --sgn: var(--accent); --off: var(--proc); } /* colour names for this section: segments 0 to 3 are blue, pink, green and orange; segment-number bits indigo, offset bits teal */
      .sec-7-4 .hot { cursor: pointer; outline: none; } /* clickable drawing parts (hot) show a hand cursor; the browser's own focus ring is turned off because the next rule replaces it */
      .sec-7-4 .hot:focus-visible rect { stroke-width: 3.5; } /* a clickable part focused with the keyboard gets a thicker outline, so the student can see where focus is */
      .sec-7-4 .sg0 { fill: color-mix(in srgb, var(--sg0) 20%, var(--panel)); stroke: var(--sg0); } /* sg0: the shape for segment 0, a pale blue fill (20% blue mixed into the panel colour) with a blue border */
      .sec-7-4 .sg1 { fill: color-mix(in srgb, var(--sg1) 20%, var(--panel)); stroke: var(--sg1); } /* sg1: the shape for segment 1, pale pink with a pink border */
      .sec-7-4 .sg2 { fill: color-mix(in srgb, var(--sg2) 20%, var(--panel)); stroke: var(--sg2); } /* sg2: the shape for segment 2, pale green with a green border */
      .sec-7-4 .sg3 { fill: color-mix(in srgb, var(--sg3) 20%, var(--panel)); stroke: var(--sg3); } /* sg3: the shape for segment 3, pale orange with an orange border */
      .sec-7-4 .tx0 { fill: var(--sg0); } .sec-7-4 .tx1 { fill: var(--sg1); } .sec-7-4 .tx2 { fill: var(--sg2); } .sec-7-4 .tx3 { fill: var(--sg3); } /* tx0 to tx3: text inside drawings in each segment's colour, so a label matches its block */
      .sec-7-4 .c0 { color: var(--sg0); } .sec-7-4 .c1 { color: var(--sg1); } .sec-7-4 .c2 { color: var(--sg2); } .sec-7-4 .c3 { color: var(--sg3); } /* c0 to c3: ordinary page text in each segment's colour, for headings in the info card and the size chips */
      .sec-7-4 .c-sgn { color: var(--sgn); } .sec-7-4 .c-off { color: var(--off); } /* c-sgn and c-off: page text in the segment-number colour (indigo) and the offset colour (teal) */
      .sec-7-4 .tx-sgn { fill: var(--sgn); } .sec-7-4 .tx-off { fill: var(--off); } /* tx-sgn and tx-off: the same two colours for text inside drawings */
      .sec-7-4 .tx-ok { fill: var(--ok); } .sec-7-4 .tx-bad { fill: var(--bad); } .sec-7-4 .tx-muted { fill: var(--muted); } /* tx-ok, tx-bad and tx-muted: green, red and grey drawing text for valid results, traps and quiet labels */
      .sec-7-4 .c-ok { color: var(--ok); } .sec-7-4 .c-bad { color: var(--bad); } /* c-ok and c-bad: green and red page text, used for good and bad cells in the comparison table and the recap formula */
      .sec-7-4 .s-free { fill: var(--panel); stroke: var(--line-2); stroke-dasharray: 5 4; } /* s-free: a hole in the memory map, drawn white with a dashed grey border so empty space looks empty */
      .sec-7-4 .s-other { fill: var(--panel-3); stroke: var(--line-2); } /* s-other: memory held by other processes, a plain grey block that stays dull next to the coloured segments */
      .sec-7-4 .narr { background: var(--panel-2); border: 1px solid var(--line); border-left: 5px solid var(--accent); border-radius: 10px; padding: 9px 12px; font-size: 15px; line-height: 1.45; } /* narr: the narration box: tinted fill, thin border, a thick indigo bar on the left, rounded corners and easy-to-read text */
      .sec-7-4 .narr.ok { border-left-color: var(--ok); background: var(--ok-bg); } /* narr.ok: a success message turns the bar and fill green */
      .sec-7-4 .narr.bad { border-left-color: var(--bad); background: var(--bad-bg); } /* narr.bad: a failure, such as a trap or no hole big enough, turns it red */
      .sec-7-4 .narr.warn { border-left-color: var(--warn); background: var(--warn-bg); } /* narr.warn: a caution turns it amber */
      .sec-7-4 .bits { display: grid; grid-template-columns: repeat(16, minmax(0, 1fr)); gap: 3px; } /* bits: a grid of 16 equal columns, one per bit of the address, used for the bit rows in step 2 */
      .sec-7-4 .bits .ix { font-size: 12.5px; color: var(--muted); text-align: center; font-family: var(--mono); } /* the small grey bit-position numbers (15 down to 0) above the bit buttons, centred in the fixed-width font */
      .sec-7-4 .bitb { height: 36px; min-width: 0; padding: 0; border-radius: 7px; border: 2px solid var(--line-2); background: var(--panel); font: 700 18px var(--mono); color: var(--ink); cursor: pointer; } /* bitb: each bit button: 36px tall, rounded border, a large bold digit and a hand cursor; min-width 0 lets it shrink on small screens */
      .sec-7-4 .bitb.f-sgn { border-color: var(--sgn); background: color-mix(in srgb, var(--sgn) 16%, var(--panel)); } /* f-sgn: a bit that belongs to the segment number gets an indigo border and a pale indigo fill */
      .sec-7-4 .bitb.f-off { border-color: var(--off); background: color-mix(in srgb, var(--off) 14%, var(--panel)); } /* f-off: a bit that belongs to the offset gets a teal border and a pale teal fill */
      .sec-7-4 .bitb:hover { filter: brightness(0.96); } /* hovering a bit button darkens it slightly, a hint that it can be clicked */
      .sec-7-4 .bitfield { display: grid; gap: 3px; font-size: 13px; font-weight: 700; text-align: center; } /* bitfield: the bar under the bits naming each field's width; its two columns are sized from code to match the split */
      .sec-7-4 .bitfield > div { border-top: 3px solid; padding-top: 2px; } /* each field label gets a thick line along its top in the field's colour (set from code), marking which bits it covers */
      .sec-7-4 .tbl.tight th, .sec-7-4 .tbl.tight td { padding: 3px 8px; } /* less padding in table cells for tables marked tight, such as the split table in step 2 and the comparison in step 7 */
      .sec-7-4 .stat { background: var(--panel-2); border: 1px solid var(--line); border-radius: 10px; padding: 6px 10px; } /* stat: a small statistic tile in step 3 (free memory, largest hole...): tinted box, thin border, rounded corners */
      .sec-7-4 .stat .v { font-size: 22px; font-weight: 800; font-variant-numeric: tabular-nums; } /* the tile's value: large bold digits of equal width, so a changing number does not jiggle */
      .sec-7-4 .stat .l { font-size: 12.5px; color: var(--muted); font-weight: 700; text-transform: uppercase; letter-spacing: .04em; } /* the tile's label: small grey capital letters, spaced slightly apart */
    `,  // ends the css text block
    steps: [  // steps: the screens of this section, shown in this order
      /* ---------------- 1. Big picture: a program is made of logical parts ---------------- */
      {  // opens step 1, the big picture: a program is made of logical parts
        title: 'Cutting a program along its natural seams',  // step title shown at the top of the screen
        kind: 'story',  // kind story: labelled Big Picture, and always part of the shorter core path
        render(el, ctx) {  // render(el, ctx): draws the step into the box el when the student opens it; ctx carries the guide's helpers
          const { h, s } = ctx;  // takes h (builds HTML elements) and s (builds SVG drawing elements) out of ctx
          const starts = [];  // starts will hold where each part of P would begin if all four sat end to end in one flat block
          P_TABLE.reduce((a, e, i) => { starts[i] = a; return a + e.len; }, 0);  // reduce walks the parts keeping a running total, recording it as each part's start: 0, 2,600, 3,500 and 6,500
          const total = P_TABLE.reduce((a, e) => a + e.len, 0);  // total: the size of the whole program, 7,600 bytes
          const EX = 500, slim = ctx.narrow;  // EX = 500 is the example byte used in the explanations; slim is true on phone-width screens
          const G = slim ? { W: 360, X0: 8, STEP: 88, BW: 80, FX: 15, FLAT: 320 } : { W: 600, X0: 20, STEP: 145, BW: 125, FX: 20, FLAT: 560 };  // G: drawing measurements for small screens or desktop: overall width, left margin, block spacing and width, and the flat bar's left edge and width
          let view = 'seg', sel = 2;  // view: which picture is showing ('seg' or 'flat'); sel: the selected part, starting with segment 2, the song table
          const svg = s('svg', { viewBox: `0 0 ${G.W} 214`, width: '100%', role: 'group', 'data-keys': 'arrows', 'aria-label': 'The four parts of program P; arrow keys move between them' });  // the drawing; data-keys tells the guide that arrow keys inside it move the selection instead of changing slides
          ctx.on(svg, 'keydown', (e) => {  // ctx.on adds a key listener that is removed automatically when the slide closes
            const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];  // d: +1 for the Right or Down arrow, -1 for Left or Up, nothing for any other key
            if (d) { e.preventDefault(); pick((sel + d + P_TABLE.length) % P_TABLE.length); }  // moves the selection one part along, wrapping around at either end (adding the length keeps the number from going negative)
          });  // ends the key handler
          const info = h('div', { class: 'card tight small', style: { minHeight: '104px' } });  // info: the card under the drawing that explains the selected part; a minimum height stops the layout jumping
          function blockText(i, cx, y, lines) {  // blockText(i, cx, y, lines): one centred text line per entry in lines, 16px apart
            return lines.map((ln, k) => s('text', { x: cx, y: y + k * 16, 'text-anchor': 'middle', 'font-size': k ? 13 : 14, 'font-weight': k ? 400 : 700 }, ln));  // the first line is bold and slightly larger; the rest are normal weight
          }  // ends blockText
          function draw() {  // draw(): rebuilds the drawing for the current view and selection
            const kids = [];  // kids collects every shape so the drawing can be replaced in one go
            if (view === 'seg') {  // the "As segments" view: four separate blocks
              kids.push(s('text', { x: G.W / 2, y: 18, 'text-anchor': 'middle', 'font-size': 14, class: 's-sub' }, slim ? 'Each segment’s offsets start at 0' : 'Each segment is its own piece, with addresses that start at offset 0'));  // heading over the blocks: every segment's offsets start at 0 (a shorter wording on small screens)
              P_TABLE.forEach((e, i) => {  // one block for each segment of P
                const x = G.X0 + i * G.STEP, w = G.BW, hh = Math.round(e.len * 0.045), y = 186 - hh;  // block position: x steps across; height grows with length (0.045px per byte), and all blocks stand on one baseline at y = 186
                kids.push(hotGroup(ctx, 'Segment ' + i + ': ' + e.name, () => pick(i),  // wraps the block in a clickable group named after the segment; using it selects that segment
                  s('rect', { x, y, width: w, height: hh, rx: 8, class: 'sg' + i, 'stroke-width': sel === i ? 3.5 : 1.5 }),  // the block in its segment's colour; the selected block gets a thicker border
                  s('text', { x: x + w / 2, y: y - 8, 'text-anchor': 'middle', 'font-size': slim ? 13 : 14, 'font-weight': 800, class: 'tx' + i }, (slim ? 'Seg ' : 'Segment ') + i),  // label above the block, "Segment 2" (or "Seg 2" on small screens), in the segment's colour
                  ...blockText(i, x + w / 2, y + hh / 2 - 3, slim ? [e.short, nf(e.len)] : [e.name, nf(e.len) + ' bytes']),  // name and size centred inside the block (short name and bare number on small screens)
                  s('text', { x: x + w / 2, y: 206, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, (slim ? '0–' : 'offsets 0–') + nf(e.len - 1))));  // under the block: its valid offsets, from 0 to length minus 1; the brackets close the label, the group and the push
              });  // ends the loop over segments
            } else {  // otherwise the "As one flat block" view: all four parts end to end in a single address range
              const k = G.FLAT / total;  // k: pixels per byte, so the 7,600-byte program spans the bar's width
              kids.push(s('text', { x: G.W / 2, y: 18, 'text-anchor': 'middle', 'font-size': 14, class: 's-sub' }, (slim ? 'One flat block: 0 to ' : 'One flat block: a single row of addresses, 0 to ') + nf(total - 1)));  // heading: one flat block, with addresses from 0 to 7,599
              P_TABLE.forEach((e, i) => {  // one coloured stretch of the bar per part
                const x = G.FX + starts[i] * k, w = e.len * k;  // each stretch starts at the part's running total and is as wide as its length
                kids.push(hotGroup(ctx, e.name, () => pick(i),  // a clickable group for the part, as in the segment view
                  s('rect', { x, y: 70, width: w, height: 70, class: 'sg' + i, 'stroke-width': sel === i ? 3.5 : 1.5 }),  // the stretch itself; the selected part gets a thicker border
                  ...blockText(i, x + w / 2, 102, [e.short, nf(e.len)])));  // short name and size centred in the stretch; the brackets close the group and the push
              });  // ends the loop over parts
              const ticks = [...starts, total];  // ticks: the address where each part begins, plus the address just past the end of the program
              ticks.forEach((a, j) => {  // draws a tick mark and an address label at each boundary
                const x = G.FX + a * k, near = (b) => b !== undefined && Math.abs(b - a) * k < 60;  // x of this tick; near(b) tells whether tick b lies within 60px, where two labels would overlap
                const anchor = !slim ? 'middle' : (j === ticks.length - 1 || near(ticks[j + 1])) ? 'end' : near(ticks[j - 1]) ? 'start' : 'middle';  // on small screens crowded labels are anchored at their end or start so they lean apart; otherwise they are centred
                kids.push(s('line', { x1: x, y1: 140, x2: x, y2: 152, class: 's-line' }),  // the short vertical tick under the bar
                  s('text', { x: x + (anchor === 'end' ? 3 : anchor === 'start' ? -3 : 0), y: 168, 'text-anchor': anchor, 'font-size': 13, class: 's-monot' }, nf(a)));  // the address number under the tick, nudged 3px inward when anchored to one side
              });  // ends the loop over ticks
              kids.push(s('text', { x: G.W / 2, y: 200, 'text-anchor': 'middle', 'font-size': 14 }, slim ? `${P_TABLE[sel].short} starts at ${nf(starts[sel])}, not at 0` : `${P_TABLE[sel].name} now starts at address ${nf(starts[sel])}, not at 0`));  // note under the bar: in the flat block the selected part starts at its running total, not at 0
            }  // ends the choice between the two views
            svg.replaceChildren(...kids);  // replaces the old drawing with the new shapes in one step
          }  // ends draw
          function paint() {  // paint(): rewrites the info card for the selected part and the current view
            const e = P_TABLE[sel], i = sel;  // e is the selected part's table entry and i its segment number
            if (view === 'seg') {  // text for the segment view
              info.innerHTML = `<div class="b c${i}">Segment ${i}: ${e.name} · ${nf(e.len)} bytes</div><div>${e.what}</div>` +  // heading in the segment's colour with its number, name and size, followed by its description
                `<div class="mt" style="margin-top:6px">Byte ${EX} of this segment has the logical address <b>(${i}, ${EX})</b>: segment ${i}, offset ${EX}. That stays true wherever the OS puts the segment in memory.</div>`;  // explains that byte 500 of the segment is the address (i, 500) wherever the OS places the segment
            } else {  // text for the flat view
              const grown = i === 0 ? starts[i] + EX : starts[i] + EX + 100;  // grown: where byte 500 of this part would land after the main code grows by 100 bytes (the code itself keeps its start)
              info.innerHTML = `<div class="b c${i}">${e.name} inside one flat block</div>` +  // heading: this part inside one flat block
                `<div>It begins at address ${nf(starts[i])}, so its byte ${EX} is address <b>${nf(starts[i] + EX)}</b>. ` +  // gives its start address and the flat address of its byte 500
                (i === 0 ? `If the main code grows by 100 bytes, this address stays ${nf(grown)}, but every part after the code shifts by 100.`  // for the main code itself: its address stays, but every part after it shifts by 100
                  : `If the main code grows by 100 bytes, this address becomes <b>${nf(grown)}</b> and every reference to it must be fixed. As a segment it stays (${i}, ${EX}).`) + '</div>';  // for any other part: its address moves, so every reference must be fixed, while as a segment it would stay (i, 500)
            }  // ends the two cases
          }  // ends paint
          function pick(i) {  // pick(i): selects part i after a click, Enter or an arrow key
            const hadFocus = svg.contains(document.activeElement);  // hadFocus: whether keyboard focus was inside the drawing, since redrawing replaces the focused shape
            sel = i; draw(); paint();  // stores the choice and redraws both the drawing and the info card
            if (hadFocus) svg.querySelectorAll('.hot')[i].focus();  // puts focus on the newly drawn block, so keyboard users keep their place
          }  // ends pick
          const toggle = ctx.ui.seg([{ value: 'seg', label: 'As segments' }, { value: 'flat', label: 'As one flat block' }], view, (v) => { view = v; draw(); paint(); });  // the two-button switch (ctx.ui.seg) between the segment view and the flat view; a change redraws both
          draw(); paint();  // draws the starting picture and info card as soon as the step opens
          el.append(h('div', { class: 'split l fill' },  // lays out the step: two columns, the left one smaller (split l), filling the step's height
            h('div', { class: 'stack' },  // left column, items stacked top to bottom
              h('p', { class: 'lead m0', html: 'Paging (7.3) slices a program into equal pieces wherever the cuts happen to fall. Programmers do not think about their programs that way.' }),  // opening sentence: paging cuts wherever the boundaries fall, which is not how programmers see their programs
              h('p', { class: 'm0', html: 'A program is built from <b>logical parts</b>: main code, library routines, data tables, a stack. Each has its own size, and some grow or shrink. <span class="t">Segmentation</span> cuts the program along exactly those seams. Each part becomes a <span class="t">segment</span>: a piece of whatever length it needs, up to a fixed maximum.' }),  // paragraph introducing logical parts, segmentation and the segment, with dotted glossary terms
              h('div', { class: 'callout analogy m0', 'data-label': 'Analogy', html: 'A book is split into chapters of different lengths, not into equal 20-page bundles. “Chapter 3, page 12” stays a good reference even after chapter 2 is rewritten and gets longer. A segmented address, (segment number, offset), works the same way.' }),  // analogy callout: chapters of different lengths, where a chapter-and-page reference survives an earlier chapter growing
              h('p', { class: 'small muted m0', html: 'Coming up: split addresses into bits, place segments into free memory, translate addresses with a segment table, protect and share segments, and weigh segmentation against paging.' })),  // small grey preview of what the rest of the section covers
            h('div', { class: 'stack' },  // right column: the interactive picture
              h('div', { class: 'row' }, toggle, h('span', { class: 'small muted', text: 'Click any part of program P.' })),  // row with the view switch and a hint to click any part
              h('div', { class: 'card white', style: { padding: '8px 10px' } }, svg),  // white card that holds the drawing
              info,  // the info card about the selected part
              h('div', { class: 'callout why m0', 'data-label': 'Why it matters', html: 'Each segment is one whole logical part, so it can be compiled, protected and shared on its own.' }))));  // "Why it matters" callout: a segment is one whole logical part, so it can be compiled, protected and shared alone; closes the layout
        },  // ends render for step 1
      },  // closes step 1
      /* ---------------- 2. Two-part addresses and the bit split ---------------- */
      {  // opens step 2: the two-part address and how its bits are split
        title: 'A two-part address: segment number and offset',  // step title shown at the top of the screen
        kind: 'learn',  // kind learn: labelled Learn above the title
        render(el, ctx) {  // render(el, ctx): builds step 2 when the student opens it
          const { h } = ctx;  // takes the HTML builder h out of ctx
          const W = 16;  // W: the address width, 16 bits
          let n = SEG_BITS, addr = mkAddr(2, 500), lastMsg = '';  // n: bits given to the segment number (4 to start); addr: the address shown, starting at (2, 500); lastMsg: what the student did last
          const ixRow = h('div', { class: 'bits' }, ...Array.from({ length: W }, (_, k) => h('div', { class: 'ix', text: String(W - 1 - k) })));  // ixRow: the row of bit positions over the buttons, 15 on the left down to 0 on the right
          const btns = Array.from({ length: W }, (_, k) => h('button', { type: 'button', class: 'bitb', 'aria-label': 'Bit ' + (W - 1 - k), onclick: () => { addr ^= 1 << (W - 1 - k); lastMsg = 'flip'; update(); } }));  // btns: one button per bit; a click flips that bit in addr with XOR (^=), notes it was a flip, and refreshes the panel
          const bitRow = h('div', { class: 'bits' }, ...btns);  // bitRow: the 16 bit buttons side by side in the bits grid
          const field = h('div', { class: 'bitfield' });  // field: the bar under the bits that shows how many belong to each field
          const decode = h('div', { class: 'grid-2 small', style: { gap: '4px 14px' } });  // decode: two lines that turn each field's bits into a number
          const splitTbl = h('table', { class: 'tbl compact tight', html: '<thead><tr><th>Split (n + m)</th><th>Most segments</th><th>Max segment length</th></tr></thead><tbody>' +  // splitTbl: a table of the possible splits with the segment count and the maximum segment length for each
            [2, 3, 4, 5, 6].map((k) => `<tr data-n="${k}"><td class="mono">${k} + ${W - k}</td><td>2<sup>${k}</sup> = ${nf(2 ** k)}</td><td>2<sup>${W - k}</sup> = ${nf(2 ** (W - k))} bytes</td></tr>`).join('') + '</tbody>' });  // one row per split from 2 + 14 to 6 + 10, tagged with data-n so the current split can be lit up
          const msg = h('div', { class: 'narr' });  // msg: the narration box under the controls
          const slider = ctx.ui.slider({ label: 'Bits for the segment number', min: 2, max: 6, value: n, format: (v) => `${v} + ${W - v}`, onInput: (v) => { n = v; lastMsg = 'split'; update(); } });  // slider for how many bits the segment number gets (2 to 6), shown as "4 + 12"; moving it changes n, notes it, and refreshes
          const preset = (label, fn) => h('button', { class: 'btn sm', type: 'button', onclick: () => { addr = fn(); lastMsg = 'preset'; update(); } }, label);  // preset(label, fn): a small button that sets addr to whatever fn returns and refreshes the panel
          const presets = h('div', { class: 'row' },  // presets: the row of example buttons
            h('span', { class: 'small b', text: 'Try:' }),  // "Try:" label at the start of the row
            preset('Song table, byte 500', () => (2 << (W - n)) | 500),  // example: segment 2, offset 500, built for whatever split is current (2 shifted past the m offset bits, OR 500)
            preset('Largest offset, segment 1', () => (1 << (W - n)) | ((1 << (W - n)) - 1)),  // example: segment 1 with every offset bit set to 1, the largest offset that split allows
            preset('All zeros', () => 0));  // example: all bits zero, segment 0 offset 0; closes the row
          function update() {  // update(): recomputes and redraws everything in step 2 after any change
            const m = W - n, seg = addr >>> m, off = addr & ((1 << m) - 1);  // m: the offset bits (16 - n); seg: the address shifted right by m; off: the address ANDed with m one-bits
            const bits = bin(addr, W);  // bits: the address as a 16-character string of 0s and 1s
            btns.forEach((b, k) => { b.textContent = bits[k]; b.classList.toggle('f-sgn', k < n); b.classList.toggle('f-off', k >= n); });  // writes each button's digit and colours it as a segment-number bit (the first n) or an offset bit (the rest)
            field.style.gridTemplateColumns = `${n}fr ${m}fr`;  // sizes the two field labels in proportion n to m, so each sits under its own bits
            field.replaceChildren(  // replaces the field labels with fresh ones
              h('div', { class: 'c-sgn', style: { borderColor: 'var(--sgn)' }, text: n + ' bits' }),  // left label: the segment number's bit count, in indigo with an indigo top line
              h('div', { class: 'c-off', style: { borderColor: 'var(--off)' }, text: m + ' bits' }));  // right label: the offset's bit count, in teal with a teal top line
            decode.innerHTML = `<div><span class="b c-sgn">Segment number</span> <span class="mono">${bits.slice(0, n)}</span> = <b>${seg}</b></div>` +  // first decode line: the segment-number bits and their value
              `<div><span class="b c-off">Offset</span> <span class="mono">${bits.slice(n)}</span> = <b>${nf(off)}</b></div>`;  // second decode line: the offset bits and their value
            splitTbl.querySelectorAll('tbody tr').forEach((tr) => tr.classList.toggle('on', +tr.dataset.n === n));  // lights up the table row whose data-n matches the current split (+ turns the text into a number)
            const maxLen = 2 ** m, need = Math.ceil(6000 / maxLen);  // maxLen: the largest segment, 2 to the m; need: how many segments a 6,000-byte table would take at this split
            const pair = `<b>(${seg}, ${nf(off)})</b>`;  // pair: the address written as a bold (segment, offset) pair
            let t = `The 16 bits <span class="mono">${bits.slice(0, n)} ${bits.slice(n)}</span> (${hex(addr)}) mean segment ${seg}, offset ${nf(off)}: the address ${pair}.`;  // default message: the bits with a gap at the split, the hex value, and the pair they mean
            if (lastMsg === 'split') t = `Same 16 bits, split ${n} + ${m}: now they mean ${pair}. Up to ${nf(2 ** n)} segments of at most ${nf(maxLen)} bytes, so a 6,000-byte table needs ${need === 1 ? 'one segment' : need + ' segments'}. Real hardware fixes the split.`;  // after the slider moves: the same bits now mean a different pair, plus the limits of this split and the 6,000-byte table example
            else if (lastMsg === 'flip') t += ' Flipping a segment-number bit jumps to a different segment; flipping an offset bit moves within the same one.';  // after a bit flip: adds that segment-number bits jump between segments while offset bits move within one
            narrate(msg, t, '');  // shows the message in the narration box in the neutral tone
          }  // ends update
          update();  // fills in every part once as the step opens
          el.append(h('div', { class: 'split l fill' },  // lays out the step: two columns, the left one smaller, filling the step's height
            h('div', { class: 'stack' },  // left column: the explanation
              h('p', { class: 'lead m0', html: 'A segmented address has two parts: <b>which segment</b>, and <b>how far into it</b>.' }),  // opening sentence: an address names which segment and how far into it
              h('p', { class: 'm0', html: 'The hardware receives one binary number. The leftmost <i>n</i> bits are the <span class="t">segment number</span>; the rightmost <i>m</i> bits are the <span class="t">offset</span>. Our running example uses 16 bits split 4 + 12: at most 2<sup>4</sup> = 16 segments, and no segment longer than 2<sup>12</sup> = 4,096 bytes, because 12 bits can only count offsets 0 to 4,095. That cap is the <span class="t">maximum segment length</span>.' }),  // paragraph: leftmost n bits are the segment number, rightmost m the offset, and why 4 + 12 caps a segment at 4,096 bytes
              h('p', { class: 'm0', html: 'The programmer or the compiler decides what goes in each segment: code here, a table there, a separately compiled module in a third. Unlike paging, segmentation is usually <b>visible</b> to the programmer.' }),  // paragraph: the programmer or compiler chooses the segments, so segmentation is visible, unlike paging
              h('div', { class: 'callout warn m0', 'data-label': 'Common mistake', html: 'Assuming a segment can be any size. The offset field caps it: with 12 offset bits a 6,000-byte table cannot be one segment, so it must be split in two. Staying under the limit is the programmer’s (or compiler’s) job.' })),  // "Common mistake" callout: a segment cannot be any size, so a 6,000-byte table must be split in two; closes the left column
            h('div', { class: 'card white stack', style: { gap: '10px' } },  // right column: a white card holding the bit explorer
              h('h4', { class: 'm0', text: 'Click any bit to flip it' }),  // card heading inviting the student to flip bits
              h('div', { class: 'stack', style: { gap: '4px' } }, ixRow, bitRow, field, decode),  // the bit positions, bit buttons, field bar and decoded values stacked closely together
              slider, splitTbl, presets, msg)));  // then the split slider, the split table, the example buttons and the narration box; closes the layout
        },  // ends render for step 2
      },  // closes step 2
      /* ---------------- 3. Segment builder: placing segments into holes ---------------- */
      {  // opens step 3, the segment builder: placing segments into holes
        title: 'Placing segments: small pieces fit where big ones cannot',  // step title shown at the top of the screen
        kind: 'explore',  // kind explore: labelled Explore above the title
        core: true,  // core: true keeps this step on the shorter core path
        render(el, ctx) {  // render(el, ctx): builds step 3 when the student opens it
          const { h, s } = ctx;  // takes h (HTML builder) and s (SVG builder) out of ctx
          const KB = 14, TOP = 16, MEM = 32, X0 = ctx.narrow ? 60 : 74, BW = ctx.narrow ? 124 : 150, VW = ctx.narrow ? 370 : 430;  // KB: pixels per kilobyte; TOP: top margin; MEM: 32 KB of memory; X0, BW, VW: the column's left edge, width and the drawing width, smaller on phone-width screens
          const START = [  // START: the memory map before anything is loaded, top to bottom; each region has a start and size in KB and a kind
            { start: 0, size: 4, kind: 'os' }, { start: 4, size: 5, kind: 'free' },  // the OS fills 0 to 4 KB, followed by a 5 KB hole
            { start: 9, size: 2, kind: 'other', label: 'A' }, { start: 11, size: 3, kind: 'free' },  // process A takes 2 KB at 9 KB, followed by a 3 KB hole
            { start: 14, size: 2, kind: 'other', label: 'B' }, { start: 16, size: 6, kind: 'free' },  // process B takes 2 KB at 14 KB, followed by a 6 KB hole, the largest
            { start: 22, size: 2, kind: 'other', label: 'C' }, { start: 24, size: 2, kind: 'free' },  // process C takes 2 KB at 22 KB, followed by a 2 KB hole
            { start: 26, size: 2, kind: 'other', label: 'D' }, { start: 28, size: 4, kind: 'free' },  // process D takes 2 KB at 26 KB, and a 4 KB hole runs to the end of memory
          ];  // closes START: 20 KB is free in five holes
          const FULL = ['Main code', 'Library', 'Data table', 'Stack'], SHORT = ['code', 'library', 'data', 'stack'];  // FULL and SHORT: long and short names of the new program's four segments
          let sizes = [4, 2, 3, 2], mode = 'seg', regions = START, gen = 0, busy = false, loaded = false, fresh = null;  // sizes: each segment in KB; mode: segments or one block; regions: the map now; gen: run number; busy, loaded: animation state; fresh: piece just placed
          const total = () => sizes.reduce((a, b) => a + b, 0);  // total(): the whole program's size, the sum of the four segment sizes
          const holes = (regs) => regs.filter((r) => r.kind === 'free');  // holes(regs): just the free regions of a map
          const svg = s('svg', { viewBox: `0 0 ${VW} ${TOP * 2 + MEM * KB}`, width: '100%', role: 'img', 'aria-label': 'Main memory map' });  // the memory map drawing, tall enough for 32 KB at 14px each plus margins
          const msg = h('div', { class: 'narr' });  // msg: the narration box
          const statBox = h('div', { style: { display: 'grid', gap: '10px', gridTemplateColumns: `repeat(${ctx.narrow ? 2 : 4}, minmax(0, 1fr))` } });  // statBox: the stat tiles, four across on desktop or two across on small screens
          const summary = h('div', { class: 'row small' });  // summary: the row that lists the new program's parts and their total
          function place(regs, p) {  // place(regs, p): first-fit placement: puts piece p into the first hole big enough, or returns null if there is none
            const idx = regs.findIndex((r) => r.kind === 'free' && r.size >= p.size);  // idx: the position of the first free region at least as large as the piece
            if (idx < 0) return null;  // no hole is big enough: the piece cannot be placed
            const hole = regs[idx], piece = { start: hole.start, size: p.size, kind: 'piece', seg: p.seg, label: p.label };  // hole: the chosen hole; piece: a new region at the hole's start with the piece's size, segment number and name
            const out = regs.slice();  // out: a copy of the map, so the old one is untouched and a failed load can be undone
            out.splice(idx, 1, piece, ...(hole.size > p.size ? [{ start: hole.start + p.size, size: hole.size - p.size, kind: 'free' }] : []));  // swaps the hole for the piece, followed by a smaller hole for any space left over
            return { regs: out, hole, piece };  // returns the new map, the hole that was used and the piece that was placed
          }  // ends place
          const pieces = () => (mode === 'seg' ? sizes.map((z, i) => ({ seg: i, size: z, label: FULL[i] })) : [{ seg: -1, size: total(), label: 'Whole program' }]);  // pieces(): what to load: the four segments, or in one-block mode a single piece (segment -1) the size of the whole program
          function draw() {  // draw(): redraws the memory map and the stat tiles
            const kids = [];  // kids collects every shape before they are put in the drawing
            regions.forEach((r) => {  // one rectangle per region of the map
              const y = TOP + r.start * KB, hh = r.size * KB, cy = y + hh / 2 + 4.5;  // y: top edge from the region's start; hh: height from its size; cy: the vertical middle for a label
              const cls = r.kind === 'os' ? 's-os' : r.kind === 'other' ? 's-other' : r.kind === 'free' ? 's-free' : (r.seg >= 0 ? 'sg' + r.seg : 's-accent');  // cls: the colour by kind: OS purple, other processes grey, holes dashed, segments in their own colour, a whole program in indigo
              kids.push(s('rect', { x: X0, y, width: BW, height: hh, class: cls, 'stroke-width': r === fresh ? 3.5 : 1.5 }));  // the region's rectangle; the piece placed most recently gets a thick border
              if (r.kind === 'os') kids.push(s('text', { x: X0 + BW / 2, y: cy, 'text-anchor': 'middle', 'font-size': ctx.narrow ? 13 : 14, 'font-weight': 700 }, 'Operating system'));  // the OS region is labelled "Operating system"
              if (r.kind === 'other') kids.push(s('text', { x: X0 + BW / 2, y: cy, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, 'process ' + r.label));  // another process is labelled with its letter, such as "process A", in grey
              if (r.kind === 'free') kids.push(s('text', { x: X0 + BW + 10, y: cy, 'font-size': 13, class: 's-sub' }, `hole · ${r.size} KB`));  // a hole gets a grey label to the right of the column with its size
              if (r.kind === 'piece') {  // a newly placed piece gets two labels
                if (r.size >= 2) kids.push(s('text', { x: X0 + BW / 2, y: cy, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 }, r.seg >= 0 ? 'segment ' + r.seg : 'one partition'));  // inside it, when at least 2 KB tall: "segment 2", or "one partition" for a whole program
                kids.push(s('text', { x: X0 + BW + 10, y: cy, 'font-size': 13, 'font-weight': 700, class: r.seg >= 0 ? 'tx' + r.seg : '' }, `${r.label} · ${r.size} KB`));  // to its right: its name and size, in the segment's colour
              }  // ends the piece labels
            });  // ends the loop over regions
            const marks = new Set(regions.map((r) => r.start)); marks.add(MEM);  // marks: the KB address at every region boundary, plus 32 at the bottom (a Set ignores repeats)
            marks.forEach((b) => kids.push(s('text', { x: X0 - 8, y: TOP + b * KB + 4.5, 'text-anchor': 'end', 'font-size': 13, class: 's-sub s-monot' }, b + ' KB')));  // writes each boundary address, such as "16 KB", to the left of the column
            svg.replaceChildren(...kids);  // replaces the old drawing with the new shapes in one step
            const hs = holes(regions), free = hs.reduce((a, r) => a + r.size, 0), big = Math.max(0, ...hs.map((r) => r.size));  // hs: the holes now; free: their total size; big: the largest hole (Math.max with 0 gives 0 if there are none)
            const stat = (v, l) => h('div', { class: 'stat' }, h('div', { class: 'l', text: l }), h('div', { class: 'v', text: v }));  // stat(v, l): builds one tile with the label l on top and the value v under it
            statBox.replaceChildren(stat(free + ' KB', 'Free memory'), stat(big + ' KB', 'Largest hole'), stat(String(hs.length), 'Holes'), stat('0 KB', 'Internal waste'));  // the four tiles: free memory, largest hole, number of holes, and internal waste, which stays 0 KB because every piece gets exactly its size
          }  // ends draw
          function paintSummary() {  // paintSummary(): rewrites the "New program" row from the slider values
            summary.replaceChildren(h('span', { class: 'b', text: 'New program:' }),  // bold "New program:" label
              ...sizes.map((z, i) => h('span', { class: 'chip c' + i, html: `${SHORT[i]} ${z} KB` })),  // one chip per segment in its own colour, with its short name and size
              h('span', { class: 'b', text: `= ${total()} KB` }));  // the total size in bold; closes the row
          }  // ends paintSummary
          const loadBtn = h('button', { class: 'btn primary', type: 'button', onclick: () => load() }, 'Load the program');  // loadBtn: the main button; a click starts the animated load
          function paintButtons() { loadBtn.disabled = busy || loaded; }  // paintButtons(): greys out Load while a load is running or once the program is in memory
          function intro() {  // intro(): writes the opening message about the starting memory map
            const hs = holes(regions), free = hs.reduce((a, r) => a + r.size, 0);  // the holes now and the total free space
            narrate(msg, `Memory holds the OS and four other processes, leaving ${free} KB free in ${hs.length} holes. Size the new program’s parts, then press <b>Load</b>. The OS uses first-fit: each piece goes into the first hole that is big enough.`, '');  // describes the starting state, invites Load, and states the first-fit rule the OS uses
          }  // ends intro
          function resetMem() { gen++; busy = false; loaded = false; regions = START; fresh = null; draw(); intro(); paintButtons(); }  // resetMem(): returns to the starting map; gen++ makes any animation still running stop at its next check
          async function load() {  // load(): async, so it can pause with await; places the pieces one at a time so the student can follow each step
            if (busy || loaded) return;  // ignores the button while a load runs or once one has finished
            const g = ++gen; busy = true; paintButtons();  // g: this run's number; marks the step busy and greys out Load
            const before = regions, ps = pieces();  // before: the map before loading, kept so a failed load can be undone; ps: the pieces to load
            let regs = regions, done = 0;  // regs: the map as it fills up; done: how many pieces have been placed so far
            for (const p of ps) {  // goes through the pieces in order
              const r = place(regs, p);  // r: the result of trying first-fit for this piece (null if no hole is big enough)
              await ctx.sleep(done ? 750 : 250);  // pauses a quarter second before the first piece and three quarters between pieces
              if (!ctx.alive || g !== gen) return;  // stops quietly if the student left the slide or pressed something that started a new run (gen changed)
              if (!r) {  // the piece did not fit
                const hs = holes(regs), free = hs.reduce((a, x) => a + x.size, 0), big = Math.max(0, ...hs.map((x) => x.size));  // the holes at this moment, their total, and the largest one
                const lead = mode === 'seg' ? `<b>${p.label}</b> needs a ${p.size} KB hole, but the largest hole is only ${big} KB.` : `The whole program needs one hole of ${p.size} KB, but the largest hole is only ${big} KB.`;  // lead: names the failing segment (or the whole program) and compares its size with the largest hole
                narrate(msg, `${lead} ${free} KB is free in total, scattered over ${hs.length} holes: <span class="t">external fragmentation</span>.` + (mode === 'seg' ? '' : ' Switch to <b>Segments</b> and load again.'), 'bad');  // red message: enough memory is free in total but it is scattered: external fragmentation; in one-block mode it suggests Segments
                if (mode === 'seg' && done) {  // if some segments had already been placed before this one failed
                  await ctx.sleep(2200);  // waits 2.2 seconds so the student can read the message
                  if (!ctx.alive || g !== gen) return;  // the same stop check after the pause
                  regions = before; fresh = null; draw();  // puts the map back exactly as it was before the load
                  narrate(msg, 'Simple segmentation needs <b>every</b> segment in memory before the program runs, so the OS hands back the pieces it had placed. It could compact memory (7.2) or wait until another process ends.', 'warn');  // amber message: simple segmentation needs every segment in memory first, so the OS hands the pieces back; it could compact or wait
                }  // ends the undo
                busy = false; paintButtons(); return;  // the run is over: Load works again, and the function stops here
              }  // ends the failure case
              regs = r.regs; regions = regs; fresh = r.piece; done++; draw();  // success: keeps the new map, marks this piece as just placed, counts it and redraws
              const left = r.hole.size - p.size;  // left: the space left over in the hole after this piece
              narrate(msg, `<b>${p.label}</b> (${p.size} KB) goes into the first hole big enough: the ${r.hole.size} KB hole at ${r.hole.start} KB. ` + (left ? `${left} KB is left over as a smaller hole.` : 'It fills that hole exactly.'), '');  // narrates which hole the piece went into and how much was left, or that it filled the hole exactly
            }  // ends the loop over pieces
            await ctx.sleep(900);  // pauses 0.9 seconds after the last piece
            if (!ctx.alive || g !== gen) return;  // the same stop check after the pause
            loaded = true; busy = false; fresh = null; draw(); paintButtons();  // marks the program as loaded, clears the highlight, redraws and keeps Load greyed out
            const hs = holes(regions), free = hs.reduce((a, x) => a + x.size, 0), big = Math.max(0, ...hs.map((x) => x.size));  // the holes after loading, their total and the largest one
            const was = Math.max(...holes(START).map((x) => x.size));  // was: the largest hole before loading (6 KB)
            const used = new Set(regions.filter((x) => x.kind === 'piece').map((x) => START.findIndex((o) => o.kind === 'free' && x.start >= o.start && x.start < o.start + o.size)));  // used: which of the original holes received pieces (for each piece, the starting hole whose range contains it)
            const spread = used.size > 1 ? `spread over ${used.size} different holes: one program’s segments need not sit next to each other` : 'side by side in one hole this time, but each could have gone into any hole big enough';  // spread: wording for pieces spread over several holes, or for pieces that happened to land side by side in one
            narrate(msg, mode === 'seg'  // the closing message, which depends on the mode
              ? `All four segments are in, ${spread}. Each piece got exactly its size, so nothing is wasted inside it. But the ${free} KB still free is split into ${hs.length} holes (largest ${big} KB): <span class="t">external fragmentation</span> remains.` + (total() > was ? ` As one block, this ${total()} KB program would not have fit at all: the largest hole was ${was} KB.` : '')  // segments: all in, no internal waste, but external fragmentation remains; adds that one block would not have fit when that is true
              : `The whole ${total()} KB program fits in one hole: that is dynamic partitioning. Now ${free} KB is free in ${hs.length} holes (largest ${big} KB).`, 'ok');  // one block: the whole program fits in one hole, which is dynamic partitioning, and gives the free memory left
          }  // ends load
          const sliders = FULL.map((nm, i) => ctx.ui.slider({ label: `${i} · ${nm}`, min: 1, max: 4, value: sizes[i], format: (v) => v + ' KB', onInput: (v) => { sizes[i] = v; paintSummary(); resetMem(); } }));  // sliders: one per segment, 1 to 4 KB (the maximum segment length here); a change refreshes the summary and resets memory
          const modeSeg = ctx.ui.seg([{ value: 'seg', label: 'Segments' }, { value: 'one', label: 'One block (dynamic partitioning)' }], mode, (v) => { mode = v; resetMem(); });  // modeSeg: switch between loading as segments or as one block; a change resets memory
          const big4 = h('button', { class: 'btn', type: 'button', onclick: () => { sizes = [4, 4, 4, 4]; sliders.forEach((sl) => sl.set(4)); paintSummary(); resetMem(); } }, 'Try 4 + 4 + 4 + 4');  // button that sets all four segments to 4 KB, moves the sliders to match and resets: a case where the fourth segment finds no hole
          const resetBtn = h('button', { class: 'btn', type: 'button', onclick: () => resetMem() }, 'Reset memory');  // button that puts memory back to its starting state
          paintSummary(); resetMem();  // fills in the summary row and the starting map as the step opens
          el.append(h('div', { class: 'split r fill' },  // lays out the step: two columns, the right one smaller (split r), filling the step's height
            h('div', { class: 'stack' },  // left column: the controls and messages
              h('p', { class: 'm0', html: 'Each segment needs its own <span class="t">hole</span>, much as a whole process does under <span class="t">dynamic partitioning</span>. The difference: a program’s segments may land in holes far apart. Sizes stop at 4 KB, the maximum segment length here.' }),  // paragraph: each segment needs its own hole as in dynamic partitioning, but they may be far apart; sizes stop at 4 KB
              h('div', { class: 'row' }, h('span', { class: 'small b', text: 'Load as:' }), modeSeg),  // row with the "Load as:" label and the mode switch
              h('div', { class: 'grid-2', style: { gap: '8px 18px' } }, ...sliders),  // the four size sliders in a two-column grid
              summary,  // the summary row of the new program's parts
              h('div', { class: 'row' }, loadBtn, resetBtn, big4),  // row of buttons: Load, Reset memory and the 4 + 4 + 4 + 4 example
              statBox, msg),  // the stat tiles and the narration box; closes the left column
            h('div', { class: 'card white', style: { padding: '4px 8px', display: 'grid', placeItems: 'center' } }, svg)));  // right column: a white card that centres the memory map; closes the layout
        },  // ends render for step 3
      },  // closes step 3
      /* ---------------- 4. Translator: segment table, length check, base + offset ---------------- */
      {  // opens step 4, the translator: segment table, length check, base plus offset
        title: 'Translating an address: look up, check, add',  // step title shown at the top of the screen
        kind: 'lab',  // kind lab: labelled Hands-on Lab above the title
        core: true,  // core: true keeps this step on the shorter core path
        render(el, ctx) {  // render(el, ctx): builds step 4 when the student opens it
          const { h, s } = ctx;  // takes h (HTML builder) and s (SVG builder) out of ctx
          const MEMB = 40960, MX0 = 20, MX1 = 640, mx = (a) => MX0 + (a / MEMB) * (MX1 - MX0);  // MEMB: the 40,960 bytes of physical memory drawn; MX0 and MX1: the ends of the memory bar; mx(a): the x position of address a
          const ROW0 = 118, RH = 30, rowY = (i) => ROW0 + i * RH + RH / 2;  // ROW0: the y where the segment table rows start; RH: row height; rowY(i): the vertical middle of row i
          let seg = 2, off = 500;  // seg and off: the address picked with the sliders, starting at (2, 500)
          const slim = ctx.narrow;  // slim: true on phone-width screens, where a taller version of the picture is drawn
          const svg = s('svg', { viewBox: slim ? '0 0 360 438' : '0 0 660 346', width: '100%', role: 'img', 'aria-label': 'Address translation hardware' });  // the drawing: 660 by 346 on desktop, 360 by 438 on small screens
          const addrLine = h('div', { class: 'card tight small' });  // addrLine: the card under the sliders showing the chosen address in binary, in hex and as a pair
          const T = (x, y, txt, a = {}) => s('text', Object.assign({ x, y, 'font-size': 14 }, a), txt);  // T(x, y, txt, a): shortcut for a 14px text label in the drawing; a adds or overrides settings
          function frames(r) { return r.ok ? 5 : r.why === 'noseg' ? 3 : 4; }  // frames(r): how many animation frames: 5 for a valid address, 3 when the segment does not exist, 4 when the length check fails
          function draw(i, r) {  // draw(i, r): draws frame i of the desktop picture for the translation result r
            const bits = bin(r.addr, 16), kids = [];  // bits: the address as 16 binary digits; kids collects the shapes
            const split = i >= 1, look = i >= 2 && r.seg < P_TABLE.length, chk = i >= 3 && r.e, add = i >= 4 && r.ok;  // which stages frame i has reached: split (1), table lookup (2, only if the entry exists), length check (3), addition (4, only if valid)
            const trap = (r.why === 'noseg' && i >= 2) || (r.why === 'len' && i >= 3);  // trap: true from the frame where translation fails: frame 2 for a missing segment, frame 3 for a failed length check
            kids.push(T(70, 24, split ? 'segment number = ' + r.seg : 'segment number', { 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, class: split ? 'tx-sgn' : 's-sub' }),  // label over the left box: "segment number", plus its value in indigo once the bits are split
              T(262, 24, split ? 'offset = ' + nf(r.off) : 'offset', { 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, class: split ? 'tx-off' : 's-sub' }),  // label over the right box: "offset", plus its value in teal once split
              s('rect', { x: 20, y: 32, width: 100, height: 36, rx: 7, class: split ? 's-accent' : 's-panel', 'stroke-width': 2 }),  // the left box for the 4 segment-number bits: indigo once split, neutral before
              s('rect', { x: 124, y: 32, width: 276, height: 36, rx: 7, class: split ? 's-proc' : 's-panel', 'stroke-width': 2 }),  // the right box for the 12 offset bits: teal once split, neutral before
              T(70, 56, bits.slice(0, 4), { 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 700, class: 's-monot' }),  // the 4 segment-number bits inside the left box
              T(262, 56, bits.slice(4), { 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 700, class: 's-monot' }));  // the 12 offset bits inside the right box; closes the push
            kids.push(T(40, 104, 'Segment table of process P', { 'font-size': 13, 'font-weight': 700, class: 's-sub' }),  // heading over the segment table
              s('rect', { x: 40, y: ROW0 - 4, width: 290, height: P_TABLE.length * RH + 8, rx: 8, class: 's-panel', 'stroke-width': 1.5 }));  // the table's background panel, tall enough for every row
            P_TABLE.forEach((e, k) => {  // one row per segment of P
              const y = ROW0 + k * RH, on = look && k === r.seg;  // y: the top of row k; on: whether this is the row being looked up
              kids.push(s('rect', { x: 44, y: y + 1, width: 282, height: RH - 2, rx: 5, class: on ? 's-accent' : 'sg' + k, style: on ? '' : 'opacity:.55', 'stroke-width': on ? 2.5 : 1 }),  // row background: indigo when it is looked up, otherwise the segment's own colour faded to 55%
                T(62, y + 20, String(k), { 'text-anchor': 'middle', 'font-weight': 800, class: 'tx' + k }),  // the segment number at the start of the row, in its colour
                T(84, y + 20, 'base ' + nf(e.base), { 'font-size': 13.5, class: 's-monot' }),  // the segment's base address in the fixed-width font
                T(212, y + 20, 'length ' + nf(e.len), { 'font-size': 13.5, class: 's-monot' }));  // the segment's length; the brackets close the row's push
            });  // ends the loop over table rows
            if (i >= 2) {  // from frame 2 on, the lookup arrow is drawn
              const ty = r.seg < P_TABLE.length ? rowY(r.seg) : ROW0 + P_TABLE.length * RH + 14;  // ty: where the arrow points: the middle of the row looked up, or just below the table when no such entry exists
              kids.push(s('path', { d: `M30,68 V${ty} H40`, class: 's-line', style: 'stroke:var(--sgn)', 'marker-end': 'url(#arr-accent)' }));  // indigo arrow from the segment-number box down the left side into the table (in path data M moves, V draws down, H draws across)
              if (r.seg >= P_TABLE.length) kids.push(T(48, ty + 5, `no entry ${r.seg} (table length ${P_TABLE.length})`, { 'font-size': 13.5, 'font-weight': 700, class: 'tx-bad' }));  // if the entry is missing, a red note such as "no entry 6 (table length 4)" appears where its row would be
            }  // ends the lookup arrow
            kids.push(s('rect', { x: 410, y: 96, width: 230, height: 58, rx: 10, class: chk ? (r.ok ? 's-ok' : 's-bad') : 's-panel', 'stroke-width': 2 }),  // the length-check box: green if the check passed, red if it failed, neutral before frame 3
              T(525, 116, 'Length check: offset < length ?', { 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 }),  // its heading, stating the test: offset < length
              T(525, 142, chk ? `${nf(r.off)} < ${nf(r.e.len)} ? ${r.ok ? 'yes ✓' : 'no ✗'}` : '…', { 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800, class: chk ? (r.ok ? 'tx-ok' : 'tx-bad') : 's-sub' }));  // the comparison with real numbers and yes or no once it is reached, or three dots before; green or red to match
            kids.push(s('rect', { x: 410, y: 176, width: 230, height: 58, rx: 10, class: add ? 's-ok' : 's-panel', 'stroke-width': 2 }),  // the adder box: green once the addition has happened, neutral before
              T(525, 196, 'Adder: base + offset', { 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 }),  // its heading: Adder, base + offset
              T(525, 222, add ? `${nf(r.e.base)} + ${nf(r.off)} = ${nf(r.phys)}` : '…', { 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800, class: add ? 'tx-ok' : 's-sub' }));  // the sum with real numbers once it is reached, or three dots before
            if (split) kids.push(s('path', { d: 'M400,50 H525 V94', class: 's-line', style: 'stroke:var(--off)', 'marker-end': 'url(#arr-proc)' }));  // once the bits are split, a teal arrow carries the offset across to the length check
            if (look) {  // once the entry is found, arrows carry its length and base to the two boxes
              const y = rowY(r.seg);  // y: the middle of the row being looked up
              kids.push(s('path', { d: `M330,${y} H370 V125 H408`, class: 's-line', 'marker-end': 'url(#arr)' }),  // arrow from that row to the length-check box, carrying the length
                s('path', { d: `M370,${y} V205 H408`, class: 's-line', 'marker-end': 'url(#arr)' }),  // a branch down to the adder box, carrying the base
                T(366, 252, 'length, base', { 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }));  // small grey label naming what the two arrows carry; closes the push
            }  // ends the lookup arrows
            if (add) kids.push(s('path', { d: 'M560,154 V174', class: 's-line', style: 'stroke:var(--ok)', 'marker-end': 'url(#arr-ok)' }));  // once the check passes, a short green arrow from the check box down into the adder: the addition may go ahead
            kids.push(T(20, 284, 'Physical memory, addresses 0 to 40,959', { 'font-size': 13, 'font-weight': 700, class: 's-sub' }),  // heading for the physical memory bar
              s('rect', { x: MX0, y: 292, width: MX1 - MX0, height: 26, rx: 4, class: 's-panel', 'stroke-width': 1 }));  // the empty memory bar itself; closes the push
            P_TABLE.forEach((e, k) => kids.push(s('rect', { x: mx(e.base), y: 292, width: mx(e.base + e.len) - mx(e.base), height: 26, class: 'sg' + k, 'stroke-width': 1.5 }),  // each segment of P drawn at its true place in physical memory, in its colour, scaled with mx
              T((mx(e.base) + mx(e.base + e.len)) / 2, 310, String(k), { 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800 })));  // the segment's number in the middle of its block; closes the push and the loop
            if (add) {  // once the addition is done
              const x = mx(r.phys);  // x: where the resulting physical address falls on the memory bar
              kids.push(s('path', { d: `M525,234 V266 H${x} V290`, class: 's-line', style: 'stroke:var(--ok)', 'marker-end': 'url(#arr-ok)' }),  // green arrow from the adder down and across to that spot in memory
                T(x, 338, nf(r.phys), { 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 800, class: 'tx-ok' }));  // the physical address written under the bar in green; closes the push
            }  // ends the result arrow
            if (trap) kids.push(s('rect', { x: 410, y: 176, width: 230, height: 58, rx: 10, class: 's-intr', 'stroke-width': 2.5 }),  // on a trap, a red box covers the adder, since the addition never happens
              T(525, 198, 'TRAP to the OS', { 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800, class: 'tx-bad' }),  // the words "TRAP to the OS"
              T(525, 220, r.why === 'noseg' ? 'no such segment' : 'offset outside the segment', { 'text-anchor': 'middle', 'font-size': 13.5 }));  // the reason: no such segment, or an offset outside the segment
            svg.replaceChildren(...kids);  // replaces the old drawing with the new shapes in one step
          }  // ends draw
          /* The same picture for small screens: address, table, then check and adder side by side, memory last. */
          function drawSlim(i, r) {  // drawSlim(i, r): the same frame i drawn for phone-width screens, with everything stacked top to bottom
            const bits = bin(r.addr, 16), kids = [];  // bits: the address as 16 binary digits; kids collects the shapes
            const split = i >= 1, look = i >= 2 && r.seg < P_TABLE.length, chk = i >= 3 && r.e, add = i >= 4 && r.ok;  // the same stage flags as draw: split, lookup, check and addition
            const trap = (r.why === 'noseg' && i >= 2) || (r.why === 'len' && i >= 3);  // the same trap test as draw
            const sx = (a) => 10 + (a / MEMB) * 340, TB = ROW0 + P_TABLE.length * RH + 4, BY = 268, BH = 66, MB = 368;  // sx(a): x of address a on the 340px memory bar; TB: just below the table; BY, BH: top and height of the two boxes; MB: the memory bar's y
            kids.push(T(10, 24, split ? 'segment number = ' + r.seg : 'segment number', { 'font-size': 13, 'font-weight': 700, class: split ? 'tx-sgn' : 's-sub' }),  // label over the left box: "segment number", plus its value once split (left-aligned here)
              T(220, 24, split ? 'offset = ' + nf(r.off) : 'offset', { 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, class: split ? 'tx-off' : 's-sub' }),  // label over the right box: "offset", plus its value once split
              s('rect', { x: 10, y: 32, width: 76, height: 36, rx: 7, class: split ? 's-accent' : 's-panel', 'stroke-width': 2 }),  // left box for the segment-number bits, slimmer than on desktop
              s('rect', { x: 90, y: 32, width: 260, height: 36, rx: 7, class: split ? 's-proc' : 's-panel', 'stroke-width': 2 }),  // right box for the offset bits
              T(48, 56, bits.slice(0, 4), { 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 700, class: 's-monot' }),  // the 4 segment-number bits
              T(220, 56, bits.slice(4), { 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 700, class: 's-monot' }));  // the 12 offset bits; closes the push
            kids.push(T(24, 104, 'Segment table of process P', { 'font-size': 13, 'font-weight': 700, class: 's-sub' }),  // heading over the segment table
              s('rect', { x: 24, y: ROW0 - 4, width: 306, height: P_TABLE.length * RH + 8, rx: 8, class: 's-panel', 'stroke-width': 1.5 }));  // the table's background panel
            P_TABLE.forEach((e, k) => {  // one row per segment of P
              const y = ROW0 + k * RH, on = look && k === r.seg;  // y: the top of row k; on: whether this row is being looked up
              kids.push(s('rect', { x: 28, y: y + 1, width: 298, height: RH - 2, rx: 5, class: on ? 's-accent' : 'sg' + k, style: on ? '' : 'opacity:.55', 'stroke-width': on ? 2.5 : 1 }),  // row background: indigo when looked up, otherwise the faded segment colour
                T(44, y + 20, String(k), { 'text-anchor': 'middle', 'font-weight': 800, class: 'tx' + k }),  // the segment number in its colour
                T(62, y + 20, 'base ' + nf(e.base), { 'font-size': 13.5, class: 's-monot' }),  // the base address
                T(196, y + 20, 'length ' + nf(e.len), { 'font-size': 13.5, class: 's-monot' }));  // the length; closes the push
            });  // ends the loop over rows
            if (i >= 2) {  // from frame 2 on, the lookup arrow
              const ty = r.seg < P_TABLE.length ? rowY(r.seg) : TB + 12;  // ty: the row's middle, or just under the table when the entry does not exist
              kids.push(s('path', { d: `M16,68 V${ty} H26`, class: 's-line', style: 'stroke:var(--sgn)', 'marker-end': 'url(#arr-accent)' }));  // indigo arrow down the left edge from the address into the table
              if (r.seg >= P_TABLE.length) kids.push(T(32, ty + 5, `no entry ${r.seg} (table length ${P_TABLE.length})`, { 'font-size': 13.5, 'font-weight': 700, class: 'tx-bad' }));  // red "no entry" note when the segment number is past the end of the table
            }  // ends the lookup arrow
            kids.push(s('rect', { x: 10, y: BY, width: 166, height: BH, rx: 10, class: chk ? (r.ok ? 's-ok' : 's-bad') : 's-panel', 'stroke-width': 2 }),  // the length-check box at the lower left, coloured as on desktop
              T(93, BY + 18, 'Length check', { 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 }),  // its heading, "Length check"
              T(93, BY + 34, 'offset < length ?', { 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }),  // the test itself on its own grey line
              T(93, BY + 56, chk ? `${nf(r.off)} < ${nf(r.e.len)} ${r.ok ? '✓' : '✗'}` : '…', { 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800, class: chk ? (r.ok ? 'tx-ok' : 'tx-bad') : 's-sub' }));  // the numbers with a tick or a cross once reached, or three dots before
            kids.push(s('rect', { x: 184, y: BY, width: 166, height: BH, rx: 10, class: add ? 's-ok' : 's-panel', 'stroke-width': 2 }),  // the adder box at the lower right
              T(267, BY + 18, 'Adder', { 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 }),  // its heading, "Adder"
              T(267, BY + 34, add ? `${nf(r.e.base)} + ${nf(r.off)}` : 'base + offset', { 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }),  // the two numbers being added once reached, otherwise the rule "base + offset"
              T(267, BY + 56, add ? '= ' + nf(r.phys) : '…', { 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800, class: add ? 'tx-ok' : 's-sub' }));  // the result, such as "= 31,000", once reached
            if (split) kids.push(s('path', { d: `M342,68 V${BY - 2}`, class: 's-line', style: 'stroke:var(--off)', 'marker-end': 'url(#arr-proc)' }));  // once split, a teal arrow carries the offset down the right edge to the adder box
            if (look) kids.push(s('path', { d: `M93,${TB} V${BY - 2}`, class: 's-line', 'marker-end': 'url(#arr)' }),  // once the entry is found, an arrow from the table down to the length check (the length)
              s('path', { d: `M267,${TB} V${BY - 2}`, class: 's-line', 'marker-end': 'url(#arr)' }),  // and a second arrow down to the adder (the base)
              T(100, TB + 17, 'length', { 'font-size': 13, class: 's-sub' }), T(274, TB + 17, 'base', { 'font-size': 13, class: 's-sub' }));  // small grey labels "length" and "base" beside the two arrows; closes the push
            kids.push(s('rect', { x: 10, y: MB, width: 340, height: 26, rx: 4, class: 's-panel', 'stroke-width': 1 }),  // the empty memory bar
              T(10, 430, 'Physical memory, addresses 0 to 40,959', { 'font-size': 13, 'font-weight': 700, class: 's-sub' }));  // heading for the memory bar, placed beneath it on small screens; closes the push
            P_TABLE.forEach((e, k) => kids.push(s('rect', { x: sx(e.base), y: MB, width: sx(e.base + e.len) - sx(e.base), height: 26, class: 'sg' + k, 'stroke-width': 1.5 }),  // each segment of P drawn at its place in memory, scaled with sx
              T((sx(e.base) + sx(e.base + e.len)) / 2, MB + 18, String(k), { 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800 })));  // the segment's number in its block; closes the push and the loop
            if (add) {  // once the addition is done
              const x = sx(r.phys);  // x: where the physical address falls on the bar
              kids.push(s('path', { d: `M267,${BY + BH} V${MB - 14} H${x} V${MB - 2}`, class: 's-line', style: 'stroke:var(--ok)', 'marker-end': 'url(#arr-ok)' }),  // green arrow from the bottom of the adder down and across to that spot
                T(x, MB + 44, nf(r.phys), { 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 800, class: 'tx-ok' }));  // the physical address written under the bar in green; closes the push
            }  // ends the result arrow
            if (trap) kids.push(s('rect', { x: 184, y: BY, width: 166, height: BH, rx: 10, class: 's-intr', 'stroke-width': 2.5 }),  // on a trap, a red box covers the adder
              T(267, BY + 28, 'TRAP to the OS', { 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800, class: 'tx-bad' }),  // the words "TRAP to the OS"
              T(267, BY + 50, r.why === 'noseg' ? 'no such segment' : 'offset ≥ length', { 'text-anchor': 'middle', 'font-size': 13.5 }));  // the reason: no such segment, or an offset at or past the length
            svg.replaceChildren(...kids);  // replaces the old drawing with the new shapes in one step
          }  // ends drawSlim
          function caption(i, r) {  // caption(i, r): the explanation shown under the picture for frame i; the player puts the returned text in its caption box
            const fault = ' This is a <span class="t">segmentation fault</span>: on UNIX-like systems the OS normally ends the process with the signal SIGSEGV, short for “segmentation violation”.';  // fault: a sentence added to both trap captions, naming the segmentation fault and the SIGSEGV signal on UNIX-like systems
            if (i === 0) return `The program uses logical address <b>${hex(r.addr)}</b>. On its own, this number says nothing about where the byte really is in memory.`;  // frame 0 caption: the logical address in hex says nothing yet about where the byte really is
            if (i === 1) return `The hardware splits the 16 bits: the leftmost 4 are the <b>segment number ${r.seg}</b>, the rightmost 12 are the <b>offset ${nf(r.off)}</b>.`;  // frame 1 caption: the hardware splits the bits into the segment number and the offset
            if (i === 2) return r.seg < P_TABLE.length  // frame 2 caption depends on whether the table has that entry
              ? `Segment number ${r.seg} indexes the segment table. Entry ${r.seg} (${P_TABLE[r.seg].name.toLowerCase()}) says: <b>base ${nf(r.e.base)}</b>, <b>length ${nf(r.e.len)}</b>.`  // entry found: it supplies the base and the length
              : `Process P has only ${P_TABLE.length} segments (0 to ${P_TABLE.length - 1}). There is no entry ${r.seg}, so the hardware raises a <b>trap</b>.` + fault;  // no entry: P has only four segments, so the hardware traps, followed by the fault sentence
            if (i === 3) return r.ok  // frame 3 caption depends on the length check
              ? `Length check: offset ${nf(r.off)} is less than the length ${nf(r.e.len)}, so the address lies inside the segment. Valid.`  // check passes: the offset is less than the length, so the address is valid
              : `Length check fails: offset ${nf(r.off)} is not less than the length ${nf(r.e.len)} (valid offsets are 0 to ${nf(r.e.len - 1)}). The hardware raises a <b>trap</b>.` + fault;  // check fails: valid offsets stop at length minus 1, so the hardware traps, followed by the fault sentence
            return `Physical address = base + offset = ${nf(r.e.base)} + ${nf(r.off)} = <b>${nf(r.phys)}</b>. A real addition, not a bit splice: a segment may start at any address.`;  // frame 4 caption: physical address = base + offset, a real addition because a segment may start at any address
          }  // ends caption
          let r = translate(P_TABLE, mkAddr(seg, off));  // r: the translation result for the chosen address, starting with (2, 500); let because it changes when a slider moves
          const player = ctx.ui.player({ count: frames(r), render: (i) => { (slim ? drawSlim : draw)(i, r); return caption(i, r); }, interval: 1800 });  // player: the animation player (Restart, Previous, Play, Next); each frame is drawn with the desktop or small-screen picture and its caption is returned; 1.8 s per frame
          function changed() {  // changed(): runs whenever the chosen address changes
            r = translate(P_TABLE, mkAddr(seg, off));  // recomputes the translation for the new address
            const bits = bin(r.addr, 16);  // bits: the new address as 16 binary digits
            addrLine.innerHTML = `Logical address <span class="mono b c-sgn">${bits.slice(0, 4)}</span> <span class="mono b c-off">${bits.slice(4)}</span> = ${hex(r.addr)} = <b>(${r.seg}, ${nf(r.off)})</b>`;  // fills the address card: the 4 segment bits in indigo, the 12 offset bits in teal, then the hex value and the (segment, offset) pair
            player.setCount(frames(r));  // tells the player the new number of frames, which also sends it back to frame 0
          }  // ends changed
          const sSeg = ctx.ui.slider({ label: 'Segment number', min: 0, max: 15, value: seg, onInput: (v) => { seg = v; changed(); } });  // slider for the segment number, 0 to 15: everything 4 bits can hold, so numbers past P's last segment can be tried
          const sOff = ctx.ui.slider({ label: 'Offset', min: 0, max: MAX_SEG - 1, value: off, format: (v) => nf(v), onInput: (v) => { off = v; changed(); } });  // slider for the offset, 0 to 4,095, with the readout written with commas
          const preset = (label, a, b) => h('button', { class: 'btn sm', type: 'button', onclick: () => { seg = a; off = b; sSeg.set(a); sOff.set(b); changed(); player.play(); } }, label);  // preset(label, a, b): an example button that moves both sliders to (a, b) and starts the animation playing
          changed();  // fills in the address card once as the step opens
          el.append(h('div', { class: 'split l fill' },  // lays out the step: two columns, the left one smaller, filling the step's height
            h('div', { class: 'stack' },  // left column: explanation and controls
              h('p', { class: 'm0', html: 'Paging can simply glue a frame number onto the offset bits. Segments start anywhere and differ in length, so the hardware must <b>look up</b>, <b>check</b> and <b>add</b>.' }),  // paragraph: paging can glue bits together, but segments differ in start and length, so the hardware must look up, check and add
              h('p', { class: 'm0 small', html: 'Each process has a <span class="t">segment table</span>. Entry <i>i</i> holds segment <i>i</i>’s <span class="t" data-t="segment base">base</span> (where it starts in physical memory) and its <span class="t" data-t="segment length">length</span>. Separately, the OS keeps a <span class="t">free-block list</span> of holes to use when it places segments.' }),  // paragraph: what a segment table entry holds, with dotted terms whose data-t names the glossary entry, and the free-block list
              sSeg, sOff, addrLine,  // the two sliders and the address card
              h('div', { class: 'row', style: { gap: '6px' } }, h('span', { class: 'small b', text: 'Try:' }),  // row of example buttons, starting with a "Try:" label
                preset('(2, 500) valid', 2, 500), preset('(1, 1,200) too far', 1, 1200), preset('(3, 1,100) edge', 3, 1100), preset('(6, 100) no segment', 6, 100)),  // four examples: a valid address, an offset past the end, the 1,100 edge case on the stack, and the missing segment 6; closes the row
              h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'Letting offset equal the length through. The 1,100-byte stack has offsets 0 to 1,099, so offset 1,100 is already outside it. The test is offset <b>&lt;</b> length.' })),  // "Common mistake" callout: an offset equal to the length is already outside, because the test is strictly less than; closes the column
            h('div', { class: 'stack' }, h('div', { class: 'card white', style: { padding: '6px 10px' } }, svg), player.el)));  // right column: the drawing in a white card, with the player under it; closes the layout
        },  // ends render for step 4
      },  // closes step 4
      /* ---------------- 5. Predict: the student plays the translation hardware ---------------- */
      {  // opens step 5, where the student plays the translation hardware
        title: 'You are the hardware: translate it, or trap',  // step title shown at the top of the screen
        kind: 'predict',  // kind predict: labelled Predict above the title
        render(el, ctx) {  // render(el, ctx): builds step 5 when the student opens it
          const { h } = ctx;  // takes the HTML builder h out of ctx
          const Q = [  // Q: the segment table of a second process, Q, so answers cannot be copied from the P example in step 4
            { name: 'Code', base: 4800, len: 1200 },  // Q's segment 0: code, 1,200 bytes starting at 4,800
            { name: 'Data', base: 12000, len: 2048 },  // Q's segment 1: data, 2,048 bytes at 12,000
            { name: 'Library', base: 7300, len: 500 },  // Q's segment 2: a library, only 500 bytes long, at 7,300
            { name: 'Stack', base: 20480, len: 4000 },  // Q's segment 3: the stack, 4,000 bytes at 20,480
          ];  // closes Q
          const ROUNDS = [[1, 300], [0, 1200], [3, 3999], [2, 612], [5, 10], [2, 499]].map(([a, b]) => translate(Q, mkAddr(a, b)));  // ROUNDS: six test addresses, each translated in advance: three valid, an offset equal to the length, one past the end, and a missing segment
          let k = 0, answered = false, score = 0, hist = [];  // k: the current round; answered: whether it has been answered; score: correct answers; hist: right or wrong for each answered round
          const tbl = h('table', { class: 'tbl compact' });  // tbl: Q's segment table, shown on the right
          const roundHead = h('div', { class: 'row', style: { justifyContent: 'space-between' } });  // roundHead: a row with "Address 2 of 6" at the left and the score at the right
          const addrBox = h('div', { class: 'stack', style: { gap: '2px', flex: 'none' } });  // addrBox: the address in large hex with its bits underneath
          const decodeBox = h('div');  // decodeBox: holds the "Decode it for me" button
          const input = h('input', { type: 'text', inputmode: 'numeric', 'aria-label': 'Physical address', placeholder: 'e.g. 12,345', style: { width: '150px', height: '36px', padding: '0 10px', borderRadius: '10px', border: '1px solid var(--line-2)', background: 'var(--panel)', color: 'var(--ink)', font: '600 16px var(--mono)' } });  // input: the box for the physical address; inputmode numeric brings up a number keypad on phones; styled to match the buttons
          const fb = h('div', { class: 'narr' });  // fb: the feedback box
          const histBox = h('div', { class: 'row', style: { gap: '6px' } });  // histBox: a row of small chips, one per round
          const checkBtn = h('button', { class: 'btn primary', type: 'button', onclick: () => answer('num') }, 'Check');  // Check button: grades the typed number
          const trapBtn = h('button', { class: 'btn intr', type: 'button', onclick: () => answer('trap') }, 'Trap!');  // Trap! button, outlined in red: answers that the hardware would refuse this address
          const nextBtn = h('button', { class: 'btn', type: 'button', onclick: () => { if (k < ROUNDS.length - 1) { k++; answered = false; paint(); } } }, 'Next address');  // Next address button: moves to the following round, if there is one
          const againBtn = h('button', { class: 'btn ghost', type: 'button', onclick: () => { k = 0; answered = false; score = 0; hist = []; paint(); } }, 'Start over');  // Start over button: goes back to round 1 and clears the score and history
          ctx.on(input, 'keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); answer('num'); } });  // pressing Enter in the answer box does the same as Check
          function paintTable(hi) {  // paintTable(hi): redraws Q's table with row hi lit up (-1 lights none)
            tbl.innerHTML = '<thead><tr><th>Seg</th><th>Holds</th><th>Base</th><th>Length</th></tr></thead><tbody>' +  // the table's header row
              Q.map((e, i) => `<tr class="${i === hi ? 'on' : ''}"><td class="b">${i}</td><td>${e.name}</td><td class="mono">${nf(e.base)}</td><td class="mono">${nf(e.len)}</td></tr>`).join('') + '</tbody>';  // one row per entry, with the on class on the lit row; the header and rows are joined into one string
          }  // ends paintTable
          function paint() {  // paint(): redraws the whole exercise for the current round
            const r = ROUNDS[k], bits = bin(r.addr, 16);  // r: this round's prepared result; bits: its address in binary
            roundHead.replaceChildren(h('span', { class: 'b', text: `Address ${k + 1} of ${ROUNDS.length}` }), h('span', { class: 'chip ok', text: `score ${score} / ${hist.length}` }));  // round counter and a score chip such as "score 2 / 3"
            addrBox.innerHTML = `<div class="big mono">${hex(r.addr)}</div><div class="mono small"><span class="c-sgn b">${bits.slice(0, 4)}</span> <span class="c-off b">${bits.slice(4)}</span></div>`;  // the address in large hex, with its segment bits in indigo and offset bits in teal underneath
            decodeBox.replaceChildren(ctx.ui.reveal('Decode it for me', `<span class="small">Segment number <b class="c-sgn">${r.seg}</b>, offset <b class="c-off">${nf(r.off)}</b>.</span>`));  // a fresh reveal button that shows the segment number and offset, for students who want help with the split
            if (!answered) input.value = ''; input.disabled = answered; checkBtn.disabled = answered; trapBtn.disabled = answered;  // before an answer: empties the box; after one: disables the box, Check and Trap! so the answer cannot be changed
            nextBtn.disabled = !answered || k >= ROUNDS.length - 1;  // Next works only after answering, and not on the last round
            if (!answered) narrate(fb, 'Type the physical address and press <b>Check</b>, or press <b>Trap!</b> if the hardware would refuse this address.', '');  // before an answer: neutral instructions in the feedback box
            paintTable(answered && r.seg < Q.length ? r.seg : -1);  // after an answer, lights the table row that the address uses (none when that segment does not exist)
            histBox.replaceChildren(h('span', { class: 'small b', text: 'Your answers:' }),  // history row, starting with a "Your answers:" label
              ...ROUNDS.map((x, i) => h('span', { class: 'chip ' + (i < hist.length ? (hist[i] ? 'ok' : 'bad') : ''), text: `${i + 1} ${i < hist.length ? (hist[i] ? '✓' : '✗') : '·'}` })));  // one chip per round: a green tick if right, a red cross if wrong, a dot if not yet answered; closes the row
          }  // ends paint
          function explain(r) {  // explain(r): the worked answer for one round
            if (r.why === 'noseg') return `Q has segments 0 to ${Q.length - 1} only, so segment ${r.seg} does not exist: <b>trap</b>.`;  // missing segment: Q only has segments 0 to 3, so the hardware traps
            if (r.why === 'len') return `Entry ${r.seg} has length ${nf(r.e.len)}, so valid offsets are 0 to ${nf(r.e.len - 1)}. Offset ${nf(r.off)} is outside: <b>trap</b>.`;  // failed length check: lists the valid offsets and shows this one is outside, so the hardware traps
            return `Entry ${r.seg}: base ${nf(r.e.base)}, length ${nf(r.e.len)}. Offset ${nf(r.off)} &lt; ${nf(r.e.len)}, so it is valid: ${nf(r.e.base)} + ${nf(r.off)} = <b>${nf(r.phys)}</b>.`;  // valid: the entry's base and length, the passing check, and the addition that gives the answer
          }  // ends explain
          function answer(kind) {  // answer(kind): grades the round; kind is 'trap' for the Trap! button or 'num' for a typed address
            if (answered) return;  // ignores a second answer to the same round
            const r = ROUNDS[k];  // r: this round's prepared result
            let right, tip = '';  // right: whether the answer is correct; tip: an extra hint for a common slip
            if (kind === 'trap') right = !r.ok;  // Trap! is right exactly when the address really fails a check
            else {  // otherwise a number was typed
              const v = parseInt(String(input.value).replace(/[\s,_]/g, ''), 10);  // v: the typed text with spaces, commas and underscores removed, read as a whole number in base 10
              if (!Number.isFinite(v)) { narrate(fb, 'Type a whole number first (commas are fine), or press <b>Trap!</b>.', 'warn'); return; }  // no number at all: an amber reminder, and the round stays open
              right = r.ok && v === r.phys;  // a number is right only if the address is valid and the number equals base + offset
              if (!right && r.ok && v === r.off) tip = ' You gave the offset alone; the base still has to be added.';  // hint: the student typed the offset alone and forgot to add the base
              else if (!right && r.ok) { const j = Q.findIndex((e) => e.base + r.off === v); if (j >= 0 && j !== r.seg) tip = ` You used entry ${j}; the segment number is ${r.seg}.`; }  // hint: the number matches the offset added to a different entry's base, so the wrong row was used
              else if (!r.ok) tip = ' A number was not possible here.';  // hint: this address traps, so no number could have been right
            }  // ends the typed-number case
            answered = true; hist.push(right); if (right) score++;  // marks the round answered, records the result and adds to the score if right
            paint();  // redraws, which locks the answer, lights the table row and updates the chips
            narrate(fb, (right ? '<b>Correct.</b> ' : '<b>Not this time.</b>' + tip + ' ') + explain(r) + (k === ROUNDS.length - 1 ? ` That was the last one: ${score} of ${ROUNDS.length}.` : ''), right ? 'ok' : 'bad');  // feedback: Correct or Not this time (with any hint), the worked answer, and the final score after the last round; green or red
          }  // ends answer
          paint();  // draws the first round as the step opens
          el.append(h('div', { class: 'split r fill' },  // lays out the step: two columns, the right one smaller, filling the step's height
            h('div', { class: 'stack' },  // left column: the exercise
              h('p', { class: 'lead m0', html: 'Your turn. For each logical address of process Q, work out the physical address, or press <b>Trap!</b> if the hardware would refuse it.' }),  // opening sentence: the instructions
              h('div', { class: 'card white stack', style: { gap: '10px' } }, roundHead, addrBox, decodeBox,  // white card holding the round header, the address and the decode button
                h('div', { class: 'row' }, h('label', { class: 'b small', text: 'Physical address:' }), input, checkBtn, trapBtn), fb),  // row with the label, answer box, Check and Trap!, then the feedback box; closes the card
              h('div', { class: 'row' }, nextBtn, againBtn, histBox)),  // row with Next address, Start over and the history chips; closes the left column
            h('div', { class: 'stack' },  // right column: reference material
              h('h4', { class: 'm0', text: 'Segment table of process Q' }), tbl,  // heading and Q's segment table
              h('div', { class: 'card tight small', html: '<div class="b" style="margin-bottom:4px">The recipe, every time</div><ol class="m0" style="padding-left:20px"><li>Split the address into segment number and offset.</li><li>Look up that entry’s base and length (no entry: trap).</li><li>Offset &lt; length? If not, trap.</li><li>Physical address = base + offset.</li></ol>' }),  // recipe card: the four translation steps as a numbered list
              h('div', { class: 'callout tip m0 small', 'data-label': 'Shortcut', html: 'With a 4 + 12 split, each hex digit is exactly 4 bits. So the <b>first hex digit is the segment number</b> and the last three are the offset: 0x1F40 is segment 1, offset 0xF40 = 3,904.' }),  // "Shortcut" callout: with a 4 + 12 split the first hex digit is the segment number, worked on an example
              h('p', { class: 'small muted m0', html: 'This happens on every memory reference, so it is built into the processor. The OS only fills in the table and handles the traps.' }))));  // small grey note: this runs on every reference, so it is built into the processor; the OS fills the table and handles traps; closes the layout
        },  // ends render for step 5
      },  // closes step 5
      /* ---------------- 6. Protection bits and a shared segment ---------------- */
      {  // opens step 6: protection bits on each segment, and a segment shared by two processes
        title: 'Protection and sharing come almost for free',  // step title shown at the top of the screen
        kind: 'explore',  // kind explore: labelled Explore above the title
        render(el, ctx) {  // render(el, ctx): builds step 6 when the student opens it
          const { h, s } = ctx;  // takes h (HTML builder) and s (SVG builder) out of ctx
          const SEGS = [  // SEGS: the four segments every editor process has, with protection bits (R read, W write, X execute; a dash means not allowed)
            { name: 'editor code', perm: 'R-X' },  // segment 0, the editor's code: may be read and executed, never written
            { name: 'dictionary', perm: 'R--' },  // segment 1, the spelling dictionary: read only
            { name: 'document', perm: 'RW-' },  // segment 2, the document being edited: read and write, but not execute
            { name: 'stack', perm: 'RW-' },  // segment 3, the stack: read and write, but not execute
          ];  // closes SEGS
          const BLOCKS = {  // BLOCKS: where each piece sits in physical memory, under a short key, with the colour class it is drawn in
            code: { start: 1000, len: 3800, label: 'editor code', cls: 'sg0' },  // the editor code, 3,800 bytes at 1,000, shared by both editors when sharing is on
            dict: { start: 5600, len: 2500, label: 'dictionary', cls: 'sg1' },  // the dictionary, 2,500 bytes at 5,600, also shared when sharing is on
            adoc: { start: 9000, len: 1800, label: 'A’s document', cls: 'sg2' },  // editor A's own document, which only A's table points at
            astk: { start: 11400, len: 1400, label: 'A’s stack', cls: 'sg3' },  // editor A's own stack
            bdoc: { start: 13600, len: 2200, label: 'B’s document', cls: 'sg2' },  // editor B's own document
            bstk: { start: 16600, len: 1400, label: 'B’s stack', cls: 'sg3' },  // editor B's own stack
            bcode: { start: 19000, len: 3800, label: 'B’s code copy', cls: 'sg0' },  // B's private copy of the code, used only when sharing is switched off
            bdict: { start: 23200, len: 2500, label: 'B’s dict copy', cls: 'sg1' },  // B's private copy of the dictionary, used only when sharing is switched off
          };  // closes BLOCKS
          let who = 'A', seg = 0, op = 'W', shared = true, probe = false;  // who: the editor making the access; seg: the segment; op: R, W or X (starting with a write to code, which fails); shared; probe: the reach test is showing
          const map = (p) => (p === 'A' ? ['code', 'dict', 'adoc', 'astk'] : shared ? ['code', 'dict', 'bdoc', 'bstk'] : ['bcode', 'bdict', 'bdoc', 'bstk']);  // map(p): the blocks editor p's table points at, in segment order; B's first two entries point at the shared blocks, or at B's own copies
          const slim = ctx.narrow, L = slim ? { W: 360, TW: 112, BX: 248, MX: 130, MW: 100 } : { W: 660, TW: 210, BX: 450, MX: 275, MW: 110 };  // slim: true on phone-width screens; L: drawing width, table width, x of B's table, and the memory column's x and width
          const SLIM = { code: 'code', dict: 'dictionary', adoc: 'A’s doc', astk: 'A’s stack', bdoc: 'B’s doc', bstk: 'B’s stack', bcode: 'B’s code', bdict: 'B’s dict' };  // SLIM: shorter block labels for small screens
          const MEMT = 26000, MY0 = 26, MY1 = 384, my = (a) => MY0 + (a / MEMT) * (MY1 - MY0), MX = L.MX, MW = L.MW;  // MEMT: 26,000 bytes of memory drawn; MY0 and MY1: top and bottom of the column; my(a): the y of address a; MX and MW: the column's x and width
          const rowY = (i) => 44 + i * 64;  // rowY(i): the top of table row i; rows are 64px apart
          const svg = s('svg', { viewBox: `0 0 ${L.W} 392`, width: '100%', role: 'img', 'aria-label': 'Two segment tables pointing into memory' });  // the drawing: two segment tables either side of main memory
          const res = h('div', { class: 'narr' });  // res: the narration box that says whether the access is allowed
          const memLine = h('div', { class: 'small' });  // memLine: the line that totals the memory both editors use
          function table(p, x) {  // table(p, x): draws editor p's segment table with its left edge at x and returns the shapes
            const kids = [s('text', { x: x + L.TW / 2, y: 26, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800 }, slim ? `Editor ${p}` : `Editor ${p}’s segment table`)];  // kids starts with the table's heading, "Editor A's segment table" (just "Editor A" on small screens)
            map(p).forEach((key, i) => {  // one row per entry of this editor's table
              const b = BLOCKS[key], y = rowY(i), on = !probe && who === p && seg === i;  // b: the block the entry points at; y: the row's top; on: whether this row is the access being tried (never while probing)
              kids.push(s('rect', { x, y, width: L.TW, height: slim ? 58 : 56, rx: 8, class: on ? 's-accent' : 's-panel', 'stroke-width': on ? 3 : 1.2 }),  // the row's box: indigo with a thick border when selected, neutral otherwise
                s('text', { x: x + (slim ? 6 : 10), y: y + (slim ? 19 : 22), 'font-size': slim ? 13 : 14, 'font-weight': 700 }, `${i} · ${slim ? ['code', 'dict', 'doc', 'stack'][i] : SEGS[i].name}`),  // the entry number and segment name (a short name on small screens)
                s('rect', { x: x + (slim ? 74 : 160), y: y + (slim ? 5 : 8), width: slim ? 34 : 42, height: 20, rx: 6, class: SEGS[i].perm.includes('W') ? 's-warn' : 's-ok', 'stroke-width': 1 }),  // a small badge behind the permission letters: amber when the segment is writable, green when it is not
                s('text', { x: x + (slim ? 91 : 181), y: y + (slim ? 20 : 23), 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, class: 's-monot' }, SEGS[i].perm),  // the permission letters themselves, such as R-X, centred on the badge
                ...(slim ? [s('text', { x: x + 6, y: y + 37, 'font-size': 13, class: 's-monot s-sub' }, `base ${nf(b.start)}`), s('text', { x: x + 6, y: y + 52, 'font-size': 13, class: 's-monot s-sub' }, `len ${nf(b.len)}`)]  // small screens: the base and the length on two separate lines
                  : [s('text', { x: x + 10, y: y + 44, 'font-size': 13, class: 's-monot s-sub' }, `base ${nf(b.start)} len ${nf(b.len)}`)]));  // desktop: base and length together on one line; the brackets close the row's push
            });  // ends the loop over rows
            return kids;  // hands the shapes back to draw
          }  // ends table
          function draw() {  // draw(): redraws both tables, the memory column and every arrow between them
            const kids = [...table('A', 0), ...table('B', L.BX),  // kids: A's table at the left edge and B's table at BX
              s('text', { x: MX + MW / 2, y: 16, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800 }, 'Main memory'),  // heading over the memory column, "Main memory"
              s('rect', { x: MX, y: MY0, width: MW, height: MY1 - MY0, rx: 6, class: 's-panel', 'stroke-width': 1 })];  // the memory column's background; closes the list
            const used = new Set([...map('A'), ...map('B')]);  // used: the blocks at least one table points at (B's private copies appear only when sharing is off)
            const target = probe ? 'adoc' : map(who)[seg];  // target: the block being reached: A's document during the reach test, otherwise the block behind the selected entry
            Object.entries(BLOCKS).forEach(([key, b]) => {  // draws each block of memory
              if (!used.has(key)) return;  // skips any block no table points at
              const y0 = my(b.start), y1 = my(b.start + b.len), hit = key === target;  // y0 and y1: the block's top and bottom; hit: whether it is the target
              kids.push(s('rect', { x: MX + 4, y: y0, width: MW - 8, height: y1 - y0, rx: 4, class: probe && hit ? 's-bad' : b.cls, 'stroke-width': hit ? 3 : 1.2, style: probe && hit ? 'stroke-dasharray:5 3' : '' }),  // the block in its colour; the target gets a thick border, and during the reach test A's document turns red and dashed
                s('text', { x: MX + MW / 2, y: (y0 + y1) / 2 + 4.5, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 }, slim ? SLIM[key] : b.label));  // the block's label in its middle (shorter on small screens); closes the push
            });  // ends the loop over blocks
            ['A', 'B'].forEach((p) => map(p).forEach((key, i) => {  // one arrow from every entry of both tables to the block it points at
              const b = BLOCKS[key], by = (my(b.start) + my(b.start + b.len)) / 2, ry = rowY(i) + 28, on = !probe && who === p && seg === i;  // b: that block; by: the block's vertical middle; ry: the row's middle; on: whether this is the selected access
              const col = on ? (allowed() ? 'var(--ok)' : 'var(--bad)') : 'var(--line-2)';  // col: the selected access's arrow is green if allowed and red if refused; all other arrows are pale grey
              const d = slim  // d: the arrow's path, a smooth curve from the table's edge to the memory column, with a small-screen and a desktop version
                ? (p === 'A' ? `M${L.TW},${ry} C${L.TW + 10},${ry} ${L.TW + 8},${by} ${MX + 2},${by}` : `M${L.BX},${ry} C${L.BX - 10},${ry} ${L.BX - 8},${by} ${MX + MW - 2},${by}`)  // small screens: A's arrows leave the right edge of A's table, B's leave the left edge of B's (C draws a curve)
                : (p === 'A' ? `M210,${ry} C240,${ry} 245,${by} ${MX + 2},${by}` : `M450,${ry} C420,${ry} 415,${by} ${MX + MW - 2},${by}`);  // desktop: the same curves from fixed edges at x 210 and x 450
              kids.push(s('path', { d, fill: 'none', style: `stroke:${col}`, 'stroke-width': on ? 3 : 1.5, 'marker-end': on ? (allowed() ? 'url(#arr-ok)' : 'url(#arr-bad)') : 'url(#arr-muted)' }));  // draws the curve, thicker for the selected access, with an arrowhead in the matching colour
            }));  // ends both loops
            svg.replaceChildren(...kids);  // replaces the old drawing with the new shapes in one step
          }  // ends draw
          const allowed = () => SEGS[seg].perm.includes(op);  // allowed(): true when the selected segment's permission letters include the chosen operation
          const OPN = { R: 'read', W: 'write', X: 'execute' };  // OPN: turns the letters R, W and X into words for the messages
          function why() {  // why(): explains why the access was allowed or refused
            const k = SEGS[seg].name, p = SEGS[seg].perm;  // k: the segment's name; p: its permission letters
            if (allowed()) return seg < 2 && shared ? `Allowed: the entry says ${p}, which includes ${OPN[op]}. This is the one copy both editors use.` : `Allowed: the entry says ${p}, which includes ${OPN[op]}.`;  // allowed: says so, and for the code or dictionary while shared adds that both editors use this one copy
            if (op === 'W' && seg === 0) return `Protection fault: the code segment is ${p}, so no write is allowed. A stray pointer cannot scribble over the instructions, which matters doubly when another process runs the same copy.`;  // a write to the code is refused: a stray pointer cannot change the instructions, which matters more when another process runs them
            if (op === 'W') return `Protection fault: the dictionary is read-only (${p}). If editor ${who} could change it, the other editor would see the change too.`;  // a write to the dictionary is refused: it is read-only, and otherwise the other editor would see the change
            return `Protection fault: the ${k} holds data, not instructions (${p}, no X). Refusing to run data as code blocks a classic attack in which injected bytes are executed.`;  // execute on a data segment is refused: running data as code is how a classic attack runs injected bytes
          }  // ends why
          function paint() {  // paint(): redraws the picture and rewrites both messages
            draw();  // redraws the tables, memory and arrows
            if (probe) narrate(res, 'Editor B tries to reach A’s document. It cannot even <b>name</b> it: every address B forms goes through B’s own segment table, and no entry there points at A’s document. Protection by construction: what is not in your table does not exist for you.', 'warn');  // reach test: amber message that B cannot even name A's document, because no entry in B's table points at it
            else narrate(res, `<b>Editor ${who}</b> tries to <b>${OPN[op]}</b> segment ${seg} (${SEGS[seg].name}). ` + why(), allowed() ? 'ok' : 'bad');  // otherwise: which editor tries which operation on which segment, then the reason; green if allowed, red if not
            const tot = [...new Set([...map('A'), ...map('B')])].reduce((a, k) => a + BLOCKS[k].len, 0);  // tot: bytes used by every distinct block the two tables point at (a shared block counts once)
            const sep = tot + (shared ? BLOCKS.code.len + BLOCKS.dict.len : 0), one = shared ? tot : tot - BLOCKS.code.len - BLOCKS.dict.len;  // sep: what fully separate copies would need; one: what a single shared copy would need
            memLine.innerHTML = shared  // the memory line depends on whether sharing is on
              ? `Memory used by both editors: <b>${nf(tot)} bytes</b>. Separate copies would need ${nf(sep)}: sharing saves <b>${nf(sep - one)}</b> bytes, and more with every extra editor.`  // shared: the total, what separate copies would cost, and the bytes saved
              : `Memory used by both editors: <b>${nf(tot)} bytes</b>, with two copies of the code and the dictionary. One shared copy would need only ${nf(one)}.`;  // separate: the total with two copies of the code and dictionary, and what one shared copy would need
          }  // ends paint
          const pick = (fn) => (v) => { fn(v); probe = false; paint(); };  // pick(fn): wraps a switch's handler so a change also ends the reach test and repaints
          const row = (label, w) => h('div', { class: 'row', style: { gap: '8px' } }, h('span', { class: 'small b', style: { width: '72px' }, text: label }), w);  // row(label, w): a row with a bold label of fixed width followed by a widget
          const segWho = ctx.ui.seg([{ value: 'A', label: 'Editor A' }, { value: 'B', label: 'Editor B' }], who, pick((v) => { who = v; }));  // segWho: switch between Editor A and Editor B
          const segSeg = ctx.ui.seg([0, 1, 2, 3].map((i) => ({ value: i, label: `${i} ${['code', 'dict', 'doc', 'stack'][i]}` })), seg, pick((v) => { seg = v; }));  // segSeg: switch between segments 0 to 3, each with a short name
          const segOp = ctx.ui.seg([{ value: 'R', label: 'Read' }, { value: 'W', label: 'Write' }, { value: 'X', label: 'Execute' }], op, pick((v) => { op = v; }));  // segOp: switch between Read, Write and Execute
          const segShare = ctx.ui.seg([{ value: true, label: 'One shared copy' }, { value: false, label: 'Separate copies' }], shared, pick((v) => { shared = v; }));  // segShare: switch between one shared copy and separate copies
          const probeBtn = h('button', { class: 'btn sm intr', type: 'button', onclick: () => { probe = true; paint(); } }, 'Can B reach A’s document?');  // a red-outlined button that runs the reach test: can editor B get at A's document?
          paint();  // draws everything once as the step opens
          el.append(h('div', { class: 'split r fill' },  // lays out the step: two columns, the right one smaller, filling the step's height
            h('div', { class: 'stack' },  // left column: the setup and the picture
              h('p', { class: 'm0', html: 'Two people run the same text editor. Each process has its own segment table. Every entry carries <span class="t">protection bits</span> (R = read, W = write, X = execute), and with sharing on, both tables’ code and dictionary entries point at one <span class="t">shared segment</span> each.' }),  // paragraph: two people run the same editor; each entry carries protection bits, and sharing points both tables at one copy
              h('div', { class: 'card white', style: { padding: '6px 8px' } }, svg)),  // white card holding the drawing; closes the left column
            h('div', { class: 'stack' },  // right column: the controls
              row('Who', segWho), row('Segment', segSeg), row('Access', segOp), res, probeBtn,  // rows for Who, Segment and Access, then the result box and the reach-test button
              h('div', { class: 'card tight stack', style: { gap: '6px' } }, row('Sharing', segShare), memLine),  // a small card with the sharing switch and the memory total line
              h('p', { class: 'small muted m0', html: 'The hardware checks the protection bits on every reference, alongside the length check. Because a segment is one whole logical unit, one setting fits all of it.' }))));  // small grey note: the hardware checks the bits on every reference, and one setting fits a whole logical unit; closes the layout
        },  // ends render for step 6
      },  // closes step 6
      /* ---------------- 7. Compare: paging vs segmentation, and all four techniques ---------------- */
      {  // opens step 7: paging against segmentation, then all four memory techniques side by side
        title: 'Paging vs segmentation, and the four techniques so far',  // step title shown at the top of the screen
        kind: 'compare',  // kind compare: labelled Compare above the title
        render(el, ctx) {  // render(el, ctx): builds step 7 when the student opens it
          const { h, s } = ctx;  // takes h (HTML builder) and s (SVG builder) out of ctx
          const T = P_TABLE.reduce((a, e) => a + e.len, 0), starts = [];  // T: the size of program P, 7,600 bytes; starts will hold each part's start when the parts sit end to end
          P_TABLE.reduce((a, e, i) => { starts[i] = a; return a + e.len; }, 0);  // fills starts with the running total of the lengths: 0, 2,600, 3,500 and 6,500
          let ps = 1024;  // ps: the page size used for the paging picture, starting at 1,024 bytes
          function sameProgram(panel) {  // sameProgram(panel): builds the first tab: P cut into pages on top, into segments below, and a comparison table
            const slim = ctx.narrow, W = slim ? 360 : 1080, X0 = slim ? 12 : 20, k = (W - 2 * X0 - 60) / 8192;  // slim: phone-width flag; W and X0: drawing width and margin; k: pixels per byte, so 8,192 bytes plus three 20px gaps fit across
            const svg = s('svg', { viewBox: `0 0 ${W} 200`, width: '100%', role: 'img', 'aria-label': 'Program P under paging and under segmentation' });  // the drawing, 200 units tall
            const tbl = h('table', { class: 'tbl compact tight' });  // tbl: the comparison table under the drawing
            const HALO = 'paint-order:stroke;stroke:var(--panel);stroke-width:5px;stroke-linejoin:round';  // HALO: a style that paints a thick outline in the panel colour behind text, so labels stay readable where page lines cross them
            function draw() {  // draw(): redraws the picture and the table for the current page size
              const pages = Math.ceil(T / ps), span = pages * ps, kids = [], labels = [];  // pages: how many pages P needs (rounded up); span: the bytes those pages cover; labels are kept apart so they go on top
              kids.push(s('text', { x: X0, y: 16, 'font-size': 14, 'font-weight': 700 }, slim ? `Paging: cut every ${nf(ps)} bytes` : `Paging: one flat range, cut every ${nf(ps)} bytes`));  // heading for the paging row, naming the page size
              P_TABLE.forEach((e, i) => {  // each part of P drawn end to end in one flat row
                const x = X0 + starts[i] * k, w = e.len * k;  // x and w: where the part starts and how wide it is
                kids.push(s('rect', { x, y: 26, width: w, height: 44, class: 'sg' + i, 'stroke-width': 1.2 }));  // the part's coloured block in the paging row
                if (w > 46) labels.push(s('text', { x: x + w / 2, y: 53, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, class: 'tx' + i, style: HALO }, e.short));  // its short name, added only when the block is wide enough to hold it
              });  // ends the loop over parts
              const wx = X0 + T * k, ww = (span - T) * k;  // wx and ww: where the unused end of the last page starts and how wide it is
              kids.push(s('rect', { x: wx, y: 26, width: ww, height: 44, class: 's-bad', 'stroke-width': 1.2, style: 'stroke-dasharray:4 3' }));  // a red dashed block marking that unused space: internal fragmentation
              if (ww > 44) labels.push(s('text', { x: wx + ww / 2, y: 53, 'text-anchor': 'middle', 'font-size': 13, class: 'tx-bad', style: HALO }, 'waste'));  // the word "waste" on it when there is room
              for (let j = 0; j <= pages; j++) kids.push(s('line', { x1: X0 + j * ps * k, y1: 20, x2: X0 + j * ps * k, y2: 76, class: 's-line', 'stroke-width': 2 }));  // a page boundary line every ps bytes, from 0 to the end of the last page
              kids.push(...labels);  // adds the labels after the lines, so the lines do not cross them
              const pw = ps * k;  // pw: the width of one page in pixels
              for (let j = 0; j < pages; j++) if (pw >= 26) kids.push(s('text', { x: X0 + (j + 0.5) * pw, y: 92, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, 'p' + j));  // page numbers p0, p1... under the pages, only when a page is at least 26px wide
              kids.push(s('text', { x: X0, y: 122, 'font-size': 14, 'font-weight': 700 }, slim ? 'Segmentation: each piece its own size' : 'Segmentation: four pieces, each exactly its own size'));  // heading for the segmentation row
              let x = X0;  // x: where the next segment is drawn
              P_TABLE.forEach((e, i) => {  // each segment drawn as its own block
                const w = e.len * k;  // w: the segment's width
                kids.push(s('rect', { x, y: 132, width: w, height: 44, rx: 6, class: 'sg' + i, 'stroke-width': 1.5 }),  // the segment's rounded block in its colour
                  s('text', { x: x + w / 2, y: 159, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, class: 'tx' + i }, w > 80 && !slim ? `seg ${i} · ${nf(e.len)}` : w > 44 ? 'seg ' + i : String(i)));  // its label: number and size when wide, just "seg 2" when medium, the bare number when small
                x += w + 20;  // moves along, leaving a 20px gap before the next segment
              });  // ends the loop over segments
              kids.push(s('text', { x: X0, y: 194, 'font-size': 13, class: 's-sub' }, slim ? 'Gaps: each segment sits in its own hole.' : 'Gaps: each segment sits in its own hole, wherever one fits.'));  // grey note under the row: each segment sits in its own hole
              svg.replaceChildren(...kids);  // replaces the old drawing with the new shapes in one step
              let mixed = 0;  // mixed: will count the pages that hold bytes from more than one part
              for (let j = 0; j < pages; j++) {  // checks each page in turn
                const a = j * ps, b = a + ps;  // a and b: the page's first byte and the byte just past its end
                if (P_TABLE.filter((e, i) => starts[i] < b && starts[i] + e.len > a).length > 1) mixed++;  // counts the page if more than one part overlaps its range
              }  // ends the page loop
              tbl.innerHTML = '<thead><tr><th></th><th>Simple paging (' + nf(ps) + '-byte pages)</th><th>Simple segmentation</th></tr></thead><tbody>' +  // comparison table header: simple paging at this page size against simple segmentation
                `<tr><td class="b">Pieces</td><td>${pages} pages, all ${nf(ps)} bytes</td><td>4 segments: ${P_TABLE.map((e) => nf(e.len)).join(', ')} bytes</td></tr>` +  // row: how many pieces each scheme makes and how big they are
                `<tr><td class="b">Internal fragmentation</td><td><b class="c-bad">${nf(span - T)} bytes</b>, unused end of the last page</td><td><b class="c-ok">none</b>: each piece is exactly its size</td></tr>` +  // row: internal fragmentation, the paging waste in red against none for segments in green
                `<tr><td class="b">External fragmentation</td><td><b class="c-ok">none</b>: any free frame will do</td><td><b class="c-bad">possible</b>: each segment needs a hole at least its size</td></tr>` +  // row: external fragmentation, none for paging against possible for segments
                `<tr><td class="b">Pieces mixing two parts</td><td>${mixed} of ${pages} pages mix bytes from two or more parts</td><td>none: one segment, one part, one set of access rights</td></tr>` +  // row: how many pages mix two parts, against none for segments
                '<tr><td class="b">The programmer sees</td><td>one flat range of addresses (paging is invisible)</td><td>the segments (segmentation is visible)</td></tr>' +  // row: paging is invisible to the programmer, segmentation is visible
                '<tr><td class="b">Translation</td><td>write the frame number in front of the offset bits</td><td>look up base and length, check, add</td></tr></tbody>';  // row: how translation works in each scheme; closes the table
            }  // ends draw
            const seg = ctx.ui.seg([512, 1024, 2048, 4096].map((v) => ({ value: v, label: nf(v) + ' B' })), ps, (v) => { ps = v; draw(); });  // seg: the page size switch, 512 to 4,096 bytes; a change redraws
            draw();  // draws once when the tab opens
            panel.append(h('div', { class: 'stack', style: { gap: '8px' } },  // puts the tab's content into the panel the tabs widget provides
              h('div', { class: 'row' }, h('span', { class: 'small b', text: 'Page size:' }), seg, h('span', { class: 'small muted', text: `Program P: 4 parts, ${nf(T)} bytes in all.` })),  // row with the "Page size:" label, the switch and a note on P's size
              h('div', { class: 'card white', style: { padding: '4px 8px' } }, svg), tbl));  // the drawing in a white card, then the table; closes the tab content
          }  // ends sameProgram
          const FOUR = '<table class="tbl"><thead><tr><th>Technique</th><th>How it works</th><th>Strengths</th><th>Weaknesses</th></tr></thead><tbody>' +  // FOUR: the HTML of the table that compares the four techniques, starting with its header
            '<tr><td class="b">Fixed partitioning</td><td>Memory is carved into partitions of set sizes when the system starts. Each process takes one whole partition at least its size.</td><td>Simple to build; very little OS overhead.</td><td>Internal fragmentation; the number of partitions caps the number of active processes.</td></tr>' +  // row: fixed partitioning, how it works, its strengths and its weaknesses
            '<tr><td class="b">Dynamic partitioning</td><td>A partition is made on demand, exactly the size of the process.</td><td>No internal fragmentation; memory is used more fully.</td><td>External fragmentation; compaction fixes it but costs processor time.</td></tr>' +  // row: dynamic partitioning
            '<tr><td class="b">Simple paging</td><td>Memory is cut into equal frames and each process into pages of the same size. All pages are loaded, each into any free frame.</td><td>No external fragmentation.</td><td>A little internal fragmentation, in each process’s last page.</td></tr>' +  // row: simple paging
            '<tr class="on"><td class="b">Simple segmentation</td><td>Each process is cut into segments of different sizes. All segments are loaded into partitions of their own size that need not be next to each other.</td><td>No internal fragmentation; better use of memory and lower overhead than dynamic partitioning; matches how programs are built.</td><td>External fragmentation, though less than with dynamic partitioning.</td></tr></tbody></table>';  // row: simple segmentation, lit up as the current topic; closes the table
          const tabs = ctx.ui.tabs([  // tabs: a two-tab widget (ctx.ui.tabs)
            { label: 'Same program, two ways', render: (p) => sameProgram(p) },  // tab 1, drawn by sameProgram when opened
            { label: 'All four techniques', html: `<div class="stack">${FOUR}<div class="callout why m0 small" data-label="Where this leads">The word “simple” means every piece of a process must be in memory. Chapter 8 drops that rule (virtual memory) and combines the two ideas: segments that are themselves paged. Most of today’s systems lean on paging; on 64-bit x86 processors, for example, segmentation is almost switched off.</div></div>` },  // tab 2: the FOUR table plus a "Where this leads" callout on virtual memory and paged segments in the next chapter
          ]);  // closes the tab list
          el.append(h('div', { class: 'fill' }, tabs));  // puts the tabs on the screen, filling the step
        },  // ends render for step 7
      },  // closes step 7
      /* ---------------- 8. Recap ---------------- */
      {  // opens step 8, the recap
        title: 'Recap: six things to remember about segmentation',  // step title shown at the top of the screen
        kind: 'recap',  // kind recap: labelled Recap, and always on the core path
        render(el, ctx) {  // render(el, ctx): builds step 8 when the student opens it
          const { h } = ctx;  // takes the HTML builder h out of ctx
          el.append(h('div', { class: 'stack fill' },  // a column that fills the step
            h('p', { class: 'lead m0', text: 'Say each answer out loud before you flip the card.' }),  // instruction: say each answer aloud before flipping, which helps it stick
            ctx.ui.flipcards([  // flip cards (ctx.ui.flipcards): a question on the front, its answer on the back
              ['What is a <b>segment</b>?', 'A variable-length piece of a program that matches one logical part (main code, a routine, a data table, the stack), no longer than the maximum segment length.'],  // card 1: what a segment is
              ['What is inside a segmented <b>logical address</b>?', '(segment number, offset). The leftmost <i>n</i> bits pick the segment; the rightmost <i>m</i> bits say how far into it. A segment can be at most 2<sup><i>m</i></sup> bytes.'],  // card 2: the two parts of a logical address and the 2 to the m size limit
              ['What does a <b>segment table</b> entry hold?', 'The segment’s base (where it starts in physical memory) and its length, usually with protection bits. Each process has its own table.'],  // card 3: what a segment table entry holds
              ['How is (<i>s</i>, <i>d</i>) <b>translated</b>?', 'Look up entry <i>s</i> (no entry: trap). If <i>d</i> ≥ length: trap. Otherwise physical address = base + <i>d</i>.'],  // card 4: the translation rule, including both traps
              ['Which <b>fragmentation</b> does segmentation have?', 'External only, and less than dynamic partitioning because the pieces are smaller. No internal fragmentation: every segment gets exactly its size.'],  // card 5: which fragmentation segmentation has and why
              ['Why are <b>protection and sharing</b> easy?', 'Each entry carries the rights for one whole logical unit (read-only code, writable data), and sharing a segment just means listing it in several processes’ tables.'],  // card 6: why protection and sharing come easily
            ], { cols: 3, height: 170 }),  // closes the card list; three columns, each card 170px tall
            h('div', { class: 'card white center', style: { fontSize: '19px' }, html: 'physical address = <b class="c-ok">base</b>[<i class="c-sgn">s</i>] + <i class="c-off">d</i>, &nbsp;if <i class="c-off">d</i> &lt; <b>length</b>[<i class="c-sgn">s</i>]; &nbsp;otherwise <b class="c-bad">trap</b>' }),  // a card with the whole rule as one colour-coded formula: base plus offset if the offset is less than the length, otherwise trap
            h('div', { class: 'row small' },  // a row of summary chips
              h('span', { class: 'chip ok', text: 'visible to the programmer' }),  // green chip: segmentation is visible to the programmer
              h('span', { class: 'chip ok', text: 'variable-size pieces' }),  // green chip: pieces of variable size
              h('span', { class: 'chip ok', text: 'no internal fragmentation' }),  // green chip: no internal fragmentation
              h('span', { class: 'chip bad', text: 'external fragmentation' }),  // red chip: external fragmentation remains
              h('span', { class: 'chip warn', text: 'stay under the maximum segment size' }))));  // amber chip: each segment must stay under the maximum size; closes the layout
        },  // ends render for step 8
      },  // closes step 8
      /* ---------------- 9. Quiz ---------------- */
      {  // opens step 9, the quiz
        title: 'Check yourself',  // step title shown at the top of the screen
        kind: 'check',  // kind check: labelled Check Yourself, always on the core path, and its best first-try score is saved
        quiz: [  // quiz: the questions; the guide draws each one, grades it and keeps the best score
          { q: 'Under segmentation, a logical address consists of:',  // question 1 (multiple choice): what a segmented logical address is made of
            choices: ['A segment number and an offset within that segment', 'A page number and an offset within that page', 'A base address and a length', 'A frame number and a segment number'], answer: 0,  // the four choices; the first, segment number plus offset, is right (answer 0)
            feedback: [null, 'That is the paging form. Pages all have one fixed size; segments do not.', 'Base and length are stored in the segment table entry; the program never uses them directly.', 'Frames belong to paging, and the position inside the piece (the offset) is missing.'],  // feedback for each wrong choice (null marks the right one): the paging form, the table's contents, frames
            why: 'A segmented address names the segment (an index into the process’s segment table) and how many bytes into that segment the location lies.' },  // explanation: the address names a table entry and how far into that segment the byte lies
          { type: 'num', q: 'A machine uses 16-bit logical addresses: a 4-bit segment number followed by a 12-bit offset. What is the largest a segment can be, in bytes?', answer: 4096, tol: 0, unit: 'bytes',  // question 2 (calculate): the largest segment with a 12-bit offset field; the answer, 4,096 bytes, must be exact
            why: 'A 12-bit offset counts from 0 to 4,095, so a segment holds at most 2<sup>12</sup> = 4,096 bytes. (The 4-bit segment number allows up to 16 segments.)' },  // explanation: offsets 0 to 4,095 give 2 to the 12th bytes, and 4 segment bits allow 16 segments
          { type: 'num', q: 'Entry 3 of a process’s segment table holds base 7,200 and length 2,000. What physical address does the logical address (segment 3, offset 1,350) map to?', answer: 8550, tol: 0,  // question 3 (calculate): translate (3, 1,350) using base 7,200 and length 2,000; the answer is 8,550
            why: 'First the check: 1,350 &lt; 2,000, so the offset is inside the segment. Then the addition: 7,200 + 1,350 = 8,550.' },  // explanation: check first (1,350 is under 2,000), then add
          { q: 'Segment 1 of a process has length 600. The process uses the logical address (segment 1, offset 600). What happens?',  // question 4 (multiple choice): what happens to offset 600 in a segment that is 600 bytes long
            choices: ['It maps to base + 600, which is the segment’s last byte', 'It wraps around and reaches offset 0 of the same segment', 'The hardware traps: offset 600 is outside the segment', 'The OS quietly grows the segment by one byte to fit it'], answer: 2,  // the four choices; the third, a trap, is right (answer 2)
            feedback: ['The last byte is at offset 599. Offsets start at 0, so a 600-byte segment uses 0 to 599.', 'There is no wrap-around. An out-of-range offset is refused, not reinterpreted.', null, 'The hardware check fails before any memory is touched; nothing is resized.'],  // feedback: the last byte is at 599, there is no wrap-around, and nothing is resized
            why: 'Valid offsets run from 0 to length − 1. The test is offset &lt; length, and 600 &lt; 600 is false, so the reference traps to the OS.' },  // explanation: valid offsets stop at length minus 1, and 600 < 600 is false, so the reference traps
          { type: 'order', q: 'Put the steps of translating a segmented logical address in order.',  // question 5 (put in order): the steps of translating a segmented address
            items: ['Split the address: the leftmost bits give the segment number, the rest the offset', 'Use the segment number to index the process’s segment table', 'Read that segment’s base and length from the entry', 'Compare the offset with the length, trapping if the offset is too large', 'Add the base to the offset to form the physical address'],  // the five steps, written in the correct order; the quiz shuffles them for the student
            why: 'Split, look up, read the entry, check, add. The check must come before the addition so that an out-of-range reference never reaches memory.' },  // explanation: split, look up, read, check, add; the check must come first so a bad address never reaches memory
          { type: 'bucket', q: 'Does each property describe simple paging, simple segmentation, or both?', buckets: ['Paging', 'Segmentation', 'Both'],  // question 6 (sort into groups): does each property belong to paging, segmentation or both
            items: [['Every piece has the same size', 0], ['Usually visible to the programmer', 1], ['A little internal fragmentation', 0], ['External fragmentation', 1], ['A process’s pieces need not sit next to each other', 2], ['A per-process table maps each piece to memory', 2], ['Translation adds a base and checks a length', 1], ['Pieces follow the program’s logical parts', 1]],  // eight properties, each with the number of its right group (0 paging, 1 segmentation, 2 both)
            why: 'Both schemes scatter a process through memory using a per-process table. Paging uses equal pieces (invisible, small internal waste); segmentation uses logical, variable-size pieces (visible, external fragmentation, base-plus-offset translation).' },  // explanation: both use a per-process table to scatter a process; the differences are in the size and meaning of the pieces
          { type: 'tf', q: 'Simple segmentation suffers from internal fragmentation, because each segment is rounded up to a fixed size.', answer: false,  // question 7 (true or false): the claim that segments are rounded up and waste space inside; the answer is false
            why: 'Segments are not rounded up: each gets exactly the space it needs, so nothing is wasted inside it. The waste segmentation does suffer is external: holes left between segments.' },  // explanation: each segment gets exactly the space it needs; the waste is external, in holes between segments
          { type: 'multi', q: 'Which statements about protection and sharing under segmentation are true?',  // question 8 (select all): statements about protection and sharing
            choices: ['Each segment table entry can carry its own access rights, such as read-only for code', 'A segment is shared by listing it in the segment tables of several processes', 'To share a segment, each process must keep its own copy of it in memory', 'A process cannot reach memory that none of its segment table entries covers', 'The OS checks the protection bits in software on each memory reference'], answer: [0, 1, 3],  // five statements; the first, second and fourth are true (answer [0, 1, 3])
            why: 'Rights are stored per entry and checked by the hardware on every reference, together with the length. Sharing means two tables point at one physical copy, and a process can only reach memory through its own table.' },  // explanation: rights live in each entry and are checked by hardware; sharing means two tables point at one copy
          { type: 'match', q: 'Match each memory-management technique to its main weakness.',  // question 9 (match the pairs): each memory technique and its main weakness
            pairs: [['Fixed partitioning', 'Internal fragmentation and a fixed cap on active processes'], ['Dynamic partitioning', 'External fragmentation that calls for costly compaction'], ['Simple paging', 'A little internal fragmentation in each process’s last page'], ['Simple segmentation', 'External fragmentation, though less than with whole-process partitions']],  // the four pairs: fixed and dynamic partitioning, simple paging and simple segmentation, each with its weakness
            why: 'Fixed partitions waste space inside each partition; dynamic partitions leave holes between processes; paging wastes only the end of the last page; segmentation leaves holes too, but its smaller pieces fit them more easily.' },  // explanation: where each technique wastes memory
          { q: 'Why does simple segmentation usually suffer less external fragmentation than dynamic partitioning?',  // question 10 (multiple choice): why segmentation fragments memory less than dynamic partitioning
            choices: ['It never leaves holes in memory', 'Its pieces are smaller, so they fit into smaller holes', 'The OS compacts memory after every load', 'Every segment is the same size, so any hole can be reused'], answer: 1,  // the four choices; the second, smaller pieces fit smaller holes, is right (answer 1)
            feedback: ['Segments of different sizes still leave holes as processes come and go.', null, 'Compaction is an expensive step done occasionally, not part of segmentation itself.', 'Equal-size pieces describe paging. Segments differ in size.'],  // feedback for each wrong choice: holes still appear, compaction is separate, and equal sizes describe paging
            why: 'A whole process needs one large hole; its segments need several smaller ones, which are far easier to find among scattered holes.' },  // explanation: one big hole is hard to find; several small ones are easy
          { type: 'num', q: 'A system uses a 4-bit segment number and a 12-bit offset. What is the offset, in decimal, in the logical address 0x3A10?', answer: 2576, tol: 0,  // question 11 (calculate): the offset, in decimal, of the address 0x3A10 under a 4 + 12 split; the answer is 2,576
            hint: 'Each hex digit is 4 bits, so the first digit is the segment number.',  // hint shown after a wrong try: each hex digit is 4 bits, so the first digit is the segment number
            why: 'The first hex digit, 3, is the segment number. The other three, 0xA10, are the offset: 10 × 256 + 1 × 16 + 0 = 2,576.' },  // explanation: 0xA10 worked out digit by digit: 10 × 256 + 1 × 16 + 0
          { type: 'tf', q: 'Segmentation is usually visible to the programmer, who (or whose compiler) decides what goes in each segment.', answer: true,  // question 12 (true or false): segmentation is visible to the programmer; the answer is true
            why: 'Unlike paging, which is invisible, segments match a program’s modules and data structures. Programmers and compilers organize code and data into them, and must keep each one under the maximum segment size.' },  // explanation: segments match modules and data structures, which programmers and compilers arrange and keep under the size limit
        ],  // closes the quiz list
      },  // closes step 9
    ],  // closes the steps list
    notes: `${/* notes: the reading text for this section, one block of HTML shown in the Notes panel */''}
      <h3>Segmentation: cutting a program along its logical parts</h3>${/* notes heading, part 1: segmentation cuts a program along its logical parts */''}
      <p>Paging cuts a program into equal pieces wherever the boundaries happen to fall. <b>Segmentation</b> divides a program and its data along its <b>logical parts</b> instead: the main code, each library routine, each data table, the stack. Each part becomes a <b>segment</b>, a piece of whatever length it needs, up to a <b>maximum segment length</b>. Example used throughout: a music player P with four segments: main code 2,600 bytes, a sort routine 900 bytes, a song table 3,000 bytes and a stack 1,100 bytes (7,600 bytes in all).</p>${/* notes paragraph: defines segmentation and segment, and introduces the music player P with its four segment sizes */''}
      <p>Every segment has its own addresses starting at offset 0. If the main code grows, the song table’s addresses do not move. In one flat block they would: the song table would start at byte 3,500, so its byte 500 would be address 4,000, and 100 more bytes of code would push it to 4,100.</p>${/* notes paragraph: each segment's offsets start at 0, with the flat-block counterexample where addresses shift */''}
      <p><b>Segmentation is usually visible to the programmer.</b> The programmer or compiler decides which code and data go in which segment, and modules can be compiled separately. Paging, by contrast, is invisible. The one inconvenience: no segment may exceed the maximum length, so a large table may have to be split across segments.</p>${/* notes paragraph: segmentation is visible to the programmer, and its one drawback, the maximum length */''}

      <h3>Two-part logical addresses</h3>${/* notes heading, part 2: two-part logical addresses */''}
      <p>A segmented logical address is <b>(segment number, offset)</b>. In binary, the leftmost <i>n</i> bits are the segment number and the rightmost <i>m</i> bits are the offset. A process can have up to 2<sup>n</sup> segments, each at most 2<sup>m</sup> bytes long. The split is fixed by the processor design.</p>${/* notes paragraph: the (segment number, offset) form, n and m bits, and the limits 2 to the n and 2 to the m */''}
      <table><tr><th>Split of 16 bits (n + m)</th><th>Most segments</th><th>Maximum segment length</th></tr>${/* start of the bit-split table, with its header row */''}
        <tr><td>2 + 14</td><td>4</td><td>16,384 bytes</td></tr>${/* split table row: 2 + 14 */''}
        <tr><td>4 + 12 (the running example)</td><td>16</td><td>4,096 bytes</td></tr>${/* split table row: 4 + 12, the running example */''}
        <tr><td>6 + 10</td><td>64</td><td>1,024 bytes</td></tr></table>${/* split table row: 6 + 10; closes the table */''}
      <p>With a 4 + 12 split, each hex digit is exactly 4 bits, so the first hex digit is the segment number and the last three are the offset. Example: 0x21F4 = 0010 000111110100 is segment 2, offset 0x1F4 = 500. Likewise 0x3A10 is segment 3, offset 0xA10 = 2,576.</p>${/* notes paragraph: the hex-digit shortcut, worked on two example addresses */''}

      <h3>Placing segments in memory</h3>${/* notes heading, part 3: placing segments in memory */''}
      <p>Because segments have different sizes, placing them resembles <b>dynamic partitioning</b>: each segment needs a hole (free block) at least its size. The difference is that one program now occupies <b>several</b> partitions, and they need not be next to each other. The OS keeps a <b>free-block list</b> of holes and uses a placement rule such as first-fit. In <i>simple</i> segmentation every segment of a process must be in memory before it runs; if one segment cannot be placed, the load fails (the OS might compact memory or wait).</p>${/* notes paragraph: placement is like dynamic partitioning but with several pieces, a free-block list and all-or-nothing loading */''}
      <ul>${/* starts the list of the two fragmentation facts */''}
        <li><b>No internal fragmentation:</b> each segment gets exactly its size.</li>${/* notes item: no internal fragmentation */''}
        <li><b>External fragmentation:</b> holes build up between segments. It is less severe than with dynamic partitioning, because smaller pieces fit into smaller holes.</li>${/* notes item: external fragmentation, though less than with whole-process partitions */''}
      </ul>${/* ends the list */''}
      <p>Worked example: 32 KB of memory holds the OS and four processes, leaving holes of 5, 3, 6, 2 and 4 KB (20 KB free). An 11 KB program loaded as one block fails, since the largest hole is 6 KB. Loaded as segments of 4, 2, 3 and 2 KB with first-fit, it fits (4 KB into the 5 KB hole, 2 KB into the 3 KB hole, 3 KB and then 2 KB into the 6 KB hole), leaving 9 KB free in five holes. Four 4 KB segments (16 KB) fail at the fourth: 8 KB is free, but no hole is 4 KB.</p>${/* notes paragraph: the worked example from step 3, where 11 KB fits as segments but not as one block */''}

      <h3>Translating an address with a segment table</h3>${/* notes heading, part 4: translating an address with a segment table */''}
      <p>Each process has a <b>segment table</b>. Entry <i>i</i> holds segment <i>i</i>’s <b>base</b> (its starting physical address), its <b>length</b>, and usually its protection bits. The processor keeps the location of the running process’s table in a register, reloaded at every process switch. There is no simple bit splice as in paging, because a segment can start at any address. The hardware does this on every reference:</p>${/* notes paragraph: what an entry holds, the register that locates the table, and why there is no simple bit splice */''}
      <ol>${/* starts the numbered list of what the hardware does on every reference */''}
        <li>Take the segment number from the leftmost <i>n</i> bits and the offset from the rightmost <i>m</i> bits.</li>${/* hardware step 1: take the segment number and the offset from the bits */''}
        <li>Use the segment number to index the segment table. If there is no such entry, trap.</li>${/* hardware step 2: index the table, trapping if there is no such entry */''}
        <li>Compare the offset with the length. If offset ≥ length, the address is invalid: trap.</li>${/* hardware step 3: compare the offset with the length, trapping if it is too large */''}
        <li>Otherwise, physical address = base + offset.</li>${/* hardware step 4: add the base and the offset */''}
      </ol>${/* ends the numbered list */''}
      <table><tr><th>Seg (P)</th><th>Holds</th><th>Base</th><th>Length</th></tr>${/* start of P's segment table, with its header row */''}
        <tr><td>0</td><td>main code</td><td>21,000</td><td>2,600</td></tr>${/* P table row: segment 0, the main code */''}
        <tr><td>1</td><td>sort routine</td><td>9,400</td><td>900</td></tr>${/* P table row: segment 1, the sort routine */''}
        <tr><td>2</td><td>song table</td><td>30,500</td><td>3,000</td></tr>${/* P table row: segment 2, the song table */''}
        <tr><td>3</td><td>stack</td><td>14,200</td><td>1,100</td></tr></table>${/* P table row: segment 3, the stack; closes the table */''}
      <ul>${/* starts the list of the four worked translations from step 4 */''}
        <li>(2, 500): 500 &lt; 3,000, so physical = 30,500 + 500 = <b>31,000</b>.</li>${/* worked translation: (2, 500) is valid and lands at 31,000 */''}
        <li>(1, 1,200): 1,200 ≥ 900, trap.</li>${/* worked translation: (1, 1,200) traps because the routine is only 900 bytes long */''}
        <li>(3, 1,100): offsets run 0 to 1,099, so 1,100 is outside: trap. (The test is offset &lt; length, not ≤.)</li>${/* worked translation: (3, 1,100) traps at the edge, since the test is strictly less than */''}
        <li>(6, 100): P has only segments 0 to 3, trap.</li>${/* worked translation: (6, 100) traps because P has no segment 6 */''}
      </ul>${/* ends the list */''}
      <p>A failed check is a <b>segmentation fault</b>. On UNIX-like systems the OS normally ends the process with the signal SIGSEGV (“segmentation violation”); today the OS sends the same signal for bad references that paging hardware catches.</p>${/* notes paragraph: a failed check is a segmentation fault, and the SIGSEGV signal that ends the process */''}

      <h3>Protection and sharing</h3>${/* notes heading, part 5: protection and sharing */''}
      <p>Each segment table entry can carry <b>protection bits</b> such as read (R), write (W) and execute (X), checked by the hardware on every reference along with the length. Because a segment is one whole logical unit, one setting fits all of it: code R-X (a stray write cannot change instructions), a dictionary R-- (read-only), data and stack RW- (not executable, which blocks running injected data as code).</p>${/* notes paragraph: protection bits per entry, with the settings for code, a dictionary and data */''}
      <p>A <b>shared segment</b> is simply an entry that appears in several processes’ tables, pointing at one physical copy. Two editors sharing 3,800 bytes of code and a 2,500-byte dictionary need 13,100 bytes instead of 19,400, saving 6,300. A process can reach only what its own table points at, so another process’s private segments are unreachable.</p>${/* notes paragraph: a shared segment, the memory two editors save, and why private segments stay unreachable */''}

      <h3>Paging versus segmentation (program P, 7,600 bytes)</h3>${/* notes heading, part 6: paging against segmentation for program P */''}
      <table><tr><th></th><th>Simple paging, 1,024-byte pages</th><th>Simple segmentation</th></tr>${/* start of the comparison table, with its header row */''}
        <tr><td>Pieces</td><td>8 equal pages</td><td>4 segments of 2,600, 900, 3,000 and 1,100 bytes</td></tr>${/* comparison row: the pieces each scheme makes */''}
        <tr><td>Internal fragmentation</td><td>8,192 − 7,600 = 592 bytes in the last page</td><td>none</td></tr>${/* comparison row: internal fragmentation, worked out for 1,024-byte pages */''}
        <tr><td>External fragmentation</td><td>none: any free frame will do</td><td>yes: each segment needs a big enough hole</td></tr>${/* comparison row: external fragmentation */''}
        <tr><td>Programmer’s view</td><td>one flat address range (invisible)</td><td>segments (visible)</td></tr>${/* comparison row: what the programmer sees */''}
        <tr><td>Translation</td><td>frame number placed in front of the offset bits</td><td>look up base and length, check, add</td></tr></table>${/* comparison row: how translation works; closes the table */''}
      <p>Pages can also mix parts: with 1,024-byte pages, 3 of P’s 8 pages hold bytes from two parts, so no single protection setting fits those pages.</p>${/* notes paragraph: some pages mix two parts, so no single protection setting fits them */''}

      <h3>The four techniques so far</h3>${/* notes heading, part 7: the four techniques so far */''}
      <table><tr><th>Technique</th><th>How it works</th><th>Strengths</th><th>Weaknesses</th></tr>${/* start of the four-technique table, with its header row */''}
        <tr><td>Fixed partitioning</td><td>Partitions of set sizes are made at start-up; each process takes one at least its size.</td><td>Simple; little OS overhead.</td><td>Internal fragmentation; the number of partitions caps the number of active processes.</td></tr>${/* technique row: fixed partitioning */''}
        <tr><td>Dynamic partitioning</td><td>Partitions are made on demand, exactly the size of each process.</td><td>No internal fragmentation; better use of memory.</td><td>External fragmentation; compaction costs processor time.</td></tr>${/* technique row: dynamic partitioning */''}
        <tr><td>Simple paging</td><td>Equal frames and pages; all pages loaded, each into any free frame.</td><td>No external fragmentation.</td><td>A small amount of internal fragmentation (last page).</td></tr>${/* technique row: simple paging */''}
        <tr><td>Simple segmentation</td><td>Variable-size segments; all loaded into partitions that need not be contiguous.</td><td>No internal fragmentation; better utilization and lower overhead than dynamic partitioning.</td><td>External fragmentation.</td></tr></table>${/* technique row: simple segmentation; closes the table */''}
      <p>“Simple” means the whole process must be in memory. Chapter 8 removes that rule (virtual memory) and shows how paging and segmentation can be combined. Most current systems rely mainly on paging; on 64-bit x86 processors segmentation is almost switched off.</p>${/* notes paragraph: "simple" means the whole process is in memory; the next chapter drops that rule and mixes paging with segments */''}
    `,  // end of the notes text
  });  // ends the section description passed to Guide.section
})();  // ends the wrapping function and runs it immediately
