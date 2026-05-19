'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, ChevronLeft } from 'lucide-react'
import { createOrganization } from '@/lib/api/organizations'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'

// ─── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  slug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'),
  industry: z.string().optional(),
  country: z.string().optional(),
  timezone: z.string().optional(),
  admin_name: z.string().min(2, 'Admin name is required'),
  admin_email: z.string().email('Enter a valid email'),
  admin_password: z.string().min(8, 'Password must be at least 8 characters').optional().or(z.literal('')),
})

type FormValues = z.infer<typeof schema>

// ─── Labeled input wrapper ────────────────────────────────────────────────────

function Field({
  label,
  error,
  required,
  hint,
  children,
}: {
  label: string
  error?: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-[#374151]">
        {label}
        {required && <span className="text-[#DC2626] ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-[#DC2626]">{error}</p>}
      {!error && hint && <p className="text-xs text-[#64748B]">{hint}</p>}
    </div>
  )
}

const inputCls = (hasError?: boolean) =>
  [
    'w-full rounded-[8px] bg-white px-3 py-[10px] text-sm text-[#0F172A] placeholder:text-[#94A3B8]',
    'focus:outline-none transition-colors',
    hasError
      ? 'border-2 border-[#DC2626]'
      : 'border border-[#CBD5E1] focus:border-2 focus:border-[#2563EB]',
  ].join(' ')

const selectCls = (hasError?: boolean) =>
  [
    'w-full rounded-[8px] bg-white px-3 py-[10px] text-sm text-[#0F172A]',
    'focus:outline-none transition-colors',
    hasError
      ? 'border-2 border-[#DC2626]'
      : 'border border-[#CBD5E1] focus:border-2 focus:border-[#2563EB]',
  ].join(' ')

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NewOrganizationPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      timezone: 'Asia/Kolkata',
    },
  })

  // Auto-generate slug from name
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    const slug = val
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
    setValue('slug', slug, { shouldValidate: true })
  }

  const onSubmit = async (values: FormValues) => {
    setServerError(null)
    try {
      await createOrganization({
        name: values.name,
        slug: values.slug,
        industry: values.industry,
        country: values.country,
        timezone: values.timezone,
        admin_name: values.admin_name,
        admin_email: values.admin_email,
        admin_password: values.admin_password || undefined,
      })
      router.push('/super-admin/organizations')
    } catch (err: any) {
      setServerError(
        err?.response?.data?.message ?? 'Something went wrong. Please try again.'
      )
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      {/* Header */}
      <div>
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1 text-sm text-[#475569] hover:text-[#0F172A] mb-3 transition-colors"
        >
          <ChevronLeft size={16} /> Back
        </button>
        <h1 className="text-[28px] font-bold text-[#0F172A]">Create Organization</h1>
        <p className="text-sm text-[#475569] mt-1">
          Set up a new tenant organization and provision its first admin account.
        </p>
      </div>

      {serverError && (
        <div className="rounded-[8px] bg-[#FEE2E2] border border-[#FECACA] px-4 py-3 text-sm text-[#DC2626]">
          {serverError}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
        {/* Section 1 */}
        <Card>
          <h2 className="text-[16px] font-semibold text-[#0F172A] mb-5 pb-4 border-b border-[#E2E8F0]">
            Organization Details
          </h2>
          <div className="grid grid-cols-1 gap-5">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Organization Name" error={errors.name?.message} required>
                <input
                  {...register('name')}
                  onChange={(e) => {
                    register('name').onChange(e)
                    handleNameChange(e)
                  }}
                  placeholder="Acme Corp"
                  className={inputCls(!!errors.name)}
                />
              </Field>

              <Field label="Slug" error={errors.slug?.message} required>
                <input
                  {...register('slug')}
                  placeholder="acme-corp"
                  className={inputCls(!!errors.slug)}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Industry" error={errors.industry?.message}>
                <select {...register('industry')} className={selectCls(!!errors.industry)}>
                  <option value="">Select industry</option>
                  <option value="Technology">Technology</option>
                  <option value="Finance">Finance</option>
                  <option value="Healthcare">Healthcare</option>
                  <option value="Education">Education</option>
                  <option value="Retail">Retail</option>
                  <option value="Manufacturing">Manufacturing</option>
                  <option value="Consulting">Consulting</option>
                  <option value="Media">Media</option>
                  <option value="Other">Other</option>
                </select>
              </Field>

              <Field label="Country" error={errors.country?.message}>
                <select {...register('country')} className={selectCls(!!errors.country)}>
                  <option value="">Select country</option>
                  <option value="India">India</option>
                  <option value="United States">United States</option>
                  <option value="United Kingdom">United Kingdom</option>
                  <option value="Canada">Canada</option>
                  <option value="Australia">Australia</option>
                  <option value="Singapore">Singapore</option>
                  <option value="UAE">UAE</option>
                  <option value="Other">Other</option>
                </select>
              </Field>
            </div>

            <Field label="Timezone" error={errors.timezone?.message}>
              <select {...register('timezone')} className={selectCls(!!errors.timezone)}>
                <option value="Asia/Kolkata">Asia/Kolkata (IST, UTC+5:30)</option>
                <option value="America/New_York">America/New_York (EST/EDT)</option>
                <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
                <option value="Europe/London">Europe/London (GMT/BST)</option>
                <option value="Europe/Berlin">Europe/Berlin (CET/CEST)</option>
                <option value="Asia/Singapore">Asia/Singapore (SGT, UTC+8)</option>
                <option value="Asia/Dubai">Asia/Dubai (GST, UTC+4)</option>
                <option value="Australia/Sydney">Australia/Sydney (AEST/AEDT)</option>
              </select>
            </Field>
          </div>
        </Card>

        {/* Section 2 */}
        <Card>
          <h2 className="text-[16px] font-semibold text-[#0F172A] mb-5 pb-4 border-b border-[#E2E8F0]">
            First Admin Account
          </h2>
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Admin Name" error={errors.admin_name?.message} required>
                <input
                  {...register('admin_name')}
                  placeholder="Jane Smith"
                  className={inputCls(!!errors.admin_name)}
                />
              </Field>

              <Field label="Admin Email" error={errors.admin_email?.message} required>
                <input
                  {...register('admin_email')}
                  type="email"
                  placeholder="jane@acme.com"
                  className={inputCls(!!errors.admin_email)}
                />
              </Field>
            </div>

            <Field label="Password" error={errors.admin_password?.message} hint="Leave blank if this email already has an account">
              <div className="relative">
                <input
                  {...register('admin_password')}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Min. 8 characters"
                  className={[inputCls(!!errors.admin_password), 'pr-10'].join(' ')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#475569] transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </Field>
          </div>
        </Card>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button type="submit" variant="primary" isLoading={isSubmitting}>
            Create Organization
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.push('/super-admin/organizations')}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}
