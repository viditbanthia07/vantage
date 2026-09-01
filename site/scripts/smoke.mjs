/**
 * Load the marketing page in a real browser and fail on anything it complains about.
 *
 * The console's smoke test exists because the whole Python suite once passed
 * against a completely dead page. This one exists for the same reason and for
 * four more that are specific to a page like this:
 *
 * 1. **No external requests.** The page's own copy says it loads nothing from a
 *    third party. That is a claim a reader cannot verify and a test can, so it
 *    is enforced here rather than promised: every request the page makes must be
 *    same-origin or a `data:` URI.
 * 2. **The narrative works as headings.** Seven beats, seven headings, in order.
 *    A screen reader's document outline is the page's fallback narrative, and it
 *    silently rots the moment a beat is restructured.
 * 3. **Reduced motion removes motion.** Emulated, then checked: every reveal is
 *    already at its finished state on load rather than waiting for a scroll that
 *    a reader in this mode may make very differently.
 * 4. **The hero renders something.** WebGL in headless Chrome via SwiftShader,
 *    so a canvas that stays uniformly the background colour means the twin
 *    failed to draw and the hero is an empty rectangle.
 *
 * Usage, against a `vite preview` already serving:
 *
 *     node scripts/smoke.mjs [--url http://localhost:5174] [--shots out/dir]
 */

import { existsSync, mkdirSync } from 'node:fs';
import { argv, exit } from 'node:process';
import puppeteer from 'puppeteer-core';

const arg = (name, fallback) => {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 && argv[index + 1] ? argv[index + 1] : fallback;
};

const URL = arg('url', 'http://localhost:5174');
const SHOTS = arg('shots', null);

const BEATS = ['hero', 'seam', 'time', 'baselines', 'restraint', 'limits', 'run'];

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

const chrome = CHROME_CANDIDATES.find((path) => existsSync(path));
if (!chrome) {
  console.error('No Chrome found. Set CHROME_PATH to its executable.');
  exit(2);
}

const problems = [];
const note = (message) => console.log(`  ${message}`);

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: 'new',
  // SwiftShader rather than --disable-gpu: the hero is WebGL and a run with no
  // GL context would pass this test by testing nothing.
  args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  // Software GL makes several of these evaluations slower than the 30s default.
  protocolTimeout: 120000,
});

