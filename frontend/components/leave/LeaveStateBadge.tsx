'use client'

import type { Leave } from '@/lib/types/leave'

// Severity/label derived from state + origin + overridden, matching the design-system
// status palette. "Effective" leaves (counted as on-leave) read amber/green; rejected
// and cancelled read red/gray.
function describe(l: Pick<Leave, 'state' | 'origin' | 'overridden'>): { label: string; cls: string } {
  if (l.state === 'cancelled') return { label: 'Cancelled', cls: 'bg-[#F1F5F9] text-[#475569] border-[#E2E8F0]' }
  if (l.state === 'rejected') {
    return l.overridden
      ? { label: 'Taken despite rejection', cls: 'bg-[#F5F3FF] text-[#7C3AED] border-[#DDD6FE]' }
      : { label: 'Rejected', cls: 'bg-[#FEE2E2] text-[#DC2626] border-[#FECACA]' }
  }
  if (l.state === 'pending') return { label: 'Pending', cls: 'bg-[#FEF9C3] text-[#CA8A04] border-[#FDE68A]' }
  // approved
  if (l.origin === 'self_declared') return { label: 'Self-declared', cls: 'bg-[#FEF3C7] text-[#92400E] border-[#FCD34D]' }
  return { label: 'Approved', cls: 'bg-[#DCFCE7] text-[#16A34A] border-[#BBF7D0]' }
}

export default function LeaveStateBadge({ leave }: { leave: Pick<Leave, 'state' | 'origin' | 'overridden'> }) {
  const { label, cls } = describe(leave)
  return (
    <span className={`text-[11px] font-semibold rounded-full px-2 py-0.5 border whitespace-nowrap ${cls}`}>
      {label}
    </span>
  )
}
