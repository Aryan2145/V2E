'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import { getPolicy, updatePolicy } from '@/lib/api/company-policy'

export default function EditPolicyPage() {
  const { policyId } = useParams<{ policyId: string }>()
  const { user } = useAuth()
  const router = useRouter()
  const orgId = user?.organizationId ?? ''

  const [form, setForm] = useState({ title: '', description: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!orgId || !policyId) return
    getPolicy(orgId, policyId).then((p) => {
      setForm({ title: p.title, description: p.description ?? '' })
    }).finally(() => setLoading(false))
  }, [orgId, policyId])

  function update(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) { setError('Title is required'); return }
    setSaving(true)
    setError('')
    try {
      await updatePolicy(orgId, policyId, {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
      })
      router.push(`/dashboard/ecs/company-policy/${policyId}`)
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  const inputClass = 'w-full px-3 py-2.5 border border-[#CBD5E1] rounded-[8px] text-sm text-[#0F172A] placeholder:text-[#94A3B8] bg-white focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]'
  const labelClass = 'block text-sm font-medium text-[#374151] mb-1.5'

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href={`/dashboard/ecs/company-policy/${policyId}`}
        className="inline-flex items-center gap-1.5 text-sm text-[#475569] hover:text-[#2563EB] mb-6 transition-colors"
      >
        <ArrowLeft size={16} />
        Back to Policy
      </Link>

      <h1 className="text-[28px] font-bold text-[#0F172A] mb-6">Edit Policy</h1>

      <form onSubmit={handleSubmit} className="bg-white border border-[#E2E8F0] rounded-[12px] p-6 flex flex-col gap-5">
        {error && (
          <div className="text-sm text-[#DC2626] bg-[#FEE2E2] border border-[#FECACA] rounded-[8px] px-4 py-3">
            {error}
          </div>
        )}

        <div>
          <label className={labelClass}>Title <span className="text-[#DC2626]">*</span></label>
          <input type="text" value={form.title} onChange={(e) => update('title', e.target.value)} placeholder="e.g. Code of Conduct" className={inputClass} />
        </div>

        <div>
          <label className={labelClass}>Description</label>
          <textarea value={form.description} onChange={(e) => update('description', e.target.value)} placeholder="Brief description of this policy…" rows={3} className={`${inputClass} resize-none`} />
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href={`/dashboard/ecs/company-policy/${policyId}`}
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
            Save Changes
          </button>
        </div>
      </form>
    </div>
  )
}
