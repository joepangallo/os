/* =====================================================================
   11.10 Windows I/O
   Original teaching material. Helpers shared by several steps live inside
   this IIFE (no globals).
   ===================================================================== */
(function () {

  // box(): a rounded rectangle with one or more centred text lines; r = [x, y, w, h]
  function box(s, r, cls, lines, o = {}) {
    const [x, y, w, hh] = r, fs = o.fs || 14, lh = fs + 3;
    const top = y + hh / 2 - ((lines.length - 1) * lh) / 2 + fs * 0.36;
    return s('g', {},
      s('rect', { x, y, width: w, height: hh, rx: o.rx || 10, class: cls + ' fr', 'stroke-width': o.sw || 2, 'stroke-dasharray': o.dash || null }),
      ...lines.map((t, i) => s('text', { x: x + w / 2, y: top + i * lh, 'text-anchor': 'middle', 'font-size': fs, 'font-weight': i === 0 ? 800 : 600, class: i === 0 ? null : 's-sub' }, t)));
  }

  // arrow(): a straight connector with an arrowhead; cls picks the colour
  function arrow(s, x1, y1, x2, y2, cls = 's-line', mk = 'arr', o = {}) {
    return s('line', { x1, y1, x2, y2, class: cls, 'stroke-width': o.sw || 2, 'marker-end': mk ? `url(#${mk})` : null, 'stroke-dasharray': o.dash || null });
  }

  // hot(): wraps an SVG group so it behaves like a button (click, Enter, Space)
  function hot(s, label, on, fn, ...kids) {
    return s('g', { class: 'hot' + (on ? ' sel' : ''), role: 'button', tabindex: 0, 'aria-label': label, onclick: fn,
      onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } } }, ...kids);
  }

  /* lazySim(): the lazy-write lab model.
     writes: list of [block, column]; a write in column c happens at (c + 0.25) * T ms.
     The lazy writer runs at every whole second (1000, 2000, 3000 ms) and writes each block
     that changed since its last run. crashCol: null, or the column in which the power fails,
     at (crashCol + 0.75) * T ms. diskMs: time one write-through disk write makes the program wait. */
  function lazySim(writes, T, cols, crashCol, diskMs) {
    const flushes = [1000, 2000, 3000].filter((f) => f <= cols * T);
    const crashT = crashCol == null ? Infinity : (crashCol + 0.75) * T;
    const wt = (c) => (c + 0.25) * T;
    const done = writes.filter(([, c]) => wt(c) < crashT).sort((a, b) => a[1] - b[1]);
    const runs = flushes.filter((f) => f <= crashT).map((f, i, arr) => {
      const from = i ? arr[i - 1] : 0;
      const blocks = [...new Set(done.filter(([, c]) => wt(c) > from && wt(c) < f).map(([b]) => b))].sort();
      return { t: f, blocks };
    });
    const status = {};
    done.forEach(([b, c]) => { status[b + c] = runs.some((r) => r.t > wt(c)) ? 'saved' : (crashCol == null ? 'pending' : 'lost'); });
    const lost = done.filter(([b, c]) => status[b + c] === 'lost');
    return {
      n: done.length, crashT, runs, status, lost,
      wtDisk: done.length, wtWait: done.length * diskMs,
      lazyDisk: runs.reduce((a, r) => a + r.blocks.length, 0),
    };
  }

  /* ioSim(): one thread reads N blocks; each needs D ms of device time and then C ms of processing.
     Synchronous: issue, block until done, process, issue the next.
     Asynchronous: issue all N at time 0, process each result as soon as it is ready and the thread is free.
     par = true: the device works on every request at once (like an SSD with many requests in flight). */
  function ioSim(N, D, C, par) {
    const sync = [];
    let t = 0;
    for (let i = 0; i < N; i++) { sync.push({ i, dev: [t, t + D], work: [t + D, t + D + C] }); t += D + C; }
    const asy = [];
    let free = 0;
    for (let i = 0; i < N; i++) {
      const done = par ? D : (i + 1) * D, start = Math.max(done, free);
      asy.push({ i, dev: par ? [0, D] : [i * D, (i + 1) * D], work: [start, start + C] });
      free = start + C;
    }
    return { sync, asy, syncT: t, asyncT: free, syncWait: N * D, asyncWait: free - N * C };
  }

  /* TECH: the five ways Windows reports that an asynchronous request finished.
     Each frame: th = threads [id, name, state, class], mid = signal objects [id, title, sub, class],
     dev = [title, sub, class], links = [from, to, 'go' | 'wait'], ln = code lines to highlight. */
  const T_RUN = 's-thread', T_BLK = 's-warn', T_OK = 's-ok';
  const TECH = [
    { key: 'file', name: 'Signal the file object', short: '1 · File object', term: 'File object',
      good: 'One request at a time on a file, plus some other work to do before the data is needed. Nothing to create: the file object is already there.',
      limit: 'Every operation on that file signals the same object, so with two requests in progress the thread cannot tell which one finished.',
      code: [
        'ov.Offset = 0;                      // read from the file\'s start',
        'ReadFile(f, buf, 4096, NULL, &ov);  // start it; returns at once',
        'do_other_work();                    // runs while the disk is busy',
        'WaitForSingleObject(f, INFINITE);   // sleep till file is signaled',
        'GetOverlappedResult(f, &ov, &n, 0); // collect the byte count, n',
      ],
      frames: [
        { th: [['T', 'Thread T', 'calls ReadFile', T_RUN]], mid: [['F', 'File object', 'not signaled', 's-os']], dev: ['Disk', 'reading', 's-io'], links: [['T', 'D', 'go']], ln: [1, 2], cap: 'The file was opened for overlapped I/O. Thread T calls <b>ReadFile</b>; the call starts the read and returns at once.' },
        { th: [['T', 'Thread T', 'working', T_RUN]], mid: [['F', 'File object', 'not signaled', 's-os']], dev: ['Disk', 'reading', 's-io'], links: [], ln: [3], cap: 'T does useful work while the disk reads. Nobody is waiting yet.' },
        { th: [['T', 'Thread T', 'blocked', T_BLK]], mid: [['F', 'File object', 'not signaled', 's-os']], dev: ['Disk', 'reading', 's-io'], links: [['T', 'F', 'wait']], ln: [4], cap: 'T now needs the data, so it waits on the <b>file handle itself</b>. The file object is not signaled, so T blocks.' },
        { th: [['T', 'Thread T', 'running again', T_OK]], mid: [['F', 'File object', 'SIGNALED', 's-ok']], dev: ['Disk', 'idle', 's-panel'], links: [['D', 'F', 'go']], ln: [5], cap: 'The read completes: the I/O manager sets the <b>file object</b> to signaled, T wakes up and collects the result.' },
      ] },
    { key: 'event', name: 'Signal an event object', short: '2 · Event objects', term: 'Event object',
      good: 'Several requests in progress at once on one file or device, where the thread must know exactly which ones are done.',
      limit: 'One event to create and manage per request, and a thread can wait on at most 64 objects in one call.',
      code: [
        'ov1.hEvent = CreateEvent(NULL, TRUE, FALSE, NULL); // E1, unsignaled',
        'ov2.hEvent = CreateEvent(NULL, TRUE, FALSE, NULL); // E2, unsignaled',
        'ReadFile(f, a, 4096, NULL, &ov1);   // read 1 (ov1.Offset = 0)',
        'ReadFile(f, b, 4096, NULL, &ov2);   // read 2 (ov2.Offset = 65536)',
        'do_other_work();                    // both reads are in progress',
        'HANDLE ev[2] = { ov1.hEvent, ov2.hEvent }; // the events to watch',
        'i = WaitForMultipleObjects(2, ev, FALSE, INFINITE); // any one',
        'use_result(i);                      // i says which read is done',
      ],
      frames: [
        { th: [['T', 'Thread T', 'starts 2 reads', T_RUN]], mid: [['E1', 'Event E1', 'read 1: not set', 's-os'], ['E2', 'Event E2', 'read 2: not set', 's-os']], dev: ['Disk', 'reading 1, 2', 's-io'], links: [['T', 'D', 'go']], ln: [1, 2, 3, 4], cap: 'T gives each request its <b>own event object</b>, then starts two reads of different parts of the same file.' },
        { th: [['T', 'Thread T', 'working', T_RUN]], mid: [['E1', 'Event E1', 'read 1: not set', 's-os'], ['E2', 'Event E2', 'read 2: not set', 's-os']], dev: ['Disk', 'reading 1, 2', 's-io'], links: [], ln: [5], cap: 'Both reads are in progress while T keeps working.' },
        { th: [['T', 'Thread T', 'blocked', T_BLK]], mid: [['E1', 'Event E1', 'read 1: not set', 's-os'], ['E2', 'Event E2', 'read 2: not set', 's-os']], dev: ['Disk', 'reading 1, 2', 's-io'], links: [['T', 'E1', 'wait'], ['T', 'E2', 'wait']], ln: [6, 7], cap: 'T waits until <b>any one</b> of the two events is set (it could also ask to wait for all of them).' },
        { th: [['T', 'Thread T', 'knows: read 2', T_OK]], mid: [['E1', 'Event E1', 'read 1: not set', 's-os'], ['E2', 'Event E2', 'SET', 's-ok']], dev: ['Disk', 'busy with 1', 's-io'], links: [['D', 'E2', 'go']], ln: [8], cap: 'Read 2 finishes first, so only <b>E2</b> is set. T wakes up knowing exactly which request is done; read 1 is still in progress.' },
      ] },
    { key: 'apc', name: 'Asynchronous procedure call', short: '3 · APC', term: 'Asynchronous procedure call (APC)',
      good: 'A thread that wants its own routine run for each finished request, on its own thread, without creating any wait objects.',
      limit: 'The routine runs only when the thread enters an alertable wait. A thread that never waits that way never sees its completions.',
      code: [
        'VOID CALLBACK done(DWORD e, DWORD n, OVERLAPPED *o) // completion',
        '{ use(buf, n); }                    // routine: runs later, in T',
        'ReadFileEx(f, buf, 4096, &ov, done); // start; name the routine',
        'do_other_work();                    // done() cannot run during this',
        'SleepEx(INFINITE, TRUE);            // alertable wait: done() runs',
      ],
      frames: [
        { th: [['T', 'Thread T', 'ReadFileEx()', T_RUN]], mid: [['Q', 'T\'s APC queue', 'empty', 's-thread']], dev: ['Disk', 'reading', 's-io'], links: [['T', 'D', 'go']], ln: [1, 2, 3], cap: 'T calls <b>ReadFileEx</b> and names a <b>completion routine</b>, done(). The call returns at once.' },
        { th: [['T', 'Thread T', 'working', T_RUN]], mid: [['Q', 'T\'s APC queue', 'call done()', 's-warn']], dev: ['Disk', 'idle', 's-panel'], links: [['D', 'Q', 'go']], ln: [4], cap: 'The read completes while T is busy. The I/O manager puts an <b>APC</b>, “run done() for this read”, on T\'s own queue. T is not interrupted.' },
        { th: [['T', 'Thread T', 'alertable wait', T_BLK]], mid: [['Q', 'T\'s APC queue', 'call done()', 's-warn']], dev: ['Disk', 'idle', 's-panel'], links: [['T', 'Q', 'wait']], ln: [5], cap: 'T enters an <span class="t">alertable wait</span>. That is its way of saying: “I am idle; run my queued routines now.”' },
        { th: [['T', 'Thread T', 'runs done()', T_OK]], mid: [['Q', 'T\'s APC queue', 'empty', 's-thread']], dev: ['Disk', 'idle', 's-panel'], links: [['Q', 'T', 'go']], ln: [1, 2], cap: 'The kernel runs done() <b>inside T</b>, then SleepEx returns. Completion work always happens on the thread that asked for the I/O.' },
      ] },
    { key: 'port', name: 'I/O completion port', short: '4 · Completion port', term: 'I/O completion port',
      good: 'Servers with thousands of connections: a few worker threads serve every completion, and the kernel lets only about as many run at once as there are processors.',
      limit: 'More setup and a different program structure (a pool of workers and a loop), which is overkill for a program with a handful of requests.',
      code: [
        'port = CreateIoCompletionPort(INVALID_HANDLE_VALUE, // a new port',
        '         NULL, 0, 0);               // 0 = one runner per processor',
        'CreateIoCompletionPort(sock, port, client, 0); // attach a client',
        'for (;;) {                          // what every pool worker does:',
        '  GetQueuedCompletionStatus(port, &n, // sleep until ANY I/O on',
        '      &client, &ov, INFINITE);      // the port has completed',
        '  serve(client, ov, n);             // handle it, then loop again',
        '}                                   // (workers never leave)',
      ],
      frames: [
        { th: [['W1', 'Worker 1', 'asleep on port', T_BLK], ['W2', 'Worker 2', 'asleep on port', T_BLK], ['W3', 'Worker 3', 'asleep on port', T_BLK]], mid: [['P', 'Completion port', 'queue empty', 's-os']], dev: ['Network', 'many clients', 's-io'], links: [['W1', 'P', 'wait'], ['W2', 'P', 'wait'], ['W3', 'P', 'wait']], ln: [1, 2, 3], cap: 'A server on a 2-processor machine ties every client connection to one <b>completion port</b> and starts a small pool of worker threads, all waiting on it.' },
        { th: [['W1', 'Worker 1', 'asleep on port', T_BLK], ['W2', 'Worker 2', 'asleep on port', T_BLK], ['W3', 'Worker 3', 'asleep on port', T_BLK]], mid: [['P', 'Completion port', 'queue empty', 's-os']], dev: ['Network', 'reads pending', 's-io'], links: [['W1', 'P', 'wait'], ['W2', 'P', 'wait'], ['W3', 'P', 'wait']], ln: [4, 5, 6], cap: 'Reads on hundreds of connections are in progress. There is no thread per client: the workers simply sleep on the port.' },
        { th: [['W1', 'Worker 1', 'serving A', T_OK], ['W2', 'Worker 2', 'serving B', T_OK], ['W3', 'Worker 3', 'asleep on port', T_BLK]], mid: [['P', 'Completion port', 'queue: C', 's-warn']], dev: ['Network', 'A, B, C done', 's-io'], links: [['D', 'P', 'go'], ['P', 'W1', 'go'], ['P', 'W2', 'go']], ln: [7], cap: 'Three reads complete (clients A, B, C). The port queues them, but the kernel releases only <b>2 workers</b>, one per processor; C waits in the queue.' },
        { th: [['W1', 'Worker 1', 'serving C', T_OK], ['W2', 'Worker 2', 'serving B', T_OK], ['W3', 'Worker 3', 'asleep on port', T_BLK]], mid: [['P', 'Completion port', 'queue empty', 's-os']], dev: ['Network', 'reads pending', 's-io'], links: [['P', 'W1', 'go']], ln: [5, 6, 7], cap: 'Worker 1 finishes A, asks again and takes C at once, without sleeping. Worker 3 never had to run at all: fewer threads and fewer context switches.' },
      ] },
    { key: 'poll', name: 'Polling', short: '5 · Polling', term: 'Polling',
      good: 'A loop that runs anyway, such as a game frame or a control loop, and must never block: it can glance at the status between its other jobs.',
      limit: 'Check too often and the thread burns processor time; check too rarely and finished data sits unused.',
      code: [
        'ReadFile(f, buf, 4096, NULL, &ov);  // start; status goes into ov',
        'while (!HasOverlappedIoCompleted(&ov)) // peek at our own memory',
        '    do_a_little_work();             // something useful meanwhile',
        'GetOverlappedResult(f, &ov, &n, FALSE); // finished: read the count',
      ],
      frames: [
        { th: [['T', 'Thread T', 'calls ReadFile', T_RUN]], mid: [['S', 'OVERLAPPED', 'status: pending', 's-mem']], dev: ['Disk', 'reading', 's-io'], links: [['T', 'D', 'go']], ln: [1], cap: 'T starts a read. The status of the request lives in an <b>OVERLAPPED record in T\'s own memory</b>.' },
        { th: [['T', 'Thread T', 'polls: pending', T_RUN]], mid: [['S', 'OVERLAPPED', 'status: pending', 's-mem']], dev: ['Disk', 'reading', 's-io'], links: [['T', 'S', 'wait']], ln: [2, 3], cap: 'Between pieces of other work, T <b>polls</b>: it looks at the status. Still pending, so it goes back to work. It never blocks.' },
        { th: [['T', 'Thread T', 'working', T_RUN]], mid: [['S', 'OVERLAPPED', 'done: 4,096 bytes', 's-ok']], dev: ['Disk', 'idle', 's-panel'], links: [['D', 'S', 'go']], ln: [3], cap: 'The read completes. The system writes “success, 4,096 bytes” into the record. Nobody is woken: nobody was waiting.' },
        { th: [['T', 'Thread T', 'sees: done', T_OK]], mid: [['S', 'OVERLAPPED', 'done: 4,096 bytes', 's-ok']], dev: ['Disk', 'idle', 's-panel'], links: [['T', 'S', 'wait']], ln: [2, 4], cap: 'T\'s next check sees the finished status, leaves the loop and uses the data.' },
      ] },
  ];

  Guide.section({
    id: '11.10',
    title: 'Windows I/O',
    short: 'Windows I/O',
    summary: 'How Windows routes all I/O through one manager, caches lazily, signals completion and protects volumes.',
    objectives: [
      'Name the four kinds of modules the Windows I/O manager works with and trace a read or a write through them.',
      'Explain how the cache manager uses lazy write and lazy commit, and what that speed costs if the power fails.',
      'Compare synchronous and asynchronous I/O, and pick the right one of the five ways Windows reports that an asynchronous request finished.',
      'Contrast hardware RAID with software RAID, and describe what volume shadow copies and BitLocker do for a whole volume.',
    ],
    terms: [
      ['I/O manager', 'The part of the Windows executive that receives every I/O request, normally describes it in an I/O request packet and hands it to the right driver, so programs see one uniform interface for files, devices and networks.'],
      ['I/O request packet (IRP)', 'The record the I/O manager builds for one I/O request: the operation (read, write...), the file or device, the buffer and the byte count. Drivers pass it down their stack and mark it complete when the work is done.'],
      ['Cache manager', 'The Windows component that keeps recently used file data in main memory for every file system, local or network. The cache grows and shrinks with the amount of free memory.'],
      ['Lazy write', 'Accepting a write into the cache, returning to the program at once, and copying the changed data to disk later in the background, when the system is less busy.'],
      ['Lazy commit', 'The transaction version of lazy write: the record that a transaction committed is kept in the cache and written to the file system log later by a background thread, instead of immediately.'],
      ['File system driver', 'A driver that implements one file system, such as NTFS or FAT. The I/O manager treats it like any other driver; it turns file requests into requests for blocks of the volume and passes them to the drivers below.'],
      ['Network driver', 'One of the drivers that give Windows its built-in networking: the redirector that makes remote files look local (using the SMB protocol), protocol drivers such as TCP/IP, and the drivers of network adapters.'],
      ['Hardware device driver', 'A driver that operates one physical device. It reaches the device\'s registers only through routines of the hardware abstraction layer, so the same driver source works on every platform Windows supports.'],
      ['Synchronous I/O', 'I/O in which the calling thread is blocked until the operation is finished: when the call returns, the data has been transferred.'],
      ['Asynchronous I/O (overlapped I/O)', 'I/O in which the call only starts the operation and returns at once, so the thread keeps working; the system must later tell the thread that the operation finished.'],
      ['File object', 'The kernel object that stands for one open instance of a file or device. It is waitable: it becomes signaled when an I/O operation on it completes.'],
      ['Event object', 'A Windows object that is either signaled or not; threads wait on it and are released when it is set, by another thread or, for I/O, by the I/O manager. One event per request lets a thread tell several pending requests apart.'],
      ['Asynchronous procedure call (APC)', 'A routine queued to one particular thread, to be run by that thread. For I/O, the I/O manager queues the program\'s completion routine, which runs when the thread next enters an alertable wait.'],
      ['Alertable wait', 'A wait, such as SleepEx with its alertable flag set, during which a thread agrees to run any APCs queued to it. The wait ends as soon as they have run.'],
      ['I/O completion port', 'A kernel queue of finished I/O operations served by a pool of worker threads. Each worker takes one completion at a time, and the kernel keeps only about as many workers running as there are processors.'],
      ['Volume', 'A storage area that holds one file system and has its own drive letter or folder: part of one disk, a whole disk, or space combined from several disks.'],
      ['Hardware RAID', 'RAID done by a disk controller or storage cabinet: it combines several physical disks and keeps the redundant data itself, so Windows sees just one disk.'],
      ['Software RAID', 'RAID done by the operating system: a Windows driver combines space from several disks, mirrors or computes parity in software, and presents the result as one volume.'],
      ['Volume shadow copy', 'A point-in-time view of a whole volume: the volume exactly as it was at one moment, used for consistent backups and for recovering earlier versions of files. How it is stored depends on the provider; the built-in Windows system provider uses copy on write.'],
      ['BitLocker', 'Windows full-volume encryption: a driver below the file system encrypts every sector written to the volume and decrypts every sector read, so a stolen disk shows only scrambled data.'],
    ],
    css: `
      .sec-11-10 .narr { background: var(--panel-2); border: 1px solid var(--line); border-left: 5px solid var(--chc); border-radius: 12px; padding: 9px 13px; font-size: 15px; line-height: 1.45; }
      .sec-11-10 .narr.ok { border-left-color: var(--ok); background: var(--ok-bg); }
      .sec-11-10 .narr.bad { border-left-color: var(--bad); background: var(--bad-bg); }
      .sec-11-10 .hot { cursor: pointer; outline: none; }
      .sec-11-10 .hot .fr { transition: stroke-width .15s; }
      .sec-11-10 .hot:hover .fr, .sec-11-10 .hot:focus-visible .fr { stroke-width: 3.5; }
      .sec-11-10 .hot.sel .fr { stroke-width: 4.5; }
      .sec-11-10 .lw-grid { display: grid; gap: 2px 2px; align-items: center; }
      .sec-11-10 .lw-hd { font-size: 12.5px; color: var(--muted); height: 16px; white-space: nowrap; font-variant-numeric: tabular-nums; }
      .sec-11-10 .lw-lab { font-weight: 800; text-align: center; }
      .sec-11-10 .lw-cell { height: 30px; min-width: 0; padding: 0; border: 1px solid var(--line-2); border-radius: 5px; background: var(--panel-2); cursor: pointer; font-size: 14px; font-weight: 800; color: var(--ink); }
      .sec-11-10 .lw-cell:hover { border-color: var(--accent); }
      .sec-11-10 .lw-cell:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
      .sec-11-10 .lw-cell.fl, .sec-11-10 .lw-hd.fl { box-shadow: -3px 0 0 var(--thread); }
      .sec-11-10 .lw-cell.end { box-shadow: 3px 0 0 var(--thread); }
      .sec-11-10 .lw-cell.on { background: var(--mem-bg); border-color: var(--mem); color: var(--mem); }
      .sec-11-10 .lw-cell.on.lost { background: var(--bad-bg); border-color: var(--bad); color: var(--bad); }
      .sec-11-10 .lw-cell.fut { opacity: .5; background-image: repeating-linear-gradient(45deg, transparent 0 4px, var(--line) 4px 6px); }
      .sec-11-10 .bad-t { color: var(--bad); }
      .sec-11-10 .ok-t { color: var(--ok); }
      .sec-11-10 .btn.pk-ok { border-color: var(--ok); background: var(--ok-bg); color: var(--ok); }
      .sec-11-10 .btn.pk-bad { border-color: var(--bad); background: var(--bad-bg); color: var(--bad); }
      .sec-11-10 .pk-row { justify-content: flex-start; width: 100%; height: auto; min-height: 46px; padding: 4px 10px; text-align: left; }
      .sec-11-10 .btn.pk-opt { height: auto; min-height: 54px; flex-direction: column; gap: 1px; white-space: normal; padding: 6px 10px; }
      .sec-11-10 .pk-hint { font-weight: 500; color: var(--muted); }
      .sec-11-10 .vs-row { display: grid; grid-template-columns: 92px repeat(6, minmax(0, 1fr)); gap: 6px; align-items: center; }
      .sec-11-10 .vs-lab { font-size: 13px; font-weight: 700; color: var(--ink-2); }
      .sec-11-10 .vs-blk { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 58px; padding: 0; border-radius: 8px; border: 2px solid var(--line-2); background: var(--panel-2); color: var(--ink); font: inherit; min-width: 0; }
      .sec-11-10 .vs-blk b { font-size: 18px; line-height: 1.1; }
      .sec-11-10 button.vs-blk { cursor: pointer; }
      .sec-11-10 button.vs-blk:hover, .sec-11-10 button.vs-blk:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
      .sec-11-10 .vs-blk.live { border-color: var(--io); background: var(--io-bg); }
      .sec-11-10 .vs-blk.chg { border-color: var(--warn); background: var(--warn-bg); }
      .sec-11-10 .vs-blk.saved { border-color: var(--mem); background: var(--mem-bg); }
      .sec-11-10 .vs-blk.empty { border-style: dashed; background: transparent; color: var(--muted); }
      .sec-11-10 .vs-hex { font-size: 13.5px; word-break: break-all; }
      .sec-11-10 .cw-code.slim pre.code .ln { white-space: pre-wrap; overflow-wrap: anywhere; }
    `,
    steps: [
      /* ---------------- 1. Big picture: one hub, four kinds of helpers ---------------- */
      {
        title: 'One hub for every request',
        kind: 'story',
        html: `
          <div class="split l fill">
            <div class="stack" style="gap:9px">
              <p class="lead m0">On Windows, every read and write, whether it goes to a disk, a USB stick, a printer or a file on another computer, passes through one hub: the <span class="t">I/O manager</span>.</p>
              <p class="m0">Windows must drive thousands of different devices and several file systems, and reach files across a network too. Rather than teach every program about every device, it gives programs one small interface (open, read, write, close) and lets the I/O manager route each request to the module that knows how to do it. This section follows those requests all the way down and back.</p>
              <div class="callout analogy m0" data-label="Analogy">A parcel hub. Every parcel gets the same standard label, whatever is inside. The hub never opens a parcel; it reads the label and hands it to the right carrier: the local van, the air-freight desk or a specialist courier. In Windows the label is an <span class="t">I/O request packet (IRP)</span>.</div>
              <div class="row gap-s small"><span class="chip os">trace a request</span><span class="chip mem">lazy write vs a power cut</span><span class="chip thread">sync vs async</span><span class="chip intr">completion signals</span><span class="chip io">RAID and snapshots</span></div>
            </div>
            <div class="card stack" style="gap:8px">
              <div class="row" style="justify-content:space-between"><h4 class="m0">The I/O manager and its helpers</h4><span class="xs muted">click a box</span></div>
              <div class="io-map"></div>
              <div class="card white grow io-detail" style="display:flex;flex-direction:column;gap:5px"></div>
            </div>
          </div>`,
        render(el, ctx) {
          const { h, s } = ctx;
          const slim = ctx.narrow;
          const parts = {
            app: ['Application', 's-proc', 'proc', 'A program calls <code>ReadFile</code> or <code>WriteFile</code> with a handle and a buffer. It never talks to a driver or a device itself, and the same calls work for a local file, a remote file or a device.', 'Step 2 follows such a call.'],
            iom: ['I/O manager', 's-os', 'os', 'Part of the <span class="t">executive</span>. It checks the handle and the buffer, describes the request in an <span class="t">I/O request packet (IRP)</span> and sends it to the top driver for that file or device. When a driver marks the IRP complete, it hands back the result and tells the caller. Disk, share or keyboard: to the I/O manager they all look alike.', 'Every step of this section.'],
            cc: ['Cache manager', 's-mem', 'mem', 'Caches file data for the whole I/O subsystem: every file system, local or network, shares one cache in main memory. The cache grows when memory is free and shrinks when programs need memory. It makes writes cheap with <span class="t">lazy write</span>, and transactions cheap with <span class="t">lazy commit</span>.', 'Step 3: lazy write against a power cut.'],
            fsd: ['File system drivers', 's-os', 'os', 'NTFS, FAT, exFAT and others. The I/O manager routes a request for a volume to that volume\'s <span class="t">file system driver</span> exactly as it would to any device driver. The file system turns “bytes 8,192 to 12,287 of report.docx” into “these blocks of the volume” and sends that to the drivers below it.', 'Step 2 (the request path).'],
            hw: ['Hardware device drivers', 's-io', 'io', 'One for each kind of device: disk, USB controller, network card, graphics. A <span class="t">hardware device driver</span> touches the device\'s registers only through entry points of the <span class="t">hardware abstraction layer (HAL)</span>. Those routines have the same names on every platform, so the driver\'s source code carries over from one processor type to another.', 'Step 2 (the bottom of the path).'],
            net: ['Network drivers', 's-os', 'os', 'Networking is built in. The redirector makes files on another computer look local (it speaks the SMB file-sharing protocol), TCP/IP is a protocol driver, and each network adapter has its own driver. All of them are <span class="t">network driver</span>s that the I/O manager routes to, not code inside the executive.', 'Step 2: “Read from a share”.'],
            hal: ['Hardware abstraction layer', 's-os', 'os', 'The thin layer that hides how one platform wires up its buses, interrupt controller and DMA. Drivers call its routines instead of touching the platform directly.', 'Volume 1 (Windows architecture).'],
          };
          const W = slim
            ? { vb: '0 0 360 372', app: [70, 6, 220, 38], line: 56, iom: [6, 66, 348, 42], cc: [6, 128, 168, 48], fsd: [186, 128, 168, 48], hw: [6, 190, 168, 48], net: [186, 190, 168, 48], hal: [6, 258, 348, 36], mem: [6, 314, 110, 52], disk: [125, 314, 110, 52], nic: [244, 314, 110, 52] }
            : { vb: '0 0 620 282', app: [160, 4, 300, 34], line: 48, iom: [10, 56, 600, 40], cc: [10, 120, 140, 50], fsd: [163, 120, 140, 50], hw: [316, 120, 140, 50], net: [469, 120, 141, 50], hal: [163, 192, 447, 32], mem: [10, 192, 140, 86], disk: [163, 244, 140, 34], usb: [316, 244, 140, 34], nic: [469, 244, 141, 34] };
          const svg = s('svg', { viewBox: W.vb, width: '100%', role: 'img', 'aria-label': 'The Windows I/O manager and the modules it routes requests to' });
          const map = ctx.$('.io-map'), detail = ctx.$('.io-detail');
          map.append(svg);
          let sel = 'iom';
          const L = {
            app: ['Application'], iom: ['I/O manager', 'builds an IRP for every request'], cc: ['Cache manager', 'file data in RAM'],
            fsd: ['File system', 'drivers (NTFS…)'], hw: ['Hardware device', 'drivers'], net: ['Network drivers', 'redirector, TCP/IP'],
            hal: ['Hardware abstraction layer (HAL)'],
          };
          function draw() {
            const k = [];
            const mid = (r) => r[0] + r[2] / 2, bot = (r) => r[1] + r[3];
            k.push(s('line', { x1: 4, y1: W.line, x2: slim ? 356 : 616, y2: W.line, class: 's-muted', 'stroke-dasharray': '6 5' }));
            k.push(s('text', { x: slim ? 356 : 616, y: W.line - 5, 'text-anchor': 'end', 'font-size': 13, class: 's-sub' }, 'user mode ↑   kernel mode ↓'));
            k.push(arrow(s, mid(W.app), bot(W.app), mid(W.app), W.iom[1] - 2));
            ['cc', 'fsd', 'hw', 'net'].forEach((id) => k.push(arrow(s, mid(W[id]), bot(W.iom), mid(W[id]), W[id][1] - 2, 's-line', 'arr')));
            if (!slim) {
              k.push(arrow(s, W.fsd[0] - 1, 138, W.cc[0] + W.cc[2] + 2, 138, 's-line', 'arr'));
              k.push(arrow(s, W.fsd[0] + W.fsd[2], 152, W.hw[0] - 2, 152, 's-line', 'arr'));
              k.push(arrow(s, W.net[0], 152, W.hw[0] + W.hw[2] + 2, 152, 's-line', 'arr'));
              k.push(arrow(s, mid(W.cc), bot(W.cc), mid(W.cc), W.mem[1] - 2, 's-line', 'arr'));
              k.push(arrow(s, mid(W.hw), bot(W.hw), mid(W.hw), W.hal[1] - 2, 's-line', 'arr'));
              [W.disk, W.usb, W.nic].forEach((r) => k.push(arrow(s, mid(r), bot(W.hal), mid(r), r[1] - 2, 's-line', 'arr')));
            }
            Object.keys(L).forEach((id) => {
              const p = parts[id];
              k.push(hot(s, p[0], sel === id, () => { sel = id; draw(); show(); }, box(s, W[id], p[1], L[id], { fs: slim ? 13.5 : 14 })));
            });
            k.push(box(s, W.mem, 's-mem', slim ? ['Main', 'memory'] : ['Main memory', 'holds the', 'cached data'], { fs: 13.5, dash: '5 4' }));
            k.push(box(s, W.disk, 's-io', ['Disk'], { fs: 13.5, dash: '5 4' }));
            if (W.usb) k.push(box(s, W.usb, 's-io', ['USB, GPU…'], { fs: 13.5, dash: '5 4' }));
            k.push(box(s, W.nic, 's-io', slim ? ['Network', 'card'] : ['Network card'], { fs: 13.5, dash: '5 4' }));
            svg.replaceChildren(...k);
          }
          function show() {
            const p = parts[sel];
            detail.innerHTML = '';
            detail.append(
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', { style: { fontSize: '18px' } }, p[0]), h('span', { class: 'chip ' + p[2] }, p[2] === 'proc' ? 'user mode' : 'kernel mode')),
              h('p', { class: 'small m0', html: p[3] }),
              h('p', { class: 'xs muted m0' }, 'Where you meet it: ' + p[4]));
            ctx.refit();
          }
          draw(); show();
        },
      },

      /* ---------------- 2. Follow one request down the stack and back ---------------- */
      {
        title: 'Follow a request down the stack and back',
        kind: 'explore',
        core: true,
        render(el, ctx) {
          const { h, s } = ctx;
          const slim = ctx.narrow;
          const G = slim
            ? { vb: '0 0 360 390', line: 50, app: [70, 2, 220, 36], iom: [4, 60, 352, 36], lw: [4, 122, 114, 40], fsd: [123, 122, 114, 40], rdr: [242, 122, 114, 40], cc: [4, 182, 114, 40], dd: [123, 182, 114, 40], tcp: [242, 182, 114, 40], ram: [4, 242, 114, 40], nd: [242, 242, 114, 40], hal: [123, 304, 233, 30], disk: [123, 354, 114, 34], nic: [242, 354, 114, 34] }
            : { vb: '0 0 632 346', line: 50, app: [166, 2, 300, 36], iom: [8, 62, 616, 36], cc: [8, 126, 140, 40], fsd: [160, 126, 150, 40], lw: [322, 126, 140, 40], rdr: [474, 126, 150, 40], ram: [8, 190, 140, 40], dd: [160, 190, 150, 40], tcp: [322, 190, 140, 40], nd: [474, 190, 150, 40], hal: [160, 256, 464, 30], disk: [160, 310, 150, 34], nic: [474, 310, 150, 34] };
          const NODES = {
            app: ['s-proc', ['Application', 'ReadFile / WriteFile']], iom: ['s-os', ['I/O manager', 'builds, routes and completes IRPs']],
            cc: ['s-mem', ['Cache manager']], fsd: ['s-os', ['File system', 'driver (NTFS)']], lw: ['s-thread', ['Lazy writer', 'thread']],
            rdr: ['s-os', ['Redirector', 'SMB client']], ram: ['s-mem', ['Main memory', 'cache pages']], dd: ['s-io', ['Disk drivers', 'volume + disk']],
            tcp: ['s-os', ['TCP/IP', 'driver']], nd: ['s-io', ['Network card', 'driver']], hal: ['s-os', [slim ? 'HAL' : 'Hardware abstraction layer (HAL)']],
            disk: ['s-io', ['Disk']], nic: ['s-io', ['Network card']],
          };
          const TH = { call: ['proc', 'thread: calling'], k: ['os', 'thread: inside the call, running'], blk: ['warn', 'thread: blocked, waiting for the device'], ret: ['ok', 'thread: call returned, back to work'] };
          const SC = {
            hit: { label: 'Read: in the cache', f: [
              { on: ['app'], a: [], th: 'call', cap: 'The program calls <b>ReadFile</b> for 4 KB of report.docx. It passes a handle (which open file) and a buffer (where the bytes should land).' },
              { on: ['app', 'iom'], a: [['app', 'iom']], th: 'k', cap: 'The <b>I/O manager</b> checks the handle and the buffer and builds an IRP: read, this file object, offset 8,192, 4,096 bytes, into this buffer.' },
              { on: ['iom', 'fsd'], a: [['iom', 'fsd']], th: 'k', cap: 'Requests for this volume go to its file system driver, NTFS. The I/O manager routes to it exactly as it would to any device driver.' },
              { on: ['fsd', 'cc', 'ram'], a: [['fsd', 'cc'], ['cc', 'ram']], th: 'k', ram: 'hit', cap: 'The file is cached, so NTFS asks the <b>cache manager</b> for those bytes. They are already in main memory: a <b>cache hit</b>.' },
              { on: ['cc', 'fsd', 'iom', 'app'], a: [['cc', 'fsd'], ['fsd', 'iom'], ['iom', 'app']], th: 'ret', cap: 'The bytes are copied into the program\'s buffer, the IRP is completed and ReadFile returns. No disk, no interrupt: microseconds. (Windows even has a “fast I/O” shortcut that serves such cached reads without building an IRP.)' },
            ] },
            miss: { label: 'Read: not cached', f: [
              { on: ['app'], a: [], th: 'call', cap: 'The program calls <b>ReadFile</b> for 4 KB of a file it has not touched for a while.' },
              { on: ['app', 'iom', 'fsd'], a: [['app', 'iom'], ['iom', 'fsd']], th: 'k', cap: 'The I/O manager builds an IRP and routes it to NTFS, the file system driver for this volume.' },
              { on: ['fsd', 'cc', 'ram'], a: [['fsd', 'cc'], ['cc', 'ram']], th: 'k', ram: 'miss', cap: 'NTFS asks the cache manager. This time the bytes are not in main memory: a <b>cache miss</b>.' },
              { on: ['cc', 'fsd'], a: [['cc', 'fsd']], th: 'k', cap: 'Copying from the missing cache page causes a page fault. The memory manager answers it with a <b>paging read</b>: a new IRP that goes back to NTFS for that piece of the file.' },
              { on: ['fsd', 'dd'], a: [['fsd', 'dd']], th: 'k', cap: 'NTFS translates “offset 8,192 of report.docx” into a block number on the volume and passes the request to the disk drivers.' },
              { on: ['dd', 'hal', 'disk'], a: [['dd', 'hal'], ['hal', 'disk']], th: 'blk', cap: 'The disk driver programs the controller through HAL routines and starts a DMA transfer. The thread is <b>blocked</b>; the processor runs other threads meanwhile.' },
              { on: ['disk', 'hal', 'dd', 'ram'], a: [['disk', 'hal'], ['hal', 'dd']], th: 'blk', ram: 'filled', cap: 'Several milliseconds later on a hard disk (about a tenth of a millisecond on an SSD) the disk raises an interrupt. The data is now in a cache page, and the driver completes the paging IRP.' },
              { on: ['ram', 'cc', 'fsd', 'iom', 'app'], a: [['ram', 'cc'], ['cc', 'fsd'], ['fsd', 'iom'], ['iom', 'app']], th: 'ret', ram: 'filled', cap: 'The cache manager copies the bytes into the program\'s buffer, the original IRP completes and ReadFile returns. Read these bytes again soon and it will be a hit.' },
            ] },
            write: { label: 'Write: lazy write', f: [
              { on: ['app'], a: [], th: 'call', cap: 'The program calls <b>WriteFile</b> with 4 KB of new text for report.docx.' },
              { on: ['app', 'iom', 'fsd'], a: [['app', 'iom'], ['iom', 'fsd']], th: 'k', cap: 'The I/O manager builds an IRP (write, this file, this offset, this buffer) and routes it to NTFS.' },
              { on: ['fsd', 'cc', 'ram'], a: [['fsd', 'cc'], ['cc', 'ram']], th: 'k', ram: 'dirty', cap: 'NTFS hands the bytes to the cache manager, which copies them into a cache page and marks the page <b>dirty</b>: changed in memory, not yet on disk.' },
              { on: ['cc', 'fsd', 'iom', 'app'], a: [['cc', 'fsd'], ['fsd', 'iom'], ['iom', 'app']], th: 'ret', ram: 'dirty', cap: 'WriteFile returns at once. Any later read gets the new bytes from the cache, so for the program the write is done. The disk has not been touched.' },
              { on: ['lw', 'ram'], a: [], th: 'ret', ram: 'dirty', cap: 'About a second later the cache manager\'s <b>lazy writer</b> thread wakes up and picks dirty pages to write out. This is <b>lazy write</b>.' },
              { on: ['lw', 'fsd', 'dd'], a: [['lw', 'fsd'], ['fsd', 'dd']], th: 'ret', ram: 'dirty', cap: 'It sends a write for the dirty page down through NTFS to the disk drivers. Nobody is waiting for it: the program moved on long ago.' },
              { on: ['dd', 'hal', 'disk'], a: [['dd', 'hal'], ['hal', 'disk']], th: 'ret', ram: 'dirty', cap: 'The disk driver starts the transfer through the HAL. If the power failed right now, this update would be lost: it exists only in memory.' },
              { on: ['disk', 'hal', 'dd', 'ram'], a: [['disk', 'hal'], ['hal', 'dd']], th: 'ret', ram: 'clean', cap: 'The disk interrupts, the write is complete and the page is clean again. Had the program changed this page ten times in that second, one disk write would have carried all ten.' },
            ] },
            net: { label: 'Read from a share', f: [
              { on: ['app'], a: [], th: 'call', cap: 'The program reads <code>\\\\server\\docs\\plan.txt</code>, a file on another computer. It makes the very same ReadFile call as for a local file.' },
              { on: ['app', 'iom', 'rdr'], a: [['app', 'iom'], ['iom', 'rdr']], th: 'k', cap: 'This file object belongs to the <b>redirector</b>, so the I/O manager sends the IRP there. To the I/O manager the redirector is just another file system driver.' },
              { on: ['rdr', 'tcp'], a: [['rdr', 'tcp']], th: 'k', cap: 'The data is not cached (the cache manager serves remote files too), so the redirector turns the read into an SMB “read” message for the server and passes it to the TCP/IP driver.' },
              { on: ['tcp', 'nd', 'hal', 'nic'], a: [['tcp', 'nd'], ['nd', 'hal'], ['hal', 'nic']], th: 'blk', cap: 'TCP/IP wraps the message in packets; the network card\'s driver hands them to the card through HAL routines. The thread is blocked while the server does its own disk work.' },
              { on: ['nic', 'hal', 'nd', 'tcp', 'rdr'], a: [['nic', 'hal'], ['hal', 'nd'], ['nd', 'tcp'], ['tcp', 'rdr']], th: 'blk', cap: 'The reply arrives, the card interrupts, and the packets travel back up through the adapter driver and TCP/IP to the redirector.' },
              { on: ['rdr', 'iom', 'app'], a: [['rdr', 'iom'], ['iom', 'app']], th: 'ret', cap: 'The redirector copies the data into the buffer and completes the IRP. ReadFile returns, and the program never learns that the file was remote.' },
            ] },
          };
          let sc = 'hit';
          const svg = s('svg', { viewBox: G.vb, width: '100%', role: 'img', 'aria-label': 'Layers an I/O request passes through' });
          const thChip = h('span', { class: 'chip' });
          const devChip = h('span', { class: 'chip' });
          const ctr = (r) => [r[0] + r[2] / 2, r[1] + r[3] / 2];
          function link(a, b) {
            const A = G[a], B = G[b], [ax, ay] = ctr(A), [bx, by] = ctr(B);
            if (Math.abs(ay - by) < 4) { const right = bx > ax; return arrow(s, right ? A[0] + A[2] : A[0], ay, right ? B[0] - 3 : B[0] + B[2] + 3, by, 's-accent', 'arr-accent', { sw: 3 }); }
            const down = by > ay;
            const lo = Math.max(A[0], B[0]) + 10, hi = Math.min(A[0] + A[2], B[0] + B[2]) - 10;
            if (lo <= hi) { const x = ctx.util.clamp(ax, lo, hi); return arrow(s, x, down ? A[1] + A[3] : A[1], x, down ? B[1] - 3 : B[1] + B[3] + 3, 's-accent', 'arr-accent', { sw: 3 }); }
            return arrow(s, ax, down ? A[1] + A[3] : A[1], bx, down ? B[1] - 3 : B[1] + B[3] + 3, 's-accent', 'arr-accent', { sw: 3 });
          }
          function draw(fr) {
            const k = [];
            k.push(s('line', { x1: 2, y1: G.line, x2: slim ? 358 : 630, y2: G.line, class: 's-muted', 'stroke-dasharray': '6 5' }));
            Object.keys(NODES).forEach((id) => {
              const [cls, lines] = NODES[id];
              let L = lines, c = cls;
              if (id === 'ram' && fr.ram) { L = ['Main memory', { hit: 'page present: hit', miss: 'page missing', filled: 'page now present', dirty: 'page DIRTY', clean: 'page clean again' }[fr.ram]]; if (fr.ram === 'dirty') c = 's-warn'; }
              const g = box(s, G[id], c, L, { fs: slim ? 13 : 13.5, sw: fr.on.includes(id) ? 3.5 : 1.5 });
              g.setAttribute('opacity', fr.on.includes(id) ? 1 : 0.38);
              k.push(g);
            });
            fr.a.forEach(([a, b]) => k.push(link(a, b)));
            svg.replaceChildren(...k);
            const t = TH[fr.th];
            thChip.className = 'chip ' + t[0]; thChip.textContent = t[1];
            const dev = fr.on.includes('disk') || fr.on.includes('nic');
            devChip.className = 'chip ' + (dev ? 'io' : 'ok'); devChip.textContent = dev ? 'device busy' : 'no device involved';
          }
          const player = ctx.ui.player({ count: SC[sc].f.length, interval: 2600, render: (i) => { const fr = SC[sc].f[i]; draw(fr); return fr.cap; } });
          const seg = ctx.ui.seg(Object.keys(SC).map((k) => ({ value: k, label: SC[k].label })), sc, (v) => { sc = v; player.setCount(SC[v].f.length); player.reset(); });
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack', style: { gap: '10px' } },
              h('p', { class: 'lead m0', html: 'Pick a request, then step through it. Lit boxes are the layers that do work in that moment; the coloured arrows show where the request or its data travels.' }),
              seg,
              h('div', { class: 'row gap-s' }, thChip, devChip),
              h('div', { class: 'callout why m0', 'data-label': 'Why it matters', html: 'Every layer knows only its own job. NTFS never programs a disk controller, the disk driver never sees a file name, and the program never knows which of the four paths its call took.' }),
              h('div', { class: 'callout warn m0', 'data-label': 'Common mistake', html: '“WriteFile returned, so my data is on the disk.” Not yet: with lazy write it may sit in a dirty cache page for a second or more.' })),
            h('div', { class: 'stack', style: { gap: '8px' } }, h('div', { class: 'card white grow', style: { display: 'grid', placeItems: 'center', padding: '8px' } }, svg), player.el)));
        },
      },

      /* ---------------- 3. Lab: lazy write against a power cut ---------------- */
      {
        title: 'Lazy write: fast, until the power fails',
        kind: 'lab',
        render(el, ctx) {
          const { h } = ctx;
          const slim = ctx.narrow;
          const COLS = slim ? 12 : 24, T = 3000 / COLS, DISK = 10, BLOCKS = ['A', 'B', 'C'];
          const PRESETS = {
            autosave: { label: 'Autosave', ms: { A: [100, 350, 600, 850, 1100, 1350, 1600, 1850, 2100, 2350], B: [], C: [] } },
            mixed: { label: 'Mixed', ms: { A: [150, 650, 1150, 2650], B: [400, 1400, 1900], C: [2400, 2900] } },
          };
          let writes = new Set(), crash = false, crashCol = Math.round(COLS * 0.45);
          function load(p) {
            writes = new Set();
            BLOCKS.forEach((b) => PRESETS[p].ms[b].forEach((t) => writes.add(b + ':' + Math.floor(t / T))));
          }
          load('autosave');
          const fmtT = (ms) => (ms / 1000).toFixed(2) + ' s';
          const edge = (c) => (c && (c * T) % 1000 === 0 ? ' fl' : '') + (c === COLS - 1 ? ' end' : '');
          const grid = h('div', { class: 'lw-grid', style: { gridTemplateColumns: `30px repeat(${COLS}, minmax(0, 1fr))` } });
          const cells = {};
          grid.append(h('div', { class: 'xs muted' }, ''));
          for (let c = 0; c < COLS; c++) {
            const t = c * T;
            grid.append(h('div', { class: 'lw-hd' + edge(c) }, t % 500 === 0 ? (t / 1000).toFixed(1) : ''));
          }
          BLOCKS.forEach((b) => {
            grid.append(h('div', { class: 'lw-lab' }, b));
            for (let c = 0; c < COLS; c++) {
              const btn = h('button', { type: 'button', class: 'lw-cell' + edge(c), onclick: () => { const k = b + ':' + c; if (writes.has(k)) writes.delete(k); else writes.add(k); upd(); } });
              cells[b + c] = btn; grid.append(btn);
            }
          });
          const lwRow = h('div', { class: 'row xs muted', style: { justifyContent: 'space-between' } },
            h('span', { html: 'Click a cell to add a write to block A, B or C at that time (seconds).' }),
            h('span', { class: 'chip thread' }, '| = lazy writer runs'));
          const crashSeg = ctx.ui.seg([{ value: 0, label: 'No power failure' }, { value: 1, label: 'Power fails' }], 0, (v) => { crash = !!v; upd(); });
          const crashSl = ctx.ui.slider({ label: 'at', min: 0, max: 2875, step: 125, value: crashCol * T, format: (v) => fmtT((Math.min(COLS - 1, Math.floor(v / T)) + 0.75) * T), onInput: (v) => { crashCol = Math.min(COLS - 1, Math.floor(v / T)); if (!crash) { crash = true; crashSeg.set(1); } upd(); } });
          const presetBtns = Object.keys(PRESETS).map((p) => h('button', { type: 'button', class: 'btn sm', onclick: () => { load(p); upd(); } }, PRESETS[p].label));
          const clearBtn = h('button', { type: 'button', class: 'btn sm ghost', onclick: () => { writes = new Set(); upd(); } }, 'Clear');
          const res = h('div', { class: 'grid-2', style: { gap: '10px' } });
          const narr = h('div', { class: 'narr' });
          function upd() {
            const list = [...writes].map((k) => { const [b, c] = k.split(':'); return [b, +c]; });
            const r = lazySim(list, T, COLS, crash ? crashCol : null, DISK);
            BLOCKS.forEach((b) => { for (let c = 0; c < COLS; c++) {
              const btn = cells[b + c], on = writes.has(b + ':' + c), st = r.status[b + c];
              const future = crash && (c + 0.25) * T >= r.crashT;
              btn.className = 'lw-cell' + edge(c) + (on ? ' on ' + (future ? 'never' : st || '') : '') + (future ? ' fut' : '');
              btn.textContent = on ? (st === 'lost' ? '✗' : future ? '·' : '●') : '';
              btn.setAttribute('aria-label', `Block ${b} at ${fmtT((c + 0.25) * T)}: ${on ? (future ? 'write after the failure, never happens' : st === 'lost' ? 'write lost' : 'write') : 'no write'}`);
            } });
            const lostTxt = crash ? (r.lost.length ? `<b class="bad-t">${r.lost.length} update${r.lost.length === 1 ? '' : 's'} lost</b>` : '<b>nothing lost</b>') : '<span class="muted">no failure</span>';
            res.replaceChildren(
              h('div', { class: 'card tight stack gap-s' }, h('h4', { class: 'm0' }, 'Write-through'),
                h('div', { class: 'small', html: `Disk writes: <b>${r.wtDisk}</b>` }),
                h('div', { class: 'small', html: `Program waited: <b>${r.wtWait} ms</b> <span class="muted">(${r.n} × ${DISK} ms)</span>` }),
                h('div', { class: 'small', html: 'Power failure: ' + (crash ? '<b>nothing lost</b>' : '<span class="muted">no failure</span>') })),
              h('div', { class: 'card tight stack gap-s mem' }, h('h4', { class: 'm0' }, 'Lazy write'),
                h('div', { class: 'small', html: `Disk writes: <b>${r.lazyDisk}</b> <span class="muted">(${r.runs.length} run${r.runs.length === 1 ? '' : 's'})</span>` }),
                h('div', { class: 'small', html: 'Program waited: <b>≈ 0 ms</b> <span class="muted">(memory copies)</span>' }),
                h('div', { class: 'small', html: 'Power failure: ' + lostTxt })));
            let msg;
            if (!writes.size) msg = 'No writes yet. Click some cells, or load a preset.';
            else if (!r.n) msg = `Power fails at ${fmtT(r.crashT)}, before the program made any of its writes, so there was nothing to lose (and nothing was saved).`;
            else if (crash && r.lost.length) {
              const last = r.runs.length ? r.runs[r.runs.length - 1].t : 0;
              msg = `Power fails at ${fmtT(r.crashT)}. The ${r.lost.length === 1 ? 'update' : r.lost.length + ' updates'} made ${last ? 'after the lazy writer\'s ' + fmtT(last) + ' run' : 'before the lazy writer\'s first run'} (${r.lost.map(([b, c]) => b + ' at ' + fmtT((c + 0.25) * T)).join(', ')}) lived only in dirty cache pages and ${r.lost.length === 1 ? 'is' : 'are'} gone. Write-through loses nothing, but made the program wait ${r.wtWait} ms.`;
            } else if (crash) msg = `Power fails at ${fmtT(r.crashT)}. The lazy writer's ${fmtT(r.runs[r.runs.length - 1].t)} run had already saved every update made so far. Lucky timing: lazy write lost nothing and still waited ≈ 0 ms.`;
            else msg = `Lazy write turned ${r.n} write${r.n === 1 ? '' : 's'} into ${r.lazyDisk} disk write${r.lazyDisk === 1 ? '' : 's'}: each run writes a changed block once, however often it changed. The program never waited for the disk, while write-through made it wait ${r.wtWait} ms.`;
            narr.className = 'narr' + (crash && r.lost.length ? ' bad' : r.n ? ' ok' : '');
            narr.innerHTML = msg;
          }
          const tabs = ctx.ui.tabs([
            { label: 'Lazy write', html: '<p class="small">A write is copied into a cache page, the page is marked dirty, and the call returns. The cache manager\'s <b>lazy writer</b> thread wakes about once a second and writes dirty pages out in the background.</p><p class="small m0">In this lab it writes <i>every</i> dirty block on each run. Real Windows writes a share of the dirty pages on each pass, sized to keep up. A program that cannot take the risk opens the file for write-through, or calls <code>FlushFileBuffers</code> to force its data out.</p>' },
            { label: 'Lazy commit', html: '<p class="small">Transactions need a durable record that says “this transaction committed”. With <span class="t">lazy commit</span> that record is cached, and a background thread writes it to the file system\'s log a little later, so the committing thread does not wait for a disk write every time.</p><p class="small m0">Same bet as lazy write. If the power fails before the log write, recovery treats that transaction as never committed: the files stay consistent, and only that last piece of work is lost.</p>' },
            { label: 'Cache size', html: '<p class="small">The cache has no fixed size. When memory is plentiful the cache manager keeps more file data in it; when processes need memory, cached pages are among the first to be taken back (clean ones are simply dropped, dirty ones are written first).</p><p class="small m0">It caches pieces of <i>files</i> (file, offset), not raw disk blocks, which is why one cache can serve NTFS, FAT and the network redirector alike.</p>' },
          ]);
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack', style: { gap: '10px' } },
              h('p', { class: 'm0', html: 'The <span class="t">cache manager</span> caches file data for the whole I/O subsystem. Its boldest trick is <span class="t">lazy write</span>: it says “done” before the data reaches the disk.' }),
              h('div', { class: 'grow', style: { display: 'flex', minHeight: '0' } }, tabs),
              h('div', { class: 'callout analogy m0', 'data-label': 'Analogy', html: 'A waiter jots orders on a notepad and walks to the kitchen with all of them every few minutes. Customers are served fast, but drop the notepad and the latest orders are gone.' })),
            h('div', { class: 'stack', style: { gap: '9px' } },
              h('div', { class: 'row gap-s' }, h('span', { class: 'small b' }, 'Workload:'), ...presetBtns, clearBtn),
              h('div', { class: 'card white tight' }, grid, h('div', { class: 'mt', style: { marginTop: '6px' } }, lwRow)),
              h('div', { class: 'row', style: { gap: '12px' } }, crashSeg, h('div', { class: 'grow', style: { minWidth: '180px' } }, crashSl)),
              res, narr)));
          upd();
        },
      },

      /* ---------------- 4. Synchronous vs asynchronous I/O timelines ---------------- */
      {
        title: 'Synchronous or asynchronous: who waits?',
        kind: 'compare',
        core: true,
        render(el, ctx) {
          const { h, s } = ctx;
          const slim = ctx.narrow;
          let N = 4, D = 10, C = 6, par = false;
          const W = slim ? 360 : 640, LX = slim ? 58 : 92, RP = slim ? 48 : 52;
          const svg = s('svg', { viewBox: `0 0 ${W} 196`, width: '100%', role: 'img', 'aria-label': 'Timelines of synchronous and asynchronous I/O' });
          const sum = h('div', { class: 'grid-2', style: { gap: '10px' } });
          const narr = h('div', { class: 'narr' });
          function lane(k, y, label) {
            k.push(s('text', { x: LX - 8, y: y + 17, 'text-anchor': 'end', 'font-size': 13, class: 's-sub' }, label));
            k.push(s('rect', { x: LX, y, width: W - LX - RP, height: 24, rx: 4, class: 's-panel', 'stroke-width': 1, opacity: 0.5 }));
          }
          function bar(k, x0, x1, y, hh, cls, txt) {
            const w = Math.max(1, x1 - x0);
            k.push(s('rect', { x: x0, y, width: w, height: hh, rx: 3, class: cls, 'stroke-width': 1.5 }));
            if (txt && w >= (String(txt).length * 7.5 + 6) && hh >= 16) k.push(s('text', { x: x0 + w / 2, y: y + hh / 2 + 5, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 }, txt));
          }
          function draw() {
            const r = ioSim(N, D, C, par);
            const sc = (W - LX - RP) / r.syncT, X = (t) => LX + t * sc;
            const k = [];
            [['Synchronous', 4, r.sync, r.syncT], ['Asynchronous', 98, r.asy, r.asyncT]].forEach(([name, y0, segs, tot], m) => {
              k.push(s('text', { x: 0, y: y0 + 13, 'font-size': 14, 'font-weight': 800 }, name));
              lane(k, y0 + 18, 'thread'); lane(k, y0 + 46, 'device');
              if (m === 0) segs.forEach((g) => { bar(k, X(g.dev[0]), X(g.dev[1]), y0 + 18, 24, 's-warn', 'blocked'); });
              else {
                let free = 0;
                segs.forEach((g) => { if (g.work[0] > free) bar(k, X(free), X(g.work[0]), y0 + 18, 24, 's-warn', 'wait'); free = g.work[1]; });
              }
              segs.forEach((g) => bar(k, X(g.work[0]), X(g.work[1]), y0 + 18, 24, 's-thread', g.i + 1));
              if (m === 1 && par) { const hh = 24 / N; segs.forEach((g) => bar(k, X(g.dev[0]), X(g.dev[1]), y0 + 46 + g.i * hh, hh, 's-io', g.i + 1)); }
              else segs.forEach((g) => bar(k, X(g.dev[0]), X(g.dev[1]), y0 + 46, 24, 's-io', g.i + 1));
              k.push(s('line', { x1: X(tot), y1: y0 + 14, x2: X(tot), y2: y0 + 74, class: 's-line', 'stroke-dasharray': '4 3' }));
              k.push(s('text', { x: X(tot) + 4, y: y0 + 13, 'font-size': 13, 'font-weight': 800 }, tot + ' ms'));
            });
            const step = r.syncT > 150 ? 50 : r.syncT > 60 ? 20 : 10;
            k.push(s('line', { x1: LX, y1: 180, x2: W - RP, y2: 180, class: 's-muted' }));
            for (let t = 0; t <= r.syncT; t += step) {
              k.push(s('line', { x1: X(t), y1: 177, x2: X(t), y2: 183, class: 's-muted' }));
              k.push(s('text', { x: X(t), y: 195, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, String(t)));
            }
            k.push(s('text', { x: LX - 8, y: 195, 'text-anchor': 'end', 'font-size': 12.5, class: 's-sub' }, 'ms'));
            svg.replaceChildren(...k);
            const saved = r.syncT - r.asyncT;
            sum.replaceChildren(
              h('div', { class: 'card tight' }, h('h4', { class: 'm0' }, 'Synchronous'), h('div', { class: 'small', html: `<b>${r.syncT} ms</b> = ${N} × (${D} + ${C})` }), h('div', { class: 'small muted' }, `thread blocked ${r.syncWait} ms`)),
              h('div', { class: 'card tight thread' }, h('h4', { class: 'm0' }, 'Asynchronous'), h('div', { class: 'small', html: `<b>${r.asyncT} ms</b>, ${saved} ms sooner (${Math.round((100 * saved) / r.syncT)}%)` }), h('div', { class: 'small muted' }, `thread waiting ${r.asyncWait} ms`)));
            let msg;
            if (par) msg = `All ${N} requests are in the device at once, so every result is ready after ${D} ms. From then on the thread is the only limit: ${D} + ${N} × ${C} = <b>${r.asyncT} ms</b>.`;
            else if (D >= C) msg = `The device is the bottleneck (${D} ms per request ≥ ${C} ms of processing). The thread processes each result while the device fetches the next, so the total is ${N} × ${D} + ${C} = <b>${r.asyncT} ms</b>.`;
            else msg = `The thread is the bottleneck (${C} ms of processing > ${D} ms per request). After the first ${D} ms it never waits again: ${D} + ${N} × ${C} = <b>${r.asyncT} ms</b>.`;
            if (N === 1) msg = `With one request there is nothing to overlap: both take ${r.syncT} ms. Asynchronous I/O pays off only when the thread has other work to do while it waits.`;
            narr.innerHTML = msg;
          }
          const sl = [
            ctx.ui.slider({ label: 'Requests N', min: 1, max: 6, value: N, onInput: (v) => { N = v; draw(); } }),
            ctx.ui.slider({ label: 'Device time D', min: 2, max: 20, value: D, format: (v) => v + ' ms', onInput: (v) => { D = v; draw(); } }),
            ctx.ui.slider({ label: 'Processing C', min: 1, max: 20, value: C, format: (v) => v + ' ms', onInput: (v) => { C = v; draw(); } }),
          ];
          const seg = ctx.ui.seg([{ value: 0, label: 'Device: one at a time' }, { value: 1, label: 'Device: many at once' }], 0, (v) => { par = !!v; draw(); });
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack', style: { gap: '9px' } },
              h('p', { class: 'm0', html: 'With <span class="t">synchronous I/O</span> the thread is blocked inside ReadFile until the data arrives. With <span class="t">asynchronous I/O (overlapped I/O)</span> ReadFile only <i>starts</i> the operation and returns at once, so the thread can keep working; the system must tell it later that the operation finished.' }),
              h('p', { class: 'small m0 muted', html: 'Here a thread reads N blocks. Each takes D ms of device time, then C ms of processing.' }),
              ...sl, seg,
              h('div', { class: 'callout warn m0', 'data-label': 'Common mistake', html: 'Asynchronous I/O does not make the device faster. It lets the thread overlap its own work with the device, and lets several requests be in progress at once.' })),
            h('div', { class: 'stack', style: { gap: '8px' } }, h('div', { class: 'card white', style: { padding: '6px 10px' } }, svg,
                h('div', { class: 'row gap-s xs', style: { marginTop: '2px' } }, h('span', { class: 'chip thread' }, 'thread processing result n'), h('span', { class: 'chip io' }, 'device busy with request n'), h('span', { class: 'chip warn' }, 'thread blocked or waiting'))),
              sum, narr,
              h('div', { class: 'callout tip m0', 'data-label': 'In Windows', html: 'Open the file with <code>FILE_FLAG_OVERLAPPED</code> and pass an <code>OVERLAPPED</code> record to ReadFile: it returns at once with the I/O still pending (unless it could finish on the spot, say from the cache).' }))));
          draw();
        },
      },

      /* ---------------- 5. The five ways to learn that an I/O finished ---------------- */
      {
        title: 'Five ways to hear “your I/O is done”',
        kind: 'learn',
        render(el, ctx) {
          const { h, s } = ctx;
          const slim = ctx.narrow;
          const G = slim ? { W: 360, tx: 2, tw: 102, mx: 116, mw: 130, dx: 258, dw: 100 } : { W: 460, tx: 6, tw: 132, mx: 166, mw: 136, dx: 330, dw: 124 };
          let ti = 0;
          const svg = s('svg', { viewBox: `0 0 ${G.W} 204`, width: '100%', role: 'img', 'aria-label': 'Threads, signal objects and the device for the chosen technique' });
          const codeBox = h('div', { class: 'cw-code' });
          const trade = h('div', { class: 'stack gap-s' });
          let code = null, lineMap = {};
          function rects(t, fr) {
            const R = {};
            const nT = fr.th.length;
            fr.th.forEach(([id], i) => { R[id] = nT === 1 ? [G.tx, 12, G.tw, 52] : [G.tx, 6 + i * 62, G.tw, 52]; });
            const nM = fr.mid.length;
            fr.mid.forEach(([id], i) => { R[id] = nT > 1 ? [G.mx, 68, G.mw, 52] : nM === 1 ? [G.mx, 116, G.mw, 52] : [G.mx - 70 + i * 150, 112, G.mw, 52]; });
            R.D = [G.dx, 12, G.dw, 52];
            return R;
          }
          function edgePt(r, dx, dy) {
            const cx = r[0] + r[2] / 2, cy = r[1] + r[3] / 2;
            const k = Math.min(Math.abs((r[2] / 2) / (dx || 1e-9)), Math.abs((r[3] / 2) / (dy || 1e-9)));
            return [cx + dx * k, cy + dy * k];
          }
          function link(A, B, kind) {
            const ax = A[0] + A[2] / 2, ay = A[1] + A[3] / 2, bx = B[0] + B[2] / 2, by = B[1] + B[3] / 2;
            const len = Math.hypot(bx - ax, by - ay), dx = (bx - ax) / len, dy = (by - ay) / len;
            const [x1, y1] = edgePt(A, dx, dy), [x2, y2] = edgePt(B, -dx, -dy);
            return kind === 'go'
              ? arrow(s, x1, y1, x2 - dx * 4, y2 - dy * 4, 's-accent', 'arr-accent', { sw: 3 })
              : arrow(s, x1, y1, x2 - dx * 4, y2 - dy * 4, 's-line', 'arr', { dash: '5 4' });
          }
          function draw(fr) {
            const R = rects(TECH[ti], fr);
            const k = [];
            const fs = slim ? 13 : 14;
            fr.th.forEach(([id, name, st, cls]) => k.push(box(s, R[id], cls, [name, st], { fs, sw: 2 })));
            fr.mid.forEach(([id, title, sub, cls]) => k.push(box(s, R[id], cls, [title, sub], { fs, sw: 2 })));
            k.push(box(s, R.D, fr.dev[2], [fr.dev[0], fr.dev[1]], { fs, sw: 2 }));
            fr.links.forEach(([a, b, kind]) => k.push(link(R[a], R[b], kind)));
            k.push(s('text', { x: G.W / 2, y: 200, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, slim ? 'solid = travels · dashed = waits on / checks' : 'solid arrow = request or signal travels · dashed = thread waits on / checks'));
            svg.replaceChildren(...k);
            if (code) { code.clear(); code.mark(fr.ln.flatMap((n) => lineMap[n] || [])); }
          }
          const player = ctx.ui.player({ count: 4, interval: 2800, speed: false, render: (i) => { draw(TECH[ti].frames[i]); return TECH[ti].frames[i].cap; } });
          function pick(i) {
            ti = i;
            const t = TECH[i];
            // small screens: put each comment on its own line above its statement, so nothing hides off to the right
            const out = [];
            lineMap = {};
            t.code.forEach((l, i) => {
              const at = l.indexOf('//');
              if (!slim || at < 0) { out.push(l); lineMap[i + 1] = [out.length]; return; }
              const ind = l.match(/^\s*/)[0];
              out.push(ind + l.slice(at).trim(), l.slice(0, at).trimEnd());
              lineMap[i + 1] = [out.length - 1, out.length];
            });
            code = ctx.ui.code(out.join('\n'), { lang: 'c', fontSize: 13.5 });
            codeBox.className = 'cw-code' + (slim ? ' slim' : '');
            codeBox.replaceChildren(h('h4', { class: 'm0', style: { marginBottom: '6px' } }, t.name + ' · the code'), code);
            trade.replaceChildren(
              h('div', { class: 'b', html: `<span class="t" data-t="${t.term}">${t.name}</span>` }),
              h('div', { class: 'small', html: '<b class="ok-t">Good for:</b> ' + t.good }),
              h('div', { class: 'small', html: '<b class="bad-t">Limitation:</b> ' + t.limit }));
            player.reset();
            ctx.refit();
          }
          const seg = ctx.ui.seg(TECH.map((t, i) => ({ value: i, label: t.short })), 0, (v) => pick(v));
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },
            h('div', { class: 'row', style: { justifyContent: 'space-between' } },
              h('p', { class: 'm0', html: 'How does a thread learn that its asynchronous I/O is done?' }), seg),
            h('div', { class: 'split l grow' },
              h('div', { class: 'stack', style: { gap: '8px' } }, h('div', { class: 'card white', style: { padding: '8px 10px' } }, svg), player.el,
                h('div', { class: 'callout why m0 small', 'data-label': 'Why five?', html: 'Simplicity versus scale: the file object needs no setup but cannot tell requests apart; a completion port takes setup but lets a few threads serve thousands of clients.' })),
              h('div', { class: 'stack', style: { gap: '10px' } }, h('div', { class: 'card white tight' }, codeBox), h('div', { class: 'card tight' }, trade)))));
          pick(0);
        },
      },

      /* ---------------- 6. Pick the right completion technique ---------------- */
      {
        title: 'Your call: which completion technique fits?',
        kind: 'predict',
        render(el, ctx) {
          const { h } = ctx;
          const OPTS = [
            ['sync', 'Synchronous I/O', 'Synchronous I/O blocks the thread until the data arrives, so the thread can do nothing else meanwhile.', 'block inside ReadFile until done'],
            ['file', 'Signal the file object', 'Waiting on the file object blocks the thread, and every request on that file signals the same object.', 'work, then wait on the file handle'],
            ['event', 'Event per request', 'One event per request tells pending requests apart, but means creating events and blocking on them.', 'one event for each request'],
            ['apc', 'APC completion routine', 'A completion routine runs only when the issuing thread enters an alertable wait, and always on that thread.', 'routine runs in an alertable wait'],
            ['port', 'I/O completion port', 'A completion port needs a port, a pool of workers and a loop: machinery built for servers with many connections.', 'a pool of workers on one queue'],
            ['poll', 'Polling', 'Polling means checking a status word now and then: the thread never blocks, but frequent checks cost processor time.', 'check a status word now and then'],
          ];
          const SCN = [
            { t: 'Settings file at start-up', q: 'A command-line tool reads a 2 KB settings file at start-up and can do nothing at all until it has the contents.', a: 'sync', why: 'There is no other work to overlap, so asynchronous machinery buys nothing. A plain blocking ReadFile is the simplest correct choice.' },
            { t: 'Backup, one read at a time', q: 'A backup program has <b>one</b> read in progress at a time on a file. While each read runs it updates its progress bar, then it needs the data.', a: 'file', why: 'With only one request in progress on the file, the file object itself says “done”. Nothing extra to create: work, then wait on the file handle.' },
            { t: 'Video editor, three reads at once', q: 'A video editor reads <b>three different parts of one file</b> at once and must start decoding whichever part arrives first.', a: 'event', why: 'Several requests on one file: give each its own event and wait for any of them. The event that is set says exactly which part arrived.' },
            { t: 'Chat server, 20,000 connections', q: 'A chat server on a 16-core machine holds <b>20,000 open connections</b> and wants a small pool of threads to handle whichever messages arrive.', a: 'port', why: 'This is what completion ports are for: every connection feeds one queue, a few workers take completions from it, and only about as many run as there are cores.' },
            { t: 'Own routine, run during SleepEx', q: 'A single-threaded tool wants its <b>own routine</b> called for each finished read, on that same thread, whenever it pauses in <code>SleepEx(…, TRUE)</code>.', a: 'apc', why: 'A completion routine queued as an APC runs on the thread that issued the read, exactly when that thread enters an alertable wait such as SleepEx(…, TRUE).' },
            { t: 'Game loop that must never block', q: 'A game\'s frame loop runs 60 times a second and must <b>never block</b>. Once per frame it can glance at whether its level file has finished loading.', a: 'poll', why: 'The loop runs anyway and must not block, so a quick look at the request\'s status once per frame (polling) costs almost nothing.' },
          ];
          const picks = {};
          let cur = 0;
          const qBox = h('div', { class: 'card white stack', style: { gap: '8px' } });
          const optGrid = h('div', { class: 'grid-2', style: { gap: '8px' } });
          const fb = h('div', { class: 'narr' });
          const list = h('div', { class: 'stack gap-s' });
          const score = h('div', { class: 'big' });
          const nextBtn = h('button', { type: 'button', class: 'btn primary sm', onclick: () => { cur = (cur + 1) % SCN.length; paint(); } }, 'Next scenario →');
          function paint() {
            const sc = SCN[cur], p = picks[cur];
            qBox.replaceChildren(h('h4', { class: 'm0' }, `Scenario ${cur + 1} of ${SCN.length}`), h('p', { class: 'm0', html: sc.q }));
            optGrid.replaceChildren(...OPTS.map(([k, label, , hint]) => h('button', {
              type: 'button', class: 'btn pk-opt' + (p ? (k === sc.a ? ' pk-ok' : k === p.last ? ' pk-bad' : '') : ''),
              onclick: () => { if (!picks[cur]) picks[cur] = { first: k, last: k }; else picks[cur].last = k; paint(); } }, h('span', {}, label), h('span', { class: 'xs pk-hint' }, hint))));
            if (!p) { fb.className = 'narr'; fb.innerHTML = 'Pick the technique that fits best. You can change your mind; your <b>first</b> pick is what counts.'; }
            else if (p.last === sc.a) { fb.className = 'narr ok'; fb.innerHTML = '<b>Right.</b> ' + sc.why; }
            else { const o = OPTS.find((x) => x[0] === p.last); fb.className = 'narr bad'; fb.innerHTML = `<b>Not the best fit.</b> ${o[2]} ${sc.why}`; }
            const right = Object.keys(picks).filter((i) => picks[i].first === SCN[i].a).length;
            score.textContent = `${right} / ${SCN.length}`;
            list.replaceChildren(...SCN.map((x, i) => {
              const q = picks[i], ok = q && q.first === x.a;
              return h('button', { type: 'button', class: 'btn sm pk-row' + (i === cur ? ' on' : ''), onclick: () => { cur = i; paint(); } },
                h('span', { class: 'chip ' + (!q ? '' : ok ? 'ok' : 'bad') }, !q ? String(i + 1) : ok ? '✓' : '✗'),
                h('span', { class: 'stack', style: { gap: '0', alignItems: 'flex-start' } }, h('span', {}, x.t),
                  h('span', { class: 'xs pk-hint' }, q ? 'best: ' + OPTS.find((o) => o[0] === x.a)[1] : 'not answered yet')));
            }));
            ctx.refit();
          }
          const resetBtn = h('button', { type: 'button', class: 'btn sm ghost', onclick: () => { Object.keys(picks).forEach((k) => delete picks[k]); cur = 0; paint(); } }, 'Start over');
          el.append(h('div', { class: 'split r fill' },
            h('div', { class: 'stack', style: { gap: '10px' } }, qBox, optGrid, fb, h('div', { class: 'row' }, nextBtn),
              ctx.ui.reveal('Show a rule of thumb', '<p class="small m0">Nothing else to do while waiting → <b>synchronous</b>. One request in progress on a file → <b>file object</b>. Several, and you must know which finished → <b>an event per request</b>. Your own routine, run on your own thread → <b>APC</b>. Thousands of connections, few threads → <b>completion port</b>. Must never block → <b>polling</b>.</p>')),
            h('div', { class: 'card stack', style: { gap: '8px' } },
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'First-try score'), resetBtn), score,
              h('p', { class: 'xs muted m0' }, 'Click a row to revisit a scenario. Answered rows show the best technique.'), list)));
          paint();
        },
      },

      /* ---------------- 7. Hardware RAID vs software RAID ---------------- */
      {
        title: 'Hardware RAID or software RAID?',
        kind: 'compare',
        render(el, ctx) {
          const { h, s } = ctx;
          const slim = ctx.narrow;
          let mode = 'sw', lvl = 5, blk = 0, last = null;
          let rd = [0, 0, 0, 0], wr = [0, 0, 0, 0], issued = 0, writes = 0;
          const svg = s('svg', { viewBox: slim ? '0 0 360 300' : '0 0 620 290', width: '100%', role: 'img', 'aria-label': 'Where the RAID work happens' });
          const narr = h('div', { class: 'narr' });
          const stats = h('div', { class: 'row gap-s' });
          function nDisks() { return lvl === 1 ? 2 : 4; }
          // ops for writing logical block b: list of [disk, 'R' | 'W', what]
          function opsFor(b) {
            if (lvl === 1) return [[0, 'W', 'data'], [1, 'W', 'copy']];
            const stripe = Math.floor(b / 3), p = 3 - (stripe % 4);
            const data = [0, 1, 2, 3].filter((d) => d !== p), d = data[b % 3];
            return [[d, 'R', 'old data'], [p, 'R', 'old parity'], [d, 'W', 'new data'], [p, 'W', 'new parity']];
          }
          function doWrite() {
            const ops = opsFor(blk);
            ops.forEach(([d, k]) => { if (k === 'R') rd[d]++; else wr[d]++; });
            issued += mode === 'sw' ? ops.length : 1; writes++;
            last = { b: blk, ops };
            blk++;
            draw();
          }
          function reset() { rd = [0, 0, 0, 0]; wr = [0, 0, 0, 0]; issued = 0; writes = 0; blk = 0; last = null; draw(); }
          function draw() {
            const W = slim ? 360 : 620, n = nDisks();
            const top = slim ? [50, 6, 260, 38] : [170, 6, 280, 38];
            const mid = slim ? [20, 64, 320, 40] : [130, 64, 360, 40];
            const ctl = slim ? [20, 156, 320, 36] : [130, 154, 360, 36];
            const busY = 132, dy = slim ? 214 : 210, dh = slim ? 80 : 74;
            const dw = slim ? 82 : 128, gap = (W - n * dw) / (n + 1);
            const dx = (i) => gap + i * (dw + gap);
            const k = [];
            k.push(box(s, top, 's-os', ['File system driver (NTFS)'], { fs: 14 }));
            k.push(arrow(s, W / 2, top[1] + top[3], W / 2, mid[1] - 3));
            k.push(s('line', { x1: 4, y1: busY, x2: W - 4, y2: busY, class: 's-muted', 'stroke-dasharray': '7 5' }));
            k.push(s('text', { x: 6, y: busY - 6, 'font-size': 13, class: 's-sub', style: 'paint-order: stroke; stroke: var(--panel); stroke-width: 5px' }, 'Windows ↑'));
            k.push(s('text', { x: 6, y: busY + 17, 'font-size': 13, class: 's-sub', style: 'paint-order: stroke; stroke: var(--panel); stroke-width: 5px' }, '↓ link to the storage hardware'));
            const opsOn = last ? last.ops : [];
            const opTxt = (i) => opsOn.filter(([d]) => d === i).map(([, kk, what]) => (kk === 'R' ? 'read ' : 'write ') + (slim ? what.replace(/^(old|new) /, '') : what));
            if (mode === 'sw') {
              k.push(box(s, mid, 's-os', ['Volume driver: software RAID ' + lvl, 'copies or computes parity on the CPU'], { fs: 14, sw: 3 }));
              for (let i = 0; i < n; i++) {
                const used = opsOn.some(([d]) => d === i), x = dx(i) + dw / 2;
                k.push(arrow(s, ctx.util.clamp(x, mid[0] + 12, mid[0] + mid[2] - 12), mid[1] + mid[3], x, dy - 3, used ? 's-accent' : 's-line', used ? 'arr-accent' : 'arr', { sw: used ? 3 : 1.5 }));
              }
            } else {
              k.push(box(s, mid, 's-os', ['Disk driver', 'sees ONE disk'], { fs: 14 }));
              k.push(arrow(s, W / 2, mid[1] + mid[3], W / 2, ctl[1] - 3, last ? 's-accent' : 's-line', last ? 'arr-accent' : 'arr', { sw: last ? 3 : 2 }));
              k.push(box(s, ctl, 's-io', ['RAID controller: hardware RAID ' + lvl], { fs: 14, sw: 3 }));
              for (let i = 0; i < n; i++) {
                const used = opsOn.some(([d]) => d === i), x = dx(i) + dw / 2;
                k.push(arrow(s, ctx.util.clamp(x, ctl[0] + 12, ctl[0] + ctl[2] - 12), ctl[1] + ctl[3], x, dy - 3, used ? 's-accent' : 's-line', used ? 'arr-accent' : 'arr', { sw: used ? 3 : 1.5 }));
              }
            }
            for (let i = 0; i < n; i++) {
              const used = opsOn.some(([d]) => d === i), t = opTxt(i);
              const lines = [`Disk ${i}`, t[0] || (used ? '' : '—'), t[1] || '', `R ${rd[i]} · W ${wr[i]}`].filter((x, j) => j !== 2 || x);
              k.push(box(s, [dx(i), dy, dw, dh], used ? 's-accent' : 's-io', lines, { fs: 13, sw: used ? 3 : 1.5 }));
            }
            svg.replaceChildren(...k);
            const diskOps = rd.reduce((a, b) => a + b, 0) + wr.reduce((a, b) => a + b, 0);
            stats.replaceChildren(
              h('span', { class: 'chip accent' }, `small writes: ${writes}`),
              h('span', { class: 'chip os' }, `requests Windows sent: ${issued}`),
              h('span', { class: 'chip io' }, `disk operations: ${diskOps}`));
            if (!last) narr.innerHTML = `Press <b>Write a block</b>. ${mode === 'sw' ? 'Windows itself' : 'The controller'} will do the RAID ${lvl} work.`;
            else if (lvl === 1) narr.innerHTML = mode === 'sw'
              ? `Block ${last.b}: the Windows volume driver sends the same write to <b>both</b> disks: Windows itself issues 2 disk requests for 1 write by the program.`
              : `Block ${last.b}: Windows sends <b>1</b> write to what it thinks is one disk. The controller writes it to both disks by itself.`;
            else {
              const [[d], [p]] = last.ops;
              narr.innerHTML = mode === 'sw'
                ? `Block ${last.b} lives on disk ${d}; this stripe's parity is on disk ${p}. Windows reads the old data and old parity, computes new parity = old parity ⊕ old data ⊕ new data <b>on the CPU</b>, then writes both: <b>4</b> requests.`
                : `Block ${last.b}: Windows sends <b>1</b> write. The controller's own processor does the 2 reads, the parity calculation and the 2 writes (to disks ${d} and ${p}).`;
            }
          }
          const modeSeg = ctx.ui.seg([{ value: 'hw', label: 'Hardware RAID' }, { value: 'sw', label: 'Software RAID' }], mode, (v) => { mode = v; reset(); });
          const lvlSeg = ctx.ui.seg([{ value: 1, label: 'RAID 1: mirror' }, { value: 5, label: 'RAID 5: parity' }], lvl, (v) => { lvl = v; reset(); });
          const goBtn = h('button', { type: 'button', class: 'btn primary', onclick: doWrite }, 'Write a block');
          const rsBtn = h('button', { type: 'button', class: 'btn sm ghost', onclick: reset }, 'Reset');
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack', style: { gap: '9px' } },
              h('p', { class: 'm0', html: 'The RAID levels of section 11.6 can be built in two places. With <span class="t">hardware RAID</span> a controller combines the disks and Windows sees one disk. With <span class="t">software RAID</span> Windows combines space (whole disks or just parts of them) into one <span class="t">volume</span> and does the copying or parity itself.' }),
              h('div', { class: 'row gap-s' }, modeSeg), h('div', { class: 'row gap-s' }, lvlSeg),
              h('table', { class: 'tbl compact', html: '<tr><th></th><th>Hardware</th><th>Software</th></tr><tr><td>Windows sees</td><td>one disk</td><td>every disk</td></tr><tr><td>RAID work on</td><td>controller</td><td>host CPU</td></tr><tr><td>Extra cost</td><td>a controller</td><td>none</td></tr><tr><td>Built from</td><td>whole disks</td><td>disks or parts of disks</td></tr>' }),
              h('div', { class: 'callout tip m0 small', 'data-label': 'Windows versions', html: 'Software RAID 1 and 5 (plus striping) came from the fault-tolerant disk driver of NT Server, then from <i>dynamic disks</i> (Windows 2000 on; RAID 5 only on Server editions). Since Windows 8 and Server 2012, <i>Storage Spaces</i> offers mirror and parity; dynamic disks are deprecated.' })),
            h('div', { class: 'stack', style: { gap: '8px' } },
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('div', { class: 'row gap-s' }, goBtn, rsBtn), stats),
              h('div', { class: 'card white', style: { padding: '8px 10px' } }, svg), narr)));
          draw();
        },
      },

      /* ---------------- 8. Whole-volume services: shadow copies and BitLocker ---------------- */
      {
        title: 'Snapshots and encryption for a whole volume',
        kind: 'explore',
        render(el, ctx) {
          const { h } = ctx;
          const L = 'ABCDEF';
          function shadow(p) {
            let live = [1, 1, 1, 1, 1, 1], atSnap = null, diff = {}, view = 'now', msg = 'Take a snapshot, then click blocks of the live volume to overwrite them.';
            const rows = h('div', { class: 'stack', style: { gap: '8px' } });
            const narr = h('div', { class: 'narr' });
            const info = h('div', { class: 'row gap-s' });
            const blk = (txt, sub, cls, o = {}) => h(o.btn ? 'button' : 'div', Object.assign({ class: 'vs-blk ' + cls, type: o.btn ? 'button' : null }, o.attrs || {}), h('b', {}, txt), h('span', { class: 'xs' }, sub));
            function snapView() { return live.map((v, i) => (i in diff ? [diff[i], 'diff area'] : [v, 'live volume'])); }
            function paint() {
              const sv = snapView();
              const live6 = live.map((v, i) => blk(L[i] + v, 'block ' + i, (atSnap && i in diff ? 'chg' : 'live'), { btn: true, attrs: { 'aria-label': `Overwrite block ${i}`, onclick: () => write(i) } }));
              const diff6 = live.map((v, i) => (i in diff ? blk(L[i] + diff[i], 'old block ' + i, 'saved') : h('div', { class: 'vs-blk empty' }, h('span', { class: 'xs' }, '·'))));
              const view6 = (view === 'snap' && atSnap ? sv.map(([v, src], i) => blk(L[i] + v, 'from ' + (src === 'diff area' ? 'diff' : 'live'), src === 'diff area' ? 'saved' : 'live')) : live.map((v, i) => blk(L[i] + v, 'block ' + i, 'live')));
              rows.replaceChildren(
                h('div', { class: 'vs-row' }, h('span', { class: 'vs-lab' }, 'Live volume'), ...live6),
                h('div', { class: 'vs-row' }, h('span', { class: 'vs-lab' }, 'Diff area'), ...diff6),
                h('div', { class: 'vs-row' }, h('span', { class: 'vs-lab' }, view === 'snap' ? 'Snapshot view' : 'Volume now'), ...view6));
              const ok = atSnap && sv.every(([v], i) => v === atSnap[i]);
              info.replaceChildren(
                h('span', { class: 'chip ' + (atSnap ? 'ok' : '') }, atSnap ? 'snapshot taken' : 'no snapshot yet'),
                h('span', { class: 'chip mem' }, `diff area: ${Object.keys(diff).length} of 6 blocks`),
                atSnap && view === 'snap' ? h('span', { class: 'chip ' + (ok ? 'ok' : 'bad') }, ok ? '✓ equals the volume at snapshot time' : '✗ mismatch') : null);
              narr.innerHTML = msg;
            }
            function write(i) {
              if (atSnap && !(i in diff)) { diff[i] = live[i]; msg = `Block ${i} is about to change for the first time since the snapshot, so its old contents (${L[i]}${live[i]}) are <b>copied to the diff area first</b>. Then ${L[i]}${live[i] + 1} is written.`; }
              else if (atSnap) msg = `Block ${i} was already saved, so nothing is copied: ${L[i]}${live[i] + 1} simply overwrites the live block. The snapshot still holds ${L[i]}${diff[i]}.`;
              else msg = `No snapshot exists, so block ${i} is just overwritten. Its old contents are gone for good.`;
              live[i]++;
              paint();
            }
            const snapBtn = h('button', { type: 'button', class: 'btn primary sm', onclick: () => { atSnap = live.slice(); diff = {}; msg = 'Snapshot taken. Nothing was copied: until a block changes, the snapshot and the live volume share it. That is why a copy-on-write shadow copy is created in moments.'; paint(); } }, 'Take snapshot');
            const viewSeg = ctx.ui.seg([{ value: 'now', label: 'Read volume now' }, { value: 'snap', label: 'Read the snapshot' }], view, (v) => { view = v; if (v === 'snap' && !atSnap) msg = 'There is no snapshot to read yet. Take one first.'; paint(); });
            const resetBtn = h('button', { type: 'button', class: 'btn sm ghost', onclick: () => { live = [1, 1, 1, 1, 1, 1]; atSnap = null; diff = {}; view = 'now'; viewSeg.set('now'); msg = 'Reset. Take a snapshot, then click blocks of the live volume to overwrite them.'; paint(); } }, 'Reset');
            p.append(h('div', { class: 'split l fill', style: { paddingTop: '10px' } },
              h('div', { class: 'stack', style: { gap: '9px' } },
                h('p', { class: 'm0', html: 'A <span class="t">volume shadow copy</span> is a point-in-time view of a whole volume: the volume exactly as it was at one instant. Backup programs copy files from it while people keep working, and users can recover an earlier version of a file they changed or deleted.' }),
                h('p', { class: 'small m0', html: 'Providers keep that view in different ways (some make a complete copy, such as a split mirror). The built-in system provider, modelled here, uses <span class="t" data-t="Copy on write (COW)">copy on write</span>: a block is saved to a separate diff area only just before it is first overwritten. Just before the snapshot, Windows asks programs such as databases to flush their data and pause writing for a moment, so the snapshot is consistent.' }),
                h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: '“A shadow copy is a backup.” Not this one: the copy-on-write snapshot modelled here borrows every unchanged block from the live volume, so if that disk dies, the snapshot dies with it. It is the <i>source</i> for a consistent backup.' })),
              h('div', { class: 'stack', style: { gap: '8px' } },
                h('div', { class: 'row gap-s' }, snapBtn, viewSeg, resetBtn), rows, info, narr,
                h('div', { class: 'callout analogy m0 small', 'data-label': 'Analogy', html: 'Photographing a whiteboard costs nothing if you promise to snap a close-up of each corner just before anyone erases it.' }))));
            paint();
          }
          function locker(p) {
            let on = true, stolen = false;
            const plain = 'Payroll.xlsx: Ana 91,400';
            const cipher = (txt) => Array.from(txt).map((c, i) => ((c.charCodeAt(0) * 73 + i * 151 + 41) % 256).toString(16).padStart(2, '0')).join(' ');
            const stack = h('div', { class: 'stack', style: { gap: '6px' } });
            const narr = h('div', { class: 'narr' });
            function paint() {
              const onDisk = on ? cipher(plain) : plain;
              stack.replaceChildren(
                h('div', { class: 'box proc' }, h('div', { class: 'xs muted' }, 'what programs and NTFS read and write'), h('div', { class: 'mono' }, plain)),
                h('div', { class: 'center muted' }, '↓ write   ↑ read'),
                h('div', { class: 'box ' + (on ? 'os' : '') }, on ? 'BitLocker driver: encrypts every sector going down, decrypts every sector coming up' : 'no encryption layer: sectors pass through unchanged'),
                h('div', { class: 'center muted' }, '↓   ↑'),
                h('div', { class: 'box io' }, h('div', { class: 'xs muted' }, 'what is stored in the sector on the disk'), h('div', { class: 'mono vs-hex' }, onDisk)),
                stolen ? h('div', { class: 'box ' + (on ? 'ok' : 'bad') }, h('div', { class: 'xs muted' }, 'the thief plugs the stolen disk into another computer and reads'), h('div', { class: 'mono vs-hex' }, onDisk)) : null);
              narr.className = 'narr' + (stolen ? (on ? ' ok' : ' bad') : '');
              narr.innerHTML = stolen
                ? (on ? 'The disk alone carries no usable key: it stays locked up by the original computer\'s TPM chip (or a PIN or the recovery key), so the thief sees only scrambled bytes.' : 'With no encryption the thief reads everything, whatever file permissions Windows enforced: permissions only work while Windows itself is running.')
                : (on ? 'Programs notice nothing: the driver encrypts and decrypts below the file system. At boot the key is released by the TPM chip (optionally with a PIN or a USB key); a long recovery key is the backup.' : 'BitLocker is off: the disk holds exactly what the programs wrote.');
            }
            const seg = ctx.ui.seg([{ value: 1, label: 'BitLocker on' }, { value: 0, label: 'BitLocker off' }], 1, (v) => { on = !!v; paint(); });
            const steal = h('button', { type: 'button', class: 'btn intr sm', onclick: () => { stolen = !stolen; steal.textContent = stolen ? 'Give it back' : 'Steal the drive'; paint(); } }, 'Steal the drive');
            p.append(h('div', { class: 'split l fill', style: { paddingTop: '10px' } },
              h('div', { class: 'stack', style: { gap: '9px' } },
                h('p', { class: 'm0', html: '<span class="t">BitLocker</span> (since Windows Vista) encrypts an entire volume: every file, the system files, even the paging file. It works as a driver below the file system, so applications and NTFS never see a difference.' }),
                h('div', { class: 'callout why m0 small', 'data-label': 'Why it matters', html: 'File permissions protect data only while Windows is running and enforcing them. A laptop lost on a train is a different threat: the finder can read the disk directly, unless the whole volume is encrypted.' }),
                h('div', { class: 'card tight' }, h('h4', { class: 'm0' }, 'Unlocking the volume at boot'),
                  h('ul', { class: 'small m0', html: '<li>The <b>TPM</b> (Trusted Platform Module, a small security chip on the motherboard) releases the key only if the early boot files are unchanged.</li><li>A <b>PIN</b> or a <b>USB startup key</b> can be required as well.</li><li>A 48-digit <b>recovery key</b> is the backup if all else fails.</li>' })),
                h('p', { class: 'xs muted m0' }, 'The scrambled bytes here are made up for the picture; BitLocker really uses the AES cipher.')),
              h('div', { class: 'stack', style: { gap: '8px' } }, h('div', { class: 'row gap-s' }, seg, steal), stack, narr)));
            paint();
          }
          el.append(h('div', { class: 'fill', style: { display: 'flex', flexDirection: 'column' } },
            ctx.ui.tabs([{ label: 'Volume shadow copies', render: shadow }, { label: 'BitLocker volume encryption', render: locker }])));
        },
      },

      /* ---------------- 9. Recap ---------------- */
      {
        title: 'Recap: Windows I/O in six cards',
        kind: 'recap',
        render(el, ctx) {
          el.append(ctx.h('div', { class: 'stack fill' },
            ctx.h('p', { class: 'lead m0' }, 'Say each answer out loud before you flip the card.'),
            ctx.ui.flipcards([
              ['Which four kinds of modules does the I/O manager route requests to?', 'The <b>cache manager</b>, <b>file system drivers</b>, <b>network drivers</b> and <b>hardware device drivers</b>. Every request travels as an IRP, and a file system is “just another driver”.'],
              ['Lazy write vs lazy commit?', '<b>Lazy write:</b> changed file data waits in the cache and a background thread writes it out later. <b>Lazy commit:</b> the same trick for a transaction\'s commit record, written to the log later.'],
              ['Synchronous vs asynchronous I/O?', '<b>Synchronous:</b> the thread blocks until the I/O is done. <b>Asynchronous:</b> the call returns at once, the thread keeps working, and the system must signal completion later.'],
              ['The five ways to signal completion?', 'Signal the <b>file object</b> · signal an <b>event object</b> per request · an <b>APC</b> run in an alertable wait · an <b>I/O completion port</b> with a worker pool · <b>polling</b> a status word.'],
              ['Hardware RAID vs software RAID?', '<b>Hardware:</b> a controller does the work and Windows sees one disk. <b>Software:</b> a Windows driver mirrors (RAID 1) or computes parity (RAID 5) on the host CPU.'],
              ['Volume shadow copy and BitLocker?', '<b>Shadow copy:</b> a point-in-time view of a volume, for consistent backups and earlier file versions; the built-in provider keeps it with copy on write. <b>BitLocker:</b> encrypts the whole volume below the file system.'],
            ], { cols: ctx.narrow ? 1 : 3, height: 214 })));
        },
      },

      /* ---------------- 10. Check yourself ---------------- */
      {
        title: 'Check yourself',
        kind: 'check',
        quiz: [
          { q: 'A program reads part of a file on an NTFS volume. Where does the Windows I/O manager send the request first?',
            choices: ['To the disk\'s hardware driver, which reads files by name', 'To the HAL, which then chooses the right file system', 'To the NTFS file system driver, routed like any other driver', 'To the cache manager, which owns every volume\'s files'], answer: 2,
            feedback: ['A disk driver deals in blocks and sectors; it has no idea what a file name is. The file system driver does that translation.', 'The HAL hides platform hardware differences for drivers; it plays no part in choosing file systems.', null, 'The cache manager serves file systems that call it; requests reach the file system driver first, and the file system decides to use the cache.'],
            why: 'The I/O manager treats a file system driver as just another driver: requests for a volume go to its file system driver, which turns file offsets into block requests for the drivers below.' },
          { type: 'tf', q: 'With lazy write, when WriteFile returns the new data is already safely on the disk.', answer: false,
            why: 'Lazy write only copies the data into a cache page and marks it dirty; a background lazy-writer thread writes it out later. Until then a power failure loses it.' },
          { type: 'num', q: 'A program rewrites the same 4 KB block 25 times within 0.9 s. The lazy writer then runs once and writes every dirty block. How many disk writes does lazy write need for this block in that second?', answer: 1, tol: 0, unit: 'writes',
            why: 'Each lazy-writer run writes a dirty block once, however many times it changed: 25 updates become 1 disk write. Write-through would have needed 25.' },
          { type: 'num', q: 'A thread reads 5 blocks. Each read needs 8 ms of device time (the device serves one request at a time), then 4 ms of processing. With asynchronous I/O the thread starts all 5 reads at once and processes each result as soon as it is ready. Total time in ms?', answer: 44, tol: 0, unit: 'ms',
            why: 'The device is the bottleneck (8 ms ≥ 4 ms): it finishes the last read at 5 × 8 = 40 ms, and processing that result adds 4 ms, so 44 ms. Synchronous I/O would take 5 × (8 + 4) = 60 ms.' },
          { type: 'match', q: 'Match each completion technique to how the thread finds out.',
            pairs: [['Signaling the file object', 'Waits on the file handle, set by any operation on that file'], ['Signaling an event object', 'One event per request shows exactly which one finished'], ['Asynchronous procedure call', 'A completion routine runs in the thread during an alertable wait'], ['I/O completion port', 'A pool of workers takes completions from one shared queue'], ['Polling', 'The thread checks a status word in its own memory']],
            why: 'Five techniques, from simplest (the file object) to most scalable (the completion port); polling never blocks at all.' },
          { q: 'A chat server on a 16-core machine keeps 20,000 connections open and wants to serve them with a few threads. Which completion technique fits best?',
            choices: ['A completion port served by a small pool of worker threads', 'One event object per connection, all waited on together', 'An APC completion routine per connection, all on one thread', 'Polling the status of every connection in a tight loop'], answer: 0,
            feedback: [null, 'One wait call can watch at most 64 objects, and 20,000 events would need many threads just to wait.', 'APCs run only on the thread that issued the I/O, so one thread would use one core out of 16.', 'Checking 20,000 statuses over and over burns processor time even when nothing has finished.'],
            why: 'Completion ports exist for servers: every connection feeds one queue, a few workers take completions, and the kernel keeps about as many running as there are processors.' },
          { q: 'A thread starts a read with ReadFileEx and names a completion routine. When does that routine run?',
            choices: ['At once, interrupting the thread wherever it happens to be', 'On whichever idle thread the system thread pool picks', 'In a brand-new thread that Windows creates just for it', 'When the issuing thread next enters an alertable wait'], answer: 3,
            feedback: ['The APC that carries a completion routine never breaks into the thread at an arbitrary point; it waits in the thread\'s APC queue.', 'An APC is tied to one particular thread, the one that issued the request.', 'No thread is created; the routine runs in the thread that asked for the I/O.', null],
            why: 'The I/O manager queues an APC on the issuing thread. It runs when that thread enters an alertable wait, such as SleepEx with the alertable flag set.' },
          { q: 'What does <b>lazy commit</b> delay?',
            choices: ['Writing the changed data of ordinary files back to disk', 'Writing a transaction\'s commit record to the file system log', 'Building the I/O request packet for a transaction\'s writes', 'Releasing every lock a transaction holds until the disk is idle'], answer: 1,
            feedback: ['That is lazy write. Lazy commit is the transaction-processing version.', null, 'IRPs are built at once for every request; nothing about commit delays them.', 'Lazy commit concerns recording the commit, not holding locks.'],
            why: 'With lazy commit the record that a transaction committed is cached, and a background thread writes it to the file system log later, so the committing thread does not wait for a disk write.' },
          { type: 'bucket', q: 'Hardware RAID or software RAID?', buckets: ['Hardware RAID', 'Software RAID'],
            items: [['Windows sees just one disk', 0], ['Parity is computed by the host CPU', 1], ['Can combine parts of several disks into one volume', 1], ['Needs a RAID controller', 0], ['Windows sends one request per small write', 0], ['Built into Windows, for example Storage Spaces', 1]],
            why: 'Hardware RAID hides the disks behind a controller that does the copying and parity itself. Software RAID is a Windows driver that sees every disk and does that work on the host CPU.' },
          { type: 'multi', q: 'Windows’ built-in system provider keeps a volume shadow copy with copy on write. Which statements about such a shadow copy are true?',
            choices: ['Taking one copies the whole volume at that moment', 'A block is saved just before its first overwrite after the snapshot', 'A backup can copy consistent files while people keep working', 'Unchanged blocks are read from the live volume', 'It survives the failure of the original volume’s disk'], answer: [1, 2, 3],
            why: 'With copy on write nothing is copied when the snapshot is taken, old blocks are saved only when they would be overwritten, and unchanged blocks are shared with the live volume, so it does not protect against that disk dying. (Other providers can make a complete, independent copy instead, such as a split mirror.)' },
          { type: 'order', q: 'Put the steps of a read that misses the cache in order.',
            items: ['The program calls ReadFile', 'The I/O manager builds an IRP and sends it to NTFS', 'NTFS asks the cache manager, but the data is not cached', 'A paging read goes through NTFS to the disk drivers', 'The disk interrupts and the data lands in a cache page', 'The bytes are copied to the program and ReadFile returns'],
            why: 'Down through the I/O manager and the file system to the cache; on a miss, a paging read goes down to the disk; the completion travels back up and the data is copied to the caller.' },
          { type: 'tf', q: 'Because BitLocker works in a driver below the file system, programs read and write files on an encrypted volume exactly as they would on an unencrypted one.', answer: true,
            why: 'The driver encrypts every sector on its way to the disk and decrypts it on the way back, so programs and NTFS see plain data. Only someone reading the raw disk without the key sees scrambled bytes.' },
        ],
      },
    ],
    notes: `
      <h3>Windows I/O: one manager, many drivers</h3>
      <p>Every Windows I/O request goes through the <b>I/O manager</b>, part of the executive. It checks the handle and buffer, describes the request in an <b>I/O request packet (IRP)</b> (operation, file object, offset, byte count, buffer) and sends it to the top driver for that file or device. Drivers pass the IRP down their stack and mark it complete; the I/O manager then returns the result and tells the caller.</p>
      <h4>The four kinds of modules the I/O manager works with</h4>
      <ul>
        <li><b>Cache manager</b>: caches file data for the whole I/O subsystem, for every file system, local or network. The cache lives in main memory and its size changes with free memory: it grows when memory is plentiful and shrinks when processes need it. It caches pieces of files (file + offset), not raw disk blocks. It speeds up writes with <b>lazy write</b> and transactions with <b>lazy commit</b>.</li>
        <li><b>File system drivers</b> (NTFS, FAT, exFAT...): the I/O manager treats a file system driver as just another driver and routes requests for a volume to it. The file system turns file offsets into block requests and sends them to the drivers below.</li>
        <li><b>Network drivers</b>: networking is built in. The redirector makes remote files look local (SMB protocol), TCP/IP is a protocol driver, and each network adapter has its own driver. They are drivers, not part of the executive.</li>
        <li><b>Hardware device drivers</b>: operate physical devices and reach their registers only through entry points of the hardware abstraction layer (HAL). The routines have the same names on every platform, so driver source code is portable across processor types.</li>
      </ul>
      <h4>Request paths</h4>
      <ol>
        <li><b>Cached read:</b> ReadFile → I/O manager builds an IRP → NTFS → cache manager finds the bytes in memory (hit) → copied to the buffer, IRP completed. No disk, no interrupt. (A “fast I/O” shortcut can even skip building the IRP for such reads.)</li>
        <li><b>Read miss:</b> the bytes are not cached, so a paging read goes back through NTFS to the disk drivers, which program the controller through the HAL and start DMA. The thread blocks; the disk interrupts, the data lands in a cache page and is copied to the buffer.</li>
        <li><b>Lazy write:</b> WriteFile → IRP → NTFS → cache manager copies the data into a cache page and marks it dirty → WriteFile returns at once. About a second later the lazy writer thread sends the dirty page down through NTFS to the disk.</li>
        <li><b>Remote read:</b> the IRP goes to the redirector, which sends an SMB read message down through TCP/IP and the adapter driver; the reply comes back up the same way.</li>
      </ol>
      <h4>Lazy write and lazy commit</h4>
      <p><b>Lazy write</b>: record the update in the cache, return immediately, and write it to disk later in the background when the system is less busy. Many updates to one page between two lazy-writer runs become one disk write. The price: until it is written, an update exists only in memory. A program that cannot take that risk opens the file for write-through or calls FlushFileBuffers.</p>
      <p><b>Worked example</b> (lazy writer once per second, one disk write = 10 ms of waiting under write-through): a program rewrites block A 10 times in 2.4 s. Write-through: 10 disk writes and 10 × 10 = 100 ms of waiting. Lazy write: one disk write per run in which A was dirty = 3 disk writes, almost no waiting. If the power fails at 1.47 s, the 2 updates made after the 1.0 s run are lost.</p>
      <p><b>Lazy commit</b>: the transaction version. Instead of writing “this transaction committed” at once, the commit record is cached and a background thread writes it to the file system log later. If the power fails first, recovery treats the transaction as not committed, so the file system stays consistent.</p>
      <h4>Synchronous and asynchronous I/O</h4>
      <p><b>Synchronous</b>: the thread blocks until the operation completes. <b>Asynchronous (overlapped)</b>: the call starts the operation and returns at once (open with FILE_FLAG_OVERLAPPED, pass an OVERLAPPED record); the thread keeps working and the system must later signal completion. It does not speed up the device; it overlaps the thread's work with the device.</p>
      <p>For N reads that each need D ms of device time and C ms of processing: synchronous = N × (D + C). Asynchronous with a device that serves one request at a time = max(N·D + C, D + N·C). With a device that serves all at once = D + N·C. Example N = 4, D = 10, C = 6: 64 ms, 46 ms, 34 ms. Example N = 5, D = 8, C = 4: 60 ms and 44 ms.</p>
      <h4>Five ways to signal that an asynchronous request finished</h4>
      <table>
        <tr><th>Technique</th><th>How the thread learns</th><th>Good for / limitation</th></tr>
        <tr><td>Signal the file object</td><td>Waits on the file handle, which is signaled when an operation on it completes.</td><td>Simple, nothing to create; one request at a time, since every operation on the file signals the same object.</td></tr>
        <tr><td>Signal an event object</td><td>Each request gets its own event; wait on one, any or all of them.</td><td>Several simultaneous requests on one file or device; one event per request, at most 64 per wait call.</td></tr>
        <tr><td>Asynchronous procedure call (APC)</td><td>ReadFileEx names a completion routine, queued on the thread's APC queue; it runs when the thread enters an alertable wait.</td><td>Completion handled on the issuing thread; never runs if the thread never waits alertably.</td></tr>
        <tr><td>I/O completion port</td><td>Completions go to one queue served by a pool of workers; about one runs per processor.</td><td>Servers with many connections; more setup.</td></tr>
        <tr><td>Polling</td><td>The thread checks the status the system writes into its OVERLAPPED record.</td><td>Loops that must never block; checking too often wastes processor time.</td></tr>
      </table>
      <h4>Hardware RAID vs software RAID</h4>
      <p><b>Hardware RAID</b>: a disk controller or storage cabinet combines physical disks and creates and regenerates the redundant data itself; Windows sees one disk and sends one request per write. <b>Software RAID</b>: Windows combines space, even noncontiguous parts of disks, into a logical volume and does the redundancy in a driver on the host CPU. Per small write, software RAID 1 sends 2 writes, and software RAID 5 sends 4 requests (read old data, read old parity, write new data, write new parity, with new parity = old parity ⊕ old data ⊕ new data). Windows supported software RAID 1 and RAID 5, plus striping, first through the fault-tolerant disk driver of Windows NT Server and then, from Windows 2000, through dynamic disks (RAID 5 only on Server editions); since Windows 8 and Server 2012, Storage Spaces provides mirror and parity layouts and dynamic disks are deprecated.</p>
      <h4>Volume shadow copies</h4>
      <p>A shadow copy is a <b>point-in-time view</b> of a whole volume: the volume exactly as it was at one instant, for consistent backups while users work and for recovering earlier file versions. Before it is taken, applications such as databases are asked to flush and briefly pause writes. How the view is kept depends on the <b>provider</b>: some make a complete copy (for example a split mirror, which becomes independent of the original volume), some redirect new writes elsewhere (redirect on write), and the built-in Windows <b>system provider</b>, modelled in this section, uses <b>copy on write</b>: taking it copies nothing; a block is saved to a diff area just before its first overwrite after the snapshot; reading the snapshot takes changed blocks from the diff area and unchanged blocks from the live volume. Such a copy-on-write snapshot is not a backup by itself: if the original disk fails, so does the snapshot. It is the consistent source a backup copies from.</p>
      <h4>BitLocker</h4>
      <p>Full-volume encryption (since Windows Vista): a driver below the file system encrypts every sector written and decrypts every sector read, so programs notice nothing and a stolen disk shows only scrambled data. At boot the key is released by the TPM (Trusted Platform Module, a security chip on the motherboard) only if the early boot files are unchanged, optionally with a PIN or USB startup key; a 48-digit recovery key is the backup.</p>`,
  });
})();
