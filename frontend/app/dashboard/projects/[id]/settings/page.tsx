'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth/context'
import { projectsApi } from '@/lib/api/projects'
import type { Project, ProjectMember } from '@/lib/types/projects'
import MemberRow from '@/components/projects/MemberRow'
import { ChevronLeft, Plus, Loader2, Trash2 } from 'lucide-react'

const STATUS_OPTS = [
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

const inputCls = 'w-full h-10 px-3 rounded-[8px] border border-[#CBD5E1] text-sm text-[#0F172A] placeholder:text-[#94A3B8] bg-white focus:border-[#2563EB] focus:outline-none'
const labelCls = 'block text-sm font-medium text-[#374151] mb-1.5'

export default function ProjectSettingsPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const router = useRouter()
  const orgId = user?.organizationId ?? ''
  const userId = user?.id ?? ''

  const [project, setProject] = useState<Project | null>(null)
  const [members, setMembers] = useState<ProjectMember[]>([])
  const [loading, setLoading] = useState(true)

  // Edit fields
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [pmUserId, setPmUserId] = useState('')
  const [status, setStatus] = useState('active')
  const [statusReason, setStatusReason] = useState('')
  const [plannedBudget, setPlannedBudget] = useState('')
  const [actualSpent, setActualSpent] = useState('')
  const [currency, setCurrency] = useState('INR')

  // Add member
  const [newMemberId, setNewMemberId] = useState('')
  const [addingMember, setAddingMember] = useState(false)

  // Save / delete state
  const [saving, setSaving] = useState(false)
  const [deleteReason, setDeleteReason] = useState('')
  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const load = useCallback(() => {
    if (!orgId || !id) return
    setLoading(true)
    Promise.all([
      projectsApi.get(orgId, id),
      projectsApi.listMembers(orgId, id),
    ]).then(([proj, mems]) => {
      setProject(proj)
      setMembers(mems)
      setName(proj.name)
      setDescription(proj.description ?? '')
      setStartDate(proj.start_date ?? '')
      setEndDate(proj.end_date ?? '')
      setPmUserId(proj.project_manager_user_id)
      setStatus(proj.status)
      setStatusReason(proj.status_reason ?? '')
      setPlannedBudget(proj.planned_budget?.toString() ?? '')
      setActualSpent(proj.actual_spent?.toString() ?? '')
      setCurrency(proj.currency)
    }).catch(() => setError('Failed to load project')).finally(() => setLoading(false))
  }, [orgId, id])

  useEffect(() => { load() }, [load])

  async function handleSave() {
    if (!name.trim()) { setError('Project name is required'); return }
    setSaving(true); setError(''); setSuccess('')
    try {
      await projectsApi.update(orgId, id, {
        name: name.trim(),
        description: description.trim() || undefined,
        project_manager_user_id: pmUserId.trim(),
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      })
      if (status !== project?.status || statusReason !== (project?.status_reason ?? '')) {
        const needsReason = status === 'on_hold' || status === 'cancelled'
        if (needsReason && !statusReason.trim()) {
          setError('Status reason is required for On Hold / Cancelled')
          setSaving(false); return
        }
        await projectsApi.updateStatus(orgId, id, {
          status,
          status_reason: statusReason.trim() || undefined,
        })
      }
      if (plannedBudget || actualSpent) {
        await projectsApi.updateBudget(orgId, id, {
          planned_budget: plannedBudget ? Number(plannedBudget) : undefined,
          actual_spent: actualSpent ? Number(actualSpent) : undefined,
          currency,
        })
      }
      setSuccess('Project updated successfully')
      load()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to update project'
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  async function handleAddMember() {
    if (!newMemberId.trim()) return
    setAddingMember(true)
    try {
      await projectsApi.addMember(orgId, id, { user_id: newMemberId.trim() })
      setNewMemberId('')
      load()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to add member'
      setError(msg)
    } finally {
      setAddingMember(false)
    }
  }

  async function handleRemoveMember(userId: string) {
    await projectsApi.removeMember(orgId, id, userId)
    load()
  }

  async function handleUpdateMember(userId: string, patch: { role?: string; task_visibility?: string }) {
    await projectsApi.updateMember(orgId, id, userId, patch)
    load()
  }

  async function handleDelete() {
    if (!deleteReason.trim()) { setError('Deletion reason is required'); return }
    setDeleting(true)
    try {
      await projectsApi.delete(orgId, id, deleteReason.trim())
      router.push('/dashboard/projects')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to delete project'
      setError(msg)
      setDeleting(false)
    }
  }

  const needsReason = status === 'on_hold' || status === 'cancelled'

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p className="font-semibold text-[#0F172A]">Project not found</p>
        <Link href="/dashboard/projects" className="mt-2 text-sm text-[#2563EB] hover:underline">
          Back to Projects
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link
          href={`/dashboard/projects/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-[#475569] hover:text-[#0F172A] transition-colors mb-3"
        >
          <ChevronLeft size={15} />
          Back to Project
        </Link>
        <h1 className="text-[28px] font-bold text-[#0F172A] leading-tight">Project Settings</h1>
        <p className="mt-1 text-[15px] text-[#475569]">{project.name}</p>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-[8px] border border-[#FECACA] bg-[#FEF2F2] text-sm text-[#DC2626]">
          {error}
        </div>
      )}
      {success && (
        <div className="px-4 py-3 rounded-[8px] border border-[#BBF7D0] bg-[#DCFCE7] text-sm text-[#16A34A]">
          {success}
        </div>
      )}

      {/* General */}
      <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)] space-y-4">
        <h2 className="text-base font-semibold text-[#0F172A]">General</h2>
        <div>
          <label className={labelCls}>Project name *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 rounded-[8px] border border-[#CBD5E1] text-sm text-[#0F172A] placeholder:text-[#94A3B8] bg-white focus:border-[#2563EB] focus:outline-none resize-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Start date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>End date</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Project manager (user ID)</label>
          <input value={pmUserId} onChange={(e) => setPmUserId(e.target.value)} className={inputCls} />
        </div>
      </div>

      {/* Status */}
      <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)] space-y-4">
        <h2 className="text-base font-semibold text-[#0F172A]">Status</h2>
        <div>
          <label className={labelCls}>Project status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
            {STATUS_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        {needsReason && (
          <div>
            <label className={labelCls}>Status reason *</label>
            <input
              value={statusReason}
              onChange={(e) => setStatusReason(e.target.value)}
              placeholder="Explain why the project is being put on hold or cancelled"
              className={inputCls}
            />
          </div>
        )}
      </div>

      {/* Budget */}
      <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)] space-y-4">
        <h2 className="text-base font-semibold text-[#0F172A]">Budget</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <label className={labelCls}>Planned budget</label>
            <input type="number" value={plannedBudget} onChange={(e) => setPlannedBudget(e.target.value)} min="0" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Currency</label>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputCls}>
              <option value="INR">INR</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
            </select>
          </div>
        </div>
        <div>
          <label className={labelCls}>Actual spent</label>
          <input type="number" value={actualSpent} onChange={(e) => setActualSpent(e.target.value)} min="0" className={inputCls} />
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="h-10 px-6 rounded-[8px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold disabled:opacity-60 transition-colors flex items-center gap-2"
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {/* Members */}
      <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)] space-y-4">
        <h2 className="text-base font-semibold text-[#0F172A]">Members</h2>

        <div className="flex gap-2">
          <input
            value={newMemberId}
            onChange={(e) => setNewMemberId(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddMember() }}
            placeholder="Enter user ID to add"
            className={`${inputCls} flex-1`}
          />
          <button
            type="button"
            disabled={addingMember || !newMemberId.trim()}
            onClick={handleAddMember}
            className="h-10 px-4 rounded-[8px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold disabled:opacity-60 transition-colors flex items-center gap-1.5"
          >
            {addingMember ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Add
          </button>
        </div>

        <div className="space-y-1">
          {members.map((m) => (
            <MemberRow
              key={m.id}
              member={m}
              currentUserId={userId}
              canEdit
              onRoleChange={(uid, role) => handleUpdateMember(uid, { role })}
              onVisibilityChange={(uid, visibility) => handleUpdateMember(uid, { task_visibility: visibility })}
              onRemove={() => handleRemoveMember(m.user_id)}
            />
          ))}
        </div>
      </div>

      {/* Danger zone */}
      <div className="bg-white border border-[#FECACA] rounded-[12px] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)] space-y-4">
        <h2 className="text-base font-semibold text-[#DC2626]">Danger Zone</h2>
        <p className="text-sm text-[#475569]">
          Deleting a project is irreversible. All milestones and project task links will be removed.
          Tasks in the tasks system will not be deleted.
        </p>
        {!showDelete ? (
          <button
            type="button"
            onClick={() => setShowDelete(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-[8px] border border-[#FECACA] text-[#DC2626] text-sm font-medium hover:bg-[#FEF2F2] transition-colors"
          >
            <Trash2 size={14} />
            Delete Project
          </button>
        ) : (
          <div className="space-y-3">
            <input
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              placeholder="Reason for deletion (required)"
              className="w-full h-10 px-3 rounded-[8px] border border-[#FECACA] text-sm text-[#0F172A] placeholder:text-[#94A3B8] bg-white focus:border-[#DC2626] focus:outline-none"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowDelete(false)}
                className="h-9 px-4 rounded-[8px] border border-[#E2E8F0] text-sm font-medium text-[#475569] hover:bg-[#F8FAFC] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting || !deleteReason.trim()}
                onClick={handleDelete}
                className="h-9 px-4 rounded-[8px] bg-[#DC2626] hover:bg-[#B91C1C] text-white text-sm font-semibold disabled:opacity-60 transition-colors flex items-center gap-1.5"
              >
                {deleting && <Loader2 size={13} className="animate-spin" />}
                Confirm Delete
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
