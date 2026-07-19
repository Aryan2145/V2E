/**
 * Converts a user-pasted video URL into a URL that can be embedded in an <iframe>.
 *
 * Sites like YouTube and Vimeo send `X-Frame-Options: SAMEORIGIN` on their normal
 * "watch" pages, so the browser refuses to render them in an iframe and shows
 * "www.youtube.com refused to connect." Each site instead exposes a dedicated
 * player URL (`/embed/ID`) that is allowed to be framed. This maps the common
 * share/watch links to those player URLs. Anything we don't recognise is returned
 * unchanged so non-YouTube/Vimeo embeds keep working.
 */
export function toEmbeddableVideoUrl(raw: string): string {
  if (!raw) return raw

  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    // Users often paste "www.youtube.com/watch?v=…" or "youtu.be/…" without a
    // scheme — new URL() throws on those. Retry with https:// before giving up,
    // otherwise the un-embeddable watch page is what ends up in the iframe.
    try {
      url = new URL(`https://${raw.trim()}`)
    } catch {
      return raw
    }
  }

  const host = url.hostname.replace(/^www\./, '').toLowerCase()

  // --- YouTube ---------------------------------------------------------------
  const isYouTube = host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtu.be'
  if (isYouTube) {
    let videoId = ''

    if (host === 'youtu.be') {
      // https://youtu.be/VIDEO_ID
      videoId = url.pathname.slice(1).split('/')[0]
    } else if (url.pathname === '/watch') {
      // https://www.youtube.com/watch?v=VIDEO_ID
      videoId = url.searchParams.get('v') ?? ''
    } else if (url.pathname.startsWith('/embed/')) {
      // Already an embed URL — leave it as-is.
      return raw
    } else if (url.pathname.startsWith('/shorts/')) {
      // https://www.youtube.com/shorts/VIDEO_ID
      videoId = url.pathname.split('/')[2] ?? ''
    } else if (url.pathname.startsWith('/live/')) {
      // https://www.youtube.com/live/VIDEO_ID
      videoId = url.pathname.split('/')[2] ?? ''
    }

    if (videoId) {
      const embed = new URL(`https://www.youtube.com/embed/${videoId}`)
      // Preserve a start timestamp if present (?t=90 or ?start=90).
      const start = url.searchParams.get('start') ?? parseTimeParam(url.searchParams.get('t'))
      if (start) embed.searchParams.set('start', start)
      // Preserve playlist context if present.
      const list = url.searchParams.get('list')
      if (list) embed.searchParams.set('list', list)
      return embed.toString()
    }
    return raw
  }

  // --- Vimeo -----------------------------------------------------------------
  if (host === 'vimeo.com') {
    // https://vimeo.com/VIDEO_ID  ->  https://player.vimeo.com/video/VIDEO_ID
    const id = url.pathname.split('/').filter(Boolean)[0]
    if (id && /^\d+$/.test(id)) {
      return `https://player.vimeo.com/video/${id}`
    }
    return raw
  }

  // Unknown host (Loom, Wistia, self-hosted, already-embed players, …): keep as-is.
  return raw
}

/** Turns a YouTube `t` value ("90", "1m30s", "90s") into a plain seconds string. */
function parseTimeParam(t: string | null): string {
  if (!t) return ''
  if (/^\d+$/.test(t)) return t
  const m = /^(?:(\d+)m)?(?:(\d+)s)?$/.exec(t)
  if (m && (m[1] || m[2])) {
    const secs = (parseInt(m[1] ?? '0', 10) * 60) + parseInt(m[2] ?? '0', 10)
    return String(secs)
  }
  return ''
}
