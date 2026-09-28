# Chapters 1–5 HTML review

Reviewed 2026-09-27. Recommendations only; the HTML and its implementation sources were not changed.

Follow-up on 2026-09-28: many findings below have now been fixed. See [the follow-up review](REVIEW-ch1-5-followup.md) for current recommendations. The original clone-flag recommendation was incorrect for newer Linux kernels and is corrected below.

The desktop presentation, semantic colors, worked examples, step-through simulations, glossary, and varied self-check questions provide a strong foundation. Keep that structure. Prioritize the functional and teaching issues below before adding more material.

## Fix first

### 1. Reflow the mobile home page

At 390 × 844, the Start button extends beyond the visible canvas, the hero text occupies a narrow column, and all five chapter cards remain in one row. Each chapter card has only 57 pixels of usable width and clips its title and contents.

Stack the hero and Start button vertically in narrow mode, reduce the mobile heading size, and use one column for the chapter cards. Also make Section notes available through a touch-accessible menu; its toolbar button is currently hidden in narrow mode.

Sources: [home layout](src/shell/shell.js:534), [chapter card grid](src/shell/shell.css:499), [narrow-mode rules](src/shell/shell.css:160).

### 2. Make Continue resume the learner's location

Reproduced: navigate to `3.2/5`, then select Home. The stored last location becomes `home`, and the primary action offers Start with Chapter 1. `go()` overwrites the last location before Home reads it. Chapter-level Continue also always opens that chapter's first step.

Store the last learning slide separately from the currently displayed page, and track the last location within each chapter.

Sources: [navigation](src/shell/shell.js:386), [Home resume calculation](src/shell/shell.js:529), [chapter Continue](src/shell/shell.js:581).

### 3. Preserve quiz attempts across navigation and resizing

Reproduced on `1.1/9`: answer a question, then leave and return, or resize from desktop to phone. The answered count resets to zero. Crossing the responsive breakpoint rebuilds the slide, and quiz state is initialized from scratch. Only aggregate scores are saved.

Retain answers, attempts, current question, and the sampled question IDs for chapter/final challenges. Preserve simulation state when changing layout where practical. A layout change should not discard learning work.

Sources: [resize handler](src/shell/shell.js:438), [quiz state](src/shell/shell.js:880), [saved score](src/shell/shell.js:894).

### 4. Make navigation and exercises work with a keyboard

Contents entries are clickable `div` elements without keyboard interaction. Tab skips them and can reach controls in closed, offscreen drawers. In `2.1/2`, pressing Right while a tab is focused leaves the lesson for `2.1/3` instead of selecting the next tab.

Use native links/buttons for navigation; make inactive drawers hidden or inert; manage focus when opening and closing overlays; implement keyboard selection for tabs; and keep global shortcuts from consuming keys intended for an active widget.

Sources: [Contents entries](src/shell/shell.js:1178), [closed drawers](src/shell/shell.css:193), [tabs](src/shell/shell.js:727), [global shortcuts](src/shell/shell.js:1273).

## Correct the teaching examples

### Dedicated-core comparison changes the workload

[Section 2.6, step 7](src/sections/2.6.js:847) schedules 12 threads in shared mode but only eight in dedicated mode. A3, B3, C3, and D3 disappear. The narration does mention one worker per dedicated core, but it does not explain how the original work is redistributed before comparing switching costs.

Keep the same runnable threads and show scheduling within each process, or explicitly describe different worker configurations and compare the same completed work. Equal process-level core-slices alone do not establish an equivalent workload.

### The fork-output question needs an output-buffering assumption

