# Chapters 10–13 HTML review

Reviewed 2026-10-12. Review only; implementation sources and all three delivered HTML pages were left unchanged.

The worked algorithms generally hold up under execution, including the scheduling examples, disk-head movement, RAID reconstruction and tree invariants. The main corrections concern definitions that are broader than the behavior actually illustrated, a wrong generalization in the record-blocking quiz, and lost exercise state on relayout. The engine changes are not completely isolated from earlier volumes when those volumes are rebuilt.

**Verification limit:** Chrome failed to launch in the local Playwright fixture, its fallback Chromium executable was absent, and the connected-computer tool was blocked by the session's approval policy. All nine volume-3 browser tests stopped in fixture setup; none reached its assertions. Computational reproductions below use actual source with minimal DOM stubs or extracted engines. They do not establish visual fit in the 1152 × 540 content area, phone scrolling, live keyboard behavior, or a clean browser console. Primary documentation supports the platform corrections; not every historical implementation detail was independently verified.

## Fix first

### 1. The I/O lesson teaches asynchronous completion as the definition of nonblocking I/O

**Reproduction / computation:** §11.2's nonblocking branch starts a transfer, returns to the caller and fills its buffer later. The notes tell the caller to wait for a completion flag or notification before using that buffer. This describes asynchronous I/O. In contrast, executing `os.read()` on an empty pipe with its read end set nonblocking and its write end still open returned `EAGAIN`; writing a byte afterward required a new read to obtain it. The failed read had not queued a transfer. POSIX specifies this behavior for [nonblocking pipe reads](https://www.man7.org/linux/man-pages/man3/read.3p.html); [aio_read](https://man7.org/linux/man-pages/man3/aio_read.3p.html) explicitly queues asynchronous work.

**Cause:** the [glossary definition](src/sections/11.2.js:159), [mode selector](src/sections/11.2.js:296), [DMA narration](src/sections/11.2.js:137) and [notes](src/sections/11.2.js:777) use “non-blocking” for the stronger promise of later completion. Students could reasonably carry this model into ordinary nonblocking reads and expect their buffers to be filled later.

**Recommendation:** label this branch “Asynchronous request” and contrast it with a blocking request. Add a short distinction: nonblocking calls return without waiting, possibly with partial progress or a would-block error; asynchronous submission arranges a completion that is checked or reported later. Align the glossary, recap and quiz feedback with that distinction. The interrupt/DMA transfer animation can remain.

### 2. The spanned-record quiz incorrectly limits a record to two block reads

**Reproduction / computation:** extract the actual `pack()` helper and evaluate `pack([1200], 512, 'spanned')`. It accepts the record and produces **three** blocks, holding 512, 512 and 176 bytes, with `maxParts === 3`. Nevertheless, the multi-select quiz marks “A record that crosses a block boundary needs two I/O operations to read on its own” as true. The adjacent question correctly says that spanned records can be longer than a block, with no two-block limit.

**Cause:** the [quiz choice and explanation](src/sections/12.6.js:729), [teaching callout](src/sections/12.6.js:455), [notes](src/sections/12.6.js:791) and [notes comparison table](src/sections/12.6.js:818) generalize a two-block example. The [packing engine](src/sections/12.6.js:20) already handles more blocks correctly. The on-screen [recap table](src/sections/12.6.js:692) is more precise: “two I/Os if it spans two blocks.”

**Recommendation:** say “multiple block reads—one for each block touched, assuming none is cached.” In the simplified block-access model, a record of length `R` starting at offset `o` within a block of size `B` touches `ceil((o + R) / B)` blocks. Alternatively, constrain the question explicitly to a record spanning exactly two blocks. Distinguish block accesses from a device's ability to combine them into one larger request.

### 3. Crossing the responsive breakpoint resets the CFS calculator

**Reproduction / computation:** render `10.3/5`, change “nice of X” from 0 to −10, and switch to phone layout. Executing the actual render function and slider callback confirmed that the table displays −10 before relayout. Rendering again with `ctx.narrow = true` and the **same** `ctx.keep` object creates sliders at **0 and 5**; `ctx.keep` remains empty. This loses the student's input rather than simply rearranging the view.

