'use client'

import React, { useState } from 'react'
import type { Task, TaskStatus, TaskPriority, TaskCategory } from '@/lib/types/tasks'
import QuadrantBadge from './QuadrantBadge'
import AssigneeAvatars from './AssigneeAvatars'

interface Props {
  tasks: Task[]
  statuses: TaskStatus[]
  priorities: TaskPriority[]
  categories: TaskCategory[]
  onStatusChange: (taskId: string, newStatusId: string) => Promise<void>
  onTaskClick: (taskId: string) => void
}

function isOverdue(deadline?: string, statusType?: string): boolean {
  // A closed task (completed OR incomplete) is never overdue.
  if (!deadline || statusType === 'completed' || statusType === 'incomplete') return false
  return new Date(deadline) < new Date()
}

export default function KanbanView({ tasks, statuses, priorities, categories, onStatusChange, onTaskClick }: Props) {
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)
  const [updating, setUpdating] = useState<string | null>(null)

  const tasksByStatus = statuses.reduce<Record<string, Task[]>>((acc, s) => {
    acc[s.id] = tasks.filter((t) => t.status_id === s.id)
    return acc
  }, {})

  async function handleDrop(e: React.DragEvent, statusId: string) {
    e.preventDefault()
    setDragOverCol(null)
    if (!draggingId || draggingId === statusId) return

    const task = tasks.find((t) => t.id === draggingId)
    if (!task || task.status_id === statusId) { setDraggingId(null); return }

    setUpdating(draggingId)
    setDraggingId(null)
    try {
      await onStatusChange(draggingId, statusId)
    } finally {
      setUpdating(null)
    }
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 min-h-[60vh]">
      {statuses.map((status) => {
        const colTasks = tasksByStatus[status.id] ?? []
        const isOver = dragOverCol === status.id
        return (
          <div
            key={status.id}
            className="flex flex-col shrink-0 w-72"
            onDragOver={(e) => { e.preventDefault(); setDragOverCol(status.id) }}
            onDragLeave={() => setDragOverCol(null)}
            onDrop={(e) => handleDrop(e, status.id)}
          >
            {/* Column header */}
            <div
              className={`flex items-center gap-2 px-3 py-2.5 rounded-[10px] mb-3 border ${isOver ? 'border-[#2563EB] bg-[#EFF6FF]' : 'border-[#E2E8F0] bg-white'} transition-colors`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: status.color }}
              />
              <span className="text-sm font-semibold text-[#0F172A] flex-1">{status.label}</span>
              <span className="text-xs font-medium text-[#94A3B8] bg-[#F1F5F9] px-2 py-0.5 rounded-full">
                {colTasks.length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex flex-col gap-2 flex-1">
              {colTasks.map((task) => {
                const priority = priorities.find((p) => p.id === task.priority_id)
                const overdue = isOverdue(task.deadline, task.status?.type)
                const isUpdating = updating === task.id
                const people = [...(task.assignees ?? [])]
                  .sort((a, b) => Number(a.is_cc) - Number(b.is_cc))
                  .map((a) => ({
                    id: a.id,
                    name: a.user?.name ?? a.user_name ?? '?',
                    department: a.user?.department,
                    role: a.user?.role_title,
                    isCC: a.is_cc,
                  }))

                return (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={() => setDraggingId(task.id)}
                    onDragEnd={() => { setDraggingId(null); setDragOverCol(null) }}
                    onClick={() => onTaskClick(task.id)}
                    className={`bg-white border rounded-[10px] p-3 cursor-grab active:cursor-grabbing shadow-[0_1px_3px_rgba(0,0,0,0.08)] transition-all select-none ${
                      draggingId === task.id ? 'opacity-40 border-[#2563EB]' : 'border-[#E2E8F0] hover:border-[#CBD5E1] hover:shadow-[0_2px_6px_rgba(0,0,0,0.1)]'
                    } ${isUpdating ? 'opacity-60' : ''}`}
                  >
                    {/* Title */}
                    <p className="text-sm font-semibold text-[#0F172A] leading-snug mb-2 line-clamp-2">
                      {task.title}
                    </p>

                    {/* Badges row */}
                    <div className="flex items-center gap-1.5 flex-wrap mb-2">
                      <QuadrantBadge quadrant={task.quadrant} />
                      {priority && (
                        <span
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: priority.color + '18', color: priority.color }}
                        >
                          {priority.label}
                        </span>
                      )}
                    </div>

                    {/* Footer: deadline + avatars */}
                    <div className="flex items-center justify-between mt-1">
                      {task.deadline ? (
                        <span className={`text-[11px] font-medium ${overdue ? 'text-[#DC2626]' : 'text-[#64748B]'}`}>
                          {new Date(task.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          {overdue && ' · Overdue'}
                        </span>
                      ) : <span />}

                      {people.length > 0 && (
                        <AssigneeAvatars people={people} max={3} size="sm" />
                      )}
                    </div>
                  </div>
                )
              })}

              {/* Drop zone placeholder */}
              {isOver && (
                <div className="h-16 border-2 border-dashed border-[#2563EB] rounded-[10px] bg-[#EFF6FF] flex items-center justify-center">
                  <span className="text-xs text-[#2563EB] font-medium">Drop here</span>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
