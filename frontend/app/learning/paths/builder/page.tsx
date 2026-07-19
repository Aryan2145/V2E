'use client'

/**
 * One-screen course builder. Replaces the old create → save → add-material → save →
 * add-people multi-page flow: path details, materials (file OR link per row, with a
 * per-material "allow download" switch), and people are all here, ending in a single
 * "Publish & Assign". The draft path is created lazily on first real input and every
 * change autosaves, so nothing is lost between steps.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Loader2, CheckCircle, Users, BookOpen,
} from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import {
  createPath, updatePath, getPath, addItem, publishPath, assignPath, uploadItemFile,
} from '@/lib/api/learning'
import { getEmployees } from '@/lib/api/employees'
import { getRoles } from '@/lib/api/roles'
import type { LearningPath, LearningItem, ContentType, SequentialMode, LearningPathStatus } from '@/lib/types/learning'
import type { EmployeeProfile } from '@/lib/types'
import StyledSelect from '@/components/ui/StyledSelect'
import DatePicker from '@/components/ui/DatePicker'
import MaterialRow from '@/components/learning/MaterialRow'
import AddMaterialBar from '@/components/learning/AddMaterialBar'
import AssigneeMultiSelect from '@/components/learning/AssigneeMultiSelect'

export default function CourseBuilderPage() {
  const router = useRouter()
  const params = useSearchParams()
  const { user } = useAuth()
  const orgId = user?.organizationId ?? ''

  // The draft path id — created lazily. Seeded from ?id= when editing an existing draft.
  const [pathId, setPathId] = useState<string | null>(params.get('id'))
  const [items, setItems] = useState<LearningItem[]>([])
  const [loading, setLoading] = useState(!!params.get('id'))

  // Path detail fields
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [mode, setMode] = useState<SequentialMode>('free_form')
  const [status, setStatus] = useState<LearningPathStatus>('draft')

  // People / assignment
  const [roleId, setRoleId] = useState('')
  const [roles, setRoles] = useState<{ id: string; title: string }[]>([])
  const [employees, setEmployees] = useState<EmployeeProfile[]>([])
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([])
  const [dueDate, setDueDate] = useState('')

  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Load existing draft (edit mode) + reference data ──
  useEffect(() => {
    if (!orgId) return
    getEmployees(orgId).then(setEmployees).catch(() => undefined)
    getRoles(orgId).then((r: any[]) => setRoles(r.map((x) => ({ id: x.id, title: x.title })))).catch(() => undefined)
  }, [orgId])

  useEffect(() => {
    const id = params.get('id')
    if (!orgId || !id) return
    getPath(orgId, id)
      .then((p) => {
        setTitle(p.title)
        setDescription(p.description ?? '')
        setMode(p.mode)
        setRoleId(p.role_id ?? '')
        setItems(p.items ?? [])
        setStatus(p.status)
      })
      .finally(() => setLoading(false))
  }, [orgId, params])

  /** Create the draft path on first need (adding a material), or return the existing id. */
  const ensurePath = useCallback(async (): Promise<string> => {
    if (pathId) return pathId
    const created = await createPath(orgId, {
      title: title.trim() || 'Untitled course',
      description: description || undefined,
      mode,
    })
    setPathId(created.id)
    // Reflect the id in the URL so a refresh keeps editing the same draft.
    // scroll:false — App Router otherwise jumps to the top the moment the draft
    // is created (i.e. as you add your first material), which reads as "the form
    // scrolled away while I was working".
    router.replace(`/learning/paths/builder?id=${created.id}`, { scroll: false })
    return created.id
  }, [pathId, orgId, title, description, mode, router])

  // ── Autosave path fields (debounced) once a draft exists ──
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!pathId) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSaveState('saving')
    saveTimer.current = setTimeout(async () => {
      try {
        await updatePath(orgId, pathId, {
          title: title.trim() || 'Untitled course',
          description: description || undefined,
          mode,
          role_id: roleId || undefined,
        })
        setSaveState('saved')
      } catch {
        setSaveState('idle')
      }
    }, 700)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [title, description, mode, roleId, pathId, orgId])

  // ── Materials ──
  async function handleAddMaterial(type: ContentType, file?: File) {
    const pid = await ensurePath()
    // Sensible default title; file uploads inherit the filename server-side.
    const defaultTitle =
      type === 'file' ? (file?.name ?? 'New file') :
      type === 'url' ? 'New link' :
      type === 'video' ? 'New video' : 'New article'
    const created: LearningItem = await addItem(orgId, pid, {
      title: defaultTitle,
      content_type: type,
      allow_download: true,
    })
    setItems((prev) => [...prev, created])
    if (type === 'file' && file) {
      const uploaded = await uploadItemFile(orgId, pid, created.id, file, true)
      patchItem(uploaded)
    }
  }

  function patchItem(updated: LearningItem) {
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))
  }
  function removeItemLocal(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  const isPublished = status === 'published' || status === 'archived'

  async function handleFinish() {
    setError(null)
    if (!title.trim()) { setError('Give the course a title first.'); return }
    if (items.length === 0) { setError('Add at least one material first.'); return }
    setPublishing(true)
    try {
      const pid = await ensurePath()
      await updatePath(orgId, pid, {
        title: title.trim(),
        description: description || undefined,
        mode,
        role_id: roleId || undefined,
      })
      // Only publish a draft — an already-published course is edited in place.
      if (!isPublished) await publishPath(orgId, pid) // auto-assigns to role_id if set
      if (selectedEmployees.length > 0) {
        await assignPath(orgId, pid, selectedEmployees, dueDate || undefined)
      }
      router.push(`/learning/paths/${pid}`)
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Could not save the course. Please try again.')
      setPublishing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-56px)]">
        <div className="w-8 h-8 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const canPublish = !!title.trim() && items.length > 0 && !publishing

  return (
    <div className="px-4 sm:px-8 pb-10 max-w-4xl mx-auto">
      {/* Sticky top bar — keeps the title + Save action visible as you scroll the form */}
      <div className="sticky top-0 z-30 bg-white pt-6 pb-4 mb-6 border-b border-[#E2E8F0]">
        <Link
          href="/learning/paths"
          className="inline-flex items-center gap-1.5 text-sm text-[#475569] hover:text-[#2563EB] mb-3 transition-colors"
        >
          <ArrowLeft size={16} />
          Back to Courses
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-bold text-[#0F172A]">
              {params.get('id') ? 'Edit Course' : 'Create Course'}
            </h1>
            <p className="text-sm text-[#475569] mt-1">
              Add materials and pick who learns — it all saves as you go.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs text-[#64748B] w-16 text-right">
              {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved ✓' : ''}
            </span>
            <button
              onClick={handleFinish}
              disabled={!canPublish}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-[8px] transition-colors disabled:bg-[#E2E8F0] disabled:text-[#94A3B8] disabled:cursor-not-allowed"
            >
              {publishing ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
              {isPublished ? 'Save & Close' : 'Publish & Assign'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-3 rounded-[10px] border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B91C1C]">
            {error}
          </div>
        )}
      </div>

      {/* 1 — Details */}
      <section className="bg-white border border-[#E2E8F0] rounded-[12px] p-6 mb-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <h2 className="text-[18px] font-semibold text-[#0F172A] mb-4">Course details</h2>
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Title *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. New Joiner Onboarding"
              className="w-full px-3 py-2.5 border border-[#CBD5E1] rounded-[8px] text-[15px] text-[#0F172A] bg-white focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="What will people learn?"
              className="w-full px-3 py-2.5 border border-[#CBD5E1] rounded-[8px] text-[15px] text-[#0F172A] bg-white focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] resize-none"
            />
          </div>
          <div className="max-w-xs">
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Order</label>
            <StyledSelect
              value={mode}
              onChange={(v) => setMode(v as SequentialMode)}
              options={[
                { value: 'free_form', label: 'Any order — learners pick freely' },
                { value: 'sequential', label: 'In sequence — unlock one by one' },
              ]}
            />
          </div>
        </div>
      </section>

      {/* 2 — Materials */}
      <section className="bg-white border border-[#E2E8F0] rounded-[12px] p-6 mb-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-[18px] font-semibold text-[#0F172A]">Materials</h2>
          {items.length > 0 && (
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-[#2563EB] text-white text-[11px] font-semibold">
              {items.length}
            </span>
          )}
        </div>

        {items.length === 0 ? (
          <div className="rounded-[10px] border border-dashed border-[#CBD5E1] bg-[#F8FAFC] py-10 flex flex-col items-center text-center mb-4">
            <BookOpen size={26} className="text-[#94A3B8] mb-2" />
            <p className="text-sm font-medium text-[#0F172A]">No materials yet</p>
            <p className="text-xs text-[#64748B] mt-0.5">Upload a document, add a link, embed a video, or write an article.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 mb-4 max-h-[520px] overflow-y-auto pr-1">
            {items.map((item, idx) => (
              <MaterialRow
                key={item.id}
                orgId={orgId}
                pathId={pathId!}
                index={idx}
                item={item}
                onChange={patchItem}
                onRemove={removeItemLocal}
              />
            ))}
          </div>
        )}

        <AddMaterialBar onAdd={handleAddMaterial} />
      </section>

      {/* 3 — People */}
      <section className="bg-white border border-[#E2E8F0] rounded-[12px] p-6 mb-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <div className="flex items-center gap-2 mb-4">
          <Users size={18} className="text-[#2563EB]" />
          <h2 className="text-[18px] font-semibold text-[#0F172A]">Who learns this</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Auto-assign to a role</label>
            <StyledSelect
              value={roleId}
              onChange={setRoleId}
              placeholder="No role — pick people below"
              options={[
                { value: '', label: 'No role — pick people below' },
                ...roles.map((r) => ({ value: r.id, label: r.title })),
              ]}
            />
            <p className="text-xs text-[#64748B] mt-1">Everyone in this role gets it automatically, now and in future.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1.5">Due date (optional)</label>
            <DatePicker value={dueDate} onChange={setDueDate} placeholder="No deadline" />
          </div>
        </div>

        <label className="block text-sm font-medium text-[#374151] mb-1.5">Pick people</label>
        <AssigneeMultiSelect
          employees={employees}
          selected={selectedEmployees}
          onChange={setSelectedEmployees}
          heightClass="max-h-56"
        />
      </section>
    </div>
  )
}
