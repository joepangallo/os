# Chapters 10–13 HTML: third follow-up review

Reviewed 2026-10-12. Review only; implementation sources and delivered pages were left unchanged.

Second-follow-up new findings **1, 2 and 4 are Fixed; 3 is Partly fixed**. Original findings **3 and 7 remain Partly fixed**. Distinct edits, SVG activation, keyboard recap flips, Apply-plus-draft restoration and the self-restoring reveal now pass the targeted reproductions. Overflow avoids stale-prefix replay but still loses current work. One new confirmed problem remains in the changed cache lab: submitting with Enter loses the applied workload on relayout.

**Verification limit:** checks below execute the actual current shell, section renders and handlers in JSDOM, using capture-phase click/keydown/input/change listeners and retained `ctx.keep`. They reconstruct desktop → phone → desktop; they do not exercise browser layout, native keyboard synthesis or visual animation. I did not run Chrome or independently reproduce the supplied full sweep, phone, dark, reset, resize, end-to-end or earlier-volume browser counts. No new browser-launch failure is claimed. Accepted residuals are excluded from the findings below.

## Second-follow-up new findings

### 1. Consecutive-edit compression changes dependent state — Fixed

Reran `10.2/5`: A period **50**, A needs **30**, A period **20**, A period **50**. Sliders read **[20, 50, 25, 50]** before relayout, on phone and on return to desktop.

The actual log retains all four edits in that order. Each edit was followed by both input and change events; these produced four entries, not eight. [The equality check](src/shell/shell.js:509) drops identical repeats while [the append](src/shell/shell.js:510) preserves the intermediate period-20 callback. Replay did not grow the log. The original shorter period-50 / demand-30 reproduction also passes both directions.

### 2. SVG-button replay throws and aborts restoration — Fixed

Reran `12.9/4`, activating **Dentry object** through a bubbling click event. The SVG target has no `.click()` method in JSDOM. Selection remains **Dentry object** and the detail contains **d_inode** before relayout, on phone and back on desktop. The log stays at one entry, `Dentry object#0`, with no restoration error.

[Activation now dispatches a MouseEvent when needed](src/shell/shell.js:531). Also verified [per-action error isolation](src/shell/shell.js:533) with a controlled fault: an earlier VFS-file-object activation was made to throw during replay, followed by the real Dentry selection. Exactly the injected error was reported and Dentry was still selected. This fault injection tests isolation; it is not a naturally occurring product defect.

### 3. Action-limit truncation silently reverts later work — Partly fixed

The exact **600 runs → Reset** reproduction on `1.3/7` now passes: address 941 is **0002 → 0002 → 0002**, with 601 log entries. **3000 runs → Reset** also preserves 0002 because the overflow fallback happens to match the reset state. The stale prefix is no longer replayed.

However, **3001 runs without Reset** gives **0005 → 0002 → 0002**. The log has 3000 entries and `__overflow` is true. After that round trip, Run to the end produces 0005 again, but the next round trip again restores 0002. [Overflow remains set](src/shell/shell.js:496), and [restoration skips the entire log](src/shell/shell.js:532). This prevents stale-prefix replay, but does not retain current or subsequent work during the same visit.

There is also a confirmed boundary detail: after exactly 3000 runs, `__overflow` is initially absent. Dispatching **Tab keydown on a memory input** sets it, despite Tab not being a recordable action. [The cap check](src/shell/shell.js:497) precedes event eligibility and duplicate filtering. Thus an ignored event can invalidate a complete log at the boundary; another distinct action is not required.

**Recommendation:** retain a checkpoint/current model at the cap, or otherwise preserve subsequent work. Apply the limit only after deciding that an event needs a new entry. Raising the limit and refusing stale replay address part of the finding, but do not establish state preservation.

### 4. Keyboard-flipped recap cards are lost — Fixed

Reran `10.3/8` separately with **Enter** and **Space** on the first recap card. Both give `aria-pressed` **true → true → true**. Each log contains exactly one flip action after both reconstructions.

The [keydown capture listener](src/shell/shell.js:661) now records these direct keyboard activations. A controlled same-element key handler that additionally fires `.click()` confirmed that [the de-duplication guard](src/shell/shell.js:503) keeps one log entry. Native browser key/click timing was not tested; the executed check covers a synchronous click fired by the handler.

## Original findings requested for recheck

### 3. Responsive relayout loses exercise state — Partly fixed

Confirmed with actual section code in both directions:

- `10.3/5`: nice values **−10 and 5** survive.
- `10.2/5`: both the original **30/50** sequence and the longer clamp sequence above survive.
- `13.3/3`: **Python 3 enabled**, **33.20 MB** survive.
- `11.10/8`: **snapshot taken** survives.
- `11.7/6`: apply **1 2 1 3 1** with **Apply**, then type the unapplied draft **7 8 9**. All three views retain the draft and **5 requests, 3 blocks**. The control changes INPUT → TEXTAREA → INPUT; [the shared TEXT identity](src/shell/shell.js:477) matches it, and the log contains edit → Apply → draft edit.
- `10.1/6`: open **Show the answer**. The reveal stays open in all three views while the actual keep store retains `gP`, `gA`, `gB` and `gW`. [Snapshot restoration](src/shell/shell.js:543) fixes this self-restoring step. A separate controlled check using the real recap renderer plus an explicitly supplied own-state key also exercised the flip-snapshot branch successfully; it is not claimed as another naturally self-restoring section.

Two remaining issues prevent a Fixed verdict. First, Enter submission in `11.7/6` loses its applied workload, as detailed below. Second, the previously reported **crash slider** on `11.10/3` remains **20 → 5 → 20**. This is the slider case, distinct from the accepted lazy-write-cell-label residual. Its [maximum depends on the layout's column count](src/sections/11.10.js:454), and [control identity includes that maximum](src/shell/shell.js:477), so the phone control is not found for replay. Preserve the selected failure time in a layout-independent model and map it to the displayed grid.

### 7. Shared-engine changes affect earlier rebuilt volumes — Partly fixed

The ordinary `1.3/7` machine reproduction still passes with the current shared shell: Run gives **0005**, phone keeps **0005**, Reset gives **0002**, another Run gives **0005**, and desktop keeps **0005**. The log contains only Run, Reset, Run; machine-written memory values are not recorded as user edits. The earlier 600-entry failure is fixed, but the new-limit reproduction above still confirms state loss in this earlier-volume section when used with the current shell.

Both delivered earlier HTML pages are **byte-for-byte equal to HEAD**. The action recorder/replayer, [player focus transfer](src/shell/shell.js:1086) and [flip-card paint containment](src/shell/shell.css:433) remain shared changes for rebuilt volumes. Shared scope alone is not a new bug, and unchanged delivered pages do not acquire the current source's overflow behavior retroactively. All three check-only builds pass. Complete earlier-volume compatibility, including the supplied 49 browser tests, was not independently verified.

## New confirmed finding

### 1. Medium priority: Enter-applied cache workload disappears on relayout

**Reproduction / computation:** on `11.7/6`, type **1 2 1 3 1**, press **Enter** in the reference-string box, then type **7 8 9** without applying it. Before relayout the lab reports **5 requests, 3 blocks**, with draft **7 8 9**. Phone reconstruction preserves the draft but changes the applied workload to **22 requests, 5 blocks**, the default Burst preset. Returning to desktop still shows that default applied workload. This executes the section's actual key handler and current shell recorder; the Apply-button version of the same sequence passes.

**Cause:** [the input's Enter handler](src/sections/11.7.js:715) calls `apply()` directly. The shell [records keydown only on button-like targets](src/shell/shell.js:499), so the log contains the two text edits and no apply action. With the lab's own saved state removed, rebuilding [initializes the Burst preset](src/sections/11.7.js:785), and replaying text edits never invokes `apply()`. Matching INPUT to TEXTAREA preserves the draft but cannot reconstruct the missing submission.

**Recommendation:** route Enter through the same recorded Apply activation, or explicitly retain the applied model separately from the draft. Add the Enter-plus-draft sequence to the relayout checks in both directions.

## Action-log audit and verification

- Read `REVIEW-ch10-13-followup-2.md` first, then the original findings and current shell, cache lab, probe and supplied reproduction scripts. No committed second-follow-up source snapshot was available for exact historical attribution of every change; findings describe confirmed current behavior.
- Reused the prior temporary JSDOM harness, adding the current keydown capture listener. It evaluates current source, exposes shell helpers in memory, uses the real context and destroys contexts before reconstruction. Additional harness files stayed outside the repository. Controlled fault/own-state/de-duplication checks are identified above rather than presented as natural user reproductions.
- Confirmed the current shell and `11.7.js` source match their embedded content in the delivered volume-3 HTML. Earlier-volume source tests deliberately use the current shared shell, as a rebuild would.
- Ran `node src/build.mjs --book <book> --check` for **1–5, 6–9 and 10–13**: all report **No blocking problems**. No delivered artifact was rebuilt.
- Inspected `state_probe.py`: [coverage counters](src/tools/state_probe.py:87) and [the final coverage/scope message](src/tools/state_probe.py:121) are present. This was source inspection, not an independently executed browser sweep. No new confirmed probe defect is claimed.
- Visual fit, scrolling, themes, native focus and keyboard behavior, live timing, browser replay latency and exhaustive earlier-volume compatibility remain unverified. The PDF was not reviewed. Only this report was added to the repository.
