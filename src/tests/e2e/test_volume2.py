"""End-to-end tests for the second volume of the guide (chapters 6-9), pytest + Playwright, local Chrome.

Run:  cd src && node build.mjs --book 6-9 && python3 -m pytest tests/e2e/test_volume2.py -q
Covers what is different about volume 2: its own title and chapter cards, saved progress kept apart from
the chapters 1-5 page, glossary terms borrowed from chapters 1-5, the appendix label 7A, the final challenge
wording and the printable guide.
"""
from pathlib import Path

import pytest
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[3]
HTML2 = (ROOT / 'operating-systems-ch6-9.html').as_uri()
HTML1 = (ROOT / 'operating-systems-ch1-5.html').as_uri()
READY = 'window.Guide && Guide.debug && document.querySelector("#canvas")'


@pytest.fixture(scope='module')
def browser():
    with sync_playwright() as p:
        try:
            b = p.chromium.launch(channel='chrome')
        except Exception:
            b = p.chromium.launch()
        yield b
        b.close()


@pytest.fixture
def ctx(browser):
    c = browser.new_context(viewport={'width': 1280, 'height': 720})
    yield c
    c.close()


def open_page(ctx, url, key='home'):
    pg = ctx.new_page()
    errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.goto(url + '#' + key)
    pg.wait_for_function(READY)
    pg.errors = errors
    return pg


@pytest.fixture
def page(ctx):
    pg = open_page(ctx, HTML2)
    pg.evaluate('localStorage.clear()')
    pg.reload()
    pg.wait_for_function(READY)
    yield pg
    assert not pg.errors, f'page errors: {pg.errors}'


def go(pg, key):
    assert pg.evaluate('k => Guide.debug.go(k)', key), f'no slide {key}'
    pg.wait_for_timeout(250)


def test_home_names_volume_two(page):
    assert page.title() == 'Operating Systems · Chapters 6–9 · Interactive Guide'
    title = page.inner_text('#canvas .step-title').replace('⁠', '')
    assert title == 'Operating Systems · Chapters 6–9'
    cards = page.locator('#canvas .chcard')
    assert cards.count() == 4
    assert [cards.nth(i).locator('.n').inner_text().strip().upper() for i in range(4)] == ['CHAPTER 6', 'CHAPTER 7', 'CHAPTER 8', 'CHAPTER 9']
    assert 'Start with Chapter 6' in page.inner_text('#canvas')
    # the count chip may be tucked away when the home page compresses to fit, so read its text directly
    assert page.evaluate("document.querySelector('#canvas .home-hero .chip.accent').textContent") == '4 chapters · 25 sections'
    # the four cards share the row equally (no fifth empty column)
    widths = [cards.nth(i).bounding_box()['width'] for i in range(4)]
    assert max(widths) - min(widths) < 2 and widths[0] > 200


def test_every_section_registered_in_order(page):
    ids = page.evaluate("Object.values(Guide.sections).map(s => s.id)")
    want = ['6.1', '6.2', '6.3', '6.4', '6.5', '6.6', '6.7', '6.8', '6.9', '6.10', '6.11',
            '7.1', '7.2', '7.3', '7.4', '7.5', '8.1', '8.2', '8.3', '8.4', '8.5', '8.6', '9.1', '9.2', '9.3']
    assert sorted(ids, key=lambda s: tuple(map(int, s.split('.')))) == want
    assert page.evaluate("Guide.debug.registerErrors().length") == 0
    keys = [s['key'] for s in page.evaluate('Guide.debug.slides()')]
    for c in ('ch6', 'ch7', 'ch8', 'ch9', 'ch6-terms', 'ch9-quiz', 'final'):
        assert c in keys
    assert not any(k.startswith(('1.', '2.', '3.', '4.', '5.')) for k in keys)


def test_progress_is_stored_apart_from_volume_one(ctx):
    pg1 = open_page(ctx, HTML1)
    pg1.evaluate('localStorage.clear()')
    pg1.reload(); pg1.wait_for_function(READY)
    go(pg1, '3.2/2')
    pg2 = open_page(ctx, HTML2)
    go(pg2, '7.3/2')
    pg2.wait_for_timeout(300)
    keys = pg2.evaluate('Object.keys(localStorage)')
    assert 'os-guide-v1' in keys and 'os-guide-ch6-9-v1' in keys
    v1 = pg2.evaluate("JSON.parse(localStorage.getItem('os-guide-v1')).last")
    v2 = pg2.evaluate("JSON.parse(localStorage.getItem('os-guide-ch6-9-v1')).last")
    assert v1 == '3.2/2' and v2 == '7.3/2'
    # each page offers to continue where it left off, not where the other volume left off
    go(pg2, 'home')
    assert 'Continue: 7.3' in pg2.inner_text('#canvas')
    go(pg1, 'home')
    assert 'Continue: 3.2' in pg1.inner_text('#canvas')
    assert not pg1.errors and not pg2.errors


def test_volume_one_terms_resolve_with_their_origin(page):
    hit = page.evaluate("(() => { const g = Guide.lookupTerm('semaphore'); return g && [g.term, g.src]; })()")
    assert hit and hit[1].startswith('prior:'), hit
    # a volume-2 definition wins over a volume-1 one for the same word
    dl = page.evaluate("(() => { const g = Guide.lookupTerm('deadlock'); return g && g.src; })()")
    assert dl and not dl.startswith('prior:'), dl
    # the glossary lists the borrowed term as coming from the Chapters 1-5 guide, without a dead link
    page.keyboard.press('g')
    page.fill('.drawer.right.on .dr-search', 'semaphore')
    item = page.locator('.drawer.right.on .gl-item', has_text='Semaphore').first
    assert 'Ch 1–5 guide' in item.inner_text()
    before = page.evaluate('Guide.debug.current()')
    item.locator('.src').click()
    assert page.evaluate('Guide.debug.current()') == before


