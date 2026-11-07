// Location: the backyard station, or a place the viewer picked (saved on this device only).
const STORE = (() => { try { localStorage.setItem("wx:t", "1"); localStorage.removeItem("wx:t"); return true; } catch (e) { return false; } })();
const LOC = (() => { try { return JSON.parse(localStorage.getItem("wx:loc")); } catch (e) { return null; } })();
const STATION = !LOC || !!LOC.station;
const TZ = (LOC && LOC.tz) || "America/Detroit";
let LAT = (LOC && LOC.lat) || 42.79, LON = (LOC && LOC.lon) || -85.52, MAP = null;
// Missing sections (the TV page leaves some out) get a throwaway element so nothing breaks
const $ = id => document.getElementById(id) || document.createElement("div");
const TVF = window.CHART_FONT || 10, HOURS = window.HOURS || 24;   // the TV page sets bigger text and fewer hours
const nz = (a, b) => a == null ? b : a;   // older TV browsers can't read the newer shorthand for this
const get = u => fetch(u, {cache: "no-store"}).then(r => { if (!r.ok) throw new Error(r.status + " " + u); return r.json(); });
const esc = s => String(s).replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));   // outside text is shown as text, never run as page code
const f0 = v => v == null || v === "" ? "--" : Math.round(v);
const fmt = new Intl.DateTimeFormat("en-CA", {timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23"});
// "YYYY-MM-DDTHH" in Michigan time, used to line up NWS and model hours
const key = d => { const p = Object.fromEntries(fmt.formatToParts(d).map(x => [x.type, x.value])); return `${p.year}-${p.month}-${p.day}T${p.hour}`; };
const hr = d => d.toLocaleTimeString("en-US", {timeZone: TZ, hour: "numeric"});
const season = m => ["winter","winter","spring","spring","spring","summer","summer","summer","fall","fall","fall","winter"][m - 1];
const compass = d => d == null ? "" : ["N","NE","E","SE","S","SW","W","NW"][Math.round(d / 45) % 8];

let corr = null;
function yard(v, t, val) {          // t = "YYYY-MM-DDTHH", local time
  const c = corr && corr.vars[v];
  if (!STATION) return val;          // another location: plain model forecast, no station correction
  if (val == null) return null;
  if (!c) return val;               // correction file didn't load: show the plain model rather than blanks
  if (!c.on) return val;            // correction didn't beat the model at this yard, so use the model as-is
  const m = +t.slice(5, 7), h = +t.slice(11, 13);
  const a = nz(c.table[`${season(m)}-${h}`], c.table[`any-${h}`]);
  if (a == null) return val;
  return v === "wind" ? val * a : val + a;
}

async function main() {
  if (!LOC) {   // first visit on this device: ask where. Devices that used the TV page before the picker existed stay on the station.
    let old = !STORE;
    try { old = old || localStorage.getItem("wx:music") != null; } catch (e) {}
    if (!old) return picker(true);
    saveLoc({station: true});
  }
  $("placeBtn").textContent = STATION ? "Home station" : LOC.name;
  $("placeBtn").onclick = () => picker(false);
  const [latest, correction] = STATION ? await Promise.all([get("data/latest.json").catch(() => null), get("data/correction.json").catch(() => null)]) : [null, null];
  corr = correction;
  if (latest) { LAT = latest.lat; LON = latest.lon; showNow(latest); }
  else if (STATION) $("nowAge").textContent = "Station data not collected yet.";
  if (!STATION) stationOnly();
  try { radar(); } catch (e) { note("radar map didn't load"); }
  const ptP = get(`https://api.weather.gov/points/${LAT.toFixed(4)},${LON.toFixed(4)}`).then(r => r.properties);
  ptP.then(pt => warnOutlines(MAP, pt.relativeLocation.properties.state)).catch(() => note("warning outlines didn't load"));
  const obsP = STATION ? Promise.resolve(latest) : nearestObs(ptP).then(o => { showNow(o); return o; }).catch(() => { $("nowAge").textContent = "No recent reading from a nearby NWS station."; return null; });
  const nwsGet = k => ptP.then(pt => get(pt[k]));   // each NWS piece loads on its own, so one failure doesn't blank the page
  const om = get("https://api.open-meteo.com/v1/forecast?" + new URLSearchParams({
    latitude: LAT, longitude: LON, timezone: TZ, forecast_days: 10,
    temperature_unit: "fahrenheit", wind_speed_unit: "mph", precipitation_unit: "inch",
    hourly: "temperature_2m,apparent_temperature,dew_point_2m,relative_humidity_2m,wind_speed_10m,wind_gusts_10m,wind_direction_10m,cloud_cover,pressure_msl,precipitation_probability,precipitation,snowfall,is_day",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,snowfall_sum,precipitation_probability_max,sunrise,sunset,daylight_duration",
    minutely_15: "precipitation"}));
  const results = await Promise.allSettled([
    get(`https://api.weather.gov/alerts/active?point=${LAT.toFixed(4)},${LON.toFixed(4)}`),
    nwsGet("forecast"), nwsGet("forecastHourly"), nwsGet("forecastGridData"), om, obsP]);
  const [alerts, daily, hourly, grid, model, cur] = results.map(r => r.status === "fulfilled" ? r.value : null);
  if (window.onData) try { window.onData(cur, model, alerts ? alerts.features : []); } catch (e) { note("theme didn't load"); }   // the TV page sets its theme here, before the charts read the colors
  if (alerts) showAlerts(alerts.features);
  if (daily) showDays(daily.properties.periods);
  if (model) { showRain(model, cur); showEvenings(model); showSunMoon(model); try { showTenDay(model); } catch (e) { note("charts didn't load"); } }
  showHourly(hourly && hourly.properties.periods, model);
  showLow(daily && daily.properties.periods, model);
  if (grid) showSnow(grid.properties, model);
  showScore();
  $("updated").textContent = "Updated " + new Date().toLocaleTimeString("en-US", {timeZone: TZ, hour: "numeric", minute: "2-digit"});
}

function showNow(s) {
  $("nowTemp").textContent = f0(s.temp) + "°";
  // Rows with no reading are left out (NWS stations don't report rain totals, and often no gusts)
  const rows = [["Feels", s.feels, v => f0(v) + "°"], ["Dew pt", s.dew, v => f0(v) + "°"], ["Wind", s.wind, v => `${compass(s.winddir)} ${f0(v)}`],
    ["Gust", s.gust, v => s.maxgust_today == null ? f0(v) : `${f0(v)} (max ${f0(s.maxgust_today)})`], ["Rain today", s.rain_today, v => v.toFixed(2) + '"'],
    ["Rain rate", s.rain_rate, v => v.toFixed(2) + '"/h'], ["Humidity", s.humidity, v => f0(v) + "%"], ["Pressure", s.pressure, v => v.toFixed(2)]]
    .filter(r => r[1] != null);
  $("nowKv").innerHTML = rows.map(([k, v, f]) => `<span>${k}</span><b>${f(v)}</b>`).join("");
  const mins = Math.round((Date.now() - new Date(s.time)) / 60000);
  $("nowAge").textContent = s.source ? `Reading from ${s.source}, ${mins} min ago.` : `Station reading from ${mins} min ago. Readings refresh about every 15 min.`;
}

// Another location: "now" comes from the nearest NWS station with a recent reading (usually an airport).
async function nearestObs(ptP) {
  const pt = await ptP, list = (await get(pt.observationStations + "?limit=3")).features;
  const obs = await Promise.all(list.map(f => get(`https://api.weather.gov/stations/${f.properties.stationIdentifier}/observations/latest`)
    .then(o => ({o: o.properties, name: f.properties.name})).catch(() => null)));
  const good = obs.filter(x => x && x.o.temperature.value != null);
  const pick = good.find(x => Date.now() - Date.parse(x.o.timestamp) < 2 * 3600000) || good[0];
  if (!pick) throw new Error("no reading");
  const o = pick.o, F = c => c == null ? null : c * 9 / 5 + 32, mph = k => k == null ? null : k / 1.609;
  $("nowTitle").textContent = "Now at " + pick.name;
  return {source: pick.name, time: o.timestamp, temp: F(o.temperature.value), dew: F(o.dewpoint.value),
    feels: F(nz(o.windChill.value, nz(o.heatIndex.value, o.temperature.value))), humidity: o.relativeHumidity.value,
    wind: mph(o.windSpeed.value), gust: mph(o.windGust.value), winddir: o.windDirection.value,
    pressure: o.barometricPressure.value == null ? null : o.barometricPressure.value / 3386.39};
}

// Another location: hide the parts that only exist because of the backyard station's history.
function stationOnly() {
  const low = $("lowYard"); low.hidden = true; if (low.previousElementSibling) low.previousElementSibling.hidden = true;
  const sec = $("score").closest && $("score").closest("section"); if (sec) sec.hidden = true;
  $("hourlyNote").textContent = "Model forecast. Rain chance is the NWS figure.";
  $("tenNote").textContent = "Model forecast (Open-Meteo best match). Shaded bands are night; the white line is now; the dashed line is 32°F. Tap a chart to read values.";
  $("sources").textContent = "Sources: National Weather Service, Open-Meteo, Iowa Environmental Mesonet radar.";
  $("hourlyTitle").textContent = $("hourlyTitle").textContent.replace("at the station", "here");
}

function saveLoc(v) { try { localStorage.setItem("wx:loc", JSON.stringify(v)); } catch (e) {} }

// Location picker: US ZIP code or city. ZIPs are looked up with Zippopotam.us, cities with Open-Meteo's place search,
// then the NWS confirms the spot is covered and gives its time zone.
const STATES = {Alabama:"AL",Alaska:"AK",Arizona:"AZ",Arkansas:"AR",California:"CA",Colorado:"CO",Connecticut:"CT",Delaware:"DE","District of Columbia":"DC",Florida:"FL",Georgia:"GA",Hawaii:"HI",Idaho:"ID",Illinois:"IL",Indiana:"IN",Iowa:"IA",Kansas:"KS",Kentucky:"KY",Louisiana:"LA",Maine:"ME",Maryland:"MD",Massachusetts:"MA",Michigan:"MI",Minnesota:"MN",Mississippi:"MS",Missouri:"MO",Montana:"MT",Nebraska:"NE",Nevada:"NV","New Hampshire":"NH","New Jersey":"NJ","New Mexico":"NM","New York":"NY","North Carolina":"NC","North Dakota":"ND",Ohio:"OH",Oklahoma:"OK",Oregon:"OR",Pennsylvania:"PA","Rhode Island":"RI","South Carolina":"SC","South Dakota":"SD",Tennessee:"TN",Texas:"TX",Utah:"UT",Vermont:"VT",Virginia:"VA",Washington:"WA","West Virginia":"WV",Wisconsin:"WI",Wyoming:"WY"};
function picker(first) {
  if (document.getElementById("locPick")) return;
  const box = document.createElement("div"); box.id = "locPick";
  box.innerHTML = `<style>
#locPick{position:fixed;inset:0;z-index:2000;background:rgba(0,0,0,.65);display:flex;align-items:center;justify-content:center;padding:16px}
#locPick .box{background:var(--panel);color:var(--fg);border:1px solid var(--line);border-radius:12px;padding:20px 22px;width:min(460px,100%);display:flex;flex-direction:column;gap:10px;font:16px/1.4 var(--body)}
#locPick h2{font:600 22px var(--display);margin:0;color:var(--fg);text-transform:none;letter-spacing:0}
#locPick input{font:inherit;padding:9px 10px;border-radius:6px;border:1px solid var(--line);background:var(--bg);color:var(--fg)}
#locPick button{font:inherit;text-align:left;padding:9px 10px;border-radius:6px;border:1px solid var(--line);background:transparent;color:var(--accent);cursor:pointer;margin:0}
#locPick button:focus,#locPick input:focus{outline:2px solid var(--accent)}
#locPick .msg{color:var(--muted);font-size:14px;min-height:1.2em}
#locRes{display:flex;flex-direction:column;gap:6px}</style>
<div class="box"><h2>Where do you want the weather for?</h2>
<input id="locQ" type="text" placeholder="US ZIP code, or city and state" autocomplete="postal-code">
<button id="locGo" type="button">Search</button>
<div class="msg" id="locMsg"></div><div id="locRes"></div>
<button id="locStation" type="button">Home station</button>
${first ? "" : '<button id="locCancel" type="button">Cancel</button>'}</div>`;
  document.body.appendChild(box);
  const q = document.getElementById("locQ"), res = document.getElementById("locRes"), msg = t => document.getElementById("locMsg").textContent = t;
  const choose = async p => {
    msg("Checking the forecast for " + p.name + "...");
    try {
      const pt = (await get(`https://api.weather.gov/points/${p.lat.toFixed(4)},${p.lon.toFixed(4)}`)).properties;
      saveLoc({name: p.name, lat: p.lat, lon: p.lon, tz: pt.timeZone}); location.reload();
    } catch (e) { msg("The National Weather Service doesn't cover that spot. US locations only."); }
  };
  const search = async () => {
    const text = q.value.trim(); if (!text) return;
    msg("Searching..."); res.innerHTML = "";
    let places = [];
    try {
      if (/^\d{5}$/.test(text)) {
        const z = await get(`https://api.zippopotam.us/us/${text}`);
        places = z.places.slice(0, 5).map(p => ({name: `${p["place name"]}, ${p["state abbreviation"]}`, lat: +p.latitude, lon: +p.longitude}));
      } else {
        // "Grand Rapids, MI", "Grand Rapids MI" and "Grand Rapids Michigan" all work
        let [city, st] = text.split(",").map(s => s.trim());
        if (!st) for (const name of [...Object.keys(STATES), ...Object.values(STATES)].sort((x, y) => y.length - x.length)) {
          const re = new RegExp("\\s+" + name + "$", "i");
          if (re.test(text)) { st = name; city = text.replace(re, ""); break; }
        }
        const g = await get("https://geocoding-api.open-meteo.com/v1/search?" + new URLSearchParams({name: city, count: 10, countryCode: "US"}));
        places = (g.results || []).filter(r => !st || [r.admin1, STATES[r.admin1]].some(x => x && x.toLowerCase() === st.toLowerCase()))
          .slice(0, 5).map(r => ({name: `${r.name}, ${STATES[r.admin1] || r.admin1}`, lat: r.latitude, lon: r.longitude}));
      }
    } catch (e) {}
    if (!places.length) return msg("Nothing found. Try a 5-digit ZIP code, or a city and state like \"Traverse City, MI\".");
    msg(places.length > 1 ? "Pick one:" : "");
    places.forEach(p => { const b = document.createElement("button"); b.type = "button"; b.textContent = p.name; b.onclick = () => choose(p); res.appendChild(b); });
    res.firstChild.focus();
  };
  document.getElementById("locGo").onclick = search;
  q.addEventListener("keydown", e => { if (e.key === "Enter") search(); });
  document.getElementById("locStation").onclick = () => { saveLoc({station: true}); location.reload(); };
  if (!first) document.getElementById("locCancel").onclick = () => box.remove();
  q.focus();
}

function showAlerts(list) {
  $("alerts").innerHTML = list.map(a => `<details class="alert"><summary>${esc(a.properties.event)}: until ${new Date(a.properties.ends || a.properties.expires).toLocaleString("en-US", {timeZone: TZ, weekday: "short", hour: "numeric", minute: "2-digit"})}</summary><p></p></details>`).join("");
  [...$("alerts").querySelectorAll("p")].forEach((p, i) => p.textContent = list[i].properties.headline + "\n\n" + list[i].properties.description);
}

function showRain(m, s) {
  const q = m.minutely_15, now = Date.now(), wet = x => x.p >= 0.01;
  let msg, note = "Timing from the 15-minute model forecast (HRRR-based in the US) for the next 6 hours.";
  const idx = q.time.findIndex(t => localMs(t) >= now - 15 * 60000);
  const win = q.time.slice(idx, idx + 24).map((t, i) => ({t, p: q.precipitation[idx + i]}));
  const rainingNow = (s && s.rain_rate > 0) || (win[0] && wet(win[0]));
  if (rainingNow) {
    const stop = win.find(x => !wet(x));
    msg = stop ? `Raining now, should stop around ${clock(stop.t)}` : "Raining now, continuing for at least 6 hours";
  } else {
    const start = win.find(wet);
    if (start) { const stop = win.slice(win.indexOf(start)).find(x => !wet(x)); msg = `Rain likely starting around ${clock(start.t)}` + (stop ? `, ending around ${clock(stop.t)}` : ""); }
    else {
      const h = m.hourly, i0 = h.time.findIndex(t => localMs(t) >= now);
      const j = h.time.slice(i0, i0 + 48).findIndex((t, k) => h.precipitation_probability[i0 + k] >= 50);
      msg = j < 0 ? "No rain expected in the next 48 hours" : `Dry for the next 6 hours. Next good chance of rain: ${dayClock(h.time[i0 + j])}`;
      if (j >= 0) note = "Beyond 6 hours, timing is the hour the model chance first reaches 50%.";
    }
  }
  $("rainCall").textContent = msg; $("rainNote").textContent = note;
}
// Open-Meteo local time strings ("2026-11-04T19:15") to real instants and labels
function localMs(t) { const guess = new Date(t + "Z").getTime(); const off = new Date(guess).toLocaleString("en-US", {timeZone: TZ, timeZoneName: "shortOffset"}).match(/GMT([+-]\d+)/); return guess - (off ? +off[1] : -5) * 3600000; }
const clock = t => new Date(localMs(t)).toLocaleTimeString("en-US", {timeZone: TZ, hour: "numeric", minute: "2-digit"});
const dayClock = t => new Date(localMs(t)).toLocaleString("en-US", {timeZone: TZ, weekday: "short", hour: "numeric"});

function showHourly(nws, m) {
  const byKey = {};
  (nws || []).forEach(p => byKey[key(new Date(p.startTime))] = p);
  if (!m) { $("hourly").innerHTML = "<tr><td>Model forecast unavailable</td></tr>"; return; }
  const h = m.hourly, i0 = h.time.findIndex(t => localMs(t) >= Date.now() - 3600000);
  const cols = h.time.slice(i0, i0 + HOURS).map((t, k) => ({t, i: i0 + k, n: byKey[t.slice(0, 13)]}));
  const row = (label, fn, cls = "") => `<tr><th>${label}</th>${cols.map(c => `<td class="num ${cls}">${fn(c)}</td>`).join("")}</tr>`;
  $("hourly").innerHTML =
    row("", c => clock(c.t).replace(":00", "")) +
    row("Temp", c => { const y = yard("temp", c.t, h.temperature_2m[c.i]); return y == null ? "--" : Math.round(y) + "°"; }, "yard") +
    row("Dew pt", c => { const y = yard("dew", c.t, h.dew_point_2m[c.i]); return y == null ? "--" : Math.round(y); }, "yard") +
    row(STATION ? "Wind (station)" : "Wind", c => { const y = yard("wind", c.t, h.wind_speed_10m[c.i]); return y == null ? "--" : Math.round(y); }, "yard") +
    row("Gusts (model)", c => Math.round(h.wind_gusts_10m[c.i])) +
    row("Cloud cover", c => h.cloud_cover[c.i] + "%") +
    row("Rain chance (NWS)", c => (c.n ? nz(c.n.probabilityOfPrecipitation.value, 0) : h.precipitation_probability[c.i]) + "%");
}

function showLow(periods, m) {
  const night = periods && periods.find(p => !p.isDaytime);
  $("lowNws").textContent = night ? night.temperature + "°" : "--";
  if (!m) return;
  const h = m.hourly, now = Date.now();
  const tonight = h.time.map((t, i) => ({t, i})).filter(x => { const ms = localMs(x.t); const hh = +x.t.slice(11, 13); return ms > now - 3600000 && ms < now + 24 * 3600000 && (hh >= 20 || hh < 9); }).slice(0, 14);
  const ys = tonight.map(x => yard("temp", x.t, h.temperature_2m[x.i])).filter(v => v != null);
  const low = ys.length ? Math.min(...ys) : null;
  $("lowYard").textContent = low == null ? "no correction yet" : Math.round(low) + "°";
  const ref = nz(low, night && night.temperature);
  $("frostFlag").innerHTML = ref == null ? "" : ref <= 32 ? `<span class="flag freeze">Freeze</span>` : ref <= 36 ? `<span class="flag frost">Frost possible</span>` : `<span class="flag ok">No frost</span>`;
}

function showSnow(g, m) {
  const total = prop => { let s = 0; const end = Date.now() + 48 * 3600000;
    ((g[prop] || {}).values || []).forEach(v => { const t = Date.parse(v.validTime.split("/")[0]); if (t >= Date.now() - 6 * 3600000 && t < end) s += v.value || 0; });
    return s / 25.4; };
  const sn = total("snowfallAmount"), ic = total("iceAccumulation");
  $("snowAmt").textContent = sn < 0.05 ? "none" : sn.toFixed(1) + '"';
  $("iceAmt").textContent = ic < 0.01 ? "none" : ic.toFixed(2) + '"';
  if (m) { const h = m.hourly, i0 = h.time.findIndex(t => localMs(t) >= Date.now());
    const j = h.time.slice(i0, i0 + 48).findIndex((t, k) => h.snowfall[i0 + k] > 0);
    $("snowWhen").textContent = j >= 0 ? `Model shows snow starting ${dayClock(h.time[i0 + j])}. Amounts are from the NWS, not adjusted.` : "Amounts are from the NWS, not adjusted."; }
}

function showEvenings(m) {
  const h = m.hourly, days = {};
  h.time.forEach((t, i) => { const hh = +t.slice(11, 13); if (hh >= 19 && localMs(t) > Date.now() - 3600000) (days[t.slice(0, 10)] = days[t.slice(0, 10)] || []).push(h.cloud_cover[i]); });
  $("evenings").innerHTML = Object.entries(days).slice(0, 6).map(([d, v]) => {
    const avg = v.reduce((a, b) => a + b, 0) / v.length, cls = avg < 25 ? 0 : avg < 60 ? 1 : 2;
    const name = new Date(d + "T12:00").toLocaleDateString("en-US", {weekday: "short"});
    return `<div class="c${cls}"><b>${name}</b><br>${["Clear", "Partly", "Cloudy"][cls]}<br><span class="num">${Math.round(avg)}%</span></div>`;
  }).join("");
}

// Sunrise and sunset come from the model feed. Moon phase is worked out here from a known new moon; it's within about half a day.
function showSunMoon(m) {
  const d = m.daily, clock = t => { const [h, mi] = t.slice(11, 16).split(":").map(Number); return (h % 12 || 12) + ":" + String(mi).padStart(2, "0") + (h < 12 ? " AM" : " PM"); };
  const len = s => Math.floor(s / 3600) + " h " + Math.round(s % 3600 / 60) + " min";
  const diff = Math.round((d.daylight_duration[0] - d.daylight_duration[1]) / 60);
  $("sunRise").textContent = clock(d.sunrise[0]);
  $("sunSet").textContent = clock(d.sunset[0]);
  $("dayLen").textContent = len(d.daylight_duration[0]);
  $("dayChange").textContent = diff === 0 ? "Same daylight as tomorrow" : `Tomorrow: ${Math.abs(diff)} min ${diff > 0 ? "less" : "more"} daylight`;

  const P = 29.530588853, now = Date.now(), age = (((now - Date.UTC(2000, 0, 6, 18, 14)) / 864e5) % P + P) % P;
  const lit = (1 - Math.cos(2 * Math.PI * age / P)) / 2;
  const names = ["New moon", "Waxing crescent", "First quarter", "Waxing gibbous", "Full moon", "Waning gibbous", "Last quarter", "Waning crescent"];
  $("moonName").textContent = names[Math.round(age / P * 8) % 8];
  $("moonLit").textContent = Math.round(lit * 100) + "% lit";
  const next = (target, label) => { let days = (target - age + P) % P; if (days < 0.5) days += P; return label + " " + new Date(now + days * 864e5).toLocaleDateString("en-US", {timeZone: TZ, weekday: "short", month: "short", day: "numeric"}); };
  $("moonNext").textContent = next(P / 2, "Full moon") + "\n" + next(0, "New moon");
  // Lit part: a half disc on the lit side plus an ellipse that either adds to it (gibbous) or cuts into it (crescent)
  const waxing = age < P / 2, rx = 40 * Math.abs(1 - 2 * lit), side = waxing ? 1 : 0;
  $("moonPic").innerHTML = `<circle cx="50" cy="50" r="40" fill="#2b3742"/><path fill="#e6ecf1" d="M50 10 A40 40 0 0 ${side} 50 90 A${rx} 40 0 0 ${lit > 0.5 ? side : 1 - side} 50 10Z"/>`;
  moonPhoto();
}

// A real picture of tonight's Moon: NASA's Scientific Visualization Studio renders the Moon for every hour of the year,
// with the true phase and tilt. The drawing above stays as the fallback if the picture can't load or the year isn't listed.
// Each year is a new NASA set; add its folder here when NASA publishes it (usually in December).
const MOON_SETS = {2026: "a005500/a005587"};
function moonPhoto() {
  const y = new Date().getUTCFullYear(), dir = MOON_SETS[y], pic = $("moonPic");
  if (!dir || !pic.parentNode) return;
  const n = Math.floor((Date.now() - Date.UTC(y, 0, 1)) / 3600000) + 1;
  const im = new Image();
  im.className = "moonPhoto"; im.alt = "";
  im.onload = () => {
    const old = pic.parentNode.querySelector(".moonPhoto"); if (old) old.remove();
    pic.style.display = "none"; pic.after(im);
    $("moonCredit").textContent = "Moon image: NASA Scientific Visualization Studio";
  };
  im.src = `https://svs.gsfc.nasa.gov/vis/a000000/${dir}/frames/730x730_1x1_30p/moon.${String(n).padStart(4, "0")}.jpg`;
}

function showDays(periods) {
  $("days").innerHTML = periods.slice(0, 14).map(p => `<div class="day"><span>${esc(p.name)}</span><b class="num">${esc(p.temperature)}°</b><span>${esc(p.shortForecast)}${p.probabilityOfPrecipitation.value ? ", " + esc(p.probabilityOfPrecipitation.value) + "% rain/snow" : ""}</span></div>`).join("");
}

function showScore() {
  if (!corr) { $("score").innerHTML = "<tr><td>No history collected yet. Run the backfill.</td></tr>"; return; }
  const names = {temp: "Temperature", dew: "Dew point", wind: "Wind speed"}, u = {temp: "°", dew: "°", wind: " mph"};
  let rows = `<tr><th>Variable</th><td>Correction</td><td>Raw model miss</td><td>Corrected miss</td><td>NWS miss</td><td>History</td></tr>`;
  for (const [v, c] of Object.entries(corr.vars)) {
    rows += `<tr><th>${names[v]}</th><td>${c.on ? "<b class='yard'>On</b>" : "Off"}</td><td class="num">${nz(c.raw_error, "--")}${c.raw_error != null ? u[v] : ""}</td><td class="num">${nz(c.corrected_error, "--")}${c.corrected_error != null ? u[v] : ""}</td><td class="num">${c.nws_error != null ? c.nws_error + u[v] : `${c.nws_days || 0} of 14 days`}</td><td class="num">${c.days} days</td></tr>`;
    if (v === "temp" && c.low_nights) rows += `<tr><th>Overnight low</th><td></td><td class="num">${c.low_raw_error}°</td><td class="num">${c.low_corrected_error}°</td><td></td><td class="num">${c.low_nights} nights</td></tr>`;
  }
  $("score").innerHTML = rows;
  $("scoreNote").textContent = `"Miss" is the average error, in the most recent ${(corr.vars.temp && corr.vars.temp.test_days) || 30} days, against what the station recorded. Those days are held out when building the correction, so it is a fair test. A correction turns off by itself when it stops beating the raw model. NWS comparison starts after 14 days of our own logging. Rebuilt ${new Date(corr.updated).toLocaleString("en-US", {timeZone: TZ, month: "short", day: "numeric", hour: "numeric", minute: "2-digit"})}.`;
}

// ---------- 10-day outlook ----------
const ICON = {
  sun: '<circle cx="16" cy="16" r="6" fill="#f2a900"/><g stroke="#f2a900" stroke-width="2" stroke-linecap="round"><path d="M16 3v4M16 25v4M3 16h4M25 16h4M6.8 6.8l2.8 2.8M22.4 22.4l2.8 2.8M6.8 25.2l2.8-2.8M22.4 9.6l2.8-2.8"/></g>',
  cloud: '<path d="M9 24h15a5 5 0 0 0 0-10 7 7 0 0 0-13.4 1.5A4.3 4.3 0 0 0 9 24z" fill="var(--muted)"/>',
  part: '<circle cx="12" cy="11" r="5" fill="#f2a900"/><g stroke="#f2a900" stroke-width="2" stroke-linecap="round"><path d="M12 2v2M3 11h2M5.6 4.6l1.4 1.4M18.4 4.6L17 6"/></g><path d="M11 26h13a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.5 1.3A3.9 3.9 0 0 0 11 26z" fill="var(--muted)"/>',
  rain: '<path d="M9 18h15a5 5 0 0 0 0-10 7 7 0 0 0-13.4 1.5A4.3 4.3 0 0 0 9 18z" fill="var(--muted)"/><g stroke="var(--accent)" stroke-width="2" stroke-linecap="round"><path d="M11 21l-2 5M17 21l-2 5M23 21l-2 5"/></g>',
  snow: '<path d="M9 18h15a5 5 0 0 0 0-10 7 7 0 0 0-13.4 1.5A4.3 4.3 0 0 0 9 18z" fill="var(--muted)"/><g fill="var(--accent)"><circle cx="11" cy="23" r="1.6"/><circle cx="17" cy="26" r="1.6"/><circle cx="23" cy="23" r="1.6"/></g>',
  storm: '<path d="M9 18h15a5 5 0 0 0 0-10 7 7 0 0 0-13.4 1.5A4.3 4.3 0 0 0 9 18z" fill="var(--muted)"/><path d="M17 18l-4 7h4l-2 6 6-8h-4l2-5z" fill="#f2a900"/>',
  fog: '<g stroke="var(--muted)" stroke-width="2.5" stroke-linecap="round"><path d="M5 12h22M8 17h18M5 22h22"/></g>'};
function sky(code) {
  if (code >= 95) return ["storm", "Storms"];
  if ([71, 73, 75, 77, 85, 86].includes(code)) return ["snow", code >= 85 ? "Snow showers" : "Snow"];
  if (code >= 80) return ["rain", "Showers"];
  if (code >= 51) return ["rain", code < 60 ? "Drizzle" : "Rain"];
  if (code >= 45) return ["fog", "Fog"];
  return [["sun", "part", "part", "cloud"][code], ["Sunny", "Mostly sunny", "Partly cloudy", "Cloudy"][code]];
}

const charts = [];
function showTenDay(m) {
  const d = m.daily;
  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;   // charts use the page's font, not the library's default
  $("tenday").innerHTML = d.time.map((t, i) => {
    const [ic, word] = sky(d.weather_code[i]);
    const dt = new Date(t + "T12:00"), name = dt.toLocaleDateString("en-US", {weekday: "short"}) + "<br>" + (dt.getMonth() + 1) + "/" + dt.getDate();
    const amt = d.snowfall_sum[i] >= 0.1 ? d.snowfall_sum[i].toFixed(1) + '" snow' : d.precipitation_sum[i].toFixed(2) + '"';
    return `<div><b>${name}</b><span class="num" style="white-space:nowrap"><span class="hi">${Math.round(d.temperature_2m_max[i])}°</span> | <span class="lo">${Math.round(d.temperature_2m_min[i])}°</span></span><svg viewBox="0 0 32 32">${ICON[ic]}</svg><span>${word}</span><span class="num small">${amt}</span></div>`;
  }).join("");

  const h = m.hourly, css = getComputedStyle(document.documentElement), c = n => css.getPropertyValue(n).trim();
  const T = h.time, now = T.findIndex(t => localMs(t) > Date.now()) - 1;
  const night = {id: "night", beforeDatasetsDraw(ch) {
    const {ctx, chartArea: a, scales: {x}} = ch, w = (x.getPixelForValue(1) - x.getPixelForValue(0)) / 2;
    ctx.save(); ctx.fillStyle = c("--night");
    h.is_day.forEach((v, i) => { if (!v) ctx.fillRect(x.getPixelForValue(i) - w, a.top, 2 * w, a.bottom - a.top); });
    if (now >= 0) { ctx.fillStyle = c("--fg"); ctx.fillRect(x.getPixelForValue(now), a.top, 1.5, a.bottom - a.top); }
    ctx.restore(); }};
  const base = (y, extra = {}) => ({
    type: "line", plugins: [night],
    options: {maintainAspectRatio: false, animation: false, interaction: {mode: "index", intersect: false},
      plugins: {legend: {labels: {color: c("--muted"), boxWidth: 12, boxHeight: 2, font: {size: TVF + 1}}},
        tooltip: {callbacks: {label: it => `${it.dataset.label}: ${it.raw == null ? "--" : Math.round(it.raw * 100) / 100}`, title:it => new Date(localMs(T[it[0].dataIndex])).toLocaleString("en-US", {timeZone: TZ, weekday: "short", hour: "numeric"})}}},
      elements: {point: {radius: 0}, line: {borderWidth: 1.6, tension: .3}},
      scales: {x: {grid: {display: false}, ticks: {color: c("--muted"), autoSkip: false, maxRotation: 0, font: {size: TVF},
          callback: (v, i) => T[i].endsWith("T12:00") ? new Date(T[i]).toLocaleDateString("en-US", {weekday: "short"}) : ""}},
        y: {grid: {color: c("--line")}, ticks: {color: c("--muted"), font: {size: TVF}}, ...y}, ...extra}}});
  const mk = (id, cfg, datasets) => { charts.push(new Chart($(id), {...cfg, data: {labels: T, datasets}})); };
  charts.forEach(ch => ch.destroy()); charts.length = 0;
  const dew = T.map((t, i) => nz(yard("dew", t, h.dew_point_2m[i]), h.dew_point_2m[i]));
  const flat = v => T.map(() => v);

  mk("cTemp", base({}), [
    {label: "Temperature °F", data: h.temperature_2m, borderColor: c("--bad")},
    {label: "Feels like", data: h.apparent_temperature, borderColor: c("--feels")},
    {label: STATION ? "Dew point (station)" : "Dew point", data: dew, borderColor: c("--yard")},
    {label: "32°F", data: flat(32), borderColor: c("--cold"), borderDash: [4, 4], borderWidth: 1}]);

  if (window.CHART_FONT) {
    // TV: two simple charts that read from across the room
    mk("cSky", base({min: 0, max: 100, ticks: {color: c("--muted"), font: {size: TVF}, stepSize: 50, callback: v => v + "%"}}), [
      {label: "Chance of rain", data: h.precipitation_probability, borderColor: c("--accent"), backgroundColor: c("--accent-fill"), fill: true, borderWidth: 3, order: 1},
      {label: "Cloud cover", data: h.cloud_cover, borderColor: c("--cloud-fill"), backgroundColor: c("--cloud-fill"), fill: true, borderWidth: 0, order: 2}]);
    // Rain and snow per day as labeled bars
    const labels = d.time.map(t => new Date(t + "T12:00").toLocaleDateString("en-US", {weekday: "short"}));
    const amounts = {id: "amounts", afterDatasetsDraw(ch) {
      const g = ch.ctx; g.save(); g.fillStyle = c("--fg"); g.font = `600 ${TVF}px ${getComputedStyle(document.body).fontFamily}`; g.textAlign = "center";
      ch.data.datasets.forEach((ds, k) => ch.getDatasetMeta(k).data.forEach((bar, i) => {
        const v = ds.data[i]; if (v >= (k ? 0.1 : 0.01)) g.fillText(k ? v.toFixed(1) + '" snow' : v.toFixed(2) + '"', bar.x, bar.y - 6);
      }));
      g.restore(); }};
    charts.push(new Chart($("cPrecip"), {type: "bar", plugins: [amounts],
      data: {labels, datasets: [{label: "Rain (inches)", data: d.precipitation_sum, backgroundColor: c("--accent"), barPercentage: .7, categoryPercentage: .9}]
        .concat(d.snowfall_sum.some(v => v >= 0.1) ? [{label: "Snow (inches)", data: d.snowfall_sum, backgroundColor: c("--cold"), barPercentage: .7, categoryPercentage: .9}] : [])},   // snow bars only when snow is forecast
      options: {maintainAspectRatio: false, animation: false, layout: {padding: {top: TVF + 8}},
        plugins: {legend: {labels: {color: c("--muted"), boxWidth: 12, boxHeight: 8, font: {size: TVF + 1}}}, tooltip: {enabled: false}},
        scales: {x: {grid: {display: false}, ticks: {color: c("--muted"), font: {size: TVF}}},
          y: {min: 0, suggestedMax: 0.25, grid: {color: c("--line")}, ticks: {color: c("--muted"), font: {size: TVF}, maxTicksLimit: 3, callback: v => v.toFixed(2)}}}}}));
  } else {
    mk("cSky", base({min: 0, max: 100}, {p: {position: "right", grid: {display: false}, ticks: {color: c("--muted"), font: {size: TVF}, callback: v => v.toFixed(2)}}}), [
      {label: "Rain chance %", data: h.precipitation_probability, borderColor: c("--accent"), backgroundColor: c("--accent-fill"), fill: true},
      {label: "Cloud cover %", data: h.cloud_cover, borderColor: c("--cloud"), backgroundColor: c("--cloud-fill"), fill: true, borderWidth: 1},
      {label: "Humidity %", data: h.relative_humidity_2m, borderColor: c("--humid")},
      {label: "Pressure in", data: h.pressure_msl.map(p => p * 0.02953), borderColor: c("--fg"), yAxisID: "p"}]);

    let run = 0;
    mk("cPrecip", base({min: 0, suggestedMax: 0.1, ticks: {color: c("--muted"), font: {size: TVF}, callback: v => v.toFixed(2)}}), [
      {label: "Hourly rain in", type: "bar", data: h.precipitation, backgroundColor: c("--accent")},
      {label: "Snowfall in", type: "bar", data: h.snowfall, backgroundColor: c("--cold")},
      {label: "Running total in", data: h.precipitation.map(p => run += p || 0), borderColor: c("--fg"), borderWidth: 1}]);
  }

  mk("cWind", base({min: 0}), [
    {label: "Wind mph (open field)", data: h.wind_speed_10m, borderColor: c("--accent"),
      pointStyle: "triangle", pointRadius: x => x.dataIndex % 6 ? 0 : 3, pointBackgroundColor: c("--accent"),
      pointRotation: x => (h.wind_direction_10m[x.dataIndex] + 180) % 360},
    {label: "Gusts", data: h.wind_gusts_10m, borderColor: c("--warn"), borderWidth: 1}].concat(STATION ?
    [{label: "Station wind", data: T.map((t, i) => yard("wind", t, h.wind_speed_10m[i])), borderColor: c("--yard"), borderDash: [3, 3]}] : []));
}

let frames = [], fi = 0, timer = null, BASE = null;
function radar() {
  const map = MAP = L.map("radar", {zoomControl: false, attributionControl: true}).setView([LAT, LON], 8);
  BASE = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {attribution: "© OpenStreetMap contributors", maxZoom: 12, className: "basemap"}).addTo(map);
  L.circleMarker([LAT, LON], {radius: 5, color: "#0b7a5a", fillOpacity: 1}).addTo(map);
  const offs = ["m55m", "m50m", "m45m", "m40m", "m35m", "m30m", "m25m", "m20m", "m15m", "m10m", "m05m", ""];
  frames = offs.map((o, i) => ({mins: 55 - i * 5, layer: L.tileLayer(`https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913${o ? "-" + o : ""}/{z}/{x}/{y}.png`, {opacity: 0, attribution: "IEM NEXRAD"}).addTo(map)}));
  step(); play();
  if (window.RADAR_ROTATE) rotateRadar(map);
  $("radarBtn").onclick = () => timer ? (clearInterval(timer), timer = null, $("radarBtn").textContent = "Play") : play();
}
// Active NWS warnings and watches in the location's state, drawn on the radar. Storm warnings come with their own outline;
// winter and flood warnings cover whole counties, so those county shapes are fetched one by one (each fetched once).
const WARN_COLORS = [[/Tornado/, "#ff2d2d"], [/Severe Thunderstorm/, "#ffa500"], [/Flood/, "#2ee86b"], [/Blizzard|Ice Storm/, "#d24dff"],
  [/Winter Storm|Lake Effect Snow|Winter Weather/, "#ff69b4"], [/Wind|Gale|Storm Warning/, "#d2b48c"], [/Freeze|Frost|Wind Chill|Extreme Cold/, "#4fc3ff"], [/./, "#ffd400"]];
async function warnOutlines(map, state) {
  if (!map) return;
  const list = (await get(`https://api.weather.gov/alerts/active?area=${state}&status=actual`)).features
    .filter(f => /Warning|Watch/.test(f.properties.event));
  const zones = {}, seen = {};
  for (const f of list) {
    const ev = f.properties.event, color = WARN_COLORS.find(([re]) => re.test(ev))[1], watch = /Watch/.test(ev);
    const style = {color, weight: watch ? 2 : 3, dashArray: watch ? "6 5" : null, fill: !watch, fillOpacity: 0.12};
    let shapes = f.geometry ? [f] : [];
    if (!f.geometry) for (const z of f.properties.affectedZones.slice(0, 40)) {
      zones[z] = zones[z] || get(z).catch(() => null);
      const g = await zones[z];
      if (g && g.geometry) shapes.push(g);
    }
    shapes.forEach(s => L.geoJSON(s, {style, interactive: false}).addTo(map));
    if (shapes.length) seen[ev] = color;
  }
  $("warnKey").innerHTML = Object.entries(seen).map(([ev, c]) => `<span style="color:${c}">&#9632;</span> ${esc(ev)}`).join(" &nbsp; ");
}

// TV only: the radar box cycles local radar, Great Lakes radar, then (in daylight only) satellite clouds, 20 seconds each.
// Satellite is GOES-East visible imagery from the same source as the radar. At night the satellite view is skipped.
function rotateRadar(map) {
  let v = 0, sat = null;
  const mins = t => +t.slice(0, 2) * 60 + +t.slice(3, 5);
  const daylight = () => {   // visible imagery goes dark near sunrise and sunset, so allow an hour of margin
    const s = window.SUNTIMES, now = new Date().toLocaleString("sv-SE", {timeZone: TZ}).slice(11, 16);
    return !!s && mins(now) > mins(s[0]) + 60 && mins(now) < mins(s[1]) - 60;
  };
  // Crossfade: fade the map out, switch while it's hidden, wait for the new images (2 s at most), then fade back in.
  const box = document.getElementById("radar");
  const loaded = layer => Promise.race([new Promise(r => layer.once("load", r)), new Promise(r => setTimeout(r, 2000))]);
  setInterval(() => {
    box.style.transition = "opacity .6s ease-in";
    box.style.opacity = 0;
    setTimeout(() => {
      const views = [["Radar, local", 8], [STATION ? "Radar, Great Lakes" : "Radar, region", 6]].concat(daylight() ? [["Satellite clouds", 6, true]] : []);
      v = (v + 1) % views.length;
      const [title, zoom, isSat] = views[v];
      if (sat) { map.removeLayer(sat); sat = null; }
      let ready;
      if (isSat) {
        clearInterval(timer); timer = null;
        frames.forEach(f => f.layer.setOpacity(0));
        sat = L.tileLayer(`https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/goes_east_conus_ch02/{z}/{x}/{y}.png?t=${Date.now()}`,
          {opacity: 0.75, attribution: "IEM GOES"});
        ready = Promise.all([loaded(sat), loaded(BASE)]);
        sat.addTo(map);
        $("radarTime").textContent = "Latest";
        $("radarProg").style.width = "100%";
        $("dbzKey").style.visibility = "hidden";   // the rain color key means nothing on the satellite view
      } else {
        ready = Promise.all([loaded(frames[frames.length - 1].layer), loaded(BASE)]);   // map background too, so no grey flash
        $("dbzKey").style.visibility = "";
        if (!timer) play();
      }
      map.setView([LAT, LON], zoom, {animate: false});
      $("radarTitle").textContent = title;
      ready.then(() => { box.style.transition = "opacity .8s ease-out"; box.style.opacity = 1; });
    }, 650);
  }, 20000);
}

function play() { if (matchMedia("(prefers-reduced-motion: reduce)").matches) { fi = frames.length - 1; step(); return; } timer = setInterval(step, 600); $("radarBtn").textContent = "Pause"; }
function step() {
  frames.forEach((f, i) => f.layer.setOpacity(i === fi ? 0.7 : 0));
  const f = frames[fi]; $("radarTime").textContent = f.mins ? `${f.mins} min ago` : "Latest";
  $("radarProg").style.width = ((fi + 1) / frames.length * 100) + "%";   // timeline bar under the map fills as the loop plays
  fi = (fi + 1) % frames.length;
}

function note(msg) { const p = $("problems"); p.hidden = false; p.textContent += (p.textContent ? "; " : "Problems: ") + msg; }
window.addEventListener("error", e => note(e.message));
main().catch(e => { note(e.message); $("rainCall").textContent = "Could not load forecast"; });
setTimeout(() => location.reload(), 15 * 60000);   // refresh every 15 min so it can stay open on a phone or TV
