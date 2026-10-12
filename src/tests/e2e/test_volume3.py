"""End-to-end tests for the third volume of the guide (chapters 10-13), pytest + Playwright, local Chrome.

Run:  cd src && node build.mjs --book 10-13 && python3 -m pytest tests/e2e/test_volume3.py -q
Covers what is different about volume 3: its own title and chapter cards, two-digit chapter and section numbers
(11.10 sorts after 11.9, chapter 1 is never mixed up with chapters 10-13), saved progress kept apart from both
earlier pages, glossary terms borrowed from BOTH earlier volumes and labelled with the right one, the final
challenge wording and the printable guide.
"""
from pathlib import Path  # Path: file-system paths that work the same on every operating system

import pytest  # pytest: the test runner; fixtures and parametrize come from it
from playwright.sync_api import sync_playwright  # sync_playwright: drives a real browser from Python, one step at a time

ROOT = Path(__file__).resolve().parents[3]  # ROOT: the folder that holds the built guide pages (three levels above this file)
HTML3 = (ROOT / 'operating-systems-ch10-13.html').as_uri()  # HTML3: the chapters 10-13 page as a file:// address
HTML2 = (ROOT / 'operating-systems-ch6-9.html').as_uri()  # HTML2: the chapters 6-9 page
HTML1 = (ROOT / 'operating-systems-ch1-5.html').as_uri()  # HTML1: the chapters 1-5 page
READY = 'window.Guide && Guide.debug && document.querySelector("#canvas")'  # READY: true once the guide has started and drawn its canvas

SECTIONS = ['10.1', '10.2', '10.3', '10.4', '10.5', '10.6',  # every section of the volume in reading order: chapter 10
            '11.1', '11.2', '11.3', '11.4', '11.5', '11.6', '11.7', '11.8', '11.9', '11.10',  # chapter 11 (note 11.10 comes after 11.9)
            '12.1', '12.2', '12.3', '12.4', '12.5', '12.6', '12.7', '12.8', '12.9', '12.10', '12.11',  # chapter 12
            '13.1', '13.2', '13.3', '13.4']  # chapter 13


@pytest.fixture(scope='module')  # one browser for the whole file, because starting Chrome is slow
def browser():  # browser(): the installed Chrome if there is one, otherwise Playwright's own Chromium
    with sync_playwright() as p:  # starts Playwright and stops it when the tests are done
        try:  # the Mac's own Chrome gives the same fonts students see
            b = p.chromium.launch(channel='chrome')  # launches the installed Google Chrome
        except Exception:  # no installed Chrome on this machine
            b = p.chromium.launch()  # falls back to the bundled Chromium
        yield b  # hands the browser to the tests
        b.close()  # closes it afterwards


@pytest.fixture  # a fresh browser context (its own storage) for every test
def ctx(browser):  # ctx(browser): a desktop-sized window with empty storage
    c = browser.new_context(viewport={'width': 1280, 'height': 720})  # a 1280 x 720 window
    yield c  # hands it to the test
    c.close()  # throws its storage away afterwards


def open_page(ctx, url, key='home'):  # open_page(): opens a guide page at a slide and records any script errors
    pg = ctx.new_page()  # a new tab in this context
    errors = []  # errors: every uncaught script error the page throws
    pg.on('pageerror', lambda e: errors.append(str(e)))  # collects them as they happen
    pg.goto(url + '#' + key)  # opens the page at the wanted slide
    pg.wait_for_function(READY)  # waits until the guide is running
    pg.errors = errors  # keeps the list on the page object so tests can check it
    return pg  # the opened tab


@pytest.fixture  # the chapters 10-13 page with cleared progress
def page(ctx):  # page(ctx): a clean chapters 10-13 page; fails the test if the page threw any error
    pg = open_page(ctx, HTML3)  # opens the page
    pg.evaluate('localStorage.clear()')  # forgets any saved progress
    pg.reload()  # starts again from a clean state
    pg.wait_for_function(READY)  # waits until the guide is running again
    yield pg  # hands it to the test
    assert not pg.errors, f'page errors: {pg.errors}'  # no script errors are allowed


def go(pg, key):  # go(): jumps to a slide by its key, such as '11.10/2' or 'ch12'
    assert pg.evaluate('k => Guide.debug.go(k)', key), f'no slide {key}'  # the guide reports false for a slide that does not exist
    pg.wait_for_timeout(250)  # gives the slide a moment to draw


