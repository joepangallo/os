/* =====================================================================
   13.3 Embedded Linux
   Original teaching material. Shared helpers live inside this IIFE (no globals).
   Every size, erase count and lifetime a student is told comes out of the
   helpers below, so text and visuals cannot disagree.
   ===================================================================== */
(function () {
  const fmt = (v, d = 1) => (Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).toLocaleString('en-US');
  const commas = (n) => Math.round(n).toLocaleString('en-US');

  /* ---- step 1: where embedded Linux lives (typical values; real products vary widely) ----
     ram / store: one representative size in MB, used for the log-scale bars; the text gives the usual range. */
  const DEVICES = [
    { key: 'router', name: 'Wi-Fi router', cpu: 'ARM or MIPS system-on-chip, 1–4 cores', ramTxt: '64–512 MB', ram: 128, stTxt: '16–256 MB of raw flash', store: 16,
      sw: 'OpenWrt-style firmware: a compressed read-only root image plus a small writable partition, BusyBox commands, the musl C library.',
      note: 'Flash is counted in megabytes, so every kilobyte of the image matters.' },
    { key: 'camera', name: 'IP camera', cpu: 'ARM system-on-chip with a video encoder', ramTxt: '64–256 MB', ram: 128, stTxt: '16–32 MB of NOR flash', store: 16,
      sw: 'Vendor Linux built with Buildroot or Yocto: squashfs root, JFFS2 for settings, BusyBox, uClibc-ng or musl.',
      note: 'Vendors reuse one chip family across many camera models, each with its own trimmed image.' },
    { key: 'tv', name: 'Smart TV', cpu: 'Multi-core ARM system-on-chip', ramTxt: '1.5–4 GB', ram: 2048, stTxt: '8–32 GB of eMMC', store: 16384,
      sw: 'Android TV, webOS or Tizen: different platforms, all built on the Linux kernel; ext4 or F2FS on the eMMC.',
      note: 'Big enough for app stores, but still built and tuned for one family of hardware.' },
    { key: 'car', name: 'Car dashboard', cpu: 'Multi-core ARM automotive system-on-chip', ramTxt: '4–16 GB', ram: 8192, stTxt: '32–256 GB of eMMC or UFS', store: 65536,
      sw: 'Automotive Grade Linux (built with the Yocto Project) or Android Automotive OS.',
      note: 'It must start quickly and keep working for many years, so the whole image is locked down and tested as one unit.' },
    { key: 'mcu', name: 'MCU board (no MMU)', cpu: 'ARM Cortex-M microcontroller, a few hundred MHz, no MMU', ramTxt: '8–32 MB of external SDRAM', ram: 16, stTxt: '2–16 MB of flash', store: 8,
      sw: 'A kernel built without MMU support (µClinux style), BusyBox, uClibc-ng, programs in a flat binary format.',
      note: 'The smallest Linux systems: no virtual memory at all (step 7 of this section).' },
    { key: 'pc', name: 'Desktop PC', cpu: 'x86-64, 4–16 cores', ramTxt: '8–32 GB', ram: 16384, stTxt: '256 GB–2 TB SSD', store: 524288,
      sw: 'A general-purpose distribution: glibc, the GNU tools, systemd and a desktop environment, several GB installed.',
      note: 'Shown for comparison: everything is included “just in case”, because nobody knows what the user will need.' },
  ];

  /* ---- step 3: image-size model (illustrative, rounded MB; real sizes depend on version, processor and configuration) ----
     The kernel image is already compressed (zImage), so squashfs compression applies only to the root file system. */
  const SZ = {
    kernelCore: 1.6,
    feat: {
      net: { label: 'Networking', k: 0.9, u: 0.6, kTxt: 'TCP/IP stack, Ethernet and Wi-Fi drivers', uTxt: 'an SSH server and a small web admin page' },
      usb: { label: 'USB', k: 0.3, u: 0.2, kTxt: 'USB host stack and USB-storage driver', uTxt: 'USB tools' },
      gui: { label: 'Touch GUI', k: 0.6, u: 6.0, kTxt: 'display and touch-input drivers', uTxt: 'a GUI toolkit and fonts' },
      py: { label: 'Python 3', k: 0, u: 15.0, kTxt: '', uTxt: 'the interpreter and a trimmed standard library' },
    },
    libc: { glibc: 2.4, musl: 0.6, uclibc: 0.5 },
    tools: { gnu: 12.0, busybox: 0.9 },
    base: 0.2,
    squash: 0.5,
    desktop: 8000,
  };
  function imageSize(o) {
    let k = SZ.kernelCore, apps = 0;
    Object.keys(SZ.feat).forEach((f) => { if (o.feat[f]) { k += SZ.feat[f].k; apps += SZ.feat[f].u; } });
    const f = o.squash ? SZ.squash : 1;
    const parts = [
      { key: 'kernel', label: 'Kernel', mb: k, cls: 'os' },
      { key: 'libc', label: 'C library', mb: SZ.libc[o.libc] * f, cls: 'mem' },
      { key: 'tools', label: o.tools === 'busybox' ? 'BusyBox' : 'GNU tools', mb: SZ.tools[o.tools] * f, cls: 'proc' },
      { key: 'apps', label: 'Feature programs', mb: apps * f, cls: 'io' },
      { key: 'base', label: 'Config + scripts', mb: SZ.base * f, cls: 'muted' },
    ];
    const total = parts.reduce((a, p) => a + p.mb, 0);
    const rootRaw = SZ.libc[o.libc] + SZ.tools[o.tools] + apps + SZ.base;
    return { parts, total, kernel: k, rootRaw, rootStored: rootRaw * f };
  }

  /* ---- step 4: a toy flash chip and three ways to update one small record ----
     8 erase blocks x 4 pages; each block survives E erases. Blocks 0-4 hold static files ('cold');
     one small settings record ('hot') starts in block 5, page 0, and is rewritten on every update.
       inplace : overwrite the record where it is: erase its block, program the page (what a disk file system assumes)
       dynamic : write each new version to the next free page; when the current block is full, take the least-worn
                 erased block, or erase the block with the most stale pages (garbage collection)
       static  : dynamic, plus: when a freshly erased block is T or more erases ahead of the least-worn block of
                 static data, park the static data in the worn block and reuse the barely-worn block for new writes */
  const FL = { B: 8, P: 4, E: 100, T: 10, hotBlock: 5 };
  function makeFlash(mode) {
    const { B, P, E, T } = FL;
    const st = { mode, pages: [], erase: Array(B).fill(0), act: FL.hotBlock, ptr: 1, hot: [FL.hotBlock, 0], updates: 0, erases: 0, copies: 0, moves: 0, dead: -1, deadAt: 0, lastErased: -1, lastMove: null };
    for (let b = 0; b < B; b++) st.pages.push(Array(P).fill(b < 5 ? 'cold' : 'free'));
    st.pages[FL.hotBlock][0] = 'hot';
    const isFree = (b) => st.pages[b].every((x) => x === 'free');
    function eraseBlock(b) {
      st.pages[b] = Array(P).fill('free'); st.erase[b]++; st.erases++; st.lastErased = b;
      if (st.erase[b] >= E && st.dead < 0) { st.dead = b; st.deadAt = st.updates; }
    }
    function newActive() {
      const free = [];
      for (let b = 0; b < B; b++) if (b !== st.act && isFree(b)) free.push(b);
      if (free.length) { free.sort((a, b) => st.erase[a] - st.erase[b] || a - b); return free[0]; }
      let v = -1, best = -1;
      for (let b = 0; b < B; b++) {
        if (b === st.act) continue;
        const n = st.pages[b].filter((x) => x === 'stale').length;
        if (n > best || (n === best && st.erase[b] < st.erase[v])) { best = n; v = b; }
      }
      eraseBlock(v); // in this workload the victim holds only stale pages, so nothing must be copied out first
      if (mode === 'static') {
        let c = -1;
        for (let b = 0; b < B; b++) if (st.pages[b].every((x) => x === 'cold') && (c < 0 || st.erase[b] < st.erase[c])) c = b;
        if (c >= 0 && st.erase[v] - st.erase[c] >= T) {
          st.pages[v] = st.pages[c].slice(); st.copies += P; st.moves++; st.lastMove = [c, v];
          eraseBlock(c);
          return c;
        }
      }
      return v;
    }
    function update() {
      if (st.dead >= 0) return false;
      st.updates++; st.lastMove = null; st.lastErased = -1;
      if (mode === 'inplace') { eraseBlock(FL.hotBlock); st.pages[FL.hotBlock][0] = 'hot'; return true; }
      if (st.ptr >= P) { st.act = newActive(); st.ptr = 0; }
      const [hb, hp] = st.hot; st.pages[hb][hp] = 'stale';
      st.pages[st.act][st.ptr] = 'hot'; st.hot = [st.act, st.ptr]; st.ptr++;
      return true;
    }
    return { st, update };
  }
  // updates a mode survives before its first block reaches E erases (computed by running the same simulator)
  function lifetime(mode) { const f = makeFlash(mode); let g = 0; while (f.st.dead < 0 && g++ < 20000) f.update(); return f.st.deadAt; }

  Guide.section({
    id: '13.3',
    title: 'Embedded Linux',
    short: 'Embedded Linux',
    summary: 'How Linux is trimmed, cross-built and stored on flash for devices, and how it runs without an MMU.',
    objectives: [
      'Explain how an embedded Linux distribution differs from desktop Linux: kernel configuration, memory, cross-compiled toolchain, C library and BusyBox.',
      'Estimate how kernel features, the C library, the command-line tools and compression change the size of a firmware image.',
      'Explain erase blocks and wear leveling, and choose squashfs, JFFS2, UBIFS or ext4/F2FS for a given flash device.',
      'List the advantages of embedded Linux and describe Android as a Linux kernel with its own, non-GNU user space.',
      'Explain why Linux without an MMU (µClinux) cannot offer fork(), and how vfork() plus exec replaces it.',
    ],
    terms: [
      ['Embedded Linux distribution', 'A version of Linux cut down and configured for one kind of device: only the kernel features, drivers, libraries and programs that device needs, compiled for its processor and sized to fit its memory and storage.'],
      ['Cross-compiler (cross toolchain)', 'A compiler, together with its assembler, linker and libraries, that runs on one kind of computer (the host, often an x86-64 PC) but produces programs for a different processor (the target, such as an ARM board).'],
      ['Embedded build system', 'A tool such as Buildroot or the Yocto Project that fetches source code, cross-compiles the toolchain, kernel, libraries and programs, and packs them into images ready to write to a device.'],
      ['C library (libc)', 'The library of standard C functions (printf, malloc, fopen...) and system-call wrappers that almost every Linux program uses. Desktop Linux uses glibc; embedded systems often use a smaller one.'],
      ['glibc (GNU C Library)', 'The full-featured C library of desktop and server Linux distributions: very complete and widely compatible, but larger than the embedded alternatives.'],
      ['musl', 'A small C library for Linux written from scratch with a focus on correctness and easy static linking. OpenWrt and Alpine Linux use it.'],
      ['uClibc-ng', 'A small, highly configurable C library for embedded Linux, including processors without an MMU. It continues the older uClibc project, which stopped releasing around 2012.'],
      ['BusyBox', 'One small executable that contains slimmed-down versions of hundreds of standard commands (ls, cp, sh, mount...). Each command name is a link to the same file, and BusyBox looks at the name it was started under to decide which command to act as.'],
      ['Root file system (rootfs)', 'The file system mounted at / when Linux starts. It holds the programs, libraries and configuration files; on a device it is usually built as one image and written to flash.'],
      ['Flash memory', 'Nonvolatile memory with no moving parts. It is programmed in small units (a page on NAND, a byte or word on NOR), but bits can be turned back into 1s only by erasing a whole erase block, and each block survives a limited number of erases.'],
      ['Erase block', 'The smallest region of flash that can be erased at once, typically tens of KB to a few MB. Erasing sets every bit in it to 1; programming can then only change 1s into 0s.'],
      ['Wear leveling', 'Spreading erases evenly over all the blocks of a flash chip, so that no block wears out early while others are barely used.'],
      ['Raw flash (MTD)', 'A flash chip that Linux drives directly through its memory technology device (MTD) layer, with no controller in between. The file system on top must handle erase blocks, wear leveling and bad blocks (blocks that have failed) itself.'],
      ['Flash translation layer (FTL)', 'Firmware inside the controller of managed flash (eMMC, SD cards, USB sticks, SSDs) that hides erase blocks and levels wear, so the device looks like an ordinary disk with rewritable sectors.'],
      ['squashfs', 'A compressed, read-only Linux file system. The whole tree is packed into one image when the firmware is built; widely used for the root file systems of routers and other devices.'],
      ['JFFS2', 'Journalling Flash File System version 2: a read-write file system for raw flash that writes every change to a new place, levels wear and compresses data. It scans the whole chip when mounted, so it suits small partitions.'],
      ['UBIFS', 'A read-write file system for raw NAND flash that runs on UBI, a layer that levels wear and handles bad blocks across the whole chip. It keeps its index on flash, so it mounts quickly even on large chips.'],
      ['YAFFS2', 'Yet Another Flash File System 2: a log-structured file system designed for NAND flash and used in many devices, including early Android phones. It is maintained outside the mainline Linux kernel.'],
      ['µClinux (uClinux)', 'Microcontroller Linux: Linux for processors without a memory management unit. Its changes entered the mainline kernel during the 2.5 development series, so kernels from 2.6 on can be built for MMU-less chips.'],
      ['vfork()', 'A variant of fork() in which the child borrows the parent’s memory instead of getting a copy, and the parent is suspended until the child calls exec or _exit. It is how programs start other programs on Linux without an MMU.'],
    ],
    css: `
      .sec-13-3 .narr { background: var(--panel-2); border: 1px solid var(--line); border-left: 5px solid var(--chc); border-radius: 12px; padding: 9px 14px; font-size: 15.5px; line-height: 1.45; }
      .sec-13-3 .narr.ok { border-left-color: var(--ok); background: var(--ok-bg); }
      .sec-13-3 .narr.bad { border-left-color: var(--bad); background: var(--bad-bg); }
      .sec-13-3 .narr.warn { border-left-color: var(--warn); background: var(--warn-bg); }
      .sec-13-3 .trait-tbl th, .sec-13-3 .trait-tbl td { padding: 4px 8px; font-size: 14.5px; line-height: 1.3; }
      .sec-13-3 .dev-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
      .sec-13-3 .dev-grid .btn { width: 100%; }
      .sec-13-3 .prow { display: grid; grid-template-columns: 84px minmax(0, 1fr); gap: 8px; align-items: baseline; }
      .sec-13-3 .logbar { display: flex; flex-direction: column; gap: 4px; flex: none; }
      .sec-13-3 .logbar .track { position: relative; height: 14px; border-radius: 7px; background: var(--panel-3); }
      .sec-13-3 .logbar .track > i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 7px; background: var(--chc); transition: width .35s; }
      .sec-13-3 .logbar .track > b.ref { position: absolute; top: -4px; bottom: -4px; width: 3px; margin-left: -1.5px; background: var(--ink); border-radius: 2px; }
      .sec-13-3 .scale { position: relative; height: 16px; flex: none; margin-top: -2px; }
      .sec-13-3 .scale span { position: absolute; font-size: 12.5px; color: var(--muted); white-space: nowrap; }
      .sec-13-3 .triplet { padding: 6px 12px; line-height: 1.6; background: var(--panel-2); border: 1px solid var(--line); border-radius: 10px; }
      .sec-13-3 .x-row { display: grid; grid-template-columns: minmax(0, 1fr) 218px; gap: 10px; min-height: 0; }
      .sec-13-3 .x-row .log { height: 100%; }
      .sec-13-3 .x-row.slim { grid-template-columns: minmax(0, 1fr); }
      .sec-13-3 .x-row.slim .log { height: 150px; }
      .sec-13-3 .log .cmd { color: var(--ink-2); }
      .sec-13-3 .log .res { color: var(--ok); }
      .sec-13-3 .log .err { color: var(--bad); }
      .sec-13-3 table.outc { align-self: start; }
      .sec-13-3 table.outc th, .sec-13-3 table.outc td { padding: 4px 6px; font-size: 13.5px; }
      .sec-13-3 .crow { display: grid; grid-template-columns: 82px minmax(0, 1fr); gap: 8px; align-items: center; }
      .sec-13-3 .crow .seg button { font-size: 13.5px; }
      .sec-13-3 .imgbar { position: relative; display: flex; flex: none; height: 44px; border-radius: 10px; background: var(--panel-3); margin: 22px 0 0; }
      .sec-13-3 .imgbar > i { display: block; height: 100%; border-right: 2px solid var(--panel); transition: width .35s; min-width: 2px; }
      .sec-13-3 .imgbar > i:first-child { border-radius: 10px 0 0 10px; }
      .sec-13-3 .imgbar > b.cap { position: absolute; top: -22px; bottom: -4px; width: 0; margin-left: -3px; border-left: 3px solid var(--ink); }
      .sec-13-3 .imgbar > b.cap.over { border-left-color: var(--bad); }
      .sec-13-3 .imgbar > b.cap > span { position: absolute; top: 0; right: 6px; font-size: 12.5px; font-weight: 800; white-space: nowrap; color: var(--ink-2); }
      .sec-13-3 .seg-os { background: var(--os); } .sec-13-3 .seg-mem { background: var(--mem); } .sec-13-3 .seg-proc { background: var(--proc); }
      .sec-13-3 .seg-io { background: var(--io); } .sec-13-3 .seg-muted { background: var(--muted); }
      .sec-13-3 .sw { display: inline-block; width: 14px; height: 14px; border-radius: 4px; vertical-align: middle; }
      .sec-13-3 table.img-leg td { padding: 5px 8px; font-size: 14.5px; }
      .sec-13-3 table.img-leg td.num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
      .sec-13-3 .bin-ls { display: flex; flex-wrap: wrap; gap: 2px 16px; font-size: 13.5px; }
      .sec-13-3 ol.rules { padding-left: 20px; }
      .sec-13-3 ol.rules li { margin: 0 0 4px; line-height: 1.4; }
      .sec-13-3 .brow { display: grid; grid-template-columns: 78px auto auto; gap: 10px; align-items: center; justify-content: start; }
      .sec-13-3 .brow.slim { grid-template-columns: auto auto; gap: 4px 10px; }
      .sec-13-3 .brow.slim > :first-child { grid-column: 1 / -1; }
      .sec-13-3 .bits { display: flex; gap: 4px; }
      .sec-13-3 .bit { display: inline-grid; place-items: center; width: 30px; height: 30px; border-radius: 7px; border: 1px solid var(--line-2); background: var(--panel); font-family: var(--mono); font-weight: 800; font-size: 15px; padding: 0; color: var(--ink); }
      .sec-13-3 button.bit { cursor: pointer; }
      .sec-13-3 button.bit:hover { border-color: var(--accent); }
      .sec-13-3 .bit.clr { background: var(--ok-bg); border-color: var(--ok); color: var(--ok); }
      .sec-13-3 .bit.set { background: var(--bad-bg); border-color: var(--bad); color: var(--bad); }
      .sec-13-3 .fgrid { display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); gap: 6px; }
      .sec-13-3 .fblk { display: flex; flex-direction: column; gap: 3px; padding: 4px; border-radius: 9px; border: 2px solid transparent; }
      .sec-13-3 .fblk.erased { border-color: var(--warn); background: var(--warn-bg); }
      .sec-13-3 .fblk.moved { border-color: var(--os); background: var(--os-bg); }
      .sec-13-3 .fblk.dead { border-color: var(--bad); background: var(--bad-bg); }
      .sec-13-3 .pg { display: grid; place-items: center; height: 22px; border-radius: 5px; font-size: 13px; font-weight: 800; font-family: var(--mono); border: 1px solid transparent; }
      .sec-13-3 .pg.key { display: inline-grid; width: 22px; height: 20px; }
      .sec-13-3 .pg-cold { background: var(--mem-bg); border-color: var(--mem); color: var(--mem); }
      .sec-13-3 .pg-hot { background: var(--accent-bg); border-color: var(--accent); color: var(--accent); }
      .sec-13-3 .pg-stale { background: var(--panel-3); color: var(--muted); }
      .sec-13-3 .pg-free { background: var(--panel); border: 1px dashed var(--line-2); }
      .sec-13-3 .wear { height: 8px; border-radius: 4px; background: var(--panel-3); overflow: hidden; margin-top: 3px; }
      .sec-13-3 .wear > i { display: block; height: 100%; }
      .sec-13-3 .wear > i.w-ok { background: var(--ok); } .sec-13-3 .wear > i.w-warn { background: var(--warn); } .sec-13-3 .wear > i.w-bad { background: var(--bad); }
      .sec-13-3 .paths { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
      .sec-13-3 .path { display: flex; flex-direction: column; gap: 3px; padding: 8px 10px; border: 1px solid var(--line); border-radius: 12px; background: var(--panel-2); }
      .sec-13-3 .lay { padding: 4px 8px; border-radius: 8px; font-size: 14px; font-weight: 700; text-align: center; border: 1px solid transparent; }
      .sec-13-3 .lay.os { background: var(--os-bg); color: var(--os); border-color: color-mix(in srgb, var(--os) 35%, transparent); }
      .sec-13-3 .lay.io { background: var(--io-bg); color: var(--io); border-color: color-mix(in srgb, var(--io) 35%, transparent); }
      .sec-13-3 .path .arr { text-align: center; line-height: 1; color: var(--muted); font-size: 13px; }
      .sec-13-3 .path p { margin-top: 4px !important; line-height: 1.35; }
      .sec-13-3 .fs-tabs .tabs { height: 100%; }
      .sec-13-3 .fs-opts .btn { width: 100%; white-space: normal; height: auto; min-height: 40px; }
      .sec-13-3 table.fs-tbl th, .sec-13-3 table.fs-tbl td { padding: 5px 8px; font-size: 14px; line-height: 1.3; vertical-align: top; }
      .sec-13-3 .adv { padding: 7px 12px; border-left: 4px solid var(--chc); background: var(--panel-2); border-radius: 0 10px 10px 0; font-size: 15px; line-height: 1.4; }
      .sec-13-3 .and-row { display: grid; grid-template-columns: 104px minmax(0, 1fr) minmax(0, 1fr); gap: 10px; align-items: center; text-align: left; padding: 5px 8px; border: 1px solid var(--line); border-radius: 10px; background: var(--panel); color: var(--ink); font: inherit; font-size: 14px; line-height: 1.3; cursor: pointer; }
      .sec-13-3 .and-row.slim { grid-template-columns: 84px minmax(0, 1fr) minmax(0, 1fr); gap: 6px; }
      .sec-13-3 .and-row.slim .cell { overflow-wrap: anywhere; }
      .sec-13-3 .and-row.head { cursor: default; background: transparent; border-color: transparent; padding-top: 0; padding-bottom: 0; font-size: 12.5px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; color: var(--muted); }
      .sec-13-3 button.and-row:hover { border-color: var(--accent); }
      .sec-13-3 .and-row.on { border-color: var(--accent); background: var(--accent-bg); }
      .sec-13-3 .and-row.shared { border: 2px solid var(--ok); }
      .sec-13-3 .and-row .lbl { font-weight: 800; font-size: 13.5px; }
      .sec-13-3 .and-row .cell.and { color: var(--proc); }
      .sec-13-3 .and-row.head .cell.and { color: var(--muted); }
      .sec-13-3 ul.nommu { padding-left: 18px; }
      .sec-13-3 ul.nommu li { margin: 0 0 3px; line-height: 1.35; }
      .sec-13-3 .mmu-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr) minmax(0, 1fr); gap: 10px; align-items: start; }
      .sec-13-3 .mmu-grid.slim { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
      .sec-13-3 .mmu-grid.slim .memcol { grid-column: 1 / -1; grid-row: 2; }
      .sec-13-3 .pcard { display: flex; flex-direction: column; gap: 3px; padding: 8px 10px; border-radius: 12px; border: 2px solid var(--proc); background: var(--proc-bg); min-width: 0; }
      .sec-13-3 .pcard.chi { border-color: var(--accent); background: var(--accent-bg); }
      .sec-13-3 .pcard.empty { border-style: dashed; background: var(--panel); border-color: var(--line-2); }
      .sec-13-3 .pcard .pl { font-size: 13px; line-height: 1.35; overflow-wrap: anywhere; }
      .sec-13-3 .pcard .pl.ok { color: var(--ok); font-weight: 700; }
      .sec-13-3 .pcard .pl.bad { color: var(--bad); font-weight: 700; }
      .sec-13-3 .pcard .pl.warn { color: var(--warn); font-weight: 700; }
      .sec-13-3 .memcol { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
      .sec-13-3 .slot { display: grid; grid-template-columns: 22px minmax(0, 1fr) 22px; gap: 6px; align-items: center; min-height: 42px; padding: 3px 4px; border-radius: 9px; border: 1px solid var(--line); background: var(--panel); }
      .sec-13-3 .slot .sl-t { line-height: 1.25; text-align: center; }
      .sec-13-3 .slot.s-k { background: var(--os-bg); border-color: color-mix(in srgb, var(--os) 40%, transparent); }
      .sec-13-3 .slot.s-p { background: var(--proc-bg); border-color: var(--proc); }
      .sec-13-3 .slot.s-c { background: var(--accent-bg); border-color: var(--accent); }
      .sec-13-3 .slot.s-sh { background: linear-gradient(90deg, var(--proc-bg), var(--accent-bg)); border-color: var(--ink-2); }
      .sec-13-3 .slot.s-free { border-style: dashed; color: var(--muted); }
      .sec-13-3 .slot.s-bad { background: var(--bad-bg); border-color: var(--bad); }
      .sec-13-3 .mk { display: inline-grid; place-items: center; width: 22px; height: 22px; border-radius: 6px; font-size: 12.5px; font-weight: 900; }
      .sec-13-3 .mk.none { visibility: hidden; }
      .sec-13-3 .mk.pm { background: var(--proc); color: var(--panel); }
      .sec-13-3 .mk.cm { background: var(--accent); color: var(--panel); }
      .sec-13-3 .mk.bad { background: var(--bad); color: var(--panel); }
      .sec-13-3 .mk.warn { background: var(--warn); color: var(--panel); }
    `,
    steps: [
      /* ---------------- 1. Big picture: Linux, packed for one device ---------------- */
      {
        title: 'Linux, packed for one small device',
        kind: 'story',
        html: `
          <div class="split fill">
            <div class="stack" style="gap:10px">
              <p class="lead m0">A Wi-Fi router, a smart TV and a car dashboard can all run <span class="t">Linux</span>, the same kernel that runs cloud servers. None of them runs a desktop distribution.</p>
              <p class="m0">An <span class="t">embedded Linux distribution</span> is Linux tailored to one kind of device: the <span class="t">kernel</span> keeps only the drivers and features that hardware needs, every program is compiled for its processor, and the whole system is sized to fit its memory and <span class="t">flash memory</span>.</p>
              <table class="tbl compact trait-tbl">
                <thead><tr><th></th><th>Desktop Linux</th><th>Embedded Linux</th></tr></thead>
                <tbody>
                  <tr><td class="b">Kernel</td><td>Generic: thousands of drivers, mostly modules</td><td>This board’s drivers only, often 1–3 MB</td></tr>
                  <tr><td class="b">RAM</td><td>Gigabytes</td><td>Tens of MB, or just a few</td></tr>
                  <tr><td class="b">Built</td><td>On the same kind of PC</td><td>Cross-compiled on a host PC</td></tr>
                  <tr><td class="b">C library</td><td>glibc</td><td>Often musl or uClibc-ng (smaller); some keep glibc</td></tr>
                  <tr><td class="b">Commands</td><td>GNU coreutils, bash, ...</td><td>Often BusyBox: one small program</td></tr>
                </tbody>
              </table>
              <div class="callout analogy m0" data-label="Analogy">Packing a backpack for a hike, not moving house: the same kinds of things, but only what this trip needs, each in its lightest version.</div>
            </div>
            <div class="card stack" style="gap:8px">
              <div class="row" style="justify-content:space-between"><h4 class="m0">Where embedded Linux lives</h4><span class="xs muted">typical values; real products vary widely</span></div>
              <div class="dev-grid"></div>
              <div class="card white grow dev-detail stack" style="gap:7px"></div>
            </div>
          </div>`,
        render(el, ctx) {
          const { h } = ctx;
          const grid = ctx.$('.dev-grid'), detail = ctx.$('.dev-detail');
          const pc = DEVICES.find((d) => d.key === 'pc');
          const mbTxt = (mb) => (mb >= 1024 ? commas(mb / 1024) + ' GB' : commas(mb) + ' MB');
          const pos = (mb) => (Math.log10(mb) / Math.log10(1024 * 1024)) * 100; // log scale: 1 MB at 0 %, 1 TB at 100 %
          function bar(label, mb, ref, txt) {
            const more = ref / mb;
            return h('div', { class: 'logbar' },
              h('div', { class: 'row nw', style: { justifyContent: 'space-between', gap: '8px' } },
                h('span', { class: 'small' }, h('b', {}, label + ': '), txt),
                h('span', { class: 'xs muted b', style: { whiteSpace: 'nowrap' } }, more > 1 ? 'desktop: ' + commas(more) + '× more' : 'the reference')),
              h('div', { class: 'track' },
                h('i', { style: { width: pos(mb) + '%' } }),
                h('b', { class: 'ref', style: { left: pos(ref) + '%' } })));
          }
          const scale = () => h('div', { class: 'scale' }, ...[['1 MB', 0, '0'], ['1 GB', 50, '-50%'], ['1 TB', 100, '-100%']].map(([t, x, tx]) => h('span', { style: { left: x + '%', transform: 'translateX(' + tx + ')' } }, t)));
          const btns = DEVICES.map((d, i) => h('button', { class: 'btn sm', type: 'button', onclick: () => show(i) }, d.name));
          grid.append(...btns);
          function show(i) {
            const d = DEVICES[i];
            btns.forEach((b, j) => b.classList.toggle('on', i === j));
            detail.replaceChildren(
              h('div', { class: 'prow' }, h('span', { class: 'xs muted b' }, 'PROCESSOR'), h('span', { class: 'small' }, d.cpu)),
              h('div', { class: 'prow' }, h('span', { class: 'xs muted b' }, 'SOFTWARE'), h('span', { class: 'small' }, d.sw)),
              bar('RAM', d.ram, pc.ram, d.ramTxt),
              bar('Storage', d.store, pc.store, d.stTxt),
              scale(),
              h('div', { class: 'xs muted' }, 'Log scale: each labelled step is 1,024× bigger. The dark mark on each bar is the desktop PC.'),
              h('div', { class: 'narr', style: { marginTop: '4px' } }, d.note));
            detail.classList.remove('fade-in'); void detail.offsetWidth; detail.classList.add('fade-in');
          }
          show(0);
        },
      },

      /* ---------------- 2. Cross-compiling ---------------- */
      {
        title: 'Build here, run there: cross-compiling',
        kind: 'explore',
        html: `
          <div class="split fill">
            <div class="stack" style="gap:9px">
              <p class="lead m0">A router has no keyboard, little RAM and no room for a compiler. Its software is built on another computer.</p>
              <p class="m0">Developers work on a <b>host</b>, usually an x86-64 PC, and build for the <b>target</b>: the device’s processor (ARM, MIPS, RISC-V, PowerPC...). A <span class="t">cross-compiler</span> runs on the host but produces machine code for the target. With an assembler, a linker, the target’s <span class="t">C library</span> and the kernel’s header files it forms a <b>cross toolchain</b>, named after what it builds for:</p>
              <div class="triplet small"><code>arm</code> processor · <code>linux</code> operating system · <code>gnueabihf</code> GNU C library, ARM calling rules, hardware floating point</div>
              <p class="m0">Building hundreds of packages by hand is slow and error-prone, so an <span class="t">embedded build system</span> does it: <b>Buildroot</b> (pick options in a menu, get a kernel and a root file system image) or the <b>Yocto Project</b> (layers of build “recipes” run by its BitBake tool, for complete custom distributions).</p>
              <div class="callout warn m0" data-label="Common mistake">“It is Linux, so any Linux program runs on it.” Machine code belongs to one instruction set: the same C source must be compiled separately for each kind of processor.</div>
            </div>
            <div class="card stack x-card" style="gap:8px"></div>
          </div>`,
        render(el, ctx) {
          const { h } = ctx;
          const card = ctx.$('.x-card');
          const SRC = [
            ['#include <stdio.h>', 'declares printf'],
            ['int main(void) {', 'the program starts here'],
            ['    printf("hello\\n");', 'print via the C library'],
            ['    return 0;', 'exit status 0 = success'],
            ['}', 'end of main'],
          ];
          // wide screens: comment beside each line; small screens: comment on its own line above, so nothing hides off the edge
          const code = ctx.ui.code(ctx.narrow
            ? SRC.map(([c, m]) => (c.match(/^ */)[0]) + '// ' + m + '\n' + c).join('\n')
            : SRC.map(([c, m]) => c.padEnd(23) + '// ' + m).join('\n'), { lang: 'c', fontSize: 13.5 });
          const BIN = {
            gcc: { cmd: 'gcc hello.c -o hello', file: 'hello: ELF 64-bit LSB pie executable, x86-64, dynamically linked, ...', arch: 'x86-64', label: 'gcc' },
            cross: { cmd: 'arm-linux-gnueabihf-gcc hello.c -o hello', file: 'hello: ELF 32-bit LSB pie executable, ARM, EABI5, dynamically linked, ...', arch: 'ARM', label: 'cross gcc' },
          };
          const MACH = { laptop: { name: 'laptop', arch: 'x86-64' }, board: { name: 'board', arch: 'ARM' } };
          let built = null;
          const seen = {};
          const log = h('div', { class: 'log grow', style: { fontSize: '13px', minHeight: '0' } }, h('div', { class: 'cmd' }, '# terminal on the laptop: commands and their output appear here'));
          const narr = h('div', { class: 'narr', style: { minHeight: '70px' }, html: 'Step 1: compile <code>hello.c</code> with one of the two compilers. The program is the same either way; only the machine code differs.' });
          const runBtns = [];
          const out = h('table', { class: 'tbl compact outc' });
          function line(txt, cls) { log.append(h('div', { class: cls || '' }, txt)); log.scrollTop = log.scrollHeight; }
          function paintOut() {
            const cell = (b, m) => { const r = seen[b + m]; return h('td', { class: 'center b', style: { color: r === undefined ? 'var(--muted)' : r ? 'var(--ok)' : 'var(--bad)' } }, r === undefined ? '?' : r ? '✓ runs' : '✗ no'); };
            out.replaceChildren(
              h('thead', {}, h('tr', {}, h('th', {}, 'Built with'), h('th', {}, 'laptop'), h('th', {}, 'board'))),
              h('tbody', {}, ...['gcc', 'cross'].map((b) => h('tr', { class: built === b ? 'on' : '' }, h('td', { class: 'b' }, BIN[b].label), cell(b, 'laptop'), cell(b, 'board')))));
          }
          function compile(b) {
            built = b;
            line('laptop$ ' + BIN[b].cmd, 'cmd'); line('laptop$ file hello', 'cmd'); line(BIN[b].file, 'res');
            runBtns.forEach((x) => { x.disabled = false; });
            narr.className = 'narr';
            narr.innerHTML = b === 'gcc'
              ? 'Built with the host’s own compiler: the file holds <b>x86-64</b> machine code. Step 2: run it on the laptop or on the board.'
              : 'Built with the cross-compiler: the same source, but the file holds <b>32-bit ARM</b> machine code, linked against the ARM build of the C library. Step 2: run it somewhere.';
            paintOut();
          }
          function run(m) {
            const ok = BIN[built].arch === MACH[m].arch;
            seen[built + m] = ok;
            if (m === 'board') { line('laptop$ scp hello root@board:/tmp/', 'cmd'); line('board# /tmp/hello', 'cmd'); }
            else line('laptop$ ./hello', 'cmd');
            if (ok) line('hello', 'res');
            else if (m === 'laptop') line('bash: ./hello: cannot execute binary file: Exec format error', 'err');
            else line('(the kernel refuses to start it: Exec format error)', 'err');
            narr.className = 'narr ' + (ok ? 'ok' : 'bad');
            narr.innerHTML = ok
              ? (m === 'laptop' ? 'Runs: x86-64 code on an x86-64 processor. Handy for testing logic, but this file is useless to the router.'
                : '<b>Built on the host, runs on the target.</b> This is the everyday workflow of embedded Linux development.')
              : `Refused. The kernel reads the file’s ELF header (the label at the start of every Linux program), sees <b>${BIN[built].arch}</b> code, and this ${MACH[m].name} executes <b>${MACH[m].arch}</b> instructions, so it will not even start the program.` + (m === 'laptop' ? ' (An emulator such as QEMU can run ARM programs on a PC for testing.)' : '');
            paintOut();
          }
          ['laptop', 'board'].forEach((m) => {
            const b = h('button', { class: 'btn sm', type: 'button', disabled: true, onclick: () => run(m) }, m === 'laptop' ? 'Run on the laptop (x86-64)' : 'Copy to the board (ARM) and run');
            runBtns.push(b);
          });
          paintOut();
          card.append(
            h('h4', { class: 'm0' }, 'Try it: build hello.c, then run it'),
            code,
            h('div', { class: 'row gap-s' }, h('span', { class: 'small b', style: { width: '74px' } }, '1 · Build'),
              h('button', { class: 'btn sm', type: 'button', onclick: () => compile('gcc') }, 'gcc (the host’s own)'),
              h('button', { class: 'btn sm', type: 'button', onclick: () => compile('cross') }, 'arm-linux-gnueabihf-gcc')),
            h('div', { class: 'row gap-s' }, h('span', { class: 'small b', style: { width: '74px' } }, '2 · Run'), ...runBtns),
            h('div', { class: 'x-row grow' + (ctx.narrow ? ' slim' : '') }, log, out),
            narr);
        },
      },

      /* ---------------- 3. Image builder lab ---------------- */
      {
        title: 'Lab: build a firmware image that fits the flash',
        kind: 'lab',
        render(el, ctx) {
          const { h } = ctx;
          const o = { feat: { net: true, usb: true, gui: false, py: false }, libc: 'glibc', tools: 'gnu', squash: false, flash: 8 };
          const F = SZ.feat;
          const EXPLAIN = {
            start: '<b>Challenge:</b> this router image was put together like a desktop system and does not fit its 8 MB flash chip. Keep <b>Networking</b> switched on and make it fit. Every change is explained here.',
            net: (on) => on ? `<b>Networking on.</b> The kernel gains its ${F.net.kTxt} (+${F.net.k} MB) and the image gains ${F.net.uTxt} (+${F.net.u} MB before compression).`
              : '<b>Networking off.</b> Switched-off kernel features are simply not compiled in, so they cost nothing. The kernel is configured option by option (for example with <code>make menuconfig</code>).',
            usb: (on) => on ? `<b>USB on.</b> +${F.usb.k} MB of kernel code (${F.usb.kTxt}) and +${F.usb.u} MB of ${F.usb.uTxt}.` : '<b>USB off.</b> A router without a USB port needs none of this; on a desktop it is always there “just in case”.',
            gui: (on) => on ? `<b>Touch GUI on.</b> +${F.gui.k} MB of ${F.gui.kTxt} in the kernel, and +${F.gui.u} MB for ${F.gui.uTxt}: graphics are expensive in flash.` : '<b>GUI off.</b> Most embedded Linux devices are headless: they are managed through a web page or a network protocol.',
            py: (on) => on ? `<b>Python 3 on.</b> +${F.py.u} MB for ${F.py.uTxt}: often the largest single item. Devices short of flash write such logic in C or use a tiny scripting language such as Lua.` : '<b>Python 3 off.</b> Convenient languages are a luxury when the whole chip holds a few megabytes.',
            glibc: `<span class="t" data-t="glibc">glibc</span>: the desktop C library. Complete and fast, but the biggest: ${SZ.libc.glibc} MB here. Pick it when you need full compatibility with desktop software.`,
            musl: `<span class="t">musl</span>: ${SZ.libc.musl} MB here. Written from scratch for correctness and easy static linking; the standard C library of OpenWrt and Alpine Linux.`,
            uclibc: `<span class="t">uClibc-ng</span>: ${SZ.libc.uclibc} MB here. Very configurable and supports processors without an MMU. (newlib, another small C library, mostly serves bare-metal firmware and small RTOSes, not Linux.)`,
            gnu: `<b>GNU tools</b>: about ${SZ.tools.gnu} MB of separate programs (coreutils, bash, util-linux, grep, sed, tar...), each with every option.`,
            busybox: `<span class="t">BusyBox</span>: about ${SZ.tools.busybox} MB for hundreds of commands in <b>one</b> program. <code>/bin/ls</code>, <code>/bin/cp</code> and <code>/bin/sh</code> are links to <code>/bin/busybox</code>; it reads <code>argv[0]</code>, the name it was started under, and runs that built-in command. Shared code is stored once and rare options are left out.`,
            plain: 'Root file system stored <b>uncompressed</b>: simple, but every byte of every program occupies flash at full size.',
            squash: `<span class="t">squashfs</span>: the <span class="t">root file system</span> is packed into one compressed, read-only image when the firmware is built, here to ${SZ.squash * 100}% of its size (real ratios depend on content). The kernel is already compressed, so it does not shrink again. Settings then need a small writable partition (step 5).`,
            flash: (n) => `<b>${n} MB flash chip.</b> Flash is chosen for cost: on a product shipped by the million, a smaller chip saves real money, so firmware teams fight for every megabyte.`,
          };
          const explain = h('div', { class: 'narr grow', style: { minHeight: '0', overflow: 'hidden' } });
          function say(html) { explain.innerHTML = html; explain.classList.remove('fade-in'); void explain.offsetWidth; explain.classList.add('fade-in'); }
          const featBtns = Object.keys(F).map((k) => {
            const b = h('button', { class: 'btn sm', type: 'button', 'aria-pressed': String(o.feat[k]), onclick: () => { o.feat[k] = !o.feat[k]; b.setAttribute('aria-pressed', String(o.feat[k])); say(EXPLAIN[k](o.feat[k])); paint(); } }, F[k].label);
            return b;
          });
          const segLib = ctx.ui.seg([{ value: 'glibc', label: 'glibc' }, { value: 'musl', label: 'musl' }, { value: 'uclibc', label: 'uClibc-ng' }], o.libc, (v) => { o.libc = v; say(EXPLAIN[v]); paint(); });
          const segTools = ctx.ui.seg([{ value: 'gnu', label: 'GNU tools' }, { value: 'busybox', label: 'BusyBox' }], o.tools, (v) => { o.tools = v; say(EXPLAIN[v]); paint(); });
          const segFs = ctx.ui.seg([{ value: false, label: 'Uncompressed' }, { value: true, label: 'squashfs' }], o.squash, (v) => { o.squash = v; say(EXPLAIN[v ? 'squash' : 'plain']); paint(); });
          const segFlash = ctx.ui.seg([8, 16, 32, 64].map((n) => ({ value: n, label: n + ' MB' })), o.flash, (v) => { o.flash = v; say(EXPLAIN.flash(v)); paint(); });
          const crow = (label, ...kids) => h('div', { class: 'crow' }, h('span', { class: 'small b' }, label), h('div', { class: 'row gap-s' }, ...kids));
          const total = h('div', { class: 'big', style: { lineHeight: '1' } });
          const of = h('div', { class: 'small muted' });
          const verdict = h('span', { class: 'chip' });
          const chal = h('span', { class: 'chip' });
          const bar = h('div', { class: 'imgbar' });
          const legend = h('table', { class: 'tbl compact img-leg' });
          const desk = h('div', { class: 'small' });
          const bin = h('div', { class: 'card tight stack bin', style: { gap: '4px' } });
          const MB2 = (v) => v.toFixed(2);
          function paint() {
            const r = imageSize(o);
            const fits = r.total <= o.flash + 1e-9;
            total.textContent = MB2(r.total) + ' MB';
            of.textContent = `stored in a ${o.flash} MB flash chip`;
            verdict.className = 'chip ' + (fits ? 'ok' : 'bad');
            verdict.textContent = fits ? `✓ fits · ${MB2(o.flash - r.total)} MB spare` : `✗ too big by ${MB2(r.total - o.flash)} MB`;
            const won = fits && o.feat.net && o.flash === 8;
            chal.className = 'chip ' + (won ? 'ok' : 'warn');
            chal.textContent = won ? '✓ challenge met: networking, 8 MB' : 'challenge: networking on, fit 8 MB';
            const scale = Math.max(o.flash, r.total);
            bar.replaceChildren(
              ...r.parts.filter((p) => p.mb > 0).map((p) => h('i', { class: 'seg-' + p.cls, style: { width: (p.mb / scale) * 100 + '%' }, title: p.label })),
              h('b', { class: 'cap' + (fits ? '' : ' over'), style: { left: (o.flash / scale) * 100 + '%' } }, h('span', {}, o.flash + ' MB chip')));
            const kFeat = Object.keys(F).filter((k) => o.feat[k] && F[k].k > 0).map((k) => F[k].label.toLowerCase());
            const what = {
              kernel: 'core' + (kFeat.length ? ' + ' + kFeat.join(', ') : '') + ' (already compressed)',
              libc: { glibc: 'glibc', musl: 'musl', uclibc: 'uClibc-ng' }[o.libc],
              tools: o.tools === 'busybox' ? 'one program, hundreds of commands' : 'coreutils, bash, util-linux, ...',
              apps: Object.keys(F).filter((k) => o.feat[k] && F[k].u > 0).map((k) => F[k].uTxt).join('; ') || 'none',
              base: '/etc files, start-up scripts',
            };
            legend.replaceChildren(h('tbody', {}, ...r.parts.map((p) => h('tr', {},
              h('td', {}, h('span', { class: 'sw seg-' + p.cls })),
              h('td', { class: 'b' }, p.label),
              h('td', { class: 'num' }, MB2(p.mb) + ' MB'),
              h('td', { class: 'small muted' }, what[p.key])))));
            bin.innerHTML = o.tools === 'busybox'
              ? '<div class="xs muted b">WHAT /bin LOOKS LIKE WITH BUSYBOX</div><div class="mono bin-ls"><span><b>busybox</b></span><span>ls → busybox</span><span>cp → busybox</span><span>sh → busybox</span><span>cat → busybox</span><span>mount → busybox</span></div><div class="small">One real program. Typing <code>ls</code> starts <code>/bin/busybox</code> with <code>argv[0] = "ls"</code>, so it runs its built-in ls.</div>'
              : '<div class="xs muted b">WHAT /bin LOOKS LIKE WITH GNU TOOLS</div><div class="mono bin-ls"><span>ls</span><span>cp</span><span>cat</span><span>mount</span><span>bash</span><span>sh → bash</span></div><div class="small">Each command is a separate program file with its own copy of option parsing, messages and help text.</div>';
            desk.innerHTML = `For comparison, a desktop distribution typically fills about <b>${commas(SZ.desktop)} MB</b> of disk: roughly <b>${commas(SZ.desktop / r.total)}×</b> this image. <span class="muted">(Illustrative sizes, rounded: real ones depend on versions, processor and configuration.)</span>`;
          }
          say(EXPLAIN.start);
          paint();
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'card stack', style: { gap: '9px' } },
              h('h4', { class: 'm0' }, 'Choose what goes into the image'),
              crow('Features', ...featBtns),
              crow('C library', segLib),
              crow('Commands', segTools),
              crow('Root FS', segFs),
              crow('Flash chip', segFlash),
              explain),
            h('div', { class: 'stack', style: { gap: '10px' } },
              h('div', { class: 'row', style: { alignItems: 'flex-end', justifyContent: 'space-between' } },
                h('div', { class: 'stack', style: { gap: '4px' } }, h('span', { class: 'xs muted b' }, 'FIRMWARE IMAGE · ILLUSTRATIVE SIZES'), total, of),
                h('div', { class: 'stack', style: { gap: '6px', alignItems: 'flex-end' } }, verdict, chal)),
              bar,
              legend,
              bin,
              desk)));
        },
      },

      /* ---------------- 4. Flash: erase blocks and wear leveling ---------------- */
      {
        title: 'Flash is not a disk: erase blocks and wear',
        kind: 'explore',
        core: true,
        render(el, ctx) {
          const { h } = ctx;
          /* ---- left: one byte inside an erase block ---- */
          const BLOCK_KB = 128;
          let cur = [1, 0, 1, 0, 0, 1, 0, 1], tgt = cur.slice(), byteErases = 0;
          const hex = (b) => '0x' + parseInt(b.join(''), 2).toString(16).toUpperCase().padStart(2, '0');
          const curRow = h('div', { class: 'bits' }), tgtRow = h('div', { class: 'bits' });
          const curHex = h('span', { class: 'mono small b' }), tgtHex = h('span', { class: 'mono small b' });
          const bmsg = h('div', { class: 'narr', style: { minHeight: '66px' }, html: 'Click bits in the lower row to choose a new value, then try to <b>program</b> it.' });
          function paintBits() {
            curRow.replaceChildren(...cur.map((v) => h('span', { class: 'bit' }, String(v))));
            tgtRow.replaceChildren(...tgt.map((v, i) => {
              const ch = v !== cur[i] ? (v === 0 ? ' clr' : ' set') : '';
              return h('button', { class: 'bit btnbit' + ch, type: 'button', 'aria-label': 'bit ' + (7 - i) + ' is ' + v, onclick: () => { tgt[i] = 1 - tgt[i]; paintBits(); } }, String(v));
            }));
            curHex.textContent = hex(cur); tgtHex.textContent = hex(tgt);
          }
          function program() {
            const ups = [], downs = [];
            tgt.forEach((v, i) => { if (v !== cur[i]) (v ? ups : downs).push(7 - i); });
            if (!ups.length && !downs.length) { bmsg.className = 'narr'; bmsg.innerHTML = 'Nothing to change: the new value equals the stored one. Flip some bits first.'; return; }
            if (ups.length) {
              bmsg.className = 'narr bad';
              bmsg.innerHTML = `<b>Refused.</b> Bit ${ups.join(', ')} would have to go from 0 to 1, and programming can only clear bits. First the <b>whole ${BLOCK_KB} KB block</b> must be erased, so its other ${commas(BLOCK_KB * 1024 - 1)} bytes must be copied out and written back.`;
              return;
            }
            cur = tgt.slice();
            bmsg.className = 'narr ok';
            bmsg.innerHTML = `<b>Programmed in place.</b> Only 1 → 0 changes (bit ${downs.join(', ')}), which a NOR chip can program directly. Cheap, and no erase was needed.`;
            paintBits();
          }
          function eraseByteBlock() {
            cur = [1, 1, 1, 1, 1, 1, 1, 1]; byteErases++;
            bmsg.className = 'narr warn';
            bmsg.innerHTML = `<b>Block erased</b> (erase number ${byteErases}): this byte and the other ${commas(BLOCK_KB * 1024 - 1)} bytes of the block are now all 1s (0xFF). Now any value can be programmed, but the erase cost time and one unit of the block’s life.`;
            paintBits();
          }
          paintBits();
          const left = h('div', { class: 'stack', style: { gap: '9px' } },
            h('p', { class: 'lead m0' }, 'Programs see flash as a disk, but the chip plays by different rules.'),
            h('ol', { class: 'm0 small rules', html: '<li>Erased flash reads as all 1s. <b>Programming</b> (writing) can only turn 1s into 0s: by the byte on NOR flash, by the page (a few KB) on NAND.</li><li>Turning a 0 back into a 1 needs an <b>erase</b>, and erasing works only on a whole <span class="t">erase block</span>, typically tens of KB to a few MB.</li><li>Each block survives only about 1,000 to 100,000 erases, by chip type. Then it wears out, so <span class="t">wear leveling</span> spreads the erases (right).</li>' }),
            h('div', { class: 'card stack', style: { gap: '7px' } },
              h('h4', { class: 'm0' }, `Try it: one byte inside a ${BLOCK_KB} KB erase block`),
              h('div', { class: 'brow' + (ctx.narrow ? ' slim' : '') }, h('span', { class: 'small b' }, 'In flash'), curRow, curHex),
              h('div', { class: 'brow' + (ctx.narrow ? ' slim' : '') }, h('span', { class: 'small b' }, 'New value'), tgtRow, tgtHex),
              h('div', { class: 'row gap-s' },
                h('button', { class: 'btn sm primary', type: 'button', onclick: program }, 'Program the byte'),
                h('button', { class: 'btn sm', type: 'button', onclick: eraseByteBlock }, 'Erase the whole block'),
                h('span', { class: 'xs muted' }, h('span', { class: 'chip ok' }, '1→0 ok'), ' ', h('span', { class: 'chip bad' }, '0→1 needs erase'))),
              bmsg));

          /* ---- right: wear-leveling simulator ---- */
          const NAMES = { inplace: 'Update in place', dynamic: 'Dynamic leveling', static: 'Static + dynamic' };
          let mode = 'inplace', f = makeFlash(mode), gen = 0, timer = null;
          const results = {};
          const grid = h('div', { class: 'fgrid' }), stats = h('div', { class: 'small' }), res = h('div', { class: 'row gap-s small' });
          const fnarr = h('div', { class: 'narr', style: { minHeight: '92px' } });
          const LET = { cold: 'S', hot: 'R', stale: '×', free: '' };
          function paintFlash() {
            const st = f.st;
            grid.replaceChildren(...st.pages.map((pg, b) => {
              const e = st.erase[b], pct = Math.min(100, (e / FL.E) * 100);
              const cls = 'fblk' + (st.dead === b ? ' dead' : st.lastErased === b ? ' erased' : '') + (st.lastMove && st.lastMove[1] === b ? ' moved' : '');
              return h('div', { class: cls },
                h('div', { class: 'xs b muted center' }, 'B' + b),
                ...pg.map((x) => h('div', { class: 'pg pg-' + x }, LET[x])),
                h('div', { class: 'wear' }, h('i', { class: e >= FL.E ? 'w-bad' : e >= FL.E * 0.7 ? 'w-warn' : 'w-ok', style: { width: pct + '%' } })),
                h('div', { class: 'small b center mono' }, String(e)));
            }));
            const mx = Math.max(...st.erase), mn = Math.min(...st.erase);
            stats.innerHTML = `Updates: <b>${commas(st.updates)}</b> · erases: <b>${commas(st.erases)}</b> · most-worn block: <b>${mx}</b> · least-worn: <b>${mn}</b>` + (mode === 'static' ? ` · static data moved: <b>${st.moves}</b>×` : '');
            res.replaceChildren(h('span', { class: 'b' }, 'Updates until a block wears out:'), ...Object.keys(NAMES).map((m) => h('span', { class: 'chip ' + (results[m] ? 'accent' : '') }, NAMES[m] + ': ' + (results[m] ? commas(results[m]) : '?'))));
          }
          function describe(n) {
            const st = f.st;
            if (st.dead >= 0) {
              results[mode] = st.deadAt;
              fnarr.className = 'narr bad';
              const mx = Math.max(...st.erase), mn = Math.min(...st.erase);
              if (mode === 'inplace') fnarr.innerHTML = `<b>Block ${st.dead} wore out after ${commas(st.deadAt)} updates.</b> Every update erased the same block, while ${FL.B - 1} blocks were never erased. A disk file system that rewrites sectors in place would kill raw flash this way.`;
              else if (mode === 'dynamic') fnarr.innerHTML = `<b>Block ${st.dead} wore out after ${commas(st.deadAt)} updates</b>, ${commas(st.deadAt / lifetime('inplace'))}× longer than in place: each erase now frees ${FL.P} pages, and the erases rotate over blocks 5–7. But blocks 0–4 hold static files and were never erased (least-worn block: ${mn}).`;
              else fnarr.innerHTML = `<b>Block ${st.dead} wore out after ${commas(st.deadAt)} updates.</b> Static files moved ${st.moves} times, so every block took its share (erase counts ${mn}–${mx}). The ideal is ${FL.B} × ${FL.E} × ${FL.P} = ${commas(FL.B * FL.E * FL.P)}: the moves cost erases, and ${commas(FL.B * FL.E - st.erases)} erases were left unused.`;
              return;
            }
            fnarr.className = 'narr';
            if (mode === 'inplace') { fnarr.innerHTML = `${n > 1 ? n + ' updates' : 'One update'}: the record (R) lives in page 0 of block 5. Its new value needs some 0 → 1 changes, so the <b>whole block is erased</b> and rewritten every time. Block 5 now has ${st.erase[5]} erase${st.erase[5] === 1 ? '' : 's'}; no other block has any.`; return; }
            const [hb, hp] = st.hot;
            let t = `${n > 1 ? 'After ' + n + ' updates, the' : 'The'} newest copy of the record is in block ${hb}, page ${hp}: each new copy goes to the <b>next free page</b> and the old one is only marked stale (×). `;
            if (st.lastMove) t += `<b>Static leveling:</b> block ${st.lastMove[1]} was ${FL.T}+ erases ahead of block ${st.lastMove[0]}, so the static files moved into the worn block and the barely-worn one joined the rotation. `;
            else if (st.lastErased >= 0) t += `Block ${st.lastErased} held only stale copies, so it was erased and reused (garbage collection). `;
            t += mode === 'dynamic' ? 'Only blocks 5–7 ever take erases.' : `Static data moved ${st.moves}× so far.`;
            fnarr.innerHTML = t;
          }
          function stopRun() { gen++; if (timer) { clearInterval(timer); timer = null; } }
          function doUpdates(n) {
            stopRun();
            let k = 0;
            while (k < n && f.update()) k++;
            if (k === 0 && f.st.dead >= 0) { describe(0); paintFlash(); return; }
            describe(k); paintFlash();
          }
          function runToEnd() {
            stopRun();
            const g = gen, chunk = Math.max(1, Math.ceil(lifetime(mode) / 60));
            fnarr.className = 'narr'; fnarr.innerHTML = 'Running the same update over and over...';
            timer = ctx.every(40, () => {
              if (g !== gen) return;
              let k = 0;
              while (k < chunk && f.update()) k++;
              if (f.st.dead >= 0) { stopRun(); describe(0); } else fnarr.innerHTML = `Running the same update over and over... <b>${commas(f.st.updates)}</b> updates so far.`;
              paintFlash();
            });
          }
          function reset() { stopRun(); f = makeFlash(mode); fnarr.className = 'narr'; fnarr.innerHTML = `<b>${NAMES[mode]}.</b> ` + (mode === 'inplace' ? 'The record is overwritten where it is, as a disk file system would do.' : mode === 'dynamic' ? 'Every update is written to a fresh page; full blocks of stale copies are erased and reused, least-worn first.' : 'Like dynamic leveling, but static files are moved out of barely-worn blocks when the gap in erase counts reaches ' + FL.T + '.') + ' Press <b>+1 update</b>.'; paintFlash(); }
          const segMode = ctx.ui.seg(Object.keys(NAMES).map((m) => ({ value: m, label: NAMES[m] })), mode, (v) => { mode = v; reset(); });
          reset();
          const right = h('div', { class: 'card stack', style: { gap: '8px' } },
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'Toy chip: 8 erase blocks × 4 pages'), h('span', { class: 'xs muted' }, `each block survives ${FL.E} erases (real chips: far more)`)),
            segMode,
            h('div', { class: 'row gap-s' },
              h('button', { class: 'btn sm primary', type: 'button', onclick: () => doUpdates(1) }, '+1 update'),
              h('button', { class: 'btn sm', type: 'button', onclick: () => doUpdates(10) }, '+10'),
              h('button', { class: 'btn sm', type: 'button', onclick: runToEnd }, 'Run until a block wears out'),
              h('button', { class: 'btn sm ghost', type: 'button', onclick: reset }, 'Reset')),
            grid,
            h('div', { class: 'row gap-s xs' }, h('span', { class: 'pg pg-cold key' }, 'S'), 'static files', h('span', { class: 'pg pg-hot key' }, 'R'), 'the record, newest copy', h('span', { class: 'pg pg-stale key' }, '×'), 'stale copy', h('span', { class: 'pg pg-free key' }), 'erased (free)'),
            stats, fnarr, res);
          el.append(h('div', { class: 'split l fill' }, left, right));
        },
      },

      /* ---------------- 5. Choosing a flash file system ---------------- */
      {
        title: 'Choosing a file system for flash',
        kind: 'compare',
        html: `
          <div class="split fill">
            <div class="stack" style="gap:9px">
              <p class="lead m0">First question: does Linux see the raw flash chip, or a controller that hides it?</p>
              <div class="paths">
                <div class="path">
                  <div class="xs b muted">RAW FLASH ON THE BOARD</div>
                  <div class="lay os"><span class="t">JFFS2</span> · <span class="t">UBIFS</span> (on UBI) · <span class="t">YAFFS2</span></div>
                  <div class="arr">↓</div>
                  <div class="lay os"><span class="t" data-t="MTD">MTD</span> layer: read, program, erase</div>
                  <div class="arr">↓</div>
                  <div class="lay io">raw NAND or NOR chip</div>
                  <p class="small m0">The <b>file system</b> must level wear, avoid bad blocks and never overwrite in place.</p>
                </div>
                <div class="path">
                  <div class="xs b muted">MANAGED FLASH (eMMC, SD, SSD)</div>
                  <div class="lay os">ext4 · F2FS</div>
                  <div class="arr">↓</div>
                  <div class="lay os">block layer: numbered sectors</div>
                  <div class="arr">↓</div>
                  <div class="lay io">controller running an <span class="t" data-t="FTL">FTL</span> → NAND</div>
                  <p class="small m0">The <b>controller</b> levels wear; Linux sees ordinary rewritable sectors.</p>
                </div>
              </div>
              <p class="small m0"><b>Read-only images</b> (<span class="t">squashfs</span>, and the older cramfs) suit either path: nothing is ever rewritten, so wear is no issue.</p>
              <div class="callout why m0 small" data-label="Why not ext4 on raw flash?">ext4 rewrites blocks in place and knows nothing about erase blocks, wear or bad blocks: the “update in place” disaster of the previous step. On a raw chip it needs a block-emulation layer that rewrites a whole erase block for every small write.</div>
            </div>
            <div class="fs-tabs" style="min-height:0"></div>
          </div>`,
        render(el, ctx) {
          const { h } = ctx;
          const OPTS = ['squashfs', 'JFFS2', 'UBIFS', 'ext4 or F2FS'];
          const SCEN = [
            { t: 'Home router firmware', d: 'The root file system never changes in normal use; an upgrade replaces the whole image. The 16 MB raw flash chip must hold as much software as possible.', a: 0,
              fb: ['<b>squashfs.</b> Compressed and read-only, built once with the firmware: the most software per megabyte, and since nothing is rewritten, nothing wears. Settings go in a small separate writable partition.',
                'JFFS2 can write, but the root never changes, so that ability is wasted, and JFFS2 compresses less tightly than a squashfs image built in one go.',
                'UBIFS is built for large, busy NAND chips; here the root is never written, so a compressed read-only image packs more into 16 MB.',
                'ext4 needs a block device with a controller, and it stores files uncompressed: the opposite of what a tiny raw chip needs.'] },
            { t: 'Smart TV with 16 GB of eMMC', d: 'The eMMC chip’s own controller levels wear and hides erase blocks. Installed apps and their data need an ordinary read-write file system.', a: 3,
              fb: ['squashfs is read-only. It could hold the unchanging system files, but apps and their data must be writable.',
                'JFFS2 needs raw access to the flash chip through MTD. An eMMC chip only offers numbered sectors behind its controller.',
                'UBIFS runs on UBI, which needs the raw chip. eMMC hides its erase blocks, so there is nothing for UBI to manage.',
                '<b>ext4 or F2FS.</b> Managed flash looks like a disk, and the controller’s FTL already does wear leveling, so a normal Linux file system fits. F2FS writes in long sequential runs, which suits flash especially well.'] },
            { t: 'Data logger with 1 GB of raw NAND', d: 'Measurements are appended all day long, and the logger must be ready a few seconds after power-on.', a: 2,
              fb: ['squashfs is read-only: the log could never be written.',
                'JFFS2 would level wear, but it scans the whole chip every time it is mounted; on 1 GB that takes far too long and uses a lot of RAM.',
                '<b>UBIFS.</b> UBI spreads erases across the whole 1 GB chip and handles bad blocks, and UBIFS keeps its index on flash, so mounting does not need to scan everything.',
                'ext4 has no idea about erase blocks or wear, and a raw NAND chip has no controller to hide them. The busy log area would wear out quickly.'] },
            { t: 'Settings on a small NOR chip', d: 'A 512 KB partition on a raw NOR chip holds a few configuration files that change now and then.', a: 1,
              fb: ['squashfs is read-only, so the settings could not be saved.',
                '<b>JFFS2.</b> A small raw partition with occasional writes is exactly its home: scanning 512 KB at mount is quick, and it levels wear and compresses.',
                'UBI and UBIFS reserve several erase blocks for their own bookkeeping; on a partition this small that overhead eats much of the space.',
                'ext4 needs a block device with a controller; on raw NOR it would rewrite whole erase blocks in place.'] },
            { t: 'Gateway booting from a microSD card', d: 'A small industrial computer runs a full Debian-style system from a 32 GB microSD card; packages are installed and updated in place.', a: 3,
              fb: ['squashfs would make every package update rebuild and rewrite an image; a read-write file system is the natural fit here.',
                'JFFS2 needs raw flash through MTD; an SD card only shows sectors behind its controller.',
                'UBIFS needs UBI on a raw chip; an SD card hides its erase blocks inside the card.',
                '<b>ext4 or F2FS.</b> An SD card is managed flash: its controller handles erase blocks and wear, so the standard file systems work.'] },
          ];
          const pick = {}, first = {};
          let cur = 0;
          function game(panel) {
            const dots = h('div', { class: 'row gap-s' });
            const title = h('h3', { class: 'm0' }), desc = h('p', { class: 'm0' });
            const btns = OPTS.map((o, i) => h('button', { class: 'btn', type: 'button', onclick: () => choose(i) }, o));
            const fb = h('div', { class: 'narr', style: { minHeight: '112px' } });
            const score = h('span', { class: 'small muted' });
            const prev = h('button', { class: 'btn sm', type: 'button', onclick: () => go(cur - 1) }, '← Previous');
            const next = h('button', { class: 'btn sm', type: 'button', onclick: () => go(cur + 1) }, 'Next device →');
            function choose(i) {
              if (first[cur] === undefined) first[cur] = i === SCEN[cur].a;
              pick[cur] = i; paint();
            }
            function go(i) { cur = Math.max(0, Math.min(SCEN.length - 1, i)); paint(); }
            function paint() {
              const sc = SCEN[cur], p = pick[cur];
              dots.replaceChildren(...SCEN.map((x, i) => h('button', { class: 'btn sm' + (i === cur ? ' on' : ''), type: 'button', 'aria-label': 'device ' + (i + 1), onclick: () => go(i), style: { minWidth: '34px', color: first[i] === undefined ? '' : first[i] ? 'var(--ok)' : 'var(--bad)' } }, first[i] === undefined ? String(i + 1) : first[i] ? '✓' : '✗')));
              title.textContent = `Device ${cur + 1}: ${sc.t}`;
              desc.textContent = sc.d;
              btns.forEach((b, i) => { b.classList.toggle('on', p === i); b.style.borderColor = p === i ? (i === sc.a ? 'var(--ok)' : 'var(--bad)') : ''; });
              if (p === undefined) { fb.className = 'narr'; fb.innerHTML = 'Which file system would you put on this flash? Think about the two questions: raw chip or controller? Must it be written?'; }
              else { fb.className = 'narr ' + (p === sc.a ? 'ok' : 'bad'); fb.innerHTML = (p === sc.a ? '' : '<b>Not the best choice.</b> ') + sc.fb[p] + (p === sc.a ? '' : ' Try another.'); }
              const n = Object.values(first).filter(Boolean).length, done = Object.keys(first).length;
              score.textContent = `${n} of ${done} right on the first try` + (done === SCEN.length ? ' · all five devices done' : '');
              prev.disabled = cur === 0; next.disabled = cur === SCEN.length - 1;
            }
            paint();
            panel.append(h('div', { class: 'stack fill', style: { gap: '9px' } },
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, dots, score),
              title, desc,
              h('div', { class: 'grid-4 fs-opts' }, ...btns),
              fb,
              h('div', { class: 'grow', style: { minHeight: '0' } }, ctx.ui.reveal('Show a quick decision guide', '<ol class="m0 small" style="padding-left:20px"><li>Never written after the build? → <b>squashfs</b> (cramfs on older systems).</li><li>Behind a controller (eMMC, SD, SSD)? → <b>ext4</b> or <b>F2FS</b>.</li><li>Raw NAND, large or busy? → <b>UBIFS</b> on UBI (YAFFS2 in some older products).</li><li>A small raw partition, often NOR? → <b>JFFS2</b>.</li></ol>')),
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, prev, next)));
          }
          const TABLE = `<table class="tbl compact fs-tbl">
            <thead><tr><th>File system</th><th>Writes?</th><th>Runs on</th><th>Key points</th></tr></thead>
            <tbody>
              <tr><td class="b">cramfs</td><td>no</td><td>any</td><td>Older, simple, compressed; files up to 16 MB. Largely replaced by squashfs.</td></tr>
              <tr><td class="b">squashfs</td><td>no</td><td>any</td><td>Compressed (gzip, xz, zstd...), built in one go. The usual root of routers and cameras.</td></tr>
              <tr><td class="b">JFFS2</td><td>yes</td><td>raw NOR or NAND</td><td>Writes every change to a new place, levels wear, compresses. Scans the whole chip at mount: best for small partitions.</td></tr>
              <tr><td class="b">YAFFS2</td><td>yes</td><td>raw NAND</td><td>Designed for NAND; used in early Android phones. Kept outside the mainline kernel.</td></tr>
              <tr><td class="b">UBIFS</td><td>yes</td><td>raw NAND, via UBI</td><td>UBI levels wear over the whole chip; index kept on flash, so fast mounts. JFFS2’s successor for NAND.</td></tr>
              <tr><td class="b">ext4</td><td>yes</td><td>managed flash, disks</td><td>The standard journaling Linux file system; relies on the controller for wear leveling.</td></tr>
              <tr><td class="b">F2FS</td><td>yes</td><td>managed flash</td><td>Log-structured, written in long sequential runs to suit flash; common on phone data partitions.</td></tr>
            </tbody></table>`;
          ctx.$('.fs-tabs').append(ctx.ui.tabs([
            { label: 'Choose for five devices', render: game },
            { label: 'All seven at a glance', html: TABLE },
          ]));
        },
      },

      /* ---------------- 6. Why Linux, and Android ---------------- */
      {
        title: 'Why Linux? And Android, the biggest embedded Linux',
        kind: 'learn',
        html: `
          <div class="split l fill">
            <div class="stack" style="gap:8px">
              <p class="lead m0">Why do device makers choose Linux at all?</p>
              <div class="adv"><b>Vendor independence.</b> The source is public and many companies support it, so a product is not tied to one OS supplier’s prices, plans or survival.</div>
              <div class="adv"><b>Varied hardware support.</b> ARM, x86, RISC-V, MIPS, PowerPC and more, with thousands of drivers in the mainline kernel; chip makers usually ship Linux support for new processors.</div>
              <div class="adv"><b>Low cost.</b> No license fee per device and free tools. The real costs are engineering time and years of security updates.</div>
              <div class="adv"><b><span class="t">Open source</span>.</b> Every line can be read, debugged and changed. The kernel’s GPL license (<span class="t">copyleft</span>) requires sharing your kernel changes when you ship them.</div>
              <div class="callout warn m0 small" data-label="The price">Linux needs megabytes of RAM, not kilobytes, and most of it assumes an MMU (MMU-less builds exist: next step), so the tiniest <span class="t">microcontrollers</span> run an <span class="t" data-t="RTOS">RTOS</span> instead. It is not hard real-time out of the box; <span class="t">PREEMPT_RT</span>, merged in Linux 6.12 (2024), shortens the worst-case delays.</div>
            </div>
            <div class="card stack and-card" style="gap:8px"></div>
          </div>`,
        render(el, ctx) {
          const { h } = ctx;
          const card = ctx.$('.and-card');
          const ROWS = [
            ['Apps', 'Native programs in .deb or .rpm packages', 'APK apps: Java or Kotlin as DEX bytecode',
              'Desktop programs are machine code built for one processor. Android apps ship as bytecode, so one APK can run on ARM and x86 phones alike; the device turns it into machine code.'],
            ['Framework', 'GTK or Qt on Wayland or X11', 'Android framework, drawn by SurfaceFlinger',
              'Android has its own application framework (activities, services, content providers) and its own compositor, SurfaceFlinger. None of the desktop graphics stack is used.'],
            ['Runtime', 'None: programs are machine code', '<span class="t" data-t="Android runtime">ART</span> (replaced Dalvik in Android 5.0)',
              'The Android Runtime (ART) took over from the Dalvik virtual machine in Android 5.0 (2014). It compiles app bytecode to machine code (ahead of time and while running) and manages app memory with a garbage collector.'],
            ['C library, tools', 'glibc; GNU coreutils, bash', '<span class="t" data-t="Bionic libc">Bionic</span> libc; Toybox, mksh shell',
              'Bionic is Android’s own C library. Google wrote it to be small and fast to load on phones and to keep a permissive (BSD-style) license in user space. Toybox plays the role BusyBox plays elsewhere: many commands in one program.'],
            ['Start-up, IPC', 'systemd; D-Bus messages', 'Android’s own init; <span class="t" data-t="Binder">Binder</span> IPC',
              'Android’s init starts the system services and the zygote process that launches apps. Binder IPC (section 6.11) carries calls between apps and services.'],
            ['Kernel', 'Linux', 'Linux + Android patches',
              'The one layer they share, which is why Android counts as an embedded Linux. Phones run a Linux kernel from Google’s common kernel plus the chip maker’s drivers; some Android additions, such as the Binder driver, are now in mainline Linux.'],
          ];
          const detail = h('div', { class: 'narr grow', style: { minHeight: '0' } });
          const slim = ctx.narrow ? ' slim' : '';
          const rowEls = ROWS.map((r, i) => h('button', { class: 'and-row' + slim + (i === ROWS.length - 1 ? ' shared' : ''), type: 'button', onclick: () => show(i) },
            h('span', { class: 'lbl' }, r[0]), h('span', { class: 'cell', html: r[1] }), h('span', { class: 'cell and', html: r[2] })));
          function show(i) {
            rowEls.forEach((b, j) => b.classList.toggle('on', i === j));
            detail.className = 'narr grow' + (i === ROWS.length - 1 ? ' ok' : '');
            detail.innerHTML = `<b>${ROWS[i][0]}.</b> ` + ROWS[i][3];
          }
          card.append(
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'Same kernel, different everything else'), h('span', { class: 'xs muted' }, 'click a layer')),
            h('div', { class: 'and-row head' + slim }, h('span', { class: 'lbl' }), h('span', { class: 'cell' }, 'Desktop GNU/Linux'), h('span', { class: 'cell and' }, h('span', { class: 't' }, 'Android'))),
            ...rowEls,
            detail,
            h('div', { class: 'row gap-s' }, h('span', { class: 'xs muted b' }, 'ANDROID RUNS ON'), ...['phones', 'tablets', 'TVs', 'cars', 'watches'].map((x) => h('span', { class: 'chip proc' }, x)), h('span', { class: 'xs muted' }, 'layers: section 2.11')));
          show(ROWS.length - 1);
        },
      },

      /* ---------------- 7. µClinux: no MMU, no fork ---------------- */
      {
        title: 'Linux without an MMU: µClinux, fork and vfork',
        kind: 'explore',
        core: true,
        html: `
          <div class="split fill">
            <div class="stack" style="gap:8px">
              <p class="lead m0">The smallest chips that run Linux have no <span class="t" data-t="Memory management unit">MMU</span>: every address a program uses is a real, physical address.</p>
              <p class="m0 small"><span class="t">µClinux</span> (microcontroller Linux) started in 1998 as a port of Linux to such chips. Its changes were merged into the main kernel during the 2.5 development series, so since Linux 2.6 (2003) a mainline kernel can be built without MMU support.</p>
              <h4 class="m0">What changes without an MMU</h4>
              <ul class="m0 small nommu">
                <li>No <span class="t">memory protection</span>: a buggy program can overwrite another program, or the kernel.</li>
                <li>No <span class="t">virtual memory</span> or <span class="t">paging</span>: no swapping and no demand paging.</li>
                <li>No <span class="t">fork()</span>: programs start programs with <span class="t">vfork()</span> + <span class="t">exec</span> (try it on the right).</li>
                <li>Programs are relocated to wherever they load (flat or FDPIC binaries); stack sizes are fixed at build time.</li>
                <li>A big request needs one contiguous run of physical memory, so <span class="t">external fragmentation</span> can make it fail although enough memory is free in total.</li>
                <li>Shared libraries are limited; support depends on the binary format.</li>
              </ul>
              <div class="callout warn m0 small" data-label="Common mistake">“fork() needs copy on write.” Copy on write only makes fork() cheap. What fork() truly needs is address translation: without it, even a full copy sits at the wrong addresses.</div>
            </div>
            <div class="card stack mmu-card" style="gap:8px"></div>
          </div>`,
        render(el, ctx) {
          const { h } = ctx;
          const card = ctx.$('.mmu-card');
          const K = { a: '0x00000', b: 'kernel', cls: 'k' };
          const free = (a) => ({ a, b: 'free', cls: 'free' });
          const MODES = {
            mmu: { label: 'fork() with an MMU', frames: [
              { P: { st: 'running', L: ['page → frame', '0x8000 → 40', '0x9000 → 41', 'p = 0x9000 (its buf)'] }, C: null,
                S: [{ a: '', b: 'kernel', cls: 'k' }, { a: 'frame 40', b: 'code', cls: 'p', p: 1 }, { a: 'frame 41', b: 'data + buf', cls: 'p', p: 1 }, { a: 'frame 57', b: 'free', cls: 'free' }, { a: 'frame 58', b: 'free', cls: 'free' }],
                cap: '<b>With an MMU,</b> the parent’s program uses virtual addresses. Its page table maps page 0x8000 (code) to frame 40 and page 0x9000 (data, including its buffer) to frame 41. Its pointer p holds 0x9000.' },
              { P: { st: 'running', L: ['page → frame', '0x8000 → 40', '0x9000 → 41', 'p = 0x9000'] }, C: { st: 'ready', L: ['page → frame (copied)', '0x8000 → 40', '0x9000 → 41', 'p = 0x9000'] },
                S: [{ a: '', b: 'kernel', cls: 'k' }, { a: 'frame 40', b: 'code · shared', cls: 'sh', p: 1, c: 1 }, { a: 'frame 41', b: 'data · shared, read-only', cls: 'sh', p: 1, c: 1 }, { a: 'frame 57', b: 'free', cls: 'free' }, { a: 'frame 58', b: 'free', cls: 'free' }],
                cap: '<b>fork()</b> copies the parent’s page table, not its memory. Both processes map the same frames, now marked read-only for <span class="t">copy on write</span>. The child’s p still says 0x9000.' },
              { P: { st: 'running', L: ['page → frame', '0x8000 → 40', '0x9000 → 41', 'p = 0x9000'] }, C: { st: 'page fault', bad: true, L: ['page → frame', '0x8000 → 40', ['0x9000 → 41', 'bad'], ['write to *p: refused', 'bad']] },
                S: [{ a: '', b: 'kernel', cls: 'k' }, { a: 'frame 40', b: 'code · shared', cls: 'sh', p: 1, c: 1 }, { a: 'frame 41', b: 'data · shared, read-only', cls: 'sh', p: 1, c: 'bad' }, { a: 'frame 57', b: 'free', cls: 'free' }, { a: 'frame 58', b: 'free', cls: 'free' }],
                cap: '<b>The child writes to its buffer</b> through p (address 0x9000). The page is read-only, so the MMU stops the write and raises a page fault: the kernel takes over.' },
              { P: { st: 'running', L: ['page → frame', '0x8000 → 40', '0x9000 → 41', 'p = 0x9000'] }, C: { st: 'running', L: ['page → frame', '0x8000 → 40', ['0x9000 → 57', 'ok'], 'p = 0x9000'] },
                S: [{ a: '', b: 'kernel', cls: 'k' }, { a: 'frame 40', b: 'code · shared', cls: 'sh', p: 1, c: 1 }, { a: 'frame 41', b: 'data + buf (parent)', cls: 'p', p: 1 }, { a: 'frame 57', b: 'data + buf (child’s copy)', cls: 'c', c: 1 }, { a: 'frame 58', b: 'free', cls: 'free' }],
                cap: '<b>Copy on write:</b> the kernel copies frame 41 into a free frame, 57, points the child’s page 0x9000 at it, makes it writable, and lets the child repeat its write.' },
              { P: { st: 'running', L: ['page → frame', '0x8000 → 40', '0x9000 → 41', ['p = 0x9000 → own buf', 'ok']] }, C: { st: 'running', L: ['page → frame', '0x8000 → 40', '0x9000 → 57', ['p = 0x9000 → own buf', 'ok']] },
                S: [{ a: '', b: 'kernel', cls: 'k' }, { a: 'frame 40', b: 'code · shared', cls: 'sh', p: 1, c: 1 }, { a: 'frame 41', b: 'data + buf (parent)', cls: 'p', p: 1 }, { a: 'frame 57', b: 'data + buf (child’s copy)', cls: 'c', c: 1 }, { a: 'frame 58', b: 'free', cls: 'free' }],
                cap: '<b>Why it works:</b> both processes use the <i>same</i> address, 0x9000, and in each one it means its <i>own</i> buffer, because the MMU translates each process’s addresses separately. fork() depends on exactly that.' },
            ] },
            nommu: { label: 'fork() without an MMU', frames: [
              { P: { st: 'running', L: ['no page table', 'loaded at 0x40000', 'p = 0x42000 (its buf)'] }, C: null,
                S: [K, free('0x20000'), { a: '0x40000', b: 'parent: code, data, buf', cls: 'p', p: 1 }, free('0x50000'), free('0x60000')],
                cap: '<b>No MMU:</b> an address is a physical address. The parent was loaded at 0x40000; its buffer sits at 0x42000, and its pointer p holds 0x42000.' },
              { P: { st: 'running', L: ['no page table', 'loaded at 0x40000', 'p = 0x42000'] }, C: { st: 'ready', L: ['a copy at 0x60000', 'p = 0x42000 (copied)'] },
                S: [K, free('0x20000'), { a: '0x40000', b: 'parent: code, data, buf', cls: 'p', p: 1 }, free('0x50000'), { a: '0x60000', b: 'child: byte-for-byte copy', cls: 'c', c: 1 }],
                cap: '<b>Suppose fork() copied the parent anyway.</b> 0x40000 is taken, so the copy must live somewhere else, say 0x60000. Without an MMU nothing can make 0x60000 look like 0x40000 to the child.' },
              { P: { st: 'running', L: ['no page table', 'loaded at 0x40000', 'p = 0x42000'] }, C: { st: 'ready', L: ['a copy at 0x60000', ['p = 0x42000', 'warn'], ['→ inside the parent!', 'warn']] },
                S: [K, free('0x20000'), { a: '0x40000', b: 'parent: code, data, buf', cls: 'p', p: 1, c: 'warn' }, free('0x50000'), { a: '0x60000', b: 'child: byte-for-byte copy', cls: 'c', c: 1 }],
                cap: '<b>A byte-for-byte copy keeps every address.</b> The child’s p still holds 0x42000, which is inside the parent. So do the return addresses on its stack and every other pointer in its data.' },
              { P: { st: 'corrupted', bad: true, L: ['no page table', 'loaded at 0x40000', ['its buf was changed!', 'bad']] }, C: { st: 'running', L: ['a copy at 0x60000', ['writes to *p', 'bad']] },
                S: [K, free('0x20000'), { a: '0x40000', b: 'parent: buf overwritten', cls: 'bad', p: 1, c: 'bad' }, free('0x50000'), { a: '0x60000', b: 'child: byte-for-byte copy', cls: 'c', c: 1 }],
                cap: '<b>The child writes through p,</b> believing it changes its own buffer. It overwrites the parent’s buffer instead, and with no memory protection nothing stops it.' },
              { P: { st: 'corrupted', bad: true, L: ['no page table', 'loaded at 0x40000', ['its buf was changed!', 'bad']] }, C: { st: 'not allowed', bad: true, L: ['a copy at 0x60000', ['writes to *p', 'bad']] },
                S: [K, free('0x20000'), { a: '0x40000', b: 'parent: buf overwritten', cls: 'bad', p: 1, c: 'bad' }, free('0x50000'), { a: '0x60000', b: 'child: byte-for-byte copy', cls: 'c', c: 1 }],
                cap: '<b>So: no fork().</b> The kernel cannot find and fix every address hidden in a copy, and without page faults it cannot share pages copy-on-write either. Linux built without an MMU does not offer fork(); calling it fails.' },
            ] },
            vfork: { label: 'vfork() + exec()', frames: [
              { P: { st: 'running', L: ['loaded at 0x40000', 'wants to run /bin/ls', ['calls vfork()', 'ok']] }, C: null,
                S: [K, free('0x20000'), { a: '0x40000', b: 'parent: code, data, stack', cls: 'p', p: 1 }, free('0x50000'), free('0x60000')],
                cap: '<b>The parent wants to run /bin/ls</b>, as a shell does for every command. It calls <code>vfork()</code>.' },
              { P: { st: 'suspended', warn: true, L: ['loaded at 0x40000', 'waits for the child'] }, C: { st: 'running', L: ['borrows 0x40000', 'no copy made'] },
                S: [K, free('0x20000'), { a: '0x40000', b: 'parent’s memory, lent to child', cls: 'sh', p: 1, c: 1 }, free('0x50000'), free('0x60000')],
                cap: '<b>vfork()</b> creates a child that <i>borrows</i> the parent’s memory, stack included. Nothing is copied, so every address is still right. The parent is suspended until the child stops borrowing.' },
              { P: { st: 'suspended', warn: true, L: ['loaded at 0x40000', 'waits for the child'] }, C: { st: 'running', L: ['borrows 0x40000', ['execve("/bin/ls")', 'ok']] },
                S: [K, free('0x20000'), { a: '0x40000', b: 'parent’s memory, lent to child', cls: 'sh', p: 1, c: 1 }, free('0x50000'), free('0x60000')],
                cap: '<b>The child calls exec at once.</b> The rule: in borrowed memory it must not change the parent’s variables or return from the current function; it may only call exec or <code>_exit</code>.' },
              { P: { st: 'suspended', warn: true, L: ['loaded at 0x40000', 'waits for the child'] }, C: { st: 'running', L: ['own memory at 0x60000', ['ls loaded here', 'ok']] },
                S: [K, free('0x20000'), { a: '0x40000', b: 'parent: code, data, stack', cls: 'p', p: 1 }, free('0x50000'), { a: '0x60000', b: '/bin/ls, relocated here', cls: 'c', c: 1 }],
                cap: '<b>exec</b> loads ls into a free, contiguous piece of memory, here 0x60000, and fixes up the addresses inside it for that spot (relocation), because the program could not know in advance where it would land.' },
              { P: { st: 'running', L: ['loaded at 0x40000', ['memory untouched', 'ok']] }, C: { st: 'running', L: ['own memory at 0x60000', 'running ls'] },
                S: [K, free('0x20000'), { a: '0x40000', b: 'parent: code, data, stack', cls: 'p', p: 1 }, free('0x50000'), { a: '0x60000', b: '/bin/ls, relocated here', cls: 'c', c: 1 }],
                cap: '<b>The parent resumes</b> as soon as exec has given the child its own memory, and finds its memory untouched while ls runs. No copy of the parent was ever needed: this is how shells start commands on Linux without an MMU.' },
            ] },
          };
          let mode = 'mmu';
          const grid = h('div', { class: 'mmu-grid' + (ctx.narrow ? ' slim' : '') });
          function pcard(who, d, cls) {
            if (!d) return h('div', { class: 'pcard empty ' + cls }, h('div', { class: 'small b' }, who), h('div', { class: 'xs muted' }, 'not created yet'));
            return h('div', { class: 'pcard ' + cls },
              h('div', { class: 'row nw', style: { justifyContent: 'space-between', gap: '6px' } }, h('b', {}, who), h('span', { class: 'chip ' + (d.bad ? 'bad' : d.warn ? 'warn' : 'ok') }, d.st)),
              ...d.L.map((x) => { const [t, c] = Array.isArray(x) ? x : [x, '']; return h('div', { class: 'pl mono ' + c }, t); }));
          }
          function draw(i) {
            const f = MODES[mode].frames[i];
            const mark = (v, side) => (v ? h('span', { class: 'mk ' + (v === 1 ? side : v) }, side === 'pm' ? 'P' : 'C') : h('span', { class: 'mk none' }));
            grid.replaceChildren(
              pcard('Parent', f.P, 'par'),
              h('div', { class: 'memcol' }, h('div', { class: 'xs muted b center' }, mode === 'mmu' ? 'PHYSICAL MEMORY (FRAMES)' : 'PHYSICAL MEMORY'),
                ...f.S.map((sl) => h('div', { class: 'slot s-' + sl.cls }, mark(sl.p, 'pm'), h('div', { class: 'sl-t' }, sl.a ? h('span', { class: 'mono xs b' }, sl.a + ' ') : null, h('span', { class: 'small' }, sl.b)), mark(sl.c, 'cm')))),
              pcard('Child', f.C, 'chi'));
            return f.cap;
          }
          const player = ctx.ui.player({ count: 5, render: draw, interval: 3600, speed: false });
          const seg = ctx.ui.seg(Object.keys(MODES).map((m) => ({ value: m, label: MODES[m].label })), mode, (v) => { mode = v; player.stop(); player.go(0); });
          card.append(seg, h('div', { class: 'grow', style: { minHeight: '0' } }, grid),
            h('div', { class: 'row gap-s xs muted' }, h('span', { class: 'mk pm' }, 'P'), 'used by the parent', h('span', { class: 'mk cm' }, 'C'), 'used by the child', h('span', { class: 'mk bad' }, 'C'), 'a forbidden or harmful access'),
            player.el);
        },
      },

      /* ---------------- 8. Recap ---------------- */
      {
        title: 'Recap: eight things to remember',
        kind: 'recap',
        render(el, ctx) {
          el.append(ctx.h('div', { class: 'stack fill' },
            ctx.h('p', { class: 'lead m0' }, 'Say each answer out loud before you flip the card.'),
            ctx.ui.flipcards([
              ['What makes a Linux distribution “embedded”?', 'It is tailored to one device: only the drivers and programs it needs, cross-compiled for its processor, sized to fit its memory and flash. A small C library and BusyBox are common space savers, not requirements.'],
              ['Host, target and cross-compiler?', 'The host (a PC) builds; the target (the device’s processor) runs. A cross-compiler runs on the host but emits target code. Buildroot or Yocto automate the whole build.'],
              ['How does BusyBox save space?', 'One program holds hundreds of commands. Each command name links to it, and it reads argv[0] to decide which command to run; shared code is stored once.'],
              ['Why can’t flash rewrite a byte in place?', 'Programming only turns 1s into 0s. A 0 → 1 change needs an erase, erases work only on whole erase blocks, and each block survives a limited number of them.'],
              ['What does wear leveling do?', 'It spreads erases over all blocks: new copies go to fresh pages (dynamic), and static data is moved off barely-worn blocks (static), so no block dies early.'],
              ['Which flash file system where?', 'squashfs: read-only root image. JFFS2: small raw partitions. UBIFS: large raw NAND. ext4 or F2FS: eMMC, SD and SSDs, whose controller levels wear.'],
              ['Why Linux, and how is Android one?', 'Vendor independence, wide hardware support, no per-device fee, open source. Android keeps the Linux kernel but has its own user space: Bionic, Toybox, init, Binder, ART.'],
              ['Why no fork() without an MMU?', 'A copy must sit at other physical addresses, yet keeps every pointer to the parent’s. µClinux uses vfork(): the child borrows the parent’s memory until it calls exec.'],
            ], { cols: ctx.narrow ? 1 : 4, height: 205 })));
        },
      },

      /* ---------------- 9. Quiz ---------------- */
      {
        title: 'Check yourself',
        kind: 'check',
        quiz: [
          { q: 'Which description best fits an <b>embedded Linux distribution</b>?',
            choices: ['A complete desktop distribution copied unchanged onto a device’s flash chip', 'Linux cut down for one device: only its drivers and programs, built for its processor', 'A separate OS that copies Linux’s commands but runs its own, non-Linux kernel', 'Any ordinary Linux system that happens to run without a keyboard or a screen'],
            answer: 1,
            feedback: ['A desktop distribution would not fit: it needs gigabytes, while many devices have a few megabytes of flash.', null, 'Embedded Linux runs the real Linux kernel; it is the rest of the system that is slimmed and replaced.', 'Having no screen is not the point. A server without a screen still runs a general-purpose distribution.'],
            why: 'An embedded Linux distribution keeps only the kernel features, drivers, libraries and programs one kind of device needs, compiles them for its processor and sizes them to its memory and storage.' },
          { type: 'tf', q: 'A program compiled with the host’s own <code>gcc</code> on an x86-64 PC will run on an ARM router, as long as both run Linux.', answer: false,
            why: 'Machine code belongs to one instruction set. The router’s kernel sees x86-64 code in the file and refuses it (Exec format error). The program must be built with a cross-compiler for ARM, such as arm-linux-gnueabihf-gcc.' },
          { q: 'How can a single BusyBox file act as <code>ls</code>, <code>cp</code> and <code>sh</code>?',
            choices: ['The kernel unpacks a different hidden program from the file for each command', 'Each command is a small shell script that calls BusyBox with a long option list', 'Each command name links to it, and it reads argv[0] to choose the command', 'It copies itself under every command’s name each time the system boots up'],
            answer: 2,
            feedback: ['The kernel just starts the one program; it knows nothing about BusyBox’s commands.', 'No scripts are needed: the links point straight at the BusyBox program.', null, 'Copies would waste exactly the flash BusyBox is meant to save; links cost almost nothing.'],
            why: '/bin/ls, /bin/cp and /bin/sh are links to /bin/busybox. When started, BusyBox looks at argv[0], the name it was started under, and runs the matching built-in command.' },
          { type: 'multi', q: 'Which of these are <b>C libraries</b> used instead of glibc to save space on embedded or mobile Linux?',
            choices: ['musl', 'uClibc-ng', 'BusyBox', 'Bionic', 'squashfs'], answer: [0, 1, 3],
            why: 'musl, uClibc-ng and Android’s Bionic are smaller C libraries. BusyBox provides commands, not the C library, and squashfs is a read-only file system.' },
          { type: 'num', q: 'A flash chip has 128 KB erase blocks (1 KB = 1,024 bytes). A program changes one byte, and one of its bits must go from 0 to 1. How many bytes are erased to make that change?', answer: 131072, tol: 0, unit: 'bytes',
            why: 'A 0 → 1 change needs an erase, and an erase always covers the whole block: 128 × 1,024 = 131,072 bytes. The other 131,071 bytes must be saved first and written back.' },
          { type: 'num', q: 'A flash chip has 8 erase blocks of 4 pages each, and every block survives 100 erases. If wear were spread perfectly and every erase made room for 4 new single-page updates, how many updates could the chip absorb before its blocks wear out?', answer: 3200, tol: 0, unit: 'updates',
            why: '8 blocks × 100 erases × 4 pages per erase = 3,200 updates. Real wear leveling only gets close to this: moving static data costs extra erases, and when the first block wears out the others usually have a little life left.' },
          { type: 'match', q: 'Match each file system to the job it suits best.',
            pairs: [['squashfs', 'Read-only, compressed root image built with the firmware'], ['JFFS2', 'Small read-write partition on a raw NOR chip'], ['UBIFS', 'Large, busy raw NAND chip that must mount quickly'], ['ext4 or F2FS', 'eMMC or SD card whose own controller levels wear']],
            why: 'Read-only images use squashfs. On raw flash the file system must handle wear: JFFS2 for small partitions, UBIFS (on UBI) for large NAND. Managed flash hides erase blocks, so ordinary file systems such as ext4 or F2FS work.' },
          { type: 'bucket', q: 'Who levels the wear in each setup?', buckets: ['Linux (file system or UBI)', 'The storage device’s controller (FTL)'],
            items: [['UBIFS on a raw NAND chip', 0], ['ext4 on a smart TV’s eMMC', 1], ['JFFS2 on a raw NOR chip', 0], ['F2FS on a microSD card', 1], ['ext4 on an SSD', 1], ['YAFFS2 on raw NAND', 0]],
            why: 'On raw flash, Linux sees the chip directly, so the flash file system (or UBI) must level wear. eMMC, SD cards and SSDs contain a controller whose flash translation layer does it, and Linux sees ordinary sectors.' },
          { q: 'Why does Linux built for a processor <b>without an MMU</b> not offer <code>fork()</code>?',
            choices: ['Small chips are far too slow to copy a whole process in a reasonable time', 'Without an MMU the kernel cannot run more than one process at a time', 'Without page tables a new process cannot get its own process ID', 'A copy must sit at other addresses, yet its pointers still lead into the parent'],
            answer: 3,
            feedback: ['Speed is not the problem: even a slow, complete copy would still be wrong.', 'µClinux multitasks normally; the scheduler does not need an MMU.', 'Process IDs are kernel bookkeeping and have nothing to do with page tables.', null],
            why: 'With no address translation, the child’s copy must live at different physical addresses, but every pointer copied from the parent still holds the parent’s addresses. The child would read and corrupt the parent’s memory, so vfork() + exec is used instead.' },
          { type: 'order', q: 'Put the steps of starting a new program with <code>vfork()</code> on Linux without an MMU in order.',
            items: ['The parent calls vfork()', 'The child runs in the parent’s borrowed memory while the parent is suspended', 'The child calls exec for the new program', 'The kernel loads the program into free, contiguous memory and relocates it', 'The parent resumes with its memory untouched'],
            why: 'vfork() lends the parent’s memory to the child and suspends the parent. The child immediately calls exec; the kernel loads and relocates the new program elsewhere, and the parent continues.' },
          { q: 'Which part of a desktop GNU/Linux system does <b>Android</b> share?',
            choices: ['The Linux kernel', 'glibc, the GNU C library', 'GNU coreutils and the bash shell', 'The X11 or Wayland display system'],
            answer: 0,
            feedback: [null, 'Android uses its own C library, Bionic.', 'Android uses Toybox and the mksh shell instead.', 'Android draws through its own compositor, SurfaceFlinger.'],
            why: 'Android keeps the Linux kernel (with some Android additions) but replaces the user space: Bionic, Toybox, its own init, Binder IPC, the ART runtime and its app framework.' },
          { type: 'multi', q: 'Which are genuine advantages of embedded Linux?',
            choices: ['Independence from any single OS vendor', 'Support for many processor types and drivers', 'No license fee to pay per device', 'Hard real-time guarantees without any changes', 'Runs in a few kilobytes of RAM'], answer: [0, 1, 2],
            why: 'Linux gives vendor independence, broad hardware support, low cost and open source. It needs megabytes of memory, and it is not hard real-time out of the box (PREEMPT_RT, mainline since 6.12, improves its worst case).' },
        ],
      },
    ],
    notes: `
      <h3>What an embedded Linux distribution is</h3>
      <p>An <b>embedded Linux distribution</b> is Linux tailored to one kind of device: the kernel keeps only the drivers and features that hardware needs, every program is compiled for its processor, and the system is sized to fit its memory and flash.</p>
      <p>Compared with desktop Linux: the kernel holds only this board’s drivers (often 1–3 MB compressed), not thousands of modules; RAM is tens of MB (a few on the smallest systems), not gigabytes; software is cross-compiled on a host PC; and to save flash, constrained systems often swap glibc for musl or uClibc-ng and the GNU commands for BusyBox, although others keep glibc and fuller user-space tools when they need full compatibility and have the room. Those library and command choices are configuration decisions; what makes the system embedded is that it is built around one device’s needs.</p>
      <h3>Building it: host, target and cross-compilation</h3>
      <p>Software is built on a <b>host</b> (usually an x86-64 PC) for a <b>target</b> (the device’s processor: ARM, MIPS, RISC-V). A <b>cross-compiler</b> runs on the host but produces target machine code; with an assembler, linker, the target’s C library and kernel headers it forms a <b>cross toolchain</b>, named after its target, e.g. <code>arm-linux-gnueabihf-gcc</code> (ARM, Linux, GNU C library with ARM calling rules and hardware floating point).</p>
      <p>Machine code belongs to one instruction set: an x86-64 program on an ARM board is refused (“Exec format error”), and an ARM program is refused on the PC unless an emulator such as QEMU runs it. <b>Embedded build systems</b> automate everything: <b>Buildroot</b> (menu-configured; produces kernel and root file system images) and the <b>Yocto Project</b> (layers of recipes run by BitBake, for complete custom distributions).</p>
      <h3>Making the image small</h3>
      <ul>
        <li><b>Kernel configuration</b>: switched-off features are not compiled in and cost nothing.</li>
        <li><b>C library</b>: <b>glibc</b> is complete but the largest. <b>musl</b> is small, written from scratch, easy to link statically (used by OpenWrt and Alpine). <b>uClibc-ng</b> is small, configurable and supports MMU-less processors (it continues uClibc, inactive since about 2012). newlib mostly serves bare-metal and RTOS firmware. Android uses <b>Bionic</b>.</li>
        <li><b>BusyBox</b>: one program with hundreds of slimmed-down commands; <code>/bin/ls</code>, <code>/bin/sh</code>... are links to it, and it reads <code>argv[0]</code> (the name it was started under) to pick the command.</li>
        <li><b>Compression</b>: a <b>squashfs</b> root is packed and compressed at build time (about half here); the kernel is already compressed. Settings need a separate writable partition.</li>
      </ul>
      <p>Worked example (lab’s illustrative sizes): kernel 1.6 + 0.9 networking = 2.5 MB; root = 0.6 musl + 0.9 BusyBox + 0.6 network programs + 0.2 config = 2.3 MB, squashfs at 50% = 1.15 MB; total 3.65 MB, fitting 8 MB of flash. With glibc, GNU tools and no compression: 2.5 + 2.4 + 12 + 0.6 + 0.2 = 17.7 MB.</p>
      <h3>Flash memory: why it is not a disk</h3>
      <ul>
        <li>Erased flash reads as all 1s. <b>Programming</b> can only change 1s into 0s (a byte or word at a time on NOR, a page at a time on NAND).</li>
        <li>Changing a 0 back into a 1 needs an <b>erase</b>, and erases work only on a whole <b>erase block</b> (typically tens of KB to a few MB). Changing one byte in place in a 128 KB block means erasing all 131,072 bytes and writing the others back.</li>
        <li>Each block survives a limited number of erases (roughly 1,000 to 100,000, depending on the chip type).</li>
      </ul>
      <p>A disk file system rewrites in place, so on raw flash it erases the same block again and again (toy chip, 8 blocks × 4 pages, 100 erases each: dead after 100 updates). <b>Wear leveling</b> spreads erases. <b>Dynamic</b>: each new version goes to a fresh page; full blocks of stale copies are erased, least-worn first (1,200 updates, but static-data blocks never share the wear). <b>Static</b>: rarely changed data is also moved off barely-worn blocks (2,820 updates; ideal 8 × 100 × 4 = 3,200, less the erases spent on moves and life left unused in other blocks).</p>
      <h3>Flash file systems</h3>
      <p><b>Raw flash</b> is driven through the kernel’s <b>MTD</b> layer, so the file system must level wear, avoid bad blocks and never overwrite in place. <b>Managed flash</b> (eMMC, SD, USB sticks, SSDs) has a controller whose <b>flash translation layer (FTL)</b> does this and shows ordinary sectors.</p>
      <table>
        <tr><th>File system</th><th>Writes?</th><th>Runs on</th><th>Key points</th></tr>
        <tr><td>cramfs</td><td>no</td><td>any</td><td>Older, compressed, files up to 16 MB; largely replaced by squashfs</td></tr>
        <tr><td>squashfs</td><td>no</td><td>any</td><td>Compressed, built in one go; usual router/camera root</td></tr>
        <tr><td>JFFS2</td><td>yes</td><td>raw NOR/NAND</td><td>Levels wear, compresses; scans whole chip at mount: small partitions</td></tr>
        <tr><td>YAFFS2</td><td>yes</td><td>raw NAND</td><td>NAND-specific; early Android; outside mainline</td></tr>
        <tr><td>UBIFS</td><td>yes</td><td>raw NAND via UBI</td><td>UBI levels wear chip-wide, handles bad blocks; index on flash, fast mount</td></tr>
        <tr><td>ext4</td><td>yes</td><td>managed flash</td><td>Standard journaling FS; the controller levels wear</td></tr>
        <tr><td>F2FS</td><td>yes</td><td>managed flash</td><td>Log-structured, sequential writes; phone data partitions</td></tr>
      </table>
      <p>Guide: never written → squashfs; behind a controller → ext4 or F2FS; large raw NAND → UBIFS; small raw partition → JFFS2. Never ext4 on raw flash.</p>
      <h3>Why device makers choose Linux</h3>
      <p><b>Vendor independence</b> (no lock-in to one supplier), <b>varied hardware support</b> (many architectures, thousands of drivers), <b>low cost</b> (no per-device license fee; the real costs are engineering and security updates) and <b>open source</b> (code can be read and changed; the GPL requires sharing kernel changes you ship). The price: Linux needs megabytes of RAM and usually an MMU (but see µClinux), so tiny microcontrollers use an RTOS; and it is not hard real-time out of the box (PREEMPT_RT, merged in Linux 6.12 in 2024, shortens worst-case delays).</p>
      <h3>Android as an embedded Linux</h3>
      <p>Android runs the Linux kernel (plus Android additions; the Binder driver is now in mainline) but its own user space, not the GNU one: Bionic, Toybox and mksh, its own init, Binder IPC, the Android Runtime (ART, which replaced Dalvik in Android 5.0) and its app framework. It runs on phones, tablets, TVs, cars, watches.</p>
      <h3>µClinux: Linux without an MMU</h3>
      <p><b>µClinux</b> began in 1998 as a port of Linux to processors with no MMU; its changes entered the main kernel in the 2.5 series, so since Linux 2.6 (2003) mainline can be built without MMU support. Every address is then physical: no memory protection; no virtual memory, paging or swapping; programs are relocated to where they load (flat or FDPIC binaries) with stack sizes fixed at build time; large requests need contiguous memory, so external fragmentation can make them fail; shared libraries are limited; and <b>there is no fork()</b>.</p>
      <p>With an MMU, fork() copies the parent’s page table: same virtual addresses, same frames shared copy-on-write, and pointers stay valid because each process is translated separately. Without an MMU a copy must sit at other physical addresses, yet its pointers still hold the parent’s addresses, so the child would overwrite the parent’s memory. (Copy on write only makes fork() cheap; fork() truly needs address translation.)</p>
      <p><b>vfork() + exec</b> instead: (1) the parent calls vfork(); (2) the child runs in the parent’s borrowed memory while the parent is suspended, and may only call exec or _exit; (3) the child calls exec; (4) the kernel loads and relocates the program in free, contiguous memory; (5) the parent resumes, its memory untouched.</p>
    `,
  });
})();
