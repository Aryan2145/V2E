'use client'

import { useEffect, useRef, useState } from 'react'
import { Eye, Pencil, Lock, Check, Bold, Heading, List } from 'lucide-react'
import Button from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { meetingsApi } from '@/lib/api/meetings'
import { renderMarkdown } from '@/lib/markdown'
import type { Meeting } from '@/lib/types/meetings'

// A plain rich-ish text field. People format by clicking Bold / Heading / List —
// no syntax to learn, no "markdown" jargon. Preview shows the formatted result.
function RichField({
  label, value, onChange, locked, rows, placeholder,
}: { label: string; value: string; onChange: (v: string) => void; locked: boolean; rows: number; placeholder: string }) {
  const [preview, setPreview] = useState(false)
  const ref = useRef<HTMLTextAreaElement>(null)

  function wrap(before: string, after: string) {
    const ta = ref.current
    if (!ta) return
    const s = ta.selectionStart, e = ta.selectionEnd
    const sel = value.slice(s, e)
    const next = value.slice(0, s) + before + sel + after + value.slice(e)
    onChange(next)
    requestAnimationFrame(() => { ta.focus(); ta.selectionStart = s + before.length; ta.selectionEnd = e + before.length })
  }

  function linePrefix(prefix: string) {
    const ta = ref.current
    if (!ta) return
    const s = ta.selectionStart, e = ta.selectionEnd
    const lineStart = value.lastIndexOf('\n', s - 1) + 1
    const segment = value.slice(lineStart, e)
    const prefixed = segment.split('\n').map((l) => (l.startsWith(prefix) ? l : prefix + l)).join('\n')
    onChange(value.slice(0, lineStart) + prefixed + value.slice(e))
    requestAnimationFrame(() => ta.focus())
  }

  const toolBtn = 'inline-flex items-center justify-center w-7 h-7 rounded-[6px] text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0F172A]'

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
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
        <div className="border border-[#CBD5E1] rounded-[8px] focus-within:border-[#2563EB] focus-within:ring-1 focus-within:ring-[#2563EB] overflow-hidden">
          <div className="flex items-center gap-0.5 px-1.5 py-1 border-b border-[#E2E8F0] bg-[#F8FAFC]">
            <button type="button" title="Bold" onClick={() => wrap('**', '**')} className={toolBtn}><Bold size={15} /></button>
            <button type="button" title="Heading" onClick={() => linePrefix('## ')} className={toolBtn}><Heading size={15} /></button>
            <button type="button" title="Bullet list" onClick={() => linePrefix('- ')} className={toolBtn}><List size={15} /></button>
            <span className="ml-1 text-[11px] text-[#94A3B8]">Select text, then click a button to format</span>
          </div>
          <textarea
            ref={ref}
            className="w-full px-3 py-2 text-[15px] text-[#0F172A] focus:outline-none resize-y"
            rows={rows}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
          />
        </div>
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
      <RichField label="Agenda" value={agenda} onChange={setAgenda} locked={locked} rows={4} placeholder="What will you discuss? One point per line." />
      <RichField label="Minutes" value={minutes} onChange={setMinutes} locked={locked} rows={10} placeholder="Capture what was discussed and the decisions made." />
      {!locked && (
        <div className="flex justify-end items-center gap-3">
          {saved && <span className="inline-flex items-center gap-1 text-sm font-medium text-[#16A34A]"><Check size={15} /> Saved</span>}
          <Button variant="primary" onClick={save} isLoading={saving} disabled={saving}>Save record</Button>
        </div>
      )}
    </div>
  )
}
