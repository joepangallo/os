// Comment key: a line inside backtick text ends with ${/* comment */''}, an empty-string slot that holds a comment without changing the text on screen (full note at the top of the page).
/* =====================================================================
   Section 4.7 — Android Process and Thread Management
   Steps: big picture · app anatomy · component matcher · lifecycle map ·
          lifecycle simulator · main thread vs worker · low-memory killer ·
          recap · quiz
   ===================================================================== */
Guide.section({  // registers this section with the guide; everything below is one object holding its text, styles and steps
  id: '4.7',  // section number, used in links, saved progress and the CSS class sec-4-7
  title: 'Android Process and Thread Management',  // full title shown at the top of the section
  short: 'Android procs & threads',  // short title used in the table of contents and small labels
  summary: 'Android\'s four app components, the activity lifecycle, the main thread, and which processes die first.',  // one-sentence summary shown on the chapter page
  objectives: [  // learning objectives, listed where the section begins
    'Name Android\'s four kinds of application component and choose the right one for a given job.',  // objective 1: the four kinds of app component and when to use each
    'Trace the callbacks an activity receives as the user launches, covers, leaves, rotates and returns to it, and name its three nested lifetimes.',  // objective 2: the activity callbacks and the three nested lifetimes
    'Explain why an app starts with one process and one main (UI) thread, and why slow work belongs on a worker thread.',  // objective 3: one process and one main thread per app, and why slow work goes to a worker
    'Rank processes by Android\'s five-level importance hierarchy and predict which one is killed first when memory runs short.',  // objective 4: the five importance levels and which process is killed first
  ],  // closes the objectives list
  terms: [  // glossary terms for this section; each is [term, definition] and underlined words in the steps link to them
    ['Activity', 'One screen of an Android app that the user sees and touches, such as a message list or a compose screen. An app usually has several.'],  // glossary entry: activity, one screen of an app
    ['Service', 'An Android app component with no screen that carries out long-running work in the background, such as playing music or downloading a file, and can keep going after the user switches to another app.'],  // glossary entry: service, long background work with no screen
    ['Content provider', 'An Android app component that offers a standard interface to a set of app data (stored in files, an SQLite database or on the web) so that the owning app and, with permission, other apps can read or change it. The contacts list is the classic example.'],  // glossary entry: content provider, a standard interface to an app's data
    ['Broadcast receiver', 'An Android app component that sleeps until the system (or another app) announces an event to everyone, such as "battery low", "screen turned off" or "download finished", and then reacts briefly.'],  // glossary entry: broadcast receiver, reacts to system-wide announcements
    ['Intent', 'A small message object that asks Android to start an activity or a service, or that carries a broadcast announcement. An explicit intent names the exact component wanted; an implicit intent names only the kind of action wanted and lets Android pick an app.'],  // glossary entry: intent, a message asking Android to start something, explicit or implicit
    ['Application sandbox', 'Android\'s isolation of apps: by default each app runs in its own Linux process, under its own user ID, with its own instance of the virtual machine, so one app cannot read or damage another app\'s memory or files.'],  // glossary entry: application sandbox, one process and user ID per app
    ['Back stack', 'The list of activities the user has opened, in the order they were opened, with the newest on top. Pressing Back finishes the top activity and brings back the one underneath; Android keeps the list even if it kills the app\'s process.'],  // glossary entry: back stack, the opened activities with the newest on top
    ['Lifecycle callback', 'A method (onCreate, onStart, onResume, onPause, onStop, onRestart, onDestroy) that Android calls on an activity each time the activity moves from one state to another, giving the app a chance to set up, save or release things.'],  // glossary entry: lifecycle callback, the seven methods Android calls on an activity
    ['Paused state', 'The state of an activity that is still at least partly visible but no longer has the user\'s focus, because another activity has appeared in front of part of it. An activity that is being left also passes briefly through Paused on its way to Stopped.'],  // glossary entry: the Paused state, visible but without focus
    ['Stopped state', 'The state of an activity that is completely hidden. It stays in memory with its data, but it is not drawn and should do no work.'],  // glossary entry: the Stopped state, hidden but still in memory
    ['Entire lifetime', 'The span of an activity between onCreate() and onDestroy(): everything the activity owns is set up at the start and released at the end.'],  // glossary entry: entire lifetime, from onCreate() to onDestroy()
    ['Visible lifetime', 'The span of an activity between onStart() and onStop(), during which it is on screen, even if only partly.'],  // glossary entry: visible lifetime, from onStart() to onStop()
    ['Foreground lifetime', 'The span of an activity between onResume() and onPause(), during which it is in front of every other activity and receives the user\'s input.'],  // glossary entry: foreground lifetime, from onResume() to onPause()
    ['Main thread (UI thread)', 'The first thread of an app\'s process: it handles the user\'s input and is the only thread that draws the screen, so it must never be kept busy for long or the app freezes. On Android it also runs the lifecycle callbacks of all the app\'s components by default.'],  // glossary entry: main thread (UI thread), the one thread that draws the screen
    ['Application Not Responding (ANR)', 'The error dialog Android shows when an app\'s main thread has not responded to an input event, such as a tap, within about five seconds. It offers to wait or to close the app.'],  // glossary entry: Application Not Responding (ANR), the dialog after about five seconds of ignored input
    ['Importance hierarchy', 'Android\'s ranking of processes, from most to least important: foreground, visible, service (running a started service, nothing visible), background, empty. When memory is short, Android\'s low-memory killer ends the least important processes first.'],  // glossary entry: importance hierarchy, the five-level ranking used to pick processes to kill
    ['Foreground process', 'A process doing what the user is focused on right now, for example running the activity the user is touching or a broadcast receiver that is handling an event. It is killed only as a last resort.'],  // glossary entry: foreground process, the top level
    ['Visible process', 'A process whose activity can still be seen but is not in the foreground (it is Paused), for example an app partly hidden behind a permission window or shown in a small picture-in-picture window. A service the user is plainly aware of, such as music playing with a notification on screen, also ranks here.'],  // glossary entry: visible process, the second level
    ['Background process', 'A process holding only activities that are Stopped (not visible). Android keeps these in least-recently-used order and kills the oldest first when it needs memory.'],  // glossary entry: background process, holding only Stopped activities
    ['Empty process', 'A process that holds no active app components at all. Android keeps it only as a cache so the app starts faster next time, and it is the first to be killed.'],  // glossary entry: empty process, a cache that is killed first
  ],  // closes the terms list

  css: ` /* css: styles for this section only; the guide adds them to the page when the section is shown */
    /* shell workaround: in narrow mode the nowrap eyebrow otherwise sets the canvas min-width */
    .sec-4-7 .step-eyebrow { contain: inline-size; } /* stops the step's top label line from widening the page on small screens */
    .sec-4-7 .hot { cursor: pointer; outline: none; } /* hot: marks clickable parts of the diagrams; shows the hand cursor and hides the default focus outline */
    .sec-4-7 button.chip { border: 0; cursor: pointer; font-family: inherit; } /* chips that are buttons (the progress chips in step 2) lose the button border and show the hand cursor */
    .sec-4-7 button.chip:hover { box-shadow: 0 0 0 2px var(--line-2); } /* hovering a chip button draws a thin ring around it */
    .sec-4-7 .hot .fr { transition: stroke-width .15s; } /* fr is the frame of each clickable diagram part; its border width changes smoothly */
    .sec-4-7 .hot:hover .fr, .sec-4-7 .hot:focus-visible .fr { stroke-width: 3.5; } /* hovering or keyboard-focusing a clickable part thickens its frame */
    .sec-4-7 .hot.sel .fr { stroke-width: 4; } /* the selected diagram part keeps the thickest frame */
    .sec-4-7 .mt-q { font-size: 21px; font-weight: 650; line-height: 1.4; } /* the task text in the step 3 matcher, large enough to read at a glance */
    .sec-4-7 .bin { display: flex; flex-direction: column; gap: 6px; align-items: stretch; text-align: left; padding: 10px 12px; border-radius: 12px; border: 2px solid color-mix(in srgb, var(--bc) 40%, transparent); border-top: 6px solid var(--bc); background: var(--panel); cursor: pointer; font: inherit; color: var(--ink); min-height: 0; transition: box-shadow .15s, background .15s; } /* each component bin in the step 3 matcher: a clickable card with a thick colored top edge (color from --bc) */
    .sec-4-7 .bin:hover { box-shadow: 0 0 0 3px color-mix(in srgb, var(--bc) 30%, transparent); background: var(--bcb); } /* hovering a bin adds a soft glow and a tint of its color (from --bcb) */
    .sec-4-7 .bin > .row b { font-size: 17px; color: var(--bc); } /* the component name at the top of each bin, large and in the bin's color */
    .sec-4-7 .bin-foot { margin-top: auto; display: flex; gap: 8px; align-items: center; opacity: .85; } /* the icon and clue words at the bottom of each bin, pushed down to the base of the card */
    .sec-4-7 .bin-line { border-top: 1px dashed var(--line-2); margin: 2px 0; } /* a dashed line inside each bin between its definition and the tasks sorted into it */
    .sec-4-7 .bin.wrong { animation: sec47shake .45s; border-color: var(--bad); } /* a wrongly clicked bin shakes and gets a red border */
    @keyframes sec47shake { 20% { transform: translateX(-5px); } 40% { transform: translateX(5px); } 60% { transform: translateX(-3px); } 80% { transform: translateX(3px); } } /* the shake itself: the bin moves left and right a few pixels, less each time */
    .sec-4-7 .mdot { width: 16px; height: 8px; border-radius: 9px; background: var(--panel-3); display: inline-block; } /* mdot: one small pill-shaped progress mark per task in the matcher */
    .sec-4-7 .mdot.cur { background: var(--chc); } /* the progress mark for the current task is chapter-colored */
    .sec-4-7 .mdot.ok { background: var(--ok); } /* progress marks for finished tasks are green */
    .sec-4-7 .gate rect { fill: var(--panel); stroke: var(--ink-2); stroke-width: 1.5; } /* gate: the callback pills on the step 4 diagram, drawn as white capsules with a dark outline */
    .sec-4-7 .gate text { font-family: var(--mono); font-size: 13.5px; font-weight: 700; } /* callback names on the pills use bold code font */
    .sec-4-7 .gate.sel rect { fill: var(--hl); stroke: var(--ink); } /* the selected pill is highlighted */
    .sec-4-7 .gate:hover rect { stroke: var(--accent); } /* hovering a pill colors its outline */
    /* lifecycle simulator */
    .sec-4-7 .simgrid { display: grid; grid-template-columns: 250px minmax(0, 1fr) 380px; gap: 16px; height: 100%; } /* simgrid: the step 5 simulator in three columns: the phone, the controls and log, the activity cards */
    .sec-4-7 .phone-wrap { display: grid; place-items: center; } /* centers the pretend phone inside its column */
    .sec-4-7 .phone { width: 236px; height: 468px; border: 8px solid var(--ink-2); border-radius: 28px; background: var(--panel); display: flex; flex-direction: column; overflow: hidden; box-shadow: var(--shadow); transition: width .35s, height .35s; } /* the pretend phone: fixed size, thick dark border and rounded corners; size changes animate on rotation */
    .sec-4-7 .phone.land { width: 246px; height: 200px; border-radius: 20px; } /* the phone turned sideways: wider than tall, with smaller corners */
    .sec-4-7 .ph-status { display: flex; justify-content: space-between; padding: 2px 12px; font-size: 12.5px; font-weight: 700; color: var(--ink-2); background: var(--panel-2); flex: none; } /* the phone's top status bar with the time and the process ID */
    .sec-4-7 .ph-screen { flex: 1; position: relative; display: flex; flex-direction: column; min-height: 0; } /* the phone's screen area, which grows to fill the phone */
    .sec-4-7 .ph-bar { padding: 7px 12px; font-weight: 800; font-size: 15px; border-bottom: 1px solid var(--line); flex: none; } /* the title bar at the top of each phone screen */
    .sec-4-7 .ph-body { flex: 1; display: flex; flex-direction: column; gap: 6px; padding: 8px 10px; min-height: 0; overflow: hidden; transition: opacity .2s; } /* the phone screen's content area; overflow hidden keeps everything inside the phone */
    .sec-4-7 .ph-body.dim { opacity: .35; } /* content fades when the activity is not visible to the user or its process is gone */
    .sec-4-7 .phone.land .ph-body { gap: 3px; padding: 5px 8px; } /* sideways phone: tighter spacing in the content area */
    .sec-4-7 .phone.land .ph-note { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: 2px 8px; font-size: 12.5px; line-height: 1.35; flex: none; } /* sideways phone: each note fits on one line, cut off with "..." if too long */
    .sec-4-7 .phone.land .ph-bar { padding: 4px 12px; font-size: 14px; } /* sideways phone: smaller title bar */
    .sec-4-7 .phone.land .ph-edit { padding: 4px 8px; font-size: 13px; } /* sideways phone: smaller editor box */
    .sec-4-7 .phone.land .ph-body > .xs { display: none; } /* sideways phone: hides the small hint line to save room */
    .sec-4-7 .ph-note { text-align: left; padding: 6px 9px; border-radius: 9px; border: 1px solid var(--line); background: var(--panel-2); font: inherit; font-size: 13.5px; color: var(--ink); cursor: pointer; } /* each note in the note list: a clickable rounded row */
    .sec-4-7 .ph-note:hover { border-color: var(--accent); } /* hovering a note colors its border */
    .sec-4-7 .ph-edit { flex: 1; padding: 8px 10px; border-radius: 9px; border: 1px solid var(--io); background: var(--io-bg); font-size: 14px; line-height: 1.4; } /* the editor box where the note text appears, tinted in the editor's color */
    .sec-4-7 .ph-nav { display: grid; grid-template-columns: 1fr 1fr; border-top: 1px solid var(--line); background: var(--panel-2); flex: none; } /* the phone's bottom bar with the Back and Home buttons, side by side */
    .sec-4-7 .ph-navb { border: 0; background: none; padding: 6px 0; font: inherit; font-size: 14px; font-weight: 700; color: var(--ink-2); cursor: pointer; } /* the Back and Home buttons: plain, bold text */
    .sec-4-7 .ph-navb:hover { color: var(--accent); background: var(--panel-3); } /* hovering Back or Home tints it */
    .sec-4-7 .ph-home { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px 8px; padding: 18px 10px; } /* the home screen's app icons in a grid three across */
    .sec-4-7 .phone.land .ph-home { grid-template-columns: repeat(6, 1fr); gap: 4px; padding: 10px 4px; } /* sideways phone: six icons across */
    .sec-4-7 .ph-icon { display: flex; flex-direction: column; align-items: center; gap: 3px; border: 0; background: none; font: inherit; font-size: 12.5px; color: var(--ink); cursor: pointer; padding: 0; } /* each app icon on the home screen: its colored square above its name */
    .sec-4-7 .ph-icon:disabled { opacity: .45; cursor: default; } /* the icons that do nothing in this lab are faded and show no hand cursor */
    .sec-4-7 .ph-ico { width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; color: var(--panel); font-weight: 900; font-size: 17px; } /* the colored square with the app's first letter */
    .sec-4-7 .phone.land .ph-ico { width: 30px; height: 30px; font-size: 14px; border-radius: 9px; } /* sideways phone: smaller icon squares */
    .sec-4-7 .ph-pop { position: absolute; inset: 0; background: color-mix(in srgb, var(--ink) 30%, transparent); display: grid; place-items: center; padding: 10px; } /* the dark see-through layer that covers the phone screen behind a pop-up */
    .sec-4-7 .ph-popcard { background: var(--panel); border: 1px solid var(--line-2); border-radius: 14px; padding: 10px 12px; box-shadow: var(--shadow-lg); font-size: 13.5px; line-height: 1.35; display: flex; flex-direction: column; gap: 8px; } /* the pop-up card itself, such as the permission question or the ANR dialog */
    .sec-4-7 .simbtns { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; } /* the user-action buttons laid out two per row */
    .sec-4-7 .simbtns .btn { justify-content: flex-start; } /* their labels line up on the left */
    .sec-4-7 .simlog > div { display: grid; grid-template-columns: 22px minmax(0, 1fr); gap: 6px; } /* each log line: a number column and the message */
    .sec-4-7 .simlog .n { color: var(--muted); text-align: right; } /* log line numbers are grey and right-aligned */
    .sec-4-7 .simlog .sys { color: var(--ink-2); font-family: var(--font); font-size: 13.5px; font-style: italic; } /* system messages in the log are italic, in normal text font */
    .sec-4-7 .simlog .why { color: var(--muted); font-family: var(--font); font-size: 13px; } /* the short reason after each callback in the log, small and grey */
    .sec-4-7 .actcard { display: grid; grid-template-columns: 128px minmax(0, 1fr); gap: 10px; align-items: center; padding: 8px 10px; border-radius: 12px; border: 1px solid var(--line); border-left: 5px solid var(--ac); background: var(--panel-2); } /* actcard: one card per activity, a small lifetime diagram beside its text, with a stripe in its color (--ac) */
    .sec-4-7 .lt rect { fill: var(--panel); stroke: var(--line-2); stroke-width: 2; transition: fill .25s, stroke .25s; } /* lt: the small nested-box lifetime diagram on each activity card; boxes start white and recolor smoothly */
    .sec-4-7 .lt rect.e.on { fill: var(--os-bg); stroke: var(--os); } /* the outer (entire lifetime) box lights up in the operating-system color when the activity is inside it */
    .sec-4-7 .lt rect.v.on { fill: var(--cpu-bg); stroke: var(--cpu); } /* the middle (visible lifetime) box lights up in the processor color */
    .sec-4-7 .lt rect.f.on { fill: var(--ok-bg); stroke: var(--ok); } /* the inner (foreground lifetime) box lights up green */
    .sec-4-7 .lt .tok { transition: transform .35s ease, opacity .25s; } /* the dot that marks the activity's state slides and fades smoothly between positions */
    .sec-4-7 .ltchip { font-size: 12.5px; } /* the three lifetime chips under each activity card use small text */
    .sec-4-7 .ltchip.off { background: var(--panel-3); color: var(--muted); opacity: .75; } /* a lifetime chip for a lifetime the activity is not inside is greyed out */
    /* main thread vs worker demo */
    .sec-4-7 .thgrid { display: grid; grid-template-columns: 318px 214px minmax(0, 1fr); gap: 16px; height: 100%; } /* thgrid: the step 6 demo in three columns: explanation and controls, the phone, the timeline and code */
    .sec-4-7 .ph-album { font-weight: 800; color: var(--ok); min-height: 24px; font-size: 14.5px; } /* the "24 photos ready" line on the phone: bold green; min-height stops the layout jumping when it appears */
    .sec-4-7 .kpi { display: flex; flex-direction: column; gap: 1px; padding: 8px 12px; border-radius: 12px; background: var(--panel-2); border: 1px solid var(--line); border-top: 4px solid var(--kc); } /* kpi: a small stat tile with a colored top edge (color from --kc), used for the four numbers in step 1 */
    .sec-4-7 .kpi b { font-size: 26px; line-height: 1.1; color: var(--kc); } /* the tile's big number, in the tile's color */
    .sec-4-7 .kpi span { font-size: 14px; line-height: 1.3; color: var(--ink-2); } /* the tile's caption under the number */
    /* importance ladder + low-memory killer */
    .sec-4-7 .lad { display: flex; flex-direction: column; gap: 6px; flex: 1; min-height: 0; } /* lad: the step 7 importance ladder, five rows stacked to fill the column */
    .sec-4-7 .lrow { flex: 1; min-height: 0; display: grid; grid-template-columns: 136px minmax(0, 1fr); gap: 8px; align-items: center; padding: 5px 8px 5px 10px; border-radius: 12px; border-left: 6px solid var(--lc); background: var(--lcb); } /* lrow: one ladder level, a label column then its process cards, with a stripe and tint in the level's color */
    .sec-4-7 .lhead { display: flex; flex-direction: column; gap: 1px; line-height: 1.25; } /* the level label: level name above its short description */
    .sec-4-7 .lhead b { color: var(--lc); font-size: 15.5px; } /* the level name in the level's color */
    .sec-4-7 .lcell { display: flex; gap: 6px; align-items: stretch; min-width: 0; } /* the row of process cards for one level */
    .sec-4-7 .pcard { flex: 1 1 0; max-width: 196px; min-width: 0; position: relative; display: flex; flex-direction: column; align-items: flex-start; gap: 0; text-align: left; padding: 5px 9px; border-radius: 10px; border: 1.5px solid color-mix(in srgb, var(--lc) 50%, transparent); background: var(--panel); font: inherit; color: var(--ink); cursor: pointer; line-height: 1.3; transition: opacity .2s, box-shadow .15s; } /* pcard: a clickable process card showing its name, size, last use and what it is doing */
    .sec-4-7 .pcard:hover { box-shadow: 0 0 0 2px var(--lc); } /* hovering a process card rings it in its level's color */
    .sec-4-7 .pcard b { font-size: 15px; } /* the process name on each card */
    .sec-4-7 .pcard.dead { opacity: .55; background: var(--panel-3); border-style: dashed; } /* a killed process's card fades, turns grey and gets a dashed border */
    .sec-4-7 .pcard.dead b { text-decoration: line-through; } /* a killed process's name is crossed out */
    .sec-4-7 .ktag { position: absolute; top: 5px; right: 8px; color: var(--bad); } /* ktag: the red "killed 1st" style tag pinned to the top-right corner of a killed card */
    .sec-4-7 .killrow { display: flex; flex-wrap: wrap; gap: 5px; align-items: center; min-height: 26px; } /* the "Kill order" row of chips; min-height keeps it from collapsing when empty */
    /* phone (narrow) layouts: steps add class "nar" to their body */
    .sec-4-7 .nar .simgrid, .sec-4-7 .nar .thgrid { grid-template-columns: minmax(0, 1fr); height: auto; } /* small screens (phone-width layout): the simulator and the thread demo collapse to one column */
    .sec-4-7 .nar .simlog { min-height: 220px; max-height: 320px; } /* small screens: the callback log gets a fixed height range so it does not grow without end */
    .sec-4-7 .nar .simbtns .btn { white-space: normal; height: auto; min-height: 30px; padding: 4px 8px; } /* small screens: long button labels may wrap onto two lines */
    .sec-4-7 .nar .actcard { grid-template-columns: 96px minmax(0, 1fr); } /* small screens: the activity card's diagram column is thinner */
    .sec-4-7 .nar .actcard svg { width: 96px; } /* small screens: the activity card's diagram is drawn smaller to match */
    .sec-4-7 .nar .lrow { grid-template-columns: minmax(0, 1fr); flex: none; } /* small screens: each ladder level stacks its label above its cards */
    .sec-4-7 .nar .lcell { flex-wrap: wrap; } /* small screens: process cards wrap onto more lines */
    .sec-4-7 .nar .pcard { flex: 1 1 130px; max-width: none; } /* small screens: process cards share the width, at least about 130 pixels each */
    .sec-4-7 .nar .chain { flex-direction: column; } /* small screens: the recap story strip runs top to bottom instead of left to right */
    .sec-4-7 .nar .chain > .muted { text-align: center; transform: rotate(90deg); } /* small screens: the arrows between story boxes turn to point downward */
  `,  // end of the section's CSS text

  steps: [  // steps: the list of screens in this section, shown one at a time with Next and Back
    /* ---------------- 1. Big picture ---------------- */
    {  // step 1 starts here: the big picture
      title: 'Many apps, little memory: Android decides who stays',  // step 1 title
      kind: 'story',  // kind "story": an introduction screen
      html: `${/* html: step 1 is fixed HTML, so it needs no render function */''}
        <div class="split r fill">${/* two-column layout that fills the screen; the right column is the smaller one */''}
          <div class="stack" style="gap:10px">${/* left column: the explanation */''}
            <p class="lead m0">In one minute on a phone you might touch chat, the camera, a map and a music player. Each one wants memory, and a phone has far less of it than a laptop.</p>${/* opening paragraph: many apps compete for a phone's small memory */''}
            <p class="m0">A classic desktop keeps a program alive until you quit it, parking idle parts of it on disk if memory runs low. Android does not wait for you: when a newly opened app needs room, it <b>kills whole processes</b>, starting with the apps you would miss least.</p>${/* paragraph: a desktop waits for you to quit; Android kills whole processes when it needs room */''}
            <p class="m0">That is safe only because Android apps are built from parts (an <span class="t">activity</span> for each screen, a <span class="t">service</span> for background work, and two more kinds) that Android starts, pauses and stops by calling each part's <span class="t">lifecycle callbacks</span>.</p>${/* paragraph: this works because apps are built from components that Android drives with lifecycle callbacks */''}
            <div class="callout analogy m0" data-label="Analogy">A tiny desk in a busy library. The book you are reading stays open in front of you. When new books arrive and the desk is full, the librarian clears away the ones you have ignored the longest, but first slips a <b>bookmark</b> into each. Android's bookmark is the small bundle of state an activity saves as it is stopped.</div>${/* analogy box: a librarian clears a full desk but first leaves a bookmark in each book */''}
            <div class="callout why m0" data-label="Why it matters">Any app you are not looking at may be gone when you come back. Apps that save their state in the right callback feel as if they never left.</div>${/* why-it-matters box: apps that save their state feel as if they never left */''}
          </div>${/* ends the left column */''}
          <div class="stack" style="gap:9px">${/* right column: the memory drawing and the four number tiles */''}
            <div class="card white" style="padding:8px 12px">${/* white card around the drawing */''}
              <svg viewBox="0 0 450 214" width="100%" role="img" aria-label="Phone memory shared by five apps; a new camera app needs room, so Android kills the empty process first and then the least recently used background process">${/* the drawing of phone memory shared by five apps; aria-label describes it for screen readers */''}
                <text x="10" y="20" font-size="16" font-weight="800">Memory for apps: 4,000 MB</text>${/* drawing title: 4,000 MB of memory for apps */''}
                <text x="10" y="39" font-size="13" class="s-sub">sizes in MB · most important on the left</text>${/* drawing subtitle: sizes in MB, most important app on the left */''}
                <rect x="268" y="6" width="172" height="32" rx="9" class="s-panel" stroke-width="2" stroke-dasharray="6 4"/>${/* dashed box at the top right for the camera app that wants to start */''}
                <text x="354" y="27" text-anchor="middle" font-size="13" font-weight="800">Camera needs 1,100</text>${/* label in that box: the camera needs 1,100 MB */''}
                <line x1="408" y1="39" x2="408" y2="70" class="s-line" marker-end="url(#arr)"/>${/* arrow from the camera box down to the free space */''}
                <g font-size="13" text-anchor="middle" font-weight="800">${/* group of shared text settings for the two kill-order marks */''}
                  <text x="284" y="66" style="fill:var(--bad)">✗ 2nd</text>${/* mark over the game: killed second */''}
                  <text x="354" y="66" style="fill:var(--bad)">✗ 1st</text>${/* mark over the calculator: killed first */''}
                </g>${/* ends the kill-order group */''}
                <rect x="10" y="72" width="86" height="52" rx="6" class="s-ok" stroke-width="2"/>${/* memory block for Chat, the foreground app, in green */''}
                <rect x="96" y="72" width="65" height="52" rx="6" class="s-accent" stroke-width="2"/>${/* memory block for Backup, which runs a service */''}
                <rect x="161" y="72" width="75" height="52" rx="6" class="s-warn" stroke-width="2"/>${/* memory block for Browser, a background app */''}
                <rect x="236" y="72" width="97" height="52" rx="6" class="s-warn" stroke-width="2"/>${/* memory block for Game, another background app */''}
                <rect x="333" y="72" width="43" height="52" rx="6" class="s-bad" stroke-width="2"/>${/* memory block for Calc, an empty process, in red */''}
                <rect x="376" y="72" width="64" height="52" rx="6" class="s-panel" stroke-width="2" stroke-dasharray="5 4"/>${/* dashed block for the free memory at the right end */''}
                <g font-size="14" font-weight="800" text-anchor="middle">${/* group of shared text settings for the app names */''}
                  <text x="53" y="95">Chat</text><text x="128" y="95">Backup</text><text x="198" y="95">Browser</text>${/* app names on the first three blocks: Chat, Backup, Browser */''}
                  <text x="284" y="95">Game</text><text x="354" y="95">Calc</text><text x="408" y="95">free</text>${/* app names on the last three blocks: Game, Calc and free */''}
                </g>${/* ends the app-name group */''}
                <g font-size="13" text-anchor="middle">${/* group of shared text settings for the sizes */''}
                  <text x="53" y="114" class="s-sub">800</text><text x="128" y="114" class="s-sub">600</text><text x="198" y="114" class="s-sub">700</text>${/* sizes of the first three blocks in MB */''}
                  <text x="284" y="114" class="s-sub">900</text><text x="354" y="114" class="s-sub">400</text><text x="408" y="114" class="s-sub">600</text>${/* sizes of the last three blocks in MB */''}
                </g>${/* ends the size group */''}
                <g font-size="13" text-anchor="middle" font-weight="700">${/* group of shared text settings for the importance labels */''}
                  <text x="53" y="142" style="fill:var(--ok)">foreground</text><text x="126" y="142" style="fill:var(--accent)">service</text>${/* importance labels under Chat and Backup: foreground and service */''}
                  <text x="198" y="142" style="fill:var(--warn)">background</text><text x="284" y="142" style="fill:var(--warn)">background</text>${/* importance labels under Browser and Game: both background */''}
                  <text x="354" y="142" style="fill:var(--bad)">empty</text>${/* importance label under Calc: empty */''}
                </g>${/* ends the importance-label group */''}
                <g font-size="13" text-anchor="middle">${/* group of shared text settings for the activity notes */''}
                  <text x="128" y="160" class="s-sub">uploading</text><text x="198" y="160" class="s-sub">idle 5 min</text><text x="284" y="160" class="s-sub">idle 2 h</text>${/* notes: Backup is uploading, Browser idle 5 minutes, Game idle 2 hours */''}
                </g>${/* ends the activity-note group */''}
                <text x="225" y="188" text-anchor="middle" font-size="13" class="s-sub">Android reclaims memory starting from the right-hand end</text>${/* caption: Android reclaims memory starting from the right-hand end */''}
                <line x1="436" y1="202" x2="14" y2="202" class="s-muted" marker-end="url(#arr-muted)"/>${/* arrow along the bottom pointing left, the direction in which memory is reclaimed */''}
              </svg>${/* ends the drawing */''}
            </div>${/* ends the white card */''}
            <p class="small m0" style="line-height:1.4">600 MB free is not enough, so the empty Calc process goes first (1,000 MB free). Still short, so Game, idle for 2 hours, goes next (1,900 MB free): enough. Browser, Backup and Chat survive.</p>${/* worked explanation: Calc goes first, then Game, and then there is enough room */''}
            <div class="grid-2" style="gap:10px">${/* two-by-two grid of number tiles */''}
              <div class="kpi" style="--kc:var(--proc)"><b>4</b><span>kinds of app component</span></div>${/* tile: 4 kinds of app component */''}
              <div class="kpi" style="--kc:var(--os)"><b>7</b><span>lifecycle callbacks per activity</span></div>${/* tile: 7 lifecycle callbacks per activity */''}
              <div class="kpi" style="--kc:var(--thread)"><b>1</b><span>main thread per app, by default</span></div>${/* tile: 1 main thread per app by default */''}
              <div class="kpi" style="--kc:var(--warn)"><b>5</b><span>importance levels for killing</span></div>${/* tile: 5 importance levels for killing */''}
            </div>${/* ends the tile grid */''}
            <p class="xs muted m0">Section 4.6 showed how the Linux kernel underneath handles processes and threads; this section covers the rules Android adds on top. Windows' Modern apps (section 4.4) face the same squeeze.</p>${/* small note linking back to the Linux section and the Windows section */''}
          </div>${/* ends the right column */''}
        </div>`,  // ends the two-column layout and the HTML of step 1
    },  // ends step 1

    /* ---------------- 2. Anatomy of an app: four components in one sandboxed process ---------------- */
    {  // step 2 starts here: the parts of an app inside its sandbox
      title: 'Inside an app: four kinds of component, one sandbox',  // step 2 title
      kind: 'explore',  // kind "explore": the student clicks around to learn
      render(el, ctx) {  // render(el, ctx): builds step 2 inside el when the student arrives; ctx carries the guide's helpers
        const { h } = ctx;  // h builds ordinary page elements
        const INFO = {  // INFO: the text for each clickable part of the diagram, keyed by the part's data-k name
          proc: { name: 'The app\'s own process', chip: ['proc', 'sandbox'],  // the app's process: its name and the colored chip shown beside the title
            what: 'By default Android gives every app <b>one Linux process of its own</b>, under its own user ID. All four kinds of component in this app live inside it.',  // what the process is: one Linux process per app, under its own user ID
            how: 'Android creates it when any component is first needed (an icon tap, a broadcast, a query) and may kill it later to reclaim memory. A manifest setting <i>can</i> give a component a process of its own.',  // how it starts: Android creates it when a component is first needed and may kill it later
            egl: 'Example', eg: 'The car-dashboard app (left) runs in a <b>different</b> process: it cannot read this app\'s memory.',  // example: another app runs in a different process and cannot read this one's memory
            tip: ['why', 'Why it matters', 'This is the <span class="t">application sandbox</span>: a crash or a bug stays inside one box, and one app cannot spy on another.'] },  // tip box: this is the application sandbox, which contains crashes and blocks spying
          vm: { name: 'Its own virtual machine', chip: ['os', 'runtime'],  // the app's own virtual machine (the runtime that executes the app's code)
            what: 'Inside the process runs the app\'s <b>own instance</b> of the Android runtime, the virtual machine that executes the app\'s code (Dalvik on early phones, ART today).',  // what it is: the app's own instance of the Android runtime
            how: 'A fresh VM per app would start slowly, so Android forks each new app process from a warmed-up parent (Zygote) that already has the runtime loaded.',  // how it starts: forked from a warmed-up parent process so it starts quickly
            egl: 'In short', eg: 'One app = one process = one VM, by default. That is the unit Android starts, protects and, when memory is short, kills.',  // in short: one app, one process, one virtual machine by default
            tip: ['tip', 'Which kind of VM?', 'A language runtime, like the JVM of section 4.3, not a simulated computer with its own OS (section 4.6).'] },  // tip box: this is a language runtime, not a whole simulated computer
          act: { name: 'Activity', chip: ['accent', 'a screen'],  // activity: one screen
            what: 'An <span class="t">activity</span> is <b>one screen</b> the user sees and touches. This app has two: the episode list and the player.',  // what an activity is, with the two screens of this podcast app
            how: 'Started by an <span class="t">intent</span> (a message to Android, see the orange tags). Tapping the app icon sends one to the list screen; tapping an episode sends one to the player screen.',  // how an activity starts: by an intent, from an icon tap or an episode tap
            eg: 'An inbox, a camera viewfinder, a settings page, a checkout screen.',  // examples of activities
            tip: ['tip', 'Coming up', 'Activities have the richest lifecycle of the four; steps 4 and 5 follow one from birth to death.'] },  // tip box: steps 4 and 5 follow an activity's lifecycle
          svc: { name: 'Service', chip: ['cpu', 'no screen'],  // service: long work with no screen
            what: 'A <span class="t">service</span> does work that <b>takes a long time</b> and needs <b>no screen</b>, and it can keep running after the user switches to another app.',  // what a service is: long work that keeps going after the user switches apps
            how: 'Started by an intent, here from the player screen when you press Play. It keeps the episode playing while you use the browser.',  // how this service starts: by an intent from the player when Play is pressed
            eg: 'Playing music, downloading a large file, uploading photos, syncing mail.',  // examples of services
            tip: ['warn', 'Common mistake', 'A service is <b>not</b> a separate thread. Unless the app creates one, a service\'s code runs on the same main thread as the screens (step 6).'] },  // warning box: a service is not a separate thread
          br: { name: 'Broadcast receiver', chip: ['intr', 'reacts to events'],  // broadcast receiver: reacts to announcements
            what: 'A <span class="t">broadcast receiver</span> waits for <b>system-wide announcements</b> and reacts to the ones it cares about. It does its job in a few moments and finishes.',  // what a receiver is: it waits for system-wide announcements and reacts briefly
            how: 'Woken by a broadcast intent. Here Android announces "headphones unplugged", and the receiver tells the service to pause so the episode does not blast from the speaker.',  // how this receiver is woken: the headphones-unplugged broadcast, which makes it pause playback
            eg: 'Screen turned off, battery low, a download finished, the phone finished booting.',  // examples of broadcasts a receiver might hear
            tip: ['tip', 'Remember', 'A receiver has no screen and a very short life. Longer work is handed to a service.'] },  // tip box: receivers live briefly and hand longer work to a service
          cp: { name: 'Content provider', chip: ['mem', 'shares data'],  // content provider: shares data
            what: 'A <span class="t">content provider</span> is a <b>standard doorway to a set of app data</b> (query, insert, update, delete). The app itself and, with permission, other apps use the same doorway.',  // what a provider is: a standard doorway for query, insert, update and delete
            how: 'Not started by an intent: another app sends a query addressed to the provider\'s <code>content://</code> name, and Android routes it here, starting the process if needed.',  // how a provider is reached: by a query to its content:// name, not by an intent
            eg: 'The contacts list is the classic one: any app you allow can look up a phone number. The data may live in files, an SQLite database or on the web.',  // example: the contacts list, with data in files, a database or on the web
            tip: ['tip', 'Remember', 'Other apps never touch the database directly; they only see what the provider chooses to return.'] },  // tip box: other apps only see what the provider returns
          intent: { name: 'Intent', chip: ['warn', 'a message'],  // intent: a message to Android
            what: 'An <span class="t">intent</span> is a small <b>message that asks Android to activate a component</b>: start this screen, start that service, announce this event.',  // what an intent is: a request to activate a component
            how: 'An <b>explicit</b> intent names the exact component (open the player screen); an <b>implicit</b> one only describes an action ("share this link") and lets Android pick an app.',  // explicit intents name the exact component; implicit ones describe an action
            egl: 'Used for', eg: 'Starting activities and services, and carrying broadcasts. Content providers are reached by a query instead.',  // what intents are used for, and what they are not used for
            tip: ['why', 'Why it matters', 'Components are started by messages, not direct calls, so Android stays in control: it can start the process first, check permissions or pick another app.'] },  // why-it-matters box: messages instead of direct calls keep Android in control
        };  // closes INFO
        const ORDER = ['proc', 'vm', 'act', 'svc', 'br', 'cp', 'intent'];  // ORDER: the order of the parts in the progress row under the text card
        const seen = new Set();  // seen records which parts the student has opened
        const svgHTML = `${/* svgHTML: the diagram of the podcast app, written as SVG markup text */''}
<svg viewBox="0 0 660 500" width="100%" role="img" aria-label="A podcast app's process containing its virtual machine and its four components, with intents arriving from outside">${/* the drawing area, 660 by 500 units, with a description for screen readers */''}
  <g class="hot" data-k="proc" tabindex="0"><rect class="s-proc fr" x="166" y="6" width="488" height="488" rx="16" stroke-width="2.5"/>${/* clickable part "proc": the large rectangle for the app's process; tabindex lets the keyboard reach it */''}
    <text x="410" y="29" text-anchor="middle" font-size="14.5" font-weight="800" style="fill:var(--proc)">Podcasts app: one Linux process (its sandbox)</text></g>${/* the process's label at the top of the rectangle; closes the part */''}
  <g class="hot" data-k="vm" tabindex="0"><rect class="s-panel fr" x="182" y="40" width="456" height="440" rx="12" stroke-width="2"/>${/* clickable part "vm": the rectangle for the virtual machine inside the process */''}
    <text x="410" y="60" text-anchor="middle" font-size="13.5" font-weight="700" class="s-sub">its own virtual machine instance (ART)</text></g>${/* the virtual machine's label; closes the part */''}
  <g class="hot" data-k="act" tabindex="0"><rect class="s-accent fr" x="198" y="72" width="424" height="138" rx="12" stroke-width="2"/>${/* clickable part "act": the rectangle holding the two activities */''}
    <text x="214" y="94" font-size="15" font-weight="800" style="fill:var(--accent)">Activities</text><text x="296" y="94" font-size="13" class="s-sub">one per screen</text>${/* the "Activities" heading and "one per screen" note */''}
    <rect x="224" y="106" width="150" height="92" rx="9" class="s-panel" stroke-width="1.5"/><text x="299" y="125" text-anchor="middle" font-size="13" font-weight="700">Episode list</text>${/* the small episode-list screen and its title */''}
    <rect x="236" y="134" width="126" height="12" rx="3" class="s-accent" stroke-width="1"/><rect x="236" y="152" width="126" height="12" rx="3" class="s-accent" stroke-width="1"/><rect x="236" y="170" width="126" height="12" rx="3" class="s-accent" stroke-width="1"/>${/* three bars that stand for the episodes in the list */''}
    <rect x="452" y="106" width="150" height="92" rx="9" class="s-panel" stroke-width="1.5"/><text x="527" y="125" text-anchor="middle" font-size="13" font-weight="700">Player</text>${/* the small player screen and its title */''}
    <circle cx="527" cy="160" r="20" class="s-accent" stroke-width="2"/><path d="M521 150 L521 170 L537 160 Z" style="fill:var(--accent)"/>${/* a round play button with a triangle inside */''}
    <line x1="376" y1="152" x2="448" y2="152" class="s-line" marker-end="url(#arr)"/></g>${/* arrow from the list screen to the player screen; closes the activities part */''}
  <g class="hot" data-k="br" tabindex="0"><rect class="s-intr fr" x="198" y="232" width="190" height="104" rx="12" stroke-width="2"/>${/* clickable part "br": the broadcast receiver's rectangle */''}
    <text x="293" y="256" text-anchor="middle" font-size="15" font-weight="800" style="fill:var(--intr)">Broadcast receiver</text>${/* the receiver's title */''}
    <text x="293" y="280" text-anchor="middle" font-size="13">hears "headphones out"</text><text x="293" y="300" text-anchor="middle" font-size="13">and asks the service</text><text x="293" y="318" text-anchor="middle" font-size="13">to pause</text></g>${/* three lines saying it hears "headphones out" and asks the service to pause; closes the part */''}
  <g class="hot" data-k="svc" tabindex="0"><rect class="s-cpu fr" x="432" y="232" width="190" height="104" rx="12" stroke-width="2"/>${/* clickable part "svc": the service's rectangle */''}
    <text x="527" y="256" text-anchor="middle" font-size="15" font-weight="800" style="fill:var(--cpu)">Service</text>${/* the service's title */''}
    <text x="527" y="280" text-anchor="middle" font-size="13">plays the episode</text><text x="527" y="300" text-anchor="middle" font-size="13">no screen; keeps going</text><text x="527" y="318" text-anchor="middle" font-size="13">when you switch apps</text></g>${/* three lines saying it plays the episode with no screen and keeps going; closes the part */''}
  <line x1="527" y1="199" x2="527" y2="229" class="s-line" marker-end="url(#arr)"/>${/* arrow from the player screen down to the service it starts */''}
  <line x1="389" y1="290" x2="429" y2="290" class="s-line" marker-end="url(#arr)"/>${/* arrow from the receiver to the service it tells to pause */''}
  <g class="hot" data-k="cp" tabindex="0"><rect class="s-mem fr" x="198" y="358" width="424" height="108" rx="12" stroke-width="2"/>${/* clickable part "cp": the content provider's rectangle */''}
    <text x="214" y="382" font-size="15" font-weight="800" style="fill:var(--mem)">Content provider</text>${/* the provider's title */''}
    <text x="214" y="405" font-size="13">one doorway to the episode data</text>${/* line: one doorway to the episode data */''}
    <text x="214" y="426" font-size="13" class="s-sub">SQLite database + downloaded audio files</text>${/* line: what the data is made of, a database and audio files */''}
    <text x="214" y="450" font-size="13" class="s-monot" style="fill:var(--mem)">query · insert · update · delete</text>${/* line: the four operations it offers */''}
    <ellipse cx="560" cy="386" rx="34" ry="9" class="s-mem" stroke-width="2"/><path d="M526 386 V436 A34 9 0 0 0 594 436 V386" class="s-mem" stroke-width="2"/><ellipse cx="560" cy="386" rx="34" ry="9" class="s-mem" stroke-width="2"/>${/* a database drawn as a cylinder */''}
    <text x="560" y="420" text-anchor="middle" font-size="13" font-weight="700">data</text></g>${/* the word "data" on the cylinder; closes the provider part */''}
  <rect x="4" y="96" width="146" height="50" rx="10" class="s-panel" stroke-width="1.5"/><text x="77" y="117" text-anchor="middle" font-size="13" font-weight="700">You tap the</text><text x="77" y="135" text-anchor="middle" font-size="13" font-weight="700">app icon</text>${/* outside box on the left: you tap the app icon */''}
  <rect x="4" y="258" width="146" height="50" rx="10" class="s-panel" stroke-width="1.5"/><text x="77" y="279" text-anchor="middle" font-size="13" font-weight="700">Android announces</text><text x="77" y="297" text-anchor="middle" font-size="13" font-weight="700">headphones out</text>${/* outside box on the left: Android announces headphones out */''}
  <rect x="4" y="386" width="146" height="50" rx="10" class="s-panel" stroke-width="1.5"/><text x="77" y="407" text-anchor="middle" font-size="13" font-weight="700">Another app:</text><text x="77" y="425" text-anchor="middle" font-size="13" font-weight="700">car dashboard</text>${/* outside box on the left: another app, a car dashboard */''}
  <path d="M150 121 C 180 121, 196 150, 222 150" class="s-line" marker-end="url(#arr)"/>${/* curved arrow from the icon tap to the episode list */''}
  <line x1="150" y1="283" x2="196" y2="283" class="s-line" marker-end="url(#arr)"/>${/* arrow from the announcement to the receiver */''}
  <line x1="150" y1="411" x2="196" y2="411" class="s-line" marker-end="url(#arr)"/>${/* arrow from the car dashboard app to the provider */''}
  <g class="hot" data-k="intent" tabindex="0"><rect class="s-warn fr" x="378" y="128" width="68" height="20" rx="10" stroke-width="1.5"/><text x="412" y="143" text-anchor="middle" font-size="13" font-weight="800" style="fill:var(--warn)">intent</text></g>${/* clickable "intent" tag on the arrow from list to player */''}
  <g class="hot" data-k="intent" tabindex="0"><rect class="s-warn fr" x="537" y="204" width="68" height="20" rx="10" stroke-width="1.5"/><text x="571" y="219" text-anchor="middle" font-size="13" font-weight="800" style="fill:var(--warn)">intent</text></g>${/* clickable "intent" tag on the arrow from player to service */''}
  <g class="hot" data-k="intent" tabindex="0"><rect class="s-warn fr" x="16" y="152" width="68" height="20" rx="10" stroke-width="1.5"/><text x="50" y="167" text-anchor="middle" font-size="13" font-weight="800" style="fill:var(--warn)">intent</text></g>${/* clickable "intent" tag on the arrow from the icon tap */''}
  <g class="hot" data-k="intent" tabindex="0"><rect class="s-warn fr" x="16" y="314" width="118" height="20" rx="10" stroke-width="1.5"/><text x="75" y="329" text-anchor="middle" font-size="13" font-weight="800" style="fill:var(--warn)">broadcast intent</text></g>${/* clickable "broadcast intent" tag on the announcement arrow */''}
  <rect x="16" y="442" width="118" height="20" rx="10" class="s-mem" stroke-width="1.5"/><text x="75" y="457" text-anchor="middle" font-size="13" font-weight="800" style="fill:var(--mem)">content:// query</text>${/* a "content:// query" tag on the car dashboard arrow, not clickable, since providers are not reached by intents */''}
</svg>`;  // ends the diagram markup
        const svgWrap = h('div', { html: svgHTML, style: { display: 'grid', placeItems: 'center', height: '100%' } });  // svgWrap turns the markup into real elements and centers the drawing
        const title = h('h3', { class: 'm0' });  // title is the heading of the text card
        const chip = h('span', { class: 'chip' });  // chip is the small colored label beside the heading
        const body = h('div', { class: 'stack', style: { gap: '8px' } });  // body holds the paragraphs of the text card
        const prog = h('div', { class: 'row gap-s' });  // prog is the progress row of parts explored so far
        function paintProg() {  // paintProg(): redraws the progress row
          prog.replaceChildren(h('span', { class: 'xs muted b' }, `Explored ${seen.size}/${ORDER.length}:`), ...ORDER.map((k) => h('button', { type: 'button', class: 'chip ' + (seen.has(k) ? 'ok' : ''), onclick: () => show(k) }, (seen.has(k) ? '✓ ' : '') + INFO[k].name.replace('The app\'s own ', '').replace('Its own ', ''))));  // "Explored n/7" then one chip button per part, ticked once seen, with the long names shortened
        }  // ends paintProg()
        function show(k) {  // show(k): shows the text for part k and highlights it in the drawing; runs on a click or key press
          const d = INFO[k];  // d is the text entry for part k
          seen.add(k);  // marks part k as explored
          svgWrap.querySelectorAll('.hot').forEach((g) => g.classList.toggle('sel', g.dataset.k === k));  // gives the selected part the thick frame and removes it from every other part
          title.textContent = d.name;  // puts the part's name in the card heading
          chip.className = 'chip ' + d.chip[0]; chip.textContent = d.chip[1];  // colors the chip and sets its text, such as "sandbox" or "a screen"
          body.replaceChildren(  // refills the card's body
            h('p', { class: 'm0', html: d.what }),  // paragraph: what the part is
            h('p', { class: 'm0 small', html: '<b>How it starts:</b> ' + d.how }),  // paragraph: how it starts
            h('p', { class: 'm0 small', html: `<b>${d.egl || 'Examples'}:</b> ` + d.eg }),  // paragraph: examples, or a different label such as "In short" when the entry gives one
            h('div', { class: 'callout m0 small fade-in ' + d.tip[0], 'data-label': d.tip[1], html: d.tip[2] }));  // the part's tip, warning or why box; the entry picks its style, label and text
          paintProg();  // updates the progress row with the new tick
        }  // ends show()
        svgWrap.addEventListener('click', (e) => { const g = e.target.closest('.hot'); if (g) show(g.dataset.k); });  // one click listener for the whole drawing: finds the clickable part that was clicked and shows it
        svgWrap.addEventListener('keydown', (e) => { const g = e.target.closest('.hot'); if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); show(g.dataset.k); } });  // Enter or Space on a keyboard-focused part does the same, so the diagram works without a mouse
        const left = h('div', { class: 'stack', style: { gap: '10px' } },  // left column: the instructions, the text card and the progress row
          h('p', { class: 'm0', html: 'An Android app is a bundle of <b>components</b> that Android can start and stop one at a time. There are exactly four kinds. <b>Click every part</b> of this podcast app.' }),  // instructions: an app is a bundle of exactly four kinds of component; click every part
          h('div', { class: 'card white stack', style: { gap: '8px', minHeight: '330px' } }, h('div', { class: 'row', style: { justifyContent: 'space-between' } }, title, chip), body),  // the white text card with its heading row and body; min-height stops it resizing between parts
          prog);  // the progress row; closes the left column
        el.append(h('div', { class: 'split l fill' }, left, svgWrap));  // puts the text on the left and the drawing on the right
        show('proc');  // starts with the process explained, so the card is never empty
      },  // ends render() for step 2
    },  // ends step 2

    /* ---------------- 3. Component matcher game ---------------- */
    {  // step 3 starts here: the component matcher game
      title: 'Which component should do the job? Sort 12 real tasks',  // step 3 title
      kind: 'lab',  // kind "lab"
      render(el, ctx) {  // render(): builds step 3 when the student arrives
        const { h } = ctx;  // h builds page elements
        const T = {  // T: the four bins, one per component kind: name, color, short definition, clue words and icon
          act: { name: 'Activity', c: 'accent', def: 'a screen the user sees and touches', clue: 'Clue words: screen, page, button, shows',  // Activity bin, in the accent color
            ico: '<rect x="11" y="3" width="22" height="38" rx="4"/><line x1="16" y1="12" x2="28" y2="12"/><line x1="16" y1="19" x2="28" y2="19"/><line x1="16" y1="26" x2="24" y2="26"/>' },  // its icon: a phone screen with lines of text
          svc: { name: 'Service', c: 'cpu', def: 'long-running work with no screen', clue: 'Clue words: keeps going, background, minutes',  // Service bin, in the processor color
            ico: '<path d="M36 22 A14 14 0 1 1 30 10"/><path d="M24 6 L31 10 L26 16"/>' },  // its icon: a circular arrow for work that keeps going
          cp: { name: 'Content provider', c: 'mem', def: 'serves an app\'s stored data to whoever asks', clue: 'Clue words: shares, look up, other apps\' data',  // Content provider bin, in the memory color
            ico: '<ellipse cx="22" cy="10" rx="13" ry="5"/><path d="M9 10 V32 A13 5 0 0 0 35 32 V10"/><path d="M9 21 A13 5 0 0 0 35 21"/>' },  // its icon: a database cylinder
          br: { name: 'Broadcast receiver', c: 'intr', def: 'reacts briefly to a system-wide announcement', clue: 'Clue words: when Android announces…, notices',  // Broadcast receiver bin, in the interrupt color
            ico: '<line x1="22" y1="22" x2="22" y2="41"/><circle cx="22" cy="19" r="3"/><path d="M14 11 A11 11 0 0 0 14 27"/><path d="M30 11 A11 11 0 0 1 30 27"/><path d="M8 5 A19 19 0 0 0 8 33"/><path d="M36 5 A19 19 0 0 1 36 33"/>' },  // its icon: an antenna sending out waves
        };  // closes T
        const NOT = {  // NOT: what each component is, shown when the student wrongly picks it
          act: 'an activity is a screen the user sees and touches.',  // after a wrong pick of Activity
          svc: 'a service carries out long-running work that needs no screen.',  // after a wrong pick of Service
          cp: 'a content provider hands out an app\'s stored data through a standard query interface.',  // after a wrong pick of Content provider
          br: 'a broadcast receiver sleeps until an event is announced to everyone, then reacts briefly.',  // after a wrong pick of Broadcast receiver
        };  // closes NOT
        const HINT = {  // HINT: a nudge toward the right kind, keyed by the correct answer
          act: 'Here the user is looking at, and touching, a screen.',  // hint when the answer is Activity
          svc: 'Here the work runs for a long time and needs no screen.',  // hint when the answer is Service
          cp: 'Here stored data is being shared through a standard doorway.',  // hint when the answer is Content provider
          br: 'Here the app reacts to an announcement that went out to every app.',  // hint when the answer is Broadcast receiver
        };  // closes HINT
        const S = [  // S: the twelve tasks, each with its right bin, the task text, a short label for the bin and the explanation
          { k: 'act', t: 'The screen where you type a new text message.', s: 'Compose-message screen', why: 'The user looks at it and types into it, so it is an activity.' },  // task 1: the compose-message screen is an activity
          { k: 'svc', t: 'Keeps a podcast playing after you switch to the web browser.', s: 'Podcast keeps playing', why: 'Long work, no screen, and it must outlive the switch to another app: a service.' },  // task 2: keeping a podcast playing is a service
          { k: 'cp', t: 'Lets a messaging app look up a friend\'s phone number that the Contacts app stores.', s: 'Contacts shared with apps', why: 'One app\'s stored data served to other apps through a standard interface: a content provider.' },  // task 3: sharing stored contacts is a content provider
          { k: 'br', t: 'Pauses a big sync when Android announces "battery low".', s: 'Battery-low reaction', why: 'Reacting to a system-wide announcement is a broadcast receiver\'s job. Any long follow-up work would go to a service.' },  // task 4: reacting to "battery low" is a broadcast receiver
          { k: 'svc', t: 'Uploads 300 holiday photos to cloud storage while the phone is in your pocket.', s: 'Photo upload in pocket', why: 'Minutes of work with nothing to show on screen: a service.' },  // task 5: uploading 300 photos in the background is a service
          { k: 'act', t: 'The settings page with switches for notifications and dark mode.', s: 'Settings page', why: 'A page the user sees and taps is an activity.' },  // task 6: the settings page is an activity
          { k: 'br', t: 'Notices that a file download the app asked for has just finished.', s: 'Download-finished notice', why: 'Android announces "download complete"; a broadcast receiver hears it and reacts.' },  // task 7: noticing a finished download is a broadcast receiver
          { k: 'cp', t: 'Gives other apps read access to calendar events kept in an SQLite database.', s: 'Calendar data for others', why: 'A standard doorway to stored data (here an SQLite database) is a content provider.' },  // task 8: sharing calendar events from a database is a content provider
          { k: 'act', t: 'The map screen that shows your route and a big Start button.', s: 'Route map screen', why: 'A screen with a button the user presses: an activity.' },  // task 9: the route map with a Start button is an activity
          { k: 'br', t: 'Stops a battery-hungry animation as soon as the screen is turned off.', s: 'Screen-off reaction', why: '"Screen turned off" is a system-wide announcement, so a broadcast receiver reacts to it.' },  // task 10: reacting to the screen turning off is a broadcast receiver
          { k: 'svc', t: 'Downloads tomorrow\'s newspaper edition overnight, with no screen shown.', s: 'Overnight download', why: 'Long background work with no user interface is a service.' },  // task 11: downloading a newspaper overnight is a service
          { k: 'cp', t: 'A dictionary app shares its word list (stored in files) so keyboard apps can suggest words.', s: 'Word list for keyboards', why: 'Sharing stored data (files, here) with other apps is what a content provider is for.' },  // task 12: sharing a word list with keyboard apps is a content provider
        ];  // closes S
        let i = 0, tried = false, firstRight = 0, answered = 0, placed = {};  // i is the current task; tried notes a wrong pick this round; firstRight and answered count results; placed lists each bin's tasks
        const dots = h('div', { class: 'row gap-s' });  // dots is the row of progress marks
        const score = h('span', { class: 'chip ok' });  // score is the chip counting first-try successes
        const qnum = h('span', { class: 'chip accent' });  // qnum is the "Task n of 12" chip
        const qtext = h('div', { class: 'mt-q' });  // qtext shows the task to sort
        const fb = h('div', { class: 'callout m0 small', 'data-label': 'Your move' });  // fb is the feedback box
        const next = h('button', { class: 'btn primary', type: 'button', onclick: () => advance() }, 'Next task ▶');  // next is the button that moves to the next task
        const bins = {};  // bins keeps each bin's button, task list and counter
        const binGrid = h('div', { class: 'grid-4', style: { flex: '1', minHeight: 0 } });  // binGrid lays the four bins out in a row
        Object.entries(T).forEach(([k, d]) => {  // builds one bin for each component kind
          const list = h('div', { class: 'stack', style: { gap: '4px' } });  // list will show the tasks already sorted into this bin
          const count = h('span', { class: 'xs b muted' });  // count shows how many of the bin's three tasks are in it
          const b = h('button', { class: 'bin', type: 'button', style: { '--bc': `var(--${d.c})`, '--bcb': `var(--${d.c}-bg)` }, onclick: () => pick(k) },  // the bin button, colored by its kind; a click sends its key to pick()
            h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('b', {}, d.name), count),  // top row: the kind's name and the counter
            h('span', { class: 'small', style: { color: 'var(--ink-2)' } }, d.def), h('div', { class: 'bin-line' }), list,  // the short definition, a dashed line, and the sorted tasks
            h('div', { class: 'bin-foot', html: `<svg viewBox="0 0 44 44" width="40" height="40" fill="none" stroke-width="2.5" stroke-linecap="round" style="stroke:var(--${d.c});flex:none">${d.ico}</svg><span class="xs muted">${d.clue}</span>` }));  // the icon and clue words at the bottom of the bin
          bins[k] = { b, list, count };  // remembers the bin's parts for later updates
          binGrid.append(b);  // adds the bin to the grid
        });  // ends the loop over kinds
        function paint() {  // paint(): redraws the progress, the score, the bins and the question area
          dots.replaceChildren(...S.map((_, j) => h('span', { class: 'mdot' + (j < i ? ' ok' : j === i ? ' cur' : '') })));  // one mark per task: green if done, colored for the current one
          score.textContent = `${firstRight} right first try`;  // updates the first-try score
          Object.entries(bins).forEach(([k, v]) => {  // refreshes every bin
            const items = placed[k] || [];  // items are the task labels placed in this bin so far
            v.list.replaceChildren(...items.map((t) => h('span', { class: 'chip ' + T[k].c, style: { whiteSpace: 'normal', lineHeight: '1.3', padding: '3px 9px' } }, t)));  // shows each placed task as a chip in the bin's color
            v.count.textContent = `${items.length}/3`;  // shows how many of the three tasks for this bin are placed
          });  // ends the bin loop
          if (i >= S.length) {  // all twelve tasks are done
            qnum.textContent = 'Done';  // the chip says Done
            qtext.innerHTML = `All 12 tasks sorted. You got <b>${firstRight} of 12</b> right on the first try.`;  // the final result in the question area
            fb.className = 'callout tip m0 small'; fb.dataset.label = 'Pattern to remember';  // the feedback box becomes a tip
            fb.innerHTML = 'Ask two questions: <b>does the user look at it?</b> (activity) · <b>does it run long without a screen?</b> (service). Otherwise it either <b>shares stored data</b> (content provider) or <b>reacts to an announcement</b> (broadcast receiver).';  // the pattern to remember: two questions separate activities and services from the other two
            next.textContent = 'Play again ↺';  // the button now restarts the game
            return;  // stops here: the rest is for a task in progress
          }  // ends the finished case
          qnum.textContent = `Task ${i + 1} of ${S.length}`;  // shows "Task n of 12"
          qtext.textContent = S[i].t;  // shows the task text as plain text
          next.textContent = 'Next task ▶';  // the button's normal label
        }  // ends paint()
        function pick(k) {  // pick(k): runs when the student clicks bin k for the current task
          if (i >= S.length) return;  // ignores clicks after the last task
          const sc = S[i];  // sc is the current task
          if (placed.__done) return;  // ignores clicks once this task has been answered
          if (k === sc.k) {  // the right bin was clicked
            if (!tried) firstRight++;  // counts a first-try success only if no wrong bin was clicked before
            answered++;  // counts the task as answered
            (placed[k] = placed[k] || []).push(sc.s);  // adds the task's short label to the bin, creating the bin's list the first time
            placed.__done = true;  // marks this task as answered, so further clicks are ignored
            fb.className = 'callout tip m0 small fade-in'; fb.dataset.label = tried ? 'Now you have it' : 'Right';  // the feedback box turns into a tip, labelled "Right" or "Now you have it"
            fb.innerHTML = sc.why;  // shows why this is the right component
            bins[k].b.classList.remove('wrong'); bins[k].b.classList.add('flash');  // stops any shake and briefly flashes the bin to confirm the choice
            ctx.after(900, () => bins[k].b.classList.remove('flash'));  // removes the flash after 0.9 seconds; ctx.after cancels itself if the student leaves the step
            next.disabled = false;  // enables the Next button
          } else {  // a wrong bin was clicked
            tried = true;  // remembers the miss, so this task no longer counts as a first-try success
            fb.className = 'callout bad m0 small fade-in'; fb.dataset.label = 'Not quite';  // the feedback box turns red, labelled "Not quite"
            fb.innerHTML = `Not a ${T[k].name.toLowerCase()}: ${NOT[k]} ${HINT[sc.k]}`;  // says what the clicked component really is, plus a hint toward the right one
            const b = bins[k].b; b.classList.remove('wrong'); void b.offsetWidth; b.classList.add('wrong');  // restarts the shake: remove the class, force the browser to recalculate layout, then add it again
          }  // ends the wrong-pick case
          paint();  // redraws bins, score and progress
        }  // ends pick()
        function setTask() {  // setTask(): prepares the screen for the current task
          tried = false; delete placed.__done;  // clears the wrong-pick flag and the answered mark
          next.disabled = i < S.length;  // Next stays disabled until the task is answered (it is enabled on the score screen)
          if (i < S.length) { fb.className = 'callout m0 small'; fb.dataset.label = 'Your move'; fb.innerHTML = 'Click the component that should do this job. A wrong guess explains itself, then you can try again.'; }  // resets the feedback box to its starting instructions
          Object.values(bins).forEach((v) => v.b.classList.remove('wrong'));  // stops any bin that is still shaking
          paint();  // redraws
        }  // ends setTask()
        function reset() { i = 0; firstRight = 0; answered = 0; placed = {}; setTask(); }  // reset(): starts the game over from task 1 with empty bins
        function advance() {  // advance(): runs when Next is clicked
          if (i >= S.length) { reset(); return; }  // on the score screen Next means "Play again"
          if (!placed.__done) { ctx.toast('Pick a component for this task first.'); return; }  // before an answer, Next only shows a short reminder pop-up
          i++; setTask();  // moves to the next task
        }  // ends advance()
        el.append(h('div', { class: 'stack fill', style: { gap: '10px' } },  // puts the game on screen as one column that fills the step
          h('div', { class: 'row', style: { justifyContent: 'space-between' } },  // top row of the game
            h('div', { class: 'row gap-s' }, qnum, score), dots),  // the task number and score on the left, the progress marks on the right
          h('div', { class: 'card white row nw', style: { gap: '16px', padding: '14px 18px', minHeight: '86px' } }, h('div', { class: 'grow' }, qtext)),  // white card holding the task text; min-height stops it resizing between tasks
          binGrid,  // the four bins
          h('div', { class: 'row nw', style: { gap: '12px', alignItems: 'stretch' } }, h('div', { class: 'grow' }, fb), h('div', { style: { display: 'grid', placeItems: 'center' } }, next))));  // bottom row: the feedback box beside the Next button
        reset();  // starts the first round
      },  // ends render() for step 3
    },  // ends step 3

    /* ---------------- 4. The activity lifecycle as three nested lifetimes ---------------- */
    {  // step 4 starts here: the lifecycle map with its three nested lifetimes
      title: 'Activity lifecycle: seven callbacks, three lifetimes',  // step 4 title
      kind: 'learn',  // kind "learn": a reading and clicking screen
      render(el, ctx) {  // render(): builds step 4 when the student arrives
        const { h } = ctx;  // h builds page elements
        const INFO = {  // INFO: the text for each clickable pill or box: title, color, when it happens, what it does, what comes next
          onCreate: { t: 'onCreate()', c: 'os', when: 'The activity is being created: first launch, after its process was killed and the user came back, or after a screen rotation.',  // onCreate(): called when the activity is being created
            does: 'Builds the screen layout and sets up its data. If Android hands it a saved-state bundle, it restores what the user had.', next: 'Created, still invisible. Android calls <code>onStart()</code> straight away.' },  // what onCreate() does and that onStart() follows at once
          onStart: { t: 'onStart()', c: 'cpu', when: 'The activity is about to become visible.',  // onStart(): called just before the activity becomes visible
            does: 'Starts whatever the screen needs while it can be seen, such as refreshing what it displays.', next: 'Started (visible). <code>onResume()</code> follows straight away.' },  // what onStart() does and that onResume() follows at once
          onResume: { t: 'onResume()', c: 'ok', when: 'The activity is about to come to the very front and start receiving the user\'s taps.',  // onResume(): called just before the activity comes to the front
            does: 'Restarts animations, video, the camera preview or sensors that were paused.', next: '<b>Resumed</b> (running). It stays here until something comes in front of it.' },  // what onResume() does and that the activity stays Resumed
          onPause: { t: 'onPause()', c: 'ok', when: 'Another <b>activity</b> is coming in front, even if it covers only part of the screen (a permission request, for example), or the user is starting to leave. An ordinary dialog drawn by the activity itself does not pause it.',  // onPause(): called when another activity comes in front, even partly, or the user starts to leave
            does: 'Pauses animations and video and lets go of the camera. It must be <b>quick</b>: the next activity cannot start until it returns.', next: '<b><span class="t" data-t="Paused state">Paused</span></b>. Back to <code>onResume()</code> if the user returns; on to <code>onStop()</code> if it becomes fully hidden.' },  // what onPause() does (it must be quick) and the two ways out of Paused
          onStop: { t: 'onStop()', c: 'cpu', when: 'The activity is no longer visible at all (the user pressed Home, or a full-screen activity covered it).',  // onStop(): called when the activity is no longer visible at all
            does: 'Saves the user\'s work (for example writes a draft to storage) and releases what it does not need while hidden.', next: '<b><span class="t" data-t="Stopped state">Stopped</span></b>, still in memory. Next comes <code>onRestart()</code>, <code>onDestroy()</code>, or a silent kill of the whole process.' },  // what onStop() does (save the user's work) and the three things that can follow
          onRestart: { t: 'onRestart()', c: 'cpu', when: 'A stopped activity is about to be shown again because the user navigated back to it.',  // onRestart(): called when a stopped activity is about to be shown again
            does: 'Anything special to do only when coming back from Stopped.', next: 'Android then calls <code>onStart()</code> and <code>onResume()</code>, as on a first launch.' },  // what onRestart() does and that onStart() and onResume() follow
          onDestroy: { t: 'onDestroy()', c: 'os', when: 'The activity is finishing (the user pressed Back, or the app called finish()), or Android is rebuilding it (rotation).',  // onDestroy(): called when the activity is finishing or being rebuilt after rotation
            does: 'Final clean-up of anything created in onCreate().', next: 'Gone. Its entire lifetime is over.', warn: 'It is <b>not guaranteed</b>: if Android kills the process to reclaim memory, no callback runs at all. Save work in <code>onPause()</code> or <code>onStop()</code>, never only here.' },  // its final clean-up, and a warning that it does not run if the process is killed
          entire: { t: 'Entire lifetime', c: 'os', when: 'The <span class="t">entire lifetime</span> runs from <code>onCreate()</code> to <code>onDestroy()</code>: the outer box.',  // the outer box, the entire lifetime from onCreate() to onDestroy()
            does: 'Anything that must exist for the activity\'s whole life is set up in onCreate() and released in onDestroy().', next: 'The ring inside it but outside the middle box is the <b>Stopped</b> state: the activity still exists but cannot be seen.' },  // what belongs in the entire lifetime, and that its outer ring is the Stopped state
          visible: { t: 'Visible lifetime', c: 'cpu', when: 'The <span class="t">visible lifetime</span> runs from <code>onStart()</code> to <code>onStop()</code>: the middle box. The user can see the activity, at least partly.',  // the middle box, the visible lifetime from onStart() to onStop()
            does: 'It may be entered and left many times as the user switches away and back.', next: 'The ring inside it but outside the inner box is the <b>Paused</b> state: visible but without the user\'s focus.' },  // it can be entered many times, and its ring is the Paused state
          fore: { t: 'Foreground lifetime', c: 'ok', when: 'The <span class="t">foreground lifetime</span> runs from <code>onResume()</code> to <code>onPause()</code>: the inner box. The activity is in front of everything and gets every tap.',  // the inner box, the foreground lifetime from onResume() to onPause()
            does: 'It can switch in and out very often (every permission window, every screen-off), so code here must be light.', next: 'Inside this box the activity is <b>Resumed</b>, also called running.' },  // code here must be light because it is entered and left often; inside is the Resumed state
          killed: { t: 'Process killed', c: 'intr', when: 'Memory is short and the app\'s activities are all Paused or (far more often) Stopped, so Android kills the whole process.',  // the red box: the process is killed for memory
            does: 'Nothing: <b>no callback runs</b>. The activity objects vanish with the process. What survives is a small bundle of state that Android asked the activity to save (in <code>onSaveInstanceState()</code>) as it stopped, and that Android keeps outside the app\'s process.', next: 'If the user navigates back, Android starts a new process and calls <code>onCreate()</code> with the saved state, so the screen looks as it was.' },  // no callback runs; only the saved state survives outside the process, and returning rebuilds from it via onCreate()
        };  // closes INFO
        const pill = (k, x, y) => `<g class="hot gate" data-k="${k}" tabindex="0"><rect class="fr" x="${x - 47}" y="${y - 13}" width="94" height="26" rx="13"/><text x="${x}" y="${y + 5}" text-anchor="middle">${k}()</text></g>`;  // pill(k, x, y): writes the markup for a clickable callback pill centered at (x, y), labelled k()
        const svgHTML = `${/* svgHTML: the lifecycle diagram, written as SVG markup text */''}
<svg viewBox="0 0 680 478" width="100%" role="img" aria-label="Three nested boxes: entire lifetime, visible lifetime and foreground lifetime, with lifecycle callbacks on their edges">${/* the drawing area, 680 by 478 units, with a description for screen readers */''}
  <g class="hot" data-k="entire" tabindex="0"><rect class="s-os fr" x="62" y="30" width="556" height="378" rx="18" stroke-width="2"/>${/* clickable box "entire": the outer rectangle */''}
    <text x="80" y="54" font-size="15" font-weight="800" style="fill:var(--os)">Entire lifetime</text>${/* its "Entire lifetime" label */''}
    <text x="360" y="386" text-anchor="middle" font-size="14" font-weight="800">STOPPED <tspan class="s-sub" font-weight="500">hidden, kept in memory</tspan></text></g>${/* the STOPPED label in the ring between the outer and middle boxes; closes the box */''}
  <g class="hot" data-k="visible" tabindex="0"><rect class="s-cpu fr" x="166" y="76" width="348" height="276" rx="16" stroke-width="2"/>${/* clickable box "visible": the middle rectangle */''}
    <text x="182" y="99" font-size="15" font-weight="800" style="fill:var(--cpu)">Visible lifetime</text>${/* its "Visible lifetime" label */''}
    <text x="340" y="333" text-anchor="middle" font-size="14" font-weight="800">PAUSED <tspan class="s-sub" font-weight="500">seen, no focus</tspan></text></g>${/* the PAUSED label in the ring between the middle and inner boxes; closes the box */''}
  <g class="hot" data-k="fore" tabindex="0"><rect class="s-ok fr" x="270" y="118" width="140" height="190" rx="14" stroke-width="2"/>${/* clickable box "fore": the inner rectangle */''}
    <text x="340" y="140" text-anchor="middle" font-size="14" font-weight="800" style="fill:var(--ok)">Foreground</text>${/* its "Foreground" label */''}
    <text x="340" y="179" text-anchor="middle" font-size="15" font-weight="800">RESUMED</text>${/* the RESUMED state name in the middle */''}
    <text x="340" y="197" text-anchor="middle" font-size="13" class="s-sub">(running)</text>${/* "(running)", the other name for Resumed */''}
    <text x="340" y="268" text-anchor="middle" font-size="13" class="s-sub">user is</text><text x="340" y="285" text-anchor="middle" font-size="13" class="s-sub">touching it</text></g>${/* "user is touching it" near the bottom of the inner box; closes the box */''}
  <line x1="166" y1="277" x2="166" y2="238" class="s-line" marker-end="url(#arr)"/>${/* arrow up from the onRestart pill to the onStart pill */''}
  <path d="M236 381 C 180 381, 150 340, 160 306" class="s-muted" stroke-width="2" marker-end="url(#arr-muted)"/>${/* curved grey arrow from the Stopped ring to onRestart */''}
  <text x="38" y="196" text-anchor="middle" font-size="13" font-weight="700" class="s-sub">launch</text>${/* the word "launch" left of the diagram, where an activity comes in */''}
  <text x="652" y="196" text-anchor="middle" font-size="13" font-weight="700" class="s-sub">gone</text>${/* the word "gone" right of the diagram, where it leaves */''}
  ${pill('onCreate', 62, 223)}${pill('onStart', 166, 223)}${pill('onResume', 270, 223)}${/* the three pills on the left edges, the way in: onCreate, onStart, onResume */''}
  ${pill('onPause', 410, 223)}${pill('onStop', 514, 223)}${pill('onDestroy', 618, 223)}${/* the three pills on the right edges, the way out: onPause, onStop, onDestroy */''}
  ${pill('onRestart', 166, 290)}${/* the onRestart pill below onStart */''}
  <path d="M470 346 V418" fill="none" style="stroke:var(--intr)" stroke-width="2" stroke-dasharray="6 5" marker-end="url(#arr-intr)"/>${/* dashed red arrow from the Paused ring down to "Process killed" */''}
  <path d="M590 398 V418" fill="none" style="stroke:var(--intr)" stroke-width="2" stroke-dasharray="6 5" marker-end="url(#arr-intr)"/>${/* dashed red arrow from the Stopped ring down to "Process killed" */''}
  <g class="hot" data-k="killed" tabindex="0"><rect class="s-intr fr" x="400" y="422" width="240" height="50" rx="12" stroke-width="2" stroke-dasharray="7 5"/>${/* clickable box "killed": a dashed red rectangle below the lifetimes */''}
    <text x="520" y="443" text-anchor="middle" font-size="14" font-weight="800" style="fill:var(--intr)">Process killed</text>${/* the "Process killed" title inside the red box */''}
    <text x="520" y="462" text-anchor="middle" font-size="13">no callback runs</text></g>${/* the line "no callback runs"; closes the red box */''}
  <path d="M398 447 H 24 V 240" fill="none" style="stroke:var(--intr)" stroke-width="2" stroke-dasharray="6 5" marker-end="url(#arr-intr)"/>${/* dashed red path from the red box back along the bottom and up to onCreate */''}
  <text x="212" y="440" text-anchor="middle" font-size="13" font-weight="700" style="fill:var(--intr)">user comes back → new process → onCreate()</text>${/* label on that path: coming back means a new process and a fresh onCreate() */''}
</svg>`;  // ends the lifecycle diagram markup
        const svgWrap = h('div', { html: svgHTML, style: { display: 'grid', placeItems: 'center', height: '100%' } });  // svgWrap turns the markup into real elements and centers the drawing
        const title = h('h3', { class: 'm0' });  // title is the heading of the explanation card
        const chip = h('span', { class: 'chip' });  // chip is the small label beside the heading
        const body = h('div', { class: 'stack', style: { gap: '8px' } });  // body holds the card's paragraphs
        const seenCb = new Set();  // seenCb records which of the seven callbacks the student has opened
        const cbCount = h('span', { class: 'chip accent' });  // cbCount is the chip that shows how many callbacks have been opened
        function show(k) {  // show(k): fills the card for pill or box k and highlights it; runs on a click or key press
          const d = INFO[k];  // d is the text entry for k
          svgWrap.querySelectorAll('.hot').forEach((g) => g.classList.toggle('sel', g.dataset.k === k));  // gives the selected pill or box the thick frame and removes it from the others
          if (/^on/.test(k)) seenCb.add(k);  // names that start with "on" are callbacks, so they count toward the seven
          cbCount.textContent = `callbacks opened: ${seenCb.size}/7`;  // updates the "callbacks opened" counter
          title.textContent = d.t;  // puts the title in the card heading
          chip.className = 'chip ' + d.c;  // colors the chip to match
          chip.textContent = /^on/.test(k) ? 'callback' : k === 'killed' ? 'no callback' : 'lifetime';  // the chip says "callback", "no callback" for the red box, or "lifetime" for a box
          body.replaceChildren(  // refills the card's body
            h('p', { class: 'm0', html: '<b>When:</b> ' + d.when }),  // paragraph: when it happens
            h('p', { class: 'm0 small', html: '<b>' + (/^on/.test(k) ? 'A well-written app' : 'Meaning') + ':</b> ' + d.does }),  // paragraph: what a well-written app does there, or what the box means
            h('p', { class: 'm0 small', html: '<b>' + (/^on/.test(k) ? 'Afterwards' : 'State') + ':</b> ' + d.next }),  // paragraph: what comes afterwards, or which state lies inside the box
            ...(d.warn ? [h('div', { class: 'callout warn m0 small fade-in', 'data-label': 'Common mistake', html: d.warn })] : []));  // adds a "Common mistake" warning when the entry has one (only onDestroy)
        }  // ends show()
        svgWrap.addEventListener('click', (e) => { const g = e.target.closest('.hot'); if (g) show(g.dataset.k); });  // one click listener for the whole drawing: finds the pill or box that was clicked and shows it
        svgWrap.addEventListener('keydown', (e) => { const g = e.target.closest('.hot'); if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); show(g.dataset.k); } });  // Enter or Space on a keyboard-focused pill or box does the same
        const right = h('div', { class: 'stack', style: { gap: '10px' } },  // right column: the explanation, a hint with the counter, and the card
          h('p', { class: 'm0', html: 'An activity moves through a few states. Every move is announced by a <span class="t">lifecycle callback</span>, a method Android calls on the activity. Read the boxes as three <b>nested lifetimes</b>: you enter a box through the callback on its left edge and leave through the one on its right.' }),  // intro: every move between states is announced by a callback; read the boxes as nested lifetimes
          h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'xs muted b' }, 'Click any pill or box, including the red one.'), cbCount),  // hint to click any pill or box, with the callbacks-opened counter beside it
          h('div', { class: 'card white stack', style: { gap: '8px', minHeight: '290px', flex: 'none' } }, h('div', { class: 'row', style: { justifyContent: 'space-between' } }, title, chip), body));  // the white explanation card; min-height stops it resizing between pills
        el.append(h('div', { class: 'split r fill' }, svgWrap, right));  // puts the drawing on the left and the text on the right
        show('onCreate');  // starts with onCreate() explained
      },  // ends render() for step 4
    },  // ends step 4

    /* ---------------- 5. Lifecycle simulator ---------------- */
    {  // step 5 starts here: the lifecycle simulator
      title: 'Lifecycle simulator: use the app, watch the callbacks fire',  // step 5 title
      kind: 'explore',  // kind "explore"
      core: true,  // core: true keeps this step on the shorter core path through the guide
      render(el, ctx) {  // render(): builds step 5 when the student arrives
        const { h } = ctx;  // h builds page elements
        if (ctx.narrow) el.classList.add('nar'); // phone layout (see css)
        const NAME = { A: 'NoteList', B: 'NoteEditor' };  // NAME: the two activities of the pretend Notes app, A (the note list) and B (the editor)
        const COL = { A: 'accent', B: 'io' };  // COL: the color of each activity, used in the log, the phone and the cards
        const LABEL = { none: 'not created', created: 'Created', started: 'Started', resumed: 'Resumed (running)', paused: 'Paused', stopped: 'Stopped', destroyed: 'Destroyed', killed: 'Killed · state saved' };  // LABEL: the words shown on an activity's card for each state
        const CHIP = { resumed: 'ok', paused: 'warn', stopped: 'cpu', killed: 'intr', created: 'os', started: 'os' };  // CHIP: the chip color for each state
        const POS = { created: [16, 52], started: [38, 52], resumed: [64, 52], paused: [64, 80], stopped: [64, 100] };  // POS: where the dot sits in the small lifetime diagram for each state (outer ring, middle ring or center)
        const st = {};  // st holds the whole simulated situation; fresh() fills it
        let busy = false, n = 0, nextPid = 4211;  // busy is true while a callback sequence plays; n numbers log lines; nextPid is the next process ID to hand out
        const fresh = () => Object.assign(st, { proc: false, pid: 0, screen: 'home', popup: false, orient: 'portrait', stack: [],  // fresh(): resets to no process, home screen, no pop-up, upright phone and an empty back stack
          acts: { A: { state: 'none', orient: 'portrait', last: '' }, B: { state: 'none', orient: 'portrait', last: '' } } });  // ...and both activities not yet created, with no last callback
        const top = () => st.stack[st.stack.length - 1];  // top(): the activity on top of the back stack, the one the user would see
        const logEl = h('div', { class: 'log grow simlog' });  // logEl is the log of callbacks, which grows as events happen
        function log(who, text, why) {  // log(who, text, why): adds one numbered line to the log
          n++;  // counts the line
          const main = who === 'sys' ? `<span class="sys">${text}</span>` : `<span><b style="color:var(--${COL[who]})">${who}</b>.${text}${why ? ` <span class="why">${why}</span>` : ''}</span>`;  // a system message is shown in italics; a callback shows as A.onX() or B.onX() plus its reason
          logEl.append(h('div', { class: 'fade-in', html: `<span class="n">${n}</span>${main}` }));  // appends the line with a fade-in
          logEl.scrollTop = logEl.scrollHeight;  // scrolls the log to the newest line
        }  // ends log()
        const cb = (who, name, to, why) => ({ who, name, to, why });  // cb(...): describes one callback: which activity, which method, the state it leads to, and why
        const newProc = () => { const pid = nextPid; nextPid += 177; return [{ fn: () => { st.proc = true; st.pid = pid; } }, { sys: `Android starts a new process for Notes (pid ${pid}).` }]; };  // newProc(): two steps that start a new process with a fresh ID (each one 177 higher) and log it
        const createSeq = (X, why) => [cb(X, 'onCreate', 'created', why), cb(X, 'onStart', 'started', 'about to be visible'), cb(X, 'onResume', 'resumed', 'in front: taps go here')];  // createSeq(X, why): the three callbacks that bring activity X up: onCreate, onStart, onResume
        function bringFront(X) {  // bringFront(X): works out which callbacks bring activity X back to the front, depending on its state
          const a = st.acts[X];  // a is X's current record
          if (!st.proc) return [...newProc(), ...createSeq(X, 'rebuilt from its saved state')];  // no process: start one and rebuild X from its saved state
          if (a.state === 'killed') return createSeq(X, 'its old instance died with the old process; rebuilt from saved state');  // the process died and came back: X's old instance is gone, so it is rebuilt
          if (a.state === 'paused') return [cb(X, 'onResume', 'resumed', 'back in front')];  // X was only Paused: onResume is enough
          if (a.state === 'stopped' && a.orient !== st.orient) return [cb(X, 'onDestroy', 'destroyed', 'built for the old orientation'), ...createSeq(X, 'rebuilt for the new orientation')];  // X was Stopped but the phone has rotated since: destroy the old instance and build a new one
          return [cb(X, 'onRestart', 'stopped', 'coming back from Stopped'), cb(X, 'onStart', 'started', 'visible again'), cb(X, 'onResume', 'resumed', 'in front again')];  // X was Stopped: onRestart, onStart and onResume
        }  // ends bringFront()
        async function run(seq) {  // run(seq): plays a list of steps one by one with pauses, so the student sees each callback happen
          busy = true; paint();  // marks the simulator busy so the buttons are disabled
          for (const it of seq) {  // goes through the steps in order
            if (it.fn) { it.fn(); paint(); continue; }  // a step with fn changes the situation (for example pushes an activity) and redraws at once
            if (it.sys) { log('sys', it.sys); paint(); await ctx.sleep(300); if (!ctx.alive) return; continue; }  // a step with sys logs a system message, waits 0.3 s, and stops if the student left the step
            const a = st.acts[it.who];  // otherwise the step is a callback on activity a
            a.state = it.to; a.last = it.name + '()';  // moves the activity to its new state and remembers the callback's name
            if (it.name === 'onCreate') a.orient = st.orient;  // an activity built by onCreate() is built for the current orientation
            log(it.who, `<code>${it.name}()</code>`, it.why);  // logs the callback with its reason
            paint();  // redraws the phone and the cards
            await ctx.sleep(430);  // waits 0.43 seconds before the next callback
            if (!ctx.alive) return;  // stops if the student has left the step meanwhile
          }  // ends the loop over steps
          busy = false; paint();  // the sequence is over: buttons come back
        }  // ends run()
        const can = {  // can: for each user action, a test of whether it makes sense right now; used to enable buttons
          launch: () => st.screen === 'home' && !st.stack.length,  // Launch: only from the home screen with nothing on the back stack
          open: () => st.screen === 'app' && top() === 'A' && st.acts.A.state === 'resumed' && !st.popup,  // Open a note: only while the list is in front and no pop-up is showing
          popOn: () => st.screen === 'app' && st.acts[top()].state === 'resumed' && !st.popup,  // Pop-up appears: only while the top activity is Resumed and no pop-up is up
          popOff: () => st.popup,  // Pop-up closes: only while a pop-up is showing
          home: () => st.screen === 'app',  // Home: only while an app screen is showing
          ret: () => st.screen === 'home' && st.stack.length > 0,  // Return to Notes: only from the home screen when Notes has activities on its back stack
          rotate: () => st.screen === 'app' && st.acts[top()].state === 'resumed' && !st.popup,  // Rotate: only while the top activity is Resumed with no pop-up
          back: () => st.screen === 'app',  // Back: only while an app screen is showing
          kill: () => st.proc && (st.screen === 'home' || st.popup),  // Low memory kill: only if the process exists and the app is hidden or covered by a pop-up
        };  // closes can
        const act = {  // act: what each user action does, as a sequence of steps handed to run()
          launch() {  // Launch Notes
            const seq = st.proc ? [{ sys: 'The Notes process is still cached (an empty process), so Android reuses it: a quick "warm" start.' }] : newProc();  // if the process still exists (kept as an empty process), it is reused for a quick warm start; otherwise a new one is made
            run([...seq, { fn: () => { st.stack.push('A'); st.screen = 'app'; } }, ...createSeq('A', 'launch intent: build the list screen')]);  // then list activity A goes on the back stack, the app screen shows, and A is created, started and resumed
          },  // ends launch
          open() {  // Open a note: the list opens the editor
            run([cb('A', 'onPause', 'paused', 'B is about to come in front'), { fn: () => st.stack.push('B') }, ...createSeq('B', 'intent: open the editor'),  // A is paused first, then B goes on the back stack and is created, started and resumed
              cb('A', 'onStop', 'stopped', 'only now, fully covered, is A stopped')]);  // only once B fully covers it is A stopped
          },  // ends open
          popOn() { run([{ fn: () => { st.popup = true; } }, cb(top(), 'onPause', 'paused', 'a permission window, itself an activity, covers part of the screen: still visible, no focus')]); },  // Pop-up appears: a permission window covers part of the screen, so the top activity is only paused
          popOff() { const X = top(); run([{ fn: () => { st.popup = false; } }, ...bringFront(X)]); },  // Pop-up closes: the window goes away and the top activity comes back to the front
          home() {  // Home: the user leaves the app for the home screen
            const X = top(), s0 = st.acts[X].state;  // X is the top activity and s0 its state before the button was pressed
            const seq = s0 === 'resumed' ? [cb(X, 'onPause', 'paused', 'the user is leaving')] : [];  // a Resumed activity is paused first
            seq.push({ fn: () => { st.screen = 'home'; st.popup = false; } });  // the phone shows the home screen, and any pop-up disappears
            if (s0 === 'resumed' || s0 === 'paused') seq.push(cb(X, 'onStop', 'stopped', 'fully hidden: save the draft now'));  // an activity that was visible is now stopped, the moment to save the draft
            else seq.push({ sys: 'No callback: the Notes process is already gone.' });  // if the process was already killed there is no activity to call, so only a message is logged
            run(seq);  // plays the sequence
          },  // ends home
          ret() { const X = top(); run([{ fn: () => { st.screen = 'app'; } }, ...bringFront(X)]); },  // Return to Notes: the app screen comes back and the top activity is brought to the front
          rotate() {  // Rotate phone: the screen changes shape
            const X = top(), to = st.orient === 'portrait' ? 'landscape' : 'portrait';  // X is the top activity and to is the new orientation
            const seq = [{ sys: 'Rotation changes the screen\'s shape. By default Android saves the screen\'s state, destroys the activity and builds a new one for the new shape.' },  // a system message explains that rotation rebuilds the activity by default
              cb(X, 'onPause', 'paused'), cb(X, 'onStop', 'stopped'), cb(X, 'onDestroy', 'destroyed', `old ${st.orient} instance thrown away`),  // the old instance is paused, stopped and destroyed
              { fn: () => { st.orient = to; } }, ...createSeq(X, `new ${to} instance, saved state restored`)];  // the orientation flips, then a new instance is created with the saved state restored
            if (X === 'B') seq.push({ sys: 'A stays Stopped underneath; Android rebuilds it for the new shape only when it is shown again.' });  // if the editor is on top, a note says the list underneath is rebuilt only when shown again
            run(seq);  // plays the sequence
          },  // ends rotate
          back() {  // Back: the Back button
            if (st.popup) { const X = top(); run([{ fn: () => { st.popup = false; } }, { sys: 'Back closes the pop-up first.' }, ...bringFront(X)]); return; }  // with a pop-up open, Back only closes the pop-up and brings the activity back to the front
            if (st.stack.length === 2) {  // with two activities on the back stack, Back finishes the editor
              run([cb('B', 'onPause', 'paused', 'the user is leaving B'), ...bringFront('A'), cb('B', 'onStop', 'stopped'),  // B is paused, A comes back to the front, then B is stopped...
                cb('B', 'onDestroy', 'destroyed', 'finished and removed from the back stack'), { fn: () => st.stack.pop() }]);  // ...and destroyed, and removed from the back stack
              return;  // stops here for the two-activity case
            }  // ends the two-activity case
            run([cb('A', 'onPause', 'paused', 'Back on the last screen'), { fn: () => { st.screen = 'home'; } }, cb('A', 'onStop', 'stopped'),  // with only the list left, Back leaves the app: A is paused, the home screen shows, A is stopped
              cb('A', 'onDestroy', 'destroyed', 'finished: the back stack is empty'), { fn: () => st.stack.pop() },  // A is destroyed and removed from the back stack
              { sys: 'No activities are left, yet Android keeps the process alive as an <b>empty process</b>: a cache that makes the next launch faster.' },  // message: the process stays alive as an empty process, a cache for a faster next launch
              { sys: '(Android 12 and later usually just move the app to the background here instead of finishing it; this is the classic behaviour.)' }]);  // message: newer Android versions usually keep the activity instead; this lab shows the classic behaviour
          },  // ends back
          kill() {  // Low memory kill: Android kills the Notes process
            const had = st.stack.length, vis = st.popup;  // had says whether any activities were on the back stack; vis says whether a pop-up left the app visible
            run([{ sys: `Memory is short. Android kills the Notes process (pid ${st.pid}) without any warning.` },  // message: memory is short and the process is killed without warning
              { fn: () => { st.proc = false; st.pid = 0; ['A', 'B'].forEach((x) => { const a = st.acts[x]; a.state = st.stack.includes(x) ? 'killed' : 'none'; a.last = st.stack.includes(x) ? '(none: killed)' : ''; }); } },  // the process disappears; activities on the back stack become "killed" with no last callback, others "not created"
              { sys: had ? 'No callback runs, not even <code>onDestroy()</code>. The back stack and each activity\'s saved state survive outside the process.' : 'It was an empty process, so nothing is lost; the next launch just needs a new process (a "cold" start).' },  // message: no callback ran but the saved state survives, or for an empty process that nothing was lost
              ...(vis ? [{ sys: 'Killing a Paused (visible) app is rare: Android does it only when memory is desperately short.' }] : [])]);  // if the app was still visible, a note that killing a Paused app is rare
          },  // ends kill
        };  // closes act
        /* ---- phone ---- */
        const phone = h('div', { class: 'phone' });  // phone is the pretend phone on the left
        const go = (k) => () => { if (busy) return; if (can[k]()) act[k](); else ctx.toast('That action does not apply right now.'); };  // go(k): makes the click handler for action k; ignored while busy, and a pop-up message explains a disallowed action
        function drawPhone() {  // drawPhone(): redraws the pretend phone to match the current situation
          phone.classList.toggle('land', st.orient === 'landscape');  // turns the phone sideways when the orientation is landscape
          const status = h('div', { class: 'ph-status' }, h('span', {}, '9:41'), h('span', {}, st.proc ? 'Notes: pid ' + st.pid : 'no Notes process'));  // status bar: the time and the Notes process ID, or "no Notes process"
          const screen = h('div', { class: 'ph-screen' });  // screen is the phone's display area
          if (st.screen === 'home') {  // the home screen
            const icons = [['Notes', 'accent'], ['Mail', 'cpu'], ['Maps', 'mem'], ['Music', 'io'], ['Camera', 'os'], ['Clock', 'proc']];  // the six app icons with their colors
            screen.append(h('div', { class: 'ph-bar', style: { background: 'var(--panel-3)', color: 'var(--ink-2)' } }, 'Home screen'),  // home screen title bar
              h('div', { class: 'ph-home' }, ...icons.map(([nm, c], i) => h('button', { class: 'ph-icon', type: 'button', disabled: i > 0, 'aria-label': nm, onclick: i ? null : go(st.stack.length ? 'ret' : 'launch') },  // icon grid; only the first icon (Notes) works, launching the app or returning to it
                h('span', { class: 'ph-ico', style: { background: `var(--${c})` } }, nm[0]), h('span', {}, nm)))));  // each icon is a colored square with the app's first letter, above the app's name
          } else {  // an app screen is showing
            const X = top(), a = st.acts[X];  // X is the top activity and a its record
            const live = st.proc && a.state !== 'killed';  // live is false if the process or this activity's instance is gone
            const body = h('div', { class: 'ph-body' + (live && (a.state === 'resumed' || a.state === 'paused') ? '' : ' dim') });  // the content area, faded unless the activity is alive and at least partly visible
            if (!live) body.append(h('p', { class: 'small muted center m0', style: { marginTop: '30px' } }, 'The Notes process is gone.'));  // no live activity: say that the process is gone
            else if (X === 'A') body.append(...['Buy milk, eggs, coffee', 'OS lab moved to Friday', 'Gift ideas for Sam'].map((t, i) => h('button', { class: 'ph-note', type: 'button', onclick: i === 0 ? go('open') : null }, t)));  // list screen: three notes; tapping the first one opens the editor
            else body.append(h('div', { class: 'ph-edit' }, 'Buy milk, eggs, coffee', h('b', { class: 'pulse' }, '|')), h('div', { class: 'xs muted' }, 'Saved state keeps this text safe.'));  // editor screen: the note text with a blinking cursor and a reminder about saved state
            screen.append(h('div', { class: 'ph-bar', style: { background: `var(--${COL[X]}-bg)`, color: `var(--${COL[X]})` } }, X === 'A' ? 'Notes' : 'Edit note'), body);  // title bar in the activity's color, then the content
          }  // ends the app-screen case
          if (st.popup) screen.append(h('div', { class: 'ph-pop' }, h('div', { class: 'ph-popcard' }, h('b', {}, 'Allow Notes to record audio?'),  // with a pop-up: a dark layer and a card asking to allow audio recording
            h('div', { class: 'row gap-s', style: { justifyContent: 'flex-end' } }, h('button', { class: 'btn sm', type: 'button', onclick: go('popOff') }, 'Deny'), h('button', { class: 'btn sm primary', type: 'button', onclick: go('popOff') }, 'Allow')))));  // Deny and Allow both just close the pop-up
          phone.replaceChildren(status, screen, h('div', { class: 'ph-nav' }, h('button', { class: 'ph-navb', type: 'button', onclick: go('back') }, '◁ Back'), h('button', { class: 'ph-navb', type: 'button', onclick: go('home') }, '○ Home')));  // puts the status bar, the screen and the bottom Back and Home buttons into the phone
        }  // ends drawPhone()
        /* ---- controls, cards ---- */
        const B = {};  // B keeps each control button by action name, so paint() can enable or disable it
        const mk = (k, label, cls) => (B[k] = h('button', { class: 'btn sm ' + (cls || ''), type: 'button', onclick: go(k) }, label));  // mk(k, label, cls): makes the control button for action k and stores it in B
        const btns = h('div', { class: 'simbtns' }, mk('launch', '▶ Launch Notes', 'primary'), mk('open', '→ Open a note'), mk('popOn', '▣ Pop-up appears'), mk('popOff', '▢ Pop-up closes'),  // the button grid: Launch, Open a note, Pop-up appears, Pop-up closes
          mk('home', '○ Home'), mk('ret', '↩ Return to Notes'), mk('rotate', '↻ Rotate phone'), mk('back', '◁ Back'), mk('kill', '✗ Low memory: kill', 'intr'),  // then Home, Return, Rotate, Back and the red low-memory kill
          h('button', { class: 'btn sm ghost', type: 'button', onclick: () => { if (busy) return; fresh(); n = 0; logEl.innerHTML = ''; log('sys', 'Reset. Tap <b>Launch Notes</b> to begin.'); paint(); } }, '⟲ Reset'));  // Reset: brings everything back to the start, clears the log and redraws (ignored while busy)
        const procCard = h('div', { class: 'card tight row', style: { justifyContent: 'space-between' } });  // procCard is the card showing the Notes process, its ID and its importance level
        const stackRow = h('div', { class: 'row gap-s', style: { minHeight: '28px' } });  // stackRow shows the back stack as chips
        const cards = {};  // cards holds the card of each activity
        ['A', 'B'].forEach((X) => {  // builds a card for activity A and one for activity B
          const tok = ctx.s('g', { class: 'tok' }, ctx.s('circle', { r: 7, style: `fill:var(--${COL[X]})` }));  // tok is the colored dot that marks the activity's state in its small diagram
          const svg = ctx.s('svg', { viewBox: '0 0 128 112', width: '128', class: 'lt' },  // the small lifetime diagram, 128 by 112 units
            ctx.s('rect', { class: 'e', x: 2, y: 2, width: 124, height: 108, rx: 12 }), ctx.s('rect', { class: 'v', x: 30, y: 16, width: 68, height: 74, rx: 10 }),  // the outer box (entire lifetime) and the middle box (visible lifetime)
            ctx.s('rect', { class: 'f', x: 46, y: 32, width: 36, height: 38, rx: 8 }), tok);  // the inner box (foreground lifetime), then the dot on top
          const chip = h('span', { class: 'chip' }), last = h('span', { class: 'xs muted' });  // chip will show the state name; last will show the last callback
          const lts = ['Entire', 'Visible', 'Foreground'].map((t, i) => h('span', { class: 'chip ltchip ' + ['os', 'cpu', 'ok'][i], title: t + ' lifetime' }, t));  // three chips, Entire, Visible and Foreground, that grey out when the activity is outside that lifetime
          cards[X] = { svg, tok, chip, last, lts };  // stores the card's moving parts
          cards[X].el = h('div', { class: 'actcard', style: { '--ac': `var(--${COL[X]})` } }, svg,  // the card itself: the small diagram on the left...
            h('div', { class: 'stack', style: { gap: '5px' } }, h('div', {}, h('b', { style: { color: `var(--${COL[X]})` } }, X), ' ', h('span', { class: 'b' }, NAME[X])), h('div', {}, chip), h('div', { class: 'xs muted b' }, 'Lifetimes it is inside:'), h('div', { class: 'row', style: { gap: '4px' } }, ...lts), last));  // ...and on the right the activity's letter and name, its state chip, its lifetime chips and its last callback
        });  // ends the loop over activities
        function paint() {  // paint(): redraws the phone, the buttons, the process card, the back stack and the activity cards
          drawPhone();  // redraws the pretend phone
          Object.keys(can).forEach((k) => { B[k].disabled = busy || !can[k](); });  // each button is disabled while a sequence plays or when its action does not apply
          const imp = !st.proc ? ['none', ''] : st.screen === 'app' && !st.popup ? ['foreground', 'ok'] : st.screen === 'app' ? ['visible', 'proc'] : st.stack.length ? ['background', 'warn'] : ['empty', 'bad'];  // imp: the process's importance level and chip color, from where the app is (none, foreground, visible, background, empty)
          stackRow.replaceChildren(h('span', { class: 'small b', html: '<span class="t">Back stack</span> (top on the right):' }),  // rebuilds the back-stack row with its label (linked to the glossary)
            ...(st.stack.length ? st.stack.map((X, k) => h('span', { class: 'row gap-s' }, k ? h('span', { class: 'muted' }, '▸') : '', h('span', { class: 'chip ' + COL[X] }, X + ' ' + NAME[X]))) : [h('span', { class: 'xs muted' }, 'empty')]));  // each activity on the stack as a chip, with a small arrow between them, or "empty"
          procCard.replaceChildren(h('span', { class: 'b' }, 'Notes process'), h('span', { class: 'chip' }, st.proc ? 'pid ' + st.pid : 'no process'), h('span', { class: 'chip ' + imp[1] }, 'importance: ' + imp[0]));  // rebuilds the process card: name, process ID and importance level
          ['A', 'B'].forEach((X) => {  // updates each activity card
            const a = st.acts[X], c = cards[X];  // a is the activity's record and c its card
            const lvl = { created: 1, stopped: 1, started: 2, paused: 2, resumed: 3 }[a.state] || 0;  // lvl is how many nested lifetimes the activity is inside: 1 when created or stopped, 2 when started or paused, 3 when resumed
            c.svg.querySelector('.e').classList.toggle('on', lvl >= 1); c.svg.querySelector('.v').classList.toggle('on', lvl >= 2); c.svg.querySelector('.f').classList.toggle('on', lvl >= 3);  // lights the outer, middle and inner boxes up to that depth
            c.lts.forEach((e, i) => e.classList.toggle('off', lvl < i + 1));  // greys out the lifetime chips the activity is not inside
            const p = POS[a.state];  // p is where the dot goes for this state, if anywhere
            c.tok.style.opacity = p ? 1 : 0;  // hides the dot when the state has no place in the diagram (not created, destroyed, killed)
            if (p) c.tok.style.transform = `translate(${p[0]}px, ${p[1]}px)`;  // moves the dot; the CSS transition animates it
            c.chip.className = 'chip ' + (CHIP[a.state] || '');  // colors the state chip
            c.chip.textContent = LABEL[a.state];  // writes the state's name on the chip
            c.last.innerHTML = a.last ? 'last callback: <b class="mono">' + a.last + '</b>' : 'no callbacks yet';  // shows the last callback in code font, or "no callbacks yet"
          });  // ends the loop over activities
        }  // ends paint()
        fresh();  // sets up the starting situation
        log('sys', 'The phone is on the home screen and Notes is not running. Tap <b>Launch Notes</b>.');  // first log line: the phone is on the home screen and Notes is not running
        const mid = h('div', { class: 'stack', style: { gap: '8px', minHeight: 0 } }, h('h4', { class: 'm0' }, 'What the user does'), btns, stackRow,  // middle column: "What the user does", the buttons and the back stack
          h('p', { class: 'small muted m0', html: 'Reminder: an <span class="t">activity</span> comes up through <code>onCreate()</code> → <code>onStart()</code> → <code>onResume()</code> and goes down through <code>onPause()</code> → <code>onStop()</code> → <code>onDestroy()</code>; <code>onRestart()</code> brings a Stopped one back.' }),  // reminder of the order of the callbacks going up and going down
          h('h4', { class: 'm0' }, 'Callbacks, in the order Android calls them'), logEl);  // heading for the log, then the log itself
        const right = h('div', { class: 'stack', style: { gap: '8px' } }, procCard, cards.A.el, cards.B.el,  // right column: the process card and the two activity cards
          h('div', { class: 'callout tip m0 small', 'data-label': 'Try these', html: '① Launch, then Pop-up: only <code>onPause()</code> runs. ② Open a note, then Back: A restarts <i>before</i> B is destroyed. ③ Home, Low memory, Return: <code>onCreate()</code> again. ④ Rotate: six callbacks.' }));  // tip box: four experiments to try and what each one shows
        el.append(h('div', { class: 'simgrid' }, h('div', { class: 'phone-wrap' }, phone), mid, right));  // puts the phone, the middle column and the right column on screen
        paint();  // first draw
      },  // ends render() for step 5
    },  // ends step 5

    /* ---------------- 6. One process, one main thread: freeze vs worker ---------------- */
    {  // step 6 starts here: the main thread versus a worker thread
      title: 'One process, one main thread: freeze it or free it',  // step 6 title
      kind: 'explore',  // kind "explore"
      render(el, ctx) {  // render(): builds step 6 when the student arrives
        const { h, s } = ctx;  // h builds page elements, s builds SVG drawing elements
        if (ctx.narrow) el.classList.add('nar'); // phone layout (see css)
        const X0 = 70, PX = 48, DL = 8, END = 10, ANR = 5;  // timeline settings: left edge, pixels per second, resize length 8 s, timeline end 10 s, ANR after 5 s
        const xs = (t) => X0 + t * PX;  // xs(t): turns a time in seconds into an x position on the timeline
        let mode = 'main', running = false, t = 0, taps = [], likes = 0, anr = null, done = false, closed = false, angle = 0, shownPct = 0, shownLikes = 0;  // the demo's state: which version, whether it runs, the clock, the taps, likes, ANR, whether finished or closed, spinner angle, shown values
        /* ---- timeline ---- */
        const svg = s('svg', { viewBox: '0 0 580 206', width: '100%' });  // the timeline drawing, 580 by 206 units
        const g = (cls) => s('g', cls ? { class: cls } : {});  // g(cls): makes an empty SVG group, with a class if one is given
        const axis = g(), mainRed = s('rect', { x: X0, y: 40, height: 38, width: 0, rx: 6, class: 's-bad', 'stroke-width': 1.5 });  // axis will hold the tick marks; mainRed is the red "blocked" bar on the main thread's lane
        const mainGreen = s('rect', { x: X0, y: 40, height: 38, width: 0, rx: 6, class: 's-ok', 'stroke-width': 1.5 });  // mainGreen is the green "free and responsive" bar on the main thread's lane
        const workBar = s('rect', { x: X0, y: 118, height: 38, width: 0, rx: 6, class: 's-thread', 'stroke-width': 1.5 });  // workBar is the bar on the worker thread's lane
        const mainLbl = s('text', { x: X0 + 10, y: 64, 'font-size': 13, 'font-weight': 700 }), workLbl = s('text', { x: X0 + 10, y: 142, 'font-size': 13, 'font-weight': 700 });  // the text labels drawn on the main and worker lanes
        const marks = g(), cursor = s('line', { y1: 26, y2: 166, class: 's-line', 'stroke-width': 1.5, 'stroke-dasharray': '3 3' });  // marks holds tap markers and event lines; cursor is the dashed line at the current time
        for (let k = 0; k <= END; k++) axis.append(s('line', { x1: xs(k), x2: xs(k), y1: 166, y2: 172, class: 's-line', 'stroke-width': 1.2 }), s('text', { x: xs(k), y: 188, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, k + (k === END ? ' s' : '')));  // draws a tick and a seconds label for each second from 0 to 10
        svg.append(s('text', { x: 4, y: 64, 'font-size': 13, 'font-weight': 800, style: 'fill:var(--thread)' }, 'main'), s('text', { x: 4, y: 142, 'font-size': 13, 'font-weight': 800, style: 'fill:var(--thread)' }, 'worker'),  // the lane names "main" and "worker" on the left
          s('rect', { x: X0, y: 40, width: END * PX, height: 38, rx: 6, class: 's-panel', 'stroke-width': 1 }), s('rect', { x: X0, y: 118, width: END * PX, height: 38, rx: 6, class: 's-panel', 'stroke-width': 1 }),  // the two empty grey lanes, one per thread
          s('line', { x1: X0, x2: X0 + END * PX, y1: 166, y2: 166, class: 's-line', 'stroke-width': 1.2 }), axis, mainGreen, mainRed, workBar, mainLbl, workLbl, marks, cursor,  // the time axis, then everything created above, in drawing order
          s('text', { x: 4, y: 202, 'font-size': 13, class: 's-sub' }, 'time →'));  // the "time" label under the axis
        /* ---- phone ---- */
        const spin = s('g', {}, s('circle', { cx: 0, cy: 0, r: 20, class: 's-muted', 'stroke-width': 5 }), s('path', { d: 'M0 -20 A20 20 0 0 1 20 0', fill: 'none', style: 'stroke:var(--thread)', 'stroke-width': 5, 'stroke-linecap': 'round' }));  // spin: a spinning circle drawn by the main thread; it stops when the main thread is stuck
        const spinSvg = s('svg', { viewBox: '-26 -26 52 52', width: 52, height: 52 }, spin);  // the small drawing that holds the spinner
        const likeBtn = h('button', { class: 'btn sm', type: 'button', onclick: () => tap(false) });  // the Like button on the pretend phone; each tap goes to tap()
        const waiting = h('div', { class: 'xs b', style: { color: 'var(--bad)', minHeight: '18px' } });  // waiting shows how many taps are stuck in the queue, in red
        const meter = h('div', { class: 'meter' }, h('i', { style: { width: '0%', background: 'var(--thread)' } }));  // meter is the resize progress bar
        const pctTxt = h('div', { class: 'xs muted' });  // pctTxt shows the percentage, or that the screen is frozen
        const album = h('div', { class: 'ph-album' });  // album shows "24 photos ready" when the resize is done
        const anrBox = h('div', { class: 'ph-pop', style: { display: 'none' } }, h('div', { class: 'ph-popcard' }, h('b', {}, 'Photo Share isn\'t responding'), h('span', { class: 'xs muted' }, 'Do you want to close it?'),  // anrBox is the "isn't responding" dialog, hidden until an ANR happens
          h('div', { class: 'row gap-s', style: { justifyContent: 'flex-end' } }, h('button', { class: 'btn sm', type: 'button', onclick: () => anrChoice(true) }, 'Close app'), h('button', { class: 'btn sm primary', type: 'button', onclick: () => anrChoice(false) }, 'Wait'))));  // its Close app and Wait buttons, both handled by anrChoice()
        const appBody = h('div', { class: 'ph-body', style: { alignItems: 'center', textAlign: 'center', gap: '10px' } },  // appBody is the app's normal screen content
          spinSvg, h('span', { class: 'xs muted' }, 'animation drawn by the main thread'), likeBtn, waiting, h('div', { style: { width: '100%' } }, h('div', { class: 'xs b', style: { textAlign: 'left' } }, 'Resizing 24 photos'), meter, pctTxt), album);  // the spinner and its caption, the Like button, the waiting line, the progress bar and the album line
        const closedMsg = h('div', { class: 'ph-body', style: { display: 'none', justifyContent: 'center', textAlign: 'center' } }, h('b', {}, 'App closed'), h('span', { class: 'small muted' }, 'Its process was killed and the half-finished resizing was lost.'));  // closedMsg replaces the screen if the user closes the app from the ANR dialog
        const phone = h('div', { class: 'phone', style: { width: '206px', height: '430px' } }, h('div', { class: 'ph-status' }, h('span', {}, '9:41'), h('span', {}, 'Photo Share')),  // the pretend phone, slightly smaller than in step 5, with its status bar
          h('div', { class: 'ph-screen' }, h('div', { class: 'ph-bar', style: { background: 'var(--thread-bg)', color: 'var(--thread)' } }, 'Photo Share'), appBody, closedMsg, anrBox));  // the phone's screen: title bar, app content, closed message and ANR dialog
        /* ---- controls ---- */
        const clock = h('span', { class: 'chip accent num' }), fps = h('span', { class: 'chip' });  // clock shows the time on the timeline; fps shows how many times per second the screen redraws
        const narr = h('div', { class: 'callout m0 small', 'data-label': 'What is happening' });  // narr is the narration box that explains what is happening
        const startBtn = h('button', { class: 'btn primary', type: 'button', onclick: () => start() }, '▶ Tap "Resize & share"');  // the start button that simulates tapping "Resize & share"
        const codeBox = h('div', {});  // codeBox holds the code for the chosen version
        const CODE = {  // CODE: the tap handler written two ways, shown to students as code
          main: `void onResizeTap() {          // main thread runs this on a tap${/* shown code, main version, line 1: the tap handler, run by the main thread */''}
  Album a = resize(album);    // CPU-heavy: MAIN busy for 8 s${/* shown code, line 2: the heavy resize runs right here, keeping the main thread busy for 8 s */''}
  show(a);                    // screen frozen until we get here${/* shown code, line 3: showing the result waits until the resize is done */''}
}                             // only now can it draw again`,  // shown code, line 4: only after returning can the main thread draw again; ends the main version
          worker: `void onResizeTap() {          // main thread runs this on a tap${/* shown code, worker version, line 1: the same tap handler */''}
  new Thread(() -> {          // create a worker thread${/* shown code, line 2: creates a new worker thread */''}
    Album a = resize(album);  // CPU-heavy work on the WORKER${/* shown code, line 3: the heavy resize runs on the worker */''}
    runOnUiThread(() ->       // queue a job for the main thread:${/* shown code, line 4: queues a job for the main thread */''}
        show(a));             // only it may touch the screen${/* shown code, line 5: that job shows the result, because only the main thread may touch the screen */''}
  }).start();                 // start the worker, return at once${/* shown code, line 6: starts the worker; the handler returns at once */''}
}                             // main thread is free again`,  // shown code, line 7: the main thread is free again; ends the worker version
        };  // closes CODE
        const seg = ctx.ui.seg([{ value: 'main', label: 'Main thread' }, { value: 'worker', label: 'Worker thread' }], mode, (v) => { mode = v; reset(); });  // the switch between the two versions; changing it resets the demo
        function setNarr(cls, label, html) { narr.className = 'callout m0 small fade-in ' + cls; narr.dataset.label = label; narr.innerHTML = html; }  // setNarr(cls, label, html): restyles and refills the narration box
        function reset() {  // reset(): puts the demo back to time 0 for the chosen version
          running = false; t = 0; taps = []; likes = 0; anr = null; done = false; closed = false; shownPct = 0; shownLikes = 0;  // clears the clock, taps, likes, ANR and finished flags
          marks.replaceChildren();  // removes all tap markers and event lines from the timeline
          codeBox.replaceChildren(ctx.ui.code(CODE[mode], { lang: 'c', nums: false, fontSize: 13 }));  // shows the code for the chosen version without line numbers
          setNarr('', 'What is happening', mode === 'main'  // narration for the chosen version, telling the student what to do
            ? 'This version resizes the photos <b>inside the tap handler</b>, on the main thread. Press the button, then tap <b>Like</b> on the phone.'  // main version: the resize runs inside the tap handler
            : 'This version hands the resizing to a <b>worker thread</b>. Press the button, then tap <b>Like</b> on the phone.');  // worker version: the resize is handed to a worker thread
          draw();  // redraws
        }  // ends reset()
        function start() {  // start(): runs when the start button is pressed
          if (running) return;  // ignores the press while a run is in progress
          reset(); running = true;  // resets, then starts the clock
          setNarr(mode === 'main' ? 'warn' : 'tip', 'Resizing started', mode === 'main' ? 'The main thread is now stuck inside <code>resize()</code>. It cannot draw frames or handle taps until the resizing ends.' : 'The worker thread resizes the photos; the main thread keeps drawing frames and handling taps.');  // narration: the main thread is stuck, or the worker does the work while the main thread stays free
        }  // ends start()
        const busy = () => mode === 'main' && running && t < DL && !closed;  // busy(): true while the main thread is stuck inside resize() (main version, first 8 seconds, app not closed)
        function tap(auto) {  // tap(auto): records a tap on Like; auto is true for the automatic tap at 1 second
          if (closed) return;  // a closed app ignores taps
          const rec = { t, auto, handled: busy() ? null : t };  // rec remembers when the tap came and when it was handled; null means it is still waiting
          if (running || t > 0) taps.push(rec);  // keeps the tap once the demo has started, so it can be drawn and counted
          if (rec.handled != null) likes++;  // a tap handled at once adds a like straight away
          if (running && t < END) {  // while the demo is running, the tap is also drawn on the timeline
            const x = xs(t);  // x is where the current time falls on the timeline
            marks.append(s('path', { d: `M${x} 36 l-6 -10 h12 z`, style: 'fill:var(--io)' }), s('text', { x, y: 22, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, style: 'fill:var(--io)' }, auto ? 'tap' : 'you'));  // a small triangle above the main lane, labelled "tap" for the automatic one or "you" for the student's
          }  // ends the drawing of the tap marker
          if (running && busy()) setNarr('bad', 'Tap waiting', `A tap arrived at ${t.toFixed(1)} s but the main thread is busy, so it waits in the queue. Nothing on screen reacts.`);  // main version while stuck: the narration says the tap is waiting in the queue
          else if (running && mode === 'worker') setNarr('tip', 'Tap handled', `A tap at ${t.toFixed(1)} s was handled at once: the main thread is free because the worker does the resizing.`);  // worker version: the narration says the tap was handled at once
        }  // ends tap()
        function anrChoice(close) {  // anrChoice(close): runs when the student answers the ANR dialog
          anr.dismissed = true;  // the dialog is hidden from now on
          if (close) { closed = true; running = false; setNarr('bad', 'App closed', 'The user gave up. Android killed the process, and the half-finished resizing was lost with it.'); }  // Close app: the app stops and the half-finished resize is lost
          else setNarr('warn', 'Waiting', 'The user chose to wait. The app is still frozen until the resizing ends at 8 s.');  // Wait: the app stays frozen until the resize finishes at 8 s
          draw();  // redraws
        }  // ends anrChoice()
        function step(dt) {  // step(dt): moves the simulation forward by dt seconds; called on every animation frame
          if (!running) return;  // nothing happens unless a run is in progress
          const prev = t; t = Math.min(END, t + dt);  // advances the clock, never past the end of the timeline
          if (prev < 1 && t >= 1) tap(true);  // when the clock passes 1 second, an automatic tap arrives
          const pend = taps.filter((x) => x.handled == null);  // pend lists the taps still waiting to be handled
          if (mode === 'main' && !anr && pend.length && t - pend[0].t >= ANR) {  // main version: once the oldest waiting tap has waited 5 seconds, Android declares an ANR
            anr = { at: t, dismissed: false };  // records when the ANR happened
            marks.append(s('line', { x1: xs(t), x2: xs(t), y1: 30, y2: 166, style: 'stroke:var(--bad)', 'stroke-width': 2.5 }), s('text', { x: xs(t) - 6, y: 108, 'text-anchor': 'end', 'font-size': 13, 'font-weight': 800, style: 'fill:var(--bad)' }, 'ANR: a tap waited 5 s'));  // draws a red line at that moment and the label "ANR: a tap waited 5 s"
            setNarr('bad', 'Application Not Responding', 'A tap has waited 5 seconds, so Android shows the <span class="t">ANR</span> dialog. Choose <b>Wait</b> or <b>Close app</b> on the phone.');  // narration explains the ANR dialog that the phone now shows
          }  // ends the ANR check
          if (prev < DL && t >= DL && !closed) {  // when the clock passes 8 seconds the resize is finished, unless the app was closed
            done = true;  // marks the work as done
            if (mode === 'main') {  // main version
              pend.forEach((x) => { x.handled = DL; likes++; marks.append(s('line', { x1: xs(x.t), x2: xs(DL), y1: 31, y2: 31, style: 'stroke:var(--io)', 'stroke-width': 2, 'stroke-dasharray': '4 3' })); });  // every waiting tap is finally handled at 8 s; a dashed line shows how long each one waited
              setNarr('warn', 'Finished at 8 s', 'Only now does the main thread return from <code>resize()</code>, handle the waiting taps and redraw.' + (anr ? ' Too late: the user already saw the ANR dialog.' : ''));  // narration: only now does the main thread handle the taps and redraw, perhaps after an ANR
            } else {  // worker version
              marks.append(s('line', { x1: xs(DL), x2: xs(DL), y1: 118, y2: 82, style: 'stroke:var(--thread)', 'stroke-width': 2 , 'marker-end': 'url(#arr-thread)' }), s('text', { x: xs(DL) + 6, y: 104, 'font-size': 13, 'font-weight': 700, style: 'fill:var(--thread)' }, 'post result'));  // an arrow from the worker lane up to the main lane shows the result being posted back
              setNarr('tip', 'Finished at 8 s', 'The worker hands the result to the main thread with <code>runOnUiThread()</code>, and the main thread shows it. The screen never froze.');  // narration: the worker hands its result to the main thread, and the screen never froze
            }  // ends the version choice
          }  // ends the finishing case
          if (t >= END) running = false;  // the run stops at the end of the timeline
        }  // ends step()
        function draw() {  // draw(): updates the phone, the chips and the timeline to match the current moment
          const frozen = busy();  // frozen is true while the main thread is stuck
          const pct = Math.min(100, (t / DL) * 100);  // pct is how far the resize has got, in percent
          if (!frozen) { shownPct = pct; shownLikes = likes; }  // a frozen screen cannot redraw, so the shown progress and likes change only while not frozen
          spin.setAttribute('transform', `rotate(${angle})`);  // turns the spinner to its current angle
          likeBtn.textContent = `★ Like (${shownLikes})`;  // the Like button shows the likes the screen has managed to draw
          const pend = taps.filter((x) => x.handled == null).length;  // counts the taps still waiting
          waiting.textContent = pend ? `${pend} tap${pend > 1 ? 's' : ''} waiting…` : '';  // shows "n taps waiting" in red, or nothing
          meter.firstChild.style.width = shownPct + '%';  // sets the progress bar's width
          pctTxt.textContent = frozen ? 'screen frozen: no redraws' : `${Math.round(shownPct)}%`;  // the text under the bar: "screen frozen" or the percentage
          album.textContent = done && !closed ? '✓ 24 photos ready' : '';  // shows "24 photos ready" once done, unless the app was closed
          appBody.style.display = closed ? 'none' : ''; closedMsg.style.display = closed ? '' : 'none';  // shows either the app's screen or the "App closed" message
          anrBox.style.display = anr && !anr.dismissed && !closed ? '' : 'none';  // shows the ANR dialog while an ANR is active and not yet answered
          clock.textContent = `t = ${t.toFixed(1)} s`;  // shows the time on the clock chip
          fps.className = 'chip ' + (frozen ? 'bad' : 'ok'); fps.textContent = frozen ? 'screen redraws: 0 per second' : 'screen redraws: 60 per second';  // the redraw chip: red "0 per second" while frozen, green "60 per second" otherwise
          const red = mode === 'main' ? Math.min(t, DL) : 0;  // red is how many seconds the main thread has been blocked (only in the main version, at most 8)
          mainRed.setAttribute('width', red * PX);  // sets the red bar's width
          mainLbl.textContent = mode === 'main' ? (t > 0 ? 'resize() blocks everything' : '') : (t > 0 ? 'draws frames · handles taps' : '');  // the main lane's label: what the main thread is doing in this version
          const gStart = mode === 'main' ? DL : 0, gw = Math.max(0, t - gStart) * PX;  // the green part of the main lane starts at 8 s in the main version, at 0 in the worker version
          mainGreen.setAttribute('x', xs(gStart)); mainGreen.setAttribute('width', t > gStart ? gw : 0);  // places the green bar and sets its width
          workBar.setAttribute('width', mode === 'worker' ? Math.min(t, DL) * PX : 0);  // the worker bar grows only in the worker version, up to 8 seconds
          workLbl.textContent = mode === 'worker' ? (t > 0 ? 'resize() runs here' : '') : 'no worker thread in this version';  // the worker lane's label, or a note that this version has no worker thread
          workLbl.setAttribute('class', mode === 'worker' ? '' : 's-sub');  // greys that label when there is no worker
          cursor.setAttribute('x1', xs(t)); cursor.setAttribute('x2', xs(t));  // moves the dashed time cursor
          startBtn.disabled = running;  // the start button is disabled while a run is in progress
        }  // ends draw()
        let last = null;  // last is the time of the previous animation frame
        ctx.raf((ts) => {  // ctx.raf runs this function on every animation frame (about 60 times a second) while the step is open
          const dt = last == null ? 0 : Math.min(0.1, (ts - last) / 1000); last = ts;  // dt is the time since the last frame in seconds, capped at 0.1 so a paused tab does not jump ahead
          step(dt);  // advances the simulation
          if (!busy() && !closed) angle = (angle + dt * 320) % 360;  // the spinner turns only while the main thread is free, which is the visible sign of a frozen app
          draw();  // redraws everything
        });  // ends the animation-frame function
        const left = h('div', { class: 'stack', style: { gap: '10px' } },  // left column: explanation and controls
          h('p', { class: 'm0 small', html: 'By default an app gets <b>one process with one thread</b> for its code: the <span class="t">main thread</span>. It runs every component\'s callbacks, and only it may draw the screen and handle taps.' }),  // intro: one process with one main thread that runs every callback, draws and handles taps
          h('div', { class: 'xs muted b' }, 'Run the same 8-second photo resize two ways:'), seg,  // label and the switch between the two versions
          h('div', { class: 'row gap-s' }, startBtn, h('button', { class: 'btn', type: 'button', onclick: reset }, '⟲ Reset')),  // the start button and a Reset button
          h('div', { class: 'row gap-s' }, clock, fps), narr,  // the clock and redraw chips, then the narration box
          h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'A <span class="t">service</span> gets no thread of its own: its callbacks run on this main thread, so slow work in a service freezes the screen too.' }));  // common-mistake box: a service gets no thread of its own
        const right = h('div', { class: 'stack', style: { gap: '8px' } }, h('h4', { class: 'm0' }, 'What each thread is doing'), h('div', { class: 'card white tight' }, svg),  // right column: the timeline under its heading
          h('h4', { class: 'm0' }, 'The tap handler, in code'), codeBox,  // the tap handler code under its heading
          h('div', { class: 'callout why m0 small', 'data-label': 'Rule', html: 'Keep the main thread free: slow work goes to a worker. The drawing code is not safe for two threads at once, so only the main thread touches the screen.' }));  // rule box: keep the main thread free, and only the main thread touches the screen
        el.append(h('div', { class: 'thgrid' }, left, h('div', { class: 'phone-wrap' }, phone), right));  // puts the three columns on screen: explanation, phone, timeline and code
        reset();  // sets up the main-thread version first
      },  // ends render() for step 6
    },  // ends step 6

    /* ---------------- 7. Importance hierarchy + low-memory killer ---------------- */
    {  // step 7 starts here: the importance ladder and the low-memory killer
      title: 'Who gets killed first? The five importance levels',  // step 7 title
      kind: 'lab',  // kind "lab"
      core: true,  // core: true keeps this step on the shorter core path
      render(el, ctx) {  // render(): builds step 7 when the student arrives
        const { h, s } = ctx;  // h builds page elements, s builds SVG drawing elements
        if (ctx.narrow) el.classList.add('nar'); // phone layout (see css)
        const LV = [  // LV: the five importance levels, each with its name, glossary term, color, description and what the user loses if killed
          { n: 'Foreground', tt: 'Foreground process', c: 'ok', d: 'the user is interacting with it right now', lose: 'the app in the user\'s hands vanishes' },  // level 1, Foreground
          { n: 'Visible', tt: 'Visible process', c: 'proc', d: 'can be seen but is not in front (Paused)', lose: 'something the user can see disappears' },  // level 2, Visible
          { n: 'Service', tt: '', c: 'accent', d: 'runs a started service; nothing visible', lose: 'work the user asked for (a download, an upload) stops' },  // level 3, Service; it has no glossary entry of its own
          { n: 'Background', tt: 'Background process', c: 'warn', d: 'only Stopped activities; oldest use dies first', lose: 'the user barely notices: its screens are rebuilt from saved state on return' },  // level 4, Background
          { n: 'Empty', tt: 'Empty process', c: 'bad', d: 'no active components; kept only as a cache', lose: 'the user loses only a little speed at the next launch' },  // level 5, Empty
        ];  // closes LV
        const P = [  // P: the nine processes in the lab, each with its level index, memory in MB, minutes since use and descriptions
          { id: 'chat', name: 'Chat', lv: 0, mb: 450, ago: 0, used: 'using now', st: 'you are typing' },  // Chat: foreground, 450 MB, being typed in right now
          { id: 'video', name: 'Video', lv: 1, mb: 350, ago: 0, used: 'on screen', st: 'small picture-in-picture window' },  // Video: visible, 350 MB, shown in a small picture-in-picture window
          { id: 'music', name: 'Podcasts', lv: 2, mb: 200, ago: 2, used: 'started 2 min ago', st: 'episode download service running' },  // Podcasts: service level, 200 MB, running a download service started 2 minutes ago
          { id: 'backup', name: 'Cloud Backup', lv: 2, mb: 150, ago: 30, used: 'started 30 min ago', st: 'upload service running' },  // Cloud Backup: service level, 150 MB, running an upload service started 30 minutes ago
          { id: 'browser', name: 'Browser', lv: 3, mb: 400, ago: 4, used: 'used 4 min ago', st: 'activity Stopped' },  // Browser: background, 400 MB, last used 4 minutes ago
          { id: 'email', name: 'Email', lv: 3, mb: 250, ago: 25, used: 'used 25 min ago', st: 'activity Stopped' },  // Email: background, 250 MB, last used 25 minutes ago
          { id: 'game', name: 'Game', lv: 3, mb: 600, ago: 120, used: 'used 2 h ago', st: 'activity Stopped' },  // Game: background, 600 MB, last used 2 hours ago
          { id: 'calc', name: 'Calculator', lv: 4, mb: 60, ago: 60, used: 'used 1 h ago', st: 'no components' },  // Calculator: empty, 60 MB, last used an hour ago
          { id: 'weather', name: 'Weather', lv: 4, mb: 90, ago: 180, used: 'used 3 h ago', st: 'no components' },  // Weather: empty, 90 MB, last used 3 hours ago
        ];  // closes P
        const byId = Object.fromEntries(P.map((p) => [p.id, p]));  // byId: finds a process by its id
        const FREE0 = 250, TOTAL = 2800;  // 250 MB are free at the start, out of 2,800 MB for apps
        const ORDER = P.filter((p) => p.lv > 0).sort((a, b) => b.lv - a.lv || b.ago - a.ago).map((p) => p.id);   // kill order
        let mode = 'pick', killed = [], wrong = false, score = 0, need = 700;  // mode is "pick" or "slide"; killed lists the dead in order; wrong notes a miss; score counts first-try picks; need is the slider's value
        const cards = {};  // cards holds each process card and its "killed" tag
        /* ---- ladder ---- */
        const ladder = h('div', { class: 'lad' });  // ladder is the column of five level rows
        LV.forEach((lv, i) => {  // builds one row per level
          const row = h('div', { class: 'lrow', style: { '--lc': `var(--${lv.c})`, '--lcb': `var(--${lv.c}-bg)` } },  // the row, with its stripe and tint in the level's color
            h('div', { class: 'lhead' }, h('b', { html: `${i + 1} · ` + (lv.tt ? `<span class="t" data-t="${lv.tt}">${lv.n}</span>` : lv.n) }), h('span', { class: 'xs muted' }, lv.d)));  // the row's label: number and name (linked to the glossary where there is an entry) above the description
          const cell = h('div', { class: 'lcell' });  // cell holds the process cards of this level
          P.filter((p) => p.lv === i).forEach((p) => {  // goes through the processes that belong to this level
            const tag = h('span', { class: 'xs b ktag' });  // tag will say "killed 1st" and so on
            cards[p.id] = { el: h('button', { class: 'pcard', type: 'button', onclick: () => pick(p.id) }, h('b', {}, p.name), h('span', { class: 'xs' }, `${p.mb} MB · ${p.used}`), h('span', { class: 'xs muted' }, p.st), tag), tag };  // the card: name, size and last use, what it is doing, and the tag; a click sends its id to pick()
            cell.append(cards[p.id].el);  // adds the card to the row
          });  // ends the loop over processes
          row.append(cell); ladder.append(row);  // puts the cards in the row and the row in the ladder
        });  // ends the loop over levels
        /* ---- memory bar ---- */
        const W = 440, sc = W / TOTAL;  // the memory bar is 440 units wide; sc turns MB into units
        const bar = s('svg', { viewBox: `0 0 ${W + 4} 58`, width: '100%' });  // bar is the memory drawing
        const memTxt = h('div', { class: 'small' });  // memTxt is the line of numbers under the bar
        const killRow = h('div', { class: 'killrow' });  // killRow lists the kill order as chips
        const f = (n) => n.toLocaleString('en-US');  // f(n): writes a number with thousands separators, such as 2,800
        function drawBar() {  // drawBar(): redraws the memory bar, the numbers and the kill order
          let x = 2; const kids = [];  // x is where the next block starts; kids collects the shapes
          P.forEach((p) => {  // one block per process, left to right from most to least important
            const w = p.mb * sc, dead = killed.includes(p.id);  // the block's width comes from its size; dead is true if it was killed
            kids.push(s('rect', { x, y: 8, width: w, height: 30, class: dead ? 's-panel' : 's-' + LV[p.lv].c, 'stroke-width': 1.2, 'stroke-dasharray': dead ? '3 3' : null }));  // a killed process's block becomes a grey dashed gap; a living one keeps its level color
            x += w;  // moves along to where the next block starts
          });  // ends the loop over processes
          kids.push(s('rect', { x, y: 8, width: W + 2 - x, height: 30, class: 's-panel', 'stroke-width': 1.2, 'stroke-dasharray': '3 3' }));  // the remaining space at the right end is free memory, drawn dashed
          const freeNow = FREE0 + killed.reduce((a, id) => a + byId[id].mb, 0);  // freeNow is the starting free memory plus everything killed so far
          if (mode === 'slide') {  // in slider mode, also show how much the new app needs
            const nw = Math.min(W, need * sc);  // nw is the need's width, never wider than the bar
            kids.push(s('rect', { x: W + 2 - nw, y: 3, width: nw, height: 40, rx: 4, fill: 'none', style: 'stroke:var(--ink)', 'stroke-width': 2.5 }),  // a dark outline measured from the right end, with the need written under it...
              s('text', { x: W + 2, y: 56, 'text-anchor': 'end', 'font-size': 13, 'font-weight': 800 }, `new app needs ${f(need)} MB`));  // ...as "new app needs n MB"
          } else kids.push(s('text', { x: 2, y: 56, 'font-size': 13, class: 's-sub' }, 'most important on the left · free memory at the right end'));  // in pick mode, a caption says which end is which
          bar.replaceChildren(...kids);  // puts the new shapes on screen
          memTxt.innerHTML = `In use <b>${f(TOTAL - freeNow)} MB</b> · free <b>${f(freeNow)} MB</b> · processes killed: <b>${killed.length}</b>`;  // the numbers line: memory in use, free, and how many processes were killed
          killRow.replaceChildren(h('span', { class: 'xs b muted' }, 'Kill order:'), ...(killed.length ? killed.map((id, k) => h('span', { class: 'chip ' + LV[byId[id].lv].c }, `${k + 1}. ${byId[id].name}`)) : [h('span', { class: 'xs muted' }, 'nobody yet')]));  // the kill-order chips in their level colors, or "nobody yet"
        }  // ends drawBar()
        /* ---- right panel ---- */
        const fb = h('div', { class: 'callout m0 small' });  // fb is the feedback box
        const scoreChip = h('span', { class: 'chip ok' });  // scoreChip counts first-try picks
        const slider = ctx.ui.slider({ label: 'New app needs', min: 0, max: 2350, step: 50, value: need, format: (v) => f(v) + ' MB', onInput: (v) => { need = v; applyNeed(); } });  // the slider for how much memory the new app needs, 0 to 2,350 MB; moving it re-runs the killer
        const pickBox = h('div', { class: 'row gap-s' }, scoreChip, h('button', { class: 'btn sm', type: 'button', onclick: () => resetAll() }, '⟲ Start over'));  // pickBox holds the score and the Start over button, shown in pick mode
        const slideBox = h('div', {}, slider);  // slideBox holds the slider, shown in slider mode
        const say = (cls, label, html) => { fb.className = 'callout m0 small fade-in ' + cls; fb.dataset.label = label; fb.innerHTML = html; };  // say(cls, label, html): restyles and refills the feedback box
        function paintCards() {  // paintCards(): updates every card, the score and the bar
          P.forEach((p) => {  // goes through every process
            const c = cards[p.id], k = killed.indexOf(p.id);  // c is its card and k its place in the kill order (-1 if alive)
            c.el.classList.toggle('dead', k >= 0);  // a killed process's card is faded and struck through
            c.tag.textContent = k >= 0 ? `✗ killed ${['1st', '2nd', '3rd'][k] || (k + 1) + 'th'}` : '';  // its tag says "killed 1st", "2nd", "3rd", "4th" and so on
          });  // ends the loop over processes
          scoreChip.textContent = `${score} of ${killed.length} picked right first try`;  // updates the score chip
          drawBar();  // redraws the memory bar
        }  // ends paintCards()
        function resetAll() {  // resetAll(): starts the current mode over
          killed = []; wrong = false; score = 0;  // nobody is killed and the score is cleared
          pickBox.style.display = mode === 'pick' ? '' : 'none'; slideBox.style.display = mode === 'slide' ? '' : 'none';  // shows the controls for the current mode and hides the others
          if (mode === 'pick') say('', 'You are the low-memory killer', 'A big new app is starting and memory is short. <b>Click the process Android kills first.</b> Keep going to see the whole order.');  // pick mode: instructions to click the process Android kills first
          else applyNeed();  // slider mode: run the killer for the slider's value
          paintCards();  // redraws
        }  // ends resetAll()
        function applyNeed() {  // applyNeed(): works out which processes die for the slider's value
          killed = []; let free = FREE0;  // starts again with nobody killed and the starting free memory
          for (const id of ORDER) { if (free >= need) break; killed.push(id); free += byId[id].mb; }  // kills in importance order until enough is free
          const names = killed.map((id) => byId[id].name);  // names of the processes killed
          if (!killed.length) say('tip', 'No kill needed', `${f(need)} MB fits in the ${FREE0} MB already free, so every process survives.`);  // no kill needed: the request fits in what is already free
          else say(killed.length > 6 ? 'bad' : 'warn', `${killed.length} process${killed.length > 1 ? 'es' : ''} killed`, `Only ${FREE0} MB is free, so Android must find ${f(need - FREE0)} MB more. It kills <b>${names.join(', ')}</b>, lowest level first, freeing ${f(free - FREE0)} MB (now ${f(free)} MB free).` + (killed.length === ORDER.length ? ' Only the foreground app, Chat, is left.' : ''));  // otherwise: how much more was needed, who was killed, lowest level first, and how much is now free
          paintCards();  // redraws
        }  // ends applyNeed()
        function pick(id) {  // pick(id): runs when the student clicks a process card
          const p = byId[id];  // p is the clicked process
          if (mode === 'slide') { say('', p.name + ': ' + LV[p.lv].n.toLowerCase() + ' process', `${p.mb} MB, ${p.used}: ${p.st}. That puts it at level ${p.lv + 1} of 5. If it is killed, ${LV[p.lv].lose}.`); return; }  // slider mode: clicking only describes the process, its level, and what killing it would cost
          if (killed.includes(id)) { ctx.toast(p.name + ' is already gone.'); return; }  // a process that is already dead cannot be picked again
          const nv = ORDER.find((x) => !killed.includes(x));  // nv is the next process the killer would choose
          if (!nv) { say('bad', 'Last resort only', 'Chat is the <b>foreground</b> process: the app you are touching. Android kills it only if nothing else is left and the phone is still out of memory. Round complete; press Start over to play again.'); return; }  // none left but Chat: it is the foreground app and dies only as a last resort; the round is over
          if (id === nv) {  // the student picked the right victim
            killed.push(id); if (!wrong) score++; wrong = false;  // kills it, counts a first-try success if there was no miss, and clears the miss flag
            const left = ORDER.find((x) => !killed.includes(x));  // left is the victim after this one, if any
            say('tip', 'Correct', `<b>${p.name}</b> was the least important process left: level ${p.lv + 1} (${LV[p.lv].n.toLowerCase()}), ${p.used}. Killing it frees ${p.mb} MB, and ${LV[p.lv].lose}. ` + (left ? 'Click the next victim.' : 'Every process except the foreground app is gone.'));  // explains why this was the least important process left and what killing it costs
            if (ctx.narrow) ctx.toast(`Correct: ${p.name} killed ${['1st', '2nd', '3rd'][killed.length - 1] || killed.length + 'th'}`);  // on phones, a short pop-up confirms it, since the feedback box may be out of view
          } else {  // the student picked the wrong process
            wrong = true;  // remembers the miss
            const v = byId[nv];  // v is the process that should have been picked
            if (id === 'chat') say('bad', 'Not the foreground app', 'Chat is what the user is touching right now. Android kills it only as the very last resort.');  // picking Chat: it is what the user is touching, killed only as the very last resort
            else if (p.lv < v.lv) say('bad', 'Not yet', `${p.name} is a <b>${LV[p.lv].n.toLowerCase()}</b> process (level ${p.lv + 1}). There is still a less important <b>${LV[v.lv].n.toLowerCase()}</b> process (level ${v.lv + 1}) to kill first.`);  // picking a more important level: there is still a lower-level process to kill first
            else say('warn', 'Close', `${p.name} and ${v.name} are both <b>${LV[p.lv].n.toLowerCase()}</b> processes, but ${v.name} was ${v.used.replace(/^(used|started) /, 'last used ')}, longer ago than ${p.name}. Within a level, the least recently used goes first.`);  // same level but used more recently: within a level the least recently used goes first
            if (ctx.narrow) ctx.toast(`${fb.dataset.label}: ${p.name} is not the next to go`);  // on phones, a short pop-up repeats the verdict
          }  // ends the wrong-pick case
          paintCards();  // updates the cards, the score and the bar
        }  // ends pick()
        const seg = ctx.ui.seg([{ value: 'pick', label: 'You pick the victim' }, { value: 'slide', label: 'Memory pressure slider' }], mode, (v) => { mode = v; resetAll(); });  // the switch between "You pick the victim" and "Memory pressure slider"; changing it restarts the mode
        const right = h('div', { class: 'stack', style: { gap: '10px' } }, seg,  // right column: the mode switch first
          h('div', { class: 'card white tight stack', style: { gap: '4px' } }, h('h4', { class: 'm0' }, 'Memory for apps: 2,800 MB'), bar, memTxt, killRow),  // white card with the memory heading, the bar, the numbers line and the kill order
          pickBox, slideBox, fb,  // the score and Start over controls, the slider, and the feedback box
          h('div', { class: 'callout why m0 small', 'data-label': 'The rule', html: 'Android\'s <b>low-memory killer</b> works from the <b>lowest level</b> up and, within a level, kills the <b>least recently used</b> process first. It stops as soon as enough memory is free. The lower the level, the less the user loses.' }));  // rule box: lowest level first, least recently used first within a level, stop once enough is free
        el.append(h('div', { class: 'split r fill' }, h('div', { class: 'stack', style: { gap: '6px', minHeight: 0 } }, h('h4', { class: 'm0', html: '<span class="t">Importance hierarchy</span> · Android kills from the bottom up' }), ladder), right));  // puts the ladder (under its heading) on the left and the controls on the right
        resetAll();  // starts in pick mode
      },  // ends render() for step 7
    },  // ends step 7

    /* ---------------- 8. Recap ---------------- */
    {  // step 8 starts here: the recap
      title: 'Recap: six ideas that explain how Android runs apps',  // step 8 title
      kind: 'recap',  // kind "recap": a review screen
      render(el, ctx) {  // render(): builds the recap when the student arrives
        const { h } = ctx;  // h builds page elements
        const cards = [  // cards: six flip cards, each [front question, back answer], written as HTML
          ['<div>Four kinds of<br>app component</div>',  // card front: the four kinds of app component
            '<div><b>Activity</b>: one screen. <b>Service</b>: long work, no screen. <b>Content provider</b>: a shared doorway to stored data. <b>Broadcast receiver</b>: reacts briefly to an announcement. Intents start the first two and carry broadcasts.</div>'],  // card back: what each component does, and that intents start two of them and carry broadcasts
          ['<div>What does one app get<br>from Android by default?</div>',  // card front: what one app gets by default
            '<div>One Linux process with its own user ID and its own copy of the virtual machine: the <b>sandbox</b>. Every component of the app lives in it, and Android can kill the whole process to free memory.</div>'],  // card back: one process with its own user ID and virtual machine, the sandbox
          ['<div>The seven callbacks<br>and when they fire</div>',  // card front: the seven callbacks
            '<div><code>onCreate</code> → <code>onStart</code> → <code>onResume</code> on the way in; <code>onPause</code> → <code>onStop</code> → <code>onDestroy</code> on the way out; <code>onRestart</code> when a Stopped activity comes back (then onStart, onResume).</div>'],  // card back: three on the way in, three on the way out, and onRestart for coming back
          ['<div>Three nested lifetimes<br>and three states</div>',  // card front: the three lifetimes and three states
            '<div><b>Entire</b>: onCreate to onDestroy. <b>Visible</b>: onStart to onStop. <b>Foreground</b>: onResume to onPause. Inside the foreground an activity is <b>Resumed</b>; seen but unfocused it is <b>Paused</b>; hidden it is <b>Stopped</b>.</div>'],  // card back: which callbacks bound each lifetime, and Resumed, Paused and Stopped
          ['<div>One main thread:<br>what goes wrong?</div>',  // card front: what goes wrong with one main thread
            '<div>It draws the screen, handles every tap and runs every callback, even a service\'s. Block it and the app freezes; about 5 s of ignored input brings the <b>ANR</b> dialog. Slow work goes to a worker thread.</div>'],  // card back: a blocked main thread freezes the app and brings the ANR dialog; use a worker
          ['<div>Memory is short:<br>who dies first?</div>',  // card front: who dies first when memory is short
            '<div><b>Empty</b>, then <b>background</b> (least recently used first), then <b>service</b>, then <b>visible</b>; <b>foreground</b> only as a last resort. No callback runs on a kill, so save state in onPause or onStop.</div>'],  // card back: the kill order by level, and why state must be saved before a kill
        ];  // closes cards
        const flipped = new Set();  // flipped records which cards the student has turned over
        const count = h('span', { class: 'chip accent' });  // count is the chip that shows how many cards have been flipped
        const upd = () => { count.textContent = `flipped ${flipped.size}/6`; };  // upd(): refreshes the "flipped n/6" chip
        const grid = ctx.ui.flipcards(cards, { cols: 3, height: 168 });  // builds the grid of flip cards, three across, 168 pixels tall
        Array.from(grid.children).forEach((c, i) => c.addEventListener('click', () => { flipped.add(i); upd(); }));  // a click on any card records it as flipped and updates the counter
        const chain = [  // chain: the story strip of an app's life, each step as [color, headline, detail]
          ['proc', 'Tap the icon', 'an intent asks for the app'],  // story step: tapping the icon sends an intent
          ['proc', 'New process', 'one VM, one main thread'],  // story step: a new process with one virtual machine and one main thread
          ['ok', 'onCreate · onStart · onResume', 'Resumed: you use it'],  // story step: the three callbacks on the way in; the user now uses it
          ['warn', 'Home: onPause · onStop', 'Stopped; save state now'],  // story step: Home brings onPause and onStop; state should be saved now
          ['intr', 'Low memory: killed', 'no callback runs'],  // story step: memory runs low and the process is killed without a callback
          ['os', 'You return', 'new process, onCreate with saved state'],  // story step: returning starts a new process and onCreate gets the saved state
        ];  // closes chain
        if (ctx.narrow) el.classList.add('nar'); // phone layout (see css)
        const strip = h('div', { class: 'row nw chain', style: { gap: '6px', alignItems: 'stretch' } });  // strip is the row of story boxes; on phones the CSS turns it into a column
        chain.forEach(([c, a, b], i) => {  // builds each story box
          if (i) strip.append(h('span', { class: 'muted b', style: { alignSelf: 'center' } }, '→'));  // puts an arrow between boxes (before every box except the first)
          strip.append(h('div', { class: 'box ' + (c === 'ok' || c === 'warn' ? '' : c), style: { flex: '1 1 0', minWidth: 0, padding: '6px 8px', borderColor: `var(--${c})`, background: `var(--${c}-bg)` } },  // the box, bordered and tinted in its color by inline style; the color class is added too, except for ok and warn
            h('div', { class: 'small b', style: { lineHeight: 1.25 } }, a), h('div', { class: 'xs muted', style: { fontWeight: 500, lineHeight: 1.3 } }, b)));  // the headline in bold, and the detail in small grey text
        });  // ends the loop over story steps
        el.append(h('div', { class: 'stack fill', style: { gap: '12px' } },  // puts the recap on screen as one column
          h('div', { class: 'row', style: { justifyContent: 'space-between' } },  // top row of the recap
            h('p', { class: 'lead m0' }, 'Say each answer out loud first, then click the card to check yourself.'), count),  // the instruction to answer aloud first, with the flip counter beside it
          grid,  // the grid of flip cards
          h('h4', { class: 'm0 mt' }, 'The whole section in one story: an app\'s life on a busy phone'),  // heading for the story strip
          strip));  // the story strip; closes the column
        upd();  // shows "flipped 0/6" to begin with
      },  // ends render() for step 8
    },  // ends step 8

    /* ---------------- 9. Quiz ---------------- */
    {  // step 9 starts here: the end-of-section quiz
      title: 'Check yourself',  // step 9 title
      kind: 'check',  // kind "check": the guide's quiz engine builds this screen from the questions below
      quiz: [  // quiz: the questions; each has a type (multiple choice if none is given), the answer and an explanation
        { q: 'A podcast app must keep playing an episode after the user switches to the web browser. Which kind of Android component should do the playing?',  // question 1 (multiple choice): which component keeps a podcast playing in the background
          choices: ['An activity', 'A service', 'A broadcast receiver', 'A content provider'], answer: 1,  // choices; the answer is index 1, a service
          feedback: ['An activity is a screen. Once the user switches to the browser, the podcast screen is Stopped and should do no work, so playback does not belong there.', null, 'A broadcast receiver reacts briefly to an announcement and then finishes. It cannot keep playing audio for many minutes.', 'A content provider shares stored data with other apps. It does not carry out long-running work.'],  // feedback for each wrong choice (null marks the right one)
          why: 'Long-running work that needs no screen and must keep going when the user moves to another app is exactly the job of a service.' },  // explanation: long work with no screen that outlives an app switch is a service's job
        { type: 'match', q: 'Match each Android component to its job.',  // question 2 (match): each component to its job
          pairs: [['Activity', 'One screen the user sees and touches'], ['Service', 'Long-running work with no user interface'], ['Content provider', 'A standard doorway through which apps read or change a set of stored data'], ['Broadcast receiver', 'Wakes up briefly when an event such as "battery low" is announced']],  // the four component and job pairs
          why: 'Screens are activities, background jobs are services, shared data goes through a content provider, and reactions to system-wide announcements are handled by broadcast receivers.' },  // explanation of the four jobs
        { type: 'multi', q: 'Which statements about how Android runs an app are true <b>by default</b>? Select all that apply.',  // question 3 (select all that apply): what is true by default when Android runs an app
          choices: ['Each app runs in its own Linux process, under its own user ID', 'Each app has its own instance of the virtual machine', 'The lifecycle callbacks of an app\'s activities, services and broadcast receivers all run on one main thread unless the app creates more threads', 'A service automatically gets a worker thread of its own', 'Every activity of an app gets a separate process', 'Content providers are started by intents, just like activities'],  // choices, including three traps about services, activities and content providers
          answer: [0, 1, 2],  // the right choices are indexes 0, 1 and 2
          why: 'The default is one process, one virtual-machine instance and one main thread per app, shared by all its components. A service runs on that main thread unless the app starts a worker, and a content provider is reached by a query, not an intent.' },  // explanation: one process, one virtual machine and one main thread per app
        { type: 'order', q: 'The user launches an activity, uses it, then presses Back to leave it for good. Put the callbacks in the order Android calls them.',  // question 4 (put in order): the callbacks from launch to leaving for good
          items: ['onCreate()', 'onStart()', 'onResume()', 'onPause()', 'onStop()', 'onDestroy()'],  // the six callbacks, listed here in the correct order (the quiz shuffles them)
          why: 'On the way in, the activity is created, becomes visible, then comes to the front. Leaving for good reverses the path: it loses the focus, becomes hidden, then is destroyed.' },  // explanation: in through create, start, resume; out through pause, stop, destroy
        { type: 'match', q: 'Match each lifetime of an activity to the pair of callbacks that begins and ends it.',  // question 5 (match): each lifetime to the callbacks that begin and end it
          pairs: [['Entire lifetime', 'onCreate() … onDestroy()'], ['Visible lifetime', 'onStart() … onStop()'], ['Foreground lifetime', 'onResume() … onPause()']],  // the three lifetime pairs
          why: 'The three lifetimes are nested: the foreground lifetime sits inside the visible lifetime, which sits inside the entire lifetime.' },  // explanation: the three lifetimes are nested
        { type: 'bucket', q: 'Which state is activity X in, in each situation?', buckets: ['Resumed', 'Paused', 'Stopped'],  // question 6 (sort into groups): which state activity X is in for each situation
          items: [['The user is typing a message into X', 0], ['The user just came back to X and its onResume() has finished', 0], ['A system "Allow access to the microphone?" permission window (a separate activity) covers part of X', 1], ['The user tapped Home; X\'s onPause() has run but onStop() has not yet been called', 1], ['The user pressed Home and X can no longer be seen at all', 2], ['X opened a second full-screen activity, which now completely covers X', 2]],  // six situations, each with the index of its state
          why: 'Resumed means in front with the user\'s focus. Paused means at least partly visible (or on the way out) without the focus. Stopped means completely hidden but still in memory.' },  // explanation of Resumed, Paused and Stopped
        { q: 'A notes app has two activities. The user opens the note list, taps a note to open the editor, then presses Back. What happens?',  // question 7 (multiple choice): what happens when Back is pressed in the editor
          choices: ['The editor is paused and stays on the back stack, and the list is created again from scratch.', 'The editor is finished and removed from the back stack, and the list, which was Stopped underneath it, restarts and resumes.', 'Both activities are destroyed and the user lands on the home screen.', 'Android kills the app\'s process to free the memory the editor was using.'],  // choices describing four possible outcomes
          answer: 1,  // the answer is index 1: the editor is finished and the list restarts
          feedback: ['Back finishes the top activity instead of keeping it. The list was only Stopped, so it still exists and is not rebuilt (unless its process had been killed in the meantime).', null, 'Back removes only the top activity. The list is still on the back stack, so the user lands on it, not on the home screen.', 'Pressing Back ends one activity; it does not kill the process. The process dies only if Android later needs its memory.'],  // feedback for each wrong choice
          why: 'The back stack holds the list with the editor on top. Back pops the editor (onPause, onStop, onDestroy) and brings the list back with onRestart, onStart and onResume.' },  // explanation: Back pops the editor and the list comes back through onRestart, onStart, onResume
        { type: 'tf', q: 'When Android kills an app\'s process to reclaim memory, it first calls onDestroy() on each of the app\'s activities, so saving the user\'s work in onDestroy() is safe.',  // question 8 (true or false): is onDestroy() safe for saving work before a kill?
          answer: false,  // the answer is false
          why: 'A low-memory kill removes the whole process at once and no callback runs at all. Work must be saved earlier, in onPause() or onStop().' },  // explanation: a low-memory kill runs no callback at all
        { q: 'An app resizes 300 photos inside a button\'s tap handler, which runs on the main thread. The work takes 8 seconds. What does the user experience?',  // question 9 (multiple choice): what the user sees when a tap handler does 8 seconds of work
          choices: ['Nothing unusual: Android notices the slow work and moves it to a worker thread.', 'The screen freezes and ignores taps, and after about 5 seconds of unanswered input Android offers to close the app (an ANR dialog).', 'The resizing is cancelled after 5 seconds, but the app keeps running normally.', 'Android immediately kills the process because long work is forbidden in a tap handler.'],  // choices describing four possible outcomes
          answer: 1,  // the answer is index 1: the screen freezes and the ANR dialog appears
          feedback: ['Android never moves code to another thread on its own. Code runs on the thread that called it, here the main thread.', null, 'Android does not cancel the work. It shows the Application Not Responding dialog and lets the user wait or close the app.', 'Nothing is killed straight away. The app simply stops responding while its main thread is stuck.'],  // feedback for each wrong choice
          why: 'The main thread both runs the handler and draws the screen, so while it is busy nothing is redrawn and taps pile up. Slow work belongs on a worker thread, which hands its result back to the main thread.' },  // explanation: the main thread runs the handler and draws, so slow work belongs on a worker
        { type: 'order', q: 'Order these processes from MOST important (killed last) to LEAST important (killed first).',  // question 10 (put in order): five processes from most to least important
          items: ['The app the user is typing into right now', 'An app still partly visible behind a permission window that has the focus', 'An app with no screen showing that is downloading podcast episodes through a started service', 'An app whose only activity is Stopped, last used an hour ago', 'An app with no active components, kept only as a cache'],  // the five processes, one per importance level, listed here in the correct order
          why: 'The importance hierarchy is foreground, visible, service, background, empty. Android reclaims memory starting from the bottom of that list.' },  // explanation: foreground, visible, service, background, empty
        { q: 'Memory is short and Android must kill exactly one process. Which one goes first?',  // question 11 (multiple choice): which one process is killed first
          choices: ['A background process last used 3 hours ago', 'An empty process last used 10 minutes ago', 'A service process that is uploading photos', 'A background process last used 5 minutes ago'],  // choices mixing levels and how recently each was used
          answer: 1,  // the answer is index 1, the empty process
          feedback: ['Least-recently-used order only breaks ties inside one level. Background ranks above empty, so this process survives while any empty process remains.', null, 'The user would notice a stopped upload, so service processes rank above both background and empty ones.', 'This is the most recently used background process, and background ranks above empty anyway.'],  // feedback for each wrong choice
          why: 'An empty process holds no running component, so killing it costs the user nothing but a slower next launch. The level decides first; recency decides only within a level.' },  // explanation: the level decides first, recency only within a level
        { type: 'num', q: 'A phone has 300 MB free and a new app needs 1,000 MB. The other processes are: empty E1 (150 MB, used 1 h ago), empty E2 (100 MB, used 3 h ago), background B1 (400 MB, used 2 h ago), background B2 (200 MB, used 10 min ago) and service S (500 MB). Android kills in importance order and stops as soon as at least 1,000 MB is free. How many MB are free when it stops?',  // question 12 (calculate): how much memory is free when the killer stops; the answer is 1,150 MB
          answer: 1150, tol: 0, unit: 'MB',  // the answer in MB, which must match exactly
          hint: 'Lowest level first; inside a level, the least recently used goes first. Keep a running total.',  // hint shown on request: lowest level first, least recently used first, keep a running total
          why: 'Empty processes go first, oldest first: E2 (now 400 MB free), then E1 (550). Next come background processes, oldest first: B1 (950), still short, then B2 (1,150). The service process S survives.' },  // explanation: the kills in order with the running total of free memory
      ],  // closes the quiz list
    },  // ends step 9
  ],  // closes the steps list

  notes: `${/* notes: the printable summary of this section, written as HTML, shown in the Notes panel */''}
    <h3>Why Android needs its own rules</h3>${/* heading for part 1 of the notes: why Android needs its own rules */''}
    <p>A phone has far less memory than a laptop, and its user switches apps constantly. A desktop keeps a program alive until the user quits it (parking idle parts on disk if needed); Android does not wait. When a new app needs memory, Android <b>kills whole processes</b>, starting with the ones the user would miss least. This is safe because Android drives every app component through callbacks, so an app can save its state (a bookmark) before it may be killed.</p>${/* notes paragraph: phones have little memory, so Android kills whole processes, and callbacks make that safe */''}

    <h3>The four kinds of app component</h3>${/* heading for part 2 of the notes: the four kinds of component */''}
    <table>${/* starts the component table */''}
      <tr><th>Component</th><th>What it is</th><th>Activated by</th><th>Examples</th></tr>${/* table heading row: component, what it is, what activates it, examples */''}
      <tr><td><b>Activity</b></td><td>One screen the user sees and touches; most apps have several.</td><td>an intent</td><td>inbox, settings page</td></tr>${/* table row: activity */''}
      <tr><td><b>Service</b></td><td>Long-running work with no screen; keeps going after the user switches apps.</td><td>an intent</td><td>music playback, photo upload</td></tr>${/* table row: service */''}
      <tr><td><b>Content provider</b></td><td>A standard doorway (query, insert, update, delete) to app data kept in files, an SQLite database or on the web; used by the app and, with permission, by other apps.</td><td>a query to its <code>content://</code> name, not an intent</td><td>contacts, calendar events</td></tr>${/* table row: content provider, reached by a query rather than an intent */''}
      <tr><td><b>Broadcast receiver</b></td><td>Sleeps until a system-wide announcement arrives, reacts briefly, then finishes; longer follow-up work goes to a service.</td><td>a broadcast intent</td><td>battery low, screen off</td></tr>${/* table row: broadcast receiver */''}
    </table>${/* ends the component table */''}
    <p>An <b>intent</b> is a small message asking Android to activate a component. An <b>explicit</b> intent names the exact component (open the player screen); an <b>implicit</b> one describes an action and lets Android choose an app ("share this link"). Because components are started through Android rather than called directly, Android can first start the process, check permissions or pick the app.</p>${/* notes paragraph: intents, explicit and implicit, and why components are started through Android */''}
    <p><b>Choosing:</b> the user looks at it → activity; long work, no screen → service; shares stored data → content provider; reacts to an announcement → broadcast receiver.</p>${/* notes paragraph: a quick guide to choosing the right component */''}

    <h3>One app, one sandbox</h3>${/* heading for part 3 of the notes: one app, one sandbox */''}
    <ul>${/* starts the sandbox list */''}
      <li>By default each app runs in <b>its own Linux process under its own user ID</b>. This <b>application sandbox</b> stops one app reading or damaging another app's memory or files.</li>${/* list item: each app gets its own Linux process and user ID */''}
      <li>Each process runs <b>its own instance of the virtual machine</b> (Dalvik on early phones, ART today). This is a language runtime like the Java virtual machine of section 4.3, not a simulated computer with its own operating system like the virtual machines compared with containers in section 4.6. To start quickly, new app processes are forked from Zygote, a parent process that already has the runtime loaded.</li>${/* list item: each process runs its own virtual machine, forked from a warmed-up parent for speed */''}
      <li>All of an app's components share that one process (the manifest can request extra processes, but that is not the default). Android creates it when the first component is needed and, to reclaim memory, kills it with every component inside.</li>${/* list item: all components share the one process, which Android creates and kills as a whole */''}
    </ul>${/* ends the sandbox list */''}

    <h3>The activity lifecycle: seven callbacks</h3>${/* heading for part 4 of the notes: the seven callbacks */''}
    <table>${/* starts the callback table */''}
      <tr><th>Callback</th><th>Called when</th><th>A well-written app uses it to</th></tr>${/* table heading row: callback, when it is called, what a good app does there */''}
      <tr><td><code>onCreate()</code></td><td>being created: first launch, return after a kill, or rotation</td><td>build the layout, set up data, restore saved state</td></tr>${/* table row: onCreate() */''}
      <tr><td><code>onStart()</code></td><td>about to become visible</td><td>start what the screen needs while seen</td></tr>${/* table row: onStart() */''}
      <tr><td><code>onResume()</code></td><td>about to come to the front and get input</td><td>restart animations, video, camera, sensors</td></tr>${/* table row: onResume() */''}
      <tr><td><code>onPause()</code></td><td>another activity comes in front, even partly (e.g. a permission window; an ordinary in-app dialog does not count), or the user starts to leave</td><td>pause animations, release the camera; must be quick</td></tr>${/* table row: onPause() */''}
      <tr><td><code>onStop()</code></td><td>no longer visible at all</td><td>save the user's work, release what is not needed</td></tr>${/* table row: onStop() */''}
      <tr><td><code>onRestart()</code></td><td>a Stopped activity is about to be shown again</td><td>anything special on return; onStart and onResume follow</td></tr>${/* table row: onRestart() */''}
      <tr><td><code>onDestroy()</code></td><td>finishing (Back, <code>finish()</code>) or being rebuilt (rotation)</td><td>final clean-up. <b>Not guaranteed to run.</b></td></tr>${/* table row: onDestroy(), which is not guaranteed to run */''}
    </table>${/* ends the callback table */''}
    <p><b>States.</b> <b>Resumed</b> (running): in front, has the user's focus. <b>Paused</b>: at least partly visible but without focus (an activity being left also passes briefly through Paused). <b>Stopped</b>: completely hidden, still in memory with its data.</p>${/* notes paragraph: the three states Resumed, Paused and Stopped */''}
    <p><b>Three nested lifetimes.</b> <b>Entire</b>: <code>onCreate()</code> to <code>onDestroy()</code>. <b>Visible</b>: <code>onStart()</code> to <code>onStop()</code>, possibly entered many times. <b>Foreground</b>: <code>onResume()</code> to <code>onPause()</code>, entered and left very often, so its code must be light.</p>${/* notes paragraph: the three nested lifetimes */''}
    <svg viewBox="0 0 420 120" width="420" role="img" aria-label="Nested lifetimes">${/* a small drawing of the three nested lifetimes, with fixed colors because the notes can be printed */''}
      <rect x="4" y="4" width="412" height="112" rx="12" fill="#efe8ff" stroke="#7c3aed" stroke-width="2"/>${/* outer box for the entire lifetime */''}
      <text x="14" y="22" font-size="12" font-weight="700" fill="#7c3aed">Entire: onCreate … onDestroy (Stopped ring)</text>${/* label: entire lifetime, with the Stopped ring */''}
      <rect x="70" y="30" width="280" height="78" rx="10" fill="#e1eaff" stroke="#2563eb" stroke-width="2"/>${/* middle box for the visible lifetime */''}
      <text x="80" y="47" font-size="12" font-weight="700" fill="#2563eb">Visible: onStart … onStop (Paused ring)</text>${/* label: visible lifetime, with the Paused ring */''}
      <rect x="140" y="54" width="140" height="46" rx="8" fill="#dcfce7" stroke="#15803d" stroke-width="2"/>${/* inner box for the foreground lifetime */''}
      <text x="210" y="74" font-size="12" font-weight="700" fill="#15803d" text-anchor="middle">Foreground:</text>${/* label line 1: Foreground */''}
      <text x="210" y="90" font-size="12" fill="#15803d" text-anchor="middle">onResume … onPause</text>${/* label line 2: from onResume to onPause */''}
    </svg>${/* ends the drawing */''}
    <p><b>Killed for memory.</b> Android may kill a process whose activities are Stopped (or, only when desperate, Paused). <b>No callback runs</b>, not even <code>onDestroy()</code>. What survives is the small bundle of state the activity saved in <code>onSaveInstanceState()</code> as it stopped, held by Android outside the process. If the user returns, a new process starts and <code>onCreate()</code> gets that bundle, so the screen looks as it was. Common mistake: saving work only in <code>onDestroy()</code>; use <code>onPause()</code> or <code>onStop()</code>.</p>${/* notes paragraph: what happens when a process is killed for memory, and the saved-state bundle */''}

    <h3>Lifecycle traces worth knowing (activities A = list, B = editor)</h3>${/* heading for part 5 of the notes: lifecycle traces, with A as the list and B as the editor */''}
    <table>${/* starts the trace table */''}
      <tr><th>What the user does</th><th>Callbacks, in order</th></tr>${/* table heading row: what the user does, and the callbacks in order */''}
      <tr><td>Launch (no process yet)</td><td>new process; A.onCreate, A.onStart, A.onResume</td></tr>${/* trace: launching with no process yet */''}
      <tr><td>A permission window covers part of A, then closes</td><td>A.onPause only; later A.onResume</td></tr>${/* trace: a permission window covers part of A, then closes */''}
      <tr><td>A opens B full-screen</td><td>A.onPause; B.onCreate, B.onStart, B.onResume; <b>then</b> A.onStop</td></tr>${/* trace: A opens B full-screen */''}
      <tr><td>Back from B</td><td>B.onPause; A.onRestart, A.onStart, A.onResume; B.onStop, B.onDestroy</td></tr>${/* trace: Back from B */''}
      <tr><td>Home, then return</td><td>onPause, onStop; later onRestart, onStart, onResume</td></tr>${/* trace: Home, then return */''}
      <tr><td>Return after a low-memory kill</td><td>new process; onCreate (with saved state), onStart, onResume</td></tr>${/* trace: returning after a low-memory kill */''}
      <tr><td>Rotate the phone</td><td>onPause, onStop, onDestroy, then onCreate, onStart, onResume on a new instance (six)</td></tr>${/* trace: rotating the phone, six callbacks */''}
      <tr><td>Back on the last activity</td><td>onPause, onStop, onDestroy; the process stays as an <b>empty process</b>, so the next launch is a fast "warm" start (Android 12+ usually just stops it instead)</td></tr>${/* trace: Back on the last activity leaves an empty process */''}
    </table>${/* ends the trace table */''}
    <p>The <b>back stack</b> lists the activities the user has opened, newest on top. Opening B pushes it on top of A; Back finishes the top one and brings back the one underneath. Android keeps the back stack and saved state even when it kills the process.</p>${/* notes paragraph: the back stack and what survives a kill */''}

    <h3>One process, one main thread</h3>${/* heading for part 6 of the notes: one process, one main thread */''}
    <ul>${/* starts the main-thread list */''}
      <li>By default Android starts each app as <b>one process with one thread</b> for its code, the <b>main thread</b> (UI thread). It runs every component's lifecycle callbacks, draws every frame (about 60 per second) and handles every tap. (Exception: other apps' queries to a content provider run on helper threads.)</li>${/* list item: the main thread runs every callback, draws every frame and handles every tap */''}
      <li>If the main thread is stuck in slow work (resizing photos, a big query), nothing is redrawn and taps queue up. When input has waited about <b>5 seconds</b>, Android shows the <b>Application Not Responding (ANR)</b> dialog: wait, or close the app (its process is killed, unfinished work lost).</li>${/* list item: a stuck main thread freezes the screen and brings the ANR dialog after about 5 seconds */''}
      <li>The fix: do slow work on a <b>worker thread</b> the app creates and hand the result back (e.g. with <code>runOnUiThread</code>). Only the main thread may touch the screen, because the drawing code is not built for two threads at once.</li>${/* list item: the fix is a worker thread that hands its result back */''}
      <li>Common mistake: a service does <b>not</b> get its own thread; slow work in a service freezes the screen too.</li>${/* list item: a service does not get its own thread */''}
    </ul>${/* ends the main-thread list */''}
    <p><b>Example.</b> An 8-second photo resize runs in a tap handler on the main thread; the user taps Like at 1 s. At 6 s the tap has waited 5 s, so the ANR dialog appears; the tap is handled only at 8 s. With a worker thread it is handled at 1 s.</p>${/* notes worked example: the 8-second resize, with and without a worker */''}

    <h3>The importance hierarchy: who is killed first</h3>${/* heading for part 7 of the notes: the importance hierarchy */''}
    <table>${/* starts the hierarchy table */''}
      <tr><th>Level</th><th>The process holds</th><th>Example</th><th>If killed, the user loses</th></tr>${/* table heading row: level, what the process holds, example, what the user loses */''}
      <tr><td>1. Foreground</td><td>what the user is interacting with now (a Resumed activity, or a receiver handling an event)</td><td>the chat you are typing in</td><td>the app in their hands</td></tr>${/* table row: level 1, foreground */''}
      <tr><td>2. Visible</td><td>an activity that can be seen but is not in front (Paused)</td><td>an app behind a permission window; a picture-in-picture video</td><td>something on screen</td></tr>${/* table row: level 2, visible */''}
      <tr><td>3. Service</td><td>a started service, nothing visible</td><td>an episode download, a cloud upload</td><td>work they asked for</td></tr>${/* table row: level 3, service */''}
      <tr><td>4. Background</td><td>only Stopped activities</td><td>apps you switched away from</td><td>little: rebuilt from saved state</td></tr>${/* table row: level 4, background */''}
      <tr><td>5. Empty</td><td>no active components; kept only as a cache</td><td>an app you left with Back</td><td>a little launch speed</td></tr>${/* table row: level 5, empty */''}
    </table>${/* ends the hierarchy table */''}
    <p>A service the user is plainly aware of (music playing with a notification shown) is promoted to the visible level.</p>${/* notes paragraph: a service the user is aware of counts as visible */''}
    <p><b>Rules</b> (applied by Android's <b>low-memory killer</b>): kill from the lowest level upward; within a level, kill the <b>least recently used</b> process first; stop as soon as enough memory is free. Level always beats recency: an empty process used 10 minutes ago dies before a background process unused for hours.</p>${/* notes paragraph: the low-memory killer's rules, and why level beats recency */''}
    <p><b>Worked example.</b> 250 MB free; a new app needs 700 MB. Kill Weather (empty, used 3 h ago, 90 MB): 340 MB free. Kill Calculator (empty, 1 h, 60 MB): 400 MB. No empties left, so kill the oldest background app, Game (2 h, 600 MB): 1,000 MB, enough. Every other process survives.</p>`,  // notes worked example: freeing 700 MB step by step; end of the notes text
});  // closes the object passed to Guide.section()
