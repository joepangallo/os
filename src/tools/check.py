#!/usr/bin/env python3
"""Automated browser check for the interactive guide.

Usage examples
  python3 tools/check.py dev/1.3.html --section 1.3            # every step of 1.3 at 1280x720 + phone, screenshots
  python3 tools/check.py dev/1.3.html --section 1.3 --fuzz     # also clicks every control in every step
  python3 tools/check.py ../operating-systems-ch1-5.html --all --vp 1280x720 --no-shots
  python3 tools/check.py ../operating-systems-ch1-5.html --keys home,ch1,ch1-terms,ch1-quiz,final

What it reports for every slide and viewport
  * JavaScript errors (page errors, console.error, render errors caught by the shell)
  * [fit] overflow: content taller/wider than the 1152 x 540 step body (a failure: nothing may scroll)
  * offenders: elements that stick out of the step body
  * scrollers: internal scroll areas whose content is larger than the box (warning)
  * badTerms: <span class="t"> words that have no glossary definition
Screenshots go to shots/<section>/<step>-<viewport>[-after].png (read them to eyeball layout).
Exit code 1 when any error or overflow is found.
"""
import argparse, json, os, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent.parent

FUZZ_JS = r"""
async (maxClicks) => {
  const body = document.querySelector('#canvas .step-body');
  if (!body) return 0;
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  let n = 0;
  // ranges: sweep min → max → middle
  for (const r of body.querySelectorAll('input[type=range]')) {
    for (const v of [r.min || 0, r.max || 100, ((+r.min || 0) + (+r.max || 100)) / 2]) {
      r.value = v; r.dispatchEvent(new Event('input', { bubbles: true })); r.dispatchEvent(new Event('change', { bubbles: true })); await sleep(40);
    }
  }
  for (const s of body.querySelectorAll('select')) {
    if (s.options.length > 1) { s.selectedIndex = s.options.length - 1; s.dispatchEvent(new Event('change', { bubbles: true })); await sleep(30); }
  }
  for (const i of body.querySelectorAll('input[type=text],input[type=number],input:not([type])')) {
    i.value = '1'; i.dispatchEvent(new Event('input', { bubbles: true })); await sleep(20);
  }
  const seen = new Set();
  for (let pass = 0; pass < 2 && n < maxClicks; pass++) {
    const cands = [...body.querySelectorAll('button, [role=button], .qopt, [data-click], .clickable, svg [onclick], svg .hot')];
    for (const el of cands) {
      if (n >= maxClicks) break;
      if (!el.isConnected || el.disabled) continue;
      const key = el.outerHTML.slice(0, 160) + pass;
      if (seen.has(key)) continue; seen.add(key);
      const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
      try {
        el.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
        if (el instanceof SVGElement || typeof el.click !== 'function') el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        else el.click();
        el.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
      } catch (e) {}
      n++; await sleep(70);
    }
  }
  return n;
}
"""

# smallest rendered text on screen (SVG text scaled by its drawing, HTML text by the canvas zoom), in screen pixels
TINY_TEXT_JS = r"""
(minPx) => {
  const body = document.querySelector('#canvas .step-body'); if (!body) return [];
  const sc = Guide.scale || 1, out = [];
  const seen = (el) => { const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  for (const t of body.querySelectorAll('svg text')) {
    if (!t.textContent.trim() || !seen(t) || t.closest('.flip-face.back')) continue;
    const m = t.getScreenCTM(); if (!m) continue;
    const px = parseFloat(getComputedStyle(t).fontSize) * Math.hypot(m.a, m.b);
    if (px < minPx) out.push([+px.toFixed(1), 'svg "' + t.textContent.trim().slice(0, 30) + '"']);
  }
  const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement; if (!el || !n.textContent.trim() || el.closest('svg') || el.closest('.flip-face.back') || !seen(el)) continue;
    const px = parseFloat(getComputedStyle(el).fontSize) * sc;
    if (px < minPx) out.push([+px.toFixed(1), el.tagName.toLowerCase() + ' "' + n.textContent.trim().slice(0, 30) + '"']);
  }
  out.sort((a, b) => a[0] - b[0]);
  return out.slice(0, 6).map(([px, d]) => px + 'px ' + d);
}
"""

