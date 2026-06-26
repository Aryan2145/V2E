'use client'

import { useEffect, useState } from 'react'
import { Map } from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import { goalsApi } from '@/lib/api/goals'
import { type Goal } from '@/lib/types/goals'
import { EmptyState } from '@/components/goals/shared'
import StrategicMap from '@/components/goals/strategic-map/StrategicMap'

export default function StrategicMapPage() {
  const { user } = useAuth()
  const orgId = user?.organizationId ?? ''
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!orgId) {
      setLoading(false)
      return
    }
    goalsApi
      .list(orgId, {})
      .then(setGoals)
      .catch(() => setGoals([]))
      .finally(() => setLoading(false))
  }, [orgId])

  const hasContent = goals.some((g) => g.level === 'objective' || g.level === 'annual')

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-[26px] font-bold text-[#0F172A] leading-tight">Strategic Map</h1>
        <p className="text-sm text-[#475569] mt-1">
          How objectives ladder down into goals and sub-goals across the four Balanced-Scorecard perspectives.
        </p>
      </div>

      {loading ? (
        <div className="p-10 text-center text-sm text-[#475569]">Loading…</div>
      ) : !hasContent ? (
        <div className="bg-white border border-[#E2E8F0] rounded-[12px] overflow-hidden">
          <EmptyState
            icon={<Map size={26} />}
            title="Nothing to map yet"
            subtitle="Create objectives and goals first — they'll appear here as a strategy map."
          />
        </div>
      ) : (
        <StrategicMap goals={goals} />
      )}
    </div>
  )
}
