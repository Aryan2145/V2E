'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/context'
import { usePermissions } from '@/lib/auth/use-permissions'
import { processHierarchyApi, type ProcessMapSummary } from '@/lib/api/process-hierarchy'
import { Workflow, Plus, ChevronRight, X, Loader2 } from 'lucide-react'

const LEAF = 'process_hierarchy.map.manage'

export default function ProcessHierarchyListPage() {
  const { user } = useAuth()
  const orgId = user?.organizationId ?? ''
  const { can } = usePermissions()
  const canCreate = can(LEAF, 'write')
  const router = useRouter()

  const [maps, setMaps] = useState<ProcessMapSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  const reload = useCallback(async () => {
    if (!orgId) return
    const data = await processHierarchyApi.listMaps(orgId).catch(() => [])
    setMaps(data)
  }, [orgId])

  useEffect(() => {
    if (!orgId) { setLoading(false); return }
    reload().finally(() => setLoading(false))
  }, [orgId, reload])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold text-[#0F172A] leading-tight">Process Hierarchy</h1>
          <p className="mt-1 text-[15px] text-[#475569]">
            Explore how the company does things — drill into any area to see the process flow beneath it.
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-[8px] text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] transition-colors"
          >
            <Plus size={16} /> New Map
          </button>
        )}
      </div>

      {maps.length === 0 ? (
        <div className="bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-[#F1F5F9] flex items-center justify-center mb-4">
            <Workflow size={28} className="text-[#94A3B8]" />
          </div>
          <h2 className="text-lg font-semibold text-[#0F172A]">No process maps yet</h2>
          <p className="text-[#475569] text-sm mt-1 max-w-sm">
            {canCreate
              ? 'Create your first map to start documenting how your teams work.'
              : 'Maps shared with you will appear here once they are created.'}
          </p>
          {canCreate && (
            <button
              onClick={() => setShowCreate(true)}
              className="mt-5 inline-flex items-center gap-1.5 px-4 py-2 rounded-[8px] text-sm font-medium bg-[#2563EB] text-white hover:bg-[#1D4ED8] transition-colors"
            >
              <Plus size={15} /> New Map
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {maps.map((m) => (
            <button
              key={m.id}
              onClick={() => router.push(`/dashboard/process-hierarchy/${m.id}`)}
              className="text-left bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-5 hover:border-[#2563EB] hover:shadow-md active:scale-[0.99] transition-all duration-150 group"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-[8px] bg-[#EFF6FF] flex items-center justify-center text-[#2563EB] flex-shrink-0">
                  <Workflow size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-[#0F172A] text-[15px] truncate">{m.name}</p>
                    {m.is_owner && (
                      <span className="text-[10px] font-semibold rounded-full px-1.5 py-0.5 bg-[#E0F2FE] text-[#0369A1] shrink-0">Owner</span>
                    )}
                  </div>
                  <p className="text-xs text-[#475569] mt-0.5 line-clamp-2 min-h-[2rem]">
                    {m.description || 'No description'}
                  </p>
                  <p className="text-[11px] text-[#94A3B8] mt-2">
                    {m.node_count} node{m.node_count !== 1 ? 's' : ''}
                  </p>
                </div>
                <ChevronRight size={16} className="text-[#CBD5E1] group-hover:text-[#2563EB] transition-colors mt-1 shrink-0" />
              </div>
            </button>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateMapModal
          orgId={orgId}
          onClose={() => setShowCreate(false)}
          onCreated={(id) => router.push(`/dashboard/process-hierarchy/${id}`)}
        />
      )}
    </div>
  )
}

function CreateMapModal({ orgId, onClose, onCreated }: { orgId: string; onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!name.trim() || saving) return
    setSaving(true)
    try {
      const map = await processHierarchyApi.createMap(orgId, { name: name.trim(), description: description.trim() || undefined })
      onCreated(map.id)
    } catch {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-[12px] shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-[#0F172A]">New process map</h3>
          <button onClick={onClose} className="text-[#94A3B8] hover:text-[#0F172A] transition-colors"><X size={18} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1">Name</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="e.g. How Sales Works"
              className="w-full px-3 py-2.5 text-[15px] rounded-[8px] border border-[#CBD5E1] focus:border-[#2563EB] focus:outline-none bg-white text-[#0F172A] placeholder:text-[#94A3B8]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1">Description <span className="text-[#94A3B8] font-normal">(optional)</span></label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What does this map cover?"
              className="w-full px-3 py-2.5 text-[15px] rounded-[8px] border border-[#CBD5E1] focus:border-[#2563EB] focus:outline-none bg-white text-[#0F172A] placeholder:text-[#94A3B8] resize-none"
            />
          </div>
        </div>
        <div className="flex justify-end mt-6">
          <button
            onClick={submit}
            disabled={!name.trim() || saving}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[8px] text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:bg-[#E2E8F0] disabled:text-[#94A3B8] transition-colors"
          >
            {saving && <Loader2 size={15} className="animate-spin" />} Create Map
          </button>
        </div>
      </div>
    </div>
  )
}
