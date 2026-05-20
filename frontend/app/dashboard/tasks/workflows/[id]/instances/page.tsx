'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, GitBranch, CheckCircle2, AlertTriangle, Clock, XCircle, Play } from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import { workflowsApi } from '@/lib/api/workflows'
import type { WorkflowInstance, WorkflowInstanceStatus, WorkflowTemplate } from '@/lib/types/workflows'
import ManualTriggerModal from '@/components/workflows/ManualTriggerModal'

const STATUS_STYLES: Record<WorkflowInstanceStatus, string> = {
  running: 'bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE]',
  completed: 'bg-[#DCFCE7] text-[#16A34A] border-[#BBF7D0]',
  stuck: 'bg-[#FEE2E2] text-[#DC2626] border-[#FECACA]',
  cancelled: 'bg-[#F8FAFC] text-[#94A3B8] border-[#E2E8F0]',
}

const STATUS_ICONS: Record<WorkflowInstanceStatus, React.ReactNode> = {
  running: <Clock size={11} />,
  completed: <CheckCircle2 size={11} />,
  stuck: <AlertTriangle size={11} />,
  cancelled: <XCircle size={11} />,
}

export default function InstancesListPage() {
  const { id: templateId } = useParams<{ id: string }>()
  const { user } = useAuth()
  const router = useRouter()
  const orgId = user?.organizationId ?? ''

  const [instances, setInstances] = useState<WorkflowInstance[]>([])
  const [workflow, setWorkflow] = useState<WorkflowTemplate | null>(null)
  const [loading, setLoading] = useState(true)
  const [triggerTarget, setTriggerTarget] = useState<WorkflowTemplate | null>(null)

  const load = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    try {
      const [wf, inst] = await Promise.all([
        workflowsApi.getWorkflow(orgId, templateId),
        workflowsApi.listInstances(orgId, templateId),
      ])
      setWorkflow(wf)
      setInstances(inst)
    } catch {
      setInstances([])
    } finally {
      setLoading(false)
    }
  }, [orgId, templateId])

  useEffect(() => { load() }, [load])

  async function handleTrigger(name: string) {
    const { id } = await workflowsApi.triggerInstance(orgId, templateId, name)
    router.push(`/dashboard/tasks/workflows/${templateId}/instances/${id}`)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => router.back()} className="w-8 h-8 flex items-center justify-center rounded-[8px] text-[#475569] hover:bg-[#F1F5F9] transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-[22px] font-bold text-[#0F172A]">{workflow?.name ?? 'Instances'}</h1>
          <p className="text-sm text-[#475569] mt-0.5">All workflow runs</p>
        </div>
        {workflow?.status === 'active' && (
          <button type="button" onClick={() => setTriggerTarget(workflow)} className="flex items-center gap-1.5 px-3 py-2 rounded-[7px] text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8]">
            <Play size={14} /> Trigger
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-[#F1F5F9] rounded-[10px] animate-pulse" />)}
        </div>
      ) : instances.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border border-dashed border-[#E2E8F0] rounded-[12px]">
          <GitBranch size={28} className="text-[#CBD5E1] mb-3" />
          <p className="text-sm font-medium text-[#0F172A]">No instances yet</p>
          <p className="text-xs text-[#475569] mt-1">Trigger the workflow to create the first instance.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {instances.map((inst) => {
            const stepCount = inst.steps?.length ?? 0
            const completedCount = inst.steps?.filter((s) => s.status === 'completed').length ?? 0
            const progress = stepCount > 0 ? Math.round((completedCount / stepCount) * 100) : 0

            return (
              <button
                key={inst.id}
                type="button"
                onClick={() => router.push(`/dashboard/tasks/workflows/${templateId}/instances/${inst.id}`)}
                className="w-full flex items-center gap-4 p-4 bg-white border border-[#E2E8F0] rounded-[10px] hover:border-[#2563EB] hover:shadow-sm transition-all text-left"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#0F172A] truncate">{inst.name}</p>
                  <p className="text-xs text-[#475569] mt-0.5">
                    {new Date(inst.started_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    {' · '}{inst.trigger_type.replace(/_/g, ' ')}
                  </p>
                </div>
                {stepCount > 0 && (
                  <div className="shrink-0 w-24 hidden sm:block">
                    <div className="h-1.5 bg-[#E2E8F0] rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${inst.status === 'stuck' ? 'bg-[#DC2626]' : 'bg-[#2563EB]'}`} style={{ width: `${progress}%` }} />
                    </div>
                    <p className="text-[10px] text-[#94A3B8] mt-0.5 text-right">{progress}%</p>
                  </div>
                )}
                <span className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full border shrink-0 ${STATUS_STYLES[inst.status]}`}>
                  {STATUS_ICONS[inst.status]} {inst.status}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {triggerTarget && (
        <ManualTriggerModal workflow={triggerTarget} onConfirm={handleTrigger} onClose={() => setTriggerTarget(null)} />
      )}
    </div>
  )
}
