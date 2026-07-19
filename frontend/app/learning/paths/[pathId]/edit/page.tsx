'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

/** The separate metadata-only edit form is gone — editing happens in the one-screen builder. */
export default function EditPathRedirect() {
  const { pathId } = useParams<{ pathId: string }>()
  const router = useRouter()
  useEffect(() => { router.replace(`/learning/paths/builder?id=${pathId}`) }, [router, pathId])
  return null
}
