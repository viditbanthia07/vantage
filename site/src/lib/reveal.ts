/**
 * Reveal-on-scroll, with no dependency on anything.
 *
 * Split out of `scroll.ts` deliberately. This runs on every paragraph on the
 * page and is what makes the page feel alive; the smooth scroll is a refinement
 * on top of it. Keeping them in one module put GSAP and Lenis - 45 KB gzipped -
 * in the entry chunk for the sake of an IntersectionObserver, which is 45 KB
 * standing between the reader and the first paint of a page whose budget is 150.
 * Separated, the smooth scroll loads after the page is already readable and
 * already revealing, and nothing about the page breaks if it never arrives.
 *
 * `once` is not negotiable. An element that re-hides when scrolled past leaves a
 * reader who scrolls back up looking at a blank page, which is the most common
 * way this pattern goes wrong.
 */

import { prefersReducedMotion } from './motion';

export function observeReveals(root: HTMLElement): () => void {
  const targets = root.querySelectorAll<HTMLElement>('.reveal');

  if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
    targets.forEach((element) => element.classList.add('is-revealed'));
    return () => {};
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-revealed');
        observer.unobserve(entry.target);
      }
    },
    // A little way in, so a reveal fires as the element becomes worth reading
    // rather than as its first pixel clears the fold.
    { rootMargin: '0px 0px -12% 0px', threshold: 0.15 },
  );

  targets.forEach((element) => observer.observe(element));
  return () => observer.disconnect();
}
