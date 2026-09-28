#!/usr/bin/env python3
"""Find simulations whose Reset does not cancel delayed actions.

For every step that has a reset-like button, click each other control, press Reset at once,
then compare the step's text right after the reset with its text a little later. A change
means a callback scheduled before the reset fired afterwards and altered the fresh state.

  python3 tools/reset_probe.py ../operating-systems-ch1-5.html --chapter 5 [--wait 2200]
"""
import argparse, json, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

RESET_RE = r'^(reset|restart|start over|clear|new run|reset all|reset lab|start again)\b'

PROBE_JS = r"""
async ([resetRe, waitMs, maxActions]) => {
  const body = document.querySelector('#canvas .step-body');
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const label = (b) => (b.getAttribute('aria-label') || b.textContent || '').trim().replace(/\s+/g, ' ');
  const isReset = (b) => new RegExp(resetRe, 'i').test(label(b)) && !b.closest('.player');
  const visible = (b) => { const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !b.disabled; };
  const snap = () => (body.textContent || '').replace(/\s+/g, ' ').trim();
  const resets = [...body.querySelectorAll('button')].filter(isReset);
  if (!resets.length) return { resets: 0, bad: [] };
  const resetLabel = label(resets[0]);
  const actions = [...body.querySelectorAll('button')].filter((b) => visible(b) && !isReset(b) && !b.closest('.player') && !b.closest('.quiz')).map(label);
  const seen = new Set(); const bad = [];
  for (const a of actions.slice(0, maxActions)) {
    if (seen.has(a)) continue; seen.add(a);
    const btn = [...body.querySelectorAll('button')].find((b) => visible(b) && label(b) === a);
    const rst = [...body.querySelectorAll('button')].find((b) => isReset(b) && label(b) === resetLabel) || [...body.querySelectorAll('button')].find(isReset);
    if (!btn || !rst) continue;
    btn.click(); await sleep(20);
    if (!rst.isConnected || rst.disabled) continue;
    rst.click(); await sleep(60);
    const t0 = snap();
    await sleep(waitMs);
    const t1 = snap();
    if (t0 !== t1) {
      let i = 0; while (i < t0.length && t0[i] === t1[i]) i++;
      bad.push({ action: a, reset: resetLabel, before: t0.slice(Math.max(0, i - 40), i + 80), after: t1.slice(Math.max(0, i - 40), i + 80) });
    }
    // settle: reset again and wait so the next action starts clean
    const r2 = [...body.querySelectorAll('button')].find(isReset); if (r2 && !r2.disabled) r2.click();
    await sleep(waitMs);
  }
  return { resets: resets.length, bad };
}
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('html')
    ap.add_argument('--chapter', action='append', default=[])
    ap.add_argument('--section', action='append', default=[])
    ap.add_argument('--wait', type=int, default=2200)
    ap.add_argument('--max-actions', type=int, default=10)
    ap.add_argument('--json', default='')
    a = ap.parse_args()
    url = Path(a.html).resolve().as_uri()
    found = []
    with sync_playwright() as p:
        try:
            b = p.chromium.launch(channel='chrome')
        except Exception:
            b = p.chromium.launch()
        pg = b.new_page(viewport={'width': 1280, 'height': 720})
        pg.goto(url + '#home')
        pg.wait_for_function('window.Guide && Guide.debug')
        slides = pg.evaluate('Guide.debug.slides()')
        for s in slides:
            sec = s['sec']
            if s['type'] != 'step' or not sec or s['hasQuiz']:
                continue
            ch = sec[2:] if sec.startswith('ch') else sec.split('.')[0]
            if a.chapter and ch not in a.chapter:
                continue
            if a.section and sec not in a.section:
                continue
            pg.evaluate('k => Guide.debug.go(k)', s['key'])
            pg.wait_for_timeout(300)
            res = pg.evaluate(PROBE_JS, [RESET_RE, a.wait, a.max_actions])
            if res['bad']:
                found.append({'key': s['key'], 'title': s['title'], 'bad': res['bad']})
                print(f"[STALE] {s['key']} {s['title']}")
                for x in res['bad'][:4]:
                    print(f"    after '{x['action']}' then '{x['reset']}': …{x['before']}…  →  …{x['after']}…")
            elif res['resets']:
                print(f"[ok]    {s['key']}")
        b.close()
    if a.json:
        Path(a.json).write_text(json.dumps(found, indent=1))
    print(f'\n{len(found)} step(s) where state changed after Reset')
    sys.exit(1 if found else 0)


if __name__ == '__main__':
    main()
