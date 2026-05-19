'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { X, Plus, Trash2, Search } from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import { tasksApi } from '@/lib/api/tasks'
import type { TaskCategory, TaskPriority, TaskStatus, TaskQuadrant, CompletionMode } from '@/lib/types/tasks'
import apiClient from '@/lib/api/client'
import QuadrantBadge from './QuadrantBadge'

interface OrgMember {
  id: string
  user_id: string
  user: { id: string; name: string; email: string }
}

interface AssigneeEntry {
  user_id: string
  user_name: string
  user_email: string
  is_cc: boolean
}

interface ChecklistEntry {
  title: string
}

interface CreateTaskModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated: () => void
  categories: TaskCategory[]
  priorities: TaskPriority[]
  statuses: TaskStatus[]
}

const quadrants: { value: TaskQuadrant; label: string; sublabel: string }[] = [
  { value: 'Q1', label: 'Q1', sublabel: 'Urgent + Important' },
  { value: 'Q2', label: 'Q2', sublabel: 'Not Urgent + Important' },
  { value: 'Q3', label: 'Q3', sublabel: 'Urgent + Not Important' },
  { value: 'Q4', label: 'Q4', sublabel: 'Not Urgent + Not Important' },
]

const quadrantColors: Record<TaskQuadrant, { bg: string; text: string; border: string; activeBg: string }> = {
  Q1: { bg: 'bg-[#FEE2E2]', text: 'text-[#DC2626]', border: 'border-[#FECACA]', activeBg: 'bg-[#DC2626]' },
  Q2: { bg: 'bg-[#EFF6FF]', text: 'text-[#2563EB]', border: 'border-[#BFDBFE]', activeBg: 'bg-[#2563EB]' },
  Q3: { bg: 'bg-[#FEF9C3]', text: 'text-[#D97706]', border: 'border-[#FDE68A]', activeBg: 'bg-[#D97706]' },
  Q4: { bg: 'bg-[#F3F4F6]', text: 'text-[#6B7280]', border: 'border-[#E5E7EB]', activeBg: 'bg-[#6B7280]' },
}

