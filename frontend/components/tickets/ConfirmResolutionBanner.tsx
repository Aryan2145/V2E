'use client'

import { CheckCircle2, XCircle } from 'lucide-react'

interface Props {
  ticketNumber: string
  onConfirm: () => void
  onClose: () => void
  loading?: boolean
}

export default function ConfirmResolutionBanner({ ticketNumber, onConfirm, onClose, loading }: Props) {
  return (
    <div className="flex items-start gap-3 p-4 bg-[#EFF6FF] border border-[#BFDBFE] rounded-[10px]">
      <CheckCircle2 size={18} className="text-[#2563EB] shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#1E3A8A]">Resolution Confirmation Required</p>
        <p className="text-sm text-[#1D4ED8] mt-0.5">
          The assignee has marked {ticketNumber} as resolved. Please confirm if your issue is resolved.
        </p>
        <div className="flex items-center gap-2 mt-3">
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[7px] text-sm font-semibold text-white bg-[#16A34A] hover:bg-[#15803D] disabled:opacity-60 transition-colors"
          >
            <CheckCircle2 size={14} /> Confirm Resolved
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[7px] text-sm font-semibold text-[#DC2626] bg-white border border-[#FECACA] hover:bg-[#FEE2E2] disabled:opacity-60 transition-colors"
          >
            <XCircle size={14} /> Not Resolved
          </button>
        </div>
      </div>
    </div>
  )
}
