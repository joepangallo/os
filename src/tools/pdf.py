#!/usr/bin/env python3
"""Render the printable study guide (the guide's ?print mode) to a PDF.

  python3 tools/pdf.py ../operating-systems-ch1-5.html ../operating-systems-ch1-5-study-guide.pdf
"""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

src = Path(sys.argv[1]).resolve()
out = Path(sys.argv[2]).resolve()
FOOT = ('<div style="font:8px -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#69738c;width:100%;'
        'padding:0 0.65in;display:flex;justify-content:space-between">'
        '<span>Operating Systems · Chapters 1–5 · Study Guide</span>'
        '<span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>')

with sync_playwright() as p:
    try:
        b = p.chromium.launch(channel='chrome')
    except Exception:
        b = p.chromium.launch()
    pg = b.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(src.as_uri() + '?print')
    pg.wait_for_selector('.print-doc', timeout=20000)
    pg.emulate_media(media='print')
    pg.wait_for_timeout(600)
    pg.pdf(path=str(out), format='Letter', print_background=True, display_header_footer=True,
           header_template='<div></div>', footer_template=FOOT,
           margin={'top': '0.6in', 'bottom': '0.75in', 'left': '0.65in', 'right': '0.65in'})
    b.close()
print(f'wrote {out} ({out.stat().st_size / 1024:.0f} KB)' + (f'; page errors: {errs}' if errs else ''))
