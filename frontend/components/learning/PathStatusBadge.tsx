import type { LearningPathStatus } from '@/lib/types/learning'

const CONFIG: Record<LearningPathStatus, { label: string; classes: string }> = {
  draft: {
    label: 'Draft',
    classes: 'bg-[#F1F5F9] text-[#475569] border border-[#CBD5E1]',
  },
  published: {
    label: 'Published',
    classes: 'bg-[#DCFCE7] text-[#16A34A] border border-[#BBF7D0]',
  },
  archived: {
    label: 'Archived',
    classes: 'bg-[#FEE2E2] text-[#DC2626] border border-[#FECACA]',
  },
}

export default function PathStatusBadge({ status }: { status: LearningPathStatus }) {
  const { label, classes } = CONFIG[status] ?? CONFIG.draft
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${classes}`}>
      {label}
    </span>
  )
}
