'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Plus, Upload, Trash2, Download, FileText, Loader2, Paperclip } from 'lucide-react'
import { processHierarchyApi, type ProcessArtifact, type ProcessArtifactType } from '@/lib/api/process-hierarchy'

const TYPES: ProcessArtifactType[] = ['document', 'form', 'report', 'data', 'other']

export default function ArtifactLibrary({ orgId, mapId, canEdit, onClose }: {
  orgId: string; mapId: string; canEdit: boolean; onClose: () => void
}) {
  const [artifacts, setArtifacts] = useState<ProcessArtifact[] | null>(null)
  const [name, setName] = useState('')
  const [type, setType] = useState<ProcessArtifactType>('document')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const reload = () => processHierarchyApi.listArtifacts(orgId, mapId).then(setArtifacts).catch(() => setArtifacts([]))
  useEffect(() => { reload() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [orgId, mapId])

  async function create() {
    if (!name.trim() || busy) return
    setBusy(true)
    try { await processHierarchyApi.createArtifact(orgId, mapId, { name: name.trim(), artifact_type: type }); setName(''); reload() }
    finally { setBusy(false) }
  }
  async function upload(file: File) {
    setBusy(true)
    try { const form = new FormData(); form.append('file', file); form.append('name', file.name); form.append('artifact_type', type); await processHierarchyApi.uploadArtifact(orgId, mapId, form); reload() }
    finally { setBusy(false) }
  }
  async function remove(id: string) {
    if (!confirm('Delete this document? It will be removed from every step that uses it.')) return
    await processHierarchyApi.deleteArtifact(orgId, mapId, id); reload()
  }
  async function download(id: string) {
    const { url } = await processHierarchyApi.downloadArtifact(orgId, mapId, id); window.open(url, '_blank')
  }

  const body = (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-[12px] shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-[#E2E8F0]">
          <Paperclip size={16} className="text-[#2563EB]" />
          <h3 className="text-base font-semibold text-[#0F172A]">Document library</h3>
          <button onClick={onClose} className="ml-auto text-[#94A3B8] hover:text-[#0F172A]"><X size={18} /></button>
        </div>

        {canEdit && (
          <div className="px-5 py-3 border-b border-[#E2E8F0] space-y-2 bg-[#F8FAFC]">
            <div className="flex items-center gap-2">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Document name…"
                onKeyDown={(e) => e.key === 'Enter' && create()}
                className="flex-1 px-3 py-2 text-[14px] rounded-[8px] border border-[#CBD5E1] focus:border-[#2563EB] focus:outline-none bg-white" />
              <select value={type} onChange={(e) => setType(e.target.value as ProcessArtifactType)}
                className="px-2 py-2 text-[13px] rounded-[8px] border border-[#CBD5E1] bg-white text-[#0F172A] capitalize">
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={create} disabled={!name.trim() || busy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-semibold rounded-[8px] bg-[#2563EB] text-white hover:bg-[#1D4ED8] disabled:bg-[#E2E8F0] disabled:text-[#94A3B8]">
                <Plus size={14} /> Add (metadata)
              </button>
              <input ref={fileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = '' }} />
              <button onClick={() => fileRef.current?.click()} disabled={busy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-semibold rounded-[8px] border border-[#2563EB] text-[#2563EB] hover:bg-[#EFF6FF]">
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Upload file
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {artifacts === null ? (
            <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-[#2563EB]" /></div>
          ) : artifacts.length === 0 ? (
            <p className="text-[13px] text-[#94A3B8] text-center py-8">No documents yet.</p>
          ) : (
            <div className="space-y-1.5">
              {artifacts.map((a) => (
                <div key={a.id} className="flex items-center gap-2.5 border border-[#E2E8F0] rounded-[8px] px-3 py-2">
                  <FileText size={15} className="text-[#2563EB] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] text-[#0F172A] truncate">{a.name}</p>
                    <p className="text-[11px] text-[#94A3B8] capitalize">{a.artifact_type}{a.storage_key ? ' · file attached' : ' · metadata'}</p>
                  </div>
                  {a.storage_key && (
                    <button onClick={() => download(a.id)} className="text-[#64748B] hover:text-[#2563EB] shrink-0"><Download size={15} /></button>
                  )}
                  {canEdit && (
                    <button onClick={() => remove(a.id)} className="text-[#94A3B8] hover:text-[#DC2626] shrink-0"><Trash2 size={15} /></button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
  return typeof document !== 'undefined' ? createPortal(body, document.body) : null
}
