/* =====================================================================
   PROFESSIONAL EXPERIENCE  (Three.js r128)
   - the pipe keeps coming down from the Stats section, runs down the timeline
     through every node and slowly changes colour (cyan -> teal -> green)
   - it is scroll-drawn: scroll down to extend it, scroll up to pull it back
   - WebGL dot field behind the section reacts to the cursor and to the pipe head
   - cards spring in (stagger, blur-in, 3D tilt + spotlight on hover), nodes light up
   Needs: #exp > .exp-gl > .exp-gl-sticky > canvas, and .exp-item elements
   ===================================================================== */
(() => {
  const CFG = {
    pipeRadius: 2.2,    // thickness of the timeline light in px (radius)
    smooth: 8,          // how softly the pipe follows your scroll
    tilt: 7             // card tilt (degrees) on hover
  };
  const STOPS = [[0, "#00d0d8"], [.5, "#10c890"], [1, "#2fb860"]];   // continues from the cyan the Stats pipe ends in

  const sec = document.getElementById("exp");
  if (!sec || !window.THREE) return;
  const holder = sec.querySelector(".exp-gl-sticky"), canvas = holder.querySelector("canvas");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x)), lerp = (a, b, t) => a + (b - a) * t;
  const sm = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }, seg = (p, a, b) => clamp((p - a) / (b - a), 0, 1);
  const spring = (x = 0) => ({ x, v: 0 });
  function stepSpring(s, target, dt, k = 120, c = 15) { const n = 2, h = dt / n; for (let i = 0; i < n; i++) { s.v += ((target - s.x) * k - s.v * c) * h; s.x += s.v * h; } return s.x; }

  const stops = STOPS.map(([t, c]) => [t, new THREE.Color(c)]);
  const gradient = (t, out) => {
    for (let i = 1; i < stops.length; i++) if (t <= stops[i][0]) { const [t0, a] = stops[i - 1], [t1, b] = stops[i]; return out.copy(a).lerp(b, sm((t - t0) / (t1 - t0))); }
    return out.copy(stops[stops.length - 1][1]);
  };

  /* ---------- DOM: title letters + timeline items ---------- */
  const title = sec.querySelector(".exp-title"), tchars = [];
  if (title) {
    const text = title.textContent.trim(); title.textContent = ""; title.setAttribute("aria-label", text);
    text.split(" ").forEach((w, wi, arr) => {
      const ws = document.createElement("span"); ws.className = "w"; ws.setAttribute("aria-hidden", "true");
      [...w].forEach(ch => { const s = document.createElement("span"); s.className = "ch"; s.textContent = ch; ws.appendChild(s); tchars.push(s); });
      title.appendChild(ws); if (wi < arr.length - 1) title.appendChild(document.createTextNode(" "));
    });
  }
  const trev = spring(0);
  const items = [...sec.querySelectorAll(".exp-item")].map((el, i) => {
    const it = {
      el, i, date: el.querySelector(".exp-date"), card: el.querySelector(".exp-card"), inner: el.querySelector(".exp-in"), node: el.querySelector(".exp-node"),
      tags: [...el.querySelectorAll(".exp-tags span")], pts: [...el.querySelectorAll(".exp-points li")],
      rev: spring(0), hov: spring(0), rx: spring(0), ry: spring(0), tx: 0, ty: 0, hot: false, y: 1e9, lit: false
    };
    it.card.addEventListener("pointerenter", () => { it.hot = true; it.card.classList.add("hot"); });
    it.card.addEventListener("pointermove", e => {
      const b = it.card.getBoundingClientRect(), nx = (e.clientX - b.left) / b.width, ny = (e.clientY - b.top) / b.height;
      it.ty = (nx - .5) * CFG.tilt * 2; it.tx = -(ny - .5) * CFG.tilt * 2;
      it.card.style.setProperty("--mx", nx * 100 + "%"); it.card.style.setProperty("--my", ny * 100 + "%");
    });
    it.card.addEventListener("pointerleave", () => { it.hot = false; it.tx = it.ty = 0; it.card.classList.remove("hot"); });
    return it;
  });

  /* ---------- scene (1 unit = 1 css px at the screen plane) ---------- */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1)); renderer.autoClear = false;   // full-screen canvas + shader: keep it light
  let bgOn = true; document.addEventListener("perf:lite", () => { bgOn = false; }, { once: true });
  const FOV = 30, cam = new THREE.PerspectiveCamera(FOV, 1, 1, 6000), scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, .55));
  const sun = new THREE.DirectionalLight(0xffffff, .6); sun.position.set(-300, 400, 600); scene.add(sun);
  let VW = 1, VH = 1;
  function resizeCanvas() {
    VW = holder.clientWidth; VH = holder.clientHeight; if (!VW || !VH) return;
    renderer.setSize(VW, VH, false); cam.aspect = VW / VH; cam.position.z = (VH / 2) / Math.tan(THREE.MathUtils.degToRad(FOV / 2)); cam.updateProjectionMatrix();
  }

  // background: dot field that lights up around the cursor and the pipe head (own pass, drawn before the pipe)
  const bgScene = new THREE.Scene(), bgCam = new THREE.Camera();
  const bgMat = new THREE.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false,
    uniforms: { uRes: { value: new THREE.Vector2(1, 1) }, uDpr: { value: 1 }, uTime: { value: 0 }, uOff: { value: 0 }, uMouse: { value: new THREE.Vector2(-9999, -9999) }, uHead: { value: new THREE.Vector2(-9999, -9999) }, uCol: { value: new THREE.Color("#00e8e0") }, uHeadOn: { value: 0 }, uH: { value: 1 } },
    vertexShader: "void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }",
    fragmentShader: `
      precision highp float;
      uniform vec2 uRes, uMouse, uHead; uniform float uDpr, uTime, uOff, uHeadOn, uH; uniform vec3 uCol;
      void main(){
        vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uDpr;
        vec2 q = p + vec2(0.0, uOff);                                   // anchored to the section, so the field scrolls with it
        float cell = 30.0;
        float edge = smoothstep(0.0, 220.0, q.y) * smoothstep(uH, uH - 300.0, q.y);   // field fades out at the top and bottom of the section (no hard seam)
        vec2 id = floor(q / cell), c = (id + .5) * cell;
        vec2 dm = c - uMouse; float dml = length(dm);
        c += dm / max(dml, 1.0) * smoothstep(190.0, 0.0, dml) * 9.0;    // dots get pushed away from the cursor
        float glow = smoothstep(280.0, 0.0, length(c - uHead)) * uHeadOn;
        float gm = smoothstep(210.0, 0.0, dml);
        float wave = .5 + .5 * sin(uTime * 1.3 + id.x * .35 + id.y * .27);
        float r = 1.0 + glow * 1.7 + gm * 1.5 + wave * .35;
        float a = smoothstep(r, r - 1.0, length(q - c));
        float k = (.10 + wave * .05 + glow * .8 + gm * .6) * edge;
        vec3 col = mix(vec3(.6), uCol, clamp(glow + gm * .7, 0.0, 1.0));
        gl_FragColor = vec4(col, a * k);
      }`
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat); quad.frustumCulled = false; bgScene.add(quad);

  // pipe + faint track + head cap + glow
  const SEG = 900, RAD = 20, STEP = RAD * 6;
  const pipeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .3, metalness: 0 });
  const trackMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .13 });
  const cap = new THREE.Mesh(new THREE.SphereGeometry(CFG.pipeRadius, 24, 18), new THREE.MeshStandardMaterial({ roughness: .3 })); cap.frustumCulled = false; scene.add(cap);
  const gc = document.createElement("canvas"); gc.width = gc.height = 128;
  const gx = gc.getContext("2d"), gr = gx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(.25, "rgba(255,255,255,.35)"); gr.addColorStop(1, "rgba(255,255,255,0)"); gx.fillStyle = gr; gx.fillRect(0, 0, 128, 128);
  const glowS = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(gc), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: .4 }));
  glowS.scale.set(110, 110, 1); glowS.position.z = -25;   // glow sits behind the pipe so it never washes it out scene.add(glowS);

  let curve = null, pipe = null, track = null, ysS = null, radTab = null;
  const tmpC = new THREE.Color();
  function build() {
    const sr = sec.getBoundingClientRect(); if (!sr.width || !items.length) return;
    const nodes = items.map(it => { const b = it.node.getBoundingClientRect(); it.y = b.top + b.height / 2 - sr.top; return { x: b.left + b.width / 2 - sr.left, y: it.y }; });
    const rx = nodes[0].x, first = nodes[0].y, last = nodes[nodes.length - 1].y;
    const P = [[rx, first - 70], [rx, first - 30]];                                       // the pipeline ended in the Stats section: this is just the thin timeline light
    nodes.forEach((n, i) => { P.push([rx, n.y]); if (i < nodes.length - 1) P.push([rx, (n.y + nodes[i + 1].y) / 2]); });
    P.push([rx, last + 50], [rx, last + 90]);
    curve = new THREE.CatmullRomCurve3(P.map(([x, y]) => new THREE.Vector3(x, -y, 0)), false, "centripetal");
    if (pipe) { scene.remove(pipe); pipe.geometry.dispose(); } if (track) { scene.remove(track); track.geometry.dispose(); }
    const g = new THREE.TubeGeometry(curve, SEG, CFG.pipeRadius, RAD, false), col = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i <= SEG; i++) { gradient(i / SEG, tmpC); for (let k = 0; k <= RAD; k++) { const a = (i * (RAD + 1) + k) * 3; col[a] = tmpC.r; col[a + 1] = tmpC.g; col[a + 2] = tmpC.b; } }
    // the pipe starts as thick as the Stats pipe it continues from, then narrows to the timeline thickness
    const Ltot = curve.getLength(), R0 = CFG.pipeRadius, TAPER = 380, pa = g.attributes.position, cc = new THREE.Vector3();
    radTab = new Float32Array(SEG + 1);
    for (let i = 0; i <= SEG; i++) {
      const f = 1 - sm(clamp(i / SEG * Ltot / TAPER, 0, 1)), r = CFG.pipeRadius + (R0 - CFG.pipeRadius) * f; radTab[i] = r;
      if (f < .001) continue;
      curve.getPointAt(i / SEG, cc); const k = r / CFG.pipeRadius;
      for (let j = 0; j <= RAD; j++) { const ix = i * (RAD + 1) + j; pa.setXYZ(ix, cc.x + (pa.getX(ix) - cc.x) * k, cc.y + (pa.getY(ix) - cc.y) * k, cc.z + (pa.getZ(ix) - cc.z) * k); }
    }
    pa.needsUpdate = true;
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    pipe = new THREE.Mesh(g, pipeMat); pipe.frustumCulled = false; scene.add(pipe);
    track = new THREE.Mesh(new THREE.TubeGeometry(curve, SEG, 1.6, 6, false), trackMat); track.frustumCulled = false; scene.add(track);
    ysS = curve.getSpacedPoints(SEG).map(p => -p.y);
    items.forEach(it => { let i = 0; while (i < SEG && ysS[i] < it.y) i++; gradient(i / SEG, tmpC); it.el.style.setProperty("--c", "#" + tmpC.getHexString()); });
    resizeCanvas();
  }
  const headFrac = y => {
    if (!ysS || y <= ysS[0]) return 0;
    if (y >= ysS[SEG]) return 1;
    let i = 0; while (i < SEG - 1 && ysS[i + 1] <= y) i++;
    return (i + (y - ysS[i]) / Math.max(ysS[i + 1] - ysS[i], 1e-3)) / SEG;
  };

  /* ---------- cursor ---------- */
  const mt = { x: -9999, y: -9999 }, ms = { x: -9999, y: -9999 };
  addEventListener("pointermove", e => { mt.x = e.clientX; mt.y = e.clientY; }, { passive: true });

  /* ---------- items ---------- */
  const sg = GEO.of(sec), tg = title ? GEO.of(title) : null; items.forEach(it => { it.g = GEO.of(it.el); });   // cached positions (no layout reads per frame)
  function applyItems(dt, headS, snap) {
    if (title) {
      const target = sm(clamp((innerHeight * .92 - tg.top) / (innerHeight * .22), 0, 1));
      if (reduce || snap) { trev.x = target; trev.v = 0; } else stepSpring(trev, target, dt, 90, 14);
      const op = clamp(trev.x, 0, 1);
      tchars.forEach((c, k) => { const p = clamp(op * 2.2 - k * .045, 0, 1); c.style.transform = "translate3d(0," + ((1 - p) * 110).toFixed(1) + "%,0)"; });
    }
    items.forEach(it => {
      const target = sm(clamp((innerHeight * .9 - it.g.top) / (innerHeight * .3), 0, 1));
      if (reduce || snap) { it.rev.x = target; it.rev.v = 0; } else stepSpring(it.rev, target, dt, 95, 13);
      stepSpring(it.hov, it.hot ? 1 : 0, dt, 220, 20); stepSpring(it.rx, it.tx, dt, 140, 16); stepSpring(it.ry, it.ty, dt, 140, 16);
      const s = it.rev.x, op = clamp(s, 0, 1);
      it.card.style.opacity = op;
      it.card.style.transform = "perspective(1200px) translate3d(" + ((1 - s) * 70).toFixed(1) + "px," + ((1 - s) * 36).toFixed(1) + "px,0) rotateX(" + it.rx.x.toFixed(2) + "deg) rotateY(" + ((1 - s) * -14 + it.ry.x).toFixed(2) + "deg) scale(" + (.94 + .06 * s + it.hov.x * .02).toFixed(4) + ")";
      it.date.style.opacity = op; it.date.style.transform = "translate3d(" + ((1 - s) * -36).toFixed(1) + "px,0,0)";
      it.inner.style.filter = op < .999 ? "blur(" + ((1 - op) * 9).toFixed(2) + "px)" : "none";
      it.tags.forEach((t, k) => { const p = clamp(s * 2 - .8 - k * .16, 0, 1.15); t.style.opacity = clamp(p, 0, 1); t.style.transform = "scale(" + (.6 + .4 * p).toFixed(3) + ")"; });
      it.pts.forEach((li, k) => { const p = clamp(s * 2.1 - .5 - k * .3, 0, 1); li.style.opacity = p; li.style.transform = "translate3d(" + ((1 - p) * 26).toFixed(1) + "px,0,0)"; });
      const lit = headS >= it.y;
      if (lit !== it.lit) { it.lit = lit; it.el.classList.toggle("lit", lit); }
    });
  }
  applyItems(.016, -1e9, true);

  /* ---------- loop: only while the section is near the screen ---------- */
  let last = 0, raf = 0;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000 || .016, .033); last = now;
    if (!curve) return;
    const sTop = sg.top, sH = sg.h, ct = Math.min(Math.max(sTop, 0), sTop + sH - innerHeight), yTop = ct - sTop;   // where the sticky canvas currently sits inside the section
    const headS = PIPE.get(now, reduce) - sTop - scrollY;                                                            // shared pipe head (same value as the other sections)
    cam.position.x = VW / 2; cam.position.y = -(yTop + VH / 2);

    const hp = headFrac(headS), hpt = curve.getPointAt(hp);
    pipe.geometry.setDrawRange(0, Math.ceil(hp * SEG) * STEP);
    gradient(hp, cap.material.color); cap.position.copy(hpt); cap.visible = hp > .002 && hp < .999;
    if (radTab) cap.scale.setScalar(radTab[Math.min(SEG, Math.round(hp * SEG))] / CFG.pipeRadius);
    glowS.position.set(hpt.x, hpt.y, -25); glowS.material.color.copy(cap.material.color); glowS.visible = hp > .002;

    ms.x += (mt.x - ms.x) * .2; ms.y += ((mt.y - sTop) - ms.y) * .2;
    const u = bgMat.uniforms; renderer.getDrawingBufferSize(u.uRes.value); u.uDpr.value = renderer.getPixelRatio();
    u.uTime.value = now / 1000; u.uOff.value = yTop; u.uMouse.value.set(ms.x, ms.y); u.uHead.value.set(hpt.x, -hpt.y); u.uCol.value.copy(cap.material.color); u.uHeadOn.value = hp > .002 ? 1 : 0; u.uH.value = sH;

    applyItems(dt, headS, false);
    renderer.clear(); if (bgOn) renderer.render(bgScene, bgCam); renderer.render(scene, cam);
  }
  new IntersectionObserver(es => { if (es[0].isIntersecting) { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } } else { cancelAnimationFrame(raf); raf = 0; } }, { rootMargin: "30% 0px" }).observe(sec);

  new ResizeObserver(build).observe(sec);
  new ResizeObserver(resizeCanvas).observe(holder);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(build);
  addEventListener("load", build);
  build();
})();
