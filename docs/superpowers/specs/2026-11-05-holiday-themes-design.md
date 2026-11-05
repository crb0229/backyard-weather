# Holiday Themes for the TV Page: Design

Date: 2026-11-05. Owner: Chris Brown. Status: draft for approval.

## Why

The current holiday themes on the TV page look plain and cheap. For example, the Halloween "leaves" are small ovals that do not look like leaves. Chris wants each main holiday to feel special on the living-room TV and still stay calm: one good picture, a title in a font that suits the holiday, and soft holiday colors across the screen. Animation is welcome only if it looks good, and only briefly when the app opens.

## Scope

**Test files only:** `tv-test.html` and `app-test.js`. Do not change `tv.html`, `app.js`, `index.html`, `wx.py` or the Android app.

### Goals

1. **Seven main holidays get a full theme:** Christmas, Halloween, Thanksgiving, Fourth of July, Easter, New Year's and May the 4th. Each theme has:
   - one picture beside the greeting in the header;
   - a greeting in a holiday-specific font;
   - soft, warm holiday colors across the whole screen;
   - a short startup animation.
2. **Six other holidays show only the greeting text** in the header, with no picture, no colors and no animation: Valentine's Day, St. Patrick's Day, Mother's Day, Memorial Day, Father's Day and Labor Day.
3. **A "Theme: On / Off" button** in the header, operable with the TV remote.
4. **On May the 4th, the moon on the "Sun and moon today" slide becomes a Death Star**, drawn in tonight's real moon phase.
5. **Five holidays use the Grok images Chris made** (see "Images" below). Each theme's config names its picture, so any picture can be swapped later by changing the config only.

### Non-goals

- The live TV page, the phone page and the data job are not changed.
- No pictures, colors or animations for the six greeting-only holidays.
- Making or editing the Grok images is not part of this work.
- Kawasaki branding does not apply. This is a personal home project.

### Anti-goals (a failure even if it works)

- Bright, neon or loud colors. Everything must stay soft and warm.
- Weather information that is hard to read, or covered for more than a moment.
- An animation that replays on every 15-minute auto-reload.
- A slower first load of the weather data.
- Star Wars logos, the Star Wars logo font, official artwork or photos.
- A scary Halloween. It should be friendly and autumnal.

## Approved visuals

The mockups Chris approved are in `docs/superpowers/specs/2026-11-05-holiday-themes-mockups/`. They are HTML fragments; the SVG drawings and palettes in them are the reference to build from.

| File | What Chris approved |
|---|---|
| `halloween-scope.html` | Option **B**: holiday colors across the whole screen, soft and warm. |
| `seven-themes.html` | Title font and palette for each holiday. Use its drawn pictures only as a fallback; see "Images" for the pictures to use. |
| `july4-flag-v2.html` | The Fourth of July picture: a waving flag whose stripes and 50 stars bend with the cloth, with a 6-second ripple that settles to a resting wave. Fix one artifact: the fold shading is drawn as thin slices, which shows faint vertical seams at large size. Use smooth shading, such as a gradient that follows the wave. |
| `deathstar-v2.html` | The Death Star: curved panels, steel shading, recessed dish, equator trench, station lights, and a shadow shaped by the real moon phase. Chris rejected an earlier version because its straight lines did not follow the sphere. |

### Images

Chris made these with Grok from the brief at `C:\Users\encrb01\OneDrive - Kawasaki Motors Corp., U.S.A\Claude\backyard-weather-grok-image-brief.md`. They are in `holiday-images/img/holiday/`. Claude checked them: all are transparent PNGs with no halo, the main pictures are 1024 px, and the sprites are 512 px.

- **Main pictures:**
  - `christmas-present.png`
  - `halloween-pumpkin.png`
  - `thanksgiving-leaves.png`
  - `easter-bunny.png`
  - `newyear-glasses.png`
