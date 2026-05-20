'use client'

import React, { useState } from 'react'
import { X, Calendar, MousePointer, CheckSquare, AlertTriangle, Plus } from 'lucide-react'
import type { WorkflowTrigger } from '@/lib/types/workflows'

const TRIGGER_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  date_trigger: { label: 'Date trigger', icon: <Calendar size={14} />, color: 'text-[#2563EB] bg-[#EFF6FF]' },
  manual_trigger: { label: 'Manual trigger', icon: <MousePointer size={14} />, color: 'text-[#7C3AED] bg-[#F5F3FF]' },
  task_completed_trigger: { label: 'Task completed', icon: <CheckSquare size={14} />, color: 'text-[#16A34A] bg-[#DCFCE7]' },
  task_overdue_trigger: { label: 'Task overdue', icon: <AlertTriangle size={14} />, color: 'text-[#D97706] bg-[#FEF9C3]' },
}

function configSummary(trigger: WorkflowTrigger): string {
  const cfg = trigger.config as Record<string, unknown>
  switch (trigger.type) {
    case 'date_trigger':
      if (cfg.date) return `On ${cfg.date as string}`
      if (cfg.cron) return `Cron: ${cfg.cron as string}`
      return 'Date based'
    case 'manual_trigger':
      return 'Triggered manually by team members'
    case 'task_completed_trigger':
      if (cfg.task_id) return `Task ${(cfg.task_id as string).slice(0, 8)}... completes`
      if (cfg.category_id) return `Any task in category completes`
      return 'Task completion'
    case 'task_overdue_trigger':
      if (cfg.task_id) return `Task ${(cfg.task_id as string).slice(0, 8)}... goes overdue`
      if (cfg.category_id) return `Any task in category goes overdue`
      return 'Task overdue'
    default:
      return trigger.type.replace(/_/g, ' ')
  }
}

interface TriggerConfigModalProps {
  onSave: (type: string, config: Record<string, unknown>) => void
  onClose: () => void
}

export function TriggerConfigModal({ onSave, onClose }: TriggerConfigModalProps) {
  const [type, setType] = useState('manual_trigger')
  const [dateValue, setDateValue] = useState('')
  const [taskId, setTaskId] = useState('')
  const [loading, setLoading] = useState(false)

  function buildConfig(): Record<string, unknown> {
    switch (type) {
      case 'date_trigger': return { date: dateValue }
      case 'task_completed_trigger': return taskId ? { task_id: taskId } : {}
      case 'task_overdue_trigger': return taskId ? { task_id: taskId } : {}
      default: return {}
    }
  }

  async function handleSave() {
    setLoading(true)
    try {
      await onSave(type, buildConfig())
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-[16px] shadow-[0_24px_64px_rgba(0,0,0,0.15)] w-full max-w-md">
        <div className="flex items-center gap-3 p-5 border-b border-[#F1F5F9]">
          <h2 className="flex-1 text-[15px] font-semibold text-[#0F172A]">Add Trigger</h2>
          <button type="button" onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-[6px] text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F1F5F9]">
            <X size={16} />
          </button>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Trigger type</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className="w-full px-3 py-2.5 border border-[#CBD5E1] rounded-[8px] text-sm text-[#0F172A] focus:border-[#2563EB] focus:outline-none bg-white">
              {Object.entries(TRIGGER_META).map(([key, meta]) => (
                <option key={key} value={key}>{meta.label}</option>
              ))}
            </select>
          </div>

          {type === 'date_trigger' && (
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Date</label>
              <input type="date" value={dateValue} onChange={(e) => setDateValue(e.target.value)} className="w-full px-3 py-2.5 border border-[#CBD5E1] rounded-[8px] text-sm text-[#0F172A] focus:border-[#2563EB] focus:outline-none bg-white" />
            </div>
          )}

          {(type === 'task_completed_trigger' || type === 'task_overdue_trigger') && (
            <div>
              <label className="block text-sm font-medium text-[#374151] mb-1.5">Task ID (optional)</label>
              <input type="text" value={taskId} onChange={(e) => setTaskId(e.target.value)} placeholder="Leave blank to match any task" className="w-full px-3 py-2.5 border border-[#CBD5E1] rounded-[8px] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#2563EB] focus:outline-none bg-white" />
            </div>
          )}

          <div className="flex gap-2.5 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-[8px] text-sm font-semibold text-[#2563EB] border-2 border-[#2563EB] hover:bg-[#EFF6FF] transition-colors">Cancel</button>
            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              className="flex-1 py-2.5 rounded-[8px] text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:bg-[#E2E8F0] disabled:text-[#94A3B8] transition-colors"
            >
              {loading ? 'Adding...' : 'Add Trigger'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

interface Props {
  trigger: WorkflowTrigger
  onDelete: () => void
}

export default function TriggerCard({ trigger, onDelete }: Props) {
  const meta = TRIGGER_META[trigger.type] ?? { label: trigger.type, icon: <Calendar size={14} />, color: 'text-[#475569] bg-[#F1F5F9]' }

  return (
    <div className="flex items-start gap-3 p-3.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[10px]">
      <div className={`w-8 h-8 rounded-[8px] flex items-center justify-center shrink-0 ${meta.color}`}>
        {meta.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#0F172A]">{meta.label}</p>
        <p className="text-xs text-[#475569] mt-0.5">{configSummary(trigger)}</p>
      </div>
      <button
        type="button"
        onClick={onDelete}
        className="w-6 h-6 flex items-center justify-center text-[#94A3B8] hover:text-[#DC2626] transition-colors shrink-0"
      >
        <X size={13} />
      </button>
    </div>
  )
}
