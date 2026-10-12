#!/usr/bin/env python3
"""Find steps that lose a student's work when the window crosses the phone breakpoint.

For every step: change its controls (sliders to a non-default value, selects to another option, text/number
inputs, the second tab of each tab strip, one press of a player's Next button), read the values, resize to a
phone width and back, and read them again. A step whose values snap back to their defaults was rebuilt
without keeping its state (see ctx.keep in the authoring contract).

  python3 tools/state_probe.py ../operating-systems-ch10-13.html [--chapter 11] [--section 11.4]
"""
import argparse, json, sys  # argparse: command-line options; json: printing values; sys: exit code
from pathlib import Path  # Path: the page's file address
from playwright.sync_api import sync_playwright  # drives a real browser from Python

# EDIT_JS: changes what a student would change, in a fixed and repeatable way
EDIT_JS = r"""
async () => {
  const body = document.querySelector('#canvas .step-body'); if (!body) return 0;
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  let n = 0;
  for (const r of body.querySelectorAll('input[type=range]')) {  // each slider: move it two thirds of the way along, rounded to its step
    const lo = +r.min || 0, hi = r.max === '' ? 100 : +r.max, st = +r.step || 1;
    let v = lo + Math.round(((hi - lo) * 2 / 3) / st) * st; if (+r.value === v) v = lo;
    r.value = v; r.dispatchEvent(new Event('input', { bubbles: true })); r.dispatchEvent(new Event('change', { bubbles: true })); n++; await sleep(30);
  }
  for (const s of body.querySelectorAll('select')) {  // each drop-down: pick a different option
    if (s.options.length > 1) { s.selectedIndex = s.selectedIndex === s.options.length - 1 ? 0 : s.options.length - 1; s.dispatchEvent(new Event('change', { bubbles: true })); n++; await sleep(30); }
  }
  for (const i of body.querySelectorAll('input[type=number],input[type=text],textarea')) {  // each typed box: a different value
    if (i.closest('.quiz')) continue;
    i.value = i.type === 'number' ? String((+i.value || 0) + 1) : (i.value + 'x'); i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); n++; await sleep(30);
  }
  for (const t of body.querySelectorAll('[role=tablist]')) {  // each tab strip: open its second tab
    const tabs = t.querySelectorAll('[role=tab]'); if (tabs.length > 1) { tabs[1].click(); n++; await sleep(60); }
  }
  if (window.__deep) {  // --deep: also press what students press: a different switch button, toggles, and up to three action buttons
    const skip = (b) => b.closest('.quiz, .player-ctl, [role=tablist], .flip') || b.disabled || /reset|restart|clear|random|shuffle|new |start over|again/i.test(b.textContent + (b.getAttribute('aria-label') || ''));
    for (const g of body.querySelectorAll('.seg')) { if (g.closest('.player-ctl, .quiz')) continue; const bs = [...g.querySelectorAll('button')]; const off = bs.find(b => b.getAttribute('aria-pressed') !== 'true'); if (off) { off.click(); n++; await sleep(80); } }
    const acts = [...body.querySelectorAll('button')].filter(b => !b.closest('.seg') && !skip(b));
    for (const b of acts.slice(0, 3)) { if (b.isConnected && !b.disabled) { b.click(); n++; await sleep(120); } }
  }
  for (const p of body.querySelectorAll('.player')) {  // each step player: one frame forward
    const nx = [...p.querySelectorAll('button')].find(b => /next/i.test(b.getAttribute('aria-label') || b.title || b.textContent)); if (nx && !nx.disabled) { nx.click(); n++; await sleep(60); }
  }
  return n;
}
"""

# SIG_JS: the values a student would expect to survive (control values, selected tab, player counter)
SIG_JS = r"""
() => {
  const body = document.querySelector('#canvas .step-body'); if (!body) return null;
  const vals = [...body.querySelectorAll('input[type=range],select,input[type=number],input[type=text],textarea')].filter(e => !e.closest('.quiz')).map(e => e.value);
  const tabs = [...body.querySelectorAll('[role=tablist]')].map(t => [...t.querySelectorAll('[role=tab]')].findIndex(b => b.getAttribute('aria-selected') === 'true'));
  const players = [...body.querySelectorAll('.player')].map(p => ((p.textContent.match(/Step \d+ \/ \d+/) || [''])[0]));
  if (window.__deep) {  // --deep: the whole visible text and every pressed toggle, so state built by clicking also counts
    const pressed = [...body.querySelectorAll('[aria-pressed]')].filter(b => !b.closest('.player-ctl, .quiz')).map(b => b.getAttribute('aria-pressed')).join('');
    return { vals, tabs, players, pressed, text: body.innerText.replace(/\s+/g, ' ').trim() };
  }
  return { vals, tabs, players };
}
"""


