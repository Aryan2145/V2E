'use client'

import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/context'
import { usePermissions } from '@/lib/auth/use-permissions'
import { useToast } from '@/components/ui/Toast'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { processHierarchyApi, type ProcessMapSummary, type ProcessTemplateSummary } from '@/lib/api/process-hierarchy'
import { Workflow, Plus, ChevronRight, X, Loader2, Layers, Trash2 } from 'lucide-react'

const LEAF = 'process_hierarchy.map.manage'

/** Close-on-Escape for a modal/overlay. */
function useEscape(onEscape: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onEscape() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onEscape])
}

export default function ProcessHierarchyListPage() {
  const { user } = useAuth()
  const orgId = user?.organizationId ?? ''
  const { can } = usePermissions()
  const canCreate = can(LEAF, 'write')
  const router = useRouter()

  const [maps, setMaps] = useState<ProcessMapSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)

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
    <div>
      {/* Sticky header (title + primary actions stay pinned while the list scrolls) */}
      <div className="sticky top-0 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 bg-[#F8FAFC]/95 backdrop-blur border-b border-[#E2E8F0] pb-4 pt-1">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-bold text-[#0F172A] leading-tight">Process Hierarchy</h1>
            <p className="mt-1 text-[15px] text-[#475569]">
              Explore how the company does things — drill into any area to see the process flow beneath it.
            </p>
          </div>
          {canCreate && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setShowTemplates(true)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-[8px] text-sm font-semibold text-[#2563EB] bg-white border-2 border-[#2563EB] hover:bg-[#EFF6FF] transition-colors"
              >
                <Layers size={16} /> From template
              </button>
              <button
                onClick={() => setShowCreate(true)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-[8px] text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] transition-colors"
              >
                <Plus size={16} /> New Map
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="pt-6">
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
          // At low counts a 3-col grid strands the row; scale columns to the count.
          <div className={`grid gap-4 grid-cols-1 ${maps.length === 1 ? 'sm:grid-cols-1 lg:max-w-2xl' : 'sm:grid-cols-2 xl:grid-cols-3'}`}>
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
                      {m.node_count > 0 && (
                        <span className="shrink-0 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-[#2563EB] text-white text-[11px] font-semibold tabular-nums">
                          {m.node_count}
                        </span>
                      )}
                      {m.is_owner && (
                        <span className="text-[10px] font-semibold rounded-full px-1.5 py-0.5 bg-[#E0F2FE] text-[#0369A1] shrink-0">Owner</span>
                      )}
                    </div>
                    <p className="text-[13px] text-[#475569] mt-0.5 line-clamp-2 min-h-[2.2rem]">
                      {m.description || 'No description'}
                    </p>
                    <p className="text-[12px] text-[#64748B] mt-2">
                      {m.node_count} node{m.node_count !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <ChevronRight size={16} className="text-[#CBD5E1] group-hover:text-[#2563EB] transition-colors mt-1 shrink-0" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateMapModal
          orgId={orgId}
          onClose={() => setShowCreate(false)}
          onCreated={(id) => router.push(`/dashboard/process-hierarchy/${id}`)}
        />
      )}

      {showTemplates && (
        <TemplatePickerModal
          orgId={orgId}
          onClose={() => setShowTemplates(false)}
          onInstantiated={(id) => router.push(`/dashboard/process-hierarchy/${id}`)}
        />
      )}
    </div>
  )
}

