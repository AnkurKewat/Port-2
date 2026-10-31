/* =====================================================================
   SPIRAL CARDS INTRO  (Three.js r128)
   Needs: <canvas id="cards-bg"></canvas> + the CSS for #cards-bg
   1) A ribbon of cards spirals up along the helix from bottom-left
   2) Fully scroll-driven: scrolling down spirals the cards up and off-screen,
      smoothly transitioning straight into the website
   Call window.replayCards() to play it again.
   ===================================================================== */
(() => {
  const CFG = {
    images: [],           // optional: screenshots for the spiral ribbon cards
    count: 10,            // cards in the spiral
    helixRadius: 2.6,     // bigger = wider spiral
    turnPerCard: 0.62,    // radians between neighbouring cards
    rise: 0.55,           // vertical climb per card step
    bend: 0.07,           // curve of each card on the spiral
    tiltZ: 0.30,          // diagonal lean of the spiral
    tiltX: 0.20,
    photo: "assets/user-photo.jpg",   // your picture, shown on the centre card of the spiral
    photoFallback: "assets/profile.jpg", // used if the photo above is not found
    photoIndex: 5,        // which card of the spiral carries the photo (0..count-1, 5 = the middle)
    photoWidth: 1.75      // width of the photo card (3:4 portrait, so height = width * 4/3)
  };

  const canvas = document.getElementById("cards-bg");
  if (!canvas || !window.THREE) return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  const CAM_Z = 9;

  /* ---------- procedural "website screenshot" textures (spiral cards) ---------- */
  const FONT = '"Bricolage Grotesque", system-ui, -apple-system, "Segoe UI", sans-serif';
  const DESIGNS = [
    { type: "type",   bg: "#EAF3F2", fg: "#101010", accent: "#E8401C", brand: "LOOSE",  lines: ["LOOSE", "SKETCHES", "TO PLANS"] },
    { type: "photo",  bg: "#CDBBA9", fg: "#2A211B", accent: "#E9DAC9", brand: "ATELIER", lines: ["WE BRING", "IMAGINATION", "TO LIFE"] },
    { type: "type",   bg: "#4A241C", fg: "#FFFFFF", accent: "#C98A5E", brand: "SOLACE",  lines: ["STYLE", "DEFINES", "CHARACTER"] },
    { type: "poster", bg: "#F1F5F4", fg: "#0E0E0E", accent: "#E8401C", brand: "TREND",  big: "2026", lines: ["NEW", "TRENDS"] },
    { type: "photo",  bg: "#D9559F", fg: "#FFFFFF", accent: "#F4A3CF", brand: "VELA",    lines: ["VINTAGE", "FASHION", "STUDIO"] },
    { type: "product",bg: "#1E2A30", fg: "#FFFFFF", accent: "#7FA1B0", brand: "ORBIT",   lines: ["DESIGNED FOR", "EVERY NOTE"] },
    { type: "grid",   bg: "#FFFFFF", fg: "#111111", accent: "#111111", brand: "MONO",    lines: ["BUILDING THE", "FUTURE OF MUSIC"] },
    { type: "product",bg: "#EDEDED", fg: "#111111", accent: "#9A9A9A", brand: "KINO",    lines: ["TIME,", "REDEFINED"] },
    { type: "type",   bg: "#101010", fg: "#F4F4F4", accent: "#E8401C", brand: "NOIR",    lines: ["STUDIO", "NOIR"] },
    { type: "photo",  bg: "#BFD3E6", fg: "#12202E", accent: "#E6EEF7", brand: "FORMA",   lines: ["FORM", "FOLLOWS", "FEELING"] }
  ];

  function drawCard(d) {
    const W = 800, H = 500, c = document.createElement("canvas");
    c.width = W; c.height = H;
    const g = c.getContext("2d");
    g.fillStyle = d.bg; g.fillRect(0, 0, W, H);
    g.fillStyle = d.fg; g.textBaseline = "alphabetic";
    g.font = "700 17px " + FONT; g.textAlign = "left"; g.fillText(d.brand, 30, 42);
    g.font = "500 13px " + FONT; g.textAlign = "right";
    g.fillText("WORK    ABOUT    CONTACT", W - 30, 42);
    g.globalAlpha = .18; g.fillRect(30, 58, W - 60, 1); g.globalAlpha = 1;
    g.textAlign = "left";
    const big = (lines, x, y, size, lh) => { g.font = "800 " + size + "px " + FONT; lines.forEach((l, i) => g.fillText(l, x, y + i * lh)); };
    const small = (x, y, n) => { g.globalAlpha = .35; for (let i = 0; i < n; i++) g.fillRect(x, y + i * 12, 150 - (i % 2) * 40, 4); g.globalAlpha = 1; };
    if (d.type === "type") {
      big(d.lines, 40, 170, 78, 82);
      g.fillStyle = d.accent; g.fillRect(500, 110, 250, 330);
      g.fillStyle = d.bg; g.globalAlpha = .55; g.beginPath(); g.arc(625, 300, 70, 0, 7); g.fill(); g.globalAlpha = 1;
      g.fillStyle = d.fg; small(40, 410, 3);
    } else if (d.type === "photo") {
      g.fillStyle = d.accent; g.fillRect(40, 90, 330, 380);
      const gr = g.createLinearGradient(40, 90, 370, 470); gr.addColorStop(0, "rgba(255,255,255,.35)"); gr.addColorStop(1, "rgba(0,0,0,.25)");
      g.fillStyle = gr; g.fillRect(40, 90, 330, 380);
      g.fillStyle = d.fg; g.globalAlpha = .75; g.beginPath(); g.arc(205, 230, 52, 0, 7); g.fill();
      g.beginPath(); g.ellipse(205, 420, 105, 130, 0, 0, 7); g.fill(); g.globalAlpha = 1;
      g.fillStyle = d.fg; big(d.lines, 410, 190, 46, 52); small(410, 380, 4);
    } else if (d.type === "poster") {
      g.font = "800 250px " + FONT; g.textAlign = "center"; g.fillText(d.big, W / 2, 360);
      g.textAlign = "left"; big(d.lines, 40, 120, 38, 42);
      g.fillStyle = d.accent; g.fillRect(620, 90, 140, 90); g.fillStyle = d.fg; small(40, 410, 3);
    } else if (d.type === "product") {
      const gr = g.createRadialGradient(560, 270, 10, 560, 270, 190);
      gr.addColorStop(0, d.accent); gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr; g.fillRect(300, 60, 500, 440);
      g.fillStyle = d.accent; g.globalAlpha = .9; g.beginPath(); g.arc(560, 270, 105, 0, 7); g.fill();
      g.fillStyle = d.bg; g.beginPath(); g.arc(560, 270, 52, 0, 7); g.fill(); g.globalAlpha = 1;
      g.fillStyle = d.fg; big(d.lines, 40, 200, 56, 62); small(40, 400, 3);
    } else {
      big(d.lines, 40, 150, 52, 58);
      const cols = ["#E8401C", "#111111", "#D9D9D9", "#B8B8B8", "#E8401C", "#F3F3F3"];
      for (let i = 0; i < 6; i++) { g.fillStyle = cols[i]; g.fillRect(40 + (i % 3) * 245, 260 + Math.floor(i / 3) * 105, 230, 90); }
    }
    return c;
  }

  const texFrom = src => { const t = new THREE.CanvasTexture(src); t.anisotropy = 4; return t; };
  const texLoader = new THREE.TextureLoader();

  /* ---------- card material (rounded corners, bend, depth shade) ---------- */
  const vert = `
    varying vec2 vUv; uniform float uBend;
    void main(){ vUv = uv; vec3 p = position; p.z -= uBend * p.x * p.x;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`;
  const frag = `
    precision highp float; varying vec2 vUv;
    uniform sampler2D uMap; uniform float uShade, uAlpha, uAspect, uRadius;
    void main(){
      vec2 p = (vUv - .5) * vec2(uAspect, 1.0);
      vec2 b = vec2(uAspect * .5, .5) - uRadius;
      float d = length(max(abs(p) - b, 0.0)) - uRadius;
      if (d > 0.0) discard;
      vec4 t = texture2D(uMap, gl_FrontFacing ? vUv : vec2(1.0 - vUv.x, vUv.y));
      gl_FragColor = vec4(t.rgb * uShade, uAlpha);
    }`;
  const makeMat = (aspect, radius, bend) => new THREE.ShaderMaterial({
    vertexShader: vert, fragmentShader: frag, side: THREE.DoubleSide, transparent: true,
    uniforms: { uMap: { value: null }, uBend: { value: bend }, uShade: { value: 1 }, uAlpha: { value: 1 }, uAspect: { value: aspect }, uRadius: { value: radius } }
  });

  /* ---------- spiral ribbon cards ---------- */
  const CW = 2.4, CH = 1.5;
  const ribbonGeo = new THREE.PlaneGeometry(CW, CH, 24, 1);
  const PW = CFG.photoWidth, PH = PW * 4 / 3;
  const photoGeo = new THREE.PlaneGeometry(PW, PH, 24, 1);
  const ribbon = [];
  for (let i = 0; i < CFG.count; i++) {
    const isPhoto = i === CFG.photoIndex;
    const mesh = new THREE.Mesh(isPhoto ? photoGeo : ribbonGeo, isPhoto ? makeMat(PW / PH, .035, CFG.bend) : makeMat(CW / CH, .04, CFG.bend));
    mesh.visible = false; mesh.frustumCulled = false;
    scene.add(mesh); ribbon.push(mesh);
  }

  function buildTextures() {
    ribbon.forEach((m, i) => {
      if (i === CFG.photoIndex) {
        const setTex = t => { t.anisotropy = 4; m.material.uniforms.uMap.value = t; };
        texLoader.load(CFG.photo, setTex, undefined, () => {
          texLoader.load(CFG.photoFallback, setTex, undefined, () => {
            m.material.uniforms.uMap.value = texFrom(drawCard(DESIGNS[i % DESIGNS.length]));
          });
        });
      } else if (CFG.images.length) texLoader.load(CFG.images[i % CFG.images.length], t => { m.material.uniforms.uMap.value = t; });
      else m.material.uniforms.uMap.value = texFrom(drawCard(DESIGNS[i % DESIGNS.length]));
    });
  }

  /* ---------- layout ---------- */
  let VW = 1, VH = 1;
  function layout() {
    const w = innerWidth, h = innerHeight, aspect = w / h;
    renderer.setSize(w, h, false);
    camera.aspect = aspect;
    camera.position.set(0, 0, aspect < 1 ? CAM_Z / Math.max(.55, aspect * 1.05) : CAM_Z);
    camera.updateProjectionMatrix();
    VH = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    VW = VH * aspect;
  }

  /* ---------- animation ---------- */
  const tiltE = new THREE.Euler(CFG.tiltX, 0, CFG.tiltZ);
  const tiltQ = new THREE.Quaternion().setFromEuler(tiltE);
  const dummy = new THREE.Object3D(), tmpV = new THREE.Vector3(), tmpN = new THREE.Vector3();
  const Y0 = -5.4, Y_OUT = 6.2;
  const S_END = (Y_OUT + .3 - Y0) / CFG.rise;
  const PHI_END = S_END + (CFG.count - 1);
  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

  let scrollProgress = 0.08, targetProgress = 0.08;
  let running = false, raf = 0, revealed = false, finished = false;
  let canScroll = false;
  let lastTime = 0;
  let scrollHintEl = null;

  /* ---------- scroll-controlled spiral ribbon ---------- */
  function updateRibbon(prog) {
    const p = Math.max(0, Math.min(1, prog));
    const phi = p * PHI_END;
    for (let i = 0; i < ribbon.length; i++) {
      const m = ribbon[i], u = m.material.uniforms;
      const s = phi - i;
      if (s < 0 || (s * CFG.rise + Y0) > Y_OUT) { m.visible = false; continue; }
      const th = -1.35 + s * CFG.turnPerCard, R = CFG.helixRadius;
      tmpV.set(R * Math.sin(th), Y0 + s * CFG.rise, R * Math.cos(th)).applyEuler(tiltE);
      tmpN.set(Math.sin(th), 0, Math.cos(th));
      let flip = false;
      if (tmpN.applyQuaternion(tiltQ).z < 0) { tmpN.negate(); flip = true; }   // far side: face the camera
      dummy.position.copy(tmpV); dummy.lookAt(tmpV.x + tmpN.x, tmpV.y + tmpN.y, tmpV.z + tmpN.z);
      m.visible = true; m.position.copy(tmpV); m.quaternion.copy(dummy.quaternion); m.scale.setScalar(1);
      u.uBend.value = flip ? -CFG.bend : CFG.bend;
      u.uShade.value = .5 + .5 * THREE.MathUtils.smoothstep(tmpV.z, -R, R);
    }
  }

  /* ---------- Unified Scroll Progress Nudge ---------- */
  function nudgeProgress(delta) {
    if (!canScroll || finished || !document.body.classList.contains("intro")) return;
    targetProgress = clamp(targetProgress + delta, 0.04, 1.0);
    if (scrollHintEl && Math.abs(delta) > 0.001) {
      scrollHintEl.classList.add("hidden");
    }
  }

  // Wheel input (mouse wheel & trackpad gestures)
  function onWheel(e) {
    if (!canScroll || finished || !document.body.classList.contains("intro")) return;
    nudgeProgress(e.deltaY * 0.0007);
  }
  window.addEventListener("wheel", onWheel, { passive: true });

  // Touch swipe support
  let touchY = null;
  window.addEventListener("touchstart", e => {
    if (e.touches && e.touches.length) touchY = e.touches[0].clientY;
  }, { passive: true });
  window.addEventListener("touchmove", e => {
    if (!canScroll || touchY == null || !e.touches || !e.touches.length) return;
    const y = e.touches[0].clientY;
    nudgeProgress((touchY - y) * 0.0022);
    touchY = y;
  }, { passive: true });
  window.addEventListener("touchend", () => { touchY = null; }, { passive: true });

  // Keyboard navigation (Arrow keys / Page keys / Space)
  window.addEventListener("keydown", e => {
    if (!canScroll || finished || !document.body.classList.contains("intro")) return;
    const keyMap = { ArrowDown: 0.08, PageDown: 0.22, " ": 0.15, ArrowUp: -0.08, PageUp: -0.22 };
    if (keyMap[e.key] !== undefined) {
      e.preventDefault();
      nudgeProgress(keyMap[e.key]);
    }
  });

  // Desktop click-and-drag navigation
  let isPointerDown = false, pointerLastY = 0;
  window.addEventListener("pointerdown", e => {
    if (!canScroll || finished || !document.body.classList.contains("intro")) return;
    if (e.button === 0) {
      isPointerDown = true;
      pointerLastY = e.clientY;
    }
  });
  window.addEventListener("pointermove", e => {
    if (!isPointerDown || !canScroll || finished || !document.body.classList.contains("intro")) return;
    const dy = pointerLastY - e.clientY;
    pointerLastY = e.clientY;
    nudgeProgress(dy * 0.0018);
  });
  window.addEventListener("pointerup", () => { isPointerDown = false; });
  window.addEventListener("pointercancel", () => { isPointerDown = false; });

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - (lastTime || now)) / 1000 || 0.016, 0.05);
    lastTime = now;

    // Smoothly interpolate scrollProgress towards targetProgress
    const lerpFactor = 1 - Math.exp(-12 * dt);
    scrollProgress += (targetProgress - scrollProgress) * lerpFactor;

    // Cards Spiral (0.0 to 1.0)
    const spiralP = clamp(scrollProgress, 0, 1);
    updateRibbon(spiralP);

    // Site reveal transition ONLY when the spiral cards have actually spiraled all the way up and off-screen
    if (!revealed && scrollProgress >= 0.96) {
      revealed = true;
      document.dispatchEvent(new Event("intro:reveal"));
      if (scrollHintEl) scrollHintEl.remove();

      // Cleanly hide canvas after the CSS crossfade finishes
      setTimeout(() => {
        if (!finished) {
          finished = true;
          canvas.style.display = "none";
          cancelAnimationFrame(raf);
          raf = 0;
          document.dispatchEvent(new Event("intro:done"));
        }
      }, 700);
    }

    renderer.render(scene, camera);
  }

  function createScrollHint() {
    if (scrollHintEl || finished || !document.body.classList.contains("intro")) return;
    scrollHintEl = document.createElement("div");
    scrollHintEl.className = "cards-scroll-hint";
    scrollHintEl.setAttribute("aria-hidden", "true");
    scrollHintEl.innerHTML = `<span class="hint-arrows">&#x2195;</span><span>Scroll down to explore &bull; Scroll up to reverse</span>`;
    document.body.appendChild(scrollHintEl);
  }

  function play() {
    cancelAnimationFrame(raf);
    revealed = false; finished = false;
    scrollProgress = 0.08;
    targetProgress = 0.08;
    canScroll = false;
    canvas.style.display = "";
    lastTime = performance.now();
    createScrollHint();
    if (reduce) {
      targetProgress = 1.0;
      scrollProgress = 1.0;
      revealed = true;
      document.dispatchEvent(new Event("intro:reveal"));
      finished = true;
      canvas.style.display = "none";
      return;
    }
    // Allow scrolling after loader finish transition settles
    setTimeout(() => { canScroll = true; }, 250);
    raf = requestAnimationFrame(frame);
  }
  window.replayCards = play;

  addEventListener("resize", layout);
  const boot = () => { layout(); buildTextures(); play(); };
  const start = () => { if (running) return; running = true; (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(boot); };
  if (document.getElementById("loader")) document.addEventListener("loader:done", start, { once: true });
  else start();
})();
