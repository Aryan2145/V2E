'use client'

import { ExternalLink, Trash2, FileText, Link2, Image } from 'lucide-react'
import type { ProjectDocument } from '@/lib/types/projects'

function typeIcon(type?: string) {
  if (!type) return <Link2 size={18} className="text-[#475569]" />
  if (type === 'pdf') return <FileText size={18} className="text-[#DC2626]" />
  if (['jpg', 'jpeg', 'png', 'gif', 'svg'].includes(type)) return <Image size={18} className="text-[#0891B2]" />
  return <FileText size={18} className="text-[#475569]" />
}

interface DocumentCardProps {
  doc: ProjectDocument
  canDelete: boolean
  onDelete: (id: string) => void
}

export default function DocumentCard({ doc, canDelete, onDelete }: DocumentCardProps) {
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-4 shadow-[0_1px_3px_rgba(0,0,0,0.08)] flex items-start gap-3">
      <div className="w-10 h-10 rounded-[8px] bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center shrink-0">
        {typeIcon(doc.type)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#0F172A] truncate">{doc.name}</p>
        {doc.type && (
          <p className="text-xs text-[#94A3B8] uppercase">{doc.type}</p>
        )}
        <p className="text-xs text-[#94A3B8] mt-0.5">
          {new Date(doc.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <a
          href={doc.url}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 rounded-[6px] hover:bg-[#F1F5F9] text-[#475569] hover:text-[#0F172A] transition-colors"
        >
          <ExternalLink size={14} />
        </a>
        {canDelete && (
          <button
            type="button"
            onClick={() => onDelete(doc.id)}
            className="p-1.5 rounded-[6px] hover:bg-[#FEE2E2] text-[#DC2626] transition-colors"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  )
}
