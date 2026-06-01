'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Search, X, Plus, Check, Zap, Briefcase, UserPlus } from 'lucide-react'
import { tasksApi } from '@/lib/api/tasks'
import type { EligibleAssigneesResponse, EligibleAssigneeUser, SelectedAssignee } from '@/lib/types/tasks'

// ─── Avatar helpers ───────────────────────────────────────────────────────────

const avatarColors = [
  'bg-[#2563EB]', 'bg-[#7C3AED]', 'bg-[#059669]',
  'bg-[#D97706]', 'bg-[#DC2626]', 'bg-[#0891B2]',
]
function avatarColor(name: string): string {
  let h = 0; for (let i = 0; i < name.length; i++) h += name.charCodeAt(i)
  return avatarColors[h % avatarColors.length]
}
function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0] ?? '').join('').toUpperCase().slice(0, 2) || '?'
}

// ─── Sort type ────────────────────────────────────────────────────────────────

type SortMode = 'frequency' | 'workload' | 'name'

// ─── Skeleton row ─────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 animate-pulse">
      <div className="w-8 h-8 rounded-full bg-[#F1F5F9] shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 bg-[#F1F5F9] rounded w-32" />
        <div className="h-2.5 bg-[#F1F5F9] rounded w-20" />
      </div>
    </div>
  )
}

// ─── User row ─────────────────────────────────────────────────────────────────

function UserRow({
  user,
  selected,
  onToggle,
}: {
  user: EligibleAssigneeUser
  selected: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`w-full flex items-center gap-3 px-3 py-2.5 transition-colors text-left ${
        selected ? 'bg-[#EFF6FF]' : 'hover:bg-[#F8FAFC]'
      }`}
    >
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 ${avatarColor(user.name)}`}
      >
        {getInitials(user.name)}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#0F172A] truncate">{user.name}</p>
        <p className="text-xs text-[#64748B] truncate">{user.role_title}</p>
      </div>

      {/* Badges */}
      <div className="flex items-center gap-1.5 shrink-0">
        {user.is_frequent && (
          <span className="flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#EFF6FF] text-[#2563EB]">
            <Zap size={9} />
            Frequent
          </span>
        )}
        <span
          title="Active tasks"
          className="flex items-center gap-0.5 text-[10px] font-medium text-[#64748B] bg-[#F1F5F9] px-1.5 py-0.5 rounded-full"
        >
          <Briefcase size={9} />
          {user.active_task_count}
        </span>
        {selected && (
          <span className="w-4 h-4 flex items-center justify-center bg-[#2563EB] rounded-full shrink-0">
            <Check size={10} className="text-white" strokeWidth={3} />
          </span>
        )}
      </div>
    </button>
  )
}

// ─── Assignee chip ────────────────────────────────────────────────────────────

function AssigneeChip({
  assignee,
  onToggleCC,
  onRemove,
}: {
  assignee: SelectedAssignee
  onToggleCC: () => void
  onRemove: () => void
}) {
  return (
    <div className="inline-flex items-center gap-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[8px] pl-1.5 pr-1 py-1 max-w-[180px]">
      <div
        className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0 ${avatarColor(assignee.name)}`}
      >
        {getInitials(assignee.name)}
      </div>
      <span className="text-xs font-medium text-[#0F172A] truncate hidden sm:inline">{assignee.name.split(' ')[0]}</span>
      <span className="text-xs font-medium text-[#0F172A] truncate sm:hidden">{assignee.name.split(' ')[0]}</span>
      <button
        type="button"
        onClick={onToggleCC}
        title={assignee.is_cc ? 'Click to make Assignee' : 'Click to make CC'}
        className={`text-[10px] font-semibold rounded-[4px] px-1.5 py-0.5 transition-colors shrink-0 ${
          assignee.is_cc
            ? 'bg-[#FEF9C3] text-[#D97706] border border-[#FDE68A]'
            : 'bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]'
        }`}
      >
        {assignee.is_cc ? 'CC' : 'Assignee'}
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="w-4 h-4 flex items-center justify-center text-[#94A3B8] hover:text-[#DC2626] transition-colors shrink-0"
        aria-label={`Remove ${assignee.name}`}
      >
        <X size={11} />
      </button>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  orgId: string
  value: SelectedAssignee[]
  onChange: (assignees: SelectedAssignee[]) => void
  disabled?: boolean
  currentUser?: { user_id: string; name: string }
}

