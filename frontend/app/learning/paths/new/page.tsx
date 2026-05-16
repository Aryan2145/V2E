'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import { createPath } from '@/lib/api/learning'
import type { SequentialMode } from '@/lib/types/learning'

export default function NewLearningPathPage() {
  const { user } = useAuth()
  const router = useRouter()
  const orgId = user?.organization_id ?? ''

  const [form, setForm] = useState({
    title: '',
    description: '',
    mode: 'free_form' as SequentialMode,
    estimated_minutes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function update(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) { setError('Title is required'); return }
    setSaving(true)
    setError('')
    try {
      const path = await createPath(orgId, {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        mode: form.mode,
        estimated_minutes: form.estimated_minutes ? parseInt(form.estimated_minutes) : undefined,
      })
      router.push(`/learning/paths/${path.id}`)
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to create path')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="px-8 py-8 max-w-2xl mx-auto">
      <Link
        href="/learning/paths"
        className="inline-flex items-center gap-1.5 text-sm text-[#475569] hover:text-[#2563EB] mb-6 transition-colors"
      >
        <ArrowLeft size={16} />
        Back to Paths
      </Link>

      <h1 className="text-[28px] font-bold text-[#0F172A] mb-6">Create Learning Path</h1>

      <form onSubmit={handleSubmit} className="bg-white border border-[#E2E8F0] rounded-[12px] p-6 flex flex-col gap-5">
        {error && (
          <div className="text-sm text-[#DC2626] bg-[#FEE2E2] border border-[#FECACA] rounded-[8px] px-4 py-3">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-[#374151] mb-1.5">
            Title <span className="text-[#DC2626]">*</span>
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => update('title', e.target.value)}
            placeholder="e.g. Onboarding for Sales Team"
            className="w-full px-3 py-2.5 border border-[#CBD5E1] rounded-[8px] text-sm text-[#0F172A] placeholder:text-[#94A3B8] bg-white focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#374151] mb-1.5">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            placeholder="What will learners achieve?"
            rows={3}
            className="w-full px-3 py-2.5 border border-[#CBD5E1] rounded-[8px] text-sm text-[#0F172A] placeholder:text-[#94A3B8] bg-white focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#374151] mb-1.5">Completion Mode</label>
          <div className="grid grid-cols-2 gap-3">
            {([
              { value: 'free_form', label: 'Free Form', desc: 'Complete items in any order' },
              { value: 'sequential', label: 'Sequential', desc: 'Items unlock one at a time' },
            ] as const).map(({ value, label, desc }) => (
              <button
                key={value}
                type="button"
                onClick={() => update('mode', value)}
                className={[
                  'text-left px-4 py-3 rounded-[8px] border-2 transition-all',
                  form.mode === value
                    ? 'border-[#2563EB] bg-[#EFF6FF]'
                    : 'border-[#E2E8F0] bg-white hover:border-[#CBD5E1]',
                ].join(' ')}
              >
                <div className={`text-sm font-semibold mb-0.5 ${form.mode === value ? 'text-[#2563EB]' : 'text-[#0F172A]'}`}>{label}</div>
                <div className="text-xs text-[#64748B]">{desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-[#374151] mb-1.5">Estimated Duration (minutes)</label>
          <input
            type="number"
            value={form.estimated_minutes}
            onChange={(e) => update('estimated_minutes', e.target.value)}
            placeholder="e.g. 60"
            min={1}
            className="w-full px-3 py-2.5 border border-[#CBD5E1] rounded-[8px] text-sm text-[#0F172A] placeholder:text-[#94A3B8] bg-white focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href="/learning/paths"
            className="px-4 py-2.5 text-sm font-semibold text-[#2563EB] bg-white border-2 border-[#2563EB] rounded-[8px] hover:bg-[#EFF6FF] transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-[8px] transition-colors disabled:bg-[#E2E8F0] disabled:text-[#94A3B8] disabled:cursor-not-allowed"
          >
            {saving && <Loader2 size={15} className="animate-spin" />}
            Create Path
          </button>
        </div>
      </form>
    </div>
  )
}
