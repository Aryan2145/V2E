'use client'

import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/lib/auth/context'
import { tasksApi } from '@/lib/api/tasks'
import type {
  RecurringTemplate, RecurringScheduleEntry, Task,
  TaskCategory, TaskPriority, TaskStatus, EligibleAssigneeUser,
} from '@/lib/types/tasks'
import TaskCard from '@/components/tasks/TaskCard'
import EditRecurringModal from '@/components/tasks/EditRecurringModal'
import {
  ArrowLeft, RotateCcw, Play, Pause, Edit2, Zap,
  CheckCircle2, Clock, ListChecks, BarChart2, Filter, Users,
  Calendar, Shield, CheckSquare,
} from 'lucide-react'

// ─── Schedule helpers (mirrors recurring/page.tsx) ────────────────────────────

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function entryLabel(entry: RecurringScheduleEntry): string {
  switch (entry.schedule_type) {
    case 'daily':
      return `Every ${entry.every > 1 ? `${entry.every} days` : 'day'}`
    case 'weekly': {
      const days = Array.isArray(entry.days) ? (entry.days as number[]).map((d) => DOW[d]).join(', ') : ''
      return `Every ${entry.every > 1 ? `${entry.every} weeks` : 'week'}${days ? ` on ${days}` : ''}`
    }
    case 'monthly': {
      const md = Array.isArray(entry.month_days) ? (entry.month_days as number[]) : []
      const dayStr = md.length === 0 ? '?' : md.length <= 3 ? md.join(', ') : `${md.slice(0, 3).join(', ')}…`
      return `Day${md.length !== 1 ? 's' : ''} ${dayStr} every ${entry.every > 1 ? `${entry.every} months` : 'month'}`
    }
    case 'yearly': {
      const dates = Array.isArray(entry.yearly_dates) ? (entry.yearly_dates as { month: number; day: number }[]) : []
      if (dates.length === 0) return 'Yearly'
      if (dates.length === 1) return `${MONTHS_SHORT[dates[0].month - 1]} ${dates[0].day} each year`
      return `${dates.length} dates each year`
    }
    default:
      return entry.schedule_type
  }
}

