'use client'

import React from 'react'
import { BarChart3, Table2 } from 'lucide-react'

export type View = 'analytics' | 'table'

/** Top-level view tab: the analytical canvas vs a dense, filterable data table. */
export default function ViewToggle({ value, onChange }: { value: View; onChange: (v: View) => void }) {
  const opts: { key: View; label: string; icon: React.ReactNode }[] = [
    { key: 'analytics', label: 'Analytics', icon: <BarChart3 size={15} /> },
    { key: 'table', label: 'Table', icon: <Table2 size={15} /> },
  ]
  return (
    <div className="inline-flex items-center border border-[#E2E8F0] rounded-[8px] bg-white p-0.5 gap-0.5">
      {opts.map(({ key, label, icon }) => {
        const active = value === key
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-[6px] text-sm font-semibold transition-colors ${
              active ? 'bg-[#2563EB] text-white' : 'text-[#475569] hover:text-[#0F172A] hover:bg-[#F1F5F9]'
            }`}
          >
            {icon}
            <span>{label}</span>
          </button>
        )
      })}
    </div>
  )
}
