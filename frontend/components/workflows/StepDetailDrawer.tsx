'use client'

import React from 'react'
import { X, ExternalLink, Clock, CheckCircle2, AlertCircle, Circle } from 'lucide-react'
import type { WorkflowInstanceStep, WorkflowStep, WorkflowStepStatus } from '@/lib/types/workflows'

const STATUS_BADGE: Record<WorkflowStepStatus, string> = {
  completed: 'bg-[#DCFCE7] text-[#16A34A] border-[#BBF7D0]',
  active: 'bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE]',
  overdue: 'bg-[#FEE2E2] text-[#DC2626] border-[#FECACA]',
  pending: 'bg-[#F8FAFC] text-[#475569] border-[#E2E8F0]',
  skipped: 'bg-[#F8FAFC] text-[#94A3B8] border-[#E2E8F0]',
  branched: 'bg-[#FEF9C3] text-[#D97706] border-[#FDE68A]',
}

interface Props {
  instanceStep: WorkflowInstanceStep | null
  templateStep: WorkflowStep | null
  open: boolean
  onClose: () => void
  orgSlug?: string
}

function timeRemaining(dateStr: string): string {
  const diff = new Date(dateStr).getTime() - Date.now()
  if (diff < 0) {
    const abs = Math.abs(diff)
    const days = Math.floor(abs / 86400000)
    if (days > 0) return `${days}d overdue`
    const hrs = Math.floor(abs / 3600000)
    if (hrs > 0) return `${hrs}h overdue`
    return 'Just overdue'
  }
  const days = Math.floor(diff / 86400000)
  if (days > 0) return `${days}d remaining`
  const hrs = Math.floor(diff / 3600000)
  if (hrs > 0) return `${hrs}h remaining`
  return 'Due soon'
}

export default function StepDetailDrawer({ instanceStep, templateStep, open, onClose, orgSlug }: Props) {
  return (
    <div
      className={`fixed inset-y-0 right-0 z-40 w-full max-w-sm bg-white border-l border-[#E2E8F0] shadow-[−8px_0_32px_rgba(0,0,0,0.08)] flex flex-col transition-transform duration-300 ease-in-out ${
        open ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      {/* Overlay for mobile */}
      {open && <div className="fixed inset-0 bg-black/20 z-[-1] md:hidden" onClick={onClose} />}

      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-[#F1F5F9] shrink-0">
        <div className="flex-1">
          <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-widest">Step Detail</p>
          <h3 className="text-[15px] font-semibold text-[#0F172A] leading-tight">{templateStep?.title ?? '—'}</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-[6px] text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Body */}
      {instanceStep && templateStep ? (
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
          {/* Status */}
          <div>
            <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wide mb-2">Status</p>
            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${STATUS_BADGE[instanceStep.status]}`}>
              {instanceStep.status === 'completed' && <CheckCircle2 size={11} />}
              {instanceStep.status === 'overdue' && <AlertCircle size={11} />}
              {instanceStep.status === 'active' && <Circle size={11} strokeWidth={3} />}
              {instanceStep.status}
            </span>
          </div>

          {/* Deadline */}
          {instanceStep.scheduled_at && (
            <div>
              <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wide mb-2">Deadline</p>
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-[#94A3B8]" />
                <span className="text-sm text-[#0F172A]">
                  {new Date(instanceStep.scheduled_at).toLocaleString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
                  })}
                </span>
                <span className={`text-xs font-medium ${instanceStep.status === 'overdue' ? 'text-[#DC2626]' : 'text-[#475569]'}`}>
                  ({timeRemaining(instanceStep.scheduled_at)})
                </span>
              </div>
            </div>
          )}

          {/* Assignee */}
          <div>
            <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wide mb-2">Assigned to</p>
            <p className="text-sm text-[#0F172A]">{instanceStep.assigned_to_user_id}</p>
          </div>

          {/* Description */}
          {templateStep.description && (
            <div>
              <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wide mb-2">Description</p>
              <p className="text-sm text-[#475569] whitespace-pre-line">{templateStep.description}</p>
            </div>
          )}

          {/* Overdue action */}
          <div>
            <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wide mb-2">If overdue</p>
            <p className="text-sm text-[#475569] capitalize">{templateStep.if_overdue_action.replace(/_/g, ' ')}</p>
          </div>

          {/* Proof */}
          {templateStep.proof_required && (
            <div className="flex items-center gap-2 p-3 bg-[#FEF9C3] border border-[#FDE68A] rounded-[8px]">
              <CheckCircle2 size={14} className="text-[#D97706]" />
              <p className="text-sm font-medium text-[#D97706]">Proof of completion required</p>
            </div>
          )}

          {/* Link to task */}
          {instanceStep.task_id && (
            <div>
              <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wide mb-2">Task</p>
              <a
                href={orgSlug ? `/dashboard/tasks/${instanceStep.task_id}` : '#'}
                className="flex items-center gap-1.5 text-sm font-medium text-[#2563EB] hover:underline"
              >
                <ExternalLink size={13} /> View Task
              </a>
            </div>
          )}

          {/* Completion time */}
          {instanceStep.completed_at && (
            <div>
              <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wide mb-2">Completed at</p>
              <p className="text-sm text-[#475569]">
                {new Date(instanceStep.completed_at).toLocaleString('en-US', {
                  month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
                })}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-[#94A3B8]">Select a step to view details</p>
        </div>
      )}
    </div>
  )
}
