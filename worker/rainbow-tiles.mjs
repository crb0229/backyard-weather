// Cloudflare Worker: passes Rainbow.ai forecast map tiles to the TV page without putting the API key in the public page.
// The key lives only in the worker's secret RAINBOW_API_KEY. Only pages on ALLOWED may use it, and each tile is cached at
// Cloudflare, so every TV showing the same frame costs one Rainbow request. Setup steps: worker/README.md.
//   GET /snapshot                    -> {"snapshot": <unix seconds>}, the newest Rainbow radar time (cached 1 minute)
//   GET /precip/<snap>/<ahead>/z/x/y -> 256 px PNG tile, <ahead> seconds after <snap> (cached 3 hours)

const ALLOWED = ["https://crb0229.github.io/"];   // the GitHub Pages site; add "http://127.0.0.1:" while testing locally
const UPSTREAM = "https://api.rainbow.ai/tiles/v1";
const TILE = /^\/precip\/(\d{10})\/(\d{1,5})\/(\d{1,2})\/(\d{1,4})\/(\d{1,4})$/;

export default {
  async fetch(request, env, ctx) {
    return handle(request, env, ctx, typeof caches === "undefined" ? null : caches.default);
  },
};

export async function handle(request, env, ctx, cache) {
  const from = request.headers.get("Origin") || request.headers.get("Referer") || "";
  const site = ALLOWED.some(a => (from + "/").startsWith(a)) ? new URL(from).origin : null;   // the exact origin, for the CORS header
  if (!site) return text(403, "not allowed");
  if (request.method !== "GET") return text(405, "GET only");
  if (!env.RAINBOW_API_KEY) return text(500, "RAINBOW_API_KEY secret is not set", site);
  const url = new URL(request.url);
  let upstream, maxAge;
  if (url.pathname === "/snapshot") {
    upstream = `${UPSTREAM}/snapshot`; maxAge = 60;
  } else {
    const m = url.pathname.match(TILE);
    if (!m) return text(404, "unknown path", site);
    const [snap, ahead, z, x, y] = m.slice(1).map(Number), now = Date.now() / 1000;
    // Only recent snapshots, forecasts up to 4 hours in 10-minute steps, and zoom 3 to 7, so a stranger can't use this to pull
    // the whole world at every zoom on the owner's bill
    if (snap % 600 || snap < now - 3 * 3600 || snap > now + 600 || ahead % 600 || ahead > 14400 || z < 3 || z > 7 || x >= 2 ** z || y >= 2 ** z)
      return text(400, "tile out of range", site);
    upstream = `${UPSTREAM}/precip/${snap}/${ahead}/${z}/${x}/${y}`; maxAge = 3 * 3600;
  }
  const key = new Request(`https://cache.local${url.pathname}`);   // one cache entry per tile, whichever page asked
  const hit = cache && await cache.match(key);
  if (hit) return withCors(hit, site);
  const r = await fetch(upstream, {headers: {"Ocp-Apim-Subscription-Key": env.RAINBOW_API_KEY}});
  if (!r.ok) return text(r.status === 404 ? 404 : 502, `Rainbow answered ${r.status}`, site);   // never pass Rainbow's error text along
  const out = new Response(r.body, {headers: {"Content-Type": r.headers.get("Content-Type") || "application/octet-stream",
    "Cache-Control": `public, max-age=${maxAge}`}});
  if (cache) ctx.waitUntil(cache.put(key, out.clone()));
  return withCors(out, site);
}

function withCors(r, site) {
  const out = new Response(r.body, r);
  out.headers.set("Access-Control-Allow-Origin", site);
  out.headers.set("Vary", "Origin");
  return out;
}

function text(status, msg, site) {
  const r = new Response(msg, {status, headers: {"Content-Type": "text/plain"}});
  return site ? withCors(r, site) : r;
}
