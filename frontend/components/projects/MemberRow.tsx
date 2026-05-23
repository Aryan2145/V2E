'use client'

import { Trash2 } from 'lucide-react'
import type { ProjectMember, ProjectMemberRole, TaskVisibility } from '@/lib/types/projects'

interface MemberRowProps {
  member: ProjectMember
  currentUserId: string
  canEdit: boolean
  onRoleChange: (userId: string, role: ProjectMemberRole) => void
  onVisibilityChange: (userId: string, visibility: TaskVisibility) => void
  onRemove: (userId: string) => void
}

export default function MemberRow({ member, currentUserId, canEdit, onRoleChange, onVisibilityChange, onRemove }: MemberRowProps) {
  const isSelf = member.user_id === currentUserId

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-[#E2E8F0] last:border-0">
      <div className="w-8 h-8 rounded-full bg-[#EFF6FF] border border-[#BFDBFE] flex items-center justify-center shrink-0">
        <span className="text-xs font-semibold text-[#2563EB]">{member.user_id.charAt(0).toUpperCase()}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#0F172A] truncate">{member.user_id}</p>
        {isSelf && <p className="text-[11px] text-[#94A3B8]">You</p>}
      </div>
      {canEdit && !isSelf ? (
        <>
          <select
            value={member.role}
            onChange={(e) => onRoleChange(member.user_id, e.target.value as ProjectMemberRole)}
            className="text-xs border border-[#CBD5E1] rounded-[6px] px-2 py-1 text-[#0F172A] bg-white focus:border-[#2563EB] focus:outline-none"
          >
            <option value="manager">Manager</option>
            <option value="editor">Editor</option>
            <option value="viewer">Viewer</option>
          </select>
          <select
            value={member.task_visibility}
            onChange={(e) => onVisibilityChange(member.user_id, e.target.value as TaskVisibility)}
            className="text-xs border border-[#CBD5E1] rounded-[6px] px-2 py-1 text-[#0F172A] bg-white focus:border-[#2563EB] focus:outline-none"
          >
            <option value="own_tasks_only">Own tasks</option>
            <option value="all_member_tasks">All tasks</option>
          </select>
          <button
            type="button"
            onClick={() => onRemove(member.user_id)}
            className="p-1.5 rounded-[6px] hover:bg-[#FEE2E2] text-[#DC2626] transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </>
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-0.5 rounded-full border border-[#E2E8F0] text-[#475569] capitalize">{member.role}</span>
          <span className="text-xs text-[#94A3B8]">{member.task_visibility === 'all_member_tasks' ? 'All tasks' : 'Own tasks'}</span>
        </div>
      )}
    </div>
  )
}
