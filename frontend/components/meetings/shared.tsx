'use client'

import { useEffect, useState } from 'react'
import { accessRightsApi } from '@/lib/api/access-rights'
import {
  MEETING_STATUS_META,
  RESPONSE_META,
  type MeetingAttendeeResponse,
  type MeetingStatus,
} from '@/lib/types/meetings'

export interface MeetingPerms {
  read: boolean
  write: boolean
  edit: boolean
  delete: boolean
}
const FALLBACK: MeetingPerms = { read: false, write: false, edit: false, delete: false }

export function useMeetingPermissions(orgId: string): { perms: MeetingPerms; loading: boolean } {
  const [perms, setPerms] = useState<MeetingPerms>(FALLBACK)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let active = true
    if (!orgId) {
      setLoading(false)
      return
    }
    accessRightsApi
      .getMine(orgId)
      .then((res) => active && setPerms(res.resources?.meetings ?? FALLBACK))
      .catch(() => active && setPerms(FALLBACK))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [orgId])
  return { perms, loading }
}

export function fmtDate(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
}

export function fmtDateTime(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function fmtTime(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

export function StatusBadge({ status }: { status: MeetingStatus }) {
  const m = MEETING_STATUS_META[status]
  return (
    <span
      className="inline-flex items-center font-medium text-[12px] rounded-full px-2.5 py-0.5 border whitespace-nowrap"
      style={{ backgroundColor: m.bg, color: m.text, borderColor: m.border }}
    >
      {m.label}
    </span>
  )
}

export function ResponseBadge({ response }: { response: MeetingAttendeeResponse }) {
  const m = RESPONSE_META[response]
  return (
    <span className="inline-flex items-center font-medium text-[12px] rounded-full px-2.5 py-0.5" style={{ backgroundColor: m.bg, color: m.text }}>
      {m.label}
    </span>
  )
}
