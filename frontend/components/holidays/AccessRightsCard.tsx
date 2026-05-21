'use client'

const ROLES = ['org_admin', 'hr_manager', 'employee']
const ROLE_LABELS: Record<string, string> = {
  org_admin: 'Org Admin',
  hr_manager: 'HR Manager',
  employee: 'Employee',
}

interface Props {
  orgManageRoles: string[]
  deptManageRoles: string[]
  individualManageRoles: string[]
  onOrgChange: (roles: string[]) => void
  onDeptChange: (roles: string[]) => void
  onIndividualChange: (roles: string[]) => void
  disabled?: boolean
}

function RoleMultiSelect({ label, value, onChange, disabled }: { label: string; value: string[]; onChange: (r: string[]) => void; disabled?: boolean }) {
  function toggle(role: string) {
    if (disabled) return
    if (value.includes(role)) onChange(value.filter((r) => r !== role))
    else onChange([...value, role])
  }

  return (
    <div>
      <p className="text-xs font-semibold text-[#374151] mb-2">{label}</p>
      <div className="flex flex-wrap gap-2">
        {ROLES.map((role) => {
          const active = value.includes(role)
          return (
            <button
              key={role}
              type="button"
              disabled={disabled}
              onClick={() => toggle(role)}
              className={[
                'h-8 px-3 rounded-[8px] text-xs font-medium border transition-colors',
                disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
                active
                  ? 'bg-[#2563EB] text-white border-[#2563EB]'
                  : 'bg-white text-[#475569] border-[#CBD5E1] hover:border-[#2563EB] hover:text-[#2563EB]',
              ].join(' ')}
            >
              {ROLE_LABELS[role]}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function AccessRightsCard({
  orgManageRoles, deptManageRoles, individualManageRoles,
  onOrgChange, onDeptChange, onIndividualChange, disabled,
}: Props) {
  return (
    <div className="space-y-4">
      <RoleMultiSelect label="Who can manage org-level holidays" value={orgManageRoles} onChange={onOrgChange} disabled={disabled} />
      <RoleMultiSelect label="Who can manage department holidays" value={deptManageRoles} onChange={onDeptChange} disabled={disabled} />
      <RoleMultiSelect label="Who can manage individual holidays" value={individualManageRoles} onChange={onIndividualChange} disabled={disabled} />
    </div>
  )
}
