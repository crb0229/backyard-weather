// TEST: drawings and startup animations for the holiday themes on tv-test.html.
// A startup animation runs on one see-through canvas over the whole screen for at most 8 seconds, fades out in the
// last second, then the canvas is removed and nothing keeps running.
(function () {
  const DUR = 8;
  const rnd = (a, b) => a + Math.random() * (b - a);

  // Sprite pictures made for the animations. While one is still loading its pieces are not drawn at all (no placeholder
  // dots); only if it failed to load does an effect draw a simple shape instead.
  const SPR = {}, WAIT = {};
  function sprite(name) {
    if (!SPR[name]) { const i = new Image(); i.src = `img/holiday/sprite-${name}.webp`; SPR[name] = i; }
    const i = SPR[name];
    return i.complete && i.naturalWidth ? i : i.complete ? null : WAIT;
  }
  function drawSprite(g, img, x, y, size, rot, alpha) {
    g.save(); g.translate(x, y); g.rotate(rot); g.globalAlpha *= alpha;
    g.drawImage(img, -size / 2, -size / 2, size, size);
    g.restore();
  }

  // Each effect: (g, w, h, t seconds, st = state kept for this run). u scales sizes to the screen height.
  const INTROS = {
    // Christmas: real snowflakes drift down slowly, swaying and turning
    snow(g, w, h, t, st) {
      const u = h / 1080;
      st.f = st.f || Array.from({length: 100}, () => ({x: rnd(0, w), y: rnd(-1.9 * h, -0.05 * h), s: rnd(16, 40) * u, v: rnd(0.07, 0.13) * h,
        sw: rnd(10, 30) * u, fq: rnd(0.4, 0.9), ph: rnd(0, 6.3), r: rnd(-0.4, 0.4)}));
      const img = sprite("snowflake");
      if (img === WAIT) return;   // the snowflake picture is still loading
      for (const f of st.f) {
        const x = f.x + Math.sin(t * f.fq + f.ph) * f.sw, y = f.y + f.v * t;
        if (img) drawSprite(g, img, x, y, f.s, f.ph + f.r * t, 0.85);
        else { g.globalAlpha = 0.8; g.fillStyle = "#fff"; g.beginPath(); g.arc(x, y, f.s / 6, 0, 6.3); g.fill(); g.globalAlpha = 1; }
      }
    },
    // New Year's: soft gold confetti tumbling down, a few confetti clusters, and bubbles rising from the bottom
    confetti(g, w, h, t, st) {
      const u = h / 1080, COLORS = ["#e8c86a", "#f1e2b4", "#d9ae5c", "#f6edd2"];
      st.p = st.p || Array.from({length: 34}, () => ({x: rnd(0, w), y: rnd(-0.5 * h, 0), wd: rnd(8, 14) * u, ht: rnd(4, 7) * u, v: rnd(0.08, 0.16) * h,
        sw: rnd(15, 40) * u, fq: rnd(0.6, 1.4), ph: rnd(0, 6.3), spin: rnd(2, 5), c: COLORS[Math.floor(Math.random() * 4)]}));
      st.c = st.c || Array.from({length: 4}, () => ({x: rnd(0.1, 0.9) * w, y: rnd(-0.4 * h, -0.1 * h), s: rnd(110, 160) * u, v: rnd(0.07, 0.11) * h, r: rnd(-0.5, 0.5)}));
      st.b = st.b || Array.from({length: 18}, () => ({x: rnd(0.05, 0.95) * w, y: h + rnd(0, 0.3 * h), r: rnd(3, 8) * u, v: rnd(0.06, 0.12) * h, ph: rnd(0, 6.3)}));
      for (const p of st.p) {
        const x = p.x + Math.sin(t * p.fq + p.ph) * p.sw, y = p.y + p.v * t;
        g.save(); g.translate(x, y); g.rotate(p.ph + t); g.scale(1, Math.cos(t * p.spin + p.ph));   // tumbling flat piece
        g.globalAlpha *= 0.9; g.fillStyle = p.c; g.fillRect(-p.wd / 2, -p.ht / 2, p.wd, p.ht); g.restore();
      }
      const img = sprite("confetti");
      if (img && img !== WAIT) for (const k of st.c) drawSprite(g, img, k.x, k.y + k.v * t, k.s, k.r + t * 0.3, 0.9);
      g.lineWidth = 1.2 * u;
      for (const b of st.b) {
        const x = b.x + Math.sin(t * 1.5 + b.ph) * 6 * u, y = b.y - b.v * t;
        g.strokeStyle = "rgba(243,220,154,.55)"; g.beginPath(); g.arc(x, y, b.r, 0, 6.3); g.stroke();
        g.fillStyle = "rgba(255,255,255,.35)"; g.beginPath(); g.arc(x - b.r * 0.35, y - b.r * 0.35, b.r * 0.25, 0, 6.3); g.fill();
      }
    },
    // Halloween: a few friendly bats flutter across once while the pumpkin glows like a candle (CSS class on the picture)
    bats(g, w, h, t, st) {
      const u = h / 1080;
      st.b = st.b || Array.from({length: 4}, (_, i) => ({t0: i * 0.9 + rnd(0, 0.4), dir: i % 2 ? -1 : 1, y: rnd(0.12, 0.45) * h, s: rnd(70, 110) * u,
        amp: rnd(25, 60) * u, dur: rnd(4.2, 5.2), fq: rnd(9, 12)}));
      const img = sprite("bat");
      if (img === WAIT) return;   // the bat picture is still loading
      for (const b of st.b) {
        const k = (t - b.t0) / b.dur;
        if (k < 0 || k > 1) continue;
        const x = b.dir > 0 ? -b.s + k * (w + 2 * b.s) : w + b.s - k * (w + 2 * b.s), y = b.y + Math.sin(k * 6.3) * b.amp;
        const flap = 0.55 + 0.45 * Math.abs(Math.sin(t * b.fq));
        g.save(); g.translate(x, y); g.scale(b.dir, flap);
        if (img) g.drawImage(img, -b.s / 2, -b.s / 2, b.s, b.s);
        else { g.fillStyle = "#2a2226"; g.beginPath(); g.ellipse(0, 0, b.s / 2, b.s / 6, 0, 0, 6.3); g.fill(); }
        g.restore();
      }
    },
    // Thanksgiving: maple and oak leaves tumble down once, flipping as they fall
    leaves(g, w, h, t, st) {
      const u = h / 1080, names = ["maple-rust", "maple-amber", "oak-gold"];
      // A long stream of leaves (up to almost two screens above the top), so they keep coming for the whole 18 seconds
      st.l = st.l || Array.from({length: 48}, (_, i) => ({n: names[i % 3], x: rnd(0, w), y: rnd(-1.9 * h, -0.05 * h), s: rnd(40, 75) * u, v: rnd(0.1, 0.16) * h,
        sw: rnd(30, 70) * u, fq: rnd(0.5, 1), ph: rnd(0, 6.3), flip: rnd(1.2, 2.4), spin: rnd(-0.6, 0.6)}));
      for (const l of st.l) {
        const img = sprite(l.n), x = l.x + Math.sin(t * l.fq + l.ph) * l.sw, y = l.y + l.v * t;
        if (img === WAIT) continue;   // this leaf picture is still loading
        g.save(); g.translate(x, y); g.rotate(l.ph + l.spin * t); g.scale(Math.cos(t * l.flip + l.ph), 1);
        if (img) g.drawImage(img, -l.s / 2, -l.s / 2, l.s, l.s);
        else { g.fillStyle = "#c56a2c"; g.beginPath(); g.ellipse(0, 0, l.s / 2, l.s / 4, 0, 0, 6.3); g.fill(); }
        g.restore();
      }
    },
    // Fourth of July: the flag beside the title ripples and settles, while a few soft fireworks burst behind the title
    flag(g, w, h, t, st) {
      const u = h / 1080, COLORS = ["#cf6a63", "#ece4d4", "#6f8fc4"], svg = document.querySelector("#holPic svg");
      if (svg) { const k = Math.min(1, t / 6); drawFlag(svg, 1 - 0.45 * k * k, Math.min(t, 6) * 0.55); }
      st.f = st.f || [0.4, 1.9, 3.4, 4.9].map((t0, i) => ({t0, x: rnd(0.3, 0.75) * w, y: rnd(0.12, 0.32) * h, c: COLORS[i % 3],
        p: Array.from({length: 30}, (_, j) => ({a: j / 30 * 6.3 + rnd(-0.1, 0.1), v: rnd(0.75, 1) * 180 * u}))}));
      g.lineCap = "round";
      for (const f of st.f) {
        const k = t - f.t0;
        if (k < 0 || k > 2.2) continue;
        if (k < 0.5) {   // the rocket rising
          const y = h - (h - f.y) * (k / 0.5);
          g.strokeStyle = "rgba(236,228,212,.6)"; g.lineWidth = 2 * u; g.beginPath(); g.moveTo(f.x, y + 30 * u); g.lineTo(f.x, y); g.stroke();
          continue;
        }
        const e = k - 0.5, fade = Math.max(0, 1 - e / 1.7);
        g.strokeStyle = f.c; g.lineWidth = 2.4 * u;
        for (const s of f.p) {
          const r = s.v * (1 - Math.exp(-2.2 * e)), drop = 30 * u * e * e, x = f.x + Math.cos(s.a) * r, y = f.y + Math.sin(s.a) * r + drop;
          const r0 = s.v * (1 - Math.exp(-2.2 * Math.max(0, e - 0.12)));
          g.globalAlpha = fade * Math.min(1, DUR - t);
          g.beginPath(); g.moveTo(f.x + Math.cos(s.a) * r0, f.y + Math.sin(s.a) * r0 + drop * 0.9); g.lineTo(x, y); g.stroke();
        }
        g.globalAlpha = Math.min(1, DUR - t);
      }
    },
    // Easter: the bunny hops in from the left and sits beside the title (CSS animation on the picture); nothing drawn here
    bunny() {},
    // May the 4th: a short jump to lightspeed, star streaks rushing out from the center, then the screen settles
    lightspeed(g, w, h, t, st) {
      const u = h / 1080, cx = w / 2, cy = h / 2;
      st.s = st.s || Array.from({length: 60}, () => ({a: rnd(0, 6.3), r0: rnd(10, 0.45 * h), sp: rnd(0.8, 1.3)}));
      const veil = Math.max(0, Math.min(1, t / 0.4, (3 - t) / 0.8));
      g.fillStyle = `rgba(4,6,12,${0.45 * veil})`; g.fillRect(0, 0, w, h);
      const pace = Math.pow(Math.min(t, 2.2), 2.2);
      g.lineCap = "round";
      for (const s of st.s) {
        const r = s.r0 * (1 + pace * s.sp * 1.6), len = Math.min(0.5 * h, 8 * u + pace * s.sp * 0.18 * s.r0);
        g.strokeStyle = `rgba(214,226,255,${0.85 * veil})`; g.lineWidth = 1.6 * u;
        g.beginPath(); g.moveTo(cx + Math.cos(s.a) * r, cy + Math.sin(s.a) * r); g.lineTo(cx + Math.cos(s.a) * (r + len), cy + Math.sin(s.a) * (r + len)); g.stroke();
      }
    }
  };
  INTROS.bunny.dur = 3.6;
  INTROS.snow.dur = 18;     // Christmas snow lasts as long as the leaves
  INTROS.leaves.dur = 18;   // Thanksgiving leaves fall 10 seconds longer than the usual 8
  INTROS.lightspeed.dur = 3.2;
  const PIC_CLASS = {bats: "hol-glow", bunny: "hol-hop"};   // the header picture's own part of some animations

  // ---------- Fourth of July flag: stripes and all 50 stars bend with the cloth; the folds are one smooth shading layer ----------
  function drawFlag(svg, amp, ph) {
    const X0 = 20, Y0 = 12, W = 74, H = W / 1.9, CW = W * 0.4, CH = H * 7 / 13, N = 40;
    const U = x => (x - X0) / W;
    const dy = x => { const u = U(x); return amp * 3.2 * u * Math.sin(2 * Math.PI * (u * 1.35 - ph)); };
    const dx = x => { const u = U(x); return -amp * 1.4 * u * (1 - Math.cos(2 * Math.PI * (u * 1.35 - ph))) / 2; };
    const slope = x => { const u = U(x); return Math.cos(2 * Math.PI * (u * 1.35 - ph)) * (0.25 + u) * amp; };
    const P = (x, y) => `${(x + dx(x)).toFixed(2)},${(y + dy(x)).toFixed(2)}`;
    const band = (xa, xb, ya, yb) => { const top = [], bot = []; for (let i = 0; i <= N; i++) { const x = xa + (xb - xa) * i / N; top.push(P(x, ya)); bot.unshift(P(x, yb)); } return top.concat(bot).join(" "); };
    const star = (cx, cy, r) => { let s = ""; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.4 : r; s += `${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)} `; } return s; };
    let stops = "";
    for (let i = 0; i <= 24; i++) { const x = X0 + W * i / 24, s = slope(x); stops += `<stop offset="${(i / 24).toFixed(3)}" stop-color="${s > 0 ? "#fff" : "#000"}" stop-opacity="${Math.min(0.3, Math.abs(s) * 0.22).toFixed(3)}"/>`; }
    let o = `<defs><linearGradient id="flagShade" gradientUnits="userSpaceOnUse" x1="${X0}" x2="${X0 + W}" y1="0" y2="0">${stops}</linearGradient>
      <linearGradient id="flagPole" x1="0" x2="1"><stop offset="0" stop-color="#7d7a74"/><stop offset=".45" stop-color="#e6dfd2"/><stop offset="1" stop-color="#6e6b66"/></linearGradient>
      <radialGradient id="flagFin" cx="35%" cy="35%"><stop offset="0" stop-color="#f6e2a8"/><stop offset="1" stop-color="#a87f33"/></radialGradient></defs>`;
    o += `<rect x="${X0 - 3.4}" y="${Y0 - 4}" width="2.4" height="${68 - Y0 + 4}" rx="1.2" fill="url(#flagPole)"/><circle cx="${X0 - 2.2}" cy="${Y0 - 5.2}" r="2.4" fill="url(#flagFin)"/>`;
    for (let i = 0; i < 13; i++) o += `<polygon class="stripe" points="${band(X0, X0 + W, Y0 + i * H / 13, Y0 + (i + 1) * H / 13 + 0.05)}" fill="${i % 2 ? "#ece4d4" : "#b9524e"}"/>`;
    o += `<polygon points="${band(X0, X0 + CW, Y0, Y0 + CH)}" fill="#2c4370"/>`;
    for (let j = 0; j < 9; j++) {
      const n = j % 2 ? 5 : 6, y = Y0 + (j + 1) * CH / 10;
      for (let k = 0; k < n; k++) { const x = X0 + (j % 2 ? k * 2 + 2 : k * 2 + 1) * CW / 12; o += `<polygon class="star" points="${star(x + dx(x), y + dy(x), 1.05)}" fill="#ece4d4"/>`; }
    }
    o += `<polygon points="${band(X0, X0 + W, Y0, Y0 + H)}" fill="url(#flagShade)" stroke="#000" stroke-opacity=".25" stroke-width=".3"/>`;
    svg.setAttribute("viewBox", "8 2 92 66");
    svg.innerHTML = o;
  }

  // ---------- May the 4th Death Star: curved panels, trench, recessed dish and station lights, shadowed in tonight's moon phase ----------
  function drawDeathStar(svg, lit, waxing, id) {
    const C = 50, R = 40, T = 14 * Math.PI / 180, D = Math.PI / 180;
    let seed = 1234567; const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
    // Model point -> view vector (tilted so we look slightly down on the north half)
    const vec = (lat, lon) => { const X = Math.cos(lat) * Math.sin(lon), Y = Math.sin(lat), Z = Math.cos(lat) * Math.cos(lon);
      return [X, Y * Math.cos(T) - Z * Math.sin(T), Z * Math.cos(T) + Y * Math.sin(T)]; };
    const scr = v => `${(C + R * v[0]).toFixed(2)},${(C - R * v[1]).toFixed(2)}`;
    const L = (() => { const l = [-0.55, 0.5, 0.67], n = Math.hypot(...l); return l.map(x => x / n); })();
    const shade = (v, k) => { const d = Math.max(0, v[0] * L[0] + v[1] * L[1] + v[2] * L[2]);
      const b = 0.16 + 0.84 * Math.pow(d, 0.85), rim = Math.pow(1 - v[2], 3) * 0.12;
      const r = 168 * b * k + 10 + rim * 60, g = 176 * b * k + 12 + rim * 80, bl = 188 * b * k + 22 + rim * 120;   // cool steel, blue in the shadows
      return `rgb(${r | 0},${g | 0},${bl | 0})`; };
    let s = `<defs><clipPath id="c${id}"><circle cx="50" cy="50" r="${R}"/></clipPath>
      <radialGradient id="limb${id}" cx="50%" cy="50%" r="50%"><stop offset=".72" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></radialGradient>
      <radialGradient id="spec${id}" cx="32%" cy="28%" r="30%"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
      <filter id="soft${id}"><feGaussianBlur stdDeviation="1.1"/></filter><filter id="glow${id}"><feGaussianBlur stdDeviation=".35"/></filter></defs>`;
    s += `<circle cx="50" cy="50" r="${R}" fill="#20252e"/><g clip-path="url(#c${id})">`;
    // Surface panels: latitude bands split into uneven blocks, each lit by its facing direction
    const lights = [];
    for (let la = -90; la < 90; la += 6) {
      let lo = -180 + rnd() * 8;
      while (lo < 180) {
        const w = 5 + rnd() * 12, a = la * D, b = Math.min(la + 6, 90) * D, l0 = lo * D, l1 = Math.min(lo + w, 180) * D, lm = (l0 + l1) / 2;
        const ctr = vec((a + b) / 2, lm);
        if (ctr[2] > -0.15) {
          const k = 0.9 + rnd() * 0.18 - (rnd() < .12 ? .12 : 0);
          const pts = [vec(a, l0), vec(a, lm), vec(a, l1), vec(b, l1), vec(b, lm), vec(b, l0)].map(scr).join(" ");
          s += `<polygon points="${pts}" fill="${shade(ctr, k)}" stroke="#151920" stroke-opacity=".55" stroke-width=".18"/>`;
          if (rnd() < .07 && Math.abs(la) < 70) lights.push(ctr);
        }
        lo += w;
      }
    }
    // Equator trench: dark channel with a lit lower lip
    const arc = (lat, a0, a1) => { const p = []; for (let lo = a0; lo <= a1; lo += 3) { const v = vec(lat * D, lo * D); if (v[2] > 0) p.push(scr(v)); } return p.join(" "); };
    s += `<polyline points="${arc(0.9, -90, 90)}" fill="none" stroke="#0e1117" stroke-width="2.1"/>`;
    s += `<polyline points="${arc(-1.4, -90, 90)}" fill="none" stroke="#c9d0da" stroke-opacity=".45" stroke-width=".45"/>`;
    s += `<polyline points="${arc(3.2, -90, 90)}" fill="none" stroke="#0e1117" stroke-opacity=".6" stroke-width=".35"/>`;
    // Superlaser dish: a recessed bowl, darker toward the light, with rings and eight focus lines
    const dc = [30 * D, -34 * D], cv = vec(dc[0], dc[1]);
    const up = [0, 1, 0], e1 = (() => { const c = [cv[1] * up[2] - cv[2] * up[1], cv[2] * up[0] - cv[0] * up[2], cv[0] * up[1] - cv[1] * up[0]], n = Math.hypot(...c); return c.map(x => x / n); })();
    const e2 = [cv[1] * e1[2] - cv[2] * e1[1], cv[2] * e1[0] - cv[0] * e1[2], cv[0] * e1[1] - cv[1] * e1[0]];
    const ring = (ang, n = 48) => { const p = []; for (let i = 0; i <= n; i++) { const t = i / n * 2 * Math.PI, sd = Math.sin(ang), cd = Math.cos(ang);
      p.push([0, 1, 2].map(j => cv[j] * cd + (e1[j] * Math.cos(t) + e2[j] * Math.sin(t)) * sd)); } return p; };
    const rim = ring(13 * D), [dx, dy] = [C + R * cv[0], C - R * cv[1]];
    s += `<defs><radialGradient id="bowl${id}" cx="${dx + 3}" cy="${dy + 3}" r="11" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#aab2bd"/><stop offset=".7" stop-color="#6c7480"/><stop offset="1" stop-color="#3a414c"/></radialGradient></defs>`;
    s += `<polygon points="${rim.map(scr).join(" ")}" fill="url(#bowl${id})" stroke="#12161d" stroke-width=".7"/>`;
    [9, 5.5].forEach(a => s += `<polyline points="${ring(a * D).map(scr).join(" ")}" fill="none" stroke="#2c323c" stroke-opacity=".7" stroke-width=".3"/>`);
    for (let i = 0; i < 8; i++) { const p = rim[i * 6]; s += `<line x1="${(C + R * p[0]).toFixed(2)}" y1="${(C - R * p[1]).toFixed(2)}" x2="${dx.toFixed(2)}" y2="${dy.toFixed(2)}" stroke="#2c323c" stroke-opacity=".6" stroke-width=".25"/>`; }
    s += `<circle cx="${dx.toFixed(2)}" cy="${dy.toFixed(2)}" r="1.5" fill="#1a1f27" stroke="#8e97a3" stroke-width=".3"/>`;
    s += `<circle cx="${(dx + .4).toFixed(2)}" cy="${(dy + .4).toFixed(2)}" r=".45" fill="#cfe0f0" opacity=".7"/>`;
    s += `</g><circle cx="50" cy="50" r="${R}" fill="url(#limb${id})"/><circle cx="50" cy="50" r="${R}" fill="url(#spec${id})"/>`;
    // Night side: shadow shaped by the real moon phase (same math as the moon drawing in app.js)
    const rx = R * Math.abs(1 - 2 * lit), side = waxing ? 1 : 0, sweep = lit > .5 ? side : 1 - side;
    s += `<defs><mask id="m${id}"><circle cx="50" cy="50" r="${R + 1}" fill="#fff"/><path d="M50 ${C - R} A${R} ${R} 0 0 ${side} 50 ${C + R} A${rx} ${R} 0 0 ${sweep} 50 ${C - R}Z" fill="#000"/></mask></defs>`;
    if (lit < 0.995) s += `<circle cx="50" cy="50" r="${R + .5}" fill="#03050a" fill-opacity=".86" mask="url(#m${id})" filter="url(#soft${id})"/>`;
    // Station lights: tiny warm points, visible mostly on the dark side
    lights.filter(v => v[2] > .2).forEach(v => s += `<circle cx="${(C + R * v[0]).toFixed(2)}" cy="${(C - R * v[1]).toFixed(2)}" r=".32" fill="#ffd9a0" opacity=".75" filter="url(#glow${id})"/>`);
    s += `<circle cx="50" cy="50" r="${R}" fill="none" stroke="#9fb6e0" stroke-opacity=".12" stroke-width=".6"/>`;
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.innerHTML = s;
  }

  let run = null;
  function stopIntro() {
    if (!run) return;
    run.stop(); run = null;
    const pic = document.getElementById("holPic");
    if (pic) pic.classList.remove(...Object.values(PIC_CLASS));
    const svg = document.querySelector(".hol-july4 #holPic svg");
    if (svg) drawFlag(svg, 0.55, 6 * 0.55);   // the flag holds its resting wave
  }
  function playIntro(theme) {
    stopIntro();
    const fn = INTROS[theme.intro], dur = fn && fn.dur || DUR;
    if (!fn) return;
    const pic = document.getElementById("holPic");
    if (pic && PIC_CLASS[theme.intro]) { pic.classList.remove(PIC_CLASS[theme.intro]); void pic.offsetWidth; pic.classList.add(PIC_CLASS[theme.intro]); }
    ["snowflake", "bat", "maple-rust", "maple-amber", "oak-gold", "confetti"].forEach(sprite);   // start loading
    const cv = document.createElement("canvas");
    cv.id = "holIntro";
    Object.assign(cv.style, {position: "fixed", left: "0", top: "0", width: "100vw", height: "100vh", pointerEvents: "none", zIndex: "1500"});
    document.body.appendChild(cv);
    const w = cv.width = innerWidth, h = cv.height = innerHeight, g = cv.getContext("2d"), st = {}, t0 = performance.now();
    let frame = 0, id = 0;
    function tick(now) {
      const t = (now - t0) / 1000;
      if (t >= dur) return stopIntro();
      id = requestAnimationFrame(tick);
      if (frame++ % 2) return;   // about 30 frames a second is plenty and easier on a TV
      g.clearRect(0, 0, w, h);
      g.globalAlpha = Math.min(1, dur - t);   // fade out over the last second
      fn(g, w, h, t, st);
      g.globalAlpha = 1;
    }
    run = {stop() { cancelAnimationFrame(id); cv.remove(); }};
    id = requestAnimationFrame(tick);
  }

  // A holiday character walks along the bottom of the screen once (Thanksgiving: the cartoon turkey), from a random side;
  // holiday.js decides when. The body is one picture with its legs cut off (sprite-<name>-body); the legs are drawn here
  // and really step: each foot plants and slides back while the other lifts in an arc and swings forward, toes curling.
  // The step rate is matched to the walking speed so a planted foot doesn't skate. Positions are in the picture's own
  // 784-pixel units; the picture faces right and is mirrored when walking left.
  const LEGS = {
    turkey: {hips: [[300, 572], [505, 566]], ground: 702, stride: 120, stance: 0.6, thigh: 70, shin: 72, rise: 12, knee: 1,
      fill: ["#d9861a", "#f6a523"], line: "#3a1d07"},   // far leg a shade darker
    // Santa: red trousers and black boots under the coat hem; the knee bends forward
    santa: {size: 0.22, dur: 20, bob: 5, hips: [[372, 548], [446, 548]], ground: 740, stride: 190, stance: 0.58, thigh: 100, shin: 100, rise: 34, knee: -1, boot: true,
      fill: ["#b5121a", "#e0212a"], line: "#6b0c12"}
  };
  function drawLeg(g, L, hx, hy, p, k) {
    const half = L.stride / 2;
    let fx, fy, curl, ang = 0;
    if (p < L.stance) { const q = p / L.stance; fx = hx + half - q * L.stride; fy = L.ground; curl = 0; ang = -0.2 * Math.max(0, 1 - q / 0.25) + 0.4 * Math.max(0, (q - 0.75) / 0.25); }   // planted, sliding back, heel lifting at the end
    else { const q = (p - L.stance) / (1 - L.stance); fx = hx - half + q * L.stride; fy = L.ground - Math.sin(q * Math.PI) * 42; curl = Math.sin(q * Math.PI); ang = 0.4 - 0.6 * Math.sin(q * Math.PI / 2); }   // lifted, swinging forward, toe coming up
    const ax = fx, ay = fy - L.rise, dx = ax - hx, dy = ay - hy, d = Math.min(L.thigh + L.shin - 1, Math.hypot(dx, dy));
    const bend = Math.acos((L.thigh * L.thigh + d * d - L.shin * L.shin) / (2 * L.thigh * d)), a = Math.atan2(dy, dx) + L.knee * bend;
    const kx = hx + Math.cos(a) * L.thigh, ky = hy + Math.sin(a) * L.thigh;
    g.lineCap = g.lineJoin = "round";
    if (L.boot) {
      for (const [extra, c] of [[7, L.line], [0, L.fill[k]]]) {   // dark outline first, then the red on top
        g.strokeStyle = c;
        g.lineWidth = 84 + extra; g.beginPath(); g.moveTo(hx, hy); g.lineTo(kx, ky); g.stroke();
        g.lineWidth = 64 + extra; g.beginPath(); g.moveTo(kx, ky); g.lineTo(ax, ay - 8); g.stroke();
      }
      g.save(); g.translate(ax, ay); g.rotate(ang);   // the boot: a tall shaft and a long toe, turning about the ankle
      g.beginPath(); g.moveTo(-33, -50); g.lineTo(33, -50); g.lineTo(35, 0); g.quadraticCurveTo(104, 2, 100, 30);
      g.quadraticCurveTo(99, 36, 90, 36); g.lineTo(-38, 36); g.quadraticCurveTo(-50, 20, -36, -6); g.closePath();
      g.fillStyle = k ? "#2d2e34" : "#1f2024"; g.fill(); g.strokeStyle = "#0b0b0d"; g.lineWidth = 3.5; g.stroke();
      g.beginPath(); g.moveTo(-36, 28); g.lineTo(92, 28); g.strokeStyle = "rgba(255,255,255,.14)"; g.lineWidth = 3; g.stroke();   // the sole
      g.restore();
      return;
    }
    const toe = (ang, len) => [ax + Math.cos(ang) * len, ay + Math.sin(ang) * len];
    const down = 0.15 + curl * 0.9, toes = [toe(down - 0.26, 60), toe(down + 0.14, 68), toe(Math.PI - 0.35 - curl * 0.4, 28)];
    for (const [w, c] of [[46, L.line], [33, L.fill[k]]]) {   // dark outline first, then the orange on top: chunky cartoon legs
      g.strokeStyle = c; g.lineWidth = w;
      g.beginPath(); g.moveTo(hx, hy); g.lineTo(kx, ky); g.lineTo(ax, ay); g.stroke();
      g.lineWidth = w * 0.62;
      for (const [tx, ty] of toes) { g.beginPath(); g.moveTo(ax, ay); g.lineTo(tx, ty); g.stroke(); }
    }
  }
  function walkAcross(name) {
    if (document.getElementById("holWalk")) return;   // one at a time
    const L = LEGS[name], body = new Image(); body.src = `img/holiday/sprite-${name}-body.webp`;
    const dir = Math.random() < 0.5 ? 1 : -1, size = Math.round(innerHeight * (L.size || 0.18)), dur = L.dur || 24, dpr = devicePixelRatio || 1;
    const cv = document.createElement("canvas"), g = cv.getContext("2d");
    cv.id = "holWalk"; cv.width = cv.height = Math.round(size * dpr);
    Object.assign(cv.style, {position: "fixed", left: "0", bottom: "0.4vh", width: size + "px", height: size + "px", pointerEvents: "none", zIndex: "1400"});
    document.body.appendChild(cv);
    const travel = innerWidth + size, from = dir > 0 ? -size : innerWidth;
    const cycle = L.stride * (size / 784) * dur / (L.stance * travel);   // seconds per step cycle that keeps planted feet still
    let t0 = null, id = 0, frame = 0;
    function tick(now) {
      if (t0 === null) t0 = now;
      const t = (now - t0) / 1000;
      if (t >= dur) { cv.remove(); return; }
      id = requestAnimationFrame(tick);
      if (frame++ % 2) return;   // about 30 frames a second, like the other animations
      cv.style.transform = `translateX(${(from + dir * travel * t / dur).toFixed(1)}px)`;
      if (!body.complete || !body.naturalWidth) return;   // picture still loading
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height);
      const s = cv.width / 784;
      g.setTransform(dir * s, 0, 0, s, dir > 0 ? 0 : cv.width, 0);   // mirrored when walking left
      // Body lowest just after each foot lands (feet land at p = 0 and 0.5) and highest as the free leg swings past (0.3, 0.8)
      const p = t / cycle, bob = -(L.bob || 7) * Math.cos((p - 0.3) * 4 * Math.PI);
      drawLeg(g, L, L.hips[0][0], L.hips[0][1] + bob, (p + 0.5) % 1, 0);
      drawLeg(g, L, L.hips[1][0], L.hips[1][1] + bob, p % 1, 1);
      g.drawImage(body, 0, bob, 784, 784);   // the body on top hides the tops of the legs
    }
    body.onerror = () => { cancelAnimationFrame(id); cv.remove(); };
    id = requestAnimationFrame(tick);
  }

  // Santa's sleigh: one picture (the reindeer face left) that flies across the header strip, rising and dipping and rocking a little, with sparkles falling behind it.
  function flyAcross() {
    if (document.getElementById("holFly")) return;
    const img = new Image(); img.src = "img/holiday/sprite-sleigh.webp";
    const dir = Math.random() < 0.5 ? 1 : -1, dur = 11, dpr = devicePixelRatio || 1;
    const W = innerWidth, H = Math.round(innerHeight * 0.14), sw = Math.round(innerHeight * 0.36);   // small enough to stay in the header strip
    const cv = document.createElement("canvas"), g = cv.getContext("2d");
    cv.id = "holFly"; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    Object.assign(cv.style, {position: "fixed", left: "0", top: "0", width: W + "px", height: H + "px", pointerEvents: "none", zIndex: "1400"});
    document.body.appendChild(cv);
    const stars = []; let t0 = null, id = 0, frame = 0;
    function tick(now) {
      if (t0 === null) t0 = now;
      const t = (now - t0) / 1000;
      if (t >= dur) { cv.remove(); return; }
      id = requestAnimationFrame(tick);
      if (frame++ % 2) return;
      if (!img.complete || !img.naturalWidth) return;
      const sh = sw * img.naturalHeight / img.naturalWidth, u = t / dur;
      const x = dir > 0 ? -sw + (W + sw) * u : W - (W + sw) * u;
      const y = (H - sh) / 2 + Math.sin(u * 2 * Math.PI * 1.5) * H * 0.05 + Math.sin(t * 7) * 1.5;   // slow swoops plus a quick flutter
      const tilt = Math.cos(u * 2 * Math.PI * 1.5) * 0.05 * dir + Math.sin(t * 7) * 0.012;      // nose up while rising
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
      if (Math.random() < 0.8) stars.push({x: x + (dir > 0 ? 0.1 : 0.9) * sw, y: y + sh * (0.3 + Math.random() * 0.5), vy: 4 + Math.random() * 10, life: 1, r: 2 + Math.random() * 3});
      for (let i = stars.length - 1; i >= 0; i--) {
        const s = stars[i]; s.life -= 0.02; s.y += s.vy / 30;
        if (s.life <= 0) { stars.splice(i, 1); continue; }
        g.globalAlpha = s.life; g.fillStyle = "#fff6b0"; g.beginPath(); g.arc(s.x, s.y, s.r * s.life + 0.5, 0, 7); g.fill();
      }
      g.globalAlpha = 1;
      g.translate(x + sw / 2, y + sh / 2); g.rotate(tilt); g.scale(-dir, 1);   // the picture faces left, so mirror it to fly right
      g.drawImage(img, -sw / 2, -sh / 2, sw, sh);
    }
    img.onerror = () => { cancelAnimationFrame(id); cv.remove(); };
    id = requestAnimationFrame(tick);
  }

  window.ART = {
    INTROS, playIntro, stopIntro, walkAcross, flyAcross,
    drawFlag,
    drawDeathStar
  };
})();
