/* =====================================================================
   Section 4.6  Linux Process and Thread Management
   Linux tasks and task_struct, the five Linux task states, threads as
   tasks that share (clone() and its flags), namespaces and cgroups.
   Original teaching material, built step by step (see AUTHORING.txt).
   ===================================================================== */
(() => {
  /* ---------- shared helpers (scoped to this file) ---------- */
  const COLS = { cpu: 'var(--cpu)', mem: 'var(--mem)', io: 'var(--io)', os: 'var(--os)', proc: 'var(--proc)', thread: 'var(--thread)', intr: 'var(--intr)', warn: 'var(--warn)', accent: 'var(--accent)', ok: 'var(--ok)' };

  /* The nine kinds of information in a task_struct (step 2). Field names follow the kernel source, lightly simplified. */
  const TS_CATS = [
    { name: 'State', col: 'proc', fields: ['state'],
      what: 'Which of the five Linux states the task is in right now: Running, Interruptible, Uninterruptible, Stopped or Zombie.',
      why: 'The scheduler only ever picks tasks whose state is Running. A sleeping task is skipped until some event changes its state.',
      eg: 'state = TASK_INTERRUPTIBLE <span class="muted">(waiting for a key press)</span>' },
    { name: 'Scheduling information', col: 'cpu', fields: ['policy', 'prio', 'time_slice'],
      what: 'Whether the task is a <b>normal</b> or a <b>real-time</b> task, its priority, and a counter of how much processor time it is allowed before it must give way.',
      why: 'Real-time tasks are always scheduled ahead of normal ones, and priority orders the tasks inside each class. The counter lets the kernel take the processor back fairly.',
      eg: 'policy = SCHED_NORMAL, prio = 120 <span class="muted">(the usual value for a normal task)</span>' },
    { name: 'Identifiers', col: 'accent', fields: ['pid', 'tgid', 'uid', 'gid'],
      what: 'A unique process identifier for the task, plus the user and group identifiers of the person it runs for. A group identifier lets a resource be opened to a whole group of users at once.',
      why: 'Every permission check (may this task open that file, or signal that process?) compares these IDs.',
      eg: 'pid = 4213, tgid = 4213, uid = 1000 (alice), gid = 100 (users)' },
    { name: 'Interprocess communication', col: 'intr', fields: ['pending', 'sighand', 'sysvsem'],
      what: 'The task\'s hooks into the classic UNIX ways of talking between processes: signals waiting to be delivered, its table of signal handlers, and System V semaphores, message queues and shared memory.',
      why: 'A signal can arrive while the task is asleep, so the kernel must hold it until the task can take it.',
      eg: 'pending = { SIGUSR1 } <span class="muted">(one signal not yet handled)</span>' },
    { name: 'Links', col: 'proc', fields: ['real_parent', 'children', 'sibling'],
      what: 'Pointers to the task\'s parent, to its siblings (other children of the same parent) and to its own children.',
      why: 'When a task ends, the kernel follows these links to notify its parent and to find a new parent for any children it leaves behind.',
      eg: 'real_parent → bash (PID 3990); children → none' },
    { name: 'Times and timers', col: 'warn', fields: ['start_time', 'utime', 'stime', 'timers'],
      what: 'When the task was created and how much processor time it has used so far, in user mode (utime) and in kernel mode (stime). The task may also set interval timers that send it a signal when they expire, once or again and again.',
      why: 'Tools such as top read these numbers, and the kernel uses them for accounting and scheduling.',
      eg: 'start_time = 09:14:02, utime = 3.20 s, stime = 0.45 s' },
    { name: 'File system', col: 'io', fields: ['files', 'fs'],
      what: 'A pointer to the table of files the task has open, and pointers to its current directory and its root directory.',
      why: 'A name like notes.txt is looked up starting at the current directory, and the number open() hands back is a slot in the open-file table.',
      eg: 'files → 23 open files; fs → cwd /home/alice, root /' },
    { name: 'Address space', col: 'mem', fields: ['mm'],
      what: 'A pointer to the description of the task\'s virtual address space: which regions exist (code, data, heap, stacks, shared libraries) and the page tables that map them onto real memory.',
      why: 'If two tasks point to the same address space, they are in effect threads of one process.',
      eg: 'mm → code, data, heap, 3 stacks, 41 shared libraries' },
    { name: 'Processor-specific context', col: 'cpu', fields: ['thread', 'stack'],
      what: 'The register values and stack information that make up the task\'s context. They are saved when the task stops running, so it can later carry on exactly where it left off.',
      why: 'This is the one part whose layout depends on the kind of processor (x86, ARM and so on).',
      eg: 'thread → saved stack pointer, instruction pointer, flags' },
  ];
  /* ---------- Linux task states (step 3) ---------- */
  const LS = {
    none: { name: 'No task yet', ps: '–', val: 'no task_struct yet', col: 'muted', desc: 'Nothing exists yet. Press <b>fork(): create</b> to make a task.' },
    ready: { term: 'Running (Linux state)', name: 'Running (ready)', ps: 'R', val: 'TASK_RUNNING', col: 'proc', desc: 'Ready to execute: it has everything it needs except a processor and waits in the run queue. Linux files this under <b>Running</b>, the same state as executing.' },
    exec: { term: 'Running (Linux state)', name: 'Running (executing)', ps: 'R', val: 'TASK_RUNNING', col: 'proc', desc: 'Executing on a processor right now. The state field is the same as for a ready task: dispatching a task does not change it.' },
    intr: { term: 'Interruptible (Linux state)', name: 'Interruptible', ps: 'S', val: 'TASK_INTERRUPTIBLE', col: 'warn', desc: 'Blocked, waiting for an event: I/O to finish, a resource to become free, or a signal from another process. A signal <b>wakes</b> it.' },
    unintr: { term: 'Uninterruptible (Linux state)', name: 'Uninterruptible', ps: 'D', val: 'TASK_UNINTERRUPTIBLE', col: 'intr', desc: 'Blocked, waiting directly on a hardware condition. It does <b>not</b> handle signals; they stay pending until the hardware is done. (Newer kernels add a <i>killable</i> variant that SIGKILL alone can end.)' },
    stopped: { term: 'Stopped (Linux state)', name: 'Stopped', ps: 'T', val: 'TASK_STOPPED', col: 'os', desc: 'Halted. It resumes only when another process acts on it, for example by sending SIGCONT. A debugger holds the program it is debugging in a stopped state too (ps shows a lowercase t, for "traced").' },
    zombie: { term: 'Zombie (Linux state)', name: 'Zombie', ps: 'Z', val: 'EXIT_ZOMBIE', col: 'muted', desc: 'Finished, but its task_struct must stay in the process table so its parent can collect the exit status with wait().' },
    gone: { name: 'Removed', ps: '–', val: 'task_struct freed', col: 'muted', desc: 'The parent collected the exit status, so the kernel freed the task_struct. Press <b>fork(): create</b> to start again.' },
  };
  const LS_MISSIONS = ['Wake an Interruptible (S) task with a signal', 'Send SIGKILL to a task in Uninterruptible (D) sleep', 'Stop a task, then let it continue', 'Make a zombie, then let its parent remove it'];
  /* One event applied to (state, pending signals). Returns the new state, the arrows it travelled, a narration and
     any mission it completes. Rule of thumb that Linux really follows: a task acts on its signals when it runs. */
  function lsEvent(st, pend, ev) {
    const out = { st, pend: pend.slice(), arrs: [], msg: '', warn: false, mission: -1 };
    const has = (x) => out.pend.includes(x);
    const add = (x) => { if (!has(x)) out.pend.push(x); };
    const drop = (x) => { out.pend = out.pend.filter((p) => p !== x); };
    const W = (m) => { out.warn = true; out.msg = m; return out; };
    const noTask = st === 'none' || st === 'gone';
    const nm = LS[st].name;
    if (ev !== 'create' && noTask) return W('There is no task yet. Press <b>fork(): create</b> first.');
    switch (ev) {
      case 'create':
        if (!noTask) return W('This lab follows one task, and it already exists. (A real program could call fork() again to make another.)');
        Object.assign(out, { st: 'ready', pend: [], arrs: ['create'], msg: '<b>fork()</b> gave the new task its own task_struct, filled in as a copy of the parent. It starts in <b>Running</b> (ready): it can run as soon as the scheduler picks it.' });
        return out;
      case 'sched':
        if (st !== 'ready') return W(`Only a ready task can be dispatched. This one is <b>${nm}</b>.`);
        out.st = 'exec'; out.arrs = ['sched'];
        if (has('SIGUSR1')) { drop('SIGUSR1'); out.msg = 'Dispatched. Before its program carries on, the task first runs its <b>SIGUSR1 handler</b>: signals are acted on when the task runs. The state field still says TASK_RUNNING.'; }
        else out.msg = 'The scheduler picked it: it is now <b>executing</b>. The state field did not change, because Linux uses TASK_RUNNING for ready and executing alike.';
        return out;
      case 'slice':
        if (st !== 'exec') return W('Only an executing task can use up a time slice.');
        Object.assign(out, { st: 'ready', arrs: ['preempt'], msg: 'Its time slice ran out, so the scheduler put it back in the run queue. It is still <b>Running</b> in Linux terms, just not on a processor.' });
        return out;
      case 'key':
      case 'disk':
        if (st !== 'exec') return W(`A task can only call read() while it is executing. This one is <b>${nm}</b>; schedule it first.`);
        if (ev === 'key') Object.assign(out, { st: 'intr', arrs: ['toIntr'], msg: 'It called read() on the keyboard and no key has been pressed yet. It sleeps in <b>Interruptible</b>: the key press (an event) or any signal will wake it.' });
        else Object.assign(out, { st: 'unintr', arrs: ['toUnintr'], msg: 'It must wait while the disk controller finishes a transfer. The kernel puts it in <b>Uninterruptible</b> sleep: a wait on hardware like this is not cut short, so signals will not wake it.' });
        return out;
      case 'io':
        if (st === 'intr') { Object.assign(out, { st: 'ready', arrs: ['fromIntr'], msg: 'A key was pressed, the event it was waiting for. The kernel wakes it: <b>Running</b> (ready) again, and read() returns the key when it next runs.' }); return out; }
        if (st !== 'unintr') return W('Nothing is waiting for I/O right now.');
        out.arrs = ['fromUnintr'];
        if (has('SIGKILL')) { Object.assign(out, { st: 'zombie', pend: [], msg: 'The disk finished, so the task finally wakes... and finds <b>SIGKILL</b> waiting. It runs just long enough to exit and becomes a <b>Zombie</b>. The kill was delayed, never lost.' }); out.arrs.push('sched', 'exit'); return out; }
        if (has('SIGSTOP')) { drop('SIGSTOP'); out.st = 'stopped'; out.arrs.push('sched', 'stop'); out.msg = 'The disk finished. The task wakes, runs just long enough to act on the pending <b>SIGSTOP</b>, and halts: <b>Stopped</b>.'; return out; }
        out.st = 'ready'; out.msg = 'The disk transfer finished, so the kernel wakes it: <b>Running</b> (ready) again.' + (has('SIGUSR1') ? ' The SIGUSR1 that arrived meanwhile will be handled when it next runs.' : '');
        return out;
      case 'usr1':
        if (st === 'zombie') return W('A zombie has already finished running, so it cannot handle signals. Only its parent\'s wait() matters now.');
        if (st === 'exec') { out.msg = 'The task is running, so it takes SIGUSR1 at once: its <b>signal handler</b> runs, then its program carries on. No state change.'; return out; }
        add('SIGUSR1');
        if (st === 'ready') out.msg = 'SIGUSR1 is now <b>pending</b>. The handler will run the next time the task is scheduled.';
        else if (st === 'intr') { Object.assign(out, { st: 'ready', arrs: ['fromIntr'], mission: 0, msg: 'The signal <b>wakes</b> the Interruptible task: Running (ready) again. Once scheduled it runs its handler; the read() it slept in then either restarts by itself or returns early with an "interrupted" error (EINTR).' }); }
        else if (st === 'unintr') out.msg = 'The task is in <b>Uninterruptible</b> sleep, so SIGUSR1 does <b>not</b> wake it. The signal stays pending until the disk is done.';
        else if (st === 'stopped') out.msg = 'A stopped task runs no handlers. SIGUSR1 stays pending until the task is continued (SIGCONT) and scheduled.';
        return out;
      case 'stop':
        if (st === 'zombie') return W('A zombie cannot be stopped: it has already finished.');
        if (st === 'stopped') return W('It is already Stopped.');
        if (st === 'unintr') { add('SIGSTOP'); out.msg = 'Uninterruptible sleep: the task cannot act on SIGSTOP yet. The stop stays pending until the disk finishes.'; return out; }
        out.st = 'stopped';
        if (st === 'exec') { out.arrs = ['stop']; out.msg = 'SIGSTOP cannot be caught or ignored. The task halts and is now <b>Stopped</b>. It will not run again until another process sends SIGCONT.'; }
        else if (st === 'ready') { out.arrs = ['sched', 'stop']; out.msg = 'A task acts on signals when it runs, so it is dispatched briefly, sees SIGSTOP and halts: <b>Stopped</b>.'; }
        else { out.arrs = ['fromIntr', 'sched', 'stop']; out.mission = 0; out.msg = 'The signal wakes the Interruptible task. It runs just long enough to act on SIGSTOP, then halts: <b>Stopped</b>.'; }
        return out;
      case 'cont':
        if (st === 'unintr' && has('SIGSTOP')) { drop('SIGSTOP'); out.msg = 'SIGCONT cancels the pending SIGSTOP. The task keeps sleeping on the disk, as before.'; return out; }
        if (st !== 'stopped') return W(`SIGCONT only matters to a Stopped task. This one is <b>${nm}</b>, so nothing happens.`);
        Object.assign(out, { st: 'ready', arrs: ['cont'], mission: 2, msg: 'SIGCONT resumes it: the task goes back to <b>Running</b> (ready) and waits for the scheduler.' + (has('SIGUSR1') ? ' Its pending SIGUSR1 will be handled when it runs.' : '') });
        return out;
      case 'kill':
        if (st === 'zombie') return W('It is already dead. A zombie ignores every signal; only the parent\'s wait() can remove it.');
        if (st === 'unintr') { add('SIGKILL'); Object.assign(out, { mission: 1, msg: 'The task is in <b>Uninterruptible</b> sleep, so even SIGKILL cannot wake it. The kill stays pending until the disk finishes. This is why a process stuck in state D cannot be killed.' }); return out; }
        out.st = 'zombie'; out.pend = [];
        if (st === 'exec') { out.arrs = ['exit']; out.msg = 'SIGKILL cannot be caught, blocked or ignored. The task ends at once and becomes a <b>Zombie</b>.'; }
        else if (st === 'ready') { out.arrs = ['sched', 'exit']; out.msg = 'The task runs just long enough to act on SIGKILL, then ends: <b>Zombie</b>.'; }
        else if (st === 'intr') { out.arrs = ['fromIntr', 'sched', 'exit']; out.mission = 0; out.msg = 'SIGKILL wakes the Interruptible task, which runs its exit path at once and becomes a <b>Zombie</b>.'; }
        else { out.arrs = ['cont', 'sched', 'exit']; out.msg = 'SIGKILL is one of the two signals that reach a Stopped task (SIGCONT is the other). It wakes, then ends: <b>Zombie</b>.'; }
        return out;
      case 'exit':
        if (st === 'zombie') return W('It has already exited.');
        if (st !== 'exec') return W(`exit() is a call the task makes itself, so it must be executing. This one is <b>${nm}</b>.`);
        Object.assign(out, { st: 'zombie', arrs: ['exit'], pend: [], msg: 'The task called exit(). Its memory and open files are released, but its task_struct stays behind as a <b>Zombie</b> holding the exit status, until the parent collects it.' });
        return out;
      case 'wait':
        if (st !== 'zombie') return W('The child has not exited, so the parent\'s wait() would just put the <b>parent</b> to sleep until it does. The child\'s state does not change.');
        Object.assign(out, { st: 'gone', arrs: ['reap'], mission: 3, msg: 'The parent called wait() and collected the exit status. Only now does the kernel free the task_struct: the zombie is gone.' });
        return out;
    }
    return out;
  }

  /* ---------- clone() flag builder (step 5) ---------- */
  const CF_MAIN = [
    { f: 'CLONE_VM', d: 'share the address space (all of memory)' },
    { f: 'CLONE_FILES', d: 'share the open-file table' },
    { f: 'CLONE_FS', d: 'share current dir, root dir and umask' },
    { f: 'CLONE_SIGHAND', d: 'share the table of signal handlers' },
    { f: 'CLONE_THREAD', d: 'join the caller\'s thread group (same TGID)' },
  ];
  /* The other five flags from the brief, in the brief's order. d = one-line summary (step 5), long/use = step 6 reference. */
  const CF_EXTRA = [
    { f: 'CLONE_NEWPID', d: 'The new task starts a brand-new PID namespace, in which it is PID 1.', use: 'container runtimes', would: 'put the new task in a fresh PID namespace, where it is PID 1.',
      long: 'Start the new task in a fresh <b>PID namespace</b>: PID 1 inside, an ordinary PID on the host. Needs administrator rights (or a new user namespace too).' },
    { f: 'CLONE_PARENT', d: 'The new task gets the caller\'s parent, so it is the caller\'s sibling, not its child.', use: 'helper tasks', would: 'make the new task the caller\'s sibling, so its exit is reported to the caller\'s parent.',
      long: 'Give the new task the <b>caller\'s parent</b> as its parent: it becomes the caller\'s sibling, and its exit is reported to that parent, not to the caller.' },
    { f: 'CLONE_SYSVSEM', d: 'Caller and new task share one list of System V semaphore "undo" entries.', use: 'pthread_create()', would: 'make the tasks share one list of semaphore undo entries.',
      long: 'Share one list of <b>semaphore "undo" entries</b> (a semaphore is a shared counter tasks use to take turns; chapter 5). The kernel reverses these changes when a task exits; shared, they are undone once, when the last sharer exits.' },
    { f: 'CLONE_SETTLS', d: 'The new task gets its own thread-local storage block (for variables such as errno).', use: 'pthread_create()', would: 'give the new task its own thread-local storage block (where variables such as errno live).',
      long: 'Point the new task at its own <b>thread-local storage</b>: a private block, prepared by the thread library, for per-thread variables such as errno.' },
    { f: 'CLONE_VFORK', d: 'The caller is paused until the new task calls exec() or exits.', use: 'vfork(), posix_spawn()', would: 'put the caller to sleep until the new task calls exec() or exits.',
      long: 'Put the <b>caller to sleep</b> until the new task calls exec() or exits. With CLONE_VM, the child borrows the parent\'s memory with no copying.' },
  ];
  /* Step 6 game: which extra flag does this job? [scenario, index into CF_EXTRA, why] */
  const CF_JOBS = [
    ['A shell lends its child its memory (CLONE_VM) because the child will call exec() at once to start a new program. The shell must not run again until that exec() has happened.', 4,
      'CLONE_VFORK keeps the caller asleep until the child calls exec() or exits, so parent and child never use the borrowed memory at the same time. vfork() is exactly CLONE_VM + CLONE_VFORK.'],
    ['A container runtime starts the first process of a new container. Inside the container, that process must see itself as PID 1.', 0,
      'CLONE_NEWPID gives the new task a fresh PID namespace. It is PID 1 inside, its "init", and still has an ordinary PID such as 4521 on the host, which is how the host can manage it.'],
    ['pthread_create() is making a new thread. Every thread needs its own errno variable, so an error code set by one thread can never overwrite another\'s.', 3,
      'CLONE_SETTLS makes the new task use its own thread-local storage block from the very start. Per-thread variables such as errno live there, one private copy per thread.'],
    ['A task starts a helper whose exit should be reported to the task\'s own parent, not to the task itself. The task never wants to wait() for the helper.', 1,
      'With CLONE_PARENT the helper\'s parent is the caller\'s parent, so the helper is the caller\'s sibling, and its exit is reported to that shared parent.'],
    ['The threads of one program lock a System V semaphore with the "undo when I exit" option. If the program crashes, the kernel must reverse the changes made by all of its threads together.', 2,
      'CLONE_SYSVSEM makes the tasks share one list of undo entries, so they act as one process: the adjustments are reversed once, when the last task sharing the list exits.'],
  ];
  const CF_PRESETS = {
    'fork()': [],
    'vfork()': ['CLONE_VM', 'CLONE_VFORK'],
    'pthread_create()': ['CLONE_VM', 'CLONE_FS', 'CLONE_FILES', 'CLONE_SIGHAND', 'CLONE_THREAD', 'CLONE_SYSVSEM', 'CLONE_SETTLS'],
  };
  /* The EINVAL rules from the clone() manual that involve the flags this lab offers, checked before any task is built.
     Rules for flags the lab does not offer (CLONE_NEWNS, CLONE_NEWIPC, CLONE_NEWUSER) are listed in the notes.
     Returns [headline, why] or null. A third entry, true, marks a rule the manual states but newer kernels no longer enforce. */
  function cfError(F) {
    if (F.has('CLONE_SIGHAND') && !F.has('CLONE_VM')) return ['CLONE_SIGHAND needs CLONE_VM.', 'A signal handler is a function at some address in memory. Sharing the handler table only makes sense if both tasks see the same memory.'];
    if (F.has('CLONE_THREAD') && !F.has('CLONE_SIGHAND')) return ['CLONE_THREAD needs CLONE_SIGHAND.', 'Signals can be sent to a whole thread group, so every task in the group must agree on one table of handlers.'];
    if (F.has('CLONE_THREAD') && F.has('CLONE_NEWPID')) return ['CLONE_THREAD cannot be combined with CLONE_NEWPID.', 'A new PID namespace would give the new task a different set of process IDs from the rest of its group. But the threads of a group share one queue of waiting signals, and each queued signal records its sender\'s PID as one namespace numbers it, so every thread must stay in the same PID namespace.'];
    if (F.has('CLONE_PARENT') && F.has('CLONE_NEWPID')) return ['CLONE_PARENT cannot be combined with CLONE_NEWPID.', 'CLONE_NEWPID makes the new task PID 1, the "init", of a fresh namespace, and the clone() manual says that task must be the caller\'s own child, not a sibling handed to the caller\'s parent. That way the caller, which set the namespace up, is the one told when it ends. <span class="muted">(Kernels since 3.13 quietly accept this pair, but the manual still lists it as EINVAL, so portable code avoids it.)</span>', true];
    return null;
  }
  function cfVerdict(F) {
    const main = CF_MAIN.filter((m) => F.has(m.f)).length;
    if (main === 0) return ['proc', 'A new process', F.size ? 'No sharing flag is on, so memory, files, directories and handlers are all still copied; the extras only adjust details.' : 'Nothing is shared: exactly what fork() asks for. fork() is clone() with no sharing flags.'];
    if (F.has('CLONE_VM') && F.has('CLONE_VFORK') && main === 1) return ['warn', 'A vfork() child', 'The child borrows the parent\'s memory while the parent waits; it is meant to call exec() at once.'];
    if (main === CF_MAIN.length) return ['thread', 'A thread of the same process', 'Memory, files, directories and handlers shared, same thread group: what pthread_create() asks for.'];
    return ['accent', 'Something in between', 'Linux accepts any valid mix. The kernel treats each one alike: one task_struct, some pointers shared.'];
  }

  /* The sorting game (step 2): [field, category index, plain-language hint] */
  const TS_SORT = [
    ['pid = 4213', 2, 'a number no other task has'],
    ['utime = 3.20 s', 5, 'processor time used in user mode'],
    ['mm → memory map', 7, 'the task\'s virtual memory'],
    ['real_parent → bash', 4, 'the task that created this one'],
    ['policy = SCHED_FIFO', 1, 'a real-time policy'],
    ['state = TASK_UNINTERRUPTIBLE', 0, 'what the task is doing right now'],
    ['files → open-file table', 6, 'every file the task has open'],
    ['pending = { SIGTERM }', 3, 'a signal waiting to be handled'],
    ['thread → saved registers', 8, 'register values kept while it is not running'],
    ['uid = 1000', 2, 'the user the task runs for'],
    ['start_time = 09:14:02', 5, 'the moment the task was created'],
    ['prio = 120', 1, 'how urgent the task is'],
  ];

  Guide.section({
    id: '4.6',
    title: 'Linux Process and Thread Management',
    short: 'Linux tasks & threads',
    summary: 'Linux runs processes and threads alike as tasks: task_struct, five states, clone() flags, namespaces, cgroups.',
    objectives: [
      'List the kinds of information Linux keeps in a task_struct and sort real fields into those categories.',
      'Name the five Linux task states, say which events move a task between them, and explain how Interruptible and Uninterruptible sleep differ.',
      'Explain why Linux has no separate thread structure: a thread is a task created by clone() that shares memory, files and other resources and belongs to the same thread group.',
      'Choose clone() flags that give fork()-like, vfork()-like or thread-like behaviour, predict what parent and child share, and say what CLONE_NEWPID, CLONE_PARENT, CLONE_SYSVSEM, CLONE_SETTLS and CLONE_VFORK are for.',
      'Describe the six namespaces and control groups, and explain how together they build containers.',
    ],
    terms: [
      ['task_struct', 'The data structure the Linux kernel keeps for every task, that is, for every process and every thread. It records the task\'s state, scheduling data, identifiers, family links, times, open files, address space and saved processor context.'],
      ['Linux task', 'The unit Linux creates and schedules. Every process and every thread is a task with its own task_struct; tasks count as "threads of one process" only because they share resources. (Not the older use of "task" in section 4.1 as another name for the resource-owning process.)'],
      ['Running (Linux state)', 'The Linux state that covers two situations: the task is executing on a processor right now, or it is ready and waiting for the scheduler to pick it. The ps tool shows it as R.'],
      ['Interruptible (Linux state)', 'A blocked state. The task sleeps until an event happens, such as I/O finishing, a resource becoming free or a signal arriving; a signal wakes it. ps shows it as S.'],
      ['Uninterruptible (Linux state)', 'A blocked state in which the task waits directly on a hardware condition and does not react to signals until that condition is met. ps shows it as D.'],
      ['Stopped (Linux state)', 'The task has been halted, for example by the SIGSTOP signal or by a debugger, and resumes only when another process acts on it, for example by sending SIGCONT. ps shows it as T.'],
      ['Zombie (Linux state)', 'The task has terminated, but its task_struct must stay in the process table until its parent collects the exit status with wait(). ps shows it as Z.'],
      ['clone()', 'The Linux system call that creates a new task. Its flag bits decide, resource by resource, whether the new task shares with its creator or gets its own copy.'],
      ['Clone flags', 'The bits passed to clone(), such as CLONE_VM (share memory) or CLONE_FILES (share the open-file table). With none of the sharing flags set, clone() behaves like fork().'],
      ['Thread group', 'The set of tasks created with CLONE_THREAD from one original task. They share one thread group ID (TGID), which is the process ID that getpid() reports for every one of them.'],
      ['Signal handler', 'A function a program registers to run when a particular signal arrives, for example to save its work before quitting.'],
      ['Namespace', 'A Linux feature that gives a task, or a group of tasks, its own private view of one kind of system resource, such as process IDs, network devices or the hostname.'],
      ['Mount namespace', 'Gives its tasks their own set of mount points, so they can see a different file-system tree, with a different root directory, from other tasks.'],
      ['UTS namespace', 'Gives its tasks their own hostname and domain name: the values that the uname() call and the hostname command report.'],
      ['IPC namespace', 'Gives its tasks their own set of interprocess-communication objects: semaphores, message queues and shared-memory segments.'],
      ['PID namespace', 'Gives its tasks their own process-ID numbering. The first task inside gets PID 1, and every task also has its own PID in the parent namespace, so the host can still see and manage it.'],
      ['Network namespace', 'Gives its tasks their own network stack: network devices, IP addresses, routing table and port numbers.'],
      ['User namespace', 'Gives its tasks their own mapping of user and group IDs, so a task can be root (UID 0) inside the namespace while being an ordinary, unprivileged user outside it.'],
      ['Control group (cgroup)', 'A kernel mechanism that places tasks in a tree of groups and limits, prioritizes, accounts for and controls (for example, freezes) the resources each group uses: processor time, memory, disk I/O and network.'],
      ['Container', 'A group of ordinary processes that the kernel isolates with namespaces and limits with cgroups, so it looks like its own small machine while sharing the host\'s one kernel. Docker and LXC build containers this way.'],
    ],

    /* Scoped CSS: every selector starts with .sec-4-6 */
    css: `
      /* shell workaround: in narrow mode the nowrap eyebrow can set the canvas min-width and scroll the page sideways */
      .sec-4-6 .step-eyebrow { contain: inline-size; }
      .sec-4-6 .p15 { font-size: 15.5px; line-height: 1.45; }
      .sec-4-6 .p15 p { margin: 0 0 8px; }
      .sec-4-6 .lbl { font-size: 12.5px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
      .sec-4-6 .callout { font-size: 15px; line-height: 1.45; }
      .sec-4-6 .hot { cursor: pointer; outline: none; }
      /* step 2: task_struct inspector */
      .sec-4-6 .ts-list { display: flex; flex-direction: column; gap: 5px; }
      .sec-4-6 .ts-brace { font-family: var(--mono); font-size: 14.5px; color: var(--muted); font-weight: 700; }
      .sec-4-6 .ts-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 9px 10px 9px 12px; border: 1.5px solid var(--line); border-left: 6px solid var(--c); border-radius: 10px; background: var(--panel-2); cursor: pointer; font: inherit; color: var(--ink); text-align: left; transition: background .15s, border-color .15s; }
      .sec-4-6 .ts-row b { font-size: 15.5px; white-space: nowrap; }
      .sec-4-6 .ts-row:hover { border-color: var(--c); }
      .sec-4-6 .ts-row.on { background: color-mix(in srgb, var(--c) 13%, var(--panel)); border-color: var(--c); box-shadow: 0 0 0 1px var(--c); }
      .sec-4-6 .ts-row.ok { background: var(--ok-bg); border-color: var(--ok); border-left-color: var(--ok); }
      .sec-4-6 .ts-row.bad { background: var(--bad-bg); border-color: var(--bad); border-left-color: var(--bad); }
      .sec-4-6 .ts-fields { display: flex; gap: 4px; flex-wrap: wrap; justify-content: flex-end; }
      .sec-4-6 .ts-fields code { font-size: 12.5px; }
      .sec-4-6 .ts-eg { font-family: var(--mono); font-size: 14.5px; padding: 8px 12px; border-radius: 10px; background: var(--panel-3); border-left: 4px solid var(--chc); }
      .sec-4-6 .ts-q { font-family: var(--mono); font-size: 25px; font-weight: 800; text-align: center; padding: 16px 12px 6px; }
      .sec-4-6 .ts-fb { flex: none; min-height: 76px; font-size: 15.5px; line-height: 1.45; padding: 10px 14px; border-radius: 12px; background: var(--panel-2); border: 1px solid var(--line); }
      .sec-4-6 .ts-fb.ok { background: var(--ok-bg); border-color: var(--ok); }
      .sec-4-6 .ts-fb.bad { background: var(--bad-bg); border-color: var(--bad); }
      .sec-4-6 .ts-dots { display: flex; gap: 5px; flex-wrap: wrap; }
      .sec-4-6 .ts-dots i { width: 14px; height: 14px; border-radius: 50%; border: 2px solid var(--line-2); display: block; }
      .sec-4-6 .ts-dots i.ok { background: var(--ok); border-color: var(--ok); }
      .sec-4-6 .ts-dots i.late { background: var(--warn); border-color: var(--warn); }
      .sec-4-6 .ts-dots i.cur { border-color: var(--chc); box-shadow: 0 0 0 2px color-mix(in srgb, var(--chc) 30%, transparent); }
      /* step 3: Linux state machine */
      .sec-4-6 .ls-box rect { stroke-width: 2; transition: stroke-width .2s; }
      .sec-4-6 .ls-box.cur rect { stroke-width: 4.5; }
      .sec-4-6 .ls-box .t1 { font-size: 16px; font-weight: 800; }
      .sec-4-6 .ls-box .t2 { font-size: 13.5px; fill: var(--muted); }
      .sec-4-6 .ls-arr path { fill: none; stroke: var(--line-2); stroke-width: 2; transition: stroke .2s; }
      .sec-4-6 .ls-arr text { font-size: 13.5px; fill: var(--muted); font-weight: 700; }
      .sec-4-6 .ls-arr.hi path { stroke: var(--accent); stroke-width: 3.5; }
      .sec-4-6 .ls-arr.hi text { fill: var(--accent); }
      .sec-4-6 .ls-dot { fill: var(--chc); stroke: var(--panel); stroke-width: 2.5; transition: transform .35s ease; }
      .sec-4-6 .ls-ev { display: grid; grid-template-columns: 78px minmax(0, 1fr); gap: 7px 8px; align-items: center; }
      .sec-4-6 .ls-ev .row { gap: 6px; }
      .sec-4-6 .ls-card { border-left: 6px solid var(--c); }
      .sec-4-6 .ls-hist { display: flex; gap: 3px; flex-wrap: wrap; min-height: 24px; }
      .sec-4-6 .ls-hist span { font-family: var(--mono); font-weight: 800; font-size: 13px; width: 22px; height: 22px; display: grid; place-items: center; border-radius: 6px; background: var(--panel-3); color: var(--ink-2); }
      .sec-4-6 .ls-hist span.last { background: var(--chc); color: var(--panel); }
      .sec-4-6 .ls-mis { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 3px 14px; font-size: 14px; }
      .sec-4-6 .nrw .ls-mis { grid-template-columns: 1fr; }
      .sec-4-6 .ls-narr { font-size: 14.5px; }
      .sec-4-6 .ls-mis div { display: flex; gap: 7px; align-items: baseline; color: var(--ink-2); }
      .sec-4-6 .ls-mis div b { width: 16px; flex: none; color: var(--muted); }
      .sec-4-6 .ls-mis div.ok { color: var(--ok); }
      .sec-4-6 .ls-mis div.ok b { color: var(--ok); }
      .sec-4-6 .ls-narr.warn { background: var(--warn-bg); border-color: var(--warn); }
      .sec-4-6 .ls-sig { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 1px 10px; font-size: 13.5px; line-height: 1.3; margin: 2px 0 6px; }
      .sec-4-6 .ls-sig b { font-family: var(--mono); font-size: 13px; }
      /* step 4: thread groups */
      .sec-4-6 .th-grps { display: grid; grid-template-columns: minmax(0, 2.6fr) minmax(0, 1fr); gap: 10px; }
      .sec-4-6 .th-grp { border: 2px solid var(--c); background: color-mix(in srgb, var(--c) 7%, var(--panel)); border-radius: 12px; padding: 8px 10px; display: flex; flex-direction: column; gap: 6px; }
      .sec-4-6 .th-grp .hd { font-size: 13.5px; font-weight: 800; color: var(--c); line-height: 1.3; }
      .sec-4-6 .th-tasks { display: flex; gap: 6px; }
      .sec-4-6 .th-task { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 1px; padding: 7px 4px; border: 2px solid var(--line); border-radius: 10px; background: var(--panel); cursor: pointer; font: inherit; color: var(--ink); }
      .sec-4-6 .th-task b { font-family: var(--mono); font-size: 15.5px; }
      .sec-4-6 .th-task span { font-size: 12.5px; color: var(--muted); }
      .sec-4-6 .th-task:hover { border-color: var(--c); }
      .sec-4-6 .th-task.run { border-color: var(--c); box-shadow: 0 0 0 2px var(--c); background: color-mix(in srgb, var(--c) 18%, var(--panel)); }
      .sec-4-6 .th-task.run span { color: var(--c); font-weight: 800; }
      .sec-4-6 .th-steps { display: grid; gap: 3px; font-size: 14.5px; line-height: 1.35; }
      .sec-4-6 .th-steps div { display: flex; gap: 8px; }
      .sec-4-6 .th-steps b { width: 16px; flex: none; text-align: center; }
      .sec-4-6 .th-steps .skip { color: var(--ok); }
      .sec-4-6 .th-steps .cost { color: var(--bad); }
      .sec-4-6 .th-hist { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; font-family: var(--mono); font-size: 13px; min-height: 24px; }
      .sec-4-6 .th-hist .tk { padding: 1px 6px; border-radius: 6px; font-weight: 800; background: color-mix(in srgb, var(--c) 16%, var(--panel)); color: var(--c); }
      .sec-4-6 .th-hist .hv { color: var(--bad); font-weight: 900; font-size: 17px; line-height: 1; }
      .sec-4-6 .th-hist .lt { color: var(--muted); }
      .sec-4-6 .th-ps { font-family: var(--mono); font-size: 14px; white-space: pre; background: var(--panel-3); border-radius: 10px; padding: 7px 12px; line-height: 1.5; margin: 0; overflow: hidden; }
      .sec-4-6 .th-ps b { color: var(--muted); }
      /* step 5: clone() flag builder */
      .sec-4-6 .cf-flag { display: grid; grid-template-columns: 36px 124px minmax(0, 1fr); align-items: center; gap: 0 10px; padding: 6px 10px; border: 1.5px solid var(--line); border-radius: 10px; background: var(--panel-2); cursor: pointer; font: inherit; color: var(--ink); text-align: left; width: 100%; transition: background .15s, border-color .15s; }
      .sec-4-6 .cf-flag:hover { border-color: var(--ok); }
      .sec-4-6 .cf-sw { width: 36px; height: 20px; border-radius: 99px; background: var(--line-2); position: relative; transition: background .15s; }
      .sec-4-6 .cf-sw::after { content: ''; position: absolute; top: 3px; left: 3px; width: 14px; height: 14px; border-radius: 50%; background: var(--panel); transition: left .15s; }
      .sec-4-6 .cf-flag.on { border-color: var(--ok); background: var(--ok-bg); }
      .sec-4-6 .cf-flag.on .cf-sw { background: var(--ok); }
      .sec-4-6 .cf-flag.on .cf-sw::after { left: 19px; }
      .sec-4-6 .cf-flag b { font-family: var(--mono); font-size: 14px; line-height: 1.3; }
      .sec-4-6 .nrw .cf-flag { grid-template-columns: 36px minmax(0, 1fr); }
      .sec-4-6 .nrw .cf-flag span { grid-column: 2; }
      .sec-4-6 .cf-flag span { font-size: 13.5px; color: var(--ink-2); line-height: 1.3; }
      .sec-4-6 .cf-x { font-family: var(--mono); font-size: 12.5px; }
      .sec-4-6 .cf-verdict { border-left: 6px solid var(--c); }
      .sec-4-6 .cf-verdict h3 { color: var(--c); font-size: 18px; margin: 0 0 2px; }
      .sec-4-6 .cf-svg .lab { font-size: 14px; font-weight: 800; }
      .sec-4-6 .cf-svg .flag { font-size: 12.5px; font-family: var(--mono); font-weight: 700; fill: var(--muted); }
      .sec-4-6 .cf-svg .flag.on { fill: var(--ok); }
      .sec-4-6 .cf-svg .val { font-size: 14px; font-weight: 650; }
      .sec-4-6 .cf-svg .sub { font-size: 12.5px; fill: var(--muted); }
      .sec-4-6 .cf-err { border: 2px solid var(--bad); background: var(--bad-bg); border-radius: 12px; padding: 14px 16px; }
      .sec-4-6 .cf-err h3 { color: var(--bad); }
      /* step 6: the five other clone() flags */
      .sec-4-6 .xf-ref { border: 1.5px solid var(--line); border-left: 5px solid var(--thread); border-radius: 10px; padding: 6px 12px 7px; background: var(--panel-2); transition: background .15s, border-color .15s; }
      .sec-4-6 .xf-ref > .row b { font-family: var(--mono); font-size: 14.5px; }
      .sec-4-6 .xf-ref .chip { font-size: 12.5px; padding: 1px 8px; }
      .sec-4-6 .xf-d { font-size: 14px; line-height: 1.38; color: var(--ink-2); margin-top: 2px; }
      .sec-4-6 .xf-ref.ok { background: var(--ok-bg); border-color: var(--ok); }
      .sec-4-6 .xf-ref.bad { background: var(--bad-bg); border-color: var(--bad); }
      .sec-4-6 .xf-scen { flex: none; font-size: 16.5px; line-height: 1.5; padding: 12px 16px; border-radius: 12px; background: var(--panel-2); border: 1px solid var(--line); border-left: 5px solid var(--chc); min-height: 112px; }
      .sec-4-6 .xf-scen .big { text-align: center; }
      .sec-4-6 .xf-picks .cf-x.ok { border-color: var(--ok); background: var(--ok-bg); color: var(--ok); }
      .sec-4-6 .xf-picks .cf-x.bad { border-color: var(--bad); background: var(--bad-bg); color: var(--bad); text-decoration: line-through; }
      /* step 7: namespaces */
      .sec-4-6 .ns-tg { display: grid; grid-template-columns: 30px minmax(0, 1fr); align-items: center; gap: 0 10px; padding: 5px 10px; border: 1.5px solid var(--line); border-radius: 10px; background: var(--panel-2); cursor: pointer; font: inherit; color: var(--ink); text-align: left; width: 100%; }
      .sec-4-6 .ns-tg:hover { border-color: var(--ok); }
      .sec-4-6 .ns-tg .cf-sw { width: 30px; height: 18px; grid-row: span 2; }
      .sec-4-6 .ns-tg .cf-sw::after { width: 12px; height: 12px; }
      .sec-4-6 .ns-tg.on { border-color: var(--ok); background: var(--ok-bg); }
      .sec-4-6 .ns-tg.on .cf-sw { background: var(--ok); }
      .sec-4-6 .ns-tg.on .cf-sw::after { left: 15px; }
      .sec-4-6 .ns-tg b { font-size: 14.5px; line-height: 1.25; }
      .sec-4-6 .ns-tg span { font-size: 12.5px; color: var(--ink-2); line-height: 1.25; }
      .sec-4-6 .ns-tbl { display: grid; grid-template-columns: 112px repeat(3, minmax(0, 1fr)); gap: 6px; }
      .sec-4-6 .ns-th { font-size: 13px; font-weight: 800; padding: 4px 8px; border-radius: 8px; background: var(--panel-3); }
      .sec-4-6 .ns-rl { display: flex; flex-direction: column; justify-content: center; padding: 2px 0; }
      .sec-4-6 .ns-rl b { font-size: 14.5px; }
      .sec-4-6 .ns-rl code { font-size: 11.5px; background: none; padding: 0; color: var(--muted); }
      .sec-4-6 .ns-c { font-size: 13.5px; line-height: 1.32; padding: 6px 9px; border-radius: 9px; border: 1px solid var(--line); border-left-width: 5px; background: var(--panel-2); display: flex; align-items: center; min-height: 48px; transition: background .2s; }
      .sec-4-6 .ns-c.own { background: var(--ok-bg); border-color: color-mix(in srgb, var(--ok) 40%, transparent); border-left-color: var(--ok); }
      .sec-4-6 .ns-c.shr { background: var(--warn-bg); border-color: color-mix(in srgb, var(--warn) 40%, transparent); border-left-color: var(--warn); }
      .sec-4-6 .ns-c.bad { background: var(--bad-bg); border-color: color-mix(in srgb, var(--bad) 40%, transparent); border-left-color: var(--bad); }
      .sec-4-6 .ns-c.host { border-left-color: var(--line-2); }
      .sec-4-6 .ns-c.sel { box-shadow: 0 0 0 2px var(--accent); }
      .sec-4-6 .nrw .ns-tbl { grid-template-columns: 1fr; }
      /* step 8: cgroups and containers */
      .sec-4-6 .cg-eq { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 14px; font-weight: 700; }
      .sec-4-6 .cg-eq .box { font-size: 13.5px; padding: 5px 8px; line-height: 1.25; }
      .sec-4-6 .cg-bar { display: flex; height: 28px; border-radius: 8px; overflow: hidden; background: var(--panel-3); border: 1px solid var(--line); }
      .sec-4-6 .cg-bar > i { display: grid; place-items: center; font-style: normal; font-size: 12.5px; font-weight: 800; color: var(--ink); white-space: nowrap; overflow: hidden; transition: width .25s; }
      .sec-4-6 .cg-bar > i.a { background: var(--proc-bg); box-shadow: inset 0 0 0 2px var(--proc); }
      .sec-4-6 .cg-bar > i.b { background: var(--io-bg); box-shadow: inset 0 0 0 2px var(--io); }
      .sec-4-6 .cg-bar > i.o { background: var(--os-bg); box-shadow: inset 0 0 0 2px var(--os); }
      .sec-4-6 .cg-bar > i.x { background: var(--bad-bg); box-shadow: inset 0 0 0 2px var(--bad); color: var(--bad); }
      .sec-4-6 .cg-st { border-left: 5px solid var(--c); font-size: 14px; line-height: 1.4; }
      .sec-4-6 .cg-st b.hd { display: block; font-size: 15px; color: var(--c); }
      .sec-4-6 .cg-files { font-family: var(--mono); font-size: 13px; color: var(--ink-2); background: var(--panel-3); border-radius: 8px; padding: 4px 10px; white-space: pre-wrap; }
      .sec-4-6 .cg-dim { opacity: .45; }
    `,

    steps: [
      /* ---------------- 1. Big picture: one kind of task, many ways to share ---------------- */
      {
        title: 'One kind of task, many ways to share',
        kind: 'story',
        render(el, ctx) {
          const { h, s } = ctx;
          const RES = [
            { k: 'mem', name: 'memory (address space)' },
            { k: 'io', name: 'open files' },
            { k: 'os', name: 'current + root directory' },
            { k: 'intr', name: 'signal handlers' },
          ];
          const SCENES = {
            proc: '<b>Two processes.</b> When a program calls fork(), the new task gets its <b>own copy</b> of everything. A change on one side never shows up on the other. Both are still described by an ordinary <span class="t">task_struct</span>.',
            thr: '<b>Two threads of one program.</b> The second task was created with <span class="t">clone()</span> flags that <b>share</b> memory, open files, directories and signal handlers. It still has its own task_struct, registers, stack and task ID (TID), yet getpid() reports one shared process ID. There is no separate "thread" record.',
            ctr: '<b>Two containers.</b> Still ordinary tasks, but <span class="t" data-t="namespace">namespaces</span> give each one its own view of the system (its own PID 1, hostname and network), and a <span class="t">cgroup</span> caps how much CPU and memory it may use.',
          };
          const svg = s('svg', { viewBox: '0 0 600 336', width: '100%', role: 'img', 'aria-label': 'Two tasks and the resources they own or share' });
          const cap = h('div', { class: 'player-cap' });
          const box = (x, y, w, hh, cls, txt, fs) => s('g', {},
            s('rect', { x, y, width: w, height: hh, rx: 10, class: cls, 'stroke-width': 2 }),
            s('text', { x: x + w / 2, y: y + hh / 2 + 5, 'text-anchor': 'middle', 'font-size': fs || 14.5, 'font-weight': 650 }, txt));
          function draw(sc) {
            const thr = sc === 'thr', ctr = sc === 'ctr';
            const kids = [];
            const top = ctr ? 32 : 18;
            if (ctr) {
              [14, 314].forEach((x, i) => {
                kids.push(s('rect', { x, y: 4, width: 272, height: 328, rx: 16, class: 's-accent', 'stroke-width': 2, 'stroke-dasharray': '7 5', 'fill-opacity': 0.35 }));
                kids.push(s('text', { x: x + 12, y: 22, 'font-size': 13, 'font-weight': 800, style: 'fill:var(--accent)' }, 'CONTAINER ' + (i ? 'B' : 'A')));
              });
            }
            ['A', 'B'].forEach((n, i) => {
              const x = i ? 330 : 30;
              const id = ctr ? 'PID 1 inside' : (thr ? 'TID ' : 'PID ') + (1201 + i);   // threads: own task IDs, one shared PID (TGID)
              kids.push(s('g', {},
                s('rect', { x, y: top, width: 240, height: 54, rx: 12, class: thr ? 's-thread' : 's-proc', 'stroke-width': 2.5 }),
                s('text', { x: x + 120, y: top + 23, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 15.5 }, `task ${n} (${id})`),
                s('text', { x: x + 120, y: top + 43, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, 'own task_struct, registers, stack')));
            });
            const r0 = top + (ctr ? 70 : 76), dy = ctr ? 44 : 46;
            RES.forEach((r, i) => {
              const y = r0 + i * dy;
              if (thr) kids.push(box(30, y, 540, 36, 's-' + r.k, 'one shared ' + r.name));
              else {
                kids.push(box(30, y, 240, 36, 's-' + r.k, 'A\'s ' + r.name, 14));
                kids.push(box(330, y, 240, 36, 's-' + r.k, 'B\'s ' + r.name, 14));
                if (!ctr) kids.push(s('line', { x1: 274, y1: y + 18, x2: 322, y2: y + 18, class: 's-line', 'stroke-dasharray': '4 4', 'marker-end': 'url(#arr)' }));
              }
            });
            const yb = r0 + 3 * dy + 36 + (ctr ? 22 : 16);
            if (sc === 'proc') kids.push(s('text', { x: 300, y: yb + 10, 'text-anchor': 'middle', 'font-size': 14, class: 's-sub' }, 'B received copies at fork(): after that, each side changes only its own'));
            if (thr) kids.push(s('text', { x: 300, y: yb + 10, 'text-anchor': 'middle', 'font-size': 14, class: 's-sub' }, 'one copy of each, used by both tasks (getpid() → 1201 in both): A\'s writes are seen by B'));
            if (ctr) [14, 314].forEach((x) => {
              kids.push(s('text', { x: x + 136, y: yb - 2, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 700 }, 'sees: own PIDs, hostname, network'));
              kids.push(s('text', { x: x + 136, y: yb + 17, 'text-anchor': 'middle', 'font-size': 13.5, class: 's-sub' }, 'may use: at most 1 CPU, 512 MB'));
            });
            svg.replaceChildren(...kids);
            cap.innerHTML = SCENES[sc];
          }
          const seg = ctx.ui.seg([{ value: 'proc', label: 'Two processes' }, { value: 'thr', label: 'Two threads' }, { value: 'ctr', label: 'Two containers' }], 'proc', draw);
          const left = h('div', { class: 'stack', style: { gap: '10px' } },
            h('p', { class: 'lead m0', html: 'Many operating systems, Windows among them, keep one record per process and a separate, smaller one per thread. <b>Linux keeps just one kind.</b>' }),
            h('p', { class: 'm0', html: 'The thing Linux schedules is the <span class="t" data-t="Linux task">task</span> (not the resource-owning “task” of section 4.1). Every process and every thread is a task, described by the same structure, the <span class="t">task_struct</span>. Two tasks count as two processes or as two threads of one process purely by <b>how much they share</b>.' }),
            h('div', { class: 'callout analogy m0', 'data-label': 'Analogy', html: 'An office building gives everyone the same kind of badge. People from different companies rent separate offices; teammates share one office and one filing cabinet. Same badge, different sharing.' }),
            h('div', { class: 'callout warn m0', 'data-label': 'Common mistake', html: 'Picturing a Linux thread as a smaller, different kind of record. Each thread has a full task_struct of its own; it is cheap because it <b>shares</b>, not because it is small.' }),
            h('div', { class: 'row gap-s', html: '<span class="lbl">Coming up</span><span class="chip proc">task_struct</span><span class="chip">5 states</span><span class="chip thread">clone() flags</span><span class="chip accent">namespaces</span><span class="chip io">cgroups</span>' }));
          const right = h('div', { class: 'card white stack', style: { gap: '8px' } },
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'lbl' }, 'Click a scene'), seg),
            h('div', { class: 'grow', style: ctx.narrow ? { overflowX: 'auto' } : { display: 'grid', placeItems: 'center' } }, svg), cap);
          if (ctx.narrow) svg.style.minWidth = '520px';   // phones: pan sideways rather than shrink the labels
          el.append(h('div', { class: 'split l fill' }, left, right));
          draw('proc');
        },
      },

      /* ---------------- 2. task_struct inspector + sorting game ---------------- */
      {
        title: 'Inside task_struct: the kernel\'s record of a task',
        kind: 'explore',
        render(el, ctx) {
          const { h } = ctx;
          let mode = 'explore', sel = 1;
          const game = { i: 0, tries: 0, res: [] };          // res[i] = 'ok' (first try) or 'late'
          let fb = null, nextBtn = null, dots = null, locked = false;
          const rows = TS_CATS.map((c, i) => h('button', { class: 'ts-row', type: 'button', style: { '--c': COLS[c.col] }, onclick: () => pick(i) },
            h('b', {}, c.name), h('span', { class: 'ts-fields' }, ...c.fields.map((f) => h('code', {}, f)))));
          const left = h('div', { class: 'stack', style: { gap: '6px' } },
            h('div', { class: 'ts-brace' }, 'struct task_struct {   // one for every task'),
            h('div', { class: 'ts-list' }, ...rows),
            h('div', { class: 'ts-brace' }, '};'));
          const panel = h('div', { class: 'grow', style: { minHeight: 0 } });
          const seg = ctx.ui.seg([{ value: 'explore', label: 'Explore the nine groups' }, { value: 'sort', label: 'Sort 12 real fields' }], mode, (v) => { mode = v; paint(); });
          const right = h('div', { class: 'card white stack', style: { gap: '12px' } }, h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'lbl' }, 'Mode'), seg), panel);
          el.append(h('div', { class: 'split l fill' }, left, right));

          function pick(i) {
            if (mode === 'explore') { sel = i; paint(); } else answer(i);
          }
          function paint() {
            rows.forEach((r, i) => { r.classList.remove('ok', 'bad'); r.classList.toggle('on', mode === 'explore' && i === sel); });
            panel.replaceChildren(mode === 'explore' ? exploreView() : sortView());
          }
          function exploreView() {
            const c = TS_CATS[sel];
            return h('div', { class: 'stack fade-in', style: { gap: '12px' } },
              h('div', { class: 'row', style: { justifyContent: 'space-between' } },
                h('h3', { class: 'm0', style: { color: COLS[c.col] } }, c.name), h('span', { class: 'chip' }, `group ${sel + 1} of 9`)),
              h('div', {}, h('div', { class: 'lbl' }, 'What it holds'), h('p', { class: 'p15 m0', html: c.what })),
              h('div', {}, h('div', { class: 'lbl' }, 'Why the kernel needs it'), h('p', { class: 'p15 m0', html: c.why })),
              h('div', {}, h('div', { class: 'lbl', style: { marginBottom: '4px' } }, 'Example: a text editor, PID 4213'), h('div', { class: 'ts-eg', html: c.eg })),
              h('div', { class: 'callout tip m0', 'data-label': 'Where you have seen this before', html: 'The <span class="t">task_struct</span> is Linux\'s version of the <span class="t">process control block (PCB)</span>, and of the TCB too, since each thread is a task. The real one has well over a hundred fields; these nine groups are the map. Click any group on the left.' }));
          }
          function sortView() {
            if (game.i >= TS_SORT.length) {
              const ok = game.res.filter((r) => r === 'ok').length;
              return h('div', { class: 'stack fade-in', style: { alignItems: 'center', justifyContent: 'center', textAlign: 'center', height: '100%' } },
                h('div', { class: 'lbl' }, 'Sorted right on the first try'),
                h('div', { class: 'big' }, `${ok} / ${TS_SORT.length}`),
                dotsEl(),
                h('p', { class: 'p15 m0', style: { maxWidth: '520px' } }, ok === TS_SORT.length ? 'Perfect. You know your way around a task_struct.' : 'Orange dots needed a second try. Switch to "Explore the nine groups" to review those categories, then sort again.'),
                h('button', { class: 'btn primary', type: 'button', onclick: restart }, 'Sort them again'));
            }
            const [f, , hint] = TS_SORT[game.i];
            fb = h('div', { class: 'ts-fb', html: 'Click the group on the left where the kernel keeps this field.' });
            nextBtn = h('button', { class: 'btn primary', type: 'button', disabled: true, onclick: next }, game.i === TS_SORT.length - 1 ? 'See my score' : 'Next field →');
            locked = false;
            if (game.res[game.i]) {   // came back to a field that was already answered (e.g. after switching modes)
              const want = TS_SORT[game.i][1];
              locked = true; nextBtn.disabled = false; rows[want].classList.add('ok');
              fb.className = 'ts-fb ok';
              fb.innerHTML = `<b>Already sorted.</b> <code>${ctx.util.esc(f)}</code> belongs to <b>${TS_CATS[want].name}</b>. Press the button to continue.`;
            }
            return h('div', { class: 'stack fade-in', style: { gap: '12px' } },
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'lbl' }, `Field ${game.i + 1} of ${TS_SORT.length}`), dots = dotsEl()),
              h('div', { class: 'card', style: { textAlign: 'center' } }, h('div', { class: 'ts-q' }, f), h('div', { class: 'small muted' }, hint)),
              fb,
              h('div', { class: 'row' }, nextBtn, h('button', { class: 'btn ghost sm', type: 'button', onclick: restart }, 'Start over')),
              h('div', { class: 'callout why m0', 'data-label': 'Notice the arrows', html: 'An arrow (→) marks a <b>pointer</b>. The task_struct does not contain the open-file table or the memory map itself, only the address of one. That is what later lets two tasks point at the <b>same</b> table and share it.' }));
          }
          function dotsEl() {
            return h('div', { class: 'ts-dots' }, ...TS_SORT.map((_, i) => h('i', { class: game.res[i] || (i === game.i ? 'cur' : '') })));
          }
          function answer(i) {
            if (locked || game.i >= TS_SORT.length) return;
            const [f, want] = TS_SORT[game.i];
            const c = TS_CATS[want];
            rows.forEach((r) => r.classList.remove('ok', 'bad'));
            game.tries++;
            if (i === want) {
              locked = true;
              game.res[game.i] = game.tries === 1 ? 'ok' : 'late';
              rows[i].classList.add('ok');
              fb.className = 'ts-fb ok';
              fb.innerHTML = `<b>${game.tries === 1 ? 'Right.' : 'Right, on a later try.'}</b> <code>${ctx.util.esc(f)}</code> belongs to <b>${c.name}</b>: ${c.what}`;
              nextBtn.disabled = false;
              dots.replaceWith(dots = dotsEl());
            } else {
              rows[i].classList.add('bad');
              fb.className = 'ts-fb bad';
              fb.innerHTML = `<b>Not ${TS_CATS[i].name}.</b> That group holds: ${TS_CATS[i].what} Try another group.`;
            }
          }
          function next() { game.i++; game.tries = 0; paint(); }
          function restart() { game.i = 0; game.tries = 0; game.res = []; paint(); }
          paint();
        },
      },

      /* ---------------- 3. Linux state machine lab ---------------- */
      {
        title: 'Five Linux states: drive a task through its life',
        kind: 'lab',
        core: true,
        render(el, ctx) {
          const { h, s } = ctx;
          const svg = s('svg', { viewBox: '0 0 720 312', width: '100%', role: 'img', 'aria-label': 'Linux task state diagram', style: 'flex: none' });
          const boxes = {}, arrows = {};
          const B = (id, x, y, w, hh, cls, t1, t2) => {
            const g = s('g', { class: 'ls-box' },
              s('rect', { x, y, width: w, height: hh, rx: 11, class: cls }),
              s('text', { x: x + w / 2, y: y + hh / 2 - 2, 'text-anchor': 'middle', class: 't1' }, t1),
              s('text', { x: x + w / 2, y: y + hh / 2 + 16, 'text-anchor': 'middle', class: 't2' }, t2));
            g.at = [x + w - 3, y + 3];
            boxes[id] = g; return g;
          };
          const A = (id, d, label, lx, ly, anchor) => {
            const g = s('g', { class: 'ls-arr' }, s('path', { d, 'marker-end': 'url(#arr-muted)' }), s('text', { x: lx, y: ly, 'text-anchor': anchor || 'middle' }, label));
            arrows[id] = g; return g;
          };
          const start = s('g', { class: 'ls-box' }, s('circle', { cx: 28, cy: 143, r: 9, class: 's-panel', 'stroke-width': 2 }), s('text', { x: 28, y: 172, 'text-anchor': 'middle', class: 't2' }, 'start'));
          start.at = [34, 136]; boxes.none = start;
          const gone = s('g', { class: 'ls-box' }, s('circle', { cx: 660, cy: 246, r: 16, class: 's-panel', 'stroke-width': 2, 'stroke-dasharray': '4 3' }), s('text', { x: 660, y: 251, 'text-anchor': 'middle', class: 't1' }, '✗'), s('text', { x: 660, y: 284, 'text-anchor': 'middle', class: 't2' }, 'freed'));
          gone.at = [671, 233]; boxes.gone = gone;
          svg.append(
            s('rect', { x: 100, y: 82, width: 460, height: 112, rx: 16, class: 's-proc', 'stroke-width': 1.5, 'fill-opacity': 0.3, 'stroke-dasharray': '6 4' }),
            s('text', { x: 340, y: 101, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800, style: 'fill:var(--proc)' }, 'RUNNING (R)'),
            A('create', 'M38 143 H147', 'fork()', 68, 135),
            A('sched', 'M300 128 H377', 'scheduled', 339, 121),
            A('preempt', 'M380 158 H303', 'preempted', 341, 175),
            A('stop', 'M475 112 V31 H418', 'SIGSTOP', 482, 76, 'start'),
            A('cont', 'M265 31 H205 V109', 'SIGCONT', 198, 76, 'end'),
            A('exit', 'M530 143 H607', 'exit', 568, 136),
            A('reap', 'M660 174 V227', 'wait()', 668, 206, 'start'),
            A('toIntr', 'M485 174 V232 H439', 'wait', 479, 216, 'end'),
            A('toUnintr', 'M520 174 V284 H439', 'wait', 526, 264, 'start'),
            A('fromIntr', 'M236 232 H200 V177', 'wake', 207, 205, 'start'),
            A('fromUnintr', 'M236 284 H165 V177', 'wake', 158, 252, 'end'),
            start, gone,
            B('ready', 150, 112, 150, 62, 's-proc', 'Ready', 'waiting for a CPU'),
            B('exec', 380, 112, 150, 62, 's-proc', 'Executing', 'on a CPU now'),
            B('stopped', 265, 8, 150, 48, 's-os', 'Stopped', 'T · until SIGCONT'),
            B('zombie', 610, 112, 100, 62, 's-panel', 'Zombie', 'Z · exited'),
            B('intr', 236, 208, 200, 48, 's-warn', 'Interruptible', 'S · signals wake it'),
            B('unintr', 236, 260, 200, 48, 's-intr', 'Uninterruptible', 'D · signals must wait'));
          const dot = s('circle', { r: 8, class: 'ls-dot', cx: 0, cy: 0 });
          svg.append(dot);

          const EV = [
            ['Kernel', 'os', [['create', 'fork(): create'], ['sched', 'Schedule it'], ['slice', 'Time slice ends'], ['io', 'I/O completes']]],
            ['The task', 'proc', [['key', 'read() keyboard'], ['disk', 'read() disk'], ['exit', 'exit()']]],
            ['Others', 'intr', [['usr1', 'SIGUSR1'], ['stop', 'SIGSTOP'], ['cont', 'SIGCONT'], ['kill', 'SIGKILL'], ['wait', 'Parent: wait()']]],
          ];
          const evGrid = h('div', { class: 'ls-ev' });
          EV.forEach(([lab, col, list]) => evGrid.append(h('span', { class: 'lbl' }, lab),
            h('div', { class: 'row' }, ...list.map(([id, t]) => h('button', { class: 'btn sm ' + col, type: 'button', onclick: () => run(id) }, t)))));
          const mis = h('div', { class: 'ls-mis' });

          const stCard = h('div', { class: 'card ls-card stack', style: { gap: '6px' } });
          const narr = h('div', { class: 'player-cap ls-narr', 'aria-live': 'polite' });
          const pendEl = h('div', { class: 'row gap-s small' });
          const hist = h('div', { class: 'ls-hist' });
          if (ctx.narrow) svg.style.minWidth = '620px';   // phones: keep labels readable and let the diagram pan sideways
          const svgBox = ctx.narrow ? h('div', { style: { overflowX: 'auto' } }, svg) : svg;
          const left = h('div', { class: 'stack', style: { gap: '10px' } }, svgBox, evGrid, h('div', { class: 'card tight' }, h('div', { class: 'lbl', style: { marginBottom: '3px' } }, 'Missions'), mis));
          const right = h('div', { class: 'stack', style: { gap: '10px' } }, stCard, narr, pendEl, h('div', {}, h('div', { class: 'lbl', style: { marginBottom: '4px' } }, 'What ps would show, event by event'), hist),
            h('div', { class: 'callout tip m0', 'data-label': 'The four signals, and one rule', html: '<div class="ls-sig"><b>SIGUSR1</b><span>an ordinary signal; this program has a <span class="t" data-t="Signal handler">handler</span> for it</span><b>SIGSTOP</b><span>pause the task; it cannot be caught or ignored</span><b>SIGCONT</b><span>let a Stopped task carry on</span><b>SIGKILL</b><span>end the task; it cannot be caught or ignored</span></div>A task acts on its signals only when it runs: a signal can wake an <b>S</b> task so that it gets to run, but a <b>D</b> task must finish its hardware wait first.' }));
          el.append(h('div', { class: 'split fill' + (ctx.narrow ? ' nrw' : ''), style: { gridTemplateColumns: ctx.narrow ? '' : 'minmax(0, 1.55fr) minmax(0, 1fr)' } }, left, right));

          let st = 'none', pend = [], lit = [];
          const trail = [];
          const done = [false, false, false, false];
          function run(ev) {
            const r = lsEvent(st, pend, ev);
            if (!r.warn) {
              lit = r.arrs;
              if (r.st !== st || r.arrs.length) trail.push(LS[r.st].ps);
              if (trail.length > 16) trail.shift();
            }
            st = r.st; pend = r.pend;
            if (r.mission >= 0) done[r.mission] = true;
            paint(r.msg, r.warn);
          }
          function paint(msg, warn) {
            Object.entries(boxes).forEach(([id, g]) => g.classList.toggle('cur', id === st));
            Object.entries(arrows).forEach(([id, g]) => { const on = lit.includes(id); g.classList.toggle('hi', on); g.firstChild.setAttribute('marker-end', on ? 'url(#arr-accent)' : 'url(#arr-muted)'); });
            const [dx, dy] = boxes[st].at;
            dot.style.transform = `translate(${dx}px, ${dy}px)`;
            const L = LS[st];
            stCard.style.setProperty('--c', COLS[L.col] || 'var(--line-2)');
            stCard.replaceChildren(
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { class: 'm0', style: { color: COLS[L.col] || 'var(--ink)' }, html: L.term ? `<span class="t" data-t="${L.term}">${L.name}</span>` : L.name }), h('span', { class: 'chip ' + (L.col === 'muted' ? '' : L.col) }, 'ps shows ' + L.ps)),
              h('code', { style: { alignSelf: 'flex-start' } }, L.ps === '–' ? L.val : 'state = ' + L.val),
              h('p', { class: 'p15 m0', html: L.desc }));
            narr.classList.toggle('warn', !!warn);
            narr.innerHTML = msg;
            pendEl.replaceChildren(h('span', { class: 'lbl' }, 'Pending signals'), ...(pend.length ? pend.map((p) => h('span', { class: 'chip intr' }, p)) : [h('span', { class: 'muted' }, 'none')]));
            hist.replaceChildren(...(trail.length ? trail.map((c, i) => h('span', { class: i === trail.length - 1 ? 'last' : '' }, c)) : [h('span', { class: 'muted small', style: { width: 'auto', background: 'none' } }, 'nothing yet')]));
            mis.replaceChildren(...LS_MISSIONS.map((m, i) => h('div', { class: done[i] ? 'ok' : '' }, h('b', {}, done[i] ? '✓' : '○'), h('span', {}, m))));
          }
          paint('Press <b>fork(): create</b> to make a task, then move it with the buttons. The diagram lights up the path each event takes, and the card explains the state it lands in.');
        },
      },

      /* ---------------- 4. Threads are tasks in one thread group ---------------- */
      {
        title: 'Linux threads: tasks that share one thread group',
        kind: 'explore',
        render(el, ctx) {
          const { h } = ctx;
          const GR = {
            web: { name: 'webserver', tgid: 800, mm: 'A', c: 'var(--thread)' },
            ed: { name: 'editor', tgid: 950, mm: 'B', c: 'var(--proc)' },
          };
          const TASKS = [
            { id: 800, g: 'web', role: 'main thread' }, { id: 801, g: 'web', role: 'worker' }, { id: 802, g: 'web', role: 'worker' },
            { id: 950, g: 'ed', role: 'main thread' },
          ];
          const T = (id) => TASKS.find((t) => t.id === id);
          let cur = 800, light = 0, heavy = 0, last = null;
          const hist = [800];

          /* ---- left: explanation + the two ps views ---- */
          const PS = {
            ps: { out: '<b>  PID CMD</b>\n  800 webserver\n  950 editor', why: 'One line per <b>process</b>. The PID column is really the thread group ID (TGID): getpid() returns 800 in all three webserver threads.' },
            psl: { out: '<b>  PID   LWP CMD</b>\n  800   800 webserver\n  800   801 webserver\n  800   802 webserver\n  950   950 editor', why: 'One line per <b>task</b>. LWP ("lightweight process") is each task\'s own ID, the value gettid() returns. These four are what the scheduler really juggles.' },
          };
          const psOut = h('pre', { class: 'th-ps' });
          const psWhy = h('p', { class: 'small m0' });
          const showPs = (k) => { psOut.innerHTML = PS[k].out; psWhy.innerHTML = PS[k].why; };
          const psSeg = ctx.ui.seg([{ value: 'ps', label: 'ps' }, { value: 'psl', label: 'ps -L' }], 'ps', showPs);
          const left = h('div', { class: 'stack', style: { gap: '10px' } },
            h('p', { class: 'lead m0', html: 'Classic UNIX gave each process exactly one thread. Linux has <b>no separate thread structure</b> at all.' }),
            h('p', { class: 'm0 p15', html: 'A new thread is simply a new <span class="t" data-t="Linux task">task</span>, with its own task_struct, registers and stack, created so that it <b>shares</b> its creator\'s memory, open files, directories and signal handlers. All the tasks of one program form a <span class="t">thread group</span> and carry the same thread group ID (TGID).' }),
            h('div', { class: 'card tight stack', style: { gap: '6px' } },
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'lbl' }, 'Same tasks, two views'), psSeg), psOut, psWhy),
            h('p', { class: 'small muted m0', html: 'In the terms of section 4.2, this is pure <b>kernel-level threading</b>, ULTs mapped one-to-one onto KLTs, so the threads of one program can run on different cores at once.' }));
          showPs('ps');

          /* ---- right: you are the scheduler ---- */
          const chipL = h('span', { class: 'chip ok' }), chipH = h('span', { class: 'chip bad' });
          const btns = {};
          const grpBox = (k) => h('div', { class: 'th-grp', style: { '--c': GR[k].c } },
            h('div', { class: 'hd' }, `${GR[k].name} · TGID ${GR[k].tgid} · memory map ${GR[k].mm}`),
            h('div', { class: 'th-tasks' }, ...TASKS.filter((t) => t.g === k).map((t) => (btns[t.id] = h('button', { class: 'th-task', type: 'button', onclick: () => pick(t.id) }, h('b', {}, String(t.id)), h('span', {}, t.role))))));
          const cpu = h('div', { class: 'row gap-s small' });
          const swTitle = h('div', { class: 'b', style: { fontSize: '15.5px' } });
          const steps = h('div', { class: 'th-steps' });
          const meter = h('div', { class: 'meter', style: { flex: 1, height: '12px' } }, h('i'));
          const histEl = h('div', { class: 'th-hist' });
          const right = h('div', { class: 'card white stack', style: { gap: '9px' } },
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'lbl' }, 'You are the scheduler'), h('div', { class: 'row gap-s' }, chipL, chipH)),
            h('div', { class: 'th-grps' }, grpBox('web'), grpBox('ed')),
            cpu,
            h('div', { class: 'card tight stack', style: { gap: '6px', flex: 'none' } }, swTitle, steps, h('div', { class: 'row', style: { gap: '10px' } }, h('span', { class: 'xs muted b' }, 'switch cost'), meter)),
            h('div', {}, h('div', { class: 'lbl', style: { marginBottom: '4px' } }, 'Run history (⇒ = memory map changed)'), histEl),
            h('div', { class: 'callout why m0', 'data-label': 'Why Linux groups them', html: 'The tasks of a group share one memory map, so switching among them skips the costliest part of a context switch.' }));
          el.append(h('div', { class: 'split l fill' }, left, right));

          function pick(id) {
            if (id === cur) { ctx.toast(`Task ${id} is already running.`); return; }
            const same = T(id).g === T(cur).g;
            last = { from: cur, to: id, same };
            same ? light++ : heavy++;
            cur = id; hist.push(id); if (hist.length > 11) hist.shift();
            paint();
          }
          function paint() {
            const t = T(cur), g = GR[t.g];
            Object.entries(btns).forEach(([id, b]) => { b.classList.toggle('run', +id === cur); b.lastChild.textContent = +id === cur ? 'running' : T(+id).role; });
            chipL.textContent = `light switches: ${light}`; chipH.textContent = `heavy switches: ${heavy}`;
            cpu.replaceChildren(h('span', { class: 'chip cpu' }, 'CPU'), h('span', { html: `running task <b>${cur}</b> (${g.name})` }), h('span', { class: 'muted' }, '·'), h('span', { class: 'chip mem' }, `memory map ${g.mm} loaded`));
            const S = (icon, cls, txt) => h('div', { class: cls }, h('b', {}, icon), h('span', { html: txt }));
            if (!last) {
              swTitle.textContent = 'Click the task that should run next.';
              steps.replaceChildren(S('1', '', 'Save the running task\'s registers and stack pointer into its task_struct.'), S('2', '', 'Load the next task\'s saved registers.'), S('?', '', 'Change the memory map, but only if the next task uses a different one.'));
              meter.firstChild.style.width = '0%';
            } else if (last.same) {
              swTitle.innerHTML = `Last switch: ${last.from} → ${last.to} <span class="chip ok">same thread group</span>`;
              steps.replaceChildren(S('1', '', `Save ${last.from}'s registers and stack pointer into its task_struct.`), S('2', '', `Load ${last.to}'s saved registers.`), S('✓', 'skip', `Memory map ${g.mm} <b>stays loaded</b>: both tasks share it, so cached address translations stay useful.`));
              meter.firstChild.style.width = '28%'; meter.firstChild.style.background = 'var(--ok)';
            } else {
              swTitle.innerHTML = `Last switch: ${last.from} → ${last.to} <span class="chip bad">different thread group</span>`;
              steps.replaceChildren(S('1', '', `Save ${last.from}'s registers and stack pointer into its task_struct.`), S('2', '', `Load ${last.to}'s saved registers.`), S('✗', 'cost', `<b>Switch the memory map</b> to ${g.mm}: load new page tables. Cached address translations for the old map become useless.`));
              meter.firstChild.style.width = '100%'; meter.firstChild.style.background = 'var(--bad)';
            }
            histEl.replaceChildren(...hist.flatMap((id, i) => {
              const tk = h('span', { class: 'tk', style: { '--c': GR[T(id).g].c } }, String(id));
              if (!i) return [tk];
              const hv = T(id).g !== T(hist[i - 1]).g;
              return [h('span', { class: hv ? 'hv' : 'lt' }, hv ? '⇒' : '→'), tk];
            }));
          }
          paint();
        },
      },

      /* ---------------- 5. clone() flag builder ---------------- */
      {
        title: 'Build a thread out of clone() flags',
        kind: 'lab',
        core: true,
        render(el, ctx) {
          const { h, s } = ctx;
          const F = new Set();
          let exp = {}, lastExp = null, extraInfo = null, codeHost = null;
          const setFlags = (list) => { F.clear(); list.forEach((f) => F.add(f)); exp = {}; lastExp = null; paint(); };
          const toggle = (f) => { if (F.has(f)) F.delete(f); else F.add(f); exp = {}; lastExp = null; paint(); };

          /* ---- left: controls ---- */
          const mainBtns = CF_MAIN.map((m) => h('button', { class: 'cf-flag', type: 'button', onclick: () => toggle(m.f) }, h('i', { class: 'cf-sw' }), h('b', {}, m.f), h('span', {}, m.d)));
          const extraBtns = CF_EXTRA.map((m) => h('button', { class: 'btn sm cf-x', type: 'button', onclick: () => { extraInfo = m; toggle(m.f); } }, m.f));
          const extraMsg = h('p', { class: 'small muted m0', style: { minHeight: '2.9em', flex: 'none' } });
          const verdict = h('div', { class: 'card tight cf-verdict', style: { flex: 'none' } });
          const left = h('div', { class: 'stack' + (ctx.narrow ? ' nrw' : ''), style: { gap: '8px' } },
            h('p', { class: 'p15 m0', html: 'Every new Linux task is made by <span class="t">clone()</span>. Each <span class="t" data-t="Clone flags">flag</span> you switch on means one more thing <b>shared</b> with the creator instead of copied.' }),
            h('div', { class: 'row gap-s' }, h('span', { class: 'lbl' }, 'Presets'), ...Object.keys(CF_PRESETS).map((k) => h('button', { class: 'btn sm', type: 'button', onclick: () => { extraInfo = null; setFlags(CF_PRESETS[k]); } }, k))),
            h('div', { class: 'stack', style: { gap: '5px', flex: 'none' } }, ...mainBtns),
            h('div', { class: 'row gap-s' }, h('span', { class: 'lbl' }, 'More flags'), ...extraBtns),
            extraMsg, verdict);

          /* ---- right: diagram + experiments, and the generated call ---- */
          const svg = s('svg', { viewBox: '0 0 660 322', width: '100%', class: 'cf-svg', role: 'img', 'aria-label': 'What the caller and the new task share' });
          const holder = h('div', { style: { minHeight: '0' } });
          const EXPS = [['x', 'Child sets x = 99'], ['open', 'Child opens log.txt'], ['cd', 'Child runs cd /tmp'], ['sig', 'Child sets a Ctrl+C handler']];
          const expBtns = EXPS.map(([k, t]) => h('button', { class: 'btn sm', type: 'button', onclick: () => { exp[k] = true; lastExp = k; paint(); } }, t));
          const expMsg = h('div', { class: 'player-cap', style: { minHeight: '3.1em', fontSize: '14.5px' } });
          const alsoEl = h('div', { class: 'row gap-s small' });
          const diag = h('div', { class: 'stack', style: { gap: '8px' } }, holder, h('div', { class: 'row gap-s' }, ...expBtns), expMsg, alsoEl);
          const tabs = ctx.ui.tabs([
            { label: 'What gets shared', render: (p) => { p.append(diag); } },
            { label: 'The clone() call', render: (p) => { codeHost = p; drawCode(); return () => { codeHost = null; }; } },
          ]);
          el.append(h('div', { class: 'split l fill' }, left, h('div', { class: 'fill' }, tabs)));

          const RES = [
            { name: 'memory', flag: 'CLONE_VM', cls: 's-mem', base: 'x = 5', chg: 'x = 99', k: 'x' },
            { name: 'open files', flag: 'CLONE_FILES', cls: 's-io', base: 'fds 0 1 2', chg: 'fds 0 1 2 3=log.txt', k: 'open' },
            { name: 'directories', flag: 'CLONE_FS', cls: 's-os', base: 'cwd /home/alice', chg: 'cwd /tmp', k: 'cd' },
            { name: 'signal handlers', flag: 'CLONE_SIGHAND', cls: 's-intr', base: 'Ctrl+C → default', chg: 'Ctrl+C → on_int()', k: 'sig' },
            { name: 'thread group', flag: 'CLONE_THREAD', cls: 's-thread' },
            { name: 'parent', flag: 'CLONE_PARENT', cls: 's-proc' },
          ];
          function drawSvg() {
            const K = [], NR = [];
            const hdr = (x, t1, t2, cls) => s('g', {}, s('rect', { x, y: 6, width: 250, height: 52, rx: 12, class: cls, 'stroke-width': 2.5 }),
              s('text', { x: x + 125, y: 28, 'text-anchor': 'middle', class: 'lab' }, t1), s('text', { x: x + 125, y: 47, 'text-anchor': 'middle', class: 'sub' }, t2));
            K.push(s('text', { x: 6, y: 28, class: 'lab' }, 'resource'), s('text', { x: 6, y: 47, class: 'sub' }, 'flag that shares it'));
            K.push(hdr(144, 'caller · PID 700', F.has('CLONE_VFORK') ? 'paused until child exec()s or exits' : 'getpid() → 700', 's-proc'));
            K.push(hdr(404, 'new task · ' + (F.has('CLONE_THREAD') ? 'TID' : 'PID') + ' 701', F.has('CLONE_THREAD') ? 'getpid() → 700 (same group)' : F.has('CLONE_NEWPID') ? 'PID 1 inside its new namespace' : 'getpid() → 701', F.has('CLONE_THREAD') ? 's-thread' : 's-proc'));
            RES.forEach((r, i) => {
              const y = 70 + i * 42;
              const viaThread = r.flag === 'CLONE_PARENT' && !F.has('CLONE_PARENT') && F.has('CLONE_THREAD');
              const on = F.has(r.flag) || viaThread;
              K.push(s('text', { x: 6, y: y + 15, class: 'lab' }, r.name), s('text', { x: 6, y: y + 31, class: 'flag' + (on ? ' on' : '') }, viaThread ? 'via CLONE_THREAD' : r.flag));
              let vs, vp, vc;
              if (r.k) { const v = exp[r.k] ? r.chg : r.base; vs = 'one shared table: ' + v; vp = r.base; vc = 'copy: ' + v; if (i === 0) vs = 'one shared memory: ' + v; }
              else if (i === 4) { vs = 'one thread group: TGID 700 for both'; vp = 'TGID 700'; vc = 'TGID 701: a new process'; }
              else { vs = 'siblings: both children of bash (650)'; vp = 'parent: bash (650)'; vc = 'parent: 700 (the caller)'; }
              if (i === 2) vs = 'one shared set: ' + (exp.cd ? r.chg : r.base);
              NR.push({ name: r.name, flag: viaThread ? 'via CLONE_THREAD' : r.flag, on, vs, vp, vc, col: r.cls.slice(2) });
              if (on) K.push(s('rect', { x: 144, y, width: 510, height: 36, rx: 10, class: r.cls, 'stroke-width': 2.5 }), s('text', { x: 399, y: y + 23, 'text-anchor': 'middle', class: 'val' }, vs));
              else K.push(s('rect', { x: 144, y, width: 250, height: 36, rx: 10, class: r.cls, 'stroke-width': 1.5 }), s('text', { x: 269, y: y + 23, 'text-anchor': 'middle', class: 'val' }, vp),
                s('rect', { x: 404, y, width: 250, height: 36, rx: 10, class: r.cls, 'stroke-width': 1.5, 'stroke-dasharray': '5 4' }), s('text', { x: 529, y: y + 23, 'text-anchor': 'middle', class: 'val' }, vc));
            });
            svg.replaceChildren(...K);
            return NR;
          }
          /* phones: the same information as a readable list instead of a scaled-down diagram */
          function narrowView(NR) {
            return h('div', { class: 'stack', style: { gap: '6px' } },
              h('p', { class: 'small m0 muted' }, `Caller = PID 700 · new task = ${F.has('CLONE_THREAD') ? 'TID' : 'PID'} 701${F.has('CLONE_THREAD') ? ' (getpid() → 700)' : ''}${F.has('CLONE_VFORK') ? ' · caller paused' : ''}${F.has('CLONE_NEWPID') && !F.has('CLONE_THREAD') ? ' · new task is PID 1 in a new PID namespace' : ''}`),
              ...NR.map((r) => h('div', { class: 'card tight', style: { borderLeft: `5px solid var(--${r.col})`, padding: '6px 10px' } },
                h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', {}, r.name), h('code', { style: { color: r.on ? 'var(--ok)' : 'var(--muted)' } }, r.flag)),
                h('div', { class: 'small' }, r.on ? 'shared · ' + r.vs : `caller: ${r.vp}  ·  new task: ${r.vc}`))));
          }
          const EXP_MSG = {
            x: (on) => on ? 'The parent reads <b>99</b>: with one shared memory, both use the same x, not copies. To see each other\'s writes reliably and in order, tasks still need a lock or an atomic operation (section 5.1).' : 'The parent still reads <b>x = 5</b>: the child got its own copy of memory (made lazily, with copy-on-write), so the write changed only that copy.',
            open: (on) => on ? 'The parent can use <b>fd 3</b> as well: both tasks look at one open-file table.' : 'The parent\'s table still ends at fd 2. The child opened log.txt in its <b>own copy</b> of the table.',
            cd: (on) => on ? 'The parent\'s directory becomes <b>/tmp</b> too: CLONE_FS shares one record of current directory, root directory and <b>umask</b> (default permissions for new files).' : 'The parent stays in <b>/home/alice</b>. The child changed only its own current directory.',
            sig: (on) => on ? 'Ctrl+C now runs <b>on_int()</b> in the parent too: one shared handler table.' : 'The parent keeps its <b>default</b> Ctrl+C behaviour. The child changed its own copy of the table.',
          };
          const EXP_FLAG = { x: 'CLONE_VM', open: 'CLONE_FILES', cd: 'CLONE_FS', sig: 'CLONE_SIGHAND' };
          function drawCode() {
            if (!codeHost) return;
            const DESC = {}; CF_MAIN.forEach((m) => { DESC[m.f] = m.d; });
            Object.assign(DESC, { CLONE_PARENT: 'new task is the caller\'s sibling', CLONE_SYSVSEM: 'share semaphore undo records', CLONE_SETTLS: 'give it its own thread-local storage', CLONE_VFORK: 'pause the caller until exec() or exit', CLONE_NEWPID: 'put it in a new PID namespace' });
            const set = [...CF_MAIN, ...CF_EXTRA].map((m) => m.f).filter((f) => F.has(f));
            const pad = (c, cm) => c.padEnd(24) + '// ' + cm;
            const L = [pad('flags = 0' + (set.length ? '' : ';'), set.length ? 'start from "share nothing"' : 'share nothing: exactly what fork() does')];
            set.forEach((f, i) => L.push(pad('      | ' + f + (i === set.length - 1 ? ';' : ''), DESC[f])));
            L.push(pad('id = clone(fn, stack,', 'new task will run fn(arg)...'));
            L.push(pad('           flags, arg);', '...on its own new stack'));
            const err = cfError(F);
            if (err) L.push('// result: -1, errno = EINVAL, because', '// ' + err[0]);
            else L.push('// result: the new task\'s ID (701) in the caller');
            codeHost.replaceChildren(h('div', { class: 'stack', style: { gap: '10px' } }, ctx.ui.code(L.join('\n'), { lang: 'c' }),
              h('p', { class: 'small muted m0', html: 'The C library\'s fork() and pthread_create() boil down to calls like this one. Real calls also pass pointers for the new thread\'s ID and its storage area, and fork() adds SIGCHLD to the flags: the signal the parent receives when the child ends. Those are left out here. Try the presets and watch the flag list change.' })));
          }
          function paint() {
            mainBtns.forEach((b, i) => b.classList.toggle('on', F.has(CF_MAIN[i].f)));
            extraBtns.forEach((b, i) => b.classList.toggle('on', F.has(CF_EXTRA[i].f)));
            extraMsg.innerHTML = extraInfo ? `<b class="mono">${extraInfo.f}</b>: ${extraInfo.d}` : 'Reminder: a <span class="t" data-t="Thread group">thread group</span> is the set of tasks that share one PID, the TGID. Click an extra flag to see what it does.';
            const err = cfError(F);
            const [c, title, txt] = err ? ['bad', 'No task is created', (err[2] ? 'The clone() manual forbids this mix of flags (EINVAL).' : 'The kernel rejects this mix of flags (EINVAL).') + ` The panel ${ctx.narrow ? 'below' : 'on the right'} says why.`] : cfVerdict(F);
            verdict.style.setProperty('--c', COLS[c] || 'var(--bad)');
            verdict.replaceChildren(h('div', { class: 'lbl' }, 'The result behaves like'), h('h3', {}, title), h('p', { class: 'small m0', html: txt }));
            if (err) {
              holder.replaceChildren(h('div', { class: 'cf-err stack', style: { gap: '8px' } }, h('h3', { class: 'm0' }, 'clone() fails: errno = EINVAL'),
                h('p', { class: 'p15 m0', html: `<b>${err[0]}</b> ${err[1]}` }),
                h('p', { class: 'small m0' }, (err[2] ? 'Treat it as a failed call: no task is made. ' : 'The kernel checks the flags before it builds anything, so no task is made. ') + 'Switch the clashing flag off (or the missing one on), or pick a preset.')));
            } else { const NR = drawSvg(); holder.replaceChildren(ctx.narrow ? narrowView(NR) : svg); }
            expBtns.forEach((b) => { b.disabled = !!err; });
            expMsg.innerHTML = err ? 'No task exists, so there is nothing to experiment with.' : lastExp ? '<b>' + EXPS.find((e) => e[0] === lastExp)[1] + '.</b> ' + EXP_MSG[lastExp](F.has(EXP_FLAG[lastExp])) : 'Now let the child change something and see whether the parent notices.';
            const also = CF_EXTRA.filter((m) => F.has(m.f) && (m.f === 'CLONE_SYSVSEM' || m.f === 'CLONE_SETTLS'));   // the other three already show in the diagram
            alsoEl.replaceChildren(...(also.length ? [h('span', { class: 'lbl' }, 'Also'), ...also.map((m) => h('span', { class: 'chip accent' }, { CLONE_SYSVSEM: 'shared semaphore undo', CLONE_SETTLS: 'own thread-local storage', CLONE_VFORK: 'caller paused', CLONE_NEWPID: 'new PID namespace' }[m.f]))] : []));
            drawCode();
          }
          paint();
        },
      },

      /* ---------------- 6. The five other clone() flags: reference + "which flag does this job?" ---------------- */
      {
        title: 'Five more clone() flags: pick the right one',
        kind: 'predict',
        render(el, ctx) {
          const { h } = ctx;
          const game = { i: 0, tries: 0, res: [], done: false };
          const refs = CF_EXTRA.map((m) => h('div', { class: 'xf-ref' },
            h('div', { class: 'row', style: { justifyContent: 'space-between', flexWrap: 'nowrap' } }, h('b', {}, m.f), h('span', { class: 'chip xs' }, 'used by ' + m.use)),
            h('div', { class: 'xf-d', html: m.long })));
          const left = h('div', { class: 'stack', style: { gap: '6px' } },
            h('p', { class: 'p15 m0', html: 'The five sharing flags decide process versus thread. These five fine-tune <b>how</b> the new <span class="t" data-t="Linux task">task</span> starts life, and real programs use them every day. Read them, then put them to work.' }),
            ...refs);
          const dots = h('div', { class: 'ts-dots' });
          const cnt = h('span', { class: 'lbl' });
          const scen = h('div', { class: 'xf-scen' });
          const picks = CF_EXTRA.map((m, i) => h('button', { class: 'btn sm cf-x', type: 'button', onclick: () => answer(i) }, m.f));
          const fb = h('div', { class: 'ts-fb', 'aria-live': 'polite' });
          const nextBtn = h('button', { class: 'btn primary', type: 'button', onclick: next });
          const overBtn = h('button', { class: 'btn ghost sm', type: 'button', onclick: () => restart() }, 'Start over');
          const body = h('div', { class: 'stack', style: { gap: '10px' } },
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, cnt, dots), scen,
            h('div', {}, h('div', { class: 'lbl', style: { marginBottom: '5px' } }, 'Which flag does this job?'), h('div', { class: 'row gap-s xf-picks' }, ...picks)),
            fb, h('div', { class: 'row' }, nextBtn, overBtn));
          const right = h('div', { class: 'card white stack', style: { gap: '10px' } }, h('span', { class: 'lbl' }, 'Your turn: five jobs, five flags'), body);
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: ctx.narrow ? '' : 'minmax(0, 1.12fr) minmax(0, 1fr)' } }, left, right));

          function paint() {
            refs.forEach((r) => r.classList.remove('ok', 'bad'));
            picks.forEach((b) => { b.classList.remove('ok', 'bad'); b.disabled = game.done; });
            overBtn.style.display = game.done ? 'none' : '';
            dots.replaceChildren(...CF_JOBS.map((_, i) => h('i', { class: game.res[i] || (i === game.i && !game.done ? 'cur' : '') })));
            if (game.done) {
              const ok = game.res.filter((r) => r === 'ok').length;
              cnt.textContent = 'All five jobs done';
              scen.innerHTML = `<div class="big">${ok} / ${CF_JOBS.length}</div><div class="small muted" style="text-align:center">right on the first try</div>`;
              fb.className = 'ts-fb ' + (ok === CF_JOBS.length ? 'ok' : '');
              fb.innerHTML = ok === CF_JOBS.length ? '<b>Perfect.</b> You can match each flag to the job it exists for.' : 'Orange dots needed a second try. Re-read those flags on the left, then press <b>Play again</b>.';
              nextBtn.textContent = 'Play again'; nextBtn.disabled = false;
              return;
            }
            const [txt] = CF_JOBS[game.i];
            cnt.textContent = `Job ${game.i + 1} of ${CF_JOBS.length}`;
            scen.textContent = txt;
            fb.className = 'ts-fb';
            fb.innerHTML = 'Pick the flag that makes this happen. Each wrong pick tells you what that flag would do instead.';
            nextBtn.textContent = game.i === CF_JOBS.length - 1 ? 'See my score' : 'Next job →';
            nextBtn.disabled = true;
          }
          function answer(i) {
            if (game.done || !nextBtn.disabled) return;
            const [, want, why] = CF_JOBS[game.i];
            game.tries++;
            refs.forEach((r) => r.classList.remove('ok', 'bad'));
            if (i === want) {
              game.res[game.i] = game.tries === 1 ? 'ok' : 'late';
              refs[i].classList.add('ok'); picks[i].classList.add('ok');
              fb.className = 'ts-fb ok';
              fb.innerHTML = `<b>${game.tries === 1 ? 'Right.' : 'Right, on a later try.'}</b> ${why}`;
              nextBtn.disabled = false;
              dots.replaceChildren(...CF_JOBS.map((_, k) => h('i', { class: game.res[k] || (k === game.i ? 'cur' : '') })));
            } else {
              refs[i].classList.add('bad'); picks[i].classList.add('bad');
              fb.className = 'ts-fb bad';
              fb.innerHTML = `<b>Not ${CF_EXTRA[i].f}.</b> That flag would ${CF_EXTRA[i].would} Try another.`;
            }
          }
          function next() {
            if (game.done) { restart(); return; }
            game.i++; game.tries = 0;
            if (game.i >= CF_JOBS.length) game.done = true;
            paint();
          }
          function restart() { Object.assign(game, { i: 0, tries: 0, res: [], done: false }); paint(); }
          paint();
        },
      },

      /* ---------------- 7. Namespace lab ---------------- */
      {
        title: 'Namespaces: give processes their own view',
        kind: 'lab',
        render(el, ctx) {
          const { h } = ctx;
          /* host: server-1. Container A runs shop-app (host PIDs 4521, 4522), container B runs blog-app (4610, 4611). Both apps want port 8080. */
          const NS = [
            { k: 'mnt', name: 'Mount', flag: 'CLONE_NEWNS', what: 'mount points, the file tree', term: 'Mount namespace',
              host: '/ = bin boot etc home usr var',
              on: ['/ = the shop image: app bin etc usr', '/ = the blog image: app bin etc usr'],
              off: [['bad', 'host\'s / : can wander into /home and /etc'], ['bad', 'host\'s / : can wander into /home and /etc']],
              why: 'A mount namespace has its own list of mount points. The container runtime mounts the container\'s image as its root, so the processes inside see a different file tree. It was the first namespace, which is why its flag has the plain name CLONE_NEWNS.' },
            { k: 'uts', name: 'UTS', flag: 'CLONE_NEWUTS', what: 'hostname, domain name', term: 'UTS namespace',
              host: 'hostname: server-1',
              on: ['hostname: shop', 'hostname: blog'],
              off: [['shr', 'hostname: server-1 (renaming it renames the host)'], ['shr', 'hostname: server-1 (renaming it renames the host)']],
              why: 'A UTS namespace has its own hostname and domain name, the values uname() reports. The odd name comes from the kernel structure that holds them ("UNIX Time-sharing System").' },
            { k: 'ipc', name: 'IPC', flag: 'CLONE_NEWIPC', what: 'semaphores, queues, shared memory', term: 'IPC namespace',
              host: 'shared memory "host-cache"',
              on: ['only its own IPC objects (none yet)', 'only its own IPC objects (none yet)'],
              off: [['bad', 'can attach "host-cache" and B\'s segments'], ['bad', 'can attach "host-cache" and A\'s segments']],
              why: 'An IPC namespace has its own System V semaphores, message queues and shared-memory segments (and its own POSIX message queues), so one container cannot attach another\'s shared memory by guessing its key.' },
            { k: 'pid', name: 'PID', flag: 'CLONE_NEWPID', what: 'process IDs', term: 'PID namespace',
              host: 'sees all: 1 systemd, 812 sshd, 4521 shop-app, 4610 blog-app…',
              on: ['1 shop-app, 2 worker (the host calls them 4521, 4522)', '1 blog-app, 2 worker (the host calls them 4610, 4611)'],
              off: [['shr', 'sees every host process, even 4610 blog-app'], ['shr', 'sees every host process, even 4521 shop-app']],
              why: 'Each PID namespace numbers its processes from 1; the first one inside is its "init". A process has a PID in its own namespace and another in the parent namespace, so the host can still see and manage it.' },
            { k: 'net', name: 'Network', flag: 'CLONE_NEWNET', what: 'devices, IPs, routes, ports', term: 'Network namespace',
              host: 'eth0 192.168.1.20',
              on: ['own eth0 172.17.0.2 · port 8080 ✓', 'own eth0 172.17.0.3 · port 8080 ✓'],
              off: [['shr', 'host\'s eth0 · port 8080 ✓ (it got there first)'], ['bad', 'host\'s eth0 · port 8080 already taken ✗']],
              why: 'A network namespace has its own devices, IP addresses, routing table, firewall rules and port numbers, so both apps can listen on port 8080. A virtual cable (a veth pair) links it to the host.' },
            { k: 'user', name: 'User', flag: 'CLONE_NEWUSER', what: 'user and group IDs', term: 'User namespace',
              host: 'root is UID 0',
              on: ['root inside = UID 100000 outside: no host powers', 'root inside = UID 200000 outside: no host powers'],
              off: [['bad', 'its UID 0 is the host\'s real root!'], ['bad', 'its UID 0 is the host\'s real root!']],
              why: 'A user namespace maps IDs: UID 0 inside can be an ordinary UID such as 100000 outside. The process has root powers over things its namespaces own, and none over the host.' },
          ];
          const on = new Set();
          let sel = null;
          const tgs = NS.map((n) => h('button', { class: 'ns-tg', type: 'button', onclick: () => { if (on.has(n.k)) on.delete(n.k); else on.add(n.k); sel = n.k; paint(); } },
            h('i', { class: 'cf-sw' }), h('b', {}, `${n.name} namespace`), h('span', {}, n.what)));
          const info = h('div', { class: 'card tight stack', style: { gap: '4px', flex: 'none' } });
          const left = h('div', { class: 'stack', style: { gap: '7px' } },
            h('div', { class: 'row gap-s' }, h('span', { class: 'lbl' }, 'Presets'),
              h('button', { class: 'btn sm', type: 'button', onclick: () => { on.clear(); sel = null; paint(); } }, 'All off'),
              h('button', { class: 'btn sm', type: 'button', onclick: () => { NS.forEach((n) => on.add(n.k)); sel = null; paint(); } }, 'All six on')),
            h('div', { class: 'stack', style: { gap: '5px', flex: 'none' } }, ...tgs), info);
          const tbl = h('div', { class: 'ns-tbl' });
          const score = h('span', { class: 'chip' });
          const right = h('div', { class: 'stack', style: { gap: '8px' } },
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'lbl' }, 'What each one sees'), score), tbl,
            h('p', { class: 'small muted m0', html: 'Namespaces are made with <span class="t">clone()</span> flags such as CLONE_NEWPID, or with <b>unshare()</b>, which moves the calling process into new ones (for PID, only its future children go in). <b>setns()</b> joins an existing one: that is how a command is run inside a container that is already up.' }));
          el.append(h('div', { class: 'split l3 fill' + (ctx.narrow ? ' nrw' : '') }, left, right));

          function paint() {
            tgs.forEach((b, i) => b.classList.toggle('on', on.has(NS[i].k)));
            const tag = (x) => (ctx.narrow ? h('b', { style: { marginRight: '8px', flex: 'none' } }, x) : null);   // phones: one column, so label every cell
            const cells = ctx.narrow ? [] : [h('div'), h('div', { class: 'ns-th' }, 'Host: server-1'), h('div', { class: 'ns-th' }, 'Container A: shop'), h('div', { class: 'ns-th' }, 'Container B: blog')];
            NS.forEach((n) => {
              const o = on.has(n.k), hi = sel === n.k ? ' sel' : '';
              cells.push(h('div', { class: 'ns-rl' }, h('b', {}, n.name), h('code', {}, n.flag)));
              cells.push(h('div', { class: 'ns-c host' + hi }, tag('Host'), h('span', {}, n.host)));
              [0, 1].forEach((j) => cells.push(h('div', { class: 'ns-c ' + (o ? 'own' : n.off[j][0]) + hi }, tag(j ? 'B' : 'A'), h('span', {}, o ? n.on[j] : n.off[j][1]))));
            });
            tbl.replaceChildren(...cells);
            score.className = 'chip ' + (on.size === 6 ? 'ok' : on.size ? 'warn' : 'bad');
            score.textContent = on.size === 6 ? 'A and B: fully isolated views (6 of 6)' : `isolated in ${on.size} of 6 ways`;
            const n = NS.find((x) => x.k === sel);
            if (n) info.replaceChildren(h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', { html: `<span class="t" data-t="${n.term}">${n.term}</span>` }), h('code', {}, n.flag)),
              h('p', { class: 'small m0', html: n.why }));
            else info.replaceChildren(h('div', { class: 'lbl' }, 'How to read the table'),
              h('p', { class: 'small m0', html: 'A <span class="t">namespace</span> gives the processes inside their <b>own copy</b> of one part of the system. Green: the container has its own. Orange or red: it shares the host\'s, and red means trouble. Switch the namespaces on one at a time.' }));
          }
          paint();
        },
      },

      /* ---------------- 7. cgroups + containers ---------------- */
      {
        title: 'cgroups set the budget; containers combine it all',
        kind: 'lab',
        render(el, ctx) {
          const { h } = ctx;
          const f2 = (v) => ctx.util.fmt(v, 2);
          /* Host: 4 cores, 8 GB. The OS itself uses 1 GB. Container A (shop): 1 busy thread, 1.5 GB.
             Container B (batch job): 8 busy threads, memory demand D GB (a leak you control). */
          const CORES = 4, RAM = 8, OS_MEM = 1, A_MEM = 1.5, B_THREADS = 8;
          let cg = false, L = 1.5, M = 2, D = 3;
          const left = h('div', { class: 'stack', style: { gap: '10px' } },
            h('p', { class: 'lead m0', html: 'Namespaces decide what a process can <b>see</b>. A <span class="t">cgroup</span> decides how much it can <b>use</b>.' }),
            h('p', { class: 'p15 m0', html: 'The kernel puts tasks into <span class="t" data-t="Control group (cgroup)">control groups</span>, a tree of directories under <code>/sys/fs/cgroup</code>. For each group it can <b>limit</b> CPU, memory, disk I/O and network use (<code>cpu.max</code>, <code>memory.max</code>), <b>prioritize</b> it (<code>cpu.weight</code>), <b>account</b> for its use, and <b>control</b> it as a unit (freeze or kill all its tasks).' }),
            h('div', { class: 'cg-eq' }, h('span', { class: 'box accent' }, 'namespaces'), '+', h('span', { class: 'box io' }, 'cgroups'), '+', h('span', { class: 'box mem' }, 'own root files'), '=', h('span', { class: 'box proc', html: '<span class="t">container</span>' })),
            h('table', { class: 'tbl compact' },
              h('tr', {}, h('th', {}, ''), h('th', {}, 'Container'), h('th', {}, 'Virtual machine')),
              h('tr', {}, h('td', { class: 'b' }, 'Kernel'), h('td', {}, 'shares the host\'s kernel'), h('td', {}, 'its own guest kernel')),
              h('tr', {}, h('td', { class: 'b' }, 'Isolation'), h('td', {}, 'namespaces + cgroups'), h('td', {}, 'a hypervisor')),
              h('tr', {}, h('td', { class: 'b' }, 'Start-up'), h('td', {}, 'as fast as starting a process'), h('td', {}, 'boots a whole OS'))),
            h('div', { class: 'callout why m0', 'data-label': 'Why it matters', html: 'One runaway container cannot starve its neighbours, so one server can safely host many customers\' containers. Docker, LXC and Podman all build containers from these same kernel parts.' }));

          /* ---- right: the lab ---- */
          const seg = ctx.ui.seg([{ value: false, label: 'No cgroups' }, { value: true, label: 'Put A and B in cgroups' }], cg, (v) => { cg = v; paint(); });
          const sL = ctx.ui.slider({ label: 'B\'s CPU limit', min: 0.5, max: 3, step: 0.5, value: L, format: (v) => v + ' cores', onInput: (v) => { L = v; paint(); } });
          const sM = ctx.ui.slider({ label: 'B\'s memory limit', min: 0.5, max: 5, step: 0.5, value: M, format: (v) => v + ' GB', onInput: (v) => { M = v; paint(); } });
          const sD = ctx.ui.slider({ label: 'B\'s memory demand (a leak)', min: 1, max: 7, step: 0.5, value: D, format: (v) => v + ' GB', onInput: (v) => { D = v; paint(); } });
          const files = h('div', { class: 'cg-files' });
          const cpuBar = h('div', { class: 'cg-bar' }), memBar = h('div', { class: 'cg-bar' });
          const cpuLbl = h('div', { class: 'xs muted b' }), memLbl = h('div', { class: 'xs muted b' });
          const stA = h('div', { class: 'card tight cg-st' }), stB = h('div', { class: 'card tight cg-st' });
          const quota = h('p', { class: 'small m0' });
          const right = h('div', { class: 'card white stack', style: { gap: '9px' } },
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'lbl' }, 'Host: 4 cores, 8 GB'), seg),
            sL, sM, sD, files,
            h('div', { class: 'stack', style: { gap: '3px' } }, cpuLbl, cpuBar),
            h('div', { class: 'stack', style: { gap: '3px' } }, memLbl, memBar),
            h('div', { class: 'grid-2', style: { gap: '10px' } }, stA, stB), quota);
          el.append(h('div', { class: 'split l fill' }, left, right));

          const seg_ = (cls, w, txt) => h('i', { class: cls, style: { width: w + '%' }, title: txt }, w > 9 ? txt : '');
          function paint() {
            [sL, sM].forEach((x) => x.classList.toggle('cg-dim', !cg));
            quota.innerHTML = cg ? `<b>Reading cpu.max:</b> "${L * 100000} 100000" lets B's group run ${(L * 100000).toLocaleString('en-US')} µs of CPU time in every 100,000 µs period, that is ${L} cores' worth. When the quota is used up, B's threads wait for the next period: they are <b>throttled</b>.`
              : '<b>Try it:</b> put A and B in cgroups, then move the sliders. Watch A\'s share of the processor and what happens when B\'s demand passes its memory limit.';
            files.innerHTML = cg ? `B/cpu.max = "${L * 100000} 100000"   B/memory.max = "${M}G"` : 'no cgroup files: every task competes on its own';
            /* CPU: without cgroups, 9 equally busy threads share 4 cores. With cgroups, B is capped at L cores (quota per 100 ms period). */
            let a, b;
            if (!cg) { a = CORES / (1 + B_THREADS); b = CORES - a; } else { b = L; a = Math.min(1, CORES - L); }
            const idle = CORES - a - b;
            cpuLbl.innerHTML = `CPU time per second, in cores (4 in all) · A needs 1 core, B's 8 threads would take all 4`;
            cpuBar.replaceChildren(seg_('a', a / CORES * 100, `A ${f2(a)}`), seg_('b', b / CORES * 100, `B ${f2(b)}`), h('i', { style: { width: idle / CORES * 100 + '%' } }, idle >= 0.4 ? f2(idle) + ' idle' : ''));
            /* Memory */
            const bUse = cg ? Math.min(D, M) : D;
            const total = OS_MEM + A_MEM + bUse, over = Math.max(0, total - RAM);
            const scale = 100 / Math.max(RAM, total);
            memLbl.innerHTML = `Memory in GB (8 in all) · OS 1 · A 1.5 · B wants ${D}`;
            memBar.replaceChildren(seg_('o', OS_MEM * scale, 'OS 1'), seg_('a', A_MEM * scale, 'A 1.5'), seg_('b', (bUse - over) * scale, `B ${f2(bUse - over)}`), over ? seg_('x', over * scale, `+${f2(over)} short!`) : h('i', { style: { width: (RAM - total) * scale + '%' } }, RAM - total >= 0.8 ? f2(RAM - total) + ' free' : ''));
            /* Verdicts */
            const slow = a < 1;
            stA.style.setProperty('--c', slow || over ? 'var(--bad)' : 'var(--ok)');
            stA.replaceChildren(h('b', { class: 'hd' }, 'Container A (shop)'), h('span', { html: slow
              ? `Gets only <b>${f2(a)}</b> of the 1 core it needs, so every page takes <b>${f2(1 / a)}×</b> as long. B\'s 8 threads crowd it out.`
              : over ? 'Has its CPU, but the machine is out of memory: everything slows while the kernel scrambles for pages.' : 'Gets the full core it needs. B\'s appetite no longer matters to it.' }));
            let bc, bt;
            if (over) { bc = 'var(--bad)'; bt = `Needs ${f2(over)} GB more than the host has. The whole machine slows while the kernel frees memory, then the host-wide out-of-memory (OOM) killer must kill something.`; }
            else if (cg && D > M) { bc = 'var(--warn)'; bt = `Hit memory.max (${M} GB). The kernel reclaims B's own memory; when that fails, the OOM killer ends a process <b>inside B only</b>.`; }
            else if (cg) { bc = 'var(--warn)'; bt = `Throttled to <b>${L}</b> of the 8 cores it wants, and within its memory limit. Its cgroup tally: ${f2(b)} CPU-seconds per second, ${f2(bUse)} GB.`; }
            else { bc = 'var(--io)'; bt = `Takes <b>${f2(b)}</b> cores and ${f2(bUse)} GB. Nothing limits it, and nothing even keeps a per-container tally.`; }
            stB.style.setProperty('--c', bc);
            stB.replaceChildren(h('b', { class: 'hd' }, 'Container B (batch job)'), h('span', { html: bt }));
          }
          paint();
        },
      },

      /* ---------------- 8. Recap ---------------- */
      {
        title: 'Recap: six ideas to carry away',
        kind: 'recap',
        render(el, ctx) {
          const { h } = ctx;
          el.append(h('div', { class: 'stack fill', style: { gap: '12px' } },
            h('p', { class: 'lead m0' }, 'Say each answer out loud before you flip the card.'),
            ctx.ui.flipcards([
              ['What does Linux call the thing it schedules?', 'A <b>task</b>. Every process and every thread is a task with its own task_struct. There is no separate thread structure.'],
              ['Nine kinds of information in a task_struct?', 'State · scheduling information · identifiers · interprocess communication · links · times and timers · file system · address space · processor-specific context.'],
              ['The five Linux task states?', '<b>Running</b> (executing or ready) · <b>Interruptible</b> (S: a signal wakes it) · <b>Uninterruptible</b> (D: signals wait for the hardware) · <b>Stopped</b> (T) · <b>Zombie</b> (Z: waits for the parent\'s wait()).'],
              ['What makes a Linux thread a thread?', 'Only what it shares. clone() with CLONE_VM, CLONE_FILES, CLONE_FS, CLONE_SIGHAND and CLONE_THREAD makes one. fork() is clone() with no sharing flags. Five more flags (NEWPID, PARENT, SYSVSEM, SETTLS, VFORK) tune how the task starts.'],
              ['What do namespaces do? Name all six.', 'They give processes their own view of one part of the system: <b>mount, UTS, IPC, PID, network, user</b>.'],
              ['What does a cgroup add, and what is a container?', 'A cgroup <b>limits, prioritizes, accounts for and controls</b> CPU, memory, disk I/O and network use. Container = namespaces + cgroups + own root files, on the host\'s one kernel.'],
            ].map(([f, b]) => [f, '<div>' + b + '</div>']), { cols: 3, height: 184 }),
            h('div', { class: 'callout why m0', 'data-label': 'The whole section in one line', html: 'One record (<b>task_struct</b>), one creation call (<b>clone()</b>): sharing decides process versus thread, <b>namespaces</b> decide what a task can see, and <b>cgroups</b> decide how much it can use.' })));
        },
      },

      /* ---------------- 9. Check yourself ---------------- */
      {
        title: 'Check yourself',
        kind: 'check',
        quiz: [
          { q: 'A Linux task is blocked while a disk controller finishes a transfer, and it will not react to any signal until the hardware is done. Which state is it in?',
            choices: ['Interruptible', 'Uninterruptible', 'Stopped', 'Zombie'], answer: 1,
            feedback: ['An Interruptible task is woken by a signal. This one will not react to signals until the hardware is done, so it is in the other blocked state.', null, 'A Stopped task was halted by a signal or a debugger; it is not waiting on hardware.', 'A Zombie has already terminated; it is not waiting for anything except its parent\'s wait().'],
            why: 'Uninterruptible (ps shows D) is the blocked state for waits directly on hardware. Signals sent meanwhile stay pending and are acted on only after the wait ends.' },
          { type: 'tf', q: 'Linux keeps a separate, smaller data structure for each thread, alongside the task_struct of the process that owns it.', answer: false,
            why: 'Linux has no separate thread structure. Every thread is a task with its own full task_struct; the threads of one process simply point to the same memory, open files and other resources.' },
          { type: 'bucket', q: 'Sort each piece of a task_struct into its category.', buckets: ['Identifiers', 'Links', 'File system', 'Address space'],
            items: [['user and group IDs', 0], ['list of the task\'s children', 1], ['pointer to the open-file table', 2], ['current and root directory', 2], ['description of the virtual memory', 3]],
            why: 'Identifiers say who the task is and who it runs for; links hold its family tree; the file-system part points to open files and directories; the address-space part describes its virtual memory.' },
          { type: 'match', q: 'Match each clone() flag to what the new task shares with its creator.',
            pairs: [['CLONE_VM', 'the address space (memory)'], ['CLONE_FILES', 'the open-file table'], ['CLONE_FS', 'current directory, root directory and umask'], ['CLONE_SIGHAND', 'the table of signal handlers'], ['CLONE_THREAD', 'membership of the same thread group']],
            why: 'Each flag shares one resource instead of copying it. Setting all five (as pthread_create() does) makes the new task a thread of the same process; setting none of them is exactly fork().' },
          { type: 'match', q: 'Match each Linux namespace to what it gives its processes their own copy of.',
            pairs: [['Mount', 'the file-system tree (mount points)'], ['UTS', 'hostname and domain name'], ['IPC', 'semaphores, message queues and shared memory'], ['PID', 'process ID numbers'], ['Network', 'network devices, IP addresses, routes and ports'], ['User', 'user and group ID numbers']],
            why: 'Each namespace isolates one kind of resource. Together the six give a container its own view of the system.' },
          { type: 'num', q: 'A web server\'s main thread starts 7 worker threads with pthread_create(). How many task_structs does the Linux kernel keep for this one process?', answer: 8, tol: 0,
            why: 'Every thread is its own task: 1 main thread + 7 workers = 8 task_structs. They form one thread group and share one TGID, which is the process ID that getpid() reports.' },
          { type: 'num', q: 'A container\'s cgroup has cpu.max set to "50000 100000": a quota of 50,000 µs of CPU time in every 100,000 µs period. At most how many milliseconds of CPU time can the container use in one second?', answer: 500, tol: 0, unit: 'ms',
            why: '50,000 µs per 100,000 µs is half a processor. One second holds 10 periods, so the most it can use is 10 × 50 ms = 500 ms; after that its threads are throttled until the next period.' },
          { type: 'order', q: 'Put the life of a Linux task in order.',
            items: ['clone() or fork() creates it: Running, ready to run', 'The scheduler dispatches it and it executes', 'It waits for a key press and becomes Interruptible', 'The key press wakes it: Running (ready) again', 'It calls exit() and becomes a Zombie', 'Its parent calls wait() and the task_struct is freed'],
            why: 'Created ready, dispatched, blocked on an event, woken back to ready, terminated into a zombie, and finally removed when the parent collects its exit status.' },
          { q: 'A shell is about to start a new program. Its child will call exec() at once, so the shell wants the child to <b>borrow</b> the shell\'s memory instead of getting its own copy, and the shell wants to sleep until that exec() happens. Which clone() flags ask for exactly this?',
            choices: ['CLONE_VM | CLONE_VFORK', 'No flags at all, as fork() uses', 'CLONE_VM | CLONE_SIGHAND | CLONE_THREAD', 'CLONE_VFORK on its own'], answer: 0,
            feedback: [null, 'That is fork(): clone() with no sharing flags. The child gets its own (copy-on-write) copy of memory, and the shell keeps running instead of waiting.', 'That makes a thread: memory is shared, but the caller keeps running alongside the new task instead of sleeping until an exec().', 'CLONE_VFORK alone does pause the caller, but without CLONE_VM the child gets its own copy of memory instead of borrowing the parent\'s.'],
            why: 'CLONE_VM lends the parent\'s memory to the child with no copying, and CLONE_VFORK keeps the parent asleep until the child calls exec() or exits, so the two never use that memory at once. This pair is what vfork() asks for; fork(), by contrast, is clone() with none of the sharing flags.' },
          { type: 'multi', q: 'Which statements about Linux containers are true?',
            choices: ['All containers on a host share the host\'s one kernel', 'Namespaces decide what a container\'s processes can see', 'cgroups limit and account for the resources a container uses', 'Each container boots its own guest kernel, like a virtual machine', 'A process can be PID 1 inside its container and have a different PID on the host'], answer: [0, 1, 2, 4],
            why: 'A container is a set of ordinary tasks isolated by namespaces and limited by cgroups on the host\'s kernel. Its PID namespace numbers processes from 1, while the host numbers the same processes its own way. Only a virtual machine runs a separate kernel.' },
          { q: 'Inside its user namespace a container process runs as UID 0 (root), and that ID maps to UID 100000 on the host. What may it do to a host file owned by the host\'s real root?',
            choices: ['Anything, because it is root', 'Only what an ordinary user with UID 100000 could do', 'Nothing with any file anywhere', 'Read it freely but not write it'], answer: 1,
            feedback: ['It is root only inside its own namespace; outside, the kernel sees UID 100000.', null, 'It can still use files inside its own container and any files UID 100000 is allowed to use.', 'Permission checks on the host use UID 100000, which gives no special right to read root\'s files.'],
            why: 'A user namespace maps IDs. Root powers apply to things owned by the process\'s own namespaces; on the host it is treated as the unprivileged user it maps to.' },
          { q: 'A debugger has paused a program. Which Linux state is the program in, and what brings it back?',
            choices: ['Stopped: it runs again only when another process acts on it, here the debugger telling it to continue', 'Interruptible: it wakes by itself when its I/O completes', 'Zombie: its parent must call wait()', 'Running: the scheduler resumes it when its time slice refills'], answer: 0,
            feedback: [null, 'Interruptible tasks wait for an event. A paused program is not waiting for I/O; it will not move until someone else acts.', 'A zombie has terminated for good; wait() removes it rather than resuming it.', 'A paused task is not runnable, so the scheduler never picks it.'],
            why: 'Stopped (ps shows T, or a lowercase t while a debugger traces it) means halted and not runnable. Only a positive action by another process lets it run again: SIGCONT for an ordinary stop, or the debugger\'s continue command for a traced program.' },
        ],
      },
    ],

    notes: `
      <h3>1. One kind of task</h3>
      <p>Linux keeps one kind of record. Every process and every thread is a <b>task</b> described by a <b>task_struct</b> (Linux's process control block). Two tasks count as two processes or as two threads of one process only by <b>how much they share</b>: processes have their own copies of memory, open files and so on; threads point to the same ones. (This Linux meaning of "task" is not the older one from section 4.1, where "task" was another name for the resource-owning process. Because each thread has its own task_struct, the task_struct also plays the role of the thread control block.)</p>

      <h3>2. task_struct: the kernel's record of a task</h3>
      <p>Well over a hundred fields, in nine groups:</p>
      <table>
        <tr><th>Group</th><th>What it holds</th><th>Example fields</th></tr>
        <tr><td>State</td><td>Which of the five states the task is in.</td><td>state</td></tr>
        <tr><td>Scheduling information</td><td>Normal or real-time class (real-time runs first), priority, and a counter of the processor time it may still use.</td><td>policy, prio, time_slice</td></tr>
        <tr><td>Identifiers</td><td>Unique process ID; user and group IDs used for access rights.</td><td>pid, tgid, uid, gid</td></tr>
        <tr><td>Interprocess communication</td><td>Pending signals, signal handlers, System V semaphores, message queues, shared memory.</td><td>pending, sighand, sysvsem</td></tr>
        <tr><td>Links</td><td>Pointers to parent, siblings and children.</td><td>real_parent, children, sibling</td></tr>
        <tr><td>Times and timers</td><td>Creation time, processor time used (user and kernel mode), interval timers that signal the task when they expire.</td><td>start_time, utime, stime</td></tr>
        <tr><td>File system</td><td>Pointers to the open-file table, the current directory and the root directory.</td><td>files, fs</td></tr>
        <tr><td>Address space</td><td>Pointer to the description of the virtual address space.</td><td>mm</td></tr>
        <tr><td>Processor-specific context</td><td>Saved registers and stack information so the task can resume; depends on the processor type.</td><td>thread, stack</td></tr>
      </table>
      <p>Many fields are <b>pointers</b>, so two tasks can point to the same table: that is how sharing works.</p>

      <h3>3. The five Linux task states</h3>
      <table>
        <tr><th>State</th><th>ps shows</th><th>Meaning</th></tr>
        <tr><td>Running</td><td>R</td><td>Executing now, or ready in the run queue (TASK_RUNNING for both).</td></tr>
        <tr><td>Interruptible</td><td>S</td><td>Blocked until an event: I/O done, a resource free, or a signal. A signal wakes it.</td></tr>
        <tr><td>Uninterruptible</td><td>D</td><td>Blocked directly on a hardware condition (e.g. a disk transfer); handles no signals until it is met. Newer kernels add a killable variant that SIGKILL alone can end.</td></tr>
        <tr><td>Stopped</td><td>T</td><td>Halted; resumes only when another process acts (e.g. SIGCONT). A program held by a debugger is stopped too (ps shows t, traced); the debugger resumes it.</td></tr>
        <tr><td>Zombie</td><td>Z</td><td>Terminated, but its task_struct stays in the process table until the parent's wait().</td></tr>
      </table>
      <p><b>Transitions.</b> Creation puts a task in Running (ready); scheduling moves it between ready and executing. Waiting sends it to Interruptible or Uninterruptible; the event (or, for Interruptible only, a signal) returns it to ready. A stop signal sends it to Stopped; SIGCONT returns it to ready. Termination makes it a Zombie; the parent's wait() removes it.</p>
      <p>A task acts on signals only when it runs, so a signal sent to an Uninterruptible task, even SIGKILL, stays pending until the hardware wait ends: a process stuck in plain D sleep cannot be killed. A typical life: created (ready) → executing → waits for a key (Interruptible) → key press (ready) → exit() (Zombie) → parent's wait() frees the task_struct.</p>

      <h3>4. Linux threads are tasks that share</h3>
      <p>Traditional UNIX gave each process one thread. Linux keeps no separate structure for threads: each user-level thread is mapped onto its own kernel-level task (one-to-one), and the tasks of one program share one <b>thread group ID (TGID)</b>. getpid() returns the TGID; gettid() returns the task's own ID. ps shows one line per process (PID = TGID); ps -L shows one line per task (LWP column).</p>
      <p>Because tasks of a group share memory and files, switching between them skips the expensive part of a context switch: the memory map stays loaded. Switching to another group's task must load a new map.</p>
      <p><b>Worked example.</b> A web server's main thread creates 7 workers with pthread_create(). The kernel keeps 1 + 7 = <b>8 task_structs</b>, all in one thread group with one TGID.</p>

      <h3>5. clone() and its flags</h3>
      <p>A new task starts as a copy of the current one. Linux creates it with <b>clone()</b>, whose flags choose, resource by resource, sharing or copying. <b>fork() is clone() with all sharing flags cleared.</b> Two tasks sharing one virtual memory act as threads of one process, with no separate thread structure.</p>
      <table>
        <tr><th>Flag</th><th>Effect</th></tr>
        <tr><td>CLONE_VM</td><td>Share the address space (memory).</td></tr>
        <tr><td>CLONE_FILES</td><td>Share the open-file table.</td></tr>
        <tr><td>CLONE_FS</td><td>Share current directory, root directory and umask (default permissions for new files).</td></tr>
        <tr><td>CLONE_SIGHAND</td><td>Share the table of signal handlers.</td></tr>
        <tr><td>CLONE_THREAD</td><td>Join the caller's thread group (same TGID).</td></tr>
        <tr><td>CLONE_NEWPID</td><td>Start the new task in a new PID namespace, where it is PID 1 (container runtimes; needs administrator rights).</td></tr>
        <tr><td>CLONE_PARENT</td><td>The new task gets the caller's parent, so it is the caller's sibling and its exit is reported to that parent.</td></tr>
        <tr><td>CLONE_SYSVSEM</td><td>Share one list of semaphore undo entries (changes the kernel reverses when a task exits); undone once, when the last sharer exits.</td></tr>
        <tr><td>CLONE_SETTLS</td><td>Point the new task at its own thread-local storage block (per-thread variables such as errno).</td></tr>
        <tr><td>CLONE_VFORK</td><td>Caller sleeps until the child calls exec() or exits; with CLONE_VM the child borrows the parent's memory, no copying (vfork(), posix_spawn()).</td></tr>
      </table>
      <p>fork() = no sharing flags (plus SIGCHLD, the signal the parent gets when the child ends); vfork() = CLONE_VM + CLONE_VFORK; pthread_create() = CLONE_VM, FS, FILES, SIGHAND, THREAD, SYSVSEM, SETTLS. Without CLONE_VM a child's write changes only its own copy; with it, both tasks use the same memory, so the parent can read the new value (reliably, and in order, only with synchronization such as a lock or an atomic operation; section 5.1).</p>
      <p><b>Invalid combinations (errno = EINVAL, no task is made).</b> For the flags above: CLONE_SIGHAND without CLONE_VM (handlers are code addresses, so sharing them needs shared memory); CLONE_THREAD without CLONE_SIGHAND (a thread group shares one set of handlers); CLONE_THREAD with CLONE_NEWPID (the threads of a group share one queue of waiting signals, so they must share one PID numbering); and CLONE_PARENT with CLONE_NEWPID (the first task of a new PID namespace stays the caller's own child; the manual lists this as EINVAL although kernels since 3.13 accept it, so portable code avoids it). The manual also forbids CLONE_FS with CLONE_NEWNS (a new mount namespace needs its own root and current directory), CLONE_SYSVSEM with CLONE_NEWIPC (the shared undo entries would refer to semaphores the new IPC namespace cannot reach), and CLONE_NEWUSER with CLONE_THREAD or CLONE_FS.</p>

      <h3>6. Namespaces</h3>
      <p>A <b>namespace</b> gives a process, or processes sharing it, a different view of the system from other processes; namespaces are the basis of containers. The six classic ones (newer kernels add cgroup and time namespaces):</p>
      <table>
        <tr><th>Namespace</th><th>Its processes get their own…</th><th>clone() flag</th></tr>
        <tr><td>Mount</td><td>mount points, so a different file-system tree and root</td><td>CLONE_NEWNS</td></tr>
        <tr><td>UTS</td><td>hostname and domain name (what uname() reports)</td><td>CLONE_NEWUTS</td></tr>
        <tr><td>IPC</td><td>semaphores, message queues, shared-memory segments</td><td>CLONE_NEWIPC</td></tr>
        <tr><td>PID</td><td>process ID numbering; the first process inside is PID 1</td><td>CLONE_NEWPID</td></tr>
        <tr><td>Network</td><td>network devices, IP addresses, routing table, port numbers</td><td>CLONE_NEWNET</td></tr>
        <tr><td>User</td><td>user and group ID mapping</td><td>CLONE_NEWUSER</td></tr>
      </table>
      <p>They are made with clone() flags or unshare() (for PID, unshare() places only the caller's future children in the new namespace), and joined with setns(). In a PID namespace a process can be PID 1 inside and have another PID on the host. In a user namespace it can be root (UID 0) inside yet map to an ordinary UID such as 100000 outside, with no power over the host.</p>

      <h3>7. Control groups and containers</h3>
      <p>A <b>control group (cgroup)</b> is a group of tasks in a tree of directories under /sys/fs/cgroup. The kernel can <b>limit</b> the group's CPU time, memory, disk I/O and network (files such as cpu.max, memory.max), <b>prioritize</b> it (cpu.weight), <b>account</b> for its use, and <b>control</b> it as a unit (freeze or kill all its tasks). Namespaces decide what a process can <b>see</b>; cgroups, how much it can <b>use</b>.</p>
      <p><b>Worked example.</b> cpu.max = "50000 100000" means a quota of 50,000 µs of CPU time in every 100,000 µs period: half a processor. One second holds 10 periods, so the group can use at most 10 × 50 ms = <b>500 ms</b> of CPU time per second; once the quota is spent its threads are throttled until the next period. Without cgroups, 8 busy threads in one container and 1 in another on 4 cores get 4/9 ≈ 0.44 core each, so the lone thread runs 2.25 times slower. A group over its memory.max loses a process to the out-of-memory killer inside that group only.</p>
      <p>A <b>container</b> = namespaces + cgroups + its own root file system, as ordinary tasks on the host's one kernel (Docker, LXC). A virtual machine runs its own guest kernel on a hypervisor and must boot a whole OS.</p>
    `,
  });
})();
