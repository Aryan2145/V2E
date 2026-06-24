export type AuditActorType = 'user' | 'system'

export interface AuditChange {
  before: unknown
  after: unknown
}

export interface AuditEntry {
  id: string
  organization_id: string
  actor_user_id: string | null
  actor_type: AuditActorType
  action: string
  resource: string
  entity_id: string
  entity_type: string | null
  entity_label: string | null
  changes: Record<string, AuditChange> | null
  trigger_source: string | null
  trigger_context: Record<string, unknown> | null
  occurred_at: string
  request_id: string | null
  ip: string | null
  user_agent: string | null
  created_at: string
  actor?: { id: string; name: string; email: string } | null
}

export interface AuditListResponse {
  items: AuditEntry[]
  total: number
  skip: number
  take: number
}

export interface AuditResourceFacet {
  key: string
  label: string
  /** Legacy/derived alias — categorized for filtering & labels, hidden from the Type dropdown. */
  hidden?: boolean
}

export interface AuditModuleFacet {
  key: string
  label: string
  resources: AuditResourceFacet[]
}

export interface AuditResourcesResponse {
  modules: AuditModuleFacet[]
  trigger_sources: string[]
}
