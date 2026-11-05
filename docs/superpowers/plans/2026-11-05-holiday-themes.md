# Holiday Themes (TV Test Page) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the plain holiday effects on `tv-test.html` with seven full themes, six greeting-only holidays and a remote-operable on/off button. Each full theme has a picture, a holiday font, soft whole-screen colors and a one-time startup animation.

**Architecture:**
- **New logic file `holiday-test.js`:** the theme table, date windows, on/off memory and when-to-play rules. It has no DOM access, so Node can test it.
- **New file `holiday-art-test.js`:** the drawn flag, the Death Star and the startup animations, all on canvas or SVG.
- **`tv-test.html`:** keeps the minute check and gains the header picture and the toggle.
- **`app-test.js`:** gets one hook, so the May the 4th Death Star can replace the moon.

**Tech Stack:**
- Plain browser JavaScript with no build step; Google Fonts.
- Tests: Node's built-in `node:test`, and Python Playwright driving the installed Microsoft Edge (`channel="msedge"`).
- Pillow for the image conversion.

**Spec:** `docs/superpowers/specs/2026-11-05-holiday-themes-design.md` (approved), with mockups in `docs/superpowers/specs/2026-11-05-holiday-themes-mockups/`.

## Global Constraints

- **Files that may change:** `tv-test.html`, `app-test.js`, the new `holiday-test.js` and `holiday-art-test.js`, `img/holiday/`, and `tests/holiday/`. Never `tv.html`, `app.js`, `index.html`, `wx.py`, `android/`.
- **Seven full themes:** Christmas, Halloween, Thanksgiving, Fourth of July, Easter, New Year's, May the 4th.
- **Six greeting-only holidays:** Valentine's, St. Patrick's, Mother's Day, Memorial Day, Father's Day, Labor Day.
- **Recolor only these four:** `--bg`, `--panel`, `--line` and the greeting color. Leave weather colors alone: `--accent`, `--yard`, `--warn`, `--bad`, `--cold`, `--feels`, `--humid`, `--cloud`, `--cloud-fill`, `--accent-fill`, `--night`.
- **Startup animation:** at most about 8 s. Afterwards no `requestAnimationFrame` loop is left running and the overlay element is removed.
- **Night is the existing dim period, 11 PM to 6 AM:** colors and picture stay, nothing animates.
- **Fonts:** load the holiday's Google Font only while that holiday's theme is shown.
- **Storage:** every `localStorage` and `sessionStorage` access must survive a throw. If storage fails, the theme stays on.
- **`prefers-reduced-motion: reduce`:** no startup animation.
- **Allowed outside sources:** Google Fonts only. Pictures come from `img/holiday/*.webp` or are drawn inline.
- **Browser features:** the TV browser version is unknown, so use only canvas 2D, CSS transforms and opacity, and SVG masks and blur.
- **Existing behavior must keep working:**
  - the late-night dim and the burn-in nudge;
  - the radar pause at night;
  - the day/night page theme;
  - the alert border;
  - the summary line;
  - slide rotation;
  - `?date=` preview.
- **Commits:** end every message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Commit locally only; Chris pushes as `crb0229`.

## Review Focus

1. **Storage unavailable** (`localStorage` throws, as in private mode): the theme shows, the toggle still works for the session, and nothing crashes. Test in Task 2.
2. **A TV left running into a holiday:** the page is open at 23:50 on Oct 24 and stays open. Halloween starts at midnight inside the dim period, so no animation. The 06:00 check plays it once, and the 06:15 reload does not. Test in Task 5.
3. **"Off" leaks to other holidays:** Off for Halloween 2026 must not switch off Thanksgiving 2026 or Halloween 2027. Test in Task 2.
4. **Window edges:** Dec 26 is Christmas and Dec 27 is no holiday. Dec 31 says "Happy New Year's Eve" and Jan 1 says "Happy New Year". Thanksgiving 2026 runs Nov 23 to 27. Easter 2027 runs Mar 26 to 28. May 3 and May 5 are not May the 4th. Test in Task 2.
5. **Theme switched off mid-animation:** the animation stops at once and the overlay is removed. Test in Task 5.

---

### Task 1: Holiday images as small WebP files

**Files:**
- Create: `img/holiday/*.webp` (11 files)
- Create: `tests/holiday/convert_images.py`
- Delete: `holiday-images/`, after checking the WebP files

