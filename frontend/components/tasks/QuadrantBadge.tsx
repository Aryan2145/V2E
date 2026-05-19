import React from 'react'
import type { TaskQuadrant } from '@/lib/types/tasks'

interface QuadrantBadgeProps {
  quadrant: TaskQuadrant
  size?: 'sm' | 'md'
}

const quadrantConfig: Record<TaskQuadrant, { bg: string; text: string; border: string; label: string; sublabel: string }> = {
  Q1: {
    bg: 'bg-[#FEE2E2]',
    text: 'text-[#DC2626]',
    border: 'border border-[#FECACA]',
    label: 'Q1',
    sublabel: 'Urgent + Important',
  },
  Q2: {
    bg: 'bg-[#EFF6FF]',
    text: 'text-[#2563EB]',
    border: 'border border-[#BFDBFE]',
    label: 'Q2',
    sublabel: 'Not Urgent + Important',
  },
  Q3: {
    bg: 'bg-[#FEF9C3]',
    text: 'text-[#D97706]',
    border: 'border border-[#FDE68A]',
    label: 'Q3',
    sublabel: 'Urgent + Not Important',
  },
  Q4: {
    bg: 'bg-[#F3F4F6]',
    text: 'text-[#6B7280]',
    border: 'border border-[#E5E7EB]',
    label: 'Q4',
    sublabel: 'Not Urgent + Not Important',
  },
}

export default function QuadrantBadge({ quadrant, size = 'sm' }: QuadrantBadgeProps) {
  const cfg = quadrantConfig[quadrant]
  if (size === 'md') {
    return (
      <span
        className={[
          'inline-flex flex-col items-center rounded-[8px] px-3 py-1.5',
          cfg.bg,
          cfg.text,
          cfg.border,
        ].join(' ')}
      >
        <span className="text-sm font-bold leading-tight">{cfg.label}</span>
        <span className="text-[10px] font-medium leading-tight opacity-80">{cfg.sublabel}</span>
      </span>
    )
  }
  return (
    <span
      className={[
        'inline-flex items-center rounded-[6px] px-2 py-0.5 text-[11px] font-semibold',
        cfg.bg,
        cfg.text,
        cfg.border,
      ].join(' ')}
    >
      {cfg.label}
    </span>
  )
}

export { quadrantConfig }
