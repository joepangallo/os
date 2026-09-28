"""End-to-end behaviour tests for the interactive guide (pytest + Playwright, local Chrome).

Run:  cd src && node build.mjs && python3 -m pytest tests/e2e -q
Covers the behaviours a geometry sweep cannot see: resume, per-chapter continue, quiz
persistence across navigation / reload / breakpoint changes, sampled-challenge persistence,
keyboard access to contents and tabs, inert drawers, the phone home page, the printable
guide, and the core learning route.
"""
import re
from pathlib import Path

import pytest
from playwright.sync_api import sync_playwright

HTML = (Path(__file__).resolve().parents[3] / 'operating-systems-ch1-5.html').as_uri()


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
def page(browser):
    ctx = browser.new_context(viewport={'width': 1280, 'height': 720})
    pg = ctx.new_page()
    errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.goto(HTML + '#home')
    pg.wait_for_function('window.Guide && Guide.debug && document.querySelector("#canvas")')
    pg.evaluate("localStorage.clear()")
    pg.reload()
    pg.wait_for_function('window.Guide && Guide.debug && document.querySelector("#canvas")')
    yield pg
    assert not errors, f'page errors: {errors}'
    ctx.close()


def go(pg, key):
    pg.evaluate('k => Guide.debug.go(k)', key)
    pg.wait_for_timeout(250)


def quiz_step_key(pg, sec):
    return pg.evaluate("s => { const i = Guide.sections[s].steps.findIndex(st => st.quiz); return s + '/' + (i + 1); }", sec)


def answered(pg):
    txt = pg.inner_text('#canvas .quiz-score')
    return int(re.search(r'(\d+)/\d+ answered', txt).group(1))


def answer_first_question_correctly(pg):
    """Click the correct option of the current MC/TF question via the question data."""
    info = pg.evaluate("""() => {
        const b = document.querySelectorAll('#canvas .qopt');
        return b.length;
    }""")
    assert info > 0, 'expected a multiple-choice question first'
    # try each option until one is marked right or the question is done
    for i in range(info):
        btn = pg.query_selector_all('#canvas .qopt')[i]
        if btn.is_disabled():
            continue
        btn.click()
        pg.wait_for_timeout(80)
        if pg.query_selector('#canvas .qopt.right'):
            return


# ---------------------------------------------------------------- resume
def test_home_continue_resumes_last_learning_step(page):
    go(page, '3.2/5')
    go(page, 'home')
    btn = page.query_selector('#canvas .home-top .btn.primary')
    assert '3.2' in btn.inner_text()
    btn.click()
    page.wait_for_timeout(250)
    assert page.evaluate('Guide.debug.current()') == '3.2/5'


def test_chapter_continue_resumes_inside_chapter(page):
    go(page, '3.3/2')
    go(page, 'ch4')
    go(page, 'ch3')
    btn = page.query_selector('#canvas .chov .btn.primary')
    assert '3.3' in btn.inner_text()
    btn.click()
    page.wait_for_timeout(250)
    assert page.evaluate('Guide.debug.current()') == '3.3/2'


# ---------------------------------------------------------------- quiz persistence
def test_section_quiz_survives_navigation_reload_and_breakpoint(page):
    key = quiz_step_key(page, '1.1')
    go(page, key)
    # make sure the first question is an MC/TF so we can answer it generically
    if not page.query_selector('#canvas .qopt'):
        pytest.skip('first question is not multiple choice')
    answer_first_question_correctly(page)
    assert answered(page) == 1
    go(page, '1.1/1')
    go(page, key)
    assert answered(page) == 1, 'answer lost after leaving the step'
    page.reload()
    page.wait_for_function('window.Guide && Guide.debug')
    go(page, key)
    assert answered(page) == 1, 'answer lost after reload'
    page.set_viewport_size({'width': 390, 'height': 844})
    page.wait_for_timeout(500)
    assert answered(page) == 1, 'answer lost when crossing into phone layout'
    page.set_viewport_size({'width': 1280, 'height': 720})
    page.wait_for_timeout(500)
    assert answered(page) == 1, 'answer lost when crossing back to desktop layout'


def test_final_challenge_keeps_its_draw_and_answers(page):
    go(page, 'final')
    first_src = page.inner_text('#canvas .quiz-src')
    ids = page.evaluate("JSON.stringify(JSON.parse(localStorage.getItem('os-guide-v1') || '{}').qdraw?.final || [])")
    if page.query_selector('#canvas .qopt'):
        answer_first_question_correctly(page)
        n = answered(page)
    else:
        n = answered(page)
    go(page, 'home')
    go(page, 'final')
    assert page.evaluate("JSON.stringify(JSON.parse(localStorage.getItem('os-guide-v1') || '{}').qdraw?.final || [])") == ids
    assert answered(page) == n
    page.click('#canvas button:has-text("Draw a new set")')
    page.wait_for_timeout(250)
    assert answered(page) == 0


