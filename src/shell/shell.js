/* =====================================================================
   Operating Systems Interactive Guide — runtime shell
   ---------------------------------------------------------------------
   Sections register themselves with Guide.section({...}); chapters with
   Guide.chapter({...}). Guide.start() then builds one flat list of
   "slides" (home → chapter overview → every step of every section →
   chapter review → final challenge) and shows one slide at a time on a
   fixed 1200 x 640 canvas that is scaled to fit the window.
   ===================================================================== */
(function () {  // wraps the whole runtime in a function that runs once, right away, so its helper names stay private
  'use strict';  // strict mode: the browser reports common mistakes as errors instead of silently ignoring them

  const CANVAS_W = 1200, CANVAS_H = 640, BODY_W = 1152, BODY_H = 540;  // fixed design size: every slide is laid out on a 1200 x 640 canvas with a 1152 x 540 content area, then scaled to fit
  const BOOK = Object.assign({ id: '1-5', range: '1–5', storeKey: 'os-guide-v1', countWord: 'five', subtitle: 'Chapters 1–5: from the hardware up to concurrency', prior: '' }, (typeof window !== 'undefined' && window.GuideBook) || {});  // BOOK: which volume this page is (chapters 1-5 unless the build set window.GuideBook first); it supplies the page wording and the storage name
  const STORE_KEY = BOOK.storeKey;  // the name under which saved progress is kept in localStorage (the browser's small per-site storage); each volume has its own, so their progress never mixes
  const Guide = (window.Guide = { chapters: [], sections: {}, scale: 1, narrow: false, book: BOOK, CANVAS_W, CANVAS_H, BODY_W, BODY_H });  // creates the global Guide object that every section talks to: chapter list, section table, zoom, phone-width flag, sizes
  const renderErrors = [];  // renderErrors: every step that crashed while drawing is recorded here so the automated checker can report it
  const registerErrors = [];  // registerErrors: problems found when chapters and sections sign up; printed to the console at start-up

  /* ------------------------------------------------------------ utilities */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));  // clamp(v, a, b): forces v into the range a..b (anything below a becomes a, anything above b becomes b)
  const esc = (str) => String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));  // esc(str): swaps & < > " ' for HTML codes so text is shown as text on the page, never run as markup
  const range = (n) => Array.from({ length: n }, (_, i) => i);  // range(n): makes the list [0, 1, ..., n-1], handy for looping over n things
  function mulberry32(a) {  // mulberry32(a): a tiny seeded random-number generator; the same seed always gives the same sequence
    return function () {  // returns a closure (a function that remembers the variable a); each call moves a forward and gives the next number
      a |= 0; a = (a + 0x6d2b79f5) | 0;  // forces a to a 32-bit whole number and adds a fixed odd constant, which moves the generator one step on
      let t = Math.imul(a ^ (a >>> 15), 1 | a);  // scrambles the bits of a (shift, exclusive-or, multiply) so neighbouring seeds give very different results
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;  // a second round of bit scrambling so the output is evenly spread
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;  // final scramble, divided by 2 to the 32nd power to give a fraction from 0 up to 1, the same range as Math.random
    };  // ends the generator function handed back to the caller
  }  // ends mulberry32
  function shuffle(arr, rnd = Math.random) {  // shuffle(arr, rnd): returns a new list in random order; rnd lets a caller pass a seeded generator instead of Math.random
    const a = arr.slice();  // copies the list first so the caller's original order is never changed
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }  // Fisher-Yates shuffle: walks from the end, swapping each item with a randomly chosen one at or before it
    return a;  // hands back the shuffled copy
  }  // ends shuffle
  const hashStr = (s) => { let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return x >>> 0; };  // hashStr(s): FNV-1a hash that turns any text into a 32-bit number; the same text always gives the same number
  // fingerprint of a whole question (prompt, choices, answer, type, pairs...): any edit invalidates saved attempts
  const qfp = (q) => hashStr(JSON.stringify(q, (k, v) => (typeof v === 'function' || k === 'source' || k === 'qid' ? undefined : v))).toString(36);  // qfp(q): short fingerprint of one question, ignoring functions and the source/qid tags that chapter quizzes add
  const quizIds = (questions) => questions.map((q, i) => i + ':' + qfp(q));  // quizIds: labels each question with its position plus fingerprint (like "0:k3x9a"); saved attempts are matched on these
  const quizFp = (questions) => hashStr(quizIds(questions).join('|')).toString(36);  // quizFp: one fingerprint for a whole quiz, used to tell whether a saved best score still belongs to these questions
  const fmt = (v, d = 2) => (Math.round(v * 10 ** d) / 10 ** d).toLocaleString('en-US', { maximumFractionDigits: d });  // fmt(v, d): rounds v to at most d decimal places and adds thousands commas, e.g. 12345.678 becomes "12,345.68"
  Guide.util = { clamp, esc, range, shuffle, seeded: mulberry32, hash: hashStr, fmt, sleep: (ms) => new Promise((r) => setTimeout(r, ms)) };  // publishes the helpers as Guide.util for every section; sleep(ms) gives a promise (a future result) that settles after ms

  /* ------------------------------------------------------------ null-safe DOM insertion
     Sections often write parent.replaceChildren(a, cond ? b : null). Natively that prints the word
     "null"; here null, undefined and false are simply skipped. */
  [typeof Element !== 'undefined' && Element.prototype, typeof DocumentFragment !== 'undefined' && DocumentFragment.prototype].forEach((proto) => {  // the prototypes (shared objects that hold the methods every element uses) of elements and fragments; typeof guards skip non-browsers
    if (!proto) return;  // skips a prototype that does not exist in this environment
    ['append', 'prepend', 'replaceChildren', 'before', 'after', 'replaceWith'].forEach((fn) => {  // the six built-in methods that insert or replace child elements; each one gets the null-skipping wrapper below
      const orig = proto[fn];  // keeps the browser's original method so the wrapper can still call it
      if (typeof orig !== 'function' || orig.__nullSafe) return;  // skips anything that is not a function or is already wrapped, so running this twice does no harm
      const wrapped = function (...args) { return orig.apply(this, args.filter((a) => a != null && a !== false)); };  // the wrapper: drops null, undefined and false from the arguments, then calls the original method with what is left
      wrapped.__nullSafe = true;  // tags the wrapper so the check two lines up recognises it later
      proto[fn] = wrapped;  // installs the wrapper in place of the original, so every element on the page gets the safer behaviour
    });  // ends the loop over the six method names
  });  // ends the loop over the two prototypes

  /* ------------------------------------------------------------ DOM builders */
  const SVGNS = 'http://www.w3.org/2000/svg';  // the SVG namespace: SVG (the browser's drawing format) elements must be created with this address to be drawn
  function applyProps(el, props, isSvg) {  // applyProps(el, props, isSvg): copies a plain settings object onto a new element (class, style, events, attributes)
    if (!props) return;  // nothing to copy when no settings were given
    for (const [k, v] of Object.entries(props)) {  // goes through each setting as a name k and a value v
      if (v == null || v === false) continue;  // skips empty or false values, so callers can write { disabled: cond } and have it left off when cond is false
      if (k === 'class' || k === 'className') el.setAttribute('class', v);  // class names go into the class attribute (className is accepted as another spelling)
      else if (k === 'style' && typeof v === 'object') {  // a style object like { color: 'red' } is applied one property at a time
        for (const [sk, sv] of Object.entries(v)) { if (sk.startsWith('--')) el.style.setProperty(sk, sv); else el.style[sk] = sv; }  // names starting with -- are CSS variables and need setProperty; ordinary properties are set directly
      } else if (k === 'html') el.innerHTML = v;  // html: puts the string in as markup (used for trusted content such as icons and captions)
      else if (k === 'text') el.textContent = v;  // text: puts the string in as plain text, so any < or & shows literally
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);  // onclick, oninput and so on become event listeners (functions the browser calls when that event happens)
      else if (k === 'dataset') Object.assign(el.dataset, v);  // dataset: copies each entry into data-* attributes, the standard place to hang extra facts on an element
      else if (!isSvg && (k === 'value' || k === 'checked' || k === 'disabled' || k === 'selected')) el[k] = v;  // for HTML, value, checked, disabled and selected are set as live properties so form controls update correctly
      else el.setAttribute(k, v === true ? '' : v);  // anything else becomes a plain attribute; true becomes an empty attribute, which HTML reads as switched on
    }  // ends the loop over settings
  }  // ends applyProps
  function appendKids(el, kids) {  // appendKids(el, kids): adds children to el, accepting elements, text, numbers and nested lists
    for (const k of kids.flat(Infinity)) {  // flat(Infinity) opens up lists inside lists, so callers can pass the arrays made by map() straight in
      if (k == null || k === false) continue;  // skips null, undefined and false, so conditional children can be written inline
      el.append(k instanceof Node ? k : document.createTextNode(String(k)));  // elements go in as they are; anything else is turned into a text node (plain text on the page)
    }  // ends the loop over children
  }  // ends appendKids
  function h(tag, props, ...kids) {  // h(tag, props, ...kids): the guide's main way to build HTML, e.g. h('div', { class: 'card' }, 'Hello')
    if (props instanceof Node || typeof props === 'string' || Array.isArray(props)) { kids.unshift(props); props = null; }  // lets callers leave out the settings: if the second argument is already a child, it is moved into the children list
    const el = document.createElement(tag); applyProps(el, props, false); appendKids(el, kids); return el;  // creates the element, applies its settings, adds its children and returns it
  }  // ends h
  function s(tag, props, ...kids) {  // s(tag, props, ...kids): the same as h but builds SVG drawing elements (lines, circles, labels in diagrams)
    if (props instanceof Node || typeof props === 'string' || Array.isArray(props)) { kids.unshift(props); props = null; }  // same shortcut as h: a child in the settings position is treated as a child
    const el = document.createElementNS(SVGNS, tag); applyProps(el, props, true); appendKids(el, kids); return el;  // createElementNS uses the SVG namespace so the browser draws it; settings and children are added the same way
  }  // ends s
  function frag(html) { const t = document.createElement('template'); t.innerHTML = String(html).trim(); return t.content; }  // frag(html): turns an HTML string into real elements through a template element, ready to insert in one go
  Guide.h = h; Guide.s = s; Guide.frag = frag;  // publishes the three builders so section files can call Guide.h, Guide.s and Guide.frag

  /* ------------------------------------------------------------ icons */
  const I = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${extra}>${d}</svg>`;  // I(d, extra): wraps SVG path data in a 24 x 24 outline icon that takes its colour from the surrounding text
  const ICON = {  // ICON: the toolbar and player icons, each stored as a ready-made SVG string under a short name
    menu: I('<path d="M4 6h16M4 12h16M4 18h16"/>'),  // icon: three horizontal lines, the usual menu symbol, used on the Contents button
    home: I('<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'),  // icon: a house outline (home), available to any page that needs it
    book: I('<path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4zM20 4h-6a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h7z"/>'),  // icon: an open book, used on the Glossary button
    notes: I('<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h7"/>'),  // icon: a page with a folded corner and lines, used on the Notes button
    moon: I('<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>'),  // icon: a crescent moon, shown on the theme button while the page is light (click for dark)
    sun: I('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),  // icon: a sun with rays, shown on the theme button while the page is dark (click for light)
    full: I('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),  // icon: four corner brackets, used on the Full screen button
    help: I('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h.01"/>'),  // icon: a question mark in a circle, used on the Help and shortcuts button
    left: I('<path d="M15 18l-6-6 6-6"/>'),  // icon: an arrowhead pointing left, drawn inside the bottom-bar Back button
    right: I('<path d="M9 18l6-6-6-6"/>'),  // icon: an arrowhead pointing right, drawn inside the bottom-bar Next button and the Continue buttons
    close: I('<path d="M6 6l12 12M18 6L6 18"/>'),  // icon: an X, used on every Close button of the side panels and the help window
    play: I('<path d="M7 5l12 7-12 7z" fill="currentColor"/>'),  // icon: a filled triangle, the Play button of animation players
    pause: I('<path d="M7 5h3v14H7zM14 5h3v14h-3z" fill="currentColor"/>'),  // icon: two filled bars, the Pause button shown while an animation is playing
    reset: I('<path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v5h5"/>'),  // icon: a circular arrow, the Restart button of animation players
    first: I('<path d="M6 5v14M18 18l-7-6 7-6"/>'),  // icon: a bar with an arrowhead pointing left (jump to the start), available to sections
    next: I('<path d="M6 5l9 7-9 7M18 5v14"/>'),  // icon: a triangle with a bar on its right, the player's Next step button
    prev: I('<path d="M18 5l-9 7 9 7M6 5v14"/>'),  // icon: a triangle with a bar on its left, the player's Previous step button
  };  // closes the ICON table
  Guide.ICON = ICON;  // publishes the icons as Guide.ICON so sections can put them on their own buttons
  const iconBtn = (name, label, onclick, cls = 'tb-btn') => h('button', { class: cls, title: label, 'aria-label': label, onclick, html: ICON[name] });  // iconBtn(name, label, onclick): a toolbar button showing one icon; label becomes the tooltip and the screen-reader name

  /* ------------------------------------------------------------ persistence */
  const BAD_KEYS = new Set(['__proto__', 'constructor', 'prototype']);  // BAD_KEYS: property names that could change how every object behaves if tampered saved data sneaked them in
  const dict = () => Object.create(null);  // dict(): an empty object with no prototype, so no built-in names like constructor can hide inside it
  const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);  // isObj(v): true only for a plain object (not null, not a list), the shape saved records must have
  const okKey = (k, max = 64) => typeof k === 'string' && k.length > 0 && k.length <= max && !BAD_KEYS.has(k);  // okKey(k, max): accepts a non-empty text key up to max characters that is not one of the dangerous names
  const okInt = (v, lo = 0, hi = 100000) => Number.isInteger(v) && v >= lo && v <= hi;  // okInt(v, lo, hi): accepts only a whole number between lo and hi, used for scores and counts read back from storage
  /* Saved progress is untrusted input: rebuild it field by field from an allowlist into fresh
     null-prototype objects, dropping anything malformed, instead of merging the parsed JSON. */
  function parseStore(raw) {  // parseStore(raw): turns the saved text back into progress data, keeping only fields that pass the checks
    const out = { visited: dict(), quiz: dict(), known: dict(), chLast: dict(), qstate: dict(), qdraw: dict(), last: null, theme: null, route: 'full' };  // out starts as a clean, empty progress record; anything not copied into it below is thrown away
    let src = null;  // src will hold the parsed JSON (the text format the progress is saved in)
    try { src = JSON.parse(raw, (k, v) => (BAD_KEYS.has(k) ? undefined : v)); } catch (e) { return out; }  // parses the text while dropping dangerous keys; broken text simply gives the empty record
    if (!isObj(src)) return out;  // anything other than a plain object (a number, a list, null) also gives the empty record
    if (isObj(src.visited)) for (const k of Object.keys(src.visited)) if (okKey(k) && src.visited[k]) out.visited[k] = 1;  // visited: which slides the student has opened, stored as slide key to 1
    if (isObj(src.known)) for (const k of Object.keys(src.known)) if (okKey(k, 200)) out.known[k] = src.known[k] ? 1 : 0;  // known: flashcard terms the student marked as known (1) or still learning (0); term keys may be up to 200 characters
    if (isObj(src.quiz)) for (const k of Object.keys(src.quiz)) {  // quiz: the best-score record for each quiz, checked one entry at a time
      const r = src.quiz[k];  // r is one saved quiz record
      if (okKey(k) && isObj(r) && okInt(r.best) && okInt(r.total) && r.best <= r.total) out.quiz[k] = { best: r.best, total: r.total, last: okInt(r.last) ? r.last : 0, learned: okInt(r.learned) && r.learned <= r.total ? r.learned : 0, fp: typeof r.fp === 'string' ? r.fp.slice(0, 32) : '' };  // keeps the record only if its numbers are sane (best not above total), copying just best, total, last, learned and fp
    }  // ends the loop over quiz records
    if (isObj(src.chLast)) for (const k of Object.keys(src.chLast)) if (/^\d{1,2}$/.test(k) && okKey(src.chLast[k])) out.chLast[k] = src.chLast[k];  // chLast: for each chapter number (one or two digits), the last learning slide the student was on in that chapter
    if (isObj(src.qdraw)) for (const k of Object.keys(src.qdraw)) {  // qdraw: for chapter and final challenges, the list of question ids that were drawn, so the same set comes back
      const a = src.qdraw[k];  // a is one saved list of drawn question ids
      if (okKey(k) && Array.isArray(a) && a.length <= 200 && a.every((x) => okKey(x, 96))) out.qdraw[k] = a.slice();  // kept only if it is a list of at most 200 short text ids
    }  // ends the loop over saved draws
    if (isObj(src.qstate)) for (const k of Object.keys(src.qstate)) if (okKey(k) && isObj(src.qstate[k])) out.qstate[k] = src.qstate[k]; // deep-validated when a quiz restores it
    if (okKey(src.last)) out.last = src.last;  // last: the key of the last learning slide overall, used by the Continue button on the home page
    if (src.theme === 'dark' || src.theme === 'light') out.theme = src.theme;  // theme: only the two known values are accepted
    if (src.route === 'core') out.route = 'core';  // route: the core path is kept if it was chosen; anything else stays on the full course
    return out;  // returns the cleaned record
  }  // ends parseStore
  Guide._parseStore = parseStore;  // exposed so outside checks can test it with bad data; the leading underscore marks it as internal, not for sections
  const store = (() => {  // store: the one shared progress object, built once by this function that runs immediately
    let data = parseStore('null');  // starts from an empty record, in case nothing was saved or storage is blocked
    try { const raw = localStorage.getItem(STORE_KEY); if (raw) data = parseStore(raw); } catch (e) { /* storage blocked */ }
    let t = null;  // t holds the pending save timer
    const save = () => { clearTimeout(t); t = setTimeout(() => { try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch (e) { /* ignore */ } }, 120); };
    return { data, save };  // hands out the data and the save function; everything else in this block stays private
  })();  // ends and immediately runs the store builder
  Guide.store = store;  // publishes the store as Guide.store so sections can read or record progress

  /* ------------------------------------------------------------ registration + validation */
  const QTYPES = ['mc', 'tf', 'multi', 'order', 'match', 'bucket', 'num'];  // QTYPES: the seven question kinds the quiz engine can show (multiple choice, true/false, select all, order, match, sort, number)
  function validateQuestion(q, where) {  // validateQuestion(q, where): works out a question's kind and lists anything wrong with it; where names it in messages
    const errs = [];  // errs collects the problems found
    const type = q.type || (q.pairs ? 'match' : q.items && q.buckets ? 'bucket' : q.items ? 'order' : typeof q.answer === 'boolean' ? 'tf' : Array.isArray(q.answer) ? 'multi' : typeof q.answer === 'number' && !q.choices ? 'num' : 'mc');  // uses q.type if given, otherwise guesses the kind from the fields present (pairs means match, items plus buckets means sort...)
    if (!QTYPES.includes(type)) errs.push(`${where}: unknown question type "${type}"`);  // rejects a kind the quiz engine cannot show
    if (!q.q) errs.push(`${where}: missing q (question text)`);  // every question needs its question text in q
    if (!q.why) errs.push(`${where}: missing why (explanation)`);  // every question needs a why explanation, shown after the student answers
    if (type === 'mc') {  // multiple-choice checks
      if (!Array.isArray(q.choices) || q.choices.length < 2) errs.push(`${where}: mc needs >=2 choices`);  // needs a list of at least two choices
      else if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.choices.length) errs.push(`${where}: mc answer index out of range`);  // answer must be the position (0, 1, 2...) of one of those choices
      if (q.feedback && (!Array.isArray(q.feedback) || q.feedback.length !== q.choices.length)) errs.push(`${where}: feedback must have one entry per choice`);  // optional feedback, shown after a specific wrong pick, must have one entry per choice
    }  // ends the multiple-choice checks
    if (type === 'tf' && typeof q.answer !== 'boolean') errs.push(`${where}: tf answer must be true/false`);  // true/false: the answer must be true or false
    if (type === 'multi') {  // select-all-that-apply checks
      if (!Array.isArray(q.choices) || q.choices.length < 3) errs.push(`${where}: multi needs >=3 choices`);  // needs at least three choices so picking several is meaningful
      else if (!Array.isArray(q.answer) || !q.answer.length || q.answer.some((a) => !Number.isInteger(a) || a < 0 || a >= q.choices.length)) errs.push(`${where}: multi answer must be a non-empty index array`);  // answer must be a non-empty list of valid choice positions
    }  // ends the select-all checks
    if (type === 'order' && (!Array.isArray(q.items) || q.items.length < 3)) errs.push(`${where}: order needs >=3 items (in the correct order)`);  // put-in-order: at least three items, written in the correct order (the engine shuffles them for the student)
    if (type === 'match') {  // match-the-pairs checks
      if (!Array.isArray(q.pairs) || q.pairs.length < 2) errs.push(`${where}: match needs >=2 pairs`);  // needs at least two [left, right] pairs
      else if (new Set(q.pairs.map((p) => p[1])).size !== q.pairs.length) errs.push(`${where}: match right-hand values must be unique (use type "bucket" for categories)`);  // each right-hand value must be different, or two rows would share one answer; the sort kind handles shared groups
    }  // ends the match checks
    if (type === 'bucket') {  // sort-into-groups checks
      if (!Array.isArray(q.buckets) || q.buckets.length < 2) errs.push(`${where}: bucket needs >=2 buckets`);  // needs at least two groups (buckets)
      if (!Array.isArray(q.items) || !q.items.length || q.items.some((it) => !Array.isArray(it) || !Number.isInteger(it[1]) || it[1] < 0 || it[1] >= (q.buckets || []).length)) errs.push(`${where}: bucket items must be [text, bucketIndex]`);  // each item must be [text, group number] with a group number that exists
    }  // ends the sort checks
    if (type === 'num' && typeof q.answer !== 'number') errs.push(`${where}: num answer must be a number`);  // calculate: the answer must be a number
    return { type, errs };  // returns the kind found and the list of problems
  }  // ends validateQuestion
  function validateSection(sec) {  // validateSection(sec): checks that a section has what the runtime needs before it is used
    const errs = [];  // errs collects the problems found
    if (!sec || typeof sec !== 'object') return ['section is not an object'];  // stops at once if the section is not an object at all
    if (!/^\d+\.\d+$/.test(sec.id || '')) errs.push(`bad id "${sec.id}" (expected like "1.3")`);  // the id must look like 1.3 (chapter number, dot, section number)
    if (!sec.title) errs.push(`${sec.id}: missing title`);  // a section needs a title
    if (!Array.isArray(sec.steps) || !sec.steps.length) errs.push(`${sec.id}: steps must be a non-empty array`);  // a section needs at least one step
    (sec.steps || []).forEach((st, i) => {  // checks every step
      if (!st.title) errs.push(`${sec.id} step ${i + 1}: missing title`);  // each step needs a title for its heading
      if (!st.html && !st.render && !st.quiz) errs.push(`${sec.id} step ${i + 1}: needs html, render or quiz`);  // each step needs something to show: fixed html, a render function or a quiz
      if (st.quiz) st.quiz.forEach((q, j) => errs.push(...validateQuestion(q, `${sec.id} step ${i + 1} q${j + 1}`).errs));  // checks each quiz question with validateQuestion, naming the step and question number in any message
    });  // ends the loop over steps
    return errs;  // returns every problem found (an empty list means the section is fine)
  }  // ends validateSection
  Guide.validateQuestion = validateQuestion;  // exposes the question checker; the build and the browser tests use it to learn each question's kind
  Guide.validateSection = validateSection;  // exposes the section checker so outside tools can run the same checks

  function injectCSS(css, id) {  // injectCSS(css, id): adds a chapter's or section's own style rules to the page when that chapter or section signs up
    if (!css) return;  // nothing to add when no style rules were given
    const st = document.createElement('style'); st.id = id; st.textContent = css; document.head.appendChild(st);  // creates a style element, labels it with id, fills it with the rules and places it in the page head so it applies at once
  }  // ends injectCSS
  Guide.chapter = function (c) {  // Guide.chapter(c): called by the chapter file to register one chapter (its number, title, overview text, terms)
    if (!c || !Number.isInteger(c.num)) { registerErrors.push('chapter without num'); return; }  // a chapter must have a whole-number num; otherwise the problem is recorded and the chapter ignored
    const existing = Guide.chapters.find((x) => x.num === c.num);  // looks for a chapter with the same number that was registered earlier
    if (existing) Object.assign(existing, c); else Guide.chapters.push(c);  // merges into the earlier one if found (so overview data can arrive in pieces), otherwise adds it to the list
    if (c.css) injectCSS(c.css, 'css-ch' + c.num);  // adds the chapter's own styles, if any, under an id like css-ch3
  };  // ends Guide.chapter
  Guide.section = function (sec) {  // Guide.section(sec): called once by each section file to register itself with its steps, quizzes, terms and notes
    const errs = validateSection(sec);  // runs the section checks before anything is used
    if (errs.length) { errs.forEach((e) => console.error('[section] ' + e)); registerErrors.push(...errs); }  // prints each problem to the browser console and keeps it for the start-up report
    if (!sec || !sec.id || !Array.isArray(sec.steps)) return;  // a section too broken to show (no id or no step list) is skipped entirely
    sec.chapter = sec.chapter || parseInt(sec.id, 10);  // chapter number: taken from the section if given, otherwise from the part of the id before the dot (3.2 gives 3)
    sec.minor = parseInt(sec.id.split('.')[1], 10);  // minor: the section number after the dot (3.2 gives 2), used to sort sections inside a chapter
    if (sec.css) injectCSS(sec.css, 'css-' + sec.id.replace('.', '-'));  // adds the section's own styles under an id like css-3-2
    Guide.sections[sec.id] = sec;  // files the section in Guide.sections under its id, where buildSlides will find it
  };  // ends Guide.section
  const lab = (x) => (x && x.label) || (x && x.id) || '';  // lab(section): the number shown for a section, normally its id ("7.2"); an appendix may carry its own label instead ("7A")
  const labOf = (id) => lab(Guide.sections[id]) || id;  // labOf(id): the shown number for a section id, or the id itself when that section is not on this page

  /* ------------------------------------------------------------ glossary */
  const gloss = []; // {term, def, src}
  const glossIndex = new Map();  // glossIndex: a lookup table from every spelling of a term (plural, no hyphen...) to its glossary entry
  const normTerm = (t) => String(t).replace(/<[^>]+>/g, '').toLowerCase().replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();  // normTerm(t): tidies a term for comparing: strips HTML tags, lowercases, straightens curly quotes, squeezes spaces
  function variants(t) {  // variants(t): all the spellings under which a term should be found, so "processes" finds the entry "process"
    const n = normTerm(t); const out = new Set([n]);  // starts the set with the tidied term itself (a Set keeps each spelling once)
    const m = n.match(/^(.*?)\s*\(([^)]+)\)\s*$/);  // looks for a term with a bracketed part at the end, like "program counter (PC)"
    if (m) { out.add(m[1].trim()); out.add(m[2].trim()); }  // if found, both halves become spellings on their own: "program counter" and "pc"
    for (const v of Array.from(out)) {  // loops over a copy of the spellings found so far, adding more to the set as it goes
      if (v.endsWith('ies')) out.add(v.slice(0, -3) + 'y');  // plural ending -ies also matches -y (memories finds memory)
      if (v.endsWith('es')) out.add(v.slice(0, -2));  // plural ending -es also matches the word without it (buses finds bus)
      if (v.endsWith('s')) out.add(v.slice(0, -1));  // plural ending -s also matches the word without it (registers finds register)
      out.add(v.replace(/-/g, ' '));  // hyphens also match spaces (time-sharing finds time sharing)
    }  // ends the loop over spellings
    return out;  // returns the full set of spellings
  }  // ends variants
  const baseName = (t) => normTerm(t).replace(/\s*\([^)]*\)\s*/g, ' ').trim();  // baseName(t): the tidied term with any bracketed part removed, so "program counter (PC)" and "program counter" count as one
  function addTerm(term, def, src) {  // addTerm(term, def, src): adds one term to the shared glossary, unless it is already there; src says where it is taught
    if (!term || !def) return;  // skips an entry that is missing its term or its definition
    const n = normTerm(term), bn = baseName(term);  // n is the tidied term and bn its base name, used to spot a duplicate
    if (gloss.some((g) => normTerm(g.term) === n || baseName(g.term) === bn)) { for (const v of variants(term)) if (!glossIndex.has(v)) glossIndex.set(v, gloss.find((g) => baseName(g.term) === bn || normTerm(g.term) === n)); return; }  // already known: keep the first definition, just point any new spellings at that existing entry, and stop
    const entry = { term: String(term), def: String(def), src };  // a new entry: the term as written, its definition and where it is taught
    gloss.push(entry);  // adds it to the glossary list (shown in the Glossary panel)
    for (const v of variants(term)) if (!glossIndex.has(v)) glossIndex.set(v, entry);  // points every spelling that is still free at the new entry
  }  // ends addTerm
  const localIndex = {}; // section id -> Map(variant -> entry): a section's own wording wins inside that section
  function indexLocal(src, term, def) {  // indexLocal(src, term, def): records a term in one section's own table, so pop-ups there show that section's wording
    const m = localIndex[src] || (localIndex[src] = new Map());  // gets that section's table, creating it the first time
    const entry = { term: String(term), def: String(def), src };  // the entry keeps this section's own definition
    for (const v of variants(term)) if (!m.has(v)) m.set(v, entry);  // points each spelling that is still free in this table at the entry
  }  // ends indexLocal
  function lookupTerm(text, secId) {  // lookupTerm(text, secId): finds the glossary entry for a dotted word the student hovers or taps
    const loc = secId && localIndex[secId];  // the current section's own table, if it has one
    if (loc) for (const v of variants(text)) if (loc.has(v)) return loc.get(v);  // tries the section's own wording first, spelling by spelling
    for (const v of variants(text)) if (glossIndex.has(v)) return glossIndex.get(v);  // otherwise falls back to the shared glossary
    return null;  // no match: the caller warns in the console that a term has no definition
  }  // ends lookupTerm
  Guide.lookupTerm = lookupTerm;  // exposed so sections can look up a definition themselves
  Guide.glossary = gloss;  // exposed so sections and tests can read the full glossary list
  const extraTerms = [];  // extraTerms: terms from sections left out of a partial build, so their dotted words still show a definition
  Guide.extraTerms = (list) => { (list || []).forEach((x) => extraTerms.push(x)); };  // Guide.extraTerms(list): used by the build to add those terms, each as [term, definition, section id]
  const priorTerms = [];  // priorTerms: terms taught in an earlier volume of the guide (chapters 1-5 for this page), so words like semaphore still show a definition here
  Guide.priorTerms = (list) => { (list || []).forEach((x) => priorTerms.push(x)); };  // Guide.priorTerms(list): used by the build to add them, each as [term, definition, where it was taught in the earlier volume]
  const isPrior = (src) => String(src).startsWith('prior:');  // isPrior(src): true for a term that was taught in the earlier volume rather than on this page
  const priorWhere = (src) => { const w = String(src).slice(6); return (w.startsWith('ch') ? 'the Chapter ' + w.slice(2) + ' overview' : '§' + w) + ' of the Chapters ' + BOOK.prior + ' guide'; };  // priorWhere(src): says where an earlier-volume term was taught, for example "§5.4 of the Chapters 1–5 guide"
  function buildGlossary() {  // buildGlossary(): collects every term from sections and chapters into the glossary, run once at start-up
    const eachTerm = (arr, src) => (arr || []).forEach((t) => {  // eachTerm(arr, src): adds a list of terms from one place; each term may be [term, def] or { term, def }
      const [a, b] = Array.isArray(t) ? t : [t && t.term, t && t.def];  // unpacks the term and definition from either shape
      if (!a || !b) return;  // skips a term missing either half
      addTerm(a, b, src);  // adds it to the shared glossary (the first definition of a term wins there)
      indexLocal(src, a, b);  // and to that place's own table, so its own wording is used on its own pages
    });  // ends eachTerm
    // section definitions win; chapter-level terms only fill gaps
    sortedChapters().forEach((c) => sectionsOf(c.num).forEach((sec) => eachTerm(sec.terms, sec.id)));  // first pass: the sections of each chapter, in chapter and section order, so earlier sections define terms first
    Object.values(Guide.sections).forEach((sec) => eachTerm(sec.terms, sec.id));  // second pass: any section not reached above (for example one whose chapter was never registered)
    extraTerms.forEach((x) => addTerm(x[0], x[1], x[2]));   // other sections' terms (partial dev builds only)
    sortedChapters().forEach((c) => eachTerm(c.terms, 'ch' + c.num));  // then chapter-level terms, which only fill gaps the sections left
    priorTerms.forEach((x) => addTerm(x[0], x[1], 'prior:' + x[2]));  // last: terms from the earlier volume, which only fill gaps this volume left (its own wording always wins)
    gloss.sort((a, b) => normTerm(a.term).localeCompare(normTerm(b.term)));  // sorts the glossary alphabetically by its tidied term for the Glossary panel
  }  // ends buildGlossary

  /* ------------------------------------------------------------ slides */
  let slides = [];  // slides: the flat list of every screen in order (home, chapter overviews, steps, key terms, challenges)
  let cur = -1;  // cur: the position of the slide on screen now; -1 until the first slide is shown
  let curCtx = null;  // curCtx: the helper object of the slide on screen, kept so its timers and listeners can be stopped when leaving
  const sortedChapters = () => Guide.chapters.slice().sort((a, b) => a.num - b.num);  // sortedChapters(): the registered chapters in number order, as a new list
  const sectionsOf = (n) => Object.values(Guide.sections).filter((x) => x.chapter === n).sort((a, b) => a.minor - b.minor);  // sectionsOf(n): the sections of chapter n, sorted by section number
  const chapterOf = (n) => Guide.chapters.find((c) => c.num === n) || { num: n, title: 'Chapter ' + n };  // chapterOf(n): the chapter object for number n, or a stand-in with a default title if it was never registered
  const KIND = { story: 'Big Picture', learn: 'Learn', explore: 'Explore', lab: 'Hands-on Lab', predict: 'Predict', compare: 'Compare', recap: 'Recap', check: 'Check Yourself', intro: 'Chapter Overview', terms: 'Key Terms', review: 'Chapter Challenge', final: 'Final Challenge' };  // KIND: the label shown above each step title for each kind of step (story shows Big Picture, lab shows Hands-on Lab...)

  function buildSlides() {  // buildSlides(): builds the full ordered list of slides, run once at start-up
    slides = [{ key: 'home', type: 'home', title: 'Welcome' }];  // the list always starts with the home page
    for (const ch of sortedChapters()) {  // goes through the chapters in order
      const secs = sectionsOf(ch.num);  // the sections of this chapter, in order
      slides.push({ key: 'ch' + ch.num, type: 'chapter', ch, title: 'Chapter ' + ch.num + ' overview' });  // the chapter overview slide, keyed like ch3
      (ch.steps || []).forEach((st, i) => slides.push({ key: 'ch' + ch.num + '/' + (i + 1), type: 'step', ch, sec: chapterPseudoSection(ch), step: st, i }));  // the chapter's own intro steps, if any, keyed like ch3/1, using a stand-in section so they look like section steps
      for (const sec of secs) sec.steps.forEach((st, i) => slides.push({ key: sec.id + '/' + (i + 1), type: 'step', ch, sec, step: st, i }));  // every step of every section, keyed like 3.2/1, 3.2/2 ...
      if (secs.length) {  // chapters with sections also get two closing slides
        slides.push({ key: 'ch' + ch.num + '-terms', type: 'terms', ch, title: 'Chapter ' + ch.num + ' key terms' });  // the key-term flashcards for the chapter, keyed like ch3-terms
        slides.push({ key: 'ch' + ch.num + '-quiz', type: 'chquiz', ch, title: 'Chapter ' + ch.num + ' challenge' });  // the chapter challenge quiz, keyed like ch3-quiz
      }  // ends the closing slides
    }  // ends the loop over chapters
    if (Object.keys(Guide.sections).length) slides.push({ key: 'final', type: 'final', title: 'Final challenge' });  // the final challenge across all chapters comes last, if any section exists
  }  // ends buildSlides
  const pseudo = {};  // pseudo: stand-in sections for chapter intro steps, one per chapter number, made once and reused
  function chapterPseudoSection(ch) {  // chapterPseudoSection(ch): wraps a chapter's own intro steps so they can be shown exactly like section steps
    if (!pseudo[ch.num]) pseudo[ch.num] = { id: 'ch' + ch.num, chapter: ch.num, title: 'Chapter ' + ch.num + ': ' + ch.title, steps: ch.steps || [], notes: ch.notes, pseudo: true };  // made on first use: id like ch3, the chapter's title, its steps and notes, and pseudo: true so other code can tell it apart
    return pseudo[ch.num];  // returns the same stand-in every time, so comparisons such as "same section as before" work
  }  // ends chapterPseudoSection
  const slideIndex = (key) => slides.findIndex((x) => x.key === key);  // slideIndex(key): the position of the slide with this key (like 3.2/4) in the list, or -1 if there is none

  /* ------------------------------------------------------------ app frame */
  const els = {};  // els: handles to the page's fixed parts (toolbar, canvas, buttons, panels) so other functions can update them
  function buildFrame() {  // buildFrame(): builds the page's permanent layout once at start-up: top bar, stage, bottom bar, panels, pop-ups
    const app = h('div', { id: 'app' });  // the outer box that holds the top bar, the stage and the bottom bar
    els.app = app;  // kept so the whole app can be made unreachable while a panel is open
    // top bar
    els.crumb = h('div', { class: 'tb-crumb' });  // breadcrumb in the top bar: shows where you are, e.g. Chapter 3 > 3.2 title > step title
    els.chaps = h('div', { class: 'tb-chaps' });  // holder for the numbered chapter buttons in the top bar
    els.theme = iconBtn('moon', 'Toggle dark mode (D)', toggleTheme);  // dark/light mode button; D on the keyboard does the same
    els.notesBtn = h('button', { class: 'tb-btn', title: 'Section notes (N)', 'aria-label': 'Section notes', onclick: () => openDrawer('notes'), html: ICON.notes + '<span class="tb-hide-narrow">Notes</span>' });  // Notes button: opens the notes panel for the current section; its word label is hidden on phone-width screens
    const top = h('header', { id: 'topbar' },  // the top bar, with its buttons in left-to-right order
      iconBtn('menu', 'Contents (T)', () => openDrawer('toc')),  // menu button that opens the table of contents (T on the keyboard)
      h('button', { class: 'tb-brand', onclick: () => go(0), title: 'Home', 'aria-label': 'Home' }, h('span', { class: 'tb-hide-narrow' }, 'Operating Systems'), h('span', { class: 'tb-show-narrow' }, 'OS')),  // brand button that goes to the home page: shows "Operating Systems", or just "OS" on phone-width screens
      h('div', { class: 'tb-sep tb-hide-narrow' }),  // thin divider line, hidden on phone-width screens
      els.crumb,  // the breadcrumb built above
      els.chaps,  // the chapter buttons built above
      h('div', { class: 'tb-sep tb-hide-narrow' }),  // a second divider, hidden on phone-width screens
      h('button', { class: 'tb-btn', title: 'Glossary (G)', onclick: () => openDrawer('gloss'), html: ICON.book + '<span class="tb-hide-narrow">Glossary</span>' }),  // Glossary button with a book icon; G on the keyboard does the same
      els.notesBtn,  // the Notes button built above
      els.theme,  // the dark/light mode button built above
      iconBtn('full', 'Full screen (F)', toggleFull, 'tb-btn tb-hide-narrow'),  // full screen button (F on the keyboard), hidden on phone-width screens
      iconBtn('help', 'Help and shortcuts (?)', () => openModal()),  // help button that opens the help window with every shortcut (? on the keyboard)
    );  // ends the top bar
    // stage
    els.canvas = h('div', { id: 'canvas' });  // canvas: the fixed 1200 x 640 box every slide is drawn into; it is scaled up or down as a whole
    els.wrap = h('div', { id: 'canvasWrap' }, els.canvas);  // canvasWrap: takes the canvas's scaled size, so the page layout around it is correct
    els.stage = h('main', { id: 'stage' }, els.wrap);  // stage: the middle area of the page between the two bars, which holds the canvas
    // bottom bar
    els.prev = h('button', { class: 'bb-nav', onclick: () => step(-1), title: 'Previous (Left arrow)' });  // Back button in the bottom bar (Left arrow does the same)
    els.next = h('button', { class: 'bb-nav primary', onclick: () => step(1), title: 'Next (Right arrow)' });  // Next button, highlighted as the main action (Right arrow does the same)
    els.dots = h('div', { class: 'bb-dots' });  // row of step dots, one per step of the current section
    els.count = h('div', { class: 'bb-count' });  // small counter text, e.g. "3.2 · step 4 of 9"
    els.prog = h('div', { class: 'bb-prog' });  // thin progress bar along the bottom bar; its width shows how far through the whole slide list you are
    const bot = h('footer', { id: 'botbar' }, els.prog, els.prev, h('div', { class: 'bb-mid' }, els.dots, els.count), els.next);  // the bottom bar: progress bar, Back, the dots with the counter in the middle, then Next
    app.append(top, els.stage, bot);  // puts the top bar, stage and bottom bar into the app box in that order

    // drawers
    els.scrim = h('div', { class: 'scrim', onclick: closeAll });  // scrim: the dimmed backdrop behind an open panel; clicking it closes the panel
    els.tocSearch = h('input', { class: 'dr-search', placeholder: 'Filter sections…', 'aria-label': 'Filter sections', oninput: renderToc });  // search box of the contents panel: filters the section list as you type
    els.tocBody = h('div', { class: 'dr-body' });  // holder for the list of chapters and sections in the contents panel
    els.toc = h('aside', { class: 'drawer left', 'aria-label': 'Contents' },  // contents panel: slides in from the left side of the screen
      h('div', { class: 'dr-head' }, h('h3', 'Contents'), iconBtn('close', 'Close', closeAll)),  // panel header: the title Contents and a close button
      h('div', { style: { padding: '10px 12px 0' } }, els.tocSearch), els.tocBody);  // the search box with a little padding, then the list
    els.glSearch = h('input', { class: 'dr-search', placeholder: 'Search terms and definitions…', 'aria-label': 'Search glossary', oninput: renderGloss });  // search box of the glossary panel: filters terms and definitions as you type
    els.glBody = h('div', { class: 'dr-body' });  // holder for the glossary list
    els.gloss = h('aside', { class: 'drawer right', 'aria-label': 'Glossary' },  // glossary panel: slides in from the right side of the screen
      h('div', { class: 'dr-head' }, h('h3', 'Glossary'), iconBtn('close', 'Close', closeAll)),  // panel header: the title Glossary and a close button
      h('div', { style: { padding: '10px 12px 0' } }, els.glSearch), els.glBody);  // the search box with a little padding, then the term list
    els.notesBody = h('div', { class: 'dr-body notes-doc' });  // holder for the current section's notes, styled like a document
    els.notesTitle = h('h3', 'Section notes');  // title of the notes panel, changed to the section name when it opens
    els.notes = h('aside', { class: 'drawer right', 'aria-label': 'Section notes' },  // notes panel: also slides in from the right side
      h('div', { class: 'dr-head' }, els.notesTitle, iconBtn('close', 'Close', closeAll)), els.notesBody);  // panel header with the notes title and a close button, then the notes themselves
    els.modal = h('div', { class: 'modal', onclick: (e) => { if (e.target === els.modal) closeAll(); } });  // help window background: a click on the dark area outside the card (not on the card itself) closes it
    els.pop = h('div', { class: 'term-pop', role: 'tooltip', id: 'term-pop' });  // term pop-up: the small box that shows a definition when a dotted word is hovered, tapped or opened from the keyboard; the id lets the word point screen readers at it
    els.live = h('div', { class: 'sr-only', 'aria-live': 'polite', 'aria-atomic': 'true' });  // live: an invisible announcer; screen readers read out whatever is written into it, used to name the new slide when keyboard focus stays on a bar button
    els.toast = h('div', { class: 'toast', role: 'status' });  // toast: a short message that appears for about two seconds (role status makes screen readers announce it)
    const markers = frag(`<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${  // markers: an invisible SVG holding arrowheads that diagrams attach to the ends of lines
      ['', 'cpu', 'mem', 'io', 'os', 'proc', 'thread', 'intr', 'ok', 'bad', 'warn', 'accent', 'muted'].map((c) => {  // one arrowhead per colour name: the default, the parts of the colour legend, and the ok/bad/warn/accent/muted tones
        const col = c === '' ? 'var(--ink-2)' : c === 'muted' ? 'var(--line-2)' : `var(--${c})`;  // the fill colour: dark ink for the default, a pale line colour for muted, otherwise the colour variable of that name
        return `<marker id="arr${c ? '-' + c : ''}" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" style="fill:${col}"/></marker>`;  // one arrowhead (id arr or arr-cpu, arr-mem...): a small triangle that turns to follow the line it ends
      }).join('')}</defs></svg>`);  // joins all arrowheads into one string and closes the hidden SVG
    document.body.append(markers, app, els.scrim, els.toc, els.gloss, els.notes, els.modal, els.pop, els.toast, els.live);  // puts everything on the page: the arrowheads, the app, the backdrop, the three panels, the help window and the two pop-ups
  }  // ends buildFrame

  /* ------------------------------------------------------------ chrome */
  function setChapterColor(n) {  // setChapterColor(n): sets the CSS variable --chc to chapter n's colour, so headings and highlights match the chapter
    document.documentElement.style.setProperty('--chc', n ? `var(--ch${n})` : 'var(--accent)');  // chapter n uses its own colour; pages outside a chapter (home, final) use the general accent colour
  }  // ends setChapterColor
  function slideChapter(sl) { return sl && sl.ch ? sl.ch.num : 0; }  // slideChapter(sl): the chapter number of a slide, or 0 for home and the final challenge
  function slideLabel(sl) {  // slideLabel(sl): the short name of a slide used in the breadcrumb and the Back/Next buttons
    if (!sl) return '';  // no slide, no label
    if (sl.type === 'step') return sl.sec.pseudo ? sl.sec.title : lab(sl.sec) + ' ' + sl.sec.title;  // a step is named after its section, like "3.2 Process States"; chapter intro steps use the chapter title
    return sl.title;  // other slides use their own title
  }  // ends slideLabel
  function updateChrome() {  // updateChrome(): refreshes everything around the slide (breadcrumb, chapter buttons, dots, Back/Next) after each move
    const sl = slides[cur];  // sl is the slide now on screen
    const n = slideChapter(sl);  // n is its chapter number (0 outside chapters)
    setChapterColor(n);  // colours the page for that chapter
    // crumb
    if (sl.type === 'home') els.crumb.innerHTML = `<b>Chapters ${esc(BOOK.range)}</b> · interactive guide`;  // on the home page the breadcrumb just names the guide
    else if (sl.type === 'step') els.crumb.innerHTML = `Chapter ${n} › <b>${esc(slideLabel(sl))}</b> › ${esc(sl.step.title)}`;  // on a step: chapter, section name in bold, then step title; esc keeps any special characters as plain text
    else els.crumb.innerHTML = (n ? `Chapter ${n} › ` : '') + `<b>${esc(sl.title)}</b>`;  // on other slides: the chapter (when there is one) and the slide title in bold
    // chapter buttons
    els.chaps.innerHTML = '';  // clears the chapter buttons before drawing them again
    for (const c of sortedChapters()) {  // one button per chapter, in order
      els.chaps.append(h('button', { class: 'tb-chap' + (c.num === n ? ' on' : ''), style: { '--c': `var(--ch${c.num})` }, title: `Chapter ${c.num}: ${c.title}`, onclick: () => go(slideIndex('ch' + c.num)) }, String(c.num)));  // a small numbered button in the chapter's colour, lit up for the current chapter; it jumps to that chapter's overview
    }  // ends the loop over chapters
    // dots
    els.dots.innerHTML = '';  // clears the step dots before drawing them again
    if (sl.type === 'step') {  // dots appear only on step slides
      const steps = sl.sec.steps;  // the steps of the current section
      steps.forEach((st, i) => {  // one dot per step
        const key = sl.sec.id + '/' + (i + 1);  // the key of that step's slide
        const skip = coreRoute() && !isCore(slides[slideIndex(key)]);  // true when the core path is on and this step is not part of it, so its dot is shown faded
        els.dots.append(h('button', { class: 'bb-dot' + (i === sl.i ? ' on' : '') + (store.data.visited[key] ? ' seen' : '') + (skip ? ' skip' : ''), title: `${i + 1}. ${st.title}${skip ? ' (not on the core path)' : ''}`, 'aria-label': `Step ${i + 1}: ${st.title}`, onclick: () => go(slideIndex(key)) }));  // one dot: lit for the current step, filled once visited, faded if off the core path; hovering names the step, a click jumps there
      });  // ends the loop over steps
      els.count.textContent = `${sl.sec.pseudo ? 'Ch ' + n : lab(sl.sec)} · step ${sl.i + 1} of ${steps.length}${coreRoute() ? ' · core path' : ''}`;  // counter under the dots, e.g. "3.2 · step 4 of 9" (chapter intro steps say "Ch 3"), plus a note when on the core path
    } else els.count.textContent = `${cur + 1} / ${slides.length}`;  // on non-step slides the counter shows the slide's position in the whole guide instead, e.g. "12 / 240"
    // prev / next
    const p = cur > 0 ? slides[neighbor(-1)] : null, nx = cur < slides.length - 1 ? slides[neighbor(1)] : null;  // p and nx: the slides Back and Next would open (skipping off-path steps on the core path); null at either end
    const label = (t, other) => {  // label(t, other): the text for a Back/Next button that leads to slide other
      if (!other) return '';  // no slide in that direction, no text
      if (other.type === 'step' && sl.type === 'step' && other.sec === sl.sec) return t;  // within the same section the button just says Back or Next
      return `${t}: ${slideLabel(other)}`;  // crossing into another section or page, the button also names where it leads, e.g. "Next: 3.3 Process Description"
    };  // ends label
    els.prev.innerHTML = ICON.left + `<span>${esc(label('Back', p) || 'Back')}</span>`;  // Back button: left arrow icon plus its label (esc keeps the label plain text)
    els.next.innerHTML = `<span>${esc(label('Next', nx) || 'Next')}</span>` + ICON.right;  // Next button: its label followed by a right arrow icon
    els.prev.disabled = !p; els.next.disabled = !nx;  // greys out Back on the first slide and Next on the last one
    els.prog.style.width = ((cur + 1) / slides.length) * 100 + '%';  // stretches the progress bar to match how far through the guide the student is
    els.notesBtn.style.display = sl.type === 'step' && sl.sec.notes ? '' : 'none';  // shows the Notes button only on steps of a section that has notes
    if (els.toc.classList.contains('on')) renderToc();  // if the contents panel is open, redraws it so the current section is highlighted
  }  // ends updateChrome

  /* ------------------------------------------------------------ navigation */
  let keep = { key: null, data: null };  // keep: a small store a step can fill with its own state (an edited workload, a chosen tab) so it survives a redraw caused by crossing the phone-width breakpoint
  function go(idx, opt = {}) {  // go(idx, opt): the one function that changes the slide; everything else (buttons, keys, links) calls it
    if (!slides.length) return;  // does nothing before the slide list exists
    idx = clamp(idx | 0, 0, slides.length - 1);  // turns idx into a whole number and keeps it inside the list
    const first = cur < 0, before = document.activeElement;  // first: true for the very first slide shown; before: whatever had keyboard focus, checked again once the new slide is drawn
    if (curCtx) { curCtx._destroy(); curCtx = null; }  // tells the old slide to stop its timers, animations and listeners before it is removed
    hideTerm();  // hides any open definition pop-up
    if (els.toast) { clearTimeout(toast.t); els.toast.classList.remove('on'); }  // hides any toast message that belongs to the old slide
    cur = idx;  // records the new position
    const sl = slides[cur];  // sl is the slide about to be shown
    if (!(opt.relayout && keep.key === sl.key)) keep = { key: sl.key, data: Object.create(null) };  // every normal visit starts with an empty keep store; only a redraw of the same slide for a new layout hands back the old one
    try { history.replaceState(null, '', '#' + sl.key); } catch (e) { /* file:// sandbox */ }
    // remember the last LEARNING page (never home/overview), overall and per chapter, so Continue can resume it
    if (LEARN[sl.type]) {  // only learning slides (steps, key terms, challenges) count as places to come back to
      store.data.last = sl.key;  // remembers it as the last place overall, for the home page's Continue button
      if (sl.ch) { store.data.chLast = store.data.chLast || {}; store.data.chLast[sl.ch.num] = sl.key; }  // and as the last place in its chapter, for the chapter overview's Continue button
    }  // ends the learning-slide check
    store.data.visited[sl.key] = 1;  // marks this slide as visited (used for progress bars, dot fill and done marks)
    store.save();  // saves progress to the browser (the save waits a moment so rapid clicks cause one write)
    renderSlide(sl);  // draws the new slide into the canvas
    updateChrome();  // refreshes the bars and buttons around it
    if (!first) {  // after the first slide, keep keyboard and screen-reader users oriented
      const lost = !before || before === document.body || !before.isConnected;  // lost: focus was on nothing, or on part of the old slide that has just been removed
      const head = els.canvas.querySelector('.step-title');  // head: the new slide's title
      if (lost && head) head.focus({ preventScroll: true });  // moves focus to the new title, so the next Tab starts at the top of the new content and screen readers read the heading
      else if (!opt.relayout) els.live.textContent = slideLabel(sl) + (sl.type === 'step' ? `, step ${sl.i + 1} of ${sl.sec.steps.length}: ${sl.step.title}` : '');  // focus stayed put (on a bar button, say): the announcer names the new slide instead
    }  // ends the orientation step
    if (!opt.keepFocus) els.stage.scrollTop = 0;  // scrolls the stage back to the top, unless the caller asked to keep the current scroll (used when redrawing in place)
  }  // ends go
  const LEARN = { step: 1, terms: 1, chquiz: 1, final: 1 };  // LEARN: the slide types that count as learning pages for Continue; home and chapter overviews are left out
  // the core route keeps each section's Big Picture, steps flagged core:true, the recap and the quiz
  function isCore(sl) {  // isCore(sl): true if a slide is on the shorter core path
    if (!sl || sl.type !== 'step' || sl.sec.pseudo) return true;  // every non-step slide and every chapter intro step is always on the core path
    const st = sl.step;  // st is the step shown by this slide
    return !!st.core || st.kind === 'story' || st.kind === 'recap' || st.kind === 'check' || !!st.quiz || sl.i === 0;  // a step is core if flagged core, is a Big Picture, Recap or Check step, holds a quiz, or is the section's first step
  }  // ends isCore
  Guide.isCore = isCore;  // exposed so tests and sections can ask whether a slide is on the core path
  const coreRoute = () => store.data.route === 'core';  // coreRoute(): true when the student has chosen the core path instead of the full course
  function neighbor(d) {  // neighbor(d): the slide one step back (d = -1) or forward (d = 1), taking the chosen route into account
    let i = cur + d;  // starts with the slide right next to the current one
    if (coreRoute()) while (i > 0 && i < slides.length - 1 && !isCore(slides[i])) i += d;  // on the core path, keeps moving in the same direction past steps that are not core (never past either end)
    return i;  // returns the position found
  }  // ends neighbor
  function step(d) { go(neighbor(d)); }  // step(d): moves one slide back or forward along the chosen route; used by Back, Next and the arrow keys
  function setRoute(r) { store.data.route = r; store.save(); const sl = slides[cur]; if (sl && (sl.type === 'home' || sl.type === 'chapter')) go(cur, { keepFocus: true }); else updateChrome(); }  // setRoute(r): switches between the full course and the core path; home and overview pages redraw to update their counts
  function sectionJump(d) {  // sectionJump(d): the [ and ] keys, which jump to the start of the previous or next section
    const sl = slides[cur];  // sl is the slide on screen now
    let i = cur + d;  // starts looking one slide away in the chosen direction
    const id = (x) => (x.type === 'step' ? x.sec.id : x.key);  // id(x): which section a slide belongs to; a slide that is not a step counts as its own group
    while (i >= 0 && i < slides.length && id(slides[i]) === id(sl)) i += d;  // walks past every remaining slide of the current section
    if (d < 0) { const target = slides[i]; if (!target) return; while (i > 0 && id(slides[i - 1]) === id(target)) i--; }  // going back, keeps walking to the first slide of the section reached, so the jump lands on its start
    go(i);  // opens the slide found
  }  // ends sectionJump
  Guide.go = (key) => { const i = typeof key === 'number' ? key : slideIndex(key); if (i >= 0) go(i); };  // Guide.go(key): lets sections jump to a slide by key (like '3.2/1') or by position
  Guide.next = () => step(1);  // Guide.next(): lets a section move to the next slide, as if the student clicked Next
  Guide.prev = () => step(-1);  // Guide.prev(): lets a section move to the previous slide

  /* ------------------------------------------------------------ fitting */
  function fit() {  // fit(): scales the fixed-size canvas to fill the stage, or switches to the phone-width layout on small screens
    const sw = els.stage.clientWidth, sh = els.stage.clientHeight;  // the stage's current width and height in pixels
    const pad = 14;  // keeps a 14-pixel margin around the canvas
    let sc = Math.min((sw - pad * 2) / CANVAS_W, (sh - pad * 2) / CANVAS_H);  // the largest scale at which the whole 1200 x 640 canvas still fits inside the stage
    const narrow = sc < 0.7;  // below 70% the text would be too small to read, so the page switches to the phone-width layout instead
    const changed = narrow !== Guide.narrow;  // remembers whether this call switched layouts, so the caller knows to redraw
    Guide.narrow = narrow;  // publishes the layout choice so sections can lay themselves out for it
    document.body.classList.toggle('narrow', narrow);  // adds or removes the phone-layout class on the page body; the CSS then stacks content in one scrolling column
    if (narrow) {  // phone-width layout
      els.canvas.style.transform = ''; els.wrap.style.width = ''; els.wrap.style.height = ''; Guide.scale = 1;  // no scaling: clears the transform and the wrapper's fixed size so the phone-width CSS can lay the canvas out; scale is 1
    } else {  // desktop layout
      sc = Math.min(sc, 1.8);  // never zooms past 180%, so a huge monitor does not blow the page up
      Guide.scale = sc;  // remembers the scale for code that needs to convert screen pixels into canvas pixels
      els.canvas.style.transform = `scale(${sc})`;  // CSS transform: shrinks or enlarges the canvas as a picture, keeping its inner layout exactly the same
      els.wrap.style.width = CANVAS_W * sc + 'px';  // the wrapper takes the scaled width, because a transform does not change how much space the element takes up
      els.wrap.style.height = CANVAS_H * sc + 'px';  // and the scaled height, for the same reason
    }  // ends the two layouts
    return changed;  // tells the caller whether the layout changed
  }  // ends fit
  let fitT = null;  // fitT: timer used to wait until resizing has paused
  function onResize() {  // onResize(): runs when the window or stage changes size
    clearTimeout(fitT);  // cancels the previous waiting timer, so a drag-resize triggers only one refit at the end
    fitT = setTimeout(() => {  // waits 60 milliseconds of calm, then refits
      if (fit() && cur >= 0) {  // if the layout switched between desktop and phone-width, some slides must be redrawn
        const sl = slides[cur];  // sl is the slide on screen
        const layoutAware = sl.type === 'home' || sl.type === 'chapter' || (sl.type === 'step' && (sl.sec.layoutAware || (sl.sec.pseudo && sl.ch && sl.ch.layoutAware) || /narrow/.test(String(sl.step.render || '') + String(sl.step.html || ''))));  // redraw needed: home, overviews, sections marked layout-aware by the build, or steps whose code reads the phone-width flag
        if (layoutAware) go(cur, { keepFocus: true, relayout: true }); // quizzes restore from saved state, steps can restore from ctx.keep; other slides just reflow with CSS
      } else checkOverflow();  // no layout switch: just re-checks whether the content still fits
    }, 60);  // ends the 60 ms wait
  }  // ends onResize
  function checkOverflow() {  // checkOverflow(): notices when a slide's content is too big for the fixed body, and lets it scroll instead of cutting it off
    const body = els.canvas.querySelector('.step-body');  // body is the content area of the slide on screen
    if (!body || Guide.narrow) return;  // skips the check when there is no slide body, or on phone-width screens where the page simply scrolls
    body.classList.remove('overflowing');  // clears the earlier verdict so the measurement starts fresh
    const over = body.scrollHeight - body.clientHeight;  // how many pixels of content stick out below the visible body
    const overW = body.scrollWidth - body.clientWidth;  // how many pixels stick out past its right edge
    if (over > 2 || overW > 2) {  // more than 2 pixels either way counts as a real overflow (tiny rounding differences are ignored)
      body.classList.add('overflowing');  // the overflowing class turns on scrollbars so nothing is cut off
      console.warn(`[fit] ${slides[cur] && slides[cur].key} overflows the step body by ${over}px vertically, ${overW}px horizontally`);  // warns in the console with the slide key and the sizes, so authors can find and shorten the slide
    }  // ends the overflow case
  }  // ends checkOverflow

  /* ------------------------------------------------------------ step context */
  function makeCtx(body, sl) {  // makeCtx(body, sl): builds ctx, the toolbox handed to each step's render function; it tracks everything the step starts
    const cleanups = [];  // cleanups: functions to run when the student leaves the slide (stop timers, remove listeners...)
    const ctx = {  // the ctx object itself
      el: body, slide: sl, sec: sl.sec, step: sl.step, narrow: Guide.narrow, alive: true,  // the step's body box, slide, section and step, the phone-width layout flag, and alive, which turns false once the slide is left
      keep: keep.data,  // ctx.keep: the slide's keep store (see go); empty on a normal visit, carried over when the slide is redrawn for a phone-width or desktop layout
      h, s, frag, esc, util: Guide.util, ICON,  // the element builders and helpers, so section code can write ctx.h(...) without reaching for Guide
      $: (sel) => body.querySelector(sel),  // ctx.$(sel): the first element inside this step that matches a CSS selector
      $$: (sel) => Array.from(body.querySelectorAll(sel)),  // ctx.$$(sel): every matching element inside this step, as a real list
      cleanup(fn) { cleanups.push(fn); },  // ctx.cleanup(fn): lets a step register its own tidy-up work for when the slide closes
      every(ms, fn) { const id = setInterval(() => { if (ctx.alive) fn(); }, ms); cleanups.push(() => clearInterval(id)); return id; },  // ctx.every(ms, fn): repeats fn every ms milliseconds while the slide is open, and stops it automatically when left
      after(ms, fn) { const id = setTimeout(() => { if (ctx.alive) fn(); }, ms); cleanups.push(() => clearTimeout(id)); return id; },  // ctx.after(ms, fn): runs fn once after ms milliseconds, unless the student has left the slide by then
      sleep(ms) { return new Promise((res) => ctx.after(ms, res)); },  // ctx.sleep(ms): a promise that resolves after ms, so animations can be written as a sequence of await steps
      on(target, ev, fn, o) { target.addEventListener(ev, fn, o); cleanups.push(() => target.removeEventListener(ev, fn, o)); },  // ctx.on(target, ev, fn): adds an event listener that is removed automatically when the slide closes
      raf(fn) {  // ctx.raf(fn): runs fn on every animation frame (about 60 times a second) until fn returns false or the slide closes
        let id; let live = true;  // id is the pending frame request; live turns false when this loop is stopped
        const loop = (t) => { if (!live || !ctx.alive) return; if (fn(t) === false) return; id = requestAnimationFrame(loop); };  // loop: quits if stopped or the slide was left, calls fn with the time, then asks the browser for the next frame
        id = requestAnimationFrame(loop);  // requests the first frame
        const stop = () => { live = false; cancelAnimationFrame(id); };  // stop(): ends this loop and cancels any frame already requested
        cleanups.push(stop); return stop;  // stop runs automatically when the slide closes, and is also returned so the step can end the loop early
      },  // ends ctx.raf
      toast,  // ctx.toast(msg): shows a short message at the bottom of the screen
      refit: checkOverflow,  // ctx.refit(): re-checks whether the step's content still fits, for use after a step changes its own size
      _destroy() { ctx.alive = false; cleanups.splice(0).reverse().forEach((f) => { try { f(); } catch (e) { console.error(e); } }); },  // _destroy(): called by go() when leaving; marks the step dead and runs every cleanup in reverse order, logging any failure
    };  // ends the ctx object
    ctx.ui = {};  // ctx.ui: the shared widgets (tabs, sliders, players, quizzes...) with this step's ctx already filled in
    for (const [k, fn] of Object.entries(UI)) ctx.ui[k] = (...a) => fn(ctx, ...a);  // wraps each widget so a step can write ctx.ui.slider({...}) instead of passing ctx itself
    return ctx;  // hands the finished toolbox to the caller
  }  // ends makeCtx

  /* ------------------------------------------------------------ rendering */
  function renderSlide(sl) {  // renderSlide(sl): clears the canvas and draws one slide: the heading above, the content below
    const c = els.canvas;  // c is the canvas box
    c.className = '';  // removes any section-specific class left by the previous slide
    c.removeAttribute('data-sec');  // and the section label used by section styles
    c.innerHTML = '';  // empties the canvas
    const body = h('div', { class: 'step-body' });  // the content area, a fixed 1152 x 540 box on desktop screens
    const eyebrow = h('div', { class: 'step-eyebrow' });  // the small line above the title: section number, section name and the kind of step
    const title = h('h2', { class: 'step-title', tabindex: '-1' });  // the slide title; tabindex -1 lets the guide move focus to it after a slide change without adding it to the Tab order
    c.append(h('header', { class: 'step-head' }, eyebrow, title), body);  // puts the heading (small line plus title) and the content area into the canvas
    const ctx = makeCtx(body, sl);  // builds the toolbox for this slide
    curCtx = ctx;  // remembers it so go() can shut it down when the student moves on
    try {  // anything that goes wrong while drawing is caught below, so one broken step does not break the whole guide
      if (sl.type === 'home') { eyebrow.innerHTML = '<span class="kind">Welcome</span>'; title.textContent = 'Operating Systems · Chapters ' + BOOK.range.replace('–', '\u2060–\u2060'); renderHome(body, ctx); }  // home page: a Welcome label, the guide title (invisible word joiners keep a range such as "1-5" on one line) and the home content
      else if (sl.type === 'chapter') { eyebrow.innerHTML = `<span class="sid">Chapter ${sl.ch.num}</span><span class="kind">${KIND.intro}</span>`; title.textContent = `Chapter ${sl.ch.num}: ${sl.ch.title}`; renderChapter(body, ctx, sl.ch); }  // chapter overview: chapter number and "Chapter Overview" label, the chapter title, then the overview content
      else if (sl.type === 'terms') { eyebrow.innerHTML = `<span class="sid">Chapter ${sl.ch.num}</span><span class="kind">${KIND.terms}</span>`; title.textContent = 'Key terms: flip, recall, repeat'; renderTerms(body, ctx, sl.ch); }  // key-term flashcards for a chapter
      else if (sl.type === 'chquiz') { eyebrow.innerHTML = `<span class="sid">Chapter ${sl.ch.num}</span><span class="kind">${KIND.review}</span>`; title.textContent = `Chapter ${sl.ch.num} challenge: mixed questions from every section`; renderChQuiz(body, ctx, sl.ch); }  // chapter challenge quiz, mixing questions from every section of the chapter
      else if (sl.type === 'final') { eyebrow.innerHTML = `<span class="kind">${KIND.final}</span>`; title.textContent = `Final challenge: all ${BOOK.countWord} chapters`; renderFinal(body, ctx); }  // final challenge quiz across every chapter of this volume
      else if (sl.type === 'step') {  // an ordinary step of a section (or a chapter intro step)
        const sec = sl.sec, st = sl.step;  // sec and st: the section and the step being shown
        c.className = 'sec-' + String(sec.id).replace('.', '-');  // gives the canvas a class like sec-3-2, so a section's own styles can target only its slides
        c.dataset.sec = sec.id;  // and a data-sec attribute holding the plain id
        eyebrow.innerHTML = `<span class="sid">${esc(sec.pseudo ? 'Chapter ' + sec.chapter : lab(sec))}</span><span>${esc(sec.pseudo ? 'Overview' : sec.title)}</span><span>·</span><span class="kind">${esc(KIND[st.kind] || st.kind || 'Learn')}</span>`;  // small line: section id and name (or chapter and "Overview"), a dot, then the step kind label from KIND
        title.textContent = st.title;  // the step's title
        if (st.html) body.append(frag(typeof st.html === 'function' ? st.html(ctx) : st.html));  // fixed content: the step's html (text or a function that returns text) is turned into elements and added
        if (st.quiz) body.append(quiz(ctx, st.quiz, { key: sl.key, source: null }));  // quiz content: builds a quiz from the step's questions; the slide key keeps its saved answers apart from other quizzes
        if (st.render) { const r = st.render(body, ctx); if (typeof r === 'function') ctx.cleanup(r); }  // interactive content: calls the step's render function; if it returns a function, that runs when the slide closes
      }  // ends the step case
    } catch (e) {  // a step crashed while drawing
      console.error(e);  // prints the full error in the console
      renderErrors.push({ key: sl.key, msg: String(e && e.stack || e) });  // records it for the automated checker
      body.append(h('div', { class: 'err-card' }, `This step hit an error while rendering:\n${e && e.message}`));  // shows a visible error card in place of the broken content, with the error's message
    }  // ends the error handling
    fit();  // scales the canvas to the window (the slide may be new after a resize)
    checkOverflow();  // checks right away whether the content fits
    ctx.after(350, checkOverflow);  // and again after 350 ms, once fonts and pictures have finished loading and the layout has settled
  }  // ends renderSlide

  /* ------------------------------------------------------------ home */
  const onRoute = (x) => x.type === 'step' && (!coreRoute() || isCore(x));  // onRoute(x): true for a step that counts toward progress on the chosen route (every step, or only core ones)
  function progressOfChapter(n) {  // progressOfChapter(n): the share (0 to 1) of chapter n's steps on the chosen route that the student has visited
    const keys = slides.filter((x) => x.ch && x.ch.num === n && onRoute(x)).map((x) => x.key);  // the keys of the chapter's steps on the chosen route
    if (!keys.length) return 0;  // a chapter with no steps counts as 0
    return keys.filter((k) => store.data.visited[k]).length / keys.length;  // visited steps divided by all steps gives the fraction shown in progress bars
  }  // ends progressOfChapter
  // quiz mastery: best first-try score saved for each section's check step
  function secMastery(sec) {  // secMastery(sec): adds up the saved quiz results of one section, or null if its quizzes were never tried
    let best = 0, total = 0, seen = false;  // best: first-try correct answers; total: questions; seen: whether any saved result still matches
    let learned = 0;  // learned: questions answered correctly at some point, including after retries
    sec.steps.forEach((st, i) => { if (!st.quiz) return; const rec = store.data.quiz[sec.id + '/' + (i + 1)]; total += st.quiz.length; if (rec && rec.fp === quizFp(st.quiz)) { seen = true; best += rec.best || 0; learned += Math.max(rec.learned || 0, rec.best || 0); } });  // for each quiz step: counts its questions, and adds the saved result only if the quiz fingerprint still matches
    return seen && total ? { best, total, learned, pct: best / total } : null;  // returns the totals with pct, the first-try fraction, or null when there is nothing to report
  }  // ends secMastery
  function masteryChip(m) {  // masteryChip(m): a small coloured tag like "quiz 7/10" for the contents panel and chapter overview
    if (!m) return null;  // no results, no tag
    const cls = m.pct >= 0.8 ? 'ok' : m.pct >= 0.5 ? 'warn' : 'bad';  // green at 80% or more, amber from 50%, red below that
    return h('span', { class: 'chip ' + cls, title: `First try: best ${m.best} of ${m.total} right on a first attempt${m.learned != null ? ` · learned: ${m.learned} of ${m.total} answered correctly after retries` : ''}` }, `quiz ${m.best}/${m.total}`);  // the tag; hovering it explains the first-try score and how many were learned after retries
  }  // ends masteryChip
  function chapterMastery(n) {  // chapterMastery(n): combines the quiz results of every section in chapter n
    const ms = sectionsOf(n).map(secMastery).filter(Boolean);  // the results of the sections that have been tried
    if (!ms.length) return null;  // none tried yet: nothing to report
    const best = ms.reduce((a, m) => a + m.best, 0), total = ms.reduce((a, m) => a + m.total, 0);  // adds up first-try correct answers and question counts across the tried sections
    return { tried: ms.length, of: sectionsOf(n).length, pct: best / total };  // returns how many sections were tried, out of how many, and the combined first-try fraction
  }  // ends chapterMastery
  Guide.mastery = { secMastery, chapterMastery };  // exposed so sections and tests can read quiz mastery
  function openPrint() {  // openPrint(): opens the printable study guide, which is this same page with ?print added to its address
    const u = location.href.split('#')[0].split('?')[0] + '?print';  // builds that address: the current one without any #slide or ?query part, plus ?print
    const w = window.open(u, '_blank');  // tries to open it in a new browser tab
    if (!w) location.href = u;  // if a pop-up blocker stopped the new tab, opens it in this tab instead
  }  // ends openPrint
  Guide.openPrint = openPrint;  // exposed so sections can offer the printable guide too
  function routeSeg() {  // routeSeg(): the "Route: Full course / Core path" switch shown on the home page and in the help window
    const coreCount = slides.filter((x) => x.type === 'step' && isCore(x)).length;  // how many steps the core path has
    const fullCount = slides.filter((x) => x.type === 'step').length;  // how many steps the full course has
    return h('div', { class: 'row gap-s', style: { alignItems: 'center' } },  // a row that keeps the label and the switch side by side
      h('span', { class: 'small b' }, 'Route:'),  // the label in small bold text
      UI.seg(null, [{ value: 'full', label: `Full course (${fullCount})`, title: `Every step: ${fullCount} screens` }, { value: 'core', label: `Core path (${coreCount})`, title: `Big picture, key hands-on steps, recap and quiz of every section: ${coreCount} screens` }], store.data.route === 'core' ? 'core' : 'full', (v) => setRoute(v)));  // a two-button switch with the step count on each; hovering explains each route; a click calls setRoute
  }  // ends routeSeg
  function renderHome(body, ctx) {  // renderHome(body, ctx): draws the home page: welcome text, Continue button, progress, chapter cards, colour key, help
    const secCount = Object.keys(Guide.sections).length;  // how many sections are registered, for the badge at the top
    const stepKeys = slides.filter((x) => x.type === 'step').map((x) => x.key);  // the keys of every step slide
    const overall = stepKeys.length ? stepKeys.filter((k) => store.data.visited[k]).length / stepKeys.length : 0;  // overall progress: the fraction of all steps visited
    const coreKeys = slides.filter((x) => x.type === 'step' && isCore(x)).map((x) => x.key);  // the keys of the core-path steps
    const routeDone = coreKeys.length ? coreKeys.filter((k) => store.data.visited[k]).length / coreKeys.length : 0;  // core-path progress: the fraction of core steps visited
    const lastIdx = store.data.last && store.data.last !== 'home' ? slideIndex(store.data.last) : -1;  // where the student last was, if it still exists (-1 if never, or if it was the home page)
    const firstStep = slides.findIndex((x) => x.type === 'chapter');  // the first chapter overview, where a new student starts
    const resume = lastIdx > 0 ? lastIdx : firstStep;  // the slide the big button leads to: the last place if there is one, otherwise the first chapter
    const resumeSl = slides[resume];  // the slide object for that button's label
    const wrap = h('div', { class: 'stack fill', style: { gap: '14px' } });  // wrap: a column holding everything on the home page, 14 pixels apart
    wrap.append(h('div', { class: 'row nw home-top', style: { justifyContent: 'space-between', alignItems: 'flex-end', gap: '24px' } },  // the top row: welcome text on the left, the Continue button and progress on the right
      h('div', { class: 'home-hero' },  // welcome block (hero)
        h('div', { class: 'row gap-s' }, h('span', { class: 'chip accent' }, `${sortedChapters().length} chapters · ${secCount} sections`), h('span', { class: 'chip' }, 'explain → explore → check')),  // two badges: the chapter and section counts, and the explain, explore, check pattern every section follows
        h('h1', { style: { marginTop: '6px' } }, 'See how an operating system really works.'),  // the big headline
        h('p', {}, `An interactive companion to Chapters ${BOOK.range} of `, h('i', {}, 'Operating Systems: Internals and Design Principles'), '. Every section explains one idea in plain language, lets you run it yourself, then checks your understanding.')),  // intro paragraph: names the course reading this guide accompanies (title in italics) and how each section works
      h('div', { class: 'stack home-go', style: { alignItems: 'flex-end', gap: '8px', flex: 'none' } },  // the right-hand column of the top row
        resumeSl ? h('button', { class: 'btn primary lg', onclick: () => go(resume) }, lastIdx > 0 ? `Continue: ${slideLabel(resumeSl)}` : `Start with Chapter ${(sortedChapters()[0] || { num: 1 }).num}`, h('span', { html: ICON.right, style: { width: '18px', display: 'inline-flex' } })) : null,  // main button: "Continue: <where you left off>" for a returning student, "Start with Chapter N" (this volume's first chapter) for a new one
        h('div', { class: 'small muted' }, coreRoute()  // progress line under the button; its wording depends on the chosen route
          ? `Core path: ${Math.round(routeDone * 100)}% done · all steps: ${Math.round(overall * 100)}%`  // on the core path: percent of core steps done, plus percent of all steps
          : `Your progress: ${Math.round(overall * 100)}% of steps visited`),  // on the full course: percent of all steps visited
        h('div', { class: 'route-top' }, routeSeg()))));  // a copy of the route switch that the stylesheet shows only on phone-width screens; closes the right column and top row
    const cards = h('div', { class: 'chcards', style: { '--chn': String(Math.max(1, sortedChapters().length)) } });  // cards: the grid of chapter cards; --chn tells the style sheet how many columns (one per chapter in this volume)
    for (const c of sortedChapters()) {  // one card per chapter
      const secs = sectionsOf(c.num);  // the chapter's sections, listed on its card
      const pct = progressOfChapter(c.num);  // the chapter's progress on the chosen route
      cards.append(h('button', { class: 'chcard', style: { '--c': `var(--ch${c.num})` }, onclick: () => go(slideIndex('ch' + c.num)) },  // the card is one big button in the chapter's colour that opens the chapter overview
        h('div', { class: 'n' }, 'Chapter ' + c.num),  // small "Chapter 3" line at the top of the card
        h('div', { class: 'tt' }, c.title),  // the chapter title
        h('ul', {}, secs.map((x) => h('li', { style: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, `${lab(x)} ${x.short || x.title}`))),  // the list of sections, each cut short with "..." if too long for one line (a short title is used when given)
        h('div', { style: { marginTop: 'auto' } }, h('div', { class: 'meter' }, h('i', { style: { width: pct * 100 + '%' } })),  // a progress meter pushed to the bottom of the card, filled to the chapter's progress
          h('div', { class: 'xs muted', style: { marginTop: '3px' } }, `${Math.round(pct * 100)}% ${coreRoute() ? 'of core path' : 'visited'}`, (() => { const m = chapterMastery(c.num); return m ? ` · quizzes ${m.tried}/${m.of}, ${Math.round(m.pct * 100)}% right` : ''; })()))));  // progress in words, plus the chapter's quiz results when any quizzes were tried; closes the card
    }  // ends the loop over chapters
    cards.style.flex = '1'; cards.style.minHeight = '0';  // lets the card grid take all remaining height and shrink when space is tight
    wrap.append(cards);  // adds the card grid under the top row
    const fitHome = () => {  // fitHome(): if the home page is too tall for the canvas, turns on stronger and stronger compact styles until it fits
      if (Guide.narrow || !wrap.isConnected) return;  // skips on phone-width screens (the page scrolls there) or if the home page has already been replaced
      const over = () => Array.from(cards.children).some((c) => c.scrollHeight > c.clientHeight + 1) || body.scrollHeight > body.clientHeight + 1;  // over(): true if any card's content is cut off or the whole body is taller than its box
      wrap.classList.remove('hc1', 'hc2', 'hc3', 'hc4');  // removes any compact style from an earlier try, so the page is measured at full size first
      for (const lvl of ['hc1', 'hc2', 'hc3', 'hc4']) { if (!over()) break; wrap.classList.add(lvl); }  // adds hc1 (smaller card text), hc2 (hides the intro paragraph), hc3 (hides badges), hc4 (shortens lists) until it fits
    };  // ends fitHome
    ctx.after(0, fitHome);  // first measurement, as soon as the browser has laid the page out
    ctx.after(250, fitHome); // re-measure once fonts and late layout have settled
    wrap.append(h('div', { class: 'split', style: { height: 'auto', gridTemplateColumns: '1fr 1.25fr', gap: '14px' } },  // bottom row: two side-by-side cards
      h('div', { class: 'card tight' }, h('h4', {}, 'Colour language used in every diagram'), legend()),  // left card: the colour key used in every diagram
      h('div', { class: 'card tight' }, h('h4', {}, 'Getting around'),  // right card: how to get around the guide
        h('div', { class: 'small', html: '<kbd>←</kbd> <kbd>→</kbd> step · <kbd>T</kbd> contents · <kbd>G</kbd> glossary · <kbd>?</kbd> all shortcuts. Dotted words like <span class="t" data-t="operating system">operating system</span> show a definition.' }),  // key hints: arrows, T, G and ?, plus a sample dotted word that shows how definitions work
        h('div', { class: 'row gap-s', style: { marginTop: '6px' } }, h('div', { class: 'route-bottom' }, routeSeg()), h('button', { class: 'btn sm', type: 'button', onclick: openPrint }, 'Printable guide')))));  // the desktop copy of the route switch (hidden on phone-width screens) and a Printable guide button
    body.append(wrap);  // puts the finished home page into the slide body
  }  // ends renderHome
  function legend() {  // legend(): the colour key: each colour name used in diagrams and what it stands for
    const items = [['cpu', 'CPU / registers'], ['mem', 'Memory'], ['io', 'I/O devices'], ['os', 'OS / kernel'], ['proc', 'Process'], ['thread', 'Thread'], ['intr', 'Interrupt / signal']];  // the seven colour names and their meanings: CPU, memory, I/O, OS, process, thread, interrupt
    return h('div', { class: 'legend' }, items.map(([c, t]) => h('span', { class: 'chip ' + c }, h('span', { style: { width: '10px', height: '10px', borderRadius: '3px', background: `var(--${c})`, display: 'inline-block' } }), t)));  // one small chip per colour: a coloured square followed by its meaning
  }  // ends legend
  Guide.legend = legend;  // exposed so sections can show the colour key inside their own steps

  /* ------------------------------------------------------------ chapter overview */
  function renderChapter(body, ctx, ch) {  // renderChapter(body, ctx, ch): draws a chapter overview: introduction on the left, section map and buttons on the right
    const secs = sectionsOf(ch.num);  // the chapter's sections in order
    const left = h('div', { class: 'stack', style: { gap: '10px' } },  // the left column
      ch.tagline ? h('div', { class: 'lead b', style: { color: 'var(--chc)' } }, ch.tagline) : null,  // a one-line tagline in the chapter's colour, if the chapter has one
      ch.intro ? h('div', { class: 'small', html: ch.intro }) : null,  // the introduction text, if any
      ch.objectives && ch.objectives.length ? h('div', { class: 'card tight' }, h('h4', {}, 'After this chapter you will be able to'), h('ul', { class: 'small m0', style: { fontSize: '14px', lineHeight: '1.4' } }, ch.objectives.map((o) => h('li', { html: o })))) : null);  // learning objectives in a card, if any: "After this chapter you will be able to..."
    const pct = progressOfChapter(ch.num);  // how much of this chapter the student has visited on the chosen route
    const firstKey = (ch.steps && ch.steps.length) ? 'ch' + ch.num + '/1' : (secs[0] ? secs[0].id + '/1' : null);  // where a new student starts: the chapter's own first intro step, or else the first section's first step
    const lastKey = store.data.chLast && store.data.chLast[ch.num];  // the last place the student was in this chapter, if any
    const resumeKey = lastKey && slideIndex(lastKey) >= 0 ? lastKey : firstKey;  // the Continue button's target: the last place if it still exists, otherwise the start
    const resumeSl = resumeKey ? slides[slideIndex(resumeKey)] : null;  // the slide object for that target, used in the button's wording
    const right = h('div', { class: 'stack', style: { gap: '10px' } },  // the right column
      h('h4', {}, `${secs.length} sections in this chapter`),  // heading with the number of sections
      h('div', { class: 'chmap' }, secs.map((x) => h('button', { onclick: () => go(slideIndex(x.id + '/1')) },  // the section map: one button per section that opens its first step
        h('b', {}, `${lab(x)} ${x.title}`), h('span', { class: 'muted' }, x.summary || ''), secDone(x) ? h('span', { class: 'chip ok', style: { marginLeft: '6px', lineHeight: '1.3' } }, 'done') : null, masteryChip(secMastery(x))))),  // each shows the id and title, a one-line summary, a "done" tag if every step was visited, and the quiz score tag
      h('div', { class: 'row', style: { marginTop: 'auto' } },  // a row of buttons pushed to the bottom of the column
        resumeKey ? h('button', { class: 'btn primary', title: resumeSl && lastKey ? 'Resume at ' + slideLabel(resumeSl) + (resumeSl.step ? ': ' + resumeSl.step.title : '') : '', onclick: () => go(slideIndex(resumeKey)) }, lastKey ? `Continue at ${resumeSl && resumeSl.sec && !resumeSl.sec.pseudo ? lab(resumeSl.sec) : 'the overview'}` : 'Start chapter', h('span', { html: ICON.right, style: { width: '18px', display: 'inline-flex' } })) : null,  // Continue (to the last place, naming the section) or Start chapter; hovering shows the exact step
        h('button', { class: 'btn', onclick: () => go(slideIndex('ch' + ch.num + '-terms')) }, 'Key terms'),  // button to the chapter's key-term flashcards
        h('button', { class: 'btn', onclick: () => go(slideIndex('ch' + ch.num + '-quiz')) }, 'Chapter challenge'),  // button to the chapter challenge quiz
        h('div', { class: 'grow', style: { minWidth: '120px' } }, h('div', { class: 'meter' }, h('i', { style: { width: pct * 100 + '%' } })), h('div', { class: 'xs muted' }, `${Math.round(pct * 100)}% visited`))));  // a progress meter with the visited percentage beneath it
    const wrap = h('div', { class: 'split l fill chov' }, left, right);  // the two columns side by side (chov marks it as a chapter overview for the stylesheet)
    body.append(wrap);  // puts the overview into the slide body
    // progressively compact the overview until it fits the fixed body (chapters with many sections)
    if (!Guide.narrow) {  // on desktop screens only (phone-width pages simply scroll)
      for (const lvl of ['cm1', 'cm2', 'cm3', 'cm4']) {  // tries each compact level in turn, from mild (cm1) to strong (cm4)
        if (body.scrollHeight <= body.clientHeight + 1) break;  // stops as soon as the content fits inside the body
        wrap.classList.add(lvl);  // turns on the next compact level (smaller text and gaps, set in the stylesheet)
      }  // ends the loop over compact levels
    }  // ends the desktop-only block
  }  // ends renderChapter
  function secDone(sec) { return sec.steps.every((_, i) => store.data.visited[sec.id + '/' + (i + 1)]); }  // secDone(sec): true once every step of a section has been visited; shows the "done" tag and the contents check mark

  /* ------------------------------------------------------------ key-term trainer */
  function chapterTerms(ch) {  // chapterTerms(ch): the glossary entries taught in chapter ch, from its overview or any of its sections
    const srcs = new Set(['ch' + ch.num, ...sectionsOf(ch.num).map((x) => x.id)]);  // the places that count: the chapter overview (like ch3) plus each section id of the chapter
    return gloss.filter((g) => srcs.has(g.src));  // keeps only the glossary entries whose source is one of those places
  }  // ends chapterTerms
  function renderTerms(body, ctx, ch) {  // renderTerms(body, ctx, ch): draws the key-term flashcard trainer for one chapter
    let deck = chapterTerms(ch);  // deck: the cards in the current order; it changes when the student shuffles or filters
    if (!deck.length) { body.append(h('p', {}, 'No key terms registered for this chapter yet.')); return; }  // a chapter with no terms shows a short message instead
    let i = 0;  // i: the position of the card being shown
    const known = store.data.known;  // known: the saved record of which terms the student marked as known (shared with every chapter)
    const card = h('div', { class: 'flip fc-big' }, h('div', { class: 'flip-in' }, h('div', { class: 'flip-face front' }), h('div', { class: 'flip-face back' })));  // the big flip card: a front face (the term) and a back face (the definition); the stylesheet turns it over
    const front = card.querySelector('.front'), back = card.querySelector('.back');  // handles to the two faces so paint() can fill them
    card.addEventListener('click', () => card.classList.toggle('on'));  // clicking the card turns it over; the "on" class shows the back
    const counter = h('div', { class: 'bb-count' });  // counter above the card, e.g. "Card 4 of 23"
    const src = h('div', { class: 'small muted' });  // line under the buttons naming where the term is taught
    const list = h('div', { class: 'scroll-y', style: { flex: '1', display: 'flex', flexDirection: 'column', gap: '4px' } });  // the scrolling list of every term on the right
    const knownCount = h('span', { class: 'chip ok' });  // green tag with how many terms are marked as known
    function paint() {  // paint(): redraws the card, the counter, the source line and the term list for the current card
      const g = deck[i];  // g is the current glossary entry
      card.classList.remove('on');  // always shows the front (term side) first
      front.innerHTML = esc(g.term);  // the term on the front, as plain text
      back.innerHTML = esc(g.def);  // the definition on the back, as plain text
      counter.textContent = `Card ${i + 1} of ${deck.length}`;  // updates the card counter
      src.innerHTML = g.src.startsWith('ch') ? 'From the chapter overview' : `From section ${esc(labOf(g.src))} ${esc((Guide.sections[g.src] || {}).title || '')}`;  // names the source: the chapter overview, or the section id and title
      list.innerHTML = '';  // clears the term list before rebuilding it
      deck.forEach((d, j) => list.append(h('button', {  // one button per term in the list
        class: 'btn sm ' + (j === i ? 'on' : 'ghost'), style: { justifyContent: 'flex-start', height: 'auto', minHeight: '28px', whiteSpace: 'normal', textAlign: 'left', padding: '3px 8px' },  // the current card is highlighted; others are plain, left-aligned buttons that may wrap onto two lines
        onclick: () => { i = j; paint(); },  // clicking a term in the list jumps the card to it
      }, h('span', { style: { color: known[d.term] ? 'var(--ok)' : 'var(--line-2)', fontWeight: 900 } }, known[d.term] ? '✓' : '•'), ' ', d.term)));  // a green check mark before known terms, a grey dot before the rest, then the term itself
      const k = deck.filter((d) => known[d.term]).length;  // k counts the known terms in this deck
      knownCount.textContent = `${k} / ${deck.length} marked as known`;  // updates the green tag
      const on = list.children[i]; if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest' });  // scrolls the list just enough to keep the current term visible
    }  // ends paint
    const mark = (v) => { known[deck[i].term] = v ? 1 : 0; store.save(); if (i < deck.length - 1) i++; paint(); };  // mark(v): records the current term as known (true) or still learning (false), saves, and moves to the next card
    const left = h('div', { class: 'stack' },  // the left column
      h('div', { class: 'row', style: { justifyContent: 'space-between' } }, counter, knownCount),  // top row: the card counter on the left, the known tag on the right
      card,  // the flip card
      h('div', { class: 'small muted center' }, 'Say the definition out loud first, then click the card to check yourself.'),  // instruction: try to recall the definition before turning the card
      h('div', { class: 'row', style: { justifyContent: 'center' } },  // the main button row, centred
        h('button', { class: 'btn', onclick: () => { i = (i - 1 + deck.length) % deck.length; paint(); } }, '◀ Previous'),  // Previous: goes back one card, wrapping from the first card to the last
        h('button', { class: 'btn', onclick: () => card.classList.toggle('on') }, 'Flip'),  // Flip: turns the card over, the same as clicking it
        h('button', { class: 'btn', style: { borderColor: 'var(--warn)', color: 'var(--warn)' }, onclick: () => mark(false) }, 'Still learning'),  // Still learning: marks the term as not yet known (amber button)
        h('button', { class: 'btn', style: { borderColor: 'var(--ok)', color: 'var(--ok)' }, onclick: () => mark(true) }, 'I know this ✓'),  // I know this: marks the term as known (green button)
        h('button', { class: 'btn', onclick: () => { i = (i + 1) % deck.length; paint(); } }, 'Next ▶')),  // Next: goes forward one card, wrapping from the last card to the first
      h('div', { class: 'row', style: { justifyContent: 'center' } },  // a second row of smaller deck buttons
        h('button', { class: 'btn sm ghost', onclick: () => { deck = shuffle(deck); i = 0; paint(); } }, 'Shuffle deck'),  // Shuffle deck: puts the cards in a random order and starts again at the first one
        h('button', { class: 'btn sm ghost', onclick: () => { const rest = deck.filter((d) => !known[d.term]); if (rest.length) { deck = rest; i = 0; paint(); } else toast('You have marked every term as known.'); } }, 'Only terms I am still learning'),  // Only terms I am still learning: keeps just the unknown terms, or says so in a toast if every term is known
        h('button', { class: 'btn sm ghost', onclick: () => { deck = chapterTerms(ch); i = 0; paint(); } }, 'Full deck')),  // Full deck: brings back every term of the chapter in the original alphabetical order; closes the row
      src);  // the source line goes last in the left column
    const right = h('div', { class: 'stack', style: { minHeight: 0, height: '100%' } }, h('h4', {}, `All ${deck.length} terms in Chapter ${ch.num}`), list);  // the right column: a heading with the number of terms, then the scrolling list
    body.append(h('div', { class: 'split r fill' }, left, right));  // puts the two columns side by side in the slide body
    paint();  // draws the first card
  }  // ends renderTerms

  /* ------------------------------------------------------------ chapter / final quizzes */
  function poolFor(secs) {  // poolFor(secs): gathers every quiz question from the given sections into one pool for the challenge quizzes
    const pool = [];  // pool collects the questions
    for (const sec of secs) sec.steps.forEach((st, si) => (st.quiz || []).forEach((q, qi) => pool.push(Object.assign({}, q, { source: sec.id, qid: `${sec.id}:${si}:${qi}:${qfp(q)}` }))));  // copies each question and tags it with its section (source) and a unique id: section, step, question number, fingerprint
    return pool;  // returns the full pool
  }  // ends poolFor
  function sampledQuiz(body, ctx, secs, n, key, blurb) {  // sampledQuiz(body, ctx, secs, n, key, blurb): a challenge quiz of n questions drawn from the given sections
    const pool = poolFor(secs);  // every question available from those sections
    if (!pool.length) { body.append(h('p', {}, 'No questions available yet.')); return; }  // no questions at all: a short message instead
    const host = h('div', { class: 'grow', style: { minHeight: 0 } });  // host: the box the quiz is placed in, replaced whenever a new set is drawn
    const draw = (fresh) => {  // draw(fresh): shows a set of questions: the saved set when possible, otherwise (or when fresh is true) a new one
      store.data.qdraw = store.data.qdraw || {};  // makes sure the saved-draws record exists
      const savedIds = !fresh && store.data.qdraw[key];  // the ids of the set drawn last time for this quiz, unless a fresh set was asked for
      if (savedIds && savedIds.length) {  // if there is a saved set...
        const byId = new Map(pool.map((q) => [q.qid, q]));  // a lookup table from question id to question
        const again = savedIds.map((id) => byId.get(id));  // finds each saved question in the current pool
        if (again.every(Boolean)) { host.innerHTML = ''; host.append(quiz(ctx, again, { key, source: true, ids: savedIds })); return; }  // if all of them still exist (none edited or removed), shows that same set again and stops
      }  // ends the saved-set case
      if (fresh && store.data.qstate) delete store.data.qstate[key];  // a fresh draw throws away the saved answers for this quiz, so the new set starts clean
      // balance the draw across sections so every section is represented
      // balance the draw: round-robin over chapters, and inside each chapter over its sections (both shuffled)
      const byCh = {};  // byCh: questions grouped by chapter, then by section inside each chapter
      pool.forEach((q) => { const c = q.source.split('.')[0]; ((byCh[c] = byCh[c] || {})[q.source] = byCh[c][q.source] || []).push(q); });  // sorts each question into its chapter (the part of the id before the dot) and its section
      const chLists = shuffle(Object.values(byCh).map((secs) => shuffle(Object.values(secs).map((l) => shuffle(l)))));  // chLists: the chapters in random order, each holding its sections in random order, each holding shuffled questions
      const picked = [];  // picked: the questions chosen so far
      const secTurn = chLists.map(() => 0);  // secTurn: for each chapter, which of its sections is next in line
      let r = 0;  // r counts the rounds; it also chooses whose turn it is
      while (picked.length < Math.min(n, pool.length) && r < 20000) {  // keeps picking until there are n questions (or the pool runs out); the round limit guarantees the loop ends
        const ci = r % chLists.length; const secs = chLists[ci];  // takes chapters in turn: ci is this round's chapter and secs its section lists
        for (let k = 0; k < secs.length; k++) { const l = secs[(secTurn[ci] + k) % secs.length]; if (l.length) { picked.push(l.pop()); secTurn[ci] = (secTurn[ci] + k + 1) % secs.length; break; } }  // from the section whose turn it is, takes one question; empty sections are skipped and the turn moves past the one used
        r++;  // next round
      }  // ends the picking loop
      const drawn = shuffle(picked);  // shuffles the chosen questions so chapters are mixed rather than in turns
      store.data.qdraw[key] = drawn.map((q) => q.qid); store.save();  // saves the ids of this set so the same questions come back after leaving and returning
      host.innerHTML = '';  // clears the old quiz
      host.append(quiz(ctx, drawn, { key, source: true, ids: drawn.map((q) => q.qid) }));  // shows the new quiz; source: true adds the section tags and "sections to revisit" links
    };  // ends draw
    body.append(h('div', { class: 'stack fill', style: { gap: '8px' } },  // lays out the quiz page as a column
      h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('div', { class: 'small muted', html: blurb }), h('button', { class: 'btn sm', onclick: () => draw(true) }, 'Draw a new set')),  // top row: the short explanation on the left and a "Draw a new set" button on the right
      host));  // then the quiz box, which fills the rest of the page
    draw(false);  // shows the saved set if there is one, otherwise draws a new set, as soon as the challenge page opens
  }  // ends sampledQuiz
  function renderChQuiz(body, ctx, ch) {  // renderChQuiz(body, ctx, ch): the chapter challenge page
    sampledQuiz(body, ctx, sectionsOf(ch.num), 12, 'ch' + ch.num + '-quiz', `Twelve questions drawn from every section of Chapter ${ch.num}. The <b>§</b> tag shows which section to revisit if you miss one.`);  // twelve questions from every section of the chapter, saved under a key like ch3-quiz, with a short explanation
  }  // ends renderChQuiz
  function renderFinal(body, ctx) {  // renderFinal(body, ctx): the final challenge page
    sampledQuiz(body, ctx, Object.values(Guide.sections), 20, 'final', `Twenty questions drawn from all ${BOOK.countWord} chapters. Try to beat your best score, then draw a new set.`);  // twenty questions from every section of every chapter, saved under the key final
  }  // ends renderFinal

  /* =================================================================== UI components */
  const UI = {};  // UI: the shared widget builders; each takes ctx first, and steps reach them through ctx.ui

  UI.seg = function (ctx, options, value, onChange) {  // UI.seg(ctx, options, value, onChange): a segmented switch, a row of buttons where exactly one is selected
    const opts = options.map((o) => (typeof o === 'object' ? o : { value: o, label: String(o) }));  // each option may be a plain value or { value, label, title }; plain values become their own label
    const el = h('div', { class: 'seg', role: 'group' });  // the outer box; role group tells screen readers the buttons belong together
    let v = value;  // v holds the value currently selected
    const btns = opts.map((o) => h('button', { type: 'button', onclick: () => set(o.value, true), title: o.title || null, html: o.label }));  // one button per option; a click selects it and reports the change; label may contain HTML
    el.append(...btns);  // puts the buttons in the box
    el.addEventListener('keydown', (e) => {  // lets Left and Right arrow keys move keyboard focus between the buttons
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;  // ignores every other key
      const i = btns.indexOf(document.activeElement); if (i < 0) return;  // which button has focus; if none of ours does, do nothing
      e.preventDefault(); e.stopPropagation();  // stops the arrow from also scrolling the page or moving to another slide
      btns[(i + (e.key === 'ArrowRight' ? 1 : btns.length - 1)) % btns.length].focus();  // moves focus to the next button (Right) or the previous one (Left), wrapping around at the ends
    });  // ends the keyboard handler
    function set(nv, fire) { v = nv; btns.forEach((b, i) => { b.classList.toggle('on', opts[i].value === v); b.setAttribute('aria-pressed', opts[i].value === v); }); if (fire && onChange) onChange(v); }  // set(nv, fire): selects value nv, lights up its button, marks it pressed for screen readers, and reports it if fire is true
    set(v, false);  // shows the starting value without reporting it as a change
    el.set = (nv) => set(nv, false);  // el.set(nv): lets the caller change the selection from code without triggering onChange
    el.get = () => v;  // el.get(): the value currently selected
    return el;  // hands back the switch element
  };  // ends UI.seg

  UI.slider = function (ctx, o) {  // UI.slider(ctx, o): a labelled range slider with a live value readout; o holds min, max, step, value, label, format, onInput
    const id = 'sl' + Math.random().toString(36).slice(2, 8);  // a random id that links the label and readout to this slider
    const out = h('output', { for: id });  // the readout box that shows the current value
    const inp = h('input', { type: 'range', id, min: o.min ?? 0, max: o.max ?? 100, step: o.step ?? 1, value: o.value ?? o.min ?? 0 });  // the slider itself; missing settings default to 0 to 100 in steps of 1, starting at the minimum
    const format = o.format || ((v) => String(v));  // format(v): how the value is written in the readout; by default just the number
    const upd = (fire) => { const v = parseFloat(inp.value); out.innerHTML = format(v); if (fire && o.onInput) o.onInput(v); };  // upd(fire): reads the slider, writes the formatted value in the readout, and calls onInput if fire is true
    inp.addEventListener('input', () => upd(true));  // every movement of the slider updates the readout and reports the new value
    const el = h('div', { class: 'ui-slider' }, h('label', { for: id, html: o.label || '' }), inp, out);  // the widget: label, slider and readout in one row
    el.input = inp;  // el.input: gives the caller direct access to the underlying slider element
    el.set = (v, fire) => { inp.value = v; upd(fire); };  // el.set(v, fire): moves the slider from code, reporting the change only if fire is true
    el.get = () => parseFloat(inp.value);  // el.get(): the slider's current value as a number
    upd(false);  // fills the readout with the starting value
    return el;  // hands back the widget
  };  // ends UI.slider

  UI.tabs = function (ctx, list, o = {}) {  // UI.tabs(ctx, list, o): a row of tabs; each tab in list has a label and html or a render function for its panel
    const strip = h('div', { class: 'tabs-strip', role: 'tablist' });  // the strip of tab buttons; role tablist is the standard tabs pattern for screen readers
    const panel = h('div', { class: 'tabs-panel' });  // the panel under the strip where the chosen tab's content appears
    const el = h('div', { class: 'tabs' }, strip, panel);  // the whole widget: strip above panel
    let cleanup = null;  // cleanup: the tidy-up function returned by the open tab's render, if any
    const btns = list.map((t, i) => h('button', { type: 'button', role: 'tab', onclick: () => show(i), html: t.label }));  // one button per tab; a click shows that tab
    strip.append(...btns);  // puts the buttons in the strip
    let curTab = 0;  // curTab: the position of the tab now showing
    strip.addEventListener('keydown', (e) => {  // keyboard support on the strip, following the usual tabs pattern
      const n = btns.length; let j = null;  // n: the number of tabs; j: the tab to move to, if any
      if (e.key === 'ArrowRight') j = (curTab + 1) % n; else if (e.key === 'ArrowLeft') j = (curTab - 1 + n) % n;  // Right and Left arrows move to the next or previous tab, wrapping around
      else if (e.key === 'Home') j = 0; else if (e.key === 'End') j = n - 1;  // Home and End jump to the first and last tab
      if (j == null) return;  // any other key is left alone
      e.preventDefault(); e.stopPropagation();  // stops the key from also scrolling the page or changing the slide
      show(j); btns[j].focus();  // shows the chosen tab and moves keyboard focus onto it
    });  // ends the keyboard handler
    function show(i) {  // show(i): switches to tab i
      if (typeof cleanup === 'function') { try { cleanup(); } catch (e) { console.error(e); } }  // first runs the old tab's tidy-up, so its timers and listeners stop; a failure there is only logged
      cleanup = null;  // clears the old tidy-up
      curTab = i;  // records the new tab
      btns.forEach((b, j) => { b.classList.toggle('on', i === j); b.setAttribute('aria-selected', i === j); b.tabIndex = i === j ? 0 : -1; });  // lights up the chosen button, marks it selected for screen readers, and makes only it reachable with Tab
      panel.innerHTML = '';  // empties the panel
      const t = list[i];  // t is the chosen tab
      if (t.html) panel.append(frag(t.html));  // fixed content: its html is turned into elements
      if (t.render) cleanup = t.render(panel, ctx);  // interactive content: its render function draws into the panel and may return a tidy-up function
      if (o.onChange) o.onChange(i);  // tells the caller which tab was chosen, if it asked
      ctx.after(30, checkOverflow);  // re-checks shortly afterwards whether the slide still fits, since the new tab may be taller
    }  // ends show
    ctx.cleanup(() => { if (typeof cleanup === 'function') cleanup(); });  // when the slide closes, the open tab's tidy-up also runs
    show(o.initial || 0);  // opens the starting tab (the first unless o.initial says otherwise)
    el.show = show;  // el.show(i): lets the caller switch tabs from code
    return el;  // hands back the widget
  };  // ends UI.tabs

  UI.reveal = function (ctx, label, content, o = {}) {  // UI.reveal(ctx, label, content, o): a button that shows or hides extra content, such as a worked answer
    const bodyEl = h('div', { class: 'reveal-body' });  // the hidden box holding the content
    if (typeof content === 'string') bodyEl.innerHTML = content; else if (content) bodyEl.append(content);  // content may be an HTML string or a ready-made element
    const btn = h('button', { class: 'btn sm reveal-btn ' + (o.cls || ''), type: 'button', onclick: () => {  // the button, labelled with label; o.cls adds extra classes
      const on = !bodyEl.classList.contains('on');  // on each click: works out whether the content should now be shown
      bodyEl.classList.toggle('on', on);  // shows or hides the content (the stylesheet hides it until it has the on class)
      btn.innerHTML = on ? (o.hideLabel || 'Hide') : label;  // the button then reads Hide (or o.hideLabel) while open, and the original label while closed
      ctx.after(30, checkOverflow);  // re-checks shortly afterwards whether the slide still fits
    }, html: label });  // ends the click handler; the button starts with the given label
    return h('div', { class: 'reveal' }, btn, bodyEl);  // hands back the button with the content box below it
  };  // ends UI.reveal

  UI.flipcards = function (ctx, pairs, o = {}) {  // UI.flipcards(ctx, pairs, o): a grid of cards, each with a front and a back, that turn over when clicked
    const grid = h('div', { class: 'grid-' + (o.cols || 3) });  // the grid, 3 columns unless o.cols says otherwise
    pairs.forEach(([f, b]) => {  // one card per [front, back] pair
      const front = h('div', { class: 'flip-face front' }, h('div', { html: f })), back = h('div', { class: 'flip-face back', 'aria-hidden': 'true' }, h('div', { html: b }));  // the two faces; the back starts hidden from screen readers because it is out of sight
      const name = 'Flip card: ' + (front.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 120);  // name: what a screen reader announces, built from the card's own question so every card sounds different
      const card = h('div', { class: 'flip', style: { minHeight: (o.height || 96) + 'px' }, tabindex: 0, role: 'button', 'aria-label': name, 'aria-pressed': 'false' },  // the card: at least 96 pixels tall (or o.height), reachable with Tab, announced as a button named after its question, and not yet pressed (answer hidden)
        h('div', { class: 'flip-in' }, front, back));  // the inner layer that rotates, holding the front face and the back face
      const flip = () => { const on = card.classList.toggle('on'); card.setAttribute('aria-pressed', on ? 'true' : 'false'); front.setAttribute('aria-hidden', on ? 'true' : 'false'); back.setAttribute('aria-hidden', on ? 'false' : 'true'); };  // flip(): turns the card over, tells screen readers it is now pressed (answer showing) and hides whichever face is out of sight
      card.addEventListener('click', flip);  // a click turns the card
      card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } });  // Enter or Space also turn it, so it works from the keyboard; preventDefault stops Space from scrolling the page
      grid.append(card);  // adds the card to the grid
    });  // ends the loop over pairs
    return grid;  // hands back the grid
  };  // ends UI.flipcards

  const KW = new Set(('if else while for do return int bool boolean void true false const struct typedef static break continue switch case default char float double long ' +  // KW: words shown in keyword colour in code listings: C words, pseudo-code words (parbegin, semaphore...), Python words
    'unsigned enum union extern sizeof null NULL new class public private protected var function let procedure begin end parbegin parend repeat until forever ' +  // more keywords: C types, other languages' common words, and the pseudo-code words used in concurrency listings
    'semaphore binary_semaphore monitor cond condition message atomic then of type program shared local and or not mod import from def elif pass None True False lambda').split(' '));  // the concurrency words (semaphore, monitor, atomic...) and Python words; split(' ') turns the long string into a list
  function hlLine(line, lang) {  // hlLine(line, lang): colours one line of a code listing by wrapping comments, strings, numbers and names in spans
    if (lang === 'plain' || lang === 'text') return esc(line);  // plain or text listings get no colouring, only escaping so the characters show as typed
    const re = /(\/\/.*$|\/\*.*?\*\/|#.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\b0x[0-9a-fA-F]+\b|\b\d+(?:\.\d+)?\b)|(\b[A-Za-z_]\w*\b)/g;  // a regular expression (a text pattern) with four groups: comments, quoted strings, numbers, and words
    let out = '', last = 0, m;  // out builds the coloured line; last marks where the previous match ended; m holds each match
    while ((m = re.exec(line))) {  // finds each match in turn, from left to right
      out += esc(line.slice(last, m.index));  // copies the text between the previous match and this one unchanged (escaped)
      const [, com, str, num, word] = m;  // which of the four groups matched: comment, string, number or word
      if (com) out += `<span class="tk-com">${esc(com)}</span>`;  // a comment is wrapped in the comment colour
      else if (str) out += `<span class="tk-str">${esc(str)}</span>`;  // a quoted string gets the string colour
      else if (num) out += `<span class="tk-num">${esc(num)}</span>`;  // a number gets the number colour
      else if (word) {  // a word needs one more decision
        if (KW.has(word)) out += `<span class="tk-kw">${word}</span>`;  // a keyword from KW gets the keyword colour (letters only, so no escaping is needed)
        else if (/^\s*\(/.test(line.slice(m.index + word.length))) out += `<span class="tk-fn">${word}</span>`;  // a word followed by an opening bracket is a function name, like wait( or signal(, and gets the function colour
        else out += esc(word);  // any other word stays uncoloured
      }  // ends the word case
      last = re.lastIndex;  // moves the marker to the end of this match
    }  // ends the loop over matches
    return out + esc(line.slice(last));  // adds whatever text follows the last match and returns the finished line
  }  // ends hlLine
  function codeEl(src, o = {}) {  // codeEl(src, o): builds a numbered, coloured code listing whose lines can be highlighted from code during an animation
    const lines = String(src).replace(/^\n+|\s+$/g, '').split('\n');  // trims blank lines from the start and spaces from the end, then splits the text into lines
    const pre = h('pre', { class: 'code' + (o.nums === false ? ' nonum' : '') + (o.cls ? ' ' + o.cls : '') });  // the pre box (keeps spacing exactly); nonum hides the line numbers; o.cls adds extra classes
    if (o.maxHeight) pre.style.maxHeight = o.maxHeight + 'px';  // optional maximum height, after which the listing scrolls
    if (o.fontSize) pre.style.fontSize = o.fontSize + 'px';  // optional font size
    pre.innerHTML = lines.map((l, i) => `<span class="ln" data-n="${i + 1}">${hlLine(l, o.lang || 'c') || ' '}</span>`).join('');  // each line becomes a span with its number in data-n (the stylesheet prints it); an empty line gets a space to keep its height
    const lineEls = () => Array.from(pre.querySelectorAll('.ln'));  // lineEls(): the list of line spans
    pre.mark = (nums, cls = 'cur') => {  // pre.mark(nums, cls): highlights the given line numbers (one or a list) with a class, 'cur' by default
      const set = new Set([].concat(nums == null ? [] : nums));  // turns nums into a set of line numbers (none if nums is empty)
      lineEls().forEach((el, i) => el.classList.toggle(cls, set.has(i + 1)));  // adds the class to the chosen lines and removes it from every other line
      const first = lineEls()[Math.min(...[...set]) - 1];  // the first highlighted line
      if (first && pre.scrollHeight > pre.clientHeight) { const t = first.offsetTop - pre.clientHeight / 2; pre.scrollTop = Math.max(0, t); }  // if the listing scrolls, centres that line in view
    };  // ends pre.mark
    pre.clear = (cls) => lineEls().forEach((el) => (cls ? el.classList.remove(cls) : el.classList.remove('cur', 'ok', 'bad', 'dim')));  // pre.clear(cls): removes one highlight class from every line, or all the usual ones (cur, ok, bad, dim) if none is named
    pre.line = (n) => lineEls()[n - 1];  // pre.line(n): the span of line n, for callers that want to style a single line
    return pre;  // hands back the listing
  }  // ends codeEl
  UI.code = (ctx, src, o) => codeEl(src, o);  // UI.code(ctx, src, o): the same listing, reachable as ctx.ui.code inside a step
  Guide.code = codeEl;  // Guide.code: the same listing builder for code that has no ctx

  UI.player = function (ctx, o) {  // UI.player(ctx, o): an animation player with Restart, Previous, Play/Pause, Next, a step counter, a bar and speed buttons
    let count = o.count, i = 0, timer = null, speed = 1;  // count: number of frames; i: current frame; timer: the running play timer; speed: the chosen playback speed
    const cap = h('div', { class: 'player-cap', 'aria-live': 'polite' });  // the caption box that the step's render text goes into; aria-live makes screen readers read each new caption
    const counter = h('span', { class: 'player-count' });  // the "Step 3 / 8" counter
    const bar = h('div', { class: 'player-bar' }, h('i'));  // the progress bar; its inner i element is stretched to show the position
    const mk = (icon, label, fn, cls = 'btn sm') => h('button', { class: cls, type: 'button', title: label, 'aria-label': label, onclick: fn, html: ICON[icon] + (cls.includes('primary') ? '' : '') });  // mk(): makes one small icon button with a tooltip and screen-reader label (the trailing check adds nothing either way)
    const bReset = mk('reset', 'Restart', () => { stop(); go(0); });  // Restart: stops playback and returns to the first frame
    const bPrev = mk('prev', 'Previous step', () => { stop(); go(i - 1); });  // Previous step: stops playback and goes back one frame
    const bPlay = h('button', { class: 'btn sm primary', type: 'button', onclick: () => (timer ? stop() : play()) });  // Play/Pause: toggles automatic playback; its icon and text are set by paintPlay
    const bNext = mk('next', 'Next step', () => { stop(); go(i + 1); });  // Next step: stops playback and goes forward one frame
    const spd = UI.seg(ctx, [{ value: 0.5, label: '0.5×' }, { value: 1, label: '1×' }, { value: 2, label: '2×' }], 1, (v) => { speed = v; if (timer) { stop(); play(); } });  // speed switch: half, normal or double speed; changing it while playing restarts the timer at the new pace
    [bReset, bPrev, bNext].forEach((b) => b.querySelector('svg') && (b.querySelector('svg').style.width = '16px'));  // makes the icons on the three small buttons 16 pixels wide
    const ctl = h('div', { class: 'player-ctl' }, bReset, bPrev, bPlay, bNext, counter, bar, o.speed === false ? null : spd);  // the control row: buttons, counter, bar, then the speed switch unless o.speed is false
    const el = h('div', { class: 'player' }, o.captionBelow ? null : cap, ctl, o.captionBelow ? cap : null);  // the whole player: caption above the controls, or below them if o.captionBelow is true
    if (o.caption === false) cap.style.display = 'none';  // hides the caption box if the caller draws its own
    function paintPlay() { bPlay.innerHTML = (timer ? ICON.pause + '<span>Pause</span>' : ICON.play + '<span>' + (i >= count - 1 ? 'Replay' : 'Play') + '</span>'); bPlay.querySelector('svg').style.width = '15px'; }  // paintPlay(): shows Pause while playing, otherwise Play, or Replay once the last frame is reached
    function go(n) {  // go(n): jumps to frame n
      i = clamp(n, 0, Math.max(0, count - 1));  // keeps n between the first and last frame
      let out;  // out will hold the caption text for this frame
      try { out = o.render(i); } catch (e) { console.error(e); out = '<span style="color:var(--bad)">Error: ' + esc(e.message) + '</span>'; }  // asks the step to draw frame i and return its caption; an error is logged and shown in red instead
      if (out != null) cap.innerHTML = out;  // updates the caption, unless the render function returned nothing (null) to keep the old one
      counter.textContent = `Step ${i + 1} / ${count}`;  // updates the counter (people count from 1, so i + 1)
      bar.firstChild.style.width = (count > 1 ? (i / (count - 1)) * 100 : 100) + '%';  // stretches the progress bar to the current frame's position
      bPrev.disabled = i === 0; bNext.disabled = i >= count - 1;  // greys out Previous on the first frame and Next on the last one
      if (i >= count - 1 && timer) stop();  // stops automatic playback on reaching the end
      paintPlay();  // refreshes the Play/Pause button
      if (o.onStep) o.onStep(i);  // tells the caller the frame changed, if it asked
    }  // ends go
    function play() {  // play(): starts automatic playback
      if (i >= count - 1) go(0);  // starting from the end replays from the beginning
      clearInterval(timer);  // cancels any timer already running
      timer = setInterval(() => { if (!ctx.alive) return stop(); go(i + 1); }, (o.interval || 1600) / speed);  // advances one frame every 1.6 seconds (or o.interval) divided by the speed; stops if the slide has closed
      paintPlay();  // refreshes the Play/Pause button
    }  // ends play
    function stop() { clearInterval(timer); timer = null; paintPlay(); }  // stop(): halts automatic playback and refreshes the button
    ctx.cleanup(stop);  // playback also stops when the student leaves the slide
    const api = { el, go, play, stop, next: () => go(i + 1), prev: () => go(i - 1), reset: () => { stop(); go(0); }, get index() { return i; }, get count() { return count; },  // api: what the step gets back: the element and controls, plus index and count read live through getters
      setCount(n, keep) { count = Math.max(1, n); go(keep ? Math.min(i, count - 1) : 0); }, refresh: () => go(i), caption: cap };  // setCount(n, keep): changes the number of frames (keeping the current frame if asked); refresh redraws; caption is the box
    go(o.start || 0);  // draws the starting frame (the first unless o.start says otherwise)
    if (o.autoplay) play();  // starts playing at once if o.autoplay is set
    return api;  // hands the controls back to the step
  };  // ends UI.player

  /* ------------------------------------------------------------ quiz engine */
  const QLABEL = { mc: 'Multiple choice', tf: 'True or false', multi: 'Select all that apply', order: 'Put in order', match: 'Match the pairs', bucket: 'Sort into groups', num: 'Calculate' };  // QLABEL: the name of each question kind, shown above every question
  const QIDLE = {  // QIDLE: the instruction shown in the feedback box before the student answers, one per question kind
    mc: 'Pick the best answer. You get a second try; the explanation appears here.',  // instruction for multiple choice: one pick, one second try
    tf: 'Decide whether the statement is true or false.',  // instruction for true or false
    multi: 'Select every correct option, then press Check.',  // instruction for select all that apply
    order: 'Drag the items (or use the arrows) into the correct order, then press Check.',  // instruction for put in order
    match: 'Choose the matching item for each row, then press Check.',  // instruction for match the pairs
    bucket: 'Put each item in the right group, then press Check.',  // instruction for sort into groups
    num: 'Work it out, type your answer, then press Check.',  // instruction for calculate
  };  // closes the QIDLE table
  function normQ(q) {  // normQ(q): a working copy of a question with its kind filled in and the number of tries it allows
    const { type } = validateQuestion(q, 'q');  // works out the question's kind with the same rules the checker uses
    const n = Object.assign({}, q, { type });  // copies the question (the original is never changed) and records the kind
    if (type === 'tf') { n.choices = ['True', 'False']; n.answerIdx = q.answer ? 0 : 1; n.max = 1; }  // true/false is shown as a two-choice question: the answer's position, and a single try (a second guess would be free)
    else if (type === 'mc') { n.answerIdx = q.answer; n.max = q.choices.length <= 2 ? 1 : 2; }  // multiple choice: the answer's position; two tries, or one if there are only two choices
    else n.max = 2;  // every other kind allows two tries
    return n;  // returns the working copy
  }  // ends normQ
  function quiz(ctx, questions, o = {}) {  // quiz(ctx, questions, o): the quiz engine; shows one question at a time with pills, score, feedback and a results page
    const qs = questions.map(normQ);  // qs: the working copies of the questions
    let st = qs.map(() => ({ tries: 0, done: false, res: null }));  // st: one progress record per question: tries used, whether it is finished, and the result
    let cur = 0;  // cur: which question (its position in qs) is on screen; this local name hides the slide counter of the same name
    let order = range(qs.length);  // order: the questions in the current round, in the order asked; a retry round holds only the missed ones
    // restore a saved attempt (answers, tries, current question) so leaving the step or rotating the device keeps the work
    const ids = o.ids || quizIds(questions);  // ids: the labels that identify these exact questions, used to match a saved attempt
    let startPos = 0, startSum = false;  // where to resume: the question position, and whether the results page was showing
    const saved = o.key && store.data.qstate && store.data.qstate[o.key];  // the saved attempt for this quiz, if any, found under the quiz's key
    const RES = [null, 'right', 'late', 'wrong', 'fixed'];  // RES: the allowed results: none yet, right (first try), late (second try), wrong, fixed (right on a retry round)
    const idxArr = (a, n) => Array.isArray(a) && a.length <= 64 && a.every((x) => Number.isInteger(x) && x >= 0 && x < n);  // idxArr(a, n): true for a short list of whole numbers that are all valid positions below n
    function cleanQ(q, x) {  // cleanQ(q, x): checks one saved question record field by field and returns a clean copy, or null if anything is off
      if (!isObj(x) || !okInt(x.tries, 0, 50) || typeof x.done !== 'boolean' || !RES.includes(x.res === undefined ? null : x.res)) return null;  // the basic fields must be sane: tries 0-50, done true or false, and a result from RES
      const c = { tries: x.tries, done: x.done, res: x.res || null };  // copies just those fields
      if (x.retry === true) c.retry = true;  // keeps the flag that marks a retry round
      const n = (q.choices || q.items || q.pairs || []).length;  // n: how many choices, items or pairs this question has, for checking saved positions
      if (x.wrong !== undefined) { if (!idxArr(x.wrong, n)) return null; c.wrong = x.wrong.slice(); }  // positions of wrong picks already made (multiple choice), each checked
      if (q.type === 'multi' && x.sel !== undefined) { if (!idxArr(x.sel, n)) return null; c.sel = x.sel.slice(); }  // select-all: the positions the student has ticked
      if (q.type === 'order' && x.arr !== undefined) { if (!idxArr(x.arr, n) || x.arr.length !== n || new Set(x.arr).size !== n) return null; c.arr = x.arr.slice(); }  // put-in-order: the student's arrangement, which must use every position exactly once
      if (q.type === 'match') {  // match: saved dropdown options and choices
        const rights = q.pairs.map((p) => p[1]);  // the valid right-hand answers
        if (x.opts !== undefined) { if (!Array.isArray(x.opts) || x.opts.length !== rights.length || !x.opts.every((v) => rights.includes(v))) return null; c.opts = x.opts.slice(); }  // the shuffled option order, which must be made of exactly those answers
        if (x.sel !== undefined) { if (!Array.isArray(x.sel) || x.sel.length !== rights.length || !x.sel.every((v) => v === '' || rights.includes(v))) return null; c.sel = x.sel.slice(); }  // the student's choice in each row, each empty or one of those answers
      }  // ends the match checks
      if (q.type === 'bucket' && x.sel !== undefined) { if (!Array.isArray(x.sel) || x.sel.length !== q.items.length || !x.sel.every((v) => Number.isInteger(v) && v >= -1 && v < q.buckets.length)) return null; c.sel = x.sel.slice(); }  // sort: the group chosen for each item, from -1 (none yet) up to the last group
      if (q.type === 'num' && x.val !== undefined) { if (typeof x.val !== 'string' || x.val.length > 40) return null; c.val = x.val; }  // calculate: the text typed so far, at most 40 characters
      return c;  // returns the cleaned record
    }  // ends cleanQ
    if (isObj(saved) && Array.isArray(saved.ids) && saved.ids.join('|') === ids.join('|') && Array.isArray(saved.st) && saved.st.length === qs.length) {  // uses the saved attempt only if it is for these exact questions and has one record per question
      const cleaned = saved.st.map((x, i) => cleanQ(qs[i], x));  // cleans every saved record
      const ordOk = idxArr(saved.order, qs.length) && saved.order.length > 0 && new Set(saved.order).size === saved.order.length;  // the saved question order must be a non-empty list of valid positions with no repeats
      if (cleaned.every(Boolean) && ordOk) {  // only if everything passed...
        st = cleaned; order = saved.order.slice();  // ...restores the records and the order
        startPos = okInt(saved.pos, 0, order.length - 1) ? saved.pos : 0;  // resumes at the saved question position if it is valid, otherwise at the first
        startSum = saved.mode === 'sum';  // and reopens the results page if that is where the student left off
      }  // ends the restore
    }  // ends the saved-attempt check
    function saveState() {  // saveState(): stores the whole attempt (records, order, position, page) so it survives leaving the slide or reloading
      if (!o.key) return;  // quizzes without a key (built by sections for practice) are not saved
      store.data.qstate = store.data.qstate || {};  // makes sure the saved-attempts record exists
      store.data.qstate[o.key] = { ids, st, order, pos: Math.max(0, order.indexOf(cur)), mode: main.dataset.mode || 'q' };  // saves the ids, records, order, the current question's position, and whether results ('sum') or a question ('q') shows
      store.save();  // writes progress to the browser
    }  // ends saveState
    const root = h('div', { class: 'quiz' });  // root: the whole quiz widget
    const pills = h('div', { class: 'quiz-pills' });  // pills: the row of numbered buttons, one per question
    const score = h('div', { class: 'quiz-score' });  // score: the running score line at the top right
    const main = h('div', { class: 'quiz-main' });  // main: the area where the current question (or the results page) is drawn
    const bPrev = h('button', { class: 'btn sm', type: 'button', onclick: () => show(order.indexOf(cur) - 1) }, '◀ Previous');  // Previous: goes to the question before the current one in this round
    const bNext = h('button', { class: 'btn sm primary', type: 'button', onclick: () => nextQ() });  // Next question (or See results): moves to the next unfinished question; its label is set by paintTop
    const bRestart = h('button', { class: 'btn sm ghost', type: 'button', onclick: () => restart(range(qs.length)) }, 'Start over');  // Start over: resets every question and begins a fresh full round
    root.append(h('div', { class: 'quiz-top' }, pills, score), main, h('div', { class: 'quiz-ctl' }, bPrev, h('div', { style: { flex: '1' } }), bRestart, bNext));  // lays the quiz out: top row (pills and score), the question area, then the control row with a spacer
    ['click', 'change', 'input'].forEach((ev) => root.addEventListener(ev, () => setTimeout(saveState, 0)));  // after any click, change or typing inside the quiz, saves the attempt once the event's own handlers have run

    function saveBest() {  // saveBest(): updates the saved best score for this quiz after each answer
      if (!o.key) return;  // practice quizzes without a key keep no score
      const right = st.filter((x) => x.res === 'right').length;  // right: questions answered correctly on the first try
      const fp = hashStr(ids.join('|')).toString(36);  // fp: fingerprint of this exact question set
      let rec = store.data.quiz[o.key];  // the existing score record for this quiz, if any
      if (!rec || rec.fp !== fp || rec.total !== qs.length) rec = { best: 0, total: qs.length, fp };   // questions changed: old best no longer applies
      const learned = st.filter((x) => x.res === 'right' || x.res === 'late' || x.res === 'fixed').length;  // learned: questions answered correctly at some point, including on the second try or on a retry round
      rec.best = Math.max(rec.best || 0, right); rec.total = qs.length; rec.last = right; rec.fp = fp;  // keeps the higher of the old and new first-try scores, and records this attempt's score as last
      rec.learned = Math.max(rec.learned || 0, learned);  // learned only ever goes up
      store.data.quiz[o.key] = rec; store.save();  // stores the record and saves
    }  // ends saveBest
    function paintTop() {  // paintTop(): redraws the pills, the score line and the Previous/Next buttons
      pills.innerHTML = '';  // clears the pills
      order.forEach((qi, k) => pills.append(h('button', { type: 'button', class: 'quiz-pill' + (qi === cur && main.dataset.mode !== 'sum' ? ' on' : '') + (st[qi].res ? ' ' + st[qi].res : ''), title: `Question ${k + 1}`, onclick: () => show(k) }, String(k + 1))));  // one numbered pill per question in the round, coloured by its result and lit for the current one; a click jumps there
      const done = order.filter((qi) => st[qi].done).length;  // done: questions finished in this round
      const right = order.filter((qi) => st[qi].res === 'right').length;  // right: correct on the first try
      const fixed = order.filter((qi) => st[qi].res === 'fixed').length;  // fixed: corrected on a retry round
      score.textContent = `${right} right first try${fixed ? ` · ${fixed} fixed on retry` : ''} · ${done}/${order.length} answered`;  // the score line, e.g. "6 right first try · 2 fixed on retry · 8/10 answered"
      const allDone = order.every((qi) => st[qi].done);  // true once every question in the round is finished
      const pos = order.indexOf(cur);  // pos: the current question's position in the round
      bNext.textContent = allDone ? 'See results ▶' : 'Next question ▶';  // the Next button offers the results page once everything is answered
      bPrev.disabled = main.dataset.mode === 'sum' ? false : pos <= 0;  // Previous stays usable on the results page (to go back and review) but not on the first question
    }  // ends paintTop
    function nextQ() {  // nextQ(): moves to the next unfinished question, wrapping around; if none are left, shows the results
      const pos = order.indexOf(cur);  // the current position
      for (let k = 1; k <= order.length; k++) { const qi = order[(pos + k) % order.length]; if (!st[qi].done) return show(order.indexOf(qi)); }  // looks at each following question in turn (wrapping to the start) and opens the first unfinished one
      summary();  // every question is finished: shows the results page
    }  // ends nextQ
    function restart(idxs) {  // restart(idxs): starts a new round with the given questions: all of them, or only the missed ones
      order = idxs;  // the round now holds exactly these questions
      const retry = idxs.length < qs.length;   // retrying missed questions: a correct answer now counts as "fixed", never as first try
      idxs.forEach((qi) => (st[qi] = retry ? { tries: 0, done: false, res: null, retry: true } : { tries: 0, done: false, res: null }));  // resets each chosen question; on a retry round each is marked so a right answer counts as fixed
      show(0);  // opens the first question of the round
      saveState();  // saves the fresh attempt
    }  // ends restart
    function summary() {  // summary(): shows the results page for the round
      main.dataset.mode = 'sum';  // marks the quiz area as showing results
      const right = order.filter((qi) => st[qi].res === 'right').length;  // right: questions correct on the first try
      const fixedN = order.filter((qi) => st[qi].res === 'fixed').length;  // fixedN: questions corrected on this retry round
      const isRetry = order.some((qi) => st[qi].retry);  // isRetry: true if this round was a retry of missed questions
      const missed = order.filter((qi) => st[qi].res !== 'right' && st[qi].res !== 'fixed');  // missed: everything not right first time and not fixed (second-try answers count as missed, so they can be practised)
      const pct = Math.round(((isRetry ? fixedN : right) / order.length) * 100);  // the big percentage: fixed ones on a retry round, first-try right ones otherwise, out of the round's questions
      const what = o.source ? 'these sections' : 'this section';  // what: wording for the message; challenge quizzes span several sections, a step's quiz covers one
      const msg = pct === 100 ? `Perfect. You have ${what} nailed.` : pct >= 80 ? 'Strong work. Review the explanations for the ones you missed.' : pct >= 50 ? 'Good start. Revisit the steps for the questions you missed, then try again.' : `This is a good time to go back through ${what} and then retry.`;  // an encouraging message chosen by score band: 100%, 80% and up, 50% and up, or below 50%
      const cmpId = (a, b) => { const [a1, a2] = a.split('.').map(Number); const [b1, b2] = b.split('.').map(Number); return a1 - b1 || a2 - b2; };  // cmpId(a, b): compares section ids numerically, so 2.10 sorts after 2.9 rather than before it
      const revisit = [...new Set(missed.map((qi) => qs[qi].source).filter(Boolean))].sort(cmpId);  // revisit: the sections the missed questions came from, each listed once, in section order
      main.innerHTML = '';  // clears the quiz area
      main.append(h('div', { class: 'quiz-sum', style: { gridColumn: '1 / -1' } }, h('div', { class: 'stack', style: { alignItems: 'center' } },  // the results card, spanning the full width, with its contents centred in a column
        h('div', { class: 'big', style: { fontSize: '64px', color: pct >= 80 ? 'var(--ok)' : pct >= 50 ? 'var(--warn)' : 'var(--bad)' } }, pct + '%'),  // the big percentage, green at 80% and up, amber from 50%, red below
        h('div', { class: 'lead b' }, isRetry ? `You fixed ${fixedN} of the ${order.length} you had missed` : `${right} of ${order.length} correct on the first try`),  // the headline: how many were fixed on this retry, or how many were right on the first try
        isRetry ? h('div', { class: 'small muted' }, 'Retries improve what you have learned, not your first-try score.') : null,  // on a retry round, a reminder that retries count toward learned, not toward the first-try score
        h('div', { class: 'muted' }, msg),  // the encouraging message
        o.source && revisit.length ? h('div', { class: 'row small', style: { justifyContent: 'center', gap: '6px' } }, h('span', {}, 'Sections to revisit:'),  // on challenge quizzes with misses: "Sections to revisit:" followed by a button per section
          revisit.map((x) => h('button', { class: 'btn sm', type: 'button', title: (Guide.sections[x] || {}).title || '', onclick: () => go(slideIndex(x + '/1')) }, '§' + labOf(x)))) : null,  // each button shows the section number and jumps to that section's first step; hovering shows its title
        h('div', { class: 'row', style: { justifyContent: 'center' } },  // the row of buttons at the bottom of the results
          missed.length ? h('button', { class: 'btn primary', type: 'button', onclick: () => restart(missed) }, `Retry the ${missed.length} I missed`) : null,  // Retry the ones I missed: starts a retry round with only the missed questions (shown only if any were missed)
          h('button', { class: 'btn', type: 'button', onclick: () => restart(range(qs.length)) }, 'Start over')))));  // Start over: a fresh round with every question; closes the results card
      saveBest();  // updates the saved best score
      paintTop();  // refreshes the pills and score line
      saveState();  // saves that the results page is showing
      ctx.after(30, checkOverflow);  // re-checks shortly afterwards whether the slide still fits
    }  // ends summary
    function show(k) {  // show(k): opens the question at position k of the round (going past the end shows the results)
      if (k < 0) k = 0;  // a position before the start means the first question
      if (k >= order.length) return summary();  // past the last question: the results page instead
      main.dataset.mode = 'q';  // marks the quiz area as showing a question
      cur = order[k];  // cur becomes that question's position in qs
      renderQ(cur, k);  // draws the question
      paintTop();  // refreshes the pills and score line
      saveState();  // saves the new position
      ctx.after(30, checkOverflow);  // re-checks shortly afterwards whether the slide still fits
    }  // ends show
    function renderQ(qi, k) {  // renderQ(qi, k): draws question qi, which is at position k in the round
      const q = qs[qi], s = st[qi];  // q is the question, s its progress record
      main.innerHTML = '';  // clears the quiz area
      const left = h('div', { class: 'quiz-q' });  // left: the question side (type line, text, options, Check button)
      const fb = h('div', { class: 'quiz-fb', 'aria-live': 'polite' });  // fb: the feedback side (instructions, verdict, explanation); aria-live makes screen readers read changes to it
      main.append(left, fb);  // puts the two sides in the quiz area
      left.append(h('div', { class: 'quiz-type' }, `Question ${k + 1} of ${order.length} · ${QLABEL[q.type]}`, q.source && o.source ? h('span', { class: 'quiz-src' }, '§' + labOf(q.source)) : null));  // type line, e.g. "Question 3 of 12 · Multiple choice", plus the section tag on challenge quizzes
      left.append(h('div', { class: 'quiz-qtext', html: q.q }));  // the question text, which may contain HTML such as bold or code
      if (q.code) left.append(codeEl(q.code, { nums: false, fontSize: 13.5 }));  // an optional code listing that goes with the question, without line numbers
      const box = h('div', { class: 'qopts' });  // box: where the answer options are drawn
      left.append(box);  // adds the options box under the question
      const whyHtml = () => `<div class="why">${q.why}</div>`;  // whyHtml(): the explanation box shown once the question is finished
      const api = {  // api: the three calls each question kind makes back to the engine
        finish(correct) {  // finish(correct): ends the question and shows the verdict
          s.done = true;  // marks the question finished
          s.res = correct ? (s.retry ? 'fixed' : s.tries === 0 ? 'right' : 'late') : 'wrong';  // records the result: fixed on a retry round, right on the first try, late on the second try, or wrong
          const verdict = s.res === 'right' ? '<div class="verdict ok">✓ Correct!</div>' : s.res === 'late' ? '<div class="verdict warn">✓ Correct on the second try</div>' : s.res === 'fixed' ? '<div class="verdict warn">✓ Correct on this retry</div>' : '<div class="verdict bad">✗ Not this time. The correct answer is shown in green.</div>';  // the verdict line to match: a green "Correct!", amber for second-try or retry answers, red when wrong
          fb.innerHTML = verdict + whyHtml();  // shows the verdict and the explanation
          saveBest(); paintTop(); saveState();  // saves the best score, refreshes the pills and saves the attempt
        },  // ends finish
        miss(extra) {  // miss(extra): records a wrong attempt; extra is any specific feedback for that answer
          s.tries++;  // counts the try
          if (s.tries >= q.max) return api.finish(false);  // out of tries: the question ends as wrong
          fb.innerHTML = `<div class="verdict bad">✗ Not quite. Try once more.</div>${extra ? `<div>${extra}</div>` : ''}${q.hint ? `<div class="why"><b>Hint:</b> ${q.hint}</div>` : ''}`;  // otherwise: "Not quite. Try once more.", the specific feedback if any, and the hint if the question has one
        },  // ends miss
        final() { fb.innerHTML = (s.res === 'right' ? '<div class="verdict ok">✓ Correct!</div>' : s.res === 'late' ? '<div class="verdict warn">✓ Correct on the second try</div>' : s.res === 'fixed' ? '<div class="verdict warn">✓ Correct on this retry</div>' : '<div class="verdict bad">✗ The correct answer is shown in green.</div>') + whyHtml(); },  // final(): re-shows the verdict and explanation for a question that was finished earlier (when returning to it)
      };  // ends api
      fb.innerHTML = `<div class="muted">${QIDLE[q.type]}</div>` + (q.hint ? `<div class="why small"><b>Hint:</b> ${q.hint}</div>` : '');  // before any answer: the instruction for this question kind, and the hint if there is one
      RENDER[q.type === 'tf' ? 'mc' : q.type](q, s, box, api, left);  // draws the options with the drawer for this kind; true/false uses the multiple-choice drawer
      if (s.done) api.final();  // a question finished earlier shows its verdict straight away
      fitQ(left);  // shrinks the question if it is too tall for the panel
    }  // ends renderQ
    // shrink long questions (many options/rows) until they fit the fixed quiz panel
    function fitQ(left) {  // fitQ(left): turns on compact styles if the question side is too tall
      const run = () => {  // run(): one attempt at fitting
        if (Guide.narrow || !left.isConnected) return;  // skips on phone-width screens (the page scrolls there) or if the question has already been replaced
        main.classList.remove('dense', 'denser');  // starts from full size
        if (left.scrollHeight > left.clientHeight + 1) main.classList.add('dense');  // still too tall: the dense style (smaller text and gaps)
        if (left.scrollHeight > left.clientHeight + 1) main.classList.add('denser');  // still too tall after that: the denser style
      };  // ends run
      run();  // tries right away
      ctx.after(0, run);  // and again once the browser has finished laying out the question
    }  // ends fitQ
    const checkBtn = (fn) => h('button', { class: 'btn primary', type: 'button', style: { alignSelf: 'flex-start' }, onclick: fn }, 'Check answer');  // checkBtn(fn): the "Check answer" button used by the kinds that need an explicit check
    const RENDER = {  // RENDER: one drawing function per question kind; each draws its options into box and calls api.finish or api.miss
      mc(q, s, box, api) {  // multiple choice (and true/false): one button per choice
        s.wrong = s.wrong || [];  // s.wrong: the positions of wrong picks made so far, kept so they stay crossed out
        const btns = q.choices.map((c, j) => h('button', { type: 'button', class: 'qopt', onclick: () => pick(j) }, h('span', { class: 'ql' }, q.type === 'tf' ? (j ? 'F' : 'T') : 'ABCDEFGH'[j]), h('span', { html: c })));  // each button shows a letter (A, B, C... or T and F) followed by the choice text; a click picks it
        box.append(...btns);  // puts the buttons in the options box
        function paint() {  // paint(): marks the buttons to match the question's state
          btns.forEach((b, j) => {  // for each button...
            const w = s.wrong.includes(j);  // w: true if this choice was already picked and wrong
            b.classList.toggle('wrong', w); if (w) b.disabled = true;  // a wrong pick is marked and switched off so it cannot be picked again
            if (s.done) { b.disabled = true; if (j === q.answerIdx) b.classList.add('right'); else if (!w) b.classList.add('dim'); }  // once finished: every button is switched off, the right answer turns green and untouched choices are dimmed
          });  // ends the loop over buttons
        }  // ends paint
        function pick(j) {  // pick(j): the student chose choice j
          if (s.done) return;  // a finished question ignores further clicks
          if (j === q.answerIdx) api.finish(true);  // the right choice finishes the question as correct
          else { s.wrong.push(j); api.miss(q.feedback && q.feedback[j]); }  // a wrong choice is remembered and counts as a miss, with that choice's specific feedback if the question has any
          paint();  // redraws the buttons
        }  // ends pick
        paint();  // draws the buttons' starting state
      },  // ends the multiple-choice drawer
      multi(q, s, box, api, left) {  // select all that apply: one toggle button per choice, then a Check button
        s.sel = s.sel || [];  // s.sel: the positions the student has ticked so far
        const ans = new Set(q.answer);  // ans: the set of correct positions, for quick checking
        const btns = q.choices.map((c, j) => h('button', { type: 'button', class: 'qopt', onclick: () => { if (s.done) return; const k = s.sel.indexOf(j); if (k >= 0) s.sel.splice(k, 1); else s.sel.push(j); paint(false); } },  // one button per choice; a click ticks it or unticks it (unless the question is finished) and redraws
          h('span', { class: 'ql' }, '☐'), h('span', { html: c })));  // each button starts with an empty tick box, followed by the choice text
        box.append(...btns);  // puts the buttons in the options box
        const chk = checkBtn(() => {  // the Check answer button for this question
          if (s.done) return;  // a finished question ignores further checks
          const sel = new Set(s.sel);  // sel: the ticked positions as a set
          const ok = sel.size === ans.size && [...sel].every((x) => ans.has(x));  // correct only if exactly the right choices are ticked: same count, and every ticked one is correct
          if (ok) api.finish(true);  // all correct: the question ends as right
          else { const good = [...sel].filter((x) => ans.has(x)).length; api.miss(`You picked ${good} correct option${good === 1 ? '' : 's'} and ${sel.size - good} incorrect one${sel.size - good === 1 ? '' : 's'}. There ${ans.size === 1 ? 'is' : 'are'} ${ans.size} correct option${ans.size === 1 ? '' : 's'} in total.`); }  // otherwise a miss, with a count of correct and incorrect ticks and how many correct options exist in total
          paint(true);  // redraws with wrong ticks marked
        });  // ends the Check handler
        left.append(chk);  // places the Check button under the options
        function paint(checked) {  // paint(checked): marks the buttons; checked is true right after a check, to show which ticks were wrong
          btns.forEach((b, j) => {  // for each button...
            const on = s.sel.includes(j);  // on: whether this choice is ticked
            b.classList.toggle('sel', on && !s.done);  // highlights ticked choices while the question is still open
            b.querySelector('.ql').textContent = on ? '☑' : '☐';  // shows a ticked or an empty box to match
            b.classList.remove('right', 'wrong');  // clears old right/wrong marks
            if (s.done) { b.disabled = true; if (ans.has(j)) b.classList.add('right'); else if (on) b.classList.add('wrong'); else b.classList.add('dim'); }  // once finished: all switched off; correct choices green, wrongly ticked ones red, the rest dimmed
            else if (checked && on && !ans.has(j)) b.classList.add('wrong');  // right after a check: marks wrongly ticked choices in red so the student can change them
          });  // ends the loop over buttons
          chk.disabled = s.done;  // switches off the Check button once the question is finished
        }  // ends paint
        paint(false);  // draws the buttons' starting state
      },  // ends the select-all drawer
      order(q, s, box, api, left) {  // put in order: rows the student arranges by dragging or with up/down buttons
        if (!s.arr) { let a; let guard = 0; do { a = shuffle(range(q.items.length)); guard++; } while (a.every((v, k) => v === k) && guard < 20); s.arr = a; }  // on first showing, shuffles the items, reshuffling (up to 20 times) if the shuffle happens to be already correct
        let dragFrom = null;  // dragFrom: the position of the row being dragged, if any
        function paint(checked) {  // paint(checked): redraws every row in its current position
          box.innerHTML = '';  // clears the rows
          s.arr.forEach((it, pos) => {  // one row per item: the variable it holds the item's correct position, and pos its current one
            const row = h('div', { class: 'qord', draggable: s.done ? 'false' : 'true' },  // the row, draggable while the question is still open
              h('span', { class: 'grip' }, '⋮⋮'), h('span', { class: 'b', style: { color: 'var(--muted)', minWidth: '1.4em' } }, String(pos + 1)),  // a grip mark showing the row can be dragged, then its current position number in grey
              h('span', { class: 'txt', html: q.items[it] }),  // the item text
              s.done ? null : h('span', { class: 'mv' },  // while open: the move buttons
                h('button', { type: 'button', 'aria-label': 'Move up', onclick: () => move(pos, pos - 1), disabled: pos === 0 }, '▲'),  // up arrow button: swaps the row one place up (switched off for the top row)
                h('button', { type: 'button', 'aria-label': 'Move down', onclick: () => move(pos, pos + 1), disabled: pos === s.arr.length - 1 }, '▼')));  // down arrow button: swaps the row one place down (switched off for the bottom row)
            if (s.done || checked) row.classList.add(it === pos ? 'right' : 'wrong');  // after a check, or once finished: green if the item is in its correct place, red if not
            row.addEventListener('dragstart', (e) => { dragFrom = pos; row.classList.add('drag'); try { e.dataTransfer.setData('text/plain', String(pos)); e.dataTransfer.effectAllowed = 'move'; } catch (x) { /* ignore */ } });
            row.addEventListener('dragend', () => row.classList.remove('drag'));  // when a drag ends, the dragged look is removed
            row.addEventListener('dragover', (e) => e.preventDefault());  // allowing the dragover event is what lets the browser accept a drop on this row
            row.addEventListener('drop', (e) => { e.preventDefault(); if (dragFrom != null) move(dragFrom, pos); dragFrom = null; });  // on drop: moves the dragged row to this row's position
            box.append(row);  // adds the row to the options box
          });  // ends the loop over rows
        }  // ends paint
        function move(a, b) { if (s.done || b < 0 || b >= s.arr.length) return; const [x] = s.arr.splice(a, 1); s.arr.splice(b, 0, x); paint(false); saveState(); }  // move(a, b): moves the item at position a to position b (if still open and b is valid), redraws and saves
        const chk = checkBtn(() => {  // the Check answer button for this question
          if (s.done) return;  // a finished question ignores further checks
          const right = s.arr.filter((v, k) => v === k).length;  // right: how many items sit in their correct place
          if (right === s.arr.length) { api.finish(true); paint(true); }  // all in place: the question ends as right
          else { api.miss(`${right} of ${s.arr.length} items are in the right position (green).`); if (s.done) { s.arr = range(q.items.length); } paint(true); }  // otherwise a miss with the count; if that used the last try, the rows are put in the correct order to show the answer
          chk.disabled = s.done;  // switches off the Check button once the question is finished
        });  // ends the Check handler
        if (s.done) s.arr = s.res === 'wrong' ? range(q.items.length) : s.arr;  // when returning to a question that ended wrong, shows the correct order
        left.append(chk); chk.disabled = s.done;  // places the Check button under the rows, switched off if the question is finished
        paint(false);  // draws the rows
      },  // ends the put-in-order drawer
      match(q, s, box, api, left) {  // match the pairs: one dropdown per left-hand item, listing all right-hand answers
        if (!s.opts) s.opts = shuffle(q.pairs.map((p) => p[1]));  // on first showing, shuffles the right-hand answers into the order the dropdowns list them
        s.sel = s.sel || q.pairs.map(() => '');  // s.sel: the student's choice in each row, empty to begin with
        const rows = q.pairs.map((p, j) => {  // one row per pair
          const sel = h('select', { 'aria-label': 'Match for ' + p[0].replace(/<[^>]+>/g, ''), onchange: () => { s.sel[j] = sel.value; rows[j].classList.remove('right', 'wrong'); } },  // the dropdown, with a screen-reader name taken from the item's text; choosing stores the answer and clears old marks
            h('option', { value: '' }, '— choose —'), s.opts.map((v) => h('option', { value: v }, v.replace(/<[^>]+>/g, ''))));  // a "choose" prompt option, then one option per answer (HTML tags removed, since dropdowns show plain text)
          sel.value = s.sel[j];  // restores the saved choice
          const row = h('div', { class: 'qrow' }, h('span', { html: p[0] }), sel);  // the row: the left-hand item, then its dropdown
          return row;  // hands the row back to the map
        });  // ends the row builder
        box.append(...rows);  // puts the rows in the options box
        function paint(checked) {  // paint(checked): marks each row right or wrong
          rows.forEach((r, j) => {  // for each row...
            const sel = r.querySelector('select');  // its dropdown
            if (s.done) { sel.value = q.pairs[j][1]; sel.disabled = true; }  // once finished: shows the correct answer and switches the dropdown off
            r.classList.remove('right', 'wrong');  // clears old marks
            if (checked || s.done) r.classList.add(sel.value === q.pairs[j][1] ? 'right' : 'wrong');  // after a check, or once finished: green if the chosen answer is correct, red if not
          });  // ends the loop over rows
        }  // ends paint
        const chk = checkBtn(() => {  // the Check answer button for this question
          if (s.done) return;  // a finished question ignores further checks
          const right = q.pairs.filter((p, j) => s.sel[j] === p[1]).length;  // right: how many rows have the correct answer
          if (right === q.pairs.length) api.finish(true); else api.miss(`${right} of ${q.pairs.length} matches are correct (green).`);  // all correct: the question ends as right; otherwise a miss with the count
          paint(true); chk.disabled = s.done;  // redraws with the marks and switches off the Check button if finished
        });  // ends the Check handler
        left.append(chk); chk.disabled = s.done;  // places the Check button under the rows, switched off if the question is finished
        paint(false);  // draws the starting state
      },  // ends the match drawer
      bucket(q, s, box, api, left) {  // sort into groups: each item gets a segmented switch listing the groups
        s.sel = s.sel || q.items.map(() => -1);  // s.sel: the group chosen for each item, -1 meaning not chosen yet
        const rows = q.items.map((it, j) => {  // one row per item
          const seg = UI.seg(ctx, q.buckets.map((b, bi) => ({ value: bi, label: b })), s.sel[j], (v) => { s.sel[j] = v; rows[j].classList.remove('right', 'wrong'); });  // a switch with one button per group; choosing stores the group and clears old marks
          return h('div', { class: 'qrow' }, h('span', { html: it[0] }), seg);  // the row: the item text, then its switch
        });  // ends the row builder
        box.append(...rows);  // puts the rows in the options box
        function paint(checked) {  // paint(checked): marks each row right or wrong
          rows.forEach((r, j) => {  // for each row...
            if (s.done) { r.querySelector('.seg').set(q.items[j][1]); r.querySelectorAll('.seg button').forEach((b) => (b.disabled = true)); }  // once finished: sets each switch to the correct group and switches its buttons off
            r.classList.remove('right', 'wrong');  // clears old marks
            if (s.done) r.classList.add('right');  // once finished every row shows the correct group, so it is marked green
            else if (checked) r.classList.add(s.sel[j] === q.items[j][1] ? 'right' : 'wrong');  // right after a check: green if the chosen group is correct, red if not
          });  // ends the loop over rows
        }  // ends paint
        const chk = checkBtn(() => {  // the Check answer button for this question
          if (s.done) return;  // a finished question ignores further checks
          const right = q.items.filter((it, j) => s.sel[j] === it[1]).length;  // right: how many items are in their correct group
          if (right === q.items.length) api.finish(true); else api.miss(`${right} of ${q.items.length} are in the right group (green).`);  // all correct: the question ends as right; otherwise a miss with the count
          paint(true); chk.disabled = s.done;  // redraws with the marks and switches off the Check button if finished
        });  // ends the Check handler
        left.append(chk); chk.disabled = s.done;  // places the Check button under the rows, switched off if the question is finished
        paint(false);  // draws the starting state
      },  // ends the sort drawer
      num(q, s, box, api) {  // calculate: a text box for a number, an optional unit, and a Check button
        const inp = h('input', { type: 'text', inputmode: 'decimal', 'aria-label': 'Your answer', placeholder: 'your answer', value: s.val || '' });  // the answer box; inputmode decimal asks phones for a number keypad; it keeps any text typed earlier
        const tol = q.tol != null ? q.tol : q.rtol != null ? Math.abs(q.answer * q.rtol) : 1e-9;  // tol: how far off an answer may be: a fixed amount (tol), a fraction of the answer (rtol), or practically none
        const chk = h('button', { class: 'btn primary', type: 'button', onclick: () => {  // the Check answer button, with its click handler written inline
          if (s.done) return;  // a finished question ignores further checks
          const v = parseFloat(String(inp.value).replace(/,/g, ''));  // reads the typed text as a number, ignoring thousands commas such as 1,024
          s.val = inp.value;  // remembers exactly what was typed
          if (Number.isNaN(v)) { toast('Type a number first.'); return; }  // nothing number-like typed: a toast asks for a number and the attempt does not count
          if (Math.abs(v - q.answer) <= tol + 1e-12) { inp.classList.add('right'); api.finish(true); }  // within tolerance (plus a tiny margin for rounding in computer arithmetic): marked green and finished as right
          else {  // otherwise...
            inp.classList.add('wrong');  // the box is marked red
            const dir = v > q.answer ? 'too high' : 'too low';  // dir: whether the answer was too high or too low
            const unitNote = q.unit ? ` The answer is in ${q.unit}.` : '';  // a reminder of the unit when the question has one
            api.miss(`${esc(inp.value)}${q.unit ? ' ' + q.unit : ''} is ${dir}.${unitNote} Recheck each step of your working${q.hint ? '' : ' and the formula you used'}.`);  // counts a miss with the typed value, its direction, the unit and a nudge to recheck the working (and the formula if no hint)
          }  // ends the wrong-answer case
          paint();  // updates the box if the question is now finished
        } }, 'Check answer');  // ends the click handler; the button reads "Check answer"
        inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') chk.click(); });  // pressing Enter in the box does the same as clicking Check
        inp.addEventListener('input', () => { inp.classList.remove('wrong'); s.val = inp.value; saveState(); });  // typing clears the red mark and saves the text straight away, so it survives leaving the slide
        box.append(h('div', { class: 'qnum' }, inp, q.unit ? h('span', { class: 'b', html: q.unit }) : null, chk));  // the row: answer box, unit (if any), Check button
        function paint() {  // paint(): once finished, shows the correct answer in the box, in green, and switches the box and button off
          if (s.done) { inp.value = String(q.answer); inp.disabled = true; chk.disabled = true; inp.classList.remove('wrong'); inp.classList.add('right'); }  // the finished-state update
        }  // ends paint
        paint();  // draws the starting state
      },  // ends the calculate drawer
    };  // closes the RENDER table
    if (startSum && order.every((qi) => st[qi].done)) summary(); else show(Math.min(startPos, order.length - 1));  // first screen: the results page if it was showing when the student left (and every answer is still finished), else a question
    return root;  // hands the quiz widget back to the caller
  }  // ends quiz
  UI.quiz = (ctx, questions, o) => quiz(ctx, questions, o || {});  // UI.quiz(ctx, questions, o): lets a step build its own quiz inside a render function

  /* ------------------------------------------------------------ drawers, glossary, notes, help */
  let returnFocus = null;  // returnFocus: the element that had keyboard focus before a panel opened, so focus can go back there on close
  function setOverlayState() {  // setOverlayState(): makes open panels usable and everything else unreachable, for mouse, keyboard and screen readers
    let anyOpen = false;  // anyOpen turns true if any panel or the help window is open
    [els.toc, els.gloss, els.notes, els.modal].forEach((d) => { const on = d.classList.contains('on'); anyOpen = anyOpen || on; d.inert = !on; d.setAttribute('aria-hidden', on ? 'false' : 'true'); });  // each closed panel is made inert (cannot be clicked or focused) and hidden from screen readers; open ones the reverse
    els.app.inert = anyOpen;   // everything behind an open panel is unreachable, so Tab stays inside the panel
  }  // ends setOverlayState
  function openDrawer(which) {  // openDrawer(which): opens the contents ('toc'), glossary ('gloss') or notes ('notes') panel
    const prev = document.activeElement;  // remembers what had focus before
    closeAll(true);  // closes anything already open but keeps the dim backdrop, so switching panels does not flicker
    returnFocus = prev && prev !== document.body ? prev : null;  // saves that element to return focus to later (not the page body itself)
    els.scrim.classList.add('on');  // shows the dim backdrop
    if (which === 'toc') { renderToc(); els.toc.classList.add('on'); setTimeout(() => { const on = els.tocBody.querySelector('.on'); if (on) on.scrollIntoView({ block: 'center' }); els.tocSearch.focus({ preventScroll: true }); }, 60); }  // contents: redraws it, slides it in, then scrolls the current section into view and puts the cursor in its search box
    if (which === 'gloss') { renderGloss(); els.gloss.classList.add('on'); setTimeout(() => els.glSearch.focus(), 60); }  // glossary: redraws it, slides it in, then puts the cursor in its search box
    if (which === 'notes') { renderNotes(); els.notes.classList.add('on'); setTimeout(() => { const b = els.notes.querySelector('button'); if (b) b.focus(); }, 60); }  // notes: fills it for the current section, slides it in, then focuses its first button (the close button)
    setOverlayState();  // updates which parts of the page are reachable
  }  // ends openDrawer
  function closeAll(keepScrimArg) {  // closeAll(keepScrimArg): closes every panel and the help window
    const keepScrim = keepScrimArg === true;   // handlers bound as onclick: closeAll receive an Event, which must not keep the backdrop
    const wasOpen = [els.toc, els.gloss, els.notes, els.modal].some((d) => d.classList.contains('on'));  // wasOpen: whether anything was open before this call
    const focusInside = document.activeElement && document.activeElement.closest && document.activeElement.closest('.drawer, .modal');  // whether keyboard focus is currently inside a panel or the help window
    [els.toc, els.gloss, els.notes, els.modal].forEach((d) => d.classList.remove('on'));  // slides every panel out and hides the help window
    if (!keepScrim) els.scrim.classList.remove('on');  // hides the backdrop too, unless the caller is about to open another panel
    setOverlayState();  // makes the page behind reachable again
    hideTerm();  // hides any definition pop-up
    if (wasOpen && !keepScrim) {  // on a real close, gives keyboard focus back
      const target = returnFocus && returnFocus.isConnected && !returnFocus.closest('.drawer, .modal') ? returnFocus : null;  // to the element that had it before, if it is still on the page and not itself inside a panel
      if (target) target.focus({ preventScroll: true }); else if (focusInside) document.activeElement.blur();  // focuses that element without scrolling; otherwise just drops focus if it was left inside the closed panel
      returnFocus = null;  // forgets the saved element
    }  // ends the focus hand-back
  }  // ends closeAll
  function renderToc() {  // renderToc(): draws the contents panel, filtered by what is typed in its search box
    const f = (els.tocSearch.value || '').toLowerCase().trim();  // f: the filter text, lowercased; empty means show everything
    const sl = slides[cur] || {};  // sl: the slide on screen (an empty object before the first slide)
    els.tocBody.innerHTML = '';  // clears the panel body
    const home = h('button', { type: 'button', class: 'toc-sec' + (sl.type === 'home' ? ' on' : ''), style: { paddingLeft: '8px' }, onclick: () => { closeAll(); go(0); } }, h('span', { class: 'tt b' }, 'Home'));  // a Home entry, highlighted when on the home page; clicking closes the panel and goes home
    if (!f) els.tocBody.append(home);  // Home is listed only when no filter is typed
    for (const c of sortedChapters()) {  // one group per chapter
      const secs = sectionsOf(c.num).filter((x) => !f || (x.id + ' ' + lab(x) + ' ' + x.title + ' ' + (x.summary || '')).toLowerCase().includes(f));  // the chapter's sections whose id, title or summary contain the filter text
      if (f && !secs.length && !c.title.toLowerCase().includes(f)) continue;  // while filtering, skips a chapter with no matching section unless its own title matches
      const grp = h('div', { class: 'toc-ch' });  // the chapter's group box
      const cm = chapterMastery(c.num);  // the chapter's quiz results, for the tooltip
      grp.append(h('button', { type: 'button', class: 'toc-ch-head', style: { '--c': `var(--ch${c.num})` }, title: cm ? `Quizzes tried: ${cm.tried} of ${cm.of} · ${Math.round(cm.pct * 100)}% right on the first try` : '', onclick: () => { closeAll(); go(slideIndex('ch' + c.num)); } },  // chapter heading button in the chapter's colour; hovering shows quiz results; a click opens the chapter overview
        h('span', { class: 'toc-ch-num' }, String(c.num)), h('span', { class: 'toc-ch-title' }, c.title), h('span', { class: 'toc-pct' }, Math.round(progressOfChapter(c.num) * 100) + '%')));  // inside it: the chapter number, its title, and the percent of its steps visited
      for (const x of secs) {  // one entry per matching section
        const on = sl.sec === x;  // on: whether this is the section on screen now
        grp.append(h('button', { type: 'button', class: 'toc-sec' + (on ? ' on' : ''), 'aria-current': on ? 'true' : null, onclick: () => { closeAll(); go(slideIndex(x.id + '/1')); } },  // the section entry, highlighted and marked as current for screen readers when on; a click opens its first step
          h('span', { class: 'n' }, lab(x)), h('span', { class: 'tt' }, x.title), masteryChip(secMastery(x)), secDone(x) ? h('span', { class: 'ck', title: 'All steps visited' }, '✓') : null));  // inside it: section id, title, quiz score tag, and a check mark once every step has been visited
      }  // ends the loop over sections
      if (!f && sectionsOf(c.num).length) {  // when not filtering, chapters with sections also list their two review pages
        [['-terms', 'Key-term flashcards'], ['-quiz', 'Chapter challenge']].forEach(([suf, lab]) => grp.append(h('button', { type: 'button', class: 'toc-sec extra' + (sl.key === 'ch' + c.num + suf ? ' on' : ''), onclick: () => { closeAll(); go(slideIndex('ch' + c.num + suf)); } }, h('span', { class: 'n' }, ''), h('span', { class: 'tt' }, lab))));  // entries for the chapter's key-term flashcards and challenge quiz, highlighted when one of them is on screen
      }  // ends the review entries
      els.tocBody.append(grp);  // adds the chapter group to the panel
    }  // ends the loop over chapters
    if (!f && slideIndex('final') >= 0) els.tocBody.append(h('button', { type: 'button', class: 'toc-sec' + (sl.type === 'final' ? ' on' : ''), style: { paddingLeft: '8px' }, onclick: () => { closeAll(); go(slideIndex('final')); } }, h('span', { class: 'tt b' }, 'Final challenge (all chapters)')));  // when not filtering: a Final challenge entry at the bottom, highlighted while on it
    if (!f) els.tocBody.append(h('button', { type: 'button', class: 'toc-sec', style: { paddingLeft: '8px' }, onclick: () => { closeAll(); openPrint(); } }, h('span', { class: 'tt' }, 'Printable study guide (opens a new tab)')));  // and an entry that opens the printable study guide in a new tab
  }  // ends renderToc
  function renderGloss() {  // renderGloss(): draws the glossary panel, filtered by what is typed in its search box
    const f = (els.glSearch.value || '').toLowerCase().trim();  // f: the search text, lowercased; empty means show every term
    els.glBody.innerHTML = '';  // clears the panel body
    let letter = '';  // letter: the first letter of the previous term, used to insert A, B, C... headings
    let list = gloss.filter((g) => !f || g.term.toLowerCase().includes(f) || g.def.toLowerCase().includes(f));  // the terms whose name or definition contains the search text (all of them when the box is empty)
    if (f) {  // while searching, the best matches go first
      const rank = (g) => { const t = g.term.toLowerCase(); return t === f || baseName(g.term) === f ? 0 : t.startsWith(f) ? 1 : t.includes(f) ? 2 : 3; };  // rank: 0 for an exact name match, 1 if the name starts with the text, 2 if it contains it, 3 if only the definition does
      list = list.slice().sort((a, b) => rank(a) - rank(b));  // sorts by that rank; terms with equal rank keep their alphabetical order
    }  // ends the ranking
    if (!list.length) els.glBody.append(h('p', { class: 'muted' }, 'No matching terms.'));  // nothing found: a short message
    for (const g of list) {  // one entry per term
      const L = g.term.replace(/^[^A-Za-z0-9]+/, '').charAt(0).toUpperCase();  // L: the term's first letter or digit, in capitals, skipping any leading symbols
      if (L !== letter && !f) { letter = L; els.glBody.append(h('div', { class: 'gl-letter' }, L)); }  // when not searching, a new first letter gets its own heading
      const prior = isPrior(g.src);  // prior: true when the term was taught in the earlier volume, which is a different page
      const target = g.src.startsWith('ch') ? g.src : g.src + '/1';  // target: the slide that teaches this term: the chapter overview, or the section's first step
      if (slideIndex(target) < 0 && !g.src.startsWith('ch')) { /* term from a section not in this build */ }
      els.glBody.append(h('div', { class: 'gl-item' }, h('b', {}, g.term), (prior ? h('span', { class: 'src', title: 'Taught in ' + priorWhere(g.src) }, 'Ch ' + BOOK.prior + ' guide') : h('span', { class: 'src', title: 'Go to where this term is taught', onclick: () => { closeAll(); go(slideIndex(target)); } }, g.src.startsWith('ch') ? 'Chapter ' + g.src.slice(2) : '§' + labOf(g.src))), h('p', {}, g.def)));  // the entry: the term in bold, a link naming where it is taught (a click closes the panel and goes there), the definition (an earlier-volume term names that volume instead of linking)
    }  // ends the loop over terms
  }  // ends renderGloss
  function renderNotes() {  // renderNotes(): fills the notes panel with the notes of the section on screen
    const sl = slides[cur];  // sl: the slide on screen
    const sec = sl && sl.sec;  // sec: its section, if it has one
    els.notesTitle.textContent = sec ? (sec.pseudo ? sec.title : `${lab(sec)} ${sec.title}`) + ' — notes' : 'Notes';  // panel title, e.g. "3.2 Process States — notes" (or the chapter title for chapter intro steps)
    els.notesBody.innerHTML = sec && sec.notes ? sec.notes : '<p class="muted">Notes are available on section steps.</p>';  // the notes themselves (HTML written by the section), or a short message on slides without notes
  }  // ends renderNotes
  function openModal() {  // openModal(): opens the help window with shortcuts, colour key, route switch, printable guide and progress reset
    const prev = document.activeElement;  // remembers what had focus before
    closeAll(true);  // closes any open panel but keeps the dim backdrop
    returnFocus = prev && prev !== document.body ? prev : null;  // saves that element so focus can return to it on close
    els.scrim.classList.add('on');  // shows the dim backdrop
    els.modal.innerHTML = '';  // clears the previous contents of the help window
    els.modal.append(h('div', { class: 'modal-card', role: 'dialog', 'aria-label': 'Help' },  // the help card; role dialog tells screen readers it is a window on top of the page
      h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', {}, 'How to use this guide'), iconBtn('close', 'Close', closeAll)),  // header row: the title and a close button
      h('p', { class: 'small' }, 'Each section moves from a plain-language explanation, to simulations you control, to a short self-check. Your progress is saved in this browser only.'),  // a sentence on how each section is organised and that progress is saved only in this browser
      h('div', { class: 'keys', html: [  // the shortcut table, built from key and meaning pairs below
        ['← / →', 'Previous / next step'], ['[ / ]', 'Previous / next section'], ['T', 'Table of contents'], ['G', 'Glossary of every key term'],  // shortcuts: arrow keys for steps, brackets for sections, T for contents, G for glossary
        ['N', 'Printable notes for the current section'], ['F', 'Full screen (great for projectors)'], ['D', 'Dark / light mode'], ['Esc', 'Close any panel'],  // shortcuts: N for the section notes, F for full screen, D for dark/light mode, Esc to close panels
      ].map(([k, v]) => `<kbd>${k}</kbd><span>${v}</span>`).join('') }),  // each pair becomes a key cap followed by its meaning; the list closes here
      h('h4', { style: { margin: '14px 0 6px' } }, 'Colour language'), legend(),  // heading and the colour key used in every diagram
      h('h4', { style: { margin: '14px 0 6px' } }, 'Learning route'),  // heading for the route explanation
      h('p', { class: 'small', style: { margin: '0 0 6px' } }, 'The core path keeps each section\'s big picture, its key hands-on steps, the recap and the quiz. Use it for a first pass or for revision; everything stays reachable from the contents and the step dots.'),  // explains what the core path keeps and when to use it
      routeSeg(),  // the Full course / Core path switch
      h('div', { class: 'row', style: { marginTop: '12px' } }, h('button', { class: 'btn sm', type: 'button', onclick: () => { closeAll(); openPrint(); } }, 'Printable study guide')),  // a button that closes the help and opens the printable study guide
      h('div', { class: 'row', style: { marginTop: '16px', justifyContent: 'space-between' } },  // bottom row: reset on the left, close on the right
        h('button', { class: 'btn sm danger', onclick: () => { const d = store.data; d.visited = dict(); d.quiz = dict(); d.known = dict(); d.qstate = dict(); d.qdraw = dict(); d.chLast = dict(); d.last = null; store.save(); closeAll(); go(cur); toast('Progress cleared.'); } }, 'Reset my progress'),  // Reset my progress: empties visits, quiz scores, known terms, saved answers and last places, then redraws and confirms
        h('button', { class: 'btn primary', onclick: closeAll }, 'Got it'))));  // Got it: closes the help window; the brackets here also close the bottom row and the help card
    els.modal.classList.add('on');  // shows the help window
    setOverlayState();  // makes only the help window reachable
    setTimeout(() => { const b = els.modal.querySelector('.modal-card button'); if (b) b.focus(); }, 60);  // after a moment, puts keyboard focus on the first button in the card (the close button)
  }  // ends openModal

  /* ------------------------------------------------------------ term popovers */
  let popTimer = null;  // popTimer: the delay timer used to show or hide a pop-up on mouse hover
  let popFor = null;  // popFor: the dotted word whose definition is showing, so a second Enter closes it and screen readers know which word it describes
  function armTerms(root) {  // armTerms(root): makes every dotted key term inside root reachable and usable from the keyboard
    if (!root || !root.querySelectorAll) return;  // ignores text nodes and anything without children to search
    const list = root.matches && root.matches('.t') ? [root] : [];  // list: root itself if it is a term
    list.push(...root.querySelectorAll('.t'));  // plus every term inside it
    for (const el of list) {  // goes through them
      if (el.hasAttribute('tabindex') || (el.parentElement && el.parentElement.closest('button, a, label, [role="button"]'))) continue;  // skips terms already set up, and terms inside a button, link or card (a control inside a control confuses keyboards and screen readers)
      el.setAttribute('tabindex', '0'); el.setAttribute('role', 'button');  // Tab can now reach the word, and screen readers announce it as something to press
      el.setAttribute('aria-label', (el.textContent || '').trim() + ', show definition');  // its spoken name says what pressing it does
    }  // ends the loop over terms
  }  // ends armTerms
  function showTerm(el) {  // showTerm(el): shows the definition pop-up for a dotted word el, positioned just below it (or above if no room)
    const key = el.dataset.t || el.textContent;  // the term to look up: the element's data-t attribute if it has one, otherwise its visible text
    const sl = slides[cur];  // sl: the slide on screen
    const g = lookupTerm(key, sl && sl.sec ? sl.sec.id : null);  // looks up the term, preferring the wording of the section on screen
    if (!g) { console.warn('[term] no glossary entry for "' + key + '"'); return; }  // no definition found: warns in the console so the author can add one, and shows nothing
    els.pop.innerHTML = `<b>${esc(g.term)}</b>${esc(g.def)}<div class="src">${isPrior(g.src) ? 'Taught in ' + esc(priorWhere(g.src)) : g.src.startsWith('ch') ? 'Chapter ' + g.src.slice(2) + ' overview' : 'Taught in §' + esc(labOf(g.src))} · full list: press G</div>`;  // fills the pop-up: the term in bold, its definition, and where it is taught, with a reminder that G opens the full list
    els.pop.classList.add('on');  // makes the pop-up visible so its size can be measured
    if (popFor && popFor !== el) popFor.removeAttribute('aria-describedby');  // the word that showed the previous definition no longer points at the pop-up
    popFor = el; el.setAttribute('aria-describedby', 'term-pop');  // this word now points screen readers at the definition it opened
    const r = el.getBoundingClientRect(); const pr = els.pop.getBoundingClientRect();  // r: where the word is on screen; pr: the pop-up's size
    let x = r.left + r.width / 2 - pr.width / 2; x = clamp(x, 8, innerWidth - pr.width - 8);  // centres the pop-up under the word, but keeps it at least 8 pixels inside the window's left and right edges
    let y = r.bottom + 8; if (y + pr.height > innerHeight - 8) y = r.top - pr.height - 8;  // places it 8 pixels below the word, or above the word if it would run off the bottom of the window
    els.pop.style.left = x + 'px'; els.pop.style.top = Math.max(8, y) + 'px';  // moves the pop-up there, never above the top edge
  }  // ends showTerm
  function hideTerm() { clearTimeout(popTimer); if (els.pop) els.pop.classList.remove('on'); if (popFor) { popFor.removeAttribute('aria-describedby'); popFor = null; } }  // hideTerm(): cancels any pending hover timer, hides the pop-up and unlinks it from its word

  /* ------------------------------------------------------------ misc */
  function toast(msg, ms = 2200) {  // toast(msg, ms): shows a short message at the bottom of the screen for ms milliseconds (2.2 seconds by default)
    els.toast.textContent = msg; els.toast.classList.add('on');  // sets the text and makes the toast visible
    clearTimeout(toast.t); toast.t = setTimeout(() => els.toast.classList.remove('on'), ms);  // cancels the hide timer of an earlier toast (kept on the function itself as toast.t), then schedules this one's hide
  }  // ends toast
  Guide.toast = (m) => toast(m);  // Guide.toast(m): lets sections show a toast with the default timing
  function applyTheme() {  // applyTheme(): applies the saved light or dark theme
    const t = store.data.theme || 'light';  // t: the saved theme, light by default
    document.documentElement.dataset.theme = t;  // sets data-theme on the page root; the stylesheet swaps every colour variable based on it
    if (els.theme) els.theme.innerHTML = t === 'dark' ? ICON.sun : ICON.moon;  // the theme button shows a sun in dark mode and a moon in light mode (the icon of the mode you would switch to)
  }  // ends applyTheme
  function toggleTheme() { store.data.theme = (store.data.theme || 'light') === 'dark' ? 'light' : 'dark'; store.save(); applyTheme(); }  // toggleTheme(): switches between light and dark, saves the choice and applies it
  function toggleFull() {  // toggleFull(): enters or leaves full screen
    try { if (!document.fullscreenElement) document.documentElement.requestFullscreen(); else document.exitFullscreen(); } catch (e) { toast('Full screen is not available here.'); }  // asks the browser for full screen if not already in it, otherwise leaves it; if refused, a toast explains
  }  // ends toggleFull

  function bindGlobal() {  // bindGlobal(): sets up the page-wide keyboard shortcuts, term pop-ups and resize handling, once at start-up
    document.addEventListener('keydown', (e) => {  // one keyboard handler for the whole page
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;  // leaves alone keys already handled elsewhere and any key pressed with Command, Control or Alt (browser shortcuts)
      const t = e.target;  // t: the element that had focus when the key was pressed
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) && !(e.key === 'Tab' && t.closest && t.closest('.drawer.on, .modal.on'))) { if (e.key === 'Escape') { t.blur(); closeAll(); } return; }  // while typing in a box or dropdown, shortcuts stay off (except Tab inside a panel); Escape leaves the box and closes panels
      if ((e.key === 'Enter' || e.key === ' ') && t && t.classList && t.classList.contains('t')) { e.preventDefault(); if (popFor === t && els.pop.classList.contains('on')) hideTerm(); else showTerm(t); return; }  // Enter or Space on a focused dotted word opens its definition, or closes it if it is already open: the keyboard version of clicking it
      const k = e.key;  // k: the key's name, like ArrowRight or g
      const openPanel = [els.toc, els.gloss, els.notes, els.modal].find((d) => d.classList.contains('on'));  // openPanel: the panel or help window that is open, if any
      if (openPanel && k === 'Tab') {   // keep focus cycling inside the open panel
        const f = [...openPanel.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((x) => !x.disabled && x.getClientRects().length);  // f: every focusable, enabled, visible element inside the panel
        if (!f.length) { e.preventDefault(); return; }  // nothing focusable: Tab does nothing
        const first = f[0], last = f[f.length - 1], a = document.activeElement;  // first and last focusable elements, and a, the element focused now
        if (!openPanel.contains(a)) { e.preventDefault(); first.focus(); }  // if focus somehow sits outside the panel, it is pulled back to the first element
        else if (e.shiftKey && a === first) { e.preventDefault(); last.focus(); }  // Shift+Tab on the first element wraps round to the last one
        else if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); }  // Tab on the last element wraps round to the first one
        return;  // Tab between those is left to the browser
      }  // ends the Tab handling
      if (openPanel) {   // while a panel is open only Escape (or the panel's own key) acts; slides never move behind it
        const own = { t: els.toc, g: els.gloss, n: els.notes, '?': els.modal }[k.toLowerCase()];  // own: which panel this key opens (T, G, N or ?)
        if (k === 'Escape' || own === openPanel) { e.preventDefault(); closeAll(); }  // Escape, or pressing the open panel's own key again, closes it
        return;  // every other key is ignored while a panel is open
      }  // ends the open-panel handling
      const arrows = k === 'ArrowRight' || k === 'ArrowLeft' || k === 'ArrowUp' || k === 'ArrowDown' || k === 'Home' || k === 'End';  // arrows: true for the arrow keys and Home/End, which some widgets use for their own movement
      if (arrows && t && t.closest && t.closest('[role="tablist"], .seg, [role="radiogroup"], [role="listbox"], [role="slider"], [role="menu"], [data-keys]')) return;  // inside tabs, segmented switches, sliders, menus or anything marked data-keys, those keys belong to the widget, not the slides
      if (k === 'ArrowRight' || k === 'PageDown') { e.preventDefault(); step(1); }  // Right arrow or Page Down: next slide; preventDefault stops the page from scrolling as well
      else if (k === 'ArrowLeft' || k === 'PageUp') { e.preventDefault(); step(-1); }  // Left arrow or Page Up: previous slide
      else if (k === ']') sectionJump(1);  // ] jumps to the next section
      else if (k === '[') sectionJump(-1);  // [ jumps back to the start of the previous section
      else if (k === 't' || k === 'T') (els.toc.classList.contains('on') ? closeAll() : openDrawer('toc'));  // T opens the contents panel, or closes it if it is already open
      else if (k === 'g' || k === 'G') (els.gloss.classList.contains('on') ? closeAll() : openDrawer('gloss'));  // G opens the glossary panel, or closes it if it is already open
      else if (k === 'n' || k === 'N') { const sl = slides[cur]; if (els.notes.classList.contains('on')) closeAll(); else if (sl && sl.sec && sl.sec.notes) openDrawer('notes'); else toast('Notes are available on section steps.'); }  // N opens the notes panel on section steps, closes it if open, or explains in a toast that this slide has no notes
      else if (k === 'f' || k === 'F') toggleFull();  // F toggles full screen
      else if (k === 'd' || k === 'D') toggleTheme();  // D toggles dark mode
      else if (k === '?') openModal();  // ? opens the help window
      else if (k === 'Escape') closeAll();  // Escape closes any panel
      else if (k === 'Home' && e.shiftKey) go(0);  // Shift+Home goes back to the home page
    });  // ends the keyboard handler
    document.addEventListener('click', (e) => {  // one click handler for the whole page, for definition pop-ups and fit checks
      const t = e.target.closest && e.target.closest('.t');  // t: the dotted term the click landed on, if any (closest also finds it when a word inside it was clicked)
      if (t) { e.preventDefault(); showTerm(t); return; }  // a click on a dotted term shows its definition (this is how touch screens, with no hover, get definitions)
      if (!e.target.closest || !e.target.closest('.term-pop')) hideTerm();  // a click anywhere else, except on the pop-up itself, hides the definition
      if (e.target.closest && e.target.closest('#canvas')) { clearTimeout(bindGlobal.ov); bindGlobal.ov = setTimeout(checkOverflow, 120); }  // a click inside the slide may have changed its size, so the fit is re-checked 120 ms later (the timer is kept on bindGlobal.ov)
    });  // ends the click handler
    const fine = window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches;  // fine: true when the device has a real mouse that can hover (not a touch screen)
    if (fine) {  // only then are hover pop-ups turned on
      document.addEventListener('mouseover', (e) => {  // mouse moving onto something
        const t = e.target.closest && e.target.closest('.t');  // the dotted term under the mouse, if any
        if (!t) return;  // not over a term: nothing to do
        clearTimeout(popTimer); popTimer = setTimeout(() => showTerm(t), 280);  // over a term: shows its definition after 280 ms, so quickly sweeping the mouse across the text does not flash pop-ups
      });  // ends the mouseover handler
      document.addEventListener('mouseout', (e) => {  // mouse moving off something
        const t = e.target.closest && e.target.closest('.t');  // the dotted term being left, if any
        if (t && !(e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('.t') === t)) { clearTimeout(popTimer); popTimer = setTimeout(hideTerm, 220); }  // if the mouse truly left the term (not just moved onto a part of it), hides the pop-up after 220 ms
      });  // ends the mouseout handler
    }  // ends the hover-only block
    document.addEventListener('focusout', (e) => { if (e.target === popFor) hideTerm(); });  // when keyboard focus leaves the word whose definition is open, the pop-up closes
    if (window.MutationObserver) new MutationObserver((recs) => { for (const r of recs) r.addedNodes.forEach((n) => armTerms(n)); }).observe(els.canvas, { childList: true, subtree: true });  // whenever new content appears in the slide (a new slide, a redrawn panel, a quiz question), its dotted words are made keyboard-ready
    armTerms(els.canvas);  // and the content already on screen is set up now
    window.addEventListener('resize', onResize);  // refits the canvas when the window changes size
    if (window.ResizeObserver) new ResizeObserver(onResize).observe(els.stage);  // also refits when the stage itself changes size for another reason (a ResizeObserver watches one element's size)
    window.addEventListener('hashchange', () => { const i = slideIndex(keyFromHash()); if (i >= 0 && i !== cur) go(i); });  // when the address's # part changes (browser Back/Forward, or an edited link), opens that slide if it exists
  }  // ends bindGlobal

  /* ------------------------------------------------------------ print (PDF study guide) */
  function qAnswerHtml(q) {  // qAnswerHtml(q): the answer part of a question for the printable guide, written out as HTML
    const n = normQ(q);  // n: the question's working copy, with its kind filled in
    const L = 'ABCDEFGH';  // L: the letters used to label choices
    if (n.type === 'mc') return `<ol type="A">${n.choices.map((c) => `<li>${c}</li>`).join('')}</ol><div class="a">Answer: ${L[n.answerIdx]}. ${n.choices[n.answerIdx]}</div>`;  // multiple choice: the choices as a lettered list, then the answer's letter and text
    if (n.type === 'tf') return `<div class="a">Answer: ${q.answer ? 'True' : 'False'}</div>`;  // true/false: just the answer
    if (n.type === 'multi') return `<ol type="A">${n.choices.map((c) => `<li>${c}</li>`).join('')}</ol><div class="a">Answer: ${n.answer.map((i) => L[i]).join(', ')}</div>`;  // select all: the lettered choices, then the letters of all correct ones
    if (n.type === 'order') return `<div class="a">Correct order:</div><ol>${n.items.map((c) => `<li>${c}</li>`).join('')}</ol>`;  // put in order: the items listed in their correct order
    if (n.type === 'match') return `<table>${n.pairs.map((p) => `<tr><td>${p[0]}</td><td class="a">${p[1]}</td></tr>`).join('')}</table>`;  // match: a two-column table pairing each left item with its answer
    if (n.type === 'bucket') return `<table><tr>${n.buckets.map((b) => `<th>${b}</th>`).join('')}</tr><tr>${n.buckets.map((b, bi) => `<td>${n.items.filter((it) => it[1] === bi).map((it) => it[0]).join('<br>')}</td>`).join('')}</tr></table>`;  // sort: a table with one column per group, listing the items that belong in each
    if (n.type === 'num') return `<div class="a">Answer: ${n.answer}${n.unit ? ' ' + n.unit : ''}</div>`;  // calculate: the answer with its unit, if any
    return '';  // any other kind: nothing
  }  // ends qAnswerHtml
  function renderPrint() {  // renderPrint(): builds the printable study guide page instead of the interactive guide (the address has ?print)
    document.documentElement.classList.add('print');  // marks the page root as the print version, which switches the stylesheet to paper layout
    document.body.classList.add('print');  // and the body, for the same reason
    document.documentElement.dataset.theme = 'light';  // always light colours, since dark pages waste ink
    const doc = h('div', { class: 'print-doc' });  // doc: the printable document
    const chs = sortedChapters();  // chs: the chapters in order
    doc.append(h('div', { class: 'p-title' },  // the title page
      h('div', { style: { fontSize: '12pt', fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: '#4f46e5' } }, 'Study guide'),  // a small uppercase "Study guide" label in indigo
      h('h1', {}, 'Operating Systems'),  // the main title
      h('div', { style: { fontSize: '16pt', color: '#3d4760' } }, BOOK.subtitle),  // subtitle naming the chapters this volume covers
      h('p', { style: { marginTop: '18pt', maxWidth: '5.4in', color: '#3d4760' } }, 'This printable guide collects the notes, key terms and review questions (with answers and explanations) from the interactive guide. Use it to review after working through the simulations.'),  // paragraph: what the printable guide contains and when to use it
      h('ol', { style: { marginTop: '14pt', fontSize: '12pt' } }, chs.map((c) => h('li', {}, c.title)))));  // a numbered list of the chapter titles; closes the title page
    const toc = h('div', { class: 'p-toc' }, h('h2', {}, 'Contents'));  // the contents page, starting with its heading
    const tl = h('ol', {});  // tl: the numbered chapter list of the contents
    chs.forEach((c) => tl.append(h('li', {}, h('b', {}, `Chapter ${c.num}: ${c.title}`), h('ul', {}, sectionsOf(c.num).map((x) => h('li', {}, `${lab(x)} ${x.title}`))))));  // each chapter in bold, with its sections listed beneath it
    toc.append(tl);  // adds the list to the contents page
    doc.append(toc);  // adds the contents page to the document
    for (const c of chs) {  // one part of the document per chapter
      const col = getComputedStyle(document.documentElement).getPropertyValue('--ch' + c.num).trim();  // col: the chapter's colour, read from the stylesheet's colour variables
      const chd = h('div', { class: 'p-chapter', style: { '--c': col } });  // chd: the chapter's part, coloured with that colour
      chd.append(h('h2', {}, `Chapter ${c.num} · ${c.title}`));  // the chapter heading, e.g. "Chapter 3 · Process Description and Control"
      if (c.tagline) chd.append(h('p', { class: 'b' }, c.tagline));  // the chapter's tagline in bold, if any
      if (c.intro) chd.append(h('div', { html: c.intro }));  // its introduction, if any
      if (c.objectives) chd.append(h('div', { class: 'p-obj' }, h('b', {}, 'Learning objectives'), h('ul', {}, c.objectives.map((o) => h('li', { html: o })))));  // its learning objectives as a list, if any
      if (c.notes) chd.append(h('div', { html: c.notes }));  // its chapter-level notes, if any
      for (const x of sectionsOf(c.num)) {  // one block per section of the chapter
        const sd = h('div', { class: 'p-sec' });  // sd: the section's block
        sd.append(h('div', { class: 'p-sec-h' }, h('span', { class: 'n' }, lab(x)), h('span', {}, x.title)));  // the section heading: its id and title
        if (x.objectives) sd.append(h('div', { class: 'p-obj' }, h('b', {}, 'You should be able to'), h('ul', {}, x.objectives.map((o) => h('li', { html: o })))));  // its learning objectives, if any
        if (x.notes) sd.append(h('div', { html: x.notes }));  // its notes, if any
        const terms = (x.terms || []).map((t) => (Array.isArray(t) ? t : [t.term, t.def]));  // its key terms, accepting either [term, definition] or { term, def }
        if (terms.length) sd.append(h('h4', {}, 'Key terms'), h('dl', { class: 'p-terms' }, terms.map(([t, d]) => [h('dt', {}, t), h('dd', {}, d)])));  // the key terms as a definition list (term, then its meaning)
        const qs = [];  // qs: every quiz question of the section
        x.steps.forEach((st) => (st.quiz || []).forEach((q) => qs.push(q)));  // collected from each step's quiz
        if (qs.length) {  // if the section has questions...
          sd.append(h('h4', {}, 'Review questions with answers'));  // a heading for them
          qs.forEach((q, i) => sd.append(h('div', { class: 'p-q', html: `<b>${i + 1}.</b> ${q.q}${q.code ? `<pre>${esc(q.code)}</pre>` : ''}${qAnswerHtml(q)}<div class="w">${q.why}</div>` })));  // each numbered question: its text, any code (escaped so it shows as typed), the answer, and the explanation
        }  // ends the questions block
        chd.append(sd);  // adds the section block to the chapter part
      }  // ends the loop over sections
      doc.append(chd);  // adds the chapter part to the document
    }  // ends the loop over chapters
    document.body.append(h('div', { class: 'print-bar' },  // a toolbar at the top of the page (the stylesheet leaves it off the printout)
      h('button', { class: 'btn primary', type: 'button', onclick: () => window.print() }, 'Print or save as PDF'),  // a button that opens the browser's print window, which can also save a PDF
      h('a', { class: 'btn', href: location.href.split('?')[0] }, 'Back to the interactive guide')));  // a link back to the interactive guide (the same address without ?print)
    document.body.append(doc);  // adds the document to the page
    document.title = `Operating Systems Chapters ${BOOK.range.replace('–', '-')} Study Guide`;  // the browser tab title, also used as the default name of a saved PDF
  }  // ends renderPrint

  function keyFromHash() {  // keyFromHash(): reads the slide key from the # part of the page address, e.g. #3.2/4 gives 3.2/4
    const raw = String(location.hash || '').slice(1, 80);  // takes the text after the #, capped at 79 characters so an absurdly long address cannot cause trouble
    try { return decodeURIComponent(raw); } catch (e) { return ''; }   // malformed fragment such as #% → home
  }  // ends keyFromHash

  /* ------------------------------------------------------------ start */
  Guide.start = function () {  // Guide.start(): called once, after every chapter and section file has registered, to build and show the guide
    buildGlossary();  // collects every key term into the glossary
    buildSlides();  // builds the ordered list of slides
    if (/[?&]print\b/.test(location.search)) { renderPrint(); return; }  // if the address asks for ?print, builds the printable study guide instead and stops there
    buildFrame();  // builds the permanent page layout: bars, stage, panels
    setOverlayState();  // marks the closed panels as unreachable
    applyTheme();  // applies the saved light or dark theme
    bindGlobal();  // turns on keyboard shortcuts, term pop-ups and resize handling
    fit();  // scales the canvas to the window
    const initial = slideIndex(keyFromHash());  // the slide named in the address, if any (so a shared link like #3.2/4 opens that step)
    go(initial >= 0 ? initial : 0);  // opens it, or the home page if the address names no valid slide
    if (registerErrors.length) console.error('[guide] registration errors:\n' + registerErrors.join('\n'));  // lists any registration problems in the console in one block, for authors
  };  // ends Guide.start

  /* ------------------------------------------------------------ test hooks (used by the automated checker) */
  function describe(el) {  // describe(el): a short readable label for an element in reports, like div.card.tight "Process states..."
    let d = el.tagName.toLowerCase();  // starts with the tag name, e.g. div
    if (el.id) d += '#' + el.id;  // adds its id, if any, after a #
    const cls = el.getAttribute && el.getAttribute('class');  // its class list, if any
    if (cls) d += '.' + cls.trim().split(/\s+/).slice(0, 3).join('.');  // adds up to three class names, joined by dots
    const txt = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);  // its text, with spaces squeezed, cut to 40 characters
    return txt ? `${d} "${txt}"` : d;  // the label, followed by the text in quotes when there is some
  }  // ends describe
  Guide.debug = {  // Guide.debug: read-only hooks the automated browser tests call to inspect and drive the guide
    slides: () => slides.map((x, i) => ({ i, key: x.key, type: x.type, sec: x.sec ? x.sec.id : null, step: x.i ?? null, title: x.step ? x.step.title : x.title, kind: x.step ? x.step.kind || null : null, hasQuiz: !!(x.step && x.step.quiz) })),  // slides(): a summary of every slide: position, key, type, section, step number, title, kind and whether it holds a quiz
    go: (key) => { const i = slideIndex(key); if (i < 0) return false; go(i); return true; },  // go(key): opens the slide with that key; returns false if there is none
    current: () => slides[cur] && slides[cur].key,  // current(): the key of the slide on screen
    quizIds: (questions) => quizIds(questions),  // quizIds(questions): the same question labels the quiz engine uses, so tests can match saved attempts
    errors: () => renderErrors.slice(),  // errors(): a copy of the list of steps that crashed while drawing
    registerErrors: () => registerErrors.slice(),  // registerErrors(): a copy of the list of registration problems
    metrics() {  // metrics(): measures the slide on screen and reports anything that does not fit or looks broken
      const body = document.querySelector('#canvas .step-body');  // body: the content area of the slide on screen
      if (!body) return null;  // no slide body: nothing to measure
      const br = body.getBoundingClientRect();  // br: where the body box sits on screen
      const cr = document.querySelector('#canvas').getBoundingClientRect();  // cr: where the whole canvas sits on screen
      const sc = Guide.scale || 1;  // sc: the current zoom, used to turn screen pixels back into canvas pixels
      const res = { key: slides[cur].key, scale: +sc.toFixed(3), narrow: Guide.narrow, sh: body.scrollHeight, ch: body.clientHeight, sw: body.scrollWidth, cw: body.clientWidth, offenders: [], scrollers: [], badTerms: [], docOverflowX: document.documentElement.scrollWidth > innerWidth + 1 };  // res: the report: slide key, zoom, layout flag, body sizes, lists of problems, and whether the page scrolls sideways
      const clipped = (el) => {  // clipped(el): true if some box between el and the body already hides or scrolls its overflow (or opts out of the check)
        for (let p = el.parentElement; p && p !== body; p = p.parentElement) {  // walks up from the element's parent to the body
          const cs = getComputedStyle(p);  // its computed style (the final styles after every rule has been applied)
          if (/(auto|scroll|hidden|clip)/.test(cs.overflowY + ' ' + cs.overflowX) || p.classList.contains('no-fit-check')) return true;  // a box that scrolls or hides overflow, or is marked no-fit-check, means this element is contained on purpose
        }  // ends the walk up
        return false;  // nothing contains it
      };  // ends clipped
      for (const el of body.querySelectorAll('*')) {  // first pass over every element in the body
        const cs = getComputedStyle(el);  // its computed style
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;  // hidden elements cannot overflow visibly
        const r = el.getBoundingClientRect();  // its box on screen
        if (r.width === 0 && r.height === 0) continue;  // elements with no size are skipped
        const sticks = Guide.narrow ? ((r.right - cr.right) > 2 || (cr.left - r.left) > 2) : ((r.bottom - br.bottom) > 2 || (r.right - br.right) > 2 || (br.left - r.left) > 2 || (br.top - r.top) > 2);  // sticks: pokes out past the canvas sides (phone-width layout) or past any edge of the body by more than 2 pixels (desktop)
        if (res.offenders.length < 12 && sticks && !clipped(el)) {  // records up to 12 elements that stick out and are not contained by a scrolling or hiding box
          res.offenders.push(`${describe(el)} [bottom +${Math.round((r.bottom - br.bottom) / sc)}px, right +${Math.round((r.right - br.right) / sc)}px]`);  // with how far they stick out below and to the right, in canvas pixels
        }  // ends the stick-out check
        if (res.scrollers.length < 12 && /(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 2) res.scrollers.push(`${describe(el)} [content ${el.scrollHeight}px in ${el.clientHeight}px]`);  // also records up to 12 boxes that scroll vertically because their content is taller than they are
      }  // ends the first pass
      for (const t of body.querySelectorAll('.t')) { const k = t.dataset.t || t.textContent; if (!lookupTerm(k)) res.badTerms.push(k); }  // lists any dotted term that has no glossary entry
      // content cut off inside an overflow:hidden box, or spilling out of a squeezed box (overlapping neighbours)
      res.clipped = []; res.overlap = []; res.quizClip = [];  // three more problem lists: content cut off, content spilling over neighbours, and quiz questions too tall
      const SKIP = /(^|\s)(flip|flip-in|flip-face|meter|player-bar|bb-|seg|tabs-strip|reveal-body|no-fit-check)/;  // SKIP: classes of widgets that hide overflow on purpose (flip cards, meters, bars, switches, tab strips, reveals...)
      for (const el of body.querySelectorAll('*')) {  // second pass over every element in the body
        if (el instanceof SVGElement || el.closest('svg')) continue;  // drawings are skipped (SVG measures differently)
        const cls = el.getAttribute('class') || '';  // its class names
        if (SKIP.test(cls)) continue;  // intentional-overflow widgets are skipped
        const cs = getComputedStyle(el);  // its computed style
        if (cs.display === 'none' || cs.display === 'inline' || cs.display === 'contents' || cs.visibility === 'hidden' || cs.position === 'fixed') continue;  // skips hidden, inline, layout-only and fixed-position elements, where these measurements do not apply
        if (el.clientHeight === 0 && el.clientWidth === 0) continue;  // skips elements with no size
        if (el.closest('.no-fit-check')) continue;  // skips anything inside an area that opted out of the check
        const dy = el.scrollHeight - el.clientHeight, dx = el.scrollWidth - el.clientWidth;  // dy and dx: how much content extends past the box vertically and horizontally
        const oy = cs.overflowY, ox = cs.overflowX;  // the box's vertical and horizontal overflow settings
        if (el.classList.contains('quiz-q') && dy > 2) { res.quizClip.push(`${describe(el)} [${dy}px hidden]`); continue; }  // a quiz question taller than its panel is recorded separately (students would have to scroll to see options)
        if (/(auto|scroll)/.test(oy + ' ' + ox)) continue;  // boxes that scroll are fine: the content can be reached
        if (cs.textOverflow === 'ellipsis' || (cs.webkitLineClamp && cs.webkitLineClamp !== 'none')) continue;  // text deliberately cut with "..." or a line limit is fine too
        if (/(hidden|clip)/.test(oy) && dy > 3 && res.clipped.length < 8) res.clipped.push(`${describe(el)} [${dy}px cut off]`);  // a box that hides overflow while its content is more than 3 pixels taller: something is cut off
        else if (/(hidden|clip)/.test(ox) && dx > 3 && res.clipped.length < 8 && cs.whiteSpace !== 'nowrap') res.clipped.push(`${describe(el)} [${dx}px cut off sideways]`);  // the same sideways, unless the box is a single line that never wraps
        else if (oy === 'visible' && dy > 5 && res.overlap.length < 8) {  // a box that lets content show while it is over 5 pixels too tall: the content may be drawing over its neighbours
          // only count it when real content (not an absolutely positioned decoration) sticks out of the box
          const r = el.getBoundingClientRect(); let worst = 0;  // r: the box on screen; worst: how far the lowest child sticks out below it
          for (const k of el.children) { const kc = getComputedStyle(k); if (kc.position === 'absolute' || kc.position === 'fixed' || kc.display === 'none') continue; worst = Math.max(worst, k.getBoundingClientRect().bottom - r.bottom); }  // checks each ordinary child (skipping positioned decorations and hidden ones) and keeps the largest overhang
          if (worst > 4 * (Guide.scale || 1)) res.overlap.push(`${describe(el)} [content spills ${Math.round(worst / (Guide.scale || 1))}px below its box]`);  // more than 4 canvas pixels of overhang is reported as a spill
        }  // ends the spill check
      }  // ends the second pass
      return res;  // returns the full report to the test
    },  // ends metrics
  };  // closes Guide.debug
})();  // ends the wrapper function and runs it immediately, which sets up the whole runtime
