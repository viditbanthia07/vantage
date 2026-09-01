# The Vantage site

A one-page, scroll-driven site for the project. Seven beats: what a camera does
not know, what detection is not, what only time can tell you, what a baseline
is, what the system says when it cannot answer, thirty-four things it gets
wrong, and the command.

It is a separate application from `frontend/` — different dependencies,
different build, different job. The console is an instrument read for eight
hours; this is a page read once.

```bash
cd site
npm install
npm run dev        # http://localhost:5174
npm run build      # static files in dist/
npm run preview    # serve dist/
npm run typecheck
npm run smoke      # a real browser, against a running preview
npm run perf       # LCP, sustained frame rate, tap targets — measured, not asserted
```

---

## The rule the whole thing is built under

**A page for a system that refuses to fabricate its readings cannot fabricate
its own screenshots.** Every number, chart, refusal, limitation and rendered
frame on this page was produced by running Vantage and writing down the answer.
Two scripts do that, and nothing on the page bypasses them:

| | | |
| :-- | :-- | :-- |
| `tools/capture_media.py` | → `site/public/media/` | the hero clip and the layer stills, from a real pipeline pass |
| `tools/capture_data.py` | → `site/src/captured/` | real `/api/*` responses, the refusals, and the README's limitations |

Regenerate both after any change that could move them:

```bash
python tools/capture_media.py --out site/public/media
python tools/capture_data.py  --out site/src/captured
```

`capture_media.py` needs `ffmpeg` on PATH or `pip install imageio-ffmpeg`;
OpenCV's own VP9 writer ignores its quality setting and produces a 6 MB file
whatever you ask it for. `capture_data.py` needs the sample clips for its
facility pass — pass `--skip-facility` without them, and the twin the hero
renders will be whatever was captured last.

### What may appear on the page, and what may not

This is the decision that shaped the media, and it is worth stating plainly.

**No footage of real people is published here.** The clips this project tests
against are Creative Commons files from Wikimedia Commons, and two separate
things rule them out: the repository never recorded their attribution, so
republishing them would breach the licences that require it; and they show
identifiable members of the public who did not agree to appear on a marketing
page for a video analytics system. The hero clip and every still therefore come
from the built-in synthetic source, which is ours, is reproducible by anyone in
one command, and is unflattering — four circles, one of which the detector calls
a sports ball at moderate confidence. The page says so.

**The twin is captured from real footage, and that is not an exception.** The
3D facility in the hero holds a floor plan, three camera mounts with their real
yaw and field of view, and eleven anonymous entity positions with their trails.
It has never held an image. Driving it from real clips changes only whether
those positions belong to real walking people or to bouncing circles, and the
circles the detector barely sees produce an empty building. What reaches the
page is a dot in a room that says somebody was there — which is the project's
privacy stance drawn as a picture.

---

## Stack, and one licence note

```
Vite + React        one page, and beat 4 imports the console's own TrendChart
three.js  (MIT)     the hero twin, loaded dynamically after first paint
GSAP + ScrollTrigger  smooth scroll timing, loaded after first paint
Lenis     (MIT)     the scroll itself
Tailwind            the console's tokens, imported from frontend/tailwind.config.js
```

**The console cannot use GSAP; this page can.** GSAP is free for commercial use
since Webflow's acquisition, but the licence is not OSI-approved and carries no
explicit grant to redistribute it inside a distributed application. Vantage
ships a packaged `vantage.exe` with the console's bundle inside it under MIT, so
the console's craft work was done with zero new dependencies. A site is served
from a URL and redistributes nothing, which is a different question with a
different answer.

**React rather than a framework-free build**, because beat 4 renders the
console's real `TrendChart` and the hero borrows its palette. Importing the
component is the difference between the page showing the product and the page
showing a drawing of the product.

---

## Budgets, and where they are actually measured

| | Target | Measured |
| :--- | :--- | :--- |
| JS before the hero paints | < 150 KB gzipped | **68 KB** — three.js and GSAP both load after |
| Largest Contentful Paint, slow 4G | < 1.8 s | **0.90 s** (the `h1`) |
| Frame rate through the hero, scrolling | 60 fps sustained | **120 fps median, 118 fps p95**; 1 frame over 16.9 ms in 321 |
| Draw calls in the hero | < 100 | **16** |
| Transferred on first load | — | **410 KB** across 13 resources |
| Media total | < 3 MB | **1.9 MB**, of which ~1.2 MB is fetched |
| Tap targets at 390px | ≥ 44 px | **all 7**, after a fix — every one was under before it was measured |
| External requests | zero | **zero** |

The last two rows are the reason both scripts exist. `npm run perf` measures LCP
on a throttled connection, samples every frame while scrolling the hero, checks
that the render loop actually stops when the hero leaves the viewport, and sizes
every tap target on a phone. `npm run smoke` then holds the line: it fails on any
external request, a missing beat or heading, more than one `h1`, a hero issuing
no draw calls, a still that never loads, a skip link that misbehaves, any reveal
still waiting under `prefers-reduced-motion`, horizontal overflow at 390px, and
any tap target under 44px.

Tap targets are worth the specific note. Every interactive element on this page
was under 44px until it was measured, and the scrub slider was **4px tall** — a
control nobody can operate with a thumb, on a page that had already passed a
mobile-overflow check. Reading the code would not have found it.

---

## Deploying

Static files, no server.

```bash
VANTAGE_SITE_BASE=/vantage/ npm run build     # a GitHub Pages project site
npm run build                                 # a domain, or any root
```

Every asset reference goes through Vite's `BASE_URL`, so neither answer is
hard-coded. There is no analytics and nothing that phones home; a page for a
project whose central claim is restraint about surveillance should not itself be
running third-party trackers, and saying so on the page is worth more than the
data would be.