**Interfaces:**
- **Produces:** `img/holiday/christmas-present.webp`, `halloween-pumpkin.webp`, `thanksgiving-leaves.webp`, `easter-bunny.webp`, `newyear-glasses.webp`, `sprite-snowflake.webp`, `sprite-bat.webp`, `sprite-maple-rust.webp`, `sprite-maple-amber.webp`, `sprite-oak-gold.webp` and `sprite-confetti.webp`.

- [ ] **Step 1:** Write `tests/holiday/convert_images.py <src_dir> <dst_dir>`.
  - Resize names that don't start with `sprite-` to 512×512 and `sprite-*` names to 256×256, using LANCZOS.
  - Save each as WebP with alpha (`quality=82, method=6`).
  - After converting, assert each output is RGBA, ≤ 100 KB, and has transparent corners (alpha < 10). Print a table.
- [ ] **Step 2:** Run `py -3 tests/holiday/convert_images.py holiday-images/img/holiday img/holiday`. Expected: 11 rows, all "OK", none over 100 KB. If one is over, lower that file's quality in steps of 5 and run again.
- [ ] **Step 3:** Remove `holiday-images/` with `rm -rf holiday-images`, then confirm `git status` doesn't list it. It was never tracked, and Chris keeps his originals.
- [ ] **Step 4:** Commit `img/holiday tests/holiday/convert_images.py` with the message "TV test: holiday pictures as small WebP files".

### Task 2: Theme table and rules (`holiday-test.js`)

**Files:**
- Create: `holiday-test.js`
- Test: `tests/holiday/logic.test.js`

**Interfaces:**
- **Produces** a global `HOLIDAY`, also exported with `module.exports` when `module` exists:
  - `HOLIDAY.THEMES: Theme[]`. Each `Theme` is `{id, greeting(d: Date) => string, main: boolean, range(y: number) => [Date, Date][], font?: {family, css}, palette?: {bg, panel, line, title}, picture?: {img: string} | {draw: "flag" | "deathstar"}, intro?: "snow" | "bats" | "leaves" | "flag" | "bunny" | "confetti" | "lightspeed"}`. Ranges are inclusive local dates.
  - `HOLIDAY.holidayFor(d: Date) => Theme | null`
  - `HOLIDAY.dayKey(d: Date) => "YYYY-MM-DD"`
  - `HOLIDAY.isNight(d: Date) => boolean`, true when the hour is 23 or later, or before 6
  - `HOLIDAY.safeStore(s: Storage | null) => {get(k) => string | null, set(k, v), del(k)}`. It never throws.
  - `HOLIDAY.isOff(store, theme, d) => boolean` and `HOLIDAY.setOff(store, theme, d, off: boolean)`. These use the key `wx:themeOff` with the value `` `${theme.id}-${d.getFullYear()}` ``.
  - `HOLIDAY.shouldPlayIntro({theme, now, freshOpen, preview, reducedMotion, store}) => boolean` and `HOLIDAY.markPlayed(store, theme, now)`. These use the key `wx:introPlayed` with the value `` `${theme.id}-${dayKey(now)}` ``.

- [ ] **Step 1: Write the failing tests in `tests/holiday/logic.test.js`** with `node:test` and `assert`, loading `../../holiday-test.js` through `require`.
  - `windows`:
    - `holidayFor(new Date(2026,11,26)).id === "christmas"`
    - `holidayFor(new Date(2026,11,27)) === null`
    - `holidayFor(new Date(2026,11,31)).greeting(...) === "Happy New Year's Eve"`
    - `holidayFor(new Date(2027,0,1)).greeting(...) === "Happy New Year"`
    - Nov 23 and Nov 27, 2026 are `"thanksgiving"`; Nov 22 and Nov 28 are not
    - Mar 26 and Mar 28, 2027 are `"easter"`; Mar 29 is not
    - May 4, 2026 is `"may4"`; May 3 and May 5 are `null`
    - Oct 25 and Oct 31, 2026 are `"halloween"`
    - Jul 1 and Jul 5, 2026 are `"july4"`
  - `greetingOnly`:
    - Feb 14, Mar 17, Mother's Day 2026 (May 10), Memorial Day 2026 (May 25), Father's Day 2026 (Jun 21) and Labor Day 2026 (Sep 7) all return a theme with `main === false` and no `palette`, `picture` or `intro`
    - every theme with `main === true` has `palette`, `font`, `picture` and `intro`
    - exactly 7 themes have `main === true`
  - `offScope`:
    - after `setOff(store, halloween, Oct 28 2026, true)`, `isOff` is true for Oct 30 2026, false for Thanksgiving Nov 25 2026, and false for Halloween Oct 28 2027
    - `setOff(..., false)` clears it
  - `storageThrows`: a `safeStore` around an object whose `getItem` and `setItem` throw returns `null` from `get`, and `set` does not throw; `isOff` is false
  - `introRules`, with an in-memory store:
    - `preview: true` returns true even at 02:00
    - night (02:00) returns false
    - `reducedMotion: true` returns false, even when `freshOpen` is true
    - `freshOpen` at 14:00 returns true even after `markPlayed` today
    - not `freshOpen`, 06:00, nothing played today: true
    - the same, after `markPlayed` at 06:00: false at 06:15
    - a `main === false` theme: false
    - a theme that `isOff`: false
