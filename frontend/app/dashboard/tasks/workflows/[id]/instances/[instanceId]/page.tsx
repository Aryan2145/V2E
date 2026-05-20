'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, XCircle, RefreshCw, GitBranch, CheckCircle2, AlertTriangle, Clock } from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import { workflowsApi } from '@/lib/api/workflows'
import type { WorkflowInstance, WorkflowInstanceStep, WorkflowStep, WorkflowInstanceStatus } from '@/lib/types/workflows'
import TrainTimeline from '@/components/workflows/TrainTimeline'
import StepDetailDrawer from '@/components/workflows/StepDetailDrawer'

const STATUS_STYLES: Record<WorkflowInstanceStatus, string> = {
  running: 'bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE]',
  completed: 'bg-[#DCFCE7] text-[#16A34A] border-[#BBF7D0]',
  stuck: 'bg-[#FEE2E2] text-[#DC2626] border-[#FECACA]',
  cancelled: 'bg-[#F8FAFC] text-[#94A3B8] border-[#E2E8F0]',
}

const STATUS_ICONS: Record<WorkflowInstanceStatus, React.ReactNode> = {
  running: <Clock size={13} />,
  completed: <CheckCircle2 size={13} />,
  stuck: <AlertTriangle size={13} />,
  cancelled: <XCircle size={13} />,
}

export default function InstanceDetailPage() {
  const { id: templateId, instanceId } = useParams<{ id: string; instanceId: string }>()
  const { user } = useAuth()
  const router = useRouter()
  const orgId = user?.organizationId ?? ''

  const [instance, setInstance] = useState<WorkflowInstance | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedStep, setSelectedStep] = useState<WorkflowInstanceStep | null>(null)
  const [selectedTemplateStep, setSelectedTemplateStep] = useState<WorkflowStep | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const load = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    try {
      const data = await workflowsApi.getInstance(orgId, templateId, instanceId)
      setInstance(data)
    } catch {
      setInstance(null)
    } finally {
      setLoading(false)
    }
  }, [orgId, templateId, instanceId])

  useEffect(() => { load() }, [load])

  function handleStepClick(step: WorkflowInstanceStep, templateStep: WorkflowStep) {
    setSelectedStep(step)
    setSelectedTemplateStep(templateStep)
    setDrawerOpen(true)
  }

  async function handleCancel() {
    if (!confirm('Cancel this workflow instance? This cannot be undone.')) return
    await workflowsApi.cancelInstance(orgId, instanceId)
    load()
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6 animate-pulse">
        <div className="h-8 w-64 bg-[#F1F5F9] rounded" />
        <div className="h-48 bg-[#F1F5F9] rounded-[12px]" />
        <div className="h-32 bg-[#F1F5F9] rounded-[12px]" />
      </div>
    )
  }

  if (!instance) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <GitBranch size={36} className="text-[#CBD5E1] mb-3" />
        <p className="text-[#0F172A] font-semibold">Instance not found</p>
        <button type="button" onClick={() => router.back()} className="mt-4 text-sm text-[#2563EB] hover:underline">Go back</button>
      </div>
    )
  }

  const instanceSteps = instance.steps ?? []
  const templateSteps = instance.template?.steps ?? []

  const completedCount = instanceSteps.filter((s) => s.status === 'completed').length
  const progress = instanceSteps.length > 0 ? Math.round((completedCount / instanceSteps.length) * 100) : 0

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start gap-3 flex-wrap">
        <button type="button" onClick={() => router.back()} className="w-8 h-8 flex items-center justify-center rounded-[8px] text-[#475569] hover:bg-[#F1F5F9] transition-colors shrink-0 mt-1">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-[22px] font-bold text-[#0F172A] truncate">{instance.name}</h1>
            <span className={`flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${STATUS_STYLES[instance.status]}`}>
              {STATUS_ICONS[instance.status]} {instance.status}
            </span>
          </div>
          {instance.template?.name && (
            <p className="text-sm text-[#475569] mt-0.5">
              Workflow: <span className="font-medium text-[#0F172A]">{instance.template.name}</span>
            </p>
          )}
          <p className="text-xs text-[#94A3B8] mt-0.5">
            Started {new Date(instance.started_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            {instance.completed_at && ` · Completed ${new Date(instance.completed_at).toLocaleString('en-US', { month: 'short', day: 'numeric' })}`}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button type="button" onClick={load} className="flex items-center gap-1.5 px-3 py-2 rounded-[7px] text-sm font-medium text-[#475569] bg-[#F8FAFC] border border-[#E2E8F0] hover:bg-[#F1F5F9] transition-colors">
            <RefreshCw size={14} />
          </button>
          {instance.status === 'running' && (
            <button type="button" onClick={handleCancel} className="flex items-center gap-1.5 px-3 py-2 rounded-[7px] text-sm font-semibold text-white bg-[#DC2626] hover:bg-[#B91C1C] transition-colors">
              <XCircle size={14} /> Cancel
            </button>
          )}
        </div>
      </div>

      {/* Progress */}
      <div className="bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-[#0F172A]">Progress</p>
          <span className="text-sm font-bold text-[#2563EB]">{progress}%</span>
        </div>
        <div className="h-2 bg-[#E2E8F0] rounded-full overflow-hidden mb-3">
          <div
            className={`h-full rounded-full transition-all ${instance.status === 'stuck' ? 'bg-[#DC2626]' : 'bg-[#2563EB]'}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-[#475569]">{completedCount} of {instanceSteps.length} steps completed</p>
      </div>

      {/* Stuck warning */}
      {instance.status === 'stuck' && (
        <div className="flex items-center gap-3 p-4 bg-[#FEE2E2] border border-[#FECACA] rounded-[10px]">
          <AlertTriangle size={18} className="text-[#DC2626] shrink-0" />
          <p className="text-sm font-medium text-[#DC2626]">
            This workflow is stuck. An overdue step is blocking progress. Owners have been notified.
          </p>
        </div>
      )}

      {/* Train timeline */}
      <div className="bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-5">
        <h2 className="text-[15px] font-semibold text-[#0F172A] mb-4">Step Timeline</h2>
        {instanceSteps.length > 0 ? (
          <TrainTimeline
            instanceSteps={instanceSteps}
            templateSteps={templateSteps}
            onStepClick={handleStepClick}
          />
        ) : (
          <p className="text-sm text-[#94A3B8] text-center py-6">No steps in this instance.</p>
        )}
      </div>

      {/* Step detail drawer */}
      <StepDetailDrawer
        instanceStep={selectedStep}
        templateStep={selectedTemplateStep}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  )
}
