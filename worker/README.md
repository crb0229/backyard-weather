# Rainbow tile worker

The TV page (`tv.html`, and the test copy `tv-radar-test.html`) shows Rainbow.ai forecast frames after the radar loop. Each tile request needs the
Rainbow API key, and this site is public, so the key can't be in the page. This small Cloudflare Worker holds the key and
passes tiles through. It only answers pages on `https://crb0229.github.io/`, only passes recent forecast tiles at zoom 3 to 7,
and caches each tile at Cloudflare so every TV showing the same frame costs one Rainbow request.

## One-time setup (Cloudflare dashboard, free plan)

1. Sign in or sign up at https://dash.cloudflare.com (the free plan is enough: 100,000 worker requests a day).
2. **Workers & Pages > Create > Create Worker**. Name it `rainbow-tiles` and press **Deploy** (it deploys a sample first).
3. **Edit code**, replace everything with the contents of `rainbow-tiles.mjs`, and press **Deploy**.
4. **Settings > Variables and Secrets > Add**: type **Secret**, name `RAINBOW_API_KEY`, value your Rainbow primary key.
   Save and deploy. The key is never shown again, and never goes in this repo.
5. Copy the worker address, like `https://rainbow-tiles.YOURNAME.workers.dev`, and put it in `tv-radar-test.html` as
   `window.RAINBOW_TILES`. The address is not secret.

Quick check: opening `https://rainbow-tiles.YOURNAME.workers.dev/snapshot` straight in a browser should say `not allowed`.
That is expected; only the TV page may use it.

## 15-minute station timer

GitHub's own 15-minute schedule for the "weather data" job gets skipped for hours at a time, so the worker also runs on a
Cloudflare timer and asks GitHub to start the job every 15 minutes. GitHub runs those requests right away. (GitHub's
schedule stays on as a backup; an extra run just finds nothing new.)

1. Make a GitHub token: https://github.com/settings/personal-access-tokens/new (fine-grained token).
   Name `weather timer`, expiration as long as offered, **Only select repositories**: `backyard-weather`,
   **Permissions > Repository > Actions: Read and write**. Nothing else. Generate and copy it.
2. In the `rainbow-tiles` worker: **Settings > Variables and Secrets > Add**, type **Secret**, name `GITHUB_TOKEN`,
   paste the token, save and deploy.
3. **Edit code**, paste the current `rainbow-tiles.mjs`, **Deploy**.
4. **Settings > Trigger events > Add > Cron Triggers**: `*/15 * * * *`, add.

Check: within 15 minutes, https://github.com/crb0229/backyard-weather/actions shows a "weather data" run marked
`workflow_dispatch`. If runs stop, the worker's **Logs** say why (an expired token shows as `GitHub answered 401`):
make a new token and replace the secret.

## Cost

The page asks for forecast tiles only on the local view, and only while the nowcast has rain or snow due in the next
2 hours: about 18 tiles per page refresh. Even with rain due all month that is about 52,000 tiles (about $4.40 after the
free 30,000); a usual month stays free. Set a usage alert in the Rainbow dashboard if it offers one.

## Changing the code

Edit `rainbow-tiles.mjs`, run `node --test tests/worker.test.mjs`, then paste it into the dashboard again (step 3).
