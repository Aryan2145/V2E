'use client'

import { useMemo } from 'react'
import { TrendingUp } from 'lucide-react'
import type { GoalMeasure } from '@/lib/types/goals'

function toNum(v: string | null | undefined): number | null {
  if (v === null || v === undefined) return null
  const n = parseFloat(String(v).replace(/[, ]/g, ''))
  return isNaN(n) ? null : n
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' })
}

/**
 * A measure's trajectory: recorded actuals over time (the line) against the
 * target (the dashed reference). This is the chart that turns a frozen number
 * into a story — where we were, where we are, and the pace we'd need from here.
 */
export default function MeasureTrajectory({ measure }: { measure: GoalMeasure }) {
  const target = toNum(measure.target_value)

  const points = useMemo(() => {
    const ci = (measure.check_ins ?? [])
      .slice()
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    return ci
      .map((c) => ({ value: toNum(c.value), date: c.created_at }))
      .filter((p): p is { value: number; date: string } => p.value !== null)
  }, [measure.check_ins])

  const latest = points.length ? points[points.length - 1].value : toNum(measure.current_value)
  const pctToTarget =
    target && target !== 0 && latest !== null
      ? Math.max(0, Math.min(100, Math.round((latest / target) * 100)))
      : null

  // Chart geometry (viewBox units; strokes use non-scaling-stroke so they stay crisp).
  const W = 300
  const H = 80
  const PAD_Y = 10
  const numeric = target !== null && points.length > 0
  const yMax = numeric ? Math.max(target, ...points.map((p) => p.value)) * 1.12 || 1 : 1
  const yOf = (v: number) => H - PAD_Y - (v / yMax) * (H - PAD_Y * 2)
  const xOf = (i: number) =>
    points.length <= 1 ? W / 2 : (i / (points.length - 1)) * (W - 16) + 8

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xOf(i)} ${yOf(p.value)}`).join(' ')
  const targetY = numeric ? yOf(target!) : 0

  const onTrack = pctToTarget !== null && pctToTarget >= 100
  const lineColor = onTrack ? '#16A34A' : '#2563EB'

  return (
    <div className="border border-[#E2E8F0] rounded-[10px] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[#0F172A] truncate">{measure.name}</p>
          <p className="text-[22px] font-bold text-[#0F172A] mt-0.5 leading-none">
            {measure.current_value ?? '—'}
            <span className="text-[#94A3B8] font-semibold"> / {measure.target_value}</span>
            {measure.unit ? <span className="text-sm font-medium text-[#64748B] ml-1">{measure.unit}</span> : null}
          </p>
        </div>
        {pctToTarget !== null && (
          <span
            className="inline-flex items-center gap-1 text-[12px] font-semibold rounded-full px-2 py-0.5 shrink-0"
            style={{
              backgroundColor: onTrack ? '#DCFCE7' : '#EFF6FF',
              color: onTrack ? '#16A34A' : '#2563EB',
            }}
          >
            <TrendingUp size={12} />
            {pctToTarget}% to target
          </span>
        )}
      </div>

      {numeric ? (
        <div className="mt-3">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[80px]" preserveAspectRatio="none">
            {/* Target reference line */}
            <line
              x1={0}
              x2={W}
              y1={targetY}
              y2={targetY}
              stroke="#CBD5E1"
              strokeWidth={1}
              strokeDasharray="4 4"
              vectorEffect="non-scaling-stroke"
            />
            {/* Actuals line */}
            {points.length > 1 && (
              <path
                d={linePath}
                fill="none"
                stroke={lineColor}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            )}
            {/* Points */}
            {points.map((p, i) => (
              <circle key={i} cx={xOf(i)} cy={yOf(p.value)} r={3} fill={lineColor} vectorEffect="non-scaling-stroke" />
            ))}
          </svg>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[11px] text-[#94A3B8]">{points[0] ? fmtDate(points[0].date) : ''}</span>
            <span className="text-[11px] font-medium text-[#64748B]">
              Target {measure.target_value}
              {measure.unit ? ` ${measure.unit}` : ''}
            </span>
            <span className="text-[11px] text-[#94A3B8]">
              {points.length ? fmtDate(points[points.length - 1].date) : ''}
            </span>
          </div>
        </div>
      ) : (
        <p className="text-xs text-[#94A3B8] mt-3">
          {points.length === 0
            ? 'No actuals recorded yet — check in to start the trajectory.'
            : 'Non-numeric measure — actuals are tracked as a list in the history below.'}
        </p>
      )}
    </div>
  )
}
