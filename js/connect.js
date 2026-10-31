/* =====================================================================
   CONNECT SECTION  (Three.js r128)
   - WebGL: a knot of ~5000 glowing particles (blue -> cyan -> green) that breathes, turns slowly,
     tilts with your cursor, is pushed away from the cursor, and bursts + takes on the colour of
     whichever card you hover
   - Framer-Motion-style: letters rise out of a mask, words blur in, cards spring in with stagger,
     3D tilt + magnetic pull + spotlight on hover, icons pop and arrows slide
   Everything is scroll-linked (scroll back up and it reverses).
   Needs: #connect with .cn-gl (canvas), .cn-kicker, .cn-title, .cn-sub, .cn-card
   ===================================================================== */
(() => {
  const sec = document.getElementById("connect");
  if (!sec || !window.THREE) return;
  const cv = sec.querySelector(".cn-gl"), kicker = sec.querySelector(".cn-kicker"), title = sec.querySelector(".cn-title"), sub = sec.querySelector(".cn-sub");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x)), sm = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }, seg = (p, a, b) => clamp((p - a) / (b - a), 0, 1);
  const spring = (x = 0) => ({ x, v: 0 });
  function stepSpring(s, target, dt, k = 120, c = 15) { const n = 2, h = dt / n; for (let i = 0; i < n; i++) { s.v += ((target - s.x) * k - s.v * c) * h; s.x += s.v * h; } return s.x; }

  /* ---------- text split ---------- */
  const tchars = [];
  { const text = title.textContent.trim(); title.textContent = ""; title.setAttribute("aria-label", text);
    text.split(" ").forEach((w, wi, arr) => {
      const ws = document.createElement("span"); ws.className = "w"; ws.setAttribute("aria-hidden", "true");
      [...w].forEach(ch => { const s = document.createElement("span"); s.className = "ch"; s.textContent = ch; ws.appendChild(s); tchars.push(s); });
      title.appendChild(ws); if (wi < arr.length - 1) title.appendChild(document.createTextNode(" "));
    }); }
  const swords = [];
  { const text = sub.textContent.trim().replace(/\s+/g, " "); sub.textContent = ""; sub.setAttribute("aria-label", text);
    text.split(" ").forEach((w, i, arr) => { const s = document.createElement("span"); s.className = "fx"; s.setAttribute("aria-hidden", "true"); s.textContent = w; sub.appendChild(s); swords.push(s); if (i < arr.length - 1) sub.appendChild(document.createTextNode(" ")); }); }
  const trev = spring(0), srev = spring(0), krev = spring(0);

  /* ---------- cards ---------- */
  const HEX = h => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
  const cards = [...sec.querySelectorAll(".cn-card")].map((el, i) => {
    const it = { el, i, icon: el.querySelector(".cn-icon"), parts: [el.querySelector(".cn-name"), el.querySelector(".cn-handle"), el.querySelector(".cn-arrow")], col: HEX(el.dataset.c || "#00d8ff"),
      rev: spring(0), hov: spring(0), rx: spring(0), ry: spring(0), ox: spring(0), oy: spring(0), tx: 0, ty: 0, tox: 0, toy: 0, hot: false };
    el.addEventListener("pointerenter", () => { it.hot = true; });
    el.addEventListener("pointermove", e => {
      const b = el.getBoundingClientRect(), nx = (e.clientX - b.left) / b.width, ny = (e.clientY - b.top) / b.height;
      it.ty = (nx - .5) * 16; it.tx = -(ny - .5) * 16; it.tox = (nx - .5) * 16; it.toy = (ny - .5) * 12;   // tilt + magnetic pull
      el.style.setProperty("--mx", nx * 100 + "%"); el.style.setProperty("--my", ny * 100 + "%");
    });
    el.addEventListener("pointerleave", () => { it.hot = false; it.tx = it.ty = it.tox = it.toy = 0; });
    return it;
  });

  /* ---------- WebGL particle knot ---------- */
  const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: false, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(45, 1, .1, 100); cam.position.z = 9;
  const N = innerWidth < 700 ? 2200 : 5000, pos = new Float32Array(N * 3), aU = new Float32Array(N), aR = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const u = Math.random(), t = u * Math.PI * 2, c = 2 + Math.cos(3 * t);
    let x = c * Math.cos(2 * t), y = c * Math.sin(2 * t), z = Math.sin(3 * t) * 1.6;
    const rad = Math.pow(Math.random(), 1.6) * .6 + .03, th = Math.random() * 6.283, ph = Math.acos(2 * Math.random() - 1);
    x += rad * Math.sin(ph) * Math.cos(th); y += rad * Math.sin(ph) * Math.sin(th); z += rad * Math.cos(ph);
    pos.set([x * 1.35, y * 1.35, z * 1.35], i * 3); aU[i] = u; aR[i] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geo.setAttribute("aU", new THREE.BufferAttribute(aU, 1)); geo.setAttribute("aR", new THREE.BufferAttribute(aR, 1));
  const U = { uTime: { value: 0 }, uPx: { value: 1 }, uPulse: { value: 0 }, uAspect: { value: 1 }, uMouse: { value: new THREE.Vector2(-9, -9) },
    uA: { value: new THREE.Color("#4f56ff") }, uB: { value: new THREE.Color("#00d8ff") }, uC: { value: new THREE.Color("#27f0b0") }, uTint: { value: new THREE.Color("#00d8ff") } };
  const mat = new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute float aU, aR; uniform float uTime, uPx, uPulse, uAspect; uniform vec2 uMouse; varying float vU, vA;
      void main(){
        vec3 p = position;
        float w = sin(uTime * .8 + aU * 40.0 + aR * 6.2831);
        p += normalize(p) * w * (.05 + uPulse * .3);                       // breathing, bursts outward on card hover
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        vec2 ndc = gl_Position.xy / gl_Position.w, d = ndc - uMouse;
        float m = smoothstep(.38, 0.0, length(d * vec2(uAspect, 1.0)));
        gl_Position.xy += normalize(d + 1e-4) * m * .07 * gl_Position.w;   // pushed away from the cursor
        gl_PointSize = (1.8 + aR * 3.0 + m * 4.0 + uPulse * 2.0) * uPx * (9.0 / -mv.z);
        vU = aU; vA = .3 + .6 * aR + m;
      }`,
    fragmentShader: `
      precision highp float; uniform vec3 uA, uB, uC, uTint; uniform float uPulse; varying float vU, vA;
      void main(){
        float d = length(gl_PointCoord - .5); if (d > .5) discard;
        float a = smoothstep(.5, .0, d);
        vec3 col = vU < .5 ? mix(uA, uB, vU * 2.0) : mix(uB, uC, (vU - .5) * 2.0);
        col = mix(col, uTint, uPulse * .65);
        gl_FragColor = vec4(col, a * a * vA * .85);
      }`
  });
  const group = new THREE.Group(); group.add(new THREE.Points(geo, mat)); scene.add(group);
  function resize() {
    const w = sec.clientWidth, h = sec.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
    U.uAspect.value = w / h; U.uPx.value = renderer.getPixelRatio() * clamp(h / 800, .7, 1.4); group.scale.setScalar(w / h < 1 ? .62 : 1);
  }
  new ResizeObserver(resize).observe(sec); resize();
  const sg = GEO.of(sec);
  document.addEventListener("perf:lite", () => { geo.setDrawRange(0, Math.floor(N * .35)); renderer.setPixelRatio(1); resize(); }, { once: true });
  const mt = { x: -9, y: -9 }, ms = { x: 0, y: 0 };
  addEventListener("pointermove", e => { const r = sec.getBoundingClientRect(); mt.x = ((e.clientX - r.left) / r.width) * 2 - 1; mt.y = -(((e.clientY - r.top) / r.height) * 2 - 1); }, { passive: true });
  document.addEventListener("pointerleave", () => { mt.x = mt.y = -9; });
  const pulse = spring(0), tint = [0, .85, 1];

  /* ---------- loop (only while the section is near the screen) ---------- */
  let raf = 0, last = 0;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000 || .016, .033); last = now;
    const u = clamp((innerHeight - sg.top) / (innerHeight * .95), 0, 1);

    // text
    const tgt = (v, s, k, c) => { if (reduce) { s.x = v; s.v = 0; } else stepSpring(s, v, dt, k, c); return s.x; };
    const k = clamp(tgt(sm(seg(u, .02, .2)), krev, 100, 16), 0, 1.2);
    kicker.style.opacity = clamp(k, 0, 1); kicker.style.letterSpacing = (.2 + (1 - clamp(k, 0, 1)) * .5).toFixed(3) + "em";
    const t = clamp(tgt(sm(seg(u, .08, .4)), trev, 90, 14), 0, 1.2);
    tchars.forEach((c, i) => { const p = clamp(t * 2.2 - i * .05, 0, 1); c.style.transform = "translate3d(0," + ((1 - p) * 110).toFixed(1) + "%,0)"; });
    const s = clamp(tgt(sm(seg(u, .25, .5)), srev, 80, 14), 0, 1.2);
    swords.forEach((w, i) => { const p = clamp(s * 2 - i * .03, 0, 1); w.style.opacity = p; w.style.transform = "translate3d(0," + ((1 - p) * 16).toFixed(1) + "px,0)"; w.style.filter = p < .999 ? "blur(" + ((1 - p) * 7).toFixed(1) + "px)" : "none"; });

    // cards
    let hotCard = null;
    cards.forEach(c => {
      const a = .38 + c.i * .06; tgt(sm(seg(u, a, a + .24)), c.rev, 110, 13);
      stepSpring(c.hov, c.hot ? 1 : 0, dt, 220, 20); stepSpring(c.rx, c.tx, dt, 140, 16); stepSpring(c.ry, c.ty, dt, 140, 16); stepSpring(c.ox, c.tox, dt, 120, 16); stepSpring(c.oy, c.toy, dt, 120, 16);
      const sp = c.rev.x, op = clamp(sp, 0, 1);
      c.el.style.opacity = op;
      c.el.style.transform = "perspective(1100px) translate3d(" + c.ox.x.toFixed(1) + "px," + ((1 - sp) * 80 + c.oy.x).toFixed(1) + "px,0) rotateX(" + ((1 - sp) * 20 + c.rx.x).toFixed(2) + "deg) rotateY(" + c.ry.x.toFixed(2) + "deg) scale(" + (.9 + .1 * sp + c.hov.x * .03).toFixed(4) + ")";
      c.parts.forEach((el, j) => { const p = clamp(sp * 2 - .5 - j * .25, 0, 1.15); el.style.opacity = clamp(p, 0, 1); el.style.transform = "translate3d(0," + ((1 - p) * 14).toFixed(1) + "px,0)"; });
      const ip = clamp(sp * 1.6 - .5, 0, 1.2); c.icon.style.transform = "scale(" + (.4 + .6 * ip).toFixed(3) + ") rotate(" + ((1 - Math.min(ip, 1)) * -40).toFixed(1) + "deg)";
      if (c.hot) hotCard = c;
    });

    // WebGL
    stepSpring(pulse, hotCard ? 1 : 0, dt, 50, 9); U.uPulse.value = clamp(pulse.x, 0, 1.2);
    const want = hotCard ? hotCard.col : [0, .85, 1];
    for (let i = 0; i < 3; i++) tint[i] += (want[i] - tint[i]) * Math.min(1, dt * 6);
    U.uTint.value.setRGB(tint[0], tint[1], tint[2]);
    ms.x += (mt.x * (mt.x > -5 ? 1 : 0) - ms.x) * .05; ms.y += (mt.y * (mt.y > -5 ? 1 : 0) - ms.y) * .05;
    U.uTime.value = now / 1000; U.uMouse.value.set(mt.x, mt.y);
    group.rotation.y = now / 1000 * .07 + ms.x * .4; group.rotation.x = .35 + ms.y * -.25; group.position.y = (u - .5) * -.9;
    renderer.render(scene, cam);
  }
  new IntersectionObserver(es => { if (es[0].isIntersecting) { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } } else { cancelAnimationFrame(raf); raf = 0; } }, { rootMargin: "20% 0px" }).observe(sec);
})();
