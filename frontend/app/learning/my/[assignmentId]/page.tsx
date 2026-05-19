'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, CheckCircle, Lock, Play, FileText,
  Link2, BookOpen, ExternalLink, Clock
} from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import { getMyAssignment, completeItem } from '@/lib/api/learning'
import type { LearningPathAssignment, LearningItem, ContentType } from '@/lib/types/learning'
import ProgressBar from '@/components/learning/ProgressBar'
import ItemTypeBadge from '@/components/learning/ItemTypeBadge'

const TYPE_ICONS: Record<ContentType, any> = {
  video: Play,
  document: FileText,
  url: Link2,
  article: BookOpen,
}

export default function LearnPathPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>()
  const { user } = useAuth()
  const orgId = user?.organizationId ?? ''

  const [assignment, setAssignment] = useState<LearningPathAssignment | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeItem, setActiveItem] = useState<LearningItem | null>(null)
  const [completing, setCompleting] = useState<string | null>(null)

  useEffect(() => {
    if (!orgId || !assignmentId) return
    getMyAssignment(orgId, assignmentId).then((a) => {
      setAssignment(a)
      // Open first unlocked, non-completed item
      const first = a.items?.find((i) => !i.is_locked && i.progress?.status !== 'completed')
      if (first) setActiveItem(first)
    }).finally(() => setLoading(false))
  }, [orgId, assignmentId])

  async function handleOpenItem(item: LearningItem) {
    if (item.is_locked) return
    setActiveItem(item)

    // Auto-complete URL/video items on open
    if (['url', 'video'].includes(item.content_type) && item.progress?.status !== 'completed') {
      await doComplete(item, 'auto_opened')
    }
  }

  async function doComplete(item: LearningItem, type: 'manual' | 'auto_opened') {
    setCompleting(item.id)
    try {
      await completeItem(orgId, assignmentId, item.id, type)
      // Refresh assignment
      const updated = await getMyAssignment(orgId, assignmentId)
      setAssignment(updated)
      setActiveItem(updated.items?.find((i) => i.id === item.id) ?? null)
    } finally {
      setCompleting(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-56px)]">
        <div className="w-8 h-8 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!assignment) return null

  const path = assignment.path!
  const items = assignment.items ?? []
  const progress = assignment.path_progress
  const percent = progress?.progress_percent ?? 0

  return (
    <div className="flex h-[calc(100vh-56px)]">
      {/* Sidebar: item list */}
      <div className="w-72 shrink-0 border-r border-[#E2E8F0] bg-white flex flex-col">
        <div className="p-4 border-b border-[#E2E8F0]">
          <Link
            href="/learning/my"
            className="inline-flex items-center gap-1.5 text-xs text-[#475569] hover:text-[#2563EB] mb-3 transition-colors"
          >
            <ArrowLeft size={13} />
            My Learning
          </Link>
          <h2 className="text-sm font-bold text-[#0F172A] line-clamp-2 mb-2">{path.title}</h2>
          <ProgressBar percent={percent} showLabel size="sm" />
        </div>

        <nav className="flex-1 overflow-y-auto py-2 px-2">
          {items.map((item, idx) => {
            const isActive = activeItem?.id === item.id
            const isDone = item.progress?.status === 'completed'
            const isLocked = item.is_locked

            return (
              <button
                key={item.id}
                onClick={() => handleOpenItem(item)}
                disabled={isLocked ?? false}
                className={[
                  'w-full text-left flex items-start gap-3 px-3 py-2.5 rounded-[8px] mb-0.5 transition-colors',
                  isLocked
                    ? 'opacity-50 cursor-not-allowed'
                    : isActive
                    ? 'bg-[#EFF6FF]'
                    : 'hover:bg-[#F8FAFC] cursor-pointer',
                ].join(' ')}
              >
                <div className="mt-0.5 shrink-0">
                  {isLocked ? (
                    <Lock size={14} className="text-[#94A3B8]" />
                  ) : isDone ? (
                    <CheckCircle size={14} className="text-[#16A34A]" />
                  ) : (
                    <div className={`w-3.5 h-3.5 rounded-full border-2 ${isActive ? 'border-[#2563EB]' : 'border-[#CBD5E1]'}`} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-xs font-medium truncate ${isActive ? 'text-[#2563EB]' : isDone ? 'text-[#475569]' : 'text-[#0F172A]'}`}>
                    {item.title}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <ItemTypeBadge type={item.content_type} />
                    {item.estimated_minutes && (
                      <span className="text-[10px] text-[#94A3B8]">{item.estimated_minutes}m</span>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </nav>
      </div>

      {/* Main content area */}
      <div className="flex-1 overflow-y-auto bg-[#F8FAFC]">
        {!activeItem ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <BookOpen size={40} className="text-[#CBD5E1] mx-auto mb-3" />
              <p className="text-sm text-[#475569]">Select an item from the sidebar to begin</p>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-8 py-8">
            {/* Item header */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <ItemTypeBadge type={activeItem.content_type} />
                {activeItem.estimated_minutes && (
                  <span className="flex items-center gap-1 text-xs text-[#64748B]">
                    <Clock size={11} />
                    {activeItem.estimated_minutes} min
                  </span>
                )}
              </div>
              <h1 className="text-[22px] font-bold text-[#0F172A] mb-1">{activeItem.title}</h1>
              {activeItem.description && (
                <p className="text-sm text-[#475569]">{activeItem.description}</p>
              )}
            </div>

            {/* Content */}
            <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-6 mb-6">
              {activeItem.content_type === 'article' && (
                <div className="prose prose-sm max-w-none text-[#1E293B] whitespace-pre-wrap">
                  {activeItem.content_body ?? 'No content available.'}
                </div>
              )}

              {['video', 'url', 'document'].includes(activeItem.content_type) && activeItem.content_url && (
                <div className="flex flex-col items-center gap-4">
                  {activeItem.content_type === 'video' && (
                    <div className="w-full aspect-video rounded-[8px] overflow-hidden bg-black">
                      <iframe
                        src={activeItem.content_url}
                        className="w-full h-full"
                        allowFullScreen
                        title={activeItem.title}
                      />
                    </div>
                  )}
                  <a
                    href={activeItem.content_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      if (activeItem.progress?.status !== 'completed') {
                        doComplete(activeItem, 'auto_opened')
                      }
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-[8px] transition-colors"
                  >
                    <ExternalLink size={15} />
                    Open {activeItem.content_type === 'video' ? 'Video' : activeItem.content_type === 'document' ? 'Document' : 'Link'}
                  </a>
                </div>
              )}

              {!activeItem.content_url && !activeItem.content_body && (
                <p className="text-sm text-[#94A3B8] text-center py-8">No content available for this item.</p>
              )}
            </div>

            {/* Complete button */}
            {activeItem.progress?.status !== 'completed' ? (
              <button
                onClick={() => doComplete(activeItem, 'manual')}
                disabled={completing === activeItem.id}
                className="flex items-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-[#16A34A] hover:bg-[#15803D] rounded-[8px] transition-colors disabled:bg-[#E2E8F0] disabled:text-[#94A3B8] disabled:cursor-not-allowed"
              >
                {completing === activeItem.id ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <CheckCircle size={16} />
                )}
                Mark as Complete
              </button>
            ) : (
              <div className="flex items-center gap-2 text-sm font-semibold text-[#16A34A]">
                <CheckCircle size={18} />
                Completed
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