**Cause:** the [calculator initializes `nx` and `ny` inside `render()`](src/sections/10.3.js:585), and its [input callbacks](src/sections/10.3.js:605) only update those local variables. The [shell breakpoint handler](src/shell/shell.js:512) rebuilds layout-aware sections using `relayout: true`; [build metadata](src/build.mjs:190) marks this section layout-aware. The shell offers retained state through `ctx.keep`, but this calculator does not use it. Source search found that only §§10.1 and 10.2 reference `ctx.keep` among these 31 section files; that is an audit lead, not proof that every other step loses meaningful state.

**Recommendation:** retain edited values separately from DOM construction, using `ctx.keep` or an equivalent step model. Restore controls and calculated output from that state after relayout. Audit other editable labs and players for selected policies, workloads, tabs and playback positions. Check desktop → phone and the reverse with a partly completed exercise.

## Correct the teaching examples

### 4. The shadow-copy quiz assumes every VSS provider uses copy on write

**Reproduction / computation:** the §11.10 multi-select question asks about volume shadow copies generally and keys both saving a block before its first overwrite and reading unchanged blocks from the live volume as universally true. Microsoft's [VSS documentation](https://learn.microsoft.com/en-us/windows-server/storage/file-server/volume-shadow-copy-service) distinguishes complete-copy, copy-on-write and redirect-on-write providers. The built-in system provider uses copy on write; a split-mirror complete copy becomes independent of the original volume. Thus the quiz requires an unstated provider assumption.

**Cause:** the [glossary](src/sections/11.10.js:193), [recap](src/sections/11.10.js:931), [quiz](src/sections/11.10.js:969) and [notes](src/sections/11.10.js:1015) turn the particular mechanism demonstrated by the lab into the definition of VSS. The [snapshot failure warning](src/sections/11.10.js:876) also assumes the lab's shared-storage arrangement.

**Recommendation:** scope the lab and question to “the Windows system provider's copy-on-write shadow copy, as modeled here.” Define a shadow copy first as a point-in-time view, then explain this provider's implementation. Keep the warning that this lab's snapshot is not an independent backup; avoid making its exact storage dependencies a property of every provider.

### 5. Embedded Linux does not exclude glibc or require BusyBox

