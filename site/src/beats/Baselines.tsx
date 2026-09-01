/**
 * Beat 4 — "unusual" needs a definition of usual.
 *
 * This beat renders the console's own `TrendChart`, imported rather than
 * reimplemented, against a payload captured from a real `/api/analytics` call
 * over a real store. Same component, same data shape, same drawing rules. A
 * reimplementation would be a picture of a chart; this is the chart.
 *
 * And what it draws is almost entirely empty, which is the point of putting it
 * here. The store behind it holds about four hours of history in a
 * seven-day window: one bucket with a reading, a hundred and sixty-eight
 * without, and an anomaly detector that declines to judge any of them. The
 * temptation was to generate a month of plausible history and cap one bar in
 * red. That is precisely the lie this project exists not to tell, and the real
 * chart makes the argument better - the hatching is the heartbeat table doing
 * its job, distinguishing "nobody was there" from "nothing was recording".
 */

import React from 'react';
import { TrendChart } from '@console/features/analytics/TrendChart';
import type { AnalyticsAnomaly, AnalyticsBucket } from '@console/contracts/types';
import { Beat, Headline, Reveal } from '../components/Beat';
import analytics from '../captured/history-analytics.json';

const buckets = analytics.buckets as AnalyticsBucket[];
const anomalies = (analytics.anomalies ?? []) as AnalyticsAnomaly[];
const withReadings = buckets.filter((bucket) => bucket.samples > 0).length;

const Figure: React.FC<{ value: string; label: string }> = ({ value, label }) => (
  <div>
    <p className="font-mono text-display text-warm-white">{value}</p>
    <p className="mt-1 text-tiny leading-snug text-ink-faint">{label}</p>
  </div>
);

export const Baselines: React.FC = () => (
  <Beat id="baselines" eyebrow="04 — Baselines">
    <Headline id="baselines-title">“Unusual” needs a definition of usual.</Headline>

    <Reveal delay={80}>
      <p className="beat-lede">
        Vantage learns what an hour of a weekday normally looks like — a median and a
        median absolute deviation per slot — and calls something unusual only against
        that. Below three observed samples, a slot is not judged at all.
      </p>
    </Reveal>

    <Reveal delay={160}>
      <figure className="mt-14 border border-brass/20 bg-board-surface/50 p-5 sm:p-8">
        <figcaption className="mb-6 flex flex-wrap items-baseline justify-between gap-4">
          <span className="font-mono text-micro uppercase tracking-[0.14em] text-brass">
            /api/analytics · metric={analytics.metric} · 7 days · 1-hour buckets
          </span>
          <span className="font-mono text-micro text-ink-faint">
            captured from a real store
          </span>
        </figcaption>

        <TrendChart
          buckets={buckets}
          anomalies={anomalies}
          intervalSeconds={analytics.interval_s}
          unitLabel={analytics.label}
          height={220}
        />
      </figure>
    </Reveal>

    <Reveal delay={200}>
      <div className="mt-10 grid grid-cols-2 gap-8 sm:grid-cols-4">
        <Figure value={String(buckets.length)} label="buckets in the window" />
        <Figure value={String(withReadings)} label="that hold a reading" />
        <Figure
          value={`${(analytics.coverage * 100).toFixed(1)}%`}
          label="coverage, reported rather than smoothed over"
        />
        <Figure value={String(analytics.unjudged)} label="slots it declined to judge" />
      </div>
    </Reveal>

    <Reveal delay={240}>
      <div className="mt-12 max-w-prose space-y-5">
        <p className="quote-card">“{analytics.anomalies_reason}”</p>
        <p className="text-body leading-relaxed text-warm-white/60">
          That is a real chart of a real database with about four hours of history in it.
          Generating a convincing month and capping one bar in red would have taken ten
          minutes and would have been the exact thing every other page in this category
          does. Analytics needs roughly four weeks before it will say anything, and it
          says so rather than filling the gap.
        </p>
      </div>
    </Reveal>
  </Beat>
);
