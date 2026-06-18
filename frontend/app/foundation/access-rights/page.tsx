'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ShieldCheck, Lock, Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import { accessRightsApi, type AccessRightEntry } from '@/lib/api/access-rights'
import { useToast } from '@/components/ui/Toast'
import Button from '@/components/ui/Button'
import type { AccessMatrix } from '@/lib/types/goals'

type PermKey = 'can_read' | 'can_write' | 'can_edit' | 'can_delete'
const COLS: { key: PermKey; label: string }[] = [
  { key: 'can_read', label: 'Read' },
  { key: 'can_write', label: 'Write' },
  { key: 'can_edit', label: 'Edit' },
  { key: 'can_delete', label: 'Delete' },
]

const ROLE_LABEL: Record<string, string> = { hr_manager: 'HR Manager', employee: 'Employee' }

export default function AccessRightsPage() {
  const { user } = useAuth()
  const orgId = user?.organizationId ?? ''
  const { addToast } = useToast()

  const [matrix, setMatrix] = useState<AccessMatrix | null>(null)
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [activeRole, setActiveRole] = useState('hr_manager')
  const [saving, setSaving] = useState(false)
  // edits keyed by `role:resource` → entry
  const [edits, setEdits] = useState<Record<string, AccessRightEntry>>({})

  const load = useCallback(() => {
    if (!orgId) {
      setLoading(false)
      return
    }
    setLoading(true)
    accessRightsApi
      .getMatrix(orgId)
      .then((m) => {
        setMatrix(m)
        if (m.roles?.length) setActiveRole(m.roles[0])
        const seed: Record<string, AccessRightEntry> = {}
        m.matrix.forEach((roleRow) => {
          roleRow.resources.forEach((r) => {
            seed[`${roleRow.role}:${r.resource}`] = {
              role: roleRow.role,
              resource: r.resource,
              can_read: r.can_read,
              can_write: r.can_write,
              can_edit: r.can_edit,
              can_delete: r.can_delete,
            }
          })
        })
        setEdits(seed)
      })
      .catch((err) => {
        if (err?.response?.status === 403) setDenied(true)
      })
      .finally(() => setLoading(false))
  }, [orgId])

  useEffect(() => {
    load()
  }, [load])

  const resources = matrix?.resources ?? []

  function toggle(resource: string, key: PermKey) {
    const k = `${activeRole}:${resource}`
    setEdits((prev) => {
      const cur = prev[k] ?? { role: activeRole, resource, can_read: false, can_write: false, can_edit: false, can_delete: false }
      return { ...prev, [k]: { ...cur, [key]: !cur[key] } }
    })
  }

  const dirty = useMemo(() => {
    if (!matrix) return false
    for (const roleRow of matrix.matrix) {
      for (const r of roleRow.resources) {
        const e = edits[`${roleRow.role}:${r.resource}`]
        if (!e) continue
        if (
          e.can_read !== r.can_read ||
          e.can_write !== r.can_write ||
          e.can_edit !== r.can_edit ||
          e.can_delete !== r.can_delete
        )
          return true
      }
    }
    return false
  }, [edits, matrix])

  async function handleSave() {
    setSaving(true)
    try {
      const entries = Object.values(edits)
      const updated = await accessRightsApi.update(orgId, entries)
      setMatrix(updated)
      addToast('Access rights saved', 'success')
    } catch (err: any) {
      addToast(err?.response?.data?.message ?? 'Failed to save access rights', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-10 text-center text-sm text-[#475569]">Loading…</div>
  if (denied)
    return (
      <div className="flex flex-col items-center text-center gap-3 py-16">
        <div className="w-14 h-14 rounded-[16px] bg-[#FEE2E2] flex items-center justify-center text-[#DC2626]">
          <Lock size={24} />
        </div>
        <h2 className="text-[18px] font-semibold text-[#0F172A]">No access</h2>
        <p className="text-sm text-[#475569] max-w-sm">
          You don&apos;t have permission to manage access rights. Ask an administrator to grant you the
          &quot;manage access rights&quot; permission.
        </p>
      </div>
    )

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h1 className="flex items-center gap-2 text-[26px] font-bold text-[#0F172A] leading-tight">
            <ShieldCheck size={24} className="text-[#2563EB]" /> Access Rights
          </h1>
          <p className="text-sm text-[#475569] mt-1 max-w-2xl">
            Configure what each role can do, per module. Administrators always have all rights, including
            the right to manage these settings.
          </p>
        </div>
        <Button variant="primary" onClick={handleSave} isLoading={saving} disabled={!dirty || saving}>
          {saving && <Loader2 size={15} className="animate-spin" />}
          Save changes
        </Button>
      </div>

      {/* Admin note */}
      <div className="flex items-center gap-2 bg-[#EFF6FF] border border-[#BAE6FD] rounded-[10px] px-4 py-2.5 mb-5 text-sm text-[#0369A1]">
        <Lock size={15} /> Administrators (org_admin) have all rights and cannot be restricted here.
      </div>

      {/* Role tabs */}
      <div className="flex items-center gap-2 mb-4">
        {(matrix?.roles ?? []).map((role) => {
          const active = role === activeRole
          return (
            <button
              key={role}
              onClick={() => setActiveRole(role)}
              className={[
                'px-4 py-2 text-sm font-medium rounded-[8px] border transition-colors',
                active ? 'bg-[#2563EB] text-white border-[#2563EB]' : 'bg-white text-[#475569] border-[#E2E8F0] hover:border-[#CBD5E1]',
              ].join(' ')}
            >
              {ROLE_LABEL[role] ?? role}
            </button>
          )
        })}
      </div>

      {/* Matrix */}
      <div className="bg-white border border-[#E2E8F0] rounded-[12px] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
              <th className="text-left text-xs font-semibold text-[#475569] uppercase tracking-wider px-4 py-3">Module</th>
              {COLS.map((c) => (
                <th key={c.key} className="text-center text-xs font-semibold text-[#475569] uppercase tracking-wider px-4 py-3 w-24">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {resources.map((res) => {
              const entry = edits[`${activeRole}:${res.key}`]
              return (
                <tr key={res.key} className="border-b border-[#F1F5F9] last:border-0">
                  <td className="px-4 py-3">
                    <p className="text-[15px] font-medium text-[#0F172A]">{res.label}</p>
                    <p className="text-xs text-[#64748B] mt-0.5">{res.description}</p>
                  </td>
                  {COLS.map((c) => (
                    <td key={c.key} className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={entry?.[c.key] ?? false}
                        onChange={() => toggle(res.key, c.key)}
                        className="w-4 h-4 accent-[#2563EB] cursor-pointer"
                      />
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-[#64748B] mt-3">
        Editing the &quot;Access Rights&quot; module&apos;s Edit permission grants the &quot;manage access
        rights&quot; meta-permission to that role.
      </p>
    </div>
  )
}
