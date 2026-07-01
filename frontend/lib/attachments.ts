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
