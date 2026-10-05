# Chapters 6–9 HTML review

Reviewed 2026-10-04. Review only; the delivered HTML, PDF and implementation sources were not changed.

The guide has substantial worked examples, useful distinctions between teaching models and real implementations, and unusually thorough model checks. The tested scheduling and page-replacement results hold up. Prioritize the playback and resize problems, then correct the definitions and platform qualifications below.

**Verification limit:** local Chrome failed to launch, the fallback Playwright browser was absent, and the connected-browser tool was unavailable under the session's approval policy. Functional findings below were verified by executing the actual source with deterministic timers or minimal DOM stubs, not by a live browser walkthrough. Geometry, keyboard focus and visual readability at the requested viewports remain unverified. Platform corrections were checked against primary documentation online.

## Fix first

### 1. Pause and resume can double the Binder simulation's playback rate

**Reproduction / computation:** in `6.11/5`, call Widget and Maps, press Run, quickly Pause, then Run again before the original 400 ms startup delay expires. Executing the shipped controller with Run at wall time 0 ms, Pause at 100 ms and Run at 200 ms produced ticks at 400 and 600 ms. At 650 ms the displayed model clock would therefore be 200 ms; a single resumed playback chain should have advanced it only to 100 ms. Both chains can continue scheduling subsequent ticks.

**Cause:** [run and pause](src/sections/6.11.js:716) share the same generation. Pause only clears `running`; resuming makes the old callback's guard true again. Reset does increment the generation, and the same computation confirmed that Reset cancels these old actions correctly.

**Recommendation:** invalidate the current generation on Pause and start each Run with a fresh generation, or cancel the pending timeout explicitly. Verify rapid Run–Pause–Run, Next tick–Run and Reset during playback, asserting that only one playback chain survives.

### 2. Crossing the responsive breakpoint discards the scheduler lab's work

**Reproduction / computation:** open `9.2/7`, change A's service time from 3 to 12, then change between desktop and phone layout. Executing the actual lesson render and input handler preserved the edit within that render, but rebuilding it in phone mode restored A to 3. Separately executing the shell's breakpoint handler confirmed that it calls `go(current, {keepFocus: true})`, which destroys the current context and renders the lesson again. This is a reset of the exercise, not just a change in its layout.

**Cause:** [resize handling](src/shell/shell.js:498) rebuilds layout-aware sections; [navigation](src/shell/shell.js:429) destroys their contexts. The scheduler's [workload and settings](src/sections/9.2.js:897) live only inside `render()`, so the new render initializes the standard workload, FCFS and the initial player position. Build-time layout metadata includes this section.

**Recommendation:** retain the workload, selected policy, quantum, tab and player position separately from DOM construction. Rebuild or reflow the view from that retained state. Check both 1280 × 720 → 390 × 844 and the reverse with an edited, partly played simulation. Audit other labs using the same rebuild path; quiz persistence does not protect their local state.

## Correct the teaching examples

### 3. An unsafe state can already be deadlocked

**Computation:** take two resource types with one unit each. P1 holds `(1,0)` and requests `(0,1)`; P2 holds `(0,1)` and requests `(1,0)`. Both have maximum claim `(1,1)`. Available is `(0,0)`, neither need fits, and the guide's own `safety()` returns `safe: false` with both processes remaining. The outstanding requests also make this a deadlock.

**Cause:** the [unsafe-state glossary entry](src/sections/6.3.js:125) says it is “not yet a deadlock”; the [recap](src/sections/6.3.js:941) says “Unsafe is not deadlocked.” Those statements exclude the counterexample and contradict the correctly keyed [question saying every deadlocked state is unsafe](src/sections/6.3.js:964).

**Recommendation:** use “An unsafe state is **not necessarily** deadlocked: it may already be deadlocked, or it may still finish.” Keep the distinction between the absence of a guaranteed safe sequence and actual blocked requests. The quiz's subset relationship is correct.

### 4. Standard Linux signals are not inherently unable to carry data

