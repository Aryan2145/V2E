'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Ticket as TicketIcon, AlertCircle } from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import { ticketsApi } from '@/lib/api/tickets'
import type { Ticket } from '@/lib/types/tickets'
import TicketCard from '@/components/tickets/TicketCard'

export default function MyTicketsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const orgId = user?.organizationId ?? ''

  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    try {
      setTickets(await ticketsApi.listMy(orgId))
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => { load() }, [load])

  const pendingConfirmation = tickets.filter(
    (t) => t.status?.type === 'resolved' && t.requires_raiser_confirmation && !t.raiser_confirmed_at
  )
  const pendingRating = tickets.filter(
    (t) => t.closed_at && !t.rated_at
  )

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[22px] font-bold text-[#0F172A]">My Tickets</h1>
        <p className="text-sm text-[#475569] mt-0.5">Tickets raised by you</p>
      </div>

      {pendingConfirmation.length > 0 && (
        <div className="flex items-center gap-3 p-3 bg-[#EFF6FF] border border-[#BFDBFE] rounded-[10px]">
          <AlertCircle size={16} className="text-[#2563EB] shrink-0" />
          <p className="text-sm text-[#1D4ED8]">
            {pendingConfirmation.length} ticket{pendingConfirmation.length !== 1 ? 's' : ''} awaiting your resolution confirmation
          </p>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-[#F1F5F9] rounded-[12px] animate-pulse" />)}
        </div>
      ) : tickets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border border-dashed border-[#E2E8F0] rounded-[12px]">
          <TicketIcon size={28} className="text-[#CBD5E1] mb-3" />
          <p className="text-sm font-medium text-[#0F172A]">No tickets raised yet</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {tickets.map((ticket) => (
            <div key={ticket.id} className="relative">
              <TicketCard ticket={ticket} onClick={() => router.push(`/dashboard/tasks/tickets/${ticket.id}`)} />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex gap-2">
                {ticket.status?.type === 'resolved' && ticket.requires_raiser_confirmation && !ticket.raiser_confirmed_at && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#FEF9C3] text-[#D97706] border border-[#FDE68A]">
                    Confirm?
                  </span>
                )}
                {ticket.closed_at && !ticket.rated_at && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A]">
                    Rate?
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
