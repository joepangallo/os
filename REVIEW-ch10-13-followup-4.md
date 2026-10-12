# Chapters 10–13 HTML: fourth follow-up review

Reviewed 2026-10-12. Review only; implementation sources and delivered pages were left unchanged.

**All three requested fixes are confirmed in targeted JSDOM reproductions.** The third follow-up's new Enter-submission finding is **Fixed**, its finding 3 boundary detail is **Fixed**, and the crash-slider restoration failure is **Fixed** under the stated mapping to the visible grid. No new confirmed bug was found in the reviewed changes. Accepted residuals are excluded from findings and are not treated as newly resolved.

**Verification limit:** these checks execute the actual current shell, section renders and handlers in JSDOM, with capture-phase click/keydown/input/change listeners, retained `ctx.keep`, and context cleanup before reconstruction. They exercise desktop → phone → desktop and, for the cache and crash slider, phone → desktop → phone. They do not exercise browser layout, native keyboard synthesis, visual animation or real resize events. I read `src/dev/qa-state/followup3.py` but did not independently run it or the supplied browser sweep. Full browser compatibility and visual fit remain unverified.

## Third-follow-up findings and requested fixes

### 1. Enter-applied cache workload disappears on relayout — Fixed

Reran the exact `11.7/6` sequence: type **1 2 1 3 1**, press **Enter**, then type the unapplied draft **7 8 9**. Every view retains **5 requests, 3 blocks** and draft **7 8 9**, including both directions of reconstruction. The control changes INPUT ↔ TEXTAREA without losing either state.

The log contains exactly **edit → key (Enter) → edit**, and replay does not grow it. The [new text/number Enter branch](src/shell/shell.js:499) records the submission before the section's own handler runs; [key replay](src/shell/shell.js:541) invokes that handler again. The Apply-button version also still passes.

The other specified handlers pass desktop → phone → desktop with an unapplied draft after submission:

| Step | Enter action | Preserved result and draft |
| --- | --- | --- |
| `11.5/5` | Apply queue `10, 20, 30` | Three requests and four player frames; draft `40, 50` |
| `12.2/3` | Search key `77` | Not found, six accesses; draft `88` |
| `12.2/6` | Find product `7003` | Found in bucket 3, one access; draft `5555` |
| `12.3/6` | Insert `99` | One insertion in the operation log; draft `98` |
| `12.4/6` | Resolve `/ben/games/chess.exe` | That result, three directory lookups and five player frames; draft `/ana/notes.txt` |

Each case retains exactly one key entry between its two edits. These checks verify the submitted result/model and draft, not preservation of elapsed animation time.

Also exercised the [same-moment click guard](src/shell/shell.js:509) with a controlled fixture: a text box's Enter handler clicks an Add button that increments a counter. It records one key action, no duplicate click, and restores counter **1 → 1 → 1**. A separate button click after the timer turn records normally and restores **2 → 2 → 2**. This fixture tests de-duplication directly; it is not presented as an existing section defect or as a native-browser timing test.

### 2. Finding 3 boundary detail: ignored events invalidate a full log — Fixed

On the actual `1.3/7` machine, **exactly 3000 Run to the end clicks** leave 3000 entries and no `__overflow`. Tab and ArrowLeft keydowns on a memory input, followed by a click on the step background, leave both unchanged. Address 941 remains **0005 → 0005 → 0005** across reconstruction. Rerunning the third follow-up's exact Tab-only boundary check also leaves overflow false.

A separate boundary check alternates the actual `11.10/3` slider between 1250 and 2500 until it has 3000 edit entries. Each edit emits input and change. Repeating the final value emits no new entry and does not set overflow. A genuinely additional action in the machine check does set overflow, confirming the cap still applies.

The [limit now lives inside `add()`](src/shell/shell.js:498), after event eligibility and duplicate filtering. This confirms the requested boundary correction; the accepted behavior beyond the cap is outside this Fixed verdict.

### 3. Crash-slider restoration on `11.10/3` — Fixed

The [slider now uses the same minimum, maximum and step in both layouts](src/sections/11.10.js:454): **0, 2875 and 125 milliseconds**. Tested all **24 selectable values**, starting separately in each layout and reconstructing to the other and back. Every value survives, its original-layout display returns exactly, and each log remains one edit entry.

The requested **2500** example gives slider values **2500 → 2500 → 2500**, with displayed failure times **2.59 s → 2.69 s → 2.59 s**. This display difference follows the explicit column mapping: desktop columns span 125 ms and phone columns span 250 ms; the simulation places failure three-quarters through the selected column. The saved slider coordinate is layout-independent, while the displayed/simulated instant remains grid-dependent. The test confirms the stated mapping, not an identical physical failure instant in both layouts.

## Changed-code audit and regression checks

- Read `REVIEW-ch10-13-followup-3.md` first, then reviewed the current recorder/replayer, Enter handlers, crash slider and its simulation mapping, and supplied follow-up browser script. No committed third-follow-up implementation snapshot was available for exact historical attribution of every source difference.
- Earlier targeted regressions still pass: `10.2/5`'s four-edit clamp sequence preserves **[20, 50, 25, 50]**; `12.9/4` preserves the SVG Dentry selection; `10.3/8` preserves Enter/Space recap flips; `10.1/6` preserves its own-state reveal; `10.3/5` preserves **−10 and 5**; `13.3/3` preserves Python 3 and **33.20 MB**; `11.10/8` preserves its snapshot; and the **600 runs → Reset** machine sequence preserves **0002**.
- Controlled replay-error isolation, same-element key/click de-duplication and own-state flip-snapshot checks still pass. Injected faults and fixture state are test mechanisms, not product findings.
- Confirmed the current shell, `11.7.js` and `11.10.js` sources are embedded verbatim in the delivered volume-3 HTML.
- Ran `node src/build.mjs --book <book> --check` for **1–5, 6–9 and 10–13**: all report **No blocking problems**. No delivered artifact was rebuilt.
- Reused the previous temporary JSDOM harness and added targeted checks outside the repository. Only this report was added to the repository. Native focus, scrolling, themes, browser replay latency, exhaustive earlier-volume compatibility and the PDF were not reviewed in this pass.
