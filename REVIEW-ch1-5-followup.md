# Chapters 1–5 HTML: follow-up review

Reviewed 2026-09-28 after Claude's changes. This is a review, not an implementation patch. The HTML and implementation sources are unchanged by this review.

The update resolves the major earlier problems: the phone home page now stacks correctly; Home and chapter Continue resume correctly; quiz answers survive navigation, reload, and resizing; Contents entries are keyboard buttons; closed panels are inert; and tab arrow navigation works. Saved quiz scores, a shorter core path, mobile Notes, and a printable-guide button are now present. The earlier content corrections were also checked.

I recommend fixing the six issues below before expanding the material further.

## 1. High priority: Close leaves the page blocked by the backdrop

**Reproduction:** open Contents, Glossary, or Notes and click its Close button. The panel closes, but the dimmed backdrop remains over the page and intercepts further clicks. Clicking the backdrop does not remove it either. Help's Got it button has the same binding problem. Escape recovers, which is not an obvious option for touch users.

**Cause:** [closeAll](src/shell/shell.js:1344) accepts a `keepScrim` flag. Direct `onclick: closeAll` bindings pass the click event as that argument; the event is truthy, so the backdrop is retained. This was missed in the first review and is not necessarily introduced by the latest changes.

**Recommendation:** bind ordinary dismissal actions as `() => closeAll()`, or retain the backdrop only when the argument is strictly `true`. Test the Close button, backdrop, Got it, Escape, and navigation from inside a panel separately, including whether the underlying page is clickable afterward.

## 2. Medium priority: Reset does not cancel pending simulation actions

Two browser-confirmed examples:

- **5.3, step 6:** click Step P1, then immediately Reset. After 560 ms, the old swap callback puts P1 inside the critical section without another user action. [Reset and delayed swap](src/sections/5.3.js:760).
- **5.5, step 3:** click Replay: signal, then wait, then immediately Reset. After 900 ms, W1 appears waiting and the semaphore count becomes −1. [Replay callback](src/sections/5.5.js:438).

**Recommendation:** invalidate pending callbacks when resetting or restarting a replay, using a generation token or cancellation handles. The existing context cleanup handles leaving a slide; Reset needs equivalent protection within the current slide. Add checks that state stays reset after the longest scheduled delay, including repeated replay clicks.

## 3. Medium priority: some diagrams keep the wrong layout after resizing

**Reproduction:** open `1.2/3` on desktop, then resize to 390 × 844. The chip diagram keeps its desktop SVG viewBox, `0 0 640 256`. Revisiting the same slide produces the intended phone viewBox, `0 0 340 256`.

**Cause:** the [resize handler](src/shell/shell.js:495) searches the top-level render function's source text for `narrow`. In this lesson, the responsive decision is inside [chipBuilder](src/sections/1.2.js:61), called indirectly from the render function, so the search misses it. The context also snapshots the layout mode when the slide is created.

**Recommendation:** use an explicit resize callback or responsive metadata for lessons; avoid inferring behavior from function text. Redraw the affected visuals while retaining learning state. Compare resized diagrams against freshly loaded diagrams at the same viewport.

## 4. Medium priority: the instruction lab displays stale program memory

**Reproduction:** in `1.3/7`, load the 3 + 2 preset. Set cell 301 to `2302`, cell 302 to `5941`, and cell 940 to `2941`. Step twice. The STORE overwrites instruction 302 with `2941`, but its row still shows `5941` and the ADD explanation. The next step correctly executes STORE, contradicting the visible program row.

**Cause:** [the display](src/sections/1.3.js:645) decodes the original editable input, while [execution](src/sections/1.3.js:662) reads the current memory map.

**Recommendation:** show the live memory word and decode after every write, including writes to program addresses. Keep the original editable/reset image separately and label it if both are displayed. This matters especially because the simulator explicitly supports and narrates overwriting instructions.

## 5. Medium priority: revise the monolithic-kernel definition

