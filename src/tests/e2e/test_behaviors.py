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


def correct_index(pg, key, j=0):
    """Index of the correct option of MC/TF question j of the quiz shown for `key` (a section quiz step, or a sampled
    challenge such as 'final' / 'ch3-quiz' whose drawn question IDs are saved), read from the question data."""
    return pg.evaluate("""([k, j]) => {
        let q;
        if (k.includes('/')) { const [sid, n] = k.split('/'); q = Guide.sections[sid].steps[+n - 1].quiz[j]; }
        else { const qid = Guide.store.data.qdraw[k][j]; const [sid, si, qi] = qid.split(':'); q = Guide.sections[sid].steps[+si].quiz[+qi]; }
        const t = Guide.validateQuestion(q, '').type; if (t === 'tf') return q.answer ? 0 : 1; if (t === 'mc') return q.answer; return null; }""", [key, j])


def answer_first_question_correctly(pg, key=None):
    """Answer the current MC/TF question correctly on the FIRST try, using the question data, and assert it scored as first-try right."""
    key = key or pg.evaluate('Guide.debug.current()')
    pos = pg.evaluate("[...document.querySelectorAll('#canvas .quiz-pill')].findIndex(p => p.classList.contains('on'))")
    order_idx = pg.evaluate("k => { const s = JSON.parse(localStorage.getItem('os-guide-v1') || '{}'); const q = s.qstate && s.qstate[k]; return q ? q.order : null; }", key)
    j = order_idx[pos] if order_idx else pos
    idx = correct_index(pg, key, j)
    if idx is None:
        return False   # not a single-answer question; caller decides what to do
    pg.query_selector_all('#canvas .qopt')[idx].click()
    pg.wait_for_timeout(120)
    assert 'right' in pg.get_attribute(f'#canvas .quiz-pill >> nth={pos}', 'class'), 'first-try correct answer must score as right'
    return True


def answer_wrong_then_right(pg, key, j):
    idx = correct_index(pg, key, j)
    n = len(pg.query_selector_all('#canvas .qopt'))
    wrong = next(i for i in range(n) if i != idx)
    pg.query_selector_all('#canvas .qopt')[wrong].click(); pg.wait_for_timeout(80)
    pg.query_selector_all('#canvas .qopt')[idx].click(); pg.wait_for_timeout(120)


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
    answer_first_question_correctly(page, 'final')
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


# ---------------------------------------------------------------- hardening (second review round)
def find_question(pg, qtype):
    """Return (step key, question index) of the first section quiz question of a given type."""
    return pg.evaluate("""t => {
        for (const s of Object.values(Guide.sections)) for (let i = 0; i < s.steps.length; i++) {
            const qz = s.steps[i].quiz || [];
            for (let j = 0; j < qz.length; j++) if (Guide.validateQuestion(qz[j], '').type === t) return [s.id + '/' + (i + 1), j];
        }
        return null; }""", qtype)


def open_question(pg, key, j):
    go(pg, key)
    pg.click(f'#canvas .quiz-pill >> nth={j}')
    pg.wait_for_timeout(150)


def test_numeric_draft_survives_leaving_and_reload(page):
    key, j = find_question(page, 'num')
    open_question(page, key, j)
    page.fill('#canvas .qnum input', '12.5')
    page.wait_for_timeout(200)
    go(page, 'home')
    page.reload()
    page.wait_for_function('window.Guide && Guide.debug')
    open_question(page, key, j)
    assert page.input_value('#canvas .qnum input') == '12.5'


def test_reorder_is_saved_without_pressing_check(page):
    key, j = find_question(page, 'order')
    open_question(page, key, j)
    before = [e.inner_text() for e in page.query_selector_all('#canvas .qord .txt')]
    page.click('#canvas .qord >> nth=1 >> button[aria-label="Move up"]')
    page.wait_for_timeout(200)
    after = [e.inner_text() for e in page.query_selector_all('#canvas .qord .txt')]
    assert after != before
    page.reload()
    page.wait_for_function('window.Guide && Guide.debug')
    open_question(page, key, j)
    assert [e.inner_text() for e in page.query_selector_all('#canvas .qord .txt')] == after


