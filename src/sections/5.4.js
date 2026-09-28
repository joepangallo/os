// Comment key: a line inside backtick text ends with ${/* comment */''}, an empty-string slot that holds a comment without changing the text on screen (full note at the top of the page).
/* =====================================================================
   5.4 Semaphores
   Original teaching material. Every step is self-contained; small helpers
   shared by several steps live inside this IIFE (no globals).
   ===================================================================== */
(function () {  // wraps the whole section in a function that runs once, right away, so its helper names stay private to this file
  /* ---------- shared semaphore model (general / counting semaphore) ---------- */
  // wait: returns true when the caller must block (it is appended to the queue)
  function semWaitOp(sem, who) {  // semWaitOp(sem, who): the wait operation on a semaphore object sem = { v: value, q: queue }; who is the caller's name
    sem.v -= 1;  // subtracts 1 from the value first, exactly as the definition of semWait says
    if (sem.v < 0) { sem.q.push(who); return true; }  // a negative result means no unit was free: the caller joins the end of the queue and the function reports "blocked"
    return false;  // otherwise the caller got a unit and may carry on, so the function reports "not blocked"
  }  // ends semWaitOp
  // signal: returns the process that was unblocked, or null if nobody was waiting
  function semSignalOp(sem, pick) {  // semSignalOp(sem, pick): the signal operation; pick is an optional function that chooses which waiter to wake
    sem.v += 1;  // adds 1 to the value first, exactly as the definition of semSignal says
    if (sem.v <= 0 && sem.q.length) {  // a result of zero or less means someone was waiting in the queue, so one of them must be woken
      const i = pick ? pick(sem.q.length) : 0;  // picks the waiter's position: the caller's pick function (a weak semaphore) or position 0, the oldest waiter (strong, FIFO)
      return sem.q.splice(i, 1)[0];  // removes that process from the queue and returns it so the caller can mark it ready again
    }  // ends the "someone was waiting" branch
    return null;  // nobody was waiting, so nothing is woken and the function returns null
  }  // ends semSignalOp
  // plain-language reading of a counting semaphore's value
  function meaning(v) {  // meaning(v): turns a semaphore value into one plain sentence for the on-screen explanation box
    if (v > 0) return `<b>${v}</b> more semWait call${v === 1 ? '' : 's'} can pass without blocking.`;  // a positive value counts how many more semWait calls can pass; the ternary adds an "s" when the count is not 1
    if (v === 0) return 'No units left and <b>nobody waiting</b>: the next semWait will block.';  // zero means no units are left but nobody is waiting yet, so the very next semWait will block
    return `<b>${-v}</b> process${v === -1 ? ' is' : 'es are'} blocked in the queue (the magnitude of ${v}).`;  // a negative value's size (-v) is the number of blocked processes; the ternary picks "is" or "es are" for correct grammar
  }  // ends meaning
  // a rounded process token for SVG diagrams
  function token(s, x, y, label, cls, w = 44, h = 44) {  // token(s, x, y, label, ...): draws a rounded square with a letter, used as a process in SVG (the browser's drawing format) diagrams
    return s('g', {},  // returns an SVG group (g) so the box and its label move and hide together; s is the guide's SVG element builder
      s('rect', { x: x - w / 2, y: y - h / 2, width: w, height: h, rx: 10, class: cls || 's-proc', 'stroke-width': 2 }),  // the rounded box, centred on (x, y); cls picks its colour class, defaulting to the cyan "process" style
      s('text', { x, y: y + 6, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 18 }, label));  // the bold label (usually a process letter) centred inside the box; ends the group
  }  // ends token

  Guide.section({  // registers this section with the guide; the object below holds everything the section shows
    id: '5.4',  // the section number, used in links, the progress list and saved progress
    title: 'Semaphores',  // the full title shown at the top of every step
    short: 'Semaphores',  // the short name used in the side menu and progress list
    summary: 'A semaphore is a counter with wait and signal operations that lets processes block, wake and take turns.',  // one-sentence summary shown on the chapter page
    objectives: [  // what the student should be able to do after this section, shown on its first page
      'Define a semaphore and trace exactly what semWait and semSignal do to its value and its queue.',  // objective 1: define a semaphore and trace semWait and semSignal
      'Read a semaphore\'s value, and tell counting semaphores, binary semaphores, mutexes, and strong versus weak semaphores apart.',  // objective 2: read a semaphore's value and tell the semaphore kinds apart
      'Use one semaphore to enforce mutual exclusion and others to pass signals between producers and consumers.',  // objective 3: use semaphores for mutual exclusion and for signalling
      'Solve the producer/consumer problem for infinite and bounded buffers, and explain why the order of semWait calls matters.',  // objective 4: the producer/consumer problem and why semWait order matters
      'Explain why semWait and semSignal must be atomic and how compare_and_swap or disabling interrupts makes them so.',  // objective 5: why the operations must be atomic and how that is achieved
    ],  // closes the objectives list
    terms: [  // key terms for the glossary, each written as [term, definition]
      ['Semaphore', 'A shared integer variable that processes may touch only through three operations: initialize, semWait and semSignal. Processes use it to wait for, and to send, simple signals.'],  // glossary entry: semaphore and its three allowed operations
      ['semWait', 'The semaphore operation that subtracts 1 from the value. If the result is negative, the calling process is blocked and placed in the semaphore\'s queue.'],  // glossary entry: semWait (subtract 1, block if negative)
      ['semSignal', 'The semaphore operation that adds 1 to the value. If the result is zero or negative, one process waiting in the semaphore\'s queue is unblocked.'],  // glossary entry: semSignal (add 1, wake one waiter if zero or negative)
      ['Binary semaphore', 'A semaphore that can only hold 0 or 1. Its operations are usually written semWaitB and semSignalB.'],  // glossary entry: binary semaphore (only 0 or 1)
      ['Counting semaphore (general semaphore)', 'A semaphore whose value can be any integer, so it can count available units of a resource and, when negative, how many processes are waiting.'],  // glossary entry: counting (general) semaphore
      ['Mutex', 'A lock that behaves like a binary semaphore with one extra rule: the process that locked it (set it to 0) is the only one allowed to unlock it (set it to 1).'],  // glossary entry: mutex, a binary lock that only its owner may release
      ['Strong semaphore', 'A semaphore that releases blocked processes in first-in, first-out order, so the longest waiter goes first and no waiter can starve.'],  // glossary entry: strong semaphore (first-in, first-out release)
      ['Weak semaphore', 'A semaphore that does not say which blocked process is released next, so an unlucky process could be passed over again and again.'],  // glossary entry: weak semaphore (release order not specified)
      ['Starvation', 'A situation in which a process is overlooked indefinitely, even though other processes keep making progress.'],  // glossary entry: starvation
      ['Critical section', 'A piece of code that uses a shared resource. While one process is inside it, no other process may be inside a critical section for that same resource.'],  // glossary entry: critical section
      ['Mutual exclusion', 'The guarantee that while one process is inside a critical section for a resource, no other process is inside a critical section for that same resource.'],  // glossary entry: mutual exclusion
      ['Producer/consumer problem', 'A classic coordination problem: producers put items into a shared buffer and consumers take them out; the buffer must never be corrupted, over-filled, or read when empty.'],  // glossary entry: the producer/consumer problem
      ['Bounded buffer', 'A buffer with a fixed number of slots, usually reused in a circle; a producer must wait when every slot is full.'],  // glossary entry: bounded buffer
      ['Deadlock', 'A permanent standstill in which every process in a group is waiting (blocked or spinning) for something that only another waiting member of the group can provide.'],  // glossary entry: deadlock
      ['Atomic operation', 'An operation that happens as one indivisible unit: no other process can run in the middle of it or see it half-done.'],  // glossary entry: atomic operation
      ['Busy waiting', 'Waiting by running a loop that keeps testing a condition, which burns processor time instead of sleeping.'],  // glossary entry: busy waiting
      ['Spinlock', 'A lock where a process that finds it taken busy-waits (spins) in a loop until the lock becomes free.'],  // glossary entry: spinlock
      ['Condition variable', 'A named queue that a process joins to wait until some condition about shared data becomes true; another process signals it when that happens.'],  // glossary entry: condition variable
      ['Monitor', 'A programming-language construct that packages shared data with the only procedures allowed to use it, and lets just one process be active inside at a time.'],  // glossary entry: monitor
      ['Message passing (mailbox)', 'Coordination by sending and receiving messages. A mailbox is a shared place where messages wait until a receiver collects them.'],  // glossary entry: message passing and mailboxes
    ],  // closes the terms list
    css: ` /* css: style rules used only by this section; every rule starts with .sec-5-4 so it cannot affect other sections */
      .sec-5-4 .tool-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; } /* lays the tool buttons in step 1 out in two equal columns with a small gap */
      .sec-5-4 .tool-grid .btn { justify-content: flex-start; height: 40px; } /* left-aligns each tool button's text and gives all of them the same height so the grid looks even */
      .sec-5-4 .pcard { border: 2px solid var(--proc); background: var(--proc-bg); border-radius: 12px; padding: 8px 10px; display: flex; flex-direction: column; gap: 6px; min-width: 0; } /* process card in the step 3 lab: cyan border and fill, rounded, contents stacked vertically; min-width 0 lets it shrink */
      .sec-5-4 .pcard.blocked { border-color: var(--warn); background: var(--warn-bg); } /* a blocked process card turns amber so a sleeping process stands out at a glance */
      .sec-5-4 .pcard .nm { font-weight: 900; font-size: 20px; line-height: 1; } /* the process letter on a card: large and heavy so each process is easy to find */
      .sec-5-4 .pcard > .row { min-height: 24px; flex-wrap: nowrap; } /* keeps each row on a card at least 24px tall and on one line so the cards stay the same height */
      .sec-5-4 .pcard .st { font-size: 13px; font-weight: 700; color: var(--ink-2); } /* the small status line on a card ("Blocked: asleep" or "Running or Ready") in a softer grey */
      .sec-5-4 .pcard .btn { width: 100%; } /* makes each button on a card fill the card's width */
      .sec-5-4 .valbig { font-size: 44px; font-weight: 900; line-height: 1; font-variant-numeric: tabular-nums; } /* a big-number style with same-width digits so a changing value does not wobble; no current step uses it */
      .sec-5-4 .narr { background: var(--panel-2); border: 1px solid var(--line); border-left: 5px solid var(--chc); border-radius: 12px; padding: 10px 14px; font-size: 15.5px; line-height: 1.45; } /* the explanation box: soft panel with a thick left bar in the chapter colour, readable text size */
      .sec-5-4 .narr.bad { border-left-color: var(--bad); background: var(--bad-bg); } /* explanation box after a mistake: red left bar and a pale red background */
      .sec-5-4 .narr.ok { border-left-color: var(--ok); background: var(--ok-bg); } /* explanation box after a correct result: green left bar and a pale green background */
      .sec-5-4 .log { font-size: 13px; } /* the event log in the step 3 lab uses smaller text so more lines fit */
      .sec-5-4 pre.code.clk { line-height: 1.68; } /* code listings whose lines can be clicked get extra line spacing so each line is an easy target */
      .sec-5-4 pre.code.tight { line-height: 1.38; } /* tighter line spacing for long code listings so they fit without scrolling */
      .sec-5-4 .grid-2 > *, .sec-5-4 .mw0 > * { min-width: 0; } /* lets the children of two-column grids shrink below their content width, so long code does not push the page sideways */
      .sec-5-4 .flip-face.front { font-size: 19px; } /* front of a flip card: large text for the short prompt */
      .sec-5-4 .flip-face.back { font-size: 15.5px; line-height: 1.45; } /* back of a flip card: smaller text with comfortable spacing for the longer answer */
      .sec-5-4 table.trace td { padding: 5px 10px; font-size: 15px; } /* cells in trace tables: roomy padding and readable text */
      .sec-5-4 table.trace th { padding: 6px 10px; } /* header cells in trace tables get matching padding */
      .sec-5-4 pre.code.clk .ln { cursor: pointer; } /* shows a pointing-hand cursor over clickable code lines so students know they can click */
      .sec-5-4 pre.code.clk .ln:hover { background: var(--accent-bg); } /* highlights a clickable code line when the mouse is over it */
      .sec-5-4 pre.code .ln.pick-ok { outline: 2px solid var(--ok); outline-offset: -2px; border-radius: 4px; } /* a correctly picked code line gets a solid green outline */
      .sec-5-4 pre.code .ln.pick-bad { outline: 2px dashed var(--bad); outline-offset: -2px; border-radius: 4px; } /* a wrongly picked code line gets a dashed red outline */
    `,  // end of the section's style rules
    steps: [  // steps: the list of pages in this section, shown one after another with Next and Back
      /* ---------------- 1. Big picture ---------------- */
      {  // step 1 starts here
        title: 'Stop here until you get the signal',  // the step's title, shown at the top of the page
        kind: 'story',  // kind "story" marks this as a Big Picture page, shown in the eyebrow label and always kept on the short route
        html: `${/* html: the fixed page layout for step 1, written as HTML text; render() below fills in the toolbox */''}
          <div class="split fill">${/* two-column layout that fills the step: the story on the left, the toolbox card on the right */''}
            <div class="stack" style="gap:8px">${/* left column: paragraphs stacked with a small gap */''}
              <p class="lead m0">When processes share work, one of them often has to stop and wait until another one says “go”.</p>${/* opening sentence: one process must wait until another says go */''}
              <p class="m0">That is the whole idea of this section. Processes can cooperate using nothing more than simple <b>signals</b>: a process can be forced to halt at a chosen point in its code and stay there until a particular signal arrives. However complicated the coordination you need, from “one at a time, please” to “wait until there is data”, it can be built from the right arrangement of such signals.</p>${/* paragraph: cooperation can be built entirely from simple stop-and-wait signals */''}
              <p class="m0">The variable that carries these signals is a <span class="t">semaphore</span>. To send a signal on semaphore <code>s</code> a process calls <code>semSignal(s)</code>; to receive one it calls <code>semWait(s)</code>. If the signal has not been sent yet, the receiver is suspended until it is.</p>${/* paragraph: names the semaphore and the two calls, semSignal to send and semWait to receive */''}
              <div class="callout analogy m0" data-label="Analogy">A bike-share dock shows how many bikes are free. Taking a bike lowers the number; at zero, new riders queue at the dock; each returned bike lets exactly one waiting rider leave. The number is the semaphore's value, taking is semWait, returning is semSignal.</div>${/* analogy box: a bike-share dock, where the free-bike count plays the semaphore's value */''}
              <div class="row gap-s small"><span class="chip os">run a semaphore by hand</span><span class="chip proc">trace values and queues</span><span class="chip mem">fix a buggy buffer</span><span class="chip intr">cause a deadlock on purpose</span></div>${/* row of chips previewing the hands-on activities later in this section */''}
            </div>${/* ends the left column */''}
            <div class="card stack" style="gap:10px">${/* right column: the card that holds the concurrency toolbox */''}
              <h4 class="m0">The concurrency toolbox</h4>${/* heading of the toolbox card */''}
              <p class="small muted m0">Operating systems and programming languages offer a family of related tools. Click one to see what it is and where you meet it.</p>${/* instruction line: click a tool to read about it */''}
              <div class="tool-grid"></div>${/* empty grid that render() fills with one button per tool */''}
              <div class="card white grow tool-detail" style="display:flex;flex-direction:column;gap:6px"></div>${/* empty detail panel that render() fills with the chosen tool's description */''}
            </div>${/* ends the toolbox card */''}
          </div>`,  // ends the two-column layout and the step 1 HTML text
        render(el, ctx) {  // render(el, ctx): runs when step 1 is shown; el is the page body and ctx gives the guide's helpers
          const { h } = ctx;  // h builds ordinary HTML elements (tag, attributes, children), which is shorter than raw DOM calls
          const tools = [  // tools: the eight coordination tools, each as [name, glossary term, colour class, description, where it is covered]
            ['Semaphore', 'semaphore', 'os', 'An integer shared by processes that can only be initialized, decremented by semWait and incremented by semSignal. A process whose semWait drives the value below zero is blocked until a semSignal releases it.', 'This section.'],  // tool 1: the semaphore itself, covered in this section
            ['Binary semaphore', 'binary semaphore', 'os', 'A semaphore that only ever holds 0 or 1. That is enough for “one at a time” locking and for simple on/off signals.', 'This section.'],  // tool 2: the binary semaphore (only 0 or 1)
            ['Mutex', 'mutex', 'os', 'A lock that behaves much like a binary semaphore, plus an ownership rule: only the process that locked it may unlock it. The rule catches bugs where some other process releases a lock it never held.', 'This section (try it in the playground).'],  // tool 3: the mutex and its ownership rule
            ['Condition variable', 'condition variable', 'proc', 'A named waiting line tied to a condition about shared data, such as “buffer not empty”. A process waits on it until another process signals that the condition may now hold.', 'Section 5.5, inside monitors.'],  // tool 4: the condition variable, met again inside monitors
            ['Monitor', 'monitor', 'proc', 'A language construct that wraps shared data together with the only procedures allowed to touch it, and lets just one process be active inside at a time. Condition variables live inside it.', 'Section 5.5.'],  // tool 5: the monitor
            ['Event flags', null, 'io', 'A memory word in which each bit stands for one event. A process can wait until one chosen flag, or any or all of a group of flags, has been set by someone else; until then it is blocked.', 'Common in real-time and embedded systems; only introduced here.'],  // tool 6: event flags; no glossary term (null) because they are only introduced here
            ['Mailboxes / messages', 'message passing', 'mem', 'Processes exchange information by sending messages; a mailbox holds messages until a receiver collects them. Because a receiver can wait for a message to arrive, messages also synchronize.', 'Section 5.6 (message passing).'],  // tool 7: mailboxes and message passing
            ['Spinlock', 'spinlock', 'intr', 'A lock where a waiting process loops, testing a variable over and over until the lock frees up. Wasteful for long waits, but cheap when the wait lasts only a few instructions.', 'Section 5.3 builds one from compare_and_swap.'],  // tool 8: the spinlock, built in the previous section
          ];  // closes the tools list
          const grid = ctx.$('.tool-grid'), detail = ctx.$('.tool-detail');  // finds the empty grid and detail panel from the HTML above (ctx.$ searches only this step's page)
          const btns = tools.map((t, i) => h('button', { class: 'btn ' + t[2], type: 'button', onclick: () => show(i) }, t[0]));  // makes one button per tool, coloured by its class; clicking a button shows that tool's details
          grid.append(...btns);  // puts all eight buttons into the grid
          function show(i) {  // show(i): fills the detail panel with tool number i and highlights its button
            const [name, term, cls, desc, where] = tools[i];  // unpacks the five fields of the chosen tool into named variables
            btns.forEach((b, j) => b.classList.toggle('on', i === j));  // marks only the clicked button as "on" so the student sees which tool is open
            detail.innerHTML = '';  // empties the detail panel before refilling it
            detail.append(  // adds the new detail content in one call
              h('div', { class: 'row', style: { justifyContent: 'space-between' } },  // top row: tool name on the left, position chip on the right
                h('b', { style: { fontSize: '19px' }, html: term ? `<span class="t" data-t="${term}">${name}</span>` : name }),  // the tool name; when it has a glossary term it is wrapped so hovering it shows the definition
                h('span', { class: 'chip ' + cls }, 'tool ' + (i + 1) + ' of ' + tools.length)),  // chip such as "tool 3 of 8", in the tool's colour
              h('p', { class: 'm0', style: { fontSize: '15.5px' } }, desc),  // the tool's description paragraph
              h('p', { class: 'small muted m0', style: { marginTop: 'auto' } }, h('b', {}, 'Where: '), where));  // the "Where:" line, pushed to the bottom of the panel, saying which section covers the tool
            detail.classList.remove('fade-in'); void detail.offsetWidth; detail.classList.add('fade-in');  // restarts the fade-in animation: removing the class, forcing a layout read, then re-adding it replays the effect
          }  // ends show
          show(0);  // opens the first tool as soon as the step appears, so the panel is never empty
        },  // ends render() for step 1
      },  // ends step 1

      /* ---------------- 2. Definition: value + three operations ---------------- */
      {  // step 2 starts here: the definition of a semaphore, one line of code at a time
        title: 'One integer, three operations',  // the step's title, shown at the top of the page
        kind: 'learn',  // kind "learn" marks this as a Learn page
        render(el, ctx) {  // render(el, ctx): builds the clickable definition and its diagram when step 2 is shown
          const { h, s } = ctx;  // h builds HTML elements and s builds SVG elements
          const src = `${/* src: the semaphore definition in C-like pseudo-code, shown to the student */''}
struct semaphore {              // one semaphore object${/* shown code, line 1: the semaphore is a structure (a record with named fields) */''}
    int count;                  // its integer value${/* shown code, line 2: the integer count field */''}
    queueType queue;            // processes blocked on it${/* shown code, line 3: the queue of blocked processes */''}
};                              // end of the structure${/* shown code, line 4: end of the structure */''}
semaphore s = 2;                // 1) initialize (any value ≥ 0)${/* shown code, line 5: operation 1, creating the semaphore with a starting value */''}
void semWait(semaphore s) {     // 2) "may I continue?"${/* shown code, line 6: operation 2, the start of semWait */''}
    s.count--;                  // always take one unit${/* shown code, line 7: semWait always subtracts one */''}
    if (s.count < 0) {          // negative: nothing was left${/* shown code, line 8: the test for a negative count */''}
        place this process in s.queue; // join the line${/* shown code, line 9: the caller joins the queue */''}
        block this process;     // sleep until released${/* shown code, line 10: the caller is blocked */''}
    }                           // (else: carry straight on)${/* shown code, line 11: end of the negative branch */''}
}                               // end of semWait${/* shown code, line 12: end of semWait */''}
void semSignal(semaphore s) {   // 3) "one unit is free again"${/* shown code, line 13: operation 3, the start of semSignal */''}
    s.count++;                  // always give one unit back${/* shown code, line 14: semSignal always adds one */''}
    if (s.count <= 0) {         // still ≤ 0: someone waits${/* shown code, line 15: the test for zero or less, meaning someone waits */''}
        remove a process P from s.queue; // pick a waiter${/* shown code, line 16: one waiter is taken out of the queue */''}
        place P on the ready list;  // P may run again later${/* shown code, line 17: that waiter is made ready to run */''}
    }                           // (else: nobody to wake)${/* shown code, line 18: end of the wake-up branch */''}
}                               // end of semSignal`;  // shown code, line 19: end of semSignal; ends the src text
          const notes = [  // notes: one explanation per code line, in the same order, shown when the student clicks that line
            'A semaphore is a tiny data structure owned by the operating system (or a thread library). Processes never touch its fields directly; they may only call the three operations below.',  // note for line 1: the semaphore belongs to the OS and is used only through its operations
            'The integer value. Positive means units (permissions, items, free slots) are available; negative means processes are waiting.',  // note for line 2: what positive and negative values mean
            'The processes currently blocked on this semaphore. They use no processor time: they are asleep until a semSignal releases one of them.',  // note for line 3: blocked processes sleep and use no processor time
            'End of the structure: just a number and a waiting line.',  // note for line 4: the structure is just a number and a queue
            '<b>Operation 1: initialize.</b> The value must start at zero or more. Start at 1 for “one at a time”, at N for “N identical resources”, at 0 for “wait until somebody signals”.',  // note for line 5: which starting values fit which jobs
            '<b>Operation 2: semWait.</b> A process calls it when it may continue only if a unit is available.',  // note for line 6: when a process calls semWait
            'The decrement happens <b>every</b> time, whether or not the caller will block. That is exactly why a negative value ends up counting the waiters.',  // note for line 7: the decrement always happens, which is why negatives count waiters
            'If the value is now below zero, there was no unit to take, so the caller cannot continue.',  // note for line 8: below zero means no unit was available
            'The caller is recorded in the semaphore’s queue so that a later semSignal can find it.',  // note for line 9: the caller is recorded so semSignal can find it later
            'The OS moves the caller to the Blocked state and runs some other process. The caller uses no CPU while it waits: there is no busy waiting.',  // note for line 10: the OS blocks the caller, so there is no busy waiting
            'If the value was still zero or more, the caller simply continues with its next statement.',  // note for line 11: otherwise the caller just continues
            'End of semWait. Its caller either continues at once or sleeps here.',  // note for line 12: the two possible outcomes of semWait
            '<b>Operation 3: semSignal.</b> A process calls it to say “one unit is available again”: it released a lock, produced an item or freed a slot.',  // note for line 13: when a process calls semSignal
            'The increment happens every time.',  // note for line 14: the increment always happens
            'If the value is still zero or below after adding 1, it was negative before, which means at least one process is waiting.',  // note for line 15: zero or below after adding means someone was waiting
            'One waiter leaves the queue. Which one depends on the policy: first-in-first-out for a <span class="t">strong semaphore</span>, unspecified for a weak one.',  // note for line 16: which waiter leaves depends on strong or weak policy
            'P becomes Ready. Its semWait is now finished, and it continues after that call when the scheduler gives it the CPU. The caller of semSignal keeps running too.',  // note for line 17: the woken process becomes ready and both keep running
            'If the value came out positive, nobody was waiting; the extra unit is simply remembered in the count.',  // note for line 18: with nobody waiting the extra unit is kept in the count
            'End of semSignal. The caller never blocks inside semSignal.',  // note for line 19: semSignal never blocks its caller
          ];  // closes the notes list
          const code = ctx.ui.code(src, { lang: 'c', fontSize: 13.5 });  // turns src into a highlighted, line-numbered code listing (ctx.ui.code is the guide's code-box helper)
          code.classList.add('clk');  // adds the "clk" style so the code lines show a pointer cursor and a hover highlight
          const lnTitle = h('div', { class: 'row gap-s' });  // row that will show the selected line's number chip
          const lnText = h('div', { class: 'mono small', style: { background: 'var(--panel-3)', borderRadius: '8px', padding: '6px 10px', whiteSpace: 'pre', overflow: 'hidden', textOverflow: 'ellipsis' } });  // box that repeats the selected line's text in a monospace font, cut off with "..." if too long
          const lnNote = h('p', { class: 'm0', style: { fontSize: '16px' } });  // paragraph that will hold the note for the selected line
          let cur = 5;  // cur: the number of the selected code line; starts at 5, the initialize line
          const lines = String(src).replace(/^\n+|\s+$/g, '').split('\n');  // lines: the code split into single lines, trimmed the same way the code box trims it so line numbers match
          let tabs = null;  // tabs will hold the tab strip once it is built below; clicks on code lines use it to switch back to the first tab
          function pick(n) {  // pick(n): selects code line n, highlights it and shows its explanation in the first tab
            cur = ctx.util.clamp(n, 1, lines.length);  // keeps n between 1 and the last line, so Previous and Next stop at the ends (clamp limits a number to a range)
            code.mark(cur);  // highlights the selected line in the code box
            const kind = cur <= 4 ? ['data', 'mem'] : cur === 5 ? ['initialize', 'ok'] : cur <= 12 ? ['semWait', 'proc'] : ['semSignal', 'intr'];  // chooses a label and colour for the line's part of the code: the data structure, initialize, semWait or semSignal
            lnTitle.innerHTML = `<span class="chip">line ${cur} of ${lines.length}</span><span class="chip ${kind[1]}">${kind[0]}</span>`;  // fills the title row with a "line X of 19" chip and a coloured chip naming that part
            lnText.textContent = lines[cur - 1].split('//')[0].trim();  // shows the selected line's code alone, dropping its trailing // comment
            lnNote.innerHTML = notes[cur - 1];  // shows the note written for that line
          }  // ends pick
          code.querySelectorAll('.ln').forEach((ln, i) => ln.addEventListener('click', () => { if (tabs) tabs.show(0); pick(i + 1); }));  // makes every code line clickable: a click opens the first tab and selects that line
          const tabLine = h('div', { class: 'stack', style: { gap: '10px' } },  // tabLine: the contents of the first tab, stacked vertically
            lnTitle, lnText, lnNote,  // the line-number chips, the line's code and its note
            h('div', { class: 'row', style: { marginTop: '4px' } },  // row holding the two stepping buttons
              h('button', { class: 'btn sm', type: 'button', onclick: () => pick(cur - 1) }, '◀ Previous line'),  // Previous line button: moves the selection up one line
              h('button', { class: 'btn sm primary', type: 'button', onclick: () => pick(cur + 1) }, 'Next line ▶')),  // Next line button: moves the selection down one line; ends the row
            h('div', { class: 'callout tip small m0', 'data-label': 'Tip' }, 'Click any line of the code to jump to it.'),  // tip box: clicking any code line jumps to it
            h('div', { class: 'callout why small m0', 'data-label': 'Why a queue instead of a loop?', html: 'A blocked process sleeps and costs nothing until it is released. A process that kept re-testing the value in a loop (<span class="t">busy waiting</span>) would burn processor time for the whole wait, time the process it is waiting for could have used.' }));  // why box: a queue lets a waiting process sleep, while a test-and-retry loop would waste processor time; ends tabLine
          // tab 2: reading the value
          const nl = s('svg', { viewBox: '0 0 440 170', width: '100%' });  // nl: the SVG number line for the second tab, 440 by 170 drawing units, stretched to the tab's width
          const vText = h('p', { class: 'm0', style: { fontSize: '16px', minHeight: '48px' } });  // paragraph under the number line that explains the chosen value in words; a minimum height stops the layout jumping
          let v = 2;  // v: the semaphore value the student is exploring, starting at 2
          function drawValue() {  // drawValue(): redraws the number line, the marker and the units or waiters for the current value v
            const X = (k) => 40 + (k + 3) * 60;  // X(k): converts a value from -3 to 3 into a horizontal position, 60 drawing units apart
            const kids = [s('line', { x1: 25, y1: 50, x2: 415, y2: 50, class: 's-line' })];  // kids: the shapes to draw, starting with the long horizontal axis of the number line
            for (let k = -3; k <= 3; k++) {  // loops over every whole value from -3 to 3
              kids.push(s('line', { x1: X(k), y1: 42, x2: X(k), y2: 58, class: 's-line' }));  // a short tick mark on the axis at value k
              kids.push(s('text', { x: X(k), y: 80, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': k === v ? 800 : 500 }, String(k)));  // the number under the tick, bold when it is the current value
            }  // ends the tick loop
            kids.push(s('path', { d: `M${X(v)} 40 l-9 -16 h18 z`, class: v > 0 ? 's-ok' : v < 0 ? 's-warn' : 's-accent', 'stroke-width': 2 }));  // a triangle marker pointing at the current value: green when positive, amber when negative, accent colour at zero
            kids.push(s('text', { x: 40, y: 20, class: 's-sub', 'font-size': 13 }, '← processes waiting'), s('text', { x: 400, y: 20, class: 's-sub', 'font-size': 13, 'text-anchor': 'end' }, 'units free →'));  // labels at the two ends of the axis: waiting processes to the left, free units to the right
            if (v > 0) for (let k = 0; k < v; k++) kids.push(s('circle', { cx: 220 - (v - 1) * 26 + k * 52, cy: 132, r: 20, class: 's-ok', 'stroke-width': 2 }), s('text', { x: 220 - (v - 1) * 26 + k * 52, y: 138, 'text-anchor': 'middle', 'font-weight': 800 }, '✓'));  // a positive value draws that many green tick circles, centred under the axis, one per free unit
            else if (v < 0) for (let k = 0; k < -v; k++) kids.push(token(s, 220 - (-v - 1) * 28 + k * 56, 132, 'P' + (k + 1), 's-warn', 46, 40));  // a negative value draws that many amber process boxes P1, P2, ... one per blocked process
            else kids.push(s('text', { x: 220, y: 138, 'text-anchor': 'middle', class: 's-sub', 'font-size': 15 }, 'no free units · empty queue'));  // a zero value draws a grey note: no free units and an empty queue
            nl.replaceChildren(...kids);  // swaps the old drawing for the new shapes in one step
            vText.innerHTML = meaning(v);  // writes the plain-language meaning of v under the drawing
          }  // ends drawValue
          const vs = ctx.ui.slider({ label: 'Suppose the value is', min: -3, max: 3, value: v, onInput: (x) => { v = x; drawValue(); } });  // slider from -3 to 3 (ctx.ui.slider is the guide's labelled range control); moving it sets v and redraws
          const tabValue = h('div', { class: 'stack', style: { gap: '8px' } }, vs, nl, vText,  // tabValue: the contents of the second tab: slider, number line and explanation
            h('p', { class: 'small muted m0' }, 'Rule of thumb: a positive value counts how many more processes may call semWait and continue; a negative value’s magnitude counts the processes blocked in the queue.'));  // rule-of-thumb line summarising how to read positive and negative values; ends tabValue
          tabs = ctx.ui.tabs([  // tabs: the three-tab panel on the right (ctx.ui.tabs builds the strip and swaps the panel content)
            { label: 'What this line does', render: (p) => { p.append(tabLine); } },  // tab 1: puts the line-by-line explainer into the panel
            { label: 'Reading the value', render: (p) => { p.append(tabValue); drawValue(); } },  // tab 2: puts the value explorer into the panel and draws the number line fresh
            { label: 'Three consequences', html: `<div class="stack" style="gap:10px">${/* tab 3 starts: its content is fixed HTML text */''}
              <ol class="m0" style="font-size:15.5px;line-height:1.45">${/* numbered list of three consequences of the definition */''}
                <li><b>No peeking.</b> Before it calls semWait, a process cannot know whether it will block. It has no way to read the count first and decide.</li>${/* consequence 1: a process cannot check the count before calling semWait */''}
                <li><b>After a wake-up, both carry on.</b> When semSignal releases a waiter, the signaller and the woken process both continue concurrently. Nothing says which runs first; on one processor the scheduler decides.</li>${/* consequence 2: after a wake-up the signaller and the woken process both continue in no fixed order */''}
                <li><b>A signal is not a receipt.</b> A process calling semSignal learns nothing about whether anyone was waiting: it may have woken one process or none.</li>${/* consequence 3: semSignal does not report whether anyone was waiting */''}
              </ol>${/* ends the list */''}
              <div class="callout warn small m0" data-label="Common mistake">Thinking semSignal wakes <i>every</i> waiter or hands the CPU straight to one. It releases at most one process and only moves it to Ready.</div>${/* common-mistake box: semSignal wakes at most one process and only makes it ready */''}
              <div class="callout why small m0" data-label="Why it matters">Correct semaphore code therefore never depends on which process runs first after a signal, and never tries to test the value directly. The only questions it may ask are “wait” and “signal”.</div></div>` },  // why box: correct code never relies on run order and never reads the value directly; ends tab 3's HTML
          ]);  // closes the tab list and builds the tabs
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: 'minmax(0, 590px) minmax(0, 1fr)' } },  // puts the step on the page: a two-column layout whose left column is at most 590px wide
            h('div', { class: 'stack', style: { gap: '8px' } },  // left column: intro sentence above the code
              h('p', { class: 'm0', html: 'A <span class="t">semaphore</span> is an integer that processes may touch in only three ways: <b>initialize</b> it, <span class="t">semWait</span> on it, or <span class="t">semSignal</span> it.' }),  // intro sentence naming the three allowed operations, with glossary hover terms
              code),  // the clickable code box; ends the left column
            h('div', { class: 'stack fill' }, tabs)));  // right column: the tab panel; ends the layout
          pick(5);  // selects line 5 (initialize) when the step opens so the first tab starts with a real explanation
        },  // ends render() for step 2
      },  // ends step 2

      /* ---------------- 3. Playground ---------------- */
      {  // step 3 starts here: a playground where the student makes four processes call semaphore operations
        title: 'Semaphore playground: you drive four processes',  // the step's title, shown at the top of the page
        kind: 'explore',  // kind "explore" marks this as an Explore page
        core: true,  // core: true keeps this step on the short route through the guide
        render(el, ctx) {  // render(el, ctx): builds the playground when step 3 is shown
          const { h, s } = ctx;  // h builds HTML elements and s builds SVG elements
          const names = ['A', 'B', 'C', 'D'];  // the four process names shown on the cards and in the diagram
          const OPS = { counting: ['semWait', 'semSignal'], binary: ['semWaitB', 'semSignalB'], mutex: ['lock', 'unlock'] };  // OPS: the button labels for each mode: counting semaphore, binary semaphore or mutex
          const rng = ctx.util.seeded(11);  // rng: a seeded random generator (same seed, same sequence every visit) used when a weak semaphore picks a waiter
          let mode = 'counting', policy = 'strong', init = 1, sem, procs, owner;  // playground state: mode, release policy, starting value, the semaphore object, the four processes and the mutex owner
          const svg = s('svg', { viewBox: ctx.narrow ? '0 0 360 330' : '0 0 660 196', width: '100%' });  // the diagram's SVG; on a phone-width screen it uses a taller drawing area so the parts stack vertically
          const cards = h('div', { style: { display: 'grid', gridTemplateColumns: `repeat(${ctx.narrow ? 2 : 4}, minmax(0, 1fr))`, gap: '10px' } });  // cards: grid of the four process cards, two per row on a small screen and four in a row otherwise
          const narr = h('div', { class: 'narr' });  // the explanation box that narrates what the last operation did
          const mean = h('div', { class: 'small', style: { minHeight: '42px' } });  // line under the diagram that explains the current value (from meaning())
          const log = h('div', { class: 'log grow', style: { minHeight: '60px' } });  // the event log; it grows to fill the space and keeps at least 60px of height
          const rules = h('div', { class: 'card tight small', style: { lineHeight: 1.45 } });  // card that states the rules of the current mode
          const RULES = {  // RULES: the rule text for each of the three modes
            counting: '<b>Rules of a <span class="t" data-t="counting semaphore">counting semaphore</span>.</b> semWait: value − 1; if the result is negative, the caller blocks. semSignal: value + 1; if the result is ≤ 0, one waiter is released.',  // rules of a counting semaphore
            binary: '<b>Rules of a binary semaphore.</b> semWaitB: if the value is 1, set it to 0 and go on; if it is 0, block. semSignalB: if someone is blocked, release one (the value stays 0); otherwise set the value to 1.',  // rules of a binary semaphore
            mutex: '<b>Rules of a mutex.</b> lock: like semWaitB, and the caller becomes the <b>owner</b>. unlock: allowed only for the owner; it hands the lock to one released waiter, or sets the value back to 1.',  // rules of a mutex, including the owner rule
          };  // closes RULES
          const semName = () => (mode === 'mutex' ? 'mutex m' : mode === 'binary' ? 'binary semaphore s' : 'semaphore s');  // semName(): the name used in messages for the current mode, e.g. "mutex m" or "semaphore s"
          function say(html, tone) { narr.className = 'narr' + (tone ? ' ' + tone : ''); narr.innerHTML = html; }  // say(html, tone): puts a message in the explanation box; tone "ok" or "bad" colours it green or red
          function logLine(txt) { log.prepend(h('div', {}, txt)); while (log.children.length > 40) log.lastChild.remove(); }  // logLine(txt): adds a line to the top of the event log and drops the oldest lines beyond 40
          function reset(msg) {  // reset(msg): puts the playground back to its starting state, e.g. after changing mode or pressing Reset
            sem = { v: mode === 'mutex' ? 1 : init, q: [] }; owner = null;  // makes a fresh semaphore: a mutex always starts at 1, the others at the chosen starting value; nobody owns it
            procs = names.map((n) => ({ n, blocked: false }));  // makes the four processes, none of them blocked
            log.innerHTML = '';  // empties the event log
            logLine(`start: ${semName()} = ${sem.v}`);  // logs the starting value as the first event
            say(msg || `Reset. The ${semName()} starts at <b>${sem.v}</b>. Pick a process and make it call an operation.`);  // shows the given message, or a default one telling the student what to do next
            draw();  // redraws the diagram and the cards
          }  // ends reset
          const pickFn = () => (policy === 'strong' ? () => 0 : (n) => Math.floor(rng() * n));  // pickFn(): the waiter-choosing rule for semSignalOp: strong always takes position 0, weak takes a random position
          function wake(n) { procs.find((p) => p.n === n).blocked = false; }  // wake(n): marks the process named n as no longer blocked
          function skipNote(w, longest) {  // skipNote(w, longest): extra text for the message when w is woken; longest is who had waited longest
            if (policy === 'strong') return ' (strong semaphore: the longest waiter goes first).';  // strong semaphore: explains that the longest waiter goes first
            if (w !== longest) return `. <b>${longest}</b> had waited longest but was passed over; with a weak semaphore that can happen again and again, which is <span class="t">starvation</span>.`;  // weak semaphore that skipped the longest waiter: explains how that can lead to starvation
            return ' (weak semaphore: this time the pick happened to be the longest waiter).';  // weak semaphore whose random pick happened to be the longest waiter
          }  // ends skipNote
          function doWait(p) {  // doWait(p): runs when process p's first button (semWait, semWaitB or lock) is clicked
            const old = sem.v, W = OPS[mode][0];  // remembers the value before the call for the message, and W, the operation's name in the current mode
            if (mode === 'counting') {  // counting mode uses the shared semWaitOp model from the top of the file
              if (semWaitOp(sem, p.n)) { p.blocked = true; say(`<b>${p.n}</b> calls ${W}(s): value ${old} → <b>${sem.v}</b>. The result is negative, so ${p.n} <b>blocks</b> and joins the queue in position ${sem.q.length}. Its buttons grey out: it sleeps inside ${W} until another process signals.`, 'bad'); }  // semWaitOp reported "blocked": mark p blocked and explain, in red, that it sleeps in the queue at the given position
              else say(`<b>${p.n}</b> calls ${W}(s): value ${old} → <b>${sem.v}</b>. Still zero or more, so ${p.n} <b>continues</b> at once.`, 'ok');  // otherwise the value stayed zero or more: explain, in green, that p continues at once
            } else if (sem.v === 1) {  // binary semaphore or mutex that is currently 1 (open)
              sem.v = 0; if (mode === 'mutex') owner = p.n;  // closes it by setting the value to 0; for a mutex the caller also becomes the owner
              say(`<b>${p.n}</b> calls ${W}: the value was 1, so it becomes <b>0</b> and ${p.n} continues${mode === 'mutex' ? ` as the <b>owner</b> of the mutex` : ''}.`, 'ok');  // explains, in green, that the caller got through (and, for a mutex, now owns it)
            } else {  // binary semaphore or mutex that is currently 0 (closed)
              sem.q.push(p.n); p.blocked = true;  // the caller joins the queue and is marked blocked; the value itself never goes below 0
              const self = mode === 'mutex' && owner === p.n;  // self: true when a mutex owner locks its own mutex again, a classic self-deadlock
              say(self ? `<b>${p.n}</b> already owns the mutex and locks it again, so it blocks <b>waiting for itself</b>. Nobody else is allowed to unlock it: ${p.n} is stuck for good.`  // self-deadlock message: the owner now waits for itself and nobody else may unlock
                : `<b>${p.n}</b> calls ${W}: the value is 0, so ${p.n} <b>blocks</b>. A ${mode === 'mutex' ? 'mutex' : 'binary semaphore'} never goes below 0; the queue alone remembers the waiters.`, 'bad');  // ordinary message: the value is 0, so the caller blocks and only the queue records the waiters
            }  // ends the closed branch
            logLine(`${p.n}: ${W} → ${sem.v}${p.blocked ? '  (' + p.n + ' blocked)' : ''}`);  // writes the event to the log, noting when p blocked
          }  // ends doWait
          function doSignal(p) {  // doSignal(p): runs when process p's second button (semSignal, semSignalB or unlock) is clicked
            const old = sem.v, S = OPS[mode][1], longest = sem.q[0];  // remembers the old value, S (the operation's name) and longest, the process at the front of the queue
            if (mode === 'counting') {  // counting mode uses the shared semSignalOp model
              const w = semSignalOp(sem, pickFn());  // w is the process that was woken, or null; pickFn() supplies the strong or weak choice rule
              if (w) { wake(w); say(`<b>${p.n}</b> calls ${S}(s): value ${old} → <b>${sem.v}</b>. Still zero or below, so one waiter is released: <b>${w}</b> moves to Ready${skipNote(w, longest)} ${p.n} keeps running too.`, 'ok'); }  // someone was woken: mark it ready and explain, in green, who was released and that p keeps running too
              else say(`<b>${p.n}</b> calls ${S}(s): value ${old} → <b>${sem.v}</b>. Positive, so nobody was waiting; the spare unit is simply remembered in the count.`);  // nobody was waiting: the spare unit is simply kept in the count
              logLine(`${p.n}: ${S} → ${sem.v}${w ? '  (' + w + ' woken)' : ''}`);  // writes the event to the log, naming the woken process if there was one
              return;  // counting mode is finished here
            }  // ends the counting branch
            if (mode === 'mutex' && owner !== p.n) {  // a mutex may be unlocked only by its owner, so any other caller is refused
              say(owner ? `<b>Refused.</b> ${p.n} tries to unlock, but <b>${owner}</b> locked the mutex, and only the owner may unlock it. (A plain binary semaphore would have allowed this.)` : `<b>Refused.</b> The mutex is not locked, so there is nothing for ${p.n} to unlock.`, 'bad');  // explains the refusal: someone else owns it, or it is not locked at all
              logLine(`${p.n}: unlock refused`);  // logs the refused unlock
              return;  // stops here without changing anything
            }  // ends the owner check
            let w = null;  // w will hold the woken process, if any, for the binary semaphore or mutex
            if (sem.q.length) { w = sem.q.splice(pickFn()(sem.q.length), 1)[0]; wake(w); if (mode === 'mutex') owner = w; }  // if someone waits, one is taken out by the policy's pick and woken; a mutex's ownership passes to that process
            else if (sem.v === 0) { sem.v = 1; if (mode === 'mutex') owner = null; }  // if nobody waits and the value is 0, it becomes 1 (open); a mutex is then owned by nobody
            if (w) say(`<b>${p.n}</b> calls ${S}: a process is waiting, so the value stays <b>0</b> and <b>${w}</b> is released${mode === 'mutex' ? ' and becomes the new owner' : ''}${skipNote(w, longest)}`, 'ok');  // message for a hand-over: the value stays 0 and the woken process continues (as the new owner for a mutex)
            else if (old === 1) say(`<b>${p.n}</b> calls ${S}: the value was already 1, so it <b>stays 1</b>. A binary semaphore cannot count two signals: the extra one is lost.`, 'bad');  // message for a lost signal: the value was already 1, and a binary semaphore cannot count past 1
            else say(`<b>${p.n}</b> calls ${S}: nobody is waiting, so the value becomes <b>1</b>${mode === 'mutex' ? ' and the mutex is free again' : ''}.`);  // message for a normal release: the value becomes 1 and the lock is free again
            logLine(`${p.n}: ${S} → ${sem.v}${w ? '  (' + w + ' woken)' : ''}`);  // writes the event to the log, naming the woken process if there was one
          }  // ends doSignal
          function act(p, isWait) {  // act(p, isWait): the click handler behind every card button
            if (p.blocked) return;  // a blocked process cannot do anything, so its clicks are ignored (its buttons are also disabled)
            if (isWait) doWait(p); else doSignal(p);  // runs the wait-type or signal-type operation for p
            if (procs.every((x) => x.blocked)) say('All four processes are <b>blocked</b>. Nobody is left to call a signal operation, so they will sleep forever. Press <b>Reset</b>.', 'bad');  // if every process is now blocked, nobody can ever signal again: explain the deadlock and suggest Reset
            draw();  // redraws the diagram and cards to show the new state
          }  // ends act
          // layout: side by side on a wide canvas, stacked (value above queue) on phones so the labels stay readable
          const G = ctx.narrow  // G: positions of every part of the diagram, chosen for the screen size
            ? { nm: [180, 18], box: [100, 28, 160, 110], val: [180, 102, 56], lab: [180, 128], own: [180, 160], arrow: null, qt: [180, 190], qbox: [6, 200, 348, 104], qx: (k) => 50 + k * 87, qy: 246, qs: 66, ord: 294, none: [180, 322] }  // phone-width layout: the value box on top and the queue underneath, with no arrow between them
            : { nm: [110, 20], box: [16, 30, 188, 132], val: [110, 112, 60], lab: [110, 146], own: [110, 186], arrow: [208, 96, 246, 96], qt: [450, 20], qbox: [252, 30, 396, 132], qx: (k) => 300 + k * 96, qy: 90, qs: 70, ord: 148, none: [450, 186] };  // wide layout: the value box on the left, an arrow, then the queue box on the right
          function draw() {  // draw(): rebuilds the diagram, the four process cards and the explanation lines from the current state
            const kids = [];  // kids: the SVG shapes of the new diagram
            kids.push(s('text', { x: G.nm[0], y: G.nm[1], 'text-anchor': 'middle', 'font-weight': 700, 'font-size': 15 }, semName()));  // the semaphore's name above its box
            kids.push(s('rect', { x: G.box[0], y: G.box[1], width: G.box[2], height: G.box[3], rx: 16, class: 's-os', 'stroke-width': 2.5 }));  // the box that holds the value, drawn in the operating-system colour
            kids.push(s('text', { x: G.val[0], y: G.val[1], 'text-anchor': 'middle', 'font-weight': 900, 'font-size': G.val[2], style: `fill:var(${sem.v < 0 ? '--warn' : sem.v > 0 ? '--ok' : '--os'})` }, String(sem.v)));  // the value itself in large type: green when positive, amber when negative, the box colour at zero
            kids.push(s('text', { x: G.lab[0], y: G.lab[1], 'text-anchor': 'middle', class: 's-sub', 'font-size': 14 }, 'value'));  // small "value" label under the number
            if (mode === 'mutex') kids.push(s('text', { x: G.own[0], y: G.own[1], 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700 }, 'owner: ' + (owner || 'none')));  // for a mutex, a line showing who owns it
            if (G.arrow) kids.push(s('line', { x1: G.arrow[0], y1: G.arrow[1], x2: G.arrow[2], y2: G.arrow[3], class: 's-line', 'marker-end': 'url(#arr)' }));  // on wide screens, an arrow from the value box to the queue; "arr" is an arrowhead shared by the whole guide
            kids.push(s('text', { x: G.qt[0], y: G.qt[1], 'text-anchor': 'middle', 'font-weight': 700, 'font-size': 15 }, policy === 'strong' ? 'blocked queue (strong: first in, first out)' : (ctx.narrow ? 'blocked (weak: any order)' : 'blocked processes (weak: released in any order)')));  // the queue's title, which names the release policy; a shorter title is used on a small screen
            kids.push(s('rect', { x: G.qbox[0], y: G.qbox[1], width: G.qbox[2], height: G.qbox[3], rx: 16, class: 's-panel', 'stroke-width': 2 }));  // the box that holds the queue
            for (let k = 0; k < 4; k++) {  // draws the four queue slots
              const x = G.qx(k), n = sem.q[k], hs = G.qs / 2;  // x is the slot's position, n the process waiting there (if any), hs half the slot size
              if (n) kids.push(token(s, x, G.qy, n, 's-warn', G.qs, G.qs));  // an occupied slot shows the waiting process as an amber box
              else kids.push(s('rect', { x: x - hs, y: G.qy - hs, width: G.qs, height: G.qs, rx: 10, class: 's-muted', 'stroke-dasharray': '5 5' }));  // an empty slot is a grey dashed outline
              if (policy === 'strong') kids.push(s('text', { x, y: G.ord, 'text-anchor': 'middle', class: 's-sub', 'font-size': 13 }, k === 0 ? 'front' : ['', '2nd', '3rd', '4th'][k]));  // with a strong semaphore, a label under each slot shows its place in line: front, 2nd, 3rd, 4th
            }  // ends the slot loop
            if (!sem.q.length) kids.push(s('text', { x: G.none[0], y: G.none[1], 'text-anchor': 'middle', class: 's-sub', 'font-size': 14 }, 'nobody is waiting'));  // if the queue is empty, a grey note says nobody is waiting
            svg.replaceChildren(...kids);  // replaces the old drawing with the new one in one step
            cards.replaceChildren(...procs.map((p) => h('div', { class: 'pcard' + (p.blocked ? ' blocked' : '') },  // rebuilds the four process cards; a blocked process gets the amber "blocked" card style
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'nm' }, p.n), owner === p.n ? h('span', { class: 'chip os' }, 'owner') : null),  // card top row: the process letter, plus an "owner" chip when it holds the mutex
              h('div', { class: 'st', title: p.blocked ? 'Asleep inside its wait call: it can do nothing until another process signals.' : null }, p.blocked ? 'Blocked: asleep' : 'Running or Ready'),  // card status line; when blocked, hovering it explains that the process is asleep inside its wait call
              h('button', { class: 'btn sm', type: 'button', disabled: p.blocked, onclick: () => act(p, true) }, OPS[mode][0]),  // the card's wait-type button, disabled while the process is blocked
              h('button', { class: 'btn sm', type: 'button', disabled: p.blocked, onclick: () => act(p, false) }, OPS[mode][1]))));  // the card's signal-type button, also disabled while blocked; ends the cards
            if (mode === 'counting') mean.innerHTML = '<b>Right now:</b> ' + meaning(sem.v);  // counting mode: the line under the diagram explains the value with meaning()
            else mean.innerHTML = `<b>Right now:</b> ${sem.v === 1 ? '1 means open: the next ' + OPS[mode][0] + ' passes.' : '0 means closed: the next ' + OPS[mode][0] + ' blocks.'} ${sem.q.length ? sem.q.length + ' waiting.' : 'Nobody waiting.'}`;  // binary and mutex modes: explains 1 as open and 0 as closed, then says how many are waiting
            if (rules.dataset.mode !== mode) { rules.dataset.mode = mode; rules.innerHTML = RULES[mode]; }  // rewrites the rules card only when the mode has changed, remembering the mode on the element itself
          }  // ends draw
          const initSl = ctx.ui.slider({ label: 'Start value', min: 0, max: 3, value: init, onInput: (v) => { init = v; reset(); } });  // slider for the starting value (0 to 3); moving it changes init and resets the playground
          initSl.style.minWidth = '230px';  // gives the slider enough width that its label and value do not wrap
          const modeSeg = ctx.ui.seg([{ value: 'counting', label: 'Counting' }, { value: 'binary', label: 'Binary' }, { value: 'mutex', label: 'Mutex' }], mode, (v) => {  // segmented buttons to choose the mode: counting, binary or mutex (ctx.ui.seg is the guide's button-group helper)
            mode = v;  // remembers the chosen mode
            initSl.input.max = mode === 'counting' ? 3 : 1;  // a counting semaphore may start as high as 3; binary and mutex only as high as 1
            if (mode !== 'counting' && init > 1) { init = 1; initSl.set(1); }  // if the old start value is too big for a binary mode, lowers it to 1 and moves the slider
            if (mode === 'mutex') initSl.set(1);  // a mutex always starts at 1, so the slider shows 1
            initSl.input.disabled = mode === 'mutex';  // the slider is locked for a mutex because its start value is fixed
            reset(mode === 'mutex' ? 'A <span class="t">mutex</span> always starts unlocked (1). Whoever locks it becomes its owner, and only the owner may unlock it.' : mode === 'binary' ? 'A <span class="t">binary semaphore</span> holds only 0 or 1. Try signalling twice with nobody waiting.' : null);  // resets with a message introducing the chosen mode (the counting mode uses the default message)
          });  // ends the mode handler
          const polSeg = ctx.ui.seg([{ value: 'strong', label: 'Strong (FIFO)' }, { value: 'weak', label: 'Weak (any order)' }], policy, (v) => {  // segmented buttons to choose the release policy: strong (first in, first out) or weak (any order)
            policy = v;  // remembers the chosen policy
            say(v === 'strong' ? '<span class="t">Strong semaphore</span>: waiters are released in the order they arrived, so nobody can be skipped forever.' : '<span class="t">Weak semaphore</span>: the order of release is unspecified (this simulation picks at random). Block three processes, then signal and watch who wakes.');  // explains the chosen policy and, for weak, suggests an experiment that shows skipping
            draw();  // redraws so the queue title and order labels match the policy
          });  // ends the policy handler
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },  // puts the playground on the page as a vertical stack that fills the step
            h('div', { class: 'row', style: { gap: '14px' } }, h('span', { class: 'small b' }, 'Type'), modeSeg, h('span', { class: 'small b' }, 'Wake order'), polSeg, initSl,  // top control row: mode buttons, wake-order buttons and the start-value slider
              h('button', { class: 'btn sm', type: 'button', onclick: () => reset() }, 'Reset')),  // Reset button; ends the control row
            h('div', { class: 'split grow', style: { gridTemplateColumns: 'minmax(0, 7fr) minmax(0, 5fr)', gap: '18px' } },  // main area: two columns, the left a little wider than the right
              h('div', { class: 'stack', style: { gap: '10px' } }, h('div', { class: 'card white tight' }, svg), cards, log),  // left column: the diagram in a white card, then the process cards, then the event log
              h('div', { class: 'stack', style: { gap: '10px' } },  // right column starts
                h('h4', { class: 'm0' }, 'What just happened'), narr, mean, rules,  // heading, the explanation box, the value line and the rules card
                h('div', { class: 'card tight small' }, h('b', {}, 'Try these'),  // card of suggested experiments
                  h('ol', { class: 'm0', style: { paddingLeft: '20px' } },  // numbered list of experiments
                    h('li', {}, 'Counting, start 1: block three processes. What is the value?'),  // experiment 1: block three processes on a counting semaphore and read the value
                    h('li', {}, 'Now signal three times. Who wakes, in what order?'),  // experiment 2: signal three times and watch the wake-up order
                    h('li', {}, 'Weak: repeat 1 and 2. Is the longest waiter ever skipped?'),  // experiment 3: repeat with a weak semaphore and look for skipping
                    h('li', {}, 'Binary: signal twice with nobody waiting.'),  // experiment 4: see a binary semaphore lose an extra signal
                    h('li', {}, 'Mutex: let A lock, then let B try to unlock.')))))));  // experiment 5: see a mutex refuse an unlock by a non-owner; closes the list, the cards, the columns and the page
          reset();  // starts the playground in its initial state as soon as the step appears
        },  // ends render() for step 3
      },  // ends step 3

      /* ---------------- 4. Predict the trace: one producer, three consumers ---------------- */
      {  // step 4 starts here: the student predicts the semaphore value after each call in a fixed trace
        title: 'Predict the trace: one producer, three consumers',  // the step's title, shown at the top of the page
        kind: 'predict',  // kind "predict" marks this as a Predict page
        render(el, ctx) {  // render(el, ctx): builds the trace table, the diagram and the answer buttons when step 4 is shown
          const { h, s } = ctx;  // h builds HTML elements and s builds SVG elements
          // D produces results (each semSignal announces one); A, B, C consume them (each semWait claims one). s starts at 1.
          const PRODUCER = 'D';  // D is the one producer; the others are consumers (used for colours and labels)
          const ops = [['A', 'W'], ['B', 'W'], ['D', 'S'], ['C', 'W'], ['A', 'W'], ['B', 'W'], ['D', 'S'], ['D', 'S'], ['D', 'S'], ['D', 'S']];  // ops: the ten calls in the trace, in order, as [process, W for semWait or S for semSignal]
          const says = [  // says: the explanation shown after each of the ten calls, in the same order
            'A takes the result that was already there: 1 → 0. Zero is not negative, so A continues (and later goes back to the ready queue).',  // explanation for call 1: A takes the waiting result, 1 to 0, and continues
            'B wants a result, but none is left: 0 → −1. Negative, so B <b>blocks</b>. The −1 says one process is waiting, and D now gets the CPU.',  // explanation for call 2: B finds nothing, 0 to -1, and blocks
            'D finishes a new result and signals: −1 → 0. The result is still ≤ 0, which means a waiter exists: <b>B is released</b> to Ready and will use the new result.',  // explanation for call 3: D signals, -1 to 0, and B is released
            'C wants a result: 0 → −1. Nothing is spare, so C blocks.',  // explanation for call 4: C blocks, 0 to -1
            'A comes back for more: −1 → −2. A blocks behind C.',  // explanation for call 5: A blocks behind C, -1 to -2
            'B asks again: −2 → −3. Three consumers are asleep, and the magnitude 3 is exactly the queue length. Only D can run now.',  // explanation for call 6: B blocks too, -2 to -3; the magnitude equals the queue length
            'D signals: −3 → −2. The front of the queue, <b>C</b>, is released (strong semaphore: first in, first out).',  // explanation for call 7: D signals and C, at the front, is released first
            'D signals again: −2 → −1. <b>A</b> is released.',  // explanation for call 8: D signals and A is released
            'D signals again: −1 → 0. <b>B</b> is released and the queue is empty.',  // explanation for call 9: D signals, B is released and the queue empties
            'D signals once more: 0 → 1. Nobody is waiting, so the result is <b>saved in the count</b>. The next consumer to call semWait will pass straight through.',  // explanation for call 10: D signals with nobody waiting, so the value rises to 1
          ];  // closes the says list
          // simulate so every number shown is computed, not typed
          const states = [{ v: 1, q: [] }];  // states: the value and queue before the trace and after each call; the starting state is value 1, empty queue
          { const sem = { v: 1, q: [] }; ops.forEach(([p, o]) => { if (o === 'W') semWaitOp(sem, p); else semSignalOp(sem); states.push({ v: sem.v, q: sem.q.slice() }); }); }  // runs the ten calls through the shared semaphore model once, recording a copy of the state after each call
          let r = 0, guesses = [];  // r is the row the student is on (0 to 10); guesses keeps each answer, or null when the student asked to be shown
          const tbody = h('tbody');  // the body of the trace table, rebuilt by drawTable()
          const prompt = h('div', { class: 'b', style: { fontSize: '17px', minHeight: '26px' } });  // the question line above the answer buttons
          const choices = h('div', { class: 'row gap-s' });  // the row of answer buttons
          const narr = h('div', { class: 'narr', style: { minHeight: '92px' } });  // the explanation box for the latest answer, with a fixed minimum height so the page does not jump
          const score = h('span', { class: 'chip accent' });  // chip showing how many answers were right so far
          const svg = s('svg', { viewBox: ctx.narrow ? '0 0 360 256' : '0 0 520 250', width: '100%' });  // the diagram's SVG; a phone-width screen uses a slightly different drawing area
          const opText = (i) => `${ops[i][0]} calls ${ops[i][1] === 'W' ? 'semWait(s)' : 'semSignal(s)'}`;  // opText(i): describes call i in words, e.g. "B calls semWait(s)"
          function drawTable() {  // drawTable(): rebuilds the trace table from the calls answered so far
            const rows = [h('tr', {}, h('td', {}, '0'), h('td', {}, 'start (one result is waiting)'), h('td', {}, '—'), h('td', { class: 'b mono' }, '1'), h('td', { class: 'mono' }, '—'))];  // row 0: the start, with value 1 and no queue
            ops.forEach((o, i) => {  // one row for each of the ten calls
              const done = i < r, g = guesses[i];  // done tells whether the row has been answered; g is the student's guess for it
              const gCell = !done ? '' : g == null ? h('span', { class: 'muted' }, 'shown') : h('span', { class: 'chip ' + (g === states[i + 1].v ? 'ok' : 'bad') }, (g === states[i + 1].v ? '✓ ' : '✗ ') + g);  // guess cell: empty until answered, "shown" if the student skipped, otherwise a green tick or red cross with the guess
              rows.push(h('tr', { class: i === r ? 'on' : '' },  // the current row is highlighted with the "on" class
                h('td', {}, String(i + 1)),  // row number
                h('td', { class: 'mono', style: { color: o[0] === PRODUCER ? 'var(--mem)' : 'var(--proc)', fontWeight: 700 } }, opText(i)),  // the call, coloured in the producer colour for D and the process colour for the consumers
                h('td', {}, gCell),  // the guess cell
                h('td', { class: 'b mono' }, done ? String(states[i + 1].v) : '?'),  // the true value after the call, or "?" until the row is answered
                h('td', { class: 'mono' }, done ? (states[i + 1].q.join(' ') || '—') : '')));  // the queue after the call (front first), a dash if empty, or blank until answered
            });  // ends the row loop
            tbody.replaceChildren(...rows);  // swaps in the new rows in one step
          }  // ends drawTable
          // wide and phone layouts share one drawing; only the coordinates change
          const D = ctx.narrow  // D: diagram positions; the first set is for a phone-width screen, the second for a wide screen
            ? { px: (k) => 45 + k * 90, tk: 56, ty: 44, role: 96, state: 114, box: [6, 132, 104, 100], eq: 152, val: [58, 210, 42], qt: [122, 150], qx: (k) => 152 + k * 64, qy: 192, qw: 54, cnt: [240, 248] }  // phone-width positions: process tokens, value box, queue slots and the count label, packed closer together
            : { px: (k) => 70 + k * 125, tk: 62, ty: 50, role: 108, state: 126, box: [10, 146, 130, 96], eq: 168, val: [75, 222, 46], qt: [160, 164], qx: (k) => 192 + k * 72, qy: 206, qw: 56, cnt: [420, 212] };  // wide positions for the same parts of the drawing
          function drawDiagram() {  // drawDiagram(): draws the four processes, the value box and the queue for the current row
            const st = states[r], next = r < ops.length ? ops[r][0] : null;  // st is the state before the next call; next is the process that acts next, or null when the trace is done
            const kids = [];  // kids: the SVG shapes of the new diagram
            ['A', 'B', 'C', 'D'].forEach((n, k) => {  // draws each of the four processes in a row
              const x = D.px(k), blocked = st.q.includes(n), hl = D.tk / 2 + 8;  // x is its position; blocked tells whether it is in the queue; hl is half the size of its highlight frame
              const cls = blocked ? 's-warn' : n === PRODUCER ? 's-mem' : 's-proc';  // colour: amber when blocked, memory colour for the producer, process colour for a consumer
              if (n === next) kids.push(s('rect', { x: x - hl, y: D.ty - hl, width: 2 * hl, height: 2 * hl, rx: 16, class: 's-accent', 'stroke-width': 3 }));  // the process that acts next gets a thick accent-coloured frame around it
              kids.push(token(s, x, D.ty, n, cls, D.tk, D.tk));  // the process token itself
              kids.push(s('text', { x, y: D.role, 'text-anchor': 'middle', 'font-size': 14, class: 's-sub' }, n === PRODUCER ? 'producer' : 'consumer'));  // its role under it: producer or consumer
              kids.push(s('text', { x, y: D.state, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700, style: blocked ? 'fill:var(--warn)' : '' }, blocked ? 'blocked' : n === next ? 'acts next' : 'ready'));  // its state under that: blocked (in amber), acts next, or ready
            });  // ends the process loop
            kids.push(s('rect', { x: D.box[0], y: D.box[1], width: D.box[2], height: D.box[3], rx: 14, class: 's-os', 'stroke-width': 2 }));  // the box that holds the semaphore value
            kids.push(s('text', { x: D.val[0], y: D.eq, 'text-anchor': 'middle', 'font-size': 14, class: 's-sub' }, 's ='));  // the "s =" label inside the box
            kids.push(s('text', { x: D.val[0], y: D.val[1], 'text-anchor': 'middle', 'font-size': D.val[2], 'font-weight': 900 }, String(st.v)));  // the value itself in large type
            kids.push(s('text', { x: D.qt[0], y: D.qt[1], 'font-size': 14, class: 's-sub' }, ctx.narrow ? 'blocked queue (front at left)' : 'blocked queue (front on the left)'));  // the queue's title; a shorter wording is used on a small screen
            for (let k = 0; k < 3; k++) {  // draws three queue slots, enough for this trace
              const x = D.qx(k);  // x is the slot's position
              if (st.q[k]) kids.push(token(s, x, D.qy, st.q[k], 's-warn', D.qw, 52));  // an occupied slot shows the waiting process as an amber token
              else kids.push(s('rect', { x: x - D.qw / 2, y: D.qy - 26, width: D.qw, height: 52, rx: 10, class: 's-muted', 'stroke-dasharray': '4 4' }));  // an empty slot is a grey dashed outline
            }  // ends the slot loop
            kids.push(s('text', { x: D.cnt[0], y: D.cnt[1], 'font-size': 15, 'font-weight': 700, 'text-anchor': 'middle' }, st.v > 0 ? st.v + ' spare result' + (st.v > 1 ? 's' : '') : st.v === 0 ? 'none spare' : -st.v + ' waiting'));  // a summary label: how many results are spare, "none spare", or how many are waiting
            svg.replaceChildren(...kids);  // replaces the old drawing with the new one
          }  // ends drawDiagram
          function drawPrompt() {  // drawPrompt(): updates the score, the question and the answer buttons for the current row
            const right = guesses.filter((g, i) => g != null && g === states[i + 1].v).length;  // counts the guesses that matched the true value
            score.textContent = `${right} of ${r} correct`;  // shows the score, e.g. "3 of 5 correct"
            if (r >= ops.length) {  // after the last call the trace is complete
              prompt.innerHTML = 'Trace complete.';  // says the trace is done
              choices.replaceChildren(h('button', { class: 'btn sm primary', type: 'button', onclick: restart }, 'Start again'));  // offers a single Start again button in place of the answer buttons
              return;  // nothing more to draw
            }  // ends the completed branch
            prompt.innerHTML = `Row ${r + 1}: ${opText(r)}. What is <span class="mono">s</span> now?`;  // asks the question for the current row, e.g. "Row 4: C calls semWait(s). What is s now?"
            choices.replaceChildren(...[-3, -2, -1, 0, 1, 2].map((v) => h('button', { class: 'btn sm', type: 'button', style: { minWidth: '44px' }, onclick: () => answer(v) }, String(v))),  // one button per possible value from -3 to 2; clicking one submits it as the answer
              h('button', { class: 'btn sm ghost', type: 'button', onclick: () => answer(null) }, 'Just show me'));  // a Just show me button that reveals the answer without guessing
          }  // ends drawPrompt
          function answer(g) {  // answer(g): records the student's answer g for the current row (null means "just show me")
            if (r >= ops.length) return;  // ignores clicks after the trace is complete
            guesses[r] = g;  // stores the guess for this row
            const actual = states[r + 1].v;  // actual: the true value after this call, taken from the simulation
            const verdict = g == null ? '' : g === actual ? '<b style="color:var(--ok)">Correct.</b> ' : `<b style="color:var(--bad)">Not quite: s is ${actual}.</b> `;  // verdict text: nothing when shown, "Correct." in green, or the true value in red
            narr.className = 'narr' + (g == null ? '' : g === actual ? ' ok' : ' bad');  // colours the explanation box: neutral when shown, green when right, red when wrong
            narr.innerHTML = verdict + says[r];  // shows the verdict followed by the explanation for this call
            r++;  // moves on to the next row
            paint();  // redraws the table, the diagram and the prompt
          }  // ends answer
          function restart() { r = 0; guesses = []; narr.className = 'narr'; narr.innerHTML = 'Predict each value before you reveal it. semWait always subtracts 1 and blocks its caller if the result is negative. semSignal always adds 1 and releases the front waiter if the result is ≤ 0 (which means the value was negative).'; paint(); }  // restart(): clears all answers, goes back to row 0 and shows the opening instructions with the two rules
          function paint() { drawTable(); drawDiagram(); drawPrompt(); }  // paint(): redraws everything on this step: the table, the diagram and the prompt
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: 'minmax(0, 11fr) minmax(0, 10fr)', gap: '22px' } },  // puts the step on the page: two columns, the left one slightly wider
            h('div', { class: 'stack', style: { gap: '8px' } },  // left column starts
              h('p', { class: 'm0 small', html: '<b>Setup.</b> Processes <b style="color:var(--proc)">A, B, C</b> each need a result that process <b style="color:var(--mem)">D</b> produces. D announces each new result with <code>semSignal(s)</code>; a consumer claims one with <code>semWait(s)</code>. <code>s</code> starts at 1 because one result is already waiting. It is a <span class="t">strong semaphore</span>, so waiters leave in arrival order.' }),  // setup paragraph: D produces results, A, B and C consume them, and s starts at 1 as a strong semaphore
              h('table', { class: 'tbl trace' }, h('thead', {}, h('tr', {}, h('th', {}, '#'), h('th', {}, 'Operation'), h('th', {}, 'Your guess'), h('th', {}, 's'), h('th', {}, 'Queue'))), tbody)),  // the trace table with its five column headings; its body is tbody, filled by drawTable(); ends the left column
            h('div', { class: 'stack', style: { gap: '10px' } },  // right column starts
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'Your prediction'), score),  // heading "Your prediction" with the score chip on the right
              prompt, choices, narr, h('div', { class: 'card white tight grow', style: { display: 'grid', placeItems: 'center' } }, svg))));  // question, answer buttons, explanation box and the diagram in a white card; ends the page
          restart();  // starts the trace from row 0 as soon as the step appears
        },  // ends render() for step 4
      },  // ends step 4

      /* ---------------- 5. Mutual exclusion with one semaphore ---------------- */
      {  // step 5 starts here: a lab where three processes share one critical section guarded by one semaphore
        title: 'Mutual exclusion with a single semaphore',  // the step's title, shown at the top of the page
        kind: 'lab',  // kind "lab" marks this as a Hands-on Lab page
        render(el, ctx) {  // render(el, ctx): builds the lab when step 5 is shown
          const { h, s } = ctx;  // h builds HTML elements and s builds SVG elements
          const codeSrc = (v) => `${/* codeSrc(v): the program shown to the student, with v as the semaphore's starting value */''}
semaphore s = ${v};          // ${v} = ${v === 1 ? 'room is free' : 'two may enter!'}${/* shown code, line 1: creates s with the chosen start value; the comment says whether that is safe */''}
void P(int i) {           // A, B and C all run this${/* shown code, line 2: the procedure that every process runs */''}
    while (true) {        // repeat forever${/* shown code, line 3: the endless loop */''}
        semWait(s);       // ask to enter; may block${/* shown code, line 4: semWait before entering */''}
        /* critical section */  // use the shared data${/* shown code, line 5: the critical section */''}
        semSignal(s);     // leave; wake one waiter${/* shown code, line 6: semSignal after leaving */''}
        /* remainder */   // private work${/* shown code, line 7: the remainder, work that touches nothing shared */''}
    }                     // end of loop${/* shown code, line 8: end of the loop */''}
}                         // end of P${/* shown code, line 9: end of the procedure */''}
void main() {             // program start${/* shown code, line 10: the main program */''}
    parbegin (P(1), P(2), P(3)); // run all three${/* shown code, line 11: parbegin starts all three processes running at the same time */''}
}                         // end of main`;  // shown code, line 12: end of main; ends the program text
          let code = ctx.ui.code(codeSrc(1), { lang: 'c', fontSize: 13.5 });  // the code box for a start value of 1; "let" because it is swapped out when the start value changes
          const names = ['A', 'B', 'C'];  // the three process names
          let init = 1, sem, where, hist, runId = 0;  // lab state: start value, semaphore, where each process is, the value history, and runId to cancel an animated trace
          const svg = s('svg', { viewBox: ctx.narrow ? '0 0 360 256' : '0 0 600 168', width: '100%' });  // the three-zone diagram's SVG; a phone-width screen stacks the zones vertically
          const btnRow = h('div', { class: 'grid-3', style: { gap: '8px' } });  // row of three buttons, one per process
          const histEl = h('div', { class: 'row gap-s', style: { minHeight: '28px' } });  // strip that shows the semaphore's value over time
          const narr = h('div', { class: 'narr', style: { minHeight: '70px' } });  // the explanation box for the last action
          const inv = h('div', { class: 'row gap-s' });  // row of status chips: how many are inside, how many are blocked, and the value
          function reset(msg) {  // reset(msg): starts the lab again with the current start value
            sem = { v: init, q: [] }; where = { A: 'rem', B: 'rem', C: 'rem' }; hist = [init];  // a fresh semaphore, all three processes in the remainder, and a history holding only the start value
            if (code.isConnected) { const nc = ctx.ui.code(codeSrc(init), { lang: 'c', fontSize: 13.5 }); code.replaceWith(nc); code = nc; }  // if the code box is on the page, replaces it with one whose first line shows the new start value
            narr.className = 'narr'; narr.innerHTML = msg || `Every process runs the same loop. <code>s</code> starts at <b>${init}</b>. Click a process to run its next statement, or play the classic trace.`;  // shows the given message, or a default one explaining what to do
            paint();  // redraws everything
          }  // ends reset
          function act(n) {  // act(n): runs process n's next statement, depending on where it is in the loop
            const old = sem.v;  // remembers the value before the call for the message
            let msg, tone = '';  // msg is the explanation to show; tone colours it
            if (where[n] === 'rem') {  // a process in the remainder calls semWait next
              if (semWaitOp(sem, n)) { where[n] = 'blocked'; msg = `<b>${n}</b> calls semWait(s): ${old} → <b>${sem.v}</b>. Negative, so ${n} <b>blocks</b>${cs().length ? ` while ${cs().join(' and ')} ${cs().length > 1 ? 'are' : 'is'} inside` : ''}. ${-sem.v} process${sem.v === -1 ? '' : 'es'} now wait${sem.v === -1 ? 's' : ''}.`; tone = 'bad'; }  // semWaitOp said "block": the process is moved to the blocked zone; the message names who is inside and how many wait
              else { where[n] = 'cs'; msg = `<b>${n}</b> calls semWait(s): ${old} → <b>${sem.v}</b>. Not negative, so ${n} <b>enters</b> the critical section.`; }  // otherwise the process enters the critical section
            } else if (where[n] === 'cs') {  // a process in the critical section leaves and calls semSignal
              where[n] = 'rem';  // it goes back to the remainder
              const w = semSignalOp(sem);  // w is the waiter released by semSignalOp, if any (first in, first out)
              if (w) { where[w] = 'cs'; msg = `<b>${n}</b> leaves and calls semSignal(s): ${old} → <b>${sem.v}</b>. Still ≤ 0, so the first waiter, <b>${w}</b>, is released. Its semWait is now complete, so ${w} is the one process allowed into the critical section (it enters as soon as it gets the CPU).`; tone = 'ok'; }  // a waiter was released: its semWait is complete, so it is placed straight into the critical section
              else msg = `<b>${n}</b> leaves and calls semSignal(s): ${old} → <b>${sem.v}</b>. Nobody was waiting${sem.v === init ? ', so the room is completely free again' : ''}.`;  // nobody was waiting: the message notes when the room is completely free again
            } else return;  // a blocked process cannot act, so the function stops here
            hist.push(sem.v);  // records the new value in the history strip
            if (cs().length > 1) { msg += ` <b>Two processes are inside at once: mutual exclusion is broken</b>, because s started at ${init}.`; tone = 'bad'; }  // if two or more are inside, adds a red warning that mutual exclusion is broken (only possible when s started at 2)
            narr.className = 'narr' + (tone ? ' ' + tone : ''); narr.innerHTML = msg;  // shows the message in the explanation box with its colour
            paint();  // redraws everything
          }  // ends act
          const cs = () => names.filter((n) => where[n] === 'cs');  // cs(): the names of the processes currently in the critical section
          function paint() {  // paint(): redraws the buttons, the diagram, the history strip, the status chips and the code highlights
            // buttons
            btnRow.replaceChildren(...names.map((n) => {  // rebuilds the three process buttons
              const w = where[n];  // w is where this process is: rem (remainder), cs (critical section) or blocked
              return h('button', { class: 'btn ' + (w === 'cs' ? 'mem' : w === 'blocked' ? '' : 'proc'), type: 'button', disabled: w === 'blocked', onclick: () => { runId++; act(n); } },  // button coloured by place; a blocked process's button is disabled; a click cancels any animated trace, then acts
                w === 'rem' ? `${n}: semWait(s)` : w === 'cs' ? `${n}: semSignal(s)` : `${n} is asleep`);  // button label: the next call the process will make, or "is asleep" when blocked
            }));  // ends the button list
            // diagram: three zones
            const zones = [['rem', 'remainder (outside)', 's-panel', 10], ['blocked', 'blocked in semWait(s)', 's-warn', 205], ['cs', 'critical section', cs().length > 1 ? 's-bad' : 's-ok', 400]];  // zones: the three areas of the diagram as [key, label, colour, x position]; the room turns red if two are inside
            const kids = [], NW = ctx.narrow;  // kids: the SVG shapes; NW is true on a phone-width screen
            zones.forEach(([key, label, cls, x], zi) => {  // draws each zone
              // wide: three zones side by side; phone: three zones stacked, each with its label above it
              const zx = NW ? 6 : x, zy = NW ? 22 + zi * 86 : 30, zw = NW ? 290 : 190, zh = NW ? 58 : 96;  // zone position and size: stacked full-width strips on a small screen, three side-by-side boxes otherwise
              kids.push(s('rect', { x: zx, y: zy, width: zw, height: zh, rx: 14, class: cls, 'stroke-width': 2, 'fill-opacity': key === 'blocked' ? 0.5 : 1 }));  // the zone's box; the blocked zone is drawn half transparent
              kids.push(s('text', { x: NW ? zx + 4 : zx + 95, y: zy - 8, 'text-anchor': NW ? 'start' : 'middle', 'font-size': 14, 'font-weight': 700 }, label));  // the zone's label just above its box
              const who = key === 'blocked' ? sem.q.slice() : names.filter((n) => where[n] === key);  // who is in this zone: for the blocked zone, the semaphore queue in order; otherwise processes whose place matches
              who.forEach((n, k) => kids.push(token(s, zx + zw / 2 + (k - (who.length - 1) / 2) * 58, zy + zh / 2, n, key === 'blocked' ? 's-warn' : key === 'cs' ? 's-mem' : 's-proc', 48, 44)));  // draws each process in the zone as a token, spaced 58 units apart and centred in the zone
            });  // ends the zone loop
            // released waiter: from the blocked zone into the critical section
            if (NW) kids.push(s('path', { d: 'M298 137 C 352 145, 352 216, 300 222', class: 's-line', fill: 'none', 'stroke-width': 1.8, 'marker-end': 'url(#arr)' }));  // small screen: a curved arrow from the blocked strip down to the critical-section strip
            else {  // wide screen: the arrow and a caption
              kids.push(s('path', { d: 'M300 128 C 300 150, 495 150, 495 131', class: 's-line', fill: 'none', 'stroke-width': 1.8, 'marker-end': 'url(#arr)' }));  // a curved arrow under the boxes from the blocked zone to the critical section
              kids.push(s('text', { x: 398, y: 164, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, 'a semSignal moves the front waiter into the room'));  // caption under the arrow: a semSignal moves the front waiter into the room
            }  // ends the arrow branch
            svg.replaceChildren(...kids);  // replaces the old drawing with the new one
            // history strip
            histEl.replaceChildren(h('span', { class: 'small b' }, 's over time:'), ...hist.map((v, i) => [i ? h('span', { class: 'muted' }, '→') : null, h('span', { class: 'chip ' + (v < 0 ? 'warn' : v === 0 ? 'os' : 'ok') + (i === hist.length - 1 ? ' flash' : '') }, String(v))]).flat().filter(Boolean).slice(-19));  // history strip: the value after each action as coloured chips joined by arrows; the newest flashes; only the last few fit
            const inside = cs().length;  // inside: how many processes are in the critical section now
            inv.replaceChildren(h('span', { class: 'chip ' + (inside > 1 ? 'bad' : 'ok') }, `inside the critical section: ${inside} ${inside > 1 ? '✗' : '✓'}`), h('span', { class: 'chip warn' }, `blocked: ${sem.q.length}`), h('span', { class: 'chip os' }, `s = ${sem.v}`));  // status chips: inside count (green tick or red cross), blocked count and the current value
            code.clear();  // clears all highlights in the code box
            if (names.some((n) => where[n] === 'rem')) code.mark([7], 'cur');  // if anyone is in the remainder, highlights line 7 (the remainder)
            if (sem.q.length) code.mark([4], 'bad');  // if anyone is blocked, highlights line 4 (semWait) in red
            if (inside) code.mark([5], 'ok');  // if anyone is inside, highlights line 5 (the critical section) in green
          }  // ends paint
          async function classic() {  // classic(): plays a fixed six-move trace automatically; async lets it pause between moves without freezing the page
            const my = ++runId;  // my: this run's number; any click that changes runId makes this run stop at its next pause
            init = 1; initSeg.set(1);  // the classic trace needs s to start at 1, so it sets the start value and the button group
            reset('Classic trace: A, B and C all try to enter one after another, then leave in turn.');  // resets the lab with a message describing the trace
            for (const n of ['A', 'B', 'C', 'A', 'B', 'C']) {  // the order of moves: A enters while B and C block, then each leaves in turn, letting the next waiter in
              await ctx.sleep(1300);  // waits 1.3 seconds between moves so the student can follow
              if (!ctx.alive || my !== runId) return;  // stops if the student left this step or started something else in the meantime
              act(n);  // performs the move exactly as a button click would
            }  // ends the move loop
          }  // ends classic
          const initSeg = ctx.ui.seg([{ value: 1, label: 's starts at 1' }, { value: 2, label: 's starts at 2' }], 1, (v) => {  // button group to choose the start value, 1 or 2
            runId++; init = v;  // cancels any running trace and remembers the new start value
            reset(v === 2 ? 'Now <code>s</code> starts at <b>2</b>, which means “two may be inside at once”. Let two processes call semWait and watch what happens.' : null);  // resets; for 2, the message invites the student to let two processes enter
          });  // ends the start-value handler
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: 'minmax(0, 500px) minmax(0, 1fr)', gap: '22px' } },  // puts the step on the page: code on the left (at most 500px wide), the lab on the right
            h('div', { class: 'stack', style: { gap: '10px' } },  // left column starts
              h('p', { class: 'm0', html: 'Wrap the <span class="t">critical section</span> in <code>semWait(s)</code> and <code>semSignal(s)</code>, with <code>s</code> starting at <b>1</b>: one process inside at a time, which is <span class="t">mutual exclusion</span>.' }),  // intro sentence: wrapping the critical section in semWait and semSignal with s at 1 gives mutual exclusion
              code,  // the code box
              h('div', { class: 'row gap-s xs' }, h('span', { class: 'small b' }, 'Code highlights:'), h('span', { class: 'chip io' }, 'someone in remainder'), h('span', { class: 'chip bad' }, 'someone blocked'), h('span', { class: 'chip ok' }, 'someone inside')),  // legend for the code highlights: remainder, blocked and inside
              h('div', { class: 'callout warn small m0', 'data-label': 'Common mistake' }, 'Forgetting semSignal on some exit path (an early return, an error): the room stays locked and every later process blocks forever.')),  // common-mistake box: a missed semSignal on some exit path locks everyone out forever; ends the left column
            h('div', { class: 'stack', style: { gap: '10px' } },  // right column starts
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, initSeg, h('div', { class: 'row gap-s' },  // top row: start-value buttons on the left, trace and reset buttons on the right
                h('button', { class: 'btn sm primary', type: 'button', onclick: classic }, '▶ Play the classic trace'),  // Play the classic trace button
                h('button', { class: 'btn sm', type: 'button', onclick: () => { runId++; reset(); } }, 'Reset'))),  // Reset button: cancels any running trace and starts over; ends the top row
              btnRow,  // the three process buttons
              h('div', { class: 'card white tight' }, svg),  // the diagram in a white card
              histEl, inv, narr,  // the history strip, the status chips and the explanation box
              h('div', { class: 'callout why small m0', 'data-label': 'Why start at 1?' }, 'The start value is how many may be inside at once. At 2, two get in together: right for a pool of two printers, wrong for a critical section.'))));  // why box: the start value is how many may be inside at once; ends the right column and the page
          reset();  // starts the lab in its initial state as soon as the step appears
        },  // ends render() for step 5
      },  // ends step 5

      /* ---------------- 6. The producer/consumer problem (infinite buffer, no semaphores yet) ---------------- */
      {  // step 6 starts here: the producer/consumer problem with an unlimited buffer, before any semaphores are used
        title: 'The producer/consumer problem',  // the step's title, shown at the top of the page
        kind: 'explore',  // kind "explore" marks this as an Explore page
        render(el, ctx) {  // render(el, ctx): builds the buffer simulation when step 6 is shown
          const { h, s } = ctx;  // h builds HTML elements and s builds SVG elements
          const PSRC = `${/* PSRC: the producer's code shown to the student */''}
while (true) {            // producer, forever:${/* shown producer code, line 1: loop forever */''}
    v = produce();        // make the next item${/* shown producer code, line 2: make the next item */''}
    b[in] = v;            // store it in slot b[in]${/* shown producer code, line 3: store it in slot in */''}
    in++;                 // in = next empty slot${/* shown producer code, line 4: move in to the next empty slot */''}
}                         // it never has to wait`;  // shown producer code, line 5: end of the loop; the producer never waits; ends PSRC
          const CSRC = `${/* CSRC: the consumer's code shown to the student */''}
while (true) {            // consumer, forever:${/* shown consumer code, line 1: loop forever */''}
    while (in <= out) ;   // empty? test again (spin)${/* shown consumer code, line 2: the busy-wait loop that keeps checking whether the buffer is empty */''}
    w = b[out];           // read slot b[out]${/* shown consumer code, line 3: read the item in slot out */''}
    out++;                // out = next unread slot${/* shown consumer code, line 4: move out to the next unread slot */''}
    consume(w);           // use the item${/* shown consumer code, line 5: use the item */''}
}                         // then go round again`;  // shown consumer code, line 6: end of the loop; ends CSRC
          const pCode = ctx.ui.code(PSRC, { lang: 'c', fontSize: 13, cls: 'tight' });  // the producer's code box in the tighter line spacing
          const cCode = ctx.ui.code(CSRC, { lang: 'c', fontSize: 13, cls: 'tight' });  // the consumer's code box in the tighter line spacing
          let check = true, st;  // check says whether the consumer's empty test (line 2) is switched on; st holds the buffer state
          const svg = s('svg', { viewBox: ctx.narrow ? '0 0 318 230' : '0 0 600 116', width: '100%' });  // the buffer diagram's SVG; a phone-width screen uses two rows of slots
          const chips = h('div', { class: 'row gap-s' });  // row of status chips under the diagram
          const narr = h('div', { class: 'narr', style: { minHeight: '100px' } });  // the explanation box, with a minimum height so the page does not jump
          function say(html, tone) { narr.className = 'narr' + (tone ? ' ' + tone : ''); narr.innerHTML = html; }  // say(html, tone): puts a message in the explanation box, coloured by tone
          function marks() { pCode.clear(); cCode.clear(); if (!check) cCode.mark([2], 'dim'); }  // marks(): clears both code boxes' highlights and greys out line 2 of the consumer when the check is off
          // first visible slot: keep two used slots on the left of the lower pointer
          const base = () => Math.max(1, Math.min(st.in, st.out) - 2);  // base(): the number of the first slot drawn, so the picture follows the pointers along the endless buffer
          function reset(msg) {  // reset(msg): empties the buffer and starts again
            st = { in: 1, out: 1, made: 0, cells: {}, spins: 0 };  // buffer state: in and out both at slot 1, no items made, no slots filled, no wasted tests
            marks();  // clears the code highlights
            say(msg || 'The buffer is empty: in = out = 1. Add a few items, take a few, then try to take when nothing is left, first with the check on, then with it off.');  // shows the given message, or the opening instructions
            draw();  // redraws the buffer
          }  // ends reset
          function produce() {  // produce(): runs when the student clicks the producer button
            if (st.in >= base() + 7) { say('The real buffer never fills up, but this picture only has room for eight slots. Let the consumer catch up (or press Reset).'); return; }  // the picture has room for only eight slots, so it refuses to go past them and explains why
            const id = ++st.made, lost = st.in < st.out;  // id numbers the new item; lost is true when out has already passed this slot, so no one will ever read it
            st.cells[st.in] = { id, st: lost ? 'lost' : 'full' };  // stores the item in slot in, marked "lost" or "full"
            st.in++;  // moves in to the next empty slot
            marks(); pCode.mark([2, 3, 4]);  // highlights producer lines 2 to 4
            say(lost ? `The producer stores item ${id} in b[${st.in - 1}], but out has already moved past that slot, so this item will <b>never be read</b>. Once out overtook in, the bookkeeping was broken for good. Press Reset.`  // message for a lost item: out overtook in, so the bookkeeping is broken
              : `The producer makes item ${id}, stores it in b[${st.in - 1}] and moves in to ${st.in}. It never waits, because an infinite buffer never fills. Items waiting: in − out = ${st.in - st.out}.`, lost ? 'bad' : '');  // message for a normal store: the item is stored, in moves on and the count waiting is in minus out
            draw();  // redraws the buffer
          }  // ends produce
          function consume() {  // consume(): runs when the student clicks the consumer button
            const empty = st.in <= st.out;  // empty: true when in is not greater than out, meaning nothing is waiting
            marks();  // clears the code highlights
            if (empty && check) {  // empty buffer with the check on: the consumer spins on line 2
              st.spins += 1; cCode.mark([2], 'bad');  // counts one more wasted test and highlights line 2 in red
              say(`in = ${st.in} and out = ${st.out}, so in ≤ out: the buffer is empty. The consumer stays on line 2, testing again and again. That is <span class="t">busy waiting</span>: ${st.spins} wasted test${st.spins === 1 ? '' : 's'} so far, and only the producer can end it.`, 'bad');  // explains busy waiting and how many tests have been wasted so far
            } else if (empty) {  // empty buffer with the check off: the consumer reads anyway
              if (st.out >= base() + 7) { say('The picture has run out of room. Press Reset to start again.'); return; }  // stops if the picture has no more room
              st.cells[st.out] = { st: 'ghost' }; st.out++;  // marks the slot as a "ghost" read (nothing was stored there) and moves out past in
              cCode.mark([3, 4, 5], 'bad');  // highlights consumer lines 3 to 5 in red
              say(`With the check gone, the consumer reads b[${st.out - 1}], where nothing was ever stored, and consumes <b>garbage</b>: an item that does not exist. out (${st.out}) is now ahead of in (${st.in}), which breaks rule 2.`, 'bad');  // explains that the consumer consumed garbage and that out is now ahead of in
            } else {  // an item is waiting: the normal case
              const c = st.cells[st.out]; c.st = 'used'; st.out++;  // marks the item's slot as used and moves out on
              cCode.mark([3, 4, 5]);  // highlights consumer lines 3 to 5
              say(`in (${st.in}) is greater than out (${st.out - 1}), so an item is waiting. The consumer reads item ${c.id} from b[${st.out - 1}], moves out to ${st.out} and consumes it. Items still waiting: in − out = ${st.in - st.out}.`, 'ok');  // explains which item was read and how many are still waiting
            }  // ends the three cases
            draw();  // redraws the buffer
          }  // ends consume
          // slot k of the visible window: one row of 8 on a wide canvas, two rows of 4 on a phone
          const cell = (k) => (ctx.narrow ? [12 + (k % 4) * 70, Math.floor(k / 4) * 116] : [12 + k * 70, 0]);  // cell(k): the position of visible slot k: one row of eight on a wide screen, two rows of four on a small one
          function draw() {  // draw(): redraws the buffer slots, the in and out pointers and the status chips
            const b0 = base(), kids = [];  // b0 is the first slot drawn; kids collects the SVG shapes
            const px = (p) => { const [x, dy] = cell(p - b0); return [x + 31, dy]; };  // px(p): the centre position and row offset of buffer slot p inside the visible window, used to place the pointers
            for (let k = 0; k < 8; k++) {  // draws the eight visible slots
              const idx = b0 + k, [x, dy] = cell(k), c = st.cells[idx];  // idx is the real slot number, (x, dy) its place in the drawing and c its contents, if any
              const cls = !c ? 's-muted' : c.st === 'full' ? 's-mem' : c.st === 'ghost' ? 's-bad' : c.st === 'lost' ? 's-warn' : 's-panel';  // slot colour: dashed grey when empty, memory colour when full, red for a garbage read, amber for a lost item, plain once taken
              kids.push(s('text', { x: x + 31, y: dy + 14, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, `b[${idx}]`));  // the slot's name, such as b[3], above it
              kids.push(s('rect', { x, y: dy + 22, width: 62, height: 44, rx: 8, class: cls, 'stroke-width': 2, 'stroke-dasharray': c ? null : '5 4' }));  // the slot's box; an empty slot gets a dashed outline
              if (c) kids.push(s('text', { x: x + 31, y: dy + 49, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, style: c.st === 'ghost' ? 'fill:var(--bad)' : c.st === 'used' ? 'fill:var(--muted)' : '' }, c.st === 'ghost' ? 'garbage' : c.st === 'used' ? 'taken' : 'item ' + c.id));  // text inside a filled slot: "item N", "taken" in grey, or "garbage" in red
            }  // ends the slot loop
            kids.push(s('text', { x: ctx.narrow ? 302 : 588, y: ctx.narrow ? 166 : 50, 'text-anchor': 'middle', 'font-size': 22, 'font-weight': 800, class: 's-sub' }, '…'));  // an ellipsis after the last slot to show that the buffer goes on forever
            const same = st.in === st.out;  // same: true when in and out point at the same slot, so the out label is moved lower to avoid overlap
            if (st.in >= b0 && st.in < b0 + 8) { const [x, dy] = px(st.in); kids.push(s('text', { x, y: dy + 88, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800, style: 'fill:var(--mem)' }, '▲ in')); }  // if slot in is in view, draws the "in" pointer under it in the producer's colour
            if (st.out >= b0 && st.out < b0 + 8) { const [x, dy] = px(st.out); kids.push(s('text', { x, y: dy + (same ? 108 : 88), 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800, style: 'fill:var(--proc)' }, '▲ out')); }  // if slot out is in view, draws the "out" pointer under it in the consumer's colour
            svg.replaceChildren(...kids);  // replaces the old drawing with the new one
            const wait = st.in - st.out;  // wait: how many items are waiting, in minus out (negative once the consumer has overtaken)
            chips.replaceChildren(h('span', { class: 'chip mem' }, `in = ${st.in}`), h('span', { class: 'chip proc' }, `out = ${st.out}`),  // status chips: the values of in and out
              h('span', { class: 'chip ' + (wait < 0 ? 'bad' : 'os') }, `waiting: in − out = ${wait}`),  // chip for the waiting count, red if it has gone negative
              h('span', { class: 'chip ' + (st.spins ? 'warn' : '') }, `wasted tests: ${st.spins}`));  // chip for the number of wasted empty tests, amber once there are any
          }  // ends draw
          const checkSeg = ctx.ui.seg([{ value: true, label: 'Check on' }, { value: false, label: 'Check off' }], true, (v) => {  // button group that switches the consumer's empty check (line 2) on or off
            check = v; marks();  // remembers the choice and updates the code highlights so line 2 greys out when off
            say(v ? 'The check is back: on an empty buffer the consumer will spin on line 2 instead of reading an empty slot.' : 'The consumer now skips line 2 and reads b[out] no matter what. Take until the buffer is empty, then take once more.', v ? '' : 'bad');  // explains what the consumer will now do on an empty buffer; the "off" message is red
          });  // ends the check handler
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },  // puts the step on the page as a vertical stack that fills the step
            h('p', { class: 'm0', style: { fontSize: '15.5px' }, html: '<b>The problem.</b> One or more <b>producers</b> put items into a shared buffer and a <b>consumer</b> takes them out one at a time. This is the <span class="t" data-t="producer/consumer problem">producer/consumer problem</span>, and every solution must keep two rules: <b>(1)</b> only one process uses the buffer at any moment, and <b>(2)</b> the consumer never takes from an empty buffer. For now the buffer is <b>infinite</b> (b[1], b[2], … never run out): the producer writes at index <code>in</code>, the consumer reads at <code>out</code>, and <code>in − out</code> items are waiting.' }),  // problem statement: the producer/consumer problem, its two rules, and the in and out indexes of an infinite buffer
            h('div', { class: 'grid-2', style: { gap: '14px' } },  // two code boxes side by side
              h('div', { class: 'stack', style: { gap: '4px' } }, h('h4', { class: 'm0', style: { color: 'var(--mem)' } }, 'Producer'), pCode),  // the producer's heading and code
              h('div', { class: 'stack', style: { gap: '4px' } }, h('h4', { class: 'm0', style: { color: 'var(--proc)' } }, 'Consumer'), cCode)),  // the consumer's heading and code; ends the pair
            h('div', { class: 'split grow', style: { gridTemplateColumns: 'minmax(0, 13fr) minmax(0, 10fr)', gap: '16px' } },  // lower area: the simulation on the left, the explanation on the right
              h('div', { class: 'card white tight stack', style: { gap: '8px' } },  // left card: controls, diagram and chips
                h('div', { class: 'row gap-s' },  // row of action buttons
                  h('button', { class: 'btn sm mem', type: 'button', onclick: produce }, 'Producer: add an item'),  // button that makes the producer add an item
                  h('button', { class: 'btn sm proc', type: 'button', onclick: consume }, 'Consumer: take an item'),  // button that makes the consumer take an item
                  h('button', { class: 'btn sm', type: 'button', style: { marginLeft: 'auto' }, onclick: () => reset() }, 'Reset')),  // Reset button, pushed to the far right; ends the row
                h('div', { class: 'row gap-s' }, h('span', { class: 'small b' }, 'Consumer’s line-2 check:'), checkSeg,  // row with the consumer's check switch
                  h('span', { class: 'small muted' }, 'on = spin while empty · off = read anyway')),  // reminder of what "on" and "off" mean; ends the row
                svg, chips),  // the buffer diagram and the status chips; ends the left card
              h('div', { class: 'stack', style: { gap: '10px' } }, narr,  // right column: the explanation box
                h('div', { class: 'callout why small m0', 'data-label': 'Why semaphores next', html: 'The check keeps rule 2, but a spinning consumer wastes the processor, and nothing yet enforces rule 1. Next, a semaphore <code>s</code> locks the buffer and another one lets the consumer <b>sleep</b> until an item exists.' })))));  // why box: the check only protects rule 2 and wastes time spinning, which leads into the semaphore version; ends the page
          reset();  // starts the simulation with an empty buffer as soon as the step appears
        },  // ends render() for step 6
      },  // ends step 6

      /* ---------------- 7. Producer/consumer, infinite buffer ---------------- */
      {  // step 7 starts here: a step-by-step trace of producer and consumer code that hides a bug, then two repaired versions
        title: 'Producer/consumer: catch the bug, then fix it',  // the step's title, shown at the top of the page
        kind: 'lab',  // kind "lab" marks this as a Hands-on Lab page
        render(el, ctx) {  // render(el, ctx): builds the trace player, code boxes and diagram when step 7 is shown
          const { h, s } = ctx;  // h builds HTML elements and s builds SVG elements
          const add = (st) => { st.items++; st.cells[st.in - 1] = { id: st.items, st: 'full' }; st.in++; };  // add(st): the producer's append in the model: numbers a new item, stores it in slot in and moves in on
          const take = (st) => { const c = st.cells[st.out - 1]; if (c && c.st === 'full') c.st = 'used'; else { st.cells[st.out - 1] = { id: null, st: 'ghost' }; st.bad = true; } st.out++; };  // take(st): the consumer's take: marks a real item as used, or records a garbage read and sets the bug flag; moves out on
          const PROD_B = `${/* PROD_B: the producer's code with binary semaphores, shared by the flawed and fixed versions */''}
int n = 0;                     // items in the buffer${/* shown producer code, line 1: n counts the items in the buffer */''}
binary_semaphore s = 1;        // guards the buffer${/* shown producer code, line 2: binary semaphore s locks the buffer */''}
binary_semaphore delay = 0;    // 0 = consumer must wait${/* shown producer code, line 3: binary semaphore delay makes the consumer wait while the buffer is empty */''}
void producer() {              // the producer process${/* shown producer code, line 4: start of the producer */''}
    while (true) {             // forever:${/* shown producer code, line 5: the endless loop */''}
        produce();             // make an item${/* shown producer code, line 6: make an item */''}
        semWaitB(s);           // lock the buffer${/* shown producer code, line 7: lock the buffer */''}
        append();              // b[in] = item; in++${/* shown producer code, line 8: append the item */''}
        n++;                   // one more item${/* shown producer code, line 9: count one more item */''}
        if (n == 1) semSignalB(delay); // was empty: wake${/* shown producer code, line 10: if the buffer was empty, wake the consumer */''}
        semSignalB(s);         // unlock the buffer${/* shown producer code, line 11: unlock the buffer */''}
    }                          // end loop${/* shown producer code, line 12: end of the loop */''}
}                              // end producer`;  // shown producer code, line 13: end of the producer; ends PROD_B
          const V = {  // V: the three versions of the solution, each with its intro text, bug-hunt answers, code and animation frames
            flawed: {  // version 1, "flawed": binary semaphores with a hidden race on n
              intro: 'The <span class="t" data-t="producer/consumer problem">producer/consumer</span> problem with <span class="t" data-t="binary semaphore">binary semaphores</span>: <code>s</code> locks the buffer; <code>delay</code> puts the consumer to sleep while it is empty. <b style="color:var(--warn)">Hunt for the bug:</b> play to step 7, then <b>click the consumer line</b> you blame.',  // intro: explains s and delay and asks the student to find the faulty consumer line
              hunt: {  // hunt: the answer and feedback for the student's line clicks
                right: [9],  // the correct line to click is consumer line 9, the unprotected test of n
                yes: 'It tests the shared <code>n</code> after line 7 has already released s. In that gap the producer can change n and store a signal in delay, so the test and the stored signal disagree. Play on to see the damage.',  // message shown when the student clicks the right line
                fb: { 2: 'This first wait only makes the consumer sleep until the very first item exists. It is fine.', 4: 'Locking s here is right: take() and n-- then have the buffer to themselves.', 5: 'take() runs while s is held, so the producer cannot interfere with it.', 6: 'n-- runs while s is held, so it is safe.', 7: 'Unlocking is necessary. Ask what the consumer does with shared data <i>after</i> this line.', 8: 'consume() uses only the consumer’s own item, which no other process touches.' },  // feedback for each wrong line, keyed by line number
              },  // ends hunt
              vars: ['n', 's', 'delay'], prod: PROD_B,  // the variables drawn in the diagram for this version, and its producer code
              cons: `${/* cons: the flawed consumer code shown to the student */''}
void consumer() {              // the consumer process${/* shown consumer code, line 1: start of the consumer */''}
    semWaitB(delay);           // wait for a first item${/* shown consumer code, line 2: wait on delay for the very first item */''}
    while (true) {             // forever:${/* shown consumer code, line 3: the endless loop */''}
        semWaitB(s);           // lock the buffer${/* shown consumer code, line 4: lock the buffer */''}
        take();                // item = b[out]; out++${/* shown consumer code, line 5: take an item */''}
        n--;                   // one fewer item${/* shown consumer code, line 6: count one fewer item */''}
        semSignalB(s);         // unlock the buffer${/* shown consumer code, line 7: unlock the buffer */''}
        consume();             // use the item${/* shown consumer code, line 8: use the item */''}
        if (n == 0) semWaitB(delay); // empty? then sleep${/* shown consumer code, line 9: the faulty test of n after the lock was released */''}
    }                          // end loop${/* shown consumer code, line 10: end of the loop */''}
}                              // end consumer`,  // shown consumer code, line 11: end of the consumer; ends the flawed consumer text
              frames: [  // frames: the animation steps; p and c list the code lines to highlight, cc colours them, f changes the state
                { cap: '<b>Start.</b> The buffer is empty: n = 0, s = 1, delay = 0. Step through one particular timing of the two processes.' },  // frame 1: the starting values
                { c: [2], f: (st) => { st.C = 'blocked'; }, cap: 'The consumer runs first and calls semWaitB(delay). delay is 0, so the consumer <b>blocks</b> until the producer says there is something to take.' },  // frame 2: the consumer blocks on delay
                { p: [6, 7, 8], f: (st) => { st.s = 0; add(st); st.P = 'running'; }, cap: 'The producer makes item 1, locks the buffer (s: 1 → 0) and appends it to b[1].' },  // frame 3: the producer locks the buffer and appends item 1
                { p: [9, 10], f: (st) => { st.n = 1; st.C = 'ready'; }, cap: 'n: 0 → 1. Because n is 1, the buffer was empty a moment ago, so the producer calls semSignalB(delay). The consumer was waiting, so it is <b>released</b> (delay stays 0).' },  // frame 4: n becomes 1, so the producer signals delay and the consumer is released
                { p: [11], f: (st) => { st.s = 1; st.P = 'ready'; }, cap: 'The producer unlocks the buffer (s: 0 → 1).' },  // frame 5: the producer unlocks the buffer
                { c: [4, 5, 6, 7], f: (st) => { take(st); st.n = 0; st.C = 'running'; }, cap: 'The consumer locks the buffer, takes item 1 from b[1], sets n: 1 → 0 and unlocks. So far, so good.' },  // frame 6: the consumer takes item 1 and sets n to 0
                { c: [8], cc: 'bad', f: () => {}, cap: 'The consumer is busy consuming item 1. It has <b>not yet</b> reached the test <code>if (n == 0)</code>, and n is no longer protected by s. Now the scheduler switches to the producer…' },  // frame 7: the risky moment: the consumer has unlocked but not yet tested n
                { p: [6, 7, 8, 9, 10, 11], f: (st) => { add(st); st.n = 1; st.delay = 1; st.C = 'ready'; }, cap: 'The producer adds item 2 (n: 0 → 1). Since n == 1 it signals delay again. This time nobody is waiting, so delay becomes <b>1</b>: a stored wake-up that nobody asked for.' },  // frame 8: the producer adds item 2 and stores an unneeded signal in delay
                { c: [9], f: () => {}, cap: 'Back to the consumer. It finally tests n == 0 but sees <b>1</b> (the producer’s new item), so it does not sleep. That alone is fine; the trouble is that the stale <b>delay = 1 is still stored</b>.' },  // frame 9: the consumer tests n, sees 1 and does not sleep, but the stale signal remains
                { c: [4, 5, 6, 7, 8], f: (st) => { take(st); st.n = 0; }, cap: 'It takes item 2 (n: 1 → 0), unlocks and consumes it. The buffer is now truly empty.' },  // frame 10: the consumer takes item 2 and the buffer is empty
                { c: [9], cc: 'bad', f: (st) => { st.delay = 0; }, cap: 'n == 0, so the consumer calls semWaitB(delay) to sleep. But the stale signal is still there, so it <b>passes straight through</b> (delay: 1 → 0).' },  // frame 11: the consumer tries to sleep on delay but the stale signal lets it pass
                { c: [4, 5, 6, 7], cc: 'bad', f: (st) => { take(st); st.n = -1; }, cap: '<b>Bug!</b> The consumer locks the buffer and takes b[3], which was never filled: it consumes an item that <b>does not exist</b>, n drops to −1, and out has overtaken in. Cause: n was tested outside the critical section.' },  // frame 12: the bug: the consumer takes from an empty slot and n drops to -1
              ],  // ends the flawed frames
            },  // ends version 1, "flawed"
            fixed: {  // version 2, "fixed": the consumer saves n in a private variable m while it holds the lock
              intro: 'One change: the consumer copies n into a private <code>m</code> while it still holds the lock, and tests m later. <b style="color:var(--ok)">Your turn:</b> <b>click the consumer line</b> that actually repairs the bug.',  // intro: describes the one change and asks the student to click the line that repairs the bug
              hunt: {  // hunt: the answer and feedback for this version
                right: [8],  // the correct line is consumer line 8, m = n, which runs while the lock is held
                yes: '<code>m = n</code> runs while s is held, so m records n at a moment when the consumer owned the buffer. No other process can change m, so the later test on line 11 can no longer be fooled.',  // message for the right line: m is copied while locked, so the later test cannot be fooled
                fb: { 2: 'That only declares m. What matters is <i>when</i> m gets its value.', 11: 'Line 11 tests m, but that is safe only because of how m got its value. Look a little earlier.', 3: 'This first wait is unchanged from the flawed version.', 5: 'This lock was already there in the flawed version.', 6: 'Unchanged from the flawed version.', 7: 'Unchanged from the flawed version.', 9: 'Unchanged from the flawed version.', 10: 'Unchanged from the flawed version.' },  // feedback for wrong lines: line 2 only declares m, line 11 relies on line 8, the rest are unchanged
              },  // ends hunt
              vars: ['n', 's', 'delay', 'm'], prod: PROD_B,  // this version also draws m, and it reuses the same producer code
              cons: `${/* cons: the repaired consumer code shown to the student */''}
void consumer() {              // the consumer process${/* shown consumer code, line 1: start of the consumer */''}
    int m;                     // private copy of n${/* shown consumer code, line 2: declares the private copy m */''}
    semWaitB(delay);           // wait for a first item${/* shown consumer code, line 3: wait on delay for the first item */''}
    while (true) {             // forever:${/* shown consumer code, line 4: the endless loop */''}
        semWaitB(s);           // lock the buffer${/* shown consumer code, line 5: lock the buffer */''}
        take();                // item = b[out]; out++${/* shown consumer code, line 6: take an item */''}
        n--;                   // one fewer item${/* shown consumer code, line 7: count one fewer item */''}
        m = n;                 // remember n while locked${/* shown consumer code, line 8: the repair, copying n into m while still locked */''}
        semSignalB(s);         // unlock the buffer${/* shown consumer code, line 9: unlock the buffer */''}
        consume();             // use the item${/* shown consumer code, line 10: use the item */''}
        if (m == 0) semWaitB(delay); // test the saved copy${/* shown consumer code, line 11: test the saved copy m instead of the shared n */''}
    }                          // end loop${/* shown consumer code, line 12: end of the loop */''}
}                              // end consumer`,  // shown consumer code, line 13: end of the consumer; ends the repaired consumer text
              frames: [  // frames for the repaired version, using exactly the same timing as the flawed one
                { cap: '<b>Start.</b> Exactly the same timing as before. Watch what the private copy m changes.' },  // frame 1: same start, watch what m changes
                { c: [3], f: (st) => { st.C = 'blocked'; }, cap: 'The consumer calls semWaitB(delay) and <b>blocks</b>: nothing to take yet.' },  // frame 2: the consumer blocks on delay
                { p: [6, 7, 8], f: (st) => { st.s = 0; add(st); st.P = 'running'; }, cap: 'The producer makes item 1, locks the buffer (s: 1 → 0) and appends it to b[1].' },  // frame 3: the producer locks and appends item 1
                { p: [9, 10], f: (st) => { st.n = 1; st.C = 'ready'; }, cap: 'n: 0 → 1, so the producer signals delay and the waiting consumer is <b>released</b>.' },  // frame 4: the producer signals delay and the consumer is released
                { p: [11], f: (st) => { st.s = 1; st.P = 'ready'; }, cap: 'The producer unlocks the buffer (s: 0 → 1).' },  // frame 5: the producer unlocks the buffer
                { c: [5, 6, 7, 8, 9], cc: 'ok', f: (st) => { take(st); st.n = 0; st.m = 0; st.C = 'running'; }, cap: 'The consumer takes item 1 (n: 1 → 0) and, <b>while still holding the lock</b>, copies n into m (m = 0). Then it unlocks.' },  // frame 6: the consumer takes item 1 and copies n into m while locked (green highlight)
                { c: [10], f: () => {}, cap: 'The consumer is consuming item 1. The scheduler switches to the producer at the same risky moment as before…' },  // frame 7: the same risky moment as before: the consumer is consuming
                { p: [6, 7, 8, 9, 10, 11], f: (st) => { add(st); st.n = 1; st.delay = 1; st.C = 'ready'; }, cap: 'The producer adds item 2 (n: 0 → 1) and, since n == 1, stores a signal in delay (delay = 1).' },  // frame 8: the producer adds item 2 and stores a signal in delay
                { c: [11], cc: 'ok', f: (st) => { st.delay = 0; }, cap: 'The consumer tests its saved m, which is 0, and calls semWaitB(delay). The stored signal lets it through (delay: 1 → 0), and this time the signal is <b>deserved</b>: item 2 really exists.' },  // frame 9: the consumer tests m = 0 and uses the stored signal, which this time matches a real item
                { c: [5, 6, 7, 8, 9, 10], f: (st) => { take(st); st.n = 0; st.m = 0; }, cap: 'It takes item 2 (n: 1 → 0), saves m = 0, unlocks and consumes.' },  // frame 10: the consumer takes item 2 and saves m = 0
                { c: [11], cc: 'ok', f: (st) => { st.C = 'blocked'; }, cap: 'm is 0 and delay is 0, so the consumer <b>blocks</b>: exactly right, because the buffer is empty.' },  // frame 11: m and delay are both 0, so the consumer correctly blocks
                { cap: '<b>Fixed.</b> Every signal on delay now matches a real item, and n never goes negative. The consumer sleeps until the producer’s next semSignalB(delay).' },  // frame 12: summary: every signal on delay now matches a real item
              ],  // ends the repaired frames
            },  // ends version 2, "fixed"
            counting: {  // version 3, "counting": n becomes a counting semaphore, so no separate delay semaphore is needed
              intro: '<code>n</code> is now a <span class="t" data-t="counting semaphore">counting semaphore</span>, so the item count and the wake-up can never disagree. <b style="color:var(--info)">Your turn:</b> <b>click the consumer line</b> that now does the job of both n and delay.',  // intro: the count and the wake-up are now one thing; asks the student to click the line that does the waiting
              hunt: {  // hunt: the answer and feedback for this version
                right: [3],  // the correct line is consumer line 3, semWait(n)
                yes: 'semWait(n) claims an item and, if none exists, puts the consumer to sleep, all in one atomic operation, so there is no gap to exploit. Order check: swapping the producer’s two semSignal calls is harmless; swapping these two semWaits is not.',  // message for the right line: semWait(n) checks and sleeps in one atomic step; also notes that semWait order matters
                fb: { 4: 'semWait(s) is only the lock around take().', 5: 'take() just removes the item; it does not decide whether one exists.', 6: 'semSignal(s) only unlocks the buffer.', 7: 'consume() only uses the item.' },  // feedback for the other consumer lines
              },  // ends hunt
              vars: ['n', 's'],  // only n and s are drawn for this version
              prod: `${/* prod: the producer code with counting semaphores, shown to the student */''}
semaphore n = 0;               // counts items in the buffer${/* shown producer code, line 1: counting semaphore n, the number of items */''}
semaphore s = 1;               // guards the buffer${/* shown producer code, line 2: semaphore s locks the buffer */''}
void producer() {              // the producer process${/* shown producer code, line 3: start of the producer */''}
    while (true) {             // forever:${/* shown producer code, line 4: the endless loop */''}
        produce();             // make an item${/* shown producer code, line 5: make an item */''}
        semWait(s);            // lock the buffer${/* shown producer code, line 6: lock the buffer */''}
        append();              // b[in] = item; in++${/* shown producer code, line 7: append the item */''}
        semSignal(s);          // unlock the buffer${/* shown producer code, line 8: unlock the buffer */''}
        semSignal(n);          // announce one more item${/* shown producer code, line 9: signal n to announce one more item */''}
    }                          // end loop${/* shown producer code, line 10: end of the loop */''}
}                              // end producer`,  // shown producer code, line 11: end of the producer; ends this producer text
              cons: `${/* cons: the consumer code with counting semaphores, shown to the student */''}
void consumer() {              // the consumer process${/* shown consumer code, line 1: start of the consumer */''}
    while (true) {             // forever:${/* shown consumer code, line 2: the endless loop */''}
        semWait(n);            // wait until an item exists${/* shown consumer code, line 3: wait on n until an item exists */''}
        semWait(s);            // lock the buffer${/* shown consumer code, line 4: lock the buffer */''}
        take();                // item = b[out]; out++${/* shown consumer code, line 5: take an item */''}
        semSignal(s);          // unlock the buffer${/* shown consumer code, line 6: unlock the buffer */''}
        consume();             // use the item${/* shown consumer code, line 7: use the item */''}
    }                          // end loop${/* shown consumer code, line 8: end of the loop */''}
}                              // end consumer`,  // shown consumer code, line 9: end of the consumer; ends this consumer text
              frames: [  // frames for the counting version, again with the same timing
                { cap: '<b>Start.</b> Same timing again, now with a counting semaphore n = 0 and s = 1.' },  // frame 1: the starting values n = 0 and s = 1
                { c: [3], f: (st) => { st.n = -1; st.C = 'blocked'; }, cap: 'The consumer calls semWait(n): 0 → −1. Negative, so it <b>blocks</b>. The semaphore is both the item count and the waiting line.' },  // frame 2: semWait(n) takes n to -1 and the consumer blocks
                { p: [5, 6, 7, 8], f: (st) => { add(st); st.P = 'running'; }, cap: 'The producer makes item 1, locks the buffer, appends it to b[1] and unlocks.' },  // frame 3: the producer locks, appends item 1 and unlocks
                { p: [9], f: (st) => { st.n = 0; st.C = 'ready'; st.P = 'ready'; }, cap: 'semSignal(n): −1 → 0. Still ≤ 0, so the consumer is <b>released</b>.' },  // frame 4: semSignal(n) takes n to 0 and releases the consumer
                { c: [4, 5, 6, 7], f: (st) => { take(st); st.C = 'running'; }, cap: 'The consumer locks, takes item 1, unlocks and starts consuming. The scheduler switches to the producer…' },  // frame 5: the consumer takes item 1 and the scheduler switches to the producer
                { p: [5, 6, 7, 8, 9], f: (st) => { add(st); st.n = 1; st.C = 'ready'; }, cap: '…which adds item 2 and signals n: 0 → 1. Nobody is waiting, so the count simply <b>remembers</b> the item.' },  // frame 6: the producer adds item 2 and n rises to 1, remembering it
                { c: [3, 4, 5, 6, 7], cc: 'ok', f: (st) => { st.n = 0; take(st); }, cap: 'semWait(n): 1 → 0, so the consumer passes, and there really is an item: it takes item 2.' },  // frame 7: semWait(n) takes n to 0 and the consumer takes the real item 2
                { c: [3], cc: 'ok', f: (st) => { st.n = -1; st.C = 'blocked'; }, cap: 'Next round: semWait(n) takes n from 0 to −1, so the consumer <b>blocks</b>. Correct. Order matters, though: swapping the consumer’s two semWait calls can deadlock, as the next step shows.' },  // frame 8: the consumer blocks correctly, and a note points ahead to the deadlock in the next step
              ],  // ends the counting frames
            },  // ends version 3, "counting"
          };  // closes V
          let ver = 'flawed', snaps = [];  // ver is the version on show; snaps holds the precomputed state for each of its frames
          const prodBox = h('div', { class: 'stack', style: { gap: '4px' } });  // container for the producer's heading and code box
          const consBox = h('div', { class: 'stack', style: { gap: '4px' } });  // container for the consumer's heading and code box
          const intro = h('p', { class: 'small m0' });  // paragraph for the version's intro text, which is replaced by feedback when the student clicks a line
          const svg = s('svg', { viewBox: ctx.narrow ? '0 0 360 304' : '0 0 560 178', width: '100%' });  // the diagram's SVG; a phone-width screen uses a taller drawing area
          let pCode, cCode;  // the current producer and consumer code boxes, rebuilt whenever the version changes
          function snapshotsFor(v) {  // snapshotsFor(v): runs every frame's change function in order and returns a copy of the state after each one
            const st = { n: 0, s: 1, delay: 0, m: null, cells: [], in: 1, out: 1, items: 0, P: 'ready', C: 'ready', bad: false };  // the starting state for every version: counters, empty buffer, in and out at 1, both processes ready, no bug yet
            return V[v].frames.map((fr) => { if (fr.f) fr.f(st); return JSON.parse(JSON.stringify(st)); });  // applies each frame's change, then saves a deep copy (by converting to text and back) so later frames cannot alter it
          }  // ends snapshotsFor
          function load(v) {  // load(v): switches the step to version v
            ver = v; snaps = snapshotsFor(v);  // remembers the version and precomputes its frame snapshots
            pCode = ctx.ui.code(V[v].prod, { lang: 'c', fontSize: 13, cls: 'tight' });  // builds the producer's code box
            cCode = ctx.ui.code(V[v].cons, { lang: 'c', fontSize: 13, cls: 'tight clk' });  // builds the consumer's code box with clickable lines
            // the student hunts for the key line by clicking it; feedback replaces the intro text
            cCode.querySelectorAll('.ln').forEach((ln, k) => ln.addEventListener('click', () => guess(k + 1)));  // clicking consumer line k+1 submits it as the student's guess for the bug hunt
            prodBox.replaceChildren(h('h4', { class: 'm0' }, 'Producer'), pCode);  // puts the producer's heading and code into its container
            consBox.replaceChildren(h('h4', { class: 'm0' }, 'Consumer ', h('span', { class: 'xs muted', style: { fontWeight: 600 } }, '(click a line)')), cCode);  // puts the consumer's heading, with a "(click a line)" hint, and code into its container
            intro.innerHTML = V[v].intro;  // shows the version's intro text
          }  // ends load
          function guess(n) {  // guess(n): runs when the student clicks consumer line n during the bug hunt
            const H = V[ver].hunt, ok = H.right.includes(n);  // H is this version's hunt data; ok is true when n is one of the right lines
            cCode.querySelectorAll('.ln').forEach((ln, k) => { ln.classList.toggle('pick-ok', ok && k + 1 === n); ln.classList.toggle('pick-bad', !ok && k + 1 === n); });  // outlines the clicked line: solid green if right, dashed red if wrong; any earlier outline is removed
            intro.innerHTML = `<b style="color:var(${ok ? '--ok' : '--bad'})">Line ${n}: ${ok ? 'yes, that is the one.' : 'not this one.'}</b> ` + (ok ? H.yes : (H.fb[n] || 'That line only opens or closes the loop or the function.') + ' Try another line.');  // replaces the intro with a verdict and the explanation, or the line's hint plus "Try another line"
          }  // ends guess
          function draw(i) {  // draw(i): the player calls this for frame i; it highlights code, redraws the diagram and returns the caption
            const fr = V[ver].frames[i], st = snaps[i];  // fr is the frame's description and st the precomputed state after it
            pCode.clear(); cCode.clear();  // clears both code boxes' highlights
            if (fr.p) pCode.mark(fr.p, fr.pc || 'cur');  // highlights the producer lines this frame ran (pc could override the colour; no frame sets it)
            if (fr.c) cCode.mark(fr.c, fr.cc || 'cur');  // highlights the consumer lines this frame ran, in red or green when the frame sets cc
            const kids = [];  // kids: the SVG shapes of the new diagram
            // coordinates: one wide strip, or a taller phone layout (3 buffer slots per row)
            const NW = ctx.narrow;  // NW is true on a phone-width screen
            const varX = (k) => (NW ? 8 + k * 88 : 14 + k * 92);  // varX(k): the horizontal position of variable box k
            const proc = (k) => (NW ? [8 + k * 176, 68, 168, 44] : [390 + k * 86, 8, 78, 52]);  // proc(k): position and size of the producer (k = 0) or consumer (k = 1) box
            const cell = (k) => (NW ? [8 + (k % 3) * 118, 138 + Math.floor(k / 3) * 84] : [14 + k * 90, 92]);  // cell(k): position of buffer slot k: one row on a wide screen, rows of three on a small one
            const cw = NW ? 104 : 78;  // cw: the width of a buffer slot
            // variables
            V[ver].vars.forEach((name, k) => {  // draws one box per variable of this version (n, s, delay and maybe m)
              const x = varX(k), val = name === 'm' ? (st.m == null ? '–' : st.m) : st[name];  // x is the box position; val is the variable's value, with a dash for m before it has been set
              const hot = (name === 'n' && st.n < 0 && ver !== 'counting') || (name === 'delay' && st.delay === 1 && ver === 'flawed');  // hot: true when the box should turn red: n below zero, or a stale delay = 1 in the flawed version
              kids.push(s('rect', { x, y: 8, width: 80, height: 52, rx: 10, class: hot ? 's-bad' : name === 'm' ? 's-proc' : 's-os', 'stroke-width': 2 }));  // the variable's box: red when hot, process colour for the private m, otherwise the operating-system colour
              kids.push(s('text', { x: x + 40, y: 25, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, name === 'n' && ver === 'counting' ? 'sem n' : name));  // the variable's name; in the counting version n is labelled "sem n" to show it is now a semaphore
              kids.push(s('text', { x: x + 40, y: 51, 'text-anchor': 'middle', 'font-size': 22, 'font-weight': 900 }, String(val)));  // the variable's value in large type
            });  // ends the variable loop
            // process states
            [['Producer', st.P, i && fr.p], ['Consumer', st.C, i && fr.c]].forEach(([nm, state, active], k) => {  // draws the producer and consumer boxes; a process is active when this frame ran some of its lines (never on frame 1)
              const [x, y, w, hh] = proc(k);  // unpacks the box's position and size
              kids.push(s('rect', { x, y, width: w, height: hh, rx: 10, class: state === 'blocked' ? 's-warn' : nm === 'Producer' ? 's-mem' : 's-proc', 'stroke-width': active ? 3.5 : 1.5 }));  // the box: amber when blocked, otherwise the producer or consumer colour, with a thicker border while active
              kids.push(s('text', { x: x + w / 2, y: y + (NW ? 18 : 21), 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800 }, nm));  // the process name
              kids.push(s('text', { x: x + w / 2, y: y + (NW ? 36 : 40), 'text-anchor': 'middle', 'font-size': 13, style: state === 'blocked' ? 'fill:var(--warn)' : '' }, state === 'blocked' ? 'Blocked' : active ? 'Running' : 'Ready'));  // its state: Blocked (amber), Running if active in this frame, or Ready
            });  // ends the process loop
            // buffer cells
            kids.push(s('text', { x: NW ? 8 : 14, y: NW ? 130 : 84, 'font-size': 13, class: 's-sub' }, 'buffer (never fills up)'));  // label above the buffer: this buffer never fills up
            for (let k = 0; k < 6; k++) {  // draws the first six buffer slots
              const [x, y] = cell(k), c = st.cells[k];  // position of slot k and its contents, if any
              const cls = !c ? 's-muted' : c.st === 'full' ? 's-mem' : c.st === 'ghost' ? 's-bad' : 's-panel';  // slot colour: dashed grey when empty, memory colour when full, red for a garbage read, plain once taken
              kids.push(s('rect', { x, y, width: cw, height: 44, rx: 8, class: cls, 'stroke-width': 2, 'stroke-dasharray': c ? null : '5 4' }));  // the slot's box
              kids.push(s('text', { x: x + cw / 2, y: y + 28, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700, style: c && c.st === 'ghost' ? 'fill:var(--bad)' : c && c.st === 'used' ? 'fill:var(--muted)' : '' }, !c ? `b[${k + 1}]` : c.st === 'full' ? 'item ' + c.id : c.st === 'used' ? 'taken' : 'nothing!'));  // text in the slot: its name when empty, otherwise the item number, "taken" or "garbage"
            }  // ends the slot loop
            const px = (p, dy) => { const [x, y] = cell(p - 1); return { x: x + cw / 2, y: y + dy }; };  // px(p, dy): the point under slot p (counting from 1) where a pointer label goes
            kids.push(s('text', { ...px(st.in, NW ? 60 : 63), 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, style: 'fill:var(--mem)' }, '▲ in'));  // the "in" pointer under slot in, in the producer's colour
            kids.push(s('text', { ...px(st.out, NW ? 76 : 81), 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, style: 'fill:var(--proc)' }, '▲ out'));  // the "out" pointer under slot out, a little lower, in the consumer's colour
            svg.replaceChildren(...kids);  // replaces the old drawing with the new one
            const cap = V[ver].frames[i].cap;  // the caption for this frame
            return st.bad ? `<span style="color:var(--bad)">${cap}</span>` : cap;  // returns the caption, coloured red once the bug has struck, for the player to show
          }  // ends draw
          load(ver);  // loads the flawed version first
          const player = ctx.ui.player({ count: V[ver].frames.length, render: draw, interval: 2600, speed: false });  // the step-by-step player (the guide's play, pause, back and next control); 2.6 seconds per frame, no speed buttons
          const seg = ctx.ui.seg([{ value: 'flawed', label: '1 · Flawed' }, { value: 'fixed', label: '2 · Fixed with m' }, { value: 'counting', label: '3 · Counting' }], ver, (v) => { player.stop(); load(v); player.setCount(V[v].frames.length); });  // buttons to choose the version; switching stops the player, loads the version and resets the frame count
          el.append(h('div', { class: 'stack fill', style: { gap: '8px' } },  // puts the step on the page as a vertical stack that fills the step
            h('div', { class: ctx.narrow ? 'row' : 'row nw', style: { gap: '14px' } }, h('div', { style: { flex: ctx.narrow ? '1 1 100%' : 'none' } }, seg), intro),  // top row: version buttons and the intro text; on a small screen the buttons take a full row of their own
            h('div', { class: 'grid-2' }, prodBox, consBox),  // the two code boxes side by side
            h('div', { class: 'split grow', style: { gap: '16px' } }, h('div', { class: 'card white tight', style: { display: 'grid', placeItems: 'center' } }, svg),  // lower area: the diagram in a white card on the left
              h('div', { class: 'stack', style: { gap: '10px' } }, player.el,  // right side: the player
                h('div', { class: 'row gap-s xs' }, h('span', { class: 'small b' }, 'Line colours:'), h('span', { class: 'chip io' }, 'just ran'), h('span', { class: 'chip bad' }, 'the risky moment'), h('span', { class: 'chip ok' }, 'the fix at work'))))));  // legend for the line colours: just ran, the risky moment, the fix at work; ends the page
        },  // ends render() for step 7
      },  // ends step 7

      /* ---------------- 7. Bounded buffer factory ---------------- */
      {  // step 8 starts here: a running factory with a bounded circular buffer, where swapping two semWaits causes deadlock
        title: 'The bounded-buffer factory (and how to break it)',  // the step's title, shown at the top of the page
        kind: 'lab',  // kind "lab" marks this as a Hands-on Lab page
        core: true,  // core: true keeps this step on the short route through the guide
        render(el, ctx) {  // render(el, ctx): builds the factory simulation when step 8 is shown
          const { h, s } = ctx;  // h builds HTML elements and s builds SVG elements
          const SIZE = 6, TICK = 90;  // SIZE: the buffer has 6 slots; TICK: the simulation advances every 90 milliseconds
          const DUR = { 1: 36, 2: 22, 3: 14, 4: 8, 5: 4 };  // DUR: how many ticks produce() or consume() takes at each speed setting, from 1 (slow) to 5 (fast)
          const PROG = {  // PROG: each process's six-line program, as [operation, code line shown]
            P: [['produce', 'produce();    // make an item'], ['wait e', 'semWait(e);   // need a free slot'], ['wait s', 'semWait(s);   // lock the buffer'], ['append', 'append();     // item into b[in]'], ['signal s', 'semSignal(s); // unlock the buffer'], ['signal n', 'semSignal(n); // +1 item ready']],  // the producer: produce, wait on e, wait on s, append, signal s, signal n
            C: [['wait n', 'semWait(n);   // need an item'], ['wait s', 'semWait(s);   // lock the buffer'], ['take', 'take();       // item from b[out]'], ['signal s', 'semSignal(s); // unlock the buffer'], ['signal e', 'semSignal(e); // +1 free slot'], ['consume', 'consume();    // use the item']],  // the correct consumer: wait on n, wait on s, take, signal s, signal e, consume
            Cbug: [['wait s', 'semWait(s);   // lock first (bug!)'], ['wait n', 'semWait(n);   // then need an item'], ['take', 'take();       // item from b[out]'], ['signal s', 'semSignal(s); // unlock the buffer'], ['signal e', 'semSignal(e); // +1 free slot'], ['consume', 'consume();    // use the item']],  // the buggy consumer: the same, but it waits on s before n
          };  // closes PROG
          // the factory starts stopped; Reset and the mode switch return it to that stopped state
          let bug = false, running = false, started = false, speed = { P: 4, C: 2 }, st, turn = 0, lastMsg = '';  // factory state: bug mode, running, started since reset, speeds, the model, whose turn is first, and the last message
          const svg = s('svg', { viewBox: ctx.narrow ? '0 0 360 336' : '0 0 480 400', width: '100%', style: { maxHeight: '100%' } });  // the factory diagram's SVG; a phone-width screen uses a smaller drawing area; it never grows taller than its box
          const narr = h('div', { class: 'narr', style: { minHeight: '66px' } });  // the explanation box under the factory
          const startInfo = h('span', { class: 'small muted' });  // header text describing the buffer size and starting values
          const side = {};  // side: the parts of each process's panel (code, state chip, counter, slider, note), filled in by panel()
          // prefill > 0 starts with that many items already in the buffer (n and e adjusted to match)
          function fresh(prefill = 0) {  // fresh(prefill): builds a brand-new, stopped factory, optionally with some items already in the buffer
            st = { sem: { s: { v: 1, q: [] }, n: { v: prefill, q: [] }, e: { v: SIZE - prefill, q: [] } }, buf: Array(SIZE).fill(null), inP: prefill, outP: 0, made: prefill, used: 0, dead: false,  // three semaphores (s = 1, n = items, e = empty slots), six empty slots, in and out pointers, counters, not deadlocked
              P: { pc: 0, left: null, blocked: null, item: null }, C: { pc: 0, left: null, blocked: null, item: null } };  // each process: pc (its next program line), left (ticks left on that line), blocked (semaphore it sleeps on), item
            for (let k = 0; k < prefill; k++) st.buf[k] = k + 1;  // puts the prefilled items, numbered 1, 2, 3 ..., into the first slots
            turn = 0; started = false;  // restarts the turn order and marks the factory as not yet started
            startInfo.innerHTML = `circular <span class="t">bounded buffer</span>, ${SIZE} slots · start: s = 1, n = ${prefill}, e = ${SIZE - prefill}`;  // header: a circular bounded buffer with 6 slots and the starting values of s, n and e
            // the side notes must describe the same starting values as the header above
            if (side.P) side.P.note.innerHTML = noteHTML('P', prefill);  // updates the producer's side note to match the starting values
            if (side.C) side.C.note.innerHTML = noteHTML('C', prefill);  // updates the consumer's side note to match the starting values
            lastMsg = '';  // forgets the last message so the explanation box is rewritten
          }  // ends fresh
          const prog = (who) => (who === 'P' ? PROG.P : bug ? PROG.Cbug : PROG.C);  // prog(who): the program for a process; in bug mode the consumer uses the swapped order
          function step(who) {  // step(who): advances one process by one tick
            const p = st[who];  // p is that process's state
            if (p.blocked || st.dead) return;  // a blocked process, or any process after deadlock, does not move
            const [op] = prog(who)[p.pc];  // op: the operation on the process's current line
            if (p.left == null) p.left = op === 'produce' ? DUR[speed.P] : op === 'consume' ? DUR[speed.C] : op === 'append' || op === 'take' ? 3 : 1;  // on starting a line, sets how many ticks it takes: produce and consume follow the speed sliders, buffer work 3, semaphore calls 1
            if (--p.left > 0) return;  // counts one tick down and waits until the line is finished
            p.left = null;  // clears the countdown ready for the next line
            const [verb, name] = op.split(' ');  // splits the operation, e.g. "wait e", into the verb "wait" and the semaphore name "e"
            if (verb === 'produce') p.item = ++st.made;  // produce: the process makes a new item with the next serial number
            else if (verb === 'wait') { if (semWaitOp(st.sem[name], who)) p.blocked = name; }  // wait: runs the shared semWait model on that semaphore; if it blocks, remember which semaphore the process sleeps on
            else if (verb === 'signal') { const w = semSignalOp(st.sem[name]); if (w) st[w].blocked = null; }  // signal: runs the shared semSignal model; if it wakes the other process, that process is no longer blocked
            else if (verb === 'append') { st.buf[st.inP] = p.item; st.inP = (st.inP + 1) % SIZE; }  // append: puts the item in slot in, then moves in forward, wrapping from the last slot back to 0 (% is remainder)
            else if (verb === 'take') { p.item = st.buf[st.outP]; st.buf[st.outP] = null; st.outP = (st.outP + 1) % SIZE; }  // take: copies the item out of slot out, empties the slot, and moves out forward with the same wrap-around
            else if (verb === 'consume') st.used++;  // consume: counts one more item used up
            p.pc = (p.pc + 1) % 6;  // moves to the next program line, going back to line 1 after line 6, so each process loops forever
            if (st.P.blocked && st.C.blocked) st.dead = true;  // if both processes are now blocked, neither can ever wake the other: the factory is deadlocked
          }  // ends step
          function tick() {  // tick(): runs every 90 milliseconds; moves both processes one tick forward and redraws
            if (!running || st.dead) return;  // does nothing while paused or after a deadlock
            const order = turn++ % 2 ? ['C', 'P'] : ['P', 'C'];  // alternates which process moves first on each tick so neither one always has priority
            order.forEach(step);  // advances the two processes in that order
            draw();  // redraws the factory
          }  // ends tick
          function at(who) { const p = st[who]; return p.blocked ? (p.pc + 5) % 6 : p.pc; }  // at(who): the program line to highlight; a blocked process has already moved on, so this points back at its wait line
          function draw() {  // draw(): redraws the semaphore boxes, the circular buffer, both side panels and the explanation
            const S = st.sem, kids = [];  // S is the three semaphores; kids collects the SVG shapes
            // phones get a smaller canvas (360 wide) so the labels stay readable when it is scaled down
            const NW = ctx.narrow, bw = NW ? 112 : 148, bx = NW ? 118 : 158;  // NW is true on a phone-width screen; bw is a semaphore box's width and bx the spacing between boxes
            [['s', 'lock'], ['n', 'items'], ['e', 'empty slots']].forEach(([k, lab], i) => {  // draws one box for each semaphore: s (the lock), n (items ready) and e (empty slots)
              const x = (NW ? 4 : 8) + i * bx, v = S[k].v;  // x is the box position and v the semaphore's value
              kids.push(s('rect', { x, y: 4, width: bw, height: NW ? 60 : 66, rx: 12, class: v < 0 ? 's-warn' : 's-os', 'stroke-width': 2 }));  // the box: amber when the value is negative (someone is asleep on it), otherwise the operating-system colour
              kids.push(s('text', { x: x + bw / 2, y: 24, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, NW ? k + ' · ' + lab.replace('empty slots', 'empty') : `${k} · ${lab}`));  // the label, such as "e · empty slots", shortened to "empty" on a small screen
              kids.push(s('text', { x: x + bw / 2, y: NW ? 55 : 60, 'text-anchor': 'middle', 'font-size': NW ? 26 : 28, 'font-weight': 900 }, String(v)));  // the value in large type
            });  // ends the semaphore boxes
            const cx = NW ? 180 : 240, cy = NW ? 206 : 240, R = NW ? 100 : 118, sw = NW ? 64 : 72, sh = NW ? 46 : 52;  // centre, radius and slot size of the circular buffer, smaller on a small screen
            const pos = (k) => { const a = (-90 + k * (360 / SIZE)) * Math.PI / 180; return [cx + R * Math.cos(a), cy + R * Math.sin(a), a]; };  // pos(k): the centre of slot k on the circle, starting at the top and going clockwise, plus its angle
            kids.push(s('circle', { cx, cy, r: R, class: 's-muted', 'stroke-dasharray': '3 6' }));  // a faint dotted circle that links the six slots into a ring
            // pointer = arrow from the hub toward a slot. It stops just short of the slot's edge (so the
            // arrowhead stays visible) and its label sits at the arrow's inner end; the hub is kept empty for them.
            const ptr = (k, lab, color, off) => {  // ptr(k, lab, color, off): draws a pointer arrow from the centre toward slot k with its label
              // off shifts the arrow sideways (parallel) when in and out point at the same slot
              const [, , a] = pos(k), ux = Math.cos(a), uy = Math.sin(a), qx = -uy * off, qy = ux * off, lx = qx * 1.9, ly = qy * 1.9;  // a is the slot's angle; (ux, uy) is the direction to it; (qx, qy) is the sideways shift; (lx, ly) shifts the label further
              const edge = Math.min(Math.abs(ux) > 1e-6 ? sw / 2 / Math.abs(ux) : 1e9, Math.abs(uy) > 1e-6 ? sh / 2 / Math.abs(uy) : 1e9);  // edge: how far the slot's box reaches from its centre along that direction, so the arrow can stop at its edge
              const r2 = R - edge - 5, r1 = Math.max(r2 - 34, 16), rl = r1 - 11;  // r2: where the arrowhead ends, just outside the slot; r1: where the arrow starts; rl: where the label sits
              kids.push(s('line', { x1: cx + r1 * ux + qx, y1: cy + r1 * uy + qy, x2: cx + r2 * ux + qx, y2: cy + r2 * uy + qy, style: `stroke:var(${color})`, 'stroke-width': 3, 'marker-end': `url(#arr-${color.slice(2)})` }));  // the arrow line, in the pointer's colour, with a matching coloured arrowhead supplied by the guide
              kids.push(s('text', { x: cx + rl * ux + lx, y: cy + rl * uy + ly + 5, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800, style: `fill:var(${color})` }, lab));  // the label ("in" or "out") at the inner end of the arrow
            };  // ends ptr
            const same = st.inP === st.outP;  // same: true when in and out point at the same slot (buffer completely empty or completely full)
            ptr(st.inP, 'in', '--mem', same ? -9 : 0);  // the "in" pointer in the producer's colour, nudged to one side if it shares a slot with out
            ptr(st.outP, 'out', '--proc', same ? 9 : 0);  // the "out" pointer in the consumer's colour, nudged to the other side
            for (let k = 0; k < SIZE; k++) {  // draws the six buffer slots around the ring
              const [x, y] = pos(k), item = st.buf[k];  // position of slot k and the item in it, if any
              kids.push(s('rect', { x: x - sw / 2, y: y - sh / 2, width: sw, height: sh, rx: 12, class: item ? 's-mem' : 's-muted', style: item ? null : 'fill:var(--panel)', 'stroke-width': 2, 'stroke-dasharray': item ? null : '5 4' }));  // the slot's box: memory colour with a solid border when full, dashed and plain when empty
              kids.push(s('text', { x, y: y + 5, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': item ? 800 : 500, class: item ? '' : 's-sub' }, item ? '#' + item : 'b[' + k + ']'));  // text in the slot: the item number, such as #4, or the slot's name, such as b[2], when empty
            }  // ends the slot loop
            // fill level, in the free bottom-left corner (the hub belongs to the pointers)
            const full = st.buf.filter(Boolean).length, fy = NW ? 314 : 374;  // full: how many slots hold an item; fy: where the fill level is written
            kids.push(s('text', { x: 8, y: fy, 'font-size': 20, 'font-weight': 900 }, `${full} / ${SIZE}`));  // the fill level, such as "4 / 6"
            kids.push(s('text', { x: 8, y: fy + 18, 'font-size': 13, class: st.dead ? '' : 's-sub', style: st.dead ? 'fill:var(--bad);font-weight:800' : '' }, st.dead ? 'stuck forever' : 'slots full'));  // under it: "slots full", or "stuck forever" in red after a deadlock
            svg.replaceChildren(...kids);  // replaces the old drawing with the new one
            ['P', 'C'].forEach((who) => {  // updates the producer's and consumer's side panels
              const p = st[who], sd = side[who];  // p is the process's state and sd its panel
              sd.code.clear();  // clears the highlights in its code box
              sd.code.mark(at(who) + 1, p.blocked ? 'bad' : 'cur');  // highlights its current line, in red when it is blocked there
              sd.state.className = 'chip ' + (p.blocked ? (st.dead ? 'bad' : 'warn') : 'ok');  // state chip colour: red after deadlock, amber when blocked, green otherwise
              sd.state.textContent = p.blocked ? `blocked on ${p.blocked}` : running ? 'running' : 'ready';  // state chip text: which semaphore it is blocked on, or running, or ready while paused
              sd.count.textContent = who === 'P' ? `items made: ${st.made}` : `items consumed: ${st.used}`;  // counter under the code: items made by the producer or consumed by the consumer
            });  // ends the panel updates
            let msg, tone = '';  // msg is the explanation to show; tone colours it
            if (!started) msg = bug ? 'The consumer now locks s <b>before</b> waiting on n. The buffer starts with 3 items and the consumer is set faster than the producer, so the buffer will drain. Press <b>Run</b> and watch the moment the buffer runs empty.'  // before Run is pressed: explains the setup, with a different message in bug mode
              : `The factory is stopped: an empty buffer with s = 1, n = 0 and e = ${SIZE}. Press <b>Run</b> to start the producer and the consumer, then try making one side much faster than the other.`;  // the normal-mode message: the factory is stopped with an empty buffer, press Run
            else if (st.dead) { msg = '<b><span class="t">Deadlock</span>.</b> The consumer locked the buffer (s) and then went to sleep on n because the buffer was empty, <b>still holding s</b>. The producer needs s to add the very item that would wake the consumer. Each waits for the other forever. Press Reset or switch back to the correct order.'; tone = 'bad'; }  // deadlock message: the consumer sleeps on n while holding s, and the producer needs s to add an item
            else if (st.P.blocked === 'e') msg = `<b>Buffer full.</b> The producer called semWait(e) with no free slot announced, so e went to ${S.e.v} and it sleeps until the consumer’s semSignal(e) hands it a slot.${full < SIZE ? ' (A slot the consumer is emptying right now counts only once it calls semSignal(e).)' : ''}`;  // buffer-full message: the producer sleeps on e until the consumer frees a slot
            else if (bug && st.C.blocked === 'n') { msg = `<b>Danger.</b> The buffer ran empty, so the consumer’s semWait(n) took n to ${S.n.v} and it fell asleep. But in this order it had <b>already locked s</b>, and it still holds it (s = ${S.s.v}). The producer needs s to add the item that would wake it…`; tone = 'bad'; }  // bug-mode warning: the consumer sleeps on n while still holding s, so deadlock is coming
            else if (st.C.blocked === 'n') msg = `<b>Buffer empty.</b> The consumer called semWait(n) with no item announced, so n went to ${S.n.v} and it sleeps until the producer’s semSignal(n). It holds nothing while it sleeps, so the producer can still get in.${full ? ' (An item the producer has just appended counts only once it calls semSignal(n).)' : ''}`;  // buffer-empty message: the consumer sleeps on n but holds nothing, so the producer can still get in
            else if (bug) msg = 'The consumer now locks s <b>before</b> waiting on n. The buffer starts with 3 items and the consumer is set faster than the producer, so the buffer will drain. While items remain, this happens to work. Watch the moment the buffer runs empty.';  // bug-mode message while items remain: the wrong order happens to work for now
            else msg = `Both processes are running: the producer puts items into the shared buffer and the consumer takes them out. n counts ready items and e counts empty slots, so each side waits only when it truly must. Try making one side much faster than the other.`;  // normal message: both processes are running and n and e make each side wait only when it must
            if (msg !== lastMsg) { narr.className = 'narr' + (tone ? ' ' + tone : ''); narr.innerHTML = msg; lastMsg = msg; }  // rewrites the explanation box only when the message has changed, so it does not flicker on every tick
          }  // ends draw
          function panel(who) {  // panel(who): builds the side panel for the producer (P) or the consumer (C)
            const code = ctx.ui.code(prog(who).map((x) => x[1]).join('\n'), { lang: 'c', fontSize: 13.5, nums: false });  // the process's six-line program in a code box without line numbers
            const stateChip = h('span', { class: 'chip' });  // chip that shows the process's state
            const count = h('div', { class: 'small muted' });  // counter line for items made or consumed
            const sl = ctx.ui.slider({ label: 'Speed', min: 1, max: 5, value: speed[who], format: (v) => ['', 'slow', 'calm', 'medium', 'quick', 'fast'][v], onInput: (v) => { speed[who] = v; } });  // speed slider from 1 to 5, shown as slow, calm, medium, quick or fast; it changes how long produce or consume takes
            const note = h('div', { class: 'callout small m0 ' + (who === 'P' ? 'tip' : 'why'), 'data-label': who === 'P' ? 'e = empty slots' : 'n = items ready', html: noteHTML(who, bug ? 3 : 0) });  // side note explaining e for the producer or n for the consumer, with the right starting values
            side[who] = { code, state: stateChip, count, slider: sl, note };  // remembers the panel's parts so draw() and fresh() can update them
            const wrap = h('div', { class: 'stack', style: { gap: '8px' } },  // stacks the panel's parts vertically
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0', style: { color: who === 'P' ? 'var(--mem)' : 'var(--proc)' } }, who === 'P' ? 'Producer' : 'Consumer'), stateChip),  // heading row: the process name in its colour, with the state chip on the right
              code, sl, count, note);  // then the code, the speed slider, the counter and the note
            return wrap;  // hands the finished panel back
          }  // ends panel
          // side note for each process; it names the real starting value of its semaphore for this run
          function noteHTML(who, prefill) {  // noteHTML(who, prefill): the side-note text for a process, matching how many items the buffer starts with
            if (who === 'P') {  // the producer's note
              return (prefill ? `e starts at ${SIZE - prefill} here: this run begins with ${prefill} items already in the buffer, so ${SIZE - prefill} slots are empty.` : `e starts at ${SIZE} because every slot begins empty.`) +  // where e starts and why: 6 when the buffer starts empty, fewer when it starts with items
                ` If semWait(e) takes e below 0, the buffer is full and the producer sleeps. append() fills b[in], then in = (in + 1) % ${SIZE}, so after b[${SIZE - 1}] it wraps to b[0].`;  // what semWait(e) does when the buffer is full, and how in wraps from the last slot back to b[0]
            }  // ends the producer's note
            return (prefill ? `n starts at ${prefill} here: this run begins with ${prefill} items already in the buffer.` : 'n starts at 0 because there are no items yet.') +  // the consumer's note: where n starts and why
              ` If semWait(n) takes n below 0, the buffer is empty and the consumer sleeps. take() empties b[out], then out = (out + 1) % ${SIZE}, chasing in around the circle.`;  // what semWait(n) does when the buffer is empty, and how out chases in around the circle
          }  // ends noteHTML
          fresh();  // builds the first factory, empty and stopped
          const left = panel('P'), right = panel('C');  // builds the producer's panel (left) and the consumer's panel (right)
          function rebuildConsumer() { const old = side.C; const nc = ctx.ui.code(prog('C').map((x) => x[1]).join('\n'), { lang: 'c', fontSize: 13.5, nums: false }); old.code.replaceWith(nc); old.code = nc; }  // rebuildConsumer(): replaces the consumer's code box when the order of its semWaits is switched
          const pauseBtn = h('button', { class: 'btn sm primary', type: 'button', onclick: () => { setRunning(!running); if (running) started = true; draw(); } }, 'Run');  // the Run/Pause button; running it for the first time marks the factory as started
          function setRunning(v) { running = v; pauseBtn.textContent = v ? 'Pause' : 'Run'; pauseBtn.classList.toggle('primary', !v); }  // setRunning(v): starts or pauses the factory and relabels the button (highlighted while it says Run)
          // Reset (and a mode switch) stop the ticker's work and load a fresh, stopped factory
          function restart() { setRunning(false); fresh(bug ? 3 : 0); draw(); }  // restart(): pauses and loads a fresh factory (with 3 items in bug mode), then redraws
          const bugSeg = ctx.ui.seg([{ value: false, label: 'Correct order' }, { value: true, label: 'Swapped semWaits (bug)' }], false, (v) => {  // buttons to choose the consumer's code: correct order or swapped semWaits
            bug = v; rebuildConsumer();  // remembers the choice and swaps in the matching consumer code
            // the bug hides while items remain: start with 3 items and a consumer faster than the producer so the buffer drains
            if (v) { side.P.slider.set(2, true); side.C.slider.set(5, true); }  // in bug mode, sets the producer slow and the consumer fast, so the buffer drains and the deadlock shows up quickly
            restart();  // loads a fresh, stopped factory for the chosen mode
          });  // ends the bug-mode handler
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },  // puts the step on the page as a vertical stack that fills the step
            h('div', { class: 'row', style: { justifyContent: 'space-between' } },  // top row: order buttons on the left, header and run controls on the right
              h('div', { class: 'row gap-s' }, h('span', { class: 'small b' }, 'Consumer code:'), bugSeg),  // label and the correct/swapped buttons
              h('div', { class: 'row gap-s' }, startInfo, pauseBtn, h('button', { class: 'btn sm', type: 'button', onclick: restart }, 'Reset'))),  // header text, the Run/Pause button and a Reset button; ends the top row
            h('div', { class: 'grow mw0', style: { display: 'grid', gridTemplateColumns: ctx.narrow ? '1fr' : 'minmax(0, 330px) minmax(0, 1fr) minmax(0, 330px)', gap: '16px', minHeight: 0 } },  // main area: three columns (producer panel, factory, consumer panel), or one column on a small screen
              left, h('div', { class: 'card white tight', style: { display: 'grid', placeItems: 'center', minHeight: 0 } }, svg), right),  // the producer's panel, the factory diagram in a white card, and the consumer's panel; ends the main area
            narr));  // the explanation box under everything; ends the page
          draw();  // draws the stopped factory straight away
          ctx.every(TICK, tick);  // starts the 90-millisecond ticker (ctx.every repeats a function and stops it when the student leaves the step)
        },  // ends render() for step 8
      },  // ends step 8

      /* ---------------- 8. Implementation: making the operations atomic ---------------- */
      {  // step 9 starts here: why semWait and semSignal must be atomic, shown with two processors
        title: 'Making semWait and semSignal atomic',  // the step's title, shown at the top of the page
        kind: 'compare',  // kind "compare" marks this as a Compare page
        render(el, ctx) {  // render(el, ctx): builds the side-by-side animation and code when step 9 is shown
          const { h, s } = ctx;  // h builds HTML elements and s builds SVG elements
          // each frame: shared memory + per-process register/status
          const RUNS = {  // RUNS: the two animations as lists of frames: count, flag, then [action, register, status] for processors A and B
            raw: [  // animation 1, "raw": semWait with no protection at all
              { cnt: 1, fl: null, A: ['calls semWait(s)', null, 'run'], B: ['calls semWait(s)', null, 'run'], cap: '<b>No protection.</b> A and B run on two processors and call semWait(s) at almost the same moment. s.count = 1, so exactly one of them should get in.' },  // frame 1: both processors call semWait(s) at nearly the same moment with the count at 1
              { cnt: 1, fl: null, A: ['reads count', 1, 'run'], B: ['calls semWait(s)', null, 'run'], cap: 'A copies s.count (1) into one of its registers so it can subtract.' },  // frame 2: A copies the count into its register
              { cnt: 1, fl: null, A: ['reads count', 1, 'run'], B: ['reads count', 1, 'run'], cap: 'B does the same, <b>before A has written anything back</b>. Both now hold the value 1.' },  // frame 3: B copies the count too, before A has written back
              { cnt: 0, fl: null, A: ['stores 0; 0 < 0? no', 0, 'cs'], B: ['reads count', 1, 'run'], cap: 'A stores 1 − 1 = 0. The test 0 < 0 is false, so A continues into its critical section.' },  // frame 4: A stores 0 and enters its critical section
              { cnt: 0, fl: null, A: ['in critical section', 0, 'cs'], B: ['stores 0; 0 < 0? no', 0, 'cs'], cap: 'B stores its own 1 − 1 = 0 over A’s result. Its test is false too, so <b>B also continues</b>.', bad: true },  // frame 5: B stores 0 over A's result and also enters (bad marks the frame red)
              { cnt: 0, fl: null, A: ['in critical section', 0, 'cs'], B: ['in critical section', 0, 'cs'], cap: '<b>Broken.</b> Both are inside, and s.count says 0 when it should be −1 with B asleep. The semaphore’s own code had a <span class="t">race condition</span>, because semWait was not atomic.', bad: true },  // frame 6: both are inside and the count is wrong: a race condition in semWait itself
            ],  // ends the raw animation
            cas: [  // animation 2, "cas": semWait guarded by a flag set with compare_and_swap
              { cnt: 1, fl: 0, A: ['calls semWait(s)', null, 'run'], B: ['calls semWait(s)', null, 'run'], cap: '<b>With a flag guarded by compare_and_swap (CAS for short).</b> Same start: s.count = 1, and a small field s.flag = 0 means “nobody is inside semWait or semSignal”.' },  // frame 1: same start, plus a flag that is 0 while nobody is inside the semaphore's code
              { cnt: 1, fl: 1, A: ['CAS(flag,0,1) → 0; A got the flag', null, 'run'], B: ['calls semWait(s)', null, 'run'], cap: 'A runs compare_and_swap(s.flag, 0, 1). It returns the old value 0, which means A <b>won</b> the flag (flag is now 1). The hardware reads, compares and writes the flag in one indivisible step, so B cannot win it too.' },  // frame 2: A's compare_and_swap wins the flag in one indivisible hardware step
              { cnt: 0, fl: 1, A: ['count: 1 → 0', 0, 'run'], B: ['CAS(flag,0,1) → 1; flag busy: spin', null, 'spin'], cap: 'B’s compare_and_swap returns 1: the flag is taken, so B <b>busy-waits</b> in its tiny loop. Meanwhile A, the only process allowed in, decrements s.count: 1 → 0.' },  // frame 3: B finds the flag taken and spins briefly while A decrements the count
              { cnt: 0, fl: 0, A: ['0 < 0? no; flag = 0', 0, 'cs'], B: ['CAS(flag,0,1) → 1; flag busy: spin', null, 'spin'], cap: 'A’s test is false, so A clears the flag and enters its critical section. B spun for only a few instructions.' },  // frame 4: A clears the flag and enters its critical section
              { cnt: -1, fl: 1, A: ['in critical section', 0, 'cs'], B: ['CAS → 0: got it; count: 0 → −1', -1, 'run'], cap: 'B’s compare_and_swap now succeeds. It decrements s.count: 0 → −1. Negative, so B must block.' },  // frame 5: B wins the flag and decrements the count to -1
              { cnt: -1, fl: 0, A: ['in critical section', 0, 'cs'], B: ['queued, blocked; flag = 0', -1, 'blocked'], cap: '<b>Correct.</b> B joins s.queue and blocks, and the flag is released as part of blocking. One process inside, one asleep, s.count = −1.' },  // frame 6: B joins the queue and blocks, releasing the flag; the result is correct
            ],  // ends the cas animation
          };  // closes RUNS
          let mode = 'raw';  // mode: which animation is on show, starting with the unprotected one
          const svg = s('svg', { viewBox: ctx.narrow ? '0 0 360 230' : '0 0 540 160', width: '100%' });  // the diagram's SVG; a phone-width screen uses a taller drawing area
          function lane(x, name, info, out, oy = 0) {  // lane(x, name, info, out, oy): draws one processor's column at x, shifted down by oy, and adds it to out
            const [act, reg, stt] = info, kids = [];  // unpacks the frame's action text, register value and status for this processor
            const cls = stt === 'cs' ? 's-mem' : stt === 'spin' ? 's-intr' : stt === 'blocked' ? 's-warn' : 's-proc';  // token colour by status: memory colour inside the critical section, interrupt colour when spinning, amber when blocked
            kids.push(s('rect', { x, y: 4, width: 170, height: 152, rx: 14, class: 's-cpu', 'stroke-width': 1.5, 'fill-opacity': 0.5 }));  // the processor's background box, half transparent
            kids.push(s('text', { x: x + 85, y: 24, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800, style: 'fill:var(--cpu)' }, `processor ${name === 'A' ? 1 : 2}`));  // the heading "processor 1" or "processor 2"
            kids.push(token(s, x + 42, 58, name, cls, 46, 46));  // the process token (A or B)
            kids.push(s('text', { x: x + 118, y: 46, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, 'register'));  // the label "register" next to it
            kids.push(s('rect', { x: x + 88, y: 52, width: 60, height: 28, rx: 6, class: 's-cpu', 'stroke-width': 1.5 }));  // the small box that holds the register's value
            kids.push(s('text', { x: x + 118, y: 72, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 800, class: 's-monot' }, reg == null ? '–' : String(reg)));  // the register's value, or a dash when it holds nothing yet
            act.split('; ').forEach((w, i) => kids.push(s('text', { x: x + 85, y: 102 + i * 18, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700 }, w)));  // the action text, split at "; " so each part gets its own line
            kids.push(s('text', { x: x + 85, y: 146, 'text-anchor': 'middle', 'font-size': 13, style: `fill:var(${stt === 'cs' ? '--mem' : stt === 'spin' ? '--intr' : stt === 'blocked' ? '--warn' : '--muted'})`, 'font-weight': 700 }, stt === 'cs' ? 'inside critical section' : stt === 'spin' ? 'busy waiting' : stt === 'blocked' ? 'asleep in s.queue' : 'running semWait'));  // status line at the bottom, coloured to match: inside critical section, busy waiting, asleep in s.queue or running semWait
            out.push(s('g', { transform: `translate(0 ${oy})` }, ...kids));  // wraps the column in a group moved down by oy, and adds it to the drawing
          }  // ends lane
          function draw(i) {  // draw(i): the player calls this for frame i; it redraws the diagram and returns the caption
            const f = RUNS[mode][i], kids = [];  // f is the frame; kids collects the SVG shapes
            if (ctx.narrow) {  // small-screen layout
              // phone: shared memory on top, the two processors side by side underneath
              lane(4, 'A', f.A, kids, 72); lane(186, 'B', f.B, kids, 72);  // the two processor columns side by side, moved down to leave room for memory on top
              kids.push(s('rect', { x: 40, y: 2, width: 280, height: 64, rx: 14, class: f.bad ? 's-bad' : 's-mem', 'stroke-width': 2 }));  // the shared-memory box across the top, red when this frame shows the bug
              kids.push(s('text', { x: 180, y: 19, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, style: 'fill:var(--mem)' }, 'shared memory'));  // its heading, "shared memory"
              const cx = f.fl == null ? 180 : 125;  // position of the count: centred, or moved left to make room for the flag
              kids.push(s('text', { x: cx, y: 36, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, 's.count'));  // the label "s.count"
              kids.push(s('text', { x: cx, y: 60, 'text-anchor': 'middle', 'font-size': 22, 'font-weight': 900 }, String(f.cnt)));  // the count's value
              if (f.fl != null) {  // only the compare_and_swap animation has a flag
                kids.push(s('text', { x: 235, y: 36, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, 's.flag'));  // the label "s.flag"
                kids.push(s('text', { x: 235, y: 60, 'text-anchor': 'middle', 'font-size': 22, 'font-weight': 900, style: f.fl ? 'fill:var(--intr)' : '' }, String(f.fl)));  // the flag's value, in the interrupt colour while it is set
              }  // ends the flag part
              svg.replaceChildren(...kids);  // replaces the old drawing with the new one
              return f.bad ? `<span style="color:var(--bad)">${f.cap}</span>` : f.cap;  // returns the caption, in red for a bad frame
            }  // ends the small-screen layout
            lane(4, 'A', f.A, kids); lane(366, 'B', f.B, kids);  // wide layout: processor A on the left and processor B on the right
            kids.push(s('text', { x: 270, y: 24, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800, style: 'fill:var(--mem)' }, 'shared memory'));  // the heading "shared memory" in the middle
            kids.push(s('rect', { x: 190, y: 34, width: 160, height: f.fl == null ? 84 : 118, rx: 14, class: f.bad ? 's-bad' : 's-mem', 'stroke-width': 2 }));  // the shared-memory box between them, taller when it also shows the flag, red for a bad frame
            kids.push(s('text', { x: 270, y: 56, 'text-anchor': 'middle', 'font-size': 14, class: 's-sub' }, 's.count'));  // the label "s.count"
            kids.push(s('text', { x: 270, y: 98, 'text-anchor': 'middle', 'font-size': 34, 'font-weight': 900 }, String(f.cnt)));  // the count's value in large type
            if (f.fl != null) {  // only the compare_and_swap animation has a flag
              kids.push(s('text', { x: 270, y: 122, 'text-anchor': 'middle', 'font-size': 14, class: 's-sub' }, 's.flag'));  // the label "s.flag"
              kids.push(s('text', { x: 270, y: 146, 'text-anchor': 'middle', 'font-size': 22, 'font-weight': 900, style: f.fl ? 'fill:var(--intr)' : '' }, String(f.fl)));  // the flag's value, in the interrupt colour while it is set
            }  // ends the flag part
            svg.replaceChildren(...kids);  // replaces the old drawing with the new one
            return f.bad ? `<span style="color:var(--bad)">${f.cap}</span>` : f.cap;  // returns the caption, in red for a bad frame
          }  // ends draw
          const player = ctx.ui.player({ count: RUNS.raw.length, render: draw, interval: 2400, speed: false });  // the step player for the animation, 2.4 seconds per frame, no speed buttons
          const seg = ctx.ui.seg([{ value: 'raw', label: 'Not atomic' }, { value: 'cas', label: 'Guarded by compare_and_swap' }], mode, (v) => { mode = v; player.stop(); player.setCount(RUNS[v].length); });  // buttons to choose the animation; switching stops the player and resets its frame count
          const casCode = `${/* casCode: pseudo-code for semaphores protected by compare_and_swap, shown to the student */''}
semWait(s) {                                 // multiprocessor-safe${/* shown code, line 1: start of the safe semWait */''}
    while (compare_and_swap(s.flag, 0, 1) == 1) // busy? spin${/* shown code, line 2: spin while compare_and_swap reports the flag is already taken */''}
        /* do nothing */;                    // ...briefly${/* shown code, line 3: the empty body of that short spin loop */''}
    s.count--;                               // take one unit${/* shown code, line 4: take one unit */''}
    if (s.count < 0) {                       // none left:${/* shown code, line 5: test for none left */''}
        place this process in s.queue;       // join the line${/* shown code, line 6: join the queue */''}
        block it; also set s.flag to 0;      // sleep, free flag${/* shown code, line 7: block and clear the flag in the same step */''}
    }                                        // (else go on)${/* shown code, line 8: end of the blocking branch */''}
    s.flag = 0;                              // free the flag${/* shown code, line 9: clear the flag */''}
}                                            // end semWait${/* shown code, line 10: end of semWait */''}
semSignal(s) {                               // same guard${/* shown code, line 11: start of the safe semSignal, using the same guard */''}
    while (compare_and_swap(s.flag, 0, 1) == 1) // busy? spin${/* shown code, line 12: the same short spin on the flag */''}
        /* do nothing */;                    // ...briefly${/* shown code, line 13: the empty body of that spin loop */''}
    s.count++;                               // give a unit back${/* shown code, line 14: give one unit back */''}
    if (s.count <= 0) {                      // someone waits:${/* shown code, line 15: test whether someone is waiting */''}
        remove a process P from s.queue;     // pick a waiter${/* shown code, line 16: take a waiter out of the queue */''}
        place process P on ready list;       // make it Ready${/* shown code, line 17: make that waiter ready */''}
    }                                        // (else nobody)${/* shown code, line 18: end of the wake-up branch */''}
    s.flag = 0;                              // free the flag${/* shown code, line 19: clear the flag */''}
}                                            // end semSignal`;  // shown code, line 20: end of semSignal; ends casCode
          const intCode = `${/* intCode: pseudo-code for semaphores protected by turning interrupts off, for a single processor */''}
semWait(s) {                             // one-CPU version${/* shown code, line 1: start of the single-processor semWait */''}
    inhibit interrupts;                  // nobody can cut in${/* shown code, line 2: turn interrupts off so no other process can run in the middle */''}
    s.count--;                           // take one unit${/* shown code, line 3: take one unit */''}
    if (s.count < 0) {                   // none left:${/* shown code, line 4: test for none left */''}
        place this process in s.queue;   // join the line${/* shown code, line 5: join the queue */''}
        block it; allow interrupts;      // sleep, re-enable${/* shown code, line 6: block and turn interrupts back on */''}
    }                                    // end of none-left case${/* shown code, line 7: end of the none-left branch */''}
    else allow interrupts;               // passed: re-enable${/* shown code, line 8: otherwise turn interrupts back on and carry on */''}
}                                        // end semWait${/* shown code, line 9: end of semWait */''}
semSignal(s) {                           // one-CPU version${/* shown code, line 10: start of the single-processor semSignal */''}
    inhibit interrupts;                  // nobody can cut in${/* shown code, line 11: turn interrupts off */''}
    s.count++;                           // give a unit back${/* shown code, line 12: give one unit back */''}
    if (s.count <= 0) {                  // someone waits:${/* shown code, line 13: test whether someone is waiting */''}
        remove a process P from s.queue; // pick a waiter${/* shown code, line 14: take a waiter out of the queue */''}
        place process P on ready list;   // make it Ready${/* shown code, line 15: make that waiter ready */''}
    }                                    // (else nobody)${/* shown code, line 16: end of the wake-up branch */''}
    allow interrupts;                    // re-enable${/* shown code, line 17: turn interrupts back on */''}
}                                        // end semSignal`;  // shown code, line 18: end of semSignal; ends intCode
          const tabs = ctx.ui.tabs([  // tabs on the right: one per way of making the operations atomic
            { label: 'Hardware: compare_and_swap', render: (p) => { p.append(h('div', { class: 'stack', style: { gap: '8px' } }, ctx.ui.code(casCode, { lang: 'c', fontSize: 13, cls: 'tight' }),  // tab 1: the compare_and_swap code
              h('div', { class: 'callout tip small m0', 'data-label': 'Still busy waiting?', html: 'Yes, but only while another process is inside semWait or semSignal: a few instructions, never a whole critical section (the cheap kind of <span class="t">spinlock</span> from 5.3).' }))); } },  // tip box for tab 1: the spin lasts only while another process is inside the semaphore code, a few instructions
            { label: 'One CPU: disable interrupts', render: (p) => { p.append(h('div', { class: 'stack', style: { gap: '8px' } }, ctx.ui.code(intCode, { lang: 'c', fontSize: 13, cls: 'tight' }),  // tab 2: the interrupt-disabling code
              h('div', { class: 'callout warn small m0', 'data-label': 'Only on a uniprocessor', html: 'With one processor, a process can lose the CPU only through an interrupt, so blocking interrupts makes the few statements indivisible. On a multiprocessor another core can still reach the semaphore, so this trick is not enough there.' }))); } },  // warning box for tab 2: this works only with one processor, because other processors keep running
          ]);  // closes the tab list and builds the tabs
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: 'minmax(0, 11fr) minmax(0, 12fr)', gap: '20px' } },  // puts the step on the page: the animation on the left, the code tabs on the right
            h('div', { class: 'stack', style: { gap: '8px' } },  // left column starts
              h('p', { class: 'm0 small', html: 'semWait and semSignal change shared data too, so each must be <span class="t" data-t="atomic operation">atomic</span>: only one process at a time may run either operation on a given semaphore.' }),  // intro sentence: the operations change shared data, so each must be atomic
              seg,  // the animation choice buttons
              h('div', { class: 'card white tight' }, svg),  // the diagram in a white card
              player.el,  // the player controls and caption
              h('div', { class: 'callout why small m0', 'data-label': 'Why it matters' }, 'A software lock such as Peterson’s algorithm would also work, but it is slow. Real systems use one of the two hardware routes shown here, which guard only a few instructions, so every longer wait can sleep instead of spin.')),  // why box: a software lock would work but is slow, so real systems use these hardware routes; ends the left column
            h('div', { class: 'stack fill' }, tabs)));  // right column: the tabs; ends the page
        },  // ends render() for step 9
      },  // ends step 9

      /* ---------------- 9. Recap ---------------- */
      {  // step 10 starts here: a recap with flip cards
        title: 'Recap: eight things to remember',  // the step's title, shown at the top of the page
        kind: 'recap',  // kind "recap" marks this as a Recap page, always kept on the short route
        render(el, ctx) {  // render(el, ctx): builds the recap cards when step 10 is shown
          const { h } = ctx;  // h builds HTML elements
          el.append(h('div', { class: 'stack fill', style: { gap: '12px' } },  // puts the recap on the page as a vertical stack
            h('p', { class: 'lead m0' }, 'Say each answer out loud before you flip the card.'),  // instruction: answer out loud before flipping each card
            ctx.ui.flipcards([  // flip cards (the guide's helper that shows a prompt on the front and the answer on the back)
              ['semWait(s)', 'Subtract 1. If the result is negative, the caller is placed in the queue and blocked.'],  // card 1: what semWait does
              ['semSignal(s)', 'Add 1. If the result is ≤ 0, move one waiter to Ready. The caller itself never blocks.'],  // card 2: what semSignal does
              ['Reading the value', 'Positive: how many more semWaits can pass. Negative: its magnitude is the number of blocked processes.'],  // card 3: how to read a semaphore's value
              ['Binary, counting, mutex', 'Binary holds only 0 or 1. Counting holds any integer. A mutex is binary plus ownership: only the locker may unlock.'],  // card 4: binary, counting and mutex compared
              ['Strong vs weak', 'Strong releases waiters first in, first out, so none can starve. Weak leaves the order unspecified.'],  // card 5: strong versus weak release order
              ['Mutual exclusion recipe', 's starts at 1; semWait(s); critical section; semSignal(s). Three arrivals take s to 1 → 0 → −1 → −2.'],  // card 6: the mutual-exclusion recipe and the values three arrivals produce
              ['Bounded buffer recipe', 's = 1, n = 0, e = size. Producer: wait e, wait s, append, signal s, signal n. Consumer: wait n, wait s, take, signal s, signal e.'],  // card 7: the bounded-buffer recipe for producer and consumer
              ['Why atomic?', 'The operations update shared data. Guard them with compare_and_swap (a short spin) or, on one CPU, by disabling interrupts.'],  // card 8: why the operations must be atomic and how
            ], { cols: 4, height: 186 }),  // lays the eight cards out in four columns, each 186px tall
            h('div', { class: 'callout warn m0', 'data-label': 'The two classic traps' }, 'Testing a shared variable after you have released its lock (the flawed infinite buffer), and taking the lock before waiting for a resource (the swapped bounded-buffer consumer, which deadlocks).')));  // warning box: the two classic traps from the earlier labs; ends the page
        },  // ends render() for step 10
      },  // ends step 10

      /* ---------------- 10. Quiz ---------------- */
      {  // step 11 starts here: the end-of-section quiz
        title: 'Check yourself',  // the step's title, shown at the top of the page
        kind: 'check',  // kind "check" marks this as a Check Yourself page
        quiz: [  // quiz: the questions, which the guide's quiz engine displays and marks
          { q: 'A counting semaphore <code>s</code> has the value 0. Process P calls <code>semWait(s)</code>. What happens?',  // question 1 (multiple choice): what happens when semWait is called with the value at 0
            choices: ['s becomes −1 and P blocks.', 's stays 0 and P blocks.', 's becomes −1 and P continues.', 'P busy-waits until s becomes positive.'], answer: 0,  // the four choices; answer 0 means the first choice is correct
            feedback: [null, 'That is how a binary semaphore behaves. A counting semaphore always decrements, so the value becomes −1.', 'A process continues only if the result is zero or more; −1 is negative, so P must block.', 'A semaphore puts the caller to sleep in its queue; it does not make it spin.'],  // feedback for each wrong choice (null for the right one, which needs none)
            why: 'semWait always subtracts 1 first. A negative result means no unit was available, so the caller joins the queue and is blocked.' },  // explanation shown after answering: semWait subtracts first, then blocks on a negative result
          { type: 'num', q: 'A counting semaphore s counts the results produced by process D and starts at 1. Consumers A, B and C each call semWait(s) once, in that order, and then D calls semSignal(s) once. What is the value of s now?', answer: -1, tol: 0, hint: 'Apply one −1 per semWait and one +1 per semSignal.',  // question 2 (calculate): value after three consumer waits and one producer signal, starting at 1; the answer is -1
            why: '1 − 3 = −2 after the three waits: A passed, B and C are blocked. D’s signal gives −2 + 1 = −1 and releases B, the front waiter; the −1 says C is still waiting.' },  // explanation: 1 - 3 = -2, then the signal brings it to -1 and releases B
          { type: 'num', q: 'Three processes share a critical section guarded by a semaphore initialized to 1. Each calls semWait in turn, and none has left the critical section yet. What is the semaphore’s value?', answer: -2, tol: 0, hint: 'The answer may be negative. Count one step per semWait.',  // question 3 (calculate): value after three processes call semWait on a semaphore that starts at 1; tol 0 demands the exact answer
            why: '1 → 0 (the first enters) → −1 (the second blocks) → −2 (the third blocks). The magnitude 2 is the number of waiting processes.' },  // explanation: 1, 0, -1, -2, and the magnitude 2 counts the waiters
          { type: 'tf', q: 'A binary semaphore has the value 1 and no process is waiting on it. After one more semSignalB, its value is 2.', answer: false,  // question 4 (true or false): a binary semaphore cannot rise to 2
            why: 'A binary semaphore can only hold 0 or 1. With nobody waiting, semSignalB just sets the value to 1, so a second signal in a row is lost. Counting extra signals needs a counting semaphore.' },  // explanation: the extra signal is lost; counting signals needs a counting semaphore
          { type: 'multi', q: 'Which statements follow directly from the definition of a semaphore?',  // question 5 (select all): which statements follow from the definition of a semaphore
            choices: ['A process cannot know in advance whether its semWait will block.', 'After a semSignal that wakes a waiter, the order in which the two processes continue is not specified.', 'A process calling semSignal cannot tell whether any process was waiting.', 'semSignal releases every waiting process at once.', 'A semaphore’s value can never be negative.'], answer: [0, 1, 2],  // five choices; the first three are correct
            why: 'The first three are the standard consequences. semSignal releases at most one process, and a negative value is normal: it counts the waiters.' },  // explanation: the three standard consequences, and why the other two are false
          { q: 'Which kind of semaphore guarantees that a blocked process cannot be passed over forever?',  // question 6 (multiple choice): which semaphore rules out starvation
            choices: ['A strong semaphore, which releases waiters first in, first out', 'A weak semaphore, because it chooses at random', 'A binary semaphore', 'Any semaphore, because semSignal wakes the newest waiter'], answer: 0,  // the four choices; the strong semaphore is correct
            feedback: [null, 'A random choice can skip the same unlucky process again and again, which is starvation.', 'Binary versus counting is about the range of values, not the order in which waiters are released.', 'Release order is exactly what differs between semaphores, and newest-first would let the oldest waiter starve.'],  // feedback for each wrong choice
            why: 'A strong semaphore serves its queue in arrival order, so every waiter eventually reaches the front. A weak semaphore makes no such promise.' },  // explanation: a strong semaphore serves waiters in arrival order
          { type: 'match', q: 'Match each concurrency mechanism to its description.',  // question 7 (match): each concurrency tool to its description
            pairs: [['Semaphore', 'An integer changed only by initialize, semWait and semSignal'], ['Mutex', 'Only the process that locked it may unlock it'], ['Spinlock', 'A waiter loops, testing the lock until it frees up'], ['Event flags', 'Each bit of a memory word stands for one event'], ['Mailbox', 'Holds messages until a receiver collects them'], ['Monitor', 'Bundles shared data with the only procedures allowed to use it']],  // the six pairs: semaphore, mutex, spinlock, event flags, mailbox and monitor
            why: 'These are the common tools. Semaphores and mutexes block the waiter; a spinlock makes it busy-wait; event flags and mailboxes signal events and data; a monitor is a language-level construct.' },  // explanation: which tools block, which spin, and which signal events or data
          { type: 'order', q: 'Put the bounded-buffer producer’s loop body in order.',  // question 8 (put in order): the bounded-buffer producer's loop body
            items: ['produce()', 'semWait(e)', 'semWait(s)', 'append()', 'semSignal(s)', 'semSignal(n)'],  // the six steps, listed in the correct order (the quiz shuffles them)
            why: 'Make the item, claim an empty slot (e), lock the buffer (s), add the item, unlock, then announce the new item (n).' },  // explanation: the reason for each step in the order
          { type: 'bucket', q: 'Bounded buffer: sort each fact to the semaphore (s, n or e) it describes.', buckets: ['s', 'n', 'e'],  // question 9 (sort into groups): facts about the bounded buffer's s, n and e
            items: [['Initialized to 1', 0], ['Initialized to 0', 1], ['Initialized to the buffer size', 2], ['The consumer waits on it before taking an item', 1], ['The producer waits on it when every slot is full', 2], ['Keeps append() and take() from overlapping', 0]],  // the facts, each tagged with the group it belongs to (0 = s, 1 = n, 2 = e)
            why: 's is the lock (starts at 1), n counts items (starts at 0), and e counts empty slots (starts at the buffer size).' },  // explanation: s is the lock, n counts items and e counts empty slots
          { q: 'In the bounded-buffer consumer, what can happen if <code>semWait(s)</code> is called before <code>semWait(n)</code>?',  // question 10 (multiple choice): what goes wrong if the consumer waits on s before n
            choices: ['Deadlock: with an empty buffer the consumer sleeps on n while holding s, so the producer can never add an item', 'Nothing: the order of the two semWait calls never matters', 'The consumer may take an item that does not exist', 'The producer may overwrite an item that has not been consumed'], answer: 0,  // choice 1 (correct): deadlock, because the consumer sleeps on n while holding s; then the wrong choices
            feedback: [null, 'It matters as soon as the buffer is empty, which is exactly when the consumer blocks.', 'n still stops the consumer from taking from an empty buffer; it blocks instead, and blocking while holding s is the problem.', 'e still protects the producer’s slots; the issue is the consumer holding the lock while asleep.'],  // feedback for each wrong choice of question 10
            why: 'The consumer grabs s, then blocks on n. The producer finishes an item but blocks on s, which the sleeping consumer holds. Each waits for the other forever.' },  // explanation: the consumer holds s while asleep on n, and the producer needs s, so each waits forever
          { q: 'In the flawed binary-semaphore producer/consumer with an infinite buffer (variables n and delay), why can the consumer end up consuming an item that does not exist?',  // question 11 (multiple choice): why the flawed infinite-buffer solution can consume a missing item
            choices: ['It tests n outside the critical section, so the producer can change n in between and leave a stale signal in delay', 'The producer forgets to lock the buffer before appending', 'delay is initialized to 1 instead of 0', 'Binary semaphores cannot provide mutual exclusion'], answer: 0,  // the four choices; the first, testing n outside the critical section, is correct
            feedback: [null, 'The producer does lock s around append and n++.', 'delay starts at 0 in that solution; the problem comes later, from timing.', 's works perfectly well as a lock; the bug is reading n after releasing it.'],  // feedback for each wrong choice
            why: 'The unmatched signal stored in delay later lets the consumer pass semWaitB(delay) when the buffer is empty. Saving n into a private m inside the critical section, or using a counting semaphore, fixes it.' },  // explanation: the stale signal in delay lets the consumer through an empty buffer; saving n in m fixes it
          { q: 'On a single-processor machine, what is a simple way to make semWait and semSignal atomic?',  // question 12 (multiple choice): how to make the operations atomic on a single processor
            choices: ['Disable interrupts at the start of the operation and re-enable them at the end', 'Protect the semaphore with a second semaphore', 'Give every process the same priority', 'Busy-wait for the whole critical section'], answer: 0,  // the four choices; disabling interrupts is correct
            feedback: [null, 'The second semaphore’s operations would need protecting too, so the problem just moves.', 'Equal priorities do not stop an interrupt from switching processes halfway through the operation.', 'That is the waste semaphores exist to avoid; only the few instructions inside the operation need protecting.'],  // feedback for each wrong choice
            why: 'On one processor a process loses the CPU only through an interrupt, so blocking interrupts makes those few statements indivisible. Multiprocessors instead use an instruction such as compare_and_swap.' },  // explanation: on one processor only an interrupt can switch processes, so blocking interrupts is enough
        ],  // closes the quiz list
      },  // ends step 11
    ],  // closes the steps list
    notes: `${/* notes: the section summary shown in the Notes drawer and in the printable version, written as HTML */''}
<h3>The core idea: stop here until you get a signal</h3>${/* notes heading: the core idea of stopping until a signal arrives */''}
<p>Processes can cooperate using simple signals: a process can be forced to halt at a chosen point in its code until a particular signal arrives. The variable that carries signals is a <b>semaphore</b>: <code>semSignal(s)</code> sends one, <code>semWait(s)</code> receives one, and if no signal has been sent yet the receiver is suspended until it is.</p>${/* notes paragraph: semaphores carry signals through semSignal and semWait */''}
<h4>The concurrency toolbox</h4>${/* notes subheading: the concurrency toolbox */''}
<table>${/* start of the toolbox table */''}
  <tr><th>Mechanism</th><th>What it is</th></tr>${/* toolbox table header row: mechanism and what it is */''}
  <tr><td>Semaphore</td><td>Integer changed only by initialize, semWait, semSignal.</td></tr>${/* toolbox row: semaphore */''}
  <tr><td>Binary semaphore</td><td>Semaphore holding only 0 or 1.</td></tr>${/* toolbox row: binary semaphore */''}
  <tr><td>Mutex</td><td>Binary lock; the process that locks it (sets 0) must be the one to unlock it (set 1).</td></tr>${/* toolbox row: mutex and its ownership rule */''}
  <tr><td>Condition variable</td><td>Queue a process joins to wait until some condition holds (5.5).</td></tr>${/* toolbox row: condition variable */''}
  <tr><td>Monitor</td><td>Language construct bundling shared data and its procedures; one process active inside at a time.</td></tr>${/* toolbox row: monitor */''}
  <tr><td>Event flags</td><td>Memory word, one bit per event; wait for one, any or all flags.</td></tr>${/* toolbox row: event flags */''}
  <tr><td>Mailboxes / messages</td><td>Messages wait in a mailbox until received; waiting for one also synchronizes.</td></tr>${/* toolbox row: mailboxes and messages */''}
  <tr><td>Spinlock</td><td>Waiter busy-waits in a loop until the lock is free.</td></tr>${/* toolbox row: spinlock */''}
</table>${/* end of the toolbox table */''}
<h3>Definition: one integer, three operations</h3>${/* notes heading: the definition, one integer and three operations */''}
<ol>${/* start of the numbered list of operations */''}
  <li><b>Initialize</b> the semaphore to a nonnegative integer.</li>${/* list item: initialize to a value of zero or more */''}
  <li><b>semWait(s)</b> decrements the value; if it becomes negative, the caller is blocked in the semaphore's queue, otherwise it continues.</li>${/* list item: what semWait does */''}
  <li><b>semSignal(s)</b> increments the value; if it is then ≤ 0, one blocked process is moved to Ready. The caller never blocks.</li>${/* list item: what semSignal does */''}
</ol>${/* end of the operations list */''}
<pre>semWait(s):   s.count--;  if (s.count &lt; 0)  { add caller to s.queue; block it; }${/* preformatted summary line 1: semWait in one line (&lt; is how HTML writes the less-than sign) */''}
semSignal(s): s.count++;  if (s.count &lt;= 0) { remove P from s.queue; make P ready; }</pre>${/* preformatted summary line 2: semSignal in one line */''}
<h4>Three consequences</h4>${/* notes subheading: three consequences of the definition */''}
<ul>${/* start of the consequences list */''}
  <li>A process cannot know in advance whether its semWait will block.</li>${/* consequence: no way to know in advance whether semWait will block */''}
  <li>After a semSignal wakes a waiter, both continue concurrently in an unknown order.</li>${/* consequence: after a wake-up both processes continue in an unknown order */''}
  <li>A signalling process does not learn whether anyone was waiting (it released one process or none).</li>${/* consequence: the signaller does not learn whether anyone was waiting */''}
</ul>${/* end of the consequences list */''}
<h4>Reading the value</h4>${/* notes subheading: reading the value */''}
<p><b>Positive:</b> how many more processes can call semWait and continue. <b>Zero:</b> no units left, nobody waiting. <b>Negative:</b> its magnitude is the number of blocked processes (−3 means three are asleep). Blocked processes use no processor time, unlike busy waiting.</p>${/* notes paragraph: what positive, zero and negative values mean */''}
<h3>Kinds of semaphore</h3>${/* notes heading: kinds of semaphore */''}
<table>${/* start of the kinds table */''}
  <tr><th>Kind</th><th>Values</th><th>Behaviour</th></tr>${/* kinds table header row: kind, values and behaviour */''}
  <tr><td>Counting (general)</td><td>any integer</td><td>As defined above.</td></tr>${/* kinds row: counting (general) semaphore */''}
  <tr><td>Binary</td><td>0 or 1</td><td>semWaitB: if 1, set to 0 and continue, else block. semSignalB: if nobody waits, set to 1, else release one waiter (value stays 0). A signal while already 1 is lost.</td></tr>${/* kinds row: binary semaphore, including the lost extra signal */''}
  <tr><td>Mutex</td><td>locked / unlocked</td><td>Binary lock with ownership: only the locker may unlock.</td></tr>${/* kinds row: mutex */''}
</table>${/* end of the kinds table */''}
<p>Blocked processes wait in a <b>queue</b>. A <b>strong semaphore</b> releases them first-in-first-out, so none can starve. A <b>weak semaphore</b> leaves the order unspecified, so a process may be passed over again and again (starvation).</p>${/* notes paragraph: strong and weak release order, and starvation */''}
<h3>Worked trace: one producer, three consumers</h3>${/* notes heading: the worked trace with one producer and three consumers */''}
<p>A, B and C each need a result produced by D. D announces each result with semSignal; a consumer claims one with semWait. s starts at 1 (one result waiting); strong semaphore.</p>${/* notes paragraph: the setup of the trace */''}
<table>${/* start of the trace table */''}
<tr><th>Operation</th><th>s</th><th>Queue</th><th>Operation</th><th>s</th><th>Queue</th></tr>${/* trace table header row, printed twice so the ten calls fit in two side-by-side halves */''}
<tr><td>1 A wait</td><td>0</td><td>–</td><td>6 B wait</td><td>−3</td><td>C A B</td></tr>${/* trace row: calls 1 and 6 */''}
<tr><td>2 B wait</td><td>−1</td><td>B</td><td>7 D signal (C freed)</td><td>−2</td><td>A B</td></tr>${/* trace row: calls 2 and 7 */''}
<tr><td>3 D signal (B freed)</td><td>0</td><td>–</td><td>8 D signal (A freed)</td><td>−1</td><td>B</td></tr>${/* trace row: calls 3 and 8 */''}
<tr><td>4 C wait</td><td>−1</td><td>C</td><td>9 D signal (B freed)</td><td>0</td><td>–</td></tr>${/* trace row: calls 4 and 9 */''}
<tr><td>5 A wait</td><td>−2</td><td>C A</td><td>10 D signal (saved)</td><td>1</td><td>–</td></tr>${/* trace row: calls 5 and 10 */''}
</table>${/* end of the trace table */''}
<h3>Mutual exclusion with one semaphore</h3>${/* notes heading: mutual exclusion with one semaphore */''}
<pre>semaphore s = 1;${/* preformatted program line 1: the semaphore starts at 1 */''}
void P(int i) { while (true) { semWait(s); /* critical section */; semSignal(s); /* remainder */; } }${/* preformatted program line 2: each process wraps its critical section in semWait and semSignal */''}
void main() { parbegin (P(1), P(2), P(3)); }</pre>${/* preformatted program line 3: main starts the three processes together */''}
<p>The start value is how many may be inside at once, so it must be 1 (2 would let two in). If A, B, C call semWait in turn, s goes 1 → 0 (A enters) → −1 (B blocks) → −2 (C blocks). A's semSignal gives −1 and releases B into the critical section; B's gives 0 and releases C; C's returns s to 1.</p>${/* notes paragraph: why the start value must be 1, with the values three arrivals produce */''}
<h3>Producer/consumer with an infinite buffer</h3>${/* notes heading: producer/consumer with an infinite buffer */''}
<p>The producer appends at <code>in</code>, the consumer takes at <code>out</code>; never take from an empty buffer, never touch the buffer at the same time.</p>${/* notes paragraph: the in and out indexes and the two rules */''}
<h4>Flawed solution with binary semaphores</h4>${/* notes subheading: the flawed solution with binary semaphores */''}
<pre>int n = 0; binary_semaphore s = 1, delay = 0;${/* preformatted flawed code line 1: the variables */''}
producer: produce(); semWaitB(s); append(); n++; if (n == 1) semSignalB(delay); semSignalB(s);${/* preformatted flawed code line 2: the producer */''}
consumer: semWaitB(delay); loop { semWaitB(s); take(); n--; semSignalB(s); consume(); if (n == 0) semWaitB(delay); }</pre>${/* preformatted flawed code line 3: the consumer, with the faulty test at the end */''}
<p>The bug: the consumer tests n <b>after</b> releasing s. If the producer runs in that gap, it adds an item and, since n == 1, signals delay although nobody waits (delay = 1). The consumer skips waiting, consumes that item, finds n == 0 and calls semWaitB(delay), which the stale 1 lets through. It then consumes an item that does not exist, and n = −1.</p>${/* notes paragraph: how the bug happens, step by step */''}
<p><b>Fix:</b> inside the critical section copy n into a private variable (<code>m = n</code>) and test <code>if (m == 0)</code> afterwards.</p>${/* notes paragraph: the fix, saving n into m while still locked */''}
<h4>Correct solution with counting semaphores</h4>${/* notes subheading: the correct solution with counting semaphores */''}
<pre>semaphore n = 0, s = 1;${/* preformatted correct code line 1: the semaphores */''}
producer: produce(); semWait(s); append(); semSignal(s); semSignal(n);${/* preformatted correct code line 2: the producer */''}
consumer: semWait(n); semWait(s); take(); semSignal(s); consume();</pre>${/* preformatted correct code line 3: the consumer */''}
<p>n counts items, so the count and the wake-up can never disagree. Swapping the producer's two semSignal calls is harmless.</p>${/* notes paragraph: n counts items; swapping the producer's signals is harmless */''}
<h3>Bounded (circular) buffer</h3>${/* notes heading: the bounded circular buffer */''}
<p>The buffer has a fixed size and is used in a circle: <code>in = (in + 1) % size</code>, <code>out = (out + 1) % size</code>. Three semaphores:</p>${/* notes paragraph: in and out wrap around the fixed buffer; three semaphores are used */''}
<ul>${/* start of the semaphore list */''}
  <li><b>s = 1</b>: mutual exclusion on the buffer.</li>${/* list item: s is the lock */''}
  <li><b>n = 0</b>: number of items ready (the consumer waits on it when the buffer is empty).</li>${/* list item: n counts items ready */''}
  <li><b>e = size</b>: number of empty slots (the producer waits on it when the buffer is full).</li>${/* list item: e counts empty slots */''}
</ul>${/* end of the semaphore list */''}
<pre>producer: produce(); semWait(e); semWait(s); append(); semSignal(s); semSignal(n);${/* preformatted code line 1: the bounded-buffer producer */''}
consumer: semWait(n); semWait(s); take(); semSignal(s); semSignal(e); consume();</pre>${/* preformatted code line 2: the bounded-buffer consumer */''}
<p><b>Order matters.</b> If the consumer called semWait(s) before semWait(n) with the buffer empty, it would block on n while holding s; the producer would block on s, and neither could continue: a <b>deadlock</b>. The bug only strikes when the buffer is empty, so it can hide in testing.</p>${/* notes paragraph: why the order of semWait calls matters and how the deadlock happens */''}
<h3>Implementing semaphores: the operations must be atomic</h3>${/* notes heading: implementing semaphores atomically */''}
<p>semWait and semSignal update shared data (count and queue). Run concurrently, both could read count = 1, both store 0, and both enter. Only one process at a time may be inside either operation on a semaphore.</p>${/* notes paragraph: the race that happens if the operations are not atomic */''}
<ul>${/* start of the list of two ways to make them atomic */''}
  <li><b>Hardware (multiprocessors):</b> guard a <code>s.flag</code> with <code>while (compare_and_swap(s.flag, 0, 1) == 1) ;</code> at the start and <code>s.flag = 0</code> at the end (a blocking process frees the flag as it blocks). The busy waiting lasts only for the few instructions of the operation, never a whole critical section.</li>${/* list item: the compare_and_swap flag for multiprocessors */''}
  <li><b>Disabling interrupts (one processor only):</b> inhibit interrupts at the start, allow them at the end (or as the caller blocks). With one CPU a process loses the processor only through an interrupt, so the operation becomes indivisible; another core on a multiprocessor is not stopped.</li>${/* list item: disabling interrupts on a single processor */''}
</ul>`,  // end of the list and of the notes text
  });  // closes the object given to Guide.section, which registers the section
})();  // ends the wrapper function and runs it immediately (the final () calls it)
