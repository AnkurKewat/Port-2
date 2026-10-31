# Ankur Kewat - one merged site

The order of the experience (all in index.html):
1. Pipe loader: the original pipeline animation - scroll and the pipes crawl across the screen while the percentage counts up (js/loader.js)
2. Card spiral: 3D ribbon of cards spirals up along the helix driven by user scrolling (scroll down to spiral up, scroll up to reverse) (js/cards.js)
3. The website fades in and scrolling unlocks: the hero section, then tech stack, then "Bold Ideas, Brought to Life" with the blue pipe and PLAY REEL
   (js/tech-card.js, js/bold-section.js)

Run it with the included server:   node server.js   ->  http://localhost:3000
(or npx serve .). home.html is the website part on its own, without the intro.

---

# Ankur Kewat - intro site

Loader -> black background with white cursor glow -> scroll-driven card spiral -> website reveal.

## Files
- index.html        page markup (loads Three.js r128 from cdnjs, then the three scripts below)
- css/style.css     all styles (loader, fluid canvas, cards canvas, empty .site container)
- js/loader.js      the original 3D pipeline loader (fires the "loader:done" event when finished)
- js/fluid-bg.js    cursor fluid-distortion glow (black background, white glow, moves only with the cursor)
- js/cards.js       scroll-controlled 3D spiral ribbon cards (all settings in the CFG object at the top)

## Run
The site uses WebGL and textures, so open the site through a web server (not by double-clicking):
    node server.js     (or npx serve ., or deploy to Vercel/Netlify)

## Useful settings (js/cards.js -> CFG)
images, count, helixRadius, turnPerCard, rise, bend, tiltZ, tiltX
Run window.replayCards() in the browser console to replay the card sequence.

Put your real page inside <main class="site"> in index.html. Add your project links when you build the next sections.

## Tech icon card (separate piece)
tech-card.html + css/tech-card.css + js/tech-card.js: a rectangular card full of tumbling tech icons (HTML, CSS, JavaScript, React, Node...).
With no icon under the cursor (or the cursor outside the card) all tiles gather in the middle. The tile under the cursor sticks to it and follows it, the others are pushed away and spun, and a liquid distortion with rainbow edges ripples through the card. Open tech-card.html to see it on its own, or copy the <section class="tech-card"> block,
the css link and the js script into any page (it also needs the Three.js script tag). Settings are in CFG at the top of js/tech-card.js.

## Bold ideas section (scroll animation, below the tech card)
home.html puts the tech card on top and the "Bold Ideas, Brought to Life" section below it.
- css/bold-section.css + js/bold-section.js: a pinned scroll stage. A blue pipe grows in from the left and threads a video card,
  the card bends and grows into a wide reel card, "PLAY REEL" appears over it and the pipe leaves. Clicking PLAY REEL opens the video with sound.
- assets/reel.mp4 is a sample clip I generated: replace it with your own reel (keep it short and light so it autoplays smoothly).
- Settings (pipe thickness and colours, card sizes, how soft the scroll feels) are in CFG at the top of js/bold-section.js.
Open home.html through a web server (npx serve .).


---

# Full file map (current version)

```
index.html          the full site (loader -> card spiral -> website)
home.html           the website part on its own, without the intro
tech-card.html      the tech icon card on its own
server.js           tiny static server:  node server.js  ->  http://localhost:3000
css/  style.css  hero.css  hero-fx.css  wave-btn.css  tech-card.css  bold-section.css  stats.css
      experience.css  skills.css  runner.css  tail.css  connect.css
js/   loader.js  fluid-bg.js  cards.js        intro (pipe loader, cursor glow, card spiral with your photo)
      hero.js  hero-fx.js  pixel-profile.js    hero (command palette, text + button effects, pixelated photo)
      tech-card.js  bold-section.js            tech icon card, "Bold Ideas" + PLAY REEL
      stats.js  experience.js                  stat cards (+ the pipe), experience timeline (thin light line)
      skills.js  runner.js  connect.js         skills marquee, running character, "Let's Build Something."
      wave-btn.js                              round wave button left of "Let's talk" (sound toggle + cursor-reactive wave)
      core.js                                  shared pipe head (no gaps), cached positions, automatic lite mode (keep it before stats.js)
assets/  profile.jpg  user-photo.jpg  reel.mp4
```

Page order: hero -> Bold Ideas / PLAY REEL -> stat cards -> Professional Experience -> Featured Work -> tech card -> skills marquee (with the running character) -> Connect.
The blue pipe starts in Bold Ideas, continues into the stat cards (blue -> cyan, narrowing as it goes), runs across the top, down behind the cards, across the bottom and up the right margin, and leaves the screen through its right edge, beside the "Pixel Perfect" card. Professional Experience has only a thin timeline light.

Handy settings: pipe thickness `pipeRadius` (js/stats.js, js/bold-section.js), timeline light `pipeRadius` (js/experience.js), runner speed `PATROL` and speech lines (js/runner.js),
skills words (index.html, .sk-word), contact links (index.html, #connect), hero effects (js/hero-fx.js).

Performance notes: no backdrop blur on the cards, capped canvas resolution, loops only run while their section is on screen,
no per-frame layout reads, and js/core.js switches to "lite" mode by itself if the page drops below ~35 fps.
