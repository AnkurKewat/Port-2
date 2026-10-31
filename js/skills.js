/* =====================================================================
   SKILLS MARQUEE
   - two rows sliding in opposite directions; every 3rd word solid, the rest outlined
   - speed follows your scroll (faster while scrolling, reverses when you scroll up) and the rows lean (skew) with the speed
   - hover a skill: its row slows to a stop, the other words blur away, the letters ripple around the cursor
     and fill with a travelling blue -> cyan -> green gradient, sparks fly off the cursor and a label chip follows it
   Edit the words in index.html (.sk-word, data-tag = the label shown in the chip).
   ===================================================================== */
(() => {
  const sec = document.getElementById("skills");
  if (!sec) return;
  const band = sec.querySelector(".sk-band"), tip = sec.querySelector(".sk-tip"), cv = sec.querySelector(".sk-sparks");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const CFG = {
    speed: 70,       // base sliding speed (px per second)
    boost: 500,      // scroll speed (px/s) that doubles the sliding speed
    maxBoost: 5,     // cap for the scroll boost
    wave: .75        // width of the letter ripple around the cursor (in font sizes)
  };
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const spring = (x = 0) => ({ x, v: 0 });
  function stepSpring(s, target, dt, k = 120, c = 15) { const n = 2, h = dt / n; for (let i = 0; i < n; i++) { s.v += ((target - s.x) * k - s.v * c) * h; s.x += s.v * h; } return s.x; }
  const STOPS = [[109, 139, 255], [0, 216, 255], [39, 240, 176], [156, 255, 122]];   // blue -> cyan -> teal -> green (same family as the pipe)
  const grad = t => { t = clamp(t, 0, 1); const f = t * (STOPS.length - 1), i = Math.min(Math.floor(f), STOPS.length - 2), a = STOPS[i], b = STOPS[i + 1], k = f - i; return a.map((v, j) => Math.round(v + (b[j] - v) * k)); };
  const tri = x => { x = ((x % 2) + 2) % 2; return x > 1 ? 2 - x : x; };

  /* ---------- build the rows ---------- */
  const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 0c.9 6.2 5.8 11.1 12 12-6.2.9-11.1 5.8-12 12-.9-6.2-5.8-11.1-12-12C6.2 11.1 11.1 6.2 12 0z" fill="currentColor"/></svg>';
  const rows = [...sec.querySelectorAll(".sk-row")].map((el, ri) => {
    const track = el.querySelector(".sk-track"), words = [...track.querySelectorAll(".sk-word")];
    const set = document.createElement("div"); set.className = "sk-set";
    words.forEach((w, i) => {
      const text = w.textContent.trim(); w.textContent = ""; w.setAttribute("aria-label", text);
      [...text].forEach(ch => { const l = document.createElement("span"); l.className = "l"; l.setAttribute("aria-hidden", "true"); l.textContent = ch === " " ? "\u00a0" : ch; w.appendChild(l); });
      w.classList.toggle("solid", i % 3 === (ri ? 0 : 1));
      set.appendChild(w);
      const st = document.createElement("i"); st.className = "sk-star"; st.setAttribute("aria-hidden", "true"); st.innerHTML = STAR; set.appendChild(st);
    });
    track.textContent = ""; track.appendChild(set);
    const r = { el, track, set, dir: +el.dataset.dir || -1, x: 0, sp: 1, hover: false, skew: 0, setW: 1 };
    el._r = r; return r;
  });
  function layout() {
    rows.forEach(r => {
      while (r.track.children.length > 1) r.track.lastChild.remove();
      r.setW = r.set.getBoundingClientRect().width; if (r.setW < 10) return;
      const n = Math.ceil(innerWidth / r.setW) + 2;
      for (let i = 1; i < n; i++) { const c = r.set.cloneNode(true); c.setAttribute("aria-hidden", "true"); r.track.appendChild(c); }   // copies make the loop seamless
    });
  }
  layout();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
  new ResizeObserver(layout).observe(band);

  /* ---------- sparks canvas ---------- */
  const ctx = cv.getContext("2d");
  let parts = [], dpr = 1;
  function sizeSparks() { dpr = Math.min(devicePixelRatio || 1, 2); cv.width = band.clientWidth * dpr; cv.height = band.clientHeight * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
  new ResizeObserver(sizeSparks).observe(band); sizeSparks();
  function spark(x, y, now) {
    const c = grad(tri(Math.random() + now / 2600));
    parts.push({ x, y, vx: (Math.random() - .5) * 90, vy: -30 - Math.random() * 70, life: 1, size: 5 + Math.random() * 8, rot: Math.random() * 6, vr: (Math.random() - .5) * 5, c });
    if (parts.length > 120) parts.shift();
  }
  function drawStar(x, y, s, rot) {
    ctx.beginPath();
    for (let k = 0; k < 8; k++) { const r = k % 2 ? s * .32 : s, a = rot + k * Math.PI / 4; ctx[k ? "lineTo" : "moveTo"](x + Math.cos(a) * r, y + Math.sin(a) * r); }
    ctx.closePath(); ctx.fill();
  }

  /* ---------- hover ---------- */
  const active = new Set(), mouse = { x: -999, y: -999, moved: false };
  const tipX = spring(0), tipY = spring(0), tipS = spring(0);
  let cur = null;
  const stateOf = w => w._s || (w._s = { el: w, solid: w.classList.contains("solid"), letters: [...w.querySelectorAll(".l")].map(el => ({ el, f: spring(0), fill: spring(0) })), hot: false, px: null, t0: 0, fs: 60 });
  function enter(w, e) {
    const s = stateOf(w);
    s.hot = true; s.t0 = performance.now(); s.px = e.clientX; s.fs = parseFloat(getComputedStyle(w).fontSize) || 60;
    active.add(s); cur = s; w.classList.add("on"); band.classList.add("has-hover");
    w.closest(".sk-row")._r.hover = true;
    tip.querySelector("b").textContent = w.dataset.tag || w.getAttribute("aria-label");
    mouse.x = e.clientX; mouse.y = e.clientY;
    if (tipS.x < .05) { tipX.x = mouse.x + 18; tipY.x = mouse.y + 22; tipX.v = tipY.v = 0; }
  }
  function leave(w) {
    const s = w._s; if (!s) return;
    s.hot = false; s.px = null; w.classList.remove("on");
    w.closest(".sk-row")._r.hover = false;
    if (cur === s) { cur = null; band.classList.remove("has-hover"); }
  }
  band.addEventListener("pointerover", e => { const w = e.target.closest && e.target.closest(".sk-word"); if (w && band.contains(w)) enter(w, e); });
  band.addEventListener("pointerout", e => { const w = e.target.closest && e.target.closest(".sk-word"); if (w && !w.contains(e.relatedTarget)) leave(w); });
  addEventListener("pointermove", e => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.moved = true; if (cur) cur.px = e.clientX; }, { passive: true });

  /* ---------- loop: only while the section is near the screen ---------- */
  let raf = 0, last = 0, lastY = 0, sv = 0, dirT = 1, dirS = 1;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000 || .016, .05); last = now;

    // sliding: scroll speed boosts it, scrolling up reverses it, hover stops the row
    const y = scrollY; sv += ((y - lastY) / dt - sv) * (1 - Math.exp(-dt * 8)); lastY = y;
    if (Math.abs(sv) > 40) dirT = sv > 0 ? 1 : -1;
    dirS += (dirT - dirS) * (1 - Math.exp(-dt * 3));
    const boost = 1 + Math.min(Math.abs(sv) / CFG.boost, CFG.maxBoost);
    rows.forEach(r => {
      r.sp += ((r.hover ? 0 : 1) - r.sp) * (1 - Math.exp(-dt * 6));
      const v = reduce ? 0 : r.dir * CFG.speed * boost * dirS * r.sp;
      r.x += v * dt;
      if (r.setW > 10) { if (r.x < -r.setW) r.x += r.setW; if (r.x > 0) r.x -= r.setW; }
      r.skew += (clamp(-v * .012, -10, 10) - r.skew) * (1 - Math.exp(-dt * 8));
      r.track.style.transform = "translate3d(" + r.x.toFixed(2) + "px,0,0) skewX(" + r.skew.toFixed(2) + "deg)";
    });

    // letters of hovered / settling words: ripple around the cursor + travelling gradient fill
    active.forEach(s => {
      const rects = s.letters.map(L => L.el.getBoundingClientRect());   // read first, write after (no layout thrash)
      let settled = !s.hot;
      s.letters.forEach((L, i) => {
        const cx = rects[i].left + rects[i].width / 2;
        const tf = s.hot && s.px != null ? Math.exp(-Math.pow((s.px - cx) / (s.fs * CFG.wave), 2)) : 0;
        stepSpring(L.f, tf, dt, 190, 15); stepSpring(L.fill, s.hot && now - s.t0 > i * 35 ? 1 : 0, dt, 120, 16);
        const f = L.f.x, fl = clamp(L.fill.x, 0, 1), [r, g, b] = grad(tri((i / Math.max(s.letters.length - 1, 1)) * .9 + now / 2600));
        const rr = Math.round(255 + (r - 255) * fl), gg = Math.round(255 + (g - 255) * fl), bb = Math.round(255 + (b - 255) * fl);
        L.el.style.transform = "translate3d(0," + (-f * .2).toFixed(3) + "em,0) scale(" + (1 + f * .34).toFixed(3) + ")";
        L.el.style.color = "rgba(" + rr + "," + gg + "," + bb + "," + (s.solid ? 1 : fl.toFixed(3)) + ")";
        if (!s.solid) L.el.style.webkitTextStrokeColor = "rgba(" + rr + "," + gg + "," + bb + "," + (.3 + .7 * fl).toFixed(3) + ")";
        L.el.style.textShadow = "0 0 " + (10 + 22 * fl + 20 * f).toFixed(1) + "px rgba(" + r + "," + g + "," + b + "," + (.55 * fl).toFixed(3) + ")";
        if (Math.abs(L.f.x) > .003 || Math.abs(L.fill.x) > .003 || Math.abs(L.f.v) > .01 || Math.abs(L.fill.v) > .01) settled = false;
      });
      if (settled) { s.letters.forEach(L => { ["transform", "color", "webkitTextStrokeColor", "textShadow"].forEach(p => L.el.style[p] = ""); L.f.x = L.f.v = L.fill.x = L.fill.v = 0; }); active.delete(s); }
    });

    // label chip follows the cursor with a spring
    stepSpring(tipX, mouse.x + 18, dt, 260, 24); stepSpring(tipY, mouse.y + 22, dt, 260, 24); stepSpring(tipS, cur ? 1 : 0, dt, 200, 20);
    tip.style.transform = "translate3d(" + tipX.x.toFixed(1) + "px," + tipY.x.toFixed(1) + "px,0) scale(" + (.6 + .4 * clamp(tipS.x, 0, 1.1)).toFixed(3) + ")";
    tip.style.opacity = clamp(tipS.x, 0, 1);
    if (cur) { const [r, g, b] = grad(tri(now / 2600)); tip.style.setProperty("--c", "rgb(" + r + "," + g + "," + b + ")"); }

    // sparks
    if (cur && mouse.moved) { const br = band.getBoundingClientRect(); for (let k = 0; k < 2; k++) spark(mouse.x - br.left + (Math.random() - .5) * 16, mouse.y - br.top + (Math.random() - .5) * 16, now); }
    mouse.moved = false;
    if (parts.length) {
      ctx.clearRect(0, 0, cv.width / dpr, cv.height / dpr);
      parts = parts.filter(p => (p.life -= dt * 1.4) > 0);
      parts.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 40 * dt; p.rot += p.vr * dt; ctx.fillStyle = "rgba(" + p.c[0] + "," + p.c[1] + "," + p.c[2] + "," + clamp(p.life, 0, 1).toFixed(3) + ")"; drawStar(p.x, p.y, p.size * clamp(p.life, .2, 1), p.rot); });
      if (!parts.length) ctx.clearRect(0, 0, cv.width / dpr, cv.height / dpr);
    }
  }
  new IntersectionObserver(es => {
    if (es[0].isIntersecting) { sec.classList.add("in"); if (!raf) { last = performance.now(); lastY = scrollY; raf = requestAnimationFrame(frame); } }
    else { cancelAnimationFrame(raf); raf = 0; }
  }, { rootMargin: "20% 0px" }).observe(sec);
})();