def test_reset_clears_attempts_resume_and_scores(page):
    key = quiz_step_key(page, '1.1')
    go(page, key)
    if page.query_selector('#canvas .qopt'):
        answer_first_question_correctly(page)
    go(page, '3.2/4')
    page.keyboard.press('?')
    page.wait_for_timeout(200)
    page.click('.modal.on button:has-text("Reset my progress")')
    page.wait_for_timeout(300)
    d = page.evaluate("({ q: Object.keys(Guide.store.data.qstate).length, d: Object.keys(Guide.store.data.qdraw).length, last: Guide.store.data.last, ch: Object.keys(Guide.store.data.chLast), s: Object.keys(Guide.store.data.quiz).length, v: Object.keys(Guide.store.data.visited) })")
    # everything is cleared; the page the student is standing on is then recorded again as the only visit
    assert d['q'] == 0 and d['d'] == 0 and d['s'] == 0
    assert d['last'] in (None, '3.2/4') and d['ch'] in ([], ['3']) and d['v'] in ([], ['3.2/4'])
    go(page, key)
    assert answered(page) == 0


def test_edited_question_discards_old_attempt(page):
    key = quiz_step_key(page, '1.1')
    go(page, key)
    if not page.query_selector('#canvas .qopt'):
        pytest.skip('first question is not multiple choice')
    answer_first_question_correctly(page)
    assert answered(page) == 1
    # simulate a later content edit that changes only the choices of question 1 (the prompt stays the same)
    page.evaluate("""k => { const [sid, n] = k.split('/'); const q = Guide.sections[sid].steps[+n - 1].quiz[0]; if (q.choices) q.choices = q.choices.concat(['An extra choice added later']); else q.why = q.why + ' (edited)'; }""", key)
    go(page, '1.1/1')
    go(page, key)
    assert answered(page) == 0, 'an attempt saved for the old question must not be restored onto the edited one'


def test_malformed_saved_state_is_ignored_safely(browser):
    ctx = browser.new_context(viewport={'width': 1280, 'height': 720})
    pg = ctx.new_page()
    errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.goto(HTML + '#home')
    pg.wait_for_function('window.Guide && Guide.debug')
    bad = ('{"visited":null,"__proto__":{"polluted":1},"constructor":{"x":1},"quiz":{"1.1/9":{"best":"x"}},'
           '"qstate":{"1.1/9":{"ids":["0:x"],"st":[{"tries":-1}],"order":[99]}},"qdraw":{"final":[1,2]},"last":{"a":1},"chLast":{"3":5},"theme":"<b>"}')
    for payload in [bad, 'not json at all', '[]', '{"visited":{"a":1}}']:
        pg.evaluate("v => localStorage.setItem('os-guide-v1', v)", payload)
        pg.reload()
        pg.wait_for_function('window.Guide && Guide.debug')
        assert pg.evaluate('Guide.store.data.polluted') is None
        assert pg.evaluate('({}).polluted') is None
        assert pg.evaluate("Object.getPrototypeOf(Guide.store.data) === Object.prototype")
        for key in ['1.1/9', 'final', '3.2/1', 'ch3']:
            pg.evaluate('k => Guide.debug.go(k)', key)
            pg.wait_for_timeout(120)
    assert not errors, errors
    ctx.close()


def test_focus_stays_inside_an_open_panel(page):
    go(page, '2.1/1')
    page.keyboard.press('t')
    page.wait_for_timeout(300)
    assert page.evaluate('document.querySelector("#app").inert')
    for _ in range(50):
        page.keyboard.press('Tab')
        inside = page.evaluate("!!(document.activeElement && document.activeElement.closest('.drawer.on'))")
        assert inside, 'Tab escaped the open contents panel'
    page.keyboard.press('ArrowRight')
    page.wait_for_timeout(150)
    assert page.evaluate('Guide.debug.current()') == '2.1/1', 'slides must not move behind an open panel'
    page.keyboard.press('Escape')
    page.wait_for_timeout(200)
    assert not page.evaluate('document.querySelector("#app").inert')


def test_malformed_fragment_falls_back_to_home(browser):
    ctx = browser.new_context(viewport={'width': 1280, 'height': 720})
    pg = ctx.new_page()
    errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.goto(HTML + '#%E0%A4%A')
    pg.wait_for_function('window.Guide && Guide.debug && document.querySelector("#canvas")')
    assert pg.evaluate('Guide.debug.current()') == 'home'
    assert not errors, errors
    ctx.close()



# ---------------------------------------------------------------- third review round
def mc_quiz_key(pg):
    """A section quiz whose first question is multiple choice (with >2 options)."""
    return pg.evaluate("""() => { for (const s of Object.values(Guide.sections)) for (let i = 0; i < s.steps.length; i++) {
        const q = (s.steps[i].quiz || [])[0]; if (q && Guide.validateQuestion(q, '').type === 'mc' && q.choices.length > 2) return s.id + '/' + (i + 1); } return null; }""")


