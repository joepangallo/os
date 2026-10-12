#!/usr/bin/env node
/* Build the single-file interactive guide. The guide comes in three volumes ("books"): chapters 1-5,
 * chapters 6-9 and chapters 10-13. All of them share the shell; each has its own chapters file and output page.
 *
 *   node build.mjs                 → ../operating-systems-ch1-5.html (all sections) + validation report
 *   node build.mjs --book 6-9      → ../operating-systems-ch6-9.html
 *   node build.mjs --book 10-13    → ../operating-systems-ch10-13.html
 *   node build.mjs --section 1.3   → dev/1.3.html  (chapters + that one section, for isolated testing)
 *   node build.mjs --chapter 3     → dev/ch3.html  (chapters + every section of chapter 3)
 *   node build.mjs --check         → validate only, write nothing
 * --section and --chapter pick the book that holds that chapter, so --section 7.2 builds against chapters 6-9
 * and --section 11.10 against chapters 10-13. Chapter numbers are always compared as whole numbers (the part
 * of an id before the dot), never as text prefixes, so chapter 1 is never mixed up with chapters 10-13.
 * A later book may be built before its chapters file exists: its sections then appear under stand-in chapter
 * headings and the report warns about the missing file.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0].replace(/^#!.*\n\/\*/, '').replace(/^ \* ?/gm, '')); process.exit(0); } // --help prints the usage notes at the top of this file and stops, instead of quietly running the default (chapters 1-5) build
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const onlySection = opt('--section');
const rawChapter = opt('--chapter'); // the chapter number typed after --chapter, if any
const onlyChapter = rawChapter && /^\d+$/.test(rawChapter) ? String(Number(rawChapter)) : rawChapter; // written as a plain whole number ("010" becomes "10") so it matches the part of a section id before the dot
const checkOnly = args.includes('--check');

/* Each book: which chapters it holds, where its chapter data lives, where the page is written, and the
 * page-level wording the shell shows (sent to the page as window.GuideBook). Earlier books lend their
 * glossary to later ones ("prior" terms), so a chapter 6 step can underline "semaphore" and a chapter 10 step
 * can underline any term taught in chapters 1-9. "prior" lists the lending books oldest first; the build also
 * sends the page a "priors" list (each earlier book's id, range, chapters and any display labels) so the page
 * can name the right earlier volume for every borrowed term. */
const BOOKS = {
  '1-5': {
    chapters: [1, 2, 3, 4, 5], chaptersFile: 'chapters.js', out: 'operating-systems-ch1-5.html', prior: [],
    meta: { id: '1-5', range: '1–5', storeKey: 'os-guide-v1', countWord: 'five', subtitle: 'Chapters 1–5: from the hardware up to concurrency' },
  },
  '6-9': {
    chapters: [6, 7, 8, 9], chaptersFile: 'chapters-6-9.js', out: 'operating-systems-ch6-9.html', prior: ['1-5'],
    meta: { id: '6-9', range: '6–9', storeKey: 'os-guide-ch6-9-v1', countWord: 'four', subtitle: 'Chapters 6–9: deadlock, memory, virtual memory and scheduling', prior: '1–5',
      description: 'Interactive guide to operating systems chapters 6-9: concurrency with deadlock and starvation, memory management, virtual memory, and uniprocessor scheduling.' },
  },
  // the third volume: chapters 10-13, which may underline glossary terms taught in both earlier volumes
  '10-13': {
    chapters: [10, 11, 12, 13], chaptersFile: 'chapters-10-13.js', out: 'operating-systems-ch10-13.html', prior: ['1-5', '6-9'], // its chapters, chapter data file, output page, and the two volumes that lend it their glossary
    meta: { id: '10-13', range: '10–13', storeKey: 'os-guide-ch10-13-v1', countWord: 'four', subtitle: 'Chapters 10–13: multiprocessor and real-time scheduling, I/O and disk scheduling, file management and embedded systems', prior: '1–9', // page wording; saved progress lives under its own name, apart from both earlier volumes
      description: 'Interactive guide to operating systems chapters 10-13: multiprocessor, multicore and real-time scheduling, I/O management and disk scheduling, file management, and embedded operating systems.' }, // the search-engine description of the chapters 10-13 page
  },
};
const bookOfChapter = (n) => Object.keys(BOOKS).find((k) => BOOKS[k].chapters.includes(Number(n)));
const askedChapter = onlySection ? onlySection.split('.')[0] : onlyChapter; // the chapter a --section or --chapter build is about ("11.10" gives "11", never "1")
if (askedChapter && !opt('--book') && !bookOfChapter(askedChapter)) { console.error(`No book holds chapter ${askedChapter}. Books: ${Object.keys(BOOKS).map((k) => `${k} (chapters ${BOOKS[k].chapters.join(', ')})`).join('; ')}`); process.exit(2); } // stop instead of quietly building against chapters 1-5
const bookId = opt('--book') || (askedChapter ? bookOfChapter(askedChapter) : null) || '1-5'; // --book wins; otherwise the book that holds the asked chapter; otherwise chapters 1-5
const BOOK = BOOKS[bookId];
if (!BOOK) { console.error(`Unknown book "${bookId}". Known: ${Object.keys(BOOKS).join(', ')}`); process.exit(2); }
const OUT_FULL = path.resolve(HERE, '..', BOOK.out);
const inBook = (id) => BOOK.chapters.includes(Number(String(id).split('.')[0]));

