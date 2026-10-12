/* =====================================================================
   11.1 I/O Devices
   Original teaching material. Shared device data and small helpers live
   inside this IIFE (no globals).
   ===================================================================== */
(function () {
  /* Typical data rates in bits per second. lo..hi is the usual span, rep is the
     single representative value used for comparisons. All are orders of magnitude only. */
  const DEV = [
    { k: 'kbd', name: 'Keyboard', lo: 40, hi: 160, rep: 80,
      how: 'A fast typist presses about 10 keys a second. At 8 bits per key that is about 80 bit/s, and bursts rarely reach twice that.' },
    { k: 'mouse', name: 'Mouse', lo: 1200, hi: 8000, rep: 4000,
      how: 'A USB mouse sends about 125 reports a second of a few bytes each: about 4,000 bit/s. Old serial mice used 1,200 bit/s; gaming mice, at 1,000 reports a second, go higher.' },
    { k: 'modem', name: 'Dial-up modem', lo: 9600, hi: 56000, rep: 56000,
      how: 'Telephone-line modems of the 1990s ran from 9,600 bit/s up to their final 56,000 bit/s (56 kbit/s, reached only when downloading).' },
    { k: 'printer', name: 'Laser printer', lo: 1e6, hi: 1e7, rep: 3e6,
      how: 'To keep its print engine busy at tens of pages a minute, a laser printer must be fed page data at millions of bits per second.' },
    { k: 'scanner', name: 'Image scanner', lo: 1e7, hi: 2.8e7, rep: 2.8e7,
      how: 'An A4 page scanned in full colour (24 bits per dot) at 600 dots per inch is about 835 million bits. Delivered in 30 seconds that is about 2.8 × 10⁷ bit/s.' },
    { k: 'eth', name: 'Ethernet (10/100 Mbit/s)', lo: 1e7, hi: 1e8, rep: 1e8,
      how: 'The first Ethernet standard (early 1980s) ran at 10 Mbit/s (10⁷ bit/s); Fast Ethernet (1995) at 100 Mbit/s (10⁸ bit/s). The speed is in the name.' },
    { k: 'usb', name: 'USB flash drive', lo: 2.4e8, hi: 2.4e9, rep: 8e8,
      how: 'An older USB 2.0 stick manages about 30 MB/s (2.4 × 10⁸ bit/s); a fast USB 3 stick about 300 MB/s (2.4 × 10⁹ bit/s).' },
    { k: 'hdd', name: 'Hard disk drive', lo: 8e8, hi: 2.24e9, rep: 1.6e9,
      how: 'A modern hard disk streams about 100 to 280 MB/s, depending on where the data sits on the platter: around 1.6 × 10⁹ bit/s.' },
    { k: 'gbe', name: 'Gigabit Ethernet', lo: 1e9, hi: 1e9, rep: 1e9,
      how: 'Exactly what the name says: one gigabit, 10⁹ bits, per second.' },
    { k: 'disp', name: 'Graphics display', lo: 1920 * 1080 * 24 * 60, hi: 3840 * 2160 * 24 * 60, rep: 1920 * 1080 * 24 * 60,
      how: 'A 1920 × 1080 screen with 24-bit colour redrawn 60 times a second needs 1920 × 1080 × 24 × 60 ≈ 3.0 × 10⁹ bit/s. A 4K screen needs about 1.2 × 10¹⁰.' },
    { k: 'ssd', name: 'Solid-state drive (SSD)', lo: 4.4e9, hi: 5.6e10, rep: 2.8e10,
      how: 'A SATA SSD reads about 550 MB/s (4.4 × 10⁹ bit/s); a fast NVMe SSD about 7,000 MB/s (5.6 × 10¹⁰ bit/s).' },
    { k: 'eth10', name: '10/100 Gigabit Ethernet', lo: 1e10, hi: 1e11, rep: 1e10,
      how: 'Server and data-centre links: 10 Gbit/s (10¹⁰ bit/s) is common in servers, and 100 Gbit/s (10¹¹ bit/s) links connect switches.' },
  ];
  const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
  const sup = (n) => String(n).split('').map((c) => SUP[c] || c).join('');
  const pow = (n) => '10' + sup(n);
  /* "10² " or "10⁹–10¹⁰": the orders of magnitude a device's typical span covers. */
  function orders(d) {
    const a = Math.round(Math.log10(d.lo)), b = Math.round(Math.log10(d.hi));
    return a === b ? pow(a) : pow(a) + '–' + pow(b);
  }
  /* 4000 → "4 kbit/s", 1.6e9 → "1.6 Gbit/s" */
  function rate(bps) {
    const u = [[1e9, 'Gbit/s'], [1e6, 'Mbit/s'], [1e3, 'kbit/s'], [1, 'bit/s']].find(([f]) => bps >= f) || [1, 'bit/s'];
    const v = bps / u[0];
    return (v >= 100 ? Math.round(v) : Math.round(v * 10) / 10).toLocaleString('en-US') + ' ' + u[1];
  }
  /* 2.8e7 → "2.8 × 10⁷" */
  function sci(x) {
    const e = Math.floor(Math.log10(x)), m = Math.round((x / Math.pow(10, e)) * 10) / 10;
    return (m === 1 ? '' : m + ' × ') + pow(e);
  }
  /* a number of seconds in the most readable unit */
  function dur(sec) {
    const U = [[365.25 * 86400, 'year'], [86400, 'day'], [3600, 'hour'], [60, 'minute'], [1, 'second']];
    if (sec < 1) { const ms = sec * 1000; return (ms >= 10 ? Math.round(ms) : Math.round(ms * 10) / 10) + ' ms'; }
    const [f, n] = U.find(([q]) => sec >= q);
    const v = sec / f, r = v >= 10 ? Math.round(v) : Math.round(v * 10) / 10;
    return r.toLocaleString('en-US') + ' ' + n + (r === 1 ? '' : 's');
  }

  Guide.section({
    id: '11.1',
    title: 'I/O Devices',
    short: 'I/O devices',
    summary: 'Devices talk to people, to machines or to remote computers, and they differ in six ways the OS must handle.',
    objectives: [
      'Sort external devices into human-readable, machine-readable and communication devices.',
      'Read a logarithmic data-rate chart and explain why device speeds span about nine orders of magnitude.',
      'Explain the six ways devices differ (data rate, application, complexity of control, unit of transfer, data representation, error conditions) with an example of each.',
      'Tell a block-oriented device from a stream-oriented one.',
    ],
    terms: [
      ['Human-readable device', 'A device that exchanges information with the person using the computer, such as a keyboard, mouse, display or printer.'],
      ['Machine-readable device', 'A device that exchanges information with other electronic equipment rather than with a person, such as a disk drive, USB flash drive, sensor or actuator.'],
      ['Communication device', 'A device that exchanges information with remote devices or computers, such as a network interface card or a modem.'],
      ['Sensor', 'A device that measures something in the physical world (temperature, light, motion) and reports it to the computer as data.'],
      ['Actuator', 'A device that turns a command from the computer into a physical action, such as a motor turning, a valve opening or a relay switching.'],
      ['Modem', 'Short for modulator-demodulator: a device that turns digital data into signals that can travel over a telephone or cable line, and turns them back again at the other end.'],
      ['Data rate', 'How many bits per second a device can send or receive. Written in bit/s, kbit/s (thousands), Mbit/s (millions) or Gbit/s (billions).'],
      ['Order of magnitude', 'A factor of ten. Two quantities differ by three orders of magnitude when one is about 10 × 10 × 10 = 1,000 times the other.'],
      ['Logarithmic scale (log scale)', 'A chart axis on which each equal step multiplies the value by the same factor (usually 10), so tiny and huge values fit on one chart.'],
      ['Unit of transfer', 'The size of the piece of data a device moves in one operation: a single byte or character for some devices, a whole block of hundreds or thousands of bytes for others.'],
      ['Block-oriented device', 'A device that stores data in fixed-size blocks, moves one whole block at a time, and lets any block be reached by its block number. Disks and USB flash drives are examples.'],
      ['Stream-oriented device', 'A device that moves data as a sequence of bytes with no block structure and no block numbers. Keyboards, terminals, printers, mice and communication ports are examples.'],
      ['Character code', 'An agreed table that gives each character a number, so that text can be stored and sent as bits. ASCII and Unicode are the common ones.'],
      ['Parity bit', 'An extra bit added to a group of bits so that the total count of 1s is even (even parity) or odd (odd parity). A single flipped bit then breaks the rule and is detected.'],
      ['Error-correcting code (ECC)', 'Extra bits stored with data, computed from it, that let a device detect and repair small errors when the data is read back.'],
      ['Packet', 'A chunk of data sent over a network as one unit, with a header that says where it comes from and where it is going.'],
      ['Checksum', 'A short number computed from a block of data and sent along with it. The receiver recomputes it; if the two disagree, the data was damaged on the way.'],
      ['Protocol', 'An agreed set of rules for exchanging messages over a network: their format, the order of steps, and what to do about errors. TCP is a protocol that has lost or damaged packets sent again.'],
      ['Spooler', 'A program that collects whole jobs for a shared slow device, such as a printer, in a queue on disk and feeds them to the device one at a time, so programs never wait for it.'],
    ],
    css: `
      .sec-11-1 .narr { background: var(--panel-2); border: 1px solid var(--line); border-left: 5px solid var(--chc); border-radius: 12px; padding: 9px 13px; font-size: 15.5px; line-height: 1.45; }
      .sec-11-1 .narr.ok { border-left-color: var(--ok); background: var(--ok-bg); }
      .sec-11-1 .narr.bad { border-left-color: var(--bad); background: var(--bad-bg); }
      .sec-11-1 .mw0 > * { min-width: 0; }
      .sec-11-1 .rchart { display: flex; flex-direction: column; gap: 3px; }
      .sec-11-1 .rrow { display: grid; grid-template-columns: 186px minmax(0, 1fr); align-items: center; gap: 10px; height: 28px; padding: 0 8px; border: 1px solid transparent; border-radius: 8px; background: none; color: var(--ink); font: inherit; text-align: left; cursor: pointer; width: 100%; }
      .sec-11-1 button.rrow:hover { background: var(--panel-2); }
      .sec-11-1 .rrow.on { background: var(--io-bg); border-color: var(--io); }
      .sec-11-1 .rrow .lbl { font-size: 14px; font-weight: 650; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .sec-11-1 .track { position: relative; height: 18px; border-radius: 4px; border-right: 1px solid var(--line); background: linear-gradient(to right, var(--line) 1px, transparent 1px) 0 0 / 10% 100% repeat-x, var(--panel-2); }
      .sec-11-1 .track.lin { background-size: 20% 100%, auto; }
      .sec-11-1 .bar { position: absolute; top: 3px; bottom: 3px; border-radius: 4px; background: color-mix(in srgb, var(--io) 40%, transparent); border: 1.5px solid var(--io); min-width: 8px; transition: left .4s, width .4s; }
      .sec-11-1 .track.lin .bar { min-width: 0; }
      .sec-11-1 .dot { position: absolute; top: 50%; width: 10px; height: 10px; margin: -5px 0 0 -5px; border-radius: 50%; background: var(--io); border: 2px solid var(--panel); transition: left .4s; }
      .sec-11-1 .thin { position: absolute; left: 6px; top: 0; line-height: 18px; white-space: nowrap; font-size: 12.5px; color: var(--muted); }
      .sec-11-1 .axis { cursor: default; height: 40px; }
      .sec-11-1 .ticks { position: relative; height: 40px; }
      .sec-11-1 .tick { position: absolute; top: 2px; transform: translateX(-50%); font-size: 13px; font-weight: 700; white-space: nowrap; text-align: center; line-height: 1.25; }
      .sec-11-1 .tick small { display: block; font-size: 12.5px; color: var(--muted); font-weight: 600; }
      .sec-11-1 .rchart.slim .rrow { grid-template-columns: minmax(0, 1fr); height: auto; gap: 2px; padding: 3px 6px; }
      .sec-11-1 .rchart.slim .axis > .lbl { display: none; }
      .sec-11-1 .cells { display: inline-flex; flex-wrap: wrap; gap: 3px; }
      .sec-11-1 .cell { width: 24px; height: 27px; display: inline-grid; place-items: center; font-family: var(--mono); font-size: 14.5px; font-weight: 700; border: 1.5px solid var(--line-2); border-radius: 5px; background: var(--panel); }
      .sec-11-1 .cell.mem { border-color: var(--mem); background: var(--mem-bg); }
      .sec-11-1 .cell.io { border-color: var(--io); background: var(--io-bg); }
      .sec-11-1 .cell.proc { border-color: var(--proc); background: var(--proc-bg); }
      .sec-11-1 .cell.dim { opacity: .45; border-style: dashed; }
      .sec-11-1 .cell.chg { border-color: var(--warn); background: var(--warn-bg); }
      .sec-11-1 .blk { display: flex; align-items: center; gap: 8px; padding: 3px 6px; border-radius: 8px; border: 2px solid transparent; }
      .sec-11-1 .blk.on { background: var(--mem-bg); border-color: var(--mem); }
      .sec-11-1 .blk .bn { font-size: 13px; font-weight: 700; color: var(--muted); width: 54px; flex: none; }
      .sec-11-1 .flip-face.front { font-size: 19px; }
      .sec-11-1 .flip-face.back { font-size: 16px; line-height: 1.45; }
      .sec-11-1 .tally { font-size: 14.5px; font-weight: 700; font-variant-numeric: tabular-nums; }
    `,
    steps: [
      {
        title: 'Where the computer meets the world',
        kind: 'story',
        html: `
          <div class="split fill mw0">
            <div class="stack" style="gap:9px">
              <p class="lead m0">Every useful program sooner or later touches the outside world: it reads a key, saves a file, sends a message. That is input/output (I/O), and it is where the OS meets a crowd of very different devices.</p>
              <p class="m0">A keyboard delivers a few characters a second; a solid-state drive delivers billions of bits a second. A printer can run out of paper; a network message can vanish on the way. The OS must drive all of them, hide their quirks from programs, and still keep the processor busy.</p>
              <div class="callout analogy m0" data-label="Analogy">Picture the front desk of a large office. Visitors chat with the receptionist face to face, slowly. Couriers drop off sealed boxes of standard sizes. The phone rings with calls from branch offices far away. One desk, three very different kinds of partner, and each needs its own routine. The OS is that desk.</div>
              <h4 class="m0" style="margin-top:4px">In this section you will</h4>
              <div class="row gap-s small"><span class="chip io">sort devices into three groups</span><span class="chip cpu">compare speeds on a log scale</span><span class="chip os">explore six differences</span><span class="chip mem">see blocks versus streams</span></div>
            </div>
            <div class="card stack" style="gap:10px">
              <h4 class="m0">One computer, three kinds of partner</h4>
              <p class="small muted m0">Click a partner to see who sits at the other end of the wire.</p>
              <div class="hub"></div>
              <div class="card white grow hub-detail" style="display:flex;flex-direction:column;gap:6px"></div>
            </div>
          </div>`,
        render(el, ctx) {
          const { h } = ctx;
          const P = [
            { cat: 'Human readable', term: 'Human-readable device', end: 'a person', area: 'h', devs: ['kbd', 'mouse', 'printer', 'disp'],
              ex: ['keyboard', 'mouse', 'display', 'printer', 'touchscreen'],
              text: 'The data has to suit human senses and human speed: characters, pixels, sound, ink on paper. Input from people is slow (even a fast typist manages about ten keys a second), while a display must refresh over a hundred million pixels a second because eyes take in a lot at once.' },
            { cat: 'Machine readable', term: 'Machine-readable device', end: 'electronic equipment', area: 'm', devs: ['usb', 'hdd', 'ssd'],
              ex: ['disk drive', 'USB flash drive', 'temperature sensor', 'motor actuator', 'controller'],
              text: 'Nobody reads this data directly. A disk stores bits for the computer itself; a <span class="t">sensor</span> reports a measurement; an <span class="t">actuator</span> moves something when told to. The data is in whatever form the equipment uses.' },
            { cat: 'Communication', term: 'Communication device', end: 'a remote device or computer', area: 'c', devs: ['modem', 'eth', 'gbe', 'eth10'],
              ex: ['network interface card', 'Wi-Fi adapter', 'modem', 'cellular radio'],
              text: 'The data travels over a link to another machine, chopped into <span class="t">packets</span>. The far end may be slow, busy, or gone, and messages can arrive late, out of order, or not at all.' },
          ];
          const hub = ctx.$('.hub'), detail = ctx.$('.hub-detail');
          Object.assign(hub.style, { display: 'grid', gridTemplateColumns: ctx.narrow ? '1fr' : 'repeat(3, minmax(0, 1fr))', gridTemplateAreas: ctx.narrow ? '"os" "h" "m" "c"' : '"h os m" ". c ."', gap: '8px 10px', alignItems: 'center' });
          hub.append(h('div', { class: 'box os', style: { gridArea: 'os', padding: '8px 14px' }, html: 'Computer<div class="xs muted">+ operating system</div>' }));
          const btns = P.map((p, i) => {
            const b = h('button', { class: 'btn io', type: 'button', style: { gridArea: p.area, height: 'auto', minHeight: '44px', whiteSpace: 'normal', flexDirection: 'column', gap: '0', padding: '5px 10px' }, onclick: () => show(i) },
              h('span', { text: p.cat }), h('span', { class: 'xs muted', text: '↔ ' + p.end }));
            hub.append(b);
            return b;
          });
          function show(i) {
            const p = P[i];
            btns.forEach((b, j) => b.classList.toggle('on', i === j));
            detail.innerHTML = '';
            detail.append(
              h('div', { class: 'row', style: { justifyContent: 'space-between' } },
                h('b', { style: { fontSize: '18px' }, html: `<span class="t" data-t="${p.term}">${p.cat}</span> devices` }),
                h('span', { class: 'chip io' }, 'other end: ' + p.end)),
              h('div', { class: 'row gap-s' }, ...p.ex.map((x) => h('span', { class: 'chip' }, x))),
              h('p', { class: 'm0', style: { fontSize: '15px', lineHeight: '1.45' }, html: p.text }),
              h('div', { class: 'xs muted b', style: { marginTop: 'auto' } }, 'TYPICAL DATA RATES IN THIS GROUP (BITS PER SECOND)'),
              h('div', { class: 'row gap-s' }, ...p.devs.map((k) => { const d = DEV.find((x) => x.k === k); return h('span', { class: 'chip io' }, d.name + ' ≈ ' + orders(d)); })));
            detail.classList.remove('fade-in'); void detail.offsetWidth; detail.classList.add('fade-in');
          }
          show(0);
        },
      },

      {
        title: 'Three kinds of device: sort them',
        kind: 'explore',
        render(el, ctx) {
          const { h } = ctx;
          const CATS = [
            { name: 'Human readable', term: 'Human-readable device', end: 'a person' },
            { name: 'Machine readable', term: 'Machine-readable device', end: 'equipment' },
            { name: 'Communication', term: 'Communication device', end: 'a remote machine' },
          ];
          const ITEMS = [
            ['Keyboard', 0, 'Keys pressed by a person become character codes.', 'A person presses the keys, so it is human readable.'],
            ['Monitor', 0, 'Lights up pixels for someone to look at.', 'Its whole job is to show things to a person: human readable.'],
            ['Laser printer', 0, 'Puts text and pictures on paper.', 'A machine does the printing, but the page is meant for a person to read, so it is human readable.'],
            ['Game controller', 0, 'Buttons and sticks moved by a player’s thumbs.', 'A person’s hands drive it: human readable.'],
            ['Hard disk drive', 1, 'Stores bits on spinning magnetic platters.', 'Only the computer ever reads those bits back, so it is machine readable.'],
            ['USB flash drive', 1, 'Plugs into the same USB port a keyboard uses.', 'Same port as a keyboard, but the other end is storage chips, not a person: machine readable.'],
            ['Temperature sensor', 1, 'Reports the temperature inside a factory oven.', 'A sensor feeds measurements to equipment; nobody types into it. Machine readable.'],
            ['Valve actuator', 1, 'Opens or closes a pipe valve when told to.', 'An actuator acts on machinery, not on a person: machine readable.'],
            ['Ethernet network card', 2, 'Connects by cable to the office network.', 'Its partner is another computer somewhere on the network: communication.'],
            ['Cable modem', 2, 'Carries internet traffic over the TV cable.', 'A modem exists to reach remote equipment over a line: communication.'],
            ['Wi-Fi adapter', 2, 'Sends radio messages to a nearby access point.', 'Radio or cable, the other end is a remote device: communication.'],
            ['Phone’s cellular radio', 2, 'Talks to a cell tower kilometres away.', 'It links the phone to a distant network: communication.'],
          ];
          let order = [], pos = 0, score = 0;
          const nameEl = h('div', { style: { fontSize: '22px', fontWeight: 800, lineHeight: 1.2 } });
          const descEl = h('div', { class: 'small muted' });
          const countEl = h('span', { class: 'chip io' });
          const current = h('div', { class: 'card io', style: { display: 'flex', flexDirection: 'column', gap: '4px', minHeight: '86px', justifyContent: 'center' } },
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'xs muted b' }, 'WHERE DOES THIS GO?'), countEl), nameEl, descEl);
          const fb = h('div', { class: 'narr', style: { minHeight: '70px' } });
          const scoreEl = h('b', { class: 'num' });
          const lists = CATS.map(() => h('div', { class: 'stack', style: { gap: '4px' } }));
          const bucketBtns = CATS.map((c, i) => h('button', { class: 'btn', type: 'button', style: { height: 'auto', minHeight: '46px', flexDirection: 'column', gap: '0', whiteSpace: 'normal', width: '100%' }, onclick: () => drop(i) },
            h('span', { text: c.name }), h('span', { class: 'xs muted', text: 'other end: ' + c.end })));
          const buckets = h('div', { class: 'grid-3', style: { gap: '10px', alignItems: 'start' } },
            ...CATS.map((c, i) => h('div', { class: 'card tight stack', style: { gap: '6px', minHeight: '206px' } }, bucketBtns[i], lists[i])));
          function deal() {
            if (pos >= order.length) {
              nameEl.textContent = 'All ' + order.length + ' sorted';
              descEl.innerHTML = score === order.length ? 'A perfect score. Every device sits in its right group.' : 'Red tags show the ones that tripped you up. Press <b>Shuffle and play again</b> to retry.';
              countEl.textContent = 'done';
              bucketBtns.forEach((b) => { b.disabled = true; });
              return;
            }
            const it = ITEMS[order[pos]];
            nameEl.textContent = it[0];
            descEl.textContent = it[2];
            countEl.textContent = (pos + 1) + ' of ' + order.length;
          }
          function drop(i) {
            if (pos >= order.length) return;
            const it = ITEMS[order[pos]], right = it[1] === i;
            if (right) score++;
            lists[it[1]].append(h('span', { class: 'chip ' + (right ? 'ok' : 'bad'), style: { whiteSpace: 'normal' }, text: (right ? '✓ ' : '✗ ') + it[0] }));
            fb.className = 'narr ' + (right ? 'ok' : 'bad');
            fb.innerHTML = (right ? '<b>Right.</b> ' : `<b>Not quite.</b> You chose ${CATS[i].name}. `) + it[3];
            scoreEl.textContent = score + ' / ' + (pos + 1);
            pos++;
            deal();
          }
          function reset() {
            order = ctx.util.shuffle(ITEMS.map((_, i) => i));
            pos = 0; score = 0;
            lists.forEach((l) => l.replaceChildren());
            bucketBtns.forEach((b) => { b.disabled = false; });
            fb.className = 'narr';
            fb.innerHTML = 'Click the group the device belongs to. Each one lands in its correct group, marked ✓ or ✗.';
            scoreEl.textContent = '0 / 0';
            deal();
          }
          el.append(h('div', { class: 'split l fill' },
            h('div', { class: 'stack', style: { gap: '9px' } },
              h('h3', { class: 'm0' }, 'Ask one question: what is at the other end?'),
              h('p', { class: 'm0', html: 'A long-standing way to group external devices looks past the plug and the speed, and asks who or what the device exchanges data with.' }),
              h('div', { class: 'card tight', html: '<b><span class="t" data-t="Human-readable device">Human readable</span></b>: communicates with the <b>user</b>, who sees, hears or touches it.' }),
              h('div', { class: 'card tight', html: '<b><span class="t" data-t="Machine-readable device">Machine readable</span></b>: communicates with <b>electronic equipment</b>: storage, <span class="t">sensors</span>, <span class="t">actuators</span>, controllers.' }),
              h('div', { class: 'card tight', html: '<b><span class="t" data-t="Communication device">Communication</span></b>: communicates with <b>remote devices</b> across a link: network cards, <span class="t">modems</span>.' }),
              h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'Sorting by the plug. A USB keyboard and a USB flash drive share a port yet belong to different groups. And a printer is a machine, but its pages are for people, so it is human readable.' })),
            h('div', { class: 'stack', style: { gap: '10px' } },
              current, buckets, fb,
              h('div', { class: 'row', style: { justifyContent: 'space-between' } },
                h('span', { class: 'small' }, 'Score: ', scoreEl),
                h('button', { class: 'btn sm', type: 'button', onclick: reset }, '↻ Shuffle and play again')))));
          reset();
        },
      },

      {
        title: 'Data rates span nine orders of magnitude',
        kind: 'explore',
        core: true,
        render(el, ctx) {
          const { h } = ctx;
          const L0 = 1, L1 = 11, MAX = Math.pow(10, L1), KBD = DEV[0], FILE = 8e9;
          let mode = 'log', sel = DEV.findIndex((d) => d.k === 'hdd');
          const pos = (v) => (mode === 'log' ? ((Math.log10(v) - L0) / (L1 - L0)) * 100 : (v / MAX) * 100);
          const rows = DEV.map((d, i) => {
            const bar = h('i', { class: 'bar' }), dot = h('i', { class: 'dot' }), thin = h('span', { class: 'thin' });
            const track = h('span', { class: 'track' }, bar, dot, thin);
            const b = h('button', { class: 'rrow', type: 'button', title: d.name + ': ' + orders(d) + ' bit/s', onclick: () => select(i) }, h('span', { class: 'lbl', text: d.name }), track);
            return { b, bar, dot, thin, track };
          });
          const ticks = h('div', { class: 'ticks' });
          const chart = h('div', { class: 'rchart' + (ctx.narrow ? ' slim' : '') }, ...rows.map((r) => r.b), h('div', { class: 'rrow axis' }, h('span', { class: 'lbl' }), ticks));
          const cap = h('p', { class: 'small m0', style: { minHeight: '44px' } });
          const detail = h('div', { class: 'card white stack', style: { gap: '5px', minHeight: '228px', padding: '10px 14px', flex: 'none' } });  // sized for the tallest device
          const seg = ctx.ui.seg([{ value: 'log', label: 'Log axis' }, { value: 'lin', label: 'Linear axis' }], mode, (v) => { mode = v; draw(); });
          function draw() {
            const W = rows[0].track.clientWidth || 480, perPx = MAX / W;
            rows.forEach((r, i) => {
              const d = DEV[i], a = pos(d.lo), b = pos(d.hi), px = (d.hi / MAX) * W;
              r.track.classList.toggle('lin', mode === 'lin');
              const hide = mode === 'lin' && px < 1;
              r.bar.style.left = a + '%'; r.bar.style.width = Math.max(0, b - a) + '%';
              r.bar.style.display = hide ? 'none' : '';
              r.dot.style.left = pos(d.rep) + '%'; r.dot.style.display = hide ? 'none' : '';
              r.thin.textContent = hide ? 'too thin to see: ' + sci(px) + ' pixels wide' : '';
              r.b.classList.toggle('on', i === sel);
            });
            const T = [];
            if (mode === 'log') {
              const friendly = { 3: '1 kbit/s', 6: '1 Mbit/s', 9: '1 Gbit/s' };
              for (let e = L0; e <= L1; e++) {
                if (ctx.narrow && e % 2 === 0) continue;
                const t = h('span', { class: 'tick', style: { left: pos(Math.pow(10, e)) + '%' }, html: pow(e) + (friendly[e] ? `<small>${friendly[e]}</small>` : '') });
                if (e === L1) t.style.transform = 'translateX(-100%)';
                if (e === L0) t.style.transform = 'none';
                T.push(t);
              }
              const span = DEV[DEV.length - 1].hi / KBD.rep;
              cap.innerHTML = `Each gridline is <b>10 times</b> the one before. From a keyboard (≈ ${rate(KBD.rep)}) to the fastest network link (${rate(DEV[DEV.length - 1].hi)}) is a factor of about <b>${sci(span)}</b>: nine <span class="t" data-t="order of magnitude">orders of magnitude</span>.`;
            } else {
              for (let k = 0; k <= 5; k++) {
                if (ctx.narrow && ![0, 3, 5].includes(k)) continue;
                const v = (MAX * k) / 5;
                const t = h('span', { class: 'tick', style: { left: pos(v) + '%' }, html: String(v / 1e9) + (k === 5 ? '<small>Gbit/s</small>' : '') });
                if (k === 5) t.style.transform = 'translateX(-100%)';
                if (k === 0) t.style.transform = 'none';
                T.push(t);
              }
              const gone = DEV.filter((d) => (d.hi / MAX) * W < 1).length;
              cap.innerHTML = `On a linear axis one pixel stands for about <b>${rate(perPx)}</b>, so <b>${gone} of the ${DEV.length}</b> devices are thinner than a single pixel. That is why device speeds are always drawn on a <span class="t" data-t="logarithmic scale">log scale</span>.`;
            }
            ticks.replaceChildren(...T);
            paintDetail();
          }
          function paintDetail() {
            const d = DEV[sel], ratio = d.rep / KBD.rep;
            const hdd = DEV.find((x) => x.k === 'hdd');
            const cmp = sel === 0
              ? `the slowest here: a hard disk moves in 1 s what typing takes <b>${dur(hdd.rep / KBD.rep)}</b> to deliver`
              : `<b>${dur(ratio)}</b> of nonstop typing (${ratio < 1000 ? Math.round(ratio).toLocaleString('en-US') : sci(ratio)} keyboard-seconds)`;
            const line = (k, v) => [h('span', { class: 'xs muted b', style: { paddingTop: '2px' } }, k), h('span', { style: { fontSize: '15px' }, html: v })];
            detail.innerHTML = '';
            detail.append(
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', { style: { fontSize: '18px' } }, d.name), h('span', { class: 'chip io' }, '≈ ' + orders(d) + ' bit/s')),
              h('div', { class: 'small', html: `Typical: <b>${rate(d.rep)}</b>` + (d.lo === d.hi ? '' : ` &nbsp;·&nbsp; usual span ${rate(d.lo)} to ${rate(d.hi)}`) }),
              h('p', { class: 'm0 small muted', text: d.how }),
              h('div', { style: { display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', gap: '3px 10px', borderTop: '1px solid var(--line)', paddingTop: '6px' } },
                ...line(sel === 0 ? 'KEYBOARD' : '1 SECOND OF IT', cmp),
                ...line('1 GB FILE', `${sci(FILE)} bits take about <b>${dur(FILE / d.rep)}</b>`)));
          }
          function select(i) { sel = i; draw(); }
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: 'minmax(0, 440px) minmax(0, 1fr)', gap: '20px' } },
            h('div', { class: 'stack', style: { gap: '6px' } },
              h('h3', { class: 'm0' }, 'Difference 1: data rate'),
              h('p', { class: 'm0', html: 'The <span class="t">data rate</span> is how many bits per second a device can move. Click a bar to inspect a device; flip the axis below.' }),
              seg, detail,
              h('div', { class: 'callout why small m0', 'data-label': 'Why it matters', html: 'A 3 GHz processor runs about 3 × 10⁸ clock cycles between two keystrokes, so one <span class="t">interrupt</span> per key is cheap. A 10¹⁰ bit/s device sends over a billion bytes a second, far too many for one interrupt each: fast devices move whole blocks by <span class="t">DMA</span> (11.2).' })),
            h('div', { class: 'card stack', style: { gap: '8px' } },
              h('h4', { class: 'm0' }, 'Typical data rates in bits per second (order of magnitude only)'),
              chart, cap)));
          draw();
          ctx.raf(() => { draw(); return false; });
        },
      },

      {
        title: 'Six ways devices differ',
        kind: 'compare',
        core: true,
        render(el, ctx) {
          const { h } = ctx;
          const by = (k) => DEV.find((d) => d.k === k);
          const kbd = by('kbd'), hdd = by('hdd'), prn = by('printer'), gbe = by('gbe'), e10 = by('eth10');
          const PAIRS = [
            { value: 0, label: 'Keyboard vs hard disk', a: 'Keyboard', ac: 'human readable', b: 'Hard disk drive', bc: 'machine readable' },
            { value: 1, label: 'Laser printer vs network card', a: 'Laser printer', ac: 'human readable', b: 'Network interface card', bc: 'communication' },
          ];
          const DIFFS = [
            { name: 'Data rate', t: 'data rate',
              gen: 'How many bits per second the device can move. Across all devices this spans about nine orders of magnitude (previous step).',
              p: [
                ['A few keystrokes a second at most, with long idle gaps in between while the person thinks.',
                  `Typically ${rate(hdd.rep)} while streaming: about ${sci(hdd.rep / kbd.rep)} times the keyboard’s ${rate(kbd.rep)}.`,
                  'One interrupt per keystroke is fine. The disk moves whole blocks by DMA, so the processor is interrupted once per block, not once per byte.'],
                ['Enough to keep the print engine turning out tens of pages a minute.',
                  `Gigabit Ethernet is ${rate(gbe.rep)}; server and data-centre links run at ${rate(e10.lo)} to ${rate(e10.hi)}.`,
                  'The printer is fed from a queue at its own pace. Network data arrives so fast that the card writes packets straight into memory by DMA, and the OS handles many packets per interrupt.'],
              ] },
            { name: 'Application',
              gen: 'What the device is used for. The same hardware can need different OS software and different policies depending on its job.',
              p: [
                ['Lets whoever is logged in type commands and text. An administrator’s terminal may get higher priority than an ordinary user’s, so the system stays manageable under heavy load.',
                  'If it holds files, it needs file-management software (directories, space allocation, protection). If it holds paging space for virtual memory, it needs the virtual-memory hardware and software instead.',
                  'The job decides the software in front of a device: the file system for files, the virtual-memory manager for paging, and a priority that depends on who is at the terminal.'],
                ['Shared by everyone in an office. Programs must not wait for it, and pages from two jobs must never mix.',
                  'Carries traffic for many processes at once: web pages, mail, updates. Each arriving packet must reach the right process, and some traffic (a video call) may deserve priority.',
                  'A <span class="t">spooler</span> sits in front of the shared printer and queues whole jobs; the network <span class="t">protocol</span> software sits in front of the card and hands each packet to the right process.'],
              ] },
            { name: 'Complexity of control',
              gen: 'How much work it takes to command the device, track its state and check its status. The device’s own <span class="t">I/O module</span> (its controller) hides part of this from the OS.',
              p: [
                ['Very simple: each key press or release becomes a small code that the keyboard’s controller hands over with an interrupt. The driver just reads the code.',
                  'Complex: the OS names a block, a direction and a memory address, queues many requests, orders them to save arm movement (section 11.5) and retries failures. The drive’s controller hides the arm and sector mechanics.',
                  'The keyboard driver is tiny; the disk driver and disk scheduler are large. The I/O module absorbs the lowest-level, device-specific detail.'],
                ['A simple interface: send the page data, read a few status bits such as ready, busy and out of paper.',
                  'Complex: the driver sets up circular lists of memory buffers that the card reads and fills by DMA, decides how often the card may interrupt, negotiates the link speed, and can hand jobs such as checking each packet to the card itself.',
                  'The printer driver mostly passes data along. The network driver manages those buffer lists, DMA and interrupts for heavy, two-way traffic.'],
              ] },
            { name: 'Unit of transfer', t: 'unit of transfer',
              gen: 'The size of one piece of data the device moves: a stream of single bytes or characters, or whole blocks.',
              p: [
                ['Each keystroke produces a byte or two that travel on their own, as part of a stream with no structure.',
                  'Whole blocks of 512 or 4,096 bytes. To change a single byte, the OS reads and rewrites the whole block (see the next step).',
                  'Keyboard input collects in a small character buffer. Disk data moves through block-sized buffers, each labelled with its block number.'],
                ['A stream of bytes that describes the pages, sent in whatever chunks are convenient.',
                  'Whole <span class="t">packets</span>: on standard Ethernet each one carries up to 1,500 bytes of data plus a header.',
                  'Printer output is copied as a byte stream; network data is handled packet by packet, each with its own header.'],
              ] },
            { name: 'Data representation',
              gen: 'How information is encoded as bits: the <span class="t">character code</span>, the format of numbers and images, and conventions such as a <span class="t">parity bit</span>. Example: in ASCII the letter A is 1000001 (two 1-bits), so even parity adds a 0 and odd parity adds a 1. Both ends must agree.',
              p: [
                ['Sends key numbers (scan codes), not letters. The driver turns them into characters using the keyboard layout, so one key gives Y on a US layout and Z on a German one.',
                  'Stores raw bytes and does not care what they mean. On the platter each sector also carries extra <span class="t" data-t="Error-correcting code">ECC</span> bits that the drive adds and checks itself.',
                  'The keyboard driver translates codes into characters. For the disk, meaning is left to the file system and the programs.'],
                ['Expects pages in a page-description language (PostScript and PCL are common) or as a raster of dots. Send it the wrong format and it prints pages of gibberish.',
                  'Packet headers carry addresses and a <span class="t">checksum</span>, and multi-byte numbers in them are sent most significant byte first (network byte order), the reverse of a typical PC’s memory order.',
                  'Printer drivers convert documents into the printer’s language; the network stack converts header numbers between network byte order and the processor’s order.'],
              ] },
            { name: 'Error conditions',
              gen: 'What can go wrong, how the device reports it, how serious the consequences are, and what can be done about it.',
              p: [
                ['Rare and mild: a missed or stuck key. The user sees the mistake and retypes it.',
                  'A sector that will not read. The drive tries to repair it with ECC and retries; if that fails the OS reports an error to the program, and data may be lost (RAID, section 11.6, adds protection).',
                  'Keyboard errors need no OS action. Disk errors need retries, error reports to the program, and logging so a failing drive is noticed.'],
                ['Paper jam, out of paper, out of toner. Only a person can fix these, and nothing is lost while the job waits.',
                  'A packet with a bad <span class="t">checksum</span> is quietly dropped. A <span class="t">protocol</span> such as TCP notices the gap and has the sender send it again, so programs rarely see an error; a dead link is reported as unreachable.',
                  'The OS pauses the print job and alerts a person. For the network it mostly lets protocols resend, and reports only failures they cannot hide.'],
              ] },
          ];
          const ord = (v) => pow(Math.round(Math.log10(v)));
          const SHORT = [
            [[`≈ ${orders(kbd)} bit/s`, `≈ ${orders(hdd)} bit/s`], [`≈ ${orders(prn)} bit/s`, `${ord(gbe.lo)}–${ord(e10.hi)} bit/s`]],
            [['typing commands and text', 'files, or paging space'], ['shared output for people', 'traffic for many processes']],
            [['simple', 'complex'], ['simple', 'complex']],
            [['one character at a time', 'whole blocks (512 B or 4 KB)'], ['a stream of bytes', 'packets (≤ 1,500 data bytes)']],
            [['scan codes → characters', 'raw bytes + ECC'], ['a page-description language', 'headers in network byte order']],
            [['mild: just retype', 'serious: retry, report, maybe lose data'], ['needs a person', 'mostly fixed by resending']],
          ];
          /* small pictures for the two differences that are easiest to see */
          const VIZ = {
            0: (pr) => {
              const devs = pr === 0 ? [[PAIRS[0].a, kbd.lo, kbd.hi], [PAIRS[0].b, hdd.lo, hdd.hi]] : [[PAIRS[1].a, prn.lo, prn.hi], [PAIRS[1].b, gbe.lo, e10.hi]];
              const at = (v) => ((Math.log10(v) - 1) / 10) * 100;
              const cols = ctx.narrow ? null : '170px minmax(0, 1fr)';
              const row = ([n, lo, hi]) => h('div', { class: 'rrow', style: { gridTemplateColumns: cols, cursor: 'default', height: ctx.narrow ? null : '24px' } }, h('span', { class: 'lbl', text: n }),
                h('span', { class: 'track' }, h('i', { class: 'bar', style: { left: at(lo) + '%', width: (at(hi) - at(lo)) + '%' } })));
              const tk = (e) => h('span', { class: 'tick', style: { left: ((e - 1) / 10) * 100 + '%', transform: e === 1 ? 'none' : e === 11 ? 'translateX(-100%)' : null }, text: pow(e) });
              return h('div', { class: 'rchart' + (ctx.narrow ? ' slim' : '') }, ...devs.map(row),
                h('div', { class: 'rrow axis', style: { gridTemplateColumns: cols, height: '22px' } }, h('span', { class: 'lbl' }), h('div', { class: 'ticks', style: { height: '22px' } }, ...[1, 3, 5, 7, 9, 11].map(tk))));
            },
            3: (pr) => {
              const cell = (t, w, cls) => h('span', { class: 'box ' + cls, style: { padding: '3px 8px', fontSize: '14px', minWidth: w, fontWeight: 700 } }, t);
              const left = pr === 0 ? ['H', 'i', '!'].map((c) => cell(c, '30px', 'io')) : ['%', '!', 'P', 'S', '…'].map((c) => cell(c, '30px', 'io'));
              const right = pr === 0 ? [cell('block 7 · 4,096 bytes', '0', 'mem')]
                : [cell('header', '0', 'os'), cell('data · up to 1,500 bytes', '0', 'mem')];
              return h('div', { class: 'grid-2', style: { gap: '12px' } },
                h('div', { class: 'row gap-s' }, ...left, h('span', { class: 'xs muted' }, pr === 0 ? '1 transfer each' : 'bytes in order, no block numbers')),
                h('div', { class: 'row gap-s' }, h('span', { class: 'row', style: { gap: '0' } }, ...right), h('span', { class: 'xs muted' }, '1 transfer')));
            },
          };
          let pair = 0, di = 0;
          const seen = new Set();
          const list = h('div', { class: 'stack', style: { gap: '6px' } });
          const dBtns = DIFFS.map((d, i) => h('button', { class: 'btn', type: 'button', style: { justifyContent: 'flex-start', height: '42px', gap: '10px' }, onclick: () => { di = i; paint(); } },
            h('span', { class: 'chip os', style: { minWidth: '26px', justifyContent: 'center' } }, String(i + 1)), h('span', { text: d.name })));
          list.append(...dBtns);
          const seenEl = h('p', { class: 'small muted m0' });
          const body = h('div', { class: 'stack', style: { gap: '12px' } });
          const seg = ctx.ui.seg(PAIRS.map((p) => ({ value: p.value, label: p.label })), pair, (v) => { pair = v; paint(); });
          function side(name, cat, short, text) {
            return h('div', { class: 'card io stack', style: { gap: '5px', padding: '12px 14px' } },
              h('div', { class: 'row', style: { justifyContent: 'space-between', gap: '6px' } }, h('b', { style: { color: 'var(--io)', fontSize: '16.5px' } }, name), h('span', { class: 'chip' }, cat)),
              h('div', { style: { fontSize: '17px', fontWeight: 800 } }, short),
              h('div', { style: { fontSize: '15.5px', lineHeight: '1.45' }, html: text }));
          }
          function paint() {
            const d = DIFFS[di], P = PAIRS[pair], c = d.p[pair];
            seen.add(di + '-' + pair);
            dBtns.forEach((b, i) => b.classList.toggle('on', i === di));
            seenEl.textContent = 'Cards seen: ' + seen.size + ' of ' + DIFFS.length * PAIRS.length + ' (6 differences × 2 pairs)';
            const title = d.t ? `<span class="t" data-t="${d.t}">${d.name}</span>` : d.name;
            body.replaceChildren(
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { class: 'm0', html: (di + 1) + '. ' + title }), h('span', { class: 'chip' }, P.label)),
              h('p', { class: 'm0', style: { fontSize: '16.5px', lineHeight: '1.5' }, html: d.gen }),
              h('div', { class: 'grid-2', style: { gap: '12px' } }, side(P.a, P.ac, SHORT[di][pair][0], c[0]), side(P.b, P.bc, SHORT[di][pair][1], c[1])),
              VIZ[di] ? VIZ[di](pair) : null,
              h('div', { class: 'callout m0', style: { fontSize: '15.5px' }, 'data-label': 'What the OS does about it', html: c[2] }));
            body.classList.remove('fade-in'); void body.offsetWidth; body.classList.add('fade-in');
          }
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: 'minmax(0, 300px) minmax(0, 1fr)' } },
            h('div', { class: 'stack', style: { gap: '9px' } },
              h('p', { class: 'm0', html: 'Because of these six differences, the OS cannot treat every device the same way. Pick a pair, then a difference.' }),
              seg, list, seenEl),
            h('div', { class: 'card white', style: { display: 'flex', flexDirection: 'column' } }, body)));
          paint();
        },
      },

      {
        title: 'Blocks or streams? A first look',
        kind: 'lab',
        render(el, ctx) {
          const { h } = ctx;
          const BS = 8, NB = 6, REAL = 4096, LINE = 'HELLO, OS!';
          const START = 'EVERY BLOCK HAS A NUMBER, SO THE OS CAN JUMP IN.'.padEnd(BS * NB, '.').slice(0, BS * NB);
          let disk, buf, dMoved, dTrans, typed, sMoved, pick = 2;
          const cells = (str, cls, chg) => h('span', { class: 'cells' }, ...str.split('').map((c, i) => h('span', { class: 'cell ' + (i === chg ? 'chg' : cls) }, c === ' ' ? '␣' : c)));
          /* stream side */
          const sVis = h('div', { class: 'stack', style: { gap: '8px' } });
          const sNarr = h('div', { class: 'narr', style: { minHeight: '96px' } });
          const sTally = h('div', { class: 'tally' });
          const bPress = h('button', { class: 'btn io', type: 'button', onclick: press }, 'Press the next key');
          const bAgain = h('button', { class: 'btn', type: 'button', onclick: again }, 'Ask for byte 3 again');
          /* block side */
          const dVis = h('div', { class: 'stack', style: { gap: '6px' } });
          const dNarr = h('div', { class: 'narr', style: { minHeight: '72px' } });
          const dTally = h('div', { class: 'tally' });
          const seg = ctx.ui.seg(ctx.util.range(NB).map((n) => ({ value: n, label: String(n), title: 'block ' + n })), pick, (v) => { pick = v; drawDisk(); });
          const bRead = h('button', { class: 'btn mem', type: 'button', onclick: read }, 'Read it');
          const bChg = h('button', { class: 'btn mem', type: 'button', onclick: change }, 'Change one letter');
          function drawStream() {
            const last = typed ? LINE[typed - 1] : null;
            sVis.replaceChildren(
              h('div', { class: 'row nw', style: { gap: '8px' } },
                h('span', { class: 'box io' }, 'Keyboard'),
                h('span', { class: 'chip ' + (last ? 'io' : ''), style: { fontFamily: 'var(--mono)' } }, last ? '→ ' + (last === ' ' ? '␣' : last) + ' →' : '→  →'),
                h('span', { class: 'box proc' }, 'Program')),
              h('div', { class: 'row gap-s' }, h('span', { class: 'xs muted b', style: { width: '112px' } }, 'PROGRAM KEPT'), cells(LINE.slice(0, typed), 'proc')),
              h('div', { class: 'row gap-s' }, h('span', { class: 'xs muted b', style: { width: '112px' } }, 'STILL TO TYPE'), cells(LINE.slice(typed), 'dim')));
            sTally.textContent = `Moved so far: ${sMoved} byte${sMoved === 1 ? '' : 's'} in ${sMoved} transfer${sMoved === 1 ? '' : 's'}`;
            bPress.disabled = typed >= LINE.length;
          }
          function drawDisk(chg) {
            dVis.replaceChildren(
              h('div', { class: 'grid-2', style: { gap: '4px 10px' } }, ...ctx.util.range(NB).map((n) => h('div', { class: 'blk' + (n === pick ? ' on' : '') }, h('span', { class: 'bn' }, 'block ' + n), cells(disk[n], 'mem', buf && buf.n === n ? chg : -1)))),
              h('div', { class: 'row gap-s' }, h('span', { class: 'xs muted b' }, buf ? `MEMORY BUFFER (COPY OF BLOCK ${buf.n})` : 'MEMORY BUFFER (EMPTY)'), cells(buf ? buf.data : '\u00a0'.repeat(BS), buf ? 'mem' : 'dim', chg)));
            dTally.textContent = `Moved so far: ${dMoved} bytes in ${dTrans} transfer${dTrans === 1 ? '' : 's'}`;
          }
          function press() {
            if (typed >= LINE.length) return;
            const c = LINE[typed++]; sMoved++;
            sNarr.className = 'narr';
            sNarr.innerHTML = `The keyboard sent <b>${c === ' ' ? 'a space' : c}</b> on its own: one byte, one transfer. It carries no number; it is simply the next byte in the stream.` + (typed === LINE.length ? ' That was the whole line.' : '');
            drawStream();
          }
          function again() {
            sNarr.className = 'narr bad';
            sNarr.innerHTML = typed < 3
              ? 'The third byte has not even been typed yet. A stream device delivers bytes when they happen, not when asked.'
              : `There is no “byte 3” to ask for. A stream has no addresses, so the keyboard cannot resend <b>${LINE[2]}</b>. The program still has it only because it saved its own copy.`;
          }
          function read() {
            buf = { n: pick, data: disk[pick] }; dMoved += BS; dTrans++;
            dNarr.className = 'narr';
            dNarr.innerHTML = `The OS asked for <b>block ${pick}</b> by its number, and the disk sent all ${BS} of its bytes in one transfer. No need to pass through the blocks before it.`;
            drawDisk(-1);
          }
          function change() {
            const old = disk[pick], at = old.search(/[A-Za-z]/), c = old[at], nc = c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase();
            disk[pick] = old.slice(0, at) + nc + old.slice(at + 1); buf = { n: pick, data: disk[pick] }; dMoved += 2 * BS; dTrans += 2;
            dNarr.className = 'narr ok';
            dNarr.innerHTML = `To change <b>1 byte</b> the OS read all ${BS} bytes of block ${pick} into memory, changed one there, then wrote all ${BS} back: <b>${2 * BS} bytes moved</b>. With real ${REAL.toLocaleString('en-US')}-byte blocks that is ${(2 * REAL).toLocaleString('en-US')} bytes.`;
            drawDisk(at);
          }
          function reset() {
            disk = ctx.util.range(NB).map((n) => START.slice(n * BS, n * BS + BS)); buf = null; dMoved = 0; dTrans = 0; typed = 0; sMoved = 0;
            sNarr.className = 'narr'; sNarr.innerHTML = 'Press keys to send the line <b>HELLO, OS!</b> one byte at a time. Then try asking for byte 3 again.';
            dNarr.className = 'narr'; dNarr.innerHTML = `A toy disk with ${NB} blocks of ${BS} bytes. Pick a block, read it, then change one letter and watch how many bytes move.`;
            drawStream(); drawDisk(-1);
          }
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },
            h('p', { class: 'm0', html: 'The <span class="t">unit of transfer</span> splits devices into two families. Section 11.4 builds its buffering schemes on this split; here is a first feel for it.' }),
            h('div', { class: 'split l grow', style: { gap: '14px' } },
              h('div', { class: 'card stack', style: { gap: '8px' } },
                h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', { style: { fontSize: '17px', color: 'var(--io)' }, html: '<span class="t" data-t="stream-oriented device">Stream-oriented</span>: a keyboard' }), h('span', { class: 'chip' }, 'no block numbers')),
                h('p', { class: 'm0 small muted' }, 'Bytes arrive one after another with no structure. Also: terminals, printers, mice, communication ports, and most devices that are not used for storage.'),
                sVis, h('div', { class: 'row gap-s' }, bPress, bAgain), sNarr, sTally),
              h('div', { class: 'card stack', style: { gap: '8px' } },
                h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', { style: { fontSize: '17px', color: 'var(--mem)' }, html: '<span class="t" data-t="block-oriented device">Block-oriented</span>: a disk' }), h('span', { class: 'chip' }, 'fixed-size, numbered blocks')),
                h('p', { class: 'm0 small muted' }, 'Data lives in fixed-size blocks, moved one whole block at a time and reached by block number. Also: SSDs and USB flash drives.'),
                dVis, h('div', { class: 'row gap-s' }, h('span', { class: 'small b' }, 'Block:'), seg, bRead, bChg), dNarr, dTally)),
            h('div', { class: 'row gap-s', style: { justifyContent: 'flex-end' } }, h('button', { class: 'btn sm', type: 'button', onclick: reset }, '↺ Reset both'))));
          reset();
        },
      },

      {
        title: 'Recap: what to remember about devices',
        kind: 'recap',
        render(el, ctx) {
          const { h } = ctx;
          el.append(h('div', { class: 'stack fill', style: { gap: '12px' } },
            h('p', { class: 'lead m0' }, 'Say each answer out loud before you flip the card.'),
            ctx.ui.flipcards([
              ['What are the three device categories?', '<b>Human readable</b> (talks with the user), <b>machine readable</b> (talks with electronic equipment), <b>communication</b> (talks with remote devices). Ask what is at the other end.'],
              ['How far apart are device data rates?', `About <b>nine orders of magnitude</b>: a keyboard ≈ ${orders(DEV[0])} bit/s, the fastest SSDs and network links ≈ 10¹⁰–10¹¹ bit/s. Compare them on a log scale.`],
              ['Name the six ways devices differ.', '<b>Data rate</b>, <b>application</b>, <b>complexity of control</b>, <b>unit of transfer</b>, <b>data representation</b>, <b>error conditions</b>.'],
              ['One disk, two jobs: what changes?', 'A disk holding files needs file-management software; a disk holding paging space needs virtual-memory hardware and software. The <b>application</b> decides the OS support.'],
              ['Block-oriented vs stream-oriented?', '<b>Block</b>: fixed-size numbered blocks, one whole block per transfer (disks, USB drives). <b>Stream</b>: bytes in sequence, no addresses (keyboards, terminals, printers, mice, ports).'],
              ['So why can the OS not treat all devices alike?', 'Speed, use, control, transfer size, encoding and errors all differ, so each device needs its own driver, buffering, error handling and policies, hidden behind one interface for programs.'],
            ], { cols: ctx.narrow ? 1 : 3, height: 182 }),
            h('div', { class: 'callout tip m0', 'data-label': 'Where this leads', html: 'Section 11.2 shows the three ways to move data (programmed I/O, interrupts, DMA), section 11.3 how the OS hides these differences behind one interface, and section 11.4 how buffers bridge the speed gaps.' })));
        },
      },

      {
        title: 'Check yourself',
        kind: 'check',
        quiz: [
          { type: 'bucket', q: 'Sort each device by what sits at the other end of it.',
            buckets: ['Human readable', 'Machine readable', 'Communication'],
            items: [['Tablet touchscreen', 0], ['Inkjet printer', 0], ['Joystick', 0], ['External SSD', 1], ['Motor actuator in a robot arm', 1], ['Thermostat temperature sensor', 1], ['Cable modem', 2], ['Ethernet network card', 2]],
            why: 'Human-readable devices exchange data with the user, machine-readable devices with electronic equipment (storage, sensors, actuators), and communication devices with remote machines. A printer is human readable because its pages are meant for people.' },
          { q: 'Two identical disks are installed. One holds users’ files; the other holds paging space for virtual memory. Which device difference explains why the OS puts different software in front of each?',
            choices: ['Data rate: a paging disk must spin much faster', 'Application: its use decides the software it needs', 'Unit of transfer: paging moves single bytes, not blocks', 'Error conditions: only a file disk can report errors'],
            answer: 1,
            feedback: ['The disks are identical, so their speed is the same. What differs is how each is used.', null, 'Paging moves whole pages, which are block-sized or larger, never single bytes.', 'Both disks can suffer bad sectors and report them in the same way.'],
            why: 'Application is about what a device is used for. Files need file-management software (directories, allocation, protection); paging space needs virtual-memory hardware and software.' },
          { q: 'A serial link uses <b>odd parity</b>. The 7 data bits of a character are <code>1011001</code>. Which parity bit is added?',
            choices: ['0, because the data already holds an even number of 1s', '1, because the last data bit is a 1', '0, because parity bits are only added to letters', '1, so the total number of 1s becomes odd'],
            answer: 3,
            feedback: ['An even count is exactly what odd parity must avoid; adding 0 would leave four 1s, an even number.', 'The parity bit depends on the count of all the 1s, not on the last bit alone.', 'Parity is added to every character the link sends, letters or not.', null],
            why: '1011001 holds four 1s. Odd parity needs an odd total, so the parity bit is 1, making five 1s. If any single bit later flips, the count becomes even and the receiver detects the error.' },
          { q: 'A network card receives a packet whose checksum does not match its contents. What usually happens next?',
            choices: ['It is dropped, and a protocol such as TCP has it resent', 'The OS terminates the receiving process with an error', 'The OS waits for a person to replace the network card', 'The card repairs it with the disk drive’s ECC bits'],
            answer: 0,
            feedback: [null, 'A single damaged packet is routine on a network and is never treated as a fault of the program.', 'One bad packet is not a hardware failure; no human action is needed.', 'ECC bits belong to the disk’s sectors and have nothing to do with network packets.'],
            why: 'Error conditions differ by device. Network errors are frequent and mild: the damaged packet is discarded and a reliable protocol notices the gap and gets it sent again, so programs rarely see the error.' },
          { type: 'num', q: 'A keyboard delivers about 10² bit/s and a hard disk about 10⁹ bit/s. How many seconds of typing deliver as much data as <b>one second</b> of the disk?',
            answer: 1e7, tol: 0, unit: 's',
            why: '10⁹ ÷ 10² = 10⁷ = 10,000,000 seconds, about 116 days of nonstop typing. The two rates are seven orders of magnitude apart.' },
          { type: 'num', q: 'A display shows 1920 × 1080 pixels, 24 bits per pixel, redrawn 60 times a second. How many gigabits per second (Gbit/s) must flow to it? Give one decimal place.',
            answer: 3.0, tol: 0.1, unit: 'Gbit/s',
            why: '1920 × 1080 × 24 × 60 = 2,985,984,000 bit/s ≈ 3.0 Gbit/s, which is why a graphics display sits near the top of the data-rate chart.' },
          { type: 'num', q: 'A disk uses 4,096-byte blocks. To change one byte inside a block, the OS reads the block and writes it back. How many bytes move between the disk and memory?',
            answer: 8192, tol: 0, unit: 'bytes',
            why: 'The unit of transfer is a whole block: 4,096 bytes in and 4,096 bytes out, 8,192 bytes in all, to change a single byte.' },
          { type: 'tf', q: 'A laser printer is a machine-readable device, because a machine rather than a person puts the marks on the paper.',
            answer: false,
            why: 'The category depends on who the device exchanges data with. A printer’s output is meant for people to read, so it is a human-readable device.' },
          { type: 'tf', q: 'A USB keyboard and a USB flash drive belong to different device categories, even though both plug into the same kind of port.',
            answer: true,
            why: 'True: the connector does not decide the category. The keyboard exchanges data with a person (human readable); the flash drive stores data for the computer (machine readable).' },
          { type: 'match', q: 'Match each device difference to an example of it.',
            pairs: [
              ['Data rate', 'A keyboard sends about 10² bit/s, an SSD about 10¹⁰ bit/s'],
              ['Application', 'An administrator’s terminal gets higher priority than other users’'],
              ['Complexity of control', 'A printer needs a few status bits; a disk needs a detailed command set'],
              ['Unit of transfer', 'A terminal sends one character at a time; a disk moves 4,096-byte blocks'],
              ['Data representation', 'Two devices disagree on whether parity is even or odd'],
              ['Error conditions', 'A paper jam needs a person; a lost packet is resent automatically'],
            ],
            why: 'These are the six ways devices differ, and each one is a reason the OS cannot handle every device with the same code and the same policies.' },
          { type: 'multi', q: 'Which of these are stream-oriented devices?',
            choices: ['Terminal', 'Hard disk drive', 'Mouse', 'USB flash drive', 'Printer', 'Serial communication port'],
            answer: [0, 2, 4, 5],
            why: 'Stream-oriented devices move bytes in sequence with no block numbers: terminals, mice, printers and communication ports. Disks and USB flash drives store fixed-size numbered blocks, so they are block-oriented.' },
          { type: 'order', q: 'Put these devices in order of typical data rate, slowest first.',
            items: ['Keyboard', 'Dial-up modem', 'Laser printer', 'Hard disk drive', '100 Gigabit Ethernet'],
            why: 'Roughly 10², 10⁴–10⁵, 10⁶–10⁷, 10⁹ and 10¹¹ bit/s: each step is more than ten times faster, which is why device speeds are compared on a log scale.' },
        ],
      },
    ],
    notes: `
      <h3>I/O devices: where the computer meets the world</h3>
      <p>Input/output (I/O) is every exchange of data between the computer and something outside it: a key press, a saved file, a network message. The devices involved are wildly different, and the operating system must drive all of them, hide their quirks from programs, and keep the processor busy while they work.</p>

      <h4>Three categories of external device</h4>
      <p>The classic grouping asks one question: <b>what is at the other end of the device?</b> Not the plug, not the speed.</p>
      <table>
        <tr><th>Category</th><th>Communicates with</th><th>Examples</th></tr>
        <tr><td><b>Human readable</b></td><td>the user</td><td>keyboard, mouse, display, printer, touchscreen, game controller</td></tr>
        <tr><td><b>Machine readable</b></td><td>electronic equipment</td><td>disk drives, USB flash drives, SSDs, sensors, actuators, controllers</td></tr>
        <tr><td><b>Communication</b></td><td>remote devices or computers</td><td>network interface cards, Wi-Fi adapters, modems, cellular radios</td></tr>
      </table>
      <p>A <b>sensor</b> measures something physical (temperature, light, motion) and reports it as data; an <b>actuator</b> turns a command into a physical action (a motor turns, a valve opens). A <b>modem</b> (modulator-demodulator) turns digital data into signals for a telephone or cable line and back. Two traps: a printer is <i>human readable</i> even though a machine prints, because its pages are for people; and a USB keyboard and a USB flash drive share a port but sit in different categories.</p>

      <h4>Difference 1: data rate</h4>
      <p>The <b>data rate</b> is how many bits per second a device can move (bit/s, kbit/s = 10³, Mbit/s = 10⁶, Gbit/s = 10⁹). Typical values, as orders of magnitude only:</p>
      <table>
        <tr><th>Device</th><th>Order of magnitude (bit/s)</th><th>Typical value</th></tr>
        ${DEV.map((d) => `<tr><td>${d.name}</td><td>${orders(d)}</td><td>${rate(d.rep)}</td></tr>`).join('')}
      </table>
      <p>From a keyboard (about ${rate(DEV[0].rep)}) to a 100 Gbit/s link is a factor of about ${sci(DEV[DEV.length - 1].hi / DEV[0].rep)}: roughly <b>nine orders of magnitude</b> (an order of magnitude is a factor of ten). On an ordinary linear chart a few hundred pixels wide, one pixel stands for a few times 10⁸ bit/s, so every device up to 100 Mbit/s Ethernet (half of the twelve) would be thinner than one pixel; that is why device speeds are drawn on a <b>logarithmic scale</b>, where each equal step multiplies the value by 10.</p>
      <p><b>Worked example 1.</b> Keyboard ≈ 10² bit/s, hard disk ≈ 10⁹ bit/s. One second of disk transfer equals 10⁹ ÷ 10² = 10⁷ seconds of typing, about 116 days. With the typical values above (${rate(DEV[0].rep)} and ${rate(DEV.find((d) => d.k === 'hdd').rep)}) it is ${sci(DEV.find((d) => d.k === 'hdd').rep / DEV[0].rep)} keyboard-seconds, about ${dur(DEV.find((d) => d.k === 'hdd').rep / DEV[0].rep)}.</p>
      <p><b>Worked example 2.</b> A 1920 × 1080 display with 24-bit colour redrawn 60 times a second needs 1920 × 1080 × 24 × 60 = 2,985,984,000 bit/s ≈ 3.0 Gbit/s. A 4K screen needs about four times as much.</p>
      <p><b>Why it matters:</b> a 3 GHz processor runs about 3 × 10⁸ clock cycles between two keystrokes, so one interrupt per key is cheap. A 10¹⁰ bit/s device delivers over a billion bytes a second, far too many for one interrupt each, so fast devices move whole blocks by DMA (section 11.2).</p>

      <h4>The six ways devices differ</h4>
      <p>Each difference is a reason the OS cannot treat all devices the same way.</p>
      <ol>
        <li><b>Data rate</b>: bits per second, spanning about nine orders of magnitude (above). Keyboard ≈ 10² vs hard disk ≈ 10⁹; laser printer ≈ 10⁶–10⁷ vs network card 10⁹–10¹¹.</li>
        <li><b>Application</b>: what the device is used for changes the software and policies it needs. A disk holding <i>files</i> needs file-management software (directories, space allocation, protection); a disk holding <i>paging space</i> needs virtual-memory hardware and software. A terminal used by an administrator may get a higher priority than an ordinary user's. A shared printer needs a <b>spooler</b>, a program that queues whole jobs on disk and feeds them to the printer one at a time; a network card needs protocol software that delivers each packet to the right process.</li>
        <li><b>Complexity of control</b>: how much work it takes to command the device and check its status. A keyboard or printer needs only a data register and a few status bits; a disk needs block numbers, directions, memory addresses, request queues, scheduling and retries; a network card needs circular lists of buffers, DMA and interrupt settings. The device's I/O module (controller) hides the lowest-level detail, such as moving a disk arm.</li>
        <li><b>Unit of transfer</b>: the size of one piece of data moved. A keyboard or terminal sends single characters as a stream; a printer receives a stream of bytes; a disk moves whole blocks of 512 or 4,096 bytes; a network card moves packets (on standard Ethernet up to 1,500 data bytes plus a header).</li>
        <li><b>Data representation</b>: how information is encoded as bits: the character code (ASCII, Unicode), formats of numbers and images, and conventions such as parity. A keyboard sends key numbers that the driver maps to characters through the layout; a disk stores raw bytes plus error-correcting code (ECC) bits; a printer expects a page-description language; network headers send multi-byte numbers most significant byte first (network byte order).</li>
        <li><b>Error conditions</b>: what can go wrong, how it is reported, how serious it is, and what can be done. A missed keystroke is simply retyped; an unreadable disk sector is retried and repaired with ECC if possible, otherwise reported and data may be lost; a paper jam needs a person; a network packet whose <b>checksum</b> (a short number computed from the data and sent with it) no longer matches is dropped, and a <b>protocol</b> (an agreed set of rules for the exchange) such as TCP has the sender send it again.</li>
      </ol>
      <p><b>Parity example.</b> A <b>parity bit</b> makes the count of 1s even (even parity) or odd (odd parity), so one flipped bit is detected. The letter A in 7-bit ASCII is 1000001 (two 1s): even parity adds 0, odd parity adds 1. For 1011001 (four 1s) odd parity adds 1, giving five 1s. Both ends of a link must use the same convention.</p>

      <h4>Block-oriented vs stream-oriented devices (preview of 11.4)</h4>
      <ul>
        <li><b>Block-oriented</b>: data is stored in fixed-size blocks, moved one whole block per transfer, and any block can be reached directly by its block number. Examples: disks, SSDs, USB flash drives.</li>
        <li><b>Stream-oriented</b>: data moves as a sequence of bytes with no block structure and no addresses; a byte the program did not keep cannot be asked for again. Examples: keyboards, terminals, printers, mice, communication ports, and most devices that are not secondary storage.</li>
      </ul>
      <p><b>Worked example.</b> To change one byte on a disk with 4,096-byte blocks, the OS reads the whole block into memory, changes the byte, and writes the whole block back: 2 × 4,096 = 8,192 bytes move to change one. With 512-byte blocks it is 1,024 bytes.</p>
    `,
  });
})();
