'use client'

import { Fragment, useCallback, useEffect, useState } from 'react'
import { ScrollText, ChevronDown, ChevronRight, Search } from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import { auditApi, type AuditFilters } from '@/lib/api/audit'
import type { AuditEntry } from '@/lib/types/goals'

const selectClass =
  'border border-[#CBD5E1] rounded-[8px] px-3 py-2 text-sm text-[#0F172A] bg-white focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]'

const ACTION_META: Record<string, { label: string; bg: string; text: string }> = {
  create: { label: 'Create', bg: '#DCFCE7', text: '#16A34A' },
  update: { label: 'Update', bg: '#E0F2FE', text: '#0369A1' },
  delete: { label: 'Delete', bg: '#FEE2E2', text: '#DC2626' },
}

const RESOURCES = ['goal', 'access_right']

function fmt(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function AuditLogsPage() {
  const { user } = useAuth()
  const orgId = user?.organizationId ?? ''

  const [items, setItems] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  const [resource, setResource] = useState('')
  const [action, setAction] = useState('')
  const [search, setSearch] = useState('')

  const load = useCallback(() => {
    if (!orgId) {
      setLoading(false)
      return
    }
    setLoading(true)
    const filters: AuditFilters = {}
    if (resource) filters.resource = resource
    if (action) filters.action = action
    if (search) filters.search = search
    auditApi
      .list(orgId, filters)
      .then((res) => setItems(res.items))
      .catch((err) => {
        if (err?.response?.status === 403) setDenied(true)
      })
      .finally(() => setLoading(false))
  }, [orgId, resource, action, search])

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0)
    return () => clearTimeout(t)
  }, [load, search])

  if (denied)
    return (
      <div className="py-16 text-center">
        <h2 className="text-[18px] font-semibold text-[#0F172A]">No access</h2>
        <p className="text-sm text-[#475569] mt-1">You don&apos;t have permission to view audit logs.</p>
      </div>
    )

  return (
    <div>
      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-[26px] font-bold text-[#0F172A] leading-tight">
          <ScrollText size={24} className="text-[#2563EB]" /> Audit Logs
        </h1>
        <p className="text-sm text-[#475569] mt-1">
          Software-wide record of who changed what, and when, across modules.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input
            className={`${selectClass} w-full pl-9`}
            placeholder="Search by entity…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className={selectClass} value={resource} onChange={(e) => setResource(e.target.value)}>
          <option value="">All modules</option>
          {RESOURCES.map((r) => (
            <option key={r} value={r}>
              {r.replace('_', ' ')}
            </option>
          ))}
        </select>
        <select className={selectClass} value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="">All actions</option>
          <option value="create">Create</option>
          <option value="update">Update</option>
          <option value="delete">Delete</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#E2E8F0] rounded-[12px] overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-sm text-[#475569]">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center text-sm text-[#475569]">No audit entries.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                <th className="w-8 px-2 py-3" />
                <th className="text-left text-xs font-semibold text-[#475569] uppercase tracking-wider px-4 py-3">When</th>
                <th className="text-left text-xs font-semibold text-[#475569] uppercase tracking-wider px-4 py-3">Actor</th>
                <th className="text-left text-xs font-semibold text-[#475569] uppercase tracking-wider px-4 py-3">Action</th>
                <th className="text-left text-xs font-semibold text-[#475569] uppercase tracking-wider px-4 py-3 hidden sm:table-cell">Module</th>
                <th className="text-left text-xs font-semibold text-[#475569] uppercase tracking-wider px-4 py-3">Entity</th>
              </tr>
            </thead>
            <tbody>
              {items.map((e) => {
                const am = ACTION_META[e.action] ?? { label: e.action, bg: '#F1F5F9', text: '#475569' }
                const hasChanges = e.changes && Object.keys(e.changes).length > 0
                const open = expanded === e.id
                return (
                  <Fragment key={e.id}>
                    <tr
                      className={`border-b border-[#F1F5F9] ${hasChanges ? 'cursor-pointer hover:bg-[#F8FAFC]' : ''}`}
                      onClick={() => hasChanges && setExpanded(open ? null : e.id)}
                    >
                      <td className="px-2 py-3 text-[#CBD5E1]">
                        {hasChanges ? open ? <ChevronDown size={15} /> : <ChevronRight size={15} /> : null}
                      </td>
                      <td className="px-4 py-3 text-sm text-[#475569] whitespace-nowrap">{fmt(e.created_at)}</td>
                      <td className="px-4 py-3 text-sm text-[#0F172A]">{e.actor?.name ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span
                          className="text-[12px] font-medium rounded-full px-2.5 py-0.5"
                          style={{ backgroundColor: am.bg, color: am.text }}
                        >
                          {am.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-[#475569] hidden sm:table-cell capitalize">
                        {e.resource.replace('_', ' ')}
                      </td>
                      <td className="px-4 py-3 text-sm text-[#0F172A]">{e.entity_label ?? e.entity_id}</td>
                    </tr>
                    {open && hasChanges && (
                      <tr className="border-b border-[#F1F5F9] bg-[#F8FAFC]">
                        <td />
                        <td colSpan={5} className="px-4 py-3">
                          <div className="flex flex-col gap-1.5">
                            {Object.entries(e.changes!).map(([field, ch]) => (
                              <div key={field} className="text-sm flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-[#374151] capitalize">{field.replace(/_/g, ' ')}:</span>
                                <span className="text-[#DC2626] line-through">{String(ch.before ?? '—')}</span>
                                <span className="text-[#94A3B8]">→</span>
                                <span className="text-[#16A34A]">{String(ch.after ?? '—')}</span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
