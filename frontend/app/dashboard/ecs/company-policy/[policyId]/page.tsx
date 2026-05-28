'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Plus, Pencil, Trash2, Users, Loader2,
  Play, FileText, Link2, BookOpen, X, Check,
} from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import {
  getPolicy, publishPolicy, archivePolicy, deletePolicy,
  addItem, updateItem, deleteItem,
  assignPolicy, getAssignments,
} from '@/lib/api/company-policy'
import { getEmployees } from '@/lib/api/employees'
import type { CompanyPolicy, CompanyPolicyItem, CompanyPolicyAssignment, PolicyContentType, PolicyStatus } from '@/lib/types/company-policy'
import type { EmployeeProfile } from '@/lib/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<PolicyStatus, { bg: string; text: string; label: string }> = {
  draft:     { bg: 'bg-[#FEF9C3]', text: 'text-[#CA8A04]', label: 'Draft' },
  published: { bg: 'bg-[#DCFCE7]', text: 'text-[#16A34A]', label: 'Published' },
  archived:  { bg: 'bg-[#F1F5F9]', text: 'text-[#64748B]', label: 'Archived' },
}

const TYPE_ICONS: Record<PolicyContentType, React.ElementType> = {
  video: Play, document: FileText, url: Link2, article: BookOpen,
}

const TYPE_LABELS: Record<PolicyContentType, string> = {
  video: 'Video', document: 'Document', url: 'URL', article: 'Article',
}

const TYPE_COLORS: Record<PolicyContentType, string> = {
  video: 'bg-[#FEE2E2] text-[#DC2626]',
  document: 'bg-[#FEF9C3] text-[#CA8A04]',
  url: 'bg-[#DBEAFE] text-[#2563EB]',
  article: 'bg-[#DCFCE7] text-[#16A34A]',
}

const ASSIGN_STATUS: Record<string, { bg: string; text: string; label: string }> = {
  not_started: { bg: 'bg-[#F1F5F9]', text: 'text-[#64748B]', label: 'Not Started' },
  acknowledged: { bg: 'bg-[#DCFCE7]', text: 'text-[#16A34A]', label: 'Acknowledged' },
}

function StatusBadge({ status }: { status: PolicyStatus }) {
  const cfg = STATUS_CONFIG[status]
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>
}

