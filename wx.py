"""Home weather data collector.

Commands (run by GitHub Actions, not by hand):
  python wx.py latest    - current station reading -> data/latest.json, plus the daily work if it's due
  python wx.py daily     - same as latest (the daily work runs once per day, from whichever run comes first after 4 AM)
                           daily work: add yesterday's data, log NWS forecast, rebuild correction + scorecard
  python wx.py backfill  - pull station history and past model forecasts back to START_DATE

Keys come from environment variables AMBIENT_API_KEY and AMBIENT_APP_KEY (GitHub secrets).
"""
import csv, http.client, json, os, statistics, sys, time, urllib.parse, urllib.request
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

TZ = ZoneInfo("America/Detroit")
START_DATE = "2024-01-01"            # Open-Meteo past-forecast archive starts about here
FALLBACK_LAT, FALLBACK_LON = 42.789, -85.516   # Caledonia; replaced by station coordinates when Ambient has them
DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
VARS = ["temp", "dew", "wind"]       # variables we correct
MIN_SAMPLES = 20                     # fewest past hours needed in a bucket before we trust it
UA = {"User-Agent": "home-weather-dashboard (personal use)"}


def get_json(url, params=None):
    if params:
        url += "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=UA)
    for wait in (2, 5, 15, 30, 60, 0):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if (e.code != 429 and e.code < 500) or not wait:   # retry "too many requests" and server errors
                raise
        except (OSError, ValueError, http.client.HTTPException):  # dropped or cut-off connection
            if not wait:
                raise
        time.sleep(wait)


def path(name):
    return os.path.join(DATA, name)


def read_csv(name):
    if not os.path.exists(path(name)):
        return {}
    with open(path(name)) as f:
        return {row["time"]: row for row in csv.DictReader(f)}


def write_csv(name, rows, fields):
    os.makedirs(DATA, exist_ok=True)
    with open(path(name), "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["time"] + fields)
        w.writeheader()
        for t in sorted(rows):
            w.writerow({"time": t, **{k: rows[t].get(k, "") for k in fields}})


def write_json(name, obj):
    os.makedirs(DATA, exist_ok=True)
    with open(path(name), "w") as f:
        json.dump(obj, f, indent=1)


# ---------- station (Ambient Weather) ----------

def ambient_keys():
    return {"apiKey": os.environ["AMBIENT_API_KEY"], "applicationKey": os.environ["AMBIENT_APP_KEY"]}


DEVICE = None


def ambient_device():
    global DEVICE
    if DEVICE is None:
        DEVICE = get_json("https://api.ambientweather.net/v1/devices", ambient_keys())[0]
    dev = DEVICE
    coords = (dev.get("info", {}).get("coords") or {}).get("coords") or {}
    # Rounded to 2 decimals (about half a mile) before anything is published: the repo and page are public.
    return dev, round(coords.get("lat", FALLBACK_LAT), 2), round(coords.get("lon", FALLBACK_LON), 2)


def location():
    meta = read_json("latest.json") or {}
    return meta.get("lat", FALLBACK_LAT), meta.get("lon", FALLBACK_LON)


def read_json(name):
    if not os.path.exists(path(name)):
        return None
    with open(path(name)) as f:
        return json.load(f)


def cmd_latest():
    dev, lat, lon = ambient_device()
    d = dev["lastData"]
    write_json("latest.json", {
        "lat": lat, "lon": lon, "time": d.get("date"),
        "temp": d.get("tempf"), "dew": d.get("dewPoint"), "feels": d.get("feelsLike"),
        "humidity": d.get("humidity"), "wind": d.get("windspeedmph"), "gust": d.get("windgustmph"),
        "winddir": d.get("winddir"), "maxgust_today": d.get("maxdailygust"),
        "pressure": d.get("baromrelin"), "rain_rate": d.get("hourlyrainin"),
        "rain_today": d.get("dailyrainin"), "rain_event": d.get("eventrainin"),
        "solar": d.get("solarradiation"), "uv": d.get("uv"),
    })


MAC = None


def station_readings(end_ms):
    """Up to 288 five-minute readings ending at end_ms (newest first)."""
    global MAC
    if MAC is None:
        MAC = ambient_device()[0]["macAddress"]
    time.sleep(1.1)  # Ambient allows about one request per second
    return get_json(f"https://api.ambientweather.net/v1/devices/{MAC}",
                    {**ambient_keys(), "endDate": end_ms, "limit": 288})


def to_hourly(readings):
    """Turn 5-minute readings into one row per hour: temp/dew/wind averaged within 10 min of the hour, gust = max of prior hour."""
    near, gusts = {}, {}
    for r in readings:
        t = datetime.fromtimestamp(r["dateutc"] / 1000, timezone.utc)
        top = (t + timedelta(minutes=30)).replace(minute=0, second=0, microsecond=0)
        if abs((t - top).total_seconds()) <= 600:
            near.setdefault(top, []).append(r)
        nxt = t.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)
        if r.get("windgustmph") is not None:
            gusts[nxt] = max(gusts.get(nxt, 0), r["windgustmph"])
    rows = {}
    for top, rs in near.items():
        def avg(k):
            v = [x[k] for x in rs if x.get(k) is not None]
            return round(sum(v) / len(v), 1) if v else ""
        rows[top.strftime("%Y-%m-%dT%H:00")] = {"temp": avg("tempf"), "dew": avg("dewPoint"),
                                                "wind": avg("windspeedmph"), "gust": gusts.get(top, "")}
    return rows


