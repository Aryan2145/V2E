'use client'

import React, { useState } from 'react'
import { X, Play, GitBranch } from 'lucide-react'
import type { WorkflowTemplate } from '@/lib/types/workflows'

interface Props {
  workflow: WorkflowTemplate
  onConfirm: (name: string) => Promise<void>
  onClose: () => void
}

export default function ManualTriggerModal({ workflow, onConfirm, onClose }: Props) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Instance name is required'); return }
    setLoading(true)
    setError('')
    try {
      await onConfirm(name.trim())
      onClose()
    } catch {
      setError('Failed to trigger workflow. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const stepCount = workflow.steps?.length ?? 0

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-t-[16px] sm:rounded-[16px] shadow-[0_24px_64px_rgba(0,0,0,0.15)] w-full max-w-md max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 p-5 border-b border-[#F1F5F9]">
          <div className="w-9 h-9 rounded-[10px] bg-[#EFF6FF] flex items-center justify-center">
            <GitBranch size={18} className="text-[#2563EB]" />
          </div>
          <div className="flex-1">
            <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-widest">Trigger Workflow</p>
            <h2 className="text-[15px] font-semibold text-[#0F172A]">{workflow.name}</h2>
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
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4 overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">
              Instance name <span className="text-[#DC2626]">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Onboarding — John Smith"
              className="w-full px-3 py-2.5 border border-[#CBD5E1] rounded-[8px] text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[#2563EB] bg-white text-base"
              autoFocus
            />
            {error && <p className="mt-1 text-sm text-[#DC2626]">{error}</p>}
          </div>

          {/* Preview */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[10px] p-3.5">
            <p className="text-sm text-[#475569]">
              This will create{' '}
              <span className="font-semibold text-[#0F172A]">{stepCount} task{stepCount !== 1 ? 's' : ''}</span>{' '}
              and start the workflow immediately.
            </p>
          </div>

          {/* Footer */}
          <div className="flex flex-col-reverse sm:flex-row gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:flex-1 py-2.5 rounded-[8px] text-sm font-semibold text-[#2563EB] border-2 border-[#2563EB] hover:bg-[#EFF6FF] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="w-full sm:flex-1 py-2.5 rounded-[8px] text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:bg-[#E2E8F0] disabled:text-[#94A3B8] transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Play size={14} /> Start Workflow
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
