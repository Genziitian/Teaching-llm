/**
 * Copies the pdfjs-dist worker into `public/` so it's served from our own
 * origin at `/pdf.worker.min.mjs` with the correct MIME type. Run by the
 * `postinstall` script — no manual steps required.
 *
 * IMPORTANT: react-pdf bundles its own version of pdfjs-dist as a direct
 * dependency. The worker MUST come from the same pdfjs-dist that react-pdf
 * uses, otherwise the API version and Worker version will mismatch at
 * runtime. We prefer react-pdf's nested copy first, then fall back to the
 * top-level pdfjs-dist.
 */
const fs = require('fs')
const path = require('path')

// Prefer react-pdf's nested pdfjs-dist (matches the API version react-pdf bundles)
const reactPdfWorker = path.join(
  __dirname,
  '..',
  'node_modules',
  'react-pdf',
  'node_modules',
  'pdfjs-dist',
  'build',
  'pdf.worker.min.mjs',
)

// Fallback to top-level pdfjs-dist
const topLevelWorker = path.join(
  __dirname,
  '..',
  'node_modules',
  'pdfjs-dist',
  'build',
  'pdf.worker.min.mjs',
)

const src = fs.existsSync(reactPdfWorker) ? reactPdfWorker : topLevelWorker
const destDir = path.join(__dirname, '..', 'public')
const dest = path.join(destDir, 'pdf.worker.min.mjs')

if (!fs.existsSync(src)) {
  console.warn('[copy-pdf-worker] source missing, skipping:', src)
  process.exit(0)
}

fs.mkdirSync(destDir, { recursive: true })
fs.copyFileSync(src, dest)
console.log('[copy-pdf-worker] wrote', dest, '(from', src, ')')