def add_station_history(since, resume=False, minutes=45):
    """Walk back from now (or, to resume a backfill, from the oldest saved hour) to `since`.
    Saves every 50 days so a failure loses little; stops after `minutes` so the run ends cleanly."""
    obs = read_csv("obs_hourly.csv")
    end = datetime.now(timezone.utc)
    if resume and obs:
        end = datetime.fromisoformat(min(obs)).replace(tzinfo=timezone.utc) + timedelta(hours=1)
    stop = datetime.fromisoformat(since).replace(tzinfo=timezone.utc)
    deadline = time.time() + minutes * 60
    readings, finished = [], False

    def save():
        new = to_hourly(readings)
        oldest_full = min(new)[:13] if new else ""
        obs.update({t: r for t, r in new.items() if t[:13] > oldest_full})  # oldest hour may be partial
        write_csv("obs_hourly.csv", obs, ["temp", "dew", "wind", "gust"])

    try:
        while end > stop and time.time() < deadline:
            batch = station_readings(int(end.timestamp() * 1000))
            if not batch:
                break
            readings += batch
            oldest = min(r["dateutc"] for r in batch)
            end = datetime.fromtimestamp(oldest / 1000, timezone.utc) - timedelta(seconds=1)
            if len(readings) % (288 * 50) < len(batch):
                save()
        finished = end <= stop or time.time() < deadline
    finally:
        save()
    return len(obs), finished


# ---------- past model forecasts (Open-Meteo, 24 hours ahead) ----------

def add_model_history(start, end):
    lat, lon = location()
    model = read_csv("model_d1.csv")
    s = datetime.fromisoformat(start)
    e = datetime.fromisoformat(end)
    while s <= e:
        chunk_end = min(s + timedelta(days=89), e)
        d = get_json("https://previous-runs-api.open-meteo.com/v1/forecast", {
            "latitude": lat, "longitude": lon, "timezone": "GMT",
            "start_date": s.date().isoformat(), "end_date": chunk_end.date().isoformat(),
            "hourly": "temperature_2m_previous_day1,dew_point_2m_previous_day1,wind_speed_10m_previous_day1",
            "temperature_unit": "fahrenheit", "wind_speed_unit": "mph"})["hourly"]
        for i, t in enumerate(d["time"]):
            vals = [d["temperature_2m_previous_day1"][i], d["dew_point_2m_previous_day1"][i],
                    d["wind_speed_10m_previous_day1"][i]]
            if None not in vals:
                model[t] = dict(zip(VARS, vals))
        s = chunk_end + timedelta(days=1)
    write_csv("model_d1.csv", model, VARS)
    return len(model)


