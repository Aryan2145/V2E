// ─── Enums / Union Types ───────────────────────────────────────────────────────

export type OrgStatus = 'active' | 'inactive' | 'pending_setup';

export type MemberRole = 'org_admin' | 'hr_manager' | 'employee';

// kept for sidebar/nav display logic that needs the super_admin variant
export type UserRole = MemberRole | 'super_admin';

export type BehaviorType = 'expected_behavior' | 'unacceptable_behavior';

export type RoleLevel = 'junior' | 'mid' | 'senior' | 'lead' | 'head';

export type EmploymentType = 'full_time' | 'part_time' | 'contract';

export type EmployeeStatus = 'active' | 'inactive' | 'on_leave';

// ─── Core Entities ─────────────────────────────────────────────────────────────

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url?: string;
  industry?: string;
  country?: string;
  timezone?: string;
  status: OrgStatus;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  organization_id?: string;
  name: string;
  email: string;
  role: MemberRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  isSuperAdmin: boolean;
  organizationId: string | null;
  role: MemberRole | null;
}

export interface OrgMembership {
  id: string;
  organization_id: string;
  user_id: string;
  role: MemberRole;
  is_active: boolean;
  joined_at: string;
  organization: {
    id: string;
    name: string;
    slug: string;
    logo_url?: string | null;
    industry?: string | null;
  };
}

export interface OrgChoice {
  id: string;
  name: string;
  slug: string;
  logo_url?: string | null;
  role: MemberRole;
  joined_at: string;
}

// ─── Org Identity ──────────────────────────────────────────────────────────────

export interface ValueItem {
  title: string;
  description?: string;
}

export interface OrgIdentity {
  id: string;
  organization_id: string;
  philosophy?: string;
  vision?: string;
  mission?: string;
  purpose?: string;
  values?: ValueItem[];
  created_at: string;
  updated_at: string;
}

// ─── Culture ───────────────────────────────────────────────────────────────────

export interface CultureStandard {
  id: string;
  organization_id: string;
  title: string;
  description: string;
  type: BehaviorType;
  created_at: string;
  updated_at: string;
}

// ─── Org Chart ─────────────────────────────────────────────────────────────────

export interface Department {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  parent_department_id?: string;
  head_user_id?: string;
  position_x: number;
  position_y: number;
  created_at: string;
  updated_at: string;
  _count?: {
    child_departments: number;
    roles: number;
    employee_profiles: number;
  };
  head_user?: {
    name: string;
  };
}

// ─── Roles ─────────────────────────────────────────────────────────────────────

export interface KraItem {
  title: string;
  description: string;
}

export interface KpiItem {
  title: string;
  metric: string;
  target: string;
  unit: string;
}

export interface Role {
  id: string;
  organization_id: string;
  department_id: string;
  title: string;
  job_description?: string;
  kra?: KraItem[];
  kpi?: KpiItem[];
  level: RoleLevel;
  created_at: string;
  updated_at: string;
  department?: {
    name: string;
  };
}

// ─── Employees ─────────────────────────────────────────────────────────────────

export interface EmployeeProfile {
  id: string;
  organization_id: string;
  user_id: string;
  role_id: string;
  department_id: string;
  reporting_to_user_id?: string;
  employee_code?: string;
  date_of_joining?: string;
  employment_type: EmploymentType;
  status: EmployeeStatus;
  created_at: string;
  updated_at: string;
  user?: User;
  role?: Role;
  department?: Department;
  reporting_to?: User;
}

// ─── API Utilities ─────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
  meta: any;
}

// ─── Auth ──────────────────────────────────────────────────────────────────────

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  user: AuthUser;
}

export interface OrgSelectionRequired {
  requires_org_selection: true;
  selection_token: string;
  user: { id: string; name: string; email: string };
  organizations: OrgChoice[];
}

export type LoginResponse = AuthTokens | OrgSelectionRequired;
