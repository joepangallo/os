/* =====================================================================
   12.11 Android File Management
   Original teaching material. Helpers shared by several steps live inside
   this IIFE (no globals).
   ===================================================================== */
(function () {
  /* ---------- step 2: the two partition layouts and what each scenario does to them ----------
     Each block: k (id), n (name), m (mount point or note), c (colour class), w (relative width), kids (blocks drawn
     inside it), info (what it holds), fr / up: [status, why] for the factory-reset and system-update scenarios.
     Status: 'erase' (wiped), 'write' (rewritten), 'use' (used but not changed), 'keep' (untouched). */
  const SHARED = { k: 'shared', n: 'shared storage', m: '/sdcard = /data/media/0', c: 'mem',
    info: 'What apps and the user see as <code>/sdcard</code> or <code>/storage/emulated/0</code>: DCIM (camera photos), Pictures, Music, Download and so on. On most phones it is <b>not a separate chip or card</b>: it is a folder under <code>/data/media</code> inside the data partition (<code>/data/media/0</code> for the phone’s first user), shown to apps through a special file-system layer that enforces the shared-storage rules.',
    fr: ['erase', 'It lives inside the data partition, so formatting data erases every photo and download stored here.'],
    up: ['keep', 'Untouched: your photos and downloads stay.'] };
  const LAYOUTS = {
    classic: {
      blocks: [
        { k: 'boot', n: 'boot', m: 'raw image', c: 'os', w: 1.05,
          info: 'The Linux kernel and the ramdisk that holds init. The bootloader copies both into main memory to start Android. It is one raw image, never mounted as a folder.',
          fr: ['keep', 'Untouched: the same kernel starts the phone after the reset.'],
          up: ['write', 'Recovery writes the new kernel and ramdisk here.'] },
        { k: 'recovery', n: 'recovery', m: 'raw image', c: 'os', w: 1.15,
          info: 'A complete second boot image: its own kernel and ramdisk plus the recovery program. The phone starts it instead of normal Android to install updates or to factory-reset, even when normal Android cannot start.',
          fr: ['use', 'Recovery is the program that does the erasing. It runs, but nothing inside it changes.'],
          up: ['use', 'Recovery checks the package’s digital signature and applies it. (Some updates also refresh recovery itself.)'] },
        { k: 'misc', n: 'misc', m: 'flags', c: 'io', w: 0.8,
          info: 'A tiny partition of flags and small settings. Its best-known job: Android writes a message such as “boot into recovery and do X” here, and the bootloader reads it on the next start. Some makers also keep hardware switches here.',
          fr: ['use', 'Carries the “start recovery and wipe data” message to the bootloader.'],
          up: ['use', 'Carries the “start recovery and install the package” message to the bootloader.'] },
        { k: 'system', n: 'system', m: '/system', c: 'os', w: 2.4,
          info: 'The operating system: the Android framework, system libraries, the runtime and the preinstalled apps. Mounted <b>read-only</b> during normal use and checked as it is read (verified boot), so nothing can quietly change it. Since Android 8.0 the maker’s drivers and hardware libraries sit in a separate <b>vendor</b> partition.',
          fr: ['keep', 'Untouched, so the phone keeps the Android version of its last update, not the one it shipped with.'],
          up: ['write', 'Recovery rewrites the OS files: framework, libraries and preinstalled apps.'] },
        { k: 'cache', n: 'cache', m: '/cache', c: 'io', w: 1.05,
          info: 'Data that may be thrown away at any time: a downloaded update package, and recovery’s commands and logs. Apps never keep anything important here.',
          fr: ['erase', 'Formatted: leftover update packages and logs are gone.'],
          up: ['use', 'Holds the downloaded update package until recovery has installed it. (Some phones keep it in /data instead.)'] },
        { k: 'data', n: 'data (userdata)', m: '/data', c: 'proc', w: 3.7, kids: [SHARED],
          info: 'Everything that belongs to the user: installed apps (<code>/data/app</code>), each app’s private directory (<code>/data/data/&lt;package&gt;</code>), accounts and system settings (<code>/data/system</code>) and the emulated shared storage (<code>/data/media</code>). Read-write, and encrypted on modern phones.',
          fr: ['erase', 'Formatted: every installed app, its private files and databases, every account and setting.'],
          up: ['keep', 'Untouched: every app, file and setting is still there after the update.'] },
      ],
      card: { k: 'sd', n: 'microSD card', m: 'optional', c: 'io',
        info: 'An optional removable card: a separate storage device, not part of the flash chip. Many phones have no slot at all. Android treats a card as one more shared-storage volume.',
        fr: ['keep', 'A separate device. A reset normally leaves it alone; you must choose to format it.'],
        up: ['keep', 'Not involved in system updates.'] },
      flow: {
        explore: { cls: '', html: '<b>One flash chip, several partitions.</b> Each partition is a separate region with its own file system and its own job, so one can be erased or rewritten without disturbing the others. Click any block, then run a scenario above.' },
        fr: { cls: 'bad', html: '<ol class="m0" style="padding-left:20px"><li>You choose <i>Erase all data</i>. Android writes a wipe command into misc and reboots.</li><li>The bootloader reads misc and starts <b>recovery</b> instead of Android.</li><li>Recovery formats <b>data</b> and <b>cache</b>. Boot, system and recovery stay as they are.</li><li>The phone restarts into the setup screen, as if new.</li></ol>' },
        up: { cls: 'warn', html: '<ol class="m0" style="padding-left:20px"><li>Android downloads the update package into <b>cache</b> and checks it.</li><li>It writes “install this package” into <b>misc</b> and reboots into <b>recovery</b>.</li><li>Recovery verifies the package’s signature, then rewrites <b>system</b> and <b>boot</b>.</li><li>The phone restarts into the new version. Nothing of yours in <b>data</b> was changed, so everything is still there.</li></ol>' },
      },
    },
    ab: {
      blocks: [
        { k: 'boota', n: 'boot_a', m: 'slot A', c: 'os', w: 1.05,
          info: 'Slot A’s boot image: kernel and ramdisk. On most A/B phones the recovery program lives inside a boot image too, so there is <b>no separate recovery partition</b>.',
          fr: ['use', 'The phone starts recovery mode from the active slot’s boot image; recovery does the wiping. The image itself does not change.'],
          up: ['use', 'Slot A keeps running the phone during the whole download and install.'] },
        { k: 'bootb', n: 'boot_b', m: 'slot B', c: 'os', w: 1.05,
          info: 'Slot B’s copy of the boot image. Only one slot is active at a time; the other one receives the next update.',
          fr: ['keep', 'Untouched.'],
          up: ['write', 'The new kernel and ramdisk are written here in the background.'] },
        { k: 'misc', n: 'misc', m: 'flags', c: 'io', w: 0.8,
          info: 'Flags for the bootloader, as before. On many A/B phones it also records which slot to try next and whether that slot booted successfully.',
          fr: ['use', 'Carries the “wipe data” message to recovery.'],
          up: ['use', 'The flags are switched to “try slot B next”.'] },
        { k: 'super', n: 'super', m: 'dynamic partitions', c: 'os', w: 3.6,
          kids: [
            { k: 'sysa', n: 'system_a + vendor_a', m: 'slot A', c: 'os',
              info: 'Slot A’s read-only system partitions (system, vendor, product…). They are <b>logical</b> partitions inside super, so an update may give them new sizes.',
              fr: ['keep', 'Untouched.'], up: ['use', 'Still mounted and running while slot B is written.'] },
            { k: 'sysb', n: 'system_b + vendor_b', m: 'slot B', c: 'os',
              info: 'Slot B’s copies. Plain A/B keeps two full copies. Virtual A/B (Android 11) saves space: it keeps only the changes, as a snapshot, until the new version has booted.',
              fr: ['keep', 'Untouched.'], up: ['write', 'The new OS is written into these logical partitions, resized if it needs more room.'] },
          ],
          info: 'One physical partition that holds the read-only system partitions as <b>logical</b> partitions (dynamic partitions, Android 10 and later). Because the kernel’s device mapper (a layer that maps each logical partition onto a range of real blocks) draws their boundaries, an update can grow one and shrink another.',
          fr: ['keep', 'Untouched: both slots of the OS survive the reset.'],
          up: ['write', 'The slot B copies inside it are rewritten; the boundaries can move.'] },
        { k: 'data', n: 'userdata', m: '/data', c: 'proc', w: 3.4, kids: [SHARED],
          info: 'The same job as before: apps, their private directories, accounts, settings and the emulated shared storage. There is no cache partition; temporary files go in /data or nowhere.',
          fr: ['erase', 'Formatted: every installed app, its private files and databases, every account and setting.'],
          up: ['keep', 'Your apps, files and settings are not changed. (Virtual A/B may borrow free space here to hold the update until it has booted.)'] },
      ],
      card: null,
      flow: {
        explore: { cls: '', html: '<b>Newer phones (simplified).</b> <span class="t" data-t="A/B updates">A/B updates</span> keep two copies, slot A and slot B, of every OS partition. <span class="t">Dynamic partitions</span> put the system partitions inside one big <b>super</b> partition. Exact layouts differ between phone makers.' },
        fr: { cls: 'bad', html: '<ol class="m0" style="padding-left:20px"><li>You choose <i>Erase all data</i>. Android writes a wipe command into misc and reboots.</li><li>The bootloader starts recovery mode from the boot image of the active slot.</li><li>Recovery formats <b>userdata</b>, shared storage included. Both OS slots stay as they are.</li><li>The phone restarts into the setup screen.</li></ol>' },
        up: { cls: 'warn', html: '<ol class="m0" style="padding-left:20px"><li>You keep using the phone, running from <b>slot A</b>, while the update is written into <b>slot B</b>.</li><li>The flags in misc are switched to “try slot B next”.</li><li>One reboot starts slot B. If it fails to boot, the bootloader falls back to slot A.</li><li>Nothing of yours in <b>userdata</b> is changed, so apps and files stay.</li></ol>' },
      },
    },
  };
  const SHORT = { boot: 'kernel + ramdisk', recovery: 'repair and update mode', misc: 'boot messages', system: 'Android itself, read-only', cache: 'temporary files', data: '', shared: 'photos, music, downloads', sd: 'removable extra space',
    boota: 'kernel + ramdisk', bootb: 'kernel + ramdisk', super: '', sysa: 'OS, slot A', sysb: 'OS, slot B' };
  // file system and how the partition is used while Android runs normally
  const FSMODE = { boot: ['none: a raw image', 'not mounted'], recovery: ['none: a raw image', 'not mounted; started only when needed'], misc: ['none: raw bytes', 'not mounted'],
    system: ['ext4 (EROFS on some newer phones)', 'mounted read-only'], cache: ['ext4 or F2FS', 'mounted read-write'], data: ['ext4 or F2FS', 'mounted read-write, encrypted'],
    shared: ['a folder of data, seen through a filtering layer', 'read-write, under per-app rules'], sd: ['usually exFAT or FAT32, so computers can read it', 'mounted read-write'],
    boota: ['none: a raw image', 'not mounted'], bootb: ['none: a raw image', 'not mounted'], super: ['none itself: it holds logical partitions', 'its logical partitions are mounted'],
    sysa: ['ext4 or EROFS', 'mounted read-only while slot A is active'], sysb: ['ext4 or EROFS', 'not mounted while slot A is active'] };
  /* ---------- step 4: the sandbox. Two apps, five files, two eras of shared-storage rules ---------- */
  const APPS = {
    notes: { n: 'Notes', pkg: 'com.example.notes', app: 123 },
    game: { n: 'Game', pkg: 'com.example.game', app: 145 },
  };
  // Android user 0 is the phone's first person; app IDs start at 10000; each further user adds 100000
  const uidOf = (user, app) => 100000 * user + 10000 + app;
  const uname = (user, app) => 'u' + user + '_a' + app;
  Object.values(APPS).forEach((a) => { a.uid = uidOf(0, a.app); a.un = uname(0, a.app); });
  const FILES = [
    { k: 'nd', path: '/data/data/com.example.notes/databases/notes.db', kind: 'private', owner: 'notes', d: 'Notes’ private database' },
    { k: 'gs', path: '/data/data/com.example.game/files/save.dat', kind: 'private', owner: 'game', d: 'Game’s private save file' },
    { k: 'ex', path: '/sdcard/Android/data/com.example.notes/files/export.txt', kind: 'appdir', owner: 'notes', d: 'Notes’ own folder on shared storage' },
    { k: 'ph', path: '/sdcard/Pictures/sketch.png', kind: 'media', owner: 'notes', d: 'a picture Notes saved to shared Pictures' },
    { k: 'pdf', path: '/sdcard/Download/bus-timetable.pdf', kind: 'doc', owner: 'browser', d: 'a PDF the browser downloaded' },
  ];
  // decide(actor, file, era, perm) → { res: 'ok' | 'no' | 'pick', lines: [[true|false|null, html]], why }
  function decide(actor, f, era, perm) {
    const A = APPS[actor];
    const lines = [[null, `${A.n} runs as Linux user <b>${A.un}</b> (UID ${A.uid}).`]];
    if (f.kind === 'private') {
      const O = APPS[f.owner];
      lines.push([null, `The file belongs to user <b>${O.un}</b> and to that app’s own private group, with mode <code>rw-rw----</code>: the owner and that group may read and write, all others get nothing. The app’s directory is <code>rwx------</code>.`]);
      if (actor === f.owner) {
        lines.push([true, 'The process’s UID equals the owner’s, so the owner bits apply: read and write are allowed.']);
        return { res: 'ok', lines, why: 'Every app may use its own private directory freely, with no permission at all.' };
      }
      lines.push([false, `UID ${A.uid} is not the owner and not in the file’s group, so the “others” bits apply: no access. The kernel rejects <code>open()</code> with EACCES (“Permission denied”).`]);
      return { res: 'no', lines, why: 'This is the ordinary Linux owner/group/others permission check. No Android permission and no Android version changes it, and SELinux, a second kernel security layer with its own rule for every app, adds an independent wall.' };
    }
    const legacy = era === 'legacy';
    if (f.kind === 'appdir' && actor === f.owner) {
      lines.push([true, 'The file is inside Notes’ own folder, <code>Android/data/com.example.notes</code>.']);
      return { res: 'ok', lines, why: 'An app may always use its own folder on shared storage, with no permission (true since Android 4.4).' };
    }
    if (legacy) {
      lines.push([null, 'Before scoped storage, Android did not track who created a shared file. Only one thing counts: does the app hold READ_EXTERNAL_STORAGE (required for reading since Android 4.4)?']);
      lines.push([perm, perm ? 'Yes: the user granted it, and it opens <b>all</b> of shared storage.' : 'No, so the app cannot read anything on shared storage that is not in its own folder.']);
      return { res: perm ? 'ok' : 'no', lines, why: perm ? 'One permission exposed every photo, download and other app’s folder. That all-or-nothing access is exactly what scoped storage was designed to end.' : 'Without the permission, shared storage is closed except for the app’s own folder.' };
    }
    if (f.kind === 'appdir') {
      lines.push([false, 'The file is in <b>another app’s</b> <code>Android/data</code> folder.']);
      return { res: 'no', lines, why: 'Since Android 11 no ordinary app can open another app’s Android/data folder, whatever permissions it holds.' };
    }
    if (f.kind === 'media') {
      if (actor === f.owner) {
        lines.push([true, 'Notes created this picture through MediaStore, Android’s index of shared media, so Android records Notes as its owner.']);
        return { res: 'ok', lines, why: 'Under scoped storage an app needs no permission to add media and to read back what it added.' };
      }
      lines.push([null, 'Game did not create this picture, so it needs a permission to read media: READ_EXTERNAL_STORAGE on Android 11 and 12, READ_MEDIA_IMAGES (photos) since Android 13.']);
      lines.push([perm, perm ? 'The user granted it.' : 'The user has not granted it.']);
      return { res: perm ? 'ok' : 'no', lines, why: perm ? 'A media permission opens other apps’ photos, videos or music, never their documents or their Android/data folders. Since Android 14 the user may grant just a few selected photos.' : 'Without the permission, other apps’ media are invisible to Game.' };
    }
    lines.push([null, `${A.n} did not create this PDF, and a PDF is not a photo, video or audio file, so no media permission covers it.`]);
    lines.push([false, 'Opening it directly by its path is refused.']);
    return { res: 'pick', lines, why: 'The app must ask the user to choose the file in the system file picker (the Storage Access Framework). The user’s choice grants access to exactly that one file. (Only special apps such as file managers may ask for “all files access”, Android 11+.)' };
  }
  const RES = { ok: ['ok', '✓ allowed'], no: ['bad', '✗ denied'], pick: ['warn', 'only via picker'] };
  const STATUS = { erase: ['bad', 'erased'], write: ['warn', 'rewritten'], use: ['accent', 'used'], keep: ['ok', 'unchanged'] };

  Guide.section({
    id: '12.11',
    title: 'Android File Management',
    short: 'Android files',
    summary: 'Linux file systems in fixed partitions, one Linux user per app, and SQLite databases in single files.',
    objectives: [
      'Explain why files on an Android phone are Linux files underneath, and name the file systems phones use (ext4 and F2FS).',
      'Describe the classic partitions (boot, system, recovery, data, cache, misc) and shared storage, and predict what a factory reset or a system update touches.',
      'Explain how A/B updates and dynamic partitions change the layout on newer phones.',
      'Decide whether one app may read another app’s files, using Linux user IDs and permissions for private files and the scoped-storage rules for shared storage.',
      'Describe SQLite as an embedded, single-file database and explain what a transaction guarantees.',
    ],
    terms: [
      ['Partition', 'A fixed, separately managed region of a storage device. The OS treats each partition as its own volume, usually with its own file system, so one partition can be erased or rewritten without touching the others.'],
      ['ext4 (fourth extended file system)', 'The standard Linux disk file system since the late 2000s, a journaling successor of ext2 and ext3. Android has used it for its main partitions since version 2.3 (2010).'],
      ['F2FS (Flash-Friendly File System)', 'A Linux file system that Samsung designed for flash storage. It writes new data in long sequential runs, which suits how flash chips work; many phones use it for their data partition.'],
      ['Bootloader', 'The small program a device runs first when it is switched on. It checks and loads a kernel, normally from the boot partition or, when asked to, from recovery, and hands control to it.'],
      ['Boot partition', 'The partition that holds the Linux kernel and a small ramdisk, the two things the bootloader loads to start Android. It is read as one raw image, not mounted as a folder.'],
      ['Ramdisk (initial ramdisk)', 'A small file-system image that is copied into main memory at boot and used as the first root file system. On Android it holds init and the files init needs to mount the real partitions.'],
      ['System partition', 'The partition mounted at /system that holds the Android operating system: the framework, system libraries and preinstalled apps. It is read-only during normal use and changes only when the system is updated.'],
      ['Recovery partition', 'A second bootable partition with its own small kernel and a recovery program. The phone starts it instead of normal Android to install a system update or to carry out a factory reset.'],
      ['Data partition (userdata)', 'The partition mounted at /data that holds everything that belongs to the user: installed apps, each app’s private files and databases, accounts and settings. A factory reset erases it.'],
      ['Cache partition', 'The partition mounted at /cache for data that may be thrown away, classically a downloaded system-update package and the recovery program’s logs. Many newer phones have no cache partition.'],
      ['Misc partition', 'A tiny partition for small flags and settings. Its best-known job is carrying a message such as “start recovery on the next boot” from Android to the bootloader.'],
      ['Factory reset', 'Erasing the data partition (and the cache) so the phone starts again as if new: every installed app, account, file and setting is gone, while the operating-system partitions stay as they are.'],
      ['Over-the-air update (OTA)', 'A system update that the phone downloads and installs by itself, without being connected to a computer.'],
      ['A/B updates (seamless updates)', 'An update scheme, introduced in Android 7.0, that keeps two copies (slots A and B) of the system partitions. The update is written to the slot not in use while the phone keeps working; a reboot switches slots, and a failed boot falls back to the old slot.'],
      ['Dynamic partitions', 'Since Android 10, system, vendor and the other read-only system partitions can be logical partitions inside one physical partition named super, so an update can change their sizes.'],
      ['Shared storage (external storage)', 'The storage area for user-visible files that apps share, such as photos, music and downloads, seen as /sdcard or /storage/emulated/0. On most phones it is “emulated”: a folder inside the data partition, not a separate card.'],
      ['App-private directory (internal storage)', 'The directory Android creates for each app inside /data, such as /data/data/com.example.notes. It belongs to the app’s own Linux user ID, so other apps cannot open it.'],
      ['Scoped storage', 'The shared-storage rules introduced in Android 10 (apps targeting Android 10 could still opt out) and required for apps that target Android 11 or later: an app sees its own files and the media it created, and anything else only if the user grants access.'],
      ['SQLite', 'A small but complete SQL database engine that runs as a library inside the app that uses it, with no separate server process, and keeps a whole database in one ordinary file. It is Android’s standard on-device database.'],
      ['Transaction', 'A group of database changes applied as one unit: either all of them become permanent (commit) or none of them do (rollback), even if the power fails part-way through.'],
    ],
    css: `
      .sec-12-11 .narr { background: var(--panel-2); border: 1px solid var(--line); border-left: 5px solid var(--chc); border-radius: 12px; padding: 9px 13px; font-size: 15px; line-height: 1.45; }
      .sec-12-11 .narr.bad { border-left-color: var(--bad); background: var(--bad-bg); }
      .sec-12-11 .narr.ok { border-left-color: var(--ok); background: var(--ok-bg); }
      .sec-12-11 .narr.warn { border-left-color: var(--warn); background: var(--warn-bg); }
      .sec-12-11 .grid-2 > *, .sec-12-11 .grid-3 > *, .sec-12-11 .mw0 > * { min-width: 0; }
      .sec-12-11 .flip-face.front { font-size: 19px; }
      .sec-12-11 .flip-face.back { font-size: 16px; line-height: 1.45; }
      .sec-12-11 .pwrap { display: flex; gap: 12px; align-items: stretch; }
      .sec-12-11 .pstrip { display: grid; gap: 6px; align-items: stretch; }
      .sec-12-11 .pb { border: 2px solid var(--line-2); border-radius: 10px; background: var(--panel); color: var(--ink); font: inherit; padding: 6px 8px; display: flex; flex-direction: column; align-items: flex-start; gap: 3px; text-align: left; cursor: pointer; min-width: 0; min-height: 132px; }
      .sec-12-11 .pb:hover { border-color: var(--accent); }
      .sec-12-11 .pb .pn { font-weight: 800; font-size: 16px; line-height: 1.15; }
      .sec-12-11 .pb .pm { font-family: var(--mono); font-size: 12.5px; color: var(--muted); }
      .sec-12-11 .pb .ps { font-size: 13.5px; color: var(--ink-2); line-height: 1.25; }
      .sec-12-11 .pb .pst { margin-top: auto; font-size: 12.5px; padding: 1px 8px; }
      .sec-12-11 .pb.os { border-color: var(--os); background: var(--os-bg); }
      .sec-12-11 .pb.proc { border-color: var(--proc); background: var(--proc-bg); }
      .sec-12-11 .pb.mem { border-color: var(--mem); background: var(--mem-bg); }
      .sec-12-11 .pb.io { border-color: var(--io); background: var(--io-bg); }
      .sec-12-11 .pb.card { border-style: dashed; height: 100%; }
      .sec-12-11 .pb.sel { outline: 3px solid var(--chc); outline-offset: 2px; }
      .sec-12-11 .pb.st-erase { background: var(--bad-bg); border-color: var(--bad); }
      .sec-12-11 .pb.st-write { background: var(--warn-bg); border-color: var(--warn); }
      .sec-12-11 .pb.st-use { background: var(--accent-bg); border-color: var(--accent); }
      .sec-12-11 .pb.st-keep { background: var(--panel); border-color: var(--line-2); }
      .sec-12-11 .pb.st-keep .pn { color: var(--ink-2); }
      .sec-12-11 .pcont { border: 2px solid var(--line-2); border-radius: 12px; padding: 4px; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
      .sec-12-11 .pcont.os { border-color: var(--os); } .sec-12-11 .pcont.proc { border-color: var(--proc); }
      .sec-12-11 .pcont.st-erase { border-color: var(--bad); background: var(--bad-bg); }
      .sec-12-11 .pcont.st-write { border-color: var(--warn); background: var(--warn-bg); }
      .sec-12-11 .pcont.st-keep { border-color: var(--line-2); }
      .sec-12-11 .pcont .pb.hd { border: none; background: transparent; min-height: 0; padding: 2px 6px; flex-direction: row; align-items: baseline; gap: 8px; }
      .sec-12-11 .pcont .pb.hd .pst { margin-top: 0; margin-left: auto; }
      .sec-12-11 .pkids { display: flex; gap: 5px; flex: 1; }
      .sec-12-11 .pkids > .pb { flex: 1; min-height: 92px; }
      .sec-12-11 .dgrid { display: grid; gap: 8px; grid-auto-rows: 1fr; align-content: stretch; }
      .sec-12-11 .dcol { border: 2px solid var(--line-2); border-radius: 12px; padding: 6px; display: flex; flex-direction: column; gap: 5px; min-width: 0; background: var(--panel); }
      .sec-12-11 .dcol.os { border-color: color-mix(in srgb, var(--os) 45%, transparent); }
      .sec-12-11 .dcol.proc { border-color: color-mix(in srgb, var(--proc) 45%, transparent); }
      .sec-12-11 .dcol.io { border-color: color-mix(in srgb, var(--io) 45%, transparent); }
      .sec-12-11 .dcol.mem { border-color: color-mix(in srgb, var(--mem) 45%, transparent); }
      .sec-12-11 .dlist { display: flex; flex-direction: column; gap: 4px; }
      .sec-12-11 .ditem { font-size: 13px; line-height: 1.3; padding: 3px 7px; border-radius: 7px; background: var(--ok-bg); border: 1px solid color-mix(in srgb, var(--ok) 40%, transparent); }
      .sec-12-11 .ditem.retry { background: var(--warn-bg); border-color: color-mix(in srgb, var(--warn) 40%, transparent); }
      .sec-12-11 .frow { display: grid; grid-template-columns: 62px minmax(0, 1fr) 118px; align-items: center; gap: 8px; padding: 6px 9px; border-radius: 10px; border: 1px solid var(--line-2); background: var(--panel); color: var(--ink); font: inherit; text-align: left; cursor: pointer; }
      .sec-12-11 .frow:hover { border-color: var(--accent); }
      .sec-12-11 .frow.sel { outline: 3px solid var(--chc); outline-offset: 1px; }
      .sec-12-11 .frow > .chip { justify-content: center; }
      .sec-12-11 .frow .fp { font-size: 13px; overflow-wrap: anywhere; line-height: 1.3; }
      .sec-12-11 ol.checks { padding-left: 22px; display: flex; flex-direction: column; gap: 5px; font-size: 15px; line-height: 1.4; }
      .sec-12-11 ol.checks li.ok::marker { color: var(--ok); font-weight: 800; }
      .sec-12-11 ol.checks li.bad::marker { color: var(--bad); font-weight: 800; }
      .sec-12-11 ol.checks li.ok { color: var(--ink); }
      .sec-12-11 .sqbtns { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; }
      .sec-12-11 .sqbtns .btn { justify-content: center; white-space: nowrap; padding-left: 4px; padding-right: 4px; }
      .sec-12-11 table.sqt td, .sec-12-11 table.sqt th { padding: 3px 9px; font-size: 14.5px; }
      .sec-12-11 table.sqt tr.pend td { background: var(--warn-bg); }
      .sec-12-11 table.sqt tr.pend.del td { text-decoration: line-through; color: var(--muted); }
      .sec-12-11 table.sqt tr.on td { box-shadow: inset 0 0 0 9999px color-mix(in srgb, var(--cpu) 14%, transparent); }
      .sec-12-11 .fline { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
      .sec-12-11 .sqleft > * { flex-shrink: 0; }
      .sec-12-11 .sqleft > .sqlog { flex: 1 1 0; min-height: 66px; height: auto; font-size: 12.5px; }
    `,
    steps: [
      {
        title: 'A Linux file system in your pocket',
        kind: 'story',
        html: `
          <div class="split fill">
            <div class="stack" style="gap:10px">
              <p class="lead m0">A phone holds thousands of files: apps, photos, messages, settings. Android manages every one of them with the Linux machinery you met earlier in this chapter.</p>
              <p class="m0">Android runs on the Linux <span class="t">kernel</span>. When an app saves anything, the request ends up as an ordinary Linux system call such as <code>write()</code>. It passes through the <span class="t" data-t="virtual file system">virtual file system</span> (section 12.9) to a real file system, usually <span class="t" data-t="ext4">ext4</span> or <span class="t" data-t="F2FS">F2FS</span>, on the phone’s flash storage. There is no special “Android file system”.</p>
              <p class="m0">What Android adds is <b>policy</b> on top of Linux: a fixed set of <span class="t" data-t="partition">partitions</span> with clear jobs, a separate Linux user for every app so apps cannot read each other’s files, and <span class="t">SQLite</span> as the standard way to keep structured data.</p>
              <div class="callout analogy m0" data-label="Analogy">An apartment building. The structure is standard (Linux). Android decides which floors hold the building’s machinery and which belong to tenants, gives each tenant a key that opens only their own flat, and puts a filing cabinet (SQLite) in every flat.</div>
              <div class="row gap-s small"><span class="chip os">map the partitions</span><span class="chip intr">reset and update a phone</span><span class="chip proc">try to read another app’s files</span><span class="chip mem">run a tiny database</span></div>
            </div>
            <div class="card stack" style="gap:8px">
              <h4 class="m0">Follow one save down to the flash chip</h4>
              <p class="small muted m0">The Notes app saves a note. Click each layer to see what it does with the request.</p>
              <div class="s1-stack stack" style="gap:4px"></div>
              <div class="narr s1-cap grow"></div>
            </div>
          </div>`,
        render(el, ctx) {
          const { h } = ctx;
          const layers = [
            ['App: Notes', 'proc', 'user space', 'The Notes app calls a normal Java or Kotlin API to save the note, for example a database insert or a file write. It never talks to the hardware itself.'],
            ['Libraries: SQLite, Java libraries, libc', 'thread', 'user space', 'Libraries inside the app’s own process turn the request into ordinary Linux system calls: <code>open()</code>, <code>write()</code>, <code>fsync()</code>. <span class="t">SQLite</span> is one of these libraries, so even a database save is just file I/O.'],
            ['Linux kernel: virtual file system', 'os', 'kernel', 'The <span class="t" data-t="virtual file system">VFS</span> checks permissions (the app’s Linux user ID against the file’s owner and mode bits) and hands the call to the file system that owns that path.'],
            ['File system: ext4 or F2FS', 'os', 'kernel', 'The file system decides which blocks hold the data and updates its metadata. Most phones use <span class="t" data-t="ext4">ext4</span> or <span class="t" data-t="F2FS">F2FS</span> for the data partition; the read-only system partitions use ext4 or, on some newer phones, EROFS, a read-only file system that can compress its contents.'],
            ['Block layer and flash driver', 'io', 'kernel', 'Written data usually waits briefly in the <span class="t" data-t="Page cache">page cache</span>, then is flushed as block requests that are queued and sent to the storage controller, as in chapter 11. An <code>fsync()</code> call forces the flush at once.'],
            ['Flash storage (UFS or eMMC)', 'io', 'hardware', 'One flash chip, divided into <span class="t" data-t="partition">partitions</span>. The note lands in the data partition, which is mounted at <code>/data</code>. The next step maps every partition.'],
          ];
          const box = ctx.$('.s1-stack'), cap = ctx.$('.s1-cap');
          const btns = layers.map((L, i) => h('button', { class: 'btn ' + L[1], type: 'button', style: { justifyContent: 'space-between', height: 'auto', minHeight: '40px', whiteSpace: 'normal', textAlign: 'left', gap: '8px', fontSize: '15.5px' }, onclick: () => show(i) },
            h('span', {}, (i + 1) + '. ' + L[0]), h('span', { class: 'xs muted' }, L[2])));
          box.append(...btns);
          function show(i) {
            btns.forEach((b, j) => b.classList.toggle('on', i === j));
            cap.innerHTML = `<b>${layers[i][0]}.</b> ${layers[i][3]}`;
            cap.classList.remove('fade-in'); void cap.offsetWidth; cap.classList.add('fade-in');
          }
          show(0);
        },
      },
      {
        title: 'The partition map: who lives where',
        kind: 'explore',
        core: true,
        render(el, ctx) {
          const { h } = ctx;
          let lay = 'classic', sc = 'explore', sel = 'data';
          const strip = h('div', { class: 'pwrap', style: ctx.narrow ? { flexDirection: 'column' } : {} });
          const legend = h('div', { class: 'row gap-s xs', style: { minHeight: '24px' } });
          const detail = h('div', { class: 'card tight stack', style: { gap: '6px' } });
          const flow = h('div', { class: 'narr', style: { display: 'flex', flexDirection: 'column' } });
          const all = () => { const L = LAYOUTS[lay], out = []; L.blocks.forEach((b) => { out.push(b); (b.kids || []).forEach((k) => out.push(k)); }); if (L.card) out.push(L.card); return out; };
          function pb(b, extra) {
            const st = sc === 'explore' ? null : b[sc][0];
            const btn = h('button', { type: 'button', style: ctx.narrow ? { minHeight: '0' } : {}, class: 'pb ' + b.c + (st ? ' st-' + st : '') + (b.k === sel ? ' sel' : '') + (extra || ''), 'aria-pressed': String(b.k === sel), onclick: () => { sel = b.k; draw(); } },
              h('span', { class: 'pn' }, b.n), h('span', { class: 'pm' }, b.m), SHORT[b.k] ? h('span', { class: 'ps' }, SHORT[b.k]) : '');
            if (st) btn.append(h('span', { class: 'chip ' + STATUS[st][0] + ' pst' }, STATUS[st][1]));
            return btn;
          }
          function draw() {
            const L = LAYOUTS[lay];
            const grid = h('div', { class: 'pstrip', style: { gridTemplateColumns: ctx.narrow ? '1fr' : L.blocks.map((b) => b.w + 'fr').join(' ') } },
              ...L.blocks.map((b) => {
                if (!b.kids) return pb(b);
                const st = sc === 'explore' ? null : b[sc][0];
                return h('div', { class: 'pcont ' + b.c + (st ? ' st-' + st : '') }, pb(b, ' hd'), h('div', { class: 'pkids' }, ...b.kids.map((k) => pb(k))));
              }));
            strip.replaceChildren(
              h('div', { class: 'stack', style: { gap: '4px', flex: '1', minWidth: '0' } }, h('div', { class: 'xs muted b' }, lay === 'classic' ? 'ONE FLASH CHIP · CLASSIC LAYOUT (not to scale)' : 'ONE FLASH CHIP · NEWER A/B PHONE (simplified, not to scale)'), grid),
              L.card ? h('div', { class: 'stack', style: { gap: '4px', width: ctx.narrow ? 'auto' : '128px' } }, h('div', { class: 'xs muted b' }, 'SEPARATE DEVICE'), h('div', { class: 'pstrip', style: { gridTemplateColumns: '1fr', flex: '1' } }, pb(L.card, ' card'))) : '');
            legend.replaceChildren(...(sc === 'explore'
              ? [h('span', { class: 'chip os' }, 'operating system'), h('span', { class: 'chip proc' }, 'user and app data'), h('span', { class: 'chip mem' }, 'shared files'), h('span', { class: 'chip io' }, 'scratch, flags, removable')]
              : ['erase', 'write', 'use', 'keep'].map((k) => h('span', { class: 'chip ' + STATUS[k][0] }, STATUS[k][1]))));
            const b = all().find((x) => x.k === sel) || L.blocks[0];
            if (b.k !== sel) sel = b.k;
            const st = sc === 'explore' ? null : b[sc];
            detail.replaceChildren(
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', { style: { fontSize: '18px' } }, b.n), h('span', { class: 'chip ' + b.c + ' mono' }, b.m)),
              h('p', { class: 'm0', style: { fontSize: '15px' }, html: b.info }),
              h('div', { class: 'small', style: { display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 10px' } },
                h('b', {}, 'File system'), h('span', {}, FSMODE[b.k][0]), h('b', {}, 'Normal use'), h('span', {}, FSMODE[b.k][1])),
              st ? h('div', { class: 'narr ' + (st[0] === 'erase' ? 'bad' : st[0] === 'write' ? 'warn' : st[0] === 'keep' ? 'ok' : ''), html: `<span class="chip ${STATUS[st[0]][0]}">${STATUS[st[0]][1]}</span> ${st[1]}` }) : '');
            const f = L.flow[sc];
            flow.className = 'narr ' + f.cls;
            flow.innerHTML = '<div style="margin-bottom:8px">' + (sc === 'explore' ? '' : `<b>${sc === 'fr' ? 'Factory reset' : 'System update'}, step by step</b>`) + f.html + '</div>'
              + (sc === 'explore' ? '<div class="callout warn" data-label="Common mistake" style="margin:auto 0 0">Shared storage is usually not a separate card. It is a folder inside the data partition, so a factory reset erases photos that were not backed up.</div>' : '');
          }
          const layoutSeg = ctx.ui.seg([{ value: 'classic', label: 'Classic layout' }, { value: 'ab', label: 'Newer phones (A/B)' }], lay, (v) => { lay = v; draw(); });
          const scSeg = ctx.ui.seg([{ value: 'explore', label: 'Explore' }, { value: 'fr', label: 'Factory reset' }, { value: 'up', label: 'System update' }], sc, (v) => { sc = v; draw(); });
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },
            h('div', { class: 'row', style: { justifyContent: 'space-between', gap: '10px' } }, layoutSeg, scSeg),
            strip, legend,
            h('div', { class: 'grid-2 grow', style: { gap: '12px', alignItems: 'stretch' } }, detail, flow)));
          draw();
        },
      },
      {
        title: 'Where does this file live?',
        kind: 'lab',
        render(el, ctx) {
          const { h } = ctx;
          const DEST = [
            ['boot', 'boot', 'os', 'boot holds just two things: the kernel and its ramdisk.'],
            ['recovery', 'recovery', 'os', 'recovery holds only the separate repair-and-update system.'],
            ['system', '/system', 'os', 'system holds only the OS and the apps that came with the phone, and it is read-only during normal use.'],
            ['data', '/data (private)', 'proc', 'the private part of data holds installed apps, their private files and the system’s records about users and apps.'],
            ['cache', '/cache', 'io', 'cache holds only throw-away data such as a pending update package and recovery logs.'],
            ['shared', 'shared storage', 'mem', 'shared storage holds user-visible files that several apps may use, such as photos and downloads.'],
          ];
          const ITEMS = [
            ['A photo you just took with the camera', 'shared', '/sdcard/DCIM/Camera/IMG_2041.jpg', 'Photos are the user’s files, meant to be seen by the gallery, a messaging app, a computer over USB: shared storage.'],
            ['The Linux kernel', 'boot', 'boot partition (raw image)', 'The bootloader loads the kernel from the boot partition before any file system is mounted.'],
            ['A game you installed from the app store', 'data', '/data/app/…/com.example.game-…/base.apk', 'Installed apps go to /data/app. They disappear in a factory reset, which is exactly what “as new” means.'],
            ['The Android framework libraries', 'system', '/system/framework/framework.jar', 'The framework is part of the OS, so it lives on the read-only system partition.'],
            ['A chat app’s database of your conversations', 'data', '/data/data/com.example.chat/databases/chat.db', 'An app’s databases sit in its private directory, readable only by that app’s Linux user.'],
            ['A system-update package waiting to be installed', 'cache', '/cache/update.zip', 'Classic phones park the downloaded package in cache until recovery installs it.'],
            ['The ramdisk that holds init', 'boot', 'boot partition (raw image)', 'The ramdisk travels with the kernel in the boot image. init runs from it and mounts the real partitions.'],
            ['A PDF bus timetable you downloaded in the browser', 'shared', '/sdcard/Download/bus-timetable.pdf', 'Downloads go to the shared Download folder, so a PDF reader or a file manager can open them later.'],
            ['The preinstalled phone dialer app', 'system', '/system/priv-app/Dialer/Dialer.apk', 'Apps that ship with the phone live on the system partition. A factory reset cannot remove them.'],
            ['A notes app’s saved settings (dark mode on, font size)', 'data', '/data/data/com.example.notes/shared_prefs/settings.xml', 'Small settings files are private app data, kept in the app’s own directory.'],
            ['The program that wipes the phone during a factory reset', 'recovery', 'recovery partition (raw image)', 'Recovery is a separate bootable system, so it can erase data while normal Android is not running.'],
            ['The list of installed apps and the user ID of each', 'data', '/data/system/packages.xml', 'The system’s own records about apps and users change all the time, so they live in data, not in read-only system.'],
          ];
          let i = 0, firstTry = 0, tried = new Set(), done = false, solved = false;
          const placed = {}; DEST.forEach((d) => { placed[d[0]] = []; });
          const prog = h('span', { class: 'chip accent' });
          const score = h('span', { class: 'chip ok' });
          const fileCard = h('div', { class: 'card white stack', style: { gap: '6px' } });
          const fb = h('div', { class: 'narr' });
          const nextBtn = h('button', { class: 'btn primary', type: 'button', onclick: () => next() }, 'Next file →');
          const cols = {}, dbtn = {};
          const destCols = DEST.map(([k, label, c]) => {
            dbtn[k] = h('button', { class: 'btn ' + c, type: 'button', style: { width: '100%', justifyContent: 'center', fontSize: '15px' }, onclick: () => pick(k) }, label);
            cols[k] = h('div', { class: 'dlist' });
            return h('div', { class: 'dcol ' + c }, dbtn[k], cols[k]);
          });
          const nameOf = (k) => DEST.find((d) => d[0] === k)[1];
          function drawCols() {
            DEST.forEach(([k]) => cols[k].replaceChildren(...placed[k].map((p) => h('div', { class: 'ditem ' + (p.ok ? 'ok' : 'retry') }, p.t))));
          }
          function drawItem() {
            const it = ITEMS[i];
            solved = false;
            prog.textContent = 'File ' + (i + 1) + ' of ' + ITEMS.length;
            score.textContent = firstTry + ' right first time';
            fileCard.replaceChildren(h('div', { class: 'xs muted b' }, 'WHERE DOES THIS LIVE?'), h('div', { style: { fontSize: '19px', fontWeight: '800', lineHeight: '1.3' } }, it[0]), h('div', { class: 'small muted' }, 'Click its home on the right.'));
            fb.className = 'narr'; fb.innerHTML = 'Ask three questions: does the file belong to the OS or to the user? Must it survive a factory reset? Should other apps see it?';
            nextBtn.disabled = true;
            DEST.forEach(([k]) => dbtn[k].classList.remove('on'));
          }
          function pick(k) {
            if (done || solved) return;
            const it = ITEMS[i];
            if (k === it[1]) {
              const ok = tried.size === 0;
              if (ok) firstTry++;
              solved = true;
              placed[k].push({ t: it[0], ok });
              drawCols();
              score.textContent = firstTry + ' right first time';
              fb.className = 'narr ok';
              fb.innerHTML = `<b>✓ ${nameOf(k)}.</b> ${it[3]}<div class="mono xs" style="margin-top:4px;overflow-wrap:anywhere">${it[2]}</div>`;
              nextBtn.disabled = false;
              if (i === ITEMS.length - 1) nextBtn.textContent = 'See the result';
              dbtn[k].classList.add('on');
            } else {
              tried.add(k);
              fb.className = 'narr bad';
              fb.innerHTML = (k === 'data' && it[1] === 'shared')
                ? '<b>✗ Close, but be more specific.</b> Physically, shared storage is a folder inside the data partition. Apps, though, see this file in shared storage, not in any app’s private area. Try again.'
                : `<b>✗ Not ${nameOf(k)}:</b> ${DEST.find((d) => d[0] === k)[3]} Try again.`;
            }
          }
          function next() {
            if (!solved) return;
            if (i < ITEMS.length - 1) { i++; tried = new Set(); drawItem(); return; }
            done = true;
            nextBtn.disabled = true;
            fileCard.replaceChildren(h('div', { class: 'xs muted b' }, 'ALL ' + ITEMS.length + ' FILES PLACED'), h('div', { class: 'big' }, firstTry + ' / ' + ITEMS.length), h('div', { class: 'small' }, 'right on the first try'));
            fb.className = 'narr ok';
            fb.innerHTML = '<b>The pattern:</b> the OS lives in boot, system and recovery, and changes only during updates. Everything that belongs to the user or to installed apps lives in data, which is why a factory reset only has to erase data (and the throw-away cache).';
          }
          function restart() { i = 0; firstTry = 0; tried = new Set(); done = false; DEST.forEach((d) => { placed[d[0]] = []; }); nextBtn.textContent = 'Next file →'; drawCols(); drawItem(); }
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack', style: { gap: '10px' } },
              h('p', { class: 'm0', html: 'Twelve files from a phone with the <b>classic layout</b>. Put each one where Android keeps it. Placed files collect under their home, so the pattern builds up as you go.' }),
              h('div', { class: 'row gap-s' }, prog, score, h('span', { class: 'grow' }), h('button', { class: 'btn ghost sm', type: 'button', onclick: restart }, 'Start again')),
              fileCard, fb, h('div', { class: 'row' }, nextBtn),
              h('div', { class: 'callout why m0', 'data-label': 'Why split the files this way?', style: { marginTop: 'auto' } }, 'The OS can be kept read-only and checked, an update can replace it without touching anyone’s files, and a factory reset can erase everything personal by formatting one partition.')),
            h('div', { class: 'dgrid', style: { gridTemplateColumns: ctx.narrow ? '1fr 1fr' : '1fr 1fr 1fr' } }, ...destCols)));
          drawCols(); drawItem();
        },
      },
      {
        title: 'The app sandbox: one Linux user per app',
        kind: 'explore',
        core: true,
        render(el, ctx) {
          const { h } = ctx;
          let actor = 'game', era = 'scoped', sel = 'nd';
          const perm = { notes: false, game: false };
          const permBtn = h('button', { class: 'btn sm', type: 'button', onclick: () => { perm[actor] = !perm[actor]; draw(); } });
          const list = h('div', { class: 'stack', style: { gap: '6px' } });
          const detail = h('div', { class: 'card tight stack', style: { gap: '8px' } });
          function draw() {
            const A = APPS[actor];
            permBtn.setAttribute('aria-pressed', String(perm[actor]));
            permBtn.classList.toggle('on', perm[actor]);
            permBtn.textContent = (perm[actor] ? '✓ ' : '') + (era === 'legacy' ? `${A.n} holds the storage permission` : `${A.n} holds the photos permission`);
            list.replaceChildren(...FILES.map((f) => {
              const r = decide(actor, f, era, perm[actor]);
              const kind = h('span', { class: 'chip ' + (f.kind === 'private' ? 'proc' : 'mem'), style: { alignSelf: 'flex-start' } }, f.kind === 'private' ? 'private' : 'shared');
              const text = h('span', { class: 'stack', style: { gap: '1px', minWidth: '0' } }, ctx.narrow ? kind : '', h('span', { class: 'mono fp' }, f.path), h('span', { class: 'xs muted' }, f.d));
              return h('button', { type: 'button', class: 'frow' + (f.k === sel ? ' sel' : ''), style: ctx.narrow ? { gridTemplateColumns: 'minmax(0, 1fr) auto' } : {}, 'aria-pressed': String(f.k === sel), onclick: () => { sel = f.k; draw(); } },
                ctx.narrow ? '' : kind, text, h('span', { class: 'chip ' + RES[r.res][0] }, RES[r.res][1]));
            }));
            const f = FILES.find((x) => x.k === sel);
            const r = decide(actor, f, era, perm[actor]);
            detail.replaceChildren(
              h('div', { class: 'xs muted b' }, 'THE CHECK, STEP BY STEP'),
              h('div', { style: { fontSize: '17px', fontWeight: '800' } }, `${A.n} opens ${f.path.split('/').pop()}`),
              h('ol', { class: 'm0 checks' }, ...r.lines.map(([ok, t]) => h('li', { class: ok === true ? 'ok' : ok === false ? 'bad' : '', html: t }))),
              h('div', { class: 'narr ' + RES[r.res][0], html: `<b>${RES[r.res][1]}.</b> ${r.why}` }));
          }
          const actorSeg = ctx.ui.seg([{ value: 'notes', label: 'Notes asks' }, { value: 'game', label: 'Game asks' }], actor, (v) => { actor = v; draw(); });
          const eraSeg = ctx.ui.seg([{ value: 'legacy', label: 'Android 4.4 to 9' }, { value: 'scoped', label: 'Android 11+ (scoped)' }], era, (v) => { era = v; draw(); });
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: ctx.narrow ? '1fr' : '6fr 5fr' } },
            h('div', { class: 'stack', style: { gap: '8px' } },
              h('p', { class: 'm0', html: 'When an app is installed, Android gives it its own Linux <span class="t" data-t="user ID">user ID</span>, and every one of its processes runs as that user. Choose who is asking and which rules apply; every file shows whether opening it succeeds. Click a file to see why.' }),
              h('div', { class: 'row gap-s' }, actorSeg, eraSeg), h('div', { class: 'row' }, permBtn),
              list),
            h('div', { class: 'stack', style: { gap: '10px' } }, detail,
              h('div', { class: 'callout tip m0', 'data-label': 'Reading an app’s user name' }, h('span', { html: `<code>u0_a145</code> means user 0 (the phone’s first person), app number 145. Its numeric UID is 100000 × 0 + 10000 + 145 = <b>${uidOf(0, 145)}</b>. The same app in a second person’s profile (user 10) runs as <code>${uname(10, 145)}</code>, UID ${uidOf(10, 145)}, so even two people’s copies of one app are walled off.` })))));
          draw();
        },
      },
      {
        title: 'SQLite: a whole database in one file',
        kind: 'lab',
        render(el, ctx) {
          const { h } = ctx;
          const TITLES = ['Water the plants', 'Return library book', 'Pay phone bill', 'Book flu shot', 'Back up photos', 'Buy birthday card', 'Fix bike light'];
          const MAXROWS = 8;
          const clone = (a) => a.map((r) => ({ ...r }));
          let com, cur, inTx, touched, ti, log, hl;  // touched: some change ran inside the open transaction, so its journal exists
          const tbody = h('tbody');
          const files = h('div', { class: 'stack', style: { gap: '5px' } });
          const narr = h('div', { class: 'narr' });
          const logEl = h('div', { class: 'log sqlog', style: ctx.narrow ? { flex: 'none', height: '120px' } : {} });
          const txChip = h('span', { class: 'chip' });
          // rows on screen: the union of committed and current rows, each with its pending status
          function view() {
            const ids = [...new Set([...com.map((r) => r.id), ...cur.map((r) => r.id)])].sort((a, b) => a - b);
            return ids.map((id) => {
              const c = cur.find((r) => r.id === id), o = com.find((r) => r.id === id);
              const st = !o ? 'new' : !c ? 'del' : (c.title !== o.title || c.done !== o.done) ? 'chg' : '';
              return { ...(c || o), st };
            });
          }
          const pending = () => view().filter((r) => r.st).length;
          function say(cls, html) { narr.className = 'narr ' + cls; narr.innerHTML = html; }
          function addLog(sql, res) { log.push([sql, res]); if (log.length > 14) log.shift(); }
          function draw() {
            const ST = { new: 'new, not committed', chg: 'changed, not committed', del: 'deleted, not committed', '': 'committed' };
            tbody.replaceChildren(...view().map((r) => h('tr', { class: (hl.has(r.id) ? 'on ' : '') + (r.st ? 'pend ' + r.st : '') },
              h('td', { class: 'mono' }, String(r.id)), h('td', {}, r.title), h('td', { class: 'mono' }, String(r.done)), h('td', { class: 'xs' }, ST[r.st]))));
            const p = pending();
            txChip.className = 'chip ' + (inTx ? 'warn' : 'ok');
            txChip.textContent = inTx ? 'inside a transaction' : 'autocommit';
            files.replaceChildren(
              h('div', { class: 'mono small b', style: { overflowWrap: 'anywhere' } }, '/data/data/com.example.notes/databases/'),
              h('div', { class: 'fline' }, h('span', { class: 'chip mem mono' }, 'notes.db'), h('span', { class: 'small' }, `table definition + ${com.length} committed row${com.length === 1 ? '' : 's'}`)),
              inTx && touched ? h('div', { class: 'fline' }, h('span', { class: 'chip warn mono' }, 'notes.db-journal'), h('span', { class: 'small' }, 'original copies of the pages being changed')) : h('div', { class: 'fline muted small' }, inTx ? 'No journal yet: it appears at the first change.' : 'No journal: nothing is half-done.'),
              inTx ? h('div', { class: 'small', style: { color: 'var(--warn)' } }, `${p} pending change${p === 1 ? '' : 's'} held by the app, not yet permanent`) : '');
            logEl.replaceChildren(...log.map(([q, r]) => h('div', {}, h('span', { class: 'b' }, q), h('span', { class: 'muted' }, '  → ' + r))));
            logEl.scrollTop = logEl.scrollHeight;
          }
          // a change: run it on the working rows; outside a transaction it commits at once
          function change(fn, sql, what, n) {
            fn();
            if (n === 0) { addLog(sql, what); say('', `<code>${ctx.util.esc(sql)}</code><br>${what}: no row matched, so nothing changed.`); }
            else if (!inTx) { com = clone(cur); addLog(sql, what + ', committed'); say('ok', `<code>${ctx.util.esc(sql)}</code><br>${what}. No transaction was open, so this one statement was its own transaction and is already permanent in notes.db.`); }
            else { touched = true; addLog(sql, what + ', pending'); say('warn', `<code>${ctx.util.esc(sql)}</code><br>${what}, but only inside the open transaction. A journal now protects the old version until COMMIT.`); }
            hl = new Set(); draw();
          }
          const ops = {
            insert() {
              if (view().length >= MAXROWS) { say('warn', `This demo table holds at most ${MAXROWS} rows. Delete the done notes first.`); return; }
              // one more than the largest id in sight (committed or pending), so a rolled-back id can be reused later
              const row = { id: Math.max(0, ...cur.map((r) => r.id), ...com.map((r) => r.id)) + 1, title: TITLES[ti++ % TITLES.length], done: 0 };
              change(() => cur.push(row), `INSERT INTO notes(title, done) VALUES ('${row.title}', 0);`, `1 row inserted with id ${row.id}`);
            },
            update() {
              const t = cur.filter((r) => r.done === 0).sort((a, b) => a.id - b.id)[0];
              if (!t) { say('', 'Every note is already done, so there is nothing to mark.'); return; }
              change(() => { t.done = 1; }, `UPDATE notes SET done = 1 WHERE id = ${t.id};`, `1 row updated (id ${t.id})`);
            },
            del() {
              const n = cur.filter((r) => r.done === 1).length;
              change(() => { cur = cur.filter((r) => r.done === 0); }, 'DELETE FROM notes WHERE done = 1;', `${n} row${n === 1 ? '' : 's'} deleted`, n);
            },
            all() {
              hl = new Set(cur.map((r) => r.id));
              addLog('SELECT * FROM notes;', cur.length + ' rows');
              say('', `<code>SELECT * FROM notes;</code><br>${cur.length} row${cur.length === 1 ? '' : 's'} returned (highlighted).${inTx && pending() ? ' Inside its own transaction the app already sees its pending changes; other connections would not until COMMIT.' : ''}`);
              draw();
            },
            open() {
              const m = cur.filter((r) => r.done === 0);
              hl = new Set(m.map((r) => r.id));
              addLog('SELECT title FROM notes WHERE done = 0;', m.length + ' rows');
              say('', `<code>SELECT title FROM notes WHERE done = 0;</code><br>${m.length ? m.length + ' open note' + (m.length === 1 ? '' : 's') + ': ' + m.map((r) => '“' + r.title + '”').join(', ') : 'No open notes.'}`);
              draw();
            },
            begin() {
              if (inTx) { addLog('BEGIN;', 'error'); say('bad', '<code>BEGIN;</code><br>Error: cannot start a transaction within a transaction.'); draw(); return; }
              inTx = true; touched = false; hl = new Set(); addLog('BEGIN;', 'transaction open');
              say('warn', '<code>BEGIN;</code><br>A transaction is open. Every change from now on is pending until COMMIT, and all of them will succeed or fail together.'); draw();
            },
            commit() {
              if (!inTx) { addLog('COMMIT;', 'error'); say('bad', '<code>COMMIT;</code><br>Error: cannot commit, no transaction is active.'); draw(); return; }
              const p = pending(); com = clone(cur); inTx = false; hl = new Set(); addLog('COMMIT;', p + (p === 1 ? ' change' : ' changes') + ' made permanent');
              say('ok', '<code>COMMIT;</code><br>' + (p === 0 ? 'No row differs from the committed version, so COMMIT simply closes the transaction.'
                : `SQLite writes the changed pages into notes.db, then deletes the journal. Deleting the journal is the instant ${p === 1 ? 'the change becomes permanent' : 'all ' + p + ' changes become permanent together'}.`)); draw();
            },
            rollback() {
              if (!inTx) { addLog('ROLLBACK;', 'error'); say('bad', '<code>ROLLBACK;</code><br>Error: cannot roll back, no transaction is active.'); draw(); return; }
              const p = pending(); cur = clone(com); inTx = false; hl = new Set(); addLog('ROLLBACK;', p + (p === 1 ? ' change' : ' changes') + ' undone');
              say('ok', '<code>ROLLBACK;</code><br>' + (p === 0 ? 'No row differs from the committed version, so ROLLBACK simply closes the transaction.'
                : `The app changed its mind: ${p === 1 ? 'the pending change is' : 'all ' + p + ' pending changes are'} thrown away, and the table is exactly as it was at BEGIN.`)); draw();
            },
            crash() {
              hl = new Set();
              if (inTx) {
                const p = pending(); cur = clone(com); inTx = false; addLog('(power lost)', p + (p === 1 ? ' pending change' : ' pending changes') + ' rolled back on restart');
                say('bad', p === 0 ? '<b>Power lost inside a transaction</b> that left no row different from the committed version, so nothing of yours is lost. The open transaction is simply gone.'
                  : `<b>Power lost mid-transaction.</b> Any changed pages that had already reached notes.db are undone on restart: SQLite finds the leftover (“hot”) journal and copies the original pages back. ${p === 1 ? 'The pending change vanishes' : 'All ' + p + ' pending changes vanish together'}; the ${com.length} committed row${com.length === 1 ? ' is' : 's are'} intact. Never half a transaction.`);
              } else {
                addLog('(power lost)', 'nothing to undo');
                say('ok', '<b>Power lost with no transaction open.</b> Every statement had already committed, so nothing is lost and nothing is half-done.');
              }
              draw();
            },
          };
          function reset() {
            com = [{ id: 1, title: 'Buy milk', done: 0 }, { id: 2, title: 'Call the dentist', done: 1 }];
            cur = clone(com); inTx = false; touched = false; ti = 0; log = []; hl = new Set();
            say('', 'The table <b>notes</b> starts with two committed rows. Run statements, or open a transaction with BEGIN and try pulling the battery.');
            draw();
          }
          const B = (label, fn, cls) => h('button', { class: 'btn sm ' + (cls || ''), type: 'button', onclick: fn }, label);
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack sqleft', style: { gap: '8px' } },
              h('p', { class: 'm0', html: '<span class="t">SQLite</span> is a <b>library</b> that runs inside the app’s own process: no database server, no network. A whole database is one ordinary file in the app’s private directory, so the sandbox protects it like any other file.' }),
              h('div', { class: 'card tight stack', style: { gap: '6px' } }, files),
              h('div', { class: 'xs muted b' }, 'STATEMENTS SO FAR'), logEl,
              h('p', { class: 'xs muted m0' }, 'A simplified simulation of SQLite’s classic rollback journal. Android often uses write-ahead-log mode instead (a notes.db-wal file); the all-or-nothing guarantee is the same.'),
              h('div', { class: 'callout why m0', 'data-label': 'Why it matters on a phone' }, 'Batteries die and Android kills background apps without warning. A transaction lands completely or not at all.')),
            h('div', { class: 'stack', style: { gap: '8px' } },
              h('div', { class: 'sqbtns', style: ctx.narrow ? { gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' } : {} }, B('INSERT', () => ops.insert(), 'mem'), B('UPDATE', () => ops.update(), 'mem'), B('DELETE', () => ops.del(), 'mem'), B('SELECT all', () => ops.all(), 'cpu'), B('SELECT open', () => ops.open(), 'cpu'),
                B('BEGIN', () => ops.begin(), 'os'), B('COMMIT', () => ops.commit(), 'os'), B('ROLLBACK', () => ops.rollback(), 'os'), B('Pull the battery', () => ops.crash(), 'intr'), B('Reset', reset, 'ghost')),
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', {}, 'Table notes (id, title, done)'), txChip),
              h('table', { class: 'tbl compact sqt' }, h('thead', {}, h('tr', {}, h('th', {}, 'id'), h('th', {}, 'title'), h('th', {}, 'done'), h('th', {}, 'status'))), tbody),
              narr)));
          reset();
        },
      },
      {
        title: 'Recap: Android file management in six cards',
        kind: 'recap',
        render(el, ctx) {
          el.append(ctx.h('div', { class: 'stack fill' },
            ctx.h('p', { class: 'lead m0' }, 'Say each answer out loud before you flip the card.'),
            ctx.ui.flipcards([
              ['What really stores an Android file?', 'Linux. App requests become ordinary system calls that go through the VFS to a Linux file system, usually ext4 or F2FS, in a partition of the flash chip.'],
              ['What does a factory reset erase?', 'The data partition, including the emulated shared storage inside it, plus the cache. Boot, system and recovery are left alone, so the current Android version stays.'],
              ['What does a system update rewrite?', 'The OS partitions: system and boot (on A/B phones, the inactive slot, written while you keep working). Your apps and files in data are left as they are.'],
              ['Why can’t one app read another app’s private files?', 'Each app runs as its own Linux user. Its directory in /data is owned by that user ID with no rights for others, so the kernel refuses everyone else.'],
              ['What does scoped storage allow?', 'Since Android 10 (required for apps targeting 11+): an app uses its own folder and the media it added freely. Others’ media need a user-granted permission; other files come only through the system file picker.'],
              ['What makes SQLite special?', 'It is a library inside the app, not a server. A whole database is one file in the app’s private directory, and transactions make each group of changes all-or-nothing.'],
            ], { cols: ctx.narrow ? 1 : 3, height: 222 })));
        },
      },
      {
        title: 'Check yourself',
        kind: 'check',
        quiz: [
          { q: 'Which file system is the data partition of a typical Android phone most likely to use?',
            choices: ['NTFS, the Windows file system', 'ext4 or F2FS', 'FAT32, as on a USB stick', 'An Android-only file system'], answer: 1,
            feedback: ['NTFS is the Windows file system. Android uses the file systems of the Linux kernel it runs on.', null, 'FAT32 has no owners or permission bits, so it could not enforce the app sandbox. At most it appears on a removable card.', 'There is no special Android file system: Android uses ordinary Linux file systems.'],
            why: 'Android runs on the Linux kernel, so it stores files with Linux file systems: ext4 on many phones and F2FS, designed for flash, on many others.' },
          { type: 'tf', q: 'A factory reset erases the system partition, so the phone goes back to the Android version it originally shipped with.', answer: false,
            why: 'A factory reset formats only data (and cache). The system partition is untouched, so the phone keeps whatever Android version its last update installed.' },
          { type: 'tf', q: 'On most phones, the shared storage that apps see as /sdcard is physically a folder inside the data partition.', answer: true,
            why: 'Shared storage is usually “emulated”: it lives in /data/media and is shown to apps through a special layer. That is why a factory reset also erases photos and downloads.' },
          { type: 'match', q: 'Match each classic Android partition to what it holds.',
            pairs: [['boot', 'The Linux kernel and its ramdisk'], ['system', 'The framework and preinstalled apps, read-only'], ['recovery', 'A separate system that installs updates and wipes data'], ['data', 'Installed apps and their private files'], ['cache', 'A downloaded update package and recovery logs'], ['misc', 'A message telling the bootloader to start recovery']],
            why: 'Each partition has one job. The OS lives in boot, system and recovery; the user’s things live in data; cache and misc hold throw-away files and small flags.' },
          { type: 'bucket', q: 'A phone with the classic layout is factory-reset. Which of these are erased, and which are kept?', buckets: ['Erased', 'Kept'],
            items: [['A game the user installed', 0], ['Camera photos in the built-in (emulated) shared storage, never backed up', 0], ['The preinstalled dialer app', 1], ['The Linux kernel', 1], ['A chat app’s database of conversations', 0], ['The most recent system update the user installed', 1]],
            why: 'The reset formats data, and the emulated shared storage lives inside data. Boot and system are not touched, so the kernel, the preinstalled apps and the updated OS all survive.' },
          { type: 'num', q: 'An app runs as the Android Linux user <code>u0_a57</code>. What is its numeric UID? (UID = 100000 × user number + 10000 + app number)', answer: uidOf(0, 57), tol: 0,
            why: `User 0, app 57: 100000 × 0 + 10000 + 57 = ${uidOf(0, 57)}. App UIDs start at 10000, and each further person on the device adds 100000.` },
          { q: 'The Game app runs as UID 10145. It tries to open <code>/data/data/com.example.notes/databases/notes.db</code>, owned by user 10123 and group 10123 (Notes’ own group) with mode <code>rw-rw----</code>. What happens?',
            choices: ['It succeeds once the user grants Game the storage permission.', 'It succeeds on Android 9 and earlier, but fails since Android 11.', 'It fails: Game’s UID is not the owner and others get no access.', 'It succeeds, because both apps belong to the same person, user 0.'], answer: 2,
            feedback: ['The storage permission concerns shared storage only. It never opens another app’s private directory.', 'Private directories have been walled off by Linux user IDs since the first Android release; the Android 10/11 changes were about shared storage.', null, 'Each app has its own Linux user ID even when one person owns both apps. Being on the same device user changes nothing.'],
            why: 'The kernel checks the process UID against the file’s owner. 10145 is not 10123 and not in its group, so the “others” bits (no rights) apply and open() fails with “Permission denied”.' },
          { type: 'multi', q: 'Under scoped storage (Android 11 and later), which of these may an ordinary app do <b>without</b> the user granting any permission?',
            choices: ['Read and write its own private directory in /data', 'Add a photo to the shared Pictures collection and read it back', 'Read photos that other apps saved', 'Open another app’s folder under Android/data', 'Use its own folder under Android/data on shared storage'], answer: [0, 1, 4],
            why: 'An app always owns its private directory, its own Android/data folder and the media it added. Other apps’ photos need a user-granted media permission, and other apps’ Android/data folders are closed to everyone.' },
          { type: 'order', q: 'Put the steps of a classic (non-A/B) system update in order.',
            items: ['Android downloads the update package into the cache partition', 'Android writes an “install the update” message into misc and reboots', 'The bootloader reads misc and starts recovery', 'Recovery verifies the package and rewrites system and boot', 'The phone restarts into the new version with its user data untouched'],
            why: 'Normal Android cannot rewrite the system it is running from, so it parks the package in cache, leaves a note in misc and hands over to recovery, which does the rewriting.' },
          { q: 'Which statement about SQLite on Android is correct?',
            choices: ['Each app connects over the network to a shared SQLite server.', 'SQLite keeps every table in its own file under /system.', 'An SQLite database exists only in memory and vanishes on exit.', 'A database is one file inside the app’s private directory.'], answer: 3,
            feedback: ['SQLite has no server: it is a library that runs inside the app’s own process.', 'A whole database, all of its tables included, is one file, and apps cannot write to read-only /system.', 'The database is an ordinary file on flash, so it survives the app closing and the phone restarting.', null],
            why: 'SQLite is an embedded engine: the library inside the app reads and writes one database file, usually in /data/data/&lt;package&gt;/databases/, which the app sandbox protects.' },
          { type: 'tf', q: 'An app opens a transaction and inserts three rows. If the battery dies before COMMIT, some of the three rows may still be in the database after restart.', answer: false,
            why: 'A transaction is all-or-nothing. On restart SQLite finds the leftover journal and restores the old pages, so none of the three rows appear.' },
          { q: 'What is the main benefit of A/B (seamless) updates?',
            choices: ['The update goes to the unused slot as you keep working; a failed boot falls back.', 'Every app keeps two copies of its private data, so a reset can be undone.', 'The data partition is split in two, so photos never crowd out installed apps.', 'The bootloader installs it from the cache partition while the screen is off.'], answer: 0,
            feedback: [null, 'The two slots hold copies of the operating system only; user data has a single copy.', 'A/B concerns the OS partitions, not the data partition.', 'A/B phones need no cache partition: the running system writes the new version straight into the other slot.'],
            why: 'With two slots, the inactive one is updated in the background, a single reboot switches over, and if the new slot does not boot, the bootloader returns to the old one.' },
        ],
      },
    ],
    notes: `
      <h3>1. Android files are Linux files</h3>
      <p>Android runs on the Linux kernel, so it manages files with ordinary Linux machinery. When an app saves something, its Java or Kotlin call is turned by libraries in its own process (Java libraries, SQLite, the C library) into Linux system calls such as <code>open()</code>, <code>write()</code> and <code>fsync()</code>. The kernel’s virtual file system (VFS, section 12.9) checks permissions and passes each call to the file system that owns the path. The block layer and the flash driver then move the blocks to the flash chip (UFS or eMMC). There is no special “Android file system”.</p>
      <ul>
        <li><b>ext4</b> (fourth extended file system): the standard Linux disk file system, used by Android since version 2.3 (2010).</li>
        <li><b>F2FS</b> (Flash-Friendly File System): a Linux file system Samsung designed for flash; it writes new data in long sequential runs. Many phones use it for the data partition.</li>
        <li>Read-only system partitions use ext4 or, on some newer phones, EROFS (Enhanced Read-Only File System), which can compress its contents.</li>
      </ul>
      <p>What Android adds is policy: a fixed set of partitions with clear jobs, a separate Linux user for every app, and SQLite as the standard database.</p>

      <h3>2. The classic partition layout</h3>
      <p>A <b>partition</b> is a fixed, separately managed region of the storage device with its own file system (or raw contents), so one can be erased or rewritten without touching the others. Phone makers vary the exact set.</p>
      <table>
        <tr><th>Partition</th><th>Holds</th><th>Normal use</th><th>Factory reset</th><th>Classic system update</th></tr>
        <tr><td>boot</td><td>Linux kernel + ramdisk (with init)</td><td>raw image, not mounted</td><td>unchanged</td><td>rewritten</td></tr>
        <tr><td>recovery</td><td>a second bootable system: own kernel, ramdisk, recovery program</td><td>started only when needed</td><td>used (it does the wiping)</td><td>used (verifies and installs)</td></tr>
        <tr><td>misc</td><td>tiny flags, e.g. “boot into recovery and do X”; some hardware settings</td><td>raw, not mounted</td><td>used (carries the wipe message)</td><td>used (carries the install message)</td></tr>
        <tr><td>system (/system)</td><td>framework, system libraries, runtime, preinstalled apps</td><td>mounted read-only, checked as read</td><td>unchanged</td><td>rewritten</td></tr>
        <tr><td>cache (/cache)</td><td>throw-away data: downloaded update package, recovery logs</td><td>read-write</td><td>erased</td><td>used (holds the package)</td></tr>
        <tr><td>data (/data, “userdata”)</td><td>installed apps (/data/app), app-private directories (/data/data/&lt;package&gt;), accounts and settings (/data/system), emulated shared storage (/data/media)</td><td>read-write, encrypted</td><td>erased</td><td>unchanged</td></tr>
      </table>
      <p>The <b>bootloader</b> runs first at power-on and loads the kernel from boot, or from recovery when misc asks it to. The <b>ramdisk</b> is a small file-system image copied into memory at boot; init runs from it and mounts the real partitions. Since Android 8.0 the maker’s drivers and hardware libraries (camera, radio, sensors) sit in a separate <b>vendor</b> partition.</p>
      <p><b>Shared storage</b> (external storage) is what apps see as <code>/sdcard</code> or <code>/storage/emulated/0</code>: DCIM, Pictures, Music, Download. On most phones it is emulated: a folder under /data/media (/data/media/0 for the first user) inside the data partition, not a separate card. A removable microSD card, if present, is a separate device (usually exFAT or FAT32) that a reset normally leaves alone.</p>
      <h4>Factory reset</h4>
      <p>Android writes a wipe command into misc and reboots; the bootloader starts recovery; recovery formats data and cache; the phone restarts into the setup screen. Boot, system and recovery are untouched, so the phone keeps the Android version of its last update. Photos in emulated shared storage are erased with data.</p>
      <h4>Classic system update (over-the-air, OTA)</h4>
      <ol><li>Android downloads the update package into cache (some phones use /data) and checks it.</li><li>It writes “install this package” into misc and reboots.</li><li>The bootloader reads misc and starts recovery.</li><li>Recovery verifies the package’s signature and rewrites system and boot.</li><li>The phone restarts into the new version; your apps and files in data are unchanged.</li></ol>
      <p>Normal Android cannot safely rewrite the read-only system it is running from, which is why the work is handed to recovery.</p>

      <h3>3. Newer phones: A/B updates and dynamic partitions</h3>
      <ul>
        <li><b>A/B (seamless) updates</b>, Android 7.0: two copies, slot A and slot B, of boot and the system partitions. The update is written into the inactive slot while the phone keeps running; misc (on many phones) records “try slot B next”; one reboot switches; if the new slot fails to boot, the bootloader falls back to the old one. Such phones need no cache partition, and most have no recovery partition either: the recovery program lives inside a boot image.</li>
        <li><b>Dynamic partitions</b>, Android 10: system, vendor, product and similar partitions are logical partitions inside one physical partition named <b>super</b>, managed by the kernel’s device mapper (which maps each logical partition onto ranges of real blocks), so an update can resize them.</li>
        <li><b>Virtual A/B</b>, Android 11: saves space by keeping only the changes, as a snapshot (in super, or in free space on userdata if super is full), until the new version has booted; then they are merged in.</li>
      </ul>
      <p>A factory reset on these phones still erases only userdata; both OS slots survive. An update leaves the user’s apps and files in userdata as they were.</p>

      <h3>4. The app sandbox: one Linux user per app</h3>
      <p>At install time every app gets its own Linux user ID, and all its processes run as that user. Its <b>app-private directory</b> (internal storage), e.g. <code>/data/data/com.example.notes</code> (also reachable as /data/user/0/…), is owned by that UID with mode <code>rwx------</code> (for apps targeting Android 7.0 or later). Each app also gets its own Linux group, so its files are typically <code>rw-rw----</code> with that private group: the app may read and write, all others get nothing. When another app opens such a file, the kernel’s ordinary owner/group/others check fails and <code>open()</code> returns “Permission denied”. No Android permission and no Android version changes this; SELinux, a second kernel security layer with its own rule for every app, adds an independent wall.</p>
      <p><b>Naming:</b> <code>u0_a145</code> = device user 0, app 145. UID = 100000 × user + 10000 + app. Worked example: u0_a145 → 0 + 10000 + 145 = 10145; the same app for user 10 is u10_a145 = 1,000,000 + 10,000 + 145 = 1010145. App UIDs start at 10000.</p>
      <h4>Shared storage rules</h4>
      <ul>
        <li><b>Before scoped storage</b> (Android 4.4 to 9): Android did not track who created a shared file. One permission, READ_EXTERNAL_STORAGE, opened all of shared storage, other apps’ folders included. (Before 4.4, reading shared storage needed no permission at all.)</li>
        <li><b>Scoped storage</b>: introduced in Android 10 (apps targeting Android 10 could still opt out), required for apps targeting Android 11 or later.
          <ul>
            <li>An app may always use its own folder <code>Android/data/&lt;package&gt;</code> on shared storage, with no permission (true since Android 4.4).</li>
            <li>It may add photos, videos and audio through MediaStore (Android’s index of shared media) and read back what it added, with no permission.</li>
            <li>Other apps’ media need a user-granted permission: READ_EXTERNAL_STORAGE on Android 10 to 12; since Android 13 separate ones for images, video and audio (READ_MEDIA_IMAGES, READ_MEDIA_VIDEO, READ_MEDIA_AUDIO); since Android 14 the user may grant only selected photos and videos.</li>
            <li>Other apps’ documents (e.g. a downloaded PDF) can only be opened when the user picks them in the system file picker (the Storage Access Framework), which grants access to exactly those files. (Only special apps such as file managers may request “all files access”, Android 11 and later.)</li>
            <li>Since Android 11 no ordinary app can open another app’s Android/data folder.</li>
          </ul></li>
      </ul>

      <h3>5. SQLite</h3>
      <p><b>SQLite</b> is Android’s standard on-device relational database: a small but complete SQL engine that runs as a library inside the app’s own process. There is no database server and no network connection. A whole database (table definitions and every row) is one ordinary file, usually <code>/data/data/&lt;package&gt;/databases/name.db</code>, so the app sandbox protects it like any other file. Apps use it through Android’s database classes or the Room library; system components such as the contacts and messaging providers keep their data in SQLite databases too.</p>
      <p>Statements: <code>INSERT</code> adds rows, <code>UPDATE</code> changes them, <code>DELETE</code> removes them, <code>SELECT</code> reads them (optionally with <code>WHERE</code>).</p>
      <p>A <b>transaction</b> groups changes so that all of them become permanent (COMMIT) or none do (ROLLBACK), even if the power fails part-way. Outside <code>BEGIN … COMMIT</code>, each statement is its own transaction (autocommit). With the classic rollback journal, the first change inside a transaction creates <code>name.db-journal</code> holding original copies of the pages being changed. COMMIT writes the new pages into the database and then deletes the journal; that deletion is the commit point. If the power fails before it, the next open finds the leftover (“hot”) journal and copies the original pages back over any changes that had already reached the file, so the database looks exactly as it did before BEGIN: never half a transaction. Android often runs SQLite in write-ahead-log mode (a <code>name.db-wal</code> file) instead; the all-or-nothing guarantee is the same.</p>
    `,
  });
})();