- [ ] **Step 2:** Run `node --test tests/holiday/`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement `holiday-test.js`.**
  - Date windows come from the current `holiday()` in `tv-test.html:237-262`, including the Easter, nth-weekday and last-weekday helpers. May the 4th is May 4 only.
  - Fonts, as Google Fonts `css2` family strings:
    - Christmas: `Mountains+of+Christmas:wght@700`
    - Halloween: `Griffy`
    - Thanksgiving: `Kaushan+Script`
    - Fourth of July: `Alfa+Slab+One`
    - Easter: `Sniglet:wght@800`
    - New Year's: `Great+Vibes`
    - May the 4th: `Orbitron:wght@600`
  - Palettes, as `bg`, `panel`, `line` and `title`:
    - christmas: `#121a17`, `#1a2420`, `#4a2c2c`, `#e6c27a`
    - halloween: `#1d1418`, `#251b1f`, `#4a3326`, `#e8a35a`
    - thanksgiving: `#1c1612`, `#261d17`, `#5a3d24`, `#e0a35a`
    - july4: `#111827`, `#182235`, `#3d3a55`, `#ece4d4`
    - easter: `#1c1924`, `#232030`, `#4a4060`, `#e9c6dc`
    - newyear: `#121216`, `#1b1b22`, `#4a4030`, `#e8c86a`
    - may4: `#0a0d14`, `#121620`, `#2a3140`, `#d9dde6`
  - Pictures: the five holidays with Grok images use `{img: "img/holiday/<name>.webp"}`. Fourth of July uses `{draw: "flag"}` and May the 4th uses `{draw: "deathstar"}`.
  - Intros: christmas `snow`, halloween `bats`, thanksgiving `leaves`, july4 `flag`, easter `bunny`, newyear `confetti`, may4 `lightspeed`.
  - Greeting-only greetings are the existing texts in `holiday()`.
- [ ] **Step 4:** Run `node --test tests/holiday/`. Expected: all pass.
- [ ] **Step 5:** Commit `holiday-test.js tests/holiday/logic.test.js` with the message "TV test: holiday theme table and rules".

### Task 3: Apply themes on the page (colors, font, greeting, picture)

**Files:**
- Modify: `tv-test.html`. Header markup at line 134. Old `holiday()` and `fx` at lines 234-320 (remove both). Minute `check()` at lines 322-335. Script loader at line 198. CSS block at lines 81-90.
- Create: `holiday-art-test.js` (stubs only in this task)
- Test: `tests/holiday/browser_check.py`

**Interfaces:**
- **Consumes** `HOLIDAY.*` from Task 2.
- **Produces:**
  - `HOLIDAY.apply(theme: Theme | null, on: boolean)`. It sets or removes the inline root style properties `--bg`, `--panel`, `--line` and `--hol-title`, the root class `hol-on`, and the class `hol-<id>`. It injects one `<link id="holFont">` for the theme's font, removed when off or when there is no holiday. It sets `#holiday` text and font, and fills `#holPic`.
  - Header elements `#holPic` (picture slot) and `#themeBtn` (button, from Task 4), placed after `#placeBtn`.
  - In `holiday-art-test.js`: `ART.drawFlag(svg: SVGElement, amp: number, phase: number)` and `ART.drawDeathStar(svg: SVGElement, lit: number, waxing: boolean, id: string)`. Both are filled in by Tasks 6 and 7; here they draw a plain placeholder shape.
