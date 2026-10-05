// Comment key: a line inside backtick text ends with ${/* comment */''}, an empty-string slot that holds a comment without changing the text on screen (full note at the top of the page).
/* Section 8.6 Android Memory Management
   Original teaching material. Helpers live in this IIFE so nothing leaks into the global scope. */
(() => {  // wraps the whole section in a function that runs once, right away, so its helper names stay private to this file
  const comma = (v) => Number(v).toLocaleString('en-US');  // comma(v): writes a number with thousands commas (2700 becomes "2,700") for the MB figures in the lab
  // Multi-line SVG text.
  function mtext(s, x, y, lines, attrs = {}, lh = 18) {  // mtext(s, x, y, lines, attrs, lh): builds one SVG text label (SVG is the browser's drawing format) that can span several lines
    const t = s('text', Object.assign({ x, y }, attrs));  // creates the text element at (x, y) and copies in any extra settings such as size, weight or alignment
    [].concat(lines).forEach((ln, i) => t.append(s('tspan', { x, dy: i === 0 ? 0 : lh }, ln)));  // [].concat turns a single string into a one-item list; each line becomes a tspan placed lh pixels below the one before
    return t;  // hands back the finished label so the caller can add it to a drawing
  }  // ends mtext
  // A clickable SVG group that also works from the keyboard.
  function hotGroup(ctx, onAct, label, ...kids) {  // hotGroup(ctx, onAct, label, ...kids): wraps drawing parts into one clickable group that the keyboard can also use
    const g = ctx.s('g', { class: 'hot', tabindex: 0, role: 'button', 'aria-label': label }, ...kids);  // class hot gives the pointer cursor and hover style; tabindex 0 lets Tab reach it; role and aria-label name it for screen readers
    g.addEventListener('click', onAct);  // a mouse click runs onAct, the action the caller passed in (in step 1 it fills the info card)
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAct(); } });  // Enter or Space does the same from the keyboard; preventDefault stops Space from scrolling the page
    return g;  // returns the group so the caller can put it in the picture
  }  // ends hotGroup
  /* Step 5 model: a phone with 4,000 MB of RAM. Every number the lab shows comes out of these functions. */
  const LMK = {  // LMK: the made-up phone that the step 5 lab simulates; the name stands for low memory killer
    TOTAL: 4000, SYS: 1300, TRIM: 600, KILL: 300,  // 4,000 MB of RAM, 1,300 of it kept by the system; cached apps trim below 600 MB free and lmkd kills below 300 MB free
    APPS: [  // APPS: the eight apps on the lab's home screen, each with its size, its trimmable cache and how it behaves when left
      { id: 'backup', name: 'Backup', mb: 250, cache: 50, leave: 'service', note: 'keeps uploading photos' },  // Backup: 250 MB with a 50 MB cache; when the user leaves it, it keeps running as a service because it is still uploading
      { id: 'maps', name: 'Maps', mb: 500, cache: 150, leave: 'visible', note: 'floating window' },  // Maps: 500 MB with a 150 MB cache; when left it stays visible, since it keeps a floating window on screen
      { id: 'chat', name: 'Chat', mb: 350, cache: 100, leave: 'cached' },  // Chat: 350 MB with a 100 MB cache; leaving it makes it an ordinary cached app
      { id: 'browser', name: 'Browser', mb: 550, cache: 200, leave: 'cached' },  // Browser: 550 MB with a 200 MB cache; cached when left
      { id: 'camera', name: 'Camera', mb: 700, cache: 150, leave: 'cached' },  // Camera: 700 MB with a 150 MB cache; cached when left
      { id: 'game', name: 'Game', mb: 800, cache: 250, leave: 'cached' },  // Game: 800 MB, the largest app, with a 250 MB cache; cached when left
      { id: 'photos', name: 'Photos', mb: 450, cache: 200, leave: 'cached' },  // Photos: 450 MB with a 200 MB cache; cached when left
      { id: 'mail', name: 'Mail', mb: 300, cache: 100, leave: 'cached' },  // Mail: 300 MB with a 100 MB cache; cached when left
    ],  // closes the APPS list
  };  // closes the LMK model
  LMK.SPACE = LMK.TOTAL - LMK.SYS;  // SPACE: the RAM left for apps after the system's share, 4,000 - 1,300 = 2,700 MB
  const LMK_BY = Object.fromEntries(LMK.APPS.map((a) => [a.id, a]));  // LMK_BY: a lookup table from an app's id (such as 'chat') to its record, so code can find an app's size by name
  const LIVE = ['fg', 'visible', 'service', 'cached'];  // LIVE: the states in which an app still has a process holding RAM; killed and not running are left out
  const STLABEL = { fg: 'foreground', visible: 'visible', service: 'service', cached: 'cached', killed: 'killed', none: 'not running' };  // STLABEL: the words shown on screen for each internal state name (fg is shown as foreground, none as not running)
  function lmkNew() {  // lmkNew(): a freshly switched-on phone, used when the lab starts and on Reset
    return { tick: 0, cold: 0, warm: 0, kills: 0, trimMB: 0, apps: Object.fromEntries(LMK.APPS.map((a) => [a.id, { st: 'none', res: 0, trimmed: false, used: 0 }])) };  // tick is a clock that moves on with every app opened; counters for starts, kills and trimmed MB; every app starts not running
  }  // ends lmkNew
  const freeTxt = (f) => (f < 0 ? `${comma(-f)} MB short` : `${comma(f)} MB free`);  // freeTxt(f): turns a free-memory figure into words, "N MB free", or "N MB short" when it is negative
  const lmkFree = (S) => LMK.SPACE - LMK.APPS.reduce((t, a) => t + (LIVE.includes(S.apps[a.id].st) ? S.apps[a.id].res : 0), 0);  // lmkFree(S): the app space minus the RAM held by every app that still has a process, so the free MB right now
  // cached apps, most recently used first
  const lmkCached = (S) => LMK.APPS.filter((a) => S.apps[a.id].st === 'cached').sort((a, b) => S.apps[b.id].used - S.apps[a.id].used).map((a) => a.id);  // lmkCached(S): the ids of all cached apps, sorted by when they were last used, newest first
  function lmkAdj(S, id) {  // lmkAdj(S, id): the oom_score_adj (how expendable the process is) that Android would give this app in its current state
    const st = S.apps[id].st;  // st is the app's current state
    if (st === 'fg') return 0;  // the foreground app scores 0, the safest value an app can have here
    if (st === 'visible') return 100;  // a visible app scores 100
    if (st === 'service') return 500;  // a background service scores 500
    if (st === 'cached') return Math.min(999, 900 + 10 * lmkCached(S).indexOf(id));  // cached apps score 900, 910, 920... by age (newest lowest), never above 999, so the oldest cached app is the first victim
    return null;  // an app with no process has no score
  }  // ends lmkAdj
  // Open one app: the old foreground app steps back, the new one reuses its process (warm or hot start) or gets a new one (cold start), then the pressure rules run.
  function lmkOpen(S, id) {  // lmkOpen(S, id): what happens when the user taps an app; it changes the phone state S and returns a report of events
    const a = LMK_BY[id], x = S.apps[id];  // a is the app's fixed record (size, cache) and x its changing state in this phone
    const r = { id, kind: 'same', from: x.st, restored: false, need: 0, left: null, trimmed: [], trimMB: 0, killed: [], events: [] };  // r: the report: start kind, the state it came from, what was trimmed and killed, and the log lines for the event list
    if (x.st === 'fg') return r;  // tapping the app that is already in front changes nothing, so the report goes back with kind 'same'
    S.tick++;  // the clock moves on one tick for this open
    const prev = LMK.APPS.find((p) => S.apps[p.id].st === 'fg');  // prev: the app that is in the foreground right now, if any
    if (prev) {  // if there is one, it must step back
      S.apps[prev.id].st = prev.leave; S.apps[prev.id].used = S.tick; r.left = prev.id;  // it takes its leave state (cached, visible or service), remembers when it was last used, and is noted in the report
      r.events.push(`${prev.name} leaves the screen → ${STLABEL[prev.leave]}${prev.note ? ' (' + prev.note + ')' : ''}`);  // log line: which app left the screen and what it became, with the reason for Backup and Maps
    }  // ends the step-back of the old foreground app
    const before = lmkFree(S);  // before: free memory just before the new app needs its RAM, quoted in the log
    if (LIVE.includes(x.st)) {  // an app whose process is still alive skips process creation: a warm or hot start (the model does not track which, since that depends on whether its screen must be rebuilt)
      r.kind = 'warm'; r.need = x.trimmed ? a.cache : 0; S.warm++;  // kind 'warm' stands for "warm or hot": reusing the process needs RAM only to rebuild caches it trimmed earlier; it adds one to the warm-or-hot start count
      r.events.push(`Warm or hot start: ${a.name}’s process still exists, so none is created` + (r.need ? `; it rebuilds ${r.need} MB of trimmed caches (${freeTxt(before)})` : '; no extra RAM needed'));  // log line for the reused process, with the MB it reloads or "no extra RAM needed"
    } else {  // otherwise the app has no process (never opened, or killed), so a new one must be created: a cold start
      r.kind = 'cold'; r.need = a.mb; r.restored = x.st === 'killed'; S.cold++;  // a cold start needs the app's full size; restored is true if it was killed, because then its saved state exists
      r.events.push(`Cold start: new process for ${a.name}${r.restored ? ', given its saved state' : ''}; needs ${a.mb} MB (${freeTxt(before)})`);  // log line for the cold start, with the MB it needs and the free memory before it
    }  // ends the choice between reusing the process (warm or hot start) and creating one (cold start)
    x.st = 'fg'; x.res = a.mb; x.trimmed = false; x.used = S.tick + 0.5;  // the app is now foreground at full size and untrimmed; used gets tick + 0.5 so it counts as newer than the app that just left
    let f = lmkFree(S);  // f: free memory after the new app has taken its RAM
    if (f < LMK.TRIM) {  // first line of defence: if free memory fell below the trim line, cached apps are asked to shrink
      lmkCached(S).forEach((cid) => {  // goes through the cached apps, most recently used first
        const y = S.apps[cid];  // y is that cached app's state
        if (!y.trimmed) { y.trimmed = true; y.res -= LMK_BY[cid].cache; r.trimmed.push(cid); r.trimMB += LMK_BY[cid].cache; }  // an app that has not trimmed yet gives back its cache MB; the app and the MB are added to the report
      });  // ends the loop over cached apps
      if (r.trimmed.length) {  // if at least one app trimmed this time
        S.trimMB += r.trimMB;  // adds the MB to the phone's running total of trimmed memory
        r.events.push(`Trim line crossed (${freeTxt(f)}): onTrimMemory → ${r.trimmed.map((c) => LMK_BY[c].name).join(', ')} free ${r.trimMB} MB of caches → ${freeTxt(lmkFree(S))}`);  // log line: the trim line was crossed, which apps released caches in onTrimMemory, how much, and the free memory after
      } else r.events.push(`Trim line crossed (${freeTxt(f)}), but every cached app has already trimmed`);  // otherwise the log notes that every cached app had already trimmed, so trimming freed nothing more
    }  // ends the trim-line check
    f = lmkFree(S);  // measures free memory again after trimming
    while (f < LMK.KILL) {  // last resort: as long as free memory is below the kill line, lmkd keeps killing one process at a time
      const cands = LMK.APPS.filter((p) => LIVE.includes(S.apps[p.id].st) && S.apps[p.id].st !== 'fg')  // candidates: every app that still has a process except the foreground one...
        .map((p) => ({ id: p.id, adj: lmkAdj(S, p.id) })).sort((p, q) => q.adj - p.adj);  // ...each paired with its oom_score_adj and sorted from highest score to lowest
      if (!cands.length) break;  // if nothing is left to kill (only the foreground app remains), the loop stops
      const v = cands[0], y = S.apps[v.id], got = y.res;  // v is the victim, the highest score; y its state; got the MB its process held
      r.events.push(`Kill line crossed (${freeTxt(f)}): lmkd kills ${LMK_BY[v.id].name} (${STLABEL[y.st]}, adj ${v.adj}) → +${got} MB → ${freeTxt(f + got)}`);  // log line: the kill line was crossed, who lmkd kills (state and score), and how much memory comes back
      r.killed.push({ id: v.id, adj: v.adj, st: y.st, mb: got });  // records the kill in the report so the lab can name the victims
      y.st = 'killed'; y.res = 0; y.trimmed = false; S.kills++;  // the victim is now killed, holds no RAM and has no trimmed caches; the phone's kill count goes up
      f = lmkFree(S);  // measures free memory again before deciding whether another kill is needed
    }  // ends the kill loop
    return r;  // returns the report to the lab, which turns it into the message and the event log
  }  // ends lmkOpen

  Guide.section({  // registers this section with the guide's shell, which builds its pages, glossary and quiz from the object below
    id: '8.6',  // the section number; the shell also turns it into the class sec-8-6 that scopes this section's styles
    title: 'Android Memory Management',  // the full section title shown on its pages
    short: 'Android memory',  // the short name used in the side menu and progress list
    summary: 'How Android stretches Linux memory management for phones: ashmem, ION, zram, trimming and the killer.',  // one-sentence summary shown on the chapter page
    objectives: [  // objectives: what the student should be able to do after this section, listed on the section's opening page
      'Explain what Android keeps from Linux memory management and which three phone constraints (small RAM, flash that wears out, constant app switching) push it to add more.',  // objective 1: what Android keeps from Linux and the three phone limits that make it add more
      'Describe how ashmem (today memfd) shares memory by passing a file descriptor and lets the kernel purge unpinned parts, and how ION (today DMA-BUF heaps) gives devices shared buffers from pools set aside at boot.',  // objective 2: how ashmem shares memory by descriptor and how ION gives hardware shared buffers
      'Explain why phones do not swap to flash, and how dropping clean pages, zram compression, trim requests and the low memory killer free RAM instead.',  // objective 3: why phones avoid swapping to flash and what frees RAM instead
      'Predict which process the low memory killer ends first, and what the user sees when a killed app is reopened.',  // objective 4: predict the low memory killer's first victim and what a reopened app looks like
      'Describe an app’s side of the bargain: stay under its heap limit, let the garbage collector work, shrink caches in onTrimMemory, and save state for a cold start.',  // objective 5: the app's own duties: heap limit, garbage collection, trimming, saving state
    ],  // closes the objectives list
    terms: [  // terms: the key words of this section as [term, definition] pairs; they feed the glossary and the dotted-word pop-ups
      ['Write endurance', 'The limited number of times each block of flash storage can be erased and rewritten before it wears out. Constant heavy writing, such as paging to a swap area, uses it up.'],  // glossary entry: write endurance, the limited number of rewrites a flash block survives
      ['File-backed page', 'A page whose contents came from a file on storage, such as program code or an image resource. If it has not been changed (a clean page), the kernel can simply drop it and read it back from the file later.'],  // glossary entry: file-backed page, and why a clean one can simply be dropped
      ['Anonymous page', 'A page of data created while a program runs, such as heap objects, with no file behind it on storage. It cannot just be dropped: it must stay in RAM, go to swap (on a phone usually zram), or vanish with its process.'],  // glossary entry: anonymous page, which has no file behind it and cannot just be dropped
      ['zram', 'A Linux feature that makes a swap device out of RAM itself: pages being swapped out are compressed (often to about a third of their size) and kept in memory, so cold data takes less room and nothing is written to flash.'],  // glossary entry: zram, a compressed swap area kept in RAM
      ['Anonymous shared memory (ashmem)', 'An Android addition to the Linux kernel: a named block of shared memory handed out as a file descriptor. A process that receives the descriptor can map the same memory, and parts the owner has unpinned can be reclaimed by the kernel under pressure.'],  // glossary entry: anonymous shared memory (ashmem), shared memory handed out as a file descriptor
      ['Unpinned region', 'Part of an ashmem block that its owner has marked as not needed for now. Under memory pressure the kernel may purge (discard) it; when the owner pins it again, the kernel says whether the contents survived.'],  // glossary entry: unpinned region, the part of an ashmem block the kernel may purge
      ['memfd', 'The standard Linux way (the memfd_create call) to make an anonymous file that lives in RAM and get a file descriptor for it, which can be passed and mapped just like ashmem. Newer Android versions use it in place of ashmem.'],  // glossary entry: memfd, the standard Linux replacement for ashmem
      ['ION', 'An Android memory allocator for buffers shared by processes and hardware such as the graphics processor, display controller and camera. It manages several pools (heaps), some set aside at boot, and hands out each buffer as a file descriptor.'],  // glossary entry: ION, the allocator for buffers shared with hardware
      ['DMA-BUF heaps', 'The mainline Linux mechanism that replaced ION from Android 12 on: named memory pools that hand out shareable DMA-BUF buffers. Same idea as ION, in standard Linux form.'],  // glossary entry: DMA-BUF heaps, the mainline Linux replacement for ION
      ['Zero-copy sharing', 'Handing a buffer from one process or device to the next by sharing the same physical memory (usually through a file descriptor) instead of copying its bytes.'],  // glossary entry: zero-copy sharing, passing a buffer along instead of copying its bytes
      ['Memory pressure', 'How hard the system is struggling to find free RAM: how little is free, how fast the kernel must reclaim, and how long tasks stall waiting for memory.'],  // glossary entry: memory pressure, how hard the system is struggling to find free RAM
      ['Pressure stall information (PSI)', 'A Linux kernel feature that reports the share of recent time in which tasks were stalled waiting for a resource such as memory. Since Android 10, lmkd uses it to decide when to kill.'],  // glossary entry: pressure stall information (PSI), the kernel's measure of time lost waiting for memory
      ['Low memory killer (LMK)', 'The part of Android that, when RAM runs short and asking apps to free memory is not enough, ends whole processes, least important first. It began as a driver inside the Linux kernel; today the user-space daemon lmkd does the job.'],  // glossary entry: low memory killer (LMK), which ends whole processes when RAM runs short
      ['lmkd (low memory killer daemon)', 'The user-space program that replaced the kernel low-memory-killer driver. It watches the kernel’s memory pressure signals and, when pressure is too high, kills the process with the highest oom_score_adj.'],  // glossary entry: lmkd, the user-space daemon (background program) that does the killing today
      ['oom_score_adj (OOM adjustment score)', 'A number from −1000 to 1000 that Android’s framework sets for every app process to say how expendable it is: 0 for the foreground app, 100 for a visible one, 200 for one the user can perceive (music playing), about 500 for a background service, 900 to 999 for cached apps. The killer picks the highest score first.'],  // glossary entry: oom_score_adj, the number that says how expendable a process is, with the typical values
      ['onTrimMemory', 'A callback Android makes into an app when its screens become hidden or when it sits in the cached list, so the app can release caches it is able to rebuild later.'],  // glossary entry: onTrimMemory, the callback that asks an app to release caches
      ['Heap limit (memory class)', 'The largest size an app’s managed (Java or Kotlin) heap may grow to, fixed per device and often a few hundred megabytes. Going past it throws an OutOfMemoryError.'],  // glossary entry: heap limit (memory class), the ceiling on an app's managed heap
      ['Garbage collector (GC)', 'The part of the Android runtime that finds objects the app can no longer reach and frees their memory automatically, so programmers never free objects by hand.'],  // glossary entry: garbage collector (GC), which frees unreachable objects automatically
      ['Cold start', 'Launching an app whose process is not in memory: Android must create a new process and the app must rebuild its screens, using any saved state. If the process still exists, Android skips creating it: a warm start must still recreate the activity (the screen), while a hot start just brings the existing activity back to the front. Both are usually much faster, though the app may still rebuild caches or redraw its screen.'],  // glossary entry: cold start (a new process), compared with warm start (process kept, activity recreated) and hot start (activity brought back)
      ['Saved instance state', 'A small bundle of screen state (text being typed, scroll position) that an activity hands to Android before it may be destroyed, and gets back when it is recreated after its process was killed.'],  // glossary entry: saved instance state, the small bundle that lets a killed screen come back as it was
    ],  // closes the terms list
    css: ` /* css: this section's own style rules; every rule starts with .sec-8-6 so it only affects this section's pages */
      .sec-8-6 .hot { cursor: pointer; } /* hot (clickable) drawing groups show the hand-shaped pointer so students know they can click them */
      .sec-8-6 .hot:hover rect, .sec-8-6 .hot:hover path { filter: brightness(0.97); } /* hovering a clickable group darkens its shapes very slightly as feedback */
      .sec-8-6 .hot:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; } /* keyboard focus on a clickable group draws an accent outline around it, so Tab users see where they are */
      .sec-8-6 .tx-ok { fill: var(--ok); } /* tx-ok: SVG text filled in success green (fill is how SVG colors text) */
      .sec-8-6 .tx-bad { fill: var(--bad); } /* tx-bad: SVG text in error red, for purged regions and copy warnings */
      .sec-8-6 .tx-mem { fill: var(--mem); } /* tx-mem: SVG text in memory green */
      .sec-8-6 .tx-os { fill: var(--os); } /* tx-os: SVG text in operating system purple, used for the Binder hand-off label */
      .sec-8-6 .tx-io { fill: var(--io); } /* tx-io: SVG text in input/output orange */
      .sec-8-6 .tx-proc { fill: var(--proc); } /* tx-proc: SVG text in process teal */
      .sec-8-6 .tx-warn { fill: var(--warn); } /* tx-warn: SVG text in warning amber, used for the unpinned label and the trim line */
      .sec-8-6 .tx-muted { fill: var(--muted); } /* tx-muted: grey SVG text for placeholders such as "no region yet" */
      .sec-8-6 .c-ok { color: var(--ok); } /* c-ok: ordinary page text in success green, for good results such as 0 storage writes */
      .sec-8-6 .c-bad { color: var(--bad); } /* c-bad: page text in error red, for bad results such as copying MB/s */
      .sec-8-6 .c-mem { color: var(--mem); } /* c-mem: page text in memory green, used for the "Small RAM" and "File-backed page" headings */
      .sec-8-6 .c-os { color: var(--os); } /* c-os: page text in operating system purple */
      .sec-8-6 .c-io { color: var(--io); } /* c-io: page text in input/output orange, used for the flash heading */
      .sec-8-6 .c-proc { color: var(--proc); } /* c-proc: page text in process teal, used for the "Anonymous page" heading */
      .sec-8-6 .c-warn { color: var(--warn); } /* c-warn: page text in warning amber */
      .sec-8-6 .kv { display: grid; grid-template-columns: auto 1fr; gap: 2px 10px; align-items: baseline; } /* kv: a two-column grid for the lab's legend, a state chip on the left and its meaning on the right */
      .sec-8-6 .homegrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; } /* homegrid: the lab's home screen, app buttons in two equal columns with small gaps */
      .sec-8-6 .appbtn { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 3px 6px; align-items: center; text-align: left; padding: 6px 10px; border: 1px solid var(--line-2); border-left: 5px solid var(--line-2); border-radius: 10px; background: var(--panel); color: var(--ink); font: inherit; font-size: 15px; cursor: pointer; min-width: 0; } /* appbtn: one app button: its name and MB on the first row, its state chip below, with a thick colored left edge */
      .sec-8-6 .appbtn:hover { border-color: var(--accent); } /* hovering an app button colors its border in the accent color */
      .sec-8-6 .appbtn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; } /* keyboard focus on an app button shows an accent outline */
      .sec-8-6 .appbtn > b { grid-column: 1; grid-row: 1; } /* the app's name sits in the first column of the first row */
      .sec-8-6 .appbtn > .xs { grid-column: 2; grid-row: 1; } /* the MB figure sits at the right end of the first row */
      .sec-8-6 .appbtn > .chip { grid-column: 1 / span 2; grid-row: 2; justify-self: start; } /* the state chip spans the second row and stays left-aligned */
      .sec-8-6 .appbtn.st-fg { border-left-color: var(--ok); background: var(--ok-bg); } /* the foreground app gets a green left edge and a pale green fill */
      .sec-8-6 .appbtn.st-visible { border-left-color: var(--proc); } /* a visible app gets a teal left edge */
      .sec-8-6 .appbtn.st-service { border-left-color: var(--accent); } /* a service app gets an indigo left edge */
      .sec-8-6 .appbtn.st-cached { border-left-color: var(--warn); } /* a cached app gets an amber left edge */
      .sec-8-6 .appbtn.st-killed { border-left-color: var(--bad); } /* a killed app gets a red left edge */
    `,  // end of the section's style text
    steps: [  // steps: the list of pages in this section, in the order the student sees them
      /* ---------------- 1. Big picture ---------------- */
      {  // opens step 1, the big picture
        title: 'A phone is not a small PC: Linux memory, stretched',  // the title shown at the top of step 1
        kind: 'story',  // kind 'story' marks this as the big-picture page, which is always on the core path
        render(el, ctx) {  // render(el, ctx): draws the step into el when the student arrives; ctx is the shell's toolbox
          const { h, s } = ctx;  // takes the two element builders from ctx: h makes page elements and s makes SVG drawing elements
          const INFO = {  // INFO: what the info card shows for each box in the picture: [title, color, explanation]
            apps: ['Apps (one process each)', 'proc', 'Each app is its own Linux process. Its Java or Kotlin objects live in a heap run by the <b>Android runtime</b>, whose garbage collector frees dead objects. The heap has a size limit. Step 6 looks inside one app.'],  // info for the app boxes: each app is a process with a garbage-collected heap that has a size limit
            am: ['Activity Manager (framework)', 'os', 'Part of Android’s system server. It ranks every app process by importance (foreground, visible, service, cached), has each rank stored in the kernel as an <b>oom_score_adj</b> number, and asks hidden or cached apps to shrink with <b>onTrimMemory</b>.'],  // info for the Activity Manager: it ranks apps, stores each rank as an oom_score_adj and sends trim requests
            lmkd: ['lmkd: the low memory killer', 'intr', 'A user-space daemon. It listens to the kernel’s memory pressure signals and, when asking apps nicely has not freed enough, kills the process with the highest oom_score_adj: normally the least recently used cached app. Step 5.'],  // info for lmkd: the user-space killer that ends the process with the highest score when pressure is high
            linux: ['Inherited from Linux', 'mem', 'Everything from the rest of this chapter still applies: virtual address spaces, page tables, demand paging, the page cache for files, the buddy and slab allocators (section 8.4). Android did not replace any of it.'],  // info for the plain Linux part: everything earlier in the chapter still applies unchanged
            ashmem: ['ashmem, now memfd', 'acc', 'Shared memory that travels as a <b>file descriptor</b>: one process creates it, sends the descriptor to another, and both map the same pages. Unpinned parts may be purged under pressure. Newer versions use standard Linux memfd. Step 3.'],  // info for ashmem: shared memory that travels as a file descriptor, purgeable when unpinned
            ion: ['ION, now DMA-BUF heaps', 'acc', 'An allocator for big buffers that hardware reads and writes directly (camera frames, textures, screen images). It manages pools, some reserved at boot, and shares each buffer as a descriptor so nothing is copied. Step 4.'],  // info for ION: pools of big hardware buffers, some reserved at boot, shared without copying
            zram: ['zram', 'acc', 'A swap area that lives <b>in RAM</b>: cold anonymous pages are compressed to about a third of their size instead of being written to flash. Plain Linux supports it too; Android phones lean on it heavily. Step 2.'],  // info for zram: a compressed swap area that stays in RAM instead of writing to flash
            psi: ['Pressure signals (PSI)', 'acc', 'With <span class="t" data-t="Pressure stall information (PSI)">pressure stall information</span>, the kernel measures how much time tasks spend stalled waiting for memory and reports it. lmkd uses these signals to decide when the situation is bad enough to kill.'],  // info for the pressure signals: the kernel measures stall time and lmkd uses it to decide when to kill
            ram: ['RAM', 'mem', 'Typically 4 to 16 GB on a modern phone, shared by the kernel, Android’s own services and every app the user has opened. There is no add-on memory to fall back on.'],  // info for RAM: a few gigabytes shared by everything, with nothing to fall back on
            flash: ['Flash storage', 'io', 'Holds apps, photos and files. Each block survives only a limited number of rewrites (its <b>write endurance</b>), and writing costs battery. That is why phones normally have no swap partition. Step 2.'],  // info for flash: limited rewrites and battery cost, which is why there is normally no swap
            dev: ['Graphics, display, camera', 'cpu', 'Hardware engines that move large images straight to and from memory by <span class="t">DMA</span>. Some need memory with special properties, such as one physically contiguous block. ION serves them.'],  // info for the hardware devices: engines that use DMA and may need special memory, which ION serves
          };  // closes the INFO table
          const info = h('div', { class: 'card tight', style: { minHeight: '104px', flex: 'none' } });  // info: the card under the picture that shows the explanation of the clicked box; fixed minimum height so it does not jump
          const groups = {};  // groups: the clickable groups of the picture, filled in below by name, so pick can dim all but one
          function pick(k) {  // pick(k): runs when the student clicks box k; fills the info card and highlights that box
            const [t, c, body] = INFO[k];  // takes the title, color key and explanation of box k
            const cc = c === 'acc' ? 'accent' : c;  // the short key acc stands for the CSS color variable accent
            info.innerHTML = `<div class="b" style="color:var(--${cc});margin-bottom:2px">${t}</div><div class="small">${body}</div>`;  // writes the title in the box's color and the explanation below it in smaller text
            Object.entries(groups).forEach(([kk, g]) => (g.style.opacity = kk === k ? '1' : '0.55'));  // the chosen group stays fully visible and every other group fades to 55%, so the eye goes to the clicked box
          }  // ends pick
          const box = (x, y, w, hh, cls, lines, sub, fs = 15) => [  // box(...): builds one labelled box: a rounded rectangle, a bold centered label and an optional grey sub-label
            s('rect', { x, y, width: w, height: hh, rx: 10, class: cls, 'stroke-width': 2 }),  // the rounded rectangle, colored by its class
            mtext(s, x + w / 2, y + (sub ? hh / 2 - 3 : hh / 2 + 5 - ([].concat(lines).length - 1) * 8), lines, { 'text-anchor': 'middle', 'font-weight': 800, 'font-size': fs }, 16),  // the bold label: centered across, and moved up a little when there is a sub-label or several lines
            sub ? s('text', { x: x + w / 2, y: y + hh / 2 + 14, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, sub) : null,  // the grey sub-label just under the middle, if this box has one
          ].filter(Boolean);  // filter(Boolean) drops the empty slot left when there is no sub-label
          // Two layouts of the same picture: wide for the desktop canvas, tall for small screens.
          const L = ctx.narrow ? {  // L: positions of every box; the tall layout is chosen on phone-width screens, the wide one on desktops
            vb: '0 0 340 424', lab: [[14, 'USER SPACE'], [178, 'KERNEL'], [366, 'HARDWARE']], legend: [336, 178],  // tall layout: the drawing's coordinate size (viewBox), the heights of the three layer labels, and where the legend goes
            apps: (i) => [4 + i * 114, 20, 104, 46], am: [4, 72, 332, 40, 'Activity Manager: ranks apps, sends trims', null, 14],  // tall layout: the three app boxes side by side, and the Activity Manager box under them across the full width
            lmkd: [4, 118, 332, 40, 'lmkd · low memory killer', null, 15], kern: [4, 184, 332, 166],  // tall layout: the lmkd box under the Activity Manager, and the large kernel rectangle
            linux: [14, 192, 312, 44, 'virtual memory, paging, page cache', null, 14], ashmem: [14, 242, 152, 38, 'ashmem / memfd', null, 14],  // tall layout: the plain Linux box across the kernel, then ashmem on the left of the next row
            ion: [174, 242, 152, 38, 'ION / DMA-BUF', null, 14], zram: [14, 286, 152, 56, ['zram (compressed', 'swap in RAM)'], null, 14],  // tall layout: ION beside ashmem, and zram (two-line label) on the left of the row below
            psi: [174, 286, 152, 56, ['pressure', 'signals (PSI)'], null, 14], ram: [4, 372, 106, 46, 'RAM', '4–16 GB'],  // tall layout: the pressure-signals box beside zram, and the RAM box at the start of the hardware row
            flash: [116, 372, 108, 46, 'Flash', 'wears out'], dev: [230, 372, 106, 46, 'GPU, camera', 'big buffers'], link: null,  // tall layout: flash and the devices finish the hardware row; link is null because this layout draws no connector line
          } : {  // the wide layout for desktop screens starts here
            vb: '0 0 640 306', lab: [[14, 'USER SPACE'], [142, 'KERNEL'], [258, 'HARDWARE']], legend: [632, 142],  // wide layout: the drawing's coordinate size, the heights of the three layer labels and the legend's position
            apps: (i) => [4 + i * 128, 20, 120, 50], am: [4, 78, 376, 44, 'Activity Manager: ranks apps, sends trims', null, 14.5],  // wide layout: three wider app boxes, and the Activity Manager box under them on the left
            lmkd: [392, 20, 244, 102, ['lmkd', 'low memory killer'], null, 16], kern: [4, 148, 632, 98],  // wide layout: a tall lmkd box on the right beside the apps, and the kernel rectangle across the whole picture
            linux: [14, 156, 196, 82, ['virtual memory,', 'paging, page cache'], null, 14], ashmem: [220, 156, 132, 38, 'ashmem / memfd', null, 14],  // wide layout: the plain Linux box on the left of the kernel, then ashmem in the next column
            ion: [220, 200, 132, 38, 'ION / DMA-BUF', null, 14], zram: [362, 156, 126, 82, ['zram', '(compressed', 'swap in RAM)'], null, 14],  // wide layout: ION under ashmem, and the tall zram box with a three-line label
            psi: [498, 156, 128, 82, ['pressure', 'signals (PSI)'], null, 14], ram: [4, 262, 200, 42, 'RAM', '4–16 GB, no more'],  // wide layout: the pressure-signals box on the far right of the kernel, and RAM at the start of the hardware row
            flash: [216, 262, 200, 42, 'Flash storage', 'wears out with writes'], dev: [428, 262, 208, 42, 'GPU · display · camera', 'big shared buffers'], link: [380, 100, 390, 100],  // wide layout: flash and the devices finish the hardware row; link is a short line joining the Activity Manager to lmkd
          };  // closes the layout table L
          const bx = (k, cls) => { const [x, y, w, hh, lines, sub, fs] = L[k]; return box(x, y, w, hh, cls, lines, sub, fs); };  // bx(k, cls): looks up box k's position and labels in the chosen layout and builds it with the color class cls
          const svg = s('svg', { viewBox: L.vb, width: '100%' });  // the drawing itself, sized by the layout's viewBox and stretched to the card's full width
          svg.append(...L.lab.map(([y, txt]) => s('text', { x: 4, y, 'font-size': 13, 'font-weight': 700, class: 's-sub' }, txt)));  // writes the grey layer labels USER SPACE, KERNEL and HARDWARE down the left edge
          groups.apps = hotGroup(ctx, () => pick('apps'), 'Apps',  // the three app boxes form one clickable group named Apps; clicking any of them explains apps
            ...[0, 1, 2].flatMap((i) => { const [x, y, w, hh] = L.apps(i); return box(x, y, w, hh, 's-proc', 'App ' + 'ABC'[i], 'heap + GC'); }));  // builds App A, App B and App C in process teal, each with the sub-label "heap + GC"
          groups.am = hotGroup(ctx, () => pick('am'), 'Activity Manager', ...bx('am', 's-os'));  // the Activity Manager box, in operating system purple, clickable
          groups.lmkd = hotGroup(ctx, () => pick('lmkd'), 'lmkd', ...bx('lmkd', 's-intr'));  // the lmkd box, in interrupt red because it is the one that kills, clickable
          const [kx, ky, kw, kh] = L.kern;  // takes the kernel rectangle's position and size from the layout
          svg.append(s('rect', { x: kx, y: ky, width: kw, height: kh, rx: 12, class: 's-os', 'stroke-width': 2, style: 'fill-opacity:.45' }));  // draws the large faded purple kernel rectangle first, so the kernel boxes sit on top of it
          groups.linux = hotGroup(ctx, () => pick('linux'), 'Inherited from Linux', ...bx('linux', 's-mem'));  // the plain Linux box in memory green, to show it is unchanged Linux
          groups.ashmem = hotGroup(ctx, () => pick('ashmem'), 'ashmem', ...bx('ashmem', 's-accent'));  // the ashmem box, tinted indigo as something Android adds
          groups.ion = hotGroup(ctx, () => pick('ion'), 'ION', ...bx('ion', 's-accent'));  // the ION box, tinted indigo as something Android adds
          groups.zram = hotGroup(ctx, () => pick('zram'), 'zram', ...bx('zram', 's-accent'));  // the zram box, tinted indigo as something Android leans on heavily
          groups.psi = hotGroup(ctx, () => pick('psi'), 'Pressure signals', ...bx('psi', 's-accent'));  // the pressure-signals box, tinted indigo because lmkd relies on it
          groups.ram = hotGroup(ctx, () => pick('ram'), 'RAM', ...bx('ram', 's-mem'));  // the RAM box in memory green
          groups.flash = hotGroup(ctx, () => pick('flash'), 'Flash storage', ...bx('flash', 's-io'));  // the flash storage box in input/output orange
          groups.dev = hotGroup(ctx, () => pick('dev'), 'Graphics, display, camera', ...bx('dev', 's-cpu'));  // the hardware devices box in processor blue
          svg.append(...Object.values(groups),  // adds every clickable group to the drawing at once...
            L.link ? s('line', { x1: L.link[0], y1: L.link[1], x2: L.link[2], y2: L.link[3], class: 's-line' }) : '',  // ...plus the connector line in the wide layout (an empty string adds nothing in the tall one)...
            s('text', { x: L.legend[0], y: L.legend[1], 'text-anchor': 'end', 'font-size': 13, style: 'fill:var(--accent)', 'font-weight': 700 }, ctx.narrow ? 'tinted = Android adds' : 'tinted = Android leans on or adds'));  // ...and the indigo legend at the right edge explaining what the tinted boxes mean, shorter on small screens
          info.innerHTML = '<div class="b">Click any box in the picture.</div><div class="small muted">Green parts are plain Linux. Indigo parts are what Android adds or relies on to cope with phone limits.</div>';  // the info card's starting text: invites a click and explains the green versus indigo color code

          el.append(h('div', { class: 'split l fill' },  // builds the page: a two-column split, text on the left and the picture on the right, filling the step's height
            h('div', { class: 'stack', style: { gap: '10px' } },  // left column: a stack of text blocks with 10px between them
              h('p', { class: 'lead m0', html: '<span class="t">Android</span> runs on the <span class="t">Linux</span> kernel, so it inherits all of the <span class="t">virtual memory</span> machinery from this chapter. But a phone is not a small PC.' }),  // opening sentence: Android inherits Linux virtual memory, but a phone is not a small PC
              h('div', { class: 'card tight small', html: '<b class="c-mem">1 · Small RAM, many apps.</b> A few gigabytes are shared by dozens of apps that the user hops between all day, and every switch back should feel instant.' }),  // card for phone limit 1: little RAM shared by many apps that must switch back instantly
              h('div', { class: 'card tight small', html: '<b class="c-io">2 · Flash, not a hard disk.</b> Flash cells survive a limited number of rewrites and writing drains the battery, so phones normally have <b>no swap area</b> on storage.' }),  // card for phone limit 2: flash wears out and costs battery, so there is no swap area
              h('div', { class: 'card tight small', html: '<b class="c-os">3 · Hardware that shares big buffers.</b> Camera, graphics processor and display pass large images to each other many times a second.' }),  // card for phone limit 3: hardware devices pass large images to each other
              h('div', { class: 'callout analogy m0 small', 'data-label': 'Analogy', html: 'A tiny flat with no storage unit: you vacuum-pack clothes you rarely wear, share one toolbox with your flatmates, and when the wardrobe is truly full, whatever you used longest ago goes out.' })),  // analogy callout: a small flat where rarely used things are compressed, tools are shared and old things go out
            h('div', { class: 'stack', style: { gap: '6px' } }, h('div', { class: 'card white', style: { padding: '3px 10px' } }, svg), info,  // right column: the picture in a white card, followed by the info card
              h('div', { class: 'callout why m0 small', 'data-label': 'What Android adds', html: 'A few kernel additions, a pressure-driven <span class="t">low memory killer</span>, and rules every app must follow. By the end of this section you can predict which app dies first, and why.' }))));  // "What Android adds" callout under the picture: a preview of what this section explains, ending the page
        },  // ends render() for step 1
      },  // closes step 1
      /* ---------------- 2. Reclaiming pages without swap ---------------- */
      {  // opens step 2, reclaiming pages without swap
        title: 'Short on RAM: drop, compress or kill, never swap to flash',  // the title shown at the top of step 2
        kind: 'compare',  // kind 'compare': this step compares a desktop with two kinds of phone
        render(el, ctx) {  // render(el, ctx): draws step 2 when the student arrives
          const { h, s } = ctx;  // takes the HTML builder h and the SVG builder s from the shell's toolbox
          const GOAL = 8, RATIO = 3;  // GOAL: the camera needs 8 free frames; RATIO: zram squeezes 3 heap pages into 1 frame
          const START = ['code', 'code', 'code', 'code', 'icon', 'icon', 'heap', 'heap', 'heap', 'heap', 'heap', 'heap'];  // START: the 12 frames that the background Photos app holds at first: 4 code pages, 2 icon pages and 6 heap pages
          const MODES = [  // MODES: the three machines the student can switch between
            { value: 'pc', label: 'Desktop Linux (swap on disk)' },  // a desktop running Linux, with a swap area on its disk
            { value: 'phone', label: 'Phone, no zram' },  // a phone with no swap area at all
            { value: 'zram', label: 'Phone with zram' },  // a phone with zram, a compressed swap area inside RAM
          ];  // closes the MODES list
          let mode = 'pc', frames, writes, rereads, swapped, killed, lastMsg;  // the step's changing state: the chosen machine, the 12 frames, counts of writes, re-reads and swapped pages, and the last message
          // Wide layout puts RAM and flash side by side; small screens stack them.
          const G = ctx.narrow  // G: positions of every shape; the tall layout is used on phone-width screens, the wide one on desktops
            ? { vb: '0 0 340 372', ram: [4, 4, 332, 228], title: [14, 'RAM: frames held by Photos'], tile: (i) => [12 + (i % 4) * 80, 40 + Math.floor(i / 4) * 62, 74], flash: [4, 240, 332, 128], ftitle: [170, 262],  // tall layout: viewBox, the RAM box on top, its title, tile(i) places frame i in a 4-wide grid, then the flash box below
              file: [14, 272, 150, 86], fileTxt: [89, 296, ['Photos app file', 'code + icons,', 'always here']], swap: [176, 272, 150, 86], swapT: [251, 290], swapTile: (k) => [184 + (k % 3) * 46, 298 + Math.floor(k / 3) * 30, 40, 26], noSwap: [251, 300] }  // tall layout: the app file box, its three-line label, the swap box, and swapTile(k) for each page written to swap
            : { vb: '0 0 620 236', ram: [4, 4, 392, 228], title: [16, 'RAM: frames held by Photos (in the background)'], tile: (i) => [18 + (i % 4) * 94, 40 + Math.floor(i / 4) * 62, 84], flash: [412, 4, 204, 228], ftitle: [514, 26],  // wide layout: viewBox, the RAM box on the left, its longer title, a wider tile grid, and the flash box on the right
              file: [424, 38, 180, 58], fileTxt: [514, 60, ['Photos app file', 'code + icons, always here']], swap: [424, 106, 180, 116], swapT: [514, 126], swapTile: (k) => [434 + (k % 3) * 56, 136 + Math.floor(k / 3) * 42, 48, 34], noSwap: [514, 150] };  // wide layout: the app file box, its label, the swap box and its tiles, all inside the flash box
          const svg = s('svg', { viewBox: G.vb, width: '100%' });  // the drawing, sized by the chosen layout's viewBox
          const meter = h('div', { class: 'meter', style: { flex: '1' } }, h('i'));  // meter: a thin progress bar showing how close the free frames are to the goal; the inner i element is its fill
          const freeTxt = h('span', { class: 'small b num' });  // freeTxt: the "N free / 8 needed" text beside the meter
          const stats = h('div', { class: 'small num' });  // stats: a line counting storage writes, pages to read back later and whether the process is alive
          const say = h('div', { class: 'callout m0 small', style: { minHeight: '92px' } });  // say: the colored message box that explains each action; fixed minimum height so the layout does not jump
          const bDrop = h('button', { class: 'btn sm mem', type: 'button', onclick: () => act('drop') }, 'Drop clean file pages');  // button: drop the clean file-backed pages (code and icons), in memory green
          const bHeap = h('button', { class: 'btn sm proc', type: 'button', onclick: () => act('heap') }, 'Move heap pages out');  // button: move the heap pages out, which behaves differently on each machine, in process teal
          const bKill = h('button', { class: 'btn sm intr', type: 'button', onclick: () => act('kill') }, 'Kill the Photos process');  // button: kill the whole Photos process, in interrupt red, as the last resort
          const bReset = h('button', { class: 'btn sm ghost', type: 'button', onclick: () => reset() }, '⟲ Reset');  // button: start over with the same machine
          const seg = ctx.ui.seg(MODES, mode, (v) => { mode = v; reset(); });  // seg: the switch between the three machines; choosing one stores it and resets the experiment
          const freeCount = () => frames.filter((f) => f === 'free').length;  // freeCount(): how many of the 12 frames are free right now
          function reset() {  // reset(): puts all 12 frames back and clears the counters; runs at the start, on Reset and on a machine switch
            frames = START.slice(); writes = 0; rereads = 0; swapped = 0; killed = false;  // copies START (slice makes a fresh copy so changes never touch the original list) and zeroes every counter
            lastMsg = ['', 'Your move', mode === 'pc'  // the opening message, which depends on the machine chosen
              ? 'A desktop has a <b>swap area</b> on its disk. The camera needs <b>' + GOAL + ' free frames</b>. Try the buttons from left to right.'  // desktop message: there is a swap area on disk and the camera needs 8 free frames
              : 'A phone has <b>no swap area</b> on flash' + (mode === 'zram' ? ', but this one has <b>zram</b>: a compressed swap area inside RAM.' : ' and, here, no zram either.') + ' The camera needs <b>' + GOAL + ' free frames</b>. Try the buttons from left to right.'];  // phone message: no swap area on flash, then whether this phone has zram, and the same goal
            paint();  // draws everything with the new state
          }  // ends reset
          function act(kind) {  // act(kind): runs when one of the three action buttons is clicked
            if (killed) { lastMsg = ['warn', 'Already gone', 'The Photos process is dead; all of its frames are free. Press Reset to try again.']; return paint(); }  // once Photos is killed nothing else can happen, so the message says to press Reset
            if (kind === 'drop') {  // the Drop button
              const n = frames.filter((f) => f === 'code' || f === 'icon').length;  // n: how many clean file-backed frames (code or icon) are still in RAM
              if (!n) lastMsg = ['warn', 'Nothing left to drop', 'Every clean file-backed page is already gone.'];  // if none are left, a warning says so
              else {  // otherwise they are dropped
                frames = frames.map((f) => (f === 'code' || f === 'icon' ? 'free' : f)); rereads += n;  // every code and icon frame becomes free with no writes; each one will be read back from the file later
                lastMsg = ['tip', 'Cheap and safe', `${n} clean <span class="t">file-backed pages</span> dropped, with <b>no writes</b>: the app’s file on flash still holds every byte. If Photos runs again, those pages are simply read back (${n} reads).`];  // message: clean file pages are cheap to drop because the file on flash still has every byte
              }  // ends the drop case
            } else if (kind === 'heap') {  // the Move heap button
              const idx = frames.map((f, i) => (f === 'heap' ? i : -1)).filter((i) => i >= 0);  // idx: the positions of the heap frames still in RAM
              if (!idx.length) lastMsg = ['warn', 'Nothing left to move', 'No uncompressed heap pages remain.'];  // if there are none, a warning says so
              else if (mode === 'pc') {  // on the desktop the heap pages go to the swap area on disk
                idx.forEach((i) => (frames[i] = 'free')); writes += idx.length; swapped += idx.length;  // each heap frame becomes free, and each one counts as a storage write and a page swapped out
                lastMsg = ['warn', 'Works, but writes to storage', `${idx.length} <span class="t">anonymous pages</span> written to the swap area: <b>${idx.length} page writes</b> now, and ${idx.length} reads when Photos is used again. A phone doing this all day spends battery and wears out its flash.`];  // message: it works, but writes to storage, which on a phone would cost battery and flash wear
              } else if (mode === 'phone') {  // on a phone without zram
                lastMsg = ['bad', 'Nowhere to put them', `These ${idx.length} heap pages have no file behind them and there is no swap area. They stay in RAM until Photos frees them itself (a trim request) or its process dies.`];  // message: heap pages have no file and there is no swap area, so they stay until Photos frees them or dies
              } else {  // otherwise the machine is the phone with zram
                const z = Math.ceil(idx.length / RATIO);  // z: how many frames the compressed heap pages need, rounded up (6 pages at 3 to 1 need 2 frames)
                idx.forEach((i, k) => (frames[i] = k < z ? 'zram' : 'free'));  // the first z heap frames now hold compressed zram data and the rest become free
                lastMsg = ['tip', 'Compressed, still in RAM', `${idx.length} heap pages compressed about ${RATIO}:1 into <b>${z} frames</b> of <span class="t">zram</span>, so ${idx.length - z} frames come free. No flash writes; the price is a little processor time now and to decompress later.`];  // message: compressed about 3 to 1 and kept in RAM, freeing frames with no flash writes, at a small processor cost
              }  // ends the three machine cases for moving heap pages
            } else {  // the Kill button
              const n = frames.filter((f) => f !== 'free').length;  // n: how many frames Photos still holds
              frames = frames.map(() => 'free'); killed = true;  // every frame becomes free at once and the process is marked dead
              lastMsg = ['bad', 'Last resort', `Killing the process frees its remaining ${n} frames at once. Anything Photos had not saved is lost, and next time it must <span class="t">cold start</span>.`];  // message: killing frees everything immediately, but unsaved work is lost and the next launch is a cold start
            }  // ends the three button cases
            paint();  // redraws the drawing, meter, counters and message
          }  // ends act
          function paint() {  // paint(): redraws the whole step from the current state after every change
            const kids = [  // kids: the shapes of the drawing, starting with the fixed background parts
              s('rect', { x: G.ram[0], y: G.ram[1], width: G.ram[2], height: G.ram[3], rx: 12, class: 's-mem', 'stroke-width': 2, style: 'fill-opacity:.35' }),  // the large faded green RAM box
              s('text', { x: G.title[0], y: 26, 'font-weight': 800, 'font-size': 15 }, G.title[1]),  // the RAM box's title at its top left
              s('rect', { x: G.flash[0], y: G.flash[1], width: G.flash[2], height: G.flash[3], rx: 12, class: 's-io', 'stroke-width': 2, style: 'fill-opacity:.35' }),  // the large faded orange flash storage box
              s('text', { x: G.ftitle[0], y: G.ftitle[1], 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 15 }, 'Flash storage'),  // the flash box's title
              s('rect', { x: G.file[0], y: G.file[1], width: G.file[2], height: G.file[3], rx: 8, class: 's-panel', 'stroke-width': 1.5 }),  // the grey box standing for the Photos app's file on flash
              mtext(s, G.fileTxt[0], G.fileTxt[1], G.fileTxt[2], { 'text-anchor': 'middle', 'font-size': 13 }, 18),  // its label: the file with the app's code and icons is always there
            ];  // closes the list of fixed background shapes; the frame tiles are added next
            const LAB = { code: ['code', 's-mem'], icon: ['icon', 's-mem'], heap: ['heap', 's-proc'], zram: ['zram ×3', 's-accent'], free: ['free', 's-panel'] };  // LAB: for each kind of frame, the word written on its tile and the color class of the tile
            frames.forEach((f, i) => {  // draws the 12 frames of RAM, one tile each
              const [x, y, tw] = G.tile(i);  // x, y and width of tile i in the chosen layout
              kids.push(s('rect', { x, y, width: tw, height: 52, rx: 8, class: LAB[f][1], 'stroke-width': f === 'free' ? 1.5 : 2, 'stroke-dasharray': f === 'free' ? '4 3' : null }),  // the tile itself; free tiles get a thinner, dashed outline so they look empty
                s('text', { x: x + tw / 2, y: y + 24, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 700, class: f === 'free' ? 'tx-muted' : '' }, LAB[f][0]),  // the large label on the tile (code, icon, heap, zram or free), grey when the tile is free
                s('text', { x: x + tw / 2, y: y + 42, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, f === 'code' || f === 'icon' ? 'file-backed' : f === 'heap' ? 'anonymous' : f === 'zram' ? 'compressed' : ''));  // the small label under it: file-backed, anonymous or compressed, and nothing for a free tile
            });  // ends the loop over frames
            if (mode === 'pc') {  // on the desktop machine
              kids.push(s('rect', { x: G.swap[0], y: G.swap[1], width: G.swap[2], height: G.swap[3], rx: 8, class: 's-warn', 'stroke-width': 1.5 }),  // the amber swap area box inside the flash box...
                s('text', { x: G.swapT[0], y: G.swapT[1], 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 700 }, 'swap area'));  // ...with its "swap area" title
              for (let k = 0; k < swapped; k++) {  // one small tile for every heap page that has been written to swap
                const [x, y, w, hh] = G.swapTile(k);  // position and size of swap tile k
                kids.push(s('rect', { x, y, width: w, height: hh, rx: 6, class: 's-proc', 'stroke-width': 1.5 }),  // the swapped-out heap page drawn as a small teal tile...
                  s('text', { x: x + w / 2, y: y + hh / 2 + 5, 'text-anchor': 'middle', 'font-size': 12.5 }, 'heap'));  // ...labelled heap
              }  // ends the loop over swapped pages
            } else {  // on either phone
              kids.push(s('rect', { x: G.swap[0], y: G.swap[1], width: G.swap[2], height: G.swap[3], rx: 8, class: 's-panel', 'stroke-width': 1.5, 'stroke-dasharray': '5 4' }),  // a dashed empty box where a swap area would be...
                mtext(s, G.noSwap[0], G.noSwap[1], ['no swap area', '(protects write', 'endurance)'], { 'text-anchor': 'middle', 'font-size': 13.5, class: 'tx-muted' }, 18));  // ...labelled "no swap area", explaining that this protects the flash's write endurance
            }  // ends the machine choice for the flash box
            svg.replaceChildren(...kids);  // replaces the old drawing with the new shapes in one go
            const fr = freeCount();  // fr: the number of free frames now
            meter.firstChild.style.width = Math.min(100, (fr / GOAL) * 100) + '%';  // stretches the meter's fill to the share of the goal reached, never past 100%
            meter.firstChild.style.background = fr >= GOAL ? 'var(--ok)' : 'var(--warn)';  // the fill turns green once the goal is reached and stays amber until then
            freeTxt.innerHTML = `${fr} free / ${GOAL} needed ${fr >= GOAL ? '<span class="c-ok">✓</span>' : ''}`;  // writes "N free / 8 needed", with a green check mark once there are enough
            stats.innerHTML = `Storage writes: <b class="${writes ? 'c-bad' : 'c-ok'}">${writes}</b> · pages to read back later: <b>${rereads + swapped}</b> · process alive: <b class="${killed ? 'c-bad' : 'c-ok'}">${killed ? 'no' : 'yes'}</b>`;  // the counters line: storage writes (red if any), pages to read back later, and whether Photos is alive (red if not)
            say.className = 'callout m0 small fade-in ' + lastMsg[0];  // the message box takes the style of the last message (tip, warn or bad) and fades in
            say.dataset.label = lastMsg[1];  // the small uppercase title of the message box
            say.innerHTML = lastMsg[2];  // the message text itself
          }  // ends paint
          reset();  // sets up the starting state and draws it once, when the step opens
          el.append(h('div', { class: 'split l fill' },  // builds the page: two columns, explanations on the left and the experiment on the right
            h('div', { class: 'stack', style: { gap: '10px' } },  // left column: a stack of text blocks
              h('p', { class: 'lead m0', html: 'When RAM runs short, the kernel must turn used frames back into free ones. What it may do depends on the kind of page.' }),  // opening sentence: what the kernel may do with a page depends on its kind
              h('div', { class: 'card tight small', html: '<b class="c-mem">File-backed page</b> (code, icons, a mapped file). If clean, just drop it: the file on flash still has a copy. (A changed one is first written back to its file.)' }),  // card: a clean file-backed page can simply be dropped because the file still has a copy
              h('div', { class: 'card tight small', html: '<b class="c-proc">Anonymous page</b> (heap, stack). No file holds it. A PC writes it to a <span class="t" data-t="Swapping">swap</span> area on disk; a phone normally has none, because constant paging would eat the flash’s <span class="t">write endurance</span> and the battery.' }),  // card: an anonymous page has no file; a PC swaps it to disk but a phone normally has no swap area
              h('div', { class: 'callout tip m0 small', 'data-label': 'The phone’s escape hatch: zram', html: 'A swap device made of RAM. Swapped-out pages are compressed, often to about a third, and stay in memory: no flash wear, a little processor time. Most Android phones turn it on.' }),  // tip callout: zram is the phone's escape hatch, compressed swap that stays in RAM
              h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: '“Android does no paging.” It pages clean file-backed pages in and out all the time. What it avoids is writing <b>anonymous</b> pages to flash.' })),  // common-mistake callout: Android does page clean file pages; it only avoids writing anonymous pages to flash
            h('div', { class: 'stack', style: { gap: '8px' } },  // right column: the experiment
              seg,  // the machine switch at the top
              h('div', { class: 'card white', style: { padding: '6px 8px' } }, svg),  // the drawing inside a white card
              h('div', { class: 'row', style: { gap: '8px' } }, bDrop, bHeap, bKill, bReset),  // the row of action buttons
              h('div', { class: 'row nw', style: { gap: '10px' } }, freeTxt, meter),  // the "N free / 8 needed" text with its meter, kept on one line
              stats, say)));  // the counters and the message box, ending the page
        },  // ends render() for step 2
      },  // closes step 2
      /* ---------------- 3. ashmem: sharing by descriptor ---------------- */
      {  // opens step 3, ashmem
        title: 'ashmem: share memory by handing over a descriptor',  // the title shown at the top of step 3
        kind: 'explore',  // kind 'explore': a hands-on step that the student drives with buttons
        core: true,  // core: true puts this step on the shorter core path as well as the full course
        render(el, ctx) {  // render(el, ctx): draws step 3 when the student arrives
          const { h, s } = ctx;  // takes the HTML builder h and the SVG builder s from the shell's toolbox
          const COLORS = ['--io', '--warn', '--io', '--thread', '--os', '--cpu', '--proc', '--mem'];  // COLORS: the 8 pixel colors of the thumbnail A draws, given as names of the guide's color variables
          let st;  // st: the whole state of the experiment, created by reset
          const svg = s('svg', { viewBox: '0 0 640 282', width: '100%' });  // the drawing; its viewBox is set again below for small screens
          const say = h('div', { class: 'callout m0 small', style: { minHeight: '88px' } });  // say: the message box that explains each action
          const B = {};  // B: the buttons of this step, filed by name, so paint can enable and disable them
          const btn = (k, label, cls, fn) => (B[k] = h('button', { class: 'btn sm ' + cls, type: 'button', onclick: fn }, label));  // btn(k, label, cls, fn): makes one small button with a color class and a click action, and files it in B under k
          const blank = () => st.px.every((p) => p == null);  // blank(): true when all 8 pixels are empty, meaning nothing is drawn yet or the region was purged
          function reset() {  // reset(): starts the story over; runs when the step opens and on Reset
            st = { created: false, aMap: false, sent: false, bMap: false, pinned: true, purged: false, px: Array(8).fill(null) };  // no region yet, nothing mapped or sent, the region starts pinned and unpurged, and all 8 pixels are empty
            note('', 'Start', 'Process A (a gallery app) wants to show Process B (the system’s share screen) a thumbnail. Press the numbered buttons in order, then experiment.');  // the opening message: A, a gallery app, wants to show B, the share screen, a thumbnail
          }  // ends reset
          function note(cls, label, html) { st.msg = [cls, label, html]; paint(); }  // note(cls, label, html): stores the message to show and redraws everything
          const acts = {  // acts: what each button does
            create() { st.created = true; note('', 'Region created', 'A asks the kernel for an 8 KB <span class="t">ashmem</span> region named “thumb”. The kernel sets aside 2 frames and gives A a <span class="t">file descriptor</span>: number <b>23</b> in A’s own table. No other process can reach it.'); },  // button 1: A gets an 8 KB ashmem region (2 frames) and descriptor 23 in its own descriptor table
            draw() {  // button 2: A maps the region and draws the thumbnail, or redraws it after a purge
              const again = st.aMap; st.aMap = true; st.purged = false; st.px = COLORS.slice();  // again: true if A had mapped it before, so this is a redraw; the region is now mapped and filled with the 8 colors
              note('tip', again ? 'Redrawn' : 'Mapped and drawn', again ? 'A draws the thumbnail again into the pinned region. Anyone who has it mapped sees the fresh pixels.' : 'A maps the region into its address space at <b>0x7f3a2000</b> and draws with ordinary store instructions. The bytes land in the kernel’s two frames.');  // message: either the redraw or the first mapping at A's address, where ordinary stores fill the frames
            },  // ends draw
            send() { st.sent = true; note('', 'Descriptor sent', 'A passes descriptor 23 to B in a <span class="t">Binder</span> call. The Binder driver installs a new descriptor in B’s table: number <b>41</b>. Different number, same region, and not one pixel was copied.'); },  // button 3: A sends the descriptor to B through Binder; B gets its own number, 41, for the same region
            bmap() { st.bMap = true; note('tip', 'Same frames, two views', 'B maps the region at its own address, <b>0x7c108000</b>. Its view points at the very same frames, so B sees A’s thumbnail at once.'); },  // button 4: B maps the region at a different address but sees the same frames, so the thumbnail appears at once
            bpix() { st.px[3] = st.px[3] === '--intr' ? COLORS[3] : '--intr'; note('tip', 'One copy', 'B changes pixel 4 with a single store. A’s view changes too, because there is only one copy of the bytes. (Real code would add a lock or a rule about who writes.)'); },  // B changes pixel 4 (index 3) to red, or back to its color; A sees it too because there is only one copy
            pin() {  // the pin button: A unpins the region, or pins it again
              st.pinned = !st.pinned;  // flips the pinned flag
              if (!st.pinned) note('warn', 'Unpinned', 'A unpins the region: “I can rebuild this if you need the room.” The pixels are still there for now, but the kernel may take them back.');  // after unpinning: the pixels are still there, but the kernel may now take them back
              else if (st.purged) note('bad', 'Pinned: “was purged”', 'A pins the region again and the kernel answers <b>was purged</b>: the contents are gone (all zeros). A must redraw before using it.');  // pinning again after a purge: the kernel answers "was purged", so the contents are zeros and A must redraw
              else note('tip', 'Pinned: “not purged”', 'A pins the region again and the kernel answers <b>not purged</b>, so the thumbnail is intact and usable straight away.');  // pinning again with nothing purged: the kernel answers "not purged", so the thumbnail can be used straight away
            },  // ends pin
            press() {  // the Memory pressure button: the kernel looks for memory it can take back from this region
              if (!st.created) return note('warn', 'Memory pressure', 'Nothing to reclaim here yet: no region exists.');  // with no region yet there is nothing to reclaim
              if (st.pinned) return note('warn', 'Memory pressure: hands off', 'The kernel hunts for memory, but this region is <b>pinned</b>, so it is off limits. Memory must come from somewhere else, perhaps a kill.');  // a pinned region is off limits, so the kernel must find memory elsewhere, perhaps by killing a process
              if (st.purged || blank()) return note('warn', 'Memory pressure', 'Already purged: these frames were reclaimed earlier.');  // if the region was already purged (or holds nothing), there is nothing more to take
              st.purged = true; st.px = Array(8).fill(null);  // otherwise the kernel purges the unpinned region: it is marked purged and every pixel reads as zero
              note('bad', 'Memory pressure: purged', 'The region is <span class="t" data-t="Unpinned region">unpinned</span>, so the kernel purges it: <b>2 frames freed</b> without killing anyone. A and B both now read zeros.');  // message: the region's 2 frames are freed without killing anyone, and both A and B now read zeros
            },  // ends press
          };  // closes the acts table
          function cell(x, y, w, hh, c) {  // cell(x, y, w, hh, c): one pixel square of the thumbnail, drawn in color c, or as an empty square showing 0
            return [s('rect', { x, y, width: w, height: hh, rx: 4, fill: c ? `var(${c})` : 'var(--panel)', style: 'stroke:var(--line-2)', 'stroke-width': 1 }),  // the square, filled with color c, or with the plain panel color when the pixel is empty
              c ? null : s('text', { x: x + w / 2, y: y + hh / 2 + 5, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub s-monot' }, '0')].filter(Boolean);  // an empty pixel also shows a grey "0" in fixed-width type; filter(Boolean) drops the missing label for colored pixels
          }  // ends cell
          // Wide layout: A | kernel | B in one row. Small screens: A and B side by side, the kernel underneath.
          const SM = ctx.narrow;  // SM: true on phone-width screens, where the tall layout is used
          const P = SM  // P: sizes and positions for the chosen layout
            ? { w: 164, h: 252, A: 4, B: 172, cw: 32, cx: 12, kern: [4, 262, 332, 176], kc: 170, frame: (f) => [14 + f * 162, 314, 150, 60], fcell: 35, fcw: 31, pinY: 396, binder: [170, 424], arrA: [86, 250, 40, 312], arrB: [254, 250, 300, 312] }  // tall layout: process boxes side by side on top, the kernel box underneath, and where frames, labels and arrows go
            : { w: 196, h: 274, A: 4, B: 440, cw: 36, cx: 20, kern: [216, 4, 208, 274], kc: 320, frame: (f) => [226, 58 + f * 62, 188, 56], fcell: 44, fcw: 40, pinY: 202, binder: null, arrA: [186, 205, 224, 116], arrB: [454, 205, 416, 116] };  // wide layout: process A on the left, the kernel in the middle, process B on the right, with the matching positions
          svg.setAttribute('viewBox', SM ? '0 0 340 442' : '0 0 640 282');  // sets the drawing's coordinate size to match the chosen layout
          function procBox(x, name, sub, fd, fdOn, addr, mapped) {  // procBox(...): draws one process: its name, its descriptor table and its address space, mapped or not
            const w = P.w, iw = w - 24;  // w: the box width; iw: the width of the rows inside it
            const out = [  // out: the shapes of this process box
              s('rect', { x, y: 4, width: w, height: P.h, rx: 12, class: 's-proc', 'stroke-width': 2 }),  // the large teal process box
              s('text', { x: x + w / 2, y: 26, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 16 }, name),  // the process name at the top
              s('text', { x: x + w / 2, y: 44, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, sub),  // the grey sub-label under it (gallery app, or share screen)
              s('text', { x: x + 12, y: 70, 'font-size': 13, 'font-weight': 700, class: 's-sub' }, SM ? 'DESCRIPTORS' : 'FILE DESCRIPTORS'),  // the heading of the descriptor table, shortened on small screens
              s('rect', { x: x + 12, y: 78, width: iw, height: 24, rx: 5, fill: 'var(--panel)', style: 'stroke:var(--line-2)' }),  // the first row of the descriptor table...
              s('text', { x: x + 20, y: 95, 'font-size': 13, class: 's-monot' }, SM ? '0–2  std I/O' : '0–2  standard I/O'),  // ...holds descriptors 0 to 2, the standard input, output and error every process has
              s('rect', { x: x + 12, y: 106, width: iw, height: 24, rx: 5, fill: fdOn ? 'var(--accent-bg)' : 'var(--panel)', style: fdOn ? 'stroke:var(--accent)' : 'stroke:var(--line-2)', 'stroke-dasharray': fdOn ? null : '4 3' }),  // the second row: tinted indigo once this process holds a descriptor for the region, dashed while unused
              s('text', { x: x + 20, y: 123, 'font-size': 13, class: fdOn ? 's-monot' : 's-monot tx-muted' }, fdOn ? `${fd}  → ${SM ? '' : 'ashmem '}“thumb”` : `${fd}  (not in use)`),  // its text: the descriptor number pointing at "thumb" once held, or the number marked "not in use"
              s('text', { x: x + 12, y: 154, 'font-size': 13, 'font-weight': 700, class: 's-sub' }, 'ADDRESS SPACE'),  // the heading of the address space part
            ];  // closes the list of fixed parts of the process box
            if (mapped) {  // if this process has mapped the region
              out.push(s('rect', { x: x + 12, y: 162, width: iw, height: 86, rx: 6, class: 's-mem', 'stroke-width': 1.5 }),  // a green block in its address space for the mapping...
                s('text', { x: x + 20, y: 179, 'font-size': 13, class: 's-monot' }, addr + (SM ? '' : ' (mapped)')));  // ...with the address where it was mapped
              st.px.forEach((c, k) => out.push(...cell(x + P.cx + (k % 4) * (P.cw + 4), 188 + Math.floor(k / 4) * 28, P.cw, 24, c)));  // the 8 pixels of the thumbnail, 4 per row, drawn inside the mapping; both processes show the same st.px pixels
            } else out.push(s('rect', { x: x + 12, y: 162, width: iw, height: 86, rx: 6, fill: 'none', style: 'stroke:var(--line-2)', 'stroke-dasharray': '4 3' }),  // otherwise a dashed empty block...
              s('text', { x: x + w / 2, y: 210, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, 'region not mapped'));  // ...that says the region is not mapped
            return out;  // returns the shapes so paint can add them to the drawing
          }  // ends procBox
          function paint() {  // paint(): redraws the drawing, the buttons and the message after every action
            const [kx, ky, kw, kh] = P.kern;  // takes the kernel box's position and size from the layout
            const k = [  // k: the shapes of the drawing, starting with the kernel
              s('rect', { x: kx, y: ky, width: kw, height: kh, rx: 12, class: 's-os', 'stroke-width': 2 }),  // the purple kernel box
              s('text', { x: P.kc, y: ky + 22, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 16 }, 'Kernel'),  // its title, Kernel
            ];  // closes the list of starting shapes
            if (st.created) {  // once the region exists
              k.push(s('text', { x: P.kc, y: ky + 42, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 700 }, 'ashmem region “thumb”'));  // the region's name under the kernel title
              [0, 1].forEach((f) => {  // draws the region's 2 physical frames
                const [fx, fy, fw, fh] = P.frame(f);  // position and size of frame f
                k.push(s('rect', { x: fx, y: fy, width: fw, height: fh, rx: 6, class: 's-mem', 'stroke-width': 1.5 }),  // the green frame box...
                  s('text', { x: fx + 8, y: fy + 16, 'font-size': 12.5, class: 's-sub' }, 'frame ' + (812 + f)));  // ...labelled with a made-up physical frame number, 812 or 813
                for (let c = 0; c < 4; c++) k.push(...cell(fx + 8 + c * P.fcell, fy + 22, P.fcw, 26, st.px[f * 4 + c]));  // 4 pixels in each frame; these are the bytes both processes see through their mappings
              });  // ends the loop over frames
              const [pc, pt] = st.purged ? ['tx-bad', 'purged: zeros'] : st.pinned ? ['tx-ok', 'pinned'] : ['tx-warn', 'unpinned: purgeable'];  // the region's status text and its color: red when purged, green when pinned, amber when unpinned and purgeable
              k.push(s('text', { x: P.kc, y: P.pinY, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800, class: pc }, pt));  // writes that status under the frames
            } else k.push(mtext(s, P.kc, ky + (SM ? 80 : 106), ['no region yet'], { 'text-anchor': 'middle', 'font-size': 13.5, class: 'tx-muted' }));  // without a region, the kernel box just says "no region yet"
            k.push(...procBox(P.A, 'Process A', 'gallery app', 23, st.created, '0x7f3a2000', st.aMap),  // adds process A's box: descriptor 23, address 0x7f3a2000, mapped once A has mapped it...
              ...procBox(P.B, 'Process B', SM ? 'system share screen' : 'share screen (system UI)', 41, st.sent, '0x7c108000', st.bMap));  // ...and process B's box: descriptor 41, address 0x7c108000, filled in once the descriptor is sent and B maps it
            const arrow = (c) => s('line', { x1: c[0], y1: c[1], x2: c[2], y2: c[3], class: 's-line', 'marker-end': 'url(#arr-mem)', style: 'stroke:var(--mem)' });  // arrow(c): a green arrow with an arrowhead from a process's mapping to the region's frames in the kernel
            if (st.aMap) k.push(arrow(P.arrA));  // A's arrow appears once A has mapped the region
            if (st.bMap) k.push(arrow(P.arrB));  // B's arrow appears once B has mapped the region
            if (st.sent && !SM) k.push(s('line', { x1: 184, y1: 262, x2: 450, y2: 262, class: 's-line', 'marker-end': 'url(#arr-os)', style: 'stroke:var(--os)', 'stroke-dasharray': '6 4' }),  // in the wide layout, after sending, a dashed purple arrow runs from A to B along the bottom...
              s('text', { x: 320, y: 252, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, class: 'tx-os' }, 'Binder carries fd 23 → 41'));  // ...labelled "Binder carries fd 23 → 41"
            if (st.sent && SM) k.push(s('text', { x: P.binder[0], y: P.binder[1], 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, class: 'tx-os' }, 'Binder carried fd 23 → 41'));  // in the tall layout the same fact is a single line of text at the bottom
            svg.replaceChildren(...k);  // replaces the old drawing with the new one
            B.create.disabled = st.created;  // button 1 works only once, before the region exists
            B.draw.disabled = !st.created || !st.pinned || !blank();  // button 2 works when the region exists, is pinned and holds no picture (at the start or after a purge)
            B.send.disabled = !st.aMap || st.sent;  // button 3 works once A has drawn and the descriptor has not been sent yet
            B.bmap.disabled = !st.sent || st.bMap;  // button 4 works once the descriptor has been sent and B has not mapped it yet
            B.bpix.disabled = !st.bMap || blank();  // B can change a pixel only after mapping, and only when there is a picture to change
            B.pin.disabled = !st.aMap;  // pinning and unpinning make sense only once A has mapped the region
            B.pin.textContent = st.pinned ? 'A unpins' : 'A pins again';  // the pin button's label follows the state: "A unpins" or "A pins again"
            B.draw.textContent = st.aMap ? '2 · A redraws' : '2 · A maps + draws';  // button 2 is relabelled "A redraws" once A has mapped the region
            say.className = 'callout m0 small fade-in ' + st.msg[0];  // the message box takes the style of the last message and fades in
            say.dataset.label = st.msg[1];  // the message box's small uppercase title
            say.innerHTML = st.msg[2];  // the message text
          }  // ends paint
          btn('create', '1 · A creates region', 'proc', () => acts.create());  // button 1: A creates the region (teal, a process action)
          btn('draw', '2 · A maps + draws', 'proc', () => acts.draw());  // button 2: A maps it and draws
          btn('send', '3 · Send fd to B', 'os', () => acts.send());  // button 3: send the descriptor to B (purple, because the kernel's Binder carries it)
          btn('bmap', '4 · B maps it', 'proc', () => acts.bmap());  // button 4: B maps the region
          btn('bpix', 'B changes a pixel', 'proc', () => acts.bpix());  // extra experiment: B changes one pixel
          btn('pin', 'A unpins', 'warn', () => acts.pin());  // extra experiment: A unpins or pins again (amber, a warning that the memory may go)
          btn('press', 'Memory pressure!', 'intr', () => acts.press());  // extra experiment: memory pressure arrives (red)
          const bReset = h('button', { class: 'btn sm ghost', type: 'button', onclick: () => reset() }, '⟲ Reset');  // the Reset button
          reset();  // sets up the starting state and draws it once, when the step opens
          el.append(h('div', { class: 'split l fill' },  // builds the page: two columns, explanations on the left and the experiment on the right
            h('div', { class: 'stack', style: { gap: '10px' } },  // left column: a stack of text blocks
              h('p', { class: 'lead m0', html: 'Sandboxed apps sometimes need the same big chunk of data. Copying it costs time and RAM; sharing it is better.' }),  // opening sentence: copying a big chunk of data costs time and RAM, sharing it is better
              h('p', { class: 'm0 small', html: '<b>Anonymous shared memory (ashmem)</b> is an Android addition to the kernel. A region is named by a <b>file descriptor</b>, so sharing it means passing the descriptor; the receiver maps the <b>same physical frames</b>. Only holders of a descriptor can get in, and the memory is freed when the last holder lets go of it, even if a holder crashed.' }),  // paragraph: ashmem is named by a file descriptor, the receiver maps the same frames, and it is freed with its last holder
              h('p', { class: 'm0 small', html: 'The owner can <b>unpin</b> parts it could rebuild. Under pressure the kernel may purge them; pinning again reports whether that happened.' }),  // paragraph: unpinned parts may be purged under pressure, and pinning again reports whether that happened
              h('div', { class: 'callout why m0 small', 'data-label': 'Why not System V shared memory?', html: 'Those segments outlive their processes unless someone deletes them. On a phone that kills processes all day they would leak, so Android does not support them.' }),  // why callout: System V shared memory would leak on a phone that kills processes all day, so Android leaves it out
              h('div', { class: 'callout tip m0 small', 'data-label': 'Today', html: 'Newer Android versions do the same job with standard Linux <span class="t">memfd</span> (memfd_create), behind the same app-level API. One difference: memfd has no pinning, so nothing in it is ever purged.' })),  // tip callout: newer versions use standard memfd, which has no pinning
            h('div', { class: 'stack', style: { gap: '8px' } },  // right column: the experiment
              h('div', { class: 'card white', style: { padding: '6px 8px' } }, svg),  // the drawing in a white card
              h('div', { class: 'row', style: { gap: '6px' } }, B.create, B.draw, B.send, B.bmap),  // first button row: the four numbered steps in order
              h('div', { class: 'row', style: { gap: '6px' } }, B.bpix, B.pin, B.press, bReset),  // second button row: the experiments and Reset
              say)));  // the message box, ending the page
        },  // ends render() for step 3
      },  // closes step 3
      /* ---------------- 4. ION: buffers for hardware ---------------- */
      {  // opens step 4, ION
        title: 'ION: memory pools for the camera, GPU and display',  // the title shown at the top of step 4
        kind: 'explore',  // kind 'explore': a hands-on step with two tabs
        render(el, ctx) {  // render(el, ctx): draws step 4 when the student arrives
          const { h, s } = ctx;  // takes the HTML builder h and the SVG builder s from the shell's toolbox
          /* Tab 1: a contiguous block after hours of use. */
          function tabFrag(panel) {  // tabFrag(panel): draws tab 1, the camera asking for one physically contiguous block, into the tab's panel
            const NEED = 6;  // NEED: the camera wants 6 frames in a row
            const PAT = { none: 'UUFUUUFFUUUFUUUUFUUFFFUUUUFUUFUU', carve: 'UUFUUUUUUUFUUUUFUUUUUUUFUUCCCCCC' };  // PAT: the 32 frames at the start, U = app page, F = free, C = camera heap; without a heap the 10 free frames are scattered
            let mode = 'none', frames, got;  // the tab's state: which pool setup is chosen, the 32 frames, and where the camera's buffer starts (null if none)
            const PER = ctx.narrow ? 8 : 16, FW = ctx.narrow ? 37 : 33;  // PER: frames per row, 8 on small screens and 16 on desktops; FW: the width of each frame tile
            const svg = s('svg', { viewBox: ctx.narrow ? '0 0 340 232' : '0 0 600 122', width: '100%' });  // the drawing, two rows tall on desktops and four rows on small screens
            const out = h('div', { class: 'callout m0 small', style: { minHeight: '84px' } });  // out: the message box that reports what happened
            const bAsk = h('button', { class: 'btn sm primary', type: 'button', onclick: () => ask() }, `Camera: get ${NEED} contiguous frames`);  // the main button: the camera asks for 6 contiguous frames
            const bFree = h('button', { class: 'btn sm', type: 'button', onclick: () => release() }, 'Camera closes: free it');  // the button that gives the camera's buffer back
            const seg = ctx.ui.seg([{ value: 'none', label: 'One shared pool' }, { value: 'carve', label: 'Camera heap set aside at boot' }], mode, (v) => { mode = v; reset(); });  // switch between one shared pool for everyone and a camera heap set aside at boot; switching starts over
            // longest run of free frames inside [from, to)
            function runs(from, to, want) {  // runs(from, to, want): scans frames for runs of the kind want; reports the longest run and where the first run of 6 starts
              let best = 0, cur = 0, start = -1;  // best: the longest run so far; cur: the length of the current run; start: -1 until a run of 6 is found
              for (let i = from; i < to; i++) {  // looks at each frame in the range in turn
                if (frames[i] === want) { cur++; if (cur > best) best = cur; if (cur === NEED && start < 0) start = i - NEED + 1; } else cur = 0;  // a matching frame grows the run, updates best and records the start of the first run of 6; any other frame resets the run to 0
              }  // ends the scan
              return { best, start };  // returns both results to the caller
            }  // ends runs
            function reset() {  // reset(): puts the frames back to the chosen starting pattern; runs at the start and on a switch
              frames = PAT[mode].split(''); got = null;  // split('') turns the pattern string into a list of single letters; the camera holds nothing yet
              say('', mode === 'none' ? 'After a day of use' : 'Pool reserved at boot',  // the opening message, titled for the chosen setup
                mode === 'none' ? 'Apps have been allocating and freeing pages for hours, so the free frames (dashed) are scattered. Now the user opens the camera.' : 'At boot, ION set the last 6 frames aside as a camera heap. Apps never received them, so they could use only 26 frames all day. Now the user opens the camera.');  // shared pool: free frames are scattered after a day of use; camera heap: the last 6 frames were set aside at boot
            }  // ends reset
            function say(cls, label, html) { out.className = 'callout m0 small fade-in ' + cls; out.dataset.label = label; out.innerHTML = html; draw(); }  // say(cls, label, html): fills the message box, styled by cls and faded in, then redraws the frames
            function ask() {  // ask(): runs when the camera asks for its 6 contiguous frames
              if (got) return say('warn', 'Already allocated', 'The camera already holds its buffer.');  // a second request while the camera already holds its buffer only gets a warning
              const free = frames.filter((f) => f === 'F').length;  // free: how many frames are free in total
              if (mode === 'none') {  // with one shared pool
                const r = runs(0, frames.length, 'F');  // looks for 6 free frames in a row anywhere
                if (r.start < 0) return say('bad', 'Allocation fails', `There are <b>${free} free frames</b>, more than the ${NEED} needed, but the longest unbroken run is only <b>${r.best}</b>. The camera needs one contiguous block, so the request fails (or the kernel must try slow page moving first). This is <span class="t">external fragmentation</span>.`);  // if there is no such run, the request fails even though more than 6 frames are free in total: external fragmentation
                got = r.start;  // otherwise the buffer starts at the run that was found
              } else {  // with a camera heap
                const r = runs(0, frames.length, 'C');  // looks for the 6 reserved camera frames
                got = r.start;  // the buffer starts there
              }  // ends the choice of pool
              for (let i = got; i < got + NEED; i++) frames[i] = 'B';  // marks the 6 frames as the camera's buffer
              say('tip', 'Allocation succeeds', `The camera gets frames ${got}–${got + NEED - 1} from its own heap at once, as one block. The price: those frames sat unused by apps whenever the camera was off.`);  // message: the camera gets one block at once, but those frames sat unused by apps whenever the camera was off
            }  // ends ask
            function release() {  // release(): runs when the camera closes and gives its buffer back
              if (got == null) return say('warn', 'Nothing to free', 'The camera holds no buffer yet.');  // with no buffer held there is nothing to free
              for (let i = got; i < got + NEED; i++) frames[i] = mode === 'carve' ? 'C' : 'F';  // the 6 frames go back to the camera heap, or to the shared pool as free frames
              got = null;  // the camera no longer holds a buffer
              say('', 'Buffer returned', mode === 'carve' ? 'The buffer goes back to the camera heap, ready for next time.' : 'The frames go back to the shared pool.');  // message saying where the buffer went
            }  // ends release
            function draw() {  // draw(): redraws the 32 frames and updates the buttons
              const k = [];  // k: the shapes of the drawing
              frames.forEach((f, i) => {  // one tile per frame
                const x = 4 + (i % PER) * (FW + 4), y = 22 + Math.floor(i / PER) * 52;  // x and y of tile i: PER tiles per row, each row 52 units below the last
                const cls = { U: 's-proc', F: 's-panel', C: 's-accent', B: 's-cpu' }[f];  // the tile's color class: teal for app pages, plain for free, indigo for the camera heap, blue for the camera's buffer
                k.push(s('rect', { x, y, width: FW, height: 42, rx: 5, class: cls, 'stroke-width': f === 'B' ? 2.5 : 1.5, 'stroke-dasharray': f === 'F' || f === 'C' ? '4 3' : null }),  // the tile; the buffer gets a thicker outline, and free or reserved frames a dashed one
                  s('text', { x: x + FW / 2, y: y + 26, 'text-anchor': 'middle', 'font-size': 13, class: f === 'F' ? 's-sub' : '' }, { U: 'app', F: 'free', C: 'cam', B: 'buf' }[f]));  // the word on the tile: app, free, cam or buf
              });  // ends the loop over frames
              k.push(s('text', { x: 4, y: 14, 'font-size': 13, class: 's-sub' }, ctx.narrow ? '32 frames · dashed = free' + (mode === 'carve' ? ' · cam = camera heap' : '') : '32 frames of RAM · teal = app pages · dashed = free' + (mode === 'carve' ? ' · indigo = camera heap' : '')));  // the key above the tiles explaining the colors, shorter on small screens
              svg.replaceChildren(...k);  // replaces the old drawing with the new one
              bAsk.disabled = got != null; bFree.disabled = got == null;  // the ask button is disabled while the camera holds its buffer, the free button while it holds none
            }  // ends draw
            reset();  // sets up the starting pattern and draws it once, when the tab opens
            panel.append(h('div', { class: 'stack', style: { gap: '8px' } }, seg, h('div', { class: 'card white', style: { padding: '6px 8px' } }, svg),  // builds the tab: the pool switch, then the drawing in a white card
              h('div', { class: 'row', style: { gap: '8px' } }, bAsk, bFree), out,  // then the two buttons and the message box
              h('div', { class: 'callout why m0 small', 'data-label': 'A middle ground', html: 'Linux’s contiguous memory allocator (CMA) lends a reserved area to movable app pages while the device is idle, and moves them out when the device asks for its block.' })));  // why callout: the contiguous memory allocator lends the reserved area to movable pages while the device is idle; ends the tab
          }  // ends tabFrag
          /* Tab 2: zero-copy hand-offs. */
          function tabCopy(panel) {  // tabCopy(panel): draws tab 2, which compares copying an image at each hand-off with sharing one buffer
            const RES = { '720p': [1280, 720], '1080p': [1920, 1080], '4K': [3840, 2160] };  // RES: three video resolutions with their width and height in pixels
            let res = '1080p', fps = 30, mode = 'copy';  // the tab's state: the chosen resolution, frames per second and hand-off mode
            const SM = ctx.narrow, SW = SM ? 104 : 170, SX = (i) => (SM ? 4 + i * 114 : 10 + i * 205);  // SM: small screen or not; SW: the width of each stage box; SX(i): the left edge of stage i
            const svg = s('svg', { viewBox: SM ? '0 0 340 132' : '0 0 600 132', width: '100%' });  // the drawing of the three stages and their buffers
            const out = h('div', { class: 'card tight small num', style: { minHeight: '84px' } });  // out: the card that shows the arithmetic for the chosen settings
            const row = h('div', { class: 'row', style: { gap: '8px' } },  // row: the two switches for resolution and frame rate
              ctx.ui.seg(Object.keys(RES), res, (v) => { res = v; draw(); }),  // the resolution switch: 720p, 1080p or 4K; a change redraws
              ctx.ui.seg([{ value: 30, label: '30 fps' }, { value: 60, label: '60 fps' }], fps, (v) => { fps = v; draw(); }));  // the frame rate switch: 30 or 60 frames per second; a change redraws
            const segMode = ctx.ui.seg([{ value: 'copy', label: 'Copy at each hand-off' }, { value: 'share', label: 'Share one buffer (fd)' }], mode, (v) => { mode = v; draw(); });  // segMode: the switch between copying at each hand-off and sharing one buffer by descriptor
            function draw() {  // draw(): redraws the stages and recomputes the numbers whenever a setting changes
              const [w, hh] = RES[res], bytes = w * hh * 4, mb = bytes / 1e6;  // bytes in one frame = width × height × 4 bytes per pixel; mb is the same in megabytes (millions of bytes)
              const copies = mode === 'copy' ? 2 : 0, nbuf = mode === 'copy' ? 3 : 1;  // copying makes 2 copies per frame and needs 3 buffers; sharing makes no copies and needs 1 buffer
              const st = [['Camera', 's-io', 'captures'], ['GPU', 's-cpu', 'adds a filter'], ['Display', 's-io', 'shows it']];  // st: the three stages of the pipeline: name, color class and what each one does to the image
              const k = [];  // k: the shapes of the drawing
              st.forEach(([n, c, sub], i) => {  // draws each stage in turn
                const x = SX(i), cx = x + SW / 2, bw = SM ? 70 : 120, bx = cx - bw / 2;  // x: the stage's left edge; cx: its center; bw and bx: the width and left edge of the buffer drawn under it
                k.push(s('rect', { x, y: 6, width: SW, height: 44, rx: 9, class: c, 'stroke-width': 2 }),  // the stage box...
                  s('text', { x: cx, y: 26, 'text-anchor': 'middle', 'font-weight': 800, 'font-size': 15 }, n),  // ...its name...
                  s('text', { x: cx, y: 43, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, sub));  // ...and what it does, in grey
                if (i < 2 && !SM) k.push(s('line', { x1: x + 172, y1: 28, x2: x + 203, y2: 28, class: 's-line', 'marker-end': 'url(#arr)' }));  // on desktops, an arrow from each stage to the next (camera to GPU, GPU to display)
                if (mode === 'copy') {  // in copy mode every stage has its own buffer
                  k.push(s('rect', { x: bx, y: 80, width: bw, height: 40, rx: 6, class: 's-mem', 'stroke-width': 1.5 }),  // the green buffer box under the stage...
                    s('text', { x: cx, y: 105, 'text-anchor': 'middle', 'font-size': 13 }, SM ? `buf ${i + 1}` : `buffer ${i + 1}`),  // ...labelled buffer 1, 2 or 3...
                    s('line', { x1: cx, y1: 50, x2: cx, y2: 78, class: 's-line', 'marker-end': 'url(#arr-mem)', style: 'stroke:var(--mem)' }));  // ...and an arrow from the stage down to its buffer
                  const nx = SX(i + 1) + SW / 2 - bw / 2;  // nx: the left edge of the next stage's buffer
                  if (i < 2) k.push(s('line', { x1: bx + bw + 2, y1: 100, x2: nx - 2, y2: 100, class: 's-line', 'marker-end': 'url(#arr-bad)', style: 'stroke:var(--bad)' }),  // between buffers, a red arrow marks each copy...
                    s('text', { x: (bx + bw + nx) / 2, y: 94, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, class: 'tx-bad' }, 'copy'));  // ...labelled copy
                } else k.push(s('line', { x1: cx, y1: 50, x2: cx, y2: 80, class: 's-line', 'marker-end': 'url(#arr-mem)', style: 'stroke:var(--mem)' }));  // in share mode each stage just gets an arrow down to the single shared buffer
              });  // ends the loop over stages
              if (mode === 'share') k.push(s('rect', { x: SM ? 4 : 60, y: 82, width: SM ? 332 : 480, height: 40, rx: 6, class: 's-mem', 'stroke-width': 2 }),  // in share mode, one wide green buffer under all three stages...
                s('text', { x: SM ? 170 : 300, y: 107, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 700 }, SM ? 'one ION buffer, shared by descriptor' : 'one ION buffer, passed along as a file descriptor'));  // ...labelled as a single ION buffer passed along as a file descriptor
              svg.replaceChildren(...k);  // replaces the old drawing with the new one
              const f1 = ctx.util.fmt(mb, 1);  // f1: the size of one frame in MB, rounded to one decimal place by the shell's fmt helper
              out.innerHTML = `One ${res} frame at 4 bytes per pixel = ${comma(w)} × ${comma(hh)} × 4 = <b>${comma(bytes)} bytes ≈ ${f1} MB</b>.<br>` +  // first line of the arithmetic: width × height × 4 bytes gives the size of one frame
                (mode === 'copy'  // second line, depending on the mode
                  ? `Copied every second: ${copies} hand-offs × ${f1} MB × ${fps} = <b class="c-bad">${comma(Math.round(copies * mb * fps))} MB/s</b> of pure copying, and ${nbuf} buffers hold <b>${ctx.util.fmt(nbuf * mb, 1)} MB</b> of RAM.`  // copy mode: hand-offs × frame size × frames per second gives the MB copied every second (in red), plus the RAM 3 buffers hold
                  : `Copied every second: <b class="c-ok">0 MB/s</b>. Each stage reads and writes the same buffer (<span class="t">zero-copy sharing</span>), so RAM holds <b>${f1} MB</b> instead of ${ctx.util.fmt(3 * mb, 1)} MB. (Real pipelines cycle a few such buffers so stages overlap; none is ever copied.)`);  // share mode: 0 MB/s copied (in green), and RAM holds one frame's worth instead of three
            }  // ends draw
            draw();  // draws the tab once with the starting settings
            panel.append(h('div', { class: 'stack', style: { gap: '8px' } }, row, segMode, h('div', { class: 'card white', style: { padding: '6px 8px' } }, svg), out,  // builds the tab: the two switches, the mode switch, the drawing in a white card and the arithmetic card
              h('div', { class: 'callout why m0 small', 'data-label': 'Why a descriptor?', html: 'Only a process or driver that was handed the descriptor can map the buffer, so sharing stays under control, exactly as with ashmem.' })));  // why callout: only holders of the descriptor can map the buffer, just as with ashmem; ends the tab
          }  // ends tabCopy
          el.append(h('div', { class: 'split l fill' },  // builds the page: two columns, explanations on the left and the tabs on the right
            h('div', { class: 'stack', style: { gap: '10px' } },  // left column: a stack of text blocks
              h('p', { class: 'lead m0', html: 'The camera, graphics processor, video engine and display controller read and write huge images straight from RAM by <span class="t">DMA</span>.' }),  // opening sentence: camera, graphics, video and display hardware use huge images straight from RAM by DMA
              h('div', { class: 'card tight small', html: '<b>Special needs.</b> Some of these devices can only use one <b>physically contiguous</b> block, or memory from a particular region. After hours of use, free RAM is scattered in small pieces, so such a block may not exist.' }),  // card: some devices need one physically contiguous block, which may not exist after hours of use
              h('div', { class: 'card tight small', html: '<b><span class="t">ION</span>’s answer.</b> It manages several pools (heaps), some <b>set aside at boot</b> for a device, and hands out every buffer as a file descriptor, so camera, GPU and display can pass one buffer along without copying it.' }),  // card: ION's answer, pools set aside at boot and buffers handed out as file descriptors
              h('div', { class: 'callout tip m0 small', 'data-label': 'Today', html: 'Since Android 12, standard Linux <span class="t">DMA-BUF heaps</span> do ION’s job, and ION has been removed from the mainline kernel. Same idea, standard form.' }),  // tip callout: since Android 12, standard DMA-BUF heaps do ION's job
              h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'ION is not where apps keep their objects. Ordinary heap data uses ordinary pages; ION serves buffers that <b>hardware</b> touches.' })),  // common-mistake callout: ION is for buffers that hardware touches, not for ordinary app objects
            ctx.ui.tabs([  // right column: the shell's tab widget with the two experiments
              { label: '1 · Get a contiguous block', render: (p) => tabFrag(p) },  // tab 1: the contiguous-block experiment, drawn by tabFrag
              { label: '2 · Share, do not copy', render: (p) => tabCopy(p) },  // tab 2: the copy-versus-share experiment, drawn by tabCopy
            ])));  // closes the tab list and the page
        },  // ends render() for step 4
      },  // closes step 4
      /* ---------------- 5. Lab: memory pressure and the low memory killer ---------------- */
      {  // opens step 5, the low memory killer lab
        title: 'Lab: fill the phone and watch who gets trimmed and killed',  // the title shown at the top of step 5
        kind: 'lab',  // kind 'lab': the main hands-on step of this section
        core: true,  // core: true puts this lab on the shorter core path too
        render(el, ctx) {  // render(el, ctx): draws the lab when the student arrives
          const { h, s } = ctx;  // takes the HTML builder h and the SVG builder s from the shell's toolbox
          const CLS = { fg: 'ok', visible: 'proc', service: 'accent', cached: 'warn', killed: 'bad', none: '' };  // CLS: the color name used for each state, on chips, bar segments and app buttons (green foreground, red killed...)
          let S, logRows = [];  // S: the simulated phone, made by lmkNew; logRows: the event log entries, newest first
          const homeBtns = {};  // homeBtns: the eight app buttons, filed by app id so paint can update each one
          const grid = h('div', { class: 'homegrid' });  // grid: the home screen, two columns of app buttons
          LMK.APPS.forEach((a) => {  // makes one button per app in the LMK model
            homeBtns[a.id] = h('button', { class: 'appbtn', type: 'button', onclick: () => open(a.id) });  // a click on the button opens that app in the simulation
            grid.append(homeBtns[a.id]);  // adds the button to the home screen
          });  // ends the loop over apps
          const say = h('div', { class: 'callout m0 small', style: { flex: 'none' } });  // say: the message box that explains what the last tap did
          const stats = h('div', { class: 'row small num', style: { gap: '6px' } });  // stats: a row of counters (free MB, cold starts, warm or hot starts, trimmed MB, kills)
          const svg = s('svg', { viewBox: ctx.narrow ? '0 0 340 132' : '0 0 760 100', width: '100%' });  // the memory bar drawing, taller on small screens so its labels fit on extra lines
          const tbody = h('tbody');  // tbody: the body of the process table, refilled on every change
          const killedRow = h('div', { class: 'row xs', style: { gap: '4px' } });  // killedRow: the row that lists the apps lmkd has killed
          const logEl = h('div', { class: 'log grow', style: { fontSize: '13px' } });  // logEl: the scrolling event log in fixed-width type that fills the leftover height
          const bReset = h('button', { class: 'btn sm ghost', type: 'button', onclick: () => reset() }, '⟲ Reset phone');  // the Reset phone button
          function reset() {  // reset(): switches the phone on afresh; runs when the lab opens and on Reset
            S = lmkNew(); logRows = [];  // a brand new phone state and an empty log
            note('', 'Phone just switched on', `${comma(LMK.TOTAL)} MB of RAM: the kernel and Android’s own services hold ${comma(LMK.SYS)} MB, so apps share <b>${comma(LMK.SPACE)} MB</b>. <b>Tap apps to open them.</b> Try Backup, Maps, Chat, Browser, Camera, Game, Photos, then Chat again.`);  // the opening message: how the 4,000 MB are split, and a suggested order of apps to tap
          }  // ends reset
          function note(cls, label, html) { say.className = 'callout m0 small fade-in ' + cls; say.dataset.label = label; say.innerHTML = html; paint(); }  // note(cls, label, html): fills the message box, styled by cls and faded in, then redraws the whole lab
          const names = (list) => list.map((k) => '<b>' + LMK_BY[k.id || k].name + '</b>').join(' and ');  // names(list): turns a list of apps (ids or kill records) into bold app names joined with "and"
          function open(id) {  // open(id): runs when the student taps an app on the home screen
            const a = LMK_BY[id], r = lmkOpen(S, id);  // a is the app's record; lmkOpen does all the memory work and returns the report r
            if (r.kind === 'same') return note('', 'Already in front', `${a.name} is the foreground app already. Open a different app.`);  // tapping the app already in front only gets a short note
            logRows.unshift({ head: 'Open ' + a.name, lines: r.events });  // adds this tap's log lines at the top of the event log
            let html = r.kind === 'cold'  // html: the explanation for the message box, built up piece by piece
              ? `<b>${a.name}</b> was ${r.restored ? 'killed earlier' : 'not running'}: a <span class="t">cold start</span> in a new process.` + (r.restored ? ' Its <span class="t">saved instance state</span> comes back, so the screen looks as the user left it.' : '')  // cold start: the app was not running or was killed; after a kill its saved instance state brings the screen back
              : `<b>${a.name}</b> was still in memory (${STLABEL[r.from]}), so Android skips creating a process: a warm or hot start, depending on whether its screen must be rebuilt. Usually much faster, though the app may still rebuild caches or redraw its screen.` + (r.need ? ` Here it reloads ${r.need} MB of trimmed caches.` : '');  // warm or hot start: the process still exists, so no new one is made; usually much faster, though caches or the screen may still be rebuilt, and any trimmed caches are reloaded
            if (r.trimmed.length) html += ` Free memory crossed the trim line, so ${r.trimmed.length} cached app${r.trimmed.length > 1 ? 's' : ''} freed ${r.trimMB} MB in <span class="t">onTrimMemory</span>.`;  // if the trim line was crossed, adds how many cached apps freed how much in onTrimMemory
            if (r.killed.length) html += ` Still past the kill line, so <span class="t">lmkd</span> killed ${names(r.killed)}: highest <span class="t">oom_score_adj</span> first, meaning the cached app${r.killed.length > 1 ? 's' : ''} used longest ago.`;  // if the kill line was crossed, adds which apps lmkd killed and why: highest oom_score_adj, the oldest cached apps
            else if (!r.trimmed.length) html += ' Plenty of room: no trimming, no killing.';  // if nothing was trimmed or killed, says there was plenty of room
            html += ` Free now: <b>${comma(lmkFree(S))} MB</b>.`;  // ends with the free memory now
            note(r.killed.length ? 'bad' : r.trimmed.length ? 'warn' : 'tip', r.kind === 'cold' ? (r.restored ? 'Cold start, state restored' : 'Cold start') : 'Warm or hot start', html);  // shows the message: red if something was killed, amber if only trimmed, green otherwise, titled by the kind of start (a reused process is a warm or hot start)
          }  // ends open
          function drawBar() {  // drawBar(): draws the memory bar, the app space split into one segment per running app plus the free part
            const SM = ctx.narrow, X0 = SM ? 6 : 10, W = SM ? 328 : 740, sc = W / LMK.SPACE, Y = SM ? 54 : 26, H = 38, k = [];  // SM: small screen; X0: left margin; W: bar width; sc: drawing units per MB; Y and H: the bar's top and height
            let x = X0;  // x: where the next segment starts, moving right
            const order = LMK.APPS.filter((a) => LIVE.includes(S.apps[a.id].st)).sort((p, q) => lmkAdj(S, p.id) - lmkAdj(S, q.id));  // order: every app with a process, sorted by score, lowest first, so the most important app sits at the left
            order.forEach((a) => {  // draws one segment per running app
              const y = S.apps[a.id], w = y.res * sc, cw = y.trimmed ? 0 : a.cache * sc, c = CLS[y.st];  // y: its state; w: its width for the MB it holds; cw: the width of its untrimmed cache (0 once trimmed); c: its color
              k.push(s('rect', { x, y: Y, width: w - cw, height: H, class: 's-' + c, 'stroke-width': 1.5 }));  // the solid part of the segment: memory the app cannot give up
              if (cw) k.push(s('rect', { x: x + w - cw, y: Y, width: cw, height: H, class: 's-' + c, 'stroke-width': 1, style: 'fill-opacity:.35', 'stroke-dasharray': '3 2' }));  // the pale dashed part at its right end: the cache it could release when trimmed
              if (w >= a.name.length * 8 + 8) k.push(s('text', { x: x + w / 2, y: Y + 24, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 }, a.name));  // writes the app's name only if the segment is wide enough for it (about 8 units per letter)
              x += w;  // moves x to the end of this segment
            });  // ends the loop over apps
            const fw = X0 + W - x, trimX = X0 + (LMK.SPACE - LMK.TRIM) * sc;  // fw: the width left over, which is free memory; trimX: the point beyond which less than 600 MB would be free
            if (fw > 1) k.push(s('rect', { x, y: Y, width: fw, height: H, rx: 4, class: 's-panel', 'stroke-width': 1.5, 'stroke-dasharray': '5 4', style: 'fill-opacity:.3' }));  // the free part of the bar, dashed and pale
            if (trimX - x >= 50) k.push(s('text', { x: (x + trimX) / 2, y: Y + 24, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, 'free'));  // the word "free" if there is room for it before the trim line
            [[LMK.TRIM, 'trim', 'warn'], [LMK.KILL, 'kill', 'bad']].forEach(([v, lab, c]) => {  // draws the two threshold lines: trim in amber and kill in red
              const lx = X0 + (LMK.SPACE - v) * sc;  // lx: where the line goes, measured so that the space to its right equals the threshold in MB
              k.push(s('line', { x1: lx, y1: Y - 8, x2: lx, y2: Y + H + 6, style: `stroke:var(--${c})`, 'stroke-width': 2, 'stroke-dasharray': '4 3' }),  // the dashed vertical line, a little taller than the bar
                s('text', { x: v === LMK.TRIM ? lx - 4 : lx + 4, y: Y - 7, 'text-anchor': v === LMK.TRIM ? 'end' : 'start', 'font-size': 13, 'font-weight': 700, class: 'tx-' + c }, lab));  // its label above the bar, trim to the left of its line and kill to the right, so they never overlap
            });  // ends the loop over the two lines
            k.push(s('text', { x: X0, y: 16, 'font-size': 13, 'font-weight': 800 }, `RAM for apps: ${comma(LMK.SPACE)} MB`));  // the bar's title: how much RAM the apps share
            if (SM) k.push(s('text', { x: X0, y: 32, 'font-size': 13, class: 's-sub' }, `(the system keeps ${comma(LMK.SYS)} of ${comma(LMK.TOTAL)} MB)`),  // on small screens: a second title line saying how much the system keeps...
              s('text', { x: X0, y: Y + H + 18, 'font-size': 13, class: 's-sub' }, 'most important first · pale = trimmable cache'),  // ...a key below the bar: most important first, pale means trimmable cache...
              s('text', { x: X0, y: Y + H + 34, 'font-size': 13, class: 's-sub' }, `trim at ${LMK.TRIM} MB free, kill at ${LMK.KILL} MB free`));  // ...and a second key line with the trim and kill thresholds
            else k.push(s('text', { x: X0 + 172, y: 16, 'font-size': 13, class: 's-sub' }, `(the kernel and system services keep ${comma(LMK.SYS)} of the ${comma(LMK.TOTAL)} MB)`),  // on desktops: the system's share beside the title...
              s('text', { x: X0, y: Y + H + 22, 'font-size': 13, class: 's-sub' }, `most important app first · pale dashed = cache it can trim · lines: trim at ${LMK.TRIM} MB free, kill at ${LMK.KILL} MB free`));  // ...and one key line under the bar with the order, the pale cache and the two thresholds
            svg.replaceChildren(...k);  // replaces the old bar with the new one
          }  // ends drawBar
          function paint() {  // paint(): refreshes everything in the lab after every tap
            LMK.APPS.forEach((a) => {  // updates each app button on the home screen
              const y = S.apps[a.id];  // y: the app's current state
              const mb = `${LIVE.includes(y.st) ? y.res : a.mb} MB`;  // the MB shown: what the app holds now if it is running, otherwise its full size
              const lab = y.st === 'killed' ? 'killed · state saved' : y.st === 'service' ? 'service · uploading' : y.st === 'visible' ? 'visible · floating' : STLABEL[y.st] + (y.trimmed ? ' · trimmed' : '');  // the state chip's text, with a reason for killed (state saved), service (uploading), visible (floating) or trimmed apps
              homeBtns[a.id].className = 'appbtn st-' + y.st;  // the button's class picks the colored left edge for its state
              homeBtns[a.id].innerHTML = `<b>${a.name}</b><span class="chip ${CLS[y.st]}">${lab}</span><span class="xs muted num">${mb}</span>`;  // the button's contents: the app name in bold, a colored state chip and the MB figure in small grey digits
            });  // ends the loop over app buttons
            const rows = LMK.APPS.filter((a) => LIVE.includes(S.apps[a.id].st)).sort((p, q) => lmkAdj(S, p.id) - lmkAdj(S, q.id));  // rows: the apps with a process, most important first, for the process table
            tbody.replaceChildren(...(rows.length ? rows.map((a) => h('tr', {},  // refills the table: one row per running app...
              h('td', { class: 'b' }, a.name), h('td', {}, h('span', { class: 'chip ' + CLS[S.apps[a.id].st] }, STLABEL[S.apps[a.id].st])),  // ...with its name in bold and its state as a colored chip...
              h('td', { class: 'num' }, String(lmkAdj(S, a.id))), h('td', { class: 'num' }, String(S.apps[a.id].res)))) : [h('tr', {}, h('td', { colspan: 4, class: 'muted' }, 'No app processes yet.'))]));  // ...then its oom_score_adj and its MB; with no apps running, a single grey row says so
            const dead = LMK.APPS.filter((a) => S.apps[a.id].st === 'killed');  // dead: the apps lmkd has killed so far
            killedRow.replaceChildren(h('span', { class: 'b muted' }, 'Killed:'), ...(dead.length ? dead.map((a) => h('span', { class: 'chip bad' }, a.name)) : [h('span', { class: 'muted' }, 'none yet')]));  // the Killed row: a red chip for each killed app, or "none yet"
            stats.innerHTML = `<span class="chip">free ${comma(lmkFree(S))} MB</span><span class="chip">cold starts ${S.cold}</span><span class="chip">warm/hot starts ${S.warm}</span><span class="chip warn">trimmed ${S.trimMB} MB</span><span class="chip bad">kills ${S.kills}</span>`;  // the counter chips: free MB, cold starts, warm or hot starts (process reused), trimmed MB (amber) and kills (red)
            logEl.replaceChildren(...(logRows.length ? logRows.flatMap((g) => [h('div', { class: 'b' }, '▸ ' + g.head), ...g.lines.map((l) => h('div', {}, '  ' + l))]) : [h('div', { class: 'muted' }, 'Events appear here, newest first.')]));  // refills the event log: each tap as a bold heading with its events indented under it, or a grey placeholder at first
            drawBar();  // redraws the memory bar
          }  // ends paint
          reset();  // sets up a fresh phone and draws it once, when the lab opens
          const legend = h('div', { class: 'card tight xs', html:  // legend: a small card under the home screen explaining the importance levels and their scores
            '<div class="b muted" style="margin-bottom:3px">IMPORTANCE → oom_score_adj</div>' +  // its heading: importance maps to oom_score_adj
            '<div class="kv"><span class="chip ok">foreground</span><span>0 · the app on screen</span>' +  // foreground (green chip): 0, the app on screen
            '<span class="chip proc">visible</span><span>100 · still seen (Maps’ floating window)</span>' +  // visible (teal chip): 100, still seen, like Maps' floating window
            '<span class="chip accent">service</span><span>500 · background work (an upload)</span>' +  // service (indigo chip): 500, background work such as Backup's upload
            '<span class="chip warn">cached</span><span>900–999 · hidden; older = higher = killed first</span></div>' });  // cached (amber chip): 900 to 999, and the older the app, the higher the score and the sooner it is killed
          el.append(h('div', { class: 'stack fill', style: { gap: '8px' } },  // builds the page: a stack that fills the step's height
            h('div', { class: 'row nw', style: { justifyContent: 'space-between', gap: '10px' } },  // top row: the introduction on the left and the Reset button on the right, kept on one line
              h('p', { class: 'm0 small', html: 'You are the user; Android and <span class="t">lmkd</span> react to <span class="t">memory pressure</span>. Importance (the ranking from 4.7) decides who trims and who is killed.' }), bReset),  // introduction: the student plays the user, and importance decides who is trimmed and who is killed
            h('div', { class: 'split l3', style: { height: 'auto', flex: '1', minHeight: 0 } },  // below it, a split with the left third for the home screen and the right two thirds for the results, taking the leftover height
              h('div', { class: 'stack', style: { gap: '8px' } }, h('div', { class: 'xs b muted' }, 'HOME SCREEN · tap to open'), grid, legend),  // left part: the "HOME SCREEN" heading, the app buttons and the legend
              h('div', { class: 'stack', style: { gap: '8px' } },  // right part: a stack of results
                h('div', { class: 'card white', style: { padding: '4px 8px' } }, svg),  // the memory bar in a white card
                stats,  // the counter chips
                h('div', { class: 'grid-2', style: { flex: '1', minHeight: 0 } },  // two equal columns that take whatever height is left
                  h('div', { class: 'stack', style: { gap: '6px' } },  // left column: a stack...
                    h('table', { class: 'tbl compact' }, h('thead', {}, h('tr', {}, h('th', {}, 'Process'), h('th', {}, 'Importance'), h('th', {}, 'adj'), h('th', {}, 'MB'))), tbody),  // ...with the process table, whose header row reads Process, Importance, adj and MB...
                    killedRow),  // ...and the Killed row under it
                  h('div', { class: 'stack', style: { gap: '6px', minHeight: 0 } }, say, logEl))))));  // right column: the message box and the event log; this ends the page
        },  // ends render() for step 5
      },  // closes step 5
      /* ---------------- 6. Inside one app ---------------- */
      {  // opens step 6, inside one app
        title: 'Inside one app: heap limit, garbage collector, trim, save',  // the title shown at the top of step 6
        kind: 'explore',  // kind 'explore': a step with three tabs to explore
        render(el, ctx) {  // render(el, ctx): draws step 6 when the student arrives
          const { h, s } = ctx;  // takes the HTML builder h and the SVG builder s from the shell's toolbox
          /* Tab 1: a photo viewer's heap. */
          function tabHeap(panel) {  // tabHeap(panel): draws tab 1, a photo viewer's managed heap, into the tab's panel
            const LIMIT = 256, PHOTO = 48;  // LIMIT: the app's heap limit, 256 MB; PHOTO: each full-size photo needs 48 MB
            let objs, nextPhoto;  // objs: the objects in the heap; nextPhoto: the number of the next photo to open
            const SM = ctx.narrow;  // SM: true on phone-width screens
            const svg = s('svg', { viewBox: SM ? '0 0 340 120' : '0 0 640 104', width: '100%' });  // the heap drawing, a little taller on small screens for its two-line key
            const say = h('div', { class: 'callout m0 small', style: { minHeight: '96px' } });  // say: the message box that explains each action
            const stats = h('div', { class: 'row small num', style: { gap: '6px' } });  // stats: chips for live, garbage and free MB
            const B = {  // B: the buttons of this tab
              open: h('button', { class: 'btn sm mem', type: 'button', onclick: () => open() }, `Open a photo (+${PHOTO} MB)`),  // open a photo, which needs 48 more MB (memory green)
              close: h('button', { class: 'btn sm', type: 'button', onclick: () => close() }, 'Close oldest photo'),  // close the oldest photo still open, which turns it into garbage
              gc: h('button', { class: 'btn sm os', type: 'button', onclick: () => gc(true) }, 'Run the GC'),  // run the garbage collector by hand (purple)
              trim: h('button', { class: 'btn sm warn', type: 'button', onclick: () => trim() }, 'onTrimMemory arrives'),  // deliver an onTrimMemory call to the app (amber)
              reset: h('button', { class: 'btn sm ghost', type: 'button', onclick: () => reset() }, '⟲ Reset'),  // start over
            };  // closes the button table
            const sum = (f) => objs.filter(f).reduce((t, o) => t + o.mb, 0);  // sum(f): adds up the MB of the objects that pass the test f
            const used = () => sum(() => true), live = () => sum((o) => o.live);  // used(): everything in the heap, garbage included; live(): only objects the app can still reach
            function say2(cls, label, html) { say.className = 'callout m0 small fade-in ' + cls; say.dataset.label = label; say.innerHTML = html; draw(); }  // say2(cls, label, html): fills the message box, styled and faded in, then redraws the heap
            function reset() {  // reset(): starts the app over; runs when the tab opens and on Reset
              objs = [{ label: 'app core', short: 'core', mb: 40, live: true, cls: 's-proc' }, { label: 'thumbnail cache', short: 'thumbs', mb: 60, live: true, cls: 's-accent', cache: true }];  // the heap starts with 40 MB of core objects and a 60 MB thumbnail cache, the only part marked as a cache
              nextPhoto = 1;  // the first photo opened will be photo 1
              say2('', 'A photo viewer', `This app’s <span class="t">heap limit</span> is <b>${LIMIT} MB</b>. Its core objects take 40 MB and a thumbnail cache 60 MB. Each full-size photo it opens needs ${PHOTO} MB. Open photos until something happens.`);  // the opening message: the 256 MB limit, what the heap already holds and what each photo costs
            }  // ends reset
            function gc(manual) {  // gc(manual): the garbage collector; manual is true when the student pressed the button
              const g = used() - live();  // g: the MB of garbage, objects in the heap that nothing can reach any more
              objs = objs.filter((o) => o.live);  // keeps only the live objects, which frees all the garbage
              if (manual) say2(g ? 'tip' : '', 'Garbage collection', g ? `The <span class="t">garbage collector</span> traced every object reachable from the app’s variables and freed the ${g} MB that nothing points to any more.` : 'Nothing to collect: every object is still reachable, so the GC cannot free any of it.');  // when run by hand, the message explains what was freed, or that nothing could be freed
              return g;  // returns how much was freed, so open can mention it
            }  // ends gc
            function open() {  // open(): runs when the student opens another photo
              let pre = '';  // pre: a sentence about an automatic collection, if one happens
              if (used() + PHOTO > LIMIT) {  // if the new photo would not fit under the limit...
                const g = gc(false);  // ...the runtime first collects garbage on its own, as ART does before giving up
                pre = g ? `The heap was nearly full, so ART ran a collection first and reclaimed ${g} MB of garbage. ` : 'The heap was nearly full, so ART ran a collection first, but found no garbage. ';  // the sentence says how much that collection reclaimed, or that it found nothing
              }  // ends the automatic collection
              if (used() + PHOTO > LIMIT) return say2('bad', 'OutOfMemoryError', pre + `Live objects take ${live()} MB; the photo needs ${PHOTO} MB more: ${live() + PHOTO} MB is over the ${LIMIT} MB limit. ART throws <b>OutOfMemoryError</b>, which crashes the app unless caught. Close a photo or trim the cache.`);  // if it still does not fit, ART throws OutOfMemoryError: live objects plus the photo exceed the limit
              objs.push({ label: 'photo ' + nextPhoto, mb: PHOTO, live: true, cls: 's-mem', photo: true });  // otherwise the photo is added to the heap as a new live object
              say2(pre ? 'warn' : 'tip', 'Photo ' + nextPhoto++ + ' opened', pre + `The heap now holds ${used()} MB of its ${LIMIT} MB limit.`);  // message: the photo opened (amber if a collection was needed first) and how full the heap now is
            }  // ends open
            function close() {  // close(): runs when the student closes the oldest photo
              const o = objs.find((x) => x.photo && x.live);  // o: the first photo in the heap that is still live, which is the oldest
              if (!o) return say2('warn', 'No photo open', 'Open a photo first.');  // with no photo open there is nothing to close
              o.live = false;  // the app drops its reference, so the photo is no longer live: it is now garbage
              say2('', o.label + ' closed', `The app dropped its only reference to ${o.label}, so it is now <b>garbage</b>: unreachable, but its ${o.mb} MB stays in the heap until the next collection.`);  // message: the photo is unreachable, but its MB stay in the heap until the next collection
            }  // ends close
            function trim() {  // trim(): runs when onTrimMemory arrives
              const c = objs.find((x) => x.cache && x.live);  // c: the thumbnail cache, if it is still live
              if (!c) return say2('warn', 'Already trimmed', 'The cache is already released.');  // if the cache was already released, a warning says so
              c.live = false;  // the app clears its cache, so those 60 MB become garbage
              say2('tip', 'Cache released', `In <span class="t">onTrimMemory</span> the app clears its thumbnail cache. The 60 MB becomes garbage for the GC, and the process will need less RAM once collected. Thumbnails can be decoded again later.`);  // message: the cache is released and becomes garbage; thumbnails can be decoded again later
            }  // ends trim
            function draw() {  // draw(): redraws the heap bar and the chips
              const W = SM ? 320 : 620, sc = W / LIMIT, k = [s('rect', { x: 10, y: 28, width: W, height: 42, class: 's-panel', 'stroke-width': 1, 'stroke-dasharray': '5 4', style: 'fill-opacity:.4' })];  // W: the bar's width; sc: drawing units per MB; k starts with a dashed pale box for the whole 256 MB heap
              let x = 10;  // x: where the next object starts, moving right
              objs.forEach((o) => {  // draws each object in the heap, in the order it was created
                const w = o.mb * sc;  // w: the object's width for its MB
                k.push(s('rect', { x, y: 28, width: w, height: 42, class: o.live ? o.cls : 's-panel', 'stroke-width': 1.5, 'stroke-dasharray': o.live ? null : '4 3' }),  // a live object in its own color, or garbage as a pale dashed block
                  mtext(s, x + w / 2, 46, [SM ? o.short || o.label : o.label, o.live ? o.mb + ' MB' : 'garbage'], { 'text-anchor': 'middle', 'font-size': 13, class: o.live ? '' : 's-sub' }, 16));  // its label: the name (shortened on small screens) and its MB, or the word garbage
                x += w;  // moves x to the end of this object
              });  // ends the loop over objects
              k.push(s('line', { x1: 10 + W, y1: 20, x2: 10 + W, y2: 78, style: 'stroke:var(--bad)', 'stroke-width': 2.5 }),  // a thick red line at the right end marks the heap limit...
                s('text', { x: 10 + W, y: 14, 'text-anchor': 'end', 'font-size': 13, 'font-weight': 700, class: 'tx-bad' }, `heap limit ${LIMIT} MB`),  // ...labelled with the limit in MB
                s('text', { x: 10, y: 14, 'font-size': 13, 'font-weight': 800 }, 'The app’s managed heap'),  // the drawing's title at the top left
                mtext(s, 10, 96, SM ? ['dashed = garbage: unreachable, but still', 'taking space until the GC runs'] : ['dashed = garbage: unreachable but still taking space until the GC runs'], { 'font-size': 13, class: 's-sub' }, 16));  // the key under the bar: dashed means garbage, unreachable but taking space until the GC runs (two lines on small screens)
              svg.replaceChildren(...k);  // replaces the old drawing with the new one
              stats.innerHTML = `<span class="chip">live ${live()} MB</span><span class="chip">garbage ${used() - live()} MB</span><span class="chip ok">free ${LIMIT - used()} MB</span>`;  // the chips: live MB, garbage MB, and free MB left under the limit (green)
            }  // ends draw
            reset();  // sets up the starting heap and draws it once, when the tab opens
            panel.append(h('div', { class: 'stack', style: { gap: '8px' } },  // builds the tab as a stack...
              h('div', { class: 'card white', style: { padding: '6px 8px' } }, svg), stats,  // ...the heap drawing in a white card, then the chips
              h('div', { class: 'row', style: { gap: '6px' } }, B.open, B.close, B.gc, B.trim, B.reset), say,  // the button row, then the message box
              h('div', { class: 'callout why m0 small', 'data-label': 'Why a limit?', html: 'It protects the whole phone. An app that leaks memory hits its own ceiling and crashes alone, instead of slowly pushing every other app out of RAM.' })));  // why callout: the limit protects the phone, since a leaking app crashes alone instead of pushing others out; ends the tab
          }  // ends tabHeap
          /* Tabs 2 and 3: code, explained line by line in sync with a highlight. */
          const TRIM_CODE = [  // TRIM_CODE: the Kotlin example for tab 2, each entry [shown code line, explanation shown when that line is highlighted]
            ['class PhotoApp : Application() {', 'The app’s Application object lives exactly as long as its process, so it is a natural place to answer memory callbacks.'],  // shown code, line 1: the Application class, which lives as long as the process
            ['  val thumbs = ThumbnailCache(maxMB = 60)', 'A cache of decoded thumbnails (our own class). Everything in it can be rebuilt from the photo files, which makes it the perfect thing to give up.'],  // shown code, line 2: a thumbnail cache that can always be rebuilt
            ['  override fun onTrimMemory(level: Int) {', 'Android calls this on the app’s main thread when memory matters for this app. <b>level</b> says how serious the situation is: a higher number is more serious.'],  // shown code, line 3: the onTrimMemory callback and its level argument
            ['    super.onTrimMemory(level)', 'Let the framework release its own caches first.'],  // shown code, line 4: lets the framework release its own caches first
            ['    if (level >= TRIM_MEMORY_BACKGROUND) {', 'Our process has joined the list of cached apps. If memory gets tighter, lmkd may kill us next, so give back as much as possible.'],  // shown code, line 5: the serious level, where the app is cached and may be killed next
            ['      thumbs.clear()', 'Drop every thumbnail. The objects become unreachable, the garbage collector reclaims them, and the process needs less RAM.'],  // shown code, line 6: drop the whole cache
            ['    } else if (level >= TRIM_MEMORY_UI_HIDDEN) {', 'A milder level: our screens have just left the display because the user switched to another app.'],  // shown code, line 7: the milder level, where the app's screens were just hidden
            ['      thumbs.shrinkTo(maxMB = 20)', 'Keep a small part of the cache, so a quick return to the app still feels instant.'],  // shown code, line 8: keep only a small part of the cache
            ['    }', 'Levels are tested with >= and the most serious one first, so each call takes exactly one branch.'],  // shown code, line 9: closes the if; the explanation says why the most serious level is tested first
            ['  }', 'The callback returns quickly. Like any main-thread code it must never block, or the app would freeze.'],  // shown code, line 10: ends the callback, which must return quickly
            ['}', 'End of the class. Anything dropped here is simply decoded again the next time it is needed.'],  // shown code, line 11: ends the class
          ];  // closes TRIM_CODE
          const SAVE_CODE = [  // SAVE_CODE: the Kotlin example for tab 3, saving and restoring screen state, in the same [code, explanation] form
            ['class EditorActivity : AppCompatActivity() {', 'One screen of a messaging app: the user is writing a reply.'],  // shown code, line 1: an activity, one screen of a messaging app
            ['  override fun onSaveInstanceState(out: Bundle) {', 'Android calls this when the activity may be destroyed later, for example as the user switches away. It cannot wait for the kill itself, because a kill gives no warning.'],  // shown code, line 2: onSaveInstanceState, called before a possible kill because a kill gives no warning
            ['    super.onSaveInstanceState(out)', 'The framework saves standard view state, such as the text typed into fields that have ids. The half-written reply is covered.'],  // shown code, line 3: the framework saves the standard view state such as typed text
            ['    out.putLong("replyTo", replyToId)', 'Our own extra: which message the user is replying to. Only our code knows that, so only our code can save it.'],  // shown code, line 4: saves which message is being answered
            ['    out.putString("photo", attachedPhotoUri)', 'And the photo they attached, saved as its location, never the picture itself: the bundle must stay small.'],  // shown code, line 5: saves the attached photo's location, not the picture, to keep the bundle small
            ['  }', 'Android keeps this bundle outside our process, so it survives when lmkd kills the process.'],  // shown code, line 6: ends the save; Android keeps the bundle outside the process
            ['  override fun onCreate(saved: Bundle?) {', 'Runs every time the activity is created: on a fresh launch, and again on a cold start after a kill.'],  // shown code, line 7: onCreate, which runs on a fresh launch and on a cold start after a kill
            ['    super.onCreate(saved)', 'Lets the framework do its own set-up from the bundle.'],  // shown code, line 8: lets the framework restore its part
            ['    setContentView(R.layout.editor)', 'Builds the screen. The standard view state (the typed text) is put back automatically a little later.'],  // shown code, line 9: builds the screen
            ['    if (saved != null) {', '<b>saved</b> is null on a fresh launch and holds the bundle when the activity is being recreated.'],  // shown code, line 10: the bundle is null on a fresh launch and present when recreated
            ['      replyToId = saved.getLong("replyTo")', 'Put back which message we are replying to.'],  // shown code, line 11: restores which message is being answered
            ['      attachedPhotoUri = saved.getString("photo")', 'And the attached photo, which is reloaded from its location.'],  // shown code, line 12: restores the attached photo
            ['    }', 'The user sees the screen exactly as they left it and never learns that the process was killed.'],  // shown code, line 13: closes the if; the user never notices the kill
            ['  }', 'End of onCreate.'],  // shown code, line 14: ends onCreate
            ['}', 'End of the activity. Real data, such as sent messages, belongs in a database or file, saved as soon as it changes.'],  // shown code, line 15: ends the activity, with a reminder that real data belongs in a database or file
          ];  // closes SAVE_CODE
          function codeTab(panel, lines) {  // codeTab(panel, lines): draws tab 2 or 3: a code listing with a player that walks through it one line at a time
            const code = ctx.ui.code(lines.map((l) => l[0]).join('\n'), { lang: 'c', fontSize: 13 });  // the numbered, colored code listing built by the shell from the first part of every entry (C-style coloring)
            const player = ctx.ui.player({ count: lines.length, interval: 2800, render: (i) => { code.mark(i + 1); return `<b>Line ${i + 1}.</b> ${lines[i][1]}`; } });  // the shell's player: one frame per line, every 2.8 seconds; each frame highlights its line and shows that line's explanation
            panel.append(h('div', { class: 'stack', style: { gap: '8px' } }, code, player.el));  // puts the listing and the player into the tab
            return () => player.stop();  // returns a tidy-up function, which the tab widget calls when the student switches tabs, so the player stops
          }  // ends codeTab
          el.append(h('div', { class: 'split l fill' },  // builds the page: two columns, the four duties on the left and the tabs on the right
            h('div', { class: 'stack', style: { gap: '8px' } },  // left column: a stack of text blocks
              h('p', { class: 'lead m0', html: 'The killer works on whole processes. Inside its process, every app has four duties.' }),  // opening sentence: the killer works on whole processes, and inside each one the app has four duties
              h('ol', { class: 'small m0', style: { display: 'flex', flexDirection: 'column', gap: '4px' }, html:  // a numbered list of the four duties, stacked with small gaps
                '<li><b>Stay under the heap limit.</b> Each app’s Java or Kotlin heap has a ceiling fixed per device (ActivityManager.getMemoryClass() reports it, often 128–512 MB). Going past it throws OutOfMemoryError.</li>' +  // duty 1: stay under the heap limit, or OutOfMemoryError is thrown
                '<li><b>Let the garbage collector work.</b> ART frees objects nothing refers to. Drop references you no longer need, or the memory stays taken.</li>' +  // duty 2: drop references so the garbage collector can free objects
                '<li><b>Answer onTrimMemory.</b> Release caches you can rebuild. Lean cached apps make kills less necessary.</li>' +  // duty 3: release rebuildable caches in onTrimMemory
                '<li><b>Save state early.</b> When the user returns to a killed app, Android cold-starts it and hands back its saved instance state.</li>' }),  // duty 4: save state early, so a cold start can bring the screen back
              h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'Saving data in onDestroy(). When lmkd kills a cached process, <b>no code runs at all</b>: the process just vanishes. Save in onSaveInstanceState() or onStop(), and keep real data in a database or file.' })),  // common-mistake callout: saving in onDestroy fails because a kill runs no code at all
            ctx.ui.tabs([  // right column: the shell's tab widget with three tabs
              { label: 'Heap + GC', render: (p) => tabHeap(p) },  // tab 1: the heap and garbage collector experiment
              { label: 'onTrimMemory code', render: (p) => codeTab(p, TRIM_CODE) },  // tab 2: the onTrimMemory code walk-through
              { label: 'Saving state code', render: (p) => codeTab(p, SAVE_CODE) },  // tab 3: the saving-state code walk-through
            ])));  // closes the tab list and the page
        },  // ends render() for step 6
      },  // closes step 6
      /* ---------------- 7. Recap ---------------- */
      {  // opens step 7, the recap
        title: 'Recap: six ideas about Android memory',  // the title shown at the top of step 7
        kind: 'recap',  // kind 'recap': the summary page, always on the core path
        render(el, ctx) {  // render(el, ctx): draws the recap when the student arrives
          const { h } = ctx;  // only the HTML builder h is needed here; the recap has no drawing
          const ladder = h('div', { class: 'row small', style: { gap: '6px' }, html:  // ladder: one row of colored chips showing the order of Android's responses when RAM runs low
            '<b>When RAM runs low:</b>' +  // its bold heading
            '<span class="chip mem">1 · drop clean pages</span>→' +  // first response: drop clean pages (green)
            '<span class="chip accent">2 · compress into zram</span>→' +  // second: compress into zram (indigo)
            '<span class="chip warn">3 · apps trim</span>→' +  // third: apps trim (amber)
            '<span class="chip bad">4 · lmkd kills: cached first, foreground last</span>' });  // last: lmkd kills, cached apps first and the foreground app last (red)
          el.append(h('div', { class: 'stack fill', style: { gap: '12px' } },  // builds the page: a stack that fills the step's height
            h('p', { class: 'lead m0' }, 'Say each answer out loud before you flip the card.'),  // instruction: answer out loud before flipping each card
            ctx.ui.flipcards([  // the shell's flip cards: question on the front, answer on the back
              ['What does Android keep from Linux memory management?', 'All of it: virtual memory, paging, the page cache, the buddy and slab allocators. It only adds pieces on top for phone limits.'],  // card: what Android keeps from Linux memory management
              ['Why is there normally no swap area on a phone’s flash?', 'Flash survives a limited number of rewrites, and writing costs battery and time. Clean file pages are still dropped and re-read; anonymous pages go to zram or die with their process.'],  // card: why phones normally have no swap area on flash
              ['ashmem in one breath?', 'Shared memory named by a file descriptor. Pass the descriptor (over Binder) and the receiver maps the same frames. Unpinned parts may be purged under pressure. Today: memfd.'],  // card: ashmem in one sentence
              ['ION in one breath?', 'Pools of memory for hardware buffers, some reserved at boot so a contiguous block always exists, shared as descriptors so camera, GPU and display never copy. Today: DMA-BUF heaps.'],  // card: ION in one sentence
              ['Who does lmkd kill first?', 'The process with the highest oom_score_adj: the cached app used longest ago. Service, visible and foreground processes go only in deeper trouble.'],  // card: which process lmkd kills first
              ['An app’s four memory duties?', 'Stay under the heap limit, drop references so the GC can reclaim, release caches in onTrimMemory, and save state early, because a kill runs no code.'],  // card: an app's four memory duties
            ], { cols: 3, height: 192 }),  // closes the cards: three columns, each card 192 pixels tall
            h('div', { class: 'card tight' }, ladder)));  // the ladder in a small card under the flip cards, ending the page
        },  // ends render() for step 7
      },  // closes step 7
      /* ---------------- 8. Quiz ---------------- */
      {  // opens step 8, the quiz
        title: 'Check yourself',  // the title shown at the top of step 8
        kind: 'check',  // kind 'check': the quiz page, whose score counts toward mastery
        quiz: [  // quiz: the questions; the shell's quiz engine draws them, checks answers and shows feedback
          { q: 'Why do Android phones normally have no swap partition on their flash storage?',  // question 1 (multiple choice): why phones have no swap partition on flash
            choices: ['The Linux kernel used on phone processors has no support for moving pages in and out', 'Android gives each app a fixed physical memory area, so it never needs virtual memory', 'Flash wears out with repeated rewriting, and heavy paging would also cost battery', 'Flash storage can only be read in order from start to end, so random page reads fail'],  // the four choices: no kernel support, fixed memory per app, flash wear and battery, flash read only in order
            answer: 2,  // answer: 2, counting from 0, so the third choice (flash wears out) is right
            feedback: ['Phone kernels page all the time: they drop and re-read clean file-backed pages. The problem is writing anonymous pages to flash.', 'Android runs on Linux and uses virtual memory fully: every process has its own address space and page tables.', null, 'Flash is read at random addresses quite quickly. Reading is not the issue; repeated writing is.'],  // feedback for each wrong choice (null for the right one): phones do page, Android does use virtual memory, flash reads randomly
            why: 'Flash has limited write endurance, and writing costs time and energy. So phones avoid writing anonymous pages to a swap area on flash, and use zram, trimming and killing instead.' },  // explanation shown after answering: limited write endurance and energy cost, so phones use zram, trimming and killing
          { type: 'tf', q: 'Android never moves pages between RAM and flash storage.', answer: false,  // question 2 (true or false): Android never moves pages between RAM and flash; the answer is false
            why: 'Clean file-backed pages (program code, resources, mapped files) are dropped under pressure and read back from flash when needed. Only writing anonymous pages to a flash swap area is avoided.' },  // explanation: clean file-backed pages are dropped and read back; only writing anonymous pages to flash is avoided
          { type: 'num', q: 'A phone compresses 600 MB of cold anonymous pages into zram, which shrinks them to one third of their size. How many MB of RAM does this free?', answer: 400, tol: 0, unit: 'MB',  // question 3 (calculate): RAM freed when 600 MB are compressed to a third; answer 400 MB, no tolerance
            why: 'The 600 MB become 600 ÷ 3 = 200 MB of compressed data, still kept in RAM. RAM freed = 600 − 200 = 400 MB.' },  // explanation: 600 MB become 200 MB of compressed data, so 400 MB are freed
          { type: 'order', q: 'Put Android’s responses to falling free memory in order, from the first and gentlest to the last resort.',  // question 4 (put in order): Android's responses to falling free memory, gentlest first
            items: ['The kernel drops clean file-backed pages and compresses cold anonymous pages into zram', 'Apps are asked to shrink through onTrimMemory', 'lmkd kills the cached process with the highest oom_score_adj', 'If memory is still short, lmkd kills more important processes (service, then visible)'],  // the four responses in their correct order; the quiz engine shuffles them for the student
            why: 'Cheap reclaim that loses nothing comes first, then voluntary shrinking by apps, and only then kills, starting with the process the user will miss least.' },  // explanation: cheap reclaim, then apps shrinking, then kills starting with the least missed process
          { q: 'Memory is critically low. Which process does lmkd kill first?',  // question 5 (multiple choice): which process lmkd kills first
            choices: ['A mail app cached five minutes ago (oom_score_adj 900)', 'A browser cached two hours ago (oom_score_adj 930)', 'A music app playing in the background (oom_score_adj 200)', 'The game the user is playing right now (oom_score_adj 0)'],  // the choices: two cached apps with different ages, a music app playing, and the foreground game, each with its score
            answer: 1,  // answer: 1, the browser cached two hours ago, which has the highest score
            feedback: ['It is cached too, but used more recently, so its score is lower. It goes after the browser.', null, 'Music the user can hear is perceptible; killing it would be noticed at once. Cached apps go first.', 'The foreground app is the very last candidate: killing it would destroy what the user is doing.'],  // feedback for each wrong choice: the mail app is newer, music is perceptible, the foreground app goes last
            why: 'lmkd kills the process with the highest oom_score_adj. Among cached apps, the one used longest ago gets the highest score, so the two-hour-old browser goes first.' },  // explanation: the highest oom_score_adj goes first, and among cached apps that is the one used longest ago
          { type: 'bucket', q: 'Sort each mechanism: standard Linux feature, or something Android added?', buckets: ['Standard Linux', 'Added by Android'],  // question 6 (sort into groups): standard Linux feature or Android addition, with the two group names
            items: [['Demand paging', 0], ['Buddy page allocator', 0], ['memfd_create', 0], ['DMA-BUF heaps', 0], ['ashmem', 1], ['ION', 1], ['lmkd', 1], ['onTrimMemory callbacks', 1]],  // the eight mechanisms, each with its correct group: 0 for standard Linux, 1 for added by Android
            why: 'Android keeps the whole Linux memory system. It added ashmem, ION, the low memory killer (now lmkd) and app callbacks. Newer versions swap its own pieces for mainline ones: memfd for ashmem, DMA-BUF heaps for ION.' },  // explanation: Android keeps all of Linux, added four pieces, and newer versions replace two of them with mainline ones
          { type: 'match', q: 'Match each mechanism to its job.',  // question 7 (match the pairs): each mechanism with its job
            pairs: [['ashmem', 'Shared memory passed between processes as a file descriptor'], ['ION', 'Buffer pools for camera, GPU and display, some reserved at boot'], ['zram', 'Compressed swap area kept in RAM'], ['lmkd', 'Kills the process with the highest oom_score_adj'], ['onTrimMemory', 'Lets an app release caches it can rebuild']],  // the five pairs: ashmem, ION, zram, lmkd and onTrimMemory with their jobs
            why: 'Two mechanisms share memory (ashmem between processes, ION with hardware), one stretches RAM (zram), one asks apps to shrink (onTrimMemory), and one is the last resort (lmkd).' },  // explanation: two mechanisms share memory, one stretches RAM, one asks apps to shrink and one is the last resort
          { type: 'multi', q: 'Which statements about ashmem are true?',  // question 8 (select all that apply): true statements about ashmem
            choices: ['A process that receives the descriptor maps the same physical frames as the creator', 'Sharing a region means passing its file descriptor, often in a Binder call', 'The receiver always gets the same descriptor number as the sender', 'Unpinned parts of a region may be purged by the kernel under memory pressure', 'The memory stays allocated after every process holding it has exited'],  // the five statements: same frames, passing the descriptor, same descriptor number, purging unpinned parts, outliving every holder
            answer: [0, 1, 3],  // the true ones are the first, second and fourth (counting from 0: 0, 1 and 3)
            why: 'Descriptor numbers are per process, so the receiver usually gets a different number for the same region. The region is freed once the last holder closes it, which is why Android prefers it to System V shared memory.' },  // explanation: descriptor numbers are per process, and the region is freed when its last holder closes it
          { q: 'A user returns to a chat app that lmkd killed while it sat in the cached list. What happens?',  // question 9 (multiple choice): what happens when the user returns to a killed chat app
            choices: ['The old process wakes up and continues from the exact instruction where it was stopped', 'Android tells the user that the app crashed, then opens it on its very first screen', 'Android reads the old process’s memory back from the swap area on flash storage', 'A new process is started (a cold start) and receives the saved instance state'],  // the choices: the old process resumes, a crash message, a read back from swap, or a cold start with saved state
            answer: 3,  // answer: 3, a new process that receives the saved instance state
            feedback: ['The old process is gone: its memory was freed when it was killed.', 'Killing cached apps is routine on Android; the user is not told, and a well-written app hides it.', 'Phones normally have no swap area on flash, and a killed process has no memory left to restore.', null],  // feedback for each wrong choice: the old process is gone, kills are routine and silent, phones have no swap on flash
            why: 'A kill destroys the process, but Android keeps the activity’s saved instance state. On return it creates a new process and passes that state to onCreate, so only a short delay gives the kill away.' },  // explanation: the saved instance state survives the kill and is handed to onCreate in the new process
          { type: 'tf', q: 'When lmkd kills a cached app, Android first calls the app’s onDestroy() so it can save its data.', answer: false,  // question 10 (true or false): Android calls onDestroy before lmkd kills an app; the answer is false
            why: 'A kill runs no app code at all: the process simply vanishes. That is why apps must save state in onSaveInstanceState() or onStop(), and keep real data in a database or file.' },  // explanation: a kill runs no app code, so state must be saved earlier and real data kept in a database or file
          { type: 'num', q: 'A 1920 × 1080 image at 4 bytes per pixel is about 8.3 MB. If a camera pipeline copied every frame twice and ran at 30 frames per second, about how many MB would it copy per second?', answer: 498, tol: 4, unit: 'MB/s',  // question 11 (calculate): MB copied per second by a pipeline that copies each 8.3 MB frame twice at 30 fps; answer 498, within 4
            why: '8.3 MB × 2 copies × 30 frames = 498 MB every second. Sharing one ION (DMA-BUF) buffer through a file descriptor cuts this to zero.' },  // explanation: 8.3 × 2 × 30 = 498 MB per second, and sharing one buffer cuts it to zero
          { q: 'An app’s heap limit is 256 MB. It holds 200 MB of live objects and 30 MB of garbage, then asks for a 40 MB object. What happens?',  // question 12 (multiple choice): a 40 MB request in a heap with 200 MB live and 30 MB garbage under a 256 MB limit
            choices: ['It fails at once with OutOfMemoryError, since 230 + 40 = 270 MB is over the limit', 'The runtime collects the garbage first; 200 + 40 = 240 MB fits, so it succeeds', 'lmkd kills the app at once, because its heap is almost completely full', 'The 30 MB of garbage is compressed into zram to make room for the object'],  // the choices: an immediate OutOfMemoryError, a collection first then success, a kill by lmkd, or garbage moved to zram
            answer: 1,  // answer: 1, the runtime collects the garbage first and the object fits
            feedback: ['Garbage does not count against the app for long: the runtime collects it before giving up. Only live objects (200 MB) must fit with the new one.', null, 'lmkd chooses victims by importance across the whole phone, not by how full one app’s heap is. The heap limit is enforced inside the app by the runtime.', 'Garbage is simply freed by the garbage collector; nothing needs to be kept.'],  // feedback for each wrong choice: garbage is collected before giving up, lmkd ignores heap fullness, garbage is simply freed
            why: 'When an allocation would pass the limit, the garbage collector runs first. 200 MB live + 40 MB = 240 MB ≤ 256 MB, so it fits. OutOfMemoryError comes only if the live data plus the new object would still exceed the limit.' },  // explanation: only live data plus the new object must fit, 240 MB of 256 MB
        ],  // closes the quiz list
      },  // closes step 8
    ],  // closes the list of steps
    notes: `${/* notes: the section's reading notes as HTML, shown in the Notes panel; the backtick starts a long text */''}
<h3>Android memory management: Linux, stretched for phones</h3>${/* notes heading: Android memory management as Linux stretched for phones */''}
<p>Android runs on Linux and keeps all of its memory management: virtual address spaces, page tables, demand paging, the page cache, the buddy and slab allocators. It adds a few pieces because a phone differs from a PC in three ways:</p>${/* notes paragraph: Android keeps all of Linux memory management and adds pieces for three phone limits */''}
<ul>${/* starts the list of phone limits */''}
<li><b>Small RAM, many apps.</b> A few gigabytes are shared by the system and dozens of apps the user switches between; every switch back should feel instant.</li>${/* notes list item: small RAM shared by many apps */''}
<li><b>Flash storage, not a disk.</b> Each flash block survives a limited number of rewrites (its <b>write endurance</b>), and writing costs time and battery, so phones normally have no swap area on storage.</li>${/* notes list item: flash wears out and writing costs battery, so there is normally no swap area */''}
<li><b>Hardware that shares big buffers.</b> Camera, GPU, video engine and display pass large images to each other by DMA, many times a second.</li>${/* notes list item: hardware that passes big images around by DMA */''}
</ul>${/* ends the list of phone limits */''}
<table>${/* starts the table of Android's memory pieces */''}
<tr><th>Piece</th><th>Where</th><th>Job</th></tr>${/* table header row: piece, where it runs, and its job */''}
<tr><td>Activity Manager</td><td>framework (system server)</td><td>Ranks every app process by importance, writes an oom_score_adj for it, sends onTrimMemory</td></tr>${/* table row: the Activity Manager in the framework */''}
<tr><td>lmkd</td><td>user-space daemon</td><td>Watches memory pressure and kills the process with the highest oom_score_adj</td></tr>${/* table row: lmkd, a user-space daemon */''}
<tr><td>ashmem, now memfd</td><td>kernel</td><td>Shared memory passed between processes as a file descriptor</td></tr>${/* table row: ashmem (now memfd) in the kernel */''}
<tr><td>ION, now DMA-BUF heaps</td><td>kernel</td><td>Buffer pools for hardware, shared without copying</td></tr>${/* table row: ION (now DMA-BUF heaps) in the kernel */''}
</table>${/* ends the table */''}

<h3>Freeing RAM without a swap area</h3>${/* notes heading for part 2: freeing RAM without a swap area */''}
<p>What the kernel can do with a page depends on its kind:</p>${/* notes paragraph: what the kernel may do depends on the kind of page */''}
<ul>${/* starts the list of page kinds */''}
<li><b>File-backed page</b> (code, resources, mapped files): if clean, it is simply dropped, because the file on flash still holds a copy; it is read back when needed. A changed (dirty) one is first written back to its file. Android does this constantly, so “Android does no paging” is false.</li>${/* notes list item: file-backed pages are dropped when clean, which is why "Android does no paging" is false */''}
<li><b>Anonymous page</b> (heap, stack): no file holds it. A desktop writes it to a swap area on disk. A phone avoids writing it to flash, so it can only stay in RAM, be compressed into <b>zram</b>, be freed by the app itself, or vanish when its process is killed.</li>${/* notes list item: anonymous pages can only stay, go to zram, be freed by the app or die with the process */''}
</ul>${/* ends the list of page kinds */''}
<p><b>zram</b> is a swap device made of RAM: swapped-out pages are compressed, often to about a third, and kept in memory. It costs processor time but no flash writes. Worked example: 600 MB of cold pages compressed 3:1 become 200 MB, freeing 600 − 200 = 400 MB; likewise 6 heap pages fit in 2 frames, freeing 4.</p>${/* notes paragraph: what zram is, with the 600 MB worked example and the 6-heap-pages example from step 2 */''}

<h3>ashmem: shared memory by descriptor (now memfd)</h3>${/* notes heading for part 3: ashmem */''}
<ol>${/* starts the numbered list of ashmem's four steps */''}
<li>Process A asks the kernel for a named region and receives a <b>file descriptor</b> for it (say number 23 in A’s table).</li>${/* ashmem step 1: A creates the region and gets descriptor 23 */''}
<li>A maps the region into its address space and writes into it with ordinary stores.</li>${/* ashmem step 2: A maps the region and writes into it */''}
<li>A passes the descriptor to process B, usually inside a Binder call. B receives its own descriptor number (say 41): different number, same region. No data is copied.</li>${/* ashmem step 3: A passes the descriptor over Binder and B gets its own number, 41 */''}
<li>B maps the region and sees the very same physical frames, so a write by either is seen by both.</li>${/* ashmem step 4: B maps the same frames, so writes are seen by both */''}
</ol>${/* ends the numbered list */''}
<p>The owner can <b>unpin</b> parts it could rebuild; under memory pressure the kernel may <b>purge</b> them (they then read as zeros). When the owner pins them again, the kernel reports whether they were purged, so the owner knows to regenerate the contents. The region is freed when the last holder lets go of it, even after a crash. System V shared memory, which outlives its processes unless removed, would leak on a phone that kills processes constantly, so Android omits it. Newer Android versions use the standard Linux <b>memfd</b> (memfd_create) instead; it has no pinning.</p>${/* notes paragraph: unpinning and purging, why System V shared memory is left out, and memfd today */''}

<h3>ION: buffers for hardware (now DMA-BUF heaps)</h3>${/* notes heading for part 4: ION */''}
<p>Some devices need one <b>physically contiguous</b> block, or memory from a particular region. After hours of use, free frames are scattered (external fragmentation): for example 10 free frames whose longest unbroken run is 3 cannot satisfy a request for 6 contiguous frames. ION manages several pools (<b>heaps</b>), some <b>set aside at boot</b> for a device, so the camera’s block always exists; the price is that apps cannot use that memory (Linux’s CMA softens this by lending it to movable pages while the device is idle). ION hands out each buffer as a file descriptor, so camera, GPU and display pass one buffer along (<b>zero-copy sharing</b>). Since Android 12 the mainline Linux <b>DMA-BUF heaps</b> do this job, and ION has been removed from the mainline kernel.</p>${/* notes paragraph: contiguous blocks, external fragmentation, heaps set aside at boot, CMA and DMA-BUF heaps */''}
<p>Why copies matter: one frame = width × height × 4 bytes. A 1920 × 1080 frame is 8,294,400 bytes ≈ 8.3 MB; copying it twice per frame at 30 frames per second moves about 8.3 × 2 × 30 ≈ 498 MB every second. Sharing one buffer moves 0 MB/s.</p>${/* notes paragraph: the arithmetic of copying a 1080p frame, about 498 MB per second */''}

<h3>Importance, trimming and the low memory killer</h3>${/* notes heading for part 5: importance, trimming and the low memory killer */''}
<p>The Activity Manager ranks every app process and writes its rank as an <b>oom_score_adj</b> (−1000 to 1000; higher means more expendable):</p>${/* notes paragraph: the Activity Manager writes each process's rank as an oom_score_adj */''}
<table>${/* starts the table of importance levels */''}
<tr><th>Importance</th><th>Typical oom_score_adj</th><th>Example</th></tr>${/* table header row: importance, typical score and an example */''}
<tr><td>Foreground</td><td>0</td><td>the app the user is touching</td></tr>${/* table row: foreground, 0 */''}
<tr><td>Visible</td><td>100</td><td>a navigation app in a floating window</td></tr>${/* table row: visible, 100 */''}
<tr><td>Perceptible</td><td>200</td><td>music playing</td></tr>${/* table row: perceptible, 200, which the lab does not use */''}
<tr><td>Service</td><td>about 500</td><td>a background upload</td></tr>${/* table row: service, about 500 */''}
<tr><td>Cached</td><td>900–999, older = higher</td><td>apps the user left, kept for a quick return</td></tr>${/* table row: cached, 900 to 999, older apps higher */''}
</table>${/* ends the table */''}
<p>As free memory falls, Android responds in order: (1) the kernel drops clean pages and compresses cold anonymous pages into zram; (2) apps are asked to shrink through <b>onTrimMemory</b>; (3) <b>lmkd</b> kills the process with the highest oom_score_adj (the cached app used longest ago) and repeats until enough memory is free; only in deeper trouble does it reach service, then visible processes, and the foreground app last. The killer began as a driver inside the kernel with fixed free-memory thresholds; it now runs as the user-space daemon lmkd, which since Android 10 uses the kernel’s <b>pressure stall information (PSI)</b>.</p>${/* notes paragraph: the four responses in order, and how the killer moved from the kernel to lmkd with PSI */''}
<p>Worked example (apps share 2,700 MB; trim line 600 MB free, kill line 300 MB free): the user opens a Game needing 800 MB with 650 MB free, leaving 150 MB short. The cached Camera trims 150 MB (0 MB free). lmkd kills Chat (cached, adj 920, 250 MB → 250 MB free), then Browser (adj 910, 350 MB → 600 MB free).</p>${/* notes paragraph: a worked example of trimming and two kills when a large app opens */''}
<p>Reopening an app whose process still exists lets Android skip creating one: a <b>hot start</b> if the existing activity just comes back to the front, a <b>warm start</b> if the activity (the screen) must be recreated. Either is usually much faster, though the app may still rebuild caches or redraw its screen. Reopening a killed app is a <b>cold start</b>: a new process whose activity receives its <b>saved instance state</b>, so the screen looks as the user left it.</p>${/* notes paragraph: hot and warm starts reuse the process, a cold start creates one and gets the saved instance state */''}

<h3>An app’s four memory duties</h3>${/* notes heading for part 6: an app's four memory duties */''}
<ul>${/* starts the list of duties */''}
<li><b>Stay under the heap limit.</b> Each app’s Java or Kotlin heap has a device-set ceiling (ActivityManager.getMemoryClass(), often 128–512 MB). Allocating past it throws OutOfMemoryError. It protects the phone from one leaky app.</li>${/* notes list item: the heap limit and OutOfMemoryError */''}
<li><b>Let the garbage collector work.</b> ART frees objects that nothing references. An object whose last reference is dropped is garbage: it still takes space until the next collection. Before giving up, the runtime collects garbage: with a 256 MB limit, 200 MB live and 30 MB garbage, a 40 MB request succeeds (200 + 40 = 240 MB). Only if live data plus the request exceeds the limit is OutOfMemoryError thrown.</li>${/* notes list item: garbage collection, with the 256 MB worked example from the quiz */''}
<li><b>Answer onTrimMemory.</b> Release caches that can be rebuilt. TRIM_MEMORY_UI_HIDDEN means the app’s screens just left the display; TRIM_MEMORY_BACKGROUND means it is in the cached list and may be killed next. Higher levels are more serious.</li>${/* notes list item: onTrimMemory and its two levels */''}
<li><b>Save state early.</b> A kill runs no app code at all (not even onDestroy()). Save screen state in onSaveInstanceState() or onStop(), keep the bundle small, and keep real data in a database or file.</li>${/* notes list item: save state early, since a kill runs no code */''}
</ul>${/* ends the list of duties */''}
<h4>Standard Linux vs added by Android</h4>${/* notes sub-heading: standard Linux versus Android additions */''}
<p>Standard Linux: demand paging, the page cache, the buddy allocator, zram, PSI, memfd_create, DMA-BUF heaps. Added by Android: ashmem, ION, the low memory killer (now lmkd), and app callbacks such as onTrimMemory.</p>${/* notes paragraph: which mechanisms are standard Linux and which Android added */''}
`,  // end of the notes text
  });  // closes the section object and the Guide.section call
})();  // ends the wrapping function from the top of the file and runs it
