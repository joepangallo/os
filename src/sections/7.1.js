// Comment key: a line inside backtick text ends with ${/* comment */''}, an empty-string slot that holds a comment without changing the text on screen (full note at the top of the page).
/* Section 7.1 Memory Management Requirements
   Original teaching material. Helpers live in this IIFE so nothing leaks into the global scope. */
(() => {  // wraps the whole section in a function that runs once, right away, so its helper names stay private to this file
  /* One toy machine is used by several steps so the numbers stay consistent:
     10,000 bytes of memory, the OS in 0-1999, then four 2,000-byte regions. */
  const MEM = 10000;  // MEM: the size of the toy machine's main memory, 10,000 bytes; several steps share it so the numbers match
  const REG = 2000;  // REG: the size of each region of the toy machine (2,000 bytes): the OS's part and each process's part

  /* mtext(s, x, y, lines, attrs, lh): an SVG <text> with one <tspan> per line. */
  function mtext(s, x, y, lines, attrs = {}, lh = 17) {  // mtext(...): builds a multi-line drawing label; s is the SVG builder, lines one string or a list, lh the gap between lines
    const t = s('text', Object.assign({ x, y }, attrs));  // t is the SVG text element (SVG = the browser's drawing format) placed at x, y, with any extra settings in attrs merged in
    [].concat(lines).forEach((ln, i) => t.append(s('tspan', { x, dy: i === 0 ? 0 : lh }, ln)));  // adds one tspan (a piece of text) per line; each later line starts back at x and sits lh pixels below the one before
    return t;  // hands the finished label back to the caller, which puts it in a drawing
  }  // ends mtext

  /* listing(ctx, rows, o): a code listing with a plain-language comment on every line. rows are [code, comment].
     Wide screens put each comment at the end of its line; on a small screen each comment sits on its own line
     just above the code it explains, and long lines wrap instead of being cut off. */
  function listing(ctx, rows, o = {}) {  // listing(ctx, rows, o): builds a shown code box from [code, comment] pairs; o can add options such as the font size
    const w = Math.max(...rows.map((r) => r[0].length));  // w is the length of the longest code line, so every comment can start in the same column
    const src = ctx.narrow ? rows.map(([c, m]) => `// ${m}\n${c}`).join('\n') : rows.map(([c, m]) => c.padEnd(w + 2) + '// ' + m).join('\n');  // small screen: each comment goes on its own line above its code; otherwise each code line is padded to width w and its comment follows
    return ctx.ui.code(src, Object.assign({ lang: 'c', cls: ctx.narrow ? 'wrap' : '' }, o));  // hands the text to the guide's code-box helper, coloured as C; the wrap class lets long lines wrap on a small screen
  }  // ends listing

  /* fmtN(n): a whole number with thousands separators. */
  const fmtN = (n) => Math.round(n).toLocaleString('en-US');  // fmtN(n): rounds n and writes it with commas (10000 becomes "10,000") for the labels in the drawings

  Guide.section({  // registers this section with the guide; everything inside the braces describes it
    id: '7.1',  // the section number, used in links, the contents list and saved progress
    title: 'Memory Management Requirements',  // the section's full title, shown above each of its slides
    short: 'Requirements',  // a short name for tight spaces such as the contents list
    summary: 'Five jobs every memory manager must do: relocation, protection, sharing, logical and physical organization.',  // one-sentence summary of the section that names all five requirements
    objectives: [  // objectives: what a student should be able to do after this section
      'Explain what memory management is, why multiprogramming needs it, and why it decides how busy the processor can be.',  // objective 1: what memory management is and how it decides how busy the processor stays
      'Describe relocation and trace how a relative address is translated to the right physical address after a process moves.',  // objective 2: relocation, and tracing a relative address to its physical address after the process moves
      'Explain why every memory reference must be checked at run time, and why the processor hardware, not the OS, must do the checking.',  // objective 3: why every reference is checked while the program runs, and why hardware must do it
      'Explain how controlled sharing saves memory without breaking protection, and why memory should match a program built from modules.',  // objective 4: controlled sharing, and memory that matches a program built from modules
      'Describe the two levels of storage and why moving information between them is the OS’s job rather than the programmer’s (overlays).',  // objective 5: the two levels of storage and why the OS, not the programmer, moves data between them
    ],  // ends the objectives list
    terms: [  // terms: this section's glossary entries, each a [term, definition] pair; marked words in the slides show these definitions
      ['Memory management', 'The operating system’s job of dividing the user part of main memory among processes as they arrive and leave, and of keeping track of which piece belongs to which process.'],  // glossary entry: defines memory management as dividing the user part of memory among processes
      ['Relocation', 'Making a program run correctly wherever it is placed in main memory, including a different place after it is swapped out and back in, by translating its memory references to the right physical addresses.'],  // glossary entry: defines relocation, a program running correctly wherever it is placed or moved
      ['Relative address', 'A logical address written as a distance from a known point, usually the first byte of the program, so it stays the same wherever the program is placed in memory.'],  // glossary entry: defines a relative address as a distance from the program's first byte
      ['Address translation', 'Turning an address used by a program into the physical address that is sent to memory. With run-time translation the processor hardware does it on every memory reference.'],  // glossary entry: defines address translation, from the program's address to the one sent to memory
      ['Memory reference', 'Any access a running program makes to memory: fetching an instruction, jumping to a branch target, reading or writing data, or pushing and popping the stack.'],  // glossary entry: defines a memory reference and lists its kinds (fetch, branch, data, stack)
      ['Entry point', 'The address of the first instruction a program runs when it starts.'],  // glossary entry: defines the entry point, the first instruction a program runs
      ['Branch instruction (jump)', 'An instruction that tells the processor to continue at another address, the branch target, instead of the next instruction in line.'],  // glossary entry: defines a branch instruction (jump) and its branch target
      ['Memory protection (protection)', 'The requirement that a process cannot read or write memory belonging to another process or to the OS unless it has been given permission.'],  // glossary entry: defines memory protection between processes and the OS
      ['Bounds register', 'A processor register that holds the address where the running process’s memory region ends. The hardware compares each translated address with it and traps to the OS if the address is at or beyond it. (Some processors store the region’s length instead, in a limit register.)'],  // glossary entry: defines the bounds register that marks where a process's region ends
      ['Controlled sharing (sharing)', 'Letting several processes use the same region of main memory on purpose, such as one copy of a program’s code or a data area they cooperate through, while protection still blocks every access that was not granted.'],  // glossary entry: defines controlled sharing, deliberate sharing while protection still holds
      ['Shared code', 'One copy of a program’s instructions in main memory that several processes run at the same time. It is never changed while in use, and each process keeps its own data separately.'],  // glossary entry: defines shared code, one unchanging copy of instructions run by several processes
      ['Access rights', 'The permissions attached to a piece of memory, such as read-only, read-write or execute-only, which the hardware enforces on every access.'],  // glossary entry: defines access rights such as read-only, read-write and execute-only
      ['Logical organization', 'The requirement that memory management fit the way programs are really built: as separate modules that can be compiled on their own, given their own access rights and shared.'],  // glossary entry: defines logical organization, memory that fits a program built from modules
      ['Segmentation', 'Dividing a program and its data into variable-length pieces called segments, usually one per logical part (code, a library, a data table, the stack); an address names a segment and an offset inside it.'],  // glossary entry: defines segmentation, variable-length pieces addressed by segment plus offset
      ['Physical organization', 'The requirement that the OS, not the programmer, manage the two levels of storage: moving programs and data between small, fast, volatile main memory and large, slow, permanent secondary memory.'],  // glossary entry: defines physical organization, the OS managing main and secondary memory
      ['Overlaying (overlay)', 'An old, programmer-managed way to run a program larger than the memory available: modules that are never needed at the same moment take turns in the same region of memory, and the program itself must load each one before calling it. (Later tools could insert those loads, but the programmer still had to plan which modules share the region.)'],  // glossary entry: defines overlaying, the old programmer-managed way to run a program too big for memory
    ],  // ends the glossary terms
    css: ` /* css: style rules used only by this section's slides, written as text that the guide adds to the page */
      .sec-7-1 .hot { cursor: pointer; } /* .hot: the clickable module boxes in step 5 show a pointing-hand cursor */
      .sec-7-1 .tx-ok { fill: var(--ok); } /* .tx-ok: drawing text in success green */
      .sec-7-1 .tx-bad { fill: var(--bad); } /* .tx-bad: drawing text in error red, for wrong addresses and traps */
      .sec-7-1 .tx-mem { fill: var(--mem); } /* .tx-mem: drawing text in memory green, for data blocks and loaded modules */
      .sec-7-1 .tx-os { fill: var(--os); } /* .tx-os: drawing text in operating-system purple */
      .sec-7-1 .tx-proc { fill: var(--proc); } /* .tx-proc: drawing text in process teal */
      .sec-7-1 .tx-cpu { fill: var(--cpu); } /* .tx-cpu: drawing text in processor blue, used for the + sign of the adder in step 3 */
      .sec-7-1 .tx-io { fill: var(--io); } /* .tx-io: drawing text in input/output orange, for the clipboard and the modules on disk */
      .sec-7-1 .tx-acc { fill: var(--accent); } /* .tx-acc: drawing text in the accent indigo, for physical addresses */
      .sec-7-1 .c-ok { color: var(--ok); } /* .c-ok: ordinary page text in success green, for words such as "Correct" and "Allowed" */
      .sec-7-1 .c-bad { color: var(--bad); } /* .c-bad: ordinary page text in error red, for words such as "Trap" and "Wrong place" */
      .sec-7-1 .c-mem { color: var(--mem); } /* .c-mem: ordinary page text in memory green */
      .sec-7-1 .c-proc { color: var(--proc); } /* .c-proc: ordinary page text in process teal */
      .sec-7-1 .c-os { color: var(--os); } /* .c-os: ordinary page text in operating-system purple */
      .sec-7-1 .c-acc { color: var(--accent); } /* .c-acc: ordinary page text in the accent indigo, used for the requirement names */
      .sec-7-1 pre.code.wrap .ln { white-space: pre-wrap; padding-left: 3.4em; text-indent: -3.4em; } /* wrapping code box (small screen): long lines wrap, and the wrapped part hangs indented past the line number */
      .sec-7-1 .btn.ok-b { border-color: var(--ok); background: var(--ok-bg); color: var(--ok); } /* .ok-b: a step 7 answer button outlined and tinted green, marking the right requirement */
      .sec-7-1 .btn.bad-b { border-color: var(--bad); background: var(--bad-bg); color: var(--bad); } /* .bad-b: a step 7 answer button tinted red, marking a wrong pick */
    `,  // end of the section's style rules
    steps: [  // steps: the slides of this section, in order
      /* ---------------- 1. Big picture: from one program to many ---------------- */
      {  // opens step 1, the big picture
        title: 'Many processes, one memory: who decides where they live?',  // step 1 title, shown as the slide heading
        kind: 'story',  // kind 'story': labels the slide "Big Picture" and puts it on the core path
        render(el, ctx) {  // render(el, ctx): draws step 1 into the box el when the slide opens; ctx is the guide's toolbox
          const { h, s } = ctx;  // takes the HTML builder h and the SVG builder s out of the toolbox
          const SIZES = [1400, 1000, 1700, 900, 1300, 1100];   // bytes taken by P1..P6 in the 8,000-byte user area
          let mode = 'multi', n = 4, wait = 80;  // mode: uniprogramming or multiprogramming; n: processes in memory; wait: percent of time each one waits for I/O
          const VW = ctx.narrow ? 330 : 640;              // a small screen gets a slimmer drawing so its labels stay readable
          const svg = s('svg', { viewBox: `0 0 ${VW} ${ctx.narrow ? 124 : 112}`, width: '100%' });  // the memory drawing; viewBox sets its coordinate space, a little taller on a small screen for the two-line caption
          const big = h('div', { class: 'big' });  // big: the large "% busy" number
          const meter = h('div', { class: 'meter', style: { height: '12px' } }, h('i'));  // meter: a bar that fills to show how busy the processor is; the inner i element is the coloured fill
          const say = h('p', { class: 'small m0' });  // say: the sentence under the meter that explains the number
          function draw() {  // draw(): redraws the memory bar, the number, the meter and the sentence whenever a control changes
            const k = mode === 'uni' ? 1 : n;  // k: how many programs are in memory (always 1 with uniprogramming)
            const x0 = ctx.narrow ? 8 : 20, W = VW - 2 * x0, sc = W / MEM;  // x0 is the left margin, W the width of the bar, and sc the pixels per byte
            const kids = [  // kids collects every shape of the drawing, starting with the parts that never change
              s('rect', { x: x0, y: 30, width: REG * sc, height: 52, rx: 6, class: 's-os', 'stroke-width': 2 }),  // the OS block: the first 2,000 bytes of memory, in purple
              s('text', { x: x0 + REG * sc / 2, y: 61, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 15, class: 'tx-os' }, 'OS'),  // the "OS" label centred in that block
              s('text', { x: x0, y: 20, 'font-size': 13, class: 's-sub' }, '0'),  // the "0" address label above the left end of the bar
              s('text', { x: x0 + W, y: 20, 'text-anchor': 'end', 'font-size': 13, class: 's-sub' }, fmtN(MEM) + ' bytes'),  // the total size label above the right end, "10,000 bytes"
              s('text', { x: x0 + REG * sc + 4, y: 20, 'font-size': 13, class: 's-sub' }, 'user part →'),  // a "user part" label just after the OS block, pointing right
            ];  // closes the list of shapes that never change
            let x = x0 + REG * sc;  // x: where the next process block starts, just after the OS block
            for (let i = 0; i < k; i++) {  // one block per program in memory
              const w = (mode === 'uni' ? 2600 : SIZES[i]) * sc;  // w: the block's width in pixels; with one program it takes 2,600 bytes, otherwise process i takes its size from SIZES
              kids.push(s('rect', { x: x + 1, y: 30, width: w - 2, height: 52, rx: 6, class: 's-proc', 'stroke-width': 2 }),  // the teal process block, trimmed by 1 pixel at each side so neighbouring blocks show a gap
                s('text', { x: x + w / 2, y: 61, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 14, class: 'tx-proc' }, mode === 'uni' ? (ctx.narrow ? 'program' : 'your program') : 'P' + (i + 1)));  // its label: "P1" to "P6", or "your program" ("program" on a small screen) with uniprogramming
              x += w;  // moves x past this block
            }  // ends the loop over programs
            const free = x0 + W - x;  // free: the pixels left at the right end of the bar after the last block
            kids.push(s('rect', { x: x + 1, y: 30, width: free - 2, height: 52, rx: 6, class: 's-panel', 'stroke-width': 1.5, 'stroke-dasharray': '5 4' }));  // the free space: a dashed outline filling the rest of the bar
            if (free > (ctx.narrow ? 40 : 70)) kids.push(s('text', { x: x + free / 2, y: 61, 'text-anchor': 'middle', 'font-size': 13.5, class: 's-sub' }, mode === 'uni' ? 'unused' : 'free'));  // labels it "free" ("unused" with one program) only when it is wide enough to hold the word
            const cap = mode === 'uni' ? ['Two parts: one for the OS,', 'one for the single program running now.']  // cap: the caption under the bar; this is the uniprogramming wording
              : [`The user part is divided among ${k} process${k > 1 ? 'es' : ''},`, 'and the split changes as they come and go.'];  // multiprogramming wording: says how many processes share the user part, adding "es" for more than one
            kids.push(mtext(s, VW / 2, 104, ctx.narrow ? cap : cap.join(' '), { 'text-anchor': 'middle', 'font-size': 13.5, class: 's-sub' }, 17));  // draws the caption centred under the bar: two lines on a small screen, one joined line otherwise
            svg.replaceChildren(...kids);  // swaps everything in the drawing for the new shapes in one go
            const w = wait / 100, busy = 1 - Math.pow(w, k), idle = Math.round(Math.pow(w, k) * 100);  // w: the wait as a fraction; busy = 1 - w to the power k (the chance not all k wait at once); idle: percent of time all wait
            big.innerHTML = Math.round(busy * 100) + '<span class="small muted" style="font-weight:600"> % busy</span>';  // writes the busy percentage into the big number, followed by a small grey "% busy"
            meter.firstChild.style.width = (busy * 100).toFixed(1) + '%';  // sets the meter's coloured fill to the busy percentage
            say.innerHTML = k === 1  // say: the explanation, chosen by whether one program or several are in memory
              ? `With one program, the processor sits idle whenever that program waits for I/O: <b>${idle}%</b> of the time. Nothing else is in memory to run.`  // one program: the processor idles whenever that program waits for I/O
              : `The processor idles only when <b>all ${k}</b> processes are waiting for I/O at once: ${ctx.util.fmt(w, 2)}<sup>${k}</sup> = ${idle}% of the time. Every extra ready process in memory makes that rarer.`;  // several programs: it idles only when all k wait at once, and the sentence shows w to the power k worked out
          }  // ends draw
          const sN = ctx.ui.slider({ label: 'Processes in memory', min: 1, max: 6, value: n, onInput: (v) => { n = v; draw(); } });  // sN: slider for how many processes are in memory, 1 to 6; moving it stores n and redraws
          const sW = ctx.ui.slider({ label: 'Each waits for I/O', min: 50, max: 90, step: 5, value: wait, format: (v) => v + '%', onInput: (v) => { wait = v; draw(); } });  // sW: slider for the percent of time each process waits for I/O, 50 to 90 in steps of 5, shown with a % sign
          const seg = ctx.ui.seg([{ value: 'uni', label: 'Uniprogramming' }, { value: 'multi', label: 'Multiprogramming' }], mode, (v) => {  // seg: a two-button switch between uniprogramming and multiprogramming, starting at mode
            mode = v; sN.input.disabled = v === 'uni'; sN.style.opacity = v === 'uni' ? '.45' : '1'; draw();  // on a change: stores the mode; with uniprogramming the process slider is switched off and faded (only one program fits); redraws
          });  // ends the switch's change handler and the switch
          draw();  // draws the first picture as soon as the slide opens
          const REQ = [  // REQ: the five requirements for the strip at the bottom, each with the question it answers
            ['Relocation', 'It may be put anywhere and moved later. Do its addresses still work?'],  // strip card 1: relocation, whether addresses still work after the program is placed anywhere or moved
            ['Protection', 'What stops it from touching memory that is not its own?'],  // strip card 2: protection, what keeps a process out of memory that is not its own
            ['Sharing', 'How can processes share memory on purpose, safely?'],  // strip card 3: sharing memory on purpose, safely
            ['Logical organization', 'Can memory follow the modules a program is built from?'],  // strip card 4: logical organization, memory that follows a program's modules
            ['Physical organization', 'Who moves things between memory and disk?'],  // strip card 5: physical organization, who moves things between memory and disk
          ];  // closes REQ
          const strip = h('div', { style: { display: 'grid', gridTemplateColumns: ctx.narrow ? 'repeat(2, minmax(0, 1fr))' : 'repeat(5, minmax(0, 1fr))', gap: '10px' } },  // strip: a grid of small cards, five across, or two across on a small screen
            ...REQ.map(([t, q], i) => h('div', { class: 'card tight', style: { padding: '8px 10px' } },  // one compact card per requirement
              h('div', { class: 'b c-acc', style: { fontSize: '15px' } }, (i + 1) + '. ' + t), h('div', { class: 'xs muted', style: { marginTop: '2px', lineHeight: '1.35' } }, q))));  // each card: the numbered name in accent colour, with its question in small grey text below
          el.append(h('div', { class: 'stack fill', style: { gap: '12px' } },  // puts the whole slide together in a column that fills the step
            h('div', { class: 'split l grow', style: { height: 'auto' } },  // top part: two columns, the text on the left and the memory model on the right
              h('div', { class: 'stack', style: { gap: '10px' } },  // left column: paragraphs and callouts stacked with 10px gaps
                h('p', { class: 'lead m0', html: 'With <span class="t">uniprogramming</span>, memory has just two parts: one for the OS, one for the program running now.' }),  // opening sentence: with uniprogramming, memory has just two parts
                h('p', { class: 'm0', html: 'With <span class="t">multiprogramming</span>, the user part is split among many processes, and the split keeps changing as they start, finish and get <span class="t" data-t="swapping">swapped</span> out. Doing that dividing on the fly is <span class="t">memory management</span>, a job of the OS.' }),  // paragraph: multiprogramming splits the user part among changing processes, and that is memory management; marked words open glossary entries
                h('div', { class: 'callout why m0', 'data-label': 'Why it matters', html: 'A process waiting for I/O cannot use the processor, so the processor stays busy only if memory holds <b>enough ready processes</b>. Try the sliders.' }),  // "Why it matters" callout: the processor stays busy only if memory holds enough ready processes
                h('div', { class: 'callout analogy m0', 'data-label': 'Analogy', html: 'A hotel desk assigns rooms as guests come and go, and makes sure no key opens someone else’s room.' })),  // analogy callout: a hotel desk that assigns rooms and keys; closes the left column
              h('div', { class: 'card white stack', style: { gap: '10px', padding: '12px 14px' } },  // right column: a white card holding the memory model
                h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'Main memory'), seg),  // card header: the "Main memory" heading on the left, the uni/multi switch on the right
                svg, sN, sW,  // the drawing and the two sliders
                h('div', { class: 'row nw', style: { gap: '14px', alignItems: 'center' } }, big, h('div', { class: 'grow' }, meter)),  // a row that never wraps: the big busy number beside the meter, which takes the remaining width
                say,  // the explanation sentence
                h('p', { class: 'xs muted m0' }, 'Rough model: each process waits for I/O independently of the others. Real workloads differ, but the trend holds.'))),  // fine print: the busy figure assumes each process waits independently; closes the card and the two columns
            h('div', { class: 'stack gap-s', style: { flex: 'none' } }, h('div', { class: 'small b' }, 'Any memory manager must meet five requirements. This section takes them one at a time:'), strip)));  // bottom part: a lead-in line above the strip of five requirement cards; closes the slide layout
        },  // ends render for step 1
      },  // ends step 1
      /* ---------------- 2. Relocation: a process image that moves ---------------- */
      {  // opens step 2, relocation
        title: 'Relocation: the program moves, its addresses must follow',  // step 2 title
        kind: 'explore',  // kind 'explore': labels the slide "Explore", a hands-on slide
        core: true,  // core: true puts this step on the core path, the shorter route through the course
        render(el, ctx) {  // render(el, ctx): draws step 2 when the slide opens
          const { h, s } = ctx;  // takes the HTML builder h and the SVG builder s out of the toolbox
          const FIRST = 2000;                            // where P was loaded the first time
          const REFS = [  // REFS: P's four memory references: button text, table name, where the instruction sits (from) and the relative address it reaches (rel)
            { key: 'entry', btn: 'Start P', name: 'Entry point', from: null, rel: 200 },  // the entry point: no instruction makes it (from is null); starting P goes to relative 200
            { key: 'jump', btn: 'Branch at 400', name: 'Branch target', from: 400, rel: 920 },  // a branch instruction at relative 400 that jumps to relative 920, the start of a loop
            { key: 'load', btn: 'Load at 520', name: 'Data item x', from: 520, rel: 1350 },  // a load instruction at relative 520 that reads data item x at relative 1350
            { key: 'push', btn: 'Push at 640', name: 'Top of stack', from: 640, rel: 1840 },  // a push at relative 640 that writes at the top of the stack, relative 1840
          ];  // closes REFS
          let where, mode = 'runtime', last = null;  // where: home (at 2000), disk or moved (at 6000); mode: run-time or fixed addresses; last: the reference just run
          const baseOf = () => (where === 'home' ? FIRST : where === 'moved' ? 6000 : null);  // baseOf(): where P starts now: 2000 at home, 6000 after the move, null while it is on disk
          const physOf = (rel) => (mode === 'runtime' ? baseOf() + rel : FIRST + rel);  // physOf(rel): the physical address really used; run-time translation adds the current base, fixed addresses always add 2000
          const owner = (a) => (a < 2000 ? 'the OS' : a < 4000 ? (where === 'home' ? 'P' : 'S') : a < 6000 ? 'Q' : a < 8000 ? (where === 'moved' ? 'P' : 'free space') : 'R');  // owner(a): who holds physical address a now: the OS, P or S, Q, P or free space, or R, depending on where P is
          const oy = (a) => 30 + a * 0.042;              // overview bar: physical address → y
          const zy = (r) => (r < 200 ? 40 + r * 0.25 : 90 + (r - 200) * 0.2);   // zoomed image: relative address → y
          /* drawing geometry; a small screen gets a slimmer layout so its labels stay readable */
          const G = ctx.narrow  // G: drawing sizes and label wording, one set for a small screen and one for a wide screen
            ? { vw: 372, bx: 44, bw: 64, zx: 160, zw: 170, fs: 12, a0: 22, a1: 16, pcb: 'Control information', tgt: '920: loop start', entry: '← entry', ex: 108 }  // small-screen set: canvas width, bar and zoom positions and widths, font size, arrow offsets, and shorter labels
            : { vw: 620, bx: 62, bw: 88, zx: 300, zw: 220, fs: 13, a0: 36, a1: 30, pcb: 'Process control information', tgt: '920: loop starts here', entry: '← entry point', ex: 150 };  // wide-screen set: a wider canvas, larger boxes and the longer label wording
          const svg = s('svg', { viewBox: `0 0 ${G.vw} 470`, width: '100%' });  // the drawing, 470 units tall
          const tbl = h('table', { class: 'tbl compact' });  // tbl: the table of the four references and where each one lands
          const narr = h('div', { class: 'card tight small', style: { minHeight: '96px', lineHeight: '1.45' } });  // narr: the narration box under the table that explains each action
          const instrText = (r) => {  // instrText(r): the instruction text shown inside the zoomed process image for reference r
            const p = (x) => (mode === 'runtime' ? x : FIRST + x);  // p(x): the address as written in P's code: still relative with run-time translation, already fixed (2000 + x) otherwise
            return r.key === 'jump' ? `jump ${p(920)}` : r.key === 'load' ? `load ${p(1350)}` : `push (SP ${p(1840)})`;  // the jump, load or push text with that address; the push names the stack pointer (SP)
          };  // ends instrText
          function draw() {  // draw(): redraws the memory overview, the zoomed image, the arrow for the last reference, the table and the buttons
            const base = baseOf();  // base: P's current start address, or null while P is on disk
            const kids = [];  // kids collects the shapes of the drawing
            const regs = [['OS', 0, 's-os'], [where === 'home' ? 'P' : 'S', 2000, where === 'home' ? 's-proc' : 's-panel'], ['Q', 4000, 's-panel'],  // regs: the five 2,000-byte regions as [name, start, style]: the OS, then P or S, then Q
              [where === 'moved' ? 'P' : 'free', 6000, where === 'moved' ? 's-proc' : 's-panel'], ['R', 8000, 's-panel']];  // then P or free space at 6000, and R at 8000
            kids.push(s('text', { x: G.bx + G.bw / 2, y: 18, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 14 }, 'Main memory'));  // "Main memory" heading over the overview bar
            regs.forEach(([nm, a, cls]) => {  // for each region of the overview
              kids.push(s('rect', { x: G.bx, y: oy(a) + 1, width: G.bw, height: REG * 0.042 - 2, rx: 5, class: cls, 'stroke-width': 1.5, 'stroke-dasharray': nm === 'free' ? '4 3' : null }),  // its rectangle, placed by oy; free space gets a dashed outline
                s('text', { x: G.bx + G.bw * 0.34, y: oy(a) + 47, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': nm === 'free' ? 13 : 16, class: nm === 'OS' ? 'tx-os' : nm === 'P' ? 'tx-proc' : nm === 'free' ? 's-sub' : '' }, nm));  // its name, a little left of centre, coloured for the OS, for P, or grey for free space
            });  // ends the loop over regions
            for (let a = 0; a <= MEM; a += 2000) kids.push(s('text', { x: G.bx - 6, y: oy(a) + 5, 'text-anchor': 'end', 'font-size': 13, class: 's-monot s-sub' }, String(a)));  // address marks 0, 2000 ... 10000 beside the overview bar, in a fixed-width font
            /* the zoomed process image */
            const { zx, zw } = G;  // zx, zw: the left edge and width of the zoomed image, taken from G
            const parts = [[0, 200, 's-os', G.pcb], [200, 1200, 's-proc', 'Program'], [1200, 1600, 's-mem', 'Data'], [1600, 2000, 's-accent', 'Stack']];  // parts: the four parts of P's image as [start, end, style, name]: control information, program, data, stack
            if (base != null) {  // only while P is in memory
              kids.push(s('path', { d: `M${G.bx + G.bw},${oy(base)} L${zx},40 M${G.bx + G.bw},${oy(base + REG)} L${zx},450`, class: 's-muted', 'stroke-dasharray': '4 4' }));  // two dashed guide lines from the top and bottom of P's region in the overview to the top and bottom of the zoomed image
            }  // ends the guide-line case
            const g = s('g', { opacity: base == null ? 0.35 : 1 });  // g: a group holding the zoomed image; it is faded to 35% while P is on disk
            parts.forEach(([a, b, cls, nm]) => {  // for each of the four parts of the image
              g.append(s('rect', { x: zx, y: zy(a), width: zw, height: zy(b) - zy(a), class: cls, 'stroke-width': 1.5 }),  // its rectangle, from zy(start) down to zy(end), in the part's colour
                s('text', { x: zx + 10, y: zy(a) + (a === 0 ? 30 : 18), 'font-size': 13.5, 'font-weight': 700 }, nm));  // its name near the top of the part, a little lower in the short first part
            });  // ends the loop over parts
            [0, 200, 1200, 1600, 2000].forEach((r) => {  // the boundaries of the image's parts: relative 0, 200, 1200, 1600 and 2000
              g.append(s('text', { x: zx - 6, y: zy(r) + 5, 'text-anchor': 'end', 'font-size': 13, class: 's-monot' }, String(r)));  // the relative address, to the left of the image
              if (base != null) g.append(s('text', { x: zx + zw + 6, y: zy(r) + 5, 'font-size': 13, class: 's-monot tx-acc' }, String(base + r)));  // and, while P is in memory, the matching physical address (base + relative) to the right, in indigo
            });  // ends the loop over boundaries
            REFS.filter((r) => r.from != null).forEach((r) => g.append(s('text', { x: zx + 8, y: zy(r.from) + 5, 'font-size': G.fs, class: 's-monot' }, `${r.from}: ${instrText(r)}`)));  // the three instructions (branch, load, push) written inside the image at their own relative addresses
            g.append(s('text', { x: zx + 8, y: zy(920) + 5, 'font-size': G.fs, class: 's-monot s-sub' }, G.tgt),  // grey labels for what the references reach: the loop start at 920
              s('text', { x: zx + 8, y: zy(1350) + 5, 'font-size': G.fs, class: 's-monot s-sub' }, '1350: x = 42'),  // the data item x = 42 at 1350
              s('text', { x: zx + 8, y: zy(1840) + 5, 'font-size': G.fs, class: 's-monot s-sub' }, '1840: top of stack'),  // the top of the stack at 1840
              s('text', { x: zx + G.ex, y: zy(200) + 18, 'font-size': 12.5, class: 's-sub' }, G.entry));  // a label with an arrow marking 200 as the entry point
            kids.push(g);  // adds the zoomed image to the drawing
            kids.push(s('text', { x: zx + zw / 2, y: 18, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 14 }, base == null ? 'P: swapped out to disk' : 'Process image of P'),  // heading over the zoomed image: "Process image of P", or "P: swapped out to disk"
              s('text', { x: zx - 6, y: 466, 'text-anchor': 'end', 'font-size': 12.5, class: 's-sub' }, 'relative'),  // "relative" under the left column of addresses
              s('text', { x: Math.min(zx + zw + 6, G.vw - 52), y: 466, 'font-size': 12.5, class: 'tx-acc' }, base == null ? '' : 'physical'));  // "physical" under the right column (kept inside the canvas), left blank while P is on disk
            if (last && base != null) {  // if a reference was just run and P is in memory, show where it lands
              const r = last, phys = physOf(r.rel), ok = phys === base + r.rel, col = ok ? 'ok' : 'bad';  // r: that reference; phys: the address used; ok: true when it equals base + rel (inside P); col: green or red
              const fromY = r.from == null ? zy(200) : zy(r.from);  // fromY: where the arrow starts: the entry point when starting P, otherwise the instruction's row
              if (ok) {  // a correct reference
                if (r.from == null) kids.push(s('path', { d: `M${zx + zw - 8},${fromY - 22} L${zx + zw - 8},${fromY - 3}`, class: 's-line', style: 'stroke:var(--ok)', 'marker-end': 'url(#arr-ok)' }));  // starting P: a short green arrow down onto the entry point
                else kids.push(s('path', { d: `M${zx + zw - G.a0},${fromY} C${zx + zw - 2},${fromY} ${zx + zw - 2},${zy(r.rel)} ${zx + zw - G.a1},${zy(r.rel)}`, class: 's-line', style: 'stroke:var(--ok)', 'marker-end': 'url(#arr-ok)' }));  // other references: a green curve along the image's right side, from the instruction to its target
              } else {  // a wrong reference
                kids.push(s('path', { d: `M${zx},${fromY} C${zx - 70},${fromY} ${G.bx + G.bw + 70},${oy(phys)} ${G.bx + G.bw + 6},${oy(phys)}`, class: 's-line', style: 'stroke:var(--bad)', 'stroke-dasharray': '6 4', 'marker-end': 'url(#arr-bad)' }));  // a dashed red curve from the instruction out to the overview bar, where the address really lands
              }  // ends the correct or wrong choice
              kids.push(s('circle', { cx: G.bx + G.bw * 0.82, cy: oy(phys), r: 5, style: `fill:var(--${col});stroke:var(--${col})` }));  // a dot on the overview bar at the physical address reached, green or red
            }  // ends the last-reference drawing
            svg.replaceChildren(...kids);  // swaps in the new drawing
            tbl.replaceChildren(h('tr', {}, h('th', {}, 'Reference'), h('th', {}, 'Relative'), h('th', {}, 'Physical now')),  // rebuilds the table, starting with the header row: Reference, Relative, Physical now
              ...REFS.map((r) => {  // then one row per reference
                if (base == null) return h('tr', {}, h('td', {}, r.name), h('td', { class: 'mono' }, String(r.rel)), h('td', { class: 'muted' }, 'on disk'));  // while P is on disk: its name, its relative address and "on disk"
                const phys = physOf(r.rel), ok = phys === base + r.rel;  // phys and ok: the address used and whether it falls inside P
                return h('tr', { class: last === r ? 'on' : '' }, h('td', {}, r.name), h('td', { class: 'mono' }, String(r.rel)),  // the row, highlighted if it is the reference just run, with the name and relative address
                  h('td', { html: `<span class="mono">${phys}</span> ` + (ok ? '<span class="chip ok">inside P</span>' : `<span class="chip bad">in ${owner(phys)}!</span>`) }));  // last column: the physical address plus a green "inside P" tag, or a red tag naming whose memory it hits
              }));  // ends the rows and the table
            btnOut.disabled = where !== 'home'; btnIn.disabled = where !== 'disk';  // "Swap P out" works only while P is at home, "Swap P back in" only while P is on disk
            refBtns.forEach((b) => (b.disabled = base == null));  // the reference buttons are switched off while P is on disk
          }  // ends draw
          function run(r) {  // run(r): called when a reference button is clicked: records r, explains what happens and redraws
            last = r;  // last: remembers r so draw can show its arrow and highlight its row
            const base = baseOf(), phys = physOf(r.rel), ok = phys === base + r.rel;  // base, phys and ok for this reference
            const how = mode === 'runtime' ? `The hardware adds P’s current base: ${base} + ${r.rel} = <b>${phys}</b>.` : `The address was fixed when P was first loaded at ${FIRST}: ${FIRST} + ${r.rel} = <b>${phys}</b>, and ${r.key === 'entry' ? 'P’s records still hold' : r.key === 'push' ? 'the stack pointer still holds' : 'the code still holds'} it.`;  // how: explains how the address was formed: run-time (base + relative), or fixed at the first load and still held in the code, records or stack pointer
            const act = r.key === 'entry' ? 'The OS starts P at its entry point.' : r.key === 'jump' ? 'The branch instruction jumps to the loop start.' : r.key === 'load' ? 'The load instruction reads the data item x.' : 'The push writes a value at the top of the stack.';  // act: what the instruction does, in words, for each kind of reference
            narr.innerHTML = `${act} ${how} ` + (ok ? `<span class="c-ok b">Correct:</span> that is inside P, exactly where the programmer meant.`  // narration: the action, then how, then a green "Correct" when the address is inside P
              : `<span class="c-bad b">Wrong place:</span> ${phys} belongs to <b>${owner(phys)}</b> now. P would ${r.key === 'load' ? 'read S’s data' : r.key === 'push' ? 'overwrite S’s memory' : 'run S’s instructions'}: a crash at best, silent damage at worst.`);  // or a red "Wrong place" naming the owner and the harm: reading S's data, overwriting S's memory or running S's code
            draw();  // redraws with the new last reference
          }  // ends run
          function reset() {  // reset(): puts P back at 2000 and clears the narration; runs when the slide opens and from "Start over"
            where = 'home'; last = null;  // P is at home and no reference has been run yet
            narr.innerHTML = '<b>P is loaded at 2000.</b> ' + (mode === 'runtime' ? 'Its code uses <span class="t">relative addresses</span>.' : 'Its addresses were made physical when it was loaded (<span class="mono">jump 2920</span>).') +  // narration: P is loaded at 2000, and (by mode) its code uses relative addresses or addresses already fixed for 2000
              ' <span class="muted">Run its references (the <span class="t">entry point</span>, a <span class="t">branch instruction</span>, a load, a push), then swap P out and back in.</span>';  // plus a grey hint of what to try: run the four references, then swap P out and back in
            draw();  // redraws
          }  // ends reset
          const btnOut = h('button', { class: 'btn sm', onclick: () => { where = 'disk'; last = null; narr.innerHTML = '<b>P is swapped out to disk</b> to make room. While it waits, the OS gives 2000–3999 to a new process, <b>S</b>. When P returns, the only free region is 6000–7999.'; draw(); } }, 'Swap P out');  // "Swap P out" button: sends P to disk, explains that new process S takes 2000-3999 and only 6000-7999 will be free, redraws
          const btnIn = h('button', { class: 'btn sm primary', onclick: () => {  // "Swap P back in" button; its click handler starts here
            where = 'moved'; last = null;  // P now lives at 6000 and no reference is selected
            narr.innerHTML = '<b>P is back, at 6000 instead of 2000.</b> ' + (mode === 'runtime' ? 'Its code is unchanged (still <span class="mono">jump 920</span>); only the base the hardware adds has changed. Run the references again.' : 'Its code still holds the addresses patched in for 2000. Run the references again.');  // narration: P is back at 6000; with run-time translation its code is unchanged, with fixed addresses it still holds those for 2000
            draw();  // redraws
          } }, 'Swap P back in');  // ends the swap-in handler and gives the button its text
          const refBtns = REFS.map((r) => h('button', { class: 'btn sm proc', onclick: () => run(r) }, r.btn));  // refBtns: one teal button per reference; a click runs it
          const seg = ctx.ui.seg([{ value: 'fixed', label: 'Fixed at first load' }, { value: 'runtime', label: 'Translated at run time' }], mode, (v) => {  // seg: a switch between addresses fixed at first load and addresses translated at run time, starting at mode
            mode = v; last = null;  // on a change: stores the mode and forgets the last reference
            narr.innerHTML = v === 'runtime' ? '<b>Run-time translation:</b> P’s code keeps <span class="t">relative addresses</span>. On every memory reference the hardware adds the start of P’s current region (its <span class="t">base register</span>): <span class="t">address translation</span>.'  // run-time wording: on every reference the hardware adds the start of P's region (its base register): address translation
              : '<b>Fixed at first load:</b> P’s addresses were made physical once, when it was loaded at 2000. Re-patching them on every swap-in is impractical: copies also sit in registers and on the stack. ' + (where === 'moved' ? 'P now lives at 6000: run a reference.' : where === 'disk' ? 'Swap P back in, then run a reference.' : 'Swap P out and back in, then run a reference.');  // fixed wording: the addresses were patched once for 2000, re-patching on every swap is impractical; then a hint that depends on where P is
            draw();  // redraws
          });  // ends the switch
          reset();  // sets up the starting state and the first drawing
          el.append(h('div', { class: 'split l fill' },  // lays out the slide: two columns filling the step
            h('div', { class: 'stack', style: { gap: '10px' } },  // left column: text and controls stacked with 10px gaps
              h('p', { class: 'm0', html: 'Nobody knows in advance where a program will sit in memory, and <span class="t" data-t="swapping">swapping</span> may bring it back somewhere else. Yet every <span class="t">memory reference</span> in its code (branch targets, data, the stack) must reach the right <span class="t">physical address</span>. That is <span class="t">relocation</span>.' }),  // opening paragraph: nobody knows where a program will sit, yet every reference must reach the right physical address: relocation
              h('div', { class: 'row', style: { gap: '8px' } }, h('span', { class: 'small b' }, 'Addresses:'), seg),  // row: an "Addresses:" label and the mode switch
              h('div', { class: 'row', style: { gap: '6px' } }, btnOut, btnIn, h('button', { class: 'btn sm ghost', onclick: reset }, 'Start over')),  // row: the swap-out and swap-in buttons and a quiet "Start over" button
              h('div', { class: 'row', style: { gap: '6px' } }, h('span', { class: 'small b' }, 'Run:'), ...refBtns),  // row: a "Run:" label and the four reference buttons
              tbl, narr),  // the table and the narration; closes the left column
            h('div', { class: 'card white', style: { padding: '8px 10px', display: 'grid', placeItems: 'center' } }, svg)));  // right column: a white card that centres the drawing; closes the layout
        },  // ends render for step 2
      },  // ends step 2
      /* ---------------- 3. Protection: check every reference, in hardware ---------------- */
      {  // opens step 3, protection
        title: 'Protection: every address is checked as it happens',  // step 3 title
        kind: 'explore',  // kind 'explore': a hands-on slide
        core: true,  // core: true puts this step on the core path
        render(el, ctx) {  // render(el, ctx): draws step 3 when the slide opens
          const { h, s } = ctx;  // takes the HTML builder h and the SVG builder s out of the toolbox
          const BASE = 6000, BOUNDS = 8000;            // P lives in 6000-7999, as at the end of the last step
          const owner = (a) => (a < 0 || a >= MEM ? 'nothing (no such address)' : a < 2000 ? 'the OS' : a < 4000 ? 'S' : a < 6000 ? 'Q' : a < 8000 ? 'P' : 'R');  // owner(a): who holds physical address a in this layout; addresses outside 0 to 9,999 belong to nothing at all
          /* tab 1: the hardware check on x = a[i] */
          function hwTab(p) {  // hwTab(p): draws the first tab, the hardware check, into its panel p
            let i = 3;  // i: the array index the student picks; it starts at 3, a safe value
            const code = listing(ctx, [['int a[10];', 'ten 4-byte integers at relative 1300 to 1339'], ['i = read_int();', 'i comes from input: nobody knows it in advance'],  // code: the shown three-line program, each line with its comment; first the array, then i read from input
              ['x = a[i];', 'address = 1300 + 4 × i, known only at run time']], { fontSize: 13.5 });  // last shown line: x = a[i], whose address is known only at run time; the whole box uses a 13.5px font
            const svg = s('svg', { viewBox: ctx.narrow ? '0 0 360 396' : '0 0 640 252', width: '100%' });   // a taller, slimmer layout on a small screen
            const res = h('div', { class: 'card tight small', style: { minHeight: '50px', lineHeight: '1.45' } });  // res: the result box under the drawing that says whether the access was allowed
            const box = (x, y, w, hh, cls, lines, big) => s('g', {}, s('rect', { x, y, width: w, height: hh, rx: 8, class: cls, 'stroke-width': 2 }),  // box(...): a rounded rectangle with centred label lines inside; big makes the text extra bold
              mtext(s, x + w / 2, y + (lines.length > 1 ? 20 : hh / 2 + 5), lines, { 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': big ? 800 : 600 }, 18));  // the label lines: near the top when there are two, in the middle when there is one
            function draw() {  // draw(): works out the address for the current i and redraws the check
              const rel = 1300 + 4 * i, phys = BASE + rel, ok = phys >= BASE && phys < BOUNDS;  // rel: relative address 1300 + 4 × i; phys: base + rel; ok: phys is at or above the base and below the bounds
              const yes = { class: ok ? 's-line' : 's-muted', style: ok ? 'stroke:var(--ok)' : '', 'marker-end': ok ? 'url(#arr-ok)' : 'url(#arr-muted)' };  // yes: the style of the "access" arrow: solid green when allowed, faint grey otherwise
              const no = { class: ok ? 's-muted' : 's-line', style: ok ? '' : 'stroke:var(--bad)', 'marker-end': ok ? 'url(#arr-muted)' : 'url(#arr-bad)' };  // no: the style of the "trap" arrow: red when stopped, faint grey otherwise
              const kids = ctx.narrow ? [  // kids: the check diagram; a small screen gets a taller, slimmer layout drawn top to bottom
                box(10, 8, 150, 52, 's-proc', ['relative', String(rel)], true),  // small screen: the relative-address box, top left
                box(200, 8, 150, 52, 's-cpu', ['base register', String(BASE)]),  // the base register box, top right
                s('path', { d: 'M85,60 L85,68', class: 's-line', 'marker-end': 'url(#arr)' }),  // short arrow from the relative box down to the adder
                s('path', { d: 'M275,60 L275,86 L103,86', class: 's-line', 'marker-end': 'url(#arr)' }),  // arrow from the base register down and across into the adder
                s('circle', { cx: 85, cy: 86, r: 16, class: 's-cpu', 'stroke-width': 2 }),  // the adder: a blue circle
                s('text', { x: 85, y: 93, 'text-anchor': 'middle', 'font-size': 22, 'font-weight': 800, class: 'tx-cpu' }, '+'),  // the "+" inside it
                s('path', { d: 'M85,102 L85,110', class: 's-line', 'marker-end': 'url(#arr)' }),  // arrow from the adder down to the physical-address box
                box(10, 112, 150, 52, 's-panel', ['physical', String(phys)], true),  // the physical-address box, holding base + relative
                box(200, 112, 150, 52, 's-cpu', ['bounds register', String(BOUNDS)]),  // the bounds register box beside it
                s('path', { d: 'M85,164 L118,186', class: 's-line', 'marker-end': 'url(#arr)' }),  // arrow from the physical box down into the comparison
                s('path', { d: 'M275,164 L242,186', class: 's-line', 'marker-end': 'url(#arr)' }),  // arrow from the bounds register down into the comparison
                box(40, 188, 280, 56, ok ? 's-ok' : 's-bad', [`${BASE} ≤ ${phys}`, `and ${phys} < ${BOUNDS}?`]),  // the comparison box (base ≤ physical and physical < bounds?), green when true, red when false
                s('path', Object.assign({ d: 'M130,244 L98,266' }, yes)),  // arrow toward "yes", in the yes style
                s('path', Object.assign({ d: 'M230,244 L262,266' }, no)),  // arrow toward "no", in the no style
                box(20, 268, 150, 40, ok ? 's-ok' : 's-panel', ['yes: access']),  // "yes: access" box, green when the access is allowed
                box(190, 268, 150, 40, ok ? 's-panel' : 's-bad', ['no: trap → OS']),  // "no: trap → OS" box, red when the access is stopped
              ] : [  // wide-screen layout: the whole check reads left to right
                box(6, 30, 128, 52, 's-proc', ['relative', String(rel)], true),  // the relative-address box at the left
                s('path', { d: 'M134,56 L166,56', class: 's-line', 'marker-end': 'url(#arr)' }),  // arrow into the adder
                s('circle', { cx: 186, cy: 56, r: 18, class: 's-cpu', 'stroke-width': 2 }),  // the adder circle
                s('text', { x: 186, y: 63, 'text-anchor': 'middle', 'font-size': 22, 'font-weight': 800, class: 'tx-cpu' }, '+'),  // its "+"
                box(126, 112, 120, 52, 's-cpu', ['base register', String(BASE)]),  // the base register box below the adder
                s('path', { d: 'M186,112 L186,78', class: 's-line', 'marker-end': 'url(#arr)' }),  // arrow up from the base register into the adder
                s('path', { d: 'M204,56 L236,56', class: 's-line', 'marker-end': 'url(#arr)' }),  // arrow from the adder to the physical-address box
                box(238, 30, 120, 52, 's-panel', ['physical', String(phys)], true),  // the physical-address box
                s('path', { d: 'M358,56 L384,56', class: 's-line', 'marker-end': 'url(#arr)' }),  // arrow into the comparison
                box(386, 26, 132, 60, ok ? 's-ok' : 's-bad', [`${BASE} ≤ ${phys}`, `and ${phys} < ${BOUNDS}?`]),  // the comparison box, green or red
                box(392, 112, 120, 52, 's-cpu', ['bounds register', String(BOUNDS)]),  // the bounds register box below it
                s('path', { d: 'M452,112 L452,88', class: 's-line', 'marker-end': 'url(#arr)' }),  // arrow up from the bounds register into the comparison
                s('path', Object.assign({ d: 'M518,46 L548,30' }, yes)),  // upper arrow toward "yes"
                s('path', Object.assign({ d: 'M518,66 L548,86' }, no)),  // lower arrow toward "no"
                box(550, 8, 84, 44, ok ? 's-ok' : 's-panel', ['yes: access']),  // "yes: access" box
                box(550, 68, 84, 44, ok ? 's-panel' : 's-bad', ['no: trap']),  // "no: trap" box
                s('text', { x: 592, y: 132, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, 'trap → OS'),  // a note below it: the trap hands control to the OS
              ];  // ends the two layouts
              /* where the address lands in memory */
              const L = ctx.narrow ? { x0: 10, k: 0.034, w: 66, y: 344, end: 350 } : { x0: 20, k: 0.06, w: 118, y: 200, end: 620 };  // L: the memory strip's left edge, scale, region width, height position and right end, chosen for the screen size
              const sx = (a) => L.x0 + a * L.k;  // sx(a): turns a physical address into an x position on the strip
              const regs = [['OS', 0, 's-os'], ['S', 2000, 's-panel'], ['Q', 4000, 's-panel'], ['P', 6000, 's-proc'], ['R', 8000, 's-panel']];  // regs: the five regions of this layout: the OS, S, Q, P (teal, the running process) and R
              regs.forEach(([nm, a, cls]) => kids.push(s('rect', { x: sx(a) + 1, y: L.y, width: L.w, height: 30, rx: 5, class: cls, 'stroke-width': 1.5 }),  // for each region: its rectangle on the strip
                s('text', { x: sx(a) + L.w / 2 + 1, y: L.y + 20, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800, class: nm === 'P' ? 'tx-proc' : nm === 'OS' ? 'tx-os' : '' }, nm)));  // its name, coloured for P and for the OS
              const mx = sx(Math.max(-150, Math.min(MEM + 150, phys)));  // mx: where the marker goes; the address is held just past the strip ends so far-off values still show
              kids.push(s('path', { d: `M${mx},${L.y - 12} L${mx},${L.y}`, class: 's-line', style: `stroke:var(--${ok ? 'ok' : 'bad'})`, 'marker-end': `url(#arr-${ok ? 'ok' : 'bad'})` }),  // a short arrow pointing down at that spot, green if allowed, red if trapped
                s('text', { x: Math.max(L.x0 + 20, Math.min(L.end - 20, mx)), y: L.y - 16, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, class: ok ? 'tx-ok' : 'tx-bad' }, String(phys)),  // the physical address above the arrow, kept clear of the strip ends so it is not cut off
                s('text', { x: L.x0, y: L.y + 47, 'font-size': 12.5, class: 's-sub' }, '0'), s('text', { x: L.end, y: L.y + 47, 'text-anchor': 'end', 'font-size': 12.5, class: 's-sub' }, '10,000'));  // "0" and "10,000" under the two ends of the strip
              svg.replaceChildren(...kids);  // swaps in the new drawing
              const inArr = i >= 0 && i < 10;  // inArr: whether i names a real element of the 10-element array
              res.innerHTML = ok  // res: the result message
                ? `<span class="c-ok b">Allowed.</span> ${phys} is inside P’s own region. ` + (inArr ? `It is element a[${i}], as intended.` : `It is <b>not</b> part of the array (a has elements 0 to 9), so this is a bug in P, but it can only hurt P itself.`)  // allowed: inside P's own region; then either it is a[i] as intended, or it lies outside the array, a bug that can only hurt P
                : `<span class="c-bad b">Trap!</span> ${phys} belongs to <b>${owner(phys)}</b>. The hardware stops the access before it happens and hands control to the OS, which normally ends P.`;  // trapped: names whose memory it is; the hardware stops the access and hands control to the OS
            }  // ends draw
            const sl = ctx.ui.slider({ label: 'i', min: -1500, max: 250, value: i, onInput: (v) => { i = v; draw(); } });  // sl: slider for i from -1500 to 250; moving it stores i and redraws
            const pre = h('div', { class: 'row', style: { gap: '6px' } }, h('span', { class: 'small b' }, 'Try i ='),  // pre: a row of quick-pick buttons, starting with a "Try i =" label
              ...[3, 60, 200, -400, -1400].map((v) => h('button', { class: 'btn sm', onclick: () => { i = v; sl.set(v); draw(); } }, String(v))));  // one button each for 3, 60, 200, -400 and -1400; a click sets i, moves the slider to match and redraws
            draw();  // first drawing
            p.append(h('div', { class: 'stack', style: { gap: '8px' } }, code, ctx.narrow ? h('div', { class: 'stack gap-s' }, sl, pre) : h('div', { class: 'row nw', style: { gap: '10px' } }, h('div', { class: 'grow' }, sl), pre), svg, res));  // assembles the tab: code, then slider and quick picks (stacked on a small screen, side by side otherwise), drawing, result
          }  // ends hwTab
          /* tab 2: the cost of checking in software */
          function swTab(p) {  // swTab(p): draws the second tab, the cost of checking in software, into its panel p
            let c = 40;  // c: how many OS instructions one check would cost; starts at 40
            const out = h('div', { class: 'stack', style: { gap: '8px' } });  // out: the box holding the two bars and the explanation
            function draw() {  // draw(): rebuilds the bars and the text for the current c
              const slow = 1 + 1.5 * c;  // slow: instruction times each instruction would take: 1 for itself plus 1.5 references × c for the checks
              const bar = (label, val, cls, txt) => h('div', { class: 'row nw', style: { gap: '10px' } }, h('div', { class: 'small b', style: { width: '150px', flex: 'none' } }, label),  // bar(label, val, cls, txt): one bar row: a fixed-width label on the left
                h('div', { class: 'grow' }, h('div', { style: { height: '24px', width: Math.max(1.2, Math.min(100, val)) + '%', borderRadius: '6px', background: `var(--${cls})` } })),  // the bar itself, val percent of the space (at least a sliver, at most full), in colour cls
                h('div', { class: 'small b mono', style: { width: '104px', flex: 'none', whiteSpace: 'nowrap', textAlign: 'right' } }, txt));  // and a fixed-width readout on the right
              out.replaceChildren(  // replaces the box's content with
                bar('Hardware check', 100 / slow, 'ok', '1×'),  // the hardware bar: a short green bar, "1×"
                bar('OS software check', 100, 'bad', ctx.util.fmt(slow, 0) + '× slower'),  // the software bar: full width in red, labelled with how many times slower
                h('p', { class: 'small m0', html: `Each instruction makes about <b>1.5</b> memory references (its own fetch, plus a data access about half the time). If every one cost ${c} OS instructions to check, each instruction would cost 1 + 1.5 × ${c} = <b>${ctx.util.fmt(slow, 0)}</b> instruction times. A one-minute job would take <b>${ctx.util.fmt(slow, 0)} minutes</b>.` }));  // explanation: about 1.5 references per instruction, the cost formula with c filled in, and how long a one-minute job would take
            }  // ends draw
            const sl = ctx.ui.slider({ label: 'OS instructions per check', min: 10, max: 200, step: 5, value: c, onInput: (v) => { c = v; draw(); } });  // sl: slider for OS instructions per check, 10 to 200 in steps of 5
            draw();  // first drawing
            p.append(h('div', { class: 'stack', style: { gap: '10px' } },  // assembles the tab in a column
              h('p', { class: 'm0', html: 'Suppose the OS, in software, had to approve each <span class="t">memory reference</span> before it happened.' }), sl, out,  // an opening sentence (suppose the OS had to approve every reference), the slider and the bars
              h('ul', { class: 'small m0', html: '<li><b>Too slow:</b> see the bars. Hardware checks alongside the access, at almost no cost.</li><li><b>Impossible to plan:</b> the OS cannot know in advance what a[i], a pointer or a return address on the stack will be.</li><li><b>Not even running:</b> while P runs, the processor executes P’s instructions directly. The OS gets control only after an interrupt or a trap.</li>' }),  // bullet list of three reasons a software check fails: too slow, impossible to plan, and the OS is not even running
              h('div', { class: 'callout why m0 small', 'data-label': 'Why it matters', html: 'This is why protection is built into the processor. Simple machines used a base and a bounds register; today the <span class="t">memory management unit (MMU)</span> checks every access against tables the OS sets up.' })));  // "Why it matters" callout: protection lives in the processor (base and bounds, today the MMU); closes the tab
          }  // ends swTab
          el.append(h('div', { class: 'split l fill' },  // lays out the slide: two columns filling the step
            h('div', { class: 'stack', style: { gap: '10px' } },  // left column: text stacked with 10px gaps
              h('p', { class: 'lead m0', html: '<span class="t">Memory protection</span>: a process must not read or write another process’s memory, or the OS’s, without permission.' }),  // opening sentence: defines memory protection
              h('p', { class: 'm0', html: 'Why not check a program’s addresses once, when it is compiled?' }),  // the question: why not check a program's addresses once, when it is compiled?
              h('ul', { class: 'm0', html: '<li><b>Relocation:</b> nobody knows the physical addresses until the program is loaded, and they change when it moves.</li><li><b>Computed addresses:</b> a[i] or a pointer gets its value only while the program runs.</li>' }),  // bullet list of the two reasons: relocation, and addresses computed while the program runs
              h('p', { class: 'm0', html: 'So every reference is checked <b>at the moment it happens</b>, by the <b>processor hardware</b>. One simple way: a <span class="t">base register</span> and a <span class="t">bounds register</span> (section 7.2 covers them in depth).' }),  // so every reference is checked as it happens, by hardware; names base and bounds registers and the section that covers them
              h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'This check keeps P out of <i>other</i> memory. It does not catch P scribbling over its <i>own</i> data: try i = 60.' }),  // "Common mistake" callout: the check does not stop P from damaging its own data (try i = 60)
              h('div', { class: 'callout analogy m0 small', 'data-label': 'Analogy', html: 'A badge reader on a door checks each entry as it happens. A guest list printed last week cannot know who will turn up.' })),  // analogy callout: a badge reader checks each entry, a printed guest list cannot; closes the left column
            h('div', { class: 'card white', style: { padding: '10px 12px' } }, ctx.ui.tabs([{ label: 'The hardware check', render: hwTab }, { label: 'Why not check in software?', render: swTab }]))));  // right column: a white card with two tabs, the hardware check and why not software; closes the layout
        },  // ends render for step 3
      },  // ends step 3
      /* ---------------- 4. Sharing: one copy of the code, private data ---------------- */
      {  // opens step 4, sharing
        title: 'Sharing: one copy of the code, on purpose',  // step 4 title
        kind: 'explore',  // kind 'explore': a hands-on slide
        render(el, ctx) {  // render(el, ctx): draws step 4 when the slide opens
          const { h, s } = ctx;  // takes the HTML builder h and the SVG builder s out of the toolbox
          const CODE = 30, DOC = 6, CLIP = 4;   // megabytes
          let n = 3, shared = true, act = null;  // n: editors running; shared: one copy of the code or a copy each; act: the access just tried, if any
          /* A small screen gets a tall layout: the editors in a column on the left, physical memory as an upright bar on the right. */
          const TALL = ctx.narrow, VW = TALL ? 330 : 640;  // TALL: true on a small screen; VW: the drawing's width, 330 for the tall layout and 640 for the wide one
          const RH = 16, BH = 3 * RH + 10, Y0 = 26, BX = 252, BW = 74;   // tall layout: row height, editor box height, top, bar x and width
          const svg = s('svg', { viewBox: `0 0 ${VW} 272`, width: '100%' });  // the drawing; in the tall layout draw() later sets its height to fit
          const used = h('div', { class: 'row', style: { gap: '8px' } });  // used: the row showing how many megabytes are in use, with a tag
          const narr = h('div', { class: 'card tight small', style: { minHeight: '70px', lineHeight: '1.45' } });  // narr: the narration box under the buttons
          const ACTS = {  // ACTS: the four accesses the student can try; need is how many editors must be running for it to make sense
            run: { btn: 'E1 runs the code', need: 1 },  // access 1: E1 runs (fetches instructions from) the code
            write: { btn: 'E1 writes into the code', need: 1 },  // access 2: E1 tries to write into the code
            peek: { btn: 'E1 reads E2’s document', need: 2 },  // access 3: E1 tries to read E2's document
            clip: { btn: 'E1 and E2 use the clipboard', need: 2 },  // access 4: E1 and E2 pass data through the shared clipboard
          };  // closes ACTS
          function layout(len, a0) {  // layout(len, a0): works out where each block sits on a memory bar of length len that starts at position a0
            const sc = len / (n * (CODE + DOC) + CLIP), blocks = [];   // the bar is as long as private copies would need
            let a = a0;  // a: the running position along the bar
            const add = (kind, who, mb) => { blocks.push({ kind, who, a, l: mb * sc }); a += mb * sc; };  // add(kind, who, mb): places a block of mb megabytes for editor who and moves a past it
            if (shared) add('code', 0, CODE); else for (let i = 1; i <= n; i++) add('code', i, CODE);  // the code: one shared block (who 0), or one private copy per editor
            for (let i = 1; i <= n; i++) add('doc', i, DOC);  // one private document block per editor
            add('clip', 0, CLIP);  // one clipboard block, always shared
            return { blocks, end: a };  // returns the blocks and where the last one ends
          }  // ends layout
          function draw() {  // draw(): redraws the maps, the lines, the memory bar, the caption, the megabyte readout and the buttons
            const len = TALL ? Math.max(n * BH + (n - 1) * 8, 200) : 620;  // len: the bar's length: in the tall layout as tall as the stacked editor boxes (at least 200), otherwise 620 wide
            const { blocks, end } = layout(len, TALL ? Y0 : 10);  // places the blocks, starting below the headings (tall) or 10 from the left edge (wide)
            const find = (kind, who) => blocks.find((b) => b.kind === kind && (kind === 'clip' || (kind === 'code' && shared) || b.who === who));  // find(kind, who): the block a map row points to: the shared clipboard, the shared code, or that editor's own block
            const bw = 112, gap = 16, x0 = (640 - (n * bw + (n - 1) * gap)) / 2;  // wide layout: editor boxes 112 wide with 16 between them; x0 centres the row of boxes
            const px = (i) => x0 + (i - 1) * (bw + gap), py = (i) => Y0 + (i - 1) * (BH + 8);  // px(i): left edge of editor i's box in the wide layout; py(i): top of editor i's box in the tall layout
            const KINDS = ['code', 'doc', 'clip'], CLS = { code: 's-proc', doc: 's-mem', clip: 's-io' }, TX = { code: 'tx-proc', doc: 'tx-mem', clip: 'tx-io' };  // KINDS: the three rows of each memory map; CLS: the block colours; TX: the matching text colours
            /* where a line leaves row j of editor i's map, where it reaches block b, and the curve between them */
            const from = (i, j) => (TALL ? { x: 132, y: py(i) + 5 + RH * (j + 0.5) } : { x: px(i) + 20 + 36 * j, y: 86 });  // from(i, j): where a line leaves row j of editor i's box
            const to = (b) => (TALL ? { x: BX, y: b.a + b.l / 2 } : { x: b.a + b.l / 2, y: 196 });  // to(b): where a line reaches block b: its left side at mid-height (tall) or its top centre (wide)
            const curve = (p, q, lift = 0) => (TALL ? `M${p.x},${p.y} C${p.x + 60},${p.y} ${q.x - 60},${q.y} ${q.x},${q.y}`  // curve(p, q, lift): a smooth S-shaped curve from p to q; in the tall layout it bends sideways
              : `M${p.x},${p.y} C${p.x},${150 + lift} ${q.x},${140 - lift} ${q.x},${q.y}`);  // in the wide layout it bends up and down; lift pulls one curve apart from the others
            const kids = [];  // kids collects the shapes of the drawing
            /* lines from each process's map to the physical blocks it uses */
            for (let i = 1; i <= n; i++) {  // for each editor
              KINDS.forEach((k, j) => {  // for each of its three map rows
                let style = '', dash = null, cls = 's-muted';  // by default the line is faint grey and solid
                if (act && i <= 2) {  // only editors 1 and 2 take part in the accesses
                  const hit = (act === 'run' && i === 1 && k === 'code') || (act === 'clip' && k === 'clip') || (act === 'write' && i === 1 && k === 'code');  // hit: whether this line is the one the current access uses (E1's code row for run and write, both clipboard rows for clip)
                  if (hit) { cls = 's-line'; style = act === 'write' ? 'stroke:var(--bad)' : 'stroke:var(--ok)'; dash = act === 'write' ? '6 4' : null; }  // a hit line is drawn darker: red and dashed for the refused write, green for an allowed access
                }  // ends the highlight check
                kids.push(s('path', { d: curve(from(i, j), to(find(k, i))), class: cls, style, 'stroke-dasharray': dash, 'stroke-width': cls === 's-line' ? 2.5 : 1.5 }));  // the line from the map row to its block, thicker when highlighted
              });  // ends the loop over rows
            }  // ends the loop over editors
            if (act === 'peek') {  // the refused read gets its own extra line
              const p = from(1, 1), q = to(find('doc', 2));  // p: E1's document row; q: E2's document block
              kids.push(s('path', { d: curve(p, q, 10), class: 's-line', style: 'stroke:var(--bad)', 'stroke-dasharray': '6 4', 'stroke-width': 2.5 }),  // a dashed red curve between them, lifted so it stands apart
                s('text', { x: (p.x + q.x) / 2 + 8, y: TALL ? (p.y + q.y) / 2 + 6 : 150, 'font-size': 18, 'font-weight': 800, class: 'tx-bad' }, '✗'));  // with a red cross mark halfway along: the access is refused
            }  // ends the refused-read case
            for (let i = 1; i <= n; i++) {  // for each editor, its box and labels
              if (TALL) kids.push(s('rect', { x: 4, y: py(i), width: 128, height: BH, rx: 10, class: 's-panel', 'stroke-width': 1.5 }),  // tall layout: a rounded box at the left
                s('text', { x: 28, y: py(i) + BH / 2 + 6, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 16 }, 'E' + i),  // the editor's name, E1, E2 and so on
                ...KINDS.map((k, j) => s('text', { x: 124, y: from(i, j).y + 4.5, 'text-anchor': 'end', 'font-size': 12.5, 'font-weight': 700, class: TX[k] }, k)));  // the three row labels (code, doc, clip), right-aligned and coloured to match their blocks
              else kids.push(s('rect', { x: px(i), y: 8, width: bw, height: 78, rx: 10, class: 's-panel', 'stroke-width': 1.5 }),  // wide layout: a box in the top row
                s('text', { x: px(i) + bw / 2, y: 30, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 15 }, 'E' + i),  // the editor's name
                s('text', { x: px(i) + bw / 2, y: 48, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, 'its memory map:'),  // "its memory map:" under the name
                ...KINDS.map((k, j) => s('text', { x: from(i, j).x, y: 74, 'text-anchor': 'middle', 'font-size': 12.5, 'font-weight': 700, class: TX[k] }, k)));  // the three row labels side by side under that
            }  // ends the loop over editors
            /* physical memory: one bar, as long as private copies would need */
            kids.push(s('rect', Object.assign(TALL ? { x: BX, y: Y0, width: BW, height: len } : { x: 10, y: 196, width: 620, height: 44 }, { rx: 6, class: 's-panel', 'stroke-width': 1, 'stroke-dasharray': '4 3' })));  // the empty bar with a dashed outline: upright on the right (tall layout) or across the bottom (wide layout)
            blocks.forEach((b) => {  // for each block on the bar
              kids.push(s('rect', Object.assign(TALL ? { x: BX, y: b.a + 0.5, width: BW, height: b.l - 1 } : { x: b.a + 0.5, y: 196, width: b.l - 1, height: 44 }, { rx: 4, class: CLS[b.kind], 'stroke-width': 1.5 })));  // its rectangle, coloured by kind: teal code, green document, orange clipboard
              if (b.kind !== 'code') return;  // only code blocks get a label inside; the others are named in the caption
              const c = TALL ? { x: BX + BW / 2, y: b.a + b.l / 2 } : { x: b.a + b.l / 2, y: 218 };  // c: the centre of the block
              kids.push(mtext(s, c.x, c.y + (TALL && shared ? -3 : 5), TALL && shared ? ['code', '(shared)'] : [shared ? 'code (shared)' : 'code E' + b.who],  // its label: "code (shared)" (on two lines in the tall layout), or "code E1", "code E2" and so on
                { 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, class: 'tx-proc' }, 16));  // centred, bold and teal
            });  // ends the loop over blocks
            if (TALL && Y0 + len - end > 26) kids.push(s('text', { x: BX + BW / 2, y: (end + Y0 + len) / 2 + 5, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, 'free'));  // tall layout: writes "free" in the unused end of the bar if there is room
            if (!TALL && 630 - end > 40) kids.push(s('text', { x: end + 8, y: 223, 'font-size': 13, class: 's-sub' }, 'free'));  // wide layout: writes "free" after the last block if there is room
            /* the caption doubles as a colour key for the blocks */
            const tot = n * (CODE + DOC) + CLIP;  // tot: the megabytes private copies would need, which is the bar's full length
            const key = [s('tspan', { class: 'tx-proc' }, `code ${CODE} MB`), ' · ', s('tspan', { class: 'tx-mem' }, `each document ${DOC} MB`), ' · ', s('tspan', { class: 'tx-io' }, `clipboard ${CLIP} MB`)];  // key: caption pieces coloured like the blocks, giving the code, document and clipboard sizes
            if (TALL) {  // tall layout: headings above and captions below
              const yb = Y0 + len;  // yb: the bottom of the bar
              kids.push(s('text', { x: 4, y: 15, 'font-size': 12.5, 'font-weight': 700 }, 'Each editor’s memory map'),  // heading above the editors
                s('text', { x: BX + BW, y: 15, 'text-anchor': 'end', 'font-size': 12.5, 'font-weight': 700 }, 'Main memory'),  // heading above the bar, right-aligned
                s('text', { x: 4, y: yb + 22, 'font-size': 12.5, class: 's-sub' }, `Bar = ${tot} MB, what private copies would need.`),  // first caption line under the bar: what its full length stands for
                s('text', { x: 4, y: yb + 40, 'font-size': 12.5, 'font-weight': 700, class: 's-sub' }, ...key));  // second caption line: the colour key
              svg.setAttribute('viewBox', `0 0 ${VW} ${yb + 48}`);  // sets the drawing's height to fit the bar and its captions
            } else kids.push(s('text', { x: 10, y: 262, 'font-size': 12.5, class: 's-sub' }, `Bar = ${tot} MB, what private copies would need: `, ...key));  // wide layout: one caption line under the bar, ending with the colour key
            svg.replaceChildren(...kids);  // swaps in the new drawing
            const priv = n * (CODE + DOC) + CLIP, sh = CODE + n * DOC + CLIP, now = shared ? sh : priv;  // priv: megabytes with private copies; sh: megabytes with one shared copy; now: whichever is chosen
            used.innerHTML = `<span class="big" style="font-size:30px">${now} MB</span><span class="small muted">in use</span>` +  // the readout: the megabytes in use, in large type
              (n === 1 ? '<span class="chip">one editor: nothing to share yet</span>' : shared ? `<span class="chip ok">saves ${priv - sh} MB = ${n - 1} × ${CODE} MB</span>` : `<span class="chip warn">${n} identical copies of the code</span>`);  // plus a tag: nothing to share with one editor, the saving with shared code, or a warning about identical copies
            Object.entries(ACTS).forEach(([k, a]) => (btns[k].disabled = n < a.need));  // switches off any access that needs more editors than are running
          }  // ends draw
          function doAct(k) {  // doAct(k): called when an access button is clicked: explains access k and redraws
            act = k;  // act: remembers it so draw can highlight its lines
            const msg = {  // msg: the explanation for each access
              run: `<span class="c-ok b">Allowed.</span> E1 fetches instructions from ${shared ? 'the <b>shared</b> code. All ' + n + ' editors do the same at once, each with its own registers, stack and document.' : 'its own copy of the code.'}`,  // run: allowed; E1 fetches from the shared code (all editors do, each with its own registers, stack and document) or from its own copy
              write: '<span class="c-bad b">Trap.</span> The code is marked execute-only (or read-only), so a write into it is refused. ' + (shared ? 'Shared code must never change while others run it.' : 'Code is protected this way even when private, which is also what makes it safe to share.'),  // write: trap; code is execute-only or read-only, so shared code never changes and private code is protected the same way
              peek: '<span class="c-bad b">Trap.</span> E2’s document is not in E1’s memory map at all. Sharing is <b>controlled</b>: only what was granted is shared.',  // peek: trap; E2's document is not in E1's memory map at all, which is what controlled sharing means
              clip: '<span class="c-ok b">Allowed.</span> E1 writes into the clipboard and E2 reads it. Both maps include it, read-write: cooperating processes sharing one data area.',  // clip: allowed; both maps include the clipboard, read-write: cooperating processes sharing one data area
            }[k];  // picks the message for k
            narr.innerHTML = msg;  // shows it in the narration box
            draw();  // redraws
          }  // ends doAct
          const btns = {};  // btns: the access buttons by name, filled in on the next line
          Object.entries(ACTS).forEach(([k, a]) => (btns[k] = h('button', { class: 'btn sm', onclick: () => doAct(k) }, a.btn)));  // makes one button per access, labelled from ACTS; a click runs doAct for it
          const seg = ctx.ui.seg([{ value: 'p', label: 'A private copy each' }, { value: 's', label: 'One shared copy' }], 's', (v) => {  // seg: a switch between a private copy of the code for each editor and one shared copy; starts on shared
            shared = v === 's'; act = null;  // on a change: stores the choice and clears the current access
            narr.innerHTML = shared ? '<b>One shared copy:</b> every editor’s map points at the same physical code. Each still has a private document.' : '<b>A private copy each:</b> the same 30 MB of instructions is loaded again for every editor.';  // narration explaining the chosen option
            draw();  // redraws
          });  // ends the switch
          const sl = ctx.ui.slider({ label: 'Editors running', min: 1, max: 5, value: n, onInput: (v) => {  // sl: slider for how many editors are running, 1 to 5; its handler starts here
            n = v; act = null;  // stores the new count and clears the current access
            narr.innerHTML = n === 1 ? '<b>One editor:</b> one copy of the code is all it needs, so there is nothing to share yet. Add editors.'  // narration for one editor: one copy is all it needs, so there is nothing to share yet
              : `<b>${n} editors running.</b> ` + (shared ? `One shared copy of the code serves all ${n}; each has a private document.` : `Each of the ${n} holds its own ${CODE} MB copy of the same code.`);  // for several editors: one shared copy serves them all, or each holds its own 30 MB copy
            draw();  // redraws
          } });  // ends the slider's handler and the slider
          narr.innerHTML = '<b>Three people edit three documents</b> with the same editor program. Switch between private and shared code, change the number of editors, and try the four accesses.';  // starting narration: three people editing three documents, and what to try
          draw();  // first drawing
          el.append(h('div', { class: 'split l fill' },  // lays out the slide in two columns filling the step
            h('div', { class: 'stack', style: { gap: '10px' } },  // left column: text stacked with 10px gaps
              h('p', { class: 'lead m0', html: 'Protection must not become a prison. Sometimes processes <b>should</b> reach the same memory:' }),  // opening sentence: protection must not become a prison, because sometimes processes should reach the same memory
              h('ul', { class: 'm0', html: '<li><b>Same program, many processes.</b> Ten people running one editor need one copy of its code, not ten: <span class="t">shared code</span>.</li><li><b>Cooperating processes.</b> Processes working together may share a data structure, such as a buffer.</li>' }),  // bullet list of the two cases: shared code for many processes running one program, and cooperating processes sharing data
              h('p', { class: 'm0', html: 'So the requirement is <span class="t">controlled sharing</span>: share what was granted, protect everything else.' }),  // names the requirement: controlled sharing, share what was granted and protect the rest
              h('div', { class: 'callout why m0 small', 'data-label': 'Why it is cheap', html: 'Every address a process uses already goes through <span class="t">address translation</span> for relocation. Let two processes’ translations lead to the same physical place, with suitable access rights, and they share it. The same machinery serves relocation, protection and sharing.' }),  // "Why it is cheap" callout: translation already exists for relocation, so leading two translations to one place shares it
              h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'Sharing the code does not share the data. Each editor keeps its own document, registers and stack, which is exactly what lets one copy of <span class="t">reentrant code</span> serve them all.' })),  // "Common mistake" callout: sharing the code does not share the data, which is what makes reentrant code work; closes the left column
            h('div', { class: 'card white stack', style: { gap: '8px', padding: '10px 12px' } },  // right column: a white card holding the model
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, seg, h('div', { style: { width: '250px' } }, sl)),  // header row: the private/shared switch on the left, the editors slider on the right in a 250px box
              svg, used,  // the drawing and the megabyte readout
              h('div', { class: 'row', style: { gap: '6px' } }, ...Object.values(btns)),  // a row with the four access buttons
              narr)));  // the narration box; closes the card and the layout
        },  // ends render for step 4
      },  // ends step 4
      /* ---------------- 5. Logical organization: flat memory vs modules ---------------- */
      {  // opens step 5, logical organization
        title: 'Logical organization: memory is flat, programs are modules',  // step 5 title
        kind: 'explore',  // kind 'explore': a hands-on slide
        render(el, ctx) {  // render(el, ctx): draws step 5 when the slide opens
          const { h, s } = ctx;  // takes the HTML builder h and the SVG builder s out of the toolbox
          const MODS = [  // MODS: the five modules of the example program: size in bytes, box width, colours, kind, rights, and the text shown when clicked
            { key: 'main', size: 1200, w: 150, cls: 's-proc', tx: 'tx-proc', kind: 'main program', rights: 'execute-only', info: 'The main program. It is code, so <b>execute-only</b>. It refers to the other modules by name; those references are resolved when the program is linked or run.' },  // module main: the main program, 1,200 bytes of execute-only code that names the other modules
            { key: 'sort', size: 400, grown: 700, w: 96, gw: 120, cls: 's-proc', tx: 'tx-proc', kind: 'library code', rights: 'execute-only', info: 'A library routine written by another team and compiled on its own. <b>Execute-only</b>, and one copy can be <b>shared</b> by every program that sorts.' },  // module sort: a 400-byte library routine that grows to 700 when rewritten (gw: its wider box then); execute-only and shareable
            { key: 'prices', size: 600, w: 100, cls: 's-mem', tx: 'tx-mem', kind: 'data table', rights: 'read-only', info: 'A table of 4-byte prices that the program only reads (so prices[20] is at offset 80). Marked <b>read-only</b>, so a buggy write traps instead of quietly corrupting the prices.' },  // module prices: a 600-byte read-only table of 4-byte prices, so a stray write traps
            { key: 'work', size: 800, w: 106, cls: 's-mem', tx: 'tx-mem', kind: 'working data', rights: 'read-write', info: 'Working data: <b>read-write</b>, private to this process.' },  // module work: 800 bytes of working data, read-write and private
            { key: 'stack', size: 400, w: 96, cls: 's-accent', tx: 'tx-acc', kind: 'stack', rights: 'read-write', info: 'The stack: <b>read-write</b> and private; it grows and shrinks as functions are called.' },  // module stack: 400 bytes, read-write and private
          ];  // closes MODS
          const REFS = [{ what: 'call sort', mod: 'sort', off: 0 }, { what: 'read prices[20]', mod: 'prices', off: 80 }, { what: 'write total', mod: 'work', off: 200 }];  // REFS: main's three references: call sort (offset 0), read prices[20] (offset 80), write total (offset 200 in work)
          let view = 'flat', grown = false, sel = null;  // view: flat memory or modules; grown: whether sort has been rewritten bigger; sel: the module last clicked
          const sizeOf = (m, g = grown) => (m.key === 'sort' && g ? m.grown : m.size);  // sizeOf(m, g): a module's size, using sort's grown size when g is true
          const starts = (g) => { const st = {}; let a = 0; MODS.forEach((m) => { st[m.key] = a; a += sizeOf(m, g); }); st.end = a; return st; };  // starts(g): each module's start address when laid end to end (plus st.end, the total), with sort grown or not
          const LINKED = starts(false);                      // flat addresses were fixed when main was linked
          const flatOf = (r) => LINKED[r.mod] + r.off;  // flatOf(r): the fixed address main holds for reference r: the module's start at link time plus the offset
          const modAt = (a) => { const st = starts(grown); return MODS.find((m) => a >= st[m.key] && a < st[m.key] + sizeOf(m)); };  // modAt(a): which module really sits at address a now, with the current sizes
          /* drawing geometry; a small screen gets a slimmer drawing with slimmer boxes so the labels stay readable */
          const W = ctx.narrow  // W: drawing sizes, one set for a small screen and one for a wide screen
            ? { vw: 330, vh: 236, x0: 16, fs: 12, tick: 11.5, ws: [66, 56, 56, 56, 56], gw: 64, gap: 5, a0: 14, da: 18, pad: 8 }  // small-screen set: canvas size, margin, font sizes, slimmer box widths, grown sort width, gap, arc start and spacing, padding
            : { vw: 640, vh: 214, x0: 20, fs: 13, tick: 12.5, ws: MODS.map((m) => m.w), gw: 120, gap: 16, a0: 40, da: 40, pad: 12 };  // wide-screen set: a wider canvas, each module's own box width and roomier spacing
          const svg = s('svg', { viewBox: `0 0 ${W.vw} ${W.vh}`, width: '100%' });  // the drawing
          const tbl = h('table', { class: 'tbl compact' });  // tbl: the table of the three references
          const info = h('div', { class: 'card tight small', style: { minHeight: '66px', lineHeight: '1.45' } });  // info: the box under the table that explains a clicked module or what growing sort did
          function arc(sx, tx, top, ok, k) {  // arc(sx, tx, top, ok, k): a numbered arrow that arches from x position sx up to height top and down to tx
            const col = ok ? 'ok' : 'bad';  // col: green when the reference lands in the right module, red otherwise
            return [s('path', { d: `M${sx},92 C${sx},${top} ${tx},${top} ${tx},90`, class: 's-line', style: `stroke:var(--${col})`, 'marker-end': `url(#arr-${col})` }),  // the arching curve, ending in an arrowhead
              s('circle', { cx: (sx + tx) / 2, cy: top + 16, r: 10, style: `fill:var(--panel);stroke:var(--${col})`, 'stroke-width': 2 }),  // a small circle at the top of the arc
              s('text', { x: (sx + tx) / 2, y: top + 21, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, class: ok ? 'tx-ok' : 'tx-bad' }, String(k + 1))];  // holding the reference's number, 1 to 3
          }  // ends arc
          function hot(m, ...kids) {  // hot(m, ...kids): wraps a module's shapes in one clickable group
            const g = s('g', { class: 'hot', tabindex: 0, role: 'button', 'aria-label': 'Module ' + m.key }, ...kids);  // the group: pointer cursor, reachable with the Tab key, announced as a button named after the module
            const go = () => { sel = m; draw(); };  // go(): selects module m and redraws
            g.addEventListener('click', go);  // a click selects it
            g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });  // Enter or Space also select it, for keyboard users; preventDefault stops Space from scrolling the page
            return g;  // returns the group
          }  // ends hot
          function draw() {  // draw(): redraws the picture, the table, the grow button and the info box
            const kids = [];  // kids collects the shapes
            if (view === 'flat') {  // flat view
              const st = starts(grown), SC = (W.vw - 2 * W.x0) / 3700, X = (a) => W.x0 + a * SC;  // st: start addresses; SC: pixels per byte (the row is scaled for 3,700 bytes); X(a): the x position of address a
              MODS.forEach((m) => kids.push(hot(m, s('rect', { x: X(st[m.key]), y: 92, width: sizeOf(m) * SC, height: 48, class: 's-panel', 'stroke-width': sel === m ? 3 : 1, style: sel === m ? 'stroke:var(--ink)' : '' }),  // each module is a plain grey box at its address (darker outline when selected), clickable
                s('text', { x: X(st[m.key] + sizeOf(m) / 2), y: 121, 'text-anchor': 'middle', 'font-size': W.fs, class: 's-sub' }, m.key))));  // its name, in grey: to the hardware every module looks the same
              [...new Set([...MODS.map((m) => st[m.key]), st.end])].forEach((a) => kids.push(s('text', { x: X(a), y: 158, 'text-anchor': 'middle', 'font-size': W.tick, class: 's-monot s-sub' }, String(a))));  // address marks at every module boundary and at the end; new Set removes repeats
              REFS.forEach((r, k) => { const t = flatOf(r), hit = modAt(t); kids.push(...arc(X(200 + k * 350), X(t), 60 - k * 20, hit && hit.key === r.mod, k)); });  // for each reference: the address main holds and the module really there, drawn as a numbered arc, green if right, red if wrong
              const l1 = ['One flat row of bytes, 0 to ' + st.end + '.', 'The names are only in the programmer’s head.'], l2 = ['One region, one set of rights: every byte', 'readable, writable and runnable by this program.'];  // l1, l2: the two captions: one flat row with names only in the programmer's head, and one region with one set of rights
              kids.push(mtext(s, W.vw / 2, ctx.narrow ? 180 : 184, ctx.narrow ? l1 : l1.join(' '), { 'text-anchor': 'middle', 'font-size': ctx.narrow ? 12.5 : 13.5, 'font-weight': 700 }, 16),  // the first caption in bold: two lines on a small screen, one joined line otherwise
                mtext(s, W.vw / 2, ctx.narrow ? 216 : 204, ctx.narrow ? l2 : l2.join(' '), { 'text-anchor': 'middle', 'font-size': ctx.narrow ? 12.5 : 13, class: 'tx-bad' }, 16));  // the second caption in red, two lines or one; closes the push
            } else {  // modules view
              const ws = MODS.map((m, i) => (m.key === 'sort' && grown ? W.gw : W.ws[i]));  // ws: each box's width; sort's box widens when it has grown
              let x = (W.vw - ws.reduce((a, b) => a + b, 0) - W.gap * 4) / 2;  // x: the starting position that centres the row of five boxes
              const pos = {};  // pos: where each module's box ended up, for the arcs
              MODS.forEach((m, i) => {  // for each module
                pos[m.key] = { x, w: ws[i] };  // records its box position and width
                /* a slim box shows name, size and the rights split over two lines; a wide one also names the kind of module */
                const body = ctx.narrow ? mtext(s, x + ws[i] / 2, 110, [m.key, String(sizeOf(m))], { 'text-anchor': 'middle', 'font-size': W.fs }, 16)  // body: on a small screen just the name and size
                  : mtext(s, x + ws[i] / 2, 112, [m.key, sizeOf(m) + ' bytes', m.kind], { 'text-anchor': 'middle', 'font-size': W.fs }, 17);  // on a wide screen the name, the size in bytes and the kind of module
                const rights = ctx.narrow ? m.rights.replace('-', '-\n').split('\n') : [m.rights];  // rights: on a small screen split after the hyphen onto two lines ("read-" then "only"), one line otherwise
                kids.push(hot(m, s('rect', { x, y: 92, width: ws[i], height: 96, rx: 10, class: m.cls, 'stroke-width': sel === m ? 3.5 : 1.5 }), body,  // the clickable box, rounded and coloured by kind, with a thicker outline when selected, plus its text
                  mtext(s, x + ws[i] / 2, ctx.narrow ? 162 : 178, rights, { 'text-anchor': 'middle', 'font-size': ctx.narrow ? 12 : 12.5, 'font-weight': 800, class: m.tx }, 15)));  // and the rights near the bottom, in bold colour
                x += ws[i] + W.gap;  // moves x past this box and the gap
              });  // ends the loop over modules
              REFS.forEach((r, k) => { const p = pos[r.mod], tx = p.x + W.pad + (r.off / sizeOf(MODS.find((m) => m.key === r.mod))) * (p.w - 2 * W.pad); kids.push(...arc(pos.main.x + W.a0 + k * W.da, tx, 60 - k * 20, true, k)); });  // for each reference: an arc from main to the right spot inside its module, placed by the offset; always green here
              const cap = ['Five modules, each with its own size', '(in bytes) and its own rights.'];  // cap: the caption split over two lines for a small screen
              kids.push(mtext(s, W.vw / 2, 208, ctx.narrow ? cap : 'Five modules, each with its own size and its own rights.', { 'text-anchor': 'middle', 'font-size': ctx.narrow ? 12.5 : 13.5, 'font-weight': 700 }, 16));  // draws the caption under the boxes: two lines, or one sentence on a wide screen
            }  // ends the choice of view
            svg.replaceChildren(...kids);  // swaps in the new drawing
            tbl.replaceChildren(h('tr', {}, h('th', {}, '#'), h('th', {}, 'In main'), h('th', {}, view === 'flat' ? 'Address (fixed at link)' : 'Address'), h('th', {}, 'Lands in')),  // rebuilds the table, starting with the header: #, In main, the address column (fixed at link in the flat view), Lands in
              ...REFS.map((r, k) => {  // then one row per reference
                const hit = view === 'flat' ? modAt(flatOf(r)) : MODS.find((m) => m.key === r.mod), ok = hit && hit.key === r.mod;  // hit: the module the reference lands in (flat view: whatever sits at the fixed address; modules view: the module it names); ok if intended
                return h('tr', {}, h('td', { class: 'b' }, String(k + 1)), h('td', { class: 'mono' }, r.what), h('td', { class: 'mono' }, view === 'flat' ? String(flatOf(r)) : `(${r.mod}, ${r.off})`),  // the row: its number, the instruction in main, and the address (a fixed number, or a (module, offset) pair)
                  h('td', { html: ok ? `<span class="chip ok">${hit.key} ✓</span>` : `<span class="chip bad">${hit ? hit.key : 'nothing'} ✗</span>` }));  // last cell: a green tag with the module it lands in, or a red tag naming the wrong module (or nothing)
              }));  // ends the rows and the table
            growBtn.textContent = grown ? `Undo: sort back to ${MODS[1].size}` : `Rewrite sort: ${MODS[1].size} → ${MODS[1].grown} bytes`;  // the grow button's text: rewrite sort from 400 to 700 bytes, or undo back to 400
            if (sel) info.innerHTML = `<b>${sel.key}</b> (${sel.kind}): ${sel.info}` + (view === 'flat' ? ' <span class="muted">In the flat view the hardware cannot see any of this.</span>' : '');  // info box: the clicked module's explanation, plus in the flat view a note that the hardware cannot see any of it
            else if (grown) {  // otherwise, if sort has grown
              const sm = MODS[1], d = sm.grown - sm.size;  // sm: the sort module; d: how many bytes it grew
              const broken = REFS.map((r, k) => [r, k, modAt(flatOf(r))]).filter(([r, , hit]) => !hit || hit.key !== r.mod)  // broken: the references whose fixed address now lands in the wrong module
                .map(([r, k, hit]) => `<span class="c-bad b">${k + 1}</span> (${r.what}) now lands in <b>${hit ? hit.key : 'nothing'}</b>`);  // each written as its number in red, what it does, and where it lands now
              info.innerHTML = view === 'flat'  // info box, flat view
                ? `<b>sort grew by ${d} bytes</b>, so everything after it moved ${d} bytes later. But main still holds the addresses fixed when it was linked: ${broken.join(' and ')}. Every module must be re-linked.`  // sort grew, everything after it moved d bytes, main still holds the old addresses (listing the broken ones), so everything must be re-linked
                : `<b>sort grew</b>, but each reference names a module and an offset, such as (${REFS[1].mod}, ${REFS[1].off}). Nothing else moves or changes: only sort itself is recompiled.`;  // modules view: each reference names a module and an offset, so only sort itself is recompiled
            }  // ends the grown case
            else info.innerHTML = '<b>Click any module.</b> <span class="muted">In the flat view a <span class="t">linker</span> laid the modules end to end and turned main’s references into fixed addresses. Press “Rewrite sort” in each view and compare what happens to them.</span>';  // otherwise the starting hint: click a module, and press "Rewrite sort" in each view to compare
          }  // ends draw
          const growBtn = h('button', { class: 'btn sm primary', onclick: () => { grown = !grown; sel = null; draw(); } });  // growBtn: makes sort grow or shrink back, clears the selection and redraws; draw sets its text
          const seg = ctx.ui.seg([{ value: 'flat', label: 'Flat memory' }, { value: 'mod', label: 'Modules' }], view, (v) => { view = v; draw(); });  // seg: a switch between the flat-memory view and the modules view; changing it redraws
          draw();  // first drawing
          el.append(h('div', { class: 'split l fill' },  // lays out the slide in two columns filling the step
            h('div', { class: 'stack', style: { gap: '10px' } },  // left column: text stacked with 10px gaps
              h('p', { class: 'lead m0', html: 'Memory hardware sees one long, flat row of bytes. Nobody writes programs that way.' }),  // opening sentence: the hardware sees one flat row of bytes, but nobody writes programs that way
              h('p', { class: 'm0', html: 'Programs are built from <span class="t">modules</span>: a main program, library routines, data tables. <span class="t">Logical organization</span> means memory management that understands modules, so that:' }),  // paragraph: programs are built from modules, and logical organization means memory management that understands them
              h('ul', { class: 'm0', html: '<li>modules are <b>written and compiled independently</b>, their cross-references resolved at run time;</li><li>each module gets its own <span class="t">access rights</span> (read-only, execute-only, read-write);</li><li>a single module can be <b>shared</b> between processes.</li>' }),  // bullet list of the three benefits: independent compiling, per-module rights, per-module sharing
              h('div', { class: 'callout analogy m0 small', 'data-label': 'Analogy', html: 'Pages numbered straight through versus per chapter. Add a page to chapter 2 and every later “see page 140” breaks; “chapter 5, page 3” still works.' }),  // analogy callout: pages numbered straight through versus numbered per chapter
              h('div', { class: 'callout tip m0 small', 'data-label': 'Coming up', html: 'The tool that fits this best is <span class="t">segmentation</span> (section 7.4): each module becomes its own segment, and an address names a segment plus an offset.' })),  // "Coming up" callout: segmentation (section 7.4) fits this best; closes the left column
            h('div', { class: 'card white stack', style: { gap: '8px', padding: '10px 12px' } },  // right column: a white card holding the model
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, seg, growBtn), svg, tbl, info)));  // header row with the view switch and grow button, then the drawing, the table and the info box; closes the layout
        },  // ends render for step 5
      },  // ends step 5
      /* ---------------- 6. Physical organization: the overlay lab ---------------- */
      {  // opens step 6, physical organization
        title: 'Physical organization: who moves things between memory and disk?',  // step 6 title
        kind: 'lab',  // kind 'lab': labels the slide "Hands-on Lab"
        render(el, ctx) {  // render(el, ctx): draws step 6 when the slide opens
          const { h, s } = ctx;  // takes the HTML builder h and the SVG builder s out of the toolbox
          const MAIN = 20, TOTAL = 64;                   // KB: main always stays in memory; the planned free space is 64 KB
          const MODS = { L: { name: 'L: load', size: 14 }, C: { name: 'C: compute', size: 30 }, P: { name: 'P: print', size: 16 } };  // MODS: the three overlay modules and their sizes in KB: L (load, 14), C (compute, 30) and P (print, 16)
          const CALLS = ['L', 'C', 'P', 'C', 'P'];  // CALLS: the order in which main calls the modules
          let free = 64, loaded, idx, loads, crashes;  // free: KB free for the program (64 as planned, 48 on a busy day); loaded: modules in the overlay area; idx: the next call; counters
          const cap = () => free - MAIN;                 // the overlay area: what is left after main
          const usedKB = () => loaded.reduce((a, k) => a + MODS[k].size, 0);  // usedKB(): how many KB the loaded modules take up
          /* fewest disk loads that can finish CALLS with this overlay area (dynamic programming over what is loaded) */
          function fewest(capKB) {  // fewest(capKB): the smallest number of disk loads that can finish CALLS with an overlay area of capKB, or Infinity if none can
            const keys = Object.keys(MODS), fits = (m) => keys.reduce((a, k, i) => a + (m >> i & 1 ? MODS[k].size : 0), 0) <= capKB;  // keys: the module letters; a set of loaded modules is stored as bits (bit i on = module i loaded); fits(m): whether set m fits
            const bits = (m) => keys.reduce((a, k, i) => a + (m >> i & 1), 0);  // bits(m): how many modules are in set m
            let dp = new Map([[0, 0]]);  // dp (dynamic programming, building the answer one call at a time): fewest loads to reach each set; it starts empty at cost 0
            for (const c of CALLS) {  // for each call, in order
              const need = 1 << keys.indexOf(c), nd = new Map();  // need: the bit of the module this call needs; nd: the table after this call
              for (let m2 = 0; m2 < 8; m2++) {  // tries all 8 possible sets of the three modules
                if (!(m2 & need) || !fits(m2)) continue;  // skips sets that lack the called module or do not fit
                for (const [m, cost] of dp) { const v = cost + bits(m2 & ~m); if (!nd.has(m2) || v < nd.get(m2)) nd.set(m2, v); }  // cost of going from set m to m2: loads for the modules in m2 not already in m; keeps the cheapest way to reach m2
              }  // ends the loop over sets
              if (!nd.size) return Infinity;  // no set works: this call can never be made, so the plan cannot run
              dp = nd;  // moves on with the new table
            }  // ends the loop over calls
            return Math.min(...dp.values());  // the answer: the cheapest way to have finished every call
          }  // ends fewest
          const VW = ctx.narrow ? 360 : 600;              // a slimmer drawing on a small screen keeps its labels readable
          const svg = s('svg', { viewBox: `0 0 ${VW} 158`, width: '100%' });  // the drawing, 158 units tall
          const calls = h('div', { class: 'row', style: { gap: '6px' } });  // calls: the row of chips that tracks progress through the calls
          const score = h('div', { class: 'row', style: { gap: '6px' } });  // score: the row with the disk-load and crash counters
          const narr = h('div', { class: 'card tight small', style: { minHeight: '68px', lineHeight: '1.45' } });  // narr: the narration box
          const modBtns = {};  // modBtns: the load/unload buttons by module, filled in further down
          function draw() {  // draw(): redraws memory and disk, the call chips, the counters and the buttons
            const sc = (VW - 20) / TOTAL, X = (kb) => 10 + kb * sc;  // sc: pixels per KB; X(kb): the x position of a point kb kilobytes in
            const kids = [  // kids: the parts of the picture that are always there
              s('text', { x: 10, y: 16, 'font-size': 13, 'font-weight': 700 }, 'Main memory free for this program'),  // heading above the memory bar
              s('rect', { x: X(0), y: 24, width: MAIN * sc, height: 46, rx: 5, class: 's-proc', 'stroke-width': 2 }),  // main's block, always at the start, in teal
              s('text', { x: X(MAIN / 2), y: 52, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, class: 'tx-proc' }, `main (${MAIN} KB)`),  // its label, "main (20 KB)"
              s('rect', { x: X(MAIN), y: 24, width: cap() * sc, height: 46, rx: 5, class: 's-panel', 'stroke-width': 1.5, 'stroke-dasharray': '5 4' }),  // the overlay area after main: a dashed outline as wide as cap()
            ];  // closes the fixed parts
            let at = MAIN;  // at: where the next loaded module goes, right after main
            loaded.forEach((k) => {  // for each loaded module
              kids.push(s('rect', { x: X(at) + 2, y: 28, width: MODS[k].size * sc - 4, height: 38, rx: 4, class: 's-mem', 'stroke-width': 2 }),  // a green block inside the overlay area
                s('text', { x: X(at + MODS[k].size / 2), y: 52, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, class: 'tx-mem' }, `${k} (${MODS[k].size} KB)`));  // its label with its size
              at += MODS[k].size;  // moves at past it
            });  // ends the loop over loaded modules
            if (free < TOTAL) kids.push(s('rect', { x: X(free), y: 24, width: (TOTAL - free) * sc, height: 46, rx: 5, class: 's-bad', 'stroke-width': 1.5 }),  // on a busy day: a red block at the end for memory other processes are using
              s('text', { x: X((free + TOTAL) / 2), y: 52, 'text-anchor': 'middle', 'font-size': 12.5, class: 'tx-bad' }, ctx.narrow ? 'others' : 'used by others today'));  // labelled "used by others today" ("others" on a small screen)
            kids.push(s('text', { x: X(MAIN) + 4, y: 86, 'font-size': 12.5, class: 's-sub' }, `overlay area: ${cap()} KB, ${cap() - usedKB()} KB empty`),  // under the bar: the overlay area's size and how much of it is empty
              s('text', { x: 10, y: 112, 'font-size': 13, 'font-weight': 700 }, 'On disk (secondary memory)'));  // heading for the disk row
            let dx = 0;  // dx: the running position along the disk row
            Object.entries(MODS).forEach(([k, m]) => {  // for each module on disk
              kids.push(s('rect', { x: X(dx), y: 120, width: m.size * sc - 6, height: 32, rx: 5, class: 's-io', 'stroke-width': 1.5 }),  // an orange block, sized to scale
                s('text', { x: X(dx) + (m.size * sc - 6) / 2, y: 141, 'text-anchor': 'middle', 'font-size': 13, class: 'tx-io' }, ctx.narrow ? `${k} (${m.size} KB)` : `${m.name} (${m.size} KB)`));  // its label: the letter and size on a small screen, the full name and size otherwise
              dx += m.size;  // moves dx past it
            });  // ends the loop over modules on disk
            svg.replaceChildren(...kids);  // swaps in the new drawing
            calls.replaceChildren(h('span', { class: 'small b' }, 'main calls:'), ...CALLS.map((c, i) => h('span', { class: 'chip ' + (i < idx ? 'ok' : i === idx ? 'accent' : '') }, (i < idx ? '✓ ' : i === idx ? '▶ ' : '') + c)));  // call chips: green with a check mark when done, accent with a play arrow for the next call, plain for later calls
            score.innerHTML = `<span class="chip io">disk loads ${loads}</span><span class="chip ${crashes ? 'bad' : ''}">crashes ${crashes}</span>`;  // counters: disk loads, and crashes, whose chip turns red after the first crash
            Object.entries(modBtns).forEach(([k, b]) => { const on = loaded.includes(k); b.textContent = (on ? 'Unload ' : 'Load ') + k; b.classList.toggle('on', on); });  // each module button reads "Load" or "Unload" and is lit while its module is loaded
            runBtn.disabled = idx >= CALLS.length;  // "Make the next call" is switched off once every call is done
          }  // ends draw
          function toggle(k) {  // toggle(k): loads or unloads module k when its button is clicked
            if (loaded.includes(k)) { loaded = loaded.filter((x) => x !== k); narr.innerHTML = `${k} removed from the overlay area (its copy on disk stays). No disk time needed.`; }  // already loaded: removes it; no disk time is needed because its copy on disk stays
            else if (usedKB() + MODS[k].size <= cap()) { loaded.push(k); loads++; narr.innerHTML = `${k} copied from disk into the overlay area: one slow disk load. Every load is a line of code <b>you</b> had to write.`; }  // room for it: adds it, counts a disk load, and points out that every load is a line the programmer wrote
            else narr.innerHTML = `<span class="c-bad b">No room.</span> ${k} needs ${MODS[k].size} KB but only ${cap() - usedKB()} KB of the ${cap()} KB overlay area is empty. ` + (MODS[k].size > cap() ? `${k} is bigger than the whole area: <b>this overlay plan cannot run with ${free} KB free.</b> The programmer would have to redesign it.` : 'Unload something first.');  // no room: explains; if k is bigger than the whole area, this plan cannot run with this much free memory, otherwise unload first
            draw();  // redraws
          }  // ends toggle
          function call() {  // call(): makes main's next call when "Make the next call" is clicked
            const c = CALLS[idx];  // c: the module the next call needs
            if (loaded.includes(c)) {  // if that module is loaded
              idx++;  // the call works; move on to the next one
              narr.innerHTML = `<span class="c-ok b">✓</span> main calls ${c}, and ${c} is in memory.` + (idx >= CALLS.length  // narration: main calls c and c is in memory; after the last call it adds a summary
                ? ` <b>Finished:</b> ${loads} disk loads, ${crashes} crash${crashes === 1 ? '' : 'es'}. The fewest loads possible is ${fewest(cap())}. Now picture this by hand for a program with fifty modules.` : '');  // the summary: loads and crashes, the fewest loads possible (from fewest), and a nudge to picture fifty modules
            } else {  // if it is not loaded
              crashes++;  // counts a crash
              narr.innerHTML = `<span class="c-bad b">Crash!</span> main jumps to where ${c} should start, but the overlay area holds ${loaded.length ? loaded.join(' and ') : 'no module, only leftover bytes'}. The processor runs whatever is there as if it were ${c}. You forgot to load ${c}.`;  // narration: main jumps into whatever the overlay area holds and runs it as if it were c, because the load was forgotten
            }  // ends the loaded or not choice
            draw();  // redraws
          }  // ends call
          function reset() {  // reset(): empties the overlay area and the counters; runs at the start, on "Start over" and when the free memory changes
            loaded = []; idx = 0; loads = 0; crashes = 0;  // nothing loaded, back to the first call, both counters at zero
            const best = fewest(cap());  // best: the fewest loads possible with today's free memory
            narr.innerHTML = best === Infinity  // starting narration, which depends on whether the plan can work at all
              ? `<b>Only ${free} KB is free today.</b> The overlay area shrinks to ${cap()} KB, but C alone needs ${MODS.C.size} KB. Try to load C.`  // impossible: only 48 KB is free, so the overlay area is too small for C; it invites the student to try
              : `<b>The whole program needs ${MAIN + MODS.L.size + MODS.C.size + MODS.P.size} KB; only ${free} KB is free.</b> main stays put; L, C and P must take turns in the ${cap()} KB overlay area. Load what each call needs, then make the call.`;  // possible: the whole program needs 80 KB but less is free, so L, C and P must take turns while main stays put
            draw();  // redraws
          }  // ends reset
          Object.keys(MODS).forEach((k) => (modBtns[k] = h('button', { class: 'btn sm mem', onclick: () => toggle(k) }, 'Load ' + k)));  // builds one green "Load" button per module; a click runs toggle for it
          const runBtn = h('button', { class: 'btn sm primary', onclick: call }, 'Make the next call');  // runBtn: the main button, which makes the next call
          const seg = ctx.ui.seg([{ value: 64, label: '64 KB free (as planned)' }, { value: 48, label: '48 KB free (busy day)' }], free, (v) => { free = v; reset(); });  // seg: a switch between 64 KB free (as planned) and 48 KB free (a busy day); changing it stores free and starts over
          reset();  // sets up the starting state and the first drawing
          el.append(h('div', { class: 'split l fill' },  // lays out the slide in two columns filling the step
            h('div', { class: 'stack', style: { gap: '10px' } },  // left column: text stacked with 10px gaps
              h('p', { class: 'lead m0', html: 'Storage comes in two levels:' }),  // opening sentence: storage comes in two levels
              h('table', { class: 'tbl compact', html: '<tr><th></th><th>Main memory</th><th>Secondary memory</th></tr><tr><td class="b">Speed</td><td>fast</td><td>slow</td></tr><tr><td class="b">Cost per byte</td><td>high</td><td>low</td></tr><tr><td class="b">Without power</td><td>contents lost (<span class="t" data-t="volatile memory">volatile</span>)</td><td>contents kept</td></tr><tr><td class="b">Size</td><td>smaller</td><td>much larger</td></tr>' }),  // comparison table of main and secondary memory: speed, cost per byte, what happens without power, size
              h('p', { class: 'm0', html: 'Information must keep moving between the two. <span class="t">Physical organization</span> says the <b>OS</b> must do that moving, not the programmer, for two reasons:' }),  // paragraph: physical organization says the OS must do the moving, not the programmer, for two reasons
              h('ol', { class: 'm0 small', html: '<li>A program and its data may not fit in the memory available. The old fix, <span class="t">overlays</span>, is tedious and error-prone. Try it.</li><li>With multiprogramming, the programmer cannot know how much memory will be free when the program runs. Switch to the busy day.</li>' }),  // numbered list of the two reasons: the program may not fit (overlays), and free memory cannot be known in advance
              h('div', { class: 'callout tip m0 small', 'data-label': 'Coming up', html: 'With <span class="t">virtual memory</span> (chapter 8) the OS brings pieces in from disk by itself, as they are touched. The program just calls its functions.' })),  // "Coming up" callout: with virtual memory (chapter 8) the OS brings pieces in by itself; closes the left column
            h('div', { class: 'card white stack', style: { gap: '8px', padding: '10px 12px' } },  // right column: a white card holding the lab
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'Overlay lab: you are the programmer'), seg),  // header row: the lab heading on the left and the free-memory switch on the right
              svg,  // the drawing
              h('div', { class: 'row', style: { gap: '6px' } }, ...Object.values(modBtns), h('span', { style: { flex: 1 } }), score),  // a row with the module buttons, a stretchy spacer, then the counters at the right
              h('div', { class: 'row', style: { gap: '8px' } }, calls, h('span', { style: { flex: 1 } }), runBtn, h('button', { class: 'btn sm ghost', onclick: reset }, 'Start over')),  // a row with the call chips, a spacer, the call button and a quiet "Start over" button
              narr,  // the narration box
              h('div', { class: 'xs b muted' }, 'WHAT EVERY LOAD LOOKED LIKE IN THE SOURCE CODE'),  // a small grey heading over the shown code
              listing(ctx, [['load_overlay("L");', 'by hand: bring L in from disk'], ['read_input();', 'a function inside L'],  // shown code, lines 1-2: the hand-written load of L, then a function inside L
                ['load_overlay("C");', 'by hand again, before compute()'], ['compute();', 'inside C: forget a load and it crashes']], { fontSize: 13 }))));  // shown code, lines 3-4: the hand-written load of C, then compute(), which crashes if that load is forgotten; closes the layout
        },  // ends render for step 6
      },  // ends step 6
      /* ---------------- 7. Which requirement is it? (classification game) ---------------- */
      {  // opens step 7, the classification game
        title: 'Name that requirement: ten real situations',  // step 7 title
        kind: 'predict',  // kind 'predict': labels the slide "Predict"
        render(el, ctx) {  // render(el, ctx): draws step 7 when the slide opens
          const { h } = ctx;  // takes only the HTML builder h; this step has no drawing
          const REQS = ['Relocation', 'Protection', 'Sharing', 'Logical organization', 'Physical organization'];  // REQS: the five requirement names, which are also the labels of the answer buttons
          const ABOUT = [  // ABOUT: what each requirement is about, used in the feedback for a wrong pick and on the cheat sheet
            'a program working wherever it is placed, even after it moves.',  // about relocation: working wherever the program is placed
            'keeping each process out of memory that is not its own.',  // about protection: staying out of other memory
            'letting several processes use the same memory on purpose.',  // about sharing: several processes using the same memory on purpose
            'memory that follows the modules a program is built from.',  // about logical organization: memory that follows the modules
            'moving information between main memory and disk, done by the OS.',  // about physical organization: the OS moving information between memory and disk
          ];  // closes ABOUT
          const ASK = ['did it move, or is its final address unknown?', 'is a process reaching memory that is not its own?', 'do several processes want the same memory?', 'is it about the program’s modules?', 'is it about memory versus disk, or too little memory?'];  // ASK: one question per requirement that the student can ask about a situation, shown on the cheat sheet
          const SC = [  // SC: the ten situations, each [description, number of the right requirement (0-4), explanation]
            ['A process is swapped out and later comes back to a different part of memory. Its jump instructions must still land in its own code.', 0, 'Its location changed, so every reference must be translated to the new place.'],  // situation 1 (relocation): a swapped-out process comes back elsewhere and its jumps must still land in its own code
            ['A program follows a pointer built from user input. If the pointer leads into another process’s memory, the access must be stopped.', 1, 'Blocking a reference to someone else’s memory, at the moment it happens, is protection.'],  // situation 2 (protection): a pointer built from input must not reach another process's memory
            ['Forty students on one server run the same compiler at once, and the server keeps just one copy of the compiler’s instructions in memory.', 2, 'One copy of code used by many processes is sharing.'],  // situation 3 (sharing): forty students run one compiler from a single copy of its code
            ['A program plus its data is twice the size of the memory free for it.', 4, 'Something must move parts between disk and memory, and that should be the OS’s job.'],  // situation 4 (physical organization): a program plus its data is twice the free memory
            ['A developer fixes a bug in one module of a large program and wants to recompile just that module, not the whole program.', 3, 'Compiling modules independently needs memory that understands modules.'],  // situation 5 (logical organization): recompiling just the one module that was fixed
            ['A compiler cannot know which address the program will be loaded at, so it numbers every address from 0.', 0, 'Addresses counted from the program’s start must be turned into physical ones wherever it lands.'],  // situation 6 (relocation): the load address is unknown, so the compiler counts addresses from 0
            ['Two cooperating processes exchange results through one buffer that both can read and write.', 2, 'Cooperating processes using one data structure is sharing (controlled: only that buffer).'],  // situation 7 (sharing): two cooperating processes trade results through one buffer
            ['A user program must never be able to overwrite the OS’s interrupt handlers, even by accident.', 1, 'Keeping a process out of the OS’s memory is protection, enforced by hardware.'],  // situation 8 (protection): a user program must never overwrite the OS's interrupt handlers
            ['A program’s math library module is marked execute-only, while its working-data module stays read-write.', 3, 'Giving each module of one program its own rights is what organizing memory by modules makes possible. (Protection, by contrast, is about reaching memory that is not your own.)'],  // situation 9 (logical organization): rights per module; its explanation also says how this differs from protection
            ['On a busy day a program finds less free memory than its author planned for, so the OS must decide which parts stay in main memory.', 4, 'The programmer cannot know how much memory will be free, so the OS manages the two levels.'],  // situation 10 (physical organization): less free memory than planned, so the OS decides which parts stay in memory
          ];  // closes SC
          let i, firstTry, tried, done;  // i: the situation shown; firstTry: per situation, whether the first pick was right; tried: picks made on this one; done: solved
          const prog = h('div', { class: 'row', style: { gap: '5px' } });  // prog: the progress row of numbered chips
          const card = h('div', { class: 'card', style: { fontSize: '20px', lineHeight: '1.5', minHeight: '172px', display: 'flex', alignItems: 'center' } });  // card: the large box that shows the situation
          const fb = h('div', { class: 'card tight', style: { minHeight: '120px', lineHeight: '1.5', fontSize: '16px' } });  // fb: the feedback box
          const btns = REQS.map((r, k) => h('button', { class: 'btn', style: { height: '58px', whiteSpace: 'normal', lineHeight: '1.2' }, onclick: () => pick(k) }, r));  // btns: one tall answer button per requirement (its text may wrap); a click calls pick
          const next = h('button', { class: 'btn primary', onclick: () => { if (i < SC.length - 1) { i++; tried = new Set(); done = false; show(); } } }, 'Next situation →');  // next: the "Next situation" button; moves on and clears the picks unless this is the last situation
          function show() {  // show(): redraws the card, the buttons, the progress row and the next button
            card.innerHTML = `<div><span class="xs b muted">SITUATION ${i + 1} OF ${SC.length}</span><br>${SC[i][0]}</div>`;  // card: "SITUATION n OF 10" in small grey capitals, then the description
            btns.forEach((b, k) => { b.className = 'btn' + (done && k === SC[i][1] ? ' ok-b' : tried.has(k) && k !== SC[i][1] ? ' bad-b' : ''); b.setAttribute('aria-pressed', done && k === SC[i][1] ? 'true' : 'false'); });  // button colours: green on the right answer once solved, red on wrong picks; aria-pressed tells screen readers which is right
            prog.replaceChildren(...SC.map((_, k) => h('span', { class: 'chip ' + (firstTry[k] === true ? 'ok' : firstTry[k] === false ? 'bad' : k === i ? 'accent' : '') }, String(k + 1))));  // progress chips: green for right first time, red for wrong first time, accent for the current situation
            const right = firstTry.filter((x) => x === true).length, answered = firstTry.filter((x) => x != null).length;  // right: how many were right on the first try; answered: how many have been answered at all
            prog.append(h('span', { class: 'small muted', style: { marginLeft: '6px' } }, `first-try right: ${right} of ${answered}`));  // adds that running score after the chips
            next.disabled = !done || i >= SC.length - 1;  // "Next" stays off until this situation is solved, and on the last one
            if (!done && !tried.size) fb.innerHTML = '<span class="muted">Which requirement does this situation illustrate? Pick one of the five.</span>';  // before any pick: a grey prompt in the feedback box
          }  // ends show
          function pick(k) {  // pick(k): handles a click on answer button k
            if (done) return;  // ignores clicks once the situation is solved
            const [, ans, why] = SC[i];  // ans: the right answer's number; why: its explanation
            if (firstTry[i] == null) firstTry[i] = k === ans;  // records whether the first pick for this situation was right
            tried.add(k);  // remembers this pick so its button can turn red if it was wrong
            if (k === ans) {  // a right pick
              done = true;  // marks the situation solved
              fb.innerHTML = `<span class="c-ok b">Yes: ${REQS[ans]}.</span> ${why}` + (i === SC.length - 1 ? ` <b>All done:</b> ${firstTry.filter((x) => x).length} of ${SC.length} right on the first try.` : '');  // feedback: a green "Yes" with the requirement and the explanation, plus the final first-try score after the last situation
            } else fb.innerHTML = `<span class="c-bad b">Not ${REQS[k]}.</span> That requirement is about ${ABOUT[k]} Look again: what problem does this situation describe?`;  // a wrong pick: a red "Not" with what that requirement is about, and a nudge to look again
            show();  // redraws
          }  // ends pick
          function reset() { i = 0; firstTry = SC.map(() => null); tried = new Set(); done = false; show(); }  // reset(): back to situation 1 with nothing answered; runs at the start and from "Start over"
          reset();  // sets up the starting state
          el.append(h('div', { class: 'split r fill' },  // lays out the slide in two columns, the left one wider
            h('div', { class: 'stack', style: { gap: '12px' } }, prog, card,  // left column: the progress row and the situation card
              h('div', { style: { display: 'grid', gridTemplateColumns: ctx.narrow ? 'repeat(2, minmax(0, 1fr))' : 'repeat(5, minmax(0, 1fr))', gap: '8px' } }, ...btns), fb,  // the five answer buttons in a grid, five across (two across on a small screen), then the feedback box
              h('div', { class: 'row', style: { gap: '8px' } }, next, h('button', { class: 'btn ghost', onclick: reset }, 'Start over'))),  // a row with the "Next situation" button and a quiet "Start over" button; closes the left column
            h('div', { class: 'card stack', style: { gap: '8px' } }, h('h4', { class: 'm0' }, 'Cheat sheet: each requirement is about…'),  // right column: the cheat-sheet card with its heading
              ...REQS.map((r, k) => h('div', { class: 'small', html: `<b class="c-acc">${k + 1}. ${r}</b><br>${ABOUT[k].charAt(0).toUpperCase() + ABOUT[k].slice(1)}<br><span class="muted"><i>Ask:</i> ${ASK[k]}</span>` })))));  // one entry per requirement: its numbered name, what it is about (first letter capitalised) and the question to ask; closes the layout
        },  // ends render for step 7
      },  // ends step 7
      /* ---------------- 8. Recap ---------------- */
      {  // opens step 8, the recap
        title: 'Recap: the five requirements and why each exists',  // step 8 title
        kind: 'recap',  // kind 'recap': labels the slide "Recap" and puts it on the core path
        render(el, ctx) {  // render(el, ctx): draws step 8 when the slide opens
          const { h } = ctx;  // takes only the HTML builder h; this step has no drawing
          const flipAll = (on) => ctx.$$('.flip').forEach((c) => c.classList.toggle('on', on));  // flipAll(on): turns every flip card in this step face up (true) or face down (false); ctx.$$ finds them all
          el.append(h('div', { class: 'stack fill', style: { gap: '12px' } },  // lays out the recap in a column that fills the step
            h('div', { class: 'row', style: { gap: '8px' } }, h('span', { class: 'small b' }, 'The five requirements, in order:'),  // a row with a lead-in label
              ...['Relocation', 'Protection', 'Sharing', 'Logical organization', 'Physical organization'].map((t, i) => h('span', { class: 'chip accent' }, (i + 1) + '. ' + t))),  // and one accent chip per requirement, numbered in order; closes the row
            h('div', { class: 'row', style: { gap: '8px' } }, h('p', { class: 'm0 muted small grow' }, 'Say each answer out loud before you flip the card. Click a card again to flip it back.'),  // a row with the instruction: say each answer aloud before flipping
              h('button', { class: 'btn sm', onclick: () => flipAll(true) }, 'Flip all'), h('button', { class: 'btn sm ghost', onclick: () => flipAll(false) }, 'Hide all')),  // the "Flip all" and "Hide all" buttons; closes the row
            ctx.ui.flipcards([  // the flip cards, each [front question, back answer]
              ['What is memory management, and why does it matter?', 'The OS dividing the user part of memory among processes, on the fly, as they come and go. Keeping enough ready processes in memory is what keeps the processor busy.'],  // card: what memory management is and why it keeps the processor busy
              ['1. Relocation', 'Nobody knows where a program will load, and swapping may move it. Its relative addresses are translated to the right physical addresses at run time (for example, base + relative).'],  // card: relocation and run-time translation
              ['2. Protection', 'No process may touch another’s memory, or the OS’s, without permission. Addresses exist only at run time, so every reference is checked as it happens.'],  // card: protection and why each reference is checked as it happens
              ['Why must hardware do the protection check?', 'The OS cannot foresee computed addresses, it is not even running while the process runs, and checking each reference in software would make programs many times slower.'],  // card: why the protection check has to be done in hardware
              ['3. Sharing', 'Controlled: one copy of shared code for many processes, or a data area cooperating processes use together. Translation makes it cheap; protection still blocks the rest.'],  // card: controlled sharing of code and data
              ['4. Logical organization', 'Memory is a flat row of bytes, but programs are modules. Module-aware memory gives independent compiling, per-module rights and per-module sharing. Best fit: segmentation.'],  // card: logical organization and its best fit, segmentation
              ['5. Physical organization', 'Main memory is fast, costly and volatile; secondary memory is slow, cheap and permanent. The OS, not the programmer, moves information between them.'],  // card: physical organization and the two levels of storage
              ['What was wrong with overlays?', 'Programmers loaded modules into a shared region by hand: tedious, a missed load crashes, and the plan assumed a memory size nobody can know under multiprogramming.'],  // card: what was wrong with overlays
            ], { cols: ctx.narrow ? 2 : 4, height: 214 })));  // closes the card list: four columns (two on a small screen), each card 214px tall; closes the layout
        },  // ends render for step 8
      },  // ends step 8
      /* ---------------- 9. Quiz ---------------- */
      {  // opens step 9, the quiz
        title: 'Check yourself: memory management requirements',  // step 9 title
        kind: 'check',  // kind 'check': labels the slide "Check Yourself"
        quiz: [  // quiz: the questions; the guide draws each one, grades it and keeps the best score
          { q: 'In a multiprogramming system, why does good memory management help keep the processor busy?',  // question 1 (multiple choice): why good memory management keeps the processor busy
            choices: ['It makes each process’s instructions execute faster, because its code and data are kept closer to the processor.', 'It lets one processor execute instructions from several processes at the same instant, one per memory region.', 'More ready processes fit in memory, so one is likely to be able to run whenever the others wait for I/O.', 'It removes the need for processes to wait for I/O, because the data they need is already in main memory.'],  // four choices; the right one says more ready processes fit, so one can run while the others wait
            answer: 2,  // answer: the number of the right choice, counting from 0 (the third)
            feedback: ['Memory management does not change how fast an instruction runs; it decides how many processes are available to run.', 'A single processor still runs one instruction stream at a time, however memory is divided. Memory management only keeps more candidates ready.', null, 'Processes still wait for disk, network and keyboard transfers. Memory management just makes it likely that another ready process is in memory meanwhile.'],  // feedback: a hint for each wrong choice; null marks the right one
            why: 'The processor idles only when every process in memory is waiting. Fitting more ready processes into memory makes that moment rarer.' },  // why: the explanation shown after answering
          { type: 'num', q: 'A process image was compiled with every address counted from its own first byte. It is now loaded starting at physical address 14,000. One of its branch instructions targets relative address 2,350. Which physical address must the branch actually reach?', answer: 16350, tol: 0,  // question 2 (number): a branch to relative 2,350 in an image loaded at 14,000; tol 0 means the answer must be exact
            why: 'With run-time relocation the hardware adds the start of the process’s current region to the relative address: 14,000 + 2,350 = 16,350.' },  // explanation: base plus relative address
          { type: 'tf', q: 'In a multiprogramming system, a programmer can know in advance the physical address at which a program will run.', answer: false,  // question 3 (true or false): whether a programmer can know the physical address in advance (false)
            why: 'Where a program lands depends on what else is in memory when it is loaded, and swapping may later bring it back somewhere else. That is why relocation is needed.' },  // explanation: the location depends on what else is in memory, and swapping can move it
          { q: 'Why can memory references not be checked for protection once and for all when the program is compiled?',  // question 4 (multiple choice): why protection cannot be checked once, at compile time
            choices: ['Compilers are not allowed to read the addresses inside a program, since only the OS may decide which addresses a process may use.', 'Many addresses are computed while the program runs (array indexes, pointers), and its location is unknown until it is loaded and may change.', 'Checking at compile time would make the program file too large to load, since a stored check would have to sit beside every address.', 'The OS’s own memory moves every time a process is created, so a check made at compile time would test against the wrong region.'],  // four choices; the right one names computed addresses and the unknown load location
            answer: 1,  // answer: the second choice
            feedback: ['Compilers produce the addresses themselves, and nothing hides them; the trouble is that many are not final until run time.', null, 'Size is not the issue: the information a check needs (computed addresses, the load location) simply does not exist yet at compile time.', 'The OS normally stays put; it is user processes whose locations are unknown and changing, and many of their addresses are computed at run time.'],  // feedback for each wrong choice
            why: 'Relocation means the physical addresses are unknown until load time, and computed addresses such as a[i] exist only during execution. So each reference is checked as it happens.' },  // explanation: addresses are unknown until load time, and computed ones exist only while running
          { q: 'Who must check each memory reference for protection while a program runs, and why?',  // question 5 (multiple choice): who checks each reference while the program runs, and why
            choices: ['The OS, because only the OS knows which memory each process owns, so it can inspect each reference before the access is made.', 'The compiler, because it generates every memory reference and can therefore prove that each one stays inside the program’s region.', 'The program itself, because it knows which addresses it means to use and can test each of its pointers before following it.', 'The processor hardware, because the OS cannot foresee every computed address and a software check on each reference would be too slow.'],  // four choices: the OS, the compiler, the program itself, or the processor hardware
            answer: 3,  // answer: the fourth choice, the hardware
            feedback: ['The OS sets up the rules (for example by loading the base and bounds registers), but running OS code on every reference would slow programs enormously.', 'The compiler cannot know addresses that are computed at run time, or where the program will be placed, so it can prove nothing about them.', 'A buggy or malicious program cannot be trusted to police itself: a bad pointer is exactly what its own test would get wrong.', null],  // feedback on why the OS, the compiler and the program cannot do it
            why: 'Every instruction fetch and data access is a memory reference. Only hardware can check that many references at full speed, alongside the access itself.' },  // explanation: only hardware can check every reference at full speed
          { type: 'tf', q: 'A base-and-bounds hardware check stops a process from overwriting its own variables through an out-of-range array index.', answer: false,  // question 6 (true or false): whether base and bounds stop a process damaging its own variables (false)
            why: 'The check only asks whether the address lies inside the process’s own region. An index that strays into the same process’s other data is still allowed: a bug in that process, but other processes and the OS stay safe.' },  // explanation: the check only asks whether the address is inside the process's own region
          { type: 'num', q: 'Eight users run the same web browser at once. Its code takes 120 MB and each user’s private data takes 40 MB. How many megabytes are saved by keeping one shared copy of the code instead of eight private copies?', answer: 840, tol: 0, unit: 'MB',  // question 7 (number, in MB): the saving when eight users share one copy of a 120 MB browser
            why: 'Private copies need 8 × 120 = 960 MB of code; one shared copy needs 120 MB. The saving is 960 − 120 = 840 MB (7 × 120). The 40 MB of private data per user is needed either way.' },  // explanation: 8 × 120 minus 120; the private data is needed either way
          { type: 'multi', q: 'Which statements about sharing memory are correct?',  // question 8 (choose all that apply): which statements about sharing are correct
            choices: ['Several processes running the same program can share one copy of its code.', 'Cooperating processes may share a data structure, such as a buffer.', 'Once two processes share some memory, protection no longer applies between them.', 'The translation mechanisms that support relocation also make sharing easy.', 'Each process should modify the shared code to suit its own data.'],  // five statements, three of them true
            answer: [0, 1, 3],  // answer: the first, second and fourth statements
            why: 'Sharing is controlled: only the granted region is shared and everything else stays protected. Shared code must never be modified while in use, so each process keeps its own data elsewhere.' },  // explanation: sharing is controlled and shared code is never modified
          { type: 'match', q: 'Match each memory-management requirement to the situation that illustrates it.',  // question 9 (matching): each requirement to the situation that illustrates it
            pairs: [['Relocation', 'A swapped-out process returns to a different region and must still run correctly'], ['Protection', 'A stray pointer must not reach another process’s memory'], ['Sharing', 'Twenty users run one editor from a single copy of its code'], ['Logical organization', 'A library module is compiled on its own and marked execute-only'], ['Physical organization', 'A program bigger than the free memory must have parts moved between disk and memory']],  // the five [requirement, situation] pairs
            why: 'Moving means relocation; another process’s memory means protection; one copy for many means sharing; modules mean logical organization; memory versus disk means physical organization.' },  // explanation: the key word that points to each requirement
          { type: 'bucket', q: 'Sort each property into the level of storage it describes.', buckets: ['Main memory', 'Secondary memory'],  // question 10 (sort into groups): properties of main memory versus secondary memory
            items: [['Fast to access', 0], ['Loses its contents when the power is off', 0], ['Higher cost per byte', 0], ['Slow to access', 1], ['Keeps its contents without power', 1], ['Lower cost per byte', 1]],  // six properties, each with its group (0 = main memory, 1 = secondary memory)
            why: 'Main memory is fast, expensive and volatile; secondary memory (disks, solid-state drives) is slower, cheaper and permanent. That trade-off is why both levels exist.' },  // explanation: the speed, cost and volatility trade-off that makes both levels exist
          { type: 'multi', q: 'Why should the OS, rather than the programmer, move information between main memory and secondary memory?',  // question 11 (choose all that apply): why the OS, not the programmer, should move information between the levels
            choices: ['A program and its data may not fit in the memory available, and overlays are tedious and error-prone to write.', 'Under multiprogramming, the programmer cannot know how much memory will be free when the program runs.', 'Secondary memory is volatile, so only the OS may use it.', 'Programs are never allowed to read files from disk.'],  // four choices, two of them true
            answer: [0, 1],  // answer: the first two
            why: 'These are the two classic reasons. Secondary memory is permanent, not volatile, and programs read files all the time through the OS; the point is who manages main memory’s contents.' },  // explanation: the two classic reasons, and what is wrong with the other two choices
          { q: 'Which technique matches the logical organization requirement most closely?',  // question 12 (multiple choice): which technique best matches logical organization
            choices: ['Swapping', 'Overlaying', 'Segmentation', 'Uniprogramming'],  // four choices: swapping, overlaying, segmentation, uniprogramming
            answer: 2,  // answer: the third choice, segmentation
            feedback: ['Swapping moves whole processes to disk and back; it says nothing about a program’s modules.', 'Overlaying is a programmer-managed answer to programs that do not fit; it is about physical organization, and a painful one.', null, 'Uniprogramming just means one program at a time; it does not organize memory by modules.'],  // feedback on why swapping, overlaying and uniprogramming do not fit
            why: 'Segmentation divides a program into variable-length segments that match its modules, each with its own size and access rights, and each shareable on its own.' },  // explanation: segments match a program's modules, each with its own size and rights
        ],  // closes the quiz
      },  // ends step 9
    ],  // closes the list of steps
    notes: `${/* notes: the section's reading notes, HTML written as text, shown when the student opens the Notes panel */''}
<h3>Why memory management exists</h3>${/* notes heading: why memory management exists */''}
<p>With <b>uniprogramming</b>, main memory has two parts: one for the operating system and one for the single program running now. With <b>multiprogramming</b>, the user part must be divided among many processes, and the division keeps changing as processes start, finish, block and are swapped out. Doing that dividing dynamically is <b>memory management</b>, and it is the OS’s job.</p>${/* notes paragraph: uniprogramming versus multiprogramming, and memory management as the OS's job */''}
<p>It matters for performance: a process waiting for I/O cannot use the processor, so the processor stays busy only if memory holds enough ready processes. A rough model: if each of n processes independently waits for I/O a fraction w of the time, the processor is idle only when all n wait at once, so it is busy 1 − w<sup>n</sup> of the time. Example: w = 0.8 gives 20% busy with one process, 1 − 0.8<sup>4</sup> ≈ 59% with four, and about 74% with six.</p>${/* notes paragraph: the performance argument, with the rough 1 - w to the n model and a worked example */''}

<h3>The five requirements</h3>${/* notes heading: the five requirements */''}
<p>Any memory-management scheme must provide, in this order: (1) relocation, (2) protection, (3) sharing, (4) logical organization, (5) physical organization.</p>${/* notes paragraph: lists the five requirements in order */''}

<h4>1. Relocation</h4>${/* notes heading for requirement 1, relocation */''}
<p>The programmer cannot know where a program will sit in memory when it runs, and a process that is swapped out may come back to a different place. So a program’s memory references (its entry point, branch targets, data references and stack) are written as <b>relative addresses</b>, counted from the start of its process image, and each one must be translated to the right <b>physical address</b> at run time.</p>${/* notes paragraph: why relative addresses must be translated to physical ones at run time */''}
<p><b>Example.</b> Process P’s image is 2,000 bytes: process control information (relative 0–199), program (200–1,199, entry point 200), data (1,200–1,599) and stack (1,600–1,999). A branch at relative 400 says <i>jump 920</i>. Loaded at 2,000, the branch must reach 2,000 + 920 = 2,920. P is swapped out, a new process S takes 2,000–3,999, and P returns at 6,000. With run-time translation the code is unchanged and the hardware adds the new base: 6,000 + 920 = 6,920, still inside P. If the addresses had instead been fixed once at the first load, the code would still say <i>jump 2,920</i>, which now lies inside S: P would run S’s instructions. Re-patching every address on each swap-in is impractical because addresses also live in registers and on the stack.</p>${/* notes worked example: P moving from 2,000 to 6,000, with run-time translation versus addresses fixed at load */''}

<h4>2. Protection</h4>${/* notes heading for requirement 2, protection */''}
<p>A process must not reference memory belonging to another process, or to the OS, without permission. Addresses cannot be checked once at compile time, for two reasons: because of relocation the physical addresses are unknown until the program is loaded and change when it moves, and many addresses are computed while the program runs (array indexes, pointers). So <b>every memory reference must be checked as it happens</b>, and the check must be done by the <b>processor hardware</b>, not by OS software: the OS cannot anticipate every reference, and running OS code for each one would be far too slow.</p>${/* notes paragraph: why every reference is checked as it happens, and by hardware rather than OS software */''}
<p><b>Example (base and bounds, named here, detailed in 7.2).</b> P occupies 6,000–7,999, so its base register holds 6,000 and its bounds register 8,000. The statement x = a[i] with a at relative 1,300 and 4-byte elements uses relative address 1,300 + 4i. For i = 3: 1,312 → 7,312, allowed. For i = 60: 1,540 → 7,540, allowed, because it is still inside P (a bug in P, but it only hurts P). For i = 200: 2,100 → 8,100, outside the region: the hardware traps to the OS. Protection keeps a process out of other memory; it does not stop it from damaging its own data.</p>${/* notes worked example: base and bounds checking x = a[i] for i = 3, 60 and 200 */''}
<p><b>Cost of software checking (rough model).</b> Each instruction makes about 1.5 memory references (its own fetch plus a data access about half the time). If each check cost C OS instructions, every instruction would cost about 1 + 1.5C instruction times: with C = 40, about 61 times slower. And the OS is not even running while the process runs: the processor executes the process’s instructions directly, and the OS gets control back only after an interrupt or a trap, so a software check would mean stopping the process before every single access.</p>${/* notes paragraph: the rough cost model for checking every reference in software */''}

<h4>3. Sharing</h4>${/* notes heading for requirement 3, sharing */''}
<p>Protection must still allow <b>controlled sharing</b>. Several processes running the same program should share one copy of its code rather than each holding a copy, and cooperating processes may need to share a data structure such as a buffer. Shared code must not be modified while in use; each process keeps its own data, registers and stack. The mechanisms that support relocation also support sharing: each process’s addresses are translated anyway, so two translations can lead to the same physical region, while everything not granted stays protected.</p>${/* notes paragraph: controlled sharing of code and data, and why the relocation machinery makes it cheap */''}
<p><b>Example.</b> Three editors, code 30 MB, each document 6 MB, a shared 4 MB clipboard. Private copies: 3 × (30 + 6) + 4 = 112 MB. One shared code copy: 30 + 3 × 6 + 4 = 52 MB, saving 60 MB = (3 − 1) × 30 MB. A write into the shared code traps (it is execute-only); reading another editor’s document traps (it is not in the reader’s map).</p>${/* notes worked example: three editors needing 112 MB with private code but 52 MB with shared code */''}

<h4>4. Logical organization</h4>${/* notes heading for requirement 4, logical organization */''}
<p>Main memory is a flat, one-dimensional sequence of bytes or words, but programs are built from <b>modules</b> (main program, library routines, data tables). If memory management understands modules: modules can be written and compiled independently, with references between them resolved at run time; each module can get its own access rights (read-only, execute-only, read-write); and modules can be shared between processes. The tool that matches this best is <b>segmentation</b> (section 7.4).</p>${/* notes paragraph: modules, the three benefits of module-aware memory, and segmentation as the best fit */''}
<p><b>Example.</b> Modules main (1,200 bytes), sort (400), prices (600), work (800), stack (400) laid end to end: main’s references read prices at 1,680 and write work at 2,400. If sort grows to 700 bytes, everything after it shifts by 300: 1,680 now falls inside sort and 2,400 inside prices, so every module must be re-linked. With module-relative references such as (prices, 80), nothing else changes.</p>${/* notes worked example: five modules laid end to end, and what breaks when sort grows */''}

<h4>5. Physical organization</h4>${/* notes heading for requirement 5, physical organization */''}
<table>${/* notes table comparing the two levels of storage */''}
<tr><th></th><th>Main memory</th><th>Secondary memory</th></tr>${/* table header row: main memory and secondary memory */''}
<tr><td>Speed</td><td>fast</td><td>slow</td></tr>${/* table row: speed */''}
<tr><td>Cost per byte</td><td>high</td><td>low</td></tr>${/* table row: cost per byte */''}
<tr><td>Without power</td><td>contents lost (volatile)</td><td>contents kept (permanent)</td></tr>${/* table row: what happens without power */''}
<tr><td>Size</td><td>smaller</td><td>much larger</td></tr>${/* table row: size */''}
</table>${/* ends the notes table */''}
<p>Information must move between the two levels, and that movement cannot be left to the programmer: (1) a program plus its data may not fit in the memory available, and the old fix, <b>overlaying</b> (modules that are never needed together take turns in one region, loaded by the program itself; later tools could insert the loads, but the programmer still had to plan which modules share the region), is tedious and error-prone; (2) under multiprogramming the programmer does not know how much space will be available. So the OS must manage the movement (virtual memory, chapter 8, is how it does so).</p>${/* notes paragraph: why the OS, not the programmer, must move information between the levels (overlays, unknown free space) */''}
<p><b>Example.</b> main (20 KB, always resident) plus modules L (14 KB), C (30 KB) and P (16 KB) need 80 KB; with 64 KB free, the overlay area is 44 KB. L and C fit together (44 KB), C and P do not (46 KB). The calls L, C, P, C, P need at least 5 disk loads, and any forgotten load makes main jump into the wrong code. On a busy day with only 48 KB free, the overlay area is 28 KB and C (30 KB) cannot fit at all: the hand-made plan breaks.</p>`,  // notes worked example: the overlay lab's numbers on a planned day and a busy day; end of the notes text
  });  // closes the section description and the Guide.section call
})();  // ends the wrapper function and runs it right away
