'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Plus, Pencil, Trash2, CheckCircle, Globe,
  Lock, GripVertical, Users, Loader2, Play, FileText,
  Link2, BookOpen, Clock, MoreHorizontal
} from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import {
  getPath, publishPath, archivePath, deletePath,
  addItem, updateItem, deleteItem, getAssignments, assignPath,
} from '@/lib/api/learning'
import { getEmployees } from '@/lib/api/employees'
import type { LearningPath, LearningItem, ContentType, LearningPathAssignment } from '@/lib/types/learning'
import type { EmployeeProfile } from '@/lib/types'
import PathStatusBadge from '@/components/learning/PathStatusBadge'
import ItemTypeBadge from '@/components/learning/ItemTypeBadge'
import ProgressBar from '@/components/learning/ProgressBar'

type Tab = 'items' | 'assignments'

const TYPE_ICONS: Record<ContentType, any> = {
  video: Play,
  document: FileText,
  url: Link2,
  article: BookOpen,
}

export default function ManagePathPage() {
  const { pathId } = useParams<{ pathId: string }>()
  const { user } = useAuth()
  const router = useRouter()
  const orgId = user?.organizationId ?? ''

  const [path, setPath] = useState<LearningPath | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('items')
  const [assignments, setAssignments] = useState<LearningPathAssignment[]>([])
  const [assignmentsLoaded, setAssignmentsLoaded] = useState(false)

  // Item form
  const [showItemForm, setShowItemForm] = useState(false)
  const [editingItem, setEditingItem] = useState<LearningItem | null>(null)
  const [itemForm, setItemForm] = useState({ title: '', content_type: 'article' as ContentType, content_url: '', content_body: '', description: '', estimated_minutes: '' })
  const [savingItem, setSavingItem] = useState(false)

  // Assign modal
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [employees, setEmployees] = useState<EmployeeProfile[]>([])
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([])
  const [assigning, setAssigning] = useState(false)

  // Action loading
  const [publishing, setPublishing] = useState(false)

  useEffect(() => {
    if (!orgId || !pathId) return
    getPath(orgId, pathId).then(setPath).finally(() => setLoading(false))
  }, [orgId, pathId])

  useEffect(() => {
    if (tab === 'assignments' && !assignmentsLoaded && orgId && pathId) {
      getAssignments(orgId, pathId).then((a) => {
        setAssignments(a)
        setAssignmentsLoaded(true)
      })
    }
  }, [tab, assignmentsLoaded, orgId, pathId])

  async function handlePublish() {
    if (!path) return
    setPublishing(true)
    try {
      const updated = await publishPath(orgId, pathId)
      setPath(updated)
    } finally {
      setPublishing(false)
    }
  }

  async function handleArchive() {
    if (!path) return
    const updated = await archivePath(orgId, pathId)
    setPath(updated)
  }

  async function handleDelete() {
    if (!window.confirm('Delete this learning path? This cannot be undone.')) return
    await deletePath(orgId, pathId)
    router.push('/learning/paths')
  }

  function openAddItem() {
    setEditingItem(null)
    setItemForm({ title: '', content_type: 'article', content_url: '', content_body: '', description: '', estimated_minutes: '' })
    setShowItemForm(true)
  }

  function openEditItem(item: LearningItem) {
    setEditingItem(item)
    setItemForm({
      title: item.title,
      content_type: item.content_type,
      content_url: item.content_url ?? '',
      content_body: item.content_body ?? '',
      description: item.description ?? '',
      estimated_minutes: item.estimated_minutes?.toString() ?? '',
    })
    setShowItemForm(true)
  }

  async function handleSaveItem() {
    if (!itemForm.title.trim()) return
    setSavingItem(true)
    try {
      const payload: any = {
        title: itemForm.title.trim(),
        content_type: itemForm.content_type,
        description: itemForm.description || undefined,
        estimated_minutes: itemForm.estimated_minutes ? parseInt(itemForm.estimated_minutes) : undefined,
      }
      if (['video', 'url', 'document'].includes(itemForm.content_type)) {
        payload.content_url = itemForm.content_url || undefined
      }
      if (itemForm.content_type === 'article') {
        payload.content_body = itemForm.content_body || undefined
      }

      if (editingItem) {
        const updated = await updateItem(orgId, pathId, editingItem.id, payload)
        setPath((p) => p ? { ...p, items: p.items?.map((i) => i.id === updated.id ? updated : i) } : p)
      } else {
        const newItem = await addItem(orgId, pathId, payload)
        setPath((p) => p ? { ...p, items: [...(p.items ?? []), newItem] } : p)
      }
      setShowItemForm(false)
    } finally {
      setSavingItem(false)
    }
  }

  async function handleDeleteItem(itemId: string) {
    if (!window.confirm('Remove this item?')) return
    await deleteItem(orgId, pathId, itemId)
    setPath((p) => p ? { ...p, items: p.items?.filter((i) => i.id !== itemId) } : p)
  }

  async function openAssignModal() {
    const emps = await getEmployees(orgId)
    setEmployees(emps)
    setSelectedEmployees([])
    setShowAssignModal(true)
  }

  async function handleAssign() {
    if (selectedEmployees.length === 0) return
    setAssigning(true)
    try {
      await assignPath(orgId, pathId, selectedEmployees)
      setShowAssignModal(false)
      setAssignmentsLoaded(false)
      if (tab === 'assignments') {
        const a = await getAssignments(orgId, pathId)
        setAssignments(a)
        setAssignmentsLoaded(true)
      }
    } finally {
      setAssigning(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-56px)]">
        <div className="w-8 h-8 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!path) return null

  const items = path.items ?? []

  return (
    <div className="px-8 py-8 max-w-5xl mx-auto">
      <Link
        href="/learning/paths"
        className="inline-flex items-center gap-1.5 text-sm text-[#475569] hover:text-[#2563EB] mb-6 transition-colors"
      >
        <ArrowLeft size={16} />
        Back to Paths
      </Link>

      {/* Path Header */}
      <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <PathStatusBadge status={path.status} />
              <span className="text-xs text-[#94A3B8] capitalize">{path.mode.replace('_', ' ')}</span>
            </div>
            <h1 className="text-[22px] font-bold text-[#0F172A] mb-1">{path.title}</h1>
            {path.description && <p className="text-sm text-[#475569]">{path.description}</p>}
            <div className="flex items-center gap-4 mt-3 text-xs text-[#64748B]">
              <span className="flex items-center gap-1"><BookOpen size={12} />{items.length} items</span>
              {path.estimated_minutes && <span className="flex items-center gap-1"><Clock size={12} />{path.estimated_minutes}m est.</span>}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={`/learning/paths/${pathId}/edit`}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-[#475569] bg-white border border-[#E2E8F0] rounded-[8px] hover:border-[#2563EB] hover:text-[#2563EB] transition-colors"
            >
              <Pencil size={14} />
              Edit
            </Link>
            {path.status === 'draft' && (
              <button
                onClick={handlePublish}
                disabled={publishing || items.length === 0}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-white bg-[#16A34A] hover:bg-[#15803D] rounded-[8px] transition-colors disabled:bg-[#E2E8F0] disabled:text-[#94A3B8] disabled:cursor-not-allowed"
              >
                {publishing ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                Publish
              </button>
            )}
            {path.status === 'published' && (
              <button
                onClick={openAssignModal}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-[8px] transition-colors"
              >
                <Users size={14} />
                Assign
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-[#E2E8F0]">
        {(['items', 'assignments'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={[
              'px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px',
              tab === t
                ? 'border-[#2563EB] text-[#2563EB]'
                : 'border-transparent text-[#475569] hover:text-[#0F172A]',
            ].join(' ')}
          >
            {t}
            {t === 'assignments' && assignmentsLoaded && (
              <span className="ml-1.5 text-xs bg-[#F1F5F9] text-[#64748B] px-1.5 py-0.5 rounded-full">
                {assignments.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Items Tab */}
      {tab === 'items' && (
        <div>
          {items.length === 0 ? (
            <div className="bg-white border border-dashed border-[#CBD5E1] rounded-[12px] py-14 flex flex-col items-center text-center">
              <BookOpen size={28} className="text-[#94A3B8] mb-3" />
              <p className="text-sm font-medium text-[#0F172A] mb-1">No items yet</p>
              <p className="text-xs text-[#64748B] mb-4">Add videos, documents, articles, or URLs</p>
              <button
                onClick={openAddItem}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-[8px] transition-colors"
              >
                <Plus size={15} />
                Add Item
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {items.map((item, idx) => {
                const TypeIcon = TYPE_ICONS[item.content_type] ?? BookOpen
                return (
                  <div
                    key={item.id}
                    className="bg-white border border-[#E2E8F0] rounded-[10px] px-4 py-3.5 flex items-center gap-3"
                  >
                    <span className="text-xs text-[#94A3B8] w-5 text-center shrink-0">{idx + 1}</span>
                    <div className="w-8 h-8 rounded-[8px] bg-[#F8FAFC] flex items-center justify-center shrink-0">
                      <TypeIcon size={15} className="text-[#64748B]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[#0F172A] truncate">{item.title}</span>
                        <ItemTypeBadge type={item.content_type} />
                      </div>
                      {item.description && (
                        <p className="text-xs text-[#64748B] truncate mt-0.5">{item.description}</p>
                      )}
                    </div>
                    {item.estimated_minutes && (
                      <span className="text-xs text-[#94A3B8] shrink-0">{item.estimated_minutes}m</span>
                    )}
                    <button
                      onClick={() => openEditItem(item)}
                      className="p-1.5 text-[#94A3B8] hover:text-[#2563EB] hover:bg-[#EFF6FF] rounded-[6px] transition-colors shrink-0"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="p-1.5 text-[#94A3B8] hover:text-[#DC2626] hover:bg-[#FEE2E2] rounded-[6px] transition-colors shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )
              })}

              <button
                onClick={openAddItem}
                className="flex items-center justify-center gap-2 py-3 text-sm font-medium text-[#2563EB] bg-[#EFF6FF] hover:bg-[#DBEAFE] border border-dashed border-[#2563EB]/40 rounded-[10px] transition-colors"
              >
                <Plus size={15} />
                Add Item
              </button>
            </div>
          )}
        </div>
      )}

      {/* Assignments Tab */}
      {tab === 'assignments' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-[#475569]">{assignments.length} employees assigned</p>
            {path.status === 'published' && (
              <button
                onClick={openAssignModal}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-[8px] transition-colors"
              >
                <Users size={14} />
                Assign Employees
              </button>
            )}
          </div>

          {assignments.length === 0 ? (
            <div className="bg-white border border-dashed border-[#CBD5E1] rounded-[12px] py-12 flex flex-col items-center text-center">
              <Users size={28} className="text-[#94A3B8] mb-3" />
              <p className="text-sm font-medium text-[#0F172A] mb-1">No assignments yet</p>
              <p className="text-xs text-[#64748B]">Publish this path and assign it to employees</p>
            </div>
          ) : (
            <div className="bg-white border border-[#E2E8F0] rounded-[12px] overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wider">Employee</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wider">Progress</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {assignments.map((a: any) => (
                    <tr key={a.id}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-[#0F172A]">{a.employee_profile?.user?.name}</div>
                        <div className="text-xs text-[#64748B]">{a.employee_profile?.role?.title}</div>
                      </td>
                      <td className="px-4 py-3">
                        <ProgressBar
                          percent={a.path_progress?.progress_percent ?? 0}
                          showLabel
                          size="sm"
                          className="max-w-[160px]"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <span className={[
                          'inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium',
                          a.status === 'completed' ? 'bg-[#DCFCE7] text-[#16A34A]' :
                            a.status === 'in_progress' ? 'bg-[#EFF6FF] text-[#2563EB]' :
                              'bg-[#F1F5F9] text-[#64748B]',
                        ].join(' ')}>
                          {a.status.replace('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Item Form Modal */}
      {showItemForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/40">
          <div className="bg-white rounded-[16px] w-full max-w-lg p-6 shadow-xl">
            <h2 className="text-lg font-bold text-[#0F172A] mb-5">
              {editingItem ? 'Edit Item' : 'Add Item'}
            </h2>

            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">Title *</label>
                <input
                  type="text"
                  value={itemForm.title}
                  onChange={(e) => setItemForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-[#CBD5E1] rounded-[8px] text-sm text-[#0F172A] bg-white focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">Content Type</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['article', 'video', 'document', 'url'] as ContentType[]).map((t) => {
                    const Icon = TYPE_ICONS[t]
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setItemForm((f) => ({ ...f, content_type: t }))}
                        className={[
                          'flex flex-col items-center gap-1 py-2.5 rounded-[8px] border-2 text-xs font-medium capitalize transition-all',
                          itemForm.content_type === t
                            ? 'border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]'
                            : 'border-[#E2E8F0] text-[#64748B] hover:border-[#CBD5E1]',
                        ].join(' ')}
                      >
                        <Icon size={16} />
                        {t}
                      </button>
                    )
                  })}
                </div>
              </div>

              {['video', 'url', 'document'].includes(itemForm.content_type) && (
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1.5">URL</label>
                  <input
                    type="text"
                    value={itemForm.content_url}
                    onChange={(e) => setItemForm((f) => ({ ...f, content_url: e.target.value }))}
                    placeholder="https://"
                    className="w-full px-3 py-2.5 border border-[#CBD5E1] rounded-[8px] text-sm text-[#0F172A] bg-white focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]"
                  />
                </div>
              )}

              {itemForm.content_type === 'article' && (
                <div>
                  <label className="block text-sm font-medium text-[#374151] mb-1.5">Article Content</label>
                  <textarea
                    value={itemForm.content_body}
                    onChange={(e) => setItemForm((f) => ({ ...f, content_body: e.target.value }))}
                    rows={4}
                    className="w-full px-3 py-2.5 border border-[#CBD5E1] rounded-[8px] text-sm text-[#0F172A] bg-white focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] resize-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-[#374151] mb-1.5">Duration (minutes)</label>
                <input
                  type="number"
                  value={itemForm.estimated_minutes}
                  onChange={(e) => setItemForm((f) => ({ ...f, estimated_minutes: e.target.value }))}
                  min={1}
                  className="w-full px-3 py-2.5 border border-[#CBD5E1] rounded-[8px] text-sm text-[#0F172A] bg-white focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setShowItemForm(false)}
                className="px-4 py-2.5 text-sm font-semibold text-[#475569] hover:text-[#0F172A] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveItem}
                disabled={savingItem || !itemForm.title.trim()}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-[8px] transition-colors disabled:bg-[#E2E8F0] disabled:text-[#94A3B8] disabled:cursor-not-allowed"
              >
                {savingItem && <Loader2 size={15} className="animate-spin" />}
                {editingItem ? 'Save Changes' : 'Add Item'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/40">
          <div className="bg-white rounded-[16px] w-full max-w-md p-6 shadow-xl">
            <h2 className="text-lg font-bold text-[#0F172A] mb-1">Assign Learning Path</h2>
            <p className="text-sm text-[#475569] mb-4">Select employees to assign this path to</p>

            <div className="max-h-60 overflow-y-auto flex flex-col gap-1.5 mb-5">
              {employees.map((emp: any) => {
                const id = emp.id
                const checked = selectedEmployees.includes(id)
                return (
                  <label
                    key={id}
                    className={[
                      'flex items-center gap-3 px-3 py-2.5 rounded-[8px] cursor-pointer transition-colors',
                      checked ? 'bg-[#EFF6FF]' : 'hover:bg-[#F8FAFC]',
                    ].join(' ')}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) =>
                        setSelectedEmployees((prev) =>
                          e.target.checked ? [...prev, id] : prev.filter((x) => x !== id),
                        )
                      }
                      className="w-4 h-4 rounded border-[#CBD5E1] text-[#2563EB] focus:ring-[#2563EB]"
                    />
                    <div>
                      <div className="text-sm font-medium text-[#0F172A]">{emp.user?.name}</div>
                      <div className="text-xs text-[#64748B]">{emp.role?.title}</div>
                    </div>
                  </label>
                )
              })}
            </div>

            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setShowAssignModal(false)} className="px-4 py-2.5 text-sm font-semibold text-[#475569]">
                Cancel
              </button>
              <button
                onClick={handleAssign}
                disabled={assigning || selectedEmployees.length === 0}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-[8px] transition-colors disabled:bg-[#E2E8F0] disabled:text-[#94A3B8] disabled:cursor-not-allowed"
              >
                {assigning && <Loader2 size={15} className="animate-spin" />}
                Assign {selectedEmployees.length > 0 ? `(${selectedEmployees.length})` : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
