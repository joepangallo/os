# Chapters 6–9 HTML: follow-up review

Reviewed 2026-10-04 after the fixes and rebuild. Review only; the delivered HTML and implementation sources were not changed.

Seven original findings are fixed within the verification scope below; the Linux locking qualification is partly fixed. The Binder playback race is gone, the scheduler lab retains its edited state across layout rebuilds, and all 28 checked source files match the rebuilt HTML. Three remaining corrections are described after the original findings, including one wording problem introduced by the fixes.

**Verification limit:** Chrome failed to launch through Python Playwright, the fallback Chromium executable was absent, and the connected-browser tool required approval unavailable under this session's policy. Functional evidence below comes from executing the shipped JavaScript with deterministic timers and minimal DOM stubs. It is not a browser geometry, accessibility-tree or screen-reader pass.

## Original findings

### 1. Binder Pause–Run doubles playback — Fixed

Executed the rebuilt page's actual `6.11/5` render and control handlers. Run at wall time 0 ms, Pause at 100 ms and Run at 200 ms now leave the model clock at **100 ms at wall time 650 ms**, then **200 ms at 1450 ms**. The old callback no longer advances the clock. Run → Next tick → Run also produces only the manual tick and one resumed tick; Reset remains at zero after pending callbacks have elapsed.

[Pause now increments the generation](src/sections/6.11.js:721), invalidating the previous playback chain. The existing Run callback checks that generation before ticking.

### 2. Scheduler lab loses edits on responsive resize — Fixed

Executed the actual `9.2/7` render with the shared tabs/player helpers. Changed A's service time to **12**, selected **RR**, set **q = 3**, and advanced to **frame 2**. Reconstructed the lesson in phone mode and then desktop mode with the retained context data: all four values survived. The **Compare all policies** tab and **Mean Tr** selection also survived a layout rebuild.

The [lab state](src/sections/9.2.js:904), [player restoration](src/sections/9.2.js:947), and [tab restoration](src/sections/9.2.js:995) now use `ctx.keep`. Executing the [resize handler](src/shell/shell.js:500) confirmed that it requests `relayout: true`; the [navigation branch](src/shell/shell.js:438) preserves that store only for a relayout of the same slide. Ordinary navigation still intentionally starts a fresh lab. Automatic playback pauses during reconstruction; the tested frame is preserved.

This resolves the named scheduler lab, not every interactive lesson using the shared rebuild path; see new finding 1.

### 3. Unsafe states incorrectly exclude deadlock — Fixed

The [glossary](src/sections/6.3.js:125) and [recap](src/sections/6.3.js:941) now say **not necessarily deadlocked**, explicitly allowing both an existing deadlock and eventual completion.

Re-executed the actual `safety()` with resource totals `(1,1)`, allocations `(1,0)` and `(0,1)`, and claims `(1,1)` for both processes. It returns `safe: false`, no safe sequence, and both processes remaining. With each process waiting for the other's resource, this is the original deadlocked counterexample, now consistent with the wording and the subset quiz answer.

### 4. Standard signals described as unable to carry data — Fixed

The [definition](src/sections/6.8.js:637), [lesson warning](src/sections/6.8.js:913), and [notes table](src/sections/6.8.js:1326) distinguish `kill()` from `sigqueue()`, and explain that coalesced standard signals retain the first pending instance's information. These edits are present in the rebuilt page and agree with [sigqueue(3)](https://man7.org/linux/man-pages/man3/sigqueue.3.html) and [signal(7)](https://man7.org/linux/man-pages/man7/signal.7.html).

The separate overstatement about real-time queuing remains; see new finding 3.

### 5. Linux spinlock answers lack configuration scope — Partly fixed

The [interrupt question](src/sections/6.8.js:1291) and [spin/sleep sorting question](src/sections/6.8.js:1304) now explicitly specify non-PREEMPT_RT kernels. The lesson and notes add PREEMPT_RT qualifications and distinguish `raw_spinlock_t`.

