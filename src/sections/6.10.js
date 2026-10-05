// Comment key: a line inside backtick text ends with ${/* comment */''}, an empty-string slot that holds a comment without changing the text on screen (full note at the top of the page).
/* =====================================================================
   6.10  Windows Concurrency Mechanisms
   Dispatcher objects and wait functions, critical sections, slim
   reader-writer locks, condition variables and interlocked operations.
   Original teaching material. Helpers shared by several steps live in
   this IIFE, so nothing leaks into the global scope.
   ===================================================================== */
(() => {  // wraps the whole section in a function that runs once, right away (an IIFE), so its helper names stay private to this file

  /* Narration box: el.say(html, tone) with tone '', 'ok', 'bad', 'warn'. */
  function narrBox(ctx, minH) {  // narrBox(ctx, minH): builds the narration box that explains each click in words; minH is its minimum height in pixels
    const el = ctx.h('div', { class: 'narr', 'aria-live': 'polite', style: minH ? { minHeight: minH + 'px' } : null });  // the box is a div with class narr; aria-live makes screen readers read new text, and the minimum height stops the layout jumping
    el.say = (html, tone) => { el.className = 'narr' + (tone ? ' ' + tone : ''); el.innerHTML = html; };  // el.say(html, tone): replaces the box's text and colours it by tone ('ok' green, 'bad' red, 'warn' amber, '' plain)
    return el;  // hands the finished box back to the step that asked for it
  }  // ends narrBox

  /* Small button helper: every clickable thing is a real <button>. */
  function btn(ctx, label, onclick, cls) {  // btn(ctx, label, onclick, cls): makes one button with a label and a click handler, small ('sm') unless cls says otherwise
    return ctx.h('button', { class: 'btn ' + (cls || 'sm'), type: 'button', onclick, html: label });  // builds a real button element (type button, so it never submits a form); html lets the label contain symbols or markup
  }  // ends btn

  /* A rounded SVG token with a centred label (threads, objects). */
  function token(s, x, y, label, cls, w, h, fs) {  // token(s, x, y, label, cls, w, h, fs): draws a rounded box of size w by h centred on (x, y) with a label, used for threads in diagrams
    return s('g', {},  // groups the box and its label in one SVG (the browser's drawing format) g element so they travel together
      s('rect', { x: x - w / 2, y: y - h / 2, width: w, height: h, rx: 10, class: cls || 's-thread', 'stroke-width': 2 }),  // the rounded rectangle, shifted by half its width and height so (x, y) is its centre; pink thread colours unless cls says otherwise
      s('text', { x, y: y + (fs || 16) * 0.36, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': fs || 16 }, label));  // the bold label in the middle; moving it down by about a third of the font size centres the letters vertically
  }  // ends token

  /* Step 7, tab 1: an SRW lock playground with three readers and two writers. */
  function srwTab(pn, ctx) {  // srwTab(pn, ctx): draws the SRW lock playground into the tab panel pn when step 7's first tab opens
    const { h } = ctx;  // takes the HTML builder h out of ctx so the code below can write h(...) for short
    const TH = [['R1', 'S'], ['R2', 'S'], ['R3', 'S'], ['W1', 'X'], ['W2', 'X']];  // TH: the five threads, each with a name and what it wants: S for shared (readers R1-R3) or X for exclusive (writers W1, W2)
    let mode, holders, queue, st, stuck;  // the playground's state: lock mode, who holds the lock, the waiting queue, each thread's status, and which thread is deadlocked
    const lockEl = h('div', { class: 'lockbox' });  // lockEl: the box at the top left that shows the lock's mode, holders and waiters
    const cards = h('div', { class: 'srwgrid', style: { gridTemplateColumns: ctx.narrow ? 'repeat(2, minmax(0, 1fr))' : 'repeat(5, minmax(0, 1fr))' } });  // cards: the grid of thread cards, five across on a wide screen and two across in the phone-width layout
    const narr = narrBox(ctx, 92);  // narr: the narration box under the cards, at least 92 pixels tall
    const role = (n) => TH.find((t) => t[0] === n)[1];  // role(n): looks up whether thread n is a reader (S) or a writer (X)
    function reset(msg) {  // reset(msg): puts the lock back to free with nobody waiting; runs when the tab opens and when Reset is clicked
      mode = 'free'; holders = []; queue = []; st = {}; stuck = null;  // clears the state: the lock is free, nobody holds it, the queue is empty and no thread is stuck
      TH.forEach(([n]) => (st[n] = 'idle'));  // marks every thread as idle (not holding and not waiting)
      narr.say(msg || 'The lock is free. Readers R1 to R3 ask for <b>shared</b> mode; writers W1 and W2 ask for <b>exclusive</b> mode. Let two readers in, then try a writer.');  // shows the starting instructions in the narration box, or msg if the caller passed one
      paint();  // redraws the lock box and the cards
    }  // ends reset
    function grant(n, m) { holders.push(n); mode = m; st[n] = 'holding'; }  // grant(n, m): gives the lock to thread n in mode m ('shared' or 'excl') and marks n as holding it
    function acquire(n) {  // acquire(n): runs when thread n's Acquire button is clicked
      const want = role(n);  // want: whether n asks for shared (S) or exclusive (X) mode
      if (want === 'S') {  // the reader case
        const writerWaiting = queue.some((q) => q.want === 'X');  // writerWaiting: true if some writer is already in the queue
        if (mode !== 'excl' && !writerWaiting) { grant(n, 'shared'); narr.say(`${n} calls AcquireSRWLockShared. ${holders.length > 1 ? `The lock is already held in shared mode, so ${n} <b>joins</b>: ${holders.join(', ')} now read at the same time.` : 'The lock was free, so it is now held in <b>shared</b> mode.'}`, 'ok'); }  // a reader gets in at once if no writer holds the lock and no writer waits; the message says whether it joined other readers
        else { queue.push({ n, want }); st[n] = 'waiting'; narr.say(`${n} calls AcquireSRWLockShared but must wait: ${mode === 'excl' ? `${holders[0]} holds the lock <b>exclusively</b>` : 'a writer is already waiting, and in this simulation a new reader lines up behind it so the writer cannot starve'}. ${n} sleeps.`, 'warn'); }  // otherwise the reader joins the queue and sleeps; the message says whether a holding writer or a waiting writer blocks it
      } else if (mode === 'free') { grant(n, 'excl'); narr.say(`${n} calls AcquireSRWLockExclusive. The lock was free, so ${n} now holds it <b>alone</b>: no reader and no other writer may enter.`, 'ok'); }  // the writer case with the lock free: the writer takes it in exclusive mode, alone
      else { queue.push({ n, want }); st[n] = 'waiting'; narr.say(`${n} calls AcquireSRWLockExclusive, but ${holders.join(', ')} ${holders.length === 1 ? 'holds' : 'hold'} the lock in ${mode === 'excl' ? 'exclusive' : 'shared'} mode. A writer needs the lock entirely to itself, so ${n} sleeps.`, 'warn'); }  // a writer facing any holder joins the queue and sleeps, and the message names who holds the lock and in which mode
      paint();  // redraws the lock box and the cards to show the change
    }  // ends acquire
    function again(n) {  // again(n): runs when a writer that already holds the lock clicks Acquire again, to show that SRW locks are not recursive
      stuck = n; st[n] = 'stuck';  // records n as the stuck thread and gives it the stuck status, which the card shows in red
      narr.say(`${n} already holds the lock exclusively and calls AcquireSRWLockExclusive <b>again</b>. SRW locks are not recursive: the lock does not even record which thread holds it, so ${n} just waits for a lock that only ${n} could release. It waits forever, and so will every thread that queues behind it. A critical section or a mutex records its owner and would have counted a second entry. Press Reset.`, 'bad');  // explains in red why n now waits forever for itself, and how a critical section or mutex would have handled it
      paint();  // redraws so the stuck card appears
    }  // ends again
    function release(n) {  // release(n): runs when thread n clicks Release
      const wasExcl = mode === 'excl', woke = [];  // wasExcl remembers whether the lock was exclusive (to name the right release call); woke collects the threads handed the lock
      holders = holders.filter((x) => x !== n); st[n] = 'idle';  // removes n from the holders and makes it idle again
      if (!holders.length) {  // only when the last holder leaves can the lock pass to waiters
        mode = 'free';  // the lock is free for a moment
        if (queue.length && queue[0].want === 'X') { const q = queue.shift(); grant(q.n, 'excl'); woke.push(q.n); }  // if the first waiter is a writer, it alone gets the lock in exclusive mode
        else while (queue.length && queue[0].want === 'S') { const q = queue.shift(); grant(q.n, 'shared'); woke.push(q.n); }  // otherwise every reader at the front of the queue gets the lock together in shared mode, up to the first waiting writer
      }  // ends the hand-over case
      const call = wasExcl ? 'ReleaseSRWLockExclusive' : 'ReleaseSRWLockShared';  // call: the name of the release function the holder used, exclusive or shared
      narr.say(`${n} calls ${call}. ${woke.length ? `The lock is now free, so it passes to <b>${woke.join(', ')}</b> in ${mode === 'excl' ? 'exclusive' : 'shared'} mode.` : holders.length ? `${holders.join(', ')} still ${holders.length === 1 ? 'reads' : 'read'}, so the lock stays in shared mode${queue.length ? ' and the waiters keep sleeping' : ''}.` : 'Nobody is waiting, so the lock is simply free.'}`, woke.length ? 'ok' : '');  // explains what happened: who got the lock, or that other readers still hold it, or that it is simply free; green if anyone woke
      paint();  // redraws the lock box and the cards
    }  // ends release
    function paint() {  // paint(): redraws the lock box and the five thread cards from the current state
      lockEl.replaceChildren(  // fills the lock box with three rows
        h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', {}, 'SRW lock lk'),  // top row: the lock's name on the left...
          h('span', { class: 'chip ' + (mode === 'free' ? 'ok' : mode === 'excl' ? 'bad' : 'accent') }, mode === 'free' ? 'free' : mode === 'excl' ? 'exclusive mode' : 'shared mode')),  // ...and a chip on the right showing its mode: green when free, red when exclusive, indigo when shared
        h('div', { class: 'small' }, h('b', {}, 'Held by: '), holders.length ? holders.join(', ') : 'nobody'),  // second row: the threads that hold the lock, or nobody
        h('div', { class: 'small' }, h('b', {}, 'Waiting: '), queue.length ? queue.map((q) => `${q.n} (${q.want === 'X' ? 'excl.' : 'shared'})`).join(', ') : 'nobody'));  // third row: the waiting threads in order, each with the mode it asked for, or nobody
      cards.replaceChildren(...TH.map(([n, want]) => {  // rebuilds one card per thread
        const s0 = st[n];  // s0: this thread's status (idle, holding, waiting or stuck)
        const label = { idle: 'not holding', holding: want === 'S' ? 'reading' : 'writing', waiting: 'asleep', stuck: 'waits for itself' }[s0];  // label: the status in plain words, e.g. a holding reader is "reading" and a stuck writer "waits for itself"
        const card = h('div', { class: 'scard ' + s0 },  // the card itself; its class matches the status, so the stylesheet colours it green, amber or red
          h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', { style: { fontSize: '18px' } }, n), h('span', { class: 'xs muted' }, want === 'S' ? 'reader' : 'writer')),  // card heading: the thread's name in large bold on the left and "reader" or "writer" on the right
          h('div', { class: 'xs b' }, label));  // the status words under the heading
        if (s0 === 'idle') card.append(btn(ctx, want === 'S' ? 'Acquire shared' : 'Acquire excl.', () => acquire(n)));  // an idle thread gets an Acquire button for the mode it wants
        else if (s0 === 'holding') { card.append(btn(ctx, 'Release', () => release(n))); if (want === 'X') card.append(btn(ctx, 'Acquire again', () => again(n), 'sm intr')); }  // a holding thread gets Release; a holding writer also gets a red Acquire again button that shows the deadlock
        else card.append(h('div', { class: 'xs muted' }, s0 === 'stuck' ? 'deadlocked' : 'sleeping in Acquire'));  // a waiting or stuck thread gets no button, only a grey note saying it sleeps or is deadlocked
        return card;  // hands the finished card to replaceChildren
      }));  // ends the card loop
    }  // ends paint
    pn.append(h('div', { class: 'split', style: { gridTemplateColumns: 'minmax(0, 5fr) minmax(0, 8fr)', gap: '18px', height: '100%' } },  // builds the tab's layout: two columns, the explanation on the left and the playground on the right, filling the panel
      h('div', { class: 'stack', style: { gap: '8px' } },  // left column: a stack with 8-pixel gaps
        h('p', { class: 'm0 small', html: 'A <span class="t" data-t="slim reader-writer lock">slim reader-writer (SRW) lock</span>, added in Windows Vista, is the size of one pointer and lives in the process’s own memory. Readers hold it in <span class="t">shared mode</span>, any number at once; a writer holds it in <span class="t">exclusive mode</span>, alone.' }),  // intro paragraph: what an SRW lock is, how small it is, and the two modes, with dotted glossary terms
        lockEl,  // the lock box built above
        h('ul', { class: 'm0 small', style: { lineHeight: 1.4 } },  // a short bullet list of the lock's calls and limits
          h('li', { html: '<code>AcquireSRWLockShared</code> / <code>ReleaseSRWLockShared</code>' }),  // bullet: the pair of calls for shared mode
          h('li', { html: '<code>AcquireSRWLockExclusive</code> / <code>ReleaseSRWLockExclusive</code>' }),  // bullet: the pair of calls for exclusive mode
          h('li', {}, 'No recursion: the holder may not acquire it again.'),  // bullet: the lock is not recursive
          h('li', {}, 'Only for the threads of one process, and no promise about which waiter goes next.')),  // bullet: it serves one process only and makes no promise about waiter order
        h('div', { class: 'card tight small' }, h('b', {}, 'Try these'),  // the "Try these" card with numbered experiments
          h('ol', { class: 'm0', style: { paddingLeft: '20px', lineHeight: 1.4 } },  // the numbered list of experiments, indented so the numbers show
            h('li', {}, 'R1 and R2 acquire: do they share?'),  // experiment 1: do two readers share the lock?
            h('li', {}, 'Now W1 acquires. What must happen first?'),  // experiment 2: what a writer must wait for while readers hold the lock
            h('li', {}, 'With W1 waiting, R3 asks. Who goes next?'),  // experiment 3: whether a new reader may pass a waiting writer
            h('li', {}, 'Let W1 hold the lock, then click Acquire again.')))),  // experiment 4: a writer acquiring again shows the self-deadlock; the brackets close the list, card and left column
      h('div', { class: 'stack', style: { gap: '10px' } }, cards, narr,  // right column: the thread cards and the narration box, stacked with 10-pixel gaps
        h('div', { class: 'row gap-s' }, btn(ctx, 'Reset', () => reset()), h('span', { class: 'xs muted grow' }, 'Simulation rule: waiters get the lock in arrival order, and a new reader waits behind a waiting writer. Real SRW locks do not promise any order.')),  // a row with the Reset button and a grey note on the simulation's own fairness rule, which real SRW locks do not promise
        h('div', { class: 'callout why small m0', 'data-label': 'Why it matters' }, 'Most shared data is read far more often than it is written. A plain lock lets readers in one at a time; an SRW lock lets them all read in parallel and still gives each writer the data to itself.'))));  // "Why it matters" callout: most data is read far more than written, so letting readers share pays off; closes the layout
    reset();  // sets the starting state and draws it as soon as the tab opens
  }  // ends srwTab

  /* Step 7, tab 2: a condition variable traced frame by frame; the while/if switch shows why the re-check matters. */
  function cvTab(pn, ctx) {  // cvTab(pn, ctx): draws the step-by-step condition variable trace into the tab panel pn when step 7's second tab opens
    const { h, s } = ctx;  // takes the HTML builder h and the SVG builder s out of ctx
    const srcFor = (loop) => `${/* srcFor(loop): returns the C-style listing shown beside the drawing; loop picks a while test or an if test on line 3 */''}
// consumer: C1 and C2 both run this code${/* shown code, line 1: a heading comment saying both consumers run this code */''}
AcquireSRWLockExclusive(&lk);    // lock the queue${/* shown code, line 2: the consumer locks the queue in exclusive mode */''}
${loop ? 'while (q.count == 0)' : 'if (q.count == 0)   '}             // nothing to take?${/* shown code, line 3: the test for an empty queue, written as while or as if depending on the switch */''}
    SleepConditionVariableSRW(   // atomic: unlock + sleep${/* shown code, line 4: the sleep call that unlocks and sleeps in one atomic step */''}
        &cv, &lk, INFINITE, 0);  // relock before returning${/* shown code, line 5: the sleep call's arguments; the lock is taken back before the call returns */''}
item = q.take();                 // take one item, lock held${/* shown code, line 6: the consumer takes one item while it holds the lock */''}
ReleaseSRWLockExclusive(&lk);    // unlock the queue${/* shown code, line 7: the consumer unlocks the queue */''}
// producer P:${/* shown code, line 8: a heading comment for the producer's part */''}
AcquireSRWLockExclusive(&lk);    // lock the queue${/* shown code, line 9: the producer locks the queue */''}
q.add(item);                     // put one item in${/* shown code, line 10: the producer adds one item */''}
ReleaseSRWLockExclusive(&lk);    // unlock the queue${/* shown code, line 11: the producer unlocks the queue */''}
WakeAllConditionVariable(&cv);   // wake every sleeper`;  // shown code, line 12: the producer wakes every thread sleeping on cv; the backtick ends the listing
    /* Runs the scenario once and records a snapshot per frame, so the captions and the picture share one state. */
    function build(loop) {  // build(loop): plays the whole scenario once and returns the list of frames, one snapshot of the state per frame
      const S = { q: 0, lk: null, C1: 'idle', C2: 'idle', P: 'idle', cv: [] }, F = [];  // S: the live state (items in the queue, who holds lk, each thread's status, who sleeps on cv); F collects the frames
      const snap = (lines, who, cap, tone) => F.push(Object.assign({}, S, { cv: S.cv.slice(), lines, who, cap, tone }));  // snap(lines, who, cap, tone): saves a copy of S plus the listing lines to light up, the active thread, the caption and its colour
      snap([], null, 'The queue is empty. Consumers C1 and C2 each want one item; producer P will make just <b>one</b>.');  // frame 1: sets the scene, an empty queue, two consumers and one producer that makes only one item
      S.lk = 'C1'; S.C1 = 'running'; snap([2], 'C1', 'C1 locks the queue (exclusive mode).');  // frame 2: C1 takes the lock and starts running (listing line 2)
      snap([3], 'C1', `C1 tests the condition: q.count is ${S.q}, so there is nothing to take.`);  // frame 3: C1 tests the condition and finds the queue empty (line 3)
      S.lk = null; S.C1 = 'asleep'; S.cv.push('C1'); snap([4, 5], 'C1', 'C1 calls SleepConditionVariableSRW. In <b>one atomic step</b> it releases lk and sleeps on cv, so no wake-up can slip in between the unlock and the sleep.');  // frame 4: C1 sleeps on cv and gives up lk in one atomic step (lines 4-5), so no wake-up can be missed
      S.lk = 'C2'; S.C2 = 'running'; snap([2, 3], 'C2', `C2 locks the queue and also finds q.count = ${S.q}.`);  // frame 5: C2 takes the lock and finds the queue empty too
      S.lk = null; S.C2 = 'asleep'; S.cv.push('C2'); snap([4, 5], 'C2', 'C2 sleeps on cv too, releasing lk. Two threads now sleep on the condition variable, using no processor time.');  // frame 6: C2 also sleeps on cv and releases lk; now two threads sleep without using the processor
      S.lk = 'P'; S.P = 'running'; S.q += 1; snap([9, 10], 'P', `P locks the queue and adds one item: q.count = ${S.q}.`);  // frame 7: P takes the lock and adds one item, so the count becomes 1 (lines 9-10)
      S.lk = null; S.P = 'done'; const woke = S.cv.splice(0); woke.forEach((n) => (S[n] = 'woken'));  // P finishes and releases lk; splice(0) empties the sleeper list, and every sleeper is marked woken
      snap([11, 12], 'P', `P unlocks and calls <b>WakeAllConditionVariable</b>, so ${woke.join(' and ')} both wake (WakeConditionVariable would wake just one). Each must <b>re-acquire lk</b> before its sleep call returns.`);  // frame 8: P's WakeAll call wakes both consumers, but each must get lk back before its sleep call can return
      S.lk = 'C1'; S.C1 = 'running'; snap([4, 5], 'C1', 'C1 gets lk first, so its sleep call returns. C2 is awake but must wait for lk.');  // frame 9: C1 wins the lock, so its sleep call returns while C2 waits for lk
      if (loop) snap([3], 'C1', `The <b>while</b> loop sends C1 back to the test: q.count is ${S.q}, not 0, so it leaves the loop.`);  // while version only: an extra frame where C1 re-tests the condition, finds an item and leaves the loop
      S.q -= 1; snap([6], 'C1', `C1 takes the item: q.count = ${S.q}.`);  // next frame: C1 takes the item, so the count drops back to 0 (line 6)
      S.lk = null; S.C1 = 'done'; snap([7], 'C1', 'C1 unlocks the queue. It is done.');  // next frame: C1 releases the lock and is done (line 7)
      S.lk = 'C2'; S.C2 = 'running'; snap([4, 5], 'C2', 'Now C2 gets lk and its sleep call returns, but C1 already took the only item. This wake-up was <b>stolen</b>.');  // next frame: C2 finally gets lk, but the only item is gone; its wake-up was stolen by C1
      if (loop) {  // the while version ends safely
        snap([3], 'C2', `The <b>while</b> loop re-tests the condition: q.count is ${S.q}, so there is still nothing to take...`);  // C2 re-tests the condition and sees the queue is still empty
        S.lk = null; S.C2 = 'asleep'; S.cv.push('C2'); snap([4, 5], 'C2', '...so C2 goes back to sleep, releasing lk, until the next item arrives. <b>Correct.</b>', 'ok');  // so C2 goes back to sleep and releases lk; this green frame marks the correct outcome
      } else {  // the if version ends with the bug
        S.q -= 1; S.C2 = 'BUG'; snap([6], 'C2', `With <b>if</b>, C2 never re-tests. It calls q.take() on an <b>empty</b> queue (the count would become −${-S.q}): it reads garbage or crashes. Test the condition in a <b>while</b> loop.`, 'bad');  // red frame: with if, C2 never re-tests and takes from an empty queue, so the count goes negative
      }  // ends the if/while choice
      return F;  // hands back the finished list of frames
    }  // ends build
    let loop = true, frames = build(true), code = ctx.ui.code(srcFor(true), { lang: 'c', fontSize: 13 });  // starts in while mode: builds its frames and its listing (C syntax colours, 13-pixel font)
    code.style.flexShrink = '0';  // stops the listing from shrinking when the column is short, so no line is squashed
    const W = ctx.narrow ? 360 : 520, svg = s('svg', { viewBox: `0 0 ${W} ${ctx.narrow ? 300 : 236}`, width: '100%' });  // the drawing: 520 units wide normally, or 360 wide and taller in the phone-width layout; it scales to the column width
    const G = ctx.narrow  // G: where each part of the drawing goes, chosen by layout
      ? { q: [8, 26, 168, 70], lk: [188, 26, 164, 70], cv: [8, 124, 344, 54], tx: [60, 180, 300], ty: 230 }  // phone-width positions: queue and lock side by side, the condition variable below them, threads at the bottom
      : { q: [8, 26, 196, 74], lk: [216, 26, 140, 74], cv: [368, 26, 144, 74], tx: [90, 262, 430], ty: 154 };  // wide positions: queue, lock and condition variable in one row, with the three threads in a row underneath
    const ST = { idle: ['not started', '--muted'], running: ['running', '--ok'], asleep: ['asleep on cv', '--warn'], woken: ['awake, needs lk', '--cpu'], done: ['done', '--muted'], BUG: ['empty take!', '--bad'] };  // ST: each thread status mapped to the words shown under its token and the colour variable used for them
    function draw(f) {  // draw(f): redraws the picture and the listing highlights for frame f
      const k = [], box = (b, title, cls) => { k.push(s('text', { x: b[0], y: b[1] - 8, 'font-size': 14, 'font-weight': 800 }, title)); k.push(s('rect', { x: b[0], y: b[1], width: b[2], height: b[3], rx: 12, class: cls, 'stroke-width': 2 })); };  // k collects the shapes; box(b, title, cls) adds a bold title above a rounded rectangle placed by b = [x, y, width, height]
      box(G.q, 'queue q', f.q < 0 ? 's-bad' : 's-mem');  // the queue box, green normally and red once the count has gone negative
      if (f.q > 0) k.push(s('rect', { x: G.q[0] + 16, y: G.q[1] + 18, width: 38, height: 38, rx: 8, class: 's-ok', 'stroke-width': 2 }), s('text', { x: G.q[0] + 35, y: G.q[1] + 43, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800 }, 'item'));  // when the queue holds an item, a small green square labelled "item" sits inside it
      k.push(s('text', { x: G.q[0] + (f.q > 0 ? 66 : 16), y: G.q[1] + 44, 'font-size': 15, 'font-weight': 700, style: f.q < 0 ? 'fill:var(--bad)' : '' }, f.q < 0 ? `count −${-f.q}: broken` : `count = ${f.q}`));  // the count beside the item, or a red "broken" message if the count went below zero
      box(G.lk, 'lock lk', f.lk ? 's-os' : 's-panel');  // the lock box, purple while held and grey while free
      k.push(s('text', { x: G.lk[0] + G.lk[2] / 2, y: G.lk[1] + 46, 'text-anchor': 'middle', 'font-size': 18, 'font-weight': 800 }, f.lk ? 'held by ' + f.lk : 'free'));  // the lock's holder written large in the middle of its box, or "free"
      box(G.cv, 'condition var cv', 's-panel');  // the box for the condition variable
      k.push(s('text', { x: G.cv[0] + G.cv[2] / 2, y: G.cv[1] + G.cv[3] / 2 + 6, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700, style: f.cv.length ? 'fill:var(--warn)' : 'fill:var(--muted)' }, f.cv.length ? 'sleeping: ' + f.cv.join(', ') : 'nobody sleeping'));  // the names of the sleepers inside it in amber, or a grey "nobody sleeping"
      ['C1', 'C2', 'P'].forEach((n, i) => {  // draws the three threads, C1, C2 and P, from left to right
        const x = G.tx[i], st = ST[f[n]];  // x is this thread's position; st is its status words and colour
        if (f.who === n) k.push(s('rect', { x: x - 44, y: G.ty - 30, width: 88, height: 60, rx: 14, class: 's-accent', 'stroke-width': 3 }));  // the thread acting in this frame gets an indigo highlight frame around its token
        k.push(token(s, x, G.ty, n, n === 'P' ? 's-mem' : 's-thread', 70, 44, 19));  // the thread token itself: green for the producer, pink for the consumers
        k.push(s('text', { x, y: G.ty + 50, 'text-anchor': 'middle', 'font-size': 14.5, 'font-weight': 800, style: `fill:var(${st[1]})` }, st[0]));  // the status words under the token, in the status colour
      });  // ends the loop over threads
      svg.replaceChildren(...k);  // replaces the old picture with the new shapes in one go
      code.clear(); if (f.lines.length) code.mark(f.lines, f.tone === 'bad' ? 'bad' : f.tone === 'ok' ? 'ok' : 'cur');  // clears the listing's highlights, then lights this frame's lines: red for the bug, green for success, otherwise the normal colour
    }  // ends draw
    const player = ctx.ui.player({ count: frames.length, interval: 2600, render: (i) => { draw(frames[i]); return frames[i].cap; } });  // the animation player: one frame per snapshot, 2.6 seconds per frame when playing; render draws frame i and returns its caption
    const seg = ctx.ui.seg([{ value: true, label: 'while (re-test)' }, { value: false, label: 'if (test once)' }], loop, (v) => {  // the while/if switch above the drawing; changing it rebuilds the scenario
      loop = v; frames = build(v);  // records the choice and rebuilds the frames for it
      const nc = ctx.ui.code(srcFor(v), { lang: 'c', fontSize: 13 }); nc.style.flexShrink = '0'; code.replaceWith(nc); code = nc;  // builds a new listing with the matching line 3 and swaps it in place of the old one
      player.stop(); player.setCount(frames.length);  // stops any playback and resets the player to the new number of frames, back at frame 1
    });  // ends the switch handler
    pn.append(h('div', { class: 'split', style: { gridTemplateColumns: 'minmax(0, 11fr) minmax(0, 10fr)', gap: '18px', height: '100%' } },  // builds the tab's layout: listing on the left, drawing on the right, filling the panel
      h('div', { class: 'stack', style: { gap: '8px' } },  // left column: a stack with 8-pixel gaps
        h('p', { class: 'm0 small', html: 'A <span class="t">condition variable</span> works with a critical section (<code>SleepConditionVariableCS</code>) or an SRW lock (<code>SleepConditionVariableSRW</code>). The sleep call releases the lock and sleeps <b>atomically</b>, then re-acquires the lock before it returns. Like SRW locks, these arrived in Windows Vista.' }),  // intro paragraph: which locks a condition variable works with and what the sleep call does atomically
        code,  // the code listing built above
        h('div', { class: 'callout warn small m0', 'data-label': 'Always re-test in a loop', html: 'A woken thread may find the condition false again: another thread got there first, or the wake was a <span class="t">spurious wakeup</span> that nobody sent. Windows allows both.' })),  // amber callout: why a woken thread must re-test, naming stolen and spurious wakeups
      h('div', { class: 'stack', style: { gap: '8px' } },  // right column: the switch, the drawing and the player
        h('div', { class: 'row gap-s' }, h('span', { class: 'small b' }, 'The consumer’s test uses'), seg),  // the switch with its label in front of it
        h('div', { class: 'card white tight' }, svg), player.el)));  // the drawing on a white card, then the player's controls and caption; the brackets close the layout
    return () => player.stop();  // returns a tidy-up function that stops playback when the student switches tabs or leaves the slide
  }  // ends cvTab

  /* Step 8, tab 1: two threads add 1 to a shared counter; the student picks who runs next. */
  function raceTab(pn, ctx) {  // raceTab(pn, ctx): draws the two-thread race on a shared counter into step 8's first tab
    const { h } = ctx;  // takes the HTML builder h out of ctx
    const START = 5;  // START: the counter's starting value; after two increments it should be 7
    const SRC = {  // SRC: the three listings the student can switch between, keyed by mode
      plain: `${/* the plain mode listing starts here (hits++ split into its three machine steps) */''}
r = hits;      // 1. load the shared value into a register${/* shown code, plain line 1: copy the shared counter into a private register */''}
r = r + 1;     // 2. add one, inside the register${/* shown code, plain line 2: add one to the private copy only */''}
hits = r;      // 3. store the register back to memory`,  // shown code, plain line 3: write the private copy back to memory; the backtick ends the plain listing
      cas: `${/* the compare-exchange listing starts here (a loop that retries until its store wins) */''}
do {                          // retry until our store wins${/* shown code, compare-exchange line 1: the top of the retry loop */''}
    old = hits;               // 1. read the shared value${/* shown code, compare-exchange line 2: read the shared counter into old */''}
    nw = old + 1;             // 2. compute, privately${/* shown code, compare-exchange line 3: compute the new value privately */''}
} while (InterlockedCompareExchange( // 3. atomically:${/* shown code, compare-exchange line 4: the atomic compare-and-store call that also decides whether to loop */''}
          &hits, nw, old)     //    store nw if hits == old${/* shown code, compare-exchange line 5: its arguments; it stores nw only if hits still equals old */''}
          != old);            //    returns what it found`,  // shown code, compare-exchange line 6: loop again if the value it found was not old; the backtick ends this listing
      inc: `${/* the one-line InterlockedIncrement listing starts here */''}
InterlockedIncrement(&hits);  // load + add + store, atomically`,  // shown code, increment line 1: the whole load, add and store done as one atomic call; the backtick ends the listing
    };  // closes the SRC table
    const LINES = { plain: [[1], [2], [3]], cas: [[2], [3], [4, 5, 6]], inc: [[1]] };  // LINES: for each mode, the listing lines that belong to step 0, 1 and 2 of a thread, used to place the A and B markers
    let mode = 'plain', hits, th, gen = 0, code;  // state: the chosen mode, the counter, the two threads, a generation number that cancels an old race, and the current listing
    const codeBox = h('div', {});  // codeBox: an empty box that holds whichever listing is current
    const mem = h('div', { class: 'memcell' });  // mem: the green box that shows the shared counter in memory
    const cards = h('div', { class: 'grid-2', style: { gap: '10px' } });  // cards: a two-column grid holding the cards for threads A and B
    const narr = narrBox(ctx, 92);  // narr: the narration box under the cards, at least 92 pixels tall
    function reset(msg) {  // reset(msg): starts the race over; runs when the tab opens, when Reset is clicked and when the mode changes
      gen++;  // bumps the generation number, so a classic race still sleeping between steps stops when it wakes
      hits = START;  // puts the counter back to its starting value
      th = { A: { pc: 0, r: null, old: null, nw: null, done: false, tries: 1 }, B: { pc: 0, r: null, old: null, nw: null, done: false, tries: 1 } };  // both threads start at step 0 with empty registers, not done, on their first try
      code = ctx.ui.code(SRC[mode], { lang: 'c', fontSize: 13 });  // builds a fresh listing for the current mode in C colours
      code.style.flexShrink = '0';  // stops the listing from shrinking when the column is short
      code.querySelectorAll('.ln').forEach((ln) => ln.prepend(h('span', { class: 'gut' })));  // adds an empty gutter span at the start of every listing line, where the A and B markers will go
      codeBox.replaceChildren(code);  // puts the new listing into codeBox, replacing the old one
      narr.say(msg || `Threads A and B both run this code once, so <b>hits</b> should go from ${START} to ${START + 2}. Choose who runs the next step, or play the classic race.`);  // explains the goal (two increments, so the counter should rise by 2), or shows msg if one was passed
      paint();  // draws the counter, the markers and the thread cards
    }  // ends reset
    function step(n) {  // step(n): runs thread n's next step; called by its button or by the classic race
      const t = th[n], o = n === 'A' ? 'B' : 'A';  // t: this thread's record; o: the name of the other thread, used in the retry message
      if (t.done) return;  // a finished thread has nothing left to run
      let m = '', tone = '';  // m will hold the narration text and tone its colour
      if (mode === 'inc') { hits += 1; t.done = true; m = `${n}: InterlockedIncrement makes hits ${hits - 1} → <b>${hits}</b> in one indivisible step. Nothing can run in the middle of it.`; }  // increment mode: the whole update happens in one indivisible step, so the thread finishes at once
      else if (mode === 'plain') {  // plain mode: three separate steps, any of which the other thread can run between
        if (t.pc === 0) { t.r = hits; m = `${n} loads hits into its register: r = ${t.r}.`; }  // step 0: copy the counter into this thread's register
        else if (t.pc === 1) { t.r += 1; m = `${n} adds one inside its register: r = ${t.r}. Memory still says ${hits}.`; }  // step 1: add one to the register; memory has not changed yet
        else { const before = hits; hits = t.r; t.done = true; m = `${n} stores r back: hits ${before} → <b>${hits}</b>.`; }  // step 2: store the register back to memory, overwriting whatever is there, and finish
        if (!t.done) t.pc++;  // moves on to the next step unless the thread just finished
      } else if (t.pc === 0) { t.old = hits; t.pc = 1; m = `${n} reads hits: old = ${t.old}.`; }  // compare-exchange mode, step 0: read the counter into old
      else if (t.pc === 1) { t.nw = t.old + 1; t.pc = 2; m = `${n} computes nw = old + 1 = ${t.nw}, privately.`; }  // step 1: compute nw = old + 1 privately
      else {  // step 2: the atomic compare-exchange
        const found = hits;  // found: what the call finds in memory at this moment
        if (found === t.old) { hits = t.nw; t.done = true; tone = 'ok'; m = `${n}: InterlockedCompareExchange finds ${found}, which equals old, so it stores ${t.nw} (hits = <b>${hits}</b>) and returns ${found}. The loop ends.`; }  // if memory still holds old, the store happens, the thread finishes and the message is green
        else { t.tries++; t.pc = 0; tone = 'warn'; m = `${n}: InterlockedCompareExchange finds <b>${found}</b>, not the ${t.old} that ${n} read, because ${o} changed hits in the meantime. It stores nothing and returns ${found}, which is not old, so ${n} <b>loops and tries again</b>. No update is lost.`; }  // otherwise nothing is stored, the try counter goes up and the thread loops back to step 0, with an amber message naming the other thread
      }  // ends the compare-exchange steps
      if (th.A.done && th.B.done) {  // once both threads have finished, the result is judged
        const ok = hits === START + 2;  // ok is true if the counter rose by exactly 2
        m += ok ? ` <b>Both finished: hits = ${hits}, correct.</b>` : ` <b>Both finished, but hits = ${hits}, not ${START + 2}: one increment was lost,</b> because both threads stored a value computed from the same old ${START}.`;  // adds a final sentence: correct, or that one increment was lost because both threads stored a value made from the same old count
        tone = ok ? 'ok' : 'bad';  // turns the message green for a correct result and red for a lost update
      }  // ends the final check
      narr.say(m, tone);  // shows the message in the narration box with its colour
      paint();  // redraws the counter, the markers and the cards
    }  // ends step
    async function classic() {  // classic(): plays the classic strict-turns interleaving automatically, one step every 1.1 seconds; async lets it pause with await
      reset('Classic race: A and B take turns, one step each.');  // starts from a fresh race with a message saying the threads will take turns
      const g = gen;  // g remembers this race's generation, so it can tell if the student has started something else
      const order = ['A', 'B', 'A', 'B', 'A', 'B'];  // order: strict turns, A then B, three times each
      for (let i = 0; i < 12; i++) {  // at most 12 steps, enough for a compare-exchange retry to finish
        await ctx.sleep(1100);  // waits 1.1 seconds between steps
        if (!ctx.alive || g !== gen) return;  // stops if the slide was left or the generation changed (Reset, a mode change or a manual step)
        if (th.A.done && th.B.done) return;  // stops once both threads are done
        const want = i < order.length ? order[i] : 'A';  // takes the next thread from the turn order, or A once the order runs out
        step(th[want].done ? (want === 'A' ? 'B' : 'A') : want);  // runs that thread's step, or the other thread's if that one is already finished
      }  // ends the loop
    }  // ends classic
    function paint() {  // paint(): redraws the counter box, the line markers and the two thread cards
      mem.replaceChildren(h('div', { class: 'xs b muted' }, 'shared memory'), h('div', { class: 'mono b', style: { fontSize: '26px' } }, `hits = ${hits}`));  // the counter box: a small grey label and the current value in large fixed-width digits
      const at = (n) => (th[n].done ? [] : LINES[mode][th[n].pc]);  // at(n): the listing lines where thread n currently is, or none once it has finished
      code.querySelectorAll('.ln').forEach((ln, k) => {  // goes through every listing line, k counting from 0
        const who = ['A', 'B'].filter((n) => at(n).includes(k + 1));  // who: the threads (A, B or both) whose current step is on this line
        ln.querySelector('.gut').innerHTML = who.map((n) => `<i class="mk m${n}">${n}</i>`).join('');  // writes a coloured marker for each of them into the line's gutter
        ln.classList.toggle('cur', who.length > 0);  // highlights the line if any thread is on it
      });  // ends the loop over lines
      cards.replaceChildren(...['A', 'B'].map((n) => {  // rebuilds the two thread cards
        const t = th[n];  // t: this thread's record
        const regs = mode === 'plain' ? `r = ${t.r ?? '–'}` : mode === 'cas' ? `old = ${t.old ?? '–'} · nw = ${t.nw ?? '–'}` : 'no private copy at all';  // regs: the thread's private values as text: r in plain mode, old and nw in compare-exchange mode, nothing in increment mode (a dash means empty)
        const b = btn(ctx, t.done ? 'done' : `${n} runs its next step`, () => { gen++; step(n); }, 'sm ' + (n === 'A' ? 'cpu' : 'thread'));  // the thread's step button, blue for A and pink for B; a manual click bumps the generation so a running classic race stops
        b.disabled = t.done;  // a finished thread's button is greyed out
        return h('div', { class: 'thcard' + (t.done ? ' done' : '') },  // the card, green once the thread has finished
          h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', { style: { fontSize: '18px' } }, 'Thread ' + n), h('span', { class: 'chip ' + (t.done ? 'ok' : '') }, t.done ? 'finished' : mode === 'cas' && t.tries > 1 ? `try ${t.tries}` : 'running')),  // card heading: the thread's name, and a chip saying running, finished, or which try a retrying thread is on
          h('div', { class: 'mono small' }, regs), b);  // the private values in small fixed-width text, then the step button
      }));  // ends the card loop
    }  // ends paint
    const seg = ctx.ui.seg([{ value: 'plain', label: 'Plain hits++' }, { value: 'cas', label: 'Compare-exchange loop' }, { value: 'inc', label: 'InterlockedIncrement' }], mode, (v) => { mode = v; reset(); });  // the mode switch: plain increment, compare-exchange loop or InterlockedIncrement; changing it resets the race
    pn.append(h('div', { class: 'split', style: { gridTemplateColumns: 'minmax(0, 11fr) minmax(0, 10fr)', gap: '18px', height: '100%' } },  // builds the tab's layout: listing and tasks on the left, counter and threads on the right
      h('div', { class: 'stack', style: { gap: '8px' } },  // left column: a stack with 8-pixel gaps
        h('div', { class: 'row gap-s' }, h('span', { class: 'small b' }, 'Code'), seg),  // a row with the word Code and the mode switch
        codeBox,  // the box that holds the current listing
        h('div', { class: 'card tight small' }, h('b', {}, 'Try these'),  // the "Try these" card with numbered experiments
          h('ol', { class: 'm0', style: { paddingLeft: '20px', lineHeight: 1.4 } },  // the numbered list, indented so the numbers show
            h('li', {}, 'Plain: play the classic race. What is hits at the end?'),  // experiment 1: the classic race in plain mode and its final count
            h('li', {}, 'Plain: run A three times, then B. Is anything lost?'),  // experiment 2: a run with no interleaving, to show nothing is lost then
            h('li', {}, 'Compare-exchange: play the race. Who must retry, and why?'),  // experiment 3: who must retry in the compare-exchange race
            h('li', {}, 'InterlockedIncrement: can any order lose an update?'))),  // experiment 4: whether any order can break InterlockedIncrement; closes the list and card
        h('div', { class: 'callout why small m0', 'data-label': 'Lock-free', html: 'In the compare-exchange loop no thread ever waits or holds a lock. A thread that loses the race just tries again with the fresh value. That is <span class="t">lock-free synchronization</span>, and the same pattern pushes items onto a shared linked list.' })),  // "Lock-free" callout: no thread waits or holds a lock, a loser just retries; closes the left column
      h('div', { class: 'stack', style: { gap: '10px' } },  // right column: a stack with 10-pixel gaps
        mem, cards, narr,  // the counter box, the thread cards and the narration box
        h('div', { class: 'row gap-s' }, btn(ctx, '▶ Play the classic race', classic, 'sm primary'), btn(ctx, 'Reset', () => reset(), 'sm')))));  // a row with the Play the classic race button and Reset; the brackets close the layout and the append call
    reset();  // sets up the first race as soon as the tab opens
    return () => { gen++; };  // returns a tidy-up function that bumps the generation, so a classic race still running stops when the tab or slide closes
  }  // ends raceTab

  /* Step 8, tab 2: try each interlocked function on a value and read what it returns. */
  function fnTab(pn, ctx) {  // fnTab(pn, ctx): draws the try-each-function panel into step 8's second tab
    const { h } = ctx;  // takes the HTML builder h out of ctx
    const FN = {  // FN: the four interlocked functions; for each, its name, the call as text, run (what x becomes and what is returned), and table text
      inc: { name: 'InterlockedIncrement', call: (x) => `InterlockedIncrement(&x)`, run: (x) => [x + 1, x + 1], does: 'x = x + 1', ret: 'the new value' },  // InterlockedIncrement: x becomes x + 1 and the call returns that new value
      dec: { name: 'InterlockedDecrement', call: (x) => `InterlockedDecrement(&x)`, run: (x) => [x - 1, x - 1], does: 'x = x − 1', ret: 'the new value' },  // InterlockedDecrement: x becomes x - 1 and the call returns that new value
      xchg: { name: 'InterlockedExchange', call: (x, v) => `InterlockedExchange(&x, ${v})`, run: (x, v) => [v, x], does: 'x = v', ret: 'the old value' },  // InterlockedExchange: x becomes v and the call returns the value x had before
      cmpx: { name: 'InterlockedCompareExchange', call: (x, v, c) => `InterlockedCompareExchange(&x, ${v}, ${c})`, run: (x, v, c) => [x === c ? v : x, x], does: 'x = v if x == c', ret: 'the old value, always' },  // InterlockedCompareExchange: x becomes v only if x equals c, and the call always returns the old x
    };  // closes the FN table
    let f = 'cmpx', x = 5, v = 9, c = 5;  // the starting choice: compare-exchange with x = 5, v = 9 and c = 5, so the first view shows a swap that succeeds
    const out = h('div', { class: 'stack', style: { gap: '8px' } });  // out: the result area on the right, rebuilt by update()
    function update() {  // update(): recomputes and redraws the result whenever the function or a slider changes
      const F = FN[f], [after, ret] = F.run(x, v, c);  // F: the chosen function; after and ret: the value of x after the call and what the call returns
      out.replaceChildren(  // refills the result area
        h('div', { class: 'mono small', style: { background: 'var(--panel-3)', borderRadius: '8px', padding: '8px 10px' } }, F.call(x, v, c) + ';'),  // the call written out as C code with the current numbers, on a grey strip
        h('div', { class: 'grid-3', style: { gap: '8px' } },  // three boxes side by side
          h('div', { class: 'memcell' }, h('div', { class: 'xs b muted' }, 'x before'), h('div', { class: 'mono b', style: { fontSize: '24px' } }, String(x))),  // box 1: x before the call
          h('div', { class: 'memcell' + (after !== x ? ' chg' : '') }, h('div', { class: 'xs b muted' }, 'x after'), h('div', { class: 'mono b', style: { fontSize: '24px' } }, String(after))),  // box 2: x after the call, highlighted in indigo if it changed
          h('div', { class: 'memcell ret' }, h('div', { class: 'xs b muted' }, 'returns'), h('div', { class: 'mono b', style: { fontSize: '24px' } }, String(ret)))),  // box 3: the value the call returns, in blue
        h('p', { class: 'm0 small', html: f === 'cmpx'  // an explanation under the boxes, written for the chosen function and numbers; the first case is compare-exchange
          ? (x === c ? `x (${x}) equals the comparand c (${c}), so ${v} is stored. It returns the old ${x}; the caller sees that the result equals c and knows <b>its swap happened</b>.` : `x (${x}) does not equal the comparand c (${c}), so <b>nothing is stored</b>. It returns ${x}; the caller sees that the result is not c and knows another thread got there first.`)  // compare-exchange: says whether x matched the comparand, whether the store happened, and how the caller can tell from the return value
          : f === 'xchg' ? `Stores ${v} and hands back what was there before (${x}), in one step. A thread can claim a flag this way: if the old value was 0, it was the one that set it.`  // exchange case: the value is swapped in one step, and the old value tells a thread whether it was the one that claimed a flag
          : `${f === 'inc' ? 'Adds' : 'Subtracts'} one and returns the new value (${after}), so the caller learns the exact count it produced, which a separate read afterwards could not promise.` }));  // increment or decrement case: the returned new value tells the caller the exact count it produced; closes the result area
    }  // ends update
    const fseg = ctx.ui.seg([{ value: 'inc', label: 'Increment' }, { value: 'dec', label: 'Decrement' }, { value: 'xchg', label: 'Exchange' }, { value: 'cmpx', label: 'CompareExchange' }], f, (val) => { f = val; sv.style.display = f === 'xchg' || f === 'cmpx' ? '' : 'none'; sc.style.display = f === 'cmpx' ? '' : 'none'; update(); });  // the function switch; choosing one shows the v slider only for exchange and compare-exchange, and the c slider only for compare-exchange
    const sx = ctx.ui.slider({ label: 'x is now', min: 0, max: 9, value: x, onInput: (val) => { x = val; update(); } });  // slider for x, the value in memory before the call (0 to 9)
    const sv = ctx.ui.slider({ label: 'new value v', min: 0, max: 9, value: v, onInput: (val) => { v = val; update(); } });  // slider for v, the new value to store (0 to 9)
    const sc = ctx.ui.slider({ label: 'comparand c', min: 0, max: 9, value: c, onInput: (val) => { c = val; update(); } });  // slider for c, the comparand that x must equal for the swap to happen (0 to 9)
    const rows = Object.values(FN).map((F) => h('tr', {}, h('td', { class: 'mono' }, F.name), h('td', { class: 'mono' }, F.does), h('td', {}, F.ret)));  // rows: one table row per function: its name, what it does and what it returns
    pn.append(h('div', { class: 'split', style: { gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '20px', height: '100%' } },  // builds the tab's layout: explanation and table on the left, the experiment on the right, in two equal columns
      h('div', { class: 'stack', style: { gap: '8px' } },  // left column: a stack with 8-pixel gaps
        h('p', { class: 'm0 small', html: 'Each <span class="t">interlocked operation</span> reads, changes and writes one variable as a single atomic hardware operation. They never block and never enter the kernel.' }),  // intro paragraph: an interlocked operation is one atomic hardware step that never blocks or enters the kernel
        h('table', { class: 'tbl compact' }, h('thead', {}, h('tr', {}, h('th', {}, 'Function'), h('th', {}, 'Does, atomically'), h('th', {}, 'Returns'))), h('tbody', {}, ...rows)),  // the summary table with a header row and the function rows
        h('div', { class: 'callout analogy small m0', 'data-label': 'Seen before', html: '<span class="t">InterlockedCompareExchange</span> is the <span class="t" data-t="compare_and_swap">compare_and_swap</span> instruction from chapter 5 with a Windows name: compare with an expected value, swap only on a match, report what was found.' })),  // "Seen before" callout: compare-exchange is chapter 5's compare_and_swap under a Windows name; closes the left column
      h('div', { class: 'stack', style: { gap: '9px' } },  // right column: a stack with 9-pixel gaps
        h('div', { class: 'row gap-s' }, h('span', { class: 'small b' }, 'Try'), fseg),  // a row with the word Try and the function switch
        sx, sv, sc, out)));  // the three sliders and the result area; the brackets close the layout and the append call
    update();  // draws the first result as soon as the tab opens
  }  // ends fnTab

  Guide.section({  // registers section 6.10 with the guide: its id, titles, objectives, glossary terms, styles, steps, quiz and notes
    id: '6.10',  // the section number, used in links, saved progress and the CSS class sec-6-10
    title: 'Windows Concurrency Mechanisms',  // the full title shown on the section's slides and in the contents
    short: 'Windows sync',  // the short title used where space is tight, in the section lists on the home page's chapter cards
    summary: 'Windows threads sleep on signaled kernel objects or use cheap user-mode locks and interlocked operations.',  // a one-sentence summary shown under the section title in the contents list, where the filter also searches it
    objectives: [  // objectives: what the student should be able to do after this section
      'Explain how a wait function puts a thread to sleep until a dispatcher object is signaled, and use WaitForSingleObject and WaitForMultipleObjects in wait-any and wait-all form.',  // objective 1: use wait functions on one or several dispatcher objects
      'State, for each of the eight kinds of dispatcher object, when it becomes signaled and how many waiting threads it releases.',  // objective 2: for each of the eight dispatcher objects, when it is signaled and how many waiters it releases
      'Compare critical sections with mutexes and explain why a critical section usually never enters the kernel.',  // objective 3: compare critical sections with mutexes and explain the user-mode fast path
      'Use slim reader-writer locks and condition variables correctly, re-checking the condition in a loop.',  // objective 4: use SRW locks and condition variables, re-testing the condition in a loop
      'Update shared variables without a lock using interlocked operations, including InterlockedCompareExchange.',  // objective 5: update shared variables without a lock using interlocked operations
    ],  // closes the objectives list
    terms: [  // terms: glossary entries as [term, definition]; they feed the Glossary panel and the dotted-word pop-ups
      ['Wait function', 'A Windows call, such as WaitForSingleObject or WaitForMultipleObjects, with which a thread blocks itself until the objects it names are signaled or a time limit runs out. While it waits, the thread uses no processor time.'],  // glossary entry: defines a wait function
      ['Dispatcher object', 'A Windows kernel object that a thread can wait on with a wait function. It is always in one of two states, signaled or nonsignaled, and waiting threads are released when it becomes signaled.'],  // glossary entry: defines a dispatcher object and its two states
      ['Signaled state', 'The “go” state of a dispatcher object: a thread waiting on it may continue. Its opposite, the nonsignaled state, keeps waiting threads asleep.'],  // glossary entry: defines the signaled state and its opposite
      ['Notification event (manual-reset event)', 'An event object that, once set, stays signaled and releases every waiting thread, and any thread that waits later, until some thread resets it.'],  // glossary entry: defines a notification (manual-reset) event
      ['Synchronization event (auto-reset event)', 'An event object that, when set, releases exactly one waiting thread and then returns to nonsignaled by itself. If nobody is waiting, it stays signaled until one thread waits.'],  // glossary entry: defines a synchronization (auto-reset) event
      ['Abandoned mutex', 'A Windows mutex whose owning thread ended without releasing it. The next thread to get it receives ownership plus a warning (WAIT_ABANDONED), because the data it protects may be half-updated.'],  // glossary entry: defines an abandoned mutex and the WAIT_ABANDONED warning
      ['Waitable timer', 'A dispatcher object that becomes signaled when a chosen time arrives or a repeating interval expires, so threads can sleep until then.'],  // glossary entry: defines a waitable timer
      ['Critical section object', 'A Windows lock (type CRITICAL_SECTION) for the threads of one process only. Taking it when it is free costs one interlocked instruction in user mode; the kernel is involved only when a thread must sleep.'],  // glossary entry: defines the critical section object and its cheap user-mode fast path
      ['Contention', 'A thread asks for a lock that another thread is holding at that moment. A lock that is free when it is requested is uncontended.'],  // glossary entry: defines contention (asking for a lock that is busy)
      ['Spin count', 'How many times a thread that finds a critical section busy re-checks it in a tight loop before it gives up and sleeps in the kernel. Single-processor machines ignore it.'],  // glossary entry: defines the spin count of a critical section
      ['Slim reader-writer lock (SRW lock)', 'A pointer-sized Windows lock for the threads of one process, with a shared mode that many readers may hold together and an exclusive mode that one writer holds alone. It cannot be acquired recursively.'],  // glossary entry: defines the slim reader-writer (SRW) lock
      ['Shared mode', 'The way readers hold an SRW lock: any number of threads may hold it in shared mode at once, as long as nobody holds it in exclusive mode.'],  // glossary entry: defines shared mode of an SRW lock
      ['Exclusive mode', 'The way a writer holds an SRW lock: one thread alone, with no readers and no other writer.'],  // glossary entry: defines exclusive mode of an SRW lock
      ['Spurious wakeup', 'A return from a condition-variable sleep that no wake call caused. Windows allows them, so a woken thread must re-test its condition, just as it must when another thread got to the data first.'],  // glossary entry: defines a spurious wakeup
      ['Interlocked operation', 'A Windows function, such as InterlockedIncrement, that reads, changes and writes one shared variable as a single atomic hardware operation, so no lock is needed.'],  // glossary entry: defines an interlocked operation
      ['InterlockedCompareExchange', 'An interlocked operation that stores a new value in a variable only if the variable still holds an expected value, and always returns the value it found there. It is the Windows form of compare_and_swap.'],  // glossary entry: defines InterlockedCompareExchange
      ['Lock-free synchronization', 'Keeping shared data correct without any lock: threads update it with atomic instructions, and a thread whose update loses a race simply retries, so no thread ever blocks.'],  // glossary entry: defines lock-free synchronization
    ],  // closes the terms list
    css: ` /* css: this section's own style rules, added to the page once; every rule starts with .sec-6-10 so it touches only this section */
      .sec-6-10 pre.code { contain: inline-size; } /* code listings in this section do not grow with their longest line, so a long line cannot widen its column */
      .sec-6-10 .narr { background: var(--panel-2); border: 1px solid var(--line); border-left: 5px solid var(--chc); border-radius: 12px; padding: 8px 12px; font-size: 15px; line-height: 1.45; } /* the narration box: a tinted panel with a thick left bar in the chapter colour, rounded corners and comfortable text */
      .sec-6-10 .narr.ok { border-left-color: var(--ok); background: var(--ok-bg); } /* a narration in the ok tone gets a green bar and a pale green fill */
      .sec-6-10 .narr.bad { border-left-color: var(--bad); background: var(--bad-bg); } /* a narration in the bad tone gets a red bar and a pale red fill */
      .sec-6-10 .narr.warn { border-left-color: var(--warn); background: var(--warn-bg); } /* a narration in the warn tone gets an amber bar and a pale amber fill */
      .sec-6-10 .mw0 > * { min-width: 0; } /* helper class (not used by the current steps): lets every child of a .mw0 box shrink below the width of its content */
      .sec-6-10 .lbl { font-size: 12.5px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: var(--muted); } /* .lbl: small grey uppercase labels, such as the band titles in step 1 and the numbered instructions in step 4 */
      .sec-6-10 .band { border-radius: 12px; padding: 8px 10px; display: flex; flex-direction: column; gap: 6px; } /* .band: a rounded strip with its items stacked, used for the user-mode and kernel-mode groups in step 1 */
      .sec-6-10 .band.user { background: var(--proc-bg); border: 1px dashed var(--proc); } /* the user-mode band: pale teal with a dashed teal border */
      .sec-6-10 .band.kern { background: var(--os-bg); border: 1px dashed var(--os); } /* the kernel-mode band: pale purple with a dashed purple border */
      .sec-6-10 .btn.tool { width: 100%; justify-content: flex-start; height: 40px; background: var(--panel); } /* step 1's tool buttons: full width, text on the left, 40 pixels tall, on a white background */
      .sec-6-10 .btn.tool[aria-pressed="true"] { background: var(--accent-bg); box-shadow: 0 0 0 2px var(--chc); } /* the chosen tool button gets the pale accent fill and a ring in the chapter colour */
      .sec-6-10 .tdetail .chip { white-space: normal; } /* chips in step 1's detail box may wrap onto two lines instead of overflowing */
      .sec-6-10 .tdetail { background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 10px 14px; display: flex; flex-direction: column; gap: 8px; } /* step 1's detail box: a white rounded panel whose parts stack with 8-pixel gaps */
      .sec-6-10 table.otbl td { font-size: 14px; line-height: 1.3; vertical-align: middle; } /* cells of step 3's object table: slightly smaller text, centred vertically */
      .sec-6-10 table.otbl th { font-size: 12.5px; } /* headings of step 3's object table: smaller text */
      .sec-6-10 table.otbl tr.dim td { opacity: .35; } /* rows of step 3's table that the filter hides are faded to 35 percent rather than removed */
      .sec-6-10 .btn.rowbtn { width: 100%; justify-content: flex-start; font-weight: 750; white-space: normal; text-align: left; height: auto; min-height: 30px; line-height: 1.15; padding: 3px 8px; } /* the object-name buttons in step 3's table: full width, left-aligned, allowed to wrap and grow taller for long names */
      .sec-6-10 .btn.objbtn { width: 100%; justify-content: flex-start; white-space: normal; text-align: left; height: auto; min-height: 32px; line-height: 1.15; padding: 4px 9px; } /* the object-type buttons in step 4: full width, left-aligned, allowed to wrap onto two lines */
      .sec-6-10 .ocard { border: 2px solid var(--line-2); background: var(--panel); border-radius: 12px; padding: 8px 10px; display: flex; flex-direction: column; gap: 6px; min-width: 0; } /* step 5's object cards: a white rounded card with a grey border and its parts stacked */
      .sec-6-10 .ocard.on { border-color: var(--ok); background: var(--ok-bg); } /* a step 5 object card that is signaled turns green */
      .sec-6-10 .tpanel { border: 2px solid var(--thread); background: var(--thread-bg); border-radius: 12px; padding: 8px 12px; display: flex; flex-direction: column; gap: 8px; } /* step 5's panel for thread T: pink border and pale pink fill, its rows stacked */
      .sec-6-10 .tok { display: inline-grid; place-items: center; width: 34px; height: 30px; border-radius: 8px; border: 2px solid var(--thread); background: var(--panel); font-weight: 900; } /* the small square badge with T's name inside step 5's thread panel */
      .sec-6-10 ol.try2 { display: grid; column-gap: 26px; } /* the "Try these" list in step 4 is laid out as a grid, so it can show two columns side by side */
      .sec-6-10 .cmp { display: grid; grid-template-columns: 130px minmax(0, 1fr) 56px; align-items: center; column-gap: 10px; row-gap: 2px; } /* step 6's cost bars: each row is a 130-pixel label, a bar that takes the rest of the width and a 56-pixel number */
      .sec-6-10 .track { height: 24px; background: var(--panel-3); border-radius: 8px; overflow: hidden; } /* the grey track behind each cost bar; overflow hidden keeps the coloured bar inside its rounded ends */
      .sec-6-10 .track > i { display: block; height: 100%; border-radius: 8px; transition: width .3s; } /* the coloured bar inside a track fills its height, and its width changes smoothly over 0.3 seconds when a slider moves */
      .sec-6-10 .track.mx > i { background: var(--os); } .sec-6-10 .track.cs > i { background: var(--proc); } /* the mutex bar is purple (kernel colour) and the critical-section bar is teal (process colour) */
      .sec-6-10 .paths { display: flex; height: 20px; border-radius: 8px; overflow: hidden; background: var(--panel-3); } /* step 6's "where entries go" strip: one 20-pixel bar split into coloured parts side by side */
      .sec-6-10 .paths > i { display: block; height: 100%; transition: width .3s; } /* each part of the strip fills its height, and its width slides smoothly when the numbers change */
      .sec-6-10 .paths > i.pf { background: var(--ok); } .sec-6-10 .paths > i.ps { background: var(--accent); } .sec-6-10 .paths > i.pk { background: var(--warn); } /* strip colours: green for the user-mode fast path, indigo for spin-then-succeed, amber for sleeping in the kernel */
      .sec-6-10 .lockbox { border: 2px solid var(--os); background: var(--os-bg); border-radius: 12px; padding: 8px 12px; display: flex; flex-direction: column; gap: 4px; } /* step 7's lock box: purple border and pale purple fill, with its three rows stacked */
      .sec-6-10 .srwgrid { display: grid; gap: 8px; } /* step 7's grid of thread cards; the number of columns is set in the code by screen size */
      .sec-6-10 .scard { border: 2px solid var(--line-2); background: var(--panel); border-radius: 12px; padding: 8px 9px; display: flex; flex-direction: column; gap: 6px; min-width: 0; min-height: 132px; } /* an SRW thread card: white, rounded, its parts stacked, at least 132 pixels tall so the cards line up whatever their state */
      .sec-6-10 .scard .btn { width: 100%; padding: 0 6px; } /* buttons inside a thread card take the card's full width with tight side padding */
      .sec-6-10 .scard.holding { border-color: var(--ok); background: var(--ok-bg); } /* a thread card that holds the lock turns green */
      .sec-6-10 .scard.waiting { border-color: var(--warn); background: var(--warn-bg); } /* a thread card that is waiting turns amber */
      .sec-6-10 .scard.stuck { border-color: var(--bad); background: var(--bad-bg); } /* a thread card that is stuck waiting for itself turns red */
      .sec-6-10 .memcell { border: 2px solid var(--mem); background: var(--mem-bg); border-radius: 12px; padding: 6px 12px; text-align: center; } /* step 8's value boxes: green border and pale green fill (memory colours), text centred */
      .sec-6-10 .memcell.chg { border-color: var(--accent); background: var(--accent-bg); } /* the "x after" box turns indigo when the call changed x */
      .sec-6-10 .memcell.ret { border-color: var(--cpu); background: var(--cpu-bg); } /* the "returns" box is blue, to set the returned value apart from memory */
      .sec-6-10 .thcard { border: 2px solid var(--line-2); background: var(--panel); border-radius: 12px; padding: 8px 10px; display: flex; flex-direction: column; gap: 6px; min-width: 0; } /* step 8's thread cards in the race: white, rounded, their parts stacked */
      .sec-6-10 .thcard.done { border-color: var(--ok); background: var(--ok-bg); } /* a thread card that has finished turns green */
      .sec-6-10 pre.code .gut { display: inline-flex; gap: 2px; width: 48px; vertical-align: top; } /* the gutter added to each race listing line: a 48-pixel slot in front of the code where the A and B markers sit */
      .sec-6-10 pre.code .mk { font-style: normal; font-family: var(--font); font-size: 12.5px; font-weight: 800; line-height: 1; padding: 2px 5px; border-radius: 5px; color: var(--accent-ink); } /* a thread marker in the gutter: a small bold tag with rounded corners in the page font, not the code font */
      .sec-6-10 pre.code .mk.mA { background: var(--cpu); } .sec-6-10 pre.code .mk.mB { background: var(--thread); } /* thread A's marker is blue and thread B's marker is pink, matching their step buttons */
      .sec-6-10 .btn.tbtn { width: 100%; white-space: normal; height: auto; min-height: 36px; line-height: 1.15; padding: 4px 8px; } /* step 9's answer buttons: full width, allowed to wrap onto two lines for long tool names */
      .sec-6-10 .btn.tbtn.right { border-color: var(--ok); background: var(--ok-bg); color: var(--ok); opacity: 1; } /* after an answer, the right tool's button turns green and stays fully visible even though it is disabled */
      .sec-6-10 .btn.tbtn.wrong { border-color: var(--bad); background: var(--bad-bg); color: var(--bad); opacity: 1; } /* the wrongly chosen button turns red, also fully visible while disabled */
      .sec-6-10 .keep { display: grid; grid-template-columns: 28px minmax(0, 1fr); gap: 8px; align-items: start; background: var(--panel-2); border: 1px solid var(--line); border-radius: 10px; padding: 7px 10px; font-size: 14.5px; line-height: 1.38; } /* step 9's "things to remember" rows: a number column and a text column on a tinted rounded panel */
      .sec-6-10 .keep .kn { display: inline-grid; place-items: center; width: 26px; height: 26px; border-radius: 50%; background: var(--chc); color: var(--accent-ink); font-weight: 800; font-size: 14px; } /* the round numbered badge in each "remember" row, filled with the chapter colour */
      .sec-6-10 .facts { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px; } /* step 2's two fact boxes, side by side in equal columns */
      .sec-6-10 .facts > div { background: var(--panel-2); border: 1px solid var(--line); border-radius: 10px; padding: 7px 10px; font-size: 14.5px; line-height: 1.4; } /* each fact box: tinted, rounded, with slightly smaller text */
    `,  // ends the section's style text
    steps: [  // steps: the ten screens of this section, in order
      /* ---------------- 1. Big picture: the toolbox ---------------- */
      {  // opens step 1, the big picture
        title: 'Windows builds synchronization into its objects',  // step 1 title: Windows builds synchronization into its objects
        kind: 'story',  // kind story: the guide labels it Big Picture and keeps it on the core path
        html: `${/* the step's fixed HTML starts here; render() below fills in its empty boxes */''}
          <div class="split fill">${/* two-column layout filling the step */''}
            <div class="stack" style="gap:10px">${/* left column: the explanation, stacked with 10-pixel gaps */''}
              <p class="lead m0">Windows threads that share data need to take turns and wait for each other, just like the processes of chapter 5.</p>${/* opening sentence: Windows threads have the same need to take turns as the processes of chapter 5 */''}
              <p class="m0">Windows answers with a family of tools rather than a single one. Some are <b>kernel objects</b>: a thread can wait on them, and they work across processes. Others live in the program’s <b>own memory</b> and stay in <span class="t">user mode</span>, which makes them far cheaper but limits them to the threads of one process. The cheapest of all are single atomic instructions that need no lock at all.</p>${/* paragraph: the two families of tools, kernel objects and user-mode tools, and the trade-off between reach and cost */''}
              <p class="m0">Choosing well comes down to two questions: <b>who</b> must coordinate (threads of one process, or several processes?) and <b>how often</b> the threads collide.</p>${/* paragraph: the two questions that decide which tool to choose */''}
              <div class="callout analogy m0" data-label="Analogy">An apartment building. The front desk (the kernel) can coordinate everyone in the building and phones you when your parcel arrives, but every visit is a trip downstairs. A note on your own fridge (user mode) reaches only your flatmates, but reading it takes a second.</div>${/* analogy callout: the front desk of an apartment building versus a note on your own fridge */''}
              <div class="row gap-s small"><span class="chip os">wake threads with signaled objects</span><span class="chip thread">wait for any or for all</span><span class="chip proc">measure what a lock costs</span><span class="chip mem">update data with no lock</span></div>${/* a row of four coloured chips previewing what the later steps do */''}
            </div>${/* closes the left column */''}
            <div class="card stack" style="gap:8px">${/* right column: the toolbox card */''}
              <h4 class="m0">The Windows toolbox: click a tool</h4>${/* card heading telling the student to click a tool */''}
              <div class="band user"><div class="lbl">User mode · in one process’s own memory</div><div class="grid-2 ubtns" style="gap:8px"></div></div>${/* the user-mode band with its label and an empty two-column box where render() puts four tool buttons */''}
              <div class="band kern"><div class="lbl">Kernel mode · objects managed by the executive</div><div class="kbtns"></div></div>${/* the kernel-mode band with its label and an empty box for the dispatcher-objects button */''}
              <div class="tdetail grow"></div>${/* the empty detail box that shows the chosen tool and takes the leftover height */''}
            </div>${/* closes the toolbox card */''}
          </div>`,  // closes the layout; the backtick ends the step's HTML
        render(el, ctx) {  // render(el, ctx): runs when step 1 opens; adds the tool buttons and the detail view
          const { h } = ctx;  // takes the HTML builder h out of ctx
          const tools = [  // tools: the five tools, each with a name, glossary term, band (u user mode, k kernel), colour, description, scope and kernel use
            { name: 'Critical section', t: 'critical section object', band: 'u', cls: 'proc',  // tool 1: the critical section, a user-mode lock for one process
              what: 'A lock for the threads of <b>one process</b>. A free one is taken with a single interlocked instruction, entirely in user mode. Only a thread that finds it busy may end up sleeping in the kernel.',  // what a critical section does and when it touches the kernel
              scope: 'threads of one process', kern: 'only when a thread must sleep', where: 'Step 6 measures what this saves.' },  // who can use it, when it enters the kernel, and which step explores it
            { name: 'SRW lock', t: 'slim reader-writer lock', band: 'u', cls: 'proc',  // tool 2: the SRW lock, a user-mode lock with shared and exclusive modes
              what: 'A lock the size of one pointer with two modes: <b>shared</b>, which any number of readers may hold together, and <b>exclusive</b>, which one writer holds alone.',  // what an SRW lock is and its two modes
              scope: 'threads of one process', kern: 'only when a thread must sleep', where: 'Step 7 has a playground.' },  // who can use it, when it enters the kernel, and which step has its playground
            { name: 'Condition variable', t: 'condition variable', band: 'u', cls: 'proc',  // tool 3: the condition variable
              what: 'Lets a thread that holds a critical section or SRW lock <b>release it and go to sleep in one atomic step</b>, until another thread changes the shared data and wakes it.',  // what a condition variable lets a lock holder do
              scope: 'threads of one process', kern: 'only to sleep and wake', where: 'Step 7 traces one, step by step.' },  // who can use it, when it enters the kernel, and which step traces it
            { name: 'Interlocked operations', t: 'interlocked operation', band: 'u', cls: 'mem',  // tool 4: interlocked operations, in memory green
              what: 'Single atomic hardware operations on one variable: increment, decrement, exchange and compare-and-exchange. No lock and no waiting: the basis of <b>lock-free</b> code.',  // what interlocked operations are and why they need no lock
              scope: 'any code that shares the variable', kern: 'never', where: 'Step 8 races two threads.' },  // who can use them, the fact that they never enter the kernel, and which step races them
            { name: 'Dispatcher objects + wait functions', t: 'dispatcher object', band: 'k', cls: 'os',  // tool 5: dispatcher objects with wait functions, the kernel-mode family
              what: 'Kernel objects that are always either <b>signaled</b> or <b>nonsignaled</b>: events, mutexes, semaphores and waitable timers, and also files, processes and threads. A thread calls a wait function and sleeps, using no processor time, until the object is signaled.',  // what dispatcher objects are, which kinds exist, and how a waiting thread sleeps
              scope: 'any process holding a handle', kern: 'every wait and every release', where: 'Steps 2 to 5.' },  // who can use them, that every wait and release enters the kernel, and which steps cover them
          ];  // closes the tools list
          const detail = ctx.$('.tdetail');  // detail: the empty detail box from the HTML, found with ctx.$ (the first match inside this step)
          const btns = tools.map((t, i) => h('button', { class: 'btn tool ' + t.cls, type: 'button', 'aria-pressed': 'false', onclick: () => show(i) }, t.name));  // btns: one button per tool in the tool's colour; aria-pressed tells screen readers which one is chosen
          ctx.$('.ubtns').append(...btns.slice(0, 4));  // the first four buttons go into the user-mode band
          ctx.$('.kbtns').append(btns[4]);  // the fifth button goes into the kernel-mode band
          function show(i) {  // show(i): marks tool i as chosen and fills the detail box with its facts
            const t = tools[i];  // t: the chosen tool
            btns.forEach((b, j) => b.setAttribute('aria-pressed', String(i === j)));  // marks only the chosen button as pressed, which also highlights it
            detail.replaceChildren(  // refills the detail box
              h('div', { class: 'row', style: { justifyContent: 'space-between' } },  // top row of the detail box
                h('b', { style: { fontSize: '18px' }, html: `<span class="t" data-t="${t.t}">${t.name}</span>` }),  // the tool's name in large bold, as a dotted glossary term
                h('span', { class: 'chip ' + (t.band === 'k' ? 'os' : 'proc') }, t.band === 'k' ? 'kernel mode' : 'user mode')),  // a chip on the right saying kernel mode (purple) or user mode (teal)
              h('p', { class: 'm0', style: { fontSize: '15.5px' }, html: t.what }),  // the tool's description
              h('div', { class: 'row gap-s' }, h('span', { class: 'chip' }, 'Who can use it: ' + t.scope), h('span', { class: 'chip ' + (t.kern === 'never' ? 'ok' : t.band === 'k' ? 'warn' : 'accent') }, 'Enters the kernel: ' + t.kern)),  // two chips: who can use it, and when it enters the kernel (green if never, amber for kernel objects, indigo otherwise)
              h('p', { class: 'small muted m0' }, t.where));  // a grey line saying which step explores this tool
            detail.classList.remove('fade-in'); void detail.offsetWidth; detail.classList.add('fade-in');  // restarts the fade-in: removes the class, reads offsetWidth to force the browser to notice, then adds it back
          }  // ends show
          show(4);  // starts with the dispatcher-objects tool chosen, since steps 2 to 5 cover it first
        },  // ends render for step 1
      },  // closes step 1

      /* ---------------- 2. Wait functions ---------------- */
      {  // opens step 2, wait functions
        title: 'Wait functions: sleep until an object is signaled',  // step 2 title: wait functions put a thread to sleep until an object is signaled
        kind: 'learn',  // kind learn: the guide labels it Learn
        render(el, ctx) {  // render(el, ctx): runs when step 2 opens and builds the timeline animation
          const { h, s } = ctx;  // takes the HTML builder h and the SVG builder s out of ctx
          const SET_AT = 700, LIMIT = 2000;  // SET_AT: when the producer sets the event (700 ms); LIMIT: the wait's time limit (2000 ms); captions and drawing both use them
          const src = `${/* src: the C-style listing shown in this step; it starts here */''}
// thread T needs the data that thread P is still producing${/* shown code, line 1: a comment explaining that T needs data P is still making */''}
r = WaitForSingleObject(hReady, 2000); // sleep until signaled, ≤ 2000 ms${/* shown code, line 2: T waits on the event hReady for at most 2000 ms */''}
if (r == WAIT_OBJECT_0)        // hReady was signaled in time${/* shown code, line 3: check whether the wait ended because hReady was signaled */''}
    useData();                 // safe: P has finished the data${/* shown code, line 4: only then is it safe to use the data */''}
else if (r == WAIT_TIMEOUT)    // 2000 ms went by with no signal${/* shown code, line 5: check whether the wait ended because the time limit ran out */''}
    reportSlowProducer();      // give up waiting, handle the delay${/* shown code, line 6: in that case give up and report the slow producer */''}
// meanwhile thread P, when the data is complete:${/* shown code, line 7: a comment introducing the producer's side */''}
SetEvent(hReady);              // hReady becomes signaled: T is released`;  // shown code, line 8: the producer signals the event, which releases T; the backtick ends the listing
          const code = ctx.ui.code(src, { lang: 'c', fontSize: 13 });  // builds the numbered, coloured listing from src
          /* Frames are built from SET_AT and LIMIT, so every number in the captions comes from the same constants as the drawing. */
          const W = ctx.narrow ? 360 : 470;  // W: the drawing's width in SVG units, 360 in the phone-width layout and 470 otherwise
          function framesFor(sc) {  // framesFor(sc): builds the animation frames for scenario sc ('later', 'ready' or 'timeout')
            const F = [];  // F collects the frames; each frame records the time, both threads' states, the event, listing lines, timeline pieces and caption
            const wait0 = { t: 0, T: 'Running', sig: false, P: 'Running', lines: [], segs: [], cap: `Thread T needs data that thread P is still producing. The event <code>hReady</code> is <b>nonsignaled</b>, which means “not ready yet”.` };  // wait0: the opening frame shared by two scenarios: T needs data and hReady is still nonsignaled
            if (sc === 'ready') {  // the "already signaled" scenario has its own three frames
              F.push({ t: 0, T: 'Running', sig: true, P: 'Done', lines: [8], segs: [], cap: `This time P finished before T asked: P already called <code>SetEvent</code>, so <code>hReady</code> is <b>signaled</b>.` });  // frame 1: P has already set the event before T asks (listing line 8)
              F.push({ t: 0, T: 'Running', sig: true, P: 'Done', lines: [2, 3], arrow: 'T', segs: [[0, 60, 'run']], cap: `T calls <code>WaitForSingleObject</code>. The kernel checks the object: it is already signaled, so the function <b>returns WAIT_OBJECT_0 at once</b>. T never stops running.` });  // frame 2: T calls the wait, finds hReady signaled and returns at once without stopping (lines 2-3)
              F.push({ t: 120, T: 'Running', sig: true, P: 'Done', lines: [4], segs: [[0, 120, 'run']], cap: `T uses the data. A wait on a signaled object costs only the system call itself: T waited <b>0 ms</b>.` });  // frame 3: T uses the data; it waited 0 ms (line 4)
              return F;  // this scenario ends here
            }  // ends the "already signaled" case
            F.push(wait0);  // the other two scenarios start with the shared opening frame
            F.push({ t: 0, T: 'Running', sig: false, P: 'Running', lines: [2], arrow: 'T', segs: [], cap: `T calls <code>WaitForSingleObject(hReady, ${LIMIT})</code>. The kernel checks the condition: is <code>hReady</code> signaled? <b>No.</b>` });  // frame 2: T calls WaitForSingleObject and the kernel finds hReady nonsignaled (line 2)
            F.push({ t: 0, T: 'Waiting', sig: false, P: 'Running', lines: [2], arrow: 'T', segs: [[0, 0, 'wait']], cap: `So T enters the <b>Waiting</b> state and the dispatcher gives the processor to another thread, here P. T is not looping or checking: it uses <b>no processor time</b> until the kernel releases it.` });  // frame 3: T enters the Waiting state and the processor goes to another thread; T uses no processor time
            if (sc === 'later') {  // the "signaled later" scenario
              F.push({ t: SET_AT, T: 'Waiting', sig: true, P: 'Running', lines: [8], arrow: 'P', segs: [[0, SET_AT, 'wait']], cap: `At ${SET_AT} ms P finishes the data and calls <code>SetEvent(hReady)</code>. The object becomes <b>signaled</b>.` });  // frame 4: at 700 ms P sets the event, so it becomes signaled; an arrow goes from P to the event
              F.push({ t: SET_AT, T: 'Ready', sig: true, P: 'Running', lines: [8], segs: [[0, SET_AT, 'wait']], cap: `The kernel notices that T’s wait is now satisfied. T moves from Waiting to <b>Ready</b> and its ${LIMIT} ms time limit is cancelled.` });  // frame 5: the kernel sees T's wait is satisfied, moves T to Ready and cancels its time limit
              F.push({ t: SET_AT + 200, T: 'Running', sig: true, P: 'Done', lines: [3, 4], segs: [[0, SET_AT, 'wait'], [SET_AT, SET_AT + 200, 'run']], cap: `T runs again. <code>WaitForSingleObject</code> returns <b>WAIT_OBJECT_0</b> after ${SET_AT} ms of waiting, and T uses the data. Processor time T spent waiting: <b>0 ms</b>.` });  // frame 6: T runs again 200 ms later; the call returned WAIT_OBJECT_0 and T uses the data (lines 3-4)
            } else {  // the "times out" scenario
              F.push({ t: LIMIT / 2, T: 'Waiting', sig: false, P: 'Stuck', lines: [2], arrow: 'T', segs: [[0, LIMIT / 2, 'wait']], cap: `${LIMIT / 2} ms later P is stuck (perhaps waiting on a slow network) and has not signaled. T keeps sleeping at no cost.` });  // frame 4: halfway to the limit, P is stuck and has not signaled; T keeps sleeping
              F.push({ t: LIMIT, T: 'Ready', sig: false, P: 'Stuck', lines: [5], segs: [[0, LIMIT, 'wait']], cap: `At ${LIMIT} ms the time limit runs out. The object is <b>still nonsignaled</b>, but the kernel releases T anyway, because the timeout is part of the wait condition.` });  // frame 5: at 2000 ms the limit runs out and the kernel releases T although the event is still nonsignaled (line 5)
              F.push({ t: LIMIT, T: 'Running', sig: false, P: 'Stuck', lines: [5, 6], segs: [[0, LIMIT, 'wait']], cap: `The function returns <b>WAIT_TIMEOUT</b>, so T must <b>not</b> touch the data. It reports the slow producer instead. A timeout of <code>INFINITE</code> would have kept T asleep for good.` });  // frame 6: the call returns WAIT_TIMEOUT, so T must not touch the data and reports the problem (lines 5-6)
            }  // ends the scenario choice
            return F;  // hands back the list of frames
          }  // ends framesFor
          let sc = 'later', frames = framesFor(sc);  // starts with the "signaled later" scenario
          const svg = s('svg', { viewBox: `0 0 ${W} 270`, width: '100%' });  // the drawing, 270 units tall, scaled to the width of its card
          const X = (t) => 24 + (t / LIMIT) * (W - 48);  // X(t): turns a time in milliseconds into a horizontal position on the timeline, 24 units in from each edge
          const stCol = { Running: '--ok', Waiting: '--warn', Ready: '--cpu', Done: '--muted', Stuck: '--bad' };  // stCol: the colour used for each thread state's label, e.g. green for Running and amber for Waiting
          function draw(f) {  // draw(f): redraws the picture and the listing highlights for frame f
            const xt = W * 0.14, xo = W / 2, xp = W * 0.86, ow = ctx.narrow ? 118 : 140, k = [];  // positions: T at 14 percent of the width, the event in the middle, P at 86 percent; ow is the event box's width; k collects shapes
            k.push(token(s, xt, 50, 'T', 's-thread', 64, 44, 20), token(s, xp, 50, 'P', 's-thread', 64, 44, 20));  // the two thread tokens, T on the left and P on the right
            [[xt, f.T], [xp, f.P]].forEach(([x, st], j) => {  // for each thread, two labels under its token
              k.push(s('text', { x, y: 92, 'text-anchor': 'middle', 'font-size': 14, class: 's-sub' }, j ? 'producer' : 'waiter'));  // its role in grey: waiter for T, producer for P
              k.push(s('text', { x, y: 111, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800, style: `fill:var(${stCol[st]})` }, st));  // its current state in bold, coloured from stCol
            });  // ends the label loop
            k.push(s('rect', { x: xo - ow / 2, y: 18, width: ow, height: 74, rx: 12, class: 's-os', 'stroke-width': 2 }));  // the purple box for the event object hReady
            k.push(s('text', { x: xo, y: 40, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800 }, 'hReady'));  // the event's name at the top of the box
            k.push(s('circle', { cx: xo - ow / 2 + 20, cy: 66, r: 9, class: f.sig ? 's-ok' : 's-panel', 'stroke-width': 2 }));  // a lamp circle: green when the event is signaled, grey when it is not
            k.push(s('text', { x: xo - ow / 2 + 34, y: 71, 'font-size': 14, 'font-weight': 700, style: `fill:var(${f.sig ? '--ok' : '--muted'})` }, f.sig ? 'signaled' : 'nonsignaled'));  // the word signaled or nonsignaled beside the lamp, in green or grey
            if (f.arrow === 'T') k.push(s('line', { x1: xt + 34, y1: 50, x2: xo - ow / 2 - 4, y2: 50, class: 's-line', 'stroke-dasharray': f.T === 'Waiting' ? '5 4' : null, 'marker-end': 'url(#arr)' }));  // when T calls the wait, an arrow from T to the event; it is dashed while T waits
            if (f.arrow === 'P') k.push(s('line', { x1: xp - 34, y1: 50, x2: xo + ow / 2 + 4, y2: 50, class: 's-line', 'marker-end': 'url(#arr-ok)', style: 'stroke:var(--ok)' }));  // when P signals, a green arrow from P to the event
            k.push(s('text', { x: 24, y: 134, 'font-size': 14, 'font-weight': 700 }, 'Thread T over time (ms)'));  // the timeline's title
            k.push(s('rect', { x: 24, y: 160, width: W - 48, height: 26, rx: 6, class: 's-panel', 'stroke-width': 1 }));  // the empty timeline track across the drawing
            f.segs.forEach(([a, b, kind]) => k.push(s('rect', { x: X(a), y: 160, width: Math.max(4, X(b) - X(a)), height: 26, rx: 6, class: kind === 'run' ? 's-ok' : 's-warn', 'stroke-width': 1.5, 'stroke-dasharray': kind === 'wait' ? '5 3' : null })));  // the timeline pieces: green for running, dashed amber for waiting; each at least 4 units wide so a zero-length wait still shows
            for (let t = 0; t <= LIMIT; t += 500) k.push(s('text', { x: X(t), y: 205, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, String(t)));  // tick labels under the timeline every 500 ms, from 0 to 2000
            k.push(s('path', { d: `M${X(f.t)} 158 l-7 -11 h14 z`, class: 's-accent', 'stroke-width': 1.5 }));  // an indigo pointer above the timeline that marks this frame's time
            const waited = f.segs.filter((g) => g[2] === 'wait').reduce((a, g) => a + g[1] - g[0], 0);  // waited: adds up the lengths of all waiting pieces
            k.push(s('text', { x: 24, y: 236, 'font-size': 14.5 }, `Time spent waiting: ${waited} ms`));  // writes the total time spent waiting
            k.push(s('text', { x: 24, y: 258, 'font-size': 14.5, 'font-weight': 700, style: 'fill:var(--ok)' }, 'Processor time used while waiting: 0 ms'));  // writes, in green, that the processor time used while waiting is 0 ms, the point of the step
            if (!ctx.narrow) k.push(s('rect', { x: W - 150, y: 222, width: 14, height: 12, class: 's-warn', 'stroke-dasharray': '3 2' }), s('text', { x: W - 130, y: 233, 'font-size': 13, class: 's-sub' }, 'waiting'), s('rect', { x: W - 70, y: 222, width: 14, height: 12, class: 's-ok' }), s('text', { x: W - 50, y: 233, 'font-size': 13, class: 's-sub' }, 'running'));  // a small colour key for waiting and running, drawn only when there is room (not in the phone-width layout)
            svg.replaceChildren(...k);  // replaces the old picture with the new shapes in one go
            code.clear(); if (f.lines.length) code.mark(f.lines);  // clears the listing's highlights and lights this frame's lines
          }  // ends draw
          const player = ctx.ui.player({ count: frames.length, interval: 2400, render: (i) => { draw(frames[i]); return frames[i].cap; } });  // the animation player: 2.4 seconds per frame when playing; render draws frame i and returns its caption
          const seg = ctx.ui.seg([{ value: 'later', label: 'Signaled later' }, { value: 'ready', label: 'Already signaled' }, { value: 'timeout', label: 'Times out' }], sc, (v) => { sc = v; frames = framesFor(v); player.stop(); player.setCount(frames.length); });  // the scenario switch: signaled later, already signaled or times out; a change rebuilds the frames and restarts the player
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: 'minmax(0, 13fr) minmax(0, 10fr)', gap: '22px' } },  // builds the step's layout: explanation and listing on the left, picture and player on the right
            h('div', { class: 'stack', style: { gap: '10px' } },  // left column: a stack with 10-pixel gaps
              h('p', { class: 'm0', html: 'A <span class="t">wait function</span> lets a thread block itself until a condition is met. <code>WaitForSingleObject(h, ms)</code> names one <span class="t">dispatcher object</span> and a time limit. If the object is already in the <span class="t" data-t="signaled state">signaled state</span>, the call returns at once; if not, the thread sleeps until it is signaled or the time runs out.' }),  // intro paragraph: what a wait function is and what WaitForSingleObject does with a signaled or nonsignaled object
              code,  // the code listing
              h('div', { class: 'facts', style: ctx.narrow ? { gridTemplateColumns: '1fr' } : null },  // the two fact boxes, side by side normally and stacked in the phone-width layout
                h('div', { html: '<b>Time limit.</b> <code>INFINITE</code> waits forever; <code>0</code> only tests the object and returns at once; any other number is milliseconds.' }),  // fact box: what the time limit values INFINITE, 0 and a number of milliseconds mean
                h('div', { html: '<b>Return value.</b> <code>WAIT_OBJECT_0</code> signaled; <code>WAIT_TIMEOUT</code> time ran out; <code>WAIT_ABANDONED</code> a mutex owner died (step 4); <code>WAIT_FAILED</code> an error.' })),  // fact box: the four return values and what each one means
              h('div', { class: 'callout why small m0', 'data-label': 'Why it matters' }, 'A waiting thread is not polling in a loop (busy waiting). It sits in the Waiting state, off the processor, and the kernel alone decides when to release it.')),  // "Why it matters" callout: a waiting thread is not polling but sleeps off the processor; closes the left column
            h('div', { class: 'stack', style: { gap: '8px' } },  // right column: a stack with 8-pixel gaps
              h('div', { class: 'row gap-s' }, h('span', { class: 'small b' }, 'Scenario'), seg),  // a row with the word Scenario and the scenario switch
              h('div', { class: 'card white tight' }, svg),  // the drawing on a white card
              player.el)));  // the player's controls and caption; the brackets close the layout and the append call
        },  // ends render for step 2
      },  // closes step 2

      /* ---------------- 3. The eight dispatcher objects ---------------- */
      {  // opens step 3, the eight dispatcher objects
        title: 'Eight kinds of dispatcher object',  // step 3 title: eight kinds of dispatcher object
        kind: 'learn',  // kind learn: the guide labels it Learn
        render(el, ctx) {  // render(el, ctx): runs when step 3 opens and builds the object table and detail card
          const { h } = ctx;  // takes the HTML builder h out of ctx
          const OBJ = [  // OBJ: the eight objects; each has a name, glossary term, what it is, when it is signaled, how many it releases and more details
            { n: 'Notification event', t: 'notification event', what: 'An announcement that some event has happened', when: 'A thread sets the event', rel: 'all', sync: true,  // row 1: the notification event, signaled when set, releases all waiters, made for synchronization
              make: '<code>CreateEvent(NULL, TRUE, FALSE, name)</code> (TRUE = manual reset). Signal it with <code>SetEvent</code>; make it nonsignaled again with <code>ResetEvent</code>.',  // how a notification event is created, set and reset in code
              ex: 'Tell every worker thread at once that start-up has finished.', note: 'It stays signaled until some thread resets it, so a thread that waits later passes straight through.' },  // typical use (telling every worker at once) and the fact that it stays signaled until reset
            { n: 'Synchronization event', t: 'synchronization event', what: 'The same kind of announcement', when: 'A thread sets the event', rel: 'one', sync: true,  // row 2: the synchronization event, which releases one waiter
              make: '<code>CreateEvent(NULL, FALSE, FALSE, name)</code> (FALSE = automatic reset). Signal it with <code>SetEvent</code>.',  // how a synchronization event is created and set in code
              ex: 'Hand one “a job is waiting” notice to exactly one of several idle workers.', note: 'Releasing one waiter resets it automatically. If nobody is waiting, it stays signaled until the next thread waits.' },  // typical use (one notice for exactly one worker) and how it resets itself
            { n: 'Mutex', t: 'mutex', what: 'Mutual exclusion, like a binary semaphore, but owned by one thread', when: 'The owning thread releases it', rel: 'one', sync: true,  // row 3: the mutex, owned by one thread and released by its owner to one waiter
              make: '<code>CreateMutex(NULL, FALSE, name)</code>. A successful wait makes the caller the owner; <code>ReleaseMutex</code> gives it up (owner only).',  // how a mutex is created, acquired and released in code
              ex: 'Two separate programs append to one log file: both open the mutex by the same name.', note: 'The owner may acquire it again (Windows keeps a count). If the owner ends without releasing it, it is <span class="t" data-t="abandoned mutex">abandoned</span> and the next waiter is told so.' },  // typical use (two programs sharing a log file) and the recursion and abandonment rules
            { n: 'Semaphore', t: 'semaphore', what: 'A counter that limits how many threads use a resource', when: 'Its count is above zero', rel: 'unit', sync: true,  // row 4: the semaphore, signaled while its count is above zero, releasing one waiter per unit
              make: '<code>CreateSemaphore(NULL, 3, 3, name)</code> starts at 3 (all free) with a maximum of 3. Each successful wait takes one unit; <code>ReleaseSemaphore(h, n, NULL)</code> adds n.',  // how a semaphore is created with a starting and maximum count, and how waits and releases change the count
              ex: 'At most 3 threads at a time may use a pool of 3 database connections.', note: 'It has no owner: any thread may release it. A release that would push the count above the maximum fails.' },  // typical use (a pool of 3 connections) and the facts that it has no owner and cannot exceed its maximum
            { n: 'Waitable timer', t: 'waitable timer', what: 'A counter for the passage of time', when: 'The set time arrives or the interval expires', rel: 'all', sync: true,  // row 5: the waitable timer, signaled when its time arrives, releasing all waiters
              make: '<code>CreateWaitableTimer(NULL, TRUE, name)</code>, then <code>SetWaitableTimer</code> with a due time and an optional repeat period.',  // how a waitable timer is created and given a due time and repeat period
              ex: 'A thread sleeps until 02:00, or wakes every 10 minutes to save a backup.', note: 'This row describes the notification (manual-reset) kind. Windows also offers a synchronization timer, which releases only one waiter.' },  // typical use (wake at a set time or every 10 minutes) and a note on the timer kind shown
            { n: 'File', t: null, what: 'An open file or I/O device', when: 'An I/O operation completes', rel: 'all', sync: false,  // row 6: the file, signaled when an I/O operation completes; no glossary term, so its name is not dotted
              make: 'The handle returned by <code>CreateFile</code>. Starting an operation makes it nonsignaled; finishing makes it signaled.',  // how a file handle becomes nonsignaled and signaled as I/O starts and finishes
              ex: 'Start a large read, keep working, then wait on the file handle until the read is done.', note: 'Real programs usually give each asynchronous operation its own event, but the file itself can be waited on.' },  // typical use (start a big read and wait for it later) and a note on per-operation events
            { n: 'Process', t: 'process', what: 'A running program, with its address space and resources', when: 'Its last thread terminates', rel: 'all', sync: false,  // row 7: the process, signaled when its last thread ends, releasing all waiters
              make: 'The handle returned by <code>CreateProcess</code> (or <code>OpenProcess</code>).',  // where the process handle comes from
              ex: 'A setup program launches an installer and waits until that process has exited.', note: 'Once signaled it stays signaled for good: a process cannot come back to life.' },  // typical use (wait for an installer to exit) and the fact that it stays signaled for good
            { n: 'Thread', t: 'thread', what: 'An executable entity inside a process', when: 'The thread terminates', rel: 'all', sync: false,  // row 8: the thread, signaled when it terminates, releasing all waiters
              make: 'The handle returned by <code>CreateThread</code>.',  // where the thread handle comes from
              ex: 'The main thread waits for all its worker threads to finish before it exits.', note: 'Waiting on several thread handles at once, with wait-all, is the usual “join” in Windows (step 5).' },  // typical use (the main thread waits for its workers) and the link to wait-all in step 5
          ];  // closes the OBJ list
          const REL = { all: ['ok', 'all waiters'], one: ['thread', 'one waiter'], unit: ['accent', 'one per unit of count'] };  // REL: for each release rule, the chip colour and the words shown in the table's last column
          let cur = 0, filt = 'all';  // cur: the object whose details are shown; filt: which group of rows the filter shows (all, sync or other)
          /* On a small screen the "what it is" text moves under the object's name, so three columns fit. */
          const slim = ctx.narrow;  // slim is true in the phone-width layout, where the table drops its "what it is" column
          const rows = OBJ.map((o, i) => h('tr', {},  // rows: one table row per object
            h('td', {}, h('button', { class: 'btn sm rowbtn', type: 'button', onclick: () => pick(i) }, o.n), slim ? h('div', { class: 'xs muted', style: { marginTop: '3px' } }, o.what) : null),  // first cell: a button with the object's name that shows its details; on a small screen the "what it is" text sits under it
            slim ? null : h('td', {}, o.what), h('td', {}, o.when),  // second cell: what the object is (left out on a small screen); third cell: when it becomes signaled
            h('td', {}, h('span', { class: 'chip ' + REL[o.rel][0], style: slim ? { whiteSpace: 'normal' } : null }, REL[o.rel][1]))));  // last cell: a coloured chip saying how many waiters it releases, allowed to wrap on a small screen; closes the row
          const table = h('table', { class: 'tbl compact otbl' },  // table: the object table, compact and with this section's own otbl styling
            h('thead', {}, h('tr', {}, h('th', {}, 'Object'), slim ? null : h('th', {}, 'What it is'), h('th', {}, 'Becomes signaled when'), h('th', {}, 'Effect on waiters'))),  // header row: Object, What it is (wide screens only), Becomes signaled when, Effect on waiters
            h('tbody', {}, ...rows));  // the body with the eight rows; closes the table
          const detail = h('div', { class: 'card white stack', style: { gap: '7px' } });  // detail: the white card on the right that shows the chosen object's details
          function paint() {  // paint(): updates the row highlights and refills the detail card
            rows.forEach((r, i) => {  // goes through every row
              const inF = filt === 'all' || (filt === 'sync') === OBJ[i].sync;  // inF: whether this row belongs to the group the filter shows
              r.classList.toggle('on', i === cur); r.classList.toggle('dim', !inF);  // highlights the chosen row and fades the rows the filter hides
              r.querySelector('button').setAttribute('aria-pressed', String(i === cur));  // marks the chosen row's button as pressed, for screen readers and styling
            });  // ends the row loop
            const o = OBJ[cur];  // o: the chosen object
            detail.replaceChildren(  // refills the detail card
              h('div', { class: 'row', style: { justifyContent: 'space-between' } },  // top row of the card
                h('b', { style: { fontSize: '18px' }, html: o.t ? `<span class="t" data-t="${o.t}">${o.n}</span>` : o.n }),  // the object's name in large bold, as a dotted glossary term when it has one
                h('span', { class: 'chip ' + (o.sync ? 'os' : 'io') }, o.sync ? 'made for synchronization' : 'another job, also waitable')),  // a chip: purple "made for synchronization" for the first five, orange "another job, also waitable" for the last three
              h('p', { class: 'm0 small', html: '<b>In code.</b> ' + o.make }),  // paragraph: how the object is created and used in code
              h('p', { class: 'm0 small', html: '<b>Typical use.</b> ' + o.ex }),  // paragraph: a typical use
              h('p', { class: 'm0 small', html: '<b>Worth knowing.</b> ' + o.note }));  // paragraph: a detail worth knowing
            detail.classList.remove('fade-in'); void detail.offsetWidth; detail.classList.add('fade-in');  // restarts the fade-in so the new details slide in: removes the class, forces a layout read, adds it back
          }  // ends paint
          function pick(i) { cur = i; paint(); }  // pick(i): chooses object i when its button is clicked and redraws
          const seg = ctx.ui.seg([{ value: 'all', label: 'All 8' }, { value: 'sync', label: 'Made for sync (5)' }, { value: 'other', label: 'Other jobs (3)' }], filt, (v) => {  // the filter switch: all 8, the 5 made for synchronization, or the 3 with other jobs
            filt = v;  // records the new filter
            if (v !== 'all' && OBJ[cur].sync !== (v === 'sync')) cur = OBJ.findIndex((o) => o.sync === (v === 'sync'));  // if the chosen object is now hidden by the filter, chooses the first object of the shown group instead
            paint();  // redraws the table and the card
          });  // ends the filter handler
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: 'minmax(0, 7fr) minmax(0, 4fr)', gap: '20px' } },  // builds the step's layout: the table on the wider left, the details on the right
            h('div', { class: 'stack', style: { gap: '8px' } },  // left column: a stack with 8-pixel gaps
              h('p', { class: 'm0', html: 'Every <span class="t">dispatcher object</span> is always either <b>signaled</b> or <b>nonsignaled</b>, and a waiting thread is released when the object becomes signaled. What differs is <b>what makes it signaled</b> and <b>how many waiters</b> it lets go. Click an object for details.' }),  // intro paragraph: every dispatcher object is signaled or nonsignaled; the types differ in what signals them and how many they release
              table),  // the object table; closes the left column
            h('div', { class: 'stack', style: { gap: '10px' } },  // right column: a stack with 10-pixel gaps
              h('div', { class: 'row gap-s' }, h('span', { class: 'small b' }, 'Show'), seg),  // a row with the word Show and the filter switch
              detail,  // the detail card
              h('div', { class: 'callout why small m0', 'data-label': 'Five plus three' }, 'The first five exist only to synchronize. Files, processes and threads have other jobs, but because they are dispatcher objects too, a thread can wait for an I/O to finish, a program to exit or a thread to end with the very same wait functions.'))));  // "Five plus three" callout: five objects exist only to synchronize, three have other jobs but can be waited on too; closes the layout
          paint();  // fills the table highlights and the detail card for the first time
        },  // ends render for step 3
      },  // closes step 3

      /* ---------------- 4. Dispatcher-object playground ---------------- */
      {  // opens step 4, the dispatcher-object playground
        title: 'Dispatcher object playground: who wakes up?',  // step 4 title: who wakes up when an object is signaled
        kind: 'explore',  // kind explore: the guide labels it Explore
        core: true,  // core: true keeps this step on the shorter core path
        render(el, ctx) {  // render(el, ctx): runs when step 4 opens and builds the playground
          const { h, s } = ctx;  // takes the HTML builder h and the SVG builder s out of ctx
          const TYPES = [  // TYPES: the eight object types the student can pick; each has a key, a name, a rule in words and its trigger buttons
            { k: 'nev', name: 'Notification event', rule: '<code>SetEvent</code> makes it signaled and releases <b>every</b> waiter. It stays signaled until <code>ResetEvent</code>.',  // notification event: its rule (SetEvent releases every waiter and it stays signaled)
              acts: [['SetEvent', 'set', 'os'], ['ResetEvent', 'reset', '']] },  // its buttons: SetEvent and ResetEvent, each given as [label, action, colour]
            { k: 'sev', name: 'Synchronization event', rule: '<code>SetEvent</code> releases <b>one</b> waiter and the event resets itself. With nobody waiting, it stays signaled for the next thread that waits.',  // synchronization event: its rule (one waiter, then it resets itself)
              acts: [['SetEvent', 'set', 'os']] },  // its only button: SetEvent
            { k: 'mutex', name: 'Mutex', rule: 'Signaled only while nobody owns it. A release hands ownership to <b>one</b> waiter. Only the owner may release it.',  // mutex: its rule (signaled only while unowned, a release passes it to one waiter)
              acts: [['Owner calls ReleaseMutex', 'release', 'os'], ['Owner thread ends without releasing', 'die', 'intr']] },  // its buttons: the owner releases it, or the owner ends while holding it (in interrupt red)
            { k: 'sem', name: 'Semaphore', rule: 'Signaled while its count is above zero. Each released waiter takes <b>one unit</b> of the count. Here the maximum count is 3.',  // semaphore: its rule (one waiter released per unit of count, maximum 3)
              acts: [] },  // no fixed buttons: the semaphore gets its own n chooser and release button in paint()
            { k: 'timer', name: 'Waitable timer', rule: 'A notification timer becomes signaled when its due time arrives and releases <b>every</b> waiter.',  // waitable timer: its rule (signaled at its due time, releases every waiter)
              acts: [['Due time arrives', 'fire', 'os'], ['Re-arm with SetWaitableTimer', 'rearm', '']] },  // its buttons: the due time arrives, or re-arm the timer
            { k: 'file', name: 'File', rule: 'Signaled when the I/O operation on it completes; releases <b>every</b> waiter.',  // file: its rule (signaled when the I/O completes, releases every waiter)
              acts: [['I/O operation completes', 'done', 'os'], ['Start another I/O operation', 'start', '']] },  // its buttons: the I/O completes, or a new I/O operation starts
            { k: 'proc', name: 'Process', rule: 'Signaled when its last thread terminates. Releases <b>every</b> waiter and stays signaled for good.',  // process: its rule (signaled when its last thread ends, and stays signaled)
              acts: [['Last thread of the process ends', 'end', 'os']] },  // its only button: the last thread of the process ends
            { k: 'thread', name: 'Thread', rule: 'Signaled when the thread terminates; releases <b>every</b> waiter.',  // thread: its rule (signaled when it terminates)
              acts: [['The thread terminates', 'end', 'os']] },  // its only button: the thread terminates
          ];  // closes the TYPES list
          const MAXT = 5, SEMMAX = 3;  // MAXT: thread names go up to T5; SEMMAX: the semaphore's maximum count
          let type = 'nev', o, waiting, released, next, relN = 1;  // state: the chosen type, the object, the waiting and released threads, the next thread number, and how many units to release
          const TT = () => TYPES.find((t) => t.k === type);  // TT(): the TYPES entry for the chosen type
          const W = ctx.narrow ? 360 : 740, H = ctx.narrow ? 426 : 252;  // drawing size: 740 by 252 normally, or 360 by 426 (taller, stacked) in the phone-width layout
          const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%' });  // the drawing, scaled to the width of its card
          const narr = narrBox(ctx, 96);  // narr: the narration box under the drawing, at least 96 pixels tall
          const trig = h('div', { class: 'row gap-s' });  // trig: the row of trigger buttons for the chosen type
          const ruleEl = h('div', { class: 'card tight small', style: { lineHeight: 1.4 } });  // ruleEl: the small card that states the chosen type's rule
          const typeBtns = TYPES.map((t) => h('button', { class: 'btn sm objbtn', type: 'button', onclick: () => choose(t.k) }, t.name));  // typeBtns: one button per object type; a click chooses that type
          const waitBtn = btn(ctx, '+ Another thread waits', () => addWaiter(), 'sm thread');  // waitBtn: adds one more thread that calls the wait function
          const list = (a) => a.length === 1 ? a[0] : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];  // list(a): joins names in plain English, e.g. "T1, T2 and T3"
          const lower = () => TT().name.toLowerCase();  // lower(): the chosen type's name in lower case, for use inside sentences
          function signaled() { return type === 'mutex' ? o.owner == null : type === 'sem' ? o.count > 0 : o.sig; }  // signaled(): whether the object is signaled now: a mutex when nobody owns it, a semaphore when its count is above 0, others by their flag
          function hint() {  // hint(): a short suggestion of what to try first, one per type
            return { nev: 'Click <b>SetEvent</b> and count how many wake.', sev: 'Click <b>SetEvent</b> and count how many wake.', mutex: 'T0 owns the mutex. Make T0 release it, or let T0 die holding it.',  // hints for the two events and the mutex
              sem: 'Pick how many units to release, then release them.', timer: 'Let the due time arrive.', file: 'Let the I/O operation complete.', proc: 'End the process.', thread: 'End the thread.' }[type];  // hints for the semaphore, timer, file, process and thread; [type] picks the one for the chosen type
          }  // ends hint
          function reset(msg) {  // reset(msg): starts the chosen type over with three sleeping waiters; runs when a type is chosen and when Reset is clicked
            o = { sig: false, count: 0, owner: type === 'mutex' ? 'T0' : null, aband: false };  // a fresh object: not signaled, count 0, owned by T0 if it is a mutex, not abandoned
            waiting = ['T1', 'T2', 'T3']; released = []; next = 4;  // T1, T2 and T3 start out asleep in the wait; nobody is released yet and the next new thread will be T4
            narr.say(msg || `Threads T1, T2 and T3 have each called <code>WaitForSingleObject</code> on a nonsignaled ${lower()}, so all three are asleep. ${hint()}`);  // explains that three threads are waiting on the nonsignaled object and adds the type's hint, or shows msg if one was passed
            paint();  // draws the buttons, the rule card and the picture
          }  // ends reset
          function choose(k) { type = k; relN = 1; reset(); }  // choose(k): switches to object type k, sets the semaphore release back to 1, and starts over
          function wake(code) { const n = waiting.shift(); released.push({ n, code }); return n; }  // wake(code): releases the first waiting thread with the given return code and hands back its name
          function wakeAll() { const a = waiting.splice(0); a.forEach((n) => released.push({ n, code: 'WAIT_OBJECT_0' })); return a; }  // wakeAll(): releases every waiting thread at once, each with WAIT_OBJECT_0, and hands back their names
          function allMsg(cause, a, tail) {  // allMsg(cause, a, tail): builds the message for an object that releases every waiter: what happened, who woke, and a closing remark
            return a.length ? [`${cause} The ${lower()} is now <b>signaled</b>, and it releases <b>every</b> waiter: ${list(a)} ${a.length === 1 ? 'wakes' : `all wake (${a.length} threads)`}. ${tail}`, 'ok']  // if anyone woke, a green message naming them all and how many there were
              : [`${cause} The ${lower()} is now signaled, but nobody was waiting. ${tail}`, ''];  // if nobody was waiting, a plain message saying the object is signaled with nobody to release
          }  // ends allMsg
          function act(a) {  // act(a): runs when a trigger button is clicked; a names the action (set, reset, release, die, rel, fire, done, end...)
            let m = ['', ''];  // m holds the message text and its tone
            if (type === 'nev' && a === 'set') m = o.sig ? ['The event is already signaled, so SetEvent changes nothing.', ''] : (o.sig = true, allMsg('SetEvent.', wakeAll(), 'It <b>stays</b> signaled, so a thread that waits now passes straight through, until someone calls ResetEvent.'));  // notification event, SetEvent: nothing changes if it is already signaled; otherwise it becomes signaled and releases every waiter
            else if (type === 'nev') { o.sig = false; m = ['ResetEvent: the event is <b>nonsignaled</b> again. New waiters will sleep until the next SetEvent.', '']; }  // notification event, ResetEvent: it goes back to nonsignaled, so new waiters will sleep again
            else if (type === 'sev') {  // synchronization event
              if (waiting.length) { const n = wake('WAIT_OBJECT_0'); o.sig = false; m = [`SetEvent releases exactly <b>one</b> waiter, ${n}, and the event resets itself in the same instant, so it is still nonsignaled. ${waiting.length ? `${list(waiting)} ${waiting.length === 1 ? 'is' : 'are'} still asleep: each one needs its own SetEvent.` : 'Nobody else is waiting.'}`, 'ok']; }  // with waiters: exactly one is released and the event resets itself at once; the rest still sleep
              else if (o.sig) m = ['The event is already signaled and nobody has used that signal yet, so this second SetEvent is simply lost: an event does not count.', 'warn'];  // already signaled with nobody waiting: the second SetEvent is lost, because an event does not count
              else { o.sig = true; m = ['Nobody is waiting, so the event stays <b>signaled</b> until the next thread waits. That thread will pass and reset it.', '']; }  // nobody waiting: the event stays signaled until the next thread waits
            } else if (type === 'mutex') {  // mutex
              if (!o.owner) m = ['Nobody owns the mutex, so there is nothing to release: ReleaseMutex fails unless the caller is the owner.', 'bad'];  // with no owner there is nothing to release, so the call fails (red message)
              else if (a === 'release') {  // the owner releases the mutex
                const old = o.owner;  // old: the thread giving it up
                if (waiting.length) { const n = wake('WAIT_OBJECT_0'); o.owner = n; m = [`${old} calls ReleaseMutex. Exactly <b>one</b> waiter, ${n}, is released and becomes the new <b>owner</b>, so the mutex is nonsignaled again. Release it again to pass it on.`, 'ok']; }  // with waiters: one is released and becomes the new owner, so the mutex is nonsignaled again
                else { o.owner = null; m = [`${old} calls ReleaseMutex. Nobody is waiting, so the mutex is now free (signaled) until some thread waits for it.`, '']; }  // without waiters: the mutex becomes free (signaled) until some thread waits
              } else {  // the owner ends without releasing it
                const old = o.owner, r = released.find((x) => x.n === old); if (r) r.code = 'ended';  // old: the dying owner; if it was one of the released threads, its entry is marked ended so the picture shows it in red
                if (waiting.length) { const n = wake('WAIT_ABANDONED'); o.owner = n; m = [`${old} ends while still owning the mutex. Windows marks it <span class="t" data-t="abandoned mutex">abandoned</span> and gives it to ${n}, whose wait returns <b>WAIT_ABANDONED</b>: “you own it now, but the data it guards may be half-updated, so check it.”`, 'warn']; }  // with waiters: the next one gets the abandoned mutex with WAIT_ABANDONED, a warning that the data may be half-updated
                else { o.owner = null; o.aband = true; m = [`${old} ends while still owning the mutex. It is now <b>abandoned</b> and free; the next thread that waits will get it with WAIT_ABANDONED.`, 'warn']; }  // without waiters: the mutex is free but remembered as abandoned, so the next thread to wait gets the warning
              }  // ends the mutex actions
            } else if (type === 'sem') {  // semaphore
              if (o.count + relN > SEMMAX) m = [`ReleaseSemaphore(h, ${relN}) would raise the count from ${o.count} to ${o.count + relN}, above the maximum of ${SEMMAX}. The call fails and nothing changes.`, 'bad'];  // a release that would push the count above the maximum fails and changes nothing (red message)
              else {  // otherwise the release goes ahead
                const before = o.count; o.count += relN; const a2 = [];  // before remembers the old count; the count rises by n; a2 will collect the threads released
                while (o.count > 0 && waiting.length) { a2.push(wake('WAIT_OBJECT_0')); o.count--; }  // each waiter released takes one unit, until the count is 0 or nobody is left waiting
                m = [`ReleaseSemaphore(h, ${relN}): the count goes ${before} → ${before + relN}. ${a2.length ? `Each released waiter takes one unit: ${list(a2)} ${a2.length === 1 ? 'wakes' : 'wake'}` : 'Nobody is waiting'}, and the count is now <b>${o.count}</b>${o.count ? `, so the next ${o.count === 1 ? 'thread' : o.count + ' threads'} to wait will pass at once` : ''}.`, a2.length ? 'ok' : ''];  // explains the count change, who woke, and how many later waits will pass at once
              }  // ends the release case
            } else if (a === 'rearm' || a === 'start') { o.sig = false; m = [a === 'rearm' ? 'SetWaitableTimer sets a new due time: the timer is nonsignaled until then.' : 'A new I/O operation starts, so the file is nonsignaled until it completes.', '']; }  // timer re-armed or a new file I/O started: the object goes back to nonsignaled
            else if (o.sig) m = [type === 'proc' || type === 'thread' ? `The ${lower()} has already ended; it stays signaled forever.` : `The ${lower()} is already signaled.`, ''];  // the object is already signaled: a note that nothing changes, and that an ended thread or process stays signaled forever
            else {  // otherwise the object becomes signaled now
              o.sig = true;  // marks the object signaled
              const cause = { timer: 'The due time arrives.', file: 'The I/O operation completes.', proc: 'The last thread of the process terminates.', thread: 'The thread terminates.' }[type];  // cause: the sentence describing what happened, chosen by type
              m = allMsg(cause, wakeAll(), type === 'proc' || type === 'thread' ? 'A thread or process that has ended never runs again, so it stays signaled for good.' : 'Waiting on it now returns at once.');  // releases every waiter and builds the message, adding why a process or thread stays signaled for good
            }  // ends the other-types case
            narr.say(m[0], m[1]); paint();  // shows the message in its colour and redraws everything
          }  // ends act
          function addWaiter() {  // addWaiter(): runs when "+ T4 calls Wait" (or T5) is clicked: one more thread calls the wait function
            if (next > MAXT) return;  // no new threads after T5
            const n = 'T' + next++;  // n: the new thread's name; next moves on to the following number
            let pass = signaled(), code = 'WAIT_OBJECT_0', extra = '';  // pass: whether the object is signaled now, so the wait succeeds at once; code is its return value; extra adds detail to the message
            if (pass && type === 'sev') { o.sig = false; extra = ' and the event <b>resets itself</b>: the stored signal is used up'; }  // a synchronization event lets this one thread through and resets itself, using up the stored signal
            else if (pass && type === 'mutex') { o.owner = n; if (o.aband) { code = 'WAIT_ABANDONED'; o.aband = false; } extra = ` and ${n} becomes the owner${code === 'WAIT_ABANDONED' ? ', with the WAIT_ABANDONED warning' : ''}`; }  // a free mutex makes this thread its owner; if it was abandoned, the wait returns WAIT_ABANDONED and the flag is cleared
            else if (pass && type === 'sem') { o.count--; extra = `, taking one unit (count now ${o.count})`; }  // a semaphore with a unit free gives this thread one unit, lowering the count
            else if (pass && type === 'nev') extra = ', and the event stays signaled';  // a notification event stays signaled after letting this thread through
            if (pass) { released.push({ n, code }); narr.say(`${n} calls WaitForSingleObject on a <b>signaled</b> ${lower()}, so the wait is satisfied immediately${extra}.`, 'ok'); }  // if the wait succeeds, the thread joins the released list at once with a green message
            else { waiting.push(n); narr.say(`${n} calls WaitForSingleObject, but the ${lower()} is nonsignaled, so ${n} joins the waiters and sleeps.`); }  // otherwise it joins the end of the waiting queue and sleeps
            paint();  // redraws everything
          }  // ends addWaiter
          const G = ctx.narrow  // G: the positions of every part of the drawing, chosen by layout
            ? { ot: [8, 16], ob: [8, 24, 344, 100], lamp: [30, 52], st: [50, 58], info: [[24, 90], [24, 114], [196, 90]], qt: [8, 146], qb: [8, 154, 344, 82], qx: (k) => 44 + k * 68, qy: 194, rt: [8, 262], rb: [8, 270, 344, 150], rp: (k) => [34, 290 + k * 27] }  // phone-width positions: object box at the top, waiting queue in the middle, released box at the bottom
            : { ot: [8, 16], ob: [8, 26, 212, 216], lamp: [34, 60], st: [56, 66], info: [[22, 112], [22, 142], [22, 172]], qt: [236, 16], qb: [236, 26, 288, 216], qx: (k) => 268 + k * 56, qy: 122, rt: [544, 16], rb: [544, 26, 190, 216], rp: (k) => [570, 56 + k * 40] };  // wide positions: object box on the left, waiting queue in the middle, released box on the right, side by side
          function infoLines() {  // infoLines(): the short facts written inside the object box, as [text, style] pairs
            const rel = { nev: 'all waiters', sev: 'one waiter', mutex: 'one waiter', sem: 'one per unit' }[type] || 'all waiters';  // rel: how many waiters this type releases, in words
            const L = {  // L: the type's own facts
              nev: [['resets: only by ResetEvent']], sev: [['resets: by itself']],  // events: how they reset
              mutex: [['owner: ' + (o.owner || 'none'), 'b'], o.aband ? ['abandoned!', 'warn'] : null],  // mutex: who owns it, in bold, plus an amber "abandoned!" if that is the case
              sem: [[`count: ${o.count}`, 'b'], [`maximum: ${SEMMAX}`]],  // semaphore: its count in bold and its maximum
              timer: [[o.sig ? 'due time has passed' : 'counting down']], file: [[o.sig ? 'I/O complete' : 'I/O in progress']],  // timer and file: whether the due time has passed or the I/O is complete
              proc: [[o.sig ? 'process has exited' : 'process running']], thread: [[o.sig ? 'thread has ended' : 'thread running']],  // process and thread: whether it has ended yet
            }[type].filter(Boolean);  // picks the chosen type's facts and drops the empty slot left by a mutex that is not abandoned
            L.splice(1, 0, ['releases: ' + rel]);  // inserts the "releases" fact as the second line
            return L;  // hands back the list of facts
          }  // ends infoLines
          function draw() {  // draw(): redraws the whole picture from the current state
            const k = [], sig = signaled();  // k collects the shapes; sig is whether the object is signaled now
            const R = (b, cls) => s('rect', { x: b[0], y: b[1], width: b[2], height: b[3], rx: 14, class: cls, 'stroke-width': 2 });  // R(b, cls): a rounded rectangle placed by b = [x, y, width, height] with the given colour class
            k.push(s('text', { x: G.ot[0], y: G.ot[1], 'font-size': 15, 'font-weight': 800 }, TT().name));  // the chosen type's name above the object box
            k.push(R(G.ob, 's-os'));  // the purple object box
            k.push(s('circle', { cx: G.lamp[0], cy: G.lamp[1], r: 13, class: sig ? 's-ok' : 's-panel', 'stroke-width': 2.5 }));  // the lamp: green when signaled, grey when not
            k.push(s('text', { x: G.st[0], y: G.st[1], 'font-size': 17, 'font-weight': 800, style: `fill:var(${sig ? '--ok' : '--muted'})` }, sig ? 'signaled' : 'nonsignaled'));  // the word signaled or nonsignaled beside the lamp, in green or grey
            infoLines().forEach(([txt, st], i) => { const p = G.info[i]; if (p) k.push(s('text', { x: p[0], y: p[1], 'font-size': 14.5, 'font-weight': st ? 800 : 500, style: st === 'warn' ? 'fill:var(--warn)' : '' }, txt)); });  // the facts from infoLines at their positions: bold where marked, amber for a warning
            k.push(s('text', { x: G.qt[0], y: G.qt[1], 'font-size': 15, 'font-weight': 800 }, `Waiting (${waiting.length}): asleep, no CPU`));  // the queue title with the number of sleepers and a reminder that they use no processor time
            k.push(R(G.qb, 's-panel'));  // the grey box that holds the queue
            for (let i = 0; i < MAXT; i++) {  // five queue slots, one per possible thread
              const x = G.qx(i), n = waiting[i];  // x: this slot's position; n: the thread sleeping in it, if any
              if (n) k.push(token(s, x, G.qy, n, 's-warn', 50, 44, 17));  // a sleeping thread is drawn as an amber token
              else k.push(s('rect', { x: x - 25, y: G.qy - 22, width: 50, height: 44, rx: 10, class: 's-muted', 'stroke-dasharray': '5 5' }));  // an empty slot is drawn as a dashed outline
              if (n && !ctx.narrow) k.push(s('text', { x, y: G.qy + 42, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, ['1st', '2nd', '3rd', '4th', '5th'][i]));  // on wide screens, an ordinal (1st, 2nd...) under each sleeper shows its place in the queue
            }  // ends the slot loop
            if (!ctx.narrow) k.push(s('text', { x: G.qb[0] + G.qb[2] / 2, y: 222, 'text-anchor': 'middle', 'font-size': 13.5, class: 's-sub' }, waiting.length ? 'each one sleeps inside its wait call' : 'nobody is waiting'));  // on wide screens, a note under the queue saying the threads sleep inside their wait call, or that nobody waits
            if (!ctx.narrow) k.push(s('line', { x1: 526, y1: G.qy, x2: 541, y2: G.qy, class: 's-line', 'marker-end': 'url(#arr)' }));  // on wide screens, a short arrow from the queue to the released box
            k.push(s('text', { x: G.rt[0], y: G.rt[1], 'font-size': 15, 'font-weight': 800 }, `Released (${released.length})`));  // the released box's title with the number of threads released
            k.push(s('rect', { x: G.rb[0], y: G.rb[1], width: G.rb[2], height: G.rb[3], rx: 14, class: 's-ok', 'stroke-width': 2, 'fill-opacity': 0.45 }));  // the green released box, drawn half see-through so the tokens stand out
            released.forEach((r, i) => {  // draws each released thread
              const [x, y] = G.rp(i), own = type === 'mutex' && o.owner === r.n;  // its position in the box; own is true if it currently owns the mutex
              k.push(token(s, x, y, r.n, r.code === 'ended' ? 's-bad' : own ? 's-accent' : 's-thread', 40, 26, 14));  // the token: red if it died holding the mutex, indigo if it owns the mutex, pink otherwise
              k.push(s('text', { x: x + 28, y: y + 5, 'font-size': 13.5, 'font-weight': 700, class: 's-monot', style: r.code === 'WAIT_ABANDONED' ? 'fill:var(--warn)' : r.code === 'ended' ? 'fill:var(--bad)' : '' }, r.code === 'ended' ? 'died holding it' : r.code));  // beside it, its return code in fixed-width text: amber for WAIT_ABANDONED, red "died holding it" for a dead owner
            });  // ends the released loop
            if (!released.length) k.push(s('text', { x: G.rb[0] + G.rb[2] / 2, y: G.rb[1] + G.rb[3] / 2 + 5, 'text-anchor': 'middle', 'font-size': 14, class: 's-sub' }, 'nobody yet'));  // with nobody released yet, a grey "nobody yet" in the middle of the box
            svg.replaceChildren(...k);  // replaces the old picture with the new shapes in one go
          }  // ends draw
          function paint() {  // paint(): refreshes the type buttons, the trigger row, the wait button and the rule card, then redraws the picture
            typeBtns.forEach((b, i) => b.setAttribute('aria-pressed', String(TYPES[i].k === type)));  // marks only the chosen type's button as pressed
            if (type === 'sem') {  // the semaphore gets its own controls
              const sg = ctx.ui.seg([1, 2, 3].map((v) => ({ value: v, label: 'n = ' + v })), relN, (v) => { relN = v; paint(); });  // a switch to pick how many units to release (n = 1, 2 or 3); changing it repaints so the button label follows
              trig.replaceChildren(sg, btn(ctx, `ReleaseSemaphore(h, ${relN})`, () => act('rel'), 'sm os'));  // the trigger row: that switch plus a purple ReleaseSemaphore button showing the chosen n
            } else trig.replaceChildren(...TT().acts.map(([lab, a, c]) => {  // every other type gets one button per entry in its acts list
              const b = btn(ctx, lab, () => act(a), 'sm ' + c);  // each button runs act with its action name and uses its colour class
              if ((type === 'proc' || type === 'thread') && o.sig) b.disabled = true;  // an ended process or thread cannot end again, so its button is greyed out once it is signaled
              return b;  // hands the button to replaceChildren
            }));  // closes the trigger row
            waitBtn.disabled = next > MAXT;  // the wait button is greyed out once all five thread names are used
            waitBtn.textContent = next > MAXT ? 'All 5 threads used' : `+ T${next} calls Wait`;  // its label names the next thread, e.g. "+ T4 calls Wait", or says all five are used
            ruleEl.innerHTML = `<b>${TT().name}.</b> ${TT().rule}`;  // the rule card: the chosen type's name in bold followed by its rule
            draw();  // redraws the picture
          }  // ends paint
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: 'minmax(0, 330px) minmax(0, 1fr)', gap: '20px' } },  // builds the step's layout: a 330-pixel control column on the left, the picture on the right
            h('div', { class: 'stack', style: { gap: '8px' } },  // left column: a stack with 8-pixel gaps
              h('div', { class: 'lbl' }, '1 · Pick an object'),  // instruction label 1: pick an object type
              h('div', { class: 'grid-2', style: { gap: '6px' } }, ...typeBtns),  // the eight type buttons in two columns
              h('div', { class: 'lbl', style: { marginTop: '4px' } }, '2 · Make something happen'),  // instruction label 2: make something happen, with a little space above it
              trig,  // the trigger buttons for the chosen type
              h('div', { class: 'row gap-s' }, waitBtn, btn(ctx, 'Reset', () => reset(), 'sm')),  // a row with the "another thread waits" button and Reset
              ruleEl,  // the rule card for the chosen type
              h('p', { class: 'xs muted m0' }, 'This simulation releases waiters in arrival order. Windows does not promise strict first-in, first-out order, so real programs must never rely on it.')),  // fine print: the simulation releases waiters in arrival order, which real Windows does not promise; closes the left column
            h('div', { class: 'stack', style: { gap: '10px' } },  // right column: a stack with 10-pixel gaps
              h('div', { class: 'card white tight' }, svg),  // the picture on a white card
              narr,  // the narration box
              h('div', { class: 'card tight small' }, h('b', {}, 'Try these'),  // the "Try these" card with numbered experiments
                h('ol', { class: 'm0 try2', style: { paddingLeft: '20px', lineHeight: 1.4, gridTemplateColumns: ctx.narrow ? '1fr' : '1fr 1fr' } },  // the list, in two columns on wide screens and one column in the phone-width layout
                  h('li', {}, 'Both events: one SetEvent. How many wake?'),  // experiment 1: compare how many wake for one SetEvent on each kind of event
                  h('li', {}, 'Semaphore: release n = 2. Who still sleeps?'),  // experiment 2: release two semaphore units and see who still sleeps
                  h('li', {}, 'Mutex: let T0 die holding it. What does T1 get?'),  // experiment 3: let the mutex owner die and see what the next owner receives
                  h('li', {}, 'Process: end it, then let T4 wait.'))))));  // experiment 4: end a process, then add a waiter that passes straight through; closes the layout and the append call
          reset();  // sets up the first object and draws it as soon as the step opens
        },  // ends render for step 4
      },  // closes step 4

      /* ---------------- 5. WaitForMultipleObjects ---------------- */
      {  // opens step 5, WaitForMultipleObjects
        title: 'WaitForMultipleObjects: wait for any, or for all',  // step 5 title: wait for any, or wait for all
        kind: 'explore',  // kind explore: the guide labels it Explore
        render(el, ctx) {  // render(el, ctx): runs when step 5 opens and builds the three objects and thread T
          const { h } = ctx;  // takes the HTML builder h out of ctx
          const src = `${/* src: the C-style listing for this step starts here */''}
HANDLE h[3] = {hData, hLog, hSlot}; // objects 0, 1, 2${/* shown code, line 1: an array of three handles, objects 0, 1 and 2 */''}
r = WaitForMultipleObjects(  // wait on several objects${/* shown code, line 2: the call that waits on several objects */''}
      3, h,                  // how many, and which ones${/* shown code, line 3: how many handles and the array holding them */''}
      waitAll,               // FALSE: any one, TRUE: all${/* shown code, line 4: the flag that chooses wait-for-any (FALSE) or wait-for-all (TRUE) */''}
      INFINITE);             // no time limit${/* shown code, line 5: no time limit */''}
if (!waitAll)                // in wait-any mode:${/* shown code, line 6: in wait-any mode only... */''}
    i = r - WAIT_OBJECT_0;   // which object won`;  // shown code, line 7: ...subtracting WAIT_OBJECT_0 from the result gives the index of the object that ended the wait; the backtick ends the listing
          const code = ctx.ui.code(src, { lang: 'c', fontSize: 13 });  // builds the numbered, coloured listing
          code.style.flexShrink = '0';  // stops the listing from shrinking when the column is short
          const SLOTMAX = 2;  // SLOTMAX: the semaphore's maximum count, two slots
          let all = false, ev, owner, count, T, ret, holds;  // state: wait-all mode or not, the event's state, the mutex owner, the semaphore count, T's status, its return value and what it holds
          const narr = narrBox(ctx, 74);  // narr: the narration box, at least 74 pixels tall
          const cards = h('div', { class: 'grid-3', style: { gap: '10px' } });  // cards: three columns, one card per object
          const tPanel = h('div', { class: 'tpanel' });  // tPanel: the pink panel for thread T and its buttons
          const sig = (i) => (i === 0 ? ev : i === 1 ? owner == null : count > 0);  // sig(i): whether object i is signaled: the event when set, the mutex when unowned, the semaphore when its count is above 0
          const NAMES = ['hData', 'hLog', 'hSlot'];  // NAMES: the handle names for objects 0, 1 and 2
          function reset(msg) {  // reset(msg): puts everything back to the start; runs when the step opens, on Reset and when the mode changes
            ev = false; owner = 'X'; count = 0; T = 'idle'; ret = ''; holds = [];  // event not set, mutex owned by thread X, no free slot, T not waiting, nothing returned and nothing held
            narr.say(msg || `Mode: <b>${all ? 'wait for ALL' : 'wait for ANY'}</b>. None of the three objects is signaled yet: the event is not set, thread X owns the mutex and the semaphore has no free slot. Make T wait, then signal objects one at a time.`);  // explains the mode and that nothing is signaled yet, or shows msg if one was passed
            paint();  // draws the cards and T's panel
          }  // ends reset
          /* Called after every change: if T is waiting, apply the real rule for the current mode. */
          function evaluate() {  // evaluate(): applies the wait rule after every change and returns the sentence to add to the narration
            if (T !== 'waiting') return '';  // if T is not waiting, there is nothing to decide
            const on = [0, 1, 2].filter(sig);  // on: the indexes of the objects signaled right now
            if (!all && on.length) {  // wait-any mode with at least one object signaled: T wakes
              const i = on[0];  // i: the lowest signaled index, which is the one Windows reports
              claim(i); T = 'done'; ret = `WAIT_OBJECT_0 + ${i}`;  // T claims only that object, stops waiting, and the call returns WAIT_OBJECT_0 + i
              return ` <b>T wakes.</b> Object ${i} (${NAMES[i]}) is signaled, so the call returns <b>WAIT_OBJECT_0 + ${i}</b>${on.length > 1 ? `; objects ${on.join(' and ')} were both signaled and the <b>lowest index</b> wins` : ''}. Only object ${i} is ${i === 0 ? 'used (this manual-reset event has nothing to claim and stays set)' : 'claimed'}${on.length > 1 ? '; the others are left untouched' : ''}.`;  // explains the wake, the return value, why the lowest index wins if several were signaled, and that only one object is claimed
            }  // ends the wait-any case
            if (all && on.length === 3) {  // wait-all mode with all three signaled: T wakes
              [0, 1, 2].forEach(claim); T = 'done'; ret = 'WAIT_OBJECT_0';  // T claims all three objects together and the call returns WAIT_OBJECT_0
              return ' <b>T wakes.</b> All three are signaled at the same moment, so Windows claims them <b>all in one atomic step</b> (T now owns the mutex and holds a slot) and returns WAIT_OBJECT_0.';  // explains that Windows claims them all in one atomic step
            }  // ends the wait-all success case
            if (all) return ` T keeps sleeping: ${on.length} of 3 signaled. ${on.includes(1) ? 'The mutex is free, but T does <b>not</b> take it yet: another thread could still grab it.' : ''}`;  // wait-all mode with some missing: T keeps sleeping, and if the mutex is free the message stresses that T does not take it yet
            return ' T keeps sleeping: nothing is signaled.';  // wait-any mode with nothing signaled: T keeps sleeping
          }  // ends evaluate
          function claim(i) {  // claim(i): what T gets when it claims object i (the event needs no claiming)
            if (i === 1) { owner = 'T'; holds.push('the mutex'); }  // claiming the mutex makes T its owner
            if (i === 2) { count--; holds.push('one slot'); }  // claiming the semaphore takes one slot from the count
          }  // ends claim
          function act(i, kind) {  // act(i, kind): runs when a button on object i's card is clicked; kind says which action
            let m = '';  // m will hold the description of the change
            if (i === 0) { ev = kind === 'set'; m = kind === 'set' ? 'SetEvent(hData): object 0 is signaled.' : 'ResetEvent(hData): object 0 is nonsignaled.'; }  // event: SetEvent makes it signaled, ResetEvent makes it nonsignaled
            if (i === 1) { owner = kind === 'rel' ? null : 'X'; m = kind === 'rel' ? 'X releases the mutex: object 1 is signaled (free).' : 'X takes the free mutex again: object 1 is nonsignaled.'; }  // mutex: X releases it (signaled, free) or X takes it again (nonsignaled)
            if (i === 2) { count += kind === 'rel' ? 1 : -1; m = kind === 'rel' ? `ReleaseSemaphore(hSlot, 1): count ${count - 1} → ${count}, so object 2 is signaled.` : `Another thread takes a slot: count ${count + 1} → ${count}.`; }  // semaphore: a release adds a slot (signaled), or another thread takes one
            const r = evaluate();  // r: the result of applying the wait rule after this change
            narr.say(m + r, r.includes('T wakes') ? 'ok' : r.includes('not</b> take') ? 'warn' : '');  // shows the change plus the rule's result: green if T woke, amber if a free mutex was not taken, plain otherwise
            paint();  // redraws the cards and T's panel
          }  // ends act
          function tCall() {  // tCall(): runs when T's wait button is clicked; T calls WaitForMultipleObjects
            T = 'waiting'; ret = ''; holds = [];  // T starts waiting with no return value and nothing held
            const r = evaluate();  // applies the rule at once, since objects may already be signaled
            narr.say(`T calls WaitForMultipleObjects(3, h, ${all ? 'TRUE' : 'FALSE'}, INFINITE).` + (r || ''), r.includes('T wakes') ? 'ok' : '');  // describes the call with the current flag, plus the result; green if T woke immediately
            paint();  // redraws the cards and T's panel
          }  // ends tCall
          function tDone() {  // tDone(): runs when T finishes its work; T gives back everything it claimed
            const gave = holds.slice();  // gave: a copy of what T held, for the message
            if (owner === 'T') owner = null;  // if T owns the mutex, it releases it, so the mutex is free
            if (gave.includes('one slot')) count++;  // if T held a slot, it goes back to the semaphore
            T = 'idle'; ret = ''; holds = [];  // T is idle again with no return value and nothing held
            narr.say(gave.length ? `T finishes its work and gives back ${gave.join(' and ')} (ReleaseMutex, ReleaseSemaphore).` : 'T finishes. It claimed nothing, so it has nothing to give back.');  // says what T gave back and with which calls, or that it claimed nothing
            paint();  // redraws the cards and T's panel
          }  // ends tDone
          function paint() {  // paint(): rebuilds the three object cards and T's panel from the current state
            const C = [  // C: for each object, its title, its current state in words, and its two buttons as [label, action, greyed out when]
              ['Event · data ready', ev ? 'set' : 'not set', [['SetEvent', () => act(0, 'set'), ev], ['ResetEvent', () => act(0, 'reset'), !ev]]],  // object 0, the event: set or not set; SetEvent is greyed out when already set, ResetEvent when not set
              ['Mutex · log lock', 'owner: ' + (owner || 'none'), [['X releases it', () => act(1, 'rel'), owner !== 'X'], ['X takes it', () => act(1, 'take'), owner != null]]],  // object 1, the mutex: shows its owner; X can release it only while X owns it, and take it only while it is free
              ['Semaphore · slots', `count ${count} of ${SLOTMAX}`, [['Release 1 unit', () => act(2, 'rel'), count + (holds.includes('one slot') ? 1 : 0) >= SLOTMAX], ['Other takes 1', () => act(2, 'take'), count === 0]]],  // object 2, the semaphore: shows its count; a release is greyed out if it would pass the maximum, a take if no slot is free
            ];  // closes the C list
            cards.replaceChildren(...C.map(([title, info, bs], i) => h('div', { class: 'ocard' + (sig(i) ? ' on' : '') },  // one card per object, green while it is signaled
              h('span', { class: 'mono b' }, `${i} · ${NAMES[i]}`),  // the card's index and handle name, in bold fixed-width text
              h('div', { class: 'small muted' }, title),  // a grey line saying what the object stands for
              h('div', {}, h('span', { class: 'chip ' + (sig(i) ? 'ok' : '') }, sig(i) ? 'signaled' : 'nonsignaled')),  // a chip: green "signaled" or plain "nonsignaled"
              h('div', { class: 'b', style: { fontSize: '15.5px' } }, info),  // the object's current state in bold
              ...bs.map(([lab, fn, dis]) => { const b = btn(ctx, lab, fn, 'sm'); b.disabled = !!dis; b.style.width = '100%'; return b; }))));  // its two buttons, each full width and greyed out when the action makes no sense; closes the card
            const tState = T === 'idle' ? 'not waiting' : T === 'waiting' ? 'asleep in the wait' : 'running again';  // tState: T's status in words: not waiting, asleep in the wait, or running again
            tPanel.replaceChildren(  // refills T's panel
              h('div', { class: 'row gap-s' }, h('span', { class: 'tok' }, 'T'),  // top row: the T badge...
                h('span', { class: 'chip ' + (T === 'waiting' ? 'warn' : T === 'done' ? 'ok' : '') }, tState),  // ...a chip with T's status, amber while asleep and green once running again...
                h('span', { class: 'small' }, h('b', {}, 'returned: '), h('span', { class: 'mono' }, ret || '—')),  // ...what the call returned, or a dash...
                h('span', { class: 'small' }, h('b', {}, 'holds: '), holds.length ? holds.join(' + ') : 'nothing')),  // ...and what T holds, or nothing
              h('div', { class: 'row gap-s' },  // bottom row: T's buttons
                T === 'idle' ? btn(ctx, `T calls WaitForMultipleObjects (${all ? 'all' : 'any'})`, tCall, 'sm primary') : null,  // while idle: the main button that makes T call WaitForMultipleObjects in the current mode
                T === 'done' ? btn(ctx, 'T finishes and gives back what it holds', tDone, 'sm') : null,  // once woken: a button that makes T finish and give back what it holds
                T === 'waiting' ? h('span', { class: 'small muted' }, 'Signal objects above to see when T wakes.') : null,  // while waiting: a grey hint to signal the objects above
                btn(ctx, 'Reset', () => reset(), 'sm')));  // Reset is always there; closes T's panel
          }  // ends paint
          const seg = ctx.ui.seg([{ value: false, label: 'Wait for ANY (bWaitAll = FALSE)' }, { value: true, label: 'Wait for ALL (bWaitAll = TRUE)' }], all, (v) => { all = v; reset(); });  // the mode switch: wait for any (bWaitAll = FALSE) or wait for all (TRUE); changing it starts over
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: 'minmax(0, 10fr) minmax(0, 12fr)', gap: '20px' } },  // builds the step's layout: explanation on the left, the objects and thread T on the right
            h('div', { class: 'stack', style: { gap: '9px' } },  // left column: a stack with 9-pixel gaps
              h('p', { class: 'm0', html: '<code>WaitForMultipleObjects</code> takes up to 64 handles and a flag. With <b>FALSE</b> it returns as soon as <b>any one</b> object i is signaled, returning <code style="white-space:nowrap">WAIT_OBJECT_0 + i</code> (or <code style="white-space:nowrap">WAIT_ABANDONED_0 + i</code> for an abandoned mutex). With <b>TRUE</b> it returns only when <b>all</b> are signaled at once.' }),  // intro paragraph: up to 64 handles, the any and all modes, and the return values WAIT_OBJECT_0 + i and WAIT_ABANDONED_0 + i
              code,  // the code listing
              h('div', { class: 'callout why small m0', 'data-label': 'Why wait-all matters', html: 'Windows changes nothing until every object is signaled, then claims them all in one atomic step. T never holds the mutex while it sleeps on the semaphore, so this wait cannot create a <span class="t">hold and wait</span>.' }),  // "Why wait-all matters" callout: everything is claimed in one atomic step, so the wait cannot create hold and wait
              h('div', { class: 'callout warn small m0', 'data-label': 'Common mistake' }, 'Thinking wait-all grabs the mutex the moment it is free. It does not: until the others are signaled too, any other thread may take it.')),  // "Common mistake" callout: wait-all does not grab the free mutex early; closes the left column
            h('div', { class: 'stack', style: { gap: '10px' } },  // right column: a stack with 10-pixel gaps
              seg, cards, tPanel, narr)));  // the mode switch, the object cards, T's panel and the narration; closes the layout and the append call
          reset();  // sets up the starting state and draws it as soon as the step opens
        },  // ends render for step 5
      },  // closes step 5

      /* ---------------- 6. Critical section vs mutex ---------------- */
      {  // opens step 6, critical sections compared with mutexes
        title: 'Critical sections: stay in user mode when you can',  // step 6 title: critical sections stay in user mode when they can
        kind: 'compare',  // kind compare: the guide labels it Compare
        core: true,  // core: true keeps this step on the shorter core path
        render(el, ctx) {  // render(el, ctx): runs when step 6 opens and builds the tabs and the cost experiment
          const { h } = ctx;  // takes the HTML builder h out of ctx
          /* Illustrative cost model, in units of about one interlocked instruction. */
          const IL = 1, SYS = 30, BLOCK = 300;  // model costs: an interlocked instruction 1, a system call 30, sleeping and being woken 300
          let p = 10, H = 100, S = 4000, cpus = 4;  // starting slider values: 10 percent contention, the holder lets go after 100 units, spin count 4000, 4 processors
          const src = `${/* src: the C-style listing for the "How it works" tab starts here */''}
CRITICAL_SECTION cs;        // lives in our own memory${/* shown code, line 1: the critical section variable, which lives in the program's own memory */''}
InitializeCriticalSectionAndSpinCount(  // set it up:${/* shown code, line 2: the call that sets it up with a spin count */''}
    &cs, 4000);             // spin up to 4000 times${/* shown code, line 3: its arguments: the critical section and a spin count of 4000 */''}
EnterCriticalSection(&cs);  // free? one interlocked op${/* shown code, line 4: enter; if the lock is free this costs one interlocked instruction */''}
balance += deposit;         // use the shared data${/* shown code, line 5: the protected work on shared data */''}
LeaveCriticalSection(&cs);  // wakes a sleeper, if any`;  // shown code, line 6: leave, which wakes a sleeping waiter if there is one; the backtick ends the listing
          const howTab = (pn) => {  // howTab(pn): draws the "How it works" tab into its panel
            const code = ctx.ui.code(src, { lang: 'c', fontSize: 13 });  // builds the listing in C colours
            code.style.flexShrink = '0';  // stops the listing from shrinking when the panel is short
            pn.append(h('div', { class: 'stack', style: { gap: '8px' } },  // a stack with 8-pixel gaps holding the tab's content
              h('p', { class: 'm0 small', html: 'A <span class="t">critical section object</span> is a lock for the threads of <b>one process</b>. It lives in the process’s own memory, so taking it usually needs no help from the kernel.' }),  // intro paragraph: a critical section is a lock for one process that lives in its own memory
              code,  // the code listing
              h('ol', { class: 'm0 small', style: { lineHeight: 1.4 } },  // a numbered list of the three paths taken by EnterCriticalSection
                h('li', { html: '<b>Free:</b> one interlocked instruction marks it taken. No <span class="t">system call</span>.' }),  // path 1: a free lock costs one interlocked instruction and no system call
                h('li', { html: '<b>Busy, on a multiprocessor:</b> re-check it up to the <span class="t">spin count</span>, hoping the holder, running on another processor, lets go soon.' }),  // path 2: a busy lock on a multiprocessor is re-checked up to the spin count
                h('li', { html: '<b>Still busy:</b> sleep on a kernel object. LeaveCriticalSection wakes the sleeper.' })),  // path 3: if still busy, the thread sleeps on a kernel object until Leave wakes it; closes the list
              h('div', { class: 'callout why small m0', 'data-label': 'Why spin at all?' }, 'On a multiprocessor the holder is probably running right now on another processor and may let go within a few hundred instructions. Spinning that long is cheaper than the two thread switches needed to sleep and be woken.')));  // "Why spin at all?" callout: spinning briefly is cheaper than two thread switches; closes the tab's content
          };  // ends howTab
          const R = [['Lives in', 'the process’s own memory', 'the kernel (a dispatcher object)'],  // R: the side-by-side comparison rows as [property, critical section, mutex]; row 1: where the lock lives
            ['Who can use it', 'threads of one process', 'any process with a handle or its name'],  // row 2: who can use it
            ['Free lock costs', 'one interlocked instruction', 'a system call into the kernel'],  // row 3: what taking a free lock costs
            ['Busy lock', 'spin briefly, then sleep in the kernel', 'sleep in the kernel'],  // row 4: what happens when the lock is busy
            ['Time limit, or several at once', 'no', 'yes: any wait function'],  // row 5: whether a time limit or a wait on several objects is possible
            ['Owner thread dies', 'no warning: state undefined', 'abandoned: the next owner is told'],  // row 6: what happens if the owner dies holding it
            ['Owner asks again', 'allowed (it keeps a count)', 'allowed (it keeps a count)']];  // row 7: whether the owner may take it again; closes R
          const sideTab = (pn) => pn.append(h('table', { class: 'tbl compact' },  // sideTab(pn): draws the "Side by side" tab as a compact table
            h('thead', {}, h('tr', {}, h('th', {}, ''), h('th', {}, 'Critical section'), h('th', {}, 'Mutex'))),  // header row: an empty corner, then Critical section and Mutex
            h('tbody', {}, ...R.map((r) => h('tr', {}, h('td', { class: 'b' }, r[0]), h('td', {}, r[1]), h('td', {}, r[2]))))));  // one body row per entry of R, with the property name in bold; closes the table
          const tabs = ctx.ui.tabs([{ label: 'How it works', render: howTab }, { label: 'Side by side', render: sideTab }]);  // tabs: the two tabs on the left side of the step, "How it works" first
          const bars = h('div', { class: 'stack', style: { gap: '8px' } });  // bars: the box for the two cost bars
          const paths = h('div', { class: 'stack', style: { gap: '6px' } });  // paths: the box for the "where entries go" strip
          const chips = h('div', { class: 'row gap-s' });  // chips: the row counting kernel entries
          const narr = narrBox(ctx, 70);  // narr: the narration box that interprets the numbers, at least 70 pixels tall
          const fmt = (x) => (x >= 100 ? Math.round(x) : Math.round(x * 10) / 10).toString();  // fmt(x): writes a cost as a whole number from 100 up, or with one decimal place below that
          function model() {  // model(): computes every cost from the current slider settings
            const pc = p / 100, multi = cpus > 1, spins = multi && S > 0;  // pc: the busy fraction (0 to 1); multi: more than one processor; spins: whether waiters spin (multiprocessor and spin count above 0)
            const mxU = 2 * SYS, mxC = 2 * SYS + BLOCK;  // mutex costs: free = two system calls (wait and release); busy = those plus one sleep and wake
            const csU = 2 * IL, spinWins = spins && H <= S;  // critical section free cost: two interlocked instructions (enter and leave); spinWins: the holder lets go within the spin budget
            const csC = spinWins ? 2 * IL + H : 2 * IL + (spins ? S : 0) + 2 * SYS + BLOCK;  // critical section busy cost: the spin time if spinning wins, otherwise any wasted spinning plus two system calls and a sleep and wake
            return { pc, multi, spins, spinWins, mxU, mxC, csU, csC, mx: (1 - pc) * mxU + pc * mxC, cs: (1 - pc) * csU + pc * csC,  // returns all the parts and the average cost of each lock, weighting the busy cost by how often the lock is busy
              kMx: 2000, kCs: Math.round(pc * 1000 * (spinWins ? 0 : 2)) };  // kernel entries per 1,000 lock/unlock pairs: always 2,000 for the mutex; for the critical section, two per busy entry that ends up sleeping
          }  // ends model
          function bar(label, val, max, cls, sub) {  // bar(label, val, max, cls, sub): builds one cost bar row: a label, a coloured bar scaled to max, the number, and a note underneath
            return h('div', { class: 'cmp' }, h('div', { class: 'b' }, label), h('div', { class: 'track ' + cls }, h('i', { style: { width: Math.max(1.5, (val / max) * 100) + '%' } })),  // the row: the label in bold, then the track with its coloured bar sized as a share of max (at least 1.5 percent so it never vanishes)
              h('div', { class: 'num b', style: { textAlign: 'right' } }, fmt(val)), h('div', { class: 'xs muted', style: { gridColumn: '2 / 4' } }, sub));  // the number on the right, and the grey note under the bar spanning the bar and number columns
          }  // ends bar
          function update() {  // update(): recomputes the model and refreshes the bars, the strip, the chips and the narration; runs whenever a control changes
            const m = model(), max = Math.max(m.mx, m.cs, 1), sleepC = 2 * IL + 2 * SYS + BLOCK;  // m: the model's results; max: the larger average, so the bigger bar fills its track; sleepC: the cost of a busy entry that sleeps at once
            bars.replaceChildren(  // refills the bars box
              bar('Mutex', m.mx, max, 'mx', `free: ${m.mxU} (two system calls) · busy: ${m.mxC} (adds sleep + wake)`),  // the mutex bar, with a note giving its free and busy costs
              bar('Critical section', m.cs, max, 'cs', `free: ${m.csU} · busy: ${m.csC} (${m.spinWins ? 'spin until the holder lets go' : m.spins ? `spin ${S}, then sleep anyway` : 'sleep in the kernel at once'})`));  // the critical-section bar, with its free and busy costs and what a busy waiter does (spin and succeed, spin then sleep, or sleep at once)
            const fast = 100 - p, spin = m.spinWins ? p : 0, kern = m.spinWins ? 0 : p;  // the percentages for the strip: entries that find the lock free, that spin and then succeed, and that end up sleeping in the kernel
            paths.replaceChildren(h('div', { class: 'small b' }, 'Where critical-section entries go'),  // refills the strip box with its title...
              h('div', { class: 'paths' }, h('i', { class: 'pf', style: { width: fast + '%' } }), h('i', { class: 'ps', style: { width: spin + '%' } }), h('i', { class: 'pk', style: { width: kern + '%' } })),  // ...the strip itself, three coloured parts whose widths are those percentages...
              h('div', { class: 'row gap-s xs' }, h('span', { class: 'chip ok' }, `fast path, user mode: ${fast}%`), h('span', { class: 'chip accent' }, `spin, then succeed: ${spin}%`), h('span', { class: 'chip warn' }, `sleep in the kernel: ${kern}%`)));  // ...and a row of chips labelling each part with its percentage
            chips.replaceChildren(h('span', { class: 'small b' }, 'Kernel entries per 1,000 lock/unlock pairs:'), h('span', { class: 'chip os' }, `mutex ${m.kMx.toLocaleString('en-US')}`), h('span', { class: 'chip proc' }, `critical section ${m.kCs.toLocaleString('en-US')}`));  // the kernel-entry chips: the mutex's count in purple and the critical section's in teal, written with thousands separators
            const ratio = m.mx / m.cs;  // ratio: how many times more the mutex costs than the critical section
            let msg = m.cs <= m.mx ? `The critical section is <b>${fmt(ratio)}× cheaper</b> on average (${fmt(m.cs)} vs ${fmt(m.mx)} units).` : `Here the critical section is <b>${fmt(m.cs / m.mx)}× more expensive</b> (${fmt(m.cs)} vs ${fmt(m.mx)} units).`;  // msg starts by saying which lock is cheaper on average, and by how much
            if (p === 0) msg += ' With no contention it never leaves user mode, while every mutex wait and release is a system call.';  // no contention: the critical section never leaves user mode, while every mutex operation is a system call
            else if (!m.multi) msg += ' On one processor spinning is useless: the holder cannot run while you spin, so Windows ignores the spin count and a busy lock means sleeping at once.';  // one processor: spinning cannot help because the holder cannot run, so a busy lock means sleeping at once
            else if (!m.spins) msg += ' With spin count 0, every busy lock costs about what a mutex costs: a trip into the kernel to sleep.';  // spin count 0: every busy entry goes to the kernel, costing about what a mutex costs
            else if (m.spinWins && m.csC <= sleepC) msg += ` The holder lets go after ${H} units, within the spin budget of ${S}, so a waiter never sleeps: a busy entry costs ${m.csC} units (${H} of them spinning), less than the ${sleepC} it would cost to sleep in the kernel and be woken.`;  // the holder lets go within the spin budget and spinning is cheaper than sleeping: the waiter never sleeps
            else if (m.spinWins) msg += ` A waiter spins ${H} units before the holder lets go. It never sleeps, but sleeping would have cost only ${sleepC}: when the lock is held this long, spinning wastes processor time.`;  // the holder lets go within the budget, but spinning that long costs more than sleeping would have
            else msg += ` The holder needs ${H} units, more than the spin budget of ${S}, so a waiter burns ${S} units spinning <b>and then</b> sleeps anyway: the worst of both. Spinning only pays for very short critical sections.`;  // the holder needs longer than the budget: the waiter spins the whole budget and then sleeps anyway, the worst case
            narr.say(msg, m.cs <= m.mx ? 'ok' : 'warn');  // shows the message, green when the critical section wins and amber when it does not
          }  // ends update
          const sp = ctx.ui.slider({ label: 'Contention', min: 0, max: 100, step: 5, value: p, format: (v) => v + '% busy', onInput: (v) => { p = v; update(); } });  // contention slider: 0 to 100 percent busy in steps of 5
          const sh = ctx.ui.slider({ label: 'Holder lets go after', min: 0, max: 1200, step: 50, value: H, format: (v) => v + ' units', onInput: (v) => { H = v; update(); } });  // slider for how long the holder keeps the lock: 0 to 1,200 units in steps of 50
          const sS = ctx.ui.seg([0, 500, 4000].map((v) => ({ value: v, label: String(v) })), S, (v) => { S = v; update(); });  // spin count switch: 0, 500 or 4000
          const sC = ctx.ui.seg([{ value: 1, label: '1 processor' }, { value: 4, label: '4 processors' }], cpus, (v) => { cpus = v; update(); });  // processor switch: one processor or four
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: 'minmax(0, 10fr) minmax(0, 12fr)', gap: '22px' } },  // builds the step's layout: the tabs on the left, the experiment on the right
            h('div', { class: 'stack' }, tabs),  // left column: the two tabs
            h('div', { class: 'stack', style: { gap: '9px' } },  // right column: a stack with 9-pixel gaps
              h('div', { class: 'small', html: '<b>Experiment.</b> Average locking overhead per lock + unlock as <span class="t">contention</span> (the share of attempts that find the lock busy) changes. Cost units: 1 ≈ one interlocked instruction, a system call 30, sleep + wake 300. <b>An illustrative model, not measurements.</b>' }),  // explains the experiment: average overhead as contention changes, the cost units used, and that it is a model, not measurements
              sp, sh,  // the contention and holder-time sliders
              h('div', { class: 'row gap-s' }, h('span', { class: 'small b' }, 'Spin count'), sS, sC),  // a row with the spin count switch and the processor switch
              bars, paths, chips, narr)));  // the bars, the strip, the kernel-entry chips and the narration; closes the layout and the append call
          update();  // computes and draws the first results as soon as the step opens
        },  // ends render for step 6
      },  // closes step 6

      /* ---------------- 7. SRW locks and condition variables ---------------- */
      {  // opens step 7, SRW locks and condition variables
        title: 'Slim reader-writer locks and condition variables',  // step 7 title: slim reader-writer locks and condition variables
        kind: 'explore',  // kind explore: the guide labels it Explore
        render(el, ctx) {  // render(el, ctx): runs when step 7 opens
          el.append(ctx.h('div', { class: 'stack fill' }, ctx.ui.tabs([  // adds a full-height stack holding two tabs
            { label: 'SRW lock playground', render: (pn) => srwTab(pn, ctx) },  // tab 1: the SRW lock playground, drawn by srwTab near the top of this file
            { label: 'Condition variable, step by step', render: (pn) => cvTab(pn, ctx) },  // tab 2: the condition variable trace, drawn by cvTab near the top of this file
          ])));  // closes the tab list, the stack and the append call
        },  // ends render for step 7
      },  // closes step 7

      /* ---------------- 8. Interlocked operations ---------------- */
      {  // opens step 8, interlocked operations
        title: 'Interlocked operations: no lock at all',  // step 8 title: interlocked operations need no lock at all
        kind: 'lab',  // kind lab: the guide labels it Hands-on Lab
        render(el, ctx) {  // render(el, ctx): runs when step 8 opens
          el.append(ctx.h('div', { class: 'stack fill' }, ctx.ui.tabs([  // adds a full-height stack holding two tabs
            { label: 'Race two threads', render: (pn) => raceTab(pn, ctx) },  // tab 1: the two-thread race, drawn by raceTab near the top of this file
            { label: 'The four functions', render: (pn) => fnTab(pn, ctx) },  // tab 2: the four interlocked functions, drawn by fnTab near the top of this file
          ])));  // closes the tab list, the stack and the append call
        },  // ends render for step 8
      },  // closes step 8

      /* ---------------- 9. Recap: pick the right tool ---------------- */
      {  // opens step 9, the recap
        title: 'Recap: pick the right tool for the job',  // step 9 title: pick the right tool for the job
        kind: 'recap',  // kind recap: the guide labels it Recap and keeps it on the core path
        render(el, ctx) {  // render(el, ctx): runs when step 9 opens and builds the scenario game and the summary
          const { h } = ctx;  // takes the HTML builder h out of ctx
          const TOOLS = {  // TOOLS: the nine answer buttons, keyed by a short code; each has a name and when that tool fits, used to explain wrong picks
            nev: ['Notification event', 'many threads must all learn, once, that something has happened'],  // tool: notification event, for telling many threads once
            sev: ['Synchronization event', 'exactly one waiting thread should react to each signal'],  // tool: synchronization event, for one thread per signal
            mutex: ['Mutex', 'mutual exclusion must work across processes, or needs a time limit or an abandonment warning'],  // tool: mutex, for exclusion across processes or with a time limit or abandonment warning
            sem: ['Semaphore', 'up to N threads may use a pool of N identical resources'],  // tool: semaphore, for a pool of identical resources
            proc: ['Wait on a process', 'one program must wait until another program has exited'],  // tool: waiting on a process, for waiting until a program exits
            cs: ['Critical section', 'the threads of one process need cheap mutual exclusion, possibly re-entered by the holder'],  // tool: critical section, for cheap, re-enterable exclusion inside one process
            srw: ['SRW lock', 'data inside one process is read often and written rarely'],  // tool: SRW lock, for data read often and written rarely
            cv: ['Condition variable', 'a thread holding a lock must sleep until the shared data reaches some state'],  // tool: condition variable, for sleeping under a lock until the data changes
            il: ['Interlocked operation', 'one variable needs a simple atomic update, such as a counter'],  // tool: interlocked operation, for one simple atomic update
          };  // closes the TOOLS table
          const SC = [  // SC: the eight scenarios, each as [situation, key of the best tool, why it fits]
            ['Two separate programs append lines to the same log file, and their lines must never interleave.', 'mutex', 'Only a kernel object can be shared by two processes. A named mutex also warns the next owner if one program dies while holding it.'],  // scenario 1 (answer: mutex): two programs writing to one log file
            ['Sixteen threads in one web server each add 1 to a shared page-hit counter.', 'il', 'One variable, one simple update: InterlockedIncrement does it atomically with no lock, no waiting and no kernel call.'],  // scenario 2 (answer: interlocked operation): many threads adding to one hit counter
            ['Threads in one process read a settings table thousands of times a second; an administrator changes it about once an hour.', 'srw', 'Readers can share an SRW lock in shared mode, so they never queue behind each other; the rare writer takes it in exclusive mode.'],  // scenario 3 (answer: SRW lock): a settings table read constantly and changed rarely
            ['A setup program starts an installer program and must not continue until the installer has exited.', 'proc', 'A process is a dispatcher object that becomes signaled when its last thread ends, so the setup program simply waits on the installer’s handle.'],  // scenario 4 (answer: wait on a process): a setup program waiting for an installer to exit
            ['At most four threads at a time may use a pool of four database connections.', 'sem', 'A semaphore with a maximum count of 4 lets four waits through and makes the fifth thread sleep until a connection is released.'],  // scenario 5 (answer: semaphore): four threads sharing four database connections
            ['The threads of one game update a shared list for a few microseconds at a time, and a function holding the lock sometimes calls a helper that takes the same lock again.', 'cs', 'A critical section is the cheapest lock for one process and, unlike an SRW lock, lets the holder enter again (it counts the entries).'],  // scenario 6 (answer: critical section): short locking inside one process with re-entry by the holder
            ['A consumer thread holds an SRW lock on a job queue and must sleep until the queue is no longer empty.', 'cv', 'SleepConditionVariableSRW releases the lock and sleeps in one atomic step, then re-acquires it on wake; the consumer re-tests the queue in a while loop.'],  // scenario 7 (answer: condition variable): a consumer sleeping under an SRW lock until the queue has work
            ['When start-up finishes, all eight worker threads, including any that only start waiting later, must be told to begin.', 'nev', 'A notification event releases every waiter and stays signaled until reset, so late arrivals pass straight through.'],  // scenario 8 (answer: notification event): telling every worker, even late ones, that start-up is done
          ];  // closes the SC list
          let i = 0, score = 0, answered = false, marks = [];  // state: the scenario on screen, the score, whether it has been answered, and a right or wrong mark per scenario
          const head = h('div', { class: 'row', style: { justifyContent: 'space-between' } });  // head: the top row with the scenario counter and the score
          const strip = h('div', { class: 'row gap-s' });  // strip: the row of answer marks at the bottom
          const qEl = h('p', { class: 'm0', style: { fontSize: '17px', minHeight: '78px' } });  // qEl: the paragraph showing the scenario text, tall enough that the buttons below do not jump
          const grid = h('div', { class: 'grid-3', style: { gap: '8px' } });  // grid: the nine tool buttons in three columns
          const fb = narrBox(ctx, 96);  // fb: the feedback box, at least 96 pixels tall
          const nextB = btn(ctx, 'Next scenario ▶', () => { i = (i + 1) % SC.length; if (i === 0) { score = 0; marks = []; } show(); }, 'sm primary');  // the Next button: moves to the following scenario, wrapping to the first, where the score and marks start over
          function show() {  // show(): displays the current scenario with fresh buttons
            answered = false;  // the new scenario has not been answered yet
            head.replaceChildren(h('span', { class: 'chip accent' }, `Scenario ${i + 1} of ${SC.length}`), h('span', { class: 'chip ok' }, `Score: ${score}`));  // refills the top row: an indigo "Scenario n of 8" chip and a green score chip
            qEl.textContent = SC[i][0];  // shows the scenario's situation text
            grid.replaceChildren(...Object.entries(TOOLS).map(([k, [name]]) => btn(ctx, name, () => pick(k), 'sm tbtn')));  // fills the grid with one button per tool; each click calls pick with that tool's key
            fb.say('Which tool fits best? Choose the <b>cheapest</b> one that does the whole job.');  // the opening prompt in the feedback box: pick the cheapest tool that does the whole job
            nextB.disabled = true;  // the Next button stays greyed out until the scenario is answered
            paintStrip();  // redraws the row of answer marks
          }  // ends show
          function paintStrip() {  // paintStrip(): redraws the row of marks, one chip per scenario
            strip.replaceChildren(h('span', { class: 'small b' }, 'Your answers:'), ...SC.map((_, j) => h('span', { class: 'chip ' + (marks[j] === true ? 'ok' : marks[j] === false ? 'bad' : j === i ? 'accent' : '') }, `${j + 1} ${marks[j] === true ? '✓' : marks[j] === false ? '✗' : '·'}`)));  // "Your answers:" then a chip per scenario: green with a tick if right, red with a cross if wrong, indigo for the current one, a dot if unanswered
          }  // ends paintStrip
          function pick(k) {  // pick(k): runs when tool button k is clicked
            if (answered) return;  // only the first click on a scenario counts
            answered = true;  // marks the scenario as answered
            const [, right, why] = SC[i], ok = k === right;  // right and why: the best tool and its explanation; ok is true if the student picked it
            if (ok) score++;  // a right first pick earns a point
            marks[i] = ok; paintStrip();  // records the result for this scenario and redraws the marks
            grid.querySelectorAll('button').forEach((b, j) => { const key = Object.keys(TOOLS)[j]; b.classList.toggle('right', key === right); b.classList.toggle('wrong', key === k && !ok); b.disabled = true; });  // colours the right tool's button green and a wrong pick red, then greys out all the buttons
            head.lastChild.textContent = `Score: ${score}`;  // updates the score chip at the end of the top row
            fb.say(ok ? `<b>Right: ${TOOLS[right][0]}.</b> ${why}` : `<b>Not quite.</b> “${TOOLS[k][0]}” fits when ${TOOLS[k][1]}. The best fit here is <b>${TOOLS[right][0]}</b>. ${why}`, ok ? 'ok' : 'bad');  // feedback: on a right pick, the tool and why; on a wrong one, what the chosen tool is for, the best fit, and why
            nextB.disabled = false;  // the Next button can now be used
            nextB.innerHTML = i === SC.length - 1 ? `Done: ${score} of ${SC.length}. Start again ▶` : 'Next scenario ▶';  // on the last scenario the button shows the final score and offers to start again
          }  // ends pick
          const keep = [  // keep: the five summary points shown on the right, as [title, text]
            ['Wait functions', 'Dispatcher objects are signaled or nonsignaled. A wait function sleeps, using no processor time, until the object is signaled or the time limit runs out.'],  // point 1: dispatcher objects, their two states, and waiting without using the processor
            ['Who wakes', 'Notification event and timer, file, process, thread: all waiters. Synchronization event and mutex: one. Semaphore: one per unit.'],  // point 2: which objects release all waiters, which release one, and the semaphore's one per unit
            ['Any or all', 'WaitForMultipleObjects returns on the first signaled object (lowest index wins) or only when all are signaled, claiming them in one step.'],  // point 3: wait-any (lowest index wins) versus wait-all (claimed together)
            ['User-mode locks', 'Critical sections, SRW locks and condition variables serve one process and enter the kernel only when a thread must sleep.'],  // point 4: the user-mode locks serve one process and enter the kernel only to sleep
            ['Re-test, or go lock-free', 'Re-test the condition in a while loop after every wake. For one variable, an interlocked operation needs no lock at all.'],  // point 5: re-test in a while loop, or use an interlocked operation for a single variable
          ];  // closes the keep list
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: 'minmax(0, 13fr) minmax(0, 9fr)', gap: '22px' } },  // builds the step's layout: the scenario game on the wider left, the summary on the right
            h('div', { class: 'stack', style: { gap: '10px' } }, head, qEl, grid, fb, h('div', { class: 'row' }, nextB), strip),  // left column: score row, scenario text, tool buttons, feedback, the Next button and the answer marks
            h('div', { class: 'stack', style: { gap: '7px' } }, h('h4', { class: 'm0' }, 'Five things to remember'),  // right column: the heading "Five things to remember"
              ...keep.map(([t1, d], j) => h('div', { class: 'keep' }, h('span', { class: 'kn' }, String(j + 1)), h('div', {}, h('b', {}, t1 + '. '), d))))));  // one numbered row per summary point, with the title in bold; closes the layout and the append call
          show();  // shows the first scenario as soon as the step opens
        },  // ends render for step 9
      },  // closes step 9

      /* ---------------- 10. Quiz ---------------- */
      {  // opens step 10, the section quiz
        title: 'Check yourself',  // step 10 title: check yourself
        kind: 'check',  // kind check: the guide labels it Check Yourself and runs the quiz engine on the questions below
        quiz: [  // quiz: the twelve questions; the field names tell the quiz engine each question's kind
          { q: 'A thread calls <code>WaitForSingleObject</code> with a time limit of INFINITE on an event that is nonsignaled. What does the thread do until the event is set?',  // question 1 (multiple choice): what a thread does while it waits forever on a nonsignaled event
            choices: ['It loops inside the call, re-checking the event as fast as it can', 'It enters the Waiting state and uses no processor time until the kernel releases it', 'The call fails at once with WAIT_FAILED, because the event is not set', 'It keeps running the code after the call and is interrupted when the event is set'],  // the four choices: busy looping, sleeping in the Waiting state, failing at once, or carrying on running
            answer: 1,  // the right answer is choice 2 (counting from 0, index 1): it sleeps and uses no processor time
            feedback: ['That would be busy waiting. A wait function blocks the thread instead, so the waiter takes no processor time.', null, 'A nonsignaled object is the normal reason to wait. WAIT_FAILED reports an error, such as an invalid handle.', 'The thread cannot get past the wait call until it returns: it is blocked, not running.'],  // feedback shown for each wrong choice; null marks the right one, which needs none
            why: 'When the wait condition is not met, the thread enters the Waiting state and the dispatcher runs other threads. The kernel makes the waiter ready again when the object becomes signaled (or when a finite time limit runs out).' },  // explanation shown after answering: the Waiting state and what makes the thread ready again
          { type: 'match', q: 'Match each Windows dispatcher object with the moment it becomes signaled.',  // question 2 (match the pairs): each dispatcher object with the moment it becomes signaled
            pairs: [['Notification event', 'A thread sets it'], ['Mutex', 'Its owning thread releases it'], ['Semaphore', 'Its count is above zero'], ['Waitable timer', 'Its set time arrives'], ['Process', 'Its last thread terminates'], ['File', 'An I/O operation on it completes']],  // the six object and moment pairs, written in matching order (the engine mixes up the right-hand side)
            why: 'Every dispatcher object is either signaled or nonsignaled, and each type has its own rule for becoming signaled. A waiting thread is released when that happens.' },  // explanation: every type has its own rule for becoming signaled
          { type: 'bucket', q: 'When each of these Windows objects becomes signaled, how many of its waiting threads are released?',  // question 3 (sort into groups): whether each object releases all its waiters or just one
            buckets: ['All waiting threads', 'Just one waiting thread'],  // the two groups
            items: [['Notification event', 0], ['Synchronization event', 1], ['Mutex, when its owner releases it', 1], ['Waitable timer (notification kind)', 0], ['Process', 0], ['Thread', 0]],  // the six objects, each with the index of its correct group (0 all, 1 one)
            why: 'Objects that announce that something happened (notification events and timers, files, processes, threads) release every waiter. A synchronization event releases one and resets itself; a released mutex goes to one new owner.' },  // explanation: announcing objects release every waiter; the synchronization event and a released mutex release one
          { type: 'num', q: 'A Windows semaphore has a count of 0 and a maximum count of 10, and 5 threads are waiting on it. Another thread calls <code>ReleaseSemaphore</code> with a release count of 3. How many of the waiting threads are released?',  // question 4 (calculate): how many of 5 waiters a release of 3 units frees from a semaphore at count 0
            answer: 3, tol: 0, unit: 'threads',  // the answer is 3 threads, with no tolerance for other numbers
            why: 'Each released waiter takes one unit of the count. Three units release three waiters, the count drops back to 0, and the other two threads keep waiting.' },  // explanation: one unit per waiter, so three wake and two keep waiting
          { q: 'Why is entering a free critical section much cheaper than waiting on a free mutex?',  // question 5 (multiple choice): why a free critical section is cheaper than a free mutex
            choices: ['The critical section disables interrupts for as long as it is held, so no other thread can cut in', 'A mutex always puts the waiting thread to sleep at least once, even when the mutex is already free', 'A free critical section takes one interlocked instruction in user mode; every mutex wait is a system call', 'A critical section skips mutual exclusion altogether whenever the machine has only one processor'],  // the four choices: disabling interrupts, the mutex always sleeping, one interlocked instruction versus a system call, skipping exclusion
            answer: 2,  // the right answer is index 2: one interlocked instruction in user mode against a system call
            feedback: ['Disabling interrupts is a kernel privilege and not how a user-mode lock works; a critical section uses an atomic instruction.', 'A wait on a free (signaled) mutex returns at once. The cost is the system call itself, not sleeping.', null, 'A critical section always enforces mutual exclusion. On one processor it only skips the spinning.'],  // feedback explaining what is wrong with each of the other three choices
            why: 'An uncontended critical section never leaves user mode. A mutex is a dispatcher object, so each wait and each release is a system call, which costs far more than one interlocked instruction.' },  // explanation: the uncontended critical section never leaves user mode, while every mutex operation is a system call
          { type: 'multi', q: 'Which statements about Windows slim reader-writer (SRW) locks are true?',  // question 6 (select all that apply): true statements about SRW locks
            choices: ['Many threads can hold one in shared mode at the same time', 'A thread holding one in exclusive mode has it to itself', 'The holder may acquire it again recursively', 'It is about the size of one pointer', 'It can be used together with a condition variable', 'Waiting threads are guaranteed to get it in first-in, first-out order'],  // the six statements: shared readers, an exclusive writer alone, recursion, pointer size, use with condition variables, FIFO order
            answer: [0, 1, 3, 4],  // the true ones are indexes 0, 1, 3 and 4; recursion and guaranteed order are false
            why: 'SRW locks are small and fast: readers share, a writer is alone, and SleepConditionVariableSRW works with them. They cannot be acquired recursively, and they make no promise about the order in which waiters get the lock.' },  // explanation: what SRW locks do and the two things they do not
          { type: 'order', q: 'Put the steps of a consumer that waits on a condition variable with an SRW lock in order.',  // question 7 (put in order): the steps of a consumer waiting on a condition variable with an SRW lock
            items: ['Acquire the SRW lock', 'Test the condition and find it false', 'SleepConditionVariableSRW releases the lock and sleeps, as one atomic step', 'Another thread changes the data and calls WakeConditionVariable', 'The sleeper re-acquires the lock before its sleep call returns', 'Test the condition again at the top of the while loop'],  // the six steps, written in the correct order (the engine shuffles them for the student)
            why: 'Lock, test, then sleep (which unlocks atomically). After a wake, the sleep call re-acquires the lock before returning, and the while loop re-tests the condition, because it may be false again.' },  // explanation: lock, test, sleep atomically, re-acquire on wake, and re-test in the loop
          { type: 'tf', q: 'When <code>SleepConditionVariableSRW</code> returns, the condition the thread was waiting for is guaranteed to be true.', answer: false,  // question 8 (true or false): the condition is guaranteed true when the sleep call returns; the answer is false
            why: 'Another thread may have changed the data first (a stolen wake-up), and Windows also allows spurious wakeups that nobody sent. That is why the condition is re-tested in a while loop.' },  // explanation: stolen and spurious wakeups are why the condition is re-tested in a while loop
          { type: 'num', q: 'A shared variable <code>x</code> holds 7. A thread calls <code>InterlockedCompareExchange(&amp;x, 9, 4)</code>, with new value 9 and comparand 4. What value does the call return?',  // question 9 (calculate): what InterlockedCompareExchange returns when x is 7 and the comparand is 4
            answer: 7, tol: 0,  // the answer is 7, exactly
            why: 'x (7) does not equal the comparand (4), so nothing is stored and x stays 7. The function always returns the value it found, 7, which tells the caller its swap did not happen.' },  // explanation: no match, so nothing is stored, and the call always returns the value it found
          { q: 'A thread calls <code>WaitForMultipleObjects</code> on a mutex and a semaphore with bWaitAll = TRUE. The mutex becomes free, but the semaphore’s count is still 0. What happens to the mutex?',  // question 10 (multiple choice): what happens to a free mutex during a wait-all that is still missing the semaphore
            choices: ['The thread takes ownership now and keeps it while it waits for the semaphore', 'Windows reserves the mutex for this thread so that no other thread can take it', 'The call returns at once, and its return value reports the mutex’s index', 'Nothing yet: the thread does not take it, so another thread may acquire it meanwhile'],  // the four choices: take it now, reserve it, return at once, or leave it untaken
            answer: 3,  // the right answer is index 3: nothing is taken yet, so another thread may grab it
            feedback: ['That would be hold and wait. Wait-all changes no object until all of them are signaled together.', 'Nothing is reserved. Until every object is signaled, other threads can still acquire the mutex.', 'That is wait-any behaviour. With bWaitAll = TRUE the call waits until all objects are signaled at once.', null],  // feedback for the three wrong choices: hold and wait, nothing is reserved, and returning at once is wait-any behaviour
            why: 'In wait-all mode Windows claims nothing until every object is signaled at the same moment, then claims them all in one step. The waiting thread never holds one object while sleeping on another.' },  // explanation: wait-all claims nothing until every object is signaled together
          { q: 'A thread that owns a Windows mutex terminates without releasing it while another thread waits for that mutex. What happens?',  // question 11 (multiple choice): what a waiter gets when the mutex owner dies without releasing it
            choices: ['The waiter gets ownership, and its wait returns WAIT_ABANDONED as a warning that the data may be inconsistent', 'The mutex stays owned by the dead thread forever, so the waiter is blocked for good', 'The waiter gets ownership with WAIT_OBJECT_0, exactly as if the mutex had been released normally', 'Windows terminates the waiting thread as well, since it depended on the dead one'],  // the four choices: ownership with WAIT_ABANDONED, blocked forever, a normal WAIT_OBJECT_0, or being terminated too
            answer: 0,  // the right answer is index 0: ownership plus the WAIT_ABANDONED warning
            feedback: [null, 'Windows notices that the owner is gone and frees the mutex, so the waiter is not stuck.', 'The waiter does get ownership, but with a different code: Windows warns it that the previous owner died mid-update.', 'Nothing happens to the waiter except that it receives the mutex and a warning.'],  // feedback for the three wrong choices: the waiter is not stuck forever, the return code differs, and the waiter is not ended
            why: 'The mutex becomes abandoned. The next thread to acquire it owns it, but its wait returns WAIT_ABANDONED so it can check or repair the data the dead owner may have left half-changed.' },  // explanation: an abandoned mutex goes to the next waiter with a warning to check the data
          { type: 'num', q: 'A thread calls <code>WaitForMultipleObjects</code> on 4 handles (indexes 0 to 3) with bWaitAll = FALSE. When the wait is satisfied, the objects at index 1 and index 3 are both signaled. What is the return value minus WAIT_OBJECT_0?',  // question 12 (calculate): the return value minus WAIT_OBJECT_0 when objects 1 and 3 are both signaled in wait-any mode
            answer: 1, tol: 0,  // the answer is 1, exactly
            why: 'In wait-any mode the return value identifies the object that satisfied the wait. When several are signaled, it is the one with the lowest index, here 1.' },  // explanation: in wait-any mode the lowest signaled index is reported
        ],  // closes the quiz list
      },  // closes step 10
    ],  // closes the steps list
    notes: `${/* notes: the section's summary text, shown in the Notes panel and in the printed version; it starts here */''}
      <h3>The Windows toolbox</h3>${/* notes heading: the Windows toolbox */''}
      <p>Windows builds synchronization into its object architecture. <b>Dispatcher objects</b> with <b>wait functions</b> are kernel objects: any process holding a handle can use them, and every wait and release is a system call. <b>Critical sections</b>, <b>SRW locks</b> and <b>condition variables</b> live in one process’s memory, serve only its threads, and enter the kernel only when a thread must sleep. <b>Interlocked operations</b> need no lock and never enter the kernel.</p>${/* notes paragraph: kernel dispatcher objects, the user-mode locks, and interlocked operations, and what each costs */''}
      <h3>Wait functions</h3>${/* notes heading: wait functions */''}
      <p><code>WaitForSingleObject(h, ms)</code> waits on one object; <code>WaitForMultipleObjects</code> on several. The call checks the condition: if it holds, it returns at once; if not, the thread enters the <b>Waiting</b> state and uses <b>no processor time</b> until released (no busy waiting). Time limit: <code>INFINITE</code> waits forever, <code>0</code> only tests. Returns: <code>WAIT_OBJECT_0</code> (signaled), <code>WAIT_TIMEOUT</code> (time ran out; do not touch the data), <code>WAIT_ABANDONED</code> (a mutex owner died), <code>WAIT_FAILED</code> (error). Example: limit 2000 ms, event set at 700 ms: the wait returns WAIT_OBJECT_0 after 700 ms, having used 0 ms of processor time.</p>${/* notes paragraph: the two wait calls, the Waiting state, time limits, return values and a worked 700 ms example */''}
      <h3>Dispatcher objects</h3>${/* notes heading: dispatcher objects */''}
      <p>Always <b>signaled</b> or <b>nonsignaled</b>; a waiting thread is released when the object becomes signaled.</p>${/* notes paragraph: the two states and when a waiter is released */''}
      <table>${/* opens the notes table of the eight objects */''}
        <tr><th>Object</th><th>What it is</th><th>Signaled when</th><th>Waiters released</th></tr>${/* table header: object, what it is, when it is signaled, waiters released */''}
        <tr><td>Notification event</td><td>announcement that an event happened</td><td>a thread sets it</td><td>all</td></tr>${/* table row: the notification event releases all waiters when set */''}
        <tr><td>Synchronization event</td><td>the same, but resets itself</td><td>a thread sets it</td><td>one</td></tr>${/* table row: the synchronization event releases one waiter and resets itself */''}
        <tr><td>Mutex</td><td>mutual exclusion, owned by a thread</td><td>the owner releases it</td><td>one</td></tr>${/* table row: the mutex is released by its owner to one waiter */''}
        <tr><td>Semaphore</td><td>counter limiting users of a resource</td><td>count above zero</td><td>one per unit</td></tr>${/* table row: the semaphore is signaled while its count is above zero and releases one waiter per unit */''}
        <tr><td>Waitable timer</td><td>counter for the passage of time</td><td>set time arrives / interval ends</td><td>all</td></tr>${/* table row: the waitable timer releases all waiters when its time arrives */''}
        <tr><td>File</td><td>open file or I/O device</td><td>an I/O operation completes</td><td>all</td></tr>${/* table row: the file releases all waiters when an I/O operation completes */''}
        <tr><td>Process</td><td>running program and its resources</td><td>its last thread terminates</td><td>all</td></tr>${/* table row: the process releases all waiters when its last thread ends */''}
        <tr><td>Thread</td><td>executable entity in a process</td><td>the thread terminates</td><td>all</td></tr>${/* table row: the thread releases all waiters when it terminates */''}
      </table>${/* closes the notes table of objects */''}
      <ul>${/* opens the bullet list of details about the objects */''}
        <li>The first five exist to synchronize; files, processes and threads can also be waited on (e.g. wait for a child process to exit).</li>${/* bullet: five objects exist to synchronize, and three others can also be waited on */''}
        <li>Notification event = manual-reset: stays signaled until <code>ResetEvent</code>, so later waiters pass. Synchronization event = auto-reset: with nobody waiting it stays signaled until one thread waits. Events do not count: a second SetEvent before the first is used is lost.</li>${/* bullet: manual-reset versus auto-reset events, and why a second SetEvent can be lost */''}
        <li>Mutex: only the owner releases it; the owner may re-acquire it (counted); it can be named and shared by processes. If the owner ends without releasing it, it is <b>abandoned</b> and the next owner’s wait returns WAIT_ABANDONED.</li>${/* bullet: the mutex's owner rules, re-acquiring, naming across processes, and abandonment */''}
        <li>Semaphore: <code>ReleaseSemaphore(h, n, ...)</code> adds n; each released waiter takes one unit; a release above the maximum fails. Count 0, three waiters, release 2: two wake, count stays 0.</li>${/* bullet: how ReleaseSemaphore changes the count, with a small worked example */''}
        <li>A synchronization timer releases only one waiter. Windows does not promise first-in, first-out order among waiters.</li>${/* bullet: synchronization timers release one waiter, and Windows promises no waiter order */''}
      </ul>${/* closes the bullet list */''}
      <h3>WaitForMultipleObjects</h3>${/* notes heading: WaitForMultipleObjects */''}
      <p>Up to 64 handles plus the flag bWaitAll. <b>FALSE (any):</b> returns when one object is signaled; return value − WAIT_OBJECT_0 = its index, the <b>lowest index</b> if several are signaled (<code>WAIT_ABANDONED_0</code> + index if it is an abandoned mutex); only that object is claimed. <b>TRUE (all):</b> returns only when all are signaled at once and claims them in one atomic step. Until then it claims nothing, so another thread may take a free mutex; the waiter never holds one object while sleeping on another (no hold and wait).</p>${/* notes paragraph: wait-any (lowest index, one object claimed) versus wait-all (all claimed in one step, no hold and wait) */''}
      <h3>Critical sections</h3>${/* notes heading: critical sections */''}
      <p><code>CRITICAL_SECTION</code>, for the threads of one process: <code>InitializeCriticalSectionAndSpinCount</code>, <code>EnterCriticalSection</code>, <code>LeaveCriticalSection</code>. (1) Free: one interlocked instruction in user mode, no system call. (2) Busy on a multiprocessor: spin up to the <b>spin count</b> (ignored on one processor, where the holder cannot run while you spin). (3) Still busy: sleep on a kernel object until Leave wakes it. Unlike a mutex: no use across processes, no time limit or multi-object wait, no abandonment warning. Illustrative cost (interlocked 1, system call 30, sleep + wake 300): 10% contention, holder done after 100, spin count 4000, 4 processors: mutex 0.9 × 60 + 0.1 × 360 = 90 per lock/unlock, critical section 0.9 × 2 + 0.1 × 102 = 12. Spinning pays only if the holder lets go sooner than a sleep would cost.</p>${/* notes paragraph: the critical section calls, its three paths, how it differs from a mutex, and the worked cost example */''}
      <h3>SRW locks and condition variables</h3>${/* notes heading: SRW locks and condition variables */''}
      <p>An SRW lock is pointer-sized (since Windows Vista), for one process. <b>Shared</b> mode (<code>AcquireSRWLockShared</code>/<code>ReleaseSRWLockShared</code>): many readers at once. <b>Exclusive</b> mode (<code>AcquireSRWLockExclusive</code>/<code>ReleaseSRWLockExclusive</code>): one writer alone. Not recursive: it records no owner, so a holder that asks again waits on itself forever. No promise of waiter order.</p>${/* notes paragraph: SRW lock modes and calls, no recursion and no waiter order */''}
      <p>A condition variable works with a critical section or SRW lock. <code>SleepConditionVariableCS</code>/<code>SleepConditionVariableSRW</code> release the lock and sleep atomically, then re-acquire it before returning. <code>WakeConditionVariable</code> wakes one; <code>WakeAllConditionVariable</code> wakes all. Re-test in a <b>while</b> loop: another thread may take the data first, and <b>spurious wakeups</b> happen.</p>${/* notes paragraph: condition variable calls, wake one versus wake all, and why the test sits in a while loop */''}
      <pre>while (q.count == 0)   // re-test after every wake${/* notes code example, line 1: the while loop that re-tests the condition after every wake */''}
    SleepConditionVariableSRW(&amp;cv, &amp;lk, INFINITE, 0);</pre>${/* notes code example, line 2: the sleep call inside the loop */''}
      <h3>Interlocked operations</h3>${/* notes heading: interlocked operations */''}
      <table>${/* opens the notes table of the four interlocked functions */''}
        <tr><th>Function</th><th>Does, atomically</th><th>Returns</th></tr>${/* table header: function, what it does atomically, what it returns */''}
        <tr><td>InterlockedIncrement(&amp;x)</td><td>x = x + 1</td><td>new value</td></tr>${/* table row: InterlockedIncrement returns the new value */''}
        <tr><td>InterlockedDecrement(&amp;x)</td><td>x = x − 1</td><td>new value</td></tr>${/* table row: InterlockedDecrement returns the new value */''}
        <tr><td>InterlockedExchange(&amp;x, v)</td><td>x = v</td><td>old value</td></tr>${/* table row: InterlockedExchange returns the old value */''}
        <tr><td>InterlockedCompareExchange(&amp;x, v, c)</td><td>x = v only if x == c</td><td>old value, always</td></tr>${/* table row: InterlockedCompareExchange stores only on a match and always returns the old value */''}
      </table>${/* closes the interlocked table */''}
      <p>CompareExchange is chapter 5’s compare_and_swap. x = 7: <code>InterlockedCompareExchange(&amp;x, 9, 4)</code> stores nothing and returns 7. A plain <code>hits++</code> (load, add, store) can lose an update: two threads load 5 and both store 6. A loop that reads old, computes old + 1 and stores only if hits still equals old (else retries) never loses one and never blocks: <b>lock-free synchronization</b>.</p>${/* notes paragraph: the link to compare_and_swap, a worked example, the lost update in hits++, and the lock-free retry loop */''}
      <h3>Choosing a tool</h3>${/* notes heading: choosing a tool */''}
      <p>Across processes: named <b>mutex</b>. N identical resources: <b>semaphore</b>. Tell everyone once: <b>notification event</b>. Wait for a program to exit: its <b>process</b>. Short locking in one process, possibly re-entered: <b>critical section</b>. Read-mostly data: <b>SRW lock</b>. Sleep under a lock until data changes: <b>condition variable</b>. One counter: <b>interlocked operation</b>.</p>`,  // notes paragraph: which tool to choose for each kind of job; the backtick ends the notes text
  });  // closes the object passed to Guide.section, which registers the section
})();  // ends the wrapper function and runs it immediately
