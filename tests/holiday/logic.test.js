// Holiday theme rules: date windows, greeting-only holidays, on/off memory, when the startup animation plays.
// Run: node --test tests/holiday/
const test = require("node:test");
const assert = require("node:assert");
const H = require("../../holiday-test.js");

const day = (y, m, d, h = 12, min = 0) => new Date(y, m - 1, d, h, min);
const id = d => (H.holidayFor(d) || {}).id || null;
function memStore() { const m = {}; return H.safeStore({getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; }}); }

test("windows", () => {
  assert.strictEqual(id(day(2026, 12, 26)), "christmas");
  assert.strictEqual(id(day(2026, 12, 27)), null);
  assert.strictEqual(H.holidayFor(day(2026, 12, 31)).greeting(day(2026, 12, 31)), "Happy New Year's Eve");
  assert.strictEqual(H.holidayFor(day(2027, 1, 1)).greeting(day(2027, 1, 1)), "Happy New Year");
  assert.strictEqual(id(day(2026, 11, 23)), "thanksgiving");
  assert.strictEqual(id(day(2026, 11, 27)), "thanksgiving");
  assert.notStrictEqual(id(day(2026, 11, 22)), "thanksgiving");
  assert.notStrictEqual(id(day(2026, 11, 28)), "thanksgiving");
  assert.strictEqual(id(day(2027, 3, 26)), "easter");
  assert.strictEqual(id(day(2027, 3, 28)), "easter");
  assert.notStrictEqual(id(day(2027, 3, 29)), "easter");
  assert.strictEqual(id(day(2026, 5, 4)), "may4");
  assert.strictEqual(id(day(2026, 5, 3)), null);
  assert.strictEqual(id(day(2026, 5, 5)), null);
  assert.strictEqual(id(day(2026, 10, 25)), "halloween");
  assert.strictEqual(id(day(2026, 10, 31)), "halloween");
  assert.strictEqual(id(day(2026, 7, 1)), "july4");
  assert.strictEqual(id(day(2026, 7, 5)), "july4");
});

test("greetingOnly", () => {
  for (const d of [day(2026, 2, 14), day(2026, 3, 17), day(2026, 5, 10), day(2026, 5, 25), day(2026, 6, 21), day(2026, 9, 7)]) {
    const t = H.holidayFor(d);
    assert.ok(t, "holiday expected on " + d.toDateString());
    assert.strictEqual(t.main, false, t.id);
    assert.ok(!t.palette && !t.picture && !t.intro, t.id + " should be greeting only");
  }
  const mains = H.THEMES.filter(t => t.main);
  assert.strictEqual(mains.length, 7);
  for (const t of mains) assert.ok(t.palette && t.font && t.picture && t.intro, t.id + " incomplete");
});

test("offScope", () => {
  const s = memStore(), hal = H.holidayFor(day(2026, 10, 28)), thx = H.holidayFor(day(2026, 11, 25));
  H.setOff(s, hal, day(2026, 10, 28), true);
  assert.strictEqual(H.isOff(s, hal, day(2026, 10, 30)), true);
  assert.strictEqual(H.isOff(s, thx, day(2026, 11, 25)), false);
  assert.strictEqual(H.isOff(s, hal, day(2027, 10, 28)), false);
  H.setOff(s, hal, day(2026, 10, 28), false);
  assert.strictEqual(H.isOff(s, hal, day(2026, 10, 30)), false);
});

test("storageThrows", () => {
  const boom = () => { throw new Error("blocked"); };
  const s = H.safeStore({getItem: boom, setItem: boom, removeItem: boom});
  assert.strictEqual(s.get("x"), null);
  assert.doesNotThrow(() => s.set("x", "1"));
  assert.doesNotThrow(() => s.del("x"));
  assert.strictEqual(H.isOff(s, H.holidayFor(day(2026, 10, 28)), day(2026, 10, 28)), false);
  assert.strictEqual(H.safeStore(null).get("x"), null);
});

test("introRules", () => {
  const hal = H.holidayFor(day(2026, 10, 28));
  const ask = (s, now, o = {}) => H.shouldPlayIntro({theme: hal, now, freshOpen: false, preview: false, reducedMotion: false, store: s, ...o});
  let s = memStore();
  assert.strictEqual(ask(s, day(2026, 10, 28, 2), {preview: true}), true);
  assert.strictEqual(ask(s, day(2026, 10, 28, 2), {freshOpen: true}), false);
  assert.strictEqual(ask(s, day(2026, 10, 28, 14), {freshOpen: true, reducedMotion: true}), false);
  H.markPlayed(s, hal, day(2026, 10, 28, 9));
  assert.strictEqual(ask(s, day(2026, 10, 28, 14), {freshOpen: true}), true);
  s = memStore();
  assert.strictEqual(ask(s, day(2026, 10, 28, 6, 0)), true);
  H.markPlayed(s, hal, day(2026, 10, 28, 6, 0));
  assert.strictEqual(ask(s, day(2026, 10, 28, 6, 15)), false);
  assert.strictEqual(ask(s, day(2026, 10, 29, 6, 0)), true);
  const val = H.holidayFor(day(2026, 2, 14));
  assert.strictEqual(H.shouldPlayIntro({theme: val, now: day(2026, 2, 14, 14), freshOpen: true, preview: true, reducedMotion: false, store: memStore()}), false);
  s = memStore();
  H.setOff(s, hal, day(2026, 10, 28), true);
  assert.strictEqual(ask(s, day(2026, 10, 28, 14), {freshOpen: true}), false);
  assert.strictEqual(H.shouldPlayIntro({theme: null, now: day(2026, 8, 1), freshOpen: true, preview: true, reducedMotion: false, store: memStore()}), false);
});

test("helpers", () => {
  assert.strictEqual(H.dayKey(day(2026, 3, 7)), "2026-03-07");
  assert.strictEqual(H.isNight(day(2026, 1, 1, 23)), true);
  assert.strictEqual(H.isNight(day(2026, 1, 1, 5, 59)), true);
  assert.strictEqual(H.isNight(day(2026, 1, 1, 6)), false);
});
