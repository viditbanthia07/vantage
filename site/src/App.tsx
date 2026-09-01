/**
 * The page: seven beats, in order, and the two things that make it navigable.
 *
 * A skip link, because the first thing after it is a WebGL canvas and a
 * keyboard reader should not have to pass through the whole narrative to reach
 * the command at the end. And a `main` landmark with the beats as sections,
 * each with its own heading, so the narrative is a list of headings to a screen
 * reader rather than a scroll.
 */

import React, { useEffect, useRef } from 'react';
import { Hero } from './beats/Hero';
import { Seam } from './beats/Seam';
import { Time } from './beats/Time';
import { Baselines } from './beats/Baselines';
import { Restraint } from './beats/Restraint';
import { Limits } from './beats/Limits';
import { RunIt } from './beats/RunIt';
import { observeReveals } from './lib/reveal';

export const App: React.FC = () => {
  const main = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // The reveals start immediately; the smooth scroll arrives when its chunk
    // does. Ordering them this way is what keeps GSAP and Lenis out of the
    // entry bundle, and the page is fully usable in the window between the two.
    const stopReveals = main.current ? observeReveals(main.current) : () => {};
    let stopScroll: (() => void) | null = null;
    let cancelled = false;

    void import('./lib/scroll').then(({ startScroll }) => {
      if (cancelled) return;
      stopScroll = startScroll();
    });

    return () => {
      cancelled = true;
      stopReveals();
      stopScroll?.();
    };
  }, []);

  return (
    <>
      <a className="skip-link" href="#run">
        Skip to the command
      </a>
      <main ref={main} id="page">
        <Hero />
        <Seam />
        <Time />
        <Baselines />
        <Restraint />
        <Limits />
        <RunIt />
      </main>
    </>
  );
};