def test_no_undefined_terms_on_any_slide(page):
    bad = page.evaluate("""(() => { const out = [];
      for (const s of Guide.debug.slides()) { Guide.debug.go(s.key); const m = Guide.debug.metrics();
        if (m && m.badTerms.length) out.push(s.key + ': ' + m.badTerms.join(', ')); }
      return out; })()""")
    assert not bad, bad


def test_appendix_shows_label_7a(page):
    go(page, '7.5/1')
    assert page.inner_text('#canvas .step-eyebrow .sid').strip() == '7A'
    assert '7A ·' in page.inner_text('.bb-count') or page.inner_text('.bb-count').startswith('7A')
    page.keyboard.press('t')
    toc = page.inner_text('.drawer.left.on')
    assert '7A' in toc and 'Loading and Linking' in toc
    page.keyboard.press('Escape')
    go(page, 'ch7')
    assert '7A Loading and Linking' in page.inner_text('#canvas')


def test_final_challenge_draws_from_volume_two(page):
    go(page, 'final')
    assert page.inner_text('#canvas .step-title') == 'Final challenge: all four chapters'
    srcs = page.evaluate("[...document.querySelectorAll('#canvas .quiz-src')].map(e => e.textContent)")
    assert all(s.startswith('§6') or s.startswith('§7') or s.startswith('§8') or s.startswith('§9') for s in srcs)


def test_print_view(ctx):
    pg = ctx.new_page()
    pg.goto(HTML2 + '?print')
    pg.wait_for_selector('.print-doc')
    assert pg.title() == 'Operating Systems Chapters 6-9 Study Guide'
    txt = pg.inner_text('.print-doc')
    assert 'Chapters 6–9: deadlock, memory, virtual memory and scheduling' in txt
    for c in ('Chapter 6', 'Chapter 7', 'Chapter 8', 'Chapter 9', '7A'):
        assert c in txt
    assert pg.locator('.p-sec').count() == 25


@pytest.mark.parametrize('url', [HTML2, HTML1])
def test_terms_work_from_the_keyboard(ctx, url):
    pg = open_page(ctx, url)
    go(pg, 'home')
    term = pg.locator('#canvas .t').first
    assert term.get_attribute('tabindex') == '0' and term.get_attribute('role') == 'button'
    assert 'show definition' in term.get_attribute('aria-label')
    term.focus()
    pg.keyboard.press('Enter')
    assert pg.locator('#term-pop.on').count() == 1
    assert term.get_attribute('aria-describedby') == 'term-pop'
    pg.keyboard.press('Enter')
    assert pg.locator('#term-pop.on').count() == 0
    pg.keyboard.press('Space')
    assert pg.locator('#term-pop.on').count() == 1
    pg.keyboard.press('Escape')
    assert pg.locator('#term-pop.on').count() == 0
    # a term inside a button (a quiz choice, a flip card) is not made a second control inside the control
    nested = pg.evaluate("""() => { for (const s of Guide.debug.slides()) { Guide.debug.go(s.key);
        const bad = [...document.querySelectorAll('#canvas .t[tabindex]')].filter(t => t.parentElement.closest('button, a, label, [role="button"]'));
        if (bad.length) return s.key; } return null; }""")
    assert nested is None, f'focusable term nested inside a control on {nested}'
    assert not pg.errors


@pytest.mark.parametrize('url', [HTML2, HTML1])
def test_focus_follows_slide_changes(ctx, url):
    pg = open_page(ctx, url)
    # a slide with an ordinary button (not inside a tab strip, switch or other widget that keeps the arrow keys for itself)
    WIDGET = "[role=tablist], .seg, [role=radiogroup], [role=listbox], [role=slider], [role=menu], [data-keys]"
    key = pg.evaluate('''w => { for (const s of Guide.debug.slides()) { if (s.type !== 'step') continue; Guide.debug.go(s.key);
        const b = [...document.querySelectorAll('#canvas .step-body button')].find(x => !x.closest(w) && !x.disabled);
        if (b) return s.key; } return null; }''', WIDGET)
    go(pg, key)
    pg.evaluate("w => [...document.querySelectorAll('#canvas .step-body button')].find(x => !x.closest(w) && !x.disabled).focus()", WIDGET)
    pg.keyboard.press('ArrowRight')
    pg.wait_for_timeout(250)
    # the focused control belonged to the old slide, so focus moves to the new slide's title
    assert pg.evaluate("document.activeElement.classList.contains('step-title')")
    assert pg.evaluate("document.activeElement.textContent") == pg.inner_text('#canvas .step-title')
    # a bar button survives the change, so focus stays on it and the announcer names the new slide
    pg.locator('#botbar .bb-nav.primary').focus()
    pg.keyboard.press('Enter')
    pg.wait_for_timeout(250)
    assert pg.evaluate("document.activeElement.classList.contains('bb-nav')")
    live = pg.inner_text('[aria-live="polite"].sr-only')
    assert live and pg.inner_text('#canvas .step-title') in live
    assert not pg.errors
