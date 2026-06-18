import { redirect } from 'next/navigation'

export default function WorkLogIndex() {
  redirect('/dashboard/governance/work-log/review')
}
