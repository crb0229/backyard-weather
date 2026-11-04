# Caledonia Backyard Weather

Phone dashboard for station KMICALED82: station readings, NWS forecast and alerts, radar loop, and a forecast adjusted to how the models actually miss at this yard.

## How it runs (no home hardware)

- GitHub Pages hosts the page for free.
- GitHub Actions (free for public repos) runs `wx.py` on a schedule:
  - every 15 minutes: latest station reading
  - daily, early morning: adds yesterday's station data and yesterday's 24-hour-ahead model forecast, saves the NWS forecast for tomorrow, rebuilds the correction and scorecard
- The page itself pulls NWS, Open-Meteo, and radar live from your phone.
- Ambient keys live only in GitHub Secrets. They never appear in the page or the data files.

## One-time setup (about 15 minutes)

1. Create a GitHub account if you don't have one. New repository, name it `backyard-weather`, set to Public, check "Add a README".
2. Upload these files: `index.html`, `wx.py`, `README.md`, and the folder `.github/workflows/weather.yml`.
   (On the repo page: Add file > Upload files. For the workflow, use Add file > Create new file, type `.github/workflows/weather.yml` as the name, paste the contents.)
3. Settings > Secrets and variables > Actions > New repository secret. Add two:
   - `AMBIENT_API_KEY`
   - `AMBIENT_APP_KEY`
   Both come from ambientweather.net > Account > API Keys. The Application Key is a separate key you create on that same page.
4. Settings > Pages > Source: Deploy from a branch, branch `main`, folder `/ (root)`. Save.
5. Actions tab > "weather data" > Run workflow > job `backfill` > Run. This pulls the station history and past model forecasts. Expect 5 to 20 minutes.
6. Open `https://<your-username>.github.io/backyard-weather/` on your phone and add it to the home screen.

## What to expect

- Station readings lag 15 to 30 minutes. GitHub runs scheduled jobs late at busy times. The "Live station dashboard" link at the bottom goes to Ambient for the real-time view.
- The correction needs 30 days of overlapping station and model history before it switches on, and only stays on for a variable if it beats the raw model on held-out recent days.
- The NWS comparison starts empty. There is no free archive of past NWS point forecasts, so the daily job saves its own copy from day one. After 14 days the scorecard shows how NWS does against the corrected forecast.
- Rain and snow amounts are not corrected.

## If something breaks

Actions tab shows each run as green or red. Click a red one and copy the last 20 lines of the log into the Claude project chat.
