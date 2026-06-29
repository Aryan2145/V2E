'use client'

import React from 'react'
import { TIMINGS, TIMING_META, type TimingCounts } from '@/lib/types/tasks'

/**
 * The stacked completion-timing bar used across the dashboard (leaderboards, breakdowns).
 * Segments are proportional to each bucket's share of the row total, colored by the
 * brand-system timing palette. Zero-width buckets are omitted.
 */
export default function TimingMiniBar({
  timing,
  height = 7,
  className = '',
}: {
  timing: TimingCounts
  height?: number
  className?: string
}) {
  const total = TIMINGS.reduce((s, t) => s + (timing[t] || 0), 0)
  if (!total) {
    return <div className={`text-[12px] text-[#94A3B8] ${className}`} style={{ height }}>No tasks</div>
  }
  return (
    <div className={`flex w-full rounded-full overflow-hidden bg-[#F1F5F9] ${className}`} style={{ height }}>
      {TIMINGS.map((t) =>
        timing[t] > 0 ? (
          <div
            key={t}
            title={`${TIMING_META[t].label}: ${timing[t]}`}
            style={{ width: `${(timing[t] / total) * 100}%`, backgroundColor: TIMING_META[t].color }}
          />
        ) : null,
      )}
    </div>
  )
}
