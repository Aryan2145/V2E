'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2, Save, ArrowRight } from 'lucide-react'
import { getOrgIdentity, upsertOrgIdentity } from '@/lib/api/org-identity'
import { useAuth } from '@/lib/auth/context'
import Button from '@/components/ui/Button'

// ─── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  philosophy: z.string().optional(),
  vision: z.string().optional(),
  mission: z.string().optional(),
  purpose: z.string().optional(),
  values: z
    .array(
      z.object({
        title: z.string().min(1, 'Value title required'),
        description: z.string().optional(),
      })
    )
    .default([]),
})

type FormValues = {
  philosophy?: string
  vision?: string
  mission?: string
  purpose?: string
  values: Array<{ title: string; description?: string }>
}

// ─── Shared field components ───────────────────────────────────────────────────

const labelCls = 'block text-sm font-semibold text-[#374151] mb-1.5'
const textareaCls =
  'w-full rounded-[8px] border border-[#CBD5E1] bg-white px-3 py-2.5 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-2 focus:border-[#2563EB] transition-colors resize-none'
const inputCls =
  'w-full rounded-[8px] border border-[#CBD5E1] bg-white px-3 py-[10px] text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-2 focus:border-[#2563EB] transition-colors'

function SectionHeading({ label, description }: { label: string; description?: string }) {
  return (
    <div className="mb-5 pb-4 border-b border-[#E2E8F0]">
      <h2 className="text-[17px] font-bold text-[#0F172A]">{label}</h2>
      {description && <p className="text-sm text-[#475569] mt-0.5">{description}</p>}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Step1IdentityPage() {
  const { user } = useAuth()
  const router = useRouter()
  const orgId = user?.organizationId ?? ''
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const autoSaveRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const {
    register,
    handleSubmit,
    control,
    getValues,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema) as any,
    defaultValues: { values: [] },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'values' })

  // Load existing data
  useEffect(() => {
    if (!orgId) return
    getOrgIdentity(orgId)
      .then((data) => {
        reset({
          philosophy: data.philosophy ?? '',
          vision: data.vision ?? '',
          mission: data.mission ?? '',
          purpose: data.purpose ?? '',
          values: data.values ?? [],
        })
      })
      .catch(() => {
        // No existing data — start fresh
      })
  }, [orgId, reset])

  // Auto-save every 30s
  useEffect(() => {
    if (!orgId) return
    autoSaveRef.current = setInterval(async () => {
      const values = getValues()
      try {
        setSaveStatus('saving')
        await upsertOrgIdentity(orgId, values)
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus('idle'), 2000)
      } catch {
        setSaveStatus('error')
      }
    }, 30_000)
    return () => {
      if (autoSaveRef.current) clearInterval(autoSaveRef.current)
    }
  }, [orgId, getValues])

  const onSubmit = async (data: FormValues) => {
    if (!orgId) return
    try {
      await upsertOrgIdentity(orgId, data)
      router.push('/setup/step-2-culture')
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-[#2563EB] uppercase tracking-wider mb-1">Step 1 of 5</p>
          <h1 className="text-[26px] font-bold text-[#0F172A]">Company Identity</h1>
          <p className="text-sm text-[#475569] mt-1">
            Define the foundational philosophy, vision, mission, and values that guide your organization.
          </p>
        </div>
        {saveStatus === 'saving' && <span className="text-xs text-[#94A3B8]">Auto-saving…</span>}
        {saveStatus === 'saved' && <span className="text-xs text-[#16A34A]">Saved</span>}
        {saveStatus === 'error' && <span className="text-xs text-[#DC2626]">Auto-save failed</span>}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        {/* Philosophy */}
        <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-6">
          <SectionHeading
            label="Core Pillars"
            description="Define the foundational statements that drive your organization."
          />
          <div className="grid grid-cols-1 gap-5">
            <div>
              <label className={labelCls}>Philosophy</label>
              <textarea
                {...register('philosophy')}
                rows={3}
                placeholder="What fundamental beliefs guide the way your organization operates?"
                className={textareaCls}
              />
            </div>
            <div>
              <label className={labelCls}>Vision</label>
              <textarea
                {...register('vision')}
                rows={3}
                placeholder="What future are you working toward?"
                className={textareaCls}
              />
            </div>
            <div>
              <label className={labelCls}>Mission</label>
              <textarea
                {...register('mission')}
                rows={3}
                placeholder="What does your organization do, for whom, and why?"
                className={textareaCls}
              />
            </div>
            <div>
              <label className={labelCls}>Purpose</label>
              <textarea
                {...register('purpose')}
                rows={3}
                placeholder="Beyond profit, why does your organization exist?"
                className={textareaCls}
              />
            </div>
          </div>
        </div>

        {/* Values */}
        <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-6">
          <SectionHeading
            label="Organizational Values"
            description="Add the core values that define your culture and decision-making."
          />

          <div className="flex flex-col gap-4">
            {fields.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-8 border-2 border-dashed border-[#E2E8F0] rounded-[10px]">
                <p className="text-sm text-[#94A3B8]">No values added yet.</p>
                <p className="text-xs text-[#CBD5E1]">Click "Add Value" to define your first organizational value.</p>
              </div>
            )}

            {fields.map((field, index) => (
              <div
                key={field.id}
                className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-[10px] p-4 flex gap-4"
              >
                <div className="w-8 h-8 rounded-full bg-[#2563EB] flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5">
                  {index + 1}
                </div>
                <div className="flex-1 flex flex-col gap-3">
                  <div>
                    <label className="text-xs font-semibold text-[#374151] mb-1 block">Value Title</label>
                    <input
                      {...register(`values.${index}.title`)}
                      placeholder="e.g. Integrity"
                      className={inputCls}
                    />
                    {errors.values?.[index]?.title && (
                      <p className="text-xs text-[#DC2626] mt-1">
                        {errors.values[index]?.title?.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[#374151] mb-1 block">Description</label>
                    <textarea
                      {...register(`values.${index}.description`)}
                      rows={2}
                      placeholder="What does this value mean in practice?"
                      className={textareaCls}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="text-[#94A3B8] hover:text-[#DC2626] transition-colors self-start mt-1 p-1 rounded-[6px] hover:bg-[#FEE2E2]"
                  aria-label="Remove value"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}

            <Button
              type="button"
              variant="secondary"
              onClick={() => append({ title: '', description: '' })}
            >
              <Plus size={16} />
              Add Value
            </Button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button type="submit" variant="primary" isLoading={isSubmitting}>
            Save & Continue
            <ArrowRight size={15} />
          </Button>
        </div>
      </form>
    </div>
  )
}
