'use client'

import { useEffect, useState } from 'react'
import { Eye, Pencil, Lock, Check } from 'lucide-react'
import Button from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { meetingsApi } from '@/lib/api/meetings'
import { renderMarkdown } from '@/lib/markdown'
import type { Meeting } from '@/lib/types/meetings'

function MarkdownField({
  label, value, onChange, locked,
}: { label: string; value: string; onChange: (v: string) => void; locked: boolean }) {
  const [preview, setPreview] = useState(false)
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-sm font-medium text-[#374151]">{label}</label>
        {!locked && (
          <button type="button" onClick={() => setPreview((p) => !p)} className="inline-flex items-center gap-1 text-xs font-medium text-[#2563EB]">
            {preview ? <><Pencil size={12} /> Edit</> : <><Eye size={12} /> Preview</>}
          </button>
        )}
      </div>
      {locked || preview ? (
        <div className="min-h-[80px] border border-[#E2E8F0] rounded-[8px] px-3 py-2 text-[15px] text-[#1E293B] prose-sm" dangerouslySetInnerHTML={{ __html: renderMarkdown(value) || '<span class="text-[#94A3B8]">Nothing yet.</span>' }} />
      ) : (
        <textarea
          className="w-full border border-[#CBD5E1] rounded-[8px] px-3 py-2 text-[15px] text-[#0F172A] focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] resize-y font-mono text-[13px]"
          rows={label === 'Minutes (MoM)' ? 10 : 4}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Markdown supported — # heading, **bold**, - list"
        />
      )}
    </div>
  )
}

export default function MeetingRecordTab({ orgId, meeting, canEdit, onSaved }: { orgId: string; meeting: Meeting; canEdit: boolean; onSaved: () => void }) {
  const { addToast } = useToast()
  const locked = meeting.status === 'closed' || meeting.status === 'cancelled' || !canEdit
  const [agenda, setAgenda] = useState(meeting.agenda ?? '')
  const [minutes, setMinutes] = useState(meeting.minutes ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setAgenda(meeting.agenda ?? '')
    setMinutes(meeting.minutes ?? '')
  }, [meeting.id, meeting.agenda, meeting.minutes])

  async function save() {
    setSaving(true)
    try {
      await meetingsApi.updateRecord(orgId, meeting.id, { agenda, minutes })
      addToast('Record saved', 'success')
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      onSaved()
    } catch (e: any) {
      addToast(e?.response?.data?.message ?? 'Failed to save', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-6 flex flex-col gap-4">
      {meeting.status === 'closed' && (
        <div className="flex items-center gap-2 text-sm text-[#475569] bg-[#F8FAFC] border border-[#E2E8F0] rounded-[8px] px-3 py-2">
          <Lock size={14} /> This meeting is closed — the record is the official, locked version.
        </div>
      )}
      <MarkdownField label="Agenda" value={agenda} onChange={setAgenda} locked={locked} />
      <MarkdownField label="Minutes (MoM)" value={minutes} onChange={setMinutes} locked={locked} />
      {!locked && (
        <div className="flex justify-end items-center gap-3">
          {saved && <span className="inline-flex items-center gap-1 text-sm font-medium text-[#16A34A]"><Check size={15} /> Saved</span>}
          <Button variant="primary" onClick={save} isLoading={saving} disabled={saving}>Save record</Button>
        </div>
      )}
    </div>
  )
}