- **Animation sprites:**
  - `sprite-snowflake.png` (Christmas)
  - `sprite-bat.png` (Halloween)
  - `sprite-maple-rust.png`, `sprite-maple-amber.png` and `sprite-oak-gold.png` (Thanksgiving)
  - `sprite-confetti.png` (New Year's)
- **Preparation:**
  - Move the images to `img/holiday/`.
  - Convert them to WebP with alpha, at about 512 px for the main pictures and 256 px for the sprites, aiming for 100 KB or less each.
  - Keep the PNG originals out of the deployed page. Remove the `holiday-images/` folder once the WebP files are in place.
- **Known flaw:** the tops of `newyear-glasses.png` and the tip of `sprite-oak-gold.png` touch the frame edge. Chris accepted this; use them as they are.
- **Drawn, not images:**
  - The Fourth of July flag (it must ripple).
  - The May the 4th Death Star (its shadow follows the moon phase).
  - Any snowflake, firework, bubble or star-streak effect that has no sprite.

### Per-holiday specification

| Holiday | Date window | Greeting | Title font (Google Fonts) | Picture | Startup animation |
|---|---|---|---|---|---|
| Christmas | Dec 1–26 | Merry Christmas | Mountains of Christmas 700 | Wrapped present | Six-point snowflakes drift down slowly for about 8 s, then fade. |
| Halloween | Oct 25–31 | Happy Halloween | Griffy | Pumpkin | The pumpkin glows like a candle while a few bats flutter across once. |
| Thanksgiving | Thanksgiving −3 to +1 day | Happy Thanksgiving | Kaushan Script | Maple-leaf cluster | Maple leaves tumble down across the screen once. |
| Fourth of July | Jul 1–5 | Happy Fourth of July | Alfa Slab One | Waving flag | The flag ripples about 6 s while 3–4 soft fireworks burst behind the title. |
| Easter | Easter −2 to 0 days | Happy Easter | Sniglet 800 | Bunny with painted egg | The bunny hops in from the left and sits beside the title. |
| New Year's | Dec 31 and Jan 1 | "Happy New Year's Eve" on Dec 31, "Happy New Year" on Jan 1 | Great Vibes | Champagne glasses | A short shower of gold confetti and rising bubbles. |
| May the 4th | May 4 | May the 4th be with you | Orbitron 600 | Death Star | A jump-to-lightspeed star streak, then the screen settles. |

The date windows, except May the 4th, are the ones in the current `holiday()` function in `tv-test.html`.

The palettes are in `seven-themes.html` (classes `.xmas`, `.hall`, `.thx`, `.july`, `.east`, `.ny`, `.may`), as background, panel, border and title colors. May the 4th also has a faint star field behind the screen.

## Behavior (all confirmed by Chris)

### Colors

- A theme recolors only the page background, panels, panel borders and the greeting.
- Weather colors do not change: the radar, chart lines, temperature high/low colors, the freeze and frost flags, alert colors and the station-green "yard" values keep their current meaning.

### Startup animation

Some TVs run the page around the clock; others open and close it as needed. The animation plays:

- **when the page is opened** during the daytime (outside 11 PM to 6 AM);
- **once each holiday day** on a TV left running: the first time the page shows in the daytime that day, which in practice is just after the 6 AM dim ends, if it has not already played that day;
- **when the theme is switched back on** with the remote.

It never plays on the automatic 15-minute reload, unless that reload is the first daytime showing of the holiday day.

- It lasts no more than about 8 seconds. Afterwards nothing keeps running: no animation loop, and the overlay is removed.
- It may pass over the screen, but it must not hide the numbers for more than a moment.

### The on/off button

- **Location:** "Theme: On / Off" sits in the header next to the "Caledonia, MI" button.
- **Remote control:** it is reached with the remote's arrow keys and pressed with OK. It needs a clearly visible focus outline.
- **When it shows:** only during one of the seven main holidays. The six greeting-only holidays have nothing to switch off.
- **What Off does:** removes the colors, picture and animation, and keeps the greeting text.
- **How long Off lasts:** the TV remembers Off for that holiday. When the next themed holiday starts, the theme is on again.

### Night (11 PM to 6 AM, the existing dim period)

- Colors and picture stay.
- Nothing animates. An app opened at night does not play the animation then; it plays at the first daytime showing instead, under the once-each-holiday-day rule.

### May the 4th moon

- The Death Star replaces both the NASA moon photo and the drawn moon on the "Sun and moon today" slide.
- It uses tonight's phase: the same lit fraction and waxing/waning calculation as the moon drawing in `showSunMoon`.
- The phase text ("Waning crescent", "19% lit", and so on) stays.

### Preview

`?date=YYYY-MM-DD` on `tv-test.html` already previews a holiday. It must:

- show the full theme for that date, and
- always play the startup animation, so Chris can review it.

## Constraints

- **Chris tests in a web browser on the TV**, opening `https://crb0229.github.io/backyard-weather/tv-test.html`. The installed app stays on `tv.html`. In production the same code will later run in the app's Android WebView (minSdk 26).
  - The browser and its Chromium version are unknown, so use widely supported features: canvas 2D, CSS transforms and opacity, and SVG masks and blur, which the approved mockups already use.
  - Avoid newer APIs.
  - Keep animations light. The existing holiday canvas runs at about 30 frames per second, and that rate is acceptable.
- **Telling an app open from an auto-reload** must work in both a browser tab and the app.
  - Record "played on this holiday day" in `localStorage`.
  - Use a session flag (for example `sessionStorage`) only for "this load is a fresh open, not a reload".
- **Load the holiday font only on that holiday.** Do not add fonts to every page load.
- **The page must still work if storage is unavailable** (`localStorage` or `sessionStorage` throwing). The theme then simply stays on.
- **Honor `prefers-reduced-motion`:** no animation when it is set.
- **External sources are limited.** Fonts may come only from Google Fonts. Pictures are inline SVG now, and later local files in `img/holiday/`. No other outside images.
- **Existing behavior must keep working:**
  - the late-night dim;
  - the burn-in nudge;
  - the radar pause at night;
  - the day/night page theme;
  - the alert border;
  - the summary line;
  - the slide rotation.

## Left to the builder

- Whether the theme code stays inline in `tv-test.html` or moves to a new test-only script loaded by `tv-test.html`.
- The exact mechanism for detecting a fresh open versus an auto-reload, within the constraint above. In a browser, a tab that stays open may keep its session, and that is acceptable: the once-each-holiday-day rule still plays it.
- **How themes and the day/night page theme interact.** Default: the holiday palette replaces the background, panel and border colors at all hours. The daytime "lifted" look should not undo the holiday colors.
- The exact picture size in the header (around the height of the title text, up to about twice that). The header must not grow so much that the panels lose height.
- **The exact particle counts, speeds and shapes** for each animation, within the descriptions above and the "soft, not loud" rule.
- **How pictures are wired:** each theme's config names either an image file or a drawn picture.
- **How to test,** including screenshots per holiday with `?date=`, toggle checks with the keyboard, and a reload check.

## Calls made by Claude, not yet confirmed by Chris

- May the 4th lasts one day only.
- The toggle is hidden on greeting-only holidays.
- The header picture on May the 4th also shows the Death Star in tonight's phase.
- `?date=` previews always play the animation.
- `prefers-reduced-motion` is honored, even though some TVs may have it switched on. If animations never appear on Chris's TV, this is the first thing to check.

## Prior state, for reference

- `tv-test.html` contains `holiday()` (date windows), `fx` (the current canvas animation engine: ovals, hearts, shamrocks, snow dots, fireworks) and `check()` (runs each minute: dim, holiday greeting, fx).
- `fx` and its oval, heart and shamrock pieces are replaced by this work.
- `app-test.js` draws the moon in `showSunMoon` and loads the NASA moon photo in `moonPhoto`.

---

*Prepared with Anthropic Claude, Opus 5.5. Not reviewed by a person beyond Chris Brown's answers in the design conversation.*
