'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ScrollText, ChevronDown, ChevronRight, Search } from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import { auditApi, type AuditFilters } from '@/lib/api/audit'
import type { AuditEntry } from '@/lib/types/audit'
import ResponsiveTable, { type ResponsiveColumn } from '@/components/ui/ResponsiveTable'
import {
  ActorCell,
  ActionBadge,
  AuditExpandedDetail,
  hasChanges,
  fmtDateTime,
  triggerLabel,
} from '@/components/audit/AuditDetail'

const selectClass =
  'border border-[#CBD5E1] rounded-[8px] px-3 py-2 text-sm text-[#0F172A] bg-white focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]'

export default function AuditLogsPage() {
  const { user } = useAuth()
  const orgId = user?.organizationId ?? ''

  const [items, setItems] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  const [resources, setResources] = useState<string[]>([])
  const [triggerSources, setTriggerSources] = useState<string[]>([])

  const [resource, setResource] = useState('')
  const [action, setAction] = useState('')
  const [actorType, setActorType] = useState('')
  const [triggerSource, setTriggerSource] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [search, setSearch] = useState('')

  // Load the filter option lists once.
  useEffect(() => {
    if (!orgId) return
    auditApi
      .resources(orgId)
      .then((res) => {
        setResources(res.resources)
        setTriggerSources(res.trigger_sources)
      })
      .catch(() => {})
  }, [orgId])

  const load = useCallback(() => {
    if (!orgId) {
      setLoading(false)
      return
    }
    setLoading(true)
    const filters: AuditFilters = {}
    if (resource) filters.resource = resource
    if (action) filters.action = action
    if (actorType) filters.actor_type = actorType
    if (triggerSource) filters.trigger_source = triggerSource
    if (fromDate) filters.from_date = new Date(fromDate).toISOString()
    if (toDate) {
      const end = new Date(toDate)
      end.setHours(23, 59, 59, 999)
      filters.to_date = end.toISOString()
    }
    if (search) filters.search = search
    auditApi
      .list(orgId, filters)
      .then((res) => setItems(res.items))
      .catch((err) => {
        if (err?.response?.status === 403) setDenied(true)
      })
      .finally(() => setLoading(false))
  }, [orgId, resource, action, actorType, triggerSource, fromDate, toDate, search])

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0)
    return () => clearTimeout(t)
  }, [load, search])

  const columns = useMemo<ResponsiveColumn<AuditEntry>[]>(
    () => [
      {
        key: 'expand',
        header: '',
        headerClassName: 'w-8 px-2',
        cellClassName: 'w-8 px-2 text-[#CBD5E1] align-top',
        hideOnMobile: true,
        render: (e) => (hasChanges(e) ? expanded === e.id ? <ChevronDown size={15} /> : <ChevronRight size={15} /> : null),
      },
      {
        key: 'when',
        header: 'When',
        primary: true,
        cellClassName: 'align-top',
        render: (e) => <span className="text-sm text-[#475569] whitespace-nowrap">{fmtDateTime(e.occurred_at)}</span>,
      },
      {
        key: 'actor',
        header: 'Actor',
        cellClassName: 'align-top',
        render: (e) => <ActorCell entry={e} />,
      },
      {
        key: 'action',
        header: 'Action',
        cellClassName: 'align-top',
        render: (e) => <ActionBadge action={e.action} />,
      },
      {
        key: 'module',
        header: 'Module',
        cellClassName: 'align-top capitalize',
        render: (e) => <span className="text-sm text-[#475569]">{e.resource.replace(/_/g, ' ')}</span>,
      },
      {
        key: 'entity',
        header: 'Entity',
        cellClassName: 'align-top',
        render: (e) => <span className="text-sm text-[#0F172A]">{e.entity_label ?? e.entity_id}</span>,
      },
    ],
    [expanded],
  )

  const toggleRow = useCallback((e: AuditEntry) => {
    if (hasChanges(e)) setExpanded((cur) => (cur === e.id ? null : e.id))
  }, [])

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
          Software-wide record of who — or what — changed what, and when, across modules.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input
            className={`${selectClass} w-full pl-9`}
            placeholder="Search by entity or action…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className={selectClass} value={resource} onChange={(e) => setResource(e.target.value)}>
          <option value="">All modules</option>
          {resources.map((r) => (
            <option key={r} value={r}>
              {r.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
        <select className={selectClass} value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="">All actions</option>
          <option value="create">Create</option>
          <option value="update">Update</option>
          <option value="delete">Delete</option>
        </select>
        <select className={selectClass} value={actorType} onChange={(e) => setActorType(e.target.value)}>
          <option value="">User &amp; System</option>
          <option value="user">User</option>
          <option value="system">System</option>
        </select>
        {triggerSources.length > 0 && (
          <select className={selectClass} value={triggerSource} onChange={(e) => setTriggerSource(e.target.value)}>
            <option value="">All triggers</option>
            {triggerSources.map((t) => (
              <option key={t} value={t}>
                {triggerLabel(t)}
              </option>
            ))}
          </select>
        )}
        <input
          type="date"
          className={selectClass}
          value={fromDate}
          max={toDate || undefined}
          onChange={(e) => setFromDate(e.target.value)}
          aria-label="From date"
        />
        <input
          type="date"
          className={selectClass}
          value={toDate}
          min={fromDate || undefined}
          onChange={(e) => setToDate(e.target.value)}
          aria-label="To date"
        />
      </div>

      {/* Table */}
      <ResponsiveTable
        columns={columns}
        rows={items}
        rowKey={(e) => e.id}
        loading={loading}
        onRowClick={toggleRow}
        isExpanded={(e) => expanded === e.id && hasChanges(e)}
        renderExpanded={(e) => <AuditExpandedDetail entry={e} />}
        emptyState={
          <div className="bg-white border border-[#E2E8F0] rounded-[12px] overflow-hidden">
            <div className="p-10 text-center text-sm text-[#475569]">No audit entries.</div>
          </div>
        }
      />
    </div>
  )
}
