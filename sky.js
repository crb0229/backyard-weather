// Sun and Moon positions for the Sun and moon slide: dawn and dusk, the sun's path across the day, moonrise and moonset,
// and the next solstice. Low-precision formulas (about a minute for the sun, a few minutes for the moon), worked out
// in the page so nothing new is fetched. Times are milliseconds since 1970 (UTC), angles in degrees.
(function () {
  const RAD = Math.PI / 180, OBL = 23.4397 * RAD;
  const days = t => t / 864e5 - 10957.5;   // days since noon UTC, Jan 1 2000

  function sunLon(d) {   // sun's ecliptic longitude; the perihelion term drifts about 0.45 degrees in 26 years, so it moves with d
    const M = (357.5291 + 0.98560028 * d) * RAD;
    return M + (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M)) * RAD + (102.9372 + 4.70935e-5 * d) * RAD + Math.PI;
  }
  function sunEq(d) {   // sun's right ascension and declination
    const L = sunLon(d);
    return {ra: Math.atan2(Math.sin(L) * Math.cos(OBL), Math.cos(L)), dec: Math.asin(Math.sin(OBL) * Math.sin(L))};
  }
  function moonEq(d) {   // moon's right ascension, declination and distance in km
    const L = (218.316 + 13.176396 * d) * RAD, M = (134.963 + 13.064993 * d) * RAD, F = (93.272 + 13.22935 * d) * RAD;
    const D = (297.85 + 12.190749 * d) * RAD, Ms = (357.5291 + 0.98560028 * d) * RAD;   // elongation from the sun, sun's anomaly
    const l = L + (6.289 * Math.sin(M) + 1.274 * Math.sin(2 * D - M) + 0.658 * Math.sin(2 * D) + 0.214 * Math.sin(2 * M)
      - 0.186 * Math.sin(Ms) - 0.114 * Math.sin(2 * F)) * RAD;   // the largest pulls from the sun on the moon's orbit
    const b = (5.128 * Math.sin(F) + 0.281 * Math.sin(M + F) + 0.278 * Math.sin(M - F)) * RAD;
    return {ra: Math.atan2(Math.sin(l) * Math.cos(OBL) - Math.tan(b) * Math.sin(OBL), Math.cos(l)),
            dec: Math.asin(Math.sin(b) * Math.cos(OBL) + Math.cos(b) * Math.sin(OBL) * Math.sin(l)), km: 385001 - 20905 * Math.cos(M) - 3699 * Math.cos(2 * D - M) - 2956 * Math.cos(2 * D)};
  }
  function alt(eq, d, lat, lon) {
    const H = (280.46062 + 360.98564737 * d + lon) * RAD - eq.ra, p = lat * RAD;
    return Math.asin(Math.sin(p) * Math.sin(eq.dec) + Math.cos(p) * Math.cos(eq.dec) * Math.cos(H)) / RAD;
  }
  const sunAlt = (t, lat, lon) => alt(sunEq(days(t)), days(t), lat, lon);
  // The moon's center when its top edge touches the horizon, with refraction and the moon's parallax (about 0.13 degrees)
  const moonAbove = (t, lat, lon) => { const e = moonEq(days(t)); return alt(e, days(t), lat, lon) - (0.7275 * Math.asin(6378.14 / e.km) / RAD - 0.5667); };

  // Every time f(t) crosses zero between start and end: rising (true) or setting (false), found to within a few seconds
  function crossings(f, start, end, step = 6e5) {
    const out = [];
    for (let a = start, fa = f(a); a < end; ) {
      const b = Math.min(a + step, end), fb = f(b);
      if ((fa < 0) !== (fb < 0)) {
        let lo = a, hi = b, flo = fa;
        for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2, fm = f(m); if ((fm < 0) === (flo < 0)) { lo = m; flo = fm; } else hi = m; }
        out.push({t: Math.round((lo + hi) / 2), rising: fa < 0});
      }
      a = b; fa = fb;
    }
    return out;
  }
  const first = (list, rising) => (list.find(c => c.rising === rising) || {}).t || null;

  // One local day, from its midnight (dayStart, ms) for 24 hours. A missing value means it doesn't happen that day.
  function day(dayStart, lat, lon) {
    const end = dayStart + 864e5;
    const sun = h => crossings(t => sunAlt(t, lat, lon) - h, dayStart, end);
    const rs = sun(-0.833), civil = sun(-6), moon = crossings(t => moonAbove(t, lat, lon), dayStart, end);
    let noon = dayStart, high = -90;
    for (let t = dayStart; t < end; t += 6e4 * 5) { const a = sunAlt(t, lat, lon); if (a > high) { high = a; noon = t; } }
    return {dawn: first(civil, true), sunrise: first(rs, true), sunset: first(rs, false), dusk: first(civil, false),
            noon, high, moonrise: first(moon, true), moonset: first(moon, false)};
  }

  // The next solstice from t: when the sun's ecliptic longitude reaches 90 degrees (longest day) or 270 (shortest).
  // Its cosine crosses zero then, falling in June and rising in December.
  function nextSolstice(t) {
    const cosL = x => Math.cos(sunLon(days(x)));
    const c = crossings(cosL, t, t + 200 * 864e5, 864e5)[0];
    return c ? {t: c.t, longest: !c.rising} : null;
  }

  const SKY = {sunAlt, moonAbove, crossings, day, nextSolstice};
  if (typeof window !== "undefined") window.SKY = SKY;
  if (typeof module !== "undefined" && module.exports) module.exports = SKY;
})();
