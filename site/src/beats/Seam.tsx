/**
 * Beat 2 — detection is not understanding.
 *
 * Five real renders of one frame, each adding a stage: the raw frame, then boxes,
 * then track identities and trails, then pose, then the activity and relation
 * layer the console draws on top. `tools/capture_media.py` writes all five from
 * one pass of the actual pipeline, so each is that stage's real output rather
 * than an illustration of it.
 *
 * **Why the footage is synthetic, and why that is the honest choice.** The
 * obvious hero here is a street: real people, dense boxes, an impressive picture.
 * Two things rule it out. The clips this project tests against are Creative
 * Commons files whose attribution this repository never recorded, so republishing
 * them on a public page would be a licence breach; and they show identifiable
 * members of the public who did not agree to appear on a marketing page for a
 * surveillance system. So the page shows the source that is ours and reproducible
 * in one command, and says plainly that the detector finds very little in it.
 * That is a weaker picture and a stronger claim.
 *
 * The stills are `<img>` with explicit dimensions and `loading="lazy"` below the
 * first: no layout shift, no fetch until they are near.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Beat, Headline, Reveal } from '../components/Beat';
import { prefersReducedMotion } from '../lib/motion';

const LAYERS = [
  {
    file: 'layers-0-raw.jpg',
    stage: 'Raw',
    claim: 'A frame. 960×540, 30 per second, and no opinion about any of it.',
  },
  {
    file: 'layers-1-detection.jpg',
    stage: 'Detection',
    claim:
      'YOLOX-tiny, 80 COCO classes, on the CPU. One of the four objects clears the confidence floor, and it is called a sports ball. The other three are below it and the detector says nothing about them at all.',
  },
  {
    file: 'layers-2-tracking.jpg',
    stage: 'Tracking',
    claim:
      'The same detection, given an identity that survives frames it was not detected in, and a trail. A dashed box means the position is predicted rather than observed — the system draws the difference rather than hiding it.',
  },
  {
    file: 'layers-3-pose.jpg',
    stage: 'Pose',
    claim:
      'Seventeen keypoints per person, when there is a person. There is not one here, so this layer is honestly empty rather than decorated.',
  },
  {
    file: 'layers-4-activity.jpg',
    stage: 'Activity & relations',
    claim:
      'Motion state from speed in entity heights per second, and the proximity and approach relations between everything tracked. "receding 1.00" is a measurement, not a label.',
  },
] as const;

const FRAME = { width: 960, height: 540 } as const;

/**
 * Media paths go through Vite's base rather than being written relative.
 *
 * `media/hero.webm` resolves against the current URL, which is correct at
 * `/vantage/` and silently wrong at `/vantage` - the browser drops the last
 * segment and asks for `/media/hero.webm`. `BASE_URL` is whatever
 * `VANTAGE_SITE_BASE` was at build time and always ends in a slash.
 */
const media = (file: string): string => `${import.meta.env.BASE_URL}media/${file}`;

/**
 * The scrub: one decoding video, composited to a canvas.
 *
 * The clip is stacked - analysed frames on top of the same raw frames
 * underneath, written that way by `tools/capture_media.py` - so the comparison
 * is between two halves of one texture. Two `<video>` elements started together
 * drift apart within seconds however carefully they are synchronised, and a
 * comparison of two frames that are not the same frame is exactly the kind of
 * small lie this page is about. A video element can only be in one place in the
 * DOM, so the composite is done in a canvas: two `drawImage` calls per frame,
 * one from each half of the same decoded picture. The two sides cannot
 * disagree, because there is only ever one frame.
 *
 * The video element itself is kept in the document and hidden rather than
 * detached: a detached element does not decode reliably across browsers.
 *
 * The handle is a range input rather than a div with pointer handlers - keyboard
 * operable, announced correctly, and draggable on touch without any of that
 * being written here.
 */
