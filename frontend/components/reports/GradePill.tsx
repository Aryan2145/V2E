import React from 'react'
import type { ScorecardGrade } from '@/lib/types/reports'

// One shared look for the compliance grade so the roster, the person card, and the
// Excel export all read the same. Colour carries the meaning: strong green = ahead,
// amber = watch, red = act, blue = "closing but late", grey = not enough data.
const STYLE: Record<ScorecardGrade, { bg: string; fg: string; border: string }> = {
  'Very Good': { bg: '#16A34A', fg: '#FFFFFF', border: '#16A34A' },
  'Good': { bg: '#DCFCE7', fg: '#15803D', border: '#BBF7D0' },
  'Average': { bg: '#FEF3C7', fg: '#B45309', border: '#FDE68A' },
  'Late but Closing': { bg: '#DBEAFE', fg: '#1D4ED8', border: '#BFDBFE' },
  'Needs Attention': { bg: '#FEE2E2', fg: '#B91C1C', border: '#FECACA' },
  'Too Few Tasks to Judge': { bg: '#F1F5F9', fg: '#64748B', border: '#E2E8F0' },
}

export function GradePill({ grade, className = '' }: { grade: ScorecardGrade; className?: string }) {
  const s = STYLE[grade] ?? STYLE['Too Few Tasks to Judge']
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-semibold whitespace-nowrap ${className}`}
      style={{ backgroundColor: s.bg, color: s.fg, border: `1px solid ${s.border}` }}
    >
      {grade}
    </span>
  )
}
