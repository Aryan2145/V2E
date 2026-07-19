'use client'

import { useRef, useState } from 'react'
import { Upload, Link2, FileText, Loader2 } from 'lucide-react'
import { ACCEPT_ATTR, validateFile } from '@/lib/attachments'
import type { ContentType } from '@/lib/types/learning'

/**
 * The four ways to add a material, as one inline toolbar (not a separate page).
 * "Upload file" creates a file item then uploads the picked file; the others
 * create an empty item of that type for inline editing in the row. The parent
 * owns item creation + upload (it has orgId + the draft path); this bar just
 * validates the pick and drives the busy/error UI.
 */
export default function AddMaterialBar({
  onAdd,
}: {
  onAdd: (type: ContentType, file?: File) => Promise<void>
}) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<ContentType | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function run(type: ContentType, file?: File) {
    if (type === 'file' && file) {
      const bad = validateFile(file)
      if (bad) { setErr(bad); return }
    }
    setErr(null)
    setBusy(type)
    try {
      await onAdd(type, file)
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? e?.message ?? 'Something went wrong. Please try again.')
    } finally {
      setBusy(null)
    }
  }

  const btn =
    'flex items-center gap-2 px-3.5 py-2.5 text-sm font-medium rounded-[8px] border transition-colors disabled:opacity-60 disabled:cursor-not-allowed'

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!!busy}
          onClick={() => fileInput.current?.click()}
          className={`${btn} text-white bg-[#2563EB] border-[#2563EB] hover:bg-[#1D4ED8]`}
        >
          {busy === 'file' ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
          Upload file
        </button>
        <button type="button" disabled={!!busy} onClick={() => run('url')}
          className={`${btn} text-[#475569] bg-white border-[#CBD5E1] hover:border-[#2563EB] hover:text-[#2563EB]`}>
          <Link2 size={15} /> Add link
        </button>
        <button type="button" disabled={!!busy} onClick={() => run('article')}
          className={`${btn} text-[#475569] bg-white border-[#CBD5E1] hover:border-[#2563EB] hover:text-[#2563EB]`}>
          <FileText size={15} /> Write article
        </button>
      </div>
      <p className="text-[11px] text-[#475569] mt-2">
        PDF, images and video/audio play in-app · up to 25 MB. For slides, export PowerPoint to PDF so it plays in-app (Office files upload but open by download).
      </p>
      {err && <p className="text-xs text-[#DC2626] mt-1">{err}</p>}
      <input
        ref={fileInput}
        type="file"
        accept={ACCEPT_ATTR}
        className="hidden"
        onChange={(e) => { run('file', e.target.files?.[0]); e.target.value = '' }}
      />
    </div>
  )
}
