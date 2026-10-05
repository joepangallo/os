// Comment key: a line inside backtick text ends with ${/* comment */''}, an empty-string slot that holds a comment without changing the text on screen (full note at the top of the page).
/* =====================================================================
   6.8  Linux Kernel Concurrency Mechanisms
   Real-time signals for programs; inside the kernel: atomic operations,
   spinlocks (and their interrupt-safe variants), kernel semaphores and
   mutexes, reader-writer locks, memory barriers and RCU.
   Original teaching material. Helpers shared by several steps live in
   this IIFE, so nothing leaks into the global scope.
   ===================================================================== */
(() => {  // wraps the whole section in an arrow function that runs once, right away, so its helper names stay private to this file

  /* Narration box: say(tone, html) with tone '', 'ok', 'bad', 'warn' or 'info'. */
  function verdict(ctx, cls) {  // verdict(ctx, cls): builds the narration box that explains each move in words; cls adds an optional extra class
    const el = ctx.h('div', { class: 'vbox ' + (cls || ''), 'aria-live': 'polite' });  // the box is a div styled as "vbox"; aria-live="polite" makes screen readers read each new message aloud
    el.say = (tone, html) => { el.className = 'vbox ' + (tone || '') + (cls ? ' ' + cls : ''); el.innerHTML = html; };  // el.say(tone, html): swaps the box colour to the tone (ok green, bad red, warn amber, info blue) and shows the new message
    return el;  // hands the finished narration box back to the caller
  }  // ends verdict

  /* A labelled value cell (memory word or register). set(v, flash) updates it. */
  function cell(ctx, name, cls) {  // cell(ctx, name, cls): builds a labelled box showing one value, such as a memory word or a CPU register
    const v = ctx.h('div', { class: 'v' });  // v is the inner div that holds the big value text
    const el = ctx.h('div', { class: 'cell ' + (cls || '') }, ctx.h('div', { class: 'nm', html: name }), v);  // the outer box: the name label (class nm) on top and the value underneath; cls can tint it as a CPU or kernel box
    el.set = (val, flash) => {  // el.set(val, flash): writes a new value into the box and, if flash is true, briefly highlights it
      v.innerHTML = String(val);  // shows the value as text; String() turns numbers into text first
      if (flash) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }  // restarts the flash animation: remove the class, read offsetWidth to force the browser to notice, then add it back
    };  // ends el.set
    return el;  // hands the finished value box back to the caller
  }  // ends cell

  /* Small button helper: every clickable thing is a real <button>. */
  function btn(ctx, label, onclick, cls) {  // btn(ctx, label, onclick, cls): makes a real button element so every control works with the keyboard too
    return ctx.h('button', { class: 'btn ' + (cls || 'sm'), type: 'button', onclick, html: label });  // returns the button with its label and click handler; it is small ("sm") unless another style is given in cls
  }  // ends btn

  /* A code listing with a gutter for CPU markers. marks({ 2: [0, 1] }) puts the
     C0 and C1 pointers on line 2 and tints that line. */
  function listing(ctx, src, o) {  // listing(ctx, src, o): shows C code with a thin gutter in front of each line where CPU markers can appear
    const pre = ctx.ui.code(src, Object.assign({ lang: 'c', fontSize: 13.5 }, o || {}));  // builds the coloured, numbered code listing with the guide's code helper, C colouring and 13.5-pixel text by default
    const lines = Array.from(pre.querySelectorAll('.ln'));  // collects every line element of the listing (each line is a span with class ln) into an ordinary array
    const guts = lines.map((ln) => { const g = ctx.h('span', { class: 'gut' }); ln.prepend(g); return g; });  // puts an empty gutter span at the start of every line and keeps a list of them, one per line
    pre.marks = (map) => {  // pre.marks(map): places the CPU markers; map says which CPUs sit on which line number
      lines.forEach((ln, k) => {  // goes through every line of the listing, with k as its position (0 for line 1)
        const who = (map && map[k + 1]) || [];  // who lists the CPU numbers whose next line is this one, or an empty list if none
        guts[k].innerHTML = who.map((c) => `<i class="mk c${c}">C${c}</i>`).join('');  // fills this line's gutter with one coloured tag per CPU, such as C0 or C1
        ln.classList.toggle('on1', who.length === 1);  // tints the line in that CPU's colour when exactly one CPU is on it
        ln.classList.toggle('on2', who.length > 1);  // uses a neutral grey tint instead when both CPUs are on the same line
        ln.dataset.who = who.length === 1 ? who[0] : '';  // records which single CPU is on the line so the stylesheet can pick its colour
      });  // ends the loop over lines
    };  // ends pre.marks
    return pre;  // hands the listing (with its new marks function) back to the caller
  }  // ends listing

  /* Tab 1 of the atomic step: two CPUs increment one counter, the student picks the interleaving. */
  function atomicRace(panel, ctx) {  // atomicRace(panel, ctx): builds the first tab of the atomic step, where two CPUs race to add 1 to one counter
    const { h } = ctx;  // takes the HTML builder h out of ctx so it can be written as just h(...)
    const SRC = {  // SRC: the two code listings the student can switch between
      plain: `reg = count;       // LOAD: copy count into this CPU's register${/* shown code, line 1: LOAD copies the shared count into this CPU's own register */''}
reg = reg + 1;     // ADD: change the private copy only${/* shown code, line 2: ADD changes only the private copy in the register */''}
count = reg;       // STORE: write the copy back to memory`,  // shown code, line 3: STORE writes the copy back to memory; the backtick ends the plain listing
      atomic: `atomic_inc(&count); // load, add and store as ONE step`,  // the atomic listing: one line, atomic_inc, which does the load, add and store as a single step
    };  // closes the SRC table
    const START = 5;  // START: the value count holds before either CPU runs
    let S, code, gen = 0, busy = false;  // S holds the whole race state, code is the current listing, gen counts resets so old replays stop, busy blocks clicks
    const codeBox = h('div');  // codeBox: the empty box the current code listing is placed in
    const cCount = cell(ctx, 'count (memory)');  // cCount: the value box for the shared count in memory
    const cReg = [cell(ctx, 'CPU 0 reg', 'cpu'), cell(ctx, 'CPU 1 reg', 'cpu')];  // cReg: one register box per CPU, tinted in the CPU colour
    const where = [h('span', { class: 'xs muted' }), h('span', { class: 'xs muted' })];  // where: one small grey label per CPU that says which line it will run next
    const bRun = [0, 1].map((c) => btn(ctx, `CPU ${c}: run next line`, () => !busy && act(c), 'sm cpu'));  // bRun: one button per CPU that runs that CPU's next line, unless a replay is running
    const tally = h('div', { class: 'small' });  // tally: the line that compares how many increments finished with what count now holds
    const say = verdict(ctx);  // say: the narration box that explains each move
    const hist = h('div', { class: 'log', style: { height: '140px' } });  // hist: a scrolling 140-pixel log that records the order the student chose
    const seg = ctx.ui.seg([{ value: 'plain', label: 'int count; count++' }, { value: 'atomic', label: 'atomic_t count; atomic_inc' }], 'plain', (m) => reset(m));  // seg: the two-way switch between plain count++ and atomic_inc; changing it starts the race over in that mode
    const lines = () => (S.mode === 'plain' ? 3 : 1);  // lines(): how many lines each CPU must run: 3 for plain count++, 1 for atomic_inc
    function reset(mode) {  // reset(mode): starts the race over in the chosen mode
      gen++; busy = false;  // bumps gen so any replay still waiting stops, and allows clicks again
      S = { mode, pc: [0, 0], reg: ['–', '–'], count: START, done: 0 };  // fresh state: both CPUs at line 0, empty registers, count at START, no increments done yet
      code = listing(ctx, SRC[mode]);  // builds the listing for this mode
      codeBox.replaceChildren(code);  // puts the new listing in its box, replacing the old one
      hist.replaceChildren(h('div', { class: 'ph' }, 'The order you choose is recorded here.'));  // clears the history log and shows a grey placeholder line
      paint(['info', mode === 'plain'  // draws everything and shows the opening message for this mode
        ? `<b>You are the scheduler.</b> count starts at ${START}. Each CPU runs the three steps of <code>count++</code>. Choose who runs next and try to make the final value wrong.`  // opening message for plain mode: you are the scheduler; try to make the result wrong
        : `<b>Now with atomic_inc.</b> count starts at ${START}. Each CPU has one indivisible step (on x86, a single instruction with a <code>lock</code> prefix that holds other CPUs off that word until it is done). Try any order.`]);  // opening message for atomic mode: each CPU has one indivisible step (a locked instruction on x86); try any order
    }  // ends reset
    function paint(v) {  // paint(v): redraws the markers, value boxes, buttons and tally; v is an optional [tone, message] for the narration box
      const map = {};  // map will hold, for each line number, the CPUs that will run it next
      [0, 1].forEach((c) => { if (S.pc[c] < lines()) (map[S.pc[c] + 1] = map[S.pc[c] + 1] || []).push(c); });  // adds each unfinished CPU to the list for its next line (pc is 0-based, line numbers start at 1)
      code.marks(map);  // draws the CPU markers in the listing
      cCount.set(S.count); cReg[0].set(S.reg[0]); cReg[1].set(S.reg[1]);  // shows the current count and both register values
      [0, 1].forEach((c) => {  // for each CPU, updates its label and its button
        const fin = S.pc[c] >= lines();  // fin is true once this CPU has run every line
        where[c].textContent = fin ? 'finished' : `next: line ${S.pc[c] + 1}`;  // the label says finished or which line comes next
        bRun[c].disabled = fin || busy;  // greys out the button once the CPU is done or while a replay is running
      });  // ends the per-CPU loop
      const want = START + S.done;  // want: what count should be after the increments that have finished
      tally.innerHTML = `Increments finished: <b>${S.done}</b> · count should be <b>${want}</b>, it is <b style="color:var(--${S.count === want ? 'ok' : 'bad'})">${S.count}</b>`;  // tally line: finished increments, the expected value, and the real value in green if it matches or red if not
      if (v) say.say(v[0], v[1]);  // shows the message in the narration box if one was given
    }  // ends paint
    function act(c) {  // act(c): runs the next line for CPU c and works out what to say about it
      const o = 1 - c, pc = S.pc[c];  // o is the other CPU; pc is the line CPU c is about to run
      let v;  // v will hold the [tone, message] for the narration box
      if (S.mode === 'atomic') {  // atomic mode: the whole increment happens in one step
        const before = S.count;  // remembers count before the step so the message can show old and new values
        S.count++; S.done++; S.reg[c] = '–';  // adds 1 to count and to the finished tally; the register is unused in this mode, so it shows a dash
        v = ['ok', `CPU ${c} runs <code>atomic_inc</code>: count goes ${before} → ${S.count} in one indivisible step. CPU ${o} can act only before or after it, never in the middle.`];  // message: count went up in one indivisible step, so the other CPU can act only before or after it
      } else if (pc === 0) {  // plain mode, line 1 (LOAD): this CPU copies count into its register
        S.reg[c] = S.count;  // the register now holds whatever count says right now
        const risky = S.pc[o] === 1 || S.pc[o] === 2;  // risky is true if the other CPU has already loaded but not yet stored, so both now share the same old value
        const seen = S.pc[o] === 2 ? S.reg[o] - 1 : S.reg[o];  // seen: the value the other CPU loaded; if it already ran ADD, its register is one higher than what it loaded
        v = [risky ? 'warn' : 'info', `CPU ${c} loads count = ${S.count} into its register.` + (risky ? ` CPU ${o} already loaded ${seen} and has not stored yet, so both are now working from the same old value.` : ' Memory still says ' + S.count + '.')];  // amber warning when both CPUs now hold the same stale value, otherwise a plain blue note about the load
      } else if (pc === 1) {  // plain mode, line 2 (ADD): only the private copy changes
        S.reg[c] = S.reg[c] + 1;  // adds 1 to this CPU's register; memory is untouched
        v = ['info', `CPU ${c} adds 1 to its private copy: reg = ${S.reg[c]}. Memory has not changed.`];  // message: the register went up but memory has not changed
      } else {  // plain mode, line 3 (STORE): the copy goes back to memory
        S.count = S.reg[c]; S.done++;  // writes the register into count and counts one more finished increment
        const lost = S.count !== START + S.done;  // lost is true when count no longer equals START plus the finished increments, meaning an update vanished
        v = lost ? ['bad', `<b>Lost update.</b> CPU ${c} stores ${S.count}, computed from a stale load. ${S.done} increments finished, so count should be ${START + S.done}, but it is ${S.count}. One CPU's work vanished: a <span class="t">race condition</span>.`]  // red "Lost update" message that names the race condition and shows the expected and real values
          : ['info', `CPU ${c} stores ${S.count} back to count.`];  // otherwise a plain note that the CPU stored its value
      }  // ends the choice between the three plain-mode lines and atomic mode
      S.pc[c]++;  // moves this CPU on to its next line
      const ph = hist.querySelector('.ph'); if (ph) ph.remove();  // removes the grey placeholder from the history log the first time something is recorded
      const what = S.mode === 'atomic' ? `atomic_inc → count = ${S.count}` : ['', `LOAD → reg = ${S.reg[c]}`, `ADD → reg = ${S.reg[c]}`, `STORE → count = ${S.count}`][S.pc[c]];  // what: the short history entry for this move, picked by mode and by which line was just run
      hist.append(h('div', { class: v[0] === 'bad' ? 'bad' : '' }, `CPU ${c}: ${what}`));  // adds the entry to the history log, in red if it caused a lost update
      hist.scrollTop = hist.scrollHeight;  // scrolls the log to the bottom so the newest entry is visible
      if (S.pc[0] >= lines() && S.pc[1] >= lines() && S.count === START + S.done) {  // if both CPUs have finished and count is right...
        v = ['ok', `<b>Both finished and count = ${S.count}: correct.</b> ` + (S.mode === 'plain' ? 'This order happened to be safe: one CPU finished its store before the other loaded. Try another order.' : 'With atomic_inc every order gives the right answer.')];  // ...the message becomes a green success: in plain mode it was a lucky order, in atomic mode every order works
      }  // ends the success check
      paint(v);  // redraws everything with the chosen message
    }  // ends act
    async function replay() {  // replay(): plays a known bad order by itself, one move every 0.7 seconds; async lets it pause with await
      const mode = S.mode;  // remembers the current mode so the replay uses the same listing
      reset(mode); busy = true; paint();  // starts over, blocks the student's clicks while the replay runs, and redraws
      const g = gen;  // g remembers which reset this replay belongs to, so a later reset can stop it
      const seq = mode === 'plain' ? [0, 1, 0, 1, 0, 1] : [0, 1];  // the order to play: in plain mode the CPUs alternate every line, the classic lost update; in atomic mode just one each
      for (const c of seq) { await ctx.sleep(700); if (!ctx.alive || g !== gen) return; act(c); }  // waits 0.7 seconds before each move and quits if the slide was left or the race was reset meanwhile
      busy = false; paint();  // when the replay ends, the buttons work again and everything is redrawn
    }  // ends replay
    reset('plain');  // starts the tab in plain count++ mode
    panel.append(h('div', { class: 'stack gap-s' },  // builds the tab's layout as a vertical stack and adds it to the panel
      h('div', { class: 'row gap-s' }, seg, h('span', { class: 'grow' }), btn(ctx, 'Replay an unlucky order', () => replay()), btn(ctx, 'Reset', () => reset(S.mode), 'sm ghost')),  // top row: the mode switch, a spacer, then the Replay and Reset buttons on the right
      codeBox,  // the code listing with CPU markers
      h('div', { class: 'racegrid' },  // a three-column grid: CPU 0, CPU 1 and the shared count side by side
        h('div', { class: 'stack gap-s' }, cReg[0], bRun[0], where[0]),  // CPU 0 column: its register, its run button and its next-line label
        h('div', { class: 'stack gap-s' }, cReg[1], bRun[1], where[1]),  // CPU 1 column: the same three items for the second CPU
        h('div', { class: 'stack gap-s' }, cCount, h('span', { class: 'xs muted' }, 'shared by both CPUs'))),  // third column: the shared count box with a note that both CPUs use it; closes the grid
      tally, say, hist));  // below the grid: the tally line, the narration box and the history log; closes the stack
    return () => { gen++; };  // hands back a tidy-up function that bumps gen, so a running replay stops when the student leaves this tab
  }  // ends atomicRace

  /* Tab 2 of the atomic step: a console for the atomic_t integer operations. */
  function atomicInts(panel, ctx) {  // atomicInts(panel, ctx): builds the second tab, a console for trying each atomic_t integer operation
    const { h } = ctx;  // takes the HTML builder h out of ctx
    const INIT = 5;  // INIT: the starting value of v
    let v = INIT, i = 3;  // v is the simulated atomic_t value; i is the amount the operations add or subtract, set by the slider
    const T = (b) => (b ? '<b style="color:var(--ok)">true</b>' : '<b style="color:var(--bad)">false</b>');  // T(b): writes a true or false return value as bold green or red text
    const OPS = [  // OPS: one entry per atomic_t operation: a key, the call text to show, and run(), which does it and explains it
      { k: 'read', call: () => 'atomic_read(&v)', run: () => ({ ret: v, why: 'Returns the current value. It only reads, so nothing changes.' }) },  // atomic_read: returns the value without changing it
      { k: 'set', call: () => `atomic_set(&v, ${i})`, run: () => { v = i; return { why: `Overwrites v with ${i}. Note the order: the pointer first, the value second.` }; } },  // atomic_set: overwrites v; its message points out the argument order, pointer first then value
      { k: 'add', call: () => `atomic_add(${i}, &v)`, run: () => { v += i; return { why: `Adds ${i}. Here the amount comes first and the pointer second.` }; } },  // atomic_add: adds i; its message points out the amount comes first here
      { k: 'sub', call: () => `atomic_sub(${i}, &v)`, run: () => { v -= i; return { why: `Subtracts ${i}.` }; } },  // atomic_sub: subtracts i
      { k: 'inc', call: () => 'atomic_inc(&v)', run: () => { v++; return { why: 'Adds 1: the classic atomic counter.' }; } },  // atomic_inc: adds 1, the usual atomic counter
      { k: 'dec', call: () => 'atomic_dec(&v)', run: () => { v--; return { why: 'Subtracts 1.' }; } },  // atomic_dec: subtracts 1
      { k: 'subt', call: () => `atomic_sub_and_test(${i}, &v)`, run: () => { v -= i; return { ret: v === 0, why: `Subtracts ${i}, then reports whether the result is exactly 0. The subtract and the test are one step, so no other CPU can change v in between.` }; } },  // atomic_sub_and_test: subtracts i and returns true if the result is exactly 0, all in one step
      { k: 'addn', call: () => `atomic_add_negative(${i}, &v)`, run: () => { v += i; return { ret: v < 0, why: `Adds ${i}, then reports whether the result is negative.` }; } },  // atomic_add_negative: adds i and returns true if the result is below 0
      { k: 'dect', call: () => 'atomic_dec_and_test(&v)', run: () => { v--; return { ret: v === 0, why: 'Subtracts 1 and reports whether that made v exactly 0. As a reference count: the caller that gets true was the last user and frees the object.' }; } },  // atomic_dec_and_test: subtracts 1 and returns true at 0; the message ties it to reference counts and freeing
      { k: 'inct', call: () => 'atomic_inc_and_test(&v)', run: () => { v++; return { ret: v === 0, why: 'Adds 1 and reports whether that made v exactly 0 (only possible if v was −1).' }; } },  // atomic_inc_and_test: adds 1 and returns true at 0, which can only happen when v was -1
    ];  // closes the OPS list
    const big = cell(ctx, 'v (an atomic_t)');  // big: the large value box showing v
    const say = verdict(ctx);  // say: the narration box that explains each call
    const log = h('div', { class: 'log', style: { height: '76px' } }, h('div', { class: 'ph' }, 'Your calls appear here, newest first.'));  // log: a short scrolling list of calls, newest on top, starting with a grey placeholder
    const bs = OPS.map((op) => h('button', { class: 'btn sm opbtn', type: 'button', onclick: () => run(op) }));  // bs: one button per operation, styled as code; a click runs that operation
    function labels() { OPS.forEach((op, k) => (bs[k].textContent = op.call())); }  // labels(): writes each button's call text, so the current amount i appears in it
    function run(op) {  // run(op): performs one operation and reports the result
      const before = v, call = op.call(), r = op.run();  // remembers v before the call, the call text, and the result object returned by run()
      big.set(v, true);  // shows the new v in the big box with a short flash
      const ph = log.querySelector('.ph'); if (ph) ph.remove();  // removes the placeholder from the log the first time
      const ret = r.ret === undefined ? '' : ' → returns ' + (typeof r.ret === 'boolean' ? String(r.ret) : r.ret);  // ret: the "returns ..." text for operations that give back a value, empty for those that do not
      log.prepend(h('div', { class: typeof r.ret === 'boolean' && r.ret ? 'ok' : '' }, `${call}: v ${before} → ${v}${ret}`));  // adds the call and its effect to the top of the log, in green when a test operation returned true
      say.say(typeof r.ret === 'boolean' ? (r.ret ? 'ok' : 'warn') : 'info', `<code>${call}</code>: v was ${before}, now ${v}.`  // narration: green for a true result, amber for false, blue otherwise; states old and new v...
        + (r.ret === undefined ? '' : ` Returns ${typeof r.ret === 'boolean' ? T(r.ret) : '<b>' + r.ret + '</b>'}.`) + ' ' + r.why);  // ...then the return value (coloured for true/false) and the operation's own explanation
    }  // ends run
    const sl = ctx.ui.slider({ label: 'Amount <code>i</code>', min: -6, max: 6, value: i, onInput: (x) => { i = x; labels(); } });  // sl: the slider for the amount i, from -6 to 6; moving it relabels the buttons
    function reset() { v = INIT; big.set(v); log.replaceChildren(h('div', { class: 'ph' }, 'Your calls appear here, newest first.')); say.say('info', `<code>atomic_t v = ATOMIC_INIT(${INIT});</code> declares v and starts it at ${INIT}. Click an operation. Try to make <code>atomic_dec_and_test</code> return true.`); }  // reset(): puts v back to INIT, clears the log and shows the starting message with a challenge
    labels(); reset();  // labels the buttons and sets the starting state when the tab opens
    panel.append(h('div', { class: 'stack gap-s' },  // builds the tab's layout as a vertical stack
      h('div', { class: 'row', style: { alignItems: 'stretch' } },  // top row: the value box beside the controls, stretched to the same height
        h('div', { style: { flex: '0 0 150px', display: 'grid' } }, big),  // left: the big v box in a fixed 150-pixel column
        h('div', { class: 'stack gap-s grow', style: { justifyContent: 'center' } }, sl,  // right: the amount slider, vertically centred
          h('div', { class: 'row gap-s' }, h('code', { class: 'small' }, `atomic_t v = ATOMIC_INIT(${INIT});`), h('span', { class: 'grow' }), btn(ctx, 'Reset v', reset, 'sm ghost')))),  // under the slider: the ATOMIC_INIT declaration as code, a spacer and the Reset v button; closes the top row
      h('div', { class: 'opgrid' }, ...bs),  // the two-column grid of operation buttons
      say, log));  // the narration box and the call log; closes the stack
  }  // ends atomicInts

  /* Tab 3 of the atomic step: bitmap operations on one bit of an ordinary word. */
  function atomicBits(panel, ctx) {  // atomicBits(panel, ctx): builds the third tab, where atomic bit operations change one bit of an ordinary word
    const { h } = ctx;  // takes the HTML builder h out of ctx
    const INIT = 0x25;  // INIT: the starting word, hexadecimal 25 (binary 00100101)
    let w = INIT, nr = 0;  // w is the simulated flags word; nr is the bit number the student has chosen
    const B = (x) => (w >> x) & 1;  // B(x): reads bit x of w as 0 or 1
    const OPS = [  // OPS: one entry per bit operation: its name, what it does to bit x, and a one-line explanation
      ['set_bit', (x) => { w |= 1 << x; }, 'Sets bit nr to 1.'],  // set_bit: ORs in a 1 at position x, turning that bit on
      ['clear_bit', (x) => { w &= ~(1 << x); }, 'Clears bit nr to 0.'],  // clear_bit: ANDs with everything except bit x, turning that bit off
      ['change_bit', (x) => { w ^= 1 << x; }, 'Flips bit nr.'],  // change_bit: XORs bit x with 1, flipping it whatever it was
      ['test_and_set_bit', (x) => { const o = B(x); w |= 1 << x; return o; }, 'Sets bit nr and returns its OLD value. A return of 0 means you were the one who set it: a tiny try-lock.'],  // test_and_set_bit: remembers the old bit, sets it, and returns the old value; a 0 means you just claimed it
      ['test_and_clear_bit', (x) => { const o = B(x); w &= ~(1 << x); return o; }, 'Clears bit nr and returns its old value.'],  // test_and_clear_bit: remembers the old bit, clears it, and returns the old value
      ['test_and_change_bit', (x) => { const o = B(x); w ^= 1 << x; return o; }, 'Flips bit nr and returns its old value.'],  // test_and_change_bit: remembers the old bit, flips it, and returns the old value
      ['test_bit', (x) => B(x), 'Returns bit nr without changing anything.'],  // test_bit: only reads bit x and returns it, changing nothing
    ];  // closes the OPS list
    const bitsRow = h('div', { class: 'bits', role: 'group', 'aria-label': 'Choose bit number nr' });  // bitsRow: the row of 8 clickable bit boxes; the group label tells screen readers they choose nr
    const hex = h('div', { class: 'small mono' });  // hex: the line that shows the whole word in hexadecimal and binary, in a fixed-width font
    const say = verdict(ctx);  // say: the narration box that explains each operation
    function paint() {  // paint(): redraws the 8 bit boxes and the word display from w and nr
      bitsRow.replaceChildren(...[7, 6, 5, 4, 3, 2, 1, 0].map((x) => h('button', { type: 'button', class: 'bitcell' + (B(x) ? ' one' : ''), 'aria-pressed': String(x === nr), 'aria-label': `bit ${x}, value ${B(x)}`, onclick: () => { nr = x; paint(); say.say('info', `nr = ${x}. Now pick an operation.`); } },  // one button per bit, highest first (7 down to 0), shaded when the bit is 1 and marked pressed when it is the chosen nr; a click selects it
        h('span', { class: 'xs' }, 'bit ' + x), h('b', {}, String(B(x))))));  // inside each bit button: a small "bit x" label and the bit's value in bold; closes the map and the row
      hex.innerHTML = `flags = 0x${w.toString(16).padStart(2, '0')} = ${w.toString(2).padStart(8, '0')}<sub>2</sub> · nr = <b>${nr}</b>`;  // shows the word as 0x.. hexadecimal and 8 binary digits (sub writes the small 2 for base two), plus the chosen nr
    }  // ends paint
    const bs = OPS.map(([name, fn, why]) => h('button', { class: 'btn sm opbtn', type: 'button', onclick: () => {  // bs: one button per operation; its click handler starts here
      const before = B(nr), r = fn(nr);  // remembers the chosen bit's old value, then runs the operation (r is its return value, if any)
      paint();  // redraws the bits so the change shows at once
      say.say(name === 'test_and_set_bit' ? (r ? 'warn' : 'ok') : 'info', `<code>${name}(${nr}, &amp;flags)</code>: bit ${nr} was ${before}, now ${B(nr)}.` + (r === undefined ? '' : ` Returns <b>${r}</b>.`) + ' ' + why);  // narration: green when test_and_set_bit claimed a free bit, amber when it was already taken; shows old bit, new bit, return value and explanation
    } }, name + '(nr, &flags)'));  // ends the click handler; the button label is the operation's call with nr and &flags
    function reset() { w = INIT; nr = 0; paint(); say.say('info', 'Click a bit to choose <code>nr</code>, then an operation. These work on <b>any</b> ordinary <code>unsigned long</code>, not a special type; <code>nr</code> may even run past the first word into the next ones. Only the chosen bit is touched, atomically.'); }  // reset(): puts the word back to INIT, chooses bit 0, redraws and explains that these work on any ordinary unsigned long
    reset();  // sets the starting state when the tab opens
    panel.append(h('div', { class: 'stack gap-s' },  // builds the tab's layout as a vertical stack
      h('div', { class: 'row gap-s' }, h('code', { class: 'small' }, 'unsigned long flags;'), h('span', { class: 'xs muted' }, '(low 8 bits shown)'), h('span', { class: 'grow' }), btn(ctx, 'Reset flags', reset, 'sm ghost')),  // top row: the C declaration of flags, a note that only the low 8 bits are shown, a spacer and a Reset button
      bitsRow, hex,  // the bit buttons and the hex/binary line
      h('div', { class: 'opgrid' }, ...bs),  // the two-column grid of operation buttons
      say,  // the narration box
      h('div', { class: 'callout tip m0 small', 'data-label': 'Try this', html: 'Treat bit 3 as a “busy” flag. Run <code>test_and_set_bit</code> on it twice: the first call returns 0 (you claimed it), the second returns 1 (someone already has it). <code>clear_bit</code> releases it.' })));  // "Try this" tip: use bit 3 as a busy flag and see test_and_set_bit return 0 then 1; closes the stack
  }  // ends atomicBits

  /* The interrupt lab: a system call and a network interrupt handler share rxlock on ONE CPU. */
  function irqLab(ctx) {  // irqLab(ctx): builds the interrupt lab, where a system call and a network interrupt handler share one spinlock on one CPU
    const { h } = ctx;  // takes the HTML builder h out of ctx
    const LOCK = { plain: ['spin_lock(&rxlock);', '// take the lock'], irq: ['spin_lock_irq(&rxlock);', '// irqs OFF, lock'], save: ['spin_lock_irqsave(&rxlock, flags);', '// save, OFF, lock'] };  // LOCK: the lock line for each variant (plain, _irq, _irqsave), each as [code, short comment]
    const UNLOCK = { plain: ['spin_unlock(&rxlock);', '// release'], irq: ['spin_unlock_irq(&rxlock);', '// release, irqs ON'], save: ['spin_unlock_irqrestore(&rxlock, flags);', '// release, restore'] };  // UNLOCK: the matching unlock line for each variant, again as [code, short comment]
    const pad = (a) => a[0].padEnd(40) + a[1];  // pad(a): pads the code to 40 characters and adds the comment, so the comments line up in a column
    const src = (v) => [pad(LOCK[v]), pad(['rx_packets++;', '// critical section']), pad(['rx_bytes += len;', '// critical section']), pad(UNLOCK[v]), pad(['return;', '// back to the caller'])].join('\n');  // src(v): the five-line system-call listing for variant v: lock, two counter updates, unlock, return
    const HSRC = [pad(['spin_lock(&rxlock);', '// handler wants it too']), pad(['rx_packets++;', '// its critical section']), pad(['spin_unlock(&rxlock);', '// release'])].join('\n');  // HSRC: the three-line listing for the interrupt handler, which always uses plain spin_lock
    let S, code, hcode, gen = 0, busy = false, replaying = false, spinT = null;  // S is the lab state, code/hcode the two listings, gen counts resets, busy and replaying block clicks, spinT is the endless-spin timer
    const codeBox = h('div'), hBox = h('div');  // codeBox and hBox: the boxes for the system-call listing and the handler listing
    const chIrq = h('span', { class: 'chip' }), chLock = h('span', { class: 'chip' }), chPend = h('span', { class: 'chip' }), chFlags = h('span', { class: 'chip' });  // four status chips: interrupts on or off, who holds rxlock, whether an interrupt is pending, and the saved flags
    const say = verdict(ctx);  // say: the narration box that explains each event
    const log = h('div', { class: 'log grow', style: { minHeight: '70px' } });  // log: the event log for CPU 0, which fills the remaining height
    const note = (t, cls) => { const ph = log.querySelector('.ph'); if (ph) ph.remove(); log.append(h('div', { class: cls || '' }, t)); log.scrollTop = log.scrollHeight; };  // note(t, cls): removes the placeholder, adds an event line at the bottom of the log and scrolls to it
    const bRun = btn(ctx, 'Run next line', () => !busy && step(), 'sm primary');  // bRun: runs the system call's next line, unless something else is happening
    const bInt = btn(ctx, 'Network interrupt!', () => !busy && fire(), 'sm intr');  // bInt: fires the network interrupt, unless something else is happening
    const segV = ctx.ui.seg([{ value: 'plain', label: 'spin_lock' }, { value: 'irq', label: '_irq' }, { value: 'save', label: '_irqsave' }], 'plain', () => reset());  // segV: the three-way switch for the lock variant: spin_lock, _irq or _irqsave; changing it starts over
    const segC = ctx.ui.seg([{ value: 'on', label: 'caller: irqs ON' }, { value: 'off', label: 'caller: irqs OFF' }], 'on', () => reset());  // segC: the switch for whether the caller had interrupts on or off before the system call; changing it starts over
    const name = { plain: 'spin_lock', irq: 'spin_lock_irq', save: 'spin_lock_irqsave' };  // name: the full function name for each variant, used in messages
    function reset() {  // reset(): starts the lab over with the chosen variant and caller state
      gen++; busy = false; replaying = false;  // bumps gen so pending animations stop, and unblocks the buttons
      if (spinT) { clearInterval(spinT); spinT = null; }  // stops the endless-spin counter if it is running
      const v = segV.get(), on = segC.get() === 'on';  // reads the two switches: the lock variant and whether interrupts start on
      S = { v, on, irq: on, pc: 0, lock: null, pend: false, flags: null, hpc: -1, stuck: false, spins: 0, handled: 0, broke: false };  // fresh state: interrupts as the caller left them, system call at line 0, lock free, nothing pending, handler not running
      code = listing(ctx, src(v), { fontSize: 13 }); codeBox.replaceChildren(code);  // builds the system-call listing in slightly smaller 13-pixel text
      hcode = listing(ctx, HSRC, { fontSize: 13 }); hBox.replaceChildren(hcode);  // builds the handler listing the same way
      log.replaceChildren(h('div', { class: 'ph' }, 'Events on CPU 0 appear here, oldest first.'));  // clears the log and shows a grey placeholder
      paint(['info', `<b>Process context</b> (a system call) is about to run with <code>${name[v]}</code>; interrupts are ${on ? 'ON' : 'already OFF (the caller switched them off)'}. Run it a line at a time and fire the interrupt <b>while the lock is held</b>.`]);  // draws everything and explains the setup: which lock call is used and whether interrupts are on
    }  // ends reset
    function paint(v) {  // paint(v): redraws listings, chips and buttons; v is an optional [tone, message]
      code.marks(S.pc < 5 && !(S.hpc >= 0) ? { [S.pc + 1]: [0] } : {});  // puts the CPU 0 marker on the system call's next line, but hides it while the handler is running
      code.querySelectorAll('.mk').forEach((m) => (m.textContent = 'sys'));  // relabels that marker "sys" instead of C0
      hcode.marks(S.hpc >= 0 ? { [S.hpc + 1]: [1] } : {});  // puts a marker on the handler's current line while the handler runs (second CPU colour)
      hcode.querySelectorAll('.mk').forEach((m) => (m.textContent = 'irq'));  // relabels that marker "irq"
      chIrq.className = 'chip ' + (S.irq ? 'ok' : 'os'); chIrq.textContent = 'CPU 0 irqs ' + (S.irq ? 'ON' : 'OFF');  // interrupts chip: green when ON, kernel colour when OFF
      chLock.className = 'chip ' + (S.lock ? 'warn' : ''); chLock.textContent = 'rxlock: ' + (S.lock === 'sys' ? 'held by system call' : S.lock === 'irq' ? 'held by handler' : 'free');  // lock chip: amber while held, saying whether the system call or the handler holds it
      chPend.className = 'chip ' + (S.pend ? 'intr pulse' : ''); chPend.textContent = S.pend ? 'interrupt pending' : 'nothing pending';  // pending chip: pulses in the interrupt colour while an interrupt waits
      chFlags.style.display = S.v === 'save' ? '' : 'none'; chFlags.className = 'chip cpu'; chFlags.textContent = 'flags = ' + (S.flags === null ? '–' : S.flags ? 'saved ON' : 'saved OFF');  // flags chip: shown only for _irqsave, with the interrupt state saved in flags
      bRun.disabled = busy || replaying || S.stuck || S.pc >= 5; bInt.disabled = busy || replaying || S.stuck || S.hpc >= 0;  // greys out Run once stuck, busy, replaying or finished, and the interrupt button while the handler is already running
      if (v) say.say(v[0], v[1]);  // shows the message in the narration box if one was given
      log.scrollTop = log.scrollHeight;  // keeps the log scrolled to the newest event
    }  // ends paint
    async function handler() {  // handler(): plays the interrupt handler on CPU 0 step by step; async lets it pause between steps
      busy = true; const g = gen;  // blocks other clicks; g remembers which reset this run belongs to
      S.hpc = 0; note('INTERRUPT → handler starts on CPU 0', 'warn');  // starts the handler at its first line and logs that the interrupt arrived
      paint(['warn', 'The interrupt is accepted. CPU 0 stops the system call mid-stream and runs the <b>handler</b> in <span class="t">interrupt context</span>.']);  // explains that the system call was paused and the handler now runs in interrupt context
      await ctx.sleep(900); if (!ctx.alive || g !== gen) return;  // waits 0.9 seconds, quitting if the slide was left or the lab was reset
      if (S.lock === 'sys') {  // if the system call holds rxlock when the handler asks for it...
        S.stuck = true; busy = false;  // ...the handler is stuck for good; the buttons are released so the student can press Reset
        note('irq: spin_lock → rxlock is held by sys: spinning forever', 'bad');  // logs that the handler is spinning forever
        const show = () => paint(['bad', `<b>Deadlock on one CPU.</b> The handler spins on rxlock, but the holder is the very system call it interrupted. That code cannot run again until the handler returns, and the handler never returns. Lock tests so far: <b>${S.spins.toLocaleString('en-US')}</b>. Press Reset and try <code>_irqsave</code>.`]);  // show(): the red deadlock message, which explains why and counts the lock tests so far
        show();  // shows it right away
        spinT = ctx.every(120, () => { if (g !== gen) return; S.spins += 48000; show(); });  // every 0.12 seconds adds 48,000 more lock tests and redraws, to show the CPU burning time on the spin
        return;  // stops here: the handler never gets the lock
      }  // ends the deadlock case
      S.lock = 'irq'; note('irq: spin_lock → rxlock held by the handler');  // otherwise the lock is free: the handler takes it and logs that
      paint(['info', 'rxlock is free, so the handler takes it at once.']);  // explains that the handler got the lock at once
      for (let k = 1; k <= 2; k++) {  // plays the handler's last two lines, one by one
        await ctx.sleep(700); if (!ctx.alive || g !== gen) return;  // waits 0.7 seconds before each, quitting if the slide was left or the lab was reset
        S.hpc = k; if (k === 2) S.lock = null;  // moves the handler's marker on; on the last line it releases rxlock
        note(k === 1 ? 'irq: rx_packets++' : 'irq: spin_unlock → rxlock free, handler returns');  // logs the counter update, then the unlock and return
        paint(['info', k === 1 ? 'The handler updates the counters.' : 'The handler releases rxlock and returns.']);  // explains each of those two steps
      }  // ends the loop over the handler's lines
      await ctx.sleep(700); if (!ctx.alive || g !== gen) return;  // one more pause before the handler finishes
      S.hpc = -1; S.handled++; busy = false;  // the handler is done: its marker goes, the count of handled interrupts goes up, and buttons work again
      paint(S.broke ? ['bad', (S.pc >= 5 ? 'Handler finished after the system call returned.' : `Handler finished; the system call resumes at line ${S.pc + 1}.`) + ' The two never held rxlock together, but the handler ran while the caller still believed interrupts were OFF, so whatever the caller was guarding by switching them off was exposed.']  // if the _irq unlock had wrongly switched interrupts on, a red message: no lock clash, but the caller's protection was exposed...
        : ['ok', S.pc >= 5 ? 'Handler finished. The system call had already returned, so there was nothing to conflict with.' : `Handler finished; the system call resumes at line ${S.pc + 1}. No conflict: the two never held rxlock at the same time.`]);  // ...otherwise a green message: no conflict, and where the system call continues
    }  // ends handler
    function fire() {  // fire(): what happens when the student presses the interrupt button
      if (S.irq) { handler(); return; }  // with interrupts ON, the handler runs right away
      const again = S.pend; S.pend = true;  // with interrupts OFF the interrupt is held pending; again records whether one was already waiting
      note('INTERRUPT → held pending (interrupts OFF)', 'ok');  // logs in green that the interrupt is being held pending because interrupts are off
      paint(['ok', `Interrupts are OFF on CPU 0, so the interrupt is ${again ? 'already' : 'now'} <b>pending</b>. The handler cannot run, so it cannot spin on rxlock. It will run as soon as interrupts come back on.`]);  // green message: the handler cannot run yet, so it cannot spin on rxlock; it runs once interrupts come back on
    }  // ends fire
    function step() {  // step(): runs the system call's next line and explains it
      const pc = S.pc, v = S.v;  // pc is the line about to run (0 to 4); v is the chosen lock variant
      let msg;  // msg will hold the [tone, message] for the narration box
      if (pc === 0) {  // line 1, the lock call
        if (v === 'save') S.flags = S.irq;  // _irqsave first copies the current interrupt state into flags
        if (v !== 'plain') S.irq = false;  // both _irq and _irqsave switch interrupts off on this CPU; plain spin_lock leaves them alone
        S.lock = 'sys';  // the system call now holds rxlock
        msg = v === 'plain' ? ['info', `<code>spin_lock</code> takes rxlock. Interrupts stay ${S.irq ? '<b>ON</b>: an interrupt could arrive now.' : 'OFF, because the caller had already switched them off.'}`]  // plain message: the lock is taken and interrupts stay as they were (an interrupt could arrive if they are on)
          : v === 'irq' ? ['info', '<code>spin_lock_irq</code> switches interrupts OFF on this CPU, then takes rxlock.']  // _irq message: interrupts go off, then the lock is taken
            : ['info', `<code>spin_lock_irqsave</code> saves the current state (${S.flags ? 'ON' : 'OFF'}) in <code>flags</code>, switches interrupts OFF, then takes rxlock.`];  // _irqsave message: the old state is saved in flags, interrupts go off, then the lock is taken
      } else if (pc === 1 || pc === 2) {  // lines 2 and 3, the critical section
        msg = ['info', `Critical section, line ${pc + 1}: the system call updates the shared counters while holding rxlock.`];  // message: the system call updates the shared counters while it holds rxlock
      } else if (pc === 3) {  // line 4, the unlock call
        S.lock = null;  // rxlock is free again
        if (v === 'irq') { if (!S.on) S.broke = true; S.irq = true; }  // _irq always switches interrupts on; if the caller had them off, that breaks the caller's protection
        if (v === 'save') S.irq = S.flags;  // _irqsave puts interrupts back exactly as flags recorded
        msg = v === 'plain' ? ['info', '<code>spin_unlock</code> releases rxlock. The interrupt state is not touched.']  // plain message: the lock is released and interrupts are not touched
          : v === 'irq' ? [S.on ? 'info' : 'bad', S.on ? '<code>spin_unlock_irq</code> releases rxlock and switches interrupts back ON.' : '<code>spin_unlock_irq</code> switches interrupts <b>ON</b>, but the caller had them OFF on purpose. Its own protection is gone without its knowledge.']  // _irq message: normal if the caller had interrupts on, red if they were off on purpose and are now on
            : ['ok', `<code>spin_unlock_irqrestore</code> releases rxlock and puts interrupts back the way <code>flags</code> says: <b>${S.flags ? 'ON' : 'OFF'}</b>.`];  // _irqsave message: the lock is released and interrupts restored to the saved state
      } else {  // line 5, the return
        msg = S.broke ? ['bad', '<b>Returned with interrupts ON</b>, although the caller expected them still OFF. This is why <code>_irq</code> is only for code that knows interrupts were on; when you do not know, use <code>_irqsave</code>.']  // red message if the caller gets interrupts back on unexpectedly: _irq is only safe when interrupts were known to be on
          : ['ok', `<b>Done.</b> The system call returns with interrupts ${S.irq ? 'ON' : 'OFF'}, exactly as the caller left them.` + (S.pend ? ' The pending interrupt will be handled when the caller switches them back on.' : '')];  // otherwise green: the call returns with interrupts as the caller left them, and any pending interrupt will run later
      }  // ends the choice of line
      const ON = (b) => (b ? 'ON' : 'OFF');  // ON(b): writes true as ON and false as OFF for the log
      note(['sys: ' + (v === 'plain' ? 'spin_lock → rxlock held' : v === 'irq' ? 'spin_lock_irq → irqs OFF, rxlock held' : `spin_lock_irqsave → flags = ${ON(S.flags)}, irqs OFF, rxlock held`),  // the log entry for each of the five lines, starting with the lock line (its text depends on the variant)...
        'sys: rx_packets++', 'sys: rx_bytes += len',  // ...the two counter updates...
        'sys: ' + (v === 'plain' ? 'spin_unlock → rxlock free' : v === 'irq' ? 'spin_unlock_irq → rxlock free, irqs ON' : `spin_unlock_irqrestore → rxlock free, irqs ${ON(S.irq)}`),  // ...the unlock line...
        `sys: return with irqs ${ON(S.irq)}`][pc], (pc === 3 && S.broke) || (pc === 4 && S.broke) ? 'bad' : '');  // ...and the return; [pc] picks the entry for the line just run, shown in red if interrupts were wrongly switched on
      S.pc++;  // moves the system call on to its next line
      paint(msg);  // redraws with the message
      if (S.irq && S.pend && pc === 3) {  // if the unlock just switched interrupts back on and an interrupt was waiting...
        note('irqs back ON → the pending interrupt is delivered', 'ok');  // ...logs that it is now delivered
        S.pend = false; busy = true; paint();  // clears the pending flag, blocks clicks and redraws
        const g = gen;  // g remembers this reset so a later reset can cancel the delivery
        ctx.after(600, () => { if (g === gen) handler(); });  // after 0.6 seconds runs the handler, unless the lab was reset meanwhile
      }  // ends the pending-delivery case
    }  // ends step
    async function replay() {  // replay(): plays a scripted run that fires the interrupt while the lock is held
      reset(); replaying = true; paint(); const g = gen;  // starts over, blocks the student's buttons, redraws, and remembers this reset in g
      for (const a of ['run', 'run', 'fire', 'run', 'run', 'run']) {  // the script: lock, first counter line, interrupt, then the rest of the system call
        await ctx.sleep(850); if (!ctx.alive || g !== gen) return;  // waits 0.85 seconds before each action, quitting if the slide was left or the lab was reset
        while (busy) { await ctx.sleep(100); if (!ctx.alive || g !== gen) return; }  // waits for any handler run to finish before the next action
        if (S.stuck) break;  // stops the script if the handler is stuck in its endless spin
        if (a === 'run') step(); else fire();  // performs the action: run a line or fire the interrupt
      }  // ends the script loop
      while (busy) { await ctx.sleep(100); if (!ctx.alive || g !== gen) return; }  // waits for a final handler run to finish
      replaying = false; paint();  // unblocks the buttons and redraws
    }  // ends replay
    reset();  // sets up the starting state when the lab is built
    return h('div', { class: 'card stack gap-s' },  // returns the lab as a card with its parts stacked vertically
      h('div', { class: 'row gap-s' }, segV, h('span', { class: 'grow' }), segC),  // top row: the lock-variant switch on the left and the caller switch on the right
      h('div', { class: 'xs b muted' }, 'PROCESS CONTEXT · a system call on CPU 0'), codeBox,  // small heading and the system-call listing, which runs in process context
      h('div', { class: 'xs b muted' }, 'INTERRUPT CONTEXT · the network handler, also on CPU 0'), hBox,  // small heading and the handler listing, which runs in interrupt context on the same CPU
      h('div', { class: 'row gap-s' }, chIrq, chLock, chPend, chFlags),  // the row of four status chips
      h('div', { class: 'row gap-s' }, bRun, bInt, h('span', { class: 'grow' }), btn(ctx, 'Replay: interrupt mid-section', () => replay()), btn(ctx, 'Reset', () => reset(), 'sm ghost')),  // the button row: Run next line, Network interrupt, a spacer, the Replay button and Reset
      say, log);  // the narration box and the event log; closes the card
  }  // ends irqLab

  /* Tab 1 of the semaphore step: a counting kernel semaphore shared by four tasks. */
  function semLab(panel, ctx) {  // semLab(panel, ctx): builds the first tab of the semaphore step, where four tasks share a counting kernel semaphore
    const { h } = ctx;  // takes the HTML builder h out of ctx
    const INIT = 2, NAMES = ['A', 'B', 'C', 'D'];  // INIT: the semaphore starts with 2 units; NAMES: the four tasks A to D
    let S;  // S will hold the semaphore state
    const cCount = cell(ctx, 'count', 'os');  // cCount: the value box for the semaphore's count, in the kernel colour
    const qBox = h('div', { class: 'row gap-s' });  // qBox: the row that shows the wait queue
    const classic = h('div', { class: 'xs muted' });  // classic: a small grey line that relates the Linux count to the classic semaphore model
    const rows = h('div', { class: 'stack gap-s' });  // rows: one control row per task
    const say = verdict(ctx);  // say: the narration box that explains each call
    const log = h('div', { class: 'log grow', style: { minHeight: '56px' } });  // log: the call log, which fills the remaining height
    const STATE = { run: ['running, holds nothing', ''], hold: ['holds a unit', 'ok'], su: ['asleep in down', 'os'], si: ['asleep in down_interruptible', 'os'] };  // STATE: the description and colour for each task state: running, holding a unit, asleep in down, asleep in down_interruptible
    const note = (t, cls) => { const ph = log.querySelector('.ph'); if (ph) ph.remove(); log.prepend(h('div', { class: cls || '' }, t)); };  // note(t, cls): removes the placeholder and adds a line at the top of the log, newest first
    function reset() {  // reset(): starts the semaphore lab over
      S = { count: INIT, q: [], st: { A: 'run', B: 'run', C: 'run', D: 'run' }, sig: {} };  // fresh state: count 2, empty wait queue, all four tasks running, no ignored signals
      log.replaceChildren(h('div', { class: 'ph' }, 'Calls and return values appear here, newest first.'));  // clears the log and shows a grey placeholder
      paint(['info', `<code>sema_init(&amp;sem, ${INIT})</code>: two identical units (say, two DMA channels) for four tasks. Take both, then make C and D wait, then try <b>up</b> and <b>signal</b>.`]);  // draws everything and explains the setup (two identical units, four tasks) with a suggested sequence to try
    }  // ends reset
    function act(t, op) {  // act(t, op): task t performs operation op and the function returns the narration message
      const st = S.st[t];  // st: task t's state before the call
      if (op === 'down' || op === 'downi') {  // down and down_interruptible both try to take a unit
        const fn = op === 'down' ? 'down' : 'down_interruptible';  // fn: the full function name for the log
        if (S.count > 0) { S.count--; S.st[t] = 'hold'; note(`${t}: ${fn}(&sem) → returns${op === 'down' ? '' : ' 0'}, got a unit`, 'ok'); return ['ok', `A unit was free, so ${t} takes it at once: count ${S.count + 1} → ${S.count}.`]; }  // a unit is free: count goes down, t holds it, and the message says it got the unit at once
        S.st[t] = op === 'down' ? 'su' : 'si'; S.q.push(t);  // no unit: t goes to sleep and joins the end of the wait queue
        note(`${t}: ${fn}(&sem) → no unit: ${t} sleeps`);  // logs that t is now asleep
        return ['warn', `count is 0, so ${t} goes to <b>sleep</b> on the wait queue (position ${S.q.length}). Its CPU runs other tasks meanwhile.` + (op === 'down' ? ' It sleeps <b>uninterruptibly</b>: signals cannot wake it.' : ' A signal can wake it early.')];  // amber message: t sleeps on the wait queue; plain down cannot be woken by signals, down_interruptible can
      }  // ends the down case
      if (op === 'try') {  // down_trylock: takes a unit only if one is free and never sleeps
        if (S.count > 0) { S.count--; S.st[t] = 'hold'; note(`${t}: down_trylock(&sem) → 0 (got it)`, 'ok'); return ['ok', `<code>down_trylock</code> found a unit and took it, returning <b>0</b> (success).`]; }  // a unit was free: it is taken and the call returns 0, meaning success
        note(`${t}: down_trylock(&sem) → 1 (not available)`, 'warn');  // none free: logs the return value 1
        return ['warn', `<code>down_trylock</code> found count = 0. It does <b>not</b> sleep: it returns <b>1</b> (nonzero means “could not take it”) and ${t} carries on with something else.`];  // amber message: trylock does not sleep; a nonzero return means "could not take it", so t does something else
      }  // ends the trylock case
      if (op === 'up') {  // up: releases a unit
        S.st[t] = 'run';  // the releasing task goes back to running and holds nothing
        if (S.q.length) {  // if some task is waiting...
          const w = S.q.shift(), was = S.st[w]; S.st[w] = 'hold'; delete S.sig[w];  // ...the longest waiter is taken off the front of the queue and handed the unit; any signal it ignored is forgotten
          note(`${t}: up(&sem) → wakes ${w}, which now holds the unit`, 'ok');  // logs who was woken
          return ['ok', `${t} releases its unit. ${w} has waited longest, so <code>up</code> wakes it and hands it the unit directly: count stays ${S.count}. ` + (was === 'si' ? `${w}’s <code>down_interruptible</code> now returns 0 (success).` : `${w}’s <code>down</code> call now returns, holding the unit.`)];  // message: the unit passes straight to the waiter, so count does not change, and says what its down call returns
        }  // ends the waiting case
        S.count++; note(`${t}: up(&sem) → count ${S.count - 1} → ${S.count}`);  // nobody waits, so the unit simply goes back: count goes up by 1 and the log shows the change
        return ['info', `Nobody is waiting, so <code>up</code> just adds the unit back: count ${S.count - 1} → ${S.count}.`];  // message: with an empty queue, up just adds the unit back to count
      }  // ends the up case
      if (st === 'si') {  // the remaining operation is a signal; if the task sleeps in down_interruptible...
        S.q.splice(S.q.indexOf(t), 1); S.st[t] = 'run';  // ...it leaves the wait queue and runs again, without a unit
        note(`${t}: woken by a signal → down_interruptible returns -EINTR`, 'warn');  // logs that the call returned -EINTR (the error code for "interrupted")
        return ['warn', `A signal arrives for ${t}. Because it used <code>down_interruptible</code>, it wakes, leaves the queue <b>without</b> a unit, and the call returns <b>-EINTR</b>. ${t} must check that value and give up, often by returning -EINTR to its own caller.`];  // amber message: the task woke without a unit and must check the -EINTR return value and give up
      }  // ends the interruptible case
      S.sig[t] = true; note(`${t}: signal arrives → stays asleep (down ignores signals)`);  // plain down: the signal is only remembered as ignored, and the task keeps sleeping
      return ['bad', `${t} used plain <code>down</code>, so the signal cannot wake it: it stays pending and ${t} keeps sleeping until someone calls up. A task stuck like this cannot even be killed, which is why <code>down_interruptible</code> is the usual choice.`];  // red message: the task cannot be woken or even killed until someone calls up, which is why down_interruptible is preferred
    }  // ends act
    function paint(v) {  // paint(v): redraws the count, the wait queue and the four task rows; v is an optional [tone, message]
      cCount.set(S.count, true);  // shows the count with a short flash
      qBox.replaceChildren(h('span', { class: 'xs b muted' }, 'WAIT QUEUE:'), ...(S.q.length ? S.q.map((t, k) => h('span', { class: 'chip os' }, (k ? '' : 'next: ') + t)) : [h('span', { class: 'xs muted' }, 'empty')]));  // rebuilds the wait queue: a label, then one chip per sleeping task with "next:" on the first, or "empty"
      classic.innerHTML = `Linux keeps count ≥ 0 and lists sleepers separately. The chapter 5 model would show this as s = ${S.count} − ${S.q.length} = <b>${S.count - S.q.length}</b>.`;  // compares with the earlier chapter's semaphore model, where a negative value counts the sleepers (count minus queue length)
      rows.replaceChildren(...NAMES.map((t) => {  // rebuilds one row per task
        const st = S.st[t], free = st === 'run';  // st is the task's state; free means it is running and holds nothing (computed but not used below)
        return h('div', { class: 'taskrow' },  // each task row is a two-column box: name and state on the left, buttons on the right
          h('div', {}, h('b', {}, 'Task ' + t), h('div', { class: 'xs ' + (STATE[st][1] ? 'st-' + STATE[st][1] : 'muted') }, STATE[st][0] + (S.sig[t] && st === 'su' ? ', signal ignored' : ''))),  // left: the task's name in bold and its state in the state's colour, plus "signal ignored" when plain down ignored one
          h('div', { class: 'row gap-s' },  // right: a row of buttons for this task
            btn(ctx, 'down', () => paint(act(t, 'down')), 'sm opbtn'), btn(ctx, 'down_interruptible', () => paint(act(t, 'downi')), 'sm opbtn'),  // buttons down and down_interruptible, each running act and redrawing with its message
            btn(ctx, 'down_trylock', () => paint(act(t, 'try')), 'sm opbtn'), btn(ctx, 'up', () => paint(act(t, 'up')), 'sm opbtn'),  // buttons down_trylock and up
            btn(ctx, 'signal', () => paint(act(t, 'sig')), 'sm intr')));  // the signal button, in the interrupt colour; closes the button row and the task row
      }));  // closes the map over the tasks and the row list
      rows.querySelectorAll('.taskrow').forEach((r, k) => {  // enables only the buttons that make sense for each task's state
        const st = S.st[NAMES[k]], b = r.querySelectorAll('button');  // st is this row's task state; b is the list of its five buttons
        b[0].disabled = b[1].disabled = b[2].disabled = st !== 'run'; b[3].disabled = st !== 'hold'; b[4].disabled = st !== 'su' && st !== 'si';  // the three take buttons need a running task, up needs one that holds a unit, signal needs a sleeping task
      });  // ends the loop over rows
      if (v) say.say(v[0], v[1]);  // shows the message in the narration box if one was given
    }  // ends paint
    reset();  // sets the starting state when the tab opens
    panel.append(h('div', { class: 'stack gap-s fill' },  // builds the tab's layout as a stack that fills the panel's height
      h('div', { class: 'row', style: { alignItems: 'stretch' } },  // top row, with its items stretched to the same height
        h('div', { style: { flex: '0 0 100px', display: 'grid' } }, cCount),  // left: the count box in a fixed 100-pixel column
        h('div', { class: 'stack gap-s grow', style: { justifyContent: 'center' } }, qBox, classic),  // middle: the wait queue and the comparison line, vertically centred
        h('div', {}, btn(ctx, 'Reset', reset, 'sm ghost'))),  // right: the Reset button; closes the top row
      rows, say, log));  // the four task rows, then the narration box and the log; closes the stack
  }  // ends semLab

  /* Tab 2 of the semaphore step: a reader-writer spinlock that favours readers. */
  function rwLab(panel, ctx) {  // rwLab(panel, ctx): builds the second semaphore-step tab, a reader-writer spinlock that lets readers go first
    const { h } = ctx;  // takes the HTML builder h out of ctx
    let S, gen = 0, timer = null;  // S is the lab state, gen counts resets, timer is the reader stream's repeating timer
    const room = h('div', { class: 'rwroom' });  // room: the box showing who holds the lock right now
    const outside = h('div', { class: 'row gap-s' });  // outside: the row showing who is spinning, waiting for the lock
    const say = verdict(ctx);  // say: the narration box that explains each event
    const bStream = btn(ctx, 'Start a stream of readers', () => toggle(), 'sm');  // bStream: starts or stops an automatic stream of readers
    const bR = btn(ctx, 'Reader arrives', () => paint(readerIn()), 'sm proc');  // bR: sends one new reader to the lock (process colour)
    const bRL = btn(ctx, 'Oldest reader leaves', () => paint(readerOut()), 'sm proc');  // bRL: makes the reader that entered first leave
    const bW = btn(ctx, 'Writer arrives', () => paint(writerIn()), 'sm thread');  // bW: sends the writer to the lock (thread colour)
    const bWL = btn(ctx, 'Writer leaves', () => paint(writerOut()), 'sm thread');  // bWL: makes the writer leave
    function reset() {  // reset(): starts the reader-writer lab over
      gen++; if (timer) { clearInterval(timer); timer = null; }  // bumps gen and stops the reader stream if it is running
      S = { R: [], wait: [], next: 1, w: 'none', spun: 0 };  // fresh state: no readers inside or waiting, the next reader is R1, no writer, no spin time
      paint(['info', 'A classic <span class="t" data-t="reader-writer spinlock">reader-writer spinlock</span>, <code>rwlock_t</code>, guards a table. It favours readers, and on an ordinary (non-PREEMPT_RT) kernel its waiters spin. Let two readers in, then send the writer, then start the reader stream.']);  // explains rwlock_t (it favours readers and, on an ordinary non-real-time kernel, its waiters spin) and suggests a sequence to try
    }  // ends reset
    function readerIn() {  // readerIn(): a new reader arrives and returns the message to show
      const id = S.next++;  // gives the reader the next number
      if (S.w === 'in') { S.wait.push(id); return ['warn', `R${id} spins: a writer is inside, and a writer always holds the lock alone.`]; }  // if the writer is inside, the reader must spin outside and the message says why
      S.R.push(id);  // otherwise the reader goes in alongside any other readers
      return [S.w === 'wait' ? 'bad' : 'ok', S.w === 'wait' ? `R${id} walks straight in, <b>ahead of the waiting writer</b>: readers are favoured, so only another reader in the room matters to it.` : `R${id} enters. Readers share the lock: ${S.R.length} inside now.`];  // red if it just walked past a waiting writer (readers are favoured), green otherwise with the count inside
    }  // ends readerIn
    function readerOut() {  // readerOut(): the reader that has been inside longest leaves
      if (!S.R.length) return null;  // nothing to do if the room is empty (null leaves the narration unchanged)
      const id = S.R.shift();  // removes the first reader from the room
      if (!S.R.length && S.w === 'wait') { S.w = 'in'; return ['ok', `R${id} leaves; the room is finally empty, so the writer gets in (after spinning ${ctx.util.fmt(S.spun, 1)} ms).`]; }  // if that was the last reader and the writer was waiting, the writer finally gets in; the message shows how long it spun
      return ['info', `R${id} leaves. ${S.R.length} reader${S.R.length === 1 ? '' : 's'} still inside.`];  // otherwise just reports how many readers are still inside
    }  // ends readerOut
    function writerIn() {  // writerIn(): the writer arrives
      if (S.w !== 'none') return null;  // ignored if the writer is already waiting or inside
      if (!S.R.length) { S.w = 'in'; return ['ok', 'The room is empty, so the writer enters and holds the lock alone.']; }  // an empty room: the writer goes straight in and holds the lock alone
      S.w = 'wait'; S.spun = 0;  // readers inside: the writer starts waiting and its spin time starts at zero
      return ['warn', `The writer must wait until <b>no</b> reader is inside. ${S.R.length} reader${S.R.length === 1 ? ' is' : 's are'} in, so it spins.`];  // amber message: the writer spins until no reader is inside
    }  // ends writerIn
    function writerOut() {  // writerOut(): the writer leaves
      if (S.w !== 'in') return null;  // ignored unless the writer is actually inside
      S.w = 'none'; const n = S.wait.length; S.R.push(...S.wait); S.wait = [];  // the writer is gone; every reader that was spinning outside enters at once
      return ['info', 'The writer leaves.' + (n ? ` The ${n} spinning reader${n === 1 ? '' : 's'} can now enter together.` : '')];  // message: the writer left and, if any were waiting, the readers entered together
    }  // ends writerOut
    function toggle() {  // toggle(): starts or stops the automatic reader stream
      if (timer) { clearInterval(timer); timer = null; paint(['info', 'The stream stopped. Let the remaining readers leave one by one and watch the writer get in.']); return; }  // if the stream is running: stop it, say so, and suggest letting the readers leave one by one
      const g = gen;  // g remembers this reset so a later reset can stop the stream
      timer = ctx.every(800, () => {  // every 0.8 seconds while the slide is open...
        if (g !== gen) return;  // ...does nothing if the lab was reset meanwhile
        if (S.wait.length < 3) readerIn();  // a new reader arrives, unless three readers are already spinning outside
        if (S.R.length > 2) S.R.shift();  // when more than two are inside, the oldest leaves, so readers always overlap and the room is never empty
        if (S.w === 'wait') S.spun += 0.8;  // a waiting writer's spin time grows by 0.8 milliseconds per tick (the simulation's scaled time)
        paint(S.w === 'wait' ? ['bad', `<b>Writer starvation.</b> Readers overlap, so the room is never empty. The writer has spun for <b>${ctx.util.fmt(S.spun, 1)} ms</b> and could spin forever.`]  // red "Writer starvation" message while the writer waits, with the time spun so far...
          : S.w === 'in' ? ['info', `The writer holds the lock alone, so arriving readers spin outside (${S.wait.length} so far). They all enter together when it leaves.`]  // ...a note that readers spin outside while the writer is inside...
            : ['info', 'Readers keep arriving and leaving, always overlapping. Now send the writer in.']);  // ...or, with no writer, a hint to send the writer in now
      });  // ends the timer function
      paint();  // redraws right away so the button changes to "Stop the stream"
    }  // ends toggle
    function paint(v) {  // paint(v): redraws the room, the spinning row and the buttons; v is an optional [tone, message]
      room.replaceChildren(h('div', { class: 'xs b muted' }, 'HOLDING THE LOCK'),  // the room: a heading and then...
        h('div', { class: 'row gap-s' }, ...(S.w === 'in' ? [h('span', { class: 'chip thread' }, 'Writer (alone)')] : S.R.length ? S.R.map((id) => h('span', { class: 'chip proc' }, 'R' + id)) : [h('span', { class: 'xs muted' }, 'nobody')])));  // ...the writer alone, or one chip per reader inside, or "nobody"
      outside.replaceChildren(h('span', { class: 'xs b muted' }, 'SPINNING:'),  // the spinning row: a label and then...
        ...(S.w === 'wait' ? [h('span', { class: 'chip thread pulse' }, `Writer · ${ctx.util.fmt(S.spun, 1)} ms`)] : []),  // ...the waiting writer, pulsing, with its spin time...
        ...S.wait.map((id) => h('span', { class: 'chip proc' }, 'R' + id)),  // ...one chip per reader spinning outside...
        ...(S.w !== 'wait' && !S.wait.length ? [h('span', { class: 'xs muted' }, 'nobody')] : []));  // ...or "nobody" when neither the writer nor any reader is waiting
      bStream.textContent = timer ? 'Stop the stream' : 'Start a stream of readers';  // the stream button's label says whether a click will start or stop the stream
      bRL.disabled = !S.R.length || S.w === 'in'; bW.disabled = S.w !== 'none'; bWL.disabled = S.w !== 'in'; bR.disabled = !!timer;  // enables only sensible buttons: a reader can leave if any is inside, the writer can arrive or leave by its state, no manual readers during the stream
      if (v) say.say(v[0], v[1]);  // shows the message in the narration box if one was given
    }  // ends paint
    reset();  // sets the starting state when the tab opens
    panel.append(h('div', { class: 'stack gap-s' },  // builds the tab's layout as a vertical stack
      h('div', { class: 'row gap-s' }, bR, bRL, bW, bWL, h('span', { class: 'grow' }), btn(ctx, 'Reset', () => reset(), 'sm ghost')),  // top row: the four reader and writer buttons, a spacer and Reset
      room, h('div', { class: 'row gap-s' }, outside, h('span', { class: 'grow' }), bStream), say,  // the room, then a row with the spinning line and the stream button, then the narration box
      ctx.ui.code(`read_lock(&tbl_lock);    // many readers may hold it together${/* shown code, line 1: read_lock, which many readers may hold at the same time */''}
read_unlock(&tbl_lock);  // one reader leaves${/* shown code, line 2: read_unlock, one reader leaving */''}
write_lock(&tbl_lock);   // spins until no reader and no writer${/* shown code, line 3: write_lock, which spins until there is no reader and no writer */''}
write_unlock(&tbl_lock); // the writer leaves`, { fontSize: 13 }),  // shown code, line 4: write_unlock; the listing uses 13-pixel text
      h('p', { class: 'm0 small', html: 'The sleeping version is the <span class="t" data-t="reader-writer semaphore">reader-writer semaphore</span>: <code>init_rwsem</code>, then <code>down_read</code>/<code>up_read</code> and <code>down_write</code>/<code>up_write</code>. Its waiters sleep uninterruptibly.' }),  // paragraph: the sleeping counterpart, the reader-writer semaphore, with its init, read and write calls
      h('div', { class: 'callout warn m0 small', 'data-label': 'The price of favouring readers', html: 'A busy table can starve its writer. (Since Linux 3.16, x86 and later most other processors use a queued rwlock_t in which only readers in interrupt context may still pass a waiting writer.) RCU, two steps ahead, lets readers skip locking altogether.' })));  // warning callout: favouring readers can starve a writer; newer kernels use a queued lock that limits this, and RCU avoids it
    return () => { gen++; if (timer) { clearInterval(timer); timer = null; } };  // hands back a tidy-up function that stops the reader stream when the student leaves this tab
  }  // ends rwLab

  /* The RCU step's simulator: the student is the writer; readers come and go. */
  function rcuLab(panel, ctx) {  // rcuLab(panel, ctx): builds the RCU (read-copy-update) simulator, where the student is the writer and readers come and go
    const { h } = ctx;  // takes the HTML builder h out of ctx
    let S, gen = 0, auto = false;  // S is the lab state, gen counts resets, auto is true while the demonstration plays by itself
    const verBox = h('div', { class: 'vers' });  // verBox: the row of version cards, with gp (the shared pointer) in front of the current one
    const rdBox = h('div', { class: 'rds' });  // rdBox: the grid of reader cards
    const gpBox = h('div', { class: 'row gap-s' });  // gpBox: the row showing the grace period and what the writer is doing
    const say = verdict(ctx);  // say: the narration box that explains each event
    const log = h('div', { class: 'log grow', style: { minHeight: '60px' } });  // log: the event log, which fills the remaining height
    const note = (t, cls) => { const ph = log.querySelector('.ph'); if (ph) ph.remove(); log.append(h('div', { class: cls || '' }, t)); log.scrollTop = log.scrollHeight; };  // note(t, cls): removes the placeholder, adds an event at the bottom of the log and scrolls to it
    const bRead = btn(ctx, 'Start a reader', () => paint(startReader()), 'sm proc');  // bRead: starts a new reader
    const bCopy = btn(ctx, '1 · Copy &amp; change', () => paint(copy()), 'sm os');  // bCopy: writer step 1, copy the current version and change the copy
    const bPub = btn(ctx, '2 · Publish', () => paint(publish()), 'sm os');  // bPub: writer step 2, publish the new version by switching gp to it
    const bSync = btn(ctx, '3 · synchronize_rcu', () => paint(wait('sync')), 'sm ok');  // bSync: writer step 3, the blocking way: wait in synchronize_rcu
    const bCall = btn(ctx, '3 · call_rcu', () => paint(wait('call')), 'sm ok');  // bCall: writer step 3, the non-blocking way: queue a callback with call_rcu
    const bFree = btn(ctx, 'kfree(old) now', () => paint(freeNow()), 'sm intr');  // bFree: the mistake to try: free the old version at once, without a grace period
    const V = (id) => S.vers.find((v) => v.id === id);  // V(id): finds the version card data with that number
    function reset() {  // reset(): starts the RCU lab over
      gen++; auto = false;  // bumps gen so a running demonstration stops, and gives control back to the student
      S = { vers: [{ id: 1, val: 30, st: 'current' }], cur: 1, draft: null, old: null, rd: [], nextR: 1, G: [], w: 'idle', freedEarly: false };  // fresh state: only version 1 (timeout 30) exists and is current, no readers, no grace period, writer idle
      log.replaceChildren(h('div', { class: 'ph' }, 'Events appear here, oldest first.'));  // clears the log and shows a grey placeholder
      paint(['info', '<code>gp</code> points to version 1 of a settings record (timeout = 30). Start a couple of readers, then update the record as the writer: steps 1, 2, 3.']);  // explains the starting point and suggests starting readers before updating as the writer
    }  // ends reset
    function startReader() {  // startReader(): a new reader starts and returns the message to show
      const r = { id: S.nextR++, ver: S.cur, bad: false };  // the reader gets the next number and remembers the version gp points to right now
      S.rd.push(r);  // adds it to the list of active readers
      note(`R${r.id}: rcu_read_lock, reads version ${r.ver}`);  // logs which version it reads
      return ['info', `R${r.id} calls <code>rcu_read_lock()</code> and <code>rcu_dereference(gp)</code>: it reads <b>version ${r.ver}</b>. No lock taken, no shared write, nothing to wait for.`];  // message: the reader takes no lock and writes nothing shared, so it never waits
    }  // ends startReader
    function finish(r) {  // finish(r): reader r ends its read and returns the message to show
      S.rd = S.rd.filter((x) => x !== r);  // removes it from the active readers
      const inG = S.G.includes(r.id);  // inG: whether the grace period was waiting for this reader
      S.G = S.G.filter((x) => x !== r.id);  // takes it off the grace period's waiting list
      note(`R${r.id}: rcu_read_unlock` + (r.bad ? ' (it was reading freed memory!)' : ''), r.bad ? 'bad' : '');  // logs the unlock, in red if it had been reading freed memory
      if (r.bad) return ['bad', `R${r.id} finishes, but it spent its read looking at <b>freed memory</b>. In a real kernel that is a crash or silent corruption.`];  // red message if it was reading freed memory: in a real kernel a crash or silent corruption
      if (inG && !S.G.length && (S.w === 'sync' || S.w === 'call')) return endGrace(r);  // if it was the last reader the grace period waited for, the grace period ends now
      return ['info', `R${r.id} calls <code>rcu_read_unlock()</code>.` + (inG ? ` The grace period still waits for ${S.G.map((x) => 'R' + x).join(', ')}.` : '')];  // otherwise a plain message, naming any readers the grace period still waits for
    }  // ends finish
    function endGrace(r) {  // endGrace(r): the grace period is over and the old version is freed safely; r is the last reader, or null
      const how = S.w === 'sync' ? '<code>synchronize_rcu()</code> returns and the writer calls <code>kfree(old)</code>' : 'the <code>call_rcu</code> callback runs and frees the old copy';  // how: the way the old copy gets freed, depending on whether the writer chose synchronize_rcu or call_rcu
      note(`grace period over → version ${S.old} freed`, 'ok');  // logs that the old version is freed
      V(S.old).st = 'freed'; S.old = null; S.w = 'idle';  // marks the old version freed, forgets it and makes the writer idle again
      return ['ok', (r ? `R${r.id} was the last reader that could see the old version. ` : 'No reader could still see the old version. ') + `<b>Grace period over:</b> ${how}. Nobody was using it, so this is safe.`];  // green message: no reader can still see the old version, so freeing it is safe
    }  // ends endGrace
    function copy() {  // copy(): writer step 1, make a changed copy of the current version
      const top = Math.max(...S.vers.map((v) => v.id)) + 1, val = V(S.cur).val + 10;  // top is the next unused version number; val is the copy's timeout, 10 more than the current one
      S.vers = S.vers.filter((v) => v.st !== 'freed');  // forgets versions that were already freed, so the row does not grow forever
      S.vers.push({ id: top, val, st: 'draft' }); S.draft = top; S.w = 'drafted';  // adds the new draft version and remembers it; the writer now has a copy ready
      note(`writer: copies version ${S.cur} → version ${top}, timeout = ${val}`);  // logs the copy
      return ['info', `The writer allocates new memory, copies version ${S.cur} into it, and changes the copy: <b>version ${top}</b>, timeout = ${val}. Readers cannot see it yet: <code>gp</code> still points at version ${S.cur}.`];  // message: the writer copied and changed the record, but readers still see the current one through gp
    }  // ends copy
    function publish() {  // publish(): writer step 2, make the draft the version everyone sees
      S.old = S.cur; S.cur = S.draft; S.draft = null;  // the current version becomes the old one, and the draft becomes current
      V(S.old).st = 'old'; V(S.cur).st = 'current'; S.w = 'published';  // updates the card states to match and records that the writer has published
      S.G = S.rd.filter((r) => r.ver === S.old).map((r) => r.id);  // G: every reader still holding the old version; the grace period must wait for them
      note(`writer: rcu_assign_pointer → gp = version ${S.cur}`, 'warn');  // logs the pointer switch
      return ['warn', `<code>rcu_assign_pointer(gp, new)</code>: one pointer store switches <code>gp</code> to version ${S.cur}. New readers see it at once. ` + (S.G.length ? `But ${S.G.map((x) => 'R' + x).join(', ')} may still be using version ${S.old}, so it must not be freed yet.` : `No reader is using version ${S.old}.`)];  // amber message: one pointer store switches gp; new readers see the new version, but the old one cannot be freed yet if anyone uses it
    }  // ends publish
    function wait(kind) {  // wait(kind): writer step 3, with kind 'sync' (synchronize_rcu) or 'call' (call_rcu)
      S.w = kind;  // records how the writer is waiting
      note(`writer: ${kind === 'sync' ? 'synchronize_rcu() waits' : 'call_rcu() queues a callback'}` + (S.G.length ? ` for ${S.G.map((x) => 'R' + x).join(', ')}` : ''));  // logs the call and which readers it waits for
      if (!S.G.length) return endGrace(null);  // if nobody uses the old version, the grace period ends at once
      return ['info', kind === 'sync' ? `<code>synchronize_rcu()</code> blocks the writer until every reader that might see version ${S.old} has finished: ${S.G.map((x) => 'R' + x).join(', ')}. Readers that start now get version ${S.cur} and are not waited for.${auto ? '' : ' Finish the readers.'}`  // synchronize_rcu message: the writer is blocked until the listed readers finish; new readers are not waited for
        : `<code>call_rcu()</code> registers a callback and returns at once, so the writer goes on with other work. The callback will free version ${S.old} after ${S.G.map((x) => 'R' + x).join(', ')} ${S.G.length === 1 ? 'finishes' : 'finish'}.`];  // call_rcu message: the call returns at once and a callback will free the old version after the listed readers finish
    }  // ends wait
    function freeNow() {  // freeNow(): the mistake: free the old version without waiting
      const victims = S.rd.filter((r) => r.ver === S.old);  // victims: readers still holding the old version
      V(S.old).st = 'freed'; S.old = null; S.w = 'idle';  // marks it freed at once and makes the writer idle
      victims.forEach((r) => (r.bad = true)); S.G = [];  // those readers are now reading freed memory; there is no longer a grace period to wait for
      note('writer: kfree(old) with no grace period' + (victims.length ? ` → ${victims.map((r) => 'R' + r.id).join(', ')} now read freed memory` : ''), victims.length ? 'bad' : 'warn');  // logs the free, in red if any reader was hit
      return victims.length ? ['bad', `<b>Use after free.</b> ${victims.map((r) => 'R' + r.id).join(', ')} still ${victims.length === 1 ? 'holds' : 'hold'} a pointer to the freed version. The memory may already hold something else. This is exactly what the grace period prevents.`]  // red "Use after free" message naming the affected readers and explaining what the grace period prevents...
        : ['warn', 'No reader happened to be using the old version, so nothing broke this time. But the writer could not know that without waiting for a grace period.'];  // ...or an amber message: nothing broke this time, but the writer could not have known without waiting
    }  // ends freeNow
    function paint(v) {  // paint(v): redraws versions, readers, grace period and buttons; v is an optional [tone, message]
      const vcard = (x) => h('div', { class: 'ver ' + x.st },  // vcard(x): builds one version card, styled by its state (current, draft, old or freed)
        h('b', {}, 'version ' + x.id), h('span', { class: 'mono small' }, 'timeout = ' + x.val),  // the card shows its version number and its timeout value
        h('span', { class: 'xs b' }, { current: 'current', draft: 'draft: nobody sees it', old: 'old: maybe in use', freed: 'FREED' }[x.st]));  // and a label for its state: current, draft (nobody sees it), old (maybe in use) or FREED; closes the card
      const others = S.vers.filter((x) => x.id !== S.cur);  // others: every version except the current one
      verBox.replaceChildren(h('span', { class: 'gp' }, 'gp →'), vcard(V(S.cur)), ...(others.length ? [h('span', { class: 'xs b muted', style: { alignSelf: 'center' } }, 'ALSO IN MEMORY:'), ...others.map(vcard)] : []));  // the version row: "gp →", the current version, then any other versions still in memory
      rdBox.replaceChildren(...(S.rd.length ? S.rd.map((r) => h('div', { class: 'rd' + (r.bad ? ' bad' : '') },  // one card per active reader, red if it reads freed memory...
        h('b', {}, 'R' + r.id), h('span', { class: 'small' }, r.bad ? 'reading FREED memory' : 'reading version ' + r.ver), Object.assign(btn(ctx, 'finish', () => paint(finish(r)), 'sm ghost'), { disabled: auto }))) : [h('span', { class: 'xs muted' }, 'No readers right now.')]));  // ...with its name, what it reads and a finish button (disabled during the demonstration), or "No readers right now"
      gpBox.replaceChildren(h('span', { class: 'xs b muted' }, 'GRACE PERIOD:'), ...(S.old && S.G.length ? S.G.map((x) => h('span', { class: 'chip warn' }, 'waiting for R' + x)) : [h('span', { class: 'xs muted' }, S.old ? 'nobody to wait for' : 'none in progress')]),  // the grace period row: one amber chip per reader still being waited for, or a note that there is nothing to wait for...
        h('span', { class: 'grow' }), h('span', { class: 'chip ' + (S.w === 'sync' ? 'os pulse' : S.w === 'call' ? 'ok' : '') }, { idle: 'writer idle', drafted: 'writer: copy ready', published: 'writer: published', sync: 'writer blocked in synchronize_rcu', call: 'writer free; callback queued' }[S.w]));  // ...then a spacer and a chip describing the writer, pulsing while it is blocked in synchronize_rcu
      bRead.disabled = auto || S.rd.length >= 4; bCopy.disabled = auto || S.w !== 'idle'; bPub.disabled = auto || S.w !== 'drafted';  // enables Start a reader (at most 4 readers), Copy only when the writer is idle, and Publish only after a copy
      bSync.disabled = bCall.disabled = bFree.disabled = auto || S.w !== 'published';  // the three step-3 buttons work only right after publishing; during the demonstration every button is off
      if (v) say.say(v[0], v[1]);  // shows the message in the narration box if one was given
      log.scrollTop = log.scrollHeight;  // keeps the log scrolled to the newest event
    }  // ends paint
    async function demo() {  // demo(): plays a complete update by itself so the student can watch the whole sequence once
      reset(); auto = true; const g = gen;  // starts over, locks the buttons (auto) and remembers this reset in g
      paint(['info', '<b>Watch a full update.</b> Two readers start on version 1, then the writer copies, publishes and waits out the grace period. The buttons unlock when it ends.']);  // explains what the demonstration will show
      const seq = [startReader, startReader, copy, publish, startReader, () => wait('sync'), () => finish(S.rd[0]), () => finish(S.rd[0])];  // the script: two readers start, the writer copies and publishes, a third reader starts, synchronize_rcu, then the first two finish
      for (const f of seq) { await ctx.sleep(1500); if (!ctx.alive || g !== gen) return; paint(f()); }  // runs each action every 1.5 seconds and shows its message, quitting if the slide was left or the lab was reset
      auto = false; paint();  // gives the buttons back to the student and redraws
    }  // ends demo
    reset();  // sets the starting state when the tab opens
    panel.append(h('div', { class: 'stack gap-s fill' },  // builds the tab's layout as a stack that fills the panel's height
      verBox, rdBox, gpBox,  // the version row, the reader cards and the grace period row
      h('div', { class: 'row gap-s' }, bRead, h('span', { class: 'grow' }), btn(ctx, 'Watch a full update', () => demo(), 'sm'), btn(ctx, 'Reset', () => reset(), 'sm ghost')),  // a row with Start a reader, a spacer, and the Watch a full update and Reset buttons
      h('div', { class: 'row gap-s' }, bCopy, bPub, bSync, bCall, bFree),  // a row with the writer's buttons: copy, publish, the two ways to wait, and the early free
      say, log));  // the narration box and the log; closes the stack
    return () => { gen++; };  // hands back a tidy-up function that bumps gen, so a running demonstration stops when the student leaves this tab
  }  // ends rcuLab

  Guide.section({  // registers section 6.8 with the guide; the object below holds everything the section shows
    id: '6.8',  // the section number, used in links, the progress list and saved progress
    title: 'Linux Kernel Concurrency Mechanisms',  // the full title shown at the top of every step
    short: 'Linux kernel locks',  // the short name used in the side menu and progress list
    summary: 'Real-time signals, atomic operations, spinlocks, kernel semaphores, barriers and RCU inside Linux.',  // one-sentence summary shown on the chapter page
    objectives: [  // what the student should be able to do after this section, shown on its first page
      'Contrast real-time signals with standard signals: queuing, delivery order and the value they carry.',  // objective 1: compare real-time and standard signals
      'Use atomic integer and bitmap operations, and explain why atomic_t is a separate type.',  // objective 2: atomic integer and bit operations, and why atomic_t is its own type
      'Decide between spinning and sleeping, and pick the right spinlock variant when interrupt handlers share the data.',  // objective 3: spin or sleep, and which spinlock variant to use with interrupt handlers
      'Use kernel semaphores, mutexes and reader-writer locks, including down_interruptible and down_trylock.',  // objective 4: kernel semaphores, mutexes and reader-writer locks
      'Explain how memory barriers and read-copy-update (RCU) keep data consistent without stopping readers.',  // objective 5: memory barriers and RCU
    ],  // closes the objectives list
    terms: [  // key terms for the glossary, each written as [term, definition]
      ['Real-time signal (RT signal)', 'A Linux signal numbered from SIGRTMIN to SIGRTMAX. Each copy that is successfully sent is queued separately (the queue is finite, so sigqueue can fail with EAGAIN when it is full), pending ones are delivered lowest number first, and each queued copy keeps its own small value (sent with sigqueue).'],  // glossary entry: real-time signal (each successful send queued in a finite queue, lowest number first, one value per copy)
      ['Standard signal', 'One of the classic UNIX signals such as SIGINT, SIGTERM or SIGUSR1. It does not queue: copies sent while one is pending are merged into it, and only the first copy’s information is kept. Sent with kill it carries no value; on Linux, sigqueue can attach one.'],  // glossary entry: standard signal (copies merge, keeping the first; a value only when sent with sigqueue)
      ['atomic_t', 'A Linux kernel integer type that can be used only through the atomic_ functions, so the compiler cannot apply ordinary arithmetic to it by mistake or optimize its accesses away.'],  // glossary entry: atomic_t
      ['Atomic integer operation', 'A kernel function such as atomic_inc or atomic_dec_and_test that reads, changes and writes an atomic_t as one indivisible step.'],  // glossary entry: atomic integer operation
      ['Atomic bitmap operation', 'A kernel function such as set_bit or test_and_set_bit that changes or tests one bit of an ordinary memory word as one indivisible step.'],  // glossary entry: atomic bitmap operation
      ['Reference count', 'A counter of how many users currently hold an object. Each user adds one when it starts and subtracts one when it is done; the user that brings it to 0 frees the object.'],  // glossary entry: reference count
      ['Process context', 'Kernel code running on behalf of a process, for example inside a system call. It is allowed to sleep.'],  // glossary entry: process context
      ['Interrupt context', 'Kernel code running because a device interrupted, such as an interrupt handler. It runs on no process’s behalf and must never sleep.'],  // glossary entry: interrupt context
      ['Bottom half (softirq)', 'Work that an interrupt handler postpones so it can run a little later with interrupts enabled. Also called deferred work or software interrupts.'],  // glossary entry: bottom half (softirq)
      ['Reader-writer spinlock (rwlock_t)', 'A spinlock that lets many readers hold it together, or one writer alone (on ordinary kernels; under PREEMPT_RT it becomes a sleeping lock). The classic design favours readers, so a steady stream of readers can starve a writer.'],  // glossary entry: reader-writer spinlock (rwlock_t), which sleeps instead of spinning on real-time kernels
      ['Kernel semaphore', 'A semaphore used only by kernel code and invisible to user programs. down is its semWait and up is its semSignal; a waiter sleeps instead of spinning.'],  // glossary entry: kernel semaphore
      ['down_interruptible', 'The usual way kernel code waits on a semaphore: it sleeps, but a signal wakes it early, and it then returns -EINTR without taking the semaphore.'],  // glossary entry: down_interruptible
      ['Linux mutex', 'A sleeping lock that one task holds at a time and only the holder may release. Linux now prefers it to a binary semaphore for plain mutual exclusion.'],  // glossary entry: Linux mutex
      ['Reader-writer semaphore (rw_semaphore)', 'A sleeping lock that admits many readers at once or a single writer, used with down_read/up_read and down_write/up_write.'],  // glossary entry: reader-writer semaphore (rw_semaphore)
      ['Memory reordering', 'The compiler or the processor carrying out loads and stores in a different order from the program text, to run faster. A single thread cannot tell, but another processor can.'],  // glossary entry: memory reordering
      ['Memory barrier (mb, rmb, wmb)', 'An instruction that forbids reordering across it: rmb() orders loads, wmb() orders stores, and mb() orders both.'],  // glossary entry: memory barrier (mb, rmb, wmb)
      ['Compiler barrier (barrier())', 'A marker that stops the compiler from moving memory accesses across it. It emits no instruction, so the processor itself may still reorder.'],  // glossary entry: compiler barrier (barrier())
      ['Read-copy-update (RCU)', 'A kernel technique for data that is read far more than written: readers take no lock, a writer updates a copy and publishes it by switching one pointer, and the old copy is freed only after a grace period.'],  // glossary entry: read-copy-update (RCU)
      ['Grace period', 'In RCU, a wait long enough that every reader that might still be using the old version has finished. After it, the old version can be freed safely.'],  // glossary entry: grace period
      ['Read-side critical section', 'In RCU, the code between rcu_read_lock() and rcu_read_unlock(). A reader may use RCU-protected data only inside it.'],  // glossary entry: read-side critical section
    ],  // closes the terms list
    css: ` /* the styles used only by this section; every rule starts with .sec-6-8 so it cannot affect other sections */
      .sec-6-8 pre.code { contain: inline-size; } /* lets code listings shrink to their box's width instead of pushing the layout wider than the screen */
      .sec-6-8 .vbox { border-radius: 12px; padding: 8px 12px; border: 1px solid var(--line); border-left: 5px solid var(--accent); background: var(--panel-2); font-size: 15px; line-height: 1.45; } /* the narration box: rounded, with a thick indigo bar on its left edge (recoloured by tone below) and 15-pixel text */
      .sec-6-8 .vbox.ok { border-left-color: var(--ok); background: var(--ok-bg); } /* narration tone ok: green bar and pale green background */
      .sec-6-8 .vbox.bad { border-left-color: var(--bad); background: var(--bad-bg); } /* narration tone bad: red bar and pale red background */
      .sec-6-8 .vbox.warn { border-left-color: var(--warn); background: var(--warn-bg); } /* narration tone warn: amber bar and pale amber background */
      .sec-6-8 .vbox.info { border-left-color: var(--info); background: var(--info-bg); } /* narration tone info: blue bar and pale blue background */
      .sec-6-8 .cell { border: 2px solid var(--mem); background: var(--mem-bg); border-radius: 10px; padding: 3px 8px; text-align: center; min-width: 0; } /* value box: a rounded box with a memory-coloured (green) border, its contents centred */
      .sec-6-8 .cell .nm { font-family: var(--mono); font-size: 13px; font-weight: 700; color: var(--ink-2); } /* value box label: small bold code-style text in a softer colour */
      .sec-6-8 .cell .v { font-family: var(--mono); font-size: 22px; font-weight: 800; line-height: 1.25; } /* value box value: large heavy code-style digits so the number stands out */
      .sec-6-8 .cell.cpu { border-color: var(--cpu); background: var(--cpu-bg); } /* value box tinted as a CPU register (processor blue) */
      .sec-6-8 .cell.os { border-color: var(--os); background: var(--os-bg); } /* value box tinted as kernel data (operating-system purple) */
      .sec-6-8 .log > div.bad { color: var(--bad); font-weight: 700; } /* log lines marked bad appear in bold red */
      .sec-6-8 .log > div.ok { color: var(--ok); font-weight: 700; } /* log lines marked ok appear in bold green */
      .sec-6-8 .log > div.warn { color: var(--warn); font-weight: 700; } /* log lines marked warn appear in bold amber */
      .sec-6-8 .log > div.ph { color: var(--muted); } /* the grey placeholder line shown before the log has entries */
      .sec-6-8 .band { border-radius: 12px; padding: 8px 10px; display: flex; flex-direction: column; gap: 6px; } /* band: a rounded column used for the user-space and kernel-space areas of the toolbox diagram */
      .sec-6-8 .band > .xs { letter-spacing: .06em; color: var(--muted); } /* the band's small heading, letter-spaced and grey */
      .sec-6-8 .band.user { background: var(--proc-bg); border: 1px dashed var(--proc); } /* user-space band: pale process-teal fill with a dashed border */
      .sec-6-8 .band.kern { background: var(--os-bg); border: 1px dashed var(--os); } /* kernel-space band: pale operating-system purple fill with a dashed border */
      .sec-6-8 .kgrid { display: grid; grid-template-columns: 210px minmax(0, 1fr); gap: 12px; min-height: 0; flex: 1; } /* kgrid: the kernel band's two columns, a 210-pixel column of tool buttons and the description beside it */
      .sec-6-8 .tool { display: flex; flex-direction: column; align-items: flex-start; gap: 1px; text-align: left; padding: 6px 10px; border-radius: 10px; border: 2px solid var(--line-2); background: var(--panel); color: var(--ink); cursor: pointer; font-size: 15px; line-height: 1.2; } /* tool button: a rounded, left-aligned button with the tool's name above a short note */
      .sec-6-8 .tool .xs { color: var(--muted); font-weight: 600; } /* the tool button's small note, grey and semi-bold */
      .sec-6-8 .tool.cpu { border-color: var(--cpu); } .sec-6-8 .tool.warn { border-color: var(--warn); } .sec-6-8 .tool.os { border-color: var(--os); } /* tool button borders in the processor, warning and operating-system colours */
      .sec-6-8 .tool.mem { border-color: var(--mem); } .sec-6-8 .tool.ok { border-color: var(--ok); } .sec-6-8 .tool.proc { border-color: var(--proc); } /* tool button borders in the memory, success and process colours */
      .sec-6-8 .tool[aria-pressed="true"] { background: var(--hl); box-shadow: 0 0 0 2px var(--chc); } /* the tool button that is open gets a yellow highlighter background and a ring in the chapter colour */
      .sec-6-8 .tooldesc { background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 10px 14px; display: flex; flex-direction: column; gap: 8px; font-size: 15.5px; line-height: 1.45; } /* tooldesc: the description panel for the chosen tool, with comfortable text size and spacing */
      .sec-6-8 .tooldesc .xs { letter-spacing: .06em; color: var(--chc); } /* the description panel's small heading, letter-spaced in the current chapter's colour */
      .sec-6-8 .pbox { border: 1px solid var(--line); border-radius: 10px; background: var(--panel); padding: 6px 8px; display: flex; flex-direction: column; gap: 6px; min-height: 104px; } /* pbox: a rounded panel that holds the pending signals of one kind, at least 104 pixels tall */
      .sec-6-8 .sigrow { display: grid; grid-template-columns: auto 26px minmax(0, 1fr); gap: 8px; align-items: center; } /* sigrow: one standard signal per row: its name, a 26-pixel pending-bit box and a status note */
      .sec-6-8 .sigrow .bit { display: grid; place-items: center; width: 26px; height: 26px; border-radius: 6px; border: 2px solid var(--line-2); font-family: var(--mono); font-weight: 800; } /* the pending-bit box: a small square with a grey border and the 0 or 1 in bold code-style text */
      .sec-6-8 .sigrow.on .bit { border-color: var(--proc); background: var(--proc-bg); color: var(--proc); } /* a pending standard signal turns its bit box process teal */
      .sec-6-8 .rtq { display: flex; flex-wrap: wrap; gap: 5px; align-content: flex-start; } /* rtq: the real-time queue, whose entries wrap onto new lines as it grows */
      .sec-6-8 .rtok { display: inline-flex; flex-direction: column; align-items: center; padding: 2px 7px; border-radius: 8px; border: 2px solid var(--thread); background: var(--thread-bg); font-family: var(--mono); font-size: 13px; font-weight: 700; line-height: 1.2; } /* rtok: one queued real-time signal, drawn as a pink token with its name above its value */
      .sec-6-8 .rtok i { font-style: normal; font-family: var(--font); font-size: 12.5px; color: var(--ink-2); font-weight: 600; } /* the value line inside each token, in ordinary text rather than code-style */
      .sec-6-8 pre.code .gut { display: inline-flex; gap: 2px; width: 50px; vertical-align: top; } /* gut: the gutter in front of each code line, 50 pixels wide, where CPU markers sit */
      .sec-6-8 pre.code .mk { font-style: normal; font-family: var(--font); font-size: 11px; font-weight: 800; line-height: 1; padding: 3px 4px; border-radius: 5px; color: var(--accent-ink); } /* mk: a CPU marker tag, small bold text on a coloured rounded background */
      .sec-6-8 pre.code .mk.c0 { background: var(--cpu); } .sec-6-8 pre.code .mk.c1 { background: var(--thread); } /* CPU 0 markers are processor blue; CPU 1 markers are thread pink */
      .sec-6-8 pre.code .ln.on2 { background: color-mix(in srgb, var(--ink) 8%, transparent); border-left-color: var(--ink-2); } /* a line with both CPUs on it gets a light grey tint and a darker left edge */
      .sec-6-8 pre.code .ln.on1[data-who="0"] { background: color-mix(in srgb, var(--cpu) 14%, transparent); border-left-color: var(--cpu); } /* a line with only CPU 0 on it gets a pale blue tint and a blue left edge */
      .sec-6-8 pre.code .ln.on1[data-who="1"] { background: color-mix(in srgb, var(--thread) 14%, transparent); border-left-color: var(--thread); } /* a line with only CPU 1 on it gets a pale pink tint and a pink left edge */
      .sec-6-8 .racegrid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; align-items: start; } /* racegrid: three equal columns for CPU 0, CPU 1 and the shared count */
      .sec-6-8 .racegrid .stack { align-items: stretch; text-align: center; } /* the columns' contents stretch to full width and are centred */
      .sec-6-8 .opgrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; } /* opgrid: two equal columns of operation buttons */
      .sec-6-8 .opbtn { font-family: var(--mono); font-size: 13px; justify-content: flex-start; } /* operation buttons use code-style 13-pixel text, aligned to the left */
      .sec-6-8 .bits { display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); gap: 5px; } /* bits: eight equal columns, one per bit of the flags word */
      .sec-6-8 .bitcell { display: flex; flex-direction: column; align-items: center; gap: 0; padding: 3px 0 5px; border-radius: 9px; border: 2px solid var(--line-2); background: var(--panel); color: var(--ink); cursor: pointer; } /* bitcell: one clickable bit, a rounded box with its label above its value */
      .sec-6-8 .bitcell b { font-family: var(--mono); font-size: 22px; line-height: 1.1; } /* the bit's value: large bold code-style digit */
      .sec-6-8 .bitcell .xs { color: var(--muted); } /* the small "bit x" label in grey */
      .sec-6-8 .bitcell.one { background: var(--mem-bg); border-color: var(--mem); } /* a bit that is 1 gets the pale green memory fill and border */
      .sec-6-8 .bitcell[aria-pressed="true"] { border-color: var(--chc); box-shadow: inset 0 0 0 2px var(--chc); } /* the chosen bit (nr) gets a ring in the chapter colour */
      .sec-6-8 .wbars { display: grid; grid-template-columns: auto minmax(0, 1fr) 86px; gap: 6px 10px; align-items: center; } /* wbars: the cost comparison under the spinlock timeline: label, bar and value on each row */
      .sec-6-8 .wbars > b { font-family: var(--mono); text-align: right; } /* bold code-style numbers on the left, right-aligned */
      .sec-6-8 .meter.spin > i { background: var(--warn); } .sec-6-8 .meter.sleep > i { background: var(--bad); } /* the spinning cost bar is amber and the sleeping cost bar is red, matching the timeline colours */
      .sec-6-8 table.tbl.vt td, .sec-6-8 table.tbl.vt th { font-size: 13.5px; line-height: 1.35; } /* makes table text in this section a little smaller so the tables fit beside the lab */
      .sec-6-8 table.tbl.vt td:first-child { white-space: nowrap; } /* keeps a table's first column (the function name) on one line */
      .sec-6-8 .taskrow { display: grid; grid-template-columns: 150px minmax(0, 1fr); gap: 8px; align-items: center; padding: 4px 8px; border: 1px solid var(--line); border-radius: 10px; background: var(--panel); } /* taskrow: one row per task in the semaphore lab: a 150-pixel name column, then its buttons */
      .sec-6-8 .taskrow .row { gap: 4px; } /* tighter spacing between a task's buttons */
      .sec-6-8 .taskrow .btn.sm { height: 27px; padding: 0 7px; font-size: 13px; } /* shorter, smaller task buttons so all five fit on one row */
      .sec-6-8 .st-ok { color: var(--ok); font-weight: 700; } .sec-6-8 .st-os { color: var(--os); font-weight: 700; } /* state text colours: green for a task holding a unit, purple for a sleeping task */
      .sec-6-8 .rwroom { border: 2px solid var(--proc); background: var(--proc-bg); border-radius: 12px; padding: 8px 12px; min-height: 64px; display: flex; flex-direction: column; gap: 6px; } /* rwroom: the teal box showing who holds the reader-writer lock */
      .sec-6-8 .ordgrid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 5px; } /* ordgrid: six equal columns of buttons, one per possible memory order */
      .sec-6-8 .ordbtn { font-family: var(--mono); font-size: 13px; font-weight: 700; padding: 4px 2px; border-radius: 8px; border: 2px solid var(--line-2); background: var(--panel); color: var(--ink); cursor: pointer; white-space: nowrap; } /* ordbtn: one memory-order button, code-style bold text on a rounded box */
      .sec-6-8 .ordbtn.stale { border-color: var(--bad); background: var(--bad-bg); color: var(--bad); } /* an order that gives a stale read is red */
      .sec-6-8 .ordbtn.ok { border-color: var(--ok); } /* an order that gives the correct value has a green border */
      .sec-6-8 .ordbtn.on { box-shadow: inset 0 0 0 2px var(--chc); background: var(--hl); color: var(--ink); } /* the selected order gets a ring in the chapter colour and a yellow highlight */
      .sec-6-8 .orddetail { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; } /* orddetail: four columns that spell out the selected order step by step */
      .sec-6-8 .ordstep { display: flex; flex-direction: column; gap: 1px; padding: 4px 8px; border-radius: 9px; border: 2px solid; line-height: 1.3; } /* ordstep: one step of that order, a rounded box with a coloured border */
      .sec-6-8 .ordstep.c0 { border-color: var(--cpu); background: var(--cpu-bg); } .sec-6-8 .ordstep.c1 { border-color: var(--thread); background: var(--thread-bg); } /* CPU 0 steps are processor blue and CPU 1 steps are thread pink */
      .sec-6-8 .vers { display: flex; gap: 8px; align-items: stretch; flex-wrap: wrap; } /* vers: the row of RCU version cards, wrapping to a new line when needed */
      .sec-6-8 .vers .gp { align-self: center; font-family: var(--mono); font-weight: 800; color: var(--os); } /* the "gp →" pointer label, bold purple, centred against the cards */
      .sec-6-8 .ver { display: flex; flex-direction: column; gap: 1px; padding: 6px 12px; border-radius: 10px; border: 2px dashed var(--line-2); background: var(--panel); min-width: 128px; } /* ver: one version card with a dashed border, at least 128 pixels wide */
      .sec-6-8 .ver.current { border: 2px solid var(--os); background: var(--os-bg); } /* the current version gets a solid purple border and fill */
      .sec-6-8 .ver.old { border: 2px solid var(--warn); background: var(--warn-bg); } /* the old version gets a solid amber border and fill, since it may still be in use */
      .sec-6-8 .ver.freed { border-color: var(--bad); color: var(--muted); text-decoration: line-through; } /* a freed version turns red and grey with its text struck through */
      .sec-6-8 .ver.freed .xs { color: var(--bad); text-decoration: none; } /* the FREED label itself stays red but is not struck through */
      .sec-6-8 .rds { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; min-height: 40px; align-items: center; } /* rds: the two-column grid of RCU reader cards */
      .sec-6-8 .rd { display: flex; align-items: center; gap: 6px; padding: 3px 4px 3px 10px; border-radius: 10px; border: 2px solid var(--proc); background: var(--proc-bg); } /* rd: one reader card, teal, with its name, what it reads and a finish button in a row */
      .sec-6-8 .rd .small { flex: 1; } /* the reader's description takes up the spare space in the card */
      .sec-6-8 .rd.bad { border-color: var(--bad); background: var(--bad-bg); color: var(--bad); } /* a reader reading freed memory turns red */
      .sec-6-8 .pickgrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; } /* pickgrid: two columns of tool buttons for the recap step's "Which tool fits?" scenarios */
      .sec-6-8 .pickgrid .btn { font-family: var(--mono); font-size: 14px; } /* those answer buttons use code-style 14-pixel text */
      .sec-6-8 .pickgrid .btn.ok { border-color: var(--ok); background: var(--ok-bg); color: var(--ok); opacity: 1; } /* a correct pick turns green and stays fully visible even when the button is disabled */
      .sec-6-8 .pickgrid .btn.no { border-color: var(--bad); background: var(--bad-bg); color: var(--bad); } /* a wrong pick turns red */
      .sec-6-8 .flip-face.back { font-size: 14px; } /* slightly smaller text on the back of the recap flash cards */
      @media (max-width: 760px) { .sec-6-8 table.tbl.vt td:first-child { white-space: normal; } .sec-6-8 .kgrid, .sec-6-8 .opgrid, .sec-6-8 .pickgrid, .sec-6-8 .rds, .sec-6-8 .racegrid { grid-template-columns: minmax(0, 1fr); } .sec-6-8 .ordgrid { grid-template-columns: repeat(3, minmax(0, 1fr)); } .sec-6-8 .orddetail { grid-template-columns: repeat(2, minmax(0, 1fr)); } .sec-6-8 .taskrow { grid-template-columns: minmax(0, 1fr); } .sec-6-8 .wbars { grid-template-columns: minmax(0, 1fr) 64px; } .sec-6-8 .wbars > span { grid-column: 1 / -1; } } /* small screens (760 pixels or less): table names may wrap, the grids collapse to one column, order grids to 3 and 2 columns, task rows stack */
    `,  // end of the stylesheet text
    steps: [  // steps: the list of screens in this section, in order
      /* ---------------- 1. Big picture: the toolbox ---------------- */
      {  // step 1 starts here
        title: 'One kernel, many CPUs, five kinds of tool',  // step 1 title
        kind: 'story',  // step kind: a story-style introduction
        render(el, ctx) {  // render(el, ctx): builds step 1 inside el when the student opens it
          const { h } = ctx;  // takes the HTML builder h out of ctx
          const TOOLS = {  // TOOLS: the six tools the toolbox diagram can describe, each with where it runs, how waiting works, what it is and when to use it
            rt: { name: 'Real-time signals', where: 'user', wait: 'Not a lock: a notification. Every copy is queued, so none is lost.',  // tool rt (real-time signals): for user programs, and nothing waits on it
              what: 'A signal that queues every copy, is delivered lowest number first, and can carry a value.',  // what a real-time signal is: queued, ordered and able to carry a value
              use: 'Programs that must react to many events, such as a server telling a worker which of 20 streams has new data.', step: 2 },  // example use for real-time signals, and the step (2) that covers them
            atomic: { name: 'Atomic operations', where: 'kernel', wait: 'Nobody waits: the hardware runs the whole read-change-write as one step.',  // tool atomic: runs in the kernel, and nobody waits
              what: 'One read-modify-write of a counter or a bit that no other CPU can split in two.',  // what an atomic operation is: one read-modify-write that cannot be split
              use: 'Counters and flags: packets received, how many users share an object.', step: 3 },  // example use for atomic operations (counters, flags), covered in step 3
            spin: { name: 'Spinlocks', where: 'kernel', wait: 'A waiter <b>spins</b>: it loops on its CPU, testing the lock again and again.',  // tool spin: a waiter spins on its CPU
              what: 'A lock word that one CPU holds at a time.',  // what a spinlock is: a lock word one CPU holds at a time
              use: 'Very short critical sections, including ones shared with interrupt handlers.', step: '4–5' },  // example use for spinlocks (very short sections, interrupt handlers), covered in steps 4 and 5
            sem: { name: 'Semaphores and mutexes', where: 'kernel', wait: 'A waiter <b>sleeps</b> on a queue, and its CPU runs something else meanwhile.',  // tool sem: a waiter sleeps and its CPU does other work
              what: 'The semaphores of chapter 5, built for kernel code, plus the simpler mutex.',  // what kernel semaphores and mutexes are
              use: 'Longer critical sections in process context, especially code that may itself sleep.', step: 6 },  // example use for sleeping locks (longer sections that may sleep), covered in step 6
            bar: { name: 'Memory barriers', where: 'kernel', wait: 'Not a lock at all, so nobody waits. A barrier only fixes the order of memory accesses.',  // tool bar: memory barriers are not locks, so nobody waits
              what: 'A fence that stops the compiler and the processor from reordering loads and stores across it.',  // what a memory barrier is: a fence against reordering
              use: 'Handing data to another CPU with a flag; they are also hidden inside every lock.', step: 7 },  // example use for barriers (handing data over with a flag), covered in step 7
            rcu: { name: 'Read-copy-update (RCU)', where: 'kernel', wait: 'Readers <b>never</b> wait. A writer waits for old readers before freeing the old copy.',  // tool rcu: readers never wait; the writer waits for old readers
              what: 'Readers take no lock; a writer updates a copy and switches one pointer to it.',  // what RCU is: lock-free readers and a writer that switches one pointer
              use: 'Data read constantly and changed rarely, such as a routing table.', step: 8 },  // example use for RCU (a routing table), covered in step 8
          };  // closes the TOOLS table
          const say = h('div', { class: 'tooldesc' });  // say: the description panel beside the tool buttons
          const btns = {};  // btns: the tool buttons, stored by key so the open one can be marked
          function show(k) {  // show(k): opens tool k in the description panel
            const t = TOOLS[k];  // t: that tool's details
            Object.entries(btns).forEach(([kk, b]) => b.setAttribute('aria-pressed', String(kk === k)));  // marks only the chosen button as pressed, which also highlights it
            say.innerHTML = `<div class="xs b muted">${t.where === 'user' ? 'FOR USER PROGRAMS' : 'INSIDE THE KERNEL'} · STEP ${t.step}</div>`  // panel heading: user programs or kernel, and the step that covers it
              + `<h3 class="m0">${t.name}</h3>`  // the tool's name as a heading
              + `<p class="m0"><b>What:</b> ${t.what}</p>`  // the What line
              + `<p class="m0"><b>Waiting:</b> ${t.wait}</p>`  // the Waiting line
              + `<p class="m0"><b>Use it for:</b> ${t.use}</p>`;  // the Use it for line
          }  // ends show
          const tb = (k, sub, cls) => (btns[k] = h('button', { class: 'tool ' + cls, type: 'button', onclick: () => show(k) },  // tb(k, sub, cls): makes one tool button with a short note and a border colour, and stores it in btns
            h('b', {}, TOOLS[k].name), h('span', { class: 'xs' }, sub)));  // the button shows the tool's name in bold above the note
          const unix = ['pipes', 'messages', 'shared memory', 'semaphores', 'signals'].map((t) => h('span', { class: 'chip proc' }, t));  // unix: chips for the five UNIX tools from the previous section (pipes, messages, shared memory, semaphores, signals)
          show('rt');  // opens real-time signals first so the panel is never empty
          el.append(h('div', { class: 'split l fill' },  // the step's layout: text on the left, the toolbox diagram on the right, filling the height
            h('div', { class: 'stack' },  // the left column, stacked
              h('p', { class: 'lead m0', html: 'Linux gives programs every UNIX tool from 6.7, and adds one more: <span class="t" data-t="real-time signal">real-time signals</span>.' }),  // opening line: Linux keeps every UNIX tool and adds real-time signals
              h('p', { class: 'm0', html: 'The <span class="t">kernel</span> itself needs a bigger toolbox. Kernel code runs on several CPUs at the same instant, an <span class="t">interrupt</span> can cut in between any two instructions, and some data is touched millions of times a second. No single lock fits all of that.' }),  // paragraph: why kernel code needs more tools (many CPUs, interrupts, very busy data)
              h('p', { class: 'm0', html: 'So Linux offers a range, from one indivisible instruction up to a scheme in which readers never wait. Choosing well is a trade between <b>how long</b> the data is held and <b>who</b> touches it.' }),  // paragraph: the tools range from one instruction to waiter-free reading; the choice depends on how long and who
              h('div', { class: 'callout analogy m0', 'data-label': 'Analogy', html: 'A train station. A turnstile counter clicks once per person (atomic). A phone booth for a ten-second call: you stand outside and wait (spinlock). A ticket office: take a number and sit down (semaphore). The printed timetable: everyone reads it freely; staff print a new one, swap it in, and bin the old one once its readers walk away (RCU).' }),  // analogy callout: a train station, with a counter, a phone booth, a ticket office and a timetable for the tools
              h('div', { class: 'row gap-s' }, h('span', { class: 'xs b muted' }, 'COMING UP:'), ...['queue signals', 'lose an update', 'spin or sleep?', 'deadlock one CPU', 'reorder memory', 'publish with RCU'].map((t) => h('span', { class: 'chip accent' }, t)))),  // a row of chips previewing the hands-on steps ahead
            h('div', { class: 'card stack gap-s' },  // the right column: a card holding the toolbox diagram
              h('h4', { class: 'm0' }, 'Click a tool to open it'),  // card heading inviting the student to click a tool
              h('div', { class: 'band user' },  // the user-space band
                h('div', { class: 'xs b' }, 'USER SPACE · what programs use'),  // its heading
                h('div', { class: 'row gap-s' }, ...unix, h('span', { class: 'xs muted' }, '(6.7) +'), tb('rt', 'queued, ordered, carry a value', 'proc'))),  // the five UNIX chips, a "(6.7) +" note and the real-time signals button
              h('div', { class: 'band kern grow' },  // the kernel-space band, which stretches to fill the remaining height
                h('div', { class: 'xs b' }, 'KERNEL SPACE · what kernel code uses'),  // its heading
                h('div', { class: 'kgrid' },  // two-column grid: tool buttons on the left, description on the right
                  h('div', { class: 'stack gap-s' },  // the column of kernel tool buttons
                    tb('atomic', 'no waiting', 'cpu'),  // atomic operations button, blue border, note "no waiting"
                    tb('spin', 'waiter spins', 'warn'),  // spinlocks button, amber border, note "waiter spins"
                    tb('sem', 'waiter sleeps', 'os'),  // semaphores and mutexes button, purple border, note "waiter sleeps"
                    tb('bar', 'orders, does not lock', 'mem'),  // memory barriers button, green memory border, note "orders, does not lock"
                    tb('rcu', 'readers never wait', 'ok')),  // RCU button, green success border, note "readers never wait"; closes the column of buttons
                  say)))));  // the description panel beside the buttons; closes the grid, the band, the card and the layout
        },  // ends render for step 1
      },  // ends step 1

      /* ---------------- 2. Real-time signals vs standard signals ---------------- */
      {  // step 2 starts here: real-time signals compared with standard ones
        title: 'Real-time signals: queued, ordered, and carrying data',  // step 2 title
        kind: 'compare',  // step kind: a side-by-side comparison
        render(el, ctx) {  // render(el, ctx): builds step 2 when the student opens it
          const { h } = ctx;  // takes the HTML builder h out of ctx
          const STD = ['SIGUSR1', 'SIGUSR2'];  // STD: the two standard signals the student can send
          const RT = [0, 1, 3];  // RT: the real-time signals offered, as offsets from SIGRTMIN (0, 1 and 3)
          const rtName = (n) => (n ? 'SIGRTMIN+' + n : 'SIGRTMIN');  // rtName(n): writes offset n as a signal name, SIGRTMIN or SIGRTMIN+n
          let S, gen = 0, busy = false;  // S is the signal state, gen counts resets, busy blocks the buttons during delivery or the demo
          const stdBox = h('div', { class: 'stack gap-s' });  // stdBox: the list of standard signals with their single pending bits
          const rtBox = h('div', { class: 'rtq' });  // rtBox: the real-time queue, shown as a wrapping row of tokens
          const log = h('div', { class: 'log grow', style: { minHeight: '84px' } });  // log: the list of handler calls in delivery order, filling the remaining height
          const say = verdict(ctx);  // say: the narration box that explains each action
          const nextV = h('span', { class: 'chip accent' });  // nextV: a chip showing the value the next real-time signal will carry
          const sendBtns = [  // sendBtns: one Send button per signal
            ...STD.map((n) => btn(ctx, 'Send ' + n, () => send('std', n), 'sm proc')),  // teal buttons for the two standard signals
            ...RT.map((n) => btn(ctx, 'Send ' + rtName(n), () => send('rt', n), 'sm thread')),  // pink buttons for the three real-time signals
          ];  // closes the button list
          const bGo = btn(ctx, 'Unblock: deliver them', () => deliver(), 'sm primary');  // bGo: unblocks the receiver so the kernel delivers what is pending
          const bDemo = btn(ctx, 'Send a demo burst', () => demo(), 'sm');  // bDemo: sends a fixed burst of seven signals automatically
          const bReset = btn(ctx, 'Reset', () => reset(), 'sm ghost');  // bReset: starts the step over
          function reset() {  // reset(): clears everything back to the start
            gen++; busy = false;  // bumps gen so a running demo or delivery stops, and unblocks the buttons
            S = { sent: { SIGUSR1: 0, SIGUSR2: 0 }, handled: { SIGUSR1: 0, SIGUSR2: 0 }, pend: { SIGUSR1: false, SIGUSR2: false }, rtq: [], v: 1, total: 0, calls: 0 };  // fresh state: nothing sent, handled or pending, an empty real-time queue, values starting at 1
            log.replaceChildren(h('div', { class: 'ph' }, 'Handler calls appear here, in delivery order.'));  // clears the log and shows a grey placeholder
            paint();  // redraws the panels
            say.say('info', 'The receiver is busy and has these signals <b>blocked</b>, so everything you send waits as <i>pending</i>. Send a few of each kind (repeat some!), then unblock.');  // explains that the receiver has the signals blocked, so everything sent waits as pending
          }  // ends reset
          function paint() {  // paint(): redraws the pending bits, the queue and the buttons
            stdBox.replaceChildren(...STD.map((n) => h('div', { class: 'sigrow' + (S.pend[n] ? ' on' : '') },  // one row per standard signal, highlighted while it is pending...
              h('code', {}, n), h('span', { class: 'bit' }, S.pend[n] ? '1' : '0'),  // ...with its name and its pending bit, 1 or 0...
              h('span', { class: 'xs muted' }, !S.sent[n] ? 'nothing sent' : S.pend[n] ? `sent ${S.sent[n]}×, kept 1` : `sent ${S.sent[n]}×, handled ${S.handled[n]}×`))));  // ...and a note: nothing sent, how many were sent but only 1 kept, or how many were sent and handled
            rtBox.replaceChildren(...(S.rtq.length ? S.rtq.map((x) => h('span', { class: 'rtok' }, rtName(x.n), h('i', {}, 'value ' + x.v)))  // one token per queued real-time signal, showing its name and the value it carries...
              : [h('span', { class: 'xs muted' }, 'empty queue')]));  // ...or "empty queue"
            nextV.textContent = 'next value sent: ' + S.v;  // updates the next-value chip
            [...sendBtns, bGo, bDemo].forEach((b) => (b.disabled = busy));  // disables every send button and the action buttons while busy
            bGo.disabled = busy || !(S.pend.SIGUSR1 || S.pend.SIGUSR2 || S.rtq.length);  // Unblock works only when something is actually pending
          }  // ends paint
          function send(kind, n) {  // send(kind, n): sends one signal of the given kind
            if (busy) return;  // ignored while a delivery or the demo is running
            S.total++;  // counts every signal sent, for the summary later
            if (kind === 'std') {  // a standard signal...
              const dup = S.pend[n];  // dup is true if this signal was already pending
              S.sent[n]++; S.pend[n] = true;  // counts the send and sets the pending bit (setting it again changes nothing)
              say.say(dup ? 'warn' : 'info', dup ? `<code>kill(pid, ${n})</code>: ${n} was already pending. A standard signal has just one pending bit, so this copy is <b>merged</b> into it and nothing is added.` : `<code>kill(pid, ${n})</code>: ${n} is now pending and its bit is set. Send it again and watch what happens.`);  // amber message if this copy was merged into the pending one, otherwise a note that its bit is now set; both show the kill call that would send it
            } else {  // a real-time signal...
              S.rtq.push({ n, v: S.v });  // ...adds a new entry with its own value to the end of the queue
              say.say('ok', `<code>sigqueue(pid, ${rtName(n)}, ${S.v})</code>: a new entry joins the queue with value ${S.v}. Real-time copies are never merged.`);  // message: the sigqueue call that would send it, and that real-time copies are never merged
              S.v++;  // the next real-time signal will carry the next value
            }  // ends the choice of kind
            paint();  // redraws
          }  // ends send
          function order() {  // order(): works out the delivery order of everything pending
            const out = STD.filter((n) => S.pend[n]).map((n) => ({ std: true, n }));  // standard signals first (as Linux does), one call each however many copies were sent
            const rt = S.rtq.map((x, i) => ({ ...x, i })).sort((a, b) => a.n - b.n || a.i - b.i);  // then the real-time entries sorted by signal number, and in sending order for equal numbers
            return out.concat(rt);  // returns the full delivery order
          }  // ends order
          async function deliver() {  // deliver(): unblocks the receiver and plays the handler calls one at a time
            if (busy) return;  // ignored while already busy
            const seq = order();  // seq: the calls to make, in order
            if (!seq.length) return;  // nothing pending, nothing to do
            busy = true; const g = gen;  // blocks the buttons; g remembers this reset so a later reset can stop the delivery
            log.querySelector('.ph') && log.replaceChildren();  // clears the log if it still shows its placeholder
            say.say('info', 'Unblocked. The kernel hands pending signals to the handler one at a time…');  // explains that the kernel now hands the pending signals over one at a time
            for (const x of seq) {  // for each pending signal, in delivery order...
              paint();  // ...redraws first so the panels show what is still waiting
              await ctx.sleep(550);  // waits 0.55 seconds
              if (!ctx.alive || g !== gen) return;  // quits if the slide was left or the step was reset
              S.calls++;  // counts one more handler call
              if (x.std) { S.pend[x.n] = false; S.handled[x.n]++; log.append(h('div', { html: `${S.calls}. handler(<b>${x.n}</b>) · no value (kill sends none)` })); }  // standard signal: clears its bit, counts it as handled and logs a call with no value, since kill attaches none
              else { S.rtq.splice(S.rtq.findIndex((y) => y.n === x.n && y.v === x.v), 1); log.append(h('div', { class: 'ok', html: `${S.calls}. handler(<b>${rtName(x.n)}</b>, value ${x.v})` })); }  // real-time signal: removes that entry from the queue and logs a green call showing its value
              log.scrollTop = log.scrollHeight;  // keeps the newest call in view
            }  // ends the delivery loop
            busy = false; paint();  // unblocks the buttons and redraws
            const merged = S.total - S.calls;  // merged: how many signals were sent but never produced a handler call
            say.say(merged ? 'warn' : 'ok', `So far <b>${S.total}</b> signals were sent and the handler ran <b>${S.calls}</b> times. `  // summary: how many were sent and how many handler calls ran...
              + (merged ? `${merged} standard cop${merged === 1 ? 'y was' : 'ies were'} merged away and lost. ` : 'Nothing was merged. ')  // ...how many standard copies were merged away, or that none were...
              + 'Standard signals went first (Linux’s choice; POSIX leaves it open), then real-time ones, lowest number first, same-number copies in sending order. The receiver now blocks again.');  // ...and the delivery order that was used; the receiver blocks the signals again
            log.scrollTop = log.scrollHeight;  // keeps the newest call in view
          }  // ends deliver
          async function demo() {  // demo(): sends a fixed mix of standard and real-time signals by itself
            if (busy) return;  // ignored while already busy
            reset(); busy = true; const g = gen;  // starts over, blocks the buttons and remembers this reset in g
            const seq = [['std', 'SIGUSR1'], ['rt', 3], ['std', 'SIGUSR1'], ['rt', 0], ['rt', 3], ['std', 'SIGUSR1'], ['rt', 1]];  // the burst: SIGUSR1 three times between four real-time signals of different numbers
            for (const [k, n] of seq) {  // for each signal in the burst...
              await ctx.sleep(380);  // ...waits 0.38 seconds
              if (!ctx.alive || g !== gen) return;  // ...quits if the slide was left or the step was reset
              busy = false; send(k, n); busy = true; paint();  // briefly lifts busy so send() accepts the signal, then blocks again and redraws
            }  // ends the burst loop
            busy = false; paint();  // unblocks the buttons and redraws
            say.say('info', 'Seven signals were sent: SIGUSR1 three times (still one pending bit) and four real-time ones (four queue entries). Predict the handler calls, then press <b>Unblock</b>.');  // explains the burst (three SIGUSR1, four real-time) and asks the student to predict the calls before unblocking
          }  // ends demo
          reset();  // sets the starting state when the step opens
          el.append(h('div', { class: 'split l fill' },  // the step's layout: explanation on the left, the signal lab on the right, filling the height
            h('div', { class: 'stack' },  // the left column, stacked
              h('p', { class: 'lead m0', html: 'A <span class="t">standard signal</span> sent with <code>kill</code> is a doorbell: it says “something happened” and nothing more. Ring it five times while nobody answers, and it is heard once.' }),  // opening line: a standard signal sent with kill is like a doorbell that says only "something happened", and rung many times it is heard once
              h('p', { class: 'm0', html: '<span class="t" data-t="real-time signal">Real-time signals</span>, numbered SIGRTMIN to SIGRTMAX (about 30; the exact numbers depend on the C library), fix three things:' }),  // paragraph: real-time signals run from SIGRTMIN to SIGRTMAX and fix three things
              h('ol', { class: 'm0', html: '<li><b>Queued.</b> Every copy that is successfully sent is kept and delivered (the queue is finite).</li><li><b>Ordered.</b> When several are pending, the lowest number goes first; copies of one signal arrive in the order sent.</li><li><b>A value per copy.</b> <code>sigqueue</code> attaches an int or a pointer, which a handler installed with <code>SA_SIGINFO</code> reads.</li>' }),  // numbered list of the three fixes: queued, ordered, and each copy keeps its own value
              ctx.ui.code(`union sigval v;               // the payload${/* shown code, line 1: declares the value to send (a union that holds an int or a pointer) */''}
v.sival_int = 7;              // its value: 7${/* shown code, line 2: sets the value to 7 */''}
sigqueue(pid, SIGRTMIN+2, v); // send both`, { fontSize: 13.5 }),  // shown code, line 3: sigqueue sends the real-time signal together with the value
              h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'Counting events with a standard signal. Copies that arrive while one is pending are merged, so the count comes out low. Even sent with <code>sigqueue</code>, only the first copy’s value survives.' })),  // common-mistake callout: counting events with a standard signal comes out low because copies merge, and a merged copy's sigqueue value is lost too
            h('div', { class: 'card stack gap-s' },  // the right column: a card holding the signal lab
              h('div', { class: 'row gap-s' }, h('span', { class: 'chip proc' }, 'Receiver: busy, signals blocked'), h('span', { class: 'grow' }), nextV),  // top row: a chip saying the receiver is busy with signals blocked, and the next-value chip on the right
              h('div', { class: 'row gap-s' }, ...sendBtns),  // the row of Send buttons
              h('div', { class: 'grid-2', style: { gap: '10px' } },  // two panels side by side
                h('div', { class: 'pbox' }, h('div', { class: 'xs b muted' }, 'STANDARD: ONE PENDING BIT EACH'), stdBox),  // left panel: standard signals, one pending bit each
                h('div', { class: 'pbox' }, h('div', { class: 'xs b muted' }, 'REAL-TIME: A QUEUE OF ENTRIES'), rtBox)),  // right panel: the real-time queue of entries
              h('div', { class: 'row gap-s' }, bGo, bDemo, h('span', { class: 'grow' }), bReset),  // button row: Unblock, the demo burst, a spacer and Reset
              log, say)));  // the handler-call log and the narration box; closes the card and the layout
        },  // ends render for step 2
      },  // ends step 2

      /* ---------------- 3. Atomic operations ---------------- */
      {  // step 3 starts here: atomic operations
        title: 'Atomic operations: no half-finished updates',  // step 3 title
        kind: 'lab',  // step kind: a hands-on lab
        core: true,  // core: this step is part of the shorter core path through the guide
        render(el, ctx) {  // render(el, ctx): builds step 3 when the student opens it
          const { h } = ctx;  // takes the HTML builder h out of ctx
          const tabs = ctx.ui.tabs([  // tabs: three tabs for the three atomic labs
            { label: '1 · The race', render: (p) => atomicRace(p, ctx) },  // tab 1: the race between two CPUs on count++
            { label: '2 · Integer ops', render: (p) => atomicInts(p, ctx) },  // tab 2: the atomic_t integer console
            { label: '3 · Bit ops', render: (p) => atomicBits(p, ctx) },  // tab 3: the bit operations on a flags word
          ]);  // closes the tab list
          el.append(h('div', { class: 'split l fill' },  // the step's layout: explanation on the left, the tabs on the right
            h('div', { class: 'stack' },  // the left column, stacked
              h('p', { class: 'lead m0', html: 'An <span class="t">atomic operation</span> runs from start to finish with no interruption and no interference: no other CPU can ever see it half done.' }),  // opening line: what an atomic operation is, never seen half done
              h('p', { class: 'm0', html: 'Linux offers two kinds. <span class="t" data-t="atomic integer operation">Integer operations</span> work on a special type, <span class="t">atomic_t</span>. <span class="t" data-t="atomic bitmap operation">Bitmap operations</span> work on one bit of any ordinary memory word.' }),  // paragraph: the two kinds, integer operations on atomic_t and bitmap operations on any word
              h('p', { class: 'm0', html: '<b>Why a separate type?</b> (1) Only the <code>atomic_</code> functions accept it, so <code>count++</code> on an atomic_t will not even compile. (2) The compiler cannot keep it in a register or optimize an access away.' }),  // paragraph: the two reasons atomic_t is a separate type
              h('div', { class: 'callout why m0 small', 'data-label': 'Typical use', html: 'Counters. When many CPUs drop a <span class="t">reference count</span>, <code>atomic_dec_and_test</code> tells exactly one of them that it reached 0, so the object is freed exactly once.' }),  // typical-use callout: reference counts, where atomic_dec_and_test tells exactly one CPU to free the object
              h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: '<code>count++</code> is one line of C but three machine steps: load, add, store. Another CPU can slip in between them.' })),  // common-mistake callout: count++ is three machine steps that another CPU can slip between
            tabs));  // the tabs on the right; closes the layout
        },  // ends render for step 3
      },  // ends step 3

      /* ---------------- 4. Spinlocks: spin or sleep? ---------------- */
      {  // step 4 starts here: spin or sleep
        title: 'Spinlocks: when is spinning cheaper than sleeping?',  // step 4 title
        kind: 'lab',  // step kind: a hands-on lab
        core: true,  // core: part of the shorter core path
        render(el, ctx) {  // render(el, ctx): builds step 4 when the student opens it
          const { h, s } = ctx;  // takes the HTML and SVG (the browser's drawing format) builders out of ctx
          let H = 4, C = 3;  // H is the lock hold time and C the cost of one context switch, both in microseconds
          const slim = ctx.narrow;  // slim is true on phone-width screens, where the timeline is drawn smaller with shorter labels
          const X0 = slim ? 70 : 112, PX = slim ? 9.2 : 16.5, VW = slim ? 360 : 650;  // X0 is where the time axis starts, PX the pixels per microsecond, VW the drawing width
          const X = (t) => X0 + t * PX;  // X(t): turns a time in microseconds into a horizontal position in the drawing
          const svg = s('svg', { viewBox: `0 0 ${VW} 164`, width: '100%', role: 'img', 'aria-label': 'Timelines of a spinning waiter and a sleeping waiter' });  // svg: the timeline drawing, scaled to the card's width, with a description for screen readers
          const say = verdict(ctx);  // say: the narration box that gives the verdict
          const mSpin = h('i'), mSleep = h('i');  // mSpin and mSleep: the filled parts of the two cost bars
          const vSpin = h('b'), vSleep = h('b');  // vSpin and vSleep: the numbers beside the two cost bars
          const blk = (t0, t1, y, cls, labels) => {  // blk(t0, t1, y, cls, labels): draws one coloured block on a timeline from time t0 to t1 at height y
            const w = Math.max(0, X(t1) - X(t0));  // w: the block's width in pixels
            const label = (labels || []).find((t) => w > t.length * 7 + 8);  // label: the first of the offered labels that fits inside the block, if any
            return s('g', {},  // returns the block as a group of SVG shapes
              s('rect', { x: X(t0), y, width: w, height: 30, rx: 6, class: cls, 'stroke-width': 2 }),  // the rounded rectangle, coloured by cls
              label ? s('text', { x: X(t0) + w / 2, y: y + 20, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 }, label) : null);  // the label centred inside it, if one fits; closes the group
          };  // ends blk
          const lane = (y, label) => s('text', { x: 4, y: y + 20, 'font-size': 13.5, 'font-weight': 800 }, label);  // lane(y, label): writes the name of one timeline row at the left edge
          function draw() {  // draw(): redraws the timelines, the cost bars and the verdict from H and C
            const back = Math.max(H, C), inS = back + C;  // back: when the sleeping CPU is ready to be switched back in; inS: when it actually gets the lock
            const kids = [lane(4, 'CPU 0'), lane(46, slim ? 'C1 spin' : 'CPU 1 spins'), lane(88, slim ? 'C1 sleep' : 'CPU 1 sleeps'),  // the three lane names: CPU 0, CPU 1 spinning and CPU 1 sleeping (shorter names on small screens)
              blk(0, H, 4, 's-proc', ['holds the lock', 'holds']),  // CPU 0's block: it holds the lock from time 0 to H
              blk(0, H, 46, 's-warn', ['spinning', 'spin']), blk(H, H + 1.2, 46, 's-cpu'),  // spinning lane: amber spinning until H, then a short blue block where CPU 1 enters
              blk(0, C, 88, 's-bad', ['switch out', 'out']),  // sleeping lane: a red block for switching out, which takes C
              back > C ? blk(C, back, 88, 's-ok', ['other work', 'work']) : null,  // a green block of other useful work, if the lock is still held after the switch out
              blk(back, inS, 88, 's-bad', ['switch in', 'in']), blk(inS, inS + 1.2, 88, 's-cpu'),  // a red block for switching back in, then the short blue block where CPU 1 enters
              s('line', { x1: X(0), y1: 132, x2: X(30), y2: 132, class: 's-line' })];  // the time axis from 0 to 30 microseconds; closes the list of shapes
            for (let t = 0; t <= 30; t += 5) kids.push(s('line', { x1: X(t), y1: 128, x2: X(t), y2: 136, class: 's-line' }), slim && t % 10 ? null : s('text', { x: X(t), y: 154, 'text-anchor': slim && t === 30 ? 'end' : 'middle', 'font-size': 13, class: 's-sub' }, t === 30 ? '30 µs' : String(t)));  // tick marks every 5 microseconds, with numbers (every 10 on small screens) and a µs unit at 30
            kids.push(s('line', { x1: X(H), y1: 0, x2: X(H), y2: 124, class: 's-muted', 'stroke-dasharray': '4 4' }));  // a dashed vertical line at H, the moment CPU 0 releases the lock
            svg.replaceChildren(...kids);  // replaces the old drawing with the new shapes
            const spinW = H, sleepW = 2 * C;  // what each waiter wastes: spinning wastes H, sleeping wastes two switches, 2C
            const top = Math.max(spinW, sleepW, 1);  // top: the larger cost (at least 1), used to scale both bars
            mSpin.style.width = (spinW / top) * 100 + '%'; mSleep.style.width = (sleepW / top) * 100 + '%';  // sets each bar's length relative to the larger cost
            vSpin.textContent = ctx.util.fmt(spinW, 1) + ' µs'; vSleep.textContent = ctx.util.fmt(sleepW, 1) + ' µs';  // writes the two costs in microseconds
            const even = `<span class="chip accent">break-even: hold time = 2 × ${ctx.util.fmt(C, 1)} = ${ctx.util.fmt(2 * C, 1)} µs</span> `;  // even: a chip stating the break-even point, hold time equal to two context switches
            const lat = `CPU 1 gets in at ${ctx.util.fmt(H, 1)} µs when spinning, ${ctx.util.fmt(inS, 1)} µs when sleeping.`;  // lat: how soon CPU 1 gets the lock in each case
            if (H < 2 * C) say.say('ok', even + `<b>Spin.</b> The lock is held ${ctx.util.fmt(H, 1)} µs, less than two context switches (${ctx.util.fmt(2 * C, 1)} µs). Spinning wastes ${ctx.util.fmt(H, 1)} µs; sleeping would burn ${ctx.util.fmt(2 * C, 1)} µs just switching. ${lat}`);  // hold time below 2C: green verdict "Spin", since spinning wastes less
            else if (H === 2 * C) say.say('warn', even + `<b>A tie.</b> Spinning and sleeping both waste ${ctx.util.fmt(H, 1)} µs. ${lat}`);  // exactly 2C: amber verdict "A tie"
            else say.say('info', even + `<b>Sleep.</b> Spinning would waste the whole ${ctx.util.fmt(H, 1)} µs hold time; sleeping costs only the two switches (${ctx.util.fmt(2 * C, 1)} µs) and lets CPU 1 do ${ctx.util.fmt(Math.max(H, C) - C, 1)} µs of other work. ${lat}`);  // above 2C: blue verdict "Sleep", since sleeping costs only the two switches and frees CPU 1 for other work
          }  // ends draw
          const sH = ctx.ui.slider({ label: 'Lock hold time', min: 0.5, max: 20, step: 0.5, value: H, format: (v) => ctx.util.fmt(v, 1) + ' µs', onInput: (v) => { H = v; draw(); } });  // sH: slider for the lock hold time, 0.5 to 20 microseconds; moving it redraws
          const sC = ctx.ui.slider({ label: 'One context switch', min: 1, max: 8, step: 0.5, value: C, format: (v) => ctx.util.fmt(v, 1) + ' µs', onInput: (v) => { C = v; draw(); } });  // sC: slider for the cost of one context switch, 1 to 8 microseconds; moving it redraws
          draw();  // draws the starting picture
          el.append(h('div', { class: 'split l fill' },  // the step's layout: explanation on the left, the timeline card on the right
            h('div', { class: 'stack' },  // the left column, stacked
              h('p', { class: 'lead m0', html: 'The <span class="t">spinlock</span> is the kernel’s everyday lock. One CPU holds it; any other CPU that wants it <b>spins</b>, testing it again and again until it is free.' }),  // opening line: what a spinlock is, and that waiters spin
              ctx.ui.code(`spinlock_t qlock;        // the lock word${/* shown code, line 1: declares the spinlock */''}
spin_lock_init(&qlock);  // start it unlocked${/* shown code, line 2: initialises it unlocked */''}
spin_lock(&qlock);       // take it, or spin${/* shown code, line 3: takes the lock, spinning if it is held */''}
queue_len++;             // critical section${/* shown code, line 4: the critical section, one update to the shared queue length */''}
spin_unlock(&qlock);     // let a spinner in`, { fontSize: 13.5 }),  // shown code, line 5: releases the lock so a spinning CPU can get in; the listing uses 13.5-pixel text
              h('p', { class: 'm0 small', html: '<code>spin_trylock(&amp;qlock)</code> takes the lock if it is free and returns nonzero; if it is held, it returns 0 at once and never spins. <code>spin_is_locked(&amp;qlock)</code> only reports whether someone holds it.' }),  // small paragraph: spin_trylock never spins and spin_is_locked only reports
              h('div', { class: 'callout why m0 small', 'data-label': 'Other kernels', html: 'On a <span class="t">uniprocessor</span> kernel no other CPU can hold the lock, so <code>spin_lock</code> shrinks to “switch off kernel preemption”, and to nothing if it is not preemptible. On a real-time (PREEMPT_RT) kernel <code>spinlock_t</code> sleeps; only <code>raw_spinlock_t</code> always spins.' }),  // callout: on a single-processor kernel spin_lock shrinks to switching off preemption or to nothing; on a real-time kernel spinlock_t sleeps and only raw_spinlock_t spins
              h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'Sleeping while holding a spinlock. Every waiter would spin for the entire sleep.' })),  // common-mistake callout: sleeping while holding a spinlock makes every waiter spin for the whole sleep
            h('div', { class: 'card stack gap-s' },  // the right column: a card holding the spin-or-sleep lab
              h('p', { class: 'm0 small', html: 'CPU 1 wants the lock the instant CPU 0 takes it. Spin, or sleep (switch away and be woken later)?' }),  // the question the lab answers: CPU 1 wants the lock just as CPU 0 takes it
              sH, sC,  // the two sliders, hold time and context-switch cost
              h('div', { class: 'card white tight' }, svg),  // the timeline drawing on a white card
              h('div', { class: 'row gap-s xs' }, ...[['proc', 'holds lock'], ['warn', 'spinning: wasted'], ['bad', 'switching: wasted'], ['ok', 'useful work'], ['cpu', 'enters']].map(([c, t]) => h('span', { class: 'chip ' + c }, t))),  // colour key chips: holds lock, spinning, switching, useful work, enters
              h('div', { class: 'wbars' },  // the cost comparison, three columns per row
                h('span', { class: 'small b' }, 'Wasted by spinning'), h('div', { class: 'meter spin' }, mSpin), vSpin,  // row 1: label, amber bar and value for the time wasted by spinning
                h('span', { class: 'small b' }, 'Wasted by sleeping'), h('div', { class: 'meter sleep' }, mSleep), vSleep),  // row 2: label, red bar and value for the time wasted by sleeping; closes the comparison
              say)));  // the narration box with the verdict; closes the card and the layout
        },  // ends render for step 4
      },  // ends step 4

      /* ---------------- 5. Spinlocks and interrupts ---------------- */
      {  // step 5 starts here: spinlocks shared with interrupt handlers
        title: 'When an interrupt handler wants the same spinlock',  // step 5 title
        kind: 'lab',  // step kind: a hands-on lab
        render(el, ctx) {  // render(el, ctx): builds step 5 when the student opens it
          const { h } = ctx;  // takes the HTML builder h out of ctx
          el.append(h('div', { class: 'split l fill' },  // the step's layout: explanation on the left, the interrupt lab on the right
            h('div', { class: 'stack gap-s' },  // the left column, stacked
              h('p', { class: 'm0', html: 'Kernel code runs in one of two settings. <span class="t">Process context</span> (a system call, say) may sleep. <span class="t">Interrupt context</span> (a handler) must not, so handlers protect shared data with spinlocks.' }),  // paragraph: process context may sleep, interrupt context may not, so handlers use spinlocks
              h('p', { class: 'm0', html: '<b>The trap:</b> a system call holds a spinlock, an <span class="t">interrupt</span> hits the <b>same</b> CPU, and the handler wants that lock. It spins, waiting for code that cannot run until the handler returns.' }),  // paragraph: the trap, a handler on the same CPU wanting the lock the interrupted code holds
              h('table', { class: 'tbl compact vt', html: `<tr><th>Variant</th><th>What it adds · when to use it</th></tr>${/* table of spinlock variants, header row: variant, and what it adds and when to use it */''}
                <tr><td><code>spin_lock</code></td><td>Nothing. For locks no handler takes, or when interrupts are already off.</td></tr>${/* table row: plain spin_lock adds nothing */''}
                <tr><td><code>spin_lock_irq</code></td><td>Local interrupts off; <code>spin_unlock_irq</code> turns them on. When you <b>know</b> they were on.</td></tr>${/* table row: spin_lock_irq switches interrupts off, for when you know they were on */''}
                <tr><td><code>spin_lock_irqsave</code></td><td>Saves the state in <code>flags</code>, then off; <code>spin_unlock_irqrestore</code> puts it back. When you do <b>not</b> know.</td></tr>${/* table row: spin_lock_irqsave saves and restores the state, for when you do not know */''}
                <tr><td><code>spin_lock_bh</code></td><td>Holds off <span class="t" data-t="bottom half">bottom halves</span> (deferred work) on this CPU. When the data is shared with them.</td></tr>` }),  // table row: spin_lock_bh holds off bottom halves; ends the table
              h('p', { class: 'm0 xs muted', html: 'On PREEMPT_RT: interrupt state left as is; <code>spinlock_t</code> sleeps.' }),  // small grey scope note: the table is for ordinary kernels; on a real-time (PREEMPT_RT) kernel these calls leave the interrupt-disabled state as it was and spinlock_t sleeps
              h('div', { class: 'callout why m0 small', 'data-label': 'Why only the same CPU?', html: 'A handler on another CPU just spins briefly until the holder finishes. The deadlock needs the holder and the handler on one CPU.' })),  // callout: why the deadlock needs the holder and the handler on the same CPU
            irqLab(ctx)));  // the interrupt lab on the right; closes the layout
        },  // ends render for step 5
      },  // ends step 5

      /* ---------------- 6. Kernel semaphores, mutexes, reader-writer locks ---------------- */
      {  // step 6 starts here: sleeping locks
        title: 'Sleeping locks: kernel semaphores and mutexes',  // step 6 title
        kind: 'explore',  // step kind: an exploration
        render(el, ctx) {  // render(el, ctx): builds step 6 when the student opens it
          const { h } = ctx;  // takes the HTML builder h out of ctx
          const tabs = ctx.ui.tabs([  // tabs: two tabs, one per lab
            { label: 'Counting semaphore', render: (p) => semLab(p, ctx) },  // tab 1: the counting semaphore lab with four tasks
            { label: 'Reader-writer spinlock', render: (p) => rwLab(p, ctx) },  // tab 2: the reader-writer spinlock lab
          ]);  // closes the tab list
          el.append(h('div', { class: 'split l fill' },  // the step's layout: explanation on the left, the tabs on the right
            h('div', { class: 'stack gap-s' },  // the left column, stacked
              h('p', { class: 'm0', html: 'When the wait may be long, or the holder may sleep, spinning wastes too much: a <span class="t">kernel semaphore</span> puts the waiter to sleep. It is kernel-only (programs never see it) and cheaper than the semaphores programs use.' }),  // paragraph: a kernel semaphore puts the waiter to sleep when the wait may be long
              h('p', { class: 'm0', html: 'Three kinds: <b>binary</b>, <b>counting</b> and <b>reader-writer</b>. <code>down</code> is semWait and <code>up</code> is semSignal:' }),  // paragraph: the three kinds of kernel semaphore, and down and up as semWait and semSignal
              ctx.ui.code(`sema_init(&sem, 2);           // count = 2 units${/* shown code, line 1: sema_init starts the count at 2 units */''}
down(&sem);                   // sleep until free${/* shown code, line 2: down sleeps until a unit is free */''}
if (down_interruptible(&sem)) // a signal wakes it:${/* shown code, line 3: down_interruptible returns nonzero if a signal woke it... */''}
    return -EINTR;            //   give up${/* shown code, line 4: ...and then the code gives up with -EINTR */''}
if (down_trylock(&sem))       // never sleeps;${/* shown code, line 5: down_trylock never sleeps and returns nonzero if no unit is free... */''}
    return -EBUSY;            //   nonzero = busy${/* shown code, line 6: ...and then the code gives up with -EBUSY */''}
up(&sem);                     // semSignal`, { fontSize: 13 }),  // shown code, line 7: up gives the unit back; the listing uses 13-pixel text
              h('div', { class: 'callout tip m0 small', 'data-label': 'Binary semaphore → mutex', html: 'For plain mutual exclusion Linux now prefers the <span class="t" data-t="linux mutex">mutex</span> (<code>mutex_lock</code>, <code>mutex_unlock</code>): only the holder may unlock it, and it is never used in interrupt context.' }),  // tip callout: for plain mutual exclusion Linux now prefers the mutex
              h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'Calling <code>down</code> from an interrupt handler. A handler must never sleep; use a spinlock there.' })),  // common-mistake callout: calling down from an interrupt handler, which must never sleep
            tabs));  // the tabs on the right; closes the layout
        },  // ends render for step 6
      },  // ends step 6
      /* ---------------- 7. Memory barriers ---------------- */
      {  // step 7 starts here: memory barriers
        title: 'Memory barriers: keeping loads and stores in order',  // step 7 title
        kind: 'explore',  // step kind: an exploration
        render(el, ctx) {  // render(el, ctx): builds step 7 when the student opens it
          const { h } = ctx;  // takes the HTML builder h out of ctx
          const EV = {  // EV: the four memory accesses in the example, each with its CPU and a description
            S1: { cpu: 0, txt: 'CPU 0 stores data = 42' },  // S1: CPU 0 stores the payload, data = 42
            S2: { cpu: 0, txt: 'CPU 0 stores ready = 1' },  // S2: CPU 0 raises the flag, ready = 1
            L1: { cpu: 1, txt: 'CPU 1 loads ready' },  // L1: CPU 1 loads the flag
            L2: { cpu: 1, txt: 'CPU 1 loads data' },  // L2: CPU 1 loads the payload
          };  // closes the EV table
          let wmbOn = false, rmbOn = false, sel = null;  // wmbOn and rmbOn say whether each barrier is switched on; sel is the order the student selected
          const perms = (a) => (a.length <= 1 ? [a] : a.flatMap((x, i) => perms(a.slice(0, i).concat(a.slice(i + 1))).map((p) => [x, ...p])));  // perms(a): lists every possible ordering of the items in a, by putting each item first and ordering the rest the same way
          const ALL = perms(['S1', 'S2', 'L1', 'L2']);  // ALL: all 24 orders of the four accesses
          function outcome(o) {  // outcome(o): works out what CPU 1 sees in order o
            const at = (e) => o.indexOf(e);  // at(e): the position of access e in the order
            const r = at('S2') < at('L1') ? 1 : 0, d = at('S1') < at('L2') ? 42 : 0;  // r is the flag CPU 1 sees (1 only if S2 came before L1); d is the data it sees (42 only if S1 came before L2)
            return { r, d, kind: !r ? 'skip' : d === 42 ? 'ok' : 'stale' };  // kind: skip if the flag was not up yet, ok if the data was 42, stale if the flag was up but the data old
          }  // ends outcome
          const allowed = () => ALL.filter((o) => (!wmbOn || o.indexOf('S1') < o.indexOf('S2')) && (!rmbOn || o.indexOf('L1') < o.indexOf('L2')));  // allowed(): the orders still possible: wmb forces S1 before S2, rmb forces L1 before L2
          const grid = h('div', { class: 'ordgrid' });  // grid: the grid of buttons, one per possible order
          const detail = h('div', { class: 'orddetail' });  // detail: the four steps of the selected order, spelled out
          const say = verdict(ctx);  // say: the narration box that explains the selected order
          const tW = h('button', { class: 'btn sm cpu', type: 'button', onclick: () => { wmbOn = !wmbOn; paint(); } });  // tW: the blue toggle for wmb on CPU 0
          const tR = h('button', { class: 'btn sm thread', type: 'button', onclick: () => { rmbOn = !rmbOn; paint(); } });  // tR: the pink toggle for rmb on CPU 1
          const code0 = ctx.ui.code(`data = 42;  // S1: payload${/* CPU 0's code, line 1: S1 stores the payload */''}
wmb();      // order stores${/* CPU 0's code, line 2: wmb keeps the two stores in order */''}
ready = 1;  // S2: raise flag`, { fontSize: 13, nums: false });  // CPU 0's code, line 3: S2 raises the flag; shown without line numbers
          const code1 = ctx.ui.code(`if (ready) {   // L1: flag up?${/* CPU 1's code, line 1: L1 checks whether the flag is up */''}
    rmb();     // order loads${/* CPU 1's code, line 2: rmb keeps the two loads in order */''}
    use(data); // L2: payload${/* CPU 1's code, line 3: L2 uses the payload */''}
}              // end of if`, { fontSize: 13, nums: false });  // CPU 1's code, line 4: closes the if; shown without line numbers
          function paint() {  // paint(): redraws the toggles, the code, the order grid, the detail and the verdict
            const A = allowed(), key = (o) => o.join(' ');  // A: the orders allowed by the barriers now on; key(o) writes an order as text such as "S1 S2 L1 L2"
            const stale = A.filter((o) => outcome(o).kind === 'stale');  // stale: the allowed orders that give a stale read
            if (!sel || !A.some((o) => key(o) === key(sel))) sel = stale[0] || A[0];  // if nothing is selected, or the selected order is no longer allowed, selects the first stale order (or the first allowed one)
            tW.innerHTML = 'wmb() on CPU 0: <b>' + (wmbOn ? 'ON' : 'OFF') + '</b>'; tW.setAttribute('aria-pressed', String(wmbOn));  // the wmb toggle's label shows ON or OFF, and it is marked pressed when on
            tR.innerHTML = 'rmb() on CPU 1: <b>' + (rmbOn ? 'ON' : 'OFF') + '</b>'; tR.setAttribute('aria-pressed', String(rmbOn));  // the rmb toggle's label and pressed state, the same way
            code0.mark(wmbOn ? [] : [2], 'dim'); code1.mark(rmbOn ? [] : [2], 'dim'); code0.mark(wmbOn ? [2] : [], 'ok'); code1.mark(rmbOn ? [2] : [], 'ok');  // greys out each barrier line in the code while it is off, and shows it green while it is on
            grid.replaceChildren(...A.map((o) => h('button', { type: 'button', class: 'ordbtn ' + outcome(o).kind + (key(o) === key(sel) ? ' on' : ''), 'aria-pressed': String(key(o) === key(sel)), onclick: () => { sel = o; paint(); } }, key(o))));  // one button per allowed order, coloured by its outcome and highlighted when selected; a click selects it
            const oc = outcome(sel);  // oc: what CPU 1 sees in the selected order
            detail.replaceChildren(...sel.map((e, k) => h('div', { class: 'ordstep c' + EV[e].cpu },  // the selected order as four boxes, each in its CPU's colour...
              h('span', { class: 'xs b' }, (k + 1) + ' · ' + e), h('span', { class: 'small' }, EV[e].txt + (e === 'L1' ? ' → ' + oc.r : e === 'L2' ? ' → ' + oc.d : '')))));  // ...numbered, with what the access does and, for the two loads, the value CPU 1 gets
            const head = `<b>${stale.length} of ${A.length}</b> possible orders let CPU 1 see ready = 1 but data = 0. `;  // head: how many of the allowed orders give a stale read
            const why = [];  // why: the reasons the selected order went wrong, collected below
            if (sel.indexOf('S2') < sel.indexOf('S1')) why.push('CPU 0’s stores became visible in the wrong order (only <code>wmb()</code> forbids that)');  // reason: CPU 0's stores became visible in the wrong order, which only wmb forbids
            if (sel.indexOf('L2') < sel.indexOf('L1')) why.push('CPU 1 loaded data before it even checked ready (only <code>rmb()</code> forbids that)');  // reason: CPU 1 loaded the data before checking the flag, which only rmb forbids
            if (oc.kind === 'stale') say.say('bad', head + `Selected: CPU 1 reads ready = 1, trusts the flag, and uses <b>data = 0</b>. Why: ${why.join('; and ')}.`);  // stale order: red message, CPU 1 trusts the flag and uses data = 0, with the reasons
            else if (oc.kind === 'skip') say.say('info', head + 'In the selected order CPU 1 reads ready = 0, so it skips the payload and tries again later. Harmless.');  // flag not up yet: blue message, CPU 1 skips the data and tries later, which is harmless
            else say.say('ok', head + 'In the selected order CPU 1 reads ready = 1 and data = 42. Correct.');  // correct order: green message, CPU 1 sees ready = 1 and data = 42
            if (!stale.length) say.say('ok', `<b>0 of ${A.length}</b> possible orders give a stale read. With both barriers, if CPU 1 sees ready = 1, it is guaranteed to see data = 42.`);  // with both barriers on no stale order is left, so a green message states the guarantee
          }  // ends paint
          paint();  // draws the starting state (no barriers)
          el.append(h('div', { class: 'split l fill' },  // the step's layout: explanation on the left, the ordering lab on the right
            h('div', { class: 'stack gap-s' },  // the left column, stacked
              h('p', { class: 'm0', html: 'To run faster, compilers and processors may carry out loads and stores out of program order: <span class="t">memory reordering</span>. One thread can never tell. Another CPU watching the same memory can.' }),  // paragraph: compilers and processors may reorder memory accesses; only another CPU can notice
              h('p', { class: 'm0', html: 'A <span class="t" data-t="memory barrier">memory barrier</span> is a fence that accesses may not cross:' }),  // paragraph: a memory barrier is a fence that accesses may not cross
              h('table', { class: 'tbl compact vt', html: `<tr><th>Barrier</th><th>Effect</th></tr>${/* barrier table, header row: barrier and effect */''}
                <tr><td><code>rmb()</code></td><td>no load moves across it</td></tr>${/* table row: rmb stops loads crossing */''}
                <tr><td><code>wmb()</code></td><td>no store moves across it</td></tr>${/* table row: wmb stops stores crossing */''}
                <tr><td><code>mb()</code></td><td>no load or store moves across it</td></tr>${/* table row: mb stops both */''}
                <tr><td><code>barrier()</code></td><td>stops only the <b>compiler</b>; the processor may still reorder</td></tr>${/* table row: barrier() stops only the compiler */''}
                <tr><td><code>smp_rmb()</code><br><code>smp_wmb()</code><br><code>smp_mb()</code></td><td>real barriers on a multiprocessor kernel; just <code>barrier()</code> on a uniprocessor kernel</td></tr>` }),  // table row: the smp_ versions are real barriers only on a multiprocessor kernel; ends the table
              h('div', { class: 'callout why m0 small', 'data-label': 'Does my CPU do this?', html: 'x86 already keeps stores in order with stores and loads with loads, so there <code>smp_wmb()</code> and <code>smp_rmb()</code> only restrain the compiler. ARM and POWER reorder far more. Kernel code uses the barriers either way, so it is correct on every processor.' })),  // callout: x86 already keeps stores and loads in order, ARM and POWER reorder more, so kernel code always uses barriers
            h('div', { class: 'card stack gap-s' },  // the right column: a card holding the ordering lab
              h('div', { class: 'grid-2', style: { gap: '10px' } },  // the two code listings side by side
                h('div', { class: 'stack gap-s' }, h('div', { class: 'xs b muted' }, 'CPU 0 · PRODUCER'), code0),  // CPU 0, the producer, with its code
                h('div', { class: 'stack gap-s' }, h('div', { class: 'xs b muted' }, 'CPU 1 · CONSUMER'), code1)),  // CPU 1, the consumer, with its code; closes the pair
              h('div', { class: 'row gap-s' }, tW, tR, h('span', { class: 'xs muted' }, 'S = store, L = load, as marked in the code')),  // the two barrier toggles and a note that S means store and L means load
              h('div', { class: 'xs b muted' }, 'EVERY ORDER MEMORY MAY SEE · red = stale · green = correct · grey = flag not up yet · click one'),  // heading for the order grid with its colour key: red stale, green correct, grey flag not up
              grid, detail, say)));  // the order grid, the selected order's detail and the narration box; closes the card and the layout
        },  // ends render for step 7
      },  // ends step 7
      /* ---------------- 8. RCU ---------------- */
      {  // step 8 starts here: read-copy-update
        title: 'Read-copy-update: readers that never wait',  // step 8 title
        kind: 'explore',  // step kind: an exploration
        render(el, ctx) {  // render(el, ctx): builds step 8 when the student opens it
          const { h } = ctx;  // takes the HTML builder h out of ctx
          const tabs = ctx.ui.tabs([  // tabs: the simulator and the code it models
            { label: 'Be the writer', render: (p) => rcuLab(p, ctx) },  // tab 1: be the writer in the RCU simulator
            { label: 'The code', render: (p) => p.append(ctx.ui.code(`/* reader: any CPU, any time */${/* tab 2 shows code; shown code, line 1: heading comment for the reader's part */''}
rcu_read_lock();             // start of the read-side section${/* shown code: rcu_read_lock marks the start of the read-side section */''}
p = rcu_dereference(gp);     // fetch the current version${/* shown code: rcu_dereference fetches the current version through gp */''}
t = p->timeout;              // use it: no lock is held${/* shown code: the reader uses the data without holding any lock */''}
rcu_read_unlock();           // end of the read-side section${/* shown code: rcu_read_unlock marks the end of the read-side section */''}

/* writer */${/* shown code: heading comment for the writer's part */''}
new = kmalloc(sizeof(*new), GFP_KERNEL); // fresh memory${/* shown code: kmalloc gets fresh memory for the new version */''}
spin_lock(&upd_lock);        // writers still take turns${/* shown code: writers still take turns with a spinlock among themselves */''}
old = gp;                    // the version readers see now${/* shown code: old remembers the version readers see now */''}
*new = *old;                 // 1. copy it${/* shown code: step 1, copy the old version into the new memory */''}
new->timeout = 60;           // 2. change the copy${/* shown code: step 2, change the copy */''}
rcu_assign_pointer(gp, new); // 3. publish: one pointer store${/* shown code: step 3, publish the copy with one pointer store */''}
spin_unlock(&upd_lock);      // the next writer may go${/* shown code: the writer releases its spinlock so the next writer may go */''}
synchronize_rcu();           // 4. wait out the grace period${/* shown code: step 4, wait for the grace period to end */''}
kfree(old);                  // 5. free the old version${/* shown code: step 5, free the old version */''}

/* instead of 4 and 5, without waiting: */${/* shown code: heading comment for the non-blocking alternative */''}
call_rcu(&old->rh, free_cb); // free_cb runs after the grace period`, { fontSize: 13 })) },  // shown code: call_rcu registers a callback that frees the old version after the grace period; closes tab 2
          ]);  // closes the tab list
          el.append(h('div', { class: 'split l fill' },  // the step's layout: explanation on the left, the tabs on the right
            h('div', { class: 'stack gap-s' },  // the left column, stacked
              h('p', { class: 'lead m0', html: 'Some data is read constantly and changed rarely, like a routing table consulted for every packet. <span class="t" data-t="read-copy-update">Read-copy-update (RCU)</span> lets its readers skip locking entirely.' }),  // opening line: RCU suits data read constantly and changed rarely, and lets readers skip locking
              h('p', { class: 'm0', html: '<b>Readers</b> wrap their access in <code>rcu_read_lock()</code> and <code>rcu_read_unlock()</code>. These only mark the <span class="t">read-side critical section</span>; they take no lock and write nothing shared. The pointer is fetched with <code>rcu_dereference()</code>.' }),  // paragraph: what readers do, and that their calls take no lock and write nothing shared
              h('p', { class: 'm0', html: '<b>A writer</b> never changes data in place:' }),  // paragraph: a writer never changes the data in place
              h('ol', { class: 'm0 small', html: '<li><b>Copy</b> the current version.</li><li><b>Change</b> the copy.</li><li><b>Publish</b> it with <code>rcu_assign_pointer</code>: a single pointer store.</li><li><b>Wait</b> a <span class="t">grace period</span>: <code>synchronize_rcu()</code> blocks, or <code>call_rcu()</code> asks to be called back.</li><li><b>Free</b> the old version.</li>' }),  // numbered list of the writer's five steps: copy, change, publish, wait, free
              h('div', { class: 'callout why m0 small', 'data-label': 'Why it works', html: 'Every reader sees either the whole old version or the whole new one, never a mix, and the old one is freed only after every reader that could hold it has left.' })),  // why-it-works callout: readers see a whole version, and the old one is freed only after its readers leave
            tabs));  // the tabs on the right; closes the layout
        },  // ends render for step 8
      },  // ends step 8
      /* ---------------- 9. Recap: which primitive? ---------------- */
      {  // step 9 starts here: recap
        title: 'Recap: which tool fits the job?',  // step 9 title
        kind: 'recap',  // step kind: a recap
        render(el, ctx) {  // render(el, ctx): builds step 9 when the student opens it
          const { h } = ctx;  // takes the HTML builder h out of ctx
          const OPTS = ['atomic operation', 'spinlock', 'spin_lock_irqsave', 'mutex', 'counting semaphore', 'memory barriers', 'RCU'];  // OPTS: the seven tools the student can pick from for each scenario
          const FIT = ['An atomic operation fits when the shared data is one counter or one bit.',  // FIT: one sentence per tool saying when it fits, used when a wrong pick has no specific feedback; atomic operation first
            'A plain spinlock fits a short critical section that never sleeps and that no interrupt handler shares.',  // when a plain spinlock fits
            'spin_lock_irqsave is for a short critical section that an interrupt handler also uses.',  // when spin_lock_irqsave fits
            'A mutex fits one-at-a-time access where the holder may sleep or hold it for a long time.',  // when a mutex fits
            'A counting semaphore fits a pool of several identical units whose waiters sleep.',  // when a counting semaphore fits
            'Memory barriers only fix the order of loads and stores; they keep no one out.',  // what memory barriers do and do not do
            'RCU fits data that is read constantly and written rarely.'];  // when RCU fits; closes FIT
          const SC = [  // SC: the eight scenarios, each [description, index of the right tool, explanation, feedback for some wrong picks]
            ['Count every packet received, on all CPUs. The counter is the only shared data.', 0, 'One read-modify-write of one integer: <code>atomic_inc</code> does it with no lock at all.',  // scenario 1: counting packets on all CPUs; answer: atomic operation
              { 1: 'A spinlock would work but is overkill: the only shared data is one integer, and atomic_inc updates it with no lock at all.', 2: 'A lock (with or without interrupts off) is overkill for one integer: atomic_inc needs no lock at all.', 3: 'A sleeping lock around a single increment costs far more than the increment itself.', 4: 'A sleeping lock around a single increment costs far more than the increment itself.', 5: 'Barriers fix ordering; they cannot stop two CPUs from loading the same old value and losing an update.' }],  // scenario 1 feedback for the spinlock, irqsave, mutex, semaphore and barrier picks
            ['Protect a few instructions that update a list. Only system calls touch the list, never an interrupt handler.', 1, 'A short hold with no handler involved: a plain spinlock is the cheapest real lock.',  // scenario 2: a short list update only system calls touch; answer: spinlock
              { 0: 'An atomic operation covers one counter or one bit. Updating a list takes several instructions that must stay together.', 2: 'No interrupt handler touches this list, so switching interrupts off is wasted work.', 3: 'The hold is a few instructions and never sleeps; two context switches would cost more than the wait.' }],  // scenario 2 feedback for the atomic, irqsave and mutex picks
            ['A list is filled by a network interrupt handler and emptied by a system call.', 2, 'The system call must keep local interrupts off while it holds the lock, or the handler could spin forever on the same CPU. Unsure whether interrupts are on? Save and restore them.',  // scenario 3: a list shared with a network interrupt handler; answer: spin_lock_irqsave
              { 1: 'A plain spinlock leaves interrupts on: the handler could cut into the system call on the same CPU and spin forever.', 3: 'An interrupt handler must never sleep, so it cannot take a mutex.', 4: 'An interrupt handler must never sleep, so it cannot wait on a semaphore.' }],  // scenario 3 feedback for the spinlock, mutex and semaphore picks
            ['Guard a structure while copying a large buffer from a user program. The copy may page-fault and sleep.', 3, 'The holder may sleep and may hold it a long time, so waiters should sleep too. For plain mutual exclusion that is a mutex.',  // scenario 4: guarding a copy that may page-fault and sleep; answer: mutex
              { 1: 'Never sleep holding a spinlock: every waiter would spin for the whole sleep.', 2: 'Never sleep holding a spinlock, even with interrupts off: waiters would spin for the whole sleep.', 4: 'A semaphore started at 1 would work, but for plain one-at-a-time access Linux prefers the mutex.' }],  // scenario 4 feedback for the spinlock, irqsave and semaphore picks
            ['Up to three tasks may use three identical hardware channels at once; a fourth must wait, perhaps for milliseconds.', 4, 'A count of identical units with sleeping waiters: <code>sema_init(&amp;sem, 3)</code>, then down and up.',  // scenario 5: three identical hardware channels with waits of milliseconds; answer: counting semaphore
              { 1: 'A wait of milliseconds is far too long to spin, and a spinlock admits only one holder.', 3: 'A mutex admits one holder at a time, but here three tasks may each hold a channel at once.' }],  // scenario 5 feedback for the spinlock and mutex picks
            ['A routing table is read for every packet and changed a few times an hour.', 6, 'Read-mostly data: RCU readers take no lock at all, and the rare writer pays for the copy and the grace period.',  // scenario 6: a routing table read for every packet and changed rarely; answer: RCU
              { 1: 'A spinlock would make every packet lookup take turns, although readers never conflict with one another.', 3: 'Sleeping locks on the path of every packet would be far too slow, and readers do not need to exclude each other.' }],  // scenario 6 feedback for the spinlock and mutex picks
            ['CPU 0 fills a buffer, then sets a flag telling CPU 1 the buffer is ready.', 5, '<code>wmb()</code> between filling the buffer and setting the flag, and <code>rmb()</code> on CPU 1 after it sees the flag.',  // scenario 7: CPU 0 fills a buffer and then sets a flag for CPU 1; answer: memory barriers
              { 0: 'Nothing here is a read-modify-write. The danger is CPU 1 seeing the flag before the buffer contents: an ordering problem.' }],  // scenario 7 feedback for the atomic pick: this is an ordering problem, not a read-modify-write
            ['Free a shared object exactly once, when the last of many users lets go of it.', 0, 'A reference count: each user calls <code>atomic_dec_and_test</code>, and the one that gets true frees the object.',  // scenario 8: freeing a shared object exactly once when its last user lets go; answer: atomic operation
              { 1: 'A lock around the count would work, but atomic_dec_and_test does the decrement and the zero test as one step with no lock.', 3: 'A sleeping lock is far heavier than needed: atomic_dec_and_test decrements and tests for zero in one step.' }],  // scenario 8 feedback for the spinlock and mutex picks
          ];  // closes the SC list
          let k = 0, score = 0, tried = false;  // k is the scenario on screen, score counts first-try successes, tried records a wrong pick on this scenario
          const qText = h('p', { class: 'm0 b' });  // qText: the scenario description in bold
          const count = h('span', { class: 'chip accent' });  // count: the "Scenario n of 8" chip
          const scoreEl = h('span', { class: 'small b' });  // scoreEl: the running first-try score
          const say = verdict(ctx);  // say: the narration box that judges each pick
          const opts = h('div', { class: 'pickgrid' });  // opts: the two-column grid of tool buttons
          const bNext = btn(ctx, 'Next scenario →', () => { k = (k + 1) % SC.length; if (k === 0) score = 0; show(); }, 'sm primary');  // bNext: moves to the next scenario, wrapping to the first and resetting the score after the last
          function show() {  // show(): puts the current scenario on screen
            tried = false;  // no wrong pick yet on this scenario
            qText.textContent = SC[k][0];  // shows the scenario text
            count.textContent = `Scenario ${k + 1} of ${SC.length}`;  // shows which scenario this is
            scoreEl.textContent = `First-try score: ${score} / ${k}`;  // shows the score so far, out of the scenarios already finished
            opts.replaceChildren(...OPTS.map((o, i) => h('button', { type: 'button', class: 'btn sm', onclick: (e) => pick(i, e.currentTarget) }, o)));  // one fresh button per tool; a click passes its number and the button itself to pick
            bNext.disabled = true;  // Next stays disabled until the right tool is found
            bNext.textContent = k === SC.length - 1 ? 'Start again' : 'Next scenario →';  // the Next button says "Start again" on the last scenario
            say.say('info', 'Pick the tool that fits best.');  // prompts the student to choose
          }  // ends show
          function pick(i, b) {  // pick(i, b): judges the student's choice i, made with button b
            const right = i === SC[k][1];  // right is true if i is the correct tool for this scenario
            if (right) {  // a correct pick...
              if (!tried) score++;  // ...earns a point only if there was no wrong pick before it
              b.classList.add('ok');  // turns the button green
              opts.querySelectorAll('button').forEach((x) => (x.disabled = true));  // disables every tool button so the scenario is closed
              say.say('ok', `<b>Yes: ${OPTS[i]}.</b> ${SC[k][2]}`);  // green message naming the tool and explaining why it fits
              bNext.disabled = false;  // enables the Next button
              scoreEl.textContent = `First-try score: ${score} / ${k + 1}`;  // updates the score, now counting this scenario
              if (k === SC.length - 1) bNext.textContent = 'Start again';  // on the last scenario the Next button offers to start again...
              else bNext.textContent = 'Next scenario →';  // ...otherwise it moves on to the next scenario
            } else {  // a wrong pick...
              tried = true; b.disabled = true; b.classList.add('no');  // ...costs the first-try point, disables that button and turns it red
              const why = SC[k][3][i];  // why: the scenario's specific feedback for this wrong tool, if there is any
              say.say('bad', `<b>Not ${OPTS[i]}.</b> ` + (why ? why + ' Try again.' : `${FIT[i]} That is not what this job needs. Try again.`));  // red message: the specific reason, or else the general FIT sentence for that tool, then "Try again"
            }  // ends the right-or-wrong choice
          }  // ends pick
          show();  // shows the first scenario when the step opens
          el.append(h('div', { class: 'split fill' },  // the step's layout: two columns filling the height
            h('div', { class: 'card stack' },  // the left column: a card holding the scenario game
              h('div', { class: 'row gap-s' }, h('h3', { class: 'm0' }, 'Which tool fits?'), h('span', { class: 'grow' }), count),  // top row: the "Which tool fits?" heading, a spacer and the scenario counter
              qText, opts, say,  // the scenario text, the tool buttons and the narration box
              h('div', { class: 'row gap-s' }, scoreEl, h('span', { class: 'grow' }), bNext),  // bottom row: the score, a spacer and the Next button
              h('div', { class: 'callout tip m0 small', 'data-label': 'Ask in this order', html: '<b>1.</b> One counter or one bit? An atomic operation. <b>2.</b> May the holder sleep, or is the wait long? A mutex or semaphore. <b>3.</b> Otherwise a spinlock, with <code>_irqsave</code> if a handler shares the data. <b>4.</b> Read constantly, written rarely? Consider RCU. Handing data over through a flag? Barriers.' })),  // tip callout: four questions to ask, in order, when choosing a tool
            h('div', { class: 'stack gap-s' },  // the right column, stacked
              h('p', { class: 'small muted m0' }, 'Say the answer out loud, then click the card to check.'),  // instruction: say the answer aloud before turning a card
              ctx.ui.flipcards([  // ctx.ui.flipcards: a grid of cards that turn over when clicked, one per [front, back] pair
                ['Real-time vs standard signals', 'RT signals queue every copy, go lowest number first, and each copy keeps its own value. A standard one is a single pending bit: copies merge.'],  // card: real-time versus standard signals (queued with a value per copy, versus one pending bit that merges copies)
                ['Why a separate atomic_t type?', 'Only atomic_ functions accept it, and the compiler cannot optimize its accesses away.'],  // card: why atomic_t is its own type
                ['Spin or sleep?', 'Spin if the lock is held for less than two context switches; otherwise sleep.'],  // card: the spin-or-sleep rule of thumb
                ['Lock shared with a handler?', 'spin_lock_irqsave: save the interrupt state, interrupts off, restore it on unlock.'],  // card: which spinlock call to use when a handler shares the lock
                ['down vs down_interruptible', 'Both sleep. Only down_interruptible wakes on a signal (returns -EINTR). down_trylock never sleeps.'],  // card: down versus down_interruptible versus down_trylock
                ['Reader-writer spinlock catch', 'Many readers or one writer. Classic design favours readers: a stream of readers can starve the writer.'],  // card: the catch with reader-writer spinlocks
                ['rmb, wmb, mb, barrier()', 'Order loads, stores, or both. barrier() restrains only the compiler.'],  // card: what each kind of barrier orders
                ['RCU in one breath', 'Readers lock nothing. Writers copy, update, swap the pointer, and free the old copy after a grace period.'],  // card: RCU summed up in one sentence
              ], { cols: 2, height: 100 }))));  // closes the card list: two columns, each card at least 100 pixels tall; closes both columns and the layout
        },  // ends render for step 9
      },  // ends step 9
      /* ---------------- 10. Quiz ---------------- */
      {  // step 10 starts here: the end-of-section quiz
        title: 'Check yourself',  // step 10 title
        kind: 'check',  // step kind: a check of understanding
        quiz: [  // quiz: the questions, which the guide's quiz engine shows one at a time
          { type: 'num', q: 'A process has SIGUSR1 blocked. Another process sends it SIGUSR1 four times. The receiver then unblocks the signal. How many times does its SIGUSR1 handler run?',  // question 1 (calculate): how many handler calls for SIGUSR1 sent four times while blocked
            answer: 1, tol: 0,  // the answer, 1, with no tolerance for other values
            why: 'SIGUSR1 is a standard signal: while it is pending, the kernel keeps just one pending bit for it, so the extra copies are merged. One handler call. Four real-time signals would have produced four calls.' },  // explanation: copies of a pending standard signal are merged
          { type: 'multi', q: 'Which statements about Linux real-time signals are true? Select all that apply.',  // question 2 (select all): true statements about real-time signals
            choices: ['Every copy sent is queued, so none is merged away', 'Only the kernel can send them; another process cannot', 'When several are pending, the lowest-numbered one is delivered first', 'Copies of the same real-time signal arrive in random order', 'sigqueue can attach an integer or a pointer value to one'],  // the five statements to judge
            answer: [0, 2, 4],  // the true ones: queued, lowest number first, can carry a value
            why: 'Real-time signals queue every successfully sent copy (the queue is finite, so a send can fail when it is full), are delivered lowest number first (copies of one signal in the order sent), and can carry a value given to sigqueue. Ordinary processes send them, for example with sigqueue.' },  // explanation: what real-time signals guarantee, and that ordinary processes can send them
          { q: 'Why does Linux give atomic integers their own type, <code>atomic_t</code>, instead of using a plain <code>int</code>?',  // question 3 (multiple choice): why atomic_t is a separate type
            choices: ['Because atomic_t is wider than an int, so even a very busy counter can never overflow', 'Because declaring an atomic_t switches interrupts off for the rest of the function', 'So only atomic_ functions can use it, and the compiler cannot optimize its accesses away', 'So user programs can share the counter directly with the kernel, without a system call'],  // choices: wider, interrupts off, only atomic functions plus no optimizing away, and sharing with programs
            answer: 2,  // the answer is the third choice
            feedback: ['Its size is not the point; an atomic_t holds an ordinary integer and can overflow like one.', 'Declaring an atomic_t changes nothing about interrupts for the rest of the function. Only each single atomic operation is indivisible, usually thanks to one special processor instruction.', null, 'atomic_t is a kernel-internal type; it has nothing to do with sharing data with programs.'],  // feedback for each wrong choice; null marks the right one
            why: 'A separate type means ordinary arithmetic such as count++ will not even compile on it, so every change goes through an atomic function, and the compiler must really perform each access.' },  // explanation: count++ will not compile on it, and every access really happens
          { type: 'num', q: 'Kernel code declares <code>atomic_t v = ATOMIC_INIT(10);</code> and then runs <code>atomic_add(5, &amp;v); atomic_sub(3, &amp;v); atomic_dec(&amp;v);</code>. What does <code>atomic_read(&amp;v)</code> return now?',  // question 4 (calculate): the value of v after an add, a sub and a dec starting at 10
            answer: 11, tol: 0,  // the answer, 11
            why: '10 + 5 = 15, then 15 − 3 = 12, then 12 − 1 = 11. Note the argument order: the amount comes first, the pointer second.' },  // explanation: the arithmetic step by step, and a reminder of the argument order
          { type: 'num', q: 'A shared counter holds 7. Two CPUs each run <code>count++</code> once, as a load, an add and a store, and both CPUs load before either one stores. What does the counter hold when both have finished?',  // question 5 (calculate): the result of two unprotected count++ starting at 7 when both CPUs load first
            answer: 8, tol: 0,  // the answer, 8: one update is lost
            why: 'Both load 7, both compute 8, both store 8. Two increments ran but the counter rose by only one: a lost update. atomic_inc would give 9 in any order.' },  // explanation: both load 7 and both store 8; atomic_inc would give 9
          { type: 'num', q: 'On a multiprocessor, one context switch costs 4 µs. A sleeping waiter pays for two switches; a spinning waiter wastes the whole time the lock is held. Up to what hold time does spinning waste no more CPU time than sleeping?',  // question 6 (calculate): the hold time at which spinning and sleeping waste the same, with 4 µs switches
            answer: 8, tol: 0, unit: 'µs',  // the answer, 8 µs
            why: 'Sleeping costs 2 × 4 = 8 µs of switching. Spinning costs the hold time. So spinning is the better deal for hold times up to 8 µs, which is why spinlocks suit only very short critical sections.' },  // explanation: sleeping costs two switches, 2 × 4 = 8 µs, so spinning wins below that
          { q: 'On an ordinary (non-PREEMPT_RT) kernel, a system call holds a lock taken with plain <code>spin_lock()</code>. A network interrupt arrives on the same CPU, and its handler calls <code>spin_lock()</code> on the same lock. What happens?',  // question 7 (multiple choice): on an ordinary, non-real-time kernel, what happens when a handler wants the spinlock a system call holds on the same CPU
            choices: ['The handler spins for a few microseconds until the system call finishes and releases the lock', 'That CPU deadlocks: the handler spins forever, because the holder cannot run until the handler returns', 'The kernel notices the conflict and hands the lock to the handler, then back to the system call', 'The CPU holds the interrupt pending until the system call releases the lock, then runs it'],  // choices: a short spin, a deadlock, a hand-over, and a held-back interrupt
            answer: 1,  // the answer is the second choice, the deadlock
            feedback: ['The holder is the very code the handler interrupted, on the same CPU. It cannot run again until the handler finishes, so it never releases the lock.', null, 'A spinlock is just a word in memory. It does not track owners or hand itself over.', 'Plain spin_lock leaves interrupts enabled. Only the _irq and _irqsave variants switch them off.'],  // feedback for each wrong choice; null marks the right one
            why: 'The fix is to take the lock with spin_lock_irqsave (or spin_lock_irq) in the system call, so the interrupt is held pending until the lock is released.' },  // explanation: the fix is to take the lock with interrupts off
          { q: 'Kernel code must take a lock that an interrupt handler also uses, and it cannot know whether interrupts are currently enabled. Which call should it use?',  // question 8 (multiple choice): which call to use when a handler shares the lock and the interrupt state is unknown
            choices: ['spin_lock_irq (interrupts off)', 'spin_lock_bh (bottom halves off)', 'spin_trylock (never spins)', 'spin_lock_irqsave (interrupts off)'],  // choices: spin_lock_irq, spin_lock_bh, spin_trylock and spin_lock_irqsave
            answer: 3,  // the answer is the fourth choice, spin_lock_irqsave
            feedback: ['spin_unlock_irq always switches interrupts on, even if the caller had them off on purpose.', 'This holds off only bottom halves (deferred work); the hardware interrupt handler can still cut in.', 'It avoids spinning in this code, but if it succeeds, the handler can still interrupt and spin forever on the held lock.', null],  // feedback for each wrong choice; null marks the right one
            why: 'spin_lock_irqsave saves the current interrupt state in flags, switches interrupts off, and spin_unlock_irqrestore puts back exactly the saved state.' },  // explanation: irqsave saves the state and irqrestore puts back exactly that state
          { type: 'match', q: 'Match each kernel semaphore call with what it does.',  // question 9 (match the pairs): kernel semaphore calls and what they do
            pairs: [['down', 'Sleeps until it gets a unit; signals cannot wake it'], ['down_interruptible', 'Sleeps, but a signal wakes it and it returns -EINTR'], ['down_trylock', 'Never sleeps; returns nonzero if no unit is free'], ['up', 'Gives a unit back or wakes a sleeper (semSignal)'], ['sema_init', 'Sets the starting count']],  // the five pairs: down, down_interruptible, down_trylock, up and sema_init
            why: 'down and down_interruptible are both semWait; they differ only in whether a signal can end the sleep. down_trylock is the no-wait try. up is semSignal, and sema_init sets the initial count.' },  // explanation: down and down_interruptible are both semWait, down_trylock never waits, up is semSignal
          { type: 'bucket', q: 'On an ordinary (non-PREEMPT_RT) kernel, when the lock is not available, does the waiting task spin or sleep?',  // question 10 (sort into groups): on an ordinary, non-real-time kernel, does the waiter spin or sleep for each lock call
            buckets: ['Spins (busy-waits)', 'Sleeps'],  // the two groups: spins or sleeps
            items: [['spin_lock on a held spinlock', 0], ['write_lock on an rwlock_t that readers hold', 0], ['spin_lock_irqsave on a held spinlock', 0], ['down on a semaphore whose count is 0', 1], ['mutex_lock on a held mutex', 1], ['down_write on a reader-writer semaphore that a reader holds', 1]],  // six lock calls, each with its group: three spinlock calls spin, three sleeping-lock calls sleep
            why: 'Spinlocks, including reader-writer spinlocks and the interrupt-safe variants, make the waiter loop on its CPU. Semaphores, mutexes and reader-writer semaphores put the waiter to sleep so the CPU can run something else (a modern mutex may first spin for a moment while the holder is still running, but a long wait always ends in sleep). On a PREEMPT_RT kernel spinlock_t and rwlock_t sleep too.' },  // explanation: on an ordinary kernel spinlocks of every kind spin, semaphores and mutexes sleep (a mutex may spin briefly first); on a real-time kernel spinlock_t and rwlock_t sleep as well
          { type: 'order', q: 'Put the steps of an RCU update in order.',  // question 11 (put in order): the steps of an RCU update
            items: ['Allocate memory and copy the current version into it', 'Change the copy', 'Publish the copy with rcu_assign_pointer', 'Wait for a grace period, for example with synchronize_rcu', 'Free the old version'],  // the five steps, written here in the correct order (the quiz shuffles them)
            why: 'Copy, change, publish with one pointer store, wait until every reader that might hold the old version has finished, then free it. Freeing before the grace period could pull memory out from under a reader.' },  // explanation: copy, change, publish, wait, free, and why freeing early is dangerous
          { type: 'tf', q: '<code>barrier()</code> stops the processor itself from reordering memory accesses.',  // question 12 (true or false): whether barrier() stops the processor from reordering
            answer: false,  // the answer is false
            why: 'barrier() only stops the compiler from moving accesses across it; it emits no instruction. Stopping the processor needs rmb(), wmb() or mb() (or the smp_ versions on a multiprocessor kernel).' },  // explanation: barrier() restrains only the compiler; the processor needs rmb, wmb or mb
        ],  // closes the quiz list
      },  // ends step 10
    ],  // closes the list of steps
    notes: `${/* notes: the summary that opens in the Notes panel, written as HTML */''}
      <h3>6.8 Linux Kernel Concurrency Mechanisms</h3>${/* notes heading: the section number and title */''}
      <p>Linux gives programs every UNIX tool of 6.7 plus <b>real-time signals</b>. Inside the kernel, code runs on several CPUs at once and can be interrupted between any two instructions, so the kernel has its own toolbox: <b>atomic operations</b>, <b>spinlocks</b>, <b>semaphores and mutexes</b>, <b>memory barriers</b> and <b>RCU</b>.</p>${/* notes paragraph: overview of the user-space addition and the kernel's toolbox (how to choose is at the end) */''}

      <h4>Real-time signals vs standard signals</h4>${/* notes heading: real-time versus standard signals */''}
      <table>${/* start of the comparison table */''}
        <tr><th></th><th>Standard signal (SIGINT, SIGUSR1, ...)</th><th>Real-time signal (SIGRTMIN to SIGRTMAX)</th></tr>${/* table header: the two kinds of signal */''}
        <tr><td>Repeated copies</td><td>One pending bit per signal: copies sent while it is pending are merged</td><td>Every copy is queued and delivered</td></tr>${/* table row: repeated copies merged versus queued */''}
        <tr><td>Order</td><td>Unspecified by POSIX (Linux: standard before real-time)</td><td>Lowest number first; copies of one signal in the order sent</td></tr>${/* table row: delivery order (POSIX leaves the standard-signal order open; Linux hands standard ones over first) */''}
        <tr><td>Data</td><td>None with <code>kill</code>; <code>sigqueue</code> can attach one, but merged copies keep only the first</td><td>Its own value per copy (int or pointer): <code>sigqueue(pid, sig, value)</code>, read by an <code>SA_SIGINFO</code> handler</td></tr>${/* table row: the value each kind carries: none with kill, only the first copy's for a merged standard signal, one per copy for real-time */''}
      </table>${/* end of the comparison table */''}
      <p>About 30 real-time signals exist; numbers vary by C library, so programs write SIGRTMIN+n. SIGUSR1 sent four times while blocked runs its handler <b>once</b>; four real-time signals run it four times.</p>${/* notes paragraph: how many real-time signals there are, and the four-copies example */''}

      <h4>Atomic operations</h4>${/* notes heading: atomic operations */''}
      <p>An atomic operation runs with no interruption and no interference: no other CPU sees it half done. Two kinds: <b>integer operations</b> on the type <code>atomic_t</code>, and <b>bitmap operations</b> on one bit of any ordinary word. atomic_t is a separate type so that (1) only atomic_ functions accept it (<code>count++</code> on it will not compile) and (2) the compiler cannot keep it in a register or optimize an access away. Typical use: counters and <b>reference counts</b>.</p>${/* notes paragraph: what atomic means, the two kinds, and why atomic_t is a separate type */''}
      <p><code>count++</code> is three steps (load, add, store). If count = 5 and two CPUs both load before either stores, both store 6: a lost update (it should be 7). <code>atomic_inc</code> is one indivisible step (on x86, an instruction with a <code>lock</code> prefix), so any order gives 7.</p>${/* notes paragraph: the lost update in count++ and how atomic_inc avoids it */''}
      <table>${/* start of the integer operations table */''}
        <tr><th>Integer operation</th><th>Effect</th></tr>${/* table header: operation and effect */''}
        <tr><td><code>atomic_t v = ATOMIC_INIT(i);</code></td><td>declare v with starting value i</td></tr>${/* table row: declaring with ATOMIC_INIT */''}
        <tr><td><code>atomic_read(&amp;v)</code>, <code>atomic_set(&amp;v, i)</code></td><td>return v; set v to i</td></tr>${/* table row: atomic_read and atomic_set */''}
        <tr><td><code>atomic_add(i, &amp;v)</code>, <code>atomic_sub(i, &amp;v)</code>, <code>atomic_inc(&amp;v)</code>, <code>atomic_dec(&amp;v)</code></td><td>add or subtract i (amount first) or 1</td></tr>${/* table row: add, sub, inc and dec, with the amount first */''}
        <tr><td><code>atomic_sub_and_test(i, &amp;v)</code></td><td>subtract i; return true if the result is 0</td></tr>${/* table row: atomic_sub_and_test */''}
        <tr><td><code>atomic_add_negative(i, &amp;v)</code></td><td>add i; return true if the result is negative</td></tr>${/* table row: atomic_add_negative */''}
        <tr><td><code>atomic_dec_and_test(&amp;v)</code> / <code>atomic_inc_and_test(&amp;v)</code></td><td>subtract / add 1; return true if the result is 0</td></tr>${/* table row: atomic_dec_and_test and atomic_inc_and_test */''}
      </table>${/* end of the integer operations table */''}
      <p>Example: v = 10; add 5 → 15; sub 3 → 12; dec → 11. With v = 5, <code>atomic_add_negative(-7, &amp;v)</code> leaves −2 and returns true. For a reference count, the one caller whose <code>atomic_dec_and_test</code> returns true frees the object.</p>${/* notes paragraph: a worked example and the reference-count use */''}
      <p><b>Bitmap operations</b> take a bit number nr and the address of a word: <code>set_bit</code>, <code>clear_bit</code>, <code>change_bit</code> (flip), <code>test_and_set_bit</code>, <code>test_and_clear_bit</code>, <code>test_and_change_bit</code> (each returns the bit’s old value) and <code>test_bit</code> (read only). Example: flags = 0x25 (00100101); <code>test_and_set_bit(3, &amp;flags)</code> returns 0 and leaves 0x2d; a second call returns 1. That makes a tiny try-lock.</p>${/* notes paragraph: the bitmap operations, with the 0x25 example as a tiny try-lock */''}

      <h4>Spinlocks: spin or sleep?</h4>${/* notes heading: spinlocks, spin or sleep */''}
      <p>The most common kernel lock. One CPU holds it; others <b>spin</b> (busy-wait) until it is free. API: <code>spin_lock_init</code>, <code>spin_lock</code>, <code>spin_unlock</code>, <code>spin_trylock</code> (returns 0 at once, never spinning, if the lock is held) and <code>spin_is_locked</code>. A spinning waiter wastes the whole hold time H; a sleeping waiter pays two context switches, 2C. Spin only when <b>H is shorter than two context switches</b>. With C = 3 µs (break-even 6 µs): H = 4 µs → spin (4 wasted, not 6); H = 14 µs → sleep (6 wasted, not 14). Never sleep holding a spinlock. On a uniprocessor kernel spin_lock only switches off kernel preemption (nothing if it is not preemptible).</p>${/* notes paragraph: the spinlock calls, the break-even rule with examples, and the single-processor case */''}

      <h4>Spinlocks and interrupts</h4>${/* notes heading: spinlocks and interrupts */''}
      <p><b>Process context</b> (a system call) may sleep; <b>interrupt context</b> (a handler) must not, so handlers use spinlocks. If a system call holds a lock with plain spin_lock and an interrupt on the <b>same CPU</b> runs a handler that wants that lock, the handler spins forever: the holder cannot run until the handler returns. The fix is to switch local interrupts off while holding the lock; the interrupt then waits as pending.</p>${/* notes paragraph: the same-CPU deadlock and the fix of switching interrupts off */''}
      <table>${/* start of the variants table */''}
        <tr><th>Variant</th><th>What it adds · when to use it</th></tr>${/* table header: variant, and what it adds and when to use it */''}
        <tr><td><code>spin_lock</code></td><td>Nothing. For locks no handler takes, or when interrupts are already off.</td></tr>${/* table row: spin_lock */''}
        <tr><td><code>spin_lock_irq</code></td><td>Local interrupts off; <code>spin_unlock_irq</code> always turns them on. Only when you know they were on.</td></tr>${/* table row: spin_lock_irq */''}
        <tr><td><code>spin_lock_irqsave(&amp;l, flags)</code></td><td>Saves the interrupt state in flags, then off; <code>spin_unlock_irqrestore</code> restores it. When you do not know.</td></tr>${/* table row: spin_lock_irqsave */''}
        <tr><td><code>spin_lock_bh</code></td><td>Holds off bottom halves (softirqs, work deferred by handlers) on this CPU.</td></tr>${/* table row: spin_lock_bh */''}
      </table>${/* end of the variants table */''}
      <p><b>Reader-writer spinlocks</b> (<code>rwlock_t</code>: <code>read_lock</code>, <code>read_unlock</code>, <code>write_lock</code>, <code>write_unlock</code>) admit many readers or one writer. In the classic design readers are favoured: a new reader enters even while a writer waits, so overlapping readers can starve the writer. (Since Linux 3.16, x86 and later most other processors use a queued rwlock_t in which only readers in interrupt context can still cut ahead of a waiting writer.)</p>${/* notes paragraph: reader-writer spinlocks and writer starvation */''}
      <p><b>Scope.</b> Ordinary kernels. Under PREEMPT_RT (real-time), spinlock_t and rwlock_t become sleeping rt-mutexes: taking one does not disable preemption, _irq/_irqsave do not change the interrupt state, and only raw_spinlock_t still spins.</p>${/* notes paragraph: the spinlock notes describe ordinary kernels; on real-time kernels spinlock_t and rwlock_t sleep and only raw_spinlock_t spins */''}

      <h4>Kernel semaphores and mutexes</h4>${/* notes heading: kernel semaphores and mutexes */''}
      <p>Kernel-only, invisible to programs, and cheaper than user-visible semaphores. A waiter sleeps. Three kinds: binary, counting and reader-writer. Counting API: <code>sema_init(&amp;sem, count)</code>; <code>down</code> (semWait; sleeps and ignores signals); <code>down_interruptible</code> (sleeps, but a signal wakes it and it returns -EINTR without the semaphore; the usual choice); <code>down_trylock</code> (never sleeps; returns nonzero if it could not take it); <code>up</code> (semSignal; hands the unit to the longest sleeper, or adds it back to count). Linux keeps count ≥ 0 with a separate wait queue; the classic model’s negative value is count minus the number of sleepers. For plain mutual exclusion Linux prefers the <b>mutex</b> (<code>mutex_lock</code>/<code>mutex_unlock</code>): one holder, only it may unlock, never used in interrupt context. <b>Reader-writer semaphores</b>: <code>init_rwsem</code>, <code>down_read</code>/<code>up_read</code>, <code>down_write</code>/<code>up_write</code>; many readers or one writer, sleeping uninterruptibly.</p>${/* notes paragraph: the semaphore calls, how Linux keeps count, the mutex and reader-writer semaphores */''}

      <h4>Memory barriers</h4>${/* notes heading: memory barriers */''}
      <p>Compilers and processors may reorder loads and stores for speed. One thread never notices; another CPU can. <code>rmb()</code> keeps loads from crossing it, <code>wmb()</code> stores, <code>mb()</code> both; <code>barrier()</code> stops only the compiler. <code>smp_rmb()</code>, <code>smp_wmb()</code> and <code>smp_mb()</code> are real barriers on a multiprocessor kernel and only compiler barriers on a uniprocessor kernel. Pattern: CPU 0 runs <code>data = 42; wmb(); ready = 1;</code> and CPU 1 runs <code>if (ready) { rmb(); use(data); }</code>. Counting the possible orders of the four accesses: no barriers, 6 of 24 let CPU 1 see ready = 1 with data = 0; wmb alone or rmb alone, 1 of 12; both, 0 of 6. (x86 keeps stores in order with stores and loads with loads, so there smp_wmb and smp_rmb only restrain the compiler; ARM and POWER need real fences.)</p>${/* notes paragraph: the barrier calls, the flag pattern and how many orders give a stale read with each barrier choice */''}

      <h4>Read-copy-update (RCU)</h4>${/* notes heading: read-copy-update */''}
      <p>For data read constantly and changed rarely (a routing table). Readers call <code>rcu_read_lock()</code>, fetch the pointer with <code>rcu_dereference()</code>, and finish with <code>rcu_read_unlock()</code>; this marks a read-side critical section and takes no lock. A writer: (1) copies the current version, (2) changes the copy, (3) publishes it with <code>rcu_assign_pointer</code>, one pointer store, (4) waits a <b>grace period</b> until every reader that might hold the old version has finished, either blocking in <code>synchronize_rcu()</code> or registering a callback with <code>call_rcu()</code>, and (5) frees the old version. Readers see the whole old or the whole new version, never a mix. Freeing before the grace period ends is a use-after-free. Writers still coordinate among themselves, usually with a spinlock.</p>${/* notes paragraph: what readers do, the writer's five steps, and the danger of freeing early */''}

      <h4>Choosing a tool</h4>${/* notes heading: choosing a tool */''}
      <p>One counter or bit: atomic operation. Short critical section: spinlock (_irqsave if a handler shares it). Long wait or a holder that may sleep: mutex or semaphore. Read-mostly data: RCU. Data handed over through a flag: wmb/rmb.</p>`,  // notes paragraph: one line per kind of job; the backtick ends the notes
  });  // closes the section definition passed to Guide.section
})();  // closes the wrapper function and runs it straight away
