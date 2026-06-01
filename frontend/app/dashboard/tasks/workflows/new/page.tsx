'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Save, Send, GitBranch } from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import { workflowsApi } from '@/lib/api/workflows'
import type { WorkflowStep, WorkflowNature, WorkflowRecurringType } from '@/lib/types/workflows'
import StepEditor from '@/components/workflows/StepEditor'
import TriggerCard, { TriggerConfigModal } from '@/components/workflows/TriggerCard'

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

export default function NewWorkflowPage() {
  const { user } = useAuth()
  const router = useRouter()
  const orgId = user?.organizationId ?? ''

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [nature, setNature] = useState<WorkflowNature>('one_time')
  const [recurringType, setRecurringType] = useState<WorkflowRecurringType>('daily')
  const [showOnCard, setShowOnCard] = useState(true)
  const [tab, setTab] = useState<BuilderTab>('steps')

  const [steps, setSteps] = useState<Partial<WorkflowStep>[]>([])
  const [triggers, setTriggers] = useState<{ type: string; config: Record<string, unknown> }[]>([])

  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState('')
  const [showTriggerModal, setShowTriggerModal] = useState(false)

  function addStep() {
    setSteps((s) => [
      ...s,
      {
        title: '',
        assignee_type: 'fixed_person',
        assigner_user_id: '',
        if_overdue_action: 'block_next',
        proof_required: false,
        checklist_items: [],
        deadline_config: { type: 'x_days_after_start', days: 1, time: '09:00' } as never,
        order_index: s.length,
      },
    ])
  }

  function updateStep(idx: number, updated: Partial<WorkflowStep>) {
    setSteps((s) => s.map((st, i) => i === idx ? { ...st, ...updated } : st))
  }

  function deleteStep(idx: number) {
    setSteps((s) => s.filter((_, i) => i !== idx).map((st, i) => ({ ...st, order_index: i })))
  }

  function moveStep(idx: number, dir: -1 | 1) {
    setSteps((s) => {
      const next = [...s]
      const target = idx + dir
      if (target < 0 || target >= next.length) return s
      ;[next[idx], next[target]] = [next[target], next[idx]]
      return next.map((st, i) => ({ ...st, order_index: i }))
    })
  }

  async function handleSave() {
    if (!name.trim()) { setError('Workflow name is required'); return }
    setSaving(true)
    setError('')
    try {
      const template = await workflowsApi.createWorkflow(orgId, {
        name: name.trim(),
        description: description.trim() || undefined,
        workflow_nature: nature,
        recurring_type: nature === 'recurring' ? recurringType : undefined,
        show_workflow_on_task_card: showOnCard,
      })

      // Add steps
      for (const step of steps) {
        if (!step.title?.trim()) continue
        await workflowsApi.addStep(orgId, template.id, step)
      }

      // Add triggers
      for (const trigger of triggers) {
        await workflowsApi.addTrigger(orgId, template.id, trigger)
      }

      router.push(`/dashboard/tasks/workflows/${template.id}`)
    } catch {
      setError('Failed to save workflow. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveAndPublish() {
    if (!name.trim()) { setError('Workflow name is required'); return }
    if (steps.filter((s) => s.title?.trim()).length === 0) { setError('Add at least one step before publishing'); return }
    if (triggers.length === 0) { setError('Add at least one trigger before publishing'); return }
    setPublishing(true)
    setError('')
    try {
      const template = await workflowsApi.createWorkflow(orgId, {
        name: name.trim(),
        description: description.trim() || undefined,
        workflow_nature: nature,
        recurring_type: nature === 'recurring' ? recurringType : undefined,
        show_workflow_on_task_card: showOnCard,
      })
      for (const step of steps) {
        if (!step.title?.trim()) continue
        await workflowsApi.addStep(orgId, template.id, step)
      }
      for (const trigger of triggers) {
        await workflowsApi.addTrigger(orgId, template.id, trigger)
      }
      await workflowsApi.publishWorkflow(orgId, template.id)
      router.push(`/dashboard/tasks/workflows`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      setError(msg || 'Failed to publish workflow.')
    } finally {
      setPublishing(false)
    }
  }

  function addTrigger(type: string, config: Record<string, unknown>) {
    setTriggers((t) => [...t, { type, config }])
  }

  function removeTrigger(idx: number) {
    setTriggers((t) => t.filter((_, i) => i !== idx))
  }

  const inputCls = 'w-full px-3 py-2.5 border border-[#CBD5E1] rounded-[8px] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#2563EB] focus:outline-none bg-white'

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => router.back()} className="w-8 h-8 flex items-center justify-center rounded-[8px] text-[#475569] hover:bg-[#F1F5F9] transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-[22px] font-bold text-[#0F172A]">New Workflow</h1>
          <p className="text-sm text-[#475569]">Build a sequential task automation</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-[8px] text-sm font-semibold text-[#2563EB] border-2 border-[#2563EB] hover:bg-[#EFF6FF] disabled:border-[#E2E8F0] disabled:text-[#94A3B8] transition-colors"
          >
            <Save size={14} /> {saving ? 'Saving...' : 'Save Draft'}
          </button>
          <button
            type="button"
            onClick={handleSaveAndPublish}
            disabled={publishing || !name.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-[8px] text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:bg-[#E2E8F0] disabled:text-[#94A3B8] transition-colors"
          >
            <Send size={14} /> {publishing ? 'Publishing...' : 'Publish'}
          </button>
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 bg-[#FEE2E2] border border-[#FECACA] rounded-[8px] text-sm text-[#DC2626]">
          {error}
        </div>
      )}

      {/* Metadata */}
      <div className="bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-5 flex flex-col gap-4">
        <div className="flex items-center gap-2 mb-1">
          <GitBranch size={16} className="text-[#2563EB]" />
          <h2 className="text-[15px] font-semibold text-[#0F172A]">Workflow Settings</h2>
        </div>

        <div>
          <label className="block text-sm font-medium text-[#374151] mb-1.5">Name <span className="text-[#DC2626]">*</span></label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Employee Onboarding" className={inputCls} />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#374151] mb-1.5">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does this workflow do?" rows={2} className={`${inputCls} resize-none`} />
        </div>

        {/* Nature */}
        <div>
          <label className="block text-sm font-medium text-[#374151] mb-1.5">Type</label>
          <div className="flex gap-2">
            {NATURE_TABS.map((n) => (
              <button
                key={n.value}
                type="button"
                onClick={() => setNature(n.value)}
                className={`flex-1 py-2 rounded-[7px] text-sm font-medium border transition-colors ${
                  nature === n.value ? 'bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE]' : 'bg-white text-[#475569] border-[#E2E8F0] hover:bg-[#F8FAFC]'
                }`}
              >
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
                <button
                  key={rt.value}
                  type="button"
                  onClick={() => setRecurringType(rt.value)}
                  className={`flex-1 py-1.5 rounded-[6px] text-xs font-semibold border transition-colors ${
                    recurringType === rt.value ? 'bg-[#2563EB] text-white border-[#2563EB]' : 'bg-white text-[#475569] border-[#E2E8F0] hover:bg-[#F8FAFC]'
                  }`}
                >
                  {rt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Show on task card */}
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={showOnCard}
            onChange={(e) => setShowOnCard(e.target.checked)}
            className="w-4 h-4 rounded border-[#CBD5E1] text-[#2563EB] focus:ring-[#2563EB]"
          />
          <span className="text-sm text-[#374151]">Show workflow badge on task cards</span>
        </label>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#E2E8F0]">
        {(['steps', 'triggers'] as BuilderTab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-sm font-semibold capitalize border-b-2 transition-colors ${
              tab === t ? 'border-[#2563EB] text-[#2563EB]' : 'border-transparent text-[#475569] hover:text-[#0F172A]'
            }`}
          >
            {t}
            {t === 'steps' && <span className="ml-1.5 text-xs bg-[#F1F5F9] text-[#475569] px-1.5 py-0.5 rounded-full">{steps.length}</span>}
            {t === 'triggers' && <span className="ml-1.5 text-xs bg-[#F1F5F9] text-[#475569] px-1.5 py-0.5 rounded-full">{triggers.length}</span>}
          </button>
        ))}
      </div>

      {/* Steps tab */}
      {tab === 'steps' && (
        <div className="flex flex-col gap-3">
          {steps.map((step, idx) => (
            <StepEditor
              key={idx}
              step={step}
              index={idx}
              isFirst={idx === 0}
              isLast={idx === steps.length - 1}
              nature={nature}
              orgId={orgId}
              onSave={(updated) => updateStep(idx, updated)}
              onDelete={() => deleteStep(idx)}
              onMoveUp={() => moveStep(idx, -1)}
              onMoveDown={() => moveStep(idx, 1)}
            />
          ))}
          <button
            type="button"
            onClick={addStep}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-[10px] border-2 border-dashed border-[#CBD5E1] text-sm font-medium text-[#475569] hover:border-[#2563EB] hover:text-[#2563EB] hover:bg-[#F8FAFF] transition-all"
          >
            <Plus size={16} /> Add Step
          </button>
        </div>
      )}

      {/* Triggers tab */}
      {tab === 'triggers' && (
        <div className="flex flex-col gap-3">
          {triggers.map((trigger, idx) => (
            <TriggerCard
              key={idx}
              trigger={{ ...trigger, id: String(idx), organization_id: orgId, workflow_template_id: '', is_active: true, created_at: '', updated_at: '' }}
              onDelete={() => removeTrigger(idx)}
            />
          ))}
          <button
            type="button"
            onClick={() => setShowTriggerModal(true)}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-[10px] border-2 border-dashed border-[#CBD5E1] text-sm font-medium text-[#475569] hover:border-[#2563EB] hover:text-[#2563EB] hover:bg-[#F8FAFF] transition-all"
          >
            <Plus size={16} /> Add Trigger
          </button>
        </div>
      )}

      {showTriggerModal && (
        <TriggerConfigModal
          onSave={async (type, config) => { addTrigger(type, config) }}
          onClose={() => setShowTriggerModal(false)}
        />
      )}
    </div>
  )
}
