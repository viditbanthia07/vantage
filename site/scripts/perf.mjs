/**
 * The budgets in the research note, measured rather than asserted.
 *
 * Three of them cannot be checked by looking at the source: sustained frame rate
 * through the hero, largest contentful paint on a throttled connection, and
 * whether the render loop actually stops when the hero leaves the viewport. Each
 * is a number a jury would see and a reader would feel.
 *
 *     node scripts/perf.mjs [--url http://localhost:5174]
 */
import { existsSync } from 'node:fs';
import { argv, exit } from 'node:process';
import puppeteer from 'puppeteer-core';

const arg = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const URL = arg('url', 'http://localhost:5174');
const chrome = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome'].filter(Boolean).find(existsSync);
if (!chrome) { console.error('No Chrome found.'); exit(2); }

// SwiftShader is software rasterisation and would measure the CPU, not the page.
// --use-angle=default lets Chrome pick the real GPU.
const browser = await puppeteer.launch({
  executablePath: chrome, headless: 'new', protocolTimeout: 180000,
  args: ['--no-sandbox', '--use-angle=default', '--ignore-gpu-blocklist',
         '--enable-gpu-rasterization', '--enable-zero-copy'],
});

const row = (label, value, budget, ok) =>
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(34)} ${String(value).padStart(10)}   budget ${budget}`);

try {
  // ── largest contentful paint, on a fast-3G-ish throttle ────────────────────
  const cold = await browser.newPage();
  const session = await cold.createCDPSession();
  await session.send('Network.enable');
  await session.send('Network.emulateNetworkConditions', {
    offline: false,
    // Lighthouse's "Slow 4G" preset: 1.6 Mbit down, 750 kbit up, 150ms RTT.
    latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8,
  });
  await cold.setViewport({ width: 1512, height: 950 });
  // The observer has to exist before the entry it is meant to see.
  // `getEntriesByType('largest-contentful-paint')` after the fact returns
  // nothing - the first version of this script reported 0ms and called it a
  // failure, which is a measurement bug reported as a page bug.
  await cold.evaluateOnNewDocument(() => {
    window.__lcp = 0;
    window.__lcpElement = null;
    new PerformanceObserver((list) => {
      const entry = list.getEntries().at(-1);
      if (!entry) return;
      window.__lcp = entry.startTime;
      window.__lcpElement = entry.element ? entry.element.tagName : null;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  });
  await cold.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await new Promise((r) => setTimeout(r, 6000));
  const paint = await cold.evaluate(() => {
    const fcp = performance.getEntriesByName('first-contentful-paint')[0];
    const nav = performance.getEntriesByType('navigation')[0];
    const transferred = performance.getEntriesByType('resource')
      .reduce((sum, r) => sum + (r.transferSize || 0), 0) + (nav?.transferSize || 0);
    return {
      fcp: Math.round(fcp?.startTime ?? 0),
      lcp: Math.round(window.__lcp ?? 0),
      element: window.__lcpElement,
      transferredKB: Math.round(transferred / 1024),
      resources: performance.getEntriesByType('resource').length,
    };
  });
  await cold.close();

  // ── sustained frame rate through the hero, with the page being scrolled ────
  const page = await browser.newPage();
  await page.setViewport({ width: 1512, height: 950 });
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 3500));

  const frames = await page.evaluate(async () => {
    const samples = [];
    let last = performance.now();
    let running = true;
    const tick = (now) => { samples.push(now - last); last = now; if (running) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    // Scroll the hero the way a reader would, so the camera move is running
    // while the frame rate is sampled. A hero measured standing still is a hero
    // measured doing nothing.
    const height = window.innerHeight;
    for (let i = 0; i <= 40; i += 1) {
      window.scrollTo(0, (i / 40) * height);
      await new Promise((r) => setTimeout(r, 60));
    }
    running = false;
    await new Promise((r) => setTimeout(r, 100));
    const sorted = samples.slice(5).sort((a, b) => a - b);
    const at = (q) => sorted[Math.floor(sorted.length * q)] ?? 0;
    return {
      count: sorted.length,
      medianMs: +at(0.5).toFixed(2),
      p95Ms: +at(0.95).toFixed(2),
      worstMs: +sorted.at(-1).toFixed(2),
      medianFps: Math.round(1000 / at(0.5)),
      p95Fps: Math.round(1000 / at(0.95)),
      over16: sorted.filter((d) => d > 16.9).length,
    };
  });

  // ── does the loop actually stop when the hero is off screen? ───────────────
  const idle = await page.evaluate(async () => {
    const readCalls = () => {
      const node = document.querySelector('[data-figure="draw-calls"]');
      return node ? node.textContent.trim() : null;
    };
    document.getElementById('limits')?.scrollIntoView();
    await new Promise((r) => setTimeout(r, 1200));
    const before = readCalls();
    let ticks = 0;
    const tick = () => { ticks += 1; requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    await new Promise((r) => setTimeout(r, 1500));
    return { before, after: readCalls(), rafTicksWhileAway: ticks };
  });

  console.log(`\nperf: ${URL}\n`);
  row('LCP (slow 4G, 150ms RTT)', `${paint.lcp}ms`, '< 1800ms', paint.lcp > 0 && paint.lcp < 1800);
  row('FCP (same)', `${paint.fcp}ms`, '—', true);
  row('transferred on first load', `${paint.transferredKB}KB`, '—', true);
  row('median frame, hero scrolling', `${frames.medianMs}ms`, '< 16.7ms', frames.medianMs < 16.7);
  row('p95 frame, hero scrolling', `${frames.p95Ms}ms`, '< 16.7ms', frames.p95Ms < 16.7);
  row('frames over 16.9ms', `${frames.over16}/${frames.count}`, 'few', frames.over16 / frames.count < 0.1);
  console.log(`\n  median ${frames.medianFps}fps, p95 ${frames.p95Fps}fps, worst frame ${frames.worstMs}ms`);
  console.log(`  LCP element: <${paint.element}>, ${paint.resources} resources`);
  console.log(`  hero off-screen: draw-calls figure ${idle.before} -> ${idle.after} (frozen means the loop stopped)`);

  // ── tap targets, which the note lists as capping the whole score ───────────
  const phone = await browser.newPage();
  await phone.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await phone.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 2500));
  const targets = await phone.evaluate(() => {
    const nodes = [...document.querySelectorAll('a, button, input, [tabindex]:not([tabindex="-1"])')];
    const small = nodes
      .map((node) => ({ node, box: node.getBoundingClientRect() }))
      .filter(({ box }) => box.width > 0 && box.height > 0 && (box.width < 44 || box.height < 44))
      .map(({ node, box }) => `${node.tagName.toLowerCase()}"${(node.textContent || node.getAttribute('aria-label') || '').trim().slice(0, 28)}" ${Math.round(box.width)}x${Math.round(box.height)}`);
    return { total: nodes.filter((n) => n.getBoundingClientRect().width > 0).length, small };
  });
  await phone.close();
  console.log(`
  tap targets at 390px: ${targets.total} interactive, ${targets.small.length} under 44px`);
  for (const entry of targets.small) console.log(`    - ${entry}`);
} finally {
  await browser.close();
}