const Scrub: React.FC = () => {
  const [split, setSplit] = useState(50);
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Read inside the animation frame and the visibility handler, which must see
  // the current values without being torn down and rebuilt on every scrub.
  const splitRef = useRef(split);
  splitRef.current = split;
  const playingRef = useRef(playing);
  playingRef.current = playing;

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!video || !canvas || !context) return;

    let frame = 0;
    const draw = () => {
      if (video.readyState >= 2) {
        const boundary = Math.round((splitRef.current / 100) * FRAME.width);
        // Left of the boundary, the analysed half; right of it, the raw half.
        // Both from the same decoded picture, at the same instant.
        if (boundary > 0) {
          context.drawImage(video, 0, 0, boundary, FRAME.height, 0, 0, boundary, FRAME.height);
        }
        if (boundary < FRAME.width) {
          const rest = FRAME.width - boundary;
          context.drawImage(
            video,
            boundary, FRAME.height, rest, FRAME.height,
            boundary, 0, rest, FRAME.height,
          );
        }
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);

    // Autoplay only when muted, inline, and not against a stated preference. A
    // refused play() is a state rather than an exception: the first frame stays
    // on the canvas and the button offers to start it.
    if (!prefersReducedMotion()) {
      video.play().then(
        () => setPlaying(true),
        () => setPlaying(false),
      );
    }

    // Nothing decodes while the tab is in the background.
    const onVisibility = () => {
      if (document.hidden) video.pause();
      else if (playingRef.current) void video.play().catch(() => undefined);
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', onVisibility);
      video.pause();
    };
  }, []);

  const toggle = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().then(
        () => setPlaying(true),
        () => setPlaying(false),
      );
    } else {
      video.pause();
      setPlaying(false);
    }
  }, []);

  return (
    <div className="relative">
      <div className="relative overflow-hidden border border-brass/20 bg-board-surface">
        <canvas
          ref={canvasRef}
          width={FRAME.width}
          height={FRAME.height}
          className="block w-full"
          role="img"
          aria-label="One synthetic frame shown two ways at once: the analysed render on the left of a movable boundary, the raw frame on the right."
        />

        <video
          ref={videoRef}
          className="pointer-events-none absolute h-px w-px opacity-0"
          poster={media('hero-poster.jpg')}
          preload="metadata"
          muted
          loop
          playsInline
          aria-hidden
          tabIndex={-1}
        >
          <source src={media('hero.webm')} type="video/webm" />
          <source src={media('hero.mp4')} type="video/mp4" />
        </video>

        <div
          className="pointer-events-none absolute inset-y-0 w-px bg-string-red"
          style={{ left: `${split}%` }}
          aria-hidden
        />
        <div className="pointer-events-none absolute left-4 top-4 font-mono text-micro uppercase tracking-[0.16em] text-warm-white/80">
          analysed
        </div>
        <div className="pointer-events-none absolute right-4 top-4 font-mono text-micro uppercase tracking-[0.16em] text-warm-white/60">
          raw
        </div>
      </div>

      <div className="mt-4 flex items-center gap-5">
        <button
          type="button"
          onClick={toggle}
          className="rounded-sm border border-brass/30 px-3 py-1 font-mono text-micro uppercase tracking-[0.12em] text-warm-white/80 transition-colors hover:border-brass hover:text-warm-white"
        >
          {playing ? 'pause' : 'play'}
        </button>
        <label className="flex flex-1 items-center gap-4">
          <span className="font-mono text-micro uppercase tracking-[0.12em] text-ink-faint">
            scrub
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={split}
            onChange={(event) => setSplit(Number(event.target.value))}
            aria-label="Move the boundary between the analysed frames and the raw frames"
            className="h-1 flex-1 cursor-ew-resize appearance-none rounded bg-brass/25 accent-string-red"
          />
        </label>
      </div>
    </div>
  );
};

export const Seam: React.FC = () => (
  <Beat id="seam" eyebrow="02 — The seam" className="!justify-start">
    <Headline id="seam-title">Detection is not understanding.</Headline>

    <Reveal delay={80}>
      <p className="beat-lede">
        A detector answers “what is in this frame”. Everything Vantage is for is the
        next five questions, and each one is a separate stage with its own contract,
        its own evaluation and its own way of saying it does not know.
      </p>
    </Reveal>

    {/* The scrub sits in a column beside its explanation rather than full width.
        It is the most eye-catching element in the beat and the least impressive
        content on the page - four circles, one of them detected - and giving it
        the whole viewport made the page's weakest asset its loudest one. The
        layer sequence below is the argument; this is the demonstration that the
        two halves are the same frame. */}
    <Reveal delay={140}>
      <div className="mt-14 grid items-start gap-8 lg:grid-cols-[1.4fr_1fr] lg:gap-14">
        <Scrub />
        <div className="lg:pt-2">
          <p className="font-mono text-micro uppercase tracking-[0.16em] text-brass">
            the same frame, twice
          </p>
          <p className="mt-4 text-body leading-relaxed text-warm-white/75">
            Drag the boundary. Left of it is what the pipeline drew; right of it is
            what the camera sent. Both halves come out of one decoding video and one
            decoded frame — two players started together drift apart within seconds,
            and a comparison of two frames that are not the same frame is exactly the
            kind of small lie this page is about.
          </p>
        </div>
      </div>
    </Reveal>

    <div className="mt-24 space-y-20">
      {LAYERS.map((layer, index) => (
        <Reveal key={layer.file} delay={60}>
          <div className="grid items-start gap-8 lg:grid-cols-[1.25fr_1fr] lg:gap-14">
            <figure className="border border-brass/20 bg-board-surface/50">
              <img
                src={media(layer.file)}
                width={960}
                height={540}
                loading={index === 0 ? 'eager' : 'lazy'}
                decoding="async"
                alt={`Frame 180 of the synthetic source with the ${layer.stage.toLowerCase()} layer drawn on it.`}
                className="block w-full"
              />
            </figure>
            <div>
              <p className="font-mono text-micro uppercase tracking-[0.16em] text-brass">
                {String(index).padStart(2, '0')} · {layer.stage}
              </p>
              <p className="mt-4 text-body leading-relaxed text-warm-white/75">{layer.claim}</p>
            </div>
          </div>
        </Reveal>
      ))}
    </div>

    <Reveal>
      <div className="mt-20 max-w-prose border-t border-brass/25 pt-8">
        <p className="text-body leading-relaxed text-warm-white/55">
          The footage is the built-in synthetic source, and it is not flattering: four
          coloured circles, of which the detector confidently finds one. It is here rather
          than a street because the street clips this project tests against show
          identifiable people who never agreed to appear on a page selling video
          analytics. Run{' '}
          <code className="font-mono text-brass-light">
            vantage run --source "synthetic://?objects=4"
          </code>{' '}
          and you get these exact frames.
        </p>
      </div>
    </Reveal>
  </Beat>
);
