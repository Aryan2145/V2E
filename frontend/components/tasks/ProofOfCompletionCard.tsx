'use client'

import { useCallback, useEffect, useState } from 'react'
import { ShieldCheck, CheckCircle2, Clock, Download, Lock, Users } from 'lucide-react'
import FileDropzone, { AttachmentErrorBox } from '@/components/ui/FileDropzone'
import { useAuth } from '@/lib/auth/context'
import { tasksApi } from '@/lib/api/tasks'
import { extensionOf, fileKindLabel, formatBytes } from '@/lib/attachments'
import type { Task, TaskAssigneeUser, TaskAttachment, ProofVisibility } from '@/lib/types/tasks'

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

interface Props {
  task: Task
  assignees: TaskAssigneeUser[]
  /** Bumped by the parent to force a proof reload (e.g. after "mark as proof" from a comment). */
  reloadToken: number
  /** Task is closed — hide the upload control. */
  locked?: boolean
  onChanged: () => void
}

/**
 * File-based proof of completion. In all_must_complete it's a per-person scoreboard
 * ("n/N submitted") — the assigner/admin and each uploader see the files; other
 * assignees see only who has submitted (files stay private unless shared). In
 * any_can_complete a single proof satisfies the task. Visibility filtering is done
 * server-side (listProofs), so `proofs` here already excludes what the viewer can't see.
 */
