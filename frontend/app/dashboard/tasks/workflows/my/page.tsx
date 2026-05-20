'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { GitBranch, AlertTriangle, CheckCircle2, Clock, RefreshCw } from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import { workflowsApi } from '@/lib/api/workflows'
import type { WorkflowTemplate, WorkflowInstance, WorkflowInstanceStatus } from '@/lib/types/workflows'
import WorkflowCard from '@/components/workflows/WorkflowCard'
import ManualTriggerModal from '@/components/workflows/ManualTriggerModal'

const INSTANCE_STATUS_STYLES: Record<WorkflowInstanceStatus, string> = {
  running: 'bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE]',
  completed: 'bg-[#DCFCE7] text-[#16A34A] border-[#BBF7D0]',
  stuck: 'bg-[#FEE2E2] text-[#DC2626] border-[#FECACA]',
  cancelled: 'bg-[#F8FAFC] text-[#94A3B8] border-[#E2E8F0]',
}

const INSTANCE_STATUS_ICONS: Record<WorkflowInstanceStatus, React.ReactNode> = {
  running: <Clock size={11} />,
  completed: <CheckCircle2 size={11} />,
  stuck: <AlertTriangle size={11} />,
  cancelled: <GitBranch size={11} />,
}

function InstanceRow({ instance, templateId, onNavigate }: { instance: WorkflowInstance; templateId: string; onNavigate: () => void }) {
  const stepCount = instance.steps?.length ?? 0
  const completedCount = instance.steps?.filter((s) => s.status === 'completed').length ?? 0
  const progress = stepCount > 0 ? Math.round((completedCount / stepCount) * 100) : 0

  return (
    <button
      type="button"
      onClick={onNavigate}
      className="w-full flex items-center gap-4 p-3.5 rounded-[10px] border border-[#E2E8F0] hover:border-[#2563EB] hover:bg-[#F8FAFF] transition-all text-left"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#0F172A] truncate">{instance.name}</p>
        <p className="text-xs text-[#475569] mt-0.5">
          Started {new Date(instance.started_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </p>
      </div>

      {/* Progress bar */}
      {stepCount > 0 && (
        <div className="shrink-0 w-28">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-medium text-[#475569]">{completedCount}/{stepCount} steps</span>
            <span className="text-[10px] font-semibold text-[#0F172A]">{progress}%</span>
          </div>
          <div className="h-1.5 bg-[#E2E8F0] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#2563EB] rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      <span className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full border ${INSTANCE_STATUS_STYLES[instance.status]}`}>
        {INSTANCE_STATUS_ICONS[instance.status]}
        {instance.status}
      </span>
    </button>
  )
}

export default function MyWorkflowsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const orgId = user?.organizationId ?? ''

  const [ownedWorkflows, setOwnedWorkflows] = useState<WorkflowTemplate[]>([])
  const [runningInstances, setRunningInstances] = useState<WorkflowInstance[]>([])
  const [loading, setLoading] = useState(true)
  const [triggerTarget, setTriggerTarget] = useState<WorkflowTemplate | null>(null)

  const load = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    try {
      const [wf, inst] = await Promise.all([
        workflowsApi.getOwnedWorkflows(orgId),
        workflowsApi.getOwnedInstances(orgId),
      ])
      setOwnedWorkflows(wf)
      setRunningInstances(inst)
    } catch {
      setOwnedWorkflows([])
      setRunningInstances([])
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => { load() }, [load])

  async function handleTrigger(name: string) {
    if (!triggerTarget) return
    const { id } = await workflowsApi.triggerInstance(orgId, triggerTarget.id, name)
    router.push(`/dashboard/tasks/workflows/${triggerTarget.id}/instances/${id}`)
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="h-8 w-48 bg-[#F1F5F9] rounded animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-36 bg-[#F1F5F9] rounded-[12px] animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-bold text-[#0F172A]">My Workflows</h1>
          <p className="text-sm text-[#475569] mt-0.5">Workflows you own and their running instances</p>
        </div>
        <button
          type="button"
          onClick={load}
          className="flex items-center gap-1.5 px-3 py-2 rounded-[7px] text-sm font-medium text-[#475569] bg-[#F8FAFC] border border-[#E2E8F0] hover:bg-[#F1F5F9] transition-colors"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Running instances */}
      {runningInstances.length > 0 && (
        <section>
          <h2 className="text-[15px] font-semibold text-[#0F172A] mb-3 flex items-center gap-2">
            <Clock size={16} className="text-[#2563EB]" />
            Running Instances
            <span className="text-[12px] font-medium text-[#64748B] bg-[#F1F5F9] px-2 py-0.5 rounded-full">
              {runningInstances.length}
            </span>
          </h2>
          <div className="flex flex-col gap-2">
            {runningInstances.map((inst) => (
              <InstanceRow
                key={inst.id}
                instance={inst}
                templateId={inst.workflow_template_id}
                onNavigate={() => router.push(`/dashboard/tasks/workflows/${inst.workflow_template_id}/instances/${inst.id}`)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Owned workflows */}
      <section>
        <h2 className="text-[15px] font-semibold text-[#0F172A] mb-3 flex items-center gap-2">
          <GitBranch size={16} className="text-[#2563EB]" />
          My Workflows
          <span className="text-[12px] font-medium text-[#64748B] bg-[#F1F5F9] px-2 py-0.5 rounded-full">
            {ownedWorkflows.length}
          </span>
        </h2>

        {ownedWorkflows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-[#E2E8F0] rounded-[12px]">
            <GitBranch size={28} className="text-[#CBD5E1] mb-3" />
            <p className="text-sm font-medium text-[#0F172A]">No owned workflows</p>
            <p className="text-xs text-[#475569] mt-1">You will appear here as an owner when workflows are created with you.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {ownedWorkflows.map((w) => (
              <WorkflowCard
                key={w.id}
                workflow={w}
                canEdit
                onEdit={() => router.push(`/dashboard/tasks/workflows/${w.id}`)}
                onTrigger={() => setTriggerTarget(w)}
              />
            ))}
          </div>
        )}
      </section>

      {triggerTarget && (
        <ManualTriggerModal
          workflow={triggerTarget}
          onConfirm={handleTrigger}
          onClose={() => setTriggerTarget(null)}
        />
      )}
    </div>
  )
}
