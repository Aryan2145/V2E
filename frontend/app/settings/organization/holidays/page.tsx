import { redirect } from 'next/navigation'

// Holidays has no landing page of its own — the Org Calendar is the default view
// (deadline behavior config now lives under the "Configurations" tab).
export default function HolidaysIndexPage() {
  redirect('/settings/organization/holidays/org')
}
