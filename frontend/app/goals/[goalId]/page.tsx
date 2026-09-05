'use client'

import { useParams } from 'next/navigation'
import GoalDetailView from '@/components/goals/GoalDetailView'

export default function GoalDetailPage() {
  const params = useParams()
  const goalId = String(params?.goalId ?? '')
  return <GoalDetailView goalId={goalId} />
}
