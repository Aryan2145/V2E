'use client'

import { Download } from 'lucide-react'
import type { HolidayAuditLog, HolidayAuditAction } from '@/lib/types/holidays'
import ResponsiveTable, { type ResponsiveColumn } from '@/components/ui/ResponsiveTable'

const ACTION_STYLES: Record<HolidayAuditAction, string> = {
  moved_forward: 'bg-[#DCFCE7] text-[#16A34A] border-[#BBF7D0]',
  moved_backward: 'bg-[#E0F2FE] text-[#0369A1] border-[#BAE6FD]',
  skipped: 'bg-[#FEE2E2] text-[#DC2626] border-[#FECACA]',
  created_anyway: 'bg-[#FEF9C3] text-[#CA8A04] border-[#FDE68A]',
}

const ACTION_LABELS: Record<HolidayAuditAction, string> = {
  moved_forward: 'Moved Forward',
  moved_backward: 'Moved Backward',
  skipped: 'Skipped',
  created_anyway: 'Created Anyway',
}

interface Props {
  logs: HolidayAuditLog[]
}

const columns: ResponsiveColumn<HolidayAuditLog>[] = [
  {
    key: 'date',
    header: 'Date',
    primary: true,
    render: (l) =>
      new Date(l.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
    cellClassName: 'text-xs text-[#475569] whitespace-nowrap',
  },
  {
    key: 'entity',
    header: 'Entity',
    render: (l) => (
      <span className="text-xs px-2 py-0.5 rounded-full border bg-[#F1F5F9] text-[#475569] border-[#E2E8F0] whitespace-nowrap">
        {l.entity_type.replace('_', ' ')}
      </span>
    ),
  },
  {
    key: 'title',
    header: 'Title',
    render: (l) => <span className="text-sm text-[#0F172A] line-clamp-2 md:max-w-[200px] md:truncate">{l.entity_title ?? '—'}</span>,
  },
  {
    key: 'holiday',
    header: 'Holiday',
    render: (l) => <span className="text-sm text-[#475569]">{l.holiday_name ?? '—'}</span>,
  },
  {
    key: 'action',
    header: 'Action',
    render: (l) => (
      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border whitespace-nowrap ${ACTION_STYLES[l.action]}`}>
        {ACTION_LABELS[l.action]}
      </span>
    ),
  },
  {
    key: 'original',
    header: 'Original',
    render: (l) => new Date(l.original_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    cellClassName: 'text-xs text-[#475569] whitespace-nowrap',
  },
  {
    key: 'adjusted',
    header: 'Adjusted',
    render: (l) =>
      l.adjusted_date
        ? new Date(l.adjusted_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
        : '—',
    cellClassName: 'text-xs text-[#475569] whitespace-nowrap',
  },
]

export default function HolidayAuditTable({ logs }: Props) {
  function exportCsv() {
    const header = 'Date,Entity Type,Entity Title,Holiday,Action,Original Date,Adjusted Date\n'
    const rows = logs.map((l) => [
      new Date(l.created_at).toLocaleDateString('en-IN'),
      l.entity_type,
      `"${(l.entity_title ?? '').replace(/"/g, '""')}"`,
      `"${(l.holiday_name ?? '').replace(/"/g, '""')}"`,
      ACTION_LABELS[l.action],
      new Date(l.original_date).toLocaleDateString('en-IN'),
      l.adjusted_date ? new Date(l.adjusted_date).toLocaleDateString('en-IN') : '',
    ].join(','))
    const csv = header + rows.join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `holiday-audit-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <ResponsiveTable
      columns={columns}
      rows={logs}
      rowKey={(l) => l.id}
      emptyState={
        <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-8 text-center shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
          <p className="text-[#94A3B8] text-sm">No audit records found for the selected filters.</p>
        </div>
      }
      toolbar={
        <>
          <p className="text-sm font-semibold text-[#0F172A]">
            {logs.length} record{logs.length !== 1 ? 's' : ''}
          </p>
          <button
            type="button"
            onClick={exportCsv}
            className="flex items-center gap-1.5 min-h-[36px] px-3 rounded-[8px] border border-[#E2E8F0] text-xs font-medium text-[#475569] hover:bg-[#F8FAFC] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]"
          >
            <Download size={13} />
            Export CSV
          </button>
        </>
      }
    />
  )
}
