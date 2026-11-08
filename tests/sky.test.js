// Sun and moon times from sky.js against the US Naval Observatory (aa.usno.navy.mil), at the demo point 42.8, -85.5.
// Run: node --test tests/
const test = require("node:test");
const assert = require("node:assert");
const S = require("../sky.js");

const at = (y, m, d, off) => Date.UTC(y, m - 1, d) - off * 36e5;   // local midnight for a UTC offset in hours
const hm = (t, off) => new Date(t + off * 36e5).toISOString().slice(11, 16);
const near = (t, off, want, min = 3) => {
  const [h, m] = want.split(":").map(Number), got = new Date(t + off * 36e5), diff = Math.abs(got.getUTCHours() * 60 + got.getUTCMinutes() - (h * 60 + m));
  assert.ok(diff <= min, `${hm(t, off)} vs USNO ${want}`);
};

const USNO = [   // date, UTC offset, dawn, sunrise, sunset, dusk, moonrise, moonset
  [[2026, 11, 8], -5, "06:55", "07:25", "17:26", "17:56", "06:55", "16:42"],
  [[2027, 6, 21], -4, "05:28", "06:04", "21:24", "21:59", "23:28", "08:13"],
  [[2026, 3, 20], -4, "07:17", "07:45", "19:54", "20:23", "08:16", "22:17"]];

test("sun and moon times match USNO within 3 minutes", () => {
  for (const [ymd, off, ...want] of USNO) {
    const d = S.day(at(...ymd, off), 42.8, -85.5);
    ["dawn", "sunrise", "sunset", "dusk", "moonrise", "moonset"].forEach((k, i) => near(d[k], off, want[i]));
  }
});

test("a day with no moonset says so", () => {
  // Over a month, some local day has no moonrise and some has no moonset; those come back null, never a wrong time
  let noRise = 0, noSet = 0;
  for (let i = 0; i < 30; i++) { const d = S.day(at(2026, 11, 1, -5) + i * 864e5, 42.8, -85.5); if (!d.moonrise) noRise++; if (!d.moonset) noSet++; }
  assert.ok(noRise >= 1 && noSet >= 1);
});

test("solstices within 30 minutes", () => {
  const cases = [[Date.UTC(2026, 10, 8), "2026-12-21T20:50", false], [Date.UTC(2027, 0, 5), "2027-06-21T14:11", true], [Date.UTC(2027, 11, 1), "2027-12-22T02:42", false]];
  for (const [from, want, longest] of cases) {
    const s = S.nextSolstice(from);
    assert.strictEqual(s.longest, longest);
    assert.ok(Math.abs(s.t - Date.parse(want + "Z")) <= 30 * 6e4, new Date(s.t).toISOString());
  }
});
