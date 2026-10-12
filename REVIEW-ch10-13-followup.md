# Chapters 10–13 HTML: follow-up review

Reviewed 2026-10-12 after the fixes. Review only; implementation sources and delivered pages were not changed.

Six original findings are fixed within the scope below. Finding 3 is partly fixed: the CFS calculator and applied cache workload survive, but several meaningful lab states still disappear. Finding 7 is partly fixed: the earlier delivered pages are unchanged, but the new shared replay introduces a confirmed regression when volume 1 is rebuilt. Four newly confirmed problems are detailed after the original findings; these distinguish new regressions from previously unreported limitations.

**Verification limit:** the browser state probe failed during launch: installed Chrome did not launch successfully, and the fallback Playwright Chromium executable was absent. Functional results below execute actual JavaScript with a minimal DOM implementation, not a browser. They do not establish geometry, CSS rendering, native focus behavior, screen-reader output, or browser event timing. The reported earlier 49-test passing run could not be independently verified here.

## Original findings

### 1. Nonblocking I/O confused with asynchronous completion — Fixed

The [glossary](src/sections/11.2.js:159), [selector](src/sections/11.2.js:297), [recap](src/sections/11.2.js:701), [pipe quiz](src/sections/11.2.js:720), and [notes](src/sections/11.2.js:778) now distinguish asynchronous submission from an ordinary nonblocking read. The interrupt-driven and DMA branches are labelled **Asynchronous request**.

Executed `11.2/2` with the actual shared switches/player. Selecting Interrupt-driven → Asynchronous request starts with submission and immediate return to P1; the final frame says P1 checks completion and uses the data. DMA gives the corresponding one-interrupt trace. Repeated the local pipe experiment: an empty nonblocking pipe with its writer open returns **EAGAIN**; after writing `x`, a new read returns `b'x'`. The revised false-answer quiz agrees with that execution.

This resolves the original mislabelling. A separate inconsistency when the selector is combined with programmed I/O remains; see new finding 3.

### 2. Spanned records incorrectly limited to two block reads — Fixed

Executed the actual `pack([1200], 512, 'spanned')`: **three blocks**, containing **512, 512, 176 bytes**, with `maxParts === 3`. The [quiz](src/sections/12.6.js:729) now keys one block read per block touched, and its explanation allows more than two. The [callout](src/sections/12.6.js:455) and [comparison table](src/sections/12.6.js:818) are aligned.

The [notes](src/sections/12.6.js:791) explicitly assume uncached blocks, give `ceil((o + R) / B)`, and distinguish block accesses from merged device requests. Their examples recompute to three blocks at offset 0 and four at offset 400 for a 1,200-byte record in 512-byte blocks. The remaining two-block wording in the worked trace is scoped to its actual two-block records.

### 3. Responsive relayout loses exercise state — Partly fixed

Executed the actual renders together with the new [capture/replay functions](src/shell/shell.js:475), shared control helpers and retained context data. The original `10.3/5` reproduction now passes: setting X to **−10** leaves slider values **[−10, 5]** after desktop → phone → desktop, with the calculation redrawn from those values.

In `11.7/6`, applied **1 2 1 3 1**, advanced to player index **3**, and reconstructed in phone mode. Both the reference string and frame survived. The [applied-workload store](src/sections/11.7.js:743) and [initialization from it](src/sections/11.7.js:783) are effective; `UI.player` really exposes [its API on the element](src/shell/shell.js:1054).

The finding remains open beyond those examples. Confirmed losses include:

- **11.7/6, unapplied text:** after applying the string above, typed **7 8 9** in the phone textarea without Apply. Returning to desktop restored **1 2 1 3 1**. The [input changes element type](src/sections/11.7.js:709), and replay requires an identical tag/type/range; only applied text is in `ctx.keep`.
- **11.10/3, lazy-write workload:** Clear → click the first B cell produced one B write at **0.03 s**. Phone reconstruction discarded it and restored the ten default Autosave writes to A. Separately, setting the crash slider to **20 / 2.59 s** became **5 / 1.44 s** on phone. [Writes remain a local Set](src/sections/11.10.js:428), and [the slider range](src/sections/11.10.js:454) changes from 0–23 to 0–11, so its captured kind does not match.
- **13.3/3, firmware configuration:** enabling **Python 3** raised the image to **33.20 MB**. Phone reconstruction turned it off and returned the size to **18.20 MB**. These [feature buttons](src/sections/13.3.js:447) have `aria-pressed`, but are neither `.seg` switches nor captured form controls.
- **11.10/8, shadow-copy experiment:** Take snapshot → phone reconstruction changed **snapshot taken** to **no snapshot yet**. The [snapshot action](src/sections/11.10.js:868) changes local model state that the shell does not capture.

Thus the probe's reported two steps are not an exhaustive inventory. The firmware and shadow-copy cases were confirmed independently. New finding 2 also shows a standard-control case where replay itself changes a valid setting.

### 4. VSS copy-on-write claims lack provider scope — Fixed

The [glossary](src/sections/11.10.js:193) defines the point-in-time view first. The [lesson and failure warning](src/sections/11.10.js:874), [recap](src/sections/11.10.js:931), [quiz](src/sections/11.10.js:969), and [notes](src/sections/11.10.js:1016) now scope the demonstrated mechanism to the built-in system provider and distinguish complete-copy providers. The question no longer demands a universal copy-on-write assumption.

