// TEST: holiday themes for tv-test.html. This part has no page code, so Node can test it (tests/holiday/logic.test.js).
// Seven main holidays get a picture, a holiday font, soft colors and a short startup animation; six others get only a greeting.
(function (root) {
  const D = (y, m, day) => new Date(y, m - 1, day);
  const add = (dt, n) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() + n);
  const nth = (y, m, wd, n) => { const f = new Date(y, m - 1, 1); return new Date(y, m - 1, 1 + (wd - f.getDay() + 7) % 7 + 7 * (n - 1)); };
  const last = (y, m, wd) => { const l = new Date(y, m, 0); return new Date(y, m - 1, l.getDate() - (l.getDay() - wd + 7) % 7); };
  function easter(y) {
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, h = (19 * a + b - Math.floor(b / 4) - Math.floor((b - Math.floor((b + 8) / 25) + 1) / 3) + 15) % 30;
    const l = (32 + 2 * (b % 4) + 2 * Math.floor(c / 4) - h - c % 4) % 7, mm = Math.floor((a + 11 * h + 22 * l) / 451);
    return new Date(y, Math.floor((h + l - 7 * mm + 114) / 31) - 1, (h + l - 7 * mm + 114) % 31 + 1);
  }
  const fixed = text => () => text;
  const greet = (id, text, color, range) => ({id, main: false, greeting: fixed(text), color, range});

  const THEMES = [
    {id: "newyear", main: true, range: y => [[D(y, 1, 1), D(y, 1, 1)], [D(y, 12, 31), D(y, 12, 31)]],
      greeting: d => (d.getMonth() === 11 ? "Happy New Year's Eve" : "Happy New Year"),
      offYear: d => (d.getMonth() === 0 ? d.getFullYear() - 1 : d.getFullYear()),   // Dec 31 and the Jan 1 after it are one holiday
      font: {family: "Great Vibes", css: "Great+Vibes"}, palette: {bg: "#121216", panel: "#1b1b22", line: "#4a4030", title: "#e8c86a"},
      picture: {img: "img/holiday/newyear-glasses.webp"}, intro: "confetti"},
    greet("valentines", "Happy Valentine's Day", "#e0607e", y => [[D(y, 2, 10), D(y, 2, 14)]]),
    greet("stpatricks", "Happy St. Patrick's Day", "#3fae5a", y => [[D(y, 3, 14), D(y, 3, 17)]]),
    {id: "easter", main: true, range: y => [[add(easter(y), -2), easter(y)]], greeting: fixed("Happy Easter"),
      font: {family: "Sniglet", css: "Sniglet:wght@800"}, palette: {bg: "#1c1924", panel: "#232030", line: "#4a4060", title: "#e9c6dc"},
      picture: {img: "img/holiday/easter-bunny.webp"}, intro: "bunny"},
    {id: "may4", main: true, range: y => [[D(y, 5, 4), D(y, 5, 4)]], greeting: fixed("May the 4th be with you"),
      font: {family: "Orbitron", css: "Orbitron:wght@600"}, palette: {bg: "#0a0d14", panel: "#121620", line: "#2a3140", title: "#d9dde6"},
      picture: {draw: "deathstar"}, intro: "lightspeed"},
    greet("mothers", "Happy Mother's Day", "#e48ab0", y => [[add(nth(y, 5, 0, 2), -1), nth(y, 5, 0, 2)]]),
    greet("memorial", "Memorial Day: remembering those who served", "#9fb4c8", y => [[add(last(y, 5, 1), -2), last(y, 5, 1)]]),
    greet("fathers", "Happy Father's Day", "#6fb0de", y => [[add(nth(y, 6, 0, 3), -1), nth(y, 6, 0, 3)]]),
    {id: "july4", main: true, range: y => [[D(y, 7, 1), D(y, 7, 5)]], greeting: fixed("Happy Fourth of July"),
      font: {family: "Alfa Slab One", css: "Alfa+Slab+One"}, palette: {bg: "#111827", panel: "#182235", line: "#3d3a55", title: "#ece4d4"},
      picture: {draw: "flag"}, intro: "flag"},
    greet("labor", "Happy Labor Day", "#d2b48c", y => [[add(nth(y, 9, 1, 1), -2), nth(y, 9, 1, 1)]]),
    {id: "halloween", main: true, range: y => [[D(y, 10, 25), D(y, 10, 31)]], greeting: fixed("Happy Halloween"),
      font: {family: "Griffy", css: "Griffy"}, palette: {bg: "#1d1418", panel: "#251b1f", line: "#4a3326", title: "#e8a35a"},
      picture: {img: "img/holiday/halloween-pumpkin.webp"}, intro: "bats"},
    {id: "thanksgiving", main: true, range: y => [[add(nth(y, 11, 4, 4), -3), add(nth(y, 11, 4, 4), 1)]], greeting: fixed("Happy Thanksgiving"),
      font: {family: "Kaushan Script", css: "Kaushan+Script"}, palette: {bg: "#1c1612", panel: "#261d17", line: "#5a3d24", title: "#e0a35a"},
      picture: {img: "img/holiday/thanksgiving-leaves.webp"}, intro: "leaves"},
    {id: "christmas", main: true, range: y => [[D(y, 12, 1), D(y, 12, 26)]], greeting: fixed("Merry Christmas"),
      font: {family: "Mountains of Christmas", css: "Mountains+of+Christmas:wght@700"}, palette: {bg: "#121a17", panel: "#1a2420", line: "#4a2c2c", title: "#e6c27a"},
      picture: {img: "img/holiday/christmas-tree.webp"}, intro: "snow"}];

  function holidayFor(d) {
    const today = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    return THEMES.find(t => t.range(d.getFullYear()).some(([s, e]) => today >= s && today <= e)) || null;
  }
  const pad = n => String(n).padStart(2, "0");
  const dayKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const isNight = d => d.getHours() >= 23 || d.getHours() < 6;

  // Storage that never throws: private windows and locked-down browsers can refuse it. Anything it refuses is kept
  // in the browser tab's name instead (window.name survives the automatic reloads), so Off, "already played today"
  // and "this is a reload" all still hold until the tab or app closes. tag keeps the two stores apart.
  const NAME = "wxhol:";
  function nameData() { try { const n = root.name; return typeof n === "string" && n.startsWith(NAME) ? JSON.parse(n.slice(NAME.length)) : {}; } catch (e) { return {}; } }
  function safeStore(s, tag) {
    const keep = !!tag && typeof root.name === "string", mem = keep ? nameData()[tag] || {} : {};
    const save = () => { if (keep) { const all = nameData(); all[tag] = mem; try { root.name = NAME + JSON.stringify(all); } catch (e) {} } };
    return {
      get(k) { if (k in mem) return mem[k]; try { return s ? s.getItem(k) : null; } catch (e) { return null; } },
      set(k, v) { try { if (!s) throw 0; s.setItem(k, v); if (k in mem) { delete mem[k]; save(); } } catch (e) { mem[k] = String(v); save(); } },
      del(k) { if (k in mem) { delete mem[k]; save(); } try { if (s) s.removeItem(k); } catch (e) {} }};
  }
  const OFF = "wx:themeOff", PLAYED = "wx:introPlayed";
  const offTag = (t, d) => `${t.id}-${t.offYear ? t.offYear(d) : d.getFullYear()}`;   // one tag per holiday, even across midnight on New Year's
  const isOff = (store, t, d) => !!t && store.get(OFF) === offTag(t, d);   // Off lasts for this holiday only
  function setOff(store, t, d, off) { if (off) store.set(OFF, offTag(t, d)); else if (store.get(OFF) === offTag(t, d)) store.del(OFF); }

  // When the startup animation plays: a preview always; never at night or with reduced motion; on a fresh open;
  // otherwise once per holiday day, so a TV left running sees it the first daytime minute of each holiday day
  function shouldPlayIntro({theme, now, freshOpen, preview, reducedMotion, store}) {
    if (!theme || !theme.main || isOff(store, theme, now)) return false;
    if (preview) return true;
    if (reducedMotion || isNight(now)) return false;
    return freshOpen || store.get(PLAYED) !== `${theme.id}-${dayKey(now)}`;
  }
  const markPlayed = (store, t, now) => store.set(PLAYED, `${t.id}-${dayKey(now)}`);

  // ---------- On the page ----------

  // Show a holiday: soft colors for the whole screen, its font and picture beside the title, or just the greeting.
  // on = false keeps the greeting and drops everything else. Runs every minute, so it only redraws when something changed.
  let shown = null, cur = null;
  function apply(theme, on, d) {
    cur = {theme, d};
    const greeting = theme ? theme.greeting(d) : "", full = !!(theme && theme.main && on);
    const state = `${theme ? theme.id : ""}|${full}|${greeting}`;
    if (state === shown) return;
    shown = state;
    const rootEl = document.documentElement, el = document.getElementById("holiday"), pic = document.getElementById("holPic");
    const btn = document.getElementById("themeBtn");
    btn.hidden = !(theme && theme.main);   // greeting-only holidays have nothing to switch off
    btn.textContent = full ? "Theme: On" : "Theme: Off";
    btn.onclick = toggle;
    rootEl.className = rootEl.className.replace(/\bhol-\S+/g, "").trim();
    const p = full ? theme.palette : null;
    [["--bg", "bg"], ["--panel", "panel"], ["--line", "line"], ["--hol-title", "title"]].forEach(([v, k]) => p ? rootEl.style.setProperty(v, p[k]) : rootEl.style.removeProperty(v));
    let link = document.getElementById("holFont");
    if (full) {
      rootEl.classList.add("hol-on", "hol-" + theme.id);
      if (!link) { link = document.createElement("link"); link.id = "holFont"; link.rel = "stylesheet"; document.head.appendChild(link); }
      link.href = `https://fonts.googleapis.com/css2?family=${theme.font.css}&display=swap`;
      const fam = theme.font.family;   // re-measure once the holiday font itself has arrived (it is wider than the fallback)
      link.onload = () => { if (document.fonts) document.fonts.load(`1em "${fam}"`).then(fitHeader, fitHeader); };
    } else if (link) link.remove();
    setTimeout(fitHeader, 0);
    el.textContent = greeting;
    el.style.color = full ? "" : (theme && theme.color) || "";
    el.style.fontFamily = full ? `"${theme.font.family}", var(--display)` : "";
    pic.innerHTML = "";
    if (!full) return;
    if (theme.picture.img) {
      const img = new Image();
      img.alt = "";
      img.onerror = () => img.remove();   // a missing picture leaves just the greeting, never a broken-image box
      img.src = theme.picture.img;
      pic.appendChild(img);
    } else {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 100 100");
      pic.appendChild(svg);
      if (theme.picture.draw === "flag") root.ART.drawFlag(svg, 0.55, 0);
      else { const m = moonPhase(new Date()); root.ART.drawDeathStar(svg, m.lit, m.waxing, "hdr"); }
    }
  }

  // Tonight's moon phase, the same calculation as the moon on the "Sun and moon" slide (app-test.js showSunMoon)
  function moonPhase(now) {
    const P = 29.530588853, age = (((now - Date.UTC(2000, 0, 6, 18, 14)) / 864e5) % P + P) % P;
    return {lit: (1 - Math.cos(2 * Math.PI * age / P)) / 2, waxing: age < P / 2};
  }
  // May the 4th: the moon slide shows the Death Star instead of the moon, in the same phase
  root.HOLIDAY_MOON = (svg, lit, waxing) => {
    if (typeof document === "undefined" || !document.documentElement.classList.contains("hol-may4")) return false;
    root.ART.drawDeathStar(svg, lit, waxing, "moon");
    return true;
  };

  // Keep the header on one line inside the screen: shrink a long or wide greeting step by step (not below 1.05rem).
  // If it still does not fit, hide the "Updated" time while the theme is on; the page reloads every 15 minutes anyway.
  function fitHeader() {
    const el = document.getElementById("holiday"), upd = document.getElementById("updated");
    if (!el || !upd) return;
    el.style.fontSize = ""; upd.style.display = "";
    if (!document.documentElement.classList.contains("hol-on")) return;
    const over = () => Math.max(...[...document.querySelectorAll("header > span")].map(e => e.getBoundingClientRect().right)) > innerWidth;
    let size = parseFloat(getComputedStyle(el).fontSize);
    const min = parseFloat(getComputedStyle(document.documentElement).fontSize) * 1.05;
    while (over() && size > min) { size = Math.max(min, size - 1); el.style.fontSize = size + "px"; }
    if (over()) upd.style.display = "none";
  }

  // The remote's OK button on "Theme: On/Off". Off lasts for this holiday; switching back on replays the startup animation.
  function toggle() {
    if (!cur || !cur.theme) return;
    const {theme, d} = cur, nowOn = isOff(H.store, theme, d);
    setOff(H.store, theme, d, !nowOn);
    apply(theme, nowOn, d);
    if (nowOn) H.onThemeOn(theme);
    else root.ART.stopIntro();
  }

  // Startup animation. "Fresh open" means this page load is not one of the automatic 15-minute reloads: the
  // session flag survives a reload but not closing the app. The minute check calls this; it plays at most once per load.
  let fresh = null, introDone = false;
  const reducedMotion = () => !!(root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches);
  function freshOpen() {
    if (fresh === null) { fresh = !H.session.get("wx:session"); H.session.set("wx:session", "1"); }
    return fresh;
  }
  function maybeIntro(theme, now, preview) {
    const isFresh = freshOpen();
    if (introDone || !shouldPlayIntro({theme, now, freshOpen: isFresh, preview: !!preview, reducedMotion: reducedMotion(), store: H.store})) return;
    introDone = true;
    markPlayed(H.store, theme, now);
    root.ART.playIntro(theme);
  }
  // Switching the theme back on replays the animation, except at night or with reduced motion
  function onThemeOn(theme) {
    const now = cur && cur.d || new Date();   // the page's Michigan-time clock (a preview date counts as midday)
    if (reducedMotion() || isNight(now)) return;
    markPlayed(H.store, theme, now);
    root.ART.playIntro(theme);
  }

  const H = {THEMES, holidayFor, dayKey, isNight, moonPhase, safeStore, isOff, setOff, shouldPlayIntro, markPlayed, apply, toggle, maybeIntro, onThemeOn};
  if (typeof window !== "undefined") {
    H.store = safeStore((() => { try { return window.localStorage; } catch (e) { return null; } })(), "local");
    H.session = safeStore((() => { try { return window.sessionStorage; } catch (e) { return null; } })(), "session");
    window.addEventListener("resize", () => fitHeader());
    // Refit whenever header text changes: the update time and the clock are filled in after the weather loads
    let queued = false;
    const refit = () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; fitHeader(); }); } };
    window.addEventListener("DOMContentLoaded", () => { const hd = document.querySelector("header"); if (hd) new MutationObserver(refit).observe(hd, {childList: true, subtree: true, characterData: true}); });
  }
  if (typeof module !== "undefined" && module.exports) module.exports = H;
  root.HOLIDAY = H;   // one shared object, so hooks set later (onThemeOn) are the ones the button calls
})(typeof window !== "undefined" ? window : globalThis);
