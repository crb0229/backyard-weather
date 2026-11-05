"""Browser checks for the TV test page's holiday themes, run in the installed Microsoft Edge.

Usage: py -3 tests/holiday/browser_check.py <screenshot_dir> [name-filter]
Serves the repo locally, opens tv-test.html for each case and checks colors, greeting, font, picture,
toggle and startup animation. Prints PASS/FAIL per case; exits non-zero on any failure.
"""
import datetime as dt
import functools
import http.server
import os
import socketserver
import sys
import threading
import traceback

from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PORT = 8768
BASE = f"http://127.0.0.1:{PORT}"
MAIN = {   # id: (preview date, bg, greeting, font family)
    "christmas": ("2026-12-20", "#121a17", "Merry Christmas", "Mountains of Christmas"),
    "halloween": ("2026-10-31", "#1d1418", "Happy Halloween", "Griffy"),
    "thanksgiving": ("2026-11-26", "#1c1612", "Happy Thanksgiving", "Kaushan Script"),
    "july4": ("2026-07-04", "#111827", "Happy Fourth of July", "Alfa Slab One"),
    "easter": ("2026-04-05", "#1c1924", "Happy Easter", "Sniglet"),
    "newyear": ("2027-01-01", "#121216", "Happy New Year", "Great Vibes"),
    "may4": ("2026-05-04", "#0a0d14", "May the 4th be with you", "Orbitron"),
}
CASES = []


def case(fn):
    CASES.append(fn)
    return fn


class Ctx:
    def __init__(self, browser, out):
        self.browser, self.out = browser, out

    def page(self, date=None, clock=None, init=None, block=None, session=False, reduced=False):
        """Open tv-test.html. clock: local datetime to freeze the page clock at (it still runs).
        init: JS run before page scripts. block: URL glob answered with 404. session: pretend a reload (session flag set)."""
        ctx = self.browser.new_context(viewport={"width": 1920, "height": 1080}, reduced_motion="reduce" if reduced else "no-preference")
        p = ctx.new_page()
        p.errors = []
        p.on("pageerror", lambda e: p.errors.append(str(e)))
        if clock:
            p.clock.install(time=clock)
        p.add_init_script("try{localStorage.setItem('wx:loc', JSON.stringify({station:true}))}catch(e){}")
        if session:
            p.add_init_script("try{sessionStorage.setItem('wx:session','1')}catch(e){}")
        if init:
            p.add_init_script(init)
        if block:
            p.route(block, lambda r: r.fulfill(status=404, body=""))
        p.goto(f"{BASE}/tv-test.html" + (f"?date={date}" if date else ""))
        p.wait_for_timeout(2500)
        return p

    def shot(self, p, name):
        p.screenshot(path=os.path.join(self.out, f"{name}.png"))


def var(p, name):
    return p.evaluate(f"getComputedStyle(document.documentElement).getPropertyValue('{name}').trim().toLowerCase()")


def default_bg(p):
    """The page's own background without a holiday: lifted slate by day, dark at night."""
    return "#27323d" if p.evaluate("document.documentElement.classList.contains('day')") else "#0f151b"


def no_errors(p):
    assert not p.errors, f"page errors: {p.errors}"


# ---------- Task 3: colors, font, greeting, picture ----------

for _id, (_date, _bg, _greet, _font) in MAIN.items():
    def _make(i=_id, date=_date, bg=_bg, greet=_greet, font=_font):
        def t(c):
            p = c.page(date=date)
            assert var(p, "--bg") == bg, f"--bg {var(p, '--bg')} != {bg}"
            assert p.text_content("#holiday").strip() == greet, p.text_content("#holiday")
            fam = p.evaluate("getComputedStyle(document.getElementById('holiday')).fontFamily")
            assert font in fam, f"font {fam}"
            ok = p.evaluate("""(() => { const h = document.getElementById('holPic'); if (!h) return false;
              const i = h.querySelector('img'); if (i) return i.complete && i.naturalWidth > 0;
              const s = h.querySelector('svg'); return !!s && s.childNodes.length > 0; })()""")
            assert ok, "#holPic has no loaded picture"
            no_errors(p)
            c.shot(p, f"theme-{i}")
        t.__name__ = f"theme_{i}"
        return t
    case(_make())


@case
def greeting_only_valentines(c):
    p = c.page(date="2026-02-14")
    assert p.text_content("#holiday").strip() == "Happy Valentine's Day"
    assert var(p, "--bg") == default_bg(p), var(p, "--bg")
    assert p.evaluate("!document.getElementById('holPic') || document.getElementById('holPic').children.length === 0")
    no_errors(p)


