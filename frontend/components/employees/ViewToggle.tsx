'use client'

// Moved to the shared UI layer (now used by Employees and Departments).
// Re-exported here for backwards compatibility with existing imports.
export { default } from '@/components/ui/ViewToggle'
export type { ViewMode as EmployeeView } from '@/components/ui/ViewToggle'