export default function AssigneeSelector({ orgId, value, onChange, disabled, currentUser }: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortMode>('frequency')
  const [data, setData] = useState<EligibleAssigneesResponse | null>(null)
  const [loading, setLoading] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const selectedIds = new Set(value.map((a) => a.user_id))

  // ── Fetch eligible assignees ────────────────────────────────────────────────

  const fetchAssignees = useCallback(async (q: string, s: SortMode) => {
    setLoading(true)
    try {
      const result = await tasksApi.getEligibleAssignees(orgId, q || undefined, s)
      setData(result)
    } catch {
      setData({ departments: [], total: 0 })
    } finally {
      setLoading(false)
    }
  }, [orgId])

  // Fetch when opening, or when sort changes while open
  useEffect(() => {
    if (!open) return
    fetchAssignees(search, sort)
  }, [open, sort]) // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced search
  useEffect(() => {
    if (!open) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchAssignees(search, sort)
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [search]) // eslint-disable-line react-hooks/exhaustive-deps

  // Outside click to close
  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  // Focus search on open
  useEffect(() => {
    if (open) {
      setTimeout(() => searchInputRef.current?.focus(), 50)
    } else {
      setSearch('')
    }
  }, [open])

  // ── Handlers ────────────────────────────────────────────────────────────────

  function toggleUser(user: EligibleAssigneeUser) {
    if (selectedIds.has(user.user_id)) {
      onChange(value.filter((a) => a.user_id !== user.user_id))
    } else {
      onChange([...value, { user_id: user.user_id, name: user.name, is_cc: false }])
    }
  }

  function toggleCC(userId: string) {
    onChange(value.map((a) => a.user_id === userId ? { ...a, is_cc: !a.is_cc } : a))
  }

  function removeAssignee(userId: string) {
    onChange(value.filter((a) => a.user_id !== userId))
  }

  // ── Flatten all users (for rendering) ───────────────────────────────────────

  const allUsers: EligibleAssigneeUser[] = data?.departments.flatMap((d) => d.users) ?? []

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div ref={containerRef} className="relative">
      {/* Selected chips + trigger */}
      <div className="flex flex-wrap gap-1.5 items-center min-h-[42px] p-1.5 border border-[#CBD5E1] rounded-[8px] bg-white focus-within:border-[#2563EB] transition-colors">
        {value.map((a) => (
          <AssigneeChip
            key={a.user_id}
            assignee={a}
            onToggleCC={() => toggleCC(a.user_id)}
            onRemove={() => removeAssignee(a.user_id)}
          />
        ))}
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1 px-2 py-1 rounded-[6px] text-xs font-medium text-[#2563EB] hover:bg-[#EFF6FF] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus size={12} />
          Add
        </button>
      </div>

      {/* Dropdown panel */}
      {open && (
        <>
          {/* Mobile overlay */}
          <div className="fixed inset-0 bg-black/20 z-40 md:hidden" onClick={() => setOpen(false)} />

          {/* Panel */}
          <div className={`
            z-50 bg-white border border-[#E2E8F0] shadow-[0_8px_32px_rgba(0,0,0,0.12)]
            fixed bottom-0 left-0 right-0 rounded-t-[16px] max-h-[75vh]
            md:absolute md:bottom-auto md:left-0 md:top-full md:mt-1.5 md:right-auto md:w-96 md:rounded-[12px] md:max-h-96
            flex flex-col overflow-hidden
          `}>
            {/* Panel header */}
            <div className="flex items-center gap-2 px-3 pt-3 pb-2 border-b border-[#F1F5F9] shrink-0">
              {/* Search */}
              <div className="relative flex-1">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name..."
                  className="w-full pl-8 pr-3 py-[7px] text-sm text-[#0F172A] placeholder:text-[#94A3B8] border border-[#E2E8F0] rounded-[8px] focus:border-[#2563EB] focus:outline-none bg-white"
                />
              </div>

              {/* Sort toggle */}
              <div className="flex items-center border border-[#E2E8F0] rounded-[6px] p-0.5 gap-0.5 shrink-0">
                {(['frequency', 'workload', 'name'] as SortMode[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSort(s)}
                    className={`px-2 py-1 rounded-[4px] text-[10px] font-semibold transition-colors ${
                      sort === s ? 'bg-[#2563EB] text-white' : 'text-[#475569] hover:bg-[#F1F5F9]'
                    }`}
                  >
                    {s === 'frequency' ? 'Frequent' : s === 'workload' ? 'Workload' : 'A-Z'}
                  </button>
                ))}
              </div>

              {/* Close on mobile */}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded-[6px] text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors md:hidden"
              >
                <X size={14} />
              </button>
            </div>

            {/* Assign to me shortcut */}
            {currentUser && !selectedIds.has(currentUser.user_id) && (
              <button
                type="button"
                onClick={() => {
                  onChange([...value, { user_id: currentUser.user_id, name: currentUser.name, is_cc: false }])
                }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm font-medium text-[#2563EB] hover:bg-[#EFF6FF] border-b border-[#F1F5F9] transition-colors shrink-0"
              >
                <UserPlus size={13} />
                Assign to me
              </button>
            )}

            {/* Panel body */}
            <div className="overflow-y-auto flex-1">
              {loading ? (
                <div className="py-1">
                  {[1, 2, 3, 4, 5].map((i) => <SkeletonRow key={i} />)}
                </div>
              ) : !data || data.total === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                  <div className="w-10 h-10 rounded-full bg-[#F1F5F9] flex items-center justify-center mb-3">
                    <Search size={16} className="text-[#94A3B8]" />
                  </div>
                  <p className="text-sm font-medium text-[#0F172A]">
                    {search ? 'No users found' : 'No eligible assignees'}
                  </p>
                  <p className="text-xs text-[#475569] mt-1">
                    {search ? 'Try a different search term.' : 'Check visibility settings in Task Masters.'}
                  </p>
                </div>
              ) : (
                <div>
                  {data.departments.map((dept) => (
                    <div key={dept.department_id}>
                      {/* Department header (hidden for search flat list) */}
                      {dept.department_id !== 'search' && (
                        <div className="px-3 py-1.5 bg-[#F8FAFC] border-b border-[#F1F5F9]">
                          <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wide">
                            {dept.department_name}
                            <span className="ml-1.5 font-normal normal-case text-[#94A3B8]">({dept.users.length})</span>
                          </span>
                        </div>
                      )}
                      {dept.users.map((user) => (
                        <UserRow
                          key={user.user_id}
                          user={user}
                          selected={selectedIds.has(user.user_id)}
                          onToggle={() => toggleUser(user)}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer: selected count */}
            {value.length > 0 && (
              <div className="px-3 py-2.5 border-t border-[#F1F5F9] bg-[#F8FAFC] shrink-0">
                <p className="text-xs text-[#475569]">
                  <span className="font-semibold text-[#0F172A]">{value.filter((a) => !a.is_cc).length}</span> assignee{value.filter((a) => !a.is_cc).length !== 1 ? 's' : ''},&nbsp;
                  <span className="font-semibold text-[#0F172A]">{value.filter((a) => a.is_cc).length}</span> CC
                  <span className="text-[#64748B]"> · Click badge to toggle CC</span>
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
