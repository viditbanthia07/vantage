/**
 * Smooth scroll: Lenis for the feel, GSAP's ticker for the clock.
 *
 * Loaded dynamically, after the page is already readable and already revealing.
 * Nothing here is required for the page to work — with this module absent the
 * browser's own scrolling runs, every reveal still fires, and the only thing
 * missing is the easing. That is the correct relationship between a page and its
 * scroll library, and it is why `observeReveals` lives in `reveal.ts` instead of
 * here.
 *
 * The GSAP licence question, recorded because it is the reason the console has
 * no file like this one: GSAP is free for commercial use since Webflow's
 * acquisition, but the licence is not OSI-approved and grants no explicit right
 * to redistribute it inside a distributed application. Vantage ships a packaged
 * `vantage.exe` with the console's bundle inside it under MIT, so the console's
 * craft work was done with zero new dependencies. A marketing page is served
 * from a URL and redistributes nothing, which is a different question with a
 * different answer. Lenis is MIT and would have been fine either way.
 *
 * ScrollTrigger is registered here rather than imported at each use, so that a
 * beat wanting a genuine scrub has it available without a second registration.
 */

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { prefersReducedMotion } from './motion';

gsap.registerPlugin(ScrollTrigger);

let lenis: Lenis | null = null;

/**
 * Start the smooth scroll. Returns a teardown.
 *
 * Calling it twice without tearing down is a no-op rather than a second
 * instance: React 18's development StrictMode mounts every effect twice, and two
 * Lenis instances on one document fight over `scrollTo` in a way that is very
 * hard to read as a bug.
 */
export function startScroll(): () => void {
  if (prefersReducedMotion() || lenis) return () => {};

  lenis = new Lenis({
    // 1.1 is slower than Lenis's 1.2 default by enough to notice on a trackpad
    // and not enough to feel like drag on a wheel. The page is a narrative;
    // arriving at a beat slightly late is better than overshooting it.
    duration: 1.1,
    smoothWheel: true,
    // Touch is left alone. A phone's own inertial scrolling is better than any
    // reimplementation of it, and hijacking it is the single most common
    // complaint about pages built like this one.
    syncTouch: false,
  });

  const instance = lenis;
  instance.on('scroll', ScrollTrigger.update);

  const raf = (time: number) => instance.raf(time * 1000);
  gsap.ticker.add(raf);
  gsap.ticker.lagSmoothing(0);

  return () => {
    gsap.ticker.remove(raf);
    instance.destroy();
    lenis = null;
  };
}

/** Scroll to an element, through Lenis when it is running and natively when not. */
export function scrollTo(target: string | HTMLElement): void {
  if (lenis) {
    lenis.scrollTo(target, { offset: 0 });
    return;
  }
  const element = typeof target === 'string' ? document.querySelector(target) : target;
  element?.scrollIntoView({ block: 'start' });
}

export { gsap, ScrollTrigger };
