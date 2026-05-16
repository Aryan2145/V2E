import { Video, FileText, Link2, BookOpen } from 'lucide-react'
import type { ContentType } from '@/lib/types/learning'

const CONFIG: Record<ContentType, { label: string; Icon: any; classes: string }> = {
  video: {
    label: 'Video',
    Icon: Video,
    classes: 'bg-[#EFF6FF] text-[#2563EB]',
  },
  document: {
    label: 'Document',
    Icon: FileText,
    classes: 'bg-[#F0FDF4] text-[#16A34A]',
  },
  url: {
    label: 'URL',
    Icon: Link2,
    classes: 'bg-[#FEF9C3] text-[#CA8A04]',
  },
  article: {
    label: 'Article',
    Icon: BookOpen,
    classes: 'bg-[#FDF4FF] text-[#9333EA]',
  },
}

export default function ItemTypeBadge({ type }: { type: ContentType }) {
  const { label, Icon, classes } = CONFIG[type] ?? CONFIG.article
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${classes}`}>
      <Icon size={11} />
      {label}
    </span>
  )
}
