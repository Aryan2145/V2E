'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Pencil, ArrowRight, X, Check } from 'lucide-react'
import {
  getCultureStandards,
  createCultureStandard,
  updateCultureStandard,
  deleteCultureStandard,
} from '@/lib/api/culture'
import { useAuth } from '@/lib/auth/context'
import Button from '@/components/ui/Button'
import type { CultureStandard, BehaviorType } from '@/lib/types'

// ─── Inline add / edit form ────────────────────────────────────────────────────

interface InlineFormProps {
  type: BehaviorType
  initial?: { title: string; description: string }
  onSave: (title: string, description: string) => Promise<void>
  onCancel: () => void
}

function InlineForm({ type, initial, onSave, onCancel }: InlineFormProps) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isExpected = type === 'expected_behavior'
  const accentBorder = isExpected ? 'focus:border-[#16A34A]' : 'focus:border-[#DC2626]'

  const inputCls = `w-full rounded-[8px] border border-[#CBD5E1] bg-white px-3 py-[10px] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-2 ${accentBorder} transition-colors`
  const textareaCls = `w-full rounded-[8px] border border-[#CBD5E1] bg-white px-3 py-2.5 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-2 ${accentBorder} transition-colors resize-none`

  const handleSave = async () => {
    if (!title.trim()) { setError('Title is required'); return }
    if (!description.trim()) { setError('Description is required'); return }
    setSaving(true)
    setError(null)
    try {
      await onSave(title.trim(), description.trim())
    } catch (err: unknown) {
      // Surface the server's validation message (class-validator returns an array)
      // so the user sees the real reason instead of a generic failure.
      const raw = (err as { response?: { data?: { message?: string | string[] } } })
        ?.response?.data?.message
      setError(
        Array.isArray(raw) ? raw[0] : raw ?? 'Failed to save. Please try again.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[10px] p-4 flex flex-col gap-3 mt-2">
      <div>
        <label className="text-xs font-semibold text-[#374151] mb-1 block">
          Title <span className="text-[#DC2626]">*</span>
        </label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Proactive Communication"
          className={inputCls}
          autoFocus
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-[#374151] mb-1 block">
          Description <span className="text-[#DC2626]">*</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="Describe this standard in detail…"
          className={textareaCls}
        />
      </div>
      {error && <p className="text-xs text-[#DC2626]">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[7px] bg-[#2563EB] text-white text-xs font-semibold hover:bg-[#1D4ED8] disabled:opacity-60 transition-colors"
        >
          {saving ? (
            <div className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Check size={13} />
          )}
          Save
        </button>
        <button
          onClick={onCancel}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[7px] border border-[#CBD5E1] text-[#475569] text-xs font-semibold hover:bg-[#F1F5F9] transition-colors"
        >
          <X size={13} /> Cancel
        </button>
      </div>
    </div>
  )
}

// ─── Culture card ──────────────────────────────────────────────────────────────

interface CultureCardProps {
  standard: CultureStandard
  onEdit: () => void
  onDelete: () => void
}

function CultureCard({ standard, onEdit, onDelete }: CultureCardProps) {
  return (
    <div className="group bg-white border border-[#E2E8F0] rounded-[10px] p-4 flex gap-3 transition-shadow hover:shadow-sm">
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-[#0F172A]">{standard.title}</p>
        {standard.description && (
          <p className="text-sm text-[#475569] mt-1 leading-relaxed">{standard.description}</p>
        )}
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          onClick={onEdit}
          className="w-7 h-7 rounded-[6px] flex items-center justify-center text-[#94A3B8] hover:text-[#2563EB] hover:bg-[#EFF6FF] transition-colors"
          aria-label="Edit"
        >
          <Pencil size={14} />
        </button>
        <button
          onClick={onDelete}
          className="w-7 h-7 rounded-[6px] flex items-center justify-center text-[#94A3B8] hover:text-[#DC2626] hover:bg-[#FEE2E2] transition-colors"
          aria-label="Delete"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}

// ─── Column panel ──────────────────────────────────────────────────────────────

interface ColumnProps {
  title: string
  type: BehaviorType
  items: CultureStandard[]
  orgId: string
  onRefresh: () => void
}

function CultureColumn({ title, type, items, orgId, onRefresh }: ColumnProps) {
  const isExpected = type === 'expected_behavior'
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const headerBg = isExpected ? 'bg-[#F0FDF4] border-[#BBF7D0]' : 'bg-[#FEF2F2] border-[#FECACA]'
  const headerText = isExpected ? 'text-[#16A34A]' : 'text-[#DC2626]'
  const dotColor = isExpected ? 'bg-[#16A34A]' : 'bg-[#DC2626]'

  const handleAdd = async (title: string, description: string) => {
    await createCultureStandard(orgId, { title, description, type })
    setShowForm(false)
    onRefresh()
  }

  const handleEdit = async (id: string, title: string, description: string) => {
    await updateCultureStandard(orgId, id, { title, description })
    setEditingId(null)
    onRefresh()
  }

  const handleDelete = async (id: string) => {
    await deleteCultureStandard(orgId, id)
    setConfirmDeleteId(null)
    onRefresh()
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Header */}
      <div className={`rounded-t-[12px] border border-b-0 px-4 py-3 flex items-center gap-2 ${headerBg}`}>
        <div className={`w-2 h-2 rounded-full ${dotColor}`} />
        <h3 className={`font-bold text-sm ${headerText}`}>{title}</h3>
        <span className="ml-auto text-xs text-[#94A3B8]">{items.length}</span>
      </div>

      {/* Cards area */}
      <div className="border border-[#E2E8F0] rounded-b-[12px] bg-[#FAFAFA] p-3 flex flex-col gap-2 min-h-[200px]">
        {items.length === 0 && !showForm && (
          <div className="flex flex-col items-center gap-1 py-8">
            <p className="text-xs text-[#CBD5E1] text-center">No standards added yet.</p>
          </div>
        )}

        {items.map((item) =>
          editingId === item.id ? (
            <InlineForm
              key={item.id}
              type={type}
              initial={{ title: item.title, description: item.description }}
              onSave={(t, d) => handleEdit(item.id, t, d)}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <div key={item.id}>
              {confirmDeleteId === item.id ? (
                <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-[10px] p-3 flex items-center justify-between gap-3">
                  <p className="text-xs text-[#7F1D1D]">Delete "{item.title}"?</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="px-2.5 py-1 rounded-[6px] bg-[#DC2626] text-white text-xs font-semibold hover:bg-[#B91C1C]"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="px-2.5 py-1 rounded-[6px] border border-[#CBD5E1] text-xs font-semibold"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <CultureCard
                  standard={item}
                  onEdit={() => setEditingId(item.id)}
                  onDelete={() => setConfirmDeleteId(item.id)}
                />
              )}
            </div>
          )
        )}

        {showForm && (
          <InlineForm
            type={type}
            onSave={handleAdd}
            onCancel={() => setShowForm(false)}
          />
        )}

        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-[#475569] hover:text-[#0F172A] mt-1 transition-colors"
          >
            <Plus size={15} />
            Add Standard
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Step2CulturePage() {
  const { user } = useAuth()
  const router = useRouter()
  const orgId = user?.organizationId ?? ''

  const [standards, setStandards] = useState<CultureStandard[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const loadStandards = async () => {
    if (!orgId) return
    try {
      const data = await getCultureStandards(orgId)
      setStandards(data)
    } catch {
      // ignore
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadStandards()
  }, [orgId])

  const expected = standards.filter((s) => s.type === 'expected_behavior')
  const unacceptable = standards.filter((s) => s.type === 'unacceptable_behavior')

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div>
        <p className="text-xs font-semibold text-[#2563EB] uppercase tracking-wider mb-1">Step 2 of 5</p>
        <h1 className="text-[26px] font-bold text-[#0F172A]">Culture & Behavioral Standards</h1>
        <p className="text-sm text-[#475569] mt-1">
          Define what behavior looks like in your organization — both what you champion and what you don't tolerate.
        </p>
      </div>

      {isLoading ? (
        <div className="flex gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="flex-1 h-48 rounded-[12px] bg-[#E2E8F0] animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="flex gap-4">
          <CultureColumn
            title="Expected Behaviors"
            type="expected_behavior"
            items={expected}
            orgId={orgId}
            onRefresh={loadStandards}
          />
          <CultureColumn
            title="Unacceptable Behaviors"
            type="unacceptable_behavior"
            items={unacceptable}
            orgId={orgId}
            onRefresh={loadStandards}
          />
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3 pt-2">
        <Button variant="secondary" onClick={() => router.push('/setup/step-1-identity')}>
          Back
        </Button>
        <Button variant="primary" onClick={() => router.push('/setup/step-3-org-chart')}>
          Continue
          <ArrowRight size={15} />
        </Button>
      </div>
    </div>
  )
}
