/**
 * Beat 5 — it says when it does not know.
 *
 * After four beats of motion, this one has none: no scrub, no draw-on, nothing
 * pinned. That is the whole design of it. A section that stops moving in a page
 * that has been moving is louder than another effect would be, and the claim
 * being made - that the interesting behaviour is the refusal - is not one that
 * survives being animated.
 *
 * Every sentence in the cards is a recording. `tools/capture_data.py` asks each
 * API route a question it cannot answer, from a run with no store and from a
 * store with nothing in it, and writes down what comes back. Nothing here was
 * typed by hand, which is the only way a page can quote a system honestly.
 */

import React from 'react';
import { Beat, Headline, Reveal } from '../components/Beat';
import refusals from '../captured/refusals.json';

export const Restraint: React.FC = () => (
  <Beat id="restraint" eyebrow="05 — Restraint">
    <Headline id="restraint-title">It says when it does not know.</Headline>

    <Reveal delay={80}>
      <p className="beat-lede">
        An empty panel and a quiet room look identical. Every surface in Vantage that
        cannot answer says so in a sentence, names the flag that would change it, and
        returns nothing rather than zero — because a zero is a reading and an absence
        is not.
      </p>
    </Reveal>

    <Reveal delay={160}>
      <ul className="mt-14 grid gap-px overflow-hidden rounded-sm bg-brass/15 sm:grid-cols-2">
        {refusals.refusals.map((refusal) => (
          <li key={refusal.reason} className="bg-board p-6">
            <p className="font-mono text-micro uppercase tracking-[0.14em] text-brass">
              {refusal.route}
            </p>
            <p className="mt-3 font-mono text-body leading-relaxed text-warm-white/90">
              “{refusal.reason}”
            </p>
            <p className="mt-3 text-tiny text-ink-faint">{refusal.condition}</p>
          </li>
        ))}
      </ul>
    </Reveal>

    <Reveal delay={200}>
      <p className="mt-10 max-w-prose text-body leading-relaxed text-warm-white/55">
        Captured, not composed. <code className="font-mono text-brass-light">tools/capture_data.py</code>{' '}
        puts each of those questions to a real dashboard and writes down the answer, so this
        list cannot say something the code does not.
      </p>
    </Reveal>
  </Beat>
);
