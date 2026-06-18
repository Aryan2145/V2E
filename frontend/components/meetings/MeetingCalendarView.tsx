'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { MEETING_STATUS_META, type Meeting } from '@/lib/types/meetings'
import { fmtTime } from './shared'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function MeetingCalendarView({ meetings, onSelect }: { meetings: Meeting[]; onSelect: (id: string) => void }) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() }
  })

  const byDate = useMemo(() => {
    const map = new Map<string, Meeting[]>()
    for (const m of meetings) {
      if (!m.scheduled_start) continue
      const d = new Date(m.scheduled_start)
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(m)
    }
    return map
  }, [meetings])

  const firstDay = new Date(cursor.year, cursor.month, 1).getDay()
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate()
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  const today = new Date()
  const isToday = (day: number) => today.getFullYear() === cursor.year && today.getMonth() === cursor.month && today.getDate() === day

  function shift(delta: number) {
    setCursor((c) => {
      const m = c.month + delta
      return { year: c.year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 }
    })
  }

  const monthLabel = new Date(cursor.year, cursor.month, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[18px] font-semibold text-[#0F172A]">{monthLabel}</h2>
        <div className="flex items-center gap-1">
          <button onClick={() => shift(-1)} className="p-1.5 rounded-[6px] hover:bg-[#F1F5F9] text-[#475569]"><ChevronLeft size={18} /></button>
          <button onClick={() => setCursor({ year: today.getFullYear(), month: today.getMonth() })} className="px-3 py-1.5 text-sm font-medium rounded-[6px] hover:bg-[#F1F5F9] text-[#475569]">Today</button>
          <button onClick={() => shift(1)} className="p-1.5 rounded-[6px] hover:bg-[#F1F5F9] text-[#475569]"><ChevronRight size={18} /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-px bg-[#E2E8F0] border border-[#E2E8F0] rounded-[8px] overflow-hidden">
        {WEEKDAYS.map((w) => (
          <div key={w} className="bg-[#F8FAFC] text-center text-xs font-semibold text-[#475569] py-2">{w}</div>
        ))}
        {cells.map((day, i) => {
          const items = day ? byDate.get(`${cursor.year}-${cursor.month}-${day}`) ?? [] : []
          return (
            <div key={i} className="bg-white min-h-[96px] p-1.5 align-top">
              {day && (
                <>
                  <div className={['text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full', isToday(day) ? 'bg-[#2563EB] text-white' : 'text-[#475569]'].join(' ')}>{day}</div>
                  <div className="flex flex-col gap-1">
                    {items.slice(0, 3).map((m) => {
                      const meta = MEETING_STATUS_META[m.status]
                      return (
                        <button
                          key={m.id}
                          onClick={() => onSelect(m.id)}
                          className="w-full text-left text-[11px] leading-tight rounded px-1.5 py-1 truncate"
                          style={{ backgroundColor: meta.bg, color: meta.text }}
                          title={m.title}
                        >
                          {fmtTime(m.scheduled_start)} {m.title}
                        </button>
                      )
                    })}
                    {items.length > 3 && <span className="text-[11px] text-[#94A3B8] px-1">+{items.length - 3} more</span>}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
