// Comment key: a line inside backtick text ends with ${/* comment */''}, an empty-string slot that holds a comment without changing the text on screen (full note at the top of the page).
/* Section 2.11 — Android
   Original teaching material. Built step by step. */
Guide.section({  // registers this section with the guide: Guide.section receives one object describing its text, styles and steps
  id: '2.11',  // id: the section number; the guide uses it for links, saved progress and the sec-2-11 style class
  title: 'Android',  // title: the full section name shown in the step header and the chapter menu
  short: 'Android',  // short: a brief label for tight spots such as navigation chips
  summary: 'Android\'s layered stack, Binder and the HAL, Dalvik vs ART, activities, and power-saving alarms and wakelocks.',  // summary: one sentence shown on the chapter page describing what this section covers
  objectives: [  // objectives: the learning goals listed for this section, one string per goal
    'Describe what Android is, where it came from, and the range of devices it runs on today.',  // goal 1: what Android is, where it came from and what devices run it
    'Name the five layers of the Android software stack (applications, application framework, system libraries, Android runtime, Linux kernel) and say what each provides.',  // goal 2: name the five layers of the Android stack and what each provides
    'Trace a request from an app through Binder IPC, the Android system services and the hardware abstraction layer down to a Linux device driver.',  // goal 3: follow a request through Binder, system services and the HAL down to a driver
    'Compare the Dalvik virtual machine with ART, explaining just-in-time versus ahead-of-time compilation and their trade-offs.',  // goal 4: compare Dalvik and ART, just-in-time versus ahead-of-time compiling
    'Explain activities and the back stack, and how alarms and wakelocks let Android sleep to save battery without missing work.',  // goal 5: activities, the back stack, alarms and wakelocks
  ],  // closes the objectives list
  terms: [  // terms: glossary entries as [term, definition] pairs; they feed the glossary and the hover definitions
    ['Android', 'A Linux-based operating system first built for touchscreen phones and tablets and now also used in TVs, cars, watches and embedded devices. It began at a start-up, Android Inc., which Google bought in 2005.'],  // glossary entry: defines Android and where it came from
    ['Open Handset Alliance (OHA)', 'A group of phone makers, chip makers, mobile carriers and software companies, led by Google, formed in 2007 to create open standards for mobile devices. It launched Android as its shared, open-source platform.'],  // glossary entry: defines the Open Handset Alliance, the group that launched Android
    ['Application framework', 'The layer of Android that app developers program against: a set of Java/Kotlin services and classes (activity manager, window manager, content providers, notification manager and more) that give every app the same building blocks.'],  // glossary entry: defines the application framework layer that apps program against
    ['Activity manager', 'The framework service that starts and stops activities, keeps each task\'s back stack, and decides what the user sees when they switch apps or press Back.'],  // glossary entry: defines the activity manager, keeper of each task's back stack
    ['Content provider', 'A framework component through which one app shares some of its data (such as contacts or calendar events) with other apps, using a standard query interface with permission checks.'],  // glossary entry: defines a content provider, the way one app shares data with others
    ['SQLite', 'A small but complete SQL database engine that runs as a library inside the app that uses it and keeps each database in one ordinary file.'],  // glossary entry: defines SQLite, the small database engine that lives inside an app
    ['Surface manager', 'The system library that combines the drawing surfaces (windows) of every visible app, the status bar and the keyboard into the one image shown on the display.'],  // glossary entry: defines the surface manager, which combines every window into one image
    ['Bionic libc', 'Android\'s own standard C library (functions such as malloc, printf and open). It is smaller and quicker to load than the GNU C library used on desktop Linux.'],  // glossary entry: defines Bionic libc, Android's own small standard C library
    ['Dalvik virtual machine', 'Android\'s original virtual machine for app code. It ran .dex bytecode by interpreting it and, from 2010, compiling busy parts just in time. ART replaced it in Android 5.0 (2014).'],  // glossary entry: defines the Dalvik virtual machine, Android's original app runtime
    ['Dalvik executable (.dex)', 'The compact bytecode format Android apps ship in. Build tools convert compiled Java or Kotlin classes into .dex files, which both Dalvik and ART can run.'],  // glossary entry: defines the .dex bytecode format that apps ship in
    ['Android runtime (ART)', 'The runtime that replaced Dalvik. It turns an app\'s .dex bytecode into native machine code: at first all of it at install time; since Android 7.0, by JIT while the app runs plus ahead-of-time compiling of its most-used code while the phone is idle.'],  // glossary entry: defines ART, the runtime that replaced Dalvik
    ['Just-in-time compilation (JIT)', 'Translating bytecode into machine code while the program runs, usually only for the parts that run often. Unless the results are saved, the same work is redone every time the program runs.'],  // glossary entry: defines just-in-time compilation (translating while the program runs)
    ['Ahead-of-time compilation (AOT)', 'Translating bytecode into machine code before the program runs (on Android, when the app is installed or while the phone is idle), so no translation is needed when it launches.'],  // glossary entry: defines ahead-of-time compilation (translating before the program runs)
    ['Binder (Binder IPC)', 'Android\'s main interprocess communication mechanism: a Linux kernel driver plus libraries that let code in one process call a method on an object in another process as if it were a local call, with the caller\'s identity attached.'],  // glossary entry: defines Binder, Android's main way for processes to call each other
    ['Android system services', 'Long-running Android processes that own the device\'s shared resources, mainly the system server (activity, window, power, location and other managers) and the media server (camera, audio, video). Apps reach them through Binder.'],  // glossary entry: defines the Android system services that own shared resources
    ['Android HAL', 'Android\'s hardware abstraction layer: standard interfaces (camera, audio, GPS, sensors and more) that each hardware vendor implements for its own chips, so the layers above never depend on which parts are inside a device. Unlike the Windows HAL (section 2.7), which hides a platform\'s wiring inside the kernel, it sits above the kernel\'s drivers.'],  // glossary entry: defines the Android HAL and how it differs from the Windows HAL
    ['Activity', 'One screen of an Android app with a single focused job, such as an inbox list or a compose-message screen. An app is usually made of several activities.'],  // glossary entry: defines an activity, one focused screen of an app
    ['Back stack', 'The last-in, first-out list of activities the user has opened in one task. Starting an activity pushes it on top; pressing Back removes the top one and shows the one beneath.'],  // glossary entry: defines the back stack of opened activities
    ['Wakelock (wake lock)', 'A request by an app to keep the device from going to sleep. While any wakelock is held the processor (and, for some types, the screen) stays on; the device may sleep only when none is held.'],  // glossary entry: defines a wakelock, an app's request to keep the device awake
    ['Alarm (AlarmManager)', 'An Android addition to the Linux kernel that lets an app schedule work for a set time; apps request one through the AlarmManager class. The kernel programs a hardware timer that keeps running during sleep, so an alarm can wake a sleeping device.'],  // glossary entry: defines an alarm, scheduled work that can wake a sleeping device
  ],  // closes the terms list

  css: ` /* css: style rules for this section only; the guide adds them to the page once when the section registers */
    /* shell workaround: in narrow mode the nowrap eyebrow otherwise sets the canvas min-width and the page scrolls sideways */
    .sec-2-11 .step-eyebrow { contain: inline-size; } /* stops the long one-line header text from forcing the page wider than a phone-width screen */
    .sec-2-11 .hot { cursor: pointer; outline: none; } /* .hot marks clickable parts of a drawing: show a pointing-hand cursor and hide the default focus outline */
    .sec-2-11 .hot .fr { transition: stroke-width .15s, opacity .2s; } /* animates the frame (.fr) of a clickable drawing part so its border thickens smoothly instead of jumping */
    .sec-2-11 .hot:hover .fr, .sec-2-11 .hot:focus-visible .fr { stroke-width: 3.5; } /* thickens a clickable part's frame when the mouse is over it or the keyboard has moved focus to it */
    .sec-2-11 .hot.sel .fr { stroke-width: 4; } /* the currently selected part keeps an even thicker frame so the student sees what is open */
    .sec-2-11 .info { display: flex; flex-direction: column; gap: 8px; } /* .info is the details panel beside a drawing: its heading, chips and text stack in a column */
    .sec-2-11 .info h3 { margin: 0; } /* removes the default space above the details panel's heading */
    .sec-2-11 .info p { font-size: 15.5px; line-height: 1.45; margin: 0; } /* sets comfortable reading size and line spacing for the details panel's paragraphs */
    .sec-2-11 .eg { font-size: 14.5px; line-height: 1.4; padding: 7px 11px; border-radius: 10px; background: var(--panel-3); border-left: 4px solid var(--chc); } /* .eg is the "Example" box: small text on a tinted strip with a bar in the chapter colour on its left */
    .sec-2-11 .eg b { color: var(--chc); } /* the word "Example:" inside that box is shown in the chapter colour */
    .sec-2-11 .ms-strip { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; } /* .ms-strip lays the history milestones out as five equal columns on the first step */
    .sec-2-11 .ms { display: flex; flex-direction: column; gap: 2px; padding: 7px 8px; border-radius: 10px; background: var(--panel-2); border: 1px solid var(--line); border-top: 4px solid var(--chc); } /* one milestone card: year above text, with a coloured bar across the top */
    .sec-2-11 .ms b { font-size: 15px; color: var(--chc); } /* a milestone's year: slightly larger and in the chapter colour */
    .sec-2-11 .ms span { font-size: 13px; line-height: 1.3; color: var(--ink-2); } /* a milestone's description: smaller grey text so the year stands out */
    .sec-2-11 .laygrid { display: grid; grid-template-columns: minmax(0, 7fr) minmax(0, 5fr); grid-template-rows: repeat(4, minmax(0, 1fr)); gap: 10px; height: 100%; } /* .laygrid is the stack of five layer buttons in the lab: two columns, four rows, filling the height */
    .sec-2-11 .laygrid > .lay:nth-child(1), .sec-2-11 .laygrid > .lay:nth-child(2), .sec-2-11 .laygrid > .lay:nth-child(5) { grid-column: 1 / -1; } /* the apps, framework and kernel buttons span the full width; libraries and runtime share one row */
    .sec-2-11 .lay { display: flex; flex-direction: column; gap: 6px; align-items: stretch; text-align: left; padding: 8px 12px; border-radius: 12px; border: 2px solid color-mix(in srgb, var(--lc) 45%, transparent); border-left: 6px solid var(--lc); cursor: pointer; font: inherit; color: var(--ink); min-height: 0; transition: border-color .15s, box-shadow .15s; } /* one layer button in the lab: a bordered box with a thick left bar in the layer's colour (--lc) */
    .sec-2-11 .lay:hover { border-color: var(--lc); box-shadow: 0 0 0 2px color-mix(in srgb, var(--lc) 25%, transparent); } /* hovering a layer button darkens its border and adds a soft glow so the student sees what they will pick */
    .sec-2-11 .lay.wrong { animation: sec211shake .6s; border-color: var(--bad); } /* a wrong pick shakes the layer button with a red border for a moment */
    @keyframes sec211shake { 0%, 100% { box-shadow: inset 0 0 0 0 transparent; } 20%, 60% { box-shadow: inset 0 0 0 4px var(--bad); background: var(--bad-bg); } 40%, 80% { box-shadow: inset 0 0 0 1px var(--bad); } } /* the shake animation: a red inner glow pulses in and out twice */
    .sec-2-11 .layhead { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; } /* a layer button's header row: name on the left, short note on the right */
    .sec-2-11 .layhead b { font-size: 16px; color: var(--lc); } /* the layer name in the header is bold and in that layer's colour */
    .sec-2-11 .laychips { display: flex; flex-wrap: wrap; gap: 5px; align-content: flex-start; } /* the chips inside a layer button (items already placed there) wrap onto new lines as needed */
    .sec-2-11 .laychips .chip { font-size: 12.5px; white-space: normal; } /* placed-item chips are small and allowed to wrap so long names fit */
    .sec-2-11 .itemcard { padding: 20px 20px; border-radius: 14px; background: var(--panel); border: 2px solid var(--chc); box-shadow: var(--shadow); display: flex; flex-direction: column; gap: 4px; } /* .itemcard is the big card in the lab that shows the item the student must place next */
    .sec-2-11 .iname { font-size: 28px; font-weight: 800; line-height: 1.2; letter-spacing: -.01em; } /* the item's name in that card: large and heavy so it is the first thing read */
    .sec-2-11 .fbbox { min-height: 0; } /* .fbbox holds the feedback message; min-height 0 lets it shrink inside the flexible layout */
    .sec-2-11 .fbbox .callout { font-size: 16px; line-height: 1.5; } /* feedback text in that box is larger and well spaced so the explanation is easy to read */
    .sec-2-11 .mdot { width: 14px; height: 8px; border-radius: 9px; background: var(--panel-3); display: inline-block; } /* .mdot is one small progress pill in the lab, one per item; grey means not reached yet */
    .sec-2-11 .mdot.cur { background: var(--chc); } /* the pill for the item being asked now is in the chapter colour */
    .sec-2-11 .mdot.ok { background: var(--ok); } /* a pill turns green when that item was placed right on the first try */
    .sec-2-11 .mdot.warn { background: var(--warn); } /* a pill turns amber when that item needed more than one try */
    .sec-2-11 .tok { transition: transform .55s ease; pointer-events: none; } /* .tok is the moving dot in the request animation: it glides between positions and ignores clicks */
    .sec-2-11 .pipe { display: flex; align-items: stretch; gap: 6px; } /* .pipe lays out the Dalvik/ART compile pipeline as boxes in one row separated by arrows */
    .sec-2-11 .pipe > .box { flex: 1; padding: 6px 8px; min-width: 0; display: grid; place-items: center; line-height: 1.25; } /* each pipeline box shares the row equally and centres its text */
    .sec-2-11 .pipe-arrow { display: flex; flex-direction: column; align-items: center; justify-content: center; flex: none; line-height: 1.1; } /* the arrow between pipeline boxes: a small label stacked above an arrow, never stretched */
    .sec-2-11 .box.accent { border-color: var(--accent); background: var(--accent-bg); }   /* the shell has no accent box */
    .sec-2-11 .route { gap: 3px; } /* tightens the space between chips in the request route line */
    .sec-2-11 .route .chip { padding-left: 7px; padding-right: 7px; } /* trims the side padding of route chips so the whole route fits on one line */
    .sec-2-11 .rt-tbl td, .sec-2-11 .rt-tbl th { vertical-align: middle; padding-top: 3px; padding-bottom: 3px; } /* centres table cells vertically and trims their padding in the Dalvik vs ART comparison table */
    .sec-2-11 .rt-tbl .chip { white-space: normal; line-height: 1.3; padding: 2px 8px; } /* chips inside that table may wrap onto two lines and use tighter padding */
    .sec-2-11 .rt-tbl .col-on { background: color-mix(in srgb, var(--chc) 10%, var(--panel)); } /* shades the column of the runtime the student has selected */
    .sec-2-11 .rt-tbl th.col-on { color: var(--chc); } /* the selected runtime's column heading is also in the chapter colour */
    .sec-2-11 .kpi { display: flex; flex-direction: column; padding: 5px 10px; border-radius: 10px; border: 1px solid var(--line); border-left: 5px solid var(--kc); background: var(--panel-2); } /* .kpi is one number readout card (such as launch time) with a left bar in its own colour (--kc) */
    .sec-2-11 .kpi.on { background: var(--panel); box-shadow: 0 0 0 2px var(--kc); } /* the readout for the selected runtime is highlighted with a ring in its colour */
    .sec-2-11 .kpi .kv { font-size: 24px; font-weight: 800; line-height: 1.1; font-variant-numeric: tabular-nums; } /* the big number in a readout card; tabular digits keep numbers from shifting width as they change */
    .sec-2-11 .act-grid { display: grid; grid-template-columns: minmax(0, 330px) 290px minmax(0, 1fr); gap: 22px; height: 100%; } /* .act-grid: the activities step in three columns: explanation, the phone, and the back stack */
    .sec-2-11 .phone { width: 270px; height: 520px; border: 9px solid var(--ink-2); border-radius: 30px; background: var(--panel); display: flex; flex-direction: column; overflow: hidden; box-shadow: var(--shadow); } /* .phone draws a phone outline: fixed size, thick rounded frame, with screen parts stacked inside */
    .sec-2-11 .ph-status { display: flex; justify-content: space-between; padding: 3px 14px; font-size: 12.5px; font-weight: 700; color: var(--ink-2); background: var(--panel-2); } /* the phone's status bar across the top: the time on the left, battery on the right */
    .sec-2-11 .ph-screen { flex: 1; display: flex; flex-direction: column; min-height: 0; } /* the phone screen fills the space between the status bar and the navigation buttons */
    .sec-2-11 .ph-bar { display: flex; justify-content: space-between; align-items: baseline; padding: 10px 12px; font-size: 16px; border-bottom: 1px solid var(--line); } /* the title bar at the top of each phone screen: screen name on the left, app name on the right */
    .sec-2-11 .ph-bar.home { background: var(--panel-3); color: var(--ink-2); font-weight: 700; font-size: 15px; } /* the home screen's title bar is plain grey rather than an app's colour */
    .sec-2-11 .ph-body { flex: 1; display: flex; flex-direction: column; gap: 8px; padding: 10px 12px; min-height: 0; } /* the main area of a phone screen: a column of messages, fields or photos with even gaps */
    .sec-2-11 .ph-msg { display: flex; flex-direction: column; align-items: flex-start; gap: 1px; text-align: left; padding: 8px 10px; border-radius: 10px; border: 1px solid var(--line); background: var(--panel-2); cursor: pointer; font: inherit; font-size: 14px; color: var(--ink); } /* one message button in the inbox: sender over subject, styled as a tappable card */
    .sec-2-11 .ph-msg:hover { border-color: var(--proc); } /* hovering a message outlines it in the process colour to show it can be opened */
    .sec-2-11 .ph-msg span { font-size: 13.5px; color: var(--ink-2); } /* the subject line under the sender is smaller and grey */
    .sec-2-11 .ph-field { padding: 6px 9px; border-radius: 8px; border: 1px solid var(--line); background: var(--panel-2); font-size: 13.5px; color: var(--ink-2); } /* a form field on the compose screen (To, Subject, message body) */
    .sec-2-11 .ph-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; } /* the photo picker shows its photos in a three-column grid */
    .sec-2-11 .ph-photo { aspect-ratio: 1; border-radius: 10px; border: 0; cursor: pointer; opacity: .75; } /* one photo: a square coloured tile, slightly faded until hovered */
    .sec-2-11 .ph-photo:hover { opacity: 1; outline: 3px solid var(--ink); } /* hovering a photo makes it fully bright and outlines it so the choice is clear */
    .sec-2-11 .ph-home { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; padding: 20px 14px; } /* the home screen lays the app icons out in a three-column grid */
    .sec-2-11 .ph-icon { display: flex; flex-direction: column; align-items: center; gap: 4px; border: 0; background: none; cursor: pointer; color: var(--ink); font: inherit; } /* one app icon button on the phone's home screen: the coloured square above its name, no button border */
    .sec-2-11 .ph-icon:disabled { opacity: .45; cursor: default; } /* an icon for an app with nothing to open is faded and shows no pointing-hand cursor */
    .sec-2-11 .ph-ico { width: 48px; height: 48px; border-radius: 14px; display: grid; place-items: center; color: var(--panel); font-weight: 900; font-size: 20px; } /* the coloured rounded square of an app icon, showing the app's first letter in white */
    .sec-2-11 .ph-nav { display: grid; grid-template-columns: 1fr 1fr; border-top: 1px solid var(--line); background: var(--panel-2); } /* the phone's bottom navigation bar: two equal buttons, Back and Home */
    .sec-2-11 .ph-navb { border: 0; background: none; padding: 9px 0; font: inherit; font-size: 15px; font-weight: 700; color: var(--ink-2); cursor: pointer; } /* one navigation button: plain bold text that spans its half of the bar */
    .sec-2-11 .ph-navb:hover { color: var(--accent); background: var(--panel-3); } /* hovering a navigation button tints it so the student sees it is pressable */
    .sec-2-11 .bs-stack { display: flex; flex-direction: column; gap: 6px; } /* .bs-stack is the back stack drawing beside the phone: activity cards piled in a column */
    .sec-2-11 .bs-card { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 10px; border: 1.5px solid color-mix(in srgb, var(--ac) 45%, transparent); border-left: 6px solid var(--ac); background: var(--panel-2); font-size: 15px; } /* one activity card in the back stack, bordered in its app's colour (--ac) with a thick left bar */
    .sec-2-11 .bs-card.top { background: var(--acb); box-shadow: 0 0 0 2px var(--ac); } /* the top card (the activity on screen now) gets its app's tinted background and a ring */
    .sec-2-11 .bs-empty { padding: 10px; border: 2px dashed var(--line-2); border-radius: 10px; text-align: center; } /* the dashed placeholder shown when the task has no activities left */
    .sec-2-11 .bs-log { flex: 1; font-size: 13px; font-family: var(--font); } /* .bs-log is the list of recent actions under the stack; it fills the leftover height in the normal font */
    .sec-2-11 .wl-grid { display: grid; grid-template-columns: minmax(0, 412px) minmax(0, 1fr); gap: 20px; height: 100%; } /* .wl-grid: the power lab in two columns, the controls on the left and the timeline on the right */
    .sec-2-11 .wl-tbl { font-size: 13.5px; } /* .wl-tbl is the small table of wakelock types; smaller text so it fits beside the controls */
    .sec-2-11 .wl-tbl th, .sec-2-11 .wl-tbl td { padding: 3px 7px; font-size: 13.5px; } /* tightens the padding and text size of every cell in the wakelock table */
    .sec-2-11 .wl-tbl th { font-size: 12px; text-transform: none; letter-spacing: 0; } /* the wakelock table's header cells: small and without the shell's all-capitals style */
    .sec-2-11 .wl-narr { font-size: 15px; line-height: 1.45; padding: 9px 12px; border-radius: 10px; background: var(--panel-2); border: 1px solid var(--line); border-left: 5px solid var(--chc); min-height: 66px; } /* .wl-narr is the box that narrates what the phone is doing at the current moment of the power lab */
    .sec-2-11 .wl-narr b { color: var(--chc); } /* key words inside that narration are bold and in the chapter colour */
    .sec-2-11 .wl-mini { flex: none; width: 30px; height: 50px; border-radius: 7px; border: 3px solid var(--ink-2); display: grid; place-items: center; font-size: 11px; font-weight: 900; color: var(--muted); background: var(--panel-3); transition: background .2s; } /* .wl-mini is a tiny phone icon showing whether the screen is off, dimmed or fully lit */
    .sec-2-11 .wl-mini.bright { background: var(--hl); border-color: var(--warn); } /* a fully lit screen: the icon is filled with the highlight colour */
    .sec-2-11 .wl-mini.dim { background: color-mix(in srgb, var(--hl) 40%, var(--panel-3)); border-color: var(--warn); } /* a dimmed screen: the icon is filled with a paler mix of the highlight colour */
    .sec-2-11 .rc-strip { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; } /* .rc-strip is one row of the recap: a label followed by boxes joined by arrows, wrapping if needed */
    .sec-2-11 .rc-strip .box { padding: 5px 10px; font-size: 14.5px; } /* the boxes in a recap row are a little smaller than the shell's default boxes */
    .sec-2-11 .rc-lab { width: 170px; letter-spacing: .05em; } /* the label at the start of a recap row has a fixed width so every row's boxes line up */
    .sec-2-11 .rc-arr { color: var(--chc); font-weight: 900; } /* the arrows between recap boxes are bold and in the chapter colour */
    /* phone (narrow) variants: the shell only restacks .split/.grid-*, so the custom layouts opt in via a .nar class */
    .sec-2-11 .nar.act-grid, .sec-2-11 .nar.wl-grid { grid-template-columns: minmax(0, 1fr); height: auto; } /* on a phone-width screen the activities and power lab layouts become one column and grow to fit */
    .sec-2-11 .nar.pipe { flex-wrap: wrap; } /* on a phone-width screen the compile pipeline may wrap onto more lines */
    .sec-2-11 .nar.ms-strip { grid-template-columns: repeat(3, minmax(0, 1fr)); } /* on a phone-width screen the milestones use three columns instead of five */
    .sec-2-11 .nar.pipe > .box { flex: 1 1 38%; } /* on a phone-width screen two pipeline boxes fit per line */
    .sec-2-11 .nar.laygrid { height: auto; grid-template-rows: none; grid-auto-rows: minmax(84px, auto); } /* on a phone-width screen the lab's layer buttons stack in rows at least 84px tall instead of filling the height */
  `,  // end of the css text for this section

  steps: [  // steps: the list of screens in this section, shown one at a time as the student presses Next
    /* ---------------- 1. Big picture: what Android is, where it came from, where it runs ---------------- */
    {  // step 1 begins: the big picture of what Android is and where it runs
      title: 'A Linux kernel in billions of pockets',  // step title shown in the header
      kind: 'story',  // kind "story": the header labels this step "Big Picture", an opening overview
      render(el, ctx) {  // render(el, ctx): runs each time this step is shown; el is the empty step area, ctx carries the guide's helpers
        const { h, s } = ctx;  // h builds ordinary page elements and s builds SVG (the browser's drawing format) elements
        const DEV = [  // DEV: the six kinds of device the student can click, each with its name, edition and description
          { id: 'phone', name: 'Phones', ed: 'Android',  // device "phone": its name and the edition of Android it runs
            what: 'Where Android started. A phone has a touch screen, a cellular radio, cameras, GPS and a small battery, and it runs apps from thousands of different developers. Almost every idea in this section, from sandboxed apps to aggressive sleeping, comes from these constraints.',  // what the phone card says: where Android started and why a phone shapes the whole design
            diff: 'Touch input, telephony and the tightest battery budget.' },  // what changes on a phone: touch, calls and a tight battery budget
          { id: 'tablet', name: 'Tablets', ed: 'Android',  // device "tablet": runs the same Android as a phone
            what: 'The same operating system as a phone on a bigger screen. Apps adapt because the framework\'s resource manager hands them a wider layout when the screen is larger, so one app can serve both devices.',  // what the tablet card says: apps adapt because the framework hands them a wider layout
            diff: 'Larger layouts chosen automatically; often no cellular radio.' },  // what changes on a tablet: bigger layouts, often no cellular radio
          { id: 'tv', name: 'TVs', ed: 'Android TV / Google TV',  // device "tv": Android TV or Google TV
            what: 'Television sets and streaming boxes run Android with a "lean-back" interface you drive with a remote control instead of your finger. Video playback leans heavily on the media framework and on hardware video decoders.',  // what the TV card says: a remote-controlled interface that leans on hardware video decoding
            diff: 'Remote-control input, big-screen interface, plugged into the wall.' },  // what changes on a TV: remote input, big screen, mains power
          { id: 'car', name: 'Cars', ed: 'Android Automotive',  // device "car": Android Automotive
            what: 'Android Automotive runs directly on a car\'s dashboard computer for maps, music and climate controls. Car makers add hardware modules for vehicle parts, such as speed sensors and air conditioning, behind the same kind of hardware abstraction layer phones use.',  // what the car card says: it runs on the dashboard computer with extra vehicle hardware interfaces
            diff: 'Extra hardware interfaces for the vehicle; driving-safe interface rules.' },  // what changes in a car: vehicle hardware interfaces and driving-safe rules
          { id: 'watch', name: 'Watches', ed: 'Wear OS',  // device "watch": Wear OS
            what: 'Wear OS is a version of Android tuned for tiny screens and even tinier batteries. The power-saving features you meet in step 7 matter even more on a device whose battery is a small fraction of a phone\'s, yet must still last all day.',  // what the watch card says: power saving matters even more on a tiny battery
            diff: 'Very small screen and battery; mostly glanceable screens.' },  // what changes on a watch: very small screen and battery
          { id: 'iot', name: 'Embedded', ed: 'kiosks, IoT and more',  // device "iot": kiosks and other embedded gadgets
            what: 'Payment terminals, kiosks, smart displays, fitness machines and other embedded or Internet-of-Things gadgets often run Android because it is open source and already comes with drivers, a touch interface toolkit and a huge pool of developers.',  // what the embedded card says: makers choose Android because it is open and ready-made
            diff: 'One dedicated job; the maker controls every app on it.' },  // what changes on embedded devices: one dedicated job, maker-controlled apps
        ];  // closes the DEV list
        let cur = 0;  // cur is the index of the device currently selected; the phone is shown first
        const icon = (id, cx, cy) => {  // icon(id, cx, cy): returns the SVG shapes that draw a small picture of one device centred at (cx, cy)
          const c = 's-io';  // every device outline uses the I/O colour class so the pictures match
          if (id === 'phone') return [s('rect', { x: cx - 15, y: cy - 27, width: 30, height: 54, rx: 6, class: c, 'stroke-width': 2.5 }), s('circle', { cx, cy: cy + 20, r: 2.5, class: 's-line' })];  // phone picture: a tall rounded rectangle with a small home-button dot
          if (id === 'tablet') return [s('rect', { x: cx - 26, y: cy - 30, width: 52, height: 60, rx: 7, class: c, 'stroke-width': 2.5 }), s('circle', { cx, cy: cy + 24, r: 2.5, class: 's-line' })];  // tablet picture: a wider rounded rectangle with a home-button dot
          if (id === 'tv') return [s('rect', { x: cx - 34, y: cy - 24, width: 68, height: 40, rx: 4, class: c, 'stroke-width': 2.5 }), s('path', { d: `M${cx - 12} ${cy + 28} L${cx + 12} ${cy + 28} M${cx} ${cy + 16} L${cx} ${cy + 28}`, class: 's-line' })];  // TV picture: a wide screen on a short stand
          if (id === 'car') return [s('path', { d: `M${cx - 36} ${cy + 12} L${cx - 36} ${cy - 2} L${cx - 22} ${cy - 4} L${cx - 12} ${cy - 18} L${cx + 14} ${cy - 18} L${cx + 24} ${cy - 4} L${cx + 36} ${cy - 1} L${cx + 36} ${cy + 12} Z`, class: c, 'stroke-width': 2.5, 'stroke-linejoin': 'round' }),  // car picture: the body outline drawn as one closed path of straight segments
            s('circle', { cx: cx - 20, cy: cy + 13, r: 7, class: 's-panel', 'stroke-width': 2.5 }), s('circle', { cx: cx + 20, cy: cy + 13, r: 7, class: 's-panel', 'stroke-width': 2.5 })];  // the car's two wheels as circles
          if (id === 'watch') return [s('rect', { x: cx - 9, y: cy - 30, width: 18, height: 60, rx: 5, class: 's-panel', 'stroke-width': 2 }), s('circle', { cx, cy, r: 17, class: c, 'stroke-width': 2.5 })];  // watch picture: a strap behind a round face
          return [s('rect', { x: cx - 24, y: cy - 16, width: 48, height: 36, rx: 6, class: c, 'stroke-width': 2.5 }), s('path', { d: `M${cx + 12} ${cy - 16} L${cx + 12} ${cy - 30}`, class: 's-line' }), s('circle', { cx: cx + 12, cy: cy - 31, r: 3, class: 's-line' }),  // any other id (embedded): a box with an antenna on top
            s('circle', { cx: cx - 10, cy: cy + 2, r: 3, class: 's-line' }), s('circle', { cx, cy: cy + 2, r: 3, class: 's-line' }), s('circle', { cx: cx + 10, cy: cy + 2, r: 3, class: 's-line' })];  // three dots on the embedded box's front, like buttons or lights
        };  // ends icon()
        const NW = ctx.narrow;   // phones: 3 × 2 grid of devices so the labels stay readable
        const svg = s('svg', { viewBox: NW ? '0 0 300 236' : '0 0 600 118', width: '100%' });  // the SVG drawing of the devices: one row of six, or two rows of three on a phone-width screen
        const head = h('h3', {});  // heading of the details card; filled by show()
        const what = h('p', {});  // paragraph in the details card that describes the chosen device
        const diff = h('div', { class: 'eg' });  // "What changes" example box in the details card
        function draw() {  // draw(): redraws all six device tiles, highlighting the chosen one; runs after every selection
          svg.replaceChildren(...DEV.map((d, i) => {  // replaces the drawing's contents with one clickable group per device
            const cx = 50 + (NW ? i % 3 : i) * 100, oy = NW ? Math.floor(i / 3) * 118 : 0, on = i === cur;  // works out where tile i sits (column and row) and whether it is the selected one
            return s('g', { class: 'hot' + (on ? ' sel' : ''), role: 'button', tabindex: 0, 'aria-label': d.name, onclick: () => show(i), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show(i); } } },  // each tile is a clickable group that also opens with Enter or Space, so keyboard users can choose it
              s('rect', { class: 'fr ' + (on ? 's-accent' : 's-panel'), x: cx - 46, y: 4 + oy, width: 92, height: 110, rx: 12, 'stroke-width': 2 }),  // the tile's frame, drawn in the accent colour when selected
              ...icon(d.id, cx, 46 + oy),  // the device picture inside the tile
              s('text', { x: cx, y: 102 + oy, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': on ? 800 : 650, style: on ? 'fill:var(--accent)' : '' }, d.name));  // the device name under its picture, bold and in the accent colour when selected
          }));  // ends the group for one tile and the list of tiles
        }  // ends draw()
        function show(i) {  // show(i): selects device i, fills the details card and redraws; runs when a tile is clicked
          cur = i;  // remembers which device is selected
          const d = DEV[i];  // d is the chosen device's record from DEV
          head.innerHTML = `${d.name} <span class="chip io" style="vertical-align:3px">${d.ed}</span>`;  // details heading: the device name plus a chip naming its edition of Android
          what.innerHTML = d.what;  // fills in the device description
          diff.innerHTML = '<b>What changes: </b>' + d.diff;  // fills in the "What changes" box
          draw();  // redraws the tiles so the new selection is highlighted
        }  // ends show()
        const MIL = [['2003', 'Android Inc. founded as a small start-up'], ['2005', 'Google buys Android Inc.'], ['2007', 'Announced with the Open Handset Alliance'], ['2008', 'First phone on sale; code open-sourced'], ['Today', 'Most-used mobile OS: about 7 in 10 phones']];  // MIL: the Android history milestones as [year, event] pairs for the timeline strip
        const left = h('div', { class: 'stack', style: { gap: '10px' } },  // left column of the step: the introduction text, milestones and analogy stacked with 10px gaps
          h('p', { class: 'lead m0', html: 'A phone is a small computer that must respond instantly, run apps from strangers safely, and last all day on a tiny battery.' }),  // opening paragraph: the three demands a phone places on its operating system
          h('p', { class: 'm0', html: '<span class="t">Android</span> meets those demands on most of the world\'s phones. Underneath, it runs the <b>Linux kernel</b> (section 2.10); on top, it adds its own layers for touch screens, apps and battery life. Google leads its development, but the code is open source, and the <span class="t">Open Handset Alliance</span> of phone makers, chip makers and carriers builds devices from it.' }),  // paragraph: Android runs the Linux kernel underneath and adds its own layers; the alliance builds devices
          h('div', { class: 'ms-strip' + (ctx.narrow ? ' nar' : '') }, ...MIL.map(([y, t]) => h('div', { class: 'ms' }, h('b', {}, y), h('span', {}, t)))),  // the milestone strip, one small card per year, using the phone-width layout when needed
          h('div', { class: 'callout analogy m0', 'data-label': 'Analogy', html: 'A theatre. The wiring and fire exits (the Linux kernel) serve every show. The house crew offers services any production can book: lights, sound, ushers (Android\'s framework). Each show (an app) brings its own script and cast, but must ask the crew instead of rewiring the stage.' }));  // analogy box: a theatre, where the kernel is the building and the framework is the house crew
        const right = h('div', { class: 'card white stack', style: { gap: '10px' } },  // right column of the step: a white card that will hold the device picker and its details
          h('h4', { class: 'm0' }, 'Where Android runs today: click a device'),  // small heading over the device picker telling the student to click a device
          svg,  // the device drawing built above
          h('div', { class: 'info grow' }, head, what, diff),  // details panel under the drawing; grow lets it take the spare height
          h('div', { style: { borderTop: '1px dashed var(--line-2)', paddingTop: '8px' } },  // a bottom strip, separated by a dashed line, that previews what later steps cover
            h('h4', {}, 'The same on every device, and what you will explore'),  // heading of the preview strip
            h('div', { class: 'row gap-s' },  // a wrapping row of chips, one per later step
              h('span', { class: 'chip proc' }, '2 · five-layer stack'), h('span', { class: 'chip os' }, '4 · Binder, services, HAL'),  // preview chips for step 2 (the five layers) and step 4 (Binder, services, HAL), coloured to match those steps
              h('span', { class: 'chip cpu' }, '5 · Dalvik → ART'), h('span', { class: 'chip accent' }, '6 · activities'), h('span', { class: 'chip warn' }, '7 · alarms + wakelocks'))));  // preview chips for step 5 (Dalvik to ART), step 6 (activities) and step 7 (alarms and wakelocks)
        el.append(h('div', { class: 'split fill' }, left, right));  // puts the two columns side by side (split) filling the step's height
        show(0);  // selects the phone when the step first appears, so the details card is never empty
      },  // ends render() for step 1
    },  // ends step 1

    /* ---------------- 2. The software stack: every layer and component is clickable ---------------- */
    {  // step 2 begins: the five-layer software stack, where every part can be clicked
      title: 'The classic Android software stack: click every part',  // step title shown in the header
      kind: 'explore',  // kind "explore": the header labels this step as a hands-on exploration
      core: true, // on the shorter core path
      render(el, ctx) {  // render(el, ctx): builds the clickable stack each time this step is shown
        const { h, s } = ctx;  // h builds page elements, s builds SVG drawing elements
        const COL = (c) => (c === 'lib' ? { band: 's-panel', ink: 'var(--ink-2)', bg: 'var(--panel-3)', chip: '' } : { band: 's-' + c, ink: `var(--${c})`, bg: `var(--${c}-bg)`, chip: c });  // COL(c): turns a colour name into the SVG class, text colour, background and chip class for one layer; libraries use plain grey
        const L = { apps: ['Applications', 'Java / Kotlin', 'proc'], fw: ['Application framework', 'Java / Kotlin', 'accent'], libs: ['System libraries', 'C / C++', 'lib'], rt: ['Android runtime', 'C++ / Java', 'cpu'], kernel: ['Linux kernel', 'C', 'os'] };  // L: the five layers, each as [name, language it is written in, colour name]
        const P = {  // P: every clickable part of the stack, keyed by id, with its layer, name, job description and an example
          apps: { layer: 'apps', name: 'Applications', job: 'The programs people actually use: home screen, dialer, contacts, SMS, email, calendar, maps, browser, plus everything installed from an app store. Most built-in apps are ordinary apps: you can replace the default SMS, browser or even home-screen app with one you install. Each app runs in its own Linux process under its own user ID, so apps are sandboxed (walled off) from each other.', eg: 'Maps asks the location manager where you are, then draws the map with the view system.' },  // part "apps": the applications layer, and why each app is sandboxed in its own process
          fw: { layer: 'fw', name: 'Application framework', job: 'The toolkit every app is built from: the Java/Kotlin classes and services that developers call. It is Android\'s <span class="t" data-t="API">API</span>: the set of classes and calls a program is allowed to use. Many of these managers are thin stand-ins inside the app; the real work happens in system service processes that the app reaches through Binder (step 4).', eg: 'Because every app uses the same framework, the Back button, notifications and permissions behave the same in all of them.' },  // part "fw": the application framework, Android's API that every app is built from
          am: { layer: 'fw', name: 'Activity manager', job: 'Starts, pauses and stops each app\'s screens (<span class="t">activities</span>), keeps the back stack so Back returns to the right screen, and decides which background apps can be ended when memory runs low.', eg: 'You tap an email notification: the activity manager starts the email app\'s "read message" screen on top of the stack.' },  // part "am": the activity manager, which starts screens and keeps the back stack
          wm: { layer: 'fw', name: 'Window manager', job: 'Decides which windows exist and how they are arranged: which app is in front, the status bar, dialogs, split screen, rotation. It sits on top of the surface manager library, which does the actual combining of pixels.', eg: 'You rotate the phone and every visible window is resized and re-laid out.' },  // part "wm": the window manager, which arranges windows on top of the surface manager
          cp: { layer: 'fw', name: 'Content providers', job: 'Let an app publish some of its data for other apps through one standard query interface, with permission checks, instead of letting them open its files. Contacts, calendar events and the media gallery are all shared this way.', eg: 'A chat app lists your friends by querying the Contacts provider, never the contacts database file itself.' },  // part "cp": content providers, the standard way apps share data with permission checks
          vs: { layer: 'fw', name: 'View system', job: 'The ready-made visual building blocks of every screen: buttons, text boxes, lists, grids, images, even an embedded web view. It also delivers each touch to the element under your finger.', eg: 'The "Send" button in a messaging app is a view object from this system.' },  // part "vs": the view system, the ready-made buttons, lists and other screen parts
          nm: { layer: 'fw', name: 'Notification manager', job: 'Lets any app show alerts in the status bar and notification shade (icon, text, sound, vibration), even when the app is not on screen.', eg: '"New message from Sam" appears at the top of the screen while you are playing a game.' },  // part "nm": the notification manager, alerts shown even when an app is not on screen
          pm: { layer: 'fw', name: 'Package manager', job: 'Installs, updates and removes apps, and keeps a record of every installed app: its name, version, components and the permissions it asked for. Other parts of Android consult this record.', eg: 'Installing an app from the store: the package manager unpacks it, records its permissions and has its code prepared for the runtime.' },  // part "pm": the package manager, which installs apps and records their permissions
          tm: { layer: 'fw', name: 'Telephony manager', job: 'Gives apps controlled access to the phone side of the device: call state, mobile network type, signal strength, and SIM and carrier details.', eg: 'A podcast app pauses itself when the telephony manager reports an incoming call.' },  // part "tm": the telephony manager, controlled access to calls and the mobile network
          rm: { layer: 'fw', name: 'Resource manager', job: 'Hands apps everything that is not code: text strings, images, colours and screen layouts. It picks the right version automatically for the device\'s language, screen size and orientation.', eg: 'One app shows Spanish text on a phone set to Spanish and a two-column layout on a tablet, with no code change.' },  // part "rm": the resource manager, which picks the right strings and layouts for the device
          lm: { layer: 'fw', name: 'Location manager', job: 'Tells apps where the device is, blending GPS satellites, Wi-Fi networks and cell towers, and can alert an app when the device enters or leaves an area.', eg: 'A ride-sharing app asks for a location update every few seconds while you wait for your car.' },  // part "lm": the location manager, which blends GPS, Wi-Fi and cell towers
          xmpp: { layer: 'fw', name: 'XMPP service (early Android)', job: 'XMPP (Extensible Messaging and Presence Protocol) is an open standard for instant messaging. Early Android used an XMPP-based service to keep one always-open connection to Google\'s servers, so servers could <b>push</b> messages to apps instead of every app checking for news on its own. It was removed early on and is not part of today\'s Android.', eg: 'A new-message alert arrives even though the chat app is not running. Today\'s push-notification service grew out of this idea.' },  // part "xmpp": the early push-messaging service, removed from later Android
          libs: { layer: 'libs', name: 'System libraries', job: 'Native code written in C and C++ for jobs that must be fast: graphics, media, databases, web rendering and the basic C library. Apps rarely call them directly; they reach them through the framework.', eg: 'Drawing a scrolling list at 60 frames per second relies on the surface manager and OpenGL ES libraries.' },  // part "libs": the system libraries layer of fast native C and C++ code
          surf: { layer: 'libs', name: 'Surface manager', job: 'Each app draws into its own off-screen surface. The surface manager combines the surfaces of every visible app, the status bar and the keyboard into the single image shown on the display.', eg: 'A video playing in a small floating window over your map: two surfaces, combined into one picture.' },  // part "surf": the surface manager, which combines every app's drawing into one image
          gl: { layer: 'libs', name: 'OpenGL ES', job: 'OpenGL for Embedded Systems: the standard interface for fast 2D and 3D graphics using the phone\'s graphics processor (GPU).', eg: 'A 3D racing game draws every frame through OpenGL ES (or its newer relative, Vulkan).' },  // part "gl": OpenGL ES, fast 2D and 3D graphics on the graphics processor
          media: { layer: 'libs', name: 'Media framework', job: 'Codecs and players for recording and playing audio and video, and for decoding images, in common formats such as MP3, AAC, H.264, JPEG and PNG, using hardware decoders when the chip has them.', eg: 'Your music app hands an MP3 file to the media framework, which decodes it into sound samples.' },  // part "media": the media framework, codecs for audio, video and images
          sqlite: { layer: 'libs', name: 'SQLite', job: '<span class="t">SQLite</span> is a small but complete SQL database engine that runs as a library inside the app\'s own process and stores each database in one ordinary file. No separate database server is needed.', eg: 'Your text messages and contacts are stored in SQLite databases behind their content providers.' },  // part "sqlite": SQLite, the database engine that runs inside the app's process
          webkit: { layer: 'libs', name: 'WebKit browser engine (early Android)', job: 'The engine that turns HTML, CSS and JavaScript into a laid-out page. Early Android built its browser and in-app web views on WebKit. Later versions replaced it with a web view built on Chromium, a descendant of WebKit.', eg: 'A shopping app shows its help pages inside a web view drawn by the browser engine.' },  // part "webkit": the early browser engine, later replaced by one built on Chromium
          libc: { layer: 'libs', name: 'Bionic libc', job: '<span class="t">Bionic libc</span> is Android\'s own standard C library: the functions such as malloc, printf and open that all C code needs. It was written to be small, fast to load into many processes at once, and under a permissive licence.', eg: 'Every native library above it, including SQLite and the media codecs, calls into Bionic.' },  // part "libc": Bionic, Android's small standard C library
          rt: { layer: 'rt', name: 'Android runtime', job: 'Runs the apps\' code. Apps ship as .dex <b>bytecode</b> (instructions for an imaginary, portable machine), not as machine code for a real processor, so something on the phone must turn it into instructions the processor can execute. Each app runs in its own process with its own runtime instance, so one crashing app cannot take down another.', eg: 'Step 5 compares the two runtimes Android has used: Dalvik and ART.' },  // part "rt": the Android runtime layer, which turns portable bytecode into running code
          core: { layer: 'rt', name: 'Core libraries', job: 'Most of the standard Java class library (strings, collections, files, networking, threads), so app code written in Java or Kotlin finds the classes it expects.', eg: 'An app sorts a list with the same collection classes a desktop Java program would use.' },  // part "core": the core libraries, most of the standard Java class library
          art: { layer: 'rt', name: 'ART (formerly the Dalvik VM)', job: 'The engine that executes .dex bytecode. The original <span class="t">Dalvik virtual machine</span> interpreted it and compiled busy parts just in time. Since Android 5.0, <span class="t">ART</span> compiles it to native machine code ahead of time (from 7.0 mixed with JIT).', eg: 'Install an app, and ART prepares its machine code so it starts quickly (step 5).' },  // part "art": ART, formerly the Dalvik virtual machine, which executes the bytecode
          kernel: { layer: 'kernel', name: 'Linux kernel', job: 'The foundation: the same kernel as desktop and server Linux, with some Android additions. It owns the hardware and provides drivers, memory, process and power management, networking and security. Everything above runs in user mode and must ask the kernel for these services.', eg: 'Android picked Linux for its mature drivers, strong process isolation and large developer community.' },  // part "kernel": the Linux kernel layer that owns the hardware
          drv: { layer: 'kernel', name: 'Device drivers', job: 'Kernel code that operates each piece of hardware: display, camera, Bluetooth, flash storage, USB, keypad, Wi-Fi and audio. Phone makers supply many of these for their own chips.', eg: 'The camera driver programs the image sensor when a photo is taken (step 4 follows that request).' },  // part "drv": device drivers, kernel code that operates each piece of hardware
          binder: { layer: 'kernel', name: 'Binder IPC driver', job: 'The kernel half of <span class="t">Binder</span>, Android\'s interprocess communication system. Because processes cannot read each other\'s memory, messages between an app and a system service must pass through this driver, which also stamps each message with the sender\'s identity.', eg: 'Every call from an app to a system service crosses this driver.' },  // part "binder": the Binder driver, the kernel half of Android's interprocess messaging
          pwr: { layer: 'kernel', name: 'Power management', job: 'Linux power management plus two Android additions: <b>alarms</b>, which can wake a sleeping device at a set time, and <b>wakelocks</b>, which keep it awake while important work is in progress.', eg: 'Step 7 lets you run the phone for an hour with and without a wakelock.' },  // part "pwr": power management, including Android's alarms and wakelocks
          mem: { layer: 'kernel', name: 'Memory management', job: 'Gives every process its own protected virtual memory. When memory runs short, Android ends background apps the user is least likely to miss, instead of swapping them to slow flash storage.', eg: 'An app you have not opened for hours is quietly ended to make room for the camera.' },  // part "mem": memory management, which ends background apps instead of swapping
          proc: { layer: 'kernel', name: 'Process management', job: 'Creates processes and threads and schedules them on the processor cores. Every app is a separate Linux process (section 4.7 looks inside).', eg: 'Music keeps playing while you browse because both apps\' threads get turns on the cores.' },  // part "proc": process management, one Linux process per app
          net: { layer: 'kernel', name: 'Networking', job: 'The full Linux network stack: Wi-Fi and mobile data connections, TCP/IP and sockets, shared by every app.', eg: 'The phone switches from Wi-Fi to mobile data while a download continues.' },  // part "net": networking, the Linux network stack shared by every app
          sec: { layer: 'kernel', name: 'Security', job: 'Linux user IDs and file permissions keep apps apart: each app runs as its own user, so it cannot read another app\'s private files. Extra mandatory access-control rules (SELinux) restrict even system processes.', eg: 'A game cannot read your banking app\'s data, even if both are open.' },  // part "sec": security, one Linux user per app plus SELinux rules
        };  // closes the P table of parts
        // geometry: bands [id, x, y, w, h] and tiles [id, x, y, w, h, line1, line2]
        // Wide screens get the classic side-by-side stack; phones get a taller, 3-column version so its text stays readable.
        const NW = ctx.narrow;  // NW is true on a phone-width screen; it chooses between the two drawing layouts below
        const FW = [['am', 'Activity', 'manager'], ['wm', 'Window', 'manager'], ['cp', 'Content', 'providers'], ['vs', 'View', 'system'], ['nm', 'Notification', 'manager'],  // FW: the framework tiles as [id, first line, second line] in the order they are drawn
          ['pm', 'Package', 'manager'], ['tm', 'Telephony', 'manager'], ['rm', 'Resource', 'manager'], ['lm', 'Location', 'manager'], ['xmpp', 'XMPP service', 'early Android']];  // the rest of the framework tiles, ending with the early XMPP service
        const LIBS = [['surf', 'Surface', 'manager'], ['gl', 'OpenGL ES', '3D graphics'], ['media', 'Media', 'framework'], ['sqlite', 'SQLite', 'database'], ['webkit', 'WebKit engine', 'early Android'], ['libc', 'Bionic', 'libc']];  // LIBS: the system library tiles in drawing order
        // tiles that belonged to early Android only; drawn dashed so the classic layout is not mistaken for today's
        const EARLY = new Set(['xmpp', 'webkit']);  // EARLY lists the tiles that existed only in early Android, so they are drawn dashed
        const KERN = [['pwr', 'Power', 'management'], ['mem', 'Memory', 'management'], ['proc', 'Process', 'management'], ['net', 'Networking', 'TCP/IP, Wi-Fi'], ['sec', 'Security', 'user IDs, SELinux']];  // KERN: the smaller kernel tiles along the bottom of the kernel band
        const T = [];  // T collects every tile as [id, x, y, width, height, line 1, line 2]; filled by the layout below
        let BANDS, VH, appPos;  // BANDS (the coloured layer backgrounds), VH (drawing height) and appPos (app tile positions) depend on screen width
        if (!NW) {  // wide-screen layout: the classic stack with libraries and runtime side by side
          BANDS = [['apps', 4, 4, 652, 82], ['fw', 4, 94, 652, 134], ['libs', 4, 236, 426, 134], ['rt', 438, 236, 218, 134], ['kernel', 4, 378, 652, 130]];  // the five layer bands as [id, x, y, width, height]
          VH = 534;  // the wide drawing is 534 units tall
          appPos = (i) => [12 + i * 80, 30, 74, 46];  // app tiles sit in one row of eight across the top band
          FW.forEach(([id, a, b], i) => T.push([id, 12 + (i % 5) * 129, 122 + Math.floor(i / 5) * 52, 120, 46, a, b]));  // framework tiles: two rows of five inside the framework band
          LIBS.forEach(([id, a, b], i) => T.push([id, 12 + (i % 3) * 139, 264 + Math.floor(i / 3) * 52, 130, 46, a, b]));  // library tiles: two rows of three inside the libraries band
          T.push(['core', 446, 264, 202, 46, 'Core libraries', 'Java class library']);  // the core libraries tile in the runtime band
          T.push(['art', 446, 316, 202, 46, 'ART', '(formerly Dalvik VM)']);  // the ART tile under it in the runtime band
          T.push(['drv', 12, 406, 484, 46, 'Device drivers', 'display · camera · Bluetooth · flash · USB · keypad · Wi-Fi · audio']);  // a wide device drivers tile across most of the kernel band
          T.push(['binder', 504, 406, 144, 46, 'Binder', 'IPC driver']);  // the Binder driver tile beside the drivers
          KERN.forEach(([id, a, b], i) => T.push([id, 12 + i * 129, 458, 120, 44, a, b]));  // the five small kernel tiles in a row along the bottom
        } else {  // phone-width layout: every band full width, stacked, with three columns of tiles
          const col3 = (i) => 12 + (i % 3) * 115;           // three 106-wide columns inside a 352-wide band
          BANDS = [['apps', 4, 4, 352, 114], ['fw', 4, 126, 352, 230], ['libs', 4, 364, 352, 130], ['rt', 4, 502, 352, 80], ['kernel', 4, 590, 352, 184]];  // the five layer bands, now stacked one above another
          VH = 800;  // the phone-width drawing is taller, 800 units
          appPos = (i) => [12 + (i % 4) * 86, 28 + Math.floor(i / 4) * 44, 78, 38];  // app tiles in two rows of four
          FW.forEach(([id, a, b], i) => T.push([id, col3(i), 154 + Math.floor(i / 3) * 50, 106, 44, a, b]));  // framework tiles in rows of three
          LIBS.forEach(([id, a, b], i) => T.push([id, col3(i), 392 + Math.floor(i / 3) * 50, 106, 44, a, b]));  // library tiles in rows of three
          T.push(['core', 12, 530, 164, 44, 'Core libraries', 'Java class library']);  // the core libraries tile, left half of the runtime band
          T.push(['art', 184, 530, 164, 44, 'ART', '(formerly Dalvik VM)']);  // the ART tile, right half of the runtime band
          T.push(['drv', 12, 618, 336, 46, 'Device drivers', 'display · camera · Wi-Fi · audio · USB…']);  // a full-width device drivers tile with a shorter list
          [['binder', 'Binder', 'IPC driver']].concat(KERN).forEach(([id, a, b], i) => T.push([id, col3(i), 672 + Math.floor(i / 3) * 50, 106, 44, a, b]));  // the Binder tile and the kernel tiles, in rows of three
        }  // ends the layout choice
        const APPS = ['Home', 'Phone', 'Contacts', 'SMS', 'Email', 'Calendar', 'Maps', 'Browser'];  // APPS: the names of the sample apps drawn in the top band
        const total = Object.keys(P).length;  // total is how many parts can be explored; the progress meter compares it with how many were seen
        const seen = new Set();  // seen remembers which parts the student has already opened
        let cur = null;  // cur is the id of the part open now; nothing is open at first
        const svg = s('svg', { viewBox: `0 0 ${NW ? 360 : 660} ${VH}`, width: '100%', style: { display: 'block' } });  // the SVG drawing that holds the whole stack, sized for the chosen layout
        const info = h('div', { class: 'info grow' });  // details panel beside the drawing; filled by pick()
        const meterI = h('i', { style: { width: '0%' } });  // the coloured bar inside the progress meter; its width shows the share of parts explored
        const count = h('span', { class: 'small b' });  // text beside the meter that says how many parts have been explored
        const hotAttrs = (id) => ({ class: 'hot' + (cur === id ? ' sel' : ''), role: 'button', tabindex: 0, 'aria-label': P[id].name,  // hotAttrs(id): the attributes that make a band or tile clickable and keyboard-focusable
          onclick: () => pick(id), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(id); } } });  // clicking, or pressing Enter or Space, opens that part with pick()
        function draw() {  // draw(): rebuilds the whole stack drawing; runs after every pick so highlights and ticks update
          const kids = [];  // kids collects the drawing's shapes before they are put into the SVG
          BANDS.forEach(([id, x, y, w, hh]) => {  // draws each layer band (the big coloured background of one layer) as a clickable group
            const c = COL(L[id][2]);  // c holds the colours for this band's layer
            kids.push(s('g', hotAttrs(id),  // adds the band's group, using hotAttrs so clicking the band opens that layer's description
              s('rect', { class: 'fr ' + c.band, x, y, width: w, height: hh, rx: 12, 'stroke-width': 2, style: cur === id ? '' : 'stroke-opacity:.55' }),  // the band's rectangle; its border is faded unless this layer is the one open
              s('text', { x: x + 12, y: y + 18, 'font-size': 13, 'font-weight': 800, 'letter-spacing': '.06em', style: `fill:${c.ink}` }, L[id][0].toUpperCase()),  // the layer name in capitals at the band's top-left, in the layer's colour
              id === 'rt' ? null : s('text', { x: x + w - 12, y: y + 18, 'font-size': 12.5, 'text-anchor': 'end', class: 's-sub' }, L[id][1]),  // the language the layer is written in, at the top-right (left out for the runtime band, which is too crowded)
              seen.has(id) ? s('text', { x: x + w - 12 - (id === 'rt' ? 0 : L[id][1].length * 6.4 + 10), y: y + 18, 'font-size': 13, 'text-anchor': 'end', style: 'fill:var(--ok)', 'font-weight': 900 }, '✓') : null));  // a green tick beside the name once the student has opened this layer, placed just left of the language label
          });  // ends the loop over bands
          kids.push(s('text', { x: 8, y: VH - 7, 'font-size': 13, class: 's-sub' }, NW ? 'Classic layout · dashed tiles: early Android only' : 'The classic layout Android was designed with. Dashed tiles: early Android only (later removed or replaced).'));  // a note along the bottom: the drawing shows the classic layout, and dashed tiles were early Android only
          APPS.forEach((a, i) => { const [ax, ay, aw, ah] = appPos(i); kids.push(s('g', { style: 'pointer-events:none' },  // draws the sample app tiles in the top band; they ignore clicks so a click reaches the applications band behind them
            s('rect', { x: ax, y: ay, width: aw, height: ah, rx: 9, style: 'fill:var(--panel);stroke:var(--proc)', 'stroke-width': 1.5 }),  // one app tile's white rounded rectangle, outlined in the process colour
            s('text', { x: ax + aw / 2, y: ay + ah / 2 + 5, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 650 }, a))); });  // the app's name centred in its tile
          T.forEach(([id, x, y, w, hh, a, b]) => {  // draws every component tile (framework, library, runtime and kernel parts) as a clickable group
            const c = COL(id === 'drv' ? 'io' : L[P[id].layer][2]);  // picks the tile's colours from its layer, except device drivers, which use the I/O colour
            const on = cur === id;  // on is true when this tile is the one open now
            const wide = id === 'drv';  // wide marks the long device drivers tile, whose text sits slightly higher
            kids.push(s('g', hotAttrs(id),  // adds the tile's clickable group
              s('rect', { class: 'fr', x, y, width: w, height: hh, rx: 9, 'stroke-width': 2, 'stroke-dasharray': EARLY.has(id) ? '5 4' : null, style: `fill:${on ? c.bg : 'var(--panel)'};stroke:${c.ink}` }),  // the tile's rectangle: tinted when open, white otherwise, and dashed if the part was early Android only
              s('text', { x: x + w / 2, y: y + (wide ? 19 : 20), 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 750 }, a),  // the tile's first line of text, its name
              s('text', { x: x + w / 2, y: y + (wide ? 37 : 37), 'text-anchor': 'middle', 'font-size': 13, class: EARLY.has(id) ? null : 's-sub', style: EARLY.has(id) ? 'fill:var(--warn);font-weight:700;font-style:italic' : null }, b),  // the tile's second line: grey normally, or amber italic for early-only parts
              seen.has(id) ? s('g', {}, s('circle', { cx: x + w - 3, cy: y + 3, r: 7.5, style: 'fill:var(--ok);stroke:var(--panel)', 'stroke-width': 1.5 }),  // once opened, a small green circle at the tile's corner...
                s('text', { x: x + w - 3, y: y + 7, 'text-anchor': 'middle', 'font-size': 10.5, 'font-weight': 900, style: 'fill:var(--panel)' }, '✓')) : null));  // ...with a white tick inside it
          });  // ends the loop over tiles
          svg.replaceChildren(...kids);  // swaps all the new shapes into the SVG at once
        }  // ends draw()
        function pick(id) {  // pick(id): opens one part; runs when a band or tile is clicked or chosen with the keyboard
          cur = id; seen.add(id);  // records the open part and adds it to the set of parts seen
          const p = P[id], lay = L[p.layer];  // p is the part's record and lay is its layer's [name, language, colour]
          info.innerHTML = '';  // empties the details panel before refilling it
          info.append(  // fills the details panel with...
            h('h3', { html: p.name }),  // ...the part's name as a heading
            h('div', { class: 'row gap-s' }, h('span', { class: 'chip ' + COL(lay[2]).chip }, lay[0]), h('span', { class: 'chip' }, lay[1])),  // ...chips naming its layer (in the layer colour) and the language it is written in
            h('p', { html: p.job }),  // ...the description of the part's job
            h('div', { class: 'eg', html: '<b>Example: </b>' + p.eg }));  // ...and the example box
          paint();  // updates the progress meter and redraws the stack
        }  // ends pick()
        function paint() {  // paint(): updates the "explored" meter and count, then redraws; runs after each pick and once at the start
          meterI.style.width = (seen.size / total) * 100 + '%';  // sets the meter bar's width to the share of parts seen
          count.textContent = `Explored ${seen.size} / ${total} parts`;  // updates the "Explored N / total parts" text
          draw();  // redraws the stack so ticks and highlights match
        }  // ends paint()
        info.append(h('h3', {}, 'How to read the stack'),  // what the details panel shows before any click: a heading on how to read the stack...
          h('p', { html: 'Read it from the bottom up. The <b>Linux kernel</b> owns the hardware. Above it sit fast native <b>system libraries</b> written in C/C++ and the <b>Android runtime</b> that runs app code. The <span class="t">application framework</span> packages all of that into a Java/Kotlin API, and the <b>applications</b> at the top are built only from that API.' }),  // notes paragraph: read the stack from the bottom up, from the kernel to the apps
          h('p', { html: 'Each layer uses the services of the layers beneath it and hides their details from the layers above. An app never talks to the camera chip; it asks the framework, which works its way down.' }),  // notes paragraph: each layer uses the layer below and hides its details from the layer above
          h('div', { class: 'callout tip m0', 'data-label': 'Try it', html: 'Click every tile and every layer\'s name bar. Colours: <span class="chip proc">apps</span> <span class="chip accent">framework</span> <span class="chip">libraries</span> <span class="chip cpu">runtime</span> <span class="chip os">kernel</span> <span class="chip io">drivers</span>' }));  // tip box: click every part, with a colour key for each layer
        el.append(h('div', { class: 'split r fill' },  // lays the step out in two columns, the drawing wider than the panel
          h('div', { style: { display: 'flex', alignItems: 'center' } }, svg),  // left column: the stack drawing, centred vertically
          h('div', { class: 'card white stack', style: { gap: '10px' } }, info,  // right column: a white card with the details panel...
            h('div', { style: { borderTop: '1px dashed var(--line-2)', paddingTop: '8px' } }, h('div', { class: 'row', style: { justifyContent: 'space-between', marginBottom: '4px' } }, count, h('span', { class: 'xs muted' }, 'a ✓ marks parts you have opened')), h('div', { class: 'meter' }, meterI)))));  // ...and at its bottom the progress count, a note on the ticks, and the meter bar
        paint();  // draws the meter, count and stack for the first time
      },  // ends render() for step 2
    },  // ends step 2

    /* ---------------- 3. Component matcher: click the layer each part lives in ---------------- */
    {  // step 3 begins: a lab where the student places each part into its layer
      title: 'Which layer does it live in? Build the stack',  // step title shown in the header
      kind: 'lab',  // kind "lab": the header labels this as a hands-on lab
      render(el, ctx) {  // render(el, ctx): builds the matching lab each time this step is shown
        const { h } = ctx;  // this step builds only ordinary page elements, so it needs just h
        const LAY = [  // LAY: the five layers the student can pick, with name, language, colour and a one-line description
          { id: 'apps', name: 'Applications', lang: 'Java / Kotlin', c: 'proc', desc: 'the programs the user opens and taps: email, maps, contacts, games' },  // layer "apps": the programs the user opens
          { id: 'fw', name: 'Application framework', lang: 'Java / Kotlin', c: 'accent', desc: 'the services apps call through the Android API: the managers, content providers and view system' },  // layer "fw": the services apps call through the Android API
          { id: 'libs', name: 'System libraries', lang: 'C / C++', c: 'lib', desc: 'fast native code: graphics, media, the database engine, the browser engine and the C library' },  // layer "libs": fast native libraries
          { id: 'rt', name: 'Android runtime', lang: 'C++ / Java', c: 'cpu', desc: 'the parts that execute app code: ART (formerly Dalvik) and the core Java libraries' },  // layer "rt": the runtime that executes app code
          { id: 'kernel', name: 'Linux kernel', lang: 'C', c: 'os', desc: 'code running in kernel mode: drivers, memory, processes, power, networking and security' },  // layer "kernel": code running in kernel mode
        ];  // closes LAY
        const ITEMS = [  // ITEMS: the twelve parts to place; each has a name, a description, the right layer (a), an explanation and a hint
          { n: 'SQLite database engine', d: 'Stores an app\'s structured data in a single file.', a: 'libs', why: 'SQLite is native C code that runs inside the app\'s own process as a library. Apps usually reach it through framework classes.', hint: 'It is written in C and runs inside the app as a library.' },  // item: SQLite belongs in the system libraries
          { n: 'Activity manager', d: 'Starts app screens and keeps the back stack.', a: 'fw', why: 'It is a framework service. Every app uses it through the standard Java/Kotlin API.', hint: 'App developers call it through the Android API.' },  // item: the activity manager belongs in the framework
          { n: 'Camera driver', d: 'Programs the image-sensor hardware.', a: 'kernel', why: 'Drivers operate hardware directly, so they run inside the Linux kernel in kernel mode.', hint: 'It has to touch the hardware itself.' },  // item: the camera driver belongs in the kernel
          { n: 'Contacts app', d: 'Lets you browse and edit phone numbers.', a: 'apps', why: 'It is an ordinary application, built from the framework like any app you could install. It shares its data through a content provider.', hint: 'It is something the user opens from the home screen.' },  // item: the Contacts app belongs in applications
          { n: 'Turning .dex bytecode into machine code', c: '.dex → machine code', d: 'Makes app code runnable on the processor.', a: 'rt', why: 'That is the runtime\'s job: Dalvik did it while the app ran, ART does it mostly ahead of time.', hint: 'Apps ship as bytecode. Which layer executes it?' },  // item: turning .dex bytecode into machine code belongs in the runtime (c is a shorter label for its chip)
          { n: 'Notification manager', d: 'Puts alerts in the status bar for any app.', a: 'fw', why: 'It is a framework service with a Java/Kotlin API, so every app posts notifications the same way.', hint: 'Apps call it through the standard API.' },  // item: the notification manager belongs in the framework
          { n: 'Wakelocks and alarms', d: 'Keep the device awake, or wake it at a set time.', a: 'kernel', why: 'They are Android\'s additions to Linux power management, built into the kernel. Framework classes are only the doorway to them.', hint: 'Only the layer that controls the hardware can stop the processor from sleeping or wake it up.' },  // item: wakelocks and alarms belong in the kernel
          { n: 'WebKit browser engine (early Android)', c: 'WebKit engine', d: 'Lays out web pages and runs their scripts.', a: 'libs', why: 'The browser engine is a large native C++ library that the browser app and in-app web views are built on.', hint: 'It is a big piece of native C++ code shared by several apps.' },  // item: the early WebKit engine belongs in the system libraries
          { n: 'Content providers', d: 'Share one app\'s data with other apps.', a: 'fw', why: 'Content providers are a framework component: apps publish and query shared data through the standard API.', hint: 'Apps use it through the Java/Kotlin API.' },  // item: content providers belong in the framework
          { n: 'Binder IPC driver', d: 'Carries messages between processes.', a: 'kernel', why: 'Only the kernel can move data between two processes\' protected memory, so the core of Binder is a kernel driver.', hint: 'Two processes cannot see each other\'s memory. Which layer can?' },  // item: the Binder driver belongs in the kernel
          { n: 'Core Java libraries', d: 'Strings, collections, files and threads for app code.', a: 'rt', why: 'The core libraries ship with the Android runtime, so Java and Kotlin code finds the standard classes it expects.', hint: 'They sit next to the engine that runs Java/Kotlin code.' },  // item: the core Java libraries belong in the runtime
          { n: 'Bionic libc', d: 'malloc, printf, open: the basic C functions.', a: 'libs', why: 'Bionic is Android\'s standard C library, the lowest of the native libraries. Every other native library calls it.', hint: 'It is a C library that other native code links against.' },  // item: Bionic libc belongs in the system libraries
          { n: 'Maps app', d: 'Shows where you are and plans routes.', a: 'apps', why: 'Maps is an application. It uses the location manager and view system from the framework beneath it.', hint: 'The user taps its icon to open it.' },  // item: the Maps app belongs in applications
        ];  // closes ITEMS
        const colOf = (c) => (c === 'lib' ? 'var(--ink-2)' : `var(--${c})`);  // colOf(c): the CSS colour for a layer; the libraries layer uses dark grey
        let order = ITEMS.map((_, i) => i), idx = 0, tries = 0, done = false, placed = [];  // order is the sequence of items to ask, idx the current one, tries the wrong clicks on it, done the finish flag, placed the results
        const pos = h('h4', { class: 'm0' });  // heading that shows "Item N of 12"
        const dots = h('div', { class: 'row gap-s' });  // row of progress pills, one per item
        const itemCard = h('div', { class: 'itemcard' });  // the card that shows the item to place (or the final result)
        const fb = h('div', { class: 'fbbox' });  // the box where feedback appears after each click
        const nextBtn = h('button', { class: 'btn primary', type: 'button', onclick: () => advance() }, 'Next item ▶');  // button that moves on to the next item after a correct answer
        const again = h('button', { class: 'btn', type: 'button', onclick: () => restart(true) }, 'Shuffle and start over');  // button that shuffles the items and restarts the lab
        const layBtns = {};  // layBtns holds the five layer buttons by layer id
        const chipBox = {};  // chipBox holds, for each layer, the box where correctly placed items appear as chips
        LAY.forEach((l) => {  // builds one button per layer
          chipBox[l.id] = h('div', { class: 'laychips' });  // the chip box inside this layer's button
          layBtns[l.id] = h('button', { class: 'lay', type: 'button', style: { '--lc': colOf(l.c), background: l.c === 'lib' ? 'var(--panel-2)' : `var(--${l.c}-bg)` }, onclick: () => choose(l.id) },  // the layer button itself, coloured by its layer; clicking it tries the current item in that layer
            h('div', { class: 'layhead' }, h('b', {}, l.name), h('span', { class: 'xs muted' }, l.lang)), chipBox[l.id]);  // the button's header (layer name and language) above its chip box
        });  // ends the loop over layers
        const tally = h('div', { class: 'small muted' });  // the line under the pills that counts items placed and first-try successes
        function paintDots() {  // paintDots(): redraws the progress pills and the tally; runs after every answer
          const fin = placed.filter(Boolean);  // fin keeps only the items already placed
          tally.innerHTML = fin.length ? `Placed <b>${fin.length}</b> of ${order.length} · first-try correct: <b style="color:var(--ok)">${fin.filter((p) => p.first).length}</b>` : 'Every wrong click explains what that layer really holds, so a miss still teaches you something.';  // the tally text: counts once something is placed, otherwise a note that wrong clicks still teach
          dots.replaceChildren(...order.map((_, k) => {  // rebuilds the row of progress pills, one per item in the current order
            const p = placed[k];  // p is the result for item k, or empty if it has not been placed yet
            return h('span', { class: 'mdot' + (k === idx && !p ? ' cur' : '') + (p ? (p.first ? ' ok' : ' warn') : '') });  // the pill's class: current item in the chapter colour, green for first-try, amber for later tries
          }));  // ends the pill list
        }  // ends paintDots()
        function showItem() {  // showItem(): shows the next item to place; runs at the start and after each "Next item"
          const it = ITEMS[order[idx]];  // it is the item record now being asked
          tries = 0; done = false;  // resets the wrong-click count and the "answered" flag for the new item
          pos.textContent = `Item ${idx + 1} of ${order.length}`;  // heading shows "Item N of 12"
          itemCard.innerHTML = `<div class="xs muted b" style="letter-spacing:.06em">WHERE DOES THIS LIVE?</div><div class="iname">${it.n}</div><div class="small muted">${it.d}</div>`;  // fills the item card with a small caption, the item name in large type and its short description
          fb.innerHTML = `<div class="callout m0" data-label="Your move">Click the layer ${ctx.narrow ? 'below' : 'on the right'} where this part belongs. The stack fills up as you go.</div>`;  // feedback box shows a prompt telling the student to click a layer (below on a phone, to the right otherwise)
          nextBtn.disabled = true;  // Next stays disabled until the item is placed in the right layer
          paintDots();  // updates the pills so the current one is highlighted
        }  // ends showItem()
        function choose(id) {  // choose(id): checks a click on layer id against the current item; runs when a layer button is pressed
          if (idx >= order.length) return;  // ignores clicks after the last item is finished
          if (done) { ctx.toast('Press "Next item" to continue.'); return; }  // once the item is placed, a small pop-up message (a toast) reminds the student to press Next
          const it = ITEMS[order[idx]];  // it is the item being asked
          const L = LAY.find((l) => l.id === id), R = LAY.find((l) => l.id === it.a);  // L is the layer the student clicked and R is the correct layer
          tries++;  // counts this attempt
          if (id === it.a) {  // right layer chosen:
            done = true;  // marks the item as answered
            placed[idx] = { first: tries === 1 };  // records whether it was right on the first try, for the pills and the final score
            chipBox[id].append(h('span', { class: 'chip fade-in ' + (tries === 1 ? 'ok' : 'warn') }, it.c || it.n));  // adds the item as a chip inside the correct layer's button: green if first try, amber otherwise
            fb.innerHTML = `<div class="callout tip m0" data-label="${tries === 1 ? 'Correct, first try' : 'Correct'}"><b>${R.name}.</b> ${it.why}</div>`;  // feedback box shows a green "Correct" note naming the layer and explaining why the item lives there
            nextBtn.disabled = false;  // enables the Next button
            nextBtn.textContent = idx === order.length - 1 ? 'See my result ▶' : 'Next item ▶';  // on the last item the button reads "See my result" instead
          } else {  // wrong layer chosen:
            layBtns[id].classList.remove('wrong'); void layBtns[id].offsetWidth; layBtns[id].classList.add('wrong'); ctx.after(900, () => layBtns[id].classList.remove('wrong'));  // restarts the shake animation on the clicked button (reading offsetWidth forces the browser to notice) and clears it after 0.9 s
            fb.innerHTML = `<div class="callout bad m0" data-label="Not the ${L.name.toLowerCase()}">That layer holds ${L.desc}. <b>Hint:</b> ${it.hint}</div>`;  // feedback box explains what the clicked layer really holds and gives a hint for this item
          }  // ends the right/wrong branches
          paintDots();  // updates the pills and the tally
        }  // ends choose()
        function advance() {  // advance(): moves to the next item or shows the final result; runs when Next is pressed
          if (!done) return;  // does nothing until the current item is answered correctly
          idx++;  // moves on to the next item
          if (idx < order.length) { showItem(); return; }  // if items remain, shows the next one and stops here
          const first = placed.filter((p) => p.first).length;  // first counts how many items were right on the first try
          pos.textContent = 'Stack complete';  // heading now says the stack is complete
          itemCard.innerHTML = `<div class="xs muted b" style="letter-spacing:.06em">YOUR RESULT</div><div class="iname">${first} of ${order.length} on the first try</div><div class="small muted">Green chips were placed first time; amber ones needed another go.</div>`;  // item card shows the result: how many of the twelve were right first time
          fb.innerHTML = `<div class="callout why m0" data-label="The pattern">Things you <b>open</b> are apps. Things apps <b>call through the API</b> are framework. <b>Native C/C++ helpers</b> are libraries. Whatever <b>executes app code</b> is the runtime. Anything that <b>touches hardware or needs kernel mode</b> is the kernel.</div>`;  // feedback box sums up the pattern: what makes something an app, framework, library, runtime or kernel part
          nextBtn.disabled = true; nextBtn.textContent = 'Next item ▶';  // disables Next and resets its label for a later restart
          paintDots();  // updates the pills to show every result
        }  // ends advance()
        function restart(shuffle) {  // restart(shuffle): empties the stack and begins again, in a random order if shuffle is true
          order = shuffle ? ctx.util.shuffle(ITEMS.map((_, i) => i)) : ITEMS.map((_, i) => i);  // builds the item order: shuffled with the guide's shuffle helper, or in list order
          idx = 0; placed = [];  // back to the first item with no results
          Object.values(chipBox).forEach((b) => b.replaceChildren());  // empties the chips from every layer button
          showItem();  // shows the first item
        }  // ends restart()
        const left = h('div', { class: 'stack fill', style: { gap: '12px' } },  // left column of the lab: header row, item card, feedback, hint, tally and buttons stacked
          h('div', { class: 'row', style: { justifyContent: 'space-between' } }, pos, dots),  // header row: "Item N of 12" on the left, progress pills on the right
          itemCard, h('div', { class: 'grow stack', style: { gap: '10px' } }, fb,  // the item card, then a growing area that holds the feedback box...
          ctx.ui.reveal('Stuck? Show the rule of thumb', '<p class="small m0">Ask: does the user <b>open</b> it (app)? Do apps <b>call it through the Java/Kotlin API</b> (framework)? Is it a <b>native C/C++ helper</b> (library)? Does it <b>execute app code</b> (runtime)? Does it <b>touch hardware or need kernel mode</b> (kernel)?</p>')),  // ...and a Show/Hide button that reveals a rule of thumb for choosing the layer
          tally, h('div', { class: 'row' }, nextBtn, again));  // the tally line, then a row with the Next and Shuffle buttons
        const right = h('div', { class: 'laygrid' + (ctx.narrow ? ' nar' : '') }, layBtns.apps, layBtns.fw, layBtns.libs, layBtns.rt, layBtns.kernel);  // right column: the five layer buttons arranged as the stack, top to bottom
        el.append(h('div', { class: 'split l fill' }, left, right));  // puts the columns side by side with the layer stack wider (split l), filling the height
        restart(false);  // starts the lab in list order the first time the step is shown
      },  // ends render() for step 3
    },  // ends step 3

    /* ---------------- 4. System architecture: follow a request through Binder, services, HAL, kernel ---------------- */
    {  // step 4 begins: follow a request from an app down to the hardware and back
      title: 'Follow a request: from a tap down to the hardware',  // step title shown in the header
      kind: 'explore',  // kind "explore": the header labels this as an exploration
      render(el, ctx) {  // render(el, ctx): builds the animated request trace each time this step is shown
        const { h, s } = ctx;  // h builds page elements and s builds SVG drawing elements
        const COLX = [72, 201, 330, 459, 588];            // centres of the five HAL / kernel / hardware columns
        const SVC = { cam: 94, aud: 245, loc: 418 };      // centres of the three service tiles
        const APPX = { cam: 120, aud: 330, loc: 540 };  // APPX: the horizontal centre of each app tile in the top row of the drawing
        const Y = { app: 92, binder: 108, svc: 204, hal: 296, drv: 374, hw: 452 };   // token sits on each box's top edge so it never hides a label
        const SC = {  // SC: the three requests the student can follow; each names the boxes it passes and has one caption per animation frame
          cam: { label: 'Take a photo', short: 'Photo', sname: 'Camera service', app: 'Camera app', api: 'framework: Camera API', col: 0, svc: 'cam', hal: 'Camera HAL', drv: 'Camera driver', hw: 'Image sensor',  // request "cam": taking a photo, with the app, service, HAL, driver and hardware it uses
            caps: [  // caps: the eight captions for the photo request, one per frame
              '<b>App.</b> The Camera app\'s code calls the framework: "take a picture with the back camera". The framework class it calls is only a <b>proxy</b> (a stand-in). The real camera code runs in a different process.',  // photo frame 1: the app calls a framework proxy, a stand-in for code in another process
              '<b>Binder.</b> The proxy packs the request into a Binder transaction. The Binder driver in the kernel copies it into the camera service\'s process and stamps it with the caller\'s identity (its Linux user ID).',  // photo frame 2: Binder copies the request into the camera service and adds the caller's identity
              '<b>System service.</b> The camera service (historically part of the media server process) receives the call. It checks that this app was granted the camera permission, then configures the camera.',  // photo frame 3: the camera service checks the camera permission
              '<b>HAL.</b> The service calls the camera HAL: a standard camera interface that every phone maker implements for its own chip. The service code is the same on every phone.',  // photo frame 4: the service calls the standard camera HAL that each maker implements
              '<b>Kernel.</b> The phone maker\'s HAL module talks to the camera driver in the Linux kernel through ordinary system calls.',  // photo frame 5: the HAL module reaches the camera driver with system calls
              '<b>Hardware.</b> The driver programs the image sensor, which captures the picture.',  // photo frame 6: the driver programs the image sensor
              '<b>Back up.</b> The image data travels back the same way: driver → HAL → camera service.',  // photo frame 7: the image travels back up to the service
              '<b>Done.</b> Binder carries the result back to the app\'s process, which shows the photo. The app never touched the hardware or the driver itself.'] },  // photo frame 8: Binder returns the result to the app, which never touched the hardware
          aud: { label: 'Play a song', short: 'Song', sname: 'Audio service', app: 'Music app', api: 'framework: MediaPlayer', col: 1, svc: 'aud', hal: 'Audio HAL', drv: 'Audio driver', hw: 'Speaker',  // request "aud": playing a song, with its boxes
            caps: [  // caps: the eight captions for the song request
              '<b>App.</b> The Music app asks the framework\'s media player to play a song file. Again, the framework object in the app is only a proxy.',  // song frame 1: the Music app calls the framework media player, again a proxy
              '<b>Binder.</b> The request crosses into the media server process through Binder, with the app\'s identity attached.',  // song frame 2: the request crosses into the media server through Binder
              '<b>System service.</b> The media service decodes the song with the media framework library, and the audio service mixes it with any other sound that is playing, such as a notification ding.',  // song frame 3: the media service decodes the song and the audio service mixes it with other sounds
              '<b>HAL.</b> The mixed sound goes to the audio HAL, the standard audio interface the phone maker implemented for its sound chip.',  // song frame 4: the mixed sound goes to the audio HAL
              '<b>Kernel.</b> The HAL module hands the sound samples to the audio driver in the kernel.',  // song frame 5: the HAL hands the samples to the audio driver
              '<b>Hardware.</b> The driver feeds the samples to the sound hardware and you hear the song.',  // song frame 6: the driver feeds the sound hardware
              '<b>Back up.</b> Status flows back up: the service reports "playing" (and later "finished").',  // song frame 7: status such as "playing" flows back up
              '<b>Done.</b> Binder delivers the reply to the app, which updates its play button. Two apps can make sound at once because one service does the mixing.'] },  // song frame 8: the reply reaches the app; one service mixing lets two apps play sound at once
          loc: { label: 'Find my location', short: 'Location', sname: 'Location service', app: 'Maps app', api: 'framework: LocationManager', col: 2, svc: 'loc', hal: 'GNSS HAL', drv: 'GPS driver', hw: 'GPS chip',  // request "loc": finding the location, with its boxes
            caps: [  // caps: the eight captions for the location request
              '<b>App.</b> The Maps app asks the location manager where the device is. The location manager inside the app is a proxy for the real one.',  // location frame 1: Maps asks the location manager, a proxy for the real one
              '<b>Binder.</b> The request goes through Binder to the system server, the process that hosts most of Android\'s managers.',  // location frame 2: Binder carries the request to the system server
              '<b>System service.</b> The location manager service checks that Maps holds a location permission, then switches the GPS on if no other app already has it on.',  // location frame 3: the location service checks permission and turns the GPS on if needed
              '<b>HAL.</b> The service talks to the GNSS HAL (GNSS covers GPS and other satellite systems), implemented by the chip vendor.',  // location frame 4: the service talks to the GNSS (satellite positioning) HAL
              '<b>Kernel.</b> The vendor\'s HAL module drives the GPS receiver through its kernel driver.',  // location frame 5: the HAL drives the GPS receiver through its driver
              '<b>Hardware.</b> The GPS chip listens to satellites and works out a position.',  // location frame 6: the GPS chip works out a position from satellite signals
              '<b>Back up.</b> The position travels back up to the location service, which can share one reading with every app that asked.',  // location frame 7: the position returns to the location service, which can share it with every app that asked
              '<b>Done.</b> Binder delivers the position to Maps, which moves the blue dot. One GPS chip serves many apps through one service.'] },  // location frame 8: Maps gets the position and moves its dot; one GPS chip serves many apps through one service
        };  // closes the SC table of requests
        const HALS = ['Camera HAL', 'Audio HAL', 'GNSS HAL', 'Graphics HAL'];  // HALS: the HAL tiles drawn in the HAL row, one per column
        const DRVS = ['Camera driver', 'Audio driver', 'GPS driver', 'Display driver', 'Binder driver'];  // DRVS: the driver tiles in the kernel row; the fifth column is the Binder driver
        const HWS = ['Image sensor', 'Speaker', 'GPS chip', 'Display'];  // HWS: the hardware tiles in the bottom row
        let sc = 'cam';  // sc is the request being followed; the photo request is shown first
        // Layers, bottom to top: back (band backgrounds) → trail (dashed route) → fore (tiles + labels) → token.
        // Tiles sit above the trail, so the route shows as "wires" between boxes and never runs through their text.
        const back = s('g', {}), fore = s('g', {});  // back holds the band backgrounds and fore holds the tiles and labels, so they can be drawn in separate layers
        const trail = s('polyline', { fill: 'none', style: 'stroke:var(--accent)', 'stroke-width': 3, 'stroke-dasharray': '6 5', 'stroke-linecap': 'round' });  // trail is the dashed accent-coloured line that shows the path the request has travelled so far
        const tok = s('g', { class: 'tok' }, s('circle', { r: 12, style: 'fill:var(--accent);stroke:var(--panel)', 'stroke-width': 3 }), s('text', { y: 5, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 900, style: 'fill:var(--accent-ink)' }, '▼'));  // tok is the moving marker: a filled circle with an arrow showing whether the request is heading down or up
        const NW = ctx.narrow;   // phones get a single-column drawing of just the chosen request, so its text stays readable
        const svg = s('svg', { viewBox: NW ? '0 0 360 426' : '0 0 660 500', width: '100%', style: { display: 'block' } }, back, trail, fore, tok);  // the SVG drawing, stacking back, trail, fore and token in that order; a smaller single column on phone-width screens
        const HALO = { 's-proc': 'var(--proc-bg)', 's-os': 'var(--os-bg)', 's-panel': 'var(--panel-2)', 's-accent': 'var(--accent-bg)' };  // HALO: the background colour behind each kind of band, used to outline labels so the trail never cuts through them
        const halo = (cls) => `paint-order:stroke;stroke:${HALO[cls]};stroke-width:5px;stroke-linejoin:round`;  // halo(cls): styling that draws a thick outline in the band's background colour behind a label's letters
        let B, F;   // arrays being filled for the back and fore layers
        const band = (x, y, w, hh, cls, label, note) => {  // band(...): queues one layer band: its rectangle goes into the back layer, its label and note into the fore layer
          B.push(s('rect', { x, y, width: w, height: hh, rx: 12, class: cls, 'stroke-width': 1.5, style: 'stroke-opacity:.6' }));  // the band's rectangle with a faded border
          F.push(s('text', { x: x + 12, y: y + 17, 'font-size': 12.5, 'font-weight': 800, 'letter-spacing': '.06em', class: 's-sub', style: halo(cls) }, label));  // the band's name at its top-left, outlined so it stays readable
          if (note) F.push(s('text', { x: x + w - 12, y: y + 17, 'font-size': 12.5, 'text-anchor': 'end', class: 's-sub', style: halo(cls) }, note));  // an optional note at the band's top-right, such as "kernel mode"
        };  // ends band()
        const binderBar = (x, y, w, hh, on, cx, text) => {  // binderBar(...): queues the rounded Binder bar that every request must cross; on marks it as active
          B.push(s('rect', { x, y, width: w, height: hh, rx: hh / 2, class: 's-accent', 'stroke-width': on ? 3.5 : 1.8 }));  // the bar's rounded rectangle, with a thicker border when the request is crossing it
          F.push(s('text', { x: cx, y: y + hh / 2 + 6, 'text-anchor': 'middle', 'font-size': 13.5, 'font-weight': 700, style: halo('s-accent') }, text));  // the text on the bar, centred at cx
        };  // ends binderBar()
        const tile = (cx, y, w, hh, l1, l2, stroke, on, dim) => s('g', { opacity: dim ? 0.45 : 1 },  // tile(...): builds one labelled box centred at cx; on highlights it and dim fades it out
          s('rect', { x: cx - w / 2, y, width: w, height: hh, rx: 9, 'stroke-width': on ? 3.5 : 1.8, style: `fill:${on ? `var(--${stroke}-bg)` : 'var(--panel)'};stroke:var(--${stroke})` }),  // the tile's rectangle: tinted and thick-bordered when on, white otherwise
          s('text', { x: cx, y: y + (l2 ? hh / 2 - 3 : hh / 2 + 5), 'text-anchor': 'middle', 'font-size': 14, 'font-weight': on ? 800 : 650 }, l1),  // the tile's first line, placed higher when a second line follows
          l2 ? s('text', { x: cx, y: y + hh / 2 + 14, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, l2) : null);  // the optional second line in smaller grey text
        const route = h('div', { class: 'row route' });  // route is the row of chips under the player that lists every hop and how far the request has come
        const HOPS = [['app', 'App'], ['binder', 'Binder'], ['svc', 'Service'], ['hal', 'HAL'], ['drv', 'Driver'], ['hw', 'Hardware']];  // HOPS: the six hops of the route as [id, label], from app down to hardware
        function finish(i, nodes) {   // shared: paint the layers, the trail so far and the token
          back.replaceChildren(...B); fore.replaceChildren(...F);  // puts the queued back and fore shapes into their layers
          trail.setAttribute('points', nodes.slice(0, Math.min(i, 5) + 1).map((p) => p.join(',')).join(' '));  // draws the trail through the hops passed so far (all six once the request reaches the hardware)
          const [tx, ty] = i <= 5 ? nodes[i] : i === 6 ? nodes[2] : nodes[0];  // where the token sits: on the current hop going down, at the service in frame 7, back at the app in frame 8
          tok.style.transform = `translate(${tx}px, ${ty}px)`;  // moves the token there; the tok CSS rule makes it glide
          tok.lastChild.textContent = i <= 5 ? '▼' : '▲';  // the token's arrow points down on the way to the hardware and up on the way back
        }  // ends finish()
        function draw(i) {  // draw(i): draws animation frame i (0-7) for the chosen request and returns its caption; the player calls it on every step
          const c = SC[sc], col = c.col;  // c is the chosen request and col is which column its HAL, driver and hardware use
          const at = ['app', 'binder', 'svc', 'hal', 'drv', 'hw', 'svc', 'app'][i];  // at names the hop the request is at in each of the eight frames
          const reached = i <= 5 ? i : 5;  // reached is how many hops down the request has gone; it stays at the hardware on the way back
          const bOn = at === 'binder' || i === 7;  // bOn is true while the request is crossing Binder (going down in frame 2 and coming back in frame 8)
          route.replaceChildren(...HOPS.flatMap(([id, lab], k) => [k ? h('span', { class: 'muted b' }, i >= 6 ? '←' : '→') : null,  // rebuilds the route chips, with an arrow between hops that points backwards once the result is returning
            h('span', { class: 'chip ' + (id === at && (i <= 5 || k !== 1) ? 'accent' : k <= reached ? 'ok' : ''), title: [c.app, 'Binder', c.sname, c.hal, c.drv, c.hw][k] }, lab)]).filter(Boolean));  // each chip: purple for the hop the request is at, green for hops passed, plain for those ahead; its tooltip names the real box
          B = []; F = [];  // starts fresh lists for the back and fore layers
          if (NW) return drawNarrow(i, c, at, bOn);  // on a phone-width screen, hands off to the single-column drawing instead
          band(4, 6, 652, 94, 's-proc', 'APPLICATIONS + FRAMEWORK', 'each app is its own process');  // top band: applications and framework, noting each app is its own process
          Object.keys(SC).forEach((k) => {  // draws the three app tiles side by side
            const on = k === sc && at === 'app';  // an app tile is highlighted when it belongs to the chosen request and the request is at the app
            F.push(s('g', { opacity: k === sc ? 1 : 0.4 },  // tiles for the other requests are faded
              s('rect', { x: APPX[k] - 98, y: 30, width: 196, height: 62, rx: 10, 'stroke-width': on ? 3.5 : 1.8, style: `fill:${on ? 'var(--proc-bg)' : 'var(--panel)'};stroke:var(--proc)` }),  // the app tile's rectangle
              s('text', { x: APPX[k], y: 55, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800 }, SC[k].app),  // the app's name
              s('text', { x: APPX[k], y: 77, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, SC[k].api)));  // the framework class the app calls, under its name
          });  // ends the loop over app tiles
          binderBar(4, 108, 652, 34, bOn, 330, 'BINDER IPC: the main door between processes, carried by the Binder driver in the kernel');  // the Binder bar across the whole drawing, the one door between processes
          band(4, 150, 652, 112, 's-os', 'ANDROID SYSTEM SERVICES', 'separate, trusted processes');  // band for the Android system services, the trusted processes that do the real work
          B.push(s('rect', { x: 12, y: 172, width: 312, height: 82, rx: 10, class: 's-panel', 'stroke-width': 1.5 }), s('rect', { x: 336, y: 172, width: 312, height: 82, rx: 10, class: 's-panel', 'stroke-width': 1.5 }));  // two panels inside it: the media server on the left and the system server on the right
          F.push(s('text', { x: 22, y: 189, 'font-size': 13, 'font-weight': 800, style: halo('s-panel') }, 'Media server'), s('text', { x: 346, y: 189, 'font-size': 13, 'font-weight': 800, style: halo('s-panel') }, 'System server'));  // labels for the media server and system server panels
          const svcOn = at === 'svc';  // svcOn is true when the request is at the service
          F.push(tile(SVC.cam, 204, 144, 44, 'Camera service', null, 'os', svcOn && sc === 'cam', sc !== 'cam'),  // the camera service tile in the media server, highlighted when in use and faded for other requests
            tile(SVC.aud, 204, 142, 44, 'Audio + media', null, 'os', svcOn && sc === 'aud', sc !== 'aud'),  // the audio and media tile in the media server
            tile(SVC.loc, 204, 144, 44, 'Location service', null, 'os', svcOn && sc === 'loc', sc !== 'loc'),  // the location service tile in the system server
            tile(569, 204, 142, 44, 'Activity, window,', 'power, package…', 'os', false, true));  // a faded tile standing for the system server's other managers (activity, window, power, package)
          band(4, 272, 652, 70, 's-panel', 'HARDWARE ABSTRACTION LAYER (HAL)', 'written by the chip or phone maker');  // band for the hardware abstraction layer, written by the chip or phone maker
          HALS.forEach((n, k) => F.push(tile(COLX[k], 296, 120, 38, n, null, 'accent', at === 'hal' && k === col, k !== col)));  // the four HAL tiles; the chosen request's HAL is highlighted when reached, the others faded
          band(4, 350, 652, 70, 's-os', 'LINUX KERNEL', 'kernel mode');  // band for the Linux kernel, which runs in kernel mode
          DRVS.forEach((n, k) => F.push(tile(COLX[k], 374, 120, 38, n, null, k === 4 ? 'accent' : 'io', (at === 'drv' && k === col) || (k === 4 && bOn), k !== col && !(k === 4 && bOn))));  // the five driver tiles; the Binder driver (column 5) lights up whenever the request crosses Binder
          band(4, 428, 652, 68, 's-panel', 'HARDWARE', null);  // band for the hardware
          HWS.forEach((n, k) => F.push(tile(COLX[k], 452, 120, 38, n, null, 'io', at === 'hw' && k === col, k !== col)));  // the four hardware tiles, faded except the chosen request's device
          // column 5 holds the Binder driver, which is pure software: it has no HAL above it and no device below it
          F.push(s('text', { x: COLX[4], y: 468, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, 'Binder needs no'),  // under the Binder driver column, a note that Binder needs...
            s('text', { x: COLX[4], y: 484, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, 'HAL and no device'));  // ...no HAL and no device, since it is pure software
          finish(i, [[APPX[sc], Y.app], [APPX[sc], Y.binder], [SVC[c.svc], Y.svc], [COLX[col], Y.hal], [COLX[col], Y.drv], [COLX[col], Y.hw]]);  // moves the token and trail through this request's six hop positions
          return c.caps[i];  // returns the caption for this frame, which the player shows above the controls
        }  // ends draw()
        function drawNarrow(i, c, at, bOn) {   // phone layout: one column per tier for the chosen request only
          const CX = 150, BX = 305;         // main chain down the left; the Binder driver sits at the right of the kernel tier
          const PROC = { cam: 'media server', aud: 'media server', loc: 'system server' }[sc];  // PROC names which service process handles the chosen request
          band(4, 4, 352, 74, 's-proc', 'APP + FRAMEWORK', 'own process');  // top band: the app and framework in their own process
          F.push(tile(CX, 26, 210, 46, c.app, c.api, 'proc', at === 'app', false));  // the chosen app's tile, with the framework class it calls
          binderBar(4, 86, 352, 32, bOn, 200, 'BINDER IPC (via the kernel)');  // the Binder bar
          band(4, 126, 352, 74, 's-os', 'SYSTEM SERVICE', 'in the ' + PROC);  // band for the system service, noting which server process hosts it
          F.push(tile(CX, 148, 210, 46, c.sname, null, 'os', at === 'svc', false));  // the chosen service's tile
          band(4, 208, 352, 66, 's-panel', 'HAL', 'vendor-written');  // band for the HAL
          F.push(tile(CX, 230, 210, 38, c.hal, null, 'accent', at === 'hal', false));  // the chosen HAL tile
          band(4, 282, 352, 66, 's-os', 'LINUX KERNEL', null);  // band for the Linux kernel
          F.push(tile(CX, 304, 210, 38, c.drv, null, 'io', at === 'drv', false), tile(BX, 304, 90, 38, 'Binder drv', null, 'accent', bOn, !bOn));  // the chosen driver's tile, plus a small Binder driver tile on the right that lights up during Binder crossings
          band(4, 356, 352, 66, 's-panel', 'HARDWARE', null);  // band for the hardware
          F.push(tile(CX, 378, 210, 38, c.hw, null, 'io', at === 'hw', false));  // the chosen hardware tile
          finish(i, [[CX, 72], [CX, 86], [CX, 148], [CX, 230], [CX, 304], [CX, 378]]);  // moves the token and trail down the single column of hops
          return c.caps[i];  // returns the caption for this frame
        }  // ends drawNarrow()
        const player = ctx.ui.player({ count: 8, render: draw, interval: 2300, speed: false });  // the step-by-step player: eight frames, each drawn by draw(), advancing every 2.3 s when playing, with no speed buttons
        const seg = ctx.ui.seg(Object.keys(SC).map((k) => ({ value: k, label: SC[k].short })), sc, (v) => { sc = v; player.reset(); });  // buttons to choose the request (Photo, Song, Location); choosing one restarts the player from frame 1
        const right = h('div', { class: 'stack', style: { gap: '10px' } },  // right-hand column: request picker, player, route and a design note stacked
          h('div', { class: ctx.narrow ? 'row' : 'row nw', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'Pick a request to follow'), seg),  // a row with the heading "Pick a request to follow" and the picker buttons (kept on one line on wide screens)
          player.el,  // the player's caption and controls
          h('div', { class: 'card tight' }, h('h4', {}, 'Route · green = passed · purple = here now'), route),  // a card showing the route chips, with a key: green means passed, purple means here now
          h('div', { class: 'callout why m0 small', 'data-label': 'Why this design?', html: '<b>Safety:</b> apps never touch hardware. Every request passes one checkable door, <span class="t" data-t="Binder">Binder</span>, into a trusted <span class="t" data-t="Android system services">system service</span> that checks permissions and shares each device among apps.<br><b>Portability:</b> each phone maker writes modules for the standard <span class="t" data-t="Android HAL">HAL</span> interfaces, so the services above are identical on every phone.' }));  // "Why this design?" box: Binder is one checkable door for safety, and the standard HAL makes services portable
        el.append(h('div', { class: 'split r fill' }, h('div', { style: { display: 'flex', alignItems: 'center' } }, svg), right));  // lays the step out with the drawing on the wider left side and the controls on the right
      },  // ends render() for step 4
    },  // ends step 4

    /* ---------------- 5. Dalvik JIT vs ART AOT: when does bytecode become machine code? ---------------- */
    {  // step 5 begins: comparing Dalvik and ART, and when app bytecode becomes machine code
      title: 'Dalvik vs ART: when does app code become machine code?',  // step title shown in the header
      kind: 'compare',  // kind "compare": the header labels this as a comparison
      render(el, ctx) {  // render(el, ctx): builds the pipeline, the comparison table and the work chart each time this step is shown
        const { h, s } = ctx;  // h builds page elements and s builds SVG drawing elements
        // Illustrative work model (processor work done ON BATTERY, arbitrary units):
        //   Dalvik:  install 1, every launch 5 (interpret + JIT again; JIT results are lost when the process ends)
        //   ART AOT: install 12 (compile everything), every launch 1 (just run machine code)
        //   Hybrid:  install 1, launches 1-3 cost 3 (ART's faster interpreter + JIT, while recording a profile), then the
        //            hot code is compiled while the phone charges (not on battery); later launches cost 1.5 because the
        //            rarely used code that was not compiled still runs in the interpreter
        const RT = {  // RT: the three runtimes to compare; work(n) gives the total processor work on battery after n launches
          dalvik: { name: 'Dalvik VM', short: 'Dalvik', era: 'Android 1.0 – 4.4', col: 'var(--warn)', work: (n) => 1 + 5 * n,  // runtime "dalvik": Android 1.0 to 4.4; work is 1 unit to install plus 5 for every launch
            install: 'Only checks and lightly optimizes the .dex file, so installs are quick.',  // what Dalvik does at install: only a light check, so installs are quick
            launch: 'Interprets the bytecode; from Android 2.2 a <span class="t" data-t="Just-in-time compilation">just-in-time (JIT)</span> compiler turns busy code into machine code. That work is lost when the app exits, so it is redone every launch.' },  // what Dalvik does at each launch: interpret, and compile busy code just in time, then lose it when the app exits
          aot: { name: 'ART, ahead of time', short: 'ART AOT', era: 'Android 5.0 – 6.0', col: 'var(--cpu)', work: (n) => 12 + n,  // runtime "aot": ART compiling everything ahead of time; 12 units at install, then 1 per launch
            install: 'The phone compiles the whole app into native machine code and stores it (<span class="t" data-t="Ahead-of-time compilation">ahead of time, AOT</span>). Installs are slow and use extra storage.',  // what ART AOT does at install: compiles the whole app, slowly, using extra storage
            launch: 'Runs the stored machine code at once; nothing is left to translate. But every OS update meant recompiling every app (a long "Optimizing apps" screen).' },  // what ART AOT does at each launch: runs stored machine code, but every OS update forces a recompile
          hyb: { name: 'ART, hybrid', short: 'ART hybrid', era: 'Android 7.0 and later', col: 'var(--accent)', work: (n) => 1 + 3 * Math.min(n, 3) + 1.5 * Math.max(0, n - 3),  // runtime "hyb": hybrid ART; 3 units per launch for the first three, then 1.5 after the hot code is compiled
            install: 'Compiles little or nothing, so installs are quick and storage stays modest.',  // what hybrid ART does at install: compiles little, so installs are quick
            launch: 'Early launches run on ART\'s faster interpreter and JIT while it records which code is hot (a profile). While the phone idles on the charger, that hot code is compiled ahead of time.' },  // what hybrid ART does at each launch: records a profile of hot code and compiles it while charging
        };  // closes the RT table
        const ROWS = [  // ROWS: the comparison table's rows; each runtime gets [what to show, chip colour] for every row
          ['Install time', { dalvik: ['short', 'ok'], aot: ['long', 'bad'], hyb: ['short', 'ok'] }],  // row: install time for each runtime
          ['Storage for code', { dalvik: ['small', 'ok'], aot: ['large', 'bad'], hyb: ['medium', 'warn'] }],  // row: storage space taken by compiled code
          ['Launch speed', { dalvik: ['slower', 'bad'], aot: ['fast', 'ok'], hyb: ['fast once warm', 'ok'] }],  // row: how quickly the app launches
          ['Battery per launch', { dalvik: ['higher', 'bad'], aot: ['low', 'ok'], hyb: ['low once warm', 'ok'] }],  // row: battery used on each launch
          ['After an OS update', { dalvik: ['quick', 'ok'], aot: ['recompile all', 'bad'], hyb: ['quick', 'ok'] }],  // row: what happens after an operating system update
        ];  // closes ROWS
        let sel = 'aot', n = 10;  // sel is the runtime selected (ART AOT at first) and n is the number of launches set on the slider
        const PIPE = [['Java or Kotlin source', 'proc'], ['compiler', null], ['.class bytecode', ''], ['dex tool', null], ['classes.dex in the app package', 'accent'], ['install', null], ['<span>machine code… but <i>when?</i></span>', 'cpu']];  // PIPE: the build pipeline from source code to .dex; entries with colour null are the arrows between boxes
        const pipe = h('div', { class: 'pipe' + (ctx.narrow ? ' nar' : '') }, ...PIPE.map(([a, c]) => c === null  // builds the pipeline row from PIPE...
          ? h('div', { class: 'pipe-arrow' }, h('span', { class: 'xs muted b' }, a), h('span', { class: 'b', style: { color: 'var(--chc)', fontSize: '18px' } }, '→'))  // ...an arrow entry becomes a small label above a chapter-coloured arrow...
          : h('div', { class: 'box small ' + c, html: a })));  // ...and every other entry becomes a coloured box
        const what = h('div', { class: 'card tight stack', style: { gap: '4px', flex: 'none' } });  // card that describes the selected runtime; filled by paintLeft()
        const tbl = h('table', { class: 'tbl compact rt-tbl', style: { flex: 'none' } });  // the comparison table; filled by paintLeft()
        function paintLeft() {  // paintLeft(): refreshes the runtime description and the table; runs when a runtime is picked
          const r = RT[sel];  // r is the selected runtime's record
          what.innerHTML = `<div class="row" style="justify-content:space-between"><b style="color:${r.col}">${r.name}</b><span class="xs muted b">${r.era}</span></div>${/* description card, first line: the runtime's name in its own colour and the Android versions that used it */''}
            <div class="small"><b>At install:</b> ${r.install}</div><div class="small"><b>At each launch:</b> ${r.launch}</div>`;  // then what it does at install and at each launch
          tbl.innerHTML = '<tr><th></th>' + Object.keys(RT).map((k) => `<th class="${k === sel ? 'col-on' : ''}">${RT[k].short}</th>`).join('') + '</tr>' +  // table header: an empty corner cell, then one column per runtime, the selected one shaded
            ROWS.map(([lab, v]) => `<tr><td class="b">${lab}</td>` + Object.keys(RT).map((k) => `<td class="${k === sel ? 'col-on' : ''}"><span class="chip ${v[k][1]}">${v[k][0]}</span></td>`).join('') + '</tr>').join('');  // one table row per ROWS entry, each cell a coloured chip; the selected runtime's column is shaded
        }  // ends paintLeft()
        // chart: cumulative work on battery vs launches
        const NW = ctx.narrow;   // phones get a narrower drawing so the axis labels stay readable
        const CW = NW ? 340 : 540, CH = 238;  // the chart's width (smaller on a phone-width screen) and height, in drawing units
        const X0 = NW ? 36 : 44, X1 = CW - 14, Y0 = 200, Y1 = 12, NMAX = 30, WMAX = 160;  // the plot area's edges (X0 to X1 across, Y0 bottom to Y1 top) and the axis limits: 30 launches, 160 work units
        const px = (k) => X0 + (k * (X1 - X0)) / NMAX, py = (w) => Y0 - (w * (Y0 - Y1)) / WMAX;  // px(k) and py(w) convert a launch count and a work amount into positions inside the chart
        const chart = s('svg', { viewBox: `0 0 ${CW} ${CH}`, width: '100%', style: { display: 'block', flex: 'none' } });  // the SVG line chart of total work versus launches
        const readout = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px' } });  // three readout cards side by side, one per runtime, showing work done so far
        const verdict = h('p', { class: 'small m0' });  // a sentence under the chart that explains what the numbers mean for the chosen launch count
        function drawChart() {  // drawChart(): redraws the chart, readouts and verdict; runs when the slider moves or a runtime is picked
          const kids = [];  // kids collects the chart's shapes
          for (let w = 0; w <= WMAX; w += 40) kids.push(s('line', { x1: X0, x2: X1, y1: py(w), y2: py(w), class: 's-muted', 'stroke-width': 1 }), s('text', { x: X0 - 8, y: py(w) + 4, 'text-anchor': 'end', 'font-size': 13, class: 's-sub' }, String(w)));  // grid lines every 40 units, each labelled on the left with its value
          for (let k = 0; k <= NMAX; k += 5) kids.push(s('text', { x: px(k), y: Y0 + 17, 'text-anchor': 'middle', 'font-size': 13, class: 's-sub' }, String(k)));  // launch-count labels along the bottom every 5 launches
          kids.push(s('text', { x: (X0 + X1) / 2, y: CH - 3, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700, class: 's-sub' }, 'times the app has been opened →'));  // the bottom axis title: times the app has been opened
          kids.push(s('line', { x1: px(n), x2: px(n), y1: Y1 - 4, y2: Y0, style: 'stroke:var(--ink-2)', 'stroke-width': 1.5, 'stroke-dasharray': '4 4' }));  // a dashed vertical line marking the launch count chosen on the slider
          const order = Object.keys(RT).filter((k) => k !== sel).concat(sel);  // drawing order: the other runtimes first and the selected one last, so its line lies on top
          order.forEach((k) => {  // draws one line per runtime
            const r = RT[k], on = k === sel;  // r is the runtime and on says whether it is the selected one
            const pts = ctx.util.range(NMAX + 1).map((i) => `${px(i)},${py(r.work(i))}`).join(' ');  // the line's points: work after 0, 1, 2 ... 30 launches
            kids.push(s('polyline', { points: pts, fill: 'none', style: `stroke:${r.col}`, 'stroke-width': on ? 4 : 2.2, opacity: on ? 1 : 0.5, 'stroke-linejoin': 'round' }));  // the runtime's line: thick and solid when selected, thinner and faded otherwise
            kids.push(s('circle', { cx: px(n), cy: py(r.work(n)), r: on ? 6.5 : 4.5, style: `fill:${r.col};stroke:var(--panel)`, 'stroke-width': 2 }));  // a dot where the line crosses the chosen launch count
          });  // ends the loop over runtime lines
          Object.keys(RT).forEach((k, i) => {  // the chart's colour key in its top-left corner
            const r = RT[k];  // r is the runtime for this key entry
            kids.push(s('g', { opacity: k === sel ? 1 : 0.7 }, s('rect', { x: X0 + 12, y: 16 + i * 21, width: 22, height: 5, rx: 2, style: `fill:${r.col}` }),  // a short coloured bar for the key, faded unless selected...
              s('text', { x: X0 + 42, y: 23 + i * 21, 'font-size': 14, 'font-weight': k === sel ? 800 : 600, style: 'paint-order:stroke;stroke:var(--panel);stroke-width:5px;stroke-linejoin:round' }, r.name)));  // ...and the runtime's name beside it, outlined in white so grid lines do not cut through it
          });  // ends the colour key
          kids.push(s('line', { x1: px(3), x2: px(3), y1: py(RT.aot.work(3)) - 6, y2: py(84), class: 's-line', 'stroke-width': 1.2 }),  // a thin pointer line at launch 3, where ART AOT has repaid its install cost...
            s('text', { x: px(3) - 6, y: py(90), 'font-size': 13, class: 's-sub', style: 'paint-order:stroke;stroke:var(--panel);stroke-width:5px;stroke-linejoin:round' }, NW ? 'launch 3: AOT pays off' : 'launch 3: AOT has repaid its install cost'));  // ...and its label (shortened on a phone-width screen)
          chart.replaceChildren(...kids);  // puts all the shapes into the chart at once
          readout.replaceChildren(...Object.keys(RT).map((k) => h('div', { class: 'kpi' + (k === sel ? ' on' : ''), style: { '--kc': RT[k].col } },  // rebuilds the three readout cards, the selected one highlighted
            h('span', { class: 'xs b muted' }, RT[k].name), h('span', { class: 'kv' }, ctx.util.fmt(RT[k].work(n), RT[k].work(n) % 1 ? 1 : 0)), h('span', { class: 'xs muted' }, 'units on battery'))));  // each card: runtime name, total work so far (one decimal if needed) and the unit
          const d = RT.dalvik.work(n), a = RT.aot.work(n), y = RT.hyb.work(n);  // d, a and y are the work totals for Dalvik, ART AOT and hybrid at the chosen launch count
          const p1 = n === 0 ? 'Just installed: ART AOT has already spent 12 units compiling; the others spent 1.'  // verdict, first part: right after install, AOT has already spent 12 units...
            : n < 3 ? `After ${n} launch${n > 1 ? 'es' : ''}, Dalvik has still done less work (${d}) than pure AOT (${a}): the big install cost has not been repaid yet.`  // ...before launch 3, Dalvik is still ahead because AOT's install cost is not yet repaid...
              : `After ${n} launches, AOT has done ${d - a} units less work than Dalvik, and the gap grows by 4 units every launch.`;  // ...after that, AOT saves 4 units per launch compared with Dalvik
          const p2 = n === 0 ? '' : n < 13 ? ` Hybrid (${ctx.util.fmt(y, y % 1 ? 1 : 0)}) is lowest so far: quick install, then compiled while charging.`  // verdict, second part: up to 12 launches, hybrid has done the least work...
            : n === 13 ? ' Hybrid and pure AOT are now level.' : ' Pure AOT now edges ahead of hybrid (it compiled everything), but hybrid kept installs fast and storage small.';  // ...at 13 launches hybrid and AOT are level, and after that AOT edges ahead but hybrid kept installs fast
          verdict.innerHTML = p1 + p2;  // shows both parts of the verdict under the chart
        }  // ends drawChart()
        const seg = ctx.ui.seg([{ value: 'dalvik', label: 'Dalvik VM' }, { value: 'aot', label: 'ART AOT' }, { value: 'hyb', label: 'ART hybrid' }], sel, (v) => { sel = v; paintLeft(); drawChart(); });  // buttons to pick a runtime; picking one refreshes the description, table and chart
        const slider = ctx.ui.slider({ label: 'Times opened', min: 0, max: NMAX, value: n, onInput: (v) => { n = v; drawChart(); } });  // slider for how many times the app has been opened (0 to 30); moving it redraws the chart
        el.append(h('div', { class: 'stack fill', style: { gap: '12px' } },  // the step layout: the pipeline across the top and two columns underneath
          pipe,  // the build pipeline row
          h('div', { class: 'split grow' },  // two columns that take the rest of the height
            h('div', { class: 'stack', style: { gap: '8px' } }, h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'Pick a runtime'), seg), what, tbl,  // left column: heading with the runtime picker, then the description card and the table...
              h('p', { class: 'small m0', html: '<b>Bytecode</b> (the <span class="t" data-t="Dalvik executable">.dex</span> file) is portable code no processor can run directly. An <b>interpreter</b> performs it step by step on every run (slow); a <b>compiler</b> turns it into machine code once. Dalvik and ART differ only in <b>when</b> they compile.' })),  // ...and a paragraph explaining bytecode, interpreters and compilers: the runtimes differ only in when they compile
            h('div', { class: 'card white stack', style: { gap: '8px' } },  // right column: a white card holding...
              h('h4', { class: 'm0' }, 'Processor work on battery (illustrative units)'), chart, slider, readout, verdict))));  // ...the chart title, the chart, the slider, the readouts and the verdict
        paintLeft(); drawChart();  // fills the description, table and chart for the first time
      },  // ends render() for step 5
    },  // ends step 5

    /* ---------------- 6. Activities and the back stack: a working phone ---------------- */
    {  // step 6 begins: a working model phone that shows activities and the back stack
      title: 'Activities and the back stack: drive the phone',  // step title shown in the header
      kind: 'explore',  // kind "explore": the header labels this as an exploration
      render(el, ctx) {  // render(el, ctx): builds the phone and its back stack each time this step is shown
        const { h } = ctx;  // this step builds only ordinary page elements, so it needs just h
        const MSG = [  // MSG: the three sample emails in the phone's inbox
          { from: 'Prof. Diaz', subj: 'Lab moved to Friday', body: 'Hi all, this week\'s OS lab moves to Friday at 10:00 in room 214. Bring a charged laptop.' },  // sample email 1: an instructor moving the lab (the one the reply answers)
          { from: 'Campus IT', subj: 'Password expires soon', body: 'Your campus password expires in 5 days. Change it from the student portal.' },  // sample email 2: an IT notice about a password
          { from: 'Sam', subj: 'Photos from the hike', body: 'Great hike on Saturday! Send me your photos when you get a chance.' },  // sample email 3: a friend asking for hike photos
        ];  // closes MSG
        const ACT = { inbox: ['Inbox', 'Email'], read: ['Read message', 'Email'], compose: ['Compose', 'Email'], picker: ['Pick a photo', 'Gallery'] };  // ACT: the four kinds of activity as [screen title, app it belongs to]; the photo picker belongs to Gallery
        const APPC = { Email: 'proc', Gallery: 'accent' };  // APPC: the colour name for each app, used on screen bars and stack cards
        let stack = [], home = false, log = [];  // stack is the back stack (last item = top), home says whether the home screen is showing, log lists recent actions
        const screen = h('div', { class: 'ph-screen' });  // the phone's screen area; drawScreen() fills it
        const stackEl = h('div', { class: 'bs-stack' });  // the back stack drawing beside the phone
        const logEl = h('div', { class: 'log bs-log' });  // the action log under the stack
        const depth = h('span', { class: 'chip accent' });  // chip showing how many activities are on the stack
        const say = (m) => { log.push(m); if (log.length > 40) log.shift(); };  // say(m): adds a line to the log, keeping only the latest 40
        function push(id, data, why) { stack.push({ id, data: data || {} }); home = false; say(`<b>push</b> ${ACT[id][0]} <span class="muted">(${ACT[id][1]})</span>: ${why}`); paint(); }  // push(id, data, why): starts an activity on top of the stack, leaves the home screen, logs why and redraws
        function pop(why) {  // pop(why): removes the top activity, logs why, and redraws
          const top = stack.pop();  // top is the activity just removed
          say(`<b>pop</b> ${ACT[top.id][0]}: ${why}`);  // logs the pop and its reason
          if (!stack.length) { home = true; say('Back stack empty, so the <b>home screen</b> shows.'); }  // if the stack is now empty, the home screen shows and the log says so
          paint();  // redraws the phone and the stack
          return top;  // returns the removed activity so a caller can use it
        }  // ends pop()
        function back() {  // back(): runs when the phone's Back button is pressed
          if (home) { ctx.toast('Already on the home screen.'); return; }  // on the home screen, Back does nothing but show a short pop-up note
          if (!stack.length) return;  // nothing to remove if the stack is empty
          pop('you pressed Back');  // otherwise removes the top activity
        }  // ends back()
        function goHome() {  // goHome(): runs when the phone's Home button is pressed
          if (home) return;  // nothing to do if already home
          home = true;  // shows the home screen without touching the stack
          say('<b>Home</b>: the Email task moves to the background. Its back stack is <b>kept</b>.');  // logs that the Email task moved to the background with its back stack kept
          paint();  // redraws
        }  // ends goHome()
        function openEmail() {  // openEmail(): runs when the Email icon on the home screen is tapped
          if (stack.length) { home = false; say(`Email icon: the task returns with its stack intact; <b>${ACT[stack[stack.length - 1].id][0]}</b> is on screen again.`); paint(); }  // if the task still has activities, it comes back to the front exactly as it was left
          else push('inbox', null, 'launching Email starts its first activity');  // otherwise launching Email pushes its first activity, the inbox
        }  // ends openEmail()
        const btn = (label, fn, cls) => h('button', { class: 'btn sm ' + (cls || ''), type: 'button', onclick: fn }, label);  // btn(label, fn, cls): makes a small button for the phone screen that runs fn when tapped
        function drawScreen() {  // drawScreen(): draws whatever the phone shows now: the home screen or the top activity
          screen.innerHTML = '';  // empties the screen first
          if (home) {  // home screen case:
            const icons = [['Email', 'proc', openEmail], ['Gallery', 'accent', null], ['Maps', 'mem', null], ['Music', 'io', null], ['Phone', 'ok', null], ['Camera', 'cpu', null]];  // the six app icons as [name, colour, what tapping does]; only Email opens, the others are for show
            screen.append(h('div', { class: 'ph-bar home' }, 'Home screen'),  // a grey title bar reading "Home screen"
              h('div', { class: 'ph-home' }, ...icons.map(([n, c, fn]) => h('button', { class: 'ph-icon', type: 'button', disabled: !fn, onclick: fn || null },  // the grid of icon buttons; icons with nothing to open are disabled
                h('span', { class: 'ph-ico', style: { background: `var(--${c})` } }, n[0]), h('span', { class: 'xs' }, n)))),  // each icon: a coloured square with the app's first letter, and the app name under it
              h('p', { class: 'xs muted center m0' }, stack.length ? 'Email is still in the background. Tap it.' : 'Tap Email to launch it.'));  // a hint under the icons: Email is waiting in the background, or tap it to launch it
            return;  // stops here; the home screen needs nothing else
          }  // ends the home screen case
          const top = stack[stack.length - 1];  // top is the activity on top of the stack, the one on screen
          const [title, app] = ACT[top.id];  // its screen title and the app it belongs to
          const bar = h('div', { class: 'ph-bar', style: { background: `var(--${APPC[app]}-bg)`, color: `var(--${APPC[app]})` } }, h('b', {}, title), h('span', { class: 'xs' }, app + ' app'));  // the screen's title bar, tinted in its app's colour, with the title on the left and the app name on the right
          const body = h('div', { class: 'ph-body' });  // the screen's main area
          if (top.id === 'inbox') {  // inbox screen:
            MSG.forEach((m, i) => body.append(h('button', { class: 'ph-msg', type: 'button', onclick: () => push('read', { m: i }, 'you opened a message') }, h('b', {}, m.from), h('span', {}, m.subj))));  // one button per email; tapping it pushes a "Read message" activity for that email
            body.append(h('div', { class: 'grow' }), btn('+ Compose', () => push('compose', { reply: null }, 'you tapped Compose'), 'primary'));  // a spacer, then a Compose button that pushes a blank Compose activity
          } else if (top.id === 'read') {  // read-message screen:
            const m = MSG[top.data.m];  // m is the email being read
            body.append(h('div', { class: 'xs muted' }, 'From ' + m.from), h('b', {}, m.subj), h('p', { class: 'small m0' }, m.body), h('div', { class: 'grow' }),  // shows the sender, subject and body, then a spacer...
              btn('↩ Reply', () => push('compose', { reply: top.data.m }, 'you tapped Reply'), 'primary'));  // ...and a Reply button that pushes a Compose activity addressed to this sender
          } else if (top.id === 'compose') {  // compose screen:
            const r = top.data.reply;  // r is the email being replied to, or null for a new message
            body.append(h('div', { class: 'ph-field' }, 'To: ' + (r == null ? '' : MSG[r].from)), h('div', { class: 'ph-field' }, 'Subject: ' + (r == null ? '' : 'Re: ' + MSG[r].subj)),  // To and Subject fields, filled in when replying
              h('div', { class: 'ph-field grow' }, r == null ? 'Write your message…' : 'Thanks, see you Friday!'),  // the message body field, pre-filled with a short reply when replying
              h('div', { class: 'xs b', style: { color: top.data.photos ? 'var(--ok)' : 'var(--muted)' } }, top.data.photos ? `✓ ${top.data.photos} photo${top.data.photos > 1 ? 's' : ''} attached` : 'No attachments'),  // a line saying how many photos are attached, in green once there is at least one
              h('div', { class: 'row gap-s' }, btn('Attach photo', () => push('picker', null, 'Compose asked the Gallery app for a photo')), btn('Send', () => { pop('Compose finishes itself after sending'); ctx.toast('Message sent'); }, 'primary')));  // Attach photo pushes the Gallery's picker; Send pops Compose off the stack and shows "Message sent"
          } else if (top.id === 'picker') {  // photo picker screen:
            body.append(h('p', { class: 'xs muted m0' }, 'This screen belongs to a different app, yet it sits on Email\'s back stack.'),  // a note that this screen belongs to another app yet sits on Email's back stack
              h('div', { class: 'ph-grid' }, ...['cpu', 'mem', 'io', 'os', 'proc', 'thread'].map((c, i) => h('button', { class: 'ph-photo', type: 'button', 'aria-label': 'Photo ' + (i + 1), style: { background: `var(--${c})` },  // six coloured photo tiles in a grid...
                onclick: () => { pop('the picker finishes and returns the chosen photo'); const t = stack[stack.length - 1]; if (t && t.id === 'compose') { t.data.photos = (t.data.photos || 0) + 1; paint(); } } }))));  // ...tapping one pops the picker and adds one photo to the Compose screen underneath
          }  // ends the screen cases
          screen.append(bar, body);  // puts the title bar and main area on the screen
        }  // ends drawScreen()
        function paint() {  // paint(): redraws the phone, the depth chip, the stack cards and the log after every action
          drawScreen();  // redraws the phone screen
          depth.textContent = `depth ${stack.length}`;  // updates the depth chip
          stackEl.replaceChildren(...(stack.length ? stack.slice().reverse().map((a, k) => {  // redraws the stack from the top down (a reversed copy), or shows the empty placeholder
            const [title, app] = ACT[a.id];  // title and app of this stack entry
            const top = k === 0;  // top is true for the first card, the activity on top
            return h('div', { class: 'bs-card' + (top && !home ? ' top fade-in' : ''), style: { '--ac': `var(--${APPC[app]})`, '--acb': `var(--${APPC[app]}-bg)` } },  // the card, coloured by its app; the top card is highlighted while it is on screen
              h('div', {}, h('b', {}, title), ' ', h('span', { class: 'xs muted' }, app + ' app')),  // the card's left side: activity title and app name
              h('span', { class: 'xs b', style: { color: top && !home ? 'var(--ok)' : 'var(--muted)' } }, top ? (home ? 'top, in background' : '▶ on screen') : 'stopped, waiting'));  // the card's right side: its state, "on screen", "top, in background" or "stopped, waiting"
          }) : [h('div', { class: 'bs-empty small muted' }, 'Empty: no activities in this task.')]));  // placeholder shown when the stack is empty
          logEl.innerHTML = log.map((l) => `<div>${l}</div>`).join('');  // writes every log line into the log box
          logEl.scrollTop = logEl.scrollHeight;  // scrolls the log to its end so the newest action is visible
        }  // ends paint()
        const phone = h('div', { class: 'phone' }, h('div', { class: 'ph-status' }, h('span', {}, '9:41'), h('span', {}, '▮▮▮ 82%')), screen,  // the phone: status bar with time and battery, then the screen...
          h('div', { class: 'ph-nav' }, h('button', { type: 'button', class: 'ph-navb', 'aria-label': 'Back', onclick: back }, '◁ Back'), h('button', { type: 'button', class: 'ph-navb', 'aria-label': 'Home', onclick: goHome }, '○ Home')));  // ...then the navigation bar with Back and Home buttons
        const left = h('div', { class: 'stack', style: { gap: '10px' } },  // left column: the explanation of activities and the back stack
          h('p', { class: 'm0', html: 'An <span class="t">activity</span> is one screen of an app with one focused job. An email app might have three: the inbox, a message reader and a compose screen.' }),  // notes paragraph: an activity is one focused screen of an app
          h('p', { class: 'm0', html: 'The framework\'s <span class="t">activity manager</span> keeps the activities you open for one job (a <b>task</b>) in a <span class="t">back stack</span>. Starting one <b>pushes</b> it on top; <b>Back</b> pops the top one and the screen beneath returns.' }),  // notes paragraph: the activity manager keeps a task's activities on a back stack; push to start, pop on Back
          h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'An activity is not an app or a process. One app has several activities, and one back stack can hold screens from <b>different</b> apps: attach a photo and see.' }),  // common mistake box: an activity is not an app, and one stack can mix screens from different apps
          h('div', { class: 'callout why m0 small', 'data-label': 'Why it matters', html: 'A phone shows one screen at a time. Because the OS, not each app, keeps this history, Back works the same way everywhere, even across apps. (Section 4.7 shows what happens to stopped activities.)' }));  // why-it-matters box: the OS keeps the history, so Back behaves the same in every app
        const right = h('div', { class: 'stack', style: { gap: '8px', minHeight: 0 } },  // right column: the back stack drawing and the action log
          h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'Back stack (top first)'), depth),  // header row: "Back stack (top first)" with the depth chip
          stackEl, h('h4', { class: 'm0' }, 'What just happened'), logEl,  // then the stack cards, a "What just happened" heading and the action log
          h('div', { class: 'callout tip m0 small', 'data-label': 'Try this', html: 'Open the first message → <b>Reply</b> → <b>Attach photo</b>. Four activities from two apps are now stacked. Press <b>Back</b> twice and count what is left. Then press <b>Home</b> and tap Email again.' }));  // try-this box: a sequence of taps that stacks four activities from two apps, then Back, Home and Email again
        el.append(h('div', { class: 'act-grid fill' + (ctx.narrow ? ' nar' : '') }, left, h('div', { style: { display: 'grid', placeItems: 'center' } }, phone), right));  // lays out the three columns (text, phone centred, stack); one column on a phone-width screen
        push('inbox', null, 'you launched Email, which starts its first activity');  // starts the model phone with Email open at its inbox, as if the student had just launched it
      },  // ends render() for step 6
    },  // ends step 6

    /* ---------------- 7. Power lab: alarms and wakelocks over one hour ---------------- */
    {  // step 7 begins: a lab that runs a phone for one simulated hour with alarms and wakelocks
      title: 'Power lab: sleep, alarms and wakelocks',  // step title shown in the header
      kind: 'lab',  // kind "lab": the header labels this as a hands-on lab
      core: true, // on the shorter core path
      render(el, ctx) {  // render(el, ctx): builds the power lab each time this step is shown
        const { h, s } = ctx;  // h builds page elements and s builds SVG drawing elements
        // One simulated hour, minute by minute. At 0:00 you start downloading an album in a music app and put the
        // phone down. The screen times out after 1 minute. The download needs 10 minutes of awake time.
        // Illustrative drain (% of battery per minute): asleep 0.01; awake processor 0.10; radio downloading +0.15;
        // screen dim +0.20; screen bright +0.50; keyboard light +0.05.
        const TIMEOUT = 1, NEED = 10, ALARM_AT = 45, MIN = 60;  // the lab's fixed numbers: screen timeout 1 minute, download needs 10 awake minutes, alarm at minute 45, 60 minutes in all
        const LOCKS = {  // LOCKS: the wakelock choices the student can pick, each with a button label and a tooltip
          none: { label: 'None', desc: 'The app holds no wakelock.' },  // no wakelock at all
          partial: { label: 'Partial', desc: 'Processor on; screen and keyboard light may turn off.' },  // partial wakelock: keeps only the processor awake
          dim: { label: 'Screen dim', desc: 'Processor on; screen kept on but dimmed.' },  // screen dim wakelock: processor on and the screen kept on but dimmed
          bright: { label: 'Screen bright', desc: 'Processor on; screen kept at full brightness.' },  // screen bright wakelock: processor on and the screen kept fully bright
          full: { label: 'Full', desc: 'Processor on; screen bright; keyboard light on.' },  // full wakelock: processor, bright screen and keyboard light all on
        };  // closes LOCKS
        let lock = 'partial', forget = false, alarm = true, t = 0, timer = null;  // the lab's settings: which wakelock, whether the app forgets to release it, whether the alarm is set, current minute t, play timer
        function simulate(o) {   // o = { lock, forget }; the alarm setting is shared
          const rows = []; let done = 0, finish = null, used = 0;  // rows collects each minute's state; done counts download minutes, finish is when it completed, used is battery spent
          const lk = o.lock;  // lk is the wakelock type being simulated
          for (let m = 0; m < MIN; m++) {  // steps through the 60 minutes
            const held = lk !== 'none' && (o.forget || finish === null);  // the wakelock is held if one was chosen and either the app forgot to release it or the download is not finished
            const alarmNow = alarm && m === ALARM_AT;  // alarmNow is true at the alarm minute if the alarm is switched on
            let screen = 'off';  // the screen starts each minute off...
            if (m < TIMEOUT || alarmNow) screen = 'bright';  // ...it is bright during the first minute (before the timeout) and when the alarm fires
            else if (held && (lk === 'bright' || lk === 'full')) screen = 'bright';  // ...or bright while a bright or full wakelock is held
            else if (held && lk === 'dim') screen = 'dim';  // ...or dim while a screen-dim wakelock is held
            const kbd = held && lk === 'full';  // the keyboard light is on only under a full wakelock
            const awake = screen !== 'off' || held;  // the phone is awake if the screen is on or a wakelock is held
            const dl = awake && finish === null;  // the download makes progress only while the phone is awake and the download is unfinished
            if (dl) { done++; if (done === NEED) finish = m + 1; }  // counts a download minute and records the finish time when the tenth one is reached
            const drain = (awake ? 0.10 : 0.01) + (dl ? 0.15 : 0) + (screen === 'bright' ? 0.5 : screen === 'dim' ? 0.2 : 0) + (kbd ? 0.05 : 0);  // this minute's battery drain: asleep or awake processor, plus radio, screen and keyboard light when in use
            used += drain;  // adds the drain to the running total
            rows.push({ m, screen, awake, held, kbd, dl, alarmNow, done, used });  // saves this minute's full state for the drawing and the narration
          }  // ends the minute loop
          return { rows, finish, used };  // returns the minute rows, the finish time (or null) and the total battery used
        }  // ends simulate()
        const mmss = (m) => `0:${String(m).padStart(2, '0')}`;  // mmss(m): writes a minute as a clock time, such as 0:05
        const wlTable = `<table class="tbl compact wl-tbl"><tr><th>Type</th><th>Processor</th><th>Screen</th><th>Keyboard</th></tr>${/* wlTable: HTML for a small table of the four wakelock types; header row names the columns */''}
          <tr><td class="b">Partial</td><td>on</td><td>off</td><td>off</td></tr>${/* table row: a partial wakelock keeps the processor on, screen and keyboard off */''}
          <tr><td class="b">Screen dim</td><td>on</td><td>dim</td><td>off</td></tr>${/* table row: a screen-dim wakelock adds a dim screen */''}
          <tr><td class="b">Screen bright</td><td>on</td><td>bright</td><td>off</td></tr>${/* table row: a screen-bright wakelock keeps the screen bright */''}
          <tr><td class="b">Full</td><td>on</td><td>bright</td><td>bright</td></tr></table>`;  // table row: a full wakelock also keeps the keyboard light on; end of the table text
        const left = h('div', { class: 'stack', style: { gap: '9px' } },  // left column: the explanation of sleep, alarms and wakelocks
          h('p', { class: 'small m0', html: 'Asleep, a phone\'s screen is off and its processor suspended, drawing almost nothing. Goal: sleep as much as possible <b>without missing work</b>. Android adds two features to Linux:' }),  // notes paragraph: a sleeping phone draws almost nothing; the goal is to sleep without missing work
          h('div', { class: 'card tight small', html: '<b style="color:var(--intr)">Alarms.</b> An app asks the AlarmManager for work at a set time. The kernel sets the <span class="t" data-t="Alarm">alarm</span> in a hardware timer that keeps running in sleep, so it can <b>wake</b> the device.' }),  // card: alarms, set through the AlarmManager in a hardware timer that can wake the device
          h('div', { class: 'card tight small stack', style: { gap: '6px' }, html: '<div><b style="color:var(--os)">Wakelocks.</b> An app that must keep working holds a <span class="t">wakelock</span>, requested from the framework\'s power manager; the phone may sleep only when <b>no</b> wakelock is held. Four classic types:</div>' + wlTable }),  // card: wakelocks, and the phone may sleep only when none is held, followed by the table of types
          h('div', { class: 'callout warn m0 small', 'data-label': 'Common mistake', html: 'Forgetting to release a wakelock keeps the phone awake for nothing: a classic battery-drain bug.' }));  // common mistake box: forgetting to release a wakelock drains the battery
        // ---- timeline drawing
        const NW = ctx.narrow, VW = NW ? 400 : 712;   // phones get a narrower drawing so its text stays readable
        const X0 = NW ? 76 : 100, X1 = VW - 12, PX = (X1 - X0) / MIN;  // the timeline's left edge (after the row labels), right edge, and width of one minute
        const RY = { screen: 6, cpu: 36, lock: 66, dl: 96 }, RH = 22, BT = 132, BB = 232;  // the top of each timeline row, the row height, and the top and bottom of the battery chart
        const by = (b) => BB - ((b - 50) / 50) * (BB - BT);  // by(b): converts a battery percentage (50 to 100) into a height in the battery chart
        const svg = s('svg', { viewBox: `0 0 ${VW} 258`, width: '100%', style: { display: 'block' } });  // the SVG drawing for the timeline and battery chart
        function segs(rows, key) {   // merge consecutive minutes with the same value
          const out = []; rows.forEach((r) => { const v = key(r); const last = out[out.length - 1]; if (last && last.v === v) last.b = r.m + 1; else out.push({ v, a: r.m, b: r.m + 1 }); });  // walks the minutes, stretching the last segment while the value stays the same and starting a new one when it changes
          return out;  // returns the list of segments as {value, first minute, end minute}
        }  // ends segs()
        function bar(y, sg, style, text) {  // bar(y, sg, style, text): draws a row of coloured segments at height y; style and text depend on each segment's value
          return sg.map((g) => { const x = X0 + g.a * PX, w = (g.b - g.a) * PX; const st = style(g.v); const tx = text(g.v);  // for each segment, works out its position and width and asks for its style and label
            if (!st) return null;  // a segment with no style (such as "off") is left blank
            return s('g', {}, s('rect', { x, y, width: w, height: RH, rx: 3, style: st }), tx && w > tx.length * 7.5 + 8 ? s('text', { x: x + w / 2, y: y + 15.5, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 700 }, tx) : null); }).filter(Boolean);  // draws the segment and, only if it is wide enough, its label centred inside it
        }  // ends bar()
        function drawSvg(sim) {  // drawSvg(sim): redraws the whole timeline and battery chart for one simulation result
          const k = [];  // k collects the drawing's shapes
          [['Screen', RY.screen], ['Processor', RY.cpu], ['Wakelock', RY.lock], ['Download', RY.dl]].forEach(([l, y]) => {  // for each of the four rows (screen, processor, wakelock, download)...
            k.push(s('text', { x: 0, y: y + 16, 'font-size': 13.5, 'font-weight': 700 }, l), s('rect', { x: X0, y, width: X1 - X0, height: RH, rx: 4, style: 'fill:var(--panel-3)' }));  // ...draws its label on the left and a grey track across the timeline
          });  // ends the row loop
          k.push(...bar(RY.screen, segs(sim.rows, (r) => r.screen), (v) => (v === 'bright' ? 'fill:var(--hl);stroke:var(--warn)' : v === 'dim' ? 'fill:color-mix(in srgb, var(--hl) 40%, var(--panel-3));stroke:var(--warn);stroke-dasharray:4 3' : ''), (v) => (v === 'off' ? '' : v)));  // screen row: yellow when bright, paler and dashed when dim, blank when off
          k.push(...bar(RY.cpu, segs(sim.rows, (r) => r.awake), (v) => (v ? 'fill:var(--cpu-bg);stroke:var(--cpu)' : ''), (v) => (v ? 'awake' : '')));  // processor row: blue segments while awake
          k.push(...bar(RY.lock, segs(sim.rows, (r) => r.held), (v) => (v ? 'fill:var(--os-bg);stroke:var(--os)' : ''), (v) => (v ? 'held' : '')));  // wakelock row: segments while a wakelock is held
          k.push(...bar(RY.dl, segs(sim.rows, (r) => r.dl), (v) => (v ? 'fill:var(--io-bg);stroke:var(--io)' : ''), (v) => (v ? 'downloading' : '')));  // download row: segments while the download is running
          if (!sim.rows[MIN - 1].awake) k.push(s('text', { x: X1 - 6, y: RY.cpu + 15.5, 'text-anchor': 'end', 'font-size': 12.5, class: 's-sub' }, 'asleep'));  // if the phone ends the hour asleep, the processor row says "asleep" at its right end
          if (!sim.rows[MIN - 1].held) k.push(s('text', { x: X1 - 6, y: RY.lock + 15.5, 'text-anchor': 'end', 'font-size': 12.5, class: 's-sub' }, 'none held'));  // if no wakelock is held at the end, the wakelock row says "none held"
          const pct = Math.round((sim.rows[MIN - 1].done / NEED) * 100);  // pct is how much of the download finished within the hour
          k.push(s('text', { x: X1 - 6, y: RY.dl + 15.5, 'text-anchor': 'end', 'font-size': 12.5, 'font-weight': 800, style: `fill:var(--${pct === 100 ? 'ok' : 'bad'})` }, NW ? pct + '%' : pct + '% by 1:00'));  // the download row's right end shows that percentage, green if complete and red if not
          // battery chart
          k.push(s('text', { x: 0, y: NW ? by(62.5) + 5 : (BT + BB) / 2 + 5, 'font-size': 13.5, 'font-weight': 700 }, 'Battery'));   // on phones, keep clear of the 75% tick label
          [100, 75, 50].forEach((b) => k.push(s('line', { x1: X0, x2: X1, y1: by(b), y2: by(b), class: 's-muted', 'stroke-width': 1 }), s('text', { x: X0 - 6, y: by(b) + 4, 'text-anchor': 'end', 'font-size': 12.5, class: 's-sub' }, b + '%')));  // grid lines for 100%, 75% and 50% battery, each labelled on the left
          const pts = [`${X0},${by(100)}`].concat(sim.rows.map((r) => `${X0 + (r.m + 1) * PX},${by(100 - r.used)}`));  // the battery line's points: starting at 100% and dropping by the battery used after each minute
          k.push(s('polyline', { points: pts.join(' '), fill: 'none', style: 'stroke:var(--ok)', 'stroke-width': 3, 'stroke-linejoin': 'round' }));  // draws the battery line in green
          for (let m = 0; m <= MIN; m += NW ? 20 : 10) k.push(s('text', { x: X0 + m * PX, y: 252, 'text-anchor': 'middle', 'font-size': 12.5, class: 's-sub' }, m === 60 ? '1:00' : mmss(m)));  // clock labels under the timeline every 10 minutes (every 20 on a phone-width screen)
          if (alarm) k.push(s('line', { x1: X0 + ALARM_AT * PX, x2: X0 + ALARM_AT * PX, y1: 2, y2: BB, style: 'stroke:var(--intr)', 'stroke-width': 2, 'stroke-dasharray': '5 4' }),  // if the alarm is on, a dashed vertical line at minute 45...
            s('text', { x: X0 + ALARM_AT * PX - 5, y: BB - 6, 'text-anchor': 'end', 'font-size': 12.5, 'font-weight': 800, style: 'fill:var(--intr)' }, NW ? 'alarm' : 'alarm 0:45'));  // ...labelled "alarm"
          if (sim.finish) k.push(s('line', { x1: X0 + sim.finish * PX, x2: X0 + sim.finish * PX, y1: RY.dl, y2: BB, style: 'stroke:var(--ok)', 'stroke-width': 1.5, 'stroke-dasharray': '3 3' }),  // if the download finished, a dashed line at the finish time...
            s('text', { x: X0 + sim.finish * PX + 5, y: BB - 6, 'font-size': 12.5, 'font-weight': 800, style: 'fill:var(--ok)' }, NW ? 'done' : `download done ${mmss(sim.finish)}`));  // ...labelled with when it finished
          const rem = t === 0 ? 100 : 100 - sim.rows[t - 1].used;  // rem is the battery left at the current minute t of the playback
          k.push(s('line', { x1: X0 + t * PX, x2: X0 + t * PX, y1: 0, y2: BB + 4, style: 'stroke:var(--ink)', 'stroke-width': 2 }),  // a solid vertical line marking the current minute...
            s('circle', { cx: X0 + t * PX, cy: by(rem), r: 5.5, style: 'fill:var(--ok);stroke:var(--panel)', 'stroke-width': 2 }));  // ...and a dot on the battery line at that minute
          svg.replaceChildren(...k);  // puts all the shapes into the drawing at once
        }  // ends drawSvg()
        // ---- narration + readout for the moment under the playhead
        const narr = h('div', { class: 'wl-narr' });  // narr is the box that narrates the current minute in words
        const chips = h('div', { class: 'row gap-s' });  // row of status chips for the current minute (time, screen, processor, wakelock, download, battery)
        const mini = h('div', { class: 'wl-mini' });  // mini is the tiny phone icon that shows the screen's state at the current minute
        function narrate(sim) {  // narrate(sim): returns the narration text for the current minute, or a verdict once the hour is over
          const fin = sim.finish;  // fin is the minute the download finished, or null
          if (t >= MIN) {  // after the last minute, sum up the whole hour:
            const pct = Math.round((sim.rows[MIN - 1].done / NEED) * 100);  // pct is how much of the download finished
            const base = simulate({ lock: 'partial', forget: false });  // base runs the ideal case (partial wakelock, released on time) to compare battery use against
            const ratio = sim.used / base.used;  // ratio is how many times more battery this run used than the ideal case
            const verdict = lock === 'none' ? 'Cheapest, but the job never finished. Sleeping too eagerly is a failure too.'  // verdict for no wakelock: cheapest, but the download never finished
              : forget ? `The same work as a partial wakelock released on time, but ${ctx.util.fmt(ratio, 1)}× the battery. Always release a wakelock as soon as the work is done.`  // verdict when the app forgot to release: same work as the ideal case but several times the battery
                : lock === 'partial' ? 'The best choice for background work: the job finished, then the phone slept.'  // verdict for a partial wakelock: the best choice, the job finished and the phone slept
                  : `The job finished, but keeping the screen on cost ${ctx.util.fmt(ratio, 1)}× the battery of a partial wakelock. Screen wakelocks are for things the user is watching.`;  // verdict for screen wakelocks: the job finished but the lit screen cost several times the battery
            return `<b>After one hour:</b> download ${fin ? 'finished at ' + mmss(fin) : 'only ' + pct + '% done'}, battery used <b>${ctx.util.fmt(sim.used, 2)}%</b>. ${verdict}`;  // the end-of-hour summary: when the download finished (or how far it got), battery used, and the verdict
          }  // ends the end-of-hour case
          const r = sim.rows[t];  // r is the state at the current minute
          const prev = t > 0 ? sim.rows[t - 1] : null;  // prev is the previous minute's state (none at minute 0)
          const pctNow = Math.round(((prev ? prev.done : 0) / NEED) * 100);  // pctNow is how much of the download was done by the start of this minute
          if (t < TIMEOUT) return `<b>${mmss(t)}.</b> You start downloading an album and put the phone down. The screen stays on for its 1-minute timeout; while the screen is on, Android itself keeps the phone awake.`;  // minute 0: the download starts and the screen's own timeout keeps the phone awake
          if (r.alarmNow) return `<b>${mmss(t)}.</b> The calendar alarm fires. The kernel's alarm timer wakes the phone${prev && !prev.awake ? ' even though it was asleep' : ''}, and the reminder lights the screen for a minute.${r.dl ? ' While the processor is awake any app can run, so the stalled download creeps forward too.' : ''}`;  // alarm minute: the kernel's timer wakes the phone and lights the screen; the download may creep forward too
          if (r.held && r.dl) return `<b>${mmss(t)}.</b> ` + {  // while a wakelock is held and the download runs, the narration depends on the wakelock type:
            partial: 'The screen has timed out, but the music app holds a <b>partial</b> wakelock, so the processor and radio keep downloading in the dark.',  // partial: only the processor and radio stay on, downloading with the screen off
            dim: 'The <b>screen dim</b> wakelock keeps the processor running and the screen on but dimmed: extra battery for no benefit to a download.',  // screen dim: the dim screen costs battery without helping the download
            bright: 'The <b>screen bright</b> wakelock keeps the screen at full brightness: the download works, but the screen is the biggest drain.',  // screen bright: the bright screen is the biggest drain
            full: 'The <b>full</b> wakelock keeps the processor, a bright screen and the keyboard light on: the most expensive choice.' }[lock];  // full: processor, bright screen and keyboard light, the most expensive choice
          if (r.held) return `<b>${mmss(t)}.</b> The download finished at ${mmss(fin)}, but the app <b>never released</b> its wakelock. The phone stays awake doing nothing.`;  // still held after the download finished: the app never released its wakelock, so the phone stays awake for nothing
          if (!r.awake && fin && t >= fin) return `<b>${mmss(t)}.</b> The download finished at ${mmss(fin)} and the app released its wakelock. Nothing holds the phone awake, so it sleeps and the battery line goes almost flat.`;  // asleep after finishing: the wakelock was released and the battery line goes nearly flat
          if (!r.awake) return `<b>${mmss(t)}.</b> No wakelock is held, so once the screen timed out Android suspended the phone. The download is frozen at ${pctNow}%, and the battery barely moves.`;  // asleep before finishing: no wakelock, so Android suspended the phone and the download froze
          return `<b>${mmss(t)}.</b> The processor is awake.`;  // any other case: the processor is simply awake
        }  // ends narrate()
        function paint() {  // paint(): reruns the simulation and redraws everything; runs after any setting change or time step
          const sim = simulate({ lock, forget });  // simulates the hour with the current settings
          drawSvg(sim);  // redraws the timeline and battery chart
          const r = sim.rows[Math.min(t, MIN - 1)];  // r is the state at the current minute (the last minute once the hour is over)
          const done = t === 0 ? 0 : sim.rows[t - 1].done;  // done is how many download minutes were completed before the current minute
          const rem = t === 0 ? 100 : 100 - sim.rows[t - 1].used;  // rem is the battery left at the current minute
          const live = t < MIN;  // live is true while the playback is still inside the hour
          mini.className = 'wl-mini ' + (live ? r.screen : 'off');  // sets the tiny phone icon to the screen's state (off after the hour ends)
          mini.textContent = live && !r.awake ? 'z z' : '';  // shows "z z" in the tiny phone while it sleeps
          const liveChips = live ? [  // status chips shown only during the hour:
            h('span', { class: 'chip ' + (r.screen === 'off' ? '' : 'warn') }, 'screen ' + r.screen),  // screen state, amber when the screen is on
            h('span', { class: 'chip ' + (r.awake ? 'cpu' : '') }, r.awake ? 'processor awake' : 'asleep'),  // processor awake or asleep
            h('span', { class: 'chip ' + (r.held ? 'os' : '') }, r.held ? 'wakelock held' : 'no wakelock')] : [];  // wakelock held or not
          chips.replaceChildren(  // rebuilds the chip row:
            h('span', { class: 'chip' }, t >= MIN ? '1:00' : mmss(t)),  // the current clock time
            ...liveChips,  // the three live chips
            h('span', { class: 'chip ' + (done >= NEED ? 'ok' : 'io') }, `download ${Math.round((done / NEED) * 100)}%`),  // download progress, green when complete
            h('span', { class: 'chip ok' }, `battery ${ctx.util.fmt(rem, 2)}%`));  // battery remaining
          narr.innerHTML = narrate(sim);  // fills in the narration for this moment
          forgetBtn.disabled = lock === 'none';  // the "forgets to release" button makes no sense with no wakelock, so it is disabled then
        }  // ends paint()
        function setT(v) { t = ctx.util.clamp(Math.round(v), 0, MIN); slider.set(t, false); paint(); }  // setT(v): jumps to minute v (kept between 0 and 60), moves the slider to match and redraws
        function stop() { if (timer) clearInterval(timer); timer = null; playBtn.textContent = '▶ Play the hour'; }  // stop(): stops playback and resets the Play button's label
        function play() {  // play(): starts or pauses the playback of the hour; runs when the Play button is pressed
          if (timer) { stop(); return; }  // if already playing, pressing the button pauses
          if (t >= MIN) setT(0);  // after the hour has ended, playback starts again from minute 0
          playBtn.textContent = '■ Pause';  // the button becomes a Pause button while playing
          timer = ctx.every(110, () => { setT(t + 1); if (t >= MIN) stop(); });  // advances one minute every 0.11 s and stops at the end; ctx.every cancels it if the student leaves the step
        }  // ends play()
        const seg = ctx.ui.seg(Object.keys(LOCKS).map((k) => ({ value: k, label: LOCKS[k].label, title: LOCKS[k].desc })), lock, (v) => { lock = v; if (v === 'none') { forget = false; forgetBtn.classList.remove('on'); forgetBtn.setAttribute('aria-pressed', 'false'); } paint(); });  // buttons to pick the wakelock type; choosing "None" also turns off the "forgets" option; then redraws
        const forgetBtn = h('button', { class: 'btn sm', type: 'button', 'aria-pressed': 'false', onclick: () => { forget = !forget; forgetBtn.classList.toggle('on', forget); forgetBtn.setAttribute('aria-pressed', String(forget)); paint(); } }, 'App forgets to release it');  // toggle button: the app forgets to release its wakelock; aria-pressed tells screen readers whether it is on
        const alarmBtn = h('button', { class: 'btn sm on', type: 'button', 'aria-pressed': 'true', onclick: () => { alarm = !alarm; alarmBtn.classList.toggle('on', alarm); alarmBtn.setAttribute('aria-pressed', String(alarm)); paint(); } }, 'Calendar alarm at 0:45');  // toggle button for the calendar alarm at 0:45, on at first
        const playBtn = h('button', { class: 'btn sm primary', type: 'button', onclick: play }, '▶ Play the hour');  // the Play button
        const slider = ctx.ui.slider({ label: 'Time', min: 0, max: MIN, value: 0, format: (v) => (v >= MIN ? '1:00' : mmss(v)), onInput: (v) => { stop(); setT(v); } });  // time slider from 0:00 to 1:00; dragging it stops playback and jumps to that minute
        const right = h('div', { class: 'stack', style: { gap: '8px' } },  // right column: controls, timeline, slider, status and narration stacked
          h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h4', { class: 'm0' }, 'Music app\'s wakelock'), seg),  // row: heading "Music app's wakelock" with the wakelock type buttons
          h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('div', { class: 'row gap-s' }, forgetBtn, alarmBtn), playBtn),  // row: the two toggle buttons on the left and the Play button on the right
          svg,  // the timeline and battery drawing
          slider,  // the time slider
          h('div', { class: 'row nw', style: { gap: '10px', alignItems: 'center' } }, mini, h('div', { style: { minWidth: 0 } }, chips)),  // row: the tiny phone icon beside the status chips
          narr);  // the narration box; ends the right column
        el.append(h('div', { class: 'wl-grid fill' + (ctx.narrow ? ' nar' : '') }, left, right));  // lays out the two columns (one column on a phone-width screen)
        paint();  // draws the lab for the first time at minute 0
      },  // ends render() for step 7
    },  // ends step 7

    /* ---------------- 8. Recap ---------------- */
    {  // step 8 begins: the recap
      title: 'Recap: six things to remember about Android',  // step title shown in the header
      kind: 'recap',  // kind "recap": the header labels this as a recap
      render(el, ctx) {  // render(el, ctx): builds the recap each time this step is shown
        const { h } = ctx;  // this step builds only ordinary page elements, so it needs just h
        const strip = (label, parts) => h('div', { class: 'rc-strip' }, h('span', { class: 'xs muted b rc-lab' }, label),  // strip(label, parts): builds one recap row: a label, then coloured boxes joined by arrows
          ...parts.flatMap(([t, c], i) => [i ? h('span', { class: 'rc-arr' }, '→') : null, h('span', { class: 'box ' + c }, t)]).filter(Boolean));  // each part becomes a box, with an arrow before every box except the first
        el.append(h('div', { class: 'stack fill', style: { gap: '12px' } },  // the recap layout: a card of two strips, a prompt, and the flip cards
          h('div', { class: 'card white stack', style: { gap: '8px' } },  // the white card holding the two strips
            strip('THE STACK, TOP DOWN', [['Applications', 'proc'], ['Application framework', 'accent'], ['System libraries + Android runtime', 'cpu'], ['Linux kernel', 'os']]),  // strip: the four parts of the stack from top to bottom
            strip('A REQUEST TRAVELS', [['App + framework', 'proc'], ['Binder IPC', 'accent'], ['System services', 'os'], ['HAL', ''], ['Kernel driver', 'io'], ['Hardware', 'io']])),  // strip: the path a request takes from the app to the hardware
          h('p', { class: 'm0 muted small' }, 'Say each answer out loud before you flip the card.'),  // a prompt to answer each card aloud before flipping it
          ctx.ui.flipcards([  // flip cards (click to turn a card over and see the answer):
            ['What is Android, and where did it come from?', 'A Linux-based OS first built for touchscreen phones and tablets. Android Inc. built it; Google bought it in 2005; it is open source (Open Handset Alliance) and now runs TVs, cars, watches and embedded devices.'],  // card: what Android is and where it came from
            ['Name the five layers of the software stack.', 'Applications; the application framework (the Java/Kotlin API of managers and content providers); native system libraries; the Android runtime; the Linux kernel.'],  // card: the five layers of the stack
            ['How does an app take a photo?', 'Framework proxy → Binder IPC → camera service (a system service) → camera HAL written by the vendor → camera driver in the kernel → sensor. The app never touches hardware.'],  // card: how an app takes a photo, hop by hop
            ['Dalvik vs ART?', 'Both run .dex bytecode. Dalvik interpreted it and redid its JIT compiling on every run. ART compiles ahead of time (all at install in 5.0–6.0; the hot code, while charging, since 7.0): faster launches and better battery, at the cost of compile time and storage.'],  // card: Dalvik versus ART
            ['Activity and back stack?', 'An activity is one screen of an app. Opening one pushes it onto the back stack; Back pops it. One stack can hold screens from several apps.'],  // card: activities and the back stack
            ['Alarm vs wakelock?', 'Android\'s two kernel power additions. An alarm wakes a sleeping device at a set time. A wakelock (partial, screen dim, screen bright, full) stops it sleeping while held.'],  // card: alarms versus wakelocks
          ], { cols: 3, height: 172 })));  // closes the card list, laid out in three columns of 172px-tall cards; closes the layout
      },  // ends render() for step 8
    },  // ends step 8

    /* ---------------- 9. Check yourself ---------------- */
    {  // step 9 begins: the self-check quiz for this section
      title: 'Check yourself: Android',  // step title shown in the header
      kind: 'check',  // kind "check": the header labels this as Check Yourself
      quiz: [  // quiz: the questions; the guide's quiz engine draws them, checks answers and saves the best score
        { q: 'Where did Android come from?',  // quiz question 1 (multiple choice): where Android came from
          choices: ['Google designed it from scratch in 2007 as part of Chrome OS', 'A start-up, Android Inc., created it, and Google bought the company in 2005', 'The Open Handset Alliance bought it from a phone maker in 2008', 'It is a phone edition of Windows NT that Google licensed'], answer: 1,  // the four choices; answer: 1 marks the second choice (counting from 0) as correct
          feedback: ['Google did not start it, and Chrome OS is a separate, later product. Google bought an existing start-up.', null, 'Google formed the alliance in 2007 to develop Android as an open platform; the alliance did not buy it from anyone.', 'Android is built on the Linux kernel, not on Windows NT.'],  // feedback shown for each wrong choice; null for the correct one
          why: 'Android Inc. was a small start-up. Google bought it in 2005, and in 2007 Google and the Open Handset Alliance unveiled Android as an open-source, Linux-based platform.' },  // explanation shown after answering: a start-up Google bought in 2005, announced in 2007
        { type: 'order', q: 'A camera app takes a photo. Put the layers the request passes through in order, starting from the app.',  // quiz question 2 (put in order): the layers a camera request passes through
          items: ['App and application framework', 'Binder IPC', 'Android system service (camera service)', 'Hardware abstraction layer (camera HAL)', 'Linux kernel (camera driver)'],  // the five layers, listed in the correct order; the quiz shuffles them for the student
          why: 'The framework proxy in the app sends the call through Binder to the camera service, which uses the vendor\'s camera HAL module, which drives the camera driver in the kernel.' },  // explanation: proxy, Binder, camera service, vendor HAL, kernel driver
        { type: 'bucket', q: 'Which layer of the Android software stack provides each component?',  // quiz question 3 (sort into groups): which layer provides each component
          buckets: ['Framework', 'Libraries', 'Runtime', 'Kernel'],  // the four groups to sort into
          items: [['Activity manager', 0], ['Surface manager', 1], ['SQLite', 1], ['ART', 2], ['Camera driver', 3], ['Wakelocks', 3]],  // the items, each paired with the number of its correct group
          why: 'Services apps call through the Java/Kotlin API are framework; native C/C++ helpers such as SQLite and the surface manager are system libraries; whatever executes app code (ART, with the core Java libraries) is the runtime; drivers and power management run in the kernel.' },  // explanation: the rule for telling framework, libraries, runtime and kernel apart
        { type: 'match', q: 'Match each application-framework component to its job.',  // quiz question 4 (match the pairs): framework components and their jobs
          pairs: [['Activity manager', 'Starts app screens and keeps the back stack'], ['Content providers', 'Share one app\'s data with other apps'], ['Package manager', 'Installs apps and records their permissions'], ['Resource manager', 'Supplies strings and layouts for the device\'s language and screen'], ['Location manager', 'Reports where the device is'], ['Notification manager', 'Shows alerts in the status bar']],  // the six component-and-job pairs
          why: 'Each manager owns one job and offers it to every app through the same API, which is why all apps behave consistently.' },  // explanation: each manager owns one job and offers it to every app the same way
        { q: 'What is the key difference between the Dalvik virtual machine and ART?',  // quiz question 5 (multiple choice): the key difference between Dalvik and ART
          choices: ['ART runs Java source code directly, while Dalvik ran machine code', 'ART compiles an app\'s .dex bytecode into machine code ahead of time (originally at install), while Dalvik translated it while the app ran', 'Dalvik compiled apps at install time, while ART compiles only while the app runs', 'ART dropped the .dex format, so apps now arrive from the store as machine code'], answer: 1,  // the four choices; the second is correct
          feedback: ['Neither runs source code: both start from .dex bytecode produced by the build tools.', null, 'That is backwards. Dalvik interpreted and compiled just in time; ART introduced ahead-of-time compilation.', 'Apps still ship as .dex bytecode, and ART compiles it on the device.'],  // feedback for each wrong choice
          why: 'Dalvik repeated its translation work (interpreting plus JIT) every time an app ran. ART does the translation ahead of time and stores the machine code, so launches are faster and each run costs less battery.' },  // explanation: Dalvik repeated its translation every run, ART does it ahead of time
        { type: 'multi', q: 'Compared with Dalvik, which were costs of ART\'s original compile-everything-at-install approach? Select all that apply.',  // quiz question 6 (select all that apply): the costs of compiling everything at install
          choices: ['Longer app installs', 'More storage used for compiled code', 'Slower app launches', 'Every app had to be recompiled after a system update', 'More battery used each time the app runs'], answer: [0, 1, 3],  // the five choices; answer lists the three correct ones (longer installs, more storage, recompiling after updates)
          why: 'Compiling everything up front takes time and space and must be redone when the OS changes. In exchange, launches are faster and each run needs less processor work, which saves battery. Later ART versions mix JIT and AOT to cut those costs.' },  // explanation: up-front compiling costs time and space but saves work on each run
        { type: 'tf', q: 'A wakelock is the Android feature that wakes a sleeping phone at a scheduled time.', answer: false,  // quiz question 7 (true or false): a wakelock wakes a sleeping phone; the answer is false
          why: 'That is an alarm. A wakelock does the opposite job: while an app holds one, the phone is not allowed to go to sleep.' },  // explanation: that describes an alarm; a wakelock keeps the phone from sleeping
        { q: 'A podcast app must keep downloading after the screen turns off, and nobody is looking at the phone. Which wakelock fits best?',  // quiz question 8 (multiple choice): which wakelock fits a background download
          choices: ['A full wakelock', 'A partial wakelock', 'A screen bright wakelock', 'No wakelock: downloads continue while the phone sleeps'], answer: 1,  // the four choices; the partial wakelock is correct
          feedback: ['A full wakelock also keeps the screen bright and the keyboard light on: wasted battery when nobody is watching.', null, 'This keeps the screen at full brightness, which a background download does not need.', 'A sleeping phone suspends its processor, so the download would freeze until something woke it.'],  // feedback for each wrong choice
          why: 'A partial wakelock keeps only the processor running and lets the screen turn off, exactly what background work needs. The app should release it as soon as the download finishes.' },  // explanation: a partial wakelock keeps only the processor on and should be released when done
        { type: 'num', q: 'A user opens the Email app\'s inbox, opens a message, taps Reply, then taps Attach photo, which opens the Gallery app\'s photo picker. They then press Back twice. How many activities are left on the back stack?',  // quiz question 9 (calculate): activities left on the back stack after two presses of Back
          answer: 2, tol: 0, unit: 'activities',  // the correct answer is 2 with no tolerance, measured in activities
          why: 'Four activities were pushed: inbox, message, compose, picker. Each Back pops one, so 4 − 2 = 2 remain: the message on top of the inbox.' },  // explanation: four pushes minus two pops
        { type: 'num', q: 'A phone uses 1% of its battery per hour while asleep, but 8% per hour while a partial wakelock keeps the processor awake. An app forgets to release its wakelock for 6 hours overnight. How many extra percentage points of battery does the bug cost?',  // quiz question 10 (calculate): the battery cost of a wakelock left on for six hours
          answer: 42, tol: 0, unit: 'points',  // the correct answer is 42 with no tolerance, in percentage points
          why: 'Awake: 6 × 8 = 48 points. Asleep it would have used 6 × 1 = 6 points. The bug costs 48 − 6 = 42 percentage points.' },  // explanation: 48 points awake minus the 6 it would have used asleep
        { type: 'tf', q: 'Because Android runs on Linux, an ordinary app can open the camera\'s device driver directly to take a picture.', answer: false,  // quiz question 11 (true or false): an app can open the camera driver directly; the answer is false
          why: 'Apps never talk to drivers. The request goes through the framework and Binder to the camera service, which uses the camera HAL, which talks to the driver. That path lets the service check permissions and share the camera among apps.' },  // explanation: requests go through the framework, Binder, the camera service and the HAL
        { q: 'Why does Android put a hardware abstraction layer (HAL) between its system services and the kernel drivers?',  // quiz question 12 (multiple choice): why Android has a HAL
          choices: ['So apps can reach hardware faster by skipping the kernel', 'So each vendor can implement standard interfaces for its own chips, keeping the services above identical on every device', 'Because the Linux kernel cannot run device drivers', 'To translate .dex bytecode into machine code'], answer: 1,  // the four choices; the second is correct
          feedback: ['Apps cannot call the HAL, and it does not bypass the kernel: it sits above the drivers.', null, 'Linux runs drivers perfectly well; the HAL sits on top of them.', 'That is the Android runtime\'s job, not the HAL\'s.'],  // feedback for each wrong choice
          why: 'Phone makers use different chips. By writing HAL modules for standard interfaces, they plug their hardware in without changing the services, and Android can be updated without rewriting their code.' },  // explanation: vendors implement standard interfaces, so the services never change
      ],  // closes the quiz list
    },  // ends step 9

  ],  // closes the steps list

  notes: `${/* notes: the section's reading notes as HTML text, shown in the side panel the Notes button opens */''}
    <h3>What Android is</h3>${/* notes heading: what Android is */''}
    <p><b>Android</b> is an operating system built on the <b>Linux kernel</b>, first designed for touchscreen mobile devices such as phones and tablets. It is the world's most widely used mobile OS. It began at a small start-up, <b>Android Inc.</b>, which <b>Google bought in 2005</b>. In 2007 Google and the <b>Open Handset Alliance</b> (phone makers, chip makers, carriers and software firms) announced it as an open platform; in 2008 the first Android phone went on sale and the <b>open-source</b> code was released. The same core now also runs TVs, cars, watches (Wear OS) and embedded or Internet-of-Things devices.</p>${/* notes paragraph: Android's origin, the alliance, open source and the devices it runs on */''}

    <h3>The software stack: five layers</h3>${/* notes heading: the five layers of the software stack */''}
    <p>This is the classic layout Android was designed with. Two of its parts belonged to early Android only: the XMPP service (removed early on) and the WebKit browser engine (later replaced by a Chromium-based web view).</p>${/* notes paragraph: this is the classic layout, and two parts were early Android only */''}
    <svg viewBox="0 0 520 176" width="520" height="176" role="img" aria-label="Android software stack">${/* a small SVG diagram of the stack in the notes, with fixed colours so it also prints well */''}
      <rect x="4" y="4" width="512" height="32" rx="6" fill="#d6f3f9" stroke="#0891b2"/><text x="260" y="25" text-anchor="middle" font-size="13" font-weight="700" fill="#151c2c">Applications (Java / Kotlin)</text>${/* diagram band: applications */''}
      <rect x="4" y="42" width="512" height="32" rx="6" fill="#e8e7fd" stroke="#4f46e5"/><text x="260" y="63" text-anchor="middle" font-size="13" font-weight="700" fill="#151c2c">Application framework (Java / Kotlin API)</text>${/* diagram band: application framework */''}
      <rect x="4" y="80" width="330" height="44" rx="6" fill="#f5f7fb" stroke="#69738c"/><text x="169" y="100" text-anchor="middle" font-size="13" font-weight="700" fill="#151c2c">System libraries (C / C++)</text><text x="169" y="116" text-anchor="middle" font-size="10.5" fill="#3d4760">surface mgr · OpenGL ES · media · SQLite · WebKit · Bionic</text>${/* diagram box: system libraries, with the main libraries listed under the name */''}
      <rect x="340" y="80" width="176" height="44" rx="6" fill="#e1eaff" stroke="#2563eb"/><text x="428" y="100" text-anchor="middle" font-size="13" font-weight="700" fill="#151c2c">Android runtime</text><text x="428" y="116" text-anchor="middle" font-size="11" fill="#3d4760">ART + core libraries</text>${/* diagram box: Android runtime, beside the libraries */''}
      <rect x="4" y="130" width="512" height="42" rx="6" fill="#eee5ff" stroke="#7c3aed"/><text x="260" y="149" text-anchor="middle" font-size="13" font-weight="700" fill="#151c2c">Linux kernel (C)</text><text x="260" y="165" text-anchor="middle" font-size="11" fill="#3d4760">drivers · Binder · power · memory · processes · networking · security</text>${/* diagram band: Linux kernel, with its main parts listed */''}
    </svg>${/* end of the stack diagram */''}
    <table>${/* a table of the five layers and what each provides */''}
      <tr><th>Layer</th><th>What it provides</th></tr>${/* table header row */''}
      <tr><td><b>Applications</b></td><td>The programs users open: home screen, dialer, contacts, SMS, email, calendar, maps, browser and everything installed later. Each app runs in its own Linux process under its own user ID (a sandbox). Most built-in apps can be replaced.</td></tr>${/* table row: applications, each sandboxed in its own process */''}
      <tr><td><b>Application framework</b></td><td>The API developers program against. <b>Activity manager</b>: activities and the back stack. <b>Window manager</b>: arranges windows. <b>Package manager</b>: installs apps, records permissions. <b>Telephony manager</b>: calls, network, SIM. <b>Content providers</b>: share one app's data with others. <b>Resource manager</b>: strings and layouts for the language and screen. <b>View system</b>: buttons, lists, text boxes. <b>Location manager</b>: device position. <b>Notification manager</b>: status-bar alerts. <b>XMPP service</b> (Extensible Messaging and Presence Protocol; early Android only): pushed server messages to apps over one shared connection.</td></tr>${/* table row: the application framework and its managers */''}
      <tr><td><b>System libraries</b></td><td>Native C/C++ code: <b>surface manager</b> (combines all apps' surfaces into the screen image), <b>OpenGL ES</b> (graphics), <b>media framework</b> (codecs), <b>SQLite</b> (in-app SQL database stored in one file), <b>WebKit</b> (browser engine in early Android; later replaced by a Chromium-based web view), <b>Bionic libc</b> (Android's small C library).</td></tr>${/* table row: the system libraries */''}
      <tr><td><b>Android runtime</b></td><td>Executes app code: <b>ART</b> (formerly the Dalvik VM) plus the <b>core</b> Java <b>libraries</b>. Each app has its own runtime instance.</td></tr>${/* table row: the Android runtime */''}
      <tr><td><b>Linux kernel</b></td><td>Owns the hardware: device drivers, the <b>Binder IPC driver</b>, power management (with Android's alarms and wakelocks), memory, process management, networking and security (per-app user IDs).</td></tr>${/* table row: the Linux kernel */''}
    </table>${/* end of the layer table */''}
    <p><b>Rule of thumb for placing a component:</b> things users open are applications; services apps call through the API are framework; native C/C++ helpers are libraries; whatever executes app code is the runtime; anything that touches hardware or needs kernel mode is in the kernel.</p>${/* notes paragraph: the rule of thumb for deciding which layer a component belongs to */''}

    <h3>System architecture: how a request travels</h3>${/* notes heading: how a request travels through the system */''}
    <p>Seen as running processes, Android has five tiers: <b>applications and framework → Binder IPC → Android system services → hardware abstraction layer (HAL) → Linux kernel</b>.</p>${/* notes paragraph: the five tiers seen as running processes */''}
    <ul>${/* a bulleted list about the tiers begins */''}
      <li><b>Binder IPC</b> is Android's main interprocess communication mechanism. Framework objects inside an app are often only <b>proxies</b>; calling them sends a Binder transaction that the kernel's Binder driver delivers to another process, stamped with the caller's identity (Linux user ID).</li>${/* list item: Binder, proxies and the caller's identity */''}
      <li><b>Android system services</b> are trusted processes that own shared resources: mainly the <b>system server</b> (activity, window, power, package, location and other manager services) and the <b>media server</b> (camera, audio and media services). They check permissions and share each device among apps.</li>${/* list item: the system server and media server, which check permissions */''}
      <li>The <b>HAL</b> is a set of standard interfaces (camera, audio, GNSS/GPS, graphics, sensors) that each vendor implements for its own chips, so the services above are identical on every device.</li>${/* list item: the HAL, standard interfaces each vendor implements */''}
    </ul>${/* end of the list */''}
    <p><b>Example, taking a photo:</b> Camera app → framework Camera API (proxy) → Binder → camera service (checks the camera permission) → camera HAL (vendor module) → camera driver in the kernel → image sensor; the image returns up the same path. Music and location requests work the same way. Apps never touch drivers directly.</p>${/* notes paragraph: the photo example traced hop by hop */''}

    <h3>From source code to machine code: Dalvik and ART</h3>${/* notes heading: from source code to machine code with Dalvik and ART */''}
    <p>Developers write Java or Kotlin. A compiler produces <b>.class</b> bytecode, and a dex tool converts it into <b>.dex</b> (<b>Dalvik executable</b>) format, packed into the app package (APK). One .dex file holds all of an app's classes and shares their repeated strings and constants, so it is compact and quick to load. <b>Bytecode</b> is portable code that no processor runs directly: an <b>interpreter</b> performs it one instruction at a time on every run (slow), while a <b>compiler</b> translates it into machine code once. The runtime must still turn .dex bytecode into machine code; the question is <b>when</b>.</p>${/* notes paragraph: how .dex is built, interpreters versus compilers, and the question of when to compile */''}
    <ul>${/* a bulleted list of the three runtime designs begins */''}
      <li><b>Dalvik VM (Android 1.0 to 4.4):</b> interprets the bytecode, and from Android 2.2 a <b>just-in-time (JIT)</b> compiler turns busy code into machine code, work that is repeated on every launch.</li>${/* list item: Dalvik, interpreting plus just-in-time compiling repeated every launch */''}
      <li><b>ART with ahead-of-time (AOT) compilation (optional in 4.4, standard in 5.0 and 6.0):</b> the whole app is compiled to native machine code at install time and stored. Launches are faster and each run needs less processor work, so <b>battery life improves</b>. The costs: <b>longer installs</b>, <b>more storage</b>, and every app had to be recompiled after a system update.</li>${/* list item: ART ahead of time, faster and kinder to the battery but slow to install */''}
      <li><b>ART hybrid (Android 7.0 on):</b> early runs use ART's faster interpreter and JIT while it records the hot code (a profile); that code is compiled ahead of time while the phone idles on the charger. Installs stay quick and there is no long recompile after updates.</li>${/* list item: hybrid ART, which compiles the hot code while charging */''}
    </ul>${/* end of the list */''}
    <table>${/* a table comparing the three runtimes */''}
      <tr><th></th><th>Dalvik</th><th>ART (AOT)</th><th>ART (hybrid)</th></tr>${/* table header row: the three runtimes */''}
      <tr><td>Install time</td><td>short</td><td>long</td><td>short</td></tr>${/* table row: install time */''}
      <tr><td>Storage for code</td><td>small</td><td>large</td><td>medium</td></tr>${/* table row: storage for code */''}
      <tr><td>Launch speed</td><td>slower</td><td>fast</td><td>fast once warm</td></tr>${/* table row: launch speed */''}
      <tr><td>Battery per launch</td><td>higher</td><td>low</td><td>low once warm</td></tr>${/* table row: battery per launch */''}
      <tr><td>After an OS update</td><td>quick</td><td>recompile all apps</td><td>quick</td></tr>${/* table row: after an OS update */''}
    </table>${/* end of the comparison table */''}
    <p><b>Worked example (illustrative units of processor work on battery):</b> suppose Dalvik costs 1 unit to install and 5 per launch, while AOT costs 12 to install and 1 per launch. After n launches Dalvik has used 1 + 5n and AOT 12 + n. AOT is cheaper once 12 + n &lt; 1 + 5n, that is n &gt; 2.75, so from the <b>third launch</b> on; after 10 launches the totals are 51 versus 22.</p>${/* notes paragraph: worked example showing AOT becomes cheaper from the third launch */''}

    <h3>Activities and the back stack</h3>${/* notes heading: activities and the back stack */''}
    <p>An <b>activity</b> is a single visual user-interface component of an app: one screen with one focused job, such as an email inbox, a message reader or a compose screen. An app usually has several. The <b>activity manager</b> keeps the activities a user opens for one job (a <b>task</b>) in a <b>back stack</b> (last in, first out): starting an activity <b>pushes</b> it on top, and pressing <b>Back pops</b> the top one so the one beneath returns. Home keeps the stack in the background. One stack can hold activities from <b>different apps</b>: an email app's compose screen can launch the Gallery app's photo picker, which sits on top of it. <b>Example:</b> inbox, message, compose and picker are pushed (4); two presses of Back leave 2 (message on top of inbox). Activity states and how Android manages their processes are covered in Section 4.7.</p>${/* notes paragraph: activities, tasks, push and pop, stacks that mix apps, and the Back-twice example */''}

    <h3>Power management: alarms and wakelocks</h3>${/* notes heading: power management with alarms and wakelocks */''}
    <p>A sleeping phone turns off the screen and suspends the processor, drawing almost no power. Android's goal is to sleep as much as possible without missing work. It adds two features to Linux's power management:</p>${/* notes paragraph: a sleeping phone draws almost nothing, and Android adds two features to sleep safely */''}
    <ul>${/* a bulleted list of the two features begins */''}
      <li><b>Alarms:</b> an app asks the framework's <b>AlarmManager</b> for work at a set time. The alarm is implemented in the Linux kernel using a hardware timer that keeps running during sleep, so it can <b>wake the device</b>; the app does its work and the device sleeps again.</li>${/* list item: alarms, kept in a hardware timer that runs during sleep and can wake the device */''}
      <li><b>Wakelocks:</b> they <b>prevent the system from sleeping</b>. An app that must keep working requests a wakelock through the framework's power manager; the device may sleep only when no wakelock is held. The kernel exposes wakelocks to user space as files (/sys/power/wake_lock and wake_unlock).</li>${/* list item: wakelocks, which keep the device awake, and how the kernel exposes them to programs */''}
    </ul>${/* end of the list */''}
    <table>${/* a table of the four wakelock types */''}
      <tr><th>Wakelock type</th><th>Processor</th><th>Screen</th><th>Keyboard light</th></tr>${/* table header row: what each type keeps on */''}
      <tr><td>Partial</td><td>on</td><td>off</td><td>off</td></tr>${/* table row: partial */''}
      <tr><td>Screen dim</td><td>on</td><td>dim</td><td>off</td></tr>${/* table row: screen dim */''}
      <tr><td>Screen bright</td><td>on</td><td>bright</td><td>off</td></tr>${/* table row: screen bright */''}
      <tr><td>Full</td><td>on</td><td>bright</td><td>bright</td></tr>${/* table row: full */''}
    </table>${/* end of the wakelock table */''}
    <p>Background work that nobody watches (a download, music playback) needs only a <b>partial</b> wakelock; the screen types are for things the user is looking at (newer Android versions steer apps toward a keep-screen-on setting for that). The classic bug is <b>forgetting to release</b> a wakelock, which keeps the phone awake doing nothing. With no wakelock, a background job freezes while the phone sleeps.</p>${/* notes paragraph: when to use a partial wakelock, and the forgotten-release bug */''}
    <p><b>Worked example:</b> asleep a phone uses 1% of its battery per hour; awake under a partial wakelock, 8% per hour. A wakelock left held for 6 hours overnight costs 6 × 8 = 48 points instead of 6 × 1 = 6, an extra <b>42 percentage points</b>.</p>`,  // notes paragraph: worked example of the overnight wakelock bug costing 42 points; end of the notes text
});  // closes the section object and the Guide.section call
