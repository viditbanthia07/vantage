/**
 * Beat 1 — a camera does not understand what it sees.
 *
 * The twin, in WebGL, from the captured `/api/twin` payload, with the reader's
 * scroll driving the camera from an oblique view of a room to a plan view of a
 * dataset.
 *
 * three.js is loaded dynamically and only here. It is ~170 KB gzipped and the
 * budget for JavaScript before the hero paints is 150 KB, so it must not be in
 * the entry chunk: the headline, the type and the whole page below it render
 * first and the canvas arrives when its module does. If the import fails, or
 * WebGL is unavailable, the beat is still a complete section - a headline, a
 * claim, and a plain statement of what could not be drawn. It never shows an
 * empty frame that reads as an empty building.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Headline } from '../components/Beat';
import { prefersReducedMotion } from '../lib/motion';
import type { HeroStats, TwinPayload } from '../gl/twin';
import twinPayload from '../captured/facility-twin.json';

const twin = twinPayload as unknown as TwinPayload;

type Status = 'loading' | 'running' | 'unavailable';

const Figure: React.FC<{ value: string; label: string; testId?: string }> = ({
  value,
  label,
  testId,
}) => (
  <div>
    <p className="font-mono text-title tabular-nums text-warm-white" data-figure={testId}>
      {value}
    </p>
    <p className="mt-1 font-mono text-micro uppercase tracking-[0.12em] text-ink-faint">{label}</p>
  </div>
);

export const Hero: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sectionRef = useRef<HTMLElement | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [stats, setStats] = useState<HeroStats | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const section = sectionRef.current;
    if (!canvas || !section) return;

    let handle: { setProgress(v: number): void; dispose(): void } | null = null;
    let cancelled = false;
    let onScroll: (() => void) | null = null;

    void import('../gl/twin')
      .then(({ mountTwin }) => {
        if (cancelled) return;
        handle = mountTwin(canvas, twin, {
          reducedMotion: prefersReducedMotion(),
          // Sampled rather than stored every frame: this is 60 setState calls a
          // second otherwise, which is a page that reports its own frame rate by
          // destroying it.
          onStats: (next) => {
            setStats((current) =>
              current && current.calls === next.calls && current.triangles === next.triangles
                ? current
                : next,
            );
          },
        });
        if (!handle) {
          setStatus('unavailable');
          return;
        }
        setStatus('running');

        // The scroll position of this section alone, not the page: the camera
        // finishes its move as the hero leaves, whatever is below it.
        onScroll = () => {
          const rect = section.getBoundingClientRect();
          const travelled = -rect.top / Math.max(rect.height, 1);
          handle?.setProgress(travelled);
        };
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
      })
      .catch(() => {
        if (!cancelled) setStatus('unavailable');
      });

    return () => {
      cancelled = true;
      if (onScroll) window.removeEventListener('scroll', onScroll);
      handle?.dispose();
    };
  }, []);

  const facility = twin.facility;

  return (
    <section
      ref={sectionRef}
      id="hero"
      aria-labelledby="hero-title"
      className="relative h-[100svh] min-h-[42rem] w-full overflow-hidden"
    >
      <div className="absolute inset-0">
        <canvas ref={canvasRef} className="block h-full w-full" aria-hidden />
        {/* The scrim, and it is two different scrims at two widths.
            On a wide viewport the type occupies the left third, so darkening
            left-to-right keeps it legible and leaves the twin at full strength
            on the right - better composition than a uniformly murky rectangle.
            On a phone the type spans the whole width, where a horizontal
            gradient does nothing at all and the lede ends up sitting on top of
            the render. There the scrim is vertical and heavier. */}
        <div
          className="pointer-events-none absolute inset-0 lg:hidden"
          style={{
            background:
              'linear-gradient(180deg, rgba(20,17,13,0.9) 0%, rgba(20,17,13,0.86) 55%, rgba(20,17,13,0.6) 72%, rgba(20,17,13,0.9) 100%)',
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 hidden lg:block"
          style={{
            background:
              'linear-gradient(90deg, rgba(20,17,13,0.94) 0%, rgba(20,17,13,0.82) 34%, rgba(20,17,13,0.18) 62%, rgba(20,17,13,0.05) 100%),' +
              'linear-gradient(180deg, rgba(20,17,13,0.55) 0%, rgba(20,17,13,0) 30%, rgba(20,17,13,0) 62%, rgba(20,17,13,0.85) 100%)',
          }}
          aria-hidden
        />
      </div>

      {/* `h-full` rather than a second `min-h-[100svh]`. Stacking both made the
          section taller than the viewport by its own padding, so the hero never
          fitted on one screen - the canvas measured 1035px inside a 950px
          window and the last figures sat below the fold. */}
      <div className="relative flex h-full flex-col justify-between px-6 py-8 sm:px-10 sm:py-10 lg:px-16">
        <header className="flex items-baseline justify-between gap-6">
          <p className="font-mono text-lede uppercase tracking-[0.28em] text-warm-white">
            Vantage
          </p>
          <p className="font-mono text-micro uppercase tracking-[0.14em] text-brass">
            open source · MIT · identifies nobody
          </p>
        </header>

        <div className="max-w-3xl py-8">
          <p className="eyebrow reveal is-revealed">01 — What a camera does not know</p>
          <Headline id="hero-title" as="h1" className="!text-hero is-revealed">
            A camera sees pixels. It does not see that somebody has been standing there for
            twenty seconds.
          </Headline>
          <p className="beat-lede reveal is-revealed">
            Vantage is a modular platform for understanding what happens in video{' '}
            <em className="not-italic text-warm-white">over time</em> — tracking, activity,
            spatial reasoning, and historical baselines — that reports the readings it cannot
            make rather than guessing them.
          </p>
        </div>

        <div>
          {status === 'unavailable' ? (
            <p className="max-w-prose border-l-2 border-brass/50 pl-5 font-mono text-tiny leading-relaxed text-warm-white/70">
              The 3D facility twin needs WebGL, and this browser has not given it. Nothing
              is drawn rather than something plausible: the room below would otherwise look
              empty, and an empty building is a claim.
            </p>
          ) : (
            <div className="grid max-w-3xl grid-cols-2 gap-x-10 gap-y-6 sm:grid-cols-4">
              <Figure
                value={facility ? `${facility.width_m}×${facility.depth_m} m` : '—'}
                label="facility, as configured"
              />
              <Figure value={String(twin.cameras.length)} label="cameras, real yaw & FOV" />
              <Figure value={String(twin.entities.length)} label="anonymous entities" />
              <Figure
                value={stats ? String(stats.calls) : '—'}
                label="draw calls this frame"
                testId="draw-calls"
              />
            </div>
          )}

          <p className="mt-10 max-w-prose text-tiny leading-relaxed text-ink-faint">
            Every figure above came out of a real 72-second run over three cameras. The twin
            has never held an image — it holds a floor plan and anonymous positions, which is
            what this project argues a video system should reduce to.
          </p>
        </div>
      </div>
    </section>
  );
};
