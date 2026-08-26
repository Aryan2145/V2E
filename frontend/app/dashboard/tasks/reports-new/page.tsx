'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { UserSquare2, BarChart2, ArrowRight } from 'lucide-react'

interface ReportTile {
  key: string
  title: string
  blurb: string
  href: string
  Icon: React.ElementType
  accent: string
  badge?: string
}

// The catalogue of Work reports. New reports get added here as tiles — the index
// scales by appending, never by growing a single mega-page.
const REPORTS: ReportTile[] = [
  {
    key: 'person-scorecard',
    title: 'Person Scorecard',
    blurb:
      'A per-person task compliance scorecard — scope, total entries, completion, on-time rate, delay and an automatic Grade. Open one person or download everyone in your scope.',
    href: '/dashboard/tasks/reports-new/person-scorecard',
    Icon: UserSquare2,
    accent: '#2563EB',
    badge: 'New',
  },
  {
    key: 'task-performance',
    title: 'Task Performance',
    blurb:
      'Team- and department-level completion rates, priority / category / status breakdowns. (The current Reports page.)',
    href: '/dashboard/tasks/reports',
    Icon: BarChart2,
    accent: '#0891B2',
  },
]

export default function ReportsIndexPage() {
  const router = useRouter()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-bold text-[#0F172A] leading-tight">Reports</h1>
        <p className="mt-1 text-[15px] text-[#475569]">
          Pick a report. What you can see is scoped to your visibility — your own work, your team, or the whole organization.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {REPORTS.map((r) => (
          <button
            key={r.key}
            onClick={() => router.push(r.href)}
            className="group text-left bg-white border border-[#E2E8F0] rounded-[14px] shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-5 hover:border-[#2563EB] hover:shadow-[0_4px_16px_rgba(37,99,235,0.10)] transition-all"
          >
            <div className="flex items-start gap-4">
              <div
                className="w-11 h-11 rounded-[10px] flex items-center justify-center shrink-0"
                style={{ backgroundColor: r.accent + '18', color: r.accent }}
              >
                <r.Icon size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-[17px] font-semibold text-[#0F172A]">{r.title}</h2>
                  {r.badge && (
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-[#2563EB] bg-[#EFF6FF] border border-[#BFDBFE] rounded-full px-2 py-0.5">
                      {r.badge}
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-[#475569]">{r.blurb}</p>
              </div>
              <ArrowRight
                size={18}
                className="text-[#94A3B8] group-hover:text-[#2563EB] group-hover:translate-x-0.5 transition-all shrink-0 mt-1"
              />
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
