// Client-side attachment rules — kept in sync with the backend
// (backend/src/tasks/task-attachments.service.ts). Validating here too gives
// instant feedback and avoids a wasted round-trip on obviously-bad files.

export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024 // 25 MB

export const ALLOWED_EXTENSIONS = [
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'txt',
  'csv',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'zip',
  'mp4',
  'webm',
  'mov',
  'mp3',
] as const

/** The `accept` attribute value for a file input, from the allowed extensions. */
export const ACCEPT_ATTR = ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(',')

/**
 * Broad file-type groups for the proof "allowed types" picker. Each group maps to a
 * set of extensions; the stored `proof_allowed_extensions` is the union of the checked
 * groups (empty = anything allowed).
 */
export const FILE_TYPE_GROUPS: { key: string; label: string; extensions: string[] }[] = [
  { key: 'images', label: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] },
  { key: 'pdf', label: 'PDF', extensions: ['pdf'] },
  { key: 'documents', label: 'Documents', extensions: ['doc', 'docx', 'txt', 'ppt', 'pptx'] },
  { key: 'spreadsheets', label: 'Spreadsheets', extensions: ['xls', 'xlsx', 'csv'] },
  { key: 'video', label: 'Video', extensions: ['mp4', 'webm', 'mov'] },
  { key: 'audio', label: 'Audio', extensions: ['mp3'] },
  { key: 'archives', label: 'Archives', extensions: ['zip'] },
]

/** An `accept` string from a list of bare extensions (falls back to all allowed). */
export function acceptFromExtensions(exts?: string[] | null): string {
  if (!exts || exts.length === 0) return ACCEPT_ATTR
  return exts.map((e) => `.${e.replace(/^\./, '')}`).join(',')
}

/** Which groups are fully "on" for a given allowed-extensions set (empty = all on). */
export function groupsFromExtensions(exts?: string[] | null): Set<string> {
  const on = new Set<string>()
  if (!exts || exts.length === 0) {
    FILE_TYPE_GROUPS.forEach((g) => on.add(g.key)) // empty = everything allowed
    return on
  }
  const set = new Set(exts.map((e) => e.replace(/^\./, '').toLowerCase()))
  for (const g of FILE_TYPE_GROUPS) {
    if (g.extensions.some((e) => set.has(e))) on.add(g.key)
  }
  return on
}

/** Union of extensions for the checked groups. All groups on → [] (= anything allowed). */
export function extensionsFromGroups(groupKeys: Set<string>): string[] {
  if (groupKeys.size === FILE_TYPE_GROUPS.length) return []
  const out: string[] = []
  for (const g of FILE_TYPE_GROUPS) {
    if (groupKeys.has(g.key)) out.push(...g.extensions)
  }
  return out
}

export function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : ''
}

/** Returns an error string if the file is invalid, or null if it's acceptable. */
export function validateFile(file: File): string | null {
  if (file.size <= 0) return `"${file.name}" is empty.`
  if (file.size > MAX_ATTACHMENT_BYTES) return `"${file.name}" is ${formatBytes(file.size)} — over the 25 MB limit.`
  const ext = extensionOf(file.name)
  if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) {
    return `"${file.name}" — .${ext || 'unknown'} files are not allowed.`
  }
  return null
}

export function formatBytes(bytes: number): string {
  // Only KB / MB units. Sub-kilobyte files round up to 1 KB (never "0 KB").
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** A short type label for the little file badge, derived from the extension. */
export function fileKindLabel(name: string): string {
  const ext = extensionOf(name)
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) return 'IMG'
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'XLS'
  if (['doc', 'docx'].includes(ext)) return 'DOC'
  if (['ppt', 'pptx'].includes(ext)) return 'PPT'
  return ext ? ext.toUpperCase().slice(0, 4) : 'FILE'
}
