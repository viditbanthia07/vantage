/**
 * Reduced motion, and the two numbers the page's timings come from.
 *
 * Deliberately a copy of the two functions the console's `lib/motion.ts` exports
 * rather than an import of it. The console's module is about a screen watched
 * for a shift, and its whole argument - that motion is rationed because it is a
 * signal - does not transfer to a page read once. Importing it would drag that
 * reasoning here where it is wrong, and would tie a marketing page's timings to
 * an instrument's. What does transfer is the definition of `prefersReducedMotion`
 * and the rule that a reduced-motion duration is zero rather than short.
 */

export const DURATION = {
  /** A word arriving in a headline, a bar growing. */
  reveal: 520,
  /** A section arriving. */
  beat: 400,
  /** A copy button confirming, a caption swapping. */
  micro: 160,
} as const;

export const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

let media: MediaQueryList | null = null;

function query(): MediaQueryList | null {
  if (media) return media;
  if (typeof window === 'undefined' || !window.matchMedia) return null;
  media = window.matchMedia('(prefers-reduced-motion: reduce)');
  return media;
}

/** Whether the viewer has asked for less movement. Safe to call outside React. */
export function prefersReducedMotion(): boolean {
  return query()?.matches ?? false;
}

/**
 * A duration, or zero when the viewer has asked for less movement.
 *
 * Zero rather than "shorter": reduced motion is a request to remove the
 * animation, not to hurry it.
 */
export function duration(ms: number): number {
  return prefersReducedMotion() ? 0 : ms;
}

/**
 * How long a stagger step should be, given how many things are staggering.
 *
 * A fixed per-item delay reads as brisk across six words and as a slow wipe
 * across twenty-six. The total is what wants to be roughly constant.
 */
export function staggerStep(count: number, totalMs = DURATION.reveal): number {
  if (count <= 1) return 0;
  return Math.min(60, totalMs / count);
}