function TypeBadge({ type }: { type: PolicyContentType }) {
  const Icon = TYPE_ICONS[type]
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${TYPE_COLORS[type]}`}>
      <Icon size={10} />
      {TYPE_LABELS[type]}
    </span>
  )
}

// ─── Item Modal ───────────────────────────────────────────────────────────────

interface ItemModalProps {
  policyId: string
  editing: CompanyPolicyItem | null
  onClose: () => void
  onSaved: (item: CompanyPolicyItem) => void
  orgId: string
}

function ItemModal({ policyId, editing, onClose, onSaved, orgId }: ItemModalProps) {
  const [form, setForm] = useState({
    title: editing?.title ?? '',
    content_type: (editing?.content_type ?? 'article') as PolicyContentType,
    content_url: editing?.content_url ?? '',
    content_body: editing?.content_body ?? '',
    description: editing?.description ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSave() {
    if (!form.title.trim()) { setError('Title is required'); return }
    setSaving(true)
    setError('')
    try {
      const payload: any = {
        title: form.title.trim(),
        content_type: form.content_type,
        description: form.description.trim() || undefined,
      }
      if (form.content_type === 'article') {
        payload.content_body = form.content_body.trim() || undefined
      } else {
        payload.content_url = form.content_url.trim() || undefined
      }
      const saved = editing
        ? await updateItem(orgId, policyId, editing.id, payload)
        : await addItem(orgId, policyId, payload)
      onSaved(saved)
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to save item')
    } finally {
      setSaving(false)
    }
  }

  const inputClass = 'w-full px-3 py-2.5 border border-[#CBD5E1] rounded-[8px] text-sm text-[#0F172A] placeholder:text-[#94A3B8] bg-white focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]'
  const labelClass = 'block text-sm font-medium text-[#374151] mb-1.5'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-[16px] w-full max-w-lg shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          <h2 className="text-[16px] font-bold text-[#0F172A]">{editing ? 'Edit Item' : 'Add Item'}</h2>
          <button onClick={onClose} className="p-1.5 text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F1F5F9] rounded-[6px] transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5 flex flex-col gap-4">
          {error && <div className="text-sm text-[#DC2626] bg-[#FEE2E2] border border-[#FECACA] rounded-[8px] px-4 py-3">{error}</div>}

          <div>
            <label className={labelClass}>Title <span className="text-[#DC2626]">*</span></label>
            <input type="text" value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Item title" className={inputClass} />
          </div>

          <div>
            <label className={labelClass}>Content Type</label>
            <div className="grid grid-cols-2 gap-2">
              {(['article', 'video', 'document', 'url'] as PolicyContentType[]).map((type) => {
                const Icon = TYPE_ICONS[type]
                const active = form.content_type === type
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => set('content_type', type)}
                    className={['flex items-center gap-2 px-3 py-2.5 rounded-[8px] border-2 text-sm font-medium transition-all', active ? 'border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]' : 'border-[#E2E8F0] text-[#475569] hover:border-[#CBD5E1]'].join(' ')}
                  >
                    <Icon size={15} />
                    {TYPE_LABELS[type]}
                  </button>
                )
              })}
            </div>
          </div>

          {form.content_type === 'article' ? (
            <div>
              <label className={labelClass}>Article Content</label>
              <textarea
                value={form.content_body}
                onChange={(e) => set('content_body', e.target.value)}
                placeholder="Write article content here…"
                rows={5}
                className={`${inputClass} resize-none`}
              />
            </div>
          ) : (
            <div>
              <label className={labelClass}>{TYPE_LABELS[form.content_type]} URL</label>
              <input type="url" value={form.content_url} onChange={(e) => set('content_url', e.target.value)} placeholder="https://" className={inputClass} />
            </div>
          )}

          <div>
            <label className={labelClass}>Description <span className="text-[#94A3B8] font-normal">(optional)</span></label>
            <textarea value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Short description…" rows={2} className={`${inputClass} resize-none`} />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#E2E8F0]">
          <button onClick={onClose} className="px-4 py-2.5 text-sm font-semibold text-[#475569] hover:text-[#0F172A] transition-colors">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-[8px] transition-colors disabled:bg-[#E2E8F0] disabled:text-[#94A3B8] disabled:cursor-not-allowed"
          >
            {saving && <Loader2 size={15} className="animate-spin" />}
            {editing ? 'Save Changes' : 'Add Item'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Assign Modal ─────────────────────────────────────────────────────────────

function AssignModal({ policyId, orgId, onClose, onAssigned }: { policyId: string; orgId: string; onClose: () => void; onAssigned: () => void }) {
  const [employees, setEmployees] = useState<EmployeeProfile[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [assigning, setAssigning] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getEmployees(orgId).then(setEmployees).finally(() => setLoading(false))
  }, [orgId])

  function toggle(id: string) {
    setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id])
  }

  async function handleAssign() {
    if (!selected.length) return
    setAssigning(true)
    try {
      await assignPolicy(orgId, policyId, selected)
      onAssigned()
      onClose()
    } finally {
      setAssigning(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-[16px] w-full max-w-md shadow-xl flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
          <h2 className="text-[16px] font-bold text-[#0F172A]">Assign Employees</h2>
          <button onClick={onClose} className="p-1.5 text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F1F5F9] rounded-[6px] transition-colors"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" /></div>
          ) : employees.length === 0 ? (
            <p className="text-sm text-[#94A3B8] text-center py-8">No employees found</p>
          ) : (
            employees.map((emp) => {
              const checked = selected.includes(emp.id)
              const name = emp.user?.name ?? 'Unknown'
              return (
                <button
                  key={emp.id}
                  onClick={() => toggle(emp.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[8px] hover:bg-[#F8FAFC] transition-colors text-left"
                >
                  <div className={['w-5 h-5 rounded-[4px] border-2 flex items-center justify-center shrink-0 transition-colors', checked ? 'bg-[#2563EB] border-[#2563EB]' : 'border-[#CBD5E1]'].join(' ')}>
                    {checked && <Check size={11} className="text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#0F172A] truncate">{name}</p>
                    <p className="text-xs text-[#64748B] truncate">{emp.role?.title ?? ''}</p>
                  </div>
                </button>
              )
            })
          )}
        </div>
        <div className="px-6 py-4 border-t border-[#E2E8F0] flex items-center justify-between">
          <p className="text-sm text-[#64748B]">{selected.length} selected</p>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-[#475569] hover:text-[#0F172A] transition-colors">Cancel</button>
            <button
              onClick={handleAssign}
              disabled={!selected.length || assigning}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-[8px] transition-colors disabled:bg-[#E2E8F0] disabled:text-[#94A3B8] disabled:cursor-not-allowed"
            >
              {assigning && <Loader2 size={13} className="animate-spin" />}
              Assign
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ManagePolicyPage() {
  const { policyId } = useParams<{ policyId: string }>()
  const { user } = useAuth()
  const router = useRouter()
  const orgId = user?.organizationId ?? ''
  const isAdminOrHR = user?.role === 'org_admin' || user?.role === 'hr_manager'

  const [policy, setPolicy] = useState<CompanyPolicy | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'items' | 'assignments'>('items')
  const [assignments, setAssignments] = useState<CompanyPolicyAssignment[]>([])
  const [assignmentsLoaded, setAssignmentsLoaded] = useState(false)

  const [showItemModal, setShowItemModal] = useState(false)
  const [editingItem, setEditingItem] = useState<CompanyPolicyItem | null>(null)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [publishing, setPublishing] = useState(false)

  useEffect(() => {
    if (!orgId || !policyId) return
    getPolicy(orgId, policyId).then(setPolicy).finally(() => setLoading(false))
  }, [orgId, policyId])

  useEffect(() => {
    if (tab === 'assignments' && !assignmentsLoaded && orgId && policyId) {
      getAssignments(orgId, policyId).then((a) => { setAssignments(a); setAssignmentsLoaded(true) })
    }
  }, [tab, assignmentsLoaded, orgId, policyId])

  async function handlePublish() {
    if (!policy) return
    setPublishing(true)
    try { setPolicy(await publishPolicy(orgId, policyId)) } finally { setPublishing(false) }
  }

  async function handleArchive() {
    if (!policy) return
    setPolicy(await archivePolicy(orgId, policyId))
  }

  async function handleDelete() {
    if (!window.confirm('Delete this policy? This cannot be undone.')) return
    await deletePolicy(orgId, policyId)
    router.push('/dashboard/ecs/company-policy')
  }

  function handleItemSaved(item: CompanyPolicyItem) {
    setPolicy((p) => {
      if (!p) return p
      const items = editingItem
        ? (p.items ?? []).map((i) => i.id === item.id ? item : i)
        : [...(p.items ?? []), item]
      return { ...p, items }
    })
    setShowItemModal(false)
    setEditingItem(null)
  }

  async function handleDeleteItem(itemId: string) {
    if (!window.confirm('Remove this item?')) return
    await deleteItem(orgId, policyId, itemId)
    setPolicy((p) => p ? { ...p, items: (p.items ?? []).filter((i) => i.id !== itemId) } : p)
  }

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" /></div>
  if (!policy) return <div className="text-center py-20 text-[#475569]">Policy not found</div>

  return (
    <div className="max-w-4xl mx-auto">
      {/* Back */}
      <Link href="/dashboard/ecs/company-policy" className="inline-flex items-center gap-1.5 text-sm text-[#475569] hover:text-[#2563EB] mb-5 transition-colors">
        <ArrowLeft size={15} />
        Company Policy
      </Link>

      {/* Header card */}
      <div className="bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-6 mb-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
              <StatusBadge status={policy.status} />
            </div>
            <h1 className="text-[22px] font-bold text-[#0F172A] leading-snug">{policy.title}</h1>
            {policy.description && <p className="text-[14px] text-[#475569] mt-1.5 leading-relaxed">{policy.description}</p>}
          </div>

          {isAdminOrHR && (
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <Link
                href={`/dashboard/ecs/company-policy/${policyId}/edit`}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-[#475569] bg-white border border-[#E2E8F0] rounded-[8px] hover:border-[#2563EB] hover:text-[#2563EB] transition-colors"
              >
                <Pencil size={14} /> Edit
              </Link>
              {policy.status === 'draft' && (
                <button
                  onClick={handlePublish}
                  disabled={publishing || !(policy.items?.length)}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-white bg-[#16A34A] hover:bg-[#15803D] rounded-[8px] transition-colors disabled:bg-[#E2E8F0] disabled:text-[#94A3B8] disabled:cursor-not-allowed"
                >
                  {publishing && <Loader2 size={13} className="animate-spin" />}
                  Publish
                </button>
              )}
              {policy.status === 'published' && (
                <button onClick={handleArchive} className="px-3 py-2 text-sm font-semibold text-[#D97706] bg-[#FFFBEB] border border-[#FDE68A] rounded-[8px] hover:bg-[#FEF3C7] transition-colors">
                  Archive
                </button>
              )}
              <button onClick={handleDelete} className="p-2 text-[#DC2626] bg-white border border-[#E2E8F0] rounded-[8px] hover:bg-[#FEE2E2] hover:border-[#FECACA] transition-colors">
                <Trash2 size={15} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#E2E8F0] mb-6 gap-0">
        {(['items', 'assignments'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={['px-5 py-2.5 text-sm font-semibold capitalize border-b-2 transition-colors', tab === t ? 'border-[#2563EB] text-[#2563EB]' : 'border-transparent text-[#475569] hover:text-[#0F172A]'].join(' ')}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Items tab */}
      {tab === 'items' && (
        <div>
          {isAdminOrHR && (
            <div className="flex justify-end mb-4">
              <button
                onClick={() => { setEditingItem(null); setShowItemModal(true) }}
                className="flex items-center gap-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold px-4 py-2.5 rounded-[8px] transition-colors"
              >
                <Plus size={15} /> Add Item
              </button>
            </div>
          )}

          {!policy.items?.length ? (
            <div className="text-center py-16 bg-white border border-[#E2E8F0] rounded-[12px]">
              <FileText size={28} className="text-[#CBD5E1] mx-auto mb-3" />
              <p className="text-sm font-semibold text-[#0F172A]">No items yet</p>
              <p className="text-xs text-[#475569] mt-1">Add articles, videos, documents or links to this policy.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {policy.items.map((item, idx) => {
                const Icon = TYPE_ICONS[item.content_type]
                return (
                  <div key={item.id} className="bg-white border border-[#E2E8F0] rounded-[10px] px-4 py-3.5 flex items-center gap-4 hover:border-[#CBD5E1] transition-colors">
                    <span className="text-[12px] font-bold text-[#94A3B8] w-5 text-right shrink-0">{idx + 1}</span>
                    <div className={['w-8 h-8 rounded-[6px] flex items-center justify-center shrink-0', TYPE_COLORS[item.content_type].split(' ')[0]].join(' ')}>
                      <Icon size={15} className={TYPE_COLORS[item.content_type].split(' ')[1]} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-[#0F172A] truncate">{item.title}</p>
                      {item.description && <p className="text-[12px] text-[#475569] truncate">{item.description}</p>}
                    </div>
                    <TypeBadge type={item.content_type} />
                    {isAdminOrHR && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => { setEditingItem(item); setShowItemModal(true) }} className="p-1.5 text-[#94A3B8] hover:text-[#2563EB] hover:bg-[#EFF6FF] rounded-[6px] transition-colors"><Pencil size={14} /></button>
                        <button onClick={() => handleDeleteItem(item.id)} className="p-1.5 text-[#94A3B8] hover:text-[#DC2626] hover:bg-[#FEE2E2] rounded-[6px] transition-colors"><Trash2 size={14} /></button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Assignments tab */}
      {tab === 'assignments' && (
        <div>
          {isAdminOrHR && policy.status === 'published' && (
            <div className="flex justify-end mb-4">
              <button
                onClick={() => setShowAssignModal(true)}
                className="flex items-center gap-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold px-4 py-2.5 rounded-[8px] transition-colors"
              >
                <Users size={15} /> Assign Employees
              </button>
            </div>
          )}

          {!assignmentsLoaded ? (
            <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" /></div>
          ) : assignments.length === 0 ? (
            <div className="text-center py-16 bg-white border border-[#E2E8F0] rounded-[12px]">
              <Users size={28} className="text-[#CBD5E1] mx-auto mb-3" />
              <p className="text-sm font-semibold text-[#0F172A]">No assignments yet</p>
              <p className="text-xs text-[#475569] mt-1">
                {policy.status !== 'published' ? 'Publish this policy first to assign it to employees.' : 'Assign this policy to employees.'}
              </p>
            </div>
          ) : (
            <div className="bg-white border border-[#E2E8F0] rounded-[12px] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    {['Employee', 'Role', 'Status', 'Assigned On'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-[#475569] uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {assignments.map((a) => {
                    const cfg = ASSIGN_STATUS[a.status] ?? ASSIGN_STATUS.not_started
                    return (
                      <tr key={a.id}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-[#0F172A]">{a.employee_profile?.user.name ?? '—'}</p>
                          <p className="text-xs text-[#64748B]">{a.employee_profile?.user.email ?? ''}</p>
                        </td>
                        <td className="px-4 py-3 text-[#475569]">{a.employee_profile?.role?.title ?? '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>
                        </td>
                        <td className="px-4 py-3 text-[#475569] text-xs">{new Date(a.assigned_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showItemModal && (
        <ItemModal
          policyId={policyId}
          orgId={orgId}
          editing={editingItem}
          onClose={() => { setShowItemModal(false); setEditingItem(null) }}
          onSaved={handleItemSaved}
        />
      )}
      {showAssignModal && (
        <AssignModal
          policyId={policyId}
          orgId={orgId}
          onClose={() => setShowAssignModal(false)}
          onAssigned={() => { setAssignmentsLoaded(false); setTab('assignments') }}
        />
      )}
    </div>
  )
}