[The glossary](src/sections/2.4.js:16), [lesson text](src/sections/2.4.js:348), and notes describe a monolithic kernel as running as a single process. Monolithic describes services sharing privileged kernel space; it does not require one process. This also conflicts with the later explanation of kernel execution in the caller's process.

Suggested wording: “Most OS services run in kernel mode within a shared kernel address space, so they can call one another directly. Kernel code can execute for different calling processes, kernel threads, and interrupts.” See [Linux's documentation on kernel execution contexts](https://cdn.kernel.org/doc/html/latest/kernel-hacking/locking.html).

## 6. Medium priority: retries inflate the score labeled first try

**Reproduction:** from a completed 11/12 first-try result, select Retry the 1 I missed and answer it correctly. The saved best becomes 12/12, and the chapter badge says “12 of 12 right on the first try.” This behavior was verified with a completed-attempt fixture in the browser, then actual retry controls.

**Cause:** [restart](src/shell/shell.js:1080) resets only the missed questions; [saveBest](src/shell/shell.js:1057) combines their new results with the original correct answers; [the badge](src/shell/shell.js:594) labels that cumulative result first try.

**Recommendation:** distinguish eventual mastery from first-attempt performance. Either label the cumulative score as corrected/learned, or preserve the original result for each complete quiz attempt and report the best complete attempt separately.

## Smaller improvements worth making

- **Finish panel focus handling.** From the final Contents button, Tab currently reaches the document body rather than wrapping to the first panel control. Test both last-to-first and first-to-last focus movement. The existing test's fixed 50 Tabs stops before this boundary.
- **Make the core route easier to discover.** On phones, the route selector appears below all five chapter cards. Put it beside or above Start/Continue so learners can choose their route before beginning.
- **Show route-specific progress.** Completing the core route currently reports about 53% of all steps visited. That is mathematically correct but does not show that the chosen route is complete. Display core progress separately from full-course coverage.
- **Make quiz tests verify correctness as well as persistence.** [answer_first_question_correctly](src/tests/e2e/test_behaviors.py:59) tries options sequentially and stops when a green answer appears, including when the answer is revealed after failure. Select the actual correct option from the question data and assert the first-try score/result, not only the answered count. Keep separate wrong-answer and second-attempt cases.

## Correction to the first review

My earlier recommendation to reject `CLONE_PARENT | CLONE_NEWPID` unconditionally was incorrect for newer Linux kernels. I relied on an outdated statement in the clone manual. The [Linux 3.12 implementation](https://github.com/torvalds/linux/blob/v3.12/kernel/fork.c) rejects the combination, while the [Linux 3.13 implementation](https://github.com/torvalds/linux/blob/v3.13/kernel/fork.c) removes CLONE_PARENT from that check. Claude's updated version note is correct; keep it. I corrected the original review file as well.

The redesigned 2.6 scheduling comparison also checks out: both modes now run all 12 threads for eight slices each; the displayed modeled switch/cold-start counts match the scheduler. The earlier fork-buffering, PC-increment, cache-maintenance, kernel-preemption, shared-data, memory-visibility, and readers/writers wording issues are addressed.

## Verification

- All 43 implementation source files checked are embedded exactly in the delivered HTML; this review did not accidentally test a stale build.
- Build validation passes for all 40 sections.
- All 17 existing end-to-end behavior tests pass.
- Desktop, phone, and small-phone screenshots were inspected, including the returning-user home page and core-route quiz controls.
- The backdrop, resize, and delayed-reset issues were reproduced against the delivered HTML; the instruction-display issue was also reproduced in browser review.
- Full rendering sweep: all 415 screens tested at 1280 × 720 and 390 × 844; all 830 automated checks pass. These results cover the checker's rendering/geometry assertions, not the action-sequence and teaching issues described above.
- This is not an exhaustive audit of every possible simulator input or interaction sequence. The PDF was not separately reviewed in this pass.