- **Picture size:** `#holPic` is about 2× the title text height and must not grow the header row by more than 3vh.
- **Load order:** the loader at line 198 writes `app-test.js`, then `holiday-art-test.js`, then `holiday-test.js`, each with `?t=Date.now()`.
- **Minute check:** `check()` computes `theme = HOLIDAY.holidayFor(preview ? previewDate : localNow)` and calls `HOLIDAY.apply(theme, !isOff)`. The dim and radar-pause logic at lines 326-330 stays.

- [ ] **Step 1: Write the failing `tests/holiday/browser_check.py`.**
  - It serves the repo root on `127.0.0.1:8768`, launches Edge, seeds `localStorage` with `wx:loc = {"station":true}`, and fails on any `pageerror`.
  - For each case `(date, id)`: christmas 2026-12-20, halloween 2026-10-31, thanksgiving 2026-11-26, july4 2026-07-04, easter 2026-04-05, newyear 2027-01-01, may4 2026-05-04, valentines 2026-02-14, none 2026-08-12. Load `tv-test.html?date=<date>`, wait 4 s, then assert:
    - **Main themes:** `getComputedStyle(documentElement).getPropertyValue('--bg').trim()` equals the palette `bg`. `#holiday` text equals the greeting, and its computed font-family contains the font family name. `#holPic` contains an `img` whose `naturalWidth > 0`, or an `svg` with child nodes.
    - **Valentine's:** `#holiday` text is "Happy Valentine's Day", `--bg` is the default `#0f151b`, and `#holPic` is empty.
    - **No holiday:** `#holiday` is empty, `--bg` is `#0f151b`, and there is no `#holFont` link. Font loads only on the holiday.
  - **Day theme:** load christmas with the clock set to 2026-12-20 13:00 local (`page.clock.install`). `--bg` is still `#121a17`, and the weather color `--accent` is unchanged from the default.
  - **Missing image:** route `**/img/holiday/christmas-present.webp` to a 404. `#holPic` shows no broken-image icon (it is empty or hidden), and the greeting still shows.
  - Save a 1920×1080 screenshot per case to the folder given as `argv[1]`.
- [ ] **Step 2:** Run `py -3 tests/holiday/browser_check.py <scratch>`. Expected: FAIL, because `--bg` mismatches or `#holPic` is missing.
- [ ] **Step 3:** Implement `HOLIDAY.apply`, the header slots and CSS, the loader change, the new `check()` wiring and the `ART` stubs.
  - Remove the old `holiday()`, `fx` and `#holidayFx` code.
  - On image `error`, empty `#holPic`.
  - For May the 4th, add a faint star field: a CSS `radial-gradient` background on `body`, using the dot pattern from `seven-themes.html` `.stars`.
- [ ] **Step 4:** Run `py -3 tests/holiday/browser_check.py <scratch>`. Expected: all pass. View each screenshot and confirm the weather numbers, radar and charts still read normally.
- [ ] **Step 5:** Commit `tv-test.html holiday-art-test.js tests/holiday/browser_check.py` with the message "TV test: holiday colors, fonts, greeting and pictures".

### Task 4: Theme on/off button for the remote

**Files:**
- Modify: `tv-test.html` (header button and CSS) and `holiday-test.js` (button wiring)
- Test: `tests/holiday/browser_check.py` (new cases)

**Interfaces:**
- **Consumes:** `HOLIDAY.apply`, `isOff` and `setOff`.
- **Produces:** `#themeBtn`, with the text "Theme: On" or "Theme: Off".
  - It is shown only when `theme && theme.main`.
  - Pressing it calls `setOff`, then `apply`.
  - When switched to On, it calls `HOLIDAY.onThemeOn(theme)`, a hook that Task 5 fills (a no-op until then).
  - Focus style: `outline: 3px solid var(--accent); outline-offset: 2px` on `:focus-visible` and on `:focus`, because TV browsers may not set `:focus-visible` from a D-pad.

- [ ] **Step 1: Add failing cases to `browser_check.py`.**
  - **Halloween:** `#themeBtn` is visible with the text "Theme: On". Then:
    - Focus it with `Tab` presses until `document.activeElement.id === 'themeBtn'`, press `Enter`, and assert:
      - `--bg` is back to `#0f151b`;
      - `#holPic` is empty;
      - `#holiday` still says "Happy Halloween";
      - the button says "Theme: Off".
    - Reload: it is still Off.
    - Press `Enter` again: the theme is back.
  - **Valentine's:** `#themeBtn` is hidden.
  - **No holiday:** `#themeBtn` is hidden.
  - **Storage throws** (`localStorage.setItem` overridden to throw via `add_init_script`): the toggle still switches colors and no page error is raised.
