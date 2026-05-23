'use client'

import { useState } from 'react'
import { Loader2, ChevronLeft, Plus, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/context'
import { projectsApi } from '@/lib/api/projects'
import TemplatePicker from './TemplatePicker'
import type { ProjectTemplate } from '@/lib/types/projects'

interface WizardMember {
  user_id: string
  role: 'manager' | 'editor' | 'viewer'
  task_visibility: 'own_tasks_only' | 'all_member_tasks'
}

interface CreateProjectWizardProps {
  templates: ProjectTemplate[]
}

export default function CreateProjectWizard({ templates }: CreateProjectWizardProps) {
  const { user } = useAuth()
  const router = useRouter()
  const orgId = user?.organizationId ?? ''

  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Step 1 fields
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [pmUserId, setPmUserId] = useState(user?.id ?? '')
  const [budget, setBudget] = useState('')
  const [currency, setCurrency] = useState('INR')
  const [templateId, setTemplateId] = useState<string | null>(null)

  // Step 2 fields
  const [members, setMembers] = useState<WizardMember[]>([])
  const [newMemberInput, setNewMemberInput] = useState('')

  const inputCls = 'w-full h-10 px-3 rounded-[8px] border border-[#CBD5E1] text-sm text-[#0F172A] placeholder:text-[#94A3B8] bg-white focus:border-[#2563EB] focus:outline-none transition-colors'
  const labelCls = 'block text-sm font-medium text-[#374151] mb-1.5'

  function validateStep1() {
    if (!name.trim()) { setError('Project name is required'); return false }
    if (!pmUserId.trim()) { setError('Project manager is required'); return false }
    setError(''); return true
  }

  function addMember() {
    const id = newMemberInput.trim()
    if (!id || members.some((m) => m.user_id === id)) { setNewMemberInput(''); return }
    setMembers((prev) => [...prev, { user_id: id, role: 'viewer', task_visibility: 'own_tasks_only' }])
    setNewMemberInput('')
  }

  function updateMember(uid: string, patch: Partial<WizardMember>) {
    setMembers((prev) => prev.map((m) => m.user_id === uid ? { ...m, ...patch } : m))
  }

  function removeMember(uid: string) {
    setMembers((prev) => prev.filter((m) => m.user_id !== uid))
  }

  async function handleCreate() {
    setSaving(true)
    setError('')
    try {
      const project = await projectsApi.create(orgId, {
        name: name.trim(),
        description: description.trim() || undefined,
        project_manager_user_id: pmUserId.trim(),
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        planned_budget: budget ? Number(budget) : undefined,
        currency: currency || 'INR',
        template_id: templateId ?? undefined,
      })

      // Add additional members
      await Promise.all(
        members.map((m) =>
          projectsApi.addMember(orgId, project.id, {
            user_id: m.user_id,
            role: m.role,
            task_visibility: m.task_visibility,
          })
        )
      )

      router.push(`/dashboard/projects/${project.id}`)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to create project'
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl">
      {/* Steps indicator */}
      <div className="flex items-center gap-3 mb-8">
        {[1, 2].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={[
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold',
                s === step ? 'bg-[#2563EB] text-white' : s < step ? 'bg-[#DCFCE7] text-[#16A34A]' : 'bg-[#F1F5F9] text-[#94A3B8]',
              ].join(' ')}
            >
              {s}
            </div>
            <span className={`text-sm font-medium ${s === step ? 'text-[#0F172A]' : 'text-[#94A3B8]'}`}>
              {s === 1 ? 'Project Setup' : 'Add Members'}
            </span>
            {s < 2 && <div className="w-8 h-px bg-[#E2E8F0]" />}
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-[8px] border border-[#FECACA] bg-[#FEF2F2] text-sm text-[#DC2626]">
          {error}
        </div>
      )}

      {step === 1 && (
        <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)] space-y-4">
          <div>
            <label className={labelCls}>Project name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Website Redesign Q3" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description..." rows={3} className="w-full px-3 py-2 rounded-[8px] border border-[#CBD5E1] text-sm text-[#0F172A] placeholder:text-[#94A3B8] bg-white focus:border-[#2563EB] focus:outline-none resize-none" />
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
            <label className={labelCls}>Project manager (user ID) *</label>
            <input value={pmUserId} onChange={(e) => setPmUserId(e.target.value)} placeholder="User ID" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Planned budget</label>
              <input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="0" min="0" className={inputCls} />
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
            <label className={labelCls}>Start from template</label>
            <TemplatePicker templates={templates} selected={templateId} onSelect={setTemplateId} />
          </div>
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => { if (validateStep1()) setStep(2) }}
              className="h-10 px-6 rounded-[8px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold transition-colors"
            >
              Next: Add Members
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
          <p className="text-sm text-[#475569] mb-4">
            You and the project manager are automatically added. Add additional team members below.
          </p>

          <div className="flex gap-2 mb-4">
            <input
              value={newMemberInput}
              onChange={(e) => setNewMemberInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addMember() }}
              placeholder="Enter user ID"
              className={`${inputCls} flex-1`}
            />
            <button type="button" onClick={addMember} className="h-10 px-4 rounded-[8px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold transition-colors flex items-center gap-1.5">
              <Plus size={14} /> Add
            </button>
          </div>

          {members.length === 0 && (
            <p className="text-sm text-[#94A3B8] mb-4">No additional members added.</p>
          )}

          <div className="space-y-2 mb-6">
            {members.map((m) => (
              <div key={m.user_id} className="flex items-center gap-3 p-3 bg-[#F8FAFC] rounded-[8px] border border-[#E2E8F0]">
                <div className="w-7 h-7 rounded-full bg-[#EFF6FF] border border-[#BFDBFE] flex items-center justify-center">
                  <span className="text-[10px] font-semibold text-[#2563EB]">{m.user_id.charAt(0).toUpperCase()}</span>
                </div>
                <span className="text-sm text-[#0F172A] flex-1 truncate">{m.user_id}</span>
                <select
                  value={m.role}
                  onChange={(e) => updateMember(m.user_id, { role: e.target.value as 'manager' | 'editor' | 'viewer' })}
                  className="text-xs border border-[#CBD5E1] rounded-[6px] px-2 py-1.5 text-[#0F172A] bg-white focus:border-[#2563EB] focus:outline-none"
                >
                  <option value="manager">Manager</option>
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
                <select
                  value={m.task_visibility}
                  onChange={(e) => updateMember(m.user_id, { task_visibility: e.target.value as 'own_tasks_only' | 'all_member_tasks' })}
                  className="text-xs border border-[#CBD5E1] rounded-[6px] px-2 py-1.5 text-[#0F172A] bg-white focus:border-[#2563EB] focus:outline-none"
                >
                  <option value="own_tasks_only">Own tasks</option>
                  <option value="all_member_tasks">All tasks</option>
                </select>
                <button type="button" onClick={() => removeMember(m.user_id)} className="p-1 rounded hover:bg-[#FEE2E2] text-[#DC2626] transition-colors">
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>

          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="h-10 px-4 rounded-[8px] border-2 border-[#2563EB] text-[#2563EB] text-sm font-semibold hover:bg-[#EFF6FF] transition-colors flex items-center gap-1.5"
            >
              <ChevronLeft size={16} /> Back
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleCreate}
              className="h-10 px-6 rounded-[8px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold disabled:bg-[#E2E8F0] disabled:text-[#94A3B8] transition-colors flex items-center gap-2"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
