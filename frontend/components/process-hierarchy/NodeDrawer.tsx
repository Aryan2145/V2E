'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  X, Trash2, Plus, Check, Download, ChevronRight, Loader2, FileText, UserCircle2, Shield, ExternalLink, FolderInput,
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
  type TreeNode,
} from '@/lib/api/process-hierarchy'
import { KIND_META } from './kind-meta'
import { getDepartments } from '@/lib/api/departments'
import { getRoles } from '@/lib/api/roles'
import { getUsers } from '@/lib/api/users'
import type { Department, Role, User } from '@/lib/types'
import StyledSelect from '@/components/ui/StyledSelect'
import EmployeePicker from '@/components/ui/EmployeePicker'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'

const STATUS_LABEL: Record<ProcessNodeStatus, string> = { draft: 'Draft', in_review: 'In review', final: 'Final' }
const STATUS_COLOR: Record<ProcessNodeStatus, string> = { draft: '#94A3B8', in_review: '#D97706', final: '#16A34A' }
const STATUS_OPTIONS = (['draft', 'in_review', 'final'] as ProcessNodeStatus[]).map((s) => ({ value: s, label: STATUS_LABEL[s], color: STATUS_COLOR[s] }))
const DRILLABLE = new Set(['container', 'subprocess'])
const CONTAINER_KINDS = new Set(['container', 'subprocess'])

const inputCls =
  'w-full px-3 py-2 text-[14px] rounded-[8px] border border-[#CBD5E1] focus:border-[#2563EB] focus:outline-none bg-white text-[#0F172A] placeholder:text-[#94A3B8]'