def describe(x, y):  # describe(): the first difference between two signatures, short enough to read
    out = []
    for f in x:
        if x[f] == y.get(f): continue
        if f == 'text':
            a, b = x[f], y.get(f, ''); i = 0
            while i < min(len(a), len(b)) and a[i] == b[i]: i += 1
            out.append(f"text: \u00ab{a[max(0, i - 25):i + 55]}\u00bb became \u00ab{b[max(0, i - 25):i + 55]}\u00bb")
        else:
            out.append(f"{f}: {json.dumps(x[f])[:80]} became {json.dumps(y.get(f))[:80]}")
    return ' | '.join(out)


def main():  # main(): visits the chosen steps and reports any that lose their values
    ap = argparse.ArgumentParser()
    ap.add_argument('html')  # the built page
    ap.add_argument('--chapter', action='append', default=[])  # limit to chapters (whole numbers)
    ap.add_argument('--section', action='append', default=[])  # limit to sections
    ap.add_argument('--deep', action='store_true', help='also press switches, toggles and action buttons, and compare the whole visible text before and after a phone round trip')
    a = ap.parse_args()
    url = Path(a.html).resolve().as_uri()
    bad = 0
    seen = {'exercised': 0, 'nothing to change': 0, 'random, skipped': 0}  # coverage: what the probe actually tested
    with sync_playwright() as p:
        try: b = p.chromium.launch(channel='chrome')  # the installed Chrome
        except Exception: b = p.chromium.launch()  # or Playwright's own
        pg = b.new_page(viewport={'width': 1280, 'height': 720})
        pg.goto(url + '#home'); pg.wait_for_function('window.Guide && Guide.debug && document.querySelector("#canvas")')
        slides = [s for s in pg.evaluate('Guide.debug.slides()') if s['type'] == 'step']
        for s in slides:
            sec = s['sec'] or ''
            ch = sec[2:] if sec.startswith('ch') else sec.split('.')[0]  # chapter as a whole number string
            if a.section and sec not in a.section: continue
            if a.chapter and ch not in a.chapter: continue
            pg.set_viewport_size({'width': 1280, 'height': 720}); pg.wait_for_timeout(150)
            pg.evaluate('k => Guide.debug.go(k)', s['key']); pg.wait_for_timeout(400)
            pg.evaluate('d => { window.__deep = d; }', bool(a.deep))  # tells the page scripts whether this is a deep run
            if a.deep:  # a step whose content changes between two plain visits (random examples) cannot be compared by text
                s0 = pg.evaluate(SIG_JS); pg.evaluate('k => Guide.debug.go(k)', slides[0]['key']); pg.evaluate('k => Guide.debug.go(k)', s['key']); pg.wait_for_timeout(400)
                if pg.evaluate(SIG_JS) != s0: print(f"[skip] {s['key']} (content differs between visits)"); seen['random, skipped'] += 1; continue
            if not pg.evaluate(EDIT_JS): seen['nothing to change'] += 1; continue  # nothing a student can change on this step
            seen['exercised'] += 1
            pg.wait_for_timeout(1500 if a.deep else 300)  # lets animations a click started settle first
            before = pg.evaluate(SIG_JS)
            pg.set_viewport_size({'width': 390, 'height': 844}); pg.wait_for_timeout(700)
            phone = pg.evaluate(SIG_JS)
            pg.set_viewport_size({'width': 1280, 'height': 720}); pg.wait_for_timeout(700)
            back = pg.evaluate(SIG_JS)
            if a.deep: pg.wait_for_timeout(1500); back = pg.evaluate(SIG_JS)  # the same settling time before reading again
            lost = ['back'] if (a.deep and back != before) else [] if a.deep else [w for (w, sig) in (('phone', phone), ('back', back)) if sig != before]  # deep: compare the desktop view with itself; normal: values must match in both layouts
            if lost:
                bad += 1
                print(f"[LOST] {s['key']:10} after {'+'.join(lost)}: {describe(before, back if a.deep else (phone if phone != before else back))}")
            else:
                print(f"[ok]   {s['key']}")
        b.close()
    print('\ncoverage: ' + ', '.join(f'{v} {k}' for k, v in seen.items()) + ('; deep mode compares the desktop view before and after a phone round trip, so a loss visible only on the phone is not counted' if a.deep else ''))
    print(f'{bad} step(s) lose their state across the phone breakpoint')
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()