def test_home_names_volume_three(page):  # the home page names this volume and its four chapters
    assert page.title() == 'Operating Systems · Chapters 10–13 · Interactive Guide'  # the browser tab title
    title = page.inner_text('#canvas .step-title').replace('⁠', '')  # the big title, without invisible word-joiners
    assert title == 'Operating Systems · Chapters 10–13'  # names the right chapters
    cards = page.locator('#canvas .chcard')  # the chapter cards
    assert cards.count() == 4  # one per chapter
    assert [cards.nth(i).locator('.n').inner_text().strip().upper() for i in range(4)] == ['CHAPTER 10', 'CHAPTER 11', 'CHAPTER 12', 'CHAPTER 13']  # in order, with two-digit numbers
    assert 'Start with Chapter 10' in page.inner_text('#canvas')  # the start button points at the first chapter of this volume
    assert page.evaluate("document.querySelector('#canvas .home-hero .chip.accent').textContent") == '4 chapters · 31 sections'  # the count chip
    widths = [cards.nth(i).bounding_box()['width'] for i in range(4)]  # the cards' widths
    assert max(widths) - min(widths) < 2 and widths[0] > 200  # they share the row equally


def test_every_section_registered_in_order(page):  # all 31 sections load, in numeric (not text) order
    ids = page.evaluate("Object.values(Guide.sections).map(s => s.id)")  # the ids of every registered section
    assert sorted(ids, key=lambda s: tuple(map(int, s.split('.')))) == SECTIONS  # exactly the 31 expected sections
    assert page.evaluate("Guide.debug.registerErrors().length") == 0  # none of them failed to register
    keys = [s['key'] for s in page.evaluate('Guide.debug.slides()')]  # every slide key in reading order
    for c in ('ch10', 'ch11', 'ch12', 'ch13', 'ch10-terms', 'ch13-quiz', 'final'):  # chapter pages, key terms, chapter challenge, final challenge
        assert c in keys  # each one exists
    secs = []  # secs: the sections in the order their first slides appear
    for k in keys:  # walks the slides in order
        s = k.split('/')[0]  # the section part of a key such as '11.10/3'
        if s in SECTIONS and s not in secs:  # first slide of a section
            secs.append(s)  # remembers the order
    assert secs == SECTIONS  # 11.10 comes after 11.9 and 12.10, 12.11 after 12.9 on the page itself
    assert not any(k.split('/')[0] in ('1', '2', '3', '4', '5', '6', '7', '8', '9') or k.startswith(('1.', '2.', '3.', '4.', '5.', '6.', '7.', '8.', '9.')) for k in keys)  # no earlier-volume slide sneaks in


def test_two_digit_ids_display(page):  # a section such as 11.10 shows its full number everywhere
    go(page, '11.10/1')  # the first step of section 11.10
    assert page.inner_text('#canvas .step-eyebrow .sid').strip() == '11.10'  # the step header names 11.10, not 11.1
    assert page.inner_text('.bb-count').startswith('11.10')  # so does the counter in the bottom bar
    page.keyboard.press('t')  # opens the table of contents
    toc = page.inner_text('.drawer.left.on')  # its text
    assert toc.index('11.9') < toc.index('11.10')  # 11.10 is listed after 11.9
    page.keyboard.press('Escape')  # closes it


def test_progress_is_stored_apart_from_both_earlier_volumes(ctx):  # each volume remembers its own place
    pg1 = open_page(ctx, HTML1)  # the chapters 1-5 page
    pg1.evaluate('localStorage.clear()')  # starts with no saved progress at all
    pg1.reload(); pg1.wait_for_function(READY)  # reloads clean
    go(pg1, '3.2/2')  # visits a chapter 3 step
    pg2 = open_page(ctx, HTML2)  # the chapters 6-9 page
    go(pg2, '7.3/2')  # visits a chapter 7 step
    pg3 = open_page(ctx, HTML3)  # the chapters 10-13 page
    go(pg3, '12.3/2')  # visits a chapter 12 step
    pg3.wait_for_timeout(300)  # lets the save happen
    keys = pg3.evaluate('Object.keys(localStorage)')  # every storage name now in use
    assert {'os-guide-v1', 'os-guide-ch6-9-v1', 'os-guide-ch10-13-v1'} <= set(keys)  # one per volume
    last = lambda k: pg3.evaluate(f"JSON.parse(localStorage.getItem('{k}')).last")  # last(k): the last slide saved under a storage name
    assert last('os-guide-v1') == '3.2/2' and last('os-guide-ch6-9-v1') == '7.3/2' and last('os-guide-ch10-13-v1') == '12.3/2'  # none overwrote another
    go(pg3, 'home')  # back to this volume's home page
    assert 'Continue: 12.3' in pg3.inner_text('#canvas')  # it offers this volume's own place
    assert not pg1.errors and not pg2.errors and not pg3.errors  # no script errors on any page


