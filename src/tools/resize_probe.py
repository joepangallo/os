#!/usr/bin/env python3
"""Compare every step after a desktop→phone resize with a fresh phone load of the same step.

A mismatch in SVG viewBoxes or narrow-only markup means the lesson kept its desktop layout after the
window crossed the phone breakpoint.

  python3 tools/resize_probe.py ../operating-systems-ch1-5.html [--chapter 3]
"""
import argparse, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

SIG_JS = """() => {
  const c = document.querySelector('#canvas');
  const boxes = [...c.querySelectorAll('svg')].map(s => s.getAttribute('viewBox') || '').join('|');
  const classes = [...c.querySelectorAll('[class]')].map(e => e.getAttribute('class')).filter(x => /\\b(nar|narrow|phone|mobile)\\b/.test(x)).length;
  return boxes + ' #' + classes;
}"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('html')
    ap.add_argument('--chapter', action='append', default=[])
    a = ap.parse_args()
    url = Path(a.html).resolve().as_uri()
    bad = 0
    with sync_playwright() as p:
        try:
            b = p.chromium.launch(channel='chrome')
        except Exception:
            b = p.chromium.launch()
        desk = b.new_page(viewport={'width': 1280, 'height': 720})
        phone = b.new_page(viewport={'width': 390, 'height': 844})
        for pg in (desk, phone):
            pg.goto(url + '#home'); pg.wait_for_function('window.Guide && Guide.debug')
        slides = desk.evaluate('Guide.debug.slides()')
        for s in slides:
            if s['type'] != 'step':
                continue
            ch = s['sec'][2:] if s['sec'].startswith('ch') else s['sec'].split('.')[0]
            if a.chapter and ch not in a.chapter:
                continue
            # resized: desktop render, then shrink to phone
            desk.set_viewport_size({'width': 1280, 'height': 720})
            desk.evaluate('k => Guide.debug.go(k)', s['key']); desk.wait_for_timeout(200)
            desk.set_viewport_size({'width': 390, 'height': 844}); desk.wait_for_timeout(350)
            resized = desk.evaluate(SIG_JS)
            # fresh: render directly at phone size
            phone.evaluate('k => Guide.debug.go(k)', s['key']); phone.wait_for_timeout(250)
            fresh = phone.evaluate(SIG_JS)
            if resized != fresh:
                bad += 1
                print(f"[DIFF] {s['key']} {s['title']}\n    resized: {resized[:160]}\n    fresh:   {fresh[:160]}")
        b.close()
    print(f'\n{bad} step(s) differ after resizing')
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()