However, the new [variant-table note](src/sections/6.8.js:1034) and [notes qualification](src/sections/6.8.js:1358) say interrupts are left **on**, rather than that these operations do not change their disabled state. Also, the independently accessible [rwlock_t glossary entry](src/sections/6.8.js:645) still identifies it unconditionally as a spinlock. See new finding 2 for the remaining correction, checked against the [kernel lock documentation](https://www.kernel.org/doc/html/latest/locking/locktypes.html).

### 6. Android process reuse called an instant warm start — Fixed

Executed the actual app-opening model for Chat → Maps → Chat. The return still has the internal identifier `kind: 'warm'`, but its event now explicitly says **Warm or hot start**, with process reuse and no extra RAM needed in this example. That internal identifier no longer determines an incorrect user-facing classification.

The [narration](src/sections/8.6.js:662), [counter](src/sections/8.6.js:710), [glossary](src/sections/8.6.js:128), and [notes](src/sections/8.6.js:991) distinguish activity recreation from foregrounding an existing activity and replace the instant-return promise with a qualified speed comparison. The model explicitly does not track activity state. This addresses the reviewed example and agrees with the activity distinction and trimming caveat in [Android's startup documentation](https://developer.android.com/topic/performance/issues/launch-time).

### 7. Chapter 7 light-theme badges have insufficient contrast — Fixed

The [light-theme Chapter 7 color](src/shell/shell.css:45) is now `#047857`. Recomputed contrast for the [selected chapter button](src/shell/shell.css:131) and [section badge](src/shell/shell.css:154): white on that green is **5.484:1**, above 4.5:1. The unchanged dark pair, `#0b0f1a` on `#34d399`, is **9.953:1**. Both CSS rules and theme values match the rebuilt HTML. This is a color calculation, not a visual inspection.

### 8. Recap cards have identical names and no exposed state — Fixed

Executed the [shared flip-card helper](src/shell/shell.js:903) using the original two prompts. It constructs distinct names, **Flip card: Safe vs unsafe** and **Flip card: The safety test**, with `aria-pressed="false"`. Enter changes the state to `true`, hides the front with `aria-hidden="true"`, and exposes the back with `aria-hidden="false"`; Space reverses those states.

The original naming/state defects are corrected in the generated attributes and keyboard handlers. Actual screen-reader access to the answer text inside the button container remains unverified; these attribute checks do not establish full accessibility.

## New and remaining findings

### 1. Medium priority: responsive reconstruction still erases the Binder lab

**Reproduction / computation:** in `6.11/5`, select **All four call at once**, then **Next tick**. The clock reads **100 ms**, with active calls. Executing the same render in phone mode with a retained context store restores **0 ms** and an empty call table. The section is marked layout-aware in the rebuilt HTML, and executing the shell's breakpoint handler confirms it takes the reconstruction path. The same initialization runs when reconstructing back to desktop.

**Cause:** the [Binder state](src/sections/6.11.js:666) remains local to `render()`, and [reset](src/sections/6.11.js:676) initializes it on construction. The new [shared persistence mechanism](src/shell/shell.js:438) only helps sections that actually use `ctx.keep`. This is a remaining instance of original finding 2's broader problem, not a newly introduced playback regression.

**Recommendation:** retain the thread limit, clock, calls, queue and thread work in `ctx.keep`; reconstruct the view from that state, with playback paused if desired. Verify edited and partly played runs in both resize directions, including call-table contents.

### 2. Low priority: the new RT caveat promises an interrupt state it does not establish

**Evidence:** the new [lesson note](src/sections/6.8.js:1034) and [notes paragraph](src/sections/6.8.js:1358) describe interrupts as remaining on. The documented contract is that the hard-interrupt suffixes do **not affect** the CPU's interrupt-disabled state. “On” is not that contract. Likewise, “preemption stays on” should describe the operation as not disabling preemption. This wording problem is introduced by the qualification added for original finding 5. See the [kernel's PREEMPT_RT semantics](https://www.kernel.org/doc/html/latest/locking/locktypes.html#spinlock-t-and-preempt-rt).

**Recommendation:** say “On PREEMPT_RT, these locks can block; acquisition does not disable preemption, and `_irq`/`_irqsave` do not change the hardware-interrupt state.” Qualify the [standalone rwlock_t definition](src/sections/6.8.js:645) too, so readers opening only the glossary get the configuration distinction.

### 3. Low priority: real-time signals still promise every send is queued

**Evidence:** the [glossary](src/sections/6.8.js:636), [lesson list](src/sections/6.8.js:909), and [quiz explanation](src/sections/6.8.js:1276) state that every sent copy is queued or delivered. The displayed `sigqueue()` example does not check its return value. Linux limits pending queued signals; `sigqueue()` can return `-1` with `EAGAIN` when that limit is reached. This is documented by [sigqueue(3)](https://man7.org/linux/man-pages/man3/sigqueue.3.html) and the limit discussion in [signal(7)](https://man7.org/linux/man-pages/man7/signal.7.html). This is a remaining teaching qualification, not a regression caused by the standard-signal correction.

**Recommendation:** use “each successfully queued instance is retained separately,” mention finite queue capacity, and show or explain checking the send result. The teaching model can assume successful sends if that assumption is explicit.

## Verification

- Read both requested review files, the changed shared shell helpers, the affected section implementations, and adjacent persistence, timer and teaching code. Loaded all 25 section registrations from the rebuilt HTML in a Node sandbox.
- Compared the complete shell JS, shell CSS, chapter metadata and all 25 section sources against their embedded text: **28/28 exact matches**, allowing the build's closing-script escaping. The earlier section 6.9 source/artifact discrepancy is gone.
- Ran `node src/build.mjs --book 6-9 --check`: **25 sections, 300 section-quiz questions, no blocking problems**. Check-only mode did not rebuild the artifact.
- Ran `node src/dev/qa-9.2/engine.test.js`: **74 engine checks plus section checks passed**. Ran `node src/dev/qa-8.2/test.js`: **273,814 checks passed**.
- Executed the rebuilt Binder and scheduler render functions, actual shared tabs/player/flip-card helpers, and the shell resize handler with minimal DOM stubs. Used deterministic timers for rapid pause/resume, manual-tick/resume and reset cancellation. Exercised retained scheduler inputs, policy, quantum, frame, tab and metric across both layout modes.
- Executed the app-opening and safety-test models from the matching sources; independently calculated both Chapter 7 contrast ratios. Rechecked Linux and Android corrections against the primary documentation linked above. No live kernel or Android-device experiments were performed.
- Attempted `python3 src/tools/check.py operating-systems-ch6-9.html --keys 6.11/5,9.2/7,6.3/9 --no-shots` with bytecode writes disabled. It stopped during browser launch before any assertions. A separate `channel='chrome'` launch confirmed Chrome exits before a page is available. The connected-browser inventory was also blocked by the approval policy.
- No claims are made about clipping, geometry, focus, visual fit at 1280 × 720 or 390 × 844, a clean browser console, or screen-reader output. The PDF was not reviewed. This was not an exhaustive audit of every simulator input or quiz explanation. Temporary review code was removed; only this report was created in the repository.

## Resolution of the remaining findings (2026-10-04)

- **New finding 1 (Binder lab reset on responsive rebuild): fixed.** The thread-pool lab in [6.11](src/sections/6.11.js) now stores its limit, clock, queue, threads and calls in `ctx.keep` on every redraw and resumes from them, paused, after a layout rebuild; a normal visit still starts fresh. Verified in Chrome: after "All four call at once" and two ticks, 1280×720 → 390×844 → 1280×720 keeps `t = 200 ms` and all call rows; leaving and returning shows `t = 0 ms`. The Run–Pause–Run fix still holds (one tick per 0.8 s).
- **New finding 2 (PREEMPT_RT wording): fixed.** The variant-table note and the notes now say the `_irq`/`_irqsave` calls leave the interrupt state as it was and that taking the lock does not disable preemption; the `rwlock_t` glossary entry now says it becomes a sleeping lock under PREEMPT_RT.
- **New finding 3 (real-time signal queuing): fixed.** The glossary, the lesson list and the quiz explanation now say each *successfully* sent copy is queued, that the queue is finite, and that `sigqueue` can fail with `EAGAIN` when it is full.
- After these edits: both sections rebuild with no blocking problems, every source line still carries a comment, and `tools/check.py` passes every slide of 6.8 (20/20) and 6.11 (18/18) at 1280×720 and 390×844 with `--fuzz --tabs --text-spill`, plus `--min-text 9` on the phone.
