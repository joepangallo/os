// Comment key: a line inside backtick text ends with ${/* comment */''}, an empty-string slot that holds a comment without changing the text on screen (full note at the top of the page).
/* Section 8.1 Hardware and Control Structures
   Original teaching material. Helpers live in this IIFE so nothing leaks into the global scope. */
(() => {  // wraps the whole section in an arrow function that runs once, right away, so its helper names stay private to this file
  const bin = (v, bits) => v.toString(2).padStart(bits, '0');  // bin(v, bits): writes v as binary digits, padded with leading zeros to the given width (bin(5, 4) gives "0101")
  const hex = (v, d) => '0x' + v.toString(16).toUpperCase().padStart(d || 8, '0');  // hex(v, d): writes v in hexadecimal with a 0x in front, padded to d digits (8 when d is left out), e.g. 0x00403A7C
  const comma = (v) => Number(v).toLocaleString('en-US');  // comma(v): writes a number with thousands commas in US style, e.g. 1048576 becomes "1,048,576"
  // Byte counts with binary units (1 KB = 1,024 bytes), the convention used for memory sizes.
  function bytes(b) {  // bytes(b): turns a raw byte count into a short readable size such as "4 KB" or "16 GB"
    const U = ['bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB'];  // U: the unit names in order; each one is 1,024 times bigger than the one before it
    let u = 0, v = b;  // u counts how many times the size has been divided by 1,024; v is the size in the current unit
    while (v >= 1024 && u < U.length - 1) { v /= 1024; u++; }  // keeps dividing by 1,024 and moving up one unit while the number is still 1,024 or more, stopping at the largest unit
    const txt = Number.isInteger(v) ? String(v) : v >= 100 ? String(Math.round(v)) : v.toFixed(1).replace(/\.0$/, '');  // txt: whole numbers stay as they are, 100 or more are rounded, smaller ones keep one decimal place (a trailing ".0" is dropped)
    return txt + ' ' + U[u];  // hands back the number followed by its unit, e.g. "1.5 MB"
  }  // ends bytes()
  // Multi-line SVG text.
  function mtext(s, x, y, lines, attrs = {}, lh = 18) {  // mtext(s, x, y, lines, attrs, lh): one SVG label with several lines; SVG (the browser's drawing format) never wraps text by itself
    const t = s('text', Object.assign({ x, y }, attrs));  // t: the text element placed at (x, y), with any extra settings (size, weight, alignment) merged in
    [].concat(lines).forEach((ln, i) => t.append(s('tspan', { x, dy: i === 0 ? 0 : lh }, ln)));  // each line becomes a tspan (a piece of SVG text); every line after the first moves down by lh pixels
    return t;  // hands back the finished label so the caller can add it to a drawing
  }  // ends mtext()
  // A clickable SVG group that also works from the keyboard.
  function hotGroup(ctx, onAct, label, ...kids) {  // hotGroup(ctx, onAct, label, ...kids): wraps drawing parts in a group that behaves like a button for both mouse and keyboard
    const g = ctx.s('g', { class: 'hot', tabindex: 0, role: 'button', 'aria-label': label }, ...kids);  // g: the group; class hot gives a pointer cursor, tabindex 0 lets the Tab key reach it, role and aria-label announce it to screen readers
    g.addEventListener('click', onAct);  // a mouse click on any part of the group runs onAct
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAct(); } });  // Enter or Space on the focused group also runs onAct; preventDefault stops Space from scrolling the page
    return g;  // hands the group back so it can go into a drawing
  }  // ends hotGroup()

  // One drawing shown whole on wide screens, or as several cropped views stacked on small screens.
  function multiView(ctx, full, crops) {  // multiView(ctx, full, crops): one SVG of a whole drawing on wide screens, or several cropped SVGs stacked on phone-width screens
    const boxes = (ctx.narrow ? crops : [full]).map((vb) => ctx.s('svg', { viewBox: vb, width: '100%', style: ctx.narrow ? { maxWidth: vb.split(' ')[2] + 'px' } : {} }));  // one svg per viewBox (the window of drawing coordinates shown): the full view normally, each crop on small screens, never wider than its own size
    boxes.set = (items) => boxes.forEach((b, i) => b.replaceChildren(...(i === 0 ? items : items.map((n) => n.cloneNode(true)))));  // boxes.set(items): fills every view with the same parts; the first gets the originals and the rest get copies, since an element can sit in only one place
    return boxes;  // hands back the list of views; the caller puts them all on the page and calls set() to draw
  }  // ends multiView()
  const big2 = (k) => (2n ** BigInt(k)).toLocaleString('en-US');  // big2(k): writes 2 to the power k exactly, with commas; BigInt (whole numbers of any size) keeps huge powers from being rounded
  const field = (v, lab, col) => `<div class="bf" style="color:${col}"><span class="bv">${v}</span><span class="bl">${lab}</span></div>`;  // field(v, lab, col): HTML for one coloured box of address bits with its label underneath, such as the 10 root-index bits

  /* Step 5, tab 1: how big a one-level page table gets. */
  function tabSize(panel, ctx) {  // tabSize(panel, ctx): draws tab 1 of step 5, how big a one-level page table gets; runs when that tab is opened
    const { h } = ctx;  // takes the HTML builder h out of ctx so the code below can just write h(...)
    let n = 32, p = 12, e = 4;  // the three settings the controls change: n = virtual address bits, p = page-size bits (12 means 4 KB), e = bytes per table entry
    const out = h('div', { class: 'stack', style: { gap: '8px' } });  // out: the right-hand column that receives the size results
    const verdict = h('div', { class: 'stack', style: { gap: '8px' } });  // verdict: the box under the explanation that says whether two levels are enough
    function calc() {  // calc(): recomputes every number and rewrites both boxes; runs once at the start and again whenever a control moves
      const vp = n - p, tableB = 2 ** vp * e, tablePages = tableB / 2 ** p, rootB = tablePages * e;  // vp = bits in the page number; tableB = bytes of a one-level table; tablePages = pages it fills; rootB = bytes of a root with one entry per such page
      const ratio = tableB / 2 ** 34;  // ratio: how many times bigger the table is than a 16 GB main memory (2 to the 34 bytes)
      const row = (k, v, cls) => `<div class="b ${cls || ''}" style="text-align:right">${v}</div><div>${k}</div>`;  // row(k, v, cls): one line of the results grid, the value bold and right-aligned (optionally coloured) beside its description
      out.innerHTML = `<div class="card tight"><div class="kv small">` +  // starts the results card; class kv lays its rows out as a two-column grid
        row(`virtual pages per process (2<sup>${n}</sup> ÷ 2<sup>${p}</sup> = 2<sup>${vp}</sup>)`, big2(vp)) +  // row 1: how many virtual pages one process has (2 to the n divided by 2 to the p)
        row(`one-level page table: 2<sup>${vp}</sup> entries × ${e} bytes, <b>for every process</b>`, bytes(tableB), 'c-bad') +  // row 2: the size of a one-level page table, shown in red because every process needs its own
        row('pages that this table itself fills', tablePages >= 1 ? big2(Math.log2(tablePages)) : 'less than 1') +  // row 3: how many pages that table itself fills, or "less than 1" when it fits inside a single page
        row(`root table: one ${e}-byte entry per page of the table`, bytes(Math.max(rootB, e)), 'c-ok') +  // row 4: the size of a root table holding one entry per page of the table, in green (never less than one entry)
        `</div></div>` +  // closes the grid and the card
        (tableB > 2 ** 34 ? `<div class="callout bad m0 small" data-label="Impossible to keep in memory">One process’s table would need ${bytes(tableB)}: about ${ratio >= 10 ? comma(Math.round(ratio)) : ctx.util.fmt(ratio, 1)} times a 16 GB main memory.</div>` : '');  // only when the table is over 16 GB: adds a red callout saying how many times main memory one process's table would need
      verdict.innerHTML = (rootB <= 2 ** p  // verdict: picks one of two callouts depending on whether the root table fits in a single page
          ? `<div class="callout tip m0 small" data-label="Two levels are enough">The root table needs ${bytes(Math.max(rootB, e))}, which fits in one ${bytes(2 ** p)} page. Only the root must stay in memory; the pages of the user table can be paged in and out like any other page.</div>`  // green callout: the root fits in one page, so only the root has to stay in memory and the rest can be paged
          : `<div class="callout warn m0 small" data-label="Two levels are not enough">Even the root would need ${bytes(rootB)}, more than one page. Real 64-bit machines add more levels: x86-64 walks 4 levels for 48-bit addresses and 5 for 57-bit ones. Inverted tables (third tab) are another escape.</div>`);  // amber callout: even the root is bigger than one page, so real 64-bit machines add more levels or use an inverted table
      // What must actually be resident for a program using three regions: code 1 MB, heap 4 MB, stack 1 MB.
      const reach = (2 ** p / e) * 2 ** p;          // bytes of address space one page of the user table maps
      const touched = [2 ** 20, 2 ** 22, 2 ** 20].reduce((a, r) => a + Math.ceil(r / reach), 0);  // touched: how many pages of the user table the three regions need, each region rounded up to whole table pages
      const two = Math.max(rootB, e) + touched * 2 ** p, frac = Math.max(0.6, Math.min(100, (100 * two) / tableB));  // two: bytes needed with two levels (root plus those pages); frac: that as a percent of the one-level table, kept between 0.6 and 100 so the bar shows
      out.insertAdjacentHTML('beforeend', `<div class="card tight small"><div class="b" style="margin-bottom:4px">Table memory actually needed by a program using 6 MB (1 MB code, 4 MB heap, 1 MB stack)</div>` +  // appends a second card under the results; its bold heading names the 6 MB example program
        `<div class="row nw" style="gap:8px"><span style="width:84px">one level</span><div class="meter grow" style="height:12px"><i style="width:100%;background:var(--bad)"></i></div><b style="width:76px;text-align:right">${bytes(tableB)}</b></div>` +  // bar for one level: always full width and red, with the one-level table size at its right end
        `<div class="row nw" style="gap:8px;margin-top:4px"><span style="width:84px">two levels</span><div class="meter grow" style="height:12px"><i style="width:${frac}%;background:var(--ok)"></i></div><b style="width:76px;text-align:right">${bytes(two)}</b></div>` +  // bar for two levels: frac percent wide and green, with the two-level total at its right end
        `<div class="xs muted" style="margin-top:4px">Two levels: the root plus the ${touched} page${touched > 1 ? 's' : ''} of the user table that map those regions (each maps ${bytes(reach)}). The other entries of the user table are never even created.</div></div>`);  // fine print: how many user-table pages are needed and how much address space each one maps
    }  // ends calc()
    const sN = ctx.ui.slider({ label: 'Virtual address bits', min: 16, max: 64, step: 4, value: n, onInput: (v) => { n = v; calc(); } });  // slider for the virtual address size, 16 to 64 bits in steps of 4; moving it stores the new n and recomputes
    const sP = ctx.ui.slider({ label: 'Page size', min: 9, max: 16, value: p, format: (v) => bytes(2 ** v), onInput: (v) => { p = v; calc(); } });  // slider for the page size as a power of 2, from 512 bytes (2 to the 9) to 64 KB (2 to the 16), shown in bytes; it sets p
    const sE = ctx.ui.seg([{ value: 4, label: '4-byte entries' }, { value: 8, label: '8-byte entries' }], e, (v) => { e = v; calc(); });  // two-button switch for 4-byte or 8-byte table entries; it sets e
    calc();  // fills in the results once before the tab appears
    panel.append(h('div', { class: 'split', style: { height: 'auto' } },  // lays the tab out in two columns (class split); height auto lets the columns grow with their content
      h('div', { class: 'stack', style: { gap: '10px' } },  // left column: a vertical stack of text and controls with 10px gaps
        h('p', { class: 'm0', html: 'A page table needs one entry for every page of the <span class="t">virtual address space</span>, used or not, so it grows with the address space, not with the program.' }),  // opening paragraph: a page table needs an entry for every virtual page, so it grows with the address space, not the program
        h('div', { class: 'card stack', style: { gap: '10px', padding: '10px 12px' } }, sN, sP, sE),  // a card holding the two sliders and the entry-size switch
        h('p', { class: 'small m0', html: '<b>The fix:</b> keep page tables in <i>virtual</i> memory too, so they can be paged. A two-level scheme adds a small <span class="t">root page table</span> (page directory) whose entries point to the pages of the user page table. With 32 bits, 4 KB pages and 4-byte entries, the 4 MB table fills 2<sup>10</sup> pages, so the root has 2<sup>10</sup> entries: exactly 4 KB.' }),  // paragraph: the fix is to page the page table itself under a small root table, with the 32-bit worked example
        verdict),  // the verdict box goes last in the left column, which this line closes
      out));  // the results column goes on the right; closes the two-column layout and the append
  }  // ends tabSize()

  /* Step 5, tab 2: a 10/10/12 two-level walk with faults at either level. */
  function tabTwoLevel(panel, ctx) {  // tabTwoLevel(panel, ctx): draws tab 2 of step 5, a 32-bit address walked through a two-level table where either level may be on disk
    const { h, s } = ctx;  // takes the HTML builder h and the SVG builder s out of ctx
    const ADDRS = [0x00403A7C, 0x00401100, 0x00800ABC, 0x7FFFF123];  // ADDRS: the four example virtual addresses, one button each under the drawing
    const ROOT_AT = 12;                             // the root table lives in frame 12
    let root, tp, va = ADDRS[0], fixes, nextFree;   // fixes: faults handled, per address
    function init() {  // init(): sets up, or resets, the root table, the pages of the user table and the list of free frames
      root = { 1: { p: 1, f: 673 }, 2: { p: 0, f: null }, 511: { p: 1, f: 900 } };  // root table: entries 1 and 511 point to table pages in frames 673 and 900; entry 2 has P = 0, so that table page is on disk
      tp = { 1: { 3: { p: 1, f: 5021 }, 1: { p: 0, f: null } }, 2: { 0: { p: 0, f: null } }, 511: { 1023: { p: 1, f: 77 } } };  // tp: the pages of the user table, looked up by root index then table index; an entry with P = 0 means its data page is on disk
      fixes = {}; nextFree = [1440, 2205, 3120];  // no faults handled yet; nextFree: the frames the OS hands out, in order, each time it loads a page
    }  // ends init()
    const bitsEl = h('div', { class: 'row', style: { gap: '12px', alignItems: 'flex-end' } });  // bitsEl: the row that shows the current address split into its three coloured bit fields
    const views = multiView(ctx, '0 0 1100 214', ['0 66 198 82', '196 0 280 214', '476 0 330 214', '806 36 294 148']);  // views: the drawing, whole on wide screens or as four crops (root pointer, root table, table page, data frame) on small screens
    const narr = h('div', { class: 'card tight small', style: { minHeight: '70px' } });  // narr: the card under the drawing that explains the current address in words; a minimum height keeps the layout from jumping
    const act = h('div', { class: 'row', style: { gap: '8px' } });  // act: the row of buttons: one per address, the OS fix button when needed, and Reset
    function rowsAround(x, y, w, idx, ent, label) {  // rowsAround(x, y, w, idx, ent, label): draws three rows of a table, the entry in use plus its neighbours above and below
      const k = [];  // k collects the drawing parts for these rows
      [idx - 1, idx, idx + 1].forEach((j, n) => {  // visits the entries just before, at and just after idx; n is the row position 0, 1 or 2
        if (j < 0 || j > 1023) return;  // skips a neighbour that would fall outside the valid entries 0 to 1023
        const yy = y + n * 34, cur = j === idx;  // yy: the row's top edge, 34 pixels per row; cur is true for the entry actually being used
        const en = cur ? ent : null;  // en: that entry's contents, known only for the current row
        k.push(s('rect', { x: x + 8, y: yy, width: w - 16, height: 28, rx: 6, class: cur ? (en && en.p ? 's-ok' : 's-bad') : 's-panel', 'stroke-width': cur ? 2.2 : 1, style: cur ? '' : 'opacity:.55' }),  // the row's box: green if the current entry is present, red if it is not, plain and faded for the neighbouring rows
          s('text', { x: x + 18, y: yy + 19, 'font-size': 13.5, 'font-weight': cur ? 800 : 500, class: cur ? '' : 's-sub' }, `${label} ${j}` + (cur ? (en && en.p ? `: P=1, frame ${en.f}` : ': P=0, on disk') : '')));  // the row's text, e.g. "entry 3: P=1, frame 5021"; neighbours show only their number, in lighter grey
      });  // ends the loop over the three rows
      return k;  // hands the row parts back to paint()
    }  // ends rowsAround()
    function paint() {  // paint(): redraws the bit fields, the drawing, the buttons and the explanation for the current address va
      const r = va >>> 22, t = (va >>> 12) & 1023, off = va & 4095;  // splits va: the top 10 bits (shift right 22) are the root index, the next 10 the table index, the low 12 the offset in the page
      bitsEl.innerHTML = `<span class="small b">Virtual ${hex(va)}</span><div class="bits">${field(bin(r, 10), 'root index ' + r, 'var(--os)')}${field(bin(t, 10), 'table index ' + t, 'var(--warn)')}${field(bin(off, 12), 'offset ' + off, 'var(--mem)')}</div>`;  // writes the address in hex and the three coloured bit boxes: root index in purple, table index in amber, offset in green
      const re = root[r] || { p: 0, f: null }, te = re.p ? ((tp[r] || {})[t] || { p: 0, f: null }) : null;  // re: the root entry (a missing one counts as P = 0); te: the user-table entry, looked up only when its table page is present
      const k = [];  // k collects every part of the drawing
      k.push(s('rect', { x: 0, y: 72, width: 150, height: 70, rx: 10, class: 's-cpu', 'stroke-width': 2 }),  // first box: the root table pointer register, which tells the hardware where the root table starts
        mtext(s, 75, 98, ['Root table', `pointer → frame ${ROOT_AT}`], { 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 700 }, 18),  // its two-line label naming the frame that holds the root table
        s('path', { d: 'M150,107 H196', class: 's-line', 'marker-end': 'url(#arr)' }));  // arrow from the pointer box to the root table
      k.push(s('rect', { x: 200, y: 4, width: 270, height: 206, rx: 10, class: 's-os', 'stroke-width': 2 }),  // second box: the root page table, in the operating-system purple
        mtext(s, 335, 26, ['Root page table', '1,024 entries · always in memory'], { 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 700 }, 17),  // its title, with a reminder that the root has 1,024 entries and always stays in memory
        ...rowsAround(200, 66, 270, r, re, 'entry'));  // the three rows around the root entry this address uses
      const okRoot = re.p;  // okRoot is true when the root entry says the page of the user table is in memory
      k.push(s('path', { d: 'M462,' + (66 + 34 + 14) + ' H516', class: 's-line', style: okRoot ? '' : 'stroke:var(--bad)', 'stroke-dasharray': okRoot ? '' : '5 4', 'marker-end': okRoot ? 'url(#arr)' : 'url(#arr-bad)' }));  // arrow from the root entry to the table page: solid if present, red and dashed if that page is on disk
      k.push(s('rect', { x: 520, y: 4, width: 280, height: 206, rx: 10, class: okRoot ? 's-mem' : 's-bad', 'stroke-width': 2, 'stroke-dasharray': okRoot ? '' : '7 5' }),  // third box: the page of the user table, green if in memory, red with a dashed edge if on disk
        mtext(s, 660, 26, [`Page ${r} of the user page table`, okRoot ? `in frame ${re.f}` : 'NOT in memory (on disk)'], { 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 700 }, 17));  // its title: which page of the user table this is, and which frame holds it or that it is on disk
      if (okRoot) k.push(...rowsAround(520, 66, 280, t, te, 'entry'));  // when that page is in memory, draws the three rows around the table entry this address uses
      else k.push(mtext(s, 660, 110, ['Its entries cannot be read', 'until the OS loads this page.'], { 'text-anchor': 'middle', 'font-size': 13.5, class: 's-sub' }, 18));  // otherwise a grey note that its entries cannot be read until the OS loads the page
      const okData = okRoot && te.p;  // okData is true only when both levels are present, so the data page is in memory
      k.push(s('path', { d: 'M792,114 H846', class: okData ? 's-line' : 's-muted', 'marker-end': okData ? 'url(#arr)' : 'url(#arr-muted)' }));  // last arrow, to the data frame: solid when the walk succeeds, faint grey otherwise
      k.push(s('rect', { x: 850, y: 40, width: 248, height: 140, rx: 10, class: okData ? 's-mem' : 's-panel', 'stroke-width': 2 }),  // fourth box: the frame holding the data, green when reached, plain otherwise
        okData ? mtext(s, 974, 76, [`Frame ${te.f}: the data`, `byte at offset ${off}`, `real address ${hex(te.f * 4096 + off)}`, `(${comma(te.f * 4096 + off)})`], { 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 700 }, 22)  // on success, its label gives the frame, the offset, and the real address in hex and in decimal
          : mtext(s, 974, 100, ['No real address yet'], { 'text-anchor': 'middle', 'font-size': 14, class: 's-sub' }, 18));  // otherwise it just says there is no real address yet
      views.set(k);  // puts the finished parts into every view of the drawing
      act.replaceChildren(...ADDRS.map((a) => h('button', { class: 'btn sm mono' + (a === va ? ' on' : ''), onclick: () => { va = a; paint(); } }, hex(a))),  // one button per example address, the current one lit; a click switches to that address and redraws
        !okData ? h('button', { class: 'btn sm intr', onclick: fix }, okRoot ? 'OS: load the data page' : 'OS: load the page-table page') : null,  // when the walk is blocked, a red OS button that loads the missing page: the table page first, else the data page
        h('div', { class: 'grow' }), h('button', { class: 'btn sm ghost', onclick: () => { init(); paint(); } }, 'Reset'));  // a spacer pushes Reset to the right end; Reset puts back the starting tables and redraws
      narr.innerHTML = !okRoot  // narr: the explanation, chosen by how far the walk got
        ? `<b class="c-bad">Fault while walking the table.</b> Root entry ${r} has P = 0: page ${r} of the user page table is itself on disk. The OS must bring that page in first, before it can even look up the data page.`  // case 1: the root entry has P = 0, so the page of the table itself must be loaded before anything else
        : !okData ? `<b class="c-bad">Page fault on the data page.</b> Root entry ${r} leads to the page-table page in frame ${re.f}; its entry ${t} has P = 0, so the data page is on disk.`  // case 2: the table page is in memory but its entry has P = 0, an ordinary page fault on the data page
          : `<b class="c-ok">Translated.</b> Root entry ${r} → page-table page in frame ${re.f} → entry ${t} → frame ${te.f}. Real address = ${te.f} × 4096 + ${off} = ${comma(te.f * 4096 + off)}. Without a TLB that cost <b>3 memory accesses</b>: root entry, table entry, then the data itself.` + (fixes[va] ? ` <span class="muted">(${fixes[va]} fault${fixes[va] > 1 ? 's were' : ' was'} handled on the way.)</span>` : '');  // case 3: translated; shows the chain of lookups, the real address arithmetic, the 3 memory accesses, and how many faults were fixed on the way
    }  // ends paint()
    function fix() {  // fix(): what the OS does when the student presses the load button; it loads whichever page is missing
      const r = va >>> 22, t = (va >>> 12) & 1023;  // splits the current address again into root index r and table index t
      if (!root[r] || !root[r].p) root[r] = { p: 1, f: nextFree.shift() || 1500 };  // if the root entry is missing or absent, loads the table page into the next free frame (1500 if the list has run out)
      else { tp[r] = tp[r] || {}; tp[r][t] = { p: 1, f: nextFree.shift() || 1500 }; }  // otherwise loads the data page, creating that table page's record if needed and marking its entry present
      fixes[va] = (fixes[va] || 0) + 1; paint();  // counts one more fault handled for this address, then redraws
    }  // ends fix()
    init(); paint();  // sets up the starting tables and draws the first address when the tab opens
    panel.append(h('div', { class: 'stack', style: { gap: '8px' } },  // adds the tab's content to the panel as one vertical stack
      h('p', { class: 'small m0', html: '32-bit addresses, 4 KB pages, 4-byte entries. The address splits <b>10 | 10 | 12</b>: 10 bits pick one of the root’s 2<sup>10</sup> entries, 10 bits pick an entry inside that page of the user table, and 12 bits are the offset in a 4 KB page. Try each address.' }),  // explanation paragraph: the 10 | 10 | 12 split of a 32-bit address and what each part selects
      bitsEl, h('div', { class: 'card white stack', style: { padding: '6px 8px', gap: '6px' } }, ...views), act, narr));  // then the bit fields, the drawing inside a white card, the button row and the explanation card; closes the stack
  }  // ends tabTwoLevel()

  /* Step 5, tab 3: an inverted page table searched through a hash anchor table and chains. */
  function tabInverted(panel, ctx) {  // tabInverted(panel, ctx): draws tab 3 of step 5, an inverted page table searched through a hash anchor table and chains
    const { h, s } = ctx;  // takes the HTML builder h and the SVG builder s out of ctx
    const NF = 8;  // NF: the number of frames of real memory in this small example, so the table has 8 entries
    const IPT = [   // index = frame number
      { pg: 13, pid: 1, r: 1, m: 0, next: null }, { pg: 3, pid: 2, r: 0, m: 0, next: 6 }, { pg: 0, pid: 1, r: 1, m: 1, next: null }, { pg: 6, pid: 1, r: 1, m: 0, next: null },  // frames 0 to 3: each entry names the page and process (pid) it holds, the R and M bits, and next, the following entry in its chain
      { pg: 3, pid: 1, r: 1, m: 1, next: 1 }, { pg: 1, pid: 2, r: 0, m: 0, next: null }, { pg: 11, pid: 1, r: 1, m: 0, next: null }, { pg: 5, pid: 2, r: 1, m: 1, next: 0 }];  // frames 4 to 7; for example frame 4 holds page 3 of process 1 and chains on to frame 1, which holds page 3 of process 2
    const ANCHOR = [2, 5, null, 4, null, 7, 3, null];   // hash value → first entry of its chain
    let pid = 1, page = 11, gen = 0, probe = -1, seen = [], result = null;  // current choice (process 1, page 11); gen numbers each lookup; probe = entry being checked; seen = entries already ruled out; result = outcome
    // Geometry: small screens get a compact table (shorter columns, two-line footnote) so the text stays readable.
    const G = ctx.narrow  // G: the drawing's measurements, chosen by the phone-width layout flag
      ? { W: 400, H: 334, aW: 92, aC: [26, 70], tX: 110, tW: 236, c: [128, 174, 216, 260, 310], b0: 362, bk: 6, t: ['Hash anchors', 'Inverted table: one entry per frame'], tx: [4, 228] }  // small-screen measurements: a 400-wide drawing with tighter columns and shorter titles
      : { W: 700, H: 314, aW: 128, aC: [30, 102], tX: 204, tW: 380, c: [240, 320, 390, 460, 545], b0: 610, bk: 9, t: ['Hash anchor table', 'Inverted page table: one entry per frame'], tx: [70, 440] };  // wide-screen measurements: a 700-wide drawing with roomier columns and longer titles
    const svg = s('svg', { viewBox: `0 0 ${G.W} ${G.H}`, width: '100%' });  // svg: the drawing area, sized from G
    const narr = h('div', { class: 'card tight small', style: { minHeight: '96px' } });  // narr: the card that narrates the lookup step by step; its minimum height keeps the layout from jumping
    const RY = (i) => 46 + i * 31, CX = G.tX + G.tW;     // CX: right edge of the table, where chain arrows start
    function paint() {  // paint(): redraws the anchor table, the inverted table and the chain arrows for the current state
      const hv = page % NF, k = [];  // hv: the hash of the chosen page, page mod 8; k collects the drawing parts
      k.push(s('text', { x: G.tx[0], y: 18, 'text-anchor': ctx.narrow ? 'start' : 'middle', 'font-size': 13.5, 'font-weight': 800, class: 'tx-os' }, G.t[0]),  // title over the anchor table, in purple; left-aligned on small screens so it does not run off the edge
        s('text', { x: G.tx[1], y: 18, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 800, class: 'tx-mem' }, G.t[1]));  // title over the inverted table, in green
      ['hash', 'first'].forEach((t, j) => k.push(s('text', { x: G.aC[j], y: 38, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, t)));  // the two column headings of the anchor table: hash value and first entry
      ['frame', 'page', 'PID', 'R M', 'chain'].forEach((t, j) => k.push(s('text', { x: G.c[j], y: 38, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, t)));  // the five column headings of the inverted table: frame, page, PID, R M bits and chain
      for (let i = 0; i < NF; i++) {  // draws one row of each table per frame, 8 rows in all
        const y = RY(i), on = i === hv;  // y: this row's top edge; on is true for the anchor slot the chosen page hashes to
        k.push(s('rect', { x: 4, y, width: G.aW, height: 26, rx: 6, class: on ? 's-warn' : 's-panel', 'stroke-width': on ? 2.2 : 1 }),  // the anchor row's box, amber when it is the slot being used
          s('text', { x: G.aC[0], y: y + 18, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700 }, String(i)),  // the anchor row's hash value
          s('text', { x: G.aC[1], y: y + 18, 'text-anchor': 'middle', 'font-size': 14, class: ANCHOR[i] == null ? 's-sub' : 's-monot' }, ANCHOR[i] == null ? '–' : '→ ' + ANCHOR[i]));  // where that slot's chain starts, or a dash when no page hashes there
        const e = IPT[i], isProbe = i === probe, wasSeen = seen.includes(i);  // e: this frame's entry; isProbe: being checked now; wasSeen: already checked and rejected
        const hit = result && result.found === i;  // hit is true for the entry where the lookup found its page
        k.push(s('rect', { x: G.tX, y, width: G.tW, height: 26, rx: 6, class: hit ? 's-ok' : isProbe ? 's-warn' : wasSeen ? 's-bad' : 's-panel', 'stroke-width': hit || isProbe ? 2.4 : 1 }),  // the table row's box: green for the match, amber while being probed, red once rejected, plain otherwise
          s('text', { x: G.c[0], y: y + 18, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800 }, String(i)),  // column 1: the frame number, which is simply the row's position in the table
          s('text', { x: G.c[1], y: y + 18, 'text-anchor': 'middle', 'font-size': 14 }, String(e.pg)),  // column 2: the page number stored in the entry
          s('text', { x: G.c[2], y: y + 18, 'text-anchor': 'middle', 'font-size': 14 }, String(e.pid)),  // column 3: the process ID stored in the entry
          s('text', { x: G.c[3], y: y + 18, 'text-anchor': 'middle', 'font-size': 13.5, class: 's-monot' }, e.r + ' ' + e.m),  // column 4: the referenced and modified bits
          s('text', { x: G.c[4], y: y + 18, 'text-anchor': 'middle', 'font-size': 14, class: e.next == null ? 's-sub' : 's-monot' }, e.next == null ? 'end' : '→ ' + e.next));  // column 5: the next entry in the chain, or "end"
        if (e.next != null) {  // when this entry chains on to another one
          const y1 = RY(i) + 13, y2 = RY(e.next) + 13, bend = G.b0 + Math.abs(e.next - i) * G.bk;  // y1, y2: the middles of the two rows; bend: how far right the curve swings, more for rows further apart
          k.push(s('path', { d: `M${CX},${y1} C${bend},${y1} ${bend},${y2} ${CX + 4},${y2}`, fill: 'none', class: 's-muted', 'stroke-width': 1.6, 'marker-end': 'url(#arr-muted)' }));  // draws a faint curved arrow on the right of the table from this entry to the next one in its chain
        }  // ends the chain-arrow case
      }  // ends the loop over rows
      const ax = 4 + G.aW, mid = (ax + G.tX) / 2;  // ax: right edge of the anchor table; mid: halfway between the two tables, where the curve bends
      if (ANCHOR[hv] != null) k.push(s('path', { d: `M${ax},${RY(hv) + 13} C${mid},${RY(hv) + 13} ${mid},${RY(ANCHOR[hv]) + 13} ${G.tX - 4},${RY(ANCHOR[hv]) + 13}`, fill: 'none', class: 's-line', style: 'stroke:var(--warn)', 'marker-end': 'url(#arr-warn)' }));  // if the chosen slot is not empty, an amber curved arrow from that slot to the first entry of its chain
      k.push(mtext(s, 4, 308, ctx.narrow ? ['R = referenced, M = modified; all entries valid.', 'Arrows on the right are the chains.'] : ['R = referenced, M = modified; every entry here is valid. Arrows on the right are the chains.'], { 'font-size': 12.5, class: 's-sub' }, 17));  // footnote explaining R and M and the chain arrows, split over two lines on small screens
      svg.replaceChildren(...k);  // replaces the old drawing with the new parts
    }  // ends paint()
    async function look() {  // look(): the animated lookup run by the Look it up button; async lets it pause between probes with await
      const my = ++gen, hv = page % NF;  // my: this lookup's number, so an older lookup still pausing can tell it was replaced; hv: the hash slot
      seen = []; result = null; probe = -1;  // clears the marks left by any previous lookup
      narr.innerHTML = `<b>Look up page ${page} of process ${pid}.</b> hash(${page}) = ${page} mod 8 = <b>${hv}</b>. ` + (ANCHOR[hv] == null ? 'The anchor slot is empty…' : `The anchor table says the chain starts at entry ${ANCHOR[hv]}…`);  // first narration: the hash arithmetic and where the anchor table says the chain starts, or that the slot is empty
      paint();  // draws the starting state
      let i = ANCHOR[hv], steps = 0;  // i: the entry to check next, starting from the anchor; steps counts the probes
      while (i != null) {  // keeps probing while there is an entry left in the chain
        probe = i; steps++; paint();  // marks entry i as the one being probed, counts the probe and redraws it in amber
        await ctx.sleep(550);  // waits 550 milliseconds so the student can follow each probe
        if (!ctx.alive || my !== gen) return;  // stops quietly if the student left the slide or started a newer lookup in the meantime
        const e = IPT[i];  // e: the entry being probed
        if (e.pg === page && e.pid === pid) { result = { found: i }; probe = -1; paint(); narr.innerHTML = `<b class="c-ok">Found after ${steps} probe${steps > 1 ? 's' : ''}.</b> Entry ${i} holds page ${page} of process ${pid}, and the entry’s position <b>is</b> the frame number: frame ${i}. The real address is frame ${i} followed by the offset.`; return; }  // a match needs both the page number and the process ID; the entry's position is the frame, so the narration announces it and the lookup ends
        seen.push(i);  // no match: remembers this entry so it is drawn in red
        narr.innerHTML = `Entry ${i} holds page ${e.pg} of process ${e.pid}: ` + (e.pg === page ? '<b>same page number, different process</b>, so no match. ' : 'no match. ') + (e.next == null ? 'Its chain ends here.' : `Follow its chain to entry ${e.next}…`);  // narration for a rejected entry, pointing out when the page number matched but the process did not, and where the chain goes next
        i = e.next;  // moves to the next entry in the chain (null ends the loop)
      }  // ends the probing loop
      probe = -1; result = { found: null }; paint();  // the chain ran out without a match: clears the probe mark, records "not found" and redraws
      narr.innerHTML = `<b class="c-bad">Not in the table after ${steps} probe${steps === 1 ? '' : 's'}: page fault.</b> No frame holds page ${page} of process ${pid}. The OS finds the page on disk using its own per-process records (an inverted table only describes what is in memory) and loads it.`;  // narration for the miss: a page fault, and the OS must look the page up in its own per-process records on disk
    }  // ends look()
    function reset() { gen++; seen = []; result = null; probe = -1; narr.innerHTML = '<b>Pick a process and a page, then look it up.</b> <span class="muted">Try page 11 of process 1 (a 3-entry chain), then page 11 of process 2: same page number, so it needs the process ID to tell them apart.</span>'; paint(); }  // reset(): cancels any running lookup (gen++), clears all marks, shows the starting hint, and redraws; runs on every change of process or page
    const segP = ctx.ui.seg([{ value: 1, label: 'Process 1' }, { value: 2, label: 'Process 2' }], pid, (v) => { pid = v; reset(); });  // switch for process 1 or process 2; choosing one stores the new pid and resets
    const sl = ctx.ui.slider({ label: 'Page number', min: 0, max: 15, value: page, onInput: (v) => { page = v; reset(); } });  // slider for the page number, 0 to 15; moving it stores the new page and resets
    reset();  // shows the starting state when the tab opens
    const ent = (16 * 2 ** 30) / 4096;  // ent: how many frames a 16 GB memory has with 4 KB frames, which is also the number of table entries
    panel.append(h('div', { class: 'split l', style: { height: 'auto' } },  // lays the tab out in two columns, the left one smaller (class split l)
      h('div', { class: 'stack', style: { gap: '8px' } },  // left column: a vertical stack with 8px gaps
        h('p', { class: 'small m0', html: 'An <span class="t">inverted page table</span> turns the idea around: one entry per <b>frame</b> of real memory, shared by all processes. Each entry holds a page number, a process ID, control bits (valid, referenced, modified, protection, lock) and a chain pointer. A <span class="t">hash function</span> turns the page number into a slot of a small hash anchor table, which names the first entry to try; entries whose pages hash alike are chained.' }),  // paragraph: what an inverted page table is, what each entry holds, and how the hash anchor table and chains find an entry
        segP, sl,  // the process switch and the page slider
        h('div', { class: 'row', style: { gap: '8px' } }, h('button', { class: 'btn sm primary', onclick: look }, 'Look it up'), h('button', { class: 'btn sm ghost', onclick: reset }, 'Reset')),  // the Look it up button, which starts the animated search, and Reset
        narr,  // the narration card
        h('p', { class: 'xs muted m0', html: `Size depends only on real memory: 16 GB in 4 KB frames = ${comma(ent)} entries; at 8 bytes each, ${bytes(ent * 8)} (${ctx.util.fmt((100 * 8) / 4096, 2)}% of memory), however many processes run. Used on some 64-bit machines: PowerPC, UltraSPARC, IA-64.` })),  // fine print: the table's size depends only on real memory (worked out for 16 GB), with machines that used this design
      h('div', { class: 'card white', style: { padding: '6px 8px', display: 'grid', alignItems: 'center' } }, svg)));  // right column: the drawing inside a white card; closes both columns and the append
  }  // ends tabInverted()

  /* Step 6, tab 1: a 4-entry TLB (LRU) in front of an 8-entry page table, with the lookup flowchart. */
  function tabTLB(panel, ctx) {  // tabTLB(panel, ctx): draws tab 1 of step 6, a 4-entry TLB in front of the page table with a flowchart of each lookup
    const { h, s } = ctx;  // takes the HTML builder h and the SVG builder s out of ctx
    const REFS = [1, 1, 2, 1, 4, 2, 6, 1, 2, 7, 1, 2, 4, 6, 1, 2, 7, 1];  // REFS: the page numbers the program refers to, in order; Step and Run all work through this list
    const PT0 = { 0: null, 1: 9, 2: 4, 3: null, 4: 14, 5: null, 6: 11, 7: null };  // PT0: the starting page table, page number to frame number; null means the page is on disk (P = 0)
    const N = {  // N: the flowchart's boxes, each with its centre, width and height, its shape (pill or diamond) and its lines of text
      cpu: { x: 215, y: 20, w: 340, h: 32, pill: 1, t: ['Processor issues a virtual address (page p)'] },  // top box: the processor issues a virtual address
      tlb: { x: 215, y: 82, w: 210, h: 56, dia: 1, t: ['Is page p', 'in the TLB?'] },  // decision diamond: is the page in the TLB?
      hit: { x: 72, y: 150, w: 136, h: 48, t: ['Frame number', 'from the TLB'] },  // box on the left for a hit: the frame number comes straight from the TLB
      pte: { x: 215, y: 150, w: 150, h: 48, t: ['Read the PTE from', 'the page table'] },  // box for a miss: read the page table entry (PTE) from memory
      pq: { x: 215, y: 220, w: 120, h: 48, dia: 1, t: ['P = 1 ?'] },  // decision diamond: is the present bit set?
      flt: { x: 355, y: 220, w: 128, h: 82, t: ['Page fault:', 'OS loads the', 'page, updates', 'the table'] },  // box on the right for a page fault: the OS loads the page and updates the table
      upd: { x: 215, y: 288, w: 150, h: 42, t: ['Copy the PTE', 'into the TLB'] },  // box: copy the entry into the TLB for next time
      ra: { x: 150, y: 348, w: 280, h: 34, t: ['Real address = frame + offset'] },  // box: form the real address from the frame number and the offset
      mem: { x: 150, y: 398, w: 280, h: 34, pill: 1, t: ['Memory cache, then main memory'] },  // bottom box: the access goes to the memory cache, then main memory
    };  // closes the N table
    const E = {  // E: the flowchart's arrows as SVG path strings (M = move to a point, H and V = draw a horizontal or vertical line to)
      a: 'M215,36 V52', hitE: 'M110,82 H72 V124', missE: 'M215,110 V124', b: 'M215,174 V194', yes: 'M215,244 V265',  // arrows: processor to TLB test, the hit branch, the miss branch, PTE to the P test, and the yes branch
      no: 'M275,220 H289', retry: 'M355,179 V40', h2: 'M72,174 V329', u2: 'M215,309 V329', m: 'M150,365 V379',  // arrows: the no branch to the fault box, the retry line back up to the top, the hit path down, the update path down, and real address to memory
    };  // closes the E table
    const PATH = { hit: ['cpu', 'a', 'tlb', 'hitE', 'hit', 'h2', 'ra', 'm', 'mem'], miss: ['cpu', 'a', 'tlb', 'missE', 'pte', 'b', 'pq', 'yes', 'upd', 'u2', 'ra', 'm', 'mem'],  // PATH: which boxes and arrows light up for each outcome; the hit path and the miss path
      fault: ['cpu', 'a', 'tlb', 'missE', 'pte', 'b', 'pq', 'no', 'flt', 'retry', 'yes', 'upd', 'u2', 'ra', 'm', 'mem'] };  // the fault path runs through the fault box and the retry arrow, then continues like a miss
    const svg = s('svg', { viewBox: '0 0 430 420', width: '100%' });  // svg: the flowchart's drawing area
    const nodeEl = {}, edgeEl = {};  // nodeEl and edgeEl keep each drawn box and arrow by name so they can be recoloured later
    for (const [k, d] of Object.entries(E)) edgeEl[k] = s('path', { d, fill: 'none', class: 's-muted', 'marker-end': 'url(#arr-muted)' });  // draws every arrow, all faint grey to begin with
    for (const [k, n] of Object.entries(N)) {  // draws every box
      const shape = n.dia ? s('polygon', { points: `${n.x},${n.y - n.h / 2} ${n.x + n.w / 2},${n.y} ${n.x},${n.y + n.h / 2} ${n.x - n.w / 2},${n.y}`, class: 's-panel', 'stroke-width': 2 })  // a diamond for a decision: a four-cornered polygon through the top, right, bottom and left points
        : s('rect', { x: n.x - n.w / 2, y: n.y - n.h / 2, width: n.w, height: n.h, rx: n.pill ? n.h / 2 : 8, class: 's-panel', 'stroke-width': 2 });  // any other box is a rectangle, with fully rounded ends when it is a pill
      nodeEl[k] = s('g', {}, shape, mtext(s, n.x, n.y - (n.t.length - 1) * 8 + 5, n.t, { 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 650 }, 16));  // groups the shape with its centred text, shifted up so several lines sit centred on the box
    }  // ends the loop over boxes
    svg.append(...Object.values(edgeEl), ...Object.values(nodeEl),  // adds the arrows first, so the boxes sit on top of them, then the boxes
      s('text', { x: 78, y: 74, 'font-size': 13.5, 'font-weight': 800, class: 'tx-ok' }, 'hit'), s('text', { x: 222, y: 122, 'font-size': 13.5, 'font-weight': 800, class: 'tx-warn' }, 'miss'),  // branch labels: "hit" in green and "miss" in amber
      s('text', { x: 222, y: 259, 'font-size': 13.5, 'font-weight': 800 }, 'yes'), s('text', { x: 274, y: 211, 'font-size': 13.5, 'font-weight': 800, class: 'tx-bad' }, 'no'),  // branch labels: "yes" and "no" (in red) beside the present-bit test
      s('text', { x: 364, y: 62, 'font-size': 13, class: 's-sub', transform: 'rotate(90 364 62)' }, 'retry'));  // the word "retry" turned on its side along the retry line
    function light(kind) {  // light(kind): colours the path for a hit, a miss or a fault, and greys everything else; light(null) clears it
      const lit = new Set(kind ? PATH[kind] : []), col = kind === 'hit' ? 'ok' : kind === 'miss' ? 'warn' : 'bad';  // lit: the names on that path; col: green for a hit, amber for a miss, red for a fault
      for (const [k, g] of Object.entries(nodeEl)) g.firstChild.setAttribute('class', lit.has(k) ? 's-' + col : 's-panel');  // each box on the path takes the colour; every other box goes back to plain
      for (const [k, p] of Object.entries(edgeEl)) { const on = lit.has(k); p.setAttribute('class', on ? 's-line' : 's-muted'); p.style.stroke = on ? `var(--${col})` : ''; p.setAttribute('marker-end', on ? `url(#arr-${col})` : 'url(#arr-muted)'); }  // each arrow on the path is drawn solid in the colour with a matching arrowhead; the others go back to faint grey
    }  // ends light()
    let tlb, pt, pc, t, hits, misses, faults, acc, timer = null, last = null;  // the simulation state: tlb entries, page table, position in REFS, clock t, counters, total memory accesses, the Run timer, and the last reference
    const strip = h('div', { class: 'row', style: { gap: '4px' } });  // strip: the row showing the whole reference list, with the next one outlined
    const tlbBox = h('div');  // tlbBox: where the TLB table is drawn
    const ptBox = h('div');  // ptBox: where the page table is drawn
    const score = h('div', { class: 'row', style: { gap: '6px' } });  // score: the row of coloured counters
    const narr = h('div', { class: 'card tight small', style: { minHeight: '86px' } });  // narr: the card that explains the latest reference; its minimum height keeps the layout steady
    function stop() { if (timer) { clearInterval(timer); timer = null; } }  // stop(): halts Run all if it is going
    function stepOnce() {  // stepOnce(): processes the next page reference; runs on each Step press and on each tick of Run all
      if (pc >= REFS.length) { stop(); paint(); return; }  // at the end of the list there is nothing to do except stop and redraw
      const p = REFS[pc++]; t++;  // p: the next page referenced; the clock t ticks once per reference
      let e = tlb.find((x) => x.p === p), kind, evict = null;  // e: the TLB entry for page p, if any; kind records the outcome; evict will name a replaced page
      if (e) { kind = 'hit'; hits++; e.last = t; acc += 1; }  // a hit: counts it, stamps the entry as just used, and costs one memory access, for the data
      else {  // otherwise it is a miss
        misses++; acc += 2; kind = 'miss';  // counts the miss; it costs two memory accesses, one for the page table entry and one for the data
        if (pt[p] == null) { kind = 'fault'; faults++; acc += 1; pt[p] = 2; }  // if the page table says the page is not present, it is also a page fault: one more access, and the OS puts the page in frame 2
        if (tlb.length >= 4) { const v = tlb.reduce((m, x) => (x.last < m.last ? x : m)); evict = v.p; tlb = tlb.filter((x) => x !== v); }  // a full TLB drops its least recently used entry (the one with the oldest last-use time) and remembers which page it was
        tlb.push({ p, f: pt[p], last: t });  // adds the new translation to the TLB, stamped with the current time
      }  // ends the miss case
      last = { p, kind };  // remembers this reference so paint() can light its path and highlight its rows
      const f = pt[p], ev = evict == null ? 'an empty slot' : `the slot of page ${evict}, the entry unused longest`;  // f: the frame now holding the page; ev: words for where the new TLB entry went
      narr.innerHTML = kind === 'hit'  // narration chosen by the outcome
        ? `<b>Page ${p}: <span class="c-ok">TLB hit.</span></b> The TLB compares ${p} with all its entries at once (an <span class="t">associative lookup</span>) and returns frame ${f}. Cost: <b>1</b> memory access, for the data itself.`  // for a hit: the associative lookup compares the page with every entry at once; 1 memory access
        : kind === 'miss' ? `<b>Page ${p}: <span class="c-warn">TLB miss.</span></b> The hardware reads page ${p}’s entry from the page table in memory: P = 1, frame ${f}. It copies the entry into ${ev}, then forms the address. Cost: <b>2</b> memory accesses.`  // for a miss: the entry is read from the page table and copied into the TLB; 2 memory accesses
          : `<b>Page ${p}: TLB miss and <span class="c-bad">page fault</span>.</b> The entry says P = 0. The OS reads page ${p} from disk into free frame ${f} and updates the page table; the instruction is retried, misses again, and this time the entry (now present) goes into ${ev}. Cost: <b>3</b> memory accesses plus a disk read.`;  // for a fault: the OS loads the page, the instruction is retried and then misses again; 3 accesses plus a disk read
      if (pc >= REFS.length) stop();  // stops Run all after the last reference
      paint();  // redraws everything
    }  // ends stepOnce()
    function flush() {  // flush(): the Process switch button, which empties the TLB as the OS would when another process takes over
      stop(); tlb = []; last = null; light(null);  // stops Run all, empties the TLB, forgets the last reference and clears the flowchart colours
      narr.innerHTML = '<b>Process switch.</b> The TLB holds this process’s translations, which mean nothing for the next process, so every entry is invalidated (flushed). When this process runs again, its first references all miss. Tagging each entry with an <span class="t">address-space identifier (ASID)</span> lets entries of several processes coexist instead.';  // narration: why the entries are invalidated, and how address-space identifiers would avoid it
      paint();  // redraws everything
    }  // ends flush()
    function reset() {  // reset(): puts the whole simulation back to the start
      stop(); tlb = []; pt = Object.assign({}, PT0); pc = 0; t = 0; hits = 0; misses = 0; faults = 0; acc = 0; last = null; light(null);  // stops Run all, empties the TLB, copies the starting page table, and zeros the position, clock and counters
      narr.innerHTML = '<b>The TLB starts empty.</b> <span class="muted">Press Step to issue the next page reference. The TLB holds 4 entries; when it is full, the entry unused the longest is replaced.</span>';  // starting narration: the TLB is empty, what Step does, and that a full TLB replaces the entry unused longest
      paint();  // draws the starting state
    }  // ends reset()
    function paint() {  // paint(): redraws the reference strip, both tables, the counters and the buttons; runs after every change
      if (last) light(last.kind);  // if a reference has been made, lights its path through the flowchart
      strip.replaceChildren(h('span', { class: 'small b' }, 'Pages referenced:'), ...REFS.map((p, i) => h('span', { class: 'chip mono', style: i === pc ? { outline: '2px solid var(--accent)' } : i < pc ? {} : { opacity: '.6' } }, String(p))));  // the reference strip: each page number as a chip; the next one gets an accent outline and those still to come are faded
      const rows = [0, 1, 2, 3].map((i) => tlb[i]);  // rows: the four TLB slots, undefined for any slot still empty
      tlbBox.innerHTML = '<h4 class="m0">TLB (4 entries)</h4><table class="tbl compact"><tr><th>page</th><th>frame</th><th>last used</th></tr>' +  // the TLB table's heading and column titles: page, frame, last used
        rows.map((x) => x ? `<tr${last && x.p === last.p ? ' class="on"' : ''}><td class="b">${x.p}</td><td>${x.f}</td><td>t = ${x.last}</td></tr>` : '<tr><td class="muted">empty</td><td></td><td></td></tr>').join('') + '</table>';  // one row per slot: the page just referenced is highlighted, and empty slots say "empty"
      ptBox.innerHTML = '<h4 class="m0">Page table (in main memory)</h4><table class="tbl compact"><tr><th>page</th>' + [0, 1, 2, 3, 4, 5, 6, 7].map((p) => `<th${last && last.p === p ? ' style="color:var(--accent)"' : ''}>${p}</th>`).join('') + '</tr><tr><td class="b">P</td>' +  // the page table's heading and a header row of page numbers 0 to 7, the one just referenced in the accent colour
        [0, 1, 2, 3, 4, 5, 6, 7].map((p) => `<td class="${pt[p] == null ? 'c-bad' : 'c-ok'} b">${pt[p] == null ? 0 : 1}</td>`).join('') + '</tr><tr><td class="b">frame</td>' + [0, 1, 2, 3, 4, 5, 6, 7].map((p) => `<td>${pt[p] == null ? '–' : pt[p]}</td>`).join('') + '</tr></table>';  // a P row (1 in green or 0 in red) and a frame row (a dash for pages on disk); closes the table
      const n = hits + misses;  // n: how many references have been made so far (every one is either a hit or a miss)
      score.innerHTML = `<span class="chip ok">TLB hits ${hits}</span><span class="chip warn">TLB misses ${misses}</span><span class="chip bad">page faults ${faults}</span><span class="chip mem">memory accesses ${acc}</span>` +  // the counters as coloured chips: hits, misses, page faults and total memory accesses
        (n ? `<span class="chip accent">hit ratio ${ctx.util.fmt((100 * hits) / n, 0)}%</span>` : '');  // plus the hit ratio as a percentage, once there is at least one reference
      bStep.disabled = pc >= REFS.length; bRun.textContent = timer ? 'Pause' : 'Run all'; bRun.disabled = pc >= REFS.length && !timer;  // Step is greyed out at the end of the list; the Run button reads Pause while running, and is greyed out at the end unless running
    }  // ends paint()
    const bStep = h('button', { class: 'btn sm primary', onclick: () => { stop(); stepOnce(); } }, 'Step →');  // Step button: stops Run all, then processes one reference
    const bRun = h('button', { class: 'btn sm', onclick: () => { if (timer) { stop(); paint(); } else { timer = ctx.every(700, stepOnce); paint(); } } }, 'Run all');  // Run all button: pauses if running; otherwise processes a reference every 700 milliseconds (ctx.every stops it when the slide closes)
    reset();  // sets up the starting state when the tab opens
    panel.append(h('div', { class: 'split', style: { height: 'auto', gap: '16px', gridTemplateColumns: ctx.narrow ? '1fr' : '400px minmax(0, 1fr)' } },  // lays the tab out in two columns: a 400-pixel flowchart column and the rest, or one column on phone-width screens
      h('div', { class: 'card white', style: { padding: '4px 6px', display: 'grid', alignItems: 'center' } }, svg),  // left column: the flowchart inside a white card
      h('div', { class: 'stack', style: { gap: '8px' } },  // right column: a vertical stack with 8px gaps
        h('div', { class: 'row', style: { gap: '8px' } }, bStep, bRun, h('button', { class: 'btn sm os', onclick: flush }, 'Process switch (flush TLB)'), h('div', { class: 'grow' }), h('button', { class: 'btn sm ghost', onclick: reset }, 'Reset')),  // button row: Step, Run all, the Process switch button that flushes the TLB, a spacer, and Reset at the right end
        strip, h('div', { class: 'grid-2', style: { gridTemplateColumns: 'minmax(0,4fr) minmax(0,7fr)' } }, tlbBox, ptBox), score, narr)));  // the reference strip, the TLB and page table side by side (4 parts to 7), the counters and the narration; closes both columns
    return stop;  // hands stop back to the tabs widget, which runs it when the student switches tab or leaves, so Run all cannot keep going unseen
  }  // ends tabTLB()

  /* Step 6, tab 2: effective access time calculator. */
  function tabEAT(panel, ctx) {  // tabEAT(panel, ctx): draws tab 2 of step 6, a calculator for the effective access time
    const { h } = ctx;  // takes the HTML builder h out of ctx
    let hp = 98, tt = 2, mm = 100;  // the slider settings: hp = hit ratio in percent, tt = TLB lookup time in ns, mm = memory access time in ns
    const bars = h('div', { class: 'stack', style: { gap: '8px' } });  // bars: the three comparison bars
    const work = h('div', { class: 'card tight small', style: { lineHeight: '1.6' } });  // work: the card that shows the formula worked out with the current numbers
    const note = h('div', { class: 'callout m0 small' });  // note: the callout whose colour and text depend on how high the hit ratio is
    function calc() {  // calc(): recomputes and redraws everything; runs at the start and on every slider move
      const hr = hp / 100, hitC = tt + mm, missC = tt + 2 * mm, eat = hr * hitC + (1 - hr) * missC, none = 2 * mm, top = Math.max(none, eat);  // hr: hit ratio as a fraction; hitC and missC: the cost of a hit and of a miss; eat: their weighted average; none: cost with no TLB; top: the longest bar
      const row = (lab, v, col) => h('div', { style: { display: 'grid', gridTemplateColumns: '210px 1fr 86px', alignItems: 'center', gap: '10px' } },  // row(lab, v, col): one bar row laid out in three columns: label, meter, and value
        h('span', { class: 'small b', html: lab }), h('div', { class: 'meter', style: { height: '16px' } }, h('i', { style: { width: (100 * v) / top + '%', background: col } })), h('span', { class: 'mono b', style: { textAlign: 'right' } }, ctx.util.fmt(v, 1) + ' ns'));  // the label, a meter filled in proportion to the longest bar, and the value in ns written to one decimal place
      bars.replaceChildren(row('No TLB: always 2m', none, 'var(--bad)'), row('With this TLB: EAT', eat, 'var(--accent)'), row('Ideal: m (free translation)', mm, 'var(--ok)'));  // three bars: no TLB (red), with this TLB (accent), and the ideal of a single memory access (green)
      work.innerHTML = `EAT = h(t + m) + (1 − h)(t + 2m)<br>= ${ctx.util.fmt(hr, 2)} × (${tt} + ${mm}) + ${ctx.util.fmt(1 - hr, 2)} × (${tt} + ${2 * mm})<br>= ${ctx.util.fmt(hr * hitC, 2)} + ${ctx.util.fmt((1 - hr) * missC, 2)} = <b>${ctx.util.fmt(eat, 2)} ns</b>, ` +  // the worked formula: first in letters, then with the numbers put in, then the two products and their sum in bold
        `which is ${ctx.util.fmt((100 * (eat - mm)) / mm, 1)}% longer than an ideal ${mm} ns access` + (eat < none ? ` and ${ctx.util.fmt((100 * (none - eat)) / none, 0)}% shorter than with no TLB.` : eat > none ? `, and even ${ctx.util.fmt(eat - none, 1)} ns longer than with no TLB: a TLB this slow and this rarely hit costs more than it saves.` : '.');  // compares the result with the ideal access, and with no TLB, pointing out when a slow, rarely hit TLB costs more than it saves
      if (hp >= 95) { note.className = 'callout tip m0 small'; note.dataset.label = 'Realistic'; note.innerHTML = 'Real programs touch each page many times in a row (locality), so TLB hit ratios of 99% or more are common and translation costs only a few percent.'; }  // at 95% or above: a green "Realistic" note, since locality makes hit ratios of 99% or more common
      else { note.className = 'callout warn m0 small'; note.dataset.label = 'Low hit ratio'; note.innerHTML = 'Every miss adds a whole extra memory access, so the average climbs quickly toward 2m. Programs with poor locality, or a TLB flushed too often, pay this price.'; }  // below 95%: an amber "Low hit ratio" note, since every miss adds a whole extra memory access
    }  // ends calc()
    const s1 = ctx.ui.slider({ label: 'TLB hit ratio h', min: 50, max: 100, value: hp, format: (v) => v + '%', onInput: (v) => { hp = v; calc(); } });  // slider for the hit ratio h, 50% to 100%
    const s2 = ctx.ui.slider({ label: 'TLB lookup t', min: 0, max: 20, value: tt, format: (v) => v + ' ns', onInput: (v) => { tt = v; calc(); } });  // slider for the TLB lookup time t, 0 to 20 ns
    const s3 = ctx.ui.slider({ label: 'Memory access m', min: 20, max: 200, step: 10, value: mm, format: (v) => v + ' ns', onInput: (v) => { mm = v; calc(); } });  // slider for the memory access time m, 20 to 200 ns in steps of 10
    calc();  // fills in the bars and the working once before the tab appears
    panel.append(h('div', { class: 'split', style: { height: 'auto' } },  // lays the tab out in two equal columns
      h('div', { class: 'stack', style: { gap: '10px' } },  // left column: a vertical stack with 10px gaps
        h('p', { class: 'm0', html: 'Without a TLB every reference costs <b>two</b> memory accesses: one for the page table entry, one for the data. A TLB hit skips the first. The TLB is checked first every time, so both cases pay its lookup time. With hit ratio <b>h</b>, TLB lookup time <b>t</b> and memory access time <b>m</b>, the <span class="t">effective access time</span> is:' }),  // paragraph: why a reference without a TLB costs two accesses, why both cases pay the lookup time, and what h, t and m stand for
        h('div', { class: 'card center', style: { fontSize: '20px', fontWeight: 800, padding: '10px' } }, 'EAT = h(t + m) + (1 − h)(t + 2m)'),  // the formula for the effective access time, shown large in its own card
        h('div', { class: 'card stack', style: { gap: '10px', padding: '10px 12px' } }, s1, s2, s3),  // a card holding the three sliders
        h('p', { class: 'xs muted m0' }, 'This ignores page faults: rare, but each costs millions of nanoseconds. A two-level table would make a miss cost t + 3m.')),  // fine print: page faults are left out of the formula, and a two-level table would make a miss cost t + 3m
      h('div', { class: 'stack', style: { gap: '10px' } }, bars, work, note)));  // right column: the bars, the working and the note; closes the layout
  }  // ends tabEAT()

  /* Step 7, tab 1: page table size versus internal fragmentation for one process. */
  function tabPageSize(panel, ctx) {  // tabPageSize(panel, ctx): draws tab 1 of step 7, a chart weighing page table size against wasted space for one process
    const { h, s } = ctx;  // takes the HTML builder h and the SVG builder s out of ctx
    const SIZES = [153600, 1363148, 12582912, 94371840];        // 150 KB, 1.3 MB, 12 MB, 90 MB
    const E = 4, PMIN = 9, PMAX = 22;  // E: bytes per table entry; PMIN and PMAX: the smallest and largest page sizes as powers of 2 (512 bytes to 4 MB)
    let si = 1, pe = 12;  // current settings: si picks one of the four process sizes; pe is the page size exponent (12 means 4 KB)
    const sm = ctx.narrow, W = sm ? 340 : 600;     // small screens get a slimmer chart so its labels stay readable
    const X = (e) => (sm ? 52 : 60) + (e - PMIN) * (sm ? 21.5 : 40), LO = 7, HI = 23, Y = (v) => 222 - ((Math.log2(Math.max(v, 2 ** LO)) - LO) / (HI - LO)) * 200;  // X turns a page size exponent into a position across the chart; Y turns a byte count into a height on a doubling scale from 128 bytes to 8 MB
    const svg = s('svg', { viewBox: `0 0 ${W} 262`, width: '100%' });  // svg: the chart's drawing area
    const read = h('div', { class: 'card tight small' });  // read: the card under the sliders with the numbers for the current settings
    function draw() {  // draw(): redraws the chart and the numbers; runs at the start and on every slider move
      const sz = SIZES[si], p = 2 ** pe, pages = Math.ceil(sz / p), table = pages * E, waste = pages * p - sz;  // sz: process size; p: page size; pages: pages needed (rounded up); table: page table bytes; waste: unused bytes in the last page
      const best = Math.sqrt(2 * sz * E), k = [];  // best: the page size where the total overhead is smallest, the square root of 2 times size times entry size; k collects chart parts
      for (let v = 10; v <= 22; v += 4) k.push(s('line', { x1: X(PMIN) - 4, x2: W - 16, y1: Y(2 ** v), y2: Y(2 ** v), class: 's-muted', 'stroke-width': 1, 'stroke-dasharray': '3 4' }), s('text', { x: X(PMIN) - 8, y: Y(2 ** v) + 4, 'text-anchor': 'end', 'font-size': 12.5, class: 's-sub' }, bytes(2 ** v)));  // dashed guide lines across the chart at 1 KB, 16 KB, 256 KB and 4 MB, each labelled at the left
      for (let e = PMIN; e <= PMAX; e += 1) if (sm ? e % 4 === 1 : e % 2 === 1 || e === PMAX) k.push(s('text', { x: X(e), y: 240, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, bytes(2 ** e).replace(' bytes', ' B')));  // page size labels along the bottom: every fourth size on small screens, otherwise every other size plus the last; "bytes" is shortened to "B"
      k.push(s('text', { x: W / 2 + 20, y: 258, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 }, 'Page size (each step doubles it)'));  // the title of the bottom axis
      const series = [['table', (pp) => (sz / pp) * E, 'var(--warn)'], ['waste', (pp) => pp / 2, 'var(--io)'], ['total', (pp) => (sz / pp) * E + pp / 2, 'var(--accent)']];  // series: the three curves to draw, each a name, a formula of page size, and a colour: table size, half-page waste, and their total
      series.forEach(([name, f, col]) => {  // draws each curve in turn
        const pts = []; for (let e = PMIN; e <= PMAX; e++) pts.push(`${X(e)},${Y(f(2 ** e))}`);  // pts: one chart point per page size from PMIN to PMAX
        k.push(s('polyline', { points: pts.join(' '), fill: 'none', 'stroke-width': name === 'total' ? 3.2 : 2, style: `stroke:${col}`, 'stroke-dasharray': name === 'total' ? '' : '6 4' }));  // joins the points into a line: the total is thick and solid, the other two are thinner and dashed
      });  // ends the loop over curves
      k.push(s('text', { x: X(PMIN) + 6, y: Y((sz / 2 ** PMIN) * E) - 8, 'font-size': 13, 'font-weight': 700, style: 'fill:var(--warn)' }, 'page table'),  // label for the page table curve, near its high left end, in amber
        s('text', { x: X(PMAX) - 4, y: Y(2 ** PMAX / 2) + (sm ? 72 : 50), 'text-anchor': 'end', 'font-size': 13, 'font-weight': 700, style: 'fill:var(--io)' }, 'half-page waste'),  // label for the half-page waste curve, near its right end, in the I/O orange
        s('line', { x1: X(pe), x2: X(pe), y1: 20, y2: 224, style: 'stroke:var(--accent)', 'stroke-width': 1.5, 'stroke-dasharray': '4 3' }),  // a dashed vertical line at the chosen page size
        s('circle', { cx: X(pe), cy: Y((sz / p) * E + p / 2), r: 6.5, class: 's-accent', 'stroke-width': 2.5 }),  // a dot where that line meets the total curve
        s('text', { x: W - 10, y: 16, 'text-anchor': 'end', 'font-size': 13, 'font-weight': 700, class: 'tx-acc' }, 'solid line: total overhead'));  // the key in the top-right corner: the solid line is the total overhead
      svg.replaceChildren(...k);  // replaces the old chart with the new parts
      read.innerHTML = `<div class="kv"><b style="text-align:right">${comma(pages)}</b><span>pages for a ${bytes(sz)} process</span>` +  // numbers card, row 1: how many pages a process of this size needs
        `<b style="text-align:right" class="c-warn">${bytes(table)}</b><span>of page table (${E}-byte entries)</span>` +  // row 2: the size of its page table, in amber
        `<b style="text-align:right" class="c-io">${bytes(waste)}</b><span>unused in its last page (on average half a page)</span></div>` +  // row 3: the bytes unused in the last page, in orange; closes the grid
        `<div class="xs muted" style="margin-top:4px">Lowest total for this size near √(2 × size × ${E}) ≈ ${bytes(Math.round(best))}.</div>`;  // fine print: the page size that gives the lowest total for this process
    }  // ends draw()
    const s1 = ctx.ui.slider({ label: 'Process size', min: 0, max: 3, value: si, format: (v) => bytes(SIZES[v]), onInput: (v) => { si = v; draw(); } });  // slider choosing one of the four process sizes, shown in bytes
    const s2 = ctx.ui.slider({ label: 'Page size', min: PMIN, max: PMAX, value: pe, format: (v) => bytes(2 ** v), onInput: (v) => { pe = v; draw(); } });  // slider for the page size, shown in bytes
    draw();  // draws the chart once before the tab appears
    panel.append(h('div', { class: 'split l', style: { height: 'auto' } },  // lays the tab out in two columns, the left one smaller
      h('div', { class: 'stack', style: { gap: '8px' } },  // left column: a vertical stack with 8px gaps
        h('p', { class: 'small m0', html: '<b>Smaller pages</b> waste less space in each process’s last page (less internal fragmentation) but need <b>more pages</b>, so bigger page tables. Too big, and part of the table itself gets paged out, so one reference can fault twice: once for the table, once for the data.' }),  // paragraph: smaller pages waste less in the last page but need bigger page tables, which can themselves get paged out
        h('div', { class: 'card stack', style: { gap: '8px', padding: '10px 12px' } }, s1, s2), read,  // a card holding the two sliders, then the numbers card
        h('div', { class: 'callout why m0 small', 'data-label': 'And the disk prefers big pages', html: 'A disk spends most of each transfer finding the data, not moving it, so one large transfer is far cheaper than many small ones.' })),  // blue "why" callout: the disk prefers big pages because finding the data costs far more than moving it
      h('div', { class: 'card white', style: { padding: '6px 8px', display: 'grid', alignItems: 'center' } }, svg)));  // right column: the chart inside a white card; closes the layout
  }  // ends tabPageSize()

  /* Step 7, tab 2: fault rate versus page size and versus frames, both simulated on one trace. */
  function tabFaultRate(panel, ctx) {  // tabFaultRate(panel, ctx): draws tab 2 of step 7, two fault-rate curves (by page size and by frames) from one simulated program
    const { h, s } = ctx;  // takes the HTML builder h and the SVG builder s out of ctx
    const NB = 65536, ALLOW = 8192, PFIX = 1024;  // NB: the program's size, 64 KB; ALLOW: memory it may use in the page-size curve, 8 KB; PFIX: the fixed 1 KB page size for the frames curve
    const r = ctx.util.seeded(3), T = [], USE = [];  // r: a seeded random-number generator (seed 3), so every visit builds the same trace; T: the list of addresses; USE: pages touched per phase
    for (let ph = 0; ph < 8; ph++) {           // 8 phases, each using 6 scattered 256-byte hot spots
      const regs = []; for (let k = 0; k < 6; k++) regs.push(Math.floor((r() * (NB - 256)) / 64) * 64);  // regs: the start addresses of this phase's 6 hot spots, chosen at random inside the program and rounded down to a multiple of 64
      USE.push(new Set(regs.flatMap((x) => [Math.floor(x / PFIX), Math.floor((x + 255) / PFIX)])).size);   // 1 KB pages this phase touches
      for (let i = 0; i < 2500; i++) T.push(regs[Math.floor(r() * 6)] + Math.floor(r() * 256));  // adds 2,500 references to the trace, each a random byte inside one of the 6 hot spots
    }  // ends the loop over phases
    const U0 = Math.min(...USE), U1 = Math.max(...USE);  // U0 and U1: the fewest and the most 1 KB pages any phase touches; the frames narration quotes them
    function lru(P, F) { const m = new Map(); let f = 0; for (const a of T) { const pg = Math.floor(a / P); if (m.has(pg)) m.delete(pg); else { f++; if (m.size >= F) m.delete(m.keys().next().value); } m.set(pg, 1); } return (1000 * f) / T.length; }  // lru(P, F): replays the trace with P-byte pages and F frames, replacing the least recently used page, and returns faults per 1,000 references
    const PS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].map((e) => { const P = 2 ** e, F = Math.max(1, Math.floor(ALLOW / P)); return { e, F, rate: lru(P, F) }; });  // PS: one point per page size from 64 bytes to 64 KB, each with as many frames as fit in 8 KB (at least one) and its fault rate
    const FR = [1, 2, 3, 4, 5, 6, 8, 12, 16, 24, 32, 48, 64].map((F) => ({ F, rate: lru(PFIX, F) }));  // FR: one point per frame count from 1 to 64, all with 1 KB pages, and its fault rate
    const PEAK = PS.reduce((m, d, i) => (d.rate > PS[m].rate ? i : m), 0);  // PEAK: the position of the page size with the highest fault rate, used to choose the narration
    let a = 4, b = 3;  // a and b: the positions chosen on the two sliders (512-byte pages; 4 frames)
    function plot(data, sel, lab, xl) {  // plot(data, sel, lab, xl): draws one curve with the chosen point marked; lab writes each point's axis label and xl is the axis title
      const sm = ctx.narrow, W = sm ? 340 : 520;     // small screens: slimmer plot, every other label
      const svg = s('svg', { viewBox: `0 0 ${W} 236`, width: '100%' }), n = data.length, X = (i) => 52 + (i * (W - 80)) / (n - 1), Y = (v) => 196 - (v / 900) * 180, k = [];  // svg: the chart; n: number of points; X spreads the points evenly across; Y maps 0 to 900 faults per 1,000 onto the height; k collects parts
      [0, 300, 600, 900].forEach((v) => k.push(s('line', { x1: 48, x2: W - 8, y1: Y(v), y2: Y(v), class: 's-muted', 'stroke-width': 1, 'stroke-dasharray': v ? '3 4' : '' }), s('text', { x: 44, y: Y(v) + 4, 'text-anchor': 'end', 'font-size': 12.5, class: 's-sub' }, String(v))));  // horizontal guide lines at 0, 300, 600 and 900 (the bottom one solid, the others dashed), each labelled at the left
      data.forEach((d, i) => { if ((n < 12 && !sm) || i % 2 === 0 || i === n - 1) k.push(s('text', { x: X(i), y: 214, 'text-anchor': 'middle', 'font-size': 12, class: 's-sub' }, lab(d))); });  // labels under the points: all of them on a wide screen when there are fewer than 12, otherwise every other one plus the last
      k.push(s('polyline', { points: data.map((d, i) => `${X(i)},${Y(d.rate)}`).join(' '), fill: 'none', 'stroke-width': 3, style: 'stroke:var(--bad)' }),  // the curve itself, a thick red line through every point
        s('circle', { cx: X(sel), cy: Y(data[sel].rate), r: 7, class: 's-bad', 'stroke-width': 2.5 }),  // a red dot on the point the slider has chosen
        s('text', { x: W / 2 + 20, y: 232, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 }, xl),  // the bottom axis title
        s('text', { x: 52, y: 12, 'font-size': 12.5, class: 's-sub' }, 'page faults per 1,000 references'));  // the side axis title at the top left: page faults per 1,000 references
      svg.append(...k);  // puts all the parts into the chart
      return svg;  // hands the chart back to draw()
    }  // ends plot()
    const boxA = h('div'), boxB = h('div'), sayA = h('div', { class: 'small', style: { minHeight: '62px' } }), sayB = h('div', { class: 'small', style: { minHeight: '62px' } });  // boxA and boxB hold the two charts; sayA and sayB explain the chosen point under each, with a minimum height so they do not jump
    function draw() {  // draw(): redraws both charts and both explanations; runs at the start and on every slider move
      const d = PS[a], P = 2 ** d.e;  // d: the chosen page-size point; P: its page size in bytes
      boxA.replaceChildren(plot(PS, a, (x) => bytes(2 ** x.e).replace(' bytes', ' B'), ctx.narrow ? 'Page size (8 KB of memory)' : 'Page size (memory allowed: 8 KB, or one page if larger)'));  // left chart: fault rate against page size, with a shorter axis title on small screens
      boxB.replaceChildren(plot(FR, b, (x) => String(x.F), ctx.narrow ? 'Frames (1 KB pages, 64 in all)' : 'Frames given to the process (1 KB pages, 64 in all)'));  // right chart: fault rate against the number of 1 KB frames, also with a shorter title on small screens
      const head = `<b>${bytes(P)} pages, ${d.F} frame${d.F > 1 ? 's' : ''}: ${ctx.util.fmt(d.rate, 1)} faults per 1,000.</b> `;  // head: the bold summary for the left chart, page size, frame count and fault rate
      sayA.innerHTML = head + (P <= 1024 ? 'Many small pages fit, each closely matching what the program uses right now, so faults are rare.'  // explanation for small pages (up to 1 KB): many pages fit, each matching what the program uses now, so faults are rare
        : a <= PEAK ? 'Each big page drags in data far from the recent references, so only a few pages fit and the program’s six scattered hot spots no longer do. Faults soar.'  // explanation up to the peak: each big page drags in unused data, so the scattered hot spots no longer fit and faults soar
          : P < NB ? 'Pages now cover a large share of the 64 KB process, so faults start to fall again.' : 'One page holds the entire process: after the first fault there are no more.');  // beyond the peak: pages cover much of the program, so faults fall again; at 64 KB one page holds everything
      const f = FR[b];  // f: the chosen frame-count point
      sayB.innerHTML = `<b>${f.F} frame${f.F > 1 ? 's' : ''}: ${ctx.util.fmt(f.rate, 1)} faults per 1,000.</b> ` + (f.F < U0 ? `Fewer frames than the pages in current use (each phase touches ${U0} to ${U1}): the process thrashes.`  // right explanation: with fewer frames than any phase needs, the process thrashes
        : f.F < U1 ? `Phases that touch ${f.F} pages or fewer fit, but the rest (up to ${U1}) still thrash.`  // between the smallest and largest phase: some phases fit, the bigger ones still thrash
          : f.F < 64 ? `Every phase’s pages fit (at most ${U1}), so only moves to a new phase cause faults; more frames barely help.` : 'All 64 pages fit: only the first touch of each page faults.');  // enough frames for every phase: only moving to a new phase faults; with all 64, only each page's first touch
    }  // ends draw()
    const sA = ctx.ui.slider({ label: 'Page size', min: 0, max: PS.length - 1, value: a, format: (v) => bytes(2 ** PS[v].e), onInput: (v) => { a = v; draw(); } });  // slider choosing the page size by its position in PS, shown in bytes
    const sB = ctx.ui.slider({ label: 'Frames', min: 0, max: FR.length - 1, value: b, format: (v) => String(FR[v].F), onInput: (v) => { b = v; draw(); } });  // slider choosing the number of frames by its position in FR
    draw();  // draws both charts once before the tab appears
    panel.append(h('div', { class: 'stack', style: { gap: '8px' } },  // adds the tab's content as one vertical stack
      h('p', { class: 'small m0', html: 'Both curves come from simulating one 64 KB program, 20,000 references long, that moves through phases of scattered hot spots (replacing the least recently used page).' }),  // paragraph: both curves come from one simulated 64 KB program with phases of scattered hot spots and least-recently-used replacement
      h('div', { class: 'grid-2' }, h('div', { class: 'card white stack', style: { gap: '6px', padding: '8px 10px' } }, boxA, sA, sayA), h('div', { class: 'card white stack', style: { gap: '6px', padding: '8px 10px' } }, boxB, sB, sayB)),  // the two charts side by side, each in a white card with its slider and explanation
      h('div', { class: 'callout tip m0 small', 'data-label': 'One lesson in both curves', html: 'Faults stay low while memory holds what the program uses <i>right now</i>. Too few frames, or pages so coarse that few fit, and it thrashes.' })));  // green tip: the lesson both curves share, faults stay low only while memory holds what the program uses right now
  }  // ends tabFaultRate()

  /* Step 7, tab 3: page sizes on real machines and TLB reach. */
  function tabRealSizes(panel, ctx) {  // tabRealSizes(panel, ctx): draws tab 3 of step 7, real page sizes and a TLB reach calculator
    const { h } = ctx;  // takes the HTML builder h out of ctx
    const ENT = [16, 32, 64, 128, 256, 512, 1024, 2048], PG = [[12, '4 KB'], [21, '2 MB'], [30, '1 GB']], WS = [24, 26, 28, 30, 32, 34, 36];  // the slider choices: TLB entry counts, page sizes (as a power of 2 and a label), and data sizes from 16 MB to 64 GB as powers of 2
    let ei = 2, pi = 0, wi = 3;  // the starting positions: 64 entries, 4 KB pages, 1 GB of data
    const out = h('div', { class: 'stack', style: { gap: '8px' } });  // out: the column that shows the results
    function calc() {  // calc(): recomputes the reach and coverage and rewrites the results; runs at the start and on every change
      const reach = ENT[ei] * 2 ** PG[pi][0], ws = 2 ** WS[wi], cov = Math.min(1, reach / ws);  // reach: entries times page size; ws: the data in use; cov: the fraction of that data the TLB covers, at most 1
      out.innerHTML = `<div class="card tight"><div class="xs muted b">TLB REACH = ENTRIES × PAGE SIZE</div><div class="big" style="font-size:32px">${bytes(reach)}</div><div class="small">${ENT[ei]} × ${PG[pi][1]}</div></div>` +  // big result card: the TLB reach formula, the reach in bytes, and the multiplication that gives it
        `<div class="card tight small"><b>Program working through ${bytes(ws)} of data:</b> the TLB covers <b class="${cov >= 1 ? 'c-ok' : cov > 0.1 ? 'c-warn' : 'c-bad'}">${cov >= 1 ? 'all of it' : cov * 100 < 0.01 ? 'under 0.01%' : ctx.util.fmt(cov * 100, cov < 0.01 ? 2 : 1) + '%'}</b>.` +  // coverage card: how much of the data the TLB covers, coloured green (all), amber (over 10%) or red, written as a percent or "under 0.01%"
        `<div class="meter" style="margin-top:6px;height:12px"><i style="width:${Math.max(0.5, cov * 100)}%;background:${cov >= 1 ? 'var(--ok)' : cov > 0.1 ? 'var(--warn)' : 'var(--bad)'}"></i></div>` +  // a meter filled to the coverage, in the same colour, never thinner than half a percent so it stays visible
        (cov < 1 ? '<div class="xs muted" style="margin-top:4px">Pages outside the reach cost a TLB miss each time the program returns to them.</div>' : '') + '</div>';  // when the data does not all fit, a note that pages outside the reach cost a TLB miss on every return; closes the card
    }  // ends calc()
    const s1 = ctx.ui.slider({ label: 'TLB entries', min: 0, max: ENT.length - 1, value: ei, format: (v) => String(ENT[v]), onInput: (v) => { ei = v; calc(); } });  // slider for the number of TLB entries, 16 to 2,048
    const sg = ctx.ui.seg(PG.map((p, i) => ({ value: i, label: p[1] + ' pages' })), pi, (v) => { pi = v; calc(); });  // switch for the page size: 4 KB, 2 MB or 1 GB
    const s2 = ctx.ui.slider({ label: 'Data in use', min: 0, max: WS.length - 1, value: wi, format: (v) => bytes(2 ** WS[v]), onInput: (v) => { wi = v; calc(); } });  // slider for how much data the program is working through
    calc();  // fills in the results once before the tab appears
    panel.append(h('div', { class: 'split', style: { height: 'auto' } },  // lays the tab out in two equal columns
      h('div', { class: 'stack', style: { gap: '8px' } },  // left column: a vertical stack with 8px gaps
        h('table', { class: 'tbl compact', html: '<tr><th>Machine</th><th>Page sizes</th></tr><tr><td>VAX (1970s–80s)</td><td>512 bytes</td></tr><tr><td>MIPS R4000</td><td>4 KB up to 16 MB</td></tr><tr><td>UltraSPARC</td><td>8 KB up to 4 MB</td></tr><tr><td>x86-64 (Intel, AMD)</td><td>4 KB; large pages of 2 MB and 1 GB</td></tr><tr><td>64-bit ARM</td><td>4, 16 or 64 KB base pages, plus larger blocks</td></tr>' }),  // table of page sizes on real machines, from an old 512-byte design to modern 64-bit processors
        h('p', { class: 'small m0', html: '4 KB is by far the most common size. <span class="t">Large pages</span> exist mainly to stretch <span class="t">TLB reach</span>: a TLB has only tens to a few thousand entries.' }),  // paragraph: 4 KB is the usual size, and large pages exist mainly to stretch TLB reach
        h('div', { class: 'callout warn m0 small', 'data-label': 'Locality is getting worse', html: 'Object-oriented programs scatter many small objects across memory, and multithreaded programs run many instruction streams at once. Both spread references over more pages, so TLB misses and page faults rise.' })),  // amber callout: object-oriented and multithreaded programs spread references over more pages, so misses and faults rise
      h('div', { class: 'stack', style: { gap: '8px' } }, h('div', { class: 'card stack', style: { gap: '8px', padding: '10px 12px' } }, s1, sg, s2), out)));  // right column: a card with the three controls, then the results; closes the layout
  }  // ends tabRealSizes()

  /* Step 8, tab 1: a segment table with length checks, a missing segment and a segment that grows. */
  function tabSegVM(panel, ctx) {  // tabSegVM(panel, ctx): draws tab 1 of step 8, a segment table with length checks, a missing segment and a segment that grows
    const { h, s } = ctx;  // takes the HTML builder h and the SVG builder s out of ctx
    const MEM = 64000, OTHER = [[0, 14000], [26000, 41000], [44000, 52000], [56000, 59000]];  // MEM: the size of real memory, 64,000 bytes; OTHER: the start and end of the regions used by other processes
    const NAMES = ['main program', 'math library', 'symbol table', 'stack'];  // NAMES: what each of this process's four segments holds
    let seg, sel = 2, off = 2400;  // seg: the segment table; sel: the chosen segment; off: the chosen offset inside it
    function init() {  // init(): sets up, or resets, the segment table
      seg = [{ b: 20000, len: 6000, p: 1, m: 0, rw: false }, { b: null, len: 3500, p: 0, m: 0, rw: false }, { b: 41000, len: 2500, p: 1, m: 1, rw: true }, { b: 52000, len: 4000, p: 1, m: 1, rw: true }];  // four entries with base, length, P, M and whether writing is allowed; segment 1, the math library, is on disk (P = 0)
    }  // ends init()
    const W = ctx.narrow ? 340 : 560;     // small screens: a shorter bar so its labels stay readable
    const svg = s('svg', { viewBox: `0 0 ${W} 74`, width: '100%' });  // svg: the bar picture of real memory
    const tb = h('div');  // tb: where the segment table is drawn
    const narr = h('div', { class: 'card tight small', style: { minHeight: '76px' } });  // narr: the card that explains the current address; its minimum height keeps the layout steady
    const act = h('div', { class: 'row', style: { gap: '8px' } });  // act: the row of buttons (load, grow, Reset)
    const X = (a) => 6 + (a / MEM) * (W - 12);  // X turns a memory address into a position along the bar
    function paint(msg) {  // paint(msg): redraws the bar, the table, the explanation and the buttons; msg, when given, replaces the usual explanation
      const k = [s('rect', { x: 6, y: 22, width: W - 12, height: 30, rx: 4, class: 's-panel', 'stroke-width': 1 })];  // k starts with the empty memory bar
      OTHER.forEach(([a, b]) => k.push(s('rect', { x: X(a), y: 22, width: X(b) - X(a), height: 30, style: 'fill:var(--line-2);stroke:var(--line-2);opacity:.75' })));  // grey blocks for the memory that belongs to other processes
      seg.forEach((g, i) => { if (!g.p) return; k.push(s('rect', { x: X(g.b), y: 22, width: X(g.b + g.len) - X(g.b), height: 30, class: i === sel ? 's-warn' : 's-proc', 'stroke-width': 1.5 }), s('text', { x: (X(g.b) + X(g.b + g.len)) / 2, y: 42, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800 }, String(i))); });  // a coloured block for each present segment, labelled with its number; the chosen segment is amber, the others teal
      k.push(s('text', { x: 6, y: 14, 'font-size': 12.5, class: 's-sub' }, ctx.narrow ? 'Real memory (grey = other processes)' : 'Real memory 0 – 64,000 (grey = other processes; numbers = this process’s segments)'),  // caption above the bar explaining the colours, shorter on small screens
        s('text', { x: 6, y: 68, 'font-size': 12.5, class: 's-sub' }, '0'), s('text', { x: W - 6, y: 68, 'text-anchor': 'end', 'font-size': 12.5, class: 's-sub' }, '64,000'));  // the addresses 0 and 64,000 under the two ends of the bar
      svg.replaceChildren(...k);  // replaces the old bar with the new parts
      const full = !ctx.narrow;    // small screens drop the name and M columns so the table fits
      tb.innerHTML = '<table class="tbl compact"><tr><th>seg</th>' + (full ? '<th>holds</th>' : '') + '<th>base</th><th>length</th><th>P</th>' + (full ? '<th>M</th>' : '') + '<th>access</th></tr>' + seg.map((g, i) =>  // the segment table's header row (the holds and M columns only on wide screens), then one row per segment
        `<tr${i === sel ? ' class="on"' : ''}><td class="b">${i}</td>${full ? `<td>${NAMES[i]}</td>` : ''}<td>${g.p ? comma(g.b) : '–'}</td><td>${comma(g.len)}</td><td class="b ${g.p ? 'c-ok' : 'c-bad'}">${g.p}</td>${full ? `<td class="b">${g.m}</td>` : ''}<td>${g.rw ? (full ? 'read/write' : 'r/w') : (full ? 'read/execute' : 'r/x')}</td></tr>`).join('') + '</table>';  // each row: number, name (wide screens), base (a dash when absent), length, P in green or red, M (wide screens), and access rights; the chosen row is highlighted
      const g = seg[sel];  // g: the entry of the chosen segment
      if (msg) narr.innerHTML = msg;  // a message from load() or grow() takes the place of the usual explanation
      else if (off >= g.len) narr.innerHTML = `<b class="c-bad">Offset ${comma(off)} ≥ length ${comma(g.len)}:</b> the address runs past the end of segment ${sel}. The hardware compares every offset with the length field and traps before memory is touched.`;  // first check, the length: an offset at or past the end of the segment traps before memory is touched
      else if (!g.p) narr.innerHTML = `<b class="c-bad">Segment fault:</b> segment ${sel} (${NAMES[sel]}) has P = 0, so it is not in main memory. The OS must find a hole big enough for all ${comma(g.len)} bytes and load it.`;  // second check, the present bit: P = 0 means a segment fault, and the OS needs a hole big enough for the whole segment
      else narr.innerHTML = `<b class="c-ok">OK:</b> offset ${comma(off)} &lt; length ${comma(g.len)}, P = 1, so real address = base + offset = ${comma(g.b)} + ${comma(off)} = <b>${comma(g.b + off)}</b>.`;  // both checks pass: the real address is base plus offset, worked out on screen
      act.replaceChildren(  // rebuilds the button row
        !g.p && off < g.len ? h('button', { class: 'btn sm intr', onclick: load }, 'OS: load segment ' + sel) : null,  // a red OS button to load the chosen segment, shown only when it is absent and the offset is inside it
        h('button', { class: 'btn sm', onclick: grow }, 'Grow the symbol table by 1,000 bytes'), h('div', { class: 'grow' }), h('button', { class: 'btn sm ghost', onclick: () => { init(); paint(); } }, 'Reset'));  // the Grow button for the symbol table, a spacer, and Reset, which puts back the starting table
    }  // ends paint()
    function fits(a, len, skip) { const end = a + len; return end <= MEM && !OTHER.some(([x, y]) => a < y && end > x) && !seg.some((g, i) => i !== skip && g.p && a < g.b + g.len && end > g.b); }  // fits(a, len, skip): true if len bytes starting at a stay inside memory and overlap neither other processes nor this process's other present segments
    function hole(len, skip) { for (let a = 0; a + len <= MEM; a += 500) if (fits(a, len, skip)) return a; return null; }  // hole(len, skip): tries start addresses every 500 bytes from 0 and returns the first that fits, or null if none does
    function load() { const g = seg[sel], a = hole(g.len, sel); if (a == null) { paint('No hole is big enough: the OS would first have to swap another segment out.'); return; } g.p = 1; g.b = a; paint(`The OS found a hole at ${comma(a)} and read segment ${sel} in. Its entry now says P = 1, base ${comma(a)}. Note that a segment needs one <i>contiguous</i> hole as big as the whole segment.`); }  // load(): finds a hole for the chosen segment and loads it (P = 1, new base), pointing out that a segment needs one contiguous hole
    function grow() {  // grow(): adds 1,000 bytes to the symbol table, segment 2, as a program's growing data structure would
      const g = seg[2], nl = g.len + 1000; sel = 2;  // g: the symbol table's entry; nl: its new length; also selects segment 2 so the student sees it
      if (fits(g.b, nl, 2)) { g.len = nl; g.m = 1; paint(`There was room right after it, so the OS simply raised the length field to ${comma(nl)}.`); return; }  // if the space right after it is free, the OS just raises the length field and marks it modified
      const a = hole(nl, 2);  // otherwise it looks for a hole big enough for the larger segment
      if (a == null) { paint('No hole is large enough for the bigger table: the OS would have to swap something out first.'); return; }  // with no such hole, the OS would first have to swap something out
      const old = g.b, end = old + g.len, mine = seg.findIndex((x, i) => i !== 2 && x.p && x.b < end + 1000 && x.b + x.len > end);  // old and end: where the segment starts and ends now; mine: one of this process's own segments in the way, if any
      const why = end + 1000 > MEM ? 'it would run past the end of memory' : mine >= 0 ? `its own segment ${mine} starts at ${comma(seg[mine].b)}` : `another process’s memory starts at ${comma(OTHER.find(([x, y]) => x < end + 1000 && y > end)[0])}`;  // why: the reason it could not grow in place: the end of memory, its own segment, or another process's memory
      g.b = a; g.len = nl; g.m = 1;  // moves the segment to the hole and stores its new length; it counts as modified
      paint(`The segment could not grow in place: ${why}. The OS moved it from ${comma(old)} to a hole at ${comma(a)} and set the length to ${comma(nl)}. The program noticed nothing: its addresses are still segment 2 + offset.`);  // explains the move, and that the program's addresses (segment 2 plus offset) did not change
    }  // ends grow()
    const sg = ctx.ui.seg(NAMES.map((n, i) => ({ value: i, label: 'seg ' + i })), sel, (v) => { sel = v; paint(); });  // switch choosing segment 0 to 3; choosing one redraws
    const sl = ctx.ui.slider({ label: 'Offset', min: 0, max: 7999, value: off, format: comma, onInput: (v) => { off = v; paint(); } });  // slider for the offset inside the segment, 0 to 7,999, with thousands commas
    init(); paint();  // sets up the starting table and draws it when the tab opens
    panel.append(h('div', { class: 'split l', style: { height: 'auto' } },  // lays the tab out in two columns, the left one smaller
      h('div', { class: 'stack', style: { gap: '8px' } },  // left column: a vertical stack with 8px gaps
        h('p', { class: 'small m0', html: 'With virtual memory, segments bring three gifts:' }),  // lead-in line for the list of what segments offer
        h('ul', { class: 'small m0', style: { lineHeight: '1.45' }, html: '<li><b>Growing data structures:</b> a segment can get longer; the OS extends it or moves it to a bigger hole.</li><li><b>Independent modules:</b> each module is its own segment, so one can be changed and recompiled without relinking the others.</li><li><b>Sharing and protection:</b> a segment is a natural unit to share or to mark read-only.</li>' }),  // list: growing data structures, independent modules, and sharing and protection
        h('p', { class: 'small m0', html: 'Each segment table entry holds the segment’s <b>base</b> address and <b>length</b>, a <span class="t">present bit (P)</span>, a <span class="t">modified bit (M)</span>, and protection and sharing bits.' }),  // paragraph: what a segment table entry holds (base, length, P, M, protection and sharing bits)
        h('div', { class: 'row', style: { gap: '8px' } }, h('span', { class: 'small b' }, 'Address:'), sg), sl),  // the segment switch with its label, then the offset slider; closes the left column
      h('div', { class: 'stack', style: { gap: '8px' } }, tb, h('div', { class: 'card white', style: { padding: '4px 6px' } }, svg), act, narr)));  // right column: the table, the memory bar in a white card, the buttons and the explanation; closes the layout
  }  // ends tabSegVM()

  /* Step 8, tab 2: combined segmentation and paging: segment table → that segment's page table → frame. */
  function tabSegPage(panel, ctx) {  // tabSegPage(panel, ctx): draws tab 2 of step 8, combined segmentation and paging: segment table, then that segment's page table, then the frame
    const { h } = ctx;  // takes the HTML builder h out of ctx
    const PS = 1024;  // PS: the page size, 1,024 bytes
    const SEGS = [  // SEGS: the process's four segments, each with a name, a length, the name of its page table, access rights, and a frame for each page (null = on disk)
      { name: 'code', len: 5000, pt: 'PT-0', rw: false, pages: [17, 4, null, 30, 9] },  // segment 0, code: 5,000 bytes in 5 pages, read and execute only; page 2 is on disk
      { name: 'data', len: 3000, pt: 'PT-1', rw: true, pages: [12, 21, null] },  // segment 1, data: 3,000 bytes in 3 pages, writable; page 2 is on disk
      { name: 'stack', len: 2048, pt: 'PT-2', rw: true, pages: [2, 28] },  // segment 2, stack: 2,048 bytes in 2 pages, both in memory
      { name: 'shared library', len: 9000, pt: 'PT-3', rw: false, pages: [40, 41, 42, null, 44, 45, null, 47, 48] },  // segment 3, a shared library: 9,000 bytes in 9 pages, read and execute only; pages 3 and 6 are on disk
    ];  // closes the SEGS list
    let sg = 1, off = 1500;  // the starting choice: segment 1 at offset 1,500
    const bitsEl = h('div', { class: 'row', style: { gap: '10px', alignItems: 'flex-end' } });  // bitsEl: the row that shows the logical address split into coloured bit fields
    const stEl = h('div'), ptEl = h('div');  // stEl and ptEl: where the segment table and the chosen segment's page table are drawn
    const narr = h('div', { class: 'card tight small', style: { minHeight: '94px' } });  // narr: the card that explains the current address; its minimum height keeps the layout steady
    function paint() {  // paint(): redraws the bit fields, both tables and the explanation; runs at the start and on every change
      const S = SEGS[sg], pn = off >> 10, po = off & 1023, inside = off < S.len, fr = inside ? S.pages[pn] : null;  // S: the chosen segment; pn: page number (offset divided by 1,024); po: offset in the page; inside: within the length; fr: the frame, if any
      bitsEl.innerHTML = `<span class="small b">Logical address</span><div class="bits">${field(bin(sg, 2), 'segment ' + sg, 'var(--os)')}${field(bin(pn, 4), 'page ' + pn, 'var(--warn)')}${field(bin(po, 10), 'offset ' + po, 'var(--mem)')}</div>`;  // the logical address as three coloured fields: 2 segment bits, 4 page bits and 10 offset bits
      const full = !ctx.narrow;    // small screens drop the name column so the table fits
      stEl.innerHTML = '<h4 class="m0">Segment table (one per process)</h4><table class="tbl compact"><tr><th>seg</th>' + (full ? '<th>holds</th>' : '') + '<th>length</th><th>page table</th><th>access</th></tr>' +  // the segment table's heading and column titles; the holds column only on wide screens
        SEGS.map((x, i) => `<tr${i === sg ? ' class="on"' : ''}><td class="b">${i}</td>${full ? `<td>${x.name}</td>` : ''}<td>${comma(x.len)}</td><td class="mono">${x.pt}</td><td>${x.rw ? (full ? 'read/write' : 'r/w') : (full ? 'read/execute' : 'r/x')}</td></tr>`).join('') + '</table>';  // one row per segment: number, name, length, its page table's name and the access rights; the chosen row is highlighted
      ptEl.innerHTML = `<h4 class="m0">${S.pt}: the page table of segment ${sg}</h4><table class="tbl compact"><tr><th>page</th>` + S.pages.map((_, i) => `<th${inside && i === pn ? ' style="color:var(--accent)"' : ''}>${i}</th>`).join('') +  // the chosen segment's page table: heading, then page numbers across the top with the one in use in the accent colour
        '</tr><tr><td class="b">P</td>' + S.pages.map((f) => `<td class="b ${f == null ? 'c-bad' : 'c-ok'}">${f == null ? 0 : 1}</td>`).join('') + '</tr><tr><td class="b">frame</td>' + S.pages.map((f, i) => `<td${inside && i === pn ? ' style="background:var(--accent-bg);font-weight:800"' : ''}>${f == null ? '–' : f}</td>`).join('') + '</tr></table>';  // a P row in green or red and a frame row with the frame in use shaded; closes the table
      const head = `Segment ${sg} (${S.name}): length ${comma(S.len)}, page table ${S.pt}. `;  // head: the opening words of the explanation, naming the segment, its length and its page table
      narr.innerHTML = !inside  // the explanation, chosen by what the hardware finds
        ? head + `<b class="c-bad">Offset ${comma(off)} ≥ ${comma(S.len)}:</b> past the end of the segment. The length check fails before any page table is consulted, so the hardware traps.`  // past the end of the segment: the length check traps before any page table is read
        : fr == null ? head + `Offset ${comma(off)} = page ${pn}, offset ${po}. <b class="c-bad">Page fault:</b> page ${pn} of this segment has P = 0, so the OS must load just that one page, not the whole segment.`  // inside but the page has P = 0: a page fault that loads just that one page, not the whole segment
          : head + `Offset ${comma(off)} = page ${pn} × 1024 + ${po}. Page ${pn} is in frame ${fr}, so real address = ${fr} × 1024 + ${po} = <b>${comma(fr * PS + po)}</b>.`;  // inside and present: the real address is frame times 1,024 plus the page offset, worked out on screen
    }  // ends paint()
    const sgSel = ctx.ui.seg(SEGS.map((x, i) => ({ value: i, label: 'seg ' + i })), sg, (v) => { sg = v; paint(); });  // switch choosing segment 0 to 3
    const sl = ctx.ui.slider({ label: 'Segment offset', min: 0, max: 16383, value: off, format: comma, onInput: (v) => { off = v; paint(); } });  // slider for the offset inside the segment, 0 to 16,383, so it can also run past the end
    paint();  // draws the starting state when the tab opens
    panel.append(h('div', { class: 'split l', style: { height: 'auto' } },  // lays the tab out in two columns, the left one smaller
      h('div', { class: 'stack', style: { gap: '8px' } },  // left column: a vertical stack with 8px gaps
        h('p', { class: 'small m0', html: 'Many systems combine the two. The programmer sees <b>segments</b>; the system cuts each segment into <b>pages</b>. A logical address is a segment number plus a segment offset, and the hardware reads that offset as a page number plus a page offset. Each process has one segment table; every segment has its own page table, and the segment’s entry holds its length and the address of that page table.' }),  // paragraph: the programmer sees segments, the system pages each one, and what the segment table entry holds
        h('div', { class: 'row', style: { gap: '8px' } }, h('span', { class: 'small b' }, 'Segment:'), sgSel), sl, bitsEl,  // the segment switch with its label, the offset slider and the bit fields
        h('div', { class: 'callout tip m0 small', 'data-label': 'Best of both', html: 'Segments give growth, sharing and protection; pages give no external fragmentation and let a segment be partly in memory.' })),  // green tip: segments give growth, sharing and protection; pages remove external fragmentation
      h('div', { class: 'stack', style: { gap: '8px' } }, stEl, ptEl, narr)));  // right column: the segment table, the page table and the explanation; closes the layout
  }  // ends tabSegPage()

  /* Step 8, tab 3: protection rings and shared segments. */
  function tabRings(panel, ctx) {  // tabRings(panel, ctx): draws tab 3 of step 8, protection rings and the rules for using data and calling services across them
    const { h, s } = ctx;  // takes the HTML builder h and the SVG builder s out of ctx
    const NAMES = ['kernel', 'OS services', 'subsystems', 'user programs'];  // NAMES: what usually runs in rings 0 to 3, from the kernel at the centre outward
    let me = 3, tgt = null, kind = null;  // me: the ring the student's code runs in; tgt: the ring it tries to reach; kind: "data" or "call"
    const svg = s('svg', { viewBox: '0 0 300 300', width: '100%' });  // svg: the drawing of the four rings as circles around one centre
    const res = h('div', { class: 'card tight small', style: { minHeight: '92px' } });  // res: the card that gives the verdict; its minimum height keeps the layout steady
    function paint() {  // paint(): redraws the rings and the verdict; runs at the start and after each choice
      const k = [];  // k collects the drawing parts
      for (let r = 3; r >= 0; r--) {  // draws the rings from the outside in, so each smaller circle sits on top of the bigger one
        const cls = r === me ? 's-proc' : r === tgt ? (ok() ? 's-ok' : 's-bad') : 's-panel';  // colour: teal for the student's own ring, green or red for the target depending on the rule, plain otherwise
        k.push(s('circle', { cx: 150, cy: 150, r: 36 + r * 36, class: cls, 'stroke-width': r === me || r === tgt ? 3 : 1.5 }));  // the ring's circle, 36 pixels wider in radius for each ring further out; the two rings in play get a thicker edge
      }  // ends the loop over rings
      for (let r = 0; r < 4; r++) k.push(s('text', { x: 150, y: r === 0 ? 146 : 150 - (36 + r * 36) + 17, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 800 }, 'ring ' + r),  // each ring's name: ring 0 in the middle, the others near the top of their band
        s('text', { x: 150, y: r === 0 ? 163 : 150 - (36 + r * 36) + 31, 'text-anchor': 'middle', 'font-size': 12, class: 's-sub' }, NAMES[r]));  // and under it, in grey, what runs in that ring
      svg.replaceChildren(...k);  // replaces the old drawing with the new one
      if (tgt == null) { res.innerHTML = `<b>Your code runs in ring ${me}.</b> <span class="muted">Pick something to do. Rings closer to the centre are more privileged.</span>`; return; }  // before any choice: says which ring the code runs in and that inner rings are more privileged, then stops
      const good = ok();  // good: whether the rule allows this access
      res.innerHTML = kind === 'data'  // the verdict, chosen by the kind of access
        ? (good ? `<b class="c-ok">Allowed.</b> Ring ${tgt} is ${tgt === me ? 'your own ring' : 'less privileged than ring ' + me}. Code may read and write data in its own ring or any less privileged one.`  // using data, allowed: the target is the student's own ring or a less privileged one
          : `<b class="c-bad">Denied: protection fault.</b> Ring ${tgt} is more privileged than ring ${me}. If outer code could touch inner data, a buggy or hostile program could corrupt the kernel.`)  // using data, denied: the target is more privileged, so it is a protection fault, which keeps outer code from corrupting the kernel
        : (good ? (tgt === me ? `<b class="c-ok">Allowed.</b> An ordinary call inside ring ${me}.` : `<b class="c-ok">Allowed, through a gate.</b> Code may call a service in a more privileged ring, but only at a controlled entry point that the inner ring publishes, never into the middle of its code.`)  // calling, allowed: an ordinary call in the same ring, or a call inward through a gate (a controlled entry point)
          : `<b class="c-bad">Not allowed by this rule.</b> Services may be called only in your own or a more privileged ring; privileged code should not depend on less trusted code.`);  // calling outward, not allowed: privileged code should not depend on less trusted code
    }  // ends paint()
    function ok() { return kind === 'data' ? tgt >= me : tgt <= me; }  // ok(): the two rules; data only in the same or a higher-numbered ring, services only in the same or a lower-numbered ring
    const segMe = ctx.ui.seg([0, 1, 2, 3].map((r) => ({ value: r, label: 'ring ' + r })), me, (v) => { me = v; tgt = null; paint(); });  // switch choosing which ring the student's code runs in; a change clears the target and redraws
    const btns = (k, lab) => h('div', { class: 'row', style: { gap: '6px' } }, h('span', { class: 'small b', style: { width: '138px' } }, lab),  // btns(k, lab): one row of four ring buttons with a label in front; k says whether the row is for using data or calling a service
      ...[0, 1, 2, 3].map((r) => h('button', { class: 'btn sm', onclick: () => { kind = k; tgt = r; paint(); } }, 'ring ' + r)));  // each button records the kind of access and the target ring, then redraws to show the verdict
    paint();  // draws the rings and the starting message when the tab opens
    panel.append(h('div', { class: 'split', style: { height: 'auto', gridTemplateColumns: ctx.narrow ? '1fr' : '300px minmax(0,1fr) minmax(0,1fr)' } },  // lays the tab out in three columns (a 300-pixel drawing column and two equal ones), or one column on phone-width screens
      h('div', { class: 'card white', style: { padding: '4px', display: 'grid', alignItems: 'center' } }, svg),  // column 1: the ring drawing inside a white card
      h('div', { class: 'stack', style: { gap: '8px' } },  // column 2: a vertical stack with 8px gaps
        h('p', { class: 'small m0', html: '<span class="t">Protection rings</span> number privilege levels from ring 0 (the kernel) outward. Two rules:' }),  // paragraph: rings number privilege levels outward from ring 0, the kernel
        h('ul', { class: 'small m0', html: '<li>Data: only in your own ring or a less privileged (higher-numbered) one.</li><li>Services: only in your own ring or a more privileged one, through a gate.</li>' }),  // the two rules as a list: data only outward, services only inward through a gate
        h('div', { class: 'row', style: { gap: '6px' } }, h('span', { class: 'small b', style: { width: '138px' } }, 'My code runs in'), segMe),  // the row that picks which ring the student's code runs in
        btns('data', 'Use data in'), btns('call', 'Call a service in'), res),  // the row of data targets, the row of call targets, and the verdict card; closes column 2
      h('div', { class: 'stack', style: { gap: '8px' } },  // column 3: a vertical stack with 8px gaps
        h('div', { class: 'callout why m0 small', 'data-label': 'Protection from segments', html: 'Every offset is checked against the segment’s length, so a program cannot run off the end of one segment into another. Protection bits in each entry allow, say, reading but not writing.' }),  // blue callout: segments protect by checking every offset against the length, and protection bits allow reading but not writing
        h('div', { class: 'callout tip m0 small', 'data-label': 'Sharing', html: 'To share a segment, the OS lists it in the segment tables of several processes, all pointing at the <b>same</b> copy in memory: one copy of a library, many users.' }),  // green callout: sharing a segment means listing the same copy in several processes' segment tables
        h('p', { class: 'xs muted m0', html: 'Real hardware: x86 processors have 4 rings, but most operating systems use only ring 0 for the kernel and ring 3 for user programs.' }))));  // fine print: x86 has 4 rings but most systems use only ring 0 and ring 3; closes the columns and the append
  }  // ends tabRings()

  Guide.section({  // registers this section with the guide by passing one object that describes it, from its title to its steps
    id: '8.1',  // id: the section number; the guide stores the section under it and uses it for progress and quiz records
    title: 'Hardware and Control Structures',  // title: the full section name shown at the top of each of its slides
    short: 'VM hardware',  // short: a shorter title for tight spaces such as the chapter card's section list
    summary: 'How paging hardware lets a process run with only part of itself in memory: faults, page tables, TLB.',  // summary: one line under the title in the contents panel and the chapter overview
    objectives: [  // objectives: what the student should be able to do afterwards, listed in the printed notes
      'Explain why run-time address translation and scattered pieces mean a process can run with only its resident set in main memory, and trace what happens on a page fault.',  // objective 1: explain why a process can run with only its resident set in memory, and trace a page fault
      'Use the principle of locality to explain why virtual memory works, and describe thrashing.',  // objective 2: use locality to explain why virtual memory works, and describe thrashing
      'Read a page table entry (frame number, present bit, modified bit, protection bits) and translate addresses through single-level, two-level and inverted page tables.',  // objective 3: read a page table entry and translate addresses through one-level, two-level and inverted tables
      'Trace a reference through the TLB and page table, and compute the effective access time from the TLB hit ratio.',  // objective 4: trace a reference through the TLB and page table, and compute the effective access time
      'Weigh the page size trade-offs, and describe segmentation in virtual memory, combined segmentation and paging, and ring protection.',  // objective 5: weigh page size trade-offs, and describe segmentation, combined segmentation and paging, and rings
    ],  // closes the objectives list
    terms: [  // terms: the glossary entries this section adds, each a term and its definition; the guide also links them where they appear
      ['Resident set', 'The pages (or segments) of a process that are in main memory right now. The rest of the process waits on disk until it is needed.'],  // glossary entry: defines the resident set, the part of a process in memory now
      ['Real memory', 'Main memory: the physical RAM. The word "real" contrasts it with virtual memory, the larger memory each process believes it has.'],  // glossary entry: defines real memory, the physical RAM, as opposed to virtual memory
      ['Virtual address space', 'The whole range of addresses a process may use, as the process sees it. It can be far larger than real memory; the parts not in memory are kept on disk.'],  // glossary entry: defines the virtual address space, all the addresses a process may use
      ['Page table entry (PTE)', 'One row of a page table: the number of the frame that holds the page, plus control bits such as present, modified and protection.'],  // glossary entry: defines a page table entry, a frame number plus control bits
      ['Present bit (P)', 'A control bit in a page or segment table entry that says whether that piece is in main memory right now. A reference to a piece with P = 0 causes a fault.'],  // glossary entry: defines the present bit, which says whether a piece is in memory
      ['Modified bit (M)', 'A control bit the hardware sets when a page is written. If it is still 0 when the page is replaced, the copy on disk is current, so the page need not be written out.'],  // glossary entry: defines the modified bit, and why it saves writing a clean page back to disk
      ['Page table pointer register', 'A processor register holding the address where the running process’s page table starts. The OS reloads it on every process switch.'],  // glossary entry: defines the page table pointer register, which the OS reloads on every process switch
      ['Root page table (page directory)', 'The top level of a two-level page table: a small table, kept in main memory at all times, whose entries point to the pages that hold the rest of the page table.'],  // glossary entry: defines the root page table (page directory) of a two-level table
      ['Multilevel page table (two-level page table)', 'A page table split into levels, where each entry of an upper level points to one page of the level below, so only the parts of the table in use need to be in main memory.'],  // glossary entry: defines a multilevel page table, where only the parts in use must be in memory
      ['Inverted page table', 'One table for the whole system with one entry per frame of real memory instead of one per virtual page. It is searched by hashing the page number, and its size depends only on the size of real memory.'],  // glossary entry: defines the inverted page table, one entry per frame, searched by hashing
      ['Hash function', 'A quick rule that turns a key, such as a page number, into a small table index. Different keys can give the same index (a collision), so entries that collide are linked in a chain.'],  // glossary entry: defines a hash function and what a collision chain is
      ['Translation lookaside buffer (TLB)', 'A small, fast hardware cache of recently used page table entries inside the processor, so most address translations need no extra trip to memory.'],  // glossary entry: defines the TLB, a small hardware cache of recent page table entries
      ['TLB miss', 'A translation whose page has no entry in the TLB, so the page table entry must be read from memory first. The opposite, a TLB hit, gets the frame number straight from the TLB.'],  // glossary entry: defines a TLB miss and, by contrast, a TLB hit
      ['Associative lookup', 'A search in which the key is compared with every entry at the same moment by parallel hardware, instead of being used as an index. A TLB is searched this way.'],  // glossary entry: defines associative lookup, comparing a key with every entry at once
      ['Effective access time (EAT)', 'The average time per memory reference once address translation is counted. With TLB hit ratio h, TLB time t and memory time m: EAT = h(t + m) + (1 − h)(t + 2m).'],  // glossary entry: defines the effective access time and gives its formula
      ['Address-space identifier (ASID)', 'A small tag naming the process each TLB entry belongs to, so entries of several processes can share the TLB. Without it the TLB must be flushed at every process switch.'],  // glossary entry: defines the address-space identifier, which spares flushing the TLB on a switch
      ['TLB reach', 'The amount of memory the TLB can map at once: number of TLB entries × page size.'],  // glossary entry: defines TLB reach, entries times page size
      ['Large page (huge page)', 'A page far bigger than the usual 4 KB, such as 2 MB or 1 GB, offered by many processors so that one TLB entry covers much more memory.'],  // glossary entry: defines large (huge) pages, such as 2 MB or 1 GB
      ['Protection ring', 'One of a set of privilege levels numbered from 0 (most privileged, the kernel) outward. Code may use data in its own or a less privileged ring, and may call services in its own or a more privileged ring.'],  // glossary entry: defines a protection ring and its two access rules
    ],  // closes the terms list
    css: ` /* css: this section's own style rules, added to the page when the section registers; each starts with .sec-8-1 so it affects only these slides */
      .sec-8-1 .hot { cursor: pointer; } /* any part of a drawing made clickable (class hot) shows a pointing-hand cursor */
      .sec-8-1 .hot:hover rect { filter: brightness(0.97); } /* hovering a clickable part dims its boxes very slightly, showing it will react */
      .sec-8-1 .tx-acc { fill: var(--accent); } /* SVG text class tx-acc: fills text in the accent indigo */
      .sec-8-1 .tx-ok { fill: var(--ok); } /* SVG text class tx-ok: fills text in success green, used for the "hit" label on the flowchart */
      .sec-8-1 .tx-bad { fill: var(--bad); } /* SVG text class tx-bad: fills text in error red, used for the "no" branch label */
      .sec-8-1 .tx-mem { fill: var(--mem); } /* SVG text class tx-mem: fills text in the memory green, used for memory titles */
      .sec-8-1 .tx-cpu { fill: var(--cpu); } /* SVG text class tx-cpu: fills text in the processor blue */
      .sec-8-1 .tx-io { fill: var(--io); } /* SVG text class tx-io: fills text in the input/output orange, used for the disk title */
      .sec-8-1 .tx-os { fill: var(--os); } /* SVG text class tx-os: fills text in the operating-system purple */
      .sec-8-1 .tx-proc { fill: var(--proc); } /* SVG text class tx-proc: fills text in the process teal */
      .sec-8-1 .tx-warn { fill: var(--warn); } /* SVG text class tx-warn: fills text in warning amber, used for the "miss" label */
      .sec-8-1 .tx-muted { fill: var(--muted); } /* SVG text class tx-muted: fills text in grey, used for free frames */
      .sec-8-1 .c-acc { color: var(--accent); } /* HTML text class c-acc: colours text in the accent indigo */
      .sec-8-1 .c-ok { color: var(--ok); } /* HTML text class c-ok: colours text in success green, as in "Translated." or "TLB hit." */
      .sec-8-1 .c-bad { color: var(--bad); } /* HTML text class c-bad: colours text in error red, as in "Page fault" */
      .sec-8-1 .c-mem { color: var(--mem); } /* HTML text class c-mem: colours text in the memory green */
      .sec-8-1 .c-cpu { color: var(--cpu); } /* HTML text class c-cpu: colours text in the processor blue */
      .sec-8-1 .c-io { color: var(--io); } /* HTML text class c-io: colours text in the input/output orange, used for the wasted-space figure */
      .sec-8-1 .c-os { color: var(--os); } /* HTML text class c-os: colours text in the operating-system purple */
      .sec-8-1 .c-warn { color: var(--warn); } /* HTML text class c-warn: colours text in warning amber, used for the page table figure */
      .sec-8-1 .bits { display: flex; gap: 3px; flex-wrap: wrap; align-items: flex-end; } /* .bits: the row of address bit fields, side by side and wrapping to a new line if they do not fit */
      .sec-8-1 .bits .bf { display: flex; flex-direction: column; align-items: center; gap: 2px; } /* .bf: one field, its bits stacked above its label and centred */
      .sec-8-1 .bits .bv { font-family: var(--mono); font-weight: 800; border-radius: 6px; padding: 2px 5px; border: 2px solid currentColor; background: color-mix(in srgb, currentColor 12%, var(--panel)); white-space: nowrap; } /* .bv: the bits themselves, in bold fixed-width digits inside a box tinted with the field's own colour (currentColor) */
      .sec-8-1 .bits .bl { font-size: 12.5px; font-weight: 700; white-space: nowrap; } /* .bl: the label under each field, small and bold, never split over two lines */
      .sec-8-1 table.tbl td.dif { font-weight: 700; } /* table cells marked dif (the comparison rows) are made bold */
      .sec-8-1 .kv { display: grid; grid-template-columns: auto 1fr; gap: 2px 10px; align-items: baseline; } /* .kv: a two-column grid of value and description, lined up on the text baseline */
    `,  // ends the css text
    steps: [  // steps: the list of slides in this section, in order
      {  // opens step 1
        title: 'A process does not have to be all in memory',  // step 1 title, shown at the top of the slide
        kind: 'story',  // kind story: labelled Big Picture, the section's opening step
        render(el, ctx) {  // render(el, ctx): builds step 1 inside el when the slide opens
          const { h, s } = ctx;  // takes the HTML builder h and the SVG builder s out of ctx
          const NF = 16, NPROC = 8, PAGES = 6, IOWAIT = 0.8;  // NF: 16 frames of memory; NPROC: 8 processes; PAGES: 6 pages each; IOWAIT: each process waits for I/O 80% of the time
          const LET = 'ABCDEFGH';  // LET: the letters that name the eight processes, A to H
          // Payoff tab: a 16-frame memory shared by eight 6-page processes.
          function payoff(panel) {  // payoff(panel): draws the first tab, showing how many processes fit when each keeps only some pages in memory
            let k = PAGES;  // k: how many pages each process keeps in memory, all 6 to begin with
            const COLS = ctx.narrow ? 4 : 8;   // small screens: 4 rows of 4 frames so the labels stay readable
            const svg = s('svg', { viewBox: `0 0 ${4 + COLS * 77} ${26 + (NF / COLS) * 56}`, width: '100%' });  // svg: the memory drawing, sized for the number of columns and rows of frames
            const stats = h('div', { class: 'grid-2', style: { gap: '10px' } });  // stats: two cards side by side, processes in memory and how busy the processor is
            const out = h('div', { class: 'small', style: { lineHeight: '1.45' } });  // out: the paragraph that explains the current setting
            function draw() {  // draw(): redraws the frames, the cards and the explanation; runs at the start and on every slider move
              const n = Math.min(NPROC, Math.floor(NF / k));  // n: how many processes fit, 16 frames divided by k pages each, at most 8
              const kids = [s('text', { x: 4, y: 16, 'font-weight': 800, 'font-size': 14.5, class: 'tx-mem' }, 'Real memory: 16 frames')];  // kids starts with the title over the frames
              for (let f = 0; f < NF; f++) {  // draws the 16 frames in turn
                const col = f % COLS, row = Math.floor(f / COLS), x = 4 + col * 77, y = 26 + row * 56;  // col and row: where frame f sits in the grid; x and y: its top-left corner
                const p = Math.floor(f / k), pg = f % k, used = p < n;  // p: the process whose pages fill this frame; pg: which of its pages; used: true if that process is one of the n that fit
                kids.push(s('rect', { x, y, width: 71, height: 48, rx: 8, class: used ? 's-proc' : 's-panel', 'stroke-width': 1.5 }),  // the frame's box, teal when it holds a page and plain when free
                  s('text', { x: x + 35.5, y: y + 22, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800, class: used ? 'tx-proc' : 'tx-muted' }, used ? LET[p] + ' · p' + pg : 'free'),  // the main label: the process letter and page number, like "A · p0", or "free"
                  s('text', { x: x + 35.5, y: y + 40, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, 'frame ' + f));  // a small grey second label with the frame number
              }  // ends the loop over frames
              svg.replaceChildren(...kids);  // replaces the old memory drawing with the new frames
              const busy = 1 - Math.pow(IOWAIT, n);  // busy: the share of time the processor has work; it idles only when all n processes wait for I/O at once (0.8 to the power n)
              const waiting = LET.slice(n, NPROC).split('').join(' ');  // waiting: the letters of the processes that did not fit, separated by spaces
              stats.replaceChildren(  // rebuilds the two cards under the drawing
                h('div', { class: 'card tight' }, h('div', { class: 'xs muted b' }, 'PROCESSES IN MEMORY'), h('div', { class: 'big', style: { fontSize: '34px' } }, String(n)),  // card 1: the number of processes in memory, in large digits
                  h('div', { class: 'xs muted' }, waiting ? 'left outside: ' + waiting : 'all eight fit')),  // with the processes left outside listed underneath, or "all eight fit"
                h('div', { class: 'card tight' }, h('div', { class: 'xs muted b' }, 'PROCESSOR BUSY'), h('div', { class: 'big', style: { fontSize: '34px', color: busy > 0.6 ? 'var(--ok)' : busy > 0.4 ? 'var(--warn)' : 'var(--bad)' } }, Math.round(busy * 100) + '%'),  // card 2: how busy the processor is as a percentage, green above 60%, amber above 40%, red below
                  h('div', { class: 'meter' }, h('i', { style: { width: busy * 100 + '%' } }))));  // with a meter filled to the same percentage
              out.innerHTML = (k === PAGES  // the explanation, which depends on how many pages each process keeps
                ? '<b>Whole processes:</b> each needs all 6 frames, so only 2 fit and 4 frames go unused.'  // with all 6 pages, only 2 whole processes fit and 4 frames go unused
                : `<b>Only ${k} pages each:</b> the other ${PAGES - k} pages of every process stay on disk until needed, so ${n} processes fit.`) +  // with fewer pages, the rest stay on disk until needed, so more processes fit
                ` If each process waits for I/O 80% of the time, the processor idles only when ${n === 2 ? 'both' : 'all ' + n} wait at once: 0.8<sup>${n}</sup> ≈ ${ctx.util.fmt(Math.pow(IOWAIT, n) * 100, 0)}% of the time.` +  // then the I/O-wait arithmetic: the processor is idle only when every process in memory waits at once
                (k <= 2 ? ' <span class="c-bad b">But keep too few pages and every process faults constantly (step 3).</span>' : '');  // with 2 pages or fewer, a red warning that too few pages leads to constant faults, the topic of step 3
            }  // ends draw()
            const sl = ctx.ui.slider({ label: 'Pages kept in memory per process', min: 2, max: PAGES, value: k, format: (v) => v === PAGES ? '6 (all)' : String(v), onInput: (v) => { k = v; draw(); } });  // slider for the number of pages each process keeps, from 2 up to all 6; moving it redraws
            draw();  // draws the starting state when the tab opens
            panel.append(h('div', { class: 'stack', style: { gap: '10px' } }, sl, h('div', { class: 'card white', style: { padding: '6px 8px' } }, svg), stats, out,  // adds the tab's content as a stack: the slider, the drawing in a white card, the two cards and the explanation
              h('div', { class: 'callout tip small m0', 'data-label': 'Payoff 2: programs bigger than memory', html: 'A 40-page program could never even start under simple paging (40 > 16 frames). With virtual memory it runs with a few of its pages in memory at a time.' })));  // green tip: the second payoff, a program bigger than all of memory can still run; closes the stack
          }  // ends payoff()
          // Comparison tab.
          const yes = '<span class="c-ok b">Yes</span>', no = '<span class="c-bad b">No</span>';  // yes and no: the green Yes and red No used in the comparison table
          const ROWS = [  // ROWS: the comparison table, one row per question; four answers, or two (one for paging, one for segmentation) where VM changes nothing
            ['Memory is divided into', 'equal-size frames', null, 'nothing fixed in advance', null],  // row: how memory is divided, frames for paging and nothing fixed for segmentation
            ['A process is split into', 'pages (invisible to the programmer)', null, 'segments (visible to the programmer)', null],  // row: how a process is split, pages the programmer cannot see or segments the programmer can
            ['Space is wasted by', 'internal fragmentation', null, 'external fragmentation', null],  // row: which kind of fragmentation wastes space for each scheme
            ['The OS keeps', 'a page table per process + a free-frame list', null, 'a segment table per process + a list of holes', null],  // row: what the OS has to keep track of for each scheme
            ['All pieces in memory while it runs?', yes, no, yes, no],  // row: must every piece be in memory while the process runs? Yes for the simple schemes, No with virtual memory
            ['Pieces read in only when needed?', no, yes, no, yes],  // row: are pieces read in only when needed? Only with virtual memory
            ['Reading one in may force another out?', no, yes, no, yes],  // row: can reading one piece in force another out? Only with virtual memory
            ['Process may exceed main memory?', no, yes, no, yes],  // row: may a process be bigger than main memory? Only with virtual memory
          ];  // closes the ROWS table
          function compare(panel) {  // compare(panel): draws the second tab, the table comparing simple and virtual-memory paging and segmentation
            const tb = h('table', { class: 'tbl compact', style: { fontSize: ctx.narrow ? '12.5px' : '13.5px', tableLayout: 'fixed' } });  // tb: the table, slightly smaller text on phone-width screens; fixed layout keeps the column widths as set below
            const hd = ctx.narrow ? ['Paging', 'VM paging', 'Segm.', 'VM segm.'] : ['Simple paging', 'VM paging', 'Simple segm.', 'VM segm.'];  // hd: the four column headings, shortened on phone-width screens
            tb.innerHTML = '<colgroup><col style="width:31%"><col style="width:16%"><col style="width:18%"><col style="width:16%"><col style="width:19%"></colgroup>' +  // sets the five column widths, then the table's content
              '<tr><th></th>' + hd.map((x) => `<th${ctx.narrow ? ' style="font-size:11px;letter-spacing:0"' : ''}>${x}</th>`).join('') + '</tr>' +  // the heading row: a blank corner cell and the four scheme names, squeezed smaller on phone-width screens
              ROWS.map((r, i) => '<tr' + (i >= 4 ? ' class="on"' : '') + '><td class="b">' + r[0] + '</td>' +  // one row per entry of ROWS; the last four, which virtual memory changes, are highlighted
                (r[2] == null ? `<td colspan="2">${r[1]}</td><td colspan="2">${r[3]}</td>` : `<td class="dif">${r[1]}</td><td class="dif">${r[2]}</td><td class="dif">${r[3]}</td><td class="dif">${r[4]}</td>`) + '</tr>').join('');  // shared rows span two columns per scheme; the yes/no rows fill all four cells in bold
            panel.append(h('div', { class: 'stack', style: { gap: '10px' } }, tb,  // adds the table and a note under it to the tab
              h('p', { class: 'small m0', html: 'VM = virtual memory. The top four rows hold with or without it. The <b>highlighted rows</b> are what virtual memory changes: pieces move in and out of memory while the process runs.' })));  // note: what VM stands for, and that the highlighted rows are the ones virtual memory changes
          }  // ends compare()
          el.append(h('div', { class: 'split l fill' },  // lays out step 1 in two columns, the left one smaller, filling the slide's height
            h('div', { class: 'stack', style: { gap: '10px' } },  // left column: a vertical stack of text with 10px gaps
              h('p', { class: 'lead m0', html: 'Paging and segmentation (Chapter 7) have two side effects that make something remarkable possible.' }),  // opening sentence: paging and segmentation have two side effects that make something new possible
              h('div', { class: 'card tight small stack', style: { gap: '6px' }, html: '<div><b>1. Addresses are translated while the program runs.</b> Each <span class="t">logical address</span> becomes a <span class="t">physical address</span> at the moment it is used, so a process can be swapped out and come back into <i>different</i> frames.</div><div><b>2. The pieces need not sit together.</b> They can occupy any free places in memory, in any order.</div>' }),  // card: the two side effects, run-time address translation and pieces that need not sit together
              h('div', { class: 'callout why m0', 'data-label': 'The breakthrough', html: 'So nothing forces <b>all</b> of a process into main memory at once. Only the pieces it is using now must be there; the rest wait on disk. This is <span class="t">virtual memory</span>. Here you will see the hardware that makes it work.' }),  // blue callout: the breakthrough, only the pieces in use must be in memory, which is virtual memory
              h('p', { class: 'small m0', html: '<span class="t">Real memory</span> is the RAM itself. Virtual memory is the far larger memory each process <i>believes</i> it has, backed by disk.' }),  // paragraph: real memory is the RAM; virtual memory is the larger memory each process believes it has
              h('div', { class: 'callout analogy small m0', 'data-label': 'Analogy', html: 'A theatre keeps only the current scene’s scenery on stage; the rest waits in the wings until it is needed, so a small stage can hold a huge play.' })),  // analogy callout: a theatre keeps only the current scene's scenery on stage; closes the left column
            ctx.ui.tabs([{ label: 'See the payoff', render: payoff }, { label: 'Four schemes compared', render: compare }])));  // right column: two tabs, the payoff and the four-scheme comparison; closes the layout
        },  // ends render() for step 1
      },  // closes step 1
      {  // opens step 2
        title: 'Running with pieces missing: a page fault',  // step 2 title, shown at the top of the slide
        kind: 'explore',  // kind explore: labelled Explore, a step the student investigates
        core: true,  // core: true keeps this step on the shorter core route through the course
        render(el, ctx) {  // render(el, ctx): builds step 2, the page fault animation, when the slide opens
          const { h, s } = ctx;  // takes the HTML builder h and the SVG builder s out of ctx
          const RES = { 0: 2, 1: 5, 4: 6 };          // A's resident pages → frame
          const B_FR = [0, 1, 3, 4];                 // frames that hold B's pages
          const SEG = [null, ['A', 1, 'A runs', 'A'], ['A', 1, 'A runs', 'A'], ['OS', 1, 'fault', 'flt'], ['OS', 1, 'OS', 'OS'], ['B', 4, 'B runs (disk busy)', 'B runs'], ['OS', 1, 'I/O intr', 'intr'], ['B', 2, 'B runs', 'B'], ['A', 2, 'A retries', 'retry'], null];  // SEG: the timeline block added at each frame: who runs, its width in units, and a long and short label (null adds nothing)
          const FR = [  // FR: the animation's frames; each gives who is on the processor, what it is doing, the states of A and B, page 3's status, the page referenced, and a caption
            { cpu: 'A', sub: 'running its own code', A: 'Running', B: 'Ready', p3: 'disk', ref: null,  // frame 1: A is running and B is ready; page 3 is still on disk
              cap: '<b>Start.</b> Process A is running with only 3 of its 6 pages in memory: pages 0, 1 and 4. Those pages are its <span class="t">resident set</span>. Pages 2, 3 and 5 exist only on disk. Process B is Ready, waiting for the processor.' },  // caption for frame 1: A runs with only pages 0, 1 and 4 in memory, its resident set
            { cpu: 'A', sub: 'uses an address in page 1', A: 'Running', B: 'Ready', p3: 'disk', ref: 1, ok: true,  // frame 2: A refers to page 1, which is present
              cap: '<b>A uses an address in page 1.</b> Its entry says present, frame 5, so the hardware translates the address and the access finishes at full speed. The OS is not involved at all.' },  // caption for frame 2: the hardware translates the address at full speed without the OS
            { cpu: 'A', sub: 'uses an address in page 4', A: 'Running', B: 'Ready', p3: 'disk', ref: 4, ok: true,  // frame 3: A refers to page 4, also present
              cap: '<b>A uses page 4.</b> Also resident (frame 6). While A stays inside its resident set, it runs exactly as if all of it were in memory.' },  // caption for frame 3: inside its resident set, A runs as if all of it were in memory
            { cpu: 'OS', sub: 'page fault on page 3', A: 'Running', B: 'Ready', p3: 'disk', ref: 3, ok: false,  // frame 4: A refers to page 3, which is not present, so the OS takes over
              cap: '<b>A touches page 3, which is not resident.</b> The hardware cannot translate the address, so it raises an interrupt: a memory access fault, better known as a <span class="t">page fault</span>. The processor stops A in mid-instruction and jumps into the OS.' },  // caption for frame 4: the hardware raises a page fault, an interrupt that stops A mid-instruction
            { cpu: 'OS', sub: 'starts a disk read, blocks A', A: 'Blocked', B: 'Ready', p3: 'loading', ref: 3, ok: false,  // frame 5: the OS blocks A and starts reading page 3 from disk
              cap: '<b>The OS fetches the page.</b> It moves A to Blocked, picks a free frame (frame 7; with none free it would first evict a page, see 8.2) and tells the disk to read page 3 into it. A disk read takes milliseconds: millions of instruction times.' },  // caption for frame 5: A becomes Blocked and the disk starts reading page 3 into free frame 7
            { cpu: 'B', sub: 'runs while the disk works', A: 'Blocked', B: 'Running', p3: 'loading', ref: null,  // frame 6: B runs while the disk works
              cap: '<b>Meanwhile, B runs.</b> Rather than let the processor sit idle during the disk read, the OS dispatches another process. The fault costs A time, but costs the system far less.' },  // caption for frame 6: the OS dispatches another process rather than let the processor sit idle
            { cpu: 'OS', sub: 'I/O interrupt handler', A: 'Ready', B: 'Running', p3: 'present', ref: null,  // frame 7: the I/O interrupt handler runs; A becomes Ready and page 3 is present
              cap: '<b>The disk finishes</b> and sends an I/O interrupt. B pauses briefly while the OS marks page 3 present in frame 7 in A’s page table and moves A from Blocked to Ready.' },  // caption for frame 7: the disk's interrupt lets the OS mark page 3 present and move A to Ready
            { cpu: 'B', sub: 'continues', A: 'Ready', B: 'Running', p3: 'present', ref: null,  // frame 8: B continues
              cap: '<b>B carries on.</b> A is Ready but waits its turn: the scheduler, not the fault handler, decides when A runs again.' },  // caption for frame 8: the scheduler, not the fault handler, decides when A runs again
            { cpu: 'A', sub: 'retries the faulting instruction', A: 'Running', B: 'Ready', p3: 'present', ref: 3, ok: true,  // frame 9: A runs again and retries the faulting instruction
              cap: '<b>A is dispatched again.</b> It re-executes the instruction that faulted. Page 3 is now present, so the access succeeds. Apart from the delay, A cannot tell anything happened.' },  // caption for frame 9: page 3 is present now, so the retried access succeeds
            { cpu: 'A', sub: 'running its own code', A: 'Running', B: 'Ready', p3: 'present', ref: null,  // frame 10: A runs on normally
              cap: '<b>Summary:</b> fault → A Blocked → disk read started → another process runs → I/O interrupt → A Ready → A runs and retries. A’s resident set is now pages 0, 1, 3 and 4.' },  // caption for frame 10: a summary of the whole fault sequence and A's new resident set
          ];  // closes the FR list
          const CLS = { A: 's-proc', B: 's-accent', OS: 's-os' };  // CLS: the drawing colour for each party, teal for A, indigo for B, purple for the OS
          const TX = { A: 'tx-proc', B: 'tx-acc', OS: 'tx-os' };  // TX: the matching text colours
          const STC = { Running: 's-ok', Ready: 's-warn', Blocked: 's-bad' };  // STC: the colour of each process state, green Running, amber Ready, red Blocked
          // Small screens: the drawing is shown as five stacked crops, and the timeline is drawn slimmer.
          const views = multiView(ctx, '0 0 1120 344', ['0 0 270 232', '290 0 250 232', '580 0 210 190', '820 0 300 190', '0 232 440 106']);  // views: the whole drawing, or five crops (page table, memory, disk, processor, timeline) on small screens
          const XEND = ctx.narrow ? 430 : 1110;  // XEND: where the timeline ends, shorter on phone-width screens
          function draw(i) {  // draw(i): draws frame i of the animation; the player calls it each time the frame changes
            const f = FR[i], k = [];  // f: this frame's description; k collects the drawing parts
            k.push(s('text', { x: 10, y: 20, 'font-weight': 800, 'font-size': 15, class: 'tx-proc' }, 'Process A’s page table'),  // title over A's page table, in teal
              s('text', { x: 300, y: 20, 'font-weight': 800, 'font-size': 15, class: 'tx-mem' }, 'Main memory (8 frames)'),  // title over main memory, in green
              s('text', { x: 590, y: 20, 'font-weight': 800, 'font-size': 15, class: 'tx-io' }, 'Disk'),  // title over the disk, in orange
              s('text', { x: 830, y: 20, 'font-weight': 800, 'font-size': 15, class: 'tx-cpu' }, 'Processor and process states'));  // title over the processor and process states, in blue
            for (let r = 0; r < 6; r++) {  // draws one row per page of A, pages 0 to 5
              const y = 32 + r * 33, pres = RES[r] != null || (r === 3 && f.p3 === 'present');  // y: the row's top edge; pres: whether the page is in memory, counting page 3 once it has arrived
              const fr = RES[r] != null ? RES[r] : 7, hl = f.ref === r;  // fr: the page's frame (page 3 goes to frame 7); hl: true for the page being referenced in this frame
              k.push(s('rect', { x: 10, y, width: 250, height: 28, rx: 7, class: hl ? (f.ok ? 's-ok' : 's-bad') : 's-panel', 'stroke-width': hl ? 3 : 1.5 }),  // the row's box, green or red when it is the page referenced (by whether the access works), plain otherwise
                s('text', { x: 22, y: y + 19, 'font-size': 14.5, 'font-weight': 700 }, 'page ' + r),  // the row's page number
                s('rect', { x: 92, y: y + 4, width: 46, height: 20, rx: 5, class: pres ? 's-ok' : 's-bad', 'stroke-width': 1.2 }),  // a small box for the present bit, green when the page is in memory and red when not
                s('text', { x: 115, y: y + 19, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 800, class: 's-monot' }, 'P=' + (pres ? 1 : 0)),  // the present bit's value inside that box, P=1 or P=0
                s('text', { x: 150, y: y + 19, 'font-size': 14, class: pres ? '' : 's-sub' }, pres ? '→ frame ' + fr : 'on disk only'));  // where the page is: an arrow and its frame number, or "on disk only" in grey
            }  // ends the loop over page table rows
            for (let fr = 0; fr < 8; fr++) {  // draws the 8 frames of main memory, top to bottom
              const y = 32 + fr * 25.4;  // y: the frame's top edge, 25.4 pixels apart
              let cls = 's-panel', txt = 'free', tc = 'tx-muted';  // by default a frame is plain, labelled "free" in grey
              if (B_FR.includes(fr)) { cls = 's-accent'; txt = 'B'; tc = 'tx-acc'; }  // frames that hold B's pages are indigo and labelled B
              const ap = Object.keys(RES).find((p) => RES[p] === fr);  // ap: the page of A held in this frame, if any
              if (ap != null) { cls = 's-proc'; txt = 'A: page ' + ap; tc = 'tx-proc'; }  // frames that hold one of A's resident pages are teal and say which page
              if (fr === 7 && f.p3 === 'loading') { cls = 's-warn'; txt = 'A: page 3 (arriving)'; tc = 'tx-warn'; }  // while the disk is reading, frame 7 is amber and shows page 3 arriving
              if (fr === 7 && f.p3 === 'present') { cls = 's-proc'; txt = 'A: page 3'; tc = 'tx-proc'; }  // once the read is done, frame 7 holds page 3 of A like any other resident page
              k.push(s('rect', { x: 300, y, width: 230, height: 21, rx: 5, class: cls, 'stroke-width': 1.2 }),  // the frame's box in the chosen colour
                s('text', { x: 310, y: y + 15.5, 'font-size': 12.5, class: 's-sub' }, 'frame ' + fr),  // the frame number at its left end
                s('text', { x: 520, y: y + 15.5, 'text-anchor': 'end', 'font-size': 13.5, 'font-weight': 700, class: tc }, txt));  // what the frame holds, at its right end, in the matching colour
            }  // ends the loop over frames
            const reading = f.p3 === 'loading';  // reading is true while the disk is busy fetching page 3
            k.push(s('rect', { x: 590, y: 32, width: 190, height: 150, rx: 12, class: 's-io', 'stroke-width': 2 }),  // the disk's box, in orange
              mtext(s, 685, 64, ['A’s pages 0–5', '(every page has', 'a copy here)'], { 'text-anchor': 'middle', 'font-size': 14 }, 18),  // its label: every one of A's pages has a copy on disk
              s('text', { x: 685, y: 150, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800, class: reading ? 'tx-io' : 'tx-muted' }, reading ? 'reading page 3…' : 'idle'));  // its status at the bottom: "reading page 3…" in orange while busy, "idle" in grey otherwise
            if (reading) k.push(s('path', { d: 'M590,165 C560,165 565,221 534,221', fill: 'none', class: 's-line', style: 'stroke:var(--io)', 'stroke-dasharray': '6 4', 'marker-end': 'url(#arr-io)' }));  // while reading, a dashed orange arrow curves from the disk into frame 7
            k.push(s('rect', { x: 830, y: 32, width: 280, height: 74, rx: 12, class: CLS[f.cpu], 'stroke-width': 2.5 }),  // the processor box, coloured for whoever runs now: A, B or the OS
              s('text', { x: 970, y: 62, 'text-anchor': 'middle', 'font-size': 19, 'font-weight': 800, class: TX[f.cpu] }, f.cpu === 'OS' ? 'OS (kernel)' : 'Process ' + f.cpu),  // its large label: "OS (kernel)" or the running process's name
              s('text', { x: 970, y: 88, 'text-anchor': 'middle', 'font-size': 14 }, f.sub));  // its smaller line saying what it is doing at this moment
            [['A', 126], ['B', 162]].forEach(([p, y]) => k.push(  // for each process, A and B, draws a row showing its state
              s('text', { x: 832, y: y + 20, 'font-size': 14.5, 'font-weight': 700, class: TX[p] }, 'Process ' + p),  // the process's name in its own colour
              s('rect', { x: 960, y, width: 150, height: 28, rx: 14, class: STC[f[p]], 'stroke-width': 1.5 }),  // a pill for its state, coloured green, amber or red
              s('text', { x: 1035, y: y + 19, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800 }, f[p])));  // the state's name inside the pill: Running, Ready or Blocked
            // Timeline (not to scale).
            const X0 = 92, UNIT = (XEND - X0) / 13;  // X0: where the timeline starts; UNIT: the width of one time unit, the timeline holding 13 units in all
            k.push(s('text', { x: 10, y: 244, 'font-size': 13, 'font-weight': 800, class: 's-sub' }, 'TIMELINE (not to scale)'),  // the timeline's title, with a note that it is not to scale
              s('text', { x: 10, y: 275, 'font-size': 13.5, 'font-weight': 700 }, 'Processor'),  // the label for the processor's lane
              s('text', { x: 10, y: 318, 'font-size': 13.5, 'font-weight': 700 }, 'Disk'),  // the label for the disk's lane
              s('line', { x1: X0, x2: XEND, y1: 296, y2: 296, class: 's-muted', 'stroke-width': 1 }));  // a faint line separating the two lanes
            let x = X0, diskX = null, diskW = 0;  // x: where the next block goes; diskX and diskW: where the disk's busy block starts and how wide it is
            for (let j = 1; j <= i; j++) {  // adds one block per frame shown so far, so the timeline grows as the animation advances
              if (!SEG[j]) continue;  // frames with no block (the first and the last) are skipped
              const [who, u, long, short] = SEG[j], w = u * UNIT, lab = ctx.narrow ? short : long;  // who ran, for how many units, and its label; small screens use the short label
              k.push(s('rect', { x: x + 1, y: 256, width: w - 2, height: 28, rx: 5, class: CLS[who], 'stroke-width': 1.2 }),  // the block in the processor lane, coloured for who ran
                s('text', { x: x + w / 2, y: 275, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 700, class: TX[who] }, lab));  // its label, centred in the block
              if (j === 4 || j === 5) { if (diskX == null) diskX = x; diskW += w; }  // frames 5 and 6 (j = 4 and 5) are while the disk works, so the disk block spans them
              x += w;  // moves x along to the end of this block
            }  // ends the loop over timeline blocks
            if (diskX != null) k.push(s('rect', { x: diskX + 1, y: 304, width: diskW - 2, height: 22, rx: 5, class: 's-io', 'stroke-width': 1.2 }),  // once the read has started, an orange block in the disk lane under those two frames
              s('text', { x: diskX + diskW / 2, y: 320, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 700, class: 'tx-io' }, i >= 6 ? 'read page 3 (done)' : 'reading page 3'));  // its label: "reading page 3", or "read page 3 (done)" once the interrupt has arrived
            views.set(k);  // puts the finished parts into every view of the drawing
          }  // ends draw()
          const player = ctx.ui.player({ count: FR.length, interval: 2600, render: (i) => { draw(i); return FR[i].cap; } });  // player: the animation controls; it has one frame per FR entry, plays every 2.6 seconds, and shows each frame's caption
          el.append(h('div', { class: 'stack fill', style: { gap: '8px' } },  // lays out step 2 as a vertical stack that fills the slide
            h('p', { class: 'm0', html: 'Step through one process, A, that runs with part of itself on disk. Watch its page table, memory, the disk and the process states change together.' }),  // instruction line: step through process A and watch its table, memory, disk and states change together
            h('div', { class: 'card white', style: { padding: '6px 10px', flex: '1', minHeight: '0', display: 'grid', placeItems: 'center', gap: '6px' } }, ...views),  // the drawing views in a white card that takes the leftover height
            player.el));  // the player's caption and controls; closes the stack
        },  // ends render() for step 2
      },  // closes step 2
      {  // opens step 3
        title: 'Locality makes it work; thrashing breaks it',  // step 3 title, shown at the top of the slide
        kind: 'explore',  // kind explore: labelled Explore
        render(el, ctx) {  // render(el, ctx): builds step 3, locality and thrashing, when the slide opens
          const { h, s } = ctx;  // takes the HTML builder h and the SVG builder s out of ctx
          const N = 160, NP = 16, COST = 5;  // N: 160 references in the trace; NP: 16 pages in the program; COST: the extra time units one fault costs in the simple model
          const PHASES = [[2, 3, 4], [9, 10], [12, 13, 14], [5, 6, 7]];  // PHASES: the clusters of pages the program works in, one after another, like the loops and data of a real program
          const NEED = Math.max(...PHASES.map((ph) => ph.length)) + 1;   // largest cluster plus page 0
          function makeTrace(kind) {  // makeTrace(kind): builds the list of page references, either with locality ("loc") or completely random ("rand")
            const r = ctx.util.seeded(7), t = [];  // r: a seeded random-number generator (seed 7), so the same dots appear every time; t: the trace
            if (kind === 'rand') { for (let i = 0; i < N; i++) t.push(Math.floor(r() * NP)); return t; }  // a random trace: each of the 160 references picks any of the 16 pages
            for (let i = 0; i < N; i++) { const ph = PHASES[Math.floor(i / (N / PHASES.length))]; const x = r(); t.push(x < 0.15 ? 0 : ph[Math.floor(r() * ph.length)]); }  // a locality trace: four phases of 40 references; each is page 0 15% of the time, otherwise a page from the current cluster
            return t;  // hands back the trace
          }  // ends makeTrace()
          // Least-recently-used replacement: returns which references hit.
          function run(t, F) { const m = new Map(); return t.map((p) => { const hit = m.has(p); if (hit) m.delete(p); else if (m.size >= F) m.delete(m.keys().next().value); m.set(p, 1); return hit; }); }  // run(t, F): replays the trace with F frames; a Map keeps pages in order of last use, so its first key is the one to replace
          let kind = 'loc', F = 4;  // current settings: the locality trace and 4 frames
          const W = ctx.narrow ? 364 : 640, X = (i) => 42 + i * (ctx.narrow ? 2 : 3.7), Y = (p) => 252 - p * 14.8, R = ctx.narrow ? 0.8 : 1;  // W: the chart width; X: a reference's position in time; Y: a page number's height; R: dot-size scale, smaller on phone-width screens
          const svg = s('svg', { viewBox: `0 0 ${W} 290`, width: '100%' });  // svg: the scatter chart of references
          const stat = h('div', { class: 'grid-3', style: { gap: '10px' } });  // stat: three columns for the result cards
          const verdict = h('div', { class: 'callout m0 small' });  // verdict: the callout whose colour and text depend on how the run went
          function draw() {  // draw(): rebuilds the trace, replays it and redraws everything; runs at the start and on every change
            const t = makeTrace(kind), hits = run(t, F), faults = hits.filter((x) => !x).length;  // t: the trace; hits: true or false for each reference; faults: how many references missed
            const useful = N / (N + COST * faults);  // useful: the share of time on real work when each reference costs 1 unit and each fault 5 more
            const k = [];  // k collects the chart parts
            for (let p = 0; p < NP; p += 3) k.push(s('text', { x: 34, y: Y(p) + 4.5, 'text-anchor': 'end', 'font-size': 13, class: 's-sub' }, String(p)));  // page number labels down the side, every third page
            k.push(s('line', { x1: 40, x2: W - 4, y1: 262, y2: 262, class: 's-muted', 'stroke-width': 1 }),  // the time axis line along the bottom
              s('text', { x: W / 2 + 20, y: 282, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 700 }, 'Time → (160 memory references)'),  // the time axis title
              s('text', { x: 12, y: 140, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 700, transform: 'rotate(-90 12 140)' }, 'Page number'));  // the page number axis title, turned on its side
            t.forEach((p, i) => k.push(s('circle', { cx: X(i), cy: Y(p), r: (hits[i] ? 2.5 : 3.3) * R, style: hits[i] ? 'fill:var(--ok)' : 'fill:var(--bad)' })));  // one dot per reference: small and green for a hit, larger and red for a fault
            svg.replaceChildren(...k);  // replaces the old chart with the new dots
            const pct = Math.round(useful * 100);  // pct: the useful share as a whole percentage
            stat.replaceChildren(  // rebuilds the result cards
              h('div', { class: 'card tight' }, h('div', { class: 'xs muted b' }, 'PAGE FAULTS'), h('div', { class: 'big', style: { fontSize: '30px' } }, String(faults)), h('div', { class: 'xs muted' }, `${ctx.util.fmt((100 * faults) / N, 0)}% of references`)),  // card 1: the number of page faults and what share of references they are
              h('div', { class: 'card tight', style: { gridColumn: 'span 2' } }, h('div', { class: 'xs muted b' }, 'SHARE OF TIME SPENT ON USEFUL WORK'),  // card 2, two columns wide: the share of time spent on useful work
                h('div', { class: 'row nw', style: { gap: '10px' } }, h('div', { class: 'big', style: { fontSize: '30px', color: pct >= 60 ? 'var(--ok)' : pct >= 40 ? 'var(--warn)' : 'var(--bad)' } }, pct + '%'),  // the percentage in large digits, green from 60%, amber from 40%, red below
                  h('div', { class: 'meter grow', style: { height: '14px' } }, h('i', { style: { width: pct + '%', background: pct >= 60 ? 'var(--ok)' : pct >= 40 ? 'var(--warn)' : 'var(--bad)' } }))),  // a meter filled to the same percentage in the same colour
                h('div', { class: 'xs muted' }, `model: each reference = 1 unit of work, each fault = ${COST} more units waiting for the disk (a real disk is far slower)`)));  // fine print: the model behind the number, 1 unit per reference and 5 per fault, far kinder than a real disk
            if (kind === 'loc' && pct < 40) { verdict.className = 'callout bad m0 small'; verdict.dataset.label = 'Thrashing'; verdict.innerHTML = `With only ${F} frame${F > 1 ? 's' : ''}, the current cluster of pages does not fit. Pages are thrown out just before they are needed again, so the red dots pile up and most of the time goes to paging.`; }  // locality but under 40% useful: a red "Thrashing" callout, pages are thrown out just before they are needed again
            else if (kind === 'loc' && F < NEED) { verdict.className = 'callout warn m0 small'; verdict.dataset.label = 'Close to the edge'; verdict.innerHTML = `The biggest cluster needs ${NEED} pages (${NEED - 1} plus page 0) but gets only ${F}, so pages are thrown out just before reuse: ${faults} faults, against ${run(makeTrace('loc'), NEED).filter((x) => !x).length} with ${NEED} frames.`; }  // locality and fewer frames than the biggest cluster needs: an amber callout comparing the faults with the count at enough frames
            else if (kind === 'loc') { verdict.className = 'callout tip m0 small'; verdict.dataset.label = 'Locality at work'; verdict.innerHTML = `${F} frames hold each cluster (the program’s current few pages plus page 0). Faults happen almost only when the program moves to a new cluster: the red dots at each jump.`; }  // locality with enough frames: a green callout, faults happen almost only at the jump to a new cluster
            else { verdict.className = 'callout warn m0 small'; verdict.dataset.label = 'No locality'; verdict.innerHTML = 'References jump all over 16 pages, so the recent past says nothing about the next page and faults stay high until nearly every page fits. Real programs rarely behave like this.'; }  // random references: an amber callout, without locality the past says nothing about the next page
          }  // ends draw()
          const seg = ctx.ui.seg([{ value: 'loc', label: 'Real program (locality)' }, { value: 'rand', label: 'Random references' }], kind, (v) => { kind = v; draw(); });  // switch between the locality trace and random references; changing it redraws
          const sl = ctx.ui.slider({ label: 'Frames for this process', min: 1, max: 12, value: F, onInput: (v) => { F = v; draw(); } });  // slider for the frames given to the process, 1 to 12; moving it redraws
          draw();  // draws the chart and cards once when the slide opens
          el.append(h('div', { class: 'split l fill' },  // lays out step 3 in two columns, the left one smaller, filling the slide's height
            h('div', { class: 'stack', style: { gap: '10px' } },  // left column: a vertical stack of text with 10px gaps
              h('p', { class: 'm0', html: 'When memory is full, bringing a piece in means throwing another out. Throw out a piece just before it is needed, and it must be fetched straight back.' }),  // paragraph: when memory is full, bringing a piece in throws another out, perhaps one needed next
              h('div', { class: 'callout bad m0 small', 'data-label': 'Thrashing', html: 'When that happens over and over, the processor spends most of its time waiting for pieces to move and little time running programs. This is <span class="t">thrashing</span>.' }),  // red callout: when that keeps happening, the processor mostly waits; this is thrashing
              h('p', { class: 'm0', html: 'The <span class="t">principle of locality</span> saves it: over a short stretch of time, references cluster in a few pages (a loop, its function, the array it walks). So the recent past predicts the near future, and the OS can guess which pages to keep.' }),  // paragraph: the principle of locality, references cluster in a few pages, so the recent past predicts the near future
              h('div', { class: 'card tight small', html: '<b>Virtual memory needs two things:</b> (1) <b>hardware</b> support for paging and/or segmentation, to translate addresses and fault on missing pieces; (2) <b>OS software</b> to move pieces in and out.' }),  // card: virtual memory needs both hardware support and OS software
              verdict),  // the verdict callout goes last; closes the left column
            h('div', { class: 'stack', style: { gap: '8px' } },  // right column: a vertical stack with 8px gaps
              h('div', { class: 'row', style: { gap: '12px' } }, seg, h('div', { class: 'grow', style: { minWidth: '220px' } }, sl)),  // the trace switch and the frames slider side by side; the slider keeps at least 220 pixels
              h('div', { class: 'card white', style: { padding: '4px 8px' } }, svg,  // the chart inside a white card
                h('div', { class: 'row xs', style: { gap: '14px', justifyContent: 'center' }, html: '<span><b class="c-ok">●</b> page already in memory</span><span><b class="c-bad">●</b> page fault</span><span class="muted">The demo evicts the page unused for longest.</span>' })),  // the chart's key under it: green dot = page already in memory, red dot = page fault, and the replacement rule used
              stat)));  // the three result cards; closes the right column and the layout
        },  // ends render() for step 3
      },  // closes step 3
      {  // opens step 4
        title: 'Inside a page table entry: the P and M bits',  // step 4 title, shown at the top of the slide
        kind: 'explore',  // kind explore: labelled Explore
        core: true,  // core: true keeps this step on the shorter core route
        render(el, ctx) {  // render(el, ctx): builds step 4, a page table entry the student can use, when the slide opens
          const { h, s } = ctx;  // takes the HTML builder h and the SVG builder s out of ctx
          const PS = 1024, TABLE_AT = 30720, NPG = 8;  // PS: 1 KB pages; TABLE_AT: where the page table starts in memory; NPG: the process has 8 pages
          const INIT = () => [  // INIT(): makes a fresh copy of the starting page table, so Reset can put it back
            { p: 1, m: 0, f: 12, ro: true }, { p: 1, m: 0, f: 3, ro: true }, { p: 0, m: 0, f: null, ro: false }, { p: 1, m: 1, f: 25, ro: false },  // pages 0 to 3: pages 0 and 1 are read-only code in frames 12 and 3; page 2 is on disk; page 3 is in frame 25 and already modified
            { p: 0, m: 0, f: null, ro: false }, { p: 1, m: 0, f: 7, ro: false }, { p: 0, m: 0, f: null, ro: false }, { p: 0, m: 0, f: null, ro: false }];  // pages 4 to 7: only page 5 is in memory (frame 7); the others are on disk
          const BITS = {  // BITS: the explanation shown when the student clicks a column name, keyed by column
            frame: ['Frame number', 'Which frame of real memory holds the page. It means something only while P = 1.'],  // explains the frame number field, meaningful only while P = 1
            P: ['Present bit (P)', '1: the page is in main memory now. 0: it is only on disk, and touching it raises a page fault. The OS sets and clears P; the hardware checks it on every reference.'],  // explains the present bit: who sets it, and that P = 0 causes a page fault
            M: ['Modified bit (M)', 'The hardware sets M to 1 the first time the page is written. At replacement, M = 0 means the disk copy is still identical, so the frame is simply reused; M = 1 means the page must be written back to disk first.'],  // explains the modified bit and how it decides whether a page must be written back on replacement
            prot: ['Protection bits', 'What the process may do with the page, such as read-only or read/write (many machines add execute). A write to a read-only page raises a protection fault. Related bits mark a page as shared.'],  // explains the protection bits, such as read-only, and the protection fault on a forbidden write
          };  // closes the BITS table
          let pt, free, op = 'read', addr = 3500, mode = 'idle', pend = null, reads = 0, writes = 0;  // state: the page table, free frames, read or write, the address, the mode (idle, fault or pick), the access waiting on a fault, and the disk counters
          const info = h('div', { class: 'card tight small', style: { minHeight: '92px' } });  // info: the card that explains the column the student last clicked
          const showBit = (k) => { info.innerHTML = `<b>${BITS[k][0]}.</b> ${BITS[k][1]}`; };  // showBit(k): writes the explanation for column k into the info card
          const svg = s('svg', { viewBox: '0 0 470 262', width: '100%' });  // svg: the drawing of the page table
          const xlate = h('div', { class: 'card tight', style: { padding: '8px 12px' } });  // xlate: the card that previews how the current address translates
          const narr = h('div', { class: 'card tight small', style: { minHeight: '84px' } });  // narr: the card that explains what the last button press did
          const act = h('div', { class: 'row', style: { gap: '8px' } });  // act: the row of buttons
          const counters = h('div', { class: 'row small', style: { gap: '8px' } });  // counters: chips counting disk reads and writes and listing the free frames
          const field = (v, lab, col) => `<div class="bf" style="color:${col}"><span class="bv">${v}</span><span class="bl">${lab}</span></div>`;  // field(v, lab, col): a copy of the shared helper, HTML for one coloured box of bits with its label underneath
          function rowClick(r) {  // rowClick(r): what clicking row r of the table does
            if (mode !== 'pick') { addr = r * PS + (addr % PS); slider.set(addr); paint(); return; }  // normally it moves the address to page r, keeping the same offset, updates the slider and redraws
            const v = pt[r];  // v: the entry clicked, while the student is choosing a page to evict
            if (!v.p || r === pend.page) { ctx.toast('Pick a page that is in memory (P = 1) and is not page ' + pend.page + '.'); return; }  // refuses a page that is not in memory, or the very page being loaded, with a short message at the bottom of the screen
            const fr = v.f, dirty = v.m === 1;  // fr: the frame being freed; dirty: whether the evicted page was modified
            if (dirty) writes++;  // a modified page has to be written back to disk first, so the write counter goes up
            v.p = 0; v.f = null; v.m = 0;  // marks the evicted page as absent with no frame, and clears its M bit
            load(pend.page, fr, `Page ${r} was evicted from frame ${fr}. ` + (dirty  // loads the waiting page into the freed frame, explaining the eviction first
              ? `Its M bit was 1, so it was <b>written back to disk first</b> (a disk write), then page ${pend.page} was read in: <b>two</b> slow transfers.`  // if M was 1: a disk write and then a disk read, two slow transfers
              : `Its M bit was 0, so its disk copy was still current: the frame was simply reused and page ${pend.page} read in. <b>One</b> transfer instead of two.`));  // if M was 0: the disk copy was current, so only one transfer was needed
          }  // ends rowClick()
          function load(page, fr, why) {  // load(page, fr, why): finishes a fault by putting the page in frame fr and retrying the access
            const e = pt[page], w = pend.write, off = pend.off;  // e: the entry being filled; w: whether the waiting access was a write; off: its offset in the page
            e.p = 1; e.f = fr; e.m = w ? 1 : 0; reads++;  // marks the page present in frame fr, sets M if the retried access is a write, and counts one disk read
            mode = 'idle'; pend = null;  // the fault is over: back to idle with nothing waiting
            narr.innerHTML = why + ` The OS set P = 1 and frame ${fr} in the entry, and the instruction was retried: it now succeeds at real address ${fr} × 1024 + ${off} = <b>${fr * PS + off}</b>` + (w ? ', and since it was a write, the hardware set M = 1.' : '.');  // narration: why the frame was chosen, then the retried access and its real address, noting M = 1 after a write
            paint();  // redraws everything
          }  // ends load()
          function access() {  // access(): the read or write button; tries the access the way the hardware would
            if (mode !== 'idle') return;  // does nothing while a fault is still being handled
            const page = Math.floor(addr / PS), off = addr % PS, e = pt[page], w = op === 'write';  // page and off: the address split into page number and offset; e: that page's entry; w: true for a write
            if (!e.p) {  // first check, the present bit
              mode = 'fault'; pend = { page, write: w, off };  // absent: the page faults; the access is remembered so it can be retried after the OS loads the page
              narr.innerHTML = `<b class="c-bad">Page fault.</b> The entry for page ${page} has P = 0, so the hardware cannot form a real address. It interrupts, and the OS must bring page ${page} in from disk before the ${op} can be retried.`;  // narration: the hardware cannot form a real address, so it interrupts and the OS must load the page
            } else if (w && e.ro) {  // present, but a write to a read-only page
              narr.innerHTML = `<b class="c-bad">Protection fault.</b> Page ${page} is present, but its protection bits say read-only (it holds program code). The hardware refuses the write and traps to the OS; nothing changes.`;  // narration: a protection fault; the hardware refuses the write and nothing changes
            } else {  // otherwise the access succeeds
              const was = e.m;  // was: the M bit before this access
              if (w) e.m = 1;  // a write sets the modified bit
              narr.innerHTML = `<b class="c-ok">${w ? 'Write' : 'Read'} done</b> at real address ${e.f} × 1024 + ${off} = <b>${e.f * PS + off}</b>.` +  // narration: the access and its real address, frame times 1,024 plus offset
                (w ? (was ? ' M was already 1.' : ` The hardware set <b>M = 1</b>: page ${page} now differs from its copy on disk.`) : ' A read never changes M.');  // plus what happened to M: set by this write, already 1, or unchanged by a read
            }  // ends the three cases
            paint();  // redraws everything
          }  // ends access()
          function handle() {  // handle(): the OS button that services a page fault
            if (mode !== 'fault') return;  // does nothing unless a fault is waiting
            if (free.length) { const fr = free.shift(); load(pend.page, fr, `Frame ${fr} was free, so the OS read page ${pend.page} into it (one disk read).`); }  // with a free frame, the OS takes it and loads the page with one disk read
            else { mode = 'pick'; narr.innerHTML = `<b>No free frame is left.</b> Click a page that is in memory to evict it. Watch its <b>M</b> bit: it decides whether the victim must be written to disk first.`; paint(); }  // with none left, it asks the student to pick a page to evict, pointing out the M bit
          }  // ends handle()
          function reset() { pt = INIT(); free = [19]; mode = 'idle'; pend = null; reads = 0; writes = 0; narr.innerHTML = '<b>Pick an address and press the button.</b> <span class="muted">The translation above previews what the hardware will do. Try a write to page 3, a read of page 4, then a read of page 6 (two faults; the second finds no free frame), and a write to page 0.</span>'; showBit('P'); paint(); }  // reset(): puts back the starting table with one free frame (19), zeros the counters, shows a hint of things to try and the P explanation, then redraws
          function paint() {  // paint(): redraws the table, the translation preview, the buttons and the counters
            const page = Math.floor(addr / PS), off = addr % PS, e = pt[page];  // page, off and e for the current address
            const k = [s('text', { x: 4, y: 16, 'font-size': 13, 'font-weight': 800, class: 's-sub' }, 'CLICK A COLUMN NAME TO SEE WHAT IT MEANS')];  // k starts with a hint above the table: click a column name to see what it means
            const COLS = [['page', 34, null, 0], ['P', 104, 'P', 48], ['M', 168, 'M', 48], ['access', 268, 'prot', 84], ['frame', 396, 'frame', 76]];  // COLS: each column's heading, position, the BITS key it explains (none for page) and the width of its clickable box
            COLS.forEach(([lab, x, key, bw]) => {  // draws each column heading
              const t = s('text', { x, y: 41, 'text-anchor': 'middle', 'font-size': 14.5, 'font-weight': 800, class: key ? 'tx-acc' : '' }, lab);  // the heading text, in the accent colour when it can be clicked
              k.push(key ? hotGroup(ctx, () => showBit(key), 'Explain ' + lab, s('rect', { x: x - bw / 2, y: 24, width: bw, height: 24, rx: 6, class: 's-accent', 'stroke-width': 1 }), t) : t);  // a clickable heading gets a tinted box and is wrapped by hotGroup so a click or Enter shows its explanation
            });  // ends the loop over headings
            pt.forEach((v, r) => {  // draws one row per page
              const y = 54 + r * 25.5, sel = r === page, pick = mode === 'pick' && v.p && r !== pend.page;  // y: the row's top edge; sel: the page of the current address; pick: a page the student may evict right now
              const kids = [s('rect', { x: 2, y, width: 466, height: 22, rx: 5, class: sel ? (mode !== 'idle' && pend && r === pend.page ? 's-bad' : 's-warn') : pick ? 's-accent' : 's-panel', 'stroke-width': sel || pick ? 2.2 : 1 }),  // the row's box: red for the page being loaded, amber for the current page, indigo for an eviction candidate, plain otherwise
                s('text', { x: 34, y: y + 16, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700 }, String(r)),  // column 1: the page number
                s('text', { x: 104, y: y + 16, 'text-anchor': 'middle', 'font-size': 14.5, 'font-weight': 800, class: v.p ? 'tx-ok' : 'tx-bad' }, String(v.p)),  // column 2: P, green 1 or red 0
                s('text', { x: 168, y: y + 16, 'text-anchor': 'middle', 'font-size': 14.5, 'font-weight': 800, class: v.m ? 'tx-warn' : 'tx-muted' }, String(v.m)),  // column 3: M, amber when 1 and grey when 0
                s('text', { x: 268, y: y + 16, 'text-anchor': 'middle', 'font-size': 13.5 }, v.ro ? 'read-only (code)' : 'read/write'),  // column 4: the access allowed, read-only code or read/write
                s('text', { x: 396, y: y + 16, 'text-anchor': 'middle', 'font-size': 14, class: v.p ? 's-monot' : 's-sub' }, v.p ? String(v.f) : '–')];  // column 5: the frame number, or a dash when the page is on disk
              k.push(hotGroup(ctx, () => rowClick(r), 'Page ' + r, ...kids));  // the whole row is clickable: it selects that page, or evicts it while picking
            });  // ends the loop over rows
            svg.replaceChildren(...k);  // replaces the old table drawing with the new one
            const ent = TABLE_AT + 4 * page;  // ent: the memory address of this page's entry, 4 bytes per entry after the table's start
            xlate.innerHTML = `<div class="row" style="gap:10px;align-items:flex-end"><span class="small b" style="min-width:64px">Virtual<br>${addr}</span><div class="bits">${field(bin(page, 3), 'page ' + page, 'var(--warn)')}${field(bin(off, 10), 'offset ' + off, 'var(--mem)')}</div>` +  // translation preview: the virtual address and its page and offset bit fields
              `<span class="b" style="font-size:20px">→</span>` + (e.p ? `<div class="bits">${field(bin(e.f, 5), 'frame ' + e.f, 'var(--accent)')}${field(bin(off, 10), 'offset ' + off, 'var(--mem)')}</div><span class="small b">Real<br>${e.f * PS + off}</span>` : '<span class="chip bad">P = 0: no frame, page fault</span>') + '</div>' +  // an arrow, then the frame and offset bit fields and the real address, or a red chip saying P = 0 means a page fault
              `<div class="xs muted" style="margin-top:4px">Page table pointer register = ${TABLE_AT}, so the entry for page ${page} is at ${TABLE_AT} + 4 × ${page} = ${ent} (4-byte entries).</div>`;  // fine print: where the entry sits in memory, the pointer register value plus 4 bytes per page
            act.replaceChildren(  // rebuilds the button row
              h('button', { class: 'btn sm primary', disabled: mode !== 'idle', onclick: access }, (op === 'write' ? 'Write to ' : 'Read from ') + 'address ' + addr),  // the main button, worded for the chosen operation and address; greyed out while a fault is being handled
              mode === 'fault' ? h('button', { class: 'btn sm intr', onclick: handle }, 'OS: handle the fault') : null,  // during a fault, a red OS button that services it
              mode === 'pick' ? h('span', { class: 'chip warn' }, 'click a highlighted page to evict it') : null,  // while picking a victim, an amber chip telling the student to click a highlighted page
              h('div', { class: 'grow' }), h('button', { class: 'btn sm ghost', onclick: reset }, 'Reset'));  // a spacer, then Reset at the right end
            counters.innerHTML = `<span class="chip io">disk reads ${reads}</span><span class="chip io">disk writes ${writes}</span><span class="chip mem">free frames: ${free.length ? free.join(', ') : 'none'}</span>`;  // the counters as chips: disk reads, disk writes, and the free frames (or "none")
          }  // ends paint()
          const seg = ctx.ui.seg([{ value: 'read', label: 'Read' }, { value: 'write', label: 'Write' }], op, (v) => { op = v; paint(); });  // switch between Read and Write; changing it redraws so the button wording follows
          const slider = ctx.ui.slider({ label: 'Virtual address', min: 0, max: NPG * PS - 1, value: addr, onInput: (v) => { addr = v; paint(); } });  // slider for the virtual address, 0 to 8,191 (8 pages of 1 KB); moving it redraws the preview
          reset();  // sets up the starting state when the slide opens
          el.append(h('div', { class: 'split l fill' },  // lays out step 4 in two columns, the left one smaller, filling the slide's height
            h('div', { class: 'stack', style: { gap: '8px' } },  // left column: a vertical stack with 8px gaps
              h('p', { class: 'small m0', html: 'Every process has its own page table in main memory. Entry <i>i</i>, a <span class="t">page table entry (PTE)</span>, describes page <i>i</i>: the frame that holds it plus control bits. A lock bit and a use bit (for replacement, 8.2) are not shown.' }),  // paragraph: each process has a page table in memory, and each entry describes one page
              h('div', { class: 'card white', style: { padding: '4px 6px' } }, svg), info),  // the table drawing inside a white card, then the column explanation; closes the left column
            h('div', { class: 'stack', style: { gap: '8px' } },  // right column: a vertical stack with 8px gaps
              h('p', { class: 'small m0', html: 'To translate, the hardware reads the <span class="t">page table pointer register</span> (where the running process’s table starts), uses the page number to find the entry, and puts the frame number in front of the unchanged offset. Pages here are 1 KB.' }),  // paragraph: how the hardware translates, using the page table pointer register and the unchanged offset
              h('div', { class: 'row', style: { gap: '10px' } }, seg, h('div', { class: 'grow', style: { minWidth: '260px' } }, slider)),  // the Read/Write switch beside the address slider, which keeps at least 260 pixels
              xlate, act, narr, counters,  // the translation preview, the buttons, the narration and the counters
              h('div', { class: 'callout why m0 small', 'data-label': 'Why the M bit pays', html: 'Code pages and unchanged data never need writing out, so replacing them costs one disk transfer instead of two.' }))));  // blue callout: why the M bit pays, unchanged pages cost one transfer instead of two; closes the layout
        },  // ends render() for step 4
      },  // closes step 4
      {  // opens step 5
        title: 'Page tables too big to keep: two-level and inverted',  // step 5 title, shown at the top of the slide
        kind: 'explore',  // kind explore: labelled Explore
        render(el, ctx) {  // render(el, ctx): builds step 5 as a set of three tabs when the slide opens
          el.append(ctx.ui.tabs([  // adds the tabs widget; each tab draws itself only when it is opened
            { label: '1 · The size problem', render: (p) => tabSize(p, ctx) },  // tab 1: the size problem, drawn by tabSize
            { label: '2 · A two-level walk', render: (p) => tabTwoLevel(p, ctx) },  // tab 2: a two-level walk, drawn by tabTwoLevel
            { label: '3 · An inverted table', render: (p) => tabInverted(p, ctx) },  // tab 3: an inverted table, drawn by tabInverted
          ]));  // closes the tab list and the append
        },  // ends render() for step 5
      },  // closes step 5
      {  // opens step 6
        title: 'The TLB: a cache for page table entries',  // step 6 title, shown at the top of the slide
        kind: 'lab',  // kind lab: labelled Hands-on Lab
        core: true,  // core: true keeps this step on the shorter core route
        render(el, ctx) {  // render(el, ctx): builds step 6 when the slide opens
          el.append(ctx.h('div', { class: 'stack fill', style: { gap: '8px' } },  // a vertical stack filling the slide
            ctx.h('p', { class: 'small m0', html: 'Every translation needs a page table entry, and page tables live in main memory, so each reference would cost an extra memory access. The <span class="t">translation lookaside buffer (TLB)</span>, a small fast cache of recent entries inside the processor, avoids that most of the time. A <span class="t">TLB miss</span> falls back to the page table.' }),  // paragraph: every translation needs a page table entry from memory, and the TLB caches recent entries to avoid that cost
            ctx.ui.tabs([{ label: 'TLB simulator', render: (p) => tabTLB(p, ctx) }, { label: 'Effective access time', render: (p) => tabEAT(p, ctx) }])));  // two tabs: the TLB simulator and the effective access time calculator; closes the stack
        },  // ends render() for step 6
      },  // closes step 6
      {  // opens step 7
        title: 'How big should a page be?',  // step 7 title, shown at the top of the slide
        kind: 'explore',  // kind explore: labelled Explore
        render(el, ctx) {  // render(el, ctx): builds step 7 as three tabs when the slide opens
          el.append(ctx.ui.tabs([  // adds the tabs widget
            { label: '1 · Table size vs wasted space', render: (p) => tabPageSize(p, ctx) },  // tab 1: page table size against wasted space, drawn by tabPageSize
            { label: '2 · Page size and page faults', render: (p) => tabFaultRate(p, ctx) },  // tab 2: page size and page faults, drawn by tabFaultRate
            { label: '3 · Real machines and TLB reach', render: (p) => tabRealSizes(p, ctx) },  // tab 3: real machines and TLB reach, drawn by tabRealSizes
          ]));  // closes the tab list and the append
        },  // ends render() for step 7
      },  // closes step 7
      {  // opens step 8
        title: 'Segments in virtual memory, and segments made of pages',  // step 8 title, shown at the top of the slide
        kind: 'explore',  // kind explore: labelled Explore
        render(el, ctx) {  // render(el, ctx): builds step 8 as three tabs when the slide opens
          el.append(ctx.ui.tabs([  // adds the tabs widget
            { label: '1 · Segments in virtual memory', render: (p) => tabSegVM(p, ctx) },  // tab 1: segments in virtual memory, drawn by tabSegVM
            { label: '2 · Segmentation + paging', render: (p) => tabSegPage(p, ctx) },  // tab 2: segmentation combined with paging, drawn by tabSegPage
            { label: '3 · Protection and sharing', render: (p) => tabRings(p, ctx) },  // tab 3: protection rings and sharing, drawn by tabRings
          ]));  // closes the tab list and the append
        },  // ends render() for step 8
      },  // closes step 8
      {  // opens step 9
        title: 'Recap: eight ideas to carry away',  // step 9 title, shown at the top of the slide
        kind: 'recap',  // kind recap: labelled Recap
        render(el, ctx) {  // render(el, ctx): builds the recap cards when the slide opens
          const { h } = ctx;  // takes the HTML builder h out of ctx
          const flipAll = (on) => ctx.$$('.flip').forEach((c) => c.classList.toggle('on', on));  // flipAll(on): turns every flip card on this slide face up (true) or face down (false)
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },  // lays out the recap as a vertical stack filling the slide
            h('div', { class: 'row', style: { gap: '6px' } }, h('span', { class: 'small b' }, 'Every reference:'),  // a row summarising the path of every memory reference, as coloured chips joined by arrows
              h('span', { class: 'chip cpu' }, 'TLB'), '→', h('span', { class: 'chip mem' }, 'page table if the TLB misses'), '→', h('span', { class: 'chip intr' }, 'page fault if P = 0'), '→',  // chips: the TLB, the page table on a TLB miss, and a page fault when P = 0
              h('span', { class: 'chip io' }, 'disk read'), '→', h('span', { class: 'chip mem' }, 'memory cache, then main memory')),  // chips: the disk read, then the memory cache and main memory; closes the row
            h('div', { class: 'row', style: { gap: '8px' } }, h('p', { class: 'm0 muted small grow' }, 'Say each answer out loud before you flip the card. Click a card again to flip it back.'),  // instruction line: answer out loud before flipping, and click again to flip back
              h('button', { class: 'btn sm', onclick: () => flipAll(true) }, 'Flip all'), h('button', { class: 'btn sm ghost', onclick: () => flipAll(false) }, 'Hide all')),  // the Flip all and Hide all buttons; closes the row
            ctx.ui.flipcards([  // the grid of flip cards, each a question on the front and its answer on the back
              ['Why can part of a process be missing?', 'Addresses are translated at run time and pieces need not be contiguous, so only the resident set must be in memory. Payoffs: more processes in memory, and processes bigger than memory.'],  // card 1: why part of a process can be missing, and the two payoffs
              ['A page fault, in order', 'Fault interrupt → OS blocks the process → disk read → another process runs → I/O interrupt → page table updated, process Ready → it runs and retries the instruction.'],  // card 2: the steps of a page fault in order
              ['Locality and thrashing', 'References cluster in a few pages, so recent use predicts near use. Too few frames for the current cluster and the system thrashes: mostly paging, little work.'],  // card 3: locality and thrashing
              ['What is in a page table entry?', 'Frame number, P (in memory now?), M (written since loaded? then write it back before reuse), protection and sharing bits, plus use and lock bits.'],  // card 4: what a page table entry holds
              ['Two-level and inverted tables', '32 bits, 4 KB pages, 4-byte entries: a 4 MB table in 1,024 pages, mapped by a 4 KB root (split 10 | 10 | 12). Inverted: one entry per frame, found by hash + chain.'],  // card 5: the numbers of the two-level example, and how an inverted table is searched
              ['The TLB', 'A cache of recent PTEs searched associatively. Miss: read the PTE (fault if P = 0) and load it. EAT = h(t + m) + (1 − h)(t + 2m). Flush or tag with an ASID on a switch.'],  // card 6: the TLB, a miss, the effective access time formula, and flushing or ASIDs
              ['Choosing a page size', 'Small: less internal fragmentation, bigger tables. Large: better disk transfers and TLB reach, more waste. 4 KB is typical; 2 MB and 1 GB large pages stretch TLB reach.'],  // card 7: the trade-offs in choosing a page size
              ['Segments, pages and rings', 'Segment + offset, offset = page + page offset; one segment table per process, one page table per segment. Rings: data in own or outer rings, services in own or inner rings via gates.'],  // card 8: combined segmentation and paging, and the two ring rules
            ], { cols: 4, height: 212 })));  // four cards per row, each 212 pixels tall; closes the stack
        },  // ends render() for step 9
      },  // closes step 9
      {  // opens step 10, the section quiz
        title: 'Check yourself: virtual memory hardware',  // step 10 title, shown at the top of the slide
        kind: 'check',  // kind check: labelled Check Yourself; its quiz score counts toward the section's mastery
        quiz: [  // quiz: the list of questions; the guide's quiz engine shows and grades them
          { q: 'Which pair of properties of paging and segmentation makes it possible to run a process with only some of its pieces in main memory?',  // question 1 (multiple choice): which two properties of paging and segmentation make partial residence possible
            choices: ['Pages all have one fixed size, while each segment can be sized to fit the code or data it holds.', 'Every address is translated at the moment it is used, and the pieces of a process need not be contiguous.', 'The OS loads every piece when the process starts, and the hardware caches page table entries to speed up lookups.', 'Programs are compiled with absolute addresses, and main memory is divided into fixed partitions set up at boot.'],  // the four choices: fixed versus variable sizes, run-time translation with non-contiguous pieces, loading everything, absolute addresses
            answer: 1,  // answer: the second choice (counting from 0), run-time translation with non-contiguous pieces
            feedback: ['That describes how pieces are sized, not why some of them can be missing.', null, 'Loading every piece at start-up is exactly what virtual memory avoids; caching table entries only speeds translation up.', 'Absolute addresses would pin a program to one place, the opposite of what is needed; fixed partitions are an older scheme.'],  // feedback for each wrong choice, saying why it misses; null marks the right one
            why: 'Run-time translation lets any piece live in any frame and come back somewhere else, and non-contiguity makes the pieces independent. A piece that is not in memory is then just a translation that fails, which the OS can repair on demand.' },  // explanation shown after answering: a missing piece is just a translation that fails and that the OS repairs
          { type: 'order', q: 'Put the handling of a page fault in order.',  // question 2 (put in order): the steps of handling a page fault
            items: ['The process references an address in a page that is not in main memory', 'The hardware raises a page fault interrupt and the OS takes over', 'The OS blocks the process and issues a disk read for the page', 'The OS dispatches another process while the disk works', 'The disk interrupts; the OS updates the page table and makes the process Ready', 'The process is dispatched again and retries the instruction'],  // the six steps in their correct order; the quiz engine shuffles them for the student
            why: 'The fault blocks only the faulting process. The processor stays busy with another process during the slow disk read, and the original instruction is re-executed once the page is present.' },  // explanation: only the faulting process waits, and the instruction is re-executed once the page is present
          { type: 'tf', q: 'The resident set of a process is the set of pages the process will need in the near future.', answer: false,  // question 3 (true or false): is the resident set the pages a process will need soon? The answer is false
            why: 'The resident set is simply the part of the process that is in main memory right now. Which pages will be needed soon is what the OS tries to predict, using locality; the two are not the same thing.' },  // explanation: the resident set is what is in memory now; predicting future need is a separate job
          { type: 'num', q: 'A system has 32-bit virtual addresses, 4 KB pages and 4-byte page table entries. The user page table is itself stored in 4 KB pages. How many pages does it occupy?', answer: 1024, tol: 0, unit: 'pages',  // question 4 (calculate): how many 4 KB pages a 32-bit user page table fills; the answer is exactly 1,024
            why: '2<sup>32</sup> ÷ 2<sup>12</sup> = 2<sup>20</sup> entries; × 4 bytes = 4 MB = 2<sup>22</sup> bytes; ÷ 2<sup>12</sup> = 2<sup>10</sup> = 1,024 pages. A root table with 1,024 four-byte entries (exactly 4 KB) can point to all of them.' },  // explanation: the arithmetic from entries to bytes to pages, and why a 4 KB root can point to them all
          { type: 'num', q: 'A TLB lookup takes 2 ns, a main memory access takes 100 ns, and the TLB hit ratio is 95%. Ignoring page faults, what is the effective access time?', answer: 107, tol: 0.5, unit: 'ns',  // question 5 (calculate): the effective access time for a 2 ns TLB, 100 ns memory and 95% hits; 107 ns, within half a nanosecond
            why: 'EAT = h(t + m) + (1 − h)(t + 2m) = 0.95 × 102 + 0.05 × 202 = 96.9 + 10.1 = 107 ns. Without a TLB every reference would cost 2 × 100 = 200 ns.' },  // explanation: the formula worked through, compared with 200 ns without a TLB
          { type: 'multi', q: 'Which items are stored in an entry of a conventional page table (one table per process, indexed by page number)?',  // question 6 (select all): which items a conventional page table entry stores
            choices: ['The number of the frame that holds the page', 'A present bit', 'A modified bit', 'Protection bits', 'The virtual page number', 'The identifier of the process that owns the page'],  // the six candidates: frame number, P, M, protection bits, virtual page number, owning process
            answer: [0, 1, 2, 3],  // answer: the first four; the page number and owner are implied
            why: 'The page number is the index into the table, so it need not be stored, and the owner is implied by whose table it is. An inverted page table, shared by all processes, is the one that must store both the page number and the process identifier.' },  // explanation: the page number is the index and the owner is whose table it is; only an inverted table stores them
          { q: 'The OS picks a page to replace and finds that its modified (M) bit is 0. What does that tell it?',  // question 7 (multiple choice): what M = 0 tells the OS about a page it is replacing
            choices: ['The page has not been referenced at all since it was loaded, so it is the best page to replace right now.', 'The page differs from its copy on disk, so it must be written back to disk before its frame can be reused.', 'The page has not been written since it was loaded, so its frame can be reused without writing the page to disk.', 'The page is not in main memory at the moment, so its page table entry does not point to any real frame.'],  // the four choices: never referenced, differs from disk, not written since loaded, not in memory
            answer: 2,  // answer: the third choice, not written since it was loaded
            feedback: ['Whether a page was used is recorded by a separate use (referenced) bit, not by M.', 'That is the case when M = 1: the copy in memory differs from the one on disk.', null, 'That is what P = 0 means; a page being replaced is in memory.'],  // feedback for each wrong choice: the use bit, the M = 1 case, and the P = 0 case
            why: 'M = 0 means the copy on disk is still identical to the one in memory, so replacing the page costs one disk transfer (reading the new page) instead of two.' },  // explanation: M = 0 means the disk copy is current, so replacement costs one transfer instead of two
          { type: 'bucket', q: 'Does each statement describe a conventional per-process page table or an inverted page table?', buckets: ['Per-process page table', 'Inverted page table'],  // question 8 (sort into groups): which statements fit a per-process page table and which an inverted one
            items: [['One entry for every virtual page of a process', 0], ['One entry for every frame of real memory', 1], ['Its size grows with the virtual address space', 0], ['Its size is a fixed fraction of real memory', 1], ['Searched by hashing the page number and following a chain', 1], ['Indexed directly by the page number', 0], ['Each entry must record which process owns the page', 1]],  // the seven statements, each paired with its correct group (0 = per-process, 1 = inverted)
            why: 'A conventional table maps every virtual page of one process and is indexed by page number. An inverted table maps every frame, is shared by all processes, and is searched by hash, so each entry must say which page of which process it holds.' },  // explanation: what each kind of table maps, how it is searched, and why inverted entries name their process
          { type: 'match', q: 'Match each term to its meaning.',  // question 9 (match the pairs): five key terms of this section and their meanings
            pairs: [['Resident set', 'The part of a process that is in main memory now'], ['Thrashing', 'Most of the time goes to moving pages instead of running programs'], ['TLB', 'A hardware cache of recently used page table entries'], ['Root page table', 'A small, always-resident table that points to pages of the user page table'], ['Address-space identifier', 'A tag that lets TLB entries of several processes coexist']],  // the pairs: resident set, thrashing, TLB, root page table and address-space identifier
            why: 'These are the core pieces of virtual memory hardware: what is in memory, what goes wrong when too little is, how translation is sped up, and how page tables are kept small.' },  // explanation: together these are the core pieces of virtual memory hardware
          { q: 'Compared with 4 KB pages, what is the usual effect of switching to much smaller pages?',  // question 10 (multiple choice): the effect of switching from 4 KB pages to much smaller ones
            choices: ['Less internal fragmentation, but larger page tables', 'More internal fragmentation, but smaller page tables', 'A larger TLB reach', 'More efficient disk transfers'],  // the four choices: less waste with bigger tables, the reverse, more TLB reach, better disk transfers
            answer: 0,  // answer: the first choice, less internal fragmentation but larger page tables
            feedback: [null, 'This is reversed: small pages waste less in the last page but need more entries.', 'TLB reach is entries × page size, so smaller pages shrink it.', 'Disks favor large transfers; small pages mean more, smaller transfers.'],  // feedback for each wrong choice: reversed, reach shrinks with smaller pages, disks favour large transfers
            why: 'With small pages, less of each process’s last page is wasted, but a process needs more pages, so its page table grows and may itself have to be paged.' },  // explanation: small pages waste less of the last page but need more entries
          { q: 'Code running in ring 3 tries to read data that lives in ring 1. Under ring protection, what happens?',  // question 11 (multiple choice): ring 3 code reading ring 1 data under ring protection
            choices: ['It is allowed: code may always read data in a more privileged ring, but it may not write it.', 'It is allowed, but only through a gate, the controlled entry point into the inner ring.', 'It is allowed as long as the segment’s present bit is 1, meaning the data is in main memory.', 'The access is refused: data may be used only in the same or a less privileged ring.'],  // the four choices: read-only allowed, allowed through a gate, allowed if present, refused
            answer: 3,  // answer: the fourth choice, the access is refused
            feedback: ['This reverses the rule: lower ring numbers are more privileged, and outer code may not touch inner data.', 'Gates are controlled entry points for calling services, not for reading data.', 'The present bit says whether a piece is in memory; it has nothing to do with privilege.', null],  // feedback for each wrong choice: the rule reversed, gates are for calls, and P has nothing to do with privilege
            why: 'Ring 1 is more privileged than ring 3. Code may use data in its own ring or a less privileged (higher-numbered) one, and may call services in its own or a more privileged ring through a gate.' },  // explanation: data rules point outward, call rules point inward through gates
          { q: 'In a system that combines segmentation and paging, what does a segment table entry provide on the way to the data?',  // question 12 (multiple choice): what a segment table entry provides when segmentation and paging are combined
            choices: ['The frame number of every page in the segment', 'A pointer to one page table shared by all segments of all processes', 'The length of the segment and the address of that segment’s page table', 'The real address of the segment’s first byte, as in pure segmentation'],  // the four choices: every frame number, one shared page table, length plus page table address, a real base address
            answer: 2,  // answer: the third choice, the segment's length and the address of its page table
            feedback: ['Frame numbers are kept in the segment’s own page table, not in the segment table.', 'Each segment has its own page table.', null, 'The segment’s pages are scattered over frames, so there is no single base address.'],  // feedback for each wrong choice: where frame numbers really live, one page table per segment, and no single base
            why: 'The length check comes first; then the segment offset is split into a page number and a page offset, and the page number indexes the page table that the segment entry points to.' },  // explanation: the length check comes first, then the offset splits into page number and page offset
        ],  // closes the quiz list
      },  // closes step 10
    ],  // closes the steps list
    notes: `${/* notes: the section's reading notes, written in HTML, shown in the Notes panel and in the printed notes */''}
<h3>Why not all of a process need be in memory</h3>${/* notes heading 1: why not all of a process need be in memory */''}
<p>Two properties of paging and segmentation make virtual memory possible: (1) every reference is a <b>logical address translated at run time</b>, so a swapped-out process can come back into different frames; (2) a process is broken into <b>pieces that need not be contiguous</b>. So <b>not all pieces need be in main memory while it runs</b>.</p>${/* notes paragraph: the two properties that make virtual memory possible */''}
<p>The OS loads a few pieces; the part in main memory is the <b>resident set</b>. When the process references a piece that is not resident:</p>${/* notes paragraph: the resident set, and what happens when a missing piece is referenced */''}
<ol><li>The hardware raises an interrupt: a memory access fault (<b>page fault</b>).</li><li>The OS blocks the process and issues a disk read (first freeing a frame if none is free).</li><li>The OS dispatches another process while the disk works.</li><li>The disk’s I/O interrupt arrives; the OS updates the table and makes the process Ready.</li><li>When dispatched again, it re-executes the faulting instruction.</li></ol>${/* notes list: the five steps of handling a page fault */''}
<p><b>Payoffs:</b> more processes fit, so the processor is busier (if each waits for I/O 80% of the time, it idles 0.8<sup>n</sup> of the time: 64% for 2 processes, 33% for 5), and a process can be <b>larger than main memory</b>. <b>Real memory</b> = main memory; <b>virtual memory</b> = the larger memory a process perceives, backed by disk.</p>${/* notes paragraph: the two payoffs, with the I/O-wait arithmetic, and real versus virtual memory */''}
<p>Both kinds of paging use equal-size frames, invisible pages, internal fragmentation, and a page table per process plus a free-frame list; both kinds of segmentation use no fixed division, visible segments, external fragmentation, and a segment table per process plus a list of holes. The virtual-memory versions differ: not every piece is in memory while running; pieces are read in when needed; reading one in may force another out; a process may exceed main memory.</p>${/* notes paragraph: how simple and virtual-memory paging and segmentation compare */''}

<h3>Locality and thrashing</h3>${/* notes heading 2: locality and thrashing */''}
<p>A piece thrown out just before it is needed must be fetched straight back; when this happens constantly, the system spends most of its time moving pieces and little executing: <b>thrashing</b>. The <b>principle of locality</b> says that over a short period references cluster in a few pages (a loop, a function, an array), so recent behaviour predicts the near future and good guesses are possible.</p>${/* notes paragraph: what thrashing is, and how the principle of locality makes good guesses possible */''}
<p>Requirements: <b>hardware</b> support for paging and/or segmentation, and <b>OS software</b> to move pieces.</p>${/* notes paragraph: the two requirements, hardware support and OS software */''}

<h3>Page table entries and translation</h3>${/* notes heading 3: page table entries and translation */''}
<p>Each process has its own page table (indexed by page number, so the page number and owner are not stored). A <b>page table entry (PTE)</b> holds the <b>frame number</b> plus control bits: <b>P</b> (present: the page is in main memory), <b>M</b> (modified since loaded; if M = 0 at replacement, the page need not be written out), and bits for protection and sharing (often also a use bit and a lock bit). Translation: the <b>page table pointer register</b> holds the start of the running process’s table; the page number indexes it; frame number + unchanged offset = real address.</p>${/* notes paragraph: what a page table entry holds and how the hardware translates an address */''}
<p><b>Example</b> (1 KB pages, table at 30,720, 4-byte entries): virtual address 3,500 = page 3, offset 428. The entry is at 30,720 + 4 × 3 = 30,732. If page 3 is in frame 25, the real address is 25 × 1,024 + 428 = 26,028. A write sets M = 1; writing a read-only page is a protection fault.</p>${/* notes paragraph: a worked translation example with 1 KB pages, including the M bit and a protection fault */''}

<h3>Two-level page tables</h3>${/* notes heading 4: two-level page tables */''}
<p>A page table needs an entry per virtual page. With 32-bit addresses and 4 KB pages there are 2<sup>20</sup> pages; with 4-byte entries the user page table is <b>4 MB</b>, which fills <b>2<sup>10</sup> = 1,024 pages</b>. So page tables are kept in virtual memory too. A <b>root page table</b> (page directory) with 2<sup>10</sup> entries (exactly 4 KB) points to those pages and always stays in memory. The address splits <b>10 | 10 | 12</b>: root index, index inside that page of the user table, offset. Example: 0x00403A7C → root entry 1, table entry 3, offset 2,684; if that page is in frame 5,021 the real address is 5,021 × 4,096 + 2,684 = 20,568,700. A fault can occur at either level: if the root entry’s P = 0, that page of the page table must be read in first. Without a TLB a reference costs 3 memory accesses. 64-bit machines use more levels (x86-64: 4, or 5).</p>${/* notes paragraph: why tables get too big, the root table, the 10 | 10 | 12 split, a worked example and faults at either level */''}

<h3>Inverted page tables</h3>${/* notes heading 5: inverted page tables */''}
<p>An <b>inverted page table</b> has one entry per <b>frame</b> of real memory, so its size is a fixed fraction of real memory whatever the number or size of processes. The page number is <b>hashed</b> to find where to start; entries with the same hash are linked by a <b>chain pointer</b>. Each entry holds the <b>page number, process ID, control bits</b> (valid, referenced, modified, protection, locking) and the <b>chain pointer</b> (next entry, or empty). A match on page number <i>and</i> process ID gives the frame (the entry’s index); the end of the chain means a page fault. Used on PowerPC, UltraSPARC and IA-64.</p>${/* notes paragraph: one entry per frame, hashing and chains, what each entry holds, and where it was used */''}

<h3>Translation lookaside buffer (TLB)</h3>${/* notes heading 6: the translation lookaside buffer */''}
<p>Without help, each reference needs two memory accesses (PTE, then data). The <b>TLB</b> is a small, fast cache of recently used PTEs, searched by <b>associative lookup</b> (all entries compared with the page number at once). <b>Hit:</b> the frame number gives the real address. <b>Miss:</b> read the PTE; if P = 1, form the address and load the PTE into the TLB; if P = 0, page fault: the OS reads the page in (freeing a frame if needed), updates the table, and the instruction is retried. The real address then goes to the memory cache and main memory. Ignoring faults, with hit ratio h, TLB time t and memory time m: <b>EAT = h(t + m) + (1 − h)(t + 2m)</b>. Example: h = 0.95, t = 2, m = 100 ns: 0.95 × 102 + 0.05 × 202 = 107 ns (no TLB: 200). On a process switch the TLB must be <b>flushed</b>, or its entries tagged with an <b>address-space identifier (ASID)</b>.</p>${/* notes paragraph: hits, misses, faults, the effective access time with a worked example, and flushing or ASIDs */''}

<h3>Page size</h3>${/* notes heading 7: page size */''}
<ul><li><b>Smaller pages:</b> less internal fragmentation, but more pages, so larger page tables, parts of which may be paged out (one reference can then fault twice).</li><li><b>Larger pages:</b> disks transfer large blocks more efficiently, and the TLB covers more memory.</li><li><b>Fault rate vs page size</b> (fixed memory): low for very small pages; rising as each page holds more data far from recent references; falling again as a page nears the process size (zero if one page holds it all).</li><li><b>Fault rate vs frames:</b> falls as more frames are allocated.</li></ul>${/* notes list: the trade-offs of smaller and larger pages, and how the fault rate depends on page size and frames */''}
<p>4 KB is most common. <b>Large pages</b> (x86-64: 2 MB, 1 GB) extend <b>TLB reach</b> = entries × page size: 64 entries × 4 KB = 256 KB, but 64 × 2 MB = 128 MB. Sizes range from 512 bytes (VAX) to 4 KB–16 MB choices (MIPS R4000). Scattered objects and many threads reduce locality.</p>${/* notes paragraph: common page sizes, large pages, and TLB reach worked out */''}

<h3>Segmentation in virtual memory</h3>${/* notes heading 8: segmentation in virtual memory */''}
<p>Segments can <b>grow</b> (extended or moved by the OS), modules can be <b>recompiled independently</b>, and <b>sharing and protection</b> are natural. A segment table entry holds the segment’s <b>base</b>, <b>length</b>, <b>P</b> and <b>M</b> bits and protection/sharing bits. Real address = base + offset, after checking offset &lt; length.</p>${/* notes paragraph: what segments offer and what a segment table entry holds */''}

<h3>Combined segmentation and paging</h3>${/* notes heading 9: combined segmentation and paging */''}
<p>The programmer sees segments, each cut into pages. Logical address = segment number + offset, and the offset is read as page number + page offset. Each process has one segment table; each segment has its own page table; the segment entry holds the length and points to that page table. Example (1 KB pages): segment 1, offset 1,500 = page 1, offset 476; page 1 in frame 21 gives 21 × 1,024 + 476 = 21,980.</p>${/* notes paragraph: how the address is split and a worked example */''}

<h3>Protection and sharing</h3>${/* notes heading 10: protection and sharing */''}
<p>Length checks stop a program running past a segment; a segment listed in several processes’ tables is <b>shared</b>. <b>Ring protection</b>: ring 0 (most privileged, the kernel) outward to user rings. A program may access <b>data</b> only in its own or a <b>less</b> privileged ring, and may <b>call services</b> only in its own or a <b>more</b> privileged ring, through controlled entry points (gates). x86 has 4 rings; most systems use only rings 0 and 3.</p>${/* notes paragraph: length checks, sharing segments, and the two ring rules */''}
`,  // end of the notes text
  });  // ends the object passed to Guide.section and the call itself
})();  // ends the wrapper function and runs it straight away
