/* =====================================================================
   RUNNING CHARACTER (an original pixel-art astronaut) - lives on top of the skills marquee
   - patrols along the top edge of the sliding section (run cycle, idle + blink, jump)
   - follows your cursor when it is in the strip above the marquee
   - runs to whichever skill you hover and comments on it
   - click it to make it jump; it thinks a question in a thought bubble, then answers it
   The sprite frames are drawn from the text grids below (no image files).
   Want your own character? Put an image / animated SVG that you have the rights to use in assets/ and set
   data-sprite="assets/your-file.svg" on the .sk-run element in the HTML: it then replaces the astronaut.
   ===================================================================== */
(() => {
  const sec = document.getElementById("skills");
  const run = sec && sec.querySelector(".sk-run");
  if (!run) return;
  const pal = run.querySelector(".sk-pal"), flip = pal.querySelector(".sk-flip"), bub = run.querySelector(".sk-say"), txt = bub.firstElementChild, shadow = run.querySelector(".sk-shadow");
  const band = sec.querySelector(".sk-band");
  let sprite = pal.querySelector(".sk-sprite"), img = null, frz = null;
  const CUSTOM = (run.dataset.sprite || "").trim();
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x)), rand = (a, b) => a + Math.random() * (b - a);
  const MSGS = ["Let's build something awesome.", "Almost at the finish line.", "Psst... hover a skill, I dare you.", "Click me. I can jump!", "Ankur built this whole page. Pretty neat, right?", "Is that Three.js? Yes, it is.", "Careful, these words move fast."];
  const HOVER = [n => n + "? Good taste.", n => "Ooh, " + n + "!", n => n + " is a favourite around here."];
  // the astronaut "thinks" a question in a thought bubble, then answers it itself in a speech bubble
  const QA = [
    ["Is that Framer Motion?", "Nope. Hand-made springs, pure JavaScript."],
    ["How is this pipe drawn?", "Three.js, and it follows your scroll."],
    ["What does Ankur build?", "AI-powered web apps: Gen AI + full stack."],
    ["Can I hire him?", "Yes! Hit the Contact Me button up top."],
    ["Why is the pipe blue?", "It starts blue, then drifts through cyan and green."],
    ["Where am I?", "Right above the skills. Hover a word!"],
    ["What's in the tech stack?", "React, Next.js, Node.js, TypeScript and more."],
    ["Who am I racing?", "The marquee. It never stops."],
    ["Where does this track end?", "It doesn't. Keep scrolling."]
  ];

  /* ---------- sprite ---------- */
  const PAL = {"w": "#f0f3fa", "W": "#b8bed6", "g": "#8a92b0", "v": "#12163a", "c": "#00d8ff", "C": "#78ebff", "b": "#4f56ff", "B": "#343ac4", "k": "#1e2038"};
  const FRAMES = {
 "run0": [
  "..............",
  "..............",
  "..............",
  ".....wwww.....",
  "....wbbwww....",
  "...Wwwwvvvv...",
  "...WwwvvCcv...",
  "...Wwwvvvvv...",
  "...Wwwwvvvw...",
  "....wwwwww....",
  ".....WWWW.....",
  "..WgWwwwwW....",
  "..Wcwwwbww....",
  "..Wgwwwwbw....",
  "..Wgwwwwwwg...",
  "..WggwWWWW....",
  "......ww......",
  ".....WWww.....",
  "....WW..ww....",
  "..BBB....wbbb."
 ],
 "run1": [
  "..............",
  "..............",
  ".....wwww.....",
  "....wbbwww....",
  "...Wwwwvvvv...",
  "...Wwwvvvvv...",
  "...WwwvCcvv...",
  "...Wwwwvvvw...",
  "....wwwwww....",
  ".....WWWW.....",
  "..WgWwwwwW....",
  "..Wcwwwbww....",
  "..Wgwwwcww....",
  "..Wgwwwwww....",
  "..WgWWWWwW....",
  "......wwg.....",
  ".....Www......",
  "...BBBww......",
  "......ww......",
  "......bbb....."
 ],
 "run2": [
  "..............",
  "..............",
  "..............",
  ".....wwww.....",
  "....wbbwww....",
  "...Wwwwvvvv...",
  "...WwwvvCcv...",
  "...Wwwvvvvv...",
  "...Wwwwvvvw...",
  "....wwwwww....",
  ".....WWWW.....",
  "..WgWwwwwW....",
  "..Wcwwwbww....",
  "..Wgwwwcbw....",
  "..Wgwwwwwwwwg.",
  "..WgWWWWWW....",
  "......ww......",
  ".....wwWW.....",
  "....ww..WW....",
  "..bbb....WBBB."
 ],
 "run3": [
  "..............",
  "..............",
  ".....wwww.....",
  "....wbbwww....",
  "...Wwwwvvvv...",
  "...Wwwvvvvv...",
  "...WwwvCcvv...",
  "...Wwwwvvvw...",
  "....wwwwww....",
  ".....WWWW.....",
  "..WgWwwwwW....",
  "..Wcwwwbww....",
  "..Wgwwwcww....",
  "..Wgwwwwww....",
  "..WgWWWWwW....",
  "......wwg.....",
  ".....wwW......",
  "...bbbWW......",
  "......WW......",
  "......BBB....."
 ],
 "idle0": [
  "..............",
  "..............",
  "..............",
  ".....wwww.....",
  "....wbbwww....",
  "...Wwwwvvvv...",
  "...WwwvvCcv...",
  "...Wwwvvvvv...",
  "...Wwwwvvvw...",
  "....wwwwww....",
  ".....WWWW.....",
  "..WgWwwwwW....",
  "..Wcwwwbww....",
  "..Wgwwwcww....",
  "..Wgwwwwww....",
  "..WgWWWWgW....",
  "......ww......",
  "......ww......",
  ".....Www......",
  ".....Bbbb....."
 ],
 "idle1": [
  "..............",
  "..............",
  "..............",
  ".....wwww.....",
  "....wbbwww....",
  "...Wwwwvvvv...",
  "...Wwwvvvvv...",
  "...WwwvCcvv...",
  "...Wwwwvvvw...",
  "....wwwwww....",
  ".....WWWW.....",
  "..WgWwwwwW....",
  "..Wcwwwbww....",
  "..Wgwwwcww....",
  "..Wgwwwwww....",
  "..WgWWWWgW....",
  "......ww......",
  "......ww......",
  ".....Www......",
  ".....Bbbb....."
 ],
 "jump": [
  "..............",
  ".....wwww.....",
  "....wbbwww....",
  "...Wwwwvvvv...",
  "...WwwvvCcv...",
  "...Wwwvvvvv...",
  "...Wwwwvvvw...",
  "....wwwwww....",
  ".....WWWW.....",
  "..WgWwwwwW.g..",
  "..Wcwwwbwww...",
  "..Wgwwwcbww...",
  "..Wgwwwwww....",
  "..WgWWWWWW....",
  "......ww......",
  ".....WWww.....",
  ".....WWww.....",
  "....WW..ww....",
  "....BBB..bbb..",
  ".............."
 ]
};
  const SW = 14, SH = 20, ctx = sprite.getContext("2d"), imgs = {};
  Object.entries(FRAMES).forEach(([k, rows]) => {
    const dd = ctx.createImageData(SW, SH);
    rows.forEach((row, y) => [...row].forEach((c, x) => { if (c === ".") return; const h = PAL[c], i = (y * SW + x) * 4; dd.data[i] = parseInt(h.slice(1, 3), 16); dd.data[i + 1] = parseInt(h.slice(3, 5), 16); dd.data[i + 2] = parseInt(h.slice(5, 7), 16); dd.data[i + 3] = 255; }));
    imgs[k] = dd;
  });
  let shown = "";
  const showFrame = k => { if (k !== shown) { shown = k; ctx.putImageData(imgs[k], 0, 0); } };

  /* optional custom sprite (any image / animated SVG): freezes the current pose on a canvas when the character stands still */
  let frozen = false;
  function freeze(on) {
    if (!img || on === frozen) return;
    if (on) {
      try {
        if (!img.complete || !img.naturalWidth) return;
        const r = img.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
        frz.width = Math.max(1, Math.round(r.width * dpr)); frz.height = Math.max(1, Math.round(r.height * dpr));
        const c = frz.getContext("2d"); c.imageSmoothingEnabled = false; c.clearRect(0, 0, frz.width, frz.height); c.drawImage(img, 0, 0, frz.width, frz.height);
        try { const d = c.getImageData(0, 0, frz.width, frz.height).data; let ok = false; for (let i = 3; i < d.length; i += 64) if (d[i]) { ok = true; break; } if (!ok) return; } catch (e) {}
      } catch (e) { return; }
    }
    frozen = on; flip.classList.toggle("frozen", on);
  }
  if (CUSTOM) {
    img = document.createElement("img"); img.className = "sk-sprite"; img.src = CUSTOM; img.alt = ""; img.draggable = false;
    frz = document.createElement("canvas"); frz.className = "sk-freeze"; frz.setAttribute("aria-hidden", "true");
    sprite.replaceWith(img); flip.appendChild(frz); sprite = img; img.addEventListener("load", () => measure());
  }

  /* ---------- state ---------- */
  const MAXV = 200, PATROL = 170;   // PATROL = automatic running speed (px per second)
  let W = 600, half = 28, x = 0, dir = 1, dist = 0, jumpT = -1, wasMoving = false;
  let patrolDir = 1, turnAt = 0, followX = null, hoverEl = null, hoverName = "";
  let ty = null, bw = 120, msgAt = 0, bag = [], raf = 0, last = 0;
  function measure() { W = run.clientWidth; half = (sprite.offsetWidth || 50) / 2; x = clamp(x || W * .2, half, Math.max(half, W - half)); }
  new ResizeObserver(measure).observe(run); measure();
  const nextMsg = () => { if (!bag.length) bag = MSGS.map((m, i) => i).sort(() => Math.random() - .5); return MSGS[bag.pop()]; };

  function say(msg, hold, force, kind, then) {
    if (ty && !force) return;
    ty = { full: msg, i: 0, next: 0, hold: hold || 2600, done: 0, then: then || null };
    bub.classList.toggle("thought", kind === "thought");
    bub.style.width = "auto"; txt.textContent = msg; bw = bub.offsetWidth; bub.style.width = bw + "px"; txt.textContent = "";   // reserve the full width so the bubble does not jitter while typing
    bub.classList.add("on"); bub.classList.remove("pop"); void bub.offsetWidth; bub.classList.add("pop");
  }
  let qbag = [];
  function ask() {   // question (thought bubble) -> "..." -> answer (speech bubble)
    if (!qbag.length) qbag = QA.map((q, i) => i).sort(() => Math.random() - .5);
    const [q, a] = QA[qbag.pop()];
    say(q, 1300, false, "thought", () => say("...", 700, true, "thought", () => say(a, 2800, true, "speech")));
  }

  /* ---------- input ---------- */
  run.addEventListener("pointermove", e => { followX = e.clientX - run.getBoundingClientRect().left; });
  run.addEventListener("pointerleave", () => { followX = null; });
  pal.addEventListener("click", () => { if (jumpT < 0) { jumpT = 0; say("Whee!", 1400, true); } });
  band.addEventListener("pointerover", e => {
    const w = e.target.closest && e.target.closest(".sk-word"); if (!w || !band.contains(w)) return;
    hoverEl = w; hoverName = w.getAttribute("aria-label") || w.textContent;
    say(HOVER[Math.floor(Math.random() * HOVER.length)](hoverName), 2200, true);
  });
  band.addEventListener("pointerout", e => { const w = e.target.closest && e.target.closest(".sk-word"); if (w && !w.contains(e.relatedTarget)) hoverEl = null; });

  /* ---------- loop: only while the section is on screen ---------- */
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000 || .016, .05); last = now;
    if (!msgAt) msgAt = now + 900;

    let hoverX = null;
    if (hoverEl) { const r = hoverEl.getBoundingClientRect(), rr = run.getBoundingClientRect(); hoverX = clamp(r.left + r.width / 2 - rr.left, half, W - half); }
    const fast = hoverX !== null || followX !== null;
    let goal = null, patrol = false;
    if (hoverX !== null) goal = hoverX;
    else if (followX !== null) goal = clamp(followX, half, W - half);
    else if (!reduce) {                                    // nothing to chase: keep running back and forth on its own
      patrol = true;
      if (!turnAt) turnAt = now + rand(3500, 8000);
      if (x >= W - half - 4) patrolDir = -1; else if (x <= half + 4) patrolDir = 1;
      if (now > turnAt) { patrolDir = -patrolDir; turnAt = now + rand(3500, 8000); }   // now and then it turns around mid-field
      goal = patrolDir > 0 ? W - half : half;
    }

    let moving = false;
    if (goal !== null && Math.abs(goal - x) > 6) {
      const d = Math.sign(goal - x), v = patrol ? PATROL : clamp(Math.abs(goal - x) * 5, 70, MAXV) * 1.15;
      x = clamp(x + d * v * dt, half, Math.max(half, W - half)); dist += v * dt; moving = true;
      if (d !== dir) { dir = d; flip.style.transform = d < 0 ? "scaleX(-1)" : ""; }
    }
    if (!moving && wasMoving && hoverX !== null && jumpT < 0) jumpT = 0;   // hops when it reaches the skill you hover
    wasMoving = moving;

    if (jumpT >= 0) { jumpT += dt / .7; if (jumpT >= 1) jumpT = -1; }
    const jy = jumpT >= 0 ? Math.sin(Math.PI * jumpT) * 80 : 0;
    if (CUSTOM) freeze(!moving && jumpT < 0); else showFrame(jumpT >= 0 ? "jump" : moving ? "run" + (Math.floor(dist / 14) % 4) : (now % 2800 < 140 ? "idle1" : "idle0"));
    pal.style.transform = "translate3d(" + (x - half).toFixed(1) + "px," + (-jy).toFixed(1) + "px,0)";
    shadow.style.transform = "translate3d(" + (x - 20).toFixed(1) + "px,0,0) scale(" + (1 - jy / 160).toFixed(3) + ")";

    // speech bubble: types the text out, holds, then hides
    if (ty) {
      if (ty.i < ty.full.length) { if (now >= ty.next) { ty.i++; txt.textContent = ty.full.slice(0, ty.i); ty.next = now + 28; if (ty.i >= ty.full.length) ty.done = now; } }
      else if (now - ty.done > ty.hold) { const nx = ty.then; ty = null; if (nx) nx(); else { bub.classList.remove("on"); msgAt = now + rand(3500, 6500); } }
    } else if (now > msgAt && !fast) { if (Math.random() < .75) ask(); else say(nextMsg()); }
    const bx = clamp(x - bw / 2, 6, Math.max(6, W - bw - 6));
    bub.style.setProperty("--tail", clamp(x - bx, 18, Math.max(18, bw - 18)) + "px");
    bub.style.transform = "translate3d(" + bx.toFixed(1) + "px," + (-jy).toFixed(1) + "px,0)";
  }
  if (!CUSTOM) showFrame("idle0");
  new IntersectionObserver(es => {
    if (es[0].isIntersecting) { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }
    else { cancelAnimationFrame(raf); raf = 0; }
  }, { rootMargin: "10% 0px" }).observe(sec);
})();
