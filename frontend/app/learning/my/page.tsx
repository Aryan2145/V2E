'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { GraduationCap, Clock, CheckCircle, BookOpen } from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import { getMyAssignments } from '@/lib/api/learning'
import type { LearningPathAssignment } from '@/lib/types/learning'
import ProgressRing from '@/components/learning/ProgressRing'

const STATUS_CONFIG = {
  not_started: { label: 'Not Started', classes: 'bg-[#F1F5F9] text-[#64748B]' },
  in_progress: { label: 'In Progress', classes: 'bg-[#EFF6FF] text-[#2563EB]' },
  completed: { label: 'Completed', classes: 'bg-[#DCFCE7] text-[#16A34A]' },
}

export default function MyLearningPage() {
  const { user } = useAuth()
  const orgId = user?.organizationId ?? ''
  const [assignments, setAssignments] = useState<LearningPathAssignment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!orgId) return
    getMyAssignments(orgId).then(setAssignments).finally(() => setLoading(false))
  }, [orgId])

  const inProgress = assignments.filter((a) => a.status === 'in_progress')
  const notStarted = assignments.filter((a) => a.status === 'not_started')
  const completed = assignments.filter((a) => a.status === 'completed')

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-56px)]">
        <div className="w-8 h-8 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="px-8 py-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-[28px] font-bold text-[#0F172A]">My Learning</h1>
        <p className="text-sm text-[#475569] mt-1">{assignments.length} paths assigned to you</p>
      </div>

      {assignments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-[16px] bg-[#EFF6FF] flex items-center justify-center mb-4">
            <GraduationCap size={28} className="text-[#2563EB]" />
          </div>
          <h3 className="text-lg font-semibold text-[#0F172A] mb-1">No learning paths yet</h3>
          <p className="text-sm text-[#475569]">Your manager will assign learning paths to you.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {inProgress.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-[#475569] uppercase tracking-wider mb-3">In Progress</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {inProgress.map((a) => <AssignmentCard key={a.id} assignment={a} />)}
              </div>
            </section>
          )}
          {notStarted.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-[#475569] uppercase tracking-wider mb-3">Not Started</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {notStarted.map((a) => <AssignmentCard key={a.id} assignment={a} />)}
              </div>
            </section>
          )}
          {completed.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-[#475569] uppercase tracking-wider mb-3">Completed</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {completed.map((a) => <AssignmentCard key={a.id} assignment={a} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

function AssignmentCard({ assignment }: { assignment: LearningPathAssignment }) {
  const path = assignment.path!
  const progress = assignment.path_progress
  const percent = progress?.progress_percent ?? 0
  const { label, classes } = STATUS_CONFIG[assignment.status]

  return (
    <Link
      href={`/learning/my/${assignment.id}`}
      className="bg-white border border-[#E2E8F0] rounded-[12px] p-5 flex items-start gap-4 hover:shadow-md hover:border-[#2563EB]/20 transition-all duration-150 group"
    >
      <ProgressRing percent={percent} size={52} strokeWidth={4} className="shrink-0" />
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-[#0F172A] group-hover:text-[#2563EB] transition-colors line-clamp-2 mb-1.5">
          {path.title}
        </h3>
        <div className="flex items-center gap-3 text-xs text-[#64748B]">
          <span className="flex items-center gap-1">
            <BookOpen size={11} />
            {path._count?.items ?? 0} items
          </span>
          {path.estimated_minutes && (
            <span className="flex items-center gap-1">
              <Clock size={11} />
              {path.estimated_minutes}m
            </span>
          )}
        </div>
        <div className="mt-2">
          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${classes}`}>
            {label}
          </span>
        </div>
      </div>
    </Link>
  )
}
