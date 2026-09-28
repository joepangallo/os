// Comment key: a line inside backtick text ends with ${/* comment */''}, an empty-string slot that holds a comment without changing the text on screen (full note at the top of the page).
/* =====================================================================
   Section 5.5 — Monitors
   A monitor packages shared data with the only procedures allowed to use
   it, and gives mutual exclusion automatically. Condition variables
   (cwait / csignal, or cnotify / cbroadcast in Mesa style) let processes
   wait inside it. Helpers shared by several steps live in this IIFE.
   ===================================================================== */
(() => {  // wraps the whole section in an arrow function that runs once, right away, so its helper names stay private to this file
  /* ---------- helper 1: the monitor "building" used by the live lab and the Hoare/Mesa replay ----------
     st = { buf:[3 slots], nextin, nextout, count, inside:id|null, entry:[], urgent:[], notfull:[], notempty:[],
            done:[], labels:{id:text}, warn:[ids], bad:[ids], lost:'notfull'|'notempty'|null,
            mode:'hoare'|'mesa', activity:'text under the running process' }
     Process ids start with P (producer) or C (consumer). Chips glide between rooms (CSS transition). */
  const NSLOT = 3;  // NSLOT: the bounded buffer in the monitor drawings has 3 slots
  function makeStage(ctx) {  // makeStage(ctx): builds the monitor "building" drawing and returns it with a set() function that redraws it from a state
    const { s } = ctx;  // s builds SVG elements (SVG is the browser's drawing format)
    const svg = s('svg', { viewBox: '0 0 620 362', width: '100%', role: 'img', 'aria-label': 'A monitor drawn as a building: entrance queue, one running process, urgent queue and two condition queues' });  // the drawing: 620 by 362 units, scaled to the box width; aria-label describes the rooms for screen readers
    const T = (x, y, str, a) => s('text', Object.assign({ x, y, 'font-size': 13 }, a || {}), str);  // T(x, y, str, a): shortcut that makes a text label at x, y (13px unless a says otherwise)
    const B = (x, y, w, ht, cls, a) => s('rect', Object.assign({ x, y, width: w, height: ht, rx: 10, class: cls, 'stroke-width': 1.5 }, a || {}));  // B(x, y, w, ht, cls, a): shortcut that makes a rounded rectangle with a color class
    const slotR = [], slotT = [], ptrT = [];  // lists that will hold each buffer slot's box, its value text and its pointer label
    const dataG = s('g');  // dataG groups the buffer slots so they can be added to the drawing together
    for (let i = 0; i < NSLOT; i++) {  // builds the three buffer slots, left to right
      slotR.push(B(160 + i * 56, 58, 50, 36, 's-panel', { rx: 7 }));  // slot i's box, drawn empty at first
      slotT.push(T(185 + i * 56, 83, '', { 'text-anchor': 'middle', 'font-size': 19, 'font-weight': 800, class: 's-monot' }));  // slot i's value, in large fixed-width type
      ptrT.push(T(185 + i * 56, 128, '', { 'text-anchor': 'middle', 'font-weight': 800, style: 'fill:var(--mem)' }));  // slot i's pointer label, which will show "in" or "out" under it
      dataG.append(slotR[i], slotT[i], T(185 + i * 56, 110, '[' + i + ']', { 'text-anchor': 'middle', class: 's-sub' }), ptrT[i]);  // adds the box, the value, the index label [0], [1] or [2], and the pointer label to the group
    }  // ends the slot loop
    const countT = T(346, 90, '0', { 'font-size': 30, 'font-weight': 800 });  // countT shows the monitor's count variable in large type
    const inT = T(346, 112, '', { class: 's-sub' });  // inT shows the value of nextin
    const outT = T(346, 128, '', { class: 's-sub' });  // outT shows the value of nextout
    const urgG = s('g', {}, B(462, 34, 142, 106, 's-warn'), T(472, 51, 'urgent queue', { 'font-weight': 700 }), T(472, 67, 'signalers wait here', { class: 's-sub' }));  // urgG is the urgent queue room, where processes that signaled wait (Hoare style); it is dimmed in Mesa mode
    const urgNote = T(533, 130, '', { 'text-anchor': 'middle', class: 's-sub' });  // urgNote is a small note in the urgent room (overflow count, or "not used in Mesa")
    const actT = T(253, 234, '', { 'text-anchor': 'middle', class: 's-sub' });  // actT is the text under the process that is inside, saying what it is doing
    const lostNF = T(362, 344, '', { 'text-anchor': 'end', 'font-weight': 800, style: 'fill:var(--bad)' });  // lostNF shows "signal lost!" under the notfull queue when a signal found nobody waiting
    const lostNE = T(594, 344, '', { 'text-anchor': 'end', 'font-weight': 800, style: 'fill:var(--bad)' });  // lostNE shows "signal lost!" under the notempty queue
    const more = { entry: T(66, 346, '', { 'text-anchor': 'middle', class: 's-sub' }), notfull: T(160, 344, '', { class: 's-sub' }), notempty: T(394, 344, '', { class: 's-sub' }) };  // more holds "+N more" labels for queues longer than the space drawn for them
    svg.append(  // adds the fixed parts of the building to the drawing
      B(136, 6, 478, 350, 's-panel', { rx: 16, 'stroke-width': 2.5 }),  // the outer wall of the monitor
      s('rect', { x: 129, y: 176, width: 14, height: 36, class: 'm5-door' }),  // a gap in the wall on the left side: the only door into the monitor
      T(150, 25, 'monitor boundedbuffer', { 'font-weight': 800, 'font-size': 15 }), T(346, 25, '(N = 3 slots)', { class: 's-sub' }),  // the monitor's name and its buffer size
      T(66, 150, 'entrance', { 'text-anchor': 'middle', 'font-weight': 700 }),  // label over the entrance queue, first word
      T(66, 166, 'queue', { 'text-anchor': 'middle', 'font-weight': 700 }),  // label over the entrance queue, second word
      s('line', { x1: 99, y1: 194, x2: 134, y2: 194, class: 's-line', 'marker-end': 'url(#arr)' }),  // an arrow from the entrance queue to the door
      B(150, 34, 300, 106, 's-mem'), T(160, 51, 'local data: buffer', { 'font-weight': 700 }), dataG,  // the local data room holding the buffer slots
      T(346, 51, 'count', { 'font-weight': 700 }), countT, inT, outT,  // the count label, its value, and the nextin and nextout texts
      urgG, urgNote,  // the urgent queue room and its note
      B(150, 150, 206, 92, 's-cpu'), T(160, 167, 'inside (one at a time)', { 'font-weight': 700 }), actT,  // the room for the one process allowed inside at a time, with its activity text
      B(368, 150, 236, 92, 's-panel', { 'stroke-dasharray': '6 4' }), T(378, 167, 'left the monitor', { 'font-weight': 700 }),  // a dashed room on the right for processes that have left the monitor
      B(150, 252, 222, 100, 's-os'), T(160, 269, 'cond notfull', { 'font-weight': 700 }), T(160, 285, 'producers wait here', { class: 's-sub' }),  // the notfull condition queue room, where producers wait
      B(384, 252, 220, 100, 's-os'), T(394, 269, 'cond notempty', { 'font-weight': 700 }), T(394, 285, 'consumers wait here', { class: 's-sub' }),  // the notempty condition queue room, where consumers wait
      lostNF, lostNE, more.entry, more.notfull, more.notempty,  // the lost-signal warnings and the "+N more" labels
    );  // ends the list of fixed parts
    const layer = s('g');  // layer is a group drawn on top, holding the moving process chips
    svg.append(layer);  // adds the chip layer last so chips appear above the rooms
    const chips = new Map();  // chips remembers each process's chip by its id (such as P1 or C2), so the same chip can glide between rooms
    function chipEl(id) {  // chipEl(id): returns the chip for a process, creating it the first time it is needed
      let c = chips.get(id);  // looks for an existing chip
      if (c) return c;  // reuses it if found
      const txt = s('text', { x: 30, y: 20, 'text-anchor': 'middle' }, id);  // the chip's label text
      const g = s('g', { class: 'm5-chip m5-now m5-' + id[0] }, s('rect', { width: 60, height: 30, rx: 8 }), txt);  // the chip: a rounded box plus label; its class sets the color from the id's first letter (P producer, C consumer)
      c = { g, txt, fresh: true };  // fresh marks a chip that has not been placed yet
      chips.set(id, c);  // remembers the new chip
      layer.append(g);  // puts it on the chip layer
      return c;  // returns the new chip
    }  // ends chipEl()
    function set(st, opt) {  // set(st, opt): redraws the building to match state st; opt.slideIn makes new chips slide in from the left
      opt = opt || {};  // opt is optional, so an empty object stands in when it is missing
      for (let i = 0; i < NSLOT; i++) {  // updates each buffer slot
        const v = st.buf[i];  // v is the item in slot i, or null if the slot is empty
        slotT[i].textContent = v == null ? '' : v;  // shows the item, or nothing for an empty slot
        slotR[i].setAttribute('class', v == null ? 's-panel' : 's-mem');  // colors a filled slot like memory and an empty one gray
        const tags = [];  // tags collects the pointers that point at this slot
        if (st.nextin === i) tags.push('in');  // nextin points here: the next item will be put in this slot
        if (st.nextout === i) tags.push('out');  // nextout points here: the next item will be taken from this slot
        ptrT[i].textContent = tags.length ? '↑' + tags.join('/') : '';  // shows an up-arrow with in, out or both under the slot
      }  // ends the slot loop
      countT.textContent = st.count;  // shows count
      countT.style.fill = st.count < 0 || st.count > NSLOT ? 'var(--bad)' : '';  // turns count red if it is ever out of range (below 0 or above 3), which would mean a bug
      inT.textContent = 'nextin = ' + st.nextin;  // shows nextin
      outT.textContent = 'nextout = ' + st.nextout;  // shows nextout
      const pos = new Map();  // pos will map each process id to [x, y, visible] for its chip
      const put = (arr, max, fx) => (arr || []).forEach((id, i) => pos.set(id, fx(Math.min(i, max - 1)).concat(i < max)));  // put(arr, max, fx): places a queue's chips at the positions fx gives; only the first max are visible, the rest wait hidden
      put(st.entry, 4, (i) => [36, 179 + i * 38]);  // the entrance queue: up to 4 chips stacked down the left side
      if (st.inside) pos.set(st.inside, [223, 184, true]);  // the process inside, if any, in the middle room
      put(st.urgent, 2, (i) => [472 + i * 66, 78]);  // the urgent queue: up to 2 chips side by side
      put(st.notfull, 3, (i) => [160 + i * 68, 296]);  // the notfull queue: up to 3 chips in a row
      put(st.notempty, 3, (i) => [394 + i * 68, 296]);  // the notempty queue: up to 3 chips in a row
      const done = st.done || [];  // done lists processes that have left the monitor
      done.forEach((id, i) => { const j = i - (done.length - 3); pos.set(id, j >= 0 ? [378 + j * 74, 184, true] : [378, 184, false]); });  // only the 3 most recent leavers are shown in the "left" room; older ones are hidden
      for (const [id, p] of pos) {  // moves every chip that has a position
        const c = chipEl(id);  // gets (or creates) the chip
        if (c.fresh && opt.slideIn) { c.g.style.transform = `translate(-70px, ${p[1]}px)`; c.g.getBoundingClientRect(); c.g.classList.remove('m5-now'); }  // a brand-new chip with slideIn starts just left of the drawing, then its no-transition class is removed so it glides in
        c.fresh = false;  // the chip is no longer new
        c.g.style.transform = `translate(${p[0]}px, ${p[1]}px)`;  // moves the chip to its position; the CSS transition makes it glide
        c.g.style.opacity = p[2] ? 1 : 0;  // shows the chip, or fades it out if its queue is too long to show it
        c.txt.textContent = (st.labels && st.labels[id]) || id;  // the chip's text: a custom label for this step if one is given, otherwise the id
        c.g.classList.toggle('m5-warn', !!(st.warn && st.warn.includes(id)));  // a dashed warning look for chips listed in st.warn
        c.g.classList.toggle('m5-bad', !!(st.bad && st.bad.includes(id)));  // a thick red look for chips listed in st.bad
      }  // ends the chip loop
      for (const [id, c] of chips) if (!pos.has(id)) c.g.style.opacity = 0;  // fades out any chip that has no place in this state
      ctx.after(60, () => chips.forEach((c) => c.g.classList.remove('m5-now')));  // 60 ms later, turns transitions on for every chip, so new chips appear in place but later moves glide
      const cnt = (a, max) => (a && a.length > max ? '+' + (a.length - max) + ' more' : '');  // cnt(a, max): the "+N more" text for a queue longer than max, or nothing
      more.entry.textContent = cnt(st.entry, 4);  // overflow label for the entrance queue (more than 4 waiting)
      more.notfull.textContent = cnt(st.notfull, 3);  // overflow label for the notfull queue (more than 3 waiting)
      more.notempty.textContent = cnt(st.notempty, 3);  // overflow label for the notempty queue (more than 3 waiting)
      const mesa = st.mode === 'mesa';  // mesa is true when the drawing follows Mesa rules
      urgG.classList.toggle('m5-dim', mesa);  // Mesa monitors have no urgent queue, so that room is dimmed
      urgNote.textContent = mesa ? 'not used in Mesa' : cnt(st.urgent, 2);  // the urgent note says "not used in Mesa", or shows its overflow count in Hoare mode
      lostNF.textContent = st.lost === 'notfull' ? 'signal lost!' : '';  // shows "signal lost!" under notfull when a signal there found nobody waiting
      lostNE.textContent = st.lost === 'notempty' ? 'signal lost!' : '';  // shows "signal lost!" under notempty in the same situation
      actT.textContent = st.activity != null ? st.activity : st.inside ? '' : 'empty: next one may enter';  // the activity text: a custom one if given, nothing if someone is inside, or "empty: next one may enter"
    }  // ends set()
    return { svg, set };  // hands back the drawing and its set() function
  }  // ends makeStage()
  /* ---------- helper 3: phones. A wide diagram keeps a readable size and scrolls sideways inside its card
     (the same way code listings do) instead of shrinking its labels to a few pixels. ---------- */
  function wide(ctx, svg, minW) {  // wide(ctx, svg, minW): on phones, keeps a wide drawing at a readable size and lets it scroll sideways
    if (!ctx.narrow) return svg;  // on a larger screen the drawing is returned unchanged
    svg.style.minWidth = minW + 'px';  // sets a minimum width so the labels stay readable instead of shrinking
    svg.style.maxWidth = 'none';  // removes any maximum width so that minimum can take effect
    return ctx.h('div', { class: 'm5-widewrap' }, ctx.h('div', { class: 'm5-wide' }, svg), ctx.h('div', { class: 'xs muted center' }, 'Swipe the diagram sideways to see all of it.'));  // wraps it in a scrolling box with a hint underneath telling the student to swipe sideways
  }  // ends wide()
  const emptyState = (mode) => ({ buf: [null, null, null], nextin: 0, nextout: 0, count: 0, inside: null, entry: [], urgent: [], notfull: [], notempty: [], done: [], labels: {}, warn: [], bad: [], lost: null, mode: mode || 'hoare', activity: null });  // emptyState(mode): a fresh monitor state for the building drawing, empty buffer and empty queues, in Hoare or Mesa mode

  /* ---------- helper 2: the bounded-buffer procedures as a listing (every line commented) ----------
     style: 'hoare' (if + csignal) | 'mesa-if' (if + cnotify) | 'mesa-while' (while + cnotify).
     Line map: append() is lines 1-7, take() is lines 8-14; statement k of a procedure is line header+k. */
  function bbSource(style) {  // bbSource(style): builds the bounded-buffer monitor code as text, in one of three styles
    const mesa = style !== 'hoare';  // mesa is true for both Mesa styles
    const w = style === 'mesa-while';  // w is true for the Mesa style that re-tests with while
    const test = w ? 'while' : 'if';  // test is the keyword used before each wait: while or if
    const sig = mesa ? 'cnotify' : 'csignal';  // sig is the wake-up call: cnotify for Mesa, csignal for Hoare
    const rows = [  // rows: each source line paired with its short on-screen comment
      ['void append(char x) {', '// a producer enters'],  // shown code, line 1: append() header, a producer enters
      [`  ${test} (count == N) cwait(notfull);`, w ? '// re-test on waking' : '// full? then sleep'],  // shown code, line 2: if the buffer is full, wait on notfull (with while, the test repeats after waking)
      ['  buffer[nextin] = x;', '// store the item'],  // shown code, line 3: store the item in the next free slot
      ['  nextin = (nextin + 1) % N;', '// advance, wrap at N'],  // shown code, line 4: move nextin forward, wrapping around after the last slot
      ['  count++;', '// one more item'],  // shown code, line 5: one more item in the buffer
      [`  ${sig}(notempty);`, mesa ? '// hint a consumer' : '// wake a consumer'],  // shown code, line 6: wake (Hoare) or hint (Mesa) a waiting consumer
      ['}', '// leave the monitor'],  // shown code, line 7: end of append(), leaving the monitor
      ['void take(char &x) {', '// a consumer enters'],  // shown code, line 8: take() header, a consumer enters
      [`  ${test} (count == 0) cwait(notempty);`, w ? '// re-test on waking' : '// empty? then sleep'],  // shown code, line 9: if the buffer is empty, wait on notempty
      ['  x = buffer[nextout];', '// copy oldest item'],  // shown code, line 10: copy out the oldest item
      ['  nextout = (nextout + 1) % N;', '// advance, wrap at N'],  // shown code, line 11: move nextout forward, wrapping around
      ['  count--;', '// one fewer item'],  // shown code, line 12: one fewer item
      [`  ${sig}(notfull);`, mesa ? '// hint a producer' : '// wake a producer'],  // shown code, line 13: wake or hint a waiting producer
      ['}', '// leave the monitor'],  // shown code, line 14: end of take(), leaving the monitor
    ];  // closes rows
    const pad = w ? 38 : 35;  // pad is the column where the comments start (a little further for the longer while lines)
    return rows.map(([c, k]) => c.padEnd(pad) + k).join('\n');  // pads each code line to that column, adds its comment, and joins the lines into one text
  }  // ends bbSource()

  Guide.section({  // registers this section with the guide's shell, which builds its pages, glossary and quiz from this object
    id: '5.5',  // id: the section number used in links, saved progress and CSS class names (sec-5-5)
    title: 'Monitors',  // title shown at the top of every step in this section
    short: 'Monitors',  // short name used where space is tight
    summary: 'A language construct that gives mutual exclusion for free and lets processes wait on condition variables.',  // one-sentence summary shown on the chapter overview page
    objectives: [  // objectives: what a student should be able to do after this section
      'Explain why monitors were invented as a safer, language-level alternative to semaphore calls scattered through a program.',  // objective 1: why monitors were invented as a safer alternative to scattered semaphore calls
      'Describe the parts of a monitor (local data, procedures, initialization) and its entrance, condition and urgent queues.',  // objective 2: the parts of a monitor and its queues
      'Use cwait and csignal on condition variables, and explain why a signal sent when nobody waits is lost.',  // objective 3: cwait and csignal, and why an unheard signal is lost
      'Trace the bounded-buffer producer/consumer solution written as a monitor, line by line.',  // objective 4: trace the bounded-buffer monitor line by line
      'Compare Hoare monitors (csignal) with Lampson/Redell Mesa monitors (cnotify, cbroadcast, watchdog timers), including why Mesa code re-tests with while.',  // objective 5: compare the Hoare and Mesa rules, including the while re-test
    ],  // closes the objectives list
    terms: [  // terms: glossary entries as [term, definition] pairs; the shell links these words wherever they appear
      ['Monitor', 'A programming-language construct that bundles shared data with the only procedures allowed to touch it, and guarantees that at most one process is executing inside those procedures at any moment.'],  // glossary entry: defines a monitor
      ['Condition variable', 'A named waiting line inside a monitor. A process that cannot continue waits on it with cwait; another process wakes it with csignal (or cnotify / cbroadcast). It stores no count and no value.'],  // glossary entry: defines a condition variable, a named waiting line that stores no count
      ['cwait', 'cwait(c): the calling process always suspends itself on condition c and gives up the monitor, so another process may enter.'],  // glossary entry: defines cwait, which always suspends the caller and frees the monitor
      ['csignal', 'csignal(c): resume one process that is waiting on condition c. If no process is waiting, nothing happens: the signal is lost.'],  // glossary entry: defines csignal, which wakes one waiter or is lost if none waits
      ['Entrance queue', 'The line of processes that have called a monitor procedure but must wait outside because another process is already inside.'],  // glossary entry: defines the entrance queue
      ['Condition queue', 'The line of processes suspended on one particular condition variable, waiting to be signaled.'],  // glossary entry: defines a condition queue
      ['Urgent queue', 'In a Hoare monitor, the place where a process that issued csignal, and still has work to do inside, waits after handing the monitor to the process it woke. It gets back in before any newcomer from the entrance queue.'],  // glossary entry: defines the urgent queue, where a signaler waits in a Hoare monitor
      ['Hoare monitor', 'The original monitor rules: csignal hands the monitor at once to the woken process, so the condition it waited for is guaranteed to still be true when it resumes.'],  // glossary entry: defines a Hoare monitor, where the woken process runs at once
      ['Mesa monitor', 'The Lampson and Redell rules, first used in the Mesa language: cnotify only makes a waiter ready, the notifier keeps running, and the waiter must re-test its condition with a while loop.'],  // glossary entry: defines a Mesa monitor, where a notified waiter must re-test with while
      ['cnotify', 'cnotify(x): tell one process waiting on condition x that its condition may now hold. It resumes at some convenient later time while the notifier carries on.'],  // glossary entry: defines cnotify
      ['cbroadcast', 'cbroadcast(x): make every process waiting on condition x ready. Each one re-tests its own condition when it gets the monitor.'],  // glossary entry: defines cbroadcast, which readies every waiter on a condition
      ['Watchdog timer', 'A time limit on a wait. If a waiting process is not notified in time, it is made ready anyway and re-tests its condition, so a missing notify cannot strand it forever.'],  // glossary entry: defines a watchdog timer, a time limit on a wait
      ['Lost signal', 'A csignal sent when no process is waiting on that condition. The monitor keeps no record of it, whereas a semaphore remembers a signal by increasing its count.'],  // glossary entry: defines a lost signal and contrasts it with a semaphore's count
      ['Bounded buffer', 'A shared store with a fixed number of slots, filled by producers and emptied by consumers. Producers must wait when it is full, consumers when it is empty.'],  // glossary entry: defines a bounded buffer
      ['Semaphore', 'An integer used for signaling between processes that is changed only by the atomic operations semWait (decrement, maybe block) and semSignal (increment, maybe unblock).'],  // glossary entry: defines a semaphore
      ['Mutual exclusion', 'The guarantee that while one process is using a shared resource or critical section, no other process can be using it.'],  // glossary entry: defines mutual exclusion
      ['Deadlock', 'A permanent standstill: each process in a group is waiting (blocked or spinning) for something that only another waiting member of the group can provide.'],  // glossary entry: defines deadlock
      ['Process switch', 'Taking the processor away from one process and giving it to another. It costs time to save one process’s state and restore the other’s.'],  // glossary entry: defines a process switch and its cost
    ],  // closes the terms list

    css: ` /* css: style rules for this section only; each starts with .sec-5-5 so it cannot affect other sections */
      .sec-5-5 .m5-chip { transition: transform .55s cubic-bezier(.3,.7,.2,1), opacity .35s; } /* process chips glide smoothly when they move between rooms and fade when hidden */
      .sec-5-5 .m5-chip.m5-now { transition: none; } /* m5-now switches the glide off, so a newly drawn chip appears in place instead of flying in */
      .sec-5-5 .m5-chip rect { stroke-width: 2; } /* gives each chip box a 2px outline */
      .sec-5-5 .m5-chip text { font-weight: 800; font-size: 14px; } /* chip labels are bold 14px text */
      .sec-5-5 .m5-P rect { fill: var(--proc-bg); stroke: var(--proc); } /* producer chips (ids starting with P) use the processor colors */
      .sec-5-5 .m5-C rect { fill: var(--accent-bg); stroke: var(--accent); } /* consumer chips (ids starting with C) use the accent color */
      .sec-5-5 .m5-chip.m5-warn rect { fill: var(--warn-bg); stroke: var(--warn); stroke-dasharray: 5 3; } /* a chip marked warn gets a dashed warning outline: a Mesa waiter that was notified but has not run yet */
      .sec-5-5 .m5-chip.m5-bad rect { fill: var(--bad-bg); stroke: var(--bad); stroke-width: 3; } /* a chip marked bad gets a thick red outline: a process that acted on a stale test and broke the buffer */
      .sec-5-5 .m5-door { fill: var(--panel); stroke: none; } /* the door: a gap in the monitor wall painted the panel color, with no outline */
      .sec-5-5 .m5-dim { opacity: .35; } /* m5-dim fades something that does not apply, such as the urgent queue in Mesa mode */
      .sec-5-5 .hot { cursor: pointer; fill: transparent; stroke: transparent; stroke-width: 3; } /* .hot areas in a drawing are invisible click targets that show a hand pointer */
      .sec-5-5 .hot:hover { stroke: var(--chc); stroke-dasharray: 6 4; } /* hovering a click target draws a dashed outline in the chapter color */
      .sec-5-5 .hot.on { stroke: var(--chc); fill: color-mix(in srgb, var(--chc) 10%, transparent); } /* the selected click target keeps a solid outline and a light tint */
      .sec-5-5 pre.code .ln.clickable { cursor: pointer; } /* code lines that can be clicked show a hand pointer */
      .sec-5-5 pre.code .ln.clickable:hover { background: var(--panel-2); } /* a clickable code line gets a light background on hover, so students see it responds */
      .sec-5-5 .m5-rule { transition: background .2s, border-color .2s; } /* the three monitor rule cards fade their color and border smoothly when they light up */
      .sec-5-5 .m5-rule.on { border-color: var(--chc); background: color-mix(in srgb, var(--chc) 12%, var(--panel)); } /* a rule card that applies to the clicked part of the building gets a chapter-colored border and tint */
      .sec-5-5 .m5-info h4 { color: var(--chc); } /* the heading in the monitor explorer's info card uses the chapter color */
      .sec-5-5 .m5-row { display: grid; grid-template-columns: 124px minmax(0, 1fr); align-items: center; min-height: 34px; gap: 8px; } /* a row in the lost-signal comparison: a fixed 124px label column, then the contents */
      .sec-5-5 .m5-q .chip { font-size: 14px; padding: 3px 11px; } /* process chips in those rows are slightly larger than normal chips */
      .sec-5-5 .m5-log { height: 112px; font-size: 13px; } /* each side's event log is a fixed 112px tall so the two cards stay level */
      .sec-5-5 .m5-bar { flex: none; display: flex; height: 46px; border-radius: 10px; overflow: hidden; border: 1px solid var(--line-2); background: var(--panel-3); } /* m5-bar is the memory bar in the Mesa broadcast demo: a 46px strip split into colored parts */
      .sec-5-5 .m5-bar > div { display: grid; place-items: center; font-size: 13px; font-weight: 800; white-space: nowrap; overflow: hidden; transition: flex-basis .45s ease; border-right: 2px solid var(--panel); } /* each part of the bar is sized by its share of memory and resizes smoothly when the numbers change */
      .sec-5-5 .m5-bar .oth { background: var(--panel-3); color: var(--muted); } /* the part used by other programs, in gray */
      .sec-5-5 .m5-bar .fr { background: var(--mem-bg); color: var(--mem); } /* the free part, in the memory color */
      .sec-5-5 .m5-bar .fh { background: var(--io-bg); color: var(--io); } /* the part held by process F, in the I/O color */
      .sec-5-5 .m5-bar .rq { background: var(--proc-bg); color: var(--proc); } /* the parts held by the requesting processes, in the processor color */
      .sec-5-5 .m5-req { border: 2px solid var(--line); transition: border-color .25s, background .25s; } /* m5-req is one requester's card in the same demo, with a border that can change color */
      .sec-5-5 .m6-key { display: inline-block; width: 20px; height: 14px; border-radius: 4px; border: 1.5px solid var(--line-2); } /* m6-key is a small colored square used as a legend key */
      .sec-5-5 .m6-key.proc { background: var(--proc-bg); border-color: var(--proc); } /* legend key colored like the processor */
      .sec-5-5 .m6-key.accent { background: var(--accent-bg); border-color: var(--accent); } /* legend key in the accent color */
      .sec-5-5 .m6-key.bad { background: var(--bad-bg); border-color: var(--bad); } /* legend key in the bad (red) color */
      .sec-5-5 .m6-key.panel { background: var(--panel-2); border-color: var(--line-2); } /* legend key in the neutral panel color */
      .sec-5-5 .m5-widewrap { width: 100%; } /* the wrapper around a sideways-scrolling diagram takes the full width */
      .sec-5-5 .m5-wide { width: 100%; overflow-x: auto; overflow-y: hidden; contain: inline-size; -webkit-overflow-scrolling: touch; } /* the scrolling box itself: scrolls sideways (with smooth touch scrolling) but never makes the page wider */
      .sec-5-5 .m5-req.focus { border-color: var(--chc); background: color-mix(in srgb, var(--chc) 8%, var(--panel)); } /* the requester card that is acting in the current frame gets a chapter-colored border and tint */
    `,  // end of the section's CSS text

    steps: [  // steps: the pages of this section, in order
      /* ---------------- 1. Big picture: why monitors ---------------- */
      {  // opens step 1
        title: 'Why monitors? Semaphores leave too much to chance',  // step 1 title: why monitors, since semaphores leave too much to chance
        kind: 'story',  // kind 'story': the big-picture page
        render(el, ctx) {  // render() for step 1: builds the text and the "where does the sync code live" drawing
          const { h, s } = ctx;  // h builds HTML elements and s builds SVG elements
          const left = ctx.frag(`${/* left is the explanation column, built from an HTML snippet */''}
            <div class="stack">${/* the column's container */''}
              <p class="lead m0">A <span class="t">semaphore</span> can solve any synchronization problem, but it trusts every process to call <code>semWait</code> and <code>semSignal</code> in exactly the right places.</p>${/* opening paragraph: semaphores work, but only if every process calls them in exactly the right places */''}
              <p class="m0">Those calls end up scattered across many processes. Swap two, or forget one, and the program can <span class="t">deadlock</span> or corrupt data, often only on rare, unlucky timings. Finding the bug means reading every process that touches the shared data.</p>${/* paragraph: scattered calls mean one mistake can deadlock or corrupt data, and finding it means reading every process */''}
              <p class="m0">A <span class="t">monitor</span> moves the job into the programming language. The shared data and every procedure allowed to touch it live in one module, and the language itself guarantees <span class="t">mutual exclusion</span>: one process inside at a time. It is as powerful as semaphores, and far easier to keep under control.</p>${/* paragraph: a monitor moves the job into the language, with one module and built-in mutual exclusion */''}
              <div class="callout analogy m0" data-label="Analogy">A records office with one service window. The files stay behind the counter, you may only ask for the services on the list, the clerk serves one visitor at a time, and everyone else lines up at the door.</div>${/* analogy box: a records office with one service window and a line at the door */''}
            </div>`);  // closes the column container and the snippet
          const svg = s('svg', { viewBox: '0 0 600 330', width: '100%', role: 'img', 'aria-label': 'Where the synchronization code lives' });  // the comparison drawing: four processes around the shared data
          const cap = h('p', { class: 'small m0' });  // cap is the caption under the drawing
          let view = 'sem', bug = false;  // view is 'sem' or 'mon' (which version is shown); bug says whether the typical bug is injected
          const bugBtn = h('button', { class: 'btn sm', type: 'button', onclick: () => { bug = !bug; draw(); } });  // button that injects or removes a typical semaphore bug, then redraws
          const seg = ctx.ui.seg([{ value: 'sem', label: 'With semaphores' }, { value: 'mon', label: 'With a monitor' }], view, (v) => { view = v; draw(); });  // buttons to switch between the semaphore and monitor versions
          const T = (x, y, str, a) => s('text', Object.assign({ x, y, 'font-size': 13 }, a || {}), str);  // T(x, y, str, a): shortcut for an SVG text label
          const procs = [  // procs: the four processes drawn in the corners, two producers and two consumers
            { x: 10, y: 8, name: 'Producer A', P: true }, { x: 10, y: 186, name: 'Producer B', P: true },  // the two producers on the left
            { x: 410, y: 8, name: 'Consumer A', P: false }, { x: 410, y: 186, name: 'Consumer B', P: false },  // the two consumers on the right
          ];  // closes procs
          function draw() {  // draw(): redraws the comparison for the current view and bug setting
            const mon = view === 'mon';  // mon is true for the monitor version
            const kids = [];  // kids collects the SVG pieces
            procs.forEach((p, k) => {  // draws each process box with its code lines
              let lines;  // lines will hold the code shown in this process's box
              if (mon) lines = p.P ? ['produce(x);', 'append(x);'] : ['take(x);', 'consume(x);'];  // monitor version: just produce and append, or take and consume, with no sync calls
              else lines = p.P ? ['produce(x);', 'semWait(e);', 'semWait(s);', 'append(x);', 'semSignal(s);', 'semSignal(n);'] : ['semWait(n);', 'semWait(s);', 'take(x);', 'semSignal(s);', 'semSignal(e);', 'consume(x);'];  // semaphore version: the classic six lines, four of them semaphore calls
              const swapped = !mon && bug && k === 3;  // swapped is true for Consumer B when the bug is injected
              if (swapped) lines = ['semWait(s);', 'semWait(n);'].concat(lines.slice(2));  // the bug: Consumer B's first two waits are swapped, so it takes s before checking n
              kids.push(s('rect', { x: p.x, y: p.y, width: 180, height: 136, rx: 12, class: swapped ? 's-bad' : 's-proc', 'stroke-width': 2 }));  // the process box, red when it holds the bug
              kids.push(T(p.x + 12, p.y + 20, p.name, { 'font-weight': 800 }));  // the process name
              lines.forEach((ln, j) => {  // draws each code line
                const sync = /^sem/.test(ln);  // sync is true for semaphore calls
                const style = swapped && j < 2 ? 'fill:var(--bad)' : sync ? 'fill:var(--warn)' : '';  // swapped lines are red, other sync calls are in the warning color, and plain code is normal
                kids.push(T(p.x + 14, p.y + 42 + j * 16, ln, { class: 's-monot', 'font-weight': sync ? 800 : 400, style }));  // the code line in fixed-width type, bold if it is a sync call
              });  // ends the line loop
              if (mon) kids.push(T(p.x + 14, p.y + 104, 'no synchronization', { class: 's-sub' }), T(p.x + 14, p.y + 120, 'code in here', { class: 's-sub' }));  // in the monitor version, a note that the process has no synchronization code
            });  // ends the process loop
            const ends = [[190, 76], [190, 254], [410, 76], [410, 254]];  // ends lists the points on the process boxes where the connecting arrows start
            if (mon) {  // monitor version: draws the monitor in the middle
              kids.push(s('rect', { x: 215, y: 58, width: 170, height: 214, rx: 14, class: 's-accent', 'stroke-width': 2.5 }),  // the monitor's outline
                T(300, 82, 'monitor', { 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 15 }),  // its name
                s('rect', { x: 232, y: 94, width: 136, height: 38, rx: 8, class: 's-mem', 'stroke-width': 1.5 }),  // the data box inside it
                T(300, 118, 'buffer + count', { 'text-anchor': 'middle', 'font-weight': 700 }),  // label: the buffer and count live inside
                T(300, 158, 'append()   take()', { 'text-anchor': 'middle', class: 's-monot', 'font-weight': 700, style: 'fill:var(--cpu)' }),  // the procedures append() and take()
                T(300, 184, 'cwait / csignal', { 'text-anchor': 'middle', class: 's-monot', 'font-weight': 700, style: 'fill:var(--os)' }),  // the waiting tools cwait and csignal
                T(300, 222, 'one process', { 'text-anchor': 'middle', class: 's-sub' }), T(300, 238, 'inside at a time', { 'text-anchor': 'middle', class: 's-sub' }),  // note: one process inside at a time (two lines)
                T(300, 30, '0 sync calls in the processes', { 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 14, style: 'fill:var(--ok)' }),  // headline at the top: zero sync calls in the processes
                T(300, 312, 'All of it lives in 1 module', { 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 14 }));  // footline at the bottom: all of it lives in one module
              ends.forEach(([x, y]) => kids.push(s('line', { x1: x, y1: y, x2: x < 300 ? 213 : 387, y2: y < 150 ? 130 : 200, class: 's-line', 'marker-end': 'url(#arr)' })));  // arrows from each process to the monitor
            } else {  // semaphore version: draws the shared buffer in the middle
              kids.push(s('rect', { x: 225, y: 118, width: 150, height: 78, rx: 12, class: 's-mem', 'stroke-width': 2 }),  // the shared buffer box
                T(300, 150, 'shared buffer', { 'text-anchor': 'middle', 'font-weight': 800 }),  // its label
                T(300, 172, 'semaphores s, n, e', { 'text-anchor': 'middle', class: 's-sub' }),  // the three semaphores that guard it
                T(300, 30, '16 sync calls in 4 places', { 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 14, style: 'fill:var(--warn)' }),  // headline: 16 sync calls in 4 places
                T(300, 312, bug ? 'Now it can deadlock' : 'Every one must be right', { 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 14, style: bug ? 'fill:var(--bad)' : '' }));  // footline: every one must be right, or, with the bug, "now it can deadlock" in red
              ends.forEach(([x, y]) => kids.push(s('line', { x1: x, y1: y, x2: x < 300 ? 223 : 377, y2: y < 150 ? 140 : 176, class: 's-line', 'marker-end': 'url(#arr)' })));  // arrows from each process to the shared buffer
            }  // ends the choice of version
            svg.replaceChildren(...kids);  // replaces the whole drawing
            bugBtn.textContent = bug ? 'Undo the bug' : 'Inject a typical bug';  // the bug button's text flips between inject and undo
            bugBtn.classList.toggle('danger', !bug);  // it is red (danger) while offering to inject the bug
            if (mon) cap.innerHTML = bug  // monitor caption, which depends on whether the bug button was pressed
              ? '<b>Nothing to break here.</b> The callers contain no synchronization calls to misplace. The monitor’s code is written and checked once, in one place, and every caller is safe.'  // caption with the bug button pressed: there are no sync calls in the callers to misplace, so nothing breaks
              : '<b>Monitor version.</b> Processes just call <code>append</code> and <code>take</code>. Taking turns and waiting are handled inside the monitor, so there is one place to write, read and verify the synchronization.';  // normal caption: processes just call append and take, and the waiting is handled inside the monitor
            else cap.innerHTML = bug  // semaphore caption, which also depends on the bug setting
              ? '<b>One swapped pair in Consumer B.</b> It now grabs <code>s</code> before checking <code>n</code>. If the buffer is empty it sleeps on <code>n</code> while holding <code>s</code>, so no producer can get in to add an item: deadlock. Nothing in the other three processes hints at the mistake.'  // caption with the bug: Consumer B sleeps on n while holding s, so no producer can add an item: deadlock
              : '<b>Semaphore version.</b> <code>s</code> guards the buffer, <code>n</code> counts items, <code>e</code> counts empty slots. Each process carries 4 of these calls (highlighted), 16 in all, and the program is correct only if every one is present and in the right order.';  // caption without the bug: what s, n and e do, and why all 16 calls must be present and in order
          }  // ends draw()
          draw();  // draws the semaphore version once when the page loads
          el.append(h('div', { class: 'split l fill' }, left, h('div', { class: 'card white stack' }, h('div', { class: 'row' }, seg, bugBtn), wide(ctx, svg, 560), cap,  // page layout: text on the left; on the right a card with the buttons, the drawing (scrollable on phones) and caption
            ctx.frag('<div class="row gap-s"><span class="xs b muted">BUILT INTO</span><span class="chip os">Concurrent Pascal</span><span class="chip os">Pascal-Plus</span><span class="chip os">Modula-2</span><span class="chip os">Modula-3</span><span class="chip os">Java</span></div>'))));  // a row of chips naming languages that have monitors built in; closes the layout
        },  // ends render() for step 1
      },  // ends step 1
      /* ---------------- 2. Anatomy: clickable monitor diagram ---------------- */
      {  // opens step 2
        title: 'Inside a monitor: data, procedures and queues',  // step 2 title: the parts inside a monitor
        kind: 'explore',  // kind 'explore': a page for clicking around a model
        render(el, ctx) {  // render() for step 2: builds the clickable monitor diagram when the page opens
          const { h, s } = ctx;  // h for HTML elements and s for SVG elements
          const svg = s('svg', { viewBox: '0 0 640 480', width: '100%', role: 'img', 'aria-label': 'The parts of a monitor' });  // the diagram: 640 by 480 units, scaled to fit
          const T = (x, y, str, a) => s('text', Object.assign({ x, y, 'font-size': 13 }, a || {}), str);  // T(x, y, str, a): shortcut for a text label
          const R = (x, y, w, ht, cls, a) => s('rect', Object.assign({ x, y, width: w, height: ht, rx: 10, class: cls, 'stroke-width': 1.5 }, a || {}));  // R(x, y, w, ht, cls, a): shortcut for a rounded rectangle with a color class
          const chip = (x, y, id) => s('g', { transform: `translate(${x},${y})`, class: 'm5-chip m5-P' }, s('rect', { width: 60, height: 30, rx: 8 }), s('text', { x: 30, y: 20, 'text-anchor': 'middle' }, id));  // chip(x, y, id): draws a fixed process chip, such as P1, at a spot in the diagram
          const B = { 'font-weight': 700 };  // B holds the bold-text setting reused by many labels
          svg.append(  // adds the fixed parts of the diagram
            R(150, 8, 370, 464, 's-panel', { rx: 18, 'stroke-width': 2.5 }),  // the monitor's outer wall
            s('rect', { x: 144, y: 226, width: 12, height: 36, class: 'm5-door' }),  // a gap in the left wall: the door
            T(166, 32, 'monitor', { 'font-weight': 800, 'font-size': 15 }),  // the monitor's name
            T(72, 190, 'entrance', Object.assign({ 'text-anchor': 'middle' }, B)), T(72, 206, 'queue', Object.assign({ 'text-anchor': 'middle' }, B)),  // the entrance queue label (two lines)
            chip(42, 229, 'P5'), chip(42, 267, 'P6'),  // two processes, P5 and P6, waiting in the entrance queue
            s('line', { x1: 104, y1: 244, x2: 146, y2: 244, class: 's-line', 'marker-end': 'url(#arr)' }),  // an arrow from the queue to the door
            R(168, 44, 334, 64, 's-mem'), T(180, 68, 'local data', B), T(180, 90, 'shared variables, private to the monitor', { class: 's-sub' }),  // the local data room: shared variables private to the monitor
            R(168, 118, 334, 42, 's-os'), T(180, 144, 'condition c1', B), T(290, 144, 'cwait(c1)', { class: 's-monot s-sub' }), chip(430, 124, 'P2'),  // condition queue c1, with its cwait call and process P2 waiting in it
            T(335, 177, '⋮', { 'text-anchor': 'middle', 'font-size': 16, class: 's-sub' }),  // a vertical ellipsis showing there can be more condition queues
            R(168, 182, 334, 42, 's-os'), T(180, 208, 'condition cn', B), T(290, 208, 'cwait(cn)', { class: 's-monot s-sub' }), chip(430, 188, 'P3'),  // condition queue cn, with process P3 waiting in it
            R(168, 236, 334, 118, 's-cpu'), T(180, 256, 'procedures: the only way in', B),  // the procedures room: the only way in
            R(180, 266, 100, 30, 's-panel', { rx: 7 }), T(230, 286, 'procedure 1', { 'text-anchor': 'middle' }),  // box for procedure 1
            R(288, 266, 100, 30, 's-panel', { rx: 7 }), T(338, 286, 'procedure 2', { 'text-anchor': 'middle' }),  // box for procedure 2
            R(396, 266, 94, 30, 's-panel', { rx: 7 }), T(443, 286, '… proc k', { 'text-anchor': 'middle' }),  // box standing for the remaining procedures up to k
            chip(180, 310, 'P1'), T(252, 330, 'P1 is running (only one inside)', { class: 's-sub' }),  // process P1 running inside a procedure, with a note that only one process is inside
            R(168, 366, 334, 40, 's-panel'), T(180, 391, 'initialization code', B), T(320, 391, 'runs once, at creation', { class: 's-sub' }),  // the initialization code box, which runs once when the monitor is created
            R(168, 418, 334, 44, 's-warn'), T(180, 445, 'urgent queue', B), T(280, 445, 'signalers wait', { class: 's-sub' }), chip(430, 425, 'P4'),  // the urgent queue, where signalers wait, with process P4 in it
            s('line', { x1: 522, y1: 295, x2: 610, y2: 295, class: 's-line', 'marker-end': 'url(#arr)' }), T(566, 284, 'exit', Object.assign({ 'text-anchor': 'middle' }, B)),  // an exit arrow on the right side of the monitor
          );  // ends the list of fixed parts
          const parts = [  // parts: the clickable areas; r is the rectangle, rule lists the rules it enforces, t the title, d the explanation
            { r: [18, 172, 116, 134], rule: [2], t: 'Entrance queue', d: 'Processes that called a monitor procedure while another process was already inside. They are blocked here, in arrival order, until the monitor is free. This line is how rule 3 is enforced.' },  // part: the entrance queue, which enforces rule 3 (one at a time)
            { r: [162, 40, 346, 72], rule: [0], t: 'Local data', d: 'The shared variables the monitor protects, for example a buffer, its indexes and an item count. Outside code cannot even name them, so the only way to touch them is through a procedure, and therefore always under the monitor’s mutual exclusion.' },  // part: the local data, which enforces rule 1 (private data)
            { r: [162, 114, 346, 114], rule: [], t: 'Condition queues', d: 'Each <span class="t">condition variable</span> has its own <span class="t">condition queue</span>. A process that cannot go on (say, the buffer is empty) calls <code>cwait(c1)</code>: it joins that queue and gives up the monitor so another process can enter. A later <code>csignal(c1)</code> resumes one of them. Waiting here does not count as being inside.' },  // part: the condition queues, where cwait parks a process until a csignal
            { r: [162, 232, 346, 126], rule: [1, 2], t: 'Procedures', d: 'The monitor’s public entry points, such as <code>append</code> and <code>take</code>. Calling one is the only way in (rule 2). P1 is executing one right now, so it is the only process inside (rule 3); every other process is waiting in some queue.' },  // part: the procedures, which enforce rules 2 and 3
            { r: [162, 362, 346, 48], rule: [0], t: 'Initialization code', d: 'Code that runs once, when the monitor is created, to put the local data into a correct starting state: for example <code>count = 0</code> and both buffer indexes at slot 0.' },  // part: the initialization code that sets the starting state
            { r: [162, 414, 346, 54], rule: [], t: 'Urgent queue', d: 'Used by the original (Hoare) monitor. When a process calls <code>csignal</code> and someone is waiting, the woken process must run next, so a signaler that still has work to do steps aside into the <span class="t">urgent queue</span>. (If <code>csignal</code> was its last statement it can simply leave.) When the monitor frees up, processes here get back in before anyone from the entrance queue.' },  // part: the urgent queue of the original (Hoare) monitor, where a signaler steps aside
            { r: [524, 262, 104, 64], rule: [], t: 'Exit', d: 'A process leaves when its procedure returns. The monitor is then free and the next process is admitted: first from the urgent queue, otherwise from the <span class="t">entrance queue</span>.' },  // part: the exit, after which the urgent queue, then the entrance queue, gets the monitor
          ];  // closes parts
          const rules = [  // rules: the three rules that define a monitor, as [name, explanation]
            ['Private data', 'Its local data can be read or changed only by the monitor’s own procedures, never directly by outside code.'],  // rule 1: private data
            ['One way in', 'A process enters the monitor only by calling one of its procedures.'],  // rule 2: one way in, through a procedure
            ['One at a time', 'Only one process may be executing inside the monitor at any moment. Other callers wait.'],  // rule 3: one process inside at a time
          ];  // closes rules
          const ruleEls = rules.map(([a, b], i) => h('div', { class: 'card tight m5-rule small', html: `<b>${i + 1} · ${a}.</b> ${b}` }));  // ruleEls: one small card per rule, numbered, shown on the right
          const info = h('div', { class: 'card m5-info grow' });  // info is the card that explains whichever part was clicked
          const hots = parts.map((p, i) => s('rect', { x: p.r[0], y: p.r[1], width: p.r[2], height: p.r[3], rx: 12, class: 'hot', onclick: () => pick(i), onpointerdown: () => pick(i) }));  // hots: an invisible click target over each part; clicking or touching it picks that part
          svg.append(...hots);  // adds the click targets on top of the diagram
          function pick(i) {  // pick(i): runs when the student clicks part i
            hots.forEach((x, j) => x.classList.toggle('on', i === j));  // outlines the clicked target and clears the others
            const p = parts[i];  // p is the chosen part
            ruleEls.forEach((r, j) => r.classList.toggle('on', p.rule.includes(j)));  // lights up the rule cards that this part enforces
            info.innerHTML = `<h4>${p.t}</h4><p class="m0">${p.d}</p>`;  // shows the part's title and explanation in the info card
          }  // ends pick()
          info.innerHTML = '<h4>Explore</h4><p class="m0">Click any part of the building on the left. Its job appears here, and the rule it enforces lights up above.</p><div class="callout why m0 mt small" data-label="Why it matters">Rule 3 gives you <span class="t">mutual exclusion</span> for free: no process ever writes a lock call around the shared data.</div>';  // starting text for the info card: click any part, plus a note that rule 3 gives mutual exclusion for free
          el.append(h('div', { class: 'split r fill' },  // page layout: a split with the diagram on the wider left side
            h('div', { class: 'card white', style: { display: 'grid', placeItems: 'center', padding: '6px 10px' } }, wide(ctx, svg, 560)),  // the diagram on a white card (scrollable sideways on phones)
            h('div', { class: 'stack' },  // the right column
              h('p', { class: 'lead m0', html: 'A <span class="t">monitor</span> is a software module with three kinds of content, local data, procedures and start-up code, plus a few waiting lines. Three rules define it:' }),  // opening paragraph: a monitor has local data, procedures and start-up code, plus waiting lines, and three rules
              ...ruleEls, info)));  // the three rule cards and the info card
        },  // ends render() for step 2
      },  // ends step 2
      /* ---------------- 3. cwait / csignal vs semWait / semSignal: the lost signal ---------------- */
      {  // opens step 3
        title: 'cwait, csignal and the signal nobody hears',  // step 3 title: cwait and csignal, and the signal nobody hears
        kind: 'compare',  // kind 'compare': a side-by-side comparison page
        render(el, ctx) {  // render() for step 3: builds the monitor-versus-semaphore comparison
          const { h } = ctx;  // only HTML elements are needed
          function side(title, ops) {  // side(title, ops): builds one of the two comparison cards and returns its parts
            const wait = h('div', { class: 'row gap-s m5-q' });  // wait shows the processes waiting
            const mem = h('div', { class: 'row gap-s' });  // mem shows what is remembered (nothing for a condition, the count for a semaphore)
            const run = h('div', { class: 'row gap-s m5-q' });  // run shows the processes that were allowed to continue
            const log = h('div', { class: 'log m5-log' });  // log lists what happened on this side
            const card = h('div', { class: 'card white stack gap-s' },  // the card: a heading row with the title and the operation names, then three labeled rows and the log
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { class: 'm0', html: title }), h('span', { class: 'small mono muted' }, ops)),  // the heading row
              h('div', { class: 'm5-row' }, h('span', { class: 'xs b muted' }, 'WAITING'), wait),  // row labeled WAITING
              h('div', { class: 'm5-row' }, h('span', { class: 'xs b muted' }, 'MEMORY'), mem),  // row labeled MEMORY
              h('div', { class: 'm5-row' }, h('span', { class: 'xs b muted' }, 'RUNNING'), run),  // row labeled RUNNING
              log);  // the log closes the card
            return { card, wait, mem, run, log };  // hands back the card and its updatable parts
          }  // ends side()
          const L = side('Monitor: condition <code>c</code>', 'cwait(c) · csignal(c)');  // L is the monitor side, with condition c
          const R = side('Semaphore <code>s</code> (starts at 0)', 'semWait(s) · semSignal(s)');  // R is the semaphore side, with semaphore s starting at 0
          const say = h('div', { class: 'card' });  // say is the card under both sides that explains the last action
          let mon, sem, n, lostFlash, gen = 0;   // gen: bumped to cancel a replay step still waiting to run
          function reset() {  // reset(): empties both worlds and the logs
            gen++;  // bumps the replay counter so any replay step still waiting is cancelled
            mon = { q: [], run: [] }; sem = { count: 0, q: [], run: [] }; n = 0; lostFlash = false;  // empty queues on both sides, the semaphore count back at 0, and the process counter at 0
            L.log.innerHTML = ''; R.log.innerHTML = '';  // clears both logs
            say.innerHTML = '<b>Ready.</b> Each button does the same thing to both worlds at once. Press <b>Someone signals</b> while nobody is waiting, then <b>A process waits</b>, and compare.';  // starting instruction: signal while nobody waits, then make a process wait, and compare
            paint();  // draws the empty state
          }  // ends reset()
          const chips = (arr, cls) => (arr.length ? arr.slice(-5).map((id) => h('span', { class: 'chip ' + cls }, id)) : [h('span', { class: 'xs muted' }, 'none')]);  // chips(arr, cls): turns a list of process ids into chips (the last 5 at most), or "none"
          function paint() {  // paint(): copies both worlds onto the screen
            L.wait.replaceChildren(...chips(mon.q, 'proc'));  // monitor side: the processes waiting on c
            R.wait.replaceChildren(...chips(sem.q, 'proc'));  // semaphore side: the processes blocked on s
            L.run.replaceChildren(...chips(mon.run, 'ok'));  // monitor side: the processes that continued
            R.run.replaceChildren(...chips(sem.run, 'ok'));  // semaphore side: the processes that continued
            L.mem.replaceChildren(...[h('span', { class: 'b' }, 'none'), h('span', { class: 'xs muted' }, 'a condition stores nothing'),  // monitor side memory row: "none", a note that a condition stores nothing,
              lostFlash ? h('span', { class: 'chip bad flash' }, 'signal lost!') : null].filter(Boolean));  // plus a flashing "signal lost!" chip right after a signal found nobody waiting
            R.mem.replaceChildren(...[h('span', { class: 'b mono', style: { fontSize: '20px' } }, 'count = ' + sem.count),  // semaphore side memory row: the count in large type,
              sem.count > 0 ? h('span', { class: 'chip ok' }, sem.count + ' signal' + (sem.count > 1 ? 's' : '') + ' saved') : null,  // plus a chip saying how many signals are saved when the count is positive
              sem.count < 0 ? h('span', { class: 'xs muted' }, 'negative: ' + -sem.count + ' blocked') : null].filter(Boolean));  // or, when negative, a note that its size is the number of blocked processes
            btnW.disabled = n >= 6;  // the wait button stops working after 6 waiters so the rows do not overflow
          }  // ends paint()
          const log = (side, html) => { side.log.append(h('div', { html })); side.log.scrollTop = side.log.scrollHeight; };  // log(side, html): adds a line to one side's log and scrolls it to the newest line
          function doWait() {  // doWait(): a new process waits in both worlds at once; runs when "A process waits" is pressed
            if (n >= 6) return;  // no more than 6 waiters in total
            const id = 'W' + (++n);  // gives the new process an id: W1, W2 and so on
            lostFlash = false;  // a new action clears the lost-signal flash
            mon.q.push(id);  // monitor world: cwait always suspends, so the process joins the queue on c
            log(L, `${id}: cwait(c) → suspended (always)`);  // logs it on the monitor side
            const before = sem.count;  // before remembers the semaphore count so the message can mention saved signals
            sem.count--;  // semaphore world: semWait decrements the count
            let passed = false;  // passed will say whether the process got through without blocking
            if (sem.count < 0) { sem.q.push(id); log(R, `${id}: semWait(s) → s = ${sem.count}, blocked`); }  // if the count went negative, the process blocks in the semaphore's queue
            else { passed = true; sem.run.push(id); log(R, `${id}: semWait(s) → s = ${sem.count}, passes`); }  // otherwise a saved signal was used up and the process passes straight through
            say.innerHTML = passed  // the explanation depends on whether the semaphore let it pass
              ? `<b>${id}</b> waits in both worlds. The monitor suspends it: <span class="t">cwait</span> <b>always</b> blocks, and the earlier signal left no trace. The semaphore had ${before} saved signal${before > 1 ? 's' : ''}, so ${id} walks straight through.`  // message when it passed: the monitor suspended it anyway, since the earlier signal left no trace there
              : `<b>${id}</b> waits in both worlds and is suspended in both: no signal is saved anywhere. Now press <b>Someone signals</b>.`;  // message when blocked in both: no signal is saved anywhere, so now press "Someone signals"
            paint();  // redraws both sides
          }  // ends doWait()
          function doSignal() {  // doSignal(): a signal is sent in both worlds at once; runs when "Someone signals" is pressed
            let mRes, sRes;  // mRes and sRes will name the process each world woke, or null if none
            if (mon.q.length) { mRes = mon.q.shift(); mon.run.push(mRes); log(L, `csignal(c) → resumes ${mRes}`); lostFlash = false; }  // monitor world: if someone waits on c, the first one resumes
            else { mRes = null; log(L, 'csignal(c) → nobody waiting: lost'); lostFlash = true; }  // if nobody waits, the signal is simply lost; the flash shows it
            sem.count++;  // semaphore world: semSignal increments the count
            if (sem.count <= 0) { sRes = sem.q.shift(); sem.run.push(sRes); log(R, `semSignal(s) → s = ${sem.count}, wakes ${sRes}`); }  // a count still at or below 0 means someone was blocked, so the first one wakes
            else { sRes = null; log(R, `semSignal(s) → s = ${sem.count}, saved`); }  // otherwise the signal is saved in the count
            if (mRes && sRes) say.innerHTML = `Someone was waiting, so both worlds wake a process (<b>${mRes}</b> / <b>${sRes}</b>). When a waiter exists, <span class="t">csignal</span> and semSignal behave alike.`;  // both woke someone: with a waiter present, csignal and semSignal behave alike
            else if (!mRes) say.innerHTML = `A signal with <b>nobody waiting</b>. The monitor keeps no record, so it is a <span class="t" data-t="Lost signal">lost signal</span>. The semaphore saves it by raising its count to ${sem.count}; a later semWait will pass without blocking.`;  // the monitor woke nobody: a lost signal, while the semaphore saved it in its count
            else say.innerHTML = `The monitor wakes <b>${mRes}</b>, still suspended on c. In the semaphore world ${mRes} never blocked, so this signal is saved instead (count ${sem.count}).`;  // the monitor woke a process that the semaphore never blocked, so the semaphore saves this signal instead
            paint();  // redraws both sides
          }  // ends doSignal()
          // a manual press takes over from a replay in progress, so its pending step is cancelled
          const btnW = h('button', { class: 'btn proc', type: 'button', onclick: () => { gen++; doWait(); } }, 'A process waits');  // the "A process waits" button; pressing it also cancels a pending replay step
          const btnS = h('button', { class: 'btn intr', type: 'button', onclick: () => { gen++; doSignal(); } }, 'Someone signals');  // the "Someone signals" button, which also cancels a pending replay step
          const demo = h('button', { class: 'btn sm', type: 'button', onclick: () => { reset(); doSignal(); const g = gen; ctx.after(900, () => { if (g === gen) doWait(); }); } }, 'Replay: signal, then wait');  // replay button: resets, signals, and 0.9 s later makes a process wait (unless something else happened meanwhile)
          reset();  // draws the empty starting state when the page loads
          el.append(h('div', { class: 'stack fill' },  // page layout: one column that fills the page
            h('p', { class: 'm0', html: 'A <span class="t">condition variable</span> is a named waiting line inside the monitor. <code>cwait(c)</code> suspends the caller on <code>c</code> <b>and releases the monitor</b> so another process may enter; <code>csignal(c)</code> resumes one process waiting on <code>c</code>. How does that differ from a semaphore?' }),  // intro paragraph: a condition variable is a named waiting line; cwait also releases the monitor
            h('div', { class: 'grid-2' }, L.card, R.card),  // the two comparison cards side by side
            h('div', { class: 'row' }, btnW, btnS, h('button', { class: 'btn sm', type: 'button', onclick: reset }, 'Reset'), demo),  // the button row: wait, signal, reset and replay
            h('div', { class: 'grid-2 grow' }, say,  // bottom row: the explanation card, which grows to fill the space
              h('div', { class: 'callout warn m0', 'data-label': 'Common mistake', html: 'Treating <code>cwait</code> as a test. It has no value to check: it <b>always</b> suspends. So monitor code checks its own data first:<br><code>if (count == 0) cwait(notempty);</code>' }))));  // common-mistake box: cwait is not a test, so monitor code checks its own data first
        },  // ends render() for step 3
      },  // ends step 3
      /* ---------------- 4. Code tour: the bounded-buffer monitor ---------------- */
      {  // opens step 4
        title: 'The bounded buffer, written as a monitor',  // step 4 title: the bounded buffer written as a monitor
        kind: 'learn',  // kind 'learn': a guided reading page
        render(el, ctx) {  // render() for step 4: builds the two-tab code tour
          const { h } = ctx;  // only HTML elements are needed
          const MON = `${/* MON: the full bounded-buffer monitor shown in the first tab (the leading line break is trimmed by the code box) */''}
monitor boundedbuffer;                   // one module: data + code${/* shown code, line 1: declares the monitor, one module of data and code */''}
char buffer[N];                          // N slots of shared storage${/* shown code, line 2: the buffer of N slots */''}
int nextin, nextout;                     // next slot to fill / empty${/* shown code, line 3: the next slot to fill and the next slot to empty */''}
int count;                               // how many slots are full${/* shown code, line 4: how many slots are full */''}
cond notfull, notempty;                  // two waiting lines${/* shown code, line 5: the two condition variables */''}

void append(char x) {                    // producers call this${/* shown code, line 7: append(), called by producers */''}
  if (count == N) cwait(notfull);        // full: sleep until space${/* shown code, line 8: if full, wait on notfull */''}
  buffer[nextin] = x;                    // put item in its slot${/* shown code, line 9: store the item in slot nextin */''}
  nextin = (nextin + 1) % N;             // move on, wrap to 0${/* shown code, line 10: advance nextin, wrapping to 0 */''}
  count++;                               // one more full slot${/* shown code, line 11: one more full slot */''}
  csignal(notempty);                     // wake a waiting consumer${/* shown code, line 12: wake a waiting consumer */''}
}                                        // return: leave monitor${/* shown code, line 13: return, which leaves the monitor */''}
void take(char &x) {                     // consumers call this${/* shown code, line 14: take(), called by consumers */''}
  if (count == 0) cwait(notempty);       // empty: sleep for an item${/* shown code, line 15: if empty, wait on notempty */''}
  x = buffer[nextout];                   // copy out oldest item${/* shown code, line 16: copy out the oldest item */''}
  nextout = (nextout + 1) % N;           // move on, wrap to 0${/* shown code, line 17: advance nextout, wrapping to 0 */''}
  count--;                               // one fewer full slot${/* shown code, line 18: one fewer full slot */''}
  csignal(notfull);                      // wake a waiting producer${/* shown code, line 19: wake a waiting producer */''}
}                                        // return: leave monitor${/* shown code, line 20: return, which leaves the monitor */''}
{ nextin = 0; nextout = 0; count = 0; }  // runs once: start empty`;  // shown code, line 21: the initialization block that runs once and starts the buffer empty; ends MON
          const PC = `${/* PC: the producer and consumer programs shown in the second tab */''}
void producer() {             // each producer runs this${/* shown code, line 1: the producer procedure */''}
  char x;                     // the item it makes${/* shown code, line 2: the item it makes */''}
  while (true) {              // repeat forever:${/* shown code, line 3: repeat forever */''}
    produce(x);               //   make one (no monitor)${/* shown code, line 4: make an item, outside the monitor */''}
    append(x);                //   deposit via the monitor${/* shown code, line 5: deposit it through the monitor */''}
  }                           // end of loop${/* shown code, line 6: end of the loop */''}
}                             // end of producer${/* shown code, line 7: end of producer */''}
void consumer() {             // each consumer runs this${/* shown code, line 8: the consumer procedure */''}
  char x;                     // the item it receives${/* shown code, line 9: the item it receives */''}
  while (true) {              // repeat forever:${/* shown code, line 10: repeat forever */''}
    take(x);                  //   fetch via the monitor${/* shown code, line 11: fetch an item through the monitor */''}
    consume(x);               //   use it (no monitor)${/* shown code, line 12: use it, outside the monitor */''}
  }                           // end of loop${/* shown code, line 13: end of the loop */''}
}                             // end of consumer`;  // shown code, line 14: end of consumer; ends PC
          const tours = {  // tours: the guided stops for each tab; l lists the code lines to highlight, t is a heading, d the explanation
            mon: [  // stops for the monitor listing
              { l: [1], t: 'Declare the monitor', d: 'Everything down to the final block belongs to one module. Code outside can see only the procedure names <code>append</code> and <code>take</code>, nothing else.' },  // stop: the monitor declaration; outside code sees only the procedure names
              { l: [2, 3, 4], t: 'The local data', d: 'A <span class="t">bounded buffer</span> of N slots used as a ring. <code>nextin</code> is where the next item goes, <code>nextout</code> where the next item comes from, and <code>count</code> says how many slots are full. None of it is visible outside.' },  // stop: the local data, a ring of N slots with its two indexes and count
              { l: [5], t: 'Two condition variables', d: '<code>notfull</code> is where producers wait when there is no space; <code>notempty</code> is where consumers wait when there is nothing to take. They are waiting lines, not numbers.' },  // stop: the two condition variables, which are waiting lines, not numbers
              { l: [7], t: 'A producer enters', d: 'Calling <code>append(x)</code> is the only way in. If another process is already inside, the caller waits in the entrance queue first. That mutual exclusion is automatic: there is no <code>semWait</code> on a lock anywhere.' },  // stop: a producer enters by calling append; mutual exclusion is automatic
              { l: [8], t: 'Full? Then wait', d: 'With all N slots full the producer cannot go on, so it calls <code>cwait(notfull)</code>: it is suspended on <code>notfull</code> and the monitor is released, letting a consumer in to make space. The test is on the monitor’s own <code>count</code>; <code>cwait</code> tests nothing.' },  // stop: if the buffer is full, cwait(notfull) suspends the producer and releases the monitor
              { l: [9, 10], t: 'Store, then advance', d: 'The item goes into slot <code>nextin</code>, then <code>nextin</code> moves on. The <code>% N</code> wraps it from N−1 back to 0, so with N = 3 the slots are used 0, 1, 2, 0, 1, …' },  // stop: store the item, then advance nextin with wrap-around
              { l: [11, 12], t: 'Count up, then signal', d: 'There is now at least one item, so <code>csignal(notempty)</code> resumes one consumer that was waiting for one; under Hoare rules it is the very next process to run inside. If no consumer waits, the signal is simply lost, and that is harmless: a later consumer will see <code>count &gt; 0</code> and never wait.' },  // stop: count up, then csignal(notempty); a lost signal here is harmless because a later consumer will not wait
              { l: [13], t: 'Return = leave', d: 'Returning from the procedure leaves the monitor, and the next waiting process may enter.' },  // stop: returning from the procedure leaves the monitor
              { l: [14, 15], t: 'A consumer enters. Empty? Then wait', d: 'The mirror image of <code>append</code>. With <code>count == 0</code> there is nothing to take, so the consumer sleeps on <code>notempty</code> and frees the monitor for a producer.' },  // stop: a consumer enters take(), and sleeps on notempty if the buffer is empty
              { l: [16, 17, 18], t: 'Copy out, advance, count down', d: 'The oldest item is copied from slot <code>nextout</code>, the index moves on (wrapping at N), and <code>count</code> drops by one. Items come out in the order they went in.' },  // stop: copy out the oldest item, advance nextout, count down (first in, first out)
              { l: [19, 20], t: 'Wake a producer, then leave', d: 'A slot just became free, so <code>csignal(notfull)</code> resumes one producer waiting for space, if there is one. Then the consumer returns and leaves.' },  // stop: csignal(notfull) wakes a producer waiting for space, then the consumer leaves
              { l: [21], t: 'Initialization', d: 'Runs once, when the monitor is created: the buffer starts empty with both indexes at slot 0.' },  // stop: the initialization block runs once and starts the buffer empty
            ],  // ends the monitor stops
            pc: [  // stops for the producer and consumer listing
              { l: [1, 2, 3], t: 'A producer’s whole life', d: 'Each producer process runs this loop forever: make an item, deposit it, repeat.' },  // stop: a producer loops forever, making and depositing items
              { l: [4], t: 'produce(x): no monitor needed', d: 'Making an item touches no shared data, so it runs outside the monitor, in parallel with every other process.' },  // stop: produce(x) touches no shared data, so it runs outside the monitor
              { l: [5], t: 'append(x): the only shared step', d: 'All the waiting and turn-taking hides behind this one call. If the buffer is full, the producer sleeps inside <code>append</code> and returns only after its item is stored.' },  // stop: append(x) is the only shared step, and all the waiting hides inside it
              { l: [8, 9, 10], t: 'A consumer’s whole life', d: 'The mirror image: fetch an item, use it, repeat.' },  // stop: a consumer's loop is the mirror image
              { l: [11], t: 'take(x)', d: 'If the buffer is empty the consumer sleeps inside <code>take</code>; otherwise it returns at once with the oldest item.' },  // stop: take(x) sleeps if the buffer is empty, otherwise returns the oldest item at once
              { l: [12], t: 'consume(x): no monitor needed', d: 'Using the item happens outside, so the monitor is free for other producers and consumers meanwhile.' },  // stop: consume(x) happens outside, leaving the monitor free
              { l: [5, 11], t: 'Compare with semaphores', d: 'With semaphores, each loop would also carry four <code>semWait</code>/<code>semSignal</code> calls in a precise order, and one slip in any process could deadlock everything. Here the loops hold no synchronization code at all.' },  // stop: compared with semaphores, the loops here hold no synchronization code at all
            ],  // ends the producer and consumer stops
          };  // closes tours
          const head = h('div', { class: 'xs b muted' });  // head shows which line numbers the current stop is about
          const ttl = h('h3', { class: 'm0' });  // ttl shows the stop's heading
          const body = h('p', { class: 'm0' });  // body shows the stop's explanation
          const count = h('span', { class: 'player-count' });  // count shows "stop 3 / 11" style progress
          const prev = h('button', { class: 'btn sm', type: 'button', onclick: () => show(i - 1) }, '← Previous');  // Previous button: goes back one stop
          const next = h('button', { class: 'btn sm primary', type: 'button', onclick: () => show(i + 1) }, 'Next →');  // Next button: goes forward one stop
          let tour = tours.mon, i = 0, code = null;  // tour is the list of stops for the open tab, i the current stop, code the current listing
          function show(k) {  // show(k): moves the tour to stop k; runs on Previous, Next or a click on a code line
            i = ctx.util.clamp(k, 0, tour.length - 1);  // keeps k within the list, so Previous and Next never run off either end
            const f = tour[i];  // f is the stop to show
            code.clear();  // clears the old highlight in the listing
            code.mark(f.l);  // highlights this stop's lines
            head.textContent = f.l.length > 1 ? 'LINES ' + f.l.join(', ') : 'LINE ' + f.l[0];  // the small heading: "LINE 8" or "LINES 9, 10"
            ttl.textContent = f.t;  // the stop's heading
            body.innerHTML = f.d;  // the stop's explanation
            count.textContent = `${i + 1} / ${tour.length}`;  // the progress counter
            prev.disabled = i === 0;  // Previous is disabled at the first stop
            next.disabled = i === tour.length - 1;  // Next is disabled at the last stop
          }  // ends show()
          function mount(panel, src, key) {  // mount(panel, src, key): fills a tab with its listing and connects that listing to its tour
            code = ctx.ui.code(src, { lang: 'c', fontSize: 13.5 });  // builds the highlighted listing at 13.5px
            panel.append(code);  // puts it in the tab
            tour = tours[key];  // switches the tour to this tab's stops
            code.querySelectorAll('.ln').forEach((ln, j) => {  // goes through the listing's lines
              const f = tour.findIndex((fr) => fr.l.includes(j + 1));  // f is the first stop that covers this line, if any
              if (f >= 0) { ln.classList.add('clickable'); ln.addEventListener('click', () => show(f)); }  // such a line gets a hand pointer and jumps to that stop when clicked
            });  // ends the line loop
            show(0);  // starts the tour at its first stop
          }  // ends mount()
          const tabs = ctx.ui.tabs([  // the two tabs; each fills itself with mount() when opened
            { label: 'The monitor', render: (p) => mount(p, MON, 'mon') },  // tab 1: the monitor listing
            { label: 'Producer &amp; consumer', render: (p) => mount(p, PC, 'pc') },  // tab 2: the producer and consumer listing (&amp; is how HTML writes the ampersand)
          ]);  // closes the tab list
          const predict = ctx.ui.reveal('Predict, then reveal',  // a button that hides the answer to the prediction question until clicked
            '<p class="small m0">It finds <code>count == N</code>, so it calls <code>cwait(notfull)</code>: it is suspended on <code>notfull</code> and the monitor is released. It resumes only after a consumer takes an item and calls <code>csignal(notfull)</code>, and then it continues at the line after its <code>cwait</code>.</p>');  // the answer: the producer sleeps on notfull, frees the monitor, and resumes after its cwait once a consumer signals
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: '660px minmax(0, 1fr)' } },  // page layout: a fixed 660px column for the code tabs and the rest for the explanation
            tabs,  // the tabs on the left
            h('div', { class: 'stack' },  // the right column
              h('div', { class: 'card stack gap-s grow' }, head, ttl, body),  // the explanation card, which grows to fill the space
              h('div', { class: 'row' }, prev, next, count, h('span', { class: 'xs muted' }, 'or click any line')),  // a row with the Previous and Next buttons, the counter and a hint that lines are clickable
              h('div', { class: 'card tight' }, h('p', { class: 'small b m0', html: 'N = 3 and all three slots are full. A producer calls <code>append</code>. What happens to it?' }), predict))));  // a prediction card: the buffer is full and a producer calls append; what happens?
        },  // ends render() for step 4
      },  // ends step 4
      /* ---------------- 5. Lab: drive the bounded-buffer monitor (Hoare rules) ---------------- */
      {  // opens step 5
        title: 'Lab: run the monitor yourself, one line at a time',  // step 5 title: a lab where the student runs the monitor one line at a time
        kind: 'lab',  // a lab page
        core: true,  // on the core path through the guide
        render(el, ctx) {  // render() for step 5: builds the hands-on monitor lab
          const { h } = ctx;  // only HTML elements are needed
          const holder = h('div', { class: 'card white', style: { padding: '4px' } });  // holder is the card that holds the monitor building drawing
          const code = ctx.ui.code(bbSource('hoare'), { lang: 'c', nums: false, fontSize: 13 });  // the listing of the Hoare-style bounded buffer, without line numbers
          const sayEl = h('div', { class: 'card tight small grow' });  // sayEl is the card that explains the last action
          const goals = [  // goals: five situations for the student to produce, as [key, description]
            ['ne', 'A consumer sleeps on notempty'],  // goal: a consumer sleeps on notempty
            ['nf', 'A producer sleeps on notfull'],  // goal: a producer sleeps on notfull
            ['urgent', 'A signaler waits in the urgent queue'],  // goal: a signaler waits in the urgent queue
            ['lost', 'A csignal is lost (nobody waiting)'],  // goal: a csignal is lost because nobody waits
            ['wrap', 'nextin wraps from 2 back to 0'],  // goal: nextin wraps from slot 2 back to 0
          ];  // closes goals
          const goalEls = goals.map(([, t]) => h('div', { class: 'small' }, t));  // one line of text per goal, shown in the checklist
          let stage, st, procs, nP, nC, nItem, ach, auto = null;  // lab state: the drawing, monitor state, process table, producer and consumer counters, next item letter, goals reached, auto-run timer
          const PROC = (id) => (procs[id].kind === 'P' ? 'append' : 'take');  // PROC(id): the name of the procedure this process calls, append for producers or take for consumers
          function fresh() {  // fresh(): starts the lab over with an empty monitor
            stopAuto();  // stops any automatic running
            stage = makeStage(ctx);  // builds a new building drawing
            holder.replaceChildren(wide(ctx, stage.svg, 580));  // puts it in its card (scrollable sideways on phones)
            st = emptyState('hoare');  // an empty Hoare-style monitor state
            procs = {}; nP = 0; nC = 0; nItem = 0; ach = {};  // no processes, counters at zero, no goals reached
            paint('<b>Reminder:</b> <code>cwait(c)</code> sleeps on condition c and lets the next process in; <code>csignal(c)</code> wakes one sleeper on c. <b>Start here.</b> Add a <b>consumer</b> first. The buffer is empty, so run its lines and watch where it goes. Then add producers. Highlighted code is the line the process inside will run <b>next</b>.');  // starting message: a reminder of cwait and csignal, and a suggestion to add a consumer first
          }  // ends fresh()
          function admit() {  // admit(): when the monitor is free, lets the next process in and says where it came from
            if (st.inside) return null;  // someone is already inside, so nobody is admitted
            if (st.urgent.length) { st.inside = st.urgent.shift(); return { id: st.inside, from: 'urgent' }; }  // the urgent queue goes first; its process resumes where it left off
            if (st.entry.length) { st.inside = st.entry.shift(); procs[st.inside].pc = 1; return { id: st.inside, from: 'entry' }; }  // otherwise the first process in the entrance queue enters and starts at the first statement
            return null;  // nobody is waiting to enter
          }  // ends admit()
          const admitted = (a) => (a ? ` <b>${a.id}</b> ${a.from === 'urgent' ? 'comes back from the urgent queue first (it outranks the entrance queue).' : 'enters from the entrance queue.'}` : ' Nobody else is waiting to enter.');  // admitted(a): the sentence describing who was just let in, or that nobody was waiting
          function add(kind) {  // add(kind): creates a new producer (P) or consumer (C) that calls its procedure; runs on the add buttons
            const active = Object.values(procs).filter((p) => !p.done).length;  // active counts the processes that have not finished
            if (active >= 8) { ctx.toast('Plenty of processes already: run some lines first.'); return; }  // at most 8 at a time; a small pop-up message asks the student to run some lines first
            const id = kind + (kind === 'P' ? ++nP : ++nC);  // gives it an id such as P1 or C2
            procs[id] = { kind, pc: 0, item: kind === 'P' ? String.fromCharCode(97 + (nItem++ % 26)) : null };  // records the process: its kind, its position in its procedure, and for a producer the letter it will store
            let txt;  // txt will hold the explanation for this action
            if (!st.inside && !st.entry.length && !st.urgent.length) { st.inside = id; procs[id].pc = 1; txt = `<b>${id}</b> calls ${PROC(id)}(). The monitor is empty, so it walks straight in.`; }  // if the monitor and both queues are empty, the new process walks straight in and starts at its first statement
            else { st.entry.push(id); txt = `<b>${id}</b> calls ${PROC(id)}(), but <b>${st.inside}</b> is inside, so ${id} waits in the <span class="t">entrance queue</span>. Mutual exclusion, for free.`; }  // otherwise it joins the entrance queue: mutual exclusion without any lock call
            paint(txt, true);  // redraws, letting the new chip slide in from the left
          }  // ends add()
          function stepOnce() {  // stepOnce(): runs one line for the process inside, or admits one if the monitor is free; runs on "Run next line" and on each auto-run tick
            st.lost = null;  // clears any lost-signal warning from the previous step
            let txt;  // txt will hold the explanation for this step
            if (!st.inside) {  // nobody is inside the monitor
              const a = admit();  // tries to admit the next process
              paint(a ? `<b>${a.id}</b> enters the monitor.` : 'Nothing to run. Add a producer or a consumer.');  // reports who entered, or that there is nothing to run
              if (!a) stopAuto();  // with nothing to run, automatic running stops
              return;  // nothing more to do this step
            }  // ends the empty-monitor case
            const id = st.inside, p = procs[id], P = p.kind === 'P';  // id is the process inside, p its record, and P is true if it is a producer
            if (p.pc === 1) {  // statement 1: the if test before cwait
              const blocked = P ? st.count === NSLOT : st.count === 0;  // blocked is true when a producer finds the buffer full or a consumer finds it empty
              if (blocked) {  // the process cannot go on
                const q = P ? 'notfull' : 'notempty';  // q is the condition it must wait on
                st[q].push(id); st.inside = null; p.pc = 2; ach[P ? 'nf' : 'ne'] = true;  // it joins that condition queue, leaves the monitor, will resume at statement 2, and a goal is reached
                txt = `<b>${id}</b> sees count = ${st.count}, so the buffer is ${P ? 'full' : 'empty'}. It calls <code>cwait(${q})</code>: it sleeps on ${q} and releases the monitor.` + admitted(admit());  // message: it saw the count, called cwait and released the monitor; then says who comes in next
              } else { p.pc = 2; txt = `<b>${id}</b> checks count = ${st.count}: ${P ? 'not full' : 'not empty'}, so there is no need to wait.`; }  // otherwise the test passes and the process moves on without waiting
            } else if (p.pc === 2) {  // statement 2: store or copy the item
              if (P) { txt = `<b>${id}</b> stores item <b>${p.item}</b> in slot ${st.nextin}.`; st.buf[st.nextin] = p.item; p.item = null; }  // a producer stores its item in slot nextin
              else { p.item = st.buf[st.nextout]; st.buf[st.nextout] = null; txt = `<b>${id}</b> copies item <b>${p.item}</b> out of slot ${st.nextout} (the oldest one).`; }  // a consumer copies the oldest item from slot nextout and empties that slot
              p.pc = 3;  // next is statement 3
            } else if (p.pc === 3) {  // statement 3: advance the index
              const k = P ? 'nextin' : 'nextout', o = st[k];  // k is the index this process moves (nextin for producers, nextout for consumers); o is its old value
              st[k] = (o + 1) % NSLOT;  // moves it on by one, wrapping around after the last slot
              if (P && st[k] === 0) ach.wrap = true;  // a producer wrapping nextin back to 0 reaches the wrap goal
              txt = `<code>${k}</code> moves from ${o} to ${st[k]}` + (st[k] === 0 ? ': the <code>% N</code> wraps it back to slot 0.' : '.');  // message: where the index moved, noting the wrap to slot 0
              p.pc = 4;  // next is statement 4
            } else if (p.pc === 4) {  // statement 4: update count
              st.count += P ? 1 : -1;  // a producer adds one, a consumer subtracts one
              txt = `count ${P ? 'rises' : 'drops'} to ${st.count}.`;  // message: the new count
              p.pc = 5;  // next is statement 5
            } else if (p.pc === 5) {  // statement 5: csignal on the other condition
              const q = P ? 'notempty' : 'notfull';  // q is the condition to signal: notempty for producers, notfull for consumers
              p.pc = 6;  // after this, the process has only its closing brace left
              if (st[q].length) {  // someone is waiting on q
                const w = st[q].shift();  // w is the first waiter
                st.urgent.push(id); st.inside = w; ach.urgent = true;  // Hoare rule: the waiter takes over at once and the signaler moves to the urgent queue; a goal is reached
                txt = `<b>${id}</b> calls <code>csignal(${q})</code> and <b>${w}</b> is waiting. Hoare rule: ${w} takes over the monitor <b>immediately</b>, so ${id} steps aside into the <span class="t">urgent queue</span>. (Only its closing brace is left; this lab applies the rule strictly so you can watch the queue.)`;  // message explaining the hand-off and that the lab applies the rule strictly so the urgent queue can be seen
              } else {  // nobody is waiting on q
                st.lost = q; ach.lost = true;  // the signal is lost; the drawing marks it and a goal is reached
                txt = `<b>${id}</b> calls <code>csignal(${q})</code>, but nobody waits on ${q}: the signal is lost. That is harmless here, because a later arrival checks <code>count</code> itself.`;  // message: the lost signal is harmless because later arrivals check count themselves
              }  // ends the signal case
            } else {  // statement 6, the closing brace
              st.inside = null; st.done.push(id); p.done = true;  // the process leaves the monitor and is marked done
              txt = `<b>${id}</b> returns from ${PROC(id)}() and leaves the monitor${P ? '' : ' carrying item <b>' + p.item + '</b>'}.` + admitted(admit());  // message: it leaves (a consumer carries its item), then says who comes in next
            }  // ends the choice of statement
            paint(txt);  // redraws with this step's message
          }  // ends stepOnce()
          function paint(txt, slide) {  // paint(txt, slide): copies the lab state to the screen; slide lets new chips slide in
            st.labels = {};  // resets the chip labels
            for (const [id, p] of Object.entries(procs)) if (p.item) st.labels[id] = id + '·' + p.item;  // a process carrying an item shows it on its chip, such as P1·a
            st.activity = st.inside ? 'running ' + PROC(st.inside) + '()' : null;  // the activity line names the procedure being run by the process inside
            stage.set(st, { slideIn: slide });  // redraws the building
            code.clear();  // clears the old code highlights
            if (st.inside) {  // if someone is inside, shows where it is in the code
              const P = procs[st.inside].kind === 'P';  // P is true if the process inside is a producer
              code.mark(P ? [8, 9, 10, 11, 12, 13, 14] : [1, 2, 3, 4, 5, 6, 7], 'dim');  // dims the procedure it is not running
              code.mark([(P ? 1 : 8) + procs[st.inside].pc], 'cur');  // highlights the line it will run next (its procedure's header line plus its statement number)
            }  // ends the code highlight
            if (txt) sayEl.innerHTML = txt;  // shows the message, if one was given
            goals.forEach(([k, t], i) => { goalEls[i].innerHTML = (ach[k] ? '<b style="color:var(--ok)">✓</b> ' : '<span class="muted">○</span> ') + t; });  // updates the goal checklist: a green check for each goal reached, an empty circle otherwise
            stepBtn.disabled = !st.inside && !st.entry.length && !st.urgent.length;  // "Run next line" is disabled when nobody is inside or waiting to enter
          }  // ends paint()
          function stopAuto() { if (auto) { clearInterval(auto); auto = null; } if (autoBtn) { autoBtn.textContent = 'Auto-run'; autoBtn.classList.remove('on'); } }  // stopAuto(): stops automatic running and resets the Auto-run button
          const stepBtn = h('button', { class: 'btn primary', type: 'button', onclick: () => { stopAuto(); stepOnce(); } }, 'Run next line ▸');  // "Run next line" button: stops auto-run, then runs one step
          const autoBtn = h('button', { class: 'btn', type: 'button', onclick: () => {  // Auto-run button: toggles automatic stepping
            if (auto) return stopAuto();  // pressing it while running stops it
            auto = ctx.every(1100, stepOnce); autoBtn.textContent = 'Pause'; autoBtn.classList.add('on'); stepOnce();  // otherwise steps every 1.1 s, turns the button into Pause, and takes the first step at once
          } }, 'Auto-run');  // ends the Auto-run button
          const scen = (list) => () => { fresh(); list.forEach((k) => add(k)); };  // scen(list): makes a quick-start button handler that resets and adds the listed processes in order
          fresh();  // starts the lab empty when the page loads
          el.append(h('div', { class: 'stack fill' },  // page layout: one column that fills the page
            h('div', { class: 'row' },  // the toolbar row
              h('button', { class: 'btn proc', type: 'button', onclick: () => add('P') }, '+ Producer calls append'),  // button that adds a producer calling append
              h('button', { class: 'btn', type: 'button', style: { borderColor: 'var(--accent)', color: 'var(--accent)' }, onclick: () => add('C') }, '+ Consumer calls take'),  // button that adds a consumer calling take, in the consumer color
              stepBtn, autoBtn,  // the step and auto-run buttons
              h('button', { class: 'btn sm', type: 'button', onclick: fresh }, 'Reset'),  // the Reset button
              h('span', { class: 'xs b muted', style: { marginLeft: 'auto' } }, 'QUICK START'),  // a label pushed to the right, introducing the quick-start buttons
              h('button', { class: 'btn sm', type: 'button', onclick: scen(['C', 'P']) }, 'Empty buffer'),  // quick start: a consumer then a producer on an empty buffer
              h('button', { class: 'btn sm', type: 'button', onclick: scen(['P', 'P', 'P', 'P', 'C']) }, 'Overflow')),  // quick start: four producers and a consumer, so the buffer overflows and a producer must wait
            h('div', { class: 'split grow', style: { gridTemplateColumns: '620px minmax(0, 1fr)', gap: '20px' } },  // the main area: a fixed 620px column for the drawing and the rest for code and goals
              h('div', { class: 'stack' }, holder, sayEl),  // left: the building drawing and the explanation card
              h('div', { class: 'stack' },  // right column
                h('div', { class: 'stack', style: { gap: '4px', flex: 'none' } }, h('div', { class: 'xs b muted' }, 'HOARE RULES · HIGHLIGHT = NEXT LINE TO RUN'), code),  // a small label over the listing and the listing itself
                h('div', { class: 'card tight stack', style: { gap: '2px' } }, h('div', { class: 'xs b muted' }, 'CAN YOU MAKE THESE HAPPEN?'), ...goalEls)))));  // the goals checklist card
        },  // ends render() for step 5
      },  // ends step 5
      /* ---------------- 6. Hoare's price: process switches on one CPU ---------------- */
      {  // opens step 6
        title: 'Hoare’s hand-off has a price: extra process switches',  // step 6 title: the Hoare hand-off costs extra process switches
        kind: 'compare',  // a compare page
        render(el, ctx) {  // render() for step 6: builds the processor timeline comparison
          const { h, s } = ctx;  // h for HTML elements and s for SVG elements
          const X0 = 184, U = 66, OUT = 2;  // timeline geometry: X0 where the time slots start, U the width of one slot, and OUT the number of slots
          const CLS = { P1: 's-proc', C1: 's-accent', F: 's-bad', N: 's-panel' };  // CLS: the color class for each process's slots (P1, C1, F, and N for no process)
          let left = 1; // monitor lines P1 still has to run after it signals (0, 1 or 2)
          // Events are [who, label, start, end]. F = forced switch caused by the Hoare hand-off;
          // N = ordinary switch (P1's time slice ends), which happens under both rules.
          function plan(k) {  // plan(k): builds both processor timelines (Hoare and Mesa) for a signaler with k monitor lines left after its signal
            const ME = [['P1', 'work', 0, 1], ['P1', 'work', 1, 2], ['P1', 'cnotify', 2, 3]];  // Mesa starts with P1 doing two lines of work and then cnotify
            const HO = [['P1', 'work', 0, 1], ['P1', 'work', 1, 2], ['P1', 'csignal', 2, 3]];  // Hoare starts the same way but with csignal
            // P1 runs its k remaining monitor lines, leaves, does OUT units of outside work, then its slice ends.
            const p1Rest = (ev, t) => {  // p1Rest(ev, t): adds P1's remaining slots from time t and returns when they end
              const labs = [];  // labs collects the labels of P1's remaining slots
              for (let j = 0; j < k; j++) labs.push('work');  // one "work" slot for each monitor line left
              labs.push('leave');  // then a "leave" slot
              for (let j = 0; j < OUT; j++) labs.push('outside');  // then OUT slots of work outside the monitor
              labs.forEach((l) => { ev.push(['P1', l, t, t + 1]); t += 1; });  // adds each slot one time unit long, one after another
              ev.push(['N', '', t, t + 0.5]);  // then an ordinary half-unit switch when P1's time slice ends
              return t + 0.5;  // returns the time right after that switch
            };  // ends p1Rest()
            const c1 = (ev, t, first) => { ev.push(['C1', first, t, t + 1], ['C1', 'work', t + 1, t + 2], ['C1', 'leave', t + 2, t + 3]); return t + 3; };  // c1(ev, t, first): adds C1's three slots (first, work, leave) from time t and returns when they end
            const meEnd = c1(ME, p1Rest(ME, 3), 're-test');  // Mesa: P1 finishes everything, then C1 runs, starting with a re-test of its condition; meEnd is the finish time
            let hoEnd;  // hoEnd will be Hoare's finish time
            if (k === 0) hoEnd = c1(HO, p1Rest(HO, 3), 'resume'); // csignal was P1's last statement: it just leaves
            else {  // otherwise P1 still has work, so Hoare forces extra switches
              HO.push(['F', '', 3, 3.5]);            // P1 is suspended into the urgent queue
              const t = c1(HO, 3.5, 'resume');       // C1 runs inside at once
              HO.push(['F', '', t, t + 0.5]);        // P1 is resumed from the urgent queue
              hoEnd = p1Rest(HO, t + 0.5);  // P1 then finishes its remaining lines and outside work; hoEnd is the finish time
            }  // ends the k > 0 case
            return { HO, ME, meEnd, hoEnd };  // returns both timelines and both finish times
          }  // ends plan()
          function script(k) {  // script(k): the player's frames as [time to show up to, caption], for k lines left
            const { meEnd, hoEnd } = plan(k);  // gets the two finish times for this setting
            if (k === 0) return [  // when csignal is the last statement (k = 0), a shorter script
              [0, '<b>Setup.</b> One CPU. P1 is inside the monitor and C1 sleeps on condition <code>c</code>. This time <code>csignal(c)</code> is the <b>last statement</b> of P1’s procedure. Press <b>Next</b>.'],  // frame: the setup, with csignal as P1's last statement
              [2, 'P1 runs two lines inside the monitor. So far both worlds are identical.'],  // frame: P1 runs two lines; both worlds are identical
              [3, '<b>P1 signals as its very last act.</b> Hoare: P1 has nothing left to do inside, so it simply leaves instead of waiting in the urgent queue, and the monitor is kept for C1. Mesa: C1 is marked ready and P1 keeps the CPU.'],  // frame: P1 signals last, so under Hoare it just leaves, and under Mesa C1 is marked ready
              [6.5, 'Both worlds look the same: P1 leaves, does its outside work, and its time slice ends with an <b>ordinary</b> switch (grey) that gives C1 the CPU.'],  // frame: both worlds look the same, with only an ordinary switch at the end of P1's time slice
              [hoEnd, `<b>Result: 0 forced switches under both rules</b>, and both end at ${hoEnd}. The only difference: Hoare’s C1 may trust its condition, Mesa’s C1 re-tests it. Drawback 1 bites only when the signaler still has work after its signal.`],  // frame: the result, no forced switches under either rule
            ];  // ends the k = 0 script
            const L = k === 1 ? 'one more line' : k + ' more lines';  // L is "one more line" or "2 more lines" for the setup caption
            return [  // the script when P1 still has work after its signal
              [0, `<b>Setup.</b> One CPU. P1 is inside the monitor and C1 sleeps on condition <code>c</code>. P1 will signal c and still has <b>${L}</b> of monitor work after that. Press <b>Next</b>.`],  // frame: the setup, naming how much work P1 has left
              [2, 'P1 runs two lines inside the monitor. So far both worlds are identical.'],  // frame: P1 runs two lines; both worlds are identical
              [3, '<b>P1 signals.</b> Hoare <code>csignal(c)</code>: C1 must be the next to run inside, and P1 is not finished, so P1 is parked in the urgent queue. Mesa <code>cnotify(c)</code>: C1 is only marked ready, and P1 keeps the CPU.'],  // frame: P1 signals; Hoare parks it in the urgent queue, Mesa only marks C1 ready
              [4.5, '<b>Hoare:</b> forced <span class="t">process switch</span> #1 (red) hands the CPU to C1, which resumes knowing c is true. <b>Mesa:</b> P1 simply carries on with its remaining monitor work.'],  // frame: Hoare's forced switch 1 hands the processor to C1; Mesa's P1 carries on
              [6.5, 'Hoare: C1 does its work and leaves the monitor. Mesa: P1 is still running, with no switch at all.'],  // frame: Hoare's C1 works and leaves; Mesa has still not switched
              [7, '<b>Hoare:</b> forced switch #2 brings P1 back from the urgent queue, only to finish a procedure it was already in the middle of. <b>Mesa:</b> still no switch.'],  // frame: Hoare's forced switch 2 brings P1 back just to finish
              [8 + k, `Hoare: P1 runs its ${k === 1 ? 'last line' : 'last ' + k + ' lines'} and leaves. Mesa: P1’s time slice ends, and an <b>ordinary</b> switch (grey) that would have happened anyway gives C1 the CPU. C1 re-tests its condition first, since nothing guaranteed it.`],  // frame: Hoare's P1 finishes; Mesa's ordinary switch gives C1 the processor and C1 re-tests
              [meEnd, `<b>Mesa is finished:</b> all the work of both processes is done at time ${meEnd}. Hoare still has part of P1’s outside work to do.`],  // frame: Mesa is finished, while Hoare still has work to do
              [hoEnd, `<b>Result.</b> Identical work, yet Hoare ends at ${hoEnd} instead of ${meEnd}. The gap is exactly <b>2 forced process switches</b> (0.5 each): one to suspend the signaler, one to resume it. Mesa paid only a cheap re-test. Try other settings above.`],  // frame: the result, Hoare ends later by exactly two forced switches
            ];  // ends the script
          }  // ends script()
          const svg = s('svg', { viewBox: '0 0 1080 132', width: '100%', role: 'img', 'aria-label': 'CPU timelines under Hoare and Mesa rules' });  // the timeline drawing, 1080 units wide and 132 tall
          const T = (x, y, str, a) => s('text', Object.assign({ x, y, 'font-size': 13 }, a || {}), str);  // T(x, y, str, a): shortcut for a text label
          function lane(ev, y, name, sub, now) {  // lane(ev, y, name, sub, now): draws one timeline lane with every slot that has ended by time now
            const out = [];  // out collects the lane's pieces
            const forced = ev.filter((e) => e[0] === 'F' && e[3] <= now).length;  // forced counts the forced switches that have happened by now
            out.push(T(12, y + 16, name, { 'font-weight': 800, 'font-size': 15 }), T(12, y + 32, sub, { class: 's-sub' }),  // the lane's name and a short description of its rule
              T(12, y + 47, 'forced switches: ' + forced, { 'font-weight': 800, style: forced ? 'fill:var(--bad)' : 'fill:var(--ok)' }));  // the forced-switch count, red if above zero and green at zero
            ev.filter((e) => e[3] <= now).forEach(([who, lab, a, b]) => {  // draws each slot that has ended by now
              const x = X0 + a * U, w = (b - a) * U - 3;  // x is where the slot starts and w its width (with a small gap)
              out.push(s('rect', { x, y: y + 4, width: w, height: 42, rx: 7, class: CLS[who], 'stroke-width': 1.5 }));  // the slot's rectangle in the color of its process
              if (who === 'F' || who === 'N') out.push(T(x + w / 2, y + 30, '↔', { 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 800, style: who === 'F' ? 'fill:var(--bad)' : '' }));  // a switch slot shows a double arrow, red for a forced switch
              else out.push(T(x + w / 2, y + 21, who, { 'text-anchor': 'middle', 'font-weight': 800 }), T(x + w / 2, y + 39, lab, { 'text-anchor': 'middle', class: 's-monot' }));  // a process slot shows the process name and what it did
            });  // ends the slot loop
            return out;  // returns the lane's pieces
          }  // ends lane()
          let P = plan(left), frames = script(left);  // P holds the timelines and frames the script for the starting setting
          function draw(now) {  // draw(now): redraws both lanes up to time now, with a dashed "now" line
            const k = [s('line', { x1: X0, y1: 22, x2: X0 + 13 * U, y2: 22, class: 's-muted' }), T(12, 26, 'time →', { class: 's-sub' })];  // k starts with the time axis and its label
            for (let t = 0; t <= 13; t += 1) k.push(s('line', { x1: X0 + t * U, y1: t % 2 ? 19 : 17, x2: X0 + t * U, y2: t % 2 ? 25 : 27, class: 's-muted' }), t % 2 ? '' : T(X0 + t * U, 13, String(t), { 'text-anchor': 'middle', class: 's-sub' }));  // tick marks for every time unit, longer on even units, with numbers on the even ones
            k.push(...lane(P.HO, 28, 'Hoare', 'csignal hands over now', now), ...lane(P.ME, 80, 'Mesa', 'cnotify just marks ready', now));  // the Hoare lane on top and the Mesa lane below
            k.push(s('line', { x1: X0 + now * U, y1: 26, x2: X0 + now * U, y2: 130, stroke: 'var(--chc)', 'stroke-width': 2, 'stroke-dasharray': '5 4' }));  // the dashed vertical "now" line in the chapter color
            svg.replaceChildren(...k.filter(Boolean));  // replaces the drawing (skipping the empty entries left for odd ticks)
            // phones: keep the "now" line in view inside the sideways-scrolling wrapper
            const sc = svg.parentElement;  // sc is the element around the drawing
            if (ctx.narrow && sc && sc.classList.contains('m5-wide')) sc.scrollLeft = Math.max(0, (X0 + now * U) * (svg.clientWidth / 1080) - sc.clientWidth / 2);  // on a phone-width screen, scrolls the wrapper so the "now" line stays near the middle
          }  // ends draw()
          const player = ctx.ui.player({ count: frames.length, render: (i) => { draw(frames[i][0]); return frames[i][1]; }, interval: 2400 });  // the player: each frame draws up to its time and returns its caption, 2.4 s apart when playing
          const seg = ctx.ui.seg([{ value: 0, label: '0: signal is last' }, { value: 1, label: '1 line' }, { value: 2, label: '2 lines' }], left, (v) => {  // buttons for how many monitor lines P1 has left after signaling (0, 1 or 2)
            const atEnd = player.index >= player.count - 1;  // atEnd remembers whether the player was on its last frame
            left = v; P = plan(v); frames = script(v);  // rebuilds the timelines and the script for the new setting
            player.setCount(frames.length);  // tells the player how many frames there are now
            if (atEnd) player.go(frames.length - 1);  // if the student was looking at the result, jumps to the new result
          });  // ends the setting handler
          const key = (cls, t) => h('span', { class: 'row gap-s xs b', style: { gap: '6px' } }, h('span', { class: 'm6-key ' + cls }), t);  // key(cls, t): a legend item, a small colored square and its label
          el.append(h('div', { class: 'stack fill' },  // page layout: one column that fills the page
            h('p', { class: 'm0', html: 'In a <span class="t">Hoare monitor</span>, <code>csignal</code> hands the monitor to the woken process on the spot, so the condition it waited for is <b>guaranteed</b> to still hold. The <span class="t">Mesa monitor</span> relaxes that. Step through the same moment on one CPU under both rules.' }),  // intro paragraph: Hoare's csignal hands over on the spot so the condition is guaranteed; Mesa relaxes that
            h('div', { class: 'row', style: { justifyContent: 'space-between' } },  // a row with the setting and the legend at opposite ends
              h('div', { class: 'row gap-s' }, h('span', { class: 'small b' }, 'Monitor work P1 still has after its signal:'), seg),  // the setting label and its buttons
              h('div', { class: 'row', style: { gap: '14px' } }, key('proc', 'P1 (signaler)'), key('accent', 'C1 (waiter)'), key('bad', 'forced switch'), key('panel', 'ordinary switch'))),  // the legend: signaler, waiter, forced switch, ordinary switch
            h('div', { class: 'card white', style: { padding: '6px 12px' } }, wide(ctx, svg, 1000)),  // the timeline on a white card (scrollable sideways on phones)
            player.el,  // the player controls and caption
            h('div', { class: 'grid-2' },  // two notes side by side
              h('div', { class: 'callout why m0', 'data-label': 'Drawback 1 · Cost', html: 'A signaler that has not finished costs <b>two extra process switches</b>: one to suspend it, one to resume it. 1 line left or 100, it is still 2.' }),  // drawback 1: an unfinished signaler always costs two extra switches
              h('div', { class: 'callout warn m0', 'data-label': 'Drawback 2 · Fragile', html: 'Scheduling must be <b>perfectly reliable</b>: the woken process must be the very next one to run inside. If anyone else slips in first, the condition may be false again.' }))));  // drawback 2: the scheduling must be perfectly reliable, or the condition may be false again
        },  // ends render() for step 6
      },  // ends step 6
      /* ---------------- 7. Mesa: cnotify, a process sneaks in, and if becomes while ---------------- */
      {  // opens step 7
        title: 'Mesa monitors: notify, sneak in, re-test with while',  // step 7 title: Mesa monitors, where a process can sneak in and if must become while
        kind: 'compare',  // a compare page
        core: true,  // on the core path through the guide
        render(el, ctx) {  // render() for step 7: builds the scripted Hoare-versus-Mesa replay
          const { h } = ctx;  // only HTML elements are needed
          function build(mode) {  // build(mode): scripts the same story under one of three rules and returns its frames
            const mesa = mode !== 'hoare';  // mesa is true for both Mesa variants
            const st = emptyState(mesa ? 'mesa' : 'hoare');  // st is the monitor state that the script changes step by step
            const F = [];  // F collects the frames
            let sw = 0;  // sw counts the extra (forced) process switches so far
            const snap = (cap, mark, cls, outcome) => F.push({ st: JSON.parse(JSON.stringify(st)), mark, cls: cls || 'cur', cap, sw, outcome: outcome || null });  // snap(cap, mark, cls, outcome): saves a deep copy of the state as a frame, with a caption and the code lines to highlight
            st.inside = 'C1'; st.entry = ['P1', 'C2']; st.labels = { P1: 'P1·a' };  // starting state: C1 is inside take(); P1 (carrying item a) and C2 wait at the entrance
            snap('<b>Start.</b> The buffer is empty. Consumer C1 is inside <code>take()</code>; producer P1 and a second consumer C2 wait at the entrance.', [9]);  // frame: the buffer is empty and C1 is inside take()
            st.notempty = ['C1']; st.inside = 'P1'; st.entry = ['C2'];  // C1 moves to the notempty queue, P1 enters, C2 is still waiting
            snap('C1 finds <code>count == 0</code> and calls <code>cwait(notempty)</code>. It sleeps and releases the monitor, so P1 enters.', [9]);  // frame: C1 finds the buffer empty, calls cwait and releases the monitor
            st.buf[0] = 'a'; st.nextin = 1; st.count = 1; st.labels = {};  // P1 stores a in slot 0, nextin becomes 1 and count 1
            snap('P1 stores item <b>a</b> in slot 0, advances <code>nextin</code> and sets <code>count = 1</code>.', [3, 4, 5]);  // frame: P1 stores the item (highlights the store, advance and count lines)
            if (!mesa) {  // the Hoare version of the rest of the story
              st.notempty = []; st.urgent = ['P1']; st.inside = 'C1'; sw = 1;  // C1 leaves the condition queue and takes over, P1 goes to the urgent queue, first forced switch
              snap('P1 calls <code>csignal(notempty)</code>. <b>Hoare:</b> C1 takes over <b>at once</b> (forced switch 1) and P1 waits in the urgent queue. C2 cannot slip in between.', [6]);  // frame: Hoare's csignal hands over at once, so C2 cannot slip in
              st.buf[0] = null; st.nextout = 1; st.count = 0; st.labels = { C1: 'C1·a' };  // C1 takes item a and the buffer is empty again
              snap('C1 resumes right after its <code>cwait</code> and takes item <b>a</b>. It may trust its earlier test: nobody touched the buffer in between.', [10, 11, 12]);  // frame: C1 resumes after its cwait and can trust its earlier test
              st.lost = 'notfull'; st.inside = 'P1'; st.urgent = []; st.done = ['C1']; sw = 2;  // C1's signal on notfull is lost and C1 leaves; P1 returns from the urgent queue, second forced switch
              snap('C1 signals <code>notfull</code> (nobody waits: lost) and leaves. The urgent queue outranks the entrance, so P1 comes back (forced switch 2) just to finish.', [13, 14]);  // frame: the urgent queue outranks the entrance, so P1 comes back just to finish
              st.lost = null; st.inside = 'C2'; st.done = ['C1', 'P1'];  // P1 leaves and C2 finally enters
              snap('P1 returns and leaves. Only now does C2 get in.', [7]);  // frame: P1 leaves; only now does C2 get in
              st.inside = null; st.notempty = ['C2'];  // C2 finds the buffer empty and waits on notempty
              snap('<b>Correct.</b> C2 finds the buffer empty and waits. The price: 2 extra switches, just to bring P1 back for its closing brace.', [9], 'ok', 'ok');  // frame: correct, but at the price of 2 extra switches (marked as an ok outcome)
            } else {  // the Mesa versions of the rest of the story
              st.notempty = []; st.entry = ['C2', 'C1']; st.warn = ['C1'];  // C1 leaves the condition queue but must re-enter behind C2; its chip is dashed to show it was notified
              snap('P1 calls <code>cnotify(notempty)</code>. <b>Mesa:</b> C1 is merely moved out of the condition queue and must re-enter like anyone else, <b>behind C2</b> (dashed = notified). P1 keeps running.', [6]);  // frame: Mesa's cnotify only makes C1 ready, and P1 keeps running
              st.inside = 'C2'; st.entry = ['C1']; st.done = ['P1'];  // P1 leaves; C2 is at the front of the entrance queue, so it enters before C1
              snap('P1 returns and leaves. The monitor is free, and the front of the entrance queue is <b>C2</b>, not C1: <b>C2 sneaks in first.</b>', [7]);  // frame: C2 sneaks in first
              st.buf[0] = null; st.nextout = 1; st.count = 0; st.labels = { C2: 'C2·a' };  // C2 takes item a and the buffer is empty again
              snap('C2 sees <code>count = 1</code>, so it never waits, and takes item <b>a</b>. The buffer is empty again, and C1 has no idea.', [9, 10, 11, 12]);  // frame: C2 never had to wait, and C1 does not know the item is gone
              st.lost = 'notfull'; st.inside = 'C1'; st.entry = []; st.done = ['P1', 'C2']; st.warn = [];  // C2's signal on notfull is lost and C2 leaves; C1 finally gets back in
              snap(mode === 'mesa-if'  // frame: C1 resumes after its cwait; the caption depends on the variant
                ? 'C2 leaves. At last C1 gets back in and resumes right after its <code>cwait</code>. With <code>if</code> there is no second test: it goes straight on to take an item.'  // with if: there is no second test, so C1 goes straight on to take an item
                : 'C2 leaves. At last C1 gets back in and resumes right after its <code>cwait</code>, inside the <code>while</code> loop, so it goes back to the test.', mode === 'mesa-if' ? [10] : [9]);  // with while: C1 is still inside the loop, so it goes back to the test (the highlighted line differs too)
              st.lost = null;  // clears the lost-signal mark
              if (mode === 'mesa-if') {  // the if variant ends badly
                st.nextout = 2; st.count = -1; st.labels.C1 = 'C1·?'; st.bad = ['C1'];  // C1 takes from the empty buffer: count drops to -1 and its chip shows a question mark and turns red
                snap('<b>Bug!</b> Trusting a stale test, C1 takes from an empty buffer: garbage from slot 1, and <code>count</code> falls to −1. Under Mesa rules <code>if</code> is wrong.', [10, 11, 12], 'bad', 'bad');  // frame: the bug, because under Mesa rules an if test can be stale
              } else {  // the while variant ends safely
                st.inside = null; st.notempty = ['C1'];  // C1 re-tests, finds the buffer empty and goes back to sleep on notempty
                snap('<b>Safe.</b> The <code>while</code> re-test finds <code>count == 0</code>, so C1 goes back to sleep and waits for the next item. No extra switches, no harm.', [9], 'ok', 'ok');  // frame: safe, with no extra switches and no harm
              }  // ends the Mesa branch
            }  // ends the Hoare-or-Mesa choice
            return F;  // returns the finished frames
          }  // ends build()
          let mode = 'mesa-if', frames = build(mode);  // starts with the Mesa-with-if variant and builds its frames
          const stage = makeStage(ctx);  // the monitor building drawing
          const codeBox = h('div');  // codeBox holds the listing for the chosen variant
          let code = null;  // code is the current listing
          const swBig = h('div', { class: 'big', style: { fontSize: '30px' } });  // swBig shows the number of extra switches in large type
          const outChip = h('span', { class: 'chip' });  // outChip shows the outcome: still running, correct, or wrong
          function setCode() { code = ctx.ui.code(bbSource(mode), { lang: 'c', nums: false, fontSize: 13 }); codeBox.replaceChildren(code); }  // setCode(): rebuilds the listing in the style of the current variant
          setCode();  // builds the first listing
          const player = ctx.ui.player({ count: frames.length, interval: 2800, render: (i) => {  // the player; each step shows one frame
            const f = frames[i];  // f is the frame to show
            const st = f.st;  // st is that frame's saved monitor state
            st.activity = st.inside ? 'running ' + (st.inside[0] === 'P' ? 'append()' : 'take()') : null;  // the activity line names the procedure the process inside is running
            stage.set(st);  // redraws the building
            code.clear();  // clears old highlights in the listing
            code.mark(f.mark, f.cls);  // highlights the frame's code lines in its color (current, ok or bad)
            swBig.textContent = f.sw;  // shows the extra-switch count
            swBig.style.color = f.sw ? 'var(--bad)' : 'var(--ok)';  // red when there were extra switches, green at zero
            outChip.className = 'chip ' + (f.outcome === 'bad' ? 'bad' : f.outcome === 'ok' ? 'ok' : '');  // colors the outcome chip for this frame
            outChip.textContent = f.outcome === 'bad' ? 'wrong: count = −1' : f.outcome === 'ok' ? 'correct' : 'still running';  // the outcome text: wrong with count -1, correct, or still running
            return f.cap;  // returns the caption for the player to show
          } });  // ends the player setup
          const seg = ctx.ui.seg([{ value: 'hoare', label: 'Hoare · csignal + if' }, { value: 'mesa-if', label: 'Mesa · cnotify + if' }, { value: 'mesa-while', label: 'Mesa · cnotify + while' }], mode, (v) => {  // variant buttons: Hoare with if, Mesa with if, or Mesa with while
            mode = v; frames = build(v); setCode(); player.refresh();  // switching rebuilds the frames and the listing and redraws the current step
          });  // ends the variant handler
          el.append(h('div', { class: 'stack fill' },  // page layout: one column that fills the page
            h('div', { class: 'row' }, seg, h('span', { class: 'small muted', html: 'Hoare’s csignal hands over the monitor at once; Mesa’s <span class="t">cnotify</span> only makes a waiter ready.' })),  // top row: the variant buttons and a one-line reminder of the difference
            h('div', { class: 'split grow', style: { gridTemplateColumns: '600px minmax(0, 1fr)', gap: '20px' } },  // the main area: a fixed 600px column for the building and the rest for code and counters
              h('div', { class: 'card white', style: { padding: '4px' } }, wide(ctx, stage.svg, 580)),  // the building on a white card (scrollable sideways on phones)
              h('div', { class: 'stack' }, codeBox,  // the right column: the listing
                h('div', { class: 'card tight row', style: { justifyContent: 'space-between' } },  // a card with the two counters at opposite ends
                  h('div', { class: 'row gap-s' }, h('span', { class: 'xs b muted' }, 'EXTRA SWITCHES'), swBig),  // the extra-switch counter
                  h('div', { class: 'row gap-s' }, h('span', { class: 'xs b muted' }, 'OUTCOME'), outChip)))),  // the outcome chip
            player.el));  // the player controls close the page
        },  // ends render() for step 7
      },  // ends step 7
      /* ---------------- 8. cbroadcast: variable-size memory requests ---------------- */
      {  // opens step 8
        title: 'cbroadcast: wake everyone, let each one re-check',  // step 8 title: cbroadcast wakes everyone and lets each re-check
        kind: 'explore',  // an explore page
        render(el, ctx) {  // render() for step 8: builds the memory-request demo
          const { h } = ctx;  // only HTML elements are needed
          const WANT = { R1: 40, R2: 10, R3: 25 };  // WANT: how many kilobytes (KB) each requesting process needs
          const IDS = ['R1', 'R2', 'R3'];  // IDS: the three requesters in the order they went to sleep
          let mode = 'notify', X = 30;  // mode is notify or broadcast; X is how many KB process F will release (a slider sets it)
          function build() {  // build(): scripts the frames for the current mode and release size
            let free = 5, q = IDS.slice(), released = false;  // free starts at 5 KB, all three are in the wait queue q, and F has not released yet
            const got = {}, status = { R1: 'asleep', R2: 'asleep', R3: 'asleep' };  // got records what each requester received; status is each one's state for its card
            const F = [];  // the list F collects the frames (not to be confused with process F in the story)
            const snap = (cap, mark, focus) => F.push({ free, got: Object.assign({}, got), status: Object.assign({}, status), released, cap, mark: mark || [], focus: focus || null });  // snap(cap, mark, focus): saves a copy of the numbers as a frame, with a caption, code lines to highlight, and the process in focus
            snap(`<b>Start.</b> Only 5 KB is free and process F holds ${X} KB. R1, R2 and R3 each asked for more than 5 KB, so all three sleep on <code>memfree</code>, in that order.`);  // frame: the start, only 5 KB free, so all three requesters sleep on memfree
            free += X; released = true;  // F releases its memory, so free grows by X
            const woken = mode === 'notify' ? [q[0]] : q.slice();  // woken lists who is made ready: only the first waiter for cnotify, everyone for cbroadcast
            woken.forEach((r) => { status[r] = 'woken'; });  // each woken process is marked as woken for its card
            q = q.filter((r) => !woken.includes(r));  // the woken ones leave the wait queue
            snap(`F releases ${X} KB, so <b>${free} KB</b> is free, then calls <code>${mode === 'notify' ? 'cnotify' : 'cbroadcast'}(memfree)</code>. ` + (mode === 'notify' ? `Only <b>${woken[0]}</b>, first in line, is made ready.` : '<b>All three</b> are made ready. Each will re-test when it gets the monitor.'), [6, 7]);  // frame: F releases its memory and calls cnotify (only the first waiter is made ready) or cbroadcast (all are)
            woken.forEach((r) => {  // each woken process, in turn, gets the monitor and re-tests
              if (free >= WANT[r]) { free -= WANT[r]; got[r] = WANT[r]; status[r] = 'got'; snap(`${r} gets the monitor and re-tests: is ${free + WANT[r]} ≥ ${WANT[r]}? <b>Yes.</b> It takes ${WANT[r]} KB and leaves; ${free} KB remain.`, [2, 3], r); }  // it fits: it takes its memory and leaves; frame shows the re-test and the remaining free memory
              else { status[r] = 'again'; q.push(r); snap(`${r} gets the monitor and re-tests: is ${free} ≥ ${WANT[r]}? <b>No.</b> The <code>while</code> loop sends it back to sleep on memfree.`, [2], r); }  // it does not fit: the while loop sends it back to sleep on memfree, at the back of the queue
            });  // ends the loop over woken processes
            const fit = q.filter((r) => WANT[r] <= free);  // fit lists the processes still waiting whose request would now fit
            const winners = IDS.filter((r) => got[r]);  // winners lists the processes that got memory
            let sum;  // sum will hold the summary caption for the last frame
            const left = free ? 'only ' + free + ' KB is left' : 'no memory is left';  // left describes how much memory remains, for the summary
            if (mode === 'notify' && fit.length) sum = `<b>Stuck.</b> ${free} KB sits idle while ${fit.join(' and ')} ${fit.length > 1 ? 'wait, though each would fit' : 'waits, though it would fit'}. ` + (got.R1 ? 'cnotify woke only R1, so nobody told the others that memory was left over.' : 'F could not know which waiter to wake, and cnotify picked R1, which did not fit.');  // with cnotify, if someone who would fit is still asleep: stuck, and the reason depends on whether R1 got memory
            else if (winners.length) sum = `<b>Done.</b> ${winners.join(' and ')} got memory${q.length ? '; ' + q.join(' and ') + ' still wait' + (q.length > 1 ? '' : 's') + ', correctly, since ' + left : ''}.` + (mode === 'broadcast' ? ' Broadcast let every waiter decide for itself.' : ' Here one wake-up happened to be enough.');  // otherwise, if anyone got memory: done, and anyone still waiting is waiting correctly
            else sum = `<b>Nobody fits yet</b> (${free} KB free). Every woken process re-tested and went back to sleep: a few cheap re-tests, no harm.`;  // otherwise nobody fits yet, and the re-tests were cheap and harmless
            snap(sum);  // the summary becomes the last frame
            return F;  // returns the frames
          }  // ends build()
          const bar = h('div', { class: 'm5-bar' });  // bar is the memory pool strip, split into colored parts
          const reqEls = IDS.map((r) => h('div', { class: 'card tight m5-req stack gap-s' }));  // one card per requester
          const freeBig = h('span', { class: 'b', style: { color: 'var(--mem)' } });  // freeBig shows the free memory in the memory color
          const codeBox = h('div');  // codeBox holds the allocate and release listing
          let code = null, frames = build();  // code is the current listing; frames holds the scripted steps
          function setCode() {  // setCode(): rebuilds the listing so the release line matches the chosen mode
            code = ctx.ui.code(`${/* the listing starts here (its leading line break is trimmed by the code box) */''}
void allocate(int want) {             // need 'want' KB${/* shown code, line 1: allocate() needs want KB */''}
  while (free < want) cwait(memfree); // too little: sleep${/* shown code, line 2: while there is too little free memory, sleep on memfree */''}
  free = free - want;                 // take the memory${/* shown code, line 3: take the memory */''}
}                                     // leave the monitor${/* shown code, line 4: leave the monitor */''}
void release(int amount) {            // give memory back${/* shown code, line 5: release() gives memory back */''}
  free = free + amount;               // return it to pool${/* shown code, line 6: return it to the pool */''}
  ${(mode === 'notify' ? 'cnotify(memfree);' : 'cbroadcast(memfree);').padEnd(36)}// ${mode === 'notify' ? 'wake only one' : 'wake ALL waiters'}${/* shown code, line 7: cnotify or cbroadcast, depending on the mode, with a matching comment */''}
}                                     // leave the monitor`, { lang: 'c', nums: false, fontSize: 13 });  // shown code, line 8: leave the monitor; the listing has no line numbers and is drawn at 13px
            codeBox.replaceChildren(code);  // shows the new listing
          }  // ends setCode()
          setCode();  // builds the first listing
          function draw(f) {  // draw(f): shows frame f's numbers on the memory bar, the requester cards and the listing
            const segs = [['oth', 95 - X, 'other programs']];  // segs lists the bar's parts as [class, percent, label]; other programs use 95 - X of the 100 KB
            IDS.forEach((r) => { if (f.got[r]) segs.push(['rq', f.got[r], r + ' ' + f.got[r]]); });  // a part for each requester that got memory
            if (!f.released) segs.push(['fh', X, 'F ' + X]);  // F's part, until F releases it
            segs.push(['fr', f.free, 'free ' + f.free]);  // the free part
            bar.replaceChildren(...segs.filter((x) => x[1] > 0).map(([c, v, t]) => h('div', { class: c, style: { flex: `0 0 ${v}%` }, title: t + ' KB' }, v >= 9 ? t : '')));  // rebuilds the bar, skipping empty parts; labels appear only on parts wide enough (9% or more) to fit them
            freeBig.textContent = f.free + ' KB free';  // the free-memory figure
            IDS.forEach((r, i) => {  // updates each requester's card
              const st = f.status[r];  // st is this requester's status in the frame
              const lab = { asleep: ['os', 'asleep on memfree'], woken: ['warn', 'woken: will re-test'], again: ['os', 're-tested: asleep again'], got: ['ok', `got ${WANT[r]} KB ✓`] }[st];  // lab is the chip color and text for that status
              reqEls[i].className = 'card tight m5-req stack gap-s' + (f.focus === r ? ' focus' : '');  // highlights the card of the requester acting in this frame
              reqEls[i].innerHTML = `<div class="row" style="justify-content:space-between"><b>${r}</b><span class="small muted">wants <b>${WANT[r]} KB</b></span></div><span class="chip ${lab[0]}">${lab[1]}</span>`;  // the card: name, how much it wants, and the status chip
            });  // ends the card loop
            code.clear();  // clears old highlights in the listing
            code.mark(f.mark);  // highlights this frame's code lines
          }  // ends draw()
          const player = ctx.ui.player({ count: frames.length, interval: 2400, render: (i) => { draw(frames[i]); return frames[i].cap; } });  // the player: each step draws one frame and shows its caption, 2.4 s apart when playing
          const rebuild = () => { frames = build(); setCode(); player.setCount(frames.length); };  // rebuild(): rescripts the frames and listing after the mode or slider changes
          const seg = ctx.ui.seg([{ value: 'notify', label: 'release uses cnotify' }, { value: 'broadcast', label: 'release uses cbroadcast' }], mode, (v) => { mode = v; rebuild(); });  // mode buttons: release uses cnotify or cbroadcast
          const slider = ctx.ui.slider({ label: 'F frees', min: 5, max: 60, step: 5, value: X, format: (v) => v + ' KB', onInput: (v) => { X = v; rebuild(); } });  // slider: how many KB process F frees (5 to 60, in steps of 5)
          el.append(h('div', { class: 'stack fill' },  // page layout: one column that fills the page
            h('p', { class: 'm0', html: 'Sometimes one event could satisfy several waiters, and the signaler cannot tell which ones, or how many. Mesa monitors add <span class="t">cbroadcast</span>(x): <b>every</b> process waiting on x becomes ready, and each re-tests its own condition. Example: processes waiting for memory blocks of different sizes.' }),  // intro paragraph: one event may satisfy several waiters, so Mesa adds cbroadcast
            h('div', { class: 'split grow', style: { gridTemplateColumns: '620px minmax(0, 1fr)', gap: '22px' } },  // the main area: a fixed 620px column for the demo and the rest for code and notes
              h('div', { class: 'stack' },  // the left column
                h('div', { class: 'row' }, seg, h('div', { class: 'grow', style: { minWidth: '200px' } }, slider)),  // the mode buttons and the slider
                h('div', { class: 'card white stack gap-s' },  // a white card holding the memory pool display
                  h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'xs b muted' }, 'MEMORY POOL · 100 KB'), freeBig),  // heading row: the pool size and the free-memory figure
                  bar,  // the memory bar
                  h('div', { class: 'grid-3' }, ...reqEls)),  // the three requester cards side by side
                player.el,  // the player controls and caption
                h('div', { class: 'callout why m0 small', 'data-label': 'Why it matters', html: 'Real thread libraries work this way. POSIX threads: <code>pthread_cond_signal</code> / <code>pthread_cond_broadcast</code>. Java: <code>notify</code> / <code>notifyAll</code>. Both follow Mesa rules, so waits always sit in a <code>while</code> loop.' })),  // why box: real thread libraries (POSIX threads, Java) follow the Mesa rules, so waits sit in a while loop
              h('div', { class: 'stack' },  // the right column
                codeBox,  // the allocate and release listing
                h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'Pairing <code>cbroadcast</code> with <code>if</code>. Every woken process would carry on, even those whose request still does not fit. Broadcast relies on <code>while</code>.' }),  // common-mistake box: pairing cbroadcast with if lets processes whose request does not fit carry on
                h('div', { class: 'callout tip m0 small', 'data-label': 'The trade-off', html: 'Broadcast is never <b>wrong</b> with <code>while</code>, but it can be wasteful: every woken process gets a turn in the monitor, and those that still do not fit just re-test and sleep again. Use <code>cnotify</code> when exactly one waiter can use the change; use <code>cbroadcast</code> when several might, or you cannot tell which.' })))));  // trade-off box: broadcast is never wrong with while but can be wasteful; when to use each call
        },  // ends render() for step 8
      },  // ends step 8
      /* ---------------- 9. Watchdog timer + why Mesa won ---------------- */
      {  // opens step 9
        title: 'Mesa safety nets: watchdog timers and re-tests',  // step 9 title: Mesa safety nets, watchdog timers and re-tests
        kind: 'explore',  // an explore page
        render(el, ctx) {  // render() for step 9: builds the watchdog timer timeline
          const { h, s } = ctx;  // h for HTML elements and s for SVG elements
          const ITEM = 8, END = 24, X0 = 150, U = 38; // item a is stored at t = 8; timeline runs 0..24 ticks
          let notify = true, W = 0, test = 'while';  // settings: whether the producer's cnotify is sent, the watchdog limit W in ticks (0 = none), and the test keyword
          // Consumer C calls take() at t = 0, finds the buffer empty and waits on notempty from t = 1.
          // Each wait ends at the first of: the producer's cnotify (t = 8, if it is sent) or the watchdog limit.
          function run() {  // run(): simulates consumer C's waits for the current settings and returns what happened
            const ev = [];  // ev collects each wait as { start, end, reason, result }
            let ws = 1, got = null, bug = null, wasted = 0;  // ws is when the current wait started; got, bug and wasted record the outcome
            for (let guard = 0; guard < 40; guard++) {  // repeats wait after wait (at most 40, as a safety limit)
              const tTimer = W ? ws + W : Infinity;  // tTimer is when the watchdog would end this wait, or never if there is no watchdog
              const tNote = notify ? ITEM : Infinity;  // tNote is when the cnotify would arrive, or never if it is not sent
              const tw = Math.min(tTimer, tNote);  // tw is when this wait actually ends: whichever comes first
              if (tw > END) break;                                // nothing will ever wake C
              const why = tNote <= tTimer ? 'notify' : 'timer';  // why records what ended the wait: the notify or the timer
              if (tw >= ITEM) { ev.push({ ws, t: tw, why, res: 'take' }); got = tw; break; }  // if the item is already there, C takes it and the story ends
              if (test === 'if') { ev.push({ ws, t: tw, why, res: 'bug' }); bug = tw; break; }  // with if, C does not re-test, so it takes from an empty buffer: the bug
              ev.push({ ws, t: tw, why, res: 'sleep' }); wasted++; ws = tw; // while: re-test fails, wait again
            }  // ends the wait loop
            return { ev, got, bug, wasted, ws, stranded: got == null && bug == null };  // returns the waits, the outcome, the wasted wake-ups, and whether C was left waiting forever
          }  // ends run()
          const svg = s('svg', { viewBox: '0 0 1100 166', width: '100%', role: 'img', 'aria-label': 'Timeline of consumer C waiting for an item, with an optional watchdog timer' });  // the timeline drawing, 1100 by 166 units
          const T = (x, y, str, a) => s('text', Object.assign({ x, y, 'font-size': 13 }, a || {}), str);  // T(x, y, str, a): shortcut for a text label
          const X = (t) => X0 + t * U;  // X(t): converts a time in ticks to an x position in the drawing
          const bar = (a, b, y, hh, cls, label, style) => [s('rect', { x: X(a), y, width: Math.max(4, (b - a) * U - 2), height: hh, rx: 6, class: cls, 'stroke-width': 1.5 }),  // bar(a, b, y, hh, cls, label, style): draws a timeline bar from tick a to tick b (at least 4 units wide)
            label ? T((X(a) + X(b)) / 2, y + hh / 2 + 5, label, { 'text-anchor': 'middle', 'font-weight': 700, style: style || '' }) : null];  // with an optional centered label, which can have its own color
          function draw(r) {  // draw(r): draws the three lanes (producer, consumer, buffer) for the result r of run()
            const k = [s('line', { x1: X(0), y1: 18, x2: X(END), y2: 18, class: 's-muted' }), T(12, 22, 'time (ticks) →', { class: 's-sub' })];  // k starts with the time axis and its label
            for (let t = 0; t <= END; t += 2) k.push(s('line', { x1: X(t), y1: 14, x2: X(t), y2: 22, class: 's-muted' }), T(X(t), 11, String(t), { 'text-anchor': 'middle', class: 's-sub' }));  // tick marks and numbers every 2 ticks
            // producer lane
            k.push(T(12, 47, 'Producer P', { 'font-weight': 800 }), ...bar(0, 6, 26, 34, 's-proc', 'produce(a): no monitor'), ...bar(6, 8, 26, 34, 's-proc', 'append(a)'));  // producer lane: its label, produce(a) outside the monitor, then append(a)
            k.push(T(X(8) + 8, 48, notify ? 'stores a, then cnotify(notempty)' : 'stores a, but FORGETS cnotify', { class: 's-monot', 'font-weight': 700, style: notify ? 'fill:var(--ok)' : 'fill:var(--bad)' }));  // a note after append: it stores a and calls cnotify (green), or forgets cnotify (red)
            // consumer lane
            k.push(T(12, 108, 'Consumer C', { 'font-weight': 800 }), ...bar(0, 1, 84, 38, 's-accent', 'take'));  // consumer lane: its label and the short take call at the start
            r.ev.forEach((e) => {  // draws each of C's waits
              k.push(...bar(e.ws, e.t, 84, 38, 's-os', e.t - e.ws >= 3 ? 'asleep on notempty' : e.t - e.ws >= 2 ? 'asleep' : ''));  // the sleeping bar, labeled only when it is long enough to hold the text
              k.push(T(X(e.t), 78, e.why === 'timer' ? 'timer' : 'notify', { 'text-anchor': 'middle', 'font-weight': 800, style: e.why === 'timer' ? 'fill:var(--warn)' : 'fill:var(--ok)' }));  // what ended the wait, above its end: timer (warning color) or notify (green)
              if (e.res === 'take') k.push(...bar(e.t, e.t + 2.5, 84, 38, 's-ok', 'takes a ✓'));  // if C took the item, a green "takes a" bar follows
              if (e.res === 'bug') k.push(...bar(e.t, e.t + 3.5, 84, 38, 's-bad', 'takes from empty!', 'fill:var(--bad)'));  // if C took from an empty buffer, a red bug bar follows
            });  // ends the loop over waits
            if (r.stranded) k.push(...bar(r.ws, END, 84, 38, 's-os', 'asleep ... forever: nothing will ever wake C', 'fill:var(--bad)'));  // if nothing will ever wake C, a red bar says it sleeps forever
            // buffer lane
            k.push(T(12, 152, 'Buffer', { 'font-weight': 800 }));  // buffer lane label
            if (r.bug != null) k.push(...bar(0, r.bug, 134, 26, 's-panel', 'empty'), ...bar(r.bug, ITEM, 134, 26, 's-bad', ITEM - r.bug >= 3 ? 'count = −1' : '−1', 'fill:var(--bad)'),  // after the bug: empty until the bug, then count -1 in red until a arrives
              ...bar(ITEM, END, 134, 26, 's-bad', 'a stored, yet count = 0: the monitor’s data is now corrupt', 'fill:var(--bad)'));  // then a red bar saying the monitor's data is now corrupt, since a was stored yet count is 0
            else {  // no bug
              k.push(...bar(0, ITEM, 134, 26, 's-panel', 'empty'));  // the buffer is empty until the producer stores a
              const until = r.got != null ? r.got : END;  // until is when C takes the item, or the end of the timeline if it never does
              k.push(...bar(ITEM, until, 134, 26, 's-mem', r.stranded ? 'item a sits here unused' : until - ITEM >= 1 ? 'a' : ''));  // a sits in the buffer until then; if C is stranded, a note says the item sits unused
              if (r.got != null) k.push(...bar(r.got, END, 134, 26, 's-panel', 'empty'));  // after C takes it, the buffer is empty again
            }  // ends the buffer lane
            svg.replaceChildren(...k.filter(Boolean));  // replaces the whole drawing (skipping empty label slots)
          }  // ends draw()
          const sayTxt = h('div');  // sayTxt holds the explanation of the result
          const stats = h('div', { class: 'row gap-s', style: { marginTop: 'auto' } });  // stats holds the result chips, pushed to the bottom of the card
          const say = h('div', { class: 'card grow stack gap-s' }, sayTxt, stats);  // say is the explanation card: text above, chips below
          const stat = (label, val, cls) => h('span', { class: 'chip ' + (cls || '') }, h('span', { class: 'xs muted', style: { marginRight: '5px' } }, label), val);  // stat(label, val, cls): a chip with a small label and a value
          function update() {  // update(): reruns the simulation and redraws everything; runs on load and whenever a setting changes
            const r = run();  // r is the simulated outcome
            draw(r);  // draws the timeline
            const late = r.got != null ? r.got - ITEM : null;  // late is how many ticks after the item arrived C took it, if it did
            const n = r.wasted, wk = n === 1 ? 'wake-up' : 'wake-ups';  // n is the number of wasted wake-ups; wk is the right plural of the word
            let msg;  // msg will hold the explanation
            if (r.bug != null) msg = `<b>Danger.</b> The watchdog woke C at t = ${r.bug}, before any item existed. With <code>if</code> there is no re-test, so C goes straight on and takes from an empty buffer. A watchdog is only safe because Mesa waiters loop with <code>while</code>.`;  // bug: the watchdog woke C too early, and with if C took from an empty buffer
            else if (r.stranded) msg = '<b>Stranded.</b> The producer stored <b>a</b> but never called <code>cnotify</code>, and C has no time limit. Nobody will ever tell C, so it sleeps forever next to the very item it wants. Give the wait a watchdog limit.';  // stranded: no notify and no time limit, so C sleeps forever next to the item
            else if (!notify) msg = `<b>Rescued by the watchdog.</b> The producer forgot <code>cnotify</code>, but the timer woke C every ${W} ticks. ` + (n ? `${n} early ${wk} found <code>count == 0</code>, so the <code>while</code> loop sent C back to sleep. ` : '') + `At t = ${r.got} the re-test finds item a and C takes it, ${late} tick${late === 1 ? '' : 's'} late. A missing notify cost a delay, not a stuck process.` + (test === 'if' ? ' (With <code>if</code> this only worked by luck: pick a shorter limit and it breaks.)' : '');  // rescued: the watchdog woke C until the re-test found the item; with if this worked only by luck
            else if (n) msg = `The notify wakes C at t = 8 as usual. Before that the watchdog fired ${n} time${n === 1 ? '' : 's'} too early; each time the <code>while</code> re-test found <code>count == 0</code> and C went back to sleep. Harmless, just a little wasted work. A shorter limit means more wasted wake-ups; a longer one means a longer delay if a notify is ever missed.`;  // early wake-ups before the normal notify, each harmless thanks to the while re-test
            else msg = 'The normal case. The producer’s <code>cnotify</code> wakes C at t = 8; its re-test finds <code>count == 1</code> and it takes item a at once.' + (W ? ' The watchdog never fired early, so it cost nothing.' : ' Now make the producer forget its notify.');  // the normal case: the notify wakes C at t = 8 and it takes the item
            sayTxt.innerHTML = msg;  // shows the explanation
            stats.replaceChildren(  // rebuilds the result chips
              stat('C gets item a:', r.got != null ? 't = ' + r.got : 'never', r.got != null ? 'ok' : 'bad'),  // chip: when C got item a, or never
              stat('late by:', late != null ? late + ' tick' + (late === 1 ? '' : 's') : '—'),  // chip: how late
              stat('wasted wake-ups:', String(n), n ? 'warn' : ''),  // chip: wasted wake-ups
              stat('outcome:', r.bug != null ? 'wrong: count = −1' : r.stranded ? 'stranded forever' : 'correct', r.bug != null || r.stranded ? 'bad' : 'ok'));  // chip: the outcome, correct, wrong or stranded
          }  // ends update()
          const segN = ctx.ui.seg([{ value: true, label: 'Producer calls cnotify' }, { value: false, label: 'Producer forgets it (bug)' }], notify, (v) => { notify = v; update(); });  // buttons: the producer calls cnotify, or forgets it
          const slider = ctx.ui.slider({ label: 'Watchdog limit', min: 0, max: 12, step: 2, value: W, format: (v) => (v ? v + ' ticks' : 'off'), onInput: (v) => { W = v; update(); } });  // slider: the watchdog limit, 0 (off) to 12 ticks in steps of 2
          const segT = ctx.ui.seg([{ value: 'while', label: 'while' }, { value: 'if', label: 'if' }], test, (v) => { test = v; update(); });  // buttons: C re-tests with while or with if
          update();  // draws the first result when the page loads
          el.append(h('div', { class: 'stack fill' },  // page layout: one column that fills the page
            h('p', { class: 'm0', html: 'What if a producer <b>forgets</b> its <code>cnotify</code>? Under Mesa rules a wait may carry a <span class="t">watchdog timer</span>: once the limit passes, the waiter is made ready anyway and re-tests. Consumer C starts waiting at t = 1; the producer stores item a at t = 8.' }),  // intro paragraph: what if a producer forgets cnotify; a watchdog makes the waiter ready anyway
            h('div', { class: 'row', style: { gap: '16px' } }, segN, h('div', { style: { width: '270px' } }, slider), h('div', { class: 'row gap-s' }, h('span', { class: 'small b' }, 'C re-tests with'), segT)),  // the settings row: notify buttons, the slider in a 270px box, and the test buttons
            h('div', { class: 'card white', style: { padding: '6px 10px' } }, wide(ctx, svg, 1000)),  // the timeline on a white card (scrollable sideways on phones)
            h('div', { class: 'split', style: { gridTemplateColumns: 'minmax(0, 7fr) minmax(0, 5fr)' } },  // a split with the explanation card on the wider side
              say,  // the explanation card
              h('div', { class: 'card tight small' }, h('h4', { class: 'm0' }, 'Why Mesa-style monitors won'),  // a card listing why Mesa-style monitors won
                h('ul', { class: 'm0', html: '<li><b>Fewer process switches:</b> a notify never forces the notifier off the CPU.</li><li><b>Less error-prone:</b> every waiter re-tests, so an early, extra or stray wake-up (a timer, a broadcast, a mistaken notify) does no harm.</li><li><b>More modular:</b> a notifier only announces that something changed; it need not know who waits or what each one needs.</li>' })))));  // three reasons: fewer switches, less error-prone, more modular
        },  // ends render() for step 9
      },  // ends step 9
      /* ---------------- 10. Recap ---------------- */
      {  // opens step 10
        title: 'Recap: monitors in eight cards and one table',  // step 10 title: the recap in eight cards and one table
        kind: 'recap',  // kind 'recap': a review page, always on the core path
        render(el, ctx) {  // render() for step 10: builds the flip cards and the comparison table
          const { h } = ctx;  // only HTML elements are needed
          el.append(h('div', { class: 'stack fill' },  // page layout: one column that fills the page
            h('p', { class: 'm0 muted', html: 'Say each answer out loud before you flip the card.' }),  // instruction: say each answer out loud before flipping
            ctx.ui.flipcards([  // flip cards: a question on the front, the answer on the back
              ['What is a monitor?', 'A language construct: private data, the only procedures allowed to touch it, and start-up code. At most one process runs inside at a time.'],  // flip card: what a monitor is
              ['What does cwait(c) do?', 'Always suspends the caller on condition c and releases the monitor, so another process can enter.'],  // flip card: what cwait does
              ['csignal(c) with nobody waiting?', 'Nothing happens: the signal is lost. A semaphore would have remembered it in its count.'],  // flip card: what happens to a csignal with nobody waiting
              ['Who waits in the urgent queue?', 'A Hoare signaler that handed the monitor to the process it woke while it still had work left. It gets back in before any newcomer.'],  // flip card: who waits in the urgent queue
              ['Why while instead of if (Mesa)?', 'cnotify only means “worth a look”. Another process may get in first, so the waiter must re-test when it resumes.'],  // flip card: why Mesa waiters use while instead of if
              ['When is cbroadcast the right call?', 'When a change may satisfy several waiters, or you cannot tell which: e.g. memory freed for requests of different sizes.'],  // flip card: when cbroadcast is the right call
              ['When does csignal cost 2 extra switches?', 'When the Hoare signaler still has work inside: one switch parks it in the urgent queue, one resumes it. If csignal is its last statement, it can just leave.'],  // flip card: when csignal costs two extra switches
              ['What does a watchdog timer add?', 'A time limit on a Mesa wait. When it expires the waiter is made ready and re-tests, so a forgotten notify costs a delay, not a process stuck forever.'],  // flip card: what a watchdog timer adds
            ], { cols: 4, height: 128 }),  // laid out in four columns, each card 128px tall
            h('table', { class: 'tbl compact', html: `${/* the Hoare-versus-Mesa comparison table, written as HTML */''}
              <tr><th></th><th>Hoare monitor (csignal)</th><th>Mesa monitor (cnotify, cbroadcast)</th></tr>${/* table header row: the two kinds of monitor */''}
              <tr><td class="b">After a signal</td><td>The woken process runs <b>immediately</b>; a signaler with work left waits in the urgent queue</td><td>The signaler <b>keeps running</b>; the waiter resumes at some later, convenient time</td></tr>${/* table row: what happens right after a signal */''}
              <tr><td class="b">Waiter’s test</td><td><code>if</code> is enough: the condition is guaranteed</td><td><code>while</code> is required: re-test after every wake-up</td></tr>${/* table row: whether the waiter's test can be if or must be while */''}
              <tr><td class="b">Cost</td><td>2 extra process switches if the signaler is not finished</td><td>No extra switches, just a cheap re-test</td></tr>${/* table row: the cost in process switches */''}
              <tr><td class="b">Scheduling</td><td>Must be perfectly reliable</td><td>Tolerant: a stray, early or broadcast notify is harmless</td></tr>${/* table row: how reliable the scheduling must be */''}
              <tr><td class="b">Extras</td><td>None</td><td><code>cbroadcast</code> wakes all waiters; optional watchdog timer on waits</td></tr>` })));  // table row: the extras Mesa adds; ends the table text
        },  // ends render() for step 10
      },  // ends step 10
      /* ---------------- 11. Check yourself ---------------- */
      {  // opens step 11, the section quiz
        title: 'Check yourself: monitors',  // step 11 title
        kind: 'check',  // kind 'check': the quiz page whose first-try score counts toward mastery
        quiz: [  // quiz: the questions; the shell's quiz engine draws them, checks answers and shows feedback
          { q: 'Which guarantee does a monitor give automatically, without the programmer writing any lock calls?',  // question 1 (multiple choice): which guarantee a monitor gives automatically
            choices: ['At most one process is executing inside the monitor at any moment', 'Processes enter the monitor in priority order', 'A signal sent while nobody waits is saved for later', 'Waiting processes never need to re-check their condition'], answer: 0,  // the four choices; the first (one process inside at a time) is correct
            feedback: [null, 'Monitors give mutual exclusion, not priority ordering: callers simply wait in the entrance queue.', 'That describes a semaphore. A csignal with no waiter is lost.', 'That depends on the rules in use: under Mesa rules a woken process must re-check.'],  // feedback for each wrong choice: no priority order, signals are not saved, and Mesa waiters must re-check
            why: 'Mutual exclusion is built in. A process can enter only by calling one of the monitor’s procedures, and only one process may be executing inside at a time.' },  // explanation: mutual exclusion is built in, through procedure-only entry and one process inside
          { type: 'num', q: 'No process is waiting on condition variable <code>c</code>. Three processes call <code>csignal(c)</code>, one after another. Then four processes each call <code>cwait(c)</code>. How many of those four end up suspended?', answer: 4, tol: 0, unit: 'processes',  // question 2 (calculate): three signals with nobody waiting, then four waits; how many are suspended? (answer 4)
            why: 'A condition variable keeps no count, so all three signals found nobody waiting and were lost; every one of the four <code>cwait</code> calls suspends. A semaphore starting at 0 would have saved the three signals (count = 3), so only the fourth <code>semWait</code> would block.' },  // explanation: a condition keeps no count, so the signals were lost; a semaphore would have saved them
          { type: 'multi', q: 'Which statements about <code>cwait(c)</code> are true?',  // question 3 (select all): which statements about cwait are true
            choices: ['It always suspends the calling process', 'It releases the monitor so another process can enter', 'It tests a counter and returns at once if the counter is positive', 'Monitor code normally checks its own data (such as count) before calling it'], answer: [0, 1, 3],  // the four statements; the correct set is always suspends, releases the monitor, and code checks its data first
            why: '<code>cwait</code> is unconditional: it suspends the caller on c and frees the monitor. Because it tests nothing, monitor code checks its own variables first and calls <code>cwait</code> only when it really must wait.' },  // explanation: cwait is unconditional, so monitor code tests its own variables before calling it
          { type: 'match', q: 'Match each part of a monitor to its job.',  // question 4 (match the pairs): each part of a monitor with its job
            pairs: [['Entrance queue', 'Callers waiting to get in while someone is inside'], ['Condition queue', 'Processes suspended by cwait on one condition'], ['Urgent queue', 'Hoare signalers waiting to get back in'], ['Local data', 'Variables that only the monitor’s procedures can touch'], ['Initialization code', 'Sets the starting state once, when the monitor is created']],  // the five pairs: entrance queue, condition queue, urgent queue, local data, initialization code
            why: 'The entrance queue enforces one-at-a-time entry, each condition variable has its own queue, the urgent queue holds Hoare signalers, and the local data and initialization code live privately inside the module.' },  // explanation: what each queue holds and why the data and start-up code are private
          { type: 'order', q: 'In a Hoare monitor, process Q waits on condition <code>c</code>. Process P later signals <code>c</code> while it still has work left inside the monitor. Put the events in order.',  // question 5 (put in order): the events of a Hoare signal from a process that still has work left
            items: ['Q calls cwait(c): it is suspended and the monitor is released', 'P enters the monitor and calls csignal(c)', 'Q resumes inside the monitor at once, while P waits in the urgent queue', 'Q returns from its procedure and leaves the monitor', 'P re-enters from the urgent queue, ahead of any newcomers', 'P finishes its remaining work and leaves'],  // the six events in their correct order; the quiz shuffles them for the student
            why: 'Hoare rules hand the monitor straight to the woken process and park an unfinished signaler in the urgent queue. When the woken process leaves, the urgent queue is served before the entrance queue, so P gets back in first.' },  // explanation: the woken process runs at once and the urgent queue is served before the entrance queue
          { type: 'num', q: 'Under Hoare rules, a process signals a condition (and someone is waiting) while it still has more work to do inside the monitor. How many extra process switches does that signal cause?', answer: 2, tol: 0, unit: 'switches',  // question 6 (calculate): how many extra switches an unfinished Hoare signaler causes (answer 2)
            why: 'One switch suspends the signaler so the woken process can run at once, and a second one resumes the signaler later. A Mesa-style <code>cnotify</code> causes neither.' },  // explanation: one switch to suspend the signaler, one to resume it; a Mesa notify causes neither
          { q: 'In a Mesa (Lampson/Redell) monitor, why should a consumer write <code>while (count == 0) cwait(notempty);</code> rather than <code>if</code>?',  // question 7 (multiple choice): why Mesa consumers must use while instead of if
            choices: ['cnotify only makes the waiter ready, and another process may change count before the waiter runs again', 'A while loop makes the consumer run faster', 'Mesa monitors do not provide mutual exclusion', 'cwait returns immediately in Mesa monitors'], answer: 0,  // the four choices; the first is correct
            feedback: [null, 'The loop adds a re-test; it is about correctness, not speed.', 'Mesa monitors still allow only one process inside at a time.', 'cwait still suspends the caller; the question is what is true once it resumes.'],  // feedback for each wrong choice: it is about correctness not speed, mutual exclusion still holds, and cwait still suspends
            why: 'Between the notify and the moment the waiter gets the monitor back, a third process can slip in and take the item. Only a re-test catches that.' },  // explanation: a third process can slip in between the notify and the waiter's return, and only a re-test catches it
          { type: 'bucket', q: 'Hoare-style or Mesa-style monitor?', buckets: ['Hoare (csignal)', 'Mesa (cnotify)'],  // question 8 (sort into groups): Hoare-style or Mesa-style, with its two groups
            items: [['An unfinished signaler steps aside into an urgent queue', 0], ['The signaler keeps running after it signals', 1], ['A waiter can safely use if', 0], ['A waiter must re-test with while', 1], ['Needs perfectly reliable scheduling', 0], ['Offers broadcast and wait timeouts', 1]],  // the six items, each tagged with its correct group (0 Hoare, 1 Mesa)
            why: 'Hoare signals hand the monitor over at once, which makes if safe but costs switches and demands reliable scheduling. Mesa notifies are hints, so waiters loop, and broadcast and timeouts become safe additions.' },  // explanation: Hoare's hand-off makes if safe but costs switches; Mesa's notifies are hints, so waiters loop
          { q: 'A memory manager frees a block. Several processes are waiting for blocks of different sizes. Why is <code>cbroadcast</code> a better choice than <code>cnotify</code>?',  // question 9 (multiple choice): why a memory manager should broadcast rather than notify
            choices: ['The manager cannot tell which waiters can now proceed, so it wakes them all and each re-tests', 'cbroadcast hands the memory to the largest request first', 'cbroadcast guarantees every waiting process gets its memory', 'cnotify would wake all of them anyway'], answer: 0,  // the four choices; the first is correct
            feedback: [null, 'Broadcast chooses nobody: each woken process checks its own request.', 'Only requests that still fit succeed; the others go back to sleep.', 'cnotify wakes just one waiter.'],  // feedback for each wrong choice: broadcast picks nobody, it does not guarantee memory, and cnotify wakes only one
            why: 'Waking a single waiter may pick one that still does not fit, leaving memory idle while others could run. Broadcasting lets every waiter re-test: those that fit proceed, the rest sleep again.' },  // explanation: waking one waiter might pick one that does not fit, leaving memory idle
          { type: 'tf', q: 'A watchdog timer on a Mesa-style wait lets a process resume after a time limit even if no notify arrives, and this is safe because the process re-tests its condition.', answer: true,  // question 10 (true or false): a watchdog timer is safe because the waiter re-tests (true)
            why: 'Since Mesa waiters always re-check with while, waking early does no harm. The timer turns a forgotten notify into a delay instead of a process stuck forever.' },  // explanation: early wake-ups do no harm with while, and a forgotten notify becomes a delay
          { type: 'num', q: 'A bounded buffer has N = 5 slots, and <code>nextin</code> is 4. After one more <code>append</code>, what is <code>nextin</code>?', answer: 0, tol: 0,  // question 11 (calculate): nextin after one more append with N = 5 and nextin = 4 (answer 0)
            why: '<code>nextin = (4 + 1) % 5 = 0</code>: the index wraps around to the first slot, so the array is used as a ring.' },  // explanation: (4 + 1) % 5 is 0, so the index wraps around to the first slot
          { q: 'Semaphores can already solve any synchronization problem. Why were monitors introduced?',  // question 12 (multiple choice): why monitors were introduced when semaphores already work
            choices: ['Semaphore calls end up scattered across many processes, so one misplaced call is easy to make and hard to find', 'Semaphores cannot solve the producer/consumer problem', 'Monitors always run faster than semaphores', 'Semaphores work only on single-processor machines'], answer: 0,  // the four choices; the first is correct
            feedback: [null, 'Semaphores can solve it with care; monitors are equally powerful, not more powerful.', 'Speed is not the point: monitors make correct code easier to write and check.', 'Semaphores work on multiprocessors too.'],  // feedback for each wrong choice: semaphores can solve it, speed is not the point, and semaphores work on multiprocessors
            why: 'A monitor gathers the shared data and all of its synchronization into one module, so correctness is easier to control and verify.' },  // explanation: a monitor gathers the data and all its synchronization into one module that is easier to verify
        ],  // closes the quiz list
      },  // ends step 11
    ],  // closes the steps list

    notes: `${/* notes: the printable summary of this section, written as HTML; it appears in the notes drawer and the print view */''}
<h3>Why monitors?</h3>${/* notes heading: why monitors */''}
<p>Semaphores can solve any synchronization problem, but every process must call <code>semWait</code> and <code>semSignal</code> in exactly the right places. For a bounded buffer shared by 2 producers and 2 consumers that means 16 calls spread over 4 processes (4 each; semaphore s guards the buffer, n counts items, e counts empty slots). Swap one pair, say a consumer taking s before n, and an empty buffer causes <b>deadlock</b>: the consumer sleeps on n while holding s, so no producer can get in. A <b>monitor</b> is a programming-language construct with the same power that is far easier to control: the shared data and all code touching it live in one module, and the language enforces mutual exclusion. Monitors are built into Concurrent Pascal, Pascal-Plus, Modula-2, Modula-3 and Java.</p>${/* notes paragraph: 16 scattered semaphore calls, how one swap deadlocks, and how a monitor moves the job into the language */''}

<h3>Structure of a monitor</h3>${/* notes heading: the structure of a monitor */''}
<p>A software module made of <b>local data</b>, one or more <b>procedures</b>, and an <b>initialization sequence</b> that runs once when the monitor is created. Three characteristics define it:</p>${/* notes paragraph: local data, procedures and an initialization sequence, plus three defining characteristics */''}
<ol>${/* starts the numbered list of the three characteristics */''}
<li><b>Private data:</b> only the monitor's own procedures can access the local data.</li>${/* characteristic 1: private data */''}
<li><b>One way in:</b> a process enters only by calling one of its procedures.</li>${/* characteristic 2: one way in, through a procedure */''}
<li><b>One at a time:</b> only one process may be executing inside; other callers wait. Mutual exclusion comes for free.</li>${/* characteristic 3: one process inside at a time */''}
</ol>${/* ends the numbered list */''}
<ul>${/* starts the list of the monitor's queues */''}
<li><b>Entrance queue:</b> callers blocked because another process is inside.</li>${/* the entrance queue */''}
<li><b>Condition queues:</b> one per condition variable, holding processes suspended by <code>cwait</code>. They do not count as being inside.</li>${/* the condition queues, one per condition variable */''}
<li><b>Urgent queue</b> (Hoare): signalers that still have work to do, parked after handing the monitor to the process they woke. When the monitor frees up, it is served before the entrance queue.</li>${/* the urgent queue of the Hoare rules, served before the entrance queue */''}
</ul>${/* ends the list of queues */''}

<h3>cwait, csignal and the lost signal</h3>${/* notes heading: cwait, csignal and the lost signal */''}
<p><b>Condition variables</b> are named waiting lines that exist only inside the monitor. <b>cwait(c)</b> always suspends the caller on c and releases the monitor. It tests nothing, so code checks its own data first: <code>if (count == 0) cwait(notempty);</code>. <b>csignal(c)</b> resumes one process waiting on c; if none is waiting, nothing happens and the signal is <b>lost</b>. A semaphore instead remembers signals in its count. Example: with nobody waiting, 3 <code>csignal(c)</code> calls followed by 4 <code>cwait(c)</code> calls leave all <b>4</b> suspended; with a semaphore starting at 0, the 3 signals are saved (count = 3) and only 1 of 4 <code>semWait</code> calls blocks. In correct monitor code a lost signal is harmless, because a later arrival checks the variables itself.</p>${/* notes paragraph: condition variables, the lost signal, and the 3 signals then 4 waits worked example */''}

<h3>The bounded buffer as a monitor</h3>${/* notes heading: the bounded buffer as a monitor */''}
<p>N slots used as a ring: <code>nextin</code> is the next slot to fill, <code>nextout</code> the next to empty, <code>count</code> the number of full slots. Producers wait on <code>notfull</code>, consumers on <code>notempty</code>.</p>${/* notes paragraph: the ring of N slots, the two indexes, count, and the two conditions */''}
<pre>monitor boundedbuffer;${/* shown code, line 1 of the compact monitor: its declaration */''}
char buffer[N];  int nextin, nextout, count;${/* shown code, line 2: the buffer and its three variables */''}
cond notfull, notempty;${/* shown code, line 3: the two condition variables */''}
void append(char x) {${/* shown code, line 4: append() header */''}
  if (count == N) cwait(notfull);  /* full: sleep */${/* shown code, line 5: if full, sleep on notfull */''}
  buffer[nextin] = x;              /* store item */${/* shown code, line 6: store the item */''}
  nextin = (nextin + 1) % N;       /* advance, wrap */${/* shown code, line 7: advance nextin with wrap-around */''}
  count++;                         /* one more item */${/* shown code, line 8: one more item */''}
  csignal(notempty);               /* wake a consumer */${/* shown code, line 9: wake a consumer */''}
}${/* shown code, line 10: end of append() */''}
void take(char &amp;x) {${/* shown code, line 11: take() header */''}
  if (count == 0) cwait(notempty); /* empty: sleep */${/* shown code, line 12: if empty, sleep on notempty */''}
  x = buffer[nextout];             /* oldest item */${/* shown code, line 13: copy out the oldest item */''}
  nextout = (nextout + 1) % N;     /* advance, wrap */${/* shown code, line 14: advance nextout with wrap-around */''}
  count--;                         /* one fewer item */${/* shown code, line 15: one fewer item */''}
  csignal(notfull);                /* wake a producer */${/* shown code, line 16: wake a producer */''}
}${/* shown code, line 17: end of take() */''}
{ nextin = 0; nextout = 0; count = 0; }  /* init */</pre>${/* shown code, line 18: the initialization block; ends the code block */''}
<p>Producers loop <code>produce(x); append(x);</code> and consumers loop <code>take(x); consume(x);</code> with no synchronization of their own. <b>Ring index:</b> with N = 5 and <code>nextin = 4</code>, the next append stores into slot 4 and sets <code>nextin = (4 + 1) % 5 = 0</code>. <b>Traced run</b> (N = 3, Hoare): P1-P3 fill slots 0-2 (their signals are lost; nextin wraps to 0); P4 waits on <code>notfull</code>; C1 takes a and signals <code>notfull</code>, so P4 takes over at once while C1 waits in the urgent queue.</p>${/* notes paragraph: the producer and consumer loops, the ring index example, and a short traced run with N = 3 */''}

<h3>Hoare monitors and their drawbacks</h3>${/* notes heading: Hoare monitors and their drawbacks */''}
<p>Hoare's <code>csignal</code> hands the monitor <b>immediately</b> to the woken process, so its condition is guaranteed to hold and <code>if</code> is enough. The signaler must either leave at once (possible when csignal is its last statement) or wait in the urgent queue. Two drawbacks:</p>${/* notes paragraph: the immediate hand-off makes if enough; the signaler must leave or wait in the urgent queue */''}
<ol>${/* starts the numbered list of drawbacks */''}
<li><b>Extra process switches:</b> if the signaler has not finished, the signal costs <b>two</b> extra switches, one to suspend it and one to resume it, however much work is left. Example: with switches of 0.5 ticks, identical work ends at 11.5 under Hoare versus 10.5 under Mesa.</li>${/* drawback 1: two extra process switches for an unfinished signaler, with a timing example */''}
<li><b>Perfectly reliable scheduling:</b> the woken process must be the next one inside. If another gets in first, the condition may be false again.</li>${/* drawback 2: the scheduling must be perfectly reliable */''}
</ol>${/* ends the list of drawbacks */''}

<h3>Lampson/Redell (Mesa) monitors</h3>${/* notes heading: Mesa-style monitors */''}
<p>Mesa replaces csignal with <b>cnotify(x)</b>: a waiter on x becomes ready but the notifier keeps running. The waiter resumes at some later, convenient time, and others may enter first. Example: C1 waits on an empty buffer; P1 stores a, notifies and leaves; C2, already at the entrance, gets in first and takes a. With <code>if</code>, C1 then takes from an empty buffer (count = -1). The fix costs only a cheap re-test:</p>${/* notes paragraph: cnotify only makes a waiter ready, and the sneak-in example that breaks if */''}
<pre>while (count == 0) cwait(notempty);   /* consumer */${/* shown code: the consumer's while re-test */''}
while (count == N) cwait(notfull);    /* producer */</pre>${/* shown code: the producer's while re-test; ends the code block */''}
<p><b>cbroadcast(x)</b> makes every waiter on x ready, and each re-tests. Use it when one change may satisfy several waiters and the signaler cannot tell which. Example: 5 KB free, requests for 40, 10 and 25 KB wait; a release of 30 KB leaves 35 KB. cnotify wakes only the 40 KB request, which fails, so 35 KB sits idle; cbroadcast lets the 10 and 25 KB requests succeed. Broadcast is wasteful when only one waiter can benefit. POSIX threads (<code>pthread_cond_signal</code>, <code>pthread_cond_broadcast</code>) and Java (<code>notify</code>, <code>notifyAll</code>) follow Mesa rules.</p>${/* notes paragraph: cbroadcast, the memory worked example, and the thread libraries that follow Mesa rules */''}
<p><b>Watchdog timer:</b> a wait may carry a time limit; when it expires the waiter is made ready anyway and re-tests. Example: C waits from t = 1; a producer stores an item at t = 8 but forgets cnotify. No timer: C sleeps forever. Limit 2: C wakes at 3, 5 and 7 (count = 0, back to sleep) and takes the item at 9, 1 tick late. With <code>if</code>, the wake-up at 3 would take from an empty buffer, so timers are safe only with <code>while</code>.</p>${/* notes paragraph: the watchdog timer, with a worked example and why it is safe only with while */''}
<p><b>Advantages of Mesa:</b> fewer process switches; less error-prone (early, extra or stray wake-ups are harmless because every waiter re-tests); more modular (a notifier need not know who waits or why).</p>${/* notes paragraph: the three advantages of Mesa monitors */''}

<h3>Summary: Hoare vs Mesa</h3>${/* notes heading: the Hoare-versus-Mesa summary */''}
<table>${/* starts the summary table */''}
<tr><th></th><th>Hoare (csignal)</th><th>Mesa (cnotify, cbroadcast)</th></tr>${/* table header row */''}
<tr><td>After a signal</td><td>Woken process runs at once; an unfinished signaler waits (urgent queue)</td><td>Signaler keeps running; waiter resumes later</td></tr>${/* table row: what happens after a signal */''}
<tr><td>Waiter's test</td><td>if is enough</td><td>while is required</td></tr>${/* table row: the waiter's test */''}
<tr><td>Cost</td><td>2 extra switches if the signaler is not done</td><td>No extra switches, a cheap re-test</td></tr>${/* table row: the cost */''}
<tr><td>Scheduling</td><td>Must be perfectly reliable</td><td>Tolerant of extra or early wake-ups</td></tr>${/* table row: how reliable the scheduling must be */''}
<tr><td>Extras</td><td>None</td><td>cbroadcast; optional watchdog timer</td></tr>${/* table row: the extras */''}
</table>`,  // ends the table and the notes text
  });  // closes the section object passed to Guide.section
})();  // ends the wrapping function and runs it immediately
