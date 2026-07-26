// Copies the pdf.js library + worker out of node_modules into /public so they are
// served same-origin and stay OUT of the webpack module graph. MaterialViewer loads
// both via `import('/pdf.min.mjs')` / `workerSrc = '/pdf.worker.min.mjs'` at runtime,
// which avoids the bundler choking on pdf.mjs's fake-worker `import(this.workerSrc)`
// fallback. Runs on install/dev/build so the copies never drift from the installed
// pdfjs-dist version.
import { copyFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const src = join(root, 'node_modules', 'pdfjs-dist', 'build')
const dest = join(root, 'public')

const files = ['pdf.min.mjs', 'pdf.worker.min.mjs']

try {
  await mkdir(dest, { recursive: true })
  await Promise.all(files.map((f) => copyFile(join(src, f), join(dest, f))))
  console.log(`[copy-pdfjs] copied ${files.join(', ')} -> public/`)
} catch (err) {
  console.error('[copy-pdfjs] failed:', err.message)
  process.exit(1)
}