Rechecked against [Microsoft's VSS documentation](https://learn.microsoft.com/en-us/windows-server/storage/file-server/volume-shadow-copy-service), which identifies the system provider's copy-on-write implementation and alternative provider mechanisms. The snapshot's relayout loss is a separate interaction defect under finding 3, not a failure of this wording fix.

### 5. Embedded Linux excludes glibc and requires BusyBox — Fixed

The [comparison table](src/sections/13.3.js:284), [recap](src/sections/13.3.js:939), [section notes](src/sections/13.3.js:1003), and [chapter notes](src/chapters-10-13.js:1218) now describe smaller libraries and BusyBox as common configuration choices and explicitly allow glibc. This agrees with the firmware lab's glibc option and the choices documented for [Yocto's TCLIBC](https://docs.yoctoproject.org/ref-manual/variables.html#term-TCLIBC).

Executed the firmware render: glibc remains selectable; the default image is **18.20 MB**, and disabling USB gives **17.70 MB**. These are calculations in the teaching model, not measurements of a built firmware image.

### 6. Fixed-block guarantees applied to variable-size partitions — Fixed

The [rewritten notes](src/sections/13.2.js:885) separate fixed-size pools from variable-size allocation, explain internal waste, and include the counterexample: two separated 32-byte gaps cannot hold one 48-byte request despite 64 bytes free. The following sentence distinguishes a fixed operation count from identical elapsed time.

The fixed-block explanation agrees with [Zephyr's memory-slab documentation](https://docs.zephyrproject.org/latest/kernel/memory_management/slabs.html). This verifies the original notes correction; it is not an allocator benchmark or a claim that every timing phrase elsewhere in the section has been revised.

### 7. Shared-engine changes affect earlier rebuilt volumes — Partly fixed

Verified that both delivered earlier HTML files are **byte-for-byte equal to HEAD**. The current [paint containment](src/shell/shell.css:433), narrow quiz layout rules and [player focus transfer](src/shell/shell.js:1032) remain shared changes. They are not retroactively inserted into those standalone delivered pages.

The earlier-volume test files collect **49 tests**. I did not reproduce their reported passing run or the temporary rebuild/restoration history. Their programming-lab test checks live memory and Reset, but [does not resize between them](src/tests/e2e/test_behaviors.py:515). The new replay breaks precisely that sequence on rebuild: see new finding 1.

Positive targeted checks with the current engine: `6.11/5` retains its **100 ms** clock, four call records, two active threads and queued Watch/Clock calls across reconstruction. `9.2/7` retains A's **12-unit** service, **RR**, **q = 3**, and player index **2** in both directions. These checks do not establish compatibility for all earlier lessons. Paint containment was verified in source and the volume-3 artifact, not visually.

### 8. Windows byte-range locks need a mapped-view exception — Fixed

Both the [real-system callout](src/sections/12.5.js:630) and [notes](src/sections/12.5.js:862) now limit enforcement to conflicting ordinary file reads/writes and explicitly exclude mapped views. The notes say mapped access needs separate coordination.

Rechecked [Microsoft's LockFileEx contract](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-lockfileex), which expressly excludes reads/writes through mapped views. No Windows runtime experiment was performed.

## New confirmed findings

### 1. Medium priority: replay turns live machine output into original program data

**Reproduction / computation:** execute `1.3/7` using its actual render and the current shared shell helpers. Run the default **3 + 2** program to completion: address **941 = 0005**. Capture controls, reconstruct for phone, and run the actual restoration. Reset now leaves address **941 = 0005**, instead of the original **0002**. Run to the end again: address **941 = 0008**. The relayout has silently changed the program's input data from 3 + 2 to 3 + 5.

**Cause:** [replay dispatches input/change events](src/shell/shell.js:496) for differing text-box values. These boxes display **live memory**, while their [input handler](src/sections/1.3.js:632) treats typing as an edit to the original `src` image and resets the machine. A display snapshot is therefore not a safe input-state snapshot. The [build marks the entire section layout-aware](src/build.mjs:191), so this step is reconstructed even though its own render need not read `ctx.narrow`.

This is a regression introduced by the shared replay, affecting volume 1 **when rebuilt**. A fresh render without replay restores the original example; replay corrupts its reset image. The committed volume-1 page remains unchanged.

**Recommendation:** let stateful labs opt out of event replay and restore an explicit model containing the original program image separately from live memory/registers. Add the resize between execution and Reset to the existing programming-lab regression test.

### 2. Medium priority: replay order clamps a valid periodic-task workload

**Reproduction / computation:** in actual `10.2/5`, set **A period = 50**, then **A needs = 30**. Before relayout the four sliders read **[30, 50, 25, 50]**. Capture → phone render → restore produces **[20, 50, 25, 50]**. A valid 30/50 task has become a 20/50 task, changing the scheduling calculation.

**Cause:** [controls replay in DOM order](src/shell/shell.js:493), so demand is restored before period. The fresh period is 20. The [demand callback](src/sections/10.2.js:640) clamps 30 to that temporary 20; restoring period 50 afterward cannot recover the discarded demand. Matching control types and ranges is insufficient when their callbacks have dependencies.

This is a newly confirmed limitation of the repair for original finding 3, rather than evidence that the old shell preserved this workload.

**Recommendation:** restore the task model atomically, then render/validate it once. Do not rely on arbitrary form order to recreate a sequence of dependent edits. Test high demand after increasing a period, not only values below the default period.

### 3. Low priority: the asynchronous selector can still show a fully synchronous trace

**Reproduction / computation:** in actual `11.2/2`, leave **Programmed I/O** selected and click **Asynchronous request**. Executing every player frame still shows P1 calling `read()`, spinning through both device waits, and `read()` returning only in the final frame. P2 never runs. This contradicts the selected request label and the nearby explanation that an asynchronous requester runs on and is notified later.

**Cause:** [the frame selector](src/sections/11.2.js:253) always chooses the same `pio` trace, regardless of the blocking/asynchronous switch. Renaming the switch fixes the interrupt/DMA examples but leaves this selectable combination inconsistent. This is a newly confirmed remaining model/UI inconsistency, not a claim that polling cannot be used internally by an asynchronous implementation.

**Recommendation:** disable or qualify the asynchronous choice for this particular polling example, or model a background worker doing the polling after submission returns. Keep the selected mode, narration and process states consistent.

### 4. Low priority: the state probe cannot detect the firmware loss it is meant to audit

**Reproduction / computation:** executed the probe's actual `SIG_JS` before and after the confirmed `13.3/3` Python-toggle loss. Both signatures are **`{"vals":[],"tabs":[],"players":[]}`**, although the image changes from **33.20 MB** to **18.20 MB**. Its edit script also has no applicable action on this slide, so the full loop skips it instead of assessing the feature controls.

**Cause:** [EDIT_JS](src/tools/state_probe.py:21) exercises sliders, selects, text/number inputs, tabs and player Next, but not segmented switches, standalone toggle buttons or lab grid actions. [SIG_JS](src/tools/state_probe.py:47) likewise omits those states and even omits textarea values. It measures a subset of controls, not retained exercise state; the desktop-input/phone-textarea change also changes signature shape even if the text were preserved.

**Recommendation:** report unexercised interactive steps separately and add semantic, lab-specific assertions for firmware options, lazy-write cells and snapshot contents. Include equivalent input/textarea values and dependent-control sequences. A small reported loss count must not be presented as the complete remaining-state inventory.

## Verification

- Read both requested reports first. Inspected all requested changed section files, chapter 13 notes, shared shell/CSS, build embedding/layout metadata, `check.py`, `state_probe.py`, and relevant earlier-volume control handlers/tests.
- Compared the volume-3 page with the complete shell JS/CSS, chapter data and 31 section sources: **34/34 exact embedded matches**, allowing closing-script escaping. Consequently, the volume-3 source executions above use the same implementation as the delivered page. Earlier-volume regression executions combine their current section source with the current shared engine, as a rebuild would.
- Ran check-only builds for **1–5, 6–9 and 10–13**: no blocking problems. Volume 3 registers **31 sections and 372 section-quiz questions**. No build output was written.
- Executed actual render functions and shared sliders, switches, tabs, players, capture and restore functions with minimal DOM stubs. Tested CFS, cache strings/frame, lazy-write cells/crash time, firmware toggles, shadow-copy creation, Binder state, scheduler state, periodic-task dependencies and the volume-1 machine reproduction. In-memory instrumentation exposed internal helpers without editing sources.
- Executed the actual `go()` body with controlled navigation dependencies: same-slide relayout captured/restored and retained `keep`; relayout to a different slide did neither and created a fresh store; ordinary navigation also did not replay. No cross-slide carry-over was found in these cases.
- Constructed an actual numeric quiz through the shared quiz helper. Capture excluded its input; restoration dispatched **zero** input/change events to it and left its changed value alone. This checks exclusion, not complete browser quiz persistence. The `.quiz`/`.qwrap` filter is present for the standard quiz containers.
- Executed the record-packing engine and the local nonblocking pipe experiment. Rechecked VSS, glibc choices, fixed-size slabs and mapped-view locks against the primary documentation linked above. No live Windows, firmware or allocator experiments were performed.
- Executed `check.py`'s storage-key extractor on all three artifacts; it returns each volume's correct key plus the default key. Inspected its new intermediate-overflow probing, but did not execute geometry/fuzz checks because no browser launched. No additional confirmed `check.py` or CSS defect is claimed.
- Attempted `PYTHONDONTWRITEBYTECODE=1 python3 src/tools/state_probe.py operating-systems-ch10-13.html --section 10.3`; it failed in browser setup before visiting a slide. Collected the earlier-volume suites with bytecode/cache writes disabled: **49 tests**, not 49 executed passes. Existing screenshots and reported passes were not treated as this review's browser evidence.
- This was not an exhaustive interaction audit. Native range sanitization, rendered clipping, flip animation appearance, focus, both themes, phone scrolling and accessibility output remain unverified. The PDF was not reviewed. Only this report was created; review scripts ran from standard input without creating repository files.