function formatDate(str: string): string {
  return new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

const avatarColors = ['bg-[#2563EB]', 'bg-[#7C3AED]', 'bg-[#059669]', 'bg-[#D97706]', 'bg-[#DC2626]', 'bg-[#0891B2]', 'bg-[#BE185D]']
function avatarColor(str: string): string {
  let h = 0; for (let i = 0; i < str.length; i++) h += str.charCodeAt(i)
  return avatarColors[h % avatarColors.length]
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon, color }: { label: string; value: number | string; icon: React.ReactNode; color: string }) {
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-5 flex items-start gap-3">
      <div className="w-9 h-9 rounded-[8px] flex items-center justify-center shrink-0" style={{ backgroundColor: color + '18', color }}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-[#0F172A] leading-tight tabular-nums">{value}</p>
        <p className="text-sm text-[#475569] mt-0.5">{label}</p>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RecurringDetailPage() {
  const { user } = useAuth()
  const router = useRouter()
  const params = useParams()
  const templateId = params.id as string
  const orgId = user?.organizationId ?? ''

  const [template, setTemplate] = useState<RecurringTemplate | null>(null)
  const [instances, setInstances] = useState<Task[]>([])
  const [stats, setStats] = useState<{ total: number; completed: number; pending: number } | null>(null)
  const [categories, setCategories] = useState<TaskCategory[]>([])
  const [priorities, setPriorities] = useState<TaskPriority[]>([])
  const [statuses, setStatuses] = useState<TaskStatus[]>([])
  const [userMap, setUserMap] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)

  const [filterStatus, setFilterStatus] = useState('all')
  const [filterPriority, setFilterPriority] = useState('all')
  const [showEditModal, setShowEditModal] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [spawning, setSpawning] = useState(false)
  const [spawnMsg, setSpawnMsg] = useState<string | null>(null)

  const loadData = useCallback(() => {
    if (!orgId || !templateId) { setLoading(false); return }
    setLoading(true)
    Promise.all([
      tasksApi.getRecurringTemplates(orgId).catch(() => [] as RecurringTemplate[]),
      tasksApi.getRecurringInstances(orgId, templateId).catch(() => [] as Task[]),
      tasksApi.getRecurringStats(orgId, templateId).catch(() => null),
      tasksApi.getCategories(orgId).catch(() => []),
      tasksApi.getPriorities(orgId).catch(() => []),
      tasksApi.getStatuses(orgId).catch(() => []),
      tasksApi.getEligibleAssignees(orgId).catch(() => ({ departments: [], total: 0 })),
    ]).then(([templates, inst, s, cats, prios, statuses, eligible]) => {
      const found = (templates as RecurringTemplate[]).find((t) => t.id === templateId) ?? null
      setTemplate(found)
      setInstances(inst as Task[])
      setStats(s as { total: number; completed: number; pending: number } | null)
      setCategories(cats)
      setPriorities(prios)
      setStatuses(statuses)
      const map = new Map<string, string>()
      ;(eligible as { departments: { users: EligibleAssigneeUser[] }[] }).departments.forEach((dept) =>
        dept.users.forEach((u) => map.set(u.user_id, u.name))
      )
      setUserMap(map)
    }).finally(() => setLoading(false))
  }, [orgId, templateId])

  useEffect(() => { loadData() }, [loadData])

  const filtered = useMemo(() => instances.filter((t) => {
    if (filterStatus !== 'all' && t.status_id !== filterStatus) return false
    if (filterPriority !== 'all' && t.priority_id !== filterPriority) return false
    return true
  }), [instances, filterStatus, filterPriority])

  const isFiltered = filterStatus !== 'all' || filterPriority !== 'all'

  async function handleToggle() {
    if (!template) return
    setToggling(true)
    try {
      if (template.is_active) {
        await tasksApi.pauseRecurring(orgId, templateId)
        setTemplate((t) => t ? { ...t, is_active: false } : t)
      } else {
        await tasksApi.resumeRecurring(orgId, templateId)
        setTemplate((t) => t ? { ...t, is_active: true } : t)
        tasksApi.spawnTodayRecurring(orgId, templateId).then(() => loadData()).catch(() => null)
      }
    } finally {
      setToggling(false)
    }
  }

  async function handleSpawnToday() {
    setSpawning(true)
    setSpawnMsg(null)
    try {
      const result = await tasksApi.spawnTodayRecurring(orgId, templateId)
      setSpawnMsg(result.spawned > 0 ? `${result.spawned} task${result.spawned !== 1 ? 's' : ''} created` : 'Already spawned today')
      loadData()
    } catch {
      setSpawnMsg('Failed')
    } finally {
      setSpawning(false)
      setTimeout(() => setSpawnMsg(null), 3000)
    }
  }

  if (!orgId) return null

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!template) {
    return (
      <div className="space-y-4">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-[#475569] hover:text-[#0F172A]">
          <ArrowLeft size={15} /> Back
        </button>
        <p className="text-[#0F172A] font-semibold">Template not found.</p>
      </div>
    )
  }

  const completionPct = stats && stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0
  const entries = template.schedule_entries ?? []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button
          onClick={() => router.back()}
          className="mt-1 w-8 h-8 flex items-center justify-center rounded-[8px] border border-[#E2E8F0] text-[#475569] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors shrink-0"
        >
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={[
              'inline-flex items-center rounded-[999px] px-2 py-0.5 text-[11px] font-medium',
              template.is_active
                ? 'bg-[#DCFCE7] text-[#16A34A] border border-[#BBF7D0]'
                : 'bg-[#FEE2E2] text-[#DC2626] border border-[#FECACA]',
            ].join(' ')}>
              {template.is_active ? 'Active' : 'Paused'}
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-[#94A3B8]">
              <RotateCcw size={11} />
              Recurring Template
            </span>
          </div>
          <h1 className="text-[26px] font-bold text-[#0F172A] leading-tight">{template.title}</h1>
          {template.description && (
            <p className="mt-1 text-[15px] text-[#475569]">{template.description}</p>
          )}
        </div>
        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowEditModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-[#475569] bg-white border border-[#E2E8F0] rounded-[8px] hover:bg-[#F1F5F9] hover:text-[#0F172A] transition-colors"
          >
            <Edit2 size={14} /> Edit
          </button>
          {template.is_active && (
            <button
              onClick={handleSpawnToday}
              disabled={spawning}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-[#2563EB] bg-[#EFF6FF] border border-[#BFDBFE] rounded-[8px] hover:bg-[#DBEAFE] disabled:opacity-60 transition-colors"
            >
              <Zap size={14} />
              {spawning ? '...' : spawnMsg ?? 'Run Today'}
            </button>
          )}
          <button
            onClick={handleToggle}
            disabled={toggling}
            className={[
              'flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-[8px] disabled:opacity-60 transition-colors',
              template.is_active
                ? 'text-[#D97706] bg-[#FEF9C3] border border-[#FDE68A] hover:bg-[#FDE68A]'
                : 'text-[#16A34A] bg-[#DCFCE7] border border-[#BBF7D0] hover:bg-[#BBF7D0]',
            ].join(' ')}
          >
            {template.is_active ? <Pause size={14} /> : <Play size={14} />}
            {toggling ? '...' : template.is_active ? 'Pause' : 'Resume'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Instances" value={stats?.total ?? 0} icon={<ListChecks size={18} />} color="#2563EB" />
        <StatCard label="Completed" value={stats?.completed ?? 0} icon={<CheckCircle2 size={18} />} color="#16A34A" />
        <StatCard label="Pending" value={stats?.pending ?? 0} icon={<Clock size={18} />} color="#D97706" />
        <StatCard label="Completion %" value={`${completionPct}%`} icon={<BarChart2 size={18} />} color="#0891B2" />
      </div>

      {/* Body */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">

        {/* ── Main: Instances list ───────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Toolbar */}
          <div className="flex items-center gap-2 flex-wrap justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 text-sm text-[#475569]">
                <Filter size={14} />
                <span className="font-medium">Filter</span>
              </div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-[7px] text-sm rounded-[8px] border border-[#CBD5E1] focus:border-[#2563EB] focus:outline-none bg-white text-[#0F172A]"
              >
                <option value="all">All Statuses</option>
                {statuses.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
                className="px-3 py-[7px] text-sm rounded-[8px] border border-[#CBD5E1] focus:border-[#2563EB] focus:outline-none bg-white text-[#0F172A]"
              >
                <option value="all">All Priorities</option>
                {priorities.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
              {isFiltered && (
                <button
                  onClick={() => { setFilterStatus('all'); setFilterPriority('all') }}
                  className="px-3 py-[7px] text-sm font-medium text-[#DC2626] border border-[#FECACA] bg-[#FEE2E2] rounded-[8px] hover:bg-[#FECACA] transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
            <p className="text-sm text-[#475569]">
              {filtered.length} instance{filtered.length !== 1 ? 's' : ''}
              {isFiltered && ` (filtered from ${instances.length})`}
            </p>
          </div>

          {/* List */}
          {filtered.length === 0 ? (
            <div className="bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] flex flex-col items-center justify-center py-16">
              <div className="w-12 h-12 rounded-full bg-[#F1F5F9] flex items-center justify-center mb-3">
                <CheckSquare size={20} className="text-[#94A3B8]" />
              </div>
              <p className="font-semibold text-[#0F172A] text-sm">
                {isFiltered ? 'No instances match your filters' : 'No task instances yet'}
              </p>
              <p className="text-[#475569] text-sm mt-1">
                {isFiltered ? 'Try adjusting your filters.' : 'Tasks will appear here once the schedule fires.'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filtered.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onClick={() => router.push(`/dashboard/tasks/${task.id}`)}
                  priorities={priorities}
                  statuses={statuses}
                  categories={categories}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Sidebar: Template info ─────────────────────────────────────── */}
        <div className="w-full lg:w-72 shrink-0 space-y-4">

          {/* Schedule entries */}
          <div className="bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-5">
            <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider mb-3">Schedule</p>
            {entries.length === 0 ? (
              <p className="text-sm text-[#94A3B8]">No schedule configured</p>
            ) : (
              <div className="space-y-3">
                {entries.map((entry, i) => (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-sm font-medium text-[#0F172A]">
                        <RotateCcw size={13} className="text-[#2563EB] shrink-0" />
                        {entryLabel(entry)}
                      </div>
                      {!entry.is_active && (
                        <span className="text-[10px] font-medium text-[#DC2626] bg-[#FEE2E2] border border-[#FECACA] rounded-[999px] px-1.5 py-0.5">Ended</span>
                      )}
                    </div>
                    <div className="text-xs text-[#475569] pl-5 space-y-0.5">
                      <p>From {formatDate(entry.start_date)}</p>
                      {entry.end_condition === 'on_date' && entry.end_date && (
                        <p>Until {formatDate(entry.end_date)}</p>
                      )}
                      {entry.end_condition === 'after_n' && entry.end_after && (
                        <p>After {entry.end_after} occurrences</p>
                      )}
                      <p className="text-[#94A3B8]">{entry.occurrence_count} spawned · at {entry.time}</p>
                    </div>
                    {i < entries.length - 1 && <div className="border-t border-[#F1F5F9] mt-2" />}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Assignees */}
          {(template.assignee_user_ids?.length ?? 0) > 0 && (
            <div className="bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-5">
              <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Users size={12} /> Assignees
              </p>
              <div className="space-y-2">
                {template.assignee_user_ids.map((uid) => {
                  const name = userMap.get(uid) ?? uid.slice(0, 8)
                  return (
                    <div key={uid} className="flex items-center gap-2.5">
                      <div className={`w-7 h-7 rounded-full ${avatarColor(name)} flex items-center justify-center text-white text-[10px] font-bold shrink-0`}>
                        {getInitials(name)}
                      </div>
                      <span className="text-sm text-[#0F172A] break-words">{name}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Settings */}
          <div className="bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-5">
            <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider mb-3">Settings</p>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <Calendar size={14} className="text-[#94A3B8] mt-0.5 shrink-0" />
                <div>
                  <p className="text-[#475569] text-xs mb-0.5">Completion Mode</p>
                  <p className="text-[#0F172A] font-medium">
                    {template.completion_mode === 'any_can_complete' ? 'Any assignee can complete' : 'All assignees must complete'}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Shield size={14} className="text-[#94A3B8] mt-0.5 shrink-0" />
                <div>
                  <p className="text-[#475569] text-xs mb-0.5">Proof Required</p>
                  <p className="text-[#0F172A] font-medium">{template.proof_required ? 'Yes' : 'No'}</p>
                </div>
              </div>
              {template.category_id && categories.find((c) => c.id === template.category_id) && (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: categories.find((c) => c.id === template.category_id)?.color }} />
                  <span className="text-sm text-[#0F172A]">{categories.find((c) => c.id === template.category_id)?.name}</span>
                </div>
              )}
              {template.priority_id && priorities.find((p) => p.id === template.priority_id) && (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: priorities.find((p) => p.id === template.priority_id)?.color }} />
                  <span className="text-sm text-[#0F172A]">{priorities.find((p) => p.id === template.priority_id)?.label}</span>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {showEditModal && (
        <EditRecurringModal
          template={template}
          orgId={orgId}
          categories={categories}
          priorities={priorities}
          onClose={() => setShowEditModal(false)}
          onUpdated={(updated) => { setTemplate(updated); setShowEditModal(false) }}
        />
      )}
    </div>
  )
}
