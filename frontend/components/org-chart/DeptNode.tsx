'use client';
import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Users } from 'lucide-react';

interface DeptNodeData {
  name: string;
  headName?: string;
  roleCount?: number;
  teamCount?: number;
  readOnly?: boolean;
}

function DeptNode({ data, selected }: { data: DeptNodeData; selected: boolean }) {
  return (
    <div
      className={`bg-white rounded-xl border-2 p-4 min-w-[180px] shadow-sm transition-all ${
        selected ? 'border-[#2563EB]' : 'border-[#E2E8F0]'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-[#2563EB] !w-3 !h-3" />
      <div className="font-semibold text-[#0F172A] text-sm">{data.name}</div>
      {data.headName && (
        <div className="text-xs text-[#475569] mt-1">{data.headName}</div>
      )}
      <div className="flex items-center gap-1 mt-2">
        <Users size={12} className="text-[#94A3B8]" />
        <span className="text-xs text-[#64748B]">{data.teamCount ?? 0} members</span>
        {data.roleCount !== undefined && (
          <span className="ml-auto text-xs bg-[#EFF6FF] text-[#2563EB] px-2 py-0.5 rounded-full font-medium">
            {data.roleCount} roles
          </span>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-[#2563EB] !w-3 !h-3" />
    </div>
  );
}

export default memo(DeptNode);
