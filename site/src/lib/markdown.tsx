/**
 * The smallest markdown renderer that reads the README honestly.
 *
 * Beat 6 quotes the README's Known Limitations section verbatim, extracted by
 * `tools/capture_data.py` as the paragraphs it is written as. Those paragraphs
 * carry three kinds of inline markup and no others: `**emphasis**` on the clause
 * that leads each one, `` `code` `` around config keys, thresholds and command
 * names, and the occasional `*word*` stressing a single term. Rendering them as
 * plain text would flatten "**Transitions are reported late** by up to
 * `state.min_state_s`" into a sentence with no shape - and leaving the single
 * asterisks out, which the first version did, put a literal `*depth*` on the
 * page in the first entry.
 *
 * A markdown library would be 30-50 KB gzipped to handle a syntax this page
 * does not use, and any library that emits HTML brings a sanitisation question
 * with it. This emits React elements, so there is no HTML string anywhere and
 * nothing to sanitise.
 */

import React from 'react';

// `**` first, so a bold run is never mistaken for two italics.
const TOKEN = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;

export function inlineMarkdown(source: string): React.ReactNode[] {
  return source.split(TOKEN).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={index} className="font-semibold text-warm-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return (
        <em key={index} className="italic text-warm-white/90">
          {part.slice(1, -1)}
        </em>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code key={index} className="font-mono text-[0.92em] text-brass-light">
          {part.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}