# boxes whose own text runs past their bottom edge (the geometry checks only compare child ELEMENTS, so a
# fixed-height box holding plain text that overflows is invisible to them)
TEXT_SPILL_JS = r"""
() => {
  const body = document.querySelector('#canvas .step-body'); if (!body) return [];
  const out = [], sc = Guide.scale || 1;
  for (const el of body.querySelectorAll('*')) {
    if (el.closest('svg') || el.closest('.no-fit-check') || el.closest('.flip')) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.display === 'inline' || cs.display === 'contents' || cs.visibility === 'hidden') continue;
    if (!/visible/.test(cs.overflowY) || el.clientHeight === 0) continue;
    const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!hasText) continue;
    const r = document.createRange(); r.selectNodeContents(el);
    const rects = [...r.getClientRects()]; if (!rects.length) continue;
    const bottom = Math.max(...rects.map((x) => x.bottom)), box = el.getBoundingClientRect();
    const spill = (bottom - box.bottom) / sc;
    if (spill > 4) out.push(`${el.tagName.toLowerCase()}.${(el.getAttribute('class') || '').split(' ')[0]} "${el.textContent.trim().slice(0, 30)}" [text spills ${Math.round(spill)}px below its box]`);
    if (out.length >= 6) break;
  }
  return out;
}
"""

# inside one tab: the same fuzzer, but it leaves the tab buttons alone so the open panel is not replaced mid-walk
FUZZ_IN_TAB_JS = FUZZ_JS.replace("'button, [role=button], .qopt, [data-click], .clickable, svg [onclick], svg .hot')]", "'button, [role=button], .qopt, [data-click], .clickable, svg [onclick], svg .hot')].filter(el => !el.closest('[role=tablist]'))")
assert FUZZ_IN_TAB_JS != FUZZ_JS

PLAYER_WALK_JS = r"""
async () => {
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const body = document.querySelector('#canvas .step-body');
  if (!body) return [];
  const bad = [];
  const players = [...body.querySelectorAll('.player')];
  for (let pi = 0; pi < players.length; pi++) {
    const pl = players[pi];
    if (!pl.isConnected) continue;
    const reset = pl.querySelector('button[aria-label="Restart"]');
    if (reset && !reset.disabled) { reset.click(); await sleep(80); }
    for (let f = 0; f < 90; f++) {
      const m = Guide.debug.metrics();
      const over = m && !m.narrow && (m.sh > m.ch + 2 || m.sw > m.cw + 2);
      const probs = [].concat(over ? [`overflow ${m.sw}x${m.sh}`] : [], (m && m.offenders) || [], (m && m.clipped) || [], (m && m.overlap) || [], (m && m.quizClip) || []);
      if (probs.length && bad.length < 6) bad.push(`player ${pi + 1} frame ${f + 1}: ${probs.slice(0, 3).join(' | ')}`);
      const next = pl.querySelector('button[aria-label="Next step"]');
      if (!next || next.disabled || !pl.isConnected) break;
      next.click(); await sleep(70);
    }
  }
  return bad;
}
"""

