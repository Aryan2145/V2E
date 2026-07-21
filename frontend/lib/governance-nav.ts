import {
  CalendarDays,
  Gavel,
  BarChart2,
  ClipboardList,
  FileText,
  type LucideIcon,
} from 'lucide-react'

// Single source of truth for the Governance line items. Each carries its own
// entitlement key (super-admin controlled, per-line-item) so the sidebar, the
// route guard, and the top-nav all gate off the same mapping.
export interface GovNavItem {
  label: string
  href: string
  entitlement: string
  Icon: LucideIcon
}

export const GOVERNANCE_NAV: GovNavItem[] = [
  { label: 'Meetings', href: '/dashboard/governance/meetings', entitlement: 'governance.meetings', Icon: CalendarDays },
  { label: 'Decision Log', href: '/dashboard/governance/decisions', entitlement: 'governance.decisions', Icon: Gavel },
  { label: 'Reports', href: '/dashboard/governance/reports', entitlement: 'governance.reports', Icon: BarChart2 },
  { label: 'Daily Update', href: '/dashboard/governance/daily-update', entitlement: 'governance.daily_update', Icon: ClipboardList },
  { label: 'Work Log', href: '/dashboard/governance/work-log', entitlement: 'governance.work_logs', Icon: FileText },
]

export const GOVERNANCE_ENTITLEMENT_KEYS = GOVERNANCE_NAV.map((i) => i.entitlement)

/** The line item whose route owns this path, if any (longest href match wins). */
export function governanceItemForPath(pathname: string): GovNavItem | undefined {
  return [...GOVERNANCE_NAV]
    .filter((i) => pathname === i.href || pathname.startsWith(`${i.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]
}