def test_earlier_volume_terms_name_their_volume(page):  # borrowed glossary terms say which earlier guide taught them
    v1 = page.evaluate("(() => { const g = Guide.lookupTerm('semaphore'); return g && g.src; })()")  # a chapters 1-5 word
    assert v1 and v1.startswith('prior:'), v1  # it is borrowed, not redefined here
    v2 = page.evaluate("(() => { const g = Guide.lookupTerm('page frame'); return g && g.src; })()")  # a chapters 6-9 word
    assert v2 and v2.startswith('prior:'), v2  # also borrowed
    page.keyboard.press('g')  # opens the glossary
    page.fill('.drawer.right.on .dr-search', 'semaphore')  # searches for the volume-1 word
    assert 'Ch 1–5 guide' in page.locator('.drawer.right.on .gl-item', has_text='Semaphore').first.inner_text()  # labelled with volume 1
    page.fill('.drawer.right.on .dr-search', 'page frame')  # searches for the volume-2 word
    item = page.locator('.drawer.right.on .gl-item', has_text='Page frame').first  # its entry
    assert 'Ch 6–9 guide' in item.inner_text()  # labelled with volume 2
    before = page.evaluate('Guide.debug.current()')  # the slide on screen now
    item.locator('.src').click()  # a borrowed term's tag is not a link to another page
    assert page.evaluate('Guide.debug.current()') == before  # so clicking it goes nowhere


def test_no_undefined_terms_on_any_slide(page):  # every underlined word on every slide has a definition
    bad = page.evaluate("""(() => { const out = [];
      for (const s of Guide.debug.slides()) { Guide.debug.go(s.key); const m = Guide.debug.metrics();
        if (m && m.badTerms.length) out.push(s.key + ': ' + m.badTerms.join(', ')); }
      return out; })()""")  # visits every slide and collects any underlined word with no glossary entry
    assert not bad, bad  # none allowed


def test_final_challenge_draws_from_volume_three(page):  # the final challenge only asks about chapters 10-13
    go(page, 'final')  # the final challenge slide
    assert page.inner_text('#canvas .step-title') == 'Final challenge: all four chapters'  # its title
    srcs = page.evaluate("[...document.querySelectorAll('#canvas .quiz-src')].map(e => e.textContent)")  # the section tag on each question
    assert srcs and all(s.startswith(('§10', '§11', '§12', '§13')) for s in srcs), srcs  # every question comes from this volume


def test_print_view(ctx):  # the printable study guide holds every chapter and section
    pg = ctx.new_page()  # a new tab
    pg.goto(HTML3 + '?print')  # the print layout
    pg.wait_for_selector('.print-doc')  # waits for it to be built
    assert 'Chapters 10' in pg.title() and 'Study Guide' in pg.title()  # the document title names this volume
    txt = pg.inner_text('.print-doc')  # all of its text
    for c in ('Chapter 10', 'Chapter 11', 'Chapter 12', 'Chapter 13', '11.10', '12.11'):  # chapter headings and two-digit sections
        assert c in txt  # each one is printed
    assert pg.locator('.p-sec').count() == 31  # one printed block per section


@pytest.mark.parametrize('url', [HTML3])  # the keyboard behaviour of glossary terms on this volume
def test_terms_work_from_the_keyboard(ctx, url):  # a dotted term opens and closes its definition from the keyboard
    pg = open_page(ctx, url)  # opens the page
    go(pg, '10.1/1')  # a section step full of underlined terms
    term = pg.locator('#canvas .t').first  # the first underlined term
    assert term.get_attribute('tabindex') == '0' and term.get_attribute('role') == 'button'  # it can be reached with Tab and acts as a button
    term.focus()  # puts keyboard focus on it
    pg.keyboard.press('Enter')  # Enter opens the definition
    assert pg.locator('#term-pop.on').count() == 1  # the popup is showing
    pg.keyboard.press('Escape')  # Escape closes it
    assert pg.locator('#term-pop.on').count() == 0  # the popup is gone
    assert not pg.errors  # no script errors