- [ ] **Step 2:** Run the check. Expected: FAIL (no `#themeBtn`).
- [ ] **Step 3:** Implement the button and its wiring.
- [ ] **Step 4:** Run the check. Expected: all pass.
- [ ] **Step 5:** Commit with the message "TV test: theme on/off button for the remote".

### Task 5: Startup animation engine, play rules and two effects (snow, confetti)

**Files:**
- Modify: `holiday-art-test.js` (engine and effects), `holiday-test.js` (the call site), `tv-test.html` (`check()` calls `maybeIntro`)
- Test: `tests/holiday/browser_check.py` (new cases)

**Interfaces:**
- **Consumes:** `shouldPlayIntro`, `markPlayed`, `safeStore`, `isNight`, and `HOLIDAY.onThemeOn`.
- **Produces:**
  - `ART.playIntro(theme: Theme) => void`. It creates one full-screen `<canvas id="holIntro">` with `pointer-events: none` and a z-index above the panels, runs the theme's effect at about 30 fps for at most 8 s, fades out over the last second, then removes the canvas and stops the loop.
  - `ART.stopIntro()` removes it immediately.
  - `ART.INTROS: Record<intro, (ctx, w, h, tSec, sprites) => void>`.
  - `HOLIDAY.maybeIntro(theme, now, preview)` uses `freshOpen`, read once per page load: true when `sessionStorage` `wx:session` is absent, and the key is then set.
- **Rules:**
  - The minute `check()` calls `maybeIntro`. It plays at most once per page load from `check()`, plus each time `onThemeOn` fires.
  - Turning the theme off, or the dim period starting, calls `ART.stopIntro()`.
  - Sprites are preloaded `Image`s from `img/holiday/sprite-*.webp`. If a sprite is missing, that effect falls back to a simple drawn shape.
- **Effects in this task:**
  - `snow`: drifting `sprite-snowflake` with slow sway and rotation.
  - `confetti`: falling `sprite-confetti` pieces, plus rising drawn bubbles.

