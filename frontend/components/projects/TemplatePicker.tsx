'use client'

import { CheckCircle2 } from 'lucide-react'
import type { ProjectTemplate } from '@/lib/types/projects'

interface TemplatePickerProps {
  templates: ProjectTemplate[]
  selected: string | null
  onSelect: (id: string | null) => void
}

export default function TemplatePicker({ templates, selected, onSelect }: TemplatePickerProps) {
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={[
          'w-full text-left px-4 py-3 rounded-[10px] border-2 transition-colors',
          !selected
            ? 'border-[#2563EB] bg-[#EFF6FF]'
            : 'border-[#E2E8F0] hover:border-[#CBD5E1]',
        ].join(' ')}
      >
        <p className="text-sm font-semibold text-[#0F172A]">Start from scratch</p>
        <p className="text-xs text-[#475569] mt-0.5">Build your project structure manually</p>
      </button>

      {templates.map((t) => {
        const active = selected === t.id
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t.id)}
            className={[
              'w-full text-left px-4 py-3 rounded-[10px] border-2 transition-colors flex items-start justify-between gap-3',
              active
                ? 'border-[#2563EB] bg-[#EFF6FF]'
                : 'border-[#E2E8F0] hover:border-[#CBD5E1]',
            ].join(' ')}
          >
            <div>
              <p className="text-sm font-semibold text-[#0F172A]">{t.name}</p>
              {t.description && <p className="text-xs text-[#475569] mt-0.5 line-clamp-1">{t.description}</p>}
              <div className="flex gap-3 mt-1">
                <span className="text-[11px] text-[#94A3B8]">{t._count?.milestones ?? 0} milestones</span>
                <span className="text-[11px] text-[#94A3B8]">{t._count?.tasks ?? 0} tasks</span>
              </div>
            </div>
            {active && <CheckCircle2 size={18} className="text-[#2563EB] shrink-0 mt-0.5" />}
          </button>
        )
      })}
    </div>
  )
}
