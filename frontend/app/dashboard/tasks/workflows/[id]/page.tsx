'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Save, Send, Play, GitBranch, List } from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import { workflowsApi } from '@/lib/api/workflows'
import type { WorkflowTemplate, WorkflowStep, WorkflowNature, WorkflowRecurringType } from '@/lib/types/workflows'
import StepEditor from '@/components/workflows/StepEditor'
import TriggerCard, { TriggerConfigModal } from '@/components/workflows/TriggerCard'
import ManualTriggerModal from '@/components/workflows/ManualTriggerModal'

const NATURE_TABS: { value: WorkflowNature; label: string }[] = [
  { value: 'one_time', label: 'One-time' },
  { value: 'recurring', label: 'Recurring' },
]
const RECURRING_TYPES: { value: WorkflowRecurringType; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
]

type BuilderTab = 'steps' | 'triggers'

export default function EditWorkflowPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const router = useRouter()
  const orgId = user?.organizationId ?? ''

  const [workflow, setWorkflow] = useState<WorkflowTemplate | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [nature, setNature] = useState<WorkflowNature>('one_time')
  const [recurringType, setRecurringType] = useState<WorkflowRecurringType>('daily')
  const [showOnCard, setShowOnCard] = useState(true)
  const [steps, setSteps] = useState<WorkflowStep[]>([])
  const [tab, setTab] = useState<BuilderTab>('steps')

  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState('')
  const [showTriggerModal, setShowTriggerModal] = useState(false)
  const [triggerTarget, setTriggerTarget] = useState<WorkflowTemplate | null>(null)

  const load = useCallback(async () => {
    if (!orgId) return
    const data = await workflowsApi.getWorkflow(orgId, id)
    setWorkflow(data)
    setName(data.name)
    setDescription(data.description ?? '')
    setNature(data.workflow_nature)
    setRecurringType(data.recurring_type ?? 'daily')
    setShowOnCard(data.show_workflow_on_task_card)
    setSteps(data.steps ?? [])
  }, [orgId, id])

  useEffect(() => { load() }, [load])

  async function handleSaveMeta() {
    setSaving(true)
    setError('')
    try {
      await workflowsApi.updateWorkflow(orgId, id, {
        name: name.trim(),
        description: description.trim() || undefined,
        workflow_nature: nature,
        recurring_type: nature === 'recurring' ? recurringType : undefined,
        show_workflow_on_task_card: showOnCard,
      })
      await load()
    } catch {
      setError('Failed to save changes.')
    } finally {
      setSaving(false)
    }
  }

  async function handlePublish() {
    if (steps.length === 0) { setError('Add at least one step before publishing'); return }
    if ((workflow?.triggers?.length ?? 0) === 0) { setError('Add at least one trigger before publishing'); return }
    setPublishing(true)
    try {
      await workflowsApi.publishWorkflow(orgId, id)
      await load()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      setError(msg || 'Failed to publish.')
    } finally {
      setPublishing(false)
    }
  }

  async function handleAddStep() {
    const newStep = await workflowsApi.addStep(orgId, id, {
      title: 'New step',
      assignee_type: 'fixed_person',
      assigner_user_id: user?.id ?? '',
      if_overdue_action: 'block_next',
      proof_required: false,
      checklist_items: [],
      deadline_config: { type: 'x_days_after_start', days: 1, time: '09:00' } as never,
      order_index: steps.length,
    })
    setSteps((s) => [...s, newStep])
  }

  async function handleUpdateStep(idx: number, updated: Partial<WorkflowStep>) {
    const step = steps[idx]
    await workflowsApi.updateStep(orgId, id, step.id, updated)
    setSteps((s) => s.map((st, i) => i === idx ? { ...st, ...updated } : st))
  }

  async function handleDeleteStep(idx: number) {
    const step = steps[idx]
    await workflowsApi.deleteStep(orgId, id, step.id)
    setSteps((s) => s.filter((_, i) => i !== idx))
  }

  async function handleMoveStep(idx: number, dir: -1 | 1) {
    const target = idx + dir
    if (target < 0 || target >= steps.length) return
    const reordered = [...steps]
    ;[reordered[idx], reordered[target]] = [reordered[target], reordered[idx]]
    const items = reordered.map((s, i) => ({ id: s.id, order_index: i }))
    await workflowsApi.reorderSteps(orgId, id, items)
    setSteps(reordered.map((s, i) => ({ ...s, order_index: i })))
  }

  async function handleAddTrigger(type: string, config: Record<string, unknown>) {
    await workflowsApi.addTrigger(orgId, id, { type, config })
    load()
  }

  async function handleDeleteTrigger(triggerId: string) {
    await workflowsApi.deleteTrigger(orgId, id, triggerId)
    load()
  }

  async function handleTrigger(name: string) {
    const { id: instId } = await workflowsApi.triggerInstance(orgId, id, name)
    router.push(`/dashboard/tasks/workflows/${id}/instances/${instId}`)
  }

  const inputCls = 'w-full px-3 py-2.5 border border-[#CBD5E1] rounded-[8px] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#2563EB] focus:outline-none bg-white'

  if (!workflow) {
    return (
      <div className="flex flex-col gap-4 animate-pulse max-w-3xl">
        <div className="h-8 w-64 bg-[#F1F5F9] rounded" />
        <div className="h-48 bg-[#F1F5F9] rounded-[12px]" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <button type="button" onClick={() => router.back()} className="w-8 h-8 flex items-center justify-center rounded-[8px] text-[#475569] hover:bg-[#F1F5F9] transition-colors shrink-0">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-[22px] font-bold text-[#0F172A] truncate">{workflow.name}</h1>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
              workflow.status === 'active' ? 'bg-[#DCFCE7] text-[#16A34A]' : workflow.status === 'draft' ? 'bg-[#FEF9C3] text-[#CA8A04]' : 'bg-[#FEE2E2] text-[#DC2626]'
            }`}>
              {workflow.status}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => router.push(`/dashboard/tasks/workflows/${id}/instances`)} className="flex items-center gap-1.5 px-3 py-2 rounded-[7px] text-sm font-medium text-[#475569] bg-[#F8FAFC] border border-[#E2E8F0] hover:bg-[#F1F5F9]">
            <List size={14} /> Instances
          </button>
          {workflow.status === 'active' && (
            <button type="button" onClick={() => setTriggerTarget(workflow)} className="flex items-center gap-1.5 px-3 py-2 rounded-[7px] text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8]">
              <Play size={14} /> Trigger
            </button>
          )}
          {workflow.status === 'draft' && (
            <button type="button" onClick={handlePublish} disabled={publishing} className="flex items-center gap-1.5 px-3 py-2 rounded-[7px] text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:bg-[#E2E8F0] disabled:text-[#94A3B8]">
              <Send size={14} /> {publishing ? 'Publishing...' : 'Publish'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 bg-[#FEE2E2] border border-[#FECACA] rounded-[8px] text-sm text-[#DC2626]">{error}</div>
      )}

      {/* Metadata */}
      <div className="bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-5 flex flex-col gap-4">
        <div className="flex items-center gap-2 mb-1">
          <GitBranch size={16} className="text-[#2563EB]" />
          <h2 className="text-[15px] font-semibold text-[#0F172A]">Workflow Settings</h2>
        </div>
        <div>
          <label className="block text-sm font-medium text-[#374151] mb-1.5">Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#374151] mb-1.5">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={`${inputCls} resize-none`} />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#374151] mb-1.5">Type</label>
          <div className="flex gap-2">
            {NATURE_TABS.map((n) => (
              <button key={n.value} type="button" onClick={() => setNature(n.value)} className={`flex-1 py-2 rounded-[7px] text-sm font-medium border transition-colors ${nature === n.value ? 'bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE]' : 'bg-white text-[#475569] border-[#E2E8F0] hover:bg-[#F8FAFC]'}`}>
                {n.label}
              </button>
            ))}
          </div>
        </div>
        {nature === 'recurring' && (
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Recurring period</label>
            <div className="flex gap-2">
              {RECURRING_TYPES.map((rt) => (
                <button key={rt.value} type="button" onClick={() => setRecurringType(rt.value)} className={`flex-1 py-1.5 rounded-[6px] text-xs font-semibold border transition-colors ${recurringType === rt.value ? 'bg-[#2563EB] text-white border-[#2563EB]' : 'bg-white text-[#475569] border-[#E2E8F0] hover:bg-[#F8FAFC]'}`}>
                  {rt.label}
                </button>
              ))}
            </div>
          </div>
        )}
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input type="checkbox" checked={showOnCard} onChange={(e) => setShowOnCard(e.target.checked)} className="w-4 h-4 rounded border-[#CBD5E1] text-[#2563EB] focus:ring-[#2563EB]" />
          <span className="text-sm text-[#374151]">Show workflow badge on task cards</span>
        </label>
        <div className="flex justify-end">
          <button type="button" onClick={handleSaveMeta} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 rounded-[8px] text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:bg-[#E2E8F0] disabled:text-[#94A3B8] transition-colors">
            <Save size={14} /> {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#E2E8F0]">
        {(['steps', 'triggers'] as BuilderTab[]).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={`px-5 py-2.5 text-sm font-semibold capitalize border-b-2 transition-colors ${tab === t ? 'border-[#2563EB] text-[#2563EB]' : 'border-transparent text-[#475569] hover:text-[#0F172A]'}`}>
            {t}
            {t === 'steps' && <span className="ml-1.5 text-xs bg-[#F1F5F9] text-[#475569] px-1.5 py-0.5 rounded-full">{steps.length}</span>}
            {t === 'triggers' && <span className="ml-1.5 text-xs bg-[#F1F5F9] text-[#475569] px-1.5 py-0.5 rounded-full">{workflow.triggers?.length ?? 0}</span>}
          </button>
        ))}
      </div>

      {tab === 'steps' && (
        <div className="flex flex-col gap-3">
          {steps.map((step, idx) => (
            <StepEditor
              key={step.id}
              step={step}
              index={idx}
              isFirst={idx === 0}
              isLast={idx === steps.length - 1}
              nature={nature}
              orgId={orgId}
              onSave={(updated) => handleUpdateStep(idx, updated)}
              onDelete={() => handleDeleteStep(idx)}
              onMoveUp={() => handleMoveStep(idx, -1)}
              onMoveDown={() => handleMoveStep(idx, 1)}
            />
          ))}
          <button type="button" onClick={handleAddStep} className="flex items-center justify-center gap-2 w-full py-3 rounded-[10px] border-2 border-dashed border-[#CBD5E1] text-sm font-medium text-[#475569] hover:border-[#2563EB] hover:text-[#2563EB] hover:bg-[#F8FAFF] transition-all">
            <Plus size={16} /> Add Step
          </button>
        </div>
      )}

      {tab === 'triggers' && (
        <div className="flex flex-col gap-3">
          {(workflow.triggers ?? []).map((trigger) => (
            <TriggerCard key={trigger.id} trigger={trigger} onDelete={() => handleDeleteTrigger(trigger.id)} />
          ))}
          <button type="button" onClick={() => setShowTriggerModal(true)} className="flex items-center justify-center gap-2 w-full py-3 rounded-[10px] border-2 border-dashed border-[#CBD5E1] text-sm font-medium text-[#475569] hover:border-[#2563EB] hover:text-[#2563EB] hover:bg-[#F8FAFF] transition-all">
            <Plus size={16} /> Add Trigger
          </button>
        </div>
      )}

      {showTriggerModal && (
        <TriggerConfigModal onSave={async (type, config) => { await handleAddTrigger(type, config) }} onClose={() => setShowTriggerModal(false)} />
      )}

      {triggerTarget && (
        <ManualTriggerModal workflow={triggerTarget} onConfirm={handleTrigger} onClose={() => setTriggerTarget(null)} />
      )}
    </div>
  )
}