def parse_vp(s):
    w, h = s.lower().split('x'); return int(w), int(h)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('html')
    ap.add_argument('--section', action='append', default=[])
    ap.add_argument('--chapter', action='append', default=[])
    ap.add_argument('--keys', default='')
    ap.add_argument('--all', action='store_true')
    ap.add_argument('--vp', default='1280x720,390x844')
    ap.add_argument('--fuzz', action='store_true')
    ap.add_argument('--text-spill', action='store_true', help='also fail boxes whose own text runs past their bottom edge')
    ap.add_argument('--min-text', type=float, default=0, help='fail a slide whose smallest visible text renders below this many screen pixels (e.g. 9)')
    ap.add_argument('--tabs', action='store_true', help='with --fuzz: also open every tab of every tab strip, fuzz inside it and check it')
    ap.add_argument('--max-clicks', type=int, default=45)
    ap.add_argument('--no-shots', action='store_true')
    ap.add_argument('--shots', default=str(HERE / 'shots'))
    ap.add_argument('--json', default='')
    ap.add_argument('--dark', action='store_true', help='also run in dark mode')
    a = ap.parse_args()

    html = Path(a.html)
    if not html.is_absolute(): html = (Path.cwd() / html).resolve()
    url = html.as_uri()
    vps = [parse_vp(v) for v in a.vp.split(',') if v]
    results, fails = [], 0

    with sync_playwright() as p:
        try:
            browser = p.chromium.launch(channel='chrome')
        except Exception:
            browser = p.chromium.launch()
        for theme in (['light', 'dark'] if a.dark else ['light']):
            for (w, h) in vps:
                ctx = browser.new_context(viewport={'width': w, 'height': h}, device_scale_factor=1)
                page = ctx.new_page()
                logs = []
                page.on('console', lambda m: logs.append((m.type, m.text)))
                page.on('pageerror', lambda e: logs.append(('pageerror', str(e))))
                page.add_init_script(f"try{{['os-guide-v1','os-guide-ch6-9-v1'].forEach(k => localStorage.setItem(k, JSON.stringify({{theme:'{theme}'}})))}}catch(e){{}}")
                page.goto(url + '#home')
                page.wait_for_function('window.Guide && Guide.debug && document.querySelector("#canvas")', timeout=15000)
                slides = page.evaluate('Guide.debug.slides()')
                want = []
                for s in slides:
                    if a.all: want.append(s)
                    elif s['sec'] and (s['sec'] in a.section or s['sec'].split('.')[0] in a.chapter or (s['sec'].startswith('ch') and s['sec'][2:] in a.chapter)): want.append(s)
                    elif s['key'] in [k for k in a.keys.split(',') if k]: want.append(s)
                if not want:
                    print('No matching slides. Available sections:', sorted({s['sec'] for s in slides if s['sec']}))
                    sys.exit(2)
                for s in want:
                    logs.clear()
                    page.evaluate('k => Guide.debug.go(k)', s['key'])
                    page.wait_for_timeout(450)
                    m = page.evaluate('Guide.debug.metrics()') or {}
                    tiny = page.evaluate(TINY_TEXT_JS, a.min_text) if a.min_text else []
                    spills = page.evaluate(TEXT_SPILL_JS) if a.text_spill else []
                    shot_dir = Path(a.shots) / (s['sec'] or s['key']).replace('/', '_')
                    tag = f"{(s['step'] or 0) + 1:02d}-{w}x{h}{'-dark' if theme == 'dark' else ''}"
                    if not a.no_shots:
                        shot_dir.mkdir(parents=True, exist_ok=True)
                        page.screenshot(path=str(shot_dir / f'{tag}.png'))
                    after = None
                    clicks = 0
                    tab_metrics = []
                    if a.fuzz and s['type'] in ('home', 'chapter'):
                        pass  # these slides only hold navigation buttons
                    elif a.fuzz:
                        try:
                            clicks = page.evaluate(FUZZ_JS, a.max_clicks)
                        except Exception as e:
                            logs.append(('fuzzerror', str(e)))
                        page.wait_for_timeout(1300)
                        after = page.evaluate('Guide.debug.metrics()') or {}
                        try:
                            walk = page.evaluate(PLAYER_WALK_JS)
                        except Exception as e:
                            walk = [f'player walk error: {e}']
                        after['walk'] = walk
                        if not a.no_shots:
                            page.screenshot(path=str(shot_dir / f'{tag}-after.png'))
                        if a.tabs:
                            # the plain fuzzer mostly misses controls inside tabs (opening a tab replaces the panel it was
                            # walking), so open each tab in turn, fuzz inside it, and measure it on its own
                            counts = page.evaluate("[...document.querySelectorAll('#canvas .step-body [role=tablist]')].map(t => t.querySelectorAll('[role=tab]').length)")
                            for ti, n in enumerate(counts):
                                for k in range(n):
                                    hit = page.evaluate("([ti, k]) => { const t = document.querySelectorAll('#canvas .step-body [role=tablist]')[ti]; const b = t && t.querySelectorAll('[role=tab]')[k]; if (!b) return false; b.click(); return true; }", [ti, k])
                                    if not hit: continue
                                    page.wait_for_timeout(200)
                                    try:
                                        clicks += page.evaluate(FUZZ_IN_TAB_JS, a.max_clicks)
                                    except Exception as e:
                                        logs.append(('fuzzerror', str(e)))
                                    page.wait_for_timeout(700)
                                    tab_metrics.append((f' (tab {ti + 1}.{k + 1})', page.evaluate('Guide.debug.metrics()') or {}))
                                    if a.min_text: tiny += [f'(tab {ti + 1}.{k + 1}) ' + x for x in page.evaluate(TINY_TEXT_JS, a.min_text)]
                                    if a.text_spill: spills += [f'(tab {ti + 1}.{k + 1}) ' + x for x in page.evaluate(TEXT_SPILL_JS)]
                                    if not a.no_shots:
                                        page.screenshot(path=str(shot_dir / f'{tag}-tab{ti + 1}-{k + 1}.png'))
                        # navigate away and back to prove cleanup works (only errors from this count)
                        n_before = len(logs)
                        page.keyboard.press('ArrowRight'); page.wait_for_timeout(120); page.keyboard.press('ArrowLeft'); page.wait_for_timeout(250)
                        logs[:] = logs[:n_before] + [(t, x) for (t, x) in logs[n_before:] if t in ('pageerror',)]
                    rerr = [e for e in page.evaluate('Guide.debug.errors()') if e['key'] == s['key']]
                    errs = [f'{t}: {x}' for (t, x) in logs if t in ('error', 'pageerror', 'fuzzerror')]
                    fit = [x for (t, x) in logs if t == 'warning' and x.startswith('[fit]')]
                    termw = [x for (t, x) in logs if t == 'warning' and x.startswith('[term]')]
                    issues = []
                    def over(mm, label):
                        if not mm: return
                        if not mm.get('narrow') and (mm.get('sh', 0) > mm.get('ch', 0) + 2 or mm.get('sw', 0) > mm.get('cw', 0) + 2):
                            issues.append(f"OVERFLOW{label}: content {mm['sw']}x{mm['sh']} in {mm['cw']}x{mm['ch']}")
                        if mm.get('narrow') and mm.get('sw', 0) > mm.get('cw', 0) + 2:
                            issues.append(f"SIDEWAYS OVERFLOW on phone{label}: content {mm['sw']}px wide in {mm['cw']}px")
                        for o in mm.get('offenders', []): issues.append(f'sticks out{label}: {o}')
                        for o in mm.get('clipped', []): issues.append(f'cut off{label}: {o}')
                        for o in mm.get('overlap', []): issues.append(f'spills over{label}: {o}')
                        for o in mm.get('quizClip', []): issues.append(f'quiz question too tall{label}: {o}')
                        for o in mm.get('walk', []): issues.append(f'during playback: {o}')
                        if mm.get('docOverflowX'): issues.append(f'page scrolls sideways{label}')
                    over(m, ''); over(after, ' (after clicking)')
                    if tiny: issues.append('text too small to read: ' + '; '.join(tiny))
                    for sp in spills: issues.append('text spills: ' + sp)
                    for lab, mt in tab_metrics: over(mt, lab)
                    issues += [f'ERROR: {e}' for e in errs] + [f"RENDER ERROR: {e['msg'][:300]}" for e in rerr]
                    issues += [f'fit warning: {x}' for x in fit if not any('OVERFLOW' in i for i in issues)]
                    warn = [f'internal scroll: {x}' for x in (m.get('scrollers', []) + ((after or {}).get('scrollers', [])))]
                    bad_terms = sorted(set(m.get('badTerms', []) + (after or {}).get('badTerms', [])))
                    if bad_terms: issues.append('undefined glossary terms: ' + ', '.join(bad_terms))
                    warn += termw
                    ok = not issues
                    fails += 0 if ok else 1
                    results.append({'key': s['key'], 'vp': f'{w}x{h}', 'theme': theme, 'title': s['title'], 'scale': m.get('scale'), 'narrow': m.get('narrow'), 'clicks': clicks, 'ok': ok, 'issues': issues, 'warnings': sorted(set(warn))})
                    flag = 'OK ' if ok else 'FAIL'
                    print(f"[{flag}] {w}x{h} {theme:5} {s['key']:<10} scale={m.get('scale')} {'narrow ' if m.get('narrow') else ''}{('clicks=' + str(clicks)) if a.fuzz else ''}  {s['title'] or ''}")
                    for i in issues: print('        ✗ ' + i)
                    for x in sorted(set(warn))[:6]: print('        ~ ' + x)
                ctx.close()
        browser.close()
    if a.json:
        Path(a.json).write_text(json.dumps(results, indent=1))
    print(f"\n{len(results) - fails}/{len(results)} slide checks passed" + ('' if a.no_shots else f"; screenshots in {a.shots}"))
    sys.exit(1 if fails else 0)

if __name__ == '__main__':
    main()
