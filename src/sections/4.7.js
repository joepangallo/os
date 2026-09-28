/* =====================================================================
   Section 4.7 — Android Process and Thread Management
   Steps: big picture · app anatomy · component matcher · lifecycle map ·
          lifecycle simulator · main thread vs worker · low-memory killer ·
          recap · quiz
   ===================================================================== */
Guide.section({
  id: '4.7',
  title: 'Android Process and Thread Management',
  short: 'Android procs & threads',
  summary: 'Android\'s four app components, the activity lifecycle, the main thread, and which processes die first.',
  objectives: [
    'Name Android\'s four kinds of application component and choose the right one for a given job.',
    'Trace the callbacks an activity receives as the user launches, covers, leaves, rotates and returns to it, and name its three nested lifetimes.',
    'Explain why an app starts with one process and one main (UI) thread, and why slow work belongs on a worker thread.',
    'Rank processes by Android\'s five-level importance hierarchy and predict which one is killed first when memory runs short.',
  ],
  terms: [
    ['Activity', 'One screen of an Android app that the user sees and touches, such as a message list or a compose screen. An app usually has several.'],
    ['Service', 'An Android app component with no screen that carries out long-running work in the background, such as playing music or downloading a file, and can keep going after the user switches to another app.'],
    ['Content provider', 'An Android app component that offers a standard interface to a set of app data (stored in files, an SQLite database or on the web) so that the owning app and, with permission, other apps can read or change it. The contacts list is the classic example.'],
    ['Broadcast receiver', 'An Android app component that sleeps until the system (or another app) announces an event to everyone, such as "battery low", "screen turned off" or "download finished", and then reacts briefly.'],
    ['Intent', 'A small message object that asks Android to start an activity or a service, or that carries a broadcast announcement. An explicit intent names the exact component wanted; an implicit intent names only the kind of action wanted and lets Android pick an app.'],
    ['Application sandbox', 'Android\'s isolation of apps: by default each app runs in its own Linux process, under its own user ID, with its own instance of the virtual machine, so one app cannot read or damage another app\'s memory or files.'],
    ['Back stack', 'The list of activities the user has opened, in the order they were opened, with the newest on top. Pressing Back finishes the top activity and brings back the one underneath; Android keeps the list even if it kills the app\'s process.'],
    ['Lifecycle callback', 'A method (onCreate, onStart, onResume, onPause, onStop, onRestart, onDestroy) that Android calls on an activity each time the activity moves from one state to another, giving the app a chance to set up, save or release things.'],
    ['Paused state', 'The state of an activity that is still at least partly visible but no longer has the user\'s focus, because another activity has appeared in front of part of it. An activity that is being left also passes briefly through Paused on its way to Stopped.'],
    ['Stopped state', 'The state of an activity that is completely hidden. It stays in memory with its data, but it is not drawn and should do no work.'],
    ['Entire lifetime', 'The span of an activity between onCreate() and onDestroy(): everything the activity owns is set up at the start and released at the end.'],
    ['Visible lifetime', 'The span of an activity between onStart() and onStop(), during which it is on screen, even if only partly.'],
    ['Foreground lifetime', 'The span of an activity between onResume() and onPause(), during which it is in front of every other activity and receives the user\'s input.'],
    ['Main thread (UI thread)', 'The first thread of an app\'s process: it handles the user\'s input and is the only thread that draws the screen, so it must never be kept busy for long or the app freezes. On Android it also runs the lifecycle callbacks of all the app\'s components by default.'],
    ['Application Not Responding (ANR)', 'The error dialog Android shows when an app\'s main thread has not responded to an input event, such as a tap, within about five seconds. It offers to wait or to close the app.'],
    ['Importance hierarchy', 'Android\'s ranking of processes, from most to least important: foreground, visible, service (running a started service, nothing visible), background, empty. When memory is short, Android\'s low-memory killer ends the least important processes first.'],
    ['Foreground process', 'A process doing what the user is focused on right now, for example running the activity the user is touching or a broadcast receiver that is handling an event. It is killed only as a last resort.'],
    ['Visible process', 'A process whose activity can still be seen but is not in the foreground (it is Paused), for example an app partly hidden behind a permission window or shown in a small picture-in-picture window. A service the user is plainly aware of, such as music playing with a notification on screen, also ranks here.'],
    ['Background process', 'A process holding only activities that are Stopped (not visible). Android keeps these in least-recently-used order and kills the oldest first when it needs memory.'],
    ['Empty process', 'A process that holds no active app components at all. Android keeps it only as a cache so the app starts faster next time, and it is the first to be killed.'],
  ],

  css: `
    /* shell workaround: in narrow mode the nowrap eyebrow otherwise sets the canvas min-width */
    .sec-4-7 .step-eyebrow { contain: inline-size; }
    .sec-4-7 .hot { cursor: pointer; outline: none; }
    .sec-4-7 button.chip { border: 0; cursor: pointer; font-family: inherit; }
    .sec-4-7 button.chip:hover { box-shadow: 0 0 0 2px var(--line-2); }
    .sec-4-7 .hot .fr { transition: stroke-width .15s; }
    .sec-4-7 .hot:hover .fr, .sec-4-7 .hot:focus-visible .fr { stroke-width: 3.5; }
    .sec-4-7 .hot.sel .fr { stroke-width: 4; }
    .sec-4-7 .mt-q { font-size: 21px; font-weight: 650; line-height: 1.4; }
    .sec-4-7 .bin { display: flex; flex-direction: column; gap: 6px; align-items: stretch; text-align: left; padding: 10px 12px; border-radius: 12px; border: 2px solid color-mix(in srgb, var(--bc) 40%, transparent); border-top: 6px solid var(--bc); background: var(--panel); cursor: pointer; font: inherit; color: var(--ink); min-height: 0; transition: box-shadow .15s, background .15s; }
    .sec-4-7 .bin:hover { box-shadow: 0 0 0 3px color-mix(in srgb, var(--bc) 30%, transparent); background: var(--bcb); }
    .sec-4-7 .bin > .row b { font-size: 17px; color: var(--bc); }
    .sec-4-7 .bin-foot { margin-top: auto; display: flex; gap: 8px; align-items: center; opacity: .85; }
    .sec-4-7 .bin-line { border-top: 1px dashed var(--line-2); margin: 2px 0; }
    .sec-4-7 .bin.wrong { animation: sec47shake .45s; border-color: var(--bad); }
    @keyframes sec47shake { 20% { transform: translateX(-5px); } 40% { transform: translateX(5px); } 60% { transform: translateX(-3px); } 80% { transform: translateX(3px); } }
    .sec-4-7 .mdot { width: 16px; height: 8px; border-radius: 9px; background: var(--panel-3); display: inline-block; }
    .sec-4-7 .mdot.cur { background: var(--chc); }
    .sec-4-7 .mdot.ok { background: var(--ok); }
    .sec-4-7 .gate rect { fill: var(--panel); stroke: var(--ink-2); stroke-width: 1.5; }
    .sec-4-7 .gate text { font-family: var(--mono); font-size: 13.5px; font-weight: 700; }
    .sec-4-7 .gate.sel rect { fill: var(--hl); stroke: var(--ink); }
    .sec-4-7 .gate:hover rect { stroke: var(--accent); }
    /* lifecycle simulator */
    .sec-4-7 .simgrid { display: grid; grid-template-columns: 250px minmax(0, 1fr) 380px; gap: 16px; height: 100%; }
    .sec-4-7 .phone-wrap { display: grid; place-items: center; }
    .sec-4-7 .phone { width: 236px; height: 468px; border: 8px solid var(--ink-2); border-radius: 28px; background: var(--panel); display: flex; flex-direction: column; overflow: hidden; box-shadow: var(--shadow); transition: width .35s, height .35s; }
    .sec-4-7 .phone.land { width: 246px; height: 200px; border-radius: 20px; }
    .sec-4-7 .ph-status { display: flex; justify-content: space-between; padding: 2px 12px; font-size: 12.5px; font-weight: 700; color: var(--ink-2); background: var(--panel-2); flex: none; }
    .sec-4-7 .ph-screen { flex: 1; position: relative; display: flex; flex-direction: column; min-height: 0; }
    .sec-4-7 .ph-bar { padding: 7px 12px; font-weight: 800; font-size: 15px; border-bottom: 1px solid var(--line); flex: none; }
    .sec-4-7 .ph-body { flex: 1; display: flex; flex-direction: column; gap: 6px; padding: 8px 10px; min-height: 0; overflow: hidden; transition: opacity .2s; }
    .sec-4-7 .ph-body.dim { opacity: .35; }
    .sec-4-7 .phone.land .ph-body { gap: 3px; padding: 5px 8px; }
    .sec-4-7 .phone.land .ph-note { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: 2px 8px; font-size: 12.5px; line-height: 1.35; flex: none; }
    .sec-4-7 .phone.land .ph-bar { padding: 4px 12px; font-size: 14px; }
    .sec-4-7 .phone.land .ph-edit { padding: 4px 8px; font-size: 13px; }
    .sec-4-7 .phone.land .ph-body > .xs { display: none; }
    .sec-4-7 .ph-note { text-align: left; padding: 6px 9px; border-radius: 9px; border: 1px solid var(--line); background: var(--panel-2); font: inherit; font-size: 13.5px; color: var(--ink); cursor: pointer; }
    .sec-4-7 .ph-note:hover { border-color: var(--accent); }
    .sec-4-7 .ph-edit { flex: 1; padding: 8px 10px; border-radius: 9px; border: 1px solid var(--io); background: var(--io-bg); font-size: 14px; line-height: 1.4; }
    .sec-4-7 .ph-nav { display: grid; grid-template-columns: 1fr 1fr; border-top: 1px solid var(--line); background: var(--panel-2); flex: none; }
    .sec-4-7 .ph-navb { border: 0; background: none; padding: 6px 0; font: inherit; font-size: 14px; font-weight: 700; color: var(--ink-2); cursor: pointer; }
    .sec-4-7 .ph-navb:hover { color: var(--accent); background: var(--panel-3); }
    .sec-4-7 .ph-home { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px 8px; padding: 18px 10px; }
    .sec-4-7 .phone.land .ph-home { grid-template-columns: repeat(6, 1fr); gap: 4px; padding: 10px 4px; }
    .sec-4-7 .ph-icon { display: flex; flex-direction: column; align-items: center; gap: 3px; border: 0; background: none; font: inherit; font-size: 12.5px; color: var(--ink); cursor: pointer; padding: 0; }
    .sec-4-7 .ph-icon:disabled { opacity: .45; cursor: default; }
    .sec-4-7 .ph-ico { width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; color: var(--panel); font-weight: 900; font-size: 17px; }
    .sec-4-7 .phone.land .ph-ico { width: 30px; height: 30px; font-size: 14px; border-radius: 9px; }
    .sec-4-7 .ph-pop { position: absolute; inset: 0; background: color-mix(in srgb, var(--ink) 30%, transparent); display: grid; place-items: center; padding: 10px; }
    .sec-4-7 .ph-popcard { background: var(--panel); border: 1px solid var(--line-2); border-radius: 14px; padding: 10px 12px; box-shadow: var(--shadow-lg); font-size: 13.5px; line-height: 1.35; display: flex; flex-direction: column; gap: 8px; }
    .sec-4-7 .simbtns { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
    .sec-4-7 .simbtns .btn { justify-content: flex-start; }
    .sec-4-7 .simlog > div { display: grid; grid-template-columns: 22px minmax(0, 1fr); gap: 6px; }
    .sec-4-7 .simlog .n { color: var(--muted); text-align: right; }
    .sec-4-7 .simlog .sys { color: var(--ink-2); font-family: var(--font); font-size: 13.5px; font-style: italic; }
    .sec-4-7 .simlog .why { color: var(--muted); font-family: var(--font); font-size: 13px; }
    .sec-4-7 .actcard { display: grid; grid-template-columns: 128px minmax(0, 1fr); gap: 10px; align-items: center; padding: 8px 10px; border-radius: 12px; border: 1px solid var(--line); border-left: 5px solid var(--ac); background: var(--panel-2); }
    .sec-4-7 .lt rect { fill: var(--panel); stroke: var(--line-2); stroke-width: 2; transition: fill .25s, stroke .25s; }
    .sec-4-7 .lt rect.e.on { fill: var(--os-bg); stroke: var(--os); }
    .sec-4-7 .lt rect.v.on { fill: var(--cpu-bg); stroke: var(--cpu); }
    .sec-4-7 .lt rect.f.on { fill: var(--ok-bg); stroke: var(--ok); }
    .sec-4-7 .lt .tok { transition: transform .35s ease, opacity .25s; }
    .sec-4-7 .ltchip { font-size: 12.5px; }
    .sec-4-7 .ltchip.off { background: var(--panel-3); color: var(--muted); opacity: .75; }
    /* main thread vs worker demo */
    .sec-4-7 .thgrid { display: grid; grid-template-columns: 318px 214px minmax(0, 1fr); gap: 16px; height: 100%; }
    .sec-4-7 .ph-album { font-weight: 800; color: var(--ok); min-height: 24px; font-size: 14.5px; }
    .sec-4-7 .kpi { display: flex; flex-direction: column; gap: 1px; padding: 8px 12px; border-radius: 12px; background: var(--panel-2); border: 1px solid var(--line); border-top: 4px solid var(--kc); }
    .sec-4-7 .kpi b { font-size: 26px; line-height: 1.1; color: var(--kc); }
    .sec-4-7 .kpi span { font-size: 14px; line-height: 1.3; color: var(--ink-2); }
    /* importance ladder + low-memory killer */
    .sec-4-7 .lad { display: flex; flex-direction: column; gap: 6px; flex: 1; min-height: 0; }
    .sec-4-7 .lrow { flex: 1; min-height: 0; display: grid; grid-template-columns: 136px minmax(0, 1fr); gap: 8px; align-items: center; padding: 5px 8px 5px 10px; border-radius: 12px; border-left: 6px solid var(--lc); background: var(--lcb); }
    .sec-4-7 .lhead { display: flex; flex-direction: column; gap: 1px; line-height: 1.25; }
    .sec-4-7 .lhead b { color: var(--lc); font-size: 15.5px; }
    .sec-4-7 .lcell { display: flex; gap: 6px; align-items: stretch; min-width: 0; }
    .sec-4-7 .pcard { flex: 1 1 0; max-width: 196px; min-width: 0; position: relative; display: flex; flex-direction: column; align-items: flex-start; gap: 0; text-align: left; padding: 5px 9px; border-radius: 10px; border: 1.5px solid color-mix(in srgb, var(--lc) 50%, transparent); background: var(--panel); font: inherit; color: var(--ink); cursor: pointer; line-height: 1.3; transition: opacity .2s, box-shadow .15s; }
    .sec-4-7 .pcard:hover { box-shadow: 0 0 0 2px var(--lc); }
    .sec-4-7 .pcard b { font-size: 15px; }
    .sec-4-7 .pcard.dead { opacity: .55; background: var(--panel-3); border-style: dashed; }
    .sec-4-7 .pcard.dead b { text-decoration: line-through; }
    .sec-4-7 .ktag { position: absolute; top: 5px; right: 8px; color: var(--bad); }
    .sec-4-7 .killrow { display: flex; flex-wrap: wrap; gap: 5px; align-items: center; min-height: 26px; }
    /* phone (narrow) layouts: steps add class "nar" to their body */
    .sec-4-7 .nar .simgrid, .sec-4-7 .nar .thgrid { grid-template-columns: minmax(0, 1fr); height: auto; }
    .sec-4-7 .nar .simlog { min-height: 220px; max-height: 320px; }
    .sec-4-7 .nar .simbtns .btn { white-space: normal; height: auto; min-height: 30px; padding: 4px 8px; }
    .sec-4-7 .nar .actcard { grid-template-columns: 96px minmax(0, 1fr); }
    .sec-4-7 .nar .actcard svg { width: 96px; }
    .sec-4-7 .nar .lrow { grid-template-columns: minmax(0, 1fr); flex: none; }
    .sec-4-7 .nar .lcell { flex-wrap: wrap; }
    .sec-4-7 .nar .pcard { flex: 1 1 130px; max-width: none; }
    .sec-4-7 .nar .chain { flex-direction: column; }
    .sec-4-7 .nar .chain > .muted { text-align: center; transform: rotate(90deg); }
  `,

  steps: [
    /* ---------------- 1. Big picture ---------------- */
    {
      title: 'Many apps, little memory: Android decides who stays',
      kind: 'story',
      html: `
        <div class="split r fill">
          <div class="stack" style="gap:10px">
            <p class="lead m0">In one minute on a phone you might touch chat, the camera, a map and a music player. Each one wants memory, and a phone has far less of it than a laptop.</p>
            <p class="m0">A classic desktop keeps a program alive until you quit it, parking idle parts of it on disk if memory runs low. Android does not wait for you: when a newly opened app needs room, it <b>kills whole processes</b>, starting with the apps you would miss least.</p>
            <p class="m0">That is safe only because Android apps are built from parts (an <span class="t">activity</span> for each screen, a <span class="t">service</span> for background work, and two more kinds) that Android starts, pauses and stops by calling each part's <span class="t">lifecycle callbacks</span>.</p>
            <div class="callout analogy m0" data-label="Analogy">A tiny desk in a busy library. The book you are reading stays open in front of you. When new books arrive and the desk is full, the librarian clears away the ones you have ignored the longest, but first slips a <b>bookmark</b> into each. Android's bookmark is the small bundle of state an activity saves as it is stopped.</div>
            <div class="callout why m0" data-label="Why it matters">Any app you are not looking at may be gone when you come back. Apps that save their state in the right callback feel as if they never left.</div>
          </div>
          <div class="stack" style="gap:9px">
            <div class="card white" style="padding:8px 12px">
              <svg viewBox="0 0 450 214" width="100%" role="img" aria-label="Phone memory shared by five apps; a new camera app needs room, so Android kills the empty process first and then the least recently used background process">
                <text x="10" y="20" font-size="16" font-weight="800">Memory for apps: 4,000 MB</text>
                <text x="10" y="39" font-size="13" class="s-sub">sizes in MB · most important on the left</text>
                <rect x="268" y="6" width="172" height="32" rx="9" class="s-panel" stroke-width="2" stroke-dasharray="6 4"/>
                <text x="354" y="27" text-anchor="middle" font-size="13" font-weight="800">Camera needs 1,100</text>
                <line x1="408" y1="39" x2="408" y2="70" class="s-line" marker-end="url(#arr)"/>
                <g font-size="13" text-anchor="middle" font-weight="800">
                  <text x="284" y="66" style="fill:var(--bad)">✗ 2nd</text>
                  <text x="354" y="66" style="fill:var(--bad)">✗ 1st</text>
                </g>
                <rect x="10" y="72" width="86" height="52" rx="6" class="s-ok" stroke-width="2"/>
                <rect x="96" y="72" width="65" height="52" rx="6" class="s-accent" stroke-width="2"/>
                <rect x="161" y="72" width="75" height="52" rx="6" class="s-warn" stroke-width="2"/>
                <rect x="236" y="72" width="97" height="52" rx="6" class="s-warn" stroke-width="2"/>
                <rect x="333" y="72" width="43" height="52" rx="6" class="s-bad" stroke-width="2"/>
                <rect x="376" y="72" width="64" height="52" rx="6" class="s-panel" stroke-width="2" stroke-dasharray="5 4"/>
                <g font-size="14" font-weight="800" text-anchor="middle">
                  <text x="53" y="95">Chat</text><text x="128" y="95">Backup</text><text x="198" y="95">Browser</text>
                  <text x="284" y="95">Game</text><text x="354" y="95">Calc</text><text x="408" y="95">free</text>
                </g>
                <g font-size="13" text-anchor="middle">
                  <text x="53" y="114" class="s-sub">800</text><text x="128" y="114" class="s-sub">600</text><text x="198" y="114" class="s-sub">700</text>
                  <text x="284" y="114" class="s-sub">900</text><text x="354" y="114" class="s-sub">400</text><text x="408" y="114" class="s-sub">600</text>
                </g>
                <g font-size="13" text-anchor="middle" font-weight="700">
                  <text x="53" y="142" style="fill:var(--ok)">foreground</text><text x="126" y="142" style="fill:var(--accent)">service</text>
                  <text x="198" y="142" style="fill:var(--warn)">background</text><text x="284" y="142" style="fill:var(--warn)">background</text>
                  <text x="354" y="142" style="fill:var(--bad)">empty</text>
                </g>
                <g font-size="13" text-anchor="middle">
                  <text x="128" y="160" class="s-sub">uploading</text><text x="198" y="160" class="s-sub">idle 5 min</text><text x="284" y="160" class="s-sub">idle 2 h</text>
                </g>
                <text x="225" y="188" text-anchor="middle" font-size="13" class="s-sub">Android reclaims memory starting from the right-hand end</text>
                <line x1="436" y1="202" x2="14" y2="202" class="s-muted" marker-end="url(#arr-muted)"/>
              </svg>
            </div>
            <p class="small m0" style="line-height:1.4">600 MB free is not enough, so the empty Calc process goes first (1,000 MB free). Still short, so Game, idle for 2 hours, goes next (1,900 MB free): enough. Browser, Backup and Chat survive.</p>
            <div class="grid-2" style="gap:10px">
              <div class="kpi" style="--kc:var(--proc)"><b>4</b><span>kinds of app component</span></div>
              <div class="kpi" style="--kc:var(--os)"><b>7</b><span>lifecycle callbacks per activity</span></div>
              <div class="kpi" style="--kc:var(--thread)"><b>1</b><span>main thread per app, by default</span></div>
              <div class="kpi" style="--kc:var(--warn)"><b>5</b><span>importance levels for killing</span></div>
            </div>
            <p class="xs muted m0">Section 4.6 showed how the Linux kernel underneath handles processes and threads; this section covers the rules Android adds on top. Windows' Modern apps (section 4.4) face the same squeeze.</p>
          </div>
        </div>`,
    },

    /* ---------------- 2. Anatomy of an app: four components in one sandboxed process ---------------- */
    {
      title: 'Inside an app: four kinds of component, one sandbox',
      kind: 'explore',
      render(el, ctx) {
        const { h } = ctx;
        const INFO = {
          proc: { name: 'The app\'s own process', chip: ['proc', 'sandbox'],
            what: 'By default Android gives every app <b>one Linux process of its own</b>, under its own user ID. All four kinds of component in this app live inside it.',
            how: 'Android creates it when any component is first needed (an icon tap, a broadcast, a query) and may kill it later to reclaim memory. A manifest setting <i>can</i> give a component a process of its own.',
            egl: 'Example', eg: 'The car-dashboard app (left) runs in a <b>different</b> process: it cannot read this app\'s memory.',
            tip: ['why', 'Why it matters', 'This is the <span class="t">application sandbox</span>: a crash or a bug stays inside one box, and one app cannot spy on another.'] },
          vm: { name: 'Its own virtual machine', chip: ['os', 'runtime'],
            what: 'Inside the process runs the app\'s <b>own instance</b> of the Android runtime, the virtual machine that executes the app\'s code (Dalvik on early phones, ART today).',
            how: 'A fresh VM per app would start slowly, so Android forks each new app process from a warmed-up parent (Zygote) that already has the runtime loaded.',
            egl: 'In short', eg: 'One app = one process = one VM, by default. That is the unit Android starts, protects and, when memory is short, kills.',
            tip: ['tip', 'Which kind of VM?', 'A language runtime, like the JVM of section 4.3, not a simulated computer with its own OS (section 4.6).'] },
          act: { name: 'Activity', chip: ['accent', 'a screen'],
            what: 'An <span class="t">activity</span> is <b>one screen</b> the user sees and touches. This app has two: the episode list and the player.',
            how: 'Started by an <span class="t">intent</span> (a message to Android, see the orange tags). Tapping the app icon sends one to the list screen; tapping an episode sends one to the player screen.',
            eg: 'An inbox, a camera viewfinder, a settings page, a checkout screen.',
            tip: ['tip', 'Coming up', 'Activities have the richest lifecycle of the four; steps 4 and 5 follow one from birth to death.'] },
          svc: { name: 'Service', chip: ['cpu', 'no screen'],
            what: 'A <span class="t">service</span> does work that <b>takes a long time</b> and needs <b>no screen</b>, and it can keep running after the user switches to another app.',
            how: 'Started by an intent, here from the player screen when you press Play. It keeps the episode playing while you use the browser.',
            eg: 'Playing music, downloading a large file, uploading photos, syncing mail.',
            tip: ['warn', 'Common mistake', 'A service is <b>not</b> a separate thread. Unless the app creates one, a service\'s code runs on the same main thread as the screens (step 6).'] },
          br: { name: 'Broadcast receiver', chip: ['intr', 'reacts to events'],
            what: 'A <span class="t">broadcast receiver</span> waits for <b>system-wide announcements</b> and reacts to the ones it cares about. It does its job in a few moments and finishes.',
            how: 'Woken by a broadcast intent. Here Android announces "headphones unplugged", and the receiver tells the service to pause so the episode does not blast from the speaker.',
            eg: 'Screen turned off, battery low, a download finished, the phone finished booting.',
            tip: ['tip', 'Remember', 'A receiver has no screen and a very short life. Longer work is handed to a service.'] },
          cp: { name: 'Content provider', chip: ['mem', 'shares data'],
            what: 'A <span class="t">content provider</span> is a <b>standard doorway to a set of app data</b> (query, insert, update, delete). The app itself and, with permission, other apps use the same doorway.',
            how: 'Not started by an intent: another app sends a query addressed to the provider\'s <code>content://</code> name, and Android routes it here, starting the process if needed.',
            eg: 'The contacts list is the classic one: any app you allow can look up a phone number. The data may live in files, an SQLite database or on the web.',
            tip: ['tip', 'Remember', 'Other apps never touch the database directly; they only see what the provider chooses to return.'] },
          intent: { name: 'Intent', chip: ['warn', 'a message'],
            what: 'An <span class="t">intent</span> is a small <b>message that asks Android to activate a component</b>: start this screen, start that service, announce this event.',
            how: 'An <b>explicit</b> intent names the exact component (open the player screen); an <b>implicit</b> one only describes an action ("share this link") and lets Android pick an app.',
            egl: 'Used for', eg: 'Starting activities and services, and carrying broadcasts. Content providers are reached by a query instead.',
            tip: ['why', 'Why it matters', 'Components are started by messages, not direct calls, so Android stays in control: it can start the process first, check permissions or pick another app.'] },
        };
        const ORDER = ['proc', 'vm', 'act', 'svc', 'br', 'cp', 'intent'];
        const seen = new Set();
        const svgHTML = `
<svg viewBox="0 0 660 500" width="100%" role="img" aria-label="A podcast app's process containing its virtual machine and its four components, with intents arriving from outside">
  <g class="hot" data-k="proc" tabindex="0"><rect class="s-proc fr" x="166" y="6" width="488" height="488" rx="16" stroke-width="2.5"/>
    <text x="410" y="29" text-anchor="middle" font-size="14.5" font-weight="800" style="fill:var(--proc)">Podcasts app: one Linux process (its sandbox)</text></g>
  <g class="hot" data-k="vm" tabindex="0"><rect class="s-panel fr" x="182" y="40" width="456" height="440" rx="12" stroke-width="2"/>
    <text x="410" y="60" text-anchor="middle" font-size="13.5" font-weight="700" class="s-sub">its own virtual machine instance (ART)</text></g>
  <g class="hot" data-k="act" tabindex="0"><rect class="s-accent fr" x="198" y="72" width="424" height="138" rx="12" stroke-width="2"/>
    <text x="214" y="94" font-size="15" font-weight="800" style="fill:var(--accent)">Activities</text><text x="296" y="94" font-size="13" class="s-sub">one per screen</text>
    <rect x="224" y="106" width="150" height="92" rx="9" class="s-panel" stroke-width="1.5"/><text x="299" y="125" text-anchor="middle" font-size="13" font-weight="700">Episode list</text>
    <rect x="236" y="134" width="126" height="12" rx="3" class="s-accent" stroke-width="1"/><rect x="236" y="152" width="126" height="12" rx="3" class="s-accent" stroke-width="1"/><rect x="236" y="170" width="126" height="12" rx="3" class="s-accent" stroke-width="1"/>
    <rect x="452" y="106" width="150" height="92" rx="9" class="s-panel" stroke-width="1.5"/><text x="527" y="125" text-anchor="middle" font-size="13" font-weight="700">Player</text>
    <circle cx="527" cy="160" r="20" class="s-accent" stroke-width="2"/><path d="M521 150 L521 170 L537 160 Z" style="fill:var(--accent)"/>
    <line x1="376" y1="152" x2="448" y2="152" class="s-line" marker-end="url(#arr)"/></g>
  <g class="hot" data-k="br" tabindex="0"><rect class="s-intr fr" x="198" y="232" width="190" height="104" rx="12" stroke-width="2"/>
    <text x="293" y="256" text-anchor="middle" font-size="15" font-weight="800" style="fill:var(--intr)">Broadcast receiver</text>
    <text x="293" y="280" text-anchor="middle" font-size="13">hears "headphones out"</text><text x="293" y="300" text-anchor="middle" font-size="13">and asks the service</text><text x="293" y="318" text-anchor="middle" font-size="13">to pause</text></g>
  <g class="hot" data-k="svc" tabindex="0"><rect class="s-cpu fr" x="432" y="232" width="190" height="104" rx="12" stroke-width="2"/>
    <text x="527" y="256" text-anchor="middle" font-size="15" font-weight="800" style="fill:var(--cpu)">Service</text>
    <text x="527" y="280" text-anchor="middle" font-size="13">plays the episode</text><text x="527" y="300" text-anchor="middle" font-size="13">no screen; keeps going</text><text x="527" y="318" text-anchor="middle" font-size="13">when you switch apps</text></g>
  <line x1="527" y1="199" x2="527" y2="229" class="s-line" marker-end="url(#arr)"/>
  <line x1="389" y1="290" x2="429" y2="290" class="s-line" marker-end="url(#arr)"/>
  <g class="hot" data-k="cp" tabindex="0"><rect class="s-mem fr" x="198" y="358" width="424" height="108" rx="12" stroke-width="2"/>
    <text x="214" y="382" font-size="15" font-weight="800" style="fill:var(--mem)">Content provider</text>
    <text x="214" y="405" font-size="13">one doorway to the episode data</text>
    <text x="214" y="426" font-size="13" class="s-sub">SQLite database + downloaded audio files</text>
    <text x="214" y="450" font-size="13" class="s-monot" style="fill:var(--mem)">query · insert · update · delete</text>
    <ellipse cx="560" cy="386" rx="34" ry="9" class="s-mem" stroke-width="2"/><path d="M526 386 V436 A34 9 0 0 0 594 436 V386" class="s-mem" stroke-width="2"/><ellipse cx="560" cy="386" rx="34" ry="9" class="s-mem" stroke-width="2"/>
    <text x="560" y="420" text-anchor="middle" font-size="13" font-weight="700">data</text></g>
  <rect x="4" y="96" width="146" height="50" rx="10" class="s-panel" stroke-width="1.5"/><text x="77" y="117" text-anchor="middle" font-size="13" font-weight="700">You tap the</text><text x="77" y="135" text-anchor="middle" font-size="13" font-weight="700">app icon</text>
  <rect x="4" y="258" width="146" height="50" rx="10" class="s-panel" stroke-width="1.5"/><text x="77" y="279" text-anchor="middle" font-size="13" font-weight="700">Android announces</text><text x="77" y="297" text-anchor="middle" font-size="13" font-weight="700">headphones out</text>
  <rect x="4" y="386" width="146" height="50" rx="10" class="s-panel" stroke-width="1.5"/><text x="77" y="407" text-anchor="middle" font-size="13" font-weight="700">Another app:</text><text x="77" y="425" text-anchor="middle" font-size="13" font-weight="700">car dashboard</text>
  <path d="M150 121 C 180 121, 196 150, 222 150" class="s-line" marker-end="url(#arr)"/>
  <line x1="150" y1="283" x2="196" y2="283" class="s-line" marker-end="url(#arr)"/>
  <line x1="150" y1="411" x2="196" y2="411" class="s-line" marker-end="url(#arr)"/>
  <g class="hot" data-k="intent" tabindex="0"><rect class="s-warn fr" x="378" y="128" width="68" height="20" rx="10" stroke-width="1.5"/><text x="412" y="143" text-anchor="middle" font-size="13" font-weight="800" style="fill:var(--warn)">intent</text></g>
  <g class="hot" data-k="intent" tabindex="0"><rect class="s-warn fr" x="537" y="204" width="68" height="20" rx="10" stroke-width="1.5"/><text x="571" y="219" text-anchor="middle" font-size="13" font-weight="800" style="fill:var(--warn)">intent</text></g>
  <g class="hot" data-k="intent" tabindex="0"><rect class="s-warn fr" x="16" y="152" width="68" height="20" rx="10" stroke-width="1.5"/><text x="50" y="167" text-anchor="middle" font-size="13" font-weight="800" style="fill:var(--warn)">intent</text></g>
  <g class="hot" data-k="intent" tabindex="0"><rect class="s-warn fr" x="16" y="314" width="118" height="20" rx="10" stroke-width="1.5"/><text x="75" y="329" text-anchor="middle" font-size="13" font-weight="800" style="fill:var(--warn)">broadcast intent</text></g>
  <rect x="16" y="442" width="118" height="20" rx="10" class="s-mem" stroke-width="1.5"/><text x="75" y="457" text-anchor="middle" font-size="13" font-weight="800" style="fill:var(--mem)">content:// query</text>
</svg>`;
        const svgWrap = h('div', { html: svgHTML, style: { display: 'grid', placeItems: 'center', height: '100%' } });
        const title = h('h3', { class: 'm0' });
        const chip = h('span', { class: 'chip' });
        const body = h('div', { class: 'stack', style: { gap: '8px' } });
        const prog = h('div', { class: 'row gap-s' });
        function paintProg() {
          prog.replaceChildren(h('span', { class: 'xs muted b' }, `Explored ${seen.size}/${ORDER.length}:`), ...ORDER.map((k) => h('button', { type: 'button', class: 'chip ' + (seen.has(k) ? 'ok' : ''), onclick: () => show(k) }, (seen.has(k) ? '✓ ' : '') + INFO[k].name.replace('The app\'s own ', '').replace('Its own ', ''))));
        }
        function show(k) {
          const d = INFO[k];
          seen.add(k);
          svgWrap.querySelectorAll('.hot').forEach((g) => g.classList.toggle('sel', g.dataset.k === k));
          title.textContent = d.name;
          chip.className = 'chip ' + d.chip[0]; chip.textContent = d.chip[1];
          body.replaceChildren(
            h('p', { class: 'm0', html: d.what }),
            h('p', { class: 'm0 small', html: '<b>How it starts:</b> ' + d.how }),
            h('p', { class: 'm0 small', html: `<b>${d.egl || 'Examples'}:</b> ` + d.eg }),
            h('div', { class: 'callout m0 small fade-in ' + d.tip[0], 'data-label': d.tip[1], html: d.tip[2] }));
          paintProg();
        }
        svgWrap.addEventListener('click', (e) => { const g = e.target.closest('.hot'); if (g) show(g.dataset.k); });
        svgWrap.addEventListener('keydown', (e) => { const g = e.target.closest('.hot'); if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); show(g.dataset.k); } });
        const left = h('div', { class: 'stack', style: { gap: '10px' } },
          h('p', { class: 'm0', html: 'An Android app is a bundle of <b>components</b> that Android can start and stop one at a time. There are exactly four kinds. <b>Click every part</b> of this podcast app.' }),
          h('div', { class: 'card white stack', style: { gap: '8px', minHeight: '330px' } }, h('div', { class: 'row', style: { justifyContent: 'space-between' } }, title, chip), body),
          prog);
        el.append(h('div', { class: 'split l fill' }, left, svgWrap));
        show('proc');
      },
    },

    /* ---------------- 3. Component matcher game ---------------- */
    {
      title: 'Which component should do the job? Sort 12 real tasks',
      kind: 'lab',
      render(el, ctx) {
        const { h } = ctx;
        const T = {
          act: { name: 'Activity', c: 'accent', def: 'a screen the user sees and touches', clue: 'Clue words: screen, page, button, shows',
            ico: '<rect x="11" y="3" width="22" height="38" rx="4"/><line x1="16" y1="12" x2="28" y2="12"/><line x1="16" y1="19" x2="28" y2="19"/><line x1="16" y1="26" x2="24" y2="26"/>' },
          svc: { name: 'Service', c: 'cpu', def: 'long-running work with no screen', clue: 'Clue words: keeps going, background, minutes',
            ico: '<path d="M36 22 A14 14 0 1 1 30 10"/><path d="M24 6 L31 10 L26 16"/>' },
          cp: { name: 'Content provider', c: 'mem', def: 'serves an app\'s stored data to whoever asks', clue: 'Clue words: shares, look up, other apps\' data',
            ico: '<ellipse cx="22" cy="10" rx="13" ry="5"/><path d="M9 10 V32 A13 5 0 0 0 35 32 V10"/><path d="M9 21 A13 5 0 0 0 35 21"/>' },
          br: { name: 'Broadcast receiver', c: 'intr', def: 'reacts briefly to a system-wide announcement', clue: 'Clue words: when Android announces…, notices',
            ico: '<line x1="22" y1="22" x2="22" y2="41"/><circle cx="22" cy="19" r="3"/><path d="M14 11 A11 11 0 0 0 14 27"/><path d="M30 11 A11 11 0 0 1 30 27"/><path d="M8 5 A19 19 0 0 0 8 33"/><path d="M36 5 A19 19 0 0 1 36 33"/>' },
        };
        const NOT = {
          act: 'an activity is a screen the user sees and touches.',
          svc: 'a service carries out long-running work that needs no screen.',
          cp: 'a content provider hands out an app\'s stored data through a standard query interface.',
          br: 'a broadcast receiver sleeps until an event is announced to everyone, then reacts briefly.',
        };
        const HINT = {
          act: 'Here the user is looking at, and touching, a screen.',
          svc: 'Here the work runs for a long time and needs no screen.',
          cp: 'Here stored data is being shared through a standard doorway.',
          br: 'Here the app reacts to an announcement that went out to every app.',
        };
        const S = [
          { k: 'act', t: 'The screen where you type a new text message.', s: 'Compose-message screen', why: 'The user looks at it and types into it, so it is an activity.' },
          { k: 'svc', t: 'Keeps a podcast playing after you switch to the web browser.', s: 'Podcast keeps playing', why: 'Long work, no screen, and it must outlive the switch to another app: a service.' },
          { k: 'cp', t: 'Lets a messaging app look up a friend\'s phone number that the Contacts app stores.', s: 'Contacts shared with apps', why: 'One app\'s stored data served to other apps through a standard interface: a content provider.' },
          { k: 'br', t: 'Pauses a big sync when Android announces "battery low".', s: 'Battery-low reaction', why: 'Reacting to a system-wide announcement is a broadcast receiver\'s job. Any long follow-up work would go to a service.' },
          { k: 'svc', t: 'Uploads 300 holiday photos to cloud storage while the phone is in your pocket.', s: 'Photo upload in pocket', why: 'Minutes of work with nothing to show on screen: a service.' },
          { k: 'act', t: 'The settings page with switches for notifications and dark mode.', s: 'Settings page', why: 'A page the user sees and taps is an activity.' },
          { k: 'br', t: 'Notices that a file download the app asked for has just finished.', s: 'Download-finished notice', why: 'Android announces "download complete"; a broadcast receiver hears it and reacts.' },
          { k: 'cp', t: 'Gives other apps read access to calendar events kept in an SQLite database.', s: 'Calendar data for others', why: 'A standard doorway to stored data (here an SQLite database) is a content provider.' },
          { k: 'act', t: 'The map screen that shows your route and a big Start button.', s: 'Route map screen', why: 'A screen with a button the user presses: an activity.' },
          { k: 'br', t: 'Stops a battery-hungry animation as soon as the screen is turned off.', s: 'Screen-off reaction', why: '"Screen turned off" is a system-wide announcement, so a broadcast receiver reacts to it.' },
          { k: 'svc', t: 'Downloads tomorrow\'s newspaper edition overnight, with no screen shown.', s: 'Overnight download', why: 'Long background work with no user interface is a service.' },
          { k: 'cp', t: 'A dictionary app shares its word list (stored in files) so keyboard apps can suggest words.', s: 'Word list for keyboards', why: 'Sharing stored data (files, here) with other apps is what a content provider is for.' },
        ];
        let i = 0, tried = false, firstRight = 0, answered = 0, placed = {};
        const dots = h('div', { class: 'row gap-s' });
        const score = h('span', { class: 'chip ok' });
        const qnum = h('span', { class: 'chip accent' });
        const qtext = h('div', { class: 'mt-q' });
        const fb = h('div', { class: 'callout m0 small', 'data-label': 'Your move' });
        const next = h('button', { class: 'btn primary', type: 'button', onclick: () => advance() }, 'Next task ▶');
        const bins = {};
        const binGrid = h('div', { class: 'grid-4', style: { flex: '1', minHeight: 0 } });
        Object.entries(T).forEach(([k, d]) => {
          const list = h('div', { class: 'stack', style: { gap: '4px' } });
          const count = h('span', { class: 'xs b muted' });
          const b = h('button', { class: 'bin', type: 'button', style: { '--bc': `var(--${d.c})`, '--bcb': `var(--${d.c}-bg)` }, onclick: () => pick(k) },
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', {}, d.name), count),
            h('span', { class: 'small', style: { color: 'var(--ink-2)' } }, d.def), h('div', { class: 'bin-line' }), list,
            h('div', { class: 'bin-foot', html: `<svg viewBox="0 0 44 44" width="40" height="40" fill="none" stroke-width="2.5" stroke-linecap="round" style="stroke:var(--${d.c});flex:none">${d.ico}</svg><span class="xs muted">${d.clue}</span>` }));
          bins[k] = { b, list, count };
          binGrid.append(b);
        });
        function paint() {
          dots.replaceChildren(...S.map((_, j) => h('span', { class: 'mdot' + (j < i ? ' ok' : j === i ? ' cur' : '') })));
          score.textContent = `${firstRight} right first try`;
          Object.entries(bins).forEach(([k, v]) => {
            const items = placed[k] || [];
            v.list.replaceChildren(...items.map((t) => h('span', { class: 'chip ' + T[k].c, style: { whiteSpace: 'normal', lineHeight: '1.3', padding: '3px 9px' } }, t)));
            v.count.textContent = `${items.length}/3`;
          });
          if (i >= S.length) {
            qnum.textContent = 'Done';
            qtext.innerHTML = `All 12 tasks sorted. You got <b>${firstRight} of 12</b> right on the first try.`;
            fb.className = 'callout tip m0 small'; fb.dataset.label = 'Pattern to remember';
            fb.innerHTML = 'Ask two questions: <b>does the user look at it?</b> (activity) · <b>does it run long without a screen?</b> (service). Otherwise it either <b>shares stored data</b> (content provider) or <b>reacts to an announcement</b> (broadcast receiver).';
            next.textContent = 'Play again ↺';
            return;
          }
          qnum.textContent = `Task ${i + 1} of ${S.length}`;
          qtext.textContent = S[i].t;
          next.textContent = 'Next task ▶';
        }
        function pick(k) {
          if (i >= S.length) return;
          const sc = S[i];
          if (placed.__done) return;
          if (k === sc.k) {
            if (!tried) firstRight++;
            answered++;
            (placed[k] = placed[k] || []).push(sc.s);
            placed.__done = true;
            fb.className = 'callout tip m0 small fade-in'; fb.dataset.label = tried ? 'Now you have it' : 'Right';
            fb.innerHTML = sc.why;
            bins[k].b.classList.remove('wrong'); bins[k].b.classList.add('flash');
            ctx.after(900, () => bins[k].b.classList.remove('flash'));
            next.disabled = false;
          } else {
            tried = true;
            fb.className = 'callout bad m0 small fade-in'; fb.dataset.label = 'Not quite';
            fb.innerHTML = `Not a ${T[k].name.toLowerCase()}: ${NOT[k]} ${HINT[sc.k]}`;
            const b = bins[k].b; b.classList.remove('wrong'); void b.offsetWidth; b.classList.add('wrong');
          }
          paint();
        }
        function setTask() {
          tried = false; delete placed.__done;
          next.disabled = i < S.length;
          if (i < S.length) { fb.className = 'callout m0 small'; fb.dataset.label = 'Your move'; fb.innerHTML = 'Click the component that should do this job. A wrong guess explains itself, then you can try again.'; }
          Object.values(bins).forEach((v) => v.b.classList.remove('wrong'));
          paint();
        }
        function reset() { i = 0; firstRight = 0; answered = 0; placed = {}; setTask(); }
        function advance() {
          if (i >= S.length) { reset(); return; }
          if (!placed.__done) { ctx.toast('Pick a component for this task first.'); return; }
          i++; setTask();
        }
        el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },
          h('div', { class: 'row', style: { justifyContent: 'space-between' } },
            h('div', { class: 'row gap-s' }, qnum, score), dots),
          h('div', { class: 'card white row nw', style: { gap: '16px', padding: '14px 18px', minHeight: '86px' } }, h('div', { class: 'grow' }, qtext)),
          binGrid,
          h('div', { class: 'row nw', style: { gap: '12px', alignItems: 'stretch' } }, h('div', { class: 'grow' }, fb), h('div', { style: { display: 'grid', placeItems: 'center' } }, next))));
        reset();
      },
    },

    /* ---------------- 4. The activity lifecycle as three nested lifetimes ---------------- */
    {
      title: 'Activity lifecycle: seven callbacks, three lifetimes',
      kind: 'learn',
      render(el, ctx) {
        const { h } = ctx;
        const INFO = {
          onCreate: { t: 'onCreate()', c: 'os', when: 'The activity is being created: first launch, after its process was killed and the user came back, or after a screen rotation.',
            does: 'Builds the screen layout and sets up its data. If Android hands it a saved-state bundle, it restores what the user had.', next: 'Created, still invisible. Android calls <code>onStart()</code> straight away.' },
          onStart: { t: 'onStart()', c: 'cpu', when: 'The activity is about to become visible.',
            does: 'Starts whatever the screen needs while it can be seen, such as refreshing what it displays.', next: 'Started (visible). <code>onResume()</code> follows straight away.' },
          onResume: { t: 'onResume()', c: 'ok', when: 'The activity is about to come to the very front and start receiving the user\'s taps.',
            does: 'Restarts animations, video, the camera preview or sensors that were paused.', next: '<b>Resumed</b> (running). It stays here until something comes in front of it.' },
          onPause: { t: 'onPause()', c: 'ok', when: 'Another <b>activity</b> is coming in front, even if it covers only part of the screen (a permission request, for example), or the user is starting to leave. An ordinary dialog drawn by the activity itself does not pause it.',
            does: 'Pauses animations and video and lets go of the camera. It must be <b>quick</b>: the next activity cannot start until it returns.', next: '<b><span class="t" data-t="Paused state">Paused</span></b>. Back to <code>onResume()</code> if the user returns; on to <code>onStop()</code> if it becomes fully hidden.' },
          onStop: { t: 'onStop()', c: 'cpu', when: 'The activity is no longer visible at all (the user pressed Home, or a full-screen activity covered it).',
            does: 'Saves the user\'s work (for example writes a draft to storage) and releases what it does not need while hidden.', next: '<b><span class="t" data-t="Stopped state">Stopped</span></b>, still in memory. Next comes <code>onRestart()</code>, <code>onDestroy()</code>, or a silent kill of the whole process.' },
          onRestart: { t: 'onRestart()', c: 'cpu', when: 'A stopped activity is about to be shown again because the user navigated back to it.',
            does: 'Anything special to do only when coming back from Stopped.', next: 'Android then calls <code>onStart()</code> and <code>onResume()</code>, as on a first launch.' },
          onDestroy: { t: 'onDestroy()', c: 'os', when: 'The activity is finishing (the user pressed Back, or the app called finish()), or Android is rebuilding it (rotation).',
            does: 'Final clean-up of anything created in onCreate().', next: 'Gone. Its entire lifetime is over.', warn: 'It is <b>not guaranteed</b>: if Android kills the process to reclaim memory, no callback runs at all. Save work in <code>onPause()</code> or <code>onStop()</code>, never only here.' },
          entire: { t: 'Entire lifetime', c: 'os', when: 'The <span class="t">entire lifetime</span> runs from <code>onCreate()</code> to <code>onDestroy()</code>: the outer box.',
            does: 'Anything that must exist for the activity\'s whole life is set up in onCreate() and released in onDestroy().', next: 'The ring inside it but outside the middle box is the <b>Stopped</b> state: the activity still exists but cannot be seen.' },
          visible: { t: 'Visible lifetime', c: 'cpu', when: 'The <span class="t">visible lifetime</span> runs from <code>onStart()</code> to <code>onStop()</code>: the middle box. The user can see the activity, at least partly.',
            does: 'It may be entered and left many times as the user switches away and back.', next: 'The ring inside it but outside the inner box is the <b>Paused</b> state: visible but without the user\'s focus.' },
          fore: { t: 'Foreground lifetime', c: 'ok', when: 'The <span class="t">foreground lifetime</span> runs from <code>onResume()</code> to <code>onPause()</code>: the inner box. The activity is in front of everything and gets every tap.',
            does: 'It can switch in and out very often (every permission window, every screen-off), so code here must be light.', next: 'Inside this box the activity is <b>Resumed</b>, also called running.' },
          killed: { t: 'Process killed', c: 'intr', when: 'Memory is short and the app\'s activities are all Paused or (far more often) Stopped, so Android kills the whole process.',
            does: 'Nothing: <b>no callback runs</b>. The activity objects vanish with the process. What survives is a small bundle of state that Android asked the activity to save (in <code>onSaveInstanceState()</code>) as it stopped, and that Android keeps outside the app\'s process.', next: 'If the user navigates back, Android starts a new process and calls <code>onCreate()</code> with the saved state, so the screen looks as it was.' },
        };
        const pill = (k, x, y) => `<g class="hot gate" data-k="${k}" tabindex="0"><rect class="fr" x="${x - 47}" y="${y - 13}" width="94" height="26" rx="13"/><text x="${x}" y="${y + 5}" text-anchor="middle">${k}()</text></g>`;
        const svgHTML = `
<svg viewBox="0 0 680 478" width="100%" role="img" aria-label="Three nested boxes: entire lifetime, visible lifetime and foreground lifetime, with lifecycle callbacks on their edges">
  <g class="hot" data-k="entire" tabindex="0"><rect class="s-os fr" x="62" y="30" width="556" height="378" rx="18" stroke-width="2"/>
    <text x="80" y="54" font-size="15" font-weight="800" style="fill:var(--os)">Entire lifetime</text>
    <text x="360" y="386" text-anchor="middle" font-size="14" font-weight="800">STOPPED <tspan class="s-sub" font-weight="500">hidden, kept in memory</tspan></text></g>
  <g class="hot" data-k="visible" tabindex="0"><rect class="s-cpu fr" x="166" y="76" width="348" height="276" rx="16" stroke-width="2"/>
    <text x="182" y="99" font-size="15" font-weight="800" style="fill:var(--cpu)">Visible lifetime</text>
    <text x="340" y="333" text-anchor="middle" font-size="14" font-weight="800">PAUSED <tspan class="s-sub" font-weight="500">seen, no focus</tspan></text></g>
  <g class="hot" data-k="fore" tabindex="0"><rect class="s-ok fr" x="270" y="118" width="140" height="190" rx="14" stroke-width="2"/>
    <text x="340" y="140" text-anchor="middle" font-size="14" font-weight="800" style="fill:var(--ok)">Foreground</text>
    <text x="340" y="179" text-anchor="middle" font-size="15" font-weight="800">RESUMED</text>
    <text x="340" y="197" text-anchor="middle" font-size="13" class="s-sub">(running)</text>
    <text x="340" y="268" text-anchor="middle" font-size="13" class="s-sub">user is</text><text x="340" y="285" text-anchor="middle" font-size="13" class="s-sub">touching it</text></g>
  <line x1="166" y1="277" x2="166" y2="238" class="s-line" marker-end="url(#arr)"/>
  <path d="M236 381 C 180 381, 150 340, 160 306" class="s-muted" stroke-width="2" marker-end="url(#arr-muted)"/>
  <text x="38" y="196" text-anchor="middle" font-size="13" font-weight="700" class="s-sub">launch</text>
  <text x="652" y="196" text-anchor="middle" font-size="13" font-weight="700" class="s-sub">gone</text>
  ${pill('onCreate', 62, 223)}${pill('onStart', 166, 223)}${pill('onResume', 270, 223)}
  ${pill('onPause', 410, 223)}${pill('onStop', 514, 223)}${pill('onDestroy', 618, 223)}
  ${pill('onRestart', 166, 290)}
  <path d="M470 346 V418" fill="none" style="stroke:var(--intr)" stroke-width="2" stroke-dasharray="6 5" marker-end="url(#arr-intr)"/>
  <path d="M590 398 V418" fill="none" style="stroke:var(--intr)" stroke-width="2" stroke-dasharray="6 5" marker-end="url(#arr-intr)"/>
  <g class="hot" data-k="killed" tabindex="0"><rect class="s-intr fr" x="400" y="422" width="240" height="50" rx="12" stroke-width="2" stroke-dasharray="7 5"/>
    <text x="520" y="443" text-anchor="middle" font-size="14" font-weight="800" style="fill:var(--intr)">Process killed</text>
    <text x="520" y="462" text-anchor="middle" font-size="13">no callback runs</text></g>
  <path d="M398 447 H 24 V 240" fill="none" style="stroke:var(--intr)" stroke-width="2" stroke-dasharray="6 5" marker-end="url(#arr-intr)"/>
  <text x="212" y="440" text-anchor="middle" font-size="13" font-weight="700" style="fill:var(--intr)">user comes back → new process → onCreate()</text>
</svg>`;
        const svgWrap = h('div', { html: svgHTML, style: { display: 'grid', placeItems: 'center', height: '100%' } });
        const title = h('h3', { class: 'm0' });
        const chip = h('span', { class: 'chip' });
        const body = h('div', { class: 'stack', style: { gap: '8px' } });
        const seenCb = new Set();
        const cbCount = h('span', { class: 'chip accent' });
        function show(k) {
          const d = INFO[k];
          svgWrap.querySelectorAll('.hot').forEach((g) => g.classList.toggle('sel', g.dataset.k === k));
          if (/^on/.test(k)) seenCb.add(k);
          cbCount.textContent = `callbacks opened: ${seenCb.size}/7`;
          title.textContent = d.t;
          chip.className = 'chip ' + d.c;
          chip.textContent = /^on/.test(k) ? 'callback' : k === 'killed' ? 'no callback' : 'lifetime';
          body.replaceChildren(
            h('p', { class: 'm0', html: '<b>When:</b> ' + d.when }),
            h('p', { class: 'm0 small', html: '<b>' + (/^on/.test(k) ? 'A well-written app' : 'Meaning') + ':</b> ' + d.does }),
            h('p', { class: 'm0 small', html: '<b>' + (/^on/.test(k) ? 'Afterwards' : 'State') + ':</b> ' + d.next }),
            ...(d.warn ? [h('div', { class: 'callout warn m0 small fade-in', 'data-label': 'Common mistake', html: d.warn })] : []));
        }
        svgWrap.addEventListener('click', (e) => { const g = e.target.closest('.hot'); if (g) show(g.dataset.k); });
        svgWrap.addEventListener('keydown', (e) => { const g = e.target.closest('.hot'); if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); show(g.dataset.k); } });
        const right = h('div', { class: 'stack', style: { gap: '10px' } },
          h('p', { class: 'm0', html: 'An activity moves through a few states. Every move is announced by a <span class="t">lifecycle callback</span>, a method Android calls on the activity. Read the boxes as three <b>nested lifetimes</b>: you enter a box through the callback on its left edge and leave through the one on its right.' }),
          h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'xs muted b' }, 'Click any pill or box, including the red one.'), cbCount),
          h('div', { class: 'card white stack', style: { gap: '8px', minHeight: '290px', flex: 'none' } }, h('div', { class: 'row', style: { justifyContent: 'space-between' } }, title, chip), body));
        el.append(h('div', { class: 'split r fill' }, svgWrap, right));
        show('onCreate');
      },
    },

    /* ---------------- 5. Lifecycle simulator ---------------- */
    {
      title: 'Lifecycle simulator: use the app, watch the callbacks fire',
      kind: 'explore',
      core: true,
      render(el, ctx) {
        const { h } = ctx;
        if (ctx.narrow) el.classList.add('nar'); // phone layout (see css)
        const NAME = { A: 'NoteList', B: 'NoteEditor' };
        const COL = { A: 'accent', B: 'io' };
        const LABEL = { none: 'not created', created: 'Created', started: 'Started', resumed: 'Resumed (running)', paused: 'Paused', stopped: 'Stopped', destroyed: 'Destroyed', killed: 'Killed · state saved' };
        const CHIP = { resumed: 'ok', paused: 'warn', stopped: 'cpu', killed: 'intr', created: 'os', started: 'os' };
        const POS = { created: [16, 52], started: [38, 52], resumed: [64, 52], paused: [64, 80], stopped: [64, 100] };
        const st = {};
        let busy = false, n = 0, nextPid = 4211;
        const fresh = () => Object.assign(st, { proc: false, pid: 0, screen: 'home', popup: false, orient: 'portrait', stack: [],
          acts: { A: { state: 'none', orient: 'portrait', last: '' }, B: { state: 'none', orient: 'portrait', last: '' } } });
        const top = () => st.stack[st.stack.length - 1];
        const logEl = h('div', { class: 'log grow simlog' });
        function log(who, text, why) {
          n++;
          const main = who === 'sys' ? `<span class="sys">${text}</span>` : `<span><b style="color:var(--${COL[who]})">${who}</b>.${text}${why ? ` <span class="why">${why}</span>` : ''}</span>`;
          logEl.append(h('div', { class: 'fade-in', html: `<span class="n">${n}</span>${main}` }));
          logEl.scrollTop = logEl.scrollHeight;
        }
        const cb = (who, name, to, why) => ({ who, name, to, why });
        const newProc = () => { const pid = nextPid; nextPid += 177; return [{ fn: () => { st.proc = true; st.pid = pid; } }, { sys: `Android starts a new process for Notes (pid ${pid}).` }]; };
        const createSeq = (X, why) => [cb(X, 'onCreate', 'created', why), cb(X, 'onStart', 'started', 'about to be visible'), cb(X, 'onResume', 'resumed', 'in front: taps go here')];
        function bringFront(X) {
          const a = st.acts[X];
          if (!st.proc) return [...newProc(), ...createSeq(X, 'rebuilt from its saved state')];
          if (a.state === 'killed') return createSeq(X, 'its old instance died with the old process; rebuilt from saved state');
          if (a.state === 'paused') return [cb(X, 'onResume', 'resumed', 'back in front')];
          if (a.state === 'stopped' && a.orient !== st.orient) return [cb(X, 'onDestroy', 'destroyed', 'built for the old orientation'), ...createSeq(X, 'rebuilt for the new orientation')];
          return [cb(X, 'onRestart', 'stopped', 'coming back from Stopped'), cb(X, 'onStart', 'started', 'visible again'), cb(X, 'onResume', 'resumed', 'in front again')];
        }
        async function run(seq) {
          busy = true; paint();
          for (const it of seq) {
            if (it.fn) { it.fn(); paint(); continue; }
            if (it.sys) { log('sys', it.sys); paint(); await ctx.sleep(300); if (!ctx.alive) return; continue; }
            const a = st.acts[it.who];
            a.state = it.to; a.last = it.name + '()';
            if (it.name === 'onCreate') a.orient = st.orient;
            log(it.who, `<code>${it.name}()</code>`, it.why);
            paint();
            await ctx.sleep(430);
            if (!ctx.alive) return;
          }
          busy = false; paint();
        }
        const can = {
          launch: () => st.screen === 'home' && !st.stack.length,
          open: () => st.screen === 'app' && top() === 'A' && st.acts.A.state === 'resumed' && !st.popup,
          popOn: () => st.screen === 'app' && st.acts[top()].state === 'resumed' && !st.popup,
          popOff: () => st.popup,
          home: () => st.screen === 'app',
          ret: () => st.screen === 'home' && st.stack.length > 0,
          rotate: () => st.screen === 'app' && st.acts[top()].state === 'resumed' && !st.popup,
          back: () => st.screen === 'app',
          kill: () => st.proc && (st.screen === 'home' || st.popup),
        };
        const act = {
          launch() {
            const seq = st.proc ? [{ sys: 'The Notes process is still cached (an empty process), so Android reuses it: a quick "warm" start.' }] : newProc();
            run([...seq, { fn: () => { st.stack.push('A'); st.screen = 'app'; } }, ...createSeq('A', 'launch intent: build the list screen')]);
          },
          open() {
            run([cb('A', 'onPause', 'paused', 'B is about to come in front'), { fn: () => st.stack.push('B') }, ...createSeq('B', 'intent: open the editor'),
              cb('A', 'onStop', 'stopped', 'only now, fully covered, is A stopped')]);
          },
          popOn() { run([{ fn: () => { st.popup = true; } }, cb(top(), 'onPause', 'paused', 'a permission window, itself an activity, covers part of the screen: still visible, no focus')]); },
          popOff() { const X = top(); run([{ fn: () => { st.popup = false; } }, ...bringFront(X)]); },
          home() {
            const X = top(), s0 = st.acts[X].state;
            const seq = s0 === 'resumed' ? [cb(X, 'onPause', 'paused', 'the user is leaving')] : [];
            seq.push({ fn: () => { st.screen = 'home'; st.popup = false; } });
            if (s0 === 'resumed' || s0 === 'paused') seq.push(cb(X, 'onStop', 'stopped', 'fully hidden: save the draft now'));
            else seq.push({ sys: 'No callback: the Notes process is already gone.' });
            run(seq);
          },
          ret() { const X = top(); run([{ fn: () => { st.screen = 'app'; } }, ...bringFront(X)]); },
          rotate() {
            const X = top(), to = st.orient === 'portrait' ? 'landscape' : 'portrait';
            const seq = [{ sys: 'Rotation changes the screen\'s shape. By default Android saves the screen\'s state, destroys the activity and builds a new one for the new shape.' },
              cb(X, 'onPause', 'paused'), cb(X, 'onStop', 'stopped'), cb(X, 'onDestroy', 'destroyed', `old ${st.orient} instance thrown away`),
              { fn: () => { st.orient = to; } }, ...createSeq(X, `new ${to} instance, saved state restored`)];
            if (X === 'B') seq.push({ sys: 'A stays Stopped underneath; Android rebuilds it for the new shape only when it is shown again.' });
            run(seq);
          },
          back() {
            if (st.popup) { const X = top(); run([{ fn: () => { st.popup = false; } }, { sys: 'Back closes the pop-up first.' }, ...bringFront(X)]); return; }
            if (st.stack.length === 2) {
              run([cb('B', 'onPause', 'paused', 'the user is leaving B'), ...bringFront('A'), cb('B', 'onStop', 'stopped'),
                cb('B', 'onDestroy', 'destroyed', 'finished and removed from the back stack'), { fn: () => st.stack.pop() }]);
              return;
            }
            run([cb('A', 'onPause', 'paused', 'Back on the last screen'), { fn: () => { st.screen = 'home'; } }, cb('A', 'onStop', 'stopped'),
              cb('A', 'onDestroy', 'destroyed', 'finished: the back stack is empty'), { fn: () => st.stack.pop() },
              { sys: 'No activities are left, yet Android keeps the process alive as an <b>empty process</b>: a cache that makes the next launch faster.' },
              { sys: '(Android 12 and later usually just move the app to the background here instead of finishing it; this is the classic behaviour.)' }]);
          },
          kill() {
            const had = st.stack.length, vis = st.popup;
            run([{ sys: `Memory is short. Android kills the Notes process (pid ${st.pid}) without any warning.` },
              { fn: () => { st.proc = false; st.pid = 0; ['A', 'B'].forEach((x) => { const a = st.acts[x]; a.state = st.stack.includes(x) ? 'killed' : 'none'; a.last = st.stack.includes(x) ? '(none: killed)' : ''; }); } },
              { sys: had ? 'No callback runs, not even <code>onDestroy()</code>. The back stack and each activity\'s saved state survive outside the process.' : 'It was an empty process, so nothing is lost; the next launch just needs a new process (a "cold" start).' },
              ...(vis ? [{ sys: 'Killing a Paused (visible) app is rare: Android does it only when memory is desperately short.' }] : [])]);
          },
        };
        /* ---- phone ---- */
        const phone = h('div', { class: 'phone' });
        const go = (k) => () => { if (busy) return; if (can[k]()) act[k](); else ctx.toast('That action does not apply right now.'); };
        function drawPhone() {
          phone.classList.toggle('land', st.orient === 'landscape');
          const status = h('div', { class: 'ph-status' }, h('span', {}, '9:41'), h('span', {}, st.proc ? 'Notes: pid ' + st.pid : 'no Notes process'));
          const screen = h('div', { class: 'ph-screen' });
          if (st.screen === 'home') {
            const icons = [['Notes', 'accent'], ['Mail', 'cpu'], ['Maps', 'mem'], ['Music', 'io'], ['Camera', 'os'], ['Clock', 'proc']];
            screen.append(h('div', { class: 'ph-bar', style: { background: 'var(--panel-3)', color: 'var(--ink-2)' } }, 'Home screen'),
              h('div', { class: 'ph-home' }, ...icons.map(([nm, c], i) => h('button', { class: 'ph-icon', type: 'button', disabled: i > 0, 'aria-label': nm, onclick: i ? null : go(st.stack.length ? 'ret' : 'launch') },
                h('span', { class: 'ph-ico', style: { background: `var(--${c})` } }, nm[0]), h('span', {}, nm)))));
          } else {
            const X = top(), a = st.acts[X];
            const live = st.proc && a.state !== 'killed';
            const body = h('div', { class: 'ph-body' + (live && (a.state === 'resumed' || a.state === 'paused') ? '' : ' dim') });
            if (!live) body.append(h('p', { class: 'small muted center m0', style: { marginTop: '30px' } }, 'The Notes process is gone.'));
            else if (X === 'A') body.append(...['Buy milk, eggs, coffee', 'OS lab moved to Friday', 'Gift ideas for Sam'].map((t, i) => h('button', { class: 'ph-note', type: 'button', onclick: i === 0 ? go('open') : null }, t)));
            else body.append(h('div', { class: 'ph-edit' }, 'Buy milk, eggs, coffee', h('b', { class: 'pulse' }, '|')), h('div', { class: 'xs muted' }, 'Saved state keeps this text safe.'));
            screen.append(h('div', { class: 'ph-bar', style: { background: `var(--${COL[X]}-bg)`, color: `var(--${COL[X]})` } }, X === 'A' ? 'Notes' : 'Edit note'), body);
          }
          if (st.popup) screen.append(h('div', { class: 'ph-pop' }, h('div', { class: 'ph-popcard' }, h('b', {}, 'Allow Notes to record audio?'),
            h('div', { class: 'row gap-s', style: { justifyContent: 'flex-end' } }, h('button', { class: 'btn sm', type: 'button', onclick: go('popOff') }, 'Deny'), h('button', { class: 'btn sm primary', type: 'button', onclick: go('popOff') }, 'Allow')))));
          phone.replaceChildren(status, screen, h('div', { class: 'ph-nav' }, h('button', { class: 'ph-navb', type: 'button', onclick: go('back') }, '◁ Back'), h('button', { class: 'ph-navb', type: 'button', onclick: go('home') }, '○ Home')));
        }
        /* ---- controls, cards ---- */
        const B = {};
        const mk = (k, label, cls) => (B[k] = h('button', { class: 'btn sm ' + (cls || ''), type: 'button', onclick: go(k) }, label));
        const btns = h('div', { class: 'simbtns' }, mk('launch', '▶ Launch Notes', 'primary'), mk('open', '→ Open a note'), mk('popOn', '▣ Pop-up appears'), mk('popOff', '▢ Pop-up closes'),
          mk('home', '○ Home'), mk('ret', '↩ Return to Notes'), mk('rotate', '↻ Rotate phone'), mk('back', '◁ Back'), mk('kill', '✗ Low memory: kill', 'intr'),
          h('button', { class: 'btn sm ghost', type: 'button', onclick: () => { if (busy) return; fresh(); n = 0; logEl.innerHTML = ''; log('sys', 'Reset. Tap <b>Launch Notes</b> to begin.'); paint(); } }, '⟲ Reset'));
        const procCard = h('div', { class: 'card tight row', style: { justifyContent: 'space-between' } });
        const stackRow = h('div', { class: 'row gap-s', style: { minHeight: '28px' } });
        const cards = {};
        ['A', 'B'].forEach((X) => {
          const tok = ctx.s('g', { class: 'tok' }, ctx.s('circle', { r: 7, style: `fill:var(--${COL[X]})` }));
          const svg = ctx.s('svg', { viewBox: '0 0 128 112', width: '128', class: 'lt' },
            ctx.s('rect', { class: 'e', x: 2, y: 2, width: 124, height: 108, rx: 12 }), ctx.s('rect', { class: 'v', x: 30, y: 16, width: 68, height: 74, rx: 10 }),
            ctx.s('rect', { class: 'f', x: 46, y: 32, width: 36, height: 38, rx: 8 }), tok);
          const chip = h('span', { class: 'chip' }), last = h('span', { class: 'xs muted' });
          const lts = ['Entire', 'Visible', 'Foreground'].map((t, i) => h('span', { class: 'chip ltchip ' + ['os', 'cpu', 'ok'][i], title: t + ' lifetime' }, t));
          cards[X] = { svg, tok, chip, last, lts };
          cards[X].el = h('div', { class: 'actcard', style: { '--ac': `var(--${COL[X]})` } }, svg,
            h('div', { class: 'stack', style: { gap: '5px' } }, h('div', {}, h('b', { style: { color: `var(--${COL[X]})` } }, X), ' ', h('span', { class: 'b' }, NAME[X])), h('div', {}, chip), h('div', { class: 'xs muted b' }, 'Lifetimes it is inside:'), h('div', { class: 'row', style: { gap: '4px' } }, ...lts), last));
        });
        function paint() {
          drawPhone();
          Object.keys(can).forEach((k) => { B[k].disabled = busy || !can[k](); });
          const imp = !st.proc ? ['none', ''] : st.screen === 'app' && !st.popup ? ['foreground', 'ok'] : st.screen === 'app' ? ['visible', 'proc'] : st.stack.length ? ['background', 'warn'] : ['empty', 'bad'];
          stackRow.replaceChildren(h('span', { class: 'small b', html: '<span class="t">Back stack</span> (top on the right):' }),
            ...(st.stack.length ? st.stack.map((X, k) => h('span', { class: 'row gap-s' }, k ? h('span', { class: 'muted' }, '▸') : '', h('span', { class: 'chip ' + COL[X] }, X + ' ' + NAME[X]))) : [h('span', { class: 'xs muted' }, 'empty')]));
          procCard.replaceChildren(h('span', { class: 'b' }, 'Notes process'), h('span', { class: 'chip' }, st.proc ? 'pid ' + st.pid : 'no process'), h('span', { class: 'chip ' + imp[1] }, 'importance: ' + imp[0]));
          ['A', 'B'].forEach((X) => {
            const a = st.acts[X], c = cards[X];
            const lvl = { created: 1, stopped: 1, started: 2, paused: 2, resumed: 3 }[a.state] || 0;
            c.svg.querySelector('.e').classList.toggle('on', lvl >= 1); c.svg.querySelector('.v').classList.toggle('on', lvl >= 2); c.svg.querySelector('.f').classList.toggle('on', lvl >= 3);
            c.lts.forEach((e, i) => e.classList.toggle('off', lvl < i + 1));
            const p = POS[a.state];
            c.tok.style.opacity = p ? 1 : 0;
            if (p) c.tok.style.transform = `translate(${p[0]}px, ${p[1]}px)`;
            c.chip.className = 'chip ' + (CHIP[a.state] || '');
            c.chip.textContent = LABEL[a.state];
            c.last.innerHTML = a.last ? 'last callback: <b class="mono">' + a.last + '</b>' : 'no callbacks yet';
          });
        }
        fresh();
        log('sys', 'The phone is on the home screen and Notes is not running. Tap <b>Launch Notes</b>.');
        const mid = h('div', { class: 'stack', style: { gap: '8px', minHeight: 0 } }, h('h4', { class: 'm0' }, 'What the user does'), btns, stackRow,
          h('p', { class: 'small muted m0', html: 'Reminder: an <span class="t">activity</span> comes up through <code>onCreate()</code> → <code>onStart()</code> → <code>onResume()</code> and goes down through <code>onPause()</code> → <code>onStop()</code> → <code>onDestroy()</code>; <code>onRestart()</code> brings a Stopped one back.' }),
          h('h4', { class: 'm0' }, 'Callbacks, in the order Android calls them'), logEl);
        const right = h('div', { class: 'stack', style: { gap: '8px' } }, procCard, cards.A.el, cards.B.el,
          h('div', { class: 'callout tip m0 small', 'data-label': 'Try these', html: '① Launch, then Pop-up: only <code>onPause()</code> runs. ② Open a note, then Back: A restarts <i>before</i> B is destroyed. ③ Home, Low memory, Return: <code>onCreate()</code> again. ④ Rotate: six callbacks.' }));
        el.append(h('div', { class: 'simgrid' }, h('div', { class: 'phone-wrap' }, phone), mid, right));
        paint();
      },
    },

    /* ---------------- 6. One process, one main thread: freeze vs worker ---------------- */
    {
      title: 'One process, one main thread: freeze it or free it',
      kind: 'explore',
      render(el, ctx) {
        const { h, s } = ctx;
        if (ctx.narrow) el.classList.add('nar'); // phone layout (see css)
        const X0 = 70, PX = 48, DL = 8, END = 10, ANR = 5;
        const xs = (t) => X0 + t * PX;
        let mode = 'main', running = false, t = 0, taps = [], likes = 0, anr = null, done = false, closed = false, angle = 0, shownPct = 0, shownLikes = 0;
        /* ---- timeline ---- */
        const svg = s('svg', { viewBox: '0 0 580 206', width: '100%' });
        const g = (cls) => s('g', cls ? { class: cls } : {});
        const axis = g(), mainRed = s('rect', { x: X0, y: 40, height: 38, width: 0, rx: 6, class: 's-bad', 'stroke-width': 1.5 });
        const mainGreen = s('rect', { x: X0, y: 40, height: 38, width: 0, rx: 6, class: 's-ok', 'stroke-width': 1.5 });
        const workBar = s('rect', { x: X0, y: 118, height: 38, width: 0, rx: 6, class: 's-thread', 'stroke-width': 1.5 });
        const mainLbl = s('text', { x: X0 + 10, y: 64, 'font-size': 13, 'font-weight': 700 }), workLbl = s('text', { x: X0 + 10, y: 142, 'font-size': 13, 'font-weight': 700 });
        const marks = g(), cursor = s('line', { y1: 26, y2: 166, class: 's-line', 'stroke-width': 1.5, 'stroke-dasharray': '3 3' });
        for (let k = 0; k <= END; k++) axis.append(s('line', { x1: xs(k), x2: xs(k), y1: 166, y2: 172, class: 's-line', 'stroke-width': 1.2 }), s('text', { x: xs(k), y: 188, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, k + (k === END ? ' s' : '')));
        svg.append(s('text', { x: 4, y: 64, 'font-size': 13, 'font-weight': 800, style: 'fill:var(--thread)' }, 'main'), s('text', { x: 4, y: 142, 'font-size': 13, 'font-weight': 800, style: 'fill:var(--thread)' }, 'worker'),
          s('rect', { x: X0, y: 40, width: END * PX, height: 38, rx: 6, class: 's-panel', 'stroke-width': 1 }), s('rect', { x: X0, y: 118, width: END * PX, height: 38, rx: 6, class: 's-panel', 'stroke-width': 1 }),
          s('line', { x1: X0, x2: X0 + END * PX, y1: 166, y2: 166, class: 's-line', 'stroke-width': 1.2 }), axis, mainGreen, mainRed, workBar, mainLbl, workLbl, marks, cursor,
          s('text', { x: 4, y: 202, 'font-size': 13, class: 's-sub' }, 'time →'));
        /* ---- phone ---- */
        const spin = s('g', {}, s('circle', { cx: 0, cy: 0, r: 20, class: 's-muted', 'stroke-width': 5 }), s('path', { d: 'M0 -20 A20 20 0 0 1 20 0', fill: 'none', style: 'stroke:var(--thread)', 'stroke-width': 5, 'stroke-linecap': 'round' }));
        const spinSvg = s('svg', { viewBox: '-26 -26 52 52', width: 52, height: 52 }, spin);
        const likeBtn = h('button', { class: 'btn sm', type: 'button', onclick: () => tap(false) });
        const waiting = h('div', { class: 'xs b', style: { color: 'var(--bad)', minHeight: '18px' } });
        const meter = h('div', { class: 'meter' }, h('i', { style: { width: '0%', background: 'var(--thread)' } }));
        const pctTxt = h('div', { class: 'xs muted' });
        const album = h('div', { class: 'ph-album' });
        const anrBox = h('div', { class: 'ph-pop', style: { display: 'none' } }, h('div', { class: 'ph-popcard' }, h('b', {}, 'Photo Share isn\'t responding'), h('span', { class: 'xs muted' }, 'Do you want to close it?'),
          h('div', { class: 'row gap-s', style: { justifyContent: 'flex-end' } }, h('button', { class: 'btn sm', type: 'button', onclick: () => anrChoice(true) }, 'Close app'), h('button', { class: 'btn sm primary', type: 'button', onclick: () => anrChoice(false) }, 'Wait'))));
        const appBody = h('div', { class: 'ph-body', style: { alignItems: 'center', textAlign: 'center', gap: '10px' } },
          spinSvg, h('span', { class: 'xs muted' }, 'animation drawn by the main thread'), likeBtn, waiting, h('div', { style: { width: '100%' } }, h('div', { class: 'xs b', style: { textAlign: 'left' } }, 'Resizing 24 photos'), meter, pctTxt), album);
        const closedMsg = h('div', { class: 'ph-body', style: { display: 'none', justifyContent: 'center', textAlign: 'center' } }, h('b', {}, 'App closed'), h('span', { class: 'small muted' }, 'Its process was killed and the half-finished resizing was lost.'));
        const phone = h('div', { class: 'phone', style: { width: '206px', height: '430px' } }, h('div', { class: 'ph-status' }, h('span', {}, '9:41'), h('span', {}, 'Photo Share')),
          h('div', { class: 'ph-screen' }, h('div', { class: 'ph-bar', style: { background: 'var(--thread-bg)', color: 'var(--thread)' } }, 'Photo Share'), appBody, closedMsg, anrBox));
        /* ---- controls ---- */
        const clock = h('span', { class: 'chip accent num' }), fps = h('span', { class: 'chip' });
        const narr = h('div', { class: 'callout m0 small', 'data-label': 'What is happening' });
        const startBtn = h('button', { class: 'btn primary', type: 'button', onclick: () => start() }, '▶ Tap "Resize & share"');
        const codeBox = h('div', {});
        const CODE = {
          main: `void onResizeTap() {          // main thread runs this on a tap
  Album a = resize(album);    // CPU-heavy: MAIN busy for 8 s
  show(a);                    // screen frozen until we get here
}                             // only now can it draw again`,
          worker: `void onResizeTap() {          // main thread runs this on a tap
  new Thread(() -> {          // create a worker thread
    Album a = resize(album);  // CPU-heavy work on the WORKER
    runOnUiThread(() ->       // queue a job for the main thread:
        show(a));             // only it may touch the screen
  }).start();                 // start the worker, return at once
}                             // main thread is free again`,
        };
        const seg = ctx.ui.seg([{ value: 'main', label: 'Main thread' }, { value: 'worker', label: 'Worker thread' }], mode, (v) => { mode = v; reset(); });
        function setNarr(cls, label, html) { narr.className = 'callout m0 small fade-in ' + cls; narr.dataset.label = label; narr.innerHTML = html; }
        function reset() {
          running = false; t = 0; taps = []; likes = 0; anr = null; done = false; closed = false; shownPct = 0; shownLikes = 0;
          marks.replaceChildren();
          codeBox.replaceChildren(ctx.ui.code(CODE[mode], { lang: 'c', nums: false, fontSize: 13 }));
          setNarr('', 'What is happening', mode === 'main'
            ? 'This version resizes the photos <b>inside the tap handler</b>, on the main thread. Press the button, then tap <b>Like</b> on the phone.'
            : 'This version hands the resizing to a <b>worker thread</b>. Press the button, then tap <b>Like</b> on the phone.');
          draw();
        }
        function start() {
          if (running) return;
          reset(); running = true;
          setNarr(mode === 'main' ? 'warn' : 'tip', 'Resizing started', mode === 'main' ? 'The main thread is now stuck inside <code>resize()</code>. It cannot draw frames or handle taps until the resizing ends.' : 'The worker thread resizes the photos; the main thread keeps drawing frames and handling taps.');
        }
        const busy = () => mode === 'main' && running && t < DL && !closed;
        function tap(auto) {
          if (closed) return;
          const rec = { t, auto, handled: busy() ? null : t };
          if (running || t > 0) taps.push(rec);
          if (rec.handled != null) likes++;
          if (running && t < END) {
            const x = xs(t);
            marks.append(s('path', { d: `M${x} 36 l-6 -10 h12 z`, style: 'fill:var(--io)' }), s('text', { x, y: 22, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, style: 'fill:var(--io)' }, auto ? 'tap' : 'you'));
          }
          if (running && busy()) setNarr('bad', 'Tap waiting', `A tap arrived at ${t.toFixed(1)} s but the main thread is busy, so it waits in the queue. Nothing on screen reacts.`);
          else if (running && mode === 'worker') setNarr('tip', 'Tap handled', `A tap at ${t.toFixed(1)} s was handled at once: the main thread is free because the worker does the resizing.`);
        }
        function anrChoice(close) {
          anr.dismissed = true;
          if (close) { closed = true; running = false; setNarr('bad', 'App closed', 'The user gave up. Android killed the process, and the half-finished resizing was lost with it.'); }
          else setNarr('warn', 'Waiting', 'The user chose to wait. The app is still frozen until the resizing ends at 8 s.');
          draw();
        }
        function step(dt) {
          if (!running) return;
          const prev = t; t = Math.min(END, t + dt);
          if (prev < 1 && t >= 1) tap(true);
          const pend = taps.filter((x) => x.handled == null);
          if (mode === 'main' && !anr && pend.length && t - pend[0].t >= ANR) {
            anr = { at: t, dismissed: false };
            marks.append(s('line', { x1: xs(t), x2: xs(t), y1: 30, y2: 166, style: 'stroke:var(--bad)', 'stroke-width': 2.5 }), s('text', { x: xs(t) - 6, y: 108, 'text-anchor': 'end', 'font-size': 13, 'font-weight': 800, style: 'fill:var(--bad)' }, 'ANR: a tap waited 5 s'));
            setNarr('bad', 'Application Not Responding', 'A tap has waited 5 seconds, so Android shows the <span class="t">ANR</span> dialog. Choose <b>Wait</b> or <b>Close app</b> on the phone.');
          }
          if (prev < DL && t >= DL && !closed) {
            done = true;
            if (mode === 'main') {
              pend.forEach((x) => { x.handled = DL; likes++; marks.append(s('line', { x1: xs(x.t), x2: xs(DL), y1: 31, y2: 31, style: 'stroke:var(--io)', 'stroke-width': 2, 'stroke-dasharray': '4 3' })); });
              setNarr('warn', 'Finished at 8 s', 'Only now does the main thread return from <code>resize()</code>, handle the waiting taps and redraw.' + (anr ? ' Too late: the user already saw the ANR dialog.' : ''));
            } else {
              marks.append(s('line', { x1: xs(DL), x2: xs(DL), y1: 118, y2: 82, style: 'stroke:var(--thread)', 'stroke-width': 2 , 'marker-end': 'url(#arr-thread)' }), s('text', { x: xs(DL) + 6, y: 104, 'font-size': 13, 'font-weight': 700, style: 'fill:var(--thread)' }, 'post result'));
              setNarr('tip', 'Finished at 8 s', 'The worker hands the result to the main thread with <code>runOnUiThread()</code>, and the main thread shows it. The screen never froze.');
            }
          }
          if (t >= END) running = false;
        }
        function draw() {
          const frozen = busy();
          const pct = Math.min(100, (t / DL) * 100);
          if (!frozen) { shownPct = pct; shownLikes = likes; }
          spin.setAttribute('transform', `rotate(${angle})`);
          likeBtn.textContent = `★ Like (${shownLikes})`;
          const pend = taps.filter((x) => x.handled == null).length;
          waiting.textContent = pend ? `${pend} tap${pend > 1 ? 's' : ''} waiting…` : '';
          meter.firstChild.style.width = shownPct + '%';
          pctTxt.textContent = frozen ? 'screen frozen: no redraws' : `${Math.round(shownPct)}%`;
          album.textContent = done && !closed ? '✓ 24 photos ready' : '';
          appBody.style.display = closed ? 'none' : ''; closedMsg.style.display = closed ? '' : 'none';
          anrBox.style.display = anr && !anr.dismissed && !closed ? '' : 'none';
          clock.textContent = `t = ${t.toFixed(1)} s`;
          fps.className = 'chip ' + (frozen ? 'bad' : 'ok'); fps.textContent = frozen ? 'screen redraws: 0 per second' : 'screen redraws: 60 per second';
          const red = mode === 'main' ? Math.min(t, DL) : 0;
          mainRed.setAttribute('width', red * PX);
          mainLbl.textContent = mode === 'main' ? (t > 0 ? 'resize() blocks everything' : '') : (t > 0 ? 'draws frames · handles taps' : '');
          const gStart = mode === 'main' ? DL : 0, gw = Math.max(0, t - gStart) * PX;
          mainGreen.setAttribute('x', xs(gStart)); mainGreen.setAttribute('width', t > gStart ? gw : 0);
          workBar.setAttribute('width', mode === 'worker' ? Math.min(t, DL) * PX : 0);
          workLbl.textContent = mode === 'worker' ? (t > 0 ? 'resize() runs here' : '') : 'no worker thread in this version';
          workLbl.setAttribute('class', mode === 'worker' ? '' : 's-sub');
          cursor.setAttribute('x1', xs(t)); cursor.setAttribute('x2', xs(t));
          startBtn.disabled = running;
        }
        let last = null;
        ctx.raf((ts) => {
          const dt = last == null ? 0 : Math.min(0.1, (ts - last) / 1000); last = ts;
          step(dt);
          if (!busy() && !closed) angle = (angle + dt * 320) % 360;
          draw();
        });
        const left = h('div', { class: 'stack', style: { gap: '10px' } },
          h('p', { class: 'm0 small', html: 'By default an app gets <b>one process with one thread</b> for its code: the <span class="t">main thread</span>. It runs every component\'s callbacks, and only it may draw the screen and handle taps.' }),
          h('div', { class: 'xs muted b' }, 'Run the same 8-second photo resize two ways:'), seg,
          h('div', { class: 'row gap-s' }, startBtn, h('button', { class: 'btn', type: 'button', onclick: reset }, '⟲ Reset')),
          h('div', { class: 'row gap-s' }, clock, fps), narr,
          h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'A <span class="t">service</span> gets no thread of its own: its callbacks run on this main thread, so slow work in a service freezes the screen too.' }));
        const right = h('div', { class: 'stack', style: { gap: '8px' } }, h('h4', { class: 'm0' }, 'What each thread is doing'), h('div', { class: 'card white tight' }, svg),
          h('h4', { class: 'm0' }, 'The tap handler, in code'), codeBox,
          h('div', { class: 'callout why m0 small', 'data-label': 'Rule', html: 'Keep the main thread free: slow work goes to a worker. The drawing code is not safe for two threads at once, so only the main thread touches the screen.' }));
        el.append(h('div', { class: 'thgrid' }, left, h('div', { class: 'phone-wrap' }, phone), right));
        reset();
      },
    },

    /* ---------------- 7. Importance hierarchy + low-memory killer ---------------- */
    {
      title: 'Who gets killed first? The five importance levels',
      kind: 'lab',
      core: true,
      render(el, ctx) {
        const { h, s } = ctx;
        if (ctx.narrow) el.classList.add('nar'); // phone layout (see css)
        const LV = [
          { n: 'Foreground', tt: 'Foreground process', c: 'ok', d: 'the user is interacting with it right now', lose: 'the app in the user\'s hands vanishes' },
          { n: 'Visible', tt: 'Visible process', c: 'proc', d: 'can be seen but is not in front (Paused)', lose: 'something the user can see disappears' },
          { n: 'Service', tt: '', c: 'accent', d: 'runs a started service; nothing visible', lose: 'work the user asked for (a download, an upload) stops' },
          { n: 'Background', tt: 'Background process', c: 'warn', d: 'only Stopped activities; oldest use dies first', lose: 'the user barely notices: its screens are rebuilt from saved state on return' },
          { n: 'Empty', tt: 'Empty process', c: 'bad', d: 'no active components; kept only as a cache', lose: 'the user loses only a little speed at the next launch' },
        ];
        const P = [
          { id: 'chat', name: 'Chat', lv: 0, mb: 450, ago: 0, used: 'using now', st: 'you are typing' },
          { id: 'video', name: 'Video', lv: 1, mb: 350, ago: 0, used: 'on screen', st: 'small picture-in-picture window' },
          { id: 'music', name: 'Podcasts', lv: 2, mb: 200, ago: 2, used: 'started 2 min ago', st: 'episode download service running' },
          { id: 'backup', name: 'Cloud Backup', lv: 2, mb: 150, ago: 30, used: 'started 30 min ago', st: 'upload service running' },
          { id: 'browser', name: 'Browser', lv: 3, mb: 400, ago: 4, used: 'used 4 min ago', st: 'activity Stopped' },
          { id: 'email', name: 'Email', lv: 3, mb: 250, ago: 25, used: 'used 25 min ago', st: 'activity Stopped' },
          { id: 'game', name: 'Game', lv: 3, mb: 600, ago: 120, used: 'used 2 h ago', st: 'activity Stopped' },
          { id: 'calc', name: 'Calculator', lv: 4, mb: 60, ago: 60, used: 'used 1 h ago', st: 'no components' },
          { id: 'weather', name: 'Weather', lv: 4, mb: 90, ago: 180, used: 'used 3 h ago', st: 'no components' },
        ];
        const byId = Object.fromEntries(P.map((p) => [p.id, p]));
        const FREE0 = 250, TOTAL = 2800;
        const ORDER = P.filter((p) => p.lv > 0).sort((a, b) => b.lv - a.lv || b.ago - a.ago).map((p) => p.id);   // kill order
        let mode = 'pick', killed = [], wrong = false, score = 0, need = 700;
        const cards = {};
        /* ---- ladder ---- */
        const ladder = h('div', { class: 'lad' });
        LV.forEach((lv, i) => {
          const row = h('div', { class: 'lrow', style: { '--lc': `var(--${lv.c})`, '--lcb': `var(--${lv.c}-bg)` } },
            h('div', { class: 'lhead' }, h('b', { html: `${i + 1} · ` + (lv.tt ? `<span class="t" data-t="${lv.tt}">${lv.n}</span>` : lv.n) }), h('span', { class: 'xs muted' }, lv.d)));
          const cell = h('div', { class: 'lcell' });
          P.filter((p) => p.lv === i).forEach((p) => {
            const tag = h('span', { class: 'xs b ktag' });
            cards[p.id] = { el: h('button', { class: 'pcard', type: 'button', onclick: () => pick(p.id) }, h('b', {}, p.name), h('span', { class: 'xs' }, `${p.mb} MB · ${p.used}`), h('span', { class: 'xs muted' }, p.st), tag), tag };
            cell.append(cards[p.id].el);
          });
          row.append(cell); ladder.append(row);
        });
        /* ---- memory bar ---- */
        const W = 440, sc = W / TOTAL;
        const bar = s('svg', { viewBox: `0 0 ${W + 4} 58`, width: '100%' });
        const memTxt = h('div', { class: 'small' });
        const killRow = h('div', { class: 'killrow' });
        const f = (n) => n.toLocaleString('en-US');
        function drawBar() {
          let x = 2; const kids = [];
          P.forEach((p) => {
            const w = p.mb * sc, dead = killed.includes(p.id);
            kids.push(s('rect', { x, y: 8, width: w, height: 30, class: dead ? 's-panel' : 's-' + LV[p.lv].c, 'stroke-width': 1.2, 'stroke-dasharray': dead ? '3 3' : null }));
            x += w;
          });
          kids.push(s('rect', { x, y: 8, width: W + 2 - x, height: 30, class: 's-panel', 'stroke-width': 1.2, 'stroke-dasharray': '3 3' }));
          const freeNow = FREE0 + killed.reduce((a, id) => a + byId[id].mb, 0);
          if (mode === 'slide') {
            const nw = Math.min(W, need * sc);
            kids.push(s('rect', { x: W + 2 - nw, y: 3, width: nw, height: 40, rx: 4, fill: 'none', style: 'stroke:var(--ink)', 'stroke-width': 2.5 }),
              s('text', { x: W + 2, y: 56, 'text-anchor': 'end', 'font-size': 13, 'font-weight': 800 }, `new app needs ${f(need)} MB`));
          } else kids.push(s('text', { x: 2, y: 56, 'font-size': 13, class: 's-sub' }, 'most important on the left · free memory at the right end'));
          bar.replaceChildren(...kids);
          memTxt.innerHTML = `In use <b>${f(TOTAL - freeNow)} MB</b> · free <b>${f(freeNow)} MB</b> · processes killed: <b>${killed.length}</b>`;
          killRow.replaceChildren(h('span', { class: 'xs b muted' }, 'Kill order:'), ...(killed.length ? killed.map((id, k) => h('span', { class: 'chip ' + LV[byId[id].lv].c }, `${k + 1}. ${byId[id].name}`)) : [h('span', { class: 'xs muted' }, 'nobody yet')]));
        }
        /* ---- right panel ---- */
        const fb = h('div', { class: 'callout m0 small' });
        const scoreChip = h('span', { class: 'chip ok' });
        const slider = ctx.ui.slider({ label: 'New app needs', min: 0, max: 2350, step: 50, value: need, format: (v) => f(v) + ' MB', onInput: (v) => { need = v; applyNeed(); } });
        const pickBox = h('div', { class: 'row gap-s' }, scoreChip, h('button', { class: 'btn sm', type: 'button', onclick: () => resetAll() }, '⟲ Start over'));
        const slideBox = h('div', {}, slider);
        const say = (cls, label, html) => { fb.className = 'callout m0 small fade-in ' + cls; fb.dataset.label = label; fb.innerHTML = html; };
        function paintCards() {
          P.forEach((p) => {
            const c = cards[p.id], k = killed.indexOf(p.id);
            c.el.classList.toggle('dead', k >= 0);
            c.tag.textContent = k >= 0 ? `✗ killed ${['1st', '2nd', '3rd'][k] || (k + 1) + 'th'}` : '';
          });
          scoreChip.textContent = `${score} of ${killed.length} picked right first try`;
          drawBar();
        }
        function resetAll() {
          killed = []; wrong = false; score = 0;
          pickBox.style.display = mode === 'pick' ? '' : 'none'; slideBox.style.display = mode === 'slide' ? '' : 'none';
          if (mode === 'pick') say('', 'You are the low-memory killer', 'A big new app is starting and memory is short. <b>Click the process Android kills first.</b> Keep going to see the whole order.');
          else applyNeed();
          paintCards();
        }
        function applyNeed() {
          killed = []; let free = FREE0;
          for (const id of ORDER) { if (free >= need) break; killed.push(id); free += byId[id].mb; }
          const names = killed.map((id) => byId[id].name);
          if (!killed.length) say('tip', 'No kill needed', `${f(need)} MB fits in the ${FREE0} MB already free, so every process survives.`);
          else say(killed.length > 6 ? 'bad' : 'warn', `${killed.length} process${killed.length > 1 ? 'es' : ''} killed`, `Only ${FREE0} MB is free, so Android must find ${f(need - FREE0)} MB more. It kills <b>${names.join(', ')}</b>, lowest level first, freeing ${f(free - FREE0)} MB (now ${f(free)} MB free).` + (killed.length === ORDER.length ? ' Only the foreground app, Chat, is left.' : ''));
          paintCards();
        }
        function pick(id) {
          const p = byId[id];
          if (mode === 'slide') { say('', p.name + ': ' + LV[p.lv].n.toLowerCase() + ' process', `${p.mb} MB, ${p.used}: ${p.st}. That puts it at level ${p.lv + 1} of 5. If it is killed, ${LV[p.lv].lose}.`); return; }
          if (killed.includes(id)) { ctx.toast(p.name + ' is already gone.'); return; }
          const nv = ORDER.find((x) => !killed.includes(x));
          if (!nv) { say('bad', 'Last resort only', 'Chat is the <b>foreground</b> process: the app you are touching. Android kills it only if nothing else is left and the phone is still out of memory. Round complete; press Start over to play again.'); return; }
          if (id === nv) {
            killed.push(id); if (!wrong) score++; wrong = false;
            const left = ORDER.find((x) => !killed.includes(x));
            say('tip', 'Correct', `<b>${p.name}</b> was the least important process left: level ${p.lv + 1} (${LV[p.lv].n.toLowerCase()}), ${p.used}. Killing it frees ${p.mb} MB, and ${LV[p.lv].lose}. ` + (left ? 'Click the next victim.' : 'Every process except the foreground app is gone.'));
            if (ctx.narrow) ctx.toast(`Correct: ${p.name} killed ${['1st', '2nd', '3rd'][killed.length - 1] || killed.length + 'th'}`);
          } else {
            wrong = true;
            const v = byId[nv];
            if (id === 'chat') say('bad', 'Not the foreground app', 'Chat is what the user is touching right now. Android kills it only as the very last resort.');
            else if (p.lv < v.lv) say('bad', 'Not yet', `${p.name} is a <b>${LV[p.lv].n.toLowerCase()}</b> process (level ${p.lv + 1}). There is still a less important <b>${LV[v.lv].n.toLowerCase()}</b> process (level ${v.lv + 1}) to kill first.`);
            else say('warn', 'Close', `${p.name} and ${v.name} are both <b>${LV[p.lv].n.toLowerCase()}</b> processes, but ${v.name} was ${v.used.replace(/^(used|started) /, 'last used ')}, longer ago than ${p.name}. Within a level, the least recently used goes first.`);
            if (ctx.narrow) ctx.toast(`${fb.dataset.label}: ${p.name} is not the next to go`);
          }
          paintCards();
        }
        const seg = ctx.ui.seg([{ value: 'pick', label: 'You pick the victim' }, { value: 'slide', label: 'Memory pressure slider' }], mode, (v) => { mode = v; resetAll(); });
        const right = h('div', { class: 'stack', style: { gap: '10px' } }, seg,
          h('div', { class: 'card white tight stack', style: { gap: '4px' } }, h('h4', { class: 'm0' }, 'Memory for apps: 2,800 MB'), bar, memTxt, killRow),
          pickBox, slideBox, fb,
          h('div', { class: 'callout why m0 small', 'data-label': 'The rule', html: 'Android\'s <b>low-memory killer</b> works from the <b>lowest level</b> up and, within a level, kills the <b>least recently used</b> process first. It stops as soon as enough memory is free. The lower the level, the less the user loses.' }));
        el.append(h('div', { class: 'split r fill' }, h('div', { class: 'stack', style: { gap: '6px', minHeight: 0 } }, h('h4', { class: 'm0', html: '<span class="t">Importance hierarchy</span> · Android kills from the bottom up' }), ladder), right));
        resetAll();
      },
    },

    /* ---------------- 8. Recap ---------------- */
    {
      title: 'Recap: six ideas that explain how Android runs apps',
      kind: 'recap',
      render(el, ctx) {
        const { h } = ctx;
        const cards = [
          ['<div>Four kinds of<br>app component</div>',
            '<div><b>Activity</b>: one screen. <b>Service</b>: long work, no screen. <b>Content provider</b>: a shared doorway to stored data. <b>Broadcast receiver</b>: reacts briefly to an announcement. Intents start the first two and carry broadcasts.</div>'],
          ['<div>What does one app get<br>from Android by default?</div>',
            '<div>One Linux process with its own user ID and its own copy of the virtual machine: the <b>sandbox</b>. Every component of the app lives in it, and Android can kill the whole process to free memory.</div>'],
          ['<div>The seven callbacks<br>and when they fire</div>',
            '<div><code>onCreate</code> → <code>onStart</code> → <code>onResume</code> on the way in; <code>onPause</code> → <code>onStop</code> → <code>onDestroy</code> on the way out; <code>onRestart</code> when a Stopped activity comes back (then onStart, onResume).</div>'],
          ['<div>Three nested lifetimes<br>and three states</div>',
            '<div><b>Entire</b>: onCreate to onDestroy. <b>Visible</b>: onStart to onStop. <b>Foreground</b>: onResume to onPause. Inside the foreground an activity is <b>Resumed</b>; seen but unfocused it is <b>Paused</b>; hidden it is <b>Stopped</b>.</div>'],
          ['<div>One main thread:<br>what goes wrong?</div>',
            '<div>It draws the screen, handles every tap and runs every callback, even a service\'s. Block it and the app freezes; about 5 s of ignored input brings the <b>ANR</b> dialog. Slow work goes to a worker thread.</div>'],
          ['<div>Memory is short:<br>who dies first?</div>',
            '<div><b>Empty</b>, then <b>background</b> (least recently used first), then <b>service</b>, then <b>visible</b>; <b>foreground</b> only as a last resort. No callback runs on a kill, so save state in onPause or onStop.</div>'],
        ];
        const flipped = new Set();
        const count = h('span', { class: 'chip accent' });
        const upd = () => { count.textContent = `flipped ${flipped.size}/6`; };
        const grid = ctx.ui.flipcards(cards, { cols: 3, height: 168 });
        Array.from(grid.children).forEach((c, i) => c.addEventListener('click', () => { flipped.add(i); upd(); }));
        const chain = [
          ['proc', 'Tap the icon', 'an intent asks for the app'],
          ['proc', 'New process', 'one VM, one main thread'],
          ['ok', 'onCreate · onStart · onResume', 'Resumed: you use it'],
          ['warn', 'Home: onPause · onStop', 'Stopped; save state now'],
          ['intr', 'Low memory: killed', 'no callback runs'],
          ['os', 'You return', 'new process, onCreate with saved state'],
        ];
        if (ctx.narrow) el.classList.add('nar'); // phone layout (see css)
        const strip = h('div', { class: 'row nw chain', style: { gap: '6px', alignItems: 'stretch' } });
        chain.forEach(([c, a, b], i) => {
          if (i) strip.append(h('span', { class: 'muted b', style: { alignSelf: 'center' } }, '→'));
          strip.append(h('div', { class: 'box ' + (c === 'ok' || c === 'warn' ? '' : c), style: { flex: '1 1 0', minWidth: 0, padding: '6px 8px', borderColor: `var(--${c})`, background: `var(--${c}-bg)` } },
            h('div', { class: 'small b', style: { lineHeight: 1.25 } }, a), h('div', { class: 'xs muted', style: { fontWeight: 500, lineHeight: 1.3 } }, b)));
        });
        el.append(h('div', { class: 'stack fill', style: { gap: '12px' } },
          h('div', { class: 'row', style: { justifyContent: 'space-between' } },
            h('p', { class: 'lead m0' }, 'Say each answer out loud first, then click the card to check yourself.'), count),
          grid,
          h('h4', { class: 'm0 mt' }, 'The whole section in one story: an app\'s life on a busy phone'),
          strip));
        upd();
      },
    },

    /* ---------------- 9. Quiz ---------------- */
    {
      title: 'Check yourself',
      kind: 'check',
      quiz: [
        { q: 'A podcast app must keep playing an episode after the user switches to the web browser. Which kind of Android component should do the playing?',
          choices: ['An activity', 'A service', 'A broadcast receiver', 'A content provider'], answer: 1,
          feedback: ['An activity is a screen. Once the user switches to the browser, the podcast screen is Stopped and should do no work, so playback does not belong there.', null, 'A broadcast receiver reacts briefly to an announcement and then finishes. It cannot keep playing audio for many minutes.', 'A content provider shares stored data with other apps. It does not carry out long-running work.'],
          why: 'Long-running work that needs no screen and must keep going when the user moves to another app is exactly the job of a service.' },
        { type: 'match', q: 'Match each Android component to its job.',
          pairs: [['Activity', 'One screen the user sees and touches'], ['Service', 'Long-running work with no user interface'], ['Content provider', 'A standard doorway through which apps read or change a set of stored data'], ['Broadcast receiver', 'Wakes up briefly when an event such as "battery low" is announced']],
          why: 'Screens are activities, background jobs are services, shared data goes through a content provider, and reactions to system-wide announcements are handled by broadcast receivers.' },
        { type: 'multi', q: 'Which statements about how Android runs an app are true <b>by default</b>? Select all that apply.',
          choices: ['Each app runs in its own Linux process, under its own user ID', 'Each app has its own instance of the virtual machine', 'The lifecycle callbacks of an app\'s activities, services and broadcast receivers all run on one main thread unless the app creates more threads', 'A service automatically gets a worker thread of its own', 'Every activity of an app gets a separate process', 'Content providers are started by intents, just like activities'],
          answer: [0, 1, 2],
          why: 'The default is one process, one virtual-machine instance and one main thread per app, shared by all its components. A service runs on that main thread unless the app starts a worker, and a content provider is reached by a query, not an intent.' },
        { type: 'order', q: 'The user launches an activity, uses it, then presses Back to leave it for good. Put the callbacks in the order Android calls them.',
          items: ['onCreate()', 'onStart()', 'onResume()', 'onPause()', 'onStop()', 'onDestroy()'],
          why: 'On the way in, the activity is created, becomes visible, then comes to the front. Leaving for good reverses the path: it loses the focus, becomes hidden, then is destroyed.' },
        { type: 'match', q: 'Match each lifetime of an activity to the pair of callbacks that begins and ends it.',
          pairs: [['Entire lifetime', 'onCreate() … onDestroy()'], ['Visible lifetime', 'onStart() … onStop()'], ['Foreground lifetime', 'onResume() … onPause()']],
          why: 'The three lifetimes are nested: the foreground lifetime sits inside the visible lifetime, which sits inside the entire lifetime.' },
        { type: 'bucket', q: 'Which state is activity X in, in each situation?', buckets: ['Resumed', 'Paused', 'Stopped'],
          items: [['The user is typing a message into X', 0], ['The user just came back to X and its onResume() has finished', 0], ['A system "Allow access to the microphone?" permission window (a separate activity) covers part of X', 1], ['The user tapped Home; X\'s onPause() has run but onStop() has not yet been called', 1], ['The user pressed Home and X can no longer be seen at all', 2], ['X opened a second full-screen activity, which now completely covers X', 2]],
          why: 'Resumed means in front with the user\'s focus. Paused means at least partly visible (or on the way out) without the focus. Stopped means completely hidden but still in memory.' },
        { q: 'A notes app has two activities. The user opens the note list, taps a note to open the editor, then presses Back. What happens?',
          choices: ['The editor is paused and stays on the back stack, and the list is created again from scratch.', 'The editor is finished and removed from the back stack, and the list, which was Stopped underneath it, restarts and resumes.', 'Both activities are destroyed and the user lands on the home screen.', 'Android kills the app\'s process to free the memory the editor was using.'],
          answer: 1,
          feedback: ['Back finishes the top activity instead of keeping it. The list was only Stopped, so it still exists and is not rebuilt (unless its process had been killed in the meantime).', null, 'Back removes only the top activity. The list is still on the back stack, so the user lands on it, not on the home screen.', 'Pressing Back ends one activity; it does not kill the process. The process dies only if Android later needs its memory.'],
          why: 'The back stack holds the list with the editor on top. Back pops the editor (onPause, onStop, onDestroy) and brings the list back with onRestart, onStart and onResume.' },
        { type: 'tf', q: 'When Android kills an app\'s process to reclaim memory, it first calls onDestroy() on each of the app\'s activities, so saving the user\'s work in onDestroy() is safe.',
          answer: false,
          why: 'A low-memory kill removes the whole process at once and no callback runs at all. Work must be saved earlier, in onPause() or onStop().' },
        { q: 'An app resizes 300 photos inside a button\'s tap handler, which runs on the main thread. The work takes 8 seconds. What does the user experience?',
          choices: ['Nothing unusual: Android notices the slow work and moves it to a worker thread.', 'The screen freezes and ignores taps, and after about 5 seconds of unanswered input Android offers to close the app (an ANR dialog).', 'The resizing is cancelled after 5 seconds, but the app keeps running normally.', 'Android immediately kills the process because long work is forbidden in a tap handler.'],
          answer: 1,
          feedback: ['Android never moves code to another thread on its own. Code runs on the thread that called it, here the main thread.', null, 'Android does not cancel the work. It shows the Application Not Responding dialog and lets the user wait or close the app.', 'Nothing is killed straight away. The app simply stops responding while its main thread is stuck.'],
          why: 'The main thread both runs the handler and draws the screen, so while it is busy nothing is redrawn and taps pile up. Slow work belongs on a worker thread, which hands its result back to the main thread.' },
        { type: 'order', q: 'Order these processes from MOST important (killed last) to LEAST important (killed first).',
          items: ['The app the user is typing into right now', 'An app still partly visible behind a permission window that has the focus', 'An app with no screen showing that is downloading podcast episodes through a started service', 'An app whose only activity is Stopped, last used an hour ago', 'An app with no active components, kept only as a cache'],
          why: 'The importance hierarchy is foreground, visible, service, background, empty. Android reclaims memory starting from the bottom of that list.' },
        { q: 'Memory is short and Android must kill exactly one process. Which one goes first?',
          choices: ['A background process last used 3 hours ago', 'An empty process last used 10 minutes ago', 'A service process that is uploading photos', 'A background process last used 5 minutes ago'],
          answer: 1,
          feedback: ['Least-recently-used order only breaks ties inside one level. Background ranks above empty, so this process survives while any empty process remains.', null, 'The user would notice a stopped upload, so service processes rank above both background and empty ones.', 'This is the most recently used background process, and background ranks above empty anyway.'],
          why: 'An empty process holds no running component, so killing it costs the user nothing but a slower next launch. The level decides first; recency decides only within a level.' },
        { type: 'num', q: 'A phone has 300 MB free and a new app needs 1,000 MB. The other processes are: empty E1 (150 MB, used 1 h ago), empty E2 (100 MB, used 3 h ago), background B1 (400 MB, used 2 h ago), background B2 (200 MB, used 10 min ago) and service S (500 MB). Android kills in importance order and stops as soon as at least 1,000 MB is free. How many MB are free when it stops?',
          answer: 1150, tol: 0, unit: 'MB',
          hint: 'Lowest level first; inside a level, the least recently used goes first. Keep a running total.',
          why: 'Empty processes go first, oldest first: E2 (now 400 MB free), then E1 (550). Next come background processes, oldest first: B1 (950), still short, then B2 (1,150). The service process S survives.' },
      ],
    },
  ],

  notes: `
    <h3>Why Android needs its own rules</h3>
    <p>A phone has far less memory than a laptop, and its user switches apps constantly. A desktop keeps a program alive until the user quits it (parking idle parts on disk if needed); Android does not wait. When a new app needs memory, Android <b>kills whole processes</b>, starting with the ones the user would miss least. This is safe because Android drives every app component through callbacks, so an app can save its state (a bookmark) before it may be killed.</p>

    <h3>The four kinds of app component</h3>
    <table>
      <tr><th>Component</th><th>What it is</th><th>Activated by</th><th>Examples</th></tr>
      <tr><td><b>Activity</b></td><td>One screen the user sees and touches; most apps have several.</td><td>an intent</td><td>inbox, settings page</td></tr>
      <tr><td><b>Service</b></td><td>Long-running work with no screen; keeps going after the user switches apps.</td><td>an intent</td><td>music playback, photo upload</td></tr>
      <tr><td><b>Content provider</b></td><td>A standard doorway (query, insert, update, delete) to app data kept in files, an SQLite database or on the web; used by the app and, with permission, by other apps.</td><td>a query to its <code>content://</code> name, not an intent</td><td>contacts, calendar events</td></tr>
      <tr><td><b>Broadcast receiver</b></td><td>Sleeps until a system-wide announcement arrives, reacts briefly, then finishes; longer follow-up work goes to a service.</td><td>a broadcast intent</td><td>battery low, screen off</td></tr>
    </table>
    <p>An <b>intent</b> is a small message asking Android to activate a component. An <b>explicit</b> intent names the exact component (open the player screen); an <b>implicit</b> one describes an action and lets Android choose an app ("share this link"). Because components are started through Android rather than called directly, Android can first start the process, check permissions or pick the app.</p>
    <p><b>Choosing:</b> the user looks at it → activity; long work, no screen → service; shares stored data → content provider; reacts to an announcement → broadcast receiver.</p>

    <h3>One app, one sandbox</h3>
    <ul>
      <li>By default each app runs in <b>its own Linux process under its own user ID</b>. This <b>application sandbox</b> stops one app reading or damaging another app's memory or files.</li>
      <li>Each process runs <b>its own instance of the virtual machine</b> (Dalvik on early phones, ART today). This is a language runtime like the Java virtual machine of section 4.3, not a simulated computer with its own operating system like the virtual machines compared with containers in section 4.6. To start quickly, new app processes are forked from Zygote, a parent process that already has the runtime loaded.</li>
      <li>All of an app's components share that one process (the manifest can request extra processes, but that is not the default). Android creates it when the first component is needed and, to reclaim memory, kills it with every component inside.</li>
    </ul>

    <h3>The activity lifecycle: seven callbacks</h3>
    <table>
      <tr><th>Callback</th><th>Called when</th><th>A well-written app uses it to</th></tr>
      <tr><td><code>onCreate()</code></td><td>being created: first launch, return after a kill, or rotation</td><td>build the layout, set up data, restore saved state</td></tr>
      <tr><td><code>onStart()</code></td><td>about to become visible</td><td>start what the screen needs while seen</td></tr>
      <tr><td><code>onResume()</code></td><td>about to come to the front and get input</td><td>restart animations, video, camera, sensors</td></tr>
      <tr><td><code>onPause()</code></td><td>another activity comes in front, even partly (e.g. a permission window; an ordinary in-app dialog does not count), or the user starts to leave</td><td>pause animations, release the camera; must be quick</td></tr>
      <tr><td><code>onStop()</code></td><td>no longer visible at all</td><td>save the user's work, release what is not needed</td></tr>
      <tr><td><code>onRestart()</code></td><td>a Stopped activity is about to be shown again</td><td>anything special on return; onStart and onResume follow</td></tr>
      <tr><td><code>onDestroy()</code></td><td>finishing (Back, <code>finish()</code>) or being rebuilt (rotation)</td><td>final clean-up. <b>Not guaranteed to run.</b></td></tr>
    </table>
    <p><b>States.</b> <b>Resumed</b> (running): in front, has the user's focus. <b>Paused</b>: at least partly visible but without focus (an activity being left also passes briefly through Paused). <b>Stopped</b>: completely hidden, still in memory with its data.</p>
    <p><b>Three nested lifetimes.</b> <b>Entire</b>: <code>onCreate()</code> to <code>onDestroy()</code>. <b>Visible</b>: <code>onStart()</code> to <code>onStop()</code>, possibly entered many times. <b>Foreground</b>: <code>onResume()</code> to <code>onPause()</code>, entered and left very often, so its code must be light.</p>
    <svg viewBox="0 0 420 120" width="420" role="img" aria-label="Nested lifetimes">
      <rect x="4" y="4" width="412" height="112" rx="12" fill="#efe8ff" stroke="#7c3aed" stroke-width="2"/>
      <text x="14" y="22" font-size="12" font-weight="700" fill="#7c3aed">Entire: onCreate … onDestroy (Stopped ring)</text>
      <rect x="70" y="30" width="280" height="78" rx="10" fill="#e1eaff" stroke="#2563eb" stroke-width="2"/>
      <text x="80" y="47" font-size="12" font-weight="700" fill="#2563eb">Visible: onStart … onStop (Paused ring)</text>
      <rect x="140" y="54" width="140" height="46" rx="8" fill="#dcfce7" stroke="#15803d" stroke-width="2"/>
      <text x="210" y="74" font-size="12" font-weight="700" fill="#15803d" text-anchor="middle">Foreground:</text>
      <text x="210" y="90" font-size="12" fill="#15803d" text-anchor="middle">onResume … onPause</text>
    </svg>
    <p><b>Killed for memory.</b> Android may kill a process whose activities are Stopped (or, only when desperate, Paused). <b>No callback runs</b>, not even <code>onDestroy()</code>. What survives is the small bundle of state the activity saved in <code>onSaveInstanceState()</code> as it stopped, held by Android outside the process. If the user returns, a new process starts and <code>onCreate()</code> gets that bundle, so the screen looks as it was. Common mistake: saving work only in <code>onDestroy()</code>; use <code>onPause()</code> or <code>onStop()</code>.</p>

    <h3>Lifecycle traces worth knowing (activities A = list, B = editor)</h3>
    <table>
      <tr><th>What the user does</th><th>Callbacks, in order</th></tr>
      <tr><td>Launch (no process yet)</td><td>new process; A.onCreate, A.onStart, A.onResume</td></tr>
      <tr><td>A permission window covers part of A, then closes</td><td>A.onPause only; later A.onResume</td></tr>
      <tr><td>A opens B full-screen</td><td>A.onPause; B.onCreate, B.onStart, B.onResume; <b>then</b> A.onStop</td></tr>
      <tr><td>Back from B</td><td>B.onPause; A.onRestart, A.onStart, A.onResume; B.onStop, B.onDestroy</td></tr>
      <tr><td>Home, then return</td><td>onPause, onStop; later onRestart, onStart, onResume</td></tr>
      <tr><td>Return after a low-memory kill</td><td>new process; onCreate (with saved state), onStart, onResume</td></tr>
      <tr><td>Rotate the phone</td><td>onPause, onStop, onDestroy, then onCreate, onStart, onResume on a new instance (six)</td></tr>
      <tr><td>Back on the last activity</td><td>onPause, onStop, onDestroy; the process stays as an <b>empty process</b>, so the next launch is a fast "warm" start (Android 12+ usually just stops it instead)</td></tr>
    </table>
    <p>The <b>back stack</b> lists the activities the user has opened, newest on top. Opening B pushes it on top of A; Back finishes the top one and brings back the one underneath. Android keeps the back stack and saved state even when it kills the process.</p>

    <h3>One process, one main thread</h3>
    <ul>
      <li>By default Android starts each app as <b>one process with one thread</b> for its code, the <b>main thread</b> (UI thread). It runs every component's lifecycle callbacks, draws every frame (about 60 per second) and handles every tap. (Exception: other apps' queries to a content provider run on helper threads.)</li>
      <li>If the main thread is stuck in slow work (resizing photos, a big query), nothing is redrawn and taps queue up. When input has waited about <b>5 seconds</b>, Android shows the <b>Application Not Responding (ANR)</b> dialog: wait, or close the app (its process is killed, unfinished work lost).</li>
      <li>The fix: do slow work on a <b>worker thread</b> the app creates and hand the result back (e.g. with <code>runOnUiThread</code>). Only the main thread may touch the screen, because the drawing code is not built for two threads at once.</li>
      <li>Common mistake: a service does <b>not</b> get its own thread; slow work in a service freezes the screen too.</li>
    </ul>
    <p><b>Example.</b> An 8-second photo resize runs in a tap handler on the main thread; the user taps Like at 1 s. At 6 s the tap has waited 5 s, so the ANR dialog appears; the tap is handled only at 8 s. With a worker thread it is handled at 1 s.</p>

    <h3>The importance hierarchy: who is killed first</h3>
    <table>
      <tr><th>Level</th><th>The process holds</th><th>Example</th><th>If killed, the user loses</th></tr>
      <tr><td>1. Foreground</td><td>what the user is interacting with now (a Resumed activity, or a receiver handling an event)</td><td>the chat you are typing in</td><td>the app in their hands</td></tr>
      <tr><td>2. Visible</td><td>an activity that can be seen but is not in front (Paused)</td><td>an app behind a permission window; a picture-in-picture video</td><td>something on screen</td></tr>
      <tr><td>3. Service</td><td>a started service, nothing visible</td><td>an episode download, a cloud upload</td><td>work they asked for</td></tr>
      <tr><td>4. Background</td><td>only Stopped activities</td><td>apps you switched away from</td><td>little: rebuilt from saved state</td></tr>
      <tr><td>5. Empty</td><td>no active components; kept only as a cache</td><td>an app you left with Back</td><td>a little launch speed</td></tr>
    </table>
    <p>A service the user is plainly aware of (music playing with a notification shown) is promoted to the visible level.</p>
    <p><b>Rules</b> (applied by Android's <b>low-memory killer</b>): kill from the lowest level upward; within a level, kill the <b>least recently used</b> process first; stop as soon as enough memory is free. Level always beats recency: an empty process used 10 minutes ago dies before a background process unused for hours.</p>
    <p><b>Worked example.</b> 250 MB free; a new app needs 700 MB. Kill Weather (empty, used 3 h ago, 90 MB): 340 MB free. Kill Calculator (empty, 1 h, 60 MB): 400 MB. No empties left, so kill the oldest background app, Game (2 h, 600 MB): 1,000 MB, enough. Every other process survives.</p>`,
});
