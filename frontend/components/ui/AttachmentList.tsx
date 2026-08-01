'use client'

import React from 'react'
import { Download, FileText, Loader2, X } from 'lucide-react'
import type { TaskAttachment } from '@/lib/types/tasks'
import { fileKindLabel, formatBytes } from '@/lib/attachments'
import Tooltip from '@/components/ui/Tooltip'

function KindBadge({ name }: { name: string }) {
  return (
    <span className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-[8px] bg-[#EFF6FF] border border-[#BFDBFE] text-[9px] font-bold text-[#2563EB]">
      {fileKindLabel(name)}
    </span>
  )
}

/** Persisted attachments — download on click, optional remove (uploader only). */
export function AttachmentList({
  attachments,
  onDownload,
  onRemove,
  canRemove,
}: {
  attachments: TaskAttachment[]
  onDownload: (a: TaskAttachment) => void
  onRemove?: (a: TaskAttachment) => void
  canRemove?: (a: TaskAttachment) => boolean
}) {
  if (attachments.length === 0) return null
  return (
    <div className="space-y-2">
      {attachments.map((a) => (
        <div
          key={a.id}
          className="flex items-center gap-3 rounded-[10px] border border-[#E2E8F0] bg-white px-3 py-2 hover:border-[#CBD5E1] transition-colors"
        >
          <KindBadge name={a.file_name} />
          <Tooltip label={`Download ${a.file_name}`}>
          <button
            type="button"
            onClick={() => onDownload(a)}
            className="flex-1 min-w-0 text-left group"
          >
            <p className="text-sm font-medium text-[#0F172A] truncate group-hover:text-[#2563EB] group-hover:underline">
              {a.file_name}
            </p>
            <p className="text-[11px] text-[#94A3B8]">
              {formatBytes(a.size_bytes)}
              {a.uploaded_by_name ? ` · ${a.uploaded_by_name}` : ''}
            </p>
          </button>
          </Tooltip>
          <Tooltip label="Download">
          <button
            type="button"
            onClick={() => onDownload(a)}
            className="shrink-0 w-8 h-8 rounded-[8px] flex items-center justify-center text-[#475569] hover:bg-[#F1F5F9] hover:text-[#2563EB] transition-colors"
            aria-label="Download"
          >
            <Download size={15} />
          </button>
          </Tooltip>
          {onRemove && (!canRemove || canRemove(a)) && (
            <Tooltip label="Remove">
            <button
              type="button"
              onClick={() => onRemove(a)}
              className="shrink-0 w-8 h-8 rounded-[8px] flex items-center justify-center text-[#94A3B8] hover:bg-[#FEE2E2] hover:text-[#DC2626] transition-colors"
              aria-label="Remove"
            >
              <X size={15} />
            </button>
            </Tooltip>
          )}
        </div>
      ))}
    </div>
  )
}

/** Compact read-only chips — for rendering a comment's attachments inline. */
export function AttachmentChips({
  attachments,
  onDownload,
}: {
  attachments: TaskAttachment[]
  onDownload: (a: TaskAttachment) => void
}) {
  if (attachments.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {attachments.map((a) => (
        <Tooltip key={a.id} label={`Download ${a.file_name}`}>
        <button
          type="button"
          onClick={() => onDownload(a)}
          className="flex items-center gap-1.5 text-xs text-[#2563EB] hover:underline bg-[#EFF6FF] px-2 py-1 rounded-[6px] border border-[#BFDBFE] max-w-[220px]"
        >
          <FileText size={11} className="shrink-0" />
          <span className="truncate">{a.file_name}</span>
          <span className="text-[#94A3B8] shrink-0">{formatBytes(a.size_bytes)}</span>
        </button>
        </Tooltip>
      ))}
    </div>
  )
}

/** Local files selected but not yet uploaded — shown with a remove control or a spinner. */
export function PendingFileList({
  files,
  onRemove,
  uploading = false,
}: {
  files: File[]
  onRemove?: (index: number) => void
  uploading?: boolean
}) {
  if (files.length === 0) return null
  return (
    <div className="space-y-2 mt-2">
      {files.map((f, i) => (
        <div
          key={`${f.name}-${i}`}
          className="flex items-center gap-3 rounded-[10px] border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2"
        >
          <KindBadge name={f.name} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[#0F172A] truncate">{f.name}</p>
            <p className="text-[11px] text-[#94A3B8]">{formatBytes(f.size)}</p>
          </div>
          {uploading ? (
            <Loader2 size={15} className="shrink-0 text-[#2563EB] animate-spin" />
          ) : (
            onRemove && (
              <Tooltip label="Remove">
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="shrink-0 w-8 h-8 rounded-[8px] flex items-center justify-center text-[#94A3B8] hover:bg-[#FEE2E2] hover:text-[#DC2626] transition-colors"
                aria-label="Remove"
              >
                <X size={15} />
              </button>
              </Tooltip>
            )
          )}
        </div>
      ))}
    </div>
  )
}