function TemplatePickerModal({ orgId, onClose, onInstantiated }: {
  orgId: string; onClose: () => void; onInstantiated: (id: string) => void
}) {
  const { addToast } = useToast()
  const [templates, setTemplates] = useState<ProcessTemplateSummary[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [naming, setNaming] = useState<ProcessTemplateSummary | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<ProcessTemplateSummary | null>(null)
  const [deleting, setDeleting] = useState(false)
  useEscape(onClose)

  const reload = () => processHierarchyApi.listTemplates(orgId).then(setTemplates).catch(() => setTemplates([]))
  useEffect(() => { reload() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [orgId])

  async function instantiate(t: ProcessTemplateSummary, name: string) {
    setBusy(t.id)
    try {
      const map = await processHierarchyApi.instantiateTemplate(orgId, t.id, name.trim())
      onInstantiated(map.id)
    } catch {
      addToast('Could not create a map from that template. Please try again.', 'error')
    } finally { setBusy(null) }
  }
  async function remove() {
    if (!confirmDelete) return
    setDeleting(true)
    try {
      await processHierarchyApi.deleteTemplate(orgId, confirmDelete.id)
      setConfirmDelete(null)
      reload()
    } catch {
      addToast('Could not delete the template. Please try again.', 'error')
    } finally { setDeleting(false) }
  }

  return createPortal(
    <>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />
        <div className="relative bg-white rounded-[12px] shadow-xl w-full max-w-md max-h-[80vh] flex flex-col animate-[fadeIn_.15s_ease-out]">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-[#E2E8F0]">
            <Layers size={16} className="text-[#2563EB]" />
            <h3 className="text-base font-semibold text-[#0F172A]">Create from template</h3>
            <button onClick={onClose} className="ml-auto text-[#94A3B8] hover:text-[#0F172A]"><X size={18} /></button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-3">
            {templates === null ? (
              <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-[#2563EB]" /></div>
            ) : templates.length === 0 ? (
              <p className="text-[13px] text-[#64748B] text-center py-8">No templates yet. Open a map and use “Save as template”.</p>
            ) : (
              <div className="space-y-1.5">
                {templates.map((t) => (
                  <div key={t.id} className="flex items-center gap-2.5 border border-[#E2E8F0] rounded-[8px] px-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-medium text-[#0F172A] truncate">{t.name}</p>
                      {t.description && <p className="text-[12px] text-[#475569] truncate">{t.description}</p>}
                    </div>
                    <button onClick={() => setNaming(t)} disabled={busy === t.id}
                      className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-semibold rounded-[8px] bg-[#2563EB] text-white hover:bg-[#1D4ED8] disabled:bg-[#E2E8F0] disabled:text-[#94A3B8]">
                      {busy === t.id ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Use
                    </button>
                    <button onClick={() => setConfirmDelete(t)} title="Delete template"
                      className="shrink-0 text-[#94A3B8] hover:text-[#DC2626]"><Trash2 size={15} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {naming && (
        <NameModal
          title="Name the new map"
          label="Map name"
          initial={naming.name.replace(/ template$/i, '')}
          confirmLabel="Create map"
          busy={busy === naming.id}
          onCancel={() => setNaming(null)}
          onSubmit={(name) => { const t = naming; setNaming(null); instantiate(t, name) }}
        />
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        danger
        title="Delete template?"
        message={confirmDelete ? `“${confirmDelete.name}” will be removed. Maps already created from it are unaffected.` : ''}
        confirmLabel="Delete template"
        loading={deleting}
        onConfirm={remove}
        onCancel={() => { if (!deleting) setConfirmDelete(null) }}
      />
    </>,
    document.body,
  )
}

/** Styled replacement for window.prompt — a portaled, on-brand single-field name dialog. */
function NameModal({ title, label, initial, confirmLabel, busy, onCancel, onSubmit }: {
  title: string; label: string; initial: string; confirmLabel: string; busy?: boolean
  onCancel: () => void; onSubmit: (name: string) => void
}) {
  const [name, setName] = useState(initial)
  useEscape(onCancel)
  const submit = () => { if (name.trim() && !busy) onSubmit(name.trim()) }
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-[12px] shadow-xl w-full max-w-md p-6 animate-[fadeIn_.15s_ease-out]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-[#0F172A]">{title}</h3>
          <button onClick={onCancel} className="text-[#94A3B8] hover:text-[#0F172A] transition-colors"><X size={18} /></button>
        </div>
        <label className="block text-sm font-medium text-[#374151] mb-1">{label}</label>
        <input
          autoFocus value={name} onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          className="w-full px-3 py-2.5 text-[15px] rounded-[8px] border border-[#CBD5E1] focus:border-[#2563EB] focus:outline-none bg-white text-[#0F172A]"
        />
        <div className="flex justify-end mt-6">
          <button onClick={submit} disabled={!name.trim() || busy}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[8px] text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:bg-[#E2E8F0] disabled:text-[#94A3B8] transition-colors">
            {busy && <Loader2 size={15} className="animate-spin" />} {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function CreateMapModal({ orgId, onClose, onCreated }: { orgId: string; onClose: () => void; onCreated: (id: string) => void }) {
  const { addToast } = useToast()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  useEscape(onClose)

  async function submit() {
    if (!name.trim() || saving) return
    setSaving(true)
    try {
      const map = await processHierarchyApi.createMap(orgId, { name: name.trim(), description: description.trim() || undefined })
      onCreated(map.id)
    } catch {
      addToast('Could not create the map. Please try again.', 'error')
      setSaving(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-[12px] shadow-xl w-full max-w-md p-6 animate-[fadeIn_.15s_ease-out]">
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
    </div>,
    document.body,
  )
}