@case
def no_holiday(c):
    p = c.page(date="2026-08-12")
    assert p.text_content("#holiday").strip() == ""
    assert var(p, "--bg") == default_bg(p), var(p, "--bg")
    assert p.evaluate("!document.getElementById('holFont')"), "font link loaded with no holiday"
    no_errors(p)


@case
def day_theme_keeps_holiday_colors(c):
    p = c.page(clock=dt.datetime(2026, 12, 20, 13, 0))
    default_accent = "#7cc0ee" if p.evaluate("document.documentElement.classList.contains('day')") else "#6fb0de"
    assert var(p, "--bg") == "#121a17", var(p, "--bg")
    assert var(p, "--accent") == default_accent, var(p, "--accent")
    no_errors(p)


@case
def missing_picture_hidden(c):
    p = c.page(date="2026-12-20", block="**/img/holiday/christmas-present.webp")
    p.wait_for_timeout(500)
    broken = p.evaluate("[...document.querySelectorAll('#holPic img')].some(i => i.offsetWidth > 0 && !(i.complete && i.naturalWidth > 0))")
    assert not broken, "broken image icon visible"
    assert p.text_content("#holiday").strip() == "Merry Christmas"
    no_errors(p)


# ---------- Task 4: theme on/off button ----------

def focus_theme_btn(p):
    for _ in range(12):
        if p.evaluate("document.activeElement && document.activeElement.id") == "themeBtn":
            return
        p.keyboard.press("Tab")
    raise AssertionError("could not reach #themeBtn with Tab")


@case
def toggle_off_and_on(c):
    p = c.page(date="2026-10-31")
    assert p.is_visible("#themeBtn") and p.text_content("#themeBtn").strip() == "Theme: On", "button missing or wrong text"
    focus_theme_btn(p)
    p.keyboard.press("Enter")
    p.wait_for_timeout(300)
    assert var(p, "--bg") == default_bg(p), var(p, "--bg")
    assert p.evaluate("document.getElementById('holPic').children.length === 0"), "picture still shown"
    assert p.text_content("#holiday").strip() == "Happy Halloween", "greeting must stay"
    assert p.text_content("#themeBtn").strip() == "Theme: Off"
    p.reload()
    p.wait_for_timeout(2500)
    assert p.text_content("#themeBtn").strip() == "Theme: Off", "Off not remembered"
    assert var(p, "--bg") == default_bg(p)
    focus_theme_btn(p)
    p.keyboard.press("Enter")
    p.wait_for_timeout(300)
    assert var(p, "--bg") == "#1d1418", "theme did not come back"
    assert p.text_content("#themeBtn").strip() == "Theme: On"
    no_errors(p)


@case
def toggle_hidden_without_main_theme(c):
    for date in ("2026-02-14", "2026-08-12"):
        p = c.page(date=date)
        assert not p.is_visible("#themeBtn"), f"button visible on {date}"
        no_errors(p)


@case
def toggle_works_when_storage_blocked(c):
    p = c.page(date="2026-10-31", init="Storage.prototype.setItem = function(){ throw new Error('blocked') }; Storage.prototype.getItem = function(){ throw new Error('blocked') };")
    assert var(p, "--bg") == "#1d1418"
    p.click("#themeBtn")
    p.wait_for_timeout(300)
    assert var(p, "--bg") == default_bg(p), "toggle did nothing with storage blocked"
    no_errors(p)


def main():
    out, flt = sys.argv[1], (sys.argv[2] if len(sys.argv) > 2 else "")
    os.makedirs(out, exist_ok=True)
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass
    handler = functools.partial(Quiet, directory=ROOT)
    socketserver.TCPServer.allow_reuse_address = True
    srv = socketserver.ThreadingTCPServer(("127.0.0.1", PORT), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    failed = 0
    with sync_playwright() as pw:
        browser = pw.chromium.launch(channel="msedge")
        c = Ctx(browser, out)
        for t in [t for t in CASES if flt in t.__name__]:
            try:
                t(c)
                print(f"PASS {t.__name__}")
            except Exception as e:
                failed += 1
                print(f"FAIL {t.__name__}: {e if isinstance(e, AssertionError) else traceback.format_exc(limit=1)}")
        browser.close()
    srv.shutdown()
    print(f"{len([t for t in CASES if flt in t.__name__]) - failed} passed, {failed} failed")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
