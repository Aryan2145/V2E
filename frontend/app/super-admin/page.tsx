import { redirect } from 'next/navigation'

// /super-admin has no dashboard of its own — land super admins on Organizations
// (matches the root redirect and the sidebar's default destination).
export default function SuperAdminIndexPage() {
  redirect('/super-admin/organizations')
}
