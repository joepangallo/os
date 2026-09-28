// Comment key: a line inside backtick text ends with ${/* comment */''}, an empty-string slot that holds a comment without changing the text on screen (full note at the top of the page).
/* =====================================================================
   Section 4.6  Linux Process and Thread Management
   Linux tasks and task_struct, the five Linux task states, threads as
   tasks that share (clone() and its flags), namespaces and cgroups.
   Original teaching material, built step by step.
   ===================================================================== */
(() => {  // wraps the whole section in a function that runs once, right away, so its names stay private to this file
  /* ---------- shared helpers (scoped to this file) ---------- */
  const COLS = { cpu: 'var(--cpu)', mem: 'var(--mem)', io: 'var(--io)', os: 'var(--os)', proc: 'var(--proc)', thread: 'var(--thread)', intr: 'var(--intr)', warn: 'var(--warn)', accent: 'var(--accent)', ok: 'var(--ok)' };  // COLS maps short color names to the page's CSS color variables, so each part of the drawings can be tinted by name

  /* The nine kinds of information in a task_struct (step 2). Field names follow the kernel source, lightly simplified. */
  const TS_CATS = [  // TS_CATS: the nine groups of fields inside a task_struct, shown in the step 2 inspector and used by its sorting game
    { name: 'State', col: 'proc', fields: ['state'],  // category 1, State: col picks its color stripe, fields lists the real field names shown as small code chips
      what: 'Which of the five Linux states the task is in right now: Running, Interruptible, Uninterruptible, Stopped or Zombie.',  // what the State field holds: which of the five Linux states the task is in
      why: 'The scheduler only ever picks tasks whose state is Running. A sleeping task is skipped until some event changes its state.',  // why the State field matters: the scheduler only looks at tasks marked Running
      eg: 'state = TASK_INTERRUPTIBLE <span class="muted">(waiting for a key press)</span>' },  // example value for State, shown in the inspector's grey example box
    { name: 'Scheduling information', col: 'cpu', fields: ['policy', 'prio', 'time_slice'],  // category 2, Scheduling information: its policy, priority and time-slice fields
      what: 'Whether the task is a <b>normal</b> or a <b>real-time</b> task, its priority, and a counter of how much processor time it is allowed before it must give way.',  // what scheduling information holds: normal or real-time, priority, and the time-slice counter
      why: 'Real-time tasks are always scheduled ahead of normal ones, and priority orders the tasks inside each class. The counter lets the kernel take the processor back fairly.',  // why it matters: real-time tasks go first and the counter lets the kernel take the processor back
      eg: 'policy = SCHED_NORMAL, prio = 120 <span class="muted">(the usual value for a normal task)</span>' },  // example scheduling values: the normal policy with the usual priority of 120
    { name: 'Identifiers', col: 'accent', fields: ['pid', 'tgid', 'uid', 'gid'],  // category 3, Identifiers: the process ID, thread group ID, user ID and group ID
      what: 'A unique process identifier for the task, plus the user and group identifiers of the person it runs for. A group identifier lets a resource be opened to a whole group of users at once.',  // what the identifiers are: the task's own number plus the user and group it runs for
      why: 'Every permission check (may this task open that file, or signal that process?) compares these IDs.',  // why the identifiers matter: every permission check compares them
      eg: 'pid = 4213, tgid = 4213, uid = 1000 (alice), gid = 100 (users)' },  // example identifier values for a task run by a user named alice
    { name: 'Interprocess communication', col: 'intr', fields: ['pending', 'sighand', 'sysvsem'],  // category 4, Interprocess communication: pending signals, signal handler table and System V semaphores
      what: 'The task\'s hooks into the classic UNIX ways of talking between processes: signals waiting to be delivered, its table of signal handlers, and System V semaphores, message queues and shared memory.',  // what the IPC fields hold: waiting signals, the handler table and System V communication objects
      why: 'A signal can arrive while the task is asleep, so the kernel must hold it until the task can take it.',  // why the IPC fields matter: a signal that arrives during sleep must be held until the task can take it
      eg: 'pending = { SIGUSR1 } <span class="muted">(one signal not yet handled)</span>' },  // example IPC value: one SIGUSR1 signal still waiting to be handled
    { name: 'Links', col: 'proc', fields: ['real_parent', 'children', 'sibling'],  // category 5, Links: pointers to the parent, the siblings and the children
      what: 'Pointers to the task\'s parent, to its siblings (other children of the same parent) and to its own children.',  // what the links are: pointers to the family of tasks around this one
      why: 'When a task ends, the kernel follows these links to notify its parent and to find a new parent for any children it leaves behind.',  // why the links matter: on exit the kernel follows them to tell the parent and re-home any children
      eg: 'real_parent → bash (PID 3990); children → none' },  // example links: the parent is the bash shell and there are no children
    { name: 'Times and timers', col: 'warn', fields: ['start_time', 'utime', 'stime', 'timers'],  // category 6, Times and timers: creation time, user time, kernel time and interval timers
      what: 'When the task was created and how much processor time it has used so far, in user mode (utime) and in kernel mode (stime). The task may also set interval timers that send it a signal when they expire, once or again and again.',  // what the time fields hold: start time, processor time in user and kernel mode, and optional timers
      why: 'Tools such as top read these numbers, and the kernel uses them for accounting and scheduling.',  // why the time fields matter: tools such as top read them and the kernel uses them for accounting
      eg: 'start_time = 09:14:02, utime = 3.20 s, stime = 0.45 s' },  // example time values: when the task started and how many seconds it has used in each mode
    { name: 'File system', col: 'io', fields: ['files', 'fs'],  // category 7, File system: the open-file table and the directory information
      what: 'A pointer to the table of files the task has open, and pointers to its current directory and its root directory.',  // what the file-system fields hold: the open-file table plus the current and root directories
      why: 'A name like notes.txt is looked up starting at the current directory, and the number open() hands back is a slot in the open-file table.',  // why the file-system fields matter: relative names start at the current directory; open() returns a table slot
      eg: 'files → 23 open files; fs → cwd /home/alice, root /' },  // example file-system values: 23 open files and the task's current and root directories
    { name: 'Address space', col: 'mem', fields: ['mm'],  // category 8, Address space: the single mm pointer
      what: 'A pointer to the description of the task\'s virtual address space: which regions exist (code, data, heap, stacks, shared libraries) and the page tables that map them onto real memory.',  // what the address-space field points to: the map of the task's virtual memory and its page tables
      why: 'If two tasks point to the same address space, they are in effect threads of one process.',  // why it matters: two tasks that share one address space are really threads of one process
      eg: 'mm → code, data, heap, 3 stacks, 41 shared libraries' },  // example address-space contents: code, data, heap, three stacks and many shared libraries
    { name: 'Processor-specific context', col: 'cpu', fields: ['thread', 'stack'],  // category 9, Processor-specific context: saved registers and stack
      what: 'The register values and stack information that make up the task\'s context. They are saved when the task stops running, so it can later carry on exactly where it left off.',  // what the context holds: the registers saved when the task stops running, so it can resume exactly
      why: 'This is the one part whose layout depends on the kind of processor (x86, ARM and so on).',  // why the context is special: it is the only part whose layout depends on the kind of processor
      eg: 'thread → saved stack pointer, instruction pointer, flags' },  // example context: the saved stack pointer, instruction pointer and flags
  ];  // closes the TS_CATS list
  /* ---------- Linux task states (step 3) ---------- */
  const LS = {  // LS: every state the step 3 lab can show, keyed by a short name used throughout the state-machine code
    none: { name: 'No task yet', ps: '–', val: 'no task_struct yet', col: 'muted', desc: 'Nothing exists yet. Press <b>fork(): create</b> to make a task.' },  // "none": before fork() has made the task; ps = the letter the ps tool would print, val = the state field value
    ready: { term: 'Running (Linux state)', name: 'Running (ready)', ps: 'R', val: 'TASK_RUNNING', col: 'proc', desc: 'Ready to execute: it has everything it needs except a processor and waits in the run queue. Linux files this under <b>Running</b>, the same state as executing.' },  // "ready": waiting in the run queue; term links to the glossary entry, col picks the box color
    exec: { term: 'Running (Linux state)', name: 'Running (executing)', ps: 'R', val: 'TASK_RUNNING', col: 'proc', desc: 'Executing on a processor right now. The state field is the same as for a ready task: dispatching a task does not change it.' },  // "exec": running on a processor now; same TASK_RUNNING value as ready, which is the lesson here
    intr: { term: 'Interruptible (Linux state)', name: 'Interruptible', ps: 'S', val: 'TASK_INTERRUPTIBLE', col: 'warn', desc: 'Blocked, waiting for an event: I/O to finish, a resource to become free, or a signal from another process. A signal <b>wakes</b> it.' },  // "intr": Interruptible sleep (ps letter S); a signal or the awaited event wakes it
    unintr: { term: 'Uninterruptible (Linux state)', name: 'Uninterruptible', ps: 'D', val: 'TASK_UNINTERRUPTIBLE', col: 'intr', desc: 'Blocked, waiting directly on a hardware condition. It does <b>not</b> handle signals; they stay pending until the hardware is done. (Newer kernels add a <i>killable</i> variant that SIGKILL alone can end.)' },  // "unintr": Uninterruptible sleep (ps letter D); signals stay pending until the hardware finishes
    stopped: { term: 'Stopped (Linux state)', name: 'Stopped', ps: 'T', val: 'TASK_STOPPED', col: 'os', desc: 'Halted. It resumes only when another process acts on it, for example by sending SIGCONT. A debugger holds the program it is debugging in a stopped state too (ps shows a lowercase t, for "traced").' },  // "stopped": halted by SIGSTOP or a debugger (ps letter T) until SIGCONT arrives
    zombie: { term: 'Zombie (Linux state)', name: 'Zombie', ps: 'Z', val: 'EXIT_ZOMBIE', col: 'muted', desc: 'Finished, but its task_struct must stay in the process table so its parent can collect the exit status with wait().' },  // "zombie": finished, but the task_struct stays so the parent can read the exit status (ps letter Z)
    gone: { name: 'Removed', ps: '–', val: 'task_struct freed', col: 'muted', desc: 'The parent collected the exit status, so the kernel freed the task_struct. Press <b>fork(): create</b> to start again.' },  // "gone": the parent called wait(), so the kernel freed the task_struct and the lab can start over
  };  // closes the LS table
  const LS_MISSIONS = ['Wake an Interruptible (S) task with a signal', 'Send SIGKILL to a task in Uninterruptible (D) sleep', 'Stop a task, then let it continue', 'Make a zombie, then let its parent remove it'];  // LS_MISSIONS: the four goals shown under the step 3 lab; lsEvent reports a mission's index when it is met
  /* One event applied to (state, pending signals). Returns the new state, the arrows it travelled, a narration and
     any mission it completes. Rule of thumb that Linux really follows: a task acts on its signals when it runs. */
  function lsEvent(st, pend, ev) {  // lsEvent(st, pend, ev): the rules of the step 3 lab; given the state, pending signals and one event, returns the result
    const out = { st, pend: pend.slice(), arrs: [], msg: '', warn: false, mission: -1 };  // out starts as an unchanged copy of the inputs; arrs will list the diagram arrows to light up, mission -1 means none
    const has = (x) => out.pend.includes(x);  // has(x): true if signal x is already waiting in the pending list
    const add = (x) => { if (!has(x)) out.pend.push(x); };  // add(x): puts signal x on the pending list unless it is already there
    const drop = (x) => { out.pend = out.pend.filter((p) => p !== x); };  // drop(x): removes signal x from the pending list, for example once the task has handled it
    const W = (m) => { out.warn = true; out.msg = m; return out; };  // W(m): shortcut for a refused event: marks the result as a warning, sets its message and returns it unchanged
    const noTask = st === 'none' || st === 'gone';  // noTask is true before the first fork() and after the zombie has been removed
    const nm = LS[st].name;  // nm is the current state's display name, used inside the warning messages
    if (ev !== 'create' && noTask) return W('There is no task yet. Press <b>fork(): create</b> first.');  // every event except creating a task is refused while no task exists
    switch (ev) {  // picks the rule for the event the student clicked
      case 'create':  // event "create": the fork() button
        if (!noTask) return W('This lab follows one task, and it already exists. (A real program could call fork() again to make another.)');  // refuses a second fork(), because this lab follows a single task
        Object.assign(out, { st: 'ready', pend: [], arrs: ['create'], msg: '<b>fork()</b> gave the new task its own task_struct, filled in as a copy of the parent. It starts in <b>Running</b> (ready): it can run as soon as the scheduler picks it.' });  // a new task starts ready in the run queue, with no pending signals, and the create arrow lights up
        return out;  // hands back the result of the create event
      case 'sched':  // event "sched": the scheduler dispatches the task to a processor
        if (st !== 'ready') return W(`Only a ready task can be dispatched. This one is <b>${nm}</b>.`);  // only a ready task can be dispatched; anything else gets a warning naming its current state
        out.st = 'exec'; out.arrs = ['sched'];  // the task becomes executing and the dispatch arrow lights up
        if (has('SIGUSR1')) { drop('SIGUSR1'); out.msg = 'Dispatched. Before its program carries on, the task first runs its <b>SIGUSR1 handler</b>: signals are acted on when the task runs. The state field still says TASK_RUNNING.'; }  // if SIGUSR1 was waiting, it is handled now, because signals are acted on when a task runs
        else out.msg = 'The scheduler picked it: it is now <b>executing</b>. The state field did not change, because Linux uses TASK_RUNNING for ready and executing alike.';  // otherwise the message stresses that the state field stays TASK_RUNNING for ready and executing alike
        return out;  // hands back the result of the dispatch
      case 'slice':  // event "slice": the task's time slice runs out
        if (st !== 'exec') return W('Only an executing task can use up a time slice.');  // only an executing task can use up a time slice
        Object.assign(out, { st: 'ready', arrs: ['preempt'], msg: 'Its time slice ran out, so the scheduler put it back in the run queue. It is still <b>Running</b> in Linux terms, just not on a processor.' });  // the task goes back to ready (preempt arrow) but Linux still calls it Running
        return out;  // hands back the result of the time-slice event
      case 'key':  // event "key": the task calls read() on the keyboard
      case 'disk':  // event "disk": the task waits for a disk transfer; both events share the code below
        if (st !== 'exec') return W(`A task can only call read() while it is executing. This one is <b>${nm}</b>; schedule it first.`);  // a task can only make a call while it is executing, so other states get a warning
        if (ev === 'key') Object.assign(out, { st: 'intr', arrs: ['toIntr'], msg: 'It called read() on the keyboard and no key has been pressed yet. It sleeps in <b>Interruptible</b>: the key press (an event) or any signal will wake it.' });  // keyboard read with no key yet: the task sleeps in Interruptible, where signals can wake it
        else Object.assign(out, { st: 'unintr', arrs: ['toUnintr'], msg: 'It must wait while the disk controller finishes a transfer. The kernel puts it in <b>Uninterruptible</b> sleep: a wait on hardware like this is not cut short, so signals will not wake it.' });  // disk wait: the task sleeps in Uninterruptible, where signals cannot wake it
        return out;  // hands back the result of the read() event
      case 'io':  // event "io": the awaited key press or disk transfer finishes
        if (st === 'intr') { Object.assign(out, { st: 'ready', arrs: ['fromIntr'], msg: 'A key was pressed, the event it was waiting for. The kernel wakes it: <b>Running</b> (ready) again, and read() returns the key when it next runs.' }); return out; }  // a finished key press wakes an Interruptible task back to ready
        if (st !== 'unintr') return W('Nothing is waiting for I/O right now.');  // if the task is not sleeping on I/O at all, the event is refused
        out.arrs = ['fromUnintr'];  // waking from Uninterruptible lights the arrow out of that state
        if (has('SIGKILL')) { Object.assign(out, { st: 'zombie', pend: [], msg: 'The disk finished, so the task finally wakes... and finds <b>SIGKILL</b> waiting. It runs just long enough to exit and becomes a <b>Zombie</b>. The kill was delayed, never lost.' }); out.arrs.push('sched', 'exit'); return out; }  // a SIGKILL that waited during the disk wait now takes effect: the task runs only to exit and becomes a zombie
        if (has('SIGSTOP')) { drop('SIGSTOP'); out.st = 'stopped'; out.arrs.push('sched', 'stop'); out.msg = 'The disk finished. The task wakes, runs just long enough to act on the pending <b>SIGSTOP</b>, and halts: <b>Stopped</b>.'; return out; }  // a waiting SIGSTOP now takes effect: the task wakes, runs just long enough to see it, and stops
        out.st = 'ready'; out.msg = 'The disk transfer finished, so the kernel wakes it: <b>Running</b> (ready) again.' + (has('SIGUSR1') ? ' The SIGUSR1 that arrived meanwhile will be handled when it next runs.' : '');  // with no fatal signal waiting, the task simply becomes ready; any pending SIGUSR1 is mentioned for later
        return out;  // hands back the result of the I/O-finished event
      case 'usr1':  // event "usr1": another process sends the harmless SIGUSR1 signal
        if (st === 'zombie') return W('A zombie has already finished running, so it cannot handle signals. Only its parent\'s wait() matters now.');  // a zombie has finished running, so it cannot handle any signal
        if (st === 'exec') { out.msg = 'The task is running, so it takes SIGUSR1 at once: its <b>signal handler</b> runs, then its program carries on. No state change.'; return out; }  // an executing task runs its signal handler at once and then carries on, with no state change
        add('SIGUSR1');  // in every other state the signal joins the pending list first
        if (st === 'ready') out.msg = 'SIGUSR1 is now <b>pending</b>. The handler will run the next time the task is scheduled.';  // a ready task will run the handler the next time it is dispatched
        else if (st === 'intr') { Object.assign(out, { st: 'ready', arrs: ['fromIntr'], mission: 0, msg: 'The signal <b>wakes</b> the Interruptible task: Running (ready) again. Once scheduled it runs its handler; the read() it slept in then either restarts by itself or returns early with an "interrupted" error (EINTR).' }); }  // an Interruptible task is woken by the signal and goes back to ready; this completes mission 1 (index 0)
        else if (st === 'unintr') out.msg = 'The task is in <b>Uninterruptible</b> sleep, so SIGUSR1 does <b>not</b> wake it. The signal stays pending until the disk is done.';  // an Uninterruptible task is not woken; the signal just waits
        else if (st === 'stopped') out.msg = 'A stopped task runs no handlers. SIGUSR1 stays pending until the task is continued (SIGCONT) and scheduled.';  // a stopped task runs no handlers, so the signal waits until SIGCONT
        return out;  // hands back the result of the SIGUSR1 event
      case 'stop':  // event "stop": another process sends SIGSTOP
        if (st === 'zombie') return W('A zombie cannot be stopped: it has already finished.');  // a zombie cannot be stopped because it has already finished
        if (st === 'stopped') return W('It is already Stopped.');  // a task that is already stopped cannot be stopped again
        if (st === 'unintr') { add('SIGSTOP'); out.msg = 'Uninterruptible sleep: the task cannot act on SIGSTOP yet. The stop stays pending until the disk finishes.'; return out; }  // in Uninterruptible sleep the stop is only recorded as pending until the disk finishes
        out.st = 'stopped';  // in every remaining case the task ends up Stopped
        if (st === 'exec') { out.arrs = ['stop']; out.msg = 'SIGSTOP cannot be caught or ignored. The task halts and is now <b>Stopped</b>. It will not run again until another process sends SIGCONT.'; }  // an executing task halts at once along the stop arrow
        else if (st === 'ready') { out.arrs = ['sched', 'stop']; out.msg = 'A task acts on signals when it runs, so it is dispatched briefly, sees SIGSTOP and halts: <b>Stopped</b>.'; }  // a ready task is dispatched briefly to see the signal, then halts, so two arrows light up
        else { out.arrs = ['fromIntr', 'sched', 'stop']; out.mission = 0; out.msg = 'The signal wakes the Interruptible task. It runs just long enough to act on SIGSTOP, then halts: <b>Stopped</b>.'; }  // an Interruptible task is woken, dispatched, then halts: three arrows, and mission 1 counts as done
        return out;  // hands back the result of the stop event
      case 'cont':  // event "cont": another process sends SIGCONT
        if (st === 'unintr' && has('SIGSTOP')) { drop('SIGSTOP'); out.msg = 'SIGCONT cancels the pending SIGSTOP. The task keeps sleeping on the disk, as before.'; return out; }  // SIGCONT during Uninterruptible sleep simply cancels a pending SIGSTOP; the task keeps sleeping
        if (st !== 'stopped') return W(`SIGCONT only matters to a Stopped task. This one is <b>${nm}</b>, so nothing happens.`);  // SIGCONT does nothing to a task that is not stopped
        Object.assign(out, { st: 'ready', arrs: ['cont'], mission: 2, msg: 'SIGCONT resumes it: the task goes back to <b>Running</b> (ready) and waits for the scheduler.' + (has('SIGUSR1') ? ' Its pending SIGUSR1 will be handled when it runs.' : '') });  // a stopped task goes back to ready along the continue arrow; this completes mission 3 (index 2)
        return out;  // hands back the result of the continue event
      case 'kill':  // event "kill": another process sends SIGKILL
        if (st === 'zombie') return W('It is already dead. A zombie ignores every signal; only the parent\'s wait() can remove it.');  // a zombie is already dead; only the parent's wait() can remove it
        if (st === 'unintr') { add('SIGKILL'); Object.assign(out, { mission: 1, msg: 'The task is in <b>Uninterruptible</b> sleep, so even SIGKILL cannot wake it. The kill stays pending until the disk finishes. This is why a process stuck in state D cannot be killed.' }); return out; }  // in Uninterruptible sleep even SIGKILL only waits; this is mission 2 (index 1), the unkillable D state
        out.st = 'zombie'; out.pend = [];  // in every other case the task dies and becomes a zombie, and its pending signals no longer matter
        if (st === 'exec') { out.arrs = ['exit']; out.msg = 'SIGKILL cannot be caught, blocked or ignored. The task ends at once and becomes a <b>Zombie</b>.'; }  // an executing task goes straight to exit
        else if (st === 'ready') { out.arrs = ['sched', 'exit']; out.msg = 'The task runs just long enough to act on SIGKILL, then ends: <b>Zombie</b>.'; }  // a ready task is dispatched just long enough to act on the kill, then exits
        else if (st === 'intr') { out.arrs = ['fromIntr', 'sched', 'exit']; out.mission = 0; out.msg = 'SIGKILL wakes the Interruptible task, which runs its exit path at once and becomes a <b>Zombie</b>.'; }  // an Interruptible task is woken, dispatched and exits; waking it with a signal also completes mission 1
        else { out.arrs = ['cont', 'sched', 'exit']; out.msg = 'SIGKILL is one of the two signals that reach a Stopped task (SIGCONT is the other). It wakes, then ends: <b>Zombie</b>.'; }  // a stopped task is one of the few that SIGKILL still reaches: it wakes, runs and exits
        return out;  // hands back the result of the kill event
      case 'exit':  // event "exit": the task itself calls exit()
        if (st === 'zombie') return W('It has already exited.');  // a zombie has already exited
        if (st !== 'exec') return W(`exit() is a call the task makes itself, so it must be executing. This one is <b>${nm}</b>.`);  // only an executing task can make a call, so every other state is refused
        Object.assign(out, { st: 'zombie', arrs: ['exit'], pend: [], msg: 'The task called exit(). Its memory and open files are released, but its task_struct stays behind as a <b>Zombie</b> holding the exit status, until the parent collects it.' });  // exit() frees memory and files but leaves the task_struct behind as a zombie holding the exit status
        return out;  // hands back the result of the exit event
      case 'wait':  // event "wait": the parent calls wait() to collect the child's exit status
        if (st !== 'zombie') return W('The child has not exited, so the parent\'s wait() would just put the <b>parent</b> to sleep until it does. The child\'s state does not change.');  // before the child exits, wait() would only put the parent to sleep, so nothing changes here
        Object.assign(out, { st: 'gone', arrs: ['reap'], mission: 3, msg: 'The parent called wait() and collected the exit status. Only now does the kernel free the task_struct: the zombie is gone.' });  // collecting a zombie frees its task_struct along the reap arrow; this completes mission 4 (index 3)
        return out;  // hands back the result of the wait event
    }  // closes the switch over event names
    return out;  // an unknown event name falls through here and returns the state unchanged
  }  // ends lsEvent()

  /* ---------- clone() flag builder (step 5) ---------- */
  const CF_MAIN = [  // CF_MAIN: the five main sharing flags offered as switches in the step 5 clone() builder, each with a short meaning
    { f: 'CLONE_VM', d: 'share the address space (all of memory)' },  // CLONE_VM: the new task uses the same memory as its creator
    { f: 'CLONE_FILES', d: 'share the open-file table' },  // CLONE_FILES: the new task uses the same table of open files
    { f: 'CLONE_FS', d: 'share current dir, root dir and umask' },  // CLONE_FS: the new task shares the current directory, root directory and umask (default file permissions)
    { f: 'CLONE_SIGHAND', d: 'share the table of signal handlers' },  // CLONE_SIGHAND: the new task shares the table that says which function handles each signal
    { f: 'CLONE_THREAD', d: 'join the caller\'s thread group (same TGID)' },  // CLONE_THREAD: the new task joins the same thread group, so getpid() gives the same number
  ];  // closes the CF_MAIN list
  /* The other five flags from the brief, in the brief's order. d = one-line summary (step 5), long/use = step 6 reference. */
  const CF_EXTRA = [  // CF_EXTRA: five more clone() flags; d is shown in step 5, use and long in the step 6 reference, would in the game's feedback
    { f: 'CLONE_NEWPID', d: 'The new task starts a brand-new PID namespace, in which it is PID 1.', use: 'container runtimes', would: 'put the new task in a fresh PID namespace, where it is PID 1.',  // CLONE_NEWPID: its short summary, who uses it and the phrase shown after a wrong guess
      long: 'Start the new task in a fresh <b>PID namespace</b>: PID 1 inside, an ordinary PID on the host. Needs administrator rights (or a new user namespace too).' },  // longer step 6 explanation of CLONE_NEWPID: PID 1 inside the new namespace, an ordinary number outside
    { f: 'CLONE_PARENT', d: 'The new task gets the caller\'s parent, so it is the caller\'s sibling, not its child.', use: 'helper tasks', would: 'make the new task the caller\'s sibling, so its exit is reported to the caller\'s parent.',  // CLONE_PARENT: the new task becomes the caller's sibling instead of its child
      long: 'Give the new task the <b>caller\'s parent</b> as its parent: it becomes the caller\'s sibling, and its exit is reported to that parent, not to the caller.' },  // longer explanation of CLONE_PARENT: the new task's exit is reported to the caller's parent
    { f: 'CLONE_SYSVSEM', d: 'Caller and new task share one list of System V semaphore "undo" entries.', use: 'pthread_create()', would: 'make the tasks share one list of semaphore undo entries.',  // CLONE_SYSVSEM: caller and new task share one list of semaphore undo entries
      long: 'Share one list of <b>semaphore "undo" entries</b> (a semaphore is a shared counter tasks use to take turns; chapter 5). The kernel reverses these changes when a task exits; shared, they are undone once, when the last sharer exits.' },  // longer explanation of CLONE_SYSVSEM, with a one-line reminder of what a semaphore is
    { f: 'CLONE_SETTLS', d: 'The new task gets its own thread-local storage block (for variables such as errno).', use: 'pthread_create()', would: 'give the new task its own thread-local storage block (where variables such as errno live).',  // CLONE_SETTLS: the new task gets its own thread-local storage block
      long: 'Point the new task at its own <b>thread-local storage</b>: a private block, prepared by the thread library, for per-thread variables such as errno.' },  // longer explanation of CLONE_SETTLS: a private block for per-thread variables such as errno
    { f: 'CLONE_VFORK', d: 'The caller is paused until the new task calls exec() or exits.', use: 'vfork(), posix_spawn()', would: 'put the caller to sleep until the new task calls exec() or exits.',  // CLONE_VFORK: the caller sleeps until the new task calls exec() or exits
      long: 'Put the <b>caller to sleep</b> until the new task calls exec() or exits. With CLONE_VM, the child borrows the parent\'s memory with no copying.' },  // longer explanation of CLONE_VFORK: combined with CLONE_VM the child borrows memory with no copying
  ];  // closes the CF_EXTRA list
  /* Step 6 game: which extra flag does this job? [scenario, index into CF_EXTRA, why] */
  const CF_JOBS = [  // CF_JOBS: the step 6 game rounds, each a scenario, the index of the right flag in CF_EXTRA, and the explanation
    ['A shell lends its child its memory (CLONE_VM) because the child will call exec() at once to start a new program. The shell must not run again until that exec() has happened.', 4,  // round: a shell lends its memory to a child that will call exec(); the answer is index 4, CLONE_VFORK
      'CLONE_VFORK keeps the caller asleep until the child calls exec() or exits, so parent and child never use the borrowed memory at the same time. vfork() is exactly CLONE_VM + CLONE_VFORK.'],  // explanation for the vfork round: the caller sleeps so the two never use the borrowed memory together
    ['A container runtime starts the first process of a new container. Inside the container, that process must see itself as PID 1.', 0,  // round: a container's first process must see itself as PID 1; the answer is index 0, CLONE_NEWPID
      'CLONE_NEWPID gives the new task a fresh PID namespace. It is PID 1 inside, its "init", and still has an ordinary PID such as 4521 on the host, which is how the host can manage it.'],  // explanation for the container round: PID 1 inside, an ordinary PID on the host
    ['pthread_create() is making a new thread. Every thread needs its own errno variable, so an error code set by one thread can never overwrite another\'s.', 3,  // round: every new thread needs its own errno; the answer is index 3, CLONE_SETTLS
      'CLONE_SETTLS makes the new task use its own thread-local storage block from the very start. Per-thread variables such as errno live there, one private copy per thread.'],  // explanation for the errno round: per-thread variables live in the task's own storage block
    ['A task starts a helper whose exit should be reported to the task\'s own parent, not to the task itself. The task never wants to wait() for the helper.', 1,  // round: a helper's exit should be reported to the caller's parent; the answer is index 1, CLONE_PARENT
      'With CLONE_PARENT the helper\'s parent is the caller\'s parent, so the helper is the caller\'s sibling, and its exit is reported to that shared parent.'],  // explanation for the helper round: the helper becomes the caller's sibling
    ['The threads of one program lock a System V semaphore with the "undo when I exit" option. If the program crashes, the kernel must reverse the changes made by all of its threads together.', 2,  // round: semaphore changes by all threads must be undone together; the answer is index 2, CLONE_SYSVSEM
      'CLONE_SYSVSEM makes the tasks share one list of undo entries, so they act as one process: the adjustments are reversed once, when the last task sharing the list exits.'],  // explanation for the semaphore round: one shared undo list, reversed when the last sharer exits
  ];  // closes the CF_JOBS list
  const CF_PRESETS = {  // CF_PRESETS: the flag sets behind the three preset buttons in step 5
    'fork()': [],  // fork() uses no flags at all: everything is copied
    'vfork()': ['CLONE_VM', 'CLONE_VFORK'],  // vfork() is exactly CLONE_VM plus CLONE_VFORK
    'pthread_create()': ['CLONE_VM', 'CLONE_FS', 'CLONE_FILES', 'CLONE_SIGHAND', 'CLONE_THREAD', 'CLONE_SYSVSEM', 'CLONE_SETTLS'],  // pthread_create() turns on the five sharing flags plus the undo-list and thread-local-storage flags
  };  // closes CF_PRESETS
  /* The EINVAL rules from the clone() manual that involve the flags this lab offers, checked before any task is built.
     Rules for flags the lab does not offer (CLONE_NEWNS, CLONE_NEWIPC, CLONE_NEWUSER) are listed in the notes.
     Returns [headline, why] or null. A third entry, true, marks a rule the manual states but newer kernels no longer enforce. */
  function cfError(F) {  // cfError(F): F is the set of flags switched on; returns why the kernel would refuse the mix (EINVAL), or null if it is allowed
    if (F.has('CLONE_SIGHAND') && !F.has('CLONE_VM')) return ['CLONE_SIGHAND needs CLONE_VM.', 'A signal handler is a function at some address in memory. Sharing the handler table only makes sense if both tasks see the same memory.'];  // rule 1: sharing signal handlers requires sharing memory, because handlers are functions stored in memory
    if (F.has('CLONE_THREAD') && !F.has('CLONE_SIGHAND')) return ['CLONE_THREAD needs CLONE_SIGHAND.', 'Signals can be sent to a whole thread group, so every task in the group must agree on one table of handlers.'];  // rule 2: joining a thread group requires sharing signal handlers
    if (F.has('CLONE_THREAD') && F.has('CLONE_NEWPID')) return ['CLONE_THREAD cannot be combined with CLONE_NEWPID.', 'A new PID namespace would give the new task a different set of process IDs from the rest of its group. But the threads of a group share one queue of waiting signals, and each queued signal records its sender\'s PID as one namespace numbers it, so every thread must stay in the same PID namespace.'];  // rule 3: a thread may not move into a new PID namespace, because the whole group must number PIDs the same way
    return null;  // no rule is broken, so the kernel would accept this mix
  }  // ends cfError()
  /* CLONE_PARENT + CLONE_NEWPID: current kernels (since 3.13) accept it, while the clone() manual still
     lists it as EINVAL and older kernels refused it. The lab models today's kernels and adds a note. */
  const cfNote = (F) => (F.has('CLONE_PARENT') && F.has('CLONE_NEWPID')  // cfNote(F): extra note shown when CLONE_PARENT and CLONE_NEWPID are both on
    ? 'Works on kernels since 3.13. <span class="muted">The manual still says EINVAL (see the code).</span>'  // the note says newer kernels accept this pair even though the manual still lists it as an error
    : '');  // every other flag mix gets no note (an empty string)
  function cfVerdict(F) {  // cfVerdict(F): names what kind of task the chosen flags produce, returned as [color, title, explanation]
    const main = CF_MAIN.filter((m) => F.has(m.f)).length;  // main counts how many of the five main sharing flags are switched on
    if (main === 0) return ['proc', 'A new process', F.size ? 'No sharing flag is on, so memory, files, directories and handlers are all still copied; the extras only adjust details.' : 'Nothing is shared: exactly what fork() asks for. fork() is clone() with no sharing flags.'];  // no sharing flag: a new process; the text changes depending on whether any extra flag is on
    if (F.has('CLONE_VM') && F.has('CLONE_VFORK') && main === 1) return ['warn', 'A vfork() child', 'The child borrows the parent\'s memory while the parent waits; it is meant to call exec() at once.'];  // only CLONE_VM plus CLONE_VFORK: the vfork() pattern, a child that borrows memory while the parent waits
    if (main === CF_MAIN.length) return ['thread', 'A thread of the same process', 'Memory, files, directories and handlers shared, same thread group: what pthread_create() asks for.'];  // all five sharing flags: a thread of the same process, exactly what pthread_create() asks for
    return ['accent', 'Something in between', 'Linux accepts any valid mix. The kernel treats each one alike: one task_struct, some pointers shared.'];  // any other valid mix: something in between, which Linux accepts just the same
  }  // ends cfVerdict()

  /* The sorting game (step 2): [field, category index, plain-language hint] */
  const TS_SORT = [  // TS_SORT: the twelve fields of the step 2 sorting game, each with its correct TS_CATS index and a hint
    ['pid = 4213', 2, 'a number no other task has'],  // field for the Identifiers group (index 2): the unique process ID
    ['utime = 3.20 s', 5, 'processor time used in user mode'],  // field for Times and timers (index 5): processor time used in user mode
    ['mm → memory map', 7, 'the task\'s virtual memory'],  // field for Address space (index 7): the pointer to the memory map
    ['real_parent → bash', 4, 'the task that created this one'],  // field for Links (index 4): the pointer to the parent task
    ['policy = SCHED_FIFO', 1, 'a real-time policy'],  // field for Scheduling information (index 1): a real-time scheduling policy
    ['state = TASK_UNINTERRUPTIBLE', 0, 'what the task is doing right now'],  // field for State (index 0): the task is in Uninterruptible sleep
    ['files → open-file table', 6, 'every file the task has open'],  // field for File system (index 6): the pointer to the open-file table
    ['pending = { SIGTERM }', 3, 'a signal waiting to be handled'],  // field for Interprocess communication (index 3): a pending SIGTERM signal
    ['thread → saved registers', 8, 'register values kept while it is not running'],  // field for Processor-specific context (index 8): the saved registers
    ['uid = 1000', 2, 'the user the task runs for'],  // second field for Identifiers: the user ID the task runs for
    ['start_time = 09:14:02', 5, 'the moment the task was created'],  // second field for Times and timers: when the task was created
    ['prio = 120', 1, 'how urgent the task is'],  // second field for Scheduling information: the priority number
  ];  // closes TS_SORT

  Guide.section({  // registers this section with the guide; the object below holds its text, styles and all eight steps
    id: '4.6',  // section number, used in links, saved progress and the CSS class sec-4-6
    title: 'Linux Process and Thread Management',  // full title shown at the top of the section
    short: 'Linux tasks & threads',  // short title used in the table of contents and small labels
    summary: 'Linux runs processes and threads alike as tasks: task_struct, five states, clone() flags, namespaces, cgroups.',  // one-sentence summary shown on the chapter page
    objectives: [  // learning objectives, listed where the section begins
      'List the kinds of information Linux keeps in a task_struct and sort real fields into those categories.',  // objective 1: the kinds of information in a task_struct
      'Name the five Linux task states, say which events move a task between them, and explain how Interruptible and Uninterruptible sleep differ.',  // objective 2: the five Linux states and the difference between the two kinds of sleep
      'Explain why Linux has no separate thread structure: a thread is a task created by clone() that shares memory, files and other resources and belongs to the same thread group.',  // objective 3: why a Linux thread is just a task that shares
      'Choose clone() flags that give fork()-like, vfork()-like or thread-like behaviour, predict what parent and child share, and say what CLONE_NEWPID, CLONE_PARENT, CLONE_SYSVSEM, CLONE_SETTLS and CLONE_VFORK are for.',  // objective 4: choosing clone() flags and knowing what the five extra flags do
      'Describe the six namespaces and control groups, and explain how together they build containers.',  // objective 5: namespaces, control groups and how they build containers
    ],  // closes the objectives list
    terms: [  // glossary terms for this section; each is [term, definition] and underlined words in the steps link to them
      ['task_struct', 'The data structure the Linux kernel keeps for every task, that is, for every process and every thread. It records the task\'s state, scheduling data, identifiers, family links, times, open files, address space and saved processor context.'],  // glossary entry: task_struct, the kernel's record for every task
      ['Linux task', 'The unit Linux creates and schedules. Every process and every thread is a task with its own task_struct; tasks count as "threads of one process" only because they share resources. (Not the older use of "task" in section 4.1 as another name for the resource-owning process.)'],  // glossary entry: Linux task, the unit that is created and scheduled
      ['Running (Linux state)', 'The Linux state that covers two situations: the task is executing on a processor right now, or it is ready and waiting for the scheduler to pick it. The ps tool shows it as R.'],  // glossary entry: the Running state, which covers both ready and executing
      ['Interruptible (Linux state)', 'A blocked state. The task sleeps until an event happens, such as I/O finishing, a resource becoming free or a signal arriving; a signal wakes it. ps shows it as S.'],  // glossary entry: the Interruptible sleep state (ps letter S)
      ['Uninterruptible (Linux state)', 'A blocked state in which the task waits directly on a hardware condition and does not react to signals until that condition is met. ps shows it as D.'],  // glossary entry: the Uninterruptible sleep state (ps letter D)
      ['Stopped (Linux state)', 'The task has been halted, for example by the SIGSTOP signal or by a debugger, and resumes only when another process acts on it, for example by sending SIGCONT. ps shows it as T.'],  // glossary entry: the Stopped state (ps letter T)
      ['Zombie (Linux state)', 'The task has terminated, but its task_struct must stay in the process table until its parent collects the exit status with wait(). ps shows it as Z.'],  // glossary entry: the Zombie state (ps letter Z)
      ['clone()', 'The Linux system call that creates a new task. Its flag bits decide, resource by resource, whether the new task shares with its creator or gets its own copy.'],  // glossary entry: the clone() system call
      ['Clone flags', 'The bits passed to clone(), such as CLONE_VM (share memory) or CLONE_FILES (share the open-file table). With none of the sharing flags set, clone() behaves like fork().'],  // glossary entry: clone flags, the bits that choose share or copy
      ['Thread group', 'The set of tasks created with CLONE_THREAD from one original task. They share one thread group ID (TGID), which is the process ID that getpid() reports for every one of them.'],  // glossary entry: thread group and its shared thread group ID
      ['Signal handler', 'A function a program registers to run when a particular signal arrives, for example to save its work before quitting.'],  // glossary entry: signal handler
      ['Namespace', 'A Linux feature that gives a task, or a group of tasks, its own private view of one kind of system resource, such as process IDs, network devices or the hostname.'],  // glossary entry: namespace, a private view of one kind of resource
      ['Mount namespace', 'Gives its tasks their own set of mount points, so they can see a different file-system tree, with a different root directory, from other tasks.'],  // glossary entry: mount namespace, a private file-system tree
      ['UTS namespace', 'Gives its tasks their own hostname and domain name: the values that the uname() call and the hostname command report.'],  // glossary entry: UTS namespace, a private hostname
      ['IPC namespace', 'Gives its tasks their own set of interprocess-communication objects: semaphores, message queues and shared-memory segments.'],  // glossary entry: IPC namespace, private semaphores, queues and shared memory
      ['PID namespace', 'Gives its tasks their own process-ID numbering. The first task inside gets PID 1, and every task also has its own PID in the parent namespace, so the host can still see and manage it.'],  // glossary entry: PID namespace, private process-ID numbering
      ['Network namespace', 'Gives its tasks their own network stack: network devices, IP addresses, routing table and port numbers.'],  // glossary entry: network namespace, a private network stack
      ['User namespace', 'Gives its tasks their own mapping of user and group IDs, so a task can be root (UID 0) inside the namespace while being an ordinary, unprivileged user outside it.'],  // glossary entry: user namespace, private user and group ID mapping
      ['Control group (cgroup)', 'A kernel mechanism that places tasks in a tree of groups and limits, prioritizes, accounts for and controls (for example, freezes) the resources each group uses: processor time, memory, disk I/O and network.'],  // glossary entry: control group (cgroup), resource limits for groups of tasks
      ['Container', 'A group of ordinary processes that the kernel isolates with namespaces and limits with cgroups, so it looks like its own small machine while sharing the host\'s one kernel. Docker and LXC build containers this way.'],  // glossary entry: container, isolated and limited ordinary processes
    ],  // closes the terms list

    /* Scoped CSS: every selector starts with .sec-4-6 */
    css: ` /* css: styles for this section only; the guide adds them to the page when the section is shown */
      /* shell workaround: in narrow mode the nowrap eyebrow can set the canvas min-width and scroll the page sideways */
      .sec-4-6 .step-eyebrow { contain: inline-size; } /* stops the step's top label line from widening the page on small screens */
      .sec-4-6 .p15 { font-size: 15.5px; line-height: 1.45; } /* p15: slightly larger text with comfortable line spacing for explanation paragraphs */
      .sec-4-6 .p15 p { margin: 0 0 8px; } /* p15 paragraphs get a small gap below each one */
      .sec-4-6 .lbl { font-size: 12.5px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); } /* lbl: small, bold, spaced-out uppercase labels such as "Mode" and "Missions" */
      .sec-4-6 .callout { font-size: 15px; line-height: 1.45; } /* callout boxes in this section use slightly smaller text */
      .sec-4-6 .hot { cursor: pointer; outline: none; } /* class for clickable hot spots: shows the hand cursor and hides the default focus outline */
      /* step 2: task_struct inspector */
      .sec-4-6 .ts-list { display: flex; flex-direction: column; gap: 5px; } /* step 2: the nine task_struct groups sit in a column with small gaps */
      .sec-4-6 .ts-brace { font-family: var(--mono); font-size: 14.5px; color: var(--muted); font-weight: 700; } /* the "struct task_struct {" and "};" lines above and below the list, in grey code font */
      .sec-4-6 .ts-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 9px 10px 9px 12px; border: 1.5px solid var(--line); border-left: 6px solid var(--c); border-radius: 10px; background: var(--panel-2); cursor: pointer; font: inherit; color: var(--ink); text-align: left; transition: background .15s, border-color .15s; } /* each group is a button styled as a card with a thick colored stripe on its left (the color comes from --c) */
      .sec-4-6 .ts-row b { font-size: 15.5px; white-space: nowrap; } /* the group name is bold and never breaks onto two lines */
      .sec-4-6 .ts-row:hover { border-color: var(--c); } /* hovering a group colors its border to show it can be clicked */
      .sec-4-6 .ts-row.on { background: color-mix(in srgb, var(--c) 13%, var(--panel)); border-color: var(--c); box-shadow: 0 0 0 1px var(--c); } /* the selected group gets a light tint of its own color and a colored outline */
      .sec-4-6 .ts-row.ok { background: var(--ok-bg); border-color: var(--ok); border-left-color: var(--ok); } /* a group picked correctly in the sorting game turns green */
      .sec-4-6 .ts-row.bad { background: var(--bad-bg); border-color: var(--bad); border-left-color: var(--bad); } /* a group picked wrongly in the sorting game turns red */
      .sec-4-6 .ts-fields { display: flex; gap: 4px; flex-wrap: wrap; justify-content: flex-end; } /* the field-name chips line up on the right of each group and wrap if needed */
      .sec-4-6 .ts-fields code { font-size: 12.5px; } /* the field-name chips use small code text */
      .sec-4-6 .ts-eg { font-family: var(--mono); font-size: 14.5px; padding: 8px 12px; border-radius: 10px; background: var(--panel-3); border-left: 4px solid var(--chc); } /* the example-value box: code font on a grey panel with a chapter-colored stripe */
      .sec-4-6 .ts-q { font-family: var(--mono); font-size: 25px; font-weight: 800; text-align: center; padding: 16px 12px 6px; } /* the field being sorted in the game, shown large and centered */
      .sec-4-6 .ts-fb { flex: none; min-height: 76px; font-size: 15.5px; line-height: 1.45; padding: 10px 14px; border-radius: 12px; background: var(--panel-2); border: 1px solid var(--line); } /* the feedback box under the game; min-height keeps the layout from jumping as messages change length */
      .sec-4-6 .ts-fb.ok { background: var(--ok-bg); border-color: var(--ok); } /* feedback box turns green after a right answer */
      .sec-4-6 .ts-fb.bad { background: var(--bad-bg); border-color: var(--bad); } /* feedback box turns red after a wrong answer */
      .sec-4-6 .ts-dots { display: flex; gap: 5px; flex-wrap: wrap; } /* the row of progress dots, one per field in the game */
      .sec-4-6 .ts-dots i { width: 14px; height: 14px; border-radius: 50%; border: 2px solid var(--line-2); display: block; } /* each progress dot is a small empty circle */
      .sec-4-6 .ts-dots i.ok { background: var(--ok); border-color: var(--ok); } /* dot for a field sorted right on the first try: filled green */
      .sec-4-6 .ts-dots i.late { background: var(--warn); border-color: var(--warn); } /* dot for a field that needed more tries: filled orange */
      .sec-4-6 .ts-dots i.cur { border-color: var(--chc); box-shadow: 0 0 0 2px color-mix(in srgb, var(--chc) 30%, transparent); } /* dot for the field being asked now: chapter-colored ring with a soft glow */
      /* step 3: Linux state machine */
      .sec-4-6 .ls-box rect { stroke-width: 2; transition: stroke-width .2s; } /* step 3: state boxes in the diagram get a medium border that thickens smoothly */
      .sec-4-6 .ls-box.cur rect { stroke-width: 4.5; } /* the box of the task's current state gets a much thicker border */
      .sec-4-6 .ls-box .t1 { font-size: 16px; font-weight: 800; } /* main label of each state box, large and bold */
      .sec-4-6 .ls-box .t2 { font-size: 13.5px; fill: var(--muted); } /* second line of each state box, smaller and grey */
      .sec-4-6 .ls-arr path { fill: none; stroke: var(--line-2); stroke-width: 2; transition: stroke .2s; } /* state-change arrows are grey lines with no fill */
      .sec-4-6 .ls-arr text { font-size: 13.5px; fill: var(--muted); font-weight: 700; } /* arrow labels such as "scheduled" and "wake", small bold grey text */
      .sec-4-6 .ls-arr.hi path { stroke: var(--accent); stroke-width: 3.5; } /* arrows the last event travelled along turn thick and accent-colored */
      .sec-4-6 .ls-arr.hi text { fill: var(--accent); } /* labels of the lit arrows turn accent-colored too */
      .sec-4-6 .ls-dot { fill: var(--chc); stroke: var(--panel); stroke-width: 2.5; transition: transform .35s ease; } /* the dot that marks the task's state; its movement between boxes is animated */
      .sec-4-6 .ls-ev { display: grid; grid-template-columns: 78px minmax(0, 1fr); gap: 7px 8px; align-items: center; } /* the event buttons grid: a label column on the left, the buttons on the right */
      .sec-4-6 .ls-ev .row { gap: 6px; } /* buttons in each row of the event grid sit close together */
      .sec-4-6 .ls-card { border-left: 6px solid var(--c); } /* the card that describes the current state gets a thick stripe in that state's color */
      .sec-4-6 .ls-hist { display: flex; gap: 3px; flex-wrap: wrap; min-height: 24px; } /* the "what ps would show" history row: letter tiles that wrap; min-height keeps it from collapsing while empty */
      .sec-4-6 .ls-hist span { font-family: var(--mono); font-weight: 800; font-size: 13px; width: 22px; height: 22px; display: grid; place-items: center; border-radius: 6px; background: var(--panel-3); color: var(--ink-2); } /* each history entry is a small square tile holding one ps letter such as R or S */
      .sec-4-6 .ls-hist span.last { background: var(--chc); color: var(--panel); } /* the newest history tile is filled with the chapter color so it stands out */
      .sec-4-6 .ls-mis { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 3px 14px; font-size: 14px; } /* the mission list is laid out in two equal columns */
      .sec-4-6 .nrw .ls-mis { grid-template-columns: 1fr; } /* on small screens (phone-width layout) the mission list uses one column */
      .sec-4-6 .ls-narr { font-size: 14.5px; } /* the narration box under the state card uses slightly smaller text */
      .sec-4-6 .ls-mis div { display: flex; gap: 7px; align-items: baseline; color: var(--ink-2); } /* each mission is a row: a tick or circle marker, then the mission text */
      .sec-4-6 .ls-mis div b { width: 16px; flex: none; color: var(--muted); } /* the mission marker has a fixed width so the texts line up */
      .sec-4-6 .ls-mis div.ok { color: var(--ok); } /* a completed mission turns green */
      .sec-4-6 .ls-mis div.ok b { color: var(--ok); } /* the marker of a completed mission turns green too */
      .sec-4-6 .ls-narr.warn { background: var(--warn-bg); border-color: var(--warn); } /* the narration box turns orange when the last event was refused */
      .sec-4-6 .ls-sig { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 1px 10px; font-size: 13.5px; line-height: 1.3; margin: 2px 0 6px; } /* the signal list in the tip box: signal names in one column, their meanings beside them */
      .sec-4-6 .ls-sig b { font-family: var(--mono); font-size: 13px; } /* signal names in the tip box use bold code font */
      /* step 4: thread groups */
      .sec-4-6 .th-grps { display: grid; grid-template-columns: minmax(0, 2.6fr) minmax(0, 1fr); gap: 10px; } /* step 4: the two thread-group boxes side by side, the webserver box wider because it holds three tasks */
      .sec-4-6 .th-grp { border: 2px solid var(--c); background: color-mix(in srgb, var(--c) 7%, var(--panel)); border-radius: 12px; padding: 8px 10px; display: flex; flex-direction: column; gap: 6px; } /* a thread-group box: border and faint background in the group's color (from --c) */
      .sec-4-6 .th-grp .hd { font-size: 13.5px; font-weight: 800; color: var(--c); line-height: 1.3; } /* the heading of a group box: name, TGID and memory map, in the group's color */
      .sec-4-6 .th-tasks { display: flex; gap: 6px; } /* the task buttons inside a group box sit in one row */
      .sec-4-6 .th-task { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 1px; padding: 7px 4px; border: 2px solid var(--line); border-radius: 10px; background: var(--panel); cursor: pointer; font: inherit; color: var(--ink); } /* each task button: its ID above its role, in a bordered card the student clicks to run that task */
      .sec-4-6 .th-task b { font-family: var(--mono); font-size: 15.5px; } /* the task ID is large and in code font */
      .sec-4-6 .th-task span { font-size: 12.5px; color: var(--muted); } /* the task's role (main thread, worker, running) is small and grey */
      .sec-4-6 .th-task:hover { border-color: var(--c); } /* hovering a task button shows the group color on its border */
      .sec-4-6 .th-task.run { border-color: var(--c); box-shadow: 0 0 0 2px var(--c); background: color-mix(in srgb, var(--c) 18%, var(--panel)); } /* the running task gets a colored ring and a tinted background */
      .sec-4-6 .th-task.run span { color: var(--c); font-weight: 800; } /* the running task's label says "running" in bold group color */
      .sec-4-6 .th-steps { display: grid; gap: 3px; font-size: 14.5px; line-height: 1.35; } /* the three context-switch steps are stacked in a small grid */
      .sec-4-6 .th-steps div { display: flex; gap: 8px; } /* each switch step is a row: an icon or number, then the text */
      .sec-4-6 .th-steps b { width: 16px; flex: none; text-align: center; } /* the step icon column has a fixed width so the texts line up */
      .sec-4-6 .th-steps .skip { color: var(--ok); } /* a skipped step (memory map stays loaded) is shown in green */
      .sec-4-6 .th-steps .cost { color: var(--bad); } /* a costly step (memory map must change) is shown in red */
      .sec-4-6 .th-hist { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; font-family: var(--mono); font-size: 13px; min-height: 24px; } /* the run history row: task IDs joined by arrows, in code font, wrapping as needed */
      .sec-4-6 .th-hist .tk { padding: 1px 6px; border-radius: 6px; font-weight: 800; background: color-mix(in srgb, var(--c) 16%, var(--panel)); color: var(--c); } /* each task ID in the history is a small tinted tag in its group's color */
      .sec-4-6 .th-hist .hv { color: var(--bad); font-weight: 900; font-size: 17px; line-height: 1; } /* the double arrow that marks a memory-map change is big, bold and red */
      .sec-4-6 .th-hist .lt { color: var(--muted); } /* the single arrow for a switch inside one group is grey */
      .sec-4-6 .th-ps { font-family: var(--mono); font-size: 14px; white-space: pre; background: var(--panel-3); border-radius: 10px; padding: 7px 12px; line-height: 1.5; margin: 0; overflow: hidden; } /* the ps and ps -L output box: code font, keeps spaces as typed so columns line up, grey panel */
      .sec-4-6 .th-ps b { color: var(--muted); } /* the column headings of the ps output are grey */
      /* step 5: clone() flag builder */
      .sec-4-6 .cf-flag { display: grid; grid-template-columns: 36px 124px minmax(0, 1fr); align-items: center; gap: 0 10px; padding: 6px 10px; border: 1.5px solid var(--line); border-radius: 10px; background: var(--panel-2); cursor: pointer; font: inherit; color: var(--ink); text-align: left; width: 100%; transition: background .15s, border-color .15s; } /* step 5: each main flag button is a grid of switch, flag name and meaning */
      .sec-4-6 .cf-flag:hover { border-color: var(--ok); } /* hovering a flag button shows a green border */
      .sec-4-6 .cf-sw { width: 36px; height: 20px; border-radius: 99px; background: var(--line-2); position: relative; transition: background .15s; } /* the switch track drawn inside each flag button: a grey rounded bar */
      .sec-4-6 .cf-sw::after { content: ''; position: absolute; top: 3px; left: 3px; width: 14px; height: 14px; border-radius: 50%; background: var(--panel); transition: left .15s; } /* the switch knob: a small white circle drawn after the track, at the left end */
      .sec-4-6 .cf-flag.on { border-color: var(--ok); background: var(--ok-bg); } /* a flag that is on gets a green border and green-tinted background */
      .sec-4-6 .cf-flag.on .cf-sw { background: var(--ok); } /* the track of a switched-on flag turns green */
      .sec-4-6 .cf-flag.on .cf-sw::after { left: 19px; } /* the knob of a switched-on flag slides to the right end */
      .sec-4-6 .cf-flag b { font-family: var(--mono); font-size: 14px; line-height: 1.3; } /* flag names are shown in bold code font */
      .sec-4-6 .nrw .cf-flag { grid-template-columns: 36px minmax(0, 1fr); } /* on small screens the flag button drops to two columns: switch, then name */
      .sec-4-6 .nrw .cf-flag span { grid-column: 2; } /* on small screens the flag's meaning moves under its name in the second column */
      .sec-4-6 .cf-flag span { font-size: 13.5px; color: var(--ink-2); line-height: 1.3; } /* the flag's meaning is small and slightly muted */
      .sec-4-6 .cf-x { font-family: var(--mono); font-size: 12.5px; } /* the extra-flag buttons use small code font */
      .sec-4-6 .cf-verdict { border-left: 6px solid var(--c); } /* the verdict card gets a stripe in the verdict's color */
      .sec-4-6 .cf-verdict h3 { color: var(--c); font-size: 18px; margin: 0 0 2px; } /* the verdict title, such as "A thread of the same process", in that same color */
      .sec-4-6 .cf-svg .lab { font-size: 14px; font-weight: 800; } /* resource names in the sharing diagram, bold */
      .sec-4-6 .cf-svg .flag { font-size: 12.5px; font-family: var(--mono); font-weight: 700; fill: var(--muted); } /* the flag names under each resource in the diagram, grey code font */
      .sec-4-6 .cf-svg .flag.on { fill: var(--ok); } /* a flag that is on is drawn green in the diagram */
      .sec-4-6 .cf-svg .val { font-size: 14px; font-weight: 650; } /* the values inside the diagram's boxes, such as x = 5 */
      .sec-4-6 .cf-svg .sub { font-size: 12.5px; fill: var(--muted); } /* the small grey second line under the caller and new-task headings */
      .sec-4-6 .cf-err { border: 2px solid var(--bad); background: var(--bad-bg); border-radius: 12px; padding: 14px 16px; } /* the red box that replaces the diagram when the flags break a rule */
      .sec-4-6 .cf-err h3 { color: var(--bad); } /* the heading of that error box is red */
      /* step 6: the five other clone() flags */
      .sec-4-6 .xf-ref { border: 1.5px solid var(--line); border-left: 5px solid var(--thread); border-radius: 10px; padding: 6px 12px 7px; background: var(--panel-2); transition: background .15s, border-color .15s; } /* step 6: each reference card for an extra flag has a stripe in the thread color on its left */
      .sec-4-6 .xf-ref > .row b { font-family: var(--mono); font-size: 14.5px; } /* the flag name at the top of a reference card is in code font */
      .sec-4-6 .xf-ref .chip { font-size: 12.5px; padding: 1px 8px; } /* the "used by" chip on a reference card is a little smaller */
      .sec-4-6 .xf-d { font-size: 14px; line-height: 1.38; color: var(--ink-2); margin-top: 2px; } /* the longer explanation on each reference card, in small muted text */
      .sec-4-6 .xf-ref.ok { background: var(--ok-bg); border-color: var(--ok); } /* the reference card for the right answer turns green */
      .sec-4-6 .xf-ref.bad { background: var(--bad-bg); border-color: var(--bad); } /* the reference card for a wrong pick turns red */
      .sec-4-6 .xf-scen { flex: none; font-size: 16.5px; line-height: 1.5; padding: 12px 16px; border-radius: 12px; background: var(--panel-2); border: 1px solid var(--line); border-left: 5px solid var(--chc); min-height: 112px; } /* the scenario box of the game: larger text; min-height stops the layout jumping between rounds */
      .sec-4-6 .xf-scen .big { text-align: center; } /* the final score inside the scenario box is centered */
      .sec-4-6 .xf-picks .cf-x.ok { border-color: var(--ok); background: var(--ok-bg); color: var(--ok); } /* the flag button picked correctly turns green */
      .sec-4-6 .xf-picks .cf-x.bad { border-color: var(--bad); background: var(--bad-bg); color: var(--bad); text-decoration: line-through; } /* a wrongly picked flag button turns red and is crossed out */
      /* step 7: namespaces */
      .sec-4-6 .ns-tg { display: grid; grid-template-columns: 30px minmax(0, 1fr); align-items: center; gap: 0 10px; padding: 5px 10px; border: 1.5px solid var(--line); border-radius: 10px; background: var(--panel-2); cursor: pointer; font: inherit; color: var(--ink); text-align: left; width: 100%; } /* step 7: each namespace toggle is a grid of a small switch and its name and meaning */
      .sec-4-6 .ns-tg:hover { border-color: var(--ok); } /* hovering a namespace toggle shows a green border */
      .sec-4-6 .ns-tg .cf-sw { width: 30px; height: 18px; grid-row: span 2; } /* the namespace switch is a bit smaller and spans both text lines */
      .sec-4-6 .ns-tg .cf-sw::after { width: 12px; height: 12px; } /* the knob of the smaller switch is smaller too */
      .sec-4-6 .ns-tg.on { border-color: var(--ok); background: var(--ok-bg); } /* a namespace that is on gets a green border and tinted background */
      .sec-4-6 .ns-tg.on .cf-sw { background: var(--ok); } /* its switch track turns green */
      .sec-4-6 .ns-tg.on .cf-sw::after { left: 15px; } /* its knob slides to the right end of the smaller track */
      .sec-4-6 .ns-tg b { font-size: 14.5px; line-height: 1.25; } /* the namespace name in each toggle, bold */
      .sec-4-6 .ns-tg span { font-size: 12.5px; color: var(--ink-2); line-height: 1.25; } /* the short "what it isolates" line under each namespace name */
      .sec-4-6 .ns-tbl { display: grid; grid-template-columns: 112px repeat(3, minmax(0, 1fr)); gap: 6px; } /* the table: a label column plus three equal columns for the host, container A and container B */
      .sec-4-6 .ns-th { font-size: 13px; font-weight: 800; padding: 4px 8px; border-radius: 8px; background: var(--panel-3); } /* the column headings of the table on grey tabs */
      .sec-4-6 .ns-rl { display: flex; flex-direction: column; justify-content: center; padding: 2px 0; } /* the row label on the left: namespace name above its clone() flag */
      .sec-4-6 .ns-rl b { font-size: 14.5px; } /* the namespace name in the row label */
      .sec-4-6 .ns-rl code { font-size: 11.5px; background: none; padding: 0; color: var(--muted); } /* the clone() flag in the row label, tiny grey code with no background */
      .sec-4-6 .ns-c { font-size: 13.5px; line-height: 1.32; padding: 6px 9px; border-radius: 9px; border: 1px solid var(--line); border-left-width: 5px; background: var(--panel-2); display: flex; align-items: center; min-height: 48px; transition: background .2s; } /* each table cell: small text in a bordered box with a thick left edge; min-height keeps rows even */
      .sec-4-6 .ns-c.own { background: var(--ok-bg); border-color: color-mix(in srgb, var(--ok) 40%, transparent); border-left-color: var(--ok); } /* a cell where the container has its own copy: green */
      .sec-4-6 .ns-c.shr { background: var(--warn-bg); border-color: color-mix(in srgb, var(--warn) 40%, transparent); border-left-color: var(--warn); } /* a cell where the container shares the host's copy harmlessly: orange */
      .sec-4-6 .ns-c.bad { background: var(--bad-bg); border-color: color-mix(in srgb, var(--bad) 40%, transparent); border-left-color: var(--bad); } /* a cell where sharing is a real problem: red */
      .sec-4-6 .ns-c.host { border-left-color: var(--line-2); } /* host cells keep a plain grey stripe */
      .sec-4-6 .ns-c.sel { box-shadow: 0 0 0 2px var(--accent); } /* cells of the namespace the student clicked last get an accent ring */
      .sec-4-6 .nrw .ns-tbl { grid-template-columns: 1fr; } /* on small screens the table collapses to one column */
      /* step 8: cgroups and containers */
      .sec-4-6 .cg-eq { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 14px; font-weight: 700; } /* step 8: the "namespaces + cgroups + own root files = container" line, wrapping on small screens */
      .sec-4-6 .cg-eq .box { font-size: 13.5px; padding: 5px 8px; line-height: 1.25; } /* the word boxes in that line are a little smaller */
      .sec-4-6 .cg-bar { display: flex; height: 28px; border-radius: 8px; overflow: hidden; background: var(--panel-3); border: 1px solid var(--line); } /* each usage bar (CPU, memory): a rounded strip whose colored segments add up to the whole */
      .sec-4-6 .cg-bar > i { display: grid; place-items: center; font-style: normal; font-size: 12.5px; font-weight: 800; color: var(--ink); white-space: nowrap; overflow: hidden; transition: width .25s; } /* each segment in a usage bar: centered label that is cut off if the segment is too thin; width changes animate */
      .sec-4-6 .cg-bar > i.a { background: var(--proc-bg); box-shadow: inset 0 0 0 2px var(--proc); } /* segment for container A, in the process color */
      .sec-4-6 .cg-bar > i.b { background: var(--io-bg); box-shadow: inset 0 0 0 2px var(--io); } /* segment for container B, in the I/O color */
      .sec-4-6 .cg-bar > i.o { background: var(--os-bg); box-shadow: inset 0 0 0 2px var(--os); } /* segment for the operating system's own memory */
      .sec-4-6 .cg-bar > i.x { background: var(--bad-bg); box-shadow: inset 0 0 0 2px var(--bad); color: var(--bad); } /* segment for memory the host does not have, in red: the shortfall */
      .sec-4-6 .cg-st { border-left: 5px solid var(--c); font-size: 14px; line-height: 1.4; } /* the two container status cards get a stripe whose color says how that container is doing (from --c) */
      .sec-4-6 .cg-st b.hd { display: block; font-size: 15px; color: var(--c); } /* the bold heading of a status card sits on its own line in the stripe color */
      .sec-4-6 .cg-files { font-family: var(--mono); font-size: 13px; color: var(--ink-2); background: var(--panel-3); border-radius: 8px; padding: 4px 10px; white-space: pre-wrap; } /* the box that shows the cgroup limit files: small code font on a grey panel, wrapping long lines */
      .sec-4-6 .cg-dim { opacity: .45; } /* the two limit sliders fade out while cgroups are off, because they have no effect then */
    `,  // end of the section's CSS text

    steps: [  // steps: the list of screens in this section, shown one at a time with Next and Back
      /* ---------------- 1. Big picture: one kind of task, many ways to share ---------------- */
      {  // step 1 starts here
        title: 'One kind of task, many ways to share',  // step 1 title shown above the screen
        kind: 'story',  // kind "story": an introduction screen rather than a lab or a quiz
        render(el, ctx) {  // render(el, ctx): builds step 1 inside el when the student arrives; ctx carries the guide's helpers
          const { h, s } = ctx;  // h builds ordinary page elements and s builds SVG (the browser's drawing format) elements
          const RES = [  // RES: the four resources drawn for each pair of tasks, each with a color key and a label
            { k: 'mem', name: 'memory (address space)' },  // resource row: memory, colored with the memory color
            { k: 'io', name: 'open files' },  // resource row: open files, colored with the I/O color
            { k: 'os', name: 'current + root directory' },  // resource row: current and root directory, colored with the operating-system color
            { k: 'intr', name: 'signal handlers' },  // resource row: signal handlers, colored with the interrupt color
          ];  // closes RES
          const SCENES = {  // SCENES: the caption shown under the drawing for each of the three scenes
            proc: '<b>Two processes.</b> When a program calls fork(), the new task gets its <b>own copy</b> of everything. A change on one side never shows up on the other. Both are still described by an ordinary <span class="t">task_struct</span>.',  // caption for "Two processes": fork() gives the new task its own copy of everything
            thr: '<b>Two threads of one program.</b> The second task was created with <span class="t">clone()</span> flags that <b>share</b> memory, open files, directories and signal handlers. It still has its own task_struct, registers, stack and task ID (TID), yet getpid() reports one shared process ID. There is no separate "thread" record.',  // caption for "Two threads": clone() flags share the resources, but each task keeps its own task_struct
            ctr: '<b>Two containers.</b> Still ordinary tasks, but <span class="t" data-t="namespace">namespaces</span> give each one its own view of the system (its own PID 1, hostname and network), and a <span class="t">cgroup</span> caps how much CPU and memory it may use.',  // caption for "Two containers": namespaces give each its own view and a cgroup caps its use
          };  // closes SCENES
          const svg = s('svg', { viewBox: '0 0 600 336', width: '100%', role: 'img', 'aria-label': 'Two tasks and the resources they own or share' });  // the drawing area, 600 by 336 units, that scales to the width of its card
          const cap = h('div', { class: 'player-cap' });  // cap is the caption box under the drawing
          const box = (x, y, w, hh, cls, txt, fs) => s('g', {},  // box(...): helper that draws a rounded rectangle with centered text, used for the resource rows
            s('rect', { x, y, width: w, height: hh, rx: 10, class: cls, 'stroke-width': 2 }),  // the rectangle part of the box, colored by its CSS class
            s('text', { x: x + w / 2, y: y + hh / 2 + 5, 'text-anchor': 'middle', 'font-size': fs || 14.5, 'font-weight': 650 }, txt));  // the text part, centered in the box; fs lets a caller pick a smaller font
          function draw(sc) {  // draw(sc): redraws the picture and caption for scene sc (proc, thr or ctr); runs on each scene click
            const thr = sc === 'thr', ctr = sc === 'ctr';  // thr and ctr say which scene is being drawn
            const kids = [];  // kids collects every shape of the new picture before it goes on screen in one step
            const top = ctr ? 32 : 18;  // containers need room at the top for their labels, so the task boxes start lower
            if (ctr) {  // only the container scene draws the two dashed container outlines
              [14, 314].forEach((x, i) => {  // one outline on the left (A) and one on the right (B)
                kids.push(s('rect', { x, y: 4, width: 272, height: 328, rx: 16, class: 's-accent', 'stroke-width': 2, 'stroke-dasharray': '7 5', 'fill-opacity': 0.35 }));  // the dashed, faintly filled rectangle around each container
                kids.push(s('text', { x: x + 12, y: 22, 'font-size': 13, 'font-weight': 800, style: 'fill:var(--accent)' }, 'CONTAINER ' + (i ? 'B' : 'A')));  // the "CONTAINER A" or "CONTAINER B" label in its top corner
              });  // ends the loop over the two containers
            }  // ends the container-only part
            ['A', 'B'].forEach((n, i) => {  // draws the header box for task A and task B
              const x = i ? 330 : 30;  // task A goes on the left, task B on the right
              const id = ctr ? 'PID 1 inside' : (thr ? 'TID ' : 'PID ') + (1201 + i);   // threads: own task IDs, one shared PID (TGID)
              kids.push(s('g', {},  // groups the header box and its two lines of text
                s('rect', { x, y: top, width: 240, height: 54, rx: 12, class: thr ? 's-thread' : 's-proc', 'stroke-width': 2.5 }),  // the header box, in the thread color for threads and the process color otherwise
                s('text', { x: x + 120, y: top + 23, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 15.5 }, `task ${n} (${id})`),  // first line: the task's name and ID
                s('text', { x: x + 120, y: top + 43, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, 'own task_struct, registers, stack')));  // second line: every task has its own task_struct, registers and stack
            });  // ends the loop over the two tasks
            const r0 = top + (ctr ? 70 : 76), dy = ctr ? 44 : 46;  // r0 is where the first resource row starts and dy is the spacing between rows
            RES.forEach((r, i) => {  // draws one row for each of the four resources
              const y = r0 + i * dy;  // y is this row's vertical position
              if (thr) kids.push(box(30, y, 540, 36, 's-' + r.k, 'one shared ' + r.name));  // threads: one wide box across both sides, because there is only one shared copy
              else {  // processes and containers: a separate box on each side
                kids.push(box(30, y, 240, 36, 's-' + r.k, 'A\'s ' + r.name, 14));  // A's own copy of this resource
                kids.push(box(330, y, 240, 36, 's-' + r.k, 'B\'s ' + r.name, 14));  // B's own copy of this resource
                if (!ctr) kids.push(s('line', { x1: 274, y1: y + 18, x2: 322, y2: y + 18, class: 's-line', 'stroke-dasharray': '4 4', 'marker-end': 'url(#arr)' }));  // processes only: a dashed arrow from A to B shows the copy made at fork()
              }  // ends the two-box case
            });  // ends the loop over resources
            const yb = r0 + 3 * dy + 36 + (ctr ? 22 : 16);  // yb is where the bottom text goes, just below the last resource row
            if (sc === 'proc') kids.push(s('text', { x: 300, y: yb + 10, 'text-anchor': 'middle', 'font-size': 14, class: 's-sub' }, 'B received copies at fork(): after that, each side changes only its own'));  // process scene: a note that each side changes only its own copy after fork()
            if (thr) kids.push(s('text', { x: 300, y: yb + 10, 'text-anchor': 'middle', 'font-size': 14, class: 's-sub' }, 'one copy of each, used by both tasks (getpid() → 1201 in both): A\'s writes are seen by B'));  // thread scene: a note that both tasks use one copy, so writes by A are seen by B
            if (ctr) [14, 314].forEach((x) => {  // container scene: two lines under each container
              kids.push(s('text', { x: x + 136, y: yb - 2, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 700 }, 'sees: own PIDs, hostname, network'));  // what the container can see: its own PIDs, hostname and network
              kids.push(s('text', { x: x + 136, y: yb + 17, 'text-anchor': 'middle', 'font-size': 13.5, class: 's-sub' }, 'may use: at most 1 CPU, 512 MB'));  // what the container may use: the cgroup limit of 1 CPU and 512 MB
            });  // ends the loop over the two containers
            svg.replaceChildren(...kids);  // swaps the old picture for the new shapes in one step
            cap.innerHTML = SCENES[sc];  // shows the matching caption under the picture
          }  // ends draw()
          const seg = ctx.ui.seg([{ value: 'proc', label: 'Two processes' }, { value: 'thr', label: 'Two threads' }, { value: 'ctr', label: 'Two containers' }], 'proc', draw);  // the three scene buttons; clicking one calls draw() with that scene's value
          const left = h('div', { class: 'stack', style: { gap: '10px' } },  // left column: the explanation text
            h('p', { class: 'lead m0', html: 'Many operating systems, Windows among them, keep one record per process and a separate, smaller one per thread. <b>Linux keeps just one kind.</b>' }),  // opening sentence: other systems keep separate process and thread records, Linux keeps one kind
            h('p', { class: 'm0', html: 'The thing Linux schedules is the <span class="t" data-t="Linux task">task</span> (not the resource-owning “task” of section 4.1). Every process and every thread is a task, described by the same structure, the <span class="t">task_struct</span>. Two tasks count as two processes or as two threads of one process purely by <b>how much they share</b>.' }),  // paragraph: Linux schedules tasks, and sharing alone makes them processes or threads
            h('div', { class: 'callout analogy m0', 'data-label': 'Analogy', html: 'An office building gives everyone the same kind of badge. People from different companies rent separate offices; teammates share one office and one filing cabinet. Same badge, different sharing.' }),  // analogy box: one kind of badge, different sharing of offices
            h('div', { class: 'callout warn m0', 'data-label': 'Common mistake', html: 'Picturing a Linux thread as a smaller, different kind of record. Each thread has a full task_struct of its own; it is cheap because it <b>shares</b>, not because it is small.' }),  // common-mistake box: a Linux thread is not a smaller record; it is cheap because it shares
            h('div', { class: 'row gap-s', html: '<span class="lbl">Coming up</span><span class="chip proc">task_struct</span><span class="chip">5 states</span><span class="chip thread">clone() flags</span><span class="chip accent">namespaces</span><span class="chip io">cgroups</span>' }));  // "Coming up" row of chips previewing the topics of this section
          const right = h('div', { class: 'card white stack', style: { gap: '8px' } },  // right column: a white card holding the scene buttons, the drawing and its caption
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'lbl' }, 'Click a scene'), seg),  // top row of the card: the "Click a scene" label on the left and the scene buttons on the right
            h('div', { class: 'grow', style: ctx.narrow ? { overflowX: 'auto' } : { display: 'grid', placeItems: 'center' } }, svg), cap);  // the drawing sits in a growing area; on phones it scrolls sideways instead of being centered
          if (ctx.narrow) svg.style.minWidth = '520px';   // phones: pan sideways rather than shrink the labels
          el.append(h('div', { class: 'split l fill' }, left, right));  // puts the two columns on the screen side by side
          draw('proc');  // draws the process scene first, so the screen is never empty
        },  // ends render() for step 1
      },  // ends step 1

      /* ---------------- 2. task_struct inspector + sorting game ---------------- */
      {  // step 2 starts here: the task_struct inspector and sorting game
        title: 'Inside task_struct: the kernel\'s record of a task',  // step 2 title
        kind: 'explore',  // kind "explore": the student clicks around to learn
        render(el, ctx) {  // render(): builds step 2 when the student arrives
          const { h } = ctx;  // h builds ordinary page elements
          let mode = 'explore', sel = 1;  // mode is "explore" or "sort"; sel is the group being inspected in explore mode
          const game = { i: 0, tries: 0, res: [] };          // res[i] = 'ok' (first try) or 'late'
          let fb = null, nextBtn = null, dots = null, locked = false;  // fb is the feedback box, nextBtn the Next button, dots the progress row; locked stops clicks after a right answer
          const rows = TS_CATS.map((c, i) => h('button', { class: 'ts-row', type: 'button', style: { '--c': COLS[c.col] }, onclick: () => pick(i) },  // rows: one button per task_struct group, colored by that group; a click goes to pick()
            h('b', {}, c.name), h('span', { class: 'ts-fields' }, ...c.fields.map((f) => h('code', {}, f)))));  // each group button shows the group name and its field names as code chips
          const left = h('div', { class: 'stack', style: { gap: '6px' } },  // left column: the task_struct drawn as a C structure
            h('div', { class: 'ts-brace' }, 'struct task_struct {   // one for every task'),  // the opening line "struct task_struct {" with a note that every task has one
            h('div', { class: 'ts-list' }, ...rows),  // the nine group buttons between the braces
            h('div', { class: 'ts-brace' }, '};'));  // the closing brace of the structure
          const panel = h('div', { class: 'grow', style: { minHeight: 0 } });  // panel is the right-hand area that shows either the inspector or the game
          const seg = ctx.ui.seg([{ value: 'explore', label: 'Explore the nine groups' }, { value: 'sort', label: 'Sort 12 real fields' }], mode, (v) => { mode = v; paint(); });  // the mode switch; changing it stores the new mode and repaints the panel
          const right = h('div', { class: 'card white stack', style: { gap: '12px' } }, h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'lbl' }, 'Mode'), seg), panel);  // right column: a white card with the Mode label and switch on top and the changing panel below
          el.append(h('div', { class: 'split l fill' }, left, right));  // puts the struct on the left and the card on the right

          function pick(i) {  // pick(i): runs when the student clicks group i on the left
            if (mode === 'explore') { sel = i; paint(); } else answer(i);  // in explore mode the click selects that group; in sort mode it counts as an answer
          }  // ends pick()
          function paint() {  // paint(): redraws step 2 after any change of mode, selection or game progress
            rows.forEach((r, i) => { r.classList.remove('ok', 'bad'); r.classList.toggle('on', mode === 'explore' && i === sel); });  // clears game colors from every group and highlights the selected one (explore mode only)
            panel.replaceChildren(mode === 'explore' ? exploreView() : sortView());  // fills the right-hand panel with the inspector or the game, depending on the mode
          }  // ends paint()
          function exploreView() {  // exploreView(): builds the inspector card for the selected group
            const c = TS_CATS[sel];  // c is the selected group's entry in TS_CATS
            return h('div', { class: 'stack fade-in', style: { gap: '12px' } },  // returns a column that fades in
              h('div', { class: 'row', style: { justifyContent: 'space-between' } },  // top row: the group name and a "group n of 9" chip
                h('h3', { class: 'm0', style: { color: COLS[c.col] } }, c.name), h('span', { class: 'chip' }, `group ${sel + 1} of 9`)),  // the group name in its own color, and the chip with its position
              h('div', {}, h('div', { class: 'lbl' }, 'What it holds'), h('p', { class: 'p15 m0', html: c.what })),  // "What it holds" label and paragraph
              h('div', {}, h('div', { class: 'lbl' }, 'Why the kernel needs it'), h('p', { class: 'p15 m0', html: c.why })),  // "Why the kernel needs it" label and paragraph
              h('div', {}, h('div', { class: 'lbl', style: { marginBottom: '4px' } }, 'Example: a text editor, PID 4213'), h('div', { class: 'ts-eg', html: c.eg })),  // the example box, using a text editor with PID 4213 as the running example
              h('div', { class: 'callout tip m0', 'data-label': 'Where you have seen this before', html: 'The <span class="t">task_struct</span> is Linux\'s version of the <span class="t">process control block (PCB)</span>, and of the TCB too, since each thread is a task. The real one has well over a hundred fields; these nine groups are the map. Click any group on the left.' }));  // tip linking task_struct to the process control block (PCB) and thread control block seen earlier
          }  // ends exploreView()
          function sortView() {  // sortView(): builds the sorting game, or the score screen once every field is sorted
            if (game.i >= TS_SORT.length) {  // all twelve fields done: show the final score
              const ok = game.res.filter((r) => r === 'ok').length;  // ok counts the fields sorted right on the first try
              return h('div', { class: 'stack fade-in', style: { alignItems: 'center', justifyContent: 'center', textAlign: 'center', height: '100%' } },  // returns a centered column for the score screen
                h('div', { class: 'lbl' }, 'Sorted right on the first try'),  // label over the score
                h('div', { class: 'big' }, `${ok} / ${TS_SORT.length}`),  // the score in large type, such as 10 / 12
                dotsEl(),  // the row of colored dots showing which fields needed a second try
                h('p', { class: 'p15 m0', style: { maxWidth: '520px' } }, ok === TS_SORT.length ? 'Perfect. You know your way around a task_struct.' : 'Orange dots needed a second try. Switch to "Explore the nine groups" to review those categories, then sort again.'),  // a closing message: praise for a perfect run, otherwise advice to review and try again
                h('button', { class: 'btn primary', type: 'button', onclick: restart }, 'Sort them again'));  // button that restarts the game from the first field
            }  // ends the score screen
            const [f, , hint] = TS_SORT[game.i];  // f is the field to sort and hint is its plain-language clue (the middle item, the answer, is skipped)
            fb = h('div', { class: 'ts-fb', html: 'Click the group on the left where the kernel keeps this field.' });  // a fresh feedback box with the starting instruction
            nextBtn = h('button', { class: 'btn primary', type: 'button', disabled: true, onclick: next }, game.i === TS_SORT.length - 1 ? 'See my score' : 'Next field →');  // the Next button, disabled until the right group is found; on the last field it says "See my score"
            locked = false;  // a new field starts unlocked, so clicks count
            if (game.res[game.i]) {   // came back to a field that was already answered (e.g. after switching modes)
              const want = TS_SORT[game.i][1];  // want is the index of the correct group for this field
              locked = true; nextBtn.disabled = false; rows[want].classList.add('ok');  // lock the field, enable Next and color the correct group green
              fb.className = 'ts-fb ok';  // turns the feedback box green
              fb.innerHTML = `<b>Already sorted.</b> <code>${ctx.util.esc(f)}</code> belongs to <b>${TS_CATS[want].name}</b>. Press the button to continue.`;  // explains the field was already sorted; esc() makes the field text safe to put inside HTML
            }  // ends the already-answered case
            return h('div', { class: 'stack fade-in', style: { gap: '12px' } },  // returns the game screen as a column
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'lbl' }, `Field ${game.i + 1} of ${TS_SORT.length}`), dots = dotsEl()),  // top row: "Field n of 12" and the progress dots, kept in dots so answer() can update them
              h('div', { class: 'card', style: { textAlign: 'center' } }, h('div', { class: 'ts-q' }, f), h('div', { class: 'small muted' }, hint)),  // the field to sort, big and centered, with its hint underneath
              fb,  // the feedback box
              h('div', { class: 'row' }, nextBtn, h('button', { class: 'btn ghost sm', type: 'button', onclick: restart }, 'Start over')),  // the Next button beside a "Start over" button
              h('div', { class: 'callout why m0', 'data-label': 'Notice the arrows', html: 'An arrow (→) marks a <b>pointer</b>. The task_struct does not contain the open-file table or the memory map itself, only the address of one. That is what later lets two tasks point at the <b>same</b> table and share it.' }));  // note explaining that an arrow in a field marks a pointer, which is what makes sharing possible
          }  // ends sortView()
          function dotsEl() {  // dotsEl(): builds the row of progress dots
            return h('div', { class: 'ts-dots' }, ...TS_SORT.map((_, i) => h('i', { class: game.res[i] || (i === game.i ? 'cur' : '') })));  // one dot per field: green or orange once answered, a ring for the current field, empty otherwise
          }  // ends dotsEl()
          function answer(i) {  // answer(i): checks the student's click on group i against the current field
            if (locked || game.i >= TS_SORT.length) return;  // ignores clicks after a right answer or after the game is over
            const [f, want] = TS_SORT[game.i];  // f is the field text and want the index of the right group
            const c = TS_CATS[want];  // c is the right group's entry, used in the feedback
            rows.forEach((r) => r.classList.remove('ok', 'bad'));  // clears last click's green or red
            game.tries++;  // counts this attempt, so the score knows whether it was the first try
            if (i === want) {  // the click is right
              locked = true;  // lock the field so further clicks do nothing
              game.res[game.i] = game.tries === 1 ? 'ok' : 'late';  // records "ok" for a first-try success, "late" otherwise
              rows[i].classList.add('ok');  // colors the clicked group green
              fb.className = 'ts-fb ok';  // turns the feedback box green
              fb.innerHTML = `<b>${game.tries === 1 ? 'Right.' : 'Right, on a later try.'}</b> <code>${ctx.util.esc(f)}</code> belongs to <b>${c.name}</b>: ${c.what}`;  // says right, names the group and repeats what that group holds
              nextBtn.disabled = false;  // enables the Next button
              dots.replaceWith(dots = dotsEl());  // replaces the dot row so the new dot color shows
            } else {  // the click is wrong
              rows[i].classList.add('bad');  // colors the clicked group red
              fb.className = 'ts-fb bad';  // turns the feedback box red
              fb.innerHTML = `<b>Not ${TS_CATS[i].name}.</b> That group holds: ${TS_CATS[i].what} Try another group.`;  // says which group it was not and what that group holds, so the student learns from the mistake
            }  // ends the wrong-answer case
          }  // ends answer()
          function next() { game.i++; game.tries = 0; paint(); }  // next(): moves to the next field with a fresh try count and redraws
          function restart() { game.i = 0; game.tries = 0; game.res = []; paint(); }  // restart(): clears the game back to the first field with no results
          paint();  // draws step 2 for the first time
        },  // ends render() for step 2
      },  // ends step 2

      /* ---------------- 3. Linux state machine lab ---------------- */
      {  // step 3 starts here: the Linux state-machine lab
        title: 'Five Linux states: drive a task through its life',  // step 3 title
        kind: 'lab',  // kind "lab": a hands-on experiment
        core: true,  // core: true keeps this step on the shorter "core path" through the guide
        render(el, ctx) {  // render(): builds step 3 when the student arrives
          const { h, s } = ctx;  // h builds page elements, s builds SVG drawing elements
          const svg = s('svg', { viewBox: '0 0 720 312', width: '100%', role: 'img', 'aria-label': 'Linux task state diagram', style: 'flex: none' });  // the state diagram, 720 by 312 units; flex none stops it from shrinking
          const boxes = {}, arrows = {};  // boxes maps each state name to its drawn group; arrows maps each arrow name to its drawn group
          const B = (id, x, y, w, hh, cls, t1, t2) => {  // B(...): draws one state box with a title and a second line, and records it under its id
            const g = s('g', { class: 'ls-box' },  // a group so the box and its text can be highlighted together
              s('rect', { x, y, width: w, height: hh, rx: 11, class: cls }),  // the rounded rectangle, colored by its class
              s('text', { x: x + w / 2, y: y + hh / 2 - 2, 'text-anchor': 'middle', class: 't1' }, t1),  // the state's name, centered a little above the middle
              s('text', { x: x + w / 2, y: y + hh / 2 + 16, 'text-anchor': 'middle', class: 't2' }, t2));  // the state's second line, centered below the name
            g.at = [x + w - 3, y + 3];  // at is the point near the box's top-right corner where the marker dot goes when the task is in this state
            boxes[id] = g; return g;  // stores the box under its id and returns it for drawing
          };  // ends B()
          const A = (id, d, label, lx, ly, anchor) => {  // A(...): draws one arrow with a label and records it under its id
            const g = s('g', { class: 'ls-arr' }, s('path', { d, 'marker-end': 'url(#arr-muted)' }), s('text', { x: lx, y: ly, 'text-anchor': anchor || 'middle' }, label));  // the arrow path with a grey arrowhead, and its label at (lx, ly)
            arrows[id] = g; return g;  // stores the arrow so lsEvent's arrow names can light it up
          };  // ends A()
          const start = s('g', { class: 'ls-box' }, s('circle', { cx: 28, cy: 143, r: 9, class: 's-panel', 'stroke-width': 2 }), s('text', { x: 28, y: 172, 'text-anchor': 'middle', class: 't2' }, 'start'));  // the small start circle on the left, the "state" before fork() creates the task
          start.at = [34, 136]; boxes.none = start;  // where the marker dot sits before any task exists
          const gone = s('g', { class: 'ls-box' }, s('circle', { cx: 660, cy: 246, r: 16, class: 's-panel', 'stroke-width': 2, 'stroke-dasharray': '4 3' }), s('text', { x: 660, y: 251, 'text-anchor': 'middle', class: 't1' }, '✗'), s('text', { x: 660, y: 284, 'text-anchor': 'middle', class: 't2' }, 'freed'));  // the dashed circle with a cross and the word "freed", for a task whose task_struct is gone
          gone.at = [671, 233]; boxes.gone = gone;  // where the marker dot sits once the task has been freed; stored as the "gone" state's box
          svg.append(  // adds the background, arrows and boxes to the diagram; later items are drawn on top of earlier ones
            s('rect', { x: 100, y: 82, width: 460, height: 112, rx: 16, class: 's-proc', 'stroke-width': 1.5, 'fill-opacity': 0.3, 'stroke-dasharray': '6 4' }),  // a faint dashed region around Ready and Executing, because Linux counts both as the one Running state
            s('text', { x: 340, y: 101, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800, style: 'fill:var(--proc)' }, 'RUNNING (R)'),  // the "RUNNING (R)" heading of that region, in the process color
            A('create', 'M38 143 H147', 'fork()', 68, 135),  // arrow "fork()": from the start circle into Ready
            A('sched', 'M300 128 H377', 'scheduled', 339, 121),  // arrow "scheduled": Ready to Executing
            A('preempt', 'M380 158 H303', 'preempted', 341, 175),  // arrow "preempted": Executing back to Ready when the time slice ends
            A('stop', 'M475 112 V31 H418', 'SIGSTOP', 482, 76, 'start'),  // arrow "SIGSTOP": from Executing up and over into Stopped
            A('cont', 'M265 31 H205 V109', 'SIGCONT', 198, 76, 'end'),  // arrow "SIGCONT": from Stopped down into Ready
            A('exit', 'M530 143 H607', 'exit', 568, 136),  // arrow "exit": Executing to Zombie
            A('reap', 'M660 174 V227', 'wait()', 668, 206, 'start'),  // arrow "wait()": Zombie down to the freed circle
            A('toIntr', 'M485 174 V232 H439', 'wait', 479, 216, 'end'),  // arrow "wait" into Interruptible, from Executing
            A('toUnintr', 'M520 174 V284 H439', 'wait', 526, 264, 'start'),  // arrow "wait" into Uninterruptible, from Executing
            A('fromIntr', 'M236 232 H200 V177', 'wake', 207, 205, 'start'),  // arrow "wake" from Interruptible back to Ready
            A('fromUnintr', 'M236 284 H165 V177', 'wake', 158, 252, 'end'),  // arrow "wake" from Uninterruptible back to Ready
            start, gone,  // the start and freed circles made above
            B('ready', 150, 112, 150, 62, 's-proc', 'Ready', 'waiting for a CPU'),  // box for Ready, inside the Running region
            B('exec', 380, 112, 150, 62, 's-proc', 'Executing', 'on a CPU now'),  // box for Executing, inside the Running region
            B('stopped', 265, 8, 150, 48, 's-os', 'Stopped', 'T · until SIGCONT'),  // box for Stopped, above the Running region, with its ps letter T
            B('zombie', 610, 112, 100, 62, 's-panel', 'Zombie', 'Z · exited'),  // box for Zombie, on the right, with its ps letter Z
            B('intr', 236, 208, 200, 48, 's-warn', 'Interruptible', 'S · signals wake it'),  // box for Interruptible, below, with its ps letter S
            B('unintr', 236, 260, 200, 48, 's-intr', 'Uninterruptible', 'D · signals must wait'));  // box for Uninterruptible, at the bottom, with its ps letter D; closes the append
          const dot = s('circle', { r: 8, class: 'ls-dot', cx: 0, cy: 0 });  // the chapter-colored dot that marks the task's current state
          svg.append(dot);  // added last so it is drawn on top of every box and arrow

          const EV = [  // EV: the event buttons, in three rows by who causes the event: [row label, button color, [event, button text] list]
            ['Kernel', 'os', [['create', 'fork(): create'], ['sched', 'Schedule it'], ['slice', 'Time slice ends'], ['io', 'I/O completes']]],  // row "Kernel": create, dispatch, end of time slice and I/O completion
            ['The task', 'proc', [['key', 'read() keyboard'], ['disk', 'read() disk'], ['exit', 'exit()']]],  // row "The task": the calls the task itself makes
            ['Others', 'intr', [['usr1', 'SIGUSR1'], ['stop', 'SIGSTOP'], ['cont', 'SIGCONT'], ['kill', 'SIGKILL'], ['wait', 'Parent: wait()']]],  // row "Others": the four signals sent by other processes, and the parent's wait()
          ];  // closes EV
          const evGrid = h('div', { class: 'ls-ev' });  // evGrid holds the event rows
          EV.forEach(([lab, col, list]) => evGrid.append(h('span', { class: 'lbl' }, lab),  // for each row: its label in the first column...
            h('div', { class: 'row' }, ...list.map(([id, t]) => h('button', { class: 'btn sm ' + col, type: 'button', onclick: () => run(id) }, t)))));  // ...and its buttons in the second; each click runs that event through run()
          const mis = h('div', { class: 'ls-mis' });  // mis will list the four missions with their tick marks

          const stCard = h('div', { class: 'card ls-card stack', style: { gap: '6px' } });  // stCard is the card describing the current state
          const narr = h('div', { class: 'player-cap ls-narr', 'aria-live': 'polite' });  // narr is the narration box; aria-live makes screen readers announce each new message
          const pendEl = h('div', { class: 'row gap-s small' });  // pendEl lists the signals waiting to be handled
          const hist = h('div', { class: 'ls-hist' });  // hist is the row of ps letters, one per event that moved the task
          if (ctx.narrow) svg.style.minWidth = '620px';   // phones: keep labels readable and let the diagram pan sideways
          const svgBox = ctx.narrow ? h('div', { style: { overflowX: 'auto' } }, svg) : svg;  // on phones the diagram sits in a sideways-scrolling box; otherwise it is placed directly
          const left = h('div', { class: 'stack', style: { gap: '10px' } }, svgBox, evGrid, h('div', { class: 'card tight' }, h('div', { class: 'lbl', style: { marginBottom: '3px' } }, 'Missions'), mis));  // left column: the diagram, the event buttons and the missions card
          const right = h('div', { class: 'stack', style: { gap: '10px' } }, stCard, narr, pendEl, h('div', {}, h('div', { class: 'lbl', style: { marginBottom: '4px' } }, 'What ps would show, event by event'), hist),  // right column: state card, narration, pending signals and the ps history
            h('div', { class: 'callout tip m0', 'data-label': 'The four signals, and one rule', html: '<div class="ls-sig"><b>SIGUSR1</b><span>an ordinary signal; this program has a <span class="t" data-t="Signal handler">handler</span> for it</span><b>SIGSTOP</b><span>pause the task; it cannot be caught or ignored</span><b>SIGCONT</b><span>let a Stopped task carry on</span><b>SIGKILL</b><span>end the task; it cannot be caught or ignored</span></div>A task acts on its signals only when it runs: a signal can wake an <b>S</b> task so that it gets to run, but a <b>D</b> task must finish its hardware wait first.' }));  // tip box: what each of the four signals does, and the rule that a task acts on signals only when it runs
          el.append(h('div', { class: 'split fill' + (ctx.narrow ? ' nrw' : ''), style: { gridTemplateColumns: ctx.narrow ? '' : 'minmax(0, 1.55fr) minmax(0, 1fr)' } }, left, right));  // puts both columns on screen; wider left column on large screens, a phone-width class on small ones

          let st = 'none', pend = [], lit = [];  // st is the task's state name, pend its pending signals, lit the arrows to highlight
          const trail = [];  // trail holds the ps letters shown in the history row
          const done = [false, false, false, false];  // done records which of the four missions are complete
          function run(ev) {  // run(ev): runs when an event button is clicked; applies the event and redraws
            const r = lsEvent(st, pend, ev);  // asks lsEvent for the result of this event from the current state
            if (!r.warn) {  // refused events change nothing in the drawing or the history
              lit = r.arrs;  // highlight the arrows this event travelled
              if (r.st !== st || r.arrs.length) trail.push(LS[r.st].ps);  // adds the new ps letter if the state changed or an arrow was travelled
              if (trail.length > 16) trail.shift();  // keeps only the last 16 letters so the row stays one short line
            }  // ends the accepted-event case
            st = r.st; pend = r.pend;  // stores the new state and pending signals (unchanged for a refused event)
            if (r.mission >= 0) done[r.mission] = true;  // marks a mission complete if this event achieved one
            paint(r.msg, r.warn);  // redraws everything with the event's message
          }  // ends run()
          function paint(msg, warn) {  // paint(msg, warn): redraws the diagram, the state card and the lists; warn colors the narration orange
            Object.entries(boxes).forEach(([id, g]) => g.classList.toggle('cur', id === st));  // thickens the border of the current state's box only
            Object.entries(arrows).forEach(([id, g]) => { const on = lit.includes(id); g.classList.toggle('hi', on); g.firstChild.setAttribute('marker-end', on ? 'url(#arr-accent)' : 'url(#arr-muted)'); });  // lights the chosen arrows and gives them accent arrowheads; others go back to grey
            const [dx, dy] = boxes[st].at;  // looks up where the marker dot belongs for the current state
            dot.style.transform = `translate(${dx}px, ${dy}px)`;  // moves the dot there; the CSS transition animates the move
            const L = LS[st];  // L is the current state's entry in LS
            stCard.style.setProperty('--c', COLS[L.col] || 'var(--line-2)');  // sets the state card's stripe color to the state's color
            stCard.replaceChildren(  // rebuilds the state card
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { class: 'm0', style: { color: COLS[L.col] || 'var(--ink)' }, html: L.term ? `<span class="t" data-t="${L.term}">${L.name}</span>` : L.name }), h('span', { class: 'chip ' + (L.col === 'muted' ? '' : L.col) }, 'ps shows ' + L.ps)),  // heading: the state name (linked to its glossary entry when it has one) and a chip with its ps letter
              h('code', { style: { alignSelf: 'flex-start' } }, L.ps === '–' ? L.val : 'state = ' + L.val),  // the value of the task_struct state field, such as state = TASK_RUNNING
              h('p', { class: 'p15 m0', html: L.desc }));  // the state's description
            narr.classList.toggle('warn', !!warn);  // colors the narration box orange for a refused event
            narr.innerHTML = msg;  // shows the event's message
            pendEl.replaceChildren(h('span', { class: 'lbl' }, 'Pending signals'), ...(pend.length ? pend.map((p) => h('span', { class: 'chip intr' }, p)) : [h('span', { class: 'muted' }, 'none')]));  // shows each pending signal as a chip, or "none"
            hist.replaceChildren(...(trail.length ? trail.map((c, i) => h('span', { class: i === trail.length - 1 ? 'last' : '' }, c)) : [h('span', { class: 'muted small', style: { width: 'auto', background: 'none' } }, 'nothing yet')]));  // shows the ps letters, the newest highlighted, or "nothing yet" before any event
            mis.replaceChildren(...LS_MISSIONS.map((m, i) => h('div', { class: done[i] ? 'ok' : '' }, h('b', {}, done[i] ? '✓' : '○'), h('span', {}, m))));  // lists the missions, with a tick for done and a circle for not yet
          }  // ends paint()
          paint('Press <b>fork(): create</b> to make a task, then move it with the buttons. The diagram lights up the path each event takes, and the card explains the state it lands in.');  // first draw, with instructions in the narration box
        },  // ends render() for step 3
      },  // ends step 3

      /* ---------------- 4. Threads are tasks in one thread group ---------------- */
      {  // step 4 starts here: threads as tasks in one thread group
        title: 'Linux threads: tasks that share one thread group',  // step 4 title
        kind: 'explore',  // kind "explore"
        render(el, ctx) {  // render(): builds step 4 when the student arrives
          const { h } = ctx;  // h builds page elements
          const GR = {  // GR: the two programs (thread groups), each with its name, TGID, memory map letter and color
            web: { name: 'webserver', tgid: 800, mm: 'A', c: 'var(--thread)' },  // group "webserver": TGID 800, memory map A, thread color
            ed: { name: 'editor', tgid: 950, mm: 'B', c: 'var(--proc)' },  // group "editor": TGID 950, memory map B, process color
          };  // closes GR
          const TASKS = [  // TASKS: the four tasks the student can schedule, each with its ID, group and role
            { id: 800, g: 'web', role: 'main thread' }, { id: 801, g: 'web', role: 'worker' }, { id: 802, g: 'web', role: 'worker' },  // the webserver's main thread (800) and its two workers (801, 802)
            { id: 950, g: 'ed', role: 'main thread' },  // the editor's single main thread (950)
          ];  // closes TASKS
          const T = (id) => TASKS.find((t) => t.id === id);  // T(id): finds a task's entry by its ID
          let cur = 800, light = 0, heavy = 0, last = null;  // cur is the running task; light and heavy count the two kinds of switch; last describes the latest switch
          const hist = [800];  // hist lists the tasks that have run, starting with 800

          /* ---- left: explanation + the two ps views ---- */
          const PS = {  // PS: the two views of the same tasks, the output of ps and of ps -L, each with an explanation
            ps: { out: '<b>  PID CMD</b>\n  800 webserver\n  950 editor', why: 'One line per <b>process</b>. The PID column is really the thread group ID (TGID): getpid() returns 800 in all three webserver threads.' },  // plain ps: one line per process, and its PID column is really the TGID
            psl: { out: '<b>  PID   LWP CMD</b>\n  800   800 webserver\n  800   801 webserver\n  800   802 webserver\n  950   950 editor', why: 'One line per <b>task</b>. LWP ("lightweight process") is each task\'s own ID, the value gettid() returns. These four are what the scheduler really juggles.' },  // ps -L: one line per task, with each task's own ID in the LWP (lightweight process) column
          };  // closes PS
          const psOut = h('pre', { class: 'th-ps' });  // psOut is the box that shows the chosen command's output
          const psWhy = h('p', { class: 'small m0' });  // psWhy is the explanation under it
          const showPs = (k) => { psOut.innerHTML = PS[k].out; psWhy.innerHTML = PS[k].why; };  // showPs(k): puts view k's output and explanation on screen
          const psSeg = ctx.ui.seg([{ value: 'ps', label: 'ps' }, { value: 'psl', label: 'ps -L' }], 'ps', showPs);  // the two-button switch between ps and ps -L; a click calls showPs()
          const left = h('div', { class: 'stack', style: { gap: '10px' } },  // left column of step 4
            h('p', { class: 'lead m0', html: 'Classic UNIX gave each process exactly one thread. Linux has <b>no separate thread structure</b> at all.' }),  // opening sentence: Linux has no separate thread structure
            h('p', { class: 'm0 p15', html: 'A new thread is simply a new <span class="t" data-t="Linux task">task</span>, with its own task_struct, registers and stack, created so that it <b>shares</b> its creator\'s memory, open files, directories and signal handlers. All the tasks of one program form a <span class="t">thread group</span> and carry the same thread group ID (TGID).' }),  // paragraph: a thread is a new task that shares, and all tasks of one program form a thread group
            h('div', { class: 'card tight stack', style: { gap: '6px' } },  // a small card holding the ps comparison
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'lbl' }, 'Same tasks, two views'), psSeg), psOut, psWhy),  // its top row (label and switch), then the output and the explanation
            h('p', { class: 'small muted m0', html: 'In the terms of section 4.2, this is pure <b>kernel-level threading</b>, ULTs mapped one-to-one onto KLTs, so the threads of one program can run on different cores at once.' }));  // link back to the threading models seen earlier: one kernel thread per user thread
          showPs('ps');  // shows the plain ps view first

          /* ---- right: you are the scheduler ---- */
          const chipL = h('span', { class: 'chip ok' }), chipH = h('span', { class: 'chip bad' });  // two counters shown as chips: light switches (green) and heavy switches (red)
          const btns = {};  // btns maps each task ID to its button, so paint() can mark the running one
          const grpBox = (k) => h('div', { class: 'th-grp', style: { '--c': GR[k].c } },  // grpBox(k): builds the box for thread group k with its tasks inside
            h('div', { class: 'hd' }, `${GR[k].name} · TGID ${GR[k].tgid} · memory map ${GR[k].mm}`),  // the group's heading: name, TGID and which memory map it uses
            h('div', { class: 'th-tasks' }, ...TASKS.filter((t) => t.g === k).map((t) => (btns[t.id] = h('button', { class: 'th-task', type: 'button', onclick: () => pick(t.id) }, h('b', {}, String(t.id)), h('span', {}, t.role))))));  // one button per task in this group, showing ID and role; a click calls pick() with that task
          const cpu = h('div', { class: 'row gap-s small' });  // cpu is the line that says which task and memory map are loaded on the CPU
          const swTitle = h('div', { class: 'b', style: { fontSize: '15.5px' } });  // swTitle is the heading of the context-switch card
          const steps = h('div', { class: 'th-steps' });  // steps lists what the last switch had to do
          const meter = h('div', { class: 'meter', style: { flex: 1, height: '12px' } }, h('i'));  // meter is the bar that shows how costly the last switch was
          const histEl = h('div', { class: 'th-hist' });  // histEl is the run-history row
          const right = h('div', { class: 'card white stack', style: { gap: '9px' } },  // right column: the "You are the scheduler" card
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'lbl' }, 'You are the scheduler'), h('div', { class: 'row gap-s' }, chipL, chipH)),  // top row: the title and the two switch counters
            h('div', { class: 'th-grps' }, grpBox('web'), grpBox('ed')),  // the two group boxes side by side
            cpu,  // the CPU status line
            h('div', { class: 'card tight stack', style: { gap: '6px', flex: 'none' } }, swTitle, steps, h('div', { class: 'row', style: { gap: '10px' } }, h('span', { class: 'xs muted b' }, 'switch cost'), meter)),  // the switch card: its heading, the steps, and the switch-cost bar
            h('div', {}, h('div', { class: 'lbl', style: { marginBottom: '4px' } }, 'Run history (⇒ = memory map changed)'), histEl),  // the run-history label (a double arrow means the memory map changed) and the row itself
            h('div', { class: 'callout why m0', 'data-label': 'Why Linux groups them', html: 'The tasks of a group share one memory map, so switching among them skips the costliest part of a context switch.' }));  // note: tasks of one group share one memory map, so switching among them skips the costliest step
          el.append(h('div', { class: 'split l fill' }, left, right));  // puts both columns on the screen

          function pick(id) {  // pick(id): runs when the student clicks a task, making it the next one to run
            if (id === cur) { ctx.toast(`Task ${id} is already running.`); return; }  // clicking the task that is already running only shows a short pop-up message
            const same = T(id).g === T(cur).g;  // same is true if the new task is in the same thread group as the running one
            last = { from: cur, to: id, same };  // remembers this switch so paint() can explain it
            same ? light++ : heavy++;  // counts it as a light switch (same group) or a heavy one (different group)
            cur = id; hist.push(id); if (hist.length > 11) hist.shift();  // makes the new task the running one and adds it to the history, keeping the last 11 entries
            paint();  // redraws the card
          }  // ends pick()
          function paint() {  // paint(): redraws the scheduler card
            const t = T(cur), g = GR[t.g];  // t is the running task and g its thread group
            Object.entries(btns).forEach(([id, b]) => { b.classList.toggle('run', +id === cur); b.lastChild.textContent = +id === cur ? 'running' : T(+id).role; });  // marks the running task's button and changes its label to "running"; the others show their role
            chipL.textContent = `light switches: ${light}`; chipH.textContent = `heavy switches: ${heavy}`;  // updates the two switch counters
            cpu.replaceChildren(h('span', { class: 'chip cpu' }, 'CPU'), h('span', { html: `running task <b>${cur}</b> (${g.name})` }), h('span', { class: 'muted' }, '·'), h('span', { class: 'chip mem' }, `memory map ${g.mm} loaded`));  // updates the CPU line: which task is running and which memory map is loaded
            const S = (icon, cls, txt) => h('div', { class: cls }, h('b', {}, icon), h('span', { html: txt }));  // S(icon, cls, txt): builds one step row with an icon or number and its text
            if (!last) {  // before any switch: show the general recipe
              swTitle.textContent = 'Click the task that should run next.';  // heading that invites the first click
              steps.replaceChildren(S('1', '', 'Save the running task\'s registers and stack pointer into its task_struct.'), S('2', '', 'Load the next task\'s saved registers.'), S('?', '', 'Change the memory map, but only if the next task uses a different one.'));  // the three steps of a context switch, the third one depending on the memory map
              meter.firstChild.style.width = '0%';  // the cost bar starts empty
            } else if (last.same) {  // last switch stayed inside one thread group
              swTitle.innerHTML = `Last switch: ${last.from} → ${last.to} <span class="chip ok">same thread group</span>`;  // heading names the two tasks and says "same thread group" in a green chip
              steps.replaceChildren(S('1', '', `Save ${last.from}'s registers and stack pointer into its task_struct.`), S('2', '', `Load ${last.to}'s saved registers.`), S('✓', 'skip', `Memory map ${g.mm} <b>stays loaded</b>: both tasks share it, so cached address translations stay useful.`));  // save and load registers, then a green tick: the memory map stays loaded and cached translations stay useful
              meter.firstChild.style.width = '28%'; meter.firstChild.style.background = 'var(--ok)';  // the cost bar is short and green
            } else {  // last switch crossed to a different thread group
              swTitle.innerHTML = `Last switch: ${last.from} → ${last.to} <span class="chip bad">different thread group</span>`;  // heading names the two tasks and says "different thread group" in a red chip
              steps.replaceChildren(S('1', '', `Save ${last.from}'s registers and stack pointer into its task_struct.`), S('2', '', `Load ${last.to}'s saved registers.`), S('✗', 'cost', `<b>Switch the memory map</b> to ${g.mm}: load new page tables. Cached address translations for the old map become useless.`));  // save and load registers, then a red cross: the memory map must be switched and cached translations lost
              meter.firstChild.style.width = '100%'; meter.firstChild.style.background = 'var(--bad)';  // the cost bar is full and red
            }  // ends the choice of explanation
            histEl.replaceChildren(...hist.flatMap((id, i) => {  // rebuilds the history: each task ID with an arrow before it
              const tk = h('span', { class: 'tk', style: { '--c': GR[T(id).g].c } }, String(id));  // the task ID as a tag in its group's color
              if (!i) return [tk];  // the first entry has no arrow before it
              const hv = T(id).g !== T(hist[i - 1]).g;  // hv is true when this switch crossed to another thread group
              return [h('span', { class: hv ? 'hv' : 'lt' }, hv ? '⇒' : '→'), tk];  // a red double arrow for a heavy switch, a grey single arrow for a light one, then the task tag
            }));  // ends the history rebuild
          }  // ends paint()
          paint();  // draws step 4 for the first time
        },  // ends render() for step 4
      },  // ends step 4

      /* ---------------- 5. clone() flag builder ---------------- */
      {  // step 5 starts here: the clone() flag builder
        title: 'Build a thread out of clone() flags',  // step 5 title
        kind: 'lab',  // kind "lab"
        core: true,  // core: true keeps this step on the shorter core path
        render(el, ctx) {  // render(): builds step 5 when the student arrives
          const { h, s } = ctx;  // h builds page elements, s builds SVG drawing elements
          const F = new Set();  // F is the set of clone() flags currently switched on
          let exp = {}, lastExp = null, extraInfo = null, codeHost = null;  // exp records which child experiments were tried, lastExp the latest; extraInfo is the extra flag last clicked; codeHost is the code tab
          const setFlags = (list) => { F.clear(); list.forEach((f) => F.add(f)); exp = {}; lastExp = null; paint(); };  // setFlags(list): replaces all flags with a preset's list, clears the experiments and redraws
          const toggle = (f) => { if (F.has(f)) F.delete(f); else F.add(f); exp = {}; lastExp = null; paint(); };  // toggle(f): switches one flag on or off, clears the experiments and redraws

          /* ---- left: controls ---- */
          const mainBtns = CF_MAIN.map((m) => h('button', { class: 'cf-flag', type: 'button', onclick: () => toggle(m.f) }, h('i', { class: 'cf-sw' }), h('b', {}, m.f), h('span', {}, m.d)));  // mainBtns: one switch-style button per main sharing flag, showing its name and meaning
          const extraBtns = CF_EXTRA.map((m) => h('button', { class: 'btn sm cf-x', type: 'button', onclick: () => { extraInfo = m; toggle(m.f); } }, m.f));  // extraBtns: one small button per extra flag; a click toggles it and shows its summary
          const extraMsg = h('p', { class: 'small muted m0', style: { minHeight: '2.9em', flex: 'none' } });  // extraMsg is the line under the extra flags that explains the one last clicked; min-height stops jumping
          const verdict = h('div', { class: 'card tight cf-verdict', style: { flex: 'none' } });  // verdict is the card that names what the chosen flags produce
          const left = h('div', { class: 'stack' + (ctx.narrow ? ' nrw' : ''), style: { gap: '8px' } },  // left column; on phones it carries a class that stacks each flag's text differently
            h('p', { class: 'p15 m0', html: 'Every new Linux task is made by <span class="t">clone()</span>. Each <span class="t" data-t="Clone flags">flag</span> you switch on means one more thing <b>shared</b> with the creator instead of copied.' }),  // intro: every Linux task is made by clone(), and each flag means one more thing shared
            h('div', { class: 'row gap-s' }, h('span', { class: 'lbl' }, 'Presets'), ...Object.keys(CF_PRESETS).map((k) => h('button', { class: 'btn sm', type: 'button', onclick: () => { extraInfo = null; setFlags(CF_PRESETS[k]); } }, k))),  // preset buttons: fork(), vfork() and pthread_create(), each loading its flag list
            h('div', { class: 'stack', style: { gap: '5px', flex: 'none' } }, ...mainBtns),  // the five main flag switches
            h('div', { class: 'row gap-s' }, h('span', { class: 'lbl' }, 'More flags'), ...extraBtns),  // the row of extra-flag buttons
            extraMsg, verdict);  // the explanation line and the verdict card; closes the left column

          /* ---- right: diagram + experiments, and the generated call ---- */
          const svg = s('svg', { viewBox: '0 0 660 322', width: '100%', class: 'cf-svg', role: 'img', 'aria-label': 'What the caller and the new task share' });  // svg: the diagram of what the caller and the new task share, 660 by 322 units
          const holder = h('div', { style: { minHeight: '0' } });  // holder is where the sharing diagram, the phone list or the error box is placed
          const EXPS = [['x', 'Child sets x = 99'], ['open', 'Child opens log.txt'], ['cd', 'Child runs cd /tmp'], ['sig', 'Child sets a Ctrl+C handler']];  // EXPS: the four things the child can change, each with a key and a button label
          const expBtns = EXPS.map(([k, t]) => h('button', { class: 'btn sm', type: 'button', onclick: () => { exp[k] = true; lastExp = k; paint(); } }, t));  // one button per experiment; a click records it as tried and latest, then redraws
          const expMsg = h('div', { class: 'player-cap', style: { minHeight: '3.1em', fontSize: '14.5px' } });  // expMsg explains what the parent sees after the latest experiment; min-height stops jumping
          const alsoEl = h('div', { class: 'row gap-s small' });  // alsoEl lists extra effects the diagram does not show (shared undo list, own thread-local storage)
          const diag = h('div', { class: 'stack', style: { gap: '8px' } }, holder, h('div', { class: 'row gap-s' }, ...expBtns), expMsg, alsoEl);  // diag gathers the diagram, the experiment buttons, the message and the extras list
          const tabs = ctx.ui.tabs([  // two tabs on the right; ctx.ui.tabs shows one panel at a time
            { label: 'What gets shared', render: (p) => { p.append(diag); } },  // tab "What gets shared": shows the diagram area
            { label: 'The clone() call', render: (p) => { codeHost = p; drawCode(); return () => { codeHost = null; }; } },  // tab "The clone() call": remembers its panel and draws the code; the returned function forgets it when the tab closes
          ]);  // closes the tab list
          el.append(h('div', { class: 'split l fill' }, left, h('div', { class: 'fill' }, tabs)));  // puts the controls on the left and the tabs on the right

          const RES = [  // RES: the six rows of the sharing diagram, each with its flag, color class and, for four, before and after values
            { name: 'memory', flag: 'CLONE_VM', cls: 's-mem', base: 'x = 5', chg: 'x = 99', k: 'x' },  // memory row: x = 5 at first, x = 99 after the child's write
            { name: 'open files', flag: 'CLONE_FILES', cls: 's-io', base: 'fds 0 1 2', chg: 'fds 0 1 2 3=log.txt', k: 'open' },  // open-files row: descriptors 0, 1, 2 at first, plus 3 for log.txt after the child opens it
            { name: 'directories', flag: 'CLONE_FS', cls: 's-os', base: 'cwd /home/alice', chg: 'cwd /tmp', k: 'cd' },  // directories row: the home directory at first, /tmp after the child's cd
            { name: 'signal handlers', flag: 'CLONE_SIGHAND', cls: 's-intr', base: 'Ctrl+C → default', chg: 'Ctrl+C → on_int()', k: 'sig' },  // signal-handlers row: Ctrl+C does the default at first, runs on_int() after the child installs a handler
            { name: 'thread group', flag: 'CLONE_THREAD', cls: 's-thread' },  // thread-group row, shared by CLONE_THREAD
            { name: 'parent', flag: 'CLONE_PARENT', cls: 's-proc' },  // parent row, shared by CLONE_PARENT
          ];  // closes RES
          function drawSvg() {  // drawSvg(): draws the sharing diagram for the current flags and returns the same facts as a list for phones
            const K = [], NR = [];  // K collects the shapes to draw; NR collects one plain record per row
            const hdr = (x, t1, t2, cls) => s('g', {}, s('rect', { x, y: 6, width: 250, height: 52, rx: 12, class: cls, 'stroke-width': 2.5 }),  // hdr(...): draws a column header box with two lines of text
              s('text', { x: x + 125, y: 28, 'text-anchor': 'middle', class: 'lab' }, t1), s('text', { x: x + 125, y: 47, 'text-anchor': 'middle', class: 'sub' }, t2));  // the header's title and its small second line
            K.push(s('text', { x: 6, y: 28, class: 'lab' }, 'resource'), s('text', { x: 6, y: 47, class: 'sub' }, 'flag that shares it'));  // the left column's headings: resource names above, the flag that shares each one below
            K.push(hdr(144, 'caller · PID 700', F.has('CLONE_VFORK') ? 'paused until child exec()s or exits' : 'getpid() → 700', 's-proc'));  // the caller's header, PID 700; with CLONE_VFORK it says the caller is paused
            K.push(hdr(404, 'new task · ' + (F.has('CLONE_THREAD') ? 'TID' : 'PID') + ' 701', F.has('CLONE_THREAD') ? 'getpid() → 700 (same group)' : F.has('CLONE_NEWPID') ? 'PID 1 inside its new namespace' : 'getpid() → 701', F.has('CLONE_THREAD') ? 's-thread' : 's-proc'));  // the new task's header: a thread ID and the caller's getpid() with CLONE_THREAD, PID 1 with CLONE_NEWPID
            RES.forEach((r, i) => {  // draws one row per resource
              const y = 70 + i * 42;  // y is the row's vertical position
              const viaThread = r.flag === 'CLONE_PARENT' && !F.has('CLONE_PARENT') && F.has('CLONE_THREAD');  // viaThread: CLONE_THREAD also gives the new task the caller's parent, even without CLONE_PARENT
              const on = F.has(r.flag) || viaThread;  // on is true when this resource is shared
              K.push(s('text', { x: 6, y: y + 15, class: 'lab' }, r.name), s('text', { x: 6, y: y + 31, class: 'flag' + (on ? ' on' : '') }, viaThread ? 'via CLONE_THREAD' : r.flag));  // the resource name, and below it the flag that shares it (green when on)
              let vs, vp, vc;  // vs is the shared-box text, vp the caller's own value, vc the new task's copy
              if (r.k) { const v = exp[r.k] ? r.chg : r.base; vs = 'one shared table: ' + v; vp = r.base; vc = 'copy: ' + v; if (i === 0) vs = 'one shared memory: ' + v; }  // for the four experiment rows: use the changed value if the child already changed it
              else if (i === 4) { vs = 'one thread group: TGID 700 for both'; vp = 'TGID 700'; vc = 'TGID 701: a new process'; }  // thread-group row: one TGID for both, or a new TGID making a new process
              else { vs = 'siblings: both children of bash (650)'; vp = 'parent: bash (650)'; vc = 'parent: 700 (the caller)'; }  // parent row: siblings under bash, or the caller as parent
              if (i === 2) vs = 'one shared set: ' + (exp.cd ? r.chg : r.base);  // directories row: reworded as "one shared set" instead of "table"
              NR.push({ name: r.name, flag: viaThread ? 'via CLONE_THREAD' : r.flag, on, vs, vp, vc, col: r.cls.slice(2) });  // saves the same row facts for the phone list
              if (on) K.push(s('rect', { x: 144, y, width: 510, height: 36, rx: 10, class: r.cls, 'stroke-width': 2.5 }), s('text', { x: 399, y: y + 23, 'text-anchor': 'middle', class: 'val' }, vs));  // shared: one wide box across both columns with the shared value
              else K.push(s('rect', { x: 144, y, width: 250, height: 36, rx: 10, class: r.cls, 'stroke-width': 1.5 }), s('text', { x: 269, y: y + 23, 'text-anchor': 'middle', class: 'val' }, vp),  // not shared: the caller's box with its own value...
                s('rect', { x: 404, y, width: 250, height: 36, rx: 10, class: r.cls, 'stroke-width': 1.5, 'stroke-dasharray': '5 4' }), s('text', { x: 529, y: y + 23, 'text-anchor': 'middle', class: 'val' }, vc));  // ...and the new task's dashed box with its copy
            });  // ends the loop over rows
            svg.replaceChildren(...K);  // puts the new drawing on screen in one step
            return NR;  // hands the row facts back to paint()
          }  // ends drawSvg()
          /* phones: the same information as a readable list instead of a scaled-down diagram */
          function narrowView(NR) {  // builds the phone version: the same facts as a list of small cards instead of a shrunken drawing
            return h('div', { class: 'stack', style: { gap: '6px' } },  // returns a column of cards
              h('p', { class: 'small m0 muted' }, `Caller = PID 700 · new task = ${F.has('CLONE_THREAD') ? 'TID' : 'PID'} 701${F.has('CLONE_THREAD') ? ' (getpid() → 700)' : ''}${F.has('CLONE_VFORK') ? ' · caller paused' : ''}${F.has('CLONE_NEWPID') && !F.has('CLONE_THREAD') ? ' · new task is PID 1 in a new PID namespace' : ''}`),  // one summary line: caller and new task IDs, plus whether the caller is paused or the task is PID 1
              ...NR.map((r) => h('div', { class: 'card tight', style: { borderLeft: `5px solid var(--${r.col})`, padding: '6px 10px' } },  // one card per resource, with a stripe in its color
                h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', {}, r.name), h('code', { style: { color: r.on ? 'var(--ok)' : 'var(--muted)' } }, r.flag)),  // top row: the resource name and its flag, green if shared
                h('div', { class: 'small' }, r.on ? 'shared · ' + r.vs : `caller: ${r.vp}  ·  new task: ${r.vc}`))));  // second line: the shared value, or the caller's and the new task's values side by side
          }  // ends the phone version
          const EXP_MSG = {  // EXP_MSG: for each experiment, the message when the resource is shared (on) and when it is copied
            x: (on) => on ? 'The parent reads <b>99</b>: with one shared memory, both use the same x, not copies. To see each other\'s writes reliably and in order, tasks still need a lock or an atomic operation (section 5.1).' : 'The parent still reads <b>x = 5</b>: the child got its own copy of memory (made lazily, with copy-on-write), so the write changed only that copy.',  // memory: with sharing the parent reads 99; without, it still reads 5 thanks to its own copy
            open: (on) => on ? 'The parent can use <b>fd 3</b> as well: both tasks look at one open-file table.' : 'The parent\'s table still ends at fd 2. The child opened log.txt in its <b>own copy</b> of the table.',  // open files: with sharing the parent can use descriptor 3; without, its table still ends at 2
            cd: (on) => on ? 'The parent\'s directory becomes <b>/tmp</b> too: CLONE_FS shares one record of current directory, root directory and <b>umask</b> (default permissions for new files).' : 'The parent stays in <b>/home/alice</b>. The child changed only its own current directory.',  // directories: with sharing the parent moves to /tmp too; without, it stays in its home directory
            sig: (on) => on ? 'Ctrl+C now runs <b>on_int()</b> in the parent too: one shared handler table.' : 'The parent keeps its <b>default</b> Ctrl+C behaviour. The child changed its own copy of the table.',  // signal handlers: with sharing Ctrl+C runs on_int() in the parent too; without, it keeps the default
          };  // closes EXP_MSG
          const EXP_FLAG = { x: 'CLONE_VM', open: 'CLONE_FILES', cd: 'CLONE_FS', sig: 'CLONE_SIGHAND' };  // EXP_FLAG: which flag decides the outcome of each experiment
          function drawCode() {  // drawCode(): writes the clone() call that matches the current flags into the code tab
            if (!codeHost) return;  // does nothing while the code tab is not open
            const DESC = {}; CF_MAIN.forEach((m) => { DESC[m.f] = m.d; });  // DESC maps each flag to a short comment, starting with the main flags' meanings
            Object.assign(DESC, { CLONE_PARENT: 'new task is the caller\'s sibling', CLONE_SYSVSEM: 'share semaphore undo records', CLONE_SETTLS: 'give it its own thread-local storage', CLONE_VFORK: 'pause the caller until exec() or exit', CLONE_NEWPID: 'put it in a new PID namespace' });  // adds comments for the five extra flags
            const set = [...CF_MAIN, ...CF_EXTRA].map((m) => m.f).filter((f) => F.has(f));  // set lists the flags that are on, in the order they are listed in the lab
            const pad = (c, cm) => c.padEnd(24) + '// ' + cm;  // pad(c, cm): pads a code line to 24 characters and adds a comment after it, so the comments line up
            const L = [pad('flags = 0' + (set.length ? '' : ';'), set.length ? 'start from "share nothing"' : 'share nothing: exactly what fork() does')];  // first line: flags = 0, commented as "share nothing" when no flag is on
            set.forEach((f, i) => L.push(pad('      | ' + f + (i === set.length - 1 ? ';' : ''), DESC[f])));  // one line per flag, OR-ed in with |, the last one ending the statement
            L.push(pad('id = clone(fn, stack,', 'new task will run fn(arg)...'));  // the clone() call itself: the new task will run the function fn...
            L.push(pad('           flags, arg);', '...on its own new stack'));  // ...on its own new stack, with the flags and an argument
            const err = cfError(F);  // checks the flags against the kernel's rules
            if (err) L.push('// result: -1, errno = EINVAL, because', '// ' + err[0]);  // a broken rule: the call returns -1 with errno set to EINVAL, and the rule is named
            else if (F.has('CLONE_PARENT') && F.has('CLONE_NEWPID')) L.push('// portability: the clone() manual lists CLONE_PARENT with', '// CLONE_NEWPID as EINVAL and kernels before 3.13 refused it;', '// current kernels accept it (PID 1 of the new namespace', '// becomes a child of the caller\'s parent), but portable', '// code avoids the pair.');  // the CLONE_PARENT plus CLONE_NEWPID pair: a note on why portable code avoids it
            else L.push('// result: the new task\'s ID (701) in the caller');  // otherwise the call returns the new task's ID to the caller
            codeHost.replaceChildren(h('div', { class: 'stack', style: { gap: '10px' } }, ctx.ui.code(L.join('\n'), { lang: 'c' }),  // shows the code with syntax colors in the tab
              h('p', { class: 'small muted m0', html: 'The C library\'s fork() and pthread_create() boil down to calls like this one. Real calls also pass pointers for the new thread\'s ID and its storage area, and fork() adds SIGCHLD to the flags: the signal the parent receives when the child ends. Those are left out here. Try the presets and watch the flag list change.' })));  // note: the C library's fork() and pthread_create() come down to calls like this one
          }  // ends drawCode()
          function paint() {  // paint(): redraws step 5 after any flag change or experiment
            mainBtns.forEach((b, i) => b.classList.toggle('on', F.has(CF_MAIN[i].f)));  // turns each main flag switch on or off to match the set
            extraBtns.forEach((b, i) => b.classList.toggle('on', F.has(CF_EXTRA[i].f)));  // marks each extra flag button that is on
            extraMsg.innerHTML = extraInfo ? `<b class="mono">${extraInfo.f}</b>: ${extraInfo.d}` : 'Reminder: a <span class="t" data-t="Thread group">thread group</span> is the set of tasks that share one PID, the TGID. Click an extra flag to see what it does.';  // the line under the extras: the last clicked flag's summary, or a reminder of what a thread group is
            const err = cfError(F);  // err is the broken rule, if any
            const [c, title, txt0] = err ? ['bad', 'No task is created', `The kernel rejects this mix of flags (EINVAL). The panel ${ctx.narrow ? 'below' : 'on the right'} says why.`] : cfVerdict(F);  // the verdict: a red "No task is created" for a broken rule, otherwise what cfVerdict() says
            const txt = err || !cfNote(F) ? txt0 : cfNote(F);  // the CLONE_PARENT plus CLONE_NEWPID note replaces the verdict text when it applies
            verdict.style.setProperty('--c', COLS[c] || 'var(--bad)');  // colors the verdict card's stripe
            verdict.replaceChildren(h('div', { class: 'lbl' }, 'The result behaves like'), h('h3', {}, title), h('p', { class: 'small m0', html: txt }));  // fills the verdict card: label, title and explanation
            if (err) {  // broken rule: the diagram is replaced by an error box
              holder.replaceChildren(h('div', { class: 'cf-err stack', style: { gap: '8px' } }, h('h3', { class: 'm0' }, 'clone() fails: errno = EINVAL'),  // the box's heading says clone() fails with EINVAL
                h('p', { class: 'p15 m0', html: `<b>${err[0]}</b> ${err[1]}` }),  // the rule that was broken and why
                h('p', { class: 'small m0' }, 'The kernel checks the flags before it builds anything, so no task is made. Switch the clashing flag off (or the missing one on), or pick a preset.')));  // advice: switch the clashing flag off or the missing one on, or pick a preset
            } else { const NR = drawSvg(); holder.replaceChildren(ctx.narrow ? narrowView(NR) : svg); }  // no error: draw the diagram, and show it or the phone list depending on screen size
            expBtns.forEach((b) => { b.disabled = !!err; });  // the experiment buttons are disabled when no task could be made
            expMsg.innerHTML = err ? 'No task exists, so there is nothing to experiment with.' : lastExp ? '<b>' + EXPS.find((e) => e[0] === lastExp)[1] + '.</b> ' + EXP_MSG[lastExp](F.has(EXP_FLAG[lastExp])) : 'Now let the child change something and see whether the parent notices.';  // the experiment message: nothing to try, the latest result, or an invitation to try one
            const also = CF_EXTRA.filter((m) => F.has(m.f) && (m.f === 'CLONE_SYSVSEM' || m.f === 'CLONE_SETTLS'));   // the other three already show in the diagram
            alsoEl.replaceChildren(...(also.length ? [h('span', { class: 'lbl' }, 'Also'), ...also.map((m) => h('span', { class: 'chip accent' }, { CLONE_SYSVSEM: 'shared semaphore undo', CLONE_SETTLS: 'own thread-local storage', CLONE_VFORK: 'caller paused', CLONE_NEWPID: 'new PID namespace' }[m.f]))] : []));  // lists the extra effects under "Also", or nothing if none apply
            drawCode();  // keeps the code tab in step with the flags
          }  // ends paint()
          paint();  // draws step 5 for the first time
        },  // ends render() for step 5
      },  // ends step 5

      /* ---------------- 6. The five other clone() flags: reference + "which flag does this job?" ---------------- */
      {  // step 6 starts here: the five extra clone() flags and the "which flag does this job?" game
        title: 'Five more clone() flags: pick the right one',  // step 6 title
        kind: 'predict',  // kind "predict": the student guesses before being told
        render(el, ctx) {  // render(): builds step 6 when the student arrives
          const { h } = ctx;  // h builds page elements
          const game = { i: 0, tries: 0, res: [], done: false };  // game state: the current round, tries this round, results per round, and whether all rounds are over
          const refs = CF_EXTRA.map((m) => h('div', { class: 'xf-ref' },  // refs: one reference card per extra flag
            h('div', { class: 'row', style: { justifyContent: 'space-between', flexWrap: 'nowrap' } }, h('b', {}, m.f), h('span', { class: 'chip xs' }, 'used by ' + m.use)),  // top row of a card: the flag name and a chip saying who uses it
            h('div', { class: 'xf-d', html: m.long })));  // the longer explanation of the flag
          const left = h('div', { class: 'stack', style: { gap: '6px' } },  // left column: an intro line and the five reference cards
            h('p', { class: 'p15 m0', html: 'The five sharing flags decide process versus thread. These five fine-tune <b>how</b> the new <span class="t" data-t="Linux task">task</span> starts life, and real programs use them every day. Read them, then put them to work.' }),  // intro: the sharing flags decide process versus thread; these five tune how the task starts
            ...refs);  // the five reference cards; closes the left column
          const dots = h('div', { class: 'ts-dots' });  // dots is the row of progress dots (it reuses the step 2 dot style)
          const cnt = h('span', { class: 'lbl' });  // cnt is the "Job n of 5" label
          const scen = h('div', { class: 'xf-scen' });  // scen is the box that shows the scenario of the current round
          const picks = CF_EXTRA.map((m, i) => h('button', { class: 'btn sm cf-x', type: 'button', onclick: () => answer(i) }, m.f));  // picks: one answer button per extra flag; a click sends its index to answer()
          const fb = h('div', { class: 'ts-fb', 'aria-live': 'polite' });  // fb is the feedback box; aria-live makes screen readers announce each new message
          const nextBtn = h('button', { class: 'btn primary', type: 'button', onclick: next });  // nextBtn moves to the next round (or shows the score, or restarts)
          const overBtn = h('button', { class: 'btn ghost sm', type: 'button', onclick: () => restart() }, 'Start over');  // overBtn restarts the game from the first round
          const body = h('div', { class: 'stack', style: { gap: '10px' } },  // body gathers the game parts in a column
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, cnt, dots), scen,  // top row: the round label and the dots; then the scenario
            h('div', {}, h('div', { class: 'lbl', style: { marginBottom: '5px' } }, 'Which flag does this job?'), h('div', { class: 'row gap-s xf-picks' }, ...picks)),  // the question label and the row of flag buttons
            fb, h('div', { class: 'row' }, nextBtn, overBtn));  // the feedback box, then the Next and Start over buttons
          const right = h('div', { class: 'card white stack', style: { gap: '10px' } }, h('span', { class: 'lbl' }, 'Your turn: five jobs, five flags'), body);  // right column: the game card with its title
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: ctx.narrow ? '' : 'minmax(0, 1.12fr) minmax(0, 1fr)' } }, left, right));  // puts the reference cards and the game side by side; the left column is a little wider on large screens

          function paint() {  // paint(): redraws the game for the current round, or the score when all rounds are done
            refs.forEach((r) => r.classList.remove('ok', 'bad'));  // clears green and red from the reference cards
            picks.forEach((b) => { b.classList.remove('ok', 'bad'); b.disabled = game.done; });  // clears green and red from the flag buttons and disables them once the game is over
            overBtn.style.display = game.done ? 'none' : '';  // hides "Start over" on the score screen, where Next already says "Play again"
            dots.replaceChildren(...CF_JOBS.map((_, i) => h('i', { class: game.res[i] || (i === game.i && !game.done ? 'cur' : '') })));  // one dot per round: green or orange once answered, a ring for the current round
            if (game.done) {  // all five rounds done: show the score
              const ok = game.res.filter((r) => r === 'ok').length;  // ok counts the rounds answered right on the first try
              cnt.textContent = 'All five jobs done';  // the label now says all five jobs are done
              scen.innerHTML = `<div class="big">${ok} / ${CF_JOBS.length}</div><div class="small muted" style="text-align:center">right on the first try</div>`;  // the score shown large in the scenario box
              fb.className = 'ts-fb ' + (ok === CF_JOBS.length ? 'ok' : '');  // the feedback box turns green only for a perfect score
              fb.innerHTML = ok === CF_JOBS.length ? '<b>Perfect.</b> You can match each flag to the job it exists for.' : 'Orange dots needed a second try. Re-read those flags on the left, then press <b>Play again</b>.';  // praise for a perfect score, otherwise advice to re-read the flags and play again
              nextBtn.textContent = 'Play again'; nextBtn.disabled = false;  // Next becomes "Play again" and is clickable
              return;  // stops here: the rest of paint() is for a round in progress
            }  // ends the score case
            const [txt] = CF_JOBS[game.i];  // txt is the scenario text of the current round
            cnt.textContent = `Job ${game.i + 1} of ${CF_JOBS.length}`;  // shows "Job n of 5"
            scen.textContent = txt;  // shows the scenario; textContent keeps it as plain text
            fb.className = 'ts-fb';  // resets the feedback box color
            fb.innerHTML = 'Pick the flag that makes this happen. Each wrong pick tells you what that flag would do instead.';  // the starting hint: a wrong pick will say what that flag would do instead
            nextBtn.textContent = game.i === CF_JOBS.length - 1 ? 'See my score' : 'Next job →';  // Next says "See my score" on the last round, "Next job" otherwise
            nextBtn.disabled = true;  // Next stays disabled until the right flag is picked
          }  // ends paint()
          function answer(i) {  // answer(i): checks the student's pick of extra flag i
            if (game.done || !nextBtn.disabled) return;  // ignores picks when the game is over or the round is already answered (Next enabled)
            const [, want, why] = CF_JOBS[game.i];  // want is the right flag's index and why the explanation
            game.tries++;  // counts this attempt
            refs.forEach((r) => r.classList.remove('ok', 'bad'));  // clears the last pick's colors on the reference cards
            if (i === want) {  // the pick is right
              game.res[game.i] = game.tries === 1 ? 'ok' : 'late';  // records "ok" for a first-try success, "late" otherwise
              refs[i].classList.add('ok'); picks[i].classList.add('ok');  // turns the matching reference card and button green
              fb.className = 'ts-fb ok';  // turns the feedback box green
              fb.innerHTML = `<b>${game.tries === 1 ? 'Right.' : 'Right, on a later try.'}</b> ${why}`;  // says right and gives the explanation
              nextBtn.disabled = false;  // enables Next
              dots.replaceChildren(...CF_JOBS.map((_, k) => h('i', { class: game.res[k] || (k === game.i ? 'cur' : '') })));  // redraws the dots so this round's color shows
            } else {  // the pick is wrong
              refs[i].classList.add('bad'); picks[i].classList.add('bad');  // turns that reference card and button red
              fb.className = 'ts-fb bad';  // turns the feedback box red
              fb.innerHTML = `<b>Not ${CF_EXTRA[i].f}.</b> That flag would ${CF_EXTRA[i].would} Try another.`;  // says which flag it was not and what that flag would do instead
            }  // ends the wrong-pick case
          }  // ends answer()
          function next() {  // next(): runs when Next is clicked
            if (game.done) { restart(); return; }  // on the score screen Next means "Play again"
            game.i++; game.tries = 0;  // moves to the next round with a fresh try count
            if (game.i >= CF_JOBS.length) game.done = true;  // after the last round the game is over
            paint();  // redraws for the new round or the score
          }  // ends next()
          function restart() { Object.assign(game, { i: 0, tries: 0, res: [], done: false }); paint(); }  // restart(): resets the game to round 1 with no results and redraws
          paint();  // draws step 6 for the first time
        },  // ends render() for step 6
      },  // ends step 6

      /* ---------------- 7. Namespace lab ---------------- */
      {  // step 7 starts here: the namespace lab
        title: 'Namespaces: give processes their own view',  // step 7 title
        kind: 'lab',  // kind "lab"
        render(el, ctx) {  // render(): builds step 7 when the student arrives
          const { h } = ctx;  // h builds page elements
          /* host: server-1. Container A runs shop-app (host PIDs 4521, 4522), container B runs blog-app (4610, 4611). Both apps want port 8080. */
          const NS = [  // NS: the six namespaces; each has its flag, what it isolates, glossary term, and what the host, A and B see
            { k: 'mnt', name: 'Mount', flag: 'CLONE_NEWNS', what: 'mount points, the file tree', term: 'Mount namespace',  // Mount namespace, created with the CLONE_NEWNS flag
              host: '/ = bin boot etc home usr var',  // what the host's file tree looks like
              on: ['/ = the shop image: app bin etc usr', '/ = the blog image: app bin etc usr'],  // with the namespace on: each container sees its own image as its root
              off: [['bad', 'host\'s / : can wander into /home and /etc'], ['bad', 'host\'s / : can wander into /home and /etc']],  // with it off: both see the host's whole file tree, marked red as trouble
              why: 'A mount namespace has its own list of mount points. The container runtime mounts the container\'s image as its root, so the processes inside see a different file tree. It was the first namespace, which is why its flag has the plain name CLONE_NEWNS.' },  // explanation: its own mount points, and why its flag has the plain name CLONE_NEWNS
            { k: 'uts', name: 'UTS', flag: 'CLONE_NEWUTS', what: 'hostname, domain name', term: 'UTS namespace',  // UTS namespace, created with CLONE_NEWUTS
              host: 'hostname: server-1',  // the host's hostname
              on: ['hostname: shop', 'hostname: blog'],  // with it on: each container has its own hostname
              off: [['shr', 'hostname: server-1 (renaming it renames the host)'], ['shr', 'hostname: server-1 (renaming it renames the host)']],  // with it off: they share the host's hostname, marked orange
              why: 'A UTS namespace has its own hostname and domain name, the values uname() reports. The odd name comes from the kernel structure that holds them ("UNIX Time-sharing System").' },  // explanation: its own hostname and domain name, and where the name UTS comes from
            { k: 'ipc', name: 'IPC', flag: 'CLONE_NEWIPC', what: 'semaphores, queues, shared memory', term: 'IPC namespace',  // IPC namespace, created with CLONE_NEWIPC
              host: 'shared memory "host-cache"',  // the host has a shared-memory segment called host-cache
              on: ['only its own IPC objects (none yet)', 'only its own IPC objects (none yet)'],  // with it on: each container sees only its own IPC objects
              off: [['bad', 'can attach "host-cache" and B\'s segments'], ['bad', 'can attach "host-cache" and A\'s segments']],  // with IPC off: each container could attach the host's and the other container's shared memory, marked red
              why: 'An IPC namespace has its own System V semaphores, message queues and shared-memory segments (and its own POSIX message queues), so one container cannot attach another\'s shared memory by guessing its key.' },  // explanation: its own semaphores, queues and shared memory, so one container cannot guess another's key
            { k: 'pid', name: 'PID', flag: 'CLONE_NEWPID', what: 'process IDs', term: 'PID namespace',  // PID namespace, created with CLONE_NEWPID
              host: 'sees all: 1 systemd, 812 sshd, 4521 shop-app, 4610 blog-app…',  // the host sees every process, from systemd (PID 1) to both apps
              on: ['1 shop-app, 2 worker (the host calls them 4521, 4522)', '1 blog-app, 2 worker (the host calls them 4610, 4611)'],  // with PID on: each container numbers its own processes from 1, while the host keeps its own numbers
              off: [['shr', 'sees every host process, even 4610 blog-app'], ['shr', 'sees every host process, even 4521 shop-app']],  // with PID off: each container sees every host process, including the other container's app, marked orange
              why: 'Each PID namespace numbers its processes from 1; the first one inside is its "init". A process has a PID in its own namespace and another in the parent namespace, so the host can still see and manage it.' },  // explanation: numbering from 1 inside, a second PID in the parent namespace
            { k: 'net', name: 'Network', flag: 'CLONE_NEWNET', what: 'devices, IPs, routes, ports', term: 'Network namespace',  // Network namespace, created with CLONE_NEWNET
              host: 'eth0 192.168.1.20',  // the host's network card and address
              on: ['own eth0 172.17.0.2 · port 8080 ✓', 'own eth0 172.17.0.3 · port 8080 ✓'],  // with it on: each container has its own network card and address, so both can use port 8080
              off: [['shr', 'host\'s eth0 · port 8080 ✓ (it got there first)'], ['bad', 'host\'s eth0 · port 8080 already taken ✗']],  // with it off: A gets port 8080 first (orange), and B finds it already taken (red)
              why: 'A network namespace has its own devices, IP addresses, routing table, firewall rules and port numbers, so both apps can listen on port 8080. A virtual cable (a veth pair) links it to the host.' },  // explanation: its own devices, addresses, routes and ports, linked to the host by a virtual cable
            { k: 'user', name: 'User', flag: 'CLONE_NEWUSER', what: 'user and group IDs', term: 'User namespace',  // User namespace, created with CLONE_NEWUSER
              host: 'root is UID 0',  // on the host, root is user ID 0
              on: ['root inside = UID 100000 outside: no host powers', 'root inside = UID 200000 outside: no host powers'],  // with it on: root inside maps to an ordinary high user ID outside, with no host powers
              off: [['bad', 'its UID 0 is the host\'s real root!'], ['bad', 'its UID 0 is the host\'s real root!']],  // with it off: root inside is the host's real root, marked red as the worst case
              why: 'A user namespace maps IDs: UID 0 inside can be an ordinary UID such as 100000 outside. The process has root powers over things its namespaces own, and none over the host.' },  // explanation: IDs are mapped, so root powers apply only to things the namespace owns
          ];  // closes NS
          const on = new Set();  // on holds the keys of the namespaces switched on
          let sel = null;  // sel is the namespace clicked last, whose explanation is shown and whose row is highlighted
          const tgs = NS.map((n) => h('button', { class: 'ns-tg', type: 'button', onclick: () => { if (on.has(n.k)) on.delete(n.k); else on.add(n.k); sel = n.k; paint(); } },  // tgs: one toggle button per namespace; a click switches it, selects it and redraws
            h('i', { class: 'cf-sw' }), h('b', {}, `${n.name} namespace`), h('span', {}, n.what)));  // each toggle shows a switch, the namespace name and what it isolates
          const info = h('div', { class: 'card tight stack', style: { gap: '4px', flex: 'none' } });  // info is the card under the toggles that explains the selected namespace
          const left = h('div', { class: 'stack', style: { gap: '7px' } },  // left column of step 7
            h('div', { class: 'row gap-s' }, h('span', { class: 'lbl' }, 'Presets'),  // preset row with its label
              h('button', { class: 'btn sm', type: 'button', onclick: () => { on.clear(); sel = null; paint(); } }, 'All off'),  // "All off" clears every namespace
              h('button', { class: 'btn sm', type: 'button', onclick: () => { NS.forEach((n) => on.add(n.k)); sel = null; paint(); } }, 'All six on')),  // "All six on" switches every namespace on
            h('div', { class: 'stack', style: { gap: '5px', flex: 'none' } }, ...tgs), info);  // the six toggles and the info card; closes the left column
          const tbl = h('div', { class: 'ns-tbl' });  // tbl is the grid comparing what the host, A and B see
          const score = h('span', { class: 'chip' });  // score is the chip that counts how many namespaces are on
          const right = h('div', { class: 'stack', style: { gap: '8px' } },  // right column
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'lbl' }, 'What each one sees'), score), tbl,  // top row: "What each one sees" and the score chip; then the table
            h('p', { class: 'small muted m0', html: 'Namespaces are made with <span class="t">clone()</span> flags such as CLONE_NEWPID, or with <b>unshare()</b>, which moves the calling process into new ones (for PID, only its future children go in). <b>setns()</b> joins an existing one: that is how a command is run inside a container that is already up.' }));  // note: namespaces also come from unshare(), and setns() joins an existing one
          el.append(h('div', { class: 'split l3 fill' + (ctx.narrow ? ' nrw' : '') }, left, right));  // puts both columns on screen; adds the phone-width class on small screens

          function paint() {  // paint(): redraws the toggles, the table, the score and the info card
            tgs.forEach((b, i) => b.classList.toggle('on', on.has(NS[i].k)));  // marks each toggle on or off
            const tag = (x) => (ctx.narrow ? h('b', { style: { marginRight: '8px', flex: 'none' } }, x) : null);   // phones: one column, so label every cell
            const cells = ctx.narrow ? [] : [h('div'), h('div', { class: 'ns-th' }, 'Host: server-1'), h('div', { class: 'ns-th' }, 'Container A: shop'), h('div', { class: 'ns-th' }, 'Container B: blog')];  // on large screens the table starts with an empty corner and three column headings; on phones there are none
            NS.forEach((n) => {  // adds one table row per namespace
              const o = on.has(n.k), hi = sel === n.k ? ' sel' : '';  // o says whether this namespace is on; hi adds the highlight class if it is the selected one
              cells.push(h('div', { class: 'ns-rl' }, h('b', {}, n.name), h('code', {}, n.flag)));  // the row label: namespace name above its flag
              cells.push(h('div', { class: 'ns-c host' + hi }, tag('Host'), h('span', {}, n.host)));  // the host's cell, always the host's own view
              [0, 1].forEach((j) => cells.push(h('div', { class: 'ns-c ' + (o ? 'own' : n.off[j][0]) + hi }, tag(j ? 'B' : 'A'), h('span', {}, o ? n.on[j] : n.off[j][1]))));  // A's and B's cells: green with their own view when on, otherwise the shared view in orange or red
            });  // ends the loop over namespaces
            tbl.replaceChildren(...cells);  // puts the rebuilt table on screen
            score.className = 'chip ' + (on.size === 6 ? 'ok' : on.size ? 'warn' : 'bad');  // the score chip is green for all six, orange for some, red for none
            score.textContent = on.size === 6 ? 'A and B: fully isolated views (6 of 6)' : `isolated in ${on.size} of 6 ways`;  // the score text: fully isolated with all six, otherwise "isolated in n of 6 ways"
            const n = NS.find((x) => x.k === sel);  // n is the selected namespace's entry, if any
            if (n) info.replaceChildren(h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', { html: `<span class="t" data-t="${n.term}">${n.term}</span>` }), h('code', {}, n.flag)),  // with a selection: its glossary term and flag at the top of the info card...
              h('p', { class: 'small m0', html: n.why }));  // ...and its explanation below
            else info.replaceChildren(h('div', { class: 'lbl' }, 'How to read the table'),  // without a selection: tips on how to read the table
              h('p', { class: 'small m0', html: 'A <span class="t">namespace</span> gives the processes inside their <b>own copy</b> of one part of the system. Green: the container has its own. Orange or red: it shares the host\'s, and red means trouble. Switch the namespaces on one at a time.' }));  // explains the colors: green means its own copy, orange shared, red trouble
          }  // ends paint()
          paint();  // draws step 7 for the first time
        },  // ends render() for step 7
      },  // ends step 7

      /* ---------------- 7. cgroups + containers ---------------- */
      {  // step 8 starts here: cgroups and containers
        title: 'cgroups set the budget; containers combine it all',  // step 8 title
        kind: 'lab',  // kind "lab"
        render(el, ctx) {  // render(): builds step 8 when the student arrives
          const { h } = ctx;  // h builds page elements
          const f2 = (v) => ctx.util.fmt(v, 2);  // f2(v): writes a number with at most two decimal places, for the bar labels and messages
          /* Host: 4 cores, 8 GB. The OS itself uses 1 GB. Container A (shop): 1 busy thread, 1.5 GB.
             Container B (batch job): 8 busy threads, memory demand D GB (a leak you control). */
          const CORES = 4, RAM = 8, OS_MEM = 1, A_MEM = 1.5, B_THREADS = 8;  // the fixed host: 4 cores and 8 GB, 1 GB used by the OS, 1.5 GB by A, and 8 busy threads in B
          let cg = false, L = 1.5, M = 2, D = 3;  // cg says whether cgroups are on; L is B's CPU limit in cores, M its memory limit and D its memory demand, in GB
          const left = h('div', { class: 'stack', style: { gap: '10px' } },  // left column of step 8
            h('p', { class: 'lead m0', html: 'Namespaces decide what a process can <b>see</b>. A <span class="t">cgroup</span> decides how much it can <b>use</b>.' }),  // opening line: namespaces decide what a process can see, a cgroup how much it can use
            h('p', { class: 'p15 m0', html: 'The kernel puts tasks into <span class="t" data-t="Control group (cgroup)">control groups</span>, a tree of directories under <code>/sys/fs/cgroup</code>. For each group it can <b>limit</b> CPU, memory, disk I/O and network use (<code>cpu.max</code>, <code>memory.max</code>), <b>prioritize</b> it (<code>cpu.weight</code>), <b>account</b> for its use, and <b>control</b> it as a unit (freeze or kill all its tasks).' }),  // paragraph: groups live in a directory tree, with files such as cpu.max and memory.max setting limits
            h('div', { class: 'cg-eq' }, h('span', { class: 'box accent' }, 'namespaces'), '+', h('span', { class: 'box io' }, 'cgroups'), '+', h('span', { class: 'box mem' }, 'own root files'), '=', h('span', { class: 'box proc', html: '<span class="t">container</span>' })),  // the equation namespaces + cgroups + own root files = container, as colored word boxes
            h('table', { class: 'tbl compact' },  // a small comparison table of containers and virtual machines
              h('tr', {}, h('th', {}, ''), h('th', {}, 'Container'), h('th', {}, 'Virtual machine')),  // header row: an empty corner, then Container and Virtual machine
              h('tr', {}, h('td', { class: 'b' }, 'Kernel'), h('td', {}, 'shares the host\'s kernel'), h('td', {}, 'its own guest kernel')),  // row: a container shares the host's kernel, a virtual machine has its own
              h('tr', {}, h('td', { class: 'b' }, 'Isolation'), h('td', {}, 'namespaces + cgroups'), h('td', {}, 'a hypervisor')),  // row: what isolates each one
              h('tr', {}, h('td', { class: 'b' }, 'Start-up'), h('td', {}, 'as fast as starting a process'), h('td', {}, 'boots a whole OS'))),  // row: how fast each one starts
            h('div', { class: 'callout why m0', 'data-label': 'Why it matters', html: 'One runaway container cannot starve its neighbours, so one server can safely host many customers\' containers. Docker, LXC and Podman all build containers from these same kernel parts.' }));  // why it matters: one runaway container cannot starve its neighbours

          /* ---- right: the lab ---- */
          const seg = ctx.ui.seg([{ value: false, label: 'No cgroups' }, { value: true, label: 'Put A and B in cgroups' }], cg, (v) => { cg = v; paint(); });  // the switch between "No cgroups" and "Put A and B in cgroups"; a change stores it and redraws
          const sL = ctx.ui.slider({ label: 'B\'s CPU limit', min: 0.5, max: 3, step: 0.5, value: L, format: (v) => v + ' cores', onInput: (v) => { L = v; paint(); } });  // slider for B's CPU limit, from half a core to 3 cores
          const sM = ctx.ui.slider({ label: 'B\'s memory limit', min: 0.5, max: 5, step: 0.5, value: M, format: (v) => v + ' GB', onInput: (v) => { M = v; paint(); } });  // slider for B's memory limit, from 0.5 to 5 GB
          const sD = ctx.ui.slider({ label: 'B\'s memory demand (a leak)', min: 1, max: 7, step: 0.5, value: D, format: (v) => v + ' GB', onInput: (v) => { D = v; paint(); } });  // slider for B's memory demand, the leak the student controls, from 1 to 7 GB
          const files = h('div', { class: 'cg-files' });  // files shows the cgroup limit files as B would have them
          const cpuBar = h('div', { class: 'cg-bar' }), memBar = h('div', { class: 'cg-bar' });  // the two usage bars, for CPU and memory
          const cpuLbl = h('div', { class: 'xs muted b' }), memLbl = h('div', { class: 'xs muted b' });  // the labels above the two bars
          const stA = h('div', { class: 'card tight cg-st' }), stB = h('div', { class: 'card tight cg-st' });  // the status cards for container A and container B
          const quota = h('p', { class: 'small m0' });  // quota is the paragraph that explains the cpu.max numbers
          const right = h('div', { class: 'card white stack', style: { gap: '9px' } },  // right column: the lab card
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'lbl' }, 'Host: 4 cores, 8 GB'), seg),  // top row: the host's size and the cgroup switch
            sL, sM, sD, files,  // the three sliders and the limit files
            h('div', { class: 'stack', style: { gap: '3px' } }, cpuLbl, cpuBar),  // the CPU label and bar
            h('div', { class: 'stack', style: { gap: '3px' } }, memLbl, memBar),  // the memory label and bar
            h('div', { class: 'grid-2', style: { gap: '10px' } }, stA, stB), quota);  // the two status cards side by side, then the quota explanation
          el.append(h('div', { class: 'split l fill' }, left, right));  // puts both columns on screen

          const seg_ = (cls, w, txt) => h('i', { class: cls, style: { width: w + '%' }, title: txt }, w > 9 ? txt : '');  // seg_(cls, w, txt): one bar segment w percent wide; its label shows only if the segment is wide enough to fit it
          function paint() {  // paint(): recomputes the CPU and memory split and redraws everything; runs on every switch or slider change
            [sL, sM].forEach((x) => x.classList.toggle('cg-dim', !cg));  // fades the two limit sliders while cgroups are off, since they do nothing then
            quota.innerHTML = cg ? `<b>Reading cpu.max:</b> "${L * 100000} 100000" lets B's group run ${(L * 100000).toLocaleString('en-US')} µs of CPU time in every 100,000 µs period, that is ${L} cores' worth. When the quota is used up, B's threads wait for the next period: they are <b>throttled</b>.`  // with cgroups on: explains how cpu.max turns into a quota per 100,000 microsecond period, and throttling
              : '<b>Try it:</b> put A and B in cgroups, then move the sliders. Watch A\'s share of the processor and what happens when B\'s demand passes its memory limit.';  // with cgroups off: tells the student what to try
            files.innerHTML = cg ? `B/cpu.max = "${L * 100000} 100000"   B/memory.max = "${M}G"` : 'no cgroup files: every task competes on its own';  // shows B's cgroup files with the current limits, or a line saying there are none
            /* CPU: without cgroups, 9 equally busy threads share 4 cores. With cgroups, B is capped at L cores (quota per 100 ms period). */
            let a, b;  // a and b will be the cores A and B actually get
            if (!cg) { a = CORES / (1 + B_THREADS); b = CORES - a; } else { b = L; a = Math.min(1, CORES - L); }  // no cgroups: 9 equally busy threads share 4 cores, so A's one thread gets 4/9; with cgroups B gets L and A up to 1 core
            const idle = CORES - a - b;  // idle is whatever processor time is left over
            cpuLbl.innerHTML = `CPU time per second, in cores (4 in all) · A needs 1 core, B's 8 threads would take all 4`;  // label for the CPU bar: 4 cores in all, what A needs and what B would take
            cpuBar.replaceChildren(seg_('a', a / CORES * 100, `A ${f2(a)}`), seg_('b', b / CORES * 100, `B ${f2(b)}`), h('i', { style: { width: idle / CORES * 100 + '%' } }, idle >= 0.4 ? f2(idle) + ' idle' : ''));  // draws the CPU bar: A's share, B's share and the idle part
            /* Memory */
            const bUse = cg ? Math.min(D, M) : D;  // bUse is B's real memory use: capped at its limit M with cgroups, the full demand D without
            const total = OS_MEM + A_MEM + bUse, over = Math.max(0, total - RAM);  // total is all memory wanted; over is how much of it the host cannot supply
            const scale = 100 / Math.max(RAM, total);  // scale turns GB into percent of the bar, stretching the bar if demand is more than the host has
            memLbl.innerHTML = `Memory in GB (8 in all) · OS 1 · A 1.5 · B wants ${D}`;  // label for the memory bar: the host total and each user's amount
            memBar.replaceChildren(seg_('o', OS_MEM * scale, 'OS 1'), seg_('a', A_MEM * scale, 'A 1.5'), seg_('b', (bUse - over) * scale, `B ${f2(bUse - over)}`), over ? seg_('x', over * scale, `+${f2(over)} short!`) : h('i', { style: { width: (RAM - total) * scale + '%' } }, RAM - total >= 0.8 ? f2(RAM - total) + ' free' : ''));  // draws the memory bar: OS, A, B, then either the red shortfall or the free space
            /* Verdicts */
            const slow = a < 1;  // slow is true when A gets less than the one core it needs
            stA.style.setProperty('--c', slow || over ? 'var(--bad)' : 'var(--ok)');  // A's card is red when it is slowed down or memory runs out, green otherwise
            stA.replaceChildren(h('b', { class: 'hd' }, 'Container A (shop)'), h('span', { html: slow  // fills A's card: its heading and a message chosen below
              ? `Gets only <b>${f2(a)}</b> of the 1 core it needs, so every page takes <b>${f2(1 / a)}×</b> as long. B\'s 8 threads crowd it out.`  // slowed down: how much of its core it gets and how many times longer each page takes
              : over ? 'Has its CPU, but the machine is out of memory: everything slows while the kernel scrambles for pages.' : 'Gets the full core it needs. B\'s appetite no longer matters to it.' }));  // out of memory: everything slows; otherwise A has everything it needs
            let bc, bt;  // bc will be B's card color and bt its message
            if (over) { bc = 'var(--bad)'; bt = `Needs ${f2(over)} GB more than the host has. The whole machine slows while the kernel frees memory, then the host-wide out-of-memory (OOM) killer must kill something.`; }  // demand beyond the host: red, the whole machine slows and the out-of-memory (OOM) killer must act
            else if (cg && D > M) { bc = 'var(--warn)'; bt = `Hit memory.max (${M} GB). The kernel reclaims B's own memory; when that fails, the OOM killer ends a process <b>inside B only</b>.`; }  // over its own memory.max: orange, and the OOM killer ends a process inside B only
            else if (cg) { bc = 'var(--warn)'; bt = `Throttled to <b>${L}</b> of the 8 cores it wants, and within its memory limit. Its cgroup tally: ${f2(b)} CPU-seconds per second, ${f2(bUse)} GB.`; }  // cgroups on and within limits: orange, throttled to its CPU limit, with its per-group tally
            else { bc = 'var(--io)'; bt = `Takes <b>${f2(b)}</b> cores and ${f2(bUse)} GB. Nothing limits it, and nothing even keeps a per-container tally.`; }  // no cgroups: B takes what it wants and nobody even keeps a per-container tally
            stB.style.setProperty('--c', bc);  // colors B's card
            stB.replaceChildren(h('b', { class: 'hd' }, 'Container B (batch job)'), h('span', { html: bt }));  // fills B's card with its heading and message
          }  // ends paint()
          paint();  // draws step 8 for the first time
        },  // ends render() for step 8
      },  // ends step 8

      /* ---------------- 8. Recap ---------------- */
      {  // step 9 starts here: the recap flip cards
        title: 'Recap: six ideas to carry away',  // step 9 title
        kind: 'recap',  // kind "recap": a review screen
        render(el, ctx) {  // render(): builds the recap when the student arrives
          const { h } = ctx;  // h builds page elements
          el.append(h('div', { class: 'stack fill', style: { gap: '12px' } },  // a single column that fills the screen
            h('p', { class: 'lead m0' }, 'Say each answer out loud before you flip the card.'),  // instruction: say each answer aloud before flipping
            ctx.ui.flipcards([  // flip cards: each pair is [front question, back answer]; ctx.ui.flipcards turns them over on click
              ['What does Linux call the thing it schedules?', 'A <b>task</b>. Every process and every thread is a task with its own task_struct. There is no separate thread structure.'],  // card: what Linux calls the thing it schedules
              ['Nine kinds of information in a task_struct?', 'State · scheduling information · identifiers · interprocess communication · links · times and timers · file system · address space · processor-specific context.'],  // card: the nine groups in a task_struct
              ['The five Linux task states?', '<b>Running</b> (executing or ready) · <b>Interruptible</b> (S: a signal wakes it) · <b>Uninterruptible</b> (D: signals wait for the hardware) · <b>Stopped</b> (T) · <b>Zombie</b> (Z: waits for the parent\'s wait()).'],  // card: the five Linux task states with their ps letters
              ['What makes a Linux thread a thread?', 'Only what it shares. clone() with CLONE_VM, CLONE_FILES, CLONE_FS, CLONE_SIGHAND and CLONE_THREAD makes one. fork() is clone() with no sharing flags. Five more flags (NEWPID, PARENT, SYSVSEM, SETTLS, VFORK) tune how the task starts.'],  // card: what makes a Linux thread a thread, and the five extra flags
              ['What do namespaces do? Name all six.', 'They give processes their own view of one part of the system: <b>mount, UTS, IPC, PID, network, user</b>.'],  // card: what namespaces do, naming all six
              ['What does a cgroup add, and what is a container?', 'A cgroup <b>limits, prioritizes, accounts for and controls</b> CPU, memory, disk I/O and network use. Container = namespaces + cgroups + own root files, on the host\'s one kernel.'],  // card: what a cgroup adds and what makes a container
            ].map(([f, b]) => [f, '<div>' + b + '</div>']), { cols: 3, height: 184 }),  // wraps each answer in its own block; the cards are laid out 3 across, 184 pixels tall
            h('div', { class: 'callout why m0', 'data-label': 'The whole section in one line', html: 'One record (<b>task_struct</b>), one creation call (<b>clone()</b>): sharing decides process versus thread, <b>namespaces</b> decide what a task can see, and <b>cgroups</b> decide how much it can use.' })));  // the whole section summed up in one line
        },  // ends render() for step 9
      },  // ends step 9

      /* ---------------- 9. Check yourself ---------------- */
      {  // step 10 starts here: the end-of-section quiz
        title: 'Check yourself',  // step 10 title
        kind: 'check',  // kind "check": the guide's quiz engine builds this screen from the questions below
        quiz: [  // quiz: the questions; each has a type (multiple choice if none is given), the answer and an explanation
          { q: 'A Linux task is blocked while a disk controller finishes a transfer, and it will not react to any signal until the hardware is done. Which state is it in?',  // question 1 (multiple choice): a task waiting on a disk that ignores signals
            choices: ['Interruptible', 'Uninterruptible', 'Stopped', 'Zombie'], answer: 1,  // choices; the answer is index 1, Uninterruptible
            feedback: ['An Interruptible task is woken by a signal. This one will not react to signals until the hardware is done, so it is in the other blocked state.', null, 'A Stopped task was halted by a signal or a debugger; it is not waiting on hardware.', 'A Zombie has already terminated; it is not waiting for anything except its parent\'s wait().'],  // feedback for each wrong choice (null marks the right one)
            why: 'Uninterruptible (ps shows D) is the blocked state for waits directly on hardware. Signals sent meanwhile stay pending and are acted on only after the wait ends.' },  // explanation: Uninterruptible (D) is the state for waits directly on hardware
          { type: 'tf', q: 'Linux keeps a separate, smaller data structure for each thread, alongside the task_struct of the process that owns it.', answer: false,  // question 2 (true or false): does Linux keep a separate structure for threads? The answer is false
            why: 'Linux has no separate thread structure. Every thread is a task with its own full task_struct; the threads of one process simply point to the same memory, open files and other resources.' },  // explanation: every thread is a task with its own full task_struct
          { type: 'bucket', q: 'Sort each piece of a task_struct into its category.', buckets: ['Identifiers', 'Links', 'File system', 'Address space'],  // question 3 (sort into groups): task_struct pieces into four categories
            items: [['user and group IDs', 0], ['list of the task\'s children', 1], ['pointer to the open-file table', 2], ['current and root directory', 2], ['description of the virtual memory', 3]],  // items, each with the index of its correct group
            why: 'Identifiers say who the task is and who it runs for; links hold its family tree; the file-system part points to open files and directories; the address-space part describes its virtual memory.' },  // explanation of what each of the four categories covers
          { type: 'match', q: 'Match each clone() flag to what the new task shares with its creator.',  // question 4 (match): each main clone() flag to what it shares
            pairs: [['CLONE_VM', 'the address space (memory)'], ['CLONE_FILES', 'the open-file table'], ['CLONE_FS', 'current directory, root directory and umask'], ['CLONE_SIGHAND', 'the table of signal handlers'], ['CLONE_THREAD', 'membership of the same thread group']],  // the five flag and meaning pairs
            why: 'Each flag shares one resource instead of copying it. Setting all five (as pthread_create() does) makes the new task a thread of the same process; setting none of them is exactly fork().' },  // explanation: all five make a thread, none of them make fork()
          { type: 'match', q: 'Match each Linux namespace to what it gives its processes their own copy of.',  // question 5 (match): each namespace to what it isolates
            pairs: [['Mount', 'the file-system tree (mount points)'], ['UTS', 'hostname and domain name'], ['IPC', 'semaphores, message queues and shared memory'], ['PID', 'process ID numbers'], ['Network', 'network devices, IP addresses, routes and ports'], ['User', 'user and group ID numbers']],  // the six namespace pairs
            why: 'Each namespace isolates one kind of resource. Together the six give a container its own view of the system.' },  // explanation: together the six give a container its own view
          { type: 'num', q: 'A web server\'s main thread starts 7 worker threads with pthread_create(). How many task_structs does the Linux kernel keep for this one process?', answer: 8, tol: 0,  // question 6 (calculate): a main thread plus 7 workers; the answer is 8 task_structs
            why: 'Every thread is its own task: 1 main thread + 7 workers = 8 task_structs. They form one thread group and share one TGID, which is the process ID that getpid() reports.' },  // explanation: 1 + 7 = 8 tasks in one thread group
          { type: 'num', q: 'A container\'s cgroup has cpu.max set to "50000 100000": a quota of 50,000 µs of CPU time in every 100,000 µs period. At most how many milliseconds of CPU time can the container use in one second?', answer: 500, tol: 0, unit: 'ms',  // question 7 (calculate): cpu.max of 50000 per 100000; the answer is 500 ms per second
            why: '50,000 µs per 100,000 µs is half a processor. One second holds 10 periods, so the most it can use is 10 × 50 ms = 500 ms; after that its threads are throttled until the next period.' },  // explanation: half a processor, 10 periods a second, 10 times 50 ms
          { type: 'order', q: 'Put the life of a Linux task in order.',  // question 8 (put in order): the life of a Linux task
            items: ['clone() or fork() creates it: Running, ready to run', 'The scheduler dispatches it and it executes', 'It waits for a key press and becomes Interruptible', 'The key press wakes it: Running (ready) again', 'It calls exit() and becomes a Zombie', 'Its parent calls wait() and the task_struct is freed'],  // the six stages, listed here in the correct order (the quiz shuffles them)
            why: 'Created ready, dispatched, blocked on an event, woken back to ready, terminated into a zombie, and finally removed when the parent collects its exit status.' },  // explanation of the sequence from creation to removal
          { q: 'A shell is about to start a new program. Its child will call exec() at once, so the shell wants the child to <b>borrow</b> the shell\'s memory instead of getting its own copy, and the shell wants to sleep until that exec() happens. Which clone() flags ask for exactly this?',  // question 9 (multiple choice): which flags let a child borrow memory while the shell sleeps
            choices: ['CLONE_VM | CLONE_VFORK', 'No flags at all, as fork() uses', 'CLONE_VM | CLONE_SIGHAND | CLONE_THREAD', 'CLONE_VFORK on its own'], answer: 0,  // choices; the answer is index 0, CLONE_VM with CLONE_VFORK
            feedback: [null, 'That is fork(): clone() with no sharing flags. The child gets its own (copy-on-write) copy of memory, and the shell keeps running instead of waiting.', 'That makes a thread: memory is shared, but the caller keeps running alongside the new task instead of sleeping until an exec().', 'CLONE_VFORK alone does pause the caller, but without CLONE_VM the child gets its own copy of memory instead of borrowing the parent\'s.'],  // feedback for each wrong choice
            why: 'CLONE_VM lends the parent\'s memory to the child with no copying, and CLONE_VFORK keeps the parent asleep until the child calls exec() or exits, so the two never use that memory at once. This pair is what vfork() asks for; fork(), by contrast, is clone() with none of the sharing flags.' },  // explanation: CLONE_VM lends memory and CLONE_VFORK keeps the parent asleep
          { type: 'multi', q: 'Which statements about Linux containers are true?',  // question 10 (select all that apply): true statements about containers
            choices: ['All containers on a host share the host\'s one kernel', 'Namespaces decide what a container\'s processes can see', 'cgroups limit and account for the resources a container uses', 'Each container boots its own guest kernel, like a virtual machine', 'A process can be PID 1 inside its container and have a different PID on the host'], answer: [0, 1, 2, 4],  // choices; the right ones are indexes 0, 1, 2 and 4
            why: 'A container is a set of ordinary tasks isolated by namespaces and limited by cgroups on the host\'s kernel. Its PID namespace numbers processes from 1, while the host numbers the same processes its own way. Only a virtual machine runs a separate kernel.' },  // explanation: containers share the host's kernel; only a virtual machine runs its own
          { q: 'Inside its user namespace a container process runs as UID 0 (root), and that ID maps to UID 100000 on the host. What may it do to a host file owned by the host\'s real root?',  // question 11 (multiple choice): what root inside a user namespace may do to a host file
            choices: ['Anything, because it is root', 'Only what an ordinary user with UID 100000 could do', 'Nothing with any file anywhere', 'Read it freely but not write it'], answer: 1,  // choices; the answer is index 1, only what the mapped ordinary user could do
            feedback: ['It is root only inside its own namespace; outside, the kernel sees UID 100000.', null, 'It can still use files inside its own container and any files UID 100000 is allowed to use.', 'Permission checks on the host use UID 100000, which gives no special right to read root\'s files.'],  // feedback for each wrong choice
            why: 'A user namespace maps IDs. Root powers apply to things owned by the process\'s own namespaces; on the host it is treated as the unprivileged user it maps to.' },  // explanation: root powers apply only to things the namespace owns
          { q: 'A debugger has paused a program. Which Linux state is the program in, and what brings it back?',  // question 12 (multiple choice): the state of a program paused by a debugger
            choices: ['Stopped: it runs again only when another process acts on it, here the debugger telling it to continue', 'Interruptible: it wakes by itself when its I/O completes', 'Zombie: its parent must call wait()', 'Running: the scheduler resumes it when its time slice refills'], answer: 0,  // choices; the answer is index 0, Stopped, resumed by the debugger
            feedback: [null, 'Interruptible tasks wait for an event. A paused program is not waiting for I/O; it will not move until someone else acts.', 'A zombie has terminated for good; wait() removes it rather than resuming it.', 'A paused task is not runnable, so the scheduler never picks it.'],  // feedback for each wrong choice
            why: 'Stopped (ps shows T, or a lowercase t while a debugger traces it) means halted and not runnable. Only a positive action by another process lets it run again: SIGCONT for an ordinary stop, or the debugger\'s continue command for a traced program.' },  // explanation: Stopped means halted and not runnable until another process acts
        ],  // closes the quiz list
      },  // ends step 10
    ],  // closes the steps list

    notes: `${/* notes: the printable summary of this section, written as HTML, shown in the Notes panel */''}
      <h3>1. One kind of task</h3>${/* heading for part 1 of the notes: one kind of task */''}
      <p>Linux keeps one kind of record. Every process and every thread is a <b>task</b> described by a <b>task_struct</b> (Linux's process control block). Two tasks count as two processes or as two threads of one process only by <b>how much they share</b>: processes have their own copies of memory, open files and so on; threads point to the same ones. (This Linux meaning of "task" is not the older one from section 4.1, where "task" was another name for the resource-owning process. Because each thread has its own task_struct, the task_struct also plays the role of the thread control block.)</p>${/* notes paragraph: every process and thread is a task, and sharing alone makes processes or threads */''}

      <h3>2. task_struct: the kernel's record of a task</h3>${/* heading for part 2 of the notes: the task_struct */''}
      <p>Well over a hundred fields, in nine groups:</p>${/* notes line: the task_struct has well over a hundred fields, grouped in nine */''}
      <table>${/* starts the table of the nine task_struct groups */''}
        <tr><th>Group</th><th>What it holds</th><th>Example fields</th></tr>${/* table heading row: group, what it holds, example fields */''}
        <tr><td>State</td><td>Which of the five states the task is in.</td><td>state</td></tr>${/* table row: the State group */''}
        <tr><td>Scheduling information</td><td>Normal or real-time class (real-time runs first), priority, and a counter of the processor time it may still use.</td><td>policy, prio, time_slice</td></tr>${/* table row: scheduling information */''}
        <tr><td>Identifiers</td><td>Unique process ID; user and group IDs used for access rights.</td><td>pid, tgid, uid, gid</td></tr>${/* table row: identifiers */''}
        <tr><td>Interprocess communication</td><td>Pending signals, signal handlers, System V semaphores, message queues, shared memory.</td><td>pending, sighand, sysvsem</td></tr>${/* table row: interprocess communication */''}
        <tr><td>Links</td><td>Pointers to parent, siblings and children.</td><td>real_parent, children, sibling</td></tr>${/* table row: links to parent, siblings and children */''}
        <tr><td>Times and timers</td><td>Creation time, processor time used (user and kernel mode), interval timers that signal the task when they expire.</td><td>start_time, utime, stime</td></tr>${/* table row: times and timers */''}
        <tr><td>File system</td><td>Pointers to the open-file table, the current directory and the root directory.</td><td>files, fs</td></tr>${/* table row: file-system pointers */''}
        <tr><td>Address space</td><td>Pointer to the description of the virtual address space.</td><td>mm</td></tr>${/* table row: address space */''}
        <tr><td>Processor-specific context</td><td>Saved registers and stack information so the task can resume; depends on the processor type.</td><td>thread, stack</td></tr>${/* table row: processor-specific context */''}
      </table>${/* ends the task_struct table */''}
      <p>Many fields are <b>pointers</b>, so two tasks can point to the same table: that is how sharing works.</p>${/* notes paragraph: many fields are pointers, which is how tasks share */''}

      <h3>3. The five Linux task states</h3>${/* heading for part 3 of the notes: the five Linux states */''}
      <table>${/* starts the table of states */''}
        <tr><th>State</th><th>ps shows</th><th>Meaning</th></tr>${/* table heading row: state, ps letter, meaning */''}
        <tr><td>Running</td><td>R</td><td>Executing now, or ready in the run queue (TASK_RUNNING for both).</td></tr>${/* table row: Running (R), for executing and ready alike */''}
        <tr><td>Interruptible</td><td>S</td><td>Blocked until an event: I/O done, a resource free, or a signal. A signal wakes it.</td></tr>${/* table row: Interruptible (S), woken by an event or a signal */''}
        <tr><td>Uninterruptible</td><td>D</td><td>Blocked directly on a hardware condition (e.g. a disk transfer); handles no signals until it is met. Newer kernels add a killable variant that SIGKILL alone can end.</td></tr>${/* table row: Uninterruptible (D), waiting on hardware and ignoring signals */''}
        <tr><td>Stopped</td><td>T</td><td>Halted; resumes only when another process acts (e.g. SIGCONT). A program held by a debugger is stopped too (ps shows t, traced); the debugger resumes it.</td></tr>${/* table row: Stopped (T), halted until another process acts */''}
        <tr><td>Zombie</td><td>Z</td><td>Terminated, but its task_struct stays in the process table until the parent's wait().</td></tr>${/* table row: Zombie (Z), terminated and waiting for the parent's wait() */''}
      </table>${/* ends the states table */''}
      <p><b>Transitions.</b> Creation puts a task in Running (ready); scheduling moves it between ready and executing. Waiting sends it to Interruptible or Uninterruptible; the event (or, for Interruptible only, a signal) returns it to ready. A stop signal sends it to Stopped; SIGCONT returns it to ready. Termination makes it a Zombie; the parent's wait() removes it.</p>${/* notes paragraph: which events move a task from state to state */''}
      <p>A task acts on signals only when it runs, so a signal sent to an Uninterruptible task, even SIGKILL, stays pending until the hardware wait ends: a process stuck in plain D sleep cannot be killed. A typical life: created (ready) → executing → waits for a key (Interruptible) → key press (ready) → exit() (Zombie) → parent's wait() frees the task_struct.</p>${/* notes paragraph: why a task in D sleep cannot be killed, and a typical life from creation to removal */''}

      <h3>4. Linux threads are tasks that share</h3>${/* heading for part 4 of the notes: threads are tasks that share */''}
      <p>Traditional UNIX gave each process one thread. Linux keeps no separate structure for threads: each user-level thread is mapped onto its own kernel-level task (one-to-one), and the tasks of one program share one <b>thread group ID (TGID)</b>. getpid() returns the TGID; gettid() returns the task's own ID. ps shows one line per process (PID = TGID); ps -L shows one line per task (LWP column).</p>${/* notes paragraph: one-to-one threads, the TGID, getpid() versus gettid(), ps versus ps -L */''}
      <p>Because tasks of a group share memory and files, switching between them skips the expensive part of a context switch: the memory map stays loaded. Switching to another group's task must load a new map.</p>${/* notes paragraph: why switching between tasks of one group is cheaper */''}
      <p><b>Worked example.</b> A web server's main thread creates 7 workers with pthread_create(). The kernel keeps 1 + 7 = <b>8 task_structs</b>, all in one thread group with one TGID.</p>${/* notes worked example: a main thread plus 7 workers means 8 task_structs */''}

      <h3>5. clone() and its flags</h3>${/* heading for part 5 of the notes: clone() and its flags */''}
      <p>A new task starts as a copy of the current one. Linux creates it with <b>clone()</b>, whose flags choose, resource by resource, sharing or copying. <b>fork() is clone() with all sharing flags cleared.</b> Two tasks sharing one virtual memory act as threads of one process, with no separate thread structure.</p>${/* notes paragraph: clone() chooses share or copy per resource, and fork() is clone() with no sharing flags */''}
      <table>${/* starts the table of clone() flags */''}
        <tr><th>Flag</th><th>Effect</th></tr>${/* table heading row: flag and effect */''}
        <tr><td>CLONE_VM</td><td>Share the address space (memory).</td></tr>${/* table row: CLONE_VM */''}
        <tr><td>CLONE_FILES</td><td>Share the open-file table.</td></tr>${/* table row: CLONE_FILES */''}
        <tr><td>CLONE_FS</td><td>Share current directory, root directory and umask (default permissions for new files).</td></tr>${/* table row: CLONE_FS */''}
        <tr><td>CLONE_SIGHAND</td><td>Share the table of signal handlers.</td></tr>${/* table row: CLONE_SIGHAND */''}
        <tr><td>CLONE_THREAD</td><td>Join the caller's thread group (same TGID).</td></tr>${/* table row: CLONE_THREAD */''}
        <tr><td>CLONE_NEWPID</td><td>Start the new task in a new PID namespace, where it is PID 1 (container runtimes; needs administrator rights).</td></tr>${/* table row: CLONE_NEWPID */''}
        <tr><td>CLONE_PARENT</td><td>The new task gets the caller's parent, so it is the caller's sibling and its exit is reported to that parent.</td></tr>${/* table row: CLONE_PARENT */''}
        <tr><td>CLONE_SYSVSEM</td><td>Share one list of semaphore undo entries (changes the kernel reverses when a task exits); undone once, when the last sharer exits.</td></tr>${/* table row: CLONE_SYSVSEM */''}
        <tr><td>CLONE_SETTLS</td><td>Point the new task at its own thread-local storage block (per-thread variables such as errno).</td></tr>${/* table row: CLONE_SETTLS */''}
        <tr><td>CLONE_VFORK</td><td>Caller sleeps until the child calls exec() or exits; with CLONE_VM the child borrows the parent's memory, no copying (vfork(), posix_spawn()).</td></tr>${/* table row: CLONE_VFORK */''}
      </table>${/* ends the clone() flags table */''}
      <p>fork() = no sharing flags (plus SIGCHLD, the signal the parent gets when the child ends); vfork() = CLONE_VM + CLONE_VFORK; pthread_create() = CLONE_VM, FS, FILES, SIGHAND, THREAD, SYSVSEM, SETTLS. Without CLONE_VM a child's write changes only its own copy; with it, both tasks use the same memory, so the parent can read the new value (reliably, and in order, only with synchronization such as a lock or an atomic operation; section 5.1).</p>${/* notes paragraph: the flag sets behind fork(), vfork() and pthread_create(), and what sharing memory means */''}
      <p><b>Invalid combinations (errno = EINVAL, no task is made).</b> For the flags above: CLONE_SIGHAND without CLONE_VM (handlers are code addresses, so sharing them needs shared memory); CLONE_THREAD without CLONE_SIGHAND (a thread group shares one set of handlers); and CLONE_THREAD with CLONE_NEWPID (the threads of a group share one queue of waiting signals, so they must share one PID numbering). <b>A documentation discrepancy:</b> the clone() manual also lists CLONE_PARENT with CLONE_NEWPID as EINVAL, and kernels before 3.13 refused it, but current kernels accept the pair (the new namespace's PID 1 then becomes a child of the caller's parent); the lab follows current kernels and shows a portability note, because portable code still avoids the pair. The manual also forbids CLONE_FS with CLONE_NEWNS (a new mount namespace needs its own root and current directory), CLONE_SYSVSEM with CLONE_NEWIPC (the shared undo entries would refer to semaphores the new IPC namespace cannot reach), and CLONE_NEWUSER with CLONE_THREAD or CLONE_FS.</p>${/* notes paragraph: the flag combinations the kernel rejects, and the one the manual and kernels disagree on */''}

      <h3>6. Namespaces</h3>${/* heading for part 6 of the notes: namespaces */''}
      <p>A <b>namespace</b> gives a process, or processes sharing it, a different view of the system from other processes; namespaces are the basis of containers. The six classic ones (newer kernels add cgroup and time namespaces):</p>${/* notes paragraph: what a namespace is, and that newer kernels add two more */''}
      <table>${/* starts the table of namespaces */''}
        <tr><th>Namespace</th><th>Its processes get their own…</th><th>clone() flag</th></tr>${/* table heading row: namespace, what its processes get, clone() flag */''}
        <tr><td>Mount</td><td>mount points, so a different file-system tree and root</td><td>CLONE_NEWNS</td></tr>${/* table row: mount namespace */''}
        <tr><td>UTS</td><td>hostname and domain name (what uname() reports)</td><td>CLONE_NEWUTS</td></tr>${/* table row: UTS namespace */''}
        <tr><td>IPC</td><td>semaphores, message queues, shared-memory segments</td><td>CLONE_NEWIPC</td></tr>${/* table row: IPC namespace */''}
        <tr><td>PID</td><td>process ID numbering; the first process inside is PID 1</td><td>CLONE_NEWPID</td></tr>${/* table row: PID namespace */''}
        <tr><td>Network</td><td>network devices, IP addresses, routing table, port numbers</td><td>CLONE_NEWNET</td></tr>${/* table row: network namespace */''}
        <tr><td>User</td><td>user and group ID mapping</td><td>CLONE_NEWUSER</td></tr>${/* table row: user namespace */''}
      </table>${/* ends the namespaces table */''}
      <p>They are made with clone() flags or unshare() (for PID, unshare() places only the caller's future children in the new namespace), and joined with setns(). In a PID namespace a process can be PID 1 inside and have another PID on the host. In a user namespace it can be root (UID 0) inside yet map to an ordinary UID such as 100000 outside, with no power over the host.</p>${/* notes paragraph: making namespaces with clone() or unshare(), joining with setns(), PID and user examples */''}

      <h3>7. Control groups and containers</h3>${/* heading for part 7 of the notes: control groups and containers */''}
      <p>A <b>control group (cgroup)</b> is a group of tasks in a tree of directories under /sys/fs/cgroup. The kernel can <b>limit</b> the group's CPU time, memory, disk I/O and network (files such as cpu.max, memory.max), <b>prioritize</b> it (cpu.weight), <b>account</b> for its use, and <b>control</b> it as a unit (freeze or kill all its tasks). Namespaces decide what a process can <b>see</b>; cgroups, how much it can <b>use</b>.</p>${/* notes paragraph: what a cgroup is and the four things it can do to a group */''}
      <p><b>Worked example.</b> cpu.max = "50000 100000" means a quota of 50,000 µs of CPU time in every 100,000 µs period: half a processor. One second holds 10 periods, so the group can use at most 10 × 50 ms = <b>500 ms</b> of CPU time per second; once the quota is spent its threads are throttled until the next period. Without cgroups, 8 busy threads in one container and 1 in another on 4 cores get 4/9 ≈ 0.44 core each, so the lone thread runs 2.25 times slower. A group over its memory.max loses a process to the out-of-memory killer inside that group only.</p>${/* notes worked example: reading cpu.max, and what happens without cgroups or over the memory limit */''}
      <p>A <b>container</b> = namespaces + cgroups + its own root file system, as ordinary tasks on the host's one kernel (Docker, LXC). A virtual machine runs its own guest kernel on a hypervisor and must boot a whole OS.</p>${/* notes paragraph: a container versus a virtual machine */''}
    `,  // end of the notes text
  });  // closes the object passed to Guide.section()
})();  // ends and immediately runs the wrapper function that keeps this file's names private
