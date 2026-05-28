'use client'

import { Scale } from 'lucide-react'

export default function GovernancePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-bold text-[#0F172A] leading-tight">Governance</h1>
        <p className="mt-1 text-[15px] text-[#475569]">Organizational governance, compliance and audit.</p>
      </div>
      <div className="flex flex-col items-center justify-center py-16 text-center bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <div className="w-14 h-14 rounded-[12px] bg-[#F0FDF4] flex items-center justify-center mb-4">
          <Scale size={26} className="text-[#16A34A]" />
        </div>
        <h2 className="text-[18px] font-bold text-[#0F172A]">Coming Soon</h2>
        <p className="text-[14px] text-[#475569] mt-2 max-w-sm">
          Governance tools and compliance tracking will be available here.
        </p>
      </div>
    </div>
  )
}
