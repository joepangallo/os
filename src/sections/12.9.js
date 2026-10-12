/* =====================================================================
   12.9 Linux Virtual File System
   Original teaching material. Helpers shared by several steps live inside
   this IIFE (no globals).
   ===================================================================== */
(function () {

  // box(): a rounded rectangle with one or more centred text lines; r = [x, y, w, h]
  function box(s, r, cls, lines, o = {}) {
    const [x, y, w, hh] = r, fs = o.fs || 14, lh = fs + 3;
    const top = y + hh / 2 - ((lines.length - 1) * lh) / 2 + fs * 0.36;
    return s('g', {},
      s('rect', { x, y, width: w, height: hh, rx: o.rx || 10, class: cls + ' fr', 'stroke-width': o.sw || 2, 'stroke-dasharray': o.dash || null }),
      ...lines.map((t, i) => s('text', { x: x + w / 2, y: top + i * lh, 'text-anchor': 'middle', 'font-size': i === 0 ? fs : (o.fs2 || fs), 'font-weight': i === 0 ? 800 : 600, class: i === 0 ? (o.c0 || null) : 's-sub', 'font-family': o.mono && i > 0 ? 'var(--mono)' : null }, t)));
  }

  // obj(): an object box with a bold title and left-aligned field lines underneath
  function obj(s, r, cls, title, lines, o = {}) {
    const [x, y, w, hh] = r, fs = o.fs || 13.5;
    return s('g', {},
      s('rect', { x, y, width: w, height: hh, rx: 10, class: cls + ' fr', 'stroke-width': o.sw || 2, 'stroke-dasharray': o.dash || null }),
      s('text', { x: x + 8, y: y + fs + 5, 'font-size': fs + 0.5, 'font-weight': 800 }, title),
      ...lines.map((t, i) => s('text', { x: x + 8, y: y + fs + 9 + (i + 1) * (fs + 4), 'font-size': fs, 'font-family': 'var(--mono)', class: o.sub === false ? null : 's-sub' }, t)));
  }

  // arrow(): a straight connector with an arrowhead; cls picks the colour
  function arrow(s, x1, y1, x2, y2, cls = 's-line', mk = 'arr', o = {}) {
    return s('line', { x1, y1, x2, y2, class: cls, 'stroke-width': o.sw || 2, 'marker-end': mk ? `url(#${mk})` : null, 'stroke-dasharray': o.dash || null });
  }

  // path(): a bent connector through several points, with an arrowhead at the end
  function path(s, pts, cls = 's-line', mk = 'arr', o = {}) {
    return s('polyline', { points: pts.map((p) => p.join(',')).join(' '), style: { fill: 'none' }, class: cls, 'stroke-width': o.sw || 2, 'marker-end': mk ? `url(#${mk})` : null, 'stroke-dasharray': o.dash || null });
  }

  // hot(): wraps an SVG group so it behaves like a button (click, Enter, Space)
  function hot(s, label, on, fn, ...kids) {
    return s('g', { class: 'hot' + (on ? ' sel' : ''), role: 'button', tabindex: 0, 'aria-label': label, onclick: fn,
      onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } } }, ...kids);
  }

  /* OBJS: the four VFS objects behind one open file, for a file on ext4 and a file on a FAT USB stick.
     For each object: what it stands for, its fields [name, value], and its operations table [slot, job, function]. */
  const commas = (v) => v.toLocaleString('en-US');
  const PHOTO = 1843200, CLUSTER = 32768;
  const OBJS = {
    ext4: {
      path: '/home/ana/notes.txt', parents: ['ana', 'home', '/'], name: 'notes.txt', ino: '1311', size: '2,140 bytes', dev: 'nvme0n1p2', fsn: 'ext4',
      file: { stand: 'One open of notes.txt by process P1. open() created it and the last close() will free it. It is never stored on disk.',
        fields: [['f_path', 'dentry notes.txt (and its mount)'], ['f_inode', 'inode 1311'], ['f_pos', '0 · where the next read starts'], ['f_mode', 'read · checked on every read()'], ['f_flags', 'O_RDONLY · as passed to open()'], ['f_ref', '1 · users of this file object (f_count before Linux 6.13)'], ['f_op', 'ext4_file_operations']],
        table: 'ext4_file_operations', ops: [['llseek', 'move the offset', 'ext4_llseek'], ['read_iter', 'read bytes', 'ext4_file_read_iter'], ['write_iter', 'write bytes', 'ext4_file_write_iter'], ['open', 'extra work at open', 'ext4_file_open'], ['release', 'clean up after the last close', 'ext4_release_file'], ['fsync', 'force the data to storage', 'ext4_sync_file'], ['lock', 'lock a byte range', null]],
        more: 'Also mmap, ioctl, splice and about 20 more slots. read_iter and write_iter (Linux 3.16, 2014) took over from the older read and write slots, which ext4 leaves empty. An empty (NULL) slot means the VFS default applies, or that the job is not supported.' },
      dentry: { stand: 'One component of a path: the name notes.txt inside the directory ana. Path lookup builds it and the dentry cache keeps it. It is never stored on disk.',
        fields: [['d_name', '"notes.txt"'], ['d_parent', 'dentry "ana"'], ['d_inode', 'inode 1311 (NULL = no such file)'], ['d_sb', 'the ext4 superblock'], ['d_op', 'none: VFS default rules'], ['use count', 'held by P1\'s open file']],
        table: 'd_op is NULL for ext4', ops: [['d_revalidate', 'is this cached entry still right?', null], ['d_hash', 'hash a name for the cache', null], ['d_compare', 'do two names match?', null], ['d_delete', 'drop it once unused?', null], ['d_release', 'free private data', null]],
        more: 'Plain ext4 leaves this table out (only its case-insensitive or encrypted directories set one), so the VFS compares names byte for byte and trusts what it has cached.' },
      inode: { stand: 'The file itself: one inode object per file, however many names or opens it has. ext4 built it from its on-disk inode 1311 when the file was first needed.',
        fields: [['i_ino', '1311 · the inode number'], ['i_mode', 'regular file, rw-r--r--'], ['i_uid, i_gid', '1000, 1000 (ana)'], ['i_size', '2,140 bytes'], ['i_nlink', '1 · names on disk (hard links)'], ['i_blocks', '8 · 512-byte units = one 4 KB block'], ['times', 'last access, modification, change'], ['i_sb', 'the ext4 superblock'], ['i_op', 'ext4_file_inode_operations'], ['i_fop', 'ext4_file_operations (copied to f_op at open)']],
        table: 'ext4_file_inode_operations', ops: [['setattr', 'change mode, owner, size, times', 'ext4_setattr'], ['getattr', 'answer stat()', 'ext4_file_getattr'], ['listxattr', 'list extended attributes', 'ext4_listxattr'], ['fiemap', 'report where the extents lie', 'ext4_fiemap']],
        more: 'This is a regular file. A directory\'s inode (like ana\'s) points to ext4_dir_inode_operations instead: create, lookup, link, unlink, symlink, mkdir, rmdir, mknod, rename.' },
      sb: { stand: 'The whole mounted file system: the ext4 file system on partition nvme0n1p2, mounted at /. There is one per mounted file system.',
        fields: [['s_id', '"nvme0n1p2" · the device'], ['s_type', 'ext4'], ['s_blocksize', '4,096 bytes'], ['s_magic', '0xEF53 · the ext2/3/4 signature'], ['s_maxbytes', 'about 16 TiB · largest file'], ['s_flags', 'mount flags: read-write'], ['s_root', 'dentry "/" of this file system'], ['s_umount', 'semaphore held while (un)mounting'], ['s_fs_info', 'ext4\'s private data'], ['s_op', 'ext4_sops']],
        table: 'ext4_sops', ops: [['alloc_inode', 'make a new in-memory inode', 'ext4_alloc_inode'], ['write_inode', 'write an inode back to disk', 'ext4_write_inode'], ['evict_inode', 'an inode leaves memory', 'ext4_evict_inode'], ['put_super', 'release it all at unmount', 'ext4_put_super'], ['sync_fs', 'flush the whole file system', 'ext4_sync_fs'], ['statfs', 'free-space numbers for df', 'ext4_statfs']],
        more: 'Older kernels also had read_inode here; it was removed in 2.6.25 (2008). 2.6-era superblocks also kept a dirty flag and a list of open files, both dropped in the 3.x series.' },
    },
    vfat: {
      path: '/media/usb/photo.jpg', parents: ['/ of the stick'], name: 'photo.jpg', ino: 'made up', size: commas(PHOTO) + ' B', dev: 'sda1', fsn: 'vfat',
      file: { stand: 'One open of photo.jpg by process P1. Same fields as for any file; only the table its f_op points to is vfat\'s.',
        fields: [['f_path', 'dentry photo.jpg (and its mount)'], ['f_inode', 'the photo\'s inode'], ['f_pos', '0 · where the next read starts'], ['f_mode', 'read · checked on every read()'], ['f_flags', 'O_RDONLY · as passed to open()'], ['f_ref', '1 · users of this file object (f_count before Linux 6.13)'], ['f_op', 'fat_file_operations']],
        table: 'fat_file_operations', ops: [['llseek', 'move the offset', 'generic_file_llseek'], ['read_iter', 'read bytes', 'generic_file_read_iter'], ['write_iter', 'write bytes', 'generic_file_write_iter'], ['open', 'extra work at open', null], ['release', 'clean up after the last close', 'fat_file_release'], ['fsync', 'force the data to storage', 'fat_file_fsync'], ['lock', 'lock a byte range', null]],
        more: 'Three slots point at shared generic_ helpers: vfat reuses the kernel\'s standard page-cache code.' },
      dentry: { stand: 'The name photo.jpg in the stick\'s root directory. The path walk reached /media/usb, found a <span class="t">mount point</span> there and continued in the stick\'s own root dentry.',
        fields: [['d_name', '"photo.jpg"'], ['d_parent', 'the stick\'s root dentry'], ['d_inode', 'the photo\'s inode'], ['d_sb', 'the vfat superblock'], ['d_op', 'vfat_ci_dentry_ops'], ['use count', 'held by P1\'s open file']],
        table: 'vfat_ci_dentry_ops', ops: [['d_revalidate', 'is this cached entry still right?', 'vfat_revalidate_ci'], ['d_hash', 'hash a name, ignoring case', 'vfat_hashi'], ['d_compare', 'compare names, ignoring case', 'vfat_cmpi']],
        more: 'FAT names ignore case, so open("/media/usb/PHOTO.JPG") finds this very dentry. That is why vfat fills in d_hash and d_compare.' },
      inode: { stand: 'The photo itself. FAT stores no inodes, so vfat built this inode object in memory from the photo\'s directory entry and the mount options.',
        fields: [['i_ino', 'made up by vfat (FAT stores none)'], ['i_mode', 'rwxr-xr-x, from the mount options'], ['i_uid, i_gid', '1000, 1000, from the mount options'], ['i_size', commas(PHOTO) + ' bytes'], ['i_nlink', '1 · FAT cannot hold a second name'], ['i_blocks', commas(Math.ceil(PHOTO / CLUSTER) * CLUSTER / 512) + ' · ' + Math.ceil(PHOTO / CLUSTER) + ' clusters of 32 KB, in 512-byte units'], ['times', 'from the directory entry'], ['i_sb', 'the vfat superblock'], ['i_op', 'fat_file_inode_operations'], ['i_fop', 'fat_file_operations']],
        table: 'fat_file_inode_operations', ops: [['setattr', 'change mode, owner, size, times', 'fat_setattr'], ['getattr', 'answer stat()', 'fat_getattr'], ['update_time', 'update the timestamps', 'fat_update_time']],
        more: 'The stick\'s directories use vfat_dir_inode_operations: create, lookup, unlink, mkdir, rmdir, rename, but no link or symlink slot. FAT cannot store them, so ln on the stick fails.' },
      sb: { stand: 'The FAT file system on the USB stick\'s partition sda1, mounted at /media/usb. A second superblock object, alongside ext4\'s.',
        fields: [['s_id', '"sda1" · the device'], ['s_type', 'vfat'], ['s_blocksize', '512 bytes (the sector size)'], ['s_magic', '0x4D44 · FAT\'s value'], ['s_maxbytes', '4 GiB − 1 byte · FAT\'s limit'], ['s_flags', 'mount flags: read-write'], ['s_root', 'the stick\'s root dentry'], ['s_umount', 'semaphore held while (un)mounting'], ['s_fs_info', 'FAT\'s private data (cluster size…)'], ['s_op', 'fat_sops']],
        table: 'fat_sops', ops: [['alloc_inode', 'make a new in-memory inode', 'fat_alloc_inode'], ['write_inode', 'write an inode back to disk', 'fat_write_inode'], ['evict_inode', 'an inode leaves memory', 'fat_evict_inode'], ['put_super', 'release it all at unmount', 'fat_put_super'], ['statfs', 'free-space numbers for df', 'fat_statfs']],
        more: 'write_inode here does not write an inode: it rewrites the photo\'s FAT directory entry, the closest thing FAT has.' },
    },
  };

  /* The dentry cache lab's model. TREE lists every name that exists on the ext4 disk (parent → children).
     dlookup(cache, path) walks the path one component at a time, exactly as the step's text describes:
     a component found in the cache is a hit (a negative entry ends the walk with "no such file");
     a missing one costs one slow lookup by the file system, whose answer is then cached as a positive or
     negative dentry. The root dentry is always present (it is pinned while the file system is mounted). */
  const TREE = { '/': ['bin', 'home'], '/bin': ['vi', 'ls'], '/home': ['ana', 'ben'], '/home/ana': ['notes.txt', 'todo.txt'], '/home/ben': ['main.c'] };
  const exists = (id) => { const i = id.lastIndexOf('/'), par = i === 0 ? '/' : id.slice(0, i); return (TREE[par] || []).includes(id.slice(i + 1)); };
  function dlookup(cache, path) {
    const steps = [];
    let cur = '/', found = true;
    for (const name of path.split('/').filter(Boolean)) {
      const id = (cur === '/' ? '' : cur) + '/' + name;
      if (cache[id]) { steps.push({ id, name, hit: true, neg: cache[id] === 'neg' }); if (cache[id] === 'neg') { found = false; break; } }
      else { const ok = exists(id); cache[id] = ok ? 'pos' : 'neg'; steps.push({ id, name, hit: false, neg: !ok }); if (!ok) { found = false; break; } }
      cur = id;
    }
    return { steps, found, hits: steps.filter((x) => x.hit).length, slow: steps.filter((x) => !x.hit).length };
  }


  Guide.section({
    id: '12.9',
    title: 'Linux Virtual File System',
    short: 'Linux VFS',
    summary: 'How Linux serves every file system through one interface: four VFS objects, ops tables, a dentry cache.',
    objectives: [
      'Explain how the Linux virtual file system lets one set of system calls work on ext4, a USB stick, a network share or /proc.',
      'Trace a read() from a process through the VFS to a specific file system and its device, and say which parts change with the file system.',
      'Describe the superblock, inode, dentry and file objects: what each one stands for, what it holds and which operations table it carries.',
      'Explain how structs with tables of function pointers make the VFS object-oriented in C, and how a new file system plugs in.',
      'Show how the dentry cache, including negative dentries, saves work on repeated path lookups.',
    ],
    terms: [
      ['Virtual file system (VFS)', 'The layer of the Linux kernel that receives every file-related system call and serves it through one common file model, calling the right file system\'s code through tables of function pointers. It lets dozens of file system types work behind the same calls.'],
      ['Common file model', 'The one generic picture of files that the VFS works with: superblock, inode, dentry and file objects, each with a standard set of operations. Every file system must present its data in this shape.'],
      ['Mapping function', 'In the classic picture of a VFS, the code each file system supplies to translate between the common file model and its own format. In Linux, that translation is the set of operations tables the file system fills in.'],
      ['Superblock object', 'The VFS object that stands for one mounted file system: its device, type, block size and flags, the dentry of its root directory, and a pointer to its super_operations table.'],
      ['Inode object', 'The VFS object that stands for one file (a directory is a file too): owner, group, permissions, size, times and link count, plus pointers to its inode_operations table and to the file_operations used when it is opened.'],
      ['Dentry object', 'A directory entry object: the VFS object for one component of a path, such as bin in /bin/vi. It links a name to its inode and to its parent\'s dentry. Dentries exist only in main memory.'],
      ['VFS file object', 'The VFS object for one open of a file. open() creates it, fork() and dup() let several descriptors share it, and the last close() frees it. It holds the current file offset, the access mode, a pointer to the dentry and a pointer to the file_operations table.'],
      ['Operations table', 'A C struct whose members are function pointers, one slot per job (read_iter, lookup, statfs...). Each file system fills in its own copy, and each VFS object points to the right one.'],
      ['Function pointer', 'A variable that holds the address of a function. Calling through it runs whichever function it points to at that moment, which lets C code choose its behaviour at run time.'],
      ['Dentry cache (dcache)', 'The kernel\'s cache of recently used dentry objects, found by parent and name, so a path lookup can skip the file system\'s slow directory search for every component it has met recently.'],
      ['Negative dentry', 'A cached dentry that records that a name does NOT exist in a directory, so a repeated lookup of a missing file fails at once without searching the directory again.'],
      ['Mount (mount point)', 'Attaching a file system\'s directory tree to a directory of the tree already in use, called the mount point. After a USB stick is mounted at /media/usb, paths below that directory lead into the stick.'],
      ['ext4', 'The fourth extended file system, the default on many Linux distributions. It keeps a journal and records where files live as extents (runs of neighbouring blocks).'],
      ['vfat', 'Linux\'s driver for the FAT family of file systems with long file names, as found on USB sticks and SD cards. FAT stores no inodes, owners or permission bits, so vfat makes them up in memory.'],
      ['NFS (Network File System)', 'A file system whose files live on another computer. The NFS client in the kernel turns each file operation into a request sent over the network to the server.'],
      ['procfs', 'A pseudo file system mounted at /proc. Its files are stored on no device: the kernel generates their contents from its own data at the moment they are read.'],
    ],
    css: `
      .sec-12-9 .hot { cursor: pointer; outline: none; }
      .sec-12-9 .hot .fr { transition: stroke-width .15s; }
      .sec-12-9 .hot:hover .fr, .sec-12-9 .hot:focus-visible .fr { stroke-width: 3.5; }
      .sec-12-9 .hot.sel .fr { stroke-width: 4.5; }
      .sec-12-9 .narr { background: var(--panel-2); border: 1px solid var(--line); border-left: 5px solid var(--chc); border-radius: 12px; padding: 9px 13px; font-size: 15px; line-height: 1.45; }
      .sec-12-9 .narr.ok { border-left-color: var(--ok); background: var(--ok-bg); }
      .sec-12-9 .narr.bad { border-left-color: var(--bad); background: var(--bad-bg); }
      .sec-12-9 .narr.warn { border-left-color: var(--warn); background: var(--warn-bg); }
      .sec-12-9 .narr code { white-space: nowrap; }
      .sec-12-9 .dc-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
      .sec-12-9 .og-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
      .sec-12-9 .og-card { border: 2px solid var(--line); border-radius: 12px; padding: 10px 10px; background: var(--panel); display: flex; flex-direction: column; gap: 4px; min-width: 0; }
      .sec-12-9 .og-card.right { border-color: var(--ok); background: var(--ok-bg); }
      .sec-12-9 .og-card.wrong { border-color: var(--bad); background: var(--bad-bg); }
      .sec-12-9 .og-name { font-family: var(--mono); font-weight: 800; font-size: 17px; }
      .sec-12-9 .og-btns { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 4px; }
      .sec-12-9 .og-btns .btn { padding: 0 4px; height: 30px; font-size: 13px; min-width: 0; }
      .sec-12-9 .og-btns .btn.pick-ok { border-color: var(--ok); color: var(--ok); background: var(--ok-bg); }
      .sec-12-9 .og-btns .btn.pick-bad { border-color: var(--bad); color: var(--bad); background: var(--bad-bg); }
      .sec-12-9 .og-btns .btn.pick-ok:disabled, .sec-12-9 .og-btns .btn.pick-bad:disabled { opacity: 1; }
    `,
    steps: [
      /* ---------------- 1. Big picture: one set of calls, many file systems ---------------- */
      {
        title: 'One set of calls, many file systems',
        kind: 'story',
        html: `
          <div class="split l fill">
            <div class="stack" style="gap:9px">
              <p class="lead m0">A Linux laptop may use four file systems at once: ext4 on its SSD, FAT on a USB stick, a folder shared by another computer, and /proc, on no disk at all. Programs use them all with the same open, read, write and close.</p>
              <p class="m0">The part of the kernel that makes this work is the <span class="t">virtual file system (VFS)</span>. Every file system call arrives there first. The VFS does the jobs that are the same everywhere (walking a path, checking permissions, tracking open files) and passes only the format-specific work to the right file system's code.</p>
              <div class="callout analogy m0" data-label="Analogy">A library's front desk. You hand over the same request slip for any item. It may sit on the open shelves, in the basement archive or at a partner library across town; staff who know each place fetch it, and you never learn which. The VFS is the desk; each file system is one storage place with its own staff.</div>
            </div>
            <div class="card stack" style="gap:8px">
              <div class="row" style="justify-content:space-between"><h4 class="m0">Linux's file system stack</h4><span class="xs muted">click a box</span></div>
              <div class="vfs-map"></div>
              <div class="card white grow vfs-detail" style="display:flex;flex-direction:column;gap:5px"></div>
            </div>
          </div>`,
        render(el, ctx) {
          const { h, s } = ctx;
          const slim = ctx.narrow;
          // parts: [title, shape class, chip class, what it is, what sits under it]
          const parts = {
            proc: ['Processes', 's-proc', 'proc', 'Programs call open, read, write, close, mkdir, rename, stat and the rest. The calls and their arguments are the same whatever kind of file system holds the file: a program never names ext4 or NFS.', 'They talk only to the system call interface.'],
            vfs: ['Virtual file system (VFS)', 's-os', 'os', 'Receives every file system call and works only with its own generic objects, the <span class="t">common file model</span>: superblock, inode, dentry, file. It does the shared jobs itself (path lookup, permission checks, descriptors, the dentry cache) and reaches a file system\'s code only through that file system\'s tables of functions.', 'Under it: whichever file system holds the file.'],
            ext4: ['ext4', 's-accent', 'accent', '<span class="t">ext4</span>, the fourth extended file system, is the default on Debian and Ubuntu. It keeps a journal so a crash cannot leave its own records (its metadata) half-updated, and records each file\'s location as extents, runs of neighbouring blocks.', 'Under it: the page cache, then the block layer and the SSD or hard disk.'],
            xfs: ['XFS', 's-accent', 'accent', 'A journaling file system designed in the 1990s for very large files and many parallel writers. It is the default on Red Hat Enterprise Linux since version 7.', 'Under it: the page cache, then the block layer and the disk.'],
            btrfs: ['Btrfs', 's-accent', 'accent', 'A copy-on-write file system: changed data goes to new blocks, which makes cheap snapshots possible. It checksums data and metadata. It is the default on Fedora Workstation (since release 33) and openSUSE.', 'Under it: the page cache, then the block layer and one or more disks.'],
            vfat: ['vfat', 's-accent', 'accent', '<span class="t">vfat</span> is Linux\'s driver for FAT with long file names: USB sticks, SD cards, the boot partition of a UEFI PC. Nearly every device can read FAT. FAT has no inodes, owners or permission bits, so vfat invents them in memory.', 'Under it: the page cache, then the block layer and the USB driver.'],
            ntfs: ['ntfs3', 's-accent', 'accent', 'The NTFS format of Windows disks. Since Linux 5.15 (2021) the kernel\'s ntfs3 driver can read and write it.', 'Under it: the page cache, then the block layer and the disk.'],
            nfs: ['NFS', 's-accent', 'accent', 'The <span class="t">NFS (Network File System)</span> client. The files live on another computer, the server. Each read or write that the page cache cannot satisfy becomes a request sent over the network.', 'Under it: the page cache, then the network stack and the server.'],
            procfs: ['procfs', 's-accent', 'accent', '<span class="t">procfs</span> is a pseudo file system mounted at /proc. Read /proc/uptime and the kernel writes the text on the spot from its own counters. Nothing is stored anywhere, yet to the VFS it is one more file system.', 'Under it: no cache and no device, only the kernel\'s own data.'],
            cache: ['Page cache', 's-mem', 'mem', 'Copies of file data kept in main memory, page by page (section 11.9). The disk-based file systems and NFS read and write through it, so reading the same data a second time needs no device at all.', 'Under it: the block layer, or the network for NFS.'],
            block: ['Block layer and drivers', 's-io', 'io', 'Queues block requests, merges neighbours, schedules them (the disk schedulers of chapter 11) and hands them to the driver of the SSD, hard disk or USB stick.', 'Under it: the devices themselves.'],
            net: ['Network stack', 's-io', 'io', 'For NFS, requests travel as remote procedure calls over TCP/IP and the network card\'s driver to the server, which does its own disk I/O and replies.', 'Under it: the network and the server.'],
            kdata: ['Kernel\'s own data', 's-mem', 'mem', 'procfs builds its files from the kernel\'s variables and lists (process tables, counters, settings). No cache and no device are involved.', 'Nothing under it.'],
          };
          const FS = ['ext4', 'xfs', 'btrfs', 'vfat', 'ntfs', 'nfs', 'procfs'];
          const FSL = { ext4: ['ext4', 'SSD, disk'], xfs: ['XFS', 'big disks'], btrfs: ['Btrfs', 'snapshots'], vfat: ['vfat', 'USB stick'], ntfs: ['ntfs3', 'Windows'], nfs: ['NFS', 'network'], procfs: ['procfs', 'no device'] };
          const W = {};
          if (slim) {
            Object.assign(W, { vb: '0 0 360 350', line: 46, lineX: 356, proc: [6, 2, 348, 36], vfs: [6, 64, 348, 40], cache: [6, 226, 260, 32], kdata: [274, 226, 80, 120], block: [6, 270, 170, 32], net: [184, 270, 82, 32], dev: [6, 314, 170, 32], srv: [184, 314, 82, 32] });
            FS.forEach((f, i) => { W[f] = i < 4 ? [6 + i * 89, 118, 81, 42] : [6 + (f === 'procfs' ? 3 : i - 4) * 89, 166, 81, 42]; });
          } else {
            Object.assign(W, { vb: '0 0 620 302', line: 46, lineX: 616, proc: [10, 2, 600, 36], vfs: [10, 64, 600, 38], cache: [10, 180, 513, 30], kdata: [532, 180, 78, 118], block: [10, 226, 426, 28], net: [445, 226, 78, 28], dev: [10, 270, 426, 28], srv: [445, 270, 78, 28] });
            FS.forEach((f, i) => { W[f] = [10 + i * 87, 120, 78, 40]; });
          }
          const svg = s('svg', { viewBox: W.vb, width: '100%', role: 'img', 'aria-label': 'Processes call the VFS, which calls one of several file systems, which use the page cache and devices' });
          ctx.$('.vfs-map').append(svg);
          const detail = ctx.$('.vfs-detail');
          let sel = 'vfs';
          const mid = (r) => r[0] + r[2] / 2, bot = (r) => r[1] + r[3];
          function draw() {
            const k = [];
            k.push(s('line', { x1: 4, y1: W.line, x2: W.lineX, y2: W.line, class: 's-muted', 'stroke-dasharray': '6 5' }));
            k.push(s('text', { x: W.lineX, y: W.line + 14, 'text-anchor': 'end', 'font-size': 13, class: 's-sub' }, 'user ↑  kernel ↓'));
            k.push(arrow(s, mid(W.proc) - 60, bot(W.proc), mid(W.proc) - 60, W.vfs[1] - 2));
            if (!slim) {
              FS.forEach((f) => {
                k.push(arrow(s, mid(W[f]), bot(W.vfs), mid(W[f]), W[f][1] - 2));
                k.push(arrow(s, mid(W[f]), bot(W[f]), mid(W[f]), (f === 'procfs' ? W.kdata[1] : W.cache[1]) - 2));
              });
            } else {
              k.push(arrow(s, 132, bot(W.vfs), 132, W.ext4[1] - 2));
              k.push(arrow(s, 132, bot(W.nfs), 132, W.cache[1] - 2));
              k.push(arrow(s, mid(W.procfs), bot(W.procfs), mid(W.procfs), W.kdata[1] - 2));
            }
            k.push(arrow(s, mid(W.block), bot(W.cache), mid(W.block), W.block[1] - 2));
            k.push(arrow(s, mid(W.net), bot(W.cache), mid(W.net), W.net[1] - 2));
            k.push(arrow(s, mid(W.block), bot(W.block), mid(W.block), W.dev[1] - 2));
            k.push(arrow(s, mid(W.net), bot(W.net), mid(W.net), W.srv[1] - 2));
            const fs = 13.5;
            const lab = {
              proc: slim ? ['Processes', 'open, read, write, close…'] : ['Processes', 'open, read, write, close, mkdir, rename…'],
              vfs: slim ? ['Virtual file system (VFS)', 'one common file model'] : ['Virtual file system (VFS)', 'one common file model: superblock, inode, dentry, file'],
              cache: ['Page cache', 'file data in RAM'], kdata: slim ? ['Kernel', 'data'] : ['Kernel\'s', 'own data'],
              block: [slim ? 'Block layer + drivers' : 'Block layer + disk and USB drivers'], net: ['Network'],
            };
            ['proc', 'vfs', 'cache', 'kdata', 'block', 'net'].forEach((id) => {
              k.push(hot(s, parts[id][0], sel === id, () => pick(id), box(s, W[id], parts[id][1], lab[id], { fs, rx: 8 })));
            });
            FS.forEach((f) => k.push(hot(s, parts[f][0], sel === f, () => pick(f), box(s, W[f], 's-accent', FSL[f], { fs, rx: 8 }))));
            k.push(box(s, W.dev, 's-io', [slim ? 'SSD · disk · USB' : 'SSD · hard disk · USB stick'], { fs, dash: '5 4', rx: 8 }));
            k.push(box(s, W.srv, 's-io', ['Server'], { fs, dash: '5 4', rx: 8 }));
            svg.replaceChildren(...k);
          }
          function pick(id) { sel = id; draw(); show(); }
          function show() {
            const p = parts[sel];
            detail.innerHTML = '';
            detail.append(
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', { style: { fontSize: '18px' } }, p[0]),
                h('span', { class: 'chip ' + p[2] }, p[2] === 'proc' ? 'user mode' : FS.includes(sel) ? 'file system' : 'kernel')),
              h('p', { class: 'small m0', html: p[3] }),
              h('p', { class: 'xs muted m0' }, p[4]));
            ctx.refit();
          }
          draw(); show();
        },
      },

      /* ---------------- 2. Follow one read() through the VFS ---------------- */
      {
        title: 'Follow one read() through the VFS',
        kind: 'explore',
        core: true,
        render(el, ctx) {
          const { h, s } = ctx;
          const slim = ctx.narrow;
          const X = slim ? 10 : 10, Wd = slim ? 340 : 500;
          const Y = { proc: [4, 32], sys: [44, 26], vfs: [78, 38], fs: [132, 36], cache: [178, 30], map: [218, 36], drv: [264, 30], dev: [304, 28] };
          const R = (id) => [X, Y[id][0], Wd, Y[id][1]];
          const ORDER = ['proc', 'sys', 'vfs', 'fs', 'cache', 'map', 'drv', 'dev'];
          const UPTIME = '35212.47 140321.86\n';
          const FSX = {
            ext4: { label: 'ext4 on an SSD', file: '/home/ana/report.pdf', fs: ['ext4_file_read_iter()', 'ext4\'s own read function'], map: ['ext4: look in the extent tree', 'file block 0 → disk block 81,920'], drv: ['Block layer → NVMe driver'], dev: ['SSD'],
              t: ['ext4_file_read_iter', 'extent tree lookup', 'block layer, NVMe driver', 'SSD'] },
            vfat: { label: 'vfat on a USB stick', file: '/media/usb/photo.jpg', fs: ['generic_file_read_iter()', 'a shared helper that vfat borrows'], map: ['vfat: find the cluster', 'first cluster 1,203 (from the directory entry)'], drv: ['Block layer → USB storage driver'], dev: ['USB stick'],
              t: ['generic_file_read_iter', 'directory entry, FAT chain', 'block layer, USB storage driver', 'USB stick'] },
            nfs: { label: 'NFS share', file: '/mnt/share/data.csv', fs: ['nfs_file_read()', 'the NFS client\'s read function'], map: ['NFS: build a READ request', 'file handle, offset 0, 4,096 bytes'], drv: ['RPC + TCP/IP → network card driver'], dev: ['NFS server (its own disk)'],
              t: ['nfs_file_read', 'a READ request to the server', 'RPC, TCP/IP, network driver', 'the server'] },
            proc: { label: 'procfs', file: '/proc/uptime', fs: ['procfs\'s read function', 'hands the job to a text-printing helper'], map: ['uptime_proc_show()', 'prints two counters as text'], drv: null, dev: null,
              t: ['procfs\'s read function', 'printing kernel counters', 'none', 'none'] },
          };
          const n = (k) => (k === 'proc' ? UPTIME.length : 4096);
          const nf = (v) => v.toLocaleString('en-US');
          function frames(k) {
            const F = FSX[k], N = n(k);
            const head = [
              { on: ['proc'], a: [], cap: `A process calls <b>read(3, buf, 4096)</b>: “give me up to 4,096 bytes of the file I opened as descriptor 3”. Descriptor 3 is <b>${F.file}</b>, but the call does not say so, or name a file system.` },
              { on: ['proc', 'sys', 'vfs'], a: [['proc', 'sys'], ['sys', 'vfs']], cap: 'The call traps into the kernel and reaches the VFS. The VFS looks up descriptor 3 in the process\'s table of open files and finds its <b>file object</b>: opened for reading, current offset 0.' },
              { on: ['vfs', 'fs'], a: [['vfs', 'fs']], cap: `The VFS calls <b>file-&gt;f_op-&gt;read_iter</b>, the read slot of the table this file object points to. For this file the slot holds <b>${F.fs[0].replace('()', '')}</b>. Whatever function the file system put in that slot is what runs now.` },
            ];
            const done = { on: ['cache', 'vfs', 'proc'], a: [['cache', 'vfs'], ['vfs', 'proc']], cache: 'hit', cap: `${nf(N)} bytes are copied from the page into buf, the file object's offset moves from 0 to ${nf(N)}, and read returns ${nf(N)}. Read these bytes again soon and the page cache answers at once: no device at all.` };
            if (k === 'proc') return head.concat([
              { on: ['fs', 'cache'], a: [], cache: 'off', cap: 'No page cache here. Nothing on any device needs caching, and the answer changes every moment, so a cached copy would be wrong a second later.' },
              { on: ['fs', 'map'], a: [['fs', 'map']], cap: 'procfs calls <b>uptime_proc_show</b>, a small kernel function that prints two numbers into a buffer: seconds since boot, and idle seconds added up over all processors.' },
              { on: ['map', 'drv', 'dev'], a: [], cap: 'No block layer, no driver, no device. This “file” did not exist anywhere until this instant: the kernel made its contents up from its own counters.' },
              { on: ['map', 'vfs', 'proc'], a: [['map', 'vfs'], ['vfs', 'proc']], cap: `The ${N} bytes of text <code>${UPTIME.trim()}\\n</code> are copied into buf, the offset moves from 0 to ${N}, and read returns ${N}. The program saw an ordinary file.` },
            ]);
            const mid = {
              ext4: [
                { on: ['fs', 'cache'], a: [['fs', 'cache']], cache: 'miss', cap: 'ext4 has no special case here (no direct I/O that skips the cache, no persistent memory), so it hands the read to the kernel\'s shared page-cache reader, which looks for the page holding bytes 0 to 4,095: <b>a miss</b>.' },
                { on: ['cache', 'map'], a: [['cache', 'map']], cache: 'miss', cap: 'To fill the page, the page cache calls back into ext4 (through yet another table of ext4 functions). ext4 looks up file block 0 in the file\'s <b>extent tree</b>: it is disk block 81,920.' },
                { on: ['map', 'drv', 'dev'], a: [['map', 'drv'], ['drv', 'dev']], cache: 'miss', cap: 'ext4 sends a request for that block to the block layer, which queues it for the NVMe driver. The SSD copies the block into the page by DMA. The process sleeps.' },
              ],
              vfat: [
                { on: ['fs', 'cache'], a: [['fs', 'cache']], cache: 'miss', cap: 'vfat has no read function of its own: its slot points at the kernel\'s shared page-cache reader. The reader looks for the page holding bytes 0 to 4,095: <b>a miss</b>.' },
                { on: ['cache', 'map'], a: [['cache', 'map']], cache: 'miss', cap: 'Now vfat\'s own code is needed. The page cache calls back into vfat, which takes the file\'s first cluster from its directory entry: cluster 1,203. (Later parts of the file would be found by following the cluster chain in the FAT.)' },
                { on: ['map', 'drv', 'dev'], a: [['map', 'drv'], ['drv', 'dev']], cache: 'miss', cap: 'vfat asks the block layer for the sectors of that cluster. The request goes to the USB storage driver and out to the stick. The process sleeps.' },
              ],
              nfs: [
                { on: ['fs', 'cache'], a: [['fs', 'cache']], cache: 'miss', cap: 'Another computer may have changed the file. So nfs_file_read first checks that its cached pages are still valid (asking the server for the file\'s attributes if its copy of them is old), then looks in the page cache: <b>a miss</b>.' },
                { on: ['cache', 'map'], a: [['cache', 'map']], cache: 'miss', cap: 'To fill the page, the NFS client looks for no disk blocks at all. It builds a <b>READ request</b> naming the file by its NFS file handle: offset 0, 4,096 bytes.' },
                { on: ['map', 'drv', 'dev'], a: [['map', 'drv'], ['drv', 'dev']], cache: 'miss', cap: 'The request travels through the remote procedure call layer, TCP/IP and the network card\'s driver to the server, which reads its own disk and replies. The process sleeps.' },
              ],
            }[k];
            const back = { on: ['dev', 'drv', 'cache'], a: [['dev', 'drv'], ['drv', 'cache']], cache: 'filled', cap: k === 'nfs' ? 'The reply arrives. The network stack hands the data to the NFS client, which fills the page and marks it up to date. The process wakes.' : 'The device signals completion with an interrupt. The page now holds the data and is marked up to date, and the process wakes.' };
            return head.concat(mid, [back, done]);
          }
          let fsk = 'ext4';
          const svg = s('svg', { viewBox: `0 0 ${slim ? 360 : 620} 336`, width: '100%', role: 'img', 'aria-label': 'Layers a read call passes through' });
          function label(id, fr) {
            const F = FSX[fsk];
            if (id === 'proc') return ['Process: read(3, buf, 4096)'];
            if (id === 'sys') return ['System call interface'];
            if (id === 'vfs') return ['VFS', 'fd 3 → file object → f_op->read_iter'];
            if (id === 'fs') return F.fs;
            if (id === 'cache') return fr.cache === 'off' || fsk === 'proc' ? ['Page cache', 'not used for /proc files'] : ['Page cache', { miss: 'page for bytes 0–4,095: MISS', filled: 'page now present, up to date', hit: 'page present' }[fr.cache] || 'pages of file data in RAM'];
            if (id === 'map') return F.map;
            if (id === 'drv') return F.drv || ['Driver', 'none'];
            return F.dev || ['Device', 'none'];
          }
          function draw(fr) {
            const k = [];
            if (!slim) {
              k.push(path(s, [[516, 6], [522, 6], [522, 114], [516, 114]], 's-line', null));
              k.push(path(s, [[516, 134], [522, 134], [522, 330], [516, 330]], 's-line', null));
              [['same for', 'every file', 'system'], ['changes', 'with the', 'file system']].forEach((t, i) => t.forEach((w, j) => k.push(s('text', { x: 530, y: (i ? 214 : 44) + j * 17, 'font-size': 13, 'font-weight': 700, class: i ? null : 's-sub' }, w))));
            }
            k.push(s('line', { x1: 4, y1: 124, x2: slim ? 356 : 512, y2: 124, class: 's-muted', 'stroke-dasharray': '6 5' }));
            ORDER.forEach((id) => {
              const unused = fsk === 'proc' && ['cache', 'drv', 'dev'].includes(id);
              const cls = { proc: 's-proc', sys: 's-os', vfs: 's-os', fs: 's-accent', cache: fr.cache === 'miss' ? 's-warn' : 's-mem', map: 's-accent', drv: 's-io', dev: 's-io' }[id];
              const on = fr.on.includes(id);
              const g = box(s, R(id), unused ? 's-panel' : cls, label(id, fr), { fs: 13.5, fs2: 13, sw: on ? 3.5 : 1.5, rx: 8, dash: unused ? '5 4' : null });
              g.setAttribute('opacity', on ? 1 : 0.36);
              k.push(g);
            });
            fr.a.forEach(([a, b]) => {
              const A = R(a), B = R(b), down = B[1] > A[1];
              const x = down ? X + 30 : X + Wd - 30;
              k.push(arrow(s, x, down ? A[1] + A[3] : A[1], x, down ? B[1] - 3 : B[1] + B[3] + 3, 's-accent', 'arr-accent', { sw: 3 }));
            });
            svg.replaceChildren(...k);
          }
          const tb = h('table', { class: 'tbl compact' });
          function table() {
            const T = FSX[fsk].t;
            tb.innerHTML = '';
            [['f_op->read_iter is', T[0], true], ['Finds the data by', T[1]], ['Layers below', T[2]], ['Device', T[3]]].forEach(([a, b, mono]) => tb.append(h('tr', {}, h('td', { class: 'b' }, a), h('td', { class: mono ? 'mono' : '' }, b))));
          }
          const player = ctx.ui.player({ count: frames(fsk).length, interval: 2600, render: (i) => { const fr = frames(fsk)[i]; draw(fr); return fr.cap; } });
          const seg = ctx.ui.seg(Object.keys(FSX).map((k) => ({ value: k, label: k === 'proc' ? 'procfs' : k === 'nfs' ? 'NFS' : k })), fsk, (v) => { fsk = v; table(); player.setCount(frames(v).length); player.reset(); });
          table();
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack', style: { gap: '10px' } },
              h('p', { class: 'lead m0', html: 'Pick where descriptor 3 lives, then step through one <code>read()</code>. Lit layers are working in that moment; the coloured arrows show where the request or the data travels.' }),
              seg,
              tb,
              h('div', { class: 'callout why m0', 'data-label': 'Why it matters', html: 'Switch file systems and replay: the top three layers never change. Only what sits behind the <code>f_op</code> pointer differs.' }),
              h('div', { class: 'callout warn m0', 'data-label': 'Common mistake', html: '“Each file system has its own read system call.” No: there is one <code>read()</code>. The VFS picks which file system function runs.' })),
            h('div', { class: 'stack', style: { gap: '8px' } }, h('div', { class: 'card white grow', style: { display: 'grid', placeItems: 'center', padding: '8px' } }, svg), player.el)));
        },
      },

      /* ---------------- 3. Objects in C: data plus a table of function pointers ---------------- */
      {
        title: 'Objects in C: data plus a table of functions',
        kind: 'learn',
        render(el, ctx) {
          const { h, s } = ctx;
          const slim = ctx.narrow;
          const OPS = ['open', 'read_iter', 'llseek', 'lock', 'fsync'];
          // three real file_operations tables (only these five of about 30 slots shown); null = slot left empty
          const TBL = {
            ext4: { name: 'ext4', table: 'ext4_file_operations', open: 'ext4_file_open', read_iter: 'ext4_file_read_iter', llseek: 'ext4_llseek', lock: null, fsync: 'ext4_sync_file' },
            vfat: { name: 'vfat', table: 'fat_file_operations', open: null, read_iter: 'generic_file_read_iter', llseek: 'generic_file_llseek', lock: null, fsync: 'fat_file_fsync' },
            nfs: { name: 'NFS', table: 'nfs_file_operations', open: 'nfs_file_open', read_iter: 'nfs_file_read', llseek: 'nfs_file_llseek', lock: 'nfs_lock', fsync: 'nfs_file_fsync' },
          };
          const WHY = {
            ext4: {
              open: 'ext4_file_open checks things only ext4 has, such as encryption keys and disk quotas, before the open completes.',
              read_iter: 'ext4_file_read_iter handles special cases such as direct I/O (which skips the page cache); otherwise it passes the read to the kernel\'s shared page-cache reader.',
              llseek: 'ext4_llseek moves the offset. It also understands SEEK_DATA and SEEK_HOLE, which jump over the unwritten gaps of a sparse file.',
              lock: 'The slot is <b>NULL</b>, so the VFS uses its generic POSIX lock code, which keeps locks in this machine\'s memory. That is enough: every process using this disk runs on this one machine.',
              fsync: 'ext4_sync_file writes the file\'s dirty pages to the disk and commits ext4\'s journal, so the data survives a crash.',
            },
            vfat: {
              open: 'The slot is <b>NULL</b>: FAT needs no extra work at open time, so the VFS skips this call and the open simply succeeds.',
              read_iter: 'vfat put <b>generic_file_read_iter</b>, a reader shared by many file systems, in this slot. vfat\'s own code runs later, only if a missing page must be found on the stick.',
              llseek: 'generic_file_llseek, another shared helper. Moving the offset only changes a number in the file object; no device is touched.',
              lock: 'The slot is <b>NULL</b>, so the VFS falls back to its generic POSIX locks, held in this machine\'s memory.',
              fsync: 'fat_file_fsync writes the file\'s data and then FAT\'s own records (the FAT and the directory entry) to the stick.',
            },
            nfs: {
              open: 'nfs_file_open records who opened the file and with which credentials, so later requests to the server are made on that user\'s behalf.',
              read_iter: 'nfs_file_read checks that its cached pages are still valid (another machine may have changed the file), then reads through the page cache.',
              llseek: 'nfs_file_llseek: for a seek relative to the end it first refreshes the file size from the server, because another client may have made the file longer.',
              lock: 'nfs_lock sends the lock request to the server. Processes on <b>other machines</b> use this file too, so a lock kept only in local memory would protect nothing.',
              fsync: 'nfs_file_fsync sends the file\'s dirty pages to the server and asks it to commit them to its own stable storage.',
            },
          };
          const FALL = { open: ['ret = 0;', 'nothing extra: open succeeds'], read_iter: ['ret = -EINVAL;', 'no way to read: error'], llseek: ['ret = -ESPIPE;', 'cannot seek: error'], lock: ['ret = posix_lock_file(...);', 'local POSIX locks'], fsync: ['ret = -EINVAL;', 'cannot sync: error'] };
          let fk = 'ext4', op = 'read_iter';
          const narr = h('div', { class: 'narr' });
          const svg = s('svg', { viewBox: slim ? '0 0 360 456' : '0 0 620 330', width: '100%', role: 'img', 'aria-label': 'A file object points to its operations table, whose slot points to a function' });
          let codeBox = null, codePanel = null;
          function draw() {
            const T = TBL[fk], fn = T[op], k = [];
            const G = slim
              ? { fo: [6, 6, 348, 70], tb: [6, 100, 320, 252], fx: [6, 378, 348, 72], rowY: 136, rowH: 38 }
              : { fo: [10, 60, 168, 132], tb: [204, 8, 214, 316], fx: [440, 0, 172, 74], rowY: 50, rowH: 50 };
            k.push(obj(s, G.fo, 's-panel', 'file object', slim ? ['f_pos = 0 · f_mode = read', 'f_op = ●'] : ['f_pos = 0', 'f_mode = read', 'f_path → dentry', 'f_op = ●'], { fs: 13.5 }));
            const fy = slim ? G.fo[1] + 13.5 + 9 + 2 * 17.5 - 5 : G.fo[1] + 13.5 + 9 + 4 * 17.5 - 5;
            const fx0 = slim ? 76 : 84;
            k.push(s('rect', { x: G.tb[0], y: G.tb[1], width: G.tb[2], height: G.tb[3], rx: 10, class: 's-os', 'stroke-width': 2 }));
            k.push(s('text', { x: G.tb[0] + 10, y: G.tb[1] + 22, 'font-size': 13.5, 'font-weight': 800, 'font-family': 'var(--mono)' }, T.table));
            if (slim) k.push(path(s, [[fx0, fy + 4], [fx0, G.tb[1] - 3]], 's-accent', 'arr-accent', { sw: 3 }));
            else k.push(path(s, [[fx0 + 8, fy - 4], [190, fy - 4], [190, G.tb[1] + 17], [G.tb[0] - 3, G.tb[1] + 17]], 's-accent', 'arr-accent', { sw: 3 }));
            let selY = 0;
            OPS.forEach((o, i) => {
              const y = G.rowY + i * G.rowH, v = T[o], on = o === op;
              if (on) selY = y;
              k.push(s('rect', { x: G.tb[0] + 6, y, width: G.tb[2] - 12, height: G.rowH - 6, rx: 7, class: on ? (v ? 's-ok' : 's-warn') : 's-panel', 'stroke-width': on ? 2.5 : 1 }));
              if (slim) {
                k.push(s('text', { x: G.tb[0] + 14, y: y + 21, 'font-size': 13.5, 'font-weight': 800, 'font-family': 'var(--mono)' }, '.' + o));
                k.push(s('text', { x: G.tb[0] + G.tb[2] - 14, y: y + 21, 'text-anchor': 'end', 'font-size': 13.5, 'font-family': 'var(--mono)', class: v ? null : 's-sub' }, v || 'NULL (empty)'));
              } else {
                k.push(s('text', { x: G.tb[0] + 14, y: y + 17, 'font-size': 13.5, 'font-weight': 800, 'font-family': 'var(--mono)' }, '.' + o));
                k.push(s('text', { x: G.tb[0] + 14, y: y + 35, 'font-size': 13, 'font-family': 'var(--mono)', class: v ? null : 's-sub' }, v || 'NULL (empty slot)'));
              }
            });
            k.push(s('text', { x: G.tb[0] + 14, y: G.rowY + 5 * G.rowH + (slim ? 14 : 18), 'font-size': 13, class: 's-sub' }, '… about 30 slots in all'));
            const fb = slim ? G.fx : [G.fx[0], Math.min(Math.max(selY - 18, 8), 330 - 80), G.fx[2], G.fx[3]];
            const lines = fn ? [fn, fn.startsWith('generic_') ? 'shared kernel helper' : T.name + '\'s own code'] : ['VFS default', FALL[op][1]];
            const cls = fn ? 's-ok' : 's-warn';
            k.push(s('rect', { x: fb[0], y: fb[1], width: fb[2], height: fb[3], rx: 10, class: cls, 'stroke-width': 2, 'stroke-dasharray': fn ? null : '5 4' }));
            k.push(s('text', { x: fb[0] + fb[2] / 2, y: fb[1] + 30, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 800, 'font-family': fn ? 'var(--mono)' : null }, lines[0]));
            k.push(s('text', { x: fb[0] + fb[2] / 2, y: fb[1] + 52, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, lines[1]));
            if (slim) k.push(path(s, [[G.tb[0] + G.tb[2] - 6, selY + (G.rowH - 6) / 2], [342, selY + (G.rowH - 6) / 2], [342, fb[1] - 3]], fn ? 's-ok' : 's-warn', fn ? 'arr-ok' : 'arr-warn', { sw: 3, dash: fn ? null : '5 4' }));
            else k.push(path(s, [[G.tb[0] + G.tb[2] - 6, selY + (G.rowH - 6) / 2], [fb[0] - 3, fb[1] + fb[3] / 2]], fn ? 's-ok' : 's-warn', fn ? 'arr-ok' : 'arr-warn', { sw: 3, dash: fn ? null : '5 4' }));
            svg.replaceChildren(...k);
            narr.className = 'narr' + (fn ? ' ok' : ' warn');
            narr.innerHTML = `<b>${T.name} · .${op}</b><br>` + WHY[fk][op];
            if (codePanel) showCode();
          }
          function listing() {
            const T = TBL[fk], L = [];
            const add = (c, m) => L.push(c.padEnd(31) + ' /* ' + m + ' */');
            add('struct file_operations {', 'the table type');
            add('  int     (*open)(...);', 'extra work at open');
            add('  ssize_t (*read_iter)(...);', 'read; newer form of .read');
            add('  loff_t  (*llseek)(...);', 'move the offset');
            add('  int     (*lock)(...);', 'lock a byte range');
            add('  int     (*fsync)(...);', 'force data to storage');
            add('  /* ...about 30 slots */', '(...): arguments left out');
            add('};', 'end of the table type');
            add('const struct file_operations', T.name + '\'s filled-in copy');
            add(T.table + ' = {', 'its name in the kernel');
            OPS.forEach((o) => { if (T[o]) add('  .' + o + ' = ' + T[o] + ',', T[o].startsWith('generic_') ? 'shared helper' : 'its own function'); });
            add('};', 'slots not named stay NULL');
            add('/* inside the VFS (simplified) */', 'run for every file system');
            add('if (file->f_op->' + op + ')', 'is the slot filled in?');
            add('  ret = file->f_op->' + op + '(...);', 'yes: call it');
            add('else', 'no, the slot is NULL:');
            add('  ' + FALL[op][0], FALL[op][1]);
            const n = L.length, slot = OPS.indexOf(op) + 2;
            const row = L.findIndex((x) => x.startsWith('  .' + op + ' ')) + 1;
            return { src: L.join('\n'), hot: T[op] ? [slot, row, n - 3, n - 2] : [slot, n - 3, n - 1, n] };
          }
          function showCode() {
            const { src, hot } = listing();
            codePanel.innerHTML = '';
            codeBox = ctx.ui.code(src, { lang: 'c', nums: true, fontSize: slim ? 12.5 : 13 });
            codePanel.append(codeBox, h('p', { class: 'xs muted m0', style: { marginTop: '6px' } }, 'Highlighted: the slot you picked, how ' + TBL[fk].name + ' fills it, and the VFS lines that use it.'));
            codeBox.mark(hot, 'cur');
          }
          const tabs = ctx.ui.tabs([
            { label: 'Follow the pointers', render: (p) => { p.append(h('div', { style: { display: 'grid', placeItems: 'center', height: '100%' } }, svg)); } },
            // the tabs share one panel: forget it on leaving, or a later seg click would draw code over another tab
            { label: 'The C code', render: (p) => { codePanel = p; showCode(); return () => { codePanel = null; }; } },
            { label: 'Plugging in a new one', html: `
              <ol class="small" style="margin:0;padding-left:22px;display:flex;flex-direction:column;gap:7px">
                <li>The new file system's module calls <code>register_filesystem()</code> with a small struct that gives its type name (say "vfat") and its mount routine. It now appears in <code>/proc/filesystems</code>.</li>
                <li><b>mount</b>: the VFS calls that routine. It reads the on-disk superblock (NFS asks the server instead), fills in a <span class="t">superblock object</span>, and sets its <code>s_op</code> table and its root dentry.</li>
                <li><b>lookup</b>: each time a file of this file system is first needed, the file system builds an <span class="t">inode object</span> and points its <code>i_op</code> and <code>i_fop</code> at its own tables.</li>
                <li><b>open</b>: the VFS creates a file object and copies the inode's <code>i_fop</code> into the file's <code>f_op</code>. From then on every read and write on it goes through that table.</li>
              </ol>
              <div class="callout why m0" data-label="Why tables?" style="margin-top:10px">The alternative is a big <code>switch</code> on the file system type inside the VFS, edited every time a file system is added. With tables, the VFS never names a file system: adding one changes no line of the VFS and no program.</div>` },
          ]);
          const segF = ctx.ui.seg([{ value: 'ext4', label: 'ext4' }, { value: 'vfat', label: 'vfat' }, { value: 'nfs', label: 'NFS' }], fk, (v) => { fk = v; draw(); });
          const segO = ctx.ui.seg(OPS.map((o) => ({ value: o, label: o })), op, (v) => { op = v; draw(); });
          draw();
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack', style: { gap: '10px' } },
              h('p', { class: 'lead m0', html: 'C has no classes, so the VFS builds its objects by hand: a struct holds the data, plus a pointer to a table of <span class="t">function pointer</span>s that work on it.' }),
              h('p', { class: 'small m0', html: 'Each <span class="t">operations table</span> has one slot per job, and every file system fills in its own copy. The VFS follows the object\'s pointer to the table and calls whatever sits in the slot: the <span class="t">mapping function</span> idea in real code.' }),
              h('div', { class: 'stack', style: { gap: '6px', flexShrink: 0 } }, h('span', { class: 'xs muted' }, 'The file lives on'), segF, h('span', { class: 'xs muted' }, 'The VFS needs'), segO),
              narr,
              h('div', { class: 'callout warn m0', 'data-label': 'Common mistake', html: '“A NULL slot is a bug.” No: it means “use the VFS default” or “not supported here”.' })),
            tabs));
        },
      },

      /* ---------------- 4. Meet the four objects behind one open file ---------------- */
      {
        title: 'Meet the four objects behind one open file',
        kind: 'explore',
        core: true,
        render(el, ctx) {
          const { h, s } = ctx;
          const slim = ctx.narrow;
          let pk = 'ext4', sel = 'file', view = 'fields';
          const KIND = {
            file: ['VFS file object', '', 's-panel', 'struct file'],
            dentry: ['Dentry object', 'accent', 's-accent', 'struct dentry'],
            inode: ['Inode object', 'mem', 's-mem', 'struct inode'],
            sb: ['Superblock object', 'io', 's-io', 'struct super_block'],
          };
          const OPN = { file: 'f_op', dentry: 'd_op', inode: 'i_op', sb: 's_op' };
          const OPT = { file: 'file_operations', dentry: 'dentry_operations', inode: 'inode_operations', sb: 'super_operations' };
          const G = slim
            ? { vb: '0 0 360 492', p1: [6, 6, 160, 68], par: [196, 6, 158, 68], file: [6, 90, 160, 88], dentry: [6, 206, 160, 66], inode: [6, 300, 160, 88], sb: [6, 416, 160, 70], opx: 196, opw: 158 }
            : { vb: '0 0 664 330', p1: [6, 158, 96, 66], file: [124, 148, 120, 86], dentry: [266, 158, 120, 66], inode: [408, 148, 116, 86], sb: [546, 148, 112, 86], opy: 266, oph: 52 };
          const svg = s('svg', { viewBox: G.vb, width: '100%', role: 'img', 'aria-label': 'Process P1, its file object, the dentry, the inode and the superblock, with their operations tables' });
          const detail = h('div', { class: 'card white stack fill', style: { gap: '7px', padding: '12px 14px' } });
          const lbl = (id) => {
            const P = OBJS[pk];
            return { file: ['file object', 'f_pos 0', 'f_path ●', 'f_op ●'], dentry: ['dentry', P.name, 'd_inode ●'], inode: ['inode', 'ino ' + P.ino, P.size, 'i_sb ●'], sb: ['superblock', P.fsn, P.dev] }[id];
          };
          function draw() {
            const P = OBJS[pk], k = [];
            const mid = (r) => [r[0] + r[2] / 2, r[1] + r[3] / 2];
            k.push(obj(s, G.p1, 's-proc', 'Process P1', ['fd table', 'fd 3 ●'], { fs: 13.5 }));
            ['file', 'dentry', 'inode', 'sb'].forEach((id) => {
              const L = lbl(id);
              k.push(hot(s, KIND[id][0], sel === id, () => { sel = id; draw(); show(); }, obj(s, G[id], KIND[id][2], L[0], L.slice(1), { fs: 13.5, sub: false })));
              const r = G[id];
              const orr = slim ? [G.opx, r[1] + 8, G.opw, r[3] - 16] : [r[0] - 4, G.opy, r[2] + 8, G.oph];  // a little wider than the object, so the table type fits
              const has = id !== 'dentry' || pk === 'vfat';
              k.push(box(s, orr, has ? 's-os' : 's-panel', [OPN[id], has ? OPT[id] : 'none (NULL)'], { fs: 13.5, fs2: 13, dash: has ? null : '5 4', rx: 8 }));
              if (slim) k.push(arrow(s, r[0] + r[2], mid(r)[1], G.opx - 3, mid(r)[1], 's-muted', 'arr-muted', { dash: '4 4' }));
              else k.push(arrow(s, mid(r)[0], r[1] + r[3], mid(r)[0], G.opy - 3, 's-muted', 'arr-muted', { dash: '4 4' }));
            });
            if (slim) {
              k.push(arrow(s, 60, G.p1[1] + G.p1[3], 60, G.file[1] - 3));
              k.push(arrow(s, 60, G.file[1] + G.file[3], 60, G.dentry[1] - 3));
              k.push(arrow(s, 60, G.dentry[1] + G.dentry[3], 60, G.inode[1] - 3));
              k.push(arrow(s, 60, G.inode[1] + G.inode[3], 60, G.sb[1] - 3));
              k.push(box(s, G.par, 's-accent', ['d_parent chain', P.parents.join(' → ')], { fs: 13.5, fs2: 13, dash: '5 4', rx: 8 }));
            } else {
              // each pointer arrow leaves its box at the row of the field that holds it (row i sits at y + 22.5 + (i + 1) * 17.5)
              const rowY = (r, i) => r[1] + 22.5 + (i + 1) * 17.5 - 5;
              k.push(arrow(s, G.p1[0] + G.p1[2], rowY(G.p1, 1), G.file[0] - 3, rowY(G.p1, 1)));
              k.push(arrow(s, G.file[0] + G.file[2], rowY(G.file, 1), G.dentry[0] - 3, rowY(G.file, 1)));
              k.push(arrow(s, G.dentry[0] + G.dentry[2], rowY(G.dentry, 1), G.inode[0] - 3, rowY(G.dentry, 1)));
              k.push(arrow(s, G.inode[0] + G.inode[2], rowY(G.inode, 2), G.sb[0] - 3, rowY(G.inode, 2)));
              let py = G.dentry[1];
              P.parents.forEach((nm, i) => {
                const r = [G.dentry[0] + 10, py - 46, G.dentry[2] - 20, 28];
                const cx = r[0] + r[2] / 2;
                k.push(arrow(s, cx, py, cx, r[1] + r[3] + 3, 's-accent', 'arr-accent'));
                k.push(box(s, r, 's-accent', [nm], { fs: 13.5, rx: 8, dash: '5 4' }));
                if (i === 0) k.push(s('text', { x: cx + 7, y: py - 5, 'font-size': 13, class: 's-sub', 'font-family': 'var(--mono)' }, 'd_parent'));
                py = r[1];
              });
              const root = py, sx = mid(G.sb)[0];
              k.push(path(s, [[sx, G.sb[1]], [sx, root + 15], [G.dentry[0] + G.dentry[2] - 7, root + 15]], 's-io', 'arr-io'));
              k.push(s('text', { x: sx - 6, y: root + 9, 'text-anchor': 'end', 'font-size': 13, class: 's-sub', 'font-family': 'var(--mono)' }, 's_root'));
              if (pk === 'vfat') k.push(s('text', { x: G.dentry[0] + 6, y: root - 8, 'font-size': 13, class: 's-sub' }, 'mounted on /media/usb'));
            }
            svg.replaceChildren(...k);
          }
          function show() {
            const P = OBJS[pk], O = P[sel], K = KIND[sel];
            const vSeg = ctx.ui.seg([{ value: 'fields', label: 'Fields (data)' }, { value: 'ops', label: 'Operations (' + OPN[sel] + ')' }], view, (v) => { view = v; show(); });
            const tb = h('table', { class: 'tbl compact', style: { fontSize: '14px' } });
            if (view === 'fields') O.fields.forEach(([a, b]) => tb.append(h('tr', {}, h('td', { class: 'mono b', style: { whiteSpace: 'nowrap' } }, a), h('td', {}, b))));
            else {
              tb.append(h('tr', {}, h('td', { colspan: 2, class: 'mono b' }, O.table)));
              O.ops.forEach(([a, j, f]) => tb.append(h('tr', {}, h('td', { style: { whiteSpace: slim ? 'normal' : 'nowrap' } }, h('span', { class: 'mono b' }, a), h('span', { class: 'xs muted', style: slim ? { display: 'block' } : {} }, (slim ? '' : ' · ') + j)), h('td', { class: 'mono', style: { color: f ? null : 'var(--muted)', overflowWrap: 'anywhere' } }, f || 'NULL'))));
            }
            detail.replaceChildren(
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', { style: { fontSize: '18px' } }, K[0]), h('span', { class: 'chip ' + K[1] + ' mono' }, K[3])),
              h('p', { class: 'small m0', html: O.stand }), vSeg, tb,
              view === 'ops' ? h('p', { class: 'xs muted m0' }, O.more) : null);
            ctx.refit();
          }
          const seg = ctx.ui.seg([{ value: 'ext4', label: '/home/ana/notes.txt (ext4)' }, { value: 'vfat', label: '/media/usb/photo.jpg (vfat)' }], pk, (v) => { pk = v; draw(); show(); });
          draw(); show();
          el.append(h('div', { class: 'split r fill' },
            h('div', { class: 'stack', style: { gap: '8px' } },
              h('p', { class: 'm0', html: 'P1 has opened a file. Four kinds of VFS object now stand behind descriptor 3: the <span class="t" data-t="VFS file object">file object</span>, the <span class="t">dentry object</span>, the <span class="t">inode object</span> and the <span class="t">superblock object</span>. Each holds data and points to its own <span class="t">operations table</span>. <b>Click an object.</b>' }),
              seg,
              h('div', { class: 'card white grow', style: { display: 'grid', placeItems: 'center', padding: '6px' } }, svg)),
            detail));
        },
      },

      /* ---------------- 5. Lab: who shares which object ---------------- */
      {
        title: 'Lab: who shares which object?',
        kind: 'lab',
        render(el, ctx) {
          const { h, s } = ctx;
          const slim = ctx.narrow;
          const SIZE = 2140;
          let st;
          function fresh() {
            return { child: false, p2: false, link: false, p2n: false, f: { 1: 0, 2: 0, 3: 0 } };
          }
          st = fresh();
          const G = slim
            ? { vb: '0 0 360 420', P1: [6, 6, 112, 60], C: [124, 6, 112, 60], P2: [242, 6, 112, 78], F1: [6, 122, 112, 74], F2: [124, 122, 112, 74], F3: [242, 122, 112, 74], D1: [40, 244, 130, 52], D2: [214, 244, 130, 52], I: [100, 336, 160, 78] }
            : { vb: '0 0 640 340', P1: [6, 18, 112, 60], C: [6, 126, 112, 60], P2: [6, 230, 112, 78], F1: [170, 28, 140, 74], F2: [170, 148, 140, 74], F3: [170, 256, 140, 74], D1: [362, 96, 118, 54], D2: [362, 236, 118, 54], I: [526, 124, 108, 96] };
          const svg = s('svg', { viewBox: G.vb, width: '100%', role: 'img', 'aria-label': 'Processes, their file objects, dentries and the shared inode' });
          const rowY = (r, i) => r[1] + 22.5 + (i + 1) * 17.5 - 5;
          function link(a, ya, b, cls = 's-line', mk = 'arr') {
            if (slim) return arrow(s, a[0] + a[2] / 2, a[1] + a[3], b[0] + b[2] / 2, b[1] - 3, cls, mk);
            return arrow(s, a[0] + a[2], ya, b[0] - 3, b[1] + b[3] / 2, cls, mk);
          }
          function draw() {
            const k = [], cnt1 = st.child ? 2 : 1;
            const nl = st.link ? 2 : 1;
            k.push(obj(s, G.P1, 's-proc', 'P1', ['fd 3 ●'], { fs: 13.5 }));
            if (st.child) k.push(obj(s, G.C, 's-proc', 'Child of P1', ['fd 3 ●'], { fs: 13.5 }));
            if (st.p2) k.push(obj(s, G.P2, 's-proc', 'P2', st.p2n ? ['fd 3 ●', 'fd 4 ●'] : ['fd 3 ●'], { fs: 13.5 }));
            const file = (n, on) => { if (on) k.push(obj(s, G['F' + n], 's-panel', 'file #' + n, ['f_pos = ' + st.f[n], 'f_ref = ' + (n === 1 ? cnt1 : 1)], { fs: 13.5, sub: false, sw: n === 1 && st.child ? 3.5 : 2 })); };
            file(1, true); file(2, st.p2); file(3, st.p2n);
            k.push(box(s, G.D1, 's-accent', ['dentry', 'notes.txt'], { fs: 13.5, rx: 8 }));
            if (st.link) k.push(box(s, G.D2, 's-accent', ['dentry', 'n2'], { fs: 13.5, rx: 8 }));
            k.push(obj(s, G.I, 's-mem', 'inode 1311', ['i_nlink = ' + nl, commas(SIZE) + ' B'], { fs: 13.5, sub: false, sw: st.link ? 3.5 : 2 }));
            k.push(link(G.P1, rowY(G.P1, 0), G.F1));
            if (st.child) k.push(link(G.C, rowY(G.C, 0), G.F1, 's-proc', 'arr-proc'));
            if (st.p2) k.push(link(G.P2, rowY(G.P2, 0), G.F2));
            if (st.p2n) k.push(slim ? link(G.P2, 0, G.F3) : link(G.P2, rowY(G.P2, 1), G.F3));
            k.push(link(G.F1, G.F1[1] + G.F1[3] / 2, G.D1));
            if (st.p2) k.push(link(G.F2, G.F2[1] + G.F2[3] / 2, G.D1));
            if (st.p2n) k.push(link(G.F3, G.F3[1] + G.F3[3] / 2, G.D2));
            k.push(link(G.D1, G.D1[1] + G.D1[3] / 2, G.I, 's-mem', 'arr-mem'));
            if (st.link) k.push(link(G.D2, G.D2[1] + G.D2[3] / 2, G.I, 's-mem', 'arr-mem'));
            svg.replaceChildren(...k);
            BTN.forEach((b) => { b.el.disabled = !b.ok(); });
          }
          const narr = h('div', { class: 'narr', html: 'P1 has opened <b>/home/ana/notes.txt</b> (2,140 bytes) as descriptor 3. Try the buttons in any order the rules allow, and watch which objects are created and which are shared.' });
          const say = (html, cls = '') => { narr.className = 'narr' + (cls ? ' ' + cls : ''); narr.innerHTML = html; };
          // rd(): read up to n bytes through file object f; returns [bytes read, old offset, new offset]
          const rd = (f, n) => { const o = st.f[f], got = Math.max(0, Math.min(n, SIZE - o)); st.f[f] = o + got; return [got, o, o + got]; };
          const BTN = [
            { t: 'P1: read(3, buf, 100)', ok: () => true, go: () => { const [g, o, nw] = rd(1, 100); say(`P1 read <b>${g}</b> bytes through file object #1: f_pos ${o} → <b>${nw}</b>.` + (st.child ? ' The child shares file #1, so its next read starts at ' + nw + ' too.' : '') + (g ? '' : ' (End of file: read returned 0.)')); } },
            { t: 'P2: open("notes.txt")', ok: () => !st.p2, go: () => { st.p2 = true; say('P2 (working in /home/ana) opened the same file. Its dentry <b>notes.txt</b> was cached, so the lookup was quick. But every open() makes a <b>new file object</b>: #2, with its own f_pos = 0. Two file objects, one dentry, one inode.'); } },
            { t: 'P1: fork()', ok: () => !st.child, go: () => { st.child = true; say(`fork() copied P1's descriptor table, so the child's fd 3 points to the <b>same</b> file object #1, just as dup() would. Its f_ref is now 2, and both processes share one offset (now ${st.f[1]}).`, 'warn'); } },
            { t: 'Child: read(3, buf, 50)', ok: () => st.child, go: () => { const [g, o, nw] = rd(1, 50); say(`The child read <b>${g}</b> bytes through file object #1: f_pos ${o} → <b>${nw}</b>. P1's next read will also start at ${nw}: they share the object.` + (st.p2 ? ` P2's file #2 is untouched (f_pos ${st.f[2]}).` : '')); } },
            { t: 'P2: read(3, buf, 30)', ok: () => st.p2, go: () => { const [g, o, nw] = rd(2, 30); say(`P2 read <b>${g}</b> bytes through its own file object #2: f_pos ${o} → <b>${nw}</b>. File #1 still says ${st.f[1]}: separate opens, separate offsets.`); } },
            { t: 'ln notes.txt n2', ok: () => !st.link, go: () => { st.link = true; say('ln added a second directory entry on disk, <b>n2</b>, holding the same inode number. i_nlink becomes <b>2</b>, and the VFS gives the new name its own dentry, pointing at the <b>same inode object</b>: two names, one file.', 'ok'); } },
            { t: 'P2: open("n2")', ok: () => st.link && st.p2 && !st.p2n, go: () => { st.p2n = true; say('P2 opened the file again by its other name. New file object #3 (f_pos 0) points to dentry <b>n2</b>, which points to inode 1311. Different name, different open, same data.'); } },
            { t: 'P2: read(4, buf, 20)', ok: () => st.p2n, go: () => { const [g, o, nw] = rd(3, 20); say(`P2 read <b>${g}</b> bytes through file object #3: f_pos ${o} → <b>${nw}</b>. Same inode as files #1 and #2, separate offset.`); } },
          ];
          BTN.forEach((b) => { b.el = h('button', { class: 'btn sm', style: { justifyContent: 'flex-start' }, onclick: () => { b.go(); draw(); } }, b.t); });
          const reset = h('button', { class: 'btn sm ghost', onclick: () => { st = fresh(); say('Back to the start: only P1 has the file open, at offset 0.'); draw(); } }, '↺ Reset');
          draw();
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack', style: { gap: '9px' } },
              h('p', { class: 'm0', html: 'Why four objects and not one? Because different things are shared at different levels. Open, fork and link, then read, and see which <span class="t" data-t="VFS file object">file object</span> each read moves.' }),
              h('div', { class: 'grid-2', style: { gap: '6px' } }, ...BTN.map((b) => b.el)),
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'xs muted' }, 'Buttons light up when their turn makes sense.'), reset),
              narr,
              h('p', { class: 'small m0', html: '<b>The rule:</b> fork() and dup() share the file object and its offset · two open() calls share the dentry and inode · a hard link shares only the inode.' })),
            h('div', { class: 'stack', style: { gap: '8px' } },
              h('div', { class: 'callout tip m0', 'data-label': 'Predict first', html: 'P1 reads 100 bytes, then forks, then the child reads 50. Where does P1\'s next read start? Commit to a number, then try it.' }),
              h('div', { class: 'card white grow', style: { display: 'grid', placeItems: 'center', padding: '8px' } }, svg))));
        },
      },

      /* ---------------- 6. Lab: the dentry cache ---------------- */
      {
        title: 'Lab: the dentry cache saves the slow walk',
        kind: 'lab',
        core: true,
        render(el, ctx) {
          const { h, s } = ctx;
          const slim = ctx.narrow;
          const PATHS = ['/home/ana/notes.txt', '/home/ana/todo.txt', '/home/ben/main.c', '/bin/vi', '/bin/ls', '/home/ana/draft.txt'];
          const ORDER = ['/', '/bin', '/bin/vi', '/bin/ls', '/home', '/home/ana', '/home/ana/notes.txt', '/home/ana/todo.txt', '/home/ana/draft.txt', '/home/ben', '/home/ben/main.c'];
          const POS = { '/': [310, 0], '/bin': [130, 1], '/home': [440, 1], '/bin/vi': [65, 2], '/bin/ls': [180, 2], '/home/ana': [350, 2], '/home/ben': [548, 2], '/home/ana/notes.txt': [240, 3], '/home/ana/todo.txt': [350, 3], '/home/ana/draft.txt': [460, 3], '/home/ben/main.c': [565, 3] };
          const NW = slim ? 118 : 92, NH = slim ? 25 : 34;
          // rect(id): the node's box [x, y, w, h]; small screens get an indented list, large ones a tree
          const rect = (id) => {
            if (slim) { const i = ORDER.indexOf(id), d = id === '/' ? 0 : id.split('/').length - 1; return [8 + d * 34, 6 + i * 31, NW, NH]; }
            const [cx, lv] = POS[id]; return [cx - NW / 2, 8 + lv * 72, NW, NH];
          };
          const parentOf = (id) => { const i = id.lastIndexOf('/'); return i === 0 ? '/' : id.slice(0, i); };
          let cache, stats, last, logLines;
          function fresh() { cache = { '/': 'pos' }; stats = { n: 0, c: 0, h: 0, m: 0 }; last = null; logLines = []; }
          fresh();
          const svg = s('svg', { viewBox: slim ? '0 0 360 348' : '0 0 620 268', width: '100%', role: 'img', 'aria-label': 'Directory tree with the dentries currently in the cache' });
          function draw() {
            const k = [], lastIds = last ? Object.fromEntries(last.steps.map((x) => [x.id, x])) : {};
            ORDER.forEach((id) => {
              if (id === '/') return;
              const shown = id !== '/home/ana/draft.txt' || cache[id];
              if (!shown) return;
              const a = rect(parentOf(id)), b = rect(id), neg = cache[id] === 'neg';
              const cls = neg ? 's-bad' : cache[id] ? 's-accent' : 's-muted';
              if (slim) k.push(path(s, [[a[0] + 12, a[1] + a[3]], [a[0] + 12, b[1] + b[3] / 2], [b[0], b[1] + b[3] / 2]], cls, null, { dash: neg ? '4 3' : null }));
              else k.push(s('line', { x1: a[0] + a[2] / 2, y1: a[1] + a[3], x2: b[0] + b[2] / 2, y2: b[1], class: cls, 'stroke-width': 2, 'stroke-dasharray': neg ? '4 3' : null }));
            });
            ORDER.forEach((id) => {
              if (id === '/home/ana/draft.txt' && !cache[id]) return;
              const r = rect(id), c = cache[id], nm = id === '/' ? '/' : id.slice(id.lastIndexOf('/') + 1);
              const cls = c === 'neg' ? 's-bad' : c ? 's-accent' : 's-panel';
              k.push(box(s, r, cls, [nm + (c === 'neg' ? ' ✗' : '')], { fs: slim ? 13 : 13.5, rx: 7, dash: c ? null : '4 4', c0: c ? null : 's-sub' }));
              const L = lastIds[id];
              if (L) k.push(s('rect', { x: r[0] - 4, y: r[1] - 4, width: r[2] + 8, height: r[3] + 8, rx: 10, class: L.hit ? 's-ok' : 's-warn', style: { fill: 'none' }, 'stroke-width': 3 }));
            });
            svg.replaceChildren(...k);
          }
          const stat = (label) => { const v = h('div', { style: { fontSize: '26px', fontWeight: 800, lineHeight: 1.1 } }, '0'); return { v, el: h('div', { class: 'card tight center', style: { padding: '6px 4px' } }, v, h('div', { class: 'xs muted' }, label)) }; };
          const S = { n: stat('lookups'), c: stat('components'), h: stat('cache hits'), m: stat('slow lookups') };
          const saved = h('p', { class: 'small m0' });
          const meter = h('div', { class: 'meter' }, h('i'));
          const narr = h('div', { class: 'narr', html: 'The cache starts nearly empty: only the root dentry <b>/</b>, which stays pinned while the file system is mounted. Open a path.' });
          const log = h('div', { class: 'log' + (slim ? '' : ' grow'), style: slim ? { height: '120px' } : { minHeight: '60px' } });
          function stats2ui() {
            Object.keys(S).forEach((k2) => { S[k2].v.textContent = stats[k2]; });
            const pct = stats.c ? Math.round((100 * stats.h) / stats.c) : 0;
            meter.firstChild.style.width = pct + '%';
            saved.innerHTML = stats.c ? `Without a dentry cache all <b>${stats.c}</b> components would have needed a slow lookup. The cache answered <b>${stats.h}</b> of them (${pct}%).` : 'Without a dentry cache, every component of every path would need a slow lookup.';
            log.replaceChildren(...logLines.map((x) => h('div', { html: x })));
            log.scrollTop = log.scrollHeight;
          }
          function open(p) {
            const r = dlookup(cache, p);
            last = r;
            stats.n += 1; stats.c += r.steps.length; stats.h += r.hits; stats.m += r.slow;
            const parts = r.steps.map((x) => `${x.name} ${x.hit ? '<span style="color:var(--ok)">hit</span>' : '<span style="color:var(--warn)">slow</span>'}${x.neg ? ' ✗' : ''}`).join(' · ');
            logLines.push(`<b>${p}</b>: ${parts}`);
            const neg = r.steps[r.steps.length - 1];
            let msg;
            if (!r.found && neg.hit) msg = `The cached <b>negative dentry</b> for ${neg.name} answered at once: no such file, and no directory was searched. open() fails with ENOENT.`;
            else if (!r.found) msg = `${r.slow} slow lookup${r.slow > 1 ? 's' : ''}. ${neg.name} is not in ${parentOf(neg.id).split('/').pop()}: ext4's lookup found nothing, and the VFS cached that answer as a <span class="t">negative dentry</span>. open() fails with ENOENT (“No such file or directory”).`;
            else if (!r.slow) msg = `All ${r.hits} components were cached dentries, so the walk never left memory: no directory was searched at all.`;
            else msg = `${r.slow > 1 ? r.slow + ' components' : '1 component'} missed the cache. ${r.slow > 1 ? 'For each one the' : 'The'} VFS called the parent directory's <code>i_op-&gt;lookup</code>: ext4 searched that directory, found the name and filled in a new dentry (and its inode object), now cached.` + (r.hits ? ` ${r.hits} cached component${r.hits > 1 ? 's' : ''} cost nothing.` : '');
            narr.className = 'narr' + (!r.slow ? ' ok' : r.found ? ' warn' : ' bad');
            narr.innerHTML = msg;
            draw(); stats2ui();
          }
          const btns = PATHS.map((p) => h('button', { class: 'btn sm mono', style: { justifyContent: 'flex-start', fontSize: '13.5px' }, onclick: () => open(p) }, 'open ' + p));
          const drop = h('button', { class: 'btn sm', onclick: () => {
            Object.keys(cache).forEach((id) => { if (id !== '/') delete cache[id]; });
            last = null;
            logLines.push('<i>memory pressure: unused dentries freed</i>');
            narr.className = 'narr warn';
            narr.innerHTML = 'Memory ran short, so the kernel freed <b>unused</b> dentries, as <code>echo 2 &gt; /proc/sys/vm/drop_caches</code> would. The lab\'s files were closed again, so all go except the pinned root: the next lookups will be slow again.';
            draw(); stats2ui();
          } }, 'Free unused dentries');
          const reset = h('button', { class: 'btn sm ghost', onclick: () => { fresh(); narr.className = 'narr'; narr.innerHTML = 'Reset: only the root dentry is cached and every counter is back to 0.'; draw(); stats2ui(); } }, '↺ Reset');
          draw(); stats2ui();
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack', style: { gap: '8px' } },
              h('p', { class: 'm0', html: 'A path is resolved one component at a time. The <span class="t">dentry cache (dcache)</span> remembers every component recently resolved, found by parent and name. Open some paths, repeat them, and count what the cache saves.' }),
              h('div', { class: 'grid-2', style: { gap: '6px' } }, ...btns),
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, drop, reset),
              h('div', { class: 'dc-stats' }, S.n.el, S.c.el, S.h.el, S.m.el),
              meter, saved, log),
            h('div', { class: 'stack', style: { gap: '8px' } },
              h('div', { class: 'card white', style: { padding: '6px 8px' } }, svg,
                h('div', { class: 'row gap-s xs', style: { marginTop: '4px' } }, h('span', { class: 'chip' }, 'dashed: on disk only'), h('span', { class: 'chip accent' }, 'cached dentry'), h('span', { class: 'chip bad' }, 'negative dentry'), h('span', { class: 'chip ok' }, 'ring: hit'), h('span', { class: 'chip warn' }, 'ring: slow lookup'))),
              narr,
              h('div', { class: 'callout warn m0', 'data-label': 'Common mistake', style: { fontSize: '15px' }, html: 'A dentry is not the directory entry on the disk. The disk holds (name, inode number) records; a <span class="t">dentry object</span> is an in-memory object built from one, only for names someone has looked up.' }))));
        },
      },

      /* ---------------- 7. Sorting game: which object does that job? ---------------- */
      {
        title: 'Which object does that job?',
        kind: 'predict',
        render(el, ctx) {
          const { h } = ctx;
          const B = [['sb', 'super'], ['inode', 'inode'], ['dentry', 'dentry'], ['file', 'file']];
          const TNAME = { sb: 'super_operations (superblock)', inode: 'inode_operations (inode)', dentry: 'dentry_operations (dentry)', file: 'file_operations (file)' };
          // [operation, its job, the object whose table holds it, why]; listed in a mixed order on purpose
          const ITEMS = [
            ['llseek', 'move the current offset', 'file', 'The offset lives in the file object, so the job that moves it is a file_operations slot.'],
            ['lookup', 'find a name in a directory', 'inode', 'lookup sits in a <b>directory\'s inode_operations</b>: the directory is asked which inode a name means. The dentry is what it produces, not what does the search.'],
            ['statfs', 'report free space for df', 'sb', 'Free space belongs to the whole mounted file system, so statfs is a super_operations slot.'],
            ['d_compare', 'do two names match?', 'dentry', 'Matching names is a dentry job. vfat fills it in so that names match whatever their case.'],
            ['mkdir', 'make a subdirectory', 'inode', 'Making a name inside a directory changes that directory, so mkdir is in the parent directory\'s inode_operations, with create, link, unlink and rename.'],
            ['read_iter', 'read bytes at the offset', 'file', 'Reads happen through an open file, at the offset kept in the file object: a file_operations slot.'],
            ['write_inode', 'write an inode back to disk', 'sb', 'The trap: although it is about an inode, write_inode is in <b>super_operations</b>. The file system as a whole knows where and how its inodes are stored.'],
            ['d_revalidate', 'is this cached name still right?', 'dentry', 'Called on a cached dentry before it is trusted. NFS needs it: another machine may have renamed or deleted the file.'],
            ['put_super', 'release it all at unmount', 'sb', 'Unmounting ends the life of the superblock object itself, so put_super is in super_operations.'],
            ['unlink', 'remove a name from a directory', 'inode', 'unlink deletes a directory entry and lowers the file\'s link count: a directory inode operation.'],
            ['d_delete', 'drop this entry once unused?', 'dentry', 'Called when the last user of a dentry lets go. The answer decides whether it stays in the dentry cache.'],
            ['mmap', 'map the file into memory', 'file', 'You map an open file (mmap takes a file descriptor), so mmap is a file_operations slot.'],
          ];
          let res;
          const score = h('b');
          const narr = h('div', { class: 'narr', html: 'Pick the object whose operations table holds each job. Each card takes one answer; the explanation appears here.' });
          const cards = ITEMS.map(() => null);
          function paint() {
            const done = res.filter((x) => x != null), right = done.filter((x) => x === true).length;
            score.textContent = `${right} right out of ${done.length} answered (12 cards)`;
          }
          function build() {
            res = ITEMS.map(() => null);
            ITEMS.forEach(([op, job, ans, why], i) => {
              const btns = B.map(([k, lab]) => h('button', { class: 'btn sm', 'aria-label': op + ' belongs to the ' + lab + ' object', onclick: () => {
                if (res[i] != null) return;
                res[i] = k === ans;
                card.classList.add(res[i] ? 'right' : 'wrong');
                btns.forEach((b, j) => { b.disabled = true; if (B[j][0] === ans) b.classList.add('pick-ok'); else if (B[j][0] === k) b.classList.add('pick-bad'); });
                narr.className = 'narr ' + (res[i] ? 'ok' : 'bad');
                narr.innerHTML = `<b>${op}</b> → ${TNAME[ans]}. ${res[i] ? '' : 'Not the ' + B.find((x) => x[0] === k)[1] + ' object. '}${why}`;
                paint();
              } }, lab));
              const card = h('div', { class: 'og-card' }, h('div', { class: 'og-name' }, op), h('div', { class: 'small muted' }, job), h('div', { class: 'og-btns' }, ...btns));
              cards[i] = card;
            });
            grid.replaceChildren(...cards);
            paint();
          }
          const grid = h('div', { class: 'og-grid', style: ctx.narrow ? { gridTemplateColumns: '1fr' } : {} });
          const again = h('button', { class: 'btn sm ghost', onclick: () => { build(); narr.className = 'narr'; narr.innerHTML = 'Cleared. Try again without peeking.'; } }, '↺ Start over');
          build();
          el.append(h('div', { class: 'stack fill', style: { gap: '9px' } },
            h('p', { class: 'm0', html: 'Every slot lives in exactly one of four tables: <b>super</b>_operations, <b>inode</b>_operations, <b>dentry</b>_operations or <b>file</b>_operations. Ask: is the job about the whole file system, a file or directory itself, one cached name, or one open file?' }),
            grid,
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'small' }, score), again),
            narr));
        },
      },

      /* ---------------- 8. Recap ---------------- */
      {
        title: 'Recap: the VFS on one page',
        kind: 'recap',
        render(el, ctx) {
          const { h } = ctx;
          const rows = [
            ['Superblock', 'io', 'one mounted file system', 'at mount', 'filled from the on-disk superblock (NFS: from the server)', 'super_operations'],
            ['Inode', 'mem', 'one file (a directory is a file too)', 'when the file is first needed', 'usually built from the on-disk inode (vfat invents one)', 'inode_operations'],
            ['Dentry', 'accent', 'one component of a path', 'during path lookup', 'never: main memory only, kept in the dcache', 'dentry_operations'],
            ['File', '', 'one open() of a file by a process', 'open(); freed at the last close()', 'never: main memory only', 'file_operations'],
          ];
          const tb = h('table', { class: 'tbl compact', style: { fontSize: '14.5px' } },
            h('tr', {}, ...['Object', 'Stands for', 'Created', 'On disk?', 'Its table'].map((x) => h('th', {}, x))),
            ...rows.map((r) => h('tr', {}, h('td', {}, h('span', { class: 'chip ' + r[1] }, r[0])), h('td', {}, r[2]), h('td', {}, r[3]), h('td', {}, r[4]), h('td', { class: 'mono' }, r[5]))));
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },
            tb,
            h('p', { class: 'small m0 muted' }, 'Click each card. Say the answer out loud before you flip it.'),
            ctx.ui.flipcards([
              ['Why does Linux have a VFS?', 'So one set of system calls works on every file system. Shared work (path walk, permissions, descriptors, caches) is done once; each file system adds only its format-specific code.'],
              ['How does C code get “objects”?', 'Each object is a struct plus a pointer to an operations table, a struct of function pointers that each file system fills in. obj-&gt;ops-&gt;job(...) runs that file system\'s code.'],
              ['What does an empty (NULL) slot mean?', 'The VFS uses its default (local POSIX locks, an open with nothing extra) or the job is unsupported: FAT has no link slot, so ln fails.'],
              ['What does the dentry cache save?', 'The slow directory search for every path component already resolved. Negative dentries even remember names that do not exist.'],
              ['fork() versus two open() calls?', 'fork() shares one file object, so parent and child share the offset. Two opens make two file objects with separate offsets, sharing the dentry and inode.'],
              ['How does a new file system plug in?', 'register_filesystem() gives its name and mount routine; mount fills in a superblock; its inodes point at its tables; open() copies i_fop into f_op. The VFS never changes.'],
            ], { cols: ctx.narrow ? 1 : 3, height: 128 })));
        },
      },

      /* ---------------- 9. Quiz ---------------- */
      {
        title: 'Check yourself',
        kind: 'check',
        quiz: [
          { q: 'What is the main job of the Linux virtual file system (VFS)?',
            choices: ['To convert every file into one common on-disk format, so that every storage device looks the same', 'To translate a file from one file system\'s format into another\'s whenever it is copied between them', 'To present one set of calls and objects for all file systems, handing format-specific work to each', 'To keep recently used disk blocks in main memory so that repeated reads from slow devices finish sooner'],
            answer: 2,
            feedback: ['The VFS defines no on-disk format. ext4, FAT and NFS keep their own formats; the VFS only presents them in one common model in memory.', 'Copying between file systems is just a read through one and a write through another. Nothing is translated by the VFS itself.', null, 'That is the page cache\'s job. The VFS sits above it and decides which file system\'s code to call.'],
            why: 'The VFS receives every file system call, does the shared work once (path lookup, permissions, descriptors, caching of names), and calls the right file system\'s functions through its operations tables.' },
          { type: 'match', q: 'Match each VFS object to what it stands for.',
            pairs: [['Superblock object', 'One mounted file system'], ['Inode object', 'One file, with its owner, size and permissions'], ['Dentry object', 'One path component, linking a name to an inode'], ['File object', 'One open of a file, with its current offset']],
            why: 'Superblock = a mounted file system; inode = a file; dentry = a name in a path; file = an open instance of a file held by a process.' },
          { type: 'bucket', q: 'Sort each operation into the table that holds it.',
            buckets: ['super_operations', 'inode_operations', 'dentry_operations', 'file_operations'],
            items: [['statfs', 0], ['put_super', 0], ['lookup', 1], ['rename', 1], ['d_revalidate', 2], ['d_hash', 2], ['llseek', 3], ['release', 3]],
            why: 'Whole-file-system jobs go with the superblock; jobs that change a directory or a file\'s attributes go with the inode; name checks and matching go with the dentry; jobs on an open file (offset, reading, last close) go with the file object.' },
          { type: 'order', q: 'Put the steps of a read() of a file on ext4 in order, for data that is not yet in the page cache.',
            items: ['The process calls read(fd, buf, 4096)', 'The VFS finds the file object for that descriptor', 'The VFS calls the read_iter slot of the file object\'s operations table', 'The page cache is searched for the page and misses', 'ext4 maps the file block to a disk block, and the driver reads it', 'The bytes are copied into buf and the file offset moves forward'],
            why: 'System call → VFS → the file system\'s function through f_op → page cache → (on a miss) the file system finds the block and the driver transfers it → copy to the user and advance f_pos.' },
          { type: 'num', q: 'A process looks up <code>/bin/vi</code> on a freshly mounted file system whose dentry cache holds only the root. When the lookup is done, how many dentry objects describe this path, counting the root?',
            answer: 3, tol: 0, unit: 'dentries',
            why: 'One dentry per component: "/", "bin" and "vi". The root existed already; the other two were built by the lookup and are now cached.' },
          { type: 'num', q: 'Process P1 opens a 10,000-byte file and reads 100 bytes. It then calls fork(), and the child reads 50 bytes from the same descriptor. At which byte offset does P1\'s next read begin?',
            answer: 150, tol: 0, unit: 'bytes',
            why: 'fork() copies the descriptor table, so both descriptors point to the same file object and share one f_pos: 100 + 50 = 150.' },
          { type: 'tf', q: 'When two processes each call open() on the same file, they share one file object, and therefore one file offset.',
            answer: false,
            why: 'Every open() creates a new file object with its own offset. The two file objects share the dentry and the inode, not the offset. Copying a descriptor, as fork() and dup() do, is what shares a file object.' },
          { q: 'A program asks for a byte-range lock on a file stored on ext4. The lock slot in ext4\'s file_operations table is NULL. What happens?',
            choices: ['The request fails, because ext4 does not supply any lock function of its own', 'The VFS falls back to its generic POSIX locks, kept in this machine\'s memory', 'The VFS forwards the request to the disk driver, which locks the disk blocks', 'The lock is silently ignored and the call reports success without locking anything'],
            answer: 1,
            feedback: ['An empty slot is not an error by itself: for locks it means "use the VFS default".', null, 'Drivers know nothing about file locks. Locks are kept by the kernel in memory.', 'The lock is real: the VFS\'s generic code records it and enforces it between local processes.'],
            why: 'When a slot is NULL the VFS uses its default behaviour. For locks that is the generic POSIX lock code, which is enough on a local disk. NFS fills the slot because its locks must be seen by other machines.' },
          { type: 'multi', q: 'Which statements about dentry objects are true? (Pick all that apply.)',
            choices: ['They exist only in main memory; no dentry object is ever written to the disk', 'Looking up /home/ana/notes.txt involves a dentry for /, home, ana and notes.txt', 'A dentry stores the file\'s size, owner and permission bits', 'A negative dentry records that a name does not exist in a directory', 'Every process that opens a file gets its own private dentry for it'],
            answer: [0, 1, 3],
            why: 'Dentries are in-memory objects, one per path component, kept in the dentry cache, and negative ones cache failed lookups. Size, owner and permissions belong to the inode, and processes share dentries.' },
          { q: 'Why does the NFS client supply a d_revalidate function in its dentry operations?',
            choices: ['To check the user\'s permission bits again before every single read of the file', 'To make name comparisons ignore the difference between upper and lower case', 'To write the cached dentries back to the server\'s disk just before unmounting', 'Another machine may have changed the directory since the name was cached'],
            answer: 3,
            feedback: ['Permission checks belong to the inode (its permission operation), not to a dentry.', 'That is what vfat\'s d_hash and d_compare do; NFS names are case-sensitive.', 'Dentries are never written to any disk; they exist only in memory.', null],
            why: 'On a local disk only this kernel changes directories, so a cached dentry stays right. With NFS other clients can rename or delete files, so a cached dentry must be checked (revalidated) before it is trusted.' },
          { type: 'num', q: 'The dentry cache holds only the root. A process opens <code>/home/ana/notes.txt</code>, then <code>/home/ana/todo.txt</code>, then <code>/home/ana/notes.txt</code> again. All files exist. How many slow lookups (cache misses that make the file system search a directory) happen in total?',
            answer: 4, tol: 0, unit: 'lookups',
            why: 'First open: home, ana and notes.txt all miss (3). Second: home and ana hit, todo.txt misses (1). Third: all three hit (0). 3 + 1 + 0 = 4.' },
          { q: 'A FAT-formatted USB stick is mounted at /media/usb. Which statement is true?',
            choices: ['vfat builds an inode object in memory for each file, though FAT stores none', 'Programs must use special vfat system calls in place of open() and read()', 'The VFS will not create dentries for files that live on a mounted stick', 'All files on the stick share one inode object, because FAT has no inodes'],
            answer: 0,
            feedback: [null, 'The whole point of the VFS: the same open() and read() work on every file system.', 'Path lookup builds dentries on every file system; the walk simply crosses the mount point at /media/usb.', 'Each file needs its own inode object for its own size and data; vfat makes one per file from its directory entry.'],
            why: 'The common file model requires an inode object per file, so vfat fills one in from the FAT directory entry: it invents the inode number and takes the owner and permissions from the mount options.' },
        ],
      },
    ],
    notes: `
      <h3>Why Linux has a virtual file system</h3>
      <p>One Linux machine often uses several file systems at once: <b>ext4</b>, <b>XFS</b>, <b>Btrfs</b> (copy-on-write snapshots), <b>vfat</b> (USB sticks, SD cards), <b>ntfs3</b> (Windows disks, read-write since Linux 5.15), <b>NFS</b> (files on another computer) and <b>procfs</b> (/proc, on no device). Programs use them all with the same calls.</p>
      <p>The <b>virtual file system (VFS)</b> is the kernel layer that makes this possible. The VFS works with one generic picture of files, the <b>common file model</b>, does the jobs that are the same for every file system (path lookup, permission checks, file descriptors, the dentry cache) and hands only the format-specific work to the right file system. In the classic picture each file system supplies a <b>mapping function</b> between the common model and its own format; in Linux that mapping is the set of operations tables the file system fills in.</p>
      <p>Layers, top to bottom: process → system call interface → VFS → one file system → page cache (not for procfs) → block layer and driver (NFS: RPC, TCP/IP, network driver) → device or server.</p>
      <h4>Tracing one read(3, buf, 4096)</h4>
      <ol>
        <li>The process calls read; the call names a descriptor, never a file system.</li>
        <li>The VFS finds the process's file object for descriptor 3 (opened for reading, offset 0).</li>
        <li>The VFS calls <code>file-&gt;f_op-&gt;read_iter</code>.</li>
        <li>The page cache is searched for the page. On a miss, the file system finds the data and a driver fetches it.</li>
        <li>The bytes are copied into buf, the offset moves forward by the number of bytes read, and read returns that number.</li>
      </ol>
      <table>
        <tr><th></th><th>read_iter slot holds</th><th>finds the data by</th><th>below it</th></tr>
        <tr><td>ext4</td><td>ext4_file_read_iter</td><td>the file's extent tree (file block → disk block)</td><td>block layer, NVMe driver, SSD</td></tr>
        <tr><td>vfat</td><td>generic_file_read_iter (a shared helper)</td><td>first cluster in the directory entry, then the FAT chain</td><td>block layer, USB storage driver, stick</td></tr>
        <tr><td>NFS</td><td>nfs_file_read (revalidates the cache first)</td><td>a READ request to the server</td><td>RPC, TCP/IP, network driver, server</td></tr>
        <tr><td>procfs</td><td>procfs's read function</td><td>printing kernel counters on the spot</td><td>nothing: no cache, no device</td></tr>
      </table>
      <p>The top three layers never change; only what sits behind f_op differs.</p>
      <h3>Objects in C: data plus a table of functions</h3>
      <p>C has no classes, so the VFS builds objects by hand. Each object is a struct of data plus a pointer to an <b>operations table</b>: a struct whose members are <b>function pointers</b>, one slot per job. Every file system fills in its own copy of each table. To get a job done the VFS calls through the slot, for example <code>file-&gt;f_op-&gt;read_iter(...)</code>, and runs whatever function the file system put there. An empty (NULL) slot means the VFS default applies (no lock slot: generic POSIX locks in local memory; no open slot: nothing extra to do) or the job is not supported (vfat's directories have no link slot, so ln on a FAT stick fails). With tables the VFS never names a file system, so adding one changes no VFS code.</p>
      <p>Examples: ext4 leaves lock empty; vfat uses shared generic_ helpers and leaves open empty; NFS fills lock with nfs_lock so that other machines see the lock.</p>
      <h4>How a new file system plugs in</h4>
      <ol>
        <li>Its module calls <code>register_filesystem()</code> with its type name and mount routine.</li>
        <li>At mount, that routine reads the on-disk superblock (NFS asks the server), fills in a superblock object and sets s_op and the root dentry.</li>
        <li>As files are looked up, it builds inode objects whose i_op and i_fop point at its own tables.</li>
        <li>At open, the VFS creates a file object and copies the inode's i_fop into the file's f_op.</li>
      </ol>
      <h3>The four primary objects</h3>
      <table>
        <tr><th>Object</th><th>Stands for</th><th>Created</th><th>On disk?</th><th>Table</th></tr>
        <tr><td>Superblock</td><td>one mounted file system</td><td>at mount</td><td>filled from the on-disk superblock</td><td>super_operations</td></tr>
        <tr><td>Inode</td><td>one file (a directory is a file too)</td><td>when the file is first needed</td><td>usually built from the on-disk inode</td><td>inode_operations</td></tr>
        <tr><td>Dentry</td><td>one component of a path</td><td>during path lookup</td><td>never, memory only</td><td>dentry_operations</td></tr>
        <tr><td>File</td><td>one open() of a file by a process</td><td>open(); freed at the last close()</td><td>never, memory only</td><td>file_operations</td></tr>
      </table>
      <p><b>Superblock object.</b> Device, type, block size (ext4: 4,096 bytes), magic number, largest file (ext4 with 4 KB blocks: about 16 TiB; FAT: 4 GiB − 1 byte), mount flags such as read-only, the root directory's dentry (s_root), the s_umount semaphore held while (un)mounting, private data and s_op. super_operations include alloc_inode, write_inode, evict_inode, put_super (unmount), sync_fs and statfs (free space for df). Older kernels also had read_inode (removed in 2.6.25, 2008); 2.6-era superblocks also kept a dirty flag and a list of open files, both dropped in the 3.x series.</p>
      <p><b>Inode object.</b> Inode number, mode (type and permission bits), owner, group, size, link count (i_nlink), blocks used in 512-byte units (a 2,140-byte ext4 file on 4 KB blocks: 8), three times, i_sb, i_op and i_fop (copied to f_op at open). A directory's inode_operations hold create, lookup, link, unlink, symlink, mkdir, rmdir, mknod and rename; a regular file's hold mostly attribute jobs such as setattr and getattr. vfat has no on-disk inodes, so it invents the inode number and takes owner and permissions from the mount options.</p>
      <p><b>Dentry object.</b> d_name, d_parent, d_inode (NULL in a negative dentry), d_sb and d_op. Looking up /bin/vi uses three dentries: "/", "bin" and "vi". A dentry is not the on-disk directory entry, but an in-memory object built only for names that were looked up. dentry_operations include d_revalidate (is a cached entry still right? NFS needs this because other machines change directories), d_hash and d_compare (vfat fills them to ignore case, so PHOTO.JPG finds photo.jpg), d_delete, d_release and d_iput. ext4 normally leaves this table empty.</p>
      <p><b>File object.</b> f_path (the dentry and its mount), f_inode, f_pos (the current offset), f_mode (read and/or write), f_flags (as passed to open), a use count (f_ref; f_count before 6.13) and f_op. file_operations include llseek, read and read_iter, write and write_iter, mmap, open, release (after the last close), fsync and lock. read_iter/write_iter (Linux 3.16, 2014) replaced read/write in disk file systems; some drivers still use the old slots.</p>
      <p><b>Traps:</b> write_inode is a <i>superblock</i> operation (the file system knows how its inodes are stored), and lookup belongs to the directory's <i>inode</i>, not to the dentry it produces.</p>
      <h3>Who shares what</h3>
      <ul>
        <li><b>fork()</b> copies the descriptor table, so parent and child point to the <b>same file object</b> and share one offset. Example: P1 reads 100 bytes, forks, the child reads 50 bytes; P1's next read starts at 100 + 50 = 150. dup() shares a file object the same way.</li>
        <li><b>Two open() calls</b> (by two processes or one) create <b>two file objects</b> with separate offsets that share one dentry and one inode.</li>
        <li><b>A hard link</b> (ln notes.txt n2) adds a second name: two dentries, one inode, and i_nlink becomes 2.</li>
      </ul>
      <h3>The dentry cache</h3>
      <p>Path lookup resolves one component at a time, starting from the root (or working) directory. For each component the VFS first searches the <b>dentry cache (dcache)</b> by parent and name. A hit costs nothing more. A miss is a slow lookup: the VFS calls the parent directory inode's i_op-&gt;lookup, the file system searches that directory (possibly reading the disk), and the result is cached as a new dentry (with its inode object). If the name does not exist, the answer is cached as a <b>negative dentry</b>, so the next attempt fails at once with ENOENT. The root dentry is pinned while the file system is mounted. Under memory pressure the kernel frees unused dentries. When the walk reaches a mount point, such as /media/usb, it continues in the mounted file system's root dentry.</p>
      <p><b>Worked example.</b> Only the root is cached. Open /home/ana/notes.txt (home, ana, notes.txt: 3 misses), then /home/ana/todo.txt (2 hits, 1 miss), then /home/ana/notes.txt again (3 hits). That is 9 components, 5 hits and 4 slow lookups; without a dentry cache all 9 would be slow.</p>`,
  });
})();
