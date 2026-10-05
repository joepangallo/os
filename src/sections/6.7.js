// Comment key: a line inside backtick text ends with ${/* comment */''}, an empty-string slot that holds a comment without changing the text on screen (full note at the top of the page).
/* =====================================================================
   6.7 UNIX Concurrency Mechanisms
   Original teaching material. Small helpers shared by several steps live
   inside this IIFE (no globals). Every number a student is told comes out
   of the same simulation code that draws the pictures.
   ===================================================================== */
(function () {  // wraps the whole section in a function that runs once, right away, so its helper names stay private to this file
  // A rounded box with a centred label, used for processes and messages in SVG drawings.
  function token(s, x, y, label, cls, w = 44, hgt = 44, fs = 17) {  // token(s, x, y, label, ...): draws a rounded box centred on (x, y) with a bold label; w, hgt and fs set width, height and font size
    return s('g', {},  // returns an SVG group (g) so the box and its label move and style together; s builds SVG (the browser's drawing format) elements
      s('rect', { x: x - w / 2, y: y - hgt / 2, width: w, height: hgt, rx: 10, class: cls || 's-proc', 'stroke-width': 2 }),  // the rounded rectangle, placed so (x, y) is its centre; cls picks its colour class, the process colour if none is given
      s('text', { x, y: y + fs * 0.35, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': fs }, label));  // the label text, centred across the box and nudged down by about a third of the font size so it sits in the middle vertically
  }  // ends token
  // Writes narration into a .narr box with an optional tone ('ok' or 'bad').
  function sayInto(box, html, tone) { box.className = 'narr' + (tone ? ' ' + tone : ''); box.innerHTML = html; }  // sayInto(box, html, tone): sets the narration box's colour class (plain, ok for green, bad for red) and puts the sentence in it
  // Adds one line to the top of a .log panel and keeps it short.
  function logInto(ctx, log, txt) { log.prepend(ctx.h('div', {}, txt)); while (log.children.length > 30) log.lastChild.remove(); }  // logInto(ctx, log, txt): adds a new line at the top of a log panel, then removes the oldest lines so at most 30 remain
  // The output of ls in the running pipe example; ↵ stands for the one-byte newline.
  const LS_NAMES = ['app.c↵', 'db.c↵', 'io.h↵', 'main.c↵', 'ui.c↵', 'util.h↵'];  // LS_NAMES: the six file names that ls prints in the pipe demo, each ending in a newline byte, so each name is one message to the reader

  // Runs two processes' counter = counter + 1 on shared memory, one machine step at a time, in the
  // order given by `plan` (a list of process names). Each process's program is load, add, store,
  // optionally wrapped in a semaphore lock (semop -1) and unlock (semop +1). A process whose lock
  // cannot proceed is suspended; the next unlock lets its lock complete. Returns one row per step.
  function raceRows(withLock, plan, start) {  // raceRows(withLock, plan, start): simulates two processes adding 1 to a shared counter, step by step, and returns one table row per step
    const prog = withLock ? ['lock', 'load', 'add', 'store', 'unlock'] : ['load', 'add', 'store'];  // prog: each process's program; with the lock it is wrapped in a semaphore wait (lock) and signal (unlock), without it just load, add, store
    const P = { A: { pc: 0, reg: null, wait: false }, B: { pc: 0, reg: null, wait: false } };  // P: the state of processes A and B: pc is how far each is through its program, reg is its private register, wait marks it as suspended
    let mem = start, sem = 1;  // mem is the shared counter in memory, starting at start; sem is the lock semaphore, 1 meaning free
    const rows = [];  // rows will collect a snapshot of everything after each step, for the table and the narration
    for (const n of plan) {  // goes through the plan in order; each entry names the process that gets the next machine step
      const p = P[n], other = P[n === 'A' ? 'B' : 'A'], on = n === 'A' ? 'B' : 'A';  // p is the process taking this step, other is the one that is not, and on is the other one's name, used in the sentences
      if (p.pc >= prog.length || p.wait) continue;  // a process that has finished its program or is suspended on the lock cannot take a step, so that turn is skipped
      const op = prog[p.pc];  // op is the next instruction in this process's program
      let say;  // say will hold the sentence that describes this step
      if (op === 'lock') {  // lock step: semop with -1 on the lock semaphore
        if (sem > 0) { sem--; p.pc++; say = `${n}: semop(−1) on the lock: 1 → 0, so ${n} may touch the counter.`; }  // if the lock is free (1), it drops to 0 and the process moves on to read the counter
        else { p.wait = true; say = `${n}: semop(−1) finds the lock at 0, so ${n} is <b>suspended</b> before it can read the counter.`; }  // if the lock is already 0, the process is suspended and stays at this instruction until the other one unlocks
      } else if (op === 'load') { p.reg = mem; p.pc++; say = `${n} loads the counter (${mem}) into its own register.`; }  // load step: copies the shared counter into this process's own register
      else if (op === 'add') { p.reg++; p.pc++; say = `${n} adds 1 in its register: ${p.reg}. The shared counter still holds ${mem}.`; }  // add step: adds 1 in the register only, so the shared counter has not changed yet; this gap is where the race happens
      else if (op === 'store') { mem = p.reg; p.pc++; say = `${n} stores ${p.reg} into shared memory.`; }  // store step: writes the register back into the shared counter, overwriting whatever is there
      else {  // the only instruction left is unlock (semop with +1)
        p.pc++;  // moves this process past its unlock instruction
        if (other.wait) { other.wait = false; other.pc++; say = `${n}: semop(+1) on the lock. ${on} was waiting, so its semop(−1) now completes and ${on} goes next.`; }  // if the other process is suspended on the lock, it is woken and its lock completes at once, so the semaphore stays at 0 and it goes next
        else { sem++; say = `${n}: semop(+1) on the lock: 0 → 1.`; }  // if nobody is waiting, the lock semaphore goes back to 1, free for the next taker
      }  // ends the unlock case
      rows.push({ n, op, mem, sem, regA: P.A.reg, regB: P.B.reg, waitA: P.A.wait, waitB: P.B.wait, say });  // saves a row: who moved, which instruction, the counter, the semaphore, both registers and both waiting flags, plus the sentence
    }  // ends the loop over the plan
    return { rows, final: mem };  // returns all the rows and the counter's final value, which shows whether an update was lost
  }  // ends raceRows

  // System V semop on a semaphore set. ops = [[index, sem_op], ...], at most one entry per semaphore,
  // so every entry can be judged against the current values. Returns null when the whole list can be
  // done now, otherwise the first entry that cannot: why 'n' = must wait for an increase, 'z' = for zero.
  function semopBlocker(vals, ops) {  // semopBlocker(vals, ops): checks a whole list of semaphore operations against the current values and reports the first that must wait
    for (const [i, d] of ops) {  // goes through each operation as i (which semaphore in the set) and d (the amount to add: negative, zero or positive)
      if (d === 0 && vals[i] !== 0) return { i, why: 'z' };  // an operation of 0 means "wait until this semaphore is zero", so it blocks while the value is not 0 (why 'z')
      if (d < 0 && -d > vals[i]) return { i, why: 'n' };  // a negative operation blocks if subtracting it would take the value below zero (why 'n': wait for an increase)
    }  // ends the loop over operations
    return null;  // null means nothing blocks: the whole list can be done right now
  }  // ends semopBlocker
  // Performs a list that semopBlocker has cleared: every value changes, and each touched semaphore
  // records the caller as the last process to operate on it.
  function semopApply(set, ops, pid) {  // semopApply(set, ops, pid): performs a cleared list of operations on a semaphore set
    for (const [i, d] of ops) { set.vals[i] += d; set.pids[i] = pid; }  // adds each change to its semaphore's value and records pid as the last process to operate on that semaphore
  }  // ends semopApply
  // After a successful call, retry the suspended calls (waiting = [{ name, pid, ops, t, why }]): those
  // waiting for zero first, then the rest, each group in arrival order (t), until nothing more can
  // complete. Removes completed calls from `waiting` and returns them in the order they completed.
  function semopRetry(set, waiting) {  // semopRetry(set, waiting): after a semaphore changes, wakes every suspended call that can now finish, in a fair order
    const done = [];  // done collects the calls that complete, in the order they complete
    for (;;) {  // keeps looping, because each completed call can change values and let another waiting call through
      const order = waiting.slice().sort((a, b) => (a.why === 'z' ? 0 : 1) - (b.why === 'z' ? 0 : 1) || a.t - b.t);  // order: a sorted copy of the waiting list, wait-for-zero calls first, then by arrival time t (first come, first served)
      const w = order.find((c) => !semopBlocker(set.vals, c.ops));  // w is the first call in that order whose whole list of operations can now go ahead
      if (!w) return done;  // if no call can complete, the retry is over and the completed calls are returned
      semopApply(set, w.ops, w.pid);  // performs that call's operations on the set
      waiting.splice(waiting.indexOf(w), 1);  // removes it from the waiting list, since it is no longer suspended
      done.push(w);  // and adds it to the completed list
    }  // ends the retry loop
  }  // ends semopRetry

  Guide.section({  // registers this section with the guide: its id, titles, objectives, terms, steps and notes all go in this one object
    id: '6.7',  // section number, used in the slide keys (6.7/1, 6.7/2 ...) and the contents panel
    title: 'UNIX Concurrency Mechanisms',  // full section title shown above every step
    short: 'UNIX mechanisms',  // shorter title used in the chapter overview's list of sections, where space is tight
    summary: 'Pipes, message queues, shared memory, semaphore sets and signals: how UNIX processes talk and wait.',  // one-line summary shown under the title on the chapter overview and searched by the contents filter
    objectives: [  // objectives: what a student should be able to do after the section; printed under the section in the printable view
      'Name the five UNIX concurrency mechanisms and say which ones move data and which ones trigger actions.',  // objective 1: name the five mechanisms and sort them into data movers and action triggers
      'Trace a pipe as a circular buffer, predict when its writer or reader blocks, and tell unnamed pipes from named pipes (FIFOs).',  // objective 2: trace a pipe's circular buffer, predict blocking, and tell unnamed pipes from named ones
      'Send and receive typed messages on a message queue, and explain why shared memory is the fastest mechanism yet needs its own mutual exclusion.',  // objective 3: use typed messages on a queue, and see why shared memory is fast but needs its own locking
      'Apply the four semop rules to a semaphore set and explain why a list of operations succeeds or waits as one indivisible unit.',  // objective 4: apply the semop rules to a semaphore set and see that a list of operations is all-or-nothing
      'Follow a signal from sender to pending bit to default action, handler or ignore, and explain why repeated signals of one type collapse into one.',  // objective 5: follow a signal to its action, and see why repeated signals of one type merge into one
    ],  // closes the objectives list
    terms: [  // terms: glossary entries for this section, each a pair of [term, definition]; they also become flashcards and dotted-word pop-ups
      ['Interprocess communication (IPC)', 'Any way for separate processes to exchange data or coordinate with each other, such as pipes, message queues, shared memory, semaphores and signals.'],  // glossary entry: defines interprocess communication (IPC) and lists the mechanisms it covers
      ['Pipe', 'A one-way channel kept by the kernel: a fixed-size circular buffer that one process writes bytes into and another reads them out of, first in, first out.'],  // glossary entry: defines a pipe as a one-way, first-in-first-out circular buffer kept by the kernel
      ['Named pipe (FIFO)', 'A pipe that has a name in the file system, so any process with permission can open it by that name, even one unrelated to the process that created it.'],  // glossary entry: defines a named pipe (FIFO), which unrelated processes can open by its file-system name
      ['File descriptor', 'A small whole number a process uses to refer to something it has open, such as a file or one end of a pipe. By convention 0 is standard input and 1 is standard output.'],  // glossary entry: defines a file descriptor, including the standard input and output numbers 0 and 1
      ['Circular buffer', 'A fixed-size array used as a queue whose positions wrap around: after the last slot, writing and reading continue at slot 0.'],  // glossary entry: defines a circular buffer, a fixed array whose positions wrap back to slot 0
      ['End of file (EOF)', 'What a read reports when no more data exists and none can ever arrive. For a pipe: it is empty and every write end has been closed.'],  // glossary entry: defines end of file, and when a read from a pipe reports it
      ['Message queue', 'A list of messages held by the kernel that works like a mailbox: senders add messages with msgsnd and receivers remove them with msgrcv.'],  // glossary entry: defines a message queue as a kernel mailbox used through msgsnd and msgrcv
      ['Message type', 'A positive whole number the sender attaches to each message. A receiver can ask for the oldest message of one type instead of simply the oldest message.'],  // glossary entry: defines a message type, the number that lets a receiver pick one kind of message
      ['msgsnd', 'The System V call that adds a message (a type plus a block of bytes) to a message queue. The sender blocks while the queue is full.'],  // glossary entry: defines msgsnd, the call that adds a message and blocks while the queue is full
      ['msgrcv', 'The System V call that removes a message from a message queue: either the oldest message of any type, or the oldest message of a chosen type.'],  // glossary entry: defines msgrcv and its two ways of choosing a message (oldest overall or oldest of a type)
      ['Shared memory', 'A block of memory mapped into the address spaces of several processes at once, so all of them read and write the same bytes with ordinary instructions.'],  // glossary entry: defines shared memory as one block mapped into several address spaces
      ['Semaphore set', 'A group of System V semaphores created together under one identifier. One semop call can operate on several members of the set as a single indivisible unit.'],  // glossary entry: defines a semaphore set, whose members one call can change together as a unit
      ['semop', 'The System V call that performs a list of semaphore operations. The kernel applies the whole list at once or, if any part cannot proceed, applies none of it and suspends the caller.'],  // glossary entry: defines semop and its all-or-nothing rule for a list of operations
      ['semctl', 'The System V call for managing a semaphore set: setting values (one at a time or all at once), reading its bookkeeping fields, or removing the set.'],  // glossary entry: defines semctl, the call that sets values, reads bookkeeping or removes a set
      ['Signal', 'A software notice telling a process that some event happened, such as Ctrl-C being pressed or a child process ending. It arrives asynchronously, much like a hardware interrupt.'],  // glossary entry: defines a signal as a software notice that arrives at an unpredictable moment, like an interrupt
      ['Pending signal', 'A signal that has been sent but not yet acted on. The kernel records it as one bit per signal type in the target process\'s process table entry.'],  // glossary entry: defines a pending signal, stored as one bit per signal type
      ['Signal handler', 'A function a process registers to run when a particular signal arrives, in place of the default action.'],  // glossary entry: defines a signal handler, the function that replaces the default action
      ['Default action', 'What happens when a process has neither caught nor ignored a signal. For most signals it terminates the process; for a few, such as SIGCHLD, it does nothing.'],  // glossary entry: defines the default action, usually termination but nothing at all for a few signals
      ['SIGKILL', 'Signal number 9, which always terminates the target process. It cannot be caught by a handler and cannot be ignored.'],  // glossary entry: defines SIGKILL, signal 9, which can be neither caught nor ignored
      ['Core dump', 'A file holding a snapshot of a process\'s memory, written when certain signals end the process, so a programmer can later examine what went wrong.'],  // glossary entry: defines a core dump, the memory snapshot some signals write when they end a process
    ],  // closes the terms list
    css: ` /* css: this section's own style rules; the guide adds them to the page once, and each rule starts with .sec-6-7 so it only affects this section */
      .sec-6-7 .narr { background: var(--panel-2); border: 1px solid var(--line); border-left: 5px solid var(--chc); border-radius: 12px; padding: 9px 13px; font-size: 15px; line-height: 1.45; flex-shrink: 0; } /* narration box: a soft panel with a thick chapter-coloured bar on the left, padded text, and never squeezed shorter by its neighbours */
      .sec-6-7 .narr.bad { border-left-color: var(--bad); background: var(--bad-bg); } /* a bad-news narration (such as a lost update) turns the bar and background red */
      .sec-6-7 .narr.ok { border-left-color: var(--ok); background: var(--ok-bg); } /* a good-news narration turns the bar and background green */
      .sec-6-7 .log { font-size: 13px; } /* event logs use slightly smaller text so more lines fit */
      .sec-6-7 .grid-2 > *, .sec-6-7 .grid-3 > *, .sec-6-7 .mw0 > * { min-width: 0; } /* lets the children of these grids shrink below their content's width so a long word cannot stretch a column */
      .sec-6-7 .pcard { border: 2px solid var(--proc); background: var(--proc-bg); border-radius: 12px; padding: 8px 10px; display: flex; flex-direction: column; gap: 6px; min-width: 0; } /* process card: a rounded box in the process colour, holding a name, a status line and buttons stacked vertically */
      .sec-6-7 .pcard.blocked { border-color: var(--warn); background: var(--warn-bg); } /* a process card turns amber while that process is blocked */
      .sec-6-7 .pcard.dead { border-color: var(--line-2); background: var(--panel-3); } /* a process card turns grey once that process has ended */
      .sec-6-7 .pcard .nm { font-weight: 900; font-size: 18px; line-height: 1.1; } /* the process name inside a card: large and heavy so it reads at a glance */
      .sec-6-7 .pcard .st { font-size: 13.5px; font-weight: 700; color: var(--ink-2); } /* the status line under the name: small, bold, in a softer colour */
      .sec-6-7 table.race th { padding: 3px 8px; font-size: 12.5px; } /* header cells of the race table: tight padding and small text */
      .sec-6-7 table.race td { padding: 2px 8px; font-size: 14px; line-height: 1.35; } /* body cells of the race table: tight padding so every step fits on screen */
      .sec-6-7 table.sigtab th { padding: 3px 6px; font-size: 12px; } /* header cells of the signal table: even tighter, since that table has more columns */
      .sec-6-7 table.sigtab td { padding: 1px 6px; font-size: 13px; line-height: 1.4; } /* body cells of the signal table: small text and little padding */
      .sec-6-7 .flip-face.front { font-size: 18px; } /* the front of each flashcard in the recap: larger text for the question */
      .sec-6-7 .flip-face.back { font-size: 14.5px; line-height: 1.4; } /* the back of each flashcard: smaller text with more line spacing, for the longer answer */
    `,  // end of the css text
    steps: [  // steps: the list of screens in this section, shown one after another as the student clicks Next
      /* ---------------- 1. Big picture: five tools ---------------- */
      {  // step 1 starts here
        title: 'Five ways for UNIX processes to cooperate',  // title shown at the top of step 1
        kind: 'story',  // kind story: labelled Big Picture, an overview before the details
        html: `${/* html: fixed page content for step 1; the render function below adds the interactive tool buttons to it */''}
          <div class="split fill">${/* two columns that fill the step height: the explanation on the left, the toolbox on the right */''}
            <div class="stack" style="gap:9px">${/* left column: paragraphs stacked with small gaps */''}
              <p class="lead m0">Processes in UNIX live in separate address spaces, so they cannot simply read each other's variables. When they need to cooperate, they ask the kernel for help.</p>${/* opening sentence: separate address spaces mean processes need the kernel's help to cooperate */''}
              <p class="m0">UNIX offers five standard tools for <span class="t" data-t="interprocess communication">interprocess communication</span>. Three of them <b>move data</b> from one process to another: <span class="t" data-t="pipe">pipes</span>, <b>messages</b> and <span class="t">shared memory</span>. The other two <b>trigger actions</b>: <span class="t" data-t="semaphore">semaphores</span> make a process wait or let it go, and <span class="t" data-t="signal">signals</span> tell a process that something just happened.</p>${/* paragraph: names the five tools and sorts them into three that move data and two that trigger actions */''}
              <div class="callout analogy m0" data-label="Analogy">Picture an apartment building. A laundry chute between two floors is a pipe: things go in at the top and come out at the bottom in the same order. The mailroom with labelled cubbies is a message queue. A whiteboard in the hallway is shared memory: the fastest way to share, but two people can scribble over each other. A sign-out sheet for the three guest parking spots is a semaphore. The doorbell is a signal: it says only “something happened”, and two quick rings sound like one.</div>${/* analogy box: an apartment building, with a chute, mailroom, whiteboard, sign-out sheet and doorbell for the five tools */''}
              <div class="row gap-s small"><span class="chip mem">drive a pipe until it blocks</span><span class="chip io">pick mail by type</span><span class="chip os">submit an all-or-nothing semop</span><span class="chip intr">send signals and watch them collapse</span></div>${/* row of coloured tags previewing the hands-on activities later in this section */''}
            </div>${/* closes the left column */''}
            <div class="card stack" style="gap:10px">${/* right column: a card holding the toolbox */''}
              <h4 class="m0">The UNIX toolbox</h4>${/* card heading: the UNIX toolbox */''}
              <p class="small muted m0">Click a tool to see what it carries, who can use it and who waits.</p>${/* instruction under the heading: click a tool to learn more about it */''}
              <div class="tools7" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px"></div>${/* empty two-column grid; render fills it with one button per tool */''}
              <div class="card white grow tool-detail" style="display:flex;flex-direction:column;gap:6px"></div>${/* empty white panel that grows to fill the card; render shows the chosen tool's details in it */''}
            </div>${/* closes the toolbox card */''}
          </div>`,  // closes the two columns and ends the html text
        render(el, ctx) {  // render(el, ctx): runs when step 1 is shown, after the html is on the page; it wires up the toolbox
          const { h } = ctx;  // takes the HTML element builder h out of ctx so it can be written without the prefix
          // [name, glossary term, colour, family, what it is, what travels, who can use it, who waits]
          const tools = [  // tools: one row per mechanism with its name, glossary term, colour class, family and three facts, in the order of the comment above
            ['Pipe', 'pipe', 'mem', 'data', 'A one-way stream of bytes through a fixed-size buffer inside the kernel. One process writes, another reads, first in, first out.', 'A stream of bytes with no boundaries between writes.', 'Related processes (an unnamed pipe), or any process that opens it by name (a named pipe).', 'The writer when the buffer has no room; the reader when there is nothing to read.'],  // pipe row: a one-way byte stream; writer waits when full, reader when empty
            ['Message queue', 'message queue', 'mem', 'data', 'A mailbox kept by the kernel. Each message is a block of bytes with a type number attached.', 'Whole messages, each with a type, taken oldest first or chosen by type.', 'Any process that knows the queue\'s key and has permission.', 'The sender when the queue is full; the receiver when it is empty.'],  // message queue row: whole typed messages; senders wait when full, receivers when empty
            ['Shared memory', 'shared memory', 'mem', 'data', 'One block of memory mapped into several processes at once. They read and write it with ordinary instructions.', 'Nothing travels: every process sees the same bytes. That makes it the fastest tool.', 'Processes that attach the block, each with read-only or read-write permission.', 'Nobody: the tool gives no mutual exclusion, so programs add semaphores themselves.'],  // shared memory row: nothing travels, so it is fastest, but nobody waits, so it has no built-in mutual exclusion
            ['Semaphore set', 'semaphore set', 'os', 'action', 'A group of counters. One call can change several of them at once, and the kernel does all of the changes or none.', 'No data, only counts: free printers, items ready, jobs running.', 'Any process that knows the set\'s key and has permission.', 'A caller whose operation cannot be done yet, until the values change.'],  // semaphore set row: counters changed all together or not at all; a caller waits until values allow its change
            ['Signal', 'signal', 'intr', 'action', 'A tap on the shoulder: the kernel marks “event number n happened” for a process, which then reacts.', 'Just the signal\'s number, recorded as one bit. No other data.', 'The kernel, or any process allowed to send to the target (for example with the kill command).', 'Nobody waits for delivery: the signal is acted on when the target next runs.'],  // signal row: just a number recorded as one bit; nobody waits for delivery
          ];  // closes the tools list
          const grid = ctx.$('.tools7'), detail = ctx.$('.tool-detail');  // finds the empty grid and the empty detail panel that the html above created
          if (ctx.narrow) grid.style.gridTemplateColumns = 'minmax(0, 1fr)';  // on a phone-width screen the tool buttons go in one column instead of two
          const btns = tools.map((t, i) => h('button', { class: 'btn ' + t[2], type: 'button', style: { justifyContent: 'space-between', height: '40px' }, onclick: () => show(i) },  // builds one button per tool, coloured by its class; clicking it shows that tool's details
            h('span', {}, t[0]), h('span', { class: 'chip ' + (t[3] === 'data' ? 'mem' : 'intr'), style: { fontSize: '12px' } }, t[3] === 'data' ? 'moves data' : 'triggers action')));  // inside each button: the tool's name on the left and a tag on the right saying whether it moves data or triggers an action
          grid.append(...btns);  // puts all five buttons into the grid
          function show(i) {  // show(i): fills the detail panel with tool number i and highlights its button
            const [name, term, cls, , what, carry, who, waits] = tools[i];  // unpacks the tool's row into named pieces; the empty slot skips the family, which is not needed here
            btns.forEach((b, j) => b.classList.toggle('on', i === j));  // marks only the chosen button as on and clears the highlight from the others
            detail.innerHTML = '';  // empties the detail panel before refilling it
            detail.append(  // adds the new contents to the panel in one call
              h('div', { class: 'row', style: { justifyContent: 'space-between' } },  // top row of the panel: the tool name on the left, its position on the right
                h('b', { style: { fontSize: '19px' }, html: `<span class="t" data-t="${term}">${name}</span>` }),  // the tool name, written as a dotted glossary word so hovering or tapping it shows the definition
                h('span', { class: 'chip ' + cls }, 'tool ' + (i + 1) + ' of 5')),  // tag such as "tool 3 of 5", in the tool's colour
              h('p', { class: 'm0', style: { fontSize: '15.5px' } }, what),  // one-paragraph description of what the tool is
              h('div', { class: 'small m0', html: '<b>Carries:</b> ' + carry }),  // what the tool carries between processes
              h('div', { class: 'small m0', html: '<b>Who can use it:</b> ' + who }),  // who is allowed to use the tool
              h('div', { class: 'small m0', html: '<b>Who waits:</b> ' + waits }));  // who has to wait when using it, and when
            detail.classList.remove('fade-in'); void detail.offsetWidth; detail.classList.add('fade-in');  // restarts the fade-in animation: removing the class, reading the width (which forces the browser to update) and adding it back makes it replay
          }  // ends show
          show(0);  // shows the first tool (the pipe) as soon as the step opens, so the panel is never empty
        },  // ends render for step 1
      },  // ends step 1

      /* ---------------- 2. Pipe simulator: a circular buffer ---------------- */
      {  // step 2 starts here
        title: 'A pipe is a circular buffer in the kernel',  // title of step 2
        kind: 'explore',  // kind explore: labelled Explore, a hands-on simulator
        core: true,  // core: true keeps this step on the shorter core path through the guide
        render(el, ctx) {  // render(el, ctx): builds the whole pipe simulator when step 2 opens
          const { h, s } = ctx;  // takes the HTML builder h and the SVG builder s out of ctx
          const CAP = 16;  // CAP: the pipe buffer holds 16 bytes, small enough to draw every slot
          const NAMES = LS_NAMES;  // NAMES: the six newline-ended file names that the ls process writes into the pipe
          let st, rule = 'classic';  // st will hold the simulation state; rule is which pipe rule is shown, starting with the classic one
          const svg = s('svg', { viewBox: '0 0 360 340', width: '100%', style: 'max-width:356px' });  // the drawing area for the circular buffer, 360 by 340 drawing units, scaled to fit but never wider than 356 pixels
          const cards = h('div', { class: 'grid-2', style: { gap: '10px' } });  // a two-column grid that will hold the writer's and reader's cards
          const narr = h('div', { class: 'narr', style: { minHeight: '84px' } });  // the narration box under the drawing, tall enough for three lines so the layout does not jump
          const say = (html, tone) => sayInto(narr, html, tone);  // say(html, tone): shorthand that writes into this step's narration box
          const free = () => CAP - st.n;  // free(): how many of the 16 bytes are empty right now
          // "1 byte is" / "5 bytes are": a count with its noun (and, if asked, its verb) agreeing.
          const nB = (k, verb) => `${k} byte${k === 1 ? '' : 's'}` + (verb ? (k === 1 ? ' is' : ' are') : '');  // nB(k, verb): writes "1 byte" or "5 bytes", adding "is" or "are" when verb is asked for, so the narration reads correctly
          const wOpen = () => st.w === 'run' || st.w === 'blocked';  // wOpen(): true while the write end is still open, meaning ls is running or blocked (not exited or killed)
          const rOpen = () => st.r === 'run' || st.r === 'blocked';  // rOpen(): true while the read end is still open, meaning wc is running or blocked
          // Names the slots a run of k bytes starting at slot a occupies, spelling out a wrap past slot 15.
          const range = (a, k) => {  // range(a, k): describes in words which slots k bytes starting at slot a fill, for the narration
            const e = a + k - 1;  // e is the slot number of the last byte, before any wrap-around
            if (k === 1) return 'slot ' + a;  // a single byte is just "slot a"
            if (e < CAP) return `slots ${a}–${e}`;  // if the run stays below slot 16 it is a simple range such as "slots 3–7"
            return `slots ${a}–${CAP - 1} and ${e % CAP === 0 ? 'slot 0' : '0–' + (e % CAP)} (wrapping around)`;  // otherwise it wraps: names the part up to slot 15, then the part that continues from slot 0
          };  // ends range
          function reset() {  // reset(): puts the pipe and both processes back to the start; runs when the step opens and when Reset is clicked
            st = { buf: Array(CAP).fill(null), rd: 0, wr: 0, n: 0, next: 0, w: 'run', r: 'run', wPend: null, rPend: 0, got: '', hotW: [], hotR: [] };  // st: buf is the 16 slots, rd and wr the read and write positions, n the byte count, next the next name ls writes; w and r are the writer's and reader's states; wPend and rPend hold a blocked write or read; got is what wc has received; hotW and hotR mark slots just written or read
            say('The shell has started <code>ls | wc -l</code>. <b>ls</b> writes file names into the pipe; <b>wc -l</b> reads them and counts the lines (↵ is the newline byte). This pipe holds at most 16 bytes so the picture stays small (a real Linux pipe holds 64 KiB by default). Make ls write.');  // opening narration: the shell has started ls | wc -l; explains the newline symbol, the small 16-byte size and the real default size
            draw();  // draws the empty pipe
          }  // ends reset
          function put(str) { const at = st.wr; st.hotW = []; for (const ch of str) { st.buf[st.wr] = ch; st.hotW.push(st.wr); st.wr = (st.wr + 1) % CAP; st.n++; } st.hotR = st.hotR.filter((k) => !st.hotW.includes(k)); return at; }  // put(str): copies str into the buffer one byte at a time at the write position, wrapping after slot 15, marks those slots as just written, and returns where it started
          function take(k) { const at = st.rd; let out = ''; st.hotR = []; for (let i = 0; i < k; i++) { out += st.buf[st.rd]; st.buf[st.rd] = null; st.hotR.push(st.rd); st.rd = (st.rd + 1) % CAP; st.n--; } st.got += out; return { at, out }; }  // take(k): removes the k oldest bytes from the read position, wrapping after slot 15, marks those slots as just read, adds them to what wc got, and returns where they came from
          const lines = () => (st.got.match(/↵/g) || []).length;  // lines(): counts the newline bytes wc has received, which is the number wc -l will print
          // Can a read of k bytes finish now? Classic rule: only if all k bytes are there. POSIX rule: if any byte is there.
          const readable = (k) => (rule === 'classic' ? st.n >= k : st.n > 0);  // readable(k): whether a read of k bytes may finish now; the classic rule waits for all k bytes, the POSIX rule settles for any byte
          function finishRead(k) {  // finishRead(k): completes a read, taking at most the bytes that are there, and returns the sentence describing it
            const got = take(Math.min(k, st.n));  // takes the smaller of what was asked for and what the pipe holds
            return `wc receives ${got.out.length} byte${got.out.length === 1 ? '' : 's'} (“${got.out}”) from ${range(got.at, got.out.length)}. Lines counted so far: <b>${lines()}</b>.`;  // sentence: how many bytes wc got, what they were, which slots they came from, and the line count so far
          }  // ends finishRead
          function eof() { st.r = 'done'; st.rPend = 0; return `The pipe is empty and no write end is open, so read() returns 0: <span class="t" data-t="end of file">end of file</span>. wc prints <b>${lines()}</b> and exits.`; }  // eof(): the pipe is empty and no writer remains, so read returns 0 (end of file); wc is marked done and prints its count
          // After bytes arrive: a blocked reader may now complete.
          function wakeReader() {  // wakeReader(): runs after bytes are added or the writer leaves; it lets a blocked wc finish if it now can, and returns any extra narration
            if (st.r !== 'blocked') return '';  // if wc is not blocked there is nothing to do and nothing to add to the narration
            if (readable(st.rPend)) { const k = st.rPend; st.r = 'run'; st.rPend = 0; const t = finishRead(k); return ' <b>wc was blocked, so the kernel wakes it:</b> ' + t + wakeWriter(); }  // enough bytes have arrived: wc is woken, its read completes, and a now-freed ls may in turn be woken
            if (!wOpen()) { st.r = 'run'; const k = st.rPend; st.rPend = 0; return ' wc wakes up because the last writer is gone. ' + (st.n ? finishRead(k) + ' (fewer bytes than it asked for: that is all there will ever be).' : eof()); }  // the last writer has gone: wc wakes anyway and gets whatever is left, or end of file if the pipe is empty
            return ` wc stays blocked: it wants ${st.rPend} bytes and only ${nB(st.n, true)} there.`;  // otherwise wc stays blocked, and the sentence says how many bytes it wants and how many are there
          }  // ends wakeReader
          // After bytes leave: a blocked writer may now complete.
          function wakeWriter() {  // wakeWriter(): runs after bytes leave the pipe; it lets a blocked ls finish its write if the whole name now fits
            if (st.w !== 'blocked') return '';  // if ls is not blocked there is nothing to do
            if (free() >= st.wPend.length) { const at = put(st.wPend); st.next++; const w = st.wPend; st.w = 'run'; st.wPend = null; return ` <b>ls was blocked, so the kernel wakes it:</b> its ${w.length} bytes (“${w}”) now fit and go into ${range(at, w.length)}.` + wakeReader(); }  // enough room: the waiting name is copied in, ls runs again, and a blocked wc may now be woken in turn
            return ` ls stays blocked: it needs ${st.wPend.length} free bytes and only ${nB(free(), true)} free.`;  // otherwise ls stays blocked, and the sentence says how much room it needs and how much there is
          }  // ends wakeWriter
          function doWrite() {  // doWrite(): runs when the student clicks the write button; ls tries to write its next file name
            if (st.w !== 'run' || st.next >= NAMES.length) return;  // does nothing if ls is not running or has already written all six names
            const name = NAMES[st.next];  // name is the next file name to write
            if (!rOpen()) { st.w = 'killed'; say(`ls calls write(), but the read end is closed: nobody can ever read these bytes. The kernel sends ls the signal <b>SIGPIPE</b>, whose default action terminates it.`, 'bad'); return draw(); }  // the read end is closed: the kernel sends SIGPIPE, which kills ls, and the narration turns red
            if (free() >= name.length) {  // the whole name fits in the free space
              const at = put(name); st.next++;  // copies it into the buffer and moves on to the next name
              const msg = `The kernel locks the pipe, copies ls's ${name.length} bytes (“${name}”) into ${range(at, name.length)}, and moves the write position to slot ${st.wr}. Pipe: ${st.n} of ${CAP} bytes used.`;  // sentence: the kernel locks the pipe, copies the bytes into named slots, moves the write position, and gives the new fill level
              const woke = wakeReader();  // a blocked wc may now be able to finish its read
              say(msg + woke + (woke && st.r !== 'blocked' ? ` Pipe now: ${st.n} of ${CAP}.` : ''), 'ok');  // shows the sentence in green, plus anything wakeReader added and, if wc was woken, the fill level after its read
            } else {  // the name does not fit
              st.w = 'blocked'; st.wPend = name; st.hotW = []; st.hotR = [];  // ls blocks with its name waiting in wPend; the highlights from the last action are cleared
              say(`ls wants to write ${name.length} bytes (“${name}”) but ${free() === 0 ? 'the pipe is full: no byte is' : 'only ' + nB(free(), true)} free. The writer <b>blocks</b> until there is room for the whole write. No byte is copied yet. (Real systems promise this all-or-nothing write for up to PIPE_BUF bytes, 4,096 on Linux; a bigger write may go in pieces.)`, 'bad');  // red sentence: ls blocks until the whole name fits and copies nothing yet; notes the real all-or-nothing limit for small writes
            }  // ends the fits / does not fit choice
            draw();  // redraws the pipe
          }  // ends doWrite
          function doRead(k) {  // doRead(k): runs when the student clicks a read button; wc asks for k bytes
            if (st.r !== 'run') return;  // does nothing unless wc is running
            st.hotW = []; st.hotR = [];  // clears the highlights from the last action
            if (readable(k)) {  // the read can finish now under the chosen rule
              const msg = `The kernel locks the pipe and hands wc the oldest bytes first. ` + finishRead(k) + ` Pipe: ${st.n} of ${CAP} bytes used.`;  // sentence: the kernel hands wc the oldest bytes first, then gives the new fill level
              const woke = wakeWriter();  // room has been freed, so a blocked ls may now finish its write
              say(msg + woke + (woke && st.w !== 'blocked' ? ` Pipe now: ${st.n} of ${CAP}.` : ''), 'ok');  // shows the sentence in green, plus anything wakeWriter added and the fill level after a woken write
            }  // ends the readable case
            else if (!wOpen()) say(st.n ? `wc asks for ${k} bytes. Only ${nB(st.n)} ${st.n === 1 ? 'remains' : 'remain'} and the writer has exited, so no more can come: ` + finishRead(k) : eof(), 'ok');  // the writer is gone: wc gets whatever is left, or end of file if nothing is left
            else {  // otherwise the read cannot finish yet
              st.r = 'blocked'; st.rPend = k;  // wc blocks, remembering how many bytes it asked for
              say(st.n ? `wc asks for ${k} bytes but the pipe holds only ${nB(st.n)}. Under the classic rule the reader <b>blocks</b> until all ${k} are there. (A real POSIX read() would return ${st.n === 1 ? 'that byte' : 'those ' + st.n + ' bytes'} at once: switch the rule to compare.)` : `wc asks for ${k} bytes but the pipe is <b>empty</b>, so the reader blocks until ls writes something.`, 'bad');  // red sentence: wc blocks; if some bytes are there it adds that the POSIX rule would return them at once
            }  // ends the blocking case
            draw();  // redraws the pipe
          }  // ends doRead
          function closeW() {  // closeW(): runs when the student makes ls exit, closing the write end
            if (st.w !== 'run') return;  // does nothing unless ls is running
            st.w = 'exited'; st.hotW = []; st.hotR = [];  // marks ls as exited and clears the highlights
            say((st.next < NAMES.length ? 'ls stops early and exits.' : 'ls has written every name, so it exits.') + ' Exiting closes the write end of the pipe. Bytes already in the pipe stay there for wc.' + wakeReader());  // sentence: ls exits early or after its last name, closing the write end; bytes already in the pipe stay; a blocked wc may now wake
            draw();  // redraws the pipe
          }  // ends closeW
          function closeR() {  // closeR(): runs when the student makes wc exit, closing the read end
            if (st.r !== 'run') return;  // does nothing unless wc is running
            st.r = 'exited'; st.hotW = []; st.hotR = [];  // marks wc as exited and clears the highlights
            if (st.w === 'blocked') { st.w = 'killed'; st.wPend = null; say('wc exits early and closes the read end. ls is blocked in write() for a pipe nobody can read any more, so the kernel wakes it with <b>SIGPIPE</b>, which terminates it.', 'bad'); }  // if ls was blocked writing, it can never finish, so the kernel kills it with SIGPIPE; red narration
            else say('wc exits early and closes the read end. ' + (st.n ? `The ${nB(st.n)} still in the pipe will never be read.` : 'The pipe is empty.') + (st.w === 'run' && st.next < NAMES.length ? ' Now try making ls write.' : ` ls ${st.w === 'run' ? 'has nothing left to write' : 'has already exited'}, so no writer is affected. To see what happens to one, Reset and close the read end while ls still has names to write.`));  // otherwise says what is lost or empty, and suggests making ls write now, or resetting to try closing while ls still has names
            draw();  // redraws the pipe
          }  // ends closeR
          const CX = 180, CY = 176, R1 = 82, R2 = 130;  // geometry of the ring: centre (CX, CY), inner radius R1 and outer radius R2 of the 16 slots
          const pt = (deg, r) => [CX + r * Math.cos(deg * Math.PI / 180), CY + r * Math.sin(deg * Math.PI / 180)];  // pt(deg, r): the point at angle deg (in degrees) and distance r from the centre, using sine and cosine
          const ang = (k) => -90 + k * (360 / CAP);  // ang(k): the angle of slot k's centre; slot 0 is straight up (-90 degrees) and each slot is 360/16 = 22.5 degrees further clockwise
          function sector(k) {  // sector(k): builds the outline of slot k as one ring-shaped wedge, in SVG path language
            const a0 = ang(k) - 180 / CAP, a1 = ang(k) + 180 / CAP;  // a0 and a1: the angles of the wedge's two edges, half a slot either side of its centre
            const [x0, y0] = pt(a0, R2), [x1, y1] = pt(a1, R2), [x2, y2] = pt(a1, R1), [x3, y3] = pt(a0, R1);  // the four corners: two on the outer circle, two on the inner circle
            return `M${x0} ${y0} A${R2} ${R2} 0 0 1 ${x1} ${y1} L${x2} ${y2} A${R1} ${R1} 0 0 0 ${x3} ${y3} Z`;  // path: move to an outer corner, arc along the outer circle, line inward, arc back along the inner circle, and close the shape
          }  // ends sector
          function pointer(k, label, cls, color, dr) {  // pointer(k, label, cls, color, dr): draws an arrowhead pointing at slot k from outside the ring, with a label beyond it
            const a = ang(k), [tx, ty] = pt(a, 134), [bx1, by1] = pt(a - 4.5, 150), [bx2, by2] = pt(a + 4.5, 150), [lx, ly] = pt(a, 160 + dr);  // tx, ty is the tip near the ring; bx1/by1 and bx2/by2 the two back corners; lx, ly the label spot, pushed further out by dr
            return s('g', {}, s('path', { d: `M${tx} ${ty} L${bx1} ${by1} L${bx2} ${by2} Z`, class: cls, 'stroke-width': 2 }),  // returns a group holding the triangle, filled with the colour class cls
              s('text', { x: lx, y: ly + 5, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800, style: `fill:var(${color})` }, label));  // and the label (write or read), in bold and the matching colour
          }  // ends pointer
          function draw() {  // draw(): rebuilds the whole picture from st; runs after every action
            const kids = [];  // kids collects the SVG pieces for this drawing
            for (let k = 0; k < CAP; k++) {  // one wedge per slot, 0 to 15
              const full = st.buf[k] != null, hotW = st.hotW.includes(k), hotR = st.hotR.includes(k);  // full: the slot holds a byte; hotW and hotR: it was just written or just read
              kids.push(s('path', { d: sector(k), class: full ? (hotW ? 's-accent' : 's-mem') : 's-panel', 'stroke-width': hotR || hotW ? 2.5 : 1.5, 'stroke-dasharray': hotR ? '4 3' : null }));  // the wedge: accent colour if just written, memory colour if full, plain if empty; a thicker edge if just touched, dashed if just read
              const [x, y] = pt(ang(k), 106);  // x, y: the middle of slot k's wedge, where its byte is written
              if (full) kids.push(s('text', { x, y: y + 6, 'text-anchor': 'middle', 'font-size': 17, 'font-weight': 800, class: 's-monot' }, st.buf[k]));  // a full slot shows its byte (a letter or the newline symbol) in bold fixed-width type
              const [ix, iy] = pt(ang(k), 69);  // ix, iy: a point just inside the ring, where the slot number goes
              kids.push(s('text', { x: ix, y: iy + 5, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, String(k)));  // the slot number 0-15 in small grey text, so students can follow the wrap-around
            }  // ends the loop over slots
            kids.push(s('text', { x: CX, y: CY + 4, 'text-anchor': 'middle', 'font-size': 30, 'font-weight': 900 }, `${st.n}/${CAP}`));  // big count in the middle of the ring, such as 9/16
            kids.push(s('text', { x: CX, y: CY + 24, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, 'bytes used'));  // small caption under the count: bytes used
            if (st.rd === st.wr) kids.push(pointer(st.rd, 'read = write', 's-accent', '--accent', 0));  // when the read and write positions are on the same slot (empty or completely full) one pointer is labelled read = write
            else kids.push(pointer(st.wr, 'write', 's-accent', '--accent', 0), pointer(st.rd, 'read', 's-io', '--io', 0));  // otherwise two pointers: the write position in the accent colour and the read position in the I/O colour
            svg.replaceChildren(...kids);  // swaps the old drawing for the new pieces in one go
            const wStat = { run: 'Running', blocked: `Blocked in write(): needs ${st.wPend ? st.wPend.length : 0} free bytes`, exited: 'Exited: write end closed', killed: 'Killed by SIGPIPE' }[st.w];  // wStat: the writer's status line for each state: running, blocked (with the room it needs), exited, or killed by SIGPIPE
            const rStat = { run: 'Running', blocked: `Blocked in read(${st.rPend})`, done: `Printed ${lines()} and exited`, exited: 'Exited early: read end closed' }[st.r];  // rStat: the reader's status line: running, blocked in a read of so many bytes, finished with its count, or exited early
            const cls = (x) => 'pcard' + (x === 'blocked' ? ' blocked' : x === 'run' ? '' : ' dead');  // cls(x): picks the card style: amber when blocked, plain when running, grey for any finished state
            const nm = NAMES[st.next];  // nm: the name ls will write next, or nothing once all six are written
            cards.replaceChildren(  // replaces both process cards with fresh ones built from the current state
              h('div', { class: cls(st.w) },  // the ls card, coloured by the writer's state
                h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'nm mono' }, 'ls'), h('span', { class: 'chip accent' }, 'writer')),  // card header: the name ls on the left and a writer tag on the right
                h('div', { class: 'st' }, wStat),  // the writer's status line
                h('div', { class: 'small' }, nm ? `Next: “${nm}” (${nm.length} bytes)` : `All ${NAMES.length} names written`),  // which name comes next and its length, or that every name is written
                h('button', { class: 'btn sm', type: 'button', disabled: st.w !== 'run' || !nm, onclick: doWrite }, nm ? `write(“${nm}”)` : 'nothing left to write'),  // write button: tries the next name; disabled unless ls is running and has something left
                h('button', { class: 'btn sm', type: 'button', disabled: st.w !== 'run', onclick: closeW }, 'exit (close write end)')),  // exit button: ends ls, closing the write end; disabled unless ls is running
              h('div', { class: cls(st.r === 'done' ? 'dead' : st.r) },  // the wc -l card; a reader that has printed its count is shown grey like an exited one
                h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'nm mono' }, 'wc -l'), h('span', { class: 'chip io' }, 'reader')),  // card header: the name wc -l on the left and a reader tag on the right
                h('div', { class: 'st' }, rStat),  // the reader's status line
                h('div', { class: 'small' }, `Read so far: ${st.got.length} bytes, ${lines()} line${lines() === 1 ? '' : 's'}`),  // how many bytes and lines wc has received so far
                h('div', { class: 'grid-2', style: { gap: '6px' } },  // two read buttons side by side
                  h('button', { class: 'btn sm', type: 'button', disabled: st.r !== 'run', onclick: () => doRead(4) }, 'read(4)'),  // read(4): asks the pipe for 4 bytes
                  h('button', { class: 'btn sm', type: 'button', disabled: st.r !== 'run', onclick: () => doRead(10) }, 'read(10)')),  // read(10): asks for 10 bytes, more than a single name, to show what happens when not enough are there
                h('button', { class: 'btn sm', type: 'button', disabled: st.r !== 'run', onclick: closeR }, 'exit early (close read end)')));  // exit-early button: ends wc, closing the read end, so a later write meets SIGPIPE
          }  // ends draw
          const ruleSeg = ctx.ui.seg([{ value: 'classic', label: 'Classic: wait for all', title: 'A read that asks for more bytes than the pipe holds blocks.' }, { value: 'posix', label: 'POSIX: take what is there', title: 'A read returns whatever bytes are present; it blocks only on an empty pipe.' }], rule, (v) => {  // ruleSeg: a two-button switch between the classic read rule and the POSIX rule, each with a hover explanation
            rule = v; reset();  // on a switch: remembers the new rule and resets the pipe so the two rules are compared from the same start
            say(v === 'classic' ? '<b>Classic rule.</b> A read that asks for more bytes than the pipe holds blocks until that many have arrived. This is the classic model of a pipe.' : '<b>POSIX rule.</b> This is what Linux and other modern systems do: read(k) returns at once with whatever is there (up to k bytes) and blocks only when the pipe is empty.');  // replaces the opening narration with an explanation of the rule just chosen
          });  // ends the switch's change handler
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: 'minmax(0, 400px) minmax(0, 1fr)', gap: '22px' } },  // page layout: two columns, the drawing up to 400 pixels wide on the left and the controls taking the rest
            h('div', { class: 'stack', style: { gap: '8px' } },  // left column, stacked
              h('div', { class: 'card white tight', style: { display: 'grid', placeItems: 'center', padding: '4px' } }, svg),  // the ring drawing, centred in a white card
              h('div', { class: 'row gap-s xs' }, h('span', { class: 'chip mem' }, 'byte waiting'), h('span', { class: 'chip accent' }, 'just written'), h('span', { class: 'chip' }, 'dashed: just read')),  // colour key for the ring: waiting byte, just written, and dashed for just read
              h('div', { class: 'callout why small m0', 'data-label': 'Mutual exclusion is built in', html: 'The kernel lets only one process at a time work on the pipe, so a read and a write never run at the same moment and the buffer is never caught half-updated. The processes need no lock of their own.' })),  // note box: the kernel lets only one process at a time work on the pipe, so the processes need no lock of their own
            h('div', { class: 'stack', style: { gap: '9px' } },  // right column, stacked
              h('p', { class: 'm0 small', html: 'A <span class="t">pipe</span> is a <span class="t">circular buffer</span> used producer/consumer style: bytes leave in the order they arrived (first in, first out), and the positions wrap from slot 15 back to slot 0.' }),  // short explanation: a pipe is a first-in-first-out circular buffer whose positions wrap from 15 back to 0
              h('div', { class: 'row', style: { gap: '10px' } }, h('span', { class: 'small b' }, 'Read rule'), ruleSeg, h('button', { class: 'btn sm', type: 'button', onclick: () => reset() }, 'Reset')),  // control row: the read rule switch and a Reset button
              cards, narr,  // the two process cards and the narration box
              h('div', { class: 'card tight small' }, h('b', {}, 'Try these: '),  // suggestion card with a bold Try these heading
                'write three names until the pipe is full; write again (ls blocks); read(4) twice and watch ls wake; read(10) with fewer than 10 bytes there; let ls exit and read to the end; Reset, let wc exit first, then write.'))));  // the list of experiments to try in order: fill, block, wake, short read, end of file, and SIGPIPE
          reset();  // starts the simulation in its opening state as soon as the step is drawn
        },  // ends render for step 2
      },  // ends step 2

      /* ---------------- 3. Where pipes come from: unnamed and named ---------------- */
      {  // step 3 starts here
        title: 'How the shell builds ls | wc -l, and named pipes',  // title of step 3
        kind: 'learn',  // kind learn: labelled Learn, an explanation with a walk-through
        render(el, ctx) {  // render(el, ctx): builds the code listing, the process picture and the frame player when step 3 opens
          const { h, s } = ctx;  // takes the HTML builder h and the SVG builder s out of ctx
          const src = `${/* src: the C code the shell runs to build ls | wc -l, shown to students with its own comments */''}
int fd[2]; pipe(fd);    // new pipe: fd[0] reads, fd[1] writes${/* shown code, line 1: creates the pipe and gets its two descriptors */''}
if (fork() == 0) {      // child 1 starts as a copy of the shell${/* shown code, line 2: the first fork makes child 1 */''}
    dup2(fd[1], 1);     // its output (fd 1) now feeds the pipe${/* shown code, line 3: child 1 sends its standard output into the pipe */''}
    close(fd[0]);       // it never reads from the pipe${/* shown code, line 4: child 1 closes the read end it will never use */''}
    close(fd[1]);       // spare copy: fd 1 already points there${/* shown code, line 5: child 1 closes its spare copy of the write end */''}
    execlp("ls", "ls", NULL); // run ls; fds survive exec${/* shown code, line 6: child 1 becomes ls, keeping its descriptors */''}
    _exit(127);         // reached only if exec failed${/* shown code, line 7: exits only if exec failed */''}
}                       // end of child 1's code${/* shown code, line 8: end of child 1's block */''}
if (fork() == 0) {      // child 2: another copy of the shell${/* shown code, line 9: the second fork makes child 2 */''}
    dup2(fd[0], 0);     // its input (fd 0) now drains the pipe${/* shown code, line 10: child 2 takes its standard input from the pipe */''}
    close(fd[0]);       // spare copy: fd 0 already points there${/* shown code, line 11: child 2 closes its spare copy of the read end */''}
    close(fd[1]);       // it must hold no write end (see EOF)${/* shown code, line 12: child 2 closes the write end so end of file can arrive */''}
    execlp("wc", "wc", "-l", NULL); // become wc -l${/* shown code, line 13: child 2 becomes wc -l */''}
    _exit(127);         // reached only if exec failed${/* shown code, line 14: exits only if exec failed */''}
}                       // end of child 2's code${/* shown code, line 15: end of child 2's block */''}
close(fd[0]); close(fd[1]); // the shell keeps neither end${/* shown code, line 16: the shell closes both of its ends */''}
wait(NULL); wait(NULL); // sleep until both children finish`;  // shown code, line 17: the shell waits for both children, which ends the code text
          const code = ctx.ui.code(src, { lang: 'c', fontSize: 13 });  // code: turns the source into a highlighted C listing at 13-pixel type; the frames below highlight its lines
          const total = LS_NAMES.join('').length, count = LS_NAMES.length;  // total: the number of bytes in all six names; count: the number of names, which is what wc -l will print
          // Geometry: the small-screen version packs the same picture into a 340-unit-wide drawing.
          const SLIM = ctx.narrow, VW = SLIM ? 340 : 540, BW = SLIM ? 150 : 160, BH = 56;  // SLIM is true on a phone-width screen; VW is the drawing width, BW and BH the width and height of each process box
          const SH = { x: (VW - BW) / 2, y: 8 }, C1 = { x: SLIM ? 4 : 6, y: 120 }, C2 = { x: VW - BW - (SLIM ? 4 : 6), y: 120 };  // SH: the shell's box, centred at the top; C1 and C2: the two children's boxes, at the left and right edges lower down
          const PX = SLIM ? 80 : 150, PW = VW - 2 * PX; // the pipe's left edge and width
          const WEND = [PX + 18, 238], REND = [PX + PW - 18, 238];  // WEND and REND: the points where the pipe's write end (left) and read end (right) are drawn
          // One frame per stage. fds: [number, 'R' or 'W']; a process set to null is not drawn.
          const frames = [  // frames: one snapshot per stage of the walk-through, shown one at a time by the player
            { ln: [], sh: { t: 'shell', fds: [] }, pipe: false,  // frame 1: only the shell, no pipe yet; ln lists the code lines to highlight (none here)
              cap: 'You type <code>ls | wc -l</code>. The shell (pid 500) must connect the <b>output of ls</b> to the <b>input of wc</b>. Press Next to watch it build the connection.' },  // frame 1 caption: the shell must connect ls's output to wc's input
            { ln: [1], sh: { t: 'shell', fds: [[3, 'R'], [4, 'W']] }, pipe: true,  // frame 2: the shell now holds descriptor 3 (read end) and 4 (write end), and the pipe appears
              cap: '<code>pipe(fd)</code>: the kernel creates an empty pipe and gives the shell two <span class="t" data-t="file descriptor">file descriptors</span>: <b>3</b> for the read end and <b>4</b> for the write end (0, 1 and 2 are already taken by standard input, output and error).' },  // frame 2 caption: pipe(fd) creates an empty pipe and why the new descriptors are 3 and 4
            { ln: [2], sh: { t: 'shell', fds: [[3, 'R'], [4, 'W']] }, c1: { t: 'copy of shell', fds: [[3, 'R'], [4, 'W']] }, pipe: true,  // frame 3: child 1 appears as a copy of the shell with the same two descriptors
              cap: '<code>fork()</code> makes child 1 (pid 501), which <b>inherits</b> both descriptors. An unnamed pipe has no name to open, so inheritance is the normal way to reach it; that is why it joins <b>related</b> processes.' },  // frame 3 caption: fork copies the descriptors, which is why unnamed pipes join related processes
            { ln: [3, 4, 5, 6], sh: { t: 'shell', fds: [[3, 'R'], [4, 'W']] }, c1: { t: 'ls', fds: [[1, 'W']] }, pipe: true,  // frame 4: child 1 has become ls, holding only descriptor 1 on the write end
              cap: 'Child 1 points descriptor 1 (standard output) at the write end, closes its spare copies 3 and 4, and runs <b>ls</b>. Descriptors survive exec, so ls writes to standard output unaware of the pipe. (exec returns only if it fails, hence <code>_exit</code>.)' },  // frame 4 caption: dup2, the two closes and exec, and why ls never knows about the pipe
            { ln: [9], sh: { t: 'shell', fds: [[3, 'R'], [4, 'W']] }, c1: { t: 'ls', fds: [[1, 'W']] }, c2: { t: 'copy of shell', fds: [[3, 'R'], [4, 'W']] }, pipe: true,  // frame 5: child 2 appears as another copy of the shell
              cap: 'A second <code>fork()</code> makes child 2 (pid 502). It also inherits descriptors 3 and 4 from the shell.' },  // frame 5 caption: the second fork, and child 2 inheriting descriptors 3 and 4
            { ln: [10, 11, 12, 13], sh: { t: 'shell', fds: [[3, 'R'], [4, 'W']] }, c1: { t: 'ls', fds: [[1, 'W']] }, c2: { t: 'wc -l', fds: [[0, 'R']] }, pipe: true,  // frame 6: child 2 has become wc -l, holding only descriptor 0 on the read end
              cap: 'Child 2 makes descriptor 0 (standard input) point at the read end, closes 3 and 4, and runs <b>wc -l</b>, which reads standard input as usual.' },  // frame 6 caption: child 2 points its standard input at the read end and runs wc -l
            { ln: [16], sh: { t: 'shell (waiting)', fds: [] }, c1: { t: 'ls', fds: [[1, 'W']] }, c2: { t: 'wc -l', fds: [[0, 'R']] }, pipe: true,  // frame 7: the shell has closed both ends and is waiting
              cap: 'The shell closes <b>both</b> of its ends. This matters: a reader sees <span class="t" data-t="end of file">end of file</span> only after <b>every</b> write end is closed. Had the shell kept descriptor 4, wc would wait forever.' },  // frame 7 caption: why the shell must close its ends, or wc would never see end of file
            { ln: [17], sh: { t: 'shell (waiting)', fds: [] }, c1: { t: 'ls (exited)', fds: [], dead: true }, c2: { t: 'wc -l', fds: [[0, 'R']], out: `read() = 0 → prints ${count}` }, pipe: true, flow: true,  // frame 8: ls has exited, bytes flow, and wc's box shows read returning 0 and the count it prints
              cap: `ls writes its ${count} names (${total} bytes) and exits, which closes the last write end. wc reads all ${total} bytes, then read() returns 0, end of file. wc prints <b>${count}</b>, exits, and the shell's two waits return.` },  // frame 8 caption: ls's exit closes the last write end, wc reaches end of file, prints the count, and the waits return
            { ln: [], named: true,  // frame 9: switches the picture to a named pipe
              cap: '<b><span class="t" data-t="named pipe">Named pipe</span>.</b> <code>mkfifo /tmp/jobs</code> gives a pipe a name in the file system. A spooler started at boot opens it for reading, a script in another terminal opens it for writing: unrelated, yet connected. Same buffer, same blocking rules.' },  // frame 9 caption: mkfifo gives a pipe a file-system name so unrelated processes can meet through it
          ];  // closes the frames list
          const svg = s('svg', { viewBox: `0 0 ${VW} 300`, width: '100%' });  // the drawing area for the process picture: as wide as the chosen layout and 300 units tall
          const COL = { W: ['--accent', 'arr-accent'], R: ['--io', 'arr-io'] };  // COL: for a write end, the accent colour and its arrowhead; for a read end, the I/O colour and its arrowhead
          function proc(pos, title, pid, cls, sub) {  // proc(pos, title, pid, cls, sub): draws one process box at pos with its name and, underneath, its pid or another subtitle
            return s('g', {},  // returns the box and its two lines of text as one SVG group
              s('rect', { x: pos.x, y: pos.y, width: BW, height: BH, rx: 12, class: cls, 'stroke-width': 2 }),  // the rounded box, coloured by cls (kernel colour for the shell, process colour for a child, grey once ended)
              s('text', { x: pos.x + BW / 2, y: pos.y + 23, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 16, class: 's-monot' }, title),  // the process name (shell, ls, wc -l ...) in bold fixed-width type near the top of the box
              s('text', { x: pos.x + BW / 2, y: pos.y + 43, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, sub || 'pid ' + pid));  // the subtitle under it: the given text, or "pid" and the process number
          }  // ends proc
          // Lines from a process to the pipe end each descriptor refers to; data flows into the write end and out of the read end.
          function fdLines(pos, fds, at = 0.5) {  // fdLines(pos, fds, at): one arrow per descriptor the process holds, joining its box to the pipe end that descriptor refers to
            return fds.map(([n, end], k) => {  // builds one group per descriptor, where n is its number and end says R (read end) or W (write end)
              const px = pos.x + BW * (k + 1) / (fds.length + 1), py = pos.y + BH;  // px, py: where the arrow leaves the box, with several descriptors spread evenly along its bottom edge
              const [ex, ey] = end === 'W' ? WEND : REND;  // ex, ey: the pipe end this descriptor refers to
              const [c, m] = COL[end];  // c and m: the colour and arrowhead for this kind of end
              const line = end === 'W' ? { x1: px, y1: py, x2: ex, y2: ey } : { x1: ex, y1: ey, x2: px, y2: py + 2 };  // the arrow points the way data moves: from the process into the write end, or out of the read end up to the process
              // Label at fraction `at` along the line from the process, pushed 16 units off it on the upper side so crossing lines keep their labels apart.
              const dx = ex - px, dy = ey - py, len = Math.hypot(dx, dy) || 1;  // dx, dy: the arrow's direction; len: its length (1 if it would be zero, so nothing is divided by zero)
              let nx = -dy / len, ny = dx / len;  // nx, ny: a step of length 1 at right angles to the arrow
              if (ny > 0) { nx = -nx; ny = -ny; }  // if that step points downward, it is flipped so the label always sits above the line
              const lx = px + (ex - px) * at + nx * 16, ly = py + (ey - py) * at + ny * 16;  // lx, ly: the label position, a fraction at of the way along the line and 16 units off to the side
              return s('g', {},  // returns the arrow and its label as a group, so the caller can draw all arrows first and all labels last
                s('line', { ...line, class: 's-line', style: `stroke:var(${c})`, 'marker-end': `url(#${m})` }),  // the arrow line, in its end's colour, with the matching arrowhead
                s('text', { x: lx, y: ly + 4, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, style: `fill:var(${c})` }, 'fd ' + n));  // the label "fd" plus the descriptor number, bold and in the same colour
            });  // closes the map over descriptors
          }  // ends fdLines
          function kernel(pipeOn, label) {  // kernel(pipeOn, label): draws the kernel band across the bottom and, if pipeOn, the pipe inside it with a label
            const out = [s('rect', { x: 4, y: 214, width: VW - 8, height: 84, rx: 14, class: 's-os', 'stroke-width': 2, 'fill-opacity': 0.6 }),  // the kernel band: a wide, slightly see-through rounded box in the kernel colour
              s('text', { x: 16, y: 236, 'font-size': 13, 'font-weight': 800, style: 'fill:var(--os)' }, 'kernel')];  // the word kernel in the band's top left corner
            if (pipeOn) out.push(  // once the pipe exists, it is added to the band
              s('rect', { x: PX, y: 238, width: PW, height: 34, rx: 17, class: 's-mem', 'stroke-width': 2 }),  // the pipe itself: a rounded tube in the memory colour
              s('text', { x: VW / 2, y: 260, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700, class: 's-monot' }, label),  // the label in the middle of the pipe: the word pipe, the bytes flowing, or the named pipe's buffer
              s('text', { x: WEND[0], y: 290, 'text-anchor': 'middle', 'font-size': 13, style: 'fill:var(--accent)' }, 'write end'),  // caption under the left end: write end, in the write colour
              s('text', { x: REND[0], y: 290, 'text-anchor': 'middle', 'font-size': 13, style: 'fill:var(--io)' }, 'read end'));  // caption under the right end: read end, in the read colour
            return out;  // returns the band and, if present, the pipe
          }  // ends kernel
          function render(i) {  // render(i): the player calls this for frame i; it redraws the picture, highlights the matching code lines and returns the caption
            const f = frames[i], kids = [];  // f is this frame's snapshot; kids collects the SVG pieces
            code.clear(); if (f.ln.length) code.mark(f.ln);  // clears all highlights in the code listing, then highlights this frame's lines if it names any
            if (f.named) {  // the named-pipe frame has its own picture
              kids.push(...kernel(true, 'buffer of /tmp/jobs'));  // the kernel band with a pipe labelled as the named pipe's buffer
              kids.push(s('rect', { x: SH.x, y: SH.y, width: BW, height: BH, rx: 12, class: 's-io', 'stroke-width': 2, 'stroke-dasharray': '6 4' }),  // a dashed box where the shell used to be, standing for the pipe's name in the file system
                s('text', { x: SH.x + BW / 2, y: SH.y + 23, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 16, class: 's-monot' }, '/tmp/jobs'),  // the name itself, in bold fixed-width type
                s('text', { x: SH.x + BW / 2, y: SH.y + 43, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, 'name in the file system'));  // the subtitle under it: name in the file system
              kids.push(s('path', { d: `M${C1.x + BW / 2} ${C1.y} C ${C1.x + BW / 2} 70, ${SH.x - 35} 40, ${SH.x} ${SH.y + 30}`, class: 's-muted', 'stroke-dasharray': '5 4', fill: 'none' }),  // a dashed curve from the left process up to the name, meaning it found the pipe by opening that name
                s('path', { d: `M${C2.x + BW / 2} ${C2.y} C ${C2.x + BW / 2} 70, ${SH.x + BW + 35} 40, ${SH.x + BW} ${SH.y + 30}`, class: 's-muted', 'stroke-dasharray': '5 4', fill: 'none' }),  // a matching dashed curve from the right process up to the name
                s('text', { x: SLIM ? 118 : 150, y: 100, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, SLIM ? 'open: write' : 'open(name, write)'),  // label on the left curve: opened for writing (a shorter label on a small screen)
                s('text', { x: SLIM ? 222 : 390, y: 100, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, SLIM ? 'open: read' : 'open(name, read)'));  // label on the right curve: opened for reading (a shorter label on a small screen)
              const g = [...fdLines(C1, [[3, 'W']]), ...fdLines(C2, [[3, 'R']])];  // g: arrows for the writer's descriptor 3 into the write end and the reader's descriptor 3 out of the read end
              kids.push(...g.map((x) => x.firstChild));  // draws the arrow lines first
              kids.push(proc(C1, 'script', 1290, 's-proc', SLIM ? 'pid 1290, a terminal' : 'pid 1290, own terminal'), proc(C2, 'spooler', 812, 's-proc', SLIM ? 'pid 812, from boot' : 'pid 812, started at boot'));  // then two unrelated processes: a script in its own terminal (pid 1290) and a spooler started at boot (pid 812)
              kids.push(...g.map((x) => x.lastChild));  // then the fd labels last, so no label is hidden behind a box
            } else {  // every other frame shows the shell and its children
              kids.push(...kernel(f.pipe, f.flow ? LS_NAMES.join('').slice(0, 18) + '…' : 'pipe'));  // the kernel band; the pipe appears once created, and in the last frame shows the start of the names flowing through it
              // Draw order: descriptor lines, then the process boxes, then the fd labels, so no label hides behind a box.
              const g = [...fdLines(SH, f.sh.fds, 0.3), ...(f.c1 ? fdLines(C1, f.c1.fds) : []), ...(f.c2 ? fdLines(C2, f.c2.fds) : [])];  // g: the descriptor arrows for the shell (labels placed closer to it), then for each child that exists in this frame
              kids.push(...g.map((x) => x.firstChild));  // draws the arrow lines first
              kids.push(proc(SH, f.sh.t, 500, 's-os'));  // the shell's box, pid 500, in the kernel colour
              if (f.c1) kids.push(proc(C1, f.c1.t, 501, f.c1.dead ? 's-panel' : 's-proc'));  // child 1's box, pid 501, if it exists in this frame; grey once ls has exited
              if (f.c2) kids.push(proc(C2, f.c2.t, 502, 's-proc'));  // child 2's box, pid 502, if it exists in this frame
              kids.push(...g.map((x) => x.lastChild));  // then the fd labels on top
              if (f.c2 && f.c2.out) kids.push(s('text', { x: C2.x + BW / 2, y: C2.y - 10, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800, style: 'fill:var(--ok)' }, f.c2.out));  // in the final frame, green text above wc's box shows read returning 0 and the count it prints
            }  // ends the shell-and-children case
            svg.replaceChildren(...kids);  // swaps in the new picture
            return f.cap;  // hands the caption back to the player, which shows it
          }  // ends render for the walk-through
          const player = ctx.ui.player({ count: frames.length, render, interval: 3200 });  // player: the Restart / Previous / Play / Next control, one frame per stage, advancing every 3.2 seconds while playing
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: 'minmax(0, 545px) minmax(0, 1fr)', gap: '20px' } },  // page layout: two columns, the code (up to 545 pixels) on the left and the picture on the right
            h('div', { class: 'stack', style: { gap: '8px' } },  // left column, stacked
              h('p', { class: 'm0 small', html: 'The <code>|</code> in a shell command is an unnamed pipe. Here is the C the shell runs for <code>ls | wc -l</code>, with every line explained. The highlighted lines match the picture.' }),  // intro: the | in a shell command is an unnamed pipe; the highlighted code lines match the picture
              code,  // the C listing built above
              h('div', { class: 'callout warn small m0', 'data-label': 'Common mistake' }, 'Forgetting to close an unused write end. The reader then never sees end of file, because the kernel thinks someone may still write, and the pipeline hangs.')),  // warning box: forgetting to close an unused write end means the reader never gets end of file and the pipeline hangs
            h('div', { class: 'stack', style: { gap: '8px' } },  // right column, stacked
              h('div', { class: 'card white tight' }, svg),  // the process picture in a white card
              player.el,  // the player's controls and caption box
              h('div', { class: 'row gap-s xs' }, h('span', { class: 'chip accent' }, 'write-end descriptor'), h('span', { class: 'chip io' }, 'read-end descriptor'), h('span', { class: 'xs muted' }, 'unnamed: related processes only · named: anyone who can open the name')))));  // colour key: write-end and read-end descriptors, plus the one-line difference between unnamed and named pipes
        },  // ends render for step 3
      },  // ends step 3

      /* ---------------- 4. Message queues: typed mail ---------------- */
      {  // step 4 starts here
        title: 'Message queues: a mailbox with typed messages',  // title of step 4
        kind: 'explore',  // kind explore: labelled Explore, a hands-on simulator
        render(el, ctx) {  // render(el, ctx): builds the message queue simulator when step 4 opens
          const { h, s } = ctx;  // takes the HTML builder h and the SVG builder s out of ctx
          const CAP = 5;  // CAP: this queue holds at most 5 messages, so filling it takes only a few clicks
          const TYPES = { 1: ['urgent', 's-warn', '--warn'], 2: ['query', 's-accent', '--accent'], 3: ['log', 's-panel', '--ink-2'] };  // TYPES: for each message type 1-3, its name (urgent, query, log), its box colour class and its text colour
          let st;  // st will hold the simulation state
          const svg = s('svg', { viewBox: '0 4 620 180', width: '100%' });  // the drawing area for the queue, wide and short; the viewBox is changed below for small screens
          const cards = h('div', { class: 'grid-2', style: { gap: '10px' } });  // a two-column grid that will hold the client's and server's cards
          const narr = h('div', { class: 'narr', style: { minHeight: '66px' } });  // the narration box, tall enough for a few lines so the layout does not jump
          const say = (html, tone) => sayInto(narr, html, tone);  // say(html, tone): shorthand that writes into this step's narration box
          const tag = (m) => `type ${m.type} (${TYPES[m.type][0]} #${m.seq})`;  // tag(m): a message's description for the narration, such as "type 2 (query #4)"
          function reset() {  // reset(): empties the queue and puts both processes back to running; runs when the step opens and on Reset
            st = { q: [], seq: 0, snd: 'run', pend: null, rcv: 'run', last: null, took: 0, fails: 0 };  // st: q is the queue (oldest first), seq numbers messages as they are sent, snd and rcv are the two processes' states, pend a message waiting to enter, last the most recent message received, took and fails count successful and failed receives
            say('An empty queue that holds at most ' + CAP + ' messages (a real queue\'s limit is a total number of bytes). Send a few messages of different types, then receive them in different ways.');  // opening narration: the queue holds 5 messages (real queues limit total bytes) and what to try first
            draw();  // draws the empty queue
          }  // ends reset
          // The sender's pending message enters as soon as there is room.
          function admitPending() {  // admitPending(): after a message leaves, lets a blocked client's waiting message into the queue, and returns a sentence about it
            if (st.snd !== 'blocked' || st.q.length >= CAP) return '';  // nothing to do unless the client is blocked and the queue now has a free place
            const m = st.pend; st.q.push(m); st.pend = null; st.snd = 'run';  // moves the waiting message to the back of the queue and sets the client running again
            return ` That freed a place, so the kernel wakes the blocked sender and its message, ${tag(m)}, joins the back of the queue.`;  // sentence added to the narration: the freed place let the kernel wake the client, and its message joined the back
          }  // ends admitPending
          function send(t) {  // send(t): runs when the student clicks a send button; the client sends a message of type t
            if (st.snd !== 'run') return;  // does nothing while the client is blocked
            const m = { type: t, seq: ++st.seq };  // m: the new message, with its type and the next sequence number
            if (st.rcv === 'blocked') {  // if the server is blocked waiting for any message, this one goes straight to it
              st.rcv = 'run'; st.last = m; st.took++;  // the server runs again, records this as the last message received and counts it
              say(`The client sends ${tag(m)}. The server was blocked in msgrcv waiting for any message, so the kernel wakes it and the message goes straight to it.`, 'ok');  // green narration: the blocked server is woken and handed the message directly
            } else if (st.q.length < CAP) {  // otherwise, if the queue has a free place
              st.q.push(m);  // the message joins the back of the queue
              say(`msgsnd: ${tag(m)} joins the <b>back</b> of the queue. ${st.q.length} of ${CAP} places used.`, 'ok');  // green narration: msgsnd put it at the back, and how many places are now used
            } else {  // otherwise the queue is full
              st.snd = 'blocked'; st.pend = m;  // the client blocks, holding the message until a place frees up
              say(`msgsnd: the queue is <b>full</b> (${CAP} of ${CAP}), so the client <b>blocks</b> holding ${tag(m)} until the server removes a message.`, 'bad');  // red narration: the queue is full, so msgsnd blocks the client
            }  // ends the three cases
            draw();  // redraws the queue and the cards
          }  // ends send
          function recv(k) {  // recv(k): runs when the student clicks a receive button; k is 0 for "receive any" or a type number 1-3
            if (st.rcv !== 'run') return;  // does nothing while the server is blocked
            if (k === 0) {  // receive any: takes the oldest message of any type
              if (!st.q.length) { st.rcv = 'blocked'; say('msgrcv(any) finds the queue <b>empty</b>, so the server <b>blocks</b> until a message arrives.', 'bad'); return draw(); }  // an empty queue blocks the server until something arrives; red narration
              const m = st.q.shift(); st.last = m; st.took++;  // removes the message at the front (the oldest), records it as last received and counts it
              say(`msgrcv(any) takes the <b>oldest</b> message, ${tag(m)}: first in, first out.` + admitPending(), 'ok');  // green narration: first in, first out, plus a note if this let a blocked client in
              return draw();  // redraws and stops here
            }  // ends the receive-any case
            const i = st.q.findIndex((m) => m.type === k);  // receive type k: i is the position of the oldest message of that type, or -1 if there is none
            if (i < 0) {  // no message of that type is waiting
              st.fails++;  // counts a failed receive
              say(`msgrcv(type ${k}): no type-${k} message is in the queue${st.q.length ? ` (it holds ${st.q.length} message${st.q.length === 1 ? '' : 's'} of other types)` : ''}. Under the classic rule the server is <b>not suspended</b>: the call fails and returns at once, and the server can go and do other work. (A real msgrcv does this only when given the IPC_NOWAIT flag.)`, 'bad');  // red narration: under the classic rule the call fails at once instead of waiting; real msgrcv does this only with the IPC_NOWAIT flag
              return draw();  // redraws and stops here
            }  // ends the no-match case
            const m = st.q.splice(i, 1)[0]; st.last = m; st.took++;  // removes that one message from the middle of the queue, records it as last received and counts it
            say(`msgrcv(type ${k}) takes the oldest type-${k} message, ${tag(m)}` + (i ? `, <b>skipping ${i} older message${i === 1 ? '' : 's'}</b> of other types, which stay in place.` : ', which happened to be at the front.') + admitPending(), 'ok');  // green narration: which message was taken and how many older messages of other types it skipped, plus a note if a blocked client got in
            draw();  // redraws the queue and the cards
          }  // ends recv
          // Drawing geometry: a wide row on large screens, a compact stacked layout on small screens.
          const G = ctx.narrow  // G: every position and size for the drawing; the first set is for small screens, the second for wide ones
            ? { mw: 58, mh: 50, q: [4, 82, 332, 70], qy: 117, title: [336, 74, 'end'], back: [6, 168], front: [334, 168], slot: (i) => 300 - i * 64,  // small-screen layout: message size, the queue box, the title, the back and front labels, and slot(i) giving each message's x position
              cl: [60, 30, 100, 40], clArrow: [60, 50, 60, 79], pend: [168, 30], sv: [280, 214, 100, 40], svArrow: [300, 152, 300, 191], last: [120, 206, 226] }  // small-screen layout: the client above the queue, the waiting message, the server below, the arrows, and the last-received text
            : { mw: 76, mh: 60, q: [102, 62, 420, 84], qy: 104, title: [312, 52, 'middle'], back: [110, 166], front: [514, 166], slot: (i) => 480 - i * 84,  // wide layout: bigger messages in one row, with slot 0 (the oldest) at the right
              cl: [46, 104, 84, 50], clArrow: [90, 104, 100, 104], pend: [46, 40], sv: [574, 104, 84, 50], svArrow: [524, 104, 530, 104], last: [574, 152, 172] };  // wide layout: client on the left, server on the right, arrows joining them to the queue, and the last-received text under the server
          svg.setAttribute('viewBox', ctx.narrow ? '0 0 340 240' : '0 4 620 180');  // picks the drawing area to match: taller and slimmer on a small screen, wide and short otherwise
          function msgBox(m, x, y, dashed) {  // msgBox(m, x, y, dashed): draws one message centred at (x, y); dashed is used for the client's message that is still waiting to get in
            const [name, cls] = TYPES[m.type];  // looks up the message type's name and colour class
            return s('g', {},  // returns the box and its two text lines as one group
              s('rect', { x: x - G.mw / 2, y: y - G.mh / 2, width: G.mw, height: G.mh, rx: 10, class: cls, 'stroke-width': 2, 'stroke-dasharray': dashed ? '5 4' : null }),  // the message's rounded box, in its type's colour, dashed if it is still waiting outside the queue
              s('text', { x, y: y - G.mh / 10, 'text-anchor': 'middle', 'font-size': ctx.narrow ? 14 : 15, 'font-weight': 800 }, 'type ' + m.type),  // top line: the type number
              s('text', { x, y: y + G.mh / 3.4, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, (ctx.narrow ? '' : name + ' ') + '#' + m.seq));  // bottom line: the type name and sequence number, such as "query #4" (just "#4" on a small screen)
          }  // ends msgBox
          function draw() {  // draw(): rebuilds the queue picture and the two process cards from st; runs after every action
            const kids = [];  // kids collects the SVG pieces for this drawing
            const [qx, qy, qw, qh] = G.q;  // qx, qy, qw, qh: the position and size of the queue box
            kids.push(s('rect', { x: qx, y: qy, width: qw, height: qh, rx: 14, class: 's-os', 'stroke-width': 2, 'fill-opacity': 0.55 }),  // the kernel's queue box, a slightly see-through rounded rectangle in the kernel colour
              s('text', { x: G.title[0], y: G.title[1], 'text-anchor': G.title[2], 'font-size': 14, 'font-weight': 700 }, `message queue (${st.q.length}/${CAP})`),  // title over the queue with its fill level, such as "message queue (3/5)"
              s('text', { x: G.back[0], y: G.back[1], 'font-size': 13, class: 's-sub' }, ctx.narrow ? '← back' : '← back (newest)'),  // label at the back end, where new messages join (shortened on a small screen)
              s('text', { x: G.front[0], y: G.front[1], 'text-anchor': 'end', 'font-size': 13, class: 's-sub' }, ctx.narrow ? 'front →' : 'front (oldest) →'));  // label at the front end, where the oldest message waits (shortened on a small screen)
            // Index 0 (the oldest message) sits next to the receiver.
            for (let i = 0; i < CAP; i++) {  // draws all 5 places in the queue
              if (st.q[i]) kids.push(msgBox(st.q[i], G.slot(i), G.qy));  // a filled place shows its message
              else kids.push(s('rect', { x: G.slot(i) - G.mw / 2, y: G.qy - G.mh / 2, width: G.mw, height: G.mh, rx: 10, class: 's-muted', 'stroke-dasharray': '4 4' }));  // an empty place is a faint dashed outline
            }  // ends the loop over places
            const arrow = (a) => s('line', { x1: a[0], y1: a[1], x2: a[2], y2: a[3], class: 's-line', 'marker-end': 'url(#arr)' });  // arrow(a): draws an arrow from (a[0], a[1]) to (a[2], a[3]) using the standard arrowhead
            kids.push(token(s, G.cl[0], G.cl[1], 'client', st.snd === 'blocked' ? 's-warn' : 's-proc', G.cl[2], G.cl[3], 15), arrow(G.clArrow));  // the client box (amber while blocked) and the arrow from it into the queue
            kids.push(token(s, G.sv[0], G.sv[1], 'server', st.rcv === 'blocked' ? 's-warn' : 's-proc', G.sv[2], G.sv[3], 15), arrow(G.svArrow));  // the server box (amber while blocked) and the arrow from the queue into it
            if (st.pend) kids.push(msgBox(st.pend, G.pend[0], G.pend[1], true));  // a blocked client's waiting message is drawn dashed beside it
            kids.push(s('text', { x: G.last[0], y: G.last[1], 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, 'last received'));  // caption: last received
            if (st.last) kids.push(s('text', { x: G.last[0], y: G.last[2], 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800, style: `fill:var(${TYPES[st.last.type][2]})` }, `type ${st.last.type} #${st.last.seq}`));  // under it, the last message the server received, in its type's colour
            else kids.push(s('text', { x: G.last[0], y: G.last[2], 'text-anchor': 'middle', 'font-size': 14, class: 's-sub' }, 'nothing yet'));  // or "nothing yet" before any message has been received
            svg.replaceChildren(...kids);  // swaps in the new picture
            const sStat = st.snd === 'blocked' ? 'Blocked in msgsnd: queue full' : 'Running';  // sStat: the client's status line, blocked or running
            const rStat = st.rcv === 'blocked' ? 'Blocked in msgrcv(any): queue empty' : `Running · received ${st.took}, failed ${st.fails}`;  // rStat: the server's status line, blocked, or running with counts of received and failed calls
            cards.replaceChildren(  // replaces both process cards with fresh ones
              h('div', { class: 'pcard' + (st.snd === 'blocked' ? ' blocked' : '') },  // the client card, amber while blocked
                h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'nm' }, 'Client (sender)'), h('span', { class: 'chip' }, 'msgsnd')),  // card header: Client (sender) and a tag naming its call, msgsnd
                h('div', { class: 'st' }, sStat),  // the client's status line
                h('div', { class: 'grid-2', style: { gap: '6px' } },  // a two-column grid of send buttons
                  ...[1, 2, 3].map((t) => h('button', { class: 'btn sm', type: 'button', disabled: st.snd !== 'run', onclick: () => send(t) }, `send type ${t}`)),  // one button per message type, disabled while the client is blocked
                  h('span', { class: 'xs muted', style: { alignSelf: 'center', textAlign: 'center' } }, '1 urgent · 2 query · 3 log'))),  // a small key in the fourth cell saying what the three type numbers mean
              h('div', { class: 'pcard' + (st.rcv === 'blocked' ? ' blocked' : '') },  // the server card, amber while blocked
                h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'nm' }, 'Server (receiver)'), h('span', { class: 'chip' }, 'msgrcv')),  // card header: Server (receiver) and a tag naming its call, msgrcv
                h('div', { class: 'st' }, rStat),  // the server's status line
                h('div', { class: 'grid-2', style: { gap: '6px' } },  // a two-column grid of receive buttons
                  h('button', { class: 'btn sm', type: 'button', disabled: st.rcv !== 'run', onclick: () => recv(0) }, 'receive any'),  // receive any: takes the oldest message whatever its type
                  ...[1, 2, 3].map((t) => h('button', { class: 'btn sm', type: 'button', disabled: st.rcv !== 'run', onclick: () => recv(t) }, `receive type ${t}`)))));  // one receive-by-type button per message type, all disabled while the server is blocked
          }  // ends draw
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: 'minmax(0, 5fr) minmax(0, 8fr)', gap: '20px' } },  // page layout: two columns, explanation on the left (5 parts) and the simulator on the right (8 parts)
            h('div', { class: 'stack', style: { gap: '8px' } },  // left column, stacked
              h('p', { class: 'm0 small', html: 'A <span class="t">message queue</span> works like a mailbox kept by the kernel. Each message is a block of bytes plus a <span class="t">message type</span>, a positive number the sender picks. The two calls are <span class="t">msgsnd</span> and <span class="t">msgrcv</span>.' }),  // intro: a message queue is a kernel mailbox of typed messages, used through msgsnd and msgrcv
              h('div', { class: 'card tight small', style: { lineHeight: 1.45 } }, h('b', {}, 'The rules'),  // a card titled The rules
                h('ol', { class: 'm0', style: { paddingLeft: '20px' } },  // a numbered list of the rules
                  h('li', { html: '<b>msgsnd</b> adds a message at the back. A <b>full</b> queue blocks the sender.' }),  // rule 1: msgsnd adds at the back and a full queue blocks the sender
                  h('li', { html: '<b>receive any</b> takes the oldest message. An <b>empty</b> queue blocks the receiver.' }),  // rule 2: receive any takes the oldest and an empty queue blocks the receiver
                  h('li', { html: '<b>receive type k</b> takes the oldest message of type k, skipping other types.' }),  // rule 3: receive type k takes the oldest message of that type
                  h('li', { html: 'Classic rule: if no type-k message is there, the receiver is <b>not suspended</b>; the call fails and returns.' }))),  // rule 4: with no message of that type, the classic receiver is not suspended; the call fails
              h('div', { class: 'callout tip small m0', 'data-label': 'Real systems', html: 'These are System V queues. Real msgrcv takes a flag: with <code>IPC_NOWAIT</code> a call that finds nothing fails at once, as in rule 4; without it the caller waits for a match. A negative type −k takes the lowest type ≤ k, a ready-made priority queue.' }),  // tip box: how real System V msgrcv behaves with and without IPC_NOWAIT, and negative types as a priority queue
              h('div', { class: 'card tight small' }, h('b', {}, 'Try these: '), 'send 2, 3, 2, 1, 3 to fill the queue, then send once more; receive type 1; receive type 1 twice more; empty the queue with receive any, then receive any once more.')),  // suggestion card: a sequence of sends and receives that shows blocking, type picking and the empty-queue case
            h('div', { class: 'stack', style: { gap: '9px' } },  // right column, stacked
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'small b' }, 'Client process → kernel queue → server process'), h('button', { class: 'btn sm', type: 'button', onclick: reset }, 'Reset')),  // header row: the flow from client through kernel queue to server, plus a Reset button
              h('div', { class: 'card white tight' }, svg), cards, narr)));  // the queue drawing in a white card, then the two process cards and the narration; closes the right column and the layout
          reset();  // starts with an empty queue as soon as the step is drawn
        },  // ends render for step 4
      },  // ends step 4

      /* ---------------- 5. Shared memory ---------------- */
      {  // step 5 starts here
        title: 'Shared memory: fastest, but you bring the lock',  // title of step 5
        kind: 'explore',  // kind explore: labelled Explore, a hands-on demonstration
        render(el, ctx) {  // render(el, ctx): builds the shared memory picture, its buttons and the two tabs when step 5 opens
          const { h, s } = ctx;  // takes the HTML builder h and the SVG builder s out of ctx
          let perm = 'rw', st;  // perm: how process B attached the block, rw (read-write) or ro (read-only); st will hold the demo state
          // Three columns: A's address space, physical memory, B's address space (slimmer on small screens).
          const CW = ctx.narrow ? 104 : 110, XA = ctx.narrow ? 2 : 4, XP = ctx.narrow ? 128 : 165, XB = ctx.narrow ? 254 : 326;  // CW is the width of each column; XA, XP and XB are the left edges of A's column, physical memory, and B's column
          const svg = s('svg', { viewBox: `0 0 ${XB + CW + 2} 196`, width: '100%' });  // the drawing area, just wide enough for the three columns and 196 units tall
          const narr = h('div', { class: 'narr', style: { minHeight: '84px' } });  // the narration box, tall enough for three lines so the layout does not jump
          const say = (html, tone) => sayInto(narr, html, tone);  // say(html, tone): shorthand that writes into this step's narration box
          const btnBox = h('div', { class: 'grid-3', style: { gap: '6px' } });  // a three-column grid that will hold the three action buttons
          function reset(msg) {  // reset(msg): puts the counter back to 7 and brings B back; runs when the step opens, on Reset, and when the permission changes
            st = { counter: 7, bDead: false, hot: null };  // st: counter is the shared value, bDead marks B as killed, hot names the process that acted last so its view is highlighted
            say(msg || `A and B have both attached the same block (B ${perm === 'ro' ? '<b>read-only</b>' : 'read-write'}). A sees it at address <b>0x30000</b>, B at <b>0x58000</b>: different addresses, the <b>same bytes</b>. Try the buttons.`);  // opening narration (unless a message was passed in): A and B see the block at different addresses but share the same bytes
            draw();  // redraws the picture
          }  // ends reset
          function block(x, y, w, addr, cls, hot) {  // block(x, y, w, addr, cls, hot): draws the shared block as one process sees it, with its address and the counter value
            return s('g', {},  // returns the box and its two lines of text as one group
              s('rect', { x, y, width: w, height: 38, rx: 6, class: cls, 'stroke-width': hot ? 3 : 2 }),  // the block's box, with a thicker edge if this process just acted
              s('text', { x: x + w / 2, y: y + 15, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, addr),  // the address where this process sees the block
              s('text', { x: x + w / 2, y: y + 32, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, class: 's-monot' }, 'counter = ' + st.counter));  // the counter value stored in the block
          }  // ends block
          // A plain region of an address space (code or data), drawn faintly for context.
          const region = (x, y, label) => s('g', {}, s('rect', { x, y, width: CW - 10, height: 26, rx: 5, class: 's-panel', 'stroke-width': 1 }),  // region(x, y, label): a faint box for an ordinary code or data region, there only to show the rest of an address space
            s('text', { x: x + (CW - 10) / 2, y: y + 18, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, label));  // the region's label, centred in it
          function draw() {  // draw(): rebuilds the picture and the buttons from st; runs after every action
            const ro = perm === 'ro', kids = [];  // ro is true when B attached read-only; kids collects the SVG pieces
            const col = (x, label, cls) => [s('text', { x: x + CW / 2, y: 15, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800 }, label),  // col(x, label, cls): a column heading and the tall box under it
              s('rect', { x, y: 22, width: CW, height: 168, rx: 10, class: cls, 'stroke-width': 2, 'fill-opacity': 0.45 })];  // the tall column box, slightly see-through
            kids.push(...col(XA, 'A\'s addresses', 's-proc'), ...col(XP, ctx.narrow ? 'physical' : 'physical memory', 's-panel'), ...col(XB, st.bDead ? 'B: terminated' : 'B\'s addresses', st.bDead ? 's-panel' : 's-proc'));  // the three columns: A's addresses, physical memory, and B's addresses (greyed and relabelled once B is terminated)
            for (let y = 48; y < 190; y += 28) kids.push(s('line', { x1: XP, y1: y, x2: XP + CW, y2: y, class: 's-muted', 'stroke-width': 1 }));  // faint lines dividing physical memory into equal frames
            kids.push(s('rect', { x: XP, y: 76, width: CW, height: 56, rx: 4, class: 's-mem', 'stroke-width': 2 }),  // the one shared block in physical memory, in the memory colour
              s('text', { x: XP + CW / 2, y: 98, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, 'at 0x7A000'),  // its physical address
              s('text', { x: XP + CW / 2, y: 120, 'text-anchor': 'middle', 'font-size': ctx.narrow ? 13 : 14, 'font-weight': 800, class: 's-monot' }, 'counter = ' + st.counter));  // the counter as it really is in physical memory
            kids.push(region(XA + 5, 30, 'code'), region(XA + 5, 60, 'data'), block(XA + 5, 128, CW - 10, '0x30000', 's-mem', st.hot === 'A'));  // A's address space: code, data, and the shared block mapped at 0x30000
            if (!st.bDead) kids.push(block(XB + 5, 48, CW - 10, '0x58000', 's-mem', st.hot === 'B'), region(XB + 5, 126, 'code'), region(XB + 5, 156, 'data'));  // B's address space while B is alive: the same block mapped at 0x58000, near the top this time, then code and data
            kids.push(s('line', { x1: XA + CW - 5, y1: 147, x2: XP - 3, y2: 112, class: 's-line', 'marker-end': 'url(#arr)' }),  // arrow from A's view of the block to the physical block
              s('text', { x: (XA + CW + XP) / 2, y: 154, 'text-anchor': 'middle', 'font-size': 13, style: 'fill:var(--ok)', 'font-weight': 700 }, 'rw'));  // A's permission label on its arrow: rw, in green
            if (!st.bDead) kids.push(s('line', { x1: XB + 5, y1: 67, x2: XP + CW + 3, y2: 96, class: 's-line', 'stroke-dasharray': ro ? '5 4' : null, 'marker-end': 'url(#arr)' }),  // B's arrow to the physical block, dashed when B attached read-only
              s('text', { x: (XP + CW + XB) / 2, y: 64, 'text-anchor': 'middle', 'font-size': 13, style: `fill:var(${ro ? '--warn' : '--ok'})`, 'font-weight': 700 }, ro ? 'ro' : 'rw'));  // B's permission label: ro in amber or rw in green
            svg.replaceChildren(...kids);  // swaps in the new picture
            btnBox.replaceChildren(  // rebuilds the three action buttons
              h('button', { class: 'btn sm proc', type: 'button', onclick: () => act('Aw') }, 'A: counter + 1'),  // A: counter + 1, A stores a new value
              h('button', { class: 'btn sm proc', type: 'button', disabled: st.bDead, onclick: () => act('Br') }, 'B: read counter'),  // B: read counter, disabled once B is terminated
              h('button', { class: 'btn sm proc', type: 'button', disabled: st.bDead, onclick: () => act('Bw') }, 'B: counter + 1'));  // B: counter + 1, disabled once B is terminated
          }  // ends draw
          function act(a) {  // act(a): runs when an action button is clicked; Aw is A writing, Br is B reading, Bw is B writing
            st.hot = a[0];  // hot becomes A or B, the first letter of the action, so that process's view is highlighted
            if (a === 'Aw') { st.counter++; say(`A runs an ordinary store instruction: counter becomes <b>${st.counter}</b>. No system call and no copying. B will see ${st.counter} the instant it looks.`, 'ok'); }  // A adds 1 with an ordinary store; the narration stresses that no system call or copying happened
            else if (a === 'Br') say(`B reads the counter with an ordinary load and gets <b>${st.counter}</b>, the latest value stored. Nothing was sent: both processes simply look at the same bytes.`, 'ok');  // B reads with an ordinary load and sees the latest value, because nothing had to be sent
            else if (perm === 'rw') { st.counter++; say(`B stores <b>${st.counter}</b>. A sees the new value at once, too.`, 'ok'); }  // if B is read-write, it adds 1 too, and A sees the change at once
            else { st.bDead = true; st.hot = null; say('B attached the block <b>read-only</b>, so the memory hardware refuses the store and traps to the kernel. The kernel sends B the signal <b>SIGSEGV</b> (segmentation violation), whose default action terminates B. Press Reset.', 'bad'); }  // if B is read-only, the hardware refuses the store and the kernel kills B with SIGSEGV; red narration
            draw();  // redraws the picture and buttons
          }  // ends act
          const permSeg = ctx.ui.seg([{ value: 'rw', label: 'read-write' }, { value: 'ro', label: 'read-only' }], perm, (v) => {  // permSeg: a switch for how B attached the block, read-write or read-only
            perm = v;  // remembers the chosen permission
            reset(v === 'ro' ? 'B has attached the block <b>read-only</b>. Each process picks read-only or read-write when it attaches (System V <code>shmat</code>), as far as the permission bits set when the block was created allow. B may read the counter but not change it. Try both.' : 'B has attached the block <b>read-write</b>, like A.');  // starts over with a narration explaining the choice and that each process picks its permission when it attaches
          });  // ends the switch's change handler
          // Tab 1: the shared counter race, with and without a semaphore around the update.
          function raceTab(p) {  // raceTab(p): fills the first tab's panel p with the lost-update race between A and B
            let mode = 'none';  // mode: none (no lock) or lock (a semaphore around the update)
            const PLANS = { none: ['A', 'B', 'A', 'A', 'B', 'B'], lock: ['A', 'B', 'A', 'A', 'A', 'A', 'B', 'B', 'B', 'B'] };  // PLANS: which process takes each machine step; without the lock both load 7 before either stores, with it B is made to wait
            const START = 7;  // START: the counter's starting value
            let run = raceRows(false, PLANS.none, START);  // run: the simulated rows and final value, starting in no-lock mode
            const tbody = h('tbody');  // the table body that will hold one row per step
            const head = h('thead');  // the table header, rebuilt so the lock column appears only in lock mode
            const OPN = { load: 'load', add: 'add 1', store: 'store', lock: 'semop(−1)', unlock: 'semop(+1)' };  // OPN: how each instruction is written in the step column
            function render(i) {  // render(i): the player calls this for frame i; it fills the table up to step i and returns the caption
              const lock = mode === 'lock';  // lock is true when the semaphore version is showing
              head.replaceChildren(h('tr', {}, h('th', {}, '#'), h('th', {}, 'step'), h('th', {}, 'counter'), h('th', {}, 'A reg'), h('th', {}, 'B reg'), lock ? h('th', {}, 'lock') : null));  // header row: step number, step, counter, each register, and the lock value when there is a lock
              const rows = [h('tr', { class: i === 0 ? 'on' : '' }, h('td', {}, '0'), h('td', {}, 'start'), h('td', { class: 'b mono' }, String(START)), h('td', { class: 'mono' }, '—'), h('td', { class: 'mono' }, '—'), lock ? h('td', { class: 'mono' }, '1') : null)];  // row 0: the starting state (counter 7, empty registers, lock 1), highlighted on the first frame
              // Rows not reached yet show only who acts next, so the student can predict the values.
              run.rows.forEach((r, k) => {  // adds one row per simulated step
                const done = k < i, v = (x) => (done ? x : '');  // done: whether this step has been played yet; v shows a value only for played rows
                rows.push(h('tr', { class: k === i - 1 ? 'on' : '', style: { opacity: done ? null : 0.5 } },  // the row is highlighted if it is the step just played, and faded if it is still to come
                  h('td', {}, String(k + 1)),  // step number
                  h('td', { class: 'mono', style: { color: r.n === 'A' ? 'var(--proc)' : 'var(--thread)', fontWeight: 700 } }, `${r.n}: ${OPN[r.op]}`),  // who acts and what they do, A in the process colour and B in a second colour
                  h('td', { class: 'b mono' }, v(String(r.mem))),  // the shared counter after this step
                  h('td', { class: 'mono' }, v(r.waitA ? 'waiting' : r.regA == null ? '—' : String(r.regA))),  // A's register: its value, a dash before it loads, or waiting while A is suspended
                  h('td', { class: 'mono' }, v(r.waitB ? 'waiting' : r.regB == null ? '—' : String(r.regB))),  // B's register, shown the same way
                  lock ? h('td', { class: 'mono' }, v(String(r.sem))) : null));  // the lock semaphore's value, only in lock mode
              });  // ends the loop over rows
              tbody.replaceChildren(...rows);  // puts the rows into the table
              if (i === 0) return lock ? 'A System V semaphore with value 1 now guards the update: semop(−1) before, semop(+1) after. Same unlucky timing as before. Press Next.' : `The counter starts at ${START}. A and B each run <code>counter = counter + 1</code>: load, add, store. Nothing stops them from overlapping. Press Next.`;  // first frame caption: with the lock it explains the guard; without it, the start value and the three-instruction update
              const r = run.rows[i - 1];  // r is the step just played
              if (i < run.rows.length) return r.say;  // for every frame but the last, the caption is that step's sentence
              const ok = run.final === START + 2;  // ok: whether the final value is two more than the start
              return r.say + (ok ? ` <b style="color:var(--ok)">Final value ${run.final}: both increments counted.</b>` : ` <b style="color:var(--bad)">Final value ${run.final}, but two increments should give ${START + 2}: one update was lost.</b>`);  // last frame: the sentence plus a green "both increments counted" or a red "one update was lost"
            }  // ends render for the race table
            const player = ctx.ui.player({ count: run.rows.length + 1, render, interval: 1900, speed: false });  // player: one frame for the start plus one per step, 1.9 seconds each when playing, without a speed switch
            const seg = ctx.ui.seg([{ value: 'none', label: 'No lock' }, { value: 'lock', label: 'Semaphore around the update' }], mode, (v) => {  // seg: a switch between No lock and Semaphore around the update
              mode = v; run = raceRows(v === 'lock', PLANS[v], START); player.stop(); player.setCount(run.rows.length + 1);  // on a switch: re-runs the simulation in that mode, stops playback and resizes the player, which returns to the first frame
            });  // ends the switch's change handler
            p.append(h('div', { class: 'stack', style: { gap: '8px' } }, seg, h('table', { class: 'tbl compact race' }, head, tbody), player.el));  // fills the race tab: the mode switch, the step table and the player, stacked
            return () => player.stop();  // gives the tabs widget a tidy-up function that stops playback when the student switches to the other tab
          }  // ends raceTab
          // Tab 2: what a pipe costs compared with shared memory for the same amount of data.
          function speedTab(p) {  // speedTab(p): fills the second tab's panel p with a comparison of the copying a pipe needs and the copying shared memory needs
            const out = h('div', { class: 'grid-2', style: { gap: '10px' } });  // out: a two-column grid holding the pipe card and the shared memory card
            const PIPE_KIB = 64;  // PIPE_KIB: a Linux pipe holds 64 KiB by default, so one read can collect at most that much
            const upd = (mb) => {  // upd(mb): rebuilds both cards for mb mebibytes of data; runs whenever the slider moves
              const reads = Math.ceil(mb * 1024 / PIPE_KIB);  // reads: the fewest read calls needed, the data size divided into pipe-fulls and rounded up
              out.replaceChildren(  // replaces both cards with fresh ones
                h('div', { class: 'card io tight stack', style: { gap: '4px' } }, h('b', {}, 'Through a pipe'),  // pipe card, in the I/O colour, titled Through a pipe
                  h('div', { class: 'big' }, `${2 * mb} MiB`), h('div', { class: 'small' }, `copied by the kernel: ${mb} MiB into the pipe, then ${mb} MiB out to the reader`),  // the pipe moves twice the data: once in from the writer and once out to the reader
                  h('div', { class: 'small b' }, `≥ ${reads.toLocaleString('en-US')} read() calls`), h('div', { class: 'xs muted' }, `each read collects at most one pipe-full (${PIPE_KIB} KiB by default on Linux)`)),  // the minimum number of read calls, with thousands separators, and a note on why each read is limited to one pipe-full
                h('div', { class: 'card mem tight stack', style: { gap: '4px' } }, h('b', {}, 'In shared memory'),  // shared memory card, in the memory colour, titled In shared memory
                  h('div', { class: 'big' }, '0 MiB'), h('div', { class: 'small' }, 'copied: the reader looks at the very bytes the writer stored'),  // shared memory copies nothing: the reader looks at the very bytes the writer stored
                  h('div', { class: 'small b' }, '0 system calls'), h('div', { class: 'xs muted' }, 'after a one-time setup to create and attach the block')));  // no system calls per access, only a one-time setup to create and attach the block
            };  // ends upd
            const sl = ctx.ui.slider({ label: 'Data to share', min: 1, max: 512, value: 100, format: (v) => v + ' MiB', onInput: upd });  // sl: a slider for the amount of data, 1 to 512 MiB, starting at 100; moving it calls upd
            p.append(h('div', { class: 'stack', style: { gap: '10px' } }, sl, out,  // fills the speed tab: the slider, the two cards, and a note, stacked
              h('div', { class: 'callout why small m0', 'data-label': 'Why it is fastest', html: 'Setup takes a few system calls once (System V: <code>shmget</code> creates or finds the block, <code>shmat</code> attaches it). After that every access is a plain memory instruction. POSIX <code>shm_open</code> plus <code>mmap</code> is the modern way to get the same effect.' })));  // note box: setup takes a few system calls once, then every access is a plain memory instruction; names the System V and POSIX calls
            upd(100);  // fills the cards for the starting value of 100 MiB
          }  // ends speedTab
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: 'minmax(0, 5fr) minmax(0, 6fr)', gap: '20px' } },  // page layout: two columns, the shared memory picture on the left (5 parts) and the tabs on the right (6 parts)
            h('div', { class: 'stack', style: { gap: '8px' } },  // left column, stacked
              h('p', { class: 'm0 small', html: 'With <span class="t">shared memory</span> the kernel maps one block of physical memory into several address spaces. From then on the processes use ordinary load and store instructions, and each process has <b>read-only</b> or <b>read-write</b> permission.' }),  // intro: the kernel maps one physical block into several address spaces, each with read-only or read-write permission
              h('div', { class: 'card white tight' }, svg),  // the three-column memory picture in a white card
              h('div', { class: 'row', style: { gap: '10px' } }, h('span', { class: 'small b' }, 'B attached it'), permSeg, h('button', { class: 'btn sm', type: 'button', onclick: () => reset() }, 'Reset')),  // control row: how B attached the block, the permission switch and a Reset button
              btnBox, narr),  // the three action buttons and the narration box
            h('div', { class: 'stack fill' }, ctx.ui.tabs([  // right column: a tabs widget filling the height
              { label: 'No built-in lock', render: raceTab },  // tab 1: the lost-update race, showing that shared memory has no built-in lock
              { label: 'Why it is fastest', render: speedTab },  // tab 2: why shared memory is the fastest mechanism
            ]))));  // closes the tab list, the right column and the layout
          reset();  // starts the demo with counter 7 as soon as the step is drawn
        },  // ends render for step 5
      },  // ends step 5

      /* ---------------- 6. System V semaphores: fields and the four rules ---------------- */
      {  // step 6 starts here
        title: 'UNIX semaphores: four fields, four rules',  // title of step 6
        kind: 'learn',  // kind learn: labelled Learn, an explanation with a calculator
        render(el, ctx) {  // render(el, ctx): builds the semop calculator when step 6 opens
          const { h, s } = ctx;  // takes the HTML builder h and the SVG builder s out of ctx
          const PID = 4242, NCNT = 2;  // PID: the process id of the caller in the calculator; NCNT: how many other processes already wait for the value to rise
          let v = 2, op = -1;  // v: the semaphore's current value; op: the sem_op the caller asks for (both set by sliders)
          // A process can only be waiting for zero while the value is above zero (at zero it would have been woken).
          const zc0 = () => (v > 0 ? 1 : 0);  // zc0(): how many processes wait for zero before the call: one while the value is above zero, none when it is zero
          const VW = ctx.narrow ? 340 : 520;  // VW: width of the units drawing, smaller on a small screen
          const svg = s('svg', { viewBox: `0 0 ${VW} 58`, width: '100%' });  // the drawing area for the units of the value, one short row of circles
          const unitsCap = h('div', { class: 'xs muted', style: { padding: '0 6px 4px' } });  // unitsCap: a small caption under the circles explaining what they show
          const rulesEl = h('div', { class: 'stack', style: { gap: '5px' } });  // rulesEl: the stack of four rule cards; the one that applies is highlighted
          const result = h('div', { class: 'narr', style: { minHeight: '104px' } });  // result: the narration box showing the fields before and after and what happened
          const RULES = [  // RULES: the four semop rules, each a condition on sem_op and what the kernel then does
            ['sem_op > 0', 'Add it to the value. Wake <b>every</b> process waiting for the value to increase (each re-checks its own request).'],  // rule 1: a positive sem_op is added and every process waiting for an increase is woken to re-check
            ['sem_op = 0', 'If the value is 0, continue at once. Otherwise <b>suspend</b> the caller until the value becomes 0.'],  // rule 2: sem_op 0 continues if the value is 0, otherwise suspends the caller until it is
            ['sem_op < 0, |sem_op| ≤ value', 'Add it (the value drops). If the value reaches 0, wake every process waiting for zero.'],  // rule 3: a negative sem_op that fits is subtracted, and reaching 0 wakes the zero-waiters
            ['sem_op < 0, |sem_op| > value', '<b>Suspend</b> the caller until the value increases enough: it re-checks at every rise and goes on once |sem_op| ≤ value. Nothing changes now.'],  // rule 4: a negative sem_op larger than the value suspends the caller and changes nothing now
          ];  // closes the RULES list
          // Which rule applies and what it does; every number shown is computed here.
          function outcome() {  // outcome(): works out which rule applies and its effects: r is the rule, nv the new value, go whether the caller continues, n and z how many more wait
            if (op > 0) return { r: 0, nv: v + op, go: true, n: 0, z: 0, wakeN: true, wakeZ: false };  // positive sem_op: rule 1, the value rises, the caller continues, and the increase-waiters are woken
            if (op === 0) return v === 0 ? { r: 1, nv: v, go: true, n: 0, z: 0 } : { r: 1, nv: v, go: false, n: 0, z: 1 };  // sem_op 0: rule 2, the caller continues if the value is 0, otherwise it joins the zero-waiters
            if (-op <= v) return { r: 2, nv: v + op, go: true, n: 0, z: 0, wakeZ: v + op === 0 };  // negative sem_op that fits: rule 3, the value drops, the caller continues, and zero-waiters wake if it reaches 0
            return { r: 3, nv: v, go: false, n: 1, z: 0 };  // otherwise rule 4: nothing changes and the caller joins the increase-waiters
          }  // ends outcome
          const note = h('p', { class: 'small muted m0' });  // note: a small grey paragraph describing the processes in the calculator's scenario
          const NOWAIT = ' (Had it passed the IPC_NOWAIT flag, the call would fail at once instead of waiting.)';  // NOWAIT: an extra sentence, added whenever the caller is suspended, about the IPC_NOWAIT flag
          function draw() {  // draw(): updates the note, the rule cards, the circles and the result; runs whenever a slider moves
            const o = outcome();  // o: the outcome for the current value and sem_op
            note.textContent = `In the calculator, the caller is process ${PID} and the last process to operate on the semaphore was 3001. Two other processes already wait for the value to rise` + (zc0() ? ' and one waits for it to reach 0.' : '. (Nobody waits for zero while the value is 0.)');  // the scenario note: the caller's pid, the last pid 3001, the two increase-waiters, and whether one process waits for zero
            rulesEl.replaceChildren(...RULES.map(([c, d], i) => h('div', { class: 'card tight small', style: { padding: '6px 10px', borderColor: i === o.r ? 'var(--accent)' : null, background: i === o.r ? 'var(--accent-bg)' : null, borderWidth: i === o.r ? '2px' : null } },  // rebuilds the four rule cards, giving the applicable one an accent border and background
              h('b', { class: 'mono' }, c), ' → ', h('span', { html: d }))));  // each card shows the condition in fixed-width type, an arrow, and what the kernel does
            // Units of the value as circles: kept (green), removed (red), added (blue outline), missing (dashed red).
            const kids = [], n = Math.max(v, v + Math.max(op, 0), -op, 1), W = Math.min(56, (VW - 20) / n);  // n: how many circles to draw (enough for the value before or after, or the units asked for); W: the space for each circle
            for (let k = 0; k < n; k++) {  // one position per circle
              const x = 14 + W / 2 + k * W, has = k < v;  // x: this circle's centre; has: whether this unit exists in the value right now
              let cls = 's-muted', dash = null, mark = '';  // defaults: a grey circle with no dash and no mark
              if (has && op < 0 && -op <= v && k >= v + op) { cls = 's-bad'; mark = '−'; }  // a unit that is taken away by an allowed negative sem_op: red with a minus sign
              else if (has) cls = 's-ok';  // a unit that stays: green
              else if (op > 0 && k < v + op) { cls = 's-accent'; mark = '+'; }  // a unit added by a positive sem_op: blue with a plus sign
              else if (op < 0 && -op > v && k < -op) { cls = 's-bad'; dash = '4 3'; mark = '?'; }  // a unit asked for but not there: dashed red with a question mark
              else continue;  // anything else is not drawn
              kids.push(s('circle', { cx: x, cy: 30, r: Math.min(20, W / 2 - 4), class: cls, 'stroke-width': 2, 'stroke-dasharray': dash }));  // draws the circle, sized to fit its space
              if (mark) kids.push(s('text', { x, y: 36, 'text-anchor': 'middle', 'font-size': 17, 'font-weight': 900 }, mark));  // draws its mark, if it has one
            }  // ends the loop over circles
            unitsCap.textContent = (op < 0 && -op > v ? `the caller needs ${-op} unit${op === -1 ? '' : 's'}, but only ${v} ${v === 1 ? 'is' : 'are'} there (dashed = missing)` : op < 0 ? `${-op} unit${op === -1 ? '' : 's'} removed (red)` : op > 0 ? `${op} unit${op === 1 ? '' : 's'} added (blue)` : 'sem_op = 0 changes nothing: it only tests for zero');  // caption under the circles: units missing, removed, or added, or that sem_op 0 only tests for zero
            svg.replaceChildren(...kids);  // swaps in the new circles
            const ZC = zc0();  // ZC: the number of zero-waiters before the call
            const fields = (val, pid, nc, zc) => `<span class="mono">semval ${val} · sempid ${pid} · semncnt ${nc} · semzcnt ${zc}</span>`;  // fields(val, pid, nc, zc): writes the four bookkeeping fields, semval, sempid, semncnt and semzcnt, as one fixed-width line
            let txt = `<b>Before:</b> ${fields(v, 3001, NCNT, ZC)}<br><b>After:</b> ${fields(o.nv, o.go ? PID : 3001, o.wakeN ? '(re-check)' : NCNT + o.n, o.wakeZ ? 0 : ZC + o.z)}<br>`;  // the before and after lines: sempid becomes the caller only if it proceeds, and the waiting counts change as the outcome says
            if (o.r === 0) txt += `The value goes ${v} → <b>${o.nv}</b> and process ${PID} continues. The ${NCNT} processes waiting for an increase are woken; each re-checks its own request and either proceeds or waits again.`;  // rule 1 sentence: the value rises, the caller continues, and the increase-waiters each re-check their own request
            else if (o.r === 1 && o.go) txt += `The value is already 0, so process ${PID} continues at once.`;  // rule 2 sentence when the value is already 0: the caller continues at once
            else if (o.r === 1) txt += `The value is ${v}, not 0, so process ${PID} is <b>suspended</b> and semzcnt rises to ${ZC + 1}.` + NOWAIT;  // rule 2 sentence otherwise: the caller is suspended and semzcnt rises
            else if (o.r === 2) txt += `The value goes ${v} → <b>${o.nv}</b> and process ${PID} continues.` + (o.wakeZ ? ` It reached 0, so the ${ZC} process waiting for zero is woken and continues too.` : '');  // rule 3 sentence: the value drops and the caller continues, and if it reached 0 the zero-waiter wakes too
            else txt += `Taking ${-op} would make the value negative, which System V never allows. Process ${PID} is <b>suspended</b> and semncnt rises to ${NCNT + 1}.` + NOWAIT;  // rule 4 sentence: the value can never go negative, so the caller is suspended and semncnt rises
            result.className = 'narr ' + (o.go ? 'ok' : 'bad');  // the result box turns green if the caller continues and red if it is suspended
            result.innerHTML = txt + (op === -1 ? ' <i>(sem_op = −1 is semWait.)</i>' : op === 1 ? ' <i>(sem_op = +1 is semSignal.)</i>' : '');  // shows the sentence, adding that -1 is the familiar semWait and +1 is semSignal
          }  // ends draw
          const vSl = ctx.ui.slider({ label: 'Current value', min: 0, max: 4, value: v, onInput: (x) => { v = x; draw(); } });  // vSl: a slider for the current value, 0 to 4; moving it redraws
          const oSl = ctx.ui.slider({ label: 'sem_op', min: -4, max: 3, value: op, format: (x) => (x > 0 ? '+' + x : String(x)), onInput: (x) => { op = x; draw(); } });  // oSl: a slider for sem_op, -4 to +3, shown with a plus sign when positive; moving it redraws
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: 'minmax(0, 5fr) minmax(0, 7fr)', gap: '20px' } },  // page layout: two columns, the four fields and explanations on the left (5 parts), the calculator and rule cards on the right (7 parts)
            h('div', { class: 'stack', style: { gap: '8px' } },  // left column, stacked
              h('p', { class: 'm0 small', html: 'UNIX semaphores (the System V kind) generalize semWait and semSignal. They come in a <span class="t">semaphore set</span>, created together under one identifier, and each member keeps four fields:' }),  // intro: System V semaphores generalize semWait and semSignal, come in sets, and each member keeps four fields
              h('table', { class: 'tbl compact' }, h('tbody', {},  // a compact table of the four fields
                h('tr', {}, h('td', { class: 'mono b' }, 'semval'), h('td', {}, 'the current value, never below 0')),  // field row: semval, the value, which never goes below 0
                h('tr', {}, h('td', { class: 'mono b' }, 'sempid'), h('td', {}, 'process ID of the last process to operate on it')),  // field row: sempid, the last process to operate on the semaphore
                h('tr', {}, h('td', { class: 'mono b' }, 'semncnt'), h('td', {}, 'how many wait for the value to rise above its current value')),  // field row: semncnt, how many processes wait for the value to rise
                h('tr', {}, h('td', { class: 'mono b' }, 'semzcnt'), h('td', {}, 'how many wait for the value to become 0')))),  // field row: semzcnt, how many processes wait for the value to become 0
              h('div', { class: 'card tight small', html: '<b><span class="t">semctl</span></b> sets one value, or all values in the set at once, reads the fields, or removes the set. <b><span class="t">semop</span></b> takes a <b>list</b> of operations, each naming a semaphore and a number <code>sem_op</code>, and the kernel performs the whole list atomically.' }),  // card: what semctl does, and that semop takes a whole list of operations and performs it atomically
              h('div', { class: 'callout warn small m0', 'data-label': 'Different from semWait and semSignal', html: 'In the semaphores you met earlier, semWait could push the value below zero and its size counted the waiters. A System V value never goes below zero: the waiters are counted in semncnt instead. Also, sem_op may be bigger than 1.' }),  // warning box: unlike the earlier semaphores, the value never goes negative, waiters are counted in semncnt, and sem_op can exceed 1
              note),  // the scenario note under the warning; closes the left column
            h('div', { class: 'stack', style: { gap: '8px' } },  // right column, stacked
              h('div', { class: 'grid-2', style: { gap: '14px' } }, vSl, oSl),  // the two sliders side by side: current value and sem_op
              h('div', { class: 'card white tight', style: { padding: '2px 8px' } }, svg, unitsCap),  // the circles drawing and its caption in a white card
              rulesEl, result)));  // the four rule cards and the result box; closes the right column and the layout
          draw();  // fills everything for the starting value 2 and sem_op -1 as soon as the step is drawn
        },  // ends render for step 6
      },  // ends step 6

      /* ---------------- 7. semop lab: all or nothing ---------------- */
      {  // step 7 starts here
        title: 'Lab: one semop call, all or nothing',  // title of step 7
        kind: 'lab',  // kind lab: labelled Hands-on Lab
        core: true,  // core: true keeps this step on the shorter core path through the guide
        render(el, ctx) {  // render(el, ctx): builds the semaphore-set lab when step 7 opens
          const { h } = ctx;  // takes the HTML builder h out of ctx
          const SEMS = ['scanner', 'printers', 'jobs'], INIT = [1, 2, 0], MAX = 9;  // SEMS: the names of the three semaphores in the set; INIT: their starting values; MAX: the highest value this simulation allows
          const PROCS = [['P1', 301], ['P2', 302], ['P3', 303]];  // PROCS: the three processes the student can call semop as, each with its name and pid
          const PRESETS = [  // PRESETS: ready-made operation lists, each a name and a list of [semaphore number, sem_op] pairs
            ['copy start', [[0, -1], [1, -1], [2, 1]]],  // preset copy start: take the scanner and a printer and add a running job, all in one call
            ['copy end', [[0, 1], [1, 1], [2, -1]]],  // preset copy end: give back the scanner and the printer and remove the job
            ['print start', [[1, -1], [2, 1]]],  // preset print start: take a printer and add a job
            ['print end', [[1, 1], [2, -1]]],  // preset print end: give back the printer and remove the job
            ['wait for 0 jobs', [[2, 0]]],  // preset wait for 0 jobs: a single wait-for-zero on jobs
          ];  // closes PRESETS
          let set, waiting, clock, who = 'P1', last = {};  // set: the semaphore set; waiting: the suspended calls; clock: the arrival counter; who: the process now chosen; last: each process's last result
          const pick = ['x', 'x', 'x']; // the builder: 'x' = not in the list, otherwise sem_op
          const fmt = (d) => (d > 0 ? '+' + d : d === 0 ? '0' : '−' + -d);  // fmt(d): writes a sem_op with its sign, such as +1, 0 or −2
          const listTxt = (ops) => '[' + ops.map(([i, d]) => `${SEMS[i]} ${fmt(d)}`).join(', ') + ']';  // listTxt(ops): writes a whole operation list for the narration and log, such as [scanner −1, printers −1, jobs +1]
          const pidOf = (n) => PROCS.find((p) => p[0] === n)[1];  // pidOf(n): looks up the pid of the process named n
          const tbody = h('tbody');  // the table body that will show the set's four fields per semaphore
          const cards = h('div', { class: 'grid-3', style: { gap: '8px' } });  // a three-column grid that will hold the three process cards
          const narr = h('div', { class: 'narr', style: { minHeight: '104px' } });  // the narration box, tall enough for four lines
          const log = h('div', { class: 'log grow', style: { minHeight: '64px' } });  // log: a running list of every call and its result, newest on top, filling the leftover height
          const say = (html, tone) => sayInto(narr, html, tone);  // say(html, tone): shorthand that writes into this step's narration box
          const segs = SEMS.map((name, i) => ctx.ui.seg(['x', -2, -1, 0, 1, 2].map((d) => ({ value: d, label: d === 'x' ? '—' : fmt(d) })), 'x', (v) => { pick[i] = v; paint(); }));  // segs: one switch per semaphore to build the list: a dash leaves it out, otherwise pick −2 to +2; each change repaints
          const submit = h('button', { class: 'btn primary sm', type: 'button', onclick: () => call() });  // submit: the button that makes the chosen process call semop with the built list; its label is filled in by paint
          const whoSeg = ctx.ui.seg(PROCS.map(([n, p]) => ({ value: n, label: `${n} · ${p}` })), who, (v) => { who = v; paint(); });  // whoSeg: a switch choosing which process makes the call, labelled with name and pid; a change repaints
          function reset() {  // reset(): restores the starting values and clears all waiting calls; runs when the step opens and on Reset
            set = { vals: INIT.slice(), pids: [null, null, null] }; waiting = []; clock = 0; last = {};  // a fresh set with the starting values and no sempid yet, an empty waiting list, the clock at 0 and no last results
            log.innerHTML = '';  // empties the log
            logInto(ctx, log, `semctl(SETALL, ${INIT.join(', ')})`);  // first log line: the semctl call that set all three starting values at once
            say(`<span class="t">semctl</span> has given the set its starting values in one call: <b>scanner ${INIT[0]}</b> (one scanner), <b>printers ${INIT[1]}</b> (two printers) and <b>jobs ${INIT[2]}</b> (jobs running). Pick a process, build a list (or use a preset), and submit it.`);  // opening narration: what the starting values mean (one scanner, two printers, no jobs) and what to do next
            paint();  // redraws the table, cards and controls
          }  // ends reset
          function setPicks(ops) { SEMS.forEach((_, i) => { const o = ops.find((x) => x[0] === i); pick[i] = o ? o[1] : 'x'; segs[i].set(pick[i]); }); paint(); }  // setPicks(ops): copies a preset list into the three switches, leaving out semaphores the preset does not name, then repaints
          // semncnt / semzcnt: each suspended call counts once, on the operation it is stuck on.
          const counts = (i, why) => waiting.filter((w) => w.i === i && w.why === why).length;  // counts(i, why): how many suspended calls are stuck on semaphore i for reason why ('n' for semncnt, 'z' for semzcnt)
          function call() {  // call(): runs when Submit is clicked; the chosen process calls semop with the built list
            const ops = pick.map((d, i) => [i, d]).filter(([, d]) => d !== 'x');  // ops: the built list as [semaphore number, sem_op] pairs, leaving out the semaphores set to a dash
            if (!ops.length || waiting.some((w) => w.name === who)) return;  // does nothing for an empty list, or if the chosen process is already suspended
            const pid = pidOf(who), before = set.vals.slice();  // pid: the caller's pid; before: a copy of the values, to describe the changes afterwards
            const over = ops.find(([i, d]) => set.vals[i] + d > MAX);  // over: the first operation that would push a value above MAX, if any
            if (over) { last[who] = 'last call: failed'; say(`semop fails: ${SEMS[over[0]]} would go above ${MAX}, this simulation's limit (Linux allows values up to 32,767). <b>Nothing changes.</b> Like a wait, an error applies none of the list.`, 'bad'); logInto(ctx, log, `${who} ${listTxt(ops)} → error`); return paint(); }  // such a call fails as an error: nothing changes, the narration and log say so, and the screen repaints
            const b = semopBlocker(set.vals, ops);  // b: the first operation that cannot proceed now, or null if the whole list can
            if (b) {  // some operation must wait
              waiting.push({ name: who, pid, ops, t: clock++, i: b.i, why: b.why });  // the caller joins the waiting list with its list, arrival time, and the semaphore and reason it is stuck on
              last[who] = '';  // clears the caller's last-result line, since it is now waiting
              const free = ops.filter(([i, d]) => i !== b.i && d < 0 && -d <= set.vals[i]).map(([i]) => SEMS[i]);  // free: the other semaphores this list would take from that are available now, yet are left untouched
              say(`<b>${who}</b> calls semop with ${listTxt(ops)}. ` + (b.why === 'z' ? `${SEMS[b.i]} is ${set.vals[b.i]}, not 0, so the call must wait for zero.` : `${SEMS[b.i]} is ${set.vals[b.i]} and cannot drop by ${-ops.find((o) => o[0] === b.i)[1]}.`) +  // red narration: which operation blocks and why (not zero, or too small to take from)
                ` The <b>whole list</b> waits, so <b>none</b> of it is done${free.length ? ` (${free.join(' and ')} ${free.length > 1 ? 'are' : 'is'} not touched, even though ${free.length > 1 ? 'they' : 'it'} could be)` : ''}. ${who} is suspended; ${b.why === 'z' ? 'semzcnt' : 'semncnt'} of ${SEMS[b.i]} is now ${counts(b.i, b.why)}.`, 'bad');  // continues: the whole list waits so none of it is done, names any untouched semaphores, and gives the new waiting count
              logInto(ctx, log, `${who} ${listTxt(ops)} → suspended on ${SEMS[b.i]}`);  // log line: the call and which semaphore it is suspended on
              return paint();  // repaints and stops here
            }  // ends the waiting case
            semopApply(set, ops, pid);  // every operation can proceed, so the whole list is applied at once and the caller becomes the sempid of each
            last[who] = 'last call: done';  // records the caller's last result as done
            const changes = ops.map(([i]) => `${SEMS[i]} ${before[i]}→${set.vals[i]}`).join(', ');  // changes: each touched semaphore's old and new value, such as printers 2→1
            let msg = `<b>${who}</b> calls semop with ${listTxt(ops)}. Every operation can be done, so the kernel does them <b>all at once</b>: ${changes}. ${who} continues and becomes the sempid of ${ops.length > 1 ? 'each' : 'that'} semaphore.`;  // the start of the green narration: all operations done at once, the changes, and the new sempid
            logInto(ctx, log, `${who} ${listTxt(ops)} → done`);  // log line: the call and done
            // Which suspended calls does this wake? Those waiting for a value that rose, or for a zero that just appeared.
            const woken = waiting.filter((w) => (w.why === 'n' && set.vals[w.i] > before[w.i]) || (w.why === 'z' && set.vals[w.i] === 0));  // woken: suspended calls whose awaited value just rose or just reached zero, found before the retry so missed ones can be mentioned
            const done = semopRetry(set, waiting);  // done: the suspended calls that can now finish, completed in fair order by semopRetry
            waiting.forEach((w) => { const nb = semopBlocker(set.vals, w.ops); w.i = nb.i; w.why = nb.why; });  // for each call still waiting, records which operation it is now stuck on, so semncnt and semzcnt stay correct
            if (done.length) msg += ' The kernel retries the suspended calls, those waiting for zero first:';  // if any call completed, the narration adds that the kernel retried the waiting calls, zero-waiters first
            done.forEach((w, k) => { last[w.name] = 'last call: done after waiting'; msg += ` ${k ? 'then ' : ''}<b>${w.name}</b>'s ${listTxt(w.ops)} now succeeds as a whole${k === done.length - 1 ? '.' : ';'}`; logInto(ctx, log, `${w.name} ${listTxt(w.ops)} → woken, done`); });  // for each completed call: marks it done after waiting, names it in the narration, and logs it
            if (done.length) msg += ` ${done.length > 1 ? 'Each one' : 'It'} continues and becomes the sempid of what it touched.`;  // adds that each woken call continues and becomes the sempid of what it touched
            woken.filter((w) => !done.includes(w)).forEach((w) => { msg += ` ${w.name} was woken, re-checked, and must keep waiting (${SEMS[w.i]} is ${set.vals[w.i]}).`; });  // for calls woken but still unable to proceed: says they re-checked and must keep waiting, and why
            say(msg, 'ok');  // shows the full narration in green
            paint();  // redraws everything
          }  // ends call
          const preview = h('span', { class: 'small mono', style: { flex: 1, minWidth: 0 } });  // preview: a fixed-width line showing the list as built so far, filling the space left in its row
          function paint() {  // paint(): redraws the table, the process cards and the controls from the current state
            tbody.replaceChildren(...SEMS.map((name, i) => h('tr', {},  // one table row per semaphore
              ctx.narrow ? null : h('td', { class: 'mono' }, '#' + i), h('td', { class: 'b' }, name),  // its number (hidden on a small screen to save room) and its name
              h('td', { class: 'mono b', style: { fontSize: '16px' } }, String(set.vals[i])),  // semval, large and bold
              h('td', { class: 'mono' }, set.pids[i] == null ? '—' : String(set.pids[i])),  // sempid, or a dash before any process has operated on it
              h('td', { class: 'mono', style: { color: counts(i, 'n') ? 'var(--warn)' : null, fontWeight: counts(i, 'n') ? 800 : null } }, String(counts(i, 'n'))),  // semncnt, amber and bold whenever someone waits for this value to rise
              h('td', { class: 'mono', style: { color: counts(i, 'z') ? 'var(--warn)' : null, fontWeight: counts(i, 'z') ? 800 : null } }, String(counts(i, 'z'))))));  // semzcnt, amber and bold whenever someone waits for this value to reach zero
            cards.replaceChildren(...PROCS.map(([n, pid]) => {  // rebuilds the three process cards
              const w = waiting.find((x) => x.name === n);  // w: this process's waiting call, if it is suspended
              return h('div', { class: 'pcard' + (w ? ' blocked' : ''), style: { gap: '3px' } },  // the card turns amber while the process is suspended
                h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'nm' }, n), h('span', { class: 'chip' }, 'pid ' + pid)),  // card header: the process name on the left and a tag with its pid on the right
                h('div', { class: 'st' }, w ? 'Suspended in semop' : 'Running'),  // status line: suspended in semop or running
                h('div', { class: 'xs mono', style: { minHeight: '34px' } }, w ? `${listTxt(w.ops)} · stuck on ${SEMS[w.i]} (${w.why === 'z' ? 'wants 0' : 'wants a rise'})` : (last[n] || 'no call yet')));  // detail line: a waiting call's list, the semaphore it is stuck on and whether it wants 0 or a rise; otherwise its last result
            }));  // closes the card and the map over processes
            const ops = pick.map((d, i) => [i, d]).filter(([, d]) => d !== 'x');  // ops: the list as currently built in the switches
            const busy = waiting.some((w) => w.name === who);  // busy: whether the chosen caller is already suspended
            preview.textContent = ops.length ? 'list: ' + listTxt(ops) : 'list: (empty)';  // preview line: the list as it would be submitted, or "(empty)"
            submit.disabled = busy || !ops.length;  // Submit is greyed out while the caller is suspended or the list is empty
            submit.textContent = busy ? `${who} is suspended` : `Submit semop as ${who}`;  // Submit's label names the caller, or says that it is suspended
          }  // ends paint
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: 'minmax(0, 6fr) minmax(0, 5fr)', gap: '20px' } },  // page layout: two columns, the list builder and table on the left (6 parts), the processes, narration and log on the right (5 parts)
            h('div', { class: 'stack', style: { gap: '8px' } },  // left column, stacked
              h('p', { class: 'm0 small', html: 'A print room keeps one <span class="t">semaphore set</span> with three members. Each process asks for <b>everything</b> it needs in a single <span class="t">semop</span> call.' }),  // intro: a print room keeps one semaphore set with three members, and each process asks for everything in one semop call
              h('div', { class: 'card tight stack', style: { gap: '6px' } },  // the builder card, its rows stacked
                h('div', { class: 'row', style: { gap: '10px' } }, h('span', { class: 'small b', style: { width: '74px' } }, 'Caller'), whoSeg,  // first row: the Caller label and the switch choosing P1, P2 or P3
                  h('button', { class: 'btn sm', type: 'button', style: { marginLeft: 'auto' }, onclick: reset }, 'Reset')),  // Reset button, pushed to the right end of that row
                ...SEMS.map((name, i) => h('div', { class: 'row', style: { gap: '10px' } }, h('span', { class: 'small b mono', style: { width: '74px' } }, name), segs[i])),  // one row per semaphore: its name and its switch for the sem_op to include
                h('div', { class: 'row gap-s' }, ...PRESETS.map(([label, ops]) => h('button', { class: 'btn sm ghost', type: 'button', style: { border: '1px solid var(--line-2)' }, onclick: () => setPicks(ops) }, label))),  // a row of preset buttons; each fills the switches with a ready-made list
                h('div', { class: 'row', style: { gap: '10px', flexWrap: 'nowrap' } }, preview, submit)),  // last row of the builder: the list preview beside the Submit button, kept on one line
              h('table', { class: 'tbl compact' }, h('thead', {}, h('tr', {}, ...(ctx.narrow ? ['sem', 'val', 'pid', 'ncnt', 'zcnt'] : ['#', 'semaphore', 'semval', 'sempid', 'semncnt', 'semzcnt']).map((x) => h('th', {}, x)))), tbody),  // the fields table, with shorter column headings and no number column on a small screen, and the body built by paint
              h('div', { class: 'card tight small' }, h('b', {}, 'Try: '), 'P1 copy start · P2 copy start · P3 wait for 0 jobs · P1 copy end · P2 copy end. Then invent your own lists.')),  // suggestion card: a sequence of calls that shows waiting, all-or-nothing, wait-for-zero and the wake-up order
            h('div', { class: 'stack', style: { gap: '8px' } },  // right column, stacked
              cards, narr, log,  // the three process cards, the narration box and the log
              h('div', { class: 'callout why small m0', 'data-label': 'Why one call?', html: 'If P2 grabbed the scanner and then waited for a printer, it would hold one resource while waiting for another, one of the conditions for deadlock. An all-or-nothing semop never holds part of what it asked for.' }))));  // note box: grabbing one resource then waiting for another is a deadlock condition; an all-or-nothing call never holds part of what it asked for
          reset();  // sets the starting values as soon as the step is drawn
        },  // ends render for step 7
      },  // ends step 7

      /* ---------------- 8. Signals: pending bits and dispositions ---------------- */
      {  // step 8 starts here
        title: 'Signals: one bit per type, handled when the process runs',  // title of step 8
        kind: 'explore',  // kind explore: labelled Explore, a hands-on simulator
        render(el, ctx) {  // render(el, ctx): builds the signal simulator when step 8 opens
          const { h, s } = ctx;  // takes the HTML builder h and the SVG builder s out of ctx
          // [name, System V number, Linux x86 number, when it is sent, default ('end' or 'ignore'), what the handler does]
          const SIGS = [  // SIGS: the five signals in the demo, with the fields named in the comment above
            ['SIGINT', 2, 2, 'kernel: Ctrl-C was typed at the terminal', 'end', 'on_int() asks “Discard changes?” and returns'],  // SIGINT: sent when Ctrl-C is typed; ends the editor by default; its handler asks whether to discard changes
            ['SIGTERM', 15, 15, 'a process ran kill 777 (please stop)', 'end', 'on_term() saves a backup copy and returns'],  // SIGTERM: a polite request to stop; ends the editor by default; its handler saves a backup first
            ['SIGUSR1', 16, 10, 'a process ran kill -USR1 777', 'end', 'on_usr1() reloads the settings and returns'],  // SIGUSR1: a signal for the program's own use, numbered differently on the two systems; ends by default; its handler reloads settings
            ['SIGCHLD', 18, 17, 'kernel: a child of the editor ended', 'ignore', 'on_chld() collects the child\'s exit status'],  // SIGCHLD: sent when a child process ends; ignored by default; its handler collects the child's exit status
            ['SIGKILL', 9, 9, 'a process ran kill -9 777', 'end', null],  // SIGKILL: ends the editor, and has no handler because it can be neither caught nor ignored
          ];  // closes SIGS
          let st;  // st will hold the simulation state
          const disp = SIGS.map(() => 'default');  // disp: what the editor has chosen for each signal (default, handler or ignore); all start at default
          const rows = h('div', { class: 'stack', style: { gap: '6px' } });  // rows: the stack of per-signal rows, each with a send button and a choice switch
          // Pending-bit boxes: one row on large screens, rows of three on small screens.
          const svg = s('svg', { viewBox: ctx.narrow ? '0 0 330 200' : '0 0 470 112', width: '100%' });  // the drawing area for the pending bits: one row of five on a wide screen, rows of three on a small one
          const bitXY = (k) => (ctx.narrow ? [8 + (k % 3) * 108, 26 + Math.floor(k / 3) * 88] : [8 + k * 92, 26]);  // bitXY(k): the top-left corner of bit k's box in whichever layout is in use
          const narr = h('div', { class: 'narr', style: { minHeight: '92px' } });  // the narration box, tall enough for four lines
          const say = (html, tone) => sayInto(narr, html, tone);  // say(html, tone): shorthand that writes into this step's narration box
          const log = h('div', { class: 'log grow', style: { minHeight: '50px' } });  // log: a running list of every send and every delivery, newest on top
          const stats = h('div', { class: 'row gap-s' });  // stats: a row of tags counting signals sent, lost and handled
          const runBtn = h('button', { class: 'btn primary sm', type: 'button', onclick: () => run() }, 'Editor runs: kernel checks the bits');  // runBtn: lets the editor get the CPU, which is when the kernel looks at its pending bits
          function reset(msg) {  // reset(msg): clears all bits and brings the editor back; runs when the step opens and on Reset
            st = { bits: SIGS.map(() => 0), sent: 0, lost: 0, handled: 0, dead: null, hot: -1 };  // st: bits holds one pending bit per signal; sent, lost and handled are counters; dead names the signal that ended the editor; hot is the signal just sent
            log.innerHTML = '';  // empties the log
            say(msg || 'The editor (pid 777) is asleep, waiting for a key press. Send it some signals: each one only sets a bit (and makes the sleeping editor ready to run). Nothing happens to the editor until the scheduler gives it the CPU.');  // opening narration (unless a message was passed in): the editor is asleep and sending a signal only sets a bit
            paint();  // redraws the bits, rows and counters
          }  // ends reset
          function send(k) {  // send(k): runs when a signal's send button is clicked; sends signal k to the editor
            const [name] = SIGS[k];  // name: the signal's name
            st.hot = k;  // highlights this signal's bit in the drawing
            if (st.dead) { say(`kill fails: process 777 no longer exists (it was ended by ${st.dead}). Press Reset.`, 'bad'); return paint(); }  // once the editor is dead there is no process to send to, so kill fails; red narration
            st.sent++;  // counts the send
            if (st.bits[k]) { st.lost++; say(`${name} is sent again, but its pending bit is <b>already 1</b>. A bit cannot count, so this second ${name} simply <b>collapses</b> into the first: it is lost.`, 'bad'); logInto(ctx, log, `${name} sent → bit already 1, lost`); }  // if the bit is already 1 the new signal is lost, because a bit cannot count; it is counted as lost, narrated in red and logged
            else { st.bits[k] = 1; say(`${name} is sent: the kernel sets the ${name} bit in the editor's process table entry to <b>1</b>. That is all delivery does. The editor will react the next time it runs.`); logInto(ctx, log, `${name} sent → bit set`); }  // otherwise the kernel sets the bit to 1, which is all that delivery does; narrated and logged
            paint();  // redraws
          }  // ends send
          function run() {  // run(): runs when the student clicks the editor-runs button; the kernel acts on every pending bit
            if (st.dead) return;  // a terminated editor never runs again
            st.hot = -1;  // clears the send highlight
            // Classic UNIX fixes no order; like Linux, take SIGKILL first, then the lowest (Linux) number.
            const rank = (k) => (SIGS[k][0] === 'SIGKILL' ? 0 : SIGS[k][2]);  // rank(k): the handling order, SIGKILL first and then by Linux number
            const pending = SIGS.map((x, k) => k).filter((k) => st.bits[k]).sort((a, b) => rank(a) - rank(b));  // pending: the signals whose bit is set, in that order
            if (!pending.length) { say('The editor runs. The kernel finds no pending bits, so the editor simply carries on.'); return paint(); }  // with no bits set the editor just carries on; narrated, then stops here
            const parts = [];  // parts: one sentence per signal handled, joined into the narration at the end
            for (const k of pending) {  // handles each pending signal in turn
              const [name, , , , def, handler] = SIGS[k], d = name === 'SIGKILL' ? 'default' : disp[k];  // unpacks the name, default action and handler; d is the editor's choice, except that SIGKILL always gets its default
              st.bits[k] = 0;  // clears this signal's bit, since it is now being acted on
              if (d === 'ignore') { parts.push(`${name}: set to ignore, so the bit is just cleared.`); logInto(ctx, log, `${name} → ignored`); }  // set to ignore: the bit is simply cleared; logged
              else if (d === 'handler') { st.handled++; parts.push(`${name}: its handler runs once (${handler.replace(/ and returns$/, '')}).`); logInto(ctx, log, `${name} → handler ran`); }  // handler chosen: the handler runs once, however many times the signal was sent; counted and logged
              else if (def === 'ignore') { parts.push(`${name}: its default action is to ignore it.`); logInto(ctx, log, `${name} → default: ignored`); }  // default action is to ignore (as for SIGCHLD): nothing happens; logged
              else {  // otherwise the default action terminates the editor
                st.dead = name; parts.push(`${name}: the <b>default action</b> terminates the editor.` + (name === 'SIGKILL' ? ' No handler or ignore setting could have stopped this.' : '') + (pending.indexOf(k) < pending.length - 1 ? ' The other pending bits no longer matter.' : ''));  // records which signal ended it; the sentence adds that SIGKILL could not have been stopped and that other pending bits no longer matter
                logInto(ctx, log, `${name} → default: editor terminated`);  // logs the termination
                st.bits = st.bits.map(() => 0);  // clears every bit, since the process is gone
                break;  // stops handling the remaining signals
              }  // ends the choice of action
            }  // ends the loop over pending signals
            say(`The editor gets the CPU. Before it returns to its own code, the kernel handles the pending bits <b>one at a time</b>.` + (pending.length > 1 ? ' Classic UNIX fixes no order; like Linux, this demo takes SIGKILL first, then the lowest number.' : '') + ' ' + parts.join(' ') + (st.dead ? '' : ' Then the editor continues where it was.'), st.dead ? 'bad' : 'ok');  // narration: the kernel handles pending bits one at a time before the editor's own code resumes; red if it died, green otherwise
            paint();  // redraws
          }  // ends run
          const CALL = { default: 'SIG_DFL', ignore: 'SIG_IGN' };  // CALL: the names passed to the signal call for the default action (SIG_DFL) and for ignoring (SIG_IGN)
          SIGS.forEach(([name, sv, lx, when, def, handler], k) => {  // builds one row of controls per signal
            const ctl = handler ? ctx.ui.seg([{ value: 'default', label: 'Default' }, { value: 'handler', label: 'Handler' }, { value: 'ignore', label: 'Ignore' }], disp[k], (v) => {  // ctl: for a signal that can be caught, a three-way switch: Default, Handler or Ignore
              disp[k] = v;  // remembers the editor's choice for this signal
              say(`The editor called <code>signal(${name}, ${v === 'handler' ? handler.split('(')[0] : CALL[v]})</code> before it went to sleep. From now on ${name} will ` + (v === 'handler' ? `run that <span class="t">signal handler</span>: ${handler}.` : v === 'ignore' ? 'be ignored. (Linux actually throws an ignored signal away the moment it is sent; the outcome is the same.)' : `get its <span class="t">default action</span>: ${def === 'end' ? 'terminate the editor' : 'nothing at all'}.`));  // narration: the signal call the editor made before sleeping, and what this signal will now do when handled
              paint();  // redraws
            }) : h('span', { class: 'chip bad' }, 'cannot be caught or ignored');  // SIGKILL has no switch, just a red tag saying it cannot be caught or ignored
            const btn = h('button', { class: 'btn sm intr', type: 'button', style: { width: '92px', flex: 'none' }, onclick: () => send(k) }, name);  // btn: the send button for this signal, in the interrupt colour and a fixed width so the rows line up
            const info = h('div', { style: { flex: 1, minWidth: 0, lineHeight: 1.25 } }, h('div', { class: 'small' }, when),  // info: the middle of the row, taking the spare width: when the signal is sent
              h('div', { class: 'xs muted' }, sv === lx ? `number ${sv} on every common UNIX` : `number ${sv} on System V, ${lx} on Linux x86`));  // and its number, noting when System V and Linux use different numbers
            // Small screens: the action switch moves under the button and its description.
            rows.append(ctx.narrow  // adds this signal's row to the stack, laid out to fit the screen
              ? h('div', { class: 'card tight stack', style: { gap: '6px', padding: '6px 10px' } }, h('div', { class: 'row', style: { gap: '10px', flexWrap: 'nowrap' } }, btn, info), ctl)  // small screen: a card with the button and description on one line and the action switch underneath
              : h('div', { class: 'card tight row', style: { gap: '10px', flexWrap: 'nowrap', padding: '6px 10px' } }, btn, info, ctl));  // wide screen: a single line with button, description and action switch side by side
          });  // ends the loop that builds the signal rows
          function paint() {  // paint(): redraws the pending bits and the counters from st; runs after every send, every run and every reset
            const kids = [s('text', { x: 6, y: 15, 'font-size': 13, 'font-weight': 800 }, ctx.narrow ? 'pid 777: pending bits' : 'process table entry, pid 777: pending bits'),  // kids starts with a heading over the bits: the process table entry of pid 777 (shortened on a small screen)
              s('text', { x: ctx.narrow ? 324 : 464, y: 15, 'text-anchor': 'end', 'font-size': 13, style: `fill:var(${st.dead ? '--bad' : '--ok'})`, 'font-weight': 700 }, st.dead ? 'terminated' : 'alive')];  // and a status at the right end: alive in green, or terminated in red
            SIGS.forEach(([name], k) => {  // draws one box per signal
              const [x, y] = bitXY(k);  // x, y: where this signal's box goes
              kids.push(s('rect', { x, y, width: 82, height: 44, rx: 8, class: st.bits[k] ? 's-intr' : 's-panel', 'stroke-width': st.hot === k ? 3.5 : 2 }),  // the bit's box, in the interrupt colour when the bit is 1 and plain when 0, with a thick edge if this signal was just sent
                s('text', { x: x + 41, y: y + 30, 'text-anchor': 'middle', 'font-size': 22, 'font-weight': 900, class: 's-monot' }, String(st.bits[k])),  // the bit's value, 0 or 1, large in the middle of the box
                s('text', { x: x + 41, y: y + 62, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 }, name),  // the signal's name under the box
                s('text', { x: x + 41, y: y + 80, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, name === 'SIGKILL' ? 'default' : disp[k]));  // under the name, what the editor will do with it: default, handler or ignore (always default for SIGKILL)
            });  // ends the loop over signals
            svg.replaceChildren(...kids);  // swaps in the new drawing
            stats.replaceChildren(h('span', { class: 'chip' }, `sent ${st.sent}`), h('span', { class: 'chip warn' }, `collapsed ${st.lost}`), h('span', { class: 'chip ok' }, `handler runs ${st.handled}`),  // counter tags: signals sent, signals that collapsed into an already-set bit, and handler runs
              h('span', { class: 'chip ' + (st.dead ? 'bad' : 'proc') }, st.dead ? 'ended by ' + st.dead : 'editor alive'));  // and a last tag: editor alive, or which signal ended it
            runBtn.disabled = !!st.dead;  // the editor-runs button is greyed out once the editor is dead
          }  // ends paint
          const CATALOG = [  // CATALOG: reference table of common signals, each with its name, System V number, Linux number, meaning and default action
            ['SIGHUP', 1, 1, 'terminal connection hung up', 'end'], ['SIGINT', 2, 2, 'Ctrl-C typed at the terminal', 'end'],  // catalog rows: SIGHUP (terminal hung up) and SIGINT (Ctrl-C)
            ['SIGQUIT', 3, 3, 'quit key (Ctrl-\\) typed', 'core'], ['SIGILL', 4, 4, 'illegal instruction', 'core'],  // catalog rows: SIGQUIT (quit key) and SIGILL (illegal instruction), both writing a core dump
            ['SIGTRAP', 5, 5, 'trace trap, used by debuggers', 'core'], ['SIGFPE', 8, 8, 'arithmetic error, e.g. divide by 0', 'core'],  // catalog rows: SIGTRAP (debugger trap) and SIGFPE (arithmetic error), both writing a core dump
            ['SIGKILL', 9, 9, 'kill: cannot be caught or ignored', 'end'], ['SIGBUS', 10, 7, 'bus error: bad memory access', 'core'],  // catalog rows: SIGKILL (cannot be caught) and SIGBUS (bad memory access), whose numbers differ between systems
            ['SIGSEGV', 11, 11, 'segmentation violation (bad address)', 'core'], ['SIGSYS', 12, 31, 'bad argument to a system call', 'core'],  // catalog rows: SIGSEGV (bad address) and SIGSYS (bad system call argument)
            ['SIGPIPE', 13, 13, 'write on a pipe nobody reads', 'end'], ['SIGALRM', 14, 14, 'alarm clock: a timer expired', 'end'],  // catalog rows: SIGPIPE (write on a pipe nobody reads) and SIGALRM (timer expired)
            ['SIGTERM', 15, 15, 'polite request to terminate', 'end'], ['SIGUSR1', 16, 10, 'user-defined signal 1', 'end'],  // catalog rows: SIGTERM (polite request to stop) and SIGUSR1 (user-defined)
            ['SIGUSR2', 17, 12, 'user-defined signal 2', 'end'], ['SIGCHLD', 18, 17, 'a child process stopped or ended', 'ignore'],  // catalog rows: SIGUSR2 (user-defined) and SIGCHLD (child stopped or ended, ignored by default)
            ['SIGPWR', 19, 30, 'power failure', 'varies'],  // catalog row: SIGPWR (power failure), whose default differs between systems
          ];  // closes CATALOG
          const catalog = (p) => p.append(h('div', { class: 'stack', style: { gap: '4px' } },  // catalog(p): fills the Signal catalog tab's panel p with the table and a key
            h('table', { class: 'tbl compact sigtab' }, h('thead', {}, h('tr', {}, ...['signal', 'Sys V', 'Linux', 'meaning', 'default'].map((x) => h('th', {}, x)))),  // the table, with headings for name, the two numbers, meaning and default
              h('tbody', {}, ...CATALOG.map(([n, a, b, m, d]) => h('tr', {}, h('td', { class: 'mono b' }, n), h('td', { class: 'mono' }, String(a)), h('td', { class: 'mono', style: { color: a !== b ? 'var(--warn)' : null, fontWeight: a !== b ? 800 : null } }, String(b)), h('td', {}, m), h('td', {}, d))))),  // one row per signal; the Linux number is amber and bold when it differs from the System V number
            h('div', { class: 'xs muted', html: 'end = terminate · core = terminate and write a <span class="t">core dump</span> · varies = ignore on System V, end on Linux · amber = number differs, so programs use the names' })));  // key under the table: what end, core and varies mean, and that amber numbers are why programs use names
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: 'minmax(0, 6fr) minmax(0, 5fr)', gap: '20px' } },  // page layout: two columns, the signal rows on the left (6 parts) and the tabs on the right (5 parts)
            h('div', { class: 'stack', style: { gap: '8px' } },  // left column, stacked
              h('p', { class: 'm0 small', html: 'A <span class="t">signal</span> tells a process that an event happened. Sending one only sets a bit, a <span class="t">pending signal</span>. The process reacts when it next runs: it takes the <span class="t">default action</span>, runs its <span class="t" data-t="signal handler">handler</span>, or ignores the signal.' }),  // intro: sending a signal only sets a pending bit, and the process reacts when it next runs, in one of three ways
              rows,  // the five signal rows built above
              h('div', { class: 'callout warn small m0', 'data-label': 'No queue, no priority', html: 'Each type has one bit, so signals of one type cannot pile up (the real-time signals POSIX added later are the exception: they queue). The classic model ranks no type above another. <span class="t">SIGKILL</span> can never be caught or ignored, so a runaway program can always be stopped.' })),  // warning box: one bit per type means no queue, the classic model has no priority, and SIGKILL can always stop a program
            h('div', { class: 'stack fill' }, ctx.ui.tabs([  // right column: a tabs widget filling the height
              { label: 'Delivery', render: (p) => { p.append(h('div', { class: 'stack', style: { gap: '8px', height: '100%' } }, h('div', { class: 'card white tight' }, svg),  // Delivery tab: the pending-bit drawing in a white card, stacked with the controls below
                h('div', { class: 'row gap-s' }, runBtn, h('button', { class: 'btn sm', type: 'button', onclick: () => reset() }, 'Reset')), stats, narr, log)); } },  // then the editor-runs and Reset buttons, the counters, the narration and the log
              { label: 'Signal catalog', render: catalog },  // Signal catalog tab: the reference table
            ]))));  // closes the tab list, the right column and the layout
          reset();  // starts with all bits clear as soon as the step is drawn
        },  // ends render for step 8
      },  // ends step 8

      /* ---------------- 9. Recap ---------------- */
      {  // step 9 starts here
        title: 'Recap: the eight things to remember',  // title of step 9
        kind: 'recap',  // kind recap: labelled Recap, a summary of the section
        render(el, ctx) {  // render(el, ctx): builds the recap flashcards when step 9 opens
          const { h } = ctx;  // takes the HTML builder h out of ctx
          el.append(h('div', { class: 'stack fill', style: { gap: '12px' } },  // the whole step is one stack filling the height
            h('p', { class: 'lead m0' }, 'Say each answer out loud before you flip the card.'),  // opening sentence: say each answer out loud before flipping the card
            ctx.ui.flipcards([  // a grid of flashcards, each a [front, back] pair that turns over when clicked
              ['The five UNIX tools', '<b>Move data:</b> pipes, message queues, shared memory.<br><b>Trigger actions:</b> semaphores and signals.'],  // flashcard: the five tools, split into the three that move data and the two that trigger actions
              ['Pipe', 'A fixed-size circular buffer in the kernel, first in, first out. A write that does not fit blocks; an empty pipe blocks the reader. The kernel enforces mutual exclusion.'],  // flashcard: a pipe's buffer, when its writer and reader block, and the built-in mutual exclusion
              ['Unnamed vs named pipe', 'Unnamed: no name to open, so it is reached through descriptors inherited across fork: related processes. Named (FIFO): has a file-system name, so unrelated processes can open it.'],  // flashcard: unnamed pipes reached by inheritance versus named pipes opened by name
              ['msgsnd / msgrcv', 'Typed messages in a kernel mailbox. Full queue blocks the sender; empty queue blocks the receiver. Take the oldest, or the oldest of one type. Classic rule: a missing type fails without waiting (real msgrcv: only with IPC_NOWAIT).'],  // flashcard: msgsnd and msgrcv, their blocking cases, the two ways to choose, and the missing-type rule
              ['Shared memory', 'Fastest: no copying and no system calls once attached. Each process gets read-only or read-write access. No mutual exclusion: add a semaphore.'],  // flashcard: shared memory is fastest, has per-process permissions, and needs a semaphore for mutual exclusion
              ['semop', 'Performs a list of operations on a semaphore set atomically: all of them, or none and the caller waits. Each semaphore keeps semval, sempid, semncnt, semzcnt.'],  // flashcard: semop's all-or-nothing list and the four fields each semaphore keeps
              ['The four sem_op rules', '&gt; 0: add, wake those waiting for a rise. = 0: go on if the value is 0, else wait for 0. &lt; 0 and it fits: subtract (wake zero-waiters at 0). &lt; 0 and too big: wait until the value has risen enough.'],  // flashcard: the four sem_op rules in short form
              ['Signals', 'One pending bit per type, so repeats collapse. Acted on when the process next runs: default action, handler or ignore. SIGKILL cannot be caught or ignored.'],  // flashcard: signals as one pending bit per type, the three reactions, and SIGKILL's exception
            ], { cols: 4, height: 186 }),  // closes the cards: four columns, each card 186 pixels tall
            h('div', { class: 'callout warn m0', 'data-label': 'The two classic traps', html: 'Assuming shared memory protects itself (it does not: wrap updates in a semaphore), and leaving a pipe’s write end open somewhere (the reader then never sees end of file and the pipeline hangs).' })));  // warning box: the two classic traps, unprotected shared memory and a pipe write end left open
        },  // ends render for step 9
      },  // ends step 9

      /* ---------------- 10. Quiz ---------------- */
      {  // step 10 starts here
        title: 'Check yourself',  // title of step 10
        kind: 'check',  // kind check: labelled Check Yourself; its quiz score counts toward the section's mastery
        quiz: [  // quiz: the questions for this step; the guide's quiz engine shows and scores them
          { q: 'A UNIX pipe can hold 16 bytes and currently holds 11. A process asks to write 7 bytes into it. What happens?',  // question 1 (multiple choice): a 7-byte write into a pipe with only 5 free bytes
            choices: ['The writer blocks until there is room for all 7 bytes', 'The 5 bytes that fit are written and the other 2 are thrown away', 'The 2 oldest bytes are overwritten to make room', 'The write fails at once with an error and the writer carries on'], answer: 0,  // choices: the writer blocks (correct), a partial write, overwriting old bytes, or failing at once
            feedback: [null, 'A pipe never throws away data a writer hands it; the writer waits instead.', 'Overwriting unread bytes would corrupt the stream. A pipe is first in, first out and never overwrites.', 'An ordinary (blocking) write does not fail because the pipe is full; it waits for the reader to make room.'],  // feedback for each wrong choice: a pipe never discards, never overwrites, and a full pipe makes the writer wait rather than fail
            why: 'Only 16 − 11 = 5 bytes are free. A write that does not fit blocks the writer until the reader has removed enough bytes; then the write goes ahead. (Real systems guarantee this all-or-nothing behaviour for writes up to PIPE_BUF bytes, and 7 bytes is far below that.)' },  // explanation: only 5 bytes are free, so the writer blocks until there is room for all 7
          { type: 'tf', q: 'A program started in one terminal window can open, by name, an unnamed pipe that a program in another terminal window created, just as it would open a file.', answer: false,  // question 2 (true or false): can an unrelated program open an unnamed pipe by name? (false)
            why: 'An unnamed pipe has no name in the file system, so there is nothing to open. Other processes normally reach it by inheriting its file descriptors through fork, which is why it joins related processes such as a parent and its children. Unrelated programs use a named pipe (FIFO), which can be opened by name.' },  // explanation: an unnamed pipe has no name, so it is reached by inheriting descriptors; unrelated programs need a named pipe
          { type: 'tf', q: 'In the classic description of UNIX message queues, a process that asks msgrcv for a message of a type that is not in the queue is suspended until such a message arrives.', answer: false,  // question 3 (true or false): does msgrcv for a missing type suspend the caller under the classic rules? (false)
            why: 'Under the classic rules only an empty queue suspends a receiver that asks for any message. A request for a missing type is not suspended: the call fails and returns, so the process can do other work. (Real msgrcv behaves this way when the IPC_NOWAIT flag is given; without it the caller waits.)' },  // explanation: only an empty queue suspends a receive-any; a missing type makes the call fail, as IPC_NOWAIT does in real systems
          { type: 'order', q: 'A message queue holds four messages, oldest first: A (type 2), B (type 1), C (type 2), D (type 3). The receiver calls msgrcv for type 3, then for type 2, then for any type, then for any type. Put the messages in the order the receiver gets them.',  // question 4 (put in order): the order four messages come out for receives by type 3, type 2, any, any
            items: ['D (type 3)', 'A (type 2)', 'B (type 1)', 'C (type 2)'],  // the items in the correct order; the quiz engine shuffles them for the student
            why: 'Type 3 picks D, skipping the three older messages. Type 2 picks the oldest type-2 message, A. Then “any” takes the oldest message left, B, and finally C.' },  // explanation: type 3 picks D, type 2 picks A, then the oldest remaining, B, then C
          { type: 'multi', q: 'Which statements about UNIX shared memory are true?',  // question 5 (select all that apply): true statements about shared memory
            choices: ['It is the fastest way for processes to exchange data', 'Each process can be given read-only or read-write access', 'The kernel automatically makes accesses to it mutually exclusive', 'Every read or write of the shared block is a system call', 'Two processes may see the same block at different virtual addresses'], answer: [0, 1, 4],  // choices: fastest, per-process permission and different addresses are true; built-in mutual exclusion and a system call per access are false
            why: 'Once attached, the block is used with ordinary instructions (no copying and no system calls), which makes it the fastest tool, and each process sees it at its own address with its own permission. Mutual exclusion is not provided; the processes add it themselves, for example with semaphores.' },  // explanation: ordinary instructions make it fastest, but mutual exclusion must be added by the programs
          { type: 'num', q: 'A semaphore set has two members: A with value 2 and B with value 0. A process calls semop with the list [A −1, B −1]. Right after the call, what is the value of A?', answer: 2, tol: 0,  // question 6 (calculate): the value of A after semop [A −1, B −1] with B at 0; the answer is 2, with no tolerance
            hint: 'semop does the whole list or none of it.',  // hint: semop does the whole list or none of it
            why: 'B cannot drop below 0, so the whole list must wait and none of it is done: A stays at 2 and the caller is suspended until B rises.' },  // explanation: B cannot drop below 0, so nothing is done and A stays at 2
          { type: 'bucket', q: 'A process calls semop with a single operation and no special flags. Sort each case by what happens to the caller.', buckets: ['Continues at once', 'Is suspended'],  // question 7 (sort into groups): for single semop operations, whether the caller continues or is suspended
            items: [['value 3, sem_op −2', 0], ['value 1, sem_op −2', 1], ['value 0, sem_op 0', 0], ['value 2, sem_op 0', 1], ['value 0, sem_op +3', 0], ['value 0, sem_op −1', 1]],  // the six cases, each a value and sem_op paired with the number of its correct group
            why: 'A negative sem_op goes ahead only if its size is at most the value. sem_op = 0 goes ahead only when the value is already 0. A positive sem_op always goes ahead.' },  // explanation: the rule for negative, zero and positive sem_op
          { type: 'num', q: 'Before a process next runs, SIGUSR1 is sent to it three times. The process has registered a handler for SIGUSR1. How many times does the handler run when the process next runs?', answer: 1, tol: 0,  // question 8 (calculate): how many times a handler runs after SIGUSR1 is sent three times; the answer is 1
            why: 'Delivery sets one pending bit per signal type. The second and third SIGUSR1 find the bit already set and collapse into the first, so the handler runs once.' },  // explanation: one pending bit per type, so the repeats collapse into the first
          { type: 'match', q: 'Match each signal to the event that usually causes it.',  // question 9 (match the pairs): match six signals to the events that usually cause them
            pairs: [['SIGINT', 'Ctrl-C typed at the terminal'], ['SIGCHLD', 'A child process stopped or ended'], ['SIGPIPE', 'A write to a pipe that nobody reads'], ['SIGSEGV', 'An access to a memory address the process may not use'], ['SIGALRM', 'A timer the process set has expired'], ['SIGFPE', 'An arithmetic error such as dividing by zero']],  // the six correct pairs; the quiz engine shuffles the right-hand side for the student
            why: 'Most signals report one specific event: the terminal (SIGINT), the process family (SIGCHLD), pipes (SIGPIPE), memory faults (SIGSEGV), timers (SIGALRM) and arithmetic errors (SIGFPE).' },  // explanation: most signals report one specific kind of event, grouped by where it comes from
          { q: 'A process asks to ignore SIGTERM and also asks to ignore SIGKILL. Later it is sent both signals. What happens?',  // question 10 (multiple choice): a process asks to ignore both SIGTERM and SIGKILL, then receives both
            choices: ['Both are ignored and the process keeps running', 'Both terminate it, because no signal may be ignored', 'SIGTERM is ignored, but SIGKILL still terminates the process', 'SIGKILL waits in a queue until the ignore setting is removed'], answer: 2,  // choices: both ignored, both terminate, only SIGKILL terminates (correct), or SIGKILL queued until later
            feedback: ['SIGKILL cannot be ignored: the request to ignore it is refused.', 'Most signals, SIGTERM included, can be ignored or caught; SIGKILL is the exception.', null, 'Ordinary signals are not queued, and nothing can hold SIGKILL back.'],  // feedback for each wrong choice: SIGKILL cannot be ignored, SIGTERM can be, and nothing holds SIGKILL back
            why: 'Any signal except SIGKILL (and SIGSTOP) can be caught or ignored. SIGKILL always takes its default action, so a process can always be stopped.' },  // explanation: every signal except SIGKILL and SIGSTOP can be caught or ignored, so a process can always be stopped
          { type: 'bucket', q: 'Choose the UNIX mechanism that fits each job best.', buckets: ['Pipe', 'Message queue', 'Shared memory', 'Semaphore', 'Signal'],  // question 11 (sort into groups): choose the best of the five mechanisms for each job
            items: [['Stream the output of sort straight into a pager', 0], ['Let a print server pick urgent jobs before routine ones', 1], ['Let two image filters work on one 200 MB frame without copying it', 2], ['Allow at most 3 processes to use a software licence at once', 3], ['Nudge a running server to re-read its settings file (no data needs to travel)', 4], ['Stop two processes from updating a shared counter at the same moment', 3]],  // the six jobs, each paired with the number of its correct mechanism; two of them belong to semaphores
            why: 'Pipes stream bytes from one program to the next; message types let a receiver choose; shared memory avoids copying; semaphores count and exclude; a signal announces that an event happened.' },  // explanation: what each mechanism is best at, in one phrase each
          { q: 'Why do UNIX programs refer to signals by name (such as SIGUSR1) rather than by number?',  // question 12 (multiple choice): why programs name signals instead of using their numbers
            choices: ['Signal numbers are reassigned every time the system boots, so a stored number goes stale', 'The kernel rejects a bare number, so kill(pid, 10) fails where kill(pid, SIGUSR1) works', 'A name is resolved faster than a number, so the signal reaches its target process sooner', 'Many numbers differ between UNIX variants: SIGUSR1 is 16 on System V but 10 on Linux x86'], answer: 3,  // choices: numbers change at boot, the kernel rejects numbers, names are faster, or numbers differ between systems (correct)
            feedback: ['The numbers are fixed on a given system; they differ between systems, not between boots.', 'The kernel works with numbers; the names are constants that header files turn into the right number for that system.', 'A name becomes a number when the program is compiled, so it cannot change delivery speed.', null],  // feedback for each wrong choice: numbers are fixed per system, the kernel uses numbers, and names become numbers when compiled
            why: 'A few numbers (1 SIGHUP, 2 SIGINT, 3 SIGQUIT, 9 SIGKILL, 15 SIGTERM) are the same almost everywhere, but many others differ. Using the names keeps a program correct on every system.' },  // explanation: a few numbers are the same everywhere but many differ, so names keep programs correct on every system
        ],  // closes the quiz list
      },  // ends step 10
    ],  // closes the steps list
    notes: `${/* notes: the section's reading notes, shown in the Notes panel and in the printable version */''}
<h3>Five UNIX tools for cooperating processes</h3>${/* notes heading: the five UNIX tools for cooperating processes */''}
<p>Processes have separate address spaces, so they cooperate through the kernel. <b>Pipes, message queues and shared memory move data</b>; <b>semaphores and signals trigger actions</b>.</p>${/* notes paragraph: processes cooperate through the kernel; three tools move data and two trigger actions */''}
<table>${/* notes table comparing the five tools */''}
  <tr><th>Tool</th><th>Carries</th><th>Who waits</th><th>Mutual exclusion</th></tr>${/* table header: tool, what it carries, who waits, and whether mutual exclusion is provided */''}
  <tr><td>Pipe</td><td>a byte stream, first in, first out</td><td>writer if no room; reader if nothing to read</td><td>provided by the kernel</td></tr>${/* table row: pipe, a byte stream with built-in mutual exclusion */''}
  <tr><td>Message queue</td><td>whole messages, each with a type</td><td>sender if full; receiver if empty</td><td>provided by the kernel</td></tr>${/* table row: message queue, whole typed messages with built-in mutual exclusion */''}
  <tr><td>Shared memory</td><td>nothing travels: same bytes in both</td><td>nobody</td><td><b>not</b> provided</td></tr>${/* table row: shared memory, where nothing travels and no mutual exclusion is provided */''}
  <tr><td>Semaphore set</td><td>counts only</td><td>a caller whose operations cannot be done yet</td><td>is the tool</td></tr>${/* table row: semaphore set, which carries only counts and is itself the exclusion tool */''}
  <tr><td>Signal</td><td>just “event n happened” (one bit)</td><td>nobody waits for delivery</td><td>n/a</td></tr>${/* table row: signal, one bit saying an event happened, with nobody waiting */''}
</table>${/* closes the comparison table */''}
<h3>Pipes</h3>${/* notes heading: pipes */''}
<p>A pipe is a fixed-size <b>circular buffer</b> kept by the kernel and used producer/consumer style: one process writes bytes in, another reads them out in the same order, and positions wrap around to slot 0. The kernel lets only one process at a time work on the pipe.</p>${/* notes paragraph: a pipe is a kernel circular buffer used producer/consumer style, one process at a time */''}
<ul>${/* start of the list of pipe rules */''}
  <li><b>Write:</b> if there is room for the whole write it proceeds at once; otherwise the writer blocks until there is. (Real systems promise this only for writes up to PIPE_BUF bytes, 4,096 on Linux. A Linux pipe holds 64 KiB by default.)</li>${/* rule: a write that does not fit blocks the writer, with the real-system limit and default size */''}
  <li><b>Read (classic rule):</b> if the pipe holds at least as many bytes as requested, the read proceeds at once; otherwise the reader blocks. A real POSIX read() returns whatever bytes are there and blocks only on an empty pipe.</li>${/* rule: the classic read rule, and how a real POSIX read differs */''}
  <li><b>End of file:</b> when the pipe is empty and every write end is closed, read() returns 0.</li>${/* rule: when a read returns end of file */''}
  <li><b>SIGPIPE:</b> writing when no read end is open sends the writer SIGPIPE, which terminates it by default.</li>${/* rule: writing with no read end open sends SIGPIPE */''}
</ul>${/* end of the list of pipe rules */''}
<p><b>Worked example</b> (16-byte pipe, ls | wc -l): ls writes “app.c↵” (6), “db.c↵” (5), “io.h↵” (5): 16/16, full. Writing “main.c↵” (7) blocks ls. wc reads 4: 12 used, 4 free, ls still blocked. wc reads 4 more: 8 used, 8 free, so ls's 7 bytes go in: 15 used.</p>${/* worked example: the 16-byte ls | wc -l pipe filling up, ls blocking, and ls waking after two reads */''}
<h4>Unnamed and named pipes</h4>${/* notes subheading: unnamed and named pipes */''}
<p><code>pipe(fd)</code> creates an unnamed pipe and returns two file descriptors: <code>fd[0]</code> reads, <code>fd[1]</code> writes. It has no name, so other processes normally reach it by <b>inheriting</b> the descriptors through fork: unnamed pipes join <b>related</b> processes. (Passing a descriptor over a UNIX-domain socket is a rare advanced exception.) For <code>ls | wc -l</code> the shell calls pipe, forks a child that points its standard output (fd 1) at the write end with dup2, closes its spare descriptors and execs ls; forks a second child that points standard input (fd 0) at the read end and execs wc; then closes both of its own ends and waits. Each child follows exec with <code>_exit(127)</code>, which runs only if exec failed. Every unused write end must be closed, or the reader never sees end of file.</p>${/* notes paragraph: pipe(fd), inheritance through fork, the steps the shell takes for ls | wc -l, and closing unused write ends */''}
<p>A <b>named pipe (FIFO)</b>, made with <code>mkfifo</code>, has a name in the file system, so <b>unrelated</b> processes can open it by name. It buffers and blocks exactly like an unnamed pipe.</p>${/* notes paragraph: a named pipe made with mkfifo can be opened by unrelated processes and behaves like an unnamed one */''}
<h3>Message queues (System V)</h3>${/* notes heading: System V message queues */''}
<p>A message is a block of bytes plus a <b>type</b> (a positive number chosen by the sender). Each queue works like a mailbox.</p>${/* notes paragraph: a message is bytes plus a type chosen by the sender, and a queue works like a mailbox */''}
<ol>${/* start of the numbered list of queue rules */''}
  <li><code>msgsnd</code> adds a message at the back; a sender to a full queue (its limit is a total number of bytes) blocks.</li>${/* rule 1: msgsnd adds at the back and blocks when the queue is full */''}
  <li><code>msgrcv</code> for any type takes the oldest message; a receiver of an empty queue blocks.</li>${/* rule 2: receiving any type takes the oldest and blocks on an empty queue */''}
  <li><code>msgrcv</code> for type k takes the oldest message of type k, skipping other types.</li>${/* rule 3: receiving type k takes the oldest of that type */''}
  <li>Classic rule: if no message of the requested type is present, the receiver is not suspended: the call fails and returns. (Real msgrcv does this only when given IPC_NOWAIT, which also makes it fail on an empty queue; msgsnd takes the same flag. Without it the caller waits. A negative type −k takes the lowest type ≤ k.)</li>${/* rule 4: the classic missing-type rule, and how real msgrcv and the IPC_NOWAIT flag behave */''}
</ol>${/* end of the queue rules */''}
<p><b>Example:</b> queue A(2), B(1), C(2), D(3), oldest first. Requests type 3, type 2, any, any return D, A, B, C.</p>${/* worked example: the four-message queue and the order a type-3, type-2, any, any sequence returns them */''}
<h3>Shared memory</h3>${/* notes heading: shared memory */''}
<p>The fastest form of IPC: one block of memory is mapped into several address spaces (possibly at different virtual addresses) and used with ordinary load and store instructions: no copying and no system calls after setup (System V: <code>shmget</code>, <code>shmat</code>; POSIX: <code>shm_open</code> and <code>mmap</code>). Each process attaches it read-only or read-write (as far as the permission bits given at creation allow); a store through a read-only mapping causes SIGSEGV. Sending 100 MiB through a pipe instead copies 200 MiB (into and out of the kernel) and needs at least 1,600 reads of 64 KiB.</p>${/* notes paragraph: why shared memory is fastest, how it is set up, read-only versus read-write, and the 100 MiB pipe comparison */''}
<p><b>The facility gives no mutual exclusion.</b> If two processes each run counter = counter + 1 (load, add, store) and interleave as load, load, add, store, add, store, a counter at 7 ends at 8 instead of 9. Wrapping the update in a semaphore (semop −1 before, +1 after) gives 9.</p>${/* notes paragraph: shared memory gives no mutual exclusion; the interleaving that loses an update and the semaphore fix */''}
<h3>Semaphores (System V)</h3>${/* notes heading: System V semaphores */''}
<p>They generalize semWait/semSignal: sem_op may be larger than 1, and one call can operate on several semaphores. Semaphores are created in <b>sets</b>. <code>semctl</code> sets one value or all values at once, reads the fields or removes the set. <code>semop</code> takes a list of operations and the kernel performs <b>all of them atomically, or none</b>, suspending the caller if any one cannot proceed (with the IPC_NOWAIT flag the call fails at once instead). Each semaphore holds:</p>${/* notes paragraph: sets, semctl, and semop's all-or-nothing list of operations */''}
<ul>${/* start of the list of the four fields */''}
  <li><b>semval</b>: current value (never negative)</li>${/* field: semval */''}
  <li><b>sempid</b>: process ID of the last process to operate on it</li>${/* field: sempid */''}
  <li><b>semncnt</b>: number of processes waiting for the value to rise above its current value</li>${/* field: semncnt */''}
  <li><b>semzcnt</b>: number of processes waiting for the value to become zero</li>${/* field: semzcnt */''}
</ul>${/* end of the list of fields */''}
<table>${/* notes table of the four sem_op rules */''}
  <tr><th>sem_op</th><th>Effect</th></tr>${/* table header: sem_op and its effect */''}
  <tr><td>&gt; 0</td><td>Add it to the value; wake every process waiting for the value to increase.</td></tr>${/* table row: positive sem_op */''}
  <tr><td>= 0</td><td>If the value is 0, continue; otherwise suspend until it becomes 0.</td></tr>${/* table row: sem_op of zero */''}
  <tr><td>&lt; 0, |sem_op| ≤ value</td><td>Add it (the value drops); if it reaches 0, wake processes waiting for zero.</td></tr>${/* table row: negative sem_op that fits */''}
  <tr><td>&lt; 0, |sem_op| &gt; value</td><td>Suspend until the value increases enough: the caller re-checks at every rise and goes on once |sem_op| ≤ value.</td></tr>${/* table row: negative sem_op too big for the value */''}
</table>${/* closes the rules table */''}
<p><b>Example:</b> scanner 1, printers 2, jobs 0. P1: [scanner −1, printers −1, jobs +1] → 0, 1, 1. P2 asks the same: scanner cannot drop, so nothing is done (printers stays 1) and P2 waits (scanner semncnt 1). P3: [jobs 0] waits (semzcnt 1). P1: [scanner +1, printers +1, jobs −1] → 1, 2, 0; P3's wait for zero completes, then P2's whole list → 0, 1, 1. Asking for everything in one call means a process never holds part of what it needs while waiting, which avoids hold-and-wait.</p>${/* worked example: the print-room semaphore set from the lab, step by step, and how one call avoids hold-and-wait */''}
<h3>Signals</h3>${/* notes heading: signals */''}
<p>A signal informs a process that an asynchronous event occurred. It is like a software interrupt but without priorities: all signals are treated equally, and signals that arrive together are handled one at a time in no particular order. The kernel or another process (for example with kill) can send one. Sending sets <b>one bit per signal type</b> in the target's process table entry, so several signals of one type cannot be queued: they collapse into one. (Real systems keep this for the classic signals; the real-time signals POSIX added later do queue, and Linux, for example, does pick an order: SIGKILL first, then faults such as SIGSEGV, then the lowest number.) The signal is acted on when the process next wakes to run or is about to return from a system call; sending one also wakes a process sleeping in an interruptible wait, such as for keyboard input. The process takes the <b>default action</b> (usually terminate, sometimes with a core dump; SIGCHLD's default is to ignore it), runs a <b>signal handler</b> it registered, or <b>ignores</b> the signal. SIGKILL cannot be caught or ignored.</p>${/* notes paragraph: what a signal is, the one-bit-per-type rule, when it is acted on, the three reactions, and SIGKILL */''}
<table>${/* notes table of common signals */''}
  <tr><th>Signal</th><th>Sys V / Linux x86</th><th>Meaning</th></tr>${/* table header: signal, its System V and Linux numbers, and its meaning */''}
  <tr><td>SIGHUP, SIGINT, SIGQUIT</td><td>1, 2, 3 (same)</td><td>terminal hung up; Ctrl-C; quit key</td></tr>${/* table row: the three terminal signals */''}
  <tr><td>SIGILL, SIGTRAP, SIGFPE</td><td>4, 5, 8 (same)</td><td>illegal instruction; trace trap; arithmetic error</td></tr>${/* table row: three fault signals with the same numbers everywhere */''}
  <tr><td>SIGKILL</td><td>9 (same)</td><td>kill, cannot be caught or ignored</td></tr>${/* table row: SIGKILL */''}
  <tr><td>SIGBUS, SIGSEGV, SIGSYS</td><td>10/7, 11/11, 12/31</td><td>bus error; segmentation violation; bad system call argument</td></tr>${/* table row: three fault signals whose numbers differ */''}
  <tr><td>SIGPIPE, SIGALRM, SIGTERM</td><td>13, 14, 15 (same)</td><td>write to a pipe nobody reads; alarm clock; polite termination request</td></tr>${/* table row: SIGPIPE, SIGALRM and SIGTERM */''}
  <tr><td>SIGUSR1, SIGUSR2</td><td>16/10, 17/12</td><td>user defined</td></tr>${/* table row: the two user-defined signals, numbered differently */''}
  <tr><td>SIGCHLD, SIGPWR</td><td>18/17, 19/30</td><td>child stopped or ended; power failure</td></tr>${/* table row: SIGCHLD and SIGPWR, numbered differently */''}
</table>${/* closes the signal table */''}
<p>Because many numbers differ between UNIX variants, programs always use the names.</p>`,  // closing sentence: programs use signal names because numbers differ; ends the notes text
  });  // closes the object passed to Guide.section, which registers the section
})();  // ends the wrapper function and runs it at once
