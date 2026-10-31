/* =====================================================================
   WAVE BUTTON (left of "Let's talk")
   - a live sine wave that keeps flowing; it speeds up and swells as your cursor gets close
   - hover: a blue blob grows from the exact side your cursor came in from (and retreats towards the side it leaves by);
     the wave gets pinched / lifted right under your cursor
   - click: toggles "sound" on/off (the wave flattens). It fires a "sound:toggle" event so you can hook real audio to it:
       document.addEventListener("sound:toggle", e => console.log(e.detail.on));
   ===================================================================== */
(() => {
  const btn = document.querySelector(".btn-wave");
  if (!btn) return;
  const path = btn.querySelector(".bw-path");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const spring = (x = 0) => ({ x, v: 0 });
  function step(s, target, dt, k = 120, c = 15) { const n = 2, h = dt / n; for (let i = 0; i < n; i++) { s.v += ((target - s.x) * k - s.v * c) * h; s.x += s.v * h; } return s.x; }

  let on = true, hot = false, phase = 0, px = 12, mx = -999, my = -999, rect = null, raf = 0, last = 0;
  const A = spring(3.4), S = spring(2.2), B = spring(0);   // wave height, wave speed, bump under the cursor
  const measure = () => { rect = btn.getBoundingClientRect(); };
  measure(); addEventListener("resize", measure); addEventListener("load", measure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);

  const setXY = e => { const r = btn.getBoundingClientRect(); btn.style.setProperty("--x", (e.clientX - r.left) + "px"); btn.style.setProperty("--y", (e.clientY - r.top) + "px"); };
  btn.addEventListener("pointerenter", e => { setXY(e); hot = true; btn.classList.add("on"); });
  btn.addEventListener("pointerleave", e => { setXY(e); hot = false; btn.classList.remove("on"); });
  btn.addEventListener("pointermove", e => { const r = btn.getBoundingClientRect(); px = (e.clientX - r.left) / r.width * 24; });
  addEventListener("pointermove", e => { mx = e.clientX; my = e.clientY; }, { passive: true });
  btn.addEventListener("click", () => {
    on = !on; btn.setAttribute("aria-pressed", String(on));
    document.dispatchEvent(new CustomEvent("sound:toggle", { detail: { on } }));
  });

  const N = 30, X0 = 3, X1 = 21;
  function draw() {
    let d = "";
    for (let i = 0; i <= N; i++) {
      const t = i / N, x = X0 + (X1 - X0) * t;
      let y = 12 + Math.sin(t * Math.PI * 3.1 + phase) * A.x;
      y -= B.x * Math.exp(-Math.pow((x - px) / 3.4, 2)) * Math.sin(phase * 1.7 + x * .9);   // pinched / lifted under the cursor
      d += (i ? "L" : "M") + x.toFixed(2) + " " + y.toFixed(2);
    }
    path.setAttribute("d", d);
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000 || .016, .033); last = now;
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2, p = clamp(1 - Math.hypot(mx - cx, my - cy) / 150, 0, 1);   // 1 = cursor on it, 0 = far away
    step(A, on ? 3.2 + p * 1.8 + (hot ? .8 : 0) : .5, dt, 140, 14);
    step(S, reduce ? 0 : on ? 2.2 + p * 5 + (hot ? 3 : 0) : .3, dt, 60, 10);
    step(B, hot && on ? 2.4 : 0, dt, 160, 13);
    phase += S.x * dt;
    draw();
  }
  const start = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  document.addEventListener("visibilitychange", () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else start(); });
  if (document.body.classList.contains("intro")) document.addEventListener("intro:reveal", () => { measure(); start(); }, { once: true }); else start();
  draw();
})();
