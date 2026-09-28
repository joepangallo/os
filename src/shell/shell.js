/* =====================================================================
   Operating Systems Interactive Guide — runtime shell
   ---------------------------------------------------------------------
   Sections register themselves with Guide.section({...}); chapters with
   Guide.chapter({...}). Guide.start() then builds one flat list of
   "slides" (home → chapter overview → every step of every section →
   chapter review → final challenge) and shows one slide at a time on a
   fixed 1200 x 640 canvas that is scaled to fit the window.
   ===================================================================== */
(function () {
  'use strict';

  const CANVAS_W = 1200, CANVAS_H = 640, BODY_W = 1152, BODY_H = 540;
  const STORE_KEY = 'os-guide-v1';
  const Guide = (window.Guide = { chapters: [], sections: {}, scale: 1, narrow: false, CANVAS_W, CANVAS_H, BODY_W, BODY_H });
  const renderErrors = [];
  const registerErrors = [];

  /* ------------------------------------------------------------ utilities */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const esc = (str) => String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const range = (n) => Array.from({ length: n }, (_, i) => i);
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, rnd = Math.random) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  const hashStr = (s) => { let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return x >>> 0; };
  const fmt = (v, d = 2) => (Math.round(v * 10 ** d) / 10 ** d).toLocaleString('en-US', { maximumFractionDigits: d });
  Guide.util = { clamp, esc, range, shuffle, seeded: mulberry32, hash: hashStr, fmt, sleep: (ms) => new Promise((r) => setTimeout(r, ms)) };

  /* ------------------------------------------------------------ null-safe DOM insertion
     Sections often write parent.replaceChildren(a, cond ? b : null). Natively that prints the word
     "null"; here null, undefined and false are simply skipped. */
  [typeof Element !== 'undefined' && Element.prototype, typeof DocumentFragment !== 'undefined' && DocumentFragment.prototype].forEach((proto) => {
    if (!proto) return;
    ['append', 'prepend', 'replaceChildren', 'before', 'after', 'replaceWith'].forEach((fn) => {
      const orig = proto[fn];
      if (typeof orig !== 'function' || orig.__nullSafe) return;
      const wrapped = function (...args) { return orig.apply(this, args.filter((a) => a != null && a !== false)); };
      wrapped.__nullSafe = true;
      proto[fn] = wrapped;
    });
  });

  /* ------------------------------------------------------------ DOM builders */
  const SVGNS = 'http://www.w3.org/2000/svg';
  function applyProps(el, props, isSvg) {
    if (!props) return;
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class' || k === 'className') el.setAttribute('class', v);
      else if (k === 'style' && typeof v === 'object') {
        for (const [sk, sv] of Object.entries(v)) { if (sk.startsWith('--')) el.style.setProperty(sk, sv); else el.style[sk] = sv; }
      } else if (k === 'html') el.innerHTML = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (!isSvg && (k === 'value' || k === 'checked' || k === 'disabled' || k === 'selected')) el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  function appendKids(el, kids) {
    for (const k of kids.flat(Infinity)) {
      if (k == null || k === false) continue;
      el.append(k instanceof Node ? k : document.createTextNode(String(k)));
    }
  }
  function h(tag, props, ...kids) {
    if (props instanceof Node || typeof props === 'string' || Array.isArray(props)) { kids.unshift(props); props = null; }
    const el = document.createElement(tag); applyProps(el, props, false); appendKids(el, kids); return el;
  }
  function s(tag, props, ...kids) {
    if (props instanceof Node || typeof props === 'string' || Array.isArray(props)) { kids.unshift(props); props = null; }
    const el = document.createElementNS(SVGNS, tag); applyProps(el, props, true); appendKids(el, kids); return el;
  }
  function frag(html) { const t = document.createElement('template'); t.innerHTML = String(html).trim(); return t.content; }
  Guide.h = h; Guide.s = s; Guide.frag = frag;

  /* ------------------------------------------------------------ icons */
  const I = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${extra}>${d}</svg>`;
  const ICON = {
    menu: I('<path d="M4 6h16M4 12h16M4 18h16"/>'),
    home: I('<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'),
    book: I('<path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4zM20 4h-6a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h7z"/>'),
    notes: I('<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h7"/>'),
    moon: I('<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>'),
    sun: I('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
    full: I('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
    help: I('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h.01"/>'),
    left: I('<path d="M15 18l-6-6 6-6"/>'),
    right: I('<path d="M9 18l6-6-6-6"/>'),
    close: I('<path d="M6 6l12 12M18 6L6 18"/>'),
    play: I('<path d="M7 5l12 7-12 7z" fill="currentColor"/>'),
    pause: I('<path d="M7 5h3v14H7zM14 5h3v14h-3z" fill="currentColor"/>'),
    reset: I('<path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v5h5"/>'),
    first: I('<path d="M6 5v14M18 18l-7-6 7-6"/>'),
    next: I('<path d="M6 5l9 7-9 7M18 5v14"/>'),
    prev: I('<path d="M18 5l-9 7 9 7M6 5v14"/>'),
  };
  Guide.ICON = ICON;
  const iconBtn = (name, label, onclick, cls = 'tb-btn') => h('button', { class: cls, title: label, 'aria-label': label, onclick, html: ICON[name] });

  /* ------------------------------------------------------------ persistence */
  const store = (() => {
    const data = { visited: {}, quiz: {}, last: null, theme: null, known: {} };
    try { const raw = localStorage.getItem(STORE_KEY); if (raw) Object.assign(data, JSON.parse(raw)); } catch (e) { /* storage blocked */ }
    let t = null;
    const save = () => { clearTimeout(t); t = setTimeout(() => { try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch (e) { /* ignore */ } }, 120); };
    return { data, save };
  })();
  Guide.store = store;

  /* ------------------------------------------------------------ registration + validation */
  const QTYPES = ['mc', 'tf', 'multi', 'order', 'match', 'bucket', 'num'];
  function validateQuestion(q, where) {
    const errs = [];
    const type = q.type || (q.pairs ? 'match' : q.items && q.buckets ? 'bucket' : q.items ? 'order' : typeof q.answer === 'boolean' ? 'tf' : Array.isArray(q.answer) ? 'multi' : typeof q.answer === 'number' && !q.choices ? 'num' : 'mc');
    if (!QTYPES.includes(type)) errs.push(`${where}: unknown question type "${type}"`);
    if (!q.q) errs.push(`${where}: missing q (question text)`);
    if (!q.why) errs.push(`${where}: missing why (explanation)`);
    if (type === 'mc') {
      if (!Array.isArray(q.choices) || q.choices.length < 2) errs.push(`${where}: mc needs >=2 choices`);
      else if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.choices.length) errs.push(`${where}: mc answer index out of range`);
      if (q.feedback && (!Array.isArray(q.feedback) || q.feedback.length !== q.choices.length)) errs.push(`${where}: feedback must have one entry per choice`);
    }
    if (type === 'tf' && typeof q.answer !== 'boolean') errs.push(`${where}: tf answer must be true/false`);
    if (type === 'multi') {
      if (!Array.isArray(q.choices) || q.choices.length < 3) errs.push(`${where}: multi needs >=3 choices`);
      else if (!Array.isArray(q.answer) || !q.answer.length || q.answer.some((a) => !Number.isInteger(a) || a < 0 || a >= q.choices.length)) errs.push(`${where}: multi answer must be a non-empty index array`);
    }
    if (type === 'order' && (!Array.isArray(q.items) || q.items.length < 3)) errs.push(`${where}: order needs >=3 items (in the correct order)`);
    if (type === 'match') {
      if (!Array.isArray(q.pairs) || q.pairs.length < 2) errs.push(`${where}: match needs >=2 pairs`);
      else if (new Set(q.pairs.map((p) => p[1])).size !== q.pairs.length) errs.push(`${where}: match right-hand values must be unique (use type "bucket" for categories)`);
    }
    if (type === 'bucket') {
      if (!Array.isArray(q.buckets) || q.buckets.length < 2) errs.push(`${where}: bucket needs >=2 buckets`);
      if (!Array.isArray(q.items) || !q.items.length || q.items.some((it) => !Array.isArray(it) || !Number.isInteger(it[1]) || it[1] < 0 || it[1] >= (q.buckets || []).length)) errs.push(`${where}: bucket items must be [text, bucketIndex]`);
    }
    if (type === 'num' && typeof q.answer !== 'number') errs.push(`${where}: num answer must be a number`);
    return { type, errs };
  }
  function validateSection(sec) {
    const errs = [];
    if (!sec || typeof sec !== 'object') return ['section is not an object'];
    if (!/^\d+\.\d+$/.test(sec.id || '')) errs.push(`bad id "${sec.id}" (expected like "1.3")`);
    if (!sec.title) errs.push(`${sec.id}: missing title`);
    if (!Array.isArray(sec.steps) || !sec.steps.length) errs.push(`${sec.id}: steps must be a non-empty array`);
    (sec.steps || []).forEach((st, i) => {
      if (!st.title) errs.push(`${sec.id} step ${i + 1}: missing title`);
      if (!st.html && !st.render && !st.quiz) errs.push(`${sec.id} step ${i + 1}: needs html, render or quiz`);
      if (st.quiz) st.quiz.forEach((q, j) => errs.push(...validateQuestion(q, `${sec.id} step ${i + 1} q${j + 1}`).errs));
    });
    return errs;
  }
  Guide.validateQuestion = validateQuestion;
  Guide.validateSection = validateSection;

  function injectCSS(css, id) {
    if (!css) return;
    const st = document.createElement('style'); st.id = id; st.textContent = css; document.head.appendChild(st);
  }
  Guide.chapter = function (c) {
    if (!c || !Number.isInteger(c.num)) { registerErrors.push('chapter without num'); return; }
    const existing = Guide.chapters.find((x) => x.num === c.num);
    if (existing) Object.assign(existing, c); else Guide.chapters.push(c);
    if (c.css) injectCSS(c.css, 'css-ch' + c.num);
  };
  Guide.section = function (sec) {
    const errs = validateSection(sec);
    if (errs.length) { errs.forEach((e) => console.error('[section] ' + e)); registerErrors.push(...errs); }
    if (!sec || !sec.id || !Array.isArray(sec.steps)) return;
    sec.chapter = sec.chapter || parseInt(sec.id, 10);
    sec.minor = parseInt(sec.id.split('.')[1], 10);
    if (sec.css) injectCSS(sec.css, 'css-' + sec.id.replace('.', '-'));
    Guide.sections[sec.id] = sec;
  };

  /* ------------------------------------------------------------ glossary */
  const gloss = []; // {term, def, src}
  const glossIndex = new Map();
  const normTerm = (t) => String(t).replace(/<[^>]+>/g, '').toLowerCase().replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();
  function variants(t) {
    const n = normTerm(t); const out = new Set([n]);
    const m = n.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
    if (m) { out.add(m[1].trim()); out.add(m[2].trim()); }
    for (const v of Array.from(out)) {
      if (v.endsWith('ies')) out.add(v.slice(0, -3) + 'y');
      if (v.endsWith('es')) out.add(v.slice(0, -2));
      if (v.endsWith('s')) out.add(v.slice(0, -1));
      out.add(v.replace(/-/g, ' '));
    }
    return out;
  }
  const baseName = (t) => normTerm(t).replace(/\s*\([^)]*\)\s*/g, ' ').trim();
  function addTerm(term, def, src) {
    if (!term || !def) return;
    const n = normTerm(term), bn = baseName(term);
    if (gloss.some((g) => normTerm(g.term) === n || baseName(g.term) === bn)) { for (const v of variants(term)) if (!glossIndex.has(v)) glossIndex.set(v, gloss.find((g) => baseName(g.term) === bn || normTerm(g.term) === n)); return; }
    const entry = { term: String(term), def: String(def), src };
    gloss.push(entry);
    for (const v of variants(term)) if (!glossIndex.has(v)) glossIndex.set(v, entry);
  }
  const localIndex = {}; // section id -> Map(variant -> entry): a section's own wording wins inside that section
  function indexLocal(src, term, def) {
    const m = localIndex[src] || (localIndex[src] = new Map());
    const entry = { term: String(term), def: String(def), src };
    for (const v of variants(term)) if (!m.has(v)) m.set(v, entry);
  }
  function lookupTerm(text, secId) {
    const loc = secId && localIndex[secId];
    if (loc) for (const v of variants(text)) if (loc.has(v)) return loc.get(v);
    for (const v of variants(text)) if (glossIndex.has(v)) return glossIndex.get(v);
    return null;
  }
  Guide.lookupTerm = lookupTerm;
  Guide.glossary = gloss;
  const extraTerms = [];
  Guide.extraTerms = (list) => { (list || []).forEach((x) => extraTerms.push(x)); };
  function buildGlossary() {
    const eachTerm = (arr, src) => (arr || []).forEach((t) => {
      const [a, b] = Array.isArray(t) ? t : [t && t.term, t && t.def];
      if (!a || !b) return;
      addTerm(a, b, src);
      indexLocal(src, a, b);
    });
    // section definitions win; chapter-level terms only fill gaps
    sortedChapters().forEach((c) => sectionsOf(c.num).forEach((sec) => eachTerm(sec.terms, sec.id)));
    Object.values(Guide.sections).forEach((sec) => eachTerm(sec.terms, sec.id));
    extraTerms.forEach((x) => addTerm(x[0], x[1], x[2]));   // other sections' terms (partial dev builds only)
    sortedChapters().forEach((c) => eachTerm(c.terms, 'ch' + c.num));
    gloss.sort((a, b) => normTerm(a.term).localeCompare(normTerm(b.term)));
  }

  /* ------------------------------------------------------------ slides */
  let slides = [];
  let cur = -1;
  let curCtx = null;
  const sortedChapters = () => Guide.chapters.slice().sort((a, b) => a.num - b.num);
  const sectionsOf = (n) => Object.values(Guide.sections).filter((x) => x.chapter === n).sort((a, b) => a.minor - b.minor);
  const chapterOf = (n) => Guide.chapters.find((c) => c.num === n) || { num: n, title: 'Chapter ' + n };
  const KIND = { story: 'Big Picture', learn: 'Learn', explore: 'Explore', lab: 'Hands-on Lab', predict: 'Predict', compare: 'Compare', recap: 'Recap', check: 'Check Yourself', intro: 'Chapter Overview', terms: 'Key Terms', review: 'Chapter Challenge', final: 'Final Challenge' };

  function buildSlides() {
    slides = [{ key: 'home', type: 'home', title: 'Welcome' }];
    for (const ch of sortedChapters()) {
      const secs = sectionsOf(ch.num);
      slides.push({ key: 'ch' + ch.num, type: 'chapter', ch, title: 'Chapter ' + ch.num + ' overview' });
      (ch.steps || []).forEach((st, i) => slides.push({ key: 'ch' + ch.num + '/' + (i + 1), type: 'step', ch, sec: chapterPseudoSection(ch), step: st, i }));
      for (const sec of secs) sec.steps.forEach((st, i) => slides.push({ key: sec.id + '/' + (i + 1), type: 'step', ch, sec, step: st, i }));
      if (secs.length) {
        slides.push({ key: 'ch' + ch.num + '-terms', type: 'terms', ch, title: 'Chapter ' + ch.num + ' key terms' });
        slides.push({ key: 'ch' + ch.num + '-quiz', type: 'chquiz', ch, title: 'Chapter ' + ch.num + ' challenge' });
      }
    }
    if (Object.keys(Guide.sections).length) slides.push({ key: 'final', type: 'final', title: 'Final challenge' });
  }
  const pseudo = {};
  function chapterPseudoSection(ch) {
    if (!pseudo[ch.num]) pseudo[ch.num] = { id: 'ch' + ch.num, chapter: ch.num, title: 'Chapter ' + ch.num + ': ' + ch.title, steps: ch.steps || [], notes: ch.notes, pseudo: true };
    return pseudo[ch.num];
  }
  const slideIndex = (key) => slides.findIndex((x) => x.key === key);

  /* ------------------------------------------------------------ app frame */
  const els = {};
  function buildFrame() {
    const app = h('div', { id: 'app' });
    els.app = app;
    // top bar
    els.crumb = h('div', { class: 'tb-crumb' });
    els.chaps = h('div', { class: 'tb-chaps' });
    els.theme = iconBtn('moon', 'Toggle dark mode (D)', toggleTheme);
    els.notesBtn = h('button', { class: 'tb-btn', title: 'Section notes (N)', 'aria-label': 'Section notes', onclick: () => openDrawer('notes'), html: ICON.notes + '<span class="tb-hide-narrow">Notes</span>' });
    const top = h('header', { id: 'topbar' },
      iconBtn('menu', 'Contents (T)', () => openDrawer('toc')),
      h('button', { class: 'tb-brand', onclick: () => go(0), title: 'Home', 'aria-label': 'Home' }, h('span', { class: 'tb-hide-narrow' }, 'Operating Systems'), h('span', { class: 'tb-show-narrow' }, 'OS')),
      h('div', { class: 'tb-sep tb-hide-narrow' }),
      els.crumb,
      els.chaps,
      h('div', { class: 'tb-sep tb-hide-narrow' }),
      h('button', { class: 'tb-btn', title: 'Glossary (G)', onclick: () => openDrawer('gloss'), html: ICON.book + '<span class="tb-hide-narrow">Glossary</span>' }),
      els.notesBtn,
      els.theme,
      iconBtn('full', 'Full screen (F)', toggleFull, 'tb-btn tb-hide-narrow'),
      iconBtn('help', 'Help and shortcuts (?)', () => openModal()),
    );
    // stage
    els.canvas = h('div', { id: 'canvas' });
    els.wrap = h('div', { id: 'canvasWrap' }, els.canvas);
    els.stage = h('main', { id: 'stage' }, els.wrap);
    // bottom bar
    els.prev = h('button', { class: 'bb-nav', onclick: () => step(-1), title: 'Previous (Left arrow)' });
    els.next = h('button', { class: 'bb-nav primary', onclick: () => step(1), title: 'Next (Right arrow)' });
    els.dots = h('div', { class: 'bb-dots' });
    els.count = h('div', { class: 'bb-count' });
    els.prog = h('div', { class: 'bb-prog' });
    const bot = h('footer', { id: 'botbar' }, els.prog, els.prev, h('div', { class: 'bb-mid' }, els.dots, els.count), els.next);
    app.append(top, els.stage, bot);

    // drawers
    els.scrim = h('div', { class: 'scrim', onclick: closeAll });
    els.tocSearch = h('input', { class: 'dr-search', placeholder: 'Filter sections…', 'aria-label': 'Filter sections', oninput: renderToc });
    els.tocBody = h('div', { class: 'dr-body' });
    els.toc = h('aside', { class: 'drawer left', 'aria-label': 'Contents' },
      h('div', { class: 'dr-head' }, h('h3', 'Contents'), iconBtn('close', 'Close', closeAll)),
      h('div', { style: { padding: '10px 12px 0' } }, els.tocSearch), els.tocBody);
    els.glSearch = h('input', { class: 'dr-search', placeholder: 'Search terms and definitions…', 'aria-label': 'Search glossary', oninput: renderGloss });
    els.glBody = h('div', { class: 'dr-body' });
    els.gloss = h('aside', { class: 'drawer right', 'aria-label': 'Glossary' },
      h('div', { class: 'dr-head' }, h('h3', 'Glossary'), iconBtn('close', 'Close', closeAll)),
      h('div', { style: { padding: '10px 12px 0' } }, els.glSearch), els.glBody);
    els.notesBody = h('div', { class: 'dr-body notes-doc' });
    els.notesTitle = h('h3', 'Section notes');
    els.notes = h('aside', { class: 'drawer right', 'aria-label': 'Section notes' },
      h('div', { class: 'dr-head' }, els.notesTitle, iconBtn('close', 'Close', closeAll)), els.notesBody);
    els.modal = h('div', { class: 'modal', onclick: (e) => { if (e.target === els.modal) closeAll(); } });
    els.pop = h('div', { class: 'term-pop', role: 'tooltip' });
    els.toast = h('div', { class: 'toast', role: 'status' });
    const markers = frag(`<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${
      ['', 'cpu', 'mem', 'io', 'os', 'proc', 'thread', 'intr', 'ok', 'bad', 'warn', 'accent', 'muted'].map((c) => {
        const col = c === '' ? 'var(--ink-2)' : c === 'muted' ? 'var(--line-2)' : `var(--${c})`;
        return `<marker id="arr${c ? '-' + c : ''}" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" style="fill:${col}"/></marker>`;
      }).join('')}</defs></svg>`);
    document.body.append(markers, app, els.scrim, els.toc, els.gloss, els.notes, els.modal, els.pop, els.toast);
  }

  /* ------------------------------------------------------------ chrome */
  function setChapterColor(n) {
    document.documentElement.style.setProperty('--chc', n ? `var(--ch${n})` : 'var(--accent)');
  }
  function slideChapter(sl) { return sl && sl.ch ? sl.ch.num : 0; }
  function slideLabel(sl) {
    if (!sl) return '';
    if (sl.type === 'step') return sl.sec.pseudo ? sl.sec.title : sl.sec.id + ' ' + sl.sec.title;
    return sl.title;
  }
  function updateChrome() {
    const sl = slides[cur];
    const n = slideChapter(sl);
    setChapterColor(n);
    // crumb
    if (sl.type === 'home') els.crumb.innerHTML = '<b>Chapters 1–5</b> · interactive guide';
    else if (sl.type === 'step') els.crumb.innerHTML = `Chapter ${n} › <b>${esc(slideLabel(sl))}</b> › ${esc(sl.step.title)}`;
    else els.crumb.innerHTML = (n ? `Chapter ${n} › ` : '') + `<b>${esc(sl.title)}</b>`;
    // chapter buttons
    els.chaps.innerHTML = '';
    for (const c of sortedChapters()) {
      els.chaps.append(h('button', { class: 'tb-chap' + (c.num === n ? ' on' : ''), style: { '--c': `var(--ch${c.num})` }, title: `Chapter ${c.num}: ${c.title}`, onclick: () => go(slideIndex('ch' + c.num)) }, String(c.num)));
    }
    // dots
    els.dots.innerHTML = '';
    if (sl.type === 'step') {
      const steps = sl.sec.steps;
      steps.forEach((st, i) => {
        const key = sl.sec.id + '/' + (i + 1);
        const skip = coreRoute() && !isCore(slides[slideIndex(key)]);
        els.dots.append(h('button', { class: 'bb-dot' + (i === sl.i ? ' on' : '') + (store.data.visited[key] ? ' seen' : '') + (skip ? ' skip' : ''), title: `${i + 1}. ${st.title}${skip ? ' (not on the core path)' : ''}`, 'aria-label': `Step ${i + 1}: ${st.title}`, onclick: () => go(slideIndex(key)) }));
      });
      els.count.textContent = `${sl.sec.pseudo ? 'Ch ' + n : sl.sec.id} · step ${sl.i + 1} of ${steps.length}${coreRoute() ? ' · core path' : ''}`;
    } else els.count.textContent = `${cur + 1} / ${slides.length}`;
    // prev / next
    const p = cur > 0 ? slides[neighbor(-1)] : null, nx = cur < slides.length - 1 ? slides[neighbor(1)] : null;
    const label = (t, other) => {
      if (!other) return '';
      if (other.type === 'step' && sl.type === 'step' && other.sec === sl.sec) return t;
      return `${t}: ${slideLabel(other)}`;
    };
    els.prev.innerHTML = ICON.left + `<span>${esc(label('Back', p) || 'Back')}</span>`;
    els.next.innerHTML = `<span>${esc(label('Next', nx) || 'Next')}</span>` + ICON.right;
    els.prev.disabled = !p; els.next.disabled = !nx;
    els.prog.style.width = ((cur + 1) / slides.length) * 100 + '%';
    els.notesBtn.style.display = sl.type === 'step' && sl.sec.notes ? '' : 'none';
    if (els.toc.classList.contains('on')) renderToc();
  }

  /* ------------------------------------------------------------ navigation */
  function go(idx, opt = {}) {
    if (!slides.length) return;
    idx = clamp(idx | 0, 0, slides.length - 1);
    if (curCtx) { curCtx._destroy(); curCtx = null; }
    hideTerm();
    if (els.toast) { clearTimeout(toast.t); els.toast.classList.remove('on'); }
    cur = idx;
    const sl = slides[cur];
    try { history.replaceState(null, '', '#' + sl.key); } catch (e) { /* file:// sandbox */ }
    // remember the last LEARNING page (never home/overview), overall and per chapter, so Continue can resume it
    if (LEARN[sl.type]) {
      store.data.last = sl.key;
      if (sl.ch) { store.data.chLast = store.data.chLast || {}; store.data.chLast[sl.ch.num] = sl.key; }
    }
    store.data.visited[sl.key] = 1;
    store.save();
    renderSlide(sl);
    updateChrome();
    if (!opt.keepFocus) els.stage.scrollTop = 0;
  }
  const LEARN = { step: 1, terms: 1, chquiz: 1, final: 1 };
  // the core route keeps each section's Big Picture, steps flagged core:true, the recap and the quiz
  function isCore(sl) {
    if (!sl || sl.type !== 'step' || sl.sec.pseudo) return true;
    const st = sl.step;
    return !!st.core || st.kind === 'story' || st.kind === 'recap' || st.kind === 'check' || !!st.quiz || sl.i === 0;
  }
  Guide.isCore = isCore;
  const coreRoute = () => store.data.route === 'core';
  function neighbor(d) {
    let i = cur + d;
    if (coreRoute()) while (i > 0 && i < slides.length - 1 && !isCore(slides[i])) i += d;
    return i;
  }
  function step(d) { go(neighbor(d)); }
  function setRoute(r) { store.data.route = r; store.save(); updateChrome(); }
  function sectionJump(d) {
    const sl = slides[cur];
    let i = cur + d;
    const id = (x) => (x.type === 'step' ? x.sec.id : x.key);
    while (i >= 0 && i < slides.length && id(slides[i]) === id(sl)) i += d;
    if (d < 0) { const target = slides[i]; if (!target) return; while (i > 0 && id(slides[i - 1]) === id(target)) i--; }
    go(i);
  }
  Guide.go = (key) => { const i = typeof key === 'number' ? key : slideIndex(key); if (i >= 0) go(i); };
  Guide.next = () => step(1);
  Guide.prev = () => step(-1);

  /* ------------------------------------------------------------ fitting */
  function fit() {
    const sw = els.stage.clientWidth, sh = els.stage.clientHeight;
    const pad = 14;
    let sc = Math.min((sw - pad * 2) / CANVAS_W, (sh - pad * 2) / CANVAS_H);
    const narrow = sc < 0.7;
    const changed = narrow !== Guide.narrow;
    Guide.narrow = narrow;
    document.body.classList.toggle('narrow', narrow);
    if (narrow) {
      els.canvas.style.transform = ''; els.wrap.style.width = ''; els.wrap.style.height = ''; Guide.scale = 1;
    } else {
      sc = Math.min(sc, 1.8);
      Guide.scale = sc;
      els.canvas.style.transform = `scale(${sc})`;
      els.wrap.style.width = CANVAS_W * sc + 'px';
      els.wrap.style.height = CANVAS_H * sc + 'px';
    }
    return changed;
  }
  let fitT = null;
  function onResize() {
    clearTimeout(fitT);
    fitT = setTimeout(() => {
      if (fit() && cur >= 0) {
        const sl = slides[cur];
        const layoutAware = sl.type === 'home' || sl.type === 'chapter' || (sl.type === 'step' && /narrow/.test(String(sl.step.render || '') + String(sl.step.html || '')));
        if (layoutAware) go(cur, { keepFocus: true }); // quizzes restore from saved state; other slides just reflow with CSS
      } else checkOverflow();
    }, 60);
  }
  function checkOverflow() {
    const body = els.canvas.querySelector('.step-body');
    if (!body || Guide.narrow) return;
    body.classList.remove('overflowing');
    const over = body.scrollHeight - body.clientHeight;
    const overW = body.scrollWidth - body.clientWidth;
    if (over > 2 || overW > 2) {
      body.classList.add('overflowing');
      console.warn(`[fit] ${slides[cur] && slides[cur].key} overflows the step body by ${over}px vertically, ${overW}px horizontally`);
    }
  }

  /* ------------------------------------------------------------ step context */
  function makeCtx(body, sl) {
    const cleanups = [];
    const ctx = {
      el: body, slide: sl, sec: sl.sec, step: sl.step, narrow: Guide.narrow, alive: true,
      h, s, frag, esc, util: Guide.util, ICON,
      $: (sel) => body.querySelector(sel),
      $$: (sel) => Array.from(body.querySelectorAll(sel)),
      cleanup(fn) { cleanups.push(fn); },
      every(ms, fn) { const id = setInterval(() => { if (ctx.alive) fn(); }, ms); cleanups.push(() => clearInterval(id)); return id; },
      after(ms, fn) { const id = setTimeout(() => { if (ctx.alive) fn(); }, ms); cleanups.push(() => clearTimeout(id)); return id; },
      sleep(ms) { return new Promise((res) => ctx.after(ms, res)); },
      on(target, ev, fn, o) { target.addEventListener(ev, fn, o); cleanups.push(() => target.removeEventListener(ev, fn, o)); },
      raf(fn) {
        let id; let live = true;
        const loop = (t) => { if (!live || !ctx.alive) return; if (fn(t) === false) return; id = requestAnimationFrame(loop); };
        id = requestAnimationFrame(loop);
        const stop = () => { live = false; cancelAnimationFrame(id); };
        cleanups.push(stop); return stop;
      },
      toast,
      refit: checkOverflow,
      _destroy() { ctx.alive = false; cleanups.splice(0).reverse().forEach((f) => { try { f(); } catch (e) { console.error(e); } }); },
    };
    ctx.ui = {};
    for (const [k, fn] of Object.entries(UI)) ctx.ui[k] = (...a) => fn(ctx, ...a);
    return ctx;
  }

  /* ------------------------------------------------------------ rendering */
  function renderSlide(sl) {
    const c = els.canvas;
    c.className = '';
    c.removeAttribute('data-sec');
    c.innerHTML = '';
    const body = h('div', { class: 'step-body' });
    const eyebrow = h('div', { class: 'step-eyebrow' });
    const title = h('h2', { class: 'step-title' });
    c.append(h('header', { class: 'step-head' }, eyebrow, title), body);
    const ctx = makeCtx(body, sl);
    curCtx = ctx;
    try {
      if (sl.type === 'home') { eyebrow.innerHTML = '<span class="kind">Welcome</span>'; title.textContent = 'Operating Systems · Chapters 1\u2060–\u20605'; renderHome(body, ctx); }
      else if (sl.type === 'chapter') { eyebrow.innerHTML = `<span class="sid">Chapter ${sl.ch.num}</span><span class="kind">${KIND.intro}</span>`; title.textContent = `Chapter ${sl.ch.num}: ${sl.ch.title}`; renderChapter(body, ctx, sl.ch); }
      else if (sl.type === 'terms') { eyebrow.innerHTML = `<span class="sid">Chapter ${sl.ch.num}</span><span class="kind">${KIND.terms}</span>`; title.textContent = 'Key terms: flip, recall, repeat'; renderTerms(body, ctx, sl.ch); }
      else if (sl.type === 'chquiz') { eyebrow.innerHTML = `<span class="sid">Chapter ${sl.ch.num}</span><span class="kind">${KIND.review}</span>`; title.textContent = `Chapter ${sl.ch.num} challenge: mixed questions from every section`; renderChQuiz(body, ctx, sl.ch); }
      else if (sl.type === 'final') { eyebrow.innerHTML = `<span class="kind">${KIND.final}</span>`; title.textContent = 'Final challenge: all five chapters'; renderFinal(body, ctx); }
      else if (sl.type === 'step') {
        const sec = sl.sec, st = sl.step;
        c.className = 'sec-' + String(sec.id).replace('.', '-');
        c.dataset.sec = sec.id;
        eyebrow.innerHTML = `<span class="sid">${esc(sec.pseudo ? 'Chapter ' + sec.chapter : sec.id)}</span><span>${esc(sec.pseudo ? 'Overview' : sec.title)}</span><span>·</span><span class="kind">${esc(KIND[st.kind] || st.kind || 'Learn')}</span>`;
        title.textContent = st.title;
        if (st.html) body.append(frag(typeof st.html === 'function' ? st.html(ctx) : st.html));
        if (st.quiz) body.append(quiz(ctx, st.quiz, { key: sl.key, source: null }));
        if (st.render) { const r = st.render(body, ctx); if (typeof r === 'function') ctx.cleanup(r); }
      }
    } catch (e) {
      console.error(e);
      renderErrors.push({ key: sl.key, msg: String(e && e.stack || e) });
      body.append(h('div', { class: 'err-card' }, `This step hit an error while rendering:\n${e && e.message}`));
    }
    fit();
    checkOverflow();
    ctx.after(350, checkOverflow);
  }

  /* ------------------------------------------------------------ home */
  function progressOfChapter(n) {
    const keys = slides.filter((x) => x.ch && x.ch.num === n && x.type === 'step').map((x) => x.key);
    if (!keys.length) return 0;
    return keys.filter((k) => store.data.visited[k]).length / keys.length;
  }
  // quiz mastery: best first-try score saved for each section's check step
  function secMastery(sec) {
    let best = 0, total = 0, seen = false;
    sec.steps.forEach((st, i) => { if (!st.quiz) return; const rec = store.data.quiz[sec.id + '/' + (i + 1)]; total += st.quiz.length; if (rec) { seen = true; best += rec.best || 0; } });
    return seen && total ? { best, total, pct: best / total } : null;
  }
  function masteryChip(m) {
    if (!m) return null;
    const cls = m.pct >= 0.8 ? 'ok' : m.pct >= 0.5 ? 'warn' : 'bad';
    return h('span', { class: 'chip ' + cls, title: `Best quiz score: ${m.best} of ${m.total} right on the first try` }, `quiz ${m.best}/${m.total}`);
  }
  function chapterMastery(n) {
    const ms = sectionsOf(n).map(secMastery).filter(Boolean);
    if (!ms.length) return null;
    const best = ms.reduce((a, m) => a + m.best, 0), total = ms.reduce((a, m) => a + m.total, 0);
    return { tried: ms.length, of: sectionsOf(n).length, pct: best / total };
  }
  Guide.mastery = { secMastery, chapterMastery };
  function openPrint() {
    const u = location.href.split('#')[0].split('?')[0] + '?print';
    const w = window.open(u, '_blank');
    if (!w) location.href = u;
  }
  Guide.openPrint = openPrint;
  function routeSeg() {
    const coreCount = slides.filter((x) => x.type === 'step' && isCore(x)).length;
    const fullCount = slides.filter((x) => x.type === 'step').length;
    return h('div', { class: 'row gap-s', style: { alignItems: 'center' } },
      h('span', { class: 'small b' }, 'Route:'),
      UI.seg(null, [{ value: 'full', label: `Full course (${fullCount})`, title: `Every step: ${fullCount} screens` }, { value: 'core', label: `Core path (${coreCount})`, title: `Big picture, key hands-on steps, recap and quiz of every section: ${coreCount} screens` }], store.data.route === 'core' ? 'core' : 'full', (v) => setRoute(v)));
  }
  function renderHome(body, ctx) {
    const secCount = Object.keys(Guide.sections).length;
    const stepKeys = slides.filter((x) => x.type === 'step').map((x) => x.key);
    const overall = stepKeys.length ? stepKeys.filter((k) => store.data.visited[k]).length / stepKeys.length : 0;
    const lastIdx = store.data.last && store.data.last !== 'home' ? slideIndex(store.data.last) : -1;
    const firstStep = slides.findIndex((x) => x.type === 'chapter');
    const resume = lastIdx > 0 ? lastIdx : firstStep;
    const resumeSl = slides[resume];
    const wrap = h('div', { class: 'stack fill', style: { gap: '14px' } });
    wrap.append(h('div', { class: 'row nw home-top', style: { justifyContent: 'space-between', alignItems: 'flex-end', gap: '24px' } },
      h('div', { class: 'home-hero' },
        h('div', { class: 'row gap-s' }, h('span', { class: 'chip accent' }, `5 chapters · ${secCount} sections`), h('span', { class: 'chip' }, 'explain → explore → check')),
        h('h1', { style: { marginTop: '6px' } }, 'See how an operating system really works.'),
        h('p', {}, 'An interactive companion to Chapters 1–5 of ', h('i', {}, 'Operating Systems: Internals and Design Principles'), '. Every section explains one idea in plain language, lets you run it yourself, then checks your understanding.')),
      h('div', { class: 'stack home-go', style: { alignItems: 'flex-end', gap: '8px', flex: 'none' } },
        resumeSl ? h('button', { class: 'btn primary lg', onclick: () => go(resume) }, lastIdx > 0 ? `Continue: ${slideLabel(resumeSl)}` : 'Start with Chapter 1', h('span', { html: ICON.right, style: { width: '18px', display: 'inline-flex' } })) : null,
        h('div', { class: 'small muted' }, `Your progress: ${Math.round(overall * 100)}% of steps visited`))));
    const cards = h('div', { class: 'chcards' });
    for (const c of sortedChapters()) {
      const secs = sectionsOf(c.num);
      const pct = progressOfChapter(c.num);
      cards.append(h('button', { class: 'chcard', style: { '--c': `var(--ch${c.num})` }, onclick: () => go(slideIndex('ch' + c.num)) },
        h('div', { class: 'n' }, 'Chapter ' + c.num),
        h('div', { class: 'tt' }, c.title),
        h('ul', {}, secs.map((x) => h('li', { style: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, `${x.id} ${x.short || x.title}`))),
        h('div', { style: { marginTop: 'auto' } }, h('div', { class: 'meter' }, h('i', { style: { width: pct * 100 + '%' } })),
          h('div', { class: 'xs muted', style: { marginTop: '3px' } }, `${Math.round(pct * 100)}% visited`, (() => { const m = chapterMastery(c.num); return m ? ` · quizzes ${m.tried}/${m.of}, ${Math.round(m.pct * 100)}% right` : ''; })()))));
    }
    cards.style.flex = '1'; cards.style.minHeight = '0';
    wrap.append(cards);
    const fitHome = () => {
      if (Guide.narrow || !wrap.isConnected) return;
      const over = () => Array.from(cards.children).some((c) => c.scrollHeight > c.clientHeight + 1) || body.scrollHeight > body.clientHeight + 1;
      wrap.classList.remove('hc1', 'hc2', 'hc3', 'hc4');
      for (const lvl of ['hc1', 'hc2', 'hc3', 'hc4']) { if (!over()) break; wrap.classList.add(lvl); }
    };
    ctx.after(0, fitHome);
    ctx.after(250, fitHome); // re-measure once fonts and late layout have settled
    wrap.append(h('div', { class: 'split', style: { height: 'auto', gridTemplateColumns: '1fr 1.25fr', gap: '14px' } },
      h('div', { class: 'card tight' }, h('h4', {}, 'Colour language used in every diagram'), legend()),
      h('div', { class: 'card tight' }, h('h4', {}, 'Getting around'),
        h('div', { class: 'small', html: '<kbd>←</kbd> <kbd>→</kbd> step · <kbd>T</kbd> contents · <kbd>G</kbd> glossary · <kbd>?</kbd> all shortcuts. Dotted words like <span class="t" data-t="operating system">operating system</span> show a definition.' }),
        h('div', { class: 'row gap-s', style: { marginTop: '6px' } }, routeSeg(), h('button', { class: 'btn sm', type: 'button', onclick: openPrint }, 'Printable guide')))));
    body.append(wrap);
  }
  function legend() {
    const items = [['cpu', 'CPU / registers'], ['mem', 'Memory'], ['io', 'I/O devices'], ['os', 'OS / kernel'], ['proc', 'Process'], ['thread', 'Thread'], ['intr', 'Interrupt / signal']];
    return h('div', { class: 'legend' }, items.map(([c, t]) => h('span', { class: 'chip ' + c }, h('span', { style: { width: '10px', height: '10px', borderRadius: '3px', background: `var(--${c})`, display: 'inline-block' } }), t)));
  }
  Guide.legend = legend;

  /* ------------------------------------------------------------ chapter overview */
  function renderChapter(body, ctx, ch) {
    const secs = sectionsOf(ch.num);
    const left = h('div', { class: 'stack', style: { gap: '10px' } },
      ch.tagline ? h('div', { class: 'lead b', style: { color: 'var(--chc)' } }, ch.tagline) : null,
      ch.intro ? h('div', { class: 'small', html: ch.intro }) : null,
      ch.objectives && ch.objectives.length ? h('div', { class: 'card tight' }, h('h4', {}, 'After this chapter you will be able to'), h('ul', { class: 'small m0', style: { fontSize: '14px', lineHeight: '1.4' } }, ch.objectives.map((o) => h('li', { html: o })))) : null);
    const pct = progressOfChapter(ch.num);
    const firstKey = (ch.steps && ch.steps.length) ? 'ch' + ch.num + '/1' : (secs[0] ? secs[0].id + '/1' : null);
    const lastKey = store.data.chLast && store.data.chLast[ch.num];
    const resumeKey = lastKey && slideIndex(lastKey) >= 0 ? lastKey : firstKey;
    const resumeSl = resumeKey ? slides[slideIndex(resumeKey)] : null;
    const right = h('div', { class: 'stack', style: { gap: '10px' } },
      h('h4', {}, `${secs.length} sections in this chapter`),
      h('div', { class: 'chmap' }, secs.map((x) => h('button', { onclick: () => go(slideIndex(x.id + '/1')) },
        h('b', {}, `${x.id} ${x.title}`), h('span', { class: 'muted' }, x.summary || ''), secDone(x) ? h('span', { class: 'chip ok', style: { marginLeft: '6px', lineHeight: '1.3' } }, 'done') : null, masteryChip(secMastery(x))))),
      h('div', { class: 'row', style: { marginTop: 'auto' } },
        resumeKey ? h('button', { class: 'btn primary', title: resumeSl && lastKey ? 'Resume at ' + slideLabel(resumeSl) + (resumeSl.step ? ': ' + resumeSl.step.title : '') : '', onclick: () => go(slideIndex(resumeKey)) }, lastKey ? `Continue at ${resumeSl && resumeSl.sec && !resumeSl.sec.pseudo ? resumeSl.sec.id : 'the overview'}` : 'Start chapter', h('span', { html: ICON.right, style: { width: '18px', display: 'inline-flex' } })) : null,
        h('button', { class: 'btn', onclick: () => go(slideIndex('ch' + ch.num + '-terms')) }, 'Key terms'),
        h('button', { class: 'btn', onclick: () => go(slideIndex('ch' + ch.num + '-quiz')) }, 'Chapter challenge'),
        h('div', { class: 'grow', style: { minWidth: '120px' } }, h('div', { class: 'meter' }, h('i', { style: { width: pct * 100 + '%' } })), h('div', { class: 'xs muted' }, `${Math.round(pct * 100)}% visited`))));
    const wrap = h('div', { class: 'split l fill chov' }, left, right);
    body.append(wrap);
    // progressively compact the overview until it fits the fixed body (chapters with many sections)
    if (!Guide.narrow) {
      for (const lvl of ['cm1', 'cm2', 'cm3', 'cm4']) {
        if (body.scrollHeight <= body.clientHeight + 1) break;
        wrap.classList.add(lvl);
      }
    }
  }
  function secDone(sec) { return sec.steps.every((_, i) => store.data.visited[sec.id + '/' + (i + 1)]); }

  /* ------------------------------------------------------------ key-term trainer */
  function chapterTerms(ch) {
    const srcs = new Set(['ch' + ch.num, ...sectionsOf(ch.num).map((x) => x.id)]);
    return gloss.filter((g) => srcs.has(g.src));
  }
  function renderTerms(body, ctx, ch) {
    let deck = chapterTerms(ch);
    if (!deck.length) { body.append(h('p', {}, 'No key terms registered for this chapter yet.')); return; }
    let i = 0;
    const known = store.data.known;
    const card = h('div', { class: 'flip fc-big' }, h('div', { class: 'flip-in' }, h('div', { class: 'flip-face front' }), h('div', { class: 'flip-face back' })));
    const front = card.querySelector('.front'), back = card.querySelector('.back');
    card.addEventListener('click', () => card.classList.toggle('on'));
    const counter = h('div', { class: 'bb-count' });
    const src = h('div', { class: 'small muted' });
    const list = h('div', { class: 'scroll-y', style: { flex: '1', display: 'flex', flexDirection: 'column', gap: '4px' } });
    const knownCount = h('span', { class: 'chip ok' });
    function paint() {
      const g = deck[i];
      card.classList.remove('on');
      front.innerHTML = esc(g.term);
      back.innerHTML = esc(g.def);
      counter.textContent = `Card ${i + 1} of ${deck.length}`;
      src.innerHTML = g.src.startsWith('ch') ? 'From the chapter overview' : `From section ${g.src} ${esc((Guide.sections[g.src] || {}).title || '')}`;
      list.innerHTML = '';
      deck.forEach((d, j) => list.append(h('button', {
        class: 'btn sm ' + (j === i ? 'on' : 'ghost'), style: { justifyContent: 'flex-start', height: 'auto', minHeight: '28px', whiteSpace: 'normal', textAlign: 'left', padding: '3px 8px' },
        onclick: () => { i = j; paint(); },
      }, h('span', { style: { color: known[d.term] ? 'var(--ok)' : 'var(--line-2)', fontWeight: 900 } }, known[d.term] ? '✓' : '•'), ' ', d.term)));
      const k = deck.filter((d) => known[d.term]).length;
      knownCount.textContent = `${k} / ${deck.length} marked as known`;
      const on = list.children[i]; if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest' });
    }
    const mark = (v) => { known[deck[i].term] = v ? 1 : 0; store.save(); if (i < deck.length - 1) i++; paint(); };
    const left = h('div', { class: 'stack' },
      h('div', { class: 'row', style: { justifyContent: 'space-between' } }, counter, knownCount),
      card,
      h('div', { class: 'small muted center' }, 'Say the definition out loud first, then click the card to check yourself.'),
      h('div', { class: 'row', style: { justifyContent: 'center' } },
        h('button', { class: 'btn', onclick: () => { i = (i - 1 + deck.length) % deck.length; paint(); } }, '◀ Previous'),
        h('button', { class: 'btn', onclick: () => card.classList.toggle('on') }, 'Flip'),
        h('button', { class: 'btn', style: { borderColor: 'var(--warn)', color: 'var(--warn)' }, onclick: () => mark(false) }, 'Still learning'),
        h('button', { class: 'btn', style: { borderColor: 'var(--ok)', color: 'var(--ok)' }, onclick: () => mark(true) }, 'I know this ✓'),
        h('button', { class: 'btn', onclick: () => { i = (i + 1) % deck.length; paint(); } }, 'Next ▶')),
      h('div', { class: 'row', style: { justifyContent: 'center' } },
        h('button', { class: 'btn sm ghost', onclick: () => { deck = shuffle(deck); i = 0; paint(); } }, 'Shuffle deck'),
        h('button', { class: 'btn sm ghost', onclick: () => { const rest = deck.filter((d) => !known[d.term]); if (rest.length) { deck = rest; i = 0; paint(); } else toast('You have marked every term as known.'); } }, 'Only terms I am still learning'),
        h('button', { class: 'btn sm ghost', onclick: () => { deck = chapterTerms(ch); i = 0; paint(); } }, 'Full deck')),
      src);
    const right = h('div', { class: 'stack', style: { minHeight: 0, height: '100%' } }, h('h4', {}, `All ${deck.length} terms in Chapter ${ch.num}`), list);
    body.append(h('div', { class: 'split r fill' }, left, right));
    paint();
  }

  /* ------------------------------------------------------------ chapter / final quizzes */
  function poolFor(secs) {
    const pool = [];
    for (const sec of secs) sec.steps.forEach((st, si) => (st.quiz || []).forEach((q, qi) => pool.push(Object.assign({}, q, { source: sec.id, qid: `${sec.id}:${si}:${qi}` }))));
    return pool;
  }
  function sampledQuiz(body, ctx, secs, n, key, blurb) {
    const pool = poolFor(secs);
    if (!pool.length) { body.append(h('p', {}, 'No questions available yet.')); return; }
    const host = h('div', { class: 'grow', style: { minHeight: 0 } });
    const draw = (fresh) => {
      store.data.qdraw = store.data.qdraw || {};
      const savedIds = !fresh && store.data.qdraw[key];
      if (savedIds && savedIds.length) {
        const byId = new Map(pool.map((q) => [q.qid, q]));
        const again = savedIds.map((id) => byId.get(id));
        if (again.every(Boolean)) { host.innerHTML = ''; host.append(quiz(ctx, again, { key, source: true, ids: savedIds })); return; }
      }
      if (fresh && store.data.qstate) delete store.data.qstate[key];
      // balance the draw across sections so every section is represented
      // balance the draw: round-robin over chapters, and inside each chapter over its sections (both shuffled)
      const byCh = {};
      pool.forEach((q) => { const c = q.source.split('.')[0]; ((byCh[c] = byCh[c] || {})[q.source] = byCh[c][q.source] || []).push(q); });
      const chLists = shuffle(Object.values(byCh).map((secs) => shuffle(Object.values(secs).map((l) => shuffle(l)))));
      const picked = [];
      const secTurn = chLists.map(() => 0);
      let r = 0;
      while (picked.length < Math.min(n, pool.length) && r < 20000) {
        const ci = r % chLists.length; const secs = chLists[ci];
        for (let k = 0; k < secs.length; k++) { const l = secs[(secTurn[ci] + k) % secs.length]; if (l.length) { picked.push(l.pop()); secTurn[ci] = (secTurn[ci] + k + 1) % secs.length; break; } }
        r++;
      }
      const drawn = shuffle(picked);
      store.data.qdraw[key] = drawn.map((q) => q.qid); store.save();
      host.innerHTML = '';
      host.append(quiz(ctx, drawn, { key, source: true, ids: drawn.map((q) => q.qid) }));
    };
    body.append(h('div', { class: 'stack fill', style: { gap: '8px' } },
      h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('div', { class: 'small muted', html: blurb }), h('button', { class: 'btn sm', onclick: () => draw(true) }, 'Draw a new set')),
      host));
    draw(false);
  }
  function renderChQuiz(body, ctx, ch) {
    sampledQuiz(body, ctx, sectionsOf(ch.num), 12, 'ch' + ch.num + '-quiz', `Twelve questions drawn from every section of Chapter ${ch.num}. The <b>§</b> tag shows which section to revisit if you miss one.`);
  }
  function renderFinal(body, ctx) {
    sampledQuiz(body, ctx, Object.values(Guide.sections), 20, 'final', 'Twenty questions drawn from all five chapters. Try to beat your best score, then draw a new set.');
  }

  /* =================================================================== UI components */
  const UI = {};

  UI.seg = function (ctx, options, value, onChange) {
    const opts = options.map((o) => (typeof o === 'object' ? o : { value: o, label: String(o) }));
    const el = h('div', { class: 'seg', role: 'group' });
    let v = value;
    const btns = opts.map((o) => h('button', { type: 'button', onclick: () => set(o.value, true), title: o.title || null, html: o.label }));
    el.append(...btns);
    el.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const i = btns.indexOf(document.activeElement); if (i < 0) return;
      e.preventDefault(); e.stopPropagation();
      btns[(i + (e.key === 'ArrowRight' ? 1 : btns.length - 1)) % btns.length].focus();
    });
    function set(nv, fire) { v = nv; btns.forEach((b, i) => { b.classList.toggle('on', opts[i].value === v); b.setAttribute('aria-pressed', opts[i].value === v); }); if (fire && onChange) onChange(v); }
    set(v, false);
    el.set = (nv) => set(nv, false);
    el.get = () => v;
    return el;
  };

  UI.slider = function (ctx, o) {
    const id = 'sl' + Math.random().toString(36).slice(2, 8);
    const out = h('output', { for: id });
    const inp = h('input', { type: 'range', id, min: o.min ?? 0, max: o.max ?? 100, step: o.step ?? 1, value: o.value ?? o.min ?? 0 });
    const format = o.format || ((v) => String(v));
    const upd = (fire) => { const v = parseFloat(inp.value); out.innerHTML = format(v); if (fire && o.onInput) o.onInput(v); };
    inp.addEventListener('input', () => upd(true));
    const el = h('div', { class: 'ui-slider' }, h('label', { for: id, html: o.label || '' }), inp, out);
    el.input = inp;
    el.set = (v, fire) => { inp.value = v; upd(fire); };
    el.get = () => parseFloat(inp.value);
    upd(false);
    return el;
  };

  UI.tabs = function (ctx, list, o = {}) {
    const strip = h('div', { class: 'tabs-strip', role: 'tablist' });
    const panel = h('div', { class: 'tabs-panel' });
    const el = h('div', { class: 'tabs' }, strip, panel);
    let cleanup = null;
    const btns = list.map((t, i) => h('button', { type: 'button', role: 'tab', onclick: () => show(i), html: t.label }));
    strip.append(...btns);
    let curTab = 0;
    strip.addEventListener('keydown', (e) => {
      const n = btns.length; let j = null;
      if (e.key === 'ArrowRight') j = (curTab + 1) % n; else if (e.key === 'ArrowLeft') j = (curTab - 1 + n) % n;
      else if (e.key === 'Home') j = 0; else if (e.key === 'End') j = n - 1;
      if (j == null) return;
      e.preventDefault(); e.stopPropagation();
      show(j); btns[j].focus();
    });
    function show(i) {
      if (typeof cleanup === 'function') { try { cleanup(); } catch (e) { console.error(e); } }
      cleanup = null;
      curTab = i;
      btns.forEach((b, j) => { b.classList.toggle('on', i === j); b.setAttribute('aria-selected', i === j); b.tabIndex = i === j ? 0 : -1; });
      panel.innerHTML = '';
      const t = list[i];
      if (t.html) panel.append(frag(t.html));
      if (t.render) cleanup = t.render(panel, ctx);
      if (o.onChange) o.onChange(i);
      ctx.after(30, checkOverflow);
    }
    ctx.cleanup(() => { if (typeof cleanup === 'function') cleanup(); });
    show(o.initial || 0);
    el.show = show;
    return el;
  };

  UI.reveal = function (ctx, label, content, o = {}) {
    const bodyEl = h('div', { class: 'reveal-body' });
    if (typeof content === 'string') bodyEl.innerHTML = content; else if (content) bodyEl.append(content);
    const btn = h('button', { class: 'btn sm reveal-btn ' + (o.cls || ''), type: 'button', onclick: () => {
      const on = !bodyEl.classList.contains('on');
      bodyEl.classList.toggle('on', on);
      btn.innerHTML = on ? (o.hideLabel || 'Hide') : label;
      ctx.after(30, checkOverflow);
    }, html: label });
    return h('div', { class: 'reveal' }, btn, bodyEl);
  };

  UI.flipcards = function (ctx, pairs, o = {}) {
    const grid = h('div', { class: 'grid-' + (o.cols || 3) });
    pairs.forEach(([f, b]) => {
      const card = h('div', { class: 'flip', style: { minHeight: (o.height || 96) + 'px' }, tabindex: 0, role: 'button', 'aria-label': 'Flip card' },
        h('div', { class: 'flip-in' }, h('div', { class: 'flip-face front' }, h('div', { html: f })), h('div', { class: 'flip-face back' }, h('div', { html: b }))));
      const flip = () => card.classList.toggle('on');
      card.addEventListener('click', flip);
      card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } });
      grid.append(card);
    });
    return grid;
  };

  const KW = new Set(('if else while for do return int bool boolean void true false const struct typedef static break continue switch case default char float double long ' +
    'unsigned enum union extern sizeof null NULL new class public private protected var function let procedure begin end parbegin parend repeat until forever ' +
    'semaphore binary_semaphore monitor cond condition message atomic then of type program shared local and or not mod import from def elif pass None True False lambda').split(' '));
  function hlLine(line, lang) {
    if (lang === 'plain' || lang === 'text') return esc(line);
    const re = /(\/\/.*$|\/\*.*?\*\/|#.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\b0x[0-9a-fA-F]+\b|\b\d+(?:\.\d+)?\b)|(\b[A-Za-z_]\w*\b)/g;
    let out = '', last = 0, m;
    while ((m = re.exec(line))) {
      out += esc(line.slice(last, m.index));
      const [, com, str, num, word] = m;
      if (com) out += `<span class="tk-com">${esc(com)}</span>`;
      else if (str) out += `<span class="tk-str">${esc(str)}</span>`;
      else if (num) out += `<span class="tk-num">${esc(num)}</span>`;
      else if (word) {
        if (KW.has(word)) out += `<span class="tk-kw">${word}</span>`;
        else if (/^\s*\(/.test(line.slice(m.index + word.length))) out += `<span class="tk-fn">${word}</span>`;
        else out += esc(word);
      }
      last = re.lastIndex;
    }
    return out + esc(line.slice(last));
  }
  function codeEl(src, o = {}) {
    const lines = String(src).replace(/^\n+|\s+$/g, '').split('\n');
    const pre = h('pre', { class: 'code' + (o.nums === false ? ' nonum' : '') + (o.cls ? ' ' + o.cls : '') });
    if (o.maxHeight) pre.style.maxHeight = o.maxHeight + 'px';
    if (o.fontSize) pre.style.fontSize = o.fontSize + 'px';
    pre.innerHTML = lines.map((l, i) => `<span class="ln" data-n="${i + 1}">${hlLine(l, o.lang || 'c') || ' '}</span>`).join('');
    const lineEls = () => Array.from(pre.querySelectorAll('.ln'));
    pre.mark = (nums, cls = 'cur') => {
      const set = new Set([].concat(nums == null ? [] : nums));
      lineEls().forEach((el, i) => el.classList.toggle(cls, set.has(i + 1)));
      const first = lineEls()[Math.min(...[...set]) - 1];
      if (first && pre.scrollHeight > pre.clientHeight) { const t = first.offsetTop - pre.clientHeight / 2; pre.scrollTop = Math.max(0, t); }
    };
    pre.clear = (cls) => lineEls().forEach((el) => (cls ? el.classList.remove(cls) : el.classList.remove('cur', 'ok', 'bad', 'dim')));
    pre.line = (n) => lineEls()[n - 1];
    return pre;
  }
  UI.code = (ctx, src, o) => codeEl(src, o);
  Guide.code = codeEl;

  UI.player = function (ctx, o) {
    let count = o.count, i = 0, timer = null, speed = 1;
    const cap = h('div', { class: 'player-cap', 'aria-live': 'polite' });
    const counter = h('span', { class: 'player-count' });
    const bar = h('div', { class: 'player-bar' }, h('i'));
    const mk = (icon, label, fn, cls = 'btn sm') => h('button', { class: cls, type: 'button', title: label, 'aria-label': label, onclick: fn, html: ICON[icon] + (cls.includes('primary') ? '' : '') });
    const bReset = mk('reset', 'Restart', () => { stop(); go(0); });
    const bPrev = mk('prev', 'Previous step', () => { stop(); go(i - 1); });
    const bPlay = h('button', { class: 'btn sm primary', type: 'button', onclick: () => (timer ? stop() : play()) });
    const bNext = mk('next', 'Next step', () => { stop(); go(i + 1); });
    const spd = UI.seg(ctx, [{ value: 0.5, label: '0.5×' }, { value: 1, label: '1×' }, { value: 2, label: '2×' }], 1, (v) => { speed = v; if (timer) { stop(); play(); } });
    [bReset, bPrev, bNext].forEach((b) => b.querySelector('svg') && (b.querySelector('svg').style.width = '16px'));
    const ctl = h('div', { class: 'player-ctl' }, bReset, bPrev, bPlay, bNext, counter, bar, o.speed === false ? null : spd);
    const el = h('div', { class: 'player' }, o.captionBelow ? null : cap, ctl, o.captionBelow ? cap : null);
    if (o.caption === false) cap.style.display = 'none';
    function paintPlay() { bPlay.innerHTML = (timer ? ICON.pause + '<span>Pause</span>' : ICON.play + '<span>' + (i >= count - 1 ? 'Replay' : 'Play') + '</span>'); bPlay.querySelector('svg').style.width = '15px'; }
    function go(n) {
      i = clamp(n, 0, Math.max(0, count - 1));
      let out;
      try { out = o.render(i); } catch (e) { console.error(e); out = '<span style="color:var(--bad)">Error: ' + esc(e.message) + '</span>'; }
      if (out != null) cap.innerHTML = out;
      counter.textContent = `Step ${i + 1} / ${count}`;
      bar.firstChild.style.width = (count > 1 ? (i / (count - 1)) * 100 : 100) + '%';
      bPrev.disabled = i === 0; bNext.disabled = i >= count - 1;
      if (i >= count - 1 && timer) stop();
      paintPlay();
      if (o.onStep) o.onStep(i);
    }
    function play() {
      if (i >= count - 1) go(0);
      clearInterval(timer);
      timer = setInterval(() => { if (!ctx.alive) return stop(); go(i + 1); }, (o.interval || 1600) / speed);
      paintPlay();
    }
    function stop() { clearInterval(timer); timer = null; paintPlay(); }
    ctx.cleanup(stop);
    const api = { el, go, play, stop, next: () => go(i + 1), prev: () => go(i - 1), reset: () => { stop(); go(0); }, get index() { return i; }, get count() { return count; },
      setCount(n, keep) { count = Math.max(1, n); go(keep ? Math.min(i, count - 1) : 0); }, refresh: () => go(i), caption: cap };
    go(o.start || 0);
    if (o.autoplay) play();
    return api;
  };

  /* ------------------------------------------------------------ quiz engine */
  const QLABEL = { mc: 'Multiple choice', tf: 'True or false', multi: 'Select all that apply', order: 'Put in order', match: 'Match the pairs', bucket: 'Sort into groups', num: 'Calculate' };
  const QIDLE = {
    mc: 'Pick the best answer. You get a second try; the explanation appears here.',
    tf: 'Decide whether the statement is true or false.',
    multi: 'Select every correct option, then press Check.',
    order: 'Drag the items (or use the arrows) into the correct order, then press Check.',
    match: 'Choose the matching item for each row, then press Check.',
    bucket: 'Put each item in the right group, then press Check.',
    num: 'Work it out, type your answer, then press Check.',
  };
  function normQ(q) {
    const { type } = validateQuestion(q, 'q');
    const n = Object.assign({}, q, { type });
    if (type === 'tf') { n.choices = ['True', 'False']; n.answerIdx = q.answer ? 0 : 1; n.max = 1; }
    else if (type === 'mc') { n.answerIdx = q.answer; n.max = q.choices.length <= 2 ? 1 : 2; }
    else n.max = 2;
    return n;
  }
  function quiz(ctx, questions, o = {}) {
    const qs = questions.map(normQ);
    let st = qs.map(() => ({ tries: 0, done: false, res: null }));
    let cur = 0;
    let order = range(qs.length);
    // restore a saved attempt (answers, tries, current question) so leaving the step or rotating the device keeps the work
    const ids = o.ids || qs.map((q, i) => i + ':' + hashStr(String(q.q)));
    let startPos = 0, startSum = false;
    const saved = o.key && store.data.qstate && store.data.qstate[o.key];
    if (saved && Array.isArray(saved.ids) && saved.ids.join('|') === ids.join('|') && Array.isArray(saved.st) && saved.st.length === qs.length) {
      st = saved.st; if (Array.isArray(saved.order) && saved.order.length) order = saved.order;
      startPos = saved.pos || 0; startSum = saved.mode === 'sum';
    }
    function saveState() {
      if (!o.key) return;
      store.data.qstate = store.data.qstate || {};
      store.data.qstate[o.key] = { ids, st, order, pos: Math.max(0, order.indexOf(cur)), mode: main.dataset.mode || 'q' };
      store.save();
    }
    const root = h('div', { class: 'quiz' });
    const pills = h('div', { class: 'quiz-pills' });
    const score = h('div', { class: 'quiz-score' });
    const main = h('div', { class: 'quiz-main' });
    const bPrev = h('button', { class: 'btn sm', type: 'button', onclick: () => show(order.indexOf(cur) - 1) }, '◀ Previous');
    const bNext = h('button', { class: 'btn sm primary', type: 'button', onclick: () => nextQ() });
    const bRestart = h('button', { class: 'btn sm ghost', type: 'button', onclick: () => restart(range(qs.length)) }, 'Start over');
    root.append(h('div', { class: 'quiz-top' }, pills, score), main, h('div', { class: 'quiz-ctl' }, bPrev, h('div', { style: { flex: '1' } }), bRestart, bNext));
    ['click', 'change', 'input'].forEach((ev) => root.addEventListener(ev, () => setTimeout(saveState, 0)));

    function saveBest() {
      if (!o.key) return;
      const right = st.filter((x) => x.res === 'right').length;
      const rec = store.data.quiz[o.key] || { best: 0, total: qs.length };
      rec.best = Math.max(rec.best || 0, right); rec.total = qs.length; rec.last = right;
      store.data.quiz[o.key] = rec; store.save();
    }
    function paintTop() {
      pills.innerHTML = '';
      order.forEach((qi, k) => pills.append(h('button', { type: 'button', class: 'quiz-pill' + (qi === cur && main.dataset.mode !== 'sum' ? ' on' : '') + (st[qi].res ? ' ' + st[qi].res : ''), title: `Question ${k + 1}`, onclick: () => show(k) }, String(k + 1))));
      const done = order.filter((qi) => st[qi].done).length;
      const right = order.filter((qi) => st[qi].res === 'right').length;
      score.textContent = `${right} right first try · ${done}/${order.length} answered`;
      const allDone = order.every((qi) => st[qi].done);
      const pos = order.indexOf(cur);
      bNext.textContent = allDone ? 'See results ▶' : 'Next question ▶';
      bPrev.disabled = main.dataset.mode === 'sum' ? false : pos <= 0;
    }
    function nextQ() {
      const pos = order.indexOf(cur);
      for (let k = 1; k <= order.length; k++) { const qi = order[(pos + k) % order.length]; if (!st[qi].done) return show(order.indexOf(qi)); }
      summary();
    }
    function restart(idxs) {
      order = idxs;
      idxs.forEach((qi) => (st[qi] = { tries: 0, done: false, res: null }));
      show(0);
      saveState();
    }
    function summary() {
      main.dataset.mode = 'sum';
      const right = order.filter((qi) => st[qi].res === 'right').length;
      const missed = order.filter((qi) => st[qi].res !== 'right');
      const pct = Math.round((right / order.length) * 100);
      const what = o.source ? 'these sections' : 'this section';
      const msg = pct === 100 ? `Perfect. You have ${what} nailed.` : pct >= 80 ? 'Strong work. Review the explanations for the ones you missed.' : pct >= 50 ? 'Good start. Revisit the steps for the questions you missed, then try again.' : `This is a good time to go back through ${what} and then retry.`;
      const cmpId = (a, b) => { const [a1, a2] = a.split('.').map(Number); const [b1, b2] = b.split('.').map(Number); return a1 - b1 || a2 - b2; };
      const revisit = [...new Set(missed.map((qi) => qs[qi].source).filter(Boolean))].sort(cmpId);
      main.innerHTML = '';
      main.append(h('div', { class: 'quiz-sum', style: { gridColumn: '1 / -1' } }, h('div', { class: 'stack', style: { alignItems: 'center' } },
        h('div', { class: 'big', style: { fontSize: '64px', color: pct >= 80 ? 'var(--ok)' : pct >= 50 ? 'var(--warn)' : 'var(--bad)' } }, pct + '%'),
        h('div', { class: 'lead b' }, `${right} of ${order.length} correct on the first try`),
        h('div', { class: 'muted' }, msg),
        o.source && revisit.length ? h('div', { class: 'row small', style: { justifyContent: 'center', gap: '6px' } }, h('span', {}, 'Sections to revisit:'),
          revisit.map((x) => h('button', { class: 'btn sm', type: 'button', title: (Guide.sections[x] || {}).title || '', onclick: () => go(slideIndex(x + '/1')) }, '§' + x))) : null,
        h('div', { class: 'row', style: { justifyContent: 'center' } },
          missed.length ? h('button', { class: 'btn primary', type: 'button', onclick: () => restart(missed) }, `Retry the ${missed.length} I missed`) : null,
          h('button', { class: 'btn', type: 'button', onclick: () => restart(range(qs.length)) }, 'Start over')))));
      saveBest();
      paintTop();
      saveState();
      ctx.after(30, checkOverflow);
    }
    function show(k) {
      if (k < 0) k = 0;
      if (k >= order.length) return summary();
      main.dataset.mode = 'q';
      cur = order[k];
      renderQ(cur, k);
      paintTop();
      saveState();
      ctx.after(30, checkOverflow);
    }
    function renderQ(qi, k) {
      const q = qs[qi], s = st[qi];
      main.innerHTML = '';
      const left = h('div', { class: 'quiz-q' });
      const fb = h('div', { class: 'quiz-fb', 'aria-live': 'polite' });
      main.append(left, fb);
      left.append(h('div', { class: 'quiz-type' }, `Question ${k + 1} of ${order.length} · ${QLABEL[q.type]}`, q.source && o.source ? h('span', { class: 'quiz-src' }, '§' + q.source) : null));
      left.append(h('div', { class: 'quiz-qtext', html: q.q }));
      if (q.code) left.append(codeEl(q.code, { nums: false, fontSize: 13.5 }));
      const box = h('div', { class: 'qopts' });
      left.append(box);
      const whyHtml = () => `<div class="why">${q.why}</div>`;
      const api = {
        finish(correct) {
          s.done = true;
          s.res = correct ? (s.tries === 0 ? 'right' : 'late') : 'wrong';
          const verdict = s.res === 'right' ? '<div class="verdict ok">✓ Correct!</div>' : s.res === 'late' ? '<div class="verdict warn">✓ Correct on the second try</div>' : '<div class="verdict bad">✗ Not this time. The correct answer is shown in green.</div>';
          fb.innerHTML = verdict + whyHtml();
          saveBest(); paintTop(); saveState();
        },
        miss(extra) {
          s.tries++;
          if (s.tries >= q.max) return api.finish(false);
          fb.innerHTML = `<div class="verdict bad">✗ Not quite. Try once more.</div>${extra ? `<div>${extra}</div>` : ''}${q.hint ? `<div class="why"><b>Hint:</b> ${q.hint}</div>` : ''}`;
        },
        final() { fb.innerHTML = (s.res === 'right' ? '<div class="verdict ok">✓ Correct!</div>' : s.res === 'late' ? '<div class="verdict warn">✓ Correct on the second try</div>' : '<div class="verdict bad">✗ The correct answer is shown in green.</div>') + whyHtml(); },
      };
      fb.innerHTML = `<div class="muted">${QIDLE[q.type]}</div>` + (q.hint ? `<div class="why small"><b>Hint:</b> ${q.hint}</div>` : '');
      RENDER[q.type === 'tf' ? 'mc' : q.type](q, s, box, api, left);
      if (s.done) api.final();
      fitQ(left);
    }
    // shrink long questions (many options/rows) until they fit the fixed quiz panel
    function fitQ(left) {
      const run = () => {
        if (Guide.narrow || !left.isConnected) return;
        main.classList.remove('dense', 'denser');
        if (left.scrollHeight > left.clientHeight + 1) main.classList.add('dense');
        if (left.scrollHeight > left.clientHeight + 1) main.classList.add('denser');
      };
      run();
      ctx.after(0, run);
    }
    const checkBtn = (fn) => h('button', { class: 'btn primary', type: 'button', style: { alignSelf: 'flex-start' }, onclick: fn }, 'Check answer');
    const RENDER = {
      mc(q, s, box, api) {
        s.wrong = s.wrong || [];
        const btns = q.choices.map((c, j) => h('button', { type: 'button', class: 'qopt', onclick: () => pick(j) }, h('span', { class: 'ql' }, q.type === 'tf' ? (j ? 'F' : 'T') : 'ABCDEFGH'[j]), h('span', { html: c })));
        box.append(...btns);
        function paint() {
          btns.forEach((b, j) => {
            const w = s.wrong.includes(j);
            b.classList.toggle('wrong', w); if (w) b.disabled = true;
            if (s.done) { b.disabled = true; if (j === q.answerIdx) b.classList.add('right'); else if (!w) b.classList.add('dim'); }
          });
        }
        function pick(j) {
          if (s.done) return;
          if (j === q.answerIdx) api.finish(true);
          else { s.wrong.push(j); api.miss(q.feedback && q.feedback[j]); }
          paint();
        }
        paint();
      },
      multi(q, s, box, api, left) {
        s.sel = s.sel || [];
        const ans = new Set(q.answer);
        const btns = q.choices.map((c, j) => h('button', { type: 'button', class: 'qopt', onclick: () => { if (s.done) return; const k = s.sel.indexOf(j); if (k >= 0) s.sel.splice(k, 1); else s.sel.push(j); paint(false); } },
          h('span', { class: 'ql' }, '☐'), h('span', { html: c })));
        box.append(...btns);
        const chk = checkBtn(() => {
          if (s.done) return;
          const sel = new Set(s.sel);
          const ok = sel.size === ans.size && [...sel].every((x) => ans.has(x));
          if (ok) api.finish(true);
          else { const good = [...sel].filter((x) => ans.has(x)).length; api.miss(`You picked ${good} correct option${good === 1 ? '' : 's'} and ${sel.size - good} incorrect one${sel.size - good === 1 ? '' : 's'}. There ${ans.size === 1 ? 'is' : 'are'} ${ans.size} correct option${ans.size === 1 ? '' : 's'} in total.`); }
          paint(true);
        });
        left.append(chk);
        function paint(checked) {
          btns.forEach((b, j) => {
            const on = s.sel.includes(j);
            b.classList.toggle('sel', on && !s.done);
            b.querySelector('.ql').textContent = on ? '☑' : '☐';
            b.classList.remove('right', 'wrong');
            if (s.done) { b.disabled = true; if (ans.has(j)) b.classList.add('right'); else if (on) b.classList.add('wrong'); else b.classList.add('dim'); }
            else if (checked && on && !ans.has(j)) b.classList.add('wrong');
          });
          chk.disabled = s.done;
        }
        paint(false);
      },
      order(q, s, box, api, left) {
        if (!s.arr) { let a; let guard = 0; do { a = shuffle(range(q.items.length)); guard++; } while (a.every((v, k) => v === k) && guard < 20); s.arr = a; }
        let dragFrom = null;
        function paint(checked) {
          box.innerHTML = '';
          s.arr.forEach((it, pos) => {
            const row = h('div', { class: 'qord', draggable: s.done ? 'false' : 'true' },
              h('span', { class: 'grip' }, '⋮⋮'), h('span', { class: 'b', style: { color: 'var(--muted)', minWidth: '1.4em' } }, String(pos + 1)),
              h('span', { class: 'txt', html: q.items[it] }),
              s.done ? null : h('span', { class: 'mv' },
                h('button', { type: 'button', 'aria-label': 'Move up', onclick: () => move(pos, pos - 1), disabled: pos === 0 }, '▲'),
                h('button', { type: 'button', 'aria-label': 'Move down', onclick: () => move(pos, pos + 1), disabled: pos === s.arr.length - 1 }, '▼')));
            if (s.done || checked) row.classList.add(it === pos ? 'right' : 'wrong');
            row.addEventListener('dragstart', (e) => { dragFrom = pos; row.classList.add('drag'); try { e.dataTransfer.setData('text/plain', String(pos)); e.dataTransfer.effectAllowed = 'move'; } catch (x) { /* ignore */ } });
            row.addEventListener('dragend', () => row.classList.remove('drag'));
            row.addEventListener('dragover', (e) => e.preventDefault());
            row.addEventListener('drop', (e) => { e.preventDefault(); if (dragFrom != null) move(dragFrom, pos); dragFrom = null; });
            box.append(row);
          });
        }
        function move(a, b) { if (s.done || b < 0 || b >= s.arr.length) return; const [x] = s.arr.splice(a, 1); s.arr.splice(b, 0, x); paint(false); }
        const chk = checkBtn(() => {
          if (s.done) return;
          const right = s.arr.filter((v, k) => v === k).length;
          if (right === s.arr.length) { api.finish(true); paint(true); }
          else { api.miss(`${right} of ${s.arr.length} items are in the right position (green).`); if (s.done) { s.arr = range(q.items.length); } paint(true); }
          chk.disabled = s.done;
        });
        if (s.done) s.arr = s.res === 'wrong' ? range(q.items.length) : s.arr;
        left.append(chk); chk.disabled = s.done;
        paint(false);
      },
      match(q, s, box, api, left) {
        if (!s.opts) s.opts = shuffle(q.pairs.map((p) => p[1]));
        s.sel = s.sel || q.pairs.map(() => '');
        const rows = q.pairs.map((p, j) => {
          const sel = h('select', { 'aria-label': 'Match for ' + p[0].replace(/<[^>]+>/g, ''), onchange: () => { s.sel[j] = sel.value; rows[j].classList.remove('right', 'wrong'); } },
            h('option', { value: '' }, '— choose —'), s.opts.map((v) => h('option', { value: v }, v.replace(/<[^>]+>/g, ''))));
          sel.value = s.sel[j];
          const row = h('div', { class: 'qrow' }, h('span', { html: p[0] }), sel);
          return row;
        });
        box.append(...rows);
        function paint(checked) {
          rows.forEach((r, j) => {
            const sel = r.querySelector('select');
            if (s.done) { sel.value = q.pairs[j][1]; sel.disabled = true; }
            r.classList.remove('right', 'wrong');
            if (checked || s.done) r.classList.add(sel.value === q.pairs[j][1] ? 'right' : 'wrong');
          });
        }
        const chk = checkBtn(() => {
          if (s.done) return;
          const right = q.pairs.filter((p, j) => s.sel[j] === p[1]).length;
          if (right === q.pairs.length) api.finish(true); else api.miss(`${right} of ${q.pairs.length} matches are correct (green).`);
          paint(true); chk.disabled = s.done;
        });
        left.append(chk); chk.disabled = s.done;
        paint(false);
      },
      bucket(q, s, box, api, left) {
        s.sel = s.sel || q.items.map(() => -1);
        const rows = q.items.map((it, j) => {
          const seg = UI.seg(ctx, q.buckets.map((b, bi) => ({ value: bi, label: b })), s.sel[j], (v) => { s.sel[j] = v; rows[j].classList.remove('right', 'wrong'); });
          return h('div', { class: 'qrow' }, h('span', { html: it[0] }), seg);
        });
        box.append(...rows);
        function paint(checked) {
          rows.forEach((r, j) => {
            if (s.done) { r.querySelector('.seg').set(q.items[j][1]); r.querySelectorAll('.seg button').forEach((b) => (b.disabled = true)); }
            r.classList.remove('right', 'wrong');
            if (s.done) r.classList.add('right');
            else if (checked) r.classList.add(s.sel[j] === q.items[j][1] ? 'right' : 'wrong');
          });
        }
        const chk = checkBtn(() => {
          if (s.done) return;
          const right = q.items.filter((it, j) => s.sel[j] === it[1]).length;
          if (right === q.items.length) api.finish(true); else api.miss(`${right} of ${q.items.length} are in the right group (green).`);
          paint(true); chk.disabled = s.done;
        });
        left.append(chk); chk.disabled = s.done;
        paint(false);
      },
      num(q, s, box, api) {
        const inp = h('input', { type: 'text', inputmode: 'decimal', 'aria-label': 'Your answer', placeholder: 'your answer', value: s.val || '' });
        const tol = q.tol != null ? q.tol : q.rtol != null ? Math.abs(q.answer * q.rtol) : 1e-9;
        const chk = h('button', { class: 'btn primary', type: 'button', onclick: () => {
          if (s.done) return;
          const v = parseFloat(String(inp.value).replace(/,/g, ''));
          s.val = inp.value;
          if (Number.isNaN(v)) { toast('Type a number first.'); return; }
          if (Math.abs(v - q.answer) <= tol + 1e-12) { inp.classList.add('right'); api.finish(true); }
          else {
            inp.classList.add('wrong');
            const dir = v > q.answer ? 'too high' : 'too low';
            const unitNote = q.unit ? ` The answer is in ${q.unit}.` : '';
            api.miss(`${esc(inp.value)}${q.unit ? ' ' + q.unit : ''} is ${dir}.${unitNote} Recheck each step of your working${q.hint ? '' : ' and the formula you used'}.`);
          }
          paint();
        } }, 'Check answer');
        inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') chk.click(); });
        inp.addEventListener('input', () => inp.classList.remove('wrong'));
        box.append(h('div', { class: 'qnum' }, inp, q.unit ? h('span', { class: 'b', html: q.unit }) : null, chk));
        function paint() {
          if (s.done) { inp.value = String(q.answer); inp.disabled = true; chk.disabled = true; inp.classList.remove('wrong'); inp.classList.add('right'); }
        }
        paint();
      },
    };
    if (startSum && order.every((qi) => st[qi].done)) summary(); else show(Math.min(startPos, order.length - 1));
    return root;
  }
  UI.quiz = (ctx, questions, o) => quiz(ctx, questions, o || {});

  /* ------------------------------------------------------------ drawers, glossary, notes, help */
  let returnFocus = null;
  function setOverlayState() {
    [els.toc, els.gloss, els.notes, els.modal].forEach((d) => { const on = d.classList.contains('on'); d.inert = !on; d.setAttribute('aria-hidden', on ? 'false' : 'true'); });
  }
  function openDrawer(which) {
    const prev = document.activeElement;
    closeAll(true);
    returnFocus = prev && prev !== document.body ? prev : null;
    els.scrim.classList.add('on');
    if (which === 'toc') { renderToc(); els.toc.classList.add('on'); setTimeout(() => { const on = els.tocBody.querySelector('.on'); if (on) on.scrollIntoView({ block: 'center' }); els.tocSearch.focus({ preventScroll: true }); }, 60); }
    if (which === 'gloss') { renderGloss(); els.gloss.classList.add('on'); setTimeout(() => els.glSearch.focus(), 60); }
    if (which === 'notes') { renderNotes(); els.notes.classList.add('on'); setTimeout(() => { const b = els.notes.querySelector('button'); if (b) b.focus(); }, 60); }
    setOverlayState();
  }
  function closeAll(keepScrim) {
    const wasOpen = [els.toc, els.gloss, els.notes, els.modal].some((d) => d.classList.contains('on'));
    const focusInside = document.activeElement && document.activeElement.closest && document.activeElement.closest('.drawer, .modal');
    [els.toc, els.gloss, els.notes, els.modal].forEach((d) => d.classList.remove('on'));
    if (!keepScrim) els.scrim.classList.remove('on');
    setOverlayState();
    hideTerm();
    if (wasOpen && !keepScrim) {
      const target = returnFocus && returnFocus.isConnected && !returnFocus.closest('.drawer, .modal') ? returnFocus : null;
      if (target) target.focus({ preventScroll: true }); else if (focusInside) document.activeElement.blur();
      returnFocus = null;
    }
  }
  function renderToc() {
    const f = (els.tocSearch.value || '').toLowerCase().trim();
    const sl = slides[cur] || {};
    els.tocBody.innerHTML = '';
    const home = h('button', { type: 'button', class: 'toc-sec' + (sl.type === 'home' ? ' on' : ''), style: { paddingLeft: '8px' }, onclick: () => { closeAll(); go(0); } }, h('span', { class: 'tt b' }, 'Home'));
    if (!f) els.tocBody.append(home);
    for (const c of sortedChapters()) {
      const secs = sectionsOf(c.num).filter((x) => !f || (x.id + ' ' + x.title + ' ' + (x.summary || '')).toLowerCase().includes(f));
      if (f && !secs.length && !c.title.toLowerCase().includes(f)) continue;
      const grp = h('div', { class: 'toc-ch' });
      const cm = chapterMastery(c.num);
      grp.append(h('button', { type: 'button', class: 'toc-ch-head', style: { '--c': `var(--ch${c.num})` }, title: cm ? `Quizzes tried: ${cm.tried} of ${cm.of} · ${Math.round(cm.pct * 100)}% right on the first try` : '', onclick: () => { closeAll(); go(slideIndex('ch' + c.num)); } },
        h('span', { class: 'toc-ch-num' }, String(c.num)), h('span', { class: 'toc-ch-title' }, c.title), h('span', { class: 'toc-pct' }, Math.round(progressOfChapter(c.num) * 100) + '%')));
      for (const x of secs) {
        const on = sl.sec === x;
        grp.append(h('button', { type: 'button', class: 'toc-sec' + (on ? ' on' : ''), 'aria-current': on ? 'true' : null, onclick: () => { closeAll(); go(slideIndex(x.id + '/1')); } },
          h('span', { class: 'n' }, x.id), h('span', { class: 'tt' }, x.title), masteryChip(secMastery(x)), secDone(x) ? h('span', { class: 'ck', title: 'All steps visited' }, '✓') : null));
      }
      if (!f && sectionsOf(c.num).length) {
        [['-terms', 'Key-term flashcards'], ['-quiz', 'Chapter challenge']].forEach(([suf, lab]) => grp.append(h('button', { type: 'button', class: 'toc-sec extra' + (sl.key === 'ch' + c.num + suf ? ' on' : ''), onclick: () => { closeAll(); go(slideIndex('ch' + c.num + suf)); } }, h('span', { class: 'n' }, ''), h('span', { class: 'tt' }, lab))));
      }
      els.tocBody.append(grp);
    }
    if (!f && slideIndex('final') >= 0) els.tocBody.append(h('button', { type: 'button', class: 'toc-sec' + (sl.type === 'final' ? ' on' : ''), style: { paddingLeft: '8px' }, onclick: () => { closeAll(); go(slideIndex('final')); } }, h('span', { class: 'tt b' }, 'Final challenge (all chapters)')));
    if (!f) els.tocBody.append(h('button', { type: 'button', class: 'toc-sec', style: { paddingLeft: '8px' }, onclick: () => { closeAll(); openPrint(); } }, h('span', { class: 'tt' }, 'Printable study guide (opens a new tab)')));
  }
  function renderGloss() {
    const f = (els.glSearch.value || '').toLowerCase().trim();
    els.glBody.innerHTML = '';
    let letter = '';
    let list = gloss.filter((g) => !f || g.term.toLowerCase().includes(f) || g.def.toLowerCase().includes(f));
    if (f) {
      const rank = (g) => { const t = g.term.toLowerCase(); return t === f || baseName(g.term) === f ? 0 : t.startsWith(f) ? 1 : t.includes(f) ? 2 : 3; };
      list = list.slice().sort((a, b) => rank(a) - rank(b));
    }
    if (!list.length) els.glBody.append(h('p', { class: 'muted' }, 'No matching terms.'));
    for (const g of list) {
      const L = g.term.replace(/^[^A-Za-z0-9]+/, '').charAt(0).toUpperCase();
      if (L !== letter && !f) { letter = L; els.glBody.append(h('div', { class: 'gl-letter' }, L)); }
      const target = g.src.startsWith('ch') ? g.src : g.src + '/1';
      if (slideIndex(target) < 0 && !g.src.startsWith('ch')) { /* term from a section not in this build */ }
      els.glBody.append(h('div', { class: 'gl-item' }, h('b', {}, g.term), h('span', { class: 'src', title: 'Go to where this term is taught', onclick: () => { closeAll(); go(slideIndex(target)); } }, g.src.startsWith('ch') ? 'Chapter ' + g.src.slice(2) : '§' + g.src), h('p', {}, g.def)));
    }
  }
  function renderNotes() {
    const sl = slides[cur];
    const sec = sl && sl.sec;
    els.notesTitle.textContent = sec ? (sec.pseudo ? sec.title : `${sec.id} ${sec.title}`) + ' — notes' : 'Notes';
    els.notesBody.innerHTML = sec && sec.notes ? sec.notes : '<p class="muted">Notes are available on section steps.</p>';
  }
  function openModal() {
    const prev = document.activeElement;
    closeAll(true);
    returnFocus = prev && prev !== document.body ? prev : null;
    els.scrim.classList.add('on');
    els.modal.innerHTML = '';
    els.modal.append(h('div', { class: 'modal-card', role: 'dialog', 'aria-label': 'Help' },
      h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('h3', {}, 'How to use this guide'), iconBtn('close', 'Close', closeAll)),
      h('p', { class: 'small' }, 'Each section moves from a plain-language explanation, to simulations you control, to a short self-check. Your progress is saved in this browser only.'),
      h('div', { class: 'keys', html: [
        ['← / →', 'Previous / next step'], ['[ / ]', 'Previous / next section'], ['T', 'Table of contents'], ['G', 'Glossary of every key term'],
        ['N', 'Printable notes for the current section'], ['F', 'Full screen (great for projectors)'], ['D', 'Dark / light mode'], ['Esc', 'Close any panel'],
      ].map(([k, v]) => `<kbd>${k}</kbd><span>${v}</span>`).join('') }),
      h('h4', { style: { margin: '14px 0 6px' } }, 'Colour language'), legend(),
      h('h4', { style: { margin: '14px 0 6px' } }, 'Learning route'),
      h('p', { class: 'small', style: { margin: '0 0 6px' } }, 'The core path keeps each section\'s big picture, its key hands-on steps, the recap and the quiz. Use it for a first pass or for revision; everything stays reachable from the contents and the step dots.'),
      routeSeg(),
      h('div', { class: 'row', style: { marginTop: '12px' } }, h('button', { class: 'btn sm', type: 'button', onclick: () => { closeAll(); openPrint(); } }, 'Printable study guide')),
      h('div', { class: 'row', style: { marginTop: '16px', justifyContent: 'space-between' } },
        h('button', { class: 'btn sm danger', onclick: () => { store.data.visited = {}; store.data.quiz = {}; store.data.known = {}; store.save(); closeAll(); go(cur); toast('Progress cleared.'); } }, 'Reset my progress'),
        h('button', { class: 'btn primary', onclick: closeAll }, 'Got it'))));
    els.modal.classList.add('on');
    setOverlayState();
    setTimeout(() => { const b = els.modal.querySelector('.modal-card button'); if (b) b.focus(); }, 60);
  }

  /* ------------------------------------------------------------ term popovers */
  let popTimer = null;
  function showTerm(el) {
    const key = el.dataset.t || el.textContent;
    const sl = slides[cur];
    const g = lookupTerm(key, sl && sl.sec ? sl.sec.id : null);
    if (!g) { console.warn('[term] no glossary entry for "' + key + '"'); return; }
    els.pop.innerHTML = `<b>${esc(g.term)}</b>${esc(g.def)}<div class="src">${g.src.startsWith('ch') ? 'Chapter ' + g.src.slice(2) + ' overview' : 'Taught in §' + g.src} · full list: press G</div>`;
    els.pop.classList.add('on');
    const r = el.getBoundingClientRect(); const pr = els.pop.getBoundingClientRect();
    let x = r.left + r.width / 2 - pr.width / 2; x = clamp(x, 8, innerWidth - pr.width - 8);
    let y = r.bottom + 8; if (y + pr.height > innerHeight - 8) y = r.top - pr.height - 8;
    els.pop.style.left = x + 'px'; els.pop.style.top = Math.max(8, y) + 'px';
  }
  function hideTerm() { clearTimeout(popTimer); if (els.pop) els.pop.classList.remove('on'); }

  /* ------------------------------------------------------------ misc */
  function toast(msg, ms = 2200) {
    els.toast.textContent = msg; els.toast.classList.add('on');
    clearTimeout(toast.t); toast.t = setTimeout(() => els.toast.classList.remove('on'), ms);
  }
  Guide.toast = (m) => toast(m);
  function applyTheme() {
    const t = store.data.theme || 'light';
    document.documentElement.dataset.theme = t;
    if (els.theme) els.theme.innerHTML = t === 'dark' ? ICON.sun : ICON.moon;
  }
  function toggleTheme() { store.data.theme = (store.data.theme || 'light') === 'dark' ? 'light' : 'dark'; store.save(); applyTheme(); }
  function toggleFull() {
    try { if (!document.fullscreenElement) document.documentElement.requestFullscreen(); else document.exitFullscreen(); } catch (e) { toast('Full screen is not available here.'); }
  }

  function bindGlobal() {
    document.addEventListener('keydown', (e) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) { if (e.key === 'Escape') { t.blur(); closeAll(); } return; }
      const k = e.key;
      const inPanel = t && t.closest && t.closest('.drawer.on, .modal.on');
      if (inPanel) { if (k === 'Escape') { e.preventDefault(); closeAll(); } return; }
      const arrows = k === 'ArrowRight' || k === 'ArrowLeft' || k === 'ArrowUp' || k === 'ArrowDown' || k === 'Home' || k === 'End';
      if (arrows && t && t.closest && t.closest('[role="tablist"], .seg, [role="radiogroup"], [role="listbox"], [role="slider"], [role="menu"], [data-keys]')) return;
      if (k === 'ArrowRight' || k === 'PageDown') { e.preventDefault(); step(1); }
      else if (k === 'ArrowLeft' || k === 'PageUp') { e.preventDefault(); step(-1); }
      else if (k === ']') sectionJump(1);
      else if (k === '[') sectionJump(-1);
      else if (k === 't' || k === 'T') (els.toc.classList.contains('on') ? closeAll() : openDrawer('toc'));
      else if (k === 'g' || k === 'G') (els.gloss.classList.contains('on') ? closeAll() : openDrawer('gloss'));
      else if (k === 'n' || k === 'N') { const sl = slides[cur]; if (els.notes.classList.contains('on')) closeAll(); else if (sl && sl.sec && sl.sec.notes) openDrawer('notes'); else toast('Notes are available on section steps.'); }
      else if (k === 'f' || k === 'F') toggleFull();
      else if (k === 'd' || k === 'D') toggleTheme();
      else if (k === '?') openModal();
      else if (k === 'Escape') closeAll();
      else if (k === 'Home' && e.shiftKey) go(0);
    });
    document.addEventListener('click', (e) => {
      const t = e.target.closest && e.target.closest('.t');
      if (t) { e.preventDefault(); showTerm(t); return; }
      if (!e.target.closest || !e.target.closest('.term-pop')) hideTerm();
      if (e.target.closest && e.target.closest('#canvas')) { clearTimeout(bindGlobal.ov); bindGlobal.ov = setTimeout(checkOverflow, 120); }
    });
    const fine = window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (fine) {
      document.addEventListener('mouseover', (e) => {
        const t = e.target.closest && e.target.closest('.t');
        if (!t) return;
        clearTimeout(popTimer); popTimer = setTimeout(() => showTerm(t), 280);
      });
      document.addEventListener('mouseout', (e) => {
        const t = e.target.closest && e.target.closest('.t');
        if (t && !(e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('.t') === t)) { clearTimeout(popTimer); popTimer = setTimeout(hideTerm, 220); }
      });
    }
    window.addEventListener('resize', onResize);
    if (window.ResizeObserver) new ResizeObserver(onResize).observe(els.stage);
    window.addEventListener('hashchange', () => { const i = slideIndex(location.hash.slice(1)); if (i >= 0 && i !== cur) go(i); });
  }

  /* ------------------------------------------------------------ print (PDF study guide) */
  function qAnswerHtml(q) {
    const n = normQ(q);
    const L = 'ABCDEFGH';
    if (n.type === 'mc') return `<ol type="A">${n.choices.map((c) => `<li>${c}</li>`).join('')}</ol><div class="a">Answer: ${L[n.answerIdx]}. ${n.choices[n.answerIdx]}</div>`;
    if (n.type === 'tf') return `<div class="a">Answer: ${q.answer ? 'True' : 'False'}</div>`;
    if (n.type === 'multi') return `<ol type="A">${n.choices.map((c) => `<li>${c}</li>`).join('')}</ol><div class="a">Answer: ${n.answer.map((i) => L[i]).join(', ')}</div>`;
    if (n.type === 'order') return `<div class="a">Correct order:</div><ol>${n.items.map((c) => `<li>${c}</li>`).join('')}</ol>`;
    if (n.type === 'match') return `<table>${n.pairs.map((p) => `<tr><td>${p[0]}</td><td class="a">${p[1]}</td></tr>`).join('')}</table>`;
    if (n.type === 'bucket') return `<table><tr>${n.buckets.map((b) => `<th>${b}</th>`).join('')}</tr><tr>${n.buckets.map((b, bi) => `<td>${n.items.filter((it) => it[1] === bi).map((it) => it[0]).join('<br>')}</td>`).join('')}</tr></table>`;
    if (n.type === 'num') return `<div class="a">Answer: ${n.answer}${n.unit ? ' ' + n.unit : ''}</div>`;
    return '';
  }
  function renderPrint() {
    document.documentElement.classList.add('print');
    document.body.classList.add('print');
    document.documentElement.dataset.theme = 'light';
    const doc = h('div', { class: 'print-doc' });
    const chs = sortedChapters();
    doc.append(h('div', { class: 'p-title' },
      h('div', { style: { fontSize: '12pt', fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: '#4f46e5' } }, 'Study guide'),
      h('h1', {}, 'Operating Systems'),
      h('div', { style: { fontSize: '16pt', color: '#3d4760' } }, 'Chapters 1–5: from the hardware up to concurrency'),
      h('p', { style: { marginTop: '18pt', maxWidth: '5.4in', color: '#3d4760' } }, 'This printable guide collects the notes, key terms and review questions (with answers and explanations) from the interactive guide. Use it to review after working through the simulations.'),
      h('ol', { style: { marginTop: '14pt', fontSize: '12pt' } }, chs.map((c) => h('li', {}, c.title)))));
    const toc = h('div', { class: 'p-toc' }, h('h2', {}, 'Contents'));
    const tl = h('ol', {});
    chs.forEach((c) => tl.append(h('li', {}, h('b', {}, `Chapter ${c.num}: ${c.title}`), h('ul', {}, sectionsOf(c.num).map((x) => h('li', {}, `${x.id} ${x.title}`))))));
    toc.append(tl);
    doc.append(toc);
    for (const c of chs) {
      const col = getComputedStyle(document.documentElement).getPropertyValue('--ch' + c.num).trim();
      const chd = h('div', { class: 'p-chapter', style: { '--c': col } });
      chd.append(h('h2', {}, `Chapter ${c.num} · ${c.title}`));
      if (c.tagline) chd.append(h('p', { class: 'b' }, c.tagline));
      if (c.intro) chd.append(h('div', { html: c.intro }));
      if (c.objectives) chd.append(h('div', { class: 'p-obj' }, h('b', {}, 'Learning objectives'), h('ul', {}, c.objectives.map((o) => h('li', { html: o })))));
      if (c.notes) chd.append(h('div', { html: c.notes }));
      for (const x of sectionsOf(c.num)) {
        const sd = h('div', { class: 'p-sec' });
        sd.append(h('div', { class: 'p-sec-h' }, h('span', { class: 'n' }, x.id), h('span', {}, x.title)));
        if (x.objectives) sd.append(h('div', { class: 'p-obj' }, h('b', {}, 'You should be able to'), h('ul', {}, x.objectives.map((o) => h('li', { html: o })))));
        if (x.notes) sd.append(h('div', { html: x.notes }));
        const terms = (x.terms || []).map((t) => (Array.isArray(t) ? t : [t.term, t.def]));
        if (terms.length) sd.append(h('h4', {}, 'Key terms'), h('dl', { class: 'p-terms' }, terms.map(([t, d]) => [h('dt', {}, t), h('dd', {}, d)])));
        const qs = [];
        x.steps.forEach((st) => (st.quiz || []).forEach((q) => qs.push(q)));
        if (qs.length) {
          sd.append(h('h4', {}, 'Review questions with answers'));
          qs.forEach((q, i) => sd.append(h('div', { class: 'p-q', html: `<b>${i + 1}.</b> ${q.q}${q.code ? `<pre>${esc(q.code)}</pre>` : ''}${qAnswerHtml(q)}<div class="w">${q.why}</div>` })));
        }
        chd.append(sd);
      }
      doc.append(chd);
    }
    document.body.append(h('div', { class: 'print-bar' },
      h('button', { class: 'btn primary', type: 'button', onclick: () => window.print() }, 'Print or save as PDF'),
      h('a', { class: 'btn', href: location.href.split('?')[0] }, 'Back to the interactive guide')));
    document.body.append(doc);
    document.title = 'Operating Systems Chapters 1-5 Study Guide';
  }

  /* ------------------------------------------------------------ start */
  Guide.start = function () {
    buildGlossary();
    buildSlides();
    if (/[?&]print\b/.test(location.search)) { renderPrint(); return; }
    buildFrame();
    setOverlayState();
    applyTheme();
    bindGlobal();
    fit();
    const initial = slideIndex(decodeURIComponent(location.hash.slice(1)));
    go(initial >= 0 ? initial : 0);
    if (registerErrors.length) console.error('[guide] registration errors:\n' + registerErrors.join('\n'));
  };

  /* ------------------------------------------------------------ test hooks (used by the automated checker) */
  function describe(el) {
    let d = el.tagName.toLowerCase();
    if (el.id) d += '#' + el.id;
    const cls = el.getAttribute && el.getAttribute('class');
    if (cls) d += '.' + cls.trim().split(/\s+/).slice(0, 3).join('.');
    const txt = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    return txt ? `${d} "${txt}"` : d;
  }
  Guide.debug = {
    slides: () => slides.map((x, i) => ({ i, key: x.key, type: x.type, sec: x.sec ? x.sec.id : null, step: x.i ?? null, title: x.step ? x.step.title : x.title, kind: x.step ? x.step.kind || null : null, hasQuiz: !!(x.step && x.step.quiz) })),
    go: (key) => { const i = slideIndex(key); if (i < 0) return false; go(i); return true; },
    current: () => slides[cur] && slides[cur].key,
    errors: () => renderErrors.slice(),
    registerErrors: () => registerErrors.slice(),
    metrics() {
      const body = document.querySelector('#canvas .step-body');
      if (!body) return null;
      const br = body.getBoundingClientRect();
      const cr = document.querySelector('#canvas').getBoundingClientRect();
      const sc = Guide.scale || 1;
      const res = { key: slides[cur].key, scale: +sc.toFixed(3), narrow: Guide.narrow, sh: body.scrollHeight, ch: body.clientHeight, sw: body.scrollWidth, cw: body.clientWidth, offenders: [], scrollers: [], badTerms: [], docOverflowX: document.documentElement.scrollWidth > innerWidth + 1 };
      const clipped = (el) => {
        for (let p = el.parentElement; p && p !== body; p = p.parentElement) {
          const cs = getComputedStyle(p);
          if (/(auto|scroll|hidden|clip)/.test(cs.overflowY + ' ' + cs.overflowX) || p.classList.contains('no-fit-check')) return true;
        }
        return false;
      };
      for (const el of body.querySelectorAll('*')) {
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        const sticks = Guide.narrow ? ((r.right - cr.right) > 2 || (cr.left - r.left) > 2) : ((r.bottom - br.bottom) > 2 || (r.right - br.right) > 2 || (br.left - r.left) > 2 || (br.top - r.top) > 2);
        if (res.offenders.length < 12 && sticks && !clipped(el)) {
          res.offenders.push(`${describe(el)} [bottom +${Math.round((r.bottom - br.bottom) / sc)}px, right +${Math.round((r.right - br.right) / sc)}px]`);
        }
        if (res.scrollers.length < 12 && /(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 2) res.scrollers.push(`${describe(el)} [content ${el.scrollHeight}px in ${el.clientHeight}px]`);
      }
      for (const t of body.querySelectorAll('.t')) { const k = t.dataset.t || t.textContent; if (!lookupTerm(k)) res.badTerms.push(k); }
      // content cut off inside an overflow:hidden box, or spilling out of a squeezed box (overlapping neighbours)
      res.clipped = []; res.overlap = []; res.quizClip = [];
      const SKIP = /(^|\s)(flip|flip-in|flip-face|meter|player-bar|bb-|seg|tabs-strip|reveal-body|no-fit-check)/;
      for (const el of body.querySelectorAll('*')) {
        if (el instanceof SVGElement || el.closest('svg')) continue;
        const cls = el.getAttribute('class') || '';
        if (SKIP.test(cls)) continue;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.display === 'inline' || cs.display === 'contents' || cs.visibility === 'hidden' || cs.position === 'fixed') continue;
        if (el.clientHeight === 0 && el.clientWidth === 0) continue;
        if (el.closest('.no-fit-check')) continue;
        const dy = el.scrollHeight - el.clientHeight, dx = el.scrollWidth - el.clientWidth;
        const oy = cs.overflowY, ox = cs.overflowX;
        if (el.classList.contains('quiz-q') && dy > 2) { res.quizClip.push(`${describe(el)} [${dy}px hidden]`); continue; }
        if (/(auto|scroll)/.test(oy + ' ' + ox)) continue;
        if (cs.textOverflow === 'ellipsis' || (cs.webkitLineClamp && cs.webkitLineClamp !== 'none')) continue;
        if (/(hidden|clip)/.test(oy) && dy > 3 && res.clipped.length < 8) res.clipped.push(`${describe(el)} [${dy}px cut off]`);
        else if (/(hidden|clip)/.test(ox) && dx > 3 && res.clipped.length < 8 && cs.whiteSpace !== 'nowrap') res.clipped.push(`${describe(el)} [${dx}px cut off sideways]`);
        else if (oy === 'visible' && dy > 5 && res.overlap.length < 8) {
          // only count it when real content (not an absolutely positioned decoration) sticks out of the box
          const r = el.getBoundingClientRect(); let worst = 0;
          for (const k of el.children) { const kc = getComputedStyle(k); if (kc.position === 'absolute' || kc.position === 'fixed' || kc.display === 'none') continue; worst = Math.max(worst, k.getBoundingClientRect().bottom - r.bottom); }
          if (worst > 4 * (Guide.scale || 1)) res.overlap.push(`${describe(el)} [content spills ${Math.round(worst / (Guide.scale || 1))}px below its box]`);
        }
      }
      return res;
    },
  };
})();