[Section 3.6's quiz](src/sections/3.6.js:1015) requires six lines for `fork(); printf("A\n"); fork(); printf("B\n");`. Running this with captured stdout produced eight lines: four A and four B. The second fork duplicates the unflushed A buffer.

Add `fflush(stdout)` before the second fork, explicitly assume unbuffered output, or ask how many `printf` calls execute. The [notes](src/sections/3.6.js:1090) also omit newlines while discussing line counts. References: [POSIX fork](https://pubs.opengroup.org/onlinepubs/9799919799/functions/fork.html), [POSIX fflush](https://pubs.opengroup.org/onlinepubs/9699919799.2013edition/functions/fflush.html).

### Withdrawn: the clone-flag recommendation

Correction, 2026-09-28: my original recommendation to reject `CLONE_NEWPID` plus `CLONE_PARENT` unconditionally was wrong for newer Linux kernels. It followed an outdated statement in the clone manual. The [Linux 3.12 source](https://github.com/torvalds/linux/blob/v3.12/kernel/fork.c) includes CLONE_PARENT in the relevant rejection; the [Linux 3.13 source](https://github.com/torvalds/linux/blob/v3.13/kernel/fork.c) removes it. The updated guide's version-qualified explanation is correct. Do not add the originally recommended unconditional rejection.

### Shared code does not imply shared writable globals

[Section 5.2's echo example](src/sections/5.2.js:949), repeated in its notes, says sharing one copy of the routine means its globals are shared. Processes can share code while retaining separate writable globals.

State explicitly that `chin` and `chout` are placed in shared memory, or make the callers threads of the same process. The demonstrated race remains useful with that assumption made explicit. Reference: [Microsoft DLL data documentation](https://learn.microsoft.com/en-us/windows/win32/dlls/dynamic-link-library-data).

### Tighten several simplified statements

| Location | Recommended clarification |
| --- | --- |
| [1.3 quiz](src/sections/1.3.js:836) | Qualify “PC increases by one” as a rule of the word-addressed teaching machine. The notes already explain instruction-length increments. |
| [1.6 cache recap](src/sections/1.6.js:956) | Say hardware normally handles fills and replacement; do not say caches are entirely invisible to the OS. The notes already discuss explicit cache maintenance. |
| [3.6 nonpreemptible kernel](src/sections/3.6.js:1048) | Distinguish involuntary preemption from voluntarily blocking inside kernel code. |
| [4.1 shared memory](src/sections/4.1.js:1170) | Replace “seen at once” with shared address space plus synchronization for reliable visibility and ordering. This also aligns with section 5.1's memory-order discussion. |
| [5.7 readers/writers quiz](src/sections/5.7.js:1052) | A writer may read before modifying data. Describe readers as read-only and writers as requiring exclusive access, or label the narrower roles as exercise assumptions. |

Supporting references: [Linux cache maintenance](https://cdn.kernel.org/doc/html/latest/core-api/cachetlb.html), [Apple synchronization](https://developer.apple.com/library/archive/documentation/Cocoa/Conceptual/Multithreading/ThreadSafety/ThreadSafety.html), [Oracle read/write lock example](https://docs.oracle.com/en/java/javase/24/docs/api/java.base/java/util/concurrent/locks/ReentrantReadWriteLock.html).

## Useful additions after those fixes

- **Show mastery alongside visits.** The interface measures steps visited. Display saved quiz best scores and missed topics so learners can tell what they understand. Scores are already stored but never displayed.
- **Offer a shorter first-pass route.** With 415 screens, a suggested route through the core mechanisms would help a beginner decide where to start; keep the full material accessible.
- **Expose the existing printable guide.** Add a visible Print study guide action for the existing `?print` view. An optional download link can expose the accompanying PDF, while retaining the self-contained HTML's offline behavior.
- **Expand the existing checker around the actual gaps.** Add resume, quiz-resize, keyboard navigation, and narrow-mode clipping checks. Current geometry checks deliberately skip several overflow checks when `Guide.narrow` is true, so a phone page can pass despite visibly clipped content.

## Verification and limits

- Build validation: all 40 sections pass, with 480 section-quiz questions.
- Sampled interaction checks: eight lessons tested in both light and dark mode; all 16 checks pass, including control clicks and supported player walkthroughs.
- Manual browser checks reproduced the mobile home, resume, quiz-state, and keyboard problems described above.
- Desktop screenshots and representative phone/dark screenshots were inspected.
- Full rendering sweep: all 415 screens checked at 1280 × 720 and 390 × 844; all 830 automated checks passed. These checks did not detect the manual findings above, including the mobile clipping gap. Passing this sweep is not equivalent to passing an accessibility or content audit.
- This review covers all section structures and substantial content, with representative simulator and quiz checks. It does not exhaust every possible interaction sequence or certify every question's accuracy. The accompanying PDF was not separately reviewed.