# ---------------------------------------------------------------- keyboard
def test_contents_entries_are_keyboard_buttons_and_drawers_are_inert(page):
    go(page, '1.1/1')
    assert page.evaluate("[...document.querySelectorAll('.drawer, .modal')].every(d => d.inert)"), 'closed drawers must be inert'
    page.keyboard.press('t')
    page.wait_for_timeout(300)
    assert page.evaluate("document.querySelector('.drawer.left').inert === false")
    entries = page.evaluate("[...document.querySelectorAll('.drawer.left .toc-sec')].map(e => e.tagName)")
    assert entries and all(t == 'BUTTON' for t in entries)
    # Tab from the filter lands on a contents button; Enter opens it
    page.keyboard.press('Tab')
    for _ in range(6):
        page.keyboard.press('Tab')
    tag = page.evaluate("document.activeElement.className")
    assert 'toc' in tag
    page.keyboard.press('Enter')
    page.wait_for_timeout(300)
    assert page.evaluate("document.querySelector('.drawer.left').inert === true")


def test_tab_key_never_reaches_closed_drawers(page):
    go(page, '2.1/1')
    for _ in range(40):
        page.keyboard.press('Tab')
        inside = page.evaluate("!!(document.activeElement && document.activeElement.closest && document.activeElement.closest('.drawer:not(.on), .modal:not(.on)'))")
        assert not inside


def test_arrow_keys_move_between_tabs_not_slides(page):
    key = page.evaluate("""() => {
        for (const s of Object.values(Guide.sections)) for (let i = 0; i < s.steps.length; i++) {
            const src = String(s.steps[i].render || '');
            if (src.includes('ui.tabs(')) return s.id + '/' + (i + 1);
        }
        return null; }""")
    assert key, 'no tabbed step found'
    go(page, key)
    tab = page.query_selector('#canvas [role=tab]')
    tab.focus()
    page.keyboard.press('ArrowRight')
    page.wait_for_timeout(200)
    assert page.evaluate('Guide.debug.current()') == key, 'ArrowRight inside a tab strip must not change the slide'
    assert page.evaluate("document.activeElement.getAttribute('role')") == 'tab'
    assert page.evaluate("document.activeElement.getAttribute('aria-selected')") == 'true'


# ---------------------------------------------------------------- phone home
def test_phone_home_page_fits_and_stacks(browser):
    ctx = browser.new_context(viewport={'width': 390, 'height': 844})
    pg = ctx.new_page()
    pg.goto(HTML + '#home')
    pg.wait_for_function('window.Guide && Guide.debug && document.querySelector("#canvas")')
    pg.wait_for_timeout(300)
    vw = 390
    btn = pg.query_selector('#canvas .home-top .btn.primary').bounding_box()
    assert btn['x'] >= 0 and btn['x'] + btn['width'] <= vw + 1, f'start button clipped: {btn}'
    cards = [c.bounding_box() for c in pg.query_selector_all('#canvas .chcard')]
    assert len({round(c['x']) for c in cards}) == 1, 'chapter cards should stack in one column'
    assert all(c['width'] > 250 for c in cards)
    assert pg.evaluate('document.documentElement.scrollWidth') <= vw + 1
    go(pg, '3.2/1')
    notes = pg.query_selector('#topbar [aria-label="Section notes"]')
    assert notes and notes.is_visible(), 'section notes must be reachable on phones'
    ctx.close()


# ---------------------------------------------------------------- printable guide + core route
def test_printable_guide_view(browser):
    ctx = browser.new_context(viewport={'width': 1280, 'height': 900})
    pg = ctx.new_page()
    pg.goto(HTML + '?print')
    pg.wait_for_selector('.print-doc')
    assert pg.query_selector('.print-bar')
    assert pg.evaluate("document.querySelectorAll('.print-doc .p-sec').length") == 40
    ctx.close()


def test_core_route_skips_non_core_steps(page):
    page.evaluate("Guide.store.data.route = 'core'")
    go(page, '1.1/1')
    page.keyboard.press('ArrowRight')
    page.wait_for_timeout(250)
    # every step visited by pressing Right on the core route must be a core step
    for _ in range(12):
        cur = page.evaluate('Guide.debug.current()')
        is_core = page.evaluate("""k => { const [sid, n] = k.split('/'); const sec = Guide.sections[sid]; if (!sec) return true;
            const st = sec.steps[+n - 1]; return !!st.core || st.kind === 'story' || st.kind === 'recap' || st.kind === 'check' || !!st.quiz || +n === 1; }""", cur)
        assert is_core, f'{cur} is not on the core path'
        page.keyboard.press('ArrowRight')
        page.wait_for_timeout(120)
