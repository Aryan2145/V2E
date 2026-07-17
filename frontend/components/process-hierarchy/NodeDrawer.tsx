'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  X, Trash2, Plus, Check, Download, ChevronRight, Loader2, FileText, UserCircle2, Shield, ExternalLink,
} from 'lucide-react'
import {
  processHierarchyApi,
  type NodeDetail,
  type ProcessArtifact,
  type ProcessArtifactDirection,
  type ProcessAccessKind,
  type ProcessAccessLevel,
  type ProcessNodeStatus,
  type ProcessMapSummary,
} from '@/lib/api/process-hierarchy'
import { KIND_META } from './nodes'
import { getDepartments } from '@/lib/api/departments'
import { getRoles } from '@/lib/api/roles'
import { getUsers } from '@/lib/api/users'
import type { Department, Role, User } from '@/lib/types'

const STATUS_LABEL: Record<ProcessNodeStatus, string> = { draft: 'Draft', in_review: 'In review', final: 'Final' }
const DRILLABLE = new Set(['container', 'subprocess'])

const inputCls =
  'w-full px-3 py-2 text-[14px] rounded-[8px] border border-[#CBD5E1] focus:border-[#2563EB] focus:outline-none bg-white text-[#0F172A] placeholder:text-[#94A3B8]'
const selectCls =
  'px-2.5 py-2 text-[13px] rounded-[8px] border border-[#CBD5E1] bg-[#F8FAFC] text-[#0F172A] focus:border-[#2563EB] focus:outline-none'

