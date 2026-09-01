/**
 * Beat 3 — the thing that matters happened over time.
 *
 * A single frame cannot contain any of these sentences. "Stationary for 20s" is
 * not visible in a frame; neither is "co-appeared 6 times"; neither is "crossed
 * from the west camera to the north one, 36.8 seconds in transit". Each of them
 * is a conclusion about a duration, which is the whole difference between a
 * detector and this.
 *
 * So the beat is a ledger rather than a picture, and it fills in as it is
 * scrolled: a real event stream from a real 72-second facility run over three
 * cameras, ordered as it happened, each line showing the evidence the rule
 * actually recorded rather than a summary of it.
 *
 * Two things are deliberately visible in it that a marketing page would
 * normally cut. Bicycles and cars appear alongside people, because the rules run
 * on tracked entities and the page should not imply a person-only system. And
 * every identifier is anonymous - `person_23`, `bicycle_52` - because that is
 * the only kind of identifier the tracker has.
 */

import React from 'react';
import { Beat, Headline, Reveal } from '../components/Beat';
import live from '../captured/facility-live.json';
import history from '../captured/history-events.json';

interface CapturedEvent {
  id: string | number;
  rule: string;
  severity: string;
  summary: string;
  timestamp: number;
  elapsed_s?: number;
  camera_id?: string;
  evidence?: Record<string, unknown> | null;
}

/** The evidence line each rule records, rendered as the rule wrote it. */
function evidenceOf(event: CapturedEvent): string | null {
  const evidence = event.evidence;
  if (!evidence) return null;
  for (const key of ['summary', 'why']) {
    const value = evidence[key];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  if (typeof evidence.transit_time_s === 'number') {
    return `${evidence.transit_time_s.toFixed(1)}s in transit between cameras`;
  }
  if (typeof evidence.spread_rate === 'number' && typeof evidence.entity_count === 'number') {
    return `${evidence.entity_count} entities, spread rate ${evidence.spread_rate.toFixed(3)}`;
  }
  return null;
}

const SEVERITY: Record<string, string> = {
  info: 'text-brass',
  notice: 'text-string-red-light',
  warning: 'text-string-red-light',
  alert: 'text-string-red',
};

/**
 * The facility run first, because it is one continuous 72 seconds and reads as a
 * story; then the single-camera history, which is a different session and is
 * labelled as one. Concatenating them without saying so would imply a single
 * timeline that never existed.
 */
const facilityEvents = ([...live.events] as CapturedEvent[])
  .sort((a, b) => (a.elapsed_s ?? 0) - (b.elapsed_s ?? 0))
  .filter((event, index, all) => all.findIndex((other) => other.id === event.id) === index);

const historyEvents = ([...history.events] as CapturedEvent[])
  .sort((a, b) => a.timestamp - b.timestamp)
  .slice(0, 6);

const Row: React.FC<{ event: CapturedEvent; stamp: string; delay: number }> = ({
  event,
  stamp,
  delay,
}) => {
  const evidence = evidenceOf(event);
  return (
    <Reveal delay={delay}>
      <li className="grid grid-cols-[4.5rem_1fr] gap-x-5 border-t border-brass/12 py-4 sm:grid-cols-[5.5rem_9rem_1fr] sm:gap-x-8">
        <span className="font-mono text-tiny tabular-nums text-ink-faint">{stamp}</span>
        <span
          className={`hidden font-mono text-micro uppercase tracking-[0.12em] sm:block ${
            SEVERITY[event.severity] ?? 'text-brass'
          }`}
        >
          {event.rule.replace(/_/g, ' ')}
        </span>
        <span>
          <span className="block text-body leading-snug text-warm-white/90">{event.summary}</span>
          {evidence ? (
            <span className="mt-1 block font-mono text-tiny text-ink-faint">{evidence}</span>
          ) : null}
          <span
            className={`mt-1 block font-mono text-micro uppercase tracking-[0.12em] sm:hidden ${
              SEVERITY[event.severity] ?? 'text-brass'
            }`}
          >
            {event.rule.replace(/_/g, ' ')}
          </span>
        </span>
      </li>
    </Reveal>
  );
};

export const Time: React.FC = () => (
  <Beat id="time" eyebrow="03 — Time" className="!justify-start">
    <Headline id="time-title">A frame cannot tell you someone has been standing there.</Headline>

    <Reveal delay={80}>
      <p className="beat-lede">
        Every line below is a conclusion about a duration, drawn from a real run.
        None of them exist in any single frame, and none of them name anybody.
      </p>
    </Reveal>

    <Reveal delay={140}>
      <p className="mt-12 font-mono text-micro uppercase tracking-[0.16em] text-brass">
        72 seconds · three cameras · {facilityEvents.length} events
      </p>
    </Reveal>

    <ul className="mt-6 max-w-3xl">
      {facilityEvents.map((event, index) => (
        <Row
          key={event.id}
          event={event}
          delay={Math.min(index, 3) * 60}
          stamp={`+${(event.elapsed_s ?? 0).toFixed(1)}s`}
        />
      ))}
    </ul>

    <Reveal>
      <p className="mt-16 font-mono text-micro uppercase tracking-[0.16em] text-brass">
        a different session · one camera · stored history
      </p>
    </Reveal>

    <ul className="mt-6 max-w-3xl">
      {historyEvents.map((event, index) => (
        <Row
          key={event.id}
          event={event}
          delay={Math.min(index, 3) * 60}
          stamp={new Date(event.timestamp * 1000).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        />
      ))}
    </ul>

    <Reveal>
      <p className="mt-14 max-w-prose border-t border-brass/25 pt-8 text-body leading-relaxed text-warm-white/55">
        Cars and bicycles are in that list because the rules run on tracked entities, not
        on people alone — and one of the README's thirty-four limitations is about a
        potted plant that was briefly reported as running. Every identifier is anonymous
        and stays anonymous: the tracker has no other kind.
      </p>
    </Reveal>
  </Beat>
);
