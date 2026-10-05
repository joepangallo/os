// Comment key: a line inside backtick text ends with ${/* comment */''}, an empty-string slot that holds a comment without changing the text on screen (full note at the top of the page).
/* =====================================================================
   6.11 Android Interprocess Communication
   Original teaching material. Small helpers shared by several steps live
   inside this IIFE (no globals).
   ===================================================================== */
(function () {  // wraps the whole section in a function that runs once, right away, so its names stay private to this file
  /* ---------- shared cast: the same apps and numbers appear in every step ---------- */
  const WIDGET = { name: 'Weather widget', uid: 10087, pid: 4120 };   // the client app
  const WEATHER = { name: 'Weather app', uid: 10112, pid: 5233 };     // the server app that hosts WeatherService
  const TEMPS = { Tampa: 88, Denver: 61, Chicago: 47 };               // what WeatherService.getTemp() answers (°F)

  /* hot(): an SVG group that behaves like a button (mouse, Enter and Space) */
  function hot(s, props, kids, fn) {  // hot(s, props, kids, fn): builds a clickable SVG group (SVG is the browser's drawing format) that runs fn when chosen
    return s('g', Object.assign({  // returns a g element (an SVG group); Object.assign merges the button settings below with the caller's own props
      class: 'hot', role: 'button', tabindex: 0, onclick: fn,  // class hot gives the pointer cursor and hover outline; role and tabindex 0 let screen readers and the Tab key reach it
      onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } },  // makes Enter and Space work like a click for keyboard users; preventDefault stops Space from scrolling the page
    }, props), ...kids);  // ends the settings; the caller's props are added last, then the shapes in kids go inside the group
  }  // ends hot()
  /* rbox(): a rounded rectangle from a {x, y, w, h} record */
  function rbox(s, r, cls, sw, extra) {  // rbox(s, r, cls, sw, extra): draws a rounded rectangle for the layout record r, used for nearly every box in the diagrams
    return s('rect', Object.assign({ x: r.x, y: r.y, width: r.w, height: r.h, rx: r.rx || 10, class: cls, 'stroke-width': sw || 2 }, extra || {}));  // makes the rect from r's position and size, corner radius 10 unless r says otherwise, class cls for the colour, border 2 wide by default
  }  // ends rbox()
  /* label(): centred SVG text (size, weight, extra style as options) */
  function label(s, x, y, str, o) {  // label(s, x, y, str, o): writes the text str at point (x, y) in a diagram; o holds optional anchor, size, weight, class and colour
    o = o || {};  // o defaults to an empty object so the options below can be read safely when the caller gives none
    return s('text', Object.assign({ x, y, 'text-anchor': o.anchor || 'middle', 'font-size': o.size || 14, 'font-weight': o.weight || 600 },  // builds a text element centred on x by default, 14 pixels tall and semi-bold unless o says otherwise
      o.cls ? { class: o.cls } : {}, o.fill ? { style: 'fill:' + o.fill } : {}), str);  // adds a CSS class if o.cls is given and an inline fill colour if o.fill is given; str becomes the visible text
  }  // ends label()
  /* utf16(): the code units a Java string is made of (what a parcel stores) */
  const utf16 = (str) => Array.from({ length: str.length }, (_, i) => str.charCodeAt(i));  // utf16(str): the list of UTF-16 code units (the 2-byte numbers Java uses to store characters) that make up str
  /* le32(): the four little-endian bytes of a 32-bit integer */
  const le32 = (n) => { const u = n >>> 0; return [u & 255, (u >>> 8) & 255, (u >>> 16) & 255, (u >>> 24) & 255]; };  // le32(n): splits n into four bytes, lowest first (little-endian); >>> 0 makes negatives use their two's complement bits
  const hex2 = (b) => b.toString(16).toUpperCase().padStart(2, '0');  // hex2(b): writes one byte as two uppercase hexadecimal digits, e.g. 10 becomes "0A", for the byte dump in step 4
  /* str16Bytes(): bytes a string takes in a parcel: a 4-byte length, 2 bytes per UTF-16 unit plus a 2-byte terminator, padded to a multiple of 4 */
  const str16Bytes = (str) => 4 + Math.ceil((2 * (str.length + 1)) / 4) * 4;  // str16Bytes(str): 4 bytes of length plus 2 per character and 2 for the terminator, rounded up to a multiple of 4
  const TOKEN = 'IWeather';   // the interface token every IWeather request starts with (shortened from the full interface name)
  /* anchor(): a point on one side of a box ('t' top, 'b' bottom, 'l' left, 'r' right) at fraction f along it */
  function anchor(r, side, f) {  // anchor(r, side, f): finds where an arrow should start or end on box r; used to draw the moving parcels in step 3
    if (side === 't') return [r.x + r.w * f, r.y];  // top edge: f of the way across from the left
    if (side === 'b') return [r.x + r.w * f, r.y + r.h];  // bottom edge: f of the way across from the left
    if (side === 'l') return [r.x, r.y + r.h * f];  // left edge: f of the way down from the top
    return [r.x + r.w, r.y + r.h * f];  // any other side is the right edge: f of the way down from the top
  }  // ends anchor()

  /* ---------- the marshalling lab's interface (step 4) ---------- */
  const METHODS = [  // METHODS: the three methods of the IWeather interface used in step 4; old is the parameter list of an older version of the file
    { name: 'getTemp', code: 1, ret: 'int', oneway: false, params: [['String', 'city']], old: [['int', 'zip']] },  // getTemp: method code 1, returns an int and waits; the older version took an int zip code instead of a city name
    { name: 'setAlert', code: 2, ret: 'boolean', oneway: false, params: [['String', 'city'], ['int', 'below'], ['boolean', 'buzz']], old: [['int', 'below'], ['String', 'city'], ['boolean', 'buzz']] },  // setAlert: method code 2, returns a boolean; the older version had the same parameters in a different order
    { name: 'reportSteps', code: 3, ret: 'void', oneway: true, params: [['int', 'steps']], old: [['String', 'day']] },  // reportSteps: method code 3, one-way with no return value; the older version took a String day instead of an int
  ];  // closes the METHODS list
  /* writeField(): append one value to a parcel the way the proxy does; returns the field record */
  function writeField(bytes, type, name, v) {  // writeField(bytes, type, name, v): appends one value to the byte list exactly as the proxy would, and describes where it went
    const start = bytes.length;  // start: the offset where this field begins, which is how many bytes the parcel already holds
    let used;  // used: how many of the field's bytes carry real data, before any padding zeros
    if (type === 'String') {  // strings need a length, the characters, a terminator and padding
      const u = utf16(v);  // u: the string's UTF-16 code units
      bytes.push(...le32(u.length));  // first a 4-byte length word saying how many characters follow
      u.forEach((c) => bytes.push(c & 255, c >>> 8));  // then each character as 2 bytes, low byte first (& 255 keeps the low 8 bits, >>> 8 gives the high 8 bits)
      bytes.push(0, 0);  // then a 2-byte zero terminator marking the end of the string
      used = bytes.length - start;  // records how many bytes were real data before padding
      while (bytes.length % 4) bytes.push(0);  // adds zero bytes until the parcel length is a multiple of 4, so the next field starts on a 4-byte boundary
    } else { bytes.push(...le32(type === 'boolean' ? (v ? 1 : 0) : v)); used = 4; }  // ints and booleans take one 4-byte word each (a boolean is written as 1 or 0), so used is always 4
    return { type, name, start, len: bytes.length - start, used, v };  // returns the field record: its type, name, start offset, total length with padding, bytes used and the value written
  }  // ends writeField()
  /* marshal(): the request parcel for method m with argument values args (interface token first) */
  function marshal(m, args) {  // marshal(m, args): builds the request parcel for method m, packing the argument values in args in declared order
    const bytes = [], fields = [writeField(bytes, 'String', 'token', TOKEN)];  // bytes: the growing parcel; fields starts with the interface token, which is always written first as a string
    m.params.forEach(([ty, nm], i) => fields.push(writeField(bytes, ty, nm, args[i])));  // writes each parameter in the order the interface declares it, recording a field for each
    return { bytes, fields };  // returns the raw bytes and the list of fields, which the byte grid in step 4 colours
  }  // ends marshal()
  /* unmarshal(): read the bytes back as a list of [type, name] pairs, stopping at the first impossible read */
  function unmarshal(bytes, types) {  // unmarshal(bytes, types): reads bytes back as the [type, name] list the stub expects, the way the stub would
    let pos = 0;  // pos: the read position, which moves forward through the parcel
    const out = [];  // out: one record per field read, good or failed
    const rd32 = (p) => (bytes[p] | (bytes[p + 1] << 8) | (bytes[p + 2] << 16) | (bytes[p + 3] << 24));  // rd32(p): reads the four bytes at offset p as a 32-bit number, lowest byte first; the shift by 24 makes it signed
    for (const [type, name] of types) {  // reads one field for each expected [type, name] pair, in order
      const at = pos;  // at: the offset where this field's read starts, shown in the stub's read list
      if (pos + 4 > bytes.length) { out.push({ type, name, at, ok: false, why: `needs 4 bytes at offset ${pos}, but the parcel ends at ${bytes.length}` }); break; }  // fails if fewer than 4 bytes remain, records why and stops reading (break leaves the loop)
      const n = rd32(pos);  // n: the next 4-byte word, which is the value of an int or boolean or the length of a string
      if (type !== 'String') { out.push({ type, name, at, ok: true, v: type === 'boolean' ? n !== 0 : n }); pos += 4; continue; }  // an int or boolean is complete in one word: records it (nonzero means true) and moves on 4 bytes
      const need = 2 * (n + 1), left = bytes.length - pos - 4;  // for a string: need is the bytes its characters and terminator take; left is how many bytes remain after the length word
      if (n < 0 || need > left) { out.push({ type, name, at, ok: false, len: n, why: `the length word says ${n.toLocaleString('en-US')} characters (${need.toLocaleString('en-US')} bytes), but only ${Math.max(0, left)} bytes are left` }); break; }  // a negative length or one that runs past the end of the parcel is impossible: records why and stops
      let str = '';  // str collects the characters as they are read
      for (let i = 0; i < n; i++) str += String.fromCharCode(bytes[pos + 4 + 2 * i] | (bytes[pos + 5 + 2 * i] << 8));  // reads n characters of 2 bytes each, low byte first, and turns each code back into a letter
      const term = bytes[pos + 4 + 2 * n] | (bytes[pos + 5 + 2 * n] << 8);  // term: the 2 bytes right after the characters, which should be the zero terminator
      if (term !== 0) { out.push({ type, name, at, ok: false, len: n, why: `after ${n} character${n === 1 ? '' : 's'} there should be a zero terminator, but the bytes there hold ${term}` }); break; }  // if they are not zero the bytes were not really a string: records the problem and stops
      out.push({ type, name, at, ok: true, v: str, len: n });  // a correct string: records its value and length
      pos += 4 + Math.ceil(need / 4) * 4;  // moves past the length word and the characters, rounded up to a multiple of 4 to skip the padding
    }  // ends the loop over fields
    return out;  // hands back the list of reads for the stub's panel in step 4
  }  // ends unmarshal()

  /* txFrames(): every frame of the step-3 transaction, computed from the chosen call.
     Each frame lists box texts, highlighted boxes, the moving parcels (routes) and the parcel panel. */
  function txFrames(oneway, city, steps) {  // txFrames(oneway, city, steps): builds every frame of the step 3 animation for a two-way getTemp or a one-way reportSteps
    const T = TEMPS[city], before = 5280;  // T: the temperature the service will answer for city; before: the step count already recorded today, used by the one-way call
    const req = oneway ? [['interface token', '"' + TOKEN + '"', str16Bytes(TOKEN)], ['int steps', String(steps), 4]]  // req: the rows of the request parcel as [label, value shown, bytes]; one-way sends the token and an int steps
      : [['interface token', '"' + TOKEN + '"', str16Bytes(TOKEN)], ['String city', '"' + city + '"', str16Bytes(city)]];  // two-way sends the token and the String city
    const reqB = req.reduce((a, r) => a + r[2], 0);  // reqB: total bytes in the request parcel, the sum of the rows' sizes
    const rep = [['int status', '0 (no exception)', 4], ['int result', String(T), 4]];  // rep: the reply parcel's rows: a status word 0 (no exception) then the int result, 4 bytes each
    const repB = rep.reduce((a, r) => a + r[2], 0);  // repB: total bytes in the reply parcel (8)
    const call = oneway ? `w.reportSteps(${steps})` : `w.getTemp("${city}")`;  // call: the line of code T1 runs, filled in with the chosen city or step count, shown in T1's box
    const P = (title, rows, st) => ({ title, rows: rows.map((r) => r.concat([st])) });  // P(title, rows, st): builds the parcel panel's record, tagging every row with its state st (new, done or read) for colouring
    const base = {  // base: what every box shows before the first frame; each frame starts from the one before it
      t1: ['thread T1 (your code)', 'running'], t1c: 's-thread', proxy: ['proxy', 'not created yet'], cbuf: 'empty',  // T1 box text and colour class, the proxy not yet made, and the widget's receive buffer empty
      sm: ['servicemanager', '"weather" → Weather app'], drv: ['idle', ''], sbuf: 'empty', pool: ['asleep', 'asleep', 'asleep'],  // the service manager's entry for "weather", the driver idle, the weather app's buffer empty and its three Binder threads asleep
      stub: ['waiting'], svc: [oneway ? 'today: ' + before : 'getTemp()'], parcel: null, routes: [], on: [],  // stub waiting; the service box shows today's step total (one-way) or getTemp() (two-way); no parcel, no arrows, no highlighted boxes
    };  // ends base
    const F = [];  // F: the list of frames being built, in playing order
    const add = (o) => { const prev = F.length ? F[F.length - 1] : base; F.push(Object.assign({}, prev, { routes: [], on: [] }, o)); };  // add(o): copies the previous frame (or base), clears its arrows and highlights, then applies the changes in o
    add({ cap: `<b>Two processes, two address spaces.</b> The widget (UID ${WIDGET.uid}) wants to call ${oneway ? `reportSteps(${steps})` : `getTemp("${city}")`}. The weather app (UID ${WEATHER.uid}) runs WeatherService, listed with the <span class="t">service manager</span> as "weather" (simplified: real phones list only system services there; an app's service is reached with bindService()). Its three <span class="t" data-t="binder thread pool">Binder threads</span> sleep inside the driver, waiting for work.` });  // frame 1 caption: two processes and two address spaces, and the weather app's Binder threads asleep in the driver
    add({ cap: '<b>Find the service by name.</b> T1 calls lookUp("weather"). That is itself a small Binder call, sent through a ready-made proxy for the service manager, which every process reaches through <span class="t" data-t="binder handle">handle 0</span>. The driver gives the widget a new handle, <b>handle 1</b>, that refers to WeatherService, and the library wraps it in a <span class="t">proxy</span>.',  // frame 2 caption: looking up "weather" through handle 0 gives the widget handle 1, wrapped in a new proxy
      t1: ['thread T1 (your code)', 'lookUp("weather")'], proxy: ['proxy', 'created: wraps handle 1'], sm: ['servicemanager', 'lookup "weather" → handle 1'],  // frame 2 box texts: T1 calls lookUp, the proxy is created around handle 1, the service manager answers
      drv: ['call to handle 0 (service manager)', 'reply: widget now holds handle 1'], routes: [['proxy-drv', 'lookup'], ['drv-sm', 'lookup']], on: ['sm', 'drv'],  // frame 2: the driver carries the lookup to handle 0; arrows run proxy to driver and driver to service manager
      parcel: P('lookup request to handle 0', [['String name', '"weather"', str16Bytes('weather')]], 'new') });  // frame 2 parcel panel: the small lookup request that carries the name "weather"
    add({ cap: `<b>An ordinary-looking call.</b> T1 runs <code>${oneway ? call : 't = ' + call}</code>. w is the proxy, a local object that implements IWeather, so to T1 this is a normal method call.${oneway ? ' In the AIDL file this method is declared <code>oneway</code>.' : ''} Nothing has left the process yet.`,  // frame 3 caption: T1 calls the method on the proxy like any local method; nothing has left the process yet
      t1: ['thread T1 (your code)', call], proxy: ['proxy', oneway ? 'reportSteps() called' : 'getTemp() called'], sm: base.sm, drv: base.drv, routes: [['t1-proxy', null]], on: ['t1', 'proxy'], parcel: null });  // frame 3: T1 and the proxy show the call, the service manager and driver return to their starting text, and the parcel panel empties
    add({ cap: `<b><span class="t">Marshalling</span>.</b> The proxy fills a <span class="t">parcel</span>: first an interface token naming IWeather, so the server can check the request is meant for this interface, then ${oneway ? `the int ${steps} as 4 bytes` : `the string "${city}" as a length (${city.length}) followed by its UTF-16 characters`}. Total: <b>${reqB} bytes</b>. Only plain values go in; a pointer would mean nothing in the other process.`,  // frame 4 caption: marshalling: the proxy writes the interface token and then the argument into the request parcel
      proxy: ['proxy', 'writes the request parcel'], parcel: P(`request parcel · ${reqB} bytes`, req, 'new'), on: ['proxy', 'parcel'] });  // frame 4: the request parcel appears with its rows marked new (just written)
    if (!oneway) add({ cap: '<b>Into the kernel.</b> The proxy calls transact(code 1 = getTemp, parcel, flags 0), and T1 enters the <span class="t">Binder driver</span> with a system call (an ioctl on /dev/binder). Because this is a two-way call, <b>T1 now blocks</b> until the reply comes back.',  // frame 5 for a two-way call, caption: transact() enters the Binder driver with a system call, and T1 blocks
      t1: ['thread T1 (your code)', 'blocked: waiting for the reply'], t1c: 's-warn', proxy: ['proxy', 'transact(code 1, flags 0)'], drv: ['transaction: handle 1, code 1, two-way', `${reqB} bytes from PID ${WIDGET.pid}`],  // frame 5 two-way: T1 turns amber (s-warn) to show it is blocked; the driver shows the two-way transaction and the sender's PID
      parcel: P(`request parcel · ${reqB} bytes`, req, 'done'), routes: [['proxy-drv', 'parcel']], on: ['drv', 't1'] });  // frame 5: the parcel rows are marked done (travelling) and an arrow carries the parcel from the proxy to the driver
    else add({ cap: `<b>One-way: no waiting.</b> The proxy calls transact(code 3 = reportSteps, parcel, FLAG_ONEWAY). The driver accepts the transaction and queues it, and <b>T1 returns at once</b>: a <span class="t">one-way call</span> never blocks its caller for a reply.`,  // frame 5 for a one-way call, caption: transact() with FLAG_ONEWAY, and T1 returns at once
      t1: ['thread T1 (your code)', 'carries on at once ✓'], t1c: 's-ok', proxy: ['proxy', 'transact(code 3, ONEWAY)'], drv: ['transaction: handle 1, code 3, one-way', `${reqB} bytes from PID ${WIDGET.pid}`],  // frame 5 one-way: T1 turns green and carries on; the driver shows a one-way transaction for method code 3
      parcel: P(`request parcel · ${reqB} bytes`, req, 'done'), routes: [['proxy-drv', 'parcel']], on: ['drv', 't1'] });  // the same travelling parcel and proxy-to-driver arrow as the two-way case
    add({ cap: `<b>One copy, plus an ID stamp.</b> The driver turns handle 1 into the real target: WeatherService in PID ${WEATHER.pid}. It records the sender, <b>UID ${WIDGET.uid}${oneway ? '</b> (a one-way call carries no caller PID)' : `, PID ${WIDGET.pid}</b>`}, which the caller cannot fake, and copies the ${reqB} bytes <b>once</b>, straight into a buffer that the weather app has mapped from the driver.`,  // frame 6 caption: the driver finds the real target, stamps the sender's identity and copies the bytes once
      drv: [`handle 1 → WeatherService in PID ${WEATHER.pid}`, `from UID ${WIDGET.uid}${oneway ? '' : ', PID ' + WIDGET.pid} · copied once`], sbuf: reqB + ' B in', routes: [['drv-sbuf', 'parcel']], on: ['drv', 'sbuf'] });  // frame 6: the driver shows the target and sender, the weather app's buffer shows the bytes that arrived, and an arrow leads there
    add({ cap: '<b>A Binder thread takes the job.</b> B1 was asleep inside the driver. It wakes up holding the transaction. The weather app\'s main thread is not disturbed: incoming calls run on the <span class="t">Binder thread pool</span>, and B2 and B3 stay free for other callers.',  // frame 7 caption: Binder thread B1 wakes with the job while the weather app's main thread is left alone
      pool: ['busy', 'asleep', 'asleep'], drv: oneway ? ['idle', ''] : ['holds the open transaction', 'T1 stays blocked until the reply'], routes: [['sbuf-pool', null]], on: ['pool'] });  // frame 7: B1 turns busy; the driver goes idle for one-way or holds the open transaction for two-way
    add({ cap: `<b><span class="t">Unmarshalling</span>.</b> On B1, the <span class="t">stub</span>'s onTransact() sees code ${oneway ? '3, so the call is reportSteps' : '1, so the call is getTemp'}. It checks the interface token ("${TOKEN}" ✓), then reads ${oneway ? `an int: steps = ${steps}` : `a string: length ${city.length}, then the characters, so city = "${city}"`}. It reads in exactly the order the proxy wrote.`,  // frame 8 caption: unmarshalling: the stub checks the method code and token, then reads the argument in the same order
      stub: oneway ? ['steps =', String(steps)] : ['city =', `"${city}"`], parcel: P(`request parcel · ${reqB} bytes`, req, 'read'), routes: [['pool-stub', null]], on: ['stub', 'parcel'] });  // frame 8: the stub shows the value it read, and the parcel rows are marked read
    if (!oneway) {  // from here the two-way and one-way calls end differently
      add({ cap: `<b>The real work.</b> The stub calls the service object's getTemp("${city}") like any local method. It looks the city up and returns <b>${T}</b>. This is ordinary code: WeatherService never sees a parcel.`,  // frame 9 two-way caption: the stub calls the service's getTemp(), which returns the temperature
        svc: ['returned ' + T], routes: [['stub-svc', null]], on: ['svc'] });  // frame 9: the service box shows the returned value, with an arrow from stub to service
      add({ cap: `<b>Packing the answer.</b> The stub writes a reply parcel: first a status word, 0, meaning "no exception" (an error would be written here and rethrown in the client), then the int ${T}. ${repB} bytes.`,  // frame 10 caption: the stub packs the reply parcel: status 0 (no exception), then the int result
        stub: ['writes', 'the reply'], parcel: P(`reply parcel · ${repB} bytes`, rep, 'new'), routes: [['svc-stub', null]], on: ['stub', 'parcel'] });  // frame 10: the reply parcel appears marked new, with an arrow from service back to stub
      add({ cap: `<b>Back the same way.</b> B1 sends the reply. The driver copies the ${repB} bytes once into the widget's receive buffer and wakes T1. B1 goes back to sleep in the driver, ready for the next caller.`,  // frame 11 caption: the reply is copied once into the widget's buffer, T1 wakes, and B1 goes back to sleep
        drv: [`reply → PID ${WIDGET.pid}`, `${repB} bytes, copied once`], cbuf: repB + ' B in', sbuf: 'freed', pool: ['asleep', 'asleep', 'asleep'], stub: ['waiting'], t1: ['thread T1 (your code)', 'waking up'],  // frame 11: driver carries the reply, widget buffer fills, weather app buffer is freed, the pool sleeps again and T1 is waking
        parcel: P(`reply parcel · ${repB} bytes`, rep, 'done'), routes: [['stub-drv', 'reply'], ['drv-cbuf', 'reply']], on: ['drv', 'cbuf'] });  // frame 11: reply rows marked done and two arrows labelled reply, stub to driver and driver to widget buffer
      add({ cap: `<b>Done.</b> The proxy unmarshals the reply: status 0, so no error; then the int, ${T}. getTemp() returns ${T} and T1 carries on with t = ${T}, as if a local method had answered. The round trip crossed the kernel twice, with one copy each way.`,  // frame 12 caption: the proxy unmarshals the reply and getTemp() returns the value to T1
        t1: ['thread T1 (your code)', `t = ${T} ✓`], t1c: 's-ok', proxy: ['proxy', `returns ${T}`], cbuf: 'read', drv: ['idle', ''],  // frame 12: T1 turns green with its answer, the proxy returns, the buffer is read and the driver goes idle
        parcel: P(`reply parcel · ${repB} bytes`, rep, 'read'), routes: [['cbuf-proxy', null], ['proxy-t1', null]], on: ['t1', 'proxy'] });  // frame 12: reply rows marked read, with arrows from the buffer to the proxy and from the proxy back to T1
    } else {  // the one-way ending
      add({ cap: `<b>The real work.</b> The stub calls reportSteps(${steps}) on the service object, which adds it to today's total: ${before} + ${steps} = <b>${before + steps}</b>.`,  // frame 9 one-way caption: the stub calls reportSteps(), which adds the steps to today's total
        svc: ['today: ' + (before + steps)], routes: [['stub-svc', null]], on: ['svc'] });  // frame 9: the service box shows the new total, with an arrow from stub to service
      add({ cap: '<b>No reply.</b> A one-way call has no reply parcel, so the widget never learns whether reportSteps worked. If it needs to know, it must make a two-way call. One-way calls to the same object are delivered one at a time, in the order they were sent.',  // frame 10 one-way caption: no reply parcel, so the widget never learns the result; one-way calls arrive in order
        stub: ['waiting'], pool: ['asleep', 'asleep', 'asleep'], sbuf: 'freed', drv: ['idle', ''], parcel: null, on: ['t1'] });  // frame 10: every box returns to rest and the parcel panel empties
    }  // ends the one-way branch
    return F;  // hands the finished frames to the player in step 3
  }  // ends txFrames()

  Guide.section({  // Guide.section(...): registers this section with the guide, with its steps, glossary terms, styles, quiz and notes
    id: '6.11',  // the section number, used in slide keys such as "6.11/3" and in the page's section class
    title: 'Android Interprocess Communication',  // the full title shown in the heading and the contents list
    short: 'Android IPC',  // a shorter title for places with little room, such as the chapter overview list
    summary: 'How Binder lets sandboxed Android apps call methods in other processes: proxy, parcel, driver, threads.',  // one-sentence summary of the section, shown in overviews
    objectives: [  // objectives: what a student should be able to do after this section, listed on the printable guide
      'Explain why sandboxed Android apps must communicate through the kernel, and why Android adds Binder to the Linux IPC tools.',  // objective 1: why sandboxed apps must go through the kernel, and why Binder is added
      'Describe a remote procedure call and trace one Binder transaction through proxy, parcel, driver, Binder thread, stub and service, two-way and one-way.',  // objective 2: trace one Binder call through every part, two-way and one-way
      'Marshal a method call into a parcel, unmarshal it again, and explain why proxy and stub must come from the same AIDL interface.',  // objective 3: marshal and unmarshal a call, and why both sides need the same AIDL file
      'Predict how a server\'s Binder thread pool serves several callers at once, including when every thread is busy.',  // objective 4: predict how a thread pool serves many callers, even when all threads are busy
      'Explain what the Binder driver adds (one copy, caller identity, counted references, a service registry) and compare Binder with pipes and shared memory.',  // objective 5: what the driver adds, and how Binder compares with pipes and shared memory
    ],  // closes the objectives list
    terms: [  // terms: glossary entries as [term, definition]; dotted words in the text show these definitions
      ['Binder', 'Android\'s main interprocess communication mechanism: a kernel driver plus user-space libraries that let a thread in one process call a method on an object in another process as if the object were local.'],  // glossary entry: defines Binder, the kernel driver plus libraries for calling methods in other processes
      ['Binder driver', 'The part of Binder that lives inside the Linux kernel (opened as /dev/binder). It carries every transaction between processes, copies the data, records who sent it and keeps track of object references.'],  // glossary entry: defines the Binder driver, the kernel part opened as a device file
      ['Remote procedure call (RPC)', 'A call that looks like an ordinary procedure call in the caller\'s code, but the procedure really runs in another process (or on another machine); the arguments and the result travel between them as messages.'],  // glossary entry: defines a remote procedure call
      ['Proxy', 'The client-side stand-in for a remote object. It offers the same methods as the real object, but each method only packs its arguments into a parcel, sends it through Binder and unpacks the reply.'],  // glossary entry: defines a proxy, the client's stand-in for a remote object
      ['Stub', 'The server-side partner of a proxy. It receives an incoming transaction, unpacks the arguments, calls the real method on the service object, and packs the result into a reply.'],  // glossary entry: defines a stub, the server half that unpacks and calls the real method
      ['Parcel', 'A flat container of data (numbers, strings, object references, file descriptors) laid out byte by byte so that it can be copied from one process into another. Binder requests and replies travel as parcels.'],  // glossary entry: defines a parcel, the flat container that travels between processes
      ['Marshalling', 'Packing a call\'s arguments (or its result) into a flat, agreed format such as a parcel, so that the values can cross a process boundary.'],  // glossary entry: defines marshalling, packing values into an agreed format
      ['Unmarshalling', 'The reverse of marshalling: reading the fields back out of a parcel, in the agreed order, to rebuild the original values.'],  // glossary entry: defines unmarshalling, reading the values back in the agreed order
      ['Binder transaction', 'One message carried by the Binder driver: the target object, a method code, flags such as one-way, the parcel of data, and the sender\'s identity, which the driver adds.'],  // glossary entry: defines a Binder transaction and what it carries
      ['Binder thread pool', 'A set of threads in a server process that wait inside the Binder driver for incoming calls. Each incoming transaction is handed to one free thread of the pool.'],  // glossary entry: defines the Binder thread pool that serves incoming calls
      ['One-way call', 'A Binder call (declared oneway) whose caller does not wait for a reply: it carries on as soon as the driver has accepted the transaction.'],  // glossary entry: defines a one-way call, whose caller does not wait
      ['Service manager', 'A special Android process that acts as the registry of named system services. They register under a name; clients look the name up and receive a reference (an ordinary app\'s service is reached through the system with bindService() instead). Every process reaches it through handle 0.'],  // glossary entry: defines the service manager, the registry of named system services reached through handle 0
      ['Binder handle', 'A small per-process number that names a remote Binder object, much as a file descriptor names an open file. The driver turns handles into the real objects and counts the references to each object.'],  // glossary entry: defines a Binder handle, a per-process number like a file descriptor
      ['Calling UID', 'The Linux user ID (and, for a two-way call, the process ID) of whoever sent the Binder call now being served. The driver records it, so the caller cannot forge it and the service can trust it for permission checks.'],  // glossary entry: defines the calling UID, the identity the driver records for each call
      ['AIDL (Android Interface Definition Language)', 'A small language for declaring the methods of a Binder interface. Build tools turn one AIDL file into matching proxy and stub code, so both sides pack and unpack parcels in exactly the same way.'],  // glossary entry: defines AIDL, the language that both proxy and stub are generated from
      ['Intent', 'A message object that asks Android to start an activity or a service, or announces an event to every app that registered for it. Intents reach the system through Binder.'],  // glossary entry: defines an intent, a message asking Android to start something or announcing an event
      ['Content provider', 'An app component that shares a set of data, such as the contacts list, through a standard query interface. Other apps reach it through Binder, and it can check their permissions.'],  // glossary entry: defines a content provider, a component that shares data through queries
      ['Bound service', 'A service that other components connect (bind) to and then call directly through a Binder interface for as long as they stay connected.'],  // glossary entry: defines a bound service, one that clients connect to and call directly
      ['Pipe', 'A one-way channel of bytes kept by the kernel: one process writes bytes in at one end and another reads them out, in the same order, at the other.'],  // glossary entry: defines a pipe, a one-way byte channel kept by the kernel
    ],  // closes the glossary list
    css: ` /* css: this section's own style rules; each starts with .sec-6-11 so it affects only this section's slides */
      .sec-6-11 .narr { background: var(--panel-2); border: 1px solid var(--line); border-left: 5px solid var(--chc); border-radius: 12px; padding: 9px 13px; font-size: 15.5px; line-height: 1.45; } /* .narr: the narration box under the diagrams: pale fill, thin border, thick left bar in the chapter colour */
      .sec-6-11 .narr.ok { border-left-color: var(--ok); background: var(--ok-bg); } /* .narr.ok: a success message turns the bar and the fill green */
      .sec-6-11 .narr.bad { border-left-color: var(--bad); background: var(--bad-bg); } /* .narr.bad: a failure message turns the bar and the fill red */
      .sec-6-11 .hot { cursor: pointer; } /* clickable diagram parts show the pointing-hand cursor */
      .sec-6-11 .hot:focus { outline: none; } /* removes the browser's default focus ring on clickable diagram parts; the thicker border below shows focus instead */
      .sec-6-11 .hot:focus-visible rect, .sec-6-11 .hot:hover rect { stroke-width: 3.5; } /* a clickable part that has keyboard focus or the mouse over it gets a thicker border on its rectangle */
      .sec-6-11 .split > *, .sec-6-11 .grid-2 > *, .sec-6-11 .grid-3 > * { min-width: 0; } /* lets the columns of side-by-side layouts shrink below their content, so a wide drawing cannot stretch the slide */
      .sec-6-11 .bgrid { display: grid; grid-template-columns: 30px repeat(16, minmax(0, 1fr)); gap: 3px; font-family: var(--mono); font-size: 13px; } /* .bgrid: the byte dump grid in step 4: an offset column of 30px then equal byte columns, in fixed-width digits */
      .sec-6-11 .bgrid .off { color: var(--muted); font-size: 12.5px; align-self: center; } /* the offset at the start of each row of bytes, in grey and slightly smaller */
      .sec-6-11 .bgrid .b { text-align: center; padding: 2px 0; border-radius: 4px; border: 2px solid transparent; font-weight: 700; } /* one byte cell: centred bold digits with a clear 2px border, so highlighting a cell later does not shift the grid */
      .sec-6-11 .bgrid .f-token { background: var(--os-bg); color: var(--os); } /* bytes of the interface token are coloured purple */
      .sec-6-11 .bgrid .f-str { background: var(--mem-bg); color: var(--mem); } /* bytes of a String field are coloured green */
      .sec-6-11 .bgrid .f-int { background: var(--cpu-bg); color: var(--cpu); } /* bytes of an int field are coloured blue */
      .sec-6-11 .bgrid .f-bool { background: var(--io-bg); color: var(--io); } /* bytes of a boolean field are coloured orange */
      .sec-6-11 .bgrid .pad { opacity: .5; } /* padding bytes are faded to half strength, since they carry no data */
      .sec-6-11 .bgrid .sel { border-color: var(--ink-2); } /* the bytes of the selected field get a dark border so the student can see which bytes it owns */
      .sec-6-11 .bgrid .bad { border-color: var(--bad); border-style: dashed; } /* bytes where the stub's read failed get a dashed red border */
      .sec-6-11 .flip-face.back { font-size: 15px; line-height: 1.45; } /* the back of the recap flip cards uses slightly smaller text so the longer answers fit */
      .sec-6-11 .cityin { font: 600 15px var(--mono); padding: 4px 8px; width: 9.5em; border: 1px solid var(--line-2); border-radius: 8px; background: var(--panel); color: var(--ink); } /* .cityin: the city text box in step 4, in fixed-width bold text, about 10 characters wide, with a rounded border */
    `,  // end of the css text
    steps: [  // steps: the slides of this section, in the order the student sees them
      /* ---------------- 1. Big picture: sandboxed apps must talk through the kernel ---------------- */
      {  // opens step 1
        title: 'Every app lives in its own locked room',  // step 1 title
        kind: 'story',  // kind 'story' marks this as the section's big-picture opening step
        html: `${/* html: the fixed content of step 1 written as HTML text; render() below fills in its empty boxes */''}
          <div class="split fill">${/* two columns that fill the height of the step */''}
            <div class="stack" style="gap:9px">${/* left column: paragraphs stacked 9px apart */''}
              <p class="lead m0">Every Android app runs walled off from the others, yet apps and the system need each other all day long.</p>${/* opening sentence: apps are walled off from each other but still need each other */''}
              <p class="m0">Each app normally gets its own <span class="t">process</span> and its own Linux <span class="t" data-t="user ID">user ID</span> (UID): the <span class="t">application sandbox</span>. The kernel stops one process from touching another one's memory or files. So a request from one app to another, or to a system service, has to travel <b>through the kernel</b>.</p>${/* paragraph: each app's own process and UID form the sandbox, so requests between apps must pass through the kernel */''}
              <p class="m0">Linux already offers <span class="t">interprocess communication</span> tools: pipes, shared memory, sockets and signals. Android adds <span class="t">Binder</span>, a lightweight <span class="t" data-t="remote procedure call">remote procedure call</span> mechanism, thrifty with memory and processor time as a battery-powered phone needs. <b>All interaction between app components in different processes goes through Binder.</b></p>${/* paragraph: the Linux IPC tools, and Binder, the lightweight RPC mechanism Android adds for phones */''}
              <div class="callout analogy m0" data-label="Analogy">An office tower where every company has a locked floor. To ask another company for something you fill in a standard form; the lobby mail desk (the kernel) stamps your name on it, carries it upstairs and brings the answer back.</div>${/* analogy callout: locked office floors and a lobby mail desk that stamps the sender's name */''}
              <div class="row gap-s small"><span class="chip proc">follow one call frame by frame</span><span class="chip mem">pack a parcel byte by byte</span><span class="chip thread">swamp a thread pool</span><span class="chip intr">catch an impostor</span></div>${/* row of coloured chips previewing the hands-on activities in later steps */''}
            </div>${/* ends the left column */''}
            <div class="card stack s1-card" style="gap:8px">${/* right column: a card that holds the clickable phone diagram */''}
              <h4 class="m0">Inside the phone: click any part</h4>${/* card heading inviting the student to click any part */''}
              <div class="s1-svg"></div>${/* empty box where render() puts the drawing */''}
              <div class="row gap-s s1-try"></div>${/* empty row where render() puts the two Try buttons */''}
              <div class="card white tight grow s1-detail" style="display:flex;flex-direction:column;gap:5px"></div>${/* empty box that explains whichever part was clicked */''}
            </div>${/* ends the right card */''}
          </div>`,  // ends the two columns and the html text
        render(el, ctx) {  // render(el, ctx): runs when step 1 opens; draws the clickable diagram and adds the Try buttons
          const { h, s } = ctx;  // takes the HTML builder h and the SVG builder s out of ctx, the toolbox the guide gives each step
          const small = ctx.narrow;  // small is true on phone-width screens, which get a taller drawing
          const G = small ? {  // G: the layout of the drawing; first the phone-width version
            vb: '0 0 340 380', procs: { system: { x: 4, y: 22, w: 332, h: 50 }, client: { x: 4, y: 82, w: 162, h: 84 }, server: { x: 174, y: 82, w: 162, h: 84 } },  // phone-width viewBox (the drawing's coordinate area) and the process boxes: system_server on top, the two apps side by side below
            kernel: { x: 4, y: 182, w: 332, h: 194 }, klab: [14, 202],  // phone-width kernel box and where its label goes
            tools: { binder: { x: 104, y: 214, w: 132, h: 50 }, pipe: { x: 14, y: 282, w: 150, h: 38 }, shm: { x: 176, y: 282, w: 150, h: 38 }, socket: { x: 14, y: 328, w: 150, h: 38 }, signal: { x: 176, y: 328, w: 150, h: 38 } },  // phone-width tool boxes: Binder centred, the four Linux tools in two rows under it
            ulab: [8, 14], wallY: 158,  // phone-width position of the "user space" label, and wallY, the height of the blocked arrow
          } : {  // the wide-screen version
            vb: '0 0 540 252', procs: { client: { x: 4, y: 26, w: 168, h: 120 }, server: { x: 186, y: 26, w: 168, h: 120 }, system: { x: 368, y: 26, w: 168, h: 120 } },  // wide viewBox and the three process boxes in one row
            kernel: { x: 4, y: 160, w: 532, h: 88 }, klab: [14, 178],  // wide kernel box and its label position
            tools: { pipe: { x: 14, y: 196, w: 84, h: 40 }, shm: { x: 104, y: 196, w: 92, h: 40 }, binder: { x: 204, y: 186, w: 132, h: 54 }, socket: { x: 344, y: 196, w: 88, h: 40 }, signal: { x: 438, y: 196, w: 88, h: 40 } },  // wide tool boxes: the five tools in one row, with Binder in the middle and a little taller
            ulab: [6, 16], wallY: 136,  // wide position of the "user space" label and the height of the blocked arrow
          };  // ends the layout choice
          const PROC = {  // PROC: the name, UID and PID printed in each process box
            client: [WIDGET.name, WIDGET.uid, WIDGET.pid], server: [WEATHER.name, WEATHER.uid, WEATHER.pid], system: ['system_server', 1000, 612],  // the widget, the weather app, and system_server running as the system user (UID 1000)
          };  // closes PROC
          const TOOL = { binder: ['Binder', 'driver'], pipe: ['pipe', null], shm: ['shared', 'memory'], socket: ['socket', null], signal: ['signal', null] };  // TOOL: the one or two lines of text inside each kernel tool box (null means a single line)
          const INFO = {  // INFO: what the detail box says for each part, as [title, chip colour, explanation]
            client: ['Weather widget app', 'proc', `A process with its own address space, running as UID ${WIDGET.uid}. It wants today's temperature, which only the weather app's service knows. It cannot just read that service's memory: inside the widget's own addresses the other process does not exist.`],  // detail for the widget: its own address space, so the service's memory does not exist for it
            server: ['Weather app', 'proc', `Runs a weather service in its own process under UID ${WEATHER.uid}. Files it writes belong to UID ${WEATHER.uid}, so other apps cannot open them. To serve other apps it offers a Binder interface: a list of methods they may call.`],  // detail for the weather app: its files belong to its UID, and it offers a Binder interface
            system: ['system_server', 'os', 'A system process (UID 1000, the system user) that hosts many of Android\'s own services: location, activities, windows, power and more. Apps call it through Binder all day; even opening a new screen is a Binder call.'],  // detail for system_server: the system process hosting Android's own services, called through Binder all day
            kernel: ['Linux kernel', 'os', 'Builds the walls: every process has its own page table, and every file access is checked against the caller\'s UID. Only the kernel can reach into every process, so every message between processes must pass through it.'],  // detail for the kernel: builds the walls with page tables and UID checks, and alone reaches every process
            binder: ['Binder driver', 'accent', 'Android\'s addition to the kernel (/dev/binder). It carries method calls between processes, copies each message only once, stamps it with the sender\'s UID and PID, and keeps count of the objects that processes share.'],  // detail for the Binder driver: one copy, a sender stamp and counted shared objects
            pipe: ['Pipe', 'io', 'A one-way stream of bytes: one process writes, another reads them in the same order. The kernel copies the data twice (in, then out again), and the reader is never told who wrote it.'],  // detail for a pipe: one-way bytes, copied twice, and the reader never learns the writer
            shm: ['Shared memory', 'mem', 'One region of memory mapped into two processes. Nothing is copied, so it is the fastest way to share bulk data, but it offers no calls, no built-in waiting and no sender identity: the processes must add their own synchronization, such as semaphores.'],  // detail for shared memory: no copying at all, but no calls, no waiting and no sender identity
            socket: ['Socket', 'io', 'A two-way connection between processes, even on different machines. General and flexible, but heavier than Binder for small calls. Android still uses UNIX-domain sockets in a few places, for example when the system asks the zygote process to start a new app.'],  // detail for a socket: a general two-way connection, heavier than Binder for small calls
            signal: ['Signal', 'intr', 'A tiny notice sent to a process, just a number that names an event such as "terminate". Good for saying that something happened, but it carries no message data.'],  // detail for a signal: just a number naming an event, with no message data
          };  // closes INFO
          const svg = s('svg', { viewBox: G.vb, width: '100%' });  // svg: the drawing, stretched to the full width of its box
          const detail = ctx.$('.s1-detail');  // detail: the box under the drawing where explanations appear
          let sel = 'binder', tryMode = null;  // sel: the part now selected (Binder at first); tryMode: which Try experiment is showing, or null
          function show(id) {  // show(id): selects one part, redraws, and explains it in the detail box
            sel = id; tryMode = null; draw();  // clears any experiment and redraws with this part highlighted
            const [name, cls, txt] = INFO[id];  // unpacks the part's title, chip colour and explanation
            detail.replaceChildren(  // replaces what the detail box shows with two new elements
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', { style: { fontSize: '17px' } }, name), h('span', { class: 'chip ' + cls }, id === 'binder' ? 'Android adds this' : ['pipe', 'shm', 'socket', 'signal'].includes(id) ? 'Linux IPC tool' : id === 'kernel' ? 'kernel' : 'user process')),  // header row: the bold name and a chip saying Android's addition, a Linux IPC tool, the kernel or a user process
              h('p', { class: 'm0', style: { fontSize: '15px', lineHeight: 1.45 } }, txt));  // then the explanation paragraph
          }  // ends show()
          function tryIt(mode) {  // tryIt(mode): runs one Try experiment, 'direct' (read the other app's memory) or 'binder' (ask through Binder)
            tryMode = mode; sel = null; draw();  // remembers the experiment, clears the selection and redraws with that experiment's arrows
            const ok = mode === 'binder';  // ok: true for the Binder experiment, the one that works
            detail.replaceChildren(  // fills the detail box with the result
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', { style: { fontSize: '17px', color: ok ? 'var(--ok)' : 'var(--bad)' } }, ok ? 'Delivered through Binder' : 'Blocked by the sandbox'), h('span', { class: 'chip ' + (ok ? 'ok' : 'bad') }, ok ? 'allowed' : 'impossible')),  // header: green "Delivered through Binder" with an allowed chip, or red "Blocked by the sandbox" with an impossible chip
              h('p', { class: 'm0', style: { fontSize: '15px', lineHeight: 1.45 } }, ok  // then a paragraph whose text depends on the experiment
                ? `The widget hands its request to the Binder driver. The driver delivers it to the weather app stamped "from UID ${WIDGET.uid}, PID ${WIDGET.pid}" and carries the answer back. The rest of this section opens up this path, piece by piece.`  // Binder result: the request arrives stamped with the widget's UID and PID, and the answer comes back
                : 'Say the temperature sits at address 0x7A3C1000 inside the weather app. In the widget that address means something else: its own page table maps it to the widget\'s own memory or to nothing. So the widget either reads its own bytes or the hardware faults and the kernel stops it (a segmentation fault). One process has no way even to name another one\'s memory.'));  // direct result: the address means something else in the widget's own page table, so it reads its own bytes or faults
          }  // ends tryIt()
          function draw() {  // draw(): rebuilds the whole drawing from sel and tryMode
            const kids = [label(s, G.ulab[0], G.ulab[1], 'user space: one process per app', { anchor: 'start', size: 13, cls: 's-sub', weight: 700 })];  // kids: the shapes to draw, starting with the "user space" label at the top left
            Object.entries(G.procs).forEach(([id, r]) => {  // for each process box id and its rectangle r
              const [nm, uid, pid] = PROC[id];  // looks up its name, UID and PID
              const on = sel === id || (tryMode && id === 'client') || (tryMode === 'binder' && id === 'server');  // on: highlighted when selected, when it is the widget in either experiment, or the weather app in the Binder one
              const bad = tryMode === 'direct' && id === 'server';  // bad: the weather app turns red in the direct-read experiment
              const t = [rbox(s, r, id === 'system' ? 's-os' : 's-proc', on || bad ? 3.5 : 2, bad ? { style: 'stroke:var(--bad)' } : null)];  // t: its shapes, starting with the rectangle, purple for system_server and teal for apps, thicker when on or bad
              if (small && id === 'system') t.push(label(s, r.x + r.w / 2, r.y + 21, nm, { size: 15, weight: 800 }), label(s, r.x + r.w / 2, r.y + 40, `UID ${uid} · PID ${pid} · own address space`, { size: 13, cls: 's-sub' }));  // phone-width system_server: its name, then UID, PID and "own address space" on one line
              else if (small) t.push(label(s, r.x + r.w / 2, r.y + 22, nm, { size: 14.5, weight: 800 }), label(s, r.x + r.w / 2, r.y + 44, `UID ${uid} · PID ${pid}`, { size: 13 }), label(s, r.x + r.w / 2, r.y + 64, 'own address space', { size: 13, cls: 's-sub' }));  // phone-width app boxes: name, then UID and PID, then "own address space"
              else t.push(label(s, r.x + r.w / 2, r.y + 24, nm, { size: 15.5, weight: 800 }), label(s, r.x + r.w / 2, r.y + 50, 'UID ' + uid, { size: 14 }), label(s, r.x + r.w / 2, r.y + 70, 'PID ' + pid, { size: 14 }), label(s, r.x + r.w / 2, r.y + 98, 'own address space', { size: 13, cls: 's-sub' }));  // wide boxes: name, UID, PID and "own address space", each on its own line
              kids.push(hot(s, { 'aria-label': nm }, t, () => show(id)));  // wraps the shapes in a clickable group named for screen readers; a click explains that process
            });  // ends the loop over processes
            const K = G.kernel;  // K: the kernel's rectangle
            kids.push(hot(s, { 'aria-label': 'Linux kernel' }, [rbox(s, K, 's-os', sel === 'kernel' ? 3.5 : 2), label(s, G.klab[0], G.klab[1], 'Linux kernel', { anchor: 'start', size: 14, weight: 800, fill: 'var(--os)' })], () => show('kernel')));  // adds the clickable kernel box with its purple "Linux kernel" label at the top left
            Object.entries(G.tools).forEach(([id, r]) => {  // for each kernel tool id and its rectangle r
              const [a, b] = TOOL[id];  // a and b: the first and second lines of its text
              const on = sel === id || (tryMode === 'binder' && id === 'binder');  // on: highlighted when selected, or Binder during the Binder experiment
              const cls = id === 'binder' ? 's-accent' : 's-panel';  // Binder is drawn in the accent colour, the four Linux tools in plain panel colour
              const t = [rbox(s, r, cls, on ? 3.5 : 2)];  // t: its rectangle, thicker when highlighted
              const cx = r.x + r.w / 2, cy = r.y + r.h / 2;  // cx, cy: the centre of the box, where the text goes
              if (b && !(small && id !== 'binder')) t.push(label(s, cx, cy - 3, a, { size: id === 'binder' ? 16 : 13.5, weight: 800 }), label(s, cx, cy + 14, b, { size: 13.5, weight: id === 'binder' ? 700 : 600 }));  // two lines of text, bigger and bolder for Binder; on phone-width screens only Binder keeps two lines
              else t.push(label(s, cx, cy + 5, b ? a + ' ' + b : a, { size: 14, weight: 700 }));  // otherwise one centred line, joining both words when there are two
              kids.push(hot(s, { 'aria-label': INFO[id][0] }, t, () => show(id)));  // wraps it in a clickable group that explains that tool
            });  // ends the loop over tools
            const C = G.procs.client, S = G.procs.server, B = G.tools.binder;  // C, S and B: the widget, weather app and Binder boxes, which the experiment arrows connect
            if (tryMode === 'binder') {  // the Binder experiment draws two green arrows
              kids.push(s('path', { d: `M${C.x + C.w / 2} ${C.y + C.h} L${B.x + 24} ${B.y}`, class: 's-line', style: 'stroke:var(--ok)', 'stroke-width': 3, 'marker-end': 'url(#arr-ok)' }));  // a green arrow from the bottom of the widget down to the left end of the Binder box
              kids.push(s('path', { d: `M${B.x + B.w - 24} ${B.y} L${S.x + S.w / 2} ${S.y + S.h}`, class: 's-line', style: 'stroke:var(--ok)', 'stroke-width': 3, 'marker-end': 'url(#arr-ok)' }));  // a second green arrow from the right end of the Binder box up to the weather app
            }  // ends the Binder experiment
            if (tryMode === 'direct') {  // the direct-read experiment draws an arrow that hits the wall
              const gx = (C.x + C.w + S.x) / 2, y = G.wallY;  // gx: the middle of the gap between the two app boxes; y: the height where the wall is drawn
              kids.push(s('path', { d: `M${C.x + C.w - 46} ${y} L${gx - 9} ${y}`, class: 's-line', style: 'stroke:var(--bad)', 'stroke-width': 3, 'stroke-dasharray': '6 4', 'marker-end': 'url(#arr-bad)' }));  // a dashed red arrow from inside the widget toward the gap, stopping just short of the wall
              kids.push(s('circle', { cx: gx, cy: y, r: 11, class: 's-bad', 'stroke-width': 2.5 }), label(s, gx, y + 5, '✗', { size: 15, weight: 900, fill: 'var(--bad)' }));  // a red circle with a cross where the arrow stops: the sandbox blocks the read
            }  // ends the direct-read experiment
            svg.replaceChildren(...kids);  // replaces everything in the drawing with the new shapes
          }  // ends draw()
          ctx.$('.s1-svg').append(svg);  // puts the drawing into its empty box in the html
          ctx.$('.s1-try').append(  // fills the empty Try row with a label and two buttons
            h('span', { class: 'small b' }, 'Try:'),  // the bold "Try:" label
            h('button', { class: 'btn sm intr', type: 'button', onclick: () => tryIt('direct') }, 'Widget reads the service\'s memory'),  // button for the direct-read experiment, in interrupt red because it fails
            h('button', { class: 'btn sm proc', type: 'button', onclick: () => tryIt('binder') }, 'Widget asks through Binder'));  // button for the Binder experiment, in process teal
          show('binder');  // starts with the Binder driver selected and explained
        },  // ends render() for step 1
      },  // ends step 1

      /* ---------------- 2. The RPC idea and the cast of characters ---------------- */
      {  // opens step 2
        title: 'Remote procedure call: a call that runs elsewhere',  // step 2 title
        kind: 'learn',  // kind 'learn': an explanation step
        render(el, ctx) {  // render(el, ctx): builds step 2: the code, a local-versus-remote switch and the clickable cast of characters
          const { h, s } = ctx;  // takes the HTML builder h and the SVG builder s out of ctx
          const small = ctx.narrow;  // small: true on phone-width screens
          let mode = 'remote', pick = 'proxy';  // mode: 'local' or 'remote', the kind of call shown; pick: the cast member selected, the proxy at first
          const code = ctx.ui.code(`${/* code: a short numbered listing built by ctx.ui.code */''}
var w = lookUp("weather");  // find the service${/* shown code, line 1: looks up the weather service by name */''}
int t = w.getTemp("Tampa"); // looks local...${/* shown code, line 2: the remote call, which looks exactly like a local call */''}
show(t);                    // t used as usual`, { lang: 'c', fontSize: 13.5 });  // shown code, line 3: uses the answer like any value; the options colour it as C-like code at 13.5px
          code.style.flex = 'none';  // stops the listing from stretching to fill spare height
          const what = h('div', { class: 'card white tight', style: { fontSize: '15px', lineHeight: 1.45 } });  // what: the card under the code that explains the local or the remote call
          const svg = s('svg', { viewBox: small ? '0 0 360 470' : '0 0 600 272', width: '100%' });  // svg: the drawing, with a taller coordinate area on phone-width screens
          const detail = h('div', { class: 'narr', style: { minHeight: '96px' } });  // detail: the box that explains the selected cast member; its minimum height stops the layout from jumping
          const CAST = {  // CAST: the eight parts of a Binder call, as [name, explanation]
            proxy: ['Proxy', 'Lives in the client and implements IWeather, so your code cannot tell it from the real thing. Its getTemp() does no weather work at all: it marshals the argument into a parcel, sends the transaction, waits, then unmarshals the reply.'],  // the proxy: looks like the real object but only marshals, sends, waits and unmarshals
            parcel: ['Parcel', 'The flat container that crosses the boundary: an interface token, then the string "Tampa". A pointer cannot cross (an address means nothing in another process), so every value is copied in as plain bytes.'],  // the parcel: the token and the city as plain bytes, because a pointer cannot cross
            driver: ['Binder driver', `Kernel code. It finds the process that owns the target object, copies the parcel into it once, attaches the caller's identity (UID ${WIDGET.uid}, PID ${WIDGET.pid}) and wakes a thread there.`],  // the driver: finds the owner process, copies once, attaches the caller's UID and PID, and wakes a thread
            pool: ['Binder thread pool', 'Server threads that sleep inside the driver until work arrives. One of them takes this call; the others stay free for other callers at the same moment.'],  // the thread pool: server threads asleep in the driver until one takes this call
            stub: ['Stub', 'The server half of the interface. Its onTransact() reads the method code, unmarshals the arguments in the agreed order, calls the real method and marshals the result into a reply.'],  // the stub: onTransact() reads the method code, unmarshals, calls the real method and marshals the result
            service: ['Service object', 'WeatherService does the real work: getTemp() looks up the temperature. It is ordinary code and never sees a parcel; the stub calls it like any other method.'],  // the service object: does the real work and never sees a parcel
            manager: ['Service manager', 'The registry of named services, reached through handle 0: lookUp("weather") gets back a handle that the proxy wraps. Simplified: only system services register here; an app\'s own service is reached with bindService(), and the system hands back the handle.'],  // the service manager: the registry reached through handle 0, with the note that app services use bindService()
            aidl: ['AIDL file', 'IWeather.aidl declares the methods. Build tools generate both the proxy and the stub from it, so two sides built from the same version agree on method numbers and on the order and types of every field.'],  // the AIDL file: proxy and stub are both generated from it, so they agree on every field
          };  // closes CAST
          /* layout records for both screen shapes */
          const L = small ? {  // L: where every box goes; first the phone-width layout
            cli: { x: 4, y: 4, w: 352, h: 104 }, caller: { x: 18, y: 40, w: 150, h: 54 }, proxy: { x: 192, y: 40, w: 150, h: 54 },  // phone-width client process, with the caller and proxy boxes inside it
            aidl: { x: 140, y: 118, w: 112, h: 46 }, manager: { x: 18, y: 118, w: 112, h: 46 },  // phone-width AIDL and service manager boxes just under the client
            ker: { x: 4, y: 176, w: 352, h: 84 }, driver: { x: 90, y: 202, w: 190, h: 48 },  // phone-width kernel strip with the driver box inside it
            srv: { x: 4, y: 272, w: 352, h: 194 }, pool: { x: 18, y: 304, w: 324, h: 64 }, stub: { x: 18, y: 392, w: 150, h: 60 }, service: { x: 192, y: 392, w: 150, h: 60 },  // phone-width server process: the thread pool across the top, then the stub and the service
            parcel: [318, 141],  // phone-width centre point of the parcel tag
          } : {  // the wide layout
            cli: { x: 4, y: 4, w: 242, h: 158 }, caller: { x: 16, y: 40, w: 100, h: 56 }, proxy: { x: 134, y: 40, w: 100, h: 56 },  // wide client process on the left, with the caller and proxy
            aidl: { x: 256, y: 18, w: 88, h: 52 }, manager: { x: 256, y: 92, w: 88, h: 52 },  // wide AIDL file and service manager in the middle column
            ker: { x: 4, y: 178, w: 592, h: 90 }, driver: { x: 200, y: 198, w: 200, h: 54 },  // wide kernel strip along the bottom, with the driver in its middle
            srv: { x: 354, y: 4, w: 242, h: 158 }, pool: { x: 366, y: 98, w: 218, h: 54 }, stub: { x: 366, y: 34, w: 100, h: 52 }, service: { x: 484, y: 34, w: 100, h: 52 },  // wide server process on the right: stub and service on top, the thread pool below
            parcel: [146, 138],  // wide centre point of the parcel tag
          };  // ends the layout choice
          const cx = (r) => r.x + r.w / 2, cy = (r) => r.y + r.h / 2;  // cx(r), cy(r): the centre of box r
          function arrow(x1, y1, x2, y2, n, on) {  // arrow(x1, y1, x2, y2, n, on): an arrow between two points, with an optional numbered circle halfway along
            const out = [s('line', { x1, y1, x2, y2, class: 's-line', 'stroke-width': on ? 3 : 2, 'marker-end': 'url(#arr)' })];  // out: the line with an arrowhead, thicker when on
            if (n) out.push(s('circle', { cx: (x1 + x2) / 2, cy: (y1 + y2) / 2, r: 10, class: 's-accent', 'stroke-width': 1.5 }), label(s, (x1 + x2) / 2, (y1 + y2) / 2 + 5, String(n), { size: 13, weight: 800 }));  // if n is given, adds a circle with the step number at the arrow's middle
            return out;  // returns the shapes
          }  // ends arrow()
          function part(id, r, cls, lines) {  // part(id, r, cls, lines): draws one labelled box; when it has an id it is clickable and explains that cast member
            const on = mode === 'remote' && pick === id;  // on: highlighted in the remote view when this part is the one picked
            const kids = [rbox(s, r, cls, on ? 3.5 : 2, on ? { style: 'stroke:var(--chc)' } : null)];  // kids: the rectangle, thicker and in the chapter colour when highlighted
            lines.forEach((t, i) => kids.push(label(s, cx(r), cy(r) + 5 + (i - (lines.length - 1) / 2) * 17, t, { size: 14, weight: i ? 600 : 800 })));  // writes each line of text centred in the box, 17px apart, the first line bolder
            return id ? hot(s, { 'aria-label': CAST[id][0] }, kids, () => choose(id)) : s('g', {}, ...kids);  // a clickable group named for screen readers when it has an id, otherwise a plain group
          }  // ends part()
          function draw() {  // draw(): rebuilds the drawing for the local or the remote view
            const k = [];  // k: the list of shapes
            if (mode === 'local') {  // the local view: one process, no kernel
              const P = { x: 4, y: 4, w: small ? 352 : 592, h: small ? 250 : 158 };  // P: one big process box
              k.push(rbox(s, P, 's-proc'), label(s, P.x + 12, P.y + 22, 'One process (the weather code is linked in)', { anchor: 'start', size: 14, weight: 800 }));  // draws it with its title: one process with the weather code linked in
              const A = small ? { x: 18, y: 50, w: 324, h: 56 } : { x: 40, y: 50, w: 200, h: 70 };  // A: the box for your code (stacked on phone-width screens, side by side on wide ones)
              const B = small ? { x: 18, y: 178, w: 324, h: 56 } : { x: 356, y: 50, w: 200, h: 70 };  // B: the box for getTemp(), in the same address space
              k.push(part(null, A, 's-thread', ['your code', 'getTemp("Tampa")']), part(null, B, 's-panel', ['getTemp()', 'same address space']));  // draws both boxes, which are not clickable
              if (small) k.push(...arrow(120, A.y + A.h, 120, B.y, null), ...arrow(240, B.y, 240, A.y + A.h, null), label(s, 112, 146, 'jump in', { anchor: 'end', size: 13, cls: 's-sub' }), label(s, 248, 146, 'return 88', { anchor: 'start', size: 13, cls: 's-sub' }));  // phone-width: a down arrow "jump in" and an up arrow "return 88" between the stacked boxes
              else k.push(...arrow(A.x + A.w, 74, B.x, 74, null), ...arrow(B.x, 100, A.x + A.w, 100, null), label(s, 298, 66, 'jump in', { size: 13, cls: 's-sub' }), label(s, 298, 118, 'return 88', { size: 13, cls: 's-sub' }));  // wide: a right arrow "jump in" and a left arrow "return 88" between the two boxes
              const K = small ? { x: 4, y: 270, w: 352, h: 84 } : L.ker;  // K: the kernel box underneath
              k.push(rbox(s, K, 's-panel', 2, { 'stroke-dasharray': '6 5' }), label(s, cx(K), cy(K) + 5, 'kernel: not involved at all', { size: 14, cls: 's-sub' }));  // a dashed kernel box saying it is not involved at all
            } else {  // the remote view: client, kernel and server
              k.push(rbox(s, L.cli, 's-proc'), label(s, L.cli.x + 12, L.cli.y + 22, 'client: ' + WIDGET.name, { anchor: 'start', size: 14, weight: 800 }));  // the client process box and its title
              k.push(rbox(s, L.srv, 's-proc'), label(s, L.srv.x + 12, L.srv.y + 22, 'server: ' + WEATHER.name, { anchor: 'start', size: 14, weight: 800 }));  // the server process box and its title
              k.push(rbox(s, L.ker, 's-os'), label(s, L.ker.x + 12, L.ker.y + 20, 'kernel', { anchor: 'start', size: 14, weight: 800, fill: 'var(--os)' }));  // the kernel box with its purple label
              k.push(part(null, L.caller, 's-thread', ['your code', 'getTemp()']));  // your code's box, which is not clickable
              k.push(part('proxy', L.proxy, 's-accent', ['proxy', 'getTemp()']));  // the clickable proxy
              k.push(part('aidl', L.aidl, 's-panel', ['IWeather', '.aidl']));  // the clickable AIDL file
              k.push(part('manager', L.manager, 's-os', ['service', 'manager']));  // the clickable service manager
              k.push(part('driver', L.driver, 's-accent', ['Binder driver', '/dev/binder']));  // the clickable Binder driver, with its device name
              k.push(part('stub', L.stub, 's-accent', ['stub', 'onTransact()']));  // the clickable stub
              k.push(part('service', L.service, 's-mem', ['Weather', 'Service']));  // the clickable service object
              const P = L.pool, on = pick === 'pool';  // P: the thread pool's box; on: whether the pool is picked
              const pk = [rbox(s, P, 's-panel', on ? 3.5 : 2, on ? { style: 'stroke:var(--chc)' } : null), label(s, P.x + 10, P.y + 18, 'Binder thread pool', { anchor: 'start', size: 13, weight: 800 })];  // pk: the pool's rectangle and its title
              for (let i = 0; i < 3; i++) { const tw = (P.w - 40) / 3, r = { x: P.x + 10 + i * (tw + 10), y: P.y + 25, w: tw, h: P.h - 32, rx: 7 }; pk.push(rbox(s, r, i === 0 ? 's-thread' : 's-panel', 1.5), label(s, cx(r), cy(r) + 5, i === 0 ? 'B1 busy' : 'B' + (i + 1) + ' idle', { size: 13, weight: 700 })); }  // three thread boxes sized to fit side by side: B1 busy with this call, B2 and B3 idle
              k.push(hot(s, { 'aria-label': 'Binder thread pool' }, pk, () => choose('pool')));  // wraps the whole pool in one clickable group
              /* the numbered path of one call */
              if (small) {  // the phone-width arrows
                k.push(...arrow(L.caller.x + L.caller.w, cy(L.caller), L.proxy.x, cy(L.proxy), 1));  // arrow 1: from your code across to the proxy
                k.push(...arrow(cx(L.proxy), L.proxy.y + L.proxy.h, cx(L.proxy) - 4, L.driver.y + 14, 2));  // arrow 2: down from the proxy into the driver
                k.push(...arrow(cx(L.driver), L.driver.y + L.driver.h, cx(L.driver), P.y + 25, 3));  // arrow 3: down from the driver to the thread pool
                k.push(...arrow(P.x + 50, P.y + P.h, cx(L.stub), L.stub.y, null));  // an unnumbered arrow from the pool down to the stub
                k.push(...arrow(L.stub.x + L.stub.w, cy(L.stub), L.service.x, cy(L.service), 4));  // arrow 4: the stub calls the service
              } else {  // the wide-screen arrows
                k.push(...arrow(L.caller.x + L.caller.w, cy(L.caller), L.proxy.x, cy(L.proxy), 1));  // arrow 1: from your code across to the proxy
                k.push(...arrow(cx(L.proxy), L.proxy.y + L.proxy.h, L.driver.x + 24, L.driver.y, 2));  // arrow 2: down from the proxy to the left end of the driver
                k.push(...arrow(L.driver.x + L.driver.w - 24, L.driver.y, P.x + 50, P.y + P.h, 3));  // arrow 3: from the right end of the driver up to the thread pool
                k.push(...arrow(P.x + 50, P.y, P.x + 50, L.stub.y + L.stub.h, null));  // an unnumbered arrow from the pool up to the stub
                k.push(...arrow(L.stub.x + L.stub.w, cy(L.stub), L.service.x, cy(L.service), 4));  // arrow 4: the stub calls the service
              }  // ends the arrow choice
              const [px, py] = L.parcel, pon = pick === 'parcel';  // px, py: the centre of the parcel tag; pon: whether the parcel is picked
              k.push(hot(s, { 'aria-label': 'Parcel' }, [s('rect', { x: px - 30, y: py - 14, width: 60, height: 28, rx: 5, class: 's-mem', 'stroke-width': pon ? 3.5 : 2, style: pon ? 'stroke:var(--chc)' : null }), label(s, px, py + 5, 'parcel', { size: 13, weight: 800 })], () => choose('parcel')));  // the clickable parcel tag, a small green box labelled "parcel", outlined in the chapter colour when picked
              if (pick === 'aidl') k.push(s('path', { d: `M${L.aidl.x} ${cy(L.aidl)} L${L.proxy.x + L.proxy.w - 10} ${L.proxy.y}`, class: 's-line', style: 'stroke:var(--chc)', 'stroke-dasharray': '5 4', 'marker-end': 'url(#arr)' }), s('path', { d: `M${L.aidl.x + L.aidl.w} ${cy(L.aidl)} L${L.stub.x + 20} ${L.stub.y}`, class: 's-line', style: 'stroke:var(--chc)', 'stroke-dasharray': '5 4', 'marker-end': 'url(#arr)' }));  // when AIDL is picked, dashed arrows from the AIDL file to the proxy and to the stub show both are generated from it
            }  // ends the remote view
            svg.replaceChildren(...k);  // replaces the drawing's contents with the new shapes
          }  // ends draw()
          function choose(id) {  // choose(id): selects a cast member and explains it
            pick = id; if (mode !== 'remote') { mode = 'remote'; seg.set('remote'); explain(); }  // remembers it; if the local view is showing, switches to remote and moves the switch to match
            draw();  // redraws with the new selection
            detail.innerHTML = `<b>${CAST[id][0]}.</b> ${CAST[id][1]}`;  // writes the member's name and explanation into the detail box
          }  // ends choose()
          function explain() {  // explain(): updates the card under the code for the current mode
            code.mark(2);  // highlights line 2 of the listing, the getTemp call
            what.innerHTML = mode === 'local'  // picks the text by mode
              ? '<b>Local call.</b> The CPU jumps to getTemp\'s code in the same address space; the argument goes in a register or on the stack and the result comes back the same way. Cost: a few nanoseconds. The kernel is not involved.'  // local text: a jump within one address space, a few nanoseconds, no kernel
              : `<b>Remote call.</b> The same line runs a <span class="t" data-t="remote procedure call">remote procedure call</span>: (1) your code calls the proxy, (2) the proxy packs "Tampa" into a parcel for the driver, (3) a server thread receives it, (4) the stub unpacks it and calls the real method. The reply comes back the same way while your thread waits: tens of microseconds, thousands of times slower than a local call.`;  // remote text: the four numbered stages of the call, and tens of microseconds of waiting
          }  // ends explain()
          const seg = ctx.ui.seg([{ value: 'local', label: 'Local call' }, { value: 'remote', label: 'Remote call through Binder' }], mode, (v) => { mode = v; explain(); draw(); detail.innerHTML = v === 'local' ? 'Switch back to the remote call and click the parts to meet the cast of characters.' : `<b>${CAST[pick][0]}.</b> ${CAST[pick][1]}`; });  // seg: the Local call / Remote call switch; changing it re-explains, redraws and resets the detail box
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: small ? null : 'minmax(0, 1fr) minmax(0, 1fr)' } },  // puts everything on the page: two equal columns on wide screens, one column on phone-width ones
            h('div', { class: 'stack', style: { gap: '9px' } },  // left column
              h('p', { class: 'lead m0', html: 'A <span class="t" data-t="remote procedure call">remote procedure call</span> (RPC) lets a program call a procedure that really runs in <b>another process</b>, written exactly like an ordinary call.' }),  // opening sentence that defines a remote procedure call
              code, what,  // the code listing and the card that explains it
              h('div', { class: 'callout warn small m0', 'data-label': 'Common mistake' }, 'Thinking the proxy does the work. It only forwards the call: the real code runs in the server\'s process, on one of its Binder threads.'),  // common-mistake callout: thinking the proxy does the work
              h('div', { class: 'callout why small m0', 'data-label': 'Why it matters' }, 'You write one ordinary line; the cross-process work hides in generated code and the kernel. The price is time, so apps avoid many tiny remote calls in a loop.')),  // why-it-matters callout: one ordinary line hides a real cost, so apps avoid many tiny remote calls
            h('div', { class: 'stack', style: { gap: '8px' } },  // right column
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, seg, h('span', { class: 'small muted' }, 'click a part')),  // top row: the switch and a "click a part" hint
              h('div', { class: 'card white tight' }, svg), detail,  // the drawing on a white card, then the detail box
              h('div', { class: 'row gap-s' }, h('span', { class: 'small b' }, 'Meet the cast:'),  // a row that starts with the label "Meet the cast:"
                ...Object.keys(CAST).map((id) => h('button', { class: 'btn sm', type: 'button', onclick: () => choose(id) }, CAST[id][0]))))));  // one button per CAST entry; each selects that member
          explain(); draw(); choose('proxy');  // first view: explains the remote call, draws it and selects the proxy
        },  // ends render() for step 2
      },  // ends step 2

      /* ---------------- 3. One Binder transaction, frame by frame ---------------- */
      {  // opens step 3
        title: 'Follow one Binder transaction, frame by frame',  // step 3 title
        kind: 'explore',  // kind 'explore': a step the student plays with
        core: true,  // core: true puts this step on the shorter core path through the guide
        render(el, ctx) {  // render(el, ctx): builds the frame-by-frame animation of one Binder call
          const { h, s } = ctx;  // takes the HTML builder h and the SVG builder s out of ctx
          const small = ctx.narrow;  // small: true on phone-width screens, which get one tall column
          let oneway = false, city = 'Tampa';  // oneway: whether the one-way call is chosen; city: the city passed to getTemp
          const STEPS = 4321;  // STEPS: the step count the one-way reportSteps call sends
          const L = small ? {  // L: where every box goes; first the phone-width layout
            vb: '0 0 360 784',  // phone-width viewBox, 360 wide and 784 tall
            parcel: { x: 0, y: 0, w: 360, h: 150 },  // the parcel panel across the top
            cli: { x: 0, y: 160, w: 360, h: 214 }, cbuf: { x: 10, y: 190, w: 98, h: 176 }, t1: { x: 118, y: 190, w: 232, h: 84 }, proxy: { x: 118, y: 282, w: 232, h: 84 },  // the client process: its receive buffer on the left, T1 above the proxy on the right
            sm: { x: 96, y: 384, w: 194, h: 48 },  // the service manager between the client and the kernel
            ker: { x: 0, y: 442, w: 360, h: 100 }, drv: { x: 10, y: 466, w: 340, h: 62 },  // the kernel strip and the driver box inside it
            srv: { x: 0, y: 570, w: 360, h: 214 }, sbuf: { x: 10, y: 600, w: 98, h: 176 }, stub: { x: 118, y: 600, w: 112, h: 84 }, svc: { x: 238, y: 600, w: 112, h: 84 }, pool: { x: 118, y: 692, w: 232, h: 84 },  // the server process: its buffer on the left, stub and service above the thread pool
            routes: {  // routes: every arrow a frame can show, as [from box, side, fraction] to [to box, side, fraction], plus where the parcel tag sits
              't1-proxy': [['t1', 'b', 0.5], ['proxy', 't', 0.5]], 'proxy-t1': [['proxy', 't', 0.5], ['t1', 'b', 0.5]],  // T1 to the proxy, and back
              'proxy-drv': [['proxy', 'b', 0.97], ['drv', 't', 0.979]], 'drv-sm': [['drv', 't', 0.538], ['sm', 'b', 0.5]],  // proxy down to the driver; driver up to the service manager
              'drv-sbuf': [['drv', 'b', 0.144], ['sbuf', 't', 0.5], 0.38], 'sbuf-pool': [['sbuf', 'r', 0.7], ['pool', 'l', 0.5]],  // driver down to the server's buffer (tag 38% of the way); buffer to the thread pool
              'pool-stub': [['pool', 't', 0.25], ['stub', 'b', 0.5]], 'stub-svc': [['stub', 'r', 0.35], ['svc', 'l', 0.35]], 'svc-stub': [['svc', 'l', 0.7], ['stub', 'r', 0.7]],  // pool up to the stub; stub to the service and back
              'stub-drv': [['stub', 't', 0.75], ['drv', 'b', 0.565], 0.62], 'drv-cbuf': [['drv', 't', 0.144], ['cbuf', 'b', 0.5]], 'cbuf-proxy': [['cbuf', 'r', 0.75], ['proxy', 'l', 0.5]],  // stub to the driver (tag at 62%); driver to the client's buffer; client buffer to the proxy
            },  // closes the phone-width routes
          } : {  // the wide layout
            vb: '0 0 1120 362',  // wide viewBox, 1120 by 362
            parcel: { x: 356, y: 0, w: 408, h: 176 },  // the parcel panel in the top middle
            cli: { x: 0, y: 0, w: 330, h: 252 }, t1: { x: 12, y: 30, w: 186, h: 98 }, proxy: { x: 12, y: 138, w: 186, h: 102 }, cbuf: { x: 222, y: 30, w: 96, h: 210 },  // the client process on the left: T1 above the proxy, the receive buffer beside them
            sm: { x: 440, y: 190, w: 240, h: 62 },  // the service manager under the parcel panel
            srv: { x: 790, y: 0, w: 330, h: 252 }, sbuf: { x: 802, y: 30, w: 96, h: 210 }, pool: { x: 916, y: 30, w: 192, h: 98 }, stub: { x: 916, y: 138, w: 92, h: 102 }, svc: { x: 1016, y: 138, w: 92, h: 102 },  // the server process on the right: buffer, the thread pool above the stub and the service
            ker: { x: 0, y: 264, w: 1120, h: 98 }, drv: { x: 290, y: 278, w: 540, h: 76 },  // the kernel strip along the bottom, with the driver in its middle
            routes: {  // routes for the wide layout, with the same names as the phone-width ones
              't1-proxy': [['t1', 'b', 0.5], ['proxy', 't', 0.5]], 'proxy-t1': [['proxy', 't', 0.5], ['t1', 'b', 0.5]],  // T1 to the proxy, and back
              'proxy-drv': [['proxy', 'b', 0.5], ['drv', 't', 0.05]], 'drv-sm': [['drv', 't', 0.5], ['sm', 'b', 0.5]],  // proxy to the driver's left end; driver to the service manager
              'drv-sbuf': [['drv', 't', 0.95], ['sbuf', 'b', 0.5]], 'sbuf-pool': [['sbuf', 'r', 0.3], ['pool', 'l', 0.5]],  // driver's right end up to the server's buffer; buffer to the thread pool
              'pool-stub': [['pool', 'b', 0.24], ['stub', 't', 0.5]], 'stub-svc': [['stub', 'r', 0.35], ['svc', 'l', 0.35]], 'svc-stub': [['svc', 'l', 0.7], ['stub', 'r', 0.7]],  // pool down to the stub; stub to the service and back
              'stub-drv': [['stub', 'b', 0.5], ['drv', 't', 0.85]], 'drv-cbuf': [['drv', 't', 0.15], ['cbuf', 'b', 0.5]], 'cbuf-proxy': [['cbuf', 'l', 0.75], ['proxy', 'r', 0.6]],  // stub down to the driver; driver up to the client's buffer; buffer to the proxy
            },  // closes the wide routes
          };  // ends the layout choice
          const svg = s('svg', { viewBox: L.vb, width: '100%' });  // svg: the drawing, stretched to the full width
          let frames = txFrames(oneway, city, STEPS);  // frames: every frame for the current choice of call, built by txFrames()
          const cx = (r) => r.x + r.w / 2, cy = (r) => r.y + r.h / 2;  // cx(r), cy(r): the centre of box r
          function lines(r, arr, title) {  // lines(r, arr, title): writes the strings in arr as centred lines in box r; if title is true the first line is bolder
            const n = arr.length, out = [];  // n: how many lines; out: the text shapes
            arr.forEach((t, i) => out.push(label(s, cx(r), cy(r) + 5 + (i - (n - 1) / 2) * 18, t, { size: i === 0 && title ? 14 : 13, weight: i === 0 && title ? 800 : 600 })));  // places each line 18px below the one before, the group centred in the box
            return out;  // returns the shapes
          }  // ends lines()
          function draw(f) {  // draw(f): draws frame f of the animation
            const on = (id) => f.on.includes(id);  // on(id): whether box id is highlighted in this frame
            const box = (id, cls) => rbox(s, L[id], cls, on(id) ? 3.5 : 2, on(id) ? { style: 'stroke:var(--chc)' } : null);  // box(id, cls): the rectangle for box id, thicker and in the chapter colour when highlighted
            const k = [];  // k: the list of shapes
            [['cli', 'client: ' + WIDGET.name, WIDGET.uid], ['srv', 'server: ' + WEATHER.name, WEATHER.uid]].forEach(([id, nm, uid]) => {  // the two process boxes, each with its name and UID
              const r = L[id];  // r: its rectangle
              k.push(rbox(s, r, 's-proc'));  // draws it in process teal
              if (small) k.push(label(s, r.x + 12, r.y + 20, nm, { anchor: 'start', size: 13.5, weight: 800 }), label(s, r.x + r.w - 12, r.y + 20, 'UID ' + uid, { anchor: 'end', size: 13.5, weight: 800 }));  // phone-width: the name at the left of the title line and the UID at the right
              else k.push(label(s, r.x + 12, r.y + 20, `${nm} · UID ${uid}`, { anchor: 'start', size: 13.5, weight: 800 }));  // wide: the name and UID together on one title line
            });  // ends the loop over the two processes
            k.push(rbox(s, L.ker, 's-os'), label(s, L.ker.x + 12, L.ker.y + 18, 'kernel', { anchor: 'start', size: 13.5, weight: 800, fill: 'var(--os)' }));  // the kernel box with its purple label
            k.push(box('t1', f.t1c), ...lines(L.t1, f.t1, true));  // T1's box, coloured by the frame (pink, amber when blocked, green when done), with its two lines of text
            k.push(box('proxy', 's-accent'), ...lines(L.proxy, f.proxy, true));  // the proxy's box and text
            k.push(box('cbuf', 's-mem'), ...lines(L.cbuf, ['receive', 'buffer', f.cbuf], false));  // the widget's receive buffer and its state (empty, bytes in, read)
            k.push(box('sbuf', 's-mem'), ...lines(L.sbuf, ['receive', 'buffer', f.sbuf], false));  // the weather app's receive buffer and its state (empty, bytes in, freed)
            k.push(box('sm', 's-os'), ...lines(L.sm, f.sm, true));  // the service manager's box and text
            k.push(box('drv', 's-accent'), ...lines(L.drv, ['Binder driver'].concat(f.drv.filter(Boolean)), true));  // the driver's box: its title plus this frame's lines, dropping empty ones (filter(Boolean) keeps only non-empty text)
            k.push(box('stub', 's-accent'), ...lines(L.stub, ['stub'].concat(f.stub), true));  // the stub's box: its title plus what it is doing
            k.push(box('svc', 's-mem'), ...lines(L.svc, ['Weather', 'Service'].concat(f.svc), false));  // the service's box: its name on two lines plus this frame's result
            /* the thread pool: three Binder threads */
            const P = L.pool;  // P: the thread pool's rectangle
            k.push(box('pool', 's-panel'), label(s, P.x + 10, P.y + 19, 'Binder thread pool', { anchor: 'start', size: 13, weight: 800 }));  // the pool's box and its title
            f.pool.forEach((st, i) => {  // one small box per Binder thread, from this frame's list of pool states
              const tw = (P.w - 36) / 3, r = { x: P.x + 10 + i * (tw + 8), y: P.y + 28, w: tw, h: P.h - 36, rx: 7 };  // tw: each thread's width so three fit side by side; r: this thread's rectangle
              k.push(rbox(s, r, st === 'busy' ? 's-thread' : 's-panel', st === 'busy' ? 2.5 : 1.5), label(s, cx(r), cy(r) - 3, 'B' + (i + 1), { size: 13, weight: 800 }), label(s, cx(r), cy(r) + 14, st, { size: 13, cls: st === 'busy' ? null : 's-sub' }));  // pink and thicker when busy, with its name B1 to B3 and its state, grey when asleep
            });  // ends the loop over threads
            /* the parcel panel */
            const R = L.parcel;  // R: the parcel panel's rectangle
            k.push(box('parcel', 's-panel'));  // draws the panel
            if (!f.parcel) k.push(label(s, cx(R), cy(R) + 5, 'no parcel in flight', { size: 14, cls: 's-sub' }));  // no parcel in this frame: a grey note says so
            else {  // otherwise lists the parcel's fields
              k.push(label(s, R.x + 12, R.y + 22, f.parcel.title, { anchor: 'start', size: 14, weight: 800 }));  // the parcel's title, such as which parcel it is and its size
              f.parcel.rows.forEach((row, i) => {  // one row per field
                const [ty, val, by, st] = row, y = R.y + 34 + i * 30;  // unpacks the row: type, value shown, size and state; y: the row's top, 30px below the one before
                k.push(s('rect', { x: R.x + 10, y, width: R.w - 20, height: 26, rx: 6, class: st === 'new' ? 's-accent' : st === 'read' ? 's-ok' : 's-panel', 'stroke-width': 1.5 }));  // the row's background: accent while new, green once read, plain while travelling
                k.push(label(s, R.x + 20, y + 18, ty, { anchor: 'start', size: 13, cls: 's-monot' }), label(s, R.x + (small ? 146 : 168), y + 18, val, { anchor: 'start', size: 13.5, weight: 800, cls: 's-monot' }),  // the field's type at the left, then its value in bold fixed-width text further right
                  label(s, R.x + R.w - 20, y + 18, (st === 'read' ? '✓ ' : '') + by + ' B', { anchor: 'end', size: 13, weight: 700 }));  // its size in bytes at the right, with a check mark once read
              });  // ends the loop over rows
              const st = f.parcel.rows[0][3];  // st: the parcel's state, taken from its first row
              k.push(label(s, R.x + 12, R.y + R.h - 12, st === 'new' ? 'just written (marshalled)' : st === 'read' ? 'read back in the same order (unmarshalled)' : 'travelling as raw bytes', { anchor: 'start', size: 13, cls: 's-sub' }));  // a grey line at the bottom: just written, travelling as raw bytes, or read back in the same order
            }  // ends the parcel panel
            /* moving parcels: arrows of this frame, with a small parcel tag on each */
            f.routes.forEach(([name, tag]) => {  // for each arrow named in this frame, with its parcel tag text if any
              const [[a, sa, fa], [b, sb, fb], tf = 0.5] = L.routes[name];  // looks up the arrow's two ends and tf, how far along the tag sits (halfway unless the route says otherwise)
              const [x1, y1] = anchor(L[a], sa, fa), [x2, y2] = anchor(L[b], sb, fb);  // turns each end into a point on its box with anchor()
              k.push(s('line', { x1, y1, x2, y2, class: 's-line', style: 'stroke:var(--accent)', 'stroke-width': 3, 'marker-end': 'url(#arr-accent)' }));  // draws the arrow in the accent colour
              if (tag) { const mx = ctx.util.clamp(x1 + (x2 - x1) * tf, 32, (small ? 360 : 1120) - 32), my = y1 + (y2 - y1) * tf; k.push(s('rect', { x: mx - 30, y: my - 11, width: 60, height: 22, rx: 5, class: 's-mem', 'stroke-width': 2 }), label(s, mx, my + 5, tag, { size: 12.5, weight: 800 })); }  // if it carries a tag: a small labelled box tf of the way along, kept 32px inside the drawing's edges by clamp
            });  // ends the loop over arrows
            svg.replaceChildren(...k);  // replaces the drawing's contents with the new shapes
          }  // ends draw()
          const player = ctx.ui.player({ count: frames.length, interval: 3400, render: (i) => { draw(frames[i]); return frames[i].cap; } });  // player: the guide's animation player; each frame is drawn by draw() and its caption shown, 3.4 seconds apart when playing
          const citySeg = ctx.ui.seg(Object.keys(TEMPS), city, (v) => { city = v; frames = txFrames(oneway, city, STEPS); player.refresh(); });  // citySeg: the city switch; a new city rebuilds the frames and redraws the frame now showing
          const stepsChip = h('span', { class: 'chip mem', style: { display: 'none' } }, 'steps = ' + STEPS);  // stepsChip: a chip showing the step count, hidden until the one-way call is chosen
          const argLab = h('span', { class: 'small b' }, 'City');  // argLab: the label in front of the argument control, "City" or "Argument"
          const modeSeg = ctx.ui.seg([{ value: 'two', label: 'Two-way: getTemp(city)' }, { value: 'one', label: 'One-way: reportSteps(n)' }], 'two', (v) => {  // modeSeg: the two-way / one-way switch
            oneway = v === 'one'; citySeg.style.display = oneway ? 'none' : ''; stepsChip.style.display = oneway ? '' : 'none'; argLab.textContent = oneway ? 'Argument' : 'City';  // on a change: sets oneway, swaps the city switch for the steps chip and renames the label
            frames = txFrames(oneway, city, STEPS); player.setCount(frames.length);  // rebuilds the frames for the new call and gives the player the new frame count, which restarts it at frame 1
          });  // ends the switch handler
          el.append(h('div', { class: 'stack fill', style: { gap: '8px' } },  // puts the step together in a full-height stack
            h('div', { class: 'row', style: { gap: '12px' } }, h('span', { class: 'small b' }, 'Call'), modeSeg, argLab, citySeg, stepsChip,  // the control row: "Call", the mode switch, the argument label, the city switch and the steps chip
              h('span', { class: 'small muted', style: { marginLeft: 'auto' } }, 'Step through, or press Play')),  // a hint pushed to the right end of the row
            svg, player.el));  // then the drawing, then the player with its caption and buttons
        },  // ends render() for step 3
      },  // ends step 3

      /* ---------------- 4. Marshalling lab: build a call, see its bytes, read them back ---------------- */
      {  // opens step 4
        title: 'Marshalling lab: pack a call into a parcel',  // step 4 title
        kind: 'lab',  // kind 'lab': a hands-on lab step
        core: true,  // core: true puts this step on the core path
        render(el, ctx) {  // render(el, ctx): builds the lab: pick a method and arguments, see the parcel's bytes, see how the stub reads them
          const { h } = ctx;  // takes the HTML builder h out of ctx
          const code = ctx.ui.code(`${/* code: a listing of the IWeather interface; the chosen method's line is highlighted */''}
interface IWeather {                                         // the contract: the proxy and the stub are both generated from this file${/* shown code, line 1: opens the interface, the contract both halves are generated from */''}
    int getTemp(String city);                                // method code 1 · two-way: the caller waits for an int${/* shown code, line 2: getTemp, method code 1, two-way */''}
    boolean setAlert(String city, int below, boolean buzz);  // method code 2 · two-way: the caller waits for true or false${/* shown code, line 3: setAlert, method code 2, two-way */''}
    oneway void reportSteps(int steps);                      // method code 3 · one-way: no reply, the caller never waits${/* shown code, line 4: reportSteps, method code 3, one-way */''}
}                                                            // end of the interface`, { lang: 'c', fontSize: 13.5 });  // shown code, line 5: closes the interface; the options colour it as C-like code at 13.5px
          let mi = 0, older = false, pick = 1;  // mi: the chosen method's position in METHODS; older: whether the stub uses the older AIDL; pick: the field highlighted in the grid
          const args = { city: 'Tampa', below: 32, buzz: true, steps: 4321 };  // args: the current argument values, shared by all three methods
          const FCLS = { token: 'f-token', String: 'f-str', int: 'f-int', boolean: 'f-bool' };  // FCLS: the colour class for each kind of field in the byte grid
          const argBox = h('div', { class: 'stack', style: { gap: '8px' } });  // argBox: holds the controls for the chosen method's arguments
          const env = h('div', { class: 'card tight small', style: { lineHeight: 1.5 } });  // env: the card that describes the transaction around the parcel (handle, code, flags, size, sender)
          const head = h('div', { class: 'row gap-s' });  // head: the row above the byte grid: its title and one button per field
          const per = ctx.narrow ? 8 : 20;   // bytes per row of the dump (20 keeps the largest parcel, 60 bytes, to three rows)
          const grid = h('div', { class: 'bgrid', style: { gridTemplateColumns: `30px repeat(${per}, minmax(0, 1fr))` } });  // grid: the byte dump, with one offset column and per byte columns per row
          const why = h('div', { class: 'narr', style: { fontSize: '14.5px', minHeight: '64px' } });  // why: the narration box that explains how the selected field is encoded
          const dec = h('div', { class: 'card white tight stack', style: { gap: '3px', fontSize: '14.5px' } });  // dec: the card that lists what the stub reads back
          const cityIn = h('input', { type: 'text', maxlength: 10, value: args.city, class: 'cityin', 'aria-label': 'city', oninput: (e) => { args.city = e.target.value; update(); } });  // cityIn: the city text box; every keystroke stores the new text and redraws
          const belowSl = ctx.ui.slider({ label: 'below (°F)', min: -20, max: 100, value: args.below, onInput: (v) => { args.below = v; update(); } });  // belowSl: slider for the alert temperature, -20 to 100 °F
          const buzzSeg = ctx.ui.seg([{ value: 1, label: 'true' }, { value: 0, label: 'false' }], 1, (v) => { args.buzz = !!v; update(); });  // buzzSeg: true/false switch for buzz
          const stepsSl = ctx.ui.slider({ label: 'steps', min: 0, max: 20000, value: args.steps, onInput: (v) => { args.steps = v; update(); } });  // stepsSl: slider for the step count, 0 to 20,000
          const cityRow = h('div', { class: 'row' }, h('label', { class: 'small b' }, 'city'), cityIn, h('span', { class: 'xs muted' }, 'type any name (up to 10 letters)'));  // cityRow: label, the city box and a hint about the 10-letter limit
          const buzzRow = h('div', { class: 'row' }, h('span', { class: 'small b' }, 'buzz'), buzzSeg);  // buzzRow: label and the true/false switch
          function argList() { return METHODS[mi].params.map(([, nm]) => args[nm]); }  // argList(): the chosen method's argument values, in declared order
          function renderArgs() {  // renderArgs(): shows only the controls the chosen method needs
            const m = METHODS[mi];  // m: the chosen method
            argBox.replaceChildren(...m.params.map(([, nm]) => ({ city: cityRow, below: belowSl, buzz: buzzRow, steps: stepsSl })[nm]));  // maps each parameter name to its control and puts those controls in argBox
            code.mark(mi + 2);  // highlights the method's line in the listing (line 2, 3 or 4)
          }  // ends renderArgs()
          function update() {  // update(): rebuilds the parcel and redraws everything that depends on it
            const m = METHODS[mi], p = marshal(m, argList());  // m: the method; p: its marshalled parcel, the bytes and the field list
            if (pick >= p.fields.length) pick = p.fields.length - 1;  // if the highlighted field no longer exists, highlights the last one instead
            const types = [['String', 'token']].concat(older ? m.old : m.params);  // types: what the stub expects: the token, then the current or the older parameter list
            const reads = unmarshal(p.bytes, types);  // reads: the stub's reading of the bytes, field by field
            const badAt = reads.find((r) => !r.ok);  // badAt: the first read that failed, if any
            /* transaction envelope */
            env.innerHTML = `<b>Transaction:</b> handle 1 · code ${m.code} (${m.name}) · flags ${m.oneway ? 'ONEWAY' : '0'} · ${p.bytes.length} bytes · sender UID ${WIDGET.uid}${m.oneway ? '' : ', PID ' + WIDGET.pid} <i>(added by the driver${m.oneway ? '; one-way calls carry no PID' : ''})</i>`;  // the envelope line: handle, method code and name, flags, size and the sender's UID (PID too for two-way), added by the driver
            /* byte grid */
            head.replaceChildren(h('b', {}, `Request parcel · ${p.bytes.length} bytes`), ...p.fields.map((f, i) => h('button', {  // head: the parcel's title and size, then one button per field labelled with its name and byte range
              class: 'btn sm' + (i === pick ? ' on' : ''), type: 'button', onclick: () => { pick = i; update(); },  // a button is lit when its field is the picked one; a click picks that field and redraws
            }, `${f.name === 'token' ? 'token' : f.name} ${f.start}–${f.start + f.len - 1}`)));  // the button's text, such as "city 24–39" (the token is just called token)
            const cells = [];  // cells: the spans that make up the grid, built row by row
            for (let r = 0; r < p.bytes.length; r += per) {  // one row for every per bytes
              cells.push(h('span', { class: 'off' }, String(r).padStart(2, '0')));  // the row's starting offset as two digits at the left
              for (let c = r; c < Math.min(r + per, p.bytes.length); c++) {  // each byte in this row
                const fi = p.fields.findIndex((f) => c >= f.start && c < f.start + f.len), f = p.fields[fi];  // fi: the position of the field this byte belongs to; f: that field
                const cls = 'b ' + FCLS[f.name === 'token' ? 'token' : f.type] + (c - f.start >= f.used ? ' pad' : '') + (fi === pick ? ' sel' : '') + (badAt && c >= badAt.at && c < badAt.at + 4 ? ' bad' : '');  // cls: the field's colour, faded if padding, a dark border if in the picked field, a dashed red border where a read failed
                cells.push(h('span', { class: cls, title: `byte ${c}: ${f.name}` }, hex2(p.bytes[c])));  // the byte as two hexadecimal digits; hovering shows its offset and field name
              }  // ends the bytes of the row
            }  // ends the rows
            grid.replaceChildren(...cells);  // replaces the grid's contents with the new cells
            /* how the picked field is encoded */
            const f = p.fields[pick], bx = (a, n) => p.bytes.slice(a, a + n).map(hex2).join(' ');  // f: the picked field; bx(a, n): the n bytes starting at offset a, written as hex pairs
            if (f.name === 'token') why.innerHTML = `<b>Interface token "${TOKEN}".</b> Stored like any string: length ${TOKEN.length} (<code>${bx(0, 4)}</code>), ${TOKEN.length} UTF-16 characters ('I' = <code>${bx(4, 2)}</code>), a 2-byte terminator, then ${f.len - f.used} padding bytes. The stub checks it first. (A real token is the full interface name, after a few header words.)`;  // token explanation: its length word, the bytes of the letter I, the terminator and padding, and that a real token is longer
            else if (f.type === 'String') why.innerHTML = `<b>${f.name} = "${ctx.util.esc(f.v)}".</b> A length word, ${f.v.length} (<code>${bx(f.start, 4)}</code>), then ${f.v.length} character${f.v.length === 1 ? '' : 's'} of 2 bytes each, low byte first${f.v.length ? ` ('${ctx.util.esc(f.v[0])}' = <code>${bx(f.start + 4, 2)}</code>)` : ''}, then <code>00 00</code> as terminator${f.len > f.used ? `, then ${f.len - f.used} padding bytes` : ''}: ${f.len} bytes in all.`;  // String explanation: length word, 2 bytes per character low byte first with the first letter as example, terminator, padding
            else if (f.type === 'int') why.innerHTML = `<b>${f.name} = ${f.v}.</b> One 32-bit integer, least significant byte first (little-endian, as on the ARM processors in phones): <code>${bx(f.start, 4)}</code>.${f.v < 0 ? ' A negative number is stored in two\'s complement, so its high bytes are FF.' : ''}`;  // int explanation: 4 bytes, low byte first as on phone processors; negatives get FF high bytes from two's complement
            else why.innerHTML = `<b>${f.name} = ${f.v}.</b> A boolean is stored as a whole 32-bit int, 1 or 0: <code>${bx(f.start, 4)}</code>. That spends 4 bytes on one bit, but keeps every field on a 4-byte boundary.`;  // boolean explanation: a whole 4-byte int holding 1 or 0, wasteful but it keeps every field 4-byte aligned
            /* the stub reads it back */
            const sig = (ps) => ps.map(([ty, nm]) => ty + ' ' + nm).join(', ');  // sig(ps): writes a parameter list as "type name, type name"
            const lines = [h('div', { class: 'b', html: `The ${older ? '<span style="color:var(--bad)">older</span> ' : ''}stub reads: ${m.name}(${sig(older ? m.old : m.params)})` })];  // lines: starts with a heading naming the stub (older shown in red) and the signature it expects to read
            reads.forEach((r) => {  // one line per field the stub read
              const val = r.ok ? (r.type === 'String' ? `"${ctx.util.esc(r.v)}"` : String(r.v)) : '✗ ' + r.why;  // val: the value read (strings quoted and escaped so they show as typed), or a cross and the reason it failed
              const extra = r.name === 'token' && r.ok ? (r.v === TOKEN ? ' ✓ right interface' : ' ✗ wrong interface') : '';  // extra: for the token only, whether it names the right interface
              lines.push(h('div', { class: 'mono', style: { fontSize: '13.5px', color: r.ok ? null : 'var(--bad)' }, html: `@${String(r.at).padStart(2, '0')} read${r.type === 'boolean' ? 'Boolean' : r.type === 'String' ? 'String' : 'Int'}() → ${r.name === 'token' ? '' : r.name + ' = '}${val}${extra}` }));  // a fixed-width line such as "@04 readString() → city = ..." with the offset and the read call, red when it failed
            });  // ends the loop over reads
            let res;  // res: the line under the reads that gives the outcome
            if (badAt) res = `<b style="color:var(--bad)">The read fails.</b> ${m.oneway ? 'The call is one-way, so the widget is never even told.' : 'The widget gets an error, not an answer.'}`;  // a failed read: the call fails, and a one-way caller is not even told
            else if (older) res = `<b style="color:var(--bad)">No error, wrong values.</b> Every read "worked", but the values are not what the widget sent: ${reads.slice(1).map((r) => r.name + ' = ' + (r.type === 'String' ? '"' + ctx.util.esc(r.v) + '"' : r.v)).join(', ')}. A parcel has positions, not names, so nothing can notice.`;  // older stub with no failed read: every read worked but the values are wrong, because a parcel has positions, not names
            else if (m.name === 'getTemp') { const t = TEMPS[args.city] ?? -999; res = `→ getTemp("${ctx.util.esc(args.city)}") returns <b>${t}</b>${t === -999 ? ' (this demo service only knows Tampa, Denver and Chicago)' : ''}. Reply parcel: <code>${le32(0).map(hex2).join(' ')} | ${le32(t).map(hex2).join(' ')}</code> (status 0, then ${t}).`; }  // getTemp: the answer from TEMPS (-999 for an unknown city) and the reply parcel's bytes, status 0 then the value
            else if (m.name === 'setAlert') { const ok = args.city in TEMPS; res = `→ setAlert(...) returns <b>${ok}</b>${ok ? '' : ' (unknown city)'}. Reply parcel: <code>${le32(0).map(hex2).join(' ')} | ${le32(ok ? 1 : 0).map(hex2).join(' ')}</code> (status 0, then ${ok ? 1 : 0}).`; }  // setAlert: true only for a known city, and its reply parcel's bytes
            else res = `→ reportSteps(${args.steps}) runs. <b>No reply parcel</b>: the call is one-way, so the widget never waits and never hears back.`;  // reportSteps: it runs, and there is no reply parcel at all
            lines.push(h('div', { style: { marginTop: '2px' }, html: res }));  // adds the outcome line
            dec.replaceChildren(...lines);  // replaces the stub panel's contents
          }  // ends update()
          const mSeg = ctx.ui.seg(METHODS.map((m, i) => ({ value: i, label: m.name })), 0, (v) => { mi = v; pick = Math.min(pick, METHODS[mi].params.length); renderArgs(); update(); });  // mSeg: the method switch; switching keeps the picked field in range, shows the right controls and redraws
          const oSeg = ctx.ui.seg([{ value: 0, label: 'same AIDL as the proxy' }, { value: 1, label: 'an older AIDL' }], 0, (v) => { older = !!v; update(); });  // oSeg: whether the stub was built from the same AIDL file as the proxy or an older one
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } }, code,  // puts the step together: the interface listing on top
            h('div', { class: 'split grow', style: { gridTemplateColumns: ctx.narrow ? null : 'minmax(0, 5fr) minmax(0, 7fr)', gap: '18px' } },  // below it two columns, 5 parts to 7 on wide screens and stacked on phone-width ones
              h('div', { class: 'stack', style: { gap: '9px' } },  // left column
                h('div', { class: 'row' }, h('span', { class: 'small b' }, 'Method'), mSeg),  // the Method label and switch
                h('div', { class: 'card tight' }, argBox),  // the argument controls in a card
                h('div', { class: 'row' }, h('span', { class: 'small b' }, 'Stub built from'), oSeg),  // the "Stub built from" label and switch
                env,  // the transaction envelope card
                h('div', { class: 'callout warn small m0', 'data-label': 'Common mistake' }, 'Rebuilding only one side after reordering the parameters in an AIDL file.')),  // common-mistake callout: reordering parameters and rebuilding only one side
              h('div', { class: 'stack', style: { gap: '5px' } }, head, grid, why, dec))));  // right column: field buttons, byte grid, encoding explanation and the stub's reads
          renderArgs(); update();  // first draw: shows getTemp's controls and its parcel
        },  // ends render() for step 4
      },  // ends step 4

      /* ---------------- 5. The server's Binder thread pool under load ---------------- */
      {  // opens step 5
        title: 'Many callers at once: the Binder thread pool',  // step 5 title
        kind: 'explore',  // kind 'explore': a step the student plays with
        render(el, ctx) {  // render(el, ctx): builds a simulation of four apps calling one server that has only a few Binder threads
          const { h } = ctx;  // takes the HTML builder h out of ctx
          const CL = [  // CL: the four client apps, each with the method it calls and how many 100 ms ticks of work its call needs
            { id: 'Widget', m: 'getTemp()', work: 3 }, { id: 'Maps', m: 'getRadar()', work: 4 },  // Widget calls getTemp (3 ticks); Maps calls getRadar (4 ticks)
            { id: 'Watch', m: 'getTemp()', work: 3 }, { id: 'Clock', m: 'setAlert()', work: 2 },  // Watch calls getTemp (3 ticks); Clock calls setAlert (2 ticks)
          ];  // closes CL
          const MS = 100;   // one tick of the simulation = 100 ms
          let limit = 2, t, queue, threads, calls, running, gen = 0;  // thread limit, clock in ticks, waiting queue, thread slots, per-call timing, Run state, and gen, bumped on reset or pause to stop an old Run loop
          const kept = ctx.keep.pool;  // kept: this lab's state from just before a redraw for a new layout (phone-width or desktop); empty on a normal visit
          if (kept) limit = kept.limit;  // restores the thread limit first, so the switch built below shows the right number
          const cliCol = h('div', { class: 'stack', style: { gap: '8px' } });  // cliCol: the column of client apps
          const qCol = h('div', { class: 'stack', style: { gap: '6px' } });  // qCol: the column that shows the driver's queue
          const poolCol = h('div', { class: 'stack', style: { gap: '8px' } });  // poolCol: the column of server threads
          const narr = h('div', { class: 'narr', style: { minHeight: '92px' } });  // narr: the narration box that reports what just happened
          const tbl = h('table', { class: 'tbl compact' });  // tbl: the timing table
          const clock = h('span', { class: 'chip accent num' });  // clock: the chip that shows the current time
          const runBtn = h('button', { class: 'btn sm', type: 'button', onclick: () => (running ? pause() : run()) }, 'Run');  // runBtn: Run while stopped, Pause while running
          const tickBtn = h('button', { class: 'btn sm primary', type: 'button', onclick: () => { pause(); tick(); } }, 'Next tick ▶');  // tickBtn: pauses and moves time forward by one tick
          const ms = (k) => k * MS + ' ms';  // ms(k): k ticks written as milliseconds, such as "300 ms"
          function reset(msg) {  // reset(msg): starts the simulation over
            gen++; running = false; t = 0; queue = []; calls = {};  // bumps gen so any Run loop in progress stops, and clears the clock, the queue and the call records
            threads = Array.from({ length: limit }, () => null);  // one empty slot per thread; null means asleep in the driver
            say(msg || `Reset. The weather app has <b>${limit}</b> Binder thread${limit === 1 ? '' : 's'}. Make some apps call, then step time forward.`);  // shows msg, or a default message naming the number of threads
            draw();  // redraws
          }  // ends reset()
          function say(html, tone) { narr.className = 'narr' + (tone ? ' ' + tone : ''); narr.innerHTML = html; }  // say(html, tone): writes html in the narration box, tinted green for 'ok' or red for 'bad'
          function startOn(i, c) { threads[i] = { c, left: CL.find((x) => x.id === c).work }; calls[c].start = t; }  // startOn(i, c): thread i starts serving app c's call with all its work left, and the start time is recorded
          function call(c) {  // call(c): app c makes its call now
            const k = CL.find((x) => x.id === c);  // k: the app's entry in CL
            calls[c] = { arrive: t, start: null, done: null };  // records when it arrived; start and finish are not known yet
            const free = threads.indexOf(null);  // free: the first sleeping thread, or -1 if all are busy
            if (free >= 0) { startOn(free, c); say(`<b>${c}</b> calls ${k.m} at t = ${ms(t)}. Thread <b>B${free + 1}</b> is free, so the driver hands it the transaction at once. ${c}'s calling thread now waits for the reply.`, 'ok'); }  // a free thread takes the call at once; the green narration says the caller now waits for the reply
            else { queue.push(c); say(`<b>${c}</b> calls ${k.m}, but all ${limit} Binder thread${limit === 1 ? ' is' : 's are'} busy. The driver keeps the transaction in the weather app's queue (position ${queue.length}). ${c}'s calling thread stays blocked, waiting longer.`, 'bad'); }  // otherwise the call joins the queue, and the red narration gives its place in line
            draw();  // redraws
          }  // ends call()
          function tick() {  // tick(): moves time forward one tick; returns true while work remains
            if (!threads.some(Boolean) && !queue.length) { say(Object.keys(calls).length ? 'Every call has been answered.' + summary() + ' Press Call on an app, or Reset.' : 'Nothing to do yet: no call is running or waiting. Make an app call first.'); return false; }  // nothing running or waiting: reports that all calls were answered (with a summary) or that nothing has started; returns false
            t += 1;  // time moves forward one tick
            const ev = [];  // ev: what happened in this tick, for the narration
            threads.forEach((th, i) => {  // every busy thread does one tick of work
              if (!th) return;  // skips sleeping threads
              th.left -= 1;  // one tick less of work left
              if (th.left === 0) { const c = calls[th.c]; c.done = t; ev.push(`B${i + 1} finishes <b>${th.c}</b>'s call and replies (waited ${ms(c.start - c.arrive)} in the queue, ${ms(c.done - c.arrive)} in all)`); threads[i] = null; }  // work done: records the finish time, notes the reply with its queue and total times, and frees the thread
            });  // ends the work loop
            threads.forEach((th, i) => {  // then every free thread takes the next waiting call, if any
              if (th || !queue.length) return;  // skips busy threads, or every thread if nobody is waiting
              const c = queue.shift(); startOn(i, c);  // c: the first waiting call, taken off the front of the queue; thread i starts serving it
              ev.push(`B${i + 1} takes the next waiting call, <b>${c}</b>'s, after ${ms(t - calls[c].arrive)} in the queue`);  // notes how long that call waited in the queue
            });  // ends the loop over free threads
            const more = threads.some(Boolean) || queue.length > 0;  // more: whether any thread is still busy or any call still waits
            say(`<b>t = ${ms(t)}.</b> ` + (ev.length ? ev.join('; ') + '.' : 'Every busy thread does another 100 ms of work.') + (queue.length ? ` Still waiting: ${queue.join(', ')}.` : '') + (more ? '' : summary()), ev.length ? 'ok' : null);  // narration: the time, this tick's events (or that busy threads did 100 ms more), who still waits, and a summary at the end
            draw();  // redraws
            return more;  // tells the caller, such as the Run loop, whether to keep going
          }  // ends tick()
          function summary() {  // summary(): a sentence about the longest wait in the queue, added once all calls are answered
            const done = CL.filter((k) => calls[k.id] && calls[k.id].done != null).map((k) => [k.id, calls[k.id].start - calls[k.id].arrive]);  // done: [app, time spent queued] for every finished call
            if (!done.length) return '';  // with no finished calls there is nothing to say
            const worst = done.reduce((a, b) => (b[1] > a[1] ? b : a));  // worst: the call that waited longest
            return worst[1] ? ` Longest wait in the queue: <b>${worst[0]}, ${ms(worst[1])}</b>.` : ' Nobody had to wait in the queue.';  // names it and its wait, or says that nobody had to wait
          }  // ends summary()
          function run() {  // run(): plays the simulation by itself, one tick every 0.8 seconds
            running = true; const g = gen; draw();  // marks it running, remembers this run's gen, and redraws so the button says Pause
            const loop = () => { if (g !== gen || !running) return; if (tick()) ctx.after(800, loop); else { running = false; draw(); } };  // loop: quits if Reset was pressed (gen changed) or Pause was; otherwise ticks and repeats while work remains, else stops
            ctx.after(400, loop);  // the first tick comes after 0.4 seconds; ctx.after cancels it if the student leaves the slide
          }  // ends run()
          function pause() { running = false; gen++; draw(); }  // pause(): stops automatic play, bumps gen so the tick already waiting can never fire (a quick Run again starts one fresh loop, not two), and redraws the button
          function draw() {  // draw(): redraws the three columns, the clock and the timing table
            ctx.keep.pool = { limit, t, queue, threads, calls, msg: narr.innerHTML };  // remembers the current state (the very arrays and objects the lab works on) in case the window crosses the phone-width breakpoint
            clock.textContent = 't = ' + ms(t);  // shows the time in the clock chip
            runBtn.textContent = running ? 'Pause' : 'Run';  // the button reads Pause while running, otherwise Run
            cliCol.replaceChildren(h('h4', { class: 'm0' }, 'Client apps'), ...CL.map((k) => {  // the client column: a heading, then one card per app
              const c = calls[k.id], st = !c ? 'idle' : c.done != null ? 'got its reply' : c.start != null ? 'blocked: being served' : 'blocked: queued';  // c: the app's call record; st: idle, got its reply, being served, or queued
              const cls = !c ? '' : c.done != null ? 'ok' : c.start != null ? 'proc' : 'warn';  // cls: the chip colour for that state: plain, green, teal or amber
              return h('div', { class: 'card tight', style: { padding: '7px 10px' } },  // the app's card
                h('div', { class: 'row', style: { justifyContent: 'space-between', flexWrap: 'nowrap' } }, h('b', {}, k.id), h('span', { class: 'xs muted' }, `${k.m} · ${ms(k.work)}`)),  // top line: the app's name, then its method and how long the call takes
                h('div', { class: 'row', style: { justifyContent: 'space-between', flexWrap: 'nowrap', marginTop: '4px' } }, h('span', { class: 'chip ' + cls }, st),  // second line: the state chip, and
                  h('button', { class: 'btn sm proc', type: 'button', disabled: !!(c && c.done == null), onclick: () => call(k.id) }, 'Call')));  // the app's Call button, greyed out while its call waits for a reply
            }));  // ends the client cards
            qCol.replaceChildren(h('h4', { class: 'm0' }, 'Binder driver queue'),  // the queue column: a heading, then
              ...(queue.length ? queue.map((c, i) => h('div', { class: 'box warn small', style: { padding: '6px 8px' } }, `${i + 1}. ${c} (since ${ms(calls[c].arrive)})`))  // one amber box per waiting call, numbered in order, with the time it arrived
                : [h('div', { class: 'small muted', style: { padding: '6px 2px' } }, 'none waiting')]),  // or "none waiting" when the queue is empty
              h('p', { class: 'xs muted m0', style: { marginTop: '4px' } }, 'First in, first out. A waiting caller costs no CPU: its thread is blocked.'));  // note: the queue is first in, first out, and a blocked caller uses no processor time
            poolCol.replaceChildren(h('h4', { class: 'm0' }, `Server: ${limit} Binder thread${limit === 1 ? '' : 's'}`), ...threads.map((th, i) => {  // the pool column: a heading with the number of threads, then one card per thread
              const k = th && CL.find((x) => x.id === th.c);  // k: the app whose call this thread is serving, if any
              return h('div', { class: 'card tight ' + (th ? 'thread' : ''), style: { padding: '7px 10px' } },  // the thread's card, pink while busy
                h('div', { class: 'row', style: { justifyContent: 'space-between', flexWrap: 'nowrap' } }, h('b', {}, 'B' + (i + 1)), h('span', { class: 'small' }, th ? `${th.c}: ${k.m}` : 'asleep in the driver')),  // top line: the thread's name and what it is serving, or "asleep in the driver"
                h('div', { class: 'meter', style: { marginTop: '6px' } }, h('i', { style: { width: th ? ((k.work - th.left) / k.work) * 100 + '%' : '0%' } })));  // a meter filled by how much of the call's work is done
            }));  // ends the thread cards
            const rows = CL.filter((k) => calls[k.id]).map((k) => { const c = calls[k.id]; return h('tr', {}, h('td', {}, h('b', {}, k.id)), h('td', { class: 'num' }, ms(c.arrive)), h('td', { class: 'num' }, c.start == null ? '…' : ms(c.start)), h('td', { class: 'num' }, c.done == null ? '…' : ms(c.done)), h('td', { class: 'num' }, c.start == null ? '…' : ms(c.start - c.arrive))); });  // rows: one table row per app that has called: called, started, replied and time queued, with … for times not reached yet
            tbl.replaceChildren(h('tr', {}, ...['App', 'Called', 'Started', 'Replied', 'Queued'].map((x) => h('th', {}, x))), ...(rows.length ? rows : [h('tr', {}, h('td', { colspan: 5, class: 'muted' }, 'No calls yet.'))]));  // fills the table: the header row, then the rows, or one "No calls yet." row
          }  // ends draw()
          const limSeg = ctx.ui.seg([1, 2, 3, 4].map((v) => ({ value: v, label: String(v) })), limit, (v) => { limit = v; reset(`Thread limit set to <b>${v}</b>. Everything was reset.`); });  // limSeg: the 1 to 4 thread limit switch; changing it resets everything
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },  // puts the step together in a full-height stack
            h('div', { class: 'row', style: { gap: '10px' } }, h('span', { class: 'small b' }, 'Binder threads in the server'), limSeg,  // control row: the label and the thread limit switch
              h('button', { class: 'btn sm proc', type: 'button', onclick: () => { reset(); CL.forEach((k) => call(k.id)); say(`All four apps call at t = 0. ${Math.min(limit, 4)} start at once; ${Math.max(0, 4 - limit)} must wait in the driver's queue. Press <b>Next tick</b> or <b>Run</b>.`, 4 > limit ? 'bad' : 'ok'); } }, 'All four call at once'),  // "All four call at once": resets, makes every app call, and says how many start at once and how many must wait
              tickBtn, runBtn, h('button', { class: 'btn sm', type: 'button', onclick: () => reset() }, 'Reset'), clock),  // the Next tick, Run and Reset buttons, then the clock chip
            h('div', { class: 'split grow', style: { gridTemplateColumns: ctx.narrow ? null : 'minmax(0, 7fr) minmax(0, 5fr)', gap: '18px' } },  // below them two columns, 7 parts to 5 on wide screens
              h('div', { class: 'stack', style: { gap: '12px' } },  // left column
                h('div', { class: 'grid-3', style: { gridTemplateColumns: ctx.narrow ? '1fr' : 'minmax(0, 1.15fr) minmax(0, .85fr) minmax(0, 1.15fr)', alignItems: 'start' } }, cliCol, qCol, poolCol),  // the client, queue and pool columns side by side, or one under another on phone-width screens
                h('div', { class: 'card tight small', style: { lineHeight: 1.45 } }, h('b', {}, 'Try these'),  // a card of experiments to try
                  h('ol', { class: 'm0', style: { paddingLeft: '20px' } },  // a numbered list of three
                    h('li', {}, '2 threads: press "All four call at once", then step. Who waits, and for how long?'),  // experiment 1: two threads and all four apps calling at once
                    h('li', {}, '1 thread: how long does Clock wait now? 4 threads: does anyone wait?'),  // experiment 2: one thread, then four threads
                    h('li', {}, 'Why is an app\'s Call button greyed out while it waits for a reply?')))),  // experiment 3: why the Call button is greyed out while waiting
              h('div', { class: 'stack', style: { gap: '9px' } }, narr, tbl,  // right column: the narration and the timing table
                h('div', { class: 'callout why small m0', 'data-label': 'Why it matters' }, 'A blocked caller that is an app\'s main thread freezes its screen. If an app ignores input for about 5 seconds, Android offers to close it ("isn\'t responding"). So apps make slow Binder calls from background threads, and services keep each call short.'),  // why-it-matters callout: a blocked main thread freezes the screen, so slow calls belong on background threads
                h('p', { class: 'small muted m0' }, 'Simplified: the pool here is fixed at 1 to 4 threads. Real Android adds one whenever all are busy, by default up to 15 beyond the first (16 per app); past that, calls wait as here.')))));  // note on the simplification: real Android grows the pool, up to 16 threads per app by default
          if (kept) { ({ t, queue, threads, calls } = kept); running = false; say(kept.msg || 'Paused where you were. Press Run or Next tick to carry on.'); draw(); }  // after a redraw for a new layout: picks up the clock, queue, threads and calls exactly where they were, paused
          else reset();  // a normal visit starts fresh, with the default reset message
        },  // ends render() for step 5
      },  // ends step 5

      /* ---------------- 6. What the driver knows: who is calling, and who holds what ---------------- */
      {  // opens step 6
        title: 'The driver knows who is calling, and who holds what',  // step 6 title
        kind: 'lab',  // kind 'lab': a hands-on lab step
        render(el, ctx) {  // render(el, ctx): builds two tabs: a permission check that trusts the driver's stamp, and object references the driver counts
          const { h } = ctx;  // takes the HTML builder h out of ctx
          /* ---- tab 1: a permission check that trusts the driver's stamp, not the parcel ---- */
          function permTab(panel) {  // permTab(panel): draws the first tab into panel
            const APPS = [  // APPS: the four apps that can call the location service
              { id: 'maps', name: 'Maps', uid: 10093, pid: 4377, grant: true },  // Maps: granted precise location
              { id: 'widget', name: WIDGET.name, uid: WIDGET.uid, pid: WIDGET.pid, grant: false },  // the weather widget: not granted
              { id: 'settings', name: 'Settings', uid: 1000, pid: 1880, system: true },  // Settings: runs as the system user, so it is always allowed
              { id: 'sneaky', name: 'Sneaky app', uid: 10140, pid: 6021, grant: false, lie: true },  // Sneaky app: not granted, and it lies about its identity inside its parcel
            ];  // closes APPS
            let gen = 0, cur = null;  // gen: numbers each call so an older animation stops if a new call starts; cur: the app now calling
            const code = ctx.ui.code(`${/* code: the location service's method, shown in simplified form */''}
Location getLocation() {                 // runs on a Binder thread${/* shown code, line 1: the method's header; it runs on a Binder thread */''}
  int uid = Binder.getCallingUid();      // caller's UID, from the driver${/* shown code, line 2: asks for the caller's UID, which the driver recorded */''}
  int pid = Binder.getCallingPid();      // caller's PID, from the driver${/* shown code, line 3: and the caller's PID */''}
  if (!granted(FINE_LOCATION, pid, uid)) // was this app given location?${/* shown code, line 4: checks whether that app was granted precise location */''}
    throw new SecurityException();       // no: refuse; the error goes back${/* shown code, line 5: if not, refuses with an exception that travels back to the caller */''}
  return lastLocation;                   // yes: the location goes back${/* shown code, line 6: if so, returns the location */''}
}                                        // end of the method`, { lang: 'c', fontSize: 13 });  // shown code, line 7: end of the method; the options colour it as C-like code at 13px
            const callers = h('div', { class: 'stack', style: { gap: '6px' } });  // callers: the column of caller buttons
            const perms = h('table', { class: 'tbl compact' });  // perms: the permission table
            const out = h('div', { class: 'stack', style: { gap: '8px' } });  // out: the area that shows the parcel, the stamp and the decision
            function drawPerms() {  // drawPerms(): redraws the permission table
              perms.replaceChildren(h('tr', {}, h('th', {}, 'App'), h('th', {}, 'UID'), h('th', {}, 'Precise location')),  // header row: App, UID, Precise location
                ...APPS.map((a) => h('tr', {}, h('td', {}, a.name), h('td', { class: 'num' }, String(a.uid)),  // one row per app, with its name and UID
                  h('td', {}, a.system ? h('span', { class: 'chip os' }, 'always (system)') : h('button', {  // the system app gets a fixed "always (system)" chip; the others get a toggle button
                    class: 'btn sm ' + (a.grant ? 'on' : ''), type: 'button', 'aria-pressed': String(!!a.grant),  // the toggle is lit when granted; aria-pressed tells screen readers whether it is on
                    onclick: () => { a.grant = !a.grant; drawPerms(); if (cur === a.id) callFrom(a.id); },  // a click flips the grant, redraws, and replays the call if this app is the one calling now
                  }, a.grant ? 'granted ✓' : 'denied ✗')))));  // the toggle reads "granted ✓" or "denied ✗"
            }  // ends drawPerms()
            function callFrom(id) {  // callFrom(id): animates one call to getLocation() from app id
              const a = APPS.find((x) => x.id === id), g = ++gen, ok = a.system || a.grant;  // a: the app; g: this call's number; ok: whether the call will be allowed (system app or granted)
              cur = id;  // cur: remembers which app is calling now
              callers.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.id === id));  // lights up that app's button and dims the others
              code.clear(); code.mark([1, 2, 3], 'cur');  // clears the listing's highlights and marks lines 1 to 3 as running
              const parcel = `token "ILocation"${a.lie ? ', then String "I am UID 1000, trust me"' : ''}`;  // parcel: what the caller wrote: the interface token, plus, for the liar, a false claim to be UID 1000
              out.replaceChildren(  // fills the output area with two boxes
                h('div', { class: 'card tight small', html: `<b>${a.name}</b> calls getLocation().<br><b>Parcel</b>, written by the caller: <code>${parcel}</code><br><b>Stamp</b>, written by the driver: <code>UID ${a.uid}, PID ${a.pid}</code>` }),  // a card: the caller, the parcel it wrote, and the stamp the driver wrote
                h('div', { class: 'narr' }, 'The service reads the stamp…'));  // a narration box saying the service is reading the stamp
              ctx.after(450, () => {  // after 0.45 seconds
                if (g !== gen) return;  // stops if a newer call has started meanwhile
                code.mark([1, 2, 3], 'ok'); code.mark([4], 'cur');  // lines 1 to 3 turn green (done) and line 4, the permission check, is highlighted
                ctx.after(450, () => {  // after another 0.45 seconds
                  if (g !== gen) return;  // stops if a newer call has started meanwhile
                  code.clear(); code.mark([1, 2, 3, 4], 'ok'); code.mark([ok ? 6 : 5], ok ? 'ok' : 'bad'); code.mark([ok ? 5 : 6], 'dim');  // lines 1 to 4 green; the line that runs (6 or 5) green or red; the line that is skipped is dimmed
                  const n = out.lastChild;  // n: the narration box, the last thing in the output area
                  n.className = 'narr ' + (ok ? 'ok' : 'bad');  // tints it green when allowed, red when refused
                  n.innerHTML = ok  // writes the decision
                    ? `<b>Allowed.</b> getCallingUid() returned ${a.uid}${a.system ? ', the system user, which is always trusted' : ', and that UID was granted precise location'}. The reply carries the location (27.95° N, 82.46° W) back to ${a.name}.`  // allowed: the UID returned, why it passes, and the location going back to the caller
                    : `<b>Refused.</b> getCallingUid() returned ${a.uid}, which was not granted precise location. A SecurityException is written into the reply, and ${a.name}'s proxy throws it.${a.lie ? ' The claim inside the parcel changed nothing: the service never reads identity from the parcel, because anything in a parcel was written by the caller and could say anything.' : ''}`;  // refused: the UID was not granted, an exception goes back; for the liar, the claim in the parcel changed nothing
                });  // ends the second delay
              });  // ends the first delay
            }  // ends callFrom()
            APPS.forEach((a) => callers.append(h('button', { class: 'btn', type: 'button', 'data-id': a.id, style: { justifyContent: 'space-between', flex: 'none' }, onclick: () => callFrom(a.id) },  // one button per app in the callers column; data-id names the app, and a click makes it call
              h('span', {}, a.name + (a.lie ? ' (lies)' : '')), h('span', { class: 'xs muted num' }, `UID ${a.uid}`))));  // the button shows the app's name (with "(lies)" for the sneaky one) and its UID
            drawPerms();  // draws the permission table
            panel.append(h('div', { class: 'split fill', style: { gridTemplateColumns: ctx.narrow ? null : 'minmax(0, 4fr) minmax(0, 6fr)' } },  // puts the tab together: two columns, 4 parts to 6 on wide screens
              h('div', { class: 'stack', style: { gap: '9px' } },  // left column
                h('p', { class: 'm0', html: 'Every transaction carries the sender\'s <span class="t" data-t="calling uid">UID and PID</span>, written by the <span class="t">Binder driver</span> inside the kernel. A service asks "who is calling?" and decides. Pick a caller:' }),  // intro paragraph: every transaction carries the sender's UID and PID, written by the driver
                callers, perms),  // the caller buttons and the permission table
              h('div', { class: 'stack', style: { gap: '9px' } },  // right column
                h('div', { class: 'small muted' }, 'The location service in system_server (simplified; granted() stands for Android\'s permission check):'),  // grey note: this is the location service in system_server, simplified
                code, out,  // the listing and the output area
                h('div', { class: 'callout why small m0', 'data-label': 'Why it matters' }, 'An app cannot pretend to be another app, because the kernel, not the app, writes the stamp. Android\'s permission checks rest on this.'))));  // why-it-matters callout: the kernel writes the stamp, so one app cannot pretend to be another
            out.append(h('div', { class: 'narr' }, 'Pick a caller on the left. Try the Sneaky app, then grant or deny permissions in the table.'));  // the first message in the output area: pick a caller
            return () => { gen++; };  // returns a tidy-up function that bumps gen, so a pending animation stops when the tab or slide closes
          }  // ends permTab()
          /* ---- tab 2: object references that the driver counts ---- */
          function refTab(panel) {  // refTab(panel): draws the second tab into panel
            let st;  // st: the state of the simulation
            const narr = h('div', { class: 'narr', style: { minHeight: '70px' } });  // narr: the narration box
            const cols = h('div', { class: 'grid-4', style: { alignItems: 'stretch', gridTemplateColumns: ctx.narrow ? '1fr' : null } });  // cols: four columns for Widget, Maps, the driver and the weather app (one column on phone-width screens)
            const log = h('div', { class: 'log', style: { height: '112px' } });  // log: a running list of events, newest on top
            const acts = h('div', { class: 'row gap-s' });  // acts: the row of action buttons
            function reset() { st = { alive: true, node: false, widget: null, maps: null, dead: [] }; log.innerHTML = ''; say('Reset. The weather app is running. Nothing refers to a session object yet.'); draw(); }  // reset(): the app alive, no node, no handles, nobody notified; clears the log, says so and redraws
            function say(x, tone) { narr.className = 'narr' + (tone ? ' ' + tone : ''); narr.innerHTML = x; }  // say(x, tone): writes in the narration box, tinted by tone
            function note(x) { log.prepend(h('div', {}, x)); }  // note(x): adds a line to the top of the log
            const count = () => (st.widget != null) + (st.maps != null);  // count(): how many processes hold a handle to the session (each true adds 1)
            function act(k) {  // act(k): carries out one action and explains it
              if (k === 'open') { st.node = true; st.widget = 2; note('Widget: openSession() → handle 2 · count 1'); say('<b>Widget calls openSession().</b> The weather app creates a ForecastSession object and puts a reference to it in the reply parcel. The driver records a node for it and gives the widget its own handle number for it: <b>handle 2</b>. Reference count: <b>1</b>.', 'ok'); }  // open: the widget calls openSession(); the driver creates a node and gives the widget handle 2; count 1
              if (k === 'pass') { st.maps = 5; note('Widget → Maps: reference in a parcel → Maps gets handle 5 · count 2'); say('<b>Widget passes the session to Maps</b> inside a parcel. The driver sees an object reference in the data, finds the same node, and gives Maps a handle of its own: <b>handle 5</b>. Same object, different numbers, like file descriptors in two processes. Reference count: <b>2</b>.', 'ok'); }  // pass: the widget sends the reference to Maps, which gets its own handle, 5, for the same node; count 2
              if (k === 'dropW' || k === 'dropM') {  // release: one app gives up its handle
                st[k === 'dropW' ? 'widget' : 'maps'] = null;  // clears that app's handle
                const who = k === 'dropW' ? 'Widget' : 'Maps';  // who: the app's display name
                note(`${who} releases its handle · count ${count()}${count() ? '' : ' → weather app told: free it'}`);  // logs the release and the new count; at zero, the weather app is told it may free the object
                if (count()) say(`<b>${who} releases its handle.</b> The driver lowers the reference count to <b>${count()}</b>. The object must stay: someone still refers to it.`);  // count still above zero: the object must stay
                else { st.node = false; say(`<b>${who} releases the last handle.</b> The count reaches <b>0</b>, so the driver tells the weather app that no other process refers to the session any more. The app can now free the object. Without this count, a server could never know when it is safe.`, 'ok'); }  // count reached zero: the node goes away and the owner may free the object
              }  // ends the release case
              if (k === 'crash') {  // crash: the weather app's process dies
                const holders = ['widget', 'maps'].filter((x) => st[x] != null).map((x) => (x === 'widget' ? 'Widget' : 'Maps'));  // holders: the apps that still held a handle
                st.alive = false; st.node = false; st.dead = holders; st.widget = null; st.maps = null;  // marks the app dead, removes the node, records who gets death notices, and clears both handles
                note('weather app process dies' + (holders.length ? ' → death notices to ' + holders.join(', ') : ''));  // logs the death and who was notified
                say(holders.length ? `<b>The weather app crashes.</b> The driver notices its process is gone and sends a <b>death notification</b> to each holder that asked for one with linkToDeath (here, ${holders.join(' and ')} did). ${holders.length === 1 ? 'Its handle is' : 'Their handles are'} now dead; a call through a dead handle fails at once with DeadObjectException instead of hanging forever.` : '<b>The weather app crashes.</b> Nobody held a session reference, so nobody needs a death notification.', 'bad');  // explains death notifications and DeadObjectException, or that nobody held a reference
              }  // ends the crash case
              draw();  // redraws
            }  // ends act()
            function draw() {  // draw(): redraws the four columns and the buttons
              const n = count();  // n: the current reference count
              const proc = (name, hd, base) => h('div', { class: 'card tight stack', style: { gap: '6px' } }, h('b', {}, name),  // proc(name, hd, base): a client app's card: its name
                h('div', { class: 'small', html: base }),  // the handles it always holds, given in base
                hd != null ? h('div', { class: 'box accent small' }, `handle ${hd} → ForecastSession`) : h('div', { class: 'box small', style: { opacity: 0.55 } }, st.dead.includes(name) ? 'death notice received ✗' : 'no session handle'));  // and its session handle if it has one, otherwise a faded box: a death notice received, or no session handle
              cols.replaceChildren(  // fills the columns
                proc('Widget', st.widget, 'handle 0 → servicemanager<br>handle 1 → WeatherService'),  // Widget's card: handle 0 is the service manager, handle 1 WeatherService
                proc('Maps', st.maps, 'handle 0 → servicemanager<br>handles 1–4 → other services'),  // Maps's card: handle 0 is the service manager, handles 1 to 4 other services
                h('div', { class: 'card os tight stack', style: { gap: '6px' } }, h('b', {}, 'Binder driver (kernel)'),  // the driver's card, in operating-system purple
                  st.node ? h('div', { class: 'stack', style: { gap: '4px' } }, h('div', { class: 'small' }, 'node: ForecastSession, owned by the weather app'), h('div', { class: 'row gap-s' }, h('span', { class: 'big', style: { fontSize: '34px' } }, String(n)), h('span', { class: 'xs muted' }, 'remote references')),  // when the node exists: its description and the reference count in large digits
                    h('div', { class: 'xs' }, [st.widget != null ? 'Widget (handle 2)' : null, st.maps != null ? 'Maps (handle 5)' : null].filter(Boolean).join(' · ')))  // and which apps hold it, with their handle numbers
                    : h('div', { class: 'small muted' }, st.alive ? 'no node: the object is not shared' : 'process gone: its nodes were cleaned up')),  // otherwise: no node because nothing is shared, or the process is gone and its nodes were cleaned up
                h('div', { class: 'card tight stack ' + (st.alive ? 'proc' : 'intr'), style: { gap: '6px' } }, h('b', {}, WEATHER.name),  // the weather app's card, teal while alive and red after the crash
                  h('div', { class: 'small' }, st.alive ? (st.node ? 'ForecastSession object: alive, in use' : 'no shared session object') : 'process crashed')));  // its state: object alive and in use, no shared object, or crashed
              acts.replaceChildren(  // fills the action row; each button is greyed out when its action makes no sense
                h('button', { class: 'btn sm proc', type: 'button', disabled: !st.alive || st.node, onclick: () => act('open') }, 'Widget: openSession()'),  // openSession: only while the app is alive and no session exists
                h('button', { class: 'btn sm proc', type: 'button', disabled: st.widget == null || st.maps != null, onclick: () => act('pass') }, 'Widget passes it to Maps'),  // pass to Maps: only while the widget holds the session and Maps does not
                h('button', { class: 'btn sm', type: 'button', disabled: st.widget == null, onclick: () => act('dropW') }, 'Widget releases'),  // Widget releases: only while the widget holds a handle
                h('button', { class: 'btn sm', type: 'button', disabled: st.maps == null, onclick: () => act('dropM') }, 'Maps releases'),  // Maps releases: only while Maps holds a handle
                h('button', { class: 'btn sm intr', type: 'button', disabled: !st.alive, onclick: () => act('crash') }, 'Weather app crashes'),  // the crash button, in red, while the app is alive
                h('button', { class: 'btn sm', type: 'button', onclick: reset }, 'Reset'));  // the Reset button
            }  // ends draw()
            panel.append(h('div', { class: 'stack fill', style: { gap: '10px' } },  // puts the tab together in a full-height stack
              h('p', { class: 'm0', html: 'Parcels can carry <b>references to Binder objects</b>, not just numbers and strings. The driver translates each one into a per-process <span class="t">Binder handle</span> and <b>counts</b> how many processes hold one, so the owner learns when an object is no longer used anywhere.' }),  // intro paragraph: parcels can carry object references, which the driver translates into handles and counts
              acts, cols, narr, log));  // the buttons, columns, narration and log
            reset();  // starts from the reset state
          }  // ends refTab()
          el.append(ctx.ui.tabs([{ label: 'Who is calling? A permission check', render: permTab }, { label: 'Counted object references', render: refTab }]));  // the two tabs, built by ctx.ui.tabs; each tab's render function draws its panel when opened
        },  // ends render() for step 6
      },  // ends step 6

      /* ---------------- 7. Binder versus a pipe and shared memory; what is built on top ---------------- */
      {  // opens step 7
        title: 'Binder versus pipes and shared memory',  // step 7 title
        kind: 'compare',  // kind 'compare': a step that sets mechanisms side by side
        render(el, ctx) {  // render(el, ctx): builds three tabs: counting copies, a side-by-side table, and the tools built on Binder
          const { h, s } = ctx;  // takes the HTML builder h and the SVG builder s out of ctx
          const LIMIT_KB = 1016;   // a process's Binder receive buffer: 1 MB minus 8 KB
          /* ---- tab 1: count the copies ---- */
          function copyTab(panel) {  // copyTab(panel): draws the first tab: how many times the kernel copies one message
            let mech = 'binder', kb = 64;  // mech: the chosen mechanism; kb: the message size in KB
            const svg = s('svg', { viewBox: ctx.narrow ? '0 0 360 300' : '0 0 640 256', width: '100%' });  // svg: the drawing, taller on phone-width screens
            const res = h('div', { class: 'narr', style: { minHeight: '120px' } });  // res: the narration box that explains the result
            const bars = h('div', { class: 'stack', style: { gap: '6px' } });  // bars: the three meters that compare how much is copied
            const COPIES = { pipe: 2, binder: 1, shm: 0 };  // COPIES: how many times each mechanism copies the data
            const NAME = { pipe: 'Pipe', binder: 'Binder', shm: 'Shared memory' };  // NAME: the display name of each mechanism
            function draw() {  // draw(): redraws the drawing, the result text and the meters
              const W = ctx.narrow ? 360 : 640, k = [];  // W: the drawing's width; k: the shapes
              const tooBig = mech === 'binder' && kb > LIMIT_KB;  // tooBig: Binder with a message bigger than the receiver's whole buffer
              const S = ctx.narrow ? { x: 6, y: 30, w: 110, h: 90 } : { x: 6, y: 34, w: 170, h: 100 };  // S: the sender's box
              const R = ctx.narrow ? { x: 244, y: 30, w: 110, h: 90 } : { x: 464, y: 34, w: 170, h: 100 };  // R: the receiver's box
              const K = ctx.narrow ? { x: 6, y: 160, w: 348, h: 130 } : { x: 160, y: 160, w: 320, h: 90 };  // K: the kernel's box under the two processes (centred on wide screens, full width on phone-width ones)
              k.push(rbox(s, S, 's-proc'), label(s, S.x + S.w / 2, S.y - 10, 'sender', { size: 14, weight: 800 }));  // draws the sender with its label above
              k.push(rbox(s, R, 's-proc'), label(s, R.x + R.w / 2, R.y - 10, 'receiver', { size: 14, weight: 800 }));  // draws the receiver with its label above
              k.push(rbox(s, K, 's-os'), label(s, K.x + 10, K.y + K.h - 10, 'kernel', { anchor: 'start', size: 13, weight: 800, fill: 'var(--os)' }));  // draws the kernel with its label at the bottom left
              const buf = (r, txt, cls) => { k.push(rbox(s, r, cls, 2), label(s, r.x + r.w / 2, r.y + r.h / 2 + 5, txt, { size: 13, weight: 700 })); };  // buf(r, txt, cls): draws a labelled buffer box
              const sb = { x: S.x + 12, y: S.y + 34, w: S.w - 24, h: 40 }, rb = { x: R.x + 12, y: R.y + 34, w: R.w - 24, h: 40 };  // sb, rb: the buffer boxes inside the sender and the receiver
              const kb2 = { x: K.x + K.w / 2 - 70, y: K.y + 36, w: 140, h: 36 };  // kb2: the box in the middle of the kernel
              const arrow = (x1, y1, x2, y2, n, txt, side) => {  // arrow(x1, y1, x2, y2, n, txt, side): a numbered arrow with an optional label beside it (side -1 left, 1 right) or above it
                k.push(s('line', { x1, y1, x2, y2, class: 's-line', style: 'stroke:var(--accent)', 'stroke-width': 3, 'marker-end': 'url(#arr-accent)' }));  // the line, in the accent colour
                const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;  // mx, my: the arrow's midpoint
                k.push(s('circle', { cx: mx, cy: my, r: 12, class: 's-accent', 'stroke-width': 2 }), label(s, mx, my + 5, String(n), { size: 13, weight: 800 }));  // a numbered circle at the midpoint
                if (txt && side) k.push(label(s, mx + side * 18, my + 5, txt, { size: 13, cls: 's-sub', anchor: side < 0 ? 'end' : 'start' }));  // the label beside the arrow
                else if (txt) k.push(label(s, mx, my - 18, txt, { size: 13, cls: 's-sub' }));  // or above it when no side is given
              };  // ends arrow()
              if (mech === 'pipe') {  // the pipe picture
                buf(sb, 'data', 's-mem'); buf(rb, 'copy', 's-mem'); buf(kb2, 'pipe buffer', 's-mem');  // the sender's data, the receiver's copy, and the pipe buffer inside the kernel
                arrow(sb.x + sb.w / 2, sb.y + sb.h, kb2.x + 10, kb2.y, 1, 'write()', 1);  // copy 1: write() copies the data into the kernel's buffer
                arrow(kb2.x + kb2.w - 10, kb2.y, rb.x + rb.w / 2, rb.y + rb.h, 2, 'read()', -1);  // copy 2: read() copies it out again to the receiver
              } else if (mech === 'binder') {  // the Binder picture
                buf(sb, 'parcel', 's-mem'); buf(rb, 'mapped buffer', tooBig ? 's-bad' : 's-mem'); buf(kb2, 'Binder driver', 's-accent');  // the sender's parcel, the receiver's mapped buffer (red when the message is too big) and the driver
                if (!tooBig) arrow(sb.x + sb.w, sb.y + sb.h / 2, rb.x, rb.y + rb.h / 2, 1, ctx.narrow ? null : 'driver copies once');  // if it fits: one arrow straight from sender to receiver, labelled "driver copies once" on wide screens
                else k.push(label(s, W / 2, S.y + 60, '✗ too large', { size: 15, weight: 800, fill: 'var(--bad)' }));  // if too big: a red "too large" in the middle instead
                k.push(s('line', { x1: kb2.x + kb2.w / 2, y1: kb2.y, x2: kb2.x + kb2.w / 2, y2: sb.y + sb.h / 2 + 8, class: 's-muted', 'stroke-dasharray': '4 4' }));  // a dashed line from the driver up toward the arrow, since the driver does the copying
              } else {  // the shared memory picture
                const sh = ctx.narrow ? { x: 100, y: 128, w: 160, h: 26 } : { x: 220, y: 60, w: 200, h: 44 };  // sh: the box for the shared pages, between the two processes
                buf(sb, 'mapping', 's-panel'); buf(rb, 'mapping', 's-panel'); buf(sh, 'shared pages', 's-mem');  // both processes' mappings and the shared pages they both see
                k.push(s('line', { x1: sb.x + sb.w, y1: sb.y + sb.h / 2, x2: sh.x, y2: sh.y + sh.h / 2, class: 's-muted', 'stroke-dasharray': '5 4' }));  // dashed line from the sender's mapping to the shared pages
                k.push(s('line', { x1: rb.x, y1: rb.y + rb.h / 2, x2: sh.x + sh.w, y2: sh.y + sh.h / 2, class: 's-muted', 'stroke-dasharray': '5 4' }));  // dashed line from the receiver's mapping to the shared pages
                k.push(label(s, K.x + K.w / 2, kb2.y + 22, 'only sets up the mapping', { size: 13, cls: 's-sub' }));  // a label in the kernel: it only sets up the mapping
              }  // ends the choice of picture
              svg.replaceChildren(...k);  // replaces the drawing's contents with the new shapes
              const n = COPIES[mech];  // n: the copies this mechanism makes
              if (tooBig) res.innerHTML = `<b style="color:var(--bad)">Refused.</b> ${kb} KB is more than the receiver's whole Binder buffer: 1 MB minus 8 KB (${LIMIT_KB} KB), shared by every call in progress to that process; a one-way call may use only half. The call fails with TransactionTooLargeException. Big data goes in <b>shared memory</b>, and only its file descriptor travels through Binder.`;  // too big: the call is refused with TransactionTooLargeException; big data goes in shared memory instead
              else if (mech === 'pipe') res.innerHTML = `<b>2 copies: ${2 * kb} KB copied</b> for a ${kb} KB message. write() copies the bytes into a buffer inside the kernel; read() copies them out again.${kb > 64 ? ' (A Linux pipe holds 64 KB by default, so this message passes through in pieces while the writer waits; the total copied is the same.)' : ''} The reader gets bytes only: no method, no reply, no idea who wrote them.`;  // pipe: 2 copies and the total copied, a note on the 64 KB pipe buffer for big messages, and no method or sender
              else if (mech === 'binder') res.innerHTML = `<b>1 copy: ${kb} KB copied.</b> The receiver's buffer is memory the driver has mapped into the receiver, so the driver copies the parcel from the sender <b>straight into it</b>, and the receiver reads it where it lands. Half the copying of a pipe, plus a method code, a reply and the sender's identity.${kb > LIMIT_KB / 2 ? ` <b>Only just:</b> all calls in progress share this ${LIMIT_KB} KB buffer and a one-way call may use only half (${LIMIT_KB / 2} KB), so real apps keep each call far smaller.` : ''}`;  // Binder: 1 copy straight into the mapped buffer, plus a warning once the message passes half the buffer
              else res.innerHTML = `<b>0 copies.</b> Both processes map the same physical pages, so data written by one is instantly visible to the other, whatever the size (${kb} KB here). But nothing tells the receiver that data is ready, nothing stops both writing at once, and nothing says who wrote it: those need extra tools, such as a semaphore, or a Binder call.`;  // shared memory: no copies, but no notice, no protection against both writing, and no sender identity
              bars.replaceChildren(...['pipe', 'binder', 'shm'].map((m) => {  // bars: one meter row per mechanism
                const bytes = COPIES[m] * kb, max = 2 * kb;  // bytes: KB copied by that mechanism; max: twice the size, what a pipe copies, which fills the meter
                return h('div', { class: 'row nw', style: { gap: '8px' } }, h('span', { class: 'small b', style: { width: '120px', flex: 'none' } }, NAME[m]),  // the row: the mechanism's name
                  h('div', { class: 'meter grow' }, h('i', { style: { width: (m === 'binder' && kb > LIMIT_KB ? 0 : (bytes / max) * 100) + '%' } })),  // a meter filled in proportion to what it copies (empty for Binder when the message is too big)
                  h('span', { class: 'small num', style: { width: '120px', flex: 'none', textAlign: 'right' } }, m === 'binder' && kb > LIMIT_KB ? 'too large' : `${COPIES[m]} × = ${bytes} KB`));  // the number at the right, such as "2 × = 128 KB", or "too large"
              }));  // ends the meter rows
            }  // ends draw()
            const seg = ctx.ui.seg([{ value: 'pipe', label: 'Pipe' }, { value: 'binder', label: 'Binder' }, { value: 'shm', label: 'Shared memory' }], mech, (v) => { mech = v; draw(); });  // seg: the Pipe / Binder / Shared memory switch
            const sl = ctx.ui.slider({ label: 'Message size', min: 4, max: 2048, step: 4, value: kb, format: (v) => v + ' KB', onInput: (v) => { kb = v; draw(); } });  // sl: the message size slider, 4 to 2048 KB in steps of 4
            panel.append(h('div', { class: 'split fill', style: { gridTemplateColumns: ctx.narrow ? null : 'minmax(0, 7fr) minmax(0, 5fr)' } },  // puts the tab together: two columns, 7 parts to 5 on wide screens
              h('div', { class: 'stack', style: { gap: '10px' } }, h('div', { class: 'row' }, seg), sl, h('div', { class: 'card white tight' }, svg),  // left column: the switch, the slider and the drawing on a white card
                h('div', { class: 'callout why small m0', 'data-label': 'How can Binder copy only once?' }, 'When a process opens the Binder driver, it maps a receive buffer: pages that belong to the kernel and also appear, read-only, in that process. The driver copies an incoming parcel into those pages once, and the receiver reads it there.')),  // callout: how Binder can copy only once, through a receive buffer that also appears read-only in the process
              h('div', { class: 'stack', style: { gap: '10px' } }, res, h('div', { class: 'card tight stack', style: { gap: '8px' } }, h('b', { class: 'small' }, 'Data the kernel copies for one message'), bars),  // right column: the narration and a card with the meters
                h('div', { class: 'callout tip small m0', 'data-label': 'In real Android' }, 'The tools work together: a big buffer, such as a camera frame, lives in shared memory, and Binder carries the small calls plus the file descriptor that names that memory.'))));  // tip callout: in real Android the tools work together, big data in shared memory and small calls through Binder
            draw();  // first draw
          }  // ends copyTab()
          /* ---- tab 2: the side-by-side table, one row at a time ---- */
          function tableTab(panel) {  // tableTab(panel): draws the second tab, a comparison table with a reason for each row
            const ROWS = [  // ROWS: each row as [property, pipe, shared memory, Binder, reason]
              ['Kernel copies per message', '2', '0', '1', 'A pipe copies in and out of a kernel buffer. Shared memory needs no copy at all. Binder copies once, straight into the receiver\'s mapped buffer.'],  // row: kernel copies per message
              ['What crosses over', 'a one-way stream of bytes', 'nothing: both see the same memory', 'a typed method call and its reply', 'Only Binder knows about methods and replies. The others move raw bytes; the programs must agree on their meaning themselves.'],  // row: what crosses over between the processes
              ['Who sent it?', 'unknown', 'unknown', 'UID and PID, stamped by the kernel', 'Binder\'s stamp is what lets services check permissions without trusting the caller.'],  // row: whether the receiver knows who sent it
              ['Waiting', 'reader blocks until bytes arrive', 'nothing built in: add semaphores', 'caller blocks for the reply (unless one-way)', 'Shared memory is fast but leaves all synchronization to you, which is exactly where race conditions creep in.'],  // row: what waiting is built in
              ['Finding the other side', 'inherited from the parent, or a named pipe', 'both map the same region', 'by name in the service manager, or by binding', 'System services are looked up by name in the service manager, and bindService() asks the system to connect an app to another app\'s service, so unrelated apps can find each other.'],  // row: how each side finds the other
              ['Object references', 'no', 'no', 'counted, with death notices', 'Only Binder can hand a reference to a live object to another process and tell the holders if its owner dies.'],  // row: whether object references can be passed
              ['Best for', 'streams of bytes', 'large data: images, video frames', 'calls to services and other apps', 'They work together: big buffers live in shared memory while Binder carries the small control calls and the descriptor of the shared region.'],  // row: what each mechanism is best for
            ];  // closes ROWS
            let pick = 0;  // pick: the row now selected
            const tbl = h('table', { class: 'tbl compact' });  // tbl: the table
            const note = h('div', { class: 'narr', style: { minHeight: '60px' } });  // note: the narration box with the selected row's reason
            function draw() {  // draw(): rebuilds the table and the note
              tbl.replaceChildren(h('tr', {}, h('th', {}, ''), h('th', {}, 'Pipe'), h('th', {}, 'Shared memory'), h('th', {}, 'Binder')),  // header row: an empty corner, then the three mechanisms
                ...ROWS.map((r, i) => h('tr', { class: i === pick ? 'on' : '' },  // one row per ROWS entry, highlighted when selected
                  h('td', {}, h('button', { class: 'btn sm ghost', type: 'button', style: { padding: '0 4px', fontWeight: 800 }, onclick: () => { pick = i; draw(); } }, r[0])),  // the first cell is the property as a quiet button; a click selects that row
                  h('td', {}, r[1]), h('td', {}, r[2]), h('td', { class: 'b' }, r[3]))));  // the pipe, shared memory and Binder cells, Binder in bold
              note.innerHTML = `<b>${ROWS[pick][0]}.</b> ${ROWS[pick][4]}`;  // the selected row's property and reason in the note box
            }  // ends draw()
            panel.append(h('div', { class: 'stack fill', style: { gap: '10px' } }, h('p', { class: 'small muted m0' }, 'Click a row heading for the reason behind it.'), tbl, note));  // puts the tab together: a hint, the table and the note
            draw();  // first draw
          }  // ends tableTab()
          /* ---- tab 3: classify everyday requests by the Binder-based tool they use ---- */
          function toolTab(panel) {  // toolTab(panel): draws the third tab, sorting everyday requests by the tool they use
            const TOOLS = ['Intent', 'Content provider', 'Bound service'];  // TOOLS: the three Binder-based tools to choose from
            const CASES = [  // CASES: each as [request, the right tool's position in TOOLS, the reason]
              ['Your app asks the system to open a web page in whatever browser the user prefers.', 0, 'An implicit intent: it travels through Binder to the activity manager in system_server, which picks a browser and starts it.'],  // case 1: opening a web page in the preferred browser, an intent
              ['A messaging app reads the phone\'s list of contacts.', 1, 'The contacts provider answers queries. The query goes over Binder; a large result comes back in shared memory.'],  // case 2: reading the contacts list, a content provider
              ['A music app\'s screen keeps calling play(), pause() and getPosition() on its playback service while it is open.', 2, 'It binds once and then makes direct Binder calls through the service\'s interface, usually written in AIDL.'],  // case 3: playback controls on a music service, a bound service
              ['The system tells every app that registered for it that the battery is low.', 0, 'A broadcast intent: one message delivered, through Binder, to every registered receiver.'],  // case 4: the battery-low announcement, a broadcast intent
              ['A fitness app lets other apps query its table of daily step counts, if they hold its permission.', 1, 'Sharing a table of data with permission checks is exactly what a content provider is for.'],  // case 5: sharing a table of step counts with permission checks, a content provider
              ['A keyboard calls a spell-checking service in another app again and again as you type.', 2, 'Many repeated calls to one service: bind once, then call its interface directly.'],  // case 6: a keyboard calling a spell checker again and again, a bound service
            ];  // closes CASES
            const score = h('span', { class: 'chip accent' });  // score: the chip that shows how many answers are right
            const ans = CASES.map(() => null);  // ans: the student's choice for each case, null until answered
            let last = null;  // last: the case answered most recently, whose reason is shown
            /* one shared explanation for the latest answer, so six answered rows still fit the canvas */
            const said = h('div', { class: 'narr', style: { minHeight: '52px', fontSize: '15px' } }, 'Pick a tool for each request; the reason appears here.');  // said: one explanation box for the latest answer, starting with a hint
            const marks = CASES.map(() => h('span', { class: 'chip xs', style: { visibility: 'hidden', flex: 'none' } }, '✓'));  // marks: a ✓ or ✗ chip for each case, kept hidden (but holding its space) until answered
            /* rows are built once, so a keyboard user keeps focus inside a switch after answering */
            const rows = h('div', { class: 'stack', style: { gap: '6px' } }, ...CASES.map(([txt], i) => h('div', { class: 'card tight', style: { padding: '6px 10px' } },  // rows: one card per case: the numbered request, its mark and a three-way switch
              h('div', { class: 'row' + (ctx.narrow ? '' : ' nw'), style: { justifyContent: 'space-between', gap: '10px' } }, h('span', { class: 'small', style: { flex: 1, minWidth: '180px' } }, `${i + 1}. ${txt}`),  // the row's layout: the request text at the left, wrapping onto two lines on phone-width screens
                marks[i], ctx.ui.seg(TOOLS.map((t, k) => ({ value: k, label: t })), null, (v) => { ans[i] = v; last = i; draw(); })))));  // the mark, then a switch with no starting choice; a pick records the answer, remembers it as the latest and redraws
            function draw() {  // draw(): updates the score, the marks and the explanation
              const right = ans.filter((a, i) => a === CASES[i][1]).length;  // right: how many answers match the right tool
              score.textContent = `${right} / ${CASES.length} right`;  // the score text, such as "3 / 6 right"
              marks.forEach((mk, i) => { const ok = ans[i] === CASES[i][1]; mk.style.visibility = ans[i] == null ? 'hidden' : ''; mk.className = 'chip xs ' + (ok ? 'ok' : 'bad'); mk.textContent = ok ? '✓' : '✗'; });  // each mark: hidden until answered, then a green ✓ or a red ✗
              if (last == null) return;  // nothing answered yet: keeps the starting hint
              const [, ok, why] = CASES[last], good = ans[last] === ok;  // the latest case's right tool and reason, and whether the student matched it
              said.className = 'narr ' + (good ? 'ok' : 'bad');  // tints the box green or red
              said.innerHTML = `<b>Request ${last + 1}: ${good ? '✓ right.' : '✗ it is a ' + TOOLS[ok].toLowerCase() + '.'}</b> ${why}`;  // says right, or names the right tool, then gives the reason
            }  // ends draw()
            panel.append(h('div', { class: 'stack fill', style: { gap: '8px' } },  // puts the tab together in a full-height stack
              h('div', { class: 'row', style: { justifyContent: 'space-between' } },  // a top row with the intro and the score chip
                h('p', { class: 'm0 small', html: 'Apps rarely call the Binder driver themselves. They use higher-level tools that all travel over Binder: <span class="t">intents</span>, <span class="t">content providers</span> and <span class="t">bound services</span>. Which tool fits each request?' }), score),  // intro: apps use intents, content providers and bound services, which all travel over Binder
              rows, said));  // the case rows, then the explanation box
            draw();  // first draw
          }  // ends toolTab()
          el.append(ctx.ui.tabs([{ label: 'How many copies?', render: copyTab }, { label: 'Side by side', render: tableTab }, { label: 'Built on Binder', render: toolTab }]));  // the three tabs of step 7, built by ctx.ui.tabs
        },  // ends render() for step 7
      },  // ends step 7

      /* ---------------- 8. Recap ---------------- */
      {  // opens step 8
        title: 'Recap: eight things to remember about Binder',  // step 8 title
        kind: 'recap',  // kind 'recap': the summary step
        render(el, ctx) {  // render(el, ctx): builds a grid of recap flip cards
          el.append(ctx.h('div', { class: 'stack fill', style: { gap: '12px' } },  // a full-height stack
            ctx.h('p', { class: 'lead m0' }, 'Say each answer out loud before you flip the card.'),  // lead line: say each answer out loud before flipping
            ctx.ui.flipcards([  // ctx.ui.flipcards: cards that turn over on a click to show the answer on the back
              ['Why can\'t one app just read another app\'s memory?', 'Each app is its own process, with its own address space and Linux UID: the sandbox. Only the kernel reaches every process, so every request between processes goes through it; on Android, through Binder.'],  // card 1: why one app cannot read another app's memory
              ['What is a remote procedure call?', 'A call written exactly like a local call, but the procedure runs in another process. The arguments and the result travel between the two as messages.'],  // card 2: what a remote procedure call is
              ['Name the cast of one Binder call, in order.', 'Proxy (client stand-in) → parcel (flat data) → Binder driver (kernel) → Binder thread (server pool) → stub (unpacks, calls) → service (real work). The reply goes back the same way.'],  // card 3: the cast of one Binder call, in order
              ['Marshalling, unmarshalling and AIDL?', 'Marshalling packs values into a parcel in an agreed order; unmarshalling reads them back in that order. AIDL generates proxy and stub from one file, so both sides agree.'],  // card 4: marshalling, unmarshalling and AIDL
              ['Two-way versus one-way calls?', 'Two-way: the calling thread blocks until the reply arrives. One-way (oneway): the caller carries on at once and gets no reply, not even an exception the method throws.'],  // card 5: two-way versus one-way calls
              ['What does the Binder driver add?', 'One copy, straight into the receiver\'s mapped buffer; the sender\'s UID and PID, which cannot be forged; counted object references with death notices.'],  // card 6: the three things the driver adds
              ['Who runs an incoming call, and what if they are all busy?', 'A thread from the server\'s Binder thread pool. If every thread is busy, the call waits in line in the driver (the pool can grow up to a limit).'],  // card 7: who runs an incoming call, and what happens when every thread is busy
              ['How do apps find services, and what is built on Binder?', 'The service manager (always handle 0) maps names to system services; an app\'s service is reached with bindService(). Intents, content providers and bound services all travel over Binder.'],  // card 8: how apps find services, and what is built on Binder
            ], { cols: ctx.narrow ? 1 : 4, height: 222 })));  // four columns on wide screens and one on phone-width ones; each card 222 pixels tall
        },  // ends render() for step 8
      },  // ends step 8

      /* ---------------- 9. Quiz ---------------- */
      {  // opens step 9
        title: 'Check yourself: Android IPC',  // step 9 title
        kind: 'check',  // kind 'check': the end-of-section quiz
        quiz: [  // quiz: the questions; the guide's quiz engine draws, checks and scores them
          { q: 'Why must two Android apps communicate through the kernel instead of reading each other\'s data directly?',  // question 1 (multiple choice): why two apps must communicate through the kernel
            choices: ['Apps are written in Java or Kotlin, and those languages have no pointers that could reach another app\'s memory.', 'Android forbids apps from opening any files at all, so every piece of data must be sent through the kernel instead.', 'Each app runs in its own process, with its own address space and Linux user ID, so neither can reach the other\'s memory.', 'All apps share one large address space, and the kernel must check every access so that they do not collide.'],  // choices: no pointers, no files allowed, separate processes and UIDs (right), one shared address space
            answer: 2,  // answer: 2, the third choice (choices are counted from 0)
            feedback: ['The language is not the reason: native code has pointers, yet it still cannot reach memory that is not mapped into its own process.', 'Apps open their own files all the time. The sandbox only stops an app from opening files that belong to another app\'s UID.', null, 'It is the reverse: every app has its own separate address space. That separation is the sandbox.'],  // feedback for each wrong choice; null marks the right one, which needs none
            why: 'The application sandbox gives every app its own process and UID. Only the kernel can see into every process, so any data that crosses from one to another must pass through it; on Android that is normally Binder.' },  // why: the explanation shown after answering
          { type: 'order', q: 'Put the stages of a two-way Binder call in order.',  // question 2 (put in order): the stages of a two-way Binder call
            items: ['The client calls a method on the proxy', 'The proxy marshals the arguments into a parcel', 'The proxy hands the transaction to the Binder driver and the calling thread blocks', 'The driver copies the data into the server and records the caller\'s UID and PID', 'A Binder thread in the server receives it and the stub unmarshals the arguments', 'The stub calls the real method on the service', 'The reply travels back the same way and the proxy returns the result'],  // the seven stages, written in the right order (the quiz engine shuffles them for the student)
            why: 'Pack on the client side, cross the kernel once, unpack on the server side, run the method, and retrace the path with the reply while the caller waits.' },  // why: pack, cross the kernel, unpack, run, and return the same way
          { type: 'match', q: 'Match each part of Binder to its job.',  // question 3 (match the pairs): each part of Binder to its job
            pairs: [['Proxy', 'Client-side stand-in that packs the arguments'], ['Stub', 'Server-side code that unpacks the arguments and calls the real method'], ['Binder driver', 'Kernel code that carries transactions and stamps the sender'], ['Service manager', 'Registry where services are looked up by name'], ['AIDL', 'Interface language from which proxy and stub are generated']],  // pairs: proxy, stub, driver, service manager and AIDL with their jobs
            why: 'Proxy and stub are the two generated halves of one interface (from AIDL); the driver in the kernel joins them; the service manager is how a client finds a service in the first place.' },  // why: how the five parts fit together
          { type: 'tf', q: 'In a one-way (oneway) Binder call, the calling thread blocks until the server has finished running the method.', answer: false,  // question 4 (true or false): a one-way caller waits for the method to finish; the answer is false
            why: 'A one-way call returns as soon as the driver has accepted the transaction. The caller never waits for, or receives, a reply.' },  // why: a one-way call returns as soon as the driver accepts it
          { type: 'num', q: 'A proxy writes the string "Denver" into a parcel: a 4-byte length, then 2 bytes per character, then a 2-byte terminator, with the total padded up to a multiple of 4 bytes. How many bytes does the string take?', answer: 20, tol: 0, unit: 'bytes',  // question 5 (calculate): bytes the string "Denver" takes in a parcel; answer 20 bytes, tolerance 0 (must be exact)
            why: '4 (length) + 6 × 2 (characters) + 2 (terminator) = 18 bytes, padded up to the next multiple of 4: 20 bytes.' },  // why: the sum and the rounding up to a multiple of 4
          { type: 'num', q: 'An app sends a 300 KB message to another process through a pipe. In total, how many KB of data does the kernel copy?', answer: 600, tol: 0, unit: 'KB',  // question 6 (calculate): KB the kernel copies for 300 KB through a pipe; answer 600
            why: 'A pipe copies twice: write() copies 300 KB into the kernel\'s buffer and read() copies 300 KB out again, 600 KB in all. Binder would copy the 300 KB once.' },  // why: a pipe copies in and then out
          { type: 'num', q: 'A service has 2 Binder threads. Four calls arrive at the same moment; each needs 30 ms of work, and waiting calls are served first come, first served. How many milliseconds after they arrive is the last reply sent?', answer: 60, tol: 0, unit: 'ms',  // question 7 (calculate): when the last of four 30 ms calls on 2 threads gets its reply; answer 60 ms
            why: 'Two calls run at once from 0 to 30 ms; the other two wait in the driver and then run from 30 to 60 ms. The last reply goes out at 60 ms.' },  // why: two calls run, two wait, then those two run
          { type: 'multi', q: 'Which of these does the Binder driver do? Select all that apply.',  // question 8 (select all that apply): what the Binder driver does
            choices: ['Copies a parcel once, straight into a buffer mapped into the receiving process', 'Stamps each transaction with the caller\'s UID, which the caller cannot forge', 'Counts references to Binder objects that are shared between processes', 'Encrypts every parcel', 'Decides the order in which arguments are written into the parcel'],  // choices: copies once, stamps the UID, counts references, and two wrong ones, encryption and argument order
            answer: [0, 1, 2],  // answer: the first three choices
            why: 'The driver copies once, stamps the sender\'s identity, and tracks object references (and death notices). It does not encrypt, and the argument order is fixed by the interface, in the generated proxy and stub code.' },  // why: what the driver does and does not do
          { q: 'A location service must decide whether the app calling it may see the user\'s position. What should it trust to identify the caller?',  // question 9 (multiple choice): what a location service should trust to identify its caller
            choices: ['A "my UID" field that the caller wrote into the parcel', 'Binder.getCallingUid(), which the driver filled in', 'The interface token at the start of the parcel', 'The method code of the transaction'],  // choices: a UID field in the parcel, getCallingUid() (right), the interface token, the method code
            answer: 1,  // answer: 1, the second choice
            feedback: ['Anything in the parcel was written by the caller, so a malicious app could write any UID it likes.', null, 'The token only names the interface the caller meant to use; every caller of that interface sends the same token.', 'The method code says which method is wanted, not who is asking.'],  // feedback: why the parcel field, token and method code cannot identify the caller
            why: 'Only the kernel-written stamp is trustworthy, because the caller cannot change it. Android permission checks are built on the calling UID and PID.' },  // why: only the kernel-written stamp cannot be changed by the caller
          { type: 'bucket', q: 'Sort each property into the mechanism it describes.',  // question 10 (sort into groups): properties of a pipe, shared memory and Binder
            buckets: ['Pipe', 'Shared memory', 'Binder'],  // the three groups
            items: [['A one-way stream of bytes, copied into and out of the kernel', 0], ['The reader is never told who wrote the bytes', 0], ['No copying at all, but you must add your own synchronization', 1], ['Best for large data such as video frames', 1], ['Typed method calls with a reply', 2], ['The caller\'s identity is stamped by the kernel', 2]],  // six properties, each with the number of its group
            why: 'Pipes move raw byte streams with two copies and no sender identity; shared memory skips copying but gives no calls, no waiting and no identity; Binder adds typed calls, replies, one copy and a trustworthy identity.' },  // why: a one-line summary of each mechanism
          { q: 'One side of a Binder interface was rebuilt from an AIDL file whose parameters were put in a different order; the other side was not. What happens when a call is made?',  // question 11 (multiple choice): one side rebuilt from a reordered AIDL file
            choices: ['The driver notices the mismatch and reorders the fields before delivering the parcel.', 'The stub matches fields by name, so nothing goes wrong and every value arrives correctly.', 'The interface token check always rejects the call, so the stub never reads any fields.', 'Values are misread, or a read fails, because a parcel stores fields by position, not by name.'],  // choices: driver reorders, stub matches by name, token check rejects, values misread (right)
            answer: 3,  // answer: 3, the fourth choice
            feedback: ['The driver copies bytes without understanding them; it never looks inside a parcel\'s ordinary data.', 'A parcel carries no field names at all, only values one after another.', 'The token names the interface, which is still the same, so the check passes and the misreading happens anyway.', null],  // feedback: why the driver, field names and token cannot catch the mismatch
            why: 'Proxy and stub must be generated from the same interface definition. Change the order on one side only and every later field is read as the wrong thing, sometimes silently.' },  // why: both halves must come from the same interface definition
          { type: 'match', q: 'Match each request to the Binder-based tool it normally uses.',  // question 12 (match the pairs): everyday requests to the Binder-based tool each uses
            pairs: [['Open a web page in whatever browser the user prefers', 'Intent'], ['Read the phone\'s list of contacts', 'Content provider'], ['Keep calling play() and pause() on a music app\'s playback service', 'Bound service']],  // pairs: open a web page with an intent, read contacts with a content provider, control playback with a bound service
            why: 'An intent asks the system to start something or announces an event; a content provider shares a set of data with permission checks; a bound service is called directly, again and again, through its Binder interface.' },  // why: what each of the three tools is for
        ],  // closes the quiz list
      },  // ends step 9
    ],  // closes the steps list
    notes: `${/* notes: the section's notes as HTML text, shown in the Notes panel and the printable guide */''}
<h3>Why Android needs interprocess communication</h3>${/* notes heading for part 1: why Android needs interprocess communication */''}
<p>Every Android app normally runs in its <b>own process</b> under its <b>own Linux user ID (UID)</b>. This is the application sandbox: the kernel gives each process a separate address space and checks every file access against the UID, so one app cannot read another app's memory or files. So any request from one process to another must travel <b>through the kernel</b>.</p>${/* notes paragraph: the sandbox (own process, own UID) forces every request between apps through the kernel */''}
<p>Linux already offers IPC tools: <b>pipes</b> (one-way byte streams), <b>shared memory</b> (one region mapped into several processes), <b>sockets</b> (two-way connections, even across machines) and <b>signals</b> (tiny event notices that carry no message). Android adds <b>Binder</b>: a lightweight <b>remote procedure call</b> mechanism that is efficient in memory and processing time, which suits the limited resources of a phone. <b>All interaction between app components in different processes goes through Binder.</b></p>${/* notes paragraph: the Linux IPC tools in one line each, and why Android adds Binder */''}

<h3>Remote procedure call (RPC)</h3>${/* notes heading for part 2: remote procedure calls */''}
<p>A remote procedure call is written exactly like an ordinary call, but the procedure runs in <b>another process</b>; the arguments and the result travel between the two as messages. A local call takes nanoseconds and never involves the kernel; a Binder call crosses the kernel both ways, typically tens of microseconds, so apps avoid many tiny remote calls.</p>${/* notes paragraph: what an RPC is, and its cost compared with a local call */''}

<h3>The cast of characters</h3>${/* notes heading for part 3: the cast of characters */''}
<table>${/* opens the table of the parts of a Binder call */''}
<tr><th>Part</th><th>Where</th><th>Job</th></tr>${/* table header row: part, where it lives, its job */''}
<tr><td>Proxy</td><td>client</td><td>Stand-in with the remote object's methods; marshals, sends, waits, unmarshals the reply.</td></tr>${/* table row: the proxy, in the client */''}
<tr><td>Parcel</td><td>travels</td><td>Flat container of plain values (no pointers).</td></tr>${/* table row: the parcel, which travels between processes */''}
<tr><td>Binder driver</td><td>kernel</td><td>Carries transactions, copies once, stamps UID and PID, tracks references.</td></tr>${/* table row: the Binder driver, in the kernel */''}
<tr><td>Binder thread pool</td><td>server</td><td>Threads waiting in the driver; each call goes to one free thread.</td></tr>${/* table row: the Binder thread pool, in the server */''}
<tr><td>Stub</td><td>server</td><td>Unmarshals the arguments, calls the real method, marshals the result.</td></tr>${/* table row: the stub, in the server */''}
<tr><td>Service object</td><td>server</td><td>Does the real work; never sees a parcel.</td></tr>${/* table row: the service object, in the server */''}
<tr><td>Service manager</td><td>own process</td><td>Registry of named system services, reached through handle 0.</td></tr>${/* table row: the service manager, in its own process */''}
<tr><td>AIDL file</td><td>build time</td><td>Declares the interface; proxy and stub are generated from it.</td></tr>${/* table row: the AIDL file, used at build time */''}
</table>${/* closes the cast table */''}

<h3>One Binder transaction, step by step</h3>${/* notes heading for part 4: one transaction, step by step */''}
<ol>${/* opens the numbered list of stages */''}
<li>(Once) The client finds the service (by name in the service manager for a system service, with bindService() for an app's) and gets a <b>handle</b>, wrapped in a proxy.</li>${/* stage 1: finding the service once and getting a handle wrapped in a proxy */''}
<li>The client calls a method on the <b>proxy</b>, as if it were local.</li>${/* stage 2: calling a method on the proxy */''}
<li>The proxy <b>marshals</b> the arguments into a <b>parcel</b>: an interface token first, then each argument.</li>${/* stage 3: marshalling the arguments into a parcel, interface token first */''}
<li>The proxy calls transact(method code, parcel, flags) and enters the <b>Binder driver</b>; for a two-way call the calling thread now <b>blocks</b>.</li>${/* stage 4: transact() enters the driver and a two-way caller blocks */''}
<li>The driver turns the handle into the target object, records the sender's UID and PID, and copies the parcel <b>once</b> into the server's mapped receive buffer.</li>${/* stage 5: the driver finds the target, records the sender and copies once */''}
<li>A thread from the server's <b>Binder thread pool</b> wakes up with the transaction; the <b>stub</b> checks the token and <b>unmarshals</b> the arguments in the same order.</li>${/* stage 6: a Binder thread wakes and the stub unmarshals in the same order */''}
<li>The stub calls the real method on the service object.</li>${/* stage 7: the stub calls the real method */''}
<li>The stub marshals a reply (status 0 = no exception, then the result); the driver copies it to the client and wakes the caller; the proxy unmarshals it and returns.</li>${/* stage 8: the reply travels back and the proxy returns the result */''}
</ol>${/* closes the list of stages */''}
<p><b>One-way calls</b> (declared <code>oneway</code> in AIDL, sent with FLAG_ONEWAY): the caller continues as soon as the driver accepts the transaction. There is no reply, so the caller never learns whether the method worked. One-way calls to the same object are delivered one at a time, in order.</p>${/* notes paragraph: one-way calls, which get no reply and arrive in order */''}
<p><b>Worked example.</b> getTemp("Tampa"): token "IWeather" = 24 bytes, string "Tampa" = 16 bytes, request = 40 bytes; reply = status 4 bytes + int 4 bytes = 8 bytes.</p>${/* notes paragraph: the worked byte count for getTemp("Tampa"), 40 bytes out and 8 back */''}

<h3>Marshalling and unmarshalling</h3>${/* notes heading for part 5: marshalling and unmarshalling */''}
<ul>${/* opens the list of encodings */''}
<li><b>int</b>: 4 bytes, least significant byte first (little-endian). 32 → 20 00 00 00.</li>${/* encoding of an int: 4 bytes, low byte first */''}
<li><b>boolean</b>: stored as a whole 4-byte int, 1 or 0.</li>${/* encoding of a boolean: a whole 4-byte int */''}
<li><b>String</b>: a 4-byte length (in characters), 2 bytes per UTF-16 character, a 2-byte zero terminator, padded to a multiple of 4. Bytes = 4 + round-up-to-4(2 × (n + 1)). Example: "Denver" (n = 6): 4 + 14 → 4 + 16 = <b>20 bytes</b>.</li>${/* encoding of a String, with the size formula and the "Denver" example */''}
</ul>${/* closes the list of encodings */''}
<p>A parcel stores values by <b>position, not by name</b>. The stub must read exactly the types, in exactly the order, the proxy wrote. If one side is rebuilt from an AIDL file whose parameters were reordered and the other is not, values are silently misread or a read fails. Generating both halves from one AIDL file prevents this.</p>${/* notes paragraph: fields are stored by position, so proxy and stub must come from the same AIDL file */''}

<h3>The Binder thread pool</h3>${/* notes heading for part 6: the Binder thread pool */''}
<p>Incoming calls run on the server's Binder threads, not its main thread. When all are busy the driver asks the process to start another, by default up to 15 more beside the first (16 in all for an app); beyond that, calls wait in the driver's queue, first in, first out, and their callers stay blocked. Example: 2 threads, 4 calls arriving together, 30 ms each: two run 0–30 ms, two run 30–60 ms, so the last reply leaves at 60 ms. A blocked main thread freezes the screen (after about 5 s without responding to input, Android offers to close the app), so slow calls belong on background threads.</p>${/* notes paragraph: how the pool grows, the queue when it is full, a worked timing example, and the frozen-screen risk */''}

<h3>What the Binder driver adds</h3>${/* notes heading for part 7: what the Binder driver adds */''}
<ul>${/* opens the list of the driver's additions */''}
<li><b>One copy.</b> The driver copies a parcel straight into a receive buffer the receiver has mapped. It holds 1 MB minus 8 KB, shared by all calls in progress (a one-way call may use only half); bigger transactions fail (TransactionTooLargeException), so large data goes in shared memory and only its file descriptor travels through Binder.</li>${/* addition 1: one copy into a limited receive buffer, and what happens to transactions that are too large */''}
<li><b>Caller identity.</b> The driver records the sender's UID (and PID, for two-way calls); the service reads them with Binder.getCallingUid() and getCallingPid() to check permissions. The caller cannot forge them; anything inside a parcel was written by the caller and proves nothing.</li>${/* addition 2: the caller's identity, which cannot be forged */''}
<li><b>Counted references.</b> Parcels can carry Binder object references. The driver gives each process its own handle number for an object (like a file descriptor) and counts references; at zero the owner is told it may free the object. If the owner dies, holders that asked (linkToDeath) get a <b>death notification</b>; calls through a dead handle fail with DeadObjectException.</li>${/* addition 3: counted object references and death notifications */''}
<li><b>Service manager.</b> Registry reached through handle 0, where system services are found by name; an app's service is reached with bindService().</li>${/* addition 4: the service manager, reached through handle 0 */''}
</ul>${/* closes the list of additions */''}

<h3>Binder compared with a pipe and shared memory</h3>${/* notes heading for part 8: Binder compared with a pipe and shared memory */''}
<table>${/* opens the comparison table */''}
<tr><th></th><th>Pipe</th><th>Shared memory</th><th>Binder</th></tr>${/* table header row: the three mechanisms */''}
<tr><td>Kernel copies</td><td>2 (in and out)</td><td>0</td><td>1</td></tr>${/* table row: kernel copies */''}
<tr><td>What crosses</td><td>byte stream, one way</td><td>nothing: same memory</td><td>typed method call and reply</td></tr>${/* table row: what crosses between the processes */''}
<tr><td>Knows the sender</td><td>no</td><td>no</td><td>yes: UID and PID</td></tr>${/* table row: whether the sender is known */''}
<tr><td>Waiting</td><td>reader blocks for data</td><td>none: add semaphores</td><td>caller blocks for reply (unless one-way)</td></tr>${/* table row: how waiting works */''}
<tr><td>Finding the other side</td><td>inherited or named pipe</td><td>map the same region</td><td>by name, or by binding</td></tr>${/* table row: how each side finds the other */''}
<tr><td>Object references</td><td>no</td><td>no</td><td>counted, with death notices</td></tr>${/* table row: object references */''}
</table>${/* closes the comparison table */''}
<p>Example: 300 KB through a pipe = 600 KB copied; through Binder, 300 KB; through shared memory, none.</p>${/* notes paragraph: the worked example of 300 KB through each mechanism */''}

<h3>Built on Binder</h3>${/* notes heading for part 9: the tools built on Binder */''}
<ul>${/* opens the list of tools */''}
<li><b>Intents</b>: start an activity or service, or announce an event (a broadcast such as "battery low").</li>${/* list item: intents */''}
<li><b>Content providers</b>: share a set of data (such as contacts) through queries with permission checks.</li>${/* list item: content providers */''}
<li><b>Bound services</b>: bind once, then call the service's Binder interface (usually AIDL) directly, again and again.</li>${/* list item: bound services */''}
</ul>`,  // closes the list and ends the notes text
  });  // closes the object passed to Guide.section and the call itself
})();  // ends the function that wraps the section and runs it at once
