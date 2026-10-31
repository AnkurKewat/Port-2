/* =====================================================================
   HERO TEXT + BUTTON EFFECTS (Framer-Motion-style springs, no library)
   - "I'm Ankur Kewat": letters rise out of a mask, then float gently; near your cursor they lift, grow, tilt
     and take on the blue -> cyan -> green gradient
   - lead + description: words blur in one after another; the highlighted phrase draws a gradient underline
   - buttons: magnetic pull towards the cursor, spotlight, shine sweep, click ripple, nudging arrow,
     wiggling mail icon and a light that runs around the Contact Me border
   - badge and tech tags spring in
   Plays once the site is revealed (after the intro), or right away if there is no intro.
   ===================================================================== */
(() => {
  const hero = document.getElementById("hero");
  if (!hero) return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const spring = (x = 0) => ({ x, v: 0 });
  function stepSpring(s, target, dt, k = 120, c = 15) { const n = 2, h = dt / n; for (let i = 0; i < n; i++) { s.v += ((target - s.x) * k - s.v * c) * h; s.x += s.v * h; } return s.x; }
  const STOPS = [[109, 139, 255], [0, 216, 255], [39, 240, 176]];
  const grad = t => { t = clamp(t, 0, 1); const f = t * (STOPS.length - 1), i = Math.min(Math.floor(f), STOPS.length - 2), a = STOPS[i], b = STOPS[i + 1], k = f - i; return a.map((v, j) => v + (b[j] - v) * k); };
  const tri = x => { x = ((x % 2) + 2) % 2; return x > 1 ? 2 - x : x; };

  const badge = hero.querySelector(".hero-badge"), title = hero.querySelector(".hero-title"), lead = hero.querySelector(".hero-lead"), desc = hero.querySelector(".hero-desc");
  const btnEls = [...hero.querySelectorAll(".hero-actions a")], tagEls = [...hero.querySelectorAll(".hero-tag")];

  /* ---------- title: words > letters ---------- */
  const letters = [];
  if (title) {
    const text = title.textContent.trim(); title.textContent = ""; title.setAttribute("aria-label", text);
    text.split(" ").forEach((w, wi, arr) => {
      const ws = document.createElement("span"); ws.className = "w"; ws.setAttribute("aria-hidden", "true");
      [...w].forEach(ch => { const s = document.createElement("span"); s.className = "ch"; s.textContent = ch; ws.appendChild(s); letters.push({ el: s, p: spring(0), f: spring(0), delay: .15 + letters.length * .05, col: "" }); });
      title.appendChild(ws); if (wi < arr.length - 1) title.appendChild(document.createTextNode(" "));
    });
  }
  /* ---------- lead / description: words (keeps <strong> and the status dot) ---------- */
  function splitWords(root, start, step) {
    const out = [], nodes = [], walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(n => {
      if (!n.textContent.trim()) return;
      const frag = document.createDocumentFragment();
      n.textContent.split(/(\s+)/).forEach(part => {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(" ")); return; }
        const s = document.createElement("span"); s.className = "fx-w"; s.textContent = part; frag.appendChild(s);
        out.push({ el: s, p: spring(0), delay: start + out.length * step });
      });
      n.parentNode.replaceChild(frag, n);
    });
    return out;
  }
  const leadW = lead ? splitWords(lead, .6, .035) : [], descW = desc ? splitWords(desc, .6 + (leadW.length * .035) * .6 + .2, .02) : [];
  const badgeS = { el: badge, p: spring(0), delay: 0 };
  const tagS = tagEls.map((el, i) => ({ el, p: spring(0), delay: 1.7 + i * .07 }));

  /* ---------- buttons ---------- */
  const btns = btnEls.map((el, i) => {
    el.insertAdjacentHTML("afterbegin", '<i class="fx-glow"></i>' + (el.classList.contains("hero-btn-primary") ? '<i class="fx-shine"></i>' : ""));
    const b = { el, label: el.querySelector("span"), i, p: spring(0), hov: spring(0), x: spring(0), y: spring(0), tx: 0, ty: 0, hot: false, press: false, delay: 1.35 + i * .14 };
    el.addEventListener("pointerenter", () => { b.hot = true; });
    el.addEventListener("pointerleave", () => { b.hot = false; b.press = false; });
    el.addEventListener("pointermove", e => { const r = el.getBoundingClientRect(); el.style.setProperty("--bx", (e.clientX - r.left) + "px"); el.style.setProperty("--by", (e.clientY - r.top) + "px"); });
    el.addEventListener("pointerdown", e => { b.press = true; const r = el.getBoundingClientRect(), d = document.createElement("i"); d.className = "fx-rip"; d.style.left = (e.clientX - r.left) + "px"; d.style.top = (e.clientY - r.top) + "px"; el.appendChild(d); setTimeout(() => d.remove(), 720); });
    addEventListener("pointerup", () => { b.press = false; });
    return b;
  });

  /* ---------- state ---------- */
  const mouse = { x: -9999, y: -9999 };
  addEventListener("pointermove", e => { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });
  let started = false, t0 = 0, raf = 0, last = 0;
  const start = () => { if (started) return; started = true; t0 = performance.now(); hero.classList.add("fx-in"); };
  if (document.body.classList.contains("intro")) document.addEventListener("intro:reveal", () => setTimeout(start, 350), { once: true }); else setTimeout(start, 150);

  const drive = (s, delay, el, dt, k = 110, c = 14) => { const tgt = started && el > delay ? 1 : 0; if (reduce) { s.x = tgt; s.v = 0; } else stepSpring(s, tgt, dt, k, c); return s.x; };

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000 || .016, .033); last = now;
    const el = (now - t0) / 1000, hr = hero.getBoundingClientRect(), inside = mouse.x >= hr.left && mouse.x <= hr.right && mouse.y >= hr.top && mouse.y <= hr.bottom;

    // badge
    { const p = clamp(drive(badgeS.p, badgeS.delay, el, dt), 0, 1.1); if (badge) { badge.style.opacity = clamp(p, 0, 1); badge.style.transform = "translate3d(0," + ((1 - p) * 14).toFixed(1) + "px,0)"; } }

    // title letters (read all rects first, then write)
    const rects = started && inside ? letters.map(l => l.el.getBoundingClientRect()) : null;   // only measure while the cursor is over the hero
    letters.forEach((l, i) => {
      const p = drive(l.p, l.delay, el, dt, 95, 13), pc = clamp(p, 0, 1.15);
      const cx = rects ? rects[i].left + rects[i].width / 2 : 0, cy = rects ? rects[i].top + rects[i].height / 2 : 0;
      const f = rects && pc > .95 ? Math.exp(-Math.pow(Math.hypot(mouse.x - cx, (mouse.y - cy) * 1.3) / 130, 2)) : 0;
      stepSpring(l.f, f, dt, 170, 15);
      const fv = l.f.x, bob = pc > .95 && !reduce ? Math.sin(now / 900 + i * .6) * 1.3 : 0, dir = (mouse.x - cx) > 0 ? -1 : 1;
      l.el.style.transform = "translate3d(0," + ((1 - pc) * 110).toFixed(1) + "%,0) translateY(" + (bob - fv * 10).toFixed(2) + "px) scale(" + (1 + fv * .22).toFixed(3) + ") rotate(" + (fv * 4 * dir).toFixed(2) + "deg)";
      let col = "";
      if (fv > .04) { const g = grad(tri(i / Math.max(letters.length - 1, 1) * .9 + now / 2600)), m = clamp(fv * 1.2, 0, 1); col = "rgb(" + Math.round(255 + (g[0] - 255) * m) + "," + Math.round(255 + (g[1] - 255) * m) + "," + Math.round(255 + (g[2] - 255) * m) + ")"; }
      if (col !== l.col) { l.col = col; l.el.style.color = col; }
    });

    // lead + description words
    [leadW, descW].forEach(list => list.forEach(w => {
      if (w.done) return;
      const p = clamp(drive(w.p, w.delay, el, dt, 90, 15), 0, 1);
      if (started && p >= .999 && Math.abs(w.p.v) < .002) { w.done = true; w.el.style.opacity = ""; w.el.style.transform = ""; w.el.style.filter = ""; return; }   // settled: stop touching it
      w.el.style.opacity = p; w.el.style.transform = "translate3d(0," + ((1 - p) * 16).toFixed(1) + "px,0)"; w.el.style.filter = p < .999 ? "blur(" + ((1 - p) * 8).toFixed(1) + "px)" : "none";
    }));

    // buttons: magnetic spring + hover/press scale
    btns.forEach(b => {
      const p = clamp(drive(b.p, b.delay, el, dt, 100, 13), 0, 1.15), r = started && (inside || Math.abs(b.x.x) > .05 || Math.abs(b.y.x) > .05) ? b.el.getBoundingClientRect() : null;
      const dx = r ? mouse.x - (r.left + r.width / 2) : 0, dy = r ? mouse.y - (r.top + r.height / 2) : 0;
      const near = !!r && inside && Math.abs(dx) < r.width / 2 + 70 && Math.abs(dy) < r.height / 2 + 70;
      stepSpring(b.x, near ? dx * .22 : 0, dt, 170, 15); stepSpring(b.y, near ? dy * .32 : 0, dt, 170, 15);
      stepSpring(b.hov, b.hot ? 1 : 0, dt, 220, 20);
      b.el.style.opacity = clamp(p, 0, 1);
      b.el.style.transform = "translate3d(" + b.x.x.toFixed(2) + "px," + (b.y.x + (1 - p) * 30).toFixed(2) + "px,0) scale(" + ((.9 + .1 * p) * (1 + b.hov.x * .05) * (b.press ? .96 : 1)).toFixed(4) + ")";
      if (b.label) b.label.style.transform = "translate3d(" + (b.x.x * .35).toFixed(2) + "px," + (b.y.x * .35).toFixed(2) + "px,0)";   // label moves a bit more than the button
    });

    // tags
    tagS.forEach(t => { const p = clamp(drive(t.p, t.delay, el, dt, 120, 12), 0, 1.15); t.el.style.opacity = clamp(p, 0, 1); t.el.style.transform = "translate3d(0," + ((1 - p) * 12).toFixed(1) + "px,0) scale(" + (.7 + .3 * p).toFixed(3) + ")"; });
  }
  new IntersectionObserver(es => { if (es[0].isIntersecting) { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } } else { cancelAnimationFrame(raf); raf = 0; } }, { rootMargin: "20% 0px" }).observe(hero);
})();
