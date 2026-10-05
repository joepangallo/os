// Comment key: a line inside backtick text ends with ${/* comment */''}, an empty-string slot that holds a comment without changing the text on screen (full note at the top of the page).
/* =====================================================================
   6.1 Principles of Deadlock
   Original teaching material. Every step is self-contained; small helpers
   shared by several steps live inside this IIFE (no globals).
   ===================================================================== */
(function () {  // wraps the whole section in a function that runs once, right away, so its helper names stay private to this file

  /* Narration box shared by the interactive steps: tone is '', 'ok', 'bad' or 'warn'. */
  function narrate(box, html, tone) {  // narrate(box, html, tone): writes a message into a narration box and colours it by tone (none, ok, bad or warn)
    box.className = 'narr' + (tone ? ' ' + tone : '');  // sets the box's class to narr plus the tone, so the section's CSS paints its left bar green, red or amber
    box.innerHTML = html;  // puts the message into the box as HTML, so bold words and highlighted terms show up formatted
  }  // ends narrate

  /* Directed-graph cycle finder used by the intersection and the resource allocation graph.
     edges: Map node -> array of nodes. Returns one cycle as an array of nodes, or null. */
  function findCycle(nodes, edges) {  // findCycle(nodes, edges): searches a directed graph (nodes joined by one-way arrows) for a loop; used by steps 2 and 6
    const state = new Map(), stack = [];  // state remembers each node's visit status (1 = on the current path, 2 = fully explored); stack is the current path
    let found = null;  // found will hold the first loop discovered; null means none has been found yet
    function dfs(u) {  // dfs(u): depth-first search, which follows arrows from node u as deep as possible before backing up
      state.set(u, 1); stack.push(u);  // marks u as on the current path and adds it to the end of the path
      for (const v of edges.get(u) || []) {  // tries every arrow leaving u (a node with no entry in edges has no arrows)
        if (found) return;  // stops early once a loop has been found anywhere, since one loop is all the caller needs
        if (state.get(v) === 1) { found = stack.slice(stack.indexOf(v)); return; }  // an arrow back to a node still on the path closes a loop: the loop is the path from that node to here
        if (!state.get(v)) dfs(v);  // a node never visited before is explored next, going one level deeper
      }  // ends the loop over u's arrows
      stack.pop(); state.set(u, 2);  // u is finished: it leaves the path and is marked fully explored, so it is never searched again
    }  // ends dfs
    for (const n of nodes) { if (!state.get(n) && !found) dfs(n); }  // starts a search from every node not yet visited, so loops in separate parts of the graph are also found
    return found;  // returns the loop as a list of nodes, or null when the graph has no loop
  }  // ends findCycle

  Guide.section({  // registers this section with the guide; the object below holds everything the section shows
    id: '6.1',  // the section number, used in links, the progress list and saved progress
    title: 'Principles of Deadlock',  // the full title shown at the top of every step
    short: 'Deadlock principles',  // the short name used in the side menu and progress list
    summary: 'Why a group of processes can block each other forever, the four conditions behind it, and three ways to respond.',  // one-sentence summary shown on the chapter page
    objectives: [  // what the student should be able to do after this section, shown on its first page
      'Define deadlock precisely and recognise it in traffic, devices, memory and message passing.',  // objective 1: define deadlock and spot it in four different settings
      'Read and draw a joint progress diagram, and find its fatal region and deadlock point.',  // objective 2: read a joint progress diagram and find its fatal region
      'Tell reusable resources from consumable ones and explain how each kind can deadlock.',  // objective 3: reusable versus consumable resources
      'Build a resource allocation graph and decide, by reduction, whether a cycle really is a deadlock.',  // objective 4: resource allocation graphs and testing them by reduction
      'State the four conditions for deadlock and compare prevention, avoidance and detection.',  // objective 5: the four conditions and the three ways to respond
    ],  // closes the objectives list
    terms: [  // key terms for the glossary, each written as [term, definition]
      ['Deadlock', 'A permanent standstill of a set of processes: each one is blocked waiting for an event, usually the release of a resource, that only another blocked member of the same set can cause.'],  // glossary entry: deadlock
      ['Joint progress diagram', 'A graph of two processes running on one processor: the x axis is how far one process has got, the y axis how far the other has got, and the run is drawn as a staircase path.'],  // glossary entry: joint progress diagram
      ['Fatal region', 'The part of a joint progress diagram where both processes already hold a resource the other will need, so every possible path from there ends in deadlock.'],  // glossary entry: fatal region
      ['Reusable resource', 'A resource that one process at a time can use and that is not used up by using it, such as a processor, memory, a device, a file or a semaphore. It is released for others afterwards.'],  // glossary entry: reusable resource
      ['Consumable resource', 'A resource that is created by one process and destroyed when another process takes it, such as a message, a signal, an interrupt or data in an I/O buffer. There is no fixed supply.'],  // glossary entry: consumable resource
      ['Resource allocation graph', 'A directed graph with a circle for each process and a square for each resource type (one dot per unit). Its edges show which process holds which unit and which process is waiting for what.'],  // glossary entry: resource allocation graph
      ['Request edge', 'An arrow from a process to a resource square in a resource allocation graph: the process has asked for a unit of that resource and is waiting for it.'],  // glossary entry: request edge
      ['Assignment edge', 'An arrow from a unit dot inside a resource square to a process: that unit has been given to (is held by) the process.'],  // glossary entry: assignment edge
      ['Graph reduction', 'A way to test a resource allocation graph for deadlock: repeatedly pick a process whose outstanding requests could all be granted now, pretend it finishes and frees what it holds, and repeat. Processes that can never be picked are deadlocked.'],  // glossary entry: graph reduction, the test for deadlock used in step 6
      ['Hold and wait', 'The deadlock condition in which a process keeps the resources it already holds while it waits for more.'],  // glossary entry: hold and wait
      ['No preemption', 'The deadlock condition in which a resource cannot be taken away from the process holding it; it is only released voluntarily.'],  // glossary entry: no preemption
      ['Circular wait', 'A closed chain of processes in which each process holds at least one resource that the next process in the chain is waiting for.'],  // glossary entry: circular wait
      ['Necessary condition', 'Something that must be true for an outcome to happen. It may be true without the outcome happening.'],  // glossary entry: necessary condition
      ['Sufficient condition', 'Something that, when true, guarantees the outcome happens.'],  // glossary entry: sufficient condition
      ['Deadlock prevention', 'A strategy that designs the system so that one of the four deadlock conditions can never hold, making deadlock impossible.'],  // glossary entry: deadlock prevention
      ['Deadlock avoidance', 'A strategy that checks each request as it is made and refuses or delays any grant that could lead to deadlock, using knowledge of each process’s maximum future needs.'],  // glossary entry: deadlock avoidance
      ['Deadlock detection', 'A strategy that grants requests freely, checks from time to time whether a deadlock has formed, and then recovers by breaking it.'],  // glossary entry: deadlock detection
    ],  // closes the glossary list
    css: ` /* css: styles that apply only inside this section (every rule starts with .sec-6-1) */
      .sec-6-1 .narr { background: var(--panel-2); border: 1px solid var(--line); border-left: 5px solid var(--chc); border-radius: 12px; padding: 9px 13px; font-size: 15px; line-height: 1.45; } /* narration box: a pale panel with a thick left bar in the chapter colour, used for running commentary */
      .sec-6-1 .narr.ok { border-left-color: var(--ok); background: var(--ok-bg); } /* narration in the ok tone: green bar and green tint, for a step that worked */
      .sec-6-1 .narr.bad { border-left-color: var(--bad); background: var(--bad-bg); } /* narration in the bad tone: red bar and red tint, for a deadlock or a wrong answer */
      .sec-6-1 .narr.warn { border-left-color: var(--warn); background: var(--warn-bg); } /* narration in the warn tone: amber bar and amber tint, for a process that has to wait */
      .sec-6-1 .split > *, .sec-6-1 .grid-2 > *, .sec-6-1 .grid-3 > * { min-width: 0; } /* lets the columns of side-by-side layouts shrink, so long content cannot push the page wider than the screen */
      .sec-6-1 pre.code .ln.nxt { background: var(--accent-bg); border-left-color: var(--accent); } /* in the code listings, the line a process will run next gets an accent-coloured background and left bar */
      .sec-6-1 pre.code.wrap .ln { white-space: pre-wrap; padding-left: 3.4em; text-indent: -3.4em; } /* wrap mode for code listings on small screens: long lines wrap, and wrapped parts are indented under the first */
      .sec-6-1 table.cmp td { font-size: 13.5px; line-height: 1.35; } /* comparison table in step 8: slightly smaller text so the advantages and disadvantages fit */
      .sec-6-1 table.cmp td.grp { border-right: 1px solid var(--line); } /* the first column of the comparison table (the approach name) gets a line on its right to set it apart */
      .sec-6-1 table.cmp tr > td { border-bottom-color: var(--line); } /* every row of the comparison table gets a bottom line in the normal line colour */
      .sec-6-1 table.cmp td.grp.cont { border-bottom-color: transparent; } /* hides the bottom line under an approach name that continues into the next row, so the group looks like one cell */
      .sec-6-1 svg text.halo { paint-order: stroke; stroke: var(--panel); stroke-width: 4px; stroke-linejoin: round; } /* halo labels in diagrams: a thick outline in the panel colour is drawn behind the letters so they stay readable over shading */
      .sec-6-1 .defn { font-size: 19px; line-height: 1.9; } /* the definition in step 1 is shown in large text with tall lines, so the phrase buttons have room */
      .sec-6-1 .defn .dp { font: inherit; color: var(--ink); background: var(--accent-bg); border: 1px solid transparent; border-radius: 6px; padding: 0 4px; cursor: pointer; } /* each phrase button in the definition looks like highlighted text rather than a normal button */
      .sec-6-1 .defn .dp:hover { border-color: var(--accent); } /* hovering a phrase button shows an accent-coloured border, hinting that it can be clicked */
      .sec-6-1 .defn .dp.on { background: var(--hl); border-color: var(--accent); font-weight: 700; } /* the chosen phrase is marked with the highlighter colour and bold text */
    `,  // end of the section's styles
    steps: [  // steps: the pages of this section, shown one after another
      /* ---------------- 1. Big picture: what a deadlock is ---------------- */
      {  // step 1: a story page that defines deadlock phrase by phrase
        title: 'Everyone is waiting, so nobody can move',  // step 1 title, shown at the top of the page
        kind: 'story',  // kind 'story': an introductory page that sets the scene
        html: `${/* html: the fixed layout of step 1, written as HTML; render() below fills in the interactive parts */''}
          <div class="split fill" style="grid-template-columns:minmax(0,11fr) minmax(0,10fr)">${/* two-column layout: explanation on the left, the clickable definition on the right */''}
            <div class="stack" style="gap:9px">${/* left column: the explanation and three callout boxes */''}
              <p class="lead m0">Locks and semaphores let processes take turns. Used carelessly, they can freeze a group of processes for good.</p>${/* opening line: locks and semaphores can freeze a group of processes */''}
              <p class="m0">A <span class="t">deadlock</span> is that freeze. Every process in the group is <b>blocked</b>, each waiting for something only another member could provide. All of them are asleep, so nobody provides it, and waiting longer does not help: the blocking is <b>permanent</b> unless the operating system steps in.</p>${/* paragraph: what a deadlock is, why blocked processes cannot help each other, and that it is permanent */''}
              <div class="callout analogy m0" data-label="Analogy">A game needs the one remote <i>and</i> the one controller. One roommate grabs the remote, the other grabs the controller, and each waits for the other to give in. Neither does, so the game never starts.</div>${/* analogy callout: two roommates each grab one of the two things a game needs */''}
              <div class="callout why m0" data-label="Why it matters">No efficient fix works in every case. Every response an OS can choose (prevent it, avoid it, or detect it and recover) has a cost, so designers must understand exactly how deadlock arises.</div>${/* why-it-matters callout: no single cheap fix exists, so designers must understand the cause */''}
              <div class="callout warn m0" data-label="Common mistake">Calling any long wait a deadlock. A process waiting for a slow disk will continue eventually; a deadlocked one never will.</div>${/* common-mistake callout: a long wait is not a deadlock */''}
            </div>${/* ends the left column */''}
            <div class="card stack" style="gap:10px">${/* right column: a card holding the definition, piece by piece */''}
              <h4 class="m0">The definition, piece by piece</h4>${/* heading of the definition card */''}
              <p class="small muted m0">Each highlighted phrase is a button. Click one to see why that word is in the definition.</p>${/* instruction: each highlighted phrase is a button to click */''}
              <div class="defn"></div>${/* empty box that render() fills with the phrase buttons */''}
              <div class="card white grow def-detail" style="display:flex;flex-direction:column;gap:8px"></div>${/* empty card that render() fills with the explanation of the chosen phrase */''}
              <div class="row gap-s small"><b class="xs muted" style="text-transform:uppercase;letter-spacing:.07em">Coming up</b><span class="chip io">gridlock a crossing</span><span class="chip proc">draw a progress path</span><span class="chip os">build a resource graph</span><span class="chip intr">switch off the four conditions</span></div>${/* preview chips naming the four interactive steps that follow */''}
            </div>${/* closes the right-hand card */''}
          </div>`,  // closes the two-column layout and ends step 1's HTML
        render(el, ctx) {  // render(el, ctx): runs when step 1 opens; it turns the definition into clickable phrase buttons (ctx is the guide's toolbox)
          const { h } = ctx;  // takes h, the guide's HTML element builder, out of ctx so it can be called directly
          const parts = [  // parts: the definition cut into six phrases, each as [phrase, explanation, chip colour]
            ['A set of processes', 'Deadlock is a property of a <b>group</b> of processes that wait on each other. The usual group has two members; real deadlocks may involve three, four or more.', 'proc'],  // phrase 1: a set of processes, and why deadlock is about a group
            ['is deadlocked when every process in the set', 'Not just some of them. If even one member could still run, it might eventually release what the others want, and the group would not be stuck.', null],  // phrase 2: every member must be stuck, not just some
            ['is blocked', 'A blocked process is asleep: it is not running and is not in the ready queue, so it cannot do anything to help itself or anyone else.', 'warn'],  // phrase 3: what blocked means (asleep, not in the ready queue)
            ['waiting for an event', 'Usually the event is “a resource I asked for was released”. It can also be the arrival of a message or a signal.', null],  // phrase 4: the event being waited for, usually a released resource
            ['that only another blocked process in the set can cause.', 'This is the trap. The only processes able to cause the event are themselves asleep, waiting on events from the others. The waiting forms a closed loop.', 'bad'],  // phrase 5: the trap, where only sleeping members could cause the event
            ['The blocking is permanent.', 'Unlike an ordinary wait, time does not fix it. Only an outside action, such as the OS killing one process or taking a resource back, can break the loop.', 'intr'],  // phrase 6: permanence, and that only an outside action ends it
          ];  // closes the parts list
          const defn = ctx.$('.defn'), detail = ctx.$('.def-detail');  // finds the two empty boxes from the HTML above: the definition line and the detail card
          const btns = parts.map((p, i) => h('button', { type: 'button', class: 'dp', onclick: () => show(i) }, p[0]));  // makes one button per phrase; clicking a button shows that phrase's explanation
          defn.append(...btns.flatMap((b) => [b, ' ']));  // puts the buttons into the definition line with a space after each, so they read as one sentence
          function show(i) {  // show(i): highlights phrase i and fills the detail card with its explanation
            btns.forEach((b, j) => b.classList.toggle('on', i === j));  // marks only the chosen button with the on class (highlighted), and clears the others
            const [phrase, text, cls] = parts[i];  // unpacks the chosen phrase, its explanation and its chip colour
            detail.innerHTML = '';  // empties the detail card before refilling it
            detail.append(  // adds the new contents to the detail card
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', { style: { fontSize: '17.5px' } }, '“' + phrase.replace(/[.]$/, '') + '”'), h('span', { class: 'chip ' + (cls || 'accent') }, 'part ' + (i + 1) + ' of ' + parts.length)),  // top row: the phrase in quotes (any final full stop removed) and a chip saying which part it is, such as part 2 of 6
              h('p', { class: 'm0', style: { fontSize: '16px' }, html: text }));  // below it: the explanation paragraph, as HTML so bold words show
            detail.classList.remove('fade-in'); void detail.offsetWidth; detail.classList.add('fade-in');  // restarts the fade-in animation: removing the class, reading the width to force a redraw, then adding it back
          }  // ends show
          show(0);  // shows the first phrase when the step opens, so the detail card is never empty
        },  // ends render() for step 1
      },  // closes step 1

      /* ---------------- 2. The intersection: cause gridlock yourself ---------------- */
      {  // step 2: drive four cars into gridlock at a crossing
        title: 'Drive four cars into gridlock',  // step 2 title, shown at the top of the page
        kind: 'explore',  // kind 'explore': a hands-on page to play with
        render(el, ctx) {  // render(el, ctx): builds the crossing drawing, the buttons and the table when step 2 opens
          const { h, s } = ctx;  // takes the HTML builder h and the SVG builder s (for drawings) out of ctx
          // quadrant centres of the crossing; each car crosses two quadrants in order
          const Q = { NW: [205, 205], NE: [275, 205], SE: [275, 275], SW: [205, 275] };  // Q: the centre point of each of the four quadrants (NW, NE, SE, SW) in drawing units
          const CARS = [  // CARS: the four cars, each with its number, arrow, direction, the two quadrants it crosses, start and end points, and colour
            { n: 1, arrow: '↑', dir: 'north', path: ['SE', 'NE'], start: [275, 352], end: [275, 38], cls: 's-cpu', c: '--cpu' },  // car 1 drives north: it crosses SE, then NE; blue
            { n: 2, arrow: '←', dir: 'west', path: ['NE', 'NW'], start: [352, 205], end: [38, 205], cls: 's-io', c: '--io' },  // car 2 drives west: it crosses NE, then NW
            { n: 3, arrow: '↓', dir: 'south', path: ['NW', 'SW'], start: [205, 128], end: [205, 442], cls: 's-thread', c: '--thread' },  // car 3 drives south: it crosses NW, then SW
            { n: 4, arrow: '→', dir: 'east', path: ['SW', 'SE'], start: [128, 275], end: [442, 275], cls: 's-mem', c: '--mem' },  // car 4 drives east: it crosses SW, then SE; green
          ];  // closes the CARS list
          let stage = [0, 0, 0, 0], gen = 0;  // stage per car: 0 at its stop line, 1 in its first quadrant, 2 in its second, 3 through; gen cancels an old animation
          const holdsOf = (i) => (stage[i] === 1 ? CARS[i].path[0] : stage[i] === 2 ? CARS[i].path[1] : null);  // holdsOf(i): the quadrant car i occupies right now, or null at the stop line or after leaving
          const wantsOf = (i) => (stage[i] === 0 ? CARS[i].path[0] : stage[i] === 1 ? CARS[i].path[1] : null);  // wantsOf(i): the quadrant car i needs next, or null when its next move is simply to leave
          const holder = (q) => { for (let i = 0; i < 4; i++) if (holdsOf(i) === q) return i; return -1; };  // holder(q): the number of the car occupying quadrant q, or -1 if it is empty
          // a car is blocked when the quadrant it needs next is held by another car (exiting is always possible)
          const blockedBy = (i) => { if (stage[i] >= 2) return -1; const j = holder(wantsOf(i)); return j === i ? -1 : j; };  // blockedBy(i): which car blocks car i, or -1 if car i can move (a car in its second quadrant can always leave)
          function cycle() {  // cycle(): looks for gridlock, a loop of cars each blocked by the next
            const edges = new Map();  // edges: for each car, an arrow to the car that blocks it
            for (let i = 0; i < 4; i++) { const j = blockedBy(i); edges.set(i, j >= 0 ? [j] : []); }  // gives each car one arrow to its blocker, or no arrow if it can move
            return findCycle([0, 1, 2, 3], edges);  // asks the shared findCycle helper for a loop among the four cars; returns the loop or null
          }  // ends cycle
          const svg = s('svg', { viewBox: '0 0 480 480', width: '100%', role: 'img', 'aria-label': 'A four-way intersection with four cars' });  // the crossing drawing: an SVG (the browser's drawing format) 480 units square that stretches to its box
          const quadEls = {}, carEls = [], waitLayer = s('g');  // quadEls: the four quadrant squares by name; carEls: the four car shapes; waitLayer: a group for the waiting arrows
          (function build() {  // build(): draws the fixed parts of the crossing once, straight away
            const kids = [  // kids: the shapes of the drawing, from back to front
              s('rect', { x: 0, y: 0, width: 480, height: 480, rx: 16, class: 's-mem', style: 'opacity:.5', 'stroke-width': 0 }),  // green background (the grass), half transparent
              s('rect', { x: 170, y: 0, width: 140, height: 480, style: 'fill:var(--panel-3)' }),  // the north-south road, a grey strip down the middle
              s('rect', { x: 0, y: 170, width: 480, height: 140, style: 'fill:var(--panel-3)' }),  // the east-west road, a grey strip across the middle
            ];  // closes the starting shapes
            for (const [k, [x, y]] of Object.entries(Q)) {  // for each quadrant name and its centre point
              quadEls[k] = s('rect', { x: x - 35, y: y - 35, width: 70, height: 70, class: 's-muted', 'stroke-dasharray': '4 4' });  // the quadrant square: a dashed outline 70 units wide, later tinted in the colour of the car inside it
              kids.push(quadEls[k], s('text', { x: x + (x < 240 ? -31 : 31), y: y + (y < 240 ? -20 : 30), 'text-anchor': x < 240 ? 'start' : 'end', 'font-size': ctx.narrow ? 17 : 13, class: 's-sub', 'font-weight': 700 }, k));  // adds the square and its name label in the outer corner, in larger text on phone-width screens
            }  // ends the loop over quadrants
            [[240, 0, 240, 170], [240, 310, 240, 480], [0, 240, 170, 240], [310, 240, 480, 240]].forEach(([a, b, c, d]) => kids.push(s('line', { x1: a, y1: b, x2: c, y2: d, class: 's-muted', 'stroke-dasharray': '10 10' })));  // dashed centre lines on the four arms of the road
            [[240, 310, 310, 310], [310, 170, 310, 240], [170, 170, 240, 170], [170, 240, 170, 310]].forEach(([a, b, c, d]) => kids.push(s('line', { x1: a, y1: b, x2: c, y2: d, class: 's-line', 'stroke-width': 4 })));  // four thick stop lines, one across the lane where each car waits before entering
            if (!ctx.narrow) kids.push(s('text', { x: 400, y: 28, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, 'thick bars = stop lines'));  // on wide screens, a small key in the top corner explains the thick bars
            kids.push(waitLayer);  // adds the empty group for waiting arrows above the roads but below the cars
            CARS.forEach((c) => {  // for each car, builds its shape
              const g = s('g', { style: 'transition: transform .45s ease, opacity .45s' },  // a group that slides and fades smoothly (over 0.45 seconds) whenever its position changes
                s('rect', { x: -22, y: -22, width: 44, height: 44, rx: 10, class: c.cls, 'stroke-width': 3 }),  // the car body: a rounded square in the car's colour
                s('text', { x: 0, y: ctx.narrow ? 9 : 7, 'text-anchor': 'middle', 'font-size': ctx.narrow ? 25 : 19, 'font-weight': 800 }, c.n + c.arrow));  // the car's number and direction arrow, in larger text on phone-width screens
              carEls.push(g); kids.push(g);  // keeps the car shape for later moves and adds it to the drawing
            });  // ends the loop over cars
            svg.replaceChildren(...kids);  // puts all the shapes into the drawing in one go
          })();  // ends build and runs it at once
          const narr = h('div', { class: 'narr', style: { minHeight: '84px' } });  // narr: the narration box under the buttons, tall enough that the layout does not jump as messages change
          const tbody = h('tbody');  // tbody: the body of the status table, refilled after every move
          const carBtns = CARS.map((c, i) => h('button', { class: 'btn sm', type: 'button', style: { borderColor: `var(${c.c})` }, onclick: () => advance(i) }, `Car ${c.n} ${c.arrow}`));  // one button per car, outlined in the car's colour; clicking it moves that car one step
          const offBtns = CARS.map((c, i) => h('button', { class: 'btn sm intr', type: 'button', onclick: () => backOut(i) }, 'car ' + c.n));  // the officer's buttons, one per car; each makes that car reverse out of the crossing
          const officer = h('div', { class: 'row gap-s' }, h('span', { class: 'small b' }, 'Traffic officer (the OS) reverses'), ...offBtns, h('span', { class: 'xs muted' }, 'only after gridlock'));  // the officer row: a label, the four reverse buttons and a note that they only work during gridlock
          function draw() {  // draw(): redraws the cars, quadrants, waiting arrows and table from the current stages; returns the loop if there is one
            const cyc = cycle();  // checks for gridlock first, so cars in the loop can be coloured red
            CARS.forEach((c, i) => {  // for each car
              const pos = stage[i] === 0 ? c.start : stage[i] === 3 ? c.end : Q[c.path[stage[i] - 1]];  // its position: the start point, the end point, or the centre of the quadrant it is in
              carEls[i].style.transform = `translate(${pos[0]}px, ${pos[1]}px)`;  // moves the car shape there; the transition set earlier makes it glide
              carEls[i].style.opacity = stage[i] === 3 ? 0.35 : 1;  // fades a car that has left the crossing
              carBtns[i].disabled = stage[i] === 3;  // disables the button of a car that is already through
            });  // ends the loop over cars
            for (const k of Object.keys(Q)) { const j = holder(k); quadEls[k].setAttribute('class', j >= 0 ? CARS[j].cls : 's-muted'); quadEls[k].setAttribute('style', j >= 0 ? 'opacity:.55' : ''); }  // tints each quadrant in the colour of the car inside it, or leaves it as a plain dashed outline when empty
            const arrows = [];  // arrows: one waiting arrow for each blocked car
            for (let i = 0; i < 4; i++) {  // for each car
              const j = blockedBy(i); if (j < 0) continue;  // skips cars that are not blocked
              const a = stage[i] === 0 ? CARS[i].start : Q[holdsOf(i)], b = Q[holdsOf(j)];  // the arrow starts at the waiting car (at its stop line or in its quadrant) and points at the car blocking it
              const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;  // the direction from start to end as a unit step (length 1), used to stop the arrow short of both car shapes
              const inCyc = cyc && cyc.includes(i);  // inCyc: true when this car is part of the gridlock loop
              arrows.push(s('line', { x1: a[0] + ux * 24, y1: a[1] + uy * 24, x2: b[0] - ux * 27, y2: b[1] - uy * 27, class: 's-line', style: `stroke:var(${inCyc ? '--bad' : '--warn'})`, 'stroke-width': 3, 'marker-end': `url(#arr-${inCyc ? 'bad' : 'warn'})` }));  // draws the arrow, red if it is part of the loop and amber if it is an ordinary wait, with a matching arrowhead
            }  // ends the loop over cars
            waitLayer.replaceChildren(...arrows);  // replaces the old waiting arrows with the new ones
            tbody.replaceChildren(...CARS.map((c, i) => {  // refills the status table with one row per car
              const j = blockedBy(i), held = holdsOf(i), want = wantsOf(i);  // j: the car blocking this one; held: the quadrant it occupies; want: the quadrant it needs next
              const st = stage[i] === 3 ? h('span', { class: 'chip ok' }, 'through') : cyc && cyc.includes(i) ? h('span', { class: 'chip bad' }, 'deadlocked') : j >= 0 ? h('span', { class: 'chip warn' }, 'waits for car ' + CARS[j].n) : h('span', { class: 'chip proc' }, 'can move');  // the state chip: through (green), deadlocked (red, in the loop), waits for car j (amber), or can move
              return h('tr', {}, h('td', { class: 'b', style: { color: `var(${c.c})` } }, `Car ${c.n} ${c.arrow}`), h('td', {}, held || '—'), h('td', {}, stage[i] === 2 ? 'exit' : want || '—'), h('td', {}, st));  // the row: car name in its colour, quadrant held, quadrant needed next (or exit), and the state chip
            }));  // closes the table rows
            offBtns.forEach((b, i) => { b.disabled = !(cyc && cyc.includes(i)); });  // an officer button works only for a car inside the gridlock loop; the others are disabled
            return cyc;  // hands the loop (or null) back to the caller
          }  // ends draw
          function report(i, moved) {  // report(i, moved): redraws and writes the narration after car i was pressed; moved says whether it actually moved
            const cyc = draw(), c = CARS[i];  // redraws first, which also tells us whether there is gridlock
            if (cyc) {  // gridlock case: explain the loop
              const chain = cyc.map((k) => `car ${CARS[k].n} (holds ${holdsOf(k)})`).join(' → ');  // chain: the loop written out, such as car 1 (holds SE) → car 4 (holds SW) → ...
              narrate(narr, `<b>Gridlock.</b> ${chain} → back to car ${CARS[cyc[0]].n}. Each car holds one quadrant and waits for the next one, which the next car holds. Every car is blocked, so none will ever move: a <span class="t">deadlock</span>. Only an outside force can fix it: use the officer.`, 'bad');  // red narration: names the loop, explains that every car is blocked for good, and points to the officer
            } else if (stage.every((x) => x === 3)) narrate(narr, 'All four cars are through. Moving them one or two at a time never closes the loop.', 'ok');  // every car is through: green message that taking turns never closes the loop
            else if (!moved) { const j = blockedBy(i); narrate(narr, `Car ${c.n} cannot move: quadrant <b>${wantsOf(i)}</b> is occupied by car ${CARS[j].n}. ${stage[i] === 1 ? `Car ${c.n} keeps holding ${holdsOf(i)} while it waits: that is <span class="t">hold and wait</span>.` : 'It waits at its stop line, holding nothing.'}`, 'warn'); }  // the car could not move: amber message naming the occupied quadrant and, if it holds one, pointing out hold and wait
            else narrate(narr, stage[i] === 3 ? `Car ${c.n} leaves the crossing and frees ${c.path[1]}.` : stage[i] === 2 ? `Car ${c.n} moves into ${c.path[1]} and frees ${c.path[0]} behind it.` : `Car ${c.n} enters ${c.path[0]} and now holds it. Next it needs ${c.path[1]}.`, 'ok');  // the car did move: green message saying which quadrant it entered or freed, or that it left the crossing
          }  // ends report
          function advance(i) {  // advance(i): runs when car i's button is clicked; moves the car one step if nothing blocks it
            if (stage[i] === 3) return;  // a car that is already through does nothing
            const moved = blockedBy(i) < 0;  // the car can move only if no other car occupies the quadrant it needs next
            if (moved) stage[i]++;  // moves it one stage forward (stop line, first quadrant, second quadrant, through)
            report(i, moved);  // updates the drawing and the narration either way
          }  // ends advance
          function backOut(i) {  // backOut(i): the officer's action; makes car i reverse to its stop line
            if (stage[i] !== 1) { narrate(narr, `Car ${CARS[i].n} is not part of the loop, so backing it out would not help. Pick a car marked deadlocked.`, 'warn'); return; }  // a car not sitting in its first quadrant is not part of the loop, so the officer refuses with an amber hint
            const q = holdsOf(i); stage[i] = 0; draw();  // q is the quadrant the car gives up; the car goes back to stage 0 and everything is redrawn
            narrate(narr, `The officer makes car ${CARS[i].n} reverse to its stop line, so it gives up <b>${q}</b>. That is <b>preemption</b>: a resource taken away from its holder. The car before it in the loop can now move. Car ${CARS[i].n} loses its progress and must try again.`, 'ok');  // green message: reversing is preemption (a resource taken away), and the reversed car loses its progress
          }  // ends backOut
          async function rush() {  // rush(): the All four arrive at once button; each car tries to enter its first quadrant in turn, a moment apart
            const g = ++gen;  // a new animation number; an older animation, or a Reset, will notice the change and stop
            narrate(narr, 'All four cars pull into the crossing at the same moment...');  // opening narration for the rush
            for (let i = 0; i < 4; i++) {  // for each car in turn
              await ctx.sleep(420);  // waits 0.42 seconds so the student can watch the cars arrive one by one
              if (!ctx.alive || g !== gen) return;  // stops if the student left the step or another action started a newer animation
              if (stage[i] === 0 && blockedBy(i) < 0) { stage[i] = 1; report(i, true); }  // a car still at its stop line enters its first quadrant if that quadrant is free
            }  // ends the loop over cars
            if (g !== gen) return;  // stops here too if something else took over during the last wait
            if (draw()) report(0, true);  // if the four cars closed a loop, the gridlock message is shown
            else narrate(narr, 'No gridlock this time: not every car was waiting at its stop line, so the loop could not close and some car can still move. Press <b>Reset</b> to start from an empty crossing.', 'warn');  // otherwise an amber note: some car was not at its stop line, so no loop formed
          }  // ends rush
          function reset() { gen++; stage = [0, 0, 0, 0]; draw(); narrate(narr, 'Each car is a process; each quadrant is a resource that only one car can occupy. Press a car to move it one step. Can you make all four cars stuck? Can you get them all through? Then try driving car 1 through before the others arrive.'); }  // reset(): cancels any animation, puts every car back at its stop line, redraws, and shows the opening instructions
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: 'minmax(0, 470px) minmax(0, 1fr)', gap: '22px' } },  // builds the step's layout: two columns, the drawing on the left and the controls on the right
            h('div', { class: 'card white tight', style: { display: 'grid', placeItems: 'center' } }, svg),  // left column: the crossing drawing, centred in a white card
            h('div', { class: 'stack', style: { gap: '10px' } },  // right column: the controls stacked top to bottom
              h('p', { class: 'm0', style: { fontSize: '15.5px' }, html: 'A car crossing straight over needs <b>two</b> quadrants, one after the other. It holds the first while it waits for the second. Move cars one step at a time, or let all four arrive together.' }),  // short explanation: each car needs two quadrants and holds the first while it waits for the second
              h('div', { class: 'row gap-s' }, ...carBtns, h('button', { class: 'btn sm primary', type: 'button', onclick: rush }, 'All four arrive at once'), h('button', { class: 'btn sm', type: 'button', onclick: reset }, 'Reset')),  // button row: the four car buttons, the All four arrive at once button and Reset
              officer, narr,  // the officer row, then the narration box
              h('table', { class: 'tbl compact' }, h('thead', {}, h('tr', {}, h('th', {}, 'Car'), h('th', {}, 'Holds'), h('th', {}, 'Needs next'), h('th', {}, 'State'))), tbody),  // the status table with the headings Car, Holds, Needs next and State
              h('div', { class: 'callout warn small m0', 'data-label': 'Common mistake' }, 'Thinking a deadlock needs a slow or broken car. Every car here is fine. The trouble is only the pattern: each holds one thing and waits for the next, in a closed loop.'))));  // common-mistake callout: deadlock needs no broken car, only the hold-and-wait loop; closes the layout
          reset();  // starts the step from an empty crossing
        },  // ends render() for step 2
      },  // closes step 2

      /* ---------------- 3. Joint progress diagram ---------------- */
      {  // step 3: a joint progress diagram of two processes sharing two resources
        title: 'Joint progress: watch two processes walk into a trap',  // step 3 title, shown at the top of the page
        kind: 'explore',  // kind 'explore': a hands-on page to play with
        core: true,  // core: marks this as one of the section's key steps
        render(el, ctx) {  // render(el, ctx): builds the diagram, the buttons and the narration when step 3 opens
          const { h, s } = ctx;  // takes the HTML builder h and the SVG builder s out of ctx
          const N = 10;  // N: each process takes 10 steps from start to finish
          // each program is a list of events: at step k the process gets or releases a resource
          const Qprog = [{ at: 2, ev: 'get', r: 'B' }, { at: 4, ev: 'get', r: 'A' }, { at: 6, ev: 'rel', r: 'B' }, { at: 8, ev: 'rel', r: 'A' }];  // Qprog: process Q's program; it gets B at step 2, gets A at step 4, frees B at 6 and frees A at 8
          const VARIANTS = {  // VARIANTS: two versions of process P's program, chosen with the switch above the buttons
            together: [{ at: 2, ev: 'get', r: 'A' }, { at: 4, ev: 'get', r: 'B' }, { at: 6, ev: 'rel', r: 'A' }, { at: 8, ev: 'rel', r: 'B' }],  // together: P gets A, then B, so it holds both at once (the order opposite to Q)
            early: [{ at: 2, ev: 'get', r: 'A' }, { at: 4, ev: 'rel', r: 'A' }, { at: 6, ev: 'get', r: 'B' }, { at: 8, ev: 'rel', r: 'B' }],  // early: P frees A before it gets B, so it never holds both
          };  // closes the VARIANTS table
          let variant = 'together', Pprog = VARIANTS.together, path, gen = 0, fatal, good;  // the current variant and P's program; path is the list of grid points visited; fatal and good are filled by analyse()
          const span = (prog, r) => [prog.find((e) => e.r === r && e.ev === 'get').at, prog.find((e) => e.r === r && e.ev === 'rel').at];  // span(prog, r): the step at which a program gets resource r and the step at which it frees it
          const holds = (prog, k, r) => { const [g, f] = span(prog, r); return k >= g && k < f; };  // holds(prog, k, r): true if, after k steps, the program is holding r
          const heldList = (prog, k) => ['A', 'B'].filter((r) => holds(prog, k, r));  // heldList(prog, k): the resources the program holds after k steps, such as ['A', 'B']
          const allowed = (x, y) => !['A', 'B'].some((r) => holds(Pprog, x, r) && holds(Qprog, y, r));  // allowed(x, y): a grid point is allowed unless P (after x steps) and Q (after y steps) would both hold the same resource
          const canP = (x, y) => x < N && allowed(x + 1, y);  // canP(x, y): P can take its next step from here without entering a forbidden point
          const canQ = (x, y) => y < N && allowed(x, y + 1);  // canQ(x, y): the same check for Q's next step
          const isDead = (x, y) => !(x === N && y === N) && !canP(x, y) && !canQ(x, y);  // isDead(x, y): neither process can move and they are not both finished, which is the deadlock point
          // good[x][y]: some schedule from (x,y) reaches the end; fatal = allowed but not good
          function analyse() {  // analyse(): works out, for every grid point, whether some schedule can still reach the finish
            good = []; fatal = [];  // clears both tables
            for (let x = N; x >= 0; x--) { good[x] = []; fatal[x] = []; }  // makes one empty column for each value of x
            for (let x = N; x >= 0; x--) for (let y = N; y >= 0; y--) {  // visits the grid backwards from the finish, so each point's right and upper neighbours are already known
              good[x][y] = allowed(x, y) && ((x === N && y === N) || (canP(x, y) && good[x + 1][y]) || (canQ(x, y) && good[x][y + 1]));  // good if allowed and it is the finish, or a step by P or by Q leads to a good point
              fatal[x][y] = allowed(x, y) && !good[x][y];  // fatal if allowed but every way forward ends in deadlock
            }  // ends the double loop
          }  // ends analyse
          const ox = ctx.narrow ? 118 : 96, oy = 420, u = ctx.narrow ? 36 : 40, FS = ctx.narrow ? 16 : 13;  // drawing sizes: ox and oy place the corner of the axes, u is one step on the grid, FS the label size (all larger on phone-width)
          const X = (x) => ox + x * u, Y = (y) => oy - y * u;  // X(x) and Y(y) turn step counts into drawing positions; Y subtracts because SVG measures downward from the top
          const RC = { A: { cls: 's-io', c: '--io' }, B: { cls: 's-cpu', c: '--cpu' } };  // RC: the colour of each resource, A in the I/O colour and B in the processor colour
          const svg = s('svg', { viewBox: '0 0 520 500', width: '100%', role: 'img', 'aria-label': 'Joint progress diagram of P and Q' });  // the diagram: an SVG 520 by 500 units that stretches to its box
          const pathLayer = s('g');  // pathLayer: a group that holds the path and its end dot, redrawn after every step
          function drawStatic() {  // drawStatic(): draws everything that does not change while the path moves: grid, boxes, fatal region, labels
            const kids = [], top = [];  // kids: shapes behind the path; top: labels drawn on top of it
            for (let k = 0; k <= N; k++) kids.push(s('line', { x1: X(k), y1: Y(0), x2: X(k), y2: Y(N), class: 's-muted', 'stroke-width': 1, 'stroke-dasharray': '2 5' }), s('line', { x1: X(0), y1: Y(k), x2: X(N), y2: Y(k), class: 's-muted', 'stroke-width': 1, 'stroke-dasharray': '2 5' }));  // the faint dotted grid: one vertical and one horizontal line for each step
            ['A', 'B'].forEach((r) => {  // for each resource, A and B
              const [pg, pf] = span(Pprog, r), [qg, qf] = span(Qprog, r);  // the steps during which P holds it and the steps during which Q holds it
              kids.push(s('rect', { x: X(pg - 0.5), y: Y(qf - 0.5), width: (pf - pg) * u, height: (qf - qg) * u, class: RC[r].cls, style: 'fill-opacity:.55', 'stroke-width': 2 }));  // the shaded box where both would hold it at once; the path may never go inside
            });  // ends the loop over resources
            for (let x = 0; x <= N; x++) for (let y = 0; y <= N; y++) if (fatal[x][y]) kids.push(s('rect', { x: X(x - 0.5), y: Y(y + 0.5), width: u, height: u, style: 'fill:var(--bad);fill-opacity:.3;stroke:none' }));  // shades every fatal grid point with a pale red square, which together form the fatal region
            ['A', 'B'].forEach((r) => {  // for each resource again, to place its label
              const [pg, pf] = span(Pprog, r), [qg, qf] = span(Qprog, r);  // the same holding spans as above
              const lx = r === 'A' ? (pg + pf - 1) / 2 : pf - 1.5, ly = r === 'A' ? qf - 1.5 : (qg + qf - 1) / 2;  // picks a spot inside the shaded box for its label, placed so the A and B labels do not collide
              top.push(s('text', { x: X(lx), y: Y(ly) - 3, 'text-anchor': 'middle', 'font-size': FS, 'font-weight': 700, class: 'halo' }, r + ' needed'), s('text', { x: X(lx), y: Y(ly) + FS, 'text-anchor': 'middle', 'font-size': FS, 'font-weight': 700, class: 'halo' }, 'by both'));  // two-line label in the box, "A needed / by both", with a halo so it stays readable over the shading
            });  // ends the loop over resources
            const fc = []; for (let x = 0; x <= N; x++) for (let y = 0; y <= N; y++) if (fatal[x][y]) fc.push([x, y]);  // fc: the list of every fatal grid point
            if (fc.length) { const mx = Math.min(...fc.map((p) => p[0])), Mx = Math.max(...fc.map((p) => p[0])), my = Math.min(...fc.map((p) => p[1])); top.push(s('text', { x: X((mx + Mx) / 2), y: Y(my) + 5, 'text-anchor': 'middle', 'font-size': FS, 'font-weight': 800, class: 'halo', style: 'fill:var(--bad)' }, 'fatal')); }  // if there is a fatal region, writes "fatal" in red, centred along its bottom edge
            for (let x = 0; x <= N; x++) for (let y = 0; y <= N; y++) if (allowed(x, y) && isDead(x, y)) top.push(s('text', { x: X(x), y: Y(y) + 7, 'text-anchor': 'middle', 'font-size': FS + 9, 'font-weight': 900, class: 'halo', style: 'fill:var(--bad)' }, '✗'));  // marks every deadlock point (allowed, but nobody can move) with a large red ✗
            kids.push(s('line', { x1: X(0), y1: Y(0), x2: X(N) + 14, y2: Y(0), class: 's-line', 'marker-end': 'url(#arr)' }), s('line', { x1: X(0), y1: Y(0), x2: X(0), y2: Y(N) - 14, class: 's-line', 'marker-end': 'url(#arr)' }));  // the two axes: a line along the bottom for P and one up the left side for Q, each ending in an arrowhead
            ['A', 'B'].forEach((r, i) => {  // for each resource, with i = 0 for A and 1 for B
              const [pg, pf] = span(Pprog, r), [qg, qf] = span(Qprog, r);  // when P holds it and when Q holds it
              kids.push(s('rect', { x: X(pg - 0.5), y: Y(0) + 6 + i * 10, width: (pf - pg) * u, height: 7, rx: 3, class: RC[r].cls, 'stroke-width': 1 }));  // a thin coloured bar under the x axis showing the steps during which P holds this resource
              kids.push(s('rect', { x: X(0) - 13 - i * 10, y: Y(qf - 0.5), width: 7, height: (qf - qg) * u, rx: 3, class: RC[r].cls, 'stroke-width': 1 }));  // a thin coloured bar beside the y axis showing the steps during which Q holds it
            });  // ends the loop over resources
            Pprog.forEach((e) => kids.push(s('text', { x: X(e.at - 0.5), y: Y(0) + 44, 'text-anchor': 'middle', 'font-size': FS, 'font-weight': 700, style: `fill:var(${RC[e.r].c})` }, (e.ev === 'get' ? 'get ' : 'free ') + e.r)));  // labels under the x axis for each of P's events, such as "get A" or "free B", in that resource's colour
            Qprog.forEach((e) => kids.push(s('text', { x: X(0) - 30, y: Y(e.at - 0.5) + 5, 'text-anchor': 'end', 'font-size': FS, 'font-weight': 700, style: `fill:var(${RC[e.r].c})` }, (e.ev === 'get' ? 'get ' : 'free ') + e.r)));  // labels left of the y axis for each of Q's events
            kids.push(s('text', { x: X(N / 2), y: Y(0) + 70, 'text-anchor': 'middle', 'font-size': FS + 1, 'font-weight': 700 }, 'progress of P →'));  // x axis title: progress of P, to the right
            kids.push(s('text', { x: 16, y: Y(N / 2), 'text-anchor': 'middle', 'font-size': FS + 1, 'font-weight': 700, transform: `rotate(-90 16 ${Y(N / 2)})` }, 'progress of Q →'));  // y axis title: progress of Q, turned on its side to run upward
            kids.push(s('circle', { cx: X(N), cy: Y(N), r: 5, class: 's-ok', 'stroke-width': 2 }), s('text', { x: X(N) + 12, y: Y(N) - 10, 'text-anchor': 'end', 'font-size': FS, class: 's-sub' }, 'both done'));  // a green dot at the top-right corner, where both processes have finished, with the label "both done"
            kids.push(pathLayer, ...top);  // adds the path group, then the labels on top so the path never hides them
            svg.replaceChildren(...kids);  // puts all the shapes into the drawing in one go
          }  // ends drawStatic
          const narr = h('div', { class: 'narr', style: { minHeight: '92px' } });  // narr: the narration box, tall enough that the layout does not jump as messages change
          const status = h('div', { class: 'row gap-s small' });  // status: a row of chips showing where each process is and what it holds
          const bP = h('button', { class: 'btn proc', type: 'button', onclick: () => manual('P') }, 'P runs a step →');  // P's button: P runs one step, moving the path one square to the right
          const bQ = h('button', { class: 'btn proc', type: 'button', onclick: () => manual('Q') }, 'Q runs a step ↑');  // Q's button: Q runs one step, moving the path one square up
          function drawPath() {  // drawPath(): redraws the path so far, its end dot and the status chips
            const [x, y] = path[path.length - 1];  // the current grid point, the last one in the path
            const pts = path.map(([a, b]) => X(a) + ',' + Y(b)).join(' ');  // pts: every point of the path turned into drawing positions, in the "x,y x,y" form a polyline needs
            pathLayer.replaceChildren(  // replaces the old path drawing with
              s('polyline', { points: pts, fill: 'none', style: 'stroke:var(--accent)', 'stroke-width': 4, 'stroke-linejoin': 'round' }),  // the path itself: a thick accent-coloured staircase line through all the points
              s('circle', { cx: X(x), cy: Y(y), r: 7, class: 's-accent', 'stroke-width': 3 }));  // a dot at the current position
            const hp = heldList(Pprog, x), hq = heldList(Qprog, y);  // what P holds now and what Q holds now
            status.replaceChildren(  // refills the status row with
              h('span', { class: 'chip proc' }, `P at ${x}/${N} · holds ${hp.join(' + ') || 'nothing'}`),  // chip: how far P has got out of 10 and what it holds
              h('span', { class: 'chip proc' }, `Q at ${y}/${N} · holds ${hq.join(' + ') || 'nothing'}`),  // chip: how far Q has got out of 10 and what it holds
              fatal[x][y] ? h('span', { class: 'chip bad' }, 'inside the fatal region') : null);  // and a red chip when the current point is inside the fatal region
          }  // ends drawPath
          const evAt = (prog, k) => prog.find((e) => e.at === k);  // evAt(prog, k): the event (get or free) a program performs at step k, if any
          const needNext = (prog, k) => { const e = evAt(prog, k + 1); return e ? e.r : '?'; };  // needNext(prog, k): the resource a process waits for at its next step, or ? if that step needs none
          const fatalCount = () => fatal.reduce((a, col) => a + col.filter(Boolean).length, 0);  // fatalCount(): how many grid points are in the fatal region, quoted in the narration
          // try to run one step of `who`; returns what happened, in words
          function step(who) {  // step(who): tries to run one step of P or Q; returns whether it moved, a message and a tone
            const [x, y] = path[path.length - 1];  // the current grid point
            if (x === N && y === N) return { ok: false, html: 'Both processes have already finished. Press <b>Reset</b> to try another path.', tone: 'ok' };  // both finished: nothing to do, so a green note suggesting Reset
            if (isDead(x, y)) return { ok: false, html: `<b>Deadlock.</b> Nobody can move: P waits for ${needNext(Pprog, x)}, Q waits for ${needNext(Qprog, y)}. Press <b>Undo</b> or <b>Reset</b>.`, tone: 'bad' };  // already at the deadlock point: red note that nobody can move
            const mine = who === 'P' ? x : y, other = who === 'P' ? 'Q' : 'P';  // mine: how far the chosen process has got; other: the name of the other process
            if (mine === N) return { ok: false, html: `${who} has already finished. Only ${other} can run now.`, tone: 'warn' };  // the chosen process has finished: amber note that only the other one can run
            if (!(who === 'P' ? canP(x, y) : canQ(x, y))) {  // the next step would enter a shaded box, so the process has to wait
              const r = needNext(who === 'P' ? Pprog : Qprog, mine);  // r: the resource it needs for that step
              return { ok: false, html: `${who} cannot take step ${mine + 1}: it needs <b>${r}</b>, which ${other} is holding. ${who} blocks until ${other} frees ${r}, so the path cannot enter the shaded box.`, tone: 'warn' };  // amber note: it needs r, the other process holds r, so it blocks and the path cannot enter the box
            }  // ends the blocked case
            const was = fatal[x][y];  // was: whether the point before this move was already in the fatal region
            path.push(who === 'P' ? [x + 1, y] : [x, y + 1]);  // adds the new point: one to the right for P, one up for Q
            const [nx, ny] = path[path.length - 1];  // the new grid point
            const e = evAt(who === 'P' ? Pprog : Qprog, who === 'P' ? nx : ny);  // the event at the new step, if any
            let html = e ? `${who} ${e.ev === 'get' ? 'gets' : 'frees'} <b>${e.r}</b>.` : `${who} runs ordinary code (no resource change).`, tone = '';  // message: which resource was got or freed, or that the step was ordinary code
            if (isDead(nx, ny)) { html += ` <b>Deadlock.</b> P needs ${needNext(Pprog, nx)}, which Q holds; Q needs ${needNext(Qprog, ny)}, which P holds. Neither can ever move again.`; tone = 'bad'; }  // if the move reached the deadlock point: red message naming what each process waits for
            else if (fatal[nx][ny] && !was) { html += ` <b>You just entered the fatal region.</b> Nobody is stuck yet, but P holds ${heldList(Pprog, nx).join(' + ')} and Q holds ${heldList(Qprog, ny).join(' + ')}, and each needs what the other has. Every possible continuation now ends at the ✗.`; tone = 'bad'; }  // if the move just entered the fatal region: red warning that nobody is stuck yet but every future path ends at the ✗
            else if (nx === N && ny === N) { html += ' Both processes finished: this path never entered the fatal region.'; tone = 'ok'; }  // if both have now finished: green note that the path never entered the fatal region
            return { ok: true, html, tone };  // returns the successful move with its message and tone
          }  // ends step
          function show(r) { narrate(narr, r.html, r.tone); drawPath(); const [x, y] = path[path.length - 1]; bP.disabled = x === N; bQ.disabled = y === N; bUndo.disabled = path.length < 2; }  // show(r): writes r's message into the narration box, redraws the path, and enables or disables the buttons
          function manual(who) { gen++; show(step(who)); }  // manual(who): runs when P's or Q's button is clicked; cancels any replay and runs one step
          // a scheduler that alternates P and Q; a blocked process is skipped. lucky=true also steers around the fatal region
          function pick(turn, lucky) {  // pick(turn, lucky): chooses who runs next on this turn, or null if nobody can
            const [x, y] = path[path.length - 1];  // the current grid point
            const opts = (turn % 2 === 0 ? ['P', 'Q'] : ['Q', 'P']).filter((w) => (w === 'P' ? canP(x, y) : canQ(x, y)));  // opts: on even turns P is tried first, on odd turns Q; anyone who cannot move is dropped
            const safe = opts.filter((w) => { const [a, b] = w === 'P' ? [x + 1, y] : [x, y + 1]; return !fatal[a][b]; });  // safe: the options whose next step stays outside the fatal region
            return (lucky && safe.length ? safe : opts)[0] || null;  // a lucky schedule takes a safe option when there is one; otherwise the first option is taken
          }  // ends pick
          async function replay(lucky) {  // replay(lucky): plays a whole schedule from the start, one step every 0.36 seconds
            const g = ++gen;  // a new animation number; a click elsewhere bumps it, which stops this replay
            path = [[0, 0]]; show({ html: lucky ? 'A lucky schedule: the processes take turns, but whenever a turn would step into the red region the other process happens to run instead.' : 'Strict turn-taking: P, Q, P, Q, … A blocked process is skipped.', tone: '' });  // goes back to the start and explains which schedule is playing
            for (let t = 0; t < 2 * N + 2; t++) {  // at most 2N + 2 turns, which is enough for both processes to finish
              await ctx.sleep(360);  // waits 0.36 seconds between moves
              if (!ctx.alive || g !== gen) return;  // stops if the student left the step or started something else
              const who = pick(t, lucky);  // who runs on this turn
              if (!who) return;  // stops if nobody can move (the deadlock point)
              const r = step(who); show(r);  // runs that step and shows what happened
              if (path[path.length - 1][0] === N && path[path.length - 1][1] === N) return;  // stops once both have reached the finish
            }  // ends the loop over turns
          }  // ends replay
          const bUndo = h('button', { class: 'btn sm', type: 'button', onclick: () => { gen++; if (path.length > 1) path.pop(); show({ html: 'Undone: the path is back one step.', tone: '' }); } }, 'Undo');  // Undo button: stops any replay, removes the last point of the path, and says so
          const bReset = h('button', { class: 'btn sm', type: 'button', onclick: () => setVariant(variant) }, 'Reset');  // Reset button: reloads the current variant, which clears the path
          const bUnlucky = h('button', { class: 'btn sm primary', type: 'button', onclick: () => replay(false) }, 'Replay: take turns P, Q, P, Q…');  // button that replays strict turn-taking, which walks into the fatal region
          const bLucky = h('button', { class: 'btn sm', type: 'button', onclick: () => replay(true) }, 'Replay a lucky schedule');  // button that replays the lucky schedule, which steers around it
          function setVariant(v) {  // setVariant(v): switches P's program, recomputes the fatal region, redraws, and restarts the path
            gen++; variant = v; Pprog = VARIANTS[v]; analyse(); drawStatic(); path = [[0, 0]];  // stops any replay, stores the choice, recomputes good and fatal, redraws the fixed parts and resets the path
            const fc = fatalCount();  // fc: how many grid points are fatal in this variant
            show(v === 'together'  // shows a message that depends on the variant
              ? { html: `P takes A, then B, and holds both for a while; Q takes them in the <b>opposite order</b>. The red fatal region has ${fc} grid points. Run the processes yourself, or replay strict turn-taking.`, tone: '' }  // together: P and Q take the resources in opposite orders, and the fatal region has fc points
              : { html: `Now P <b>frees A before it asks for B</b>, so P never holds both. The shaded boxes no longer overlap, so ${fc ? `the fatal region has ${fc} grid points` : 'there is no fatal region and no ✗'}: in every interleaving both finish. Try to get stuck.`, tone: fc ? 'warn' : 'ok' });  // early: P never holds both, so the boxes do not overlap and there is no fatal region; amber if any remains
          }  // ends setVariant
          const variantSeg = ctx.ui.seg([{ value: 'together', label: 'P holds A and B together' }, { value: 'early', label: 'P frees A before getting B' }], 'together', (v) => setVariant(v));  // the switch between the two versions of P's program
          const diagram = h('div', { class: 'card white tight', style: { display: 'grid', placeItems: 'center' } }, svg);  // diagram: the drawing in a white card, centred
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: 'minmax(0, 1fr) 532px', gap: '20px' } },  // builds the layout: two columns, the controls on the left and the 532-unit-wide diagram on the right
            h('div', { class: 'stack', style: { gap: '9px' } },  // left column, stacked top to bottom
              h('p', { class: 'm0', style: { fontSize: '15.5px' }, html: 'In this <span class="t">joint progress diagram</span>, P and Q share one processor and both need resources <b style="color:var(--io)">A</b> and <b style="color:var(--cpu)">B</b>. Each axis shows how far one process has got. Only one process runs at a time, so the run is a <b>staircase</b>: right when P runs, up when Q runs. The path may never enter a shaded box, because there both would hold the same resource.' }),  // explanation of the joint progress diagram: the staircase path and why it may never enter a shaded box
              ctx.narrow ? diagram : null, variantSeg, h('div', { class: 'row gap-s' }, bP, bQ, bUndo, bReset), h('div', { class: 'row gap-s' }, bLucky, bUnlucky), status, narr,  // on phone-width screens the diagram goes here, before the controls; then the switch, the buttons, the status and narration
              h('div', { class: 'row gap-s xs' }, h('span', { class: 'chip bad' }, 'red = fatal region'), h('span', { class: 'chip bad' }, '✗ = deadlock point'), h('span', { class: 'chip accent' }, 'thick line = the path so far')),  // key chips: red means the fatal region, ✗ the deadlock point, the thick line the path so far
              h('div', { class: 'callout why small m0', 'data-label': 'Why it matters', html: 'Deadlock is decided when the path enters the <span class="t">fatal region</span>, before anyone blocks, and whether it gets there depends only on timing. (With two processors the path could also move diagonally; the shaded boxes stay off limits.)' })),  // why-it-matters callout: deadlock is decided on entering the fatal region, and only timing decides that
            ctx.narrow ? null : diagram));  // on wide screens the diagram sits in the right column instead; closes the layout
          setVariant('together');  // starts the step with P holding A and B together, the version that can deadlock
        },  // ends render() for step 3
      },  // closes step 3

      /* ---------------- 4. Reusable resources: you are the scheduler ---------------- */
      {  // step 4: the student acts as the scheduler for two processes that use reusable resources
        title: 'Reusable resources: two locks taken in opposite orders',  // step 4 title, shown at the top of the page
        kind: 'lab',  // kind 'lab': a page where the student experiments
        render(el, ctx) {  // render(el, ctx): builds the code cards, the resource drawing and the controls when step 4 opens
          const { h, s } = ctx;  // takes the HTML builder h and the SVG builder s out of ctx
          let pool = 200;  // pool: the size of the shared memory pool in KB, changed by the slider in the memory example
          // each line: [code, comment, operation]; an operation gets or frees n units of a resource
          const EX = {  // EX: the two examples, each with its starting resources and the five-line programs of P and Q
            devices: {  // example 1: two devices, a scanner and a printer
              caps: () => ({ scanner: 1, printer: 1 }), unit: '',  // caps(): one scanner and one printer to start with; unit is empty because devices are counted whole, not in KB
              P: [['lock(scanner);', 'claim the scanner', { get: 'scanner', n: 1 }], ['lock(printer);', 'now claim the printer too', { get: 'printer', n: 1 }], ['copy_pages();', 'scan each page, print it', null], ['unlock(printer);', 'give the printer back', { free: 'printer', n: 1 }], ['unlock(scanner);', 'give the scanner back', { free: 'scanner', n: 1 }]],  // P's program: lock the scanner, then the printer, copy, then unlock both
              Q: [['lock(printer);', 'claim the printer first', { get: 'printer', n: 1 }], ['lock(scanner);', 'then claim the scanner', { get: 'scanner', n: 1 }], ['print_and_scan();', 'print a form, scan it back', null], ['unlock(scanner);', 'give the scanner back', { free: 'scanner', n: 1 }], ['unlock(printer);', 'give the printer back', { free: 'printer', n: 1 }]],  // Q's program: the same two locks in the opposite order, printer first
            },  // closes the devices example
            memory: {  // example 2: a shared pool of memory
              caps: () => ({ memory: pool }), unit: ' KB',  // caps(): the whole pool is free at the start; it is a function so it reads the slider's latest value
              P: [['request(80 KB);', 'first block of memory', { get: 'memory', n: 80 }], ['build_index();', 'work inside those 80 KB', null], ['request(70 KB);', 'ask for 70 KB more', { get: 'memory', n: 70 }], ['finish_index();', 'work with all 150 KB', null], ['release(150 KB);', 'give it all back', { free: 'memory', n: 150 }]],  // P's program: ask for 80 KB, work, ask for 70 KB more, work, then give all 150 KB back
              Q: [['request(70 KB);', 'first block of memory', { get: 'memory', n: 70 }], ['load_photos();', 'work inside those 70 KB', null], ['request(80 KB);', 'ask for 80 KB more', { get: 'memory', n: 80 }], ['make_album();', 'work with all 150 KB', null], ['release(150 KB);', 'give it all back', { free: 'memory', n: 150 }]],  // Q's program: ask for 70 KB, then 80 KB more, then give all 150 KB back
            },  // closes the memory example
          };  // closes the EX table
          let ex = 'devices', st, gen = 0;  // ex: which example is showing; st: the current run's state; gen is declared but this step never uses it
          const W = ['P', 'Q'];  // W: the names of the two processes, used for looping over both
          const fresh = () => ({ pc: { P: 0, Q: 0 }, blocked: { P: false, Q: false }, held: { P: {}, Q: {} }, free: EX[ex].caps() });  // fresh(): a new run, with both pcs (program counters: which line runs next) at 0, nobody blocked, nothing held
          const curOp = (S, w) => (S.pc[w] < 5 ? EX[ex][w][S.pc[w]][2] : null);  // curOp(S, w): the resource operation on the line process w will run next, or null for a plain line or when finished
          // the engine: one line of `w`; also wakes the other process if a release satisfies its request
          function run(S, w) {  // run(S, w): runs one line of process w in state S; returns whether it ran and whether it woke the other process
            const op = curOp(S, w), out = { ok: true, wake: null };  // op: this line's operation; out: the result, assumed to succeed with nobody woken
            if (op && op.get) {  // a get: the process asks for n units of a resource
              if (S.free[op.get] < op.n) { S.blocked[w] = true; out.ok = false; return out; }  // not enough free units: the process blocks and its pc stays on this line, so it will retry here
              S.free[op.get] -= op.n; S.held[w][op.get] = (S.held[w][op.get] || 0) + op.n;  // enough free: takes the units from the free count and adds them to what this process holds
            } else if (op && op.free) {  // a free: the process gives units back
              S.free[op.free] += op.n; S.held[w][op.free] -= op.n;  // returns them to the free count and removes them from what this process holds
              const o = w === 'P' ? 'Q' : 'P', oop = curOp(S, o);  // o: the other process; oop: the operation it is stuck on
              if (S.blocked[o] && oop && oop.get && S.free[oop.get] >= oop.n) { S.blocked[o] = false; S.free[oop.get] -= oop.n; S.held[o][oop.get] = (S.held[o][oop.get] || 0) + oop.n; S.pc[o]++; out.wake = o; }  // if the other process was blocked on a request that can now be met, it is granted at once, wakes and moves past that line
            }  // ends the get/free cases
            S.pc[w]++;  // moves this process on to its next line
            return out;  // returns the result
          }  // ends run
          const dead = (S) => S.blocked.P && S.blocked.Q;  // dead(S): deadlock in this step means both processes are blocked at the same time
          const heldText = (S, w) => Object.entries(S.held[w]).filter(([, n]) => n > 0).map(([r, n]) => (EX[ex].unit ? n + EX[ex].unit + ' of ' : 'the ') + r).join(' and ') || 'nothing';  // heldText(S, w): what process w holds, in words, such as "the scanner" or "80 KB of memory", or "nothing"
          const askText = (S, w) => { const op = curOp(S, w); return op ? (EX[ex].unit ? op.n + EX[ex].unit : 'the ' + op.get) : ''; };  // askText(S, w): what process w is asking for on its current line, in words
          function randomTrials(n) {  // randomTrials(n): runs the pair n times with a random scheduler and counts how many runs deadlock
            const rng = ctx.util.seeded(61);  // rng: a seeded random-number generator, so the count is the same every time the button is pressed
            let d = 0;  // d counts the deadlocked runs
            for (let t = 0; t < n; t++) {  // for each trial
              const S = fresh();  // starts from a fresh state
              for (let guard = 0; guard < 40; guard++) {  // at most 40 moves per trial, a safety limit that is never reached in practice
                const can = W.filter((w) => S.pc[w] < 5 && !S.blocked[w]);  // can: the processes that are not finished and not blocked
                if (!can.length) break;  // nobody can move: the run is over (finished or deadlocked)
                run(S, can[Math.floor(rng() * can.length)]);  // picks one of them at random and runs its next line
              }  // ends one trial's moves
              if (dead(S)) d++;  // counts the trial if it ended in deadlock
            }  // ends the loop over trials
            return d;  // returns the number of deadlocked runs
          }  // ends randomTrials
          const listing = (w) => EX[ex][w].map(([c, cm]) => c.padEnd(18) + '// ' + cm).join('\n');  // listing(w): process w's program as text, each line followed by its comment, lined up in a column
          const COL = { P: { cls: 's-proc', c: '--proc' }, Q: { cls: 's-thread', c: '--thread' } };  // COL: the colour of each process, P in the process colour and Q in the thread colour
          const cards = {}, codes = {}, chips = {}, btns = {};  // cards, codes, chips, btns: each process's card, code listing, state chip and run button, filled by buildCards
          const codeHost = h('div', { class: 'stack', style: { gap: '10px' } });  // codeHost: the box that holds the two code cards
          function buildCards() {  // buildCards(): builds the two code cards again; called whenever the example changes
            codeHost.replaceChildren(...W.map((w) => {  // replaces the old cards with one new card per process
              codes[w] = ctx.ui.code(listing(w), { lang: 'c', fontSize: 13.5 });  // the code listing, built by the guide's code widget with C colouring
              codes[w].style.flex = 'none';  // stops the listing from stretching or shrinking inside the card
              if (ctx.narrow) codes[w].classList.add('wrap');  // on phone-width screens, long code lines wrap instead of needing sideways scrolling
              chips[w] = h('span', { class: 'chip' });  // the state chip (ready, blocked, deadlocked or finished), filled in by paint()
              btns[w] = h('button', { class: 'btn sm ' + (w === 'P' ? 'proc' : 'thread'), type: 'button', onclick: () => manual(w) }, `Run ${w}’s next line`);  // the run button for this process: runs its next line
              cards[w] = h('div', { class: 'card tight stack', style: { gap: '6px', borderLeft: `5px solid var(${COL[w].c})` } },  // the card: a coloured bar down the left side in the process's colour
                h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', {}, `Process ${w}`), chips[w], btns[w]), codes[w]);  // a header row with the process name, its chip and its button, then the listing below
              return cards[w];  // returns the card to the list
            }));  // closes the list of cards
          }  // ends buildCards
          const svg = s('svg', { viewBox: '0 0 600 130', width: '100%' });  // svg: the resource drawing under the controls, 600 by 130 units
          const fz = (n) => (ctx.narrow ? Math.round(n * 1.4) : n);  // fz(n): label sizes, 1.4 times larger on phone-width screens so they stay readable
          function drawRes() {  // drawRes(): redraws the resource picture from the current state
            const kids = [];  // kids: the shapes of the drawing
            if (ex === 'devices') {  // devices example: one box per device
              ['scanner', 'printer'].forEach((r, i) => {  // for the scanner and the printer, side by side
                const x = 20 + i * 300, who = W.find((w) => st.held[w][r] > 0), waiter = W.find((w) => st.blocked[w] && curOp(st, w).get === r);  // x: the box's left edge; who: the process holding it; waiter: the process blocked waiting for it
                kids.push(s('rect', { x, y: 10, width: 260, height: 84, rx: 14, class: who ? COL[who].cls : 's-panel', 'stroke-width': 2.5 }));  // the device box, coloured in the holder's colour, or plain grey when free
                kids.push(s('text', { x: x + 130, y: 36, 'text-anchor': 'middle', 'font-size': fz(15), class: 's-sub', 'font-weight': 700 }, r));  // the device's name at the top of the box
                kids.push(s('text', { x: x + 130, y: 74, 'text-anchor': 'middle', 'font-size': fz(22), 'font-weight': 800 }, who ? 'held by ' + who : 'free'));  // large text: held by P or Q, or free
                kids.push(s('text', { x: x + 130, y: 120, 'text-anchor': 'middle', 'font-size': fz(14), 'font-weight': 700, style: 'fill:var(--warn)' }, waiter ? waiter + ' is waiting for it' : ''));  // amber line under the box when a process is waiting for this device
              });  // ends the loop over devices
            } else {  // memory example: one bar showing how the pool is shared
              const sc = 560 / pool; let x = 20;  // sc: drawing units per KB, so the whole pool fills a 560-unit bar; x is where the next piece starts
              kids.push(s('text', { x: 20, y: 18, 'font-size': fz(14), 'font-weight': 700 }, `memory pool: ${pool} KB`));  // title above the bar showing the pool size
              W.forEach((w) => { const n = st.held[w].memory || 0; if (n) { kids.push(s('rect', { x, y: 28, width: n * sc, height: 52, class: COL[w].cls, 'stroke-width': 2 }), s('text', { x: x + n * sc / 2, y: 60, 'text-anchor': 'middle', 'font-size': fz(15), 'font-weight': 800 }, `${w}: ${n}`)); x += n * sc; } });  // each process's share of the pool, as a coloured piece of the bar labelled with its KB
              if (st.free.memory) kids.push(s('rect', { x, y: 28, width: st.free.memory * sc, height: 52, class: 's-panel', 'stroke-width': 2 }), s('text', { x: x + st.free.memory * sc / 2, y: 60, 'text-anchor': 'middle', 'font-size': fz(15), 'font-weight': 700, class: 's-sub' }, `free ${st.free.memory}`));  // the free part of the pool as a grey piece labelled "free"
              const waits = W.filter((w) => st.blocked[w]).map((w) => `${w} is waiting for ${curOp(st, w).n} KB`);  // a note for each blocked process saying how many KB it is waiting for
              kids.push(s('text', { x: 300, y: 112, 'text-anchor': 'middle', 'font-size': fz(14), 'font-weight': 700, style: 'fill:var(--warn)' }, waits.join(' · ')));  // shows those notes in amber under the bar
            }  // ends the memory example
            svg.replaceChildren(...kids);  // puts all the shapes into the drawing in one go
          }  // ends drawRes
          function paint() {  // paint(): updates the listings, chips, buttons and drawing to match the current state
            W.forEach((w) => {  // for each process
              const pc = st.pc[w];  // pc: the number of lines it has already run
              codes[w].mark(ctx.util.range(pc).map((k) => k + 1), 'dim');  // greys out the lines already run (line numbers 1 up to pc)
              codes[w].mark(pc < 5 && !st.blocked[w] ? pc + 1 : [], 'nxt');  // highlights the line that will run next, unless the process is blocked or finished
              codes[w].mark(pc < 5 && st.blocked[w] ? pc + 1 : [], 'bad');  // a blocked process's waiting line is marked in red instead
              const dl = dead(st);  // dl: whether both processes are now stuck
              chips[w].className = 'chip ' + (pc === 5 ? 'ok' : dl ? 'bad' : st.blocked[w] ? 'warn' : 'proc');  // chip colour: green finished, red deadlocked, amber blocked, otherwise the process colour
              chips[w].textContent = pc === 5 ? 'finished' : dl ? 'deadlocked' : st.blocked[w] ? 'blocked' : 'ready';  // chip text to match: finished, deadlocked, blocked or ready
              btns[w].disabled = pc === 5;  // a finished process's run button is disabled
            });  // ends the loop over processes
            drawRes();  // redraws the resource picture as well
          }  // ends paint
          const narr = h('div', { class: 'narr', style: { minHeight: '72px' } });  // narr: the narration box, tall enough that the layout does not jump as messages change
          const trialsOut = h('div', { class: 'small', style: { minHeight: '22px' } });  // trialsOut: the line that reports the result of the 1,000 random schedules
          function manual(w) {  // manual(w): runs when a process's run button is clicked; runs its next line and explains what happened
            const o = w === 'P' ? 'Q' : 'P';  // o: the other process
            if (st.pc[w] === 5) return;  // a finished process does nothing
            if (st.blocked[w]) { narrate(narr, `${w} is <b>blocked</b>: it still waits for ${askText(st, w)}, held by ${o}. A blocked process cannot run, so only ${o} can wake it.`, dead(st) ? 'bad' : 'warn'); return; }  // a blocked process cannot run: amber note (red if both are stuck) naming what it waits for and who holds it
            const line = EX[ex][w][st.pc[w]], op = line[2], r = run(st, w);  // line: the line about to run; op: its resource operation; r: the result of running it
            let html, tone = '';  // html and tone: the narration message and its colour, built below
            if (!r.ok) {  // the line could not finish because the resource was not available
              html = `${w} runs <code>${line[0].replace(/;$/, '')}</code>, but ${askText(st, w)} is not available. ${w} <b>blocks</b>, still holding ${heldText(st, w)}.`; tone = 'warn';  // amber message: the process blocks and keeps everything it already holds (hold and wait)
              if (dead(st)) { html = `<b>Deadlock.</b> P holds ${heldText(st, 'P')} and waits for ${askText(st, 'P')}; Q holds ${heldText(st, 'Q')} and waits for ${askText(st, 'Q')}${ex === 'memory' ? `; only ${st.free.memory} KB are free` : ''}. Both are blocked, so neither will ever release anything.`; tone = 'bad'; }  // if both are now blocked, a red deadlock message naming what each holds and waits for (and, for memory, the KB still free)
            } else {  // the line ran
              html = `${w} runs <code>${line[0].replace(/;$/, '')}</code>` + (op && op.get ? ` and gets ${EX[ex].unit ? op.n + ' KB' : 'the ' + op.get}.` : op && op.free ? ` and releases ${EX[ex].unit ? op.n + ' KB' : 'the ' + op.free}.` : '.');  // message: the line ran and, if it was a get or a free, what it got or released
              if (r.wake) html += ` ${r.wake} was waiting for it, so ${r.wake} <b>wakes up</b> and gets what it asked for.`;  // if a release let the other process continue, the message says it woke up
              if (st.pc.P === 5 && st.pc.Q === 5) { html += ' Both processes finished.'; tone = 'ok'; }  // when both have run all five lines, a green note that both finished
            }  // ends the two cases
            narrate(narr, html, tone); paint();  // shows the message and refreshes the screen
          }  // ends manual
          const analysis = h('div', { class: 'small' });  // analysis: the line under the pool slider that says whether this pool size can deadlock
          function analyse() {  // analyse(): works out, for the current pool size, whether deadlock is possible in the memory example
            const first = EX.memory.P[0][2].n + EX.memory.Q[0][2].n, seconds = [EX.memory.P[2][2].n, EX.memory.Q[2][2].n], left = pool - first, safeAt = first + Math.min(...seconds);  // first: KB used if both first requests are granted; seconds: the two second requests; left: what remains; safeAt: the smallest safe pool
            analysis.innerHTML = left < Math.min(...seconds)  // deadlock is possible when what remains is less than the smaller second request
              ? `If both first requests are granted, ${first} KB are in use and only <b>${left} KB</b> remain, less than either second request (${seconds.join(' or ')} KB): <b style="color:var(--bad)">deadlock is possible</b>. A pool of ${safeAt} KB or more would rule it out.`  // red verdict: shows the arithmetic and the pool size that would rule deadlock out
              : `Even if both first requests are granted, <b>${left} KB</b> remain, enough for a second request of ${Math.min(...seconds)} KB: <b style="color:var(--ok)">no deadlock is possible</b> with ${pool} KB.`;  // green verdict: what remains is enough for one second request, so one process can always finish
          }  // ends analyse
          function reset(msg) { st = fresh(); trialsOut.innerHTML = ''; paint(); if (ex === 'memory') analyse(); narrate(narr, msg || 'You are the scheduler. Pick which process runs its next line. Can you find an order that freezes both? An order that lets both finish?'); }  // reset(msg): starts a new run, clears the trials result, refreshes the screen, and shows msg or the opening instructions
          const poolSl = ctx.ui.slider({ label: 'Pool size', min: 150, max: 260, step: 10, value: pool, format: (v) => v + ' KB', onInput: (v) => { pool = v; reset(); } });  // the pool size slider for the memory example (150 to 260 KB in steps of 10); moving it changes the pool and restarts
          const memBox = h('div', { class: 'stack', style: { gap: '6px', display: 'none' } }, poolSl, analysis);  // memBox: the slider and the analysis line, hidden until the memory example is chosen
          const why = h('div', { class: 'callout why small m0', 'data-label': 'Why it matters' });  // why: a why-it-matters callout whose text depends on the example
          const WHY = {  // WHY: the callout text for each example
            devices: 'Neither program is wrong on its own, and plenty of orders let both finish. The freeze needs one particular interleaving: each takes its first lock before the other takes its second. If both always locked the scanner first, no loop could ever form.',  // devices: neither program is wrong alone; only one interleaving freezes, and a shared lock order prevents it
            memory: 'Each process alone fits in the pool. The trap is two <i>partial</i> grants that together leave too little for either to finish. Asking for all 150 KB at once removes the trap, and so does a pool that still covers a second request after both first ones.',  // memory: each fits alone, but two partial grants can starve both; asking for everything or a bigger pool fixes it
          };  // closes the WHY table
          const seg = ctx.ui.seg([{ value: 'devices', label: 'Two devices' }, { value: 'memory', label: 'A memory pool' }], ex, (v) => { ex = v; buildCards(); memBox.style.display = v === 'memory' ? 'flex' : 'none'; why.innerHTML = WHY[v]; reset(); ctx.refit(); });  // example switch: rebuilds the code cards, shows or hides the slider, changes the callout, restarts and re-checks the fit
          const trialsBtn = h('button', { class: 'btn sm', type: 'button', onclick: () => { const d = randomTrials(1000); trialsOut.innerHTML = `A random scheduler ran this pair 1,000 times: <b>${d}</b> runs deadlocked and <b>${1000 - d}</b> finished. Same code, different timing.`; } }, 'Try 1,000 random schedules');  // button that runs 1,000 random schedules and reports how many deadlocked and how many finished
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },  // builds the layout: everything stacked, filling the step
            h('div', { class: 'row', style: { gap: '12px' } }, seg, h('button', { class: 'btn sm', type: 'button', onclick: () => reset() }, 'Reset'), trialsBtn,  // top row: the example switch, Reset, the random-schedules button
              h('span', { class: 'small muted grow', html: 'A <span class="t">reusable resource</span> is used by one process at a time and given back unchanged.' })),  // and a short reminder of what a reusable resource is
            h('div', { class: 'split grow', style: { gridTemplateColumns: 'minmax(0, 500px) minmax(0, 1fr)', gap: '18px' } },  // below it, two columns: code on the left (up to 500 units wide), pictures and messages on the right
              h('div', { class: 'stack', style: { gap: '10px' } }, codeHost, why),  // left column: the two code cards and the why callout
              h('div', { class: 'stack', style: { gap: '8px' } }, h('div', { class: 'card white tight' }, svg), memBox, narr, trialsOut,  // right column: the resource drawing, the memory controls, the narration and the trials result
                h('div', { class: 'card tight small', style: { marginTop: 'auto' }, html: '<b>Reusable resources</b> include processors, I/O channels, main and secondary memory, devices, files, databases and semaphores. In a deadlock over them, each process holds some and waits for more.' })))));  // a card at the bottom listing kinds of reusable resources and the shape of a deadlock over them; closes the layout
          buildCards(); why.innerHTML = WHY[ex]; reset();  // builds the code cards, sets the callout text, and starts the first run
        },  // ends render() for step 4
      },  // closes step 4

      /* ---------------- 5. Consumable resources: messages ---------------- */
      {  // step 5: consumable resources, where two processes wait for messages that are never sent
        title: 'Consumable resources: waiting for a message that never comes',  // step 5 title, shown at the top of the page
        kind: 'explore',  // kind 'explore': a hands-on page to play with
        render(el, ctx) {  // render(el, ctx): builds the code cards, mailboxes, controls and sorting game when step 5 opens
          const { h, s } = ctx;  // takes the HTML builder h and the SVG builder s out of ctx
          // each line: [code, comment, operation]; recv waits for a message from a sender, send creates one, cond branches on a damaged request
          const PROGS = {  // PROGS: three pairs of programs chosen with the mode switch
            bug: {  // mode "bug": both processes receive before they send
              P1: [['Receive(P2, &m);', 'wait for P2’s message', { recv: 'P2' }], ['Send(P2, M1);', 'then send our own', { send: 'P2', msg: 'M1' }]],  // P1: wait for a message from P2, then send M1 to P2
              P2: [['Receive(P1, &m);', 'wait for P1’s message', { recv: 'P1' }], ['Send(P1, M2);', 'then send our own', { send: 'P1', msg: 'M2' }]],  // P2: wait for a message from P1, then send M2 to P1
            },  // closes the bug pair
            fixed: {  // mode "fixed": P1 sends first
              P1: [['Send(P2, M1);', 'send first; no waiting', { send: 'P2', msg: 'M1' }], ['Receive(P2, &m);', 'then wait for a reply', { recv: 'P2' }]],  // P1: send M1 at once, then wait for the reply
              P2: [['Receive(P1, &m);', 'wait for P1’s message', { recv: 'P1' }], ['Send(P1, M2);', 'reply to it', { send: 'P1', msg: 'M2' }]],  // P2: wait for P1's message, then reply
            },  // closes the fixed pair
            rare: {  // mode "rare": a client and a server with a bug hidden in a rarely used branch
              P1: [['Send(P2, req);', 'send a request', { send: 'P2', msg: 'req' }], ['Receive(P2, &ans);', 'wait for the answer', { recv: 'P2' }]],  // client P1: send a request, then wait for the answer
              P2: [['Receive(P1, &req);', 'wait for a request', { recv: 'P1' }], ['if (damaged(req))', 'true only rarely', { cond: true }], ['  Receive(P1, &req);', 'wait for a resend', { recv: 'P1' }], ['Send(P1, ans);', 'send the answer', { send: 'P1', msg: 'ans' }]],  // server P2: receive the request; only if it was damaged, wait for a resend; then send the answer
            },  // closes the rare pair
          };  // closes the PROGS table
          const W = ['P1', 'P2'], other = (w) => (w === 'P1' ? 'P2' : 'P1');  // W: the two process names; other(w): the name of the other process
          let mode = 'bug', st, damage = false;  // mode: which pair is showing; st: the current state; damage: whether the next request will be damaged
          const prog = (w) => PROGS[mode][w];  // prog(w): the program of process w in the current mode
          const fresh = (dmg) => ({ pc: { P1: 0, P2: 0 }, blocked: { P1: false, P2: false }, box: { P1: [], P2: [] }, bad: { P1: false, P2: false }, damageNext: dmg });  // fresh(dmg): a new run with both pcs at 0, nobody blocked, empty mailboxes, and whether the next request gets damaged
          const done = (S, w) => S.pc[w] >= prog(w).length;  // done(S, w): true once process w has run every line of its program
          const take = (S, w, i) => { const m = S.box[w].splice(i, 1)[0]; S.bad[w] = m.bad; S.pc[w]++; return m; };  // take(S, w, i): removes message i from w's mailbox (consuming it), notes if it was damaged, and moves w to its next line
          // the engine: run one line of w; a send wakes the other process if it is blocked waiting for that sender
          function run(S, w) {  // run(S, w): runs one line of process w; returns what happened (blocked, received, sent, woke the other, or branched)
            const op = prog(w)[S.pc[w]][2], out = { ok: true };  // op: this line's operation; out: the result, assumed to succeed
            if (op.recv) {  // a Receive line
              const i = S.box[w].findIndex((m) => m.from === op.recv);  // looks in w's mailbox for a message from the expected sender
              if (i < 0) { S.blocked[w] = true; out.ok = false; return out; }  // none there: the process blocks, staying on this line
              out.got = take(S, w, i);  // found: takes (consumes) the message
            } else if (op.send) {  // a Send line
              const m = { from: w, msg: op.msg, bad: op.msg === 'req' && S.damageNext };  // creates the message; a request is damaged on the way if this run was set to damage it
              if (m.bad) S.damageNext = false;  // only one request per run is damaged
              S.box[op.send].push(m); S.pc[w]++; out.sent = m;  // puts the message into the receiver's mailbox and moves on to the next line
              const o = op.send, oop = !done(S, o) && prog(o)[S.pc[o]][2];  // o: the receiver; oop: the operation the receiver is on, if it has not finished
              if (S.blocked[o] && oop && oop.recv === w) { S.blocked[o] = false; out.wake = take(S, o, S.box[o].length - 1); }  // if the receiver was blocked waiting for a message from this sender, it wakes and takes the new message at once
            } else { out.branch = S.bad[w]; S.pc[w] += S.bad[w] ? 1 : 2; }  // the if line: a damaged request goes to the resend line, an intact one skips over it
            return out;  // returns the result
          }  // ends run
          const dead = (S) => W.every((w) => S.blocked[w] || done(S, w)) && W.some((w) => S.blocked[w]);  // dead(S): deadlock here means every process is blocked or finished, and at least one is blocked
          function trials(n) {  // trials(n): runs the current pair n times with a random scheduler and counts how many runs freeze
            const rng = ctx.util.seeded(7); let d = 0;  // rng: a seeded random-number generator, so the same count comes out every time; d counts frozen runs
            for (let t = 0; t < n; t++) {  // for each trial
              const S = fresh(mode === 'rare' && rng() < 1 / 2000);  // a fresh run; in rare mode, about 1 run in 2,000 gets a damaged request
              for (let g = 0; g < 20; g++) { const can = W.filter((w) => !done(S, w) && !S.blocked[w]); if (!can.length) break; run(S, can[Math.floor(rng() * can.length)]); }  // at most 20 moves: picks a random process that can still run, until nobody can
              if (dead(S)) d++;  // counts the run if it ended in deadlock
            }  // ends the loop over trials
            return d;  // returns the number of frozen runs
          }  // ends trials
          const codes = {}, chips = {}, btns = {};  // codes, chips, btns: each process's code listing, state chip and run button, filled by buildCards
          const codeHost = h('div', { class: 'grid-2', style: { gap: '10px', alignItems: 'start' } });  // codeHost: a two-column grid holding the two code cards side by side
          function buildCards() {  // buildCards(): builds both code cards again; called whenever the mode changes
            codeHost.replaceChildren(...W.map((w) => {  // replaces the old cards with one card per process
              const pad = Math.max(...prog(w).map((l) => l[0].length)) + 1;  // pad: the width of the longest code line plus one, so the comments line up in a column
              codes[w] = ctx.ui.code(prog(w).map(([c, cm]) => c.padEnd(pad) + '// ' + cm).join('\n'), { lang: 'c', fontSize: 12.5 });  // the code listing: each line padded, followed by its comment, with C colouring
              codes[w].style.flex = 'none';  // stops the listing from stretching or shrinking inside the card
              if (ctx.narrow) codes[w].classList.add('wrap');  // on phone-width screens, long lines wrap instead of needing sideways scrolling
              chips[w] = h('span', { class: 'chip' });  // the state chip, filled in by paint()
              btns[w] = h('button', { class: 'btn sm proc', type: 'button', onclick: () => manual(w) }, 'Run ' + w);  // the run button for this process
              return h('div', { class: 'card tight stack', style: { gap: '6px' } }, h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', {}, w === 'P1' ? (mode === 'rare' ? 'P1 (client)' : 'Process P1') : (mode === 'rare' ? 'P2 (server)' : 'Process P2')), chips[w], btns[w]), codes[w]);  // the card: a header with the name (client or server in rare mode), the chip and the button, then the listing
            }));  // closes the list of cards
          }  // ends buildCards
          const svg = s('svg', { viewBox: ctx.narrow ? '0 0 360 250' : '0 0 700 112', width: '100%' });  // svg: the mailbox drawing, wide and short on big screens, taller on phone-width screens where the blocks stack
          // geometry for one process block (its box, then its mailbox): side by side on wide screens, stacked on small ones
          const G = ctx.narrow  // G: the drawing measurements for each layout: block positions, widths, label positions and message sizes
            ? { at: (i) => [6, i * 128], w: 348, name: 20, stt: [70, 27, 15], mb: [60, 58], mbl: 78, msg: [86, 100, 26, 106, 104, 15], empty: 106, fs: 14 }  // phone-width layout: the two blocks stacked one above the other, with larger text
            : { at: (i) => [i ? 450 : 10, 0], w: 240, name: 16, stt: [12, 45, 13], mb: [62, 46], mbl: 77, msg: [82, 72, 22, 78, 98, 13], empty: 99, fs: 12.5 };  // wide layout: P1's block on the left and P2's on the right
          function drawBoxes() {  // drawBoxes(): redraws each process box and its mailbox from the current state
            const kids = ctx.narrow ? [] : [  // kids: the shapes; on wide screens it starts with two arrows between the blocks
              s('line', { x1: 262, y1: 30, x2: 436, y2: 30, class: 's-line', 'marker-end': 'url(#arr)' }), s('line', { x1: 436, y1: 52, x2: 262, y2: 52, class: 's-line', 'marker-end': 'url(#arr)' }),  // one arrow from P1 to P2 and one back, showing messages can travel both ways
              s('text', { x: 350, y: 22, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, 'Send puts a new message'), s('text', { x: 350, y: 72, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, 'into the other’s mailbox')];  // the caption between the arrows: Send puts a new message into the other's mailbox
            W.forEach((w, i) => {  // for each process, with i = 0 for P1 and 1 for P2
              const [x, y0] = G.at(i), stt = done(st, w) ? 'finished' : st.blocked[w] ? 'blocked: waits for ' + other(w) : 'ready', [my, mx, mh, step, ty, mf] = G.msg;  // x, y0: the block's corner; stt: its state in words; the msg values size and place the message tiles
              kids.push(s('rect', { x, y: y0 + 4, width: G.w, height: 50, rx: 12, class: st.blocked[w] ? 's-warn' : done(st, w) ? 's-ok' : 's-proc', 'stroke-width': 2 }));  // the process box, amber when blocked, green when finished, otherwise the process colour
              kids.push(s('text', { x: x + 12, y: y0 + (ctx.narrow ? 36 : 26), 'font-size': G.name, 'font-weight': 800 }, w), s('text', { x: x + G.stt[0], y: y0 + (ctx.narrow ? 35 : G.stt[1]), 'font-size': G.stt[2], 'font-weight': 600 }, stt));  // the process name and its state written inside the box
              kids.push(s('rect', { x, y: y0 + G.mb[0], width: G.w, height: G.mb[1], rx: 10, class: 's-panel', 'stroke-width': 1.5, 'stroke-dasharray': '5 4' }));  // the mailbox: a dashed grey box under the process box
              kids.push(s('text', { x: x + 8, y: y0 + G.mbl, 'font-size': G.fs, class: 's-sub' }, w + '’s mailbox'));  // the label "P1's mailbox" or "P2's mailbox"
              st.box[w].forEach((m, k) => kids.push(s('rect', { x: x + 8 + k * step, y: y0 + my, width: mx, height: mh, rx: 6, class: m.bad ? 's-bad' : 's-mem', 'stroke-width': 1.5 }), s('text', { x: x + 8 + mx / 2 + k * step, y: y0 + ty, 'text-anchor': 'middle', 'font-size': mf, 'font-weight': 700 }, m.msg + (m.bad ? ' ✗' : '') + ' ← ' + m.from)));  // one tile per waiting message, red if damaged, labelled with the message and its sender
              if (!st.box[w].length) kids.push(s('text', { x: x + G.w / 2, y: y0 + G.empty, 'text-anchor': 'middle', 'font-size': G.fs + 0.5, class: 's-sub' }, 'empty'));  // "empty" in the middle of a mailbox that holds no messages
            });  // ends the loop over processes
            svg.replaceChildren(...kids);  // puts all the shapes into the drawing in one go
          }  // ends drawBoxes
          function paint() {  // paint(): updates the listings, chips, buttons and mailbox drawing to match the current state
            const dl = dead(st);  // dl: whether the pair is deadlocked
            W.forEach((w) => {  // for each process
              const pc = st.pc[w], n = prog(w).length;  // pc: the number of lines already run; n: the program's length
              codes[w].mark(ctx.util.range(Math.min(pc, n)).map((k) => k + 1), 'dim');  // greys out the lines already run
              codes[w].mark(pc < n && !st.blocked[w] ? pc + 1 : [], 'nxt');  // highlights the next line, unless the process is blocked or finished
              codes[w].mark(pc < n && st.blocked[w] ? pc + 1 : [], 'bad');  // a blocked process's Receive line is marked in red instead
              chips[w].className = 'chip ' + (pc >= n ? 'ok' : dl && st.blocked[w] ? 'bad' : st.blocked[w] ? 'warn' : 'proc');  // chip colour: green finished, red deadlocked, amber blocked, otherwise the process colour
              chips[w].textContent = pc >= n ? 'finished' : dl && st.blocked[w] ? 'deadlocked' : st.blocked[w] ? 'blocked' : 'ready';  // chip text to match: finished, deadlocked, blocked or ready
              btns[w].disabled = pc >= n;  // a finished process's run button is disabled
            });  // ends the loop over processes
            drawBoxes();  // redraws the mailboxes as well
          }  // ends paint
          const narr = h('div', { class: 'narr', style: { minHeight: '68px' } });  // narr: the narration box, tall enough that the layout does not jump as messages change
          const trialsOut = h('span', { class: 'small' });  // trialsOut: where the result of the 10,000 random schedules appears
          function manual(w) {  // manual(w): runs when a process's run button is clicked; runs its next line and explains what happened
            if (done(st, w)) return;  // a finished process does nothing
            if (st.blocked[w]) { narrate(narr, `${w} is blocked inside Receive. Only a message from ${other(w)} can wake it.`, dead(st) ? 'bad' : 'warn'); return; }  // a blocked process cannot run: amber note (red if deadlocked) that only a message from the other can wake it
            const line = prog(w)[st.pc[w]][0].trim().replace(/;$/, ''), r = run(st, w);  // line: the code about to run, tidied for display; r: the result of running it
            let html, tone = '';  // html and tone: the narration message and its colour, built below
            if (!r.ok) html = `${w} runs <code>${line}</code>, but no message from ${other(w)} is waiting. ${w} <b>blocks</b> until ${other(w)} sends one.`, tone = 'warn';  // blocked in Receive: amber message that no message from the other is waiting yet
            else if (r.got) html = `${w} receives <b>${r.got.msg}</b>${r.got.bad ? ' (damaged)' : ''}. Taking it <b>consumes</b> it: the message no longer exists anywhere.`;  // received: the message was taken, which consumes it
            else if (r.sent) html = `${w} sends <b>${r.sent.msg}</b>${r.sent.bad ? ', which is garbled on the way' : ''}. Sending <b>creates</b> a new message, waiting in ${other(w)}’s mailbox.` + (r.wake ? ` ${other(w)} was blocked waiting for it, so it wakes and consumes it at once.` : '');  // sent: a new message was created in the other's mailbox (garbled if damaged), and maybe woke the other process
            else html = r.branch ? 'P2 checks the request: it is <b>damaged</b>, so P2 takes the rare branch and waits for P1 to send it again.' : 'P2 checks the request: it arrived intact, so P2 skips the rare branch.';  // the if line: P2 found the request damaged and takes the rare branch, or found it intact and skips it
            if (dead(st)) {  // if this move left the pair deadlocked
              tone = 'bad';  // the narration turns red
              html = mode === 'rare' ? '<b>Deadlock.</b> P2 waits for a resend that P1 will never send, because P1 is itself waiting for P2’s answer. This only happens when a request is damaged, so ordinary testing almost never finds it.'  // rare mode: P2 waits for a resend P1 never sends, and ordinary testing almost never hits this
                : '<b>Deadlock.</b> P1 waits for a message from P2, and P2 waits for one from P1. Each sends only after it receives, so the message each needs is never created.';  // other modes: each process sends only after it receives, so neither message is ever created
            } else if (W.every((x) => done(st, x))) { html += ' Both processes finished.'; tone = 'ok'; }  // if both have finished, a green note says so
            narrate(narr, html, tone); paint();  // shows the message and refreshes the screen
          }  // ends manual
          function reset() { st = fresh(damage); trialsOut.innerHTML = ''; paint(); narrate(narr, mode === 'bug' ? 'Each process waits to hear from the other before it says anything. Run them in any order you like.' : mode === 'fixed' ? 'Now P1 sends before it receives. Try every order you can think of.' : 'A client and a server. The server has an extra branch for a damaged request. Choose whether the next request is damaged, then run.'); }  // reset(): starts a new run (with the damage setting), clears the trials result, and shows instructions for the mode
          const dmgSeg = ctx.ui.seg([{ value: false, label: 'request arrives intact' }, { value: true, label: 'request gets damaged' }], damage, (v) => { damage = v; reset(); });  // the intact or damaged switch for the rare mode; changing it restarts the run
          const dmgRow = h('div', { class: 'row gap-s' }, h('span', { class: 'small b' }, 'This run:'), dmgSeg);  // dmgRow: that switch with its label, shown only in rare mode
          const trialsBtn = h('button', { class: 'btn sm', type: 'button', onclick: () => { const d = trials(10000); trialsOut.innerHTML = mode === 'rare' ? `With 1 request in 2,000 damaged: <b>${d}</b> of 10,000 random runs froze.` : `<b>${d.toLocaleString('en-US')}</b> of 10,000 random runs froze.`; } }, 'Run 10,000 random schedules');  // button that runs 10,000 random schedules and reports how many froze
          const modeSeg = ctx.ui.seg([{ value: 'bug', label: 'Both receive first' }, { value: 'fixed', label: 'P1 sends first' }, { value: 'rare', label: 'Bug on a rare branch' }], mode, (v) => { mode = v; dmgRow.style.display = v === 'rare' ? 'flex' : 'none'; buildCards(); reset(); ctx.refit(); });  // the mode switch: shows the damage row only in rare mode, rebuilds the code cards, restarts and re-checks the fit
          // sorting mini-game: reusable (0) or consumable (1)?
          const ITEMS = [  // ITEMS: the sorting game's cards, each as [item, 0 for reusable or 1 for consumable, explanation]
            ['The printer', 0, 'One process uses it at a time, then it is free for the next. Printing does not use the printer up.'],  // item: the printer (reusable)
            ['A message sitting in a mailbox', 1, 'The receiver takes it and it is gone. The sender can always create another.'],  // item: a message in a mailbox (consumable)
            ['A keystroke waiting in the keyboard buffer', 1, 'Data in an I/O buffer is produced by the device and consumed when a process reads it.'],  // item: a keystroke in the keyboard buffer (consumable)
            ['A block of main memory', 0, 'A process holds it for a while and releases it; the same memory is then reused.'],  // item: a block of main memory (reusable)
            ['An interrupt from the disk controller', 1, 'The device produces it, the OS handles it, and then it no longer exists.'],  // item: an interrupt from a device (consumable)
            ['A file a process has locked for writing', 0, 'Locking does not use the file up; it is released for the next process.'],  // item: a file locked for writing (reusable)
            ['A semaphore used as a lock', 0, 'A process holds the lock and later releases it. The semaphore itself is never used up.'],  // item: a semaphore used as a lock (reusable)
            ['A signal sent to wake a process', 1, 'It is created when sent and disappears once the receiver has taken it.'],  // item: a wake-up signal (consumable)
            ['The processor', 0, 'Each process gets it for a while and gives it back; it is the classic reusable resource.'],  // item: the processor (reusable)
          ];  // closes the ITEMS list
          let k = 0, right = 0;  // k: which item is showing; right: how many the student got right
          const gTitle = h('div', { class: 'b', style: { fontSize: '16.5px', minHeight: '46px' } });  // gTitle: the box that shows the current item's name
          const gFb = h('div', { class: 'small', style: { minHeight: '58px' } });  // gFb: the feedback line under the buttons
          const gScore = h('span', { class: 'chip accent' });  // gScore: the chip showing the score and item number
          const gB = [0, 1].map((b) => h('button', { class: 'btn sm ' + (b ? 'mem' : 'io'), type: 'button', onclick: () => guess(b) }, b ? 'Consumable' : 'Reusable'));  // the two answer buttons, Reusable and Consumable
          const gNext = h('button', { class: 'btn sm primary', type: 'button', onclick: () => { k++; if (k >= ITEMS.length) { k = 0; right = 0; } showItem(); } }, 'Next');  // Next button: moves to the next item, or starts over with a zero score after the last one
          function showItem() {  // showItem(): shows the current item and gets the buttons ready for an answer
            gTitle.textContent = ITEMS[k][0];  // writes the item's name
            gFb.innerHTML = '<span class="muted">Reusable or consumable? Decide, then click.</span>';  // a grey prompt to decide before clicking
            gB.forEach((b) => { b.disabled = false; }); gNext.disabled = true;  // enables both answer buttons and disables Next until the student has answered
            gScore.textContent = `${right} right · item ${k + 1} of ${ITEMS.length}`;  // updates the score chip: right answers so far and which item this is
          }  // ends showItem
          function guess(b) {  // guess(b): runs when an answer button is clicked; b is 0 for reusable or 1 for consumable
            const [, ans, why] = ITEMS[k], ok = b === ans;  // ans: the correct answer; why: its explanation; ok: whether the student was right
            if (ok) right++;  // adds one to the score when right
            gFb.innerHTML = `<b style="color:var(${ok ? '--ok' : '--bad'})">${ok ? 'Right' : 'Not quite'}: ${ans ? 'consumable' : 'reusable'}.</b> ${why}`;  // feedback: Right in green or Not quite in red, the correct answer, and why
            gB.forEach((x) => { x.disabled = true; }); gNext.disabled = false;  // locks both answer buttons and enables Next
            gNext.textContent = k === ITEMS.length - 1 ? 'Play again' : 'Next';  // on the last item the Next button reads Play again
            gScore.textContent = `${right} right · item ${k + 1} of ${ITEMS.length}`;  // updates the score chip
          }  // ends guess
          const leftCol = h('div', { class: 'stack', style: { gap: '10px' } },  // leftCol: the left column of step 5, stacked top to bottom
            h('p', { class: 'm0', style: { fontSize: '15.5px' }, html: 'A <span class="t">consumable resource</span> is <b>created</b> by one process and <b>destroyed</b> when another takes it. There is no fixed supply: a producer can make as many as it likes. Examples: interrupts, signals, messages and data in I/O buffers.' }),  // explanation of consumable resources: created by one process, destroyed when taken, no fixed supply
            h('div', { class: 'card stack', style: { gap: '8px' } },  // the sorting game card
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'Sort it'), gScore),  // its header: the title "Sort it" and the score chip
              gTitle, h('div', { class: 'row gap-s' }, ...gB, gNext), gFb),  // the item name, the answer and Next buttons, and the feedback line
            h('div', { class: 'callout warn small m0', 'data-label': 'Common mistake' }, 'Thinking deadlock needs locks. Processes that only exchange messages can deadlock too, if each insists on receiving before it sends. That is a design error, and it may show up only rarely.'));  // common-mistake callout: deadlock can happen with messages alone, no locks needed; closes the left column
          showItem();  // shows the first sorting item
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: 'minmax(0, 320px) minmax(0, 1fr)', gap: '20px' } },  // builds the layout: two columns, the 320-unit-wide left column and the message simulation on the right
            leftCol,  // the left column built above
            h('div', { class: 'stack', style: { gap: '9px' } },  // right column, stacked top to bottom
              h('div', { class: 'row gap-s' }, modeSeg, h('button', { class: 'btn sm', type: 'button', onclick: reset }, 'Reset')),  // the mode switch and a Reset button
              codeHost, h('div', { class: 'card white tight' }, svg), narr, dmgRow, h('div', { class: 'row gap-s' }, trialsBtn, trialsOut))));  // the code cards, the mailbox drawing, the narration, the damage row, and the random-schedules button with its result
          dmgRow.style.display = 'none'; buildCards(); reset();  // hides the damage row (bug mode is first), builds the code cards and starts the first run
        },  // ends render() for step 5
      },  // closes step 5

      /* ---------------- 6. Resource allocation graph builder ---------------- */
      {  // step 6: the student builds a resource allocation graph and the page tests it for deadlock
        title: 'Build a resource allocation graph and test it for deadlock',  // step 6 title, shown at the top of the page
        kind: 'lab',  // kind 'lab': a page where the student experiments
        core: true,  // core: marks this as one of the section's key steps
        render(el, ctx) {  // render(el, ctx): builds the graph drawing, the request buttons and the verdict when step 6 opens
          const { h, s } = ctx;  // takes the HTML builder h and the SVG builder s out of ctx
          const PROCS = ['P1', 'P2', 'P3'], UNITS = { R1: 1, R2: 2, R3: 1 }, RES = Object.keys(UNITS);  // three processes, and three resource types: R1 with 1 unit, R2 with 2 units, R3 with 1 unit
          // drawing geometry: a large layout, and a tighter one with bigger relative text for small screens
          const GM = ctx.narrow  // GM: drawing measurements for each layout: canvas size, node positions, shape sizes and font sizes
            ? { vb: '0 0 360 350', pos: { P1: [44, 62], P2: [316, 62], P3: [180, 300], R1: [180, 62], R2: [250, 185], R3: [100, 185] }, pr: 24, rw: 28, du: 18, rh: 46, dr: 5.5, fR: 15, fSub: 13.5, fP: 18, fSt: 14, up: 32, dn: 42 }  // phone-width layout: a smaller canvas with nodes closer together
            : { vb: '0 0 620 440', pos: { P1: [110, 78], P2: [510, 78], P3: [310, 380], R1: [310, 78], R2: [450, 250], R3: [170, 250] }, pr: 30, rw: 34, du: 22, rh: 56, dr: 6.5, fR: 14, fSub: 12.5, fP: 18, fSt: 13, up: 40, dn: 50 };  // wide layout: a larger canvas
          const POS = GM.pos;  // POS: the centre of each process circle and resource square
          let owner, reqs;  // owner: for each resource, who holds each unit (null = free); reqs: the waiting requests
          const blank = () => { owner = {}; RES.forEach((r) => { owner[r] = Array(UNITS[r]).fill(null); }); reqs = []; };  // blank(): every unit free and nobody waiting
          const freeOf = (r) => owner[r].filter((x) => x === null).length;  // freeOf(r): how many units of r are free
          const heldBy = (p, r) => owner[r].filter((x) => x === p).length;  // heldBy(p, r): how many units of r process p holds
          const waiting = (p) => reqs.find((q) => q.p === p);  // waiting(p): the request process p is blocked on, if any (a process waits for at most one thing)
          const PRESETS = {  // PRESETS: four ready-made graphs, each listing which units are held by whom and who is waiting for what
            empty: { hold: [], ask: [] },  // preset "empty": nothing held, nobody waiting
            two: { hold: [['R1', 'P1'], ['R3', 'P2']], ask: [['P1', 'R3'], ['P2', 'R1']] },  // preset "two": P1 holds R1 and wants R3, P2 holds R3 and wants R1, a two-process deadlock
            ok: { hold: [['R1', 'P2'], ['R2', 'P1'], ['R2', 'P3']], ask: [['P1', 'R1'], ['P2', 'R2']] },  // preset "ok": a cycle through a two-unit resource, but P3 can finish, so no deadlock
            three: { hold: [['R1', 'P2'], ['R2', 'P1'], ['R2', 'P3']], ask: [['P1', 'R1'], ['P2', 'R2'], ['P3', 'R1']] },  // preset "three": the same, but P3 also waits for R1, so all three are stuck
          };  // closes the PRESETS table
          function load(name) { blank(); PRESETS[name].hold.forEach(([r, p]) => { owner[r][owner[r].indexOf(null)] = p; }); PRESETS[name].ask.forEach(([p, r]) => reqs.push({ p, r })); }  // load(name): clears the graph, gives out each held unit, then adds each waiting request
          // analysis: a cycle in the graph, and graph reduction (who can finish, in what order)
          function analyse() {  // analyse(): finds a cycle and runs graph reduction; returns the cycle, who finishes in what order, and who is stuck
            const edges = new Map();  // edges: the graph's arrows, from each node to the nodes it points at
            [...PROCS, ...RES].forEach((n) => edges.set(n, []));  // starts every process and resource with no arrows
            reqs.forEach((q) => edges.get(q.p).push(q.r));  // a request edge: from the waiting process to the resource it wants
            RES.forEach((r) => owner[r].forEach((p) => { if (p && !edges.get(r).includes(p)) edges.get(r).push(p); }));  // an assignment edge: from the resource to each process holding a unit of it (listed once per process)
            const cyc = findCycle([...PROCS, ...RES], edges);  // asks the shared findCycle helper for a loop through processes and resources
            const avail = {}; RES.forEach((r) => { avail[r] = freeOf(r); });  // avail: free units of each resource, which grow as reduction pretends processes finish
            const order = [], steps = [], left = PROCS.slice();  // order: the processes that can finish, in order; steps: details for the trace; left: those not yet picked
            for (let changed = true; changed;) {  // repeats the passes until a whole pass picks nobody
              changed = false;  // assume this pass picks nobody, until it does
              for (const p of left.slice()) {  // tries each process not yet picked (a copy of the list, since picked ones are removed)
                const q = waiting(p);  // q: the request this process is waiting on, if any
                if (q && avail[q.r] < 1) continue;  // skips a process whose request cannot be met by the free units yet
                const freed = RES.filter((r) => heldBy(p, r) > 0);  // freed: the resources this process holds
                freed.forEach((r) => { avail[r] += heldBy(p, r); });  // pretends it finishes: every unit it holds goes back to the free count
                steps.push({ p, need: q ? q.r : null, freed });  // records the step for the trace: who finished, what it needed, what it freed
                order.push(p); left.splice(left.indexOf(p), 1); changed = true;  // adds it to the finishing order, removes it from the left-over list, and asks for another pass
              }  // ends the loop over remaining processes
            }  // ends the passes
            return { cyc, order, steps, stuck: left };  // returns the cycle (or null), the order, the trace, and the stuck processes (those never picked)
          }  // ends analyse
          const svg = s('svg', { viewBox: GM.vb, width: '100%', role: 'img', 'aria-label': 'Resource allocation graph' });  // svg: the graph drawing, sized for the current layout
          const RW = (r) => GM.rw + GM.du * UNITS[r], RH = GM.rh;  // RW(r): a resource square's width grows with its number of units; RH: every square's height
          const dotXY = (r, i) => [POS[r][0] - (UNITS[r] - 1) * GM.du / 2 + i * GM.du, POS[r][1] + GM.rh / 9];  // dotXY(r, i): the position of unit dot i inside resource r's square, the dots spread evenly in a row
          const unitV = (ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1; return [dx / L, dy / L]; };  // unitV: the direction from one point to another as a unit step (length 1), used to trim arrow ends
          function rectHit(r, fx, fy) { const [cx, cy] = POS[r], dx = fx - cx, dy = fy - cy; const k = Math.min(dx ? (RW(r) / 2 + 3) / Math.abs(dx) : 1e9, dy ? (RH / 2 + 3) / Math.abs(dy) : 1e9); return [cx + dx * k, cy + dy * k]; }  // rectHit(r, fx, fy): where a line from a point toward resource r first meets the edge of its square, so arrows stop at the border
          function draw(A) {  // draw(A): redraws the whole graph using the analysis A
            const inCyc = (a, b) => { if (!A.cyc) return false; const n = A.cyc.length; for (let i = 0; i < n; i++) if (A.cyc[i] === a && A.cyc[(i + 1) % n] === b) return true; return false; };  // inCyc(a, b): true when the arrow from a to b is part of the cycle found (the list wraps round at the end)
            const kids = [], edgeKids = [];  // kids: all the shapes; edgeKids: the arrows, which are drawn first so the nodes sit on top
            RES.forEach((r) => owner[r].forEach((p, i) => {  // for every unit of every resource
              if (!p) return;  // a free unit has no arrow
              const [dx, dy] = dotXY(r, i), [px, py] = POS[p], [ux, uy] = unitV(dx, dy, px, py), c = inCyc(r, p);  // from the unit's dot to the process holding it; c says whether this arrow is on the cycle
              edgeKids.push(s('line', { x1: dx, y1: dy, x2: px - ux * (GM.pr + 7), y2: py - uy * (GM.pr + 7), class: 's-line', style: c ? 'stroke:var(--bad)' : '', 'stroke-width': c ? 3.5 : 2.5, 'marker-end': c ? 'url(#arr-bad)' : 'url(#arr)' }));  // assignment edge: a solid arrow from the dot to the process circle, red and thicker if on the cycle
            }));  // ends the loop over units
            reqs.forEach((q) => {  // for every waiting request
              const [px, py] = POS[q.p], [ux, uy] = unitV(px, py, POS[q.r][0], POS[q.r][1]), [ex, ey] = rectHit(q.r, px, py), c = inCyc(q.p, q.r);  // from the process circle toward the resource square, ending at the square's border
              edgeKids.push(s('line', { x1: px + ux * (GM.pr + 1), y1: py + uy * (GM.pr + 1), x2: ex - ux * 6, y2: ey - uy * 6, class: 's-line', style: `stroke:var(${c ? '--bad' : '--warn'})`, 'stroke-width': c ? 3.5 : 2.5, 'stroke-dasharray': '8 5', 'marker-end': `url(#arr-${c ? 'bad' : 'warn'})` }));  // request edge: a dashed amber arrow from the process to the resource, red and thicker if on the cycle
            });  // ends the loop over requests
            kids.push(...edgeKids);  // adds all the arrows first
            RES.forEach((r) => {  // for each resource
              const [x, y] = POS[r], c = A.cyc && A.cyc.includes(r);  // its centre, and whether it is on the cycle
              kids.push(s('rect', { x: x - RW(r) / 2, y: y - RH / 2, width: RW(r), height: RH, rx: 6, class: 's-io', style: c ? 'stroke:var(--bad)' : '', 'stroke-width': c ? 3.5 : 2.5 }));  // the resource square, with a red outline if on the cycle
              kids.push(s('text', { x, y: y - GM.rh / 6, 'text-anchor': 'middle', 'font-size': GM.fR, 'font-weight': 800 }, r));  // the resource name near the top of the square
              owner[r].forEach((p, i) => { const [dx, dy] = dotXY(r, i); kids.push(s('circle', { cx: dx, cy: dy, r: GM.dr, style: p ? 'fill:var(--ink)' : 'fill:var(--panel)', class: p ? '' : 's-line' })); });  // one dot per unit: filled dark when held, hollow when free
              const lp = r === 'R1' ? [x, y - RH / 2 - 9, 'middle'] : r === 'R2' ? [x + RW(r) / 2 + 8, y + 5, 'start'] : [x - RW(r) / 2 - 8, y + 5, 'end'];  // lp: where the unit count label goes, above R1, right of R2, left of R3, so it never sits on an arrow
              kids.push(s('text', { x: lp[0], y: lp[1], 'text-anchor': lp[2], 'font-size': GM.fSub, class: 's-sub' }, ctx.narrow ? `${freeOf(r)}/${UNITS[r]} free` : `${UNITS[r]} unit${UNITS[r] > 1 ? 's' : ''} · ${freeOf(r)} free`));  // the label: units and how many are free, shortened to "1/2 free" on phone-width screens
            });  // ends the loop over resources
            PROCS.forEach((p) => {  // for each process
              const [x, y] = POS[p], dl = A.stuck.includes(p), wt = waiting(p);  // its centre; dl: whether reduction left it stuck; wt: the request it waits on, if any
              kids.push(s('circle', { cx: x, cy: y, r: GM.pr, class: dl ? 's-bad' : wt ? 's-warn' : 's-proc', 'stroke-width': A.cyc && A.cyc.includes(p) ? 4 : 2.5 }));  // the process circle: red if deadlocked, amber if waiting, otherwise the process colour; thicker if on the cycle
              kids.push(s('text', { x, y: y + 6, 'text-anchor': 'middle', 'font-size': GM.fP, 'font-weight': 800 }, p));  // the process name in the middle of the circle
              kids.push(s('text', { x, y: p === 'P3' ? y + GM.dn : y - GM.up, 'text-anchor': 'middle', 'font-size': GM.fSt, 'font-weight': 700, style: `fill:var(${dl ? '--bad' : wt ? '--warn' : '--muted'})` }, dl ? 'deadlocked' : wt ? 'blocked' : 'can run'));  // its state above the circle (below for P3): deadlocked, blocked or can run, in a matching colour
            });  // ends the loop over processes
            svg.replaceChildren(...kids);  // puts all the shapes into the drawing in one go
          }  // ends draw
          const narr = h('div', { class: 'narr' });  // narr: the narration box that explains the last action
          const verdict = h('div', { class: 'card tight', style: { fontSize: '14.5px', lineHeight: 1.45 } });  // verdict: the card that says whether there is a deadlock and shows the reduction trace
          const rows = {};  // rows: for each process, its state chip and buttons
          const ctl = h('div', { class: 'stack', style: { gap: '6px' } }, ...PROCS.map((p) => {  // ctl: the control panel, one row per process
            rows[p] = { chip: h('span', { class: 'chip', style: { minWidth: '74px', justifyContent: 'center' } }) };  // the state chip, at least 74 pixels wide so the row does not jump as its text changes
            rows[p].btns = RES.map((r) => h('button', { class: 'btn sm', type: 'button', onclick: () => ask(p, r) }, 'ask ' + r));  // one "ask" button per resource: the process requests one unit of it
            rows[p].fin = h('button', { class: 'btn sm ok', type: 'button', style: { color: 'var(--ok)', borderColor: 'var(--ok)' }, onclick: () => finish(p) }, 'finish');  // a green finish button: the process ends and frees everything it holds
            return h('div', { class: 'row gap-s' }, h('b', { style: { width: '26px' } }, p), rows[p].chip, ...rows[p].btns, rows[p].fin);  // the row: process name, chip, ask buttons and finish button
          }));  // closes the control panel
          const list = (a) => a.join(', ').replace(/, ([^,]*)$/, ' and $1');  // list(a): joins names in plain English, such as "P1, P2 and P3"
          function update() {  // update(): re-analyses the graph, redraws it, refreshes the controls and rewrites the verdict
            const A = analyse();  // A: the cycle and the reduction result
            draw(A);  // redraws the graph
            PROCS.forEach((p) => {  // for each process
              const w = waiting(p), dl = A.stuck.includes(p);  // w: its waiting request; dl: whether it is stuck
              rows[p].chip.className = 'chip ' + (dl ? 'bad' : w ? 'warn' : 'proc');  // chip colour: red if deadlocked, amber if waiting, otherwise the process colour
              rows[p].chip.textContent = w ? 'waits ' + w.r : RES.some((r) => heldBy(p, r)) ? 'holds ' + RES.filter((r) => heldBy(p, r)).join('+') : 'idle';  // chip text: what it waits for, what it holds, or idle
              rows[p].btns.forEach((b) => { b.disabled = !!w; }); rows[p].fin.disabled = !!w;  // a waiting (blocked) process cannot ask for more or finish, so its buttons are disabled
            });  // ends the loop over processes
            const trace = A.steps.map((t, i) => `${i + 1}. <b>${t.p}</b> ${t.need ? `gets ${t.need}` : 'needs nothing more'}, finishes${t.freed.length ? ', frees ' + t.freed.join(' + ') : ''}`).join('<br>');  // trace: the reduction written step by step, such as "1. P3 needs nothing more, finishes, frees R2"
            const cycTxt = A.cyc ? A.cyc.concat(A.cyc[0]).join(' → ') : '';  // cycTxt: the cycle written out with its first node repeated at the end, such as P1 → R3 → P2 → R1 → P1
            const single = A.cyc && A.cyc.filter((n) => RES.includes(n)).every((r) => UNITS[r] === 1);  // single: true when every resource on the cycle has only one unit
            let head;  // head: the first line of the verdict
            if (A.stuck.length) head = `<b style="color:var(--bad)">Deadlock: ${list(A.stuck)} can never finish.</b> Cycle ${cycTxt}.` + (single ? ' Every resource on this cycle has one unit, so the cycle alone proves deadlock.' : ' Reduction gets stuck: no blocked process can have its request met.');  // someone is stuck: red verdict naming them, plus why (single units, or reduction got stuck)
            else if (A.cyc) head = `<b style="color:var(--warn)">A cycle, but no deadlock.</b> Cycle ${cycTxt}. A resource on it has more than one unit, and a unit is held by a process that can still finish.`;  // a cycle but nobody stuck: amber verdict that a multi-unit resource lets the cycle break
            else head = '<b style="color:var(--ok)">No cycle, so no deadlock.</b>';  // no cycle: green verdict that there is no deadlock
            const tail = A.stuck.length ? `${A.steps.length ? '<br>Then nobody else' : 'Nobody'} can be picked: ${list(A.stuck)} stay${A.stuck.length > 1 ? '' : 's'} blocked.` : '';  // tail: for a deadlock, a closing line of the trace saying nobody else can be picked
            verdict.innerHTML = head + (reqs.length ? `<div class="small" style="margin-top:4px"><b>Reduction:</b><br>${trace}${tail}</div>` : '');  // writes the verdict, adding the reduction trace whenever some process is waiting
          }  // ends update
          function ask(p, r) {  // ask(p, r): runs when an ask button is clicked; process p requests one unit of resource r
            if (waiting(p)) return;  // a waiting process cannot ask for more (its buttons are disabled anyway)
            if (heldBy(p, r) === UNITS[r]) { narrate(narr, `${p} already holds every unit of ${r}. Asking again would mean waiting for itself.`, 'warn'); return; }  // asking for a resource it already holds completely would mean waiting for itself, so it is refused with a note
            const i = owner[r].indexOf(null);  // i: the first free unit of r, or -1 if none
            if (i >= 0) { owner[r][i] = p; narrate(narr, `A unit of ${r} was free, so the OS grants it at once: an <span class="t">assignment edge</span> from that dot to ${p}.`, 'ok'); }  // a free unit: granted at once, which draws an assignment edge; green note
            else { reqs.push({ p, r }); narrate(narr, `No unit of ${r} is free, so ${p} <b>blocks</b>: a dashed <span class="t">request edge</span> from ${p} to ${r}.`, 'warn'); }  // no free unit: the process blocks, which draws a request edge; amber note
            update();  // re-analyses and redraws
          }  // ends ask
          function finish(p) {  // finish(p): runs when a finish button is clicked; process p ends and frees everything it holds
            if (waiting(p)) return;  // a waiting process cannot finish
            const freed = RES.filter((r) => heldBy(p, r) > 0);  // freed: the resources it held, for the message
            RES.forEach((r) => { owner[r] = owner[r].map((x) => (x === p ? null : x)); });  // frees every unit it held
            const woke = [];  // woke: the requests granted because of this
            reqs.slice().forEach((q) => { const i = owner[q.r].indexOf(null); if (i >= 0) { owner[q.r][i] = q.p; reqs.splice(reqs.indexOf(q), 1); woke.push(`${q.p} gets ${q.r}`); } });  // each waiting request that now finds a free unit gets it and stops waiting
            narrate(narr, `${p} finishes${freed.length ? ' and releases ' + list(freed) : ''}.${woke.length ? ' Waiting requests are granted: ' + list(woke) + '.' : ''}`, 'ok');  // green note: what was released and which waiting requests were granted
            update();  // re-analyses and redraws
          }  // ends finish
          const presets = [['empty', 'Empty'], ['two', 'Two-process cycle'], ['ok', 'Cycle, no deadlock'], ['three', 'Three stuck']];  // presets: the preset buttons' keys and labels
          const preBtns = presets.map(([k, label]) => h('button', { class: 'btn sm', type: 'button', onclick: () => pick(k) }, label));  // one button per preset
          const MSG = { empty: 'An empty graph. Use the buttons: “ask” requests one unit, “finish” ends a process and frees everything it holds.', two: 'Each resource has a single unit. P1 holds R1 and wants R3; P2 holds R3 and wants R1.', ok: 'R2 has two units, held by P1 and P3. There is a cycle through P1, R1, P2 and R2. Is anyone really stuck? Try finishing P3.', three: 'The same cycle, but now P3 also waits (for R1). Every unit of R2 is held by a blocked process.' };  // MSG: the narration shown when each preset is loaded, describing its graph and what to try
          function pick(k) { preBtns.forEach((b, i) => b.classList.toggle('on', presets[i][0] === k)); load(k); narrate(narr, MSG[k]); update(); }  // pick(k): highlights the chosen preset button, loads that graph, shows its message and redraws
          el.append(h('div', { class: 'split fill', style: { gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 530px)', gap: '18px' } },  // builds the layout: the graph on the left, the controls in a column up to 530 units wide on the right
            h('div', { class: 'card white tight', style: { display: 'grid', placeItems: 'center' } }, svg),  // left: the graph drawing, centred in a white card
            h('div', { class: 'stack', style: { gap: '8px' } },  // right column, stacked top to bottom
              h('p', { class: 'm0 small', html: 'In a <span class="t">resource allocation graph</span>, circles are processes; squares are resources, one dot per unit. Solid arrow from a dot: <span class="t">assignment edge</span> (held). Dashed arrow: <span class="t">request edge</span> (waiting). Verdict by <span class="t">graph reduction</span>.' }),  // a key to the drawing: circles, squares, dots, solid and dashed arrows, and how the verdict is reached
              h('div', { class: 'row gap-s' }, ...preBtns), ctl, narr, verdict,  // the preset buttons, the per-process controls, the narration and the verdict
              h('div', { class: 'callout warn small m0', style: { marginTop: 'auto' }, 'data-label': 'Common mistake' }, '“A cycle means deadlock” holds only when each resource on the cycle has a single unit. With more units, a cycle is necessary but not sufficient.'))));  // common-mistake callout: a cycle proves deadlock only when every resource on it has one unit; closes the layout
          pick('two');  // starts with the two-process cycle loaded
        },  // ends render() for step 6
      },  // closes step 6

      /* ---------------- 7. The four conditions ---------------- */
      {  // step 7: the four conditions, where switching one off makes deadlock impossible
        title: 'The four conditions: switch one off and deadlock is impossible',  // step 7 title, shown at the top of the page
        kind: 'learn',  // kind 'learn': a page that teaches a concept
        render(el, ctx) {  // render(el, ctx): builds the two tabs (switch conditions off, and diagnose designs) when step 7 opens
          const { h, s } = ctx;  // takes the HTML builder h and the SVG builder s out of ctx
          const CONDS = [  // CONDS: the four conditions, each as [name, glossary key, short meaning, what happens when it is ruled out]
            ['Mutual exclusion', 'mutual exclusion', 'Only one process at a time may use a resource unit.', 'Suppose both devices could be <b>shared</b>, like a read-only file: P and Q use them at once. Nobody waits, so nobody can wait forever. (Real printers cannot be shared, which is why this condition is hard to remove.)'],  // condition 1: mutual exclusion; ruled out, both devices are shared and nobody waits
            ['Hold and wait', 'hold and wait', 'A process keeps what it holds while it waits for more.', 'P must get <b>everything at once</b>. It receives both devices together; Q, holding nothing, simply waits its turn. A waiter that holds nothing cannot block anyone.'],  // condition 2: hold and wait; ruled out, P gets both devices at once and Q waits holding nothing
            ['No preemption', 'no preemption', 'Nothing is taken back by force; holders release voluntarily.', 'Now the OS <b>may take a resource back</b>. It takes the scanner from Q and gives it to P. P finishes; Q asks again later and loses only some work.'],  // condition 3: no preemption; ruled out, the OS takes the scanner from Q and gives it to P
            ['Circular wait', 'circular wait', 'A closed chain exists: each process waits for a resource the next one holds.', 'Resources are <b>numbered</b> and must be requested in increasing order: printer (1) before scanner (2). Q must also ask for the printer first, so it waits holding nothing and no loop can close.'],  // condition 4: circular wait; ruled out, devices are numbered and requested in rising order
          ];  // closes the CONDS list
          const on = [true, true, true, true];  // on: whether each condition currently holds; all four start switched on
          const svg = s('svg', { viewBox: '0 0 560 234', width: '100%' });  // svg: the small graph of P, Q, the printer and the scanner
          const P = [80, 118], Q = [480, 118], R = [280, 38], S = [280, 196];  // where each node sits: P on the left, Q on the right, the printer (R) on top, the scanner (S) below
          function edge(a, b, kind, extra) {  // edge(a, b, kind, extra): an arrow from node a to node b; kind 'cyc' is a red loop arrow, 'req' an amber wait arrow
            const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, ra = 34, rb = 36;  // the direction as a unit step, and how far to trim each end (34 units at the start, 36 at the arrowhead) so the arrow stops at the edge of each circle or box
            const col = kind === 'cyc' ? '--bad' : kind === 'req' ? '--warn' : '--ink-2';  // colour: red for a loop arrow, amber for a wait, dark ink for an ordinary held-by arrow
            return s('line', Object.assign({ x1: a[0] + ux * ra, y1: a[1] + uy * ra, x2: b[0] - ux * rb, y2: b[1] - uy * rb, class: 's-line', style: `stroke:var(${col})`, 'stroke-width': kind === 'cyc' ? 3.5 : 2.5, 'marker-end': kind === 'cyc' ? 'url(#arr-bad)' : kind === 'req' ? 'url(#arr-warn)' : 'url(#arr)' }, kind === 'req' || (extra && extra.dash) ? { 'stroke-dasharray': '8 5' } : {}));  // the line with a matching arrowhead, thicker for loop arrows and dashed for waits
          }  // ends edge
          const fz = (n) => (ctx.narrow ? Math.round(n * 1.35) : n);  // fz(n): label sizes, 1.35 times larger on phone-width screens
          function draw() {  // draw(): redraws the graph and the verdict for whichever conditions are switched on
            const off = on.indexOf(false), kids = [];  // off: the first condition switched off (-1 if all four hold); kids: the shapes
            let E;  // E: the arrows to draw in this situation
            if (off < 0) E = [[R, P, 'cyc'], [P, S, 'cyc', { dash: 1 }], [S, Q, 'cyc'], [Q, R, 'cyc', { dash: 1 }]];  // all four hold: the printer held by P, P waiting for the scanner, the scanner held by Q, Q waiting for the printer, all red
            else if (off === 0) E = [[R, P], [R, Q], [S, P], [S, Q]];  // mutual exclusion off: both devices are shared, so both point to both processes
            else if (off === 1) E = [[R, P], [S, P], [Q, R, 'req']];  // hold and wait off: P holds both devices and Q waits for the printer, holding nothing
            else if (off === 2) E = [[R, P], [S, P], [Q, S, 'req']];  // no preemption off: P holds both (the scanner was taken from Q) and Q waits for the scanner
            else E = [[R, P], [Q, R, 'req']];  // circular wait off: P holds the printer and Q must also ask for the printer first, so it waits
            E.forEach(([a, b, k, x]) => kids.push(edge(a, b, k, x)));  // draws each of those arrows
            [[P, 'P'], [Q, 'Q']].forEach(([p, n]) => kids.push(s('circle', { cx: p[0], cy: p[1], r: 32, class: off < 0 ? 's-bad' : 's-proc', 'stroke-width': 2.5 }), s('text', { x: p[0], y: p[1] + 7, 'text-anchor': 'middle', 'font-size': fz(20), 'font-weight': 800 }, n)));  // the two process circles with their names, red when deadlocked
            [[R, 'printer', '1'], [S, 'scanner', '2']].forEach(([p, n, num]) => {  // for each device, with its number for the ordering rule
              kids.push(s('rect', { x: p[0] - 52, y: p[1] - 26, width: 104, height: 52, rx: 8, class: 's-io', 'stroke-width': 2.5 }), s('text', { x: p[0], y: p[1] + 6, 'text-anchor': 'middle', 'font-size': fz(16), 'font-weight': 800 }, n));  // the device box and its name
              if (off === 3) kids.push(s('text', { x: p[0] + 62, y: p[1] + 6, 'font-size': fz(15), 'font-weight': 800, style: 'fill:var(--accent)' }, '#' + num));  // when circular wait is ruled out, each device shows its number (#1, #2) beside its box
            });  // ends the loop over devices
            if (off === 0) kids.push(s('text', { x: 280, y: 124, 'text-anchor': 'middle', 'font-size': fz(14), 'font-weight': 700, style: 'fill:var(--ok)' }, 'both devices shared'));  // mutual exclusion ruled out: a green note "both devices shared" in the middle
            if (off === 2) (ctx.narrow ? ['scanner taken', 'back from Q'] : ['scanner taken from Q']).forEach((l, i) => kids.push(s('text', { x: 470, y: 190 + i * 22, 'text-anchor': 'middle', 'font-size': fz(14), 'font-weight': 700, style: 'fill:var(--intr)' }, l)));  // no preemption ruled out: a note that the scanner was taken back from Q, split over two lines on phone-width screens
            if (off < 0) kids.push(s('text', { x: 280, y: 124, 'text-anchor': 'middle', 'font-size': fz(14), 'font-weight': 700, style: 'fill:var(--bad)' }, 'closed loop of waits'));  // all four hold: a red note "closed loop of waits" in the middle
            svg.replaceChildren(...kids);  // puts all the shapes into the drawing in one go
            const offNames = CONDS.filter((c, i) => !on[i]).map((c) => c[0].toLowerCase());  // offNames: the names of every condition switched off, in lowercase for the sentence
            verdict.className = 'narr ' + (off < 0 ? 'bad' : 'ok');  // the verdict box turns red for a deadlock and green otherwise
            verdict.innerHTML = off < 0  // writes the verdict
              ? '<b>All four hold, so this is a deadlock.</b> P holds the printer and wants the scanner; Q holds the scanner and wants the printer. Neither will ever continue.'  // all four hold: who holds what and who wants what, so neither will continue
              : `<b>Deadlock is impossible:</b> the ${offNames.map((n) => '“' + n + '”').join(', ').replace(/, ([^,]*)$/, ' and $1')} condition${offNames.length > 1 ? 's' : ''} can no longer hold. ${CONDS[off][3]}${offNames.length > 1 ? ' (The picture shows the first one.)' : ''}`;  // otherwise: names the conditions ruled out and explains the first one (the one the picture shows)
            cards.forEach((c, i) => { c.btn.textContent = on[i] ? 'holds' : 'ruled out'; c.btn.className = 'btn sm ' + (on[i] ? 'intr' : 'ok on'); c.btn.setAttribute('aria-pressed', String(!on[i])); c.card.style.opacity = on[i] ? 1 : 0.7; });  // updates each card: its button reads holds or ruled out, changes colour, reports its pressed state to screen readers, and fades when off
          }  // ends draw
          const verdict = h('div', { class: 'narr' });  // verdict: the narration box under the graph
          const cards = CONDS.map((c, i) => {  // cards: one card per condition, each with an on/off button
            const btn = h('button', { class: 'btn sm', type: 'button', style: { minWidth: '92px' }, onclick: () => { on[i] = !on[i]; draw(); } });  // the button flips that condition on or off and redraws
            const card = h('div', { class: 'card tight row nw', style: { gap: '10px', justifyContent: 'space-between' } },  // the card: text on the left, button on the right, kept on one line
              h('div', { style: { minWidth: 0 } }, h('div', { class: 'b', html: `${i + 1}. <span class="t" data-t="${c[1]}">${c[0]}</span>${i < 3 ? ' <span class="chip os">policy</span>' : ' <span class="chip intr">event</span>'}` }), h('div', { class: 'small muted' }, c[2])), btn);  // the number, the condition's name as a glossary term, a policy or event chip, the short meaning, then the button
            return { btn, card };  // returns the button and the card, so draw() can update both
          });  // closes the cards list
          // tab 2: which condition does each design rule out?
          const SCEN = [  // SCEN: six designs for the second tab, each as [description, index of the right answer in CH, explanation]
            ['Every process must ask for all the resources it will ever need in one request, and it starts only when the OS can grant all of them together.', 1, 'A process never holds some resources while waiting for others, so <b>hold and wait</b> cannot occur.'],  // design 1: ask for everything in one request; rules out hold and wait
            ['Each lock has a number. A thread may only ask for a lock whose number is higher than every lock it already holds.', 3, 'Waits can only point “uphill” to higher numbers, so a chain of waits can never loop back: no <b>circular wait</b>.'],  // design 2: numbered locks taken in rising order; rules out circular wait
            ['Two threads each lock mutex A and mutex B, in opposite orders. Only the thread that locked a mutex can unlock it.', 4, 'All four can hold: exclusive locks, holding one while waiting for the other, no forced release, and opposite orders that can close a loop. <b>Deadlock is possible.</b>'],  // design 3: two mutexes in opposite orders; rules out nothing, so deadlock is possible
            ['Any number of processes may read the same read-only file at once; nobody ever needs it to themselves.', 0, 'Shared access means nobody waits for the file, so it cannot be part of a deadlock: <b>mutual exclusion</b> is absent.'],  // design 4: a shared read-only file; rules out mutual exclusion
            ['When a process is refused a resource, the OS makes it give back everything it holds; later it must ask for all of it again.', 2, 'Resources are effectively taken back from a waiting process, so <b>no preemption</b> no longer holds.'],  // design 5: give everything back when refused; rules out no preemption
            ['When an urgent process needs a memory frame held by another, the OS saves that frame’s contents to disk and hands the frame over.', 2, 'The OS takes the frame away by force. This works because memory contents can be saved and restored: <b>no preemption</b> is ruled out.'],  // design 6: the OS saves a memory frame to disk and takes it; also rules out no preemption
          ];  // closes the SCEN list
          const CH = ['Mutual exclusion', 'Hold and wait', 'No preemption', 'Circular wait', 'None: deadlock is possible'];  // CH: the five answer choices, the four conditions and "none"
          const SHORT = ['Ask for everything at once', 'Numbered locks, rising order', 'Two mutexes, opposite orders', 'A shared read-only file', 'Give everything back when refused', 'A memory frame taken back'];  // SHORT: a short name for each design, used in the "Your answers" list
          let si = 0, score = 0, results = [];  // si: which design is showing; score: right answers so far; results: right or wrong for each design answered
          const resList = h('div', { class: 'stack', style: { gap: '6px' } });  // resList: the "Your answers" list on the right
          function drawResults() {  // drawResults(): rebuilds the answers list
            resList.replaceChildren(...SCEN.map((sc, i) => {  // one row per design
              const r = results[i];  // r: true, false, or empty if not yet answered
              return h('div', { class: 'row nw', style: { gap: '8px', padding: '7px 10px', borderRadius: '10px', background: i === si ? 'var(--accent-bg)' : 'var(--panel-2)', border: '1px solid var(--line)' } },  // the row, highlighted when it is the design now showing
                h('span', { class: 'b', style: { width: '18px' } }, String(i + 1)), h('span', { class: 'grow small' }, SHORT[i]),  // the design's number and short name
                r == null ? h('span', { class: 'chip' }, i === si ? 'now' : '—') : h('span', { class: 'chip ' + (r ? 'ok' : 'bad') }, (r ? '✓ ' : '✗ ') + CH[sc[1]].replace(': deadlock is possible', '')));  // a chip: now or a dash if unanswered, otherwise ✓ or ✗ with the correct condition
            }));  // closes the rows
          }  // ends drawResults
          const sText = h('p', { class: 'm0', style: { fontSize: '17.5px', lineHeight: 1.5, minHeight: '80px' } });  // sText: the box showing the current design's description in large text
          const sFb = h('div', { class: 'narr', style: { minHeight: '70px' } });  // sFb: the feedback narration under the answer buttons
          const sScore = h('span', { class: 'chip accent' });  // sScore: the chip showing the design number and the score
          const sBtns = CH.map((c, i) => h('button', { class: 'btn sm', type: 'button', onclick: () => answer(i) }, c));  // one answer button per choice in CH
          const sNext = h('button', { class: 'btn sm primary', type: 'button', onclick: () => { si = (si + 1) % SCEN.length; if (!si) { score = 0; results = []; } showScen(); } }, 'Next design');  // Next design button: moves on, and after the last design starts over with the score cleared
          function showScen() {  // showScen(): shows the current design and gets the buttons ready for an answer
            sText.textContent = SCEN[si][0];  // writes the description
            sBtns.forEach((b) => { b.disabled = false; b.classList.remove('on'); });  // enables every answer button and clears any highlight
            sNext.disabled = true;  // disables Next until the student answers
            narrate(sFb, 'Which of the four conditions does this design rule out? Pick one, or say none is ruled out.');  // prompt in the feedback box
            sScore.textContent = `design ${si + 1} of ${SCEN.length} · ${score} right`;  // updates the score chip
            drawResults();  // refreshes the answers list
          }  // ends showScen
          function answer(i) {  // answer(i): runs when an answer button is clicked; i is the chosen choice
            const [, ans, why] = SCEN[si], ok = i === ans;  // ans: the right answer; why: its explanation; ok: whether the student was right
            if (ok) score++;  // adds one to the score when right
            sBtns.forEach((b, j) => { b.disabled = true; b.classList.toggle('on', j === ans); });  // locks the buttons and highlights the correct one
            sNext.disabled = false; sNext.textContent = si === SCEN.length - 1 ? 'Start over' : 'Next design';  // enables Next, which reads Start over on the last design
            narrate(sFb, (ok ? '<b>Right.</b> ' : `<b>Not quite: the answer is “${CH[ans]}”.</b> `) + why, ok ? 'ok' : 'bad');  // green feedback when right, or red with the correct answer, followed by the explanation
            sScore.textContent = `design ${si + 1} of ${SCEN.length} · ${score} right`;  // updates the score chip
            results[si] = ok; drawResults();  // records the result and refreshes the answers list
          }  // ends answer
          const tabs = ctx.ui.tabs([  // tabs: the guide's tab widget with two tabs; each tab's render builds its panel when first shown
            { label: 'Switch them off', render: (p) => {  // tab 1, "Switch them off": the condition cards and the small graph
              p.append(h('div', { class: 'split', style: { gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '18px', height: 'auto' } },  // two equal columns, as tall as their content
                h('div', { class: 'stack', style: { gap: '7px' } }, ...cards.map((c) => c.card),  // left: the four condition cards
                  h('div', { class: 'callout why small m0', 'data-label': 'Necessary vs sufficient', html: 'Conditions 1–3 are <b>policies</b>. Each is a <span class="t">necessary condition</span>: without it, no deadlock. Yet all three can hold for years with no deadlock, so they are not sufficient. Condition 4 is an <b>event</b> that may happen as processes run; given 1–3, a circular wait that cannot be broken <i>is</i> a deadlock. All four together are necessary <i>and</i> a <span class="t">sufficient condition</span>.' })),  // why callout: conditions 1 to 3 are necessary but not sufficient; all four together are sufficient
                h('div', { class: 'stack', style: { gap: '8px' } }, h('div', { class: 'card white tight' }, svg), verdict,  // right: the graph and the verdict
                  h('div', { class: 'row gap-s xs' }, h('span', { class: 'chip' }, 'solid arrow: held by'), h('span', { class: 'chip warn' }, 'dashed arrow: waiting for')),  // key chips: solid arrow means held by, dashed means waiting for
                  h('p', { class: 'small muted m0' }, 'Click “holds” on a card to rule that condition out.'))));  // a hint to click "holds" on a card; closes the tab's layout
              draw();  // draws the graph for the starting state
            } },  // ends tab 1
            { label: 'Which one is ruled out?', render: (p) => {  // tab 2, "Which one is ruled out?": the design diagnosis game
              p.append(h('div', { class: 'split', style: { gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 360px)', gap: '20px', height: 'auto' } },  // two columns: the game on the left and the answers list (up to 360 units wide) on the right
                h('div', { class: 'stack', style: { gap: '12px' } },  // left column, stacked
                  h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { class: 'm0' }, 'Diagnose the design'), sScore),  // heading "Diagnose the design" with the score chip
                  h('div', { class: 'card white' }, sText), h('div', { class: 'row gap-s' }, ...sBtns), sFb, h('div', { class: 'row' }, sNext),  // the description card, the answer buttons, the feedback and the Next button
                  h('div', { class: 'callout tip small m0', 'data-label': 'Coming up', html: 'Ruling out one condition by design is called <span class="t">deadlock prevention</span> (section 6.2). Each choice above has a price, which the next step compares.' })),  // coming-up callout: ruling out a condition by design is deadlock prevention, covered in section 6.2
                h('div', { class: 'stack', style: { gap: '8px' } }, h('h4', { class: 'm0' }, 'Your answers'), resList)));  // right column: the "Your answers" heading and the list; closes the tab's layout
              showScen();  // shows the first design
            } },  // ends tab 2
          ]);  // closes the tabs list
          el.append(h('div', { class: 'fill' }, tabs));  // puts the tabs on the page, filling the step
        },  // ends render() for step 7
      },  // closes step 7

      /* ---------------- 8. Three ways to respond ---------------- */
      {  // step 8: compare the three ways an OS can respond to deadlock
        title: 'Three ways an OS can respond: prevent, avoid, or detect',  // step 8 title, shown at the top of the page
        kind: 'compare',  // kind 'compare': a page that sets choices side by side
        render(el, ctx) {  // render(el, ctx): builds the approach buttons, the detail card and the comparison table when step 8 opens
          const { h } = ctx;  // takes the HTML builder h out of ctx
          const A = [  // A: the three approaches, each with its name, glossary key, colour, tag, section and descriptions
            { key: 'prev', name: 'Prevention', term: 'deadlock prevention', cls: 'os', tag: 'conservative', where: 'Section 6.2',  // approach 1: prevention, the conservative one, covered in section 6.2
              policy: 'Design the system so one of the four conditions can never hold. It <b>undercommits</b> resources: it plays safe and leaves some idle.',  // its policy: rule out a condition by design, leaving resources idle
              when: 'Rules are fixed in advance; the OS only checks that each request obeys them.',  // when it acts: rules fixed in advance, each request is checked against them
              needs: 'No knowledge of the future, but every process must follow the rules.',  // what it needs: no knowledge of the future, but every process must obey the rules
              moment: 'With numbered resources, both jobs must ask for the printer (#1) before the scanner (#2). Q can never hold the scanner while it waits for the printer, so the loop cannot form.',  // the shared example: numbered devices force the printer before the scanner, so no loop
              schemes: [  // its schemes for the comparison table, each as [name, advantage, disadvantage]
                ['Ask for all at once', 'Suits a process that does one burst of work; nothing is taken back', 'Resources sit idle, starts are delayed, needs must be known'],  // prevention scheme: ask for all at once, simple but leaves resources idle and delays starts
                ['Preemption', 'Easy when a resource’s state can be saved (processor, memory)', 'Takes resources back more often than needed'],  // prevention scheme: preemption, easy only when a resource's state can be saved
                ['Resource ordering', 'Checkable when the program is compiled; no run-time cost', 'Cannot ask for resources in the order the work needs them'],  // prevention scheme: resource ordering, checked before the program runs but forces a fixed request order
              ] },  // closes prevention's schemes and the prevention entry
            { key: 'avoid', name: 'Avoidance', term: 'deadlock avoidance', cls: 'cpu', tag: 'midway', where: 'Section 6.3',  // approach 2: avoidance, the midway one, covered in section 6.3
              policy: 'Rule out no condition in advance. Instead, check each request: grant it only if, afterwards, there is still at least one order in which every process can finish; otherwise the process waits.',  // its policy: grant a request only if every process could still finish afterwards
              when: 'At every single request, while the system runs.',  // when it acts: at every request, while the system runs
              needs: 'Each process must declare its <b>maximum future claim</b> on every resource in advance.',  // what it needs: each process's maximum future claim, declared in advance
              moment: 'P asks for the scanner, which is free. Before granting it, the OS checks whether, after the grant, everyone could still finish given their declared maximums. If not, P waits, even though the scanner is idle.',  // the shared example: P may have to wait for the scanner even though it is idle
              schemes: [  // its schemes for the comparison table
                ['Safe-state check per request', 'No preemption: nothing is ever taken away', 'Needs future maximum claims; processes may wait long'],  // avoidance scheme: a safe-state check per request, needing no preemption but needing maximum claims
              ] },  // closes avoidance's schemes and the avoidance entry
            { key: 'detect', name: 'Detection and recovery', term: 'deadlock detection', cls: 'io', tag: 'very liberal', where: 'Section 6.4',  // approach 3: detection and recovery, the very liberal one, covered in section 6.4
              policy: 'Grant every request that can be granted. From time to time, look for a deadlock, and if one has formed, break it.',  // its policy: grant freely, check from time to time, break any deadlock found
              when: 'Periodically, for example every few minutes or when the processor sits idle.',  // when it acts: periodically, such as every few minutes or when the processor is idle
              needs: 'A detection algorithm, such as the graph reduction you ran, and a recovery plan.',  // what it needs: a detection algorithm like the graph reduction of step 6, and a recovery plan
              moment: 'P gets the scanner at once. If a loop forms later, the next check finds it, and the OS recovers: it aborts a process or takes a resource away and rolls its holder back.',  // the shared example: P gets the scanner at once, and a later check finds and breaks any loop
              schemes: [  // its schemes for the comparison table
                ['Periodic detection check', 'Never delays a process from starting; handled on-line', 'Recovery loses work: aborted or preempted processes'],  // detection scheme: a periodic check that never delays a start but loses work on recovery
              ] },  // closes detection's schemes and the detection entry
          ];  // closes the A list
          let cur = 0;  // cur: which approach is showing, recorded by show()
          const detail = h('div', { class: 'stack', style: { gap: '7px' } });  // detail: the card describing the chosen approach
          const moment = h('div', { class: 'callout analogy small m0', 'data-label': 'P holds the printer and asks for the scanner' });  // moment: an example callout showing what the chosen approach does when P holds the printer and asks for the scanner
          const table = h('div');  // table: the box that holds the comparison table
          const btns = A.map((a, i) => h('button', { class: 'btn ' + a.cls, type: 'button', style: { flex: 1, fontSize: '16px' }, onclick: () => show(i) }, a.name));  // one large button per approach, in that approach's colour, sharing the row equally
          function show(i) {  // show(i): shows approach i in the detail card, the example and the table
            cur = i; const a = A[i];  // records the choice and picks out its entry
            btns.forEach((b, j) => b.classList.toggle('on', j === i));  // marks only the chosen button as on
            detail.replaceChildren(  // refills the detail card with
              h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', { class: 'm0', html: `<span class="t" data-t="${a.term}">${a.name}</span>` }), h('span', { class: 'chip ' + a.cls }, a.tag + ' · ' + a.where)),  // a heading with the approach's name as a glossary term, and a chip with its tag and section
              h('p', { class: 'm0', style: { fontSize: '16px' }, html: a.policy }),  // the policy paragraph
              h('div', { class: 'small', html: `<b>When it acts:</b> ${a.when} <b>What it needs:</b> ${a.needs}` }));  // a small line saying when it acts and what it needs
            moment.innerHTML = a.moment;  // fills in the example callout
            table.replaceChildren(h('table', { class: 'tbl compact cmp' },  // rebuilds the comparison table
              h('thead', {}, h('tr', {}, h('th', {}, 'Approach'), h('th', {}, 'Scheme'), h('th', {}, 'Main advantage'), h('th', {}, 'Main disadvantage'))),  // heading row: Approach, Scheme, Main advantage, Main disadvantage
              h('tbody', {}, ...A.flatMap((g, gi) => g.schemes.map(([n, plus, minus], k) => h('tr', { class: gi === i ? 'on' : '' },  // one row per scheme of every approach; the chosen approach's rows are highlighted
                h('td', { class: 'b grp' + (k < g.schemes.length - 1 ? ' cont' : ''), style: { color: `var(--${g.cls})` } }, k === 0 ? g.name.split(' ')[0] : ''),  // first cell: the approach's first word in its colour, only on its first row; cont hides the line between its rows
                h('td', { class: 'b' }, n), h('td', {}, h('span', { style: { color: 'var(--ok)', fontWeight: 800 } }, '+ '), plus), h('td', {}, h('span', { style: { color: 'var(--bad)', fontWeight: 800 } }, '− '), minus)))))));  // the scheme name, its advantage after a green plus, and its disadvantage after a red minus; closes the table
            [detail, moment].forEach((x) => { x.classList.remove('fade-in'); void x.offsetWidth; x.classList.add('fade-in'); });  // restarts the fade-in animation on the detail card and the example, so the change is noticeable
          }  // ends show
          el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },  // builds the layout, stacked and filling the step
            h('div', { class: 'card tight stack', style: { gap: '6px' } },  // top card: the approach buttons and a scale under them
              h('div', { class: 'row', style: { gap: '10px' } }, ...btns),  // the three buttons in one row
              h('div', { class: 'row xs muted b', style: { justifyContent: 'space-between' } }, h('span', {}, '← conservative: refuses more, wastes resources'), h('span', {}, 'liberal: grants more, pays later →')),  // the scale's two ends: conservative (refuses more, wastes resources) and liberal (grants more, pays later)
              h('div', { class: 'meter', style: { height: '8px', background: 'linear-gradient(90deg, var(--os), var(--cpu), var(--io))' } })),  // a thin bar shading from prevention's colour through avoidance's to detection's, under the buttons
            h('div', { class: 'split', style: { gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '16px', height: 'auto' } },  // below it, two equal columns
              h('div', { class: 'card tight' }, detail),  // left: the detail card
              h('div', { class: 'stack', style: { gap: '8px' } }, moment,  // right: the example callout
                h('div', { class: 'callout warn small m0', 'data-label': 'Common mistake' }, 'Mixing up prevention and avoidance. Prevention changes the rules so a condition can never hold; avoidance rules out no condition and judges each request against declared future needs.'))),  // common-mistake callout: prevention changes the rules, avoidance judges each request against declared needs
            table));  // the comparison table across the bottom; closes the layout
          show(0);  // shows prevention first
        },  // ends render() for step 8
      },  // closes step 8

      /* ---------------- 9. Recap ---------------- */
      {  // step 9: the recap, eight ideas on flip cards
        title: 'Recap: eight ideas to carry into the rest of the chapter',  // step 9 title, shown at the top of the page
        kind: 'recap',  // kind 'recap': a summary page
        render(el, ctx) {  // render(el, ctx): builds the flip cards when step 9 opens
          const { h } = ctx;  // takes the HTML builder h out of ctx
          el.append(h('div', { class: 'stack fill', style: { gap: '12px' } },  // builds the layout, stacked and filling the step
            h('p', { class: 'lead m0' }, 'Say each answer out loud before you flip the card.'),  // instruction: answer each card out loud before flipping it
            ctx.ui.flipcards([  // the guide's flip-card widget: each card has a front and a back and turns over when clicked
              ['Deadlock', 'A set of processes, each blocked waiting for an event that only another blocked member of the set can cause. Permanent unless the OS steps in.'],  // card: deadlock
              ['Joint progress diagram', 'One axis per process; the path is a staircase. Shaded boxes: both would hold the same resource. Enter the fatal region and deadlock is certain.'],  // card: the joint progress diagram and its fatal region
              ['Reusable vs consumable', 'Reusable: one user at a time, then released (memory, devices, files, semaphores). Consumable: created, then destroyed when taken (messages, signals, interrupts).'],  // card: reusable versus consumable resources
              ['Resource allocation graph', 'Request edge: process → resource. Assignment edge: unit dot → process. With single-unit resources, a cycle means deadlock.'],  // card: resource allocation graphs and when a cycle means deadlock
              ['Cycle with multi-unit resources', 'Necessary but not sufficient. Reduce the graph: finish whoever can, free their units, repeat. Whoever is left over is deadlocked.'],  // card: a cycle with multi-unit resources, and graph reduction
              ['The four conditions', 'Mutual exclusion, hold and wait, no preemption (policies) and circular wait (the event). All four together: necessary and sufficient.'],  // card: the four conditions
              ['Three responses', 'Prevention: rule a condition out by design. Avoidance: judge each request against future needs. Detection: grant freely, check, recover.'],  // card: the three responses
              ['The price of each', 'Prevention leaves resources idle. Avoidance needs maximum claims in advance. Detection loses work when it recovers.'],  // card: the price of each response
            ], { cols: 4, height: 184 }),  // closes the cards; they are laid out 4 to a row, each at least 184 pixels tall
            h('div', { class: 'callout warn m0', 'data-label': 'The trap to remember' }, 'Every process in a deadlock is behaving correctly on its own. The fault is in the pattern: holding one resource while waiting for another, in an order that can close a loop.')));  // closing callout: each process is fine alone; the deadlock is in the pattern; closes the layout
        },  // ends render() for step 9
      },  // closes step 9

      /* ---------------- 10. Quiz ---------------- */
      {  // step 10: the end-of-section quiz
        title: 'Check yourself',  // step 10 title, shown at the top of the page
        kind: 'check',  // kind 'check': a quiz page
        quiz: [  // quiz: the questions, which the guide turns into an interactive quiz
          { q: 'Which of these situations is a <b>deadlock</b>?',  // question 1 (multiple choice): which situation is a deadlock
            choices: ['P1 waits for the disk, which is busy with P2’s request and will finish in a few milliseconds.', 'P1 holds lock A and waits for lock B, while P2 holds lock B and waits for lock A.', 'A low-priority process keeps being passed over because higher-priority work keeps arriving.', 'Two processes keep reacting to each other and changing state, but neither makes progress.'],  // its four choices: a short disk wait, two locks held crosswise, starvation, and livelock
            answer: 1,  // the right answer is choice 2 (counting from 0, index 1)
            feedback: ['P2 is not blocked waiting on P1, and the disk will finish. This is an ordinary wait that ends by itself.', null, 'The system is making progress; one process is just never chosen. That is starvation, not deadlock.', 'Neither process is blocked; both keep running. That is livelock, a cousin of deadlock.'],  // feedback for each wrong choice; null for the right one
            why: 'Deadlock needs a set of processes that are all blocked, each waiting for an event only another blocked member can cause. P1 and P2 each wait for a lock the other holds, so neither will ever release anything.' },  // explanation shown after answering
          { type: 'tf', q: 'In a joint progress diagram, once the execution path enters the fatal region, deadlock is certain even though neither process is blocked yet.', answer: true,  // question 2 (true or false): entering the fatal region makes deadlock certain; true
            why: 'In the fatal region each process already holds a resource the other will need. Every continuation of the path ends at the deadlock point, so the outcome is decided before anyone actually blocks.' },  // explanation: in the fatal region every continuation ends at the deadlock point
          { type: 'tf', q: 'If a cycle in a resource allocation graph passes through a resource that has several units, the processes on that cycle must be deadlocked.', answer: false,  // question 3 (true or false): a cycle through a multi-unit resource must be a deadlock; false
            why: 'With multi-unit resources a cycle is necessary but not sufficient. If a unit on the cycle is held by a process that can still finish, that process will release it and the cycle breaks.' },  // explanation: with several units a cycle is necessary but not sufficient
          { type: 'bucket', q: 'Sort each resource: reusable or consumable?', buckets: ['Reusable', 'Consumable'],  // question 4 (sort into buckets): reusable or consumable
            items: [['Main memory', 0], ['A message', 1], ['An I/O channel', 0], ['An interrupt', 1], ['A semaphore used as a lock', 0], ['Data waiting in an I/O buffer', 1], ['A file', 0], ['A signal', 1]],  // the eight items to sort, each with its correct bucket
            why: 'Reusable resources are used by one process at a time and then released, unchanged. Consumable resources are created by a producer and destroyed when a consumer takes them.' },  // explanation of the difference between the two kinds
          { type: 'match', q: 'Match each deadlock condition to its meaning.',  // question 5 (match): each condition to its meaning
            pairs: [['Mutual exclusion', 'Only one process at a time may use a resource unit'], ['Hold and wait', 'A process keeps what it holds while it waits for more'], ['No preemption', 'A resource cannot be taken away from the process holding it'], ['Circular wait', 'A closed chain of processes, each waiting for a resource the next one holds']],  // the four condition and meaning pairs
            why: 'The first three describe how resources are managed (policies); the fourth is a pattern that may arise as processes run.' },  // explanation: three policies and one event
          { type: 'multi', q: 'Which of the four conditions are <b>policy</b> conditions: necessary for deadlock, yet not enough on their own to cause one?',  // question 6 (select all): which conditions are policy conditions
            choices: ['Mutual exclusion', 'Hold and wait', 'No preemption', 'Circular wait'], answer: [0, 1, 2],  // the four conditions as choices; the first three are right
            why: 'Mutual exclusion, hold and wait and no preemption can all hold for a long time without any deadlock. Circular wait is the event that actually happens; given the other three, an unbreakable circular wait is a deadlock.' },  // explanation: the three policies can hold without deadlock; circular wait is the event
          { type: 'num', q: 'A memory pool holds 200 KB. Process A asks for 80 KB and later for 70 KB more; process B asks for 70 KB and later for 80 KB more. Neither releases anything until it finishes. If both first requests are granted, how many KB are left free?', answer: 50, tol: 0, unit: 'KB',  // question 7 (number): KB left in a 200 KB pool after both first requests; answer 50, no tolerance
            hint: 'Subtract both first requests from the pool.',  // hint: subtract both first requests
            why: '200 − 80 − 70 = 50 KB. That is less than either second request (70 or 80 KB), so both processes block for good: a deadlock over a reusable resource.' },  // explanation: 50 KB is less than either second request, so both block for good
          { type: 'num', q: 'Process A asks for 80 KB and later 70 KB more; process B asks for 70 KB and later 80 KB more; neither releases memory until it finishes. What is the smallest pool size, in KB, for which no order of requests can deadlock?', answer: 220, tol: 0, unit: 'KB',  // question 8 (number): the smallest pool that cannot deadlock; answer 220 KB
            hint: 'The danger is both first requests being granted. What must still be free then?',  // hint: think about what must still be free after both first grants
            why: 'After both first grants, 150 KB are in use. If at least 70 KB remain, A’s second request can be met; A finishes and frees 150 KB, so B can finish too. 150 + 70 = 220 KB. With any less, both second requests would fail.' },  // explanation: 150 in use plus 70 for one second request gives 220
          { type: 'num', q: 'R1 has 1 unit and R2 has 2 units. P1 holds R1 and requests a unit of R2. P2 holds one unit of R2 and requests R1. P3 holds the other unit of R2 and requests nothing. How many processes are deadlocked?', answer: 0, tol: 0,  // question 9 (number): how many processes are deadlocked in a graph with a cycle; answer 0
            hint: 'Reduce the graph: who can finish right now?',  // hint: reduce the graph
            why: 'There is a cycle (P1 → R2 → P2 → R1 → P1), but P3 is not waiting. P3 finishes and frees its unit of R2; P1 gets it, finishes and frees R1 and R2; then P2 gets R1 and finishes. Nobody is left over, so 0 are deadlocked.' },  // explanation: P3 finishes first, then P1, then P2, so nobody is left over
          { q: 'Two processes exchange messages with a <b>blocking</b> Receive. P1 runs: Receive from P2, then Send to P2. P2 runs: Receive from P1, then Send to P1. What happens?',  // question 10 (multiple choice): two processes that both receive before sending
            choices: ['Both block forever, whatever order the scheduler picks.', 'They deadlock only if P2 happens to run first.', 'Nothing goes wrong: messages are consumable, so they never run out.', 'They deadlock only on a machine with more than one processor.'],  // its four choices about when, or whether, they deadlock
            answer: 0,  // the right answer is the first choice (index 0): they always block
            feedback: [null, 'Order does not matter here: whichever runs first blocks in Receive, and the other then blocks too.', 'Consumable means no fixed supply, but a message exists only once someone sends it. Here neither will ever send.', 'One processor is enough: both Receive calls block before either Send runs, on any machine.'],  // feedback for each wrong choice; null for the right one
            why: 'Each process sends only after it has received, so neither message is ever created. This design error is a deadlock over consumable resources.' },  // explanation: neither message is ever created, a deadlock over consumable resources
          { q: 'An operating system grants every request it can. Every few minutes it runs an algorithm that looks for a set of processes that can never finish, and if it finds one it aborts a member. Which approach is this?',  // question 11 (multiple choice): an OS that grants freely and checks every few minutes
            choices: ['Deadlock prevention', 'Deadlock avoidance', 'Detection and recovery', 'Ignoring the problem'],  // its four choices: prevention, avoidance, detection and recovery, or ignoring the problem
            answer: 2,  // the right answer is the third choice (index 2): detection and recovery
            feedback: ['Prevention restricts how processes may request resources so a condition can never hold; this OS places no such restriction.', 'Avoidance checks each request before granting it, using future maximum claims; this OS grants freely.', null, 'This OS does act: it searches for deadlock and recovers. Ignoring the problem would mean doing neither.'],  // feedback for each wrong choice; null for the right one
            why: 'Granting freely, checking periodically and then recovering (by aborting or preempting) is detection and recovery. It never delays a process from starting, but recovery loses work.' },  // explanation: granting freely, checking and recovering is detection, which loses work on recovery
          { type: 'order', q: 'Put the steps of reducing a resource allocation graph in order.',  // question 12 (put in order): the steps of graph reduction
            items: ['Find a process whose outstanding requests can all be met by the free units', 'Assume it runs to completion', 'Return every unit it holds to the free pool', 'Repeat while some other process can be picked', 'Report any processes left over as deadlocked'],  // the five steps, listed in their correct order (the quiz shuffles them)
            why: 'Reduction plays out a best-case future: whoever can finish does, and frees what it held. Processes that can never be picked are exactly the deadlocked ones.' },  // explanation: reduction plays out the best case, and whoever is never picked is deadlocked
        ],  // closes the quiz list
      },  // closes step 10
    ],  // closes the steps list
    notes: `${/* notes: the section's written summary, shown in the Notes panel */''}
<h3>What a deadlock is</h3>${/* notes heading, part 1: what a deadlock is */''}
<p>A set of processes is <b>deadlocked</b> when every process in the set is blocked, each waiting for an event (usually the release of a resource) that only another blocked member of the same set can cause. Because all of them are asleep, the event never happens: the blocking is <b>permanent</b> unless the operating system intervenes from outside, for example by aborting a process or taking a resource back. No efficient solution works in every case, so each strategy an OS can choose has a cost.</p>${/* notes paragraph: the definition, why it is permanent, and that every fix has a cost */''}
<ul>${/* start of the list for part 1 */''}
  <li>Deadlock is a property of a <b>group</b> of processes that wait on each other, usually two or more.</li>${/* bullet: deadlock is about a group of processes */''}
  <li>It is not the same as a long wait (the wait ends by itself), starvation (others keep progressing while one is passed over) or livelock (processes keep running but make no progress).</li>${/* bullet: deadlock compared with a long wait, starvation and livelock */''}
</ul>${/* end of the list */''}
<h4>Picture: gridlock at a crossing</h4>${/* sub-heading: the gridlock picture */''}
<p>Four cars reach a four-way crossing together. Each car going straight needs two of the four quadrants, one after the other. If every car enters its first quadrant, each holds one quadrant and waits for the next, which the next car holds. The waits form a closed loop and nobody can move. Only an outside action, such as an officer making one car reverse (taking its quadrant back), breaks the loop.</p>${/* notes paragraph: the four cars at the crossing and how an officer breaks the loop */''}

<h3>Joint progress diagram</h3>${/* notes heading, part 2: the joint progress diagram */''}
<p>For two processes P and Q on one processor, the x axis is P’s progress and the y axis is Q’s. Only one process runs at a time, so a run is a <b>staircase</b> path: right when P runs, up when Q runs (with two processors the path could also go diagonally). Example: P does get A, get B, free A, free B; Q does get B, get A, free B, free A.</p>${/* notes paragraph: the axes, the staircase path, and the example programs of P and Q */''}
<ul>${/* start of the list for part 2 */''}
  <li><b>“A needed by both”</b> and <b>“B needed by both”</b> are boxes where both processes would hold the same resource. The path can never enter them.</li>${/* bullet: the shaded boxes where both would hold the same resource */''}
  <li>The <b>fatal region</b> is the corner where P already holds A and Q already holds B. From any point there, every path ends at the <b>deadlock point</b>, where P waits for B and Q waits for A. Deadlock is decided on entering the region, before anyone blocks.</li>${/* bullet: the fatal region and the deadlock point */''}
  <li>Strict turn-taking (P, Q, P, Q, …) walks straight into the fatal region; other schedules pass around it. Same code, different timing.</li>${/* bullet: strict turn-taking walks into the fatal region, other schedules avoid it */''}
  <li>If P instead frees A <b>before</b> it asks for B, P never holds both. The two boxes no longer overlap, there is no fatal region, and both processes finish in every interleaving.</li>${/* bullet: freeing A before asking for B removes the fatal region */''}
</ul>${/* end of the list */''}

<h3>Reusable resources</h3>${/* notes heading, part 3: reusable resources */''}
<p>A <b>reusable resource</b> is used by one process at a time and is not used up: processors, I/O channels, main and secondary memory, devices, files, databases and semaphores. A deadlock over reusable resources has one shape: each process holds some and waits for more that another holds.</p>${/* notes paragraph: what a reusable resource is, with examples, and the shape of a deadlock over them */''}
<ul>${/* start of the list for part 3 */''}
  <li><b>Two devices, opposite orders.</b> P locks the scanner then the printer; Q locks the printer then the scanner. If each takes its first lock before the other takes its second, both block forever. Locking in the same order in both programs removes the danger.</li>${/* bullet: the two devices locked in opposite orders */''}
  <li><b>A memory pool.</b> Pool = 200 KB. A asks for 80 KB, later 70 KB more; B asks for 70 KB, later 80 KB more. If both first requests are granted, 200 − 150 = 50 KB remain, less than either second request, so both block. Worked check: the smallest safe pool is 150 + 70 = 220 KB, because then A’s second request can be met, A finishes and frees 150 KB, and B can finish.</li>${/* bullet: the memory pool example, with the worked smallest safe pool of 220 KB */''}
</ul>${/* end of the list */''}

<h3>Consumable resources</h3>${/* notes heading, part 4: consumable resources */''}
<p>A <b>consumable resource</b> is created by a producer and destroyed when a consumer takes it; there is no fixed supply. Examples: interrupts, signals, messages and data in I/O buffers.</p>${/* notes paragraph: what a consumable resource is, with examples */''}
<ul>${/* start of the list for part 4 */''}
  <li>If P1 does a blocking Receive from P2 before sending, and P2 does a blocking Receive from P1 before sending, both block in every interleaving: the messages each needs are never created. Sending first fixes it.</li>${/* bullet: two processes that both receive before sending always deadlock */''}
  <li>Such deadlocks come from design errors and can be rare: a client sends a request and waits for the answer, while the server, only when a request arrives damaged, waits for a resend that the client never sends. Tests that rarely produce damaged requests almost never reveal it.</li>${/* bullet: a rare deadlock hidden in the server's damaged-request branch */''}
</ul>${/* end of the list */''}

<h3>Resource allocation graphs</h3>${/* notes heading, part 5: resource allocation graphs */''}
<p>Processes are circles; each resource type is a square with one dot per unit. A <b>request edge</b> points from a process to a resource square (the process is waiting). An <b>assignment edge</b> points from a unit dot to the process holding it.</p>${/* notes paragraph: circles, squares, dots, request edges and assignment edges */''}
<ul>${/* start of the list for part 5 */''}
  <li>If every resource has a single unit, a <b>cycle means deadlock</b>.</li>${/* bullet: with single-unit resources a cycle means deadlock */''}
  <li>With multi-unit resources, a cycle is <b>necessary but not sufficient</b>: if a unit on the cycle is free or held by a process that can still finish, the cycle will break.</li>${/* bullet: with multi-unit resources a cycle is necessary but not sufficient */''}
  <li><b>Graph reduction</b> decides it: (1) find a process whose outstanding requests can all be met by the free units; (2) assume it runs to completion; (3) return every unit it holds; (4) repeat while someone can be picked; (5) any process left over is deadlocked.</li>${/* bullet: the five steps of graph reduction */''}
  <li>Example: R1 (1 unit), R2 (2 units). P1 holds R1 and wants R2; P2 holds one R2 and wants R1; P3 holds the other R2 and wants nothing. Cycle P1 → R2 → P2 → R1 → P1, but P3 finishes, then P1, then P2: no deadlock. If P3 also waited for R1, nobody could be picked and all three would be deadlocked.</li>${/* bullet: a worked example with a cycle but no deadlock, and how adding one request makes all three stuck */''}
</ul>${/* end of the list */''}

<h3>The four conditions</h3>${/* notes heading, part 6: the four conditions */''}
<ol>${/* start of the numbered list of conditions */''}
  <li><b>Mutual exclusion</b>: only one process at a time may use a resource unit.</li>${/* condition 1: mutual exclusion */''}
  <li><b>Hold and wait</b>: a process keeps the resources it holds while waiting for more.</li>${/* condition 2: hold and wait */''}
  <li><b>No preemption</b>: a resource cannot be taken away from its holder; it is released only voluntarily.</li>${/* condition 3: no preemption */''}
  <li><b>Circular wait</b>: a closed chain of processes exists, each holding a resource the next one is waiting for.</li>${/* condition 4: circular wait */''}
</ol>${/* end of the numbered list */''}
<p>Conditions 1–3 are <b>policy</b> conditions: each is <b>necessary</b> (without it there can be no deadlock) but even all three together are not <b>sufficient</b>. Condition 4 is the <b>event</b> that may happen as processes run; given 1–3, a circular wait that cannot be broken is a deadlock. All four together are necessary and sufficient. Ruling out any one makes deadlock impossible, for example: shared read-only access (no mutual exclusion), asking for everything at once (no hold and wait), giving everything back when refused or letting the OS take memory frames back (no preemption condition), numbered resources requested in increasing order (no circular wait).</p>${/* notes paragraph: policies versus the event, necessary versus sufficient, and an example of ruling out each condition */''}

<h3>Three ways to respond</h3>${/* notes heading, part 7: three ways to respond */''}
<table>${/* start of the comparison table */''}
  <tr><th>Approach</th><th>Policy</th><th>Scheme</th><th>Main advantage</th><th>Main disadvantage</th></tr>${/* table heading row: approach, policy, scheme, advantage, disadvantage */''}
  <tr><td rowspan="3">Prevention</td><td rowspan="3">Conservative; undercommits resources. Rule out a condition by design.</td><td>Request all at once</td><td>Suits a single burst of work; no preemption needed</td><td>Inefficient; delays starting; needs known in advance</td></tr>${/* prevention row, first scheme (request all at once); its approach and policy cells span three rows */''}
  <tr><td>Preemption</td><td>Convenient when state is easy to save and restore</td><td>Preempts more often than necessary</td></tr>${/* prevention, second scheme: preemption */''}
  <tr><td>Resource ordering</td><td>Checkable at compile time; no run-time cost</td><td>Resources cannot be requested in whatever order the work needs</td></tr>${/* prevention, third scheme: resource ordering */''}
  <tr><td>Avoidance</td><td>Midway. Grant a request only if every process can still finish afterwards.</td><td>Safe-state check per request</td><td>No preemption necessary</td><td>Needs future maximum claims; processes may wait long</td></tr>${/* avoidance row: the safe-state check per request */''}
  <tr><td>Detection and recovery</td><td>Very liberal. Grant whatever can be granted; check periodically.</td><td>Periodic detection check</td><td>Never delays process start; handled on-line</td><td>Recovery loses work (aborts, preemption)</td></tr>${/* detection and recovery row: the periodic check */''}
</table>${/* end of the table */''}
<p>Prevention changes the rules so a condition can never hold; avoidance rules out no condition in advance and judges each request against declared future needs; detection lets deadlocks happen and then breaks them.</p>${/* closing paragraph: prevention, avoidance and detection told apart in one sentence each */''}
`,  // end of the notes text
  });  // closes the section object passed to Guide.section
})();  // ends the wrapper function and runs it
