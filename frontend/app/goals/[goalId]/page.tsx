'use client'

import GoalDetailView from '@/components/goals/GoalDetailView'

export default function GoalDetailPage({ params }: { params: { goalId: string } }) {
  return <GoalDetailView goalId={params.goalId} />
}
