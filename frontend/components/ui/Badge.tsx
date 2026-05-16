import React from 'react'

type BadgeStatus = 'active' | 'inactive' | 'pending' | 'info'

interface BadgeProps {
  status: BadgeStatus
  label?: string
}

const statusConfig: Record<
  BadgeStatus,
  { bg: string; text: string; defaultLabel: string }
> = {
  active: {
    bg: 'bg-[#DCFCE7]',
    text: 'text-[#16A34A]',
    defaultLabel: 'Active',
  },
  inactive: {
    bg: 'bg-[#FEE2E2]',
    text: 'text-[#DC2626]',
    defaultLabel: 'Inactive',
  },
  pending: {
    bg: 'bg-[#FEF9C3]',
    text: 'text-[#CA8A04]',
    defaultLabel: 'Pending',
  },
  info: {
    bg: 'bg-[#DBEAFE]',
    text: 'text-[#1D4ED8]',
    defaultLabel: 'Info',
  },
}

export default function Badge({ status, label }: BadgeProps) {
  const config = statusConfig[status]

  return (
    <span
      className={[
        'inline-flex items-center rounded-[999px] px-[10px] py-[2px] text-[12px] font-medium',
        config.bg,
        config.text,
      ].join(' ')}
    >
      {label ?? config.defaultLabel}
    </span>
  )
}
