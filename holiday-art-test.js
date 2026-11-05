// TEST: drawings and startup animations for the holiday themes on tv-test.html.
// A startup animation runs on one see-through canvas over the whole screen for at most 8 seconds, fades out in the
// last second, then the canvas is removed and nothing keeps running.
(function () {
  const DUR = 8;
  const rnd = (a, b) => a + Math.random() * (b - a);

  // Sprite pictures made for the animations; an effect draws a simple shape instead until (or unless) one loads
  const SPR = {};
  function sprite(name) {
    if (!SPR[name]) { const i = new Image(); i.src = `img/holiday/sprite-${name}.webp`; SPR[name] = i; }
    const i = SPR[name];
    return i.complete && i.naturalWidth ? i : null;
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
      st.f = st.f || Array.from({length: 45}, () => ({x: rnd(0, w), y: rnd(-0.7 * h, 0), s: rnd(16, 40) * u, v: rnd(0.07, 0.13) * h,
        sw: rnd(10, 30) * u, fq: rnd(0.4, 0.9), ph: rnd(0, 6.3), r: rnd(-0.4, 0.4)}));
      const img = sprite("snowflake");
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
      if (img) for (const k of st.c) drawSprite(g, img, k.x, k.y + k.v * t, k.s, k.r + t * 0.3, 0.9);
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
      st.l = st.l || Array.from({length: 20}, (_, i) => ({n: names[i % 3], x: rnd(0, w), y: rnd(-0.8 * h, -0.05 * h), s: rnd(40, 75) * u, v: rnd(0.1, 0.16) * h,
        sw: rnd(30, 70) * u, fq: rnd(0.5, 1), ph: rnd(0, 6.3), flip: rnd(1.2, 2.4), spin: rnd(-0.6, 0.6)}));
      for (const l of st.l) {
        const img = sprite(l.n), x = l.x + Math.sin(t * l.fq + l.ph) * l.sw, y = l.y + l.v * t;
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

  window.ART = {
    INTROS, playIntro, stopIntro,
    drawFlag,
    // The Death Star for May the 4th, lit like tonight's moon (filled in with the full drawing later)
    drawDeathStar(svg) { svg.innerHTML = '<circle cx="50" cy="50" r="40" fill="#8a9099"/>'; }
  };
})();
