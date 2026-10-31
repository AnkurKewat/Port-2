/* =====================================================================
   FLUID DISTORTION BACKGROUND  (Three.js r128)
   Needs: <canvas id="fluid-bg"></canvas> + the CSS for #fluid-bg
   Starts after the loader fires "loader:done" (or instantly if no loader)
   ===================================================================== */
(() => {
  const COLORS = { bg: "#050505", orange: "#FFFFFF", ember: "#FFFFFF" }; // black background + white cursor glow (names are just the two colour slots)
  const CFG = {
    simSize: 256,      // resolution of the flow simulation
    radius: 0.06,      // size of the orange circle around the cursor
    force: 7.0,        // how hard the mouse pushes the fluid
    decay: 0.972,      // how long the trail lives (0.95 short .. 0.99 long)
    distortion: 9.0,   // how much the flow warps the pattern
    orangeAmount: 1.1,  // 0..1.5 (brightness of the orange)
    emberAmount: 1.0     // 0..1.5
  };

  const canvas = document.getElementById("fluid-bg");
  if (!canvas || !window.THREE) return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setClearColor(COLORS.bg);

  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quadGeo = new THREE.PlaneGeometry(2, 2);
  const vert = "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }";

  /* ---- flow simulation (ping-pong render targets) ---- */
  const rtOpts = { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
  let rtA = new THREE.WebGLRenderTarget(CFG.simSize, CFG.simSize, rtOpts);
  let rtB = new THREE.WebGLRenderTarget(CFG.simSize, CFG.simSize, rtOpts);

  const simMat = new THREE.ShaderMaterial({
    vertexShader: vert,
    uniforms: {
      tPrev: { value: null }, uMouse: { value: new THREE.Vector2(.5, .5) }, uVel: { value: new THREE.Vector2() },
      uAspect: { value: 1 }, uRadius: { value: CFG.radius }, uForce: { value: CFG.force },
      uDecay: { value: CFG.decay }, uTexel: { value: new THREE.Vector2(1 / CFG.simSize, 1 / CFG.simSize) }
    },
    fragmentShader: `
      precision highp float;
      varying vec2 vUv;
      uniform sampler2D tPrev; uniform vec2 uMouse, uVel, uTexel;
      uniform float uAspect, uRadius, uForce, uDecay;
      void main(){
        vec2 v  = texture2D(tPrev, vUv).xy;
        vec2 pv = texture2D(tPrev, vUv - v * 0.5).xy;               // advect
        vec2 avg = ( texture2D(tPrev, vUv + vec2(uTexel.x,0.)).xy + texture2D(tPrev, vUv - vec2(uTexel.x,0.)).xy
                   + texture2D(tPrev, vUv + vec2(0.,uTexel.y)).xy + texture2D(tPrev, vUv - vec2(0.,uTexel.y)).xy ) * 0.25;
        v = mix(pv, avg, 0.22) * uDecay;                               // diffuse + decay
        vec2 d = (vUv - uMouse) * vec2(uAspect, 1.0);
        float s = exp(-dot(d, d) / (uRadius * uRadius));
        v += (uVel + vec2(-uVel.y, uVel.x) * 0.35) * s * uForce;       // push + swirl
        float l = length(v); if (l > 0.12) v *= 0.12 / l;
        gl_FragColor = vec4(v, 0.0, 1.0);
      }`,
    depthTest: false, depthWrite: false
  });

  /* ---- display shader ---- */
  const col = c => new THREE.Color(c);
  const showMat = new THREE.ShaderMaterial({
    vertexShader: vert,
    uniforms: {
      tFlow: { value: null }, uTime: { value: 0 }, uAspect: { value: 1 },
      uBg: { value: col(COLORS.bg) }, uOrange: { value: col(COLORS.orange) }, uEmber: { value: col(COLORS.ember) },
      uDist: { value: CFG.distortion }, uP: { value: CFG.orangeAmount }, uC: { value: CFG.emberAmount }
    },
    fragmentShader: `
      precision highp float;
      varying vec2 vUv;
      uniform sampler2D tFlow; uniform vec3 uBg, uOrange, uEmber;
      uniform float uTime, uAspect, uDist, uP, uC;
      float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      float noise(vec2 p){
        vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y);
      }
      float fbm(vec2 p){ float a = .5, r = 0.; for(int i=0;i<5;i++){ r += a*noise(p); p = p*2.02 + 7.3; a *= .5; } return r; }
      void main(){
        vec2 f = texture2D(tFlow, vUv).xy * uDist;
        float m = length(f);
        // pure black background - only the cursor stirs anything
        float pm = smoothstep(.1, 1.4, m) * .75;               // soft glow around the cursor
        vec3 c = mix(uBg, uOrange, clamp(pm * uP, 0., 1.));
        float hot = smoothstep(.9, 2.4, m);                    // bright core where the cursor moves fast
        c = mix(c, uEmber, clamp(hot * .85 * uC, 0., 1.));

        // vignette
        vec2 u = vUv - .5;
        c *= 1.0 - dot(u, u) * .9;
        gl_FragColor = vec4(c, 1.0);
      }`,
    depthTest: false, depthWrite: false
  });

  const mesh = new THREE.Mesh(quadGeo, simMat);
  mesh.frustumCulled = false;
  const scene = new THREE.Scene(); scene.add(mesh);

  /* ---- mouse / touch tracking ---- */
  const target = new THREE.Vector2(.5, .5), smooth = new THREE.Vector2(.5, .5), last = new THREE.Vector2(.5, .5);
  let touched = false, lastMove = 0;
  const setTarget = (x, y) => { target.set(x / innerWidth, 1 - y / innerHeight);
    if (!touched) { smooth.copy(target); last.copy(target); }
    touched = true; lastMove = performance.now(); };
  addEventListener("pointermove", e => setTarget(e.clientX, e.clientY), { passive: true });
  addEventListener("pointerdown", e => setTarget(e.clientX, e.clientY), { passive: true });

  /* ---- sizing ---- */
  function resize(){
    renderer.setSize(innerWidth, innerHeight, false);
    const a = innerWidth / innerHeight;
    simMat.uniforms.uAspect.value = a; showMat.uniforms.uAspect.value = a;
  }
  addEventListener("resize", resize); resize();

  /* ---- loop ---- */
  let raf = 0, running = false, drift = 0, idleFrames = 0, off = false;
    function frame(){
    raf = requestAnimationFrame(frame);
    // nothing to draw until the user moves, and once the trail has faded
    if (!touched && idleFrames++ > 5) return;
    if (touched && performance.now() - lastMove > 5000) return;
    const now = performance.now();

    smooth.lerp(target, .22);
    const vel = simMat.uniforms.uVel.value.set(smooth.x - last.x, smooth.y - last.y);
    last.copy(smooth);
    drift += vel.length() * 8.0;           // pattern only evolves while the cursor moves
    const time = drift;
    simMat.uniforms.uMouse.value.copy(smooth);

    // 1) update flow  2) draw
    mesh.material = simMat;
    simMat.uniforms.tPrev.value = rtA.texture;
    renderer.setRenderTarget(rtB); renderer.render(scene, cam);
    [rtA, rtB] = [rtB, rtA];

    mesh.material = showMat;
    showMat.uniforms.tFlow.value = rtA.texture;
    showMat.uniforms.uTime.value = time;
    renderer.setRenderTarget(null); renderer.render(scene, cam);
  }
  function start(){ if (running || off) return; running = true; canvas.classList.add("on"); frame(); }
  function stop(){ running = false; cancelAnimationFrame(raf); }
  document.addEventListener("intro:reveal", () => { off = true; stop(); canvas.style.display = "none"; });   // the website has its own background
  document.addEventListener("visibilitychange", () => { document.hidden ? stop() : (running = false, start()); });

  // reduced motion: render once, no animation
  if (reduce) { simMat.uniforms.uVel.value.set(0,0); }

  // start with the site (after the loader), or immediately if there is no loader
  if (document.getElementById("loader")) document.addEventListener("loader:done", start, { once: true });
  else start();
})();
