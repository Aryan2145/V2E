'use client'

import { AlertCircle } from 'lucide-react'

interface PendingTaskBadgeProps {
  onClick: () => void
}

export default function PendingTaskBadge({ onClick }: PendingTaskBadgeProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-[#FDE68A] bg-[#FEF9C3] text-[#CA8A04] hover:bg-[#FEF3C7] transition-colors cursor-pointer"
    >
      <AlertCircle size={10} />
      Setup Required
    </button>
  )
}
