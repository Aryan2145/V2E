'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, GitBranch, Search } from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import { workflowsApi } from '@/lib/api/workflows'
import type { WorkflowTemplate } from '@/lib/types/workflows'
import WorkflowCard from '@/components/workflows/WorkflowCard'
import ManualTriggerModal from '@/components/workflows/ManualTriggerModal'

function SkeletonCard() {
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-5 animate-pulse">
      <div className="flex gap-3 mb-4">
        <div className="w-10 h-10 rounded-[10px] bg-[#F1F5F9]" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-[#F1F5F9] rounded w-2/3" />
          <div className="h-3 bg-[#F1F5F9] rounded w-1/2" />
        </div>
      </div>
      <div className="h-3 bg-[#F1F5F9] rounded w-1/3 mb-2" />
      <div className="h-8 bg-[#F1F5F9] rounded" />
    </div>
  )
}

export default function WorkflowsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const orgId = user?.organizationId ?? ''

  const [workflows, setWorkflows] = useState<WorkflowTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [triggerTarget, setTriggerTarget] = useState<WorkflowTemplate | null>(null)

  const isAdminOrHR = !!user?.is_admin

  const load = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    try {
      const data = await workflowsApi.listWorkflows(orgId)
      setWorkflows(data)
    } catch {
      setWorkflows([])
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => { load() }, [load])

  const filtered = workflows.filter((w) =>
    !search || w.name.toLowerCase().includes(search.toLowerCase()) || w.description?.toLowerCase().includes(search.toLowerCase())
  )

  async function handleTrigger(name: string) {
    if (!triggerTarget) return
    const { id } = await workflowsApi.triggerInstance(orgId, triggerTarget.id, name)
    router.push(`/dashboard/tasks/workflows/${triggerTarget.id}/instances/${id}`)
  }

  async function handleArchive(workflow: WorkflowTemplate) {
    if (!confirm(`Archive "${workflow.name}"?`)) return
    await workflowsApi.archiveWorkflow(orgId, workflow.id)
    load()
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[28px] font-bold text-[#0F172A]">Workflows</h1>
          <p className="text-sm text-[#475569] mt-0.5">Automate sequential task chains across your team</p>
        </div>
        {isAdminOrHR && (
          <button
            type="button"
            onClick={() => router.push('/dashboard/tasks/workflows/new')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-[8px] text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] transition-colors"
          >
            <Plus size={16} /> New Workflow
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search workflows..."
          className="w-full pl-9 pr-3 py-2.5 border border-[#CBD5E1] rounded-[8px] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#2563EB] focus:outline-none bg-white"
        />
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-[#EFF6FF] flex items-center justify-center mb-4">
            <GitBranch size={28} className="text-[#2563EB]" />
          </div>
          <h2 className="text-[18px] font-semibold text-[#0F172A] mb-1">
            {search ? 'No workflows found' : 'No workflows yet'}
          </h2>
          <p className="text-sm text-[#475569] max-w-xs">
            {search
              ? 'Try a different search term.'
              : 'Create your first workflow to automate task sequences for your team.'}
          </p>
          {!search && isAdminOrHR && (
            <button
              type="button"
              onClick={() => router.push('/dashboard/tasks/workflows/new')}
              className="mt-5 flex items-center gap-2 px-5 py-2.5 rounded-[8px] text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] transition-colors"
            >
              <Plus size={16} /> Create Workflow
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((w) => (
            <WorkflowCard
              key={w.id}
              workflow={w}
              canEdit={isAdminOrHR || w.owner_user_ids.includes(user?.id ?? '')}
              onEdit={() => router.push(`/dashboard/tasks/workflows/${w.id}`)}
              onTrigger={() => setTriggerTarget(w)}
              onArchive={() => handleArchive(w)}
            />
          ))}
        </div>
      )}

      {/* Manual trigger modal */}
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
