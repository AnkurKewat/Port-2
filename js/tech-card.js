/* =====================================================================
   TECH ICON CARD  (Three.js r128)
   Needs: <section class="tech-card"><canvas></canvas></section> + css/tech-card.css
   Chunky icon tiles tumble around inside the card like loose objects.
   With no icon under the cursor (or the cursor outside the card) all tiles gather in the middle.
   The tile under the cursor sticks to it and follows it around, the others get pushed
   away, and a liquid distortion with rainbow edges ripples through the whole card.
   ===================================================================== */
(() => {
  const CFG = {
    count: 36,        // tiles in the card (36 = every icon once; more = some repeat)
    fill: 0.57,       // how much of the card the tiles cover (0.2 = sparse, 0.45 = packed)
    pushForce: 26,    // how hard the cursor shoves tiles away
    swirl: 10,        // sideways swirl around the cursor
    cursorRadius: 1.5,// how far the cursor shoves the other tiles (world units, the card is 6 tall)
    drift: 0.18,      // gentle wandering so the pile never goes dead
    gatherX: 4,       // pull toward the middle when no icon is hovered (sideways)
    gatherY: 9,       // ... and up/down (stronger, so the pile forms a wide band)
    gatherDamp: 2.5,  // how quickly they calm down while gathering
    followSpeed: 45,  // how fast the hovered tile snaps to the cursor (higher = more instant)
    bounce: 0.6       // how bouncy walls and tile-to-tile hits are
  };
  const card = document.querySelector(".tech-card");
  if (!card || !window.THREE) return;
  const canvas = card.querySelector("canvas");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- scene ---------- */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(35, 1, .1, 100), HALF_H = 3;
  cam.position.set(0, 0, HALF_H / Math.tan(THREE.MathUtils.degToRad(17.5)));
  scene.add(new THREE.AmbientLight(0xffffff, .5));
  const sun = new THREE.DirectionalLight(0xffffff, .75); sun.position.set(3, 5, 6); scene.add(sun);
  const glow = new THREE.PointLight(0xffffff, 1.1, 6); glow.position.set(0, 0, 2.5); scene.add(glow);   // follows the cursor, makes the glossy highlights
  scene.background = new THREE.Color(0x111216);                                                                       // same as the card's CSS background (sleek dark stone)
  window.setTechCardColor = hex => { scene.background.set(hex); card.style.background = hex; };                  // change the card colour (scene + CSS) in one call

  /* ---------- liquid effect: a cursor-driven flow field bends the whole scene, with rainbow edges ---------- */
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)), quadScene = new THREE.Scene();
  quad.frustumCulled = false; quadScene.add(quad);
  const qv = "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }";
  const post = renderer.capabilities.isWebGL2;                                                                         // needs float render targets
  let sceneRT = null, flowA = null, flowB = null;
  const flowOpts = { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
  const simMat = new THREE.ShaderMaterial({                       // the flow field: the cursor pushes and swirls it, it spreads out and fades
    vertexShader: qv, depthTest: false, depthWrite: false,
    uniforms: { tPrev: { value: null }, uMouse: { value: new THREE.Vector2(.5, .5) }, uVel: { value: new THREE.Vector2() }, uAspect: { value: 3 }, uTexel: { value: new THREE.Vector2(1 / 320, 1 / 112) } },
    fragmentShader: `
      precision highp float; varying vec2 vUv;
      uniform sampler2D tPrev; uniform vec2 uMouse, uVel, uTexel; uniform float uAspect;
      void main(){
        vec2 v  = texture2D(tPrev, vUv).xy;
        vec2 pv = texture2D(tPrev, vUv - v * 0.5).xy;
        vec2 avg = (texture2D(tPrev, vUv + vec2(uTexel.x,0.)).xy + texture2D(tPrev, vUv - vec2(uTexel.x,0.)).xy
                  + texture2D(tPrev, vUv + vec2(0.,uTexel.y)).xy + texture2D(tPrev, vUv - vec2(0.,uTexel.y)).xy) * 0.25;
        v = mix(pv, avg, 0.22) * 0.965;
        vec2 d = (vUv - uMouse) * vec2(uAspect, 1.0);
        float s = exp(-dot(d, d) / 0.0006);                          // size of the liquid circle around the cursor (smaller number = smaller circle)
        v += (uVel + vec2(-uVel.y, uVel.x) * 0.35) * s * 7.0;
        float l = length(v); if (l > 0.12) v *= 0.12 / l;
        gl_FragColor = vec4(v, 0.0, 1.0);
      }`
  });
  const liquidMat = new THREE.ShaderMaterial({                    // draws the scene through the flow: refraction + colour split + a thin rainbow edge
    vertexShader: qv, depthTest: false, depthWrite: false,
    uniforms: { tScene: { value: null }, tFlow: { value: null }, uStr: { value: .9 } },
    fragmentShader: `
      precision highp float; varying vec2 vUv;
      uniform sampler2D tScene, tFlow; uniform float uStr;
      void main(){
        vec2 f = texture2D(tFlow, vUv).xy;
        float m = length(f);
        vec2 off = f * uStr;
        float ca = 0.0;                                                  // no colour split: the liquid stays white
        vec3 c;
        c.r = texture2D(tScene, vUv - off * (1.0 + ca)).r;
        c.g = texture2D(tScene, vUv - off).g;
        c.b = texture2D(tScene, vUv - off * (1.0 - ca)).b;
        float ang = atan(f.y, f.x);
        vec3 irid = vec3(1.0);                                          // white liquid edge
        float body = smoothstep(0.004, 0.03, m);
        float rim = smoothstep(0.006, 0.02, m) * (1.0 - smoothstep(0.03, 0.09, m));
        c = clamp(mix(c, c * 0.85 + irid * 0.25, body * 0.6) + irid * rim * 0.55, 0.0, 1.0);
        c *= 1.0 - rim * 0.12;                                           // a soft grey edge so the white ripple shows on the white card
        gl_FragColor = vec4(c, 1.0);
      }`
  });
  function buildPost() {
    if (!post) return;
    const v = renderer.getDrawingBufferSize(new THREE.Vector2());
    if (sceneRT) sceneRT.dispose();
    sceneRT = new THREE.WebGLRenderTarget(v.x, v.y, { samples: 4, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    if (!flowA) { flowA = new THREE.WebGLRenderTarget(320, 112, flowOpts); flowB = new THREE.WebGLRenderTarget(320, 112, flowOpts); }
    simMat.uniforms.uAspect.value = cam.aspect;
  }

  /* ---------- the icons, drawn with canvas (256 x 256 each) ---------- */
  const SANS = '"Arial Black", Helvetica, Arial, sans-serif', MONO = '"Courier New", monospace';
  const T = (g, s, x, y, size, col, al = "center", font = SANS) => { g.fillStyle = col; g.font = "800 " + size + "px " + font; g.textAlign = al; g.textBaseline = "alphabetic"; g.fillText(s, x, y); };
  const E = (g, ch, x, y, size) => { g.font = size + 'px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(ch, x, y); };
  const poly = (g, pts, col) => { g.fillStyle = col; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fill(); };
  const shield = (g, a, b, n) => { poly(g, [[48, 30], [208, 30], [194, 196], [128, 226], [62, 196]], a); poly(g, [[128, 42], [196, 42], [184, 186], [128, 208]], b); T(g, n, 128, 158, 118, "#fff"); };
  const ICONS = [
    { bg: "#eceef5", draw: g => shield(g, "#E44D26", "#F16529", "5") },                                   // HTML5
    { bg: "#eceef5", draw: g => shield(g, "#1572B6", "#33A9DC", "3") },                                   // CSS3
    { bg: "#F7DF1E", draw: g => T(g, "JS", 228, 226, 112, "#111", "right") },                              // JavaScript
    { bg: "#3178C6", draw: g => T(g, "TS", 228, 226, 112, "#fff", "right") },                              // TypeScript
    { bg: "#20232A", draw: g => { g.strokeStyle = "#61DAFB"; g.lineWidth = 9; [0, 60, 120].forEach(a => { g.beginPath(); g.ellipse(128, 128, 88, 33, a * Math.PI / 180, 0, 7); g.stroke(); }); g.fillStyle = "#61DAFB"; g.beginPath(); g.arc(128, 128, 15, 0, 7); g.fill(); } },   // React
    { bg: "#eceef5", draw: g => { poly(g, [[128, 28], [212, 78], [212, 178], [128, 228], [44, 178], [44, 78]], "#3C873A"); T(g, "N", 128, 164, 110, "#fff"); } },   // Node.js
    { bg: "#000000", draw: g => { g.fillStyle = "#fff"; g.beginPath(); g.arc(128, 128, 86, 0, 7); g.fill(); T(g, "N", 128, 164, 108, "#000"); } },   // Next.js
    { bg: "#0F172A", draw: g => { g.strokeStyle = "#38BDF8"; g.lineWidth = 22; g.lineCap = "round"; [0, 60].forEach(o => { g.beginPath(); g.moveTo(44, 110 + o); g.bezierCurveTo(70, 62 + o, 112, 62 + o, 128, 100 + o); g.bezierCurveTo(144, 138 + o, 186, 138 + o, 212, 90 + o); g.stroke(); }); } },   // Tailwind
    { bg: "#eceef5", draw: g => { g.save(); g.translate(128, 128); g.rotate(Math.PI / 4); g.fillStyle = "#F05033"; g.fillRect(-72, -72, 144, 144); g.restore(); g.strokeStyle = "#fff"; g.lineWidth = 10; g.beginPath(); g.moveTo(98, 98); g.lineTo(150, 150); g.moveTo(128, 70); g.lineTo(128, 128); g.stroke(); g.fillStyle = "#fff"; [[128, 70], [98, 98], [150, 150], [128, 128]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 14, 0, 7); g.fill(); }); } },   // Git
    { bg: "#0d1117", draw: g => { g.fillStyle = "#fff"; g.beginPath(); g.arc(128, 136, 80, 0, 7); g.fill(); poly(g, [[68, 76], [96, 98], [68, 112]], "#fff"); poly(g, [[188, 76], [160, 98], [188, 112]], "#fff"); g.fillStyle = "#0d1117"; g.beginPath(); g.arc(104, 130, 9, 0, 7); g.arc(152, 130, 9, 0, 7); g.fill(); } },   // GitHub
    { bg: "#eceef5", draw: g => T(g, "ex", 128, 164, 120, "#111", "center", MONO) },                       // Express
    { bg: "#00618A", draw: g => T(g, "MySQL", 128, 148, 62, "#fff") },                                      // MySQL
    { bg: "#0AE448", draw: g => T(g, "GSAP", 128, 148, 66, "#0b0b0b") },                                    // GSAP
    { bg: "#000000", draw: g => poly(g, [[62, 46], [194, 46], [194, 112], [128, 112], [194, 178], [128, 178], [128, 210], [62, 144]], "#fff") },   // Framer Motion
    { bg: "#000000", draw: g => poly(g, [[128, 56], [214, 200], [42, 200]], "#fff") },                      // Vercel
    { bg: "#1E1E1E", draw: g => { g.strokeStyle = "#29A9EB"; g.lineWidth = 22; g.lineCap = "round"; g.lineJoin = "round"; g.beginPath(); g.moveTo(92, 66); g.lineTo(44, 128); g.lineTo(92, 190); g.moveTo(164, 66); g.lineTo(212, 128); g.lineTo(164, 190); g.stroke(); g.lineWidth = 14; g.beginPath(); g.moveTo(140, 62); g.lineTo(116, 194); g.stroke(); } },   // VS Code
    { bg: "#FF6C37", draw: g => { g.fillStyle = "#fff"; g.beginPath(); g.arc(128, 128, 80, 0, 7); g.fill(); T(g, "P", 128, 166, 112, "#FF6C37"); } },   // Postman
    { bg: "#171a26", draw: g => { const gr = g.createLinearGradient(40, 40, 216, 216); gr.addColorStop(0, "#4285F4"); gr.addColorStop(.55, "#9B72CB"); gr.addColorStop(1, "#D96570"); g.fillStyle = gr; g.beginPath(); g.moveTo(128, 28); g.quadraticCurveTo(138, 118, 228, 128); g.quadraticCurveTo(138, 138, 128, 228); g.quadraticCurveTo(118, 138, 28, 128); g.quadraticCurveTo(118, 118, 128, 28); g.fill(); } },   // Gemini
    { bg: "#202123", draw: g => T(g, "GPT", 128, 152, 80, "#10A37F") },                                       // Custom GPT
    { bg: "#eceef5", draw: g => { T(g, "{ }", 128, 150, 118, "#111", "center", MONO); T(g, "API", 128, 206, 40, "#3178C6"); } },   // REST APIs
    { bg: "#eceef5", draw: g => { g.strokeStyle = "#111"; g.lineWidth = 11; g.lineJoin = "round"; g.beginPath(); g.moveTo(128, 40); g.lineTo(210, 196); g.lineTo(46, 196); g.closePath(); g.moveTo(128, 96); g.lineTo(168, 172); g.lineTo(88, 172); g.closePath(); g.stroke(); } },   // Three.js
    { bg: "#CB3837", draw: g => T(g, "npm", 128, 150, 84, "#fff") },                                        // npm
    { bg: "#0E1E25", draw: g => { g.save(); g.translate(128, 128); g.rotate(Math.PI / 4); g.fillStyle = "#00C7B7"; g.fillRect(-62, -62, 124, 124); g.restore(); g.fillStyle = "#0E1E25"; g.beginPath(); g.arc(128, 128, 22, 0, 7); g.fill(); } },   // Netlify
    /* ---- AI platforms (simplified marks) ---- */
    { bg: "#F0EEE6", draw: g => { g.strokeStyle = "#D97757"; g.lineWidth = 17; g.lineCap = "round"; for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6, r1 = i % 2 ? 66 : 88; g.beginPath(); g.moveTo(128 + Math.cos(a) * 18, 128 + Math.sin(a) * 18); g.lineTo(128 + Math.cos(a) * r1, 128 + Math.sin(a) * r1); g.stroke(); } } },   // Claude
    { bg: "#10A37F", draw: g => { g.strokeStyle = "#fff"; g.lineWidth = 12; for (let i = 0; i < 6; i++) { g.save(); g.translate(128, 128); g.rotate(i * Math.PI / 3); g.beginPath(); g.ellipse(0, -44, 32, 62, 0, 0, 7); g.stroke(); g.restore(); } } },   // ChatGPT
    { bg: "#101426", draw: g => { const gr = g.createLinearGradient(40, 220, 216, 40); gr.addColorStop(0, "#4285F4"); gr.addColorStop(.5, "#9B72CB"); gr.addColorStop(1, "#FBBC04"); g.strokeStyle = gr; g.lineWidth = 26; g.lineCap = "round"; g.lineJoin = "round"; g.beginPath(); g.moveTo(56, 206); g.quadraticCurveTo(100, 150, 128, 50); g.quadraticCurveTo(156, 150, 200, 206); g.stroke(); g.lineWidth = 16; g.beginPath(); g.moveTo(92, 152); g.quadraticCurveTo(128, 120, 164, 152); g.stroke(); } },   // Antigravity
    { bg: "#1B1F23", draw: g => { g.strokeStyle = "#20B8CD"; g.lineWidth = 11; g.lineJoin = "round"; g.beginPath(); g.moveTo(128, 30); g.lineTo(196, 90); g.lineTo(196, 150); g.lineTo(128, 226); g.lineTo(60, 150); g.lineTo(60, 90); g.closePath(); g.moveTo(128, 30); g.lineTo(128, 226); g.moveTo(60, 90); g.lineTo(196, 150); g.moveTo(196, 90); g.lineTo(60, 150); g.stroke(); } },   // Perplexity
    { bg: "#1F2328", draw: g => { g.fillStyle = "#fff"; g.beginPath(); g.ellipse(128, 138, 78, 66, 0, 0, 7); g.fill(); g.beginPath(); g.arc(70, 90, 22, 0, 7); g.fill(); g.beginPath(); g.arc(186, 90, 22, 0, 7); g.fill(); g.fillStyle = "#1F2328"; g.beginPath(); g.ellipse(100, 138, 12, 20, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(156, 138, 12, 20, 0, 0, 7); g.fill(); } },   // GitHub Copilot
    { bg: "#14120B", draw: g => { poly(g, [[128, 34], [210, 82], [210, 174], [128, 222], [46, 174], [46, 82]], "#EDECEC"); poly(g, [[128, 128], [210, 82], [128, 34]], "#BDBBBB"); poly(g, [[128, 128], [128, 222], [46, 174]], "#9C9A9A"); } },   // Cursor
    { bg: "#4D6BFE", draw: g => { g.fillStyle = "#fff"; g.beginPath(); g.ellipse(120, 140, 82, 52, -.1, 0, 7); g.fill(); poly(g, [[190, 120], [232, 84], [226, 140]], "#fff"); g.fillStyle = "#4D6BFE"; g.beginPath(); g.arc(78, 128, 8, 0, 7); g.fill(); } },   // DeepSeek
    { bg: "#000000", draw: g => { g.strokeStyle = "#fff"; g.lineWidth = 16; g.lineCap = "round"; g.beginPath(); g.arc(120, 136, 62, 0, 7); g.stroke(); g.beginPath(); g.moveTo(92, 214); g.lineTo(204, 56); g.stroke(); } },   // Grok
    { bg: "#FA520F", draw: g => { g.fillStyle = "#111"; [[0, 0], [4, 0], [0, 1], [1, 1], [3, 1], [4, 1], [0, 2], [2, 2], [4, 2], [0, 3], [4, 3], [0, 4], [4, 4]].forEach(([x, y]) => g.fillRect(40 + x * 36, 52 + y * 36, 34, 34)); } },   // Mistral
    { bg: "#FFD21E", draw: g => E(g, "\u{1F917}", 128, 140, 150) },                                         // Hugging Face
    { bg: "#eceef5", draw: g => { g.fillStyle = "#111"; g.strokeStyle = "#111"; g.lineWidth = 12; g.lineJoin = "round"; g.beginPath(); g.moveTo(74, 100); g.lineTo(80, 36); g.lineTo(112, 70); g.moveTo(182, 100); g.lineTo(176, 36); g.lineTo(144, 70); g.stroke(); g.beginPath(); g.ellipse(128, 146, 62, 70, 0, 0, 7); g.stroke(); g.beginPath(); g.arc(106, 136, 8, 0, 7); g.fill(); g.beginPath(); g.arc(150, 136, 8, 0, 7); g.fill(); g.beginPath(); g.ellipse(128, 176, 22, 14, 0, 0, 7); g.fill(); } },   // Ollama
    { bg: "#0866FF", draw: g => T(g, "\u221E", 128, 176, 170, "#fff") },                                    // Meta AI / Llama
    { bg: "#1C3C3C", draw: g => { E(g, "\u{1F99C}", 98, 128, 104); E(g, "\u{1F517}", 168, 176, 76); } }   // LangChain
  ];
  function iconTexture(ic) {
    const c = document.createElement("canvas"); c.width = c.height = 256;
    const g = c.getContext("2d"); g.fillStyle = ic.bg; g.fillRect(0, 0, 256, 256); ic.draw(g);
    const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
  }

  /* ---------- chunky rounded tile ---------- */
  function tileGeometry(r = .2, depth = .34) {
    const s = new THREE.Shape(), a = -.5, b = .5;
    s.moveTo(a + r, a); s.lineTo(b - r, a); s.quadraticCurveTo(b, a, b, a + r); s.lineTo(b, b - r); s.quadraticCurveTo(b, b, b - r, b);
    s.lineTo(a + r, b); s.quadraticCurveTo(a, b, a, b - r); s.lineTo(a, a + r); s.quadraticCurveTo(a, a, a + r, a);
    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: .035, bevelSize: .035, bevelSegments: 3, curveSegments: 10 });
    g.translate(0, 0, -depth / 2);
    const pos = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) + .5, pos.getY(i) + .5);   // the front face shows the icon texture
    return g;
  }
  const geo = tileGeometry(), mats = ICONS.map(ic => {
    const col = new THREE.Color(ic.bg);
    return [new THREE.MeshPhysicalMaterial({ map: iconTexture(ic), roughness: .32, clearcoat: .8, clearcoatRoughness: .2 }),
            new THREE.MeshPhysicalMaterial({ color: col, roughness: .38, clearcoat: .6, clearcoatRoughness: .25 })];
  });

  /* ---------- bodies ---------- */
  const rnd = (a, b) => a + Math.random() * (b - a), bodies = [];
  let halfW = 5, edge = 1;
  for (let i = 0; i < CFG.count; i++) {
    const mesh = new THREE.Mesh(geo, mats[i < ICONS.length ? i : (Math.random() * ICONS.length) | 0]);
    mesh.quaternion.setFromEuler(new THREE.Euler(rnd(-3, 3), rnd(-3, 3), rnd(-3, 3)));
    scene.add(mesh);
    bodies.push({ mesh, p: new THREE.Vector3(rnd(-4, 4), rnd(-2.5, 2.5), rnd(-.4, .4)), v: new THREE.Vector3(rnd(-.4, .4), rnd(-.4, .4), 0), w: new THREE.Vector3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)), r: .5, ph: rnd(0, 6.28), k: rnd(.85, 1.2), hs: 1 });
  }

  function resize() {
    const w = card.clientWidth, h = card.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    cam.aspect = w / h; cam.updateProjectionMatrix();
    halfW = HALF_H * cam.aspect;
    buildPost();
    edge = Math.sqrt(CFG.fill * 4 * halfW * HALF_H / bodies.length);                 // tile size so the tiles cover about CFG.fill of the card
    bodies.forEach(b => { b.mesh.scale.setScalar(edge * b.k); b.r = edge * b.k * .6; });
  }
  new ResizeObserver(resize).observe(card); resize();

  /* ---------- cursor ---------- */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), hit = new THREE.Vector3();
  const ptr = { x: 0, y: 0, lx: 0, ly: 0, vx: 0, vy: 0, on: false };
  const tgtUV = new THREE.Vector2(.5, .5), smoothUV = new THREE.Vector2(.5, .5), lastUV = new THREE.Vector2(.5, .5);
  const meshes = bodies.map(b => b.mesh);
  let held = null;                                                    // the tile that is stuck to the cursor
  function pick() {
    ray.setFromCamera(ndc, cam);
    const hit0 = ray.intersectObjects(meshes, false)[0];
    if (hit0) held = bodies.find(b => b.mesh === hit0.object) || held;
    else if (held && Math.hypot(held.p.x - ptr.x, held.p.y - ptr.y) > held.r * 1.9) held = null;   // the cursor got away from it
    card.style.cursor = held ? "pointer" : "default";
  }
  card.addEventListener("pointermove", e => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, cam);
    if (ray.ray.intersectPlane(plane, hit)) {
      if (!ptr.on) { ptr.lx = hit.x; ptr.ly = hit.y; smoothUV.set((ndc.x + 1) / 2, (ndc.y + 1) / 2); lastUV.copy(smoothUV); }
      ptr.x = hit.x; ptr.y = hit.y; ptr.on = true; tgtUV.set((ndc.x + 1) / 2, (ndc.y + 1) / 2);
      pick();
    }
  }, { passive: true });
  card.addEventListener("pointerleave", () => { ptr.on = false; held = null; card.style.cursor = "default"; });

  /* ---------- physics ---------- */
  const tiltE = new THREE.Euler(), hq = new THREE.Quaternion(), tmp = new THREE.Vector3(), nrm = new THREE.Vector3(), axis = new THREE.Vector3(), dq = new THREE.Quaternion();
  function step(dt, t) {
    ptr.vx += ((ptr.x - ptr.lx) / dt - ptr.vx) * .3; ptr.vy += ((ptr.y - ptr.ly) / dt - ptr.vy) * .3; ptr.lx = ptr.x; ptr.ly = ptr.y;
    if (!ptr.on) { ptr.vx *= .9; ptr.vy *= .9; }
    const gathering = !(held && ptr.on);                              // no icon under the cursor (or the cursor is outside the card): everything gathers in the middle
    const R = CFG.cursorRadius * Math.max(.8, edge / 1.1), drift = (reduce ? 0 : CFG.drift) * (gathering ? .35 : 1);
    if (ptr.on && !held) pick();                                       // a tile drifted under a still cursor
    for (const b of bodies) {
      const isHeld = b === held && ptr.on;
      b.hs += ((isHeld ? 1.18 : 1) - b.hs) * (1 - Math.exp(-10 * dt)); b.mesh.scale.setScalar(edge * b.k * b.hs);
      if (isHeld) {                                                    // spring to the cursor, face the camera, lean into the movement
        const kk = (1 - Math.exp(-CFG.followSpeed * dt)) / (dt * Math.exp(-.9 * dt));                // jump most of the way to the cursor every frame
        b.v.set((ptr.x - b.p.x) * kk, (ptr.y - b.p.y) * kk, (.85 - b.p.z) * kk);
        b.w.multiplyScalar(Math.exp(-8 * dt));
        hq.setFromEuler(tiltE.set(-b.v.y * .012, b.v.x * .012, 0)); b.mesh.quaternion.slerp(hq, 1 - Math.exp(-12 * dt));
      } else {
      b.v.x += Math.sin(t * .5 + b.ph) * drift * dt; b.v.y += Math.cos(t * .43 + b.ph * 1.3) * drift * dt; b.v.z -= b.p.z * 1.6 * dt;     // wander, stay near the middle depth
      if (ptr.on && !gathering) {                                      // while one icon is held, the others make way for it
        const dx = b.p.x - ptr.x, dy = b.p.y - ptr.y, d = Math.hypot(dx, dy);
        if (d < R && d > 1e-4) {
          const f = (1 - d / R) * (1 - d / R), nx = dx / d, ny = dy / d;
          b.v.x += (nx * CFG.pushForce - ny * CFG.swirl) * f * dt + ptr.vx * f * .04;               // shove away + swirl + follow a flick
          b.v.y += (ny * CFG.pushForce + nx * CFG.swirl) * f * dt + ptr.vy * f * .04;
          b.v.z += f * 4 * dt * (b.ph > 3 ? 1 : -1);
          b.w.x += ny * f * 22 * dt; b.w.y -= nx * f * 22 * dt; b.w.z += f * 8 * dt * (b.ph > 3 ? 1 : -1);   // tumble
        }
      }
      }
      if (gathering) { b.v.x -= b.p.x * CFG.gatherX * dt; b.v.y -= b.p.y * CFG.gatherY * dt; b.v.multiplyScalar(Math.exp(-CFG.gatherDamp * dt)); }   // pull to the middle
      b.v.multiplyScalar(Math.exp(-.9 * dt)); b.w.multiplyScalar(Math.exp(-.55 * dt));
      b.p.addScaledVector(b.v, dt);
      const l = b.w.length();
      if (l > 1e-5) { dq.setFromAxisAngle(axis.copy(b.w).divideScalar(l), l * dt); b.mesh.quaternion.premultiply(dq).normalize(); }
      const bx = halfW - b.r * .45, by = HALF_H - b.r * .45;                                          // walls
      if (b.p.x > bx) { b.p.x = bx; b.v.x *= -CFG.bounce; } else if (b.p.x < -bx) { b.p.x = -bx; b.v.x *= -CFG.bounce; }
      if (b.p.y > by) { b.p.y = by; b.v.y *= -CFG.bounce; } else if (b.p.y < -by) { b.p.y = -by; b.v.y *= -CFG.bounce; }
      b.p.z = Math.max(-.9, Math.min(.9, b.p.z));
    }
    for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {            // tile-to-tile collisions
      const a = bodies[i], c = bodies[j], min = a.r + c.r;
      nrm.subVectors(c.p, a.p); const d = nrm.length();
      if (d >= min || d < 1e-5) continue;
      nrm.divideScalar(d);
      const ma = a.r * a.r, mc = c.r * c.r, push = min - d;
      a.p.addScaledVector(nrm, -push * mc / (ma + mc)); c.p.addScaledVector(nrm, push * ma / (ma + mc));
      const vn = tmp.subVectors(c.v, a.v).dot(nrm);
      if (vn < 0) {
        const imp = -(1 + CFG.bounce) * vn / (1 / ma + 1 / mc);
        a.v.addScaledVector(nrm, -imp / ma); c.v.addScaledVector(nrm, imp / mc);
        a.w.x += rnd(-1, 1) * -vn * .8; a.w.y += rnd(-1, 1) * -vn * .8; c.w.x += rnd(-1, 1) * -vn * .8; c.w.y += rnd(-1, 1) * -vn * .8;   // a bump sets them spinning
      }
    }
    bodies.forEach(b => b.mesh.position.copy(b.p));
    glow.position.set(ptr.x, ptr.y, 2.5);
  }

  /* ---------- loop (only while the card is on screen) ---------- */
  let raf = 0, last = 0, visible = true;
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000 || .016, .033); last = now;
    step(dt, now / 1000);
    if (post && sceneRT) {
      renderer.setRenderTarget(sceneRT); renderer.render(scene, cam);                       // 1) the 3D scene
      smoothUV.lerp(tgtUV, .25);                                                            // 2) update the flow field with the cursor movement
      simMat.uniforms.uMouse.value.copy(smoothUV);
      simMat.uniforms.uVel.value.set(smoothUV.x - lastUV.x, smoothUV.y - lastUV.y).multiplyScalar(ptr.on ? 1 : 0);
      lastUV.copy(smoothUV);
      quad.material = simMat; simMat.uniforms.tPrev.value = flowA.texture;
      renderer.setRenderTarget(flowB); renderer.render(quadScene, quadCam);
      const sw = flowA; flowA = flowB; flowB = sw;
      quad.material = liquidMat; liquidMat.uniforms.tScene.value = sceneRT.texture; liquidMat.uniforms.tFlow.value = flowA.texture;   // 3) the scene seen through the flow
      renderer.setRenderTarget(null); renderer.render(quadScene, quadCam);
    } else renderer.render(scene, cam);
  }
  const run = () => { if (!raf && visible && !document.hidden && !document.body.classList.contains("intro")) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  const halt = () => { cancelAnimationFrame(raf); raf = 0; };
  new IntersectionObserver(es => { visible = es[0].isIntersecting; visible ? run() : halt(); }).observe(card);
  document.addEventListener("visibilitychange", () => { document.hidden ? halt() : run(); });
  run();
  document.addEventListener("intro:reveal", () => { resize(); requestAnimationFrame(run); }, { once: true });   // start moving once the intro hands over to the website
})();
