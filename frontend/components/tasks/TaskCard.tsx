'use client'

import React from 'react'
import { Calendar, User, GitBranch } from 'lucide-react'
import type { Task, TaskPriority, TaskStatus, TaskCategory } from '@/lib/types/tasks'
// import QuadrantBadge from './QuadrantBadge'

interface TaskCardProps {
  task: Task
  onClick: () => void
  priorities: TaskPriority[]
  statuses: TaskStatus[]
  categories: TaskCategory[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

const avatarColors = [
  'bg-[#2563EB]',
  'bg-[#7C3AED]',
  'bg-[#059669]',
  'bg-[#D97706]',
  'bg-[#DC2626]',
  'bg-[#0891B2]',
  'bg-[#BE185D]',
]

function avatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i)
  return avatarColors[hash % avatarColors.length]
}

function deadlineClass(deadline?: string): string {
  if (!deadline) return 'text-[#475569]'
  const d = new Date(deadline)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dl = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  if (dl < today) return 'text-[#DC2626] font-medium'
  if (dl.getTime() === today.getTime()) return 'text-[#D97706] font-medium'
  return 'text-[#475569]'
}

function formatDeadline(deadline: string): string {
  const d = new Date(deadline)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TaskCard({ task, onClick, priorities, statuses, categories }: TaskCardProps) {
  const priority = priorities.find((p) => p.id === task.priority_id)
  const status = statuses.find((s) => s.id === task.status_id) ?? task.status
  const category = categories.find((c) => c.id === task.category_id) ?? task.category

  const assignees = task.assignees?.filter((a) => !a.is_cc) ?? []
  const visibleAssignees = assignees.slice(0, 3)
  const extraCount = Math.max(0, assignees.length - 3)

  return (
    <div
      onClick={onClick}
      className="bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] px-5 py-4 flex items-center gap-4 cursor-pointer hover:border-[#2563EB] hover:shadow-md transition-all duration-150 group"
    >
      {/* Quadrant — hidden */}
      {/* <div className="shrink-0">
        <QuadrantBadge quadrant={task.quadrant} />
      </div> */}

      {/* Title + Category */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#0F172A] truncate group-hover:text-[#2563EB] transition-colors">
          {task.title}
        </p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {category && (
            <span
              className="inline-flex items-center rounded-[999px] px-2 py-0.5 text-[11px] font-medium"
              style={{
                backgroundColor: category.color + '22',
                color: category.color,
                border: `1px solid ${category.color}44`,
              }}
            >
              {category.name}
            </span>
          )}
          {priority && (
            <span
              className="inline-flex items-center rounded-[999px] px-2 py-0.5 text-[11px] font-medium"
              style={{
                backgroundColor: priority.color + '22',
                color: priority.color,
                border: `1px solid ${priority.color}44`,
              }}
            >
              {priority.label}
            </span>
          )}
          {task.workflow_step?.show_on_card && (
            <span className="inline-flex items-center gap-0.5 rounded-[999px] px-2 py-0.5 text-[10px] font-semibold bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]">
              <GitBranch size={9} />
              {task.workflow_step.template_name} — Step {task.workflow_step.step_order}
            </span>
          )}
        </div>
      </div>

      {/* Assignee avatars */}
      <div className="shrink-0 flex items-center">
        {visibleAssignees.length > 0 ? (
          <div className="flex -space-x-2">
            {visibleAssignees.map((a) => (
              <div
                key={a.id}
                title={a.user_name}
                className={`w-7 h-7 rounded-full ${avatarColor(a.user_name ?? '')} flex items-center justify-center text-white text-[10px] font-bold border-2 border-white`}
              >
                {getInitials(a.user_name ?? '')}
              </div>
            ))}
            {extraCount > 0 && (
              <div className="w-7 h-7 rounded-full bg-[#E2E8F0] flex items-center justify-center text-[#475569] text-[10px] font-bold border-2 border-white">
                +{extraCount}
              </div>
            )}
          </div>
        ) : (
          <div className="w-7 h-7 rounded-full bg-[#F1F5F9] flex items-center justify-center">
            <User size={13} className="text-[#94A3B8]" />
          </div>
        )}
      </div>

      {/* Deadline */}
      {task.deadline && (
        <div className={`shrink-0 flex items-center gap-1 text-xs ${deadlineClass(task.deadline)}`}>
          <Calendar size={12} />
          <span>{formatDeadline(task.deadline)}</span>
        </div>
      )}

      {/* Status */}
      {status && (
        <div className="shrink-0">
          <span
            className="inline-flex items-center rounded-[999px] px-2.5 py-0.5 text-[11px] font-medium"
            style={{
              backgroundColor: status.color + '22',
              color: status.color,
              border: `1px solid ${status.color}44`,
            }}
          >
            {status.label}
          </span>
        </div>
      )}
    </div>
  )
}
