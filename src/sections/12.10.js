/* =====================================================================
   12.10 Windows File System (NTFS)
   Original teaching material. Helpers shared by several steps live inside
   this IIFE (no globals).
   ===================================================================== */
(function () {
  /* ---------- units (binary: 1 KB = 1,024 bytes, 1 GB = 2^30 bytes) ---------- */
  const KB = 1024, MB = KB * KB, GB = MB * KB, TB = GB * KB, PB = TB * KB;
  const MAXCL = 2 ** 32 - 1;                     // most clusters current Windows allows on one NTFS volume
  const n2s = (n) => Math.round(n).toLocaleString('en-US');
  const rng = (a, b) => a === b ? n2s(a) : `${n2s(a)}–${n2s(b)}`;   // "36" or "30–51"
  function size(b) {                              // 4096 -> "4 KB", 3481216 -> "3.32 MB"
    for (const [v, u] of [[PB, 'PB'], [TB, 'TB'], [GB, 'GB'], [MB, 'MB'], [KB, 'KB']]) {
      if (b >= v) { const x = b / v; return (Number.isInteger(x) ? n2s(x) : x < 10 ? x.toFixed(2) : x < 100 ? x.toFixed(1) : n2s(x)) + ' ' + u; }
    }
    return n2s(b) + ' B';
  }
  // default cluster size of recent Windows: the smallest power of two from 4 KB up that keeps the count under 2^32 clusters
  function defaultCluster(vol) { let c = 4 * KB; while (Math.floor(vol / c) > MAXCL) c *= 2; return c; }

  /* ---------- the MFT record model (byte sizes are close to real NTFS 3.1, rounded to 8 bytes) ---------- */
  const REC = 1024, HDR = 56, SI = 96, ENDM = 8;  // record size, record header, standard information, end marker
  const r8 = (n) => Math.ceil(n / 8) * 8;
  const fnSize = (name) => r8(24 + 66 + 2 * name.length);                 // file name attribute: header + fixed part + UTF-16 name
  const resSize = (n, sname = '') => 24 + r8(2 * sname.length) + r8(n);   // resident attribute: header, optional stream name, value
  const sb = (v) => { let n = 1; while (v < -(2 ** (8 * n - 1)) || v >= 2 ** (8 * n - 1)) n++; return n; }; // bytes for a signed number
  function runListBytes(runs) {                   // NTFS packs each run as: 1 header byte + length bytes + (LCN minus previous LCN) bytes
    let prev = 0, b = 1;                          // the final 0 byte ends the list
    runs.forEach((r) => { b += 1 + sb(r.len) + sb(r.lcn - prev); prev = r.lcn; });
    return b;
  }
  const nonresSize = (runs, sname = '') => 64 + r8(2 * sname.length) + r8(runListBytes(runs)); // nonresident header + run list
  const maxResident = (name) => REC - HDR - SI - fnSize(name) - 24 - ENDM; // biggest data that still fits in a one-name file's record

  /* ---------- trip.jpg: the big file of steps 4 and 5 ---------- */
  const CL = 4 * KB;                              // cluster size used by every example volume (the usual default)
  const TRIP = { name: 'trip.jpg', size: 300000 };
  TRIP.clusters = Math.ceil(TRIP.size / CL);      // 74 clusters, the last one only partly used
  function scattered() {                          // one run per cluster, at pseudo-random places (fixed seed, so always the same)
    let x = 12345, prev = -9;
    const runs = [];
    for (let v = 0; v < TRIP.clusters; v++) {
      x = (x * 1103515245 + 12345) % 2147483648;
      let lcn = 1500 + (x % 62000);
      if (Math.abs(lcn - prev) <= 1) lcn += 9;    // never adjacent to the previous piece, so these really are 74 separate runs
      runs.push({ vcn: v, lcn, len: 1 });
      prev = lcn;
    }
    return runs;
  }
  const LAYOUTS = {
    one: [{ vcn: 0, lcn: 40960, len: 74 }],
    three: [{ vcn: 0, lcn: 10240, len: 30 }, { vcn: 30, lcn: 52000, len: 22 }, { vcn: 52, lcn: 31500, len: 22 }],
    many: scattered(),
  };
  function vcnToLcn(runs, vcn) {                  // find the run that holds this VCN and offset into it
    const i = runs.findIndex((r) => vcn >= r.vcn && vcn < r.vcn + r.len);
    return { i, run: runs[i], lcn: runs[i].lcn + (vcn - runs[i].vcn) };
  }

  /* ---------- the crash lab: transaction T1 creates Docs\plan.txt with four metadata changes ---------- */
  const KEYS = ['mbit', 'rec', 'idx', 'cl'];
  const UPD = { 101: 'mbit', 102: 'rec', 103: 'idx', 104: 'cl' };
  const PART = {
    mbit: ['MFT bitmap', 'bit 42: 0', 'bit 42: 1'],
    rec: ['MFT record 42', 'empty', 'plan.txt'],
    idx: ['Docs index', 'no plan.txt', 'plan.txt → 42'],
    cl: ['Cluster bitmap', '700–702 free', '700–702 used'],
  };
  function crashEvents(obey) {
    const ev = [
      { t: 'T1 logs <b>LSN 101</b> and marks record 42 in use', cache: ['mbit'], log: [101] },
      { t: 'T1 logs <b>LSN 102</b> and fills in record 42', cache: ['rec'], log: [102] },
      { t: 'T1 logs <b>LSN 103</b> and adds plan.txt to the Docs index', cache: ['idx'], log: [103] },
      { t: 'T1 logs <b>LSN 104</b> and marks clusters 700–702 used', cache: ['cl'], log: [104] },
      { t: 'Log flush: LSN 101–104 reach the log <b>on disk</b>', flush: [101, 102, 103, 104] },
      { t: 'Lazy writer: MFT bitmap and record 42 written <b>to disk</b>', disk: ['mbit', 'rec'] },
      { t: 'T1 commits: <b>LSN 105</b> (commit) logged in the cache', log: [105] },
      { t: 'Log flush: LSN 105 reaches the log <b>on disk</b>', flush: [105] },
      { t: 'Lazy writer: Docs index and cluster bitmap written <b>to disk</b>', disk: ['idx', 'cl'] },
    ];
    if (!obey) [ev[4], ev[5]] = [ev[5], ev[4]]; // the broken order: metadata pages go to disk before their log records
    return ev;
  }
  const consistent = (st) => KEYS.every((k) => st[k] === 'old') || KEYS.every((k) => st[k] === 'new');
  function damage(st) {                           // what is wrong with an inconsistent set of structures, in words
    const out = [];
    if (st.mbit === 'new' && st.idx === 'old') out.push('Record 42 is marked in use, but no folder lists it: an orphaned record nothing can reach.');
    if (st.mbit === 'old' && st.rec === 'new') out.push('Record 42 holds plan.txt but is marked free: NTFS could hand it out again and overwrite it.');
    if (st.idx === 'new' && (st.mbit === 'old' || st.rec === 'old')) out.push('The Docs folder lists plan.txt, but record 42 is free or empty: the name points at nothing.');
    if (st.rec === 'new' && st.cl === 'old') out.push('Record 42 says plan.txt owns clusters 700–702, but the bitmap calls them free: the next new file could get the same clusters.');
    if (st.cl === 'new' && st.rec === 'old') out.push('Clusters 700–702 are marked used, but no record owns them: that space has leaked.');
    return out;
  }
  function crashSim(obey, k) {                    // the power fails after the first k events
    const ev = crashEvents(obey).slice(0, k);
    const cache = {}, disk = {}, cacheLog = [], diskLog = [];
    KEYS.forEach((key) => { cache[key] = 'old'; disk[key] = 'old'; });
    ev.forEach((e) => {
      (e.cache || []).forEach((key) => { cache[key] = 'new'; });
      (e.log || []).forEach((l) => cacheLog.push(l));
      (e.disk || []).forEach((key) => { disk[key] = 'new'; });
      (e.flush || []).forEach((l) => diskLog.push(l));
    });
    const committed = diskLog.includes(105);
    const ups = diskLog.filter((l) => l !== 105);
    const actions = committed ? ups.map((l) => ({ lsn: l, op: 'redo', key: UPD[l] }))
      : ups.slice().reverse().map((l) => ({ lsn: l, op: 'undo', key: UPD[l] }));
    const after = Object.assign({}, disk);
    actions.forEach((a) => { after[a.key] = a.op === 'redo' ? 'new' : 'old'; });
    return { cache, disk, cacheLog, diskLog, committed, actions, after, okDisk: consistent(disk), okAfter: consistent(after) };
  }

  /* ---------- step 4: the five example records, as lists of attributes ---------- */
  const DLF = { name: 'Quarterly Report 2026.docx', short: 'QUARTE~1.DOC', size: 41872, zone: 26 }; // zone: bytes of "[ZoneTransfer]\r\nZoneId=3\r\n"
  DLF.runs = [{ vcn: 0, lcn: 77310, len: Math.ceil(DLF.size / CL) }];
  const DIRF = { name: 'Docs', files: 40, runs: [{ vcn: 0, lcn: 9120, len: 2 }] };   // 40 names fill two 4 KB index blocks
  const runsOfSmall = (n) => [{ vcn: 0, lcn: 48213, len: Math.ceil(n / CL) }];
  const runText = (runs) => runs.length > 1 ? `${runs.length} runs` : runs[0].len === 1 ? `one run: VCN 0 at LCN ${n2s(runs[0].lcn)}` : `one run: VCN 0–${runs[0].len - 1} at LCN ${n2s(runs[0].lcn)}–${n2s(runs[0].lcn + runs[0].len - 1)}`;
  // each attribute: id, name, type, b (bytes in the record), res (true / false / null), c (colour), short (label on the bar), txt (HTML)
  function recordOf(fk, small) {
    const A = [{ id: 'hdr', name: 'Record header', type: 'not an attribute', b: HDR, res: null, c: 'panel', short: 'Hdr',
      txt: 'The record\'s own bookkeeping, not an attribute. It says whether the record is in use and whether it describes a file or a folder, holds a sequence number that goes up each time the record is reused (so a stale reference to an old file is caught), and a <b>link count</b>: how many names point at this record.' }];
    A.push({ id: 'si', name: 'Standard information', type: '$STANDARD_INFORMATION · 0x10', b: SI, res: true, c: 'os', short: 'Std',
      txt: 'Flags such as read-only, hidden, system and archive, and four time stamps: created, contents changed, record changed, last read. Since NTFS 3.0 it also holds the owner\'s ID, a <b>security ID</b> that points to the file\'s <span class="t">security descriptor</span> in $Secure, the disk-quota charge, and the file\'s latest change-journal number.' });
    const fn = (name, extra) => ({ id: 'fn', name: 'File name', type: '$FILE_NAME · 0x30', b: fnSize(name), res: true, c: 'proc', short: 'Name',
      txt: `The name “${name}” (up to 255 Unicode characters), the MFT record number of the folder that holds it, and copies of the size and time stamps so that folder listings are fast. A file has one of these for every name it has. ${extra}` });
    const data = (n, runs, extra) => runs
      ? { id: 'data', name: 'Data', type: '$DATA · 0x80', b: nonresSize(runs), res: false, c: 'mem', short: 'Data', runs,
        txt: `The contents (${n2s(n)} bytes) are too big for the record, so they live in ${(() => { const c = runs.reduce((a, r) => a + r.len, 0); return c === 1 ? 'one cluster' : n2s(c) + ' clusters'; })()} elsewhere: a <span class="t">nonresident attribute</span>. The record keeps only a list of <span class="t">data run</span>s (${runText(runs)}), packed into ${runListBytes(runs)} bytes. ${extra}` }
      : { id: 'data', name: 'Data', type: '$DATA · 0x80', b: resSize(n), res: true, c: 'mem', short: 'Data',
        txt: `The file's contents, all ${n2s(n)} bytes, stored right here in the record: a <span class="t">resident attribute</span>. Reading the file costs no extra disk access, because reading the record already brought the data in. ${extra}` };
    if (fk === 'small') {
      const max = maxResident('todo.txt');
      A.push(fn('todo.txt', 'Its folder is record 5, the root folder.'));
      A.push(small <= max ? data(small, null, `It still fits: up to ${max} bytes can stay resident in a record with this name.`)
        : data(small, runsOfSmall(small), `At ${n2s(small)} bytes it no longer fits (the limit for this record is ${max} bytes), so NTFS moved it out to a cluster. Real NTFS does not move it back in, even if the file shrinks again.`));
    } else if (fk === 'big') {
      A.push(fn(TRIP.name, 'Its folder is Photos.'));
      A.push(data(TRIP.size, LAYOUTS.three, 'Step 5 follows these runs.'));
    } else if (fk === 'dir') {
      A.push(fn(DIRF.name, 'Its folder is record 5, the root.'));
      A.push({ id: 'iroot', name: 'Index root', type: '$INDEX_ROOT · 0x90', b: 24 + 8 + 16 + 16 + r8(16 + 66 + 16) + 8 + 24, res: true, c: 'io', short: 'Index root',
        txt: `The top node of the folder's index, always resident. The index is a balanced tree of names, sorted so a name is found without reading every entry. It is often called a B+ tree, but like the plain B-tree of 12.3 it keeps real entries in its upper nodes too. For these ${DIRF.files} files the root holds one name, “lab4.pdf”, and two pointers: names that sort before it are in index block 0, the names after it in index block 1. A folder has no data attribute: its index is its contents.` });
      A.push({ id: 'ialloc', name: 'Index allocation', type: '$INDEX_ALLOCATION · 0xA0', b: nonresSize(DIRF.runs, '$I30'), res: false, c: 'thread', short: 'Index alloc.', runs: DIRF.runs,
        txt: `The rest of the tree: index blocks of 4 KB each, kept in clusters outside the record (nonresident; ${runText(DIRF.runs)}). Each entry holds a file name and the MFT record number of that file. The other ${DIRF.files - 1} entries, about 112 bytes each, need two blocks.` });
      A.push({ id: 'bmp', name: 'Bitmap', type: '$BITMAP · 0xB0', b: resSize(8, '$I30'), res: true, c: 'warn', short: 'Bitmap',
        txt: 'One bit per index block of the index allocation: 1 if that block is in use. Here the bits are 1 1: both blocks are in use. The MFT uses a bitmap attribute the same way, to mark which of its own records are in use.' });
    } else if (fk === 'dl') {
      A.push(fn(DLF.name, 'This is the long name you see in File Explorer.'));
      A.push(Object.assign(fn(DLF.short, 'This short 8.3 form exists for very old programs; Windows still makes one by default on the system drive, while newer versions usually skip it on other drives. Both names belong to one single file.'), { id: 'fn2', short: 'Short name', name: 'File name (short)' }));
      A.push(data(DLF.size, DLF.runs, ''));
      A.push({ id: 'zone', name: 'Data: Zone.Identifier', type: '$DATA · 0x80, named', b: resSize(DLF.zone, 'Zone.Identifier'), res: true, c: 'thread', short: 'Zone',
        txt: `A second, named data stream: an <span class="t">alternate data stream</span>. Its ${DLF.zone} bytes read <code>[ZoneTransfer]</code> <code>ZoneId=3</code>. Zone 3 means “the Internet”, so Windows warns before opening the file (newer versions also note the web address it came from). File Explorer's size column ignores it.` });
    } else {
      A.push(fn('$Volume', 'Its folder is the root, record 5. This is MFT record 3.'));
      A.push({ id: 'vname', name: 'Volume name', type: '$VOLUME_NAME · 0x60', b: resSize(14), res: true, c: 'thread', short: 'Name',
        txt: 'The volume\'s label, the name shown next to the drive letter in File Explorer: here “Windows”. Only the $Volume file has this attribute.' });
      A.push({ id: 'vinfo', name: 'Volume information', type: '$VOLUME_INFORMATION · 0x70', b: resSize(12), res: true, c: 'warn', short: 'Vol. info',
        txt: 'The NTFS version of the volume (3.1, unchanged since Windows XP) and flags. One flag is the <b>dirty bit</b>: NTFS sets it when it finds or suspects damage, so that Windows checks the volume (chkdsk) at the next start.' });
    }
    A.push({ id: 'end', name: 'End marker', type: '0xFFFFFFFF', b: ENDM, res: null, c: 'panel', short: '',
      txt: 'The value 0xFFFFFFFF (with padding, 8 bytes) ends the list of attributes. Everything after it in the record is unused.' });
    return A;
  }
  const ABSENT = [
    { id: 'alist', name: 'Attribute list', type: '$ATTRIBUTE_LIST · 0x20', c: 'panel',
      txt: 'Not needed here, because every attribute fits in this one record. A file whose attributes do not fit in one record (thousands of data runs, or very many hard links) gets extra MFT records, and an attribute list in its main record says which record holds each attribute.' },
    { id: 'sec', name: 'Security descriptor', type: '$SECURITY_DESCRIPTOR · 0x50', c: 'panel',
      txt: 'Not inside the record on today\'s volumes. Up to Windows NT 4.0 every record carried its own copy of the file\'s security descriptor (owner and access list). Since NTFS 3.0 (Windows 2000) each distinct descriptor is stored once in the system file $Secure, and standard information keeps a security ID that points to it.' },
  ];

  /* ---------- small SVG helpers ---------- */
  function box(s, r, cls, lines, o = {}) {        // rounded rectangle with centred text lines; r = [x, y, w, h]
    const [x, y, w, hh] = r, fs = o.fs || 14, lh = fs + 3;
    const top = y + hh / 2 - ((lines.length - 1) * lh) / 2 + fs * 0.36;
    return s('g', {},
      s('rect', { x, y, width: w, height: hh, rx: o.rx == null ? 8 : o.rx, class: cls + ' fr', 'stroke-width': o.sw || 2, 'stroke-dasharray': o.dash || null }),
      ...lines.map((t, i) => s('text', { x: x + w / 2, y: top + i * lh, 'text-anchor': 'middle', 'font-size': i === 0 ? fs : fs - 1, 'font-weight': i === 0 ? 800 : 600, class: i === 0 ? null : 's-sub' }, t)));
  }
  function hot(s, label, on, fn, ...kids) {       // an SVG group that behaves like a button (click, Enter, Space)
    return s('g', { class: 'hot' + (on ? ' sel' : ''), role: 'button', tabindex: 0, 'aria-label': label, 'aria-pressed': on ? 'true' : 'false', onclick: fn,
      onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } } }, ...kids);
  }

  Guide.section({
    id: '12.10',
    title: 'Windows File System',
    short: 'Windows file system',
    summary: 'How NTFS lays out a volume, describes every file in its master file table and recovers from crashes.',
    objectives: [
      'List the key features of NTFS and say what each one gives users and programs.',
      'Relate sectors, clusters and volumes, and compute the number of clusters, the cluster bitmap size and the slack for a given cluster size.',
      'Describe the regions of an NTFS volume and the job of each system file.',
      'Explain how an MFT record describes a file as a set of attributes, and when an attribute is resident or nonresident.',
      'Translate a byte offset in a file into a VCN and an LCN through its data runs, and explain how logging lets NTFS repair its metadata after a crash.',
    ],
    terms: [
      ['NTFS (New Technology File System)', 'The standard file system of Windows since Windows NT. It keeps one master table that describes every file, logs its own metadata changes so it can recover from crashes, and supports security, very large volumes, multiple data streams, compression, encryption and links.'],
      ['Cluster', 'The unit in which NTFS hands out disk space: a fixed number of adjacent sectors, always a power of two, such as 8 sectors = 4 KB. A file stored outside its MFT record always occupies a whole number of clusters.'],
      ['Cluster factor', 'The number of sectors in one cluster: the cluster size divided by the sector size. 4 KB clusters on a disk with 512-byte sectors give a cluster factor of 8.'],
      ['Logical cluster number (LCN)', 'The position of a cluster on the volume, counting from 0 at the volume\'s first cluster. Multiplying an LCN by the cluster size gives that cluster\'s byte offset from the start of the volume.'],
      ['Virtual cluster number (VCN)', 'The position of a cluster inside one file, counting from 0 at the file\'s first cluster. NTFS turns a VCN into an LCN by looking it up in the file\'s data runs.'],
      ['Partition boot sector', 'The first sectors of an NTFS volume (up to 16). They describe the volume\'s layout, such as the sector and cluster sizes and where the MFT starts, and hold the code that starts loading the operating system if the volume is bootable.'],
      ['Master file table (MFT)', 'The heart of NTFS: a table with one record, usually 1 KB, for every file and folder on the volume, including the file system\'s own system files. Each record describes its file as a list of attributes.'],
      ['MFT mirror', 'A second copy of the first four MFT records, stored apart from the MFT, so NTFS can still find the MFT, the log file and the volume information if the start of the MFT becomes unreadable.'],
      ['NTFS log file ($LogFile)', 'The system file in which NTFS writes every change to its metadata as a step of a transaction, with what is needed to redo it and to undo it, before the change itself reaches the disk.'],
      ['Cluster bitmap ($Bitmap)', 'The system file that holds one bit for each cluster of the volume: 1 if the cluster is in use, 0 if it is free.'],
      ['Attribute (NTFS)', 'One typed piece of a file\'s description in its MFT record, such as its standard information, a file name, its data or a folder\'s index. NTFS stores everything about a file, contents included, as attributes.'],
      ['Resident attribute', 'An attribute whose value is stored inside the MFT record itself. Names and time stamps always are, and a file of a few hundred bytes keeps even its data in the record, using no clusters at all.'],
      ['Nonresident attribute', 'An attribute whose value is too big for the MFT record, so it lives in clusters elsewhere on the volume and the record keeps only a list of data runs that says where.'],
      ['Data run (extent)', 'A stretch of a file\'s clusters that sit next to each other on disk, recorded as a starting VCN, a starting LCN and a length in clusters. A contiguous file needs one run; a fragmented file needs one per piece.'],
      ['Alternate data stream (ADS)', 'An extra, named stream of data attached to a file besides its main unnamed contents, written as file:name. Windows marks files downloaded from the Internet with a small Zone.Identifier stream.'],
      ['Change journal (USN journal)', 'An NTFS system file that lists every change made to the files of a volume (create, delete, rename, write), each entry stamped with an update sequence number, so backup, search and replication tools find what changed without scanning everything.'],
      ['Write-ahead logging', 'The rule that the log record describing a change must reach the disk before the changed metadata does, so that after a crash the log always holds enough to redo or undo whatever is found on disk.'],
      ['Transaction (NTFS)', 'A group of metadata changes that must take effect completely or not at all, such as every change needed to create one file. After a crash NTFS redoes the transactions that committed and undoes the ones that did not.'],
      ['Hard link', 'An extra name for the same file: another directory entry pointing to the same MFT record. The file is removed only when its last name is deleted. NTFS hard links work only for files, and only within one volume.'],
      ['Symbolic link', 'A small file that holds the path of another file or folder; opening the link opens the target. It may point to another volume or another computer, and it dangles if the target is deleted. NTFS has them since Windows Vista.'],
    ],
    css: `
      .sec-12-10 .narr { background: var(--panel-2); border: 1px solid var(--line); border-left: 5px solid var(--chc); border-radius: 12px; padding: 9px 13px; font-size: 15px; line-height: 1.45; }
      .sec-12-10 .narr.ok { border-left-color: var(--ok); background: var(--ok-bg); }
      .sec-12-10 .narr.bad { border-left-color: var(--bad); background: var(--bad-bg); }
      .sec-12-10 .hot { cursor: pointer; outline: none; }
      .sec-12-10 .hot .fr { transition: stroke-width .15s; }
      .sec-12-10 .hot:hover .fr, .sec-12-10 .hot:focus-visible .fr { stroke-width: 3.5; }
      .sec-12-10 .hot.sel .fr { stroke-width: 4.5; }
      .sec-12-10 .bad-t { color: var(--bad); }
      .sec-12-10 .ok-t { color: var(--ok); }
      .sec-12-10 .tiles { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
      .sec-12-10 .tile { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 7px 11px; min-width: 0; }
      .sec-12-10 .tile .k { font-size: 12.5px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: .05em; }
      .sec-12-10 .tile .v { font-size: 24px; font-weight: 800; font-variant-numeric: tabular-nums; line-height: 1.2; color: var(--ink); overflow-wrap: anywhere; }
      .sec-12-10 .tile .d { font-size: 13px; color: var(--muted); line-height: 1.3; }
      .sec-12-10 .ctl-row { display: grid; grid-template-columns: 104px minmax(0, 1fr); align-items: center; gap: 8px; font-size: 15px; }
      .sec-12-10 .ctl-row > b { white-space: nowrap; }
      .sec-12-10 .ctl-row .seg button { padding: 4px 9px; font-size: 14px; }
      .sec-12-10 td.num, .sec-12-10 th.num { text-align: right; font-variant-numeric: tabular-nums; }
      .sec-12-10 tr.tot td { font-weight: 800; background: var(--panel-3); }
      .sec-12-10 table.tbl.dense td, .sec-12-10 table.tbl.dense th { padding: 3px 8px; font-size: 14px; line-height: 1.35; }
    `,
    steps: [
      /* ---------------- 1. Big picture: what NTFS promises ---------------- */
      {
        title: 'NTFS: the file system under every Windows PC',
        kind: 'story',
        html: `
          <div class="split l fill">
            <div class="stack" style="gap:9px">
              <p class="lead m0">Every Windows PC keeps its files on <span class="t">NTFS</span>, the New Technology File System that arrived with Windows NT in 1993.</p>
              <p class="m0">Its predecessor, FAT (still used on many USB sticks and memory cards), was simple but fragile: a crash in the middle of an update could leave it damaged, and it had no idea who owned a file. NTFS was built for businesses and servers. It must never lose its own structure, must keep users out of each other's files, and must cope with enormous disks.</p>
              <div class="callout analogy m0" data-label="Analogy">A careful registrar keeps one master register with a row for every file: that is the <span class="t">master file table (MFT)</span>. Before changing the register, the registrar writes the change in a logbook. If the lights go out halfway through, the logbook says exactly what to finish or to roll back, so the register is never left half-edited.</div>
              <div class="row gap-s small"><span class="chip io">count clusters and slack</span><span class="chip os">walk the volume layout</span><span class="chip mem">open an MFT record</span><span class="chip proc">follow a big file's runs</span><span class="chip intr">crash it and recover</span></div>
            </div>
            <div class="card stack" style="gap:8px">
              <div class="row" style="justify-content:space-between"><h4 class="m0">Seven key features</h4><span class="xs muted">click a feature</span></div>
              <div class="ft-grid"></div>
              <div class="card white grow ft-detail" style="display:flex;flex-direction:column;gap:7px"></div>
            </div>
          </div>`,
        render(el, ctx) {
          const { h } = ctx;
          const FEAT = [
            { name: 'Recoverability', cls: 'os', where: 'Step 6: crash it and recover.',
              html: 'After a crash or a power cut, NTFS brings its own structures (the MFT, the folders, the map of free clusters) back to a consistent state within seconds, without scanning the whole disk. It logs every metadata change as part of a <span class="t" data-t="transaction (NTFS)">transaction</span> before making it, and keeps spare copies of vital data: the <span class="t">MFT mirror</span> and a second copy of the boot sector at the end of the volume.',
              cmds: [['chkdsk C: /scan', 'checks drive C: while it stays in use; rarely needed, thanks to the log']] },
            { name: 'Security', cls: 'intr', where: 'Step 4 (where the descriptor lives).',
              html: 'Every file and folder carries a <span class="t">security descriptor</span>: its owner and an access control list saying which users and groups may read, write, run or change it. An open file is a kernel object, so Windows checks the descriptor every time a program opens the file. Since NTFS 3.0 (Windows 2000) each distinct descriptor is stored only once, in the system file $Secure, and a file keeps just its number.',
              cmds: [['icacls report.docx', 'lists who may do what with report.docx']] },
            { name: 'Large disks and files', cls: 'io', where: 'Step 2: clusters and volume limits.',
              html: 'Cluster numbers are 64 bits wide on disk. Current Windows allows up to 2<sup>32</sup> − 1 clusters per volume, so the limit grows with the cluster size: about 16 TB with 4 KB clusters, 256 TB with 64 KB clusters, and 8 PB with the 2 MB clusters added in Windows 10 version 1709 and Windows Server 2019. One file can be almost as big as its volume.',
              cmds: [['fsutil fsinfo ntfsinfo C:', 'shows the sector size, cluster size and MFT record size of drive C: (run as administrator)']] },
            { name: 'Multiple data streams', cls: 'mem', where: 'Step 4: the “downloaded file” record.',
              html: 'A file\'s ordinary contents are its unnamed main data stream, but a file may also carry extra named streams, written <code>file:name</code>. Windows uses one itself: a file downloaded from the Internet gets a tiny <span class="t">alternate data stream</span> called Zone.Identifier, which is how Windows knows to warn you before opening it. File Explorer\'s size column counts only the main stream.',
              cmds: [['echo draft > notes.txt:remarks', 'writes “draft” into a named stream of notes.txt (in cmd.exe)'], ['dir /r', 'lists the files of a folder together with their named streams']] },
            { name: 'Journaling', cls: 'thread', where: 'Step 6 contrasts it with the recovery log.',
              html: 'Besides its recovery log, NTFS keeps a <span class="t">change journal</span> (Windows normally has it switched on for the system drive): a running list of every create, delete, rename and write on the volume, each entry stamped with an update sequence number (USN). Backup programs, the Windows search indexer and file replication read it to learn what changed since their last visit, instead of re-examining millions of files.',
              cmds: [['fsutil usn queryjournal C:', 'shows the change journal of drive C: (its size and newest USN)']] },
            { name: 'Compression and encryption', cls: 'proc', where: 'Only here: not used in later steps.',
              html: 'Either can be switched on for a single file or for a whole folder, and files later created in that folder inherit it. Both are transparent: programs read and write ordinary data while NTFS compresses or encrypts on the way to the disk. Compression works on blocks of 16 clusters; encryption (the Encrypting File System, EFS) uses keys tied to the user\'s account. A file can be compressed or encrypted, not both. BitLocker (11.10) encrypts a whole volume instead.',
              cmds: [['compact /c big.log', 'compresses the file big.log'], ['cipher /e Private', 'encrypts the folder Private and the files later created in it']] },
            { name: 'Hard and symbolic links', cls: 'warn', where: 'Step 4: a file with two names.',
              html: 'A <span class="t">hard link</span> is one more name for the same file: both names lead to the same MFT record, and the file goes away only when its last name is deleted. Hard links work only for files, on the same volume. A <span class="t">symbolic link</span> (Windows Vista onward) is a tiny file that holds a path, so it may point to a folder, another volume or another computer; delete the target and the link dangles.',
              cmds: [['mklink /H copy2.txt report.txt', 'gives report.txt a second name, copy2.txt'], ['mklink /D Docs D:\\Shared\\Docs', 'makes Docs a symbolic link to a folder on drive D:']] },
          ];
          const grid = ctx.$('.ft-grid'), detail = ctx.$('.ft-detail');
          Object.assign(grid.style, { display: 'grid', gridTemplateColumns: ctx.narrow ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))', gap: '6px' });
          const btns = FEAT.map((f, i) => h('button', { class: 'btn sm ' + (f.cls === 'warn' ? '' : f.cls), type: 'button', style: { height: 'auto', minHeight: '34px', whiteSpace: 'normal', lineHeight: 1.2, padding: '4px 8px' }, onclick: () => show(i) }, f.name));
          grid.append(...btns);
          function show(i) {
            const f = FEAT[i];
            btns.forEach((b, j) => { b.classList.toggle('on', i === j); b.setAttribute('aria-pressed', i === j ? 'true' : 'false'); });
            detail.innerHTML = '';
            const tbl = h('table', { class: 'tbl compact' }, h('tr', {}, h('th', { style: { whiteSpace: 'nowrap' } }, 'Try it (Windows)'), h('th', {}, 'What it does')),
              ...f.cmds.map(([c, w]) => h('tr', {}, h('td', { style: { whiteSpace: 'nowrap' } }, h('code', {}, c)), h('td', { class: 'small' }, w))));
            detail.append(
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', { style: { fontSize: '18px' } }, f.name), h('span', { class: 'chip ' + f.cls }, 'feature ' + (i + 1) + ' of 7')),
              h('p', { class: 'm0', style: { fontSize: '15px', lineHeight: 1.45 }, html: f.html }),
              tbl,
              h('p', { class: 'xs muted', style: { margin: 'auto 0 0' } }, 'Where you meet it: ' + f.where));
            detail.classList.remove('fade-in'); void detail.offsetWidth; detail.classList.add('fade-in');
            ctx.refit();
          }
          show(0);
        },
      },

      /* ---------------- 2. Sectors, clusters, LCNs: the cluster calculator ---------------- */
      {
        title: 'Sectors, clusters and cluster numbers',
        kind: 'explore',
        core: true,
        render(el, ctx) {
          const { h, s } = ctx;
          const VOLS = [64 * GB, 128 * GB, 256 * GB, 512 * GB, 1 * TB, 2 * TB, 4 * TB, 8 * TB, 12 * TB, 24 * TB, 48 * TB, 96 * TB, 192 * TB];
          const CLS = [512, 1 * KB, 2 * KB, 4 * KB, 8 * KB, 16 * KB, 32 * KB, 64 * KB];
          const FILES = [['todo.txt', 412], ['icon.png', 1830], ['readme.md', 2600], ['budget.xlsx', 9870], ['notes.docx', 24300], ['app.log', 131072], ['photo.jpg', 3481216], ['song.mp3', 5242881]];
          let vi = 3, sec = 512, cl = 4 * KB, tab = 0, panel = null;
          const svg = s('svg', { viewBox: '0 0 440 112', width: '100%', role: 'img', 'aria-label': 'The first four clusters of the volume, divided into sectors' });

          const left = h('div', { class: 'stack', style: { gap: '8px' } },
            h('p', { class: 'lead m0', html: 'A disk reads and writes <span class="t">sector</span>s. NTFS hands out space in bigger units: <span class="t">cluster</span>s.' }),
            h('ul', { class: 'm0', style: { fontSize: '15px', lineHeight: 1.4 }, html:
              '<li><b>Sector</b>: the smallest unit the disk reads or writes: 512 bytes, or 4 KB on newer drives (many still present 512-byte sectors).</li>' +
              '<li><b>Cluster</b>: 1, 2, 4, 8 … adjacent sectors (always a power of two). The <span class="t">cluster factor</span> is the number of sectors per cluster.</li>' +
              '<li><b><span class="t">Volume</span></b>: a drive letter\'s worth of clusters: part of a disk, a whole disk, or space on several disks (software RAID, 11.10). Its clusters are numbered 0, 1, 2 …: the <span class="t">logical cluster number (LCN)</span>.</li>' }),
            h('div', { class: 'card white tight' }, svg),
            h('div', { class: 'callout why m0', 'data-label': 'Why clusters?', html: 'Fewer, bigger units mean less bookkeeping: one bit per cluster in the free-space map, and shorter lists of where each file lives. The price is <b>slack</b>: the unused tail of each file\'s last cluster, a form of <span class="t">internal fragmentation</span>.' }));

          const volSl = ctx.ui.slider({ label: '', min: 0, max: VOLS.length - 1, value: vi, format: (v) => size(VOLS[v]), onInput: (v) => { vi = v; paint(); } });
          const secSeg = ctx.ui.seg([{ value: 512, label: '512 B' }, { value: 4 * KB, label: '4 KB' }], sec, (v) => { sec = v; paint(); });
          const clSeg = ctx.ui.seg(CLS.map((c) => ({ value: c, label: size(c) })), cl, (v) => { cl = v; paint(); });
          const tabs = ctx.ui.tabs([
            { label: 'The volume', render: (p) => { panel = p; tab = 0; paint(); } },
            { label: 'Slack in a folder', render: (p) => { panel = p; tab = 1; paint(); } },
            { label: 'Default sizes', render: (p) => { panel = p; tab = 2; paint(); } },
          ]);
          const right = h('div', { class: 'card stack', style: { gap: '8px' } },
            h('div', { class: 'ctl-row' }, h('b', {}, 'Volume size'), volSl),
            h('div', { class: 'ctl-row' }, h('b', {}, 'Sector size'), h('div', {}, secSeg)),
            h('div', { class: 'ctl-row' }, h('b', {}, 'Cluster size'), h('div', {}, clSeg)),
            h('div', { class: 'grow', style: { display: 'flex', flexDirection: 'column' } }, tabs));
          el.append(h('div', { class: 'split l fill' }, left, right));

          function drawClusters() {
            const k = [], f = cl / sec, bad = cl < sec;
            for (let i = 0; i < 4; i++) {
              const x = 6 + i * 108, w = 100;
              k.push(s('text', { x: x + w / 2, y: 16, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800 }, bad ? 'sector ' + i : 'LCN ' + i));
              k.push(s('rect', { x, y: 24, width: w, height: 40, rx: 6, class: bad ? 's-bad' : 's-io', 'stroke-width': 2 }));
              if (!bad && f > 1 && f <= 16) for (let j = 1; j < f; j++) k.push(s('line', { x1: x + (w * j) / f, y1: 28, x2: x + (w * j) / f, y2: 60, class: 's-muted', 'stroke-width': 1.5 }));
              if (!bad && f > 16) k.push(s('text', { x: x + w / 2, y: 49, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, f + ' sectors'));
              k.push(s('text', { x: x + w / 2, y: 82, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, bad ? 'byte ' + n2s(i * sec) : 'byte ' + n2s(i * cl)));
            }
            k.push(s('text', { x: 220, y: 106, 'text-anchor': 'middle', 'font-size': 13, style: bad ? 'fill:var(--bad)' : null, class: bad ? null : 's-sub' },
              bad ? 'a cluster smaller than a sector cannot exist' : `each box = 1 cluster of ${size(cl)} = ${f} sector${f > 1 ? 's' : ''} of ${size(sec)}`));
            svg.replaceChildren(...k);
          }
          function tile(k, v, d) { return h('div', { class: 'tile' }, h('div', { class: 'k' }, k), h('div', { class: 'v', html: v }), h('div', { class: 'd', html: d })); }
          function paint() {
            drawClusters();
            if (!panel) return;
            const vol = VOLS[vi], n = Math.floor(vol / cl), f = cl / sec, def = defaultCluster(vol);
            const bad = cl < sec, tooMany = n > MAXCL;
            panel.innerHTML = '';
            if (tab === 0) {
              panel.append(h('div', { class: 'tiles' },
                tile('Cluster factor', bad ? '—' : n2s(f), bad ? 'impossible' : `${size(cl)} ÷ ${size(sec)} = ${f} sector${f > 1 ? 's' : ''} per cluster`),
                tile('Clusters on the volume', n2s(n), `LCN 0 to ${n2s(n - 1)}`),
                tile('Cluster bitmap', size(n / 8), `one bit per cluster: ${n2s(n)} bits`),
                tile('Largest volume', size(2 ** 32 * cl), `just under: (2<sup>32</sup> − 1) × ${size(cl)}`)));
              let msg;
              if (bad) msg = h('div', { class: 'narr bad mt', html: `<b>Not possible.</b> A cluster is made of whole sectors, so with ${size(sec)} sectors the smallest cluster is ${size(sec)}.` });
              else if (tooMany) {
                let least = sec; while (Math.floor(vol / least) > MAXCL) least *= 2;   // smallest cluster (whole sectors) that keeps the count legal
                msg = h('div', { class: 'narr bad mt', html: `<b>Windows would refuse.</b> ${n2s(n)} clusters is more than 2<sup>32</sup> − 1 = ${n2s(MAXCL)}. A ${size(vol)} volume needs clusters of at least ${size(least)}${least === def ? '' : ` (Windows picks ${size(def)} by default)`}.` });
              }
              else msg = h('div', { class: 'narr ok mt', html: `<b>Valid.</b> The map of free clusters takes ${size(n / 8)}, only ${(100 * (n / 8) / vol).toFixed(4)}% of the volume. ${cl === def ? `${size(cl)} is also what Windows picks by default here.` : `Windows would pick ${size(def)} by default here; ${cl < def ? 'smaller clusters waste less space but need a bigger map' : 'bigger clusters mean a smaller map but more slack per file'}.`}` });
              panel.append(msg);
            } else if (tab === 1) {
              let tot = 0, alloc = 0, slack = 0, big = 0;
              const rows = FILES.map(([name, b]) => {
                const res = b <= maxResident(name), c = res ? 0 : Math.ceil(b / cl), sl = c * cl - (res ? 0 : b);
                tot += b; alloc += c * cl; slack += sl; if (!res) big++;
                return h('tr', {}, h('td', { class: 'mono' }, name), h('td', { class: 'num' }, n2s(b)), h('td', { class: 'num' }, res ? 'in MFT' : n2s(c)), h('td', { class: 'num' }, n2s(sl)));
              });
              panel.append(h('table', { class: 'tbl compact dense' },
                h('tr', {}, h('th', {}, 'File'), h('th', { class: 'num' }, 'Size (bytes)'), h('th', { class: 'num' }, 'Clusters'), h('th', { class: 'num' }, 'Slack (bytes)')),
                ...rows,
                h('tr', { class: 'tot' }, h('td', {}, 'Total'), h('td', { class: 'num' }, n2s(tot)), h('td', { class: 'num' }, n2s(alloc / cl)), h('td', { class: 'num' }, n2s(slack)))));
              panel.append(h('div', { class: 'narr', style: { fontSize: '14.5px', marginTop: '8px' }, html: bad ? 'Pick a cluster at least as big as a sector.'
                : `Slack: <b>${(100 * slack / alloc).toFixed(slack / alloc < 0.01 ? 2 : 1)}%</b> of the ${size(alloc)} allocated, ${n2s(slack / big)} B per stored file; rule of thumb: half a cluster (${n2s(cl / 2)}), more for small files. todo.txt is in its MFT record.` }));
            } else {
              const ROWS = [[0, 16 * TB, '4 KB'], [16 * TB, 32 * TB, '8 KB'], [32 * TB, 64 * TB, '16 KB'], [64 * TB, 128 * TB, '32 KB'], [128 * TB, 256 * TB, '64 KB'], [256 * TB, 8 * PB, '128 KB to 2 MB*']];
              panel.append(h('table', { class: 'tbl compact' },
                h('tr', {}, h('th', {}, 'Volume size'), h('th', {}, 'Typical default cluster')),
                ...ROWS.map(([lo, hi, c]) => h('tr', { class: vol > lo && vol <= hi ? 'on' : null }, h('td', {}, lo ? `${size(lo)} – ${size(hi)}` : `up to ${size(hi)}`), h('td', {}, h('b', {}, c))))));
              panel.append(h('p', { class: 'small m0 mt', html: `Typical defaults of recent Windows versions; they have changed over the years (Windows NT 4.0 used clusters of 512 bytes to 2 KB on small volumes). Each is the smallest size from 4 KB up that keeps the volume within 2<sup>32</sup> − 1 clusters. The highlighted row matches your ${size(vol)} volume.` }),
                h('p', { class: 'xs muted m0', style: { marginTop: '4px' } }, '* Clusters above 64 KB exist only in Windows 10 version 1709, Windows Server 2019 and later.'));
            }
            ctx.refit();
          }
          paint();
        },
      },

      /* ---------------- 3. Volume layout and the self-describing MFT ---------------- */
      {
        title: 'The layout of an NTFS volume',
        kind: 'explore',
        render(el, ctx) {
          const { h, s } = ctx;
          const slim = ctx.narrow;
          const nCl = (512 * GB) / CL;
          const REG = {
            boot: { name: 'Partition boot sector', term: 'partition boot sector', rec: 7, cls: 's-os', chip: 'os',
              lose: 'Windows could not even find the MFT. That is why a backup copy waits at the far end of the volume.',
              html: 'The very first sectors of the volume, up to 16 of them (NTFS sets aside 8 KB). They record the volume\'s geometry: bytes per sector, sectors per cluster, the size of the volume, the LCN where the MFT starts, the LCN of the MFT mirror and the size of one MFT record. On a bootable volume they also hold the startup code that begins loading Windows. A backup copy sits in the volume\'s last sector.' },
            mft: { name: 'Master file table (MFT)', term: 'master file table (MFT)', rec: 0, cls: 's-mem', chip: 'mem',
              lose: 'Every file\'s name, size and location would be gone. The MFT is the heart of NTFS, which is why its first records are mirrored.',
              html: 'One record (row) for every file and folder on the volume, usually 1 KB each (4 KB on disks with 4 KB native sectors), including a record that describes the MFT itself (record 0). The first 16 records belong to system files; everything else follows. The MFT grows as files are created, so Windows keeps a zone of free space reserved next to it, letting it grow without being scattered.' },
            mirr: { name: 'MFT mirror ($MFTMirr)', term: 'MFT mirror', rec: 1, cls: 's-ok', chip: 'ok',
              lose: 'Damage to the first few records of the MFT would make the whole volume unreadable.',
              html: 'A copy of the MFT\'s first four records ($MFT, $MFTMirr, $LogFile and $Volume), stored away from the MFT. If the start of the MFT cannot be read, NTFS uses the mirror to find the MFT, the log and the volume information, and can still recover. The boot sector records where the mirror is.' },
            log: { name: 'Log file ($LogFile)', term: 'NTFS log file', rec: 2, cls: 's-intr', chip: 'intr',
              lose: 'A crash in the middle of an update could leave the structures contradicting each other, and every crash would need a slow check of the whole disk.',
              html: 'A fixed-size circular file (from a few megabytes to some tens of megabytes, depending on the volume) that holds the steps of NTFS transactions: for every metadata change, how to redo it and how to undo it, written before the change itself reaches the disk. After a crash, NTFS replays it to repair its structures (step 6). It protects metadata, not the contents of your files.' },
            bmp: { name: 'Cluster bitmap ($Bitmap)', term: 'cluster bitmap', rec: 6, cls: 's-io', chip: 'io',
              lose: 'NTFS could not tell free clusters from used ones, and might give the same cluster to two files.',
              html: `One bit per cluster of the volume: 1 = in use, 0 = free. To give a file space, NTFS looks for 0 bits, ideally a long run of them so the file stays in one piece, and sets them to 1. A 512 GB volume with 4 KB clusters has ${n2s(nCl)} clusters, so its bitmap is ${n2s(nCl)} bits = ${size(nCl / 8)}.` },
            attr: { name: 'Attribute definition table ($AttrDef)', term: null, rec: 4, cls: 's-thread', chip: 'thread',
              lose: 'NTFS would have no rules for checking that the attributes in a record are well formed.',
              html: 'The list of attribute types this volume understands: each type\'s name and number (for example $FILE_NAME = 0x30 and $DATA = 0x80) and its rules: whether it may be nonresident, whether it can be indexed, and its smallest and largest allowed size. NTFS checks attributes against it. Step 4 opens records built from these attributes.' },
            file: { name: 'File area', term: null, rec: null, cls: 's-panel', chip: 'accent',
              lose: 'Your data would be gone. Everything else on the volume is bookkeeping about what lives here.',
              html: 'Everything else: the clusters that hold the data of files and folders too big to live inside their MFT records, such as photos, programs, and the index blocks of large folders. Every path on the volume starts at the root folder, MFT record 5.' },
          };
          const RECS = [
            ['$MFT', 'The MFT itself: its own record says which clusters the MFT occupies.', 'mft'],
            ['$MFTMirr', 'The MFT mirror: a copy of records 0 to 3.', 'mirr'],
            ['$LogFile', 'The log of metadata transactions used for crash recovery.', 'log'],
            ['$Volume', 'The volume\'s name, the NTFS version (3.1 today) and the “dirty” flag that makes Windows check the volume at the next start.', null, 'Windows would not know the volume\'s NTFS version or whether it needs checking.'],
            ['$AttrDef', 'The attribute definition table.', 'attr'],
            ['. (root)', 'The root folder of the volume, where every path begins. Its index of names starts in this record; a big root folder adds index blocks out in the file area.', null, 'No path on the volume could be followed: every path, such as \\Users\\Ana, starts at the root folder.'],
            ['$Bitmap', 'The cluster bitmap: one bit per cluster.', 'bmp'],
            ['$Boot', 'The partition boot sector, so even the boot sector is a file.', 'boot'],
            ['$BadClus', 'A file that “owns” every damaged cluster, so no real file is ever given one.', null, 'NTFS might store new data on a cluster already known to be damaged.'],
            ['$Secure', 'The shared store of security descriptors (NTFS 3.0 and later).', null, 'NTFS could no longer tell who may open each file.'],
            ['$UpCase', 'A table of upper-case letters for comparing Unicode names without regard to case.', null, 'Names that differ only in case, such as Report.txt and REPORT.TXT, could no longer be matched to each other.'],
            ['$Extend', 'A folder for later additions: the change journal ($UsnJrnl), disk quotas, object IDs and reparse points.', null, 'The change journal, quotas and the other later features would be gone; basic file storage would still work.'],
          ];
          let selReg = 'mft', selRec = 0;
          const G = slim
            ? { vb: '0 0 360 196', boot: [0, 22, 92, 50], mft: [98, 22, 262, 50], grp: [0, 98, 360, 4], mirr: [0, 108, 87, 50], log: [91, 108, 87, 50], bmp: [182, 108, 87, 50], attr: [273, 108, 87, 50], file: [0, 166, 360, 28] }
            : { vb: '0 0 1100 84', boot: [0, 28, 120, 54], mft: [126, 28, 230, 54], grp: [362, 17, 444, 4], mirr: [362, 28, 108, 54], log: [474, 28, 108, 54], bmp: [586, 28, 108, 54], attr: [698, 28, 108, 54], file: [812, 28, 288, 54] };
          const L = {
            boot: slim ? ['Boot', 'sector'] : ['Partition', 'boot sector'], mft: ['Master file table', 'one record per file'],
            mirr: ['MFT', 'mirror'], log: ['Log', 'file'], bmp: ['Cluster', 'bitmap'], attr: slim ? ['Attr.', 'definitions'] : ['Attribute', 'definitions'],
            file: slim ? ['File area →'] : ['File area', 'file data, big folders →'],
          };
          const svg = s('svg', { viewBox: G.vb, width: '100%', role: 'img', 'aria-label': 'The regions of an NTFS volume' });
          const detail = h('div', { class: 'card white stack', style: { gap: '6px' } });
          const grid = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '5px' } });
          const recBtns = RECS.map(([n], i) => h('button', { class: 'btn sm', type: 'button', style: { height: 'auto', minHeight: '40px', flexDirection: 'column', gap: '0', lineHeight: 1.15, padding: '3px 4px' }, onclick: () => pickRec(i) },
            h('span', { class: 'xs muted' }, 'record ' + i), h('b', { class: 'mono', style: { fontSize: '13.5px' } }, n)));
          const resBtn = h('button', { class: 'btn sm', type: 'button', style: { gridColumn: '1 / -1', height: '30px' }, onclick: () => pickRec(12) }, 'records 12 – 15: reserved');
          grid.append(...recBtns, resBtn);

          function draw() {
            const k = [];
            const gx = G.grp[0], gw = G.grp[2], gy = G.grp[1];
            k.push(s('path', { d: `M${gx + 2} ${gy + 8} V${gy} H${gx + gw - 2} V${gy + 8}`, class: 's-line', 'stroke-width': 1.5 }));
            k.push(s('text', { x: gx + gw / 2, y: gy - 4, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, class: 's-sub' }, 'system files'));
            Object.keys(REG).forEach((id) => {
              const r = REG[id];
              k.push(hot(s, r.name, selReg === id, () => pickReg(id), box(s, G[id], r.cls, L[id], { fs: slim ? 13 : 14.5, rx: 6, dash: id === 'file' ? '6 4' : null })));
            });
            svg.replaceChildren(...k);
          }
          function head(name, term, chip, tag) {
            return h('div', { class: 'row', style: { justifyContent: 'space-between' } },
              h('b', { style: { fontSize: '18px' }, html: term ? `<span class="t" data-t="${term}">${name}</span>` : name }), h('span', { class: 'chip ' + chip }, tag));
          }
          function pickReg(id) {
            selReg = id; selRec = REG[id].rec;
            const r = REG[id];
            detail.replaceChildren(head(r.name, r.term, r.chip, r.rec == null ? 'clusters, not a record' : 'MFT record ' + r.rec), h('p', { class: 'm0', style: { fontSize: '15px', lineHeight: 1.45 }, html: r.html }),
              h('div', { class: 'callout why', 'data-label': 'If it were lost', style: { margin: 'auto 0 0', fontSize: '15px', padding: '8px 12px' } }, r.lose));
            paint();
          }
          function pickRec(i) {
            selRec = i;
            if (i >= 12) { selReg = null; detail.replaceChildren(head('Records 12 – 15', null, 'accent', 'reserved'), h('p', { class: 'm0', style: { fontSize: '15px' } }, 'Kept free for future system files. From record 16 on come more system files (those inside $Extend) and then the ordinary files and folders of the volume, each described by its own record.'),
              h('div', { class: 'callout why', 'data-label': 'Why reserve them?', style: { margin: 'auto 0 0', fontSize: '15px', padding: '8px 12px' } }, 'Fixed numbers mean every NTFS volume keeps its system files in the same records, so NTFS always knows where to look for them.')); paint(); return; }
            const [n, d, reg, lose] = RECS[i];
            if (reg) { pickReg(reg); return; }
            selReg = null;
            detail.replaceChildren(head(n, null, 'accent', 'MFT record ' + i), h('p', { class: 'm0', style: { fontSize: '15px', lineHeight: 1.45 } }, d), h('p', { class: 'small muted m0' }, 'Not drawn as its own region: it is one of the reserved records 0 – 15.'),
              h('div', { class: 'callout why', 'data-label': 'If it were lost', style: { margin: 'auto 0 0', fontSize: '15px', padding: '8px 12px' } }, lose));
            paint();
          }
          function paint() {
            draw();
            recBtns.forEach((b, i) => { b.classList.toggle('on', i === selRec); b.setAttribute('aria-pressed', i === selRec ? 'true' : 'false'); });
            resBtn.classList.toggle('on', selRec >= 12); resBtn.setAttribute('aria-pressed', selRec >= 12 ? 'true' : 'false');
            ctx.refit();
          }
          el.append(h('div', { class: 'stack fill', style: { gap: '8px' } },
            h('p', { class: 'lead m0', html: 'An NTFS volume has four regions: boot sector, <span class="t">master file table (MFT)</span>, system files and file area. Click any part.' }),
            h('div', { class: 'card white tight' }, svg,
              h('p', { class: 'xs muted m0', style: { marginTop: '2px' } }, 'Not to scale. The order shows the roles: every system file is itself listed in the MFT, and the boot sector records where the MFT and its mirror start, so on a real volume they may sit elsewhere.')),
            h('div', { class: 'split grow', style: { gridTemplateColumns: slim ? null : 'minmax(0, 7fr) minmax(0, 5fr)' } },
              detail,
              h('div', { class: 'card stack', style: { gap: '6px' } },
                h('h4', { class: 'm0' }, 'The MFT lists itself: records 0 – 15'),
                grid,
                h('p', { class: 'xs muted m0' }, 'Even the MFT, the boot sector and the free-space map are files with their own MFT records.')))));
          pickReg('mft');
        },
      },

      /* ---------------- 4. Inside an MFT record ---------------- */
      {
        title: 'Inside an MFT record',
        kind: 'explore',
        core: true,
        render(el, ctx) {
          const { h, s } = ctx;
          const slim = ctx.narrow;
          let fk = 'small', small = 412, sel = 'data';
          const W = slim ? 360 : 640, SC = (W - 2) / REC;
          const svg = s('svg', { viewBox: `0 0 ${W} 86`, width: '100%', role: 'img', 'aria-label': 'The 1,024 bytes of one MFT record, attribute by attribute' });
          const list = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '5px' } });
          const absent = h('div', { class: 'row gap-s' });
          const detail = h('div', { class: 'card white stack', style: { gap: '7px' } });
          const sl = ctx.ui.slider({ label: 'Size of todo.txt', min: 0, max: 1500, step: 4, value: small, format: (v) => n2s(v) + ' B', onInput: (v) => { small = v; paint(); } });
          const slWrap = h('div', {}, sl);
          const tag = h('span', { class: 'small muted' });
          const seg = ctx.ui.seg([{ value: 'small', label: 'Small file' }, { value: 'big', label: 'Big file' }, { value: 'dir', label: 'Folder' }, { value: 'dl', label: 'Downloaded file' }, { value: 'vol', label: '$Volume' }], fk,
            (v) => { fk = v; sel = { small: 'data', big: 'data', dir: 'iroot', dl: 'zone', vol: 'vinfo' }[v]; paint(); });
          const NAMES = { small: 'todo.txt', big: TRIP.name + ' (300,000 bytes)', dir: 'the folder Docs', dl: DLF.name, vol: '$Volume, MFT record 3 (simplified)' };
          const col = (c) => c === 'panel' || c === 'free' ? ['var(--panel-3)', 'var(--line-2)'] : [`var(--${c}-bg)`, `var(--${c})`];
          function freeText(free) {
            if (fk === 'small' && small <= maxResident('todo.txt')) return `${n2s(free)} of the record's 1,024 bytes are unused. Drag the slider: todo.txt's data can grow into this space, and only when it no longer fits does NTFS move the data out to a cluster.`;
            if (fk === 'big' || fk === 'small') return `${n2s(free)} of the 1,024 bytes are unused. However big a file is, its record stays small: the data lives in clusters, and the record keeps just a short run list.`;
            return `${n2s(free)} of the 1,024 bytes are unused, room for attributes to grow (another name, more runs) before NTFS needs a second record.`;
          }
          function paint() {
            const fa = document.activeElement, fs = fa && fa.getAttribute ? (fa.getAttribute('data-aid') ? ['aid', fa.getAttribute('data-aid')] : fa.getAttribute('data-sid') ? ['sid', fa.getAttribute('data-sid')] : null) : null;
            const A = recordOf(fk, small);
            const used = A.reduce((a, x) => a + x.b, 0), free = REC - used;
            const all = A.concat([{ id: 'free', name: 'Free space', type: 'unused bytes', b: free, res: null, c: 'free', short: 'free', txt: freeText(free) }]);
            tag.textContent = 'Record of ' + NAMES[fk];
            slWrap.style.display = fk === 'small' ? '' : 'none';
            // the bar
            const k = [s('text', { x: 1, y: 14, 'font-size': 13.5, 'font-weight': 700 }, `${n2s(used)} of 1,024 bytes used`),
              s('text', { x: W - 1, y: 14, 'text-anchor': 'end', 'font-size': 13.5, class: 's-sub' }, `${n2s(free)} free`)];
            let x = 1;
            all.forEach((a) => {
              const w = a.b * SC, [, stroke] = col(a.c);
              const lab = a.short && w > a.short.length * 7.2 + 8 ? a.short : '';
              const g = hot(s, a.name + ', ' + a.b + ' bytes', sel === a.id, () => { sel = a.id; paint(); },
                s('rect', { x, y: 22, width: Math.max(w, 2), height: 44, rx: 3, class: (a.c === 'free' ? 's-panel' : 's-' + a.c) + ' fr', 'stroke-width': 1.5, 'stroke-dasharray': a.c === 'free' ? '5 4' : null, style: a.c === 'panel' ? `stroke:${stroke}` : null }),
                lab ? s('text', { x: x + w / 2, y: 49, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, class: a.c === 'free' ? 's-sub' : null }, lab) : null);
              g.setAttribute('data-sid', a.id);
              k.push(g);
              x += w;
            });
            [[0, 'start'], [512, 'middle'], [1024, 'end']].forEach(([b, an]) => k.push(s('text', { x: 1 + b * SC - (b === 1024 ? 1 : 0), y: 83, 'text-anchor': an, 'font-size': 13, class: 's-sub' }, b === 1024 ? 'byte 1,024' : 'byte ' + b)));
            svg.replaceChildren(...k);
            // the buttons
            const btn = (a, dashed) => {
              const [bg, bd] = col(a.c);
              const b = h('button', { class: 'btn sm' + (sel === a.id ? ' on' : ''), type: 'button', 'data-aid': a.id, 'aria-pressed': sel === a.id ? 'true' : 'false',
                style: { justifyContent: 'flex-start', height: 'auto', minHeight: '35px', padding: '3px 8px', gap: '7px', textAlign: 'left', whiteSpace: 'normal', borderStyle: dashed ? 'dashed' : null },
                onclick: () => { sel = a.id; paint(); } },
              h('span', { style: { width: '13px', height: '13px', borderRadius: '4px', flex: 'none', background: dashed ? 'transparent' : bg, border: `2px ${dashed ? 'dashed' : 'solid'} ${bd}` } }),
              h('span', {}, a.name), dashed ? null : h('span', { class: 'muted', style: { marginLeft: 'auto', fontWeight: 600 } }, a.b + ' B'));
              return b;
            };
            list.replaceChildren(...all.map((a) => btn(a, false)));
            absent.replaceChildren(h('span', { class: 'small muted' }, 'Not in this record:'), ...ABSENT.map((a) => btn(a, true)));
            // the detail card
            const a = all.find((z) => z.id === sel) || ABSENT.find((z) => z.id === sel) || all[0];
            const chips = [];
            if (a.res === true) chips.push(h('span', { class: 'chip ok' }, 'resident'));
            if (a.res === false) chips.push(h('span', { class: 'chip io' }, 'nonresident'));
            if (a.b != null) chips.push(h('span', { class: 'chip' }, n2s(a.b) + ' bytes of the record'));
            else chips.push(h('span', { class: 'chip warn' }, 'not in this record'));
            const parts = [h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', { style: { fontSize: '18px' } }, a.name), h('code', { class: 'xs' }, a.type)),
              h('div', { class: 'row gap-s' }, ...chips),
              h('p', { class: 'm0', style: { fontSize: '15px', lineHeight: 1.45 }, html: a.txt })];
            if (a.runs) parts.push(h('table', { class: 'tbl compact dense' },
              h('tr', {}, h('th', {}, 'Run'), h('th', {}, 'VCNs'), h('th', {}, 'LCNs'), h('th', { class: 'num' }, 'Clusters')),
              ...a.runs.map((r, i) => h('tr', {}, h('td', {}, i + 1), h('td', { class: 'num' }, rng(r.vcn, r.vcn + r.len - 1)), h('td', { class: 'num' }, rng(r.lcn, r.lcn + r.len - 1)), h('td', { class: 'num' }, r.len)))));
            detail.replaceChildren(...parts);
            if (fs) { const t = el.querySelector(`[data-${fs[0]}="${fs[1]}"]`); if (t) t.focus(); }
            ctx.refit();
          }
          el.append(h('div', { class: 'stack fill', style: { gap: '8px' } },
            h('p', { class: 'lead m0', html: 'Each file is described by a 1 KB MFT record built from typed <span class="t" data-t="attribute (NTFS)">attributes</span>. Pick a file, then click its parts.' }),
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, seg, tag),
            h('div', { class: 'split r grow' },
              h('div', { class: 'card stack', style: { gap: '8px' } }, svg, slWrap, list, absent,
                h('div', { class: 'callout why', 'data-label': 'Why keep small files in the record?', style: { margin: 'auto 0 0', fontSize: '14.5px', padding: '8px 12px' } }, 'NTFS reads the record anyway to open the file, so a resident file costs no extra disk access, and no cluster is wasted on a few hundred bytes.')),
              detail)));
          paint();
        },
      },

      /* ---------------- 5. Data runs: from a byte in the file to a cluster on the volume ---------------- */
      {
        title: 'Big files: data runs, VCNs and LCNs',
        kind: 'lab',
        render(el, ctx) {
          const { h, s } = ctx;
          const slim = ctx.narrow;
          let lay = 'three', off = 150000;
          const NV = 65536;                                     // the part of the volume drawn: LCN 0 to 65,535
          const W = slim ? 360 : 660, X0 = slim ? 10 : 20, BW = W - 2 * X0;
          const svg = s('svg', { viewBox: `0 0 ${W} 202`, width: '100%', role: 'img', 'aria-label': 'How the clusters of trip.jpg map onto clusters of the volume' });
          const HALO = 'paint-order:stroke;stroke:var(--panel);stroke-width:4px;stroke-linejoin:round;';
          const tbl = h('div', {});
          const stats = h('div', { class: 'tiles' });
          const steps = h('ol', { class: 'm0', style: { fontSize: '14.5px', lineHeight: 1.42, paddingLeft: '22px' } });
          const note = h('div', { class: 'narr', style: { fontSize: '14.5px' } });
          const seg = ctx.ui.seg([{ value: 'one', label: 'In one piece' }, { value: 'three', label: 'Fragmented' }, { value: 'many', label: 'Scattered' }], lay, (v) => { lay = v; paint(); });
          const sl = ctx.ui.slider({ label: 'Byte in the file', min: 0, max: TRIP.size - 1, step: 1, value: off, format: (v) => n2s(v), onInput: (v) => { off = v; paint(); } });
          const COLS = ['s-mem', 's-io', 's-proc'];
          function paint() {
            const runs = LAYOUTS[lay];
            const vcn = Math.floor(off / CL), inC = off % CL;
            const m = vcnToLcn(runs, vcn), vb = m.lcn * CL + inC;
            const fx = (v) => X0 + (v / TRIP.clusters) * BW, lx = (l) => X0 + (l / NV) * BW;
            const k = [
              s('text', { x: X0, y: 16, 'font-size': 14, 'font-weight': 800 }, 'trip.jpg, cluster by cluster (VCN)'),
              s('text', { x: X0 + BW, y: 16, 'text-anchor': 'end', 'font-size': 13, class: 's-sub' }, `VCN 0 – ${TRIP.clusters - 1}`),
              s('text', { x: X0, y: 198, 'font-size': 14, 'font-weight': 800 }, 'the volume (LCN), first 256 MB'),
              s('text', { x: X0 + BW, y: 198, 'text-anchor': 'end', 'font-size': 13, class: 's-sub' }, `LCN 0 – ${n2s(NV - 1)}`),
              s('rect', { x: X0, y: 132, width: BW, height: 32, rx: 4, class: 's-panel', 'stroke-width': 1.5 }),
            ];
            runs.forEach((r, i) => {
              const c = runs.length > 3 ? COLS[i % 2] : COLS[i];
              const a = fx(r.vcn), b = fx(r.vcn + r.len), p = lx(r.lcn), q = Math.max(lx(r.lcn + r.len), p + 2.5);
              k.push(s('polygon', { points: `${a},60 ${b},60 ${q},132 ${p},132`, class: c, 'stroke-width': 0.6, style: 'fill-opacity:.45' }));
              k.push(s('rect', { x: a, y: 24, width: Math.max(b - a, 1), height: 36, class: c, 'stroke-width': i === m.i ? 2.5 : 1 }));
              k.push(s('rect', { x: p, y: 132, width: q - p, height: 32, class: c, 'stroke-width': i === m.i ? 2.5 : 1 }));
              if (runs.length <= 3) {
                k.push(s('text', { x: (a + b) / 2, y: 47, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 700 }, `run ${i + 1}`));
                k.push(s('text', { x: p, y: 180, 'text-anchor': p > X0 + BW - 60 ? 'end' : 'middle', 'font-size': 13, class: 's-sub' }, n2s(r.lcn)));
              }
            });
            const mx = fx(off / CL), my = lx(m.lcn + inC / CL);
            k.push(s('line', { x1: mx, y1: 20, x2: mx, y2: 64, style: 'stroke:var(--intr)', 'stroke-width': 3 }));
            k.push(s('line', { x1: mx, y1: 64, x2: my, y2: 128, style: 'stroke:var(--intr)', 'stroke-width': 2, 'stroke-dasharray': '5 4' }));
            k.push(s('line', { x1: my, y1: 128, x2: my, y2: 168, style: 'stroke:var(--intr)', 'stroke-width': 3 }));
            k.push(s('text', { x: Math.min(Math.max(mx, X0 + 40), X0 + BW - 40), y: 79, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800, style: HALO + 'fill:var(--intr)' }, `VCN ${vcn}`));
            k.push(s('text', { x: Math.min(Math.max(my, X0 + 50), X0 + BW - 50), y: 123, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800, style: HALO + 'fill:var(--intr)' }, `LCN ${n2s(m.lcn)}`));
            svg.replaceChildren(...k);
            // the four computed steps
            steps.innerHTML =
              `<li>VCN = ⌊${n2s(off)} ÷ 4,096⌋ = <b>${vcn}</b>, and the byte is number ${n2s(inC)} inside that cluster.</li>` +
              `<li>Run ${m.i + 1} covers VCN ${rng(m.run.vcn, m.run.vcn + m.run.len - 1)} and starts at LCN ${n2s(m.run.lcn)}.</li>` +
              `<li>LCN = ${n2s(m.run.lcn)} + (${vcn} − ${m.run.vcn}) = <b>${n2s(m.lcn)}</b>.</li>` +
              `<li>Volume byte = ${n2s(m.lcn)} × 4,096 + ${n2s(inC)} = <b>${n2s(vb)}</b> (512 B sector ${n2s(Math.floor(vb / 512))}).</li>`;
            // the run list table: every run, or a window around the current one
            const show = runs.length <= 4 ? runs.map((r, i) => i) : [...new Set([m.i - 1, m.i, m.i + 1].filter((i) => i >= 0 && i < runs.length))].sort((a, b) => a - b);
            const rows = [];
            const gap = (n) => h('tr', {}, h('td', { colspan: 4, class: 'muted center' }, `… ${n} more run${n > 1 ? 's' : ''} …`));
            if (show[0] > 0) rows.push(gap(show[0]));
            show.forEach((i) => {
              const r = runs[i];
              rows.push(h('tr', { class: i === m.i ? 'on' : null }, h('td', {}, 'run ' + (i + 1)), h('td', { class: 'num' }, rng(r.vcn, r.vcn + r.len - 1)), h('td', { class: 'num' }, n2s(r.lcn)), h('td', { class: 'num' }, r.len)));
            });
            if (show[show.length - 1] < runs.length - 1) rows.push(gap(runs.length - 1 - show[show.length - 1]));
            tbl.replaceChildren(h('table', { class: 'tbl compact dense' }, h('tr', {}, h('th', {}, 'Run'), h('th', { class: 'num' }, 'VCNs'), h('th', { class: 'num' }, 'Start LCN'), h('th', { class: 'num' }, 'Length')), ...rows));
            const rec = HDR + SI + fnSize(TRIP.name) + nonresSize(runs) + ENDM;
            stats.replaceChildren(
              h('div', { class: 'tile' }, h('div', { class: 'k' }, 'Run list in the record'), h('div', { class: 'v' }, runListBytes(runs) + ' bytes'), h('div', { class: 'd' }, `record: ${n2s(rec)} of 1,024 bytes used`)),
              h('div', { class: 'tile' }, h('div', { class: 'k' }, 'Separate disk regions'), h('div', { class: 'v' }, runs.length), h('div', { class: 'd' }, 'to read the whole file')));
            note.innerHTML = lay === 'one' ? '<b>One run</b> describes all 74 clusters, and the whole file can be read in one sweep of the disk. This is what defragmenting aims for.'
              : lay === 'three' ? '<b>Three runs</b>: the file was written in three pieces. Reading it all means three trips to different places on the disk.'
                : `<b>${runs.length} runs</b>, one per cluster. The run list still fits in the record, but on a hard disk each run costs a seek and a rotational delay (11.5): reading the file is far slower.`;
            ctx.refit();
          }
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack', style: { gap: '8px' } },
              h('p', { class: 'lead m0', html: 'A file counts its clusters 0, 1, 2 …: the <span class="t">virtual cluster number (VCN)</span>. The volume counts them by <span class="t">logical cluster number (LCN)</span>.' }),
              h('p', { class: 'm0', style: { fontSize: '15px' }, html: 'The record of a big file lists <span class="t">data run</span>s: each says “these VCNs live at these LCNs”, as a start VCN, a start LCN and a length. trip.jpg (300,000 bytes) needs 74 clusters of 4 KB.' }),
              tbl, stats, note),
            h('div', { class: 'card stack', style: { gap: '8px' } },
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, seg, h('span', { class: 'xs muted' }, 'how trip.jpg was stored')),
              h('div', { class: 'card white tight' }, svg),
              sl,
              h('div', { class: 'card white tight' }, h('h4', { class: 'm0', style: { marginBottom: '4px' } }, 'Find that byte on the volume'), steps),
              h('div', { class: 'callout warn m0', 'data-label': 'Common mistake', style: { fontSize: '14.5px', padding: '7px 12px' } }, 'First LCN + VCN works only for a file in one piece. Otherwise, find the run that holds the VCN first.'))));
          paint();
        },
      },

      /* ---------------- 6. Recoverability: crash at any point, then redo or undo ---------------- */
      {
        title: 'Pull the plug: logging, redo and undo',
        kind: 'lab',
        core: true,
        render(el, ctx) {
          const { h } = ctx;
          let obey = true, k = 6;
          const evList = h('div', { class: 'stack', style: { gap: '4px' } });
          const table = h('div', {});
          const diskNote = h('div', { class: 'small' });
          const recov = h('div', { class: 'narr', style: { fontSize: '14.5px' } });
          const verdict = h('div', { class: 'narr', style: { fontSize: '14.5px' } });
          const seg = ctx.ui.seg([{ value: true, label: 'Obey it' }, { value: false, label: 'Break it' }], obey, (v) => { obey = v; paint(); });
          const KIND = (e) => e.flush ? ['os', 'log → disk'] : e.disk ? ['io', 'metadata → disk'] : ['mem', 'in memory'];
          const val = (key, v) => PART[key][v === 'old' ? 1 : 2];
          function cell(key, v, tagTxt) {
            return h('td', { style: { background: v === 'new' ? 'var(--mem-bg)' : null } }, h('span', { class: 'mono', style: { fontSize: '13.5px' } }, val(key, v)),
              tagTxt ? h('span', { class: 'chip ' + (tagTxt.startsWith('redo') ? 'ok' : 'warn'), style: { marginLeft: '6px' } }, tagTxt) : null);
          }
          const lsns = (a) => { if (!a.length) return 'nothing'; const out = []; let st = a[0], pr = a[0]; a.slice(1).concat([null]).forEach((x) => { if (x === pr + 1) { pr = x; return; } out.push(st === pr ? String(st) : st + '–' + pr); st = pr = x; }); return out.join(', '); };
          function paint() {
            const ev = crashEvents(obey), r = crashSim(obey, k);
            evList.replaceChildren(
              ...[{ t: 'Before T1 starts' }].concat(ev).map((e, i) => {
                const [c, lab] = i ? KIND(e) : ['accent', 'start'];
                return h('button', { class: 'btn sm' + (i === k ? ' on' : ''), type: 'button', 'aria-pressed': i === k ? 'true' : 'false',
                  style: { justifyContent: 'flex-start', height: 'auto', minHeight: '31px', padding: '3px 8px', gap: '8px', textAlign: 'left', whiteSpace: 'normal', fontWeight: 500, opacity: i > k ? 0.5 : 1 },
                  onclick: () => { k = i; paint(); } },
                h('b', { class: 'mono', style: { width: '18px', flex: 'none' } }, i), h('span', { html: e.t, style: { flex: 1 } }), h('span', { class: 'chip ' + c, style: { flex: 'none' } }, lab));
              }));
            const act = {};
            r.actions.forEach((a) => { act[a.key] = a.op + ' ' + a.lsn; });
            table.replaceChildren(h('table', { class: 'tbl compact dense' },
              h('tr', {}, h('th', {}, 'Structure'), h('th', {}, 'In memory (lost)'), h('th', {}, 'On disk after crash'), h('th', {}, 'After recovery')),
              h('tr', {}, h('td', { colspan: 4, class: 'xs muted' }, 'MFT bitmap bit 42: 1 = record 42 in use, 0 = free. Green = the new value written by T1.')),
              ...KEYS.map((key) => h('tr', {}, h('td', { class: 'b' }, PART[key][0]), cell(key, r.cache[key]), cell(key, r.disk[key]), cell(key, r.after[key], act[key]))),
              h('tr', {}, h('td', { class: 'b' }, 'Log records'), h('td', { class: 'mono', style: { fontSize: '13.5px' } }, lsns(r.cacheLog)), h('td', { class: 'mono', style: { fontSize: '13.5px' } }, lsns(r.diskLog)), h('td', { class: 'small muted' }, 'read by recovery'))));
            const dmg = damage(r.disk);
            diskNote.innerHTML = r.okDisk ? '<b class="ok-t">✓ The disk as the crash left it is consistent</b> (every structure is entirely old or entirely new).'
              : `<b class="bad-t">✗ Without recovery the disk would be inconsistent:</b> ${dmg[0]}`;
            if (!r.diskLog.length) recov.innerHTML = `<b>Recovery</b> reads the log on disk and finds nothing about T1, so it has nothing to redo or undo.${r.okDisk ? '' : ' But metadata changes did reach the disk, with no log records to explain them.'}`;
            else if (r.committed) recov.innerHTML = '<b>Recovery</b> finds T1\'s four updates and its commit record (LSN 105) in the log on disk. T1 committed, so it <b>redoes</b> LSN 101, 102, 103, 104 in order. Redoing a change that already reached the disk is harmless: it writes the same value again.';
            else recov.innerHTML = `<b>Recovery</b> finds T1's updates (LSN ${lsns(r.diskLog)}) but no commit record. T1 never finished, so it <b>undoes</b> them newest first: ${r.actions.map((a) => a.lsn).join(', ')}. Undoing a change that never reached the disk is harmless too.`;
            const allNew = KEYS.every((key) => r.after[key] === 'new');
            verdict.className = 'narr ' + (r.okAfter ? 'ok' : 'bad');
            if (!r.okAfter) verdict.innerHTML = `<b>Inconsistent even after recovery.</b> ${damage(r.after)[0]} The changes reached the disk before their log records did, so the log cannot explain them; only a full check (chkdsk) can repair this. Write-ahead logging exists to prevent exactly this.`;
            else if (allNew) verdict.innerHTML = '<b>Consistent: plan.txt exists, fully created.</b> The file system structures agree with each other. (The 10 KB of text inside plan.txt is another matter: user data is not logged.)';
            else if (!r.cacheLog.length) verdict.innerHTML = '<b>Consistent: nothing had happened yet.</b> T1 had not started, so there is nothing to recover.';
            else verdict.innerHTML = `<b>Consistent: as if T1 never ran.</b> ${r.cacheLog.includes(105) ? 'T1 had committed in memory, but with <span class="t">lazy commit</span> (11.10) its commit record was still waiting in the cache, so recovery treats T1 as unfinished. ' : ''}plan.txt is gone, but nothing is left half-done.`;
            ctx.refit();
          }
          el.append(h('div', { class: 'stack fill', style: { gap: '8px' } },
            h('p', { class: 'lead m0', html: 'Transaction T1 creates <code>Docs\\plan.txt</code>: four metadata changes, then a commit. Each change is first written to the <span class="t" data-t="NTFS log file">log</span> as a record numbered by its log sequence number (LSN). Pick when the power fails.' }),
            h('div', { class: 'split grow', style: { gridTemplateColumns: ctx.narrow ? null : 'minmax(0, 5fr) minmax(0, 7fr)' } },
              h('div', { class: 'card stack', style: { gap: '6px' } },
                h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'small b', html: '<span class="t">Write-ahead logging</span> rule:' }), seg),
                h('span', { class: 'xs muted' }, 'The power fails right after the step you click:'),
                evList),
              h('div', { class: 'stack', style: { gap: '7px' } }, table, diskNote, recov, verdict))));
          paint();
        },
      },

      /* ---------------- 7. Recap ---------------- */
      {
        title: 'Recap: six things to remember about NTFS',
        kind: 'recap',
        render(el, ctx) {
          const { h } = ctx;
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },
            h('p', { class: 'lead m0' }, 'Say each answer out loud before you flip the card.'),
            h('div', { style: { padding: '0 8px' } }, ctx.ui.flipcards([
              ['The seven key features of NTFS?', 'Recoverability, security, large disks and large files, multiple data streams, journaling (the change journal), compression and encryption, hard and symbolic links.'],
              ['Sector, cluster, LCN, VCN?', 'A sector is the disk\'s smallest unit (512 B or 4 KB). A cluster is a power-of-two group of sectors, the unit NTFS allocates. LCN numbers clusters on the volume; VCN numbers them inside one file.'],
              ['The four regions of a volume?', 'Partition boot sector, master file table, system files (MFT mirror, log file, cluster bitmap, attribute definition table) and the file area. Every system file is itself listed in the MFT.'],
              ['What is inside an MFT record?', 'About 1 KB of attributes: standard information, file name(s), data, or for a folder index root, index allocation and bitmap. Small values are resident; big data is nonresident, described by runs.'],
              ['How does NTFS find byte N of a file?', 'VCN = ⌊N ÷ cluster size⌋. Find the run that holds that VCN. LCN = the run\'s start LCN + (VCN − the run\'s start VCN).'],
              ['What does the log guarantee, and what not?', 'Metadata changes are logged before they reach the disk, so after a crash committed transactions are redone and unfinished ones undone. User data is not logged and can be lost.'],
            ], { cols: ctx.narrow ? 1 : 3, height: 178 })),
            h('div', { class: 'callout warn m0', 'data-label': 'Do not confuse the two journals', html: 'The <span class="t">NTFS log file ($LogFile)</span> is private to NTFS: it holds redo and undo steps for crash recovery and is overwritten in a circle. The <span class="t">change journal (USN journal)</span> is for other programs: it lists which files were created, changed, renamed or deleted, so backup and search tools can find them.' })));
        },
      },

      /* ---------------- 8. Quiz ---------------- */
      {
        title: 'Check yourself',
        kind: 'check',
        quiz: [
          { type: 'num', q: 'A 512 GB volume (1 GB = 2<sup>30</sup> bytes) is formatted with 4 KB clusters. How many megabytes (1 MB = 2<sup>20</sup> bytes) does its cluster bitmap occupy?', answer: 16, tol: 0, unit: 'MB',
            why: '512 GB ÷ 4 KB = 2<sup>39</sup> ÷ 2<sup>12</sup> = 2<sup>27</sup> = 134,217,728 clusters. One bit each gives 2<sup>27</sup> bits = 2<sup>24</sup> bytes = 16 MB.' },
          { type: 'num', q: 'A volume uses 4 KB (4,096-byte) clusters. A file holds 10,000 bytes, too many to stay inside its MFT record. How many bytes of slack are left unused in its last cluster?', answer: 2288, tol: 0, unit: 'bytes',
            why: 'The file needs ⌈10,000 ÷ 4,096⌉ = 3 clusters = 12,288 bytes. 12,288 − 10,000 = 2,288 bytes of slack (internal fragmentation).' },
          { type: 'num', q: 'A file on a volume with 4 KB clusters has three data runs: VCN 0–29 at LCN 10,240; VCN 30–51 at LCN 52,000; VCN 52–73 at LCN 31,500. Which LCN holds byte 150,000 of the file?', answer: 52006, tol: 0, unit: '',
            why: 'VCN = ⌊150,000 ÷ 4,096⌋ = 36. VCN 36 lies in the second run (VCN 30–51), so LCN = 52,000 + (36 − 30) = 52,006.' },
          { q: 'Where does NTFS keep the contents of a 300-byte text file?',
            choices: ['In one cluster of the file area, like every other file', 'In the cluster bitmap, next to the bit for its cluster', 'Inside its own MFT record, as a resident data attribute', 'In the log file, until the lazy writer moves it out'], answer: 2,
            feedback: ['Only data too big for the record goes to clusters. 300 bytes fits in the record, so no cluster is used at all.', 'The bitmap holds one bit per cluster and nothing else; it never stores file contents.', null, 'The log holds metadata steps for recovery, never file contents.'],
            why: 'A 1 KB record has room for several hundred bytes of data after the header, standard information and file name, so a small file\'s data attribute stays resident: no cluster, no extra disk read.' },
          { type: 'tf', q: 'NTFS logging guarantees that the data a program wrote just before a power failure survives the crash.', answer: false,
            why: 'NTFS logs metadata (the MFT, folders, bitmaps) so its structures are always consistent after recovery. File contents still waiting in the cache for the lazy writer are not logged and can be lost.' },
          { type: 'order', q: 'Put the steps of a logged metadata change in the order NTFS performs them.',
            items: ['Write the log record for the change into the log, in the cache', 'Make the change to the metadata, in the cache', 'Flush the log record to the log file on disk', 'Write the changed metadata to the volume on disk'],
            why: 'This is write-ahead logging: the log record always reaches the disk before the metadata change it describes, so recovery can redo or undo anything it finds on disk.' },
          { type: 'match', q: 'Match each part of an NTFS volume to its job.',
            pairs: [['Partition boot sector', 'Records the cluster size and where the MFT starts'], ['MFT mirror', 'Copy of the first four MFT records'], ['Log file', 'Redo and undo steps of metadata transactions'], ['Cluster bitmap', 'One bit per cluster: in use or free'], ['Attribute definition table', 'The attribute types the volume supports and their rules']],
            why: 'The boot sector describes the layout, the mirror protects the start of the MFT, the log supports recovery, the bitmap tracks free space and $AttrDef defines the attribute types.' },
          { type: 'bucket', q: 'Is each attribute value stored inside the MFT record (resident) or in clusters outside it (nonresident)?', buckets: ['Resident', 'Nonresident'],
            items: [['The standard information of any file', 0], ['A file name attribute', 0], ['The data of a 2 MB photo', 1], ['The index root of a folder', 0], ['The index allocation of a large folder', 1], ['The data of a 200-byte note', 0]],
            why: 'Standard information, file names and the index root are always resident. Data stays resident only while it fits in the record; 2 MB never does. The index allocation is by definition the part of a folder\'s index stored outside the record.' },
          { type: 'multi', q: 'Which of these are features of NTFS?',
            choices: ['Several named data streams in one file', 'Compression of single files or folders', 'A maximum file size of 4 GB', 'Hard links and symbolic links', 'Logging of all user data, so no written byte is lost'], answer: [0, 1, 3],
            why: 'Multiple data streams, compression and links are NTFS features. A 4 GB file limit belongs to the older FAT32, and NTFS logs only metadata, not user data.' },
          { q: 'NTFS is creating a file. The log on disk holds all four update records and the commit record of the transaction, but the folder index change had not reached the volume when the power failed. What does recovery do?',
            choices: ['Undoes all four updates, because the folder change never reached the disk', 'Redoes all four updates, so the file exists and its folder lists it', 'Nothing: it leaves the half-written structures for chkdsk to find', 'Redoes only the folder change and undoes the other three updates'], answer: 1,
            feedback: ['Undo is for transactions with no commit record on disk. This one committed, so it must be completed, not rolled back.', null, 'Leaving a half-done change is exactly what the log exists to prevent.', 'A transaction is all or nothing: recovery never keeps part of it and cancels the rest.'],
            why: 'A commit record on disk means the transaction committed, so recovery redoes every one of its logged updates. Redoing updates that already reached the disk is harmless.' },
          { q: 'Backup software wants the list of files changed since last night, without scanning the whole volume. Which NTFS structure gives it that list?',
            choices: ['The NTFS log file ($LogFile)', 'The cluster bitmap ($Bitmap)', 'The MFT mirror ($MFTMirr)', 'The change journal ($UsnJrnl)'], answer: 3,
            feedback: ['The log file holds low-level redo and undo steps for crash recovery and is overwritten in a circle; it is not meant for applications.', 'The bitmap says which clusters are used, not which files changed.', 'The mirror is a copy of the first four MFT records, kept for recovery.', null],
            why: 'The change journal records every create, delete, rename and write with an update sequence number, so a program can ask for everything after the number it saw last time.' },
          { q: 'On an NTFS volume, a file has two hard links, A.txt and B.txt. You delete A.txt. What happens?',
            choices: ['B.txt still opens the file; the link count drops from 2 to 1', 'B.txt now dangles, because its target was deleted', 'The file\'s clusters are freed and B.txt becomes empty', 'Windows refuses: a file with two names cannot be deleted'], answer: 0,
            feedback: [null, 'That is how a symbolic link behaves. Hard links are equal names for one MFT record, so no name depends on another.', 'Clusters are freed only when the last name is deleted.', 'Deleting one name of a file is allowed; it just removes that directory entry.'],
            why: 'Both names point to the same MFT record. Deleting one removes that name and lowers the link count; the file itself disappears only when the count reaches zero.' },
        ],
      },
    ],
    notes: `
      <h3>NTFS and its seven key features</h3>
      <p>NTFS (New Technology File System) is the Windows file system, introduced with Windows NT in 1993. Key features:</p>
      <ul>
        <li><b>Recoverability.</b> After a crash NTFS restores its own structures to a consistent state from a log of metadata transactions, and keeps spare copies of vital data (MFT mirror, backup boot sector).</li>
        <li><b>Security.</b> Every file and folder has a security descriptor (owner plus access control list), checked at every open; since NTFS 3.0 (Windows 2000) descriptors are stored once in $Secure and files refer to them by ID.</li>
        <li><b>Large disks and large files.</b> Cluster numbers are 64 bits on disk; current Windows allows up to 2<sup>32</sup> − 1 clusters per volume, so the size limit grows with the cluster size: about 16 TB at 4 KB, 256 TB at 64 KB, 8 PB at 2 MB (clusters above 64 KB need Windows 10 version 1709 or Windows Server 2019 and later). A single file can be almost as big as its volume, unlike FAT32, which stops at 4 GB per file.</li>
        <li><b>Multiple data streams.</b> Besides its unnamed main stream, a file may carry named streams (alternate data streams), written <code>file:name</code>. Downloaded files get a Zone.Identifier stream, so Windows warns before opening them.</li>
        <li><b>Journaling.</b> The change journal (USN journal) lists every create, delete, rename and write with an update sequence number, so backup and search tools find changes without scanning the volume.</li>
        <li><b>Compression and encryption.</b> Per file or per folder (new files inherit the folder's setting), transparent to programs. Encryption is the Encrypting File System (EFS); a file cannot be both compressed and encrypted.</li>
        <li><b>Hard and symbolic links.</b> A hard link is an extra name for the same MFT record (files only, same volume only); the file is deleted when its last name goes. A symbolic link (Windows Vista onward) is a small file holding a path; it can point to folders, other volumes or other computers, and dangles if the target is deleted.</li>
      </ul>

      <h3>Sectors, clusters and volumes</h3>
      <ul>
        <li><b>Sector:</b> the disk's smallest unit of transfer: 512 bytes, or 4 KB on newer drives.</li>
        <li><b>Cluster:</b> one or more adjacent sectors, always a power of two; the unit in which NTFS allocates space. <b>Cluster factor</b> = sectors per cluster = cluster size ÷ sector size (4 KB ÷ 512 B = 8). A cluster can never be smaller than a sector.</li>
        <li><b>Volume:</b> a logical disk with one file system: part of a disk, a whole disk, or space on several disks (software RAID). Its clusters are numbered from 0: the <b>logical cluster number (LCN)</b>. A cluster's byte offset on the volume is LCN × cluster size. Inside one file, clusters are numbered from 0 again: the <b>virtual cluster number (VCN)</b>.</li>
      </ul>
      <table>
        <tr><th>Volume size</th><th>Typical default cluster (recent Windows)</th></tr>
        <tr><td>up to 16 TB</td><td>4 KB</td></tr>
        <tr><td>16 – 32 TB</td><td>8 KB</td></tr>
        <tr><td>32 – 64 TB</td><td>16 KB</td></tr>
        <tr><td>64 – 128 TB</td><td>32 KB</td></tr>
        <tr><td>128 – 256 TB</td><td>64 KB</td></tr>
        <tr><td>256 TB – 8 PB</td><td>128 KB to 2 MB (newer versions only)</td></tr>
      </table>
      <p>Defaults change between versions (Windows NT 4.0 used 512 B to 2 KB on small volumes); each is the smallest size from 4 KB up that keeps the volume within 2<sup>32</sup> − 1 clusters.</p>
      <p><b>Worked example.</b> A 512 GB volume with 4 KB clusters has 2<sup>39</sup> ÷ 2<sup>12</sup> = 2<sup>27</sup> = 134,217,728 clusters (LCN 0 to 134,217,727). The cluster bitmap needs one bit per cluster: 2<sup>27</sup> bits = 16 MB. A 10,000-byte file needs ⌈10,000 ÷ 4,096⌉ = 3 clusters = 12,288 bytes, leaving 2,288 bytes of <b>slack</b> (internal fragmentation). Over many files of random sizes, a file wastes about half a cluster on average (a file much smaller than a cluster wastes most of it); bigger clusters mean a smaller bitmap but more slack.</p>

      <h3>Layout of an NTFS volume</h3>
      <ol>
        <li><b>Partition boot sector</b> (up to 16 sectors): bytes per sector, sectors per cluster, volume size, the LCN of the MFT and of the MFT mirror, the MFT record size, and boot startup code. Backup copy in the last sector.</li>
        <li><b>Master file table (MFT).</b></li>
        <li><b>System files:</b> the <b>MFT mirror</b> (copy of the first four MFT records), the <b>log file</b> (transaction steps for recovery), the <b>cluster bitmap</b> (one bit per cluster: used or free) and the <b>attribute definition table</b> (the attribute types the volume supports, with their type codes and rules: may they be nonresident, indexed, how big).</li>
        <li><b>File area:</b> the clusters of everything too big to live in an MFT record.</li>
      </ol>
      <p>Every system file is itself a file with an MFT record, so this order describes roles rather than fixed positions. Records 0–15 are reserved: 0 $MFT, 1 $MFTMirr, 2 $LogFile, 3 $Volume, 4 $AttrDef, 5 the root folder, 6 $Bitmap, 7 $Boot, 8 $BadClus, 9 $Secure, 10 $UpCase, 11 $Extend (change journal, quotas, object IDs, reparse points), 12–15 unused.</p>

      <h3>The master file table</h3>
      <p>The MFT is the heart of NTFS: a table of records, usually 1 KB each (4 KB on disks with 4 KB native sectors), one per file or folder. A record holds a header (in use?, folder?, sequence number, link count) and then typed <b>attributes</b>:</p>
      <ul>
        <li><b>Standard information</b> (0x10): flags such as read-only and hidden, four time stamps; since NTFS 3.0 also owner ID, security ID, quota charge and latest change-journal number.</li>
        <li><b>Attribute list</b> (0x20): only when the attributes do not fit in one record; says which extra record holds each one.</li>
        <li><b>File name</b> (0x30): the name, the parent folder's record number, copies of size and times. One per name: a long name and a short 8.3 name, or one per hard link.</li>
        <li><b>Security descriptor</b> (0x50): owner and access list; in records only up to NTFS 1.2 (Windows NT 4.0), now kept in $Secure.</li>
        <li><b>Volume name</b> (0x60), <b>volume information</b> (0x70): only in $Volume: label, NTFS version (3.1), dirty flag.</li>
        <li><b>Data</b> (0x80): the contents; unnamed main stream plus optional named streams.</li>
        <li><b>Index root</b> (0x90), <b>index allocation</b> (0xA0) and <b>bitmap</b> (0xB0): a folder's index of names, a balanced tree from the B-tree family (often called a B+ tree, though like a plain B-tree it also keeps real entries in its upper nodes). The root is resident; further 4 KB index blocks are nonresident; the bitmap marks which index blocks are in use. A folder has no data attribute.</li>
      </ul>
      <p>A <b>resident</b> attribute is stored inside the record; a <b>nonresident</b> one lives in clusters, and the record keeps only its <b>data runs</b>. Standard information, file names and the index root are always resident. A small file's data is resident too: with a short name, roughly 700 bytes fit after the header (56 bytes), standard information (96) and file name (about 112) in a 1 KB record, so such a file uses no cluster and needs no extra disk read. Once data moves out, NTFS does not move it back.</p>

      <h3>Data runs, VCN and LCN</h3>
      <p>A run is a stretch of clusters that are adjacent on disk, stored as (start VCN, start LCN, length). To find byte N of a file: VCN = ⌊N ÷ cluster size⌋; find the run holding that VCN; LCN = run's start LCN + (VCN − run's start VCN). Example with 4 KB clusters and runs VCN 0–29 at LCN 10,240, VCN 30–51 at LCN 52,000, VCN 52–73 at LCN 31,500 (a 300,000-byte file, 74 clusters): byte 150,000 is in VCN 36, byte 2,544 of it; VCN 36 is in run 2, so LCN = 52,000 + 6 = 52,006 and the byte sits at 52,006 × 4,096 + 2,544 = 213,019,120 on the volume. These three runs take about 14 bytes of the record. A badly fragmented file needs a run per piece, and on a hard disk each run costs a seek.</p>

      <h3>Recoverability</h3>
      <p>NTFS groups the metadata changes of one operation (for example: allocate an MFT record, fill it in, add the name to the folder, mark clusters used) into a <b>transaction</b>. Each log record is numbered by its <b>log sequence number (LSN)</b>, and NTFS follows <b>write-ahead logging</b>:</p>
      <ol>
        <li>write the log record (with redo and undo information) into the log, in the cache;</li>
        <li>make the metadata change in the cache;</li>
        <li>flush the log records to the log file on disk;</li>
        <li>only then let the cache manager write the changed metadata to the volume.</li>
      </ol>
      <p>After a crash, recovery reads the log on disk. A transaction whose commit record reached the disk is <b>redone</b>; one without a commit record is <b>undone</b>, newest step first. Redoing or undoing a step is harmless even if its result is already (or never was) on disk. The result: the structures are always consistent, either as if the transaction completed or as if it never ran. Breaking the rule (metadata on disk before its log records) leaves changes the log cannot explain, so a full chkdsk is needed. Only metadata is logged: file contents waiting in the cache for the lazy writer (11.10) can be lost, and a just-committed change can vanish if its commit record was still in memory. Do not confuse the log file (private, for recovery, circular) with the change journal (for applications, a list of which files changed).</p>
    `,
  });
})();
