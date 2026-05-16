'use client'

import { Target } from 'lucide-react'

export default function GoalsPage() {
  return <ComingSoon icon={<Target size={40} />} title="Goals" description="Set company-wide, team, and individual goals. Track progress with OKRs and key results." />
}

function ComingSoon({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="min-h-[calc(100vh-56px)] flex items-center justify-center px-6">
      <div className="flex flex-col items-center text-center max-w-sm gap-5">
        <div className="w-20 h-20 rounded-[20px] bg-[#EFF6FF] flex items-center justify-center text-[#2563EB]">
          {icon}
        </div>
        <div>
          <div className="inline-flex items-center gap-1.5 bg-[#FEF9C3] text-[#854D0E] text-xs font-semibold px-3 py-1 rounded-full mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-[#CA8A04] inline-block" />
            Coming Soon
          </div>
          <h1 className="text-[26px] font-bold text-[#0F172A] leading-tight">{title}</h1>
          <p className="text-sm text-[#64748B] mt-2 leading-relaxed">{description}</p>
        </div>
        <div className="w-full bg-white border border-[#E2E8F0] rounded-[12px] px-5 py-4 text-left">
          <p className="text-xs font-semibold text-[#475569] uppercase tracking-wider mb-3">What&apos;s coming</p>
          <ul className="flex flex-col gap-2">
            {['OKR framework integration', 'Real-time progress tracking', 'Team & individual goal alignment', 'Automated check-ins'].map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm text-[#475569]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#CBD5E1] shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
