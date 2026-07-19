'use client'

import { useEffect, useRef, useState } from 'react'
import { ExternalLink, Loader2, RotateCcw } from 'lucide-react'
import { toEmbeddableVideoUrl, toEmbeddablePageUrl } from '@/lib/learning/video-embed'

/**
 * Shows a link inline automatically — no creator toggle. It tries to embed the page
 * in an iframe; if the page hasn't loaded within a few seconds (sites that block
 * framing via X-Frame-Options give no clean JS signal), it falls back on its own to
 * an "Open Link" button. Recognised providers (YouTube, Google Docs, Loom…) load
 * instantly and stay embedded.
 *
 * Two recovery controls, since an embed window has no browser chrome of its own:
 *  • Reload — resets the frame to the original link (get back after clicking through,
 *    or retry a page that was slow / just made shareable).
 *  • Open in new tab — the escape hatch for login-gated content (e.g. a restricted
 *    Drive file), which can't authenticate you inside a frame (third-party cookies).
 */
export default function LinkEmbed({
  url,
  title,
  onOpen,
}: {
  url: string
  title: string
  /** Called when the learner opens the link externally (e.g. to mark progress). */
  onOpen?: () => void
}) {
  const [status, setStatus] = useState<'loading' | 'ok' | 'blocked'>('loading')
  const [reloadKey, setReloadKey] = useState(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const src = toEmbeddablePageUrl(url)
  const isVideo = toEmbeddableVideoUrl(url) !== url

  useEffect(() => {
    setStatus('loading')
    if (timer.current) clearTimeout(timer.current)
    // No load event in ~5s ⇒ almost certainly blocked from embedding → show the button.
    timer.current = setTimeout(() => setStatus((s) => (s === 'loading' ? 'blocked' : s)), 5000)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [src, reloadKey])

  const reload = () => setReloadKey((k) => k + 1)

  const openTab = (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onOpen}
      title="Open in a new tab"
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-[#2563EB] bg-[#EFF6FF] border border-[#BFDBFE] rounded-[8px] hover:bg-[#DBEAFE] transition-colors"
    >
      <ExternalLink size={14} /> Open in new tab
    </a>
  )

  // Blocked → a clean Open button instead of a dead blank frame (+ a retry).
  if (status === 'blocked') {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <p className="text-sm text-[#475569] max-w-md">
          This page can’t be shown inside the app — open it in a new tab to view it.
        </p>
        <div className="flex items-center gap-3">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onOpen}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-[8px] transition-colors"
          >
            <ExternalLink size={15} /> Open Link
          </a>
          <button
            onClick={reload}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#475569] hover:text-[#2563EB] transition-colors"
          >
            <RotateCcw size={14} /> Try again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-end gap-2 mb-2">
        <button
          onClick={reload}
          title="Reload / back to start"
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[#475569] bg-white border border-[#E2E8F0] rounded-[8px] hover:text-[#2563EB] hover:border-[#2563EB] transition-colors"
        >
          <RotateCcw size={14} /> Reload
        </button>
        {openTab}
      </div>
      <div
        className={[
          'relative w-full rounded-[8px] overflow-hidden',
          isVideo ? 'aspect-video bg-black' : 'border border-[#E2E8F0] bg-white',
        ].join(' ')}
        style={isVideo ? undefined : { height: '70vh' }}
      >
        {status === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-[#475569] bg-[#F8FAFC] z-10">
            <Loader2 size={18} className="animate-spin text-[#2563EB]" /> Loading page…
          </div>
        )}
        <iframe
          key={reloadKey}
          src={src}
          className="w-full h-full"
          title={title}
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
          onLoad={() => { if (timer.current) clearTimeout(timer.current); setStatus('ok') }}
        />
      </div>
    </div>
  )
}
