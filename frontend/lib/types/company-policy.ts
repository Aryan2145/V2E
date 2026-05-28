export type PolicyStatus = 'draft' | 'published' | 'archived'
export type PolicyAssignmentStatus = 'not_started' | 'acknowledged'
export type PolicyContentType = 'video' | 'document' | 'url' | 'article'

export interface CompanyPolicy {
  id: string
  organization_id: string
  title: string
  description?: string
  status: PolicyStatus
  created_by_user_id: string
  created_at: string
  updated_at: string
  items?: CompanyPolicyItem[]
  _count?: { items: number; assignments: number }
}

export interface CompanyPolicyItem {
  id: string
  policy_id: string
  title: string
  description?: string
  content_type: PolicyContentType
  content_url?: string
  content_body?: string
  order_index: number
  created_at: string
  updated_at: string
}

export interface CompanyPolicyAssignment {
  id: string
  policy_id: string
  employee_profile_id: string
  assigned_by_user_id: string
  assigned_at: string
  status: PolicyAssignmentStatus
  acknowledged_at?: string
  employee_profile?: {
    user: { id: string; name: string; email: string }
    role?: { id: string; title: string }
  }
}
