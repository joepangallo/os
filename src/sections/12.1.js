/* =====================================================================
   12.1 Overview (file management)
   Original teaching material. Helpers shared by several steps live inside
   this IIFE (no globals).
   ===================================================================== */
(function () {
  // Payroll example used by the layer stack and the function-flow steps.
  const PAY = { recSize: 256, blockSize: 4096, records: 64, want: 42, blocks: [7340, 7341, 9120, 9121], freeBlock: 5507, disk: 'disk 0' };
  PAY.bf = Math.floor(PAY.blockSize / PAY.recSize);            // records per block
  PAY.blk = Math.floor(PAY.want / PAY.bf);                     // file block that holds the wanted record
  PAY.slot = PAY.want % PAY.bf;                                // position of the record inside that block
  PAY.off = PAY.slot * PAY.recSize;                            // byte offset of the record inside the block
  PAY.end = PAY.off + PAY.recSize - 1;                         // last byte of the record inside the block
  PAY.fileOff = PAY.want * PAY.recSize;                        // byte offset of the record inside the file
  PAY.disk0 = PAY.blocks[PAY.blk];                             // disk block that holds that file block
  PAY.nBlocks = Math.ceil(PAY.records / PAY.bf);               // blocks the file uses now
  PAY.newBlk = Math.floor(PAY.records / PAY.bf);               // file block an appended record lands in
  PAY.newSlot = PAY.records % PAY.bf;                          // slot it lands in

  Guide.section({
    id: '12.1',
    title: 'Overview',
    short: 'File management overview',
    summary: 'What a file is, how data inside it is structured, and the software layers that carry a request to the disk.',
    objectives: [
      'Explain what a file is, the three properties that make files useful, and the six basic file operations.',
      'Tell fields, records, files and databases apart, and explain why UNIX and Windows see a file as a stream of bytes.',
      'List the objectives of a file management system and the minimal requirements its users place on it.',
      'Name the five layers of file system software, from device drivers up to access methods, and trace a record request through them.',
      'Follow a request through the file management functions, from directory lookup and access control down to physical I/O.',
    ],
    terms: [
      ['File', 'A named collection of data that applications create and the OS keeps on secondary storage (disk or SSD), so it lasts after the program that made it ends and can be used again later, by the same or another program.'],
      ['Long-term existence (persistence)', 'The property that a file stays on secondary storage until someone deletes it, through program exits, logoffs and power cycles.'],
      ['File management system', 'The set of system software that gives users and applications their services for using files. Programs reach file data only through it.'],
      ['Directory', 'A table kept by the file system that maps each file name to information about the file, including where its data is stored.'],
      ['Field', 'The basic element of data: one value, such as a name, a date or a salary. It has a type and a length, and the length may be fixed or variable.'],
      ['Record', 'A collection of related fields that a program treats as one unit, such as everything about one employee. It is fixed-length when it always holds the same fixed-length fields, and variable-length when a field varies in length or the number of fields varies.'],
      ['Database', 'A collection of related data in which the relationships among the elements are explicit, designed to be used by one or more applications.'],
      ['Database management system (DBMS)', 'The software that stores, organizes and searches a database. It is a separate program, not part of the OS, and it usually keeps the database in ordinary files that the OS manages.'],
      ['Byte stream', 'A view of a file as nothing more than a numbered sequence of bytes. UNIX, Linux and Windows treat ordinary files this way and leave any record structure to the application.'],
      ['Access method', 'The top layer of file system software and the standard interface between applications and the file system. Each access method suits one file structure, such as pile, sequential or indexed.'],
      ['Logical I/O', 'In the file system software stack, the layer that lets programs read and write records instead of blocks, and keeps basic data about each file, such as its record size. (Section 11.3\'s I/O model uses the same name for a different layer: the top layer for a local device, which treats the whole device as a logical resource.)'],
      ['Basic I/O supervisor', 'The file system layer that starts and ends every file I/O operation. It keeps the control structures for device I/O, scheduling and file status, picks the device, schedules disk accesses and assigns I/O buffers.'],
      ['Basic file system (physical I/O)', 'The file system layer that exchanges whole blocks with secondary storage, places blocks on the device and buffers them in main memory, without knowing what the blocks contain.'],
      ['Block', 'The unit, usually of one fixed size, in which data move between main memory and secondary storage, for example 4096 bytes. One disk block usually covers several sectors.'],
      ['Directory management', 'The file management function that identifies and locates a file from its symbolic name by looking it up in the directory, and carries out directory operations such as adding and removing entries.'],
      ['User access control', 'The file management function that checks whether the requesting user may perform the requested operation on the file, before any data moves.'],
      ['Record blocking', 'Packing records into blocks before output and unpacking them after input, because programs work with records while I/O moves whole blocks.'],
      ['File allocation', 'Deciding which blocks of secondary storage hold a file\'s data, and recording that mapping so every block of the file can be found again.'],
      ['Free storage management', 'Keeping track of which blocks of secondary storage are unused, so new or growing files can be given space.'],
    ],
    css: `
      .sec-12-1 .narr { background: var(--panel-2); border: 1px solid var(--line); border-left: 5px solid var(--chc); border-radius: 12px; padding: 9px 13px; font-size: 15px; line-height: 1.45; }
      .sec-12-1 .narr.bad { border-left-color: var(--bad); background: var(--bad-bg); }
      .sec-12-1 .narr.ok { border-left-color: var(--ok); background: var(--ok-bg); }
      .sec-12-1 .grid-2 > *, .sec-12-1 .grid-3 > *, .sec-12-1 .mw0 > * { min-width: 0; }
      .sec-12-1 .prop { border-left: 4px solid var(--chc); padding: 2px 0 2px 10px; font-size: 15px; line-height: 1.4; }
      .sec-12-1 .ops { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
      .sec-12-1 .ops .btn { justify-content: center; }
      .sec-12-1 .pane { border: 2px solid var(--line-2); border-radius: 10px; padding: 6px 10px; display: flex; flex-direction: column; gap: 3px; font-size: 14.5px; line-height: 1.35; min-width: 0; }
      .sec-12-1 .pane.mem { border-color: var(--mem); background: var(--mem-bg); }
      .sec-12-1 .pane.io { border-color: var(--io); background: var(--io-bg); }
      .sec-12-1 .pane .hd { font-weight: 800; font-size: 14px; }
      .sec-12-1 .bytes { display: grid; grid-template-columns: repeat(31, minmax(0, 1fr)); gap: 1px; font-family: var(--mono); font-size: 14px; }
      .sec-12-1 .bytes .c { height: 24px; display: grid; place-items: center; background: var(--panel); border: 1px solid var(--line); border-radius: 3px; }
      .sec-12-1 .bytes .c.e { border-style: dashed; color: var(--muted); }
      .sec-12-1 .bytes .c.sp { color: var(--muted); }
      .sec-12-1 .bytes .c.new { background: var(--hl); }
      .sec-12-1 .bytes .c.rd { background: color-mix(in srgb, var(--accent) 22%, var(--panel)); }
      .sec-12-1 .bytes .m { height: 15px; line-height: 15px; font-size: 13px; text-align: center; }
      .sec-12-1 .bytes .m.p0 { color: var(--proc); } .sec-12-1 .bytes .m.p1 { color: var(--thread); }
      .sec-12-1 .goal.chip { transition: background .2s; }
      .sec-12-1 .ops .btn.used { border-color: var(--ok); }
      .sec-12-1 .ladder { display: flex; flex-direction: column; gap: 6px; }
      .sec-12-1 .ladder .btn { justify-content: flex-start; gap: 10px; height: 42px; font-size: 16px; }
      .sec-12-1 .ladder .btn .lv { display: inline-grid; place-items: center; width: 26px; height: 26px; border-radius: 50%; background: var(--panel-3); font-size: 13px; font-weight: 800; }
      .sec-12-1 .ladder .btn.on .lv { background: var(--chc); color: var(--panel); }
      .sec-12-1 .crumbs { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; font-size: 14.5px; }
      .sec-12-1 .crumbs button { border: 0; background: none; padding: 2px 4px; border-radius: 6px; font: inherit; color: var(--accent); cursor: pointer; text-decoration: underline; }
      .sec-12-1 .crumbs .cur { font-weight: 800; color: var(--ink); padding: 2px 4px; }
      .sec-12-1 .zview { display: flex; flex-direction: column; gap: 10px; min-height: 0; }
      .sec-12-1 .fcard { display: flex; flex-direction: column; align-items: flex-start; gap: 3px; text-align: left; padding: 10px 12px; border-radius: 12px; border: 2px solid var(--mem); background: var(--mem-bg); color: var(--ink); cursor: pointer; font: inherit; font-size: 14.5px; min-width: 0; }
      .sec-12-1 .fcard:hover { box-shadow: 0 0 0 3px var(--hl); }
      .sec-12-1 .fcard .nm { font-size: 18px; font-weight: 800; }
      .sec-12-1 .fcard .flds { font-family: var(--mono); font-size: 13px; color: var(--ink-2); }
      .sec-12-1 table.tbl tr.pick { cursor: pointer; }
      .sec-12-1 table.tbl tr.pick:hover td, .sec-12-1 table.tbl tr.pick:focus-visible td { background: var(--accent-bg); }
      .sec-12-1 .fstrip { display: flex; gap: 4px; }
      .sec-12-1 .fbox { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; min-width: 64px; padding: 8px 4px; border-radius: 10px; border: 2px solid var(--mem); background: var(--mem-bg); color: var(--ink); cursor: pointer; font: inherit; font-size: 14px; }
      .sec-12-1 .fbox.var { border-style: dashed; }
      .sec-12-1 .fbox:hover { box-shadow: 0 0 0 3px var(--hl); }
      .sec-12-1 .fbox .v { font-family: var(--mono); font-weight: 700; font-size: 15px; }
      .sec-12-1 .cells { display: flex; flex-wrap: wrap; gap: 3px; }
      .sec-12-1 .cells span { min-width: 30px; height: 34px; padding: 0 4px; display: grid; place-items: center; border: 1px solid var(--line-2); border-radius: 6px; background: var(--panel); font-family: var(--mono); font-size: 15px; }
      .sec-12-1 .cells span.len { background: var(--warn-bg); border-color: var(--warn); font-weight: 800; }
      .sec-12-1 .bgrid { display: grid; grid-template-columns: 34px repeat(16, minmax(0, 1fr)); gap: 2px; font-family: var(--mono); font-size: 14.5px; }
      .sec-12-1 .bgrid .off { color: var(--muted); font-size: 13px; text-align: right; padding-right: 4px; align-self: center; }
      .sec-12-1 .bgrid .b { height: 24px; display: grid; place-items: center; border-radius: 4px; border: 1px solid var(--line); background: var(--panel); font-weight: 400; position: relative; }
      .sec-12-1 .bgrid .b.f0 { background: var(--cpu-bg); border-color: var(--cpu); }
      .sec-12-1 .bgrid .b.f1 { background: var(--mem-bg); border-color: var(--mem); }
      .sec-12-1 .bgrid .b.f2 { background: var(--io-bg); border-color: var(--io); }
      .sec-12-1 .bgrid .b.st { box-shadow: inset 3px 0 0 var(--ink); }
      .sec-12-1 .bgrid .b.sel { outline: 2px solid var(--accent); outline-offset: 0; font-weight: 800; }
      .sec-12-1 .bgrid .b.dim { opacity: .45; }
      .sec-12-1 .tk3 { display: inline-block; width: 12px; height: 12px; border-radius: 3px; border: 1.5px solid; vertical-align: -1px; margin: 0 3px 0 8px; }
      .sec-12-1 .tk3.f0 { background: var(--cpu-bg); border-color: var(--cpu); } .sec-12-1 .tk3.f1 { background: var(--mem-bg); border-color: var(--mem); } .sec-12-1 .tk3.f2 { background: var(--io-bg); border-color: var(--io); }
      .sec-12-1 table.ptab td, .sec-12-1 table.ptab th { padding: 2px 10px; font-size: 14px; }
      .sec-12-1 table.ptab td.bad { color: var(--bad); font-weight: 700; }
      .sec-12-1 table.ptab td.mono { white-space: pre; }
      .sec-12-1 .sorter { display: grid; gap: 12px; align-items: stretch; min-height: 0; }
      .sec-12-1 .slots { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
      .sec-12-1 .slots .hd { font-weight: 800; font-size: 16px; padding: 4px 10px; border-radius: 9px; }
      .sec-12-1 .slots.o .hd { background: var(--os-bg); color: var(--os); }
      .sec-12-1 .slots.r .hd { background: var(--proc-bg); color: var(--proc); }
      .sec-12-1 .slot { display: flex; gap: 8px; align-items: center; min-height: 50px; padding: 3px 10px; border-radius: 9px; border: 1.5px dashed var(--line-2); font-size: 14px; line-height: 1.3; color: var(--muted); }
      .sec-12-1 .slot .n { flex: none; width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; font-size: 13px; font-weight: 800; background: var(--panel-3); color: var(--ink-2); }
      .sec-12-1 .slots.o .slot.full { border: 1.5px solid var(--os); background: var(--os-bg); color: var(--ink); }
      .sec-12-1 .slots.r .slot.full { border: 1.5px solid var(--proc); background: var(--proc-bg); color: var(--ink); }
      .sec-12-1 .slot.full.flash { background: var(--hl); }
      .sec-12-1 .stmt { font-size: 19px; font-weight: 700; line-height: 1.35; min-height: 80px; display: flex; align-items: center; }
      .sec-12-1 .lstack { display: flex; flex-direction: column; gap: 6px; }
      .sec-12-1 .lyr { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 50px; padding: 4px 12px; border-radius: 10px; border: 2px solid var(--os); background: var(--os-bg); color: var(--ink); font: inherit; text-align: left; cursor: pointer; transition: box-shadow .15s, opacity .15s; }
      .sec-12-1 .lyr.am { border-color: var(--accent); background: var(--accent-bg); }
      .sec-12-1 .lyr.prog { border-color: var(--proc); background: var(--proc-bg); cursor: default; }
      .sec-12-1 .lyr.disk { border-color: var(--io); background: var(--io-bg); cursor: default; }
      .sec-12-1 .lyr .nm { font-weight: 800; font-size: 16px; line-height: 1.2; }
      .sec-12-1 .lyr .u { margin-left: auto; font-size: 13px; font-weight: 700; color: var(--ink-2); text-align: right; }
      .sec-12-1 .lyr .ar { flex: none; width: 18px; font-size: 16px; font-weight: 900; color: var(--chc); text-align: center; }
      .sec-12-1 .lyr.cur { box-shadow: 0 0 0 4px var(--chc); }
      .sec-12-1 .lyr.dim { opacity: .55; }
      .sec-12-1 .sees { font-family: var(--mono); font-size: 15.5px; line-height: 1.45; background: var(--panel-3); border-radius: 10px; padding: 8px 12px; border-left: 5px solid var(--chc); min-height: 50px; }
      .sec-12-1 .duties { font-size: 14.5px; line-height: 1.4; margin: 0; padding-left: 18px; }
      .sec-12-1 .player-cap { font-size: 15px; line-height: 1.45; }
      .sec-12-1 .flow { display: flex; flex-direction: column; }
      .sec-12-1 .fbx { border: 2px solid var(--os); background: var(--os-bg); border-radius: 10px; padding: 4px 12px; display: flex; align-items: center; gap: 8px; min-height: 44px; font-size: 15px; line-height: 1.25; transition: box-shadow .15s, opacity .15s; min-width: 0; }
      .sec-12-1 .fbx.u { border-color: var(--proc); background: var(--proc-bg); }
      .sec-12-1 .fbx.p { border-color: var(--io); background: var(--io-bg); }
      .sec-12-1 .fbx .nm { font-weight: 800; }
      .sec-12-1 .fbx .res { margin-left: auto; font-family: var(--mono); font-size: 13.5px; font-weight: 700; text-align: right; }
      .sec-12-1 .fbx.idle { opacity: .5; }
      .sec-12-1 .fbx.done { border-color: var(--ok); background: var(--ok-bg); }
      .sec-12-1 .fbx.skip { border-style: dashed; opacity: .6; }
      .sec-12-1 .fbx.stop { border-color: var(--bad); background: var(--bad-bg); }
      .sec-12-1 .fbx.cur { box-shadow: 0 0 0 4px var(--chc); opacity: 1; }
      .sec-12-1 .farr { text-align: center; color: var(--muted); font-size: 13px; line-height: 15px; height: 15px; }
      .sec-12-1 .trio { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
      .sec-12-1 .trio .fbx { flex-direction: column; align-items: flex-start; justify-content: center; gap: 1px; }
      .sec-12-1 .trio .fbx .res { margin-left: 0; text-align: left; }
      .sec-12-1 .side { font-size: 13px; font-weight: 700; color: var(--muted); letter-spacing: .02em; }
      .sec-12-1 .flip-face.front { font-size: 19px; }
      .sec-12-1 .flip-face.back { font-size: 15px; line-height: 1.45; }
    `,
    steps: [
      {
        title: 'Data that outlives its program',
        kind: 'story',
        html: `
          <div class="split fill">
            <div class="stack" style="gap:8px">
              <p class="lead m0">A program's variables vanish the moment it ends. A <span class="t">file</span> is how data outlives the program that made it.</p>
              <p class="m0">A file is a named collection of data that an application creates and the OS keeps on <span class="t" data-t="secondary memory">secondary storage</span>, such as a disk or an SSD. Three properties make files worth having:</p>
              <div class="prop"><b><span class="t">Long-term existence</span>.</b> The file stays on the disk after the program exits, the user logs off or the power goes off, until someone deletes it.</div>
              <div class="prop"><b>Sharable between processes.</b> A file has a name, so other programs and users can find it; access controls decide who may do what with it.</div>
              <div class="prop"><b>Structure.</b> The data inside is organized to suit the application, and files can be grouped into hierarchies (folders) and related to one another.</div>
              <div class="callout analogy m0" data-label="Analogy">A library: books outlast every reader, anyone with a card can ask for a title by name, and every book has chapters and a numbered shelf.</div>
              <p class="m0">The OS software behind all this is the <span class="t">file management system</span>. Programs use it through six basic operations: create, delete, open, close, read and write.</p>
            </div>
            <div class="card stack lab1" style="gap:7px"></div>
          </div>`,
        render(el, ctx) {
          const { h } = ctx;
          const LIMIT = 30, CHUNK = 10;
          const PROGS = ['Editor', 'Backup tool'];
          const TEXT = { Editor: ['Buy milk. ', 'Call Ana. ', 'Pay rent. '], 'Backup tool': ['(checked) ', '(checked) ', '(checked) '] };
          const OPS = ['create', 'open', 'write', 'read', 'close', 'delete'];
          let st, actor = 'Editor';
          function fresh() {
            st = { exists: false, data: '', owner: [], open: [false, false], pos: [0, 0], writes: [0, 0], used: new Set(), restarted: false, shared: false, mark: null, msg: 'Pick the acting program, then press <b>create</b>. Every button is a request to the OS, which does the real work on the disk.', cls: '' };
          }
          fresh();
          const lab = ctx.$('.lab1');
          const seg = ctx.ui.seg(PROGS, actor, (v) => { actor = v; st.mark = null; st.msg = `The <b>${v}</b> is now the program asking the OS for file operations.`; st.cls = ''; draw(); });
          const opBtns = OPS.map((o) => h('button', { class: 'btn', type: 'button', onclick: () => act(o) }, o));
          const bRestart = h('button', { class: 'btn intr', type: 'button', onclick: () => act('restart') }, 'Restart the computer');
          const bReset = h('button', { class: 'btn ghost sm', type: 'button', onclick: () => { fresh(); actor = 'Editor'; seg.set('Editor'); draw(); } }, 'Reset');
          const memPane = h('div', { class: 'pane mem' });
          const diskPane = h('div', { class: 'pane io' });
          const bytes = h('div', { class: 'bytes', 'aria-label': 'Bytes of notes.txt on the disk' });
          const narr = h('div', { class: 'narr', 'aria-live': 'polite' });
          const goals = [h('span', { class: 'chip goal' }, 'survived a restart'), h('span', { class: 'chip goal' }, 'shared by two programs'), h('span', { class: 'chip goal' }, 'all six operations')];
          lab.append(
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'Try it: one file, two programs'), bReset),
            h('div', { class: 'row gap-s', style: { justifyContent: 'space-between' } }, h('div', { class: 'row gap-s' }, h('span', { class: 'small b' }, 'Acting program:'), seg), bRestart),
            h('div', { class: 'ops' }, ...opBtns),
            h('div', { class: 'grid-2 mw0', style: { gap: '8px' } }, memPane, diskPane),
            h('div', { class: 'small muted' }, 'Bytes of notes.txt on the disk; ▲ marks each open program\'s position.'),
            bytes,
            h('div', { class: 'row gap-s' }, h('span', { class: 'small muted' }, 'Goals:'), ...goals),
            narr);
          const who = () => PROGS.indexOf(actor);
          const other = (i) => 1 - i;
          function act(op) {
            const i = who(), name = actor, oth = PROGS[other(i)];
            st.mark = null; st.cls = 'ok';
            if (op !== 'restart') st.used.add(op);
            if (op === 'create') {
              if (st.exists) { st.cls = 'bad'; st.msg = '<b>create refused:</b> notes.txt already exists. Create makes a new, empty file; to change an existing one, open it.'; }
              else { st.exists = true; st.data = ''; st.owner = []; st.msg = '<b>create:</b> the OS added notes.txt to the disk\'s <span class="t">directory</span> with 0 bytes. (Many systems open a new file at the same moment; this toy keeps the two steps apart.)'; }
            } else if (op === 'open') {
              if (!st.exists) { st.cls = 'bad'; st.msg = '<b>open refused:</b> no file called notes.txt exists. Create it first.'; }
              else if (st.open[i]) { st.cls = ''; st.msg = `The ${name} already has notes.txt open.`; }
              else {
                st.open[i] = true; st.pos[i] = 0;
                st.msg = `<b>open:</b> the OS found notes.txt in the directory by its name, checked that the ${name} may use it, and recorded an open file in main memory. The ${name} gets <span class="t">file descriptor</span> 3 and position 0.`;
                if (st.open[other(i)]) { st.shared = true; st.msg += ` The ${oth} has it open too: two processes now share one file.`; }
              }
            } else if (op === 'write') {
              if (!st.open[i]) { st.cls = 'bad'; st.msg = `<b>write refused:</b> the ${name} has not opened notes.txt. The OS moves data only for a file that is open.`; }
              else if (st.pos[i] + CHUNK > LIMIT) { st.cls = ''; st.msg = `This toy file holds at most ${LIMIT} bytes. Close and reopen it to write from position 0 again (the new bytes then overwrite the old ones).`; }
              else {
                const p = st.pos[i], txt = TEXT[name][st.writes[i] % 3];
                st.data = st.data.slice(0, p) + txt + st.data.slice(p + txt.length);
                for (let k = p; k < p + txt.length; k++) st.owner[k] = i;
                st.writes[i]++; st.pos[i] = p + txt.length; st.mark = ['new', p, p + txt.length];
                st.msg = `<b>write:</b> ${txt.length} bytes "${txt.trim()}" went to the file at position ${p}, and the position moved to ${st.pos[i]}. The file is now ${st.data.length} bytes long.`;
              }
            } else if (op === 'read') {
              if (!st.open[i]) { st.cls = 'bad'; st.msg = `<b>read refused:</b> the ${name} has not opened notes.txt. Open it first.`; }
              else if (st.pos[i] >= st.data.length) { st.cls = ''; st.msg = `<b>read:</b> position ${st.pos[i]} is already at the end of the file, so read returns 0 bytes. That is how a program learns it has reached the end.`; }
              else {
                const p = st.pos[i], n = Math.min(CHUNK, st.data.length - p), got = st.data.slice(p, p + n);
                st.pos[i] = p + n; st.mark = ['rd', p, p + n];
                st.msg = `<b>read:</b> the ${name} got ${n} bytes "${got.trim()}" from position ${p}; the position moved to ${st.pos[i]}.`;
                if (st.owner.slice(p, p + n).includes(other(i))) { st.shared = true; st.msg += ` The ${oth} wrote those bytes: one file, shared by name between two processes.`; }
              }
            } else if (op === 'close') {
              if (!st.open[i]) { st.cls = ''; st.msg = `The ${name} has nothing open to close.`; }
              else { st.open[i] = false; st.msg = `<b>close:</b> the OS removed the ${name}'s open-file record from main memory and freed descriptor 3. The file itself stays on the disk.`; }
            } else if (op === 'delete') {
              if (!st.exists) { st.cls = 'bad'; st.msg = '<b>delete refused:</b> there is no notes.txt to delete.'; }
              else if (st.open[0] || st.open[1]) { st.cls = 'bad'; st.msg = `<b>delete refused:</b> the ${PROGS[st.open[0] ? 0 : 1]} still has notes.txt open. This toy refuses, as Windows normally does; UNIX allows it, removing the name at once and freeing the data after the last close.`; }
              else { st.exists = false; st.data = ''; st.owner = []; st.msg = '<b>delete:</b> notes.txt left the directory and its space went back to the free pool. Nothing on the disk refers to it any more.'; }
            } else if (op === 'restart') {
              const had = st.open[0] || st.open[1];
              st.open = [false, false];
              if (st.exists) {
                st.restarted = true;
                st.msg = `<b>Restart:</b> main memory was wiped, so ${had ? 'every open file record is gone and each program must open the file again' : 'nothing was open anyway'}. But notes.txt is still on the disk with all ${st.data.length} bytes: <b>long-term existence</b>. (This toy writes to disk at once; real systems may keep recent writes in memory, by default up to about 30 s on Linux, so a power cut can lose them.)`;
              } else { st.cls = ''; st.msg = '<b>Restart:</b> main memory was wiped. No file existed, so there was nothing on the disk to survive. Create and write notes.txt, then try again.'; }
            }
            draw();
          }
          function draw() {
            seg.set(actor);
            opBtns.forEach((b, k) => b.classList.toggle('used', st.used.has(OPS[k])));
            goals[0].classList.toggle('ok', st.restarted);
            goals[1].classList.toggle('ok', st.shared);
            goals[2].classList.toggle('ok', st.used.size === OPS.length);
            memPane.innerHTML = '';
            memPane.append(h('div', { class: 'hd' }, 'Main memory · erased at restart'),
              ...PROGS.map((p, k) => h('div', { html: `<b style="color:var(--${k ? 'thread' : 'proc'})">${p}:</b> ` + (st.open[k] ? `notes.txt open, fd 3, position ${st.pos[k]}` : '<span class="muted">no file open</span>') })));
            diskPane.innerHTML = '';
            diskPane.append(h('div', { class: 'hd' }, 'Disk directory · survives'),
              h('div', { class: 'mono' }, 'report.docx  18,204 bytes'),
              h('div', { class: 'mono', html: st.exists ? `notes.txt    ${st.data.length} bytes` : '<span class="muted">(no notes.txt)</span>' }));
            bytes.innerHTML = '';
            const per = ctx.narrow ? 16 : LIMIT + 1;
            bytes.style.gridTemplateColumns = `repeat(${per}, minmax(0, 1fr))`;
            for (let r0 = 0; r0 <= LIMIT; r0 += per) {
              const r1 = Math.min(LIMIT + 1, r0 + per);
              for (let k = r0; k < r0 + per; k++) {
                if (k >= r1) { bytes.append(h('div', {})); continue; }
                const ch = k < st.data.length ? st.data[k] : '';
                let cls = 'c' + (k >= st.data.length ? ' e' : '') + (ch === ' ' ? ' sp' : '');
                if (st.mark && k >= st.mark[1] && k < st.mark[2]) cls += ' ' + st.mark[0];
                bytes.append(h('div', { class: cls, title: 'byte ' + k }, k >= st.data.length ? (st.exists && k === st.data.length ? '|' : '') : (ch === ' ' ? '·' : ch)));
              }
              [0, 1].forEach((p) => { for (let k = r0; k < r0 + per; k++) bytes.append(h('div', { class: 'm p' + p }, k < r1 && st.open[p] && st.pos[p] === k ? '▲' : '')); });
            }
            narr.className = 'narr' + (st.cls ? ' ' + st.cls : '');
            narr.innerHTML = st.msg;
          }
          draw();
        },
      },
      {
        title: 'Zoom in: database, file, record, field',
        kind: 'explore',
        html: `
          <div class="split l fill">
            <div class="stack" style="gap:9px">
              <p class="m0">Stored data is organized in four nested levels. Zoom in and out of a small bike shop's data, and watch what each level is.</p>
              <div class="ladder" role="group" aria-label="Zoom level"></div>
              <div class="card tight stack zdef" style="gap:5px"></div>
            </div>
            <div class="card white stack" style="gap:8px">
              <div class="crumbs" aria-label="Where you are"></div>
              <div class="zview grow"></div>
              <div class="small muted zhint"></div>
            </div>
          </div>`,
        render(el, ctx) {
          const { h } = ctx;
          const F = (name, type, len, desc) => ({ name, type, len, desc });
          const emp = [['0007', 'Rosa Diaz', 'SAL', '20190304', 52300], ['0012', 'Lee Chen', 'SVC', '20200615', 48900], ['0019', 'Amir Said', 'SVC', '20170109', 61250], ['0042', 'Jo Park', 'ADM', '20210920', 57400], ['0055', 'Maya Ortiz', 'SAL', '20230102', 50100]];
          const FILES = [
            { name: 'Employees', what: 'one record per employee', fields: [F('id', 'text', 4, 'employee number'), F('name', 'text', 'var', 'full name'), F('dept', 'text', 3, 'department code'), F('hired', 'date', 8, 'start date, YYYYMMDD'), F('salary', 'int', 4, 'yearly salary in dollars')], recs: emp },
            { name: 'Departments', what: 'one record per department', fields: [F('code', 'text', 3, 'department code'), F('title', 'text', 'var', 'department name'), F('floor', 'int', 1, 'floor number')], recs: [['SAL', 'Sales', 1], ['SVC', 'Service', 2], ['ADM', 'Administration', 3]] },
            { name: 'Payroll', what: 'one record per monthly payment', fields: [F('emp_id', 'text', 4, 'which employee was paid'), F('period', 'text', 6, 'pay month, YYYYMM'), F('gross', 'int', 4, 'gross pay in dollars')], recs: emp.map((e) => [e[0], '202609', Math.round(e[4] / 12)]) },
          ];
          const flen = (f, v) => (f.len === 'var' ? 1 + String(v).length : f.len);
          const recLen = (file, r) => file.fields.reduce((a, f, k) => a + flen(f, r[k]), 0);
          const LEVELS = ['Database', 'File', 'Record', 'Field'];
          const DEF = [
            ['<span class="t">Database</span>', 'A collection of related data in which the relationships between elements are recorded explicitly, built to serve one or more applications.', ['Run by a <span class="t" data-t="database management system">DBMS</span>, a separate program on top of the OS, not part of it.', 'The DBMS usually keeps its data in files; the OS stores those files without knowing about the relationships.']],
            ['<span class="t">File</span>', 'A collection of similar records that users and programs treat as one entity, referred to by a unique name.', ['It is created, deleted, opened and protected as a whole.', 'Access control usually works at file level: you may read all of Employees or none of it. (A DBMS can protect single records or fields.)']],
            ['<span class="t">Record</span>', 'A collection of related fields that a program treats as a unit, such as everything about one employee.', [`Fixed-length if every field is fixed: each Payroll record is ${recLen(FILES[2], FILES[2].recs[0])} bytes.`, `Variable-length if any field varies, or if the number of fields varies: an Employees record is ${recLen(FILES[0], FILES[0].recs[0]) - FILES[0].recs[0][1].length} bytes plus the name's characters.`]],
            ['<span class="t">Field</span>', 'The basic element of data: one value, with a type and a length.', ['A fixed-length field always takes the same number of bytes.', 'A variable-length field needs a way to find its end: here a length byte in front; some formats use an end marker instead.']],
          ];
          let lv = 0, fi = 0, ri = 0, di = 0;
          const ladder = ctx.$('.ladder'), zdef = ctx.$('.zdef'), crumbs = ctx.$('.crumbs'), view = ctx.$('.zview'), hint = ctx.$('.zhint');
          const rungs = LEVELS.map((L, k) => h('button', { class: 'btn', type: 'button', onclick: () => go(k) }, h('span', { class: 'lv' }, String(k + 1)), L));
          ladder.append(...rungs);
          const show = (f, v) => (f.name === 'salary' || f.name === 'gross' ? '$' + v.toLocaleString('en-US') : String(v));
          const sib = (label, items, cur, pick) => h('div', { class: 'row gap-s' }, h('span', { class: 'small b' }, label), ...items.map((t, k) => h('button', { class: 'btn sm' + (k === cur ? ' on' : ''), type: 'button', 'aria-pressed': String(k === cur), onclick: () => pick(k) }, t)));
          function go(k, f, r, d) {
            if (f != null) fi = f; if (r != null) ri = r; if (d != null) di = d;
            lv = k; ri = Math.min(ri, FILES[fi].recs.length - 1); di = Math.min(di, FILES[fi].fields.length - 1);
            draw();
          }
          function draw() {
            rungs.forEach((b, k) => b.classList.toggle('on', k === lv));
            const [nm, def, facts] = DEF[lv];
            zdef.innerHTML = `<div class="b" style="font-size:18px">${nm}</div><div class="small">${def}</div><ul class="small m0" style="padding-left:18px">${facts.map((x) => '<li>' + x + '</li>').join('')}</ul>`;
            const file = FILES[fi], rec = file.recs[ri], fld = file.fields[di];
            const parts = ['Lakeside Bikes database', file.name, 'record ' + rec[0], 'field ' + fld.name].slice(0, lv + 1);
            crumbs.innerHTML = '';
            parts.forEach((p, k) => {
              if (k) crumbs.append(h('span', { class: 'muted' }, '›'));
              crumbs.append(k === lv ? h('span', { class: 'cur' }, p) : h('button', { type: 'button', onclick: () => go(k) }, p));
            });
            view.innerHTML = '';
            if (lv === 0) {
              view.append(
                h('div', { class: 'grid-3', style: { gap: '8px' } }, ...FILES.map((x, k) => h('button', { class: 'fcard', type: 'button', onclick: () => go(1, k, 0, 0) },
                  h('span', { class: 'nm' }, x.name), h('span', {}, x.recs.length + ' records, ' + x.what), h('span', { class: 'flds' }, x.fields.map((q) => q.name).join(' · '))))),
                h('div', { class: 'card tight', html: '<b>Relationships the DBMS keeps</b><div class="mono small" style="margin-top:4px">Payroll.emp_id → Employees.id<br>Employees.dept → Departments.code</div><div class="small muted" style="margin-top:4px">Every payment points to a real employee, and every employee to a real department. These explicit links are what turn three files into a database.</div>' }),
                h('div', { class: 'card tight io small', html: '<b>What the OS sees:</b> just named files full of bytes, such as employees.dat, departments.dat and payroll.dat. It stores and protects them, but the arrows above exist only inside the DBMS.' }));
              hint.textContent = 'Click a file to zoom in.';
            } else if (lv === 1) {
              const tb = h('table', { class: 'tbl compact' });
              tb.append(h('tr', {}, ...file.fields.map((q) => h('th', {}, q.name))));
              file.recs.forEach((r, k) => {
                const tr = h('tr', { class: 'pick' + (k === ri ? ' on' : ''), tabindex: '0', role: 'button', 'aria-label': 'Open record ' + r[0], onclick: () => go(2, null, k, 0), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(2, null, k, 0); } } });
                tr.append(...r.map((v, j) => h('td', { class: 'mono' }, show(file.fields[j], v))));
                tb.append(tr);
              });
              const lens = file.recs.map((r) => recLen(file, r));
              const same = lens.every((x) => x === lens[0]);
              view.append(h('div', { class: 'small', html: `File <b>${file.name}</b>: ${file.recs.length} similar records, each with the same ${file.fields.length} fields. One name for the whole collection.` }), tb,
                h('div', { class: 'small muted', html: same ? `Every record is ${lens[0]} bytes: a file of fixed-length records.` : `Record lengths: ${lens.join(', ')} bytes, because one field varies in length.` }),
                sib('Other files:', FILES.map((x) => x.name), fi, (k) => go(1, k, 0, 0)));
              hint.textContent = 'Click a row (a record) to zoom in.';
            } else if (lv === 2) {
              const strip = h('div', { class: 'fstrip', style: ctx.narrow ? { flexWrap: 'wrap' } : {} }, ...file.fields.map((q, k) => {
                const n = flen(q, rec[k]);
                return h('button', { class: 'fbox' + (q.len === 'var' ? ' var' : ''), type: 'button', style: { flex: n + (ctx.narrow ? ' 1 auto' : ' 1 0') }, onclick: () => go(3, null, null, k) },
                  h('span', { class: 'xs b' }, q.name), h('span', { class: 'v' }, show(q, rec[k])), h('span', { class: 'xs muted' }, n + ' B' + (q.len === 'var' ? ' (var)' : '')));
              }));
              const sum = file.fields.map((q, k) => (q.len === 'var' ? `(1+${String(rec[k]).length})` : String(q.len))).join(' + ');
              const fixed = file.fields.every((q) => q.len !== 'var');
              view.append(h('div', { class: 'small', html: `Record <b>${rec[0]}</b> of ${file.name}: ${file.fields.length} related fields that a program reads and writes as one unit.` }), strip,
                h('div', { class: 'card tight', html: `<b>Length:</b> <span class="mono">${sum} = ${recLen(file, rec)} bytes</span><div class="small muted" style="margin-top:3px">${fixed ? 'All fields are fixed, so every record of this file has the same length.' : 'The dashed field varies, so this record\'s length depends on its data: a variable-length record.'}</div>` }),
                sib('Other records:', file.recs.map((x) => x[0]), ri, (k) => go(2, null, k, null)));
              hint.textContent = ctx.narrow ? 'Click a field to zoom in. Each box shows how many bytes its field uses.' : 'Click a field to zoom in. Box widths follow the bytes each field uses.';
            } else {
              const v = rec[di], cells = h('div', { class: 'cells' });
              if (fld.type === 'int') {
                const hex = v.toString(16).toUpperCase().padStart(fld.len * 2, '0');
                for (let k = 0; k < fld.len; k++) cells.append(h('span', {}, hex.slice(2 * k, 2 * k + 2)));
              } else {
                if (fld.len === 'var') cells.append(h('span', { class: 'len', title: 'length byte' }, String(String(v).length)));
                for (const ch of String(v)) cells.append(h('span', {}, ch === ' ' ? '·' : ch));
              }
              const how = fld.type === 'int' ? `a ${fld.len}-byte binary number, shown here in hexadecimal (${v} = 0x${v.toString(16).toUpperCase()})`
                : fld.len === 'var' ? `a length byte (${String(v).length}) followed by ${String(v).length} characters, so the program knows where the field ends`
                : `exactly ${fld.len} characters, always`;
              view.append(h('div', { class: 'small', html: `Field <b>${fld.name}</b> (${fld.desc}) of record ${rec[0]}: a single value.` }),
                h('div', { class: 'big mono', style: { fontSize: ctx.narrow ? '30px' : null, overflowWrap: 'anywhere' } }, show(fld, v)),
                h('div', { class: 'small b' }, 'The bytes on disk:'), cells,
                h('div', { class: 'card tight small', html: `<b>${fld.len === 'var' ? 'Variable' : 'Fixed'} length.</b> Stored as ${how}.` }),
                sib('Other fields:', file.fields.map((x) => x.name), di, (k) => go(3, null, null, k)));
              hint.textContent = 'Use the breadcrumb or the ladder to zoom back out, or try another field.';
            }
          }
          draw();
        },
      },
      {
        title: 'Bytes or records: who decides the structure?',
        kind: 'compare',
        core: true,
        html: `
          <div class="split l fill">
            <div class="stack" style="gap:8px">
              <p class="lead m0">Who decides where one record ends and the next begins?</p>
              <p class="m0">UNIX, Linux and Windows treat an ordinary file as a <span class="t">byte stream</span>: bytes numbered 0, 1, 2, … and nothing more. Records exist only inside the programs that use the file.</p>
              <p class="m0 small">The payroll program knows each record is 20 bytes: id (4), name (10), pay (6). To read record <i>k</i> it asks the OS for 20 bytes starting at byte 20 × <i>k</i>.</p>
              <div class="callout why m0" data-label="Why it matters">One small set of calls serves text, photos and databases alike, so the OS stays simple and general. The price: every program that touches the file must agree on its layout.</div>
              <div class="callout warn m0" data-label="Common mistake">Thinking the OS knows your records. Read with the wrong layout and the OS still hands over the bytes; the garbage is the program's problem.</div>
              <p class="xs muted m0">Not every system works this way: IBM mainframe data sets (z/OS), for example, declare a record format and record length that the system itself uses.</p>
            </div>
            <div class="card stack bs-lab" style="gap:8px"></div>
          </div>`,
        render(el, ctx) {
          const { h } = ctx;
          const RECS = ['0007Rosa Diaz 052300', '0012Lee Chen  048900', '0019Amir Said 061250', '0042Jo Park   057400'];
          const DATA = RECS.join('');
          const READERS = [
            { value: 'os', label: 'The OS' },
            { value: 'r20', label: 'Payroll program', size: 20, lay: [4, 10, 6] },
            { value: 'r16', label: 'Program expecting 16', size: 16, lay: [4, 8, 4] },
          ];
          let mode = 'r20', pick = 3;
          const lab = ctx.$('.bs-lab');
          const seg = ctx.ui.seg(READERS.map((r) => ({ value: r.value, label: r.label })), mode, (v) => { mode = v; const R = cur(); if (R.size) pick = Math.min(pick, Math.floor(DATA.length / R.size) - 1); draw(); });
          const grid = h('div', { class: 'bgrid', 'aria-label': 'The 80 bytes of payroll.dat' });
          const legend = h('div', { class: 'small' });
          const pickRow = h('div', { class: 'row gap-s' });
          const tableBox = h('div', {});
          const narr = h('div', { class: 'narr', 'aria-live': 'polite' });
          lab.append(h('div', { class: 'row gap-s' }, h('span', { class: 'small b' }, 'Who reads payroll.dat?'), seg), legend, grid, pickRow, tableBox, narr);
          const cur = () => READERS.find((r) => r.value === mode);
          const okNum = (t) => /^[0-9]+$/.test(t);
          const okName = (t) => /^[A-Za-z][A-Za-z ]*$/.test(t);
          function parse(R) {
            const out = [];
            for (let s = 0; s + R.size <= DATA.length; s += R.size) {
              const a = DATA.slice(s, s + R.lay[0]), b = DATA.slice(s + R.lay[0], s + R.lay[0] + R.lay[1]), c = DATA.slice(s + R.lay[0] + R.lay[1], s + R.size);
              out.push({ s, f: [a, b, c], ok: [okNum(a), okName(b), okNum(c)] });
            }
            return out;
          }
          function draw() {
            const R = cur();
            grid.innerHTML = '';
            const recs = R.size ? parse(R) : [];
            const sel = R.size ? recs[pick] : null;
            for (let row = 0; row * 16 < DATA.length; row++) {
              grid.append(h('div', { class: 'off' }, String(row * 16)));
              for (let k = row * 16; k < row * 16 + 16; k++) {
                let cls = 'b';
                if (R.size) {
                  const o = k % R.size;
                  cls += o < R.lay[0] ? ' f0' : o < R.lay[0] + R.lay[1] ? ' f1' : ' f2';
                  if (o === 0) cls += ' st';
                  if (sel) cls += k >= sel.s && k < sel.s + R.size ? ' sel' : ' dim';
                }
                grid.append(h('div', { class: cls, title: 'byte ' + k }, DATA[k] === ' ' ? '·' : DATA[k]));
              }
            }
            legend.innerHTML = R.size ? `This program's layout:<span class="tk3 f0"></span>id ${R.lay[0]}<span class="tk3 f1"></span>name ${R.lay[1]}<span class="tk3 f2"></span>pay ${R.lay[2]} = ${R.size} bytes per record` : `${DATA.length} bytes, numbered 0 to ${DATA.length - 1}, shown 16 to a row. (· is a space.)`;
            pickRow.innerHTML = '';
            tableBox.innerHTML = '';
            if (!R.size) {
              narr.className = 'narr';
              narr.innerHTML = `To the OS, payroll.dat is just ${DATA.length} bytes. Nothing marks where a record starts; the 16-per-row layout here is only for display. A read request says “give me <i>n</i> bytes starting at byte <i>p</i>”, and the OS does exactly that.`;
              return;
            }
            pickRow.append(h('span', { class: 'small b' }, 'Read record:'), ...recs.map((r, k) => h('button', { class: 'btn sm' + (k === pick ? ' on' : ''), type: 'button', 'aria-pressed': String(k === pick), onclick: () => { pick = k; draw(); } }, String(k))));
            const tb = h('table', { class: 'tbl compact ptab' });
            const wide = !ctx.narrow;
            tb.append(h('tr', {}, h('th', {}, '#'), wide ? h('th', {}, 'bytes') : null, h('th', {}, 'id'), h('th', {}, 'name'), h('th', {}, 'pay')));
            recs.forEach((r, k) => tb.append(h('tr', { class: k === pick ? 'on' : '' }, h('td', {}, String(k)), wide ? h('td', {}, `${r.s}–${r.s + R.size - 1}`) : null,
              ...r.f.map((t, j) => h('td', { class: 'mono' + (r.ok[j] ? '' : ' bad') }, '“' + t + '”')))));
            tableBox.append(tb);
            const bad = recs.reduce((a, r) => a + r.ok.filter((x) => !x).length, 0);
            const fake = recs.findIndex((r, k) => k > 0 && r.ok[0]);
            narr.className = 'narr ' + (bad ? 'bad' : 'ok');
            narr.innerHTML = `Record ${pick}: the program asks the OS for <b>${R.size} bytes at offset ${R.size} × ${pick} = ${sel.s}</b> and gets bytes ${sel.s}–${sel.s + R.size - 1}. ` + (bad
              ? `Same bytes, wrong layout: ${bad} of ${recs.length * 3} fields fail a simple format check (red); the other ${recs.length * 3 - bad} pass but mostly hold the wrong data${fake > 0 ? `, such as record ${fake}'s id “${recs[fake].f[0]}”` : ''}. The OS cannot notice.`
              : `Every field parses cleanly because this program's layout matches the one the file was written with.`);
          }
          draw();
        },
      },
      {
        title: 'What the file system owes the system and each user',
        kind: 'explore',
        html: `
          <div class="stack fill" style="gap:8px">
            <p class="m0">Two lists say what a <span class="t">file management system</span> must deliver. Its <b>objectives</b> are qualities of the whole system that its designers aim for. Its <b>minimal user requirements</b> are things each user of an interactive, general-purpose system must be able to do. Sort each statement into its list.</p>
            <div class="sorter grow"></div>
          </div>`,
        render(el, ctx) {
          const { h } = ctx;
          const OBJ = [
            ['Meet the data management needs of its users', 'A goal for the system as a whole: store data and carry out whatever operations users need on it.'],
            ['Keep the data in files valid, as far as possible', 'Validity is a promise the system makes about all stored data, not an action one user takes.'],
            ['Optimize performance: system throughput and user response time', 'Performance is a system-wide design goal: high throughput for the system and quick response for each user.'],
            ['Support I/O on many types of storage device', 'Disks, SSDs, tape and more must all work; that is a design goal, so users need not care which device holds a file.'],
            ['Minimize the chance of lost or destroyed data', 'Guarding against loss is a system goal. Its user-side partner is being able to back up and recover files.'],
            ['Offer a standard set of I/O interface routines', 'One uniform set of calls (open, read, write…) lets every program use files without device-specific code.'],
            ['Support I/O for multiple users (on multiuser systems)', 'Serving many users at once, on multiuser systems, is a property of the whole system.'],
          ];
          const REQ = [
            ['Create, delete, read, write and modify files', 'The most basic abilities each user needs.'],
            ['Get controlled access to other users\' files', 'Something one user does: use a colleague\'s file within the limits set for it.'],
            ['Control what access others have to one\'s own files', 'The owner\'s side of sharing: each user decides who may read or change their files.'],
            ['Restructure files to suit the problem', 'A user-level ability: reorganize a file when the way it is used changes.'],
            ['Move data between files', 'A user-level ability: copy or transfer data from one file to another.'],
            ['Back up files and recover them after damage', 'Each user must be able to protect their own files and restore them.'],
            ['Refer to files by symbolic name, not numeric identifier', 'Users think in names such as payroll.dat; the system translates names into its own identifiers.'],
          ];
          const ORDER = [[0, 1], [1, 0], [0, 3], [1, 6], [0, 4], [1, 5], [0, 5], [1, 2], [0, 0], [1, 1], [0, 2], [1, 3], [0, 6], [1, 4]];
          const LISTS = [OBJ, REQ];
          let idx, placed, mistakes;
          const box = ctx.$('.sorter');
          if (!ctx.narrow) box.style.gridTemplateColumns = 'minmax(0, 1fr) 320px minmax(0, 1fr)';
          const cols = [0, 1].map((b) => h('div', { class: 'slots ' + (b ? 'r' : 'o') }));
          const counter = h('div', { class: 'small muted' });
          const stmt = h('div', { class: 'stmt' });
          const narr = h('div', { class: 'narr', 'aria-live': 'polite' });
          const bO = h('button', { class: 'btn os', type: 'button', onclick: () => choose(0) }, ctx.narrow ? 'System objective' : '← System objective');
          const bR = h('button', { class: 'btn proc', type: 'button', onclick: () => choose(1) }, ctx.narrow ? 'User requirement' : 'User requirement →');
          const bFill = h('button', { class: 'btn ghost sm', type: 'button', onclick: fillAll }, 'Fill in the rest');
          const bReset = h('button', { class: 'btn ghost sm', type: 'button', onclick: reset }, 'Reset');
          const mid = h('div', { class: 'card stack', style: { gap: '10px' } }, counter, stmt, h('div', { class: 'stack', style: { gap: '6px' } }, bO, bR), narr, h('div', { class: 'row gap-s', style: { marginTop: 'auto' } }, bFill, bReset));
          if (ctx.narrow) box.append(mid, cols[0], cols[1]); else box.append(cols[0], mid, cols[1]);
          function reset() { idx = 0; placed = [new Set(), new Set()]; mistakes = 0; narr.className = 'narr'; narr.innerHTML = 'Rule of thumb: an objective describes the system as a whole; a requirement is an ability one user must have.'; draw(); }
          function choose(b) {
            if (idx >= ORDER.length) return;
            const [bk, k] = ORDER[idx], [txt, why] = LISTS[bk][k];
            if (b === bk) {
              placed[bk].add(k); idx++;
              narr.className = 'narr ok';
              narr.innerHTML = `<b>Yes, a ${bk ? 'user requirement' : 'system objective'}.</b> ${why}`;
              draw(bk, k);
              if (idx >= ORDER.length) { narr.innerHTML += ` <b>All ${ORDER.length} sorted${mistakes ? ` with ${mistakes} slip${mistakes === 1 ? '' : 's'}` : ' with no slips'}.</b>`; }
            } else {
              mistakes++;
              narr.className = 'narr bad';
              narr.innerHTML = `<b>Not quite.</b> “${txt}” is a ${bk ? 'user requirement' : 'system objective'}. ${why} Try the other button.`;
            }
          }
          function fillAll() { while (idx < ORDER.length) { const [bk, k] = ORDER[idx++]; placed[bk].add(k); } narr.className = 'narr'; narr.innerHTML = 'Both lists are complete. Read them top to bottom: seven goals for the system, seven abilities for every user.'; draw(); }
          function draw(fb, fk) {
            cols.forEach((c, b) => {
              c.innerHTML = '';
              c.append(h('div', { class: 'hd' }, b ? 'Minimal user requirements' : 'Objectives of the system'));
              LISTS[b].forEach((it, k) => {
                const full = placed[b].has(k);
                c.append(h('div', { class: 'slot' + (full ? ' full' : '') + (full && fb === b && fk === k ? ' flash' : '') }, h('span', { class: 'n' }, String(k + 1)), full ? it[0] : '…'));
              });
            });
            const done = idx >= ORDER.length;
            counter.textContent = done ? 'Finished' : `Statement ${idx + 1} of ${ORDER.length}` + (mistakes ? ` · slips: ${mistakes}` : '');
            stmt.textContent = done ? 'Every statement is in its list.' : LISTS[ORDER[idx][0]][ORDER[idx][1]][0];
            bO.disabled = bR.disabled = bFill.disabled = done;
          }
          reset();
        },
      },
      {
        title: 'Five layers between a program and the disk',
        kind: 'explore',
        core: true,
        html: `
          <div class="split l fill">
            <div class="stack" style="gap:8px">
              <p class="m0 small">File system software is built in layers. Each layer uses only the one below and offers a simpler service to the one above. Click a layer, or play a request for <b>record ${PAY.want} of payroll</b> down the stack and back.</p>
              <div class="lstack"></div>
              <p class="xs muted m0">Name clash: section 11.3's I/O model also has a “logical I/O” layer, but there it is the top layer that treats a whole device as a logical resource. Here it is the record layer.</p>
            </div>
            <div class="stack" style="gap:8px">
              <div class="small b">What this layer sees</div>
              <div class="sees"></div>
              <div class="card tight stack ldut" style="gap:4px"></div>
              <div class="log grow ltrace" aria-label="Trace of the request so far"></div>
              <div class="pl-slot"></div>
            </div>
          </div>`,
        render(el, ctx) {
          const { h } = ctx;
          const P = PAY, sec0 = P.disk0 * (P.blockSize / 512);
          const LAYERS = [
            { key: 'am', cls: 'am', name: 'Access method', term: 'access method', u: 'records, by structure', duties: ['The level closest to the user: the standard interface between applications and the file system.', 'Different access methods suit different file structures: pile, sequential, indexed sequential, indexed, hashed (section 12.2).', 'It knows how records are arranged and found in this kind of file.'] },
            { key: 'lio', cls: '', name: 'Logical I/O', term: 'logical I/O', u: 'records', duties: ['Lets users and applications work with records instead of blocks: general-purpose record I/O.', 'Keeps basic data about each file, such as its record size and organization.'] },
            { key: 'sup', cls: '', name: 'Basic I/O supervisor', term: 'basic I/O supervisor', u: 'I/O operations', duties: ['Starts and ends every file I/O operation.', 'Keeps control structures for device I/O, scheduling and file status.', 'Selects the device, schedules disk accesses for performance, and assigns I/O buffers and secondary storage.'] },
            { key: 'bfs', cls: '', name: 'Basic file system', term: 'basic file system', sub: 'physical I/O', u: 'blocks', duties: ['Exchanges whole blocks with secondary storage.', 'Decides where blocks are placed on the device and buffers them in main memory.', 'Does not understand the data or the structure of the file it moves.'] },
            { key: 'drv', cls: '', name: 'Device drivers', term: 'device driver', u: 'device commands', duties: ['The lowest level: talk directly to the device controllers.', 'Start I/O operations on a device and handle their completion when the device interrupts.', 'Part of the OS, like the two layers above them.'] },
          ];
          const FR = [
            { L: 'prog', d: 1, sees: `read(payroll.dat, record ${P.want})`, cap: `<b>The request.</b> The payroll program wants record ${P.want} (records count from 0). It calls the file system and waits; it never mentions blocks or disks.` },
            { L: 0, d: 1, sees: `get record #${P.want} by position`, cap: `<b>Access method.</b> Payroll holds fixed-length records reached by position, so the matching access method treats “record ${P.want}” as a position, with no key search. It turns the call into a record request for the layer below.` },
            { L: 1, d: 1, sees: `record ${P.want} → file block ${P.blk}, bytes ${P.off}–${P.end}`, cap: `<b>Logical I/O.</b> From the file's basic data (records of ${P.recSize} bytes, <span class="t">blocks</span> of ${P.blockSize} bytes) it gets ${P.blockSize} ÷ ${P.recSize} = ${P.bf} records per block. Record ${P.want} is in block ⌊${P.want} ÷ ${P.bf}⌋ = ${P.blk}, starting at byte (${P.want} mod ${P.bf}) × ${P.recSize} = ${P.off}.` },
            { L: 2, d: 1, sees: `start I/O: payroll block ${P.blk} on ${P.disk}, buffer B5, queued`, cap: `<b>Basic I/O supervisor.</b> It starts the file I/O: selects the device that holds payroll (${P.disk}), assigns a main-memory buffer (B5) and puts the request in the disk's queue, where <span class="t">disk scheduling</span> decides when it runs. It records the operation in its control structures.` },
            { L: 3, d: 1, sees: `file block ${P.blk} = disk block ${P.disk0} → ${P.blockSize} bytes into B5`, cap: `<b>Basic file system.</b> It works only in blocks. It knows where each block of payroll sits on the disk: file block ${P.blk} is disk block ${P.disk0}. It moves those ${P.blockSize} bytes into buffer B5 without knowing they hold payroll records.` },
            { L: 4, d: 1, sees: `controller: READ sectors ${sec0}–${sec0 + P.blockSize / 512 - 1} into B5`, cap: `<b>Device driver.</b> With 512-byte sectors, disk block ${P.disk0} is sectors ${sec0}–${sec0 + P.blockSize / 512 - 1}. The driver gives the controller that command and the program stays blocked. When the transfer ends, the controller interrupts and the driver marks the I/O done.` },
            { L: 2, d: -1, sees: `I/O complete: B5 holds disk block ${P.disk0}`, cap: `<b>Back up: supervisor.</b> The basic file system reports the block is in B5, and the supervisor ends the I/O operation and updates its status records. The waiting program can be made ready again.` },
            { L: 1, d: -1, sees: `B5 bytes ${P.off}–${P.end} = record ${P.want}`, cap: `<b>Back up: logical I/O.</b> It takes bytes ${P.off}–${P.end} out of the ${P.blockSize}-byte block: exactly record ${P.want}. The other ${P.bf - 1} records in the block stay in the buffer, handy if the program reads its neighbours next.` },
            { L: 'prog', d: -1, sees: `record ${P.want} delivered (${P.recSize} bytes)`, cap: `<b>Done.</b> The access method hands record ${P.want} to the program. Five layers did the work, and the program never saw a block number, a buffer or a disk address.` },
          ];
          const stackEl = ctx.$('.lstack'), sees = ctx.$('.sees'), dut = ctx.$('.ldut'), trace = ctx.$('.ltrace');
          if (ctx.narrow) trace.style.maxHeight = '210px';
          const progBox = h('div', { class: 'lyr prog' }, h('span', { class: 'ar' }), h('span', { class: 'nm' }, 'Payroll program'), h('span', { class: 'u' }, 'application'));
          const btns = LAYERS.map((L, k) => h('button', { class: 'lyr ' + L.cls, type: 'button', onclick: () => player.go(FR.findIndex((f) => f.L === k)) },
            h('span', { class: 'ar' }), h('span', { class: 'nm', html: L.sub ? `${L.name} <span class="xs muted">(${L.sub})</span>` : L.name }), h('span', { class: 'u' }, L.u)));
          const diskBox = h('div', { class: 'lyr disk' }, h('span', { class: 'ar' }), h('span', { class: 'nm' }, 'Disk (' + P.disk + ')'), h('span', { class: 'u' }, 'hardware'));
          stackEl.append(progBox, ...btns, diskBox);
          function paint(i) {
            const f = FR[i];
            const all = [progBox, ...btns, diskBox];
            const on = f.L === 'prog' ? 0 : f.L + 1;
            all.forEach((b, k) => { b.classList.toggle('cur', k === on || (f.L === 4 && k === all.length - 1)); b.classList.toggle('dim', !(k === on || (f.L === 4 && k === all.length - 1))); b.querySelector('.ar').textContent = k === on ? (f.d > 0 ? '▼' : '▲') : ''; });
            sees.textContent = f.sees;
            const tag = (g) => (g.L === 'prog' ? 'Program' : LAYERS[g.L].name) + (g.d > 0 ? ' ▼' : ' ▲');
            trace.innerHTML = '';
            FR.slice(0, i + 1).forEach((g, k) => trace.append(h('div', { style: k === i ? { fontWeight: 800 } : {} }, `${k + 1}. ${tag(g)}  ${g.sees}`)));
            trace.scrollTop = trace.scrollHeight;
            const L = typeof f.L === 'number' ? LAYERS[f.L] : null;
            dut.innerHTML = L ? `<div class="b"><span class="t" data-t="${L.term}">${L.name}</span>: duties</div><ul class="duties">${L.duties.map((x) => '<li>' + x + '</li>').join('')}</ul>`
              : `<div class="b">The application</div><ul class="duties"><li>Thinks in records of its own files, such as “record ${P.want} of payroll”.</li><li>Uses the standard calls the access method offers, the same on every device.</li></ul>`;
            return f.cap;
          }
          const player = ctx.ui.player({ count: FR.length, render: paint, interval: 2600 });
          ctx.$('.pl-slot').append(player.el);
        },
      },
      {
        title: 'From a command to the disk: file management functions',
        kind: 'explore',
        html: `
          <div class="split l fill">
            <div class="stack" style="gap:8px">
              <p class="m0 small">The layer stack shows <i>who</i> does the work. This view lists <i>what</i> must happen to every file request, function by function. Pick a request and step through it.</p>
              <div class="fm-seg"></div>
              <div class="callout why m0 small" data-label="Why the order matters">The upper functions handle names, users and records: the view people have. The lower ones handle blocks and the disk: the view the hardware needs. <span class="t">Record blocking</span> is the bridge between them.</div>
              <div class="callout tip m0 small" data-label="Try this">Run all three requests. Which disk-side function does a read leave idle that an append needs? Where exactly does the guest's request stop, and what never happens?</div>
              <div class="grow"></div>
              <div class="fm-pl"></div>
            </div>
            <div class="card white stack" style="gap:4px">
              <div class="row" style="justify-content:space-between"><span class="side">LOGICAL VIEW: names, users, records</span></div>
              <div class="flow"></div>
              <div class="row" style="justify-content:space-between"><span class="side">PHYSICAL VIEW: blocks and the disk</span></div>
            </div>
          </div>`,
        render(el, ctx) {
          const { h } = ctx;
          const P = PAY;
          const ST = [
            ['cmd', 'User & program commands', 'u'], ['dir', '<span class="t">Directory management</span>', ''], ['acc', '<span class="t">User access control</span>', ''], ['am', 'Access method (record operations)', ''],
            ['blk', 'Record blocking', ''], ['ds', 'Disk scheduling', ''], ['fa', '<span class="t">File allocation</span>', ''], ['fs', '<span class="t">Free storage management</span>', ''], ['pio', 'Physical I/O', 'p'],
          ];
          const REQ = {
            read: [
              { on: { cmd: `read rec ${P.want}` }, cap: `<b>Command.</b> Ana's payroll program asks for record ${P.want} of payroll.dat. The request names a file and a record, nothing more.` },
              { on: { dir: 'found payroll.dat' }, cap: '<b>Directory management.</b> Before anything else the file must be identified and located: the name payroll.dat is looked up in the directory, which tells where the file and its attributes are.' },
              { on: { acc: 'ana: read ✓' }, cap: '<b>User access control.</b> Only authorized users may touch the file. Ana works in payroll and holds read access, so the request may go on. No data has moved yet.' },
              { on: { am: `record ${P.want}` }, cap: `<b>Access method.</b> Users work at the record level, and the file has a structure. The access method that suits that structure turns the command into a record operation: fetch record ${P.want} by position.` },
              { on: { blk: `block ${P.blk}, slot ${P.slot}` }, cap: `<b>Record blocking.</b> Programs see records, but I/O moves whole blocks. With ${P.bf} records per block, record ${P.want} is slot ${P.slot} of block ${P.blk}. That block must be read, then unblocked to pull the record out.` },
              { on: { fa: `blk ${P.blk} → ${P.disk0}`, fs: ['not needed', 'skip'], ds: 'read queued' }, cap: `<b>Disk side.</b> File allocation's map says payroll's block ${P.blk} is disk block ${P.disk0}. Free storage management has nothing to do, since no space is added. Disk scheduling queues the read and orders it among other pending requests.` },
              { on: { pio: `read ${P.blockSize} B` }, cap: `<b>Physical I/O.</b> Disk block ${P.disk0} is transferred into a main-memory buffer. The record is unblocked from it and returned to the program. Done.` },
            ],
            append: [
              { on: { cmd: 'append record' }, cap: `<b>Command.</b> Ana's program adds a new employee's pay record to the end of payroll.dat, which holds ${P.records} records now.` },
              { on: { dir: 'found payroll.dat' }, cap: '<b>Directory management.</b> The name is looked up to find the file. Afterwards the file\'s recorded size and last-modified time must be updated too.' },
              { on: { acc: 'ana: append ✓' }, cap: '<b>User access control.</b> Adding data needs more than read access. Ana may append to payroll.dat, so the request goes on.' },
              { on: { am: `new record ${P.records}` }, cap: `<b>Access method.</b> For this structure, new records go at the end, so the new record becomes record ${P.records} (records count from 0).` },
              { on: { blk: `block ${P.newBlk}, slot ${P.newSlot}` }, cap: `<b>Record blocking.</b> Records 0–${P.records - 1} fill blocks 0–${P.nBlocks - 1} exactly (${P.bf} per block), so record ${P.records} starts a fresh block ${P.newBlk}, in slot ${P.newSlot}. The record is placed in a buffer that will become that block.` },
              { on: { fs: `take ${P.freeBlock}`, fa: `blk ${P.newBlk} → ${P.freeBlock}`, ds: 'write queued' }, cap: `<b>Disk side.</b> The file needs space. Free storage management hands out free disk block ${P.freeBlock} and marks it used; file allocation records that payroll's block ${P.newBlk} lives there. Disk scheduling queues the write.` },
              { on: { pio: `write ${P.blockSize} B` }, cap: `<b>Physical I/O.</b> The buffer is written to disk block ${P.freeBlock}. The file now has ${P.records + 1} records in ${P.nBlocks + 1} blocks.` },
            ],
            guest: [
              { on: { cmd: `read rec ${P.want}` }, cap: `<b>Command.</b> A program running for the user “guest” asks for record ${P.want} of payroll.dat.` },
              { on: { dir: 'found payroll.dat' }, cap: '<b>Directory management.</b> The file exists and is found by name. Finding a file is not the same as being allowed to use it.' },
              { on: { acc: ['guest: denied', 'stop'] }, stop: true, cap: '<b>User access control: refused.</b> Guest has no read access to payroll.dat, so the request ends here with an error such as “permission denied”. Nothing below runs: no record is located, no block is read.' },
            ],
          };
          let rq = 'read';
          const flow = ctx.$('.flow');
          const boxes = {};
          const mk = ([k, nm, cls]) => (boxes[k] = h('div', { class: 'fbx ' + cls }, h('span', { class: 'nm', html: nm }), h('span', { class: 'res' })));
          const arrow = () => h('div', { class: 'farr', 'aria-hidden': 'true' }, '▼');
          flow.append(mk(ST[0]), arrow(), mk(ST[1]), arrow(), mk(ST[2]), arrow(), mk(ST[3]), arrow(), mk(ST[4]), arrow(),
            h('div', { class: 'trio', style: ctx.narrow ? { gridTemplateColumns: '1fr' } : {} }, mk(ST[5]), mk(ST[6]), mk(ST[7])), arrow(), mk(ST[8]));
          function paint(i) {
            const fr = REQ[rq];
            const state = {};
            fr.slice(0, i + 1).forEach((f) => Object.entries(f.on).forEach(([k, v]) => { state[k] = Array.isArray(v) ? { t: v[0], c: v[1] } : { t: v, c: 'done' }; }));
            const stopped = fr.slice(0, i + 1).some((f) => f.stop);
            ST.forEach(([k]) => {
              const b = boxes[k], s = state[k];
              const cur = Object.prototype.hasOwnProperty.call(fr[i].on, k);
              b.className = b.className.replace(/\s(idle|done|skip|stop|cur)\b/g, '');
              b.classList.add(s ? s.c : stopped ? 'skip' : 'idle');
              if (cur) b.classList.add('cur');
              b.querySelector('.res').textContent = s ? s.t : stopped ? 'never reached' : '';
            });
            return fr[i].cap;
          }
          const player = ctx.ui.player({ count: REQ[rq].length, render: paint, interval: 2600, speed: false });
          const seg = ctx.ui.seg([{ value: 'read', label: `Read record ${P.want}` }, { value: 'append', label: 'Append a record' }, { value: 'guest', label: 'Guest reads' }], rq, (v) => { rq = v; player.stop(); player.setCount(REQ[rq].length); });
          ctx.$('.fm-seg').append(seg);
          ctx.$('.fm-pl').append(player.el);
        },
      },
      {
        title: 'Recap: six things to remember',
        kind: 'recap',
        render(el, ctx) {
          el.append(ctx.h('div', { class: 'stack fill' },
            ctx.h('p', { class: 'lead m0' }, 'Say each answer out loud, then click the card to check yourself.'),
            ctx.ui.flipcards([
              ['What three properties make files useful?', '<b>Long-term existence</b>: they outlive programs, logoffs and power-offs. <b>Sharable</b>: other processes find them by name, under access control. <b>Structure</b>: organized for the application, and grouped into hierarchies.'],
              ['Field, record, file, database?', '<b>Field</b>: one value. <b>Record</b>: related fields handled as a unit. <b>File</b>: similar records under one unique name. <b>Database</b>: related data with explicit relationships, run by a DBMS that is not part of the OS.'],
              ['Who knows where records begin in a UNIX or Windows file?', 'Only the application. The OS sees a <b>byte stream</b> and serves requests like “n bytes starting at byte p”. Read with the wrong layout and you get garbage.'],
              ['The five layers, from the user down?', '<b>Access method</b> → <b>logical I/O</b> (records) → <b>basic I/O supervisor</b> (starts I/O, picks device, schedules, buffers) → <b>basic file system</b> (blocks) → <b>device drivers</b> (controllers).'],
              ['Objectives versus user requirements?', 'Objectives are goals for the whole system: meet users\' needs, valid data, performance, many devices, no lost data, a standard interface, many users. Requirements are abilities each user needs, from creating files to backup and access by name.'],
              ['The path of a file request?', 'Commands → directory management → user access control → access method → record blocking → disk scheduling, file allocation, free storage management → physical I/O.'],
            ], { cols: 3, height: 228 })));
        },
      },
      {
        title: 'Check yourself',
        kind: 'check',
        quiz: [
          { q: 'Which property of files means that a file is still there after the program that created it exits and the computer is restarted?',
            choices: ['Sharing between many processes', 'A structure suited to the application', 'Long-term existence on storage', 'Access control set by its owner'], answer: 2,
            feedback: ['Sharing is about other processes finding and using the file by name, not about surviving a restart.', 'Structure is about how the data inside is organized; it does not keep the file around.', null, 'Access control decides who may use the file. It does not make the file survive.'],
            why: 'Files live on secondary storage such as a disk, which keeps its contents without power, so a file persists until someone deletes it.' },
          { type: 'bucket', q: 'Sort each item into the level of data it describes.', buckets: ['Field', 'Record', 'File', 'Database'],
            items: [['One employee\'s hire date', 0], ['All the facts about one employee, handled as a unit', 1], ['Every employee\'s record, kept under the name employees.dat', 2], ['Employee, department and payroll data with explicit links between them', 3], ['The price of one product', 0], ['One order: customer, date and items, handled as a unit', 1]],
            why: 'A field is one value, a record is related fields treated as a unit, a file is a named collection of similar records, and a database adds explicit relationships among its data.' },
          { type: 'tf', q: 'In UNIX and Windows, the operating system keeps track of where each record in an ordinary file begins and ends.', answer: false,
            why: 'Both treat an ordinary file as a stream of bytes. Any record structure is known only to the applications that read and write the file.' },
          { type: 'num', q: 'A program keeps fixed-length 20-byte records in an ordinary byte-stream file, numbering the records from 0. At what byte offset does record 3 begin?', answer: 60, tol: 0, unit: 'bytes',
            why: 'Record k starts at k × record size, so record 3 starts at 3 × 20 = 60 and occupies bytes 60 to 79.' },
          { type: 'num', q: 'A file holds 256-byte records packed into 4096-byte blocks, with no record split across two blocks. Records and blocks are both numbered from 0. In which block of the file is record 42?', answer: 2, tol: 0,
            why: '4096 ÷ 256 = 16 records fit in each block. Record 42 is in block ⌊42 ÷ 16⌋ = 2, as the record at position 42 mod 16 = 10 inside it.' },
          { type: 'order', q: 'Put the layers of file system software in order, from the one closest to the user down to the one closest to the hardware.', items: ['Access method', 'Logical I/O', 'Basic I/O supervisor', 'Basic file system (physical I/O)', 'Device drivers'],
            why: 'Applications call the access method; logical I/O works in records; the basic I/O supervisor starts and schedules I/O; the basic file system moves blocks; device drivers talk to the hardware.' },
          { type: 'match', q: 'Match each file system layer to its main job.',
            pairs: [['Device drivers', 'Command the device controllers and handle the completion of each I/O'], ['Basic file system', 'Move whole blocks to and from storage without understanding them'], ['Basic I/O supervisor', 'Start and end file I/O, pick the device, schedule disk access'], ['Logical I/O', 'Give programs record-level access and keep basic data on each file'], ['Access method', 'Offer applications a standard interface that suits the file structure']],
            why: 'Each layer hides the details of the one below: commands become blocks, blocks become records, and records reach applications through an access method.' },
          { type: 'bucket', q: 'Is each statement an objective of the file management system as a whole, or a minimal requirement of each user?', buckets: ['System objective', 'User requirement'],
            items: [['Guarantee, as far as possible, that the data in files are valid', 0], ['Optimize throughput and response time', 0], ['Provide a standard set of I/O interface routines to processes', 0], ['Back up files and recover them after damage', 1], ['Refer to files by symbolic name', 1], ['Control what access others have to one\'s own files', 1]],
            why: 'Objectives describe qualities the designers want for the whole system; user requirements are abilities each individual user must have.' },
          { q: 'A program running for a user with no rights to a protected file asks to read it. At which file management function is the request refused?',
            choices: ['Directory management', 'User access control', 'Disk scheduling', 'Record blocking'], answer: 1,
            feedback: ['Directory management only finds the file by name. Finding a file is not permission to use it.', null, 'Disk scheduling only orders block requests; a refused request never reaches it.', 'Record blocking deals with packing records into blocks; a refused request never gets that far.'],
            why: 'User access control runs right after the file is located and before any record or block is touched, so an unauthorized request stops there.' },
          { type: 'multi', q: 'A program asks for one record of an existing file, by the file\'s name, and is allowed to read it. The block that holds the record is not yet in main memory, and the file neither grows nor shrinks. Which of these file management functions take part in carrying out the request?', choices: ['Directory management', 'Free storage management', 'Record blocking', 'Disk scheduling'], answer: [0, 2, 3],
            why: 'The file must be found by name, its block read and unblocked, and the disk request scheduled. Free storage management acts only when space is given to or taken back from a file, which a read does not do.' },
          { q: 'Which statement about a database is correct?',
            choices: ['It is built into the OS file system, which stores the links between its files', 'It is any large file in which every record has the same fixed length', 'It is a folder that groups related files so the OS can search them', 'It is run by a separate DBMS and records explicit links among its data'], answer: 3,
            feedback: ['The OS file system knows nothing of the relationships; a DBMS, which is separate from the OS, manages them.', 'Record length has nothing to do with it; a database is defined by the explicit relationships among its data.', 'A folder groups files by name only; it records no relationships among the data inside them.', null],
            why: 'A database is a collection of related data with explicit relationships among its elements, managed by a database management system that is separate from the operating system.' },
          { type: 'tf', q: 'The basic file system layer moves whole blocks between storage and main-memory buffers without understanding what those blocks contain.', answer: true,
            why: 'The basic file system deals only in blocks. Records and file structure are the business of logical I/O and the access methods above it.' },
        ],
      },
    ],
    notes: `
<h3>What a file is</h3>
<p>A program's variables disappear when it ends. A <b>file</b> is a named collection of data, created by an application and kept by the OS on secondary storage (disk or SSD), so it outlives the program that made it. Three properties make files useful:</p>
<ul>
  <li><b>Long-term existence (persistence).</b> The file stays on secondary storage through program exits, logoffs and power cycles, until someone deletes it.</li>
  <li><b>Sharable between processes.</b> A file has a name, so other processes and users can find it; access controls decide who may do what with it.</li>
  <li><b>Structure.</b> The data inside is organized to suit the application, and files can be organized into hierarchies (folders) and related to one another.</li>
</ul>
<p>The OS software that provides these services is the <b>file management system</b>; programs reach file data only through it. Six basic operations: <b>create</b> (a new, empty file and its directory entry), <b>delete</b> (remove the entry and free the space), <b>open</b> (find the file by name in the directory, check access rights, set up an open-file record and give the process a file descriptor with a position of 0), <b>close</b> (discard the open-file record; the file itself stays), <b>read</b> and <b>write</b> (move data at the current position, which then advances). Open files are main-memory state and vanish at a restart; the file on disk does not (though real systems may cache the newest writes in memory for a while, by default up to about 30 seconds on Linux, so a power cut can lose them). Deleting an open file differs: Windows normally refuses; UNIX removes the name at once and frees the data after the last close.</p>

<h3>Fields, records, files and databases</h3>
<table>
  <tr><th>Level</th><th>What it is</th><th>Example</th></tr>
  <tr><td>Field</td><td>The basic element of data: one value with a type and a length. Fixed-length fields always use the same number of bytes; variable-length fields need a length count in front or an end marker.</td><td>an employee's hire date</td></tr>
  <tr><td>Record</td><td>Related fields that a program treats as a unit. Fixed-length if every field is fixed; variable-length if a field varies or the number of fields varies.</td><td>everything about one employee</td></tr>
  <tr><td>File</td><td>A collection of similar records treated as one entity, with a unique name. Created, deleted and protected as a whole; access control usually works at file level.</td><td>employees.dat</td></tr>
  <tr><td>Database</td><td>A collection of related data whose relationships are explicit, built for one or more applications. Managed by a <b>DBMS</b>, a separate program on top of the OS, which usually keeps its data in ordinary files.</td><td>employees, departments and payroll, linked</td></tr>
</table>
<p>Example: an Employees record with id (4 bytes), name (1 length byte + characters), dept (3), hire date (8) and salary (4-byte integer) is 20 bytes plus the name's characters, so "Rosa Diaz" gives 4 + (1+9) + 3 + 8 + 4 = 29 bytes: a variable-length record. A Payroll record of emp_id (4), period (6) and gross pay (4) is always 14 bytes: fixed-length.</p>

<h3>Byte streams: who decides the structure?</h3>
<p>UNIX, Linux and Windows treat an ordinary file as a <b>byte stream</b>: bytes numbered from 0 with no structure the OS knows about. A read request simply says "n bytes starting at byte p". Records exist only in the programs that use the file. With fixed-length records of size R, numbered from 0, record k starts at byte k × R. <i>Worked example:</i> 20-byte records, so record 3 starts at 3 × 20 = 60 and occupies bytes 60 to 79. A program that assumes the wrong layout (say 16-byte records) still gets the bytes, but splits them in the wrong places; the OS cannot notice. Benefit: one simple interface for every kind of file. Cost: every program must agree on the layout. Not every system works this way: IBM mainframe data sets (z/OS), for example, declare a record format and length that the system itself uses.</p>

<h3>Objectives of a file management system</h3>
<ol>
  <li>Meet the data management needs of its users (store data and perform the operations they need).</li>
  <li>Guarantee, as far as possible, that the data in files are valid.</li>
  <li>Optimize performance: throughput for the whole system and response time for each user.</li>
  <li>Provide I/O support for a variety of storage device types.</li>
  <li>Minimize or eliminate the potential for lost or destroyed data.</li>
  <li>Provide a standardized set of I/O interface routines to user processes.</li>
  <li>Provide I/O support for multiple users, on multiuser systems.</li>
</ol>
<h3>Minimal user requirements (interactive, general-purpose system)</h3>
<ol>
  <li>Create, delete, read, write and modify files.</li>
  <li>Have controlled access to other users' files.</li>
  <li>Control what types of access are allowed to one's own files.</li>
  <li>Restructure files in a form suited to the problem.</li>
  <li>Move data between files.</li>
  <li>Back up files and recover them if they are damaged.</li>
  <li>Access files by symbolic name rather than by numeric identifier.</li>
</ol>
<p>Rule of thumb: an objective is a quality of the whole system; a requirement is an ability each user must have.</p>

<h3>File system software architecture (five layers)</h3>
<p>Each layer uses only the one below and offers a simpler service to the one above. From the user down:</p>
<ol>
  <li><b>Access method</b>: the level closest to the user; the standard interface between applications and the file system. Different access methods suit different file structures (pile, sequential, indexed sequential, indexed, hashed).</li>
  <li><b>Logical I/O</b>: lets programs work with records rather than blocks (general-purpose record I/O) and keeps basic data about each file, such as its record size.</li>
  <li><b>Basic I/O supervisor</b>: starts and ends all file I/O; keeps control structures for device I/O, scheduling and file status; selects the device; schedules disk accesses for performance; assigns I/O buffers and secondary storage. Part of the OS.</li>
  <li><b>Basic file system (physical I/O)</b>: exchanges whole blocks with secondary storage, decides where blocks are placed and buffers them in main memory; does not understand the data or the file's structure.</li>
  <li><b>Device drivers</b>: the lowest level; talk directly to device controllers, start I/O operations and handle their completion (interrupts). Part of the OS.</li>
</ol>
<p><i>Worked example: read record 42 of payroll.</i> Records are 256 bytes and blocks 4096 bytes, so 4096 ÷ 256 = 16 records per block. Logical I/O finds record 42 in file block ⌊42 ÷ 16⌋ = 2, starting at byte (42 mod 16) × 256 = 2560 of that block (bytes 2560 to 2815). The supervisor selects disk 0, assigns a buffer and queues the request for disk scheduling. The basic file system knows file block 2 is disk block 9120 and moves its 4096 bytes into the buffer. The driver reads sectors 72960 to 72967 (512-byte sectors) and handles the completion interrupt. Back up the stack, logical I/O extracts bytes 2560 to 2815 and the access method hands record 42 to the program.</p>
<p><i>Name clash with section 11.3.</i> Section 11.3's layered I/O model also has a layer called <b>logical I/O</b>, but there it is the top layer of the stack for a local device: it treats the whole device as a logical resource, reached through a device identifier and simple commands. In the file system stack here, logical I/O is the record layer between the access method and the basic I/O supervisor.</p>

<h3>File management functions: the path of a request</h3>
<p><b>User and program commands → directory management → user access control → access method (record operations) → record blocking → disk scheduling, file allocation and free storage management → physical I/O.</b></p>
<ul>
  <li><b>Directory management</b> first identifies and locates the file from its name.</li>
  <li><b>User access control</b> lets only authorized users perform the operation, before any data moves. An unauthorized request stops here (for example "permission denied"); nothing below runs.</li>
  <li>The <b>access method</b> suited to the file's structure turns the command into record operations, since users work at the record level.</li>
  <li><b>Record blocking</b>: programs work with records but I/O moves blocks, so records are packed into blocks for output and unpacked after input. It bridges the logical view (names, users, records) and the physical view (blocks, disk).</li>
  <li><b>File allocation</b> decides and records which disk blocks hold each block of the file; <b>free storage management</b> tracks unused blocks; <b>disk scheduling</b> orders the block requests.</li>
  <li><b>Physical I/O</b> transfers the blocks.</li>
</ul>
<p>Examples: a read of record 42 uses file allocation only to look up where block 2 lives (disk block 9120) and needs no free storage. Appending record 64 to a file whose 64 records exactly fill blocks 0 to 3 starts a new block 4 (slot 0): free storage management hands out a free disk block (5507), file allocation records block 4 → 5507, and the block is written, leaving 65 records in 5 blocks.</p>`,
  });
})();
