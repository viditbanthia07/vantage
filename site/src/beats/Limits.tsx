/**
 * Beat 6 — here is what it gets wrong.
 *
 * The strongest section on the page and the one that will feel wrong to ship.
 * Almost nothing in this category will tell you what it cannot do; a page that
 * leads with thirty-four failures is more persuasive to the two audiences that
 * matter than any amount of spectacle, and it is differentiating in a way a
 * WebGL hero is not.
 *
 * Deliberately the plainest thing here: a long scroll of text, no cards, no
 * columns, no icons, styled *down* relative to everything above it. Presenting
 * failures as a designed feature grid would be a way of not quite meaning them.
 *
 * The entries are extracted from the README's own Known Limitations section by
 * `tools/capture_data.py`, so this page cannot confess to a limitation the
 * project has fixed, and cannot omit one it has found.
 */

import React from 'react';
import { Beat, Headline, Reveal } from '../components/Beat';
import { inlineMarkdown } from '../lib/markdown';
import limitations from '../captured/limitations.json';

export const Limits: React.FC = () => {
  const entries = limitations.entries;

  return (
    <Beat id="limits" eyebrow="06 — Limits" className="!justify-start">
      {/* The count is interpolated rather than written out. A headline that says
          "thirty-four" while the list holds thirty-six is exactly the drift the
          extraction was built to prevent, and it would be the one sentence on the
          page a reader could catch out. */}
      <Headline id="limits-title">{`${entries.length} things it gets wrong.`}</Headline>

      <Reveal delay={80}>
        <p className="beat-lede">
          Not a footnote and not a roadmap. This is the README's Known Limitations
          section, on the marketing page, in full — read straight out of the README at
          build time so the two cannot drift apart.
        </p>
      </Reveal>

      <Reveal delay={140}>
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-micro uppercase tracking-[0.14em] text-ink-faint">
          <span>{entries.length} entries</span>
          <span aria-hidden>·</span>
          <span>source: {limitations.source}</span>
        </div>
      </Reveal>

      <div className="mt-16 max-w-prose">
        {entries.map((entry, index) => (
          <Reveal key={entry.lead} delay={Math.min(index, 3) * 60}>
            <article className="border-t border-brass/15 py-7">
              <p className="text-body leading-[1.75] text-warm-white/70">
                {inlineMarkdown(entry.markdown)}
              </p>
            </article>
          </Reveal>
        ))}
      </div>

      <Reveal>
        <p className="mt-14 max-w-prose border-t border-brass/25 pt-8 text-body leading-relaxed text-warm-white/55">
          Every one of those is a measurement someone made and wrote down rather than a
          thing nobody looked at. That is the actual claim of this page: not that Vantage
          is finished, but that it knows where it is not.
        </p>
      </Reveal>
    </Beat>
  );
};