**Reproduction / computation:** §13.3's notes say that the embedded C library is musl or uClibc-ng, “not glibc.” Yet the same section's image-sizing lab explicitly permits glibc, explains when to choose it, and computes its contribution to an embedded firmware image. The [Yocto `TCLIBC` documentation](https://docs.yoctoproject.org/ref-manual/variables.html#term-TCLIBC) supports glibc as well as musl. Library and command-suite choices are configuration decisions, not criteria for whether Linux is embedded.

**Cause:** the [desktop/embedded table](src/sections/13.3.js:284), [recap definition](src/sections/13.3.js:939) and particularly the [notes](src/sections/13.3.js:1003) make categorical claims. The [chapter overview notes](src/chapters-10-13.js:1218) repeat the small-libc/BusyBox requirement. This conflicts with the better-qualified [glossary](src/sections/13.3.js:137) and the lab's [glibc explanation](src/sections/13.3.js:436) and [selection control](src/sections/13.3.js:451).

**Recommendation:** say that constrained embedded distributions **often** choose musl or uClibc-ng and BusyBox to reduce footprint, while others retain glibc and larger user-space components. Define embedded Linux by its application and device requirements. Apply the same qualification to the chapter notes and comparison table.

### 6. Variable-size partitions do not inherit fixed-block pools' fragmentation guarantee

**Reproduction / computation:** §13.2's notes describe fixed- **or variable-size** partitions with a parenthetical promising constant-time allocation and no external fragmentation. Consider a variable-size pool laid out as `[free 32][live 32][free 32]`: 64 bytes are free, but an ordinary nonmoving allocator cannot satisfy one 48-byte request. Fixed-size slabs avoid this particular problem by serving equal-size blocks; see [Zephyr's memory-slab documentation](https://docs.zephyrproject.org/latest/kernel/memory_management/slabs.html).

**Cause:** the [notes bullet](src/sections/13.2.js:883) attaches fixed-block properties to both forms. The section's glossary and matching question correctly identify **fixed-size** blocks, and the chapter overview also says fixed memory pools, so the notes introduce an inconsistency into otherwise clearer teaching.

**Recommendation:** restrict the guarantee to fixed-size block pools and explain their internal waste. Describe variable-size allocation separately: bounded allocation time is possible with suitable algorithms, but variable-size allocation does not itself eliminate external fragmentation. Avoid implying that constant algorithmic cost guarantees identical elapsed time under all runtime conditions.

## Shared-engine scope and smaller corrections

### 7. The shared player and CSS changes also change earlier volumes when rebuilt

**Reproduction / computation:** run the `HEAD` and working-tree `UI.player` implementations with the same minimal DOM, four frames, and focus on Next. Advance to the last frame. The old implementation does not call Play's `focus()`; the new one does. This is a confirmed behavior change for **any** volume using that player. The working CSS also changes all narrow-layout matching rows to a single column, allows numeric-answer rows to wrap, and applies paint containment to every flip card. These selectors are not volume-specific.

**Cause:** the [player focus transfer](src/shell/shell.js:996), [Play-button repaint optimization](src/shell/shell.js:987), [flip containment](src/shell/shell.css:433), [matching-row rules](src/shell/shell.css:485) and [numeric-row wrapping](src/shell/shell.css:500) are shared, unconditional changes. This is not evidence that the changes are harmful: the focus transfer is plausibly an improvement. It does mean that a strict claim of unchanged earlier-volume behavior would be false.

**Recommendation:** if unchanged behavior on rebuild is required, scope these changes to volume 3. If they are intended shared fixes, identify them as such and regression-test earlier-volume players, recap cards and affected quizzes in both layouts and themes. The existing delivered volumes 1–2 are self-contained HTML and are not retroactively changed by editing these source files; the compatibility issue arises on rebuilding them.

### 8. Qualify the Windows byte-range-lock guarantee for mapped views

**Reproduction / computation:** the real-system comparison says that Windows byte-range locks are mandatory and the OS refuses conflicting reads and writes. Microsoft's [`LockFileEx` contract](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-lockfileex) explicitly excludes reads and writes through mapped file views. Therefore, the statement is too broad if a student applies it to memory-mapped access. This finding is documentation-verified, not a Windows runtime experiment.

**Cause:** the [real-system callout](src/sections/12.5.js:630) and its [notes counterpart](src/sections/12.5.js:862) omit the mapped-view exception.

**Recommendation:** retain the useful advisory/mandatory comparison, but say “enforced for conflicting ordinary file reads and writes; mapped views require separate coordination.” One sentence is enough; the locking simulation does not need to change.

## Verification

- Read `REVIEW-ch6-9.md` first. Reviewed the 31 section registrations, teaching text, glossary/quiz data and notes, the four chapter overviews and notes, and the requested diffs in the build, shell and three review tools. Computational inspection was deeper for the examples listed below; this was not exhaustive execution of every render function or every interaction sequence.
- Ran check-only builds for all three volumes: 40 sections in volume 1, 25 in volume 2 and 31 in volume 3, with no blocking validation problems. Did not rebuild or overwrite the delivered pages. Volume 3 has **372 section-quiz questions**.
- Compared the volume-3 HTML with its 34 constituent source files: shell JS/CSS, chapter data and 31 sections all match as embedded content, accounting for escaped closing-script text.
- Executed the built pages' registration, slide-list and glossary construction in Node sandboxes, without starting the browser UI. Volume 3 has **296 distinct slide keys**, chapters 10–13, numeric section ordering through `11.10` and `12.11`, and separate storage configuration `os-guide-ch10-13-v1`. Confirmed `ch10`, `ch10/1`, `ch10-terms`, `ch10-quiz`, `11.10/1` and `12.11/1` resolve to distinct entries. Borrowed `semaphore` resolves to `prior:5.4` and `deadlock` to `prior:6.1`.
- Inspected whole-number parsing and equality checks in build filtering, shell routing/glossary provenance, `check.py`, `glossary_report.mjs` and `transcript.py`. Executed the checker's storage-key extractor on all three artifacts and exercised the transcript chapter-extraction logic with `11.10`, `12.11`, `ch10/1`, `ch10-terms`, `ch13-quiz` and `ch1`. No two-digit truncation or prefix collision was found in these checks. Full browser hash navigation, persistence after reload and browser-dependent tool execution remain unverified.
- Executed the actual shared player with deterministic timers: the tested Play/Pause, Reset and context-cleanup sequences left no surviving player timer. Compared its changed focus behavior with `HEAD` as described above. This does not certify every lesson's custom timers, actual focus behavior or screen-reader access.
- Ran the actual-source multiprocessor and real-time engine checks in `src/dev/qa-10.1/engine.test.mjs` and `src/dev/qa-10.2/engine.test.cjs`. Checked makespans of 16 versus 12, load-sharing means, the RMS/EDF examples, and priority-inversion completion at 15 versus 9. The classic three-task utilization is approximately **0.752381**, with no RMS misses over the checked 2,100-unit hyperperiod. The 10/20 and 25/50 workload misses under the illustrated fixed-priority choices but meets deadlines under EDF.
- Ran the actual CFS red-black-tree checker: **53,640 operations** preserved its checked invariants. Executed the SVR4 trace extractor, ULE engine tests and Windows engine trace generator. ULE's 90/10 and 10/90 sleep/run scores recompute to **5.56 and 94.44**. The Windows generator exercises priority mapping, boosts, starvation scans, quantum settings and affinity decisions; its traces are model executions, not proof that every detail matches every Windows release.
- Ran the actual disk-scheduling engine tests: classic FIFO **498**, SSTF **248**, SCAN **280**, LOOK **250**, C-SCAN **388**, C-LOOK **322** tracks. Executed actual RAID-6 reconstruction for **3,840 two-loss combinations**, with all recovered data matching the original four-byte stripes. Disk-cache calculations gave three LRU hits for the checked trace and **0.81 ms** for the stated weighted access-time example.
- Executed the actual SVR4 buffer-cache tour/stress script: it reported **zero invariant violations** over its stress run. Executed the Linux I/O scheduler examples: the soft-deadline request begins at **520 ms**, rather than being guaranteed service by its 500 ms expiry; the section's qualification is appropriate. The anticipatory example reproduced its seek/idle tradeoff.
- Ran the actual file-organization cost-engine suite, which passed and distinguishes its approximate formulas from exact search counts. The B/B+ tree suite passed **27,522 checks** across 900 randomized trees. Executed record packing and VFS examples; the repeated path-lookup example has **four misses**, and the fork/shared-offset example ends at **150 bytes**.
- Recomputed the allocation, inode and NTFS examples using the existing independent calculation scripts: **4 MiB** bitmap versus **128 MiB** free-block list; indirect-pointer capacities; NTFS byte 150,000 mapping to **VCN 36, offset 2,544, LCN 52,006**; and the **16 MiB** cluster bitmap. These independent calculations complement, rather than replace, actual-engine execution.
- Executed the embedded interrupt-latency and firmware/wear models: the RT worst-case latency is **7 µs**, and the stated image examples are **3.65 MB and 17.7 MB**. Recomputed the 1% duty-cycle example as **204.95 µA**. Executed the actual TinyOS-style mote engine, including duplicate-task posting and an interrupt preempting a task while queued tasks wait for it to return. This does not compile or run the displayed nesC application on hardware.
- Checked selected era claims against primary material, including the kernel's [CFS](https://cdn.kernel.org/doc/html/latest/scheduler/sched-design-CFS.html) and [EEVDF](https://kernel.org/doc/html/latest/scheduler/sched-eevdf.html) documentation and the [FreeBSD 7.1 announcement](https://www.freebsd.org/releases/7.1R/announce/). The latter identifies ULE becoming the GENERIC default on amd64/i386. Historical SVR4 details and every Windows-version qualification were not independently certified.
- Attempted `PYTHONDONTWRITEBYTECODE=1 python3 -m pytest src/tests/e2e/test_volume3.py -q -p no:cacheprovider`: nine setup errors, no executed assertions. The browser geometry/fuzz checker and transcript capture were consequently not run. No claim is made about clipping, animation intermediates, minimum rendered text size, phone horizontal overflow, complete keyboard operation or both-theme visual quality. Existing QA screenshots/logs were not treated as evidence of a successful browser run in this review.