- [ ] **Step 1: Add failing cases to `browser_check.py`.**
  - **Christmas preview:** `#holIntro` exists within 2 s and is gone within 9.5 s.
  - **Fresh open in daytime** (clock 2026-12-20 14:00, no `?date`): `#holIntro` appears.
  - **Night open** (clock 2026-12-20 02:00): no `#holIntro` within 3 s.
  - **TV left running:**
    - clock at 2026-10-24 23:50 with `sessionStorage wx:session` already set;
    - advance with `page.clock.run_for` to 2026-10-25 06:00 (the page's `setInterval(check, 60000)` fires): `#holIntro` appears once;
    - then reload at 06:15 with `wx:session` kept: no `#holIntro`.
  - **Toggle off mid-animation:** press `#themeBtn` during the intro, and `#holIntro` is gone within 200 ms.
  - **Reduced motion** (`page.emulate_media(reduced_motion="reduce")`): no `#holIntro`.
  - **New Year's preview:** `#holIntro` appears.
- [ ] **Step 2:** Run the check. Expected: FAIL.
- [ ] **Step 3:** Implement the engine, the rules wiring, and the `snow` and `confetti` effects. Counts and speeds are the builder's choice, staying soft: no more than about 60 particles on screen.
- [ ] **Step 4:** Run the check. Expected: all pass. Take screenshots at 1 s, 4 s and 9 s into the Christmas intro and check that they look soft and that the numbers stay readable.
- [ ] **Step 5:** Commit with the message "TV test: startup animation engine with snow and confetti".

### Task 6: Remaining effects and the Fourth of July flag

**Files:**
- Modify: `holiday-art-test.js`
- Test: `tests/holiday/browser_check.py` (new cases)

**Interfaces:**
- **Consumes:** `ART.INTROS` and `ART.playIntro` (Task 5).
- **Produces:**
  - `ART.drawFlag(svg, amp, phase)`. Port it from `mockups/july4-flag-v2.html`: the same geometry and 50 stars. Replace the 48-slice shading with one `linearGradient` per frame whose stops follow `slope(x)`. This removes the vertical seams.
  - The `#holPic` flag ripples during the July 4 intro and holds at the resting wave (`amp = 0.55`) afterwards.
- **Effects:**
  - `bats`: 3–5 `sprite-bat` cross once with a flapping scaleY. The pumpkin `#holPic img` glows with a CSS `drop-shadow` flicker for the intro's length only.
  - `leaves`: about 20 maple and oak sprites tumble, using a scaleX flip.
  - `flag`: the ripple, plus 3–4 soft firework bursts behind the title, as drawn particles with fading trails.
  - `bunny`: `#holPic` slides in from the left with 3–4 hop arcs over about 3 s, then sits.
  - `lightspeed`: radial star streaks from the screen center for about 2.5 s, then a fade.

- [ ] **Step 1:** Add failing cases: the halloween, thanksgiving, july4, easter and may4 previews each create `#holIntro` (or animate `#holPic` for easter) and finish within 9.5 s. After the July 4 intro, `#holPic svg` contains 13 stripe shapes and 50 star polygons.
- [ ] **Step 2:** Run the check. Expected: FAIL.
- [ ] **Step 3:** Implement the five effects and `drawFlag`.
- [ ] **Step 4:** Run the check. Expected: all pass. Take mid-intro screenshots of each and check that they're soft and not loud.
- [ ] **Step 5:** Commit with the message "TV test: holiday startup animations and waving flag".

### Task 7: Death Star (header and moon slide)

**Files:**
- Modify: `holiday-art-test.js` (`drawDeathStar`), `holiday-test.js` (defines `window.HOLIDAY_MOON`), `app-test.js:273-311` (`showSunMoon` and `moonPhoto`)
- Test: `tests/holiday/browser_check.py` (new case)

**Interfaces:**
- **Consumes:** `ART.drawDeathStar`.
- **Produces:**
  - `ART.drawDeathStar(svg, lit, waxing, id)`, ported from `mockups/deathstar-v2.html`. Keep the curved panels, trench, dish, lights and phase mask. Use the pale steel-blue focus dot `#cfe0f0`.
  - `window.HOLIDAY_MOON(svg: SVGElement, lit: number, waxing: boolean) => boolean`. It draws and returns true only while the May the 4th theme is on.
- **Changes in `app-test.js`:** `showSunMoon` calls `window.HOLIDAY_MOON` right after computing `lit` and `waxing`. If it returns true, `showSunMoon` skips its own moon drawing and `moonPhoto()`.
- **Header:** the header `#holPic` on May the 4th draws the Death Star in the same phase. It computes `lit` and `waxing` with the same `age`, `P` and `lit` formula as `showSunMoon` (copied into a shared `HOLIDAY.moonPhase(now) => {lit, waxing}`).

- [ ] **Step 1:** Add a failing case: on the May the 4th preview, after the "Sun and moon" slide is forced on, `#moonPic` contains more than 100 child elements (the panels), no `.moonPhoto` image is present, and the moon name text still shows. With the toggle Off, `#moonPic` is the normal two-element moon drawing after the next `showSunMoon`, which runs on the 15-minute reload; the test reloads.
- [ ] **Step 2:** Run the check. Expected: FAIL.
- [ ] **Step 3:** Implement it.
- [ ] **Step 4:** Run the check. Expected: all pass. Take a screenshot of the moon slide on May 4 2026 and visually match it to the approved mockup.
- [ ] **Step 5:** Commit `holiday-art-test.js holiday-test.js app-test.js tests/holiday/browser_check.py` with the message "TV test: May the 4th Death Star in the moon phase".

### Task 8: Full pass and handoff

- [ ] **Step 1:** Run `node --test tests/holiday/` and `py -3 tests/holiday/browser_check.py <scratch>`. Expected: all pass with no page errors.
- [ ] **Step 2:** Confirm the untouched files are untouched: `git diff --stat origin/main -- tv.html app.js index.html wx.py android` is empty.
- [ ] **Step 3:** Put one screenshot per holiday (all seven main themes, one greeting-only holiday and no holiday) together for Chris, and list the `?date=` review links.
- [ ] **Step 4:** Commit any test fixes. Tell Chris the push command:
  `git pull --rebase origin main && git push https://crb0229@github.com/crb0229/backyard-weather.git main`
