'use client'

import React, { useState } from 'react'
import { CheckCircle2, AlertCircle, Clock, Circle, GitBranch } from 'lucide-react'
import type { WorkflowInstanceStep, WorkflowStep, WorkflowStepStatus } from '@/lib/types/workflows'

const STATUS_COLORS: Record<WorkflowStepStatus, string> = {
  completed: '#16A34A',
  active: '#2563EB',
  overdue: '#DC2626',
  pending: '#CBD5E1',
  skipped: '#94A3B8',
  branched: '#D97706',
}

const STATUS_BG: Record<WorkflowStepStatus, string> = {
  completed: 'bg-[#16A34A]',
  active: 'bg-[#2563EB]',
  overdue: 'bg-[#DC2626]',
  pending: 'bg-[#F1F5F9]',
  skipped: 'bg-[#94A3B8]',
  branched: 'bg-[#D97706]',
}

const STATUS_RING: Record<WorkflowStepStatus, string> = {
  active: 'ring-4 ring-[#BFDBFE]',
  completed: '',
  overdue: 'ring-4 ring-[#FECACA]',
  pending: '',
  skipped: '',
  branched: 'ring-4 ring-[#FDE68A]',
}

function StationIcon({ status }: { status: WorkflowStepStatus }) {
  const cls = 'w-3 h-3 text-white'
  if (status === 'completed') return <CheckCircle2 className={cls} />
  if (status === 'overdue') return <AlertCircle className={cls} />
  if (status === 'active') return <Circle className={cls} strokeWidth={3} />
  if (status === 'branched') return <GitBranch className={cls} />
  return <Clock className="w-3 h-3 text-[#94A3B8]" />
}

interface StationData {
  instanceStep: WorkflowInstanceStep
  templateStep: WorkflowStep
}

interface Props {
  instanceSteps: WorkflowInstanceStep[]
  templateSteps: WorkflowStep[]
  onStepClick?: (step: WorkflowInstanceStep, templateStep: WorkflowStep) => void
}

export default function TrainTimeline({ instanceSteps, templateSteps, onStepClick }: Props) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const stations: StationData[] = instanceSteps.map((is) => ({
    instanceStep: is,
    templateStep: templateSteps.find((ts) => ts.id === is.workflow_step_id) ?? templateSteps[0],
  }))

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex items-center min-w-max px-6 py-8 relative">
        {/* Animated train dot on active station */}
        {stations.map(({ instanceStep }, i) => {
          if (instanceStep.status !== 'active') return null
          return (
            <div
              key={`train-${instanceStep.id}`}
              className="absolute -top-1 w-3 h-3 bg-[#2563EB] rounded-full animate-bounce"
              style={{ left: `calc(${(i / (stations.length - 1 || 1)) * 80}% + 10%)` }}
            />
          )
        })}

        {stations.map(({ instanceStep, templateStep }, i) => {
          const status = instanceStep.status
          const isLast = i === stations.length - 1
          const isHovered = hoveredId === instanceStep.id

          return (
            <React.Fragment key={instanceStep.id}>
              {/* Station */}
              <div className="flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={() => onStepClick?.(instanceStep, templateStep)}
                  onMouseEnter={() => setHoveredId(instanceStep.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${STATUS_BG[status]} ${STATUS_RING[status]} ${
                    status === 'active' ? 'animate-pulse' : ''
                  } ${status === 'pending' ? 'border-2 border-[#CBD5E1]' : ''}`}
                >
                  <StationIcon status={status} />
                </button>

                {/* Step label */}
                <div className="flex flex-col items-center gap-0.5 max-w-[90px]">
                  <p className="text-[11px] font-semibold text-[#0F172A] text-center leading-tight line-clamp-2">
                    {templateStep?.title ?? `Step ${i + 1}`}
                  </p>
                  <p className="text-[10px] text-[#94A3B8] capitalize">{status}</p>
                  {instanceStep.scheduled_at && (
                    <p className="text-[10px] text-[#64748B]">
                      {new Date(instanceStep.scheduled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                  )}
                </div>

                {/* Tooltip */}
                {isHovered && (
                  <div className="absolute bottom-full mb-2 bg-[#0F172A] text-white text-[11px] rounded-[8px] px-3 py-2 shadow-lg whitespace-nowrap z-10">
                    <p className="font-semibold">{templateStep?.title}</p>
                    <p className="text-[#94A3B8]">{status}</p>
                    {instanceStep.scheduled_at && (
                      <p className="text-[#94A3B8]">Due: {new Date(instanceStep.scheduled_at).toLocaleString()}</p>
                    )}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-[#0F172A]" />
                  </div>
                )}
              </div>

              {/* Connector line */}
              {!isLast && (
                <div
                  className="w-16 h-0.5 shrink-0"
                  style={{
                    backgroundColor: status === 'completed'
                      ? STATUS_COLORS.completed
                      : status === 'overdue'
                      ? STATUS_COLORS.overdue
                      : STATUS_COLORS.pending,
                  }}
                />
              )}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}
