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
    }
  };

  let run = null;
  function stopIntro() { if (run) { run.stop(); run = null; } }
  function playIntro(theme) {
    stopIntro();
    const fn = INTROS[theme.intro];
    if (!fn) return;
    ["snowflake", "bat", "maple-rust", "maple-amber", "oak-gold", "confetti"].forEach(sprite);   // start loading
    const cv = document.createElement("canvas");
    cv.id = "holIntro";
    Object.assign(cv.style, {position: "fixed", left: "0", top: "0", width: "100vw", height: "100vh", pointerEvents: "none", zIndex: "1500"});
    document.body.appendChild(cv);
    const w = cv.width = innerWidth, h = cv.height = innerHeight, g = cv.getContext("2d"), st = {}, t0 = performance.now();
    let frame = 0, id = 0;
    function tick(now) {
      const t = (now - t0) / 1000;
      if (t >= DUR) return stopIntro();
      id = requestAnimationFrame(tick);
      if (frame++ % 2) return;   // about 30 frames a second is plenty and easier on a TV
      g.clearRect(0, 0, w, h);
      g.globalAlpha = Math.min(1, DUR - t);   // fade out over the last second
      fn(g, w, h, t, st);
      g.globalAlpha = 1;
    }
    run = {stop() { cancelAnimationFrame(id); cv.remove(); }};
    id = requestAnimationFrame(tick);
  }

  window.ART = {
    INTROS, playIntro, stopIntro,
    // The waving flag for the Fourth of July (filled in with the full drawing later)
    drawFlag(svg) { svg.innerHTML = '<rect x="15" y="25" width="70" height="40" fill="#b9524e"/>'; },
    // The Death Star for May the 4th, lit like tonight's moon (filled in with the full drawing later)
    drawDeathStar(svg) { svg.innerHTML = '<circle cx="50" cy="50" r="40" fill="#8a9099"/>'; }
  };
})();
