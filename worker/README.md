# Rainbow tile worker (test)

The TV test page (`tv-radar-test.html`) shows Rainbow.ai forecast frames after the radar loop. Each tile request needs the
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

## Cost

The page asks for forecast tiles only on the local view, and only while the nowcast has rain or snow due in the next
2 hours: about 18 tiles per page refresh. Even with rain due all month that is about 52,000 tiles (about $4.40 after the
free 30,000); a usual month stays free. Set a usage alert in the Rainbow dashboard if it offers one.

## Changing the code

Edit `rainbow-tiles.mjs`, run `node --test tests/worker.test.mjs`, then paste it into the dashboard again (step 3).
