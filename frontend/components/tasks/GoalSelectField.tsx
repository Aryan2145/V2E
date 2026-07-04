'use client'

import React, { useEffect, useState } from 'react'
import StyledSelect from '@/components/ui/StyledSelect'
import { goalsApi } from '@/lib/api/goals'
import type { Goal } from '@/lib/types/goals'

interface Props {
  orgId: string
  value: string
  onChange: (goalId: string) => void
}

/**
 * Optional "Link to goal" select (Create Task + recurring modals). Lists the
 * quarterly goals the viewer can see; a linked task shows up as an initiative
 * on that goal and feeds its execution view. Hidden while there are no goals.
 */
export default function GoalSelectField({ orgId, value, onChange }: Props) {
  const [goals, setGoals] = useState<Goal[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!orgId) return
    goalsApi
      .list(orgId, { level: 'quarterly' })
      .then((g) => setGoals(g ?? []))
      .catch(() => setGoals([]))
      .finally(() => setLoaded(true))
  }, [orgId])

  // Nothing to link to — keep the form uncluttered. (If an existing link points
  // at a goal we can't list, still render so the user can see/clear it.)
  if (loaded && goals.length === 0 && !value) return null
  if (!loaded && !value) return null

  const known = goals.some((g) => g.id === value)

  return (
    <div>
      <label className="block text-sm font-medium text-[#374151] mb-1.5">Link to goal</label>
      <StyledSelect
        value={value}
        onChange={onChange}
        placeholder="No goal"
        options={[
          { value: '', label: 'No goal' },
          ...(value && !known ? [{ value, label: 'Current linked goal' }] : []),
          ...goals.map((g) => ({ value: g.id, label: g.title })),
        ]}
      />
      <p className="text-[11px] text-[#475569] mt-1">Optional — the task counts as an initiative on this quarterly goal.</p>
    </div>
  )
}