# ---------- NWS forecast log (no free archive exists, so we keep our own from day one) ----------

def log_nws_tomorrow():
    lat, lon = location()
    pt = get_json(f"https://api.weather.gov/points/{lat:.4f},{lon:.4f}")["properties"]
    periods = get_json(pt["forecastHourly"])["properties"]["periods"]
    nws = read_csv("nws_d1.csv")
    now = datetime.now(timezone.utc)
    for p in periods:
        t = datetime.fromisoformat(p["startTime"]).astimezone(timezone.utc)
        if timedelta(hours=18) <= t - now < timedelta(hours=42):   # about one day ahead, like the model archive
            dew = p.get("dewpoint", {}).get("value")
            nws[t.strftime("%Y-%m-%dT%H:00")] = {
                "temp": p["temperature"],
                "dew": round(dew * 9 / 5 + 32, 1) if dew is not None else "",
                "wind": int(p["windSpeed"].split()[0]) if p.get("windSpeed") else ""}
    write_csv("nws_d1.csv", nws, VARS)


# ---------- correction and scorecard ----------

def season(month):
    return ["winter", "winter", "spring", "spring", "spring", "summer",
            "summer", "summer", "fall", "fall", "fall", "winter"][month - 1]


def local(t):
    return datetime.fromisoformat(t).replace(tzinfo=timezone.utc).astimezone(TZ)


def pairs(var, fc):
    obs = read_csv("obs_hourly.csv")
    out = []
    for t, f in fc.items():
        o = obs.get(t)
        if o and o.get(var) not in ("", None) and f.get(var) not in ("", None):
            out.append((t, float(o[var]), float(f[var])))
    return sorted(out)


def build_table(var, prs):
    """Typical error by season+hour (falling back to hour only). Temp/dew: add a fixed amount. Wind: multiply by a ratio."""
    groups = {}
    for t, o, f in prs:
        lt = local(t)
        groups.setdefault(f"{season(lt.month)}-{lt.hour}", []).append((o, f))
        groups.setdefault(f"any-{lt.hour}", []).append((o, f))
    table = {}
    for k, g in groups.items():
        if len(g) < MIN_SAMPLES:
            continue
        if var == "wind":
            fs = sum(f for _, f in g)
            table[k] = round(sum(o for o, _ in g) / fs, 3) if fs > 0 else 1.0
        else:
            table[k] = round(statistics.median(o - f for o, f in g), 2)
    return table


def apply(var, table, t, f):
    lt = local(t)
    adj = table.get(f"{season(lt.month)}-{lt.hour}", table.get(f"any-{lt.hour}"))
    if adj is None:
        return f
    return f * adj if var == "wind" else f + adj


def mae(xs):
    return round(sum(abs(x) for x in xs) / len(xs), 2) if xs else None


def overnight_lows(prs, var_index):
    """Lowest value 8 PM - 8 AM for each night, keyed by the evening's date."""
    lows = {}
    for p in prs:
        lt = local(p[0])
        if lt.hour >= 20 or lt.hour < 8:
            night = (lt - timedelta(hours=8)).date().isoformat()
            lows.setdefault(night, []).append(p[var_index])
    return {n: min(v) for n, v in lows.items() if len(v) >= 10}


