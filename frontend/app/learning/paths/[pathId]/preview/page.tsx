'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useAuth } from '@/lib/auth/context'
import {
  getPath, getAdminItemViewUrl, getAdminItemFile, downloadAdminItem,
} from '@/lib/api/learning'
import type { LearningPath } from '@/lib/types/learning'
import CourseViewer from '@/components/learning/CourseViewer'

/**
 * Creator "Preview" — the EXACT learner screen (same CourseViewer component), fed from
 * the path instead of an assignment. Uses the admin loaders, which record no views and
 * touch no analytics; completion stays local. Edit (top-right) jumps to the builder,
 * Back returns to the course's manage page.
 */
export default function CoursePreviewPage() {
  const { pathId } = useParams<{ pathId: string }>()
  const { user } = useAuth()
  const orgId = user?.organizationId ?? ''

  const [path, setPath] = useState<LearningPath | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!orgId || !pathId) return
    getPath(orgId, pathId).then(setPath).finally(() => setLoading(false))
  }, [orgId, pathId])

  if (loading || !path) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-56px)]">
        <div className="w-8 h-8 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const watermark = [user?.name, user?.email, new Date().toISOString().slice(0, 10)].filter(Boolean).join(' · ')

  return (
    <CourseViewer
      preview
      title={path.title}
      items={path.items ?? []}
      sequential={path.mode === 'sequential'}
      backHref={`/learning/paths/${pathId}`}
      backLabel="Back"
      watermark={watermark}
      editHref={`/learning/paths/builder?id=${pathId}`}
      loadView={(id) => getAdminItemViewUrl(orgId, pathId, id)}
      loadFile={(id) => getAdminItemFile(orgId, pathId, id)}
      onDownload={(id) => downloadAdminItem(orgId, pathId, id)}
    />
  )
}
