# Local Weather TV

A full-screen weather dashboard built for a smart TV, showing conditions at the backyard Ambient Weather station in West Michigan, live radar, a rotating set of detail panels, and a station-tuned forecast.

Live TV page: https://crb0229.github.io/backyard-weather/tv.html  
Android TV app (APK): https://crb0229.github.io/backyard-weather/tv.apk

## What you see on the TV

- **Always on the left:** local radar loop (KGRR area).
- **Always on the right top:** current station temperature (large) plus key readings (humidity, pressure, rain, etc.), a wind compass whose arrow sways around the wind direction, and wind cups that spin with the wind speed and gusts. Stale readings are flagged.
- **Rotating detail panel** (10-day outlook stays up longest):
  - 10-day temperature, sky, precipitation, and wind charts
  - Next 9 hours + evening sky conditions
  - Sun & moon (with phase graphic)
  - Space Station passes visible from home
  - Wind outlook
- Holiday greetings and light animations (snow, fireworks, etc.) on the appropriate dates.
- OLED burn-in protection (tiny screen nudge) and late-night dimming.
- Alerts, freeze/frost flags, rain/storm callouts, and a clock in Michigan time.

Everything is sized for a 16:9 TV with no scrolling. The page reloads periodically so data stays fresh.

## Android TV app

The `android/` folder is a minimal Android TV app (leanback launcher) that opens `tv.html` full-screen in a WebView, keeps the screen on, and stays within the site. Page updates appear without reinstalling the app.

GitHub Actions (`.github/workflows/tv-app.yml`) builds a signed release APK whenever the Android sources change and commits it as `tv.apk` at the root of the repo. Download it from the link above and sideload onto your Android TV / Fire TV / etc.

Signing keys live only in GitHub Secrets (`TV_KEYSTORE_B64` and `TV_KEYSTORE_PASS`).

## Phone version

`index.html` is still available as a scrolling, phone-friendly dashboard with the same data and charts (plus a scorecard for the station correction). Open https://crb0229.github.io/backyard-weather/ and optionally add it to your home screen.

## How the data works (no home hardware)

GitHub Pages hosts the pages. GitHub Actions runs `wx.py` on a schedule (`.github/workflows/weather.yml`):

- Every ~15 minutes: latest Ambient station reading → `data/latest.json`
- Daily (early morning Michigan time, or whenever the first run after 4 AM arrives): appends recent station history, logs the NWS forecast, pulls past model runs, and rebuilds the station-specific correction + scorecard (`data/correction.json`)

The pages themselves fetch live NWS forecasts/alerts, Open-Meteo model data, and radar tiles. Ambient API keys live only in GitHub Secrets (`AMBIENT_API_KEY` and `AMBIENT_APP_KEY`) and never appear in the committed data or HTML.

The correction (temperature, dew point, wind) only turns on after enough overlapping history and only if it actually reduces error on held-out recent days. Overnight lows are protected so the correction never makes them worse. Rain/snow amounts are not adjusted.

## One-time setup (if you want to run your own copy)

1. Fork or copy the repo (keep it public so Actions minutes are free).
2. Add repository secrets:
   - `AMBIENT_API_KEY` and `AMBIENT_APP_KEY` (from ambientweather.net → Account → API Keys)
   - For the TV APK: `TV_KEYSTORE_B64` (base64 of your keystore) and `TV_KEYSTORE_PASS`
3. Enable GitHub Pages (Settings → Pages → Deploy from branch `main` / root).
4. Run the “weather data” workflow once with job `backfill` to populate history (can take a while).
5. Open the TV page or install the APK.

## Files

- `tv.html` — full-screen TV dashboard
- `index.html` — phone/scrolling dashboard
- `app.js` - phone page logic (radar, charts, corrections, ISS, etc.)
- `app-tv.js` - TV copy of app.js with NOAA nowCOAST radar, Rainbow.ai rain timing and forecast frames
- `holiday.js`, `holiday-art.js` - TV holiday themes and their drawings and animations
- `sky.js` - sun and moon times (dawn, dusk, moonrise, moonset, solstices) for the TV Sun and moon slide, worked out in the page
- `worker/` - Cloudflare Worker that passes Rainbow.ai forecast tiles to the TV without exposing the key
- `wx.py` — data collector and correction builder
- `data/` — station readings, model history, correction tables (updated by Actions)
- `android/` — Android TV wrapper app
- `.github/workflows/` — weather data refresh + TV APK build

## Limits

- Station readings lag by the Actions schedule (typically 15–30 minutes). Use the Ambient dashboard link for true real-time.
- Forecast corrections need weeks of history before they activate.
- ISS pass predictions and holiday effects are approximate and client-side.
- Radar and external tiles require an internet connection.

If a workflow fails, check the Actions tab and the last lines of the log.