const read = (p) => fs.readFileSync(path.join(HERE, p), 'utf8');
const css = read('shell/shell.css');
const shell = read('shell/shell.js');
const chapters = fs.existsSync(path.join(HERE, BOOK.chaptersFile)) ? read(BOOK.chaptersFile) : '';
const template = read('shell/template.html');

const secDir = path.join(HERE, 'sections');
const idOf = (f) => f.replace(/\.js$/, '');
const cmpId = (a, b) => { const [a1, a2] = a.split('.').map(Number); const [b1, b2] = b.split('.').map(Number); return a1 - b1 || a2 - b2; };
const example = args.includes('--example');
const chaptersOnly = args.includes('--chapters-only');
let files = chaptersOnly ? [] : example ? ['_example'] : fs.readdirSync(secDir).filter((f) => /^\d+\.\d+\.js$/.test(f)).map(idOf).filter(inBook).sort(cmpId);
if (onlySection) files = files.filter((id) => id === onlySection);
if (onlyChapter) files = files.filter((id) => id.split('.')[0] === String(onlyChapter));
if (onlySection && !files.length) { console.error(`No section file sections/${onlySection}.js`); process.exit(2); }

/* ---------- validate by executing everything in a sandbox with a stub DOM ---------- */
function sandbox() {
  const stubEl = () => ({ style: {}, dataset: {}, appendChild() {}, append() {}, setAttribute() {}, classList: { add() {}, remove() {}, toggle() {} } });
  const ctx = {
    console: { log() {}, warn() {}, error() {} },
    setTimeout, clearTimeout, setInterval, clearInterval,
    document: { createElement: stubEl, createElementNS: stubEl, head: stubEl(), body: stubEl(), documentElement: stubEl() },
    navigator: { userAgent: 'node' },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  return ctx;
}
const box = sandbox();
const problems = [];
const warnings = [];
if (!chapters && !example) warnings.push(`${BOOK.chaptersFile} not found: the sections of chapters ${BOOK.meta.range} appear under stand-in chapter headings until it is written`); // a later volume may be built before its chapter data exists
try { vm.runInContext(shell, box, { filename: 'shell.js' }); } catch (e) { console.error('shell.js failed to load:', e); process.exit(1); }
try { if (chapters) vm.runInContext(chapters, box, { filename: 'chapters.js' }); } catch (e) { problems.push(`chapters.js: ${e.message}`); }
const G = box.Guide;
const sources = {};
for (const id of files) {
  let code = fs.readFileSync(path.join(secDir, id + '.js'), 'utf8');
  if (/<!--/.test(code)) warnings.push(`${id}: contains "<!--" — avoid HTML comments inside section JS`);
  code = code.replace(/<\/script/gi, '<\\/script');
  sources[id] = code;
  const before = Object.keys(G.sections).length;
  try { vm.runInContext(code, box, { filename: `sections/${id}.js` }); } catch (e) { problems.push(`${id}: threw while loading → ${e.message}`); continue; }
  const sec = G.sections[example ? '1.9' : id];
  if (!sec) { problems.push(`${id}: file did not call Guide.section({ id: '${id}', ... })`); continue; }
  if (example) G.sections._example = sec;
  if (Object.keys(G.sections).length !== before + 1) warnings.push(`${id}: registered more than one section`);
}
problems.push(...G.debug.registerErrors());

/* ---------- per-section report ---------- */
const report = [];
for (const id of files) {
  const sec = G.sections[id];
  if (!sec) continue;
  const kinds = sec.steps.map((st) => st.kind || 'learn');
  const quizQs = sec.steps.reduce((n, st) => n + (st.quiz ? st.quiz.length : 0), 0);
  const qTypes = new Set(); sec.steps.forEach((st) => (st.quiz || []).forEach((q) => qTypes.add(G.validateQuestion(q, '').type)));
  const interactive = sec.steps.filter((st) => typeof st.render === 'function').length;
  report.push({ id, title: sec.title, steps: sec.steps.length, interactive, quizQs, qTypes: [...qTypes].join(','), terms: (sec.terms || []).length, notesKB: +((sec.notes || '').length / 1024).toFixed(1), kinds: kinds.join(' ') });
  if (!sec.notes || sec.notes.length < 1500) warnings.push(`${id}: notes are missing or thin (${(sec.notes || '').length} chars)`);
  if (!sec.terms || sec.terms.length < 4) warnings.push(`${id}: fewer than 4 key terms`);
  if (quizQs < 6) warnings.push(`${id}: only ${quizQs} quiz questions (want >= 6)`);
  if (interactive < 2) warnings.push(`${id}: only ${interactive} steps with render() (want >= 2 genuinely interactive steps)`);
  if (!sec.summary) warnings.push(`${id}: missing summary`);
  if (!sec.objectives || !sec.objectives.length) warnings.push(`${id}: missing objectives`);
  const blob = JSON.stringify(sec, (k, v) => (typeof v === 'function' ? String(v) : v)) + sources[id];
  if (new RegExp('kei' + 'ser', 'i').test(blob)) problems.push(`${id}: mentions the institution name — remove`);
  if (/\/Users\//.test(blob)) problems.push(`${id}: contains a local file path — remove`);
  if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u.test(sources[id].replace(/[✓✗✔✘☐☑★☆⚠]/g, ''))) warnings.push(`${id}: contains emoji/dingbats that may render as boxes in the PDF`);
}

/* ---------- glossary terms from sections NOT in a partial (dev) build ---------- */
function otherTerms(included) {
  if (!(onlySection || onlyChapter || chaptersOnly || example)) return [];
  const all = fs.readdirSync(secDir).filter((f) => /^\d+\.\d+\.js$/.test(f)).map(idOf).filter(inBook).sort(cmpId);
  const box2 = sandbox();
  try { vm.runInContext(shell, box2, { filename: 'shell.js' }); } catch (e) { return []; }
  const out = [];
  for (const id of all) {
    if (included.includes(id)) continue;
    try { vm.runInContext(fs.readFileSync(path.join(secDir, id + '.js'), 'utf8'), box2, { filename: id }); } catch (e) { continue; }
    const sec = box2.Guide.sections[id];
    (sec && sec.terms || []).forEach((t) => { const [a, b] = Array.isArray(t) ? t : [t.term, t.def]; if (a && b) out.push([a, b, id]); });
  }
  return out;
}

/* ---------- glossary terms taught in earlier books (chapters 1-5 for the chapters 6-9 page; chapters 1-5 and
 * 6-9 for the chapters 10-13 page). Returns the [term, definition, where] entries with the NEWEST earlier book
 * first: when two earlier books define the same word, the later one supplies the definition, exactly as that later
 * book's own page shows it (on the chapters 6-9 page, its own "deadlock" beats the chapters 1-5 one, so the chapters
 * 10-13 page borrows that same wording). Within one book, sections come in chapter and section order, then the
 * chapter-level terms, the same order that book's own page uses. Also returns a short description of each earlier
 * book (oldest first) for the page: its id, range, chapter numbers and any section display labels (an appendix
 * stored as "7.5" but shown as "7A"), so the page can say which volume taught a term and where. */
function priorTerms() {
  const perBook = []; // one list of [term, definition, where] entries per earlier book, oldest book first
  const books = []; // one { id, range, chapters, labels? } record per earlier book, sent to the page as GuideBook.priors
  for (const pid of BOOK.prior) {
    const out = []; // this book's entries
    const pb = BOOKS[pid];
    const box3 = sandbox();
    try { vm.runInContext(shell, box3, { filename: 'shell.js' }); vm.runInContext(read(pb.chaptersFile), box3, { filename: pb.chaptersFile }); } catch (e) { problems.push(`prior book ${pid}: ${e.message}`); continue; }
    const ids = fs.readdirSync(secDir).filter((f) => /^\d+\.\d+\.js$/.test(f)).map(idOf).filter((id) => pb.chapters.includes(Number(id.split('.')[0]))).sort(cmpId);
    for (const id of ids) { try { vm.runInContext(fs.readFileSync(path.join(secDir, id + '.js'), 'utf8'), box3, { filename: id }); } catch (e) { continue; } }
    const push = (list, src) => (list || []).forEach((t) => { const [a, b] = Array.isArray(t) ? t : [t.term, t.def]; if (a && b) out.push([a, b, src]); });
    ids.forEach((id) => { const sec = box3.Guide.sections[id]; if (sec) push(sec.terms, id); });
    box3.Guide.chapters.forEach((c) => push(c.terms, 'ch' + c.num));
    const labels = {}; // section id -> the number that book shows for it, only where the two differ
    ids.forEach((id) => { const sec = box3.Guide.sections[id]; if (sec && sec.label && String(sec.label) !== id) labels[id] = String(sec.label); }); // e.g. '7.5' -> '7A'
    books.push(Object.assign({ id: pid, range: pb.meta.range, chapters: pb.chapters.slice() }, Object.keys(labels).length ? { labels } : {})); // the description the page uses to name this volume
    perBook.push(out); // keeps this book's entries apart until every book is read
  }
  return { terms: perBook.slice().reverse().flat(), books }; // the borrowed terms (newest earlier book first, see above), and the earlier books they came from
}

/* ---------- write ---------- */
function assemble(ids) {
  const extra = otherTerms(ids);
  const { terms: prior, books: priorBooks } = priorTerms(); // the borrowed glossary terms, and the earlier volumes that lend them
  const priorNames = BOOK.prior.map((pid) => `Chapters ${BOOKS[pid].meta.range}`); // how each earlier volume is named on the page, oldest first, e.g. "Chapters 1–5"
  const priorPhrase = priorNames.length > 1 ? `${priorNames.slice(0, -1).join(', ')} and ${priorNames[priorNames.length - 1]} guides` : `${priorNames[0]} guide`; // "Chapters 1–5 guide" for one earlier volume, "Chapters 1–5 and Chapters 6–9 guides" for two
  const priorTag = prior.length ? `\n<script> // glossary terms taught in the ${priorPhrase}, so words from those chapters still show a definition on this page\nGuide.priorTerms(${JSON.stringify(prior).replace(/<\/script/gi, '<\\/script')}); // hands those [term, definition, where it was taught] entries to the guide; this page's own definitions always win\n</script> <!-- end of the earlier-volume glossary terms -->` : ''; // the script that hands the borrowed terms to the page (nothing for a volume with no earlier volumes)
  const extraTag = extra.length ? `<script> // glossary terms from sections left out of this partial build, so term links still work\nGuide.extraTerms(${JSON.stringify(extra).replace(/<\/script/gi, '<\\/script')}); // hands those [term, definition, section] entries to the guide\n</script> <!-- end of the extra glossary terms -->` : '';
  // explicit layout metadata: a section whose code anywhere (including helper functions) branches on the
  // phone layout must be rebuilt when the window crosses the phone breakpoint
  const layoutTag = (id) => (/\bnarrow\b/.test(sources[id]) ? `\nif (Guide.sections['${id}']) Guide.sections['${id}'].layoutAware = true; // this section lays out differently on phone-width screens, so the guide redraws it when the window crosses that width` : '');
  const secTags = ids.filter((id) => sources[id]).map((id) => `<script> // section ${id} starts here: its steps, quizzes and notes, registered with the guide\n/* ======================= section ${id} ======================= */\n${sources[id]}${layoutTag(id)}\n</script> <!-- end of section ${id} -->`).join('\n') + extraTag
    + priorTag
    + (/\bnarrow\b/.test(chapters) ? '\n<script>Guide.chapters.forEach((c) => { c.layoutAware = true; }); /* chapter pages also lay out differently on phone-width screens, so redraw them when the window crosses that width */</script>' : '');
  // the chapters 1-5 page keeps the template exactly as written; a later book swaps in its own title,
  // description and volume settings (read by the shell before it loads saved progress)
  let page = template;
  if (bookId !== '1-5') {
    const m = BOOK.meta;
    const settings = Object.assign({}, m, priorBooks.length ? { priors: priorBooks } : {}); // the volume settings sent to the page: the book's wording plus, for a later volume, the list of earlier volumes it borrows terms from
    page = page
      .replace(/<title>[^<]*<\/title>/, () => `<title>Operating Systems · Chapters ${m.range} · Interactive Guide</title>`)
      .replace(/(<meta name="description" content=")[^"]*(")/, (_, a, b) => a + m.description.replace(/"/g, '&quot;') + b)
      .replace(/<script> \/\/ the guide's engine starts/, (x) => `<script> // settings for this volume of the guide (chapters ${m.range}): read by the engine below\nwindow.GuideBook = ${JSON.stringify(settings).replace(/<\/script/gi, '<\\/script')}; // the chapter range, page wording, the earlier volumes whose glossary terms this page borrows, and the name this volume's saved progress is stored under (separate from every other volume)\n</script> <!-- end of the volume settings -->\n` + x); // the settings script goes just before the engine, which reads it first
  }
  return page
    .replace('/*__CSS__*/', () => css)
    .replace('/*__SHELL__*/', () => shell.replace(/<\/script/gi, '<\\/script'))
    .replace('/*__CHAPTERS__*/', () => chapters.replace(/<\/script/gi, '<\\/script'))
    .replace('/*__SECTIONS__*/', () => secTags);
}
function writeAtomic(p, text) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = p + '.tmp-' + process.pid;
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, p);
}
let out = null;
if (!checkOnly) {
  if (chaptersOnly) out = path.join(HERE, 'dev', 'chapters.html');
  else if (example) out = path.join(HERE, 'dev', '_example.html');
  else if (onlySection) out = path.join(HERE, 'dev', onlySection + '.html');
  else if (onlyChapter) out = path.join(HERE, 'dev', 'ch' + onlyChapter + '.html');
  else out = OUT_FULL;
  writeAtomic(out, assemble(files));
}

console.log(`\nSections built: ${files.length}${out ? `  →  ${out}  (${(fs.statSync(out).size / 1024).toFixed(0)} KB)` : ''}`);
if (report.length) console.table(report);
if (warnings.length) { console.log('\nWARNINGS'); warnings.forEach((w) => console.log('  - ' + w)); }
if (problems.length) { console.log('\nPROBLEMS (must fix)'); problems.forEach((p) => console.log('  ✗ ' + p)); process.exitCode = 1; }
else console.log('\nNo blocking problems.');
