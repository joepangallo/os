#!/usr/bin/env node
/* Build the single-file interactive guide.
 *
 *   node build.mjs                 → ../operating-systems-ch1-5.html (all sections) + validation report
 *   node build.mjs --section 1.3   → dev/1.3.html  (chapters + that one section, for isolated testing)
 *   node build.mjs --chapter 3     → dev/ch3.html  (chapters + every section of chapter 3)
 *   node build.mjs --check         → validate only, write nothing
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_FULL = path.resolve(HERE, '..', 'operating-systems-ch1-5.html');
const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const onlySection = opt('--section');
const onlyChapter = opt('--chapter');
const checkOnly = args.includes('--check');

const read = (p) => fs.readFileSync(path.join(HERE, p), 'utf8');
const css = read('shell/shell.css');
const shell = read('shell/shell.js');
const chapters = fs.existsSync(path.join(HERE, 'chapters.js')) ? read('chapters.js') : '';
const template = read('shell/template.html');

const secDir = path.join(HERE, 'sections');
const idOf = (f) => f.replace(/\.js$/, '');
const cmpId = (a, b) => { const [a1, a2] = a.split('.').map(Number); const [b1, b2] = b.split('.').map(Number); return a1 - b1 || a2 - b2; };
const example = args.includes('--example');
const chaptersOnly = args.includes('--chapters-only');
let files = chaptersOnly ? [] : example ? ['_example'] : fs.readdirSync(secDir).filter((f) => /^\d+\.\d+\.js$/.test(f)).map(idOf).sort(cmpId);
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
  if (/keiser/i.test(blob)) problems.push(`${id}: mentions Keiser — remove`);
  if (/\/Users\//.test(blob)) problems.push(`${id}: contains a local file path — remove`);
  if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u.test(sources[id].replace(/[✓✗✔✘☐☑★☆⚠]/g, ''))) warnings.push(`${id}: contains emoji/dingbats that may render as boxes in the PDF`);
}

/* ---------- glossary terms from sections NOT in a partial (dev) build ---------- */
function otherTerms(included) {
  if (!(onlySection || onlyChapter || chaptersOnly || example)) return [];
  const all = fs.readdirSync(secDir).filter((f) => /^\d+\.\d+\.js$/.test(f)).map(idOf).sort(cmpId);
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

/* ---------- write ---------- */
function assemble(ids) {
  const extra = otherTerms(ids);
  const extraTag = extra.length ? `<script>\nGuide.extraTerms(${JSON.stringify(extra).replace(/<\/script/gi, '<\\/script')});\n</script>` : '';
  const secTags = ids.filter((id) => sources[id]).map((id) => `<script>\n/* ======================= section ${id} ======================= */\n${sources[id]}\n</script>`).join('\n') + extraTag;
  return template
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
