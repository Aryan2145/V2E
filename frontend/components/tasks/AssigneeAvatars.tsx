'use client'

import React from 'react'

export interface AvatarPerson {
  id: string
  name: string
  department?: string | null
  role?: string | null
  isCC?: boolean
}

const AVATAR_COLORS = [
  'bg-[#2563EB]', 'bg-[#7C3AED]', 'bg-[#059669]',
  'bg-[#D97706]', 'bg-[#DC2626]', 'bg-[#0891B2]', 'bg-[#BE185D]',
]

function avatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i)
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

function getInitials(name: string): string {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
  return initials || '?'
}

const SIZES = {
  sm: { circle: 'w-5 h-5 text-[8px]', overlap: '-space-x-1.5' },
  md: { circle: 'w-7 h-7 text-[10px]', overlap: '-space-x-2' },
} as const

/**
 * Overlapping initials avatars with a rich hover tooltip
 * (full name, role · department, Assignee/CC). CC avatars render muted.
 */
export default function AssigneeAvatars({
  people,
  max = 3,
  size = 'md',
}: {
  people: AvatarPerson[]
  max?: number
  size?: keyof typeof SIZES
}) {
  if (people.length === 0) return null
  const s = SIZES[size]
  const visible = people.slice(0, max)
  const extra = people.length - visible.length

  return (
    <div className={`flex ${s.overlap}`}>
      {visible.map((p) => (
        <div key={p.id} className="relative group/avatar">
          <div
            className={[
              `${s.circle} rounded-full flex items-center justify-center font-bold border-2 border-white cursor-default`,
              p.isCC
                ? 'bg-[#F1F5F9] text-[#64748B] ring-1 ring-[#CBD5E1]'
                : `${avatarColor(p.name)} text-white`,
            ].join(' ')}
          >
            {getInitials(p.name)}
          </div>
          {/* Tooltip */}
          <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/avatar:block z-50">
            <div className="rounded-[8px] bg-[#0F172A] px-3 py-2 shadow-[0_4px_16px_rgba(0,0,0,0.25)] text-left w-max max-w-[240px]">
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold text-white whitespace-nowrap">{p.name}</p>
                <span
                  className={[
                    'inline-flex items-center rounded-[999px] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
                    p.isCC ? 'bg-[#334155] text-[#CBD5E1]' : 'bg-[#2563EB] text-white',
                  ].join(' ')}
                >
                  {p.isCC ? 'CC' : 'Assignee'}
                </span>
              </div>
              {(p.role || p.department) && (
                <p className="text-[11px] text-[#94A3B8] mt-0.5 whitespace-nowrap">
                  {[p.role, p.department].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
            {/* Arrow */}
            <div className="mx-auto w-2 h-2 -mt-1 rotate-45 bg-[#0F172A]" />
          </div>
        </div>
      ))}
      {extra > 0 && (
        <div
          className={`${s.circle} rounded-full bg-[#E2E8F0] flex items-center justify-center text-[#475569] font-bold border-2 border-white`}
          title={people.slice(max).map((p) => p.name).join(', ')}
        >
          +{extra}
        </div>
      )}
    </div>
  )
}