def test_second_try_is_not_first_try(page):
    key = mc_quiz_key(page)
    go(page, key)
    answer_wrong_then_right(page, key, 0)
    assert 'late' in page.get_attribute('#canvas .quiz-pill >> nth=0', 'class')
    assert page.inner_text('#canvas .quiz-score').startswith('0 right first try')


@pytest.mark.parametrize('opener,closer', [
    ('t', '.drawer.left .dr-head button'), ('g', '.drawer.right[aria-label="Glossary"] .dr-head button'),
    ('?', '.modal.on button:has-text("Got it")'), ('?', '.modal.on .row button[aria-label="Close"]'), ('t', '.scrim'),
])
def test_every_way_of_closing_a_panel_clears_the_backdrop(page, opener, closer):
    go(page, '3.2/1')
    page.keyboard.press(opener)
    page.wait_for_timeout(300)
    if closer == '.scrim':
        vw = page.viewport_size['width']
        page.mouse.click(vw - 30, 360)   # a spot on the backdrop that no panel covers
    else:
        page.click(closer)
    page.wait_for_timeout(300)
    assert not page.evaluate("document.querySelector('.scrim').classList.contains('on')"), 'backdrop still covering the page'
    assert not page.evaluate('document.querySelector("#app").inert')
    # the page underneath is clickable again
    page.click('#botbar .bb-nav.primary')
    page.wait_for_timeout(200)
    assert page.evaluate('Guide.debug.current()') == '3.2/2'


def test_notes_close_button_clears_backdrop(page):
    go(page, '3.2/1')
    page.keyboard.press('n')
    page.wait_for_timeout(300)
    page.click('.drawer.on .dr-head button')
    page.wait_for_timeout(300)
    assert not page.evaluate("document.querySelector('.scrim').classList.contains('on')")


def test_focus_wraps_both_ways_inside_a_panel(page):
    go(page, '2.1/1')
    page.keyboard.press('t')
    page.wait_for_timeout(300)
    focusables = page.evaluate("[...document.querySelectorAll('.drawer.on button, .drawer.on input')].filter(x => x.getClientRects().length).length")
    page.evaluate("(() => { const f = [...document.querySelectorAll('.drawer.on button, .drawer.on input')].filter(x => x.getClientRects().length); f[0].focus(); })()")
    page.keyboard.press('Shift+Tab')   # from the first control back round to the last one
    last_is_focused = page.evaluate("(() => { const f = [...document.querySelectorAll('.drawer.on button, .drawer.on input')].filter(x => x.getClientRects().length); return document.activeElement === f[f.length - 1]; })()")
    assert last_is_focused
    page.keyboard.press('Tab')
    first_is_focused = page.evaluate("(() => { const f = [...document.querySelectorAll('.drawer.on button, .drawer.on input')].filter(x => x.getClientRects().length); return document.activeElement === f[0]; })()")
    assert first_is_focused
    assert focusables > 10


def test_retry_counts_as_fixed_not_first_try(page):
    key = mc_quiz_key(page)
    go(page, key)
    n = page.evaluate("k => { const [sid, i] = k.split('/'); return Guide.sections[sid].steps[+i - 1].quiz.length; }", key)
    ids = page.evaluate("k => { const [sid, i] = k.split('/'); return Guide.debug.quizIds(Guide.sections[sid].steps[+i - 1].quiz); }", key)
    st = [{'tries': 0, 'done': True, 'res': 'right'} for _ in range(n)]
    st[0] = {'tries': 2, 'done': True, 'res': 'wrong', 'wrong': []}
    fixture = {'qstate': {key: {'ids': ids, 'st': st, 'order': list(range(n)), 'pos': 0, 'mode': 'sum'}}}
    page.evaluate("f => localStorage.setItem('os-guide-v1', JSON.stringify(f))", fixture)
    page.reload()
    page.wait_for_function('window.Guide && Guide.debug')
    go(page, key)
    page.click('#canvas button:has-text("Retry the 1 I missed")')
    page.wait_for_timeout(200)
    page.query_selector_all('#canvas .qopt')[correct_index(page, key, 0)].click()
    page.wait_for_timeout(200)
    page.click('#canvas .quiz-ctl .btn.primary')   # See results
    page.wait_for_timeout(200)
    assert 'You fixed 1 of the 1' in page.inner_text('#canvas .quiz-sum')
    rec = page.evaluate("k => Guide.store.data.quiz[k]", key)
    assert rec['best'] == n - 1, f'first-try best must stay {n - 1}, got {rec}'
    assert rec['learned'] == n


