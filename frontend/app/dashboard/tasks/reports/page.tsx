'use client'

import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { useAuth } from '@/lib/auth/context'
import { tasksApi } from '@/lib/api/tasks'
import type { Task, TaskCategory, TaskPriority, TaskStatus, TaskQuadrant } from '@/lib/types/tasks'
import QuadrantBadge from '@/components/tasks/QuadrantBadge'
import { BarChart2, CheckCircle2, Clock, AlertTriangle, TrendingUp } from 'lucide-react'

// ─── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon,
  color,
}: {
  label: string
  value: number | string
  sub?: string
  icon: React.ReactNode
  color: string
}) {
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-6 flex items-start gap-4">
      <div
        className="w-10 h-10 rounded-[8px] flex items-center justify-center shrink-0"
        style={{ backgroundColor: color + '18', color }}
      >
        {icon}
      </div>
      <div>
        <p className="text-3xl font-bold text-[#0F172A] leading-tight tabular-nums">{value}</p>
        <p className="text-sm text-[#475569] mt-0.5">{label}</p>
        {sub && <p className="text-xs text-[#94A3B8] mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { user } = useAuth()
  const orgId = user?.organizationId ?? ''

  const [tasks, setTasks] = useState<Task[]>([])
  const [categories, setCategories] = useState<TaskCategory[]>([])
  const [priorities, setPriorities] = useState<TaskPriority[]>([])
  const [statuses, setStatuses] = useState<TaskStatus[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(() => {
    if (!orgId) { setLoading(false); return }
    setLoading(true)
    Promise.all([
      tasksApi.listTasks(orgId).catch(() => []),
      tasksApi.getCategories(orgId).catch(() => []),
      tasksApi.getPriorities(orgId).catch(() => []),
      tasksApi.getStatuses(orgId).catch(() => []),
    ]).then(([t, c, p, s]) => {
      setTasks(t)
      setCategories(c)
      setPriorities(p)
      setStatuses(s)
    }).finally(() => setLoading(false))
  }, [orgId])

  useEffect(() => { loadData() }, [loadData])

  const completed = useMemo(() => tasks.filter((t) => t.status?.type === 'completed').length, [tasks])
  const overdue = useMemo(() => {
    const now = new Date()
    return tasks.filter((t) => t.deadline && new Date(t.deadline) < now && t.status?.type !== 'completed').length
  }, [tasks])
  const completionRate = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0

  // By quadrant
  const byQuadrant = useMemo(() => {
    const map: Record<TaskQuadrant, number> = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 }
    tasks.forEach((t) => { map[t.quadrant] = (map[t.quadrant] ?? 0) + 1 })
    return map
  }, [tasks])

  // By status
  const byStatus = useMemo(() => {
    const map: Record<string, { label: string; count: number; color: string }> = {}
    tasks.forEach((t) => {
      const s = statuses.find((s) => s.id === t.status_id) ?? t.status
      if (!s) return
      if (!map[s.id]) map[s.id] = { label: s.label, count: 0, color: s.color }
      map[s.id].count++
    })
    return Object.values(map).sort((a, b) => b.count - a.count)
  }, [tasks, statuses])

  // By category
  const byCategory = useMemo(() => {
    const map: Record<string, { name: string; count: number; color: string }> = {}
    tasks.forEach((t) => {
      const c = categories.find((c) => c.id === t.category_id) ?? t.category
      const key = c ? c.id : 'uncategorized'
      const name = c ? c.name : 'Uncategorized'
      const color = c ? c.color : '#94A3B8'
      if (!map[key]) map[key] = { name, count: 0, color }
      map[key].count++
    })
    return Object.values(map).sort((a, b) => b.count - a.count)
  }, [tasks, categories])

  if (!orgId) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p className="font-semibold text-[#0F172A]">No organization found</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-bold text-[#0F172A] leading-tight">Task Reports</h1>
        <p className="mt-1 text-[15px] text-[#475569]">Overview and analytics for your organization&apos;s tasks.</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Tasks" value={tasks.length} icon={<BarChart2 size={20} />} color="#2563EB" />
        <StatCard label="Completed" value={completed} sub={`${completionRate}% completion rate`} icon={<CheckCircle2 size={20} />} color="#16A34A" />
        <StatCard label="Overdue" value={overdue} icon={<AlertTriangle size={20} />} color="#DC2626" />
        <StatCard label="In Progress" value={tasks.filter((t) => t.status?.type === 'in_progress').length} icon={<Clock size={20} />} color="#D97706" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* By Quadrant */}
        <div className="bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-6">
          <h3 className="text-[15px] font-semibold text-[#0F172A] mb-4">By Quadrant</h3>
          <div className="space-y-3">
            {(['Q1', 'Q2', 'Q3', 'Q4'] as TaskQuadrant[]).map((q) => {
              const count = byQuadrant[q]
              const pct = tasks.length > 0 ? Math.round((count / tasks.length) * 100) : 0
              return (
                <div key={q}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <QuadrantBadge quadrant={q} />
                      <span className="text-sm text-[#475569]">{count} tasks</span>
                    </div>
                    <span className="text-xs font-semibold text-[#475569]">{pct}%</span>
                  </div>
                  <div className="h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: q === 'Q1' ? '#DC2626' : q === 'Q2' ? '#2563EB' : q === 'Q3' ? '#D97706' : '#6B7280',
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* By Status */}
        <div className="bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-6">
          <h3 className="text-[15px] font-semibold text-[#0F172A] mb-4">By Status</h3>
          {byStatus.length === 0 ? (
            <p className="text-sm text-[#475569]">No status data available.</p>
          ) : (
            <div className="space-y-3">
              {byStatus.map((s) => {
                const pct = tasks.length > 0 ? Math.round((s.count / tasks.length) * 100) : 0
                return (
                  <div key={s.label}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                        <span className="text-sm text-[#475569]">{s.label}</span>
                      </div>
                      <span className="text-xs font-semibold text-[#475569]">{s.count} ({pct}%)</span>
                    </div>
                    <div className="h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: s.color }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* By Category */}
        <div className="bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-6">
          <h3 className="text-[15px] font-semibold text-[#0F172A] mb-4">By Category</h3>
          {byCategory.length === 0 ? (
            <p className="text-sm text-[#475569]">No category data available.</p>
          ) : (
            <div className="space-y-3">
              {byCategory.map((c) => {
                const pct = tasks.length > 0 ? Math.round((c.count / tasks.length) * 100) : 0
                return (
                  <div key={c.name}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                        <span className="text-sm text-[#475569] truncate max-w-[120px]">{c.name}</span>
                      </div>
                      <span className="text-xs font-semibold text-[#475569] shrink-0">{c.count} ({pct}%)</span>
                    </div>
                    <div className="h-1.5 bg-[#F1F5F9] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: c.color }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Completion trend placeholder */}
      <div className="bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-6">
        <h3 className="text-[15px] font-semibold text-[#0F172A] mb-2 flex items-center gap-2">
          <TrendingUp size={16} className="text-[#2563EB]" />
          Completion Rate
        </h3>
        <div className="flex items-end gap-2">
          <p className="text-5xl font-bold text-[#0F172A] tabular-nums">{completionRate}%</p>
          <p className="text-sm text-[#475569] mb-2">{completed} of {tasks.length} tasks completed</p>
        </div>
        <div className="mt-4 h-3 bg-[#F1F5F9] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#16A34A] rounded-full transition-all duration-700"
            style={{ width: `${completionRate}%` }}
          />
        </div>
      </div>
    </div>
  )
}
