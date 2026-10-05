// Comment key: a line inside backtick text ends with ${/* comment */''}, an empty-string slot that holds a comment without changing the text on screen (full note at the top of the page).
/* =====================================================================
   6.9 Solaris Thread Synchronization Primitives
   Original teaching material. Helpers shared by several steps live inside
   this IIFE (no globals).
   ===================================================================== */
(function () {  // wraps the whole section in a function that runs once, right away, so its helper names stay private to this file
  // Draws one rounded token (a thread or a waiter) with a centred label.
  function tok(s, x, y, label, cls, w = 46, h = 40, fs = 16) {  // tok(s, x, y, label, cls, w, h, fs): draws a rounded box centred at (x, y) with a bold label; w, h and fs default to 46, 40 and 16
    return s('g', {},  // returns an SVG group (g, a bundle of shapes that move together; SVG is the browser's drawing format) holding the box and the label
      s('rect', { x: x - w / 2, y: y - h / 2, width: w, height: h, rx: 10, class: cls || 's-thread', 'stroke-width': 2 }),  // the rounded rectangle, placed so (x, y) is its centre; cls picks its colour, the thread colour if none is given
      s('text', { x, y: y + fs * 0.36, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': fs }, label));  // the label, centred left to right and pushed down a little (0.36 of the font size) so it sits in the middle vertically
  }  // ends tok

  /* ---------- readers/writer lock engine (writer-preferring) ----------
     st = { writer: name|null, readers: [names], wW: [waiting writers], wR: [waiting readers] } */
  function rwNew() { return { writer: null, readers: [], wW: [], wR: [] }; }  // rwNew(): a fresh readers/writer lock with no writer, no readers and nobody waiting in either line
  function rwClone(st) { return { writer: st.writer, readers: st.readers.slice(), wW: st.wW.slice(), wR: st.wR.slice() }; }  // rwClone(st): an independent copy of a lock state, so the animation can keep a snapshot of every frame
  // After any release: a waiting writer goes first once the lock is completely free;
  // if no writer is waiting, every waiting reader is admitted together.
  function rwAdmit(st) {  // rwAdmit(st): after a release, lets in whoever the lock now admits, and returns the list of [name, mode] it let in
    const out = [];  // out collects the threads admitted this time, each written as [name, 'W' or 'R']
    if (!st.writer && !st.readers.length && st.wW.length) { st.writer = st.wW.shift(); out.push([st.writer, 'W']); }  // lock completely free and a writer waiting: the first waiting writer takes the lock alone
    else if (!st.writer && !st.wW.length && st.wR.length) { st.wR.splice(0).forEach((t) => { st.readers.push(t); out.push([t, 'R']); }); }  // otherwise, if no writer holds or waits, every waiting reader is moved into the readers list at once
    return out;  // hands back who got in, so the caption can name them
  }  // ends rwAdmit
  // rw_enter / rw_tryenter. Returns 'got', 'wait' or 'fail'.
  function rwEnter(st, t, mode, tryOnly) {  // rwEnter(st, t, mode, tryOnly): thread t asks for the lock as reader ('R') or writer ('W'); tryOnly makes it the never-wait version
    const can = mode === 'R' ? !st.writer && !st.wW.length : !st.writer && !st.readers.length;  // can: a reader may enter if no writer holds or waits; a writer may enter only if nobody holds the lock at all
    if (can) { if (mode === 'R') st.readers.push(t); else st.writer = t; return 'got'; }  // if allowed, t joins the readers or becomes the writer, and the call reports 'got'
    if (tryOnly) return 'fail';  // the try version gives up at once with 'fail' instead of waiting
    (mode === 'R' ? st.wR : st.wW).push(t);  // the waiting version puts t at the back of the waiting-readers or waiting-writers line
    return 'wait';  // and reports that t must wait
  }  // ends rwEnter
  function rwExit(st, t) {  // rwExit(st, t): thread t releases the lock, whichever mode it held it in
    if (st.writer === t) st.writer = null; else st.readers = st.readers.filter((x) => x !== t);  // a writer simply clears the writer slot; a reader is removed from the readers list
    return rwAdmit(st);  // then hands the lock on to any waiting thread that may now enter, and returns who got in
  }  // ends rwExit
  function rwDowngrade(st, t) {  // rwDowngrade(st, t): the writer t turns its write lock into a read lock without ever letting go
    st.writer = null; st.readers.push(t);  // t leaves the writer slot and joins the readers in the same step, so the lock is never free in between
    return st.wW.length ? [] : rwAdmit(st);  // with a writer waiting, nobody else is admitted (writers first); otherwise the waiting readers come in too
  }  // ends rwDowngrade
  // Succeeds only when the caller is the only reader and no writer is waiting.
  function rwTryUpgrade(st, t) {  // rwTryUpgrade(st, t): reader t tries to become the writer; it never waits
    if (st.readers.length === 1 && st.readers[0] === t && !st.wW.length) { st.readers = []; st.writer = t; return 'ok'; }  // only reader and no writer waiting: t leaves the readers list, becomes the writer, and the result is 'ok'
    return st.readers.length > 1 ? 'readers' : 'writer';  // otherwise reports why it failed: 'readers' if others are reading too, 'writer' if a writer is waiting
  }  // ends rwTryUpgrade

  /* Draws a readers/writer lock state into svg: who holds it (and in which mode) and who waits.
     slim = the phone layout (viewBox 0 0 360 300); otherwise viewBox 0 0 560 206. */
  function rwDraw(s, svg, st, slim) {  // rwDraw(s, svg, st, slim): redraws the lock picture in svg from the state st; slim is true on phone-width screens
    const G = slim  // G holds every position and size for the drawing, picked once for the chosen layout
      ? { hold: [6, 28, 348, 120], holdT: [180, 18], mode: [180, 50], tokY: 98, tokW: 60, tokH: 46, tokGap: 80, sub: 138,  // phone layout: the box of current holders, its title, mode line, token size and spacing, and the sub-caption height
        ww: [6, 186, 170, 100], wr: [184, 186, 170, 100], wT: 178, wY: 236, wx: (b, i) => b[0] + 30 + i * 56, wW: 46, wH: 40 }  // phone layout continued: the two waiting boxes side by side below, their title row, token row and spacing
      : { hold: [8, 30, 262, 168], holdT: [139, 20], mode: [139, 60], tokY: 120, tokW: 54, tokH: 50, tokGap: 62, sub: 178,  // desktop layout: the holders box on the left with its title, mode line, token size and spacing
        ww: [290, 30, 262, 70], wr: [290, 132, 262, 70], wT: null, wY: null, wx: (b, i) => b[0] + 42 + i * 62, wW: 50, wH: 44 };  // desktop layout continued: the two waiting boxes stacked on the right; wT and wY are null so their titles sit just above each box
    const k = [], b = G.hold, cx = b[0] + b[2] / 2, nR = st.readers.length;  // k collects the shapes; b is the holders box; cx is its centre line; nR is how many readers hold the lock
    k.push(s('text', { x: G.holdT[0], y: G.holdT[1], 'text-anchor': 'middle', 'font-weight': 700, 'font-size': 15 }, 'holding readers/writer lock rw'));  // title above the holders box
    k.push(s('rect', { x: b[0], y: b[1], width: b[2], height: b[3], rx: 16, class: 's-os', 'stroke-width': 2.5 }));  // the holders box itself, drawn in the operating-system colour
    const mode = st.writer ? 'WRITE mode: one writer, alone' : nR ? `READ mode: ${nR} reader${nR > 1 ? 's sharing' : ''}` : 'free';  // mode: one line saying whether the lock is in write mode, read mode (and with how many readers), or free
    k.push(s('text', { x: cx, y: G.mode[1], 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800, style: `fill:var(${st.writer ? '--io' : nR ? '--cpu' : '--muted'})` }, mode));  // writes that line in the box, coloured like the holders (I/O colour for the writer, processor colour for readers, grey if free)
    const holders = st.writer ? [[st.writer, 's-io']] : st.readers.map((r) => [r, 's-cpu']);  // holders: the writer alone, or every reader, each paired with its colour class
    holders.forEach(([n, cls], i) => k.push(tok(s, cx - (holders.length - 1) * G.tokGap / 2 + i * G.tokGap, G.tokY, n, cls, G.tokW, G.tokH, 18)));  // draws one token per holder, spaced evenly and centred in the box
    if (holders.length) k.push(s('text', { x: cx, y: G.sub, 'text-anchor': 'middle', class: 's-sub', 'font-size': 13 }, st.writer ? 'writing: nobody else may be inside' : nR > 1 ? 'reading together; no writer inside' : 'reading; no writer inside'));  // a small line under the tokens explains what the holders may do right now
    [[G.ww, st.wW, 'waiting to write', 's-io'], [G.wr, st.wR, 'waiting to read', 's-cpu']].forEach(([bx, q, label, cls]) => {  // draws the two waiting areas in turn: writers waiting to write, then readers waiting to read
      k.push(s('text', { x: bx[0] + bx[2] / 2, y: G.wT || bx[1] - 9, 'text-anchor': 'middle', 'font-weight': 700, 'font-size': 14 }, label));  // the title of this waiting area
      k.push(s('rect', { x: bx[0], y: bx[1], width: bx[2], height: bx[3], rx: 14, class: 's-panel', 'stroke-width': 2 }));  // the waiting area's box
      const y = G.wY || bx[1] + bx[3] / 2;  // y: the height of the token row inside this box
      if (!q.length) k.push(s('text', { x: bx[0] + bx[2] / 2, y: y + 5, 'text-anchor': 'middle', class: 's-sub', 'font-size': 14 }, 'nobody'));  // an empty line shows the word nobody
      q.forEach((n, i) => { const g = tok(s, G.wx(bx, i), y, n, cls, G.wW, G.wH, 16); g.setAttribute('opacity', '0.75'); k.push(g); });  // each waiting thread gets a token, drawn slightly faded (opacity 0.75) to show it is not inside yet
    });  // ends the loop over the two waiting areas
    svg.replaceChildren(...k);  // swaps everything in the picture for the new shapes in one go
  }  // ends rwDraw

  Guide.section({  // registers this section with the guide; the object below holds everything the section shows
    id: '6.9',  // the section number, used in links, the progress list and saved progress
    title: 'Solaris Thread Synchronization Primitives',  // the full title shown at the top of every step
    short: 'Solaris primitives',  // the short name used in the side menu and progress list
    summary: 'Solaris gives threads four tools: mutex locks, semaphores, readers/writer locks and condition variables.',  // one-sentence summary shown on the chapter page
    objectives: [  // what the student should be able to do after this section, shown on its first page
      'Name the four Solaris thread synchronization primitives and describe the shared synchronization object each one creates.',  // objective 1: name the four primitives and their shared objects
      'Trace mutex_enter, mutex_exit and mutex_tryenter, and explain spinning, sleeping on a turnstile and the adaptive mutex.',  // objective 2: trace the mutex calls and explain spinning, sleeping and the adaptive mutex
      'Predict the effect of sema_p, sema_v and sema_tryp, and of the readers/writer operations, including rw_downgrade and rw_tryupgrade.',  // objective 3: predict the semaphore and readers/writer calls, downgrade and upgrade included
      'Explain how cv_wait releases and reacquires its mutex, and why the waiting thread must re-test its condition in a while loop.',  // objective 4: how cv_wait gives up and takes back its mutex, and why the test sits in a while loop
      'Choose the right primitive for a given sharing problem.',  // objective 5: choosing the right tool for a sharing problem
    ],  // closes the objectives list
    terms: [  // key terms for the glossary, each written as [term, definition]
      ['Synchronization object', 'The small data structure in memory that is created when a Solaris lock, semaphore or condition variable is initialized. Every thread that uses the primitive works on this one shared object.'],  // glossary entry: synchronization object
      ['Mutex lock', 'The Solaris lock that lets only one thread at a time hold it. The thread that acquired it is its owner, and only the owner may release it.'],  // glossary entry: mutex lock and its owner
      ['mutex_enter', 'Acquire a mutex lock. If another thread holds it, the caller waits (by spinning or sleeping) until it is released.'],  // glossary entry: mutex_enter
      ['mutex_exit', 'Release a mutex lock you own. If threads are waiting for it, one of them can now acquire it.'],  // glossary entry: mutex_exit
      ['Try operation', 'The non-blocking version of an acquire call, such as mutex_tryenter, sema_tryp, rw_tryenter or rw_tryupgrade. It succeeds only if it can do so at once; otherwise it reports failure immediately and the caller keeps running.'],  // glossary entry: try operation (the never-wait calls)
      ['Turnstile', 'A Solaris kernel queue on which threads that are blocked on a mutex lock or a readers/writer lock sleep, ordered by priority, until the lock is released.'],  // glossary entry: turnstile
      ['Adaptive mutex', 'A Solaris kernel mutex that chooses how to wait each time: it spins while the owner is running on another processor, and sleeps on a turnstile when the owner is not running.'],  // glossary entry: adaptive mutex
      ['sema_p', 'Solaris semaphore wait. If the count is above 0, subtract 1 and continue; if it is 0, sleep until a sema_v makes a unit available.'],  // glossary entry: sema_p
      ['sema_v', 'Solaris semaphore signal. Add 1 to the count; if threads are sleeping on the semaphore, wake one, which takes that unit when it runs (if another sema_p took it first, it sleeps again).'],  // glossary entry: sema_v
      ['Readers/writer lock', 'A lock with two modes: any number of threads may hold it together as readers, or exactly one thread may hold it as a writer, never both at once.'],  // glossary entry: readers/writer lock
      ['rw_enter', 'Acquire a readers/writer lock as a reader (RW_READER) or as a writer (RW_WRITER), waiting if that mode is not available right now.'],  // glossary entry: rw_enter
      ['rw_exit', 'Release a readers/writer lock held in either mode. When the writer or the last reader leaves, waiting threads can be admitted.'],  // glossary entry: rw_exit
      ['rw_downgrade', 'Turn the write lock you hold into a read lock without ever letting go of the lock. Under the classic Solaris rule, waiting writers keep waiting, and only if no writer is waiting are the waiting readers admitted as well.'],  // glossary entry: rw_downgrade
      ['rw_tryupgrade', 'Try to turn the read lock you hold into a write lock. It succeeds only if you are the only reader and no writer is waiting; otherwise it fails at once and you still hold your read lock.'],  // glossary entry: rw_tryupgrade
      ['cv_wait', 'Condition-variable wait: in one atomic step, release the given mutex and go to sleep on the condition variable; when woken, reacquire the mutex before returning.'],  // glossary entry: cv_wait
      ['cv_signal', 'Wake one thread that is sleeping on a condition variable. If no thread is waiting, nothing happens and nothing is remembered.'],  // glossary entry: cv_signal, including that an unheard signal is lost
      ['cv_broadcast', 'Wake every thread that is sleeping on a condition variable. Each one reacquires the mutex in turn and re-tests its own condition.'],  // glossary entry: cv_broadcast
      ['Spurious wakeup', 'A return from a wait that finds the condition being waited for not true: no thread made it true, or another thread got to the data first and made it false again. Re-testing the condition in a while loop handles it.'],  // glossary entry: spurious wakeup
    ],  // closes the key terms list
    css: ` /* style rules used only by this section; every selector starts with .sec-6-9 so it cannot affect other sections */
      .sec-6-9 .narr { background: var(--panel-2); border: 1px solid var(--line); border-left: 5px solid var(--chc); border-radius: 12px; padding: 9px 13px; font-size: 15.5px; line-height: 1.45; } /* .narr: the narration box that explains each click, a soft panel with a thick left bar in the chapter colour */
      .sec-6-9 .narr.bad { border-left-color: var(--bad); background: var(--bad-bg); } /* a narration about a mistake or a hang turns red */
      .sec-6-9 .narr.ok { border-left-color: var(--ok); background: var(--ok-bg); } /* a narration about a success turns green */
      .sec-6-9 .narr.warn { border-left-color: var(--warn); background: var(--warn-bg); } /* a narration about a thread having to wait turns amber */
      .sec-6-9 .log { font-size: 13px; } /* keeps the running event log in small print so many lines fit */
      .sec-6-9 .tcard { border: 2px solid var(--thread); background: var(--thread-bg); border-radius: 12px; padding: 8px 10px; display: flex; flex-direction: column; gap: 6px; min-width: 0; } /* .tcard: a thread's card (name, status, buttons) stacked in a column with a thread-coloured frame; min-width 0 lets it shrink */
      .sec-6-9 .tcard.wait { border-color: var(--warn); background: var(--warn-bg); } /* a thread that is waiting gets an amber card */
      .sec-6-9 .tcard.hold { border-color: var(--ok); background: var(--ok-bg); } /* a thread that holds the lock (or a unit) gets a green card */
      .sec-6-9 .tcard .nm { font-weight: 900; font-size: 19px; line-height: 1; } /* the thread's name, large and heavy, at the top of its card */
      .sec-6-9 .tcard .st { font-size: 13px; font-weight: 700; color: var(--ink-2); min-height: 17px; } /* the thread's status line; the minimum height keeps cards from jumping when the text changes */
      .sec-6-9 .tcard .btn { width: 100%; } /* each operation button stretches across the full width of its card */
      .sec-6-9 .grid-2 > *, .sec-6-9 .grid-3 > *, .sec-6-9 .grid-4 > * { min-width: 0; } /* lets the items of the 2-, 3- and 4-column grids shrink below their content width instead of overflowing */
      .sec-6-9 .flip-face.front { font-size: 19px; } /* bigger question text on the front of the recap flip cards */
      .sec-6-9 .flip-face.back { font-size: 15.5px; line-height: 1.45; } /* smaller answer text with roomier lines on the back of the flip cards */
      .sec-6-9 pre.code .ln.here { background: var(--panel-2); border-left-color: var(--line-2); } /* a code line where a thread is paused (but not running right now) gets a faint background and a grey bar */
      .sec-6-9 table.ctab { width: 100%; table-layout: fixed; border-collapse: separate; border-spacing: 0; background: var(--panel-3); border: 1px solid var(--line); border-radius: 10px; overflow: hidden; } /* .ctab: the lab's code table; fixed column widths so code does not shift as chips come and go; rounded frame */
      .sec-6-9 table.ctab td { padding: 2px 8px; height: 29px; vertical-align: middle; white-space: pre; } /* every cell is the same 29 px tall, centred vertically, and keeps the code's spaces exactly as typed */
      .sec-6-9 table.ctab td.g { width: 92px; white-space: nowrap; } /* g: the gutter column on the left where the thread chips sit, kept on one line */
      .sec-6-9 table.ctab td.n { width: 22px; color: var(--muted); text-align: right; font-family: var(--mono); font-size: 13px; } /* n: the line-number column, small, grey and right-aligned in a typewriter font */
      .sec-6-9 table.ctab td.k { font-family: var(--mono); font-size: 14px; width: 250px; } /* k: the code column, in the typewriter (monospace) font */
      .sec-6-9 table.ctab td.c { color: var(--muted); font-size: 13.5px; font-style: italic; } /* c: the comment column, grey and italic like comments in an editor */
      .sec-6-9 table.ctab tr.here td { background: color-mix(in srgb, var(--chc) 12%, transparent); } /* the row a thread is about to run gets a light tint of the chapter colour */
      .sec-6-9 table.ctab.slim td { height: auto; padding: 3px 6px; } /* phone-width version of the table: rows grow to fit their content */
      .sec-6-9 table.ctab.slim td.g { width: 50px; white-space: normal; } /* the gutter shrinks to 50 px and its chips may wrap onto two lines */
      .sec-6-9 table.ctab.slim td.k { width: auto; font-size: 13px; white-space: normal; } /* the code column takes the remaining width and may wrap */
      .sec-6-9 table.ctab.slim .c { color: var(--muted); font-family: var(--font); font-size: 13px; font-style: italic; } /* the comment line under each code line in the phone version: grey, italic, in the normal text font */
    `,  // end of the section's style rules
    steps: [  // the list of steps (slides) in this section, in order
      /* ---------------- 1. Big picture ---------------- */
      {  // step 1 begins: the overview of the four primitives
        title: 'Four tools for threads that share data',  // the title shown at the top of step 1
        kind: 'story',  // kind story: labelled Big Picture above the title, the section's opening slide
        html: `${/* the slide's fixed HTML; the render function below fills in its buttons and detail card */''}
          <div class="split fill" style="grid-template-columns:minmax(0,5fr) minmax(0,6fr)">${/* two columns: the explanation on the left (5 parts) and the clickable picker on the right (6 parts) */''}
            <div class="stack" style="gap:9px">${/* the left column, its paragraphs stacked with a 9 px gap */''}
              <p class="lead m0">A busy Solaris machine runs hundreds of threads on many processors, and they share data all the time: kernel tables, buffers, caches and queues.</p>${/* opening paragraph: why a many-processor kernel needs synchronization at all */''}
              <p class="m0">Section 6.7 showed the classic UNIX tools (pipes, messages, shared memory, semaphores and signals). Solaris keeps all of them and adds four <b>thread synchronization primitives</b>: <span class="t" data-t="mutex lock">mutex locks</span>, semaphores, <span class="t" data-t="readers/writer lock">readers/writer locks</span> and condition variables. Each one exists twice: inside the <span class="t">kernel</span> for kernel threads, and in the threads library for user-level threads.</p>${/* paragraph naming the four primitives, with glossary links, and noting each exists in the kernel and in the threads library */''}
              <p class="m0">Initializing a primitive (<code>mutex_init</code>, <code>sema_init</code>, <code>rw_init</code>, <code>cv_init</code>) creates a <span class="t">synchronization object</span>: a few bytes of memory that every thread using it shares. Every later call reads and changes that one object.</p>${/* paragraph: initializing a primitive creates one shared synchronization object */''}
              <p class="small muted m0">The names on these pages are the kernel’s. The threads library offers the same four tools under its own names, such as <code>mutex_lock</code> and <code>cond_wait</code>, and so do their POSIX <code>pthread_</code> cousins.</p>${/* small print: these are the kernel's names; the threads library and POSIX use their own */''}
              <div class="row gap-s small"><span class="chip thread">run a lock by hand</span><span class="chip cpu">spin or sleep?</span><span class="chip os">downgrade a write lock</span><span class="chip intr">catch the if-versus-while bug</span><span class="chip ok">pick the right tool</span></div>${/* a row of coloured chips previewing the activities in the later steps */''}
            </div>${/* ends the left column */''}
            <div class="card stack" style="gap:9px">${/* the right column: a card holding the primitive picker */''}
              <h4 class="m0">The four primitives: click one to see its object</h4>${/* heading over the picker, telling the student to click a primitive */''}
              <div class="grid-4 prim-btns" style="gap:8px"></div>${/* empty grid that render() fills with the four primitive buttons */''}
              <div class="card white grow prim-detail" style="display:flex;flex-direction:column;gap:8px;padding:12px 14px"></div>${/* empty card that render() fills with the chosen primitive's details */''}
            </div>${/* ends the right column */''}
          </div>`,  // ends the two-column layout and the slide's HTML
        render(el, ctx) {  // render(el, ctx): runs when step 1 opens; ctx is the toolbox the guide hands each step
          const { h } = ctx;  // takes the HTML builder h out of ctx so it can be called directly
          const P = [  // P: the four primitives, each with its name, glossary term, colour, rule, object fields, operations and everyday picture
            { name: 'Mutex lock', term: 'mutex lock', cls: 'thread', rule: 'Only one thread may hold it. The thread that acquired it is its <b>owner</b>, and only the owner may release it.',  // entry 1, the mutex lock: one holder at a time, and only the owner may release it
              fields: [['owner', 'the thread holding the lock, or none', 'T2'], ['waiters', 'threads that want it next', 'T5, T7']],  // the mutex object's fields with example values: the owner and the waiting threads
              ops: [['mutex_enter', 'acquire; wait if held'], ['mutex_exit', 'release (owner only)'], ['mutex_tryenter', 'acquire only if free']],  // the three mutex operations with a short meaning for each
              pic: 'The single key to the supply closet. One person at a time goes in, and the person who took the key is the one who brings it back.' },  // everyday picture for the mutex: a single key that only its taker brings back
            { name: 'Semaphore', term: 'semaphore', cls: 'os', rule: 'A counter of available units. Taking a unit when none is left makes the thread sleep. There is no owner: any thread may give a unit back.',  // entry 2, the semaphore: a counter of units with no owner
              fields: [['count', 'units available right now (never below 0)', '2'], ['sleepers', 'threads waiting for a unit', 'none']],  // the semaphore object's fields: the count (never below 0) and its sleepers
              ops: [['sema_p', 'take a unit; sleep if none'], ['sema_v', 'give a unit back; wake one'], ['sema_tryp', 'take a unit only if no wait']],  // the three semaphore operations: take, give back, and take only if no wait
              pic: 'The sign at a parking garage that counts free spaces. At 0, drivers wait at the gate; anyone leaving lets one waiting driver in.' },  // everyday picture for the semaphore: a car park sign that counts free spaces
            { name: 'Readers/writer lock', term: 'readers/writer lock', cls: 'mem', rule: 'Many threads may hold it together <b>to read</b>, or one thread alone <b>to write</b>, never both at once.',  // entry 3, the readers/writer lock: many readers together or one writer alone
              fields: [['writer', 'the one writing thread, or none', 'none'], ['readers', 'threads reading together', 'T1, T4, T6'], ['waiting', 'writers and readers in line', 'T3 (writer)']],  // the readers/writer object's fields: the writer, the readers sharing it, and who waits in line
              ops: [['rw_enter', 'acquire as reader or writer'], ['rw_exit', 'release either mode'], ['rw_downgrade', 'write lock → read lock'], ['rw_tryupgrade', 'read lock → write lock, if possible']],  // the four readers/writer operations, downgrade and upgrade included
              pic: 'A library reading room. Any number of people may read together, but the room closes to everyone while one librarian rearranges the shelves.' },  // everyday picture for the readers/writer lock: a reading room that closes while the shelves are rearranged
            { name: 'Condition variable', term: 'condition variable', cls: 'intr', rule: 'A place to sleep until some condition about shared data becomes true. Always used together with a mutex that protects that data.',  // entry 4, the condition variable: a place to sleep until a condition holds, always paired with a mutex
              fields: [['sleepers', 'threads waiting for the condition', 'T2, T8'], ['(no value)', 'it keeps no count and no owner, so it remembers no signal', '']],  // the condition variable's fields: only sleepers, since it keeps no count and no owner
              ops: [['cv_wait', 'release the mutex and sleep; relock on wake'], ['cv_signal', 'wake one sleeper'], ['cv_broadcast', 'wake every sleeper']],  // the three condition-variable operations: wait, signal and broadcast
              pic: 'A note on the front desk: “wake me when the delivery arrives.” The note holds nothing itself; when woken, you still walk over and check the box.' },  // everyday picture for the condition variable: a wake-me note that holds nothing itself
          ];  // closes the P list
          const grid = ctx.$('.prim-btns'), detail = ctx.$('.prim-detail');  // finds the empty button grid and detail card from the HTML above
          const btns = P.map((p, i) => h('button', { class: 'btn sm ' + p.cls, type: 'button', style: { whiteSpace: 'normal', height: '44px', lineHeight: 1.15 }, onclick: () => show(i) }, p.name));  // makes one coloured button per primitive; clicking it shows that primitive's details
          grid.append(...btns);  // puts the four buttons into the grid
          function show(i) {  // show(i): fills the detail card with primitive i and highlights its button
            const p = P[i];  // p is the chosen primitive's entry
            btns.forEach((b, j) => b.classList.toggle('on', i === j));  // marks only the clicked button as selected (the on class)
            detail.replaceChildren(  // replaces whatever the detail card showed before with the new content below
              h('div', { class: 'row', style: { justifyContent: 'space-between' } },  // top row: the name on the left, a position chip on the right
                h('b', { style: { fontSize: '19px' }, html: `<span class="t" data-t="${p.term}">${p.name}</span>` }),  // the name in large bold type, as a glossary link that pops up its definition
                h('span', { class: 'chip ' + p.cls }, 'primitive ' + (i + 1) + ' of 4')),  // a chip such as "primitive 2 of 4", in the primitive's colour
              h('p', { class: 'm0', style: { fontSize: '15.5px' }, html: p.rule }),  // the primitive's one-sentence rule
              h('div', { class: 'xs b muted' }, 'ITS SYNCHRONIZATION OBJECT (simplified), WITH EXAMPLE VALUES'),  // small grey heading over the object table
              h('table', { class: 'tbl compact' }, h('tbody', {}, ...p.fields.map((f) => h('tr', {},  // a compact table with one row per field of the synchronization object
                h('td', { class: 'mono b', style: { width: '25%' } }, f[0]), h('td', {}, f[1]), h('td', { class: 'mono', style: { width: '22%' } }, f[2] || '—'))))),  // each row: the field name in bold monospace, what it means, and an example value (a dash if none)
              h('div', { class: 'xs b muted' }, 'OPERATIONS'),  // small grey heading over the list of operations
              h('div', { class: 'stack', style: { gap: '4px' } }, ...p.ops.map((o) => h('div', { class: 'row gap-s nw small' },  // a short stack with one row per operation
                h('code', { style: { minWidth: '128px' } }, o[0]), h('span', {}, o[1])))),  // each row: the call name as code, then what it does
              h('div', { class: 'callout analogy small m0', style: { marginTop: 'auto' }, 'data-label': 'Everyday picture', html: p.pic }));  // the everyday-picture callout, pushed to the bottom of the card
            detail.classList.remove('fade-in'); void detail.offsetWidth; detail.classList.add('fade-in');  // restarts the fade-in animation; reading offsetWidth forces the browser to notice the class was removed first
          }  // ends show
          show(0);  // shows the mutex lock first when the slide opens
        },  // ends render for step 1
      },  // ends step 1

      /* ---------------- 2. Sandbox: mutex lock and semaphore ---------------- */
      {  // step 2 begins: the hands-on sandbox for a mutex lock and a semaphore
        title: 'Thread sandbox: a mutex lock and a semaphore',  // the title shown at the top of step 2
        kind: 'explore',  // kind explore: labelled Explore above the title, a slide the student plays with
        core: true,  // core: true keeps this step in the shorter core route through the guide
        render(el, ctx) {  // render(el, ctx): builds the whole sandbox when step 2 opens
          const { h, s } = ctx;  // takes the HTML builder h and the SVG builder s out of ctx
          const NAMES = ['T1', 'T2', 'T3'];  // the three threads the student controls
          const rng = ctx.util.seeded(7);  // rng: a seeded random-number generator (seed 7), so the "who wins the spin race" picks repeat the same way every visit
          let mode = 'mutex', style = 'spin', init = 2, burn = 0;  // mode: mutex or semaphore; style: spin or sleep; init: the semaphore's starting count; burn: seconds of processor wasted by spinning
          let th, owner, q, count;  // th: the three thread records; owner: who holds m; q: the waiting threads in order; count: the semaphore's units
          const svg = s('svg', { viewBox: ctx.narrow ? '0 0 360 300' : '0 0 660 180', width: '100%' });  // the picture of the synchronization object and its waiters; a taller viewBox (drawing area) on phone-width screens
          const cards = h('div', { class: 'grid-3', style: { gap: '10px' } });  // a 3-column grid that will hold one card per thread
          const narr = h('div', { class: 'narr' });  // the narration box that explains every click
          const now = h('div', { class: 'small', style: { minHeight: '40px' } });  // the "Right now" summary line under the narration
          const rules = h('div', { class: 'card tight small', style: { lineHeight: 1.45 } });  // card that shows the rules of the chosen primitive
          const side = h('div', { class: 'card tight small', style: { lineHeight: 1.45 } });  // side card: the processor-time meter for spinning, or a comparison note for the semaphore
          const tries = h('div', { class: 'card tight small' });  // card with the "Try these" suggestions
          const log = h('div', { class: 'log grow', style: { minHeight: '52px' } });  // the event log, newest line on top; grow lets it take the leftover height
          const OPS = { mutex: ['mutex_enter', 'mutex_tryenter', 'mutex_exit'], sema: ['sema_p', 'sema_tryp', 'sema_v'] };  // OPS: the three buttons on each thread card for each primitive: acquire, try to acquire, release
          const objName = () => (mode === 'mutex' ? 'mutex lock m' : 'semaphore s');  // objName(): the object's full name for the chosen primitive; kept as a helper, though nothing below calls it
          function say(html, tone) { narr.className = 'narr' + (tone ? ' ' + tone : ''); narr.innerHTML = html; }  // say(html, tone): writes the narration and colours it (ok green, warn amber, bad red, none plain)
          function logLine(t) { log.prepend(h('div', {}, t)); while (log.children.length > 30) log.lastChild.remove(); }  // logLine(t): adds a line to the top of the log and keeps only the newest 30
          function reset(msg) {  // reset(msg): starts the sandbox over with every thread running and the object untouched, then redraws
            th = NAMES.map((n) => ({ n, wait: false, units: 0 }));  // three fresh thread records: name, not waiting, holding no units
            owner = null; q = []; count = init; burn = 0;  // the lock has no owner, nobody waits, the semaphore count goes back to the slider value, the burn meter to zero
            log.innerHTML = '';  // empties the log
            logLine(mode === 'mutex' ? 'start: m is free' : `start: s.count = ${count}`);  // first log line: the starting state of m or of s
            say(msg || (mode === 'mutex'  // narration: the message passed in, or a default reset message for the chosen primitive
              ? 'Reset. The lock is free. Each thread runs on its own processor. Click an operation on any thread.'  // default for the mutex: the lock is free and each thread has its own processor
              : `Reset. The semaphore starts with <b>${count}</b> unit${count === 1 ? '' : 's'} (think: ${count} free buffers). Click an operation on any thread.`));  // default for the semaphore: how many units it starts with, pictured as free buffers
            draw();  // redraws the picture, the cards and the summaries
          }  // ends reset
          const T = (n) => th.find((x) => x.n === n);  // T(n): finds a thread's record by its name
          function waitWord() { return mode === 'sema' ? 'asleep' : style === 'spin' ? 'spinning' : 'asleep'; }  // waitWord(): how a waiter waits right now: asleep on a semaphore, spinning or asleep on a mutex depending on the Waiters switch
          /* ----- mutex operations ----- */
          function mEnter(t, tryOnly) {  // mEnter(t, tryOnly): thread t calls mutex_enter, or mutex_tryenter when tryOnly is true
            const op = tryOnly ? 'mutex_tryenter' : 'mutex_enter';  // op: the name of the call, for the narration and the log
            if (owner === t.n) {  // case 1: t already owns the lock
              if (tryOnly) { say(`<b>${t.n}</b> calls mutex_tryenter on a lock it already holds. The lock is not free, so the call simply <b>returns 0</b> (failure).`); logLine(`${t.n}: ${op} → 0`); return; }  // a try on a lock it holds just fails with 0, since the lock is not free
              say(`<b>Refused.</b> ${t.n} already owns m. A Solaris mutex is not recursive: a second mutex_enter would wait for itself forever, so the Solaris kernel detects it and <b>panics</b> (halts the whole system with an error report).`, 'bad');  // a second mutex_enter by the owner is refused: the narration explains that the kernel would panic, since it would wait for itself
              logLine(`${t.n}: ${op} refused (already owner)`); return;  // logs the refusal and stops
            }  // ends the already-owner case
            if (!owner) {  // case 2: the lock is free
              owner = t.n;  // t becomes the owner
              say(`<b>${t.n}</b> calls ${op}: the lock is free, so ${t.n} takes it and becomes the <b>owner</b>${tryOnly ? ' (the call returns 1, success)' : ''}.`, 'ok');  // narration: t takes the free lock (a try call reports 1 for success)
              logLine(`${t.n}: ${op} → owner`); return;  // logs it and stops
            }  // ends the free-lock case
            if (tryOnly) {  // case 3: the lock is held by someone else and this is a try call
              say(`<b>${t.n}</b> calls mutex_tryenter: ${owner} holds the lock, so the call <b>returns 0 at once</b>. ${t.n} does not wait; it can do other useful work and try again later.`);  // narration: the try call returns 0 at once and t keeps running
              logLine(`${t.n}: ${op} → 0 (held by ${owner})`); return;  // logs the failure and who held the lock, then stops
            }  // ends the try case
            q.push(t.n); t.wait = true;  // case 4: an ordinary mutex_enter on a held lock: t joins the waiters and its card is disabled
            say(style === 'spin'  // narration depends on the Waiters switch
              ? `<b>${t.n}</b> calls mutex_enter, but <b>${owner}</b> holds the lock. ${t.n} <b>spins</b>: it tests the lock again and again in a tight loop. It stays on its processor and burns time, but it will notice the release instantly.`  // spin version: t keeps testing the lock on its own processor, wasting time but noticing the release at once
              : `<b>${t.n}</b> calls mutex_enter, but <b>${owner}</b> holds the lock. ${t.n} goes to <b>sleep on the turnstile</b>, the lock's queue of blocked threads. Its processor is free to run something else until ${t.n} is woken.`, 'warn');  // sleep version: t sleeps on the turnstile and frees its processor (amber tone)
            logLine(`${t.n}: ${op} → ${waitWord()}`);  // logs whether t is spinning or asleep
          }  // ends mEnter
          function mExit(t) {  // mExit(t): thread t calls mutex_exit
            if (owner !== t.n) {  // a caller that is not the owner is refused
              say(owner ? `<b>Refused.</b> ${t.n} calls mutex_exit, but <b>${owner}</b> owns m. Only the owner may release a mutex lock; if any other thread tries, the Solaris kernel <b>panics</b> (halts the whole system with an error report).`  // narration if someone else owns m: only the owner may release, and the kernel would panic
                : `<b>Refused.</b> m is not locked, so ${t.n} has nothing to release. The Solaris kernel would panic here too.`, 'bad');  // narration if m is not locked at all: nothing to release, also a panic in the real kernel
              logLine(`${t.n}: mutex_exit refused`); return;  // logs the refusal and stops
            }  // ends the refused case
            if (!q.length) { owner = null; say(`<b>${t.n}</b> calls mutex_exit. Nobody is waiting, so the lock is simply <b>free</b> again.`); logLine(`${t.n}: mutex_exit → free`); return; }  // no waiters: the lock simply becomes free
            const i = style === 'spin' ? Math.floor(rng() * q.length) : 0;  // i: which waiter gets the lock: a random spinner (spinning is a race), or the first sleeper in line
            const w = q.splice(i, 1)[0]; owner = w; T(w).wait = false;  // removes that waiter from the line, makes it the owner and wakes its card
            say(style === 'spin'  // narration depends on how the waiters were waiting
              ? `<b>${t.n}</b> calls mutex_exit. The spinners race: whichever one's atomic test comes first wins, and this time it is <b>${w}</b>${q.length ? `; ${q.join(' and ')} keep${q.length === 1 ? 's' : ''} spinning` : ''}. Spinning has no queue and no fairness.`  // spin version: the spinners race, the winner is named, the others keep spinning; no queue, no fairness
              : `<b>${t.n}</b> calls mutex_exit. To keep things simple, this sandbox hands the lock straight to the longest sleeper, <b>${w}</b> (all have equal priority). A real kernel frees the lock and wakes the sleepers, which compete for it; the losers wait again.`, 'ok');  // sleep version: the sandbox hands the lock to the longest sleeper, a simplification it admits openly
            logLine(`${t.n}: mutex_exit → ${w} owns m`);  // logs the new owner
          }  // ends mExit
          /* ----- semaphore operations ----- */
          function sP(t, tryOnly) {  // sP(t, tryOnly): thread t calls sema_p, or sema_tryp when tryOnly is true
            const op = tryOnly ? 'sema_tryp' : 'sema_p';  // op: the name of the call
            if (count > 0) { count--; t.units++; say(`<b>${t.n}</b> calls ${op}: the count was ${count + 1}, above 0, so ${t.n} takes a unit and continues. Count: ${count + 1} → <b>${count}</b>${tryOnly ? ' (returns 1, success)' : ''}.`, 'ok'); logLine(`${t.n}: ${op} → count ${count}`); return; }  // count above 0: t takes a unit, the count drops by 1, and the narration shows the before and after
            if (tryOnly) { say(`<b>${t.n}</b> calls sema_tryp: the count is 0, so taking a unit would mean sleeping. sema_tryp never sleeps: it <b>returns 0 at once</b> and the count stays 0.`); logLine(`${t.n}: sema_tryp → 0`); return; }  // count 0 and a try call: it fails at once and the count stays 0
            q.push(t.n); t.wait = true;  // count 0 and a plain sema_p: t joins the sleepers and its card is disabled
            say(`<b>${t.n}</b> calls sema_p: the count is <b>0</b>, so ${t.n} <b>sleeps</b> on the semaphore. Notice that the count stays at 0: a Solaris semaphore keeps its sleepers in a separate list instead of letting the count go negative.`, 'warn');  // narration: t sleeps, and the count stays at 0 rather than going negative
            logLine(`${t.n}: sema_p → asleep`);  // logs that t fell asleep
          }  // ends sP
          function sV(t) {  // sV(t): thread t calls sema_v
            const had = t.units > 0; if (had) t.units--;  // had: whether t had taken a unit earlier; if so, it gives one back
            const own = had ? `${t.n} gives back the unit it took` : `${t.n} never took a unit, but that is allowed: a semaphore has <b>no owner</b>`;  // own: part of the narration, either "gives back its unit" or "never took one, which is allowed since a semaphore has no owner"
            if (!q.length) { count++; say(`<b>${t.n}</b> calls sema_v. ${own}. Nobody is asleep, so the count goes ${count - 1} → <b>${count}</b>.`, 'ok'); logLine(`${t.n}: sema_v → count ${count}`); return; }  // nobody asleep: the count simply goes up by 1
            const w = q.shift(); const W = T(w); W.wait = false; W.units++;  // someone asleep: the first sleeper wakes and is given the unit at once
            say(`<b>${t.n}</b> calls sema_v. ${own}. The count goes 0 → 1 and <b>${w}</b> is woken. The sandbox lets it run at once: it finishes its sema_p by taking that unit, so the count is back to <b>0</b>.`, 'ok');  // narration: the count goes 0 to 1 and straight back to 0 as the woken thread finishes its sema_p
            logLine(`${t.n}: sema_v → ${w} woken, count 0`);  // logs who woke and that the count is 0
          }  // ends sV
          function act(t, k) {  // act(t, k): runs button k (0 acquire, 1 try, 2 release) on thread t, then redraws
            if (t.wait) return;  // a waiting thread cannot run anything, so its clicks are ignored
            if (mode === 'mutex') { if (k === 2) mExit(t); else mEnter(t, k === 1); }  // for the mutex: button 2 releases, buttons 0 and 1 acquire (1 being the try version)
            else { if (k === 2) sV(t); else sP(t, k === 1); }  // for the semaphore: button 2 is sema_v, buttons 0 and 1 are sema_p and sema_tryp
            if (th.every((x) => x.wait)) say('All three threads are waiting, and none is left to release anything. They will wait forever. Press <b>Reset</b>.', 'bad');  // if every thread is now waiting, nobody can ever release: the narration warns that they will wait forever
            draw();  // redraws everything to show the new state
          }  // ends act
          /* ----- drawing ----- */
          const G = ctx.narrow  // G: positions and sizes for the picture, picked for phone-width or desktop screens
            ? { title: [180, 18], box: [90, 28, 180, 120], lab: [180, 54], big: [180, 102], stat: [180, 136], arrow: null, qt: [180, 176], qbox: [6, 186, 348, 106], qx: (k) => 70 + k * 110, qy: 228, qw: 64, qh: 48, sub: 272, none: [180, 244] }  // phone layout: the object box on top, the waiting area below it with three slots, and no arrow
            : { title: [112, 18], box: [14, 28, 196, 136], lab: [112, 58], big: [112, 112], stat: [112, 148], arrow: [214, 96, 248, 96], qt: [449, 18], qbox: [252, 28, 394, 136], qx: (k) => 330 + k * 120, qy: 86, qw: 70, qh: 54, sub: 138, none: [449, 102] };  // desktop layout: the object box on the left, an arrow, and the waiting area on the right with three slots
          function draw() {  // draw(): repaints the picture, the thread cards, the Right now line and the side card
            const k = [];  // k collects the shapes for the picture
            const held = mode === 'mutex' ? !!owner : count === 0;  // held: whether the object is taken (owned lock or count 0); computed, though nothing below reads it
            k.push(s('text', { x: G.title[0], y: G.title[1], 'text-anchor': 'middle', 'font-weight': 700, 'font-size': 15 }, 'synchronization object: ' + (mode === 'mutex' ? 'm' : 's')));  // title over the object box: "synchronization object: m" or "...: s"
            k.push(s('rect', { x: G.box[0], y: G.box[1], width: G.box[2], height: G.box[3], rx: 16, class: 's-os', 'stroke-width': 2.5 }));  // the object box, in the operating-system colour
            k.push(s('text', { x: G.lab[0], y: G.lab[1], 'text-anchor': 'middle', class: 's-sub', 'font-size': 14 }, mode === 'mutex' ? 'owner' : 'count'));  // small label inside the box: owner for the mutex, count for the semaphore
            if (mode === 'mutex') {  // the inside of the box depends on the primitive
              k.push(s('text', { x: G.big[0], y: G.big[1], 'text-anchor': 'middle', 'font-weight': 900, 'font-size': owner ? 44 : 28, style: owner ? 'fill:var(--ok)' : 'fill:var(--muted)' }, owner || 'none'));  // mutex: the owner's name, large and green, or a smaller grey "none" when the lock is free
              k.push(s('text', { x: G.stat[0], y: G.stat[1], 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700 }, owner ? 'locked' : 'free'));  // mutex: a status word under it, locked or free
            } else {  // semaphore case
              k.push(s('text', { x: G.big[0], y: G.big[1], 'text-anchor': 'middle', 'font-weight': 900, 'font-size': 48, style: `fill:var(${count > 0 ? '--ok' : '--os'})` }, String(count)));  // semaphore: the count in big digits, green while units remain and in the operating-system colour at 0
              const n = Math.min(count, 6), x0 = G.stat[0] - (n - 1) * 11;  // n: how many unit dots to draw (at most 6); x0 is where the row starts so it is centred
              for (let i = 0; i < n; i++) k.push(s('circle', { cx: x0 + i * 22, cy: G.stat[1] - 5, r: 7, class: 's-ok', 'stroke-width': 2 }));  // draws one small green circle per available unit
              if (!count) k.push(s('text', { x: G.stat[0], y: G.stat[1], 'text-anchor': 'middle', 'font-size': 14, class: 's-sub' }, 'no units free'));  // at count 0 there are no dots, so a grey note says no units are free
            }  // ends the inside of the box
            if (G.arrow) k.push(s('line', { x1: G.arrow[0], y1: G.arrow[1], x2: G.arrow[2], y2: G.arrow[3], class: 's-line', 'marker-end': 'url(#arr)' }));  // desktop only: an arrow from the object box to the waiting area (url(#arr) is the page's shared arrowhead)
            const qTitle = mode === 'sema' ? 'threads asleep on the semaphore' : style === 'spin' ? (ctx.narrow ? 'waiters, spinning' : 'waiters, spinning (each on its own processor)') : (ctx.narrow ? 'turnstile: sleeping waiters' : 'turnstile: sleeping waiters (by priority)');  // qTitle: the waiting area's title, naming how the waiters wait; shorter wording on phone-width screens
            k.push(s('text', { x: G.qt[0], y: G.qt[1], 'text-anchor': 'middle', 'font-weight': 700, 'font-size': 15 }, qTitle));  // writes that title above the waiting area
            k.push(s('rect', { x: G.qbox[0], y: G.qbox[1], width: G.qbox[2], height: G.qbox[3], rx: 16, class: mode === 'mutex' && style === 'spin' ? 's-cpu' : 's-panel', 'stroke-width': 2 }));  // the waiting area's box, tinted in the processor colour while waiters spin (they are using processors)
            for (let i = 0; i < 3; i++) {  // draws three slots in the waiting area, one per possible waiter
              const x = G.qx(i), n = q[i];  // x: where slot i sits; n: the thread waiting in that slot, if any
              if (n) {  // the slot is taken
                const g = tok(s, x, G.qy, n, 's-warn', G.qw, G.qh, 18);  // an amber token with the waiting thread's name
                if (mode === 'mutex' && style === 'spin') g.setAttribute('class', 'pulse');  // spinning waiters pulse (fade in and out) to show they are busy testing the lock
                k.push(g, s('text', { x, y: G.sub, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, style: 'fill:var(--warn)' }, waitWord()));  // adds the token and, under it, the word spinning or asleep
              } else k.push(s('rect', { x: x - G.qw / 2, y: G.qy - G.qh / 2, width: G.qw, height: G.qh, rx: 10, class: 's-muted', 'stroke-dasharray': '5 5' }));  // an empty slot is a grey dashed outline
            }  // ends the loop over slots
            if (!q.length) k.push(s('text', { x: G.none[0], y: G.sub + 4, 'text-anchor': 'middle', class: 's-sub', 'font-size': 14 }, 'nobody is waiting'));  // with no waiters, the waiting area says nobody is waiting
            svg.replaceChildren(...k);  // swaps the new shapes into the picture in one go
            cards.replaceChildren(...th.map((t) => {  // rebuilds the three thread cards from the thread records
              const holds = mode === 'mutex' ? owner === t.n : t.units > 0;  // holds: whether this thread owns the lock, or holds at least one semaphore unit
              const chip = holds ? h('span', { class: 'chip ok' }, mode === 'mutex' ? 'owner' : `holds ${t.units} unit${t.units > 1 ? 's' : ''}`) : null;  // chip: a green tag (owner, or "holds 2 units") shown only when the thread holds something
              const st = t.wait ? (waitWord() === 'spinning' ? 'Spinning on its processor' : 'Asleep, using no processor') : holds ? (mode === 'mutex' ? 'Running, holds the lock' : 'Running, using its unit') : 'Running';  // st: the status line: spinning, asleep, running with the lock or a unit, or just running
              return h('div', { class: 'tcard' + (t.wait ? ' wait' : holds ? ' hold' : '') },  // the card, coloured amber if waiting and green if holding
                h('div', { class: 'row', style: { justifyContent: 'space-between', minHeight: '22px' } }, h('span', { class: 'nm' }, t.n), chip),  // top row of the card: the thread's name on the left and its chip on the right
                h('div', { class: 'st' }, st),  // the status line
                ...OPS[mode].map((op, j) => h('button', { class: 'btn sm', type: 'button', disabled: t.wait, onclick: () => act(t, j) }, op)));  // the three operation buttons; all are disabled while the thread waits, since a waiting thread cannot run code
            }));  // ends the card list
            now.innerHTML = '<b>Right now:</b> ' + (mode === 'mutex'  // the Right now line, one sentence summing up the object
              ? (owner ? `${owner} owns m. ${q.length ? q.length + ' waiting (' + waitWord() + ').' : 'Nobody is waiting.'}` : 'm is free: the next mutex_enter succeeds at once.')  // for the mutex: who owns m and how many wait, or that m is free and the next mutex_enter succeeds at once
              : `count = ${count}. ${count ? `The next ${count} sema_p call${count > 1 ? 's' : ''} pass${count > 1 ? '' : 'es'} without sleeping.` : 'The next sema_p sleeps.'} ${q.length ? q.length + ' asleep.' : ''}`);  // for the semaphore: the count, how many sema_p calls will pass without sleeping, and how many threads sleep
            paintSide();  // refreshes the side card too
          }  // ends draw
          function paintSide() {  // paintSide(): fills the side card with the note or meter that fits the current choice
            if (mode === 'sema') {  // semaphore chosen
              side.innerHTML = '<b>Compare with semWait.</b> In Chapter 5 a semaphore’s value went negative to count its waiters. A Solaris semaphore’s count never drops below 0; the sleepers are kept in a separate list. The behavior is the same, only the bookkeeping differs.';  // note comparing the Solaris count (never below 0, separate sleeper list) with the earlier semWait whose value went negative
              return;  // nothing else to show for the semaphore
            }  // ends the semaphore case
            if (style === 'sleep') { side.innerHTML = '<b>Processor time burned by waiting: 0 s.</b> A sleeping waiter uses no processor at all. The price is paid elsewhere: going to sleep and being woken each cost a thread switch.'; return; }  // sleeping waiters: the card says no processor time is burned, and that the cost is two thread switches instead
            side.replaceChildren(  // spinning waiters: the card becomes a live meter
              h('div', { html: `<b>Processor time burned by spinning: <span class="num">${burn.toFixed(1)}</span> s</b>` }),  // the running total of processor seconds burned by spinning
              h('div', { class: 'meter', style: { margin: '5px 0' } }, h('i', { style: { width: Math.min(100, burn * 5) + '%', background: 'var(--bad)' } })),  // a red bar that fills as the total grows (full at 20 s)
              h('div', { class: 'xs muted' }, 'Each spinner keeps a processor 100% busy doing nothing useful. Real waits last microseconds; here, you are the slow part.'));  // small print: each spinner keeps a processor fully busy, and here the student is the slow part
          }  // ends paintSide
          ctx.every(200, () => { if (mode === 'mutex' && style === 'spin' && q.length) { burn += 0.2 * q.length; paintSide(); } });  // every 200 ms while mutex waiters spin, adds 0.2 s per spinner to the burn total and refreshes the meter
          /* ----- controls and layout ----- */
          const TRY = {  // TRY: the suggested experiments for each primitive, shown in the Try these card
            mutex: ['T1 calls mutex_enter. Then T2 calls mutex_exit.', 'T2 and T3 call mutex_enter. How do they wait?', 'T1 exits. Who gets the lock?', 'Switch to “Sleep on turnstile” and repeat.', 'While T1 holds m, let T3 call mutex_tryenter.'],  // mutex experiments: a refused release, two waiters, who wins, switching to sleep, and a try call
            sema: ['Start count 2: all three call sema_p.', 'T1 calls sema_v. Who wakes? What is the count?', 'Start count 0: T2 calls sema_v, then T1 sema_p.', 'With the count at 0, try sema_tryp.'],  // semaphore experiments: running out of units, who wakes on sema_v, a sema_v before any sema_p, and sema_tryp at 0
          };  // closes TRY
          const RULES = {  // RULES: the rule card's text for each primitive, with glossary links on the call names
            mutex: '<b>Rules of a <span class="t">mutex lock</span>.</b> <span class="t">mutex_enter</span>: if the lock is free, take it and become the owner; if not, wait. <span class="t" data-t="try operation">mutex_tryenter</span>: take it only if it is free, otherwise return 0 at once. <span class="t">mutex_exit</span>: only the owner may call it; it frees the lock and lets one waiter take it.',  // the mutex rules: enter, tryenter and exit, and that only the owner may exit
            sema: '<b>Rules of a Solaris semaphore.</b> <span class="t">sema_p</span>: if count &gt; 0, subtract 1 and go on; if count = 0, sleep. <span class="t" data-t="try operation">sema_tryp</span>: subtract 1 only if count &gt; 0, otherwise return 0 at once. <span class="t">sema_v</span>: any thread may call it; add 1, and if a thread is asleep, wake one, which takes that unit when it runs.',  // the semaphore rules: p, tryp and v, and that any thread may call sema_v
          };  // closes RULES
          function paintStatic() {  // paintStatic(): updates the parts that change only when the primitive or waiting style is switched
            rules.innerHTML = RULES[mode];  // shows the rules for the chosen primitive
            tries.replaceChildren(h('b', {}, 'Try these'), h('ol', { class: 'm0', style: { paddingLeft: '20px' } }, ...TRY[mode].map((t) => h('li', {}, t))));  // rebuilds the Try these card as a numbered list
            styleWrap.style.display = mode === 'mutex' ? '' : 'none';  // the Waiters switch appears only for the mutex
            initSl.style.display = mode === 'sema' ? '' : 'none';  // the Start count slider appears only for the semaphore
          }  // ends paintStatic
          const modeSeg = ctx.ui.seg([{ value: 'mutex', label: 'Mutex lock' }, { value: 'sema', label: 'Semaphore' }], mode, (v) => { mode = v; paintStatic(); reset(); });  // the Primitive switch (a row of buttons where one is selected): mutex lock or semaphore; switching restarts the sandbox
          const styleSeg = ctx.ui.seg([{ value: 'spin', label: 'Spin' }, { value: 'sleep', label: 'Sleep on turnstile' }], style, (v) => {  // the Waiters switch: spin or sleep on the turnstile
            style = v; paintStatic();  // stores the choice and updates the static cards
            reset(v === 'spin' ? 'Waiters now <b>spin</b>: each keeps testing the lock on its own processor.' : 'Waiters now <b>sleep</b> on the lock’s <span class="t">turnstile</span> and use no processor time until they are woken.');  // restarts with a narration that explains the new way of waiting
          });  // ends the Waiters switch
          const styleWrap = h('span', { class: 'row gap-s' }, h('span', { class: 'small b' }, 'Waiters'), styleSeg);  // groups the Waiters label and switch so both can be hidden together
          const initSl = ctx.ui.slider({ label: 'Start count', min: 0, max: 3, value: init, onInput: (v) => { init = v; reset(); } });  // the Start count slider (0 to 3) for the semaphore; moving it restarts with that many units
          initSl.style.minWidth = '210px';  // gives the slider enough width for its label and readout
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },  // builds the slide: a column with the controls row on top and two columns below
            h('div', { class: 'row', style: { gap: '14px' } }, h('span', { class: 'small b' }, 'Primitive'), modeSeg, styleWrap, initSl,  // the controls row: Primitive switch, Waiters switch, Start count slider
              h('button', { class: 'btn sm', type: 'button', onclick: () => reset() }, 'Reset')),  // and the Reset button
            h('div', { class: 'split grow', style: { gridTemplateColumns: 'minmax(0, 7fr) minmax(0, 5fr)', gap: '18px' } },  // two columns below: the main area (7 parts) and the explanation column (5 parts)
              h('div', { class: 'stack', style: { gap: '10px' } }, h('div', { class: 'card white tight' }, svg), cards, rules),  // left column: the picture in a white card, the thread cards, and the rules card
              h('div', { class: 'stack', style: { gap: '8px' } }, narr, now, side, tries, log))));  // right column: narration, Right now line, side card, Try these and the log
          paintStatic();  // fills in the static cards for the starting primitive
          reset();  // starts the sandbox in its initial state
        },  // ends render for step 2
      },  // ends step 2

      /* ---------------- 3. Spin, sleep or adapt ---------------- */
      {  // step 3 begins: comparing spinning, sleeping and the adaptive choice
        title: 'Spin, sleep, or adapt?',  // the title shown at the top of step 3
        kind: 'compare',  // kind compare: labelled Compare above the title
        render(el, ctx) {  // render(el, ctx): builds the comparison when step 3 opens
          const { h, s } = ctx;  // takes the HTML and SVG builders out of ctx
          const SW = 3, PRE = 2000;               // one thread switch (µs); how long a preempted owner waits for a processor (µs)
          let hold = 4, running = true;  // hold: how much longer the owner needs the lock, in µs (microseconds, millionths of a second); running: whether the owner is on a processor
          const W = ctx.narrow ? 360 : 640, X0 = ctx.narrow ? 62 : 112, XR = W - 14;  // W: the drawing's width; X0: where the timeline starts (after the lane labels); XR: where it ends; all smaller on phone-width screens
          const svg = s('svg', { viewBox: `0 0 ${W} 196`, width: '100%' });  // the timeline picture, 196 units tall
          const table = h('tbody');  // the table body that will list each waiter's costs
          const verdict = h('div', { class: 'narr' });  // the verdict box under the table
          function model() {  // model(): works out the costs of spinning and sleeping for the current settings
            const R = running ? hold : PRE + hold;                 // the moment the owner releases the lock
            return { R, spinCpu: R, spinGet: R, sleepCpu: 2 * SW, sleepGet: R + SW, pick: running ? 'spin' : 'sleep' };  // the spinner burns the whole wait and gets the lock at R; the sleeper pays two switches and gets it one switch after R; pick is the adaptive choice
          }  // ends model
          const fmtUs = (v) => v.toLocaleString('en-US') + ' µs';  // fmtUs(v): writes a number of microseconds with thousands commas, e.g. "2,004 µs"
          function draw() {  // draw(): redraws the timeline, the cost table and the verdict for the current slider and switch
            const m = model(), max = m.sleepGet * 1.04, X = (t) => X0 + (t / max) * (XR - X0);  // m: the costs; max: the right edge of the timeline (a little past the sleeper's finish); X(t) turns a time into a position across the picture
            const k = [];  // k collects the shapes
            const lane = (y, label) => k.push(s('text', { x: 4, y: y + 5, 'font-size': 14, 'font-weight': 800 }, label));  // lane(y, label): writes a lane's name at the left edge, at height y
            const bar = (t0, t1, y, cls, extra = {}) => k.push(s('rect', Object.assign({ x: X(t0), y: y - 11, width: Math.max(3, X(t1) - X(t0)), height: 22, rx: 5, class: cls, 'stroke-width': 1.5 }, extra)));  // bar(t0, t1, y, cls, extra): a rounded bar from time t0 to t1 on lane y, at least 3 units wide so tiny spans still show
            const note = (x, y, txt, anchor = 'start', style) => k.push(s('text', { x, y, 'font-size': 13, 'text-anchor': anchor, class: style ? null : 's-sub', style: style || null }, txt));  // note(x, y, txt, anchor, style): a small caption; grey unless a custom style is given
            // owner lane
            lane(40, 'Owner');  // the first lane: the thread that owns the lock
            if (!running) { bar(0, PRE, 40, 's-panel', { 'stroke-dasharray': '4 3' }); note(X(PRE / 2), 45, ctx.narrow ? 'not running' : 'not running: waiting for a processor', 'middle'); }  // if the owner is preempted, a dashed grey bar shows the long stretch it waits for a processor before it can run again
            bar(running ? 0 : PRE, m.R, 40, 's-ok');  // a green bar for the owner's remaining work, ending when it releases the lock
            const far = X(m.R) - X0 > (ctx.narrow ? 150 : 230);  // far: whether the release point is far enough right that its label fits to its left
            note(far ? X(m.R) : X(m.R) + 6, 20, `releases the lock at ${fmtUs(m.R)}`, far ? 'end' : 'start', 'fill:var(--ok);font-weight:700');  // labels the release moment in green, placed left or right of the line so it stays inside the picture
            k.push(s('line', { x1: X(m.R), y1: 54, x2: X(m.R), y2: 178, class: 's-muted', 'stroke-dasharray': '4 4' }));  // a dashed vertical line at the release moment, crossing all three lanes
            // spinning waiter
            lane(98, 'Spin');  // the second lane: a waiter that spins
            bar(0, m.R, 98, 's-bad');  // a red bar: the spinner burns processor time for the whole wait
            bar(m.R, max, 98, 's-ok', { opacity: 0.55 });  // a faint green bar after the release: the spinner now has the lock
            note(X0, 79, `burns ${fmtUs(m.spinCpu)} of processor, gets the lock at ${fmtUs(m.spinGet)}`);  // caption above the lane: how much processor time spinning burns and when the lock is taken
            // sleeping waiter
            lane(156, 'Sleep');  // the third lane: a waiter that sleeps
            bar(0, SW, 156, 's-os');  // a short bar for the switch that puts it to sleep
            k.push(s('line', { x1: X(SW), y1: 156, x2: X(m.R), y2: 156, class: 's-muted', 'stroke-dasharray': '2 5' }));  // a dotted line for the time spent asleep, using no processor
            bar(m.R, m.sleepGet, 156, 's-os');  // a second short bar for the switch that wakes it after the release
            note(X0, 137, `uses ${fmtUs(m.sleepCpu)} (two switches), gets the lock at ${fmtUs(m.sleepGet)}`);  // caption above the lane: two switches of processor time, and the later moment it gets the lock
            note(X0, 188, 'asleep in between: its processor runs other threads');  // caption below the lane: while asleep, its processor runs other threads
            svg.replaceChildren(...k);  // swaps the new shapes into the picture in one go
            const better = m.spinCpu <= m.sleepCpu ? 'spin' : 'sleep';  // better: whichever waiter actually used less processor time in this case
            table.replaceChildren(  // rebuilds the cost table body
              ...[['spin', 'Spin', m.spinCpu, m.spinGet], ['sleep', 'Sleep on turnstile', m.sleepCpu, m.sleepGet]].map(([key, label, cpu, get]) =>  // one row each for Spin and for Sleep on turnstile, with processor time used and the moment the lock is taken
                h('tr', { class: m.pick === key ? 'on' : '' },  // the row the adaptive mutex would choose is highlighted
                  h('td', {}, h('b', {}, label), m.pick === key ? h('span', { class: 'chip accent', style: { marginLeft: '8px' } }, 'adaptive picks this') : null),  // first cell: the waiter's name, plus an "adaptive picks this" chip on the chosen row
                  h('td', { class: 'num' }, fmtUs(cpu)), h('td', { class: 'num' }, fmtUs(get)))));  // the other two cells: processor time used and when the lock is obtained
            if (!running) { verdict.className = 'narr ok'; verdict.innerHTML = `The owner is not running, so spinning would burn <b>${fmtUs(m.spinCpu)}</b> waiting for a thread that cannot release anything until it gets a processor back. The adaptive mutex sees this and <b>sleeps</b>, using only ${fmtUs(m.sleepCpu)}.`; }  // owner not running: green verdict explaining that the adaptive mutex sleeps instead of burning a long spin
            else if (better === 'spin') { verdict.className = 'narr ok'; verdict.innerHTML = `A short wait: spinning costs ${fmtUs(m.spinCpu)}, sleeping ${fmtUs(m.sleepCpu)}, and the spinner also gets the lock ${SW} µs sooner. The owner is running, so the adaptive mutex <b>spins</b>: the right call.`; }  // owner running and spinning is cheaper: green verdict, spinning was the right call
            else { verdict.className = 'narr warn'; verdict.innerHTML = `Sleeping would have saved ${fmtUs(m.spinCpu - m.sleepCpu)} here, yet the adaptive mutex still <b>spins</b> because the owner is running. It cannot see the future; it bets the owner will finish soon, which is usually true: kernel code holds a mutex only briefly.`; }  // owner running but the wait was long: amber verdict, the adaptive mutex still spins because it cannot know the wait in advance
          }  // ends draw
          const sl = ctx.ui.slider({ label: 'Owner still needs the lock for', min: 1, max: 40, value: hold, format: (v) => v + ' µs', onInput: (v) => { hold = v; draw(); } });  // slider for how long the owner still needs the lock, 1 to 40 µs; moving it redraws
          const seg = ctx.ui.seg([{ value: 1, label: 'Running on another CPU' }, { value: 0, label: 'Not running (preempted)' }], 1, (v) => { running = !!v; draw(); });  // two-way switch: the owner is running on another processor, or preempted; switching redraws
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: 'minmax(0, 5fr) minmax(0, 7fr)', gap: '22px' } },  // builds the slide in two columns: explanation (5 parts) and the experiment (7 parts)
            h('div', { class: 'stack', style: { gap: '9px' } },  // the explanation column
              h('p', { class: 'm0', html: 'When <span class="t">mutex_enter</span> finds the lock held, the waiter can <b>spin</b> (keep testing on its processor) or <b>sleep</b> (give up its processor until woken).' }),  // paragraph: the two ways to wait, spin or sleep
              h('p', { class: 'm0', html: '<b>The basic design.</b> A waiter spins by default. Optionally, an interrupt-based blocking mechanism lets it sleep on the lock’s <span class="t">turnstile</span> until the lock is released.' }),  // paragraph: the basic design spins by default and may optionally sleep on the turnstile
              h('p', { class: 'm0', html: '<b>What the kernel really does.</b> Solaris kernel mutexes are <span class="t" data-t="adaptive mutex">adaptive</span>. Each time a thread must wait, it looks at the owner:' }),  // paragraph: kernel mutexes are adaptive and look at the owner each time
              h('div', { class: 'stack', style: { gap: '6px' } },  // the two rules of the adaptive mutex, as coloured boxes
                h('div', { class: 'box cpu small', style: { textAlign: 'left' }, html: '<b>Owner running on another processor</b> → spin. It is working, so the lock will probably be free in a moment.' }),  // rule 1: owner running elsewhere, so spin
                h('div', { class: 'box os small', style: { textAlign: 'left' }, html: '<b>Owner not running</b> (preempted or asleep) → sleep on the turnstile. Spinning could last for ages.' })),  // rule 2: owner not running, so sleep on the turnstile
              h('div', { class: 'callout warn small m0', 'data-label': 'Common mistake', html: 'Thinking spinning is always wasteful. For a wait shorter than two thread switches, spinning is cheaper, and the spinner gets the lock the instant it is free.' }),  // common-mistake callout: spinning is not always wasteful; short waits favour it
              h('p', { class: 'xs muted m0' }, 'Kernel code running at a high interrupt level is not allowed to sleep, so it uses pure spin mutexes.')),  // small print: high-interrupt-level kernel code may not sleep, so it uses pure spin mutexes
            h('div', { class: 'stack', style: { gap: '9px' } },  // the experiment column
              sl, h('div', { class: 'row gap-s' }, h('span', { class: 'small b' }, 'The owner is'), seg),  // the slider, then the owner-state switch with its label
              h('div', { class: 'card white tight' }, svg),  // the timeline picture in a white card
              h('table', { class: 'tbl compact' }, h('thead', {}, h('tr', {}, h('th', {}, 'Waiter'), h('th', {}, 'Processor time used'), h('th', {}, 'Gets the lock at'))), table),  // the cost table with its headings: waiter, processor time used, gets the lock at
              verdict,  // the verdict box
              h('p', { class: 'xs muted m0' }, `Illustrative numbers: one thread switch costs ${SW} µs; a preempted owner waits about ${PRE.toLocaleString('en-US')} µs for a processor.`))));  // small print stating the made-up switch cost and preemption wait used by the model
          draw();  // draws everything once when the slide opens
        },  // ends render for step 3
      },  // ends step 3

      /* ---------------- 4. Readers/writer lock sandbox ---------------- */
      {  // step 4 begins: the readers/writer lock sandbox
        title: 'Readers/writer lock sandbox',  // the title shown at the top of step 4
        kind: 'explore',  // kind explore: labelled Explore above the title
        render(el, ctx) {  // render(el, ctx): builds the readers/writer sandbox when step 4 opens
          const { h, s } = ctx;  // takes the HTML and SVG builders out of ctx
          const NAMES = ['T1', 'T2', 'T3', 'T4'];  // the four threads the student controls
          let st, tryOnly = false;  // st: the lock state (from rwNew); tryOnly: whether new entries use rw_tryenter instead of rw_enter
          const goals = [['wpref', 'Make a reader wait although no writer is inside'], ['dgWait', 'Downgrade while a writer is waiting'], ['dgAdmit', 'Downgrade and let waiting readers in'], ['upFail', 'Make rw_tryupgrade fail'], ['upOk', 'Make rw_tryupgrade succeed'], ['tryFail', 'Make rw_tryenter return 0']];  // goals: the six challenges, each as [key, description], ticked as the student reaches them
          const done = {};  // done: which challenge keys have been reached so far
          const goalBox = h('div', { class: 'grid-3', style: { gap: '4px 14px' } });  // the grid that lists the challenges with their ticks
          function hit(key) { done[key] = true; }  // hit(key): marks a challenge as reached
          const svg = s('svg', { viewBox: ctx.narrow ? '0 0 360 300' : '0 0 560 206', width: '100%' });  // the lock picture drawn by rwDraw; taller viewBox on phone-width screens
          const narr = h('div', { class: 'narr' });  // the narration box
          const now = h('div', { class: 'small' });  // the Right now summary line
          const cards = h('div', { class: 'grid-4', style: { gap: '10px' } });  // a 4-column grid for the four thread cards
          const list = (a) => a.length === 1 ? a[0] : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];  // list(a): joins names into readable English, e.g. "T1, T2 and T3"
          function say(html, tone) { narr.className = 'narr' + (tone ? ' ' + tone : ''); narr.innerHTML = html; }  // say(html, tone): writes the narration and colours it by tone
          function roleOf(n) { return st.writer === n ? 'W' : st.readers.includes(n) ? 'R' : st.wW.includes(n) ? 'wW' : st.wR.includes(n) ? 'wR' : null; }  // roleOf(n): thread n's role: writer W, reader R, waiting writer wW, waiting reader wR, or null if not using the lock
          function admitted(out) {  // admitted(out): turns rwAdmit's result into a sentence naming who just got in
            if (!out.length) return '';  // nobody admitted: adds nothing
            if (out[0][1] === 'W') return ` Waiting writer <b>${out[0][0]}</b> now gets the lock.`;  // a waiting writer took the lock
            return ` No writer is waiting, so the waiting reader${out.length > 1 ? 's' : ''} <b>${list(out.map((o) => o[0]))}</b> ${out.length > 1 ? 'enter together' : 'enters'}.`;  // otherwise the waiting readers came in together
          }  // ends admitted
          function reset(msg) { st = rwNew(); say(msg || 'Reset. Nobody holds the lock. Give each thread an operation and watch who gets in and who waits.'); draw(); }  // reset(msg): an empty lock, a starting narration, and a redraw
          function enter(n, mode) {  // enter(n, mode): thread n asks for the lock as reader or writer, using rw_enter or rw_tryenter
            const call = `${tryOnly ? 'rw_tryenter' : 'rw_enter'}(${mode === 'R' ? 'RW_READER' : 'RW_WRITER'})`;  // call: the text of the call as written in code, e.g. rw_enter(RW_READER)
            const before = rwClone(st), r = rwEnter(st, n, mode, tryOnly);  // keeps a copy of the state before the call, then runs the call on the real state; r is got, wait or fail
            const why = mode === 'R'  // why: the reason the thread could not get in, used in the narration
              ? (before.writer ? `<b>${before.writer}</b> is writing` : `writer <b>${before.wW[0]}</b> is already waiting, and new readers must not overtake it (otherwise a stream of readers could keep it out forever)`)  // for a reader: someone is writing, or a writer is already waiting and readers must not overtake it
              : (before.writer ? `<b>${before.writer}</b> is writing` : `reader${before.readers.length > 1 ? 's' : ''} <b>${list(before.readers)}</b> ${before.readers.length > 1 ? 'hold' : 'holds'} the lock`);  // for a writer: someone is writing, or readers hold the lock
            if (r === 'wait' && mode === 'R' && !before.writer) hit('wpref');  // a reader made to wait with no writer inside ticks the "writers first" challenge
            if (r === 'fail') hit('tryFail');  // a try call that failed ticks the rw_tryenter challenge
            if (r === 'got') say(mode === 'R' ? `<b>${n}</b> calls ${call}. No writer holds or wants the lock, so ${n} joins the readers. Readers now: <b>${st.readers.length}</b>.` : `<b>${n}</b> calls ${call}. Nobody holds the lock, so ${n} gets it <b>alone</b>.`, 'ok');  // success: a reader joins the others (with the new count), or a writer gets the lock alone
            else if (r === 'fail') say(`<b>${n}</b> calls ${call}, but ${why}. The call <b>returns 0 at once</b>; ${n} is not blocked and keeps running.`);  // try call failed: it returns 0 at once and the thread keeps running
            else say(`<b>${n}</b> calls ${call}, but ${why}. ${n} <b>waits</b> to ${mode === 'R' ? 'read' : 'write'}.`, 'warn');  // ordinary call that must wait: the thread waits to read or to write (amber)
          }  // ends enter
          function exit(n) {  // exit(n): thread n releases the lock
            const was = roleOf(n), out = rwExit(st, n);  // was: the role it had before; out: who rwExit admitted afterwards
            if (was === 'W') say(`<b>${n}</b> finishes writing and calls rw_exit. The lock is free.${admitted(out) || ' Nobody was waiting.'}`, 'ok');  // a writer leaving: the lock is free, plus who got in next, or "Nobody was waiting"
            else say(`<b>${n}</b> stops reading and calls rw_exit. ${st.readers.length ? `${st.readers.length} reader${st.readers.length > 1 ? 's' : ''} still inside.` : 'It was the last reader, so the lock is free.'}${admitted(out)}`, 'ok');  // a reader leaving: how many readers remain, or that it was the last one, plus anyone admitted
          }  // ends exit
          function downgrade(n) {  // downgrade(n): writer n calls rw_downgrade
            const waitW = st.wW.slice(), out = rwDowngrade(st, n);  // remembers which writers were waiting before the call, then downgrades; out lists any readers let in
            if (waitW.length) hit('dgWait'); else if (out.length) hit('dgAdmit');  // ticks the "downgrade while a writer waits" challenge, or the "downgrade and admit readers" one if readers came in
            if (waitW.length) say(`<b>${n}</b> calls rw_downgrade: its write lock becomes a read lock without ever being released. Writer <b>${list(waitW)}</b> is waiting, so it <b>keeps waiting</b>${st.wR.length ? `, and so ${st.wR.length > 1 ? 'do' : 'does'} reader${st.wR.length > 1 ? 's' : ''} ${list(st.wR)}, queued behind it` : ''}.`, 'warn');  // with a writer waiting: amber narration saying the writer keeps waiting, and so do any readers queued behind it
            else say(`<b>${n}</b> calls rw_downgrade: its write lock becomes a read lock without ever being released.${out.length ? admitted(out) : ' Other readers may now join it.'}`, 'ok');  // with no writer waiting: green narration naming the readers admitted, or saying others may now join
          }  // ends downgrade
          function upgrade(n) {  // upgrade(n): reader n calls rw_tryupgrade
            const others = st.readers.filter((x) => x !== n), r = rwTryUpgrade(st, n);  // others: the other readers, used in the narration; r is ok, readers or writer
            hit(r === 'ok' ? 'upOk' : 'upFail');  // ticks the upgrade-succeeded or upgrade-failed challenge
            if (r === 'ok') say(`<b>${n}</b> calls rw_tryupgrade. It is the only reader and no writer is waiting, so the upgrade <b>succeeds</b>: ${n} now holds the write lock, without ever letting go.`, 'ok');  // success: n was the only reader with no writer waiting, so it now holds the write lock without letting go
            else if (r === 'readers') say(`<b>${n}</b> calls rw_tryupgrade, but ${list(others)} also ${others.length > 1 ? 'read' : 'reads'}. It <b>returns 0 at once</b> and ${n} still holds its read lock. If it waited instead, and ${others[0]} tried to upgrade too, each would wait for the other to leave: a deadlock.`, 'bad');  // failure because of other readers: returns 0 at once, and the narration explains the deadlock a waiting upgrade would cause
            else say(`<b>${n}</b> calls rw_tryupgrade, but writer <b>${st.wW[0]}</b> is already waiting. The upgrade fails (returns 0) so that ${n} cannot jump ahead of ${st.wW[0]}; ${n} keeps its read lock.`, 'bad');  // failure because a writer is waiting: n may not jump ahead of it and keeps its read lock
          }  // ends upgrade
          function act(fn) { return () => { fn(); draw(); }; }  // act(fn): wraps an action so a button click runs it and then redraws the slide

          function draw() {  // draw(): repaints the lock picture, the four thread cards, the challenges and the Right now line
            rwDraw(s, svg, st, ctx.narrow);  // draws the lock state with the shared rwDraw helper, in the phone or desktop layout
            const enterCall = tryOnly ? 'rw_tryenter' : 'rw_enter';  // enterCall: the name the enter buttons show, depending on the Call style switch
            cards.replaceChildren(...NAMES.map((n) => {  // rebuilds one card per thread
              const r = roleOf(n);  // r: this thread's current role
              const chip = { W: ['io', 'writer'], R: ['cpu', 'reader'], wW: ['warn', 'waits to write'], wR: ['warn', 'waits to read'] }[r];  // chip: the tag colour and text for the role (writer, reader, waits to write, waits to read); none if not using the lock
              const status = { W: 'Writing, alone', R: 'Reading, shared', wW: 'Asleep, waiting to write', wR: 'Asleep, waiting to read' }[r] || 'Not using the lock';  // status: the card's status line for the role
              const btn = (label, fn) => h('button', { class: 'btn sm', type: 'button', onclick: act(fn) }, label);  // btn(label, fn): one card button that runs fn and then redraws
              const body = !r ? [btn(enterCall + '(RW_READER)', () => enter(n, 'R')), btn(enterCall + '(RW_WRITER)', () => enter(n, 'W'))]  // not using the lock: buttons to enter as reader or as writer
                : r === 'R' ? [btn('rw_exit', () => exit(n)), btn('rw_tryupgrade', () => upgrade(n))]  // a reader: buttons to exit or to try upgrading
                : r === 'W' ? [btn('rw_exit', () => exit(n)), btn('rw_downgrade', () => downgrade(n))]  // the writer: buttons to exit or to downgrade
                : [h('div', { class: 'small muted', style: { height: '66px', display: 'grid', placeItems: 'center', textAlign: 'center', border: '1px dashed var(--line-2)', borderRadius: '8px' } }, 'Cannot run until the lock admits it')];  // a waiting thread: no buttons, only a dashed box saying it cannot run until the lock admits it
              return h('div', { class: 'tcard' + (r === 'wW' || r === 'wR' ? ' wait' : r ? ' hold' : '') },  // the card itself, amber when waiting and green when holding the lock
                h('div', { class: 'row', style: { justifyContent: 'space-between', minHeight: '22px' } }, h('span', { class: 'nm' }, n), chip ? h('span', { class: 'chip ' + chip[0] }, chip[1]) : null),  // top row: the thread's name and its role chip
                h('div', { class: 'st' }, status), ...body);  // the status line, then the buttons or the waiting box
            }));  // ends the card list
            const waits = [...st.wW.map((x) => x + ' (write)'), ...st.wR.map((x) => x + ' (read)')];  // waits: every waiting thread labelled with what it waits for, writers first
            goalBox.replaceChildren(...goals.map(([key, label]) => h('div', { class: 'small', style: { color: done[key] ? 'var(--ok)' : 'var(--ink-2)', fontWeight: done[key] ? 700 : 500 } }, (done[key] ? '✓ ' : '○ ') + label)));  // redraws the challenge list: a green tick for each one reached, an empty circle for the rest
            now.innerHTML = `<b>Right now:</b> ${st.writer ? `${st.writer} is writing.` : st.readers.length ? `${list(st.readers)} ${st.readers.length > 1 ? 'are' : 'is'} reading.` : 'The lock is free.'} ${waits.length ? 'Waiting: ' + list(waits) + '.' : 'Nobody is waiting.'}`;  // the Right now line: who writes or reads, and who waits
          }  // ends draw
          const styleSeg = ctx.ui.seg([{ value: 0, label: 'rw_enter: wait if needed' }, { value: 1, label: 'rw_tryenter: never wait' }], 0, (v) => { tryOnly = !!v; draw(); say(tryOnly ? 'New entries now use <span class="t" data-t="try operation">rw_tryenter</span>: if the requested mode is not available at once, the call returns 0 instead of waiting.' : 'New entries now use <span class="t">rw_enter</span>: a thread that cannot get the mode it asks for waits.'); });  // the Call style switch: rw_enter (wait if needed) or rw_tryenter (never wait); switching redraws and explains the change
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },  // builds the slide as one column
            h('div', { class: 'row', style: { gap: '14px' } }, h('span', { class: 'small b' }, 'Call style'), styleSeg, h('button', { class: 'btn sm', type: 'button', onclick: () => reset() }, 'Reset')),  // top row: the Call style label and switch, and the Reset button
            h('div', { class: 'split', style: { gridTemplateColumns: 'minmax(0, 560px) minmax(0, 1fr)', gap: '18px', height: 'auto' } },  // a two-column row: the picture (up to 560 px wide) and the explanation
              h('div', { class: 'card white tight' }, svg),  // the lock picture in a white card
              h('div', { class: 'stack', style: { gap: '8px' } }, narr, now,  // the explanation column: narration and Right now line
                h('div', { class: 'card tight small', style: { lineHeight: 1.45 }, html: '<b>Rules here: classic Solaris, writers first.</b> A reader may enter if no writer holds the lock <b>or waits for it</b>. A writer enters only if nobody holds it. On release, a waiting writer goes first; if none waits, all waiting readers enter. Newer kernels (illumos) also weigh thread priority when handing on a <span class="t" data-t="readers/writer lock">readers/writer lock</span>.' }))),  // a card stating the writers-first rules this sandbox follows, and that newer kernels also weigh priority
            cards,  // the four thread cards across the slide
            h('div', { class: 'card tight' }, h('div', { class: 'xs b muted', style: { marginBottom: '4px' } }, 'CHALLENGES (TICKED AS YOU REACH THEM)'), goalBox)));  // the challenges card with its small heading and the ticked list
          reset();  // starts with an empty lock
        },  // ends render for step 4
      },  // ends step 4

      /* ---------------- 5. Downgrade and upgrade: predict ---------------- */
      {  // step 5 begins: predict what downgrade and upgrade do, then watch
        title: 'Downgrade and upgrade: predict, then watch',  // the title shown at the top of step 5
        kind: 'predict',  // kind predict: labelled Predict above the title
        render(el, ctx) {  // render(el, ctx): builds the prediction exercise when step 5 opens
          const { h, s } = ctx;  // takes the HTML and SVG builders out of ctx
          const list = (a) => (a.length === 1 ? a[0] : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);  // list(a): joins names into readable English, e.g. "T2 and T3"
          function apply(st, [n, op]) {  // apply(st, [n, op]): runs one scripted operation on the lock state and returns its result
            if (op === 'R' || op === 'W') return rwEnter(st, n, op, false);  // R or W: an ordinary rw_enter as reader or writer
            if (op === 'exit') return rwExit(st, n);  // exit: rw_exit
            if (op === 'down') return rwDowngrade(st, n);  // down: rw_downgrade
            return rwTryUpgrade(st, n);  // anything else (up): rw_tryupgrade
          }  // ends apply
          const SC = [  // SC: the three scenarios, each with a setup, an intro, a question, answer choices and the steps to animate
            { label: 'Downgrade, no writer waiting', setup: [['T1', 'W'], ['T2', 'R'], ['T3', 'R']],  // scenario 1: T1 writes while T2 and T3 wait to read (the setup runs these entries in order)
              intro: 'T1 holds the write lock and is updating a table. T2 and T3 want to read the table, so they wait.',  // intro for scenario 1: T1 updates a table, two readers wait
              q: 'T1 has finished its changes but still wants to read the table. It calls <b>rw_downgrade</b>. What happens to T2 and T3?',  // question 1: what happens to the waiting readers when T1 downgrades
              choices: [  // the choices for scenario 1, each as [text, 1 if right, explanation]
                ['They keep waiting until T1 calls rw_exit.', 0, 'That would happen if a writer were waiting. None is, so downgrading admits the waiting readers at once.'],  // wrong choice: the readers keep waiting, which only happens if a writer waits
                ['They are admitted now and read alongside T1.', 1, 'Right. T1 is now a reader and no writer is in line, so nothing keeps the waiting readers out.'],  // right choice: the readers are admitted at once and read alongside T1
                ['Only T2 gets in; T3 waits for T2 to finish.', 0, 'Readers never shut each other out: every waiting reader is admitted together.'],  // wrong choice: only one reader gets in, but readers never shut each other out
                ['T1 must let go first, so T2 and T3 race for the free lock.', 0, 'The point of rw_downgrade is that T1 never lets go, so no writer can slip in and change the table before T1 reads it.']],  // wrong choice: T1 lets go first, which is exactly what downgrading avoids
              steps: [  // the animation steps for scenario 1, each as [operation, caption function]
                [['T1', 'down'], (st, out) => `T1 calls rw_downgrade. It now holds a <b>read</b> lock, and at no moment was the lock free. No writer is waiting, so ${list(out.map((o) => o[0]))} ${out.length > 1 ? 'are' : 'is'} admitted: <b>${st.readers.length} readers</b> now share the table.`],  // step: T1 downgrades, never freeing the lock, and the waiting readers come in
                [['T1', 'exit'], (st) => `T1 calls rw_exit when it has finished reading. ${list(st.readers)} keep reading undisturbed.`]] },  // step: T1 exits and the other readers keep reading
            { label: 'Downgrade, a writer waiting', setup: [['T1', 'W'], ['T2', 'W'], ['T3', 'R']],  // scenario 2: T1 writes while writer T2 and reader T3 wait
              intro: 'T1 holds the write lock. Writer T2 is waiting for it, and so is reader T3.',  // intro for scenario 2
              q: 'T1 calls <b>rw_downgrade</b>. What happens?',  // question 2: what happens when T1 downgrades with a writer waiting
              choices: [  // the choices for scenario 2
                ['T2 gets the write lock at once.', 0, 'T1 still holds the lock, now as a reader, and a writer must be alone. T2 has to wait until T1 leaves.'],  // wrong choice: T2 writes at once, but T1 still holds the lock as a reader
                ['T3 joins T1 as a reader, since T1 is only reading now.', 0, 'A writer (T2) is already waiting. Letting new readers pass it could keep T2 out forever, so T3 stays queued behind T2.'],  // wrong choice: T3 joins as a reader, which would let readers overtake a waiting writer
                ['T1 reads alone; T2 and T3 keep waiting.', 1, 'Right. Downgrading never lets a writer in early, and under the classic Solaris rule no extra readers are admitted while a writer is in line.']],  // right choice: T1 reads alone while T2 and T3 keep waiting
              steps: [  // the animation steps for scenario 2
                [['T1', 'down'], (st) => `T1 downgrades and now reads alone. Writer ${st.wW[0]} is waiting, so it <b>keeps waiting</b>, and reader ${list(st.wR)} stays queued behind it.`],  // step: T1 downgrades and reads alone; the writer and reader keep waiting
                [['T1', 'exit'], (st) => `T1 calls rw_exit. The lock is free, and the waiting writer goes first: <b>${st.writer}</b> gets the write lock. ${list(st.wR)} still waits.`],  // step: T1 exits and the waiting writer T2 gets the lock first
                [['T2', 'exit'], (st, out) => `T2 finishes writing and calls rw_exit. No writer is waiting now, so ${list(out.map((o) => o[0]))} ${out.length > 1 ? 'are' : 'is'} admitted as a reader.`]] },  // step: T2 exits and, with no writer left, reader T3 is admitted
            { label: 'Two readers want to write', setup: [['T1', 'R'], ['T2', 'R']],  // scenario 3: T1 and T2 both hold read locks
              intro: 'T1 and T2 both hold read locks. Each one discovers that it needs to change the data.',  // intro for scenario 3: both readers discover they must write
              q: 'Both call <b>rw_tryupgrade</b>, one after the other. What happens?',  // question 3: what happens when both try to upgrade
              choices: [  // the choices for scenario 3
                ['T1 succeeds because it asked first.', 0, 'T2 still holds a read lock, and a writer must be alone. T1 cannot become the writer while T2 reads.'],  // wrong choice: the first to ask wins, but the other reader is still inside
                ['Both fail at once and keep their read locks.', 1, 'Right. Each sees another reader, so each try returns 0 immediately, and nobody is stuck.'],  // right choice: both fail at once and keep their read locks
                ['Each waits until the other leaves, then upgrades.', 0, 'That is exactly the deadlock a try operation avoids: T1 would wait for T2 and T2 for T1, forever. That is why the Solaris kernel offers only a try version of upgrade.']],  // wrong choice: each waits for the other, the deadlock a try operation avoids
              steps: [  // the animation steps for scenario 3
                [['T1', 'up'], (st, r) => `T1 calls rw_tryupgrade. ${r === 'readers' ? 'T2 is also reading, so it <b>returns 0</b>.' : ''} T1 keeps its read lock and keeps running.`],  // step: T1's upgrade fails because T2 also reads
                [['T2', 'up'], (st, r) => `T2 calls rw_tryupgrade. ${r === 'readers' ? 'T1 is also reading, so it <b>returns 0</b> too.' : ''} Both keep running; nobody is deadlocked.`],  // step: T2's upgrade fails too; nobody is stuck
                [['T2', 'exit'], () => 'T2 gives up its read lock with rw_exit. It can ask for the write lock later with rw_enter(RW_WRITER).'],  // step: T2 gives up its read lock with rw_exit
                [['T1', 'up'], (st, r) => `T1 tries again. ${r === 'ok' ? 'It is now the only reader and no writer waits, so the upgrade <b>succeeds</b>: T1 holds the write lock.' : 'It fails again.'}`]] },  // step: T1 tries again and now succeeds as the only reader; also closes scenario 3
          ];  // closes the SC list
          let sc = 0;  // sc: which scenario is showing (0, 1 or 2)
          const svg = s('svg', { viewBox: ctx.narrow ? '0 0 360 300' : '0 0 560 206', width: '100%' });  // the lock picture drawn by rwDraw; taller viewBox on phone-width screens
          const intro = h('p', { class: 'm0' });  // paragraph that shows the scenario's intro
          const qEl = h('p', { class: 'm0', style: { fontSize: '17.5px' } });  // paragraph that shows the question, in slightly larger type
          const choiceBox = h('div', { class: 'stack', style: { gap: '6px' } });  // column that will hold the answer buttons
          const fb = h('div', { class: 'narr', style: { display: 'none' } });  // the feedback box, hidden until an answer is picked
          function frames() {  // frames(): builds the animation frames for the current scenario by actually running its operations
            const S = SC[sc], st = rwNew();  // S: the scenario; st: a fresh, empty lock
            S.setup.forEach((o) => apply(st, o));  // runs the setup operations so the lock starts in the scenario's situation
            const out = [{ st: rwClone(st), cap: `<b>Start.</b> ${S.intro} Make your prediction, then step forward.` }];  // frame 1: a snapshot of the starting state with a Start caption asking for a prediction
            S.steps.forEach(([op, cap]) => { const r = apply(st, op); out.push({ st: rwClone(st), cap: cap(st, r) }); });  // for each scripted step: runs it, then saves a snapshot and the caption built from the result
            return out;  // hands back the list of frames
          }  // ends frames
          let F = frames();  // F: the frames of the scenario on screen
          const player = ctx.ui.player({ count: F.length, interval: 2600, render: (i) => { rwDraw(s, svg, F[i].st, ctx.narrow); return F[i].cap; } });  // the animation player (Play, Step, Restart buttons): each frame redraws the lock picture and returns its caption
          let answered = false;  // answered: whether the student has already picked an answer for this scenario
          function pick(i, btns) {  // pick(i, btns): handles a click on answer i
            if (answered) return;  // only the first answer counts
            answered = true;  // locks the question
            const c = SC[sc].choices[i];  // c: the chosen answer as [text, right, explanation]
            btns.forEach((b, j) => {  // marks up every answer button
              const right = !!SC[sc].choices[j][1];  // right: whether this button is the correct answer
              b.setAttribute('aria-disabled', 'true'); b.style.cursor = 'default';  // disables the button for screen readers and drops the pointer cursor
              if (right || j === i) { b.style.borderColor = right ? 'var(--ok)' : 'var(--bad)'; b.style.borderWidth = '2px'; b.style.background = right ? 'var(--ok-bg)' : 'var(--bad-bg)'; b.textContent = (right ? '✓ ' : '✗ ') + SC[sc].choices[j][0]; }  // the right answer and the chosen one get a coloured border and background and a tick or cross
              else b.style.opacity = '0.6';  // the other buttons fade
            });  // ends the loop over buttons
            fb.style.display = '';  // shows the feedback box
            fb.className = 'narr ' + (c[1] ? 'ok' : 'bad');  // green feedback for a right answer, red for a wrong one
            fb.innerHTML = (c[1] ? '' : '<b>Not quite.</b> ') + c[2];  // the explanation, preceded by "Not quite." when wrong
            player.go(1);  // moves the player to the first real step so the student can watch the outcome
          }  // ends pick
          function load(i) {  // load(i): switches to scenario i and resets the question
            sc = i; F = frames(); answered = false; player.stop();  // stores the choice, rebuilds the frames, clears the answered flag and stops any playback
            intro.textContent = SC[sc].intro;  // shows the new intro
            qEl.innerHTML = SC[sc].q;  // shows the new question
            fb.style.display = 'none';  // hides the old feedback
            const btns = SC[sc].choices.map((c, j) => h('button', { class: 'btn', type: 'button', style: { whiteSpace: 'normal', height: 'auto', minHeight: '36px', padding: '6px 12px', justifyContent: 'flex-start', textAlign: 'left' }, onclick: () => pick(j, btns) }, c[0]));  // one full-width, left-aligned button per answer choice; clicking calls pick
            choiceBox.replaceChildren(...btns);  // puts the new buttons in place
            player.setCount(F.length);  // tells the player how many frames there are now, which also returns it to the first frame
          }  // ends load
          const seg = ctx.ui.seg(SC.map((x, i) => ({ value: i, label: x.label })), 0, load);  // the scenario switch: one button per scenario label; choosing one calls load
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },  // builds the slide as one column
            h('div', { class: 'row' }, seg),  // top row: the scenario switch
            h('div', { class: 'split grow', style: { gridTemplateColumns: 'minmax(0, 5fr) minmax(0, 6fr)', gap: '20px' } },  // two columns below: the question (5 parts) and the animation (6 parts)
              h('div', { class: 'stack', style: { gap: '8px' } }, intro, qEl, choiceBox, fb,  // left column: intro, question, answer buttons and feedback
                h('div', { class: 'callout why small m0', style: { marginTop: 'auto' }, 'data-label': 'Why downgrade exists', html: 'A writer often wants to keep reading what it just wrote. Releasing and re-entering as a reader would leave a gap in which another writer could change the data. <span class="t">rw_downgrade</span> closes that gap, and lets waiting readers in sooner.' })),  // why-callout pinned to the bottom: why downgrade exists (no gap for another writer to slip in)
              h('div', { class: 'stack', style: { gap: '8px' } }, h('div', { class: 'card white tight' }, svg), player.el,  // right column: the lock picture in a white card, then the player
                h('div', { class: 'callout tip small m0', 'data-label': 'Pattern', html: 'When <span class="t">rw_tryupgrade</span> fails: call rw_exit, then rw_enter(RW_WRITER), then <b>re-check the data</b>, because another writer may have changed it while you held no lock.' })))));  // tip callout: what to do when rw_tryupgrade fails, including re-checking the data
          load(0);  // opens the first scenario when the slide loads
        },  // ends render for step 5
      },  // ends step 5

      /* ---------------- 6. Condition variables: inside cv_wait ---------------- */
      {  // step 6 begins: an animation of what happens inside cv_wait
        title: 'Condition variables: what cv_wait really does',  // the title shown at the top of step 6
        kind: 'learn',  // kind learn: labelled Learn above the title
        render(el, ctx) {  // render(el, ctx): builds the cv_wait animation when step 6 opens
          const { h, s } = ctx;  // takes the HTML and SVG builders out of ctx
          const SCRIPT = {  // SCRIPT: the order of actions for each version, each as [thread, action]
            atomic: [['C', 'enter'], ['C', 'test'], ['C', 'wait'], ['P', 'enter'], ['P', 'put'], ['P', 'signal'], ['P', 'exit'], ['C', 'reacq'], ['C', 'test'], ['C', 'take'], ['C', 'exit']],  // the real version: consumer C locks, tests, waits; producer P locks, puts, signals, exits; C gets m back, re-tests, takes and exits
            broken: [['C', 'enter'], ['C', 'test'], ['C', 'release'], ['P', 'enter'], ['P', 'put'], ['P', 'signal'], ['P', 'exit'], ['C', 'sleep']],  // the broken version: C releases m and only later goes to sleep, with P's whole turn happening in the gap
          };  // closes SCRIPT
          // Runs the script and records the state after every action, so each frame is computed, not typed.
          function run(mode) {  // run(mode): plays the chosen script and returns one state snapshot per action
            const st = { owner: null, sleepers: [], count: 0, cs: 'running', ps: 'not started yet', cl: null, pl: null, lost: false, test: null };  // st: m's owner, the sleepers, the queue count, each thread's status, the code line each is on, whether a signal was lost, and the last test result
            const out = [{ ...st, sleepers: [], act: null }];  // frame 1 is the untouched starting state, with no action highlighted
            SCRIPT[mode].forEach(([who, a]) => {  // goes through the script one action at a time
              st.lost = false;  // a lost signal only shows in the frame where it happens
              if (who === 'C') {  // the consumer's actions
                if (a === 'enter') { st.owner = 'C'; st.cl = 1; }  // enter: C owns m and is on line 1
                if (a === 'test') { st.cl = 2; st.test = st.count === 0; }  // test: C is on line 2 and records whether the queue is empty
                if (a === 'wait') { st.cl = 3; st.owner = null; st.sleepers.push('C'); st.cs = 'asleep on nonempty'; }  // wait (real version): on line 3, C gives up m and joins the sleepers in the same action
                if (a === 'release') { st.cl = 3; st.owner = null; st.cs = 'released m, not asleep yet'; }  // release (broken version): C gives up m but is not asleep yet
                if (a === 'sleep') { st.cl = 3; st.sleepers.push('C'); st.cs = 'asleep on nonempty'; }  // sleep (broken version): only now does C join the sleepers
                if (a === 'reacq') { st.cl = 3; st.owner = 'C'; st.cs = 'running'; }  // reacq: C has m again and cv_wait can return
                if (a === 'take') { st.cl = 4; st.count -= 1; }  // take: C on line 4 removes an item, so the count drops by 1
                if (a === 'exit') { st.cl = 5; st.owner = null; st.cs = 'done'; }  // exit: C on line 5 releases m and is done
              } else {  // the producer's actions
                st.ps = 'running';  // P is running from its first action on
                if (a === 'enter') { st.owner = 'P'; st.pl = 1; }  // enter: P owns m and is on line 1
                if (a === 'put') { st.pl = 2; st.count += 1; }  // put: P on line 2 adds an item, so the count goes up by 1
                if (a === 'signal') { st.pl = 3; if (st.sleepers.length) { st.sleepers.shift(); st.cs = 'woken: needs m back'; } else st.lost = true; }  // signal: P on line 3 wakes the first sleeper, which still needs m back; with no sleeper, the signal is lost
                if (a === 'exit') { st.pl = 4; st.owner = null; st.ps = 'done'; }  // exit: P on line 4 releases m and is done
              }  // ends the producer's actions
              out.push({ ...st, sleepers: st.sleepers.slice(), act: [who, a] });  // saves a copy of the state (with its own sleepers list) and which action produced it
            });  // ends the loop over the script
            return out;  // hands back the frames
          }  // ends run
          const CAP = {  // CAP: the caption for each action, keyed as "thread action"; some read the frame to fill in numbers
            'C enter': () => 'C calls <b>mutex_enter(&amp;m)</b>. The lock is free, so C now owns m and may look at the shared queue.',  // caption: C locks m and may look at the queue
            'C test': (f) => f.test ? `C tests <b>count == 0</b>: count is ${f.count}, so the queue is empty and C must wait.` : `C re-tests <b>count == 0</b>: count is ${f.count}, so the test is false and C leaves the loop.`,  // caption: the first test finds the queue empty, or the re-test finds an item and leaves the loop
            'C wait': () => 'C calls <b>cv_wait(&amp;nonempty, &amp;m)</b>. In <b>one atomic step</b> it releases m and goes to sleep on nonempty. Releasing m matters: otherwise P could never get in to add an item.',  // caption: cv_wait releases m and sleeps in one atomic step, which is what lets P get in
            'P enter': () => 'P calls <b>mutex_enter(&amp;m)</b>. m is free (C gave it up inside cv_wait), so P owns it now.',  // caption: P gets m because C gave it up inside cv_wait
            'P put': (f) => `P adds an item: count becomes <b>${f.count}</b>.`,  // caption: P adds an item and the new count
            'P signal': (f) => f.lost ? 'P calls <b>cv_signal(&amp;nonempty)</b>, but <b>nobody is asleep</b> on nonempty yet. A condition variable keeps no count, so this wake-up is simply <b>lost</b>.' : 'P calls <b>cv_signal(&amp;nonempty)</b>. C is woken, but cv_wait cannot return yet: C must first get m back, and P still holds it.',  // caption: the signal is lost if nobody sleeps yet; otherwise C wakes but must still get m back from P
            'P exit': () => 'P calls <b>mutex_exit(&amp;m)</b>. m is free again.',  // caption: P releases m
            'C reacq': () => 'C wins m back. Only now does <b>cv_wait return</b>, with m held, exactly as it was before the call.',  // caption: C wins m back, and only then does cv_wait return
            'C take': (f) => `C takes the item: count becomes <b>${f.count}</b>. Safe: C holds m and has just checked that count was above 0.`,  // caption: C takes the item safely, holding m and having checked the count
            'C exit': () => 'C calls <b>mutex_exit(&amp;m)</b>. Done: the item went from P to C with no race and no busy waiting.',  // caption: C releases m; the hand-over had no race and no busy waiting
            'C release': () => 'Suppose cv_wait were two separate steps. Step one: C releases m. C is <b>not asleep yet</b>.',  // caption for the broken version: C releases m but is not asleep yet
            'C sleep': (f) => `Step two: C goes to sleep on nonempty, although count is ${f.count}. The signal for this item was already lost, so C may <b>sleep forever</b>. That gap is exactly why cv_wait releases and sleeps in one atomic step.`,  // caption for the broken version: C now sleeps although an item is there; the signal was lost, so it may sleep forever
          };  // closes CAP
          let mode = 'atomic', F = run(mode);  // mode: which version is showing (atomic first); F: its frames
          const C_SRC = `${/* C_SRC: the consumer's C code shown on screen, each line followed by its own on-screen comment */''}
mutex_enter(&m);            // lock the shared queue${/* shown code, consumer line 1: lock the queue with mutex_enter */''}
while (count == 0)          // empty? re-test on every wake-up${/* shown code, consumer line 2: the while loop that tests for an empty queue and re-tests after each wake-up */''}
    cv_wait(&nonempty, &m); // release m + sleep; relock on wake${/* shown code, consumer line 3: cv_wait releases m and sleeps, then relocks m on wake */''}
item = take();              // m held, count > 0: safe${/* shown code, consumer line 4: take an item, safe because m is held and the count is above 0 */''}
mutex_exit(&m);             // unlock the queue`;  // shown code, consumer line 5: unlock the queue; also ends the consumer's code text
          const P_SRC = `${/* P_SRC: the producer's C code shown on screen */''}
mutex_enter(&m);            // lock the shared queue${/* shown code, producer line 1: lock the queue */''}
put(item);                  // add one item: count + 1${/* shown code, producer line 2: add one item */''}
cv_signal(&nonempty);       // wake one sleeping consumer, if any${/* shown code, producer line 3: wake one sleeping consumer, if there is one */''}
mutex_exit(&m);             // unlock the queue`;  // shown code, producer line 4: unlock the queue; also ends the producer's code text
          // On a small screen each comment moves onto its own line above the statement, so nothing scrolls sideways.
          const slim = ctx.narrow;  // slim: true on phone-width screens, where the code listings are rearranged
          const stack2 = (src) => src.replace(/^\n/, '').split('\n').map((l) => { const [code, com] = l.split('// '); const ind = code.match(/^ */)[0].replace(/ {4}/, '  '); return ind + '// ' + com + '\n' + ind + code.trim(); }).join('\n');  // stack2(src): splits each line at its comment and puts the comment on its own line above the code, with indents halved to 2 spaces
          const cCode = ctx.ui.code(slim ? stack2(C_SRC) : C_SRC, { lang: 'c', fontSize: slim ? 13 : 13.5 });  // the consumer's listing, coloured as C code, rearranged on small screens
          const pCode = ctx.ui.code(slim ? stack2(P_SRC) : P_SRC, { lang: 'c', fontSize: slim ? 13 : 13.5 });  // the producer's listing, built the same way
          const lines = (n) => (slim ? [2 * n - 1, 2 * n] : n);  // lines(n): which listing lines belong to code line n; on small screens each statement has two lines (comment, then code)
          const svg = s('svg', { viewBox: ctx.narrow ? '0 0 340 300' : '0 0 520 198', width: '100%' });  // the picture of the two threads, mutex m, condition variable and queue; taller viewBox on phone-width screens
          // Wide screens: threads left and right of the mutex. Small screens: threads stacked, objects below.
          const D = slim  // D: positions and sizes for the picture, picked for the layout
            ? { thr: [['C', 40, 40], ['P', 40, 118]], tokS: 52, txtX: 80, roleDy: -12, statDy: 8, holdDy: 27,  // phone layout: C and P stacked on the left with their labels to the right of each token
              mbox: [8, 186, 152, 76], mT: [84, 208], mV: [84, 246, 22], cT: [256, 180], cbox: [182, 188, 150, 52], cTok: [256, 214], q: [8, 290], qItems: 250 }  // phone layout continued: the mutex box and the condition-variable box side by side below, the queue line at the bottom
            : { thr: [['C', 90, 46], ['P', 430, 46]], tokS: 60, txtX: null, roleDy: 56, statDy: 75, holdDy: 93,  // desktop layout: C on the left, P on the right, labels under each token
              mbox: [196, 8, 128, 76], mT: [260, 30], mV: [260, 68, 25], cT: [260, 104], cbox: [196, 111, 128, 46], cTok: [260, 134], q: [196, 187], qItems: 400 };  // desktop layout continued: the mutex box, the condition-variable box and the queue line stacked in the middle
          function draw(f) {  // draw(f): repaints the picture for frame f and highlights the code lines each thread is on
            const k = [];  // k collects the shapes
            D.thr.forEach(([n, x, y]) => {  // draws the two threads, C and P, at their positions
              const status = n === 'C' ? f.cs : f.ps, role = n === 'C' ? 'consumer' : 'producer';  // status: the thread's status word from the frame; role: consumer or producer
              const cls = f.owner === n ? 's-ok' : /asleep|needs|not asleep/.test(status) ? 's-warn' : 's-thread';  // cls: green if it holds m, amber if asleep or waiting for m, the plain thread colour otherwise
              const hs = D.tokS / 2 + 7, tx = D.txtX || x, anchor = D.txtX ? 'start' : 'middle', ty = D.txtX ? y + 4 : y;  // hs: half the size of the highlight frame; tx, anchor and ty place the labels beside (phone) or under (desktop) the token
              if (f.act && f.act[0] === n) k.push(s('rect', { x: x - hs, y: y - hs, width: 2 * hs, height: 2 * hs, rx: 16, class: 's-accent', 'stroke-width': 3 }));  // the thread that acted in this frame gets a highlight frame around its token
              k.push(tok(s, x, y, n, cls, D.tokS, D.tokS, 26));  // the thread's token with its letter
              k.push(s('text', { x: tx, y: ty + D.roleDy, 'text-anchor': anchor, class: 's-sub', 'font-size': 13 }, role));  // its role label, consumer or producer
              k.push(s('text', { x: tx, y: ty + D.statDy, 'text-anchor': anchor, 'font-size': 14, 'font-weight': 700, style: cls === 's-warn' ? 'fill:var(--warn)' : '' }, status));  // its status line, amber when it is waiting
              if (f.owner === n) k.push(s('text', { x: tx, y: ty + D.holdDy, 'text-anchor': anchor, 'font-size': 13, 'font-weight': 700, style: 'fill:var(--ok)' }, 'holds m'));  // a green "holds m" line when this thread owns the mutex
            });  // ends the loop over threads
            const [mx, my, mw, mh] = D.mbox, [bx, by, bw, bh] = D.cbox;  // unpacks the positions and sizes of the mutex box and the condition-variable box
            k.push(s('rect', { x: mx, y: my, width: mw, height: mh, rx: 14, class: 's-os', 'stroke-width': 2 }));  // the mutex box
            k.push(s('text', { x: D.mT[0], y: D.mT[1], 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 15 }, 'mutex m'));  // the mutex box's title, mutex m
            k.push(s('text', { x: D.mV[0], y: D.mV[1], 'text-anchor': 'middle', 'font-weight': 900, 'font-size': D.mV[2], style: f.owner ? 'fill:var(--ok)' : 'fill:var(--muted)' }, f.owner ? 'owner ' + f.owner : 'free'));  // who owns m, in green, or a grey "free"
            k.push(s('text', { x: D.cT[0], y: D.cT[1], 'text-anchor': 'middle', 'font-weight': 700, 'font-size': 14 }, slim ? 'cv nonempty' : 'cv nonempty: sleepers'));  // the condition variable's title (shorter on phone-width screens)
            k.push(s('rect', { x: bx, y: by, width: bw, height: bh, rx: 12, class: f.lost ? 's-bad' : 's-panel', 'stroke-width': 2 }));  // the condition variable's box, red in the frame where a signal is lost
            if (f.sleepers.length) k.push(tok(s, D.cTok[0], D.cTok[1], f.sleepers[0], 's-warn', 44, 34, 18));  // the first sleeper's token, if anyone sleeps on the condition variable
            else k.push(s('text', { x: D.cTok[0], y: D.cTok[1] + 5, 'text-anchor': 'middle', class: f.lost ? null : 's-sub', 'font-size': 14, 'font-weight': f.lost ? 800 : 400, style: f.lost ? 'fill:var(--bad)' : null }, f.lost ? 'signal lost!' : 'nobody asleep'));  // otherwise the box says nobody asleep, or a red "signal lost!" in the frame where the signal went unheard
            k.push(s('text', { x: D.q[0], y: D.q[1], 'font-size': 15, 'font-weight': 700 }, `shared queue: count = ${f.count}`));  // the queue's label with its count
            for (let i = 0; i < f.count; i++) k.push(s('rect', { x: D.qItems + i * 30, y: D.q[1] - 17, width: 24, height: 24, rx: 5, class: 's-mem', 'stroke-width': 2 }));  // one small square per item in the queue
            if (!f.count) k.push(s('text', { x: D.qItems, y: D.q[1], class: 's-sub', 'font-size': 14 }, '(empty)'));  // an empty queue shows (empty)
            svg.replaceChildren(...k);  // swaps the new shapes into the picture
            [cCode, pCode].forEach((c) => { c.clear(); c.clear('here'); });  // clears every highlight from both code listings
            if (f.cl) cCode.mark(lines(f.cl), f.act && f.act[0] === 'C' ? 'cur' : 'here');  // marks the consumer's current line: the strong cur style if C just acted, the faint here style if it is paused there
            if (f.pl) pCode.mark(lines(f.pl), f.act && f.act[0] === 'P' ? 'cur' : 'here');  // marks the producer's current line the same way
          }  // ends draw
          const player = ctx.ui.player({ count: F.length, interval: 2400, render: (i) => {  // the animation player: each frame redraws the picture and returns its caption
            const f = F[i]; draw(f);  // f: the frame to show; draws it
            if (!f.act) return mode === 'atomic' ? '<b>Start.</b> The queue is empty. Consumer C wants an item; producer P will add one. Step through and watch m, the sleepers and the count.' : '<b>Start.</b> Same story, but now imagine cv_wait released m and went to sleep as <b>two separate steps</b>.';  // the first frame has no action: a Start caption that differs for the real and the broken version
            return CAP[f.act.join(' ')](f);  // any other frame: the caption from CAP for its action
          } });  // ends the player settings
          const seg = ctx.ui.seg([{ value: 'atomic', label: 'Real cv_wait (atomic)' }, { value: 'broken', label: 'Broken: release, then sleep' }], mode, (v) => { mode = v; F = run(mode); player.stop(); player.setCount(F.length); });  // the version switch: real (atomic) cv_wait or the broken release-then-sleep version; switching rebuilds the frames
          const flow = h('div', { class: 'card tight', style: { display: 'grid', gridTemplateColumns: slim ? '1fr' : '1.25fr auto 1fr auto 1fr auto 1fr', alignItems: 'center', justifyItems: slim ? 'center' : null, gap: slim ? '2px' : '6px' } },  // flow: a card showing the four stages of one cv_wait call, in a row (desktop) or a column (phone)
            ...[['os', 'release m + sleep', 'one atomic step'], ['intr', 'woken', 'signal or broadcast'], ['thread', 'get m back', 'may have to wait'], ['ok', 'return', 'm held: re-test']].flatMap(([c, a, b], i) => [  // the four stages, each with a colour, a name and a small note: release and sleep, woken, get m back, return
              ...(i ? [h('span', { class: 'b muted' }, slim ? '↓' : '→')] : []),  // an arrow between stages: pointing right on desktop, down on phone-width screens
              h('div', { class: 'box ' + c, style: { padding: '5px 6px', fontSize: '14px', lineHeight: 1.25 } }, a, h('div', { class: 'xs muted', style: { fontWeight: 500 } }, b))]));  // one coloured box per stage, with its note in small grey print
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: 'minmax(0, 580px) minmax(0, 1fr)', gap: '20px' } },  // builds the slide in two columns: code on the left (up to 580 px), animation on the right
            h('div', { class: 'stack', style: { gap: '8px' } },  // the left column
              h('p', { class: 'm0', html: 'A condition variable lets a thread sleep until some condition about shared data holds. It is always paired with a <span class="t">mutex lock</span> that protects that data; together they act as a monitor.' }),  // paragraph: what a condition variable is, and that it always pairs with a mutex lock, together acting as a monitor
              h('div', { class: 'xs b muted' }, 'CONSUMER C (WAITS FOR AN ITEM)'), cCode,  // small heading and the consumer's code listing
              h('div', { class: 'xs b muted' }, 'PRODUCER P (ADDS AN ITEM)'), pCode,  // small heading and the producer's code listing
              h('div', { class: 'xs b muted' }, 'THE LIFE OF ONE cv_wait CALL'), flow),  // small heading and the four-stage flow card
            h('div', { class: 'stack', style: { gap: '8px' } }, h('div', { class: 'row' }, seg), h('div', { class: 'card white tight' }, svg), player.el,  // the right column: the version switch, the picture in a white card, and the player
              h('div', { class: 'callout warn small m0', 'data-label': 'Common mistake', html: 'Thinking <span class="t">cv_signal</span> hands m to the woken thread. It only wakes it; the woken thread must win m back before <span class="t">cv_wait</span> returns, and by then the condition may have changed. <span class="t">cv_broadcast</span> wakes every sleeper the same way.' }))));  // common-mistake callout: cv_signal only wakes a thread, it does not hand it m
        },  // ends render for step 6
      },  // ends step 6

      /* ---------------- 7. Lab: if versus while ---------------- */
      {  // step 7 begins: the lab where the student schedules threads and finds the if-versus-while bug
        title: 'If or while? You schedule the threads',  // the title shown at the top of step 7
        kind: 'lab',  // kind lab: labelled Hands-on Lab above the title
        core: true,  // core: true keeps this step in the shorter core route through the guide
        render(el, ctx) {  // render(el, ctx): builds the lab when step 7 opens
          const { h, s } = ctx;  // takes the HTML and SVG builders out of ctx
          let mode = 'if', wake = 'signal', gen = 0;  // mode: if or while; wake: signal or broadcast; gen counts restarts so an old automatic replay knows to stop
          let owner, sleepers, count, th, produced, bug;  // owner of m, threads asleep on nonempty, queue count, thread records, items made, and whether the bug happened
          const narr = h('div', { class: 'narr' });  // the narration box
          const log = h('div', { class: 'log grow', style: { minHeight: '46px' } });  // the event log, newest first
          function say(html, tone) { narr.className = 'narr' + (tone ? ' ' + tone : ''); narr.innerHTML = html; }  // say(html, tone): writes the narration and colours it by tone
          function logLine(t) { log.prepend(h('div', {}, t)); while (log.children.length > 40) log.lastChild.remove(); }  // logLine(t): adds a line to the top of the log and keeps only the newest 40
          function reset(msg) {  // reset(msg): puts every thread back on line 1 with an empty queue and a free m, then redraws
            owner = null; sleepers = []; count = 0; produced = 0; bug = false;  // clears m, the sleepers, the queue, the production count and the bug flag
            th = [{ n: 'C1', kind: 'C', pc: 1, st: 'ready', inWait: false, took: 0 }, { n: 'C2', kind: 'C', pc: 1, st: 'ready', inWait: false, took: 0 }, { n: 'P', kind: 'P', pc: 1, st: 'ready', inWait: false }];  // three thread records: consumers C1 and C2 and producer P, each on line 1 (pc), ready, not inside cv_wait
            log.innerHTML = ''; logLine('start: queue empty, m free');  // empties the log and writes the starting state
            say(msg || 'You are the scheduler. Click <b>Run next line</b> on any thread to let it execute exactly one line. Try to make a consumer take an item that is not there, or press <b>Play the troublesome schedule</b>.');  // narration: the given message, or the default that invites the student to act as the scheduler
            draw();  // redraws everything
          }  // ends reset
          const T = (n) => th.find((x) => x.n === n);  // T(n): finds a thread's record by its name
          // Releasing m makes every thread that was blocked waiting for m ready to try again.
          function releaseM() { owner = null; th.forEach((x) => { if (x.st === 'blockedM') x.st = 'ready'; }); }  // releaseM(): frees m and makes every thread that was waiting for m ready to try again
          function step(t) {  // step(t): runs exactly one line of code for thread t
            const L = t.pc;  // L: the line number this thread will run now (pc, its program counter)
            if (t.kind === 'P') {  // the producer's four lines
              if (L === 1) {  // producer line 1: mutex_enter
                if (owner) { t.st = 'blockedM'; say(`<b>P</b> calls mutex_enter, but <b>${owner}</b> holds m, so P waits for m.`, 'warn'); return logLine('P: mutex_enter → waits for m'); }  // m is taken: P is blocked waiting for m and stays on line 1 to try again later
                owner = 'P'; t.pc = 2; say('<b>P</b> locks m with mutex_enter.'); return logLine('P: mutex_enter → owns m');  // m is free: P owns it and moves on to line 2
              }  // ends producer line 1
              if (L === 2) { count++; produced++; t.pc = 3; say(`<b>P</b> puts an item in the queue: count = <b>${count}</b>.`, 'ok'); return logLine(`P: put → count ${count}`); }  // producer line 2: puts an item in the queue, counts it as made, and moves to line 3
              if (L === 3) {  // producer line 3: cv_signal or cv_broadcast
                t.pc = 4;  // moves P on to line 4 first
                const woke = wake === 'signal' ? sleepers.splice(0, 1) : sleepers.splice(0);  // woke: the first sleeper for a signal, or every sleeper for a broadcast, removed from the sleepers list
                woke.forEach((n) => { T(n).st = 'woken'; });  // each woken consumer is marked woken: it still has to get m back
                if (!woke.length) say(`<b>P</b> calls cv_${wake}(&amp;nonempty), but nobody is asleep. Nothing happens, and nothing is remembered.`);  // nobody was asleep: the narration says the call did nothing and nothing is remembered
                else say(`<b>P</b> calls cv_${wake}(&amp;nonempty): <b>${woke.join(' and ')}</b> ${woke.length > 1 ? 'wake' : 'wakes'} up. ${woke.length > 1 ? 'Each' : 'It'} must get m back before cv_wait can return, and P still holds m.`, 'ok');  // otherwise the narration names who woke and stresses that P still holds m
                return logLine(`P: cv_${wake} → ${woke.length ? woke.join(', ') + ' woken' : 'nobody asleep'}`);  // logs who was woken, if anyone
              }  // ends producer line 3
              releaseM(); t.pc = 1; say('<b>P</b> unlocks m. It loops back to make the next item whenever you run it again.'); return logLine('P: mutex_exit');  // producer line 4: mutex_exit frees m and P goes back to line 1 to make another item
            }  // ends the producer's lines
            // consumers
            if (L === 1) {  // consumer line 1: mutex_enter
              if (owner) { t.st = 'blockedM'; say(`<b>${t.n}</b> calls mutex_enter, but <b>${owner}</b> holds m, so ${t.n} waits for m.`, 'warn'); return logLine(`${t.n}: mutex_enter → waits for m`); }  // m is taken: the consumer is blocked waiting for m
              owner = t.n; t.pc = 2; say(`<b>${t.n}</b> locks m with mutex_enter.`); return logLine(`${t.n}: mutex_enter → owns m`);  // m is free: the consumer owns it and moves on to line 2
            }  // ends consumer line 1
            if (L === 2) {  // consumer line 2: the if or while test on count == 0
              const empty = count === 0; t.pc = empty ? 3 : 4;  // empty: next stop is cv_wait on line 3; not empty: straight to take() on line 4
              say(`<b>${t.n}</b> tests <code>count == 0</code>: count is ${count}, so the test is <b>${empty}</b>${empty ? `, and ${t.n} heads into cv_wait` : `, and ${t.n} goes on to take an item`}.`);  // narration: the test's result and where the consumer goes next
              return logLine(`${t.n}: ${mode} (count == 0) → ${empty}`);  // logs the test as written (if or while) and its result
            }  // ends consumer line 2
            if (L === 3 && !t.inWait) {  // consumer line 3, first visit: entering cv_wait
              releaseM(); sleepers.push(t.n); t.st = 'asleep'; t.inWait = true;  // releases m and joins the sleepers in one move, the atomic part of cv_wait
              say(`<b>${t.n}</b> calls cv_wait: it releases m and falls asleep on nonempty, in one atomic step.`, 'warn');  // narration: release and sleep happen in one atomic step
              return logLine(`${t.n}: cv_wait → asleep, m released`);  // logs that it fell asleep with m released
            }  // ends the entering-cv_wait case
            if (L === 3) {  // consumer line 3, after being woken: trying to leave cv_wait
              if (owner) { t.st = 'blockedM'; say(`<b>${t.n}</b> is awake, but cv_wait cannot return until it has m back, and <b>${owner}</b> holds m. ${t.n} waits for m.`, 'warn'); return logLine(`${t.n}: needs m back → waits`); }  // someone holds m: the woken consumer must wait for m before cv_wait can return
              owner = t.n; t.inWait = false; t.st = 'ready'; t.pc = mode === 'while' ? 2 : 4;  // gets m back and leaves cv_wait; with while it goes back to the test on line 2, with if straight on to take() on line 4
              say(`<b>${t.n}</b> gets m back, and cv_wait returns. ${mode === 'while' ? `The <b>while</b> loop sends ${t.n} back to <b>re-test</b> the condition.` : `With <b>if</b>, ${t.n} does not look again: it goes straight on to take an item. The queue now holds ${count}.`}`, mode === 'if' && count === 0 ? 'bad' : null);  // narration: cv_wait returns; red when an if-consumer is about to take from an empty queue
              return logLine(`${t.n}: cv_wait returns with m`);  // logs that cv_wait returned with m held
            }  // ends the leaving-cv_wait case
            if (L === 4) {  // consumer line 4: take()
              if (count === 0) {  // the queue is empty: this is the bug the lab is about
                count = -1; bug = true; t.st = 'bug'; t.pc = 5;  // the count goes to -1, the bug flag stops all threads, and this consumer is marked as having taken a missing item
                say(`<b>BUG.</b> ${t.n} calls take() on an <b>empty</b> queue: the count drops to <b>−1</b> and ${t.n} walks away with an item that never existed. It woke because an item arrived, but another consumer took that item first. With <b>while</b>, ${t.n} would have re-tested and gone back to sleep.`, 'bad');  // narration: why it happened (another consumer took the item first) and how while would have prevented it
                return logLine(`${t.n}: take() on EMPTY queue → count −1`);  // logs the take from an empty queue
              }  // ends the empty-queue case
              count--; t.took++; t.pc = 5;  // normal take: the count drops by 1 and the consumer records that it got an item
              say(`<b>${t.n}</b> takes an item: count = <b>${count}</b>.`, 'ok'); return logLine(`${t.n}: take → count ${count}`);  // narration and log: the item taken and the new count
            }  // ends consumer line 4
            releaseM(); t.st = 'done'; say(`<b>${t.n}</b> unlocks m and is done.`); return logLine(`${t.n}: mutex_exit, done`);  // consumer line 5: mutex_exit frees m and the consumer is done
          }  // ends step
          function canRun(t) { return !bug && (t.st === 'ready' || t.st === 'woken'); }  // canRun(t): a thread may run only if the bug has not happened and it is ready or freshly woken
          function run(n) { const t = T(n); if (!canRun(t)) return; step(t); draw(); }  // run(n): runs one line of thread n, if it may run, and redraws
          /* ----- code tables, thread cards and state picture ----- */
          const CODE = {  // CODE: the rows of the two code tables, each as [code, comment]; functions are used where the text depends on a switch
            C: [['mutex_enter(&m);', () => 'lock the queue'], [() => `${mode} (count == 0)`, () => (mode === 'while' ? 'empty? re-test after every wake-up' : 'empty? (tested only once)')],  // consumer rows 1 and 2: lock, then the test written with if or while and a comment matching it
              ['    cv_wait(&nonempty, &m);', () => 'release m + sleep; get m back'], ['item = take();', () => 'remove one item: count − 1'], ['mutex_exit(&m);', () => 'unlock the queue']],  // consumer rows 3 to 5: cv_wait (indented as the loop body), take(), and unlock
            P: [['mutex_enter(&m);', () => 'lock the queue'], ['put(item);', () => 'add one item: count + 1'],  // producer rows 1 and 2: lock and put
              [() => `cv_${wake}(&nonempty);`, () => (wake === 'signal' ? 'wake one sleeper' : 'wake every sleeper')], ['mutex_exit(&m);', () => 'unlock; loop to the next item']],  // producer rows 3 and 4: cv_signal or cv_broadcast with a matching comment, then unlock
          };  // closes CODE
          const slim = ctx.narrow;  // slim: true on phone-width screens, where the code tables use their compact style
          const cTab = h('table', { class: 'ctab' + (slim ? ' slim' : '') }), pTab = h('table', { class: 'ctab' + (slim ? ' slim' : '') });  // the two code tables, consumer and producer
          const cards = h('div', { class: 'grid-3', style: { gap: '10px' } });  // a 3-column grid for the thread cards
          const svg = s('svg', { viewBox: '0 0 470 146', width: '100%' });  // the state picture: mutex m, condition variable nonempty and the queue, side by side
          const STATUS = { ready: ['thread', 'ready'], woken: ['accent', 'woken: must get m back'], asleep: ['warn', 'asleep on nonempty'], blockedM: ['warn', 'waiting for m'], done: ['ok', 'done'], bug: ['bad', 'took a missing item!'] };  // STATUS: for each thread state, the chip colour and the words shown on its card
          const val = (x) => (typeof x === 'function' ? x() : x);  // val(x): calls x if it is a function, so table text can depend on the current switches
          function fillTab(tab, kind) {  // fillTab(tab, kind): rebuilds a code table and puts a chip in the gutter for every thread on each line
            const here = th.filter((t) => t.kind === kind && t.st !== 'done' && t.st !== 'bug');  // here: the threads of this kind that are still running (not done and not stopped by the bug)
            tab.replaceChildren(...CODE[kind].map((row, i) => {  // one table row per code line
              const at = here.filter((t) => t.pc === i + 1);  // at: the threads whose next line is this one
              const gut = h('td', { class: 'g' }, ...at.map((t) => h('span', { class: 'chip ' + STATUS[t.st][0], style: { marginRight: '3px' } }, t.n)));  // the gutter cell, holding one coloured name chip per thread waiting on this line
              if (slim) return h('tr', { class: at.length ? 'here' : '' }, gut, h('td', { class: 'n' }, String(i + 1)),  // phone version of a row: the gutter, the line number, and a cell stacking code over comment
                h('td', { class: 'k' }, h('div', { style: { whiteSpace: 'pre' } }, val(row[0]).replace(/^ {4}/, '  ')), h('div', { class: 'c' }, '// ' + val(row[1]))));  // code with its indent halved, then the comment on its own line
              return h('tr', { class: at.length ? 'here' : '' }, gut,  // desktop version of a row: tinted if a thread is on it
                h('td', { class: 'n' }, String(i + 1)), h('td', { class: 'k' }, val(row[0])), h('td', { class: 'c' }, '// ' + val(row[1])));  // gutter, line number, code and comment in four cells
            }));  // ends the row list
          }  // ends fillTab
          function draw() {  // draw(): repaints both code tables, the thread cards and the state picture
            fillTab(cTab, 'C'); fillTab(pTab, 'P');  // refills the two code tables
            cards.replaceChildren(...th.map((t) => h('div', { class: 'tcard' + (t.st === 'asleep' || t.st === 'blockedM' ? ' wait' : t.st === 'bug' ? ' wait' : owner === t.n ? ' hold' : '') },  // one card per thread, amber while asleep, blocked or stopped by the bug, green while holding m
              h('div', { class: 'row', style: { justifyContent: 'space-between', minHeight: '22px' } }, h('span', { class: 'nm' }, t.n), h('span', { class: 'chip ' + STATUS[t.st][0] }, t.kind === 'P' ? `${produced} made` : t.took ? 'got its item' : t.kind === 'C' ? 'consumer' : '')),  // top row: the thread's name and a chip (items made for P; "got its item" or "consumer" for C1 and C2)
              h('div', { class: 'st' }, STATUS[t.st][1] + (t.st === 'ready' || t.st === 'woken' ? ` · next: line ${t.pc}` : '')),  // status line from STATUS, plus the next line number while the thread can run
              h('button', { class: 'btn sm primary', type: 'button', disabled: !canRun(t), onclick: () => { gen++; run(t.n); } }, 'Run next line'))));  // the Run next line button: disabled when the thread cannot run; a click cancels any automatic replay and runs one line
            const k = [];  // k collects the shapes for the state picture
            [[8, 'mutex m'], [168, 'cv nonempty'], [318, 'queue']].forEach(([x, label]) => {  // three equal boxes with titles: mutex m, cv nonempty and queue
              k.push(s('text', { x: x + 72, y: 16, 'text-anchor': 'middle', 'font-weight': 700, 'font-size': 15 }, label));  // the box's title above it
              k.push(s('rect', { x, y: 24, width: 144, height: 80, rx: 14, class: label === 'queue' ? (bug ? 's-bad' : 's-mem') : label === 'mutex m' ? 's-os' : 's-panel', 'stroke-width': 2 }));  // the box: the queue turns red after the bug; the mutex uses the operating-system colour
            });  // ends the loop over boxes
            k.push(s('text', { x: 80, y: 74, 'text-anchor': 'middle', 'font-weight': 900, 'font-size': 26, style: owner ? 'fill:var(--ok)' : 'fill:var(--muted)' }, owner ? 'owner ' + owner : 'free'));  // inside the mutex box: who owns m in green, or a grey "free"
            const wm = th.filter((t) => t.st === 'blockedM').map((t) => t.n);  // wm: the threads blocked waiting for m
            k.push(s('text', { x: 80, y: 126, 'text-anchor': 'middle', class: 's-sub', 'font-size': 13.5 }, wm.length ? 'waiting for m: ' + wm.join(', ') : 'nobody waits for m'));  // under the mutex box: who waits for m, or nobody
            sleepers.forEach((n, i) => k.push(tok(s, 240 - (sleepers.length - 1) * 30 + i * 60, 64, n, 's-warn', 50, 40, 17)));  // inside the condition-variable box: one amber token per sleeper, centred as a group
            if (!sleepers.length) k.push(s('text', { x: 240, y: 69, 'text-anchor': 'middle', class: 's-sub', 'font-size': 14 }, 'nobody asleep'));  // if nobody sleeps, the box says so
            k.push(s('text', { x: 240, y: 126, 'text-anchor': 'middle', class: 's-sub', 'font-size': 13.5 }, 'asleep in cv_wait'));  // under the condition-variable box: a reminder that these threads sleep inside cv_wait
            k.push(s('text', { x: 390, y: 76, 'text-anchor': 'middle', 'font-weight': 900, 'font-size': 32, style: bug ? 'fill:var(--bad)' : '' }, String(count)));  // inside the queue box: the count in big digits, red after the bug
            k.push(s('text', { x: 390, y: 126, 'text-anchor': 'middle', 'font-size': 13.5, class: bug ? null : 's-sub', style: bug ? 'fill:var(--bad);font-weight:800' : null }, bug ? 'corrupted!' : 'items waiting'));  // under the queue box: items waiting, or a red "corrupted!" after the bug
            svg.replaceChildren(...k);  // swaps the new shapes into the picture
          }  // ends draw
          async function playTrouble() {  // playTrouble(): plays a fixed schedule automatically, one line every 0.9 s, that exposes the if bug
            const g = ++gen;  // g: this replay's ticket number; any reset or click raises gen, which makes this replay stop
            reset('Playing a schedule that lets C2 slip in between C1’s wake-up and its return from cv_wait. Watch C1.');  // restarts the lab with a narration telling the student to watch C1
            const sched = ['C1', 'C1', 'C1', 'P', 'P', 'P', 'P', 'C2', 'C2', 'C2', 'C2', 'C1', 'C1'].concat(mode === 'while' ? ['C1'] : []);  // the schedule: C1 sleeps, P makes an item and signals, C2 slips in and takes it, then C1 returns; with while, one extra C1 line
            for (const n of sched) {  // goes through the schedule one thread name at a time
              await ctx.sleep(900);  // waits 0.9 s between lines so the student can follow (ctx.sleep stops waiting if the slide closes)
              if (!ctx.alive || g !== gen) return;  // stops if the student left the slide or started something else since this replay began
              run(n);  // runs the next line of that thread
            }  // ends the schedule loop
            if (mode === 'while') say('<b>Correct behavior.</b> C1 woke, got m back, <b>re-tested</b> the condition, found the queue empty (C2 took the item) and went back to sleep. Nothing was corrupted. When P makes the next item, it will wake C1 again.', 'ok');  // with while, a closing green narration explains that C1 re-tested, found the queue empty and safely went back to sleep
          }  // ends playTrouble
          const modeSeg = ctx.ui.seg([{ value: 'if', label: 'if (count == 0)' }, { value: 'while', label: 'while (count == 0)' }], mode, (v) => { gen++; mode = v; reset(); });  // the Consumers test with switch: if or while; switching cancels any replay and restarts the lab
          const wakeSeg = ctx.ui.seg([{ value: 'signal', label: 'cv_signal' }, { value: 'broadcast', label: 'cv_broadcast' }], wake, (v) => { gen++; wake = v; reset(); });  // the P wakes with switch: cv_signal or cv_broadcast; switching also cancels any replay and restarts
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },  // builds the slide as one column
            h('div', { class: 'row', style: { gap: '12px' } }, h('span', { class: 'small b' }, 'Consumers test with'), modeSeg, h('span', { class: 'small b' }, 'P wakes with'), wakeSeg,  // the controls row: the two labelled switches
              h('button', { class: 'btn sm primary', type: 'button', onclick: playTrouble }, 'Play the troublesome schedule'),  // the button that starts the automatic troublesome schedule
              h('button', { class: 'btn sm', type: 'button', onclick: () => { gen++; reset(); } }, 'Reset')),  // the Reset button, which also cancels any replay
            h('div', { class: 'split grow', style: { gridTemplateColumns: 'minmax(0, 640px) minmax(0, 1fr)', gap: '18px' } },  // two columns below: the code tables (up to 640 px) and the state column
              h('div', { class: 'stack', style: { gap: '6px' } },  // the left column
                h('div', { class: 'xs b muted' }, 'CONSUMERS C1 AND C2 RUN THIS (CHIPS SHOW WHERE EACH THREAD IS)'), cTab,  // small heading and the consumers' code table
                h('div', { class: 'xs b muted' }, 'PRODUCER P RUNS THIS'), pTab, cards),  // small heading, the producer's code table, and the three thread cards
              h('div', { class: 'stack', style: { gap: '8px' } }, h('div', { class: 'card white tight' }, svg), narr, log))));  // the right column: the state picture in a white card, the narration and the log
          reset();  // starts the lab in its initial state
        },  // ends render for step 7
      },  // ends step 7

      /* ---------------- 8. Compare: pick the right primitive ---------------- */
      {  // step 8 begins: a quiz-style game matching situations to primitives
        title: 'Pick the right primitive',  // the title shown at the top of step 8
        kind: 'compare',  // kind compare: labelled Compare above the title
        render(el, ctx) {  // render(el, ctx): builds the matching game when step 8 opens
          const { h } = ctx;  // takes the HTML builder h out of ctx
          const P = [['Mutex lock', 'thread'], ['Semaphore', 'os'], ['Readers/writer lock', 'mem'], ['Condition variable + mutex', 'intr']];  // P: the four answer choices, each as [name, colour class]
          const CASES = [  // CASES: the situations, each as [description, index of the best primitive, explanation]
            ['A routing table is read for every network packet, but changed only when an administrator adds a route.', 2, 'Reads vastly outnumber writes, and readers do not disturb each other, so letting them share is a big win. The rare writer still gets the table alone.'],  // situation 1: a routing table read constantly and changed rarely (answer: readers/writer lock)
            ['A driver manages 4 identical DMA channels, and any thread may use any free one.', 1, 'A semaphore counts identical units. Start it at 4: sema_p takes a channel (sleeping if none is free) and sema_v gives one back.'],  // situation 2: four identical DMA channels shared by any thread (answer: semaphore counting 4)
            ['Two pointers in a list of open files must change together. The update takes a handful of instructions.', 0, 'One thread at a time, for a very short stretch: exactly the job of a mutex lock, and an adaptive one will usually just spin briefly.'],  // situation 3: two pointers updated together in a few instructions (answer: mutex lock)
            ['A worker must sleep until the job queue holds at least 3 jobs, and then take them all.', 3, '“At least 3 jobs” is an arbitrary test on shared data. The worker sleeps in cv_wait and re-tests in a while loop each time a producer signals.'],  // situation 4: sleep until at least 3 jobs are queued (answer: condition variable with a mutex)
            ['Thread A must tell thread B “the file is loaded”. A may finish before B even starts waiting, and you want no extra flag variable.', 1, 'A semaphore that starts at 0 remembers a sema_v that comes first, so B’s later sema_p passes at once. A cv_signal sent before B waits would simply be lost.'],  // situation 5: a one-time "file is loaded" signal that may come before anyone waits (answer: semaphore starting at 0)
            ['At shutdown, every idle worker thread must wake up at once and notice that it should quit.', 3, 'cv_broadcast wakes every sleeper. Each one gets the mutex back in turn and re-tests its condition (“is shutdown set?”).'],  // situation 6: wake every idle worker at shutdown (answer: condition variable, using cv_broadcast)
            ['Only the thread that started an update of a device’s registers may finish it, and a release by any other thread must be caught as a bug.', 0, 'Ownership is the mutex’s special feature: only the owner may release it. A semaphore has no owner, so it cannot catch a stray release.'],  // situation 7: only the starter may finish an update, and stray releases must be caught (answer: mutex lock, for ownership)
          ];  // closes CASES
          let i = 0, score = 0, answered = false;  // i: which situation is showing; score: right answers so far; answered: whether this one is already answered
          const counter = h('span', { class: 'chip accent' });  // chip showing "situation 3 of 7"
          const scoreChip = h('span', { class: 'chip ok' });  // green chip showing the score
          const sit = h('p', { class: 'm0', style: { fontSize: '18px', lineHeight: 1.45, minHeight: '78px' } });  // paragraph for the situation text, large type, with a minimum height so the layout does not jump
          const choices = h('div', { class: 'grid-2', style: { gap: '8px' } });  // 2-column grid for the four answer buttons
          const fb = h('div', { class: 'narr', style: { minHeight: '92px' } });  // the feedback box, with a minimum height for the same reason
          const nextBtn = h('button', { class: 'btn primary', type: 'button', onclick: () => { if (i < CASES.length - 1) { i++; show(); } else { i = 0; score = 0; show(); } } });  // the Next button: goes to the next situation, or after the last one starts again from situation 1 with the score at 0
          const rows = P.map(([name], j) => h('tr', {}, ...[  // rows: the comparison table, one row per primitive
            [h('b', {}, name)],  // first cell: the primitive's name in bold
            [['one thread; only the owner releases', 'one thread per unit; any thread may give one back', 'many readers, or one writer', 'none: it holds no lock, just sleepers'][j]],  // second cell: who may hold it
            [['spin or sleep (adaptive)', 'sleep', 'sleep', 'sleep, then re-take the mutex'][j]],  // third cell: how its waiters wait
            [['short critical sections; catching stray releases', 'counting identical resources; signals that must not be lost', 'data read often and written rarely', 'waiting until any condition on shared data holds'][j]],  // fourth cell: what to pick it for
          ].map((c) => h('td', {}, ...c))));  // turns each list of contents into a table cell
          function show() {  // show(): displays the current situation and resets the answer area
            answered = false;  // clears the answered flag
            counter.textContent = `situation ${i + 1} of ${CASES.length}`;  // updates the position chip
            scoreChip.textContent = `${score} right`;  // updates the score chip
            sit.textContent = CASES[i][0];  // shows the situation text
            fb.className = 'narr'; fb.innerHTML = 'Which primitive fits best? Pick one.';  // plain feedback box with the prompt to pick one
            nextBtn.textContent = i < CASES.length - 1 ? 'Next situation' : 'Start again';  // the Next button reads Next situation, or Start again on the last one
            nextBtn.disabled = true;  // Next stays disabled until an answer is picked
            rows.forEach((r) => r.classList.remove('on'));  // removes the highlight from every comparison-table row
            choices.replaceChildren(...P.map(([name, cls], j) => h('button', { class: 'btn ' + cls, type: 'button', style: { whiteSpace: 'normal', height: '46px', lineHeight: 1.2 }, onclick: (e) => pick(j, e.currentTarget) }, name)));  // new answer buttons, one per primitive in its colour; clicking passes the button itself to pick
          }  // ends show
          function pick(j, b) {  // pick(j, b): handles a click on answer j, whose button is b
            if (answered) return;  // only the first answer counts
            answered = true;  // locks the question
            const right = CASES[i][1], ok = j === right;  // right: the best answer's index; ok: whether the student picked it
            if (ok) score++;  // a right answer adds a point
            scoreChip.textContent = `${score} right`;  // updates the score chip
            [...choices.children].forEach((c, k) => { if (k === right) c.classList.add('on'); else if (k !== j) c.style.opacity = '0.5'; });  // highlights the right button and fades all others except the one clicked
            if (!ok) { b.style.borderColor = 'var(--bad)'; b.style.background = 'var(--bad-bg)'; }  // a wrong pick turns red
            rows[right].classList.add('on');  // highlights the right primitive's row in the comparison table
            fb.className = 'narr ' + (ok ? 'ok' : 'bad');  // feedback box turns green or red
            fb.innerHTML = (ok ? '<b>Yes: ' : `<b>Not this time. Best fit: `) + P[right][0] + '.</b> ' + CASES[i][2] + (i === CASES.length - 1 ? ` <b>Final score: ${score} of ${CASES.length}.</b>` : '');  // feedback: "Yes" or "Not this time. Best fit", the explanation, and the final score after the last situation
            nextBtn.disabled = false;  // enables the Next button
          }  // ends pick
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: 'minmax(0, 5fr) minmax(0, 6fr)', gap: '22px' } },  // builds the slide in two columns: the game (5 parts) and the comparison table (6 parts)
            h('div', { class: 'stack', style: { gap: '10px' } },  // the game column
              h('p', { class: 'm0' }, 'Each situation is a real kind of sharing problem inside an operating system. Choose the primitive that fits best.'),  // instruction line: each situation is a real sharing problem
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, counter, scoreChip),  // the position chip and the score chip, at opposite ends of a row
              h('div', { class: 'card white' }, sit), choices, fb, h('div', { class: 'row' }, nextBtn)),  // the situation card, the answer buttons, the feedback box and the Next button
            h('div', { class: 'stack', style: { gap: '10px' } },  // the reference column
              h('h4', { class: 'm0' }, 'The four primitives side by side'),  // heading over the table
              h('table', { class: 'tbl compact' }, h('thead', {}, h('tr', {}, h('th', {}, 'Primitive'), h('th', {}, 'Who may hold it'), h('th', {}, 'How waiters wait'), h('th', {}, 'Pick it for'))), h('tbody', {}, ...rows)),  // the comparison table: headings for primitive, who may hold it, how waiters wait, and pick it for
              h('div', { class: 'callout tip small m0', 'data-label': 'Rule of thumb', html: 'Start with a <span class="t">mutex lock</span>. Switch to a <span class="t">readers/writer lock</span> only when reads clearly dominate and are long enough to be worth sharing: its extra bookkeeping is not free. Use a semaphore to count, and a condition variable to wait for a condition.' }),  // rule-of-thumb tip: start with a mutex; use a readers/writer lock only when reads clearly dominate
              h('div', { class: 'callout warn small m0', 'data-label': 'Common mistake', html: 'Using a condition variable on its own. cv_wait needs the mutex that protects the data being tested, and the test must sit in a while loop around the wait.' }))));  // common-mistake callout: a condition variable needs its mutex and a while loop
          show();  // shows the first situation
        },  // ends render for step 8
      },  // ends step 8

      /* ---------------- 9. Recap ---------------- */
      {  // step 9 begins: the recap flip cards
        title: 'Recap: six things to remember',  // the title shown at the top of step 9
        kind: 'recap',  // kind recap: labelled Recap above the title
        render(el, ctx) {  // render(el, ctx): builds the recap when step 9 opens
          el.append(ctx.h('div', { class: 'stack fill' },  // one column that fills the slide
            ctx.h('p', { class: 'lead m0' }, 'Click each card to check yourself. Try to say the answer out loud before you flip it.'),  // instruction line: say the answer before flipping
            ctx.ui.flipcards([  // a grid of flip cards (click to turn over), each given as [question, answer]
              ['What are the four Solaris thread primitives?', 'Mutex locks, semaphores, readers/writer locks and condition variables. Each lives in the kernel (for kernel threads) and in the threads library (for user threads). Initializing one creates a shared synchronization object.'],  // card 1: the four primitives and where each lives
              ['mutex_enter, mutex_exit, mutex_tryenter?', 'Acquire, waiting if the lock is held. Release, which only the owner may do. Acquire only if free, never waiting. A Solaris mutex is not recursive.'],  // card 2: the three mutex calls, and that a Solaris mutex is not recursive
              ['Spin or sleep?', 'Basic design: spin by default, or optionally sleep on a turnstile. Kernel mutexes are adaptive: spin while the owner runs on another processor, sleep when it is not running.'],  // card 3: spin or sleep, and the adaptive rule
              ['sema_p, sema_v, sema_tryp?', 'Take a unit, sleeping at 0. Give a unit back, waking one sleeper. Take a unit only if no sleep is needed. The count never drops below 0, and there is no owner.'],  // card 4: the three semaphore calls, a count that never goes below 0, and no owner
              ['rw_downgrade and rw_tryupgrade?', 'Downgrade turns your write lock into a read lock without letting go; waiting writers keep waiting, and if none wait, waiting readers get in. Tryupgrade succeeds only if you are the only reader and no writer waits.'],  // card 5: what rw_downgrade and rw_tryupgrade do and when each succeeds
              ['Why a while loop around cv_wait?', 'cv_wait releases the mutex and sleeps atomically, then must win the mutex back before it returns. Meanwhile another thread may change the data, so re-test and wait again if needed.'],  // card 6: why the test around cv_wait must be a while loop
            ], { cols: 3, height: 214 })));  // closes the card list: 3 columns, each card 214 px tall; also closes the column and the append call
        },  // ends render for step 9
      },  // ends step 9

      /* ---------------- 10. Check yourself ---------------- */
      {  // step 10 begins: the end-of-section quiz
        title: 'Check yourself',  // the title shown at the top of step 10
        kind: 'check',  // kind check: labelled Check Yourself; the guide builds the quiz from the list below
        quiz: [  // the quiz questions; type defaults to multiple choice, and each has a why explanation shown after answering
          { q: 'Which of these is <b>not</b> one of the four thread synchronization primitives that Solaris adds on top of the classic UNIX mechanisms?',  // question 1 (multiple choice): which is not one of the four Solaris thread primitives
            choices: ['Readers/writer lock', 'Condition variable', 'Semaphore', 'Message queue'], answer: 3,  // choices for question 1; the answer is the message queue (index 3)
            feedback: ['It is one of the four: many readers at once, or one writer alone.', 'It is one of the four, always used together with a mutex lock.', 'It is one of the four, used through sema_p, sema_v and sema_tryp.', null],  // per-choice feedback for question 1, explaining why each wrong pick is one of the four (null for the right answer)
            why: 'The four are mutex locks, semaphores, readers/writer locks and condition variables, provided in the kernel for kernel threads and in the threads library for user threads. Message queues belong to the classic UNIX tools that Solaris also keeps.' },  // why for question 1: the four primitives, and message queues belong to the older UNIX tools
          { type: 'tf', q: 'Any thread may call mutex_exit on a Solaris mutex lock, as long as some thread currently holds the lock.', answer: false,  // question 2 (true or false): any thread may call mutex_exit while the lock is held; the answer is false
            why: 'Only the owner, the thread that acquired the lock, may release it. A release by any other thread is a bug, and the Solaris kernel detects it and panics (halts the whole system with an error report).' },  // why for question 2: only the owner may release, and the kernel panics otherwise
          { q: 'Thread T calls mutex_tryenter on a mutex lock that another thread holds. What happens?',  // question 3 (multiple choice): what mutex_tryenter does on a held lock
            choices: ['The call fails at once and T keeps running', 'T sleeps on the turnstile until the lock is released', 'T spins until the lock is released', 'T takes the lock away from its owner'], answer: 0,  // choices for question 3; the answer is that it fails at once (index 0)
            feedback: [null, 'That is what mutex_enter may do; the try version never waits.', 'Spinning is still waiting, and mutex_tryenter never waits at all.', 'A mutex lock is never taken from its owner; only the owner releases it.'],  // per-choice feedback for question 3: sleeping and spinning are both waiting, and a lock is never taken from its owner
            why: 'A try operation acquires only if it can do so immediately. Otherwise it returns failure (0) at once, and the caller can do other work and try again later.' },  // why for question 3: a try operation succeeds only if it can do so immediately
          { type: 'num', q: 'A Solaris semaphore starts with a count of 2. Three threads each call sema_p, one after another. Next, a fourth thread calls sema_tryp. Finally, a thread calls sema_v, and the thread it wakes finishes its sema_p. What is the count now?', answer: 0, tol: 0,  // question 4 (calculate): trace a semaphore from 2 through p, p, p, tryp and v; the answer is 0
            why: 'The first two sema_p calls take both units (2 → 1 → 0). The third finds 0 and sleeps; the count stays 0, because a Solaris count never goes negative. sema_tryp finds 0 and fails without changing anything. sema_v adds 1 (count 1) and wakes the sleeper; when it runs, it takes that unit to finish its sema_p, so the count is back to 0.' },  // why for question 4: the step-by-step trace of the count, which never goes negative
          { type: 'multi', q: 'Which statements about the Solaris adaptive mutex are true?',  // question 5 (select all that apply): true statements about the adaptive mutex
            choices: ['A waiter spins while the owner is running on another processor', 'A waiter sleeps on a turnstile when the owner is not running', 'A waiter always sleeps, because spinning wastes processor time', 'It may spin even when sleeping would have used less processor time, because it cannot know how long the owner will keep the lock'], answer: [0, 1, 3],  // choices for question 5; the right ones are spin while running, sleep when not, and it can lose its bet (0, 1 and 3)
            why: 'The adaptive mutex looks at the owner. Running elsewhere means the lock will probably be free soon, so it spins; not running means the wait could be long, so it sleeps. It bets on short hold times, the common case in the kernel, so it can lose that bet on an unusually long wait.' },  // why for question 5: the adaptive rule and why it bets on short hold times
          { type: 'order', q: 'Put the steps of a correct condition-variable wait in order.',  // question 6 (put in order): the steps of a correct condition-variable wait
            items: ['mutex_enter(&m) locks the shared data', 'The thread tests its condition and finds it false', 'cv_wait releases m and puts the thread to sleep, in one atomic step', 'Another thread changes the data and calls cv_signal', 'The sleeper wakes and reacquires m before cv_wait returns', 'The thread re-tests the condition in its while loop and finds it true', 'The thread uses the shared data, then calls mutex_exit(&m)'],  // the seven steps in their correct order, from mutex_enter to mutex_exit
            why: 'cv_wait is called with the mutex held, gives it up while sleeping, and returns with it held again. The re-test after waking is what makes the pattern safe.' },  // why for question 6: cv_wait is called with the mutex held and returns with it held again
          { type: 'match', q: 'Match each Solaris call to its effect.',  // question 7 (match the pairs): each Solaris call to its effect
            pairs: [['sema_v', 'Adds 1 to a count and may wake one sleeper'], ['rw_downgrade', 'Turns a write lock into a read lock without letting go'], ['rw_tryupgrade', 'Turns a read lock into a write lock, only if that is possible at once'], ['cv_broadcast', 'Wakes every thread sleeping on a condition variable'], ['mutex_enter', 'Acquires a lock, waiting if another thread holds it'], ['cv_wait', 'Releases a mutex and sleeps, then reacquires the mutex before returning']],  // the six pairs: sema_v, rw_downgrade, rw_tryupgrade, cv_broadcast, mutex_enter and cv_wait with their effects
            why: 'Acquire calls may wait, try calls never do, downgrade and upgrade change the mode of a readers/writer lock you already hold, and the cv_ calls sleep and wake around a condition.' },  // why for question 7: which calls may wait, which never do, and what the mode-changing and cv_ calls do
          { type: 'bucket', q: 'Can each call make its caller wait?', buckets: ['May wait', 'Never waits'],  // question 8 (sort into groups): can each call make its caller wait
            items: [['mutex_enter', 0], ['mutex_tryenter', 1], ['sema_p', 0], ['rw_enter', 0], ['rw_tryupgrade', 1], ['cv_wait', 0], ['cv_signal', 1], ['rw_downgrade', 1]],  // the eight calls with their group: 0 for may wait, 1 for never waits
            why: 'Calls that acquire something (mutex_enter, sema_p, rw_enter) may wait, and cv_wait always sleeps. The try versions, the wake-up calls and rw_downgrade never wait: downgrading only gives up rights, so there is nothing to wait for.' },  // why for question 8: acquiring calls and cv_wait may wait; try calls, wake-ups and rw_downgrade never do
          { q: 'A thread holds a Solaris readers/writer lock as a writer. Writer W2 is waiting for the lock, and so is reader R1. The holder calls rw_downgrade. Under the classic Solaris writers-first rules, what happens?',  // question 9 (multiple choice): what rw_downgrade does when a writer and a reader are both waiting
            choices: ['W2 gets the write lock immediately', 'R1 joins the holder as a reader immediately', 'The holder becomes a reader, and W2 and R1 both keep waiting', 'The holder releases the lock entirely, and W2 and R1 compete for it'], answer: 2,  // choices for question 9; the answer is that the holder reads and both keep waiting (index 2)
            feedback: ['The holder still holds the lock, now as a reader, and a writer must be alone.', 'With a writer already waiting, waiting readers are not admitted: they would overtake the writer.', null, 'Downgrading never lets go of the lock; that is its whole purpose.'],  // per-choice feedback for question 9: the writer must be alone, readers may not overtake a writer, and downgrading never lets go
            why: 'rw_downgrade converts the write lock to a read lock in place. Waiting writers keep waiting, and waiting readers are woken only if no writer is waiting. (Newer kernels such as illumos also weigh thread priority, so there a reader whose priority is at least the writer’s may be admitted.)' },  // why for question 9: the classic writers-first rule, with a note that newer kernels also weigh priority
          { q: 'Why must a thread re-test its condition in a while loop after cv_wait returns?',  // question 10 (multiple choice): why the condition must be re-tested in a while loop
            choices: ['Because cv_wait returns without holding the mutex, so the shared data must be read twice to be safe', 'Because before it gets the mutex back, another thread may change the data, so the condition may be false again', 'Because cv_signal always wakes every thread that is waiting on that condition variable, never just one', 'Because the compiler may skip a plain if statement after cv_wait, but it must always keep a while loop'], answer: 1,  // choices for question 10; the answer is that another thread may change the data first (index 1)
            feedback: ['cv_wait always returns with the mutex held again.', null, 'cv_signal wakes one thread and cv_broadcast wakes all; either way the re-test is needed.', 'Compilers do not skip if statements; the problem is the timing between threads.'],  // per-choice feedback for question 10, correcting each wrong idea about cv_wait, cv_signal and compilers
            why: 'A wake-up is only a hint that the condition may now hold, the Mesa-style behavior from Chapter 5. Another thread can get the mutex first and change the data, so the woken thread must check again and wait again if needed.' },  // why for question 10: a wake-up is only a hint, the Mesa-style behaviour met earlier
          { type: 'tf', q: 'A Solaris condition variable remembers a cv_signal sent while no thread is waiting, so the next cv_wait returns at once.', answer: false,  // question 11 (true or false): a condition variable remembers an unheard cv_signal; the answer is false
            why: 'A condition variable keeps no count. A signal with no sleeper is simply lost. That is why the condition itself lives in shared data protected by the mutex, and why a semaphore is the tool for a signal that must be remembered.' },  // why for question 11: a condition variable keeps no count, so a semaphore is the tool for a signal that must be remembered
          { type: 'num', q: 'A thread finds a mutex lock held. The owner is running on another processor and will release the lock in 20 µs. Sleeping would cost the waiter two thread switches of 4 µs each. How many µs of processor time would sleeping save compared with spinning?', answer: 12, tol: 0, unit: 'µs',  // question 12 (calculate): processor time saved by sleeping instead of spinning; the answer is 12 µs
            why: 'Spinning burns the whole wait: 20 µs. Sleeping costs 2 × 4 = 8 µs. Sleeping saves 20 − 8 = 12 µs. An adaptive mutex would still spin here, because the owner is running and it cannot know the wait will be that long.' },  // why for question 12: 20 µs of spinning minus 8 µs of switching, and why the adaptive mutex would still spin
        ],  // closes the quiz list
      },  // ends step 10
    ],  // closes the list of steps
    notes: `${/* notes: the printable summary of the whole section, opened with the Notes button */''}
      <h3>Solaris thread synchronization primitives</h3>${/* notes heading for the section */''}
      <p>Solaris keeps the classic UNIX mechanisms (pipes, messages, shared memory, semaphores, signals) and adds four <b>thread synchronization primitives</b>: mutual exclusion (mutex) locks, semaphores, readers/writer locks and condition variables. Each exists in the kernel (for kernel threads) and in the threads library (for user threads). Initializing one (<code>mutex_init</code>, <code>sema_init</code>, <code>rw_init</code>, <code>cv_init</code>) creates a <b>synchronization object</b>: a small data structure, shared by every thread that uses it, that each later call reads and changes. (These are the kernel's names; the library uses its own, such as <code>mutex_lock</code>.)</p>${/* notes paragraph: the four primitives, where they live, and the synchronization object made when one is initialized */''}

      <h4>Mutex locks</h4>${/* notes heading: mutex locks */''}
      <ul>${/* start of the mutex list */''}
        <li>One thread at a time. The thread that acquired the lock is its <b>owner</b>, and only the owner may release it. The Solaris kernel <b>panics</b> (halts with an error report) on a release by any other thread, or on a recursive mutex_enter by the owner, which would wait for itself forever.</li>${/* notes item: ownership, and the two misuses that make the kernel panic */''}
        <li><b>mutex_enter()</b> acquires, waiting if the lock is held. <b>mutex_exit()</b> releases, so a waiter can take the lock. <b>mutex_tryenter()</b> acquires only if the lock is free, otherwise returns 0 at once: a <b>try operation</b>, which never waits.</li>${/* notes item: what mutex_enter, mutex_exit and mutex_tryenter do */''}
      </ul>${/* end of the mutex list */''}

      <h4>Spin, sleep or adapt</h4>${/* notes heading: spin, sleep or adapt */''}
      <p>Basic design: a waiter <b>spins</b> by default (busy-waits on its processor, testing the lock). Optionally, an interrupt-based blocking mechanism lets it <b>sleep</b> on a <b>turnstile</b>, the lock's priority-ordered kernel queue of blocked threads, until the lock is released.</p>${/* notes paragraph: the basic design spins by default and may optionally sleep on a turnstile */''}
      <p>Spinning burns processor time for the whole wait but takes the lock the instant it is free. Sleeping costs two thread switches (to sleep and back) but frees the processor. Short waits favor spinning; long ones favor sleeping.</p>${/* notes paragraph: the cost of spinning against the cost of sleeping */''}
      <p><b>Worked example</b> (illustrative: one switch = 3 µs). Lock free in 4 µs: spinning uses 4 µs and gets it at 4 µs; sleeping uses 2 × 3 = 6 µs and gets it at 7 µs. Free in 30 µs: spinning 30 µs, sleeping 6 µs. Owner preempted (about 2,000 µs): spinning burns about 2,004 µs, sleeping still 6 µs.</p>${/* notes paragraph: a worked example with three wait lengths, including a preempted owner */''}
      <p><b>Adaptive mutexes.</b> Solaris kernel mutexes choose each time: owner running on another processor → spin (it will probably release soon); owner not running (preempted or asleep) → sleep on the turnstile. Not knowing the hold time, it bets on short holds, so it may spin when sleeping would have been cheaper. Code at a high interrupt level may not sleep, so it uses pure spin mutexes.</p>${/* notes paragraph: how adaptive mutexes choose, and pure spin mutexes at high interrupt levels */''}

      <h4>Semaphores</h4>${/* notes heading: semaphores */''}
      <ul>${/* start of the semaphore list */''}
        <li><b>sema_p()</b>: count above 0 → subtract 1 and go on; count 0 → sleep until a unit is available.</li>${/* notes item: sema_p */''}
        <li><b>sema_v()</b>: add 1 and wake one sleeper, if any, which takes that unit when it runs.</li>${/* notes item: sema_v */''}
        <li><b>sema_tryp()</b>: subtract 1 only if no sleep is needed; otherwise return 0 at once.</li>${/* notes item: sema_tryp */''}
        <li>The count never drops below 0; sleepers wait in a separate list (Chapter 5's semWait let the value go negative instead). There is <b>no owner</b>: any thread may call sema_v, so a stray release cannot be caught.</li>${/* notes item: a count that never goes below 0 (unlike the earlier semWait), and no owner */''}
      </ul>${/* end of the semaphore list */''}
      <p><b>Worked trace.</b> Start at 2. Three sema_p calls: 2 → 1 → 0, and the third caller sleeps (count stays 0). sema_tryp fails. sema_v makes it 1 and wakes the sleeper; once that thread takes the unit, the count is 0 again.</p>${/* notes paragraph: a worked trace of a semaphore that starts at 2 */''}

      <h4>Readers/writer locks</h4>${/* notes heading: readers/writer locks */''}
      <ul>${/* start of the readers/writer list */''}
        <li>Many <b>readers</b> together, or one <b>writer</b> alone, never both.</li>${/* notes item: many readers or one writer, never both */''}
        <li><b>rw_enter(lock, RW_READER or RW_WRITER)</b> acquires in that mode, waiting if needed; <b>rw_exit()</b> releases either mode; <b>rw_tryenter()</b> is the try version.</li>${/* notes item: rw_enter with its two modes, rw_exit and rw_tryenter */''}
        <li><b>Writers first.</b> A new reader waits if a writer holds the lock <i>or is waiting for it</i>, so readers cannot keep a writer out forever; a writer waits until nobody holds the lock. Classic Solaris rule, used in this guide: on release a waiting writer goes first; if none waits, all waiting readers enter together. Newer kernels (OpenSolaris, illumos) also weigh thread priority when handing the lock on.</li>${/* notes item: the writers-first rule this guide uses, and that newer kernels also weigh priority */''}
        <li><b>rw_downgrade()</b>: the writer turns its lock into a read lock without letting go, so no other writer can change the data in between. Classic rule: waiting writers keep waiting; if none waits, the waiting readers are admitted at once.</li>${/* notes item: rw_downgrade and what happens to the waiters */''}
        <li><b>rw_tryupgrade()</b>: a reader tries to become the writer. It succeeds only if it is the only reader and no writer is waiting; otherwise it returns 0 at once and the caller keeps its read lock. There is no waiting version: two readers each waiting for the other to leave would deadlock. After a failure: rw_exit, rw_enter(RW_WRITER), then <b>re-check the data</b>, since another writer may have changed it.</li>${/* notes item: rw_tryupgrade, why there is no waiting version, and what to do after it fails */''}
      </ul>${/* end of the readers/writer list */''}
      <p><b>Examples.</b> (1) T1 writes, T2 and T3 wait to read, T1 downgrades: all three read. (2) T1 writes, writer T2 and reader T3 wait, T1 downgrades: T1 reads alone; after T1 exits T2 writes, then T3 reads. (3) Readers T1 and T2 both try to upgrade: both fail; once T2 exits, T1's next try succeeds.</p>${/* notes paragraph: the three downgrade and upgrade examples from step 5 */''}

      <h4>Condition variables</h4>${/* notes heading: condition variables */''}
      <p>A condition variable lets a thread sleep until a condition on shared data holds. It is always used with the mutex that protects that data; together they behave like a monitor.</p>${/* notes paragraph: a condition variable always pairs with a mutex, together acting like a monitor */''}
      <ul>${/* start of the condition-variable list */''}
        <li><b>cv_wait(cv, m)</b>: in one atomic step, release mutex m and go to sleep on cv. When woken, reacquire m before returning, so the caller holds m again exactly as before the call.</li>${/* notes item: cv_wait releases and sleeps atomically, then reacquires before returning */''}
        <li><b>cv_signal(cv)</b> wakes one sleeping thread; <b>cv_broadcast(cv)</b> wakes all of them. A condition variable keeps no count, so a signal sent when nobody sleeps is simply lost.</li>${/* notes item: cv_signal and cv_broadcast, and that an unheard signal is lost */''}
      </ul>${/* end of the condition-variable list */''}
      <pre>mutex_enter(&amp;m);               /* lock the shared data            */${/* start of the code pattern shown in the notes, line 1: lock the shared data */''}
while (!condition)              /* test; re-test after every wake  */${/* code pattern line 2: the while test, re-tested after every wake-up */''}
    cv_wait(&amp;cv, &amp;m);           /* release m and sleep; relock m   */${/* code pattern line 3: cv_wait releases m and sleeps, then relocks it */''}
/* use the shared data: m is held and the condition is true */${/* code pattern line 4: a comment marking where the shared data is used safely */''}
mutex_exit(&amp;m);                /* unlock                          */</pre>${/* code pattern line 5: unlock; also ends the code block */''}
      <p><b>Why atomic?</b> If cv_wait released m and then slept as two steps, another thread could slip into the gap, change the data and signal while nobody slept. The signal would be lost and the waiter could sleep forever although its condition is true.</p>${/* notes paragraph: why cv_wait must release and sleep in one atomic step */''}
      <p><b>Why while, not if?</b> A wake-up only means the condition <i>may</i> hold (the Mesa-style monitor behavior of Chapter 5): before the woken thread gets m back, another thread can take m and change the data. Example: C1 sleeps on an empty queue; P adds an item, signals, unlocks; C2 locks m first and takes the item; then C1 gets m back. With <code>if</code>, C1 takes from an empty queue (count −1). With <code>while</code>, C1 re-tests, finds it empty and sleeps again. The loop also covers <b>spurious wakeups</b> and cv_broadcast, which wakes every sleeper even if only one can proceed.</p>${/* notes paragraph: why the test must be a while loop, with the C1, C2 and P example from the lab */''}

      <h4>Choosing a primitive</h4>${/* notes heading: choosing a primitive */''}
      <table>${/* start of the notes table that pairs situations with the best primitive */''}
        <tr><th>Situation</th><th>Best fit</th></tr>${/* table header row: situation and best fit */''}
        <tr><td>A short critical section; a stray release must be caught</td><td>Mutex lock (ownership)</td></tr>${/* table row: a short critical section needing ownership calls for a mutex lock */''}
        <tr><td>Counting identical resources</td><td>Semaphore set to the number of units</td></tr>${/* table row: counting identical resources calls for a semaphore */''}
        <tr><td>A signal that may arrive before anyone waits</td><td>Semaphore starting at 0 (it remembers the signal)</td></tr>${/* table row: a signal that may come before anyone waits calls for a semaphore starting at 0 */''}
        <tr><td>Data read very often and written rarely</td><td>Readers/writer lock</td></tr>${/* table row: data read often and written rarely calls for a readers/writer lock */''}
        <tr><td>Waiting for any condition on shared data</td><td>Condition variable + mutex (cv_broadcast wakes all)</td></tr>${/* table row: waiting for any condition calls for a condition variable with its mutex */''}
      </table>${/* end of the notes table */''}
      <p>Rule of thumb: start with a mutex lock; use a readers/writer lock only when reads clearly dominate, since its bookkeeping costs more.</p>${/* notes paragraph: the rule of thumb, start with a mutex lock */''}
    `,  // end of the notes text
  });  // closes the section object and the Guide.section call
})();  // closes the wrapper function and runs it at once
