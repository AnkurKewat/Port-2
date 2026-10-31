/* =====================================================================
   CORE HELPERS (load before stats.js / experience.js / tail-pipe.js / connect.js)
   - PIPE: ONE shared, smoothed "pipe head" position for the whole page. Every section that draws the
     scroll pipe reads the same value, so the pipe can never lag behind or leave a gap at a section border.
   - GEO: cached page positions of elements, so the animation loops do not force a layout every frame.
   - PERF: if the page runs below ~35 fps it switches itself to "lite" mode (lower resolution, fewer
     particles, no dot field, no card shadows) and tells the sections via the "perf:lite" event.
   ===================================================================== */
(() => {
  /* ---------- shared pipe head ---------- */
  const FRAC = .94, K = 8;          // the pipe head sits at 94% of the screen height; K = how softly it follows the scroll
  let y = null, t = -1;
  window.PIPE = {
    frac: FRAC,
    get(now, reduce) {              // document-space y of the pipe head; same value for every caller within one frame
      const target = scrollY + innerHeight * FRAC;
      if (y === null) { y = target; t = now; return y; }
      if (now !== t) { const dt = Math.min((now - t) / 1000, .05); t = now; y += (target - y) * (1 - Math.exp(-dt * (reduce ? 60 : K))); }
      return y;
    }
  };

  /* ---------- cached geometry ---------- */
  const list = [];
  const measure = g => { const r = g.el.getBoundingClientRect(); g.doc = r.top + scrollY; g.h = r.height; g.w = r.width; };
  window.GEO = {
    of(el) { const g = { el, doc: 0, h: 0, w: 0, get top() { return this.doc - scrollY; }, get bottom() { return this.doc - scrollY + this.h; } }; list.push(g); measure(g); return g; },
    refresh() { list.forEach(measure); }
  };
  let pending = 0;
  const later = () => { if (!pending) pending = requestAnimationFrame(() => { pending = 0; GEO.refresh(); }); };
  if (window.ResizeObserver) new ResizeObserver(later).observe(document.documentElement);
  addEventListener("resize", later); addEventListener("load", later);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(later);
  document.addEventListener("intro:reveal", () => setTimeout(later, 100));

  /* ---------- automatic lite mode ---------- */
  window.PERF = { lite: false };
  function watch() {
    let last = 0, n = 0, acc = 0, bad = 0;
    (function tick(now) {
      if (PERF.lite) return;
      if (last && !document.hidden) { const d = now - last; if (d < 200) { acc += d; n++; } }
      last = now;
      if (n >= 90) {
        bad = acc / n > 28 ? bad + 1 : 0; acc = n = 0;
        if (bad >= 2) { PERF.lite = true; document.documentElement.classList.add("lite"); document.dispatchEvent(new Event("perf:lite")); return; }
      }
      requestAnimationFrame(tick);
    })(performance.now());
  }
  if (document.body.classList.contains("intro")) document.addEventListener("intro:reveal", () => setTimeout(watch, 2500), { once: true }); else setTimeout(watch, 3000);
})();
