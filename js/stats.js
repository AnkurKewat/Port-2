/* =====================================================================
   STATS CARDS + CONTINUING BLUE PIPE  (Three.js r128)
   A tall section with a pinned stage. As you scroll down:
   - the four cards spring in one after another (Framer-Motion style: spring physics,
     stagger, blur-in, count-up, letter rise) and react to the cursor (3D tilt + spotlight)
   - the blue pipe from the Bold section keeps coming down, entering from the right
     and weaving behind the cards, then leaves through the right edge of the screen
   Everything is scroll-linked, so scrolling up plays it all in reverse.
   Needs: #stats > .stats-stage > canvas + .stats-grid > .stat-card
   ===================================================================== */
(() => {
  const CFG = {
    pipeRadius: 0.15,                       // thickness of the pipe (same as the Bold section)
    // pipe colours: see STOPS below (blue, then slowly turning cyan after the "Projects Shipped" card)
    smooth: 9,                              // how softly the pipe follows your scroll
    tilt: 12                                // card tilt in degrees when you hover
  };
  const sec = document.getElementById("stats");
  if (!sec || !window.THREE) return;
  const stage = sec.querySelector(".stats-stage"), canvas = stage.querySelector("canvas");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x)), lerp = (a, b, t) => a + (b - a) * t;
  const sm = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }, seg = (p, a, b) => clamp((p - a) / (b - a), 0, 1);

  /* ---------- tiny spring engine (what makes it feel like Framer Motion) ---------- */
  const spring = (x = 0) => ({ x, v: 0 });
  function stepSpring(s, target, dt, k = 120, c = 15) {
    const n = 2, h = dt / n;
    for (let i = 0; i < n; i++) { s.v += ((target - s.x) * k - s.v * c) * h; s.x += s.v * h; }
    return s.x;
  }

  /* ---------- cards ---------- */
  const items = [...sec.querySelectorAll(".stat-card")].map((el, i) => {
    const inner = el.querySelector(".stat-in"), num = el.querySelector("[data-count]"), split = el.querySelector("[data-split]");
    let chars = [];
    if (split) {
      const t = split.textContent; split.textContent = ""; split.setAttribute("aria-label", t);
      chars = [...t].map(ch => { const s = document.createElement("span"); s.className = "ch"; s.setAttribute("aria-hidden", "true"); s.textContent = ch === " " ? "\u00a0" : ch; split.appendChild(s); return s; });
    }
    const it = { el, inner, num, count: num ? +num.dataset.count : 0, chars, i, rev: spring(0), hov: spring(0), rx: spring(0), ry: spring(0), tx: 0, ty: 0, hot: false };
    el.addEventListener("pointerenter", () => { it.hot = true; el.classList.add("hot"); });
    el.addEventListener("pointermove", e => {
      const b = el.getBoundingClientRect(), nx = (e.clientX - b.left) / b.width, ny = (e.clientY - b.top) / b.height;
      it.ty = (nx - .5) * CFG.tilt * 2; it.tx = -(ny - .5) * CFG.tilt * 2;
      el.style.setProperty("--mx", nx * 100 + "%"); el.style.setProperty("--my", ny * 100 + "%");
    });
    el.addEventListener("pointerleave", () => { it.hot = false; it.tx = it.ty = 0; el.classList.remove("hot"); });
    return it;
  });

  function applyCards(u, dt, snap) {
    items.forEach(it => {
      const a = .19 + it.i * .05, target = sm(seg(u, a, a + .15));
      if (reduce || snap) { it.rev.x = target; it.rev.v = 0; } else stepSpring(it.rev, target, dt, 110, 13);   // bouncy entrance
      stepSpring(it.hov, it.hot ? 1 : 0, dt, 220, 20);
      stepSpring(it.rx, it.tx, dt, 140, 16); stepSpring(it.ry, it.ty, dt, 140, 16);
      const s = it.rev.x, op = clamp(s, 0, 1);
      it.el.style.opacity = op;
      it.el.style.transform = "perspective(1100px) translate3d(0," + ((1 - s) * 90).toFixed(2) + "px,0) rotateX(" + ((1 - s) * 20 + it.rx.x).toFixed(2) + "deg) rotateY(" + it.ry.x.toFixed(2) + "deg) scale(" + (.9 + .1 * s + it.hov.x * .03).toFixed(4) + ")";
      it.inner.style.filter = op < .999 ? "blur(" + ((1 - op) * 10).toFixed(2) + "px)" : "none";
      if (it.num) it.num.textContent = Math.round(it.count * sm(seg(op, .1, 1)));
      it.chars.forEach((c, k) => { const p = clamp(op * 1.7 - k * .06, 0, 1); c.style.opacity = p; c.style.transform = "translate3d(0," + ((1 - p) * 70).toFixed(1) + "%,0) rotate(" + ((1 - p) * 8).toFixed(1) + "deg)"; });
    });
  }
  applyCards(0, .016, true);

  /* ---------- scene ---------- */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
  document.addEventListener("perf:lite", () => { renderer.setPixelRatio(1); resize(); }, { once: true });
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, .1, 100), HALF_H = 3;
  cam.position.set(0, 0, HALF_H / Math.tan(THREE.MathUtils.degToRad(15)));
  scene.add(new THREE.AmbientLight(0xffffff, .55));
  const sun = new THREE.DirectionalLight(0xffffff, .6); sun.position.set(-3, 4, 6); scene.add(sun);

  /* ---------- the pipe: enters from the right, weaves behind the cards, leaves through the right edge ---------- */
  const SEGS = 720, RAD = 20, STEP = RAD * 6;
  const STOPS = [[0, "#6d8bff"], [.3, "#2a2dff"], [.46, "#2a2dff"], [.62, "#1aa0ff"], [.8, "#00c0f0"], [1, "#00d0d8"]].map(([t, c]) => [t, new THREE.Color(c)]);
  const pipeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .3, metalness: 0 });
  const capGeo = new THREE.SphereGeometry(CFG.pipeRadius, 24, 18);
  const capA = new THREE.Mesh(capGeo, new THREE.MeshStandardMaterial({ roughness: .3 })), capB = new THREE.Mesh(capGeo, new THREE.MeshStandardMaterial({ roughness: .3 }));
  capA.frustumCulled = capB.frustumCulled = false; scene.add(capA, capB);
  /* The route is built from the real card positions (px, y down): in from the top right, across the top,
     down behind the cards on the left, across the bottom, up the gap on the right of the
     "Pixel Perfect" card and out through the right edge of the screen, where it ends. */
  function statsPath() {
    const W = stage.clientWidth, H = stage.clientHeight, grid = sec.querySelector(".stats-grid"), cards = sec.querySelectorAll(".stat-card"), last = cards[cards.length - 1];
    const gr = grid.getBoundingClientRect(), sr = stage.getBoundingClientRect(), gl = gr.left - sr.left, gt = gr.top - sr.top, gb = gt + gr.height;
    const xr = gl + last.offsetLeft + last.offsetWidth, cy = gt + last.offsetTop + last.offsetHeight / 2;      // right edge + mid height of the Pixel Perfect card
    const xm = Math.min(W - 10, Math.max(xr + 14, (xr + W) / 2));                                              // the gap to the right of the cards
    const yT = Math.max(60, gt * .5), yB = gb + Math.max(40, (H - gb) * .5), R = 42;
    const P = [
      [W + 80, yT * .55, -.1], [W * .82, yT * .8, -.15], [W * .62, yT, -.2], [W * .4, yT * .85, -.25], [W * .2, yT * 1.05, -.3],   // across the top
      [W * .14, yT * 1.05, -.3], [W * .1, yT + (gt - yT) * .35, -.3], [W * .09, yT + (gt - yT) * .8, -.3],                           // round the corner...
      [W * .09, gt + 40, -.3], [W * .09, (gt + gb) / 2, -.3], [W * .1, gb - 20, -.3], [W * .12, gb + (yB - gb) * .5, -.25],         // ...and down behind the cards
      [W * .2, yB * .99, -.2], [W * .4, yB * 1.02, -.15], [W * .62, yB * .99, -.1], [W * .8, yB, -.05], [xm - R, yB, 0]               // across the bottom
    ];
    for (let a = 15; a <= 90; a += 15) { const t = a * Math.PI / 180; P.push([xm - R + R * Math.sin(t), yB - R + R * Math.cos(t), 0]); }   // corner: right -> up
    const R2 = 28;
    P.push([xm, yB - R - 30, 0], [xm, cy + R2 + 50, 0]);                                                                             // up the gap to the right of the Pixel Perfect card
    for (let a = 15; a <= 90; a += 15) { const t = a * Math.PI / 180; P.push([xm + R2 - R2 * Math.cos(t), cy + R2 - R2 * Math.sin(t), 0]); }   // corner: up -> right
    P.push([W + 60, cy, 0], [W + 160, cy, 0]);                                                                                       // and out through the right edge of the screen
    return P;
  }
  let halfW = 5, pipe = null, curve = null, radTab = null;
  const pipeColor = (t, out) => {
    for (let i = 1; i < STOPS.length; i++) if (t <= STOPS[i][0]) { const [t0, a] = STOPS[i - 1], [t1, b] = STOPS[i]; return out.copy(a).lerp(b, sm((t - t0) / (t1 - t0))); }
    return out.copy(STOPS[STOPS.length - 1][1]);
  };
  function buildPipe() {
    if (pipe) { scene.remove(pipe); pipe.geometry.dispose(); }
    curve = new THREE.CatmullRomCurve3(statsPath().map(([x, y, z]) => new THREE.Vector3((x - stage.clientWidth / 2) / (stage.clientWidth / 2) * halfW, (stage.clientHeight / 2 - y) / (stage.clientHeight / 2) * HALF_H, z * HALF_H)), false, "centripetal");
    const g = new THREE.TubeGeometry(curve, SEGS, CFG.pipeRadius, RAD, false), col = new Float32Array(g.attributes.position.count * 3), t = new THREE.Color();
    for (let i = 0; i <= SEGS; i++) { pipeColor(i / SEGS, t); for (let k = 0; k <= RAD; k++) { const a = (i * (RAD + 1) + k) * 3; col[a] = t.r; col[a + 1] = t.g; col[a + 2] = t.b; } }
    // the pipe narrows towards its exit so it meets the thin Experience pipe (6px radius) exactly
    const endR = 36 / stage.clientHeight, pa = g.attributes.position, cc = new THREE.Vector3(); radTab = new Float32Array(SEGS + 1);
    for (let i = 0; i <= SEGS; i++) {
      const f = sm(seg(i / SEGS, .5, .93)), r = CFG.pipeRadius + (endR - CFG.pipeRadius) * f; radTab[i] = r;
      if (f < .001) continue;
      curve.getPointAt(i / SEGS, cc); const k = r / CFG.pipeRadius;
      for (let j = 0; j <= RAD; j++) { const ix = i * (RAD + 1) + j; pa.setXYZ(ix, cc.x + (pa.getX(ix) - cc.x) * k, cc.y + (pa.getY(ix) - cc.y) * k, cc.z + (pa.getZ(ix) - cc.z) * k); }
    }
    pa.needsUpdate = true;
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    pipe = new THREE.Mesh(g, pipeMat); pipe.frustumCulled = false; scene.add(pipe);
  }
  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
    halfW = HALF_H * cam.aspect; buildPipe();
  }
  new ResizeObserver(resize).observe(stage); resize();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(resize); addEventListener("load", resize);   // card positions can shift once fonts load

  function applyPipe(u) {
    const hp = sm(seg(u, .03, .86)), tail = 0;   // the pipe starts as soon as the section appears and then STAYS: it runs out of the bottom of the stage into the Experience section (no retract, no gap)
    const s0 = Math.floor(tail * SEGS), s1 = Math.ceil(hp * SEGS);
    pipe.geometry.setDrawRange(s0 * STEP, Math.max(s1 - s0, 0) * STEP);
    capA.visible = hp > .002 && tail < hp - .002; capB.visible = capA.visible;
    if (capA.visible && radTab) { capA.scale.setScalar(radTab[Math.round(tail * SEGS)] / CFG.pipeRadius); capB.scale.setScalar(radTab[Math.round(hp * SEGS)] / CFG.pipeRadius); }
    if (capA.visible) { capA.position.copy(curve.getPointAt(tail)); capB.position.copy(curve.getPointAt(hp)); pipeColor(tail, capA.material.color); pipeColor(hp, capB.material.color); }
  }

  /* ---------- loop: only while the section is near the screen ---------- */
  let us = 0, last = 0, raf = 0;
  const sg = GEO.of(sec), progress = () => clamp((innerHeight - sg.top) / sg.h, 0, 1);
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000 || .016, .033); last = now;
    us += (progress() - us) * (1 - Math.exp(-dt * (reduce ? 60 : CFG.smooth)));
    applyCards(us, dt, false); applyPipe(us); renderer.render(scene, cam);
  }
  new IntersectionObserver(es => { if (es[0].isIntersecting) { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } } else { cancelAnimationFrame(raf); raf = 0; } }, { rootMargin: "60% 0px" }).observe(sec);
})();
