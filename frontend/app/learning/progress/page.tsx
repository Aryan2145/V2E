'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BarChart2, Users, CheckCircle, Clock, TrendingUp } from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import { getOrgProgress } from '@/lib/api/learning'
import type { OrgProgressSummary } from '@/lib/types/learning'
import ProgressBar from '@/components/learning/ProgressBar'
import PathStatusBadge from '@/components/learning/PathStatusBadge'

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: any; color: string }) {
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-5">
      <div className={`w-10 h-10 rounded-[10px] ${color} flex items-center justify-center mb-3`}>
        <Icon size={18} />
      </div>
      <div className="text-2xl font-bold text-[#0F172A]">{value}</div>
      <div className="text-sm text-[#64748B] mt-0.5">{label}</div>
    </div>
  )
}

export default function ProgressPage() {
  const { user } = useAuth()
  const orgId = user?.organizationId ?? ''
  const [summary, setSummary] = useState<OrgProgressSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!orgId) return
    getOrgProgress(orgId).then(setSummary).finally(() => setLoading(false))
  }, [orgId])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-56px)]">
        <div className="w-8 h-8 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!summary) return null

  return (
    <div className="px-8 py-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-[28px] font-bold text-[#0F172A]">Learning Progress</h1>
        <p className="text-sm text-[#475569] mt-1">Organisation-wide learning progress overview</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total Paths"
          value={summary.total_paths}
          icon={BarChart2}
          color="bg-[#EFF6FF] text-[#2563EB]"
        />
        <StatCard
          label="Total Assignments"
          value={summary.total_assignments}
          icon={Users}
          color="bg-[#F0FDF4] text-[#16A34A]"
        />
        <StatCard
          label="Completed"
          value={summary.completed_assignments}
          icon={CheckCircle}
          color="bg-[#DCFCE7] text-[#16A34A]"
        />
        <StatCard
          label="Avg Progress"
          value={`${summary.avg_progress_percent}%`}
          icon={TrendingUp}
          color="bg-[#FEF9C3] text-[#CA8A04]"
        />
      </div>

      {/* Per-path breakdown */}
      {summary.paths.length === 0 ? (
        <div className="bg-white border border-[#E2E8F0] rounded-[12px] py-16 flex flex-col items-center text-center">
          <BarChart2 size={32} className="text-[#94A3B8] mb-3" />
          <p className="text-sm font-medium text-[#0F172A] mb-1">No data yet</p>
          <p className="text-xs text-[#64748B]">Assign learning paths to employees to track progress</p>
        </div>
      ) : (
        <div className="bg-white border border-[#E2E8F0] rounded-[12px] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#E2E8F0] bg-[#F8FAFC]">
            <h2 className="text-sm font-semibold text-[#0F172A]">Path Progress Breakdown</h2>
          </div>
          <div className="divide-y divide-[#F1F5F9]">
            {summary.paths.map((p) => (
              <div key={p.path_id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <Link
                      href={`/learning/paths/${p.path_id}`}
                      className="text-sm font-semibold text-[#0F172A] hover:text-[#2563EB] transition-colors"
                    >
                      {p.title}
                    </Link>
                    <div className="flex items-center gap-2 mt-1">
                      <PathStatusBadge status={p.status} />
                      <span className="text-xs text-[#94A3B8]">{p.total_assignments} employees</span>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-[#0F172A] shrink-0">{p.avg_percent}%</span>
                </div>
                <ProgressBar percent={p.avg_percent} size="sm" className="mb-2" />
                <div className="flex items-center gap-4 text-xs text-[#64748B]">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#16A34A] inline-block" />
                    {p.completed} completed
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#2563EB] inline-block" />
                    {p.in_progress} in progress
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#94A3B8] inline-block" />
                    {p.not_started} not started
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
