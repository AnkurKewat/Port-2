/* =====================================================================
   PIXELISED PROFILE PHOTO
   Idle: the photo is black & white and sharp.
   Hover: a wave of pixel blocks spreads out from the cursor; each block goes
   sharp grey -> grey pixels -> colour pixels -> sharp colour.
   Leave: it pixelates back to clear black & white.
   ===================================================================== */
(() => {
  const CFG = {
    cell: 11,        // size of one pixel block in CSS px (bigger = chunkier)
    speed: 2.4,      // how fast each block changes (higher = quicker)
    wave: 900,       // how fast the colour wave spreads (px per second)
    jitter: 140      // random raggedness of the wave edge (px)
  };
  const img = document.querySelector(".hero-profile-img");
  const card = document.querySelector(".hero-profile-card");
  if (!img || !card) return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const canvas = document.createElement("canvas");
  canvas.className = "hero-profile-px";
  canvas.setAttribute("aria-hidden", "true");
  img.after(canvas);
  const ctx = canvas.getContext("2d");
  const mk = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };

  let W = 0, H = 0, dpr = 1, cs = 1, cols = 0, rows = 0;
  let T = null, N = null, sharp = null, gray = null, pixGray = null, pixColor = null;
  let hover = false, ox = 0, oy = 0, radius = 0, maxR = 0, raf = 0, last = 0;

  function build() {
    if (!img.naturalWidth || !card.clientWidth || !card.clientHeight) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.round(card.clientWidth * dpr); H = Math.round(card.clientHeight * dpr);
    canvas.width = W; canvas.height = H;
    cs = Math.max(2, Math.round(CFG.cell * dpr));
    cols = Math.ceil(W / cs); rows = Math.ceil(H / cs);

    // sharp colour layer: "cover" crop, anchored to the top (like object-position: center top)
    sharp = mk(W, H);
    const sg = sharp.getContext("2d");
    const iw = img.naturalWidth, ih = img.naturalHeight, ca = W / H;
    let sw, sh, sx = 0;
    if (iw / ih > ca) { sh = ih; sw = ih * ca; sx = (iw - sw) / 2; } else { sw = iw; sh = iw / ca; }
    sg.drawImage(img, sx, 0, sw, sh, 0, 0, W, H);
    const srcImg = sg.getImageData(0, 0, W, H), src = srcImg.data;

    // sharp black & white layer (grayscale + contrast 1.1 + brightness .92)
    gray = mk(W, H);
    const gg = gray.getContext("2d"), grd = gg.createImageData(W, H);
    for (let i = 0; i < src.length; i += 4) {
      let v = .299 * src[i] + .587 * src[i + 1] + .114 * src[i + 2];
      v = Math.min(255, Math.max(0, ((v - 128) * 1.1 + 128) * .92));
      grd.data[i] = grd.data[i + 1] = grd.data[i + 2] = v; grd.data[i + 3] = 255;
    }
    gg.putImageData(grd, 0, 0);

    // average colour of every block -> pixelated layers (colour and black & white)
    const tc = mk(cols, rows), tg = mk(cols, rows);
    const cd = tc.getContext("2d").createImageData(cols, rows), gd = tg.getContext("2d").createImageData(cols, rows);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      let R = 0, G = 0, B = 0, n = 0;
      const x1 = Math.min(W, (c + 1) * cs), y1 = Math.min(H, (r + 1) * cs);
      for (let y = r * cs; y < y1; y++) for (let x = c * cs; x < x1; x++) { const i = (y * W + x) * 4; R += src[i]; G += src[i + 1]; B += src[i + 2]; n++; }
      R /= n; G /= n; B /= n;
      const o = (r * cols + c) * 4;
      cd.data[o] = R; cd.data[o + 1] = G; cd.data[o + 2] = B; cd.data[o + 3] = 255;
      let g = .299 * R + .587 * G + .114 * B;                 // same look as the old CSS: grayscale + contrast 1.1 + brightness .92
      g = Math.min(255, Math.max(0, ((g - 128) * 1.1 + 128) * .92));
      gd.data[o] = gd.data[o + 1] = gd.data[o + 2] = g; gd.data[o + 3] = 255;
    }
    tc.getContext("2d").putImageData(cd, 0, 0); tg.getContext("2d").putImageData(gd, 0, 0);
    const up = t => { const c = mk(cols * cs, rows * cs), g = c.getContext("2d"); g.imageSmoothingEnabled = false; g.drawImage(t, 0, 0, cols * cs, rows * cs); return c; };
    pixColor = up(tc); pixGray = up(tg);

    const total = cols * rows;
    T = new Float32Array(total); N = new Float32Array(total);
    for (let i = 0; i < total; i++) { N[i] = Math.random(); T[i] = hover ? 1 : 0; }
    maxR = Math.hypot(W, H) + CFG.jitter * dpr;
    radius = hover ? maxR : 0;
    card.classList.add("px-ready");
    render();
  }

  // stages per block: 0 sharp grey -> 1/3 grey pixels -> 2/3 colour pixels -> 1 sharp colour
  function render() {
    const layers = [gray, pixGray, pixColor, sharp];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const t = T[r * cols + c], x = c * cs, y = r * cs, w = Math.min(cs, W - x), h = Math.min(cs, H - y);
      const f = Math.min(t, .9999) * 3, k = Math.floor(f), a = f - k;
      ctx.globalAlpha = 1; ctx.drawImage(layers[k], x, y, w, h, x, y, w, h);
      if (a > .001) { ctx.globalAlpha = a; ctx.drawImage(layers[k + 1], x, y, w, h, x, y, w, h); }
    }
    ctx.globalAlpha = 1;
  }

  function frame(now) {
    const dt = Math.min((now - last) / 1000 || .016, .05); last = now;
    radius = Math.min(maxR, Math.max(0, radius + (hover ? 1 : -1.4) * CFG.wave * dpr * dt * (reduce ? 50 : 1)));
    let busy = false;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const d = Math.hypot((c + .5) * cs - ox, (r + .5) * cs - oy) + N[i] * CFG.jitter * dpr;
      const target = d < radius ? 1 : 0;
      let t = T[i];
      if (t !== target) {
        t += Math.sign(target - t) * CFG.speed * dt * (reduce ? 50 : 1);
        t = target > T[i] ? Math.min(t, target) : Math.max(t, target);
        T[i] = t; busy = true;
      }
    }
    render();
    raf = busy || (hover ? radius < maxR : radius > 0) ? requestAnimationFrame(frame) : 0;
  }
  function kick() { if (!raf && T) { last = performance.now(); raf = requestAnimationFrame(frame); } }

  const setOrigin = e => { const b = canvas.getBoundingClientRect(); ox = (e.clientX - b.left) / b.width * W; oy = (e.clientY - b.top) / b.height * H; };
  card.addEventListener("pointerenter", e => { setOrigin(e); hover = true; kick(); });
  card.addEventListener("pointerleave", e => { setOrigin(e); hover = false; kick(); });

  new ResizeObserver(() => build()).observe(card);
  if (img.complete && img.naturalWidth) build(); else img.addEventListener("load", build, { once: true });
})();
