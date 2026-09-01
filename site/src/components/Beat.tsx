/**
 * A beat, and the two things every beat shares.
 *
 * `Beat` is one claim on one screenful, with the section landmark and the
 * heading relationship that make the narrative navigable as a list of headings
 * rather than as a scroll. `Headline` is the only element on the page that
 * animates per-word.
 */

import React from 'react';
import { staggerStep } from '../lib/motion';

export const Beat: React.FC<{
  id: string;
  /** The stamped label above the headline. Doubles as the accessible name. */
  eyebrow: string;
  className?: string;
  children: React.ReactNode;
}> = ({ id, eyebrow, className, children }) => (
  <section
    id={id}
    aria-labelledby={`${id}-title`}
    className={`beat ${className ?? ''}`}
    style={{ contain: 'layout paint' }}
  >
    <div className="beat-inner">
      <p className="eyebrow reveal">{eyebrow}</p>
      {children}
    </div>
  </section>
);

/**
 * A headline that arrives a word at a time.
 *
 * The words are spans in the markup, so the headline is a single readable
 * string to a screen reader and to a page with JavaScript off - `splitWords`
 * here happens at render rather than by rewriting the DOM afterwards, which is
 * what makes that true. The stagger step shrinks as the word count grows so a
 * four-word headline and a fourteen-word one take about the same time.
 *
 * `as` because two beats want an `h1`-sized headline that is not the `h1`.
 */
export const Headline: React.FC<{
  id: string;
  children: string;
  as?: 'h1' | 'h2';
  className?: string;
}> = ({ id, children, as = 'h2', className }) => {
  const words = children.split(' ');
  const step = staggerStep(words.length);
  const Tag = as;

  return (
    <Tag id={id} className={`beat-title reveal ${className ?? ''}`}>
      {words.map((word, index) => (
        <React.Fragment key={`${word}-${index}`}>
          <span className="word" style={{ ['--word-delay' as string]: `${index * step}ms` }}>
            {word}
          </span>
          {index < words.length - 1 ? ' ' : null}
        </React.Fragment>
      ))}
    </Tag>
  );
};

/**
 * A block that arrives on scroll.
 *
 * The delay is capped rather than multiplied out: three stacked blocks reading
 * 0/90/180ms is a sequence, and eight reading up to 630ms is a queue the reader
 * is waiting in.
 */
export const Reveal: React.FC<{
  delay?: number;
  className?: string;
  children: React.ReactNode;
}> = ({ delay = 0, className, children }) => (
  <div
    className={`reveal ${className ?? ''}`}
    style={{ ['--reveal-delay' as string]: `${Math.min(delay, 240)}ms` }}
  >
    {children}
  </div>
);