export default function NodeDrawer({
  orgId, mapId, nodeId, onClose, onChanged, onDrill,
}: {
  orgId: string
  mapId: string
  nodeId: string
  onClose: () => void
  onChanged: () => void
  onDrill: (nodeId: string) => void
}) {
  const [node, setNode] = useState<NodeDetail | null>(null)
  const [artifacts, setArtifacts] = useState<ProcessArtifact[]>([])
  const [maps, setMaps] = useState<ProcessMapSummary[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  // editable local copy
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<ProcessNodeStatus>('draft')
  const [respUser, setRespUser] = useState<string>('')
  const [respRole, setRespRole] = useState<string>('')
  const [checklist, setChecklist] = useState<{ id?: string; text: string }[]>([])
  const [wfCascade, setWfCascade] = useState(false)
  const [wfBusy, setWfBusy] = useState(false)

  const reloadNode = async () => {
    const d = await processHierarchyApi.getNode(orgId, mapId, nodeId)
    setNode(d)
    setName(d.name); setDescription(d.description ?? ''); setStatus(d.status)
    setRespUser(d.responsible_user_id ?? ''); setRespRole(d.responsible_role_id ?? '')
    setChecklist(d.checklist.map((c) => ({ id: c.id, text: c.text })))
    setDirty(false)
  }

  useEffect(() => {
    setNode(null)
    reloadNode()
    processHierarchyApi.listArtifacts(orgId, mapId).then(setArtifacts).catch(() => {})
    processHierarchyApi.listMaps(orgId).then(setMaps).catch(() => {})
    getDepartments(orgId).then(setDepartments).catch(() => {})
    getRoles(orgId).then(setRoles).catch(() => {})
    getUsers(orgId).then(setUsers).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId, orgId, mapId])

  const canEdit = !!node?.can_edit
  const drillable = node ? DRILLABLE.has(node.kind) : false

  async function saveCore() {
    if (!node || saving) return
    setSaving(true)
    try {
      await processHierarchyApi.updateNode(orgId, mapId, nodeId, {
        name: name.trim() || node.name,
        description,
        status,
        responsible_user_id: respUser || null,
        responsible_role_id: respRole || null,
        checklist,
      })
      await reloadNode()
      onChanged()
    } finally {
      setSaving(false)
    }
  }

  async function removeNode() {
    if (!node) return
    if (!confirm('Delete this node and everything inside it?')) return
    await processHierarchyApi.deleteNode(orgId, mapId, nodeId)
    onChanged()
    onClose()
  }

  async function requestReview() {
    if (!node || wfBusy) return
    setWfBusy(true)
    try { await processHierarchyApi.requestReview(orgId, mapId, nodeId, wfCascade); await reloadNode(); onChanged() }
    finally { setWfBusy(false) }
  }
  async function decide(s: ProcessNodeStatus) {
    if (!node || wfBusy) return
    setWfBusy(true)
    try { await processHierarchyApi.decideStatus(orgId, mapId, nodeId, s, wfCascade); await reloadNode(); onChanged() }
    finally { setWfBusy(false) }
  }

  async function setLinkedMap(id: string) {
    await processHierarchyApi.updateNode(orgId, mapId, nodeId, { linked_map_id: id || null })
    await reloadNode(); onChanged()
  }

  const touch = () => setDirty(true)
  const isEvent = (k: string) => k === 'start_event' || k === 'end_event'

  const body = (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-[440px] bg-white shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-2 px-5 py-4 border-b border-[#E2E8F0]">
          <span className="text-[#2563EB]">{node ? KIND_META[node.kind].icon : <FileText size={14} />}</span>
          <span className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
            {node ? KIND_META[node.kind].label : 'Loading'}
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            {drillable && (
              <button
                onClick={() => onDrill(nodeId)}
                className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#2563EB] hover:text-[#1D4ED8] px-2 py-1 rounded-[6px] hover:bg-[#EFF6FF] transition-colors"
              >
                Open <ChevronRight size={14} />
              </button>
            )}
            <button onClick={onClose} className="text-[#94A3B8] hover:text-[#0F172A] transition-colors p-1"><X size={18} /></button>
          </div>
        </div>

        {!node ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 size={22} className="animate-spin text-[#2563EB]" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {/* Name + status */}
            <div>
              <label className="block text-xs font-medium text-[#64748B] mb-1">Name</label>
              <input className={inputCls} value={name} disabled={!canEdit}
                onChange={(e) => { setName(e.target.value); touch() }} />
            </div>

            <div className="flex items-center gap-3">
              <div>
                <label className="block text-xs font-medium text-[#64748B] mb-1">Status</label>
                <select className={selectCls} value={status} disabled={!canEdit}
                  onChange={(e) => { setStatus(e.target.value as ProcessNodeStatus); touch() }}>
                  {(['draft', 'in_review', 'final'] as ProcessNodeStatus[]).map((s) => (
                    <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Review workflow */}
            {!isEvent(node.kind) && (canEdit || node.can_approve) && (
              <div className="rounded-[8px] bg-[#F8FAFC] border border-[#E2E8F0] p-2.5 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {canEdit && node.status === 'draft' && (
                    <button onClick={requestReview} disabled={wfBusy}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-semibold rounded-[8px] border border-[#2563EB] text-[#2563EB] hover:bg-[#EFF6FF] disabled:opacity-60">
                      {wfBusy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Request review
                    </button>
                  )}
                  {node.can_approve && node.status !== 'final' && (
                    <button onClick={() => decide('final')} disabled={wfBusy}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-semibold rounded-[8px] bg-[#16A34A] text-white hover:bg-[#15803D] disabled:opacity-60">
                      <Check size={13} /> Mark final
                    </button>
                  )}
                  {node.can_approve && node.status !== 'draft' && (
                    <button onClick={() => decide('draft')} disabled={wfBusy}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-semibold rounded-[8px] border border-[#D97706] text-[#D97706] hover:bg-[#FFFBEB] disabled:opacity-60">
                      Send back to draft
                    </button>
                  )}
                </div>
                <label className="flex items-center gap-1.5 text-[12px] text-[#64748B]">
                  <input type="checkbox" checked={wfCascade} onChange={(e) => setWfCascade(e.target.checked)} className="accent-[#2563EB]" />
                  Apply to everything inside this node
                </label>
              </div>
            )}

            {/* Description */}
            <div>
              <label className="block text-xs font-medium text-[#64748B] mb-1">Description</label>
              <textarea className={`${inputCls} resize-none`} rows={3} value={description} disabled={!canEdit}
                placeholder={canEdit ? 'What happens in this step?' : '—'}
                onChange={(e) => { setDescription(e.target.value); touch() }} />
            </div>

            {/* Responsible */}
            {node.kind !== 'start_event' && node.kind !== 'end_event' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#64748B] mb-1"><UserCircle2 size={12} className="inline mr-1" />Person</label>
                  <select className={`${selectCls} w-full`} value={respUser} disabled={!canEdit}
                    onChange={(e) => { setRespUser(e.target.value); touch() }}>
                    <option value="">—</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#64748B] mb-1">Role</label>
                  <select className={`${selectCls} w-full`} value={respRole} disabled={!canEdit}
                    onChange={(e) => { setRespRole(e.target.value); touch() }}>
                    <option value="">—</option>
                    {roles.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
                  </select>
                </div>
              </div>
            )}

            {/* Cross-map link */}
            {!isEvent(node.kind) && (
              <div>
                <label className="block text-xs font-medium text-[#64748B] mb-1">Opens another map (cross-link)</label>
                <div className="flex items-center gap-2">
                  <select className={`${selectCls} flex-1`} value={node.linked_map_id ?? ''} disabled={!canEdit}
                    onChange={(e) => setLinkedMap(e.target.value)}>
                    <option value="">— none —</option>
                    {maps.filter((m) => m.id !== mapId).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                  {node.linked_map && (
                    <button onClick={() => onDrill(nodeId)} title="Open linked map"
                      className="shrink-0 inline-flex items-center gap-1 px-2.5 py-2 text-[12px] font-semibold rounded-[8px] border border-[#2563EB] text-[#2563EB] hover:bg-[#EFF6FF]">
                      <ExternalLink size={13} /> Open
                    </button>
                  )}
                </div>
                {node.linked_map && <p className="text-[11px] text-[#94A3B8] mt-1">Double-clicking this node on the canvas jumps to “{node.linked_map.name}”.</p>}
              </div>
            )}

            {/* Checklist */}
            {node.kind !== 'start_event' && node.kind !== 'end_event' && (
              <ChecklistEditor items={checklist} canEdit={canEdit} onChange={(next) => { setChecklist(next); touch() }} />
            )}

            {/* Save bar for core fields */}
            {canEdit && dirty && (
              <button onClick={saveCore} disabled={saving}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-[8px] text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 transition-colors">
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Save changes
              </button>
            )}

            {/* Artifacts (inputs/outputs) */}
            {node.kind !== 'start_event' && node.kind !== 'end_event' && (
              <ArtifactsSection
                orgId={orgId} mapId={mapId} nodeId={nodeId} node={node} artifacts={artifacts}
                canEdit={canEdit}
                onArtifactsChanged={() => processHierarchyApi.listArtifacts(orgId, mapId).then(setArtifacts)}
                onLinksChanged={reloadNode}
              />
            )}

            {/* Sharing */}
            {canEdit && (
              <SharingSection
                orgId={orgId} mapId={mapId} nodeId={nodeId} node={node}
                departments={departments} roles={roles} users={users}
                onChanged={reloadNode}
              />
            )}

            {/* Delete */}
            {canEdit && (
              <button onClick={removeNode}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-[8px] text-sm font-semibold text-[#DC2626] border border-[#FECACA] hover:bg-[#FEF2F2] transition-colors">
                <Trash2 size={15} /> Delete node
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(body, document.body) : null
}

// ─── Checklist ─────────────────────────────────────────────────────────────
function ChecklistEditor({ items, canEdit, onChange }: {
  items: { id?: string; text: string }[]
  canEdit: boolean
  onChange: (next: { id?: string; text: string }[]) => void
}) {
  const [draft, setDraft] = useState('')
  if (!canEdit && items.length === 0) return null
  return (
    <div>
      <label className="block text-xs font-medium text-[#64748B] mb-1.5">Checklist</label>
      <div className="space-y-1.5">
        {items.map((it, i) => (
          <div key={it.id ?? i} className="flex items-center gap-2">
            <span className="w-4 h-4 rounded border border-[#CBD5E1] shrink-0" />
            <input className={`${inputCls} py-1.5 text-[13px]`} value={it.text} disabled={!canEdit}
              onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
            {canEdit && (
              <button onClick={() => onChange(items.filter((_, j) => j !== i))}
                className="text-[#94A3B8] hover:text-[#DC2626] shrink-0"><X size={14} /></button>
            )}
          </div>
        ))}
      </div>
      {canEdit && (
        <div className="flex items-center gap-2 mt-2">
          <input className={`${inputCls} py-1.5 text-[13px]`} value={draft} placeholder="Add checklist item…"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && draft.trim()) { onChange([...items, { text: draft.trim() }]); setDraft('') } }} />
          <button onClick={() => { if (draft.trim()) { onChange([...items, { text: draft.trim() }]); setDraft('') } }}
            className="shrink-0 w-8 h-8 rounded-[8px] bg-[#2563EB] text-white flex items-center justify-center hover:bg-[#1D4ED8]"><Plus size={15} /></button>
        </div>
      )}
    </div>
  )
}

// ─── Artifacts ─────────────────────────────────────────────────────────────
function ArtifactsSection({ orgId, mapId, nodeId, node, artifacts, canEdit, onArtifactsChanged, onLinksChanged }: {
  orgId: string; mapId: string; nodeId: string; node: NodeDetail; artifacts: ProcessArtifact[]
  canEdit: boolean; onArtifactsChanged: () => void; onLinksChanged: () => void
}) {
  const [dir, setDir] = useState<ProcessArtifactDirection>('input')
  const [artifactId, setArtifactId] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function link() {
    if (!artifactId || busy) return
    setBusy(true)
    try { await processHierarchyApi.linkArtifact(orgId, mapId, nodeId, { artifact_id: artifactId, direction: dir }); setArtifactId(''); onLinksChanged() }
    finally { setBusy(false) }
  }

  async function upload(file: File) {
    setBusy(true)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('name', file.name)
      const created = await processHierarchyApi.uploadArtifact(orgId, mapId, form)
      onArtifactsChanged()
      await processHierarchyApi.linkArtifact(orgId, mapId, nodeId, { artifact_id: created.id, direction: dir })
      onLinksChanged()
    } finally { setBusy(false) }
  }

  async function download(id: string) {
    const { url } = await processHierarchyApi.downloadArtifact(orgId, mapId, id)
    window.open(url, '_blank')
  }

  async function unlink(linkId: string) {
    await processHierarchyApi.unlinkArtifact(orgId, mapId, nodeId, linkId)
    onLinksChanged()
  }

  const Row = ({ links, title }: { links: NodeDetail['inputs']; title: string }) => (
    <div>
      <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wide mb-1">{title}</p>
      {links.length === 0 ? <p className="text-[13px] text-[#94A3B8]">None</p> : (
        <div className="space-y-1">
          {links.map((l) => (
            <div key={l.id} className="flex items-center gap-2 text-[13px] bg-[#F8FAFC] border border-[#E2E8F0] rounded-[6px] px-2 py-1.5">
              <FileText size={13} className="text-[#2563EB] shrink-0" />
              <span className="flex-1 truncate text-[#0F172A]">{l.artifact.name}</span>
              {l.artifact.storage_key && (
                <button onClick={() => download(l.artifact.id)} className="text-[#64748B] hover:text-[#2563EB] shrink-0"><Download size={13} /></button>
              )}
              {canEdit && <button onClick={() => unlink(l.id)} className="text-[#94A3B8] hover:text-[#DC2626] shrink-0"><X size={13} /></button>}
            </div>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div className="space-y-3 border-t border-[#E2E8F0] pt-4">
      <p className="text-xs font-medium text-[#64748B]">Documents</p>
      <Row links={node.inputs} title="Inputs (needed)" />
      <Row links={node.outputs} title="Outputs (produced)" />
      {canEdit && (
        <div className="space-y-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[8px] p-2.5">
          <div className="flex items-center gap-2">
            <select className={`${selectCls} bg-white`} value={dir} onChange={(e) => setDir(e.target.value as ProcessArtifactDirection)}>
              <option value="input">Input</option>
              <option value="output">Output</option>
            </select>
            <select className={`${selectCls} bg-white flex-1`} value={artifactId} onChange={(e) => setArtifactId(e.target.value)}>
              <option value="">Select a document…</option>
              {artifacts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <button onClick={link} disabled={!artifactId || busy}
              className="shrink-0 w-8 h-8 rounded-[8px] bg-[#2563EB] text-white flex items-center justify-center hover:bg-[#1D4ED8] disabled:bg-[#E2E8F0] disabled:text-[#94A3B8]"><Plus size={15} /></button>
          </div>
          <div className="flex items-center gap-2">
            <input ref={fileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = '' }} />
            <button onClick={() => fileRef.current?.click()} disabled={busy}
              className="text-[13px] font-medium text-[#2563EB] hover:text-[#1D4ED8] inline-flex items-center gap-1">
              {busy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Upload a new file as {dir}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sharing ──────────────────────────────────────────────────────────────
function SharingSection({ orgId, mapId, nodeId, node, departments, roles, users, onChanged }: {
  orgId: string; mapId: string; nodeId: string; node: NodeDetail
  departments: Department[]; roles: Role[]; users: User[]; onChanged: () => void
}) {
  const [kind, setKind] = useState<ProcessAccessKind>('department')
  const [level, setLevel] = useState<ProcessAccessLevel>('view')
  const [entityId, setEntityId] = useState('')
  const [busy, setBusy] = useState(false)

  const options = useMemo(() => {
    if (kind === 'department') return departments.map((d) => ({ id: d.id, label: d.name }))
    if (kind === 'role') return roles.map((r) => ({ id: r.id, label: r.title }))
    return users.map((u) => ({ id: u.id, label: u.name }))
  }, [kind, departments, roles, users])

  async function add() {
    if (!entityId || busy) return
    setBusy(true)
    try {
      await processHierarchyApi.addAccess(orgId, mapId, nodeId, {
        kind,
        level: kind === 'exclude_user' ? undefined : level,
        department_id: kind === 'department' ? entityId : undefined,
        role_id: kind === 'role' ? entityId : undefined,
        user_id: kind === 'user' || kind === 'exclude_user' ? entityId : undefined,
      })
      setEntityId('')
      onChanged()
    } finally { setBusy(false) }
  }

  async function remove(id: string) {
    await processHierarchyApi.removeAccess(orgId, mapId, nodeId, id)
    onChanged()
  }

  return (
    <div className="space-y-3 border-t border-[#E2E8F0] pt-4">
      <p className="text-xs font-medium text-[#64748B] flex items-center gap-1.5"><Shield size={12} /> Who can see / edit this (cascades to everything inside)</p>
      {node.access_rules.length === 0 ? (
        <p className="text-[13px] text-[#94A3B8]">No one attached here yet — this node inherits access from above.</p>
      ) : (
        <div className="space-y-1">
          {node.access_rules.map((r) => (
            <div key={r.id} className="flex items-center gap-2 text-[13px] bg-[#F8FAFC] border border-[#E2E8F0] rounded-[6px] px-2 py-1.5">
              <span className={`text-[10px] font-semibold rounded px-1.5 py-0.5 shrink-0 ${
                r.kind === 'exclude_user' ? 'bg-[#FEE2E2] text-[#DC2626]' : r.level === 'edit' ? 'bg-[#DCFCE7] text-[#16A34A]' : 'bg-[#E0F2FE] text-[#0369A1]'}`}>
                {r.kind === 'exclude_user' ? 'hidden' : r.level}
              </span>
              <span className="flex-1 truncate text-[#0F172A]">{r.label}</span>
              <span className="text-[11px] text-[#94A3B8] capitalize shrink-0">{r.kind === 'exclude_user' ? 'person' : r.kind}</span>
              <button onClick={() => remove(r.id)} className="text-[#94A3B8] hover:text-[#DC2626] shrink-0"><X size={13} /></button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[8px] p-2.5 flex-wrap">
        <select className={`${selectCls} bg-white`} value={kind} onChange={(e) => { setKind(e.target.value as ProcessAccessKind); setEntityId('') }}>
          <option value="department">Department</option>
          <option value="role">Role</option>
          <option value="user">Person</option>
          <option value="exclude_user">Hide from person</option>
        </select>
        {kind !== 'exclude_user' && (
          <select className={`${selectCls} bg-white`} value={level} onChange={(e) => setLevel(e.target.value as ProcessAccessLevel)}>
            <option value="view">Can view</option>
            <option value="edit">Can edit</option>
          </select>
        )}
        <select className={`${selectCls} bg-white flex-1 min-w-[120px]`} value={entityId} onChange={(e) => setEntityId(e.target.value)}>
          <option value="">Select…</option>
          {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        <button onClick={add} disabled={!entityId || busy}
          className="shrink-0 w-8 h-8 rounded-[8px] bg-[#2563EB] text-white flex items-center justify-center hover:bg-[#1D4ED8] disabled:bg-[#E2E8F0] disabled:text-[#94A3B8]"><Plus size={15} /></button>
      </div>
      <p className="text-[11px] text-[#94A3B8]">Attaching a department automatically covers its roles and people. Use “Hide from person” to remove someone who’s otherwise included.</p>
    </div>
  )
}