export default function NodeDrawer({
  orgId, mapId, nodeId, tree = [], onClose, onChanged, onDrill,
}: {
  orgId: string
  mapId: string
  nodeId: string
  tree?: TreeNode[]
  onClose: () => void
  onChanged: () => void
  onDrill: (nodeId: string) => void
}) {
  const { addToast } = useToast()
  const [node, setNode] = useState<NodeDetail | null>(null)
  const [artifacts, setArtifacts] = useState<ProcessArtifact[]>([])
  const [maps, setMaps] = useState<ProcessMapSummary[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [deleting, setDeleting] = useState(false)

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
    reloadNode().catch(() => addToast('Could not load this step.', 'error'))
    processHierarchyApi.listArtifacts(orgId, mapId).then(setArtifacts).catch(() => {})
    processHierarchyApi.listMaps(orgId).then(setMaps).catch(() => {})
    getDepartments(orgId).then(setDepartments).catch(() => {})
    getRoles(orgId).then(setRoles).catch(() => {})
    getUsers(orgId).then(setUsers).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId, orgId, mapId])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const canEdit = !!node?.can_edit
  const drillable = node ? DRILLABLE.has(node.kind) : false

  // Descendants of this node (from the map tree) — used for the delete blast radius
  // and to keep the node out of its own "move to" targets.
  const descendantIds = useMemo(() => {
    if (!tree.length) return new Set<string>()
    const childrenBy = new Map<string | null, string[]>()
    tree.forEach((n) => {
      const list = childrenBy.get(n.parent_node_id) ?? []
      list.push(n.id); childrenBy.set(n.parent_node_id, list)
    })
    const out = new Set<string>()
    const stack = [...(childrenBy.get(nodeId) ?? [])]
    while (stack.length) { const id = stack.pop()!; if (out.has(id)) continue; out.add(id); for (const c of childrenBy.get(id) ?? []) stack.push(c) }
    return out
  }, [tree, nodeId])

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
      addToast('Changes saved.', 'success')
    } catch {
      addToast('Could not save your changes. Please try again.', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function removeNode() {
    if (!node) return
    setDeleting(true)
    try {
      await processHierarchyApi.deleteNode(orgId, mapId, nodeId)
      setConfirmDel(false)
      onChanged()
      onClose()
    } catch {
      addToast('Could not delete this step. Please try again.', 'error')
      setDeleting(false)
    }
  }

  async function requestReview() {
    if (!node || wfBusy) return
    setWfBusy(true)
    try { await processHierarchyApi.requestReview(orgId, mapId, nodeId, wfCascade); await reloadNode(); onChanged() }
    catch { addToast('Could not request review.', 'error') }
    finally { setWfBusy(false) }
  }
  async function decide(s: ProcessNodeStatus) {
    if (!node || wfBusy) return
    setWfBusy(true)
    try { await processHierarchyApi.decideStatus(orgId, mapId, nodeId, s, wfCascade); await reloadNode(); onChanged() }
    catch { addToast('Could not update the review status.', 'error') }
    finally { setWfBusy(false) }
  }

  async function setLinkedMap(id: string) {
    try { await processHierarchyApi.updateNode(orgId, mapId, nodeId, { linked_map_id: id || null }); await reloadNode(); onChanged() }
    catch { addToast('Could not update the cross-link.', 'error') }
  }

  async function moveTo(parentId: string) {
    if (!node) return
    try {
      await processHierarchyApi.updateNode(orgId, mapId, nodeId, { parent_node_id: parentId === '__root__' ? null : parentId })
      onChanged()
      addToast('Step moved.', 'success')
      onClose()
    } catch {
      addToast('Could not move this step there.', 'error')
    }
  }

  const touch = () => setDirty(true)
  const isEvent = (k: string) => k === 'start_event' || k === 'end_event'

  const moveOptions = useMemo(() => {
    const opts = [{ value: '__root__', label: 'Top level (map root)' }]
    tree
      .filter((n) => CONTAINER_KINDS.has(n.kind) && n.id !== nodeId && !descendantIds.has(n.id) && n.id !== node?.parent_node_id)
      .forEach((n) => opts.push({ value: n.id, label: n.name }))
    return opts
  }, [tree, nodeId, descendantIds, node?.parent_node_id])

  const roleOptions = useMemo(() => [{ value: '', label: '— None —' }, ...roles.map((r) => ({ value: r.id, label: r.title }))], [roles])
  const mapOptions = useMemo(
    () => [{ value: '', label: '— None —' }, ...maps.filter((m) => m.id !== mapId).map((m) => ({ value: m.id, label: m.name }))],
    [maps, mapId],
  )

  const body = (
    // Non-modal: no dimming backdrop, so the canvas stays visible and the selected
    // node keeps its context while you edit it (Part B7). The panel slides in.
    <div className="fixed inset-0 z-[60] pointer-events-none">
      <div className="absolute right-0 top-0 h-full w-full max-w-[440px] bg-white shadow-2xl border-l border-[#E2E8F0] flex flex-col pointer-events-auto animate-[slideInRight_.22s_ease-out]">
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
            <button onClick={onClose} aria-label="Close panel" className="text-[#94A3B8] hover:text-[#0F172A] transition-colors p-1"><X size={18} /></button>
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
              <label className="block text-xs font-medium text-[#475569] mb-1">Name</label>
              <input className={inputCls} value={name} disabled={!canEdit}
                onChange={(e) => { setName(e.target.value); touch() }} />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#475569] mb-1">Status</label>
              <div className="w-40">
                <StyledSelect value={status} onChange={(v) => { setStatus(v as ProcessNodeStatus); touch() }}
                  options={STATUS_OPTIONS} disabled={!canEdit} />
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
                <label className="flex items-center gap-1.5 text-[12px] text-[#475569]">
                  <input type="checkbox" checked={wfCascade} onChange={(e) => setWfCascade(e.target.checked)} className="accent-[#2563EB]" />
                  Apply to everything inside this node
                </label>
              </div>
            )}

            {/* Description */}
            <div>
              <label className="block text-xs font-medium text-[#475569] mb-1">Description</label>
              <textarea className={`${inputCls} resize-none`} rows={3} value={description} disabled={!canEdit}
                placeholder={canEdit ? 'What happens in this step?' : '—'}
                onChange={(e) => { setDescription(e.target.value); touch() }} />
            </div>

            {/* Responsible */}
            {!isEvent(node.kind) && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#475569] mb-1"><UserCircle2 size={12} className="inline mr-1" />Person</label>
                  <EmployeePicker
                    value={respUser}
                    onChange={(id) => { setRespUser(id); touch() }}
                    employees={users.map((u) => ({ user_id: u.id, name: u.name }))}
                    title="Responsible person"
                    placeholder="— None —"
                    allowClear
                    disabled={!canEdit}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#475569] mb-1">Role</label>
                  <StyledSelect value={respRole} onChange={(v) => { setRespRole(v); touch() }}
                    options={roleOptions} disabled={!canEdit} placeholder="— None —" />
                </div>
              </div>
            )}

            {/* Move to (re-parent) */}
            {canEdit && !isEvent(node.kind) && moveOptions.length > 1 && (
              <div>
                <label className="block text-xs font-medium text-[#475569] mb-1"><FolderInput size={12} className="inline mr-1" />Move to another area</label>
                <StyledSelect value="" onChange={(v) => v && moveTo(v)} options={moveOptions} placeholder="Choose a destination…" />
                <p className="text-[11px] text-[#64748B] mt-1">Moves this step (and anything inside it) into another container. Its connections here are cleared.</p>
              </div>
            )}

            {/* Cross-map link */}
            {!isEvent(node.kind) && (
              <div>
                <label className="block text-xs font-medium text-[#475569] mb-1">Opens another map (cross-link)</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <StyledSelect value={node.linked_map_id ?? ''} onChange={(v) => setLinkedMap(v)}
                      options={mapOptions} disabled={!canEdit} placeholder="— None —" />
                  </div>
                  {node.linked_map && (
                    <button onClick={() => onDrill(nodeId)} title="Open linked map"
                      className="shrink-0 inline-flex items-center gap-1 px-2.5 py-2 text-[12px] font-semibold rounded-[8px] border border-[#2563EB] text-[#2563EB] hover:bg-[#EFF6FF]">
                      <ExternalLink size={13} /> Open
                    </button>
                  )}
                </div>
                {node.linked_map && <p className="text-[11px] text-[#64748B] mt-1">Opening this node jumps to “{node.linked_map.name}”.</p>}
              </div>
            )}

            {/* Checklist */}
            {!isEvent(node.kind) && (
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
            {!isEvent(node.kind) && (
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
              <button onClick={() => setConfirmDel(true)}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-[8px] text-sm font-semibold text-[#DC2626] border border-[#FECACA] hover:bg-[#FEF2F2] transition-colors">
                <Trash2 size={15} /> Delete node
              </button>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmDel}
        danger
        title="Delete this step?"
        message={
          descendantIds.size > 0
            ? `This also permanently deletes the ${descendantIds.size} item${descendantIds.size !== 1 ? 's' : ''} nested inside it. This cannot be undone.`
            : 'This permanently deletes the step. This cannot be undone.'
        }
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={removeNode}
        onCancel={() => { if (!deleting) setConfirmDel(false) }}
      />
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
      <label className="block text-xs font-medium text-[#475569] mb-1.5">Checklist</label>
      <div className="space-y-1.5">
        {items.map((it, i) => (
          <div key={it.id ?? i} className="flex items-center gap-2">
            <span className="w-4 h-4 rounded border border-[#CBD5E1] shrink-0" />
            <input className={`${inputCls} py-1.5 text-[13px]`} value={it.text} disabled={!canEdit}
              onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
            {canEdit && (
              <button onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label="Remove item"
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
          <button onClick={() => { if (draft.trim()) { onChange([...items, { text: draft.trim() }]); setDraft('') } }} aria-label="Add checklist item"
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
  const { addToast } = useToast()
  const [dir, setDir] = useState<ProcessArtifactDirection>('input')
  const [artifactId, setArtifactId] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function link() {
    if (!artifactId || busy) return
    setBusy(true)
    try { await processHierarchyApi.linkArtifact(orgId, mapId, nodeId, { artifact_id: artifactId, direction: dir }); setArtifactId(''); onLinksChanged() }
    catch { addToast('Could not attach the document.', 'error') }
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
    } catch { addToast('Upload failed. Please try again.', 'error') }
    finally { setBusy(false) }
  }

  async function download(id: string) {
    try { const { url } = await processHierarchyApi.downloadArtifact(orgId, mapId, id); window.open(url, '_blank') }
    catch { addToast('Could not open the file.', 'error') }
  }

  async function unlink(linkId: string) {
    try { await processHierarchyApi.unlinkArtifact(orgId, mapId, nodeId, linkId); onLinksChanged() }
    catch { addToast('Could not remove the document.', 'error') }
  }

  const Row = ({ links, title }: { links: NodeDetail['inputs']; title: string }) => (
    <div>
      <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wide mb-1">{title}</p>
      {links.length === 0 ? <p className="text-[13px] text-[#64748B]">None</p> : (
        <div className="space-y-1">
          {links.map((l) => (
            <div key={l.id} className="flex items-center gap-2 text-[13px] bg-[#F8FAFC] border border-[#E2E8F0] rounded-[6px] px-2 py-1.5">
              <FileText size={13} className="text-[#2563EB] shrink-0" />
              <span className="flex-1 truncate text-[#0F172A]">{l.artifact.name}</span>
              {l.artifact.storage_key && (
                <button onClick={() => download(l.artifact.id)} aria-label="Download" className="text-[#475569] hover:text-[#2563EB] shrink-0"><Download size={13} /></button>
              )}
              {canEdit && <button onClick={() => unlink(l.id)} aria-label="Remove" className="text-[#94A3B8] hover:text-[#DC2626] shrink-0"><X size={13} /></button>}
            </div>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div className="space-y-3 border-t border-[#E2E8F0] pt-4">
      <p className="text-xs font-medium text-[#475569]">Documents</p>
      <Row links={node.inputs} title="Inputs (needed)" />
      <Row links={node.outputs} title="Outputs (produced)" />
      {canEdit && (
        <div className="space-y-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[8px] p-2.5">
          <div className="flex items-center gap-2">
            <div className="w-28 shrink-0">
              <StyledSelect value={dir} onChange={(v) => setDir(v as ProcessArtifactDirection)}
                options={[{ value: 'input', label: 'Input' }, { value: 'output', label: 'Output' }]} />
            </div>
            <div className="flex-1 min-w-0">
              <StyledSelect value={artifactId} onChange={setArtifactId}
                options={artifacts.map((a) => ({ value: a.id, label: a.name }))} placeholder="Select a document…" />
            </div>
            <button onClick={link} disabled={!artifactId || busy} aria-label="Attach document"
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
  const { addToast } = useToast()
  const [kind, setKind] = useState<ProcessAccessKind>('department')
  const [level, setLevel] = useState<ProcessAccessLevel>('view')
  const [entityId, setEntityId] = useState('')
  const [busy, setBusy] = useState(false)

  const options = useMemo(() => {
    if (kind === 'department') return departments.map((d) => ({ value: d.id, label: d.name }))
    if (kind === 'role') return roles.map((r) => ({ value: r.id, label: r.title }))
    return users.map((u) => ({ value: u.id, label: u.name }))
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
    } catch { addToast('Could not update sharing.', 'error') }
    finally { setBusy(false) }
  }

  async function remove(id: string) {
    try { await processHierarchyApi.removeAccess(orgId, mapId, nodeId, id); onChanged() }
    catch { addToast('Could not remove that rule.', 'error') }
  }

  return (
    <div className="space-y-3 border-t border-[#E2E8F0] pt-4">
      <p className="text-xs font-medium text-[#475569] flex items-center gap-1.5"><Shield size={12} /> Who can see / edit this (cascades to everything inside)</p>
      {node.access_rules.length === 0 ? (
        <p className="text-[13px] text-[#64748B]">No one attached here yet — this node inherits access from above.</p>
      ) : (
        <div className="space-y-1">
          {node.access_rules.map((r) => (
            <div key={r.id} className="flex items-center gap-2 text-[13px] bg-[#F8FAFC] border border-[#E2E8F0] rounded-[6px] px-2 py-1.5">
              <span className={`text-[10px] font-semibold rounded px-1.5 py-0.5 shrink-0 ${
                r.kind === 'exclude_user' ? 'bg-[#FEE2E2] text-[#DC2626]' : r.level === 'edit' ? 'bg-[#DCFCE7] text-[#16A34A]' : 'bg-[#E0F2FE] text-[#0369A1]'}`}>
                {r.kind === 'exclude_user' ? 'hidden' : r.level}
              </span>
              <span className="flex-1 truncate text-[#0F172A]">{r.label}</span>
              <span className="text-[11px] text-[#64748B] capitalize shrink-0">{r.kind === 'exclude_user' ? 'person' : r.kind}</span>
              <button onClick={() => remove(r.id)} aria-label="Remove rule" className="text-[#94A3B8] hover:text-[#DC2626] shrink-0"><X size={13} /></button>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[8px] p-2.5 flex-wrap">
        <div className="w-40">
          <StyledSelect value={kind} onChange={(v) => { setKind(v as ProcessAccessKind); setEntityId('') }}
            options={[
              { value: 'department', label: 'Department' },
              { value: 'role', label: 'Role' },
              { value: 'user', label: 'Person' },
              { value: 'exclude_user', label: 'Hide from person' },
            ]} />
        </div>
        {kind !== 'exclude_user' && (
          <div className="w-28">
            <StyledSelect value={level} onChange={(v) => setLevel(v as ProcessAccessLevel)}
              options={[{ value: 'view', label: 'Can view' }, { value: 'edit', label: 'Can edit' }]} />
          </div>
        )}
        <div className="flex-1 min-w-[120px]">
          <StyledSelect value={entityId} onChange={setEntityId} options={options} placeholder="Select…" />
        </div>
        <button onClick={add} disabled={!entityId || busy} aria-label="Add sharing rule"
          className="shrink-0 w-8 h-8 rounded-[8px] bg-[#2563EB] text-white flex items-center justify-center hover:bg-[#1D4ED8] disabled:bg-[#E2E8F0] disabled:text-[#94A3B8]"><Plus size={15} /></button>
      </div>
      <p className="text-[11px] text-[#64748B]">Attaching a department automatically covers its roles and people. Use “Hide from person” to remove someone who’s otherwise included.</p>
    </div>
  )
}