export default function ProofOfCompletionCard({ task, assignees, reloadToken, locked, onChanged }: Props) {
  const { user } = useAuth()
  const orgId = user?.organizationId ?? ''
  const [proofs, setProofs] = useState<TaskAttachment[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [visibility, setVisibility] = useState<ProofVisibility>('private')

  const isAllMust = task.completion_mode === 'all_must_complete'
  const primary = assignees.filter((a) => !a.is_cc)
  const iAmAssignee = primary.some((a) => a.user_id === user?.id)
  const allowed = task.proof_allowed_extensions ?? []

  const load = useCallback(() => {
    if (!orgId) return
    tasksApi.listProofs(orgId, task.id).then(setProofs).catch(() => setProofs([]))
  }, [orgId, task.id])
  useEffect(() => { load() }, [load, reloadToken])

  const summary = task.proof_summary
  const submittedIds = new Set(summary?.submitted_user_ids ?? [])
  const requiredCount = summary?.required_user_ids?.length ?? primary.length
  const submittedCount = summary?.submitted_user_ids?.length ?? 0

  const proofsByUser = new Map<string, TaskAttachment[]>()
  for (const p of proofs) {
    const uid = p.uploaded_by_user_id ?? ''
    const list = proofsByUser.get(uid) ?? []
    list.push(p)
    proofsByUser.set(uid, list)
  }

  async function handleFiles(files: File[]) {
    setErrors([])
    if (allowed.length > 0) {
      const bad = files.filter((f) => !allowed.includes(extensionOf(f.name)))
      if (bad.length) {
        setErrors(bad.map((f) => `"${f.name}" isn't an accepted proof type.`))
        return
      }
    }
    setUploading(true)
    try {
      for (const f of files) {
        await tasksApi.uploadProof(orgId, task.id, f, isAllMust ? visibility : 'everyone')
      }
      load()
      onChanged()
    } catch (e: any) {
      setErrors([e?.response?.data?.message ?? 'Upload failed. Please try again.'])
    } finally {
      setUploading(false)
    }
  }

  const download = (a: TaskAttachment) => tasksApi.downloadProof(orgId, task.id, a.id).catch(() => {})

  function FileRow({ a }: { a: TaskAttachment }) {
    return (
      <div className="flex items-center gap-2 text-[12px]">
        <span className="shrink-0 inline-flex items-center justify-center w-8 h-5 rounded bg-[#EFF6FF] text-[#2563EB] text-[9px] font-bold">
          {fileKindLabel(a.file_name)}
        </span>
        <button onClick={() => download(a)} className="min-w-0 truncate text-[#2563EB] hover:underline text-left" title={a.file_name}>
          {a.file_name}
        </button>
        <span className="shrink-0 text-[#94A3B8]">{formatBytes(a.size_bytes)}</span>
        <span className="shrink-0 text-[#94A3B8]">· {formatWhen(a.created_at)}</span>
        {a.proof_visibility === 'everyone' && (
          <span className="shrink-0 inline-flex items-center gap-0.5 text-[10px] text-[#64748B]" title="Visible to everyone on the task">
            <Users size={10} /> shared
          </span>
        )}
        <button onClick={() => download(a)} className="ml-auto shrink-0 text-[#64748B] hover:text-[#2563EB]" title="Download">
          <Download size={13} />
        </button>
      </div>
    )
  }

  const uploader = iAmAssignee && !locked && (
    <div className="mt-3">
      {isAllMust && (
        <div className="mb-2">
          <p className="text-[11px] font-medium text-[#64748B] mb-1">Who can see this proof?</p>
          <div className="flex gap-3">
            {([
              { v: 'private' as ProofVisibility, label: 'Only the assigner' },
              { v: 'everyone' as ProofVisibility, label: 'Everyone on the task' },
            ]).map((o) => (
              <label key={o.v} className="flex items-center gap-1.5 text-[12px] text-[#334155] cursor-pointer">
                <input type="radio" name="proof-visibility" className="accent-[#2563EB]" checked={visibility === o.v} onChange={() => setVisibility(o.v)} />
                {o.label}
              </label>
            ))}
          </div>
        </div>
      )}
      <FileDropzone onFiles={handleFiles} onReject={setErrors} disabled={uploading} compact />
      {uploading && <p className="mt-1 text-[11px] text-[#64748B]">Uploading…</p>}
      {errors.length > 0 && <div className="mt-2"><AttachmentErrorBox errors={errors} onDismiss={() => setErrors([])} /></div>}
    </div>
  )

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-[12px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[15px] font-semibold text-[#0F172A] flex items-center gap-2">
          <ShieldCheck size={15} className="text-[#2563EB]" />
          Proof of Completion
        </h3>
        {isAllMust ? (
          <span className={`text-[11px] font-semibold rounded-full px-2 py-0.5 ${submittedCount >= requiredCount && requiredCount > 0 ? 'bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0]' : 'bg-[#FEF9C3] text-[#B45309] border border-[#FDE68A]'}`}>
            {submittedCount}/{requiredCount} submitted
          </span>
        ) : (
          summary?.task_has_any_proof ? (
            <span className="text-[11px] font-semibold rounded-full px-2 py-0.5 bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0]">Submitted</span>
          ) : (
            <span className="text-[11px] font-semibold rounded-full px-2 py-0.5 bg-[#FEF9C3] text-[#B45309] border border-[#FDE68A]">Pending</span>
          )
        )}
      </div>

      {allowed.length > 0 && (
        <p className="text-[11px] text-[#64748B] mb-2">Accepted: {allowed.join(', ')}</p>
      )}

      {isAllMust ? (
        <div className="space-y-2.5">
          {primary.map((a) => {
            const name = a.user?.name ?? a.user_name ?? 'Unknown'
            const submitted = submittedIds.has(a.user_id)
            const files = proofsByUser.get(a.user_id) ?? []
            const isMe = a.user_id === user?.id
            return (
              <div key={a.id} className="border-l-2 border-[#E2E8F0] pl-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[#0F172A]">{name}{isMe && <span className="text-[#64748B] font-normal"> (you)</span>}</span>
                  {submitted ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#16A34A]"><CheckCircle2 size={12} /> Submitted</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#B45309]"><Clock size={12} /> Pending</span>
                  )}
                </div>
                {files.length > 0 && (
                  <div className="mt-1.5 space-y-1">{files.map((f) => <FileRow key={f.id} a={f} />)}</div>
                )}
                {submitted && files.length === 0 && !isMe && (
                  <p className="mt-1 text-[11px] text-[#94A3B8] inline-flex items-center gap-1"><Lock size={10} /> File visible to the assigner only</p>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="space-y-1.5">
          {proofs.length > 0 ? (
            proofs.map((p) => <FileRow key={p.id} a={p} />)
          ) : (
            <p className="text-[13px] text-[#64748B]">No proof submitted yet. One proof file from anyone on the task is enough.</p>
          )}
        </div>
      )}

      {uploader}
    </div>
  )
}
