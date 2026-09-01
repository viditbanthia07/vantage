/**
 * Beat 7 — one command.
 *
 * The page's only job at the end is to be easy to leave in the right direction.
 * Two commands, one link, and the licence.
 *
 * The copy button is the one piece of interaction on the page that can fail
 * silently: `navigator.clipboard` is unavailable on an insecure origin and can
 * be refused by permission policy. So the failure is a state rather than a
 * shrug - the button says "select it instead" and the command stays selectable
 * either way.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Beat, Headline, Reveal } from '../components/Beat';

const REPO = 'https://github.com/viditbanthia07/vantage';

const COMMANDS = [
  {
    label: 'Run it on nothing but a laptop',
    command: 'vantage run --source "synthetic://?objects=3" --dashboard',
    note: 'No camera, no footage, no model download beyond the bundled one. The dashboard comes up on localhost:8800.',
  },
  {
    label: 'Run it on a camera',
    command: 'vantage run --source webcam:0 --dashboard',
    note: 'Same pipeline. Nothing leaves the machine, and nothing is identified.',
  },
] as const;

type CopyState = 'idle' | 'copied' | 'unavailable';

const CommandLine: React.FC<{ label: string; command: string; note: string }> = ({
  label,
  command,
  note,
}) => {
  const [state, setState] = useState<CopyState>('idle');
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(command);
      setState('copied');
    } catch {
      // Not swallowed: the button changes to say what to do instead.
      setState('unavailable');
    }
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState('idle'), 2400);
  }, [command]);

  return (
    <div className="border border-brass/20 bg-board-surface/60">
      <div className="flex items-center justify-between gap-4 border-b border-brass/15 px-5 py-3">
        <span className="font-mono text-micro uppercase tracking-[0.14em] text-brass">
          {label}
        </span>
        <button
          type="button"
          onClick={copy}
          className="rounded-sm border border-brass/30 px-3 py-1 font-mono text-micro uppercase tracking-[0.12em] text-warm-white/80 transition-colors hover:border-brass hover:text-warm-white"
        >
          {state === 'copied' ? 'copied' : state === 'unavailable' ? 'select it instead' : 'copy'}
          {/* The result is announced, not only coloured. */}
          <span className="sr-only" role="status">
            {state === 'copied'
              ? 'Command copied to the clipboard.'
              : state === 'unavailable'
                ? 'The clipboard is unavailable here; select the command manually.'
                : ''}
          </span>
        </button>
      </div>
      <pre className="overflow-x-auto px-5 py-4 font-mono text-body text-warm-white">
        <code>{command}</code>
      </pre>
      <p className="border-t border-brass/10 px-5 py-3 text-tiny leading-relaxed text-ink-faint">
        {note}
      </p>
    </div>
  );
};

export const RunIt: React.FC = () => (
  <Beat id="run" eyebrow="07 — Run it">
    <Headline id="run-title">One command, and it is running.</Headline>

    <Reveal delay={80}>
      <p className="beat-lede">
        Python 3.11 or newer, <code className="font-mono text-brass-light">pip install -e .</code>,
        and a detector that ships with it. No account, no key, no cloud.
      </p>
    </Reveal>

    <Reveal delay={140}>
      <div className="mt-12 grid gap-5 lg:grid-cols-2">
        {COMMANDS.map((entry) => (
          <CommandLine key={entry.command} {...entry} />
        ))}
      </div>
    </Reveal>

    <Reveal delay={200}>
      <div className="mt-14 flex flex-wrap items-center gap-x-8 gap-y-4">
        <a
          href={REPO}
          className="border-b border-string-red pb-1 font-mono text-lede uppercase tracking-[0.1em] text-warm-white transition-colors hover:text-string-red-light"
        >
          The repository →
        </a>
        <a
          href={`${REPO}#readme`}
          className="border-b border-brass/40 pb-1 font-mono text-lede uppercase tracking-[0.1em] text-warm-white/70 transition-colors hover:text-warm-white"
        >
          The README →
        </a>
      </div>
    </Reveal>

    <Reveal delay={240}>
      <div className="mt-24 border-t border-brass/15 pt-8">
        <p className="max-w-prose text-body leading-relaxed text-warm-white/55">
          Vantage is MIT-licensed, and every model it ships is chosen for its licence as
          much as its accuracy. It identifies nobody by default; the optional identity
          subsystem requires consented enrolment and documents its own unverified
          discrimination.
        </p>
        <p className="mt-6 max-w-prose text-tiny leading-relaxed text-ink-faint">
          This page loads nothing from a third party — no fonts, no scripts, no analytics,
          no trackers. Everything it shows came out of a real run, and the two scripts that
          captured it are in the repository as{' '}
          <code className="font-mono">tools/capture_media.py</code> and{' '}
          <code className="font-mono">tools/capture_data.py</code>.
        </p>
      </div>
    </Reveal>
  </Beat>
);