def test_layout_aware_diagram_redraws_on_resize(browser):
    ctx = browser.new_context(viewport={'width': 1280, 'height': 720})
    pg = ctx.new_page()
    pg.goto(HTML + '#1.2/3'); pg.wait_for_function('window.Guide && Guide.debug'); pg.wait_for_timeout(400)
    pg.set_viewport_size({'width': 390, 'height': 844}); pg.wait_for_timeout(600)
    resized = pg.evaluate("[...document.querySelectorAll('#canvas svg')].map(s => s.getAttribute('viewBox')).join('|')")
    pg.reload(); pg.wait_for_function('window.Guide && Guide.debug'); pg.wait_for_timeout(400)
    fresh = pg.evaluate("[...document.querySelectorAll('#canvas svg')].map(s => s.getAttribute('viewBox')).join('|')")
    assert resized == fresh, f'after resize {resized} but a fresh phone load draws {fresh}'
    ctx.close()


def test_core_route_progress_is_reported_separately(page):
    page.evaluate("""() => { const d = Guide.store.data; d.route = 'core';
        for (const s of Guide.debug.slides()) if (s.type === 'step') { const [sid, n] = s.key.split('/'); const sec = Guide.sections[sid];
          const st = sec ? sec.steps[+n - 1] : null; if (!sec || st.core || st.kind === 'story' || st.kind === 'recap' || st.kind === 'check' || st.quiz || +n === 1) d.visited[s.key] = 1; } }""")
    go(page, 'ch1'); go(page, 'home')
    txt = page.inner_text('#canvas .home-top')
    assert 'Core path: 100% done' in txt, txt


def test_route_selector_is_above_the_cards_on_phones(browser):
    ctx = browser.new_context(viewport={'width': 390, 'height': 844})
    pg = ctx.new_page()
    pg.goto(HTML + '#home'); pg.wait_for_function('window.Guide && Guide.debug'); pg.wait_for_timeout(400)
    seg = pg.query_selector('#canvas .route-top .seg')
    assert seg and seg.is_visible()
    assert seg.bounding_box()['y'] < pg.query_selector('#canvas .chcard').bounding_box()['y']
    ctx.close()


# ---------------------------------------------------------------- reset really resets (probe logic from tools/reset_probe.py)
import importlib.util as _ilu
_spec = _ilu.spec_from_file_location('reset_probe', str(Path(__file__).resolve().parents[2] / 'tools' / 'reset_probe.py'))
_rp = _ilu.module_from_spec(_spec); _spec.loader.exec_module(_rp)


@pytest.mark.parametrize('key', ['1.1/6', '1.4/5', '2.3/8', '5.3/6', '5.4/8', '5.5/3'])
def test_reset_cancels_pending_actions(page, key):
    go(page, key)
    res = page.evaluate(_rp.PROBE_JS, [_rp.RESET_RE, 1600, 10])
    assert res['resets'] > 0, 'expected a reset control on this step'
    assert not res['bad'], f'state changed after Reset: {res["bad"][:2]}'


def test_two_wrong_answers_reveal_the_correct_one(page):
    key = mc_quiz_key(page)
    go(page, key)
    idx = correct_index(page, key, 0)
    wrong = [i for i in range(len(page.query_selector_all('#canvas .qopt'))) if i != idx][:2]
    for w in wrong:
        page.query_selector_all('#canvas .qopt')[w].click(); page.wait_for_timeout(80)
    assert 'wrong' in page.get_attribute('#canvas .quiz-pill >> nth=0', 'class')
    assert 'right' in page.query_selector_all('#canvas .qopt')[idx].get_attribute('class'), 'the correct option must be revealed in green'
    assert answered(page) == 1


def test_programming_lab_shows_live_memory_after_self_modification(page):
    go(page, '1.3/7')
    page.click('#canvas button:has-text("3 + 2")')
    for addr, word in [('301', '2302'), ('302', '5941'), ('940', '2941')]:
        sel = f'#canvas input[aria-label="Contents of address {addr}"]'
        page.fill(sel, word)
        page.dispatch_event(sel, 'change')
        page.wait_for_timeout(60)
    page.click('#canvas button:has-text("Step one cycle")'); page.wait_for_timeout(150)
    page.click('#canvas button:has-text("Step one cycle")'); page.wait_for_timeout(150)
    live = page.input_value('#canvas input[aria-label="Contents of address 302"]')
    assert live == '2941', f'row 302 should show the word the program stored there, got {live}'
    assert 'was 5941' in page.inner_text('#canvas'), 'the overwritten cell should say what it used to hold'
    page.click('#canvas button:has-text("Reset")'); page.wait_for_timeout(150)
    assert page.input_value('#canvas input[aria-label="Contents of address 302"]') == '5941', 'Reset must reload the program the student typed'
