'use client'

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface Props {
  value: number[]
  onChange: (days: number[]) => void
  disabled?: boolean
}

export default function WorkingDaysToggle({ value, onChange, disabled }: Props) {
  function toggle(day: number) {
    if (disabled) return
    if (value.includes(day)) {
      onChange(value.filter((d) => d !== day))
    } else {
      onChange([...value, day].sort((a, b) => a - b))
    }
  }

  return (
    <div className="flex gap-2 flex-wrap">
      {DAY_LABELS.map((label, index) => {
        const active = value.includes(index)
        return (
          <button
            key={index}
            type="button"
            onClick={() => toggle(index)}
            disabled={disabled}
            className={[
              'h-9 w-12 rounded-[8px] text-sm font-semibold border transition-colors duration-150',
              disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
              active
                ? 'bg-[#2563EB] text-white border-[#2563EB]'
                : 'bg-white text-[#475569] border-[#CBD5E1] hover:border-[#2563EB] hover:text-[#2563EB]',
            ].join(' ')}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