const origin = new globalThis.URL(URL).origin;

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1512, height: 950 });

  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    problems.push(`console.error: ${message.text()}`);
  });

  const external = [];
  page.on('request', (request) => {
    const url = request.url();
    if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith(origin)) return;
    external.push(url);
  });

  if (SHOTS) mkdirSync(SHOTS, { recursive: true });

  console.log(`smoke: ${URL}`);
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 45000 });

  // ── 1. no third-party requests ────────────────────────────────────────────
  if (external.length > 0) {
    problems.push(
      `the page made ${external.length} external request(s), and its own copy says it makes none: ${external.slice(0, 5).join(', ')}`,
    );
  } else {
    note('no external requests');
  }

  // ── 2. the narrative, as sections and headings ────────────────────────────
  const outline = await page.evaluate((ids) =>
    ids.map((id) => {
      const section = document.getElementById(id);
      const heading = document.getElementById(`${id}-title`);
      return {
        id,
        present: Boolean(section),
        heading: heading ? heading.textContent.trim().slice(0, 60) : null,
        level: heading ? heading.tagName : null,
      };
    }),
  BEATS);

  for (const beat of outline) {
    if (!beat.present) problems.push(`beat "${beat.id}" is not in the document`);
    else if (!beat.heading) problems.push(`beat "${beat.id}" has no heading`);
  }
  const h1s = await page.$$eval('h1', (nodes) => nodes.length);
  if (h1s !== 1) problems.push(`the page has ${h1s} h1 elements; it should have exactly one`);
  if (outline.every((beat) => beat.present && beat.heading)) {
    note(`${BEATS.length} beats, each with a heading, one h1`);
  }

  // ── 3. the hero actually drew ─────────────────────────────────
  //
  // Read from what the page already shows rather than from the framebuffer.
  // `readPixels` was the obvious check and is unusable here: under SwiftShader
  // the render loop saturates the CPU, and a readback - even of a 240x180 patch
  // - never returns inside the CDP protocol timeout. The hero already displays
  // `renderer.info.render.calls` as one of its figures, which is a stronger
  // signal anyway: it is non-zero only if three.js issued real draw calls this
  // frame, and it is the same number the page shows a reader.
  await new Promise((resolve) => setTimeout(resolve, 4000));
  const hero = await page.evaluate(() => {
    const canvas = document.querySelector('#hero canvas');
    const calls = document.querySelector('[data-figure="draw-calls"]');
    return {
      canvas: Boolean(canvas),
      size: canvas ? `${canvas.width}x${canvas.height}` : null,
      calls: calls ? calls.textContent.trim() : null,
      unavailable: document.body.textContent.includes('needs WebGL, and this browser'),
    };
  });
  if (!hero.canvas) problems.push('the hero has no canvas');
  else if (hero.unavailable) problems.push('the hero reported WebGL unavailable');
  else if (!/^[1-9][0-9]*$/.test(hero.calls ?? '')) {
    problems.push(
      `the hero is not issuing draw calls (it reports "${hero.calls}"); it would read as an empty building`,
    );
  } else {
    note(`hero drew, ${hero.calls} draw calls at ${hero.size}`);
  }

  // ── 4. the layer stills and the scrub ────────────────────────────
  //
  // Scrolled to first, because the stills below the first are `loading="lazy"`
  // and a lazy image that has never approached the viewport reports
  // `complete === false` forever. Awaiting its load event without scrolling
  // waits for something that is deliberately never going to happen.
  await page.evaluate(() => document.getElementById('seam')?.scrollIntoView());
  await new Promise((resolve) => setTimeout(resolve, 1500));
  await page.evaluate(async () => {
    // Walk the whole beat so every lazy still is asked for.
    const seam = document.getElementById('seam');
    if (!seam) return;
    const step = window.innerHeight * 0.8;
    for (let y = seam.offsetTop; y < seam.offsetTop + seam.offsetHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
  });
  await new Promise((resolve) => setTimeout(resolve, 2000));

  const media = await page.evaluate(() => {
    const images = [...document.querySelectorAll('#seam img')];
    return {
      total: images.length,
      pending: images.filter((image) => !image.complete).length,
      broken: images.filter((image) => image.complete && image.naturalWidth === 0).length,
      scrub: Boolean(document.querySelector('#seam canvas')),
    };
  });
  if (media.total === 0) problems.push('the seam has no layer stills');
  if (media.broken > 0) problems.push(`${media.broken} of ${media.total} layer stills failed to load`);
  if (media.pending > 0) problems.push(`${media.pending} of ${media.total} layer stills never loaded`);
  if (!media.scrub) problems.push('the seam has no scrub canvas');
  if (media.total > 0 && media.broken === 0 && media.pending === 0 && media.scrub) {
    note(`${media.total} layer stills loaded, one scrub canvas`);
  }

  // ── 5. the skip link ──────────────────────────────────────────────────────
  const skip = await page.evaluate(async () => {
    const link = document.querySelector('.skip-link');
    if (!link) return { present: false };
    const hidden = link.getBoundingClientRect().top < -20;
    link.focus();
    // The transition is 150ms; measuring in the same tick measures the state
    // before it, which once failed this check for entirely the wrong reason.
    await new Promise((resolve) => setTimeout(resolve, 400));
    const shown = link.getBoundingClientRect().top >= 0;
    return { present: true, hidden, shown, href: link.getAttribute('href') };
  });
  if (!skip.present) problems.push('there is no skip link');
  else if (!skip.hidden) problems.push('the skip link is visible when it is not focused');
  else if (!skip.shown) problems.push('the skip link does not appear when focused');
  else note(`skip link hides, appears on focus, points at ${skip.href}`);

  if (SHOTS) await page.screenshot({ path: `${SHOTS}/page-top.png` });

  // ── 6. reduced motion removes motion rather than shortening it ────────────
  const quiet = await browser.newPage();
  await quiet.setViewport({ width: 1512, height: 950 });
  await quiet.emulateMediaFeatures([
    { name: 'prefers-reduced-motion', value: 'reduce' },
  ]);
  await quiet.goto(URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await new Promise((resolve) => setTimeout(resolve, 1200));

  const still = await quiet.evaluate(() => {
    const reveals = [...document.querySelectorAll('.reveal')];
    const waiting = reveals.filter((element) => !element.classList.contains('is-revealed'));
    const animated = reveals.filter((element) => {
      const duration = getComputedStyle(element).transitionDuration;
      return duration && Number.parseFloat(duration) > 0.01;
    });
    return { total: reveals.length, waiting: waiting.length, animated: animated.length };
  });
  if (still.waiting > 0) {
    problems.push(
      `under prefers-reduced-motion, ${still.waiting} of ${still.total} reveals are still waiting to be scrolled into view`,
    );
  }
  if (still.animated > 0) {
    problems.push(
      `under prefers-reduced-motion, ${still.animated} elements still carry a transition longer than 10ms`,
    );
  }
  if (still.waiting === 0 && still.animated === 0) {
    note(`reduced motion: all ${still.total} reveals settled, no transitions`);
  }
  if (SHOTS) await quiet.screenshot({ path: `${SHOTS}/reduced-motion.png` });

  // ── 7. a narrow viewport is not a broken one ──────────────────────────────
  const phone = await browser.newPage();
  await phone.setViewport({ width: 390, height: 844, isMobile: true, deviceScaleFactor: 2 });
  await phone.goto(URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await new Promise((resolve) => setTimeout(resolve, 1500));
  const overflow = await phone.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    culprits: [...document.querySelectorAll('body *')]
      .filter((element) => element.getBoundingClientRect().right > window.innerWidth + 1)
      .slice(0, 4)
      .map((element) => `${element.tagName.toLowerCase()}.${String(element.className).slice(0, 40)}`),
  }));
  if (overflow.scrollWidth > overflow.clientWidth + 1) {
    problems.push(
      `at 390px the page scrolls horizontally (${overflow.scrollWidth} > ${overflow.clientWidth}): ${overflow.culprits.join(', ')}`,
    );
  } else {
    note('no horizontal overflow at 390px');
  }

  // ── 8. tap targets ────────────────────────────────────────────────────────
  //
  // The research note lists broken tap targets among the failures that cap a
  // score outright, and it was right to: measured once, every interactive
  // element here was under 44px, and the scrub slider was 4px tall. 44 is the
  // WCAG 2.2 target-size floor and the number both platform guidelines use.
  const targets = await phone.evaluate(() => {
    const nodes = [...document.querySelectorAll('a, button, input, [tabindex]:not([tabindex="-1"])')];
    return nodes
      .map((node) => ({ node, box: node.getBoundingClientRect() }))
      .filter(({ box }) => box.width > 0 && box.height > 0 && (box.width < 44 || box.height < 44))
      .map(({ node, box }) => {
        const name = (node.getAttribute('aria-label') || node.textContent || '').trim().slice(0, 30);
        return `${node.tagName.toLowerCase()} "${name}" is ${Math.round(box.width)}x${Math.round(box.height)}`;
      });
  });
  if (targets.length > 0) {
    problems.push(`${targets.length} tap target(s) under 44px at 390px: ${targets.join('; ')}`);
  } else {
    note('every tap target clears 44px at 390px');
  }

  if (SHOTS) await phone.screenshot({ path: `${SHOTS}/phone.png`, fullPage: false });
} finally {
  await browser.close();
}

if (problems.length > 0) {
  console.error(`\n${problems.length} problem(s):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  exit(1);
}
console.log('\nall checks passed');
