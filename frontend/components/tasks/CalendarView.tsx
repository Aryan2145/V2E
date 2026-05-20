'use client'

import React, { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import type { Task, TaskPriority } from '@/lib/types/tasks'

interface Props {
  tasks: Task[]
  priorities: TaskPriority[]
  onTaskClick: (taskId: string) => void
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

export default function CalendarView({ tasks, priorities, onTaskClick }: Props) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  const priorityMap = useMemo(() => new Map(priorities.map((p) => [p.id, p])), [priorities])

  // Build map of dateKey → tasks with deadline on that date
  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const task of tasks) {
      if (!task.deadline) continue
      const d = new Date(task.deadline)
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(task)
    }
    return map
  }, [tasks])

  const todayKey = toDateKey(today)

  // Calendar grid
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear((y) => y - 1) }
    else setMonth((m) => m - 1)
    setSelectedKey(null)
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear((y) => y + 1) }
    else setMonth((m) => m + 1)
    setSelectedKey(null)
  }

  const selectedTasks = selectedKey ? (tasksByDate.get(selectedKey) ?? []) : []

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[#0F172A]">
          {MONTHS[month]} {year}
        </h2>
        <div className="flex items-center gap-1">
          <button
            onClick={prevMonth}
            className="w-8 h-8 flex items-center justify-center rounded-[6px] hover:bg-[#F1F5F9] transition-colors text-[#475569]"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); setSelectedKey(null) }}
            className="px-3 h-8 text-sm font-medium text-[#2563EB] hover:bg-[#EFF6FF] rounded-[6px] transition-colors"
          >
            Today
          </button>
          <button
            onClick={nextMonth}
            className="w-8 h-8 flex items-center justify-center rounded-[6px] hover:bg-[#F1F5F9] transition-colors text-[#475569]"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="bg-white border border-[#E2E8F0] rounded-[12px] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-[#E2E8F0]">
          {DAYS.map((d) => (
            <div key={d} className="py-2 text-center text-xs font-semibold text-[#94A3B8] uppercase tracking-wider">
              {d}
            </div>
          ))}
        </div>

        {/* Cells */}
        <div className="grid grid-cols-7">
          {cells.map((day, idx) => {
            if (!day) {
              return <div key={`empty-${idx}`} className="h-24 border-b border-r border-[#F1F5F9] last:border-r-0 bg-[#FAFAFA]" />
            }

            const cellKey = `${year}-${month}-${day}`
            const cellDate = new Date(year, month, day)
            const isToday = cellKey === todayKey
            const isSelected = cellKey === selectedKey
            const dayTasks = tasksByDate.get(cellKey) ?? []
            const isPastDay = cellDate < new Date(today.getFullYear(), today.getMonth(), today.getDate())

            return (
              <div
                key={cellKey}
                onClick={() => setSelectedKey(isSelected ? null : cellKey)}
                className={`h-24 p-1.5 border-b border-r border-[#F1F5F9] last:border-r-0 cursor-pointer transition-colors ${
                  isSelected ? 'bg-[#EFF6FF]' : 'hover:bg-[#F8FAFC]'
                }`}
              >
                {/* Day number */}
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full ${
                      isToday
                        ? 'bg-[#2563EB] text-white'
                        : isPastDay
                          ? 'text-[#94A3B8]'
                          : 'text-[#0F172A]'
                    }`}
                  >
                    {day}
                  </span>
                  {dayTasks.length > 2 && (
                    <span className="text-[10px] text-[#94A3B8] font-medium">+{dayTasks.length - 2}</span>
                  )}
                </div>

                {/* Task dots / pills */}
                <div className="flex flex-col gap-0.5">
                  {dayTasks.slice(0, 2).map((task) => {
                    const priority = task.priority_id ? priorityMap.get(task.priority_id) : null
                    const isTaskOverdue = isPastDay && task.status?.type !== 'completed'
                    const dotColor = isTaskOverdue
                      ? '#DC2626'
                      : priority?.color ?? '#2563EB'

                    return (
                      <div
                        key={task.id}
                        className="flex items-center gap-1 px-1 py-0.5 rounded-[4px]"
                        style={{ backgroundColor: dotColor + '15' }}
                        onClick={(e) => { e.stopPropagation(); onTaskClick(task.id) }}
                        title={task.title}
                      >
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
                        <span className="text-[10px] font-medium truncate" style={{ color: dotColor }}>
                          {task.title}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Day detail panel */}
      {selectedKey && selectedTasks.length > 0 && (
        <div className="bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-[#0F172A]">
              {(() => {
                const [y, mo, d] = selectedKey.split('-').map(Number)
                return new Date(y, mo, d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
              })()}
              <span className="ml-2 text-sm font-normal text-[#64748B]">
                {selectedTasks.length} task{selectedTasks.length !== 1 ? 's' : ''}
              </span>
            </h3>
            <button
              onClick={() => setSelectedKey(null)}
              className="w-7 h-7 flex items-center justify-center rounded-[6px] hover:bg-[#F1F5F9] text-[#94A3B8] hover:text-[#0F172A] transition-colors"
            >
              <X size={14} />
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {selectedTasks.map((task) => {
              const priority = task.priority_id ? priorityMap.get(task.priority_id) : null
              const [sy, smo, sd] = selectedKey.split('-').map(Number)
              const selDate = new Date(sy, smo, sd)
              const isPast = selDate < new Date(today.getFullYear(), today.getMonth(), today.getDate())
              const isOverdue = isPast && task.status?.type !== 'completed'

              return (
                <div
                  key={task.id}
                  onClick={() => onTaskClick(task.id)}
                  className="flex items-center gap-3 p-3 rounded-[8px] border border-[#E2E8F0] hover:border-[#CBD5E1] hover:bg-[#F8FAFC] cursor-pointer transition-colors"
                >
                  {priority && (
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: isOverdue ? '#DC2626' : priority.color }}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#0F172A] truncate">{task.title}</p>
                    <p className="text-xs text-[#64748B] mt-0.5">
                      {task.status?.label ?? '—'}
                      {isOverdue && ' · '}
                      {isOverdue && <span className="text-[#DC2626] font-medium">Overdue</span>}
                    </p>
                  </div>
                  {priority && (
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                      style={{ backgroundColor: priority.color + '18', color: priority.color }}
                    >
                      {priority.label}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
