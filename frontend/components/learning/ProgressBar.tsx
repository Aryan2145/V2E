interface ProgressBarProps {
  percent: number
  className?: string
  showLabel?: boolean
  size?: 'sm' | 'md'
}

export default function ProgressBar({
  percent,
  className = '',
  showLabel = false,
  size = 'md',
}: ProgressBarProps) {
  const h = size === 'sm' ? 'h-1.5' : 'h-2'
  const clamped = Math.min(100, Math.max(0, percent))

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className={`flex-1 bg-[#E2E8F0] rounded-full ${h} overflow-hidden`}>
        <div
          className="bg-[#2563EB] h-full rounded-full transition-all duration-500"
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs font-medium text-[#475569] w-8 text-right shrink-0">
          {clamped}%
        </span>
      )}
    </div>
  )
}
