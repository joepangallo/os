#!/usr/bin/env node
/* Cross-section consistency report.
 *   node tools/glossary_report.mjs            → duplicate/conflicting glossary terms, per-section stats
 * Duplicates are not errors (the first definition in book order wins in the glossary),
 * but two sections defining the same term differently can confuse students. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stubEl = () => ({ style: {}, dataset: {}, appendChild() {}, append() {}, setAttribute() {}, classList: { add() {}, remove() {}, toggle() {} } });
const box = { console: { log() {}, warn() {}, error() {} }, setTimeout, clearTimeout, document: { createElement: stubEl, createElementNS: stubEl, head: stubEl() } };
box.window = box;
vm.createContext(box);
vm.runInContext(fs.readFileSync(path.join(HERE, 'shell/shell.js'), 'utf8'), box);
vm.runInContext(fs.readFileSync(path.join(HERE, 'chapters.js'), 'utf8'), box);
const ids = fs.readdirSync(path.join(HERE, 'sections')).filter((f) => /^\d+\.\d+\.js$/.test(f)).map((f) => f.slice(0, -3))
  .sort((a, b) => { const [a1, a2] = a.split('.').map(Number); const [b1, b2] = b.split('.').map(Number); return a1 - b1 || a2 - b2; });
for (const id of ids) { try { vm.runInContext(fs.readFileSync(path.join(HERE, 'sections', id + '.js'), 'utf8'), box); } catch (e) { console.log(`! ${id} failed to load: ${e.message}`); } }
const G = box.Guide;
const norm = (t) => String(t).toLowerCase().replace(/\s*\([^)]*\)\s*/g, ' ').replace(/[^a-z0-9/ ]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/s$/, '');
const map = new Map();
for (const c of G.chapters) (c.terms || []).forEach(([t, d]) => (map.get(norm(t)) || map.set(norm(t), []).get(norm(t))).push({ src: 'ch' + c.num, t, d }));
for (const id of ids) {
  const sec = G.sections[id]; if (!sec) continue;
  (sec.terms || []).forEach((x) => { const [t, d] = Array.isArray(x) ? x : [x.term, x.def]; (map.get(norm(t)) || map.set(norm(t), []).get(norm(t))).push({ src: id, t, d }); });
}
const dups = [...map.entries()].filter(([, v]) => v.length > 1).sort((a, b) => b[1].length - a[1].length);
console.log(`${ids.length} sections, ${map.size} distinct terms, ${dups.length} terms defined in more than one place\n`);
for (const [k, v] of dups) {
  console.log(`• ${k}  (${v.map((x) => x.src).join(', ')})`);
  v.forEach((x) => console.log(`    [${x.src}] ${x.t}: ${x.d}`));
}