def cmd_rebuild():
    model, nws = read_csv("model_d1.csv"), read_csv("nws_d1.csv")
    result = {"updated": datetime.now(TZ).isoformat(timespec="minutes"), "vars": {}}
    for var in VARS:
        prs = pairs(var, model)
        days = len({p[0][:10] for p in prs})
        if days < 30:
            result["vars"][var] = {"on": False, "days": days, "note": "Not enough history yet"}
            continue
        test_days = 60 if days >= 120 else 30
        cut = (datetime.fromisoformat(prs[-1][0]) - timedelta(days=test_days)).strftime("%Y-%m-%dT%H:00")
        train = [p for p in prs if p[0] < cut]
        test = [p for p in prs if p[0] >= cut]
        tbl = build_table(var, train)
        corrected = [(t, o, apply(var, tbl, t, f)) for t, o, f in test]
        raw_err = mae([f - o for _, o, f in test])
        cor_err = mae([f - o for _, o, f in corrected])
        entry = {"days": days, "test_days": test_days, "raw_error": raw_err, "corrected_error": cor_err,
                 "on": cor_err is not None and cor_err < raw_err * 0.95,   # must cut the miss by at least 5%
                 "typical_bias": round(statistics.median(o - f for _, o, f in prs), 1) if var != "wind"
                 else round(sum(o for _, o, _ in prs) / max(sum(f for _, _, f in prs), 0.1), 2)}
        if var == "temp":
            ol, rl, cl = overnight_lows(test, 1), overnight_lows(test, 2), overnight_lows(corrected, 2)
            nights = sorted(set(ol) & set(rl) & set(cl))
            entry["low_raw_error"] = mae([rl[n] - ol[n] for n in nights])
            entry["low_corrected_error"] = mae([cl[n] - ol[n] for n in nights])
            entry["low_nights"] = len(nights)
            if entry["low_corrected_error"] is not None and entry["low_corrected_error"] > entry["low_raw_error"]:
                entry["on"] = False   # never let the correction make overnight lows worse
        # How the official NWS forecast has done over the same test hours, once we have our own log
        nprs = [p for p in pairs(var, nws) if p[0] >= cut]
        if len({p[0][:10] for p in nprs}) >= 14:
            hrs = {p[0] for p in nprs}
            entry["nws_error"] = mae([f - o for _, o, f in nprs])
            entry["corrected_error_same_hours"] = mae([f - o for t, o, f in corrected if t in hrs])
        entry["nws_days"] = len({p[0][:10] for p in pairs(var, nws)})
        entry["table"] = build_table(var, prs) if entry["on"] else {}
        result["vars"][var] = entry
    write_json("correction.json", result)


def cmd_daily():
    os.makedirs(DATA, exist_ok=True)
    cmd_latest()
    add_station_history((datetime.now(timezone.utc) - timedelta(days=2)).date().isoformat())
    today = datetime.now(timezone.utc).date()
    add_model_history((today - timedelta(days=3)).isoformat(), (today - timedelta(days=1)).isoformat())
    log_nws_tomorrow()
    cmd_rebuild()
    done = read_json("correction.json")
    done["daily_done"] = datetime.now(TZ).date().isoformat()   # marks today's daily work as finished
    write_json("correction.json", done)


def daily_due():
    """GitHub skips many scheduled runs, so any run after 4 AM Michigan time does the daily work if it hasn't been done today.
    Whichever run gets there first does it; a step that fails is retried by the next run."""
    now = datetime.now(TZ)
    return now.hour >= 4 and (read_json("correction.json") or {}).get("daily_done") != now.date().isoformat()


def cmd_scheduled():
    cmd_daily() if daily_due() else cmd_latest()


def cmd_backfill():
    os.makedirs(DATA, exist_ok=True)
    cmd_latest()
    n_obs, finished = add_station_history(START_DATE, resume=True)
    first = min(read_csv("obs_hourly.csv"))[:10]
    n_mod = add_model_history(max(first, START_DATE),
                              (datetime.now(timezone.utc).date() - timedelta(days=1)).isoformat())
    cmd_rebuild()
    print(f"Station hours: {n_obs}, back to {first}. Model hours: {n_mod}.")
    print("BACKFILL COMPLETE" if finished else "BACKFILL PARTIAL - run backfill again to continue")


if __name__ == "__main__":
    # Both schedules (15-minute and daily) run the same check; the daily work happens once per day either way
    {"latest": cmd_scheduled, "daily": cmd_scheduled, "backfill": cmd_backfill, "rebuild": cmd_rebuild}[sys.argv[1]]()
