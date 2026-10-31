(() => {
  /* =========================================================
     CONFIG
     Paste your Spline "Public URL" (…/scene.splinecode) to use
     your own Spline scene instead of the built-in pipeline scene.
     ========================================================= */
  const SPLINE_URL = "";            // e.g. "https://prod.spline.design/XXXX/scene.splinecode"
  const PIPE_SCALE = 1;             // thickness of the pipes (1 = default, 0.7 = slimmer)
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const $ = id => document.getElementById(id);
  const loader = $("loader"), stage = $("stage"), num = $("num"), fill = $("fill"), msg = $("msg"), cur = $("cur");

  /* ---------- Scroll-controlled progress ---------- */
  let progress = 0, finished = false;
  const nudge = d => { progress = Math.max(0, Math.min(100, progress + d)); };
  document.addEventListener("wheel", e => nudge(e.deltaY * .045), { passive: true });      // scroll down = more progress, scroll up = less
  let ty = null;                                                                           // touch swipes and keys work too
  addEventListener("touchstart", e => { ty = e.touches[0].clientY; }, { passive: true });
  addEventListener("touchmove", e => { if (ty == null) return; const y = e.touches[0].clientY; nudge((ty - y) * .22); ty = y; }, { passive: true });
  addEventListener("keydown", e => { const d = { ArrowDown: 4, PageDown: 15, " ": 10, ArrowUp: -4, PageUp: -15 }[e.key]; if (d) nudge(d); });
  /* ---------- Visual A: Spline scene ---------- */
  function startSpline() {
    const s = document.createElement("script");
    s.type = "module";
    s.src = "https://unpkg.com/@splinetool/viewer@1.9.28/build/spline-viewer.js";
    document.head.appendChild(s);
    const v = document.createElement("spline-viewer");
    v.setAttribute("url", SPLINE_URL);
    v.setAttribute("loading-anim-type", "none");
    stage.appendChild(v);


  }

  /* ---------- Visual B: big pipelines crawling across the screen ----------
     right -> left, top -> down, plus a double spiral winding into the centre.
     Each pipe is a "snake": a head crawls along it with the tail following. */
  let draw = () => {}, dispose = () => {}, burst = () => {};
  function startThree() {
    const V = (x, y, z = 0) => new THREE.Vector3(x, y, z);
    const clamp01 = x => Math.min(Math.max(x, 0), 1);
    const ease = k => 1 - Math.pow(1 - k, 3);
    const lerp = (a, b, k) => a + (b - a) * k;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    stage.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(40, 1, .1, 60);

    scene.add(new THREE.AmbientLight(0xffffff, .5));
    const key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(3, 4, 6); scene.add(key);
    const rim = new THREE.DirectionalLight(0x888888, 1.0); rim.position.set(-5, -3, -2); scene.add(rim);
    const glow = new THREE.PointLight(0xffffff, 3, 14); glow.position.set(0, 0, 3.5); scene.add(glow);   // follows cursor

    const mk = (c, o = {}) => new THREE.MeshPhysicalMaterial(Object.assign({ color: c, roughness: .24, metalness: .3, clearcoat: 1, clearcoatRoughness: .1, transparent: true }, o));
    const M = {
      ivory: mk(0xf2f2f2, { emissive: 0x111111, roughness: .3 }),
      graphite: mk(0x2a2a2d, { metalness: .75, roughness: .28 }),
      burgundy: mk(0x737378, { emissive: 0x101010 }),
      sand: mk(0xa5a5aa, { emissive: 0x111111, roughness: .3 }),
    };
    const mats = Object.values(M);

    const far = new THREE.Group(), near = new THREE.Group(); scene.add(far, near);
    let pipes = [], halfW = 6, halfH = 3.4;

    /* path with rounded corners from a list of points */
    function roundPath(raw, rc) {
      const pts = raw.filter((p, i) => i === 0 || p.distanceTo(raw[i - 1]) > .01);
      const path = new THREE.CurvePath();
      let prev = pts[0].clone();
      for (let i = 1; i < pts.length - 1; i++) {
        const a = pts[i - 1], c = pts[i], b = pts[i + 1];
        const cut = Math.min(rc, a.distanceTo(c) / 2, c.distanceTo(b) / 2);
        const pa = c.clone().sub(a).normalize().multiplyScalar(-cut).add(c);
        const pb = b.clone().sub(c).normalize().multiplyScalar(cut).add(c);
        path.add(new THREE.LineCurve3(prev, pa));
        path.add(new THREE.QuadraticBezierCurve3(pa, c.clone(), pb));
        prev = pb;
      }
      path.add(new THREE.LineCurve3(prev, pts[pts.length - 1]));
      return path;
    }

    /* a stair-stepped route that crosses the whole screen along one axis */
    function stairRoute(horizontal, dir, z) {
      const A = horizontal ? halfW : halfH, B = horizontal ? halfH : halfW;
      let a = -dir * (A + .8), b = (Math.random() * 2 - 1) * B * .85;
      const end = dir * (A + .8), pts = [[a, b]];
      while (dir * (end - a) > .01) {
        const len = 1.5 + Math.random() * 2.3;
        a = dir > 0 ? Math.min(a + len, end) : Math.max(a - len, end);
        pts.push([a, b]);
        if (dir * (end - a) <= .01) break;
        const nb = Math.max(-B * .9, Math.min(B * .9, b + (Math.random() < .5 ? -1 : 1) * (.7 + Math.random() * 1.5)));
        if (Math.abs(nb - b) > .15) { b = nb; pts.push([a, b]); }
      }
      return roundPath(pts.map(([a, b]) => horizontal ? V(a, b, z) : V(b, a, z)), .6);
    }

    /* double spiral: one arm comes in from the top, one from the bottom, both wind into the centre */
    function spiral(fromTop, r0) {
      const sgn = fromTop ? 1 : -1, pts = [];
      pts.push(V(0, sgn * (halfH + .8), .2), V(0, sgn * (r0 + .9), .1));
      const N = 90, turns = 2.3;
      for (let i = 0; i <= N; i++) {
        const s = i / N, r = lerp(r0, .22, Math.pow(s, .9)), th = Math.PI / 2 * sgn + s * turns * Math.PI * 2;
        pts.push(V(Math.cos(th) * r, Math.sin(th) * r, Math.sin(s * 7 + (fromTop ? 0 : 3)) * .3));
      }
      return new THREE.CatmullRomCurve3(pts, false, "centripetal");
    }

    function addPipe(path, r, mat, grp, o = {}) {
      const segs = o.segs || 220, rad = 14;
      r *= PIPE_SCALE;
      const tube = new THREE.TubeGeometry(path, segs, r, rad, false);
      const mesh = new THREE.Mesh(tube, mat);
      const capG = new THREE.SphereGeometry(r, 18, 14);
      const capMat = mat;
      const c1 = new THREE.Mesh(capG, capMat), c2 = new THREE.Mesh(capG, capMat);
      grp.add(mesh, c1, c2);
      pipes.push({ mesh, c1, c2, path, segs, step: rad * 6, L0: o.L0 || .25 + Math.random() * .15,
        speed: (o.speed || .07 + Math.random() * .08), flow: o.flow ?? (Math.random() < .5 ? -1 : 1), response: o.response || (.75 + Math.random() * 1.1), ph: Math.random(), born: pipes.length * .15 });
    }

    function buildPipes() {
      pipes.forEach(o => { o.mesh.parent.remove(o.mesh, o.c1, o.c2); o.mesh.geometry.dispose(); o.c1.geometry.dispose(); });
      pipes = [];
      const narrow = cam.aspect < .8;
      const r0 = Math.min(1.35, halfW * .48, halfH * .5);
      addPipe(spiral(true, r0), .14, M.ivory, near, { segs: 420, L0: .22, speed: .07, flow: 1, response: .9 });
      addPipe(spiral(false, r0), .14, M.graphite, near, { segs: 420, L0: .22, speed: .11, flow: -1, response: 1.2 });
      const hM = [M.graphite, M.sand, M.ivory], vM = [M.burgundy, M.graphite];
      for (let i = 0; i < (narrow ? 2 : 3); i++) addPipe(stairRoute(true, -1, -1 - Math.random() * 1.6), .11 + Math.random() * .05, hM[i], far);      // right -> left
      for (let i = 0; i < 2; i++) addPipe(stairRoute(false, -1, -.6 - Math.random() * 1.4), .11 + Math.random() * .05, vM[i], far);                    // top -> down
      addPipe(stairRoute(Math.random() < .5, Math.random() < .5 ? 1 : -1, -1.5 - Math.random() * 1.2), .1, M.sand, far, { speed: .14, flow: 1, response: 1.35 });               // gray accent
    }

    function resize() {
      const w = stage.clientWidth, h = stage.clientHeight;
      renderer.setSize(w, h, false);
      cam.aspect = w / h;
      cam.position.z = w / h < .8 ? 12 : 9.5;
      cam.updateProjectionMatrix();
      halfH = Math.tan(THREE.MathUtils.degToRad(20)) * (cam.position.z + 1.5); halfW = halfH * cam.aspect;
      buildPipes();
    }
    resize(); addEventListener("resize", resize);

    /* ---- cursor interaction ---- */
    let mx = 0, my = 0, sx = 0, sy = 0, inside = false, energy = 0, pulseK = 0, boom = 0, boomOn = false, prog = 0, raf;
    let verticalDrive = 0, verticalDriveTarget = 0;
    const move = e => {
      const x = e.clientX / innerWidth - .5, y = e.clientY / innerHeight - .5;
      energy = Math.min(energy + Math.hypot(x - mx, y - my) * 10, 1.5);
      mx = x; my = y; inside = true;
      cur.style.transform = `translate(${e.clientX}px,${e.clientY}px)`;
      cur.classList.add("on");
    };
    loader.addEventListener("pointermove", move);
    loader.addEventListener("pointerdown", e => { move(e); pulseK = 1; });
    document.addEventListener("pointerleave", () => { inside = false; cur.classList.remove("on"); });
    document.addEventListener("wheel", e => { verticalDriveTarget = THREE.MathUtils.clamp(e.deltaY / 80, -1, 1); }, { passive: true });

    draw = p => { prog = p / 100; };
    burst = () => { boomOn = true; };

    const t0s = performance.now();
    let last = t0s;
    (function loop(now) {
      raf = requestAnimationFrame(loop);
      const dt = Math.min((now - last) / 1000, .05); last = now;
      const t = (now - t0s) / 1000;
      energy *= .95; pulseK *= .92;
      verticalDriveTarget *= Math.exp(-dt * 3.4);
      verticalDrive += (verticalDriveTarget - verticalDrive) * (1 - Math.exp(-dt * 14));
      if (boomOn) boom = Math.min(boom + dt * 1.6, 1);
      cur.classList.toggle("fast", energy > .5);

      sx += ((inside ? mx : 0) - sx) * .06; sy += ((inside ? my : 0) - sy) * .06;
      far.position.x = -sx * .8; far.position.y = sy * .5;
      near.position.x = sx * .45; near.position.y = -sy * .3;
      near.rotation.y = sx * .35; near.rotation.x = sy * .25;
      const sc = 1 + pulseK * .06 + boom * boom * .5;
      far.scale.setScalar(sc); near.scale.setScalar(sc);

      glow.position.x += ((inside ? mx * 2 * halfW : 0) - glow.position.x) * .1;
      glow.position.y += ((inside ? -my * 2 * halfH : 0) - glow.position.y) * .1;
      glow.intensity = 4 + energy * 5;
      mats.forEach(m => m.opacity = 1 - boom);

      pipes.forEach(o => {
        const appear = reduce ? 1 : clamp01((t - o.born) / 1.1);
        o.ph = (o.ph + dt * o.speed * o.flow * o.response * verticalDrive * 7 + 1) % 1;
        const L = lerp(o.L0, .5, ease(prog)) * appear;                 // snakes grow a little, never flood the screen
        const head = clamp01((o.ph % 1) * (1 + L)), tail = clamp01((o.ph % 1) * (1 + L) - L);
        const s0 = Math.floor(tail * o.segs), s1 = Math.ceil(head * o.segs);
        const show = s1 > s0;
        o.mesh.geometry.setDrawRange(s0 * o.step, Math.max(s1 - s0, 0) * o.step);
        o.mesh.visible = o.c1.visible = o.c2.visible = show;
        if (show) { o.c1.position.copy(o.path.getPointAt(tail)); o.c2.position.copy(o.path.getPointAt(head)); }
      });

      renderer.render(scene, cam);
    })(last);
    dispose = () => {
      cancelAnimationFrame(raf); removeEventListener("resize", resize);
      pipes.forEach(o => { o.mesh.geometry.dispose(); o.c1.geometry.dispose(); });
      mats.forEach(m => m.dispose()); renderer.dispose();
    };
  }

  SPLINE_URL ? startSpline() : startThree();

  /* ---------- Main tick ---------- */
  function tick() {
    const p = progress;
    num.textContent = Math.floor(p);
    fill.style.width = p + "%";
    draw(p);
    if (p > 55 && p < 99.5) msg.textContent = "Almost connected";
    if (p >= 100 && !finished) { finished = true; finish(); return; }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  function finish() {
    num.textContent = "100";
    msg.textContent = "Ready";
    const reveal = () => {
      document.body.classList.add("site-revealed");
      document.dispatchEvent(new Event("loader:done"));
      setTimeout(() => { dispose(); loader.classList.add("gone"); }, 650);
    };
    if (reduce) { burst(); reveal(); return; }
    setTimeout(() => {
      burst();
      loader.classList.add("finishing");
      reveal();
    }, 500);
  }})();
