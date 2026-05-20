'use client'

import { Calendar, User } from 'lucide-react'
import type { Ticket } from '@/lib/types/tickets'
import SLAIndicator from './SLAIndicator'
import TicketTypeBadge from './TicketTypeBadge'
import TicketStatusBadge from './TicketStatusBadge'

interface Props {
  ticket: Ticket
  onClick: () => void
}

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

const avatarColors = ['bg-[#2563EB]', 'bg-[#7C3AED]', 'bg-[#059669]', 'bg-[#D97706]', 'bg-[#DC2626]', 'bg-[#0891B2]']
function avatarColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i)
  return avatarColors[hash % avatarColors.length]
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function TicketCard({ ticket, onClick }: Props) {
  return (
    <div
      onClick={onClick}
      className="bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] px-5 py-3.5 flex items-center gap-4 cursor-pointer hover:border-[#2563EB] hover:shadow-md transition-all duration-150 group"
    >
      {/* Ticket number */}
      <span className="shrink-0 font-mono text-xs text-[#94A3B8] w-[76px]">{ticket.ticket_number}</span>

      {/* Type badge */}
      {ticket.ticket_type && (
        <div className="shrink-0">
          <TicketTypeBadge type={ticket.ticket_type} />
        </div>
      )}

      {/* Title + category */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#0F172A] truncate group-hover:text-[#2563EB] transition-colors">
          {ticket.title}
        </p>
        {ticket.category && (
          <span
            className="inline-flex items-center rounded-[999px] px-2 py-0.5 text-[10px] font-medium mt-0.5"
            style={{ backgroundColor: ticket.category.color + '22', color: ticket.category.color, border: `1px solid ${ticket.category.color}44` }}
          >
            {ticket.category.name}
          </span>
        )}
      </div>

      {/* Priority */}
      {ticket.priority && (
        <div className="shrink-0 hidden sm:block">
          <span
            className="inline-flex items-center rounded-[999px] px-2 py-0.5 text-[10px] font-medium"
            style={{ backgroundColor: ticket.priority.color + '22', color: ticket.priority.color, border: `1px solid ${ticket.priority.color}44` }}
          >
            {ticket.priority.label}
          </span>
        </div>
      )}

      {/* Assignee */}
      <div className="shrink-0 hidden md:flex items-center gap-1.5">
        {ticket.assigned_to_user_id ? (
          <div
            className={`w-6 h-6 rounded-full ${avatarColor(ticket.assigned_to_user_id)} flex items-center justify-center text-white text-[9px] font-bold`}
          >
            {getInitials(ticket.assigned_to_user_id.slice(0, 4))}
          </div>
        ) : (
          <div className="w-6 h-6 rounded-full bg-[#F1F5F9] flex items-center justify-center">
            <User size={11} className="text-[#94A3B8]" />
          </div>
        )}
      </div>

      {/* SLA indicator */}
      <div className="shrink-0 hidden sm:block">
        <SLAIndicator
          sla_due_at={ticket.sla_due_at}
          sla_breached={ticket.sla_breached}
          status_type={ticket.status?.type}
          created_at={ticket.created_at}
        />
      </div>

      {/* Status */}
      {ticket.status && (
        <div className="shrink-0">
          <TicketStatusBadge status={ticket.status} />
        </div>
      )}

      {/* Created date */}
      <div className="shrink-0 hidden lg:flex items-center gap-1 text-xs text-[#475569]">
        <Calendar size={11} />
        <span>{formatDate(ticket.created_at)}</span>
      </div>
    </div>
  )
}