export default function CreateTaskModal({
  isOpen,
  onClose,
  onCreated,
  categories,
  priorities,
  statuses,
}: CreateTaskModalProps) {
  const { user } = useAuth()
  const orgId = user?.organizationId ?? ''

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [quadrant, setQuadrant] = useState<TaskQuadrant>('Q2')
  const [priorityId, setPriorityId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [statusId, setStatusId] = useState('')
  const [deadline, setDeadline] = useState('')
  const [completionMode, setCompletionMode] = useState<CompletionMode>('any_can_complete')
  const [proofRequired, setProofRequired] = useState(false)
  const [assignees, setAssignees] = useState<AssigneeEntry[]>([])
  const [checklist, setChecklist] = useState<ChecklistEntry[]>([])
  const [newChecklistItem, setNewChecklistItem] = useState('')
  const [memberSearch, setMemberSearch] = useState('')
  const [members, setMembers] = useState<OrgMember[]>([])
  const [memberResults, setMemberResults] = useState<OrgMember[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const memberSearchRef = useRef<HTMLDivElement>(null)

  // Set default status
  useEffect(() => {
    if (statuses.length > 0 && !statusId) {
      const def = statuses.find((s) => s.is_default) ?? statuses[0]
      setStatusId(def.id)
    }
  }, [statuses, statusId])

  // Load org members
  useEffect(() => {
    if (!orgId || !isOpen) return
    apiClient.get(`/api/v1/org/${orgId}/members`).then((res) => {
      const data = res.data?.data ?? res.data ?? []
      setMembers(Array.isArray(data) ? data : [])
    }).catch(() => setMembers([]))
  }, [orgId, isOpen])

  // Filter members by search
  useEffect(() => {
    if (!memberSearch.trim()) {
      setMemberResults([])
      return
    }
    const q = memberSearch.toLowerCase()
    const alreadyAdded = new Set(assignees.map((a) => a.user_id))
    setMemberResults(
      members
        .filter((m) => {
          const name = m.user?.name ?? ''
          const email = m.user?.email ?? ''
          return !alreadyAdded.has(m.user_id) &&
            (name.toLowerCase().includes(q) || email.toLowerCase().includes(q))
        })
        .slice(0, 6)
    )
  }, [memberSearch, members, assignees])

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (memberSearchRef.current && !memberSearchRef.current.contains(e.target as Node)) {
        setMemberResults([])
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    function handle(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [isOpen, onClose])

  // Prevent body scroll
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  const reset = useCallback(() => {
    setTitle('')
    setDescription('')
    setQuadrant('Q2')
    setPriorityId('')
    setCategoryId('')
    setStatusId(statuses.find((s) => s.is_default)?.id ?? statuses[0]?.id ?? '')
    setDeadline('')
    setCompletionMode('any_can_complete')
    setProofRequired(false)
    setAssignees([])
    setChecklist([])
    setNewChecklistItem('')
    setMemberSearch('')
    setError(null)
  }, [statuses])

  function handleClose() {
    reset()
    onClose()
  }

  function addMember(m: OrgMember) {
    setAssignees((prev) => [
      ...prev,
      { user_id: m.user_id, user_name: m.user.name, user_email: m.user.email, is_cc: false },
    ])
    setMemberSearch('')
    setMemberResults([])
  }

  function toggleCC(userId: string) {
    setAssignees((prev) =>
      prev.map((a) => (a.user_id === userId ? { ...a, is_cc: !a.is_cc } : a))
    )
  }

  function removeAssignee(userId: string) {
    setAssignees((prev) => prev.filter((a) => a.user_id !== userId))
  }

  function addChecklistItem() {
    const t = newChecklistItem.trim()
    if (!t) return
    setChecklist((prev) => [...prev, { title: t }])
    setNewChecklistItem('')
  }

  function removeChecklistItem(idx: number) {
    setChecklist((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setError('Title is required.'); return }
    setSubmitting(true)
    setError(null)
    try {
      await tasksApi.createTask(orgId, {
        title: title.trim(),
        description: description.trim() || undefined,
        quadrant,
        priority_id: priorityId || undefined,
        category_id: categoryId || undefined,
        status_id: statusId || undefined,
        deadline: deadline || undefined,
        completion_mode: completionMode,
        proof_required: proofRequired,
        assignee_user_ids: assignees.filter((a) => !a.is_cc).map((a) => a.user_id),
        cc_user_ids: assignees.filter((a) => a.is_cc).map((a) => a.user_id),
        checklist: checklist.length > 0 ? checklist : undefined,
      })
      reset()
      onCreated()
    } catch {
      setError('Failed to create task. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-2xl bg-white rounded-[12px] shadow-[0_8px_32px_rgba(0,0,0,0.16)] border border-[#E2E8F0] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[#E2E8F0] shrink-0">
          <h2 className="text-[22px] font-semibold text-[#0F172A]">Create Task</h2>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-[6px] flex items-center justify-center text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {error && (
            <div className="bg-[#FEE2E2] border border-[#FECACA] rounded-[8px] px-4 py-3 text-sm text-[#DC2626]">
              {error}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">
              Title <span className="text-[#DC2626]">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title..."
              className="w-full border border-[#CBD5E1] rounded-[8px] px-3 py-[10px] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-2 focus:border-[#2563EB] focus:outline-none bg-white"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a description..."
              rows={3}
              className="w-full border border-[#CBD5E1] rounded-[8px] px-3 py-[10px] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-2 focus:border-[#2563EB] focus:outline-none bg-white resize-none"
            />
          </div>

          {/* Quadrant */}
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-2">Quadrant</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {quadrants.map((q) => {
                const cfg = quadrantColors[q.value]
                const isSelected = quadrant === q.value
                return (
                  <button
                    key={q.value}
                    type="button"
                    onClick={() => setQuadrant(q.value)}
                    className={[
                      'flex flex-col items-center rounded-[8px] px-2 py-2.5 border-2 transition-all duration-150',
                      isSelected
                        ? `${cfg.activeBg} border-transparent text-white`
                        : `${cfg.bg} ${cfg.border} ${cfg.text} hover:opacity-80`,
                    ].join(' ')}
                  >
                    <span className="text-sm font-bold">{q.label}</span>
                    <span className={`text-[10px] leading-tight text-center mt-0.5 ${isSelected ? 'text-white/80' : 'opacity-70'}`}>
                      {q.sublabel}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Priority + Category + Status */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Priority</label>
              <select
                value={priorityId}
                onChange={(e) => setPriorityId(e.target.value)}
                className="w-full border border-[#CBD5E1] rounded-[8px] px-3 py-[10px] text-sm text-[#0F172A] focus:border-2 focus:border-[#2563EB] focus:outline-none bg-white"
              >
                <option value="">No priority</option>
                {priorities.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Category</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full border border-[#CBD5E1] rounded-[8px] px-3 py-[10px] text-sm text-[#0F172A] focus:border-2 focus:border-[#2563EB] focus:outline-none bg-white"
              >
                <option value="">No category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Status</label>
              <select
                value={statusId}
                onChange={(e) => setStatusId(e.target.value)}
                className="w-full border border-[#CBD5E1] rounded-[8px] px-3 py-[10px] text-sm text-[#0F172A] focus:border-2 focus:border-[#2563EB] focus:outline-none bg-white"
              >
                {statuses.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Deadline */}
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Deadline</label>
            <input
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full border border-[#CBD5E1] rounded-[8px] px-3 py-[10px] text-sm text-[#0F172A] focus:border-2 focus:border-[#2563EB] focus:outline-none bg-white"
            />
          </div>

          {/* Assignees */}
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Assignees</label>
            <div className="relative" ref={memberSearchRef}>
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
              <input
                type="text"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Search members by name or email..."
                className="w-full pl-9 pr-3 border border-[#CBD5E1] rounded-[8px] py-[10px] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-2 focus:border-[#2563EB] focus:outline-none bg-white"
              />
              {memberResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#E2E8F0] rounded-[8px] shadow-lg z-20 overflow-hidden">
                  {memberResults.map((m) => (
                    <button
                      key={m.user_id}
                      type="button"
                      onClick={() => addMember(m)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#F8FAFC] transition-colors text-left"
                    >
                      <div className="w-7 h-7 rounded-full bg-[#2563EB] flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                        {m.user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[#0F172A]">{m.user.name}</p>
                        <p className="text-xs text-[#475569]">{m.user.email}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {assignees.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {assignees.map((a) => (
                  <div
                    key={a.user_id}
                    className="inline-flex items-center gap-1.5 bg-[#F1F5F9] border border-[#E2E8F0] rounded-[6px] pl-2 pr-1 py-1"
                  >
                    <span className="text-xs font-medium text-[#0F172A]">{a.user_name}</span>
                    <button
                      type="button"
                      onClick={() => toggleCC(a.user_id)}
                      className={[
                        'text-[10px] font-semibold rounded px-1 py-0.5 transition-colors',
                        a.is_cc
                          ? 'bg-[#D97706] text-white'
                          : 'bg-[#E2E8F0] text-[#475569] hover:bg-[#CBD5E1]',
                      ].join(' ')}
                      title={a.is_cc ? 'Click to remove CC' : 'Click to mark as CC'}
                    >
                      CC
                    </button>
                    <button
                      type="button"
                      onClick={() => removeAssignee(a.user_id)}
                      className="w-4 h-4 flex items-center justify-center text-[#94A3B8] hover:text-[#DC2626] transition-colors"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Completion mode */}
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-2">Completion Mode</label>
            <div className="flex gap-3">
              {(['any_can_complete', 'all_must_complete'] as CompletionMode[]).map((mode) => (
                <label
                  key={mode}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="completionMode"
                    value={mode}
                    checked={completionMode === mode}
                    onChange={() => setCompletionMode(mode)}
                    className="accent-[#2563EB]"
                  />
                  <span className="text-sm text-[#1E293B]">
                    {mode === 'any_can_complete' ? 'Any assignee can complete' : 'All assignees must complete'}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Proof required */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setProofRequired((v) => !v)}
              className={[
                'relative w-10 h-5 rounded-full transition-colors duration-200',
                proofRequired ? 'bg-[#2563EB]' : 'bg-[#CBD5E1]',
              ].join(' ')}
              role="switch"
              aria-checked={proofRequired}
            >
              <span
                className={[
                  'absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200',
                  proofRequired ? 'translate-x-5' : 'translate-x-0',
                ].join(' ')}
              />
            </button>
            <span className="text-sm text-[#1E293B] font-medium">Proof of completion required</span>
          </div>

          {/* Checklist */}
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Checklist</label>
            {checklist.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 mb-1.5">
                <div className="w-4 h-4 rounded border border-[#CBD5E1] shrink-0" />
                <span className="flex-1 text-sm text-[#0F172A]">{item.title}</span>
                <button
                  type="button"
                  onClick={() => removeChecklistItem(idx)}
                  className="text-[#94A3B8] hover:text-[#DC2626] transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <div className="flex gap-2 mt-2">
              <input
                type="text"
                value={newChecklistItem}
                onChange={(e) => setNewChecklistItem(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addChecklistItem() } }}
                placeholder="Add checklist item..."
                className="flex-1 border border-[#CBD5E1] rounded-[8px] px-3 py-[8px] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-2 focus:border-[#2563EB] focus:outline-none bg-white"
              />
              <button
                type="button"
                onClick={addChecklistItem}
                className="flex items-center gap-1.5 px-3 py-[8px] text-sm font-medium text-[#2563EB] border border-[#2563EB] rounded-[8px] hover:bg-[#EFF6FF] transition-colors"
              >
                <Plus size={14} />
                Add
              </button>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-end gap-3 px-6 py-4 border-t border-[#E2E8F0]">
          <button
            type="button"
            onClick={handleClose}
            className="px-5 py-[10px] text-sm font-semibold text-[#2563EB] bg-white border-2 border-[#2563EB] rounded-[8px] hover:bg-[#EFF6FF] transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={submitting}
            className="px-5 py-[10px] text-sm font-semibold text-white bg-[#2563EB] rounded-[8px] hover:bg-[#1D4ED8] disabled:bg-[#E2E8F0] disabled:text-[#94A3B8] disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Creating...' : 'Create Task'}
          </button>
        </div>
      </div>
    </div>
  )
}
