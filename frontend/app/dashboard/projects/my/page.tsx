'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth/context'
import { projectsApi } from '@/lib/api/projects'
import type { Project } from '@/lib/types/projects'
import ProjectCard from '@/components/projects/ProjectCard'
import { Briefcase, Plus } from 'lucide-react'

export default function MyProjectsPage() {
  const { user } = useAuth()
  const orgId = user?.organizationId ?? ''

  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    if (!orgId) { setLoading(false); return }
    setLoading(true)
    projectsApi.listMy(orgId).catch(() => []).then(setProjects).finally(() => setLoading(false))
  }, [orgId])

  useEffect(() => { load() }, [load])

  if (!orgId) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p className="font-semibold text-[#0F172A]">No organization found</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold text-[#0F172A] leading-tight">My Projects</h1>
          <p className="mt-1 text-[15px] text-[#475569]">Projects you are a member of.</p>
        </div>
        <Link
          href="/dashboard/projects/new"
          className="flex items-center gap-2 px-5 py-[10px] bg-[#2563EB] text-white rounded-[8px] text-sm font-semibold hover:bg-[#1D4ED8] transition-colors shrink-0"
        >
          <Plus size={16} />
          New Project
        </Link>
      </div>

      <p className="text-sm text-[#475569]">{projects.length} project{projects.length !== 1 ? 's' : ''}</p>

      {projects.length === 0 ? (
        <div className="bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] flex flex-col items-center justify-center py-20">
          <div className="w-14 h-14 rounded-full bg-[#F1F5F9] flex items-center justify-center mb-4">
            <Briefcase size={24} className="text-[#94A3B8]" />
          </div>
          <p className="font-semibold text-[#0F172A]">Not a member of any project yet</p>
          <p className="text-sm text-[#475569] mt-1">Projects you join will appear here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} orgId={orgId} />
          ))}
        </div>
      )}
    </div>
  )
}
