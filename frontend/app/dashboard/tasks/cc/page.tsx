'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/context'
import { tasksApi } from '@/lib/api/tasks'
import type { Task, TaskCategory, TaskPriority, TaskStatus } from '@/lib/types/tasks'
import TaskCard from '@/components/tasks/TaskCard'
import { Eye } from 'lucide-react'

export default function CCTasksPage() {
  const { user } = useAuth()
  const router = useRouter()
  const orgId = user?.organizationId ?? ''

  const [tasks, setTasks] = useState<Task[]>([])
  const [categories, setCategories] = useState<TaskCategory[]>([])
  const [priorities, setPriorities] = useState<TaskPriority[]>([])
  const [statuses, setStatuses] = useState<TaskStatus[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(() => {
    if (!orgId) { setLoading(false); return }
    setLoading(true)
    Promise.all([
      tasksApi.getMyCCTasks(orgId).catch(() => []),
      tasksApi.getCategories(orgId).catch(() => []),
      tasksApi.getPriorities(orgId).catch(() => []),
      tasksApi.getStatuses(orgId).catch(() => []),
    ]).then(([t, c, p, s]) => {
      setTasks(t)
      setCategories(c)
      setPriorities(p)
      setStatuses(s)
    }).finally(() => setLoading(false))
  }, [orgId])

  useEffect(() => { loadData() }, [loadData])

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
      <div>
        <h1 className="text-[28px] font-bold text-[#0F172A] leading-tight">CC&apos;d Tasks</h1>
        <p className="mt-1 text-[15px] text-[#475569]">Tasks you&apos;re copied on — view and comment, but not complete.</p>
      </div>

      <p className="text-sm text-[#475569]">
        {tasks.length} task{tasks.length !== 1 ? 's' : ''}
      </p>

      {tasks.length === 0 ? (
        <div className="bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] flex flex-col items-center justify-center py-20">
          <div className="w-14 h-14 rounded-full bg-[#FFFBEB] flex items-center justify-center mb-4">
            <Eye size={24} className="text-[#D97706]" />
          </div>
          <p className="font-semibold text-[#0F172A]">No CC&apos;d tasks</p>
          <p className="text-sm text-[#475569] mt-1">Tasks where you&apos;re CC&apos;d will appear here.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onClick={() => router.push(`/dashboard/tasks/${task.id}`)}
              priorities={priorities}
              statuses={statuses}
              categories={categories}
            />
          ))}
        </div>
      )}
    </div>
  )
}
