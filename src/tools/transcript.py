#!/usr/bin/env python3
"""Dump the visible text of every slide (plus quiz questions, answers and explanations) to a
plain-text transcript, so a reviewer can read a whole chapter the way a student meets it.

  python3 tools/transcript.py ../operating-systems-ch1-5.html --chapter 3 > dev/transcript-ch3.txt
"""
import argparse, json, re, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

QUIZ_JS = r"""
(key) => {
  const [sid, n] = key.split('/');
  const sec = Guide.sections[sid] || null;
  if (!sec) return null;
  const st = sec.steps[(+n) - 1];
  if (!st || !st.quiz) return null;
  const strip = (s) => String(s == null ? '' : s).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  return st.quiz.map((q, i) => {
    const t = Guide.validateQuestion(q, '').type;
    let ans = '';
    if (t === 'mc') ans = strip(q.choices[q.answer]);
    else if (t === 'tf') ans = q.answer ? 'True' : 'False';
    else if (t === 'multi') ans = q.answer.map((k) => strip(q.choices[k])).join(' | ');
    else if (t === 'order') ans = q.items.map(strip).join(' → ');
    else if (t === 'match') ans = q.pairs.map((p) => strip(p[0]) + ' = ' + strip(p[1])).join('; ');
    else if (t === 'bucket') ans = q.items.map((it) => strip(it[0]) + ' → ' + strip(q.buckets[it[1]])).join('; ');
    else if (t === 'num') ans = q.answer + (q.unit ? ' ' + strip(q.unit) : '');
    const choices = q.choices ? ' [choices: ' + q.choices.map(strip).join(' | ') + ']' : '';
    return `Q${i + 1} (${t}) ${strip(q.q)}${choices}\n     ANSWER: ${ans}\n     WHY: ${strip(q.why)}`;
  }).join('\n');
}
"""

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('html')
    ap.add_argument('--chapter', action='append', default=[])
    ap.add_argument('--section', action='append', default=[])
    a = ap.parse_args()
    url = Path(a.html).resolve().as_uri()
    with sync_playwright() as p:
        try:
            b = p.chromium.launch(channel='chrome')
        except Exception:
            b = p.chromium.launch()
        pg = b.new_page(viewport={'width': 1440, 'height': 900})
        pg.goto(url + '#home')
        pg.wait_for_function('window.Guide && Guide.debug')
        slides = pg.evaluate('Guide.debug.slides()')
        out = []
        for s in slides:
            sec = s['sec'] or ''
            chap = sec.split('.')[0] if sec and not sec.startswith('ch') else (sec[2:] if sec.startswith('ch') else (s['key'][2:3] if s['key'].startswith('ch') else ''))
            if a.section and sec not in a.section: continue
            if a.chapter and chap not in a.chapter: continue
            if s['type'] in ('terms', 'chquiz', 'final', 'home'): continue
            pg.evaluate('k => Guide.debug.go(k)', s['key'])
            pg.wait_for_timeout(250)
            text = pg.evaluate("() => { const c = document.querySelector('#canvas'); return c ? c.innerText : '' }")
            text = re.sub(r'\n{3,}', '\n\n', text).strip()
            out.append(f"\n==================== [{s['key']}] {s['title']} ({s.get('kind') or s['type']}) ====================\n{text}")
            if s.get('hasQuiz'):
                out.append('---- full quiz data ----\n' + (pg.evaluate(QUIZ_JS, s['key']) or ''))
        # glossary for the requested scope
        gl = pg.evaluate("() => Guide.glossary.map(g => ({term: g.term, def: g.def, src: g.src}))")
        ids = {s['sec'] for s in slides if s['sec']}
        keep = [g for g in gl if (not a.chapter or g['src'].split('.')[0] in a.chapter or g['src'] in ['ch' + c for c in a.chapter]) and (not a.section or g['src'] in a.section)]
        out.append('\n==================== GLOSSARY (first definition wins) ====================')
        out += [f"- {g['term']} [{g['src']}]: {g['def']}" for g in keep]
        b.close()
    sys.stdout.write('\n'.join(out) + '\n')

if __name__ == '__main__':
    main()