**Verification:** the [standard-signal definition](src/sections/6.8.js:637) says it carries no data, and the [notes comparison](src/sections/6.8.js:1325) labels its data field “None.” Linux permits a value sent with `sigqueue()` to be read through `siginfo_t.si_value` by an `SA_SIGINFO` handler. Standard signals still coalesce; when another instance is already pending, its original signal information is retained. This is documented by [sigqueue(3)](https://man7.org/linux/man-pages/man3/sigqueue.3.html) and [signal(7)](https://man7.org/linux/man-pages/man7/signal.7.html).

**Cause:** the comparison combines the properties of standard signals with those of the simpler `kill()` sending interface.

**Recommendation:** distinguish payload capability from reliable queuing. Say that the ordinary `kill()` examples carry no application payload, while `sigqueue()` can attach one even to a standard signal; real-time signals additionally preserve multiple successfully queued instances and their ordering. Keep the existing blocked-SIGUSR1 coalescing answer.

### 5. Scope Linux spinlock answers to a non-PREEMPT_RT kernel

**Verification:** the [quiz sorting exercise](src/sections/6.8.js:1305) unconditionally places contended `spin_lock`, `write_lock` and `spin_lock_irqsave` calls in the spinning group. The [notes](src/sections/6.8.js:1345) likewise describe `spinlock_t` as spinning, and the [variant table](src/sections/6.8.js:1353) says `_irqsave` disables interrupts. On PREEMPT_RT, `spinlock_t` uses an rt-mutex-based implementation, does not disable preemption, and its hard-interrupt suffixes do not change the CPU's interrupt-disabled state. `rwlock_t` changes too. Verified against the kernel's [lock-type documentation](https://www.kernel.org/doc/html/latest/locking/locktypes.html).

**Cause:** the guide presents conventional non-RT behavior as the behavior of Linux generally. Its historical queued-reader/writer-lock qualification does not cover this configuration difference.

**Recommendation:** label these simulations, quiz questions and API tables “non-PREEMPT_RT Linux.” Add a short note distinguishing `raw_spinlock_t`, which remains a strict spinning lock, from the RT implementation of `spinlock_t`. The existing teaching trace can stay with its scope made explicit.

### 6. Distinguish Android hot and warm starts, and remove the promise of instant return

**Reproduction / computation:** in the `8.6/5` model, open Chat, Maps, then Chat. Executing `lmkOpen()` yields `kind: 'warm'`, `from: 'cached'`, `need: 0`, with “nothing to load.” The [display narration](src/sections/8.6.js:662) calls this “a warm start, back instantly.” The [glossary](src/sections/8.6.js:128) and [notes](src/sections/8.6.js:991) repeat the classification.

**Cause:** [the model](src/sections/8.6.js:64) classifies all surviving processes as warm starts without representing whether their activities still exist. Android distinguishes bringing an existing activity to the foreground (hot) from cases that recreate an activity (warm). Even a hot start can require rebuilding trimmed objects and rendering; see [Android's startup documentation](https://developer.android.com/topic/performance/issues/launch-time).

**Recommendation:** either add activity state and teach hot/warm/cold explicitly, or label this simplified distinction “reuse an existing process” versus “create a new process.” Replace “instantly” with “usually faster; may rebuild caches or UI.” Process survival alone does not determine startup work.

## Smaller improvements

### 7. Darken Chapter 7's light-theme badge background

**Computation:** the selected Chapter 7 button and section-number pills use white text on `#059669`. The WCAG relative-luminance calculation gives **3.768:1**. Their 13 px and 12.5 px text is below the large-text threshold, so it needs **4.5:1**. This color problem applies at both requested viewport sizes. The corresponding dark-theme pair, `#0b0f1a` on `#34d399`, computes to **9.953:1** and passes this check. See [WCAG contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).

**Cause:** the [Chapter 7 color](src/shell/shell.css:45) is used as a solid fill by the [selected toolbar button](src/shell/shell.css:131) and [section badge](src/shell/shell.css:154), both with small white text in light mode.

**Recommendation:** use a darker green for these light-theme fills, or a sufficiently dark foreground. For example, white on `#047857` computes to **5.484:1**. Recheck other uses before changing the shared chapter color globally.

### 8. Give recap cards distinct accessible names and an exposed state

**Computation:** executing the shared flip-card builder with “Safe vs unsafe” and “The safety test” produces two controls whose `aria-label` is identically “Flip card.” The real recap in `6.3/9` uses this builder. Its labels do not include the prompt, and activation only toggles a CSS class; no accessible state indicates whether the answer is showing.

**Cause:** [the shared flip-card helper](src/shell/shell.js:901) hardcodes that label on every `role="button"` container. Both faces remain in the DOM and are switched visually.

**Recommendation:** name each control from its question, expose whether the answer is revealed, and hide the inactive face from assistive technology. A native button controlling a separately identified answer region would make this simpler. Confirm the result with keyboard and screen-reader testing; the computation here checks constructed attributes, not an actual accessibility tree.

## Verification

- Read the earlier reviews, shared shell/build logic, chapter metadata and section sources; inspected all 25 section registrations and section quiz data, with deeper checks of the algorithms and examples discussed above.
- Ran `node src/build.mjs --book 6-9 --check`: 25 sections, 300 section-quiz questions, no blocking validation problems. Used check-only mode to preserve the delivered artifact.
- Compared source text with the delivered HTML: 27 of 28 checked files match exactly (shell JS/CSS, chapter data and 25 sections). Section 6.9 differs only in four references using “volume 1” in the HTML and “Chapter 5” in the source. None of the findings depends on those differences. Regenerate the artifact when implementation fixes are made.
- Executed the actual Binder control logic with a deterministic clock, the scheduler render/input handlers with minimal DOM stubs, the shell resize handler, the flip-card builder and the Android app-opening model. These are computational reproductions, not browser passes.
- Recomputed the banker's running example: available `(2,1,3)`, safe sequence P2 → P4 → P1 → P3; P4's `(1,0,1)` request is granted, P1's `(0,1,0)` request is unsafe. Recomputed the detection example: P1 and P2 remain deadlocked.
- Ran `src/dev/qa-9.2/engine.test.js`: 74 engine checks plus section checks pass, including FCFS, RR, SPN, SRT, HRRN, both feedback variants, fair-share and numeric quiz examples.
- Ran `src/dev/qa-8.2/test.js`: all 273,814 checks pass, including replacement-policy comparisons and the suite's working-set/PFF/VSWS checks. Passing a model suite does not establish every teaching claim independently.
- Ran the dining-philosopher engine audit: the naive strategy and room-of-five case can deadlock; room-of-four, asymmetric acquisition and the monitor have no deadlocked states in the explored models. The only deadlocking all-seat acquisition masks are all-left-first and all-right-first.
- Ran the traditional UNIX trace checks and the existing independent calculation scripts for partitioning, paging, segmentation and Windows memory examples. The paging checks report `ALL OK`; the Windows recomputation and invariant checks report `all ok`; inspected the partitioning/segmentation results against the worked examples.
- Executed volume metadata, storage and glossary code in a Node sandbox: writes use `os-guide-ch6-9-v1`, not the first volume's key; `semaphore` resolves to `prior:5.4`, the local `deadlock` definition wins, and section 7.5 exposes label `7A`. Browser reload, file-origin storage behavior and full quiz persistence remain untested here.
- Checked Linux and Android qualifications against primary documentation and computed the stated light/dark contrast ratios.
- Attempted `python3 -m pytest src/tests/e2e/test_volume2.py -q` with bytecode/cache writes disabled. All eight tests stopped in browser-fixture setup; none reached its assertions. The geometry/fuzz checker was consequently not run. No claims are made about a clean browser console, complete keyboard navigation, clipping, or visual fit at 1280 × 720 or 390 × 844 in either theme.
- The companion PDF was not separately rendered or visually reviewed. This review does not exhaust every possible simulator input, quiz explanation or interaction sequence. Temporary review scripts and logs were removed.
