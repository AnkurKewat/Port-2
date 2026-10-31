/* =====================================================================
   "BOLD IDEAS" SCROLL SECTION  (Three.js r128)
   A tall section with a pinned stage. As you scroll:
   1) a thick blue pipe grows in from the left, weaves in front of and behind the card, and sweeps off to the right
   2) the video card (starts small, blue-tinted) rises, bends like a banner as the pipe threads it,
      then grows into a wide card; the video loses its tint and "PLAY REEL" appears over it
   3) the pipe retracts off screen. Clicking PLAY REEL opens the video with sound.
   Needs: #bold > .stage > canvas, .head, .copy, button.reel  and  <video id="reel-video">
   ===================================================================== */
(() => {
  const CFG = {
    pipeRadius: 0.15,   // thickness of the blue pipe
    pipeFrom: "#1f22ff", pipeTo: "#6d8bff",   // colour at the start and the end of the pipe
    cardStart: 0.27,    // starting card width (fraction of the screen width)
    cardEnd: 0.90,      // final card width
    wave: 1.0,          // how much the card ripples while it comes down (0 = none, 1.5 = very wavy)
    sway: 0.07,         // how far the card snakes from side to side (fraction of the screen width)
    smooth: 9           // how soft the motion follows your scroll (higher = tighter)
  };
  const sec = document.getElementById("bold");
  if (!sec || !window.THREE) return;
  const stage = sec.querySelector(".stage"), canvas = stage.querySelector("canvas");
  const head = stage.querySelector(".head"), copy = stage.querySelector(".copy"), reelBtn = stage.querySelector(".reel"), hint = stage.querySelector(".bold-hint");
  const video = document.getElementById("reel-video");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x)), lerp = (a, b, t) => a + (b - a) * t;
  const sm = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }, seg = (p, a, b) => clamp((p - a) / (b - a), 0, 1);

  /* "Bold Ideas," rises out of the "Brought to Life" line as the section scrolls into view */
  const l1s = stage.querySelector(".l1-shift");
  let es = 0;
  const entry = () => clamp(1 - sec.getBoundingClientRect().top / innerHeight, 0, 1);
  const setL1 = k => { if (l1s) l1s.style.transform = "translate3d(0," + ((1 - k) * 115) + "%,0)"; };
  setL1(0);

  /* ---------- scene ---------- */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
  document.addEventListener("perf:lite", () => { renderer.setPixelRatio(1); resize(); }, { once: true });
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, .1, 100), HALF_H = 3;
  cam.position.set(0, 0, HALF_H / Math.tan(THREE.MathUtils.degToRad(15)));
  scene.add(new THREE.AmbientLight(0xffffff, .85));
  const sun = new THREE.DirectionalLight(0xffffff, .9); sun.position.set(-3, 4, 6); scene.add(sun);

  /* ---------- video card ---------- */
  video.muted = true; video.loop = true; video.playsInline = true;
  const tex = new THREE.VideoTexture(video); tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  const play = () => { const p = video.play(); if (p && p.catch) p.catch(() => {}); };
  play(); document.addEventListener("pointerdown", play, { once: true }); document.addEventListener("scroll", play, { once: true, passive: true });
  const cardMat = new THREE.ShaderMaterial({
    transparent: true, side: THREE.DoubleSide,
    uniforms: { uMap: { value: tex }, uTint: { value: 1 }, uBend: { value: 0 }, uWave: { value: 0 }, uAspect: { value: 1.75 }, uVid: { value: 16 / 9 }, uTime: { value: 0 } },
    vertexShader: `
      varying vec2 vUv; uniform float uBend, uWave, uTime;
      void main(){
        vUv = uv; vec3 p = position; float a = uv.x - .5;
        p.z += uBend * (0.9 - 3.6 * a * a) * 0.55;                               // bows the card like a banner
        p.y += uBend * (a * 0.28 + sin(uv.x * 3.14159) * 0.1);                   // lifts one side
        p.y += uBend * sin(uv.x * 5.0 + uTime * 1.2) * 0.02;                      // a little ripple
        p.z += uWave * (sin(uv.x * 5.0 - uTime * 2.2) * 0.55 + sin(uv.y * 4.0 + uTime * 1.7) * 0.3);   // waves rolling through the card while it travels
        p.y += uWave * sin(uv.x * 7.0 + uTime * 2.6) * 0.07;
        p.x += uWave * sin(uv.y * 6.0 - uTime * 2.0) * 0.025;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `
      precision highp float; varying vec2 vUv; uniform sampler2D uMap; uniform float uTint, uAspect, uVid;
      void main(){
        vec2 p = (vUv - .5) * vec2(uAspect, 1.0), b = vec2(uAspect * .5, .5) - 0.035;
        if (length(max(abs(p) - b, 0.0)) - 0.035 > 0.0) discard;                 // rounded corners
        vec2 s = uAspect > uVid ? vec2(1.0, uVid / uAspect) : vec2(uAspect / uVid, 1.0);   // "cover" crop of the video
        vec3 c = texture2D(uMap, (vUv - .5) * s + .5).rgb;
        vec3 duo = mix(vec3(.16, .18, .95), vec3(.78, .78, 1.0), dot(c, vec3(.3, .59, .11)));   // blue-lavender look at the start
        gl_FragColor = vec4(mix(c, duo, uTint), 1.0);
      }`
  });
  const card = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 48, 24), cardMat); card.frustumCulled = false; scene.add(card);
  video.addEventListener("loadedmetadata", () => { if (video.videoWidth) cardMat.uniforms.uVid.value = video.videoWidth / video.videoHeight; });

  /* ---------- the blue pipe ---------- */
  // path as fractions of the half screen size (x, y) and half height (z). z < 0 is behind the card, z > 0 in front of it:
  // every point is behind (z < 0), so the pipe runs behind the video card the whole way
  const PATH = [[-1.2, .78, -.1], [-.75, .82, -.2], [-.35, .62, -.25], [-.08, .22, -.3], [-.14, -.2, -.35], [-.5, -.45, -.4], [-.62, -.62, -.45], [-.25, -.52, -.5], [.15, -.36, -.45], [.5, -.52, -.4], [.82, -.22, -.3], [1.02, -.5, -.2], [1.25, -1.15, -.1]];
  const SEGS = 720, RAD = 20, STEP = RAD * 6, c0 = new THREE.Color(CFG.pipeFrom), c1 = new THREE.Color(CFG.pipeTo);
  const pipeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .3, metalness: 0 });
  const capGeo = new THREE.SphereGeometry(CFG.pipeRadius, 24, 18);
  const capA = new THREE.Mesh(capGeo, new THREE.MeshStandardMaterial({ roughness: .3 })), capB = new THREE.Mesh(capGeo, new THREE.MeshStandardMaterial({ roughness: .3 }));
  capA.frustumCulled = capB.frustumCulled = false; scene.add(capA, capB);
  let halfW = 5, pipe = null, curve = null;
  const pipeColor = (t, out) => out.copy(c0).lerp(c1, Math.pow(t, .9));
  function buildPipe() {
    if (pipe) { scene.remove(pipe); pipe.geometry.dispose(); }
    curve = new THREE.CatmullRomCurve3(PATH.map(([x, y, z]) => new THREE.Vector3(x * halfW, y * HALF_H, z * HALF_H)), false, "centripetal");
    const g = new THREE.TubeGeometry(curve, SEGS, CFG.pipeRadius, RAD, false), col = new Float32Array(g.attributes.position.count * 3), t = new THREE.Color();
    for (let i = 0; i <= SEGS; i++) { pipeColor(i / SEGS, t); for (let k = 0; k <= RAD; k++) { const a = (i * (RAD + 1) + k) * 3; col[a] = t.r; col[a + 1] = t.g; col[a + 2] = t.b; } }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    pipe = new THREE.Mesh(g, pipeMat); pipe.frustumCulled = false; scene.add(pipe);
  }

  /* ---------- size ---------- */
  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
    halfW = HALF_H * cam.aspect; buildPipe();
  }
  new ResizeObserver(resize).observe(stage); resize();

  /* ---------- one frame of the scroll animation, p = 0..1 through the section ---------- */
  function apply(p, time) {
    // pipe: the head runs along the path, later the tail follows it off screen
    const hp = sm(seg(p, .02, .66)), tp = sm(seg(p, .76, 1)) * .995, tail = Math.min(tp, hp);
    const s0 = Math.floor(tail * SEGS), s1 = Math.ceil(hp * SEGS);
    pipe.geometry.setDrawRange(s0 * STEP, Math.max(s1 - s0, 0) * STEP);
    capA.visible = hp > .002 && tail < hp - .002; capB.visible = capA.visible;
    if (capA.visible) { capA.position.copy(curve.getPointAt(tail)); capB.position.copy(curve.getPointAt(hp)); pipeColor(tail, capA.material.color); pipeColor(hp, capB.material.color); }

    // card: rises in from the bottom, then grows into the wide reel card
    const W2 = 2 * halfW, H2 = 2 * HALF_H, k = sm(seg(p, .30, .82)), rise = sm(seg(p, 0, .34));
    const narrow = halfW / HALF_H < .9, cs = narrow ? .52 : CFG.cardStart, ce = narrow ? .94 : CFG.cardEnd, eh = narrow ? .3 : .5;   // phones / portrait: bigger start card, wide-but-short final card
    const w = lerp(cs * W2, ce * W2, k), h = lerp(cs * W2 / 1.75, eh * H2, k);
    card.scale.set(w, h, 1);
    card.position.set(lerp((narrow ? -.02 : -.53) * halfW, 0, k), lerp(-.58 * HALF_H, -.08 * HALF_H, k) - (1 - rise) * 1.25 * HALF_H, 0);
    const bell = Math.sin(Math.PI * seg(p, .26, .93)), ph = seg(p, .26, .93) * Math.PI * 4;   // 0 at both ends, strongest in the middle of the card's trip
    card.position.x += Math.sin(ph) * bell * CFG.sway * halfW; card.position.y += Math.cos(ph) * bell * CFG.sway * .7 * HALF_H;   // the card snakes from side to side as it comes down
    card.rotation.z = -(1 - k) * .05 + Math.sin(ph + 1) * bell * .08;
    const u = cardMat.uniforms; u.uBend.value = Math.sin(Math.PI * seg(p, .22, .9)) * .9; u.uWave.value = bell * CFG.wave; u.uAspect.value = w / h; u.uTint.value = 1 - sm(seg(p, .5, .78)); u.uTime.value = time;

    // text: the heading and paragraph lift away, PLAY REEL appears over the card
    const lift = sm(seg(p, .30, .70)), fade = 1 - sm(seg(p, .5, .72));
    head.style.transform = "translate3d(0," + (-lift * 70) + "vh,0)"; head.style.opacity = fade;
    copy.style.transform = "translate3d(0," + (-lift * 60) + "vh,0)"; copy.style.opacity = fade;
    if (hint) hint.style.opacity = 1 - sm(seg(p, .01, .08));
    const r = sm(seg(p, .64, .84)); reelBtn.style.opacity = r; reelBtn.classList.toggle("on", r > .6);
  }

  /* ---------- loop: only while the section is near the screen ---------- */
  let ps = 0, last = 0, raf = 0;
  const progress = () => { const r = sec.getBoundingClientRect(); return clamp(-r.top / Math.max(r.height - innerHeight, 1), 0, 1); };
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000 || .016, .05); last = now;
    ps += (progress() - ps) * (1 - Math.exp(-dt * (reduce ? 60 : CFG.smooth)));
    es += (entry() - es) * (1 - Math.exp(-dt * (reduce ? 60 : 7)));
    setL1(sm(seg(es, .28, .92)));
    apply(ps, now / 1000); renderer.render(scene, cam);
  }
  new IntersectionObserver(es => { if (es[0].isIntersecting) { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } } else { cancelAnimationFrame(raf); raf = 0; } }, { rootMargin: "60% 0px" }).observe(sec);

  /* ---------- PLAY REEL: open the video with sound ---------- */
  const box = document.createElement("div"); box.className = "lightbox";
  box.innerHTML = '<video controls playsinline></video><button type="button">Close</button>';
  document.body.appendChild(box);
  const bv = box.querySelector("video"), close = () => { box.classList.remove("open"); bv.pause(); };
  reelBtn.addEventListener("click", () => { bv.src = video.currentSrc || video.src; box.classList.add("open"); bv.play().catch(() => {}); });
  box.addEventListener("click", e => { if (e.target !== bv) close(); });
  addEventListener("keydown", e => { if (e.key === "Escape") close(); });
})();
