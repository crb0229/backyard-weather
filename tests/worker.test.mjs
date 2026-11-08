// Rainbow tile worker: who may use it, which tiles it passes on, caching, and that the key never leaks.
// Run: node --test tests/worker.test.mjs
import test from "node:test";
import assert from "node:assert";
import {handle} from "../worker/rainbow-tiles.mjs";

const KEY = "test-key-123", env = {RAINBOW_API_KEY: KEY};
const SNAP = Math.floor(Date.now() / 1000 / 600) * 600, PAGE = "https://crb0229.github.io/backyard-weather/tv-radar-test.html";
let calls = [];
globalThis.fetch = async (url, opts) => {
  calls.push({url, key: opts.headers["Ocp-Apim-Subscription-Key"]});
  if (url.endsWith("/snapshot")) return new Response(JSON.stringify({snapshot: SNAP}), {headers: {"Content-Type": "application/json"}});
  if (url.includes("/9/")) return new Response("bad key " + KEY, {status: 401});
  return new Response(new Uint8Array([137, 80, 78, 71]), {headers: {"Content-Type": "image/png"}});
};
function memCache() {
  const m = new Map();
  return {match: async r => m.get(r.url)?.clone(), put: async (r, res) => { m.set(r.url, res); }, size: () => m.size};
}
const ctx = {waitUntil: p => p};
const req = (path, headers = {Referer: PAGE}) => new Request("https://rainbow-tiles.example.workers.dev" + path, {headers});

test("tile from the site goes upstream with the key in a header", async () => {
  calls = [];
  const r = await handle(req(`/precip/${SNAP}/1200/7/33/46`), env, ctx, null);
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.headers.get("Content-Type"), "image/png");
  assert.strictEqual(calls[0].url, `https://api.rainbow.ai/tiles/v1/precip/${SNAP}/1200/7/33/46`);
  assert.strictEqual(calls[0].key, KEY);
  assert.ok(!calls[0].url.includes(KEY));
});

test("snapshot works with an Origin header and sends CORS for that origin", async () => {
  const r = await handle(req("/snapshot", {Origin: "https://crb0229.github.io"}), env, ctx, null);
  assert.strictEqual(r.headers.get("Access-Control-Allow-Origin"), "https://crb0229.github.io");
  assert.deepStrictEqual(await r.json(), {snapshot: SNAP});
});

test("other sites and no referer are refused before any upstream call", async () => {
  calls = [];
  for (const h of [{}, {Referer: "https://evil.example/"}, {Origin: "https://crb0229.github.io.evil.example"}]) {
    assert.strictEqual((await handle(req("/snapshot", h), env, ctx, null)).status, 403);
  }
  assert.strictEqual(calls.length, 0);
});

test("out-of-range tiles are refused", async () => {
  calls = [];
  const old = SNAP - 4 * 3600;
  for (const p of [`/precip/${old}/1200/7/33/46`, `/precip/${SNAP + 1}/1200/7/33/46`, `/precip/${SNAP}/1250/7/33/46`,
    `/precip/${SNAP}/15000/7/33/46`, `/precip/${SNAP}/1200/8/66/92`, `/precip/${SNAP}/1200/2/1/1`, `/precip/${SNAP}/1200/7/128/46`]) {
    assert.strictEqual((await handle(req(p), env, ctx, null)).status, 400, p);
  }
  assert.strictEqual((await handle(req("/other"), env, ctx, null)).status, 404);
  assert.strictEqual(calls.length, 0);
});

test("a cached tile is served without another upstream call", async () => {
  calls = [];
  const cache = memCache(), p = `/precip/${SNAP}/2400/7/33/46`;
  await handle(req(p), env, ctx, cache);
  const again = await handle(req(p, {Referer: "https://crb0229.github.io/backyard-weather/"}), env, ctx, cache);
  assert.strictEqual(again.status, 200);
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(cache.size(), 1);
});

test("upstream errors don't pass Rainbow's text (or the key) along", async () => {
  const r = await handle(req(`/precip/${SNAP}/1200/7/9/46`), env, ctx, null);
  assert.strictEqual(r.status, 502);
  assert.ok(!(await r.text()).includes(KEY));
});

test("color scheme 0 to 9 passes through and is cached separately; anything else is refused", async () => {
  calls = [];
  const cache = memCache(), p = `/precip/${SNAP}/1200/7/33/46`;
  await handle(req(p + "?color=4"), env, ctx, cache);
  await handle(req(p), env, ctx, cache);
  assert.strictEqual(calls[0].url, `https://api.rainbow.ai/tiles/v1/precip/${SNAP}/1200/7/33/46?color=4`);
  assert.strictEqual(cache.size(), 2);
  for (const c of ["10", "dbz_u8", "4&token=x"]) assert.strictEqual((await handle(req(p + "?color=" + encodeURIComponent(c)), env, ctx, null)).status, 400, c);
});

test("missing secret says so", async () => {
  assert.strictEqual((await handle(req("/snapshot"), {}, ctx, null)).status, 500);
});
