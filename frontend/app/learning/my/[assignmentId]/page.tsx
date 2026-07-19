'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useAuth } from '@/lib/auth/context'
import {
  getMyAssignment, completeItem, uncompleteItem, getMyItemViewUrl, downloadMyItem, getMyItemFile,
} from '@/lib/api/learning'
import type { LearningPathAssignment } from '@/lib/types/learning'
import CourseViewer from '@/components/learning/CourseViewer'

export default function LearnPathPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>()
  const { user } = useAuth()
  const orgId = user?.organizationId ?? ''

  const [assignment, setAssignment] = useState<LearningPathAssignment | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!orgId || !assignmentId) return
    getMyAssignment(orgId, assignmentId).then(setAssignment).finally(() => setLoading(false))
  }, [orgId, assignmentId])

  if (loading || !assignment) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-56px)]">
        <div className="w-8 h-8 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const watermark = [user?.name, user?.email, new Date().toISOString().slice(0, 10)].filter(Boolean).join(' · ')

  return (
    <CourseViewer
      title={assignment.path?.title ?? 'Course'}
      items={assignment.items ?? []}
      sequential={assignment.path?.mode === 'sequential'}
      backHref="/learning/my"
      backLabel="My Learning"
      watermark={watermark}
      loadView={(id) => getMyItemViewUrl(orgId, assignmentId, id)}
      loadFile={(id) => getMyItemFile(orgId, assignmentId, id)}
      onDownload={(id) => downloadMyItem(orgId, assignmentId, id)}
      persistComplete={(id, type) => completeItem(orgId, assignmentId, id, type)}
      persistUncomplete={(id) => uncompleteItem(orgId, assignmentId, id)}
    />
  )
}
