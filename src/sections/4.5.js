// Comment key: a line inside backtick text ends with ${/* comment */''}, an empty-string slot that holds a comment without changing the text on screen (full note at the top of the page).
/* =====================================================================
   Section 4.5  Solaris Thread and SMP Management
   Process, user-level threads, lightweight processes (LWPs) and kernel
   threads; the Solaris process structure and LWP fields; kernel-thread
   states; and interrupts handled by interrupt threads.
   ===================================================================== */
(() => {  // wraps the whole section in a function that runs once, right away, so its names stay private to this file
  /* ---------- shared helpers (scoped to this file) ---------- */
  /* ---- Step 3 model: ULTs → LWPs → kernel threads → 2 processors ----
     5 ULTs, 1 to 4 LWPs (each LWP always has exactly one kernel thread), 2 processors.
     Every tick: the kernel dispatches up to two awake LWPs that have work (round robin,
     keeping an LWP on the processor it already had when it can); the thread library
     then runs the next ULT (round robin) of each dispatched LWP. A blocking call puts
     that LWP's kernel thread to sleep for SLEEP_TICKS ticks; the ULT is stuck inside the call. */
  const NU = 5, NCPU = 2, SLEEP_TICKS = 3, MAXL = 4;  // sizes for the step 3 lab: 5 user-level threads (ULTs), 2 processors, 3 ticks of sleep per blocking call, at most 4 LWPs
  function makeMapSim() {  // makeMapSim(): creates the step 3 simulator that maps ULTs onto LWPs, kernel threads and processors
    const st = {};  // st holds the whole simulator state; the page reads it to draw the picture
    const ultsOf = (l) => st.map.map((m, u) => (m === l ? u : -1)).filter((u) => u >= 0);  // ultsOf(l): lists the numbers of the ULTs currently assigned to LWP l
    const runnable = () => { const r = []; for (let l = 0; l < st.nL; l++) if (!st.sleep[l] && ultsOf(l).length) r.push(l); return r; };  // runnable(): lists the LWPs that are awake and have at least one ULT to run
    const U = (u) => 'U' + (u + 1), L = (l) => 'LWP ' + (l + 1), K = (l) => 'K' + (l + 1);  // helpers that turn a number into a display name: U1..U5 for ULTs, "LWP 1".. for LWPs, K1.. for kernel threads
    const list = (a) => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);  // list(a): joins names into readable English, such as "U1, U2 and U3"
    function reset() {  // reset(): puts the simulator back to its starting situation
      Object.assign(st, { nL: 1, map: [0, 0, 0, 0, 0], sleep: [0, 0, 0, 0], blocker: [-1, -1, -1, -1], last: [-1, -1, -1, -1],  // one LWP with all five ULTs on it, nobody asleep, no blocked ULT, no ULT run yet on any LWP
        rr: 0, tick: 0, cpu: [-1, -1], run: [-1, -1], work: [0, 0, 0, 0, 0], used: 0, waiting: [],  // round-robin pointer, tick count, which LWP and ULT each processor holds, work done per ULT, processor time used, LWPs waiting
        goals: { both: false, more: false, survive: false, stall: false } });  // the four lab goals, all not yet reached
    }  // ends reset()
    function tick() {  // tick(): advances the simulation by one clock tick and returns the sentence that describes what happened
      const R = runnable();  // R is the list of LWPs that could run this tick
      const dist = (l) => (l - st.rr + st.nL) % st.nL;  // dist(l): how far LWP l is past the round-robin pointer, so the kernel takes turns fairly
      const chosen = R.slice().sort((a, b) => dist(a) - dist(b)).slice(0, NCPU);  // chosen: the (at most two) runnable LWPs whose turn comes first
      const cpu = [-1, -1];  // cpu will say which LWP each of the two processors runs this tick (-1 means idle)
      chosen.forEach((l) => { const c = st.cpu.indexOf(l); if (c >= 0) cpu[c] = l; });  // first, an LWP that already had a processor keeps the same one, which avoids moving it for no reason
      chosen.forEach((l) => { if (!cpu.includes(l)) cpu[cpu.indexOf(-1)] = l; });  // then each remaining chosen LWP takes a free processor
      const run = cpu.map((l) => {  // run: for each processor, the ULT the thread library runs on that processor's LWP
        if (l < 0) return -1;  // an idle processor runs no ULT
        const us = ultsOf(l); const nxt = us.find((u) => u > st.last[l]);  // us are the LWP's ULTs; nxt is the first one after the ULT this LWP ran last time
        const u = nxt != null ? nxt : us[0];  // if none comes after, it wraps around to the first, so the ULTs of one LWP also take turns
        st.last[l] = u; st.work[u]++; return u;  // remembers the choice for next time, counts one unit of work for that ULT and returns it
      });  // ends the choice of ULTs
      if (chosen.length) st.rr = (chosen[chosen.length - 1] + 1) % st.nL;  // moves the round-robin pointer just past the last LWP chosen
      st.cpu = cpu; st.run = run; st.waiting = R.filter((l) => !chosen.includes(l));  // stores this tick's result and notes the runnable LWPs that did not get a processor
      const asleep = []; for (let l = 0; l < st.nL; l++) if (st.sleep[l]) asleep.push(l);  // asleep lists the LWPs whose kernel threads are sleeping inside a system call
      const busy = run.filter((u) => u >= 0).length;  // busy counts how many processors did useful work this tick
      st.tick++; st.used += busy;  // counts the tick and adds the busy processors to the total processor time used
      const parts = [];  // parts collects one phrase per processor for the message
      cpu.forEach((l, c) => parts.push(l < 0 ? `Processor ${c} is <b>idle</b>` : `Processor ${c} runs ${K(l)} → ${L(l)} → <b>${U(run[c])}</b>`));  // each processor is described as idle, or as running kernel thread → LWP → ULT
      let msg = `<b>Tick ${st.tick}.</b> ${parts.join('; ')}.`;  // the message starts with the tick number and the two processor phrases
      if (st.waiting.length) msg += ` ${list(st.waiting.map(L))} ${st.waiting.length > 1 ? 'are' : 'is'} ready but both processors are taken, so ${st.waiting.length > 1 ? 'they wait' : 'it waits'} (RUN).`;  // adds a sentence about LWPs that were ready but found both processors taken (state RUN)
      if (asleep.length) msg += ` ${list(asleep.map(L))} ${asleep.length > 1 ? 'are' : 'is'} asleep in read().`;  // adds a sentence about LWPs asleep in read()
      if (busy === 2) st.goals.both = true;  // goal reached: both processors busy in the same tick
      if (st.waiting.length) st.goals.more = true;  // goal reached: more ready LWPs than processors
      if (asleep.length && busy) st.goals.survive = true;  // goal reached: the process kept running while one LWP slept
      if (asleep.length && !busy) st.goals.stall = true;  // goal reached: the whole process stalled because every LWP with work was asleep
      const wakes = [];  // wakes collects the sentences for kernel threads that wake up this tick
      asleep.forEach((l) => { st.sleep[l]--; if (!st.sleep[l]) { wakes.push(`${U(st.blocker[l])}'s read() is done: the kernel wakes ${K(l)} (SLEEP → RUN).`); st.blocker[l] = -1; } });  // counts down each sleeping LWP; when it reaches zero the read() is done and its kernel thread wakes (SLEEP to RUN)
      if (wakes.length) msg += ' ' + wakes.join(' ');  // adds the wake-up sentences to the message
      return msg;  // hands the message back to the page
    }  // ends tick()
    function block(l) {  // block(l): the ULT running on LWP l calls read() and must wait; returns a message or an error
      if (l >= st.nL) return null;  // an LWP that does not exist is ignored
      if (st.sleep[l]) return { err: `${L(l)} is already asleep in a system call.` };  // refused if the LWP is already asleep
      const us = ultsOf(l);  // us are the ULTs on this LWP
      if (!us.length) return { err: `${L(l)} has no ULT on it, so nothing can make a system call there.` };  // refused if the LWP has no ULTs, since nothing there could make a call
      const c = st.cpu.indexOf(l);  // c is the processor running this LWP, if any
      // only code that is executing can make a system call: the LWP must be ONPROC right now
      if (c < 0 || st.run[c] < 0) return { err: `${L(l)} is not on a processor right now, so none of its ULTs is executing and none can call read(). Press Next tick until ${K(l)} is ONPROC.` };  // refused unless the LWP is on a processor with a ULT executing, since only running code can call read()
      const u = st.run[c];  // u is the ULT that makes the call
      st.sleep[l] = SLEEP_TICKS; st.blocker[l] = u;  // the kernel thread sleeps for SLEEP_TICKS ticks, and u is remembered as the ULT stuck inside the call
      st.cpu[c] = -1; st.run[c] = -1;  // the processor it was using becomes free
      const stuck = us.filter((x) => x !== u).map(U);  // stuck lists the other ULTs on the same LWP, which cannot run either
      return { msg: `<b>${U(u)} calls read()</b> on ${L(l)} and the data is not ready. The kernel puts ${K(l)} to sleep (ONPROC → SLEEP) for ${SLEEP_TICKS} ticks, and processor ${c} is free for other work.` + (stuck.length ? ` ${list(stuck)} ${stuck.length > 1 ? 'are' : 'is'} also on ${L(l)}, so ${stuck.length > 1 ? 'they wait' : 'it waits'} too.` : '') + (st.nL > 1 ? ' Other LWPs are not affected.' : ' It is the only LWP, so the whole process now waits.') };  // the message: who called read(), that the kernel thread went to sleep, and who else waits; whether other LWPs carry on
    }  // ends block()
    function move(u) {  // move(u): the thread library moves ULT u to the next LWP; returns a message or an error
      const from = st.map[u];  // from is the LWP the ULT is on now
      if (st.blocker[from] === u) return { err: `${U(u)} is inside a read() call on ${L(from)}. It cannot leave until the call returns.` };  // refused while the ULT is inside a read() call, since it cannot leave until the call returns
      if (st.nL === 1) return { err: `There is only one LWP. Add an LWP first, then move ${U(u)} onto it.` };  // refused when there is only one LWP to be on
      const to = (from + 1) % st.nL;  // to is the next LWP, wrapping back to LWP 1 after the last
      st.map[u] = to;  // reassigns the ULT
      const c = st.run.indexOf(u);  // c is the processor running this ULT, if any
      if (c >= 0) { st.run[c] = -1; st.cpu[c] = -1; }  // if it was running, that processor is cleared, since the ULT has moved away
      return { msg: `The library now runs ${U(u)} on ${L(to)} instead of ${L(from)}.` };  // the message: the ULT now runs on the new LWP
    }  // ends move()
    function addL() {  // addL(): creates one more LWP
      if (st.nL >= MAXL) return { err: `This lab stops at ${MAXL} LWPs.` };  // refused once the lab's maximum is reached
      const l = st.nL++; st.sleep[l] = 0; st.blocker[l] = -1; st.last[l] = -1;  // the new LWP starts awake, with no blocked ULT and no ULT run yet
      return { msg: `${L(l)} is created, and with it exactly one kernel thread, ${K(l)}. Click ULTs to move work onto it.` };  // the message: every LWP comes with exactly one kernel thread
    }  // ends addL()
    function remL() {  // remL(): destroys the last LWP
      if (st.nL <= 1) return { err: 'A running process keeps at least one LWP.' };  // refused when only one is left, since a running process keeps at least one LWP
      const l = st.nL - 1;  // l is the last LWP
      if (st.sleep[l]) return { err: `${L(l)} is asleep inside a system call. Wait for it to wake before removing it.` };  // refused while it sleeps inside a system call
      const moved = ultsOf(l); moved.forEach((u) => { st.map[u] = 0; });  // moves its ULTs back to LWP 1
      const c = st.cpu.indexOf(l); if (c >= 0) { st.cpu[c] = -1; st.run[c] = -1; }  // frees the processor it was using, if any
      st.nL--; st.rr %= st.nL;  // removes it and keeps the round-robin pointer in range
      return { msg: `${L(l)} and its kernel thread ${K(l)} are destroyed together.` + (moved.length ? ` ${list(moved.map(U))} ${moved.length > 1 ? 'move' : 'moves'} to LWP 1.` : '') };  // the message: the LWP and its kernel thread go away together, and where its ULTs went
    }  // ends remL()
    reset();  // starts the simulator in its starting situation
    return { st, reset, tick, block, move, addL, remL, ultsOf, runnable };  // hands the page the state and the actions it can call
  }  // ends makeMapSim()

  /* ---- Steps 4 and 5: the process structure and the LWP data structure ---- */
  const SHARED = [  // SHARED: the fields of the process structure that all LWPs share, each with a key, name, example value, meaning and reason
    { k: 'pid', n: 'Process ID', v: '812', what: 'The number that names this process in system calls and tools such as ps and kill.', why: 'A process has one identity, however many LWPs it contains.' },  // field: process ID, the one identity of the whole process
    { k: 'uid', n: 'User IDs', v: 'uid 1001, gid 20', what: 'Which user (and group) the process works for. The kernel checks them before it allows file access and other actions.', why: 'Permissions belong to the program as a whole, not to one flow of execution.' },  // field: user and group IDs, which the kernel checks for permissions
    { k: 'sdt', n: 'Signal dispatch table', v: 'INT→on_quit', what: 'For each kind of signal, what to do when it arrives: ignore it, take the default action, or call a handler function.', why: 'A handler is installed once for the process, and every LWP shares that choice.' },  // field: signal dispatch table, what the process does for each kind of signal
    { k: 'mm', n: 'Memory map', v: 'code, heap, stacks', what: 'Which regions of the address space are in use (code, data, heap, stacks, libraries) and what backs each one.', why: 'All threads share one address space, so there is only one map.' },  // field: memory map, one map because all threads share one address space
    { k: 'fd', n: 'File descriptors', v: '0, 1, 2, 3', what: 'The table of open files, pipes and network connections, each named by a small number (here 3 is data.csv).', why: 'A file opened by one thread can be used by all of them.' },  // field: file descriptors, the open files every thread can use
  ];  // closes the SHARED list
  const PERLWP = [  // PERLWP: the fields kept separately in each LWP; v holds example values for LWP 1 and LWP 2
    { k: 'lwpid', n: 'LWP identifier', v: ['1', '2'], what: 'Names this LWP inside its process.', why: 'The process has several LWPs and must tell them apart.' },  // field: LWP identifier, which tells the LWPs of one process apart
    { k: 'pri', n: 'Priority', v: ['59', '30'], old: '59', oldWhat: 'The scheduling priority of the process, which the kernel uses to decide when it runs.', what: 'The scheduling priority of this LWP, and so of the kernel thread that supports it.', why: 'The kernel schedules each LWP on its own, so each needs its own priority.' },  // field: priority; "old" and "oldWhat" describe the same field in the traditional one-thread process
    { k: 'mask', n: 'Signal mask', v: ['INT blocked', 'none'], old: 'INT blocked', oldWhat: 'Tells the kernel which signals the process will accept right now; a blocked (masked) signal waits.', what: 'Tells the kernel which signals this LWP will accept right now.', why: 'One LWP may accept Ctrl+C (SIGINT) while the others block it, so each needs its own mask.' },  // field: signal mask, separate so one LWP can accept Ctrl+C while others block it
    { k: 'regs', n: 'Saved user registers', short: 'Saved registers', v: ['PC=4012a0', 'PC=401f88'], old: 'PC=4012a0', oldWhat: 'The register values (program counter, stack pointer and the rest) of the process\'s single flow of execution, saved while it is not running.', what: 'The user-level register values (program counter, stack pointer and the rest), saved while this LWP is not running.', why: 'Each LWP is at its own place in the program.' },  // field: saved user registers, since each LWP is at its own place in the program; "short" is a shorter label for tight spots
    { k: 'kstack', n: 'Kernel stack', v: ['read(3,…)', 'empty'], old: 'read(3,…)', oldWhat: 'The stack the process uses while it runs inside the kernel, holding each system call\'s arguments, results and error code.', what: 'The stack this LWP uses inside the kernel. For each call level it holds the system call\'s arguments, results and error code.', why: 'Two LWPs can be inside two different system calls at the same time.' },  // field: kernel stack, since two LWPs can be inside two different system calls at once
    { k: 'usage', n: 'Resource usage and profiling data', short: 'Usage + profiling', v: ['CPU 1.20 s', 'CPU 0.35 s'], what: 'How much processor time and other resources this LWP has used, plus data for profiling tools.', why: 'Accounting per LWP shows which flow of execution used what.' },  // field: resource usage and profiling data, which has no counterpart in the traditional layout
    { k: 'kptr', n: 'Pointer to kernel thread', short: '→ kernel thread', v: ['K1', 'K2'], what: 'Links the LWP to the one kernel thread that supports it.', why: 'Exactly one kernel thread backs each LWP, and the kernel schedules that thread.' },  // field: pointer to the one kernel thread that backs this LWP
    { k: 'pptr', n: 'Pointer to process structure', short: '→ process', v: ['process 812', 'process 812'], what: 'Links the LWP back to its process.', why: 'The LWP keeps only per-execution state; it reaches the shared memory map, files and signal table through this pointer.' },  // field: pointer back to the process structure, through which the LWP reaches the shared fields
  ];  // closes the PERLWP list

  /* ---- Step 6: Solaris kernel-thread states (simplified) ---- */
  const TSTATE = {  // TSTATE: the kernel-thread states drawn in step 6, each with its position in the drawing, colour name and description
    RUN: { x: 120, y: 200, col: 'warn', d: 'Runnable: ready to execute and waiting for the dispatcher to give it a processor.' },  // RUN: ready and waiting for a processor, drawn in the caution colour
    ONPROC: { x: 400, y: 200, col: 'ok', d: 'Executing on a processor right now.' },  // ONPROC: executing on a processor now, drawn in green
    SLEEP: { x: 260, y: 342, col: 'accent', d: 'Blocked: waiting for an event, such as the data a system call asked for.' },  // SLEEP: blocked waiting for an event, drawn in the accent colour
    STOP: { x: 260, y: 58, col: 'bad', d: 'Stopped: its process has been stopped (for example by a debugger). It does nothing until continued.' },  // STOP: stopped, for example by a debugger, drawn in red
    ZOMBIE: { x: 600, y: 200, col: 'muted', d: 'Terminated: the thread has exited, but its leftovers have not been collected yet.' },  // ZOMBIE: exited but not yet cleaned up, drawn muted
    FREE: { x: 600, y: 342, col: 'muted', d: 'Resources released. The thread only waits to be removed from the kernel\'s thread data structure.' },  // FREE: resources released, waiting to be removed from the kernel's table, drawn muted
    PINNED: { x: 580, y: 58, col: 'intr', d: 'Not one of the six states: a running thread held in place on its processor while an interrupt thread borrows it. Its context is saved and it cannot move to another processor.' },  // PINNED: not a real state, a running thread held on its processor while an interrupt thread borrows it
  };  // closes the TSTATE table
  const TEVENTS = [  // TEVENTS: the events the student can apply, each with its state change, the success text and the refusal text
    { k: 'dispatch', label: 'dispatch', from: 'RUN', to: 'ONPROC', ok: 'The dispatcher picks this thread and gives it a processor.', bad: 'Only a RUN (ready) thread can be dispatched.' },  // dispatch: RUN to ONPROC
    { k: 'preempt', label: 'preempt', from: 'ONPROC', to: 'RUN', ok: 'A higher-priority thread became runnable, so this one loses the processor. It is still ready, so it goes back to RUN.', bad: 'Only a running (ONPROC) thread can be preempted.' },  // preempt: ONPROC back to RUN when a higher-priority thread becomes runnable
    { k: 'quantum', label: 'quantum ends', from: 'ONPROC', to: 'RUN', ok: 'Its <span class="t">quantum</span> (time slice) is used up. Time slicing sends it back to RUN so other threads get a turn.', bad: 'Only a running (ONPROC) thread is using up a quantum.' },  // quantum ends: ONPROC back to RUN when the time slice is used up
    { k: 'yield', label: 'yield', from: 'ONPROC', to: 'RUN', ok: 'The thread gives up the processor voluntarily but stays ready (RUN).', bad: 'Only a running (ONPROC) thread can yield the processor.' },  // yield: ONPROC back to RUN when the thread gives up the processor on its own
    { k: 'sleep', label: 'blocking call', from: 'ONPROC', to: 'SLEEP', ok: 'It calls read() and the data is not there yet. It must wait for the service, so it blocks: SLEEP.', bad: 'Only a running (ONPROC) thread can make a system call.' },  // blocking call: ONPROC to SLEEP when read() must wait for data
    { k: 'wakeup', label: 'wakeup', from: 'SLEEP', to: 'RUN', ok: 'The event it waited for happened. It is runnable again, but it must wait for a processor: RUN, not ONPROC.', bad: 'Wakeup only applies to a sleeping (SLEEP) thread.' },  // wakeup: SLEEP to RUN, not straight to ONPROC
    { k: 'stop', label: 'stop', from: 'ONPROC', to: 'STOP', ok: 'Its process is stopped (say, by a debugger). The thread notices the stop request while it runs and stops itself.', bad: 'In Solaris a thread stops itself: a stop request is only noted until the thread next runs (a sleeping thread may be woken so it can do this). Get it to ONPROC first, then press stop.' },  // stop: ONPROC to STOP; the refusal explains that a thread stops itself only when it next runs
    { k: 'cont', label: 'continue', from: 'STOP', to: 'RUN', ok: 'The process is continued. The thread becomes runnable and waits for a processor.', bad: 'Only a stopped (STOP) thread can be continued.' },  // continue: STOP to RUN
    { k: 'exit', label: 'exit', from: 'ONPROC', to: 'ZOMBIE', ok: 'The thread executes exit and terminates. Its records stay behind for now: it is a <span class="t">zombie thread</span> (ZOMBIE).', bad: 'A thread ends by executing exit, so it must be running (ONPROC).' },  // exit: ONPROC to ZOMBIE, since a thread ends by running exit
    { k: 'reap', label: 'reap', from: 'ZOMBIE', to: 'FREE', ok: 'The kernel <span class="t" data-t="reap">reaps</span> the zombie: its resources are released. It is FREE, waiting only to be removed from the thread data structure.', bad: 'Only a ZOMBIE thread can be reaped.' },  // reap: ZOMBIE to FREE once the kernel collects the leftovers
    { k: 'intr', label: 'interrupt arrives', from: 'ONPROC', to: 'PINNED', ok: 'An interrupt is delivered to this processor. The thread is <span class="t" data-t="pinned thread">pinned</span>: context saved, held on this processor while an interrupt thread runs.', bad: 'An interrupt pins whatever thread is running on that processor, and this thread is not running.' },  // interrupt arrives: ONPROC to PINNED while an interrupt thread uses the processor
    { k: 'intrdone', label: 'interrupt done', from: 'PINNED', to: 'ONPROC', ok: 'The interrupt thread finished. The pinned thread is unpinned and resumes exactly where it stopped.', bad: 'Nothing is pinned, so there is no interrupt to finish.' },  // interrupt done: PINNED back to ONPROC, resuming exactly where it stopped
  ];  // closes the TEVENTS list


  Guide.section({  // registers this section with the guide shell, which builds its pages from the object below
    id: '4.5',  // the section number, used in page addresses and the table of contents
    title: 'Solaris Thread and SMP Management',  // the section's full title shown at the top of each of its pages
    short: 'Solaris threads',  // a shorter title used in tight spaces such as the chapter list on the home page
    summary: 'Solaris maps user threads to lightweight processes and kernel threads, tracks states, runs interrupt threads.',  // one-sentence summary shown next to the section on its chapter's overview page
    objectives: [  // objectives: what the student should be able to do after this section, listed in the printable notes
      'Describe the four thread-related entities in Solaris (process, user-level threads, lightweight processes and kernel threads) and trace how work flows from one to the next and onto a processor.',  // objective 1: the four thread-related entities and how work flows from one to the next
      'Explain why Solaris uses three levels of thread and what that gives both the application and the operating system.',  // objective 2: why there are three levels of thread and what each side gains
      'Compare the traditional UNIX process structure with the Solaris one, and list what each LWP data structure holds.',  // objective 3: the traditional versus the Solaris process structure, and what each LWP holds
      'Trace a kernel thread through the RUN, ONPROC, SLEEP, STOP, ZOMBIE and FREE states, naming the event behind each move.',  // objective 4: tracing a kernel thread through its six states
      'Explain how Solaris turns interrupts into interrupt threads, what pinning means, and why this costs less than blocking interrupts.',  // objective 5: interrupt threads, pinning, and why they are cheaper than blocking interrupts
    ],  // closes the objectives list
    terms: [  // terms: the glossary entries for this section, each as [term, definition]; marked words on the pages link to them
      ['User-level thread (ULT)', 'A thread that is created, scheduled and switched entirely by a thread library inside the application. The kernel does not know it exists; it sees only the process that contains it (in Solaris, the LWPs the thread runs on).'],  // glossary entry: defines a user-level thread (ULT)
      ['Solaris lightweight process (LWP)', 'In Solaris, a kernel-supported carrier between user-level threads and the kernel. The thread library treats each LWP like a virtual processor that runs one ULT at a time; every LWP is backed by exactly one kernel thread, and the kernel schedules each LWP independently, so several can run in parallel on different processors.'],  // glossary entry: defines a Solaris lightweight process (LWP)
      ['Kernel thread', 'The basic unit the Solaris kernel schedules and dispatches onto a processor. Every LWP has exactly one; other kernel threads work only inside the kernel, for example to handle interrupts.'],  // glossary entry: defines a kernel thread
      ['Blocking system call', 'A system call that cannot finish right away (for example, a read whose data is still on the disk), so the caller is put to sleep until the event it needs happens.'],  // glossary entry: defines a blocking system call
      ['Process identifier (PID)', 'A unique number the OS gives each process so it can tell it apart from every other process, even ones running the same program.'],  // glossary entry: defines a process identifier (PID)
      ['User ID', 'A number that says which user a process is working for. The kernel checks it (and related group IDs) to decide which files and actions the process is allowed.'],  // glossary entry: defines a user ID
      ['Signal dispatch table', 'A per-process table that records, for each kind of signal (a short notice such as Ctrl+C), what should happen when it arrives: ignore it, take the default action, or run a handler function the program installed.'],  // glossary entry: defines a signal dispatch table
      ['Signal mask', 'A set of bits telling the kernel which signals will be accepted right now. A signal that is masked (blocked) waits until the mask changes. A traditional process has one mask; in Solaris each LWP has its own.'],  // glossary entry: defines a signal mask
      ['File descriptor', 'A small whole number a process uses to name one of its open files, pipes or network connections. By convention 0, 1 and 2 are standard input, output and error.'],  // glossary entry: defines a file descriptor
      ['Memory map', 'The kernel\'s record of which regions of a process\'s address space are in use (code, data, heap, stacks, shared libraries) and what memory backs each one.'],  // glossary entry: defines a memory map
      ['Quantum', 'The slice of processor time a thread may use before the scheduler may hand the processor to another ready thread. Also called a time slice.'],  // glossary entry: defines a quantum (time slice)
      ['ONPROC', 'The Solaris kernel-thread state meaning "on a processor": the thread is executing right now.'],  // glossary entry: defines the ONPROC state
      ['Zombie thread', 'A thread that has called exit and finished, but whose leftover records have not been collected yet. Solaris calls this state ZOMBIE.'],  // glossary entry: defines a zombie thread
      ['Reaping (reap)', 'Collecting a finished (zombie) thread\'s leftovers so its resources can be released. The thread is then FREE: it only waits to be removed from the kernel\'s thread data structure.'],  // glossary entry: defines reaping
      ['Pinned thread (pinning)', 'A thread that was running when an interrupt arrived on its processor. It is held on that processor, suspended with its context saved, until the interrupt has been handled; it cannot move to another processor meanwhile.'],  // glossary entry: defines a pinned thread
      ['Interrupt thread', 'A Solaris kernel thread that handles an interrupt. It has its own ID, priority, context and stack, runs at a higher priority than every other kernel thread, and waits in a pool of deactivated threads until an interrupt needs it.'],  // glossary entry: defines an interrupt thread
      ['Critical section', 'A stretch of code that uses shared data (or another shared resource) and must not run at the same time as other code that uses the same data.'],  // glossary entry: defines a critical section
      ['Mutex (mutex lock)', 'A lock that only one thread can hold at a time. A thread that wants it while it is held must wait, and only the thread that locked it may unlock it.'],  // glossary entry: defines a mutex lock
      ['Interrupt priority level (IPL)', 'A processor setting that decides which interrupts may be delivered right now. Raising it holds back lower-level interrupts; lowering it lets them through again.'],  // glossary entry: defines the interrupt priority level (IPL)
      ['Symmetric multiprocessor (SMP)', 'One computer with two or more similar processors that share main memory and the I/O devices, where any processor can run any work, including the kernel itself.'],  // glossary entry: defines a symmetric multiprocessor (SMP)
    ],  // closes the terms list

    css: ` /* css: style rules for this section; the shell adds them to the page, and every rule starts with .sec-4-5 so it only affects these pages */
      .sec-4-5 .step-eyebrow { flex-wrap: wrap; white-space: normal; row-gap: 2px; min-width: 0; } /* lets the small line above each page title wrap, because this section's title is long */
      .sec-4-5 .say { background: var(--panel-2); border: 1px solid var(--line); border-radius: 10px; padding: 9px 12px; font-size: 15px; line-height: 1.45; } /* the narration box: light panel, thin border, rounded corners, comfortable text size */
      .sec-4-5 .say b { color: var(--chc); } /* bold words in the narration box take the current chapter's colour */
      .sec-4-5 .hot { cursor: pointer; outline: none; } /* clickable parts of a drawing show the hand-shaped pointer and no focus outline box */
      .sec-4-5 .hot:hover .fr, .sec-4-5 .hot:focus-visible .fr { stroke-width: 3.5; } /* hovering over or tabbing to a clickable part thickens its outline */
      .sec-4-5 svg.picked .hot:not(.sel) { opacity: .35; } /* once something is picked, the other clickable parts fade so the picked one stands out */
      .sec-4-5 .hot.sel .fr { stroke-width: 4; } /* the picked part gets the thickest outline */
      .sec-4-5 .fld { display: flex; justify-content: space-between; align-items: center; gap: 8px; width: 100%; text-align: left; border: 1px solid var(--line); background: var(--panel); border-radius: 8px; padding: 3px 9px; font-size: 14px; font-weight: 600; cursor: pointer; color: var(--ink); line-height: 1.35; min-height: 29px; } /* a field button in the data structure views: name on the left, value on the right, in a rounded box */
      .sec-4-5 .fld:hover { border-color: var(--chc); } /* hovering over a field button outlines it in the chapter colour */
      .sec-4-5 .fld .v { font-family: var(--mono); font-size: 12.5px; font-weight: 500; color: var(--ink-2); white-space: nowrap; } /* the value on a field button is in the fixed-width code font, a little smaller and lighter */
      .sec-4-5 .fld.on { box-shadow: 0 0 0 2px var(--chc); border-color: var(--chc); } /* the field being inspected gets a chapter-coloured ring */
      .sec-4-5 .fld.moved { border-left: 4px solid var(--thread); } /* fields that moved from the process into each LWP get a thick thread-coloured bar on their left */
      .sec-4-5 .pbox { border: 2px solid var(--proc); background: var(--proc-bg); border-radius: 12px; padding: 8px 10px; } /* the process box: a rounded box in the process colour */
      .sec-4-5 .lbox { border: 2px solid var(--proc); background: var(--panel-2); border-radius: 10px; padding: 6px 8px; display: flex; flex-direction: column; gap: 4px; } /* an LWP box inside it: outlined in the process colour, holding a stack of fields */
      .sec-4-5 .lbox.old { border-color: var(--line-2); border-style: dashed; } /* the old single-thread box is drawn dashed and grey to show it no longer exists in Solaris */
      .sec-4-5 .flip-face.back { font-size: 15.5px; line-height: 1.45; padding: 12px 16px; } /* the back of a flip card in this section: larger text with more padding */
      .sec-4-5 .bh { font-size: 12.5px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: var(--proc); margin-bottom: 4px; } /* a small uppercase heading used above boxes, in the process colour */
    `,  // end of this section's style rules

    steps: [  // steps: the pages of this section, in the order the student sees them
      /* ---------------- 1. Big picture: four layers, click each ---------------- */
      {  // step 1 starts: the four layers between a program and a processor, with a clickable diagram
        title: 'Four layers between your code and a processor',  // page heading for step 1
        kind: 'story',  // "story" puts the label Big Picture above the page heading
        render(el, ctx) {  // render(el, ctx): builds this page when the student opens it; el is the page body and ctx the guide's helpers
          const { h, s } = ctx;  // pulls out the helpers that create page elements (h) and SVG drawing elements (s)
          const LAYERS = {  // LAYERS: what each layer is, its colour, who manages it and who can see it, shown when that layer is clicked
            proc: { name: 'Process', col: 'proc', what: 'The ordinary UNIX process: an address space with the program\'s code and data, a user stack, and a <span class="t">process control block</span> kept by the kernel. It is the container: its memory, open files and signal settings are shared by all its threads.', who: 'The kernel', sees: 'Kernel and program' },  // the process layer: the container whose memory, files and signal settings all its threads share
            ult: { name: 'User-level threads (ULTs)', col: 'thread', what: 'Threads made by a <b>thread library</b> inside the process\'s own address space. They are how the program expresses parallel work, but the kernel cannot see them. In the classic design drawn here, several ULTs share an LWP, so creating or switching ULTs needs no kernel call and is cheap.', who: 'The thread library', sees: 'Only the program' },  // the ULT layer: threads made by a library inside the process, invisible to the kernel and cheap to switch
            lwp: { name: 'Lightweight processes (LWPs)', col: 'proc', what: 'The bridge. An LWP runs one ULT at a time and is backed by <b>exactly one</b> kernel thread. The kernel schedules each LWP on its own, so two LWPs can run at the same moment on two processors. (In Solaris the name means this one structure; section 4.1 used it loosely for any thread.)', who: 'Library (which ULT) and kernel (when)', sees: 'Program and kernel' },  // the LWP layer: the bridge that runs one ULT at a time and is backed by exactly one kernel thread
            kt: { name: 'Kernel threads', col: 'os', what: 'What the kernel actually schedules and dispatches onto a processor: one behind every LWP. Some, like K4, have no LWP at all and do the kernel\'s own work, such as handling interrupts.', who: 'The kernel', sees: 'Only the kernel' },  // the kernel thread layer: what the kernel really schedules; some, like K4, have no LWP
          };  // closes the LAYERS table
          const svg = s('svg', { viewBox: '0 0 620 336', width: '100%', style: { flex: 'none' }, role: 'img', 'aria-label': 'Solaris layers: process with user-level threads, LWPs, kernel threads and two processors' });  // the diagram, 620 by 336 units, with a description for screen readers
          const info = h('div', { class: 'card white', style: { minHeight: '150px' } });  // info is the card under the diagram where the clicked layer is explained
          let pick = null;  // pick is the layer currently selected, or nothing
          const groups = {};  // groups remembers each layer's drawing group so it can be highlighted
          const hot = (key, kids) => {  // hot(key, kids): wraps a layer's shapes in one clickable, keyboard-reachable group that selects that layer
            const g = s('g', { class: 'hot', role: 'button', tabindex: 0, 'aria-label': LAYERS[key].name, onclick: () => choose(key), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(key); } } }, kids);  // the group acts as a button; a click, Enter or Space calls choose() for this layer
            groups[key] = g; return g;  // remembers the group and returns it for drawing
          };  // ends hot()
          const LX = [150, 330, 470];  // LX: the horizontal centres of the three LWPs (and their kernel threads)
          const UX = [[110, 0], [190, 0], [330, 1], [470, 2]];  // UX: each ULT's horizontal centre and the number of the LWP it maps to (U1 and U2 share LWP 1)
          const lbl = (x, y, t, o = {}) => s('text', Object.assign({ x, y, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700 }, o), t);  // lbl(x, y, t, o): a bold centred text label, with optional extra attributes in o
          svg.append(  // adds every part of the diagram
            s('text', { x: 4, y: 14, 'font-size': 12.5, 'font-weight': 800, class: 's-sub', 'letter-spacing': '.07em' }, 'USER SPACE'),  // small caption "USER SPACE" at the top left
            s('text', { x: 4, y: 202, 'font-size': 12.5, 'font-weight': 800, class: 's-sub', 'letter-spacing': '.07em' }, 'KERNEL'),  // small caption "KERNEL" below the dividing line
            s('line', { x1: 0, y1: 184, x2: 620, y2: 184, class: 's-line', 'stroke-dasharray': '6 5', 'stroke-width': 1.2 }),  // a dashed line across the drawing separating user space from the kernel
            hot('proc', [  // the clickable process layer
              s('rect', { x: 70, y: 22, width: 470, height: 162, rx: 14, class: 's-proc fr', 'stroke-width': 2, 'fill-opacity': 0.45 }),  // the large translucent teal box for the process
              s('text', { x: 84, y: 42, 'font-size': 13.5, 'font-weight': 800 }, 'Process: address space, stack, PCB'),  // its title: address space, stack and control block
            ]),  // ends the process layer
            // ULT → LWP mapping lines (drawn under the shapes)
            ...UX.map(([x, l]) => s('line', { x1: x, y1: 100, x2: LX[l], y2: 158, stroke: 'var(--thread)', 'stroke-width': 2 })),  // the lines that show which LWP each ULT maps onto, drawn first so the shapes cover their ends
            hot('ult', [  // the clickable ULT layer
              s('rect', { x: 84, y: 108, width: 442, height: 22, rx: 7, class: 's-thread fr', 'stroke-width': 1.5 }),  // the thread library bar that sits between the ULTs and the LWPs
              lbl(305, 124, 'thread library', { 'font-size': 12.5, style: 'fill:var(--thread)' }),  // its label, in the thread colour
              ...UX.map(([x], i) => s('g', {}, s('circle', { cx: x, cy: 78, r: 19, class: 's-thread fr', 'stroke-width': 2 }), lbl(x, 83, 'U' + (i + 1)))),  // the four ULT circles, labelled U1 to U4
            ]),  // ends the ULT layer
            hot('lwp', LX.map((x, i) => s('g', {}, s('rect', { x: x - 42, y: 158, width: 84, height: 44, rx: 10, class: 's-proc fr', 'stroke-width': 2.5 }), lbl(x, 185, 'LWP ' + (i + 1))))),  // the clickable LWP layer: three teal boxes labelled LWP 1 to LWP 3
            ...LX.map((x) => s('line', { x1: x, y1: 202, x2: x, y2: 226, stroke: 'var(--os)', 'stroke-width': 3 })),  // short thick violet lines joining each LWP to its kernel thread below
            hot('kt', [  // the clickable kernel thread layer
              ...LX.map((x, i) => s('g', {}, s('rect', { x: x - 42, y: 226, width: 84, height: 36, rx: 9, class: 's-os fr', 'stroke-width': 2 }), lbl(x, 249, 'K' + (i + 1)))),  // the three violet kernel thread boxes, K1 to K3
              s('rect', { x: 548, y: 214, width: 68, height: 48, rx: 9, class: 's-os fr', 'stroke-width': 2, 'stroke-dasharray': '5 3' }),  // a dashed box for K4, a kernel thread with no LWP
              lbl(582, 234, 'K4', { 'font-size': 13.5 }), lbl(582, 252, 'no LWP', { 'font-size': 11.5, class: 's-sub' }),  // its labels: "K4" and "no LWP"
            ]),  // ends the kernel thread layer
            s('line', { x1: 150, y1: 262, x2: 200, y2: 290, class: 's-line', 'marker-end': 'url(#arr-cpu)' }),  // arrow from K1 down to processor 0
            s('line', { x1: 330, y1: 262, x2: 400, y2: 290, class: 's-line', 'marker-end': 'url(#arr-cpu)' }),  // arrow from K2 down to processor 1
            lbl(470, 282, 'K3 waits its turn', { 'font-size': 12, class: 's-sub', 'font-weight': 600 }),  // note under K3: it waits its turn because both processors are busy
            s('rect', { x: 130, y: 294, width: 140, height: 38, rx: 9, class: 's-cpu', 'stroke-width': 2 }), lbl(200, 318, 'Processor 0'),  // the box for processor 0 in the CPU blue, with its label
            s('rect', { x: 330, y: 294, width: 140, height: 38, rx: 9, class: 's-cpu', 'stroke-width': 2 }), lbl(400, 318, 'Processor 1'),  // the box for processor 1, with its label
          );  // ends the list of diagram parts
          function paintInfo() {  // paintInfo(): fills the info card for the selected layer, or with instructions when none is selected
            if (!pick) {  // nothing selected yet
              info.innerHTML = '<h4>Click any layer of the diagram</h4><p class="small m0">Follow the lines from top to bottom: <b style="color:var(--thread)">ULTs</b> map onto <b style="color:var(--proc)">LWPs</b>, each LWP has exactly one <b style="color:var(--os)">kernel thread</b>, and the kernel puts kernel threads on <b style="color:var(--cpu)">processors</b>. K4 has no LWP at all.</p>';  // instructions: follow the lines from ULTs to LWPs to kernel threads to processors, each name in its layer's colour
              return;  // stops here
            }  // ends the nothing-selected case
            const L = LAYERS[pick];  // L is the selected layer's data
            info.innerHTML = `<h3 style="color:var(--${L.col})">${L.name}</h3><p class="small" style="margin-bottom:6px">${L.what}</p>${/* the info card: the layer's name in its colour, then its description */''}
              <div class="row xs" style="gap:6px"><span class="chip">Managed by: ${L.who}</span><span class="chip">Visible to: ${L.sees}</span></div>`;  // then two chips: who manages this layer and who can see it
          }  // ends paintInfo()
          function choose(key) {  // choose(key): selects a layer, or unselects it if it was already selected
            pick = pick === key ? null : key;  // toggles the selection
            svg.classList.toggle('picked', !!pick);  // marks the whole drawing as "picked" so the other layers fade
            Object.entries(groups).forEach(([k, g]) => g.classList.toggle('sel', k === pick));  // outlines the selected layer's group and clears the others
            paintInfo();  // refreshes the info card
          }  // ends choose()
          paintInfo();  // shows the instructions when the page opens
          el.append(h('div', { class: 'split l fill' },  // lays the page out in two columns: text on the left, the diagram card on the right
            h('div', { class: 'stack' },  // left column: a stack of paragraphs and boxes
              h('p', { class: 'lead m0', html: 'A program may want hundreds of threads, but the machine has only a few processors. Solaris links them through <b>four layers</b>, each with one job.' }),  // opening paragraph: many threads, few processors, so four layers each with one job
              h('p', { class: 'm0', html: 'Your program creates <span class="t">user-level threads</span>. To execute, a ULT runs on a <span class="t" data-t="Solaris lightweight process">lightweight process</span> (LWP), and every LWP is backed by exactly one <span class="t">kernel thread</span>, the thing the kernel really places on a processor.' }),  // paragraph: ULT runs on an LWP, which is backed by one kernel thread; the marked terms link to the glossary
              h('div', { class: 'callout analogy m0', 'data-label': 'Analogy', html: 'A theatre. The characters in the script are ULTs: the company can invent as many as it likes. Each costume (an LWP) is worn by exactly one actor (a kernel thread), who plays one character at a time. Only actors go on stage (a processor). Stagehands are actors without a costume: kernel threads doing backstage work.' }),  // analogy box: a theatre where characters are ULTs, costumes are LWPs and actors are kernel threads
              h('div', { class: 'callout why m0', 'data-label': 'Why it matters', html: 'The program gets cheap, flexible threads, while the kernel keeps full control of what runs on each processor of a <span class="t" data-t="Symmetric multiprocessor">symmetric multiprocessor</span> (SMP).' })),  // box: why it matters, cheap threads for the program and full control for the kernel on an SMP
            h('div', { class: 'card stack', style: { gap: '10px' } }, svg, info)));  // right column: the diagram and the info card; this closes the layout
        },  // ends render() for step 1
      },  // end of step 1

      /* ---------------- 2. Motivation: who decides what? ---------------- */
      {  // step 2 starts: a sorting game on who decides what, the thread library or the kernel
        title: 'Why three levels of thread? Who decides what',  // page heading for step 2
        kind: 'explore',  // "explore" puts the label Explore above the page heading
        render(el, ctx) {  // render(): builds step 2 when the student opens it
          const { h } = ctx;  // pulls out the helper that creates page elements
          const BEN = [  // BEN: the three benefits of the three-level design, each with a key, colour, name and explanation
            { key: 'flex', col: 'thread', name: 'A clean, flexible interface for the program', txt: 'The program just calls a standard thread library. Its ULTs are cheap to create and switch, and the library picks which ULT each LWP runs.' },  // benefit: a clean, flexible interface for the program
            { key: 'ctrl', col: 'os', name: 'Control for the OS', txt: 'Each LWP is tied to one kernel thread with defined states, so the kernel manages execution: it blocks one LWP without stalling the rest and spreads a process across processors.' },  // benefit: control for the OS
            { key: 'lean', col: 'intr', name: 'Cheaper kernel work', txt: 'The kernel\'s own jobs, such as interrupt handling, run as kernel threads with no LWP instead of as separate kernel processes, so switching among them is a thread switch, not a process switch.' },  // benefit: cheaper kernel work, since kernel jobs run as threads
          ];  // closes the BEN list
          const ITEMS = [  // ITEMS: the tasks to sort, each with the correct decider (0 library, 1 kernel), the benefit it shows and why
            { q: 'Create 400 threads, one for each open network connection.', a: 0, ben: 'flex', why: 'In this many-ULTs-per-LWP design, creating a ULT is a library call inside the process: no system call and no kernel record. That is why a program can afford hundreds of them.' },  // task: create 400 threads; the library does it, cheaply
            { q: 'Switch from one ULT to another ULT on the same LWP.', a: 0, ben: 'flex', why: 'The library saves one ULT\'s registers and loads another\'s, all in user mode. The kernel never notices the switch.' },  // task: switch between ULTs on one LWP; the library does it in user mode
            { q: 'Pick which ULT an idle LWP should run next.', a: 0, ben: 'flex', why: 'The kernel sees only the LWP, never the ULTs on it, so choosing the ULT is the library\'s job.' },  // task: choose the next ULT for an LWP; only the library sees the ULTs
            { q: 'Pick which kernel thread runs on processor 1 right now.', a: 1, ben: 'ctrl', why: 'Only the kernel dispatches kernel threads onto processors, weighing every process on the machine.' },  // task: choose the kernel thread for processor 1; only the kernel dispatches
            { q: 'Put an LWP to sleep because its ULT called read() and the data is not ready.', a: 1, ben: 'ctrl', why: 'The system call enters the kernel, which blocks that LWP\'s kernel thread. The process\'s other LWPs keep running.' },  // task: put an LWP to sleep on a blocking read(); the kernel does it without stalling other LWPs
            { q: 'Run two threads of one program at the same instant on two processors.', a: 1, ben: 'ctrl', why: 'Real parallelism needs two kernel threads (so two LWPs) that the kernel places on two processors.' },  // task: run two threads at once on two processors; the kernel needs two LWPs to do it
            { q: 'Handle a disk interrupt on a thread that has no LWP.', a: 1, ben: 'lean', why: 'The kernel runs its own work on kernel threads without LWPs. Switching to such a thread is a cheap thread switch inside the kernel, far lighter than switching to a separate kernel process.' },  // task: handle a disk interrupt on a thread without an LWP; the kernel does it with a cheap thread switch
          ];  // closes the ITEMS list
          const WHO = ['Thread library (in the process)', 'Kernel'];  // WHO: the two possible answers, shown as the button labels
          let i = 0, res = [];  // i is the task being asked and res records each answer's result
          const counter = h('h4', { class: 'm0' });  // counter is the heading that says which decision this is
          const qEl = h('div', { style: { fontSize: '19px', fontWeight: 650, lineHeight: 1.4, minHeight: '54px' } });  // qEl shows the task to decide on, in large text with a fixed minimum height so the layout does not jump
          const btns = WHO.map((w, k) => h('button', { class: 'btn ' + (k ? 'os' : 'thread'), type: 'button', onclick: () => answer(k) }, w));  // the two answer buttons: thread library (thread colour) and kernel (OS violet)
          const fb = h('div', { class: 'say', style: { minHeight: '76px' } });  // fb is the narration box where the explanation appears after an answer
          const next = h('button', { class: 'btn primary sm', type: 'button', onclick: () => { if (i < ITEMS.length - 1) { i++; paint(); } else { i = 0; res = []; paint(); } } });  // the Next button: goes to the next decision, or starts the game over after the last one
          const pills = h('div', { class: 'row', style: { gap: '6px' } });  // pills is the row of numbered chips showing the result of each decision
          const benEls = BEN.map((b) => {  // builds one card per benefit, remembering its parts so it can light up later
            const list = h('div', { class: 'xs muted', style: { minHeight: '18px' } });  // list is the small line that says which decisions showed this benefit
            const card = h('div', { class: 'card tight', style: { borderLeft: `5px solid var(--${b.col})`, transition: 'background .3s' } },  // the card has a thick left border in the benefit's colour and fades its background when it lights up
              h('div', { class: 'b', style: { color: `var(--${b.col})` } }, b.name), h('div', { class: 'small', style: { lineHeight: 1.4 } }, b.txt), list);  // inside the card: the benefit's name in its colour, its explanation, and the list line
            return { b, card, list };  // returns the benefit together with its card and list line
          });  // ends building the benefit cards
          function answer(k) {  // answer(k): records the student's answer to the current decision
            if (res[i] != null) return;  // ignored if this decision was already answered
            res[i] = k === ITEMS[i].a;  // stores whether the answer was right
            paint();  // redraws
          }  // ends answer()
          function paint() {  // paint(): redraws the question, buttons, feedback, chips and benefit cards
            const it = ITEMS[i];  // it is the current task
            counter.textContent = `Decision ${i + 1} of ${ITEMS.length}: who makes this call?`;  // heading: "Decision N of 7: who makes this call?"
            qEl.textContent = it.q;  // shows the task text
            const done = res[i] != null;  // done is true once the current decision has an answer
            btns.forEach((b, k) => { b.disabled = done; b.classList.toggle('on', done && k === it.a); });  // disables both buttons after an answer and highlights the correct one
            if (!done) fb.innerHTML = '<span class="muted">Choose the thread library or the kernel. The explanation appears here.</span>';  // before an answer: a hint on what to do
            else fb.innerHTML = `<b style="color:var(--${res[i] ? 'ok' : 'bad'})">${res[i] ? 'Right.' : 'Not quite.'}</b> ${WHO[it.a]} makes this call. ${it.why}`;  // after an answer: right or not quite, who really decides, and why
            next.textContent = i < ITEMS.length - 1 ? 'Next decision →' : 'Start again';  // labels the Next button, "Start again" on the last decision
            next.disabled = !done;  // Next stays disabled until the decision is answered
            pills.replaceChildren(...ITEMS.map((_, k) => h('span', { class: 'chip ' + (res[k] == null ? '' : res[k] ? 'ok' : 'bad'), style: k === i ? { boxShadow: '0 0 0 2px var(--chc)' } : null }, String(k + 1))));  // redraws the numbered chips: green for right, red for wrong, the current one ringed in the chapter colour
            benEls.forEach(({ b, card, list }) => {  // updates each benefit card
              const all = ITEMS.map((x, k) => k).filter((k) => ITEMS[k].ben === b.key);  // all lists the decisions that show this benefit
              const got = all.filter((k) => res[k] != null);  // got lists those already answered
              card.style.background = got.length ? `var(--${b.col}-bg)` : '';  // tints the card with its colour once any of its decisions is answered
              list.textContent = got.length ? `Shown by decision${got.length > 1 ? 's' : ''} ${got.map((k) => k + 1).join(', ')}` + (got.length === all.length ? ' ✓' : ` (${all.length - got.length} more to find)`) : 'Answer the decisions to light this up.';  // the list line: which decisions showed it, a tick when all are found, or how many remain
            });  // ends the benefit card update
          }  // ends paint()
          paint();  // shows the first decision as soon as the page opens
          el.append(h('div', { class: 'split fill' },  // lays the page out in two equal columns
            h('div', { class: 'stack' },  // left column: introduction, the game card and a warning
              h('p', { class: 'lead m0', html: 'Section 4.2 weighed pure user-level threads against pure kernel-level threads. Solaris keeps <b>both</b>, joined by LWPs, so each decision is made by whoever is best placed to make it.' }),  // opening paragraph: Solaris keeps both user-level and kernel-level threads, joined by LWPs
              h('div', { class: 'card white stack', style: { gap: '10px' } }, counter, qEl, h('div', { class: 'row' }, ...btns), fb, h('div', { class: 'row', style: { justifyContent: 'space-between' } }, pills, next)),  // the game card: heading, task, answer buttons, feedback, and a row with the chips and the Next button
              h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: '"The kernel schedules the ULTs." It never sees them. The kernel schedules kernel threads, and so the LWPs they back; which ULT runs on an LWP is up to the library.' })),  // warning box: the kernel never sees ULTs, it schedules kernel threads and so the LWPs
            h('div', { class: 'stack' },  // right column: the benefits
              h('h4', { class: 'm0' }, 'What the three-level design buys'),  // heading "What the three-level design buys"
              ...benEls.map((x) => x.card),  // the three benefit cards
              h('div', { class: 'callout tip m0 small', 'data-label': 'The design in one line', html: 'The library does thread bookkeeping cheaply in user space; the kernel does scheduling, blocking and processors.' }))));  // tip box: the whole design in one line; this closes the layout
        },  // ends render() for step 2
      },  // end of step 2

      /* ---------------- 3. Lab: build the ULT → LWP → kernel thread → processor mapping ---------------- */
      {  // step 3 starts: a lab mapping ULTs onto LWPs and running them on two processors
        title: 'Lab: map threads onto LWPs and run them on 2 CPUs',  // page heading for step 3
        kind: 'lab',  // "lab" puts the label Hands-on Lab above the page heading
        core: true,  // core: true keeps this step on the shorter core path through the guide
        render(el, ctx) {  // render(): builds step 3 when the student opens it
          const { h, s } = ctx;  // pulls out the helpers for page elements (h) and SVG drawing elements (s)
          const sim = makeMapSim(), st = sim.st;  // creates the simulator and keeps a short name for its state
          const svg = s('svg', { viewBox: '0 0 620 358', width: '100%', role: 'img', 'aria-label': 'Five ULTs mapped onto LWPs, each LWP backed by one kernel thread, dispatched onto two processors' });  // the lab drawing, 620 by 358 units, with a description for screen readers
          const UXs = [70, 190, 310, 430, 550];  // UXs: the horizontal centres of the five ULT circles
          const lx = (l) => 20 + (512 / st.nL) * (l + 0.5); // LWPs share x 20..532; the kernel-only thread sits to their right
          const T = (x, y, t, o = {}) => s('text', Object.assign({ x, y, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700 }, o), t);  // T(x, y, t, o): a bold centred text label for the drawing
          const log = h('div', { class: 'log grow', style: { fontFamily: 'var(--font)', fontSize: '14px', maxHeight: '220px', minHeight: '96px' } });  // log is the scrolling list of messages, newest at the top
          const stat = h('span', { class: 'chip accent' });  // stat is the chip that shows the tick count and processor use
          const GOALS = [  // GOALS: the four lab goals, each with the simulator's goal key and its description
            ['both', 'Keep <b>both processors</b> busy with this one process'],  // goal: keep both processors busy with one process
            ['survive', 'Block one LWP while a processor keeps running another'],  // goal: block one LWP while a processor keeps running another
            ['stall', 'Stall the <b>whole process</b> with one blocking call'],  // goal: stall the whole process with one blocking call
            ['more', 'Give it <b>more LWPs than processors</b>, so they take turns'],  // goal: have more LWPs than processors so they take turns
          ];  // closes the GOALS list
          const goalEls = GOALS.map(([k, t]) => h('div', { class: 'row nw small', style: { gap: '8px' } }, h('span', { class: 'chip' }, '·'), h('span', { html: t })));  // one row per goal: a status chip and the description
          const say = (html, bad) => { log.prepend(h('div', { class: 'fade-in', html: bad ? `<span style="color:var(--bad)">✗</span> ${html}` : html })); while (log.children.length > 40) log.lastChild.remove(); };  // say(html, bad): adds a message to the top of the log (with a red X for errors) and keeps only the latest 40
          const act = (r) => { if (!r) return; if (r.err) { say(r.err, true); ctx.toast(r.err.replace(/<[^>]+>/g, '')); } else say(r.msg); draw(); };  // act(r): shows the result of a simulator action: an error goes to the log and a short pop-up, a success to the log, then redraws
          function draw() {  // draw(): rebuilds the whole lab drawing from the simulator state
            const PX = [150, 400]; // processor centres
            const kids = [  // kids collects every shape of the drawing
              s('text', { x: 0, y: 13, 'font-size': 12.5, 'font-weight': 800, class: 's-sub', 'letter-spacing': '.07em' }, 'USER SPACE'),  // caption "USER SPACE" at the top left
              s('rect', { x: 6, y: 20, width: 608, height: 160, rx: 14, class: 's-proc', 'stroke-width': 1.5, 'fill-opacity': 0.35 }),  // the large translucent teal box for process P
              s('text', { x: 606, y: 13, 'text-anchor': 'end', 'font-size': 13, class: 's-sub', 'font-weight': 700 }, 'Process P · click a ULT to move it'),  // its title at the top right, with the hint that ULTs can be clicked
              s('line', { x1: 0, y1: 180, x2: 620, y2: 180, class: 's-line', 'stroke-dasharray': '6 5', 'stroke-width': 1.2 }),  // the dashed line between user space and the kernel
              s('text', { x: 618, y: 198, 'text-anchor': 'end', 'font-size': 12.5, 'font-weight': 800, class: 's-sub', 'letter-spacing': '.07em' }, 'KERNEL'),  // caption "KERNEL" under the line
            ];  // ends the fixed parts of the drawing
            // ULT → LWP lines (the library band is drawn over them: the library routes each ULT to its LWP)
            st.map.forEach((l, u) => kids.push(s('line', { x1: UXs[u], y1: 116, x2: lx(l), y2: 160, stroke: 'var(--thread)', 'stroke-width': st.run.includes(u) ? 4.5 : 2, 'stroke-dasharray': st.blocker[l] === u ? '5 4' : null })));  // one line from each ULT to its LWP: thick when that ULT is running, dashed when it is stuck in read()
            kids.push(s('rect', { x: 18, y: 120, width: 584, height: 19, rx: 6, class: 's-thread', 'stroke-width': 1 }),  // the thread library band drawn over those lines
              T(310, 134, 'thread library: runs each LWP\'s ULTs in turn', { 'font-size': 13, style: 'fill:var(--thread)' }));  // its label: the library runs each LWP's ULTs in turn
            // ULTs
            st.map.forEach((l, u) => {  // draws each ULT
              const running = st.run.includes(u), blocked = st.blocker[l] === u;  // running is true if a processor is running it now; blocked if it is stuck inside read()
              kids.push(s('g', { class: 'hot', role: 'button', tabindex: 0, 'aria-label': `Move U${u + 1} to the next LWP`, onclick: () => act(sim.move(u)), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(sim.move(u)); } } },  // a clickable group that moves this ULT to the next LWP, also from the keyboard
                s('circle', { cx: UXs[u], cy: 54, r: 23, class: blocked ? 's-intr fr' : 's-thread fr', 'stroke-width': running ? 4.5 : 2, 'stroke-dasharray': blocked ? '5 3' : null }),  // the ULT circle: red and dashed when blocked, with a thick outline when running
                T(UXs[u], 59, 'U' + (u + 1), { 'font-size': 15.5 }),  // the ULT's name inside the circle
                T(UXs[u], 95, running ? 'running' : blocked ? 'in read()' : `ran ${st.work[u]}`, { 'font-size': 13, 'font-weight': running || blocked ? 800 : 600, style: `fill:var(--${running ? 'thread' : blocked ? 'intr' : 'muted'})` }),  // under it: "running", "in read()", or how many ticks it has run so far
                T(UXs[u], 111, `on LWP ${l + 1}`, { 'font-size': 12.5, 'font-weight': 600, class: 's-sub' })));  // and which LWP it is on
            });  // ends the ULT loop
            // LWPs + their kernel threads
            for (let l = 0; l < st.nL; l++) {  // draws each LWP and its kernel thread
              const x = lx(l), c = st.cpu.indexOf(l), sleeping = st.sleep[l] > 0, idle = !sim.ultsOf(l).length;  // x is its centre, c the processor running it (if any), sleeping whether it is asleep, idle whether it has no ULTs
              const ls = sleeping ? `asleep (${st.sleep[l]})` : c >= 0 ? 'on a CPU' : idle ? 'no ULTs' : 'ready';  // ls is the LWP's status line: asleep with ticks left, on a CPU, no ULTs, or ready
              const ks = c >= 0 ? 'ONPROC' : sleeping || idle ? 'SLEEP' : 'RUN';  // ks is its kernel thread's state: ONPROC on a processor, SLEEP when asleep or with no work, otherwise RUN
              kids.push(  // adds the LWP's shapes
                s('rect', { x: x - 50, y: 158, width: 100, height: 46, rx: 10, class: sleeping ? 's-panel' : 's-proc', 'stroke-width': c >= 0 ? 3.5 : 2, 'stroke-dasharray': sleeping ? '6 4' : null }),  // the LWP box: grey and dashed while asleep, teal otherwise, with a thick outline when on a processor
                T(x, 177, 'LWP ' + (l + 1)), T(x, 195, ls, { 'font-size': 12.5, 'font-weight': 600, class: 's-sub' }),  // the LWP's name and, under it, its status line
                s('line', { x1: x, y1: 204, x2: x, y2: 216, stroke: 'var(--os)', 'stroke-width': 3 }),  // a short thick violet line joining the LWP to its kernel thread
                s('rect', { x: x - 50, y: 216, width: 100, height: 44, rx: 9, class: 's-os', 'stroke-width': c >= 0 ? 3 : 1.8 }),  // the kernel thread box in violet, with a thicker outline when it is on a processor
                T(x, 234, 'K' + (l + 1)), T(x, 252, ks, { 'font-size': 12.5, 'font-weight': 800, style: `fill:var(--${ks === 'ONPROC' ? 'ok' : ks === 'RUN' ? 'warn' : 'muted'})` }));  // the kernel thread's name and its state, coloured green for ONPROC, caution colour for RUN, muted for SLEEP
              if (c >= 0) kids.push(s('line', { x1: x, y1: 260, x2: PX[c], y2: 290, stroke: 'var(--cpu)', 'stroke-width': 2.5, 'marker-end': 'url(#arr-cpu)' }));  // an LWP on a processor gets a blue arrow down to that processor
            }  // ends the LWP loop
            // a kernel thread that has no LWP
            kids.push(s('rect', { x: 540, y: 210, width: 76, height: 60, rx: 9, class: 's-os', 'stroke-width': 1.8, 'stroke-dasharray': '5 3' }),  // a dashed violet box at the right for a kernel thread that works only inside the kernel
              T(578, 230, 'kernel', { 'font-size': 13 }), T(578, 245, 'only', { 'font-size': 13 }), T(578, 262, 'no LWP', { 'font-size': 12.5, class: 's-sub', 'font-weight': 600 }));  // its labels: "kernel", "only" and "no LWP"
            // processors
            [0, 1].forEach((c) => {  // draws the two processors
              const l = st.cpu[c], x = PX[c];  // l is the LWP this processor runs (or -1), x the processor's centre
              kids.push(s('rect', { x: x - 110, y: 294, width: 220, height: 60, rx: 11, class: l >= 0 ? 's-cpu' : 's-panel', 'stroke-width': 2 }),  // the processor box: CPU blue when busy, grey when idle
                T(x, 318, 'Processor ' + c), T(x, 341, l >= 0 ? `K${l + 1} · LWP ${l + 1} · U${st.run[c] + 1}` : 'idle', { 'font-size': 14, 'font-weight': l >= 0 ? 700 : 600, style: l >= 0 ? 'fill:var(--cpu)' : null, class: l >= 0 ? null : 's-sub' }));  // its name, and under it either the chain kernel thread · LWP · ULT it runs, or "idle"
            });  // ends the processor loop
            svg.replaceChildren(...kids);  // replaces the old drawing with the new shapes
            stat.textContent = `Tick ${st.tick} · processor time used ${st.tick ? Math.round((100 * st.used) / (2 * st.tick)) : 0}%`;  // the status chip: tick number and the share of processor time used so far across both processors
            GOALS.forEach(([k], i) => { const chip = goalEls[i].firstChild; const ok = st.goals[k]; chip.className = 'chip ' + (ok ? 'ok' : ''); chip.textContent = ok ? '✓' : String(i + 1); });  // updates each goal chip: a green tick once reached, otherwise its number
            // only an LWP that is ONPROC has a ULT executing, so only it can make a system call; the others are dimmed but explain why when clicked
            blockRow.replaceChildren(h('span', { class: 'small b' }, 'Running ULT calls read() on:'), ...Array.from({ length: st.nL }, (_, l) => {  // rebuilds the row of read() buttons, one per LWP, after a short label
              const onCpu = st.cpu.indexOf(l) >= 0;  // onCpu is true when this LWP is on a processor right now
              return h('button', { class: 'btn sm intr', type: 'button', disabled: st.sleep[l] > 0, style: onCpu ? null : { opacity: 0.5 }, title: onCpu ? null : 'Not on a processor, so none of its ULTs is executing', onclick: () => act(sim.block(l)) }, 'LWP ' + (l + 1));  // the button is disabled while its LWP sleeps, faded with a tooltip when off a processor, and calls block() when clicked
            }));  // ends the read() buttons
            bAdd.disabled = st.nL >= MAXL; bRem.disabled = st.nL <= 1;  // disables the add and remove buttons at the lab's limits
          }  // ends draw()
          let timer = null;  // timer holds the repeating auto-run timer while it is active
          const bPlay = h('button', { class: 'btn sm', type: 'button', onclick: () => { if (timer) stopPlay(); else { timer = ctx.every(1100, () => { say(sim.tick()); draw(); }); bPlay.textContent = 'Pause'; } } }, 'Auto-run');  // Auto-run button: starts a tick every 1.1 seconds (the guide stops it when the page is left), or pauses if running
          function stopPlay() { if (timer) clearInterval(timer); timer = null; bPlay.textContent = 'Auto-run'; }  // stopPlay(): stops the auto-run timer and restores the button label
          const bAdd = h('button', { class: 'btn sm proc', type: 'button', onclick: () => act(sim.addL()) }, '+ LWP');  // button that adds one LWP
          const bRem = h('button', { class: 'btn sm', type: 'button', onclick: () => act(sim.remL()) }, '− LWP');  // button that removes the last LWP
          const bTick = h('button', { class: 'btn sm primary', type: 'button', onclick: () => { say(sim.tick()); draw(); } }, 'Next tick ▸');  // the main button: advance one tick and redraw
          const bReset = h('button', { class: 'btn sm ghost', type: 'button', onclick: () => { stopPlay(); sim.reset(); log.replaceChildren(); say('Reset: one LWP carries all five ULTs.'); draw(); } }, 'Reset');  // Reset button: stops auto-run, resets the simulator, clears the log and redraws
          const blockRow = h('div', { class: 'row', style: { gap: '6px' } });  // blockRow holds the read() buttons built in draw()
          say('Start: one LWP carries all five ULTs, so this process can use only one processor at a time. Press <b>Next tick</b>.');  // the first log message: one LWP means this process can use only one processor at a time
          draw();  // draws the starting picture
          el.append(h('div', { class: 'split l fill' },  // lays the page out in two columns: instructions, goals and log on the left, the drawing and controls on the right
            h('div', { class: 'stack', style: { gap: '10px' } },  // left column
              h('p', { class: 'm0', html: 'Add <span class="t" data-t="Solaris lightweight process">LWPs</span>, click a ULT to move it, and press <b>Next tick</b> (one slice of time). Each LWP comes with <b>exactly one</b> <span class="t">kernel thread</span>; the kernel puts at most two on the processors. Then make a running ULT do a <span class="t">blocking system call</span>.' }),  // instructions: add LWPs, move ULTs, advance ticks, then make a running ULT block; marked terms link to the glossary
              h('div', { class: 'card tight stack', style: { gap: '5px' } }, h('h4', { class: 'm0' }, 'Goals'), ...goalEls),  // the goals card with its four goal rows
              log,  // the message log
              h('div', { class: 'callout tip m0 small', 'data-label': 'Two versions of Solaris', html: 'Solaris 2 to 8 let many ULTs share fewer LWPs, as in this lab. From Solaris 9 on, every ULT gets its own LWP (one-to-one). The layers and the one-kernel-thread-per-LWP rule are the same in both.' })),  // tip box: older Solaris versions shared LWPs among ULTs as in this lab; later ones give every ULT its own LWP
            h('div', { class: 'stack', style: { gap: '8px' } },  // right column
              svg,  // the lab drawing
              h('div', { class: 'row', style: { gap: '6px' } }, bAdd, bRem, bTick, bPlay, bReset, h('span', { class: 'grow' }), stat),  // the control row: add, remove, next tick, auto-run, reset, a spacer, then the status chip
              blockRow,  // the row of read() buttons
              h('div', { class: 'row xs muted', style: { gap: '6px 14px' } },  // a legend row of small muted text
                h('span', { html: '<b style="color:var(--ok)"><span class="t">ONPROC</span></b> on a processor' }),  // legend: ONPROC in green means on a processor
                h('span', { html: '<b style="color:var(--warn)">RUN</b> ready, waiting for a processor' }),  // legend: RUN in the caution colour means ready and waiting for a processor
                h('span', { html: '<b>SLEEP</b> blocked (or nothing to do)' }),  // legend: SLEEP means blocked, or nothing to do
                h('span', { html: 'Thick line = the ULT running right now' })))));  // legend: a thick line marks the ULT running right now; this closes the layout
        },  // ends render() for step 3
      },  // end of step 3

      /* ---------------- 4. Compare: traditional UNIX process vs Solaris process ---------------- */
      {  // step 4 starts: comparing the traditional UNIX process structure with the Solaris one
        title: 'Process structure: traditional UNIX vs Solaris',  // page heading for step 4
        kind: 'compare',  // "compare" puts the label Compare above the page heading
        render(el, ctx) {  // render(): builds step 4 when the student opens it
          const { h } = ctx;  // pulls out the helper that creates page elements
          const OLDNAME = { pri: 'Priority', mask: 'Signal mask', regs: 'Registers', kstack: 'Stack' };  // OLDNAME: the shorter names these fields had in the traditional process structure
          let mode = 'trad', sel = null;  // mode is the view shown (traditional or Solaris) and sel the field being inspected
          const left = h('div', { class: 'stack fill', style: { gap: '8px' } });  // left is the area that holds the structure diagram
          const insp = h('div', { class: 'card white stack grow', style: { gap: '6px' } });  // insp is the inspector card that explains the clicked field
          const seg = ctx.ui.seg([{ value: 'trad', label: 'Traditional UNIX' }, { value: 'sol', label: 'Solaris' }], mode, (v) => { mode = v; draw(true); });  // two-way switch between the traditional and Solaris views; switching redraws with a short flash
          const WHERE = {  // WHERE: for each place a field can live, its chip colour and a description
            shared: ['proc', 'Process structure: one copy, shared by every LWP'],  // shared: in the process structure, one copy for all LWPs
            trad: ['cpu', 'Traditional: processor state, one set per process'],  // trad: the traditional processor state, one set per process
            lwp: ['thread', 'Solaris: one copy inside each LWP structure'],  // lwp: in Solaris, one copy per LWP
          };  // closes the WHERE table
          function inspect(f, where, val) {  // inspect(f, where, val): shows field f, found in place "where" with value val, in the inspector
            sel = f.k;  // remembers which field is selected
            left.querySelectorAll('.fld').forEach((b) => b.classList.toggle('on', b.dataset.k === sel));  // rings the selected field button and clears the others
            const [col, txt0] = WHERE[where];  // picks the chip colour and description for where the field lives
            const txt = where === 'shared' && mode === 'trad' ? 'Process structure: one copy for the whole process' : txt0;  // in the traditional view, shared fields are described simply as belonging to the whole process
            const why = where === 'trad' ? `A traditional process has one flow of execution, so one copy was enough. In Solaris it moves into each LWP: ${f.why.charAt(0).toLowerCase() + f.why.slice(1)}`  // why: for a traditional per-process field, explains that one copy was enough and why Solaris moved it into each LWP
              : where === 'shared' && mode === 'trad' ? `${f.why} Solaris keeps it in the process structure too.` : f.why;  // for a shared field in the traditional view, adds that Solaris keeps it in the process too; otherwise the field's own reason
            insp.innerHTML = `<h3 class="m0">${where === 'trad' ? OLDNAME[f.k] : f.n}</h3><div><span class="chip ${col}">${txt}</span></div>${/* the inspector: the field's name (its old name in the traditional view) and the chip saying where it lives */''}
              <p class="small m0"><b>Holds:</b> ${where === 'trad' ? f.oldWhat : f.what}</p><p class="small m0"><b>Example value:</b> <code>${ctx.util.esc(val)}</code></p><p class="small m0"><b>Why here:</b> ${why}</p>`;  // then what it holds, an example value in code font (with special characters made safe), and why it lives there
          }  // ends inspect()
          const fld = (f, val, where, moved) => h('button', { class: 'fld' + (moved ? ' moved' : '') + (f.k === sel ? ' on' : ''), type: 'button', 'data-k': f.k, onclick: () => inspect(f, where, val) },  // fld(f, val, where, moved): a field button showing name and value; moved fields get the thread-coloured bar
            h('span', {}, where === 'trad' ? OLDNAME[f.k] : f.short || f.n), h('span', { class: 'v' }, val));  // the button's name (old, short or full) and its value
          function draw(flash) {  // draw(flash): rebuilds the structure diagram for the current view
            const shared = h('div', { class: 'grid-2', style: { gap: '5px' } }, ...SHARED.map((f) => fld(f, f.v, 'shared')));  // the shared fields as buttons in two columns
            let lower;  // lower will hold the part below the shared fields, which differs between the two views
            if (mode === 'trad') {  // the traditional view
              lower = [h('div', { class: 'lbox', style: { borderColor: 'var(--cpu)' } },  // one box with the single set of processor state fields, outlined in CPU blue
                h('div', { class: 'bh', style: { color: 'var(--cpu)' } }, 'Processor state: one set for the whole process'),  // its heading: one set for the whole process
                h('div', { class: 'grid-2', style: { gap: '5px' } }, ...PERLWP.filter((f) => f.old).map((f) => fld(f, f.old, 'trad', true)))),  // only the fields that existed in the old layout, with their old values, marked as moved
              h('div', { class: 'lbox old grow', style: { justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '14px 24px' } },  // a dashed grey box below it saying there is no room for a second thread
                h('div', { class: 'b', style: { fontSize: '17px' } }, 'No room for a second flow of execution'),  // its bold message
                h('div', { class: 'small muted', html: 'A second thread would need its own priority, signal mask, registers and stack, but this structure holds only one set. Switch to <b>Solaris</b> to see where they go.' }))];  // its explanation: a second thread would need its own copies, so switch to Solaris
            } else {  // the Solaris view
              lower = h('div', { class: 'grid-2', style: { gap: '8px' } }, ...[0, 1].map((i) => h('div', { class: 'lbox' },  // two LWP boxes side by side
                h('div', { class: 'bh' }, `LWP ${i + 1} structure`),  // each with its heading, "LWP 1 structure" or "LWP 2 structure"
                ...PERLWP.map((f) => fld(f, f.v[i], 'lwp', !!f.old)))));  // and every per-LWP field with that LWP's own value; fields that moved from the process get the bar
            }  // ends the choice between views
            left.replaceChildren(  // replaces the diagram area's contents
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, seg, h('span', { class: 'xs muted', html: '<b style="color:var(--thread)">▌</b> fields that describe one flow of execution' })),  // top row: the view switch and a legend explaining the thread-coloured bar
              h('div', { class: 'pbox stack grow', style: { gap: '6px' } },  // the process box, which fills the remaining height
                h('div', { class: 'bh m0' }, mode === 'trad' ? 'UNIX process structure' : 'Solaris process structure'),  // its heading: UNIX or Solaris process structure
                shared,  // the shared fields at the top of the process box
                mode === 'sol' ? h('div', { class: 'bh m0', style: { marginTop: '2px' } }, 'List of LWP structures, one per LWP') : null,  // in the Solaris view only, a heading for the list of LWP structures
                lower));  // then the lower part chosen above; this closes the process box and the diagram
            if (flash) left.querySelectorAll('.fld.moved').forEach((b) => b.classList.add('flash'));  // when switching views, the fields that moved briefly flash to catch the eye
            if (!sel || !left.querySelector(`.fld[data-k="${sel}"]`)) {  // if no field is selected, or the selected one does not exist in this view
              sel = null;  // clear the selection
              insp.innerHTML = mode === 'trad'  // and show the view's overview text in the inspector instead
                ? '<h4>Traditional UNIX</h4><p class="small m0">A process is exactly one flow of execution, so its structure holds one <b>processor state</b>: one priority, one signal mask, one set of saved registers and one kernel stack. Click any field to inspect it, then switch to <b>Solaris</b>.</p>'  // traditional overview: one flow of execution, so one processor state; click a field, then switch to Solaris
                : '<h4>Solaris</h4><p class="small m0">The process keeps only what all its threads share: <span class="t" data-t="PID">process ID</span>, <span class="t">user IDs</span>, <span class="t">signal dispatch table</span>, <span class="t">memory map</span> and <span class="t">file descriptors</span>. Every field that describes one flow of execution now lives in an <b>LWP structure</b>, and the process holds a list of them. Two new fields link each LWP to its kernel thread and back to its process. Click a field to inspect it.</p>';  // Solaris overview: the five shared fields stay in the process, the rest move into each LWP; the marked terms link to the glossary
            } else {  // otherwise the selected field exists in the new view
              const b = left.querySelector(`.fld[data-k="${sel}"]`); b.click();  // so the code clicks it again, which refreshes the inspector with this view's details
            }  // ends the selection check
          }  // ends draw()
          draw(false);  // draws the traditional view when the page opens, without the flash
          el.append(h('div', { class: 'split r fill' }, left,  // lays the page out in two columns: the structure diagram on the left (wider), the inspector on the right
            h('div', { class: 'stack' },  // right column
              h('p', { class: 'lead m0', html: 'A thread needs its own registers, stack, priority and <span class="t">signal mask</span>. Where does Solaris keep them?' }),  // opening question: where does Solaris keep each thread's registers, stack, priority and signal mask
              insp,  // the inspector card
              h('div', { class: 'callout why m0 small', 'data-label': 'Why it matters', html: 'Moving per-execution state out of the process and into each LWP is what lets one process run in several places at once, each LWP with its own priority, mask and position in the program.' }))));  // box: moving per-execution state into each LWP is what lets one process run in several places at once
        },  // ends render() for step 4
      },  // end of step 4

      /* ---------------- 5. Lab: sort every field into the process or the LWP ---------------- */
      {  // step 5 starts: a sorting game placing each field in the process structure or the LWP structure
        title: 'Sort the fields: process structure or LWP structure?',  // page heading for step 5
        kind: 'lab',  // "lab" puts the label Hands-on Lab above the page heading
        render(el, ctx) {  // render(): builds step 5 when the student opens it
          const { h } = ctx;  // pulls out the helper that creates page elements
          const ALL = [...SHARED.map((f) => ({ f, home: 0 })), ...PERLWP.map((f) => ({ f, home: 1 }))];  // ALL: every field with its correct home, 0 for the process and 1 for each LWP
          const rng = ctx.util.seeded(45);  // a seeded random generator (the same seed gives the same numbers), so the first shuffle is always the same
          let deck, i, res;  // deck is the shuffled order of fields, i the field being asked, res the list of right and wrong answers
          const BIN = ['Process (shared)', 'Each LWP'];  // BIN: the labels of the two answer buttons
          const counter = h('h4', { class: 'm0' });  // counter is the heading that says which field this is
          const name = h('div', { style: { fontSize: '24px', fontWeight: 800, lineHeight: 1.2 } });  // name shows the field's name in large bold text
          const hint = h('div', { class: 'small', style: { minHeight: '64px' } });  // hint shows what the field holds
          const btns = BIN.map((b, k) => h('button', { class: 'btn lg ' + (k ? 'thread' : 'proc'), type: 'button', style: { flex: 1 }, onclick: () => place(k) }, b));  // the two big answer buttons, process (teal) and each LWP (thread colour), sharing the row equally
          const fb = h('div', { class: 'say', style: { minHeight: '96px' } });  // fb is the narration box for the answer's explanation
          const score = h('span', { class: 'chip accent' });  // score shows how many answers were right so far
          const again = h('button', { class: 'btn sm', type: 'button', onclick: () => { start(); } }, 'Shuffle and restart');  // button that reshuffles the fields and starts again
          const bins = [0, 1].map((k) => h('div', { class: 'stack', style: { gap: '5px' } }));  // bins are the two lists where placed fields appear
          const binBoxes = [0, 1].map((k) => h('div', { class: k ? 'lbox' : 'pbox', style: { minHeight: '100%', display: 'flex', flexDirection: 'column', gap: '6px', padding: '8px 10px', borderColor: k ? 'var(--thread)' : null } },  // the two bin boxes: a teal process box and a thread-coloured LWP box, each stretched to full height
            h('div', { class: 'bh', style: { color: k ? 'var(--thread)' : null } }, k ? 'Each LWP structure' : 'Process structure'), bins[k],  // each bin's heading, then its list
            h('div', { class: 'small muted center', style: { marginTop: 'auto', paddingTop: '8px', borderTop: '1px dashed var(--line-2)' }, html: k ? 'One copy <b>per LWP</b>.<br>Ask: does it describe <b>one flow of execution</b>?' : 'One copy for the <b>whole process</b>.<br>Ask: is it shared by <b>every thread</b>?' })));  // a hint at the bottom of each bin with the question to ask about a field
          function start() {  // start(): shuffles the fields and resets the game
            deck = ALL.slice();  // copies the list of fields
            for (let j = deck.length - 1; j > 0; j--) { const r = Math.floor(rng() * (j + 1)); [deck[j], deck[r]] = [deck[r], deck[j]]; }  // shuffles it by swapping each position with a random earlier one (the Fisher-Yates shuffle)
            i = 0; res = [];  // starts at the first field with no answers
            bins.forEach((b) => b.replaceChildren(h('div', { class: 'small muted ph', style: { padding: '18px 6px', textAlign: 'center', border: '2px dashed var(--line-2)', borderRadius: '10px' } }, 'Fields you place here appear in this list.')));  // puts a dashed placeholder into each bin
            fb.innerHTML = '<span class="muted">Decide where Solaris keeps this field. Ask: does it describe the <b>whole program</b>, or <b>one flow of execution</b>?</span>';  // the starting hint: does the field describe the whole program or one flow of execution
            paint();  // redraws
          }  // ends start()
          function place(k) {  // place(k): the student puts the current field into bin k
            if (i >= deck.length) return;  // ignored after the last field
            const { f, home } = deck[i];  // f is the field and home its correct bin
            const ok = k === home;  // ok is true when the student picked the right bin
            res.push(ok);  // records the result
            const ph = bins[home].querySelector('.ph'); if (ph) ph.remove();  // removes that bin's placeholder if it is still there
            bins[home].append(h('div', { class: 'fld fade-in', style: { cursor: 'default', minHeight: '33px', fontSize: '15px', borderColor: `var(--${ok ? 'ok' : 'bad'})`, background: `var(--${ok ? 'ok' : 'bad'}-bg)` } },  // adds the field to its correct bin, green if the student was right, red if not
              h('span', {}, f.short || f.n), h('span', { class: 'v', style: { fontFamily: 'var(--font)', fontWeight: 800, color: `var(--${ok ? 'ok' : 'bad'})` } }, ok ? '✓' : '✗ moved here')));  // the entry shows the field's name and a tick, or "moved here" when the student's pick was wrong
            fb.innerHTML = `<b style="color:var(--${ok ? 'ok' : 'bad'})">${ok ? 'Right.' : 'Not quite.'}</b> <b>${f.n}</b> lives in the ${home ? 'LWP structure, one copy per LWP' : 'process structure, shared by every LWP'}. ${f.why}`;  // explains where the field really lives and why
            i++;  // moves to the next field
            paint();  // redraws
          }  // ends place()
          function paint() {  // paint(): updates the counter, field display, score and buttons
            const done = i >= deck.length;  // done is true once every field is placed
            const right = res.filter(Boolean).length;  // right counts the correct answers
            score.textContent = `${right} of ${res.length} right`;  // shows the score
            counter.textContent = done ? 'All 13 fields placed' : `Field ${i + 1} of ${deck.length}`;  // heading: "Field N of 13", or that all fields are placed
            if (done) {  // at the end
              name.textContent = right === deck.length ? 'Perfect sort: 13 of 13!' : `${right} of ${deck.length} right`;  // shows the final result, with a special message for a perfect sort
              hint.innerHTML = 'The rule: the <b>process</b> keeps what the whole program shares (identity, permissions, signal actions, memory, open files). Each <b>LWP</b> keeps what one flow of execution needs, plus links to its kernel thread and its process.';  // and the rule that decides where each field belongs
            } else {  // during the game
              name.textContent = deck[i].f.n;  // shows the current field's name
              hint.innerHTML = `<b>Holds:</b> ${deck[i].f.what}`;  // and what it holds
            }  // ends the choice
            btns.forEach((b) => { b.disabled = done; });  // disables the answer buttons when the game is over
          }  // ends paint()
          start();  // starts the first game as soon as the page opens
          el.append(h('div', { class: 'split l fill' },  // lays the page out in two columns: the question on the left, the two bins on the right
            h('div', { class: 'stack' },  // left column
              h('p', { class: 'm0', html: 'Solaris split the old process structure in two. Sort each of the 13 fields into the half where it now lives.' }),  // instructions: Solaris split the process structure, sort each of the 13 fields
              h('div', { class: 'card white stack', style: { gap: '10px' } }, counter, name, hint, h('div', { class: 'row nw' }, ...btns)),  // the question card: counter, field name, hint and the two answer buttons in one row
              fb,  // the narration box
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, score, again)),  // a row with the score on the left and the restart button on the right
            h('div', { class: 'grid-2', style: { alignItems: 'stretch' } }, ...binBoxes)));  // right column: the two bins side by side, stretched to the same height; this closes the layout
        },  // ends render() for step 5
      },  // end of step 5

      /* ---------------- 6. Lab: drive a kernel thread through its states ---------------- */
      {  // step 6 starts: a lab driving one kernel thread through its states
        title: 'Lab: drive a kernel thread through its states',  // page heading for step 6
        kind: 'lab',  // "lab" puts the label Hands-on Lab above the page heading
        core: true,  // core: true keeps this step on the shorter core path through the guide
        render(el, ctx) {  // render(): builds step 6 when the student opens it
          const { h, s } = ctx;  // pulls out the helpers for page elements (h) and SVG drawing elements (s)
          const SUB = { RUN: 'ready', ONPROC: 'running', SLEEP: 'blocked', STOP: 'stopped', ZOMBIE: 'terminated', FREE: 'awaiting removal', PINNED: 'held for interrupt' };  // SUB: the plain-words subtitle drawn under each state name
          const ARROWS = [  // ARROWS: the arrows of the state drawing, each with the events it stands for, its path and its label positions
            { ev: ['dispatch'], d: 'M187 188 L331 188', lab: [[259, 179, 'dispatch']] },  // arrow: dispatch, from RUN to ONPROC
            { ev: ['preempt', 'quantum', 'yield'], d: 'M333 212 L189 212', lab: [[261, 234, 'preempt, quantum'], [261, 249, 'end or yield']] },  // arrow: preempt, quantum end or yield, from ONPROC back to RUN, with a two-line label
            { ev: ['sleep'], d: 'M372 230 L302 310', lab: [[346, 284, 'blocking call', 'start']] },  // arrow: blocking call, from ONPROC down to SLEEP
            { ev: ['wakeup'], d: 'M218 312 L150 232', lab: [[174, 284, 'wakeup', 'end']] },  // arrow: wakeup, from SLEEP back up to RUN
            { ev: ['stop'], d: 'M372 170 L302 90', lab: [[346, 124, 'stop', 'start']] },  // arrow: stop, from ONPROC up to STOP
            { ev: ['cont'], d: 'M218 88 L150 168', lab: [[174, 124, 'continue', 'end']] },  // arrow: continue, from STOP down to RUN
            { ev: ['intr'], d: 'M445 170 L528 90', lab: [[478, 118, 'interrupt', 'end']] },  // arrow: interrupt, from ONPROC up to PINNED
            { ev: ['intrdone'], d: 'M560 90 L472 170', lab: [[528, 146, 'done', 'start']] },  // arrow: interrupt done, from PINNED back to ONPROC
            { ev: ['exit'], d: 'M467 200 L531 200', lab: [[499, 191, 'exit']] },  // arrow: exit, from ONPROC to ZOMBIE
            { ev: ['reap'], d: 'M600 230 L600 310', lab: [[610, 276, 'reap', 'start']] },  // arrow: reap, from ZOMBIE down to FREE
          ];  // closes the ARROWS list
          let cur, last, path, visited;  // cur is the thread's current state, last the last event, path the history of moves, visited the states seen so far
          const svg = s('svg', { viewBox: '0 0 700 392', width: '100%', role: 'img', 'aria-label': 'Solaris kernel thread state diagram' });  // the state drawing, 700 by 392 units, labelled for screen readers
          const nameEl = h('div', { style: { fontSize: '28px', fontWeight: 850, letterSpacing: '-.01em' } });  // nameEl shows the current state's name in large bold text
          const descEl = h('div', { class: 'small', style: { minHeight: '44px', lineHeight: 1.4 } });  // descEl shows what the current state means
          const fb = h('div', { class: 'say', style: { minHeight: '84px' } });  // fb is the narration box for each event's result
          const trail = h('div', { class: 'row', style: { gap: '4px 5px', fontSize: '13px' } });  // trail shows the recent path of states and events
          const chips = h('div', { class: 'row', style: { gap: '5px' } });  // chips shows which states have been visited
          const evBtns = TEVENTS.map((e) => h('button', { class: 'btn sm', type: 'button', onclick: () => fire(e) }, e.label));  // one button per event in TEVENTS; a click tries that event
          const bNew = h('button', { class: 'btn sm primary', type: 'button', onclick: () => reset() }, 'New thread');  // button that starts a fresh thread
          function reset() { cur = 'RUN'; last = null; path = ['RUN']; visited = new Set(['RUN']); fb.innerHTML = 'A new thread starts in <b>RUN</b>: ready, waiting for a processor. Press an event. Events that cannot happen now are dimmed, but you may try them to see why.'; draw(); }  // reset(): a new thread starts in RUN with a fresh history, a starting message, and the drawing redrawn
          function fire(e) {  // fire(e): tries event e on the thread
            if (cur === 'FREE') { fb.innerHTML = '<b style="color:var(--bad)">Not possible.</b> This thread is gone: it is FREE and about to be removed. Press <b>New thread</b>.'; return; }  // a FREE thread is gone, so nothing more can happen to it
            if (cur === 'PINNED' && e.k !== 'intrdone') { fb.innerHTML = '<b style="color:var(--bad)">Not possible.</b> A pinned thread just waits on its processor. The interrupt thread must finish first (<b>interrupt done</b>).'; return; }  // a PINNED thread can only be released by "interrupt done"
            if (e.from !== cur) { fb.innerHTML = `<b style="color:var(--bad)">Not from ${cur}.</b> ${e.bad}`; return; }  // an event that does not start from the current state is refused with its own explanation
            cur = e.to; last = e.k; path.push(e.label + '|' + cur); visited.add(cur);  // moves to the new state, remembers the event, adds the step to the path and marks the state as visited
            fb.innerHTML = `<b style="color:var(--ok)">${e.from} → ${e.to}.</b> ${e.ok}`;  // confirms the move in green with the event's explanation
            draw();  // redraws
          }  // ends fire()
          function draw() {  // draw(): rebuilds the state drawing, the current-state card, the event buttons, the path and the visited chips
            const kids = [s('path', { d: 'M8 200 L51 200', class: 's-line', 'marker-end': 'url(#arr)' }), s('text', { x: 28, y: 190, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub', 'font-weight': 700 }, 'new')];  // starts with a short arrow into RUN from the left, labelled "new"
            ARROWS.forEach((a) => {  // draws each arrow of the diagram
              const live = TEVENTS.some((e) => a.ev.includes(e.k) && e.from === cur), used = a.ev.includes(last);  // live is true if one of its events can happen from the current state; used if it carried the last move
              kids.push(s('path', { d: a.d, fill: 'none', stroke: used ? 'var(--accent)' : live ? 'var(--ink-2)' : 'var(--line-2)', 'stroke-width': used ? 3.5 : live ? 2.2 : 1.6, 'marker-end': `url(#arr${used ? '-accent' : live ? '' : '-muted'})`, 'stroke-dasharray': a.ev[0].startsWith('intr') ? '6 4' : null }));  // the arrow line: accent and thick if just used, dark if possible now, faint otherwise; the interrupt arrows are dashed
              a.lab.forEach(([x, y, t, anc]) => kids.push(s('text', { x, y, 'text-anchor': anc || 'middle', 'font-size': 13.5, 'font-weight': used || live ? 750 : 600, style: `fill:var(--${used ? 'accent' : live ? 'ink' : 'muted'})` }, t)));  // its labels, coloured and weighted the same way
            });  // ends the arrow loop
            Object.entries(TSTATE).forEach(([k, v]) => {  // draws each state box
              const on = k === cur, pin = k === 'PINNED';  // on is true for the current state; pin marks the PINNED pseudo-state
              kids.push(s('rect', { x: v.x - 65, y: v.y - 28, width: 130, height: 56, rx: 12, class: on ? `s-${v.col === 'muted' ? 'panel' : v.col}` : 's-panel', 'stroke-width': on ? 4 : 1.5, 'stroke-dasharray': pin ? '6 4' : null, style: on && v.col !== 'muted' ? null : on ? 'stroke:var(--ink)' : null }),  // the box: the current state gets its colour and a thick outline, others stay grey; PINNED is dashed
                s('text', { x: v.x, y: v.y - 1, 'text-anchor': 'middle', 'font-size': 17, 'font-weight': 800, style: on ? null : 'fill:var(--ink-2)' }, k),  // the state's name, dimmer when it is not the current state
                s('text', { x: v.x, y: v.y + 17, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub', 'font-weight': 600 }, SUB[k]));  // the plain-words subtitle under the name
            });  // ends the state loop
            svg.replaceChildren(...kids);  // replaces the old drawing with the new shapes
            nameEl.textContent = cur; nameEl.style.color = `var(--${TSTATE[cur].col === 'muted' ? 'ink' : TSTATE[cur].col})`;  // shows the current state's name in its colour (plain ink for the muted ones)
            descEl.textContent = TSTATE[cur].d;  // shows what the current state means
            evBtns.forEach((b, i) => { const e = TEVENTS[i]; const ok = e.from === cur; b.style.opacity = ok ? '' : '.45'; b.classList.toggle('on', ok); });  // event buttons that can happen now are full strength and highlighted; the others are dimmed but still clickable
            const shown = path.slice(-11);  // shown is the last 11 entries of the path
            trail.replaceChildren(...(path.length > 11 ? [h('span', { class: 'muted' }, '…')] : []), ...shown.flatMap((p, i) => {  // redraws the path, starting with "…" if older entries were cut off
              const [lab, st] = p.includes('|') ? p.split('|') : [null, p];  // each entry holds the event label and the resulting state, separated by "|" (the first entry has no event)
              return [lab ? h('span', { class: 'muted xs' }, `→ ${lab} →`) : null, h('span', { class: 'chip ' + (i === shown.length - 1 ? 'accent' : '') }, st)].filter(Boolean);  // draws "→ event →" in small muted text, then the state as a chip; the newest one is highlighted
            }));  // ends the path redraw
            chips.replaceChildren(h('span', { class: 'small b' }, `States visited ${[...visited].filter((x) => x !== 'PINNED').length}/6:`),  // redraws the visited counter, counting the six real states only
              ...['RUN', 'ONPROC', 'SLEEP', 'STOP', 'ZOMBIE', 'FREE', 'PINNED'].map((k) => h('span', { class: 'chip ' + (visited.has(k) ? 'ok' : ''), style: k === 'PINNED' ? { border: '1.5px dashed var(--line-2)' } : null }, (visited.has(k) ? '✓ ' : '') + k)));  // one chip per state, green with a tick once visited; PINNED gets a dashed border because it is a bonus
          }  // ends draw()
          reset();  // starts with a new thread when the page opens
          el.append(h('div', { class: 'split r fill' },  // lays the page out in two columns: drawing on the left (wider), controls on the right
            h('div', { class: 'stack', style: { gap: '8px' } }, svg,  // left column: the drawing
              h('div', { class: 'card tight' }, h('h4', { class: 'm0', style: { marginBottom: '4px' } }, 'Path so far'), trail),  // a card with the path so far
              h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: '"After wakeup the thread runs again." Not yet: wakeup moves it from SLEEP to <b>RUN</b>. It still has to wait for the dispatcher to give it a processor (ONPROC).' })),  // warning box: after wakeup the thread goes to RUN, not straight to ONPROC
            h('div', { class: 'stack', style: { gap: '10px' } },  // right column
              h('div', { class: 'card white', style: { padding: '10px 14px' } }, h('h4', { class: 'm0' }, 'Current state of kernel thread K1'), nameEl, descEl),  // the current-state card for kernel thread K1
              h('div', { class: 'grid-3', style: { gap: '6px' } }, ...evBtns),  // the event buttons in three columns
              fb, chips, h('div', { class: 'row' }, bNew, h('span', { class: 'xs muted', html: 'Goal: visit all six states. Bonus: get pinned and unpinned.' })))));  // narration, visited chips, and a row with the New thread button and the goal; this closes the layout
        },  // ends render() for step 6
      },  // end of step 6

      /* ---------------- 7. Interrupts as threads: animation + cost comparison ---------------- */
      {  // step 7 starts: interrupts handled as threads, with an animation and a cost comparison
        title: 'Interrupts become threads: pin, run, unpin',  // page heading for step 7
        kind: 'explore',  // "explore" puts the label Explore above the page heading
        render(el, ctx) {  // render(): builds step 7 when the student opens it
          const { h, s } = ctx;  // pulls out the helpers for page elements (h) and SVG drawing elements (s)
          function watch(panel) {  // watch(panel): fills the first tab with an animation of one interrupt being handled by an interrupt thread
            const svg = s('svg', { viewBox: '0 0 620 430', width: '100%', role: 'img', 'aria-label': 'An interrupt arrives at processor 0, the running thread is pinned and an interrupt thread from the pool handles it' });  // the animation drawing, 620 by 430 units, described for screen readers
            const T = (x, y, t, o = {}) => s('text', Object.assign({ x, y, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700 }, o), t);  // T(x, y, t, o): a bold centred text label for the drawing
            const thr = (x, y, name, sub, cls, o = {}) => { const w = o.w || 124; return s('g', {}, s('rect', { x, y, width: w, height: 44, rx: 9, class: cls, 'stroke-width': o.sw || 2, 'stroke-dasharray': o.dash || null }),  // thr(x, y, name, sub, cls, o): draws a thread as a rounded box with a name and a subtitle; o can set width, outline and dashes
              T(x + w / 2, y + 19, name, { 'font-size': 14.5 }), T(x + w / 2, y + 36, sub, { 'font-size': 12.5, 'font-weight': 600, class: 's-sub' })); };  // the thread's name and subtitle, centred in the box
            // frame table: what is where in each frame
            const F = [  // F: the eight frames of the animation, saying who is where and what the caption says
              { c0: 'T1', pin: false, it: 'pool', lock: 'T2', w: 'SLEEP', irq: false, cap: '<b>Normal work.</b> Processor 0 runs T1. Processor 1 runs T2, which is adding a request to the disk queue, so T2 holds the queue\'s <span class="t" data-t="mutex">mutex</span> (a lock only one thread can hold). Three interrupt threads wait in a pool, deactivated. Each already has its own ID, priority, context and stack.' },  // frame 1: normal work; T2 holds the disk queue's lock, three interrupt threads wait in the pool
              { c0: 'T1', pin: false, it: 'pool', lock: 'T2', w: 'SLEEP', irq: true, cap: '<b>An interrupt.</b> The disk finishes a transfer and raises an interrupt. The hardware delivers it to one particular processor: processor 0.' },  // frame 2: the disk raises an interrupt that the hardware sends to processor 0
              { c0: null, pin: true, it: 'pool', lock: 'T2', w: 'SLEEP', irq: true, cap: '<b>T1 is pinned.</b> Its context (registers and all) is preserved and it is suspended right where it is. A <span class="t">pinned thread</span> cannot move to processor 1, even if that one became free: it just waits until the interrupt has been handled.' },  // frame 3: T1 is pinned, its context saved, and it cannot move to the other processor
              { c0: 'IT-a', pin: true, it: 'out', lock: 'T2', w: 'SLEEP', irq: false, cap: '<b>An interrupt thread takes over.</b> Processor 0 activates <span class="t">interrupt thread</span> IT-a from the pool, so no thread has to be created. IT-a has a higher priority than every other kernel thread; only a higher-priority interrupt thread could preempt it.' },  // frame 4: interrupt thread IT-a is activated from the pool and runs at top priority
              { c0: 'IT-a', pin: true, it: 'out', lock: 'T2', w: 'SLEEP', irq: false, wait: true, cap: '<b>It must wait for the lock.</b> IT-a needs the disk queue, but T2 on processor 1 holds its mutex. Top priority does not let IT-a skip the lock: like any other thread, it waits until the lock is free. Interrupt threads and ordinary threads share data safely through the same <span class="t">mutual exclusion</span> locks.' },  // frame 5: IT-a must wait for the lock that T2 holds, top priority or not
              { c0: 'IT-a', pin: true, it: 'out', lock: 'IT-a', w: 'RUN', irq: false, cap: '<b>Handle the interrupt.</b> T2 releases the mutex. IT-a acquires it, marks the finished request done, and wakes thread W, which was sleeping until its data arrived (SLEEP → RUN).' },  // frame 6: T2 releases the lock; IT-a takes it, finishes the request and wakes thread W
              { c0: null, pin: true, it: 'pool', lock: 'free', w: 'RUN', irq: false, cap: '<b>Back to the pool.</b> IT-a releases the mutex and finishes. It returns to the pool, deactivated, ready for the next interrupt.' },  // frame 7: IT-a releases the lock and returns to the pool
              { c0: 'T1', pin: false, it: 'pool', lock: 'free', w: 'RUN', irq: false, back: true, cap: '<b>T1 is unpinned.</b> Its saved context is restored and it continues on processor 0 exactly where it stopped. W is runnable and will be dispatched in the normal way.' },  // frame 8: T1 is unpinned and continues exactly where it stopped
            ];  // closes the frame table
            function draw(i) {  // draw(i): rebuilds the drawing for frame i
              const f = F[i];  // f is the frame being drawn
              const sub = { 'font-size': 13, class: 's-sub', 'font-weight': 700, 'text-anchor': 'start' };  // sub: the style shared by the small muted row labels
              const kids = [  // the fixed parts of the drawing
                s('rect', { x: 4, y: 4, width: 300, height: 158, rx: 14, class: 's-cpu', 'stroke-width': 2, 'fill-opacity': 0.5 }), T(18, 28, 'Processor 0', { 'text-anchor': 'start', 'font-size': 15 }),  // the box for processor 0 and its title
                s('rect', { x: 316, y: 4, width: 300, height: 158, rx: 14, class: 's-cpu', 'stroke-width': 2, 'fill-opacity': 0.5 }), T(330, 28, 'Processor 1', { 'text-anchor': 'start', 'font-size': 15 }),  // the box for processor 1 and its title
                T(18, 74, 'running', sub), T(18, 132, 'pinned', sub), T(330, 74, 'running', sub),  // row labels: "running" and "pinned" on processor 0, "running" on processor 1
                thr(424, 44, 'T2', f.lock === 'T2' ? 'holds queue mutex' : 'ONPROC', 's-os', { w: 170 }),  // T2 on processor 1, noting when it holds the queue lock
              ];  // ends the fixed parts
              if (f.c0 === 'T1') kids.push(thr(96, 44, 'T1', f.back ? 'ONPROC again' : 'ONPROC', 's-os', { sw: f.back ? 3.5 : 2, w: 150 }));  // when T1 runs on processor 0, draws it, with a thicker outline after it comes back
              else if (f.c0 === 'IT-a') kids.push(thr(96, 44, 'IT-a', f.wait ? 'waits for mutex' : 'interrupt handler', 's-intr', { sw: 3.5, w: 150 }));  // when IT-a runs there, draws it in the interrupt colour, noting when it waits for the lock
              else kids.push(s('rect', { x: 96, y: 44, width: 150, height: 44, rx: 9, class: 's-muted', 'stroke-dasharray': '5 4' }), T(171, 71, 'switching…', { 'font-size': 12.5, class: 's-sub', 'font-weight': 600 }));  // otherwise processor 0 is between threads: a dashed box saying "switching…"
              if (f.pin) kids.push(thr(96, 102, 'T1', 'context saved', 's-panel', { dash: '6 4', w: 150 }),  // while T1 is pinned, draws it grey and dashed in the pinned row
                s('circle', { cx: 112, cy: 114, r: 6, class: 's-intr', 'stroke-width': 2 }), s('line', { x1: 112, y1: 120, x2: 112, y2: 130, stroke: 'var(--intr)', 'stroke-width': 3 }));  // with a small red pin symbol on it
              else kids.push(s('rect', { x: 96, y: 102, width: 150, height: 44, rx: 9, class: 's-muted', 'stroke-dasharray': '3 5', 'stroke-width': 1.2 }), T(171, 129, 'nothing pinned', { 'font-size': 12, class: 's-sub', 'font-weight': 600 }));  // otherwise the pinned row shows a faint "nothing pinned" box
              // disk + interrupt path
              kids.push(s('rect', { x: 4, y: 206, width: 140, height: 84, rx: 12, class: 's-io', 'stroke-width': 2 }), T(74, 240, 'Disk', { 'font-size': 15 }), T(74, 264, f.irq ? 'transfer done!' : 'working', { 'font-size': 13, 'font-weight': 600, class: 's-sub' }));  // the disk box in the I/O colour, saying "transfer done!" in the frames with an interrupt and "working" otherwise
              if (f.irq) kids.push(s('path', { d: 'M50 204 L50 166', fill: 'none', stroke: 'var(--intr)', 'stroke-width': 4, 'marker-end': 'url(#arr-intr)', class: i === 1 ? 'pulse' : null }), T(60, 190, 'interrupt → CPU 0', { 'text-anchor': 'start', style: 'fill:var(--intr)', 'font-size': 13 }));  // in interrupt frames, a thick red arrow from the disk up to processor 0 (pulsing in frame 2) with the label "interrupt → CPU 0"
              // shared disk queue guarded by a mutex
              const lockCol = f.lock === 'free' ? 'ok' : f.lock === 'T2' ? 'os' : 'intr';  // lockCol: the lock's colour, green when free, violet when T2 holds it, red when IT-a holds it
              kids.push(s('rect', { x: 164, y: 206, width: 262, height: 84, rx: 12, class: 's-panel', 'stroke-width': 2 }),  // the shared disk request queue box
                T(295, 278, 'Disk request queue (shared)'),  // its label under the lock
                s('rect', { x: 180, y: 216, width: 230, height: 38, rx: 8, class: `s-${lockCol}`, 'stroke-width': 2 }),  // the lock itself, coloured by who holds it
                T(295, 241, f.lock === 'free' ? 'mutex: free' : `mutex held by ${f.lock}`, { 'font-size': 14, style: `fill:var(--${lockCol})` }));  // the lock's text: free, or who holds it
              if (f.wait || f.lock === 'IT-a') kids.push(s('path', { d: 'M246 66 L268 66 L268 212', fill: 'none', stroke: 'var(--intr)', 'stroke-width': f.wait ? 2.5 : 3.5, 'stroke-dasharray': f.wait ? '5 4' : null, 'marker-end': 'url(#arr-intr)' }),  // when IT-a waits for or holds the lock, a red line from IT-a down to it, dashed while waiting
                T(276, 190, f.wait ? 'wants the mutex' : 'has the mutex', { 'text-anchor': 'start', 'font-size': 13, style: 'fill:var(--intr)' }));  // with the label "wants the mutex" or "has the mutex"
              // thread W waiting for the disk
              kids.push(thr(442, 222, 'Thread W', f.w === 'SLEEP' ? 'SLEEP: waits for disk' : 'RUN: woken up', f.w === 'SLEEP' ? 's-panel' : 's-ok', { sw: f.w === 'RUN' ? 3 : 1.5, w: 174 }));  // thread W, grey and asleep while it waits for the disk, green once it has been woken up
              // priority ladder
              kids.push(T(4, 326, 'Priority', { 'text-anchor': 'start', 'font-size': 13, class: 's-sub', 'font-weight': 800 }),  // the priority ladder: its title
                s('rect', { x: 4, y: 336, width: 140, height: 34, rx: 7, class: 's-intr', 'stroke-width': 1.5 }), T(74, 358, 'interrupt threads', { 'font-size': 12.5 }),  // top rung: interrupt threads, in the interrupt colour
                s('rect', { x: 4, y: 380, width: 140, height: 34, rx: 7, class: 's-os', 'stroke-width': 1.5 }), T(74, 402, 'other kernel threads', { 'font-size': 12.5 }),  // lower rung: all other kernel threads, in violet
                s('path', { d: 'M152 408 L152 342', fill: 'none', class: 's-line', 'marker-end': 'url(#arr)' }), T(158, 380, 'higher', { 'text-anchor': 'start', 'font-size': 12, class: 's-sub', 'font-weight': 700 }));  // an arrow pointing up labelled "higher", showing that interrupt threads outrank the rest
              // pool of deactivated interrupt threads
              kids.push(s('rect', { x: 216, y: 316, width: 400, height: 110, rx: 12, class: 's-panel', 'stroke-width': 1.5, 'stroke-dasharray': '6 4' }),  // the dashed pool box that holds the deactivated interrupt threads
                T(416, 338, 'Pool of deactivated interrupt threads', { 'font-size': 13.5, class: 's-sub' }));  // the pool's title
              ['IT-a', 'IT-b', 'IT-c'].forEach((n, k) => {  // draws the three interrupt threads in the pool
                const here = k > 0 || f.it === 'pool';  // here is false only for IT-a while it is out working
                const x = 236 + k * 126;  // x is this thread's left edge in the pool
                kids.push(s('rect', { x, y: 352, width: 110, height: 58, rx: 9, class: here ? 's-intr' : 's-muted', 'stroke-width': 1.8, 'stroke-dasharray': here ? null : '4 3' }),  // a thread in the pool is drawn in the interrupt colour; IT-a's empty place is faint and dashed while it is away
                  T(x + 55, 376, here ? n : 'IT-a', { 'font-size': 14.5, class: here ? null : 's-sub' }),  // its name, or a faded "IT-a" for the empty place
                  T(x + 55, 397, here ? 'own ID + stack' : 'out working', { 'font-size': 12.5, class: 's-sub', 'font-weight': 600 }));  // its subtitle: "own ID + stack", or "out working" for the empty place
              });  // ends the pool loop
              svg.replaceChildren(...kids);  // replaces the old drawing with the new shapes
              return f.cap;  // returns this frame's caption for the player to show
            }  // ends draw()
            const player = ctx.ui.player({ count: F.length, render: draw, interval: 3600 });  // creates the step player for the eight frames, 3.6 seconds each when playing
            player.caption.style.minHeight = '150px';  // gives the caption a fixed minimum height so the controls do not jump between frames
            panel.append(h('div', { class: 'split r fill' },  // lays the tab out in two columns: the drawing on the left (wider), player and facts on the right
              h('div', { class: 'card white', style: { padding: '10px 12px', display: 'grid', placeItems: 'center' } }, svg),  // the drawing, centred in a white card
              h('div', { class: 'stack', style: { gap: '10px' } }, player.el,  // right column: the player
                h('div', { class: 'card tight small stack', style: { gap: '6px' } },  // a small card listing what every interrupt thread has
                  h('h4', { class: 'm0' }, 'Every interrupt thread'),  // its heading
                  h('div', { html: '• has its own <b>ID, priority, context</b> (saved registers) <b>and stack</b>' }),  // fact: its own ID, priority, context and stack
                  h('div', { html: '• outranks <b>every other kernel thread</b>' }),  // fact: it outranks every other kernel thread
                  h('div', { html: '• waits <b>deactivated in a pool</b>, so none is created on the spot' }),  // fact: it waits deactivated in a pool, so none is created on the spot
                  h('div', { html: '• uses the same <b>mutex locks</b> as other threads' })))));  // fact: it uses the same mutex locks as other threads; this closes the layout
          }  // ends watch()
          function why(panel) {  // why(panel): fills the second tab, a cost comparison between blocking interrupts and interrupt threads
            let cs = 40, irq = 2, cpus = 4;  // the three slider values: critical sections per millisecond, interrupts per millisecond and processor count
            const COST_IPL = 1, COST_IT = 6;  // the made-up unit costs: 1 per processor to raise and lower the interrupt level, 6 per interrupt thread use
            const bars = h('div', { class: 'stack', style: { gap: '8px' } });  // bars holds the two cost bars
            const verdict = h('div', { class: 'say' });  // verdict holds the sentence that says which approach wins
            const bar = (label, val, max, col, formula) => h('div', { class: 'stack', style: { gap: '3px' } },  // bar(label, val, max, col, formula): one labelled cost bar with its value, a filled meter and the formula under it
              h('div', { class: 'row nw', style: { justifyContent: 'space-between' } }, h('span', { class: 'small b' }, label), h('span', { class: 'mono small b', style: { color: `var(--${col})` } }, `${val} units/ms`)),  // top line: the approach's name on the left and its cost on the right in its colour
              h('div', { class: 'meter', style: { height: '16px' } }, h('i', { style: { width: (max ? (100 * val) / max : 0) + '%', background: `var(--${col})` } })),  // the meter, filled in proportion to the larger of the two costs
              h('div', { class: 'xs muted mono' }, formula));  // the formula that produced the value, in small fixed-width text
            function upd() {  // upd(): recomputes both costs and redraws the bars and verdict; runs whenever a slider moves
              const a = cs * cpus * COST_IPL, b = irq * COST_IT, m = Math.max(a, b, 1);  // a: blocking cost (sections × processors × 1), b: interrupt thread cost (interrupts × 6), m: the larger, for scaling
              bars.replaceChildren(  // replaces the two bars
                bar('Block interrupts around every critical section', a, m, 'bad', `${cs} sections × ${cpus} processor${cpus > 1 ? 's' : ''} × ${COST_IPL} unit`),  // red bar: blocking interrupts around every critical section
                bar('Interrupt threads (pay only when an interrupt happens)', b, m, 'ok', `${irq} interrupts × ${COST_IT} units`));  // green bar: interrupt threads, which cost something only when an interrupt happens
              if (b === 0) verdict.innerHTML = '<b>No interrupts, no extra cost</b> for interrupt threads, while blocking still pays on every single critical section.';  // verdict when there are no interrupts: interrupt threads cost nothing extra
              else if (a > b) verdict.innerHTML = `<b>Interrupt threads cost ${ctx.util.fmt(a / b, 1)}× less here.</b> Shared data is entered far more often than interrupts arrive, so paying per interrupt beats paying per critical section.`;  // verdict when blocking costs more: how many times cheaper interrupt threads are, rounded to 1 decimal
              else if (a === b) verdict.innerHTML = '<b>A tie.</b> Both approaches pay the same here.';  // verdict on a tie
              else verdict.innerHTML = '<b>Here blocking would be cheaper.</b> Interrupt threads pay off when critical sections are much more frequent than interrupts, which is the normal situation in a busy kernel.';  // verdict when blocking is cheaper, with the note that busy kernels usually favour interrupt threads
            }  // ends upd()
            const sl = [  // the three sliders
              ctx.ui.slider({ label: 'Critical sections / ms', min: 5, max: 100, step: 5, value: cs, onInput: (v) => { cs = v; upd(); } }),  // slider: critical sections per millisecond, 5 to 100 in steps of 5
              ctx.ui.slider({ label: 'Interrupts / ms', min: 0, max: 20, value: irq, onInput: (v) => { irq = v; upd(); } }),  // slider: interrupts per millisecond, 0 to 20
              ctx.ui.slider({ label: 'Processors', min: 1, max: 8, value: cpus, onInput: (v) => { cpus = v; upd(); } }),  // slider: number of processors, 1 to 8
            ];  // closes the slider list
            upd();  // computes and draws the starting comparison
            panel.append(h('div', { class: 'split fill' },  // lays the tab out in two equal columns
              h('div', { class: 'stack', style: { gap: '8px' } },  // left column: explanation
                h('p', { class: 'm0', html: 'Interrupt handlers and ordinary kernel code often touch the same data. A traditional kernel protects each <span class="t">critical section</span> (code that uses that data) by raising the <span class="t">interrupt priority level</span> before it and lowering it afterwards, even though most interrupts never touch that data. Every raise and lower costs time.' }),  // paragraph: a traditional kernel raises the interrupt priority level around each critical section, at a cost every time
                h('p', { class: 'm0', html: 'On an <span class="t" data-t="Symmetric multiprocessor">SMP</span> it gets worse: blocking interrupts on one processor does nothing about a handler running on another, so the kernel may have to block them on <b>all</b> processors, and it needs locks anyway.' }),  // paragraph: on an SMP, blocking on one processor does not stop handlers on another, so it is worse
                h('div', { class: 'callout tip m0', 'data-label': 'The Solaris answer', html: 'Make handlers threads. They use the same mutex locks as everything else, so the extra cost appears <b>only when an interrupt actually happens</b>.' }),  // tip box: the Solaris answer, making handlers threads so the cost appears only when interrupts happen
                h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: '"Solaris creates a thread for each interrupt." No: creating a thread would be far too slow. It takes an already-built interrupt thread from the pool and puts it back afterwards.' })),  // warning box: interrupt threads come from a pool, they are not created for each interrupt
              h('div', { class: 'card stack', style: { gap: '10px' } }, ...sl, bars, verdict,  // right column: sliders, bars and verdict
                h('div', { class: 'small', html: '<b>Try:</b> drag <b>Interrupts / ms</b> to 0, then to 20 with <b>Critical sections / ms</b> at 5. Which approach wins in a busy kernel, where shared data is touched constantly?' }),  // a suggestion of slider settings to try
                h('div', { class: 'xs muted', html: 'Illustrative costs, not measurements: raising and lowering the IPL = 1 unit per processor affected; handling one interrupt with an interrupt thread (pin, switch, unpin) = 6 units.' }))));  // a note that the costs are made-up units for illustration; this closes the layout
          }  // ends why()
          el.append(ctx.ui.tabs([{ label: 'Watch an interrupt arrive', render: watch }, { label: 'Why not just block interrupts?', render: why }]));  // puts the two tabs on the page: the animation and the cost comparison
        },  // ends render() for step 7
      },  // end of step 7

      /* ---------------- 8. Recap ---------------- */
      {  // step 8 starts: the recap with flip cards
        title: 'Recap: six things to remember about Solaris threads',  // page heading for step 8
        kind: 'recap',  // "recap" puts the label Recap above the page heading
        render(el, ctx) {  // render(): builds step 8 when the student opens it
          const cards = ctx.ui.flipcards([  // flip cards: the guide helper shows a question on the front and its answer on the back when clicked
              ['The four thread-related concepts', '<div><b>Process</b>: the container (address space, stack, PCB). <b>ULTs</b>: library threads the kernel cannot see. <b>LWPs</b>: the bridge, each mapped to one kernel thread. <b>Kernel threads</b>: what is dispatched onto processors.</div>'],  // card: the four thread-related concepts
              ['How many kernel threads per LWP?', '<div>Always <b>exactly one</b>. The reverse is not true: some kernel threads have <b>no LWP</b> and do the kernel\'s own work, such as handling interrupts.</div>'],  // card: always exactly one kernel thread per LWP, though some kernel threads have none
              ['Why three levels of thread?', '<div>The <b>program</b> gets a clean, cheap threads interface; the <b>OS</b> controls what really runs (and runs LWPs in parallel on several processors); and the kernel\'s own jobs run as LWP-less kernel threads, so switching among them is a <b>thread switch, not a process switch</b>.</div>'],  // card: why three levels of thread
              ['What does each LWP structure hold?', '<div>What a traditional process held only once: <b>priority, signal mask, saved user registers, kernel stack</b>. Plus an <b>LWP ID</b>, <b>usage and profiling data</b>, and pointers to its <b>kernel thread</b> and its <b>process</b>.</div>'],  // card: what each LWP structure holds
              ['The six kernel-thread states', '<div><b>RUN</b> ready · <b>ONPROC</b> running · <b>SLEEP</b> blocked · <b>STOP</b> stopped · <b>ZOMBIE</b> terminated · <b>FREE</b> released, awaiting removal. Preempt, quantum end or yield: ONPROC → RUN.</div>'],  // card: the six kernel-thread states
              ['When an interrupt arrives…', '<div>It goes to one processor. The running thread is <b>pinned</b> (context saved, cannot migrate). A pooled <b>interrupt thread</b> runs at top priority using ordinary mutex locks, then the thread is unpinned.</div>'],  // card: what happens when an interrupt arrives
            ], { cols: 3, height: 228 });  // closes the card list: three columns of cards, each 228 pixels tall
          cards.style.padding = '0 8px'; // room for the 3D flip so a turning card never pokes past the edge
          el.append(ctx.h('div', { class: 'stack fill' },  // lays the page out as a stack that fills the available height
            ctx.h('p', { class: 'lead m0' }, 'Say each answer out loud before you flip the card.'), cards));  // an opening line asking the student to answer aloud before flipping, then the cards
        },  // ends render() for step 8
      },  // end of step 8

      /* ---------------- 9. Quiz ---------------- */
      {  // step 9 starts: the end-of-section quiz
        title: 'Check yourself',  // page heading for step 9
        kind: 'check',  // "check" puts the label Check Yourself above the page heading
        quiz: [  // quiz: the questions; the guide's quiz engine draws them, checks answers and shows feedback
          { q: 'In Solaris, which entity does the kernel actually schedule and dispatch onto a processor?', choices: ['A user-level thread', 'A kernel thread', 'The thread library', 'The process structure'], answer: 1,  // question 1 (multiple choice): what the kernel schedules onto a processor; the answer is a kernel thread
            feedback: ['User-level threads are invisible to the kernel, so it cannot schedule them. It schedules the kernel thread behind the LWP a ULT runs on.', null, 'The thread library is ordinary user-mode code inside the process; it chooses which ULT runs on an LWP, not what runs on a processor.', 'The process structure is a record of shared resources. It is not a unit of execution.'],  // feedback for each wrong choice: ULTs are invisible, the library is user code, the process structure is not a unit of execution
            why: 'Kernel threads are the fundamental entities that can be scheduled and dispatched onto a processor. Each LWP is backed by one, and some exist with no LWP at all.' },  // explanation: kernel threads are what gets dispatched, one behind each LWP and some with no LWP
          { q: 'What is the main reason Solaris uses three levels of thread (user-level threads, LWPs and kernel threads)?', choices: ['Let the OS manage what really runs, while programs keep a simple, flexible threads interface', 'Let the kernel schedule every ULT directly, so no thread library is needed', 'Give every thread its own private address space, so threads cannot corrupt each other', 'Make kernel threads unnecessary on machines with a single processor'], answer: 0,  // question 2 (multiple choice): the main reason for three levels; the answer is OS control plus a simple interface for programs
            feedback: [null, 'The kernel never sees ULTs. The library schedules ULTs onto LWPs; the kernel schedules the kernel threads behind the LWPs.', 'Threads of one process share one address space. That sharing is what makes them cheap and lets them cooperate.', 'Kernel threads are what the kernel dispatches on every machine, including one with a single processor.'],  // feedback for each wrong choice: the kernel never sees ULTs, threads share one address space, kernel threads exist on every machine
            why: 'The levels split the work: a thread library gives the application a clean, cheap interface (ULTs), and each LWP is tied to one kernel thread so the OS controls scheduling, blocking and parallel execution. Kernel threads with no LWP let the kernel run its own jobs with cheap thread switches instead of process switches.' },  // explanation: how the three levels split the work between the library and the kernel
          { type: 'tf', q: 'Every LWP is supported by exactly one kernel thread, and every kernel thread belongs to exactly one LWP.', answer: false,  // question 3 (true or false): one kernel thread per LWP and one LWP per kernel thread; false, because some kernel threads have no LWP
            why: 'The first half is true, the second is not. Some kernel threads have no LWP: they run kernel functions such as interrupt handling.' },  // explanation: the first half is true, the second is not
          { type: 'num', q: 'A Solaris process has 6 user-level threads mapped onto 3 LWPs. How many kernel threads support this process\'s LWPs?', answer: 3, tol: 0, unit: 'kernel threads',  // question 4 (calculate): kernel threads behind 3 LWPs carrying 6 ULTs; the answer is 3
            why: 'There is always exactly one kernel thread per LWP, so 3 LWPs means 3 kernel threads. The number of ULTs does not matter; the kernel never sees them.' },  // explanation: always one kernel thread per LWP, whatever the number of ULTs
          { type: 'num', q: 'A process spreads 5 ULTs over 4 LWPs. The machine has 2 processors and no LWP is blocked. At most how many of the process\'s ULTs can execute at the same instant?', answer: 2, tol: 0, unit: 'ULTs',  // question 5 (calculate): the most ULTs running at once with 4 LWPs and 2 processors; the answer is 2
            why: 'Each LWP runs one ULT at a time, and each LWP runs only when the kernel puts its kernel thread on a processor. With 2 processors, at most 2 kernel threads, so 2 ULTs, run at once.' },  // explanation: each running ULT needs its LWP's kernel thread on a processor, and there are only 2
          { q: 'A process has 3 LWPs, each carrying ULTs. A ULT on LWP 2 calls read() and must wait for the disk. What happens?', choices: ['The whole process blocks until the read finishes', 'LWP 2 and its kernel thread sleep; LWPs 1 and 3 keep running', 'The kernel moves the waiting ULT onto another LWP', 'The library runs another ULT on LWP 2 while the read waits'], answer: 1,  // question 6 (multiple choice): a ULT on LWP 2 blocks in read(); the answer is that only LWP 2 sleeps
            feedback: ['That is what happens with pure user-level threads. Here the kernel blocks only the kernel thread that made the call.', null, 'The kernel cannot see ULTs, and the calling ULT is stuck inside the system call on LWP 2 until it returns.', 'LWP 2 itself is asleep inside the kernel, so nothing can run on it until the call returns. Other ULTs can run only on the other LWPs.'],  // feedback for each wrong choice: the whole process does not block, the kernel cannot move ULTs, and LWP 2 itself is asleep
            why: 'The kernel schedules each LWP independently. A blocking system call puts that one LWP\'s kernel thread to SLEEP; the process\'s other LWPs are unaffected.' },  // explanation: a blocking call puts only that LWP's kernel thread to sleep
          { type: 'bucket', q: 'Where does Solaris keep each item?', buckets: ['Process structure', 'Each LWP structure'],  // question 7 (sort into groups): process structure or each LWP structure
            items: [['Signal dispatch table', 0], ['Signal mask', 1], ['Memory map', 0], ['Kernel stack', 1], ['File descriptors', 0], ['Saved user-level registers', 1]],  // the six items, each with the number of its correct group
            why: 'The process keeps what every thread shares (identity, permissions, signal actions, memory map, open files). Each LWP keeps what one flow of execution needs, plus links to its kernel thread and process. A traditional UNIX process held that per-execution part only once, as a single processor state.' },  // explanation: the process keeps what all threads share, each LWP what one flow of execution needs
          { type: 'match', q: 'Match each kernel-thread state to its meaning.', pairs: [['RUN', 'Runnable, waiting for a processor'], ['ONPROC', 'Executing on a processor'], ['SLEEP', 'Blocked, waiting for an event'], ['STOP', 'Stopped, for example by a debugger'], ['ZOMBIE', 'Terminated, leftovers not yet collected'], ['FREE', 'Resources released, awaiting removal']],  // question 8 (match the pairs): each of the six kernel-thread states with its meaning
            why: 'These six states describe a Solaris kernel thread from ready to fully gone. FREE comes after ZOMBIE, once the thread has been reaped.' },  // explanation: the six states run from ready to fully gone, with FREE after ZOMBIE
          { q: 'A thread in the ONPROC state uses up its quantum. Which state does it move to?', choices: ['SLEEP', 'RUN', 'STOP', 'ZOMBIE'], answer: 1,  // question 9 (multiple choice): where an ONPROC thread goes when its quantum ends; the answer is RUN
            feedback: ['SLEEP is for a thread that must wait for an event, such as a blocking system call. This thread could keep going.', null, 'STOP happens when the thread\'s process is stopped, for example by a debugger.', 'ZOMBIE is for a thread that has exited.'],  // feedback for each wrong choice: SLEEP is for waiting, STOP for a stopped process, ZOMBIE for an exited thread
            why: 'Time slicing takes the processor away, but the thread is still ready to run, so it goes back to RUN. Preemption and yield lead there too.' },  // explanation: the thread is still ready, so it goes back to RUN, as with preemption and yield
          { type: 'order', q: 'Put the handling of an interrupt in Solaris in order.', items: ['The interrupt is delivered to one particular processor', 'The thread running there is pinned and its context saved', 'An interrupt thread is taken from the pool of deactivated threads', 'The interrupt thread runs the handler, taking mutex locks as needed', 'The interrupt thread goes back to the pool', 'The pinned thread is unpinned and resumes'],  // question 10 (put in order): the six steps of handling an interrupt
            why: 'Deliver, pin, activate a pooled interrupt thread, handle (with ordinary locking), return it to the pool, and resume the pinned thread where it stopped.' },  // explanation: deliver, pin, activate a pooled thread, handle with locks, return to the pool, resume
          { type: 'multi', q: 'Which statements about Solaris interrupt threads are true?', choices: ['Each has its own identifier, priority, context and stack', 'They run at a higher priority than all other kernel threads', 'A new thread is created each time an interrupt arrives', 'They synchronize with other kernel threads using mutual exclusion primitives', 'A pinned thread may move to another processor while it waits'], answer: [0, 1, 3],  // question 11 (select all): the three true statements about interrupt threads
            why: 'Interrupt threads are full kernel threads with top priority, kept deactivated in a pool so none is created on demand, and they use ordinary locks. A pinned thread stays on its processor until the interrupt is handled.' },  // explanation: full kernel threads, top priority, pooled rather than created, using ordinary locks; a pinned thread stays put
          { q: 'Why does Solaris handle interrupts with interrupt threads instead of blocking interrupts around shared kernel data?', choices: ['Blocking interrupts is impossible on a single processor', 'The extra cost is paid only when an interrupt occurs, not on every entry to shared kernel data', 'Interrupt threads never need locks, because they run at the highest priority', 'User-level threads can then handle hardware interrupts directly, without entering the kernel'], answer: 1,  // question 12 (multiple choice): why interrupt threads instead of blocking; the answer is paying only when an interrupt occurs
            feedback: ['A single processor can easily block interrupts by raising its interrupt priority level; the problem is the cost of doing it on every access to shared data.', null, 'Top priority does not remove the need for locks: interrupt threads use the same mutual exclusion primitives as other kernel threads and wait when the data they need is locked.', 'Interrupt threads are kernel threads; user-level threads never handle hardware interrupts.'],  // feedback for each wrong choice: blocking is possible, interrupt threads still use locks, ULTs never handle interrupts
            why: 'Critical sections are entered far more often than interrupts arrive, so paying per interrupt is cheaper than raising and lowering the interrupt level on every access. On a multiprocessor the old way is even worse, since interrupts may have to be blocked on every processor.' },  // explanation: critical sections are far more frequent than interrupts, and multiprocessors make blocking worse
        ],  // closes the quiz list
      },  // end of step 9

    ],  // closes the steps list

    notes: `${/* notes: the section's summary text, shown in the Section notes panel and in the printable version */''}
      <h3>1. Four thread-related concepts in Solaris</h3>${/* notes heading, part 1: the four thread-related concepts */''}
      <p>Solaris, a UNIX system built for multiprocessors, splits running a thread across four layers:</p>${/* notes paragraph: Solaris splits running a thread across four layers */''}
      <ul>${/* start of the list of the four layers */''}
        <li><b>Process</b>: the ordinary UNIX process, with the user's address space, a stack and a process control block (PCB). It is the container whose memory, files and signal settings every thread shares.</li>${/* layer: the process, the container that every thread shares */''}
        <li><b>User-level threads (ULTs)</b>: made by a thread library in the process's address space; invisible to the OS. They are the program's interface for parallelism, and creating or switching them needs no kernel call.</li>${/* layer: user-level threads, made by the library and invisible to the OS */''}
        <li><b>Lightweight processes (LWPs)</b>: a mapping between ULTs and kernel threads. (In Solaris the name means this specific structure; section 4.1 used "lightweight process" loosely for any thread.) Each LWP supports one or more ULTs (running one at a time) and maps to exactly one kernel thread. The kernel schedules LWPs independently, so they may execute in parallel on a multiprocessor.</li>${/* layer: LWPs, each carrying ULTs and mapped to exactly one kernel thread */''}
        <li><b>Kernel threads</b>: the fundamental entities that are scheduled and dispatched onto one of the system's processors.</li>${/* layer: kernel threads, what is scheduled onto processors */''}
      </ul>${/* end of the layer list */''}
      <p>Rule to remember: there is <b>always exactly one kernel thread per LWP</b>. The reverse does not hold: some kernel threads have no LWP. The kernel creates, runs and destroys them to carry out its own system functions, such as handling interrupts.</p>${/* notes paragraph: exactly one kernel thread per LWP, but some kernel threads have no LWP */''}
      <pre>ULTs (in the library)  →  LWPs  ─ exactly one each ─  kernel threads  →  processors${/* shown diagram, line 1: ULTs to LWPs to kernel threads to processors */''}
                                    (+ kernel threads with no LWP, e.g. interrupts)</pre>${/* shown diagram, line 2: plus kernel threads with no LWP, such as interrupt threads */''}
      <p>The simplest case is one ULT on one LWP: a single flow of execution, which behaves like a traditional UNIX process. A program that wants concurrency uses several ULTs and LWPs. <b>Two versions:</b> Solaris 2 to 8 let many ULTs share a smaller set of LWPs (many-to-many, as in the lab); from Solaris 9 on, the library gives every ULT its own LWP (one-to-one). The layers and the one-kernel-thread-per-LWP rule are the same in both.</p>${/* notes paragraph: the one-ULT case, and the many-to-many versus one-to-one versions of Solaris */''}
      <h3>2. Why three levels of thread?</h3>${/* notes heading, part 2: why three levels of thread */''}
      <ul>${/* start of the list of benefits */''}
        <li><b>A clean interface for the application:</b> the program uses a standard thread library. In the many-to-many design, the library does cheap user-space bookkeeping: creating and switching ULTs and choosing which ULT runs on an LWP, with no kernel call.</li>${/* benefit: a clean interface, with cheap user-space bookkeeping */''}
        <li><b>Control for the OS:</b> each LWP is bound to one kernel thread with matching execution states, so concurrency and execution are managed at the kernel-thread level. The kernel picks which kernel thread runs on which processor, blocks one LWP without stalling the rest, and runs a process's LWPs in parallel.</li>${/* benefit: control for the OS at the kernel-thread level */''}
        <li><b>Cheaper kernel work:</b> running system functions as kernel threads (with no LWP) rather than as kernel processes means switching among them inside the kernel is a thread switch, not a more expensive process switch.</li>${/* benefit: cheaper kernel work, since kernel jobs switch as threads, not processes */''}
      </ul>${/* end of the benefit list */''}
      <h3>3. How the mapping behaves</h3>${/* notes heading, part 3: how the mapping behaves */''}
      <ul>${/* start of the list of mapping rules */''}
        <li>An LWP runs one ULT at a time; ULTs sharing an LWP take turns under the library's control. (In the many-to-many design a ULT could be bound to its own LWP; unbound ULTs could run on any free LWP of their process.)</li>${/* rule: an LWP runs one ULT at a time, and bound versus unbound ULTs */''}
        <li>At most one ULT per LWP, and at most one kernel thread per processor, can run at once. Example: 5 ULTs on 4 LWPs with 2 processors → at most <b>2</b> ULTs execute at the same instant. 6 ULTs on 3 LWPs → exactly <b>3</b> kernel threads support them.</li>${/* rule: limits on how many run at once, with the two worked examples */''}
        <li>Only a ULT that is actually executing (its LWP's kernel thread is ONPROC) can make a system call. A blocking call puts only that LWP's kernel thread to sleep (ONPROC → SLEEP); other LWPs keep running. ULTs waiting on the same LWP are stuck too. If a process has a single LWP, one blocking call stalls the whole process, just like pure ULTs.</li>${/* rule: only an executing ULT can make a system call, and a blocking call sleeps only its LWP */''}
        <li>With more LWPs than processors, runnable LWPs take turns: the extras wait in RUN.</li>${/* rule: extra LWPs wait in RUN when there are more LWPs than processors */''}
      </ul>${/* end of the mapping list */''}
      <h3>4. Process structure: traditional UNIX vs Solaris</h3>${/* notes heading, part 4: traditional versus Solaris process structure */''}
      <table>${/* start of the comparison table */''}
        <tr><th>Traditional UNIX process</th><th>Solaris process</th></tr>${/* table header: traditional UNIX process and Solaris process */''}
        <tr><td>Process ID, user IDs, signal dispatch table, memory map, file descriptors</td><td>The same five shared items</td></tr>${/* row: the five shared items, the same in both */''}
        <tr><td>One <b>processor state</b>: priority, signal mask, registers, stack</td><td>A <b>list of LWP structures</b>, one per LWP, each holding its own per-execution state</td></tr>${/* row: one processor state versus a list of LWP structures */''}
      </table>${/* end of the comparison table */''}
      <p>Each <b>LWP data structure</b> holds: (1) an LWP identifier; (2) the priority of this LWP, and hence of the kernel thread that supports it; (3) a signal mask telling the kernel which signals will be accepted; (4) saved values of user-level registers while the LWP is not running; (5) the kernel stack for this LWP, with system call arguments, results and error codes for each call level; (6) resource usage and profiling data; (7) a pointer to the corresponding kernel thread; (8) a pointer to the process structure.</p>${/* notes paragraph: the eight fields of each LWP data structure */''}
      <p>The principle: the process keeps what the whole program shares; each LWP keeps what one flow of execution needs. That is what lets one process run in several places at once.</p>${/* notes paragraph: the principle that the process keeps what is shared and each LWP what one flow needs */''}
      <h3>5. Kernel-thread states (simplified)</h3>${/* notes heading, part 5: kernel-thread states */''}
      <table>${/* start of the state table */''}
        <tr><th>State</th><th>Meaning</th></tr>${/* table header: state and meaning */''}
        <tr><td>RUN</td><td>Runnable: ready to execute, waiting for a processor.</td></tr>${/* row: RUN */''}
        <tr><td>ONPROC</td><td>Executing on a processor.</td></tr>${/* row: ONPROC */''}
        <tr><td>SLEEP</td><td>Blocked, waiting for an event.</td></tr>${/* row: SLEEP */''}
        <tr><td>STOP</td><td>Stopped (its process was stopped, e.g. by a debugger).</td></tr>${/* row: STOP */''}
        <tr><td>ZOMBIE</td><td>Terminated; leftovers not yet collected.</td></tr>${/* row: ZOMBIE */''}
        <tr><td>FREE</td><td>Resources released; awaiting removal from the OS thread data structure.</td></tr>${/* row: FREE */''}
      </table>${/* end of the state table */''}
      <p>Transitions: RUN → ONPROC on <b>dispatch</b>. ONPROC → RUN on <b>preemption</b> by a higher-priority thread, <b>end of quantum</b> (time slicing) or <b>yield</b>. ONPROC → SLEEP on a <b>blocking system call</b>; SLEEP → RUN on <b>wakeup</b> (it must still wait for a processor). ONPROC → STOP on <b>stop</b> (a thread stops itself, so a stop request takes effect when it next runs); STOP → RUN on <b>continue</b>. ONPROC → ZOMBIE on <b>exit</b>; ZOMBIE → FREE when the thread is <b>reaped</b>. When an interrupt arrives, the running thread (and its LWP) may be <b>pinned</b> until the interrupt is handled; this is a temporary hold, not one of the six states.</p>${/* notes paragraph: every transition and its event, plus pinning as a temporary hold */''}
      <h3>6. Interrupts as threads</h3>${/* notes heading, part 6: interrupts as threads */''}
      <ul>${/* start of the list of interrupt thread facts */''}
        <li>Solaris handles interrupts with a set of <b>interrupt threads</b>, kernel threads that each have their own identifier, priority, context and stack.</li>${/* fact: each interrupt thread has its own identifier, priority, context and stack */''}
        <li>Interrupt threads get higher priorities than all other kernel threads; only a higher-priority interrupt thread can preempt one.</li>${/* fact: interrupt threads outrank all other kernel threads */''}
        <li>The kernel controls access to shared data and synchronizes interrupt threads with mutual exclusion primitives (mutex locks), just as for other threads. An interrupt thread that needs a locked structure waits for it; its top priority does not let it skip the lock.</li>${/* fact: they use mutex locks like other threads and wait for a locked structure */''}
      </ul>${/* end of the facts list */''}
      <p>Sequence: (1) the interrupt is delivered to a particular processor; (2) the thread running there is <b>pinned</b>: its context is saved, it is suspended and it cannot move to another processor; (3) the processor starts an interrupt thread taken from a <b>pool of deactivated interrupt threads</b>, so no thread is created; (4) the interrupt thread handles the interrupt, locking shared data as needed; (5) it returns to the pool; (6) the pinned thread is unpinned and resumes exactly where it stopped.</p>${/* notes paragraph: the six-step sequence for handling one interrupt */''}
      <p><i>Going deeper:</i> in the real kernel, if an interrupt thread has to go to sleep (not just wait briefly for a lock), Solaris turns it into a full kernel thread and releases the pinned thread early, so the interrupted work is not held up.</p>${/* notes paragraph, going deeper: what happens if an interrupt thread must really sleep */''}
      <p><b>Why:</b> a traditional kernel protects data shared with interrupt handlers by raising the interrupt priority level before each access and lowering it after, although most interrupts never touch that data. That costs time on every critical section, and on a multiprocessor the kernel may have to block interrupts on all processors (and needs locks anyway). With interrupt threads the cost appears only when an interrupt happens, and interrupts are far rarer than critical sections (stretches of code that use shared data). Illustration with made-up unit costs: blocking costs 40 critical sections/ms × 4 processors × 1 unit = 160 units/ms; interrupt threads cost 2 interrupts/ms × 6 units = 12 units/ms, about 13.3 times less. Common mistake: Solaris does not create a thread per interrupt; it reuses pooled ones.</p>${/* notes paragraph: why interrupt threads beat blocking, with the worked cost example of 160 versus 12 units */''}
    `,  // end of the notes text
  });  // closes the section object passed to Guide.section
})();  // ends the wrapper function and runs it immediately
