/**
 * Google Drive helpers for streaming course videos and documents through our own API.
 *
 * Auth resolution order:
 *   1. Service account (preferred) — uses GOOGLE_SERVICE_ACCOUNT_EMAIL + _PRIVATE_KEY
 *      with the `drive.readonly` scope. Files must be shared with the SA email.
 *   2. API key — uses GOOGLE_DRIVE_API_KEY for files that are publicly shared
 *      ("Anyone with the link"). No per-user access control.
 *   3. Anonymous public download — last-resort fallback to
 *      https://drive.google.com/uc?export=download&id=FILE_ID or direct PDF export.
 */
import { google, drive_v3 } from 'googleapis'
import type { Readable } from 'stream'

/* Extract a Drive file ID from any of the URL shapes we accept:
 *   https://drive.google.com/file/d/{ID}/view
 *   https://drive.google.com/file/d/{ID}/preview
 *   https://drive.google.com/open?id={ID}
 *   https://drive.google.com/uc?id={ID}
 *   https://docs.google.com/document/d/{ID}/...
 *   https://docs.google.com/presentation/d/{ID}/...
 *   https://docs.google.com/spreadsheets/d/{ID}/...
 *   {ID}   ← raw id is also accepted
 */
export function extractDriveFileId(input: string | null | undefined): string | null {
  if (!input) return null
  const s = input.trim()
  // Bare id (Drive ids are typically 25–60 chars of [A-Za-z0-9_-])
  if (/^[A-Za-z0-9_-]{15,80}$/.test(s)) return s
  const byPath = s.match(/\/d\/([A-Za-z0-9_-]+)/)
  if (byPath) return byPath[1]
  const byQuery = s.match(/[?&]id=([A-Za-z0-9_-]+)/)
  if (byQuery) return byQuery[1]
  return null
}

export type DriveAuthMode = 'service-account' | 'api-key' | 'public'

export function getDriveAuthMode(): DriveAuthMode {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) return 'service-account'
  if (process.env.GOOGLE_DRIVE_API_KEY) return 'api-key'
  return 'public'
}

let cachedSAClient: drive_v3.Drive | null = null
function getServiceAccountClient(): drive_v3.Drive | null {
  if (cachedSAClient) return cachedSAClient
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  let key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  if (!email || !key) return null

  key = key.trim()
  if (key.startsWith('"') && key.endsWith('"')) {
    key = key.slice(1, -1)
  }
  if (key.startsWith("'") && key.endsWith("'")) {
    key = key.slice(1, -1)
  }
  key = key.replace(/\\n/g, '\n').replace(/\r\n/g, '\n')

  try {
    const auth = new google.auth.JWT({
      email,
      key,
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    })
    cachedSAClient = google.drive({ version: 'v3', auth })
    return cachedSAClient
  } catch (err: any) {
    console.warn('[drive] Failed to initialize Google Service Account client:', err?.message || err)
    return null
  }
}

/* Fetch a byte stream for the given file.
 * Automatically exports native Google Docs, Google Slides, and Google Sheets to PDF.
 */
export async function fetchDriveFileStream(fileId: string, rangeHeader: string | null): Promise<{
  stream: Readable | ReadableStream<Uint8Array>
  status: number
  headers: Record<string, string>
}> {
  const mode = getDriveAuthMode()
  const requestHeaders: Record<string, string> = {}
  if (rangeHeader) requestHeaders['Range'] = rangeHeader

  if (mode === 'service-account') {
    const drive = getServiceAccountClient()
    
    if (drive) {
      // First, check file metadata to see if it's a native Google Doc/Slide/Sheet
      try {
        const meta = await drive.files.get({
          fileId,
          fields: 'id, name, mimeType',
          supportsAllDrives: true,
        })

        const mime = meta.data.mimeType || ''
        if (
          mime.startsWith('application/vnd.google-apps.document') ||
          mime.startsWith('application/vnd.google-apps.presentation') ||
          mime.startsWith('application/vnd.google-apps.spreadsheet')
        ) {
          // Native Google Workspace file -> Export dynamically to PDF
          const res = await drive.files.export(
            { fileId, mimeType: 'application/pdf' },
            { responseType: 'stream' }
          )
          const headers = pickHeaders((res as any).headers)
          headers['content-type'] = 'application/pdf'
          return {
            stream: res.data as unknown as Readable,
            status: (res as any).status || 200,
            headers,
          }
        }
      } catch (metaErr: any) {
        // If metadata check fails, fall through to media download attempt
        console.warn('[drive] metadata check error, falling back to direct download:', metaErr?.message)
      }

      try {
        const res = await drive.files.get(
          { fileId, alt: 'media', supportsAllDrives: true },
          { responseType: 'stream', headers: requestHeaders }
        )
        return { stream: res.data as unknown as Readable, status: (res as any).status || 200, headers: pickHeaders((res as any).headers) }
      } catch (err: any) {
        // If Google rejects alt=media because it is a Google Doc, try export to PDF as fallback
        if (err?.message?.includes('Export') || err?.code === 403 || err?.code === 400) {
          try {
            const res = await drive.files.export(
              { fileId, mimeType: 'application/pdf' },
              { responseType: 'stream' }
            )
            const headers = pickHeaders((res as any).headers)
            headers['content-type'] = 'application/pdf'
            return {
              stream: res.data as unknown as Readable,
              status: (res as any).status || 200,
              headers,
            }
          } catch (_) {}
        }
        console.warn('[drive] service-account download failed, falling back to public/api-key download:', err?.message)
      }
    }
  }

  if (mode === 'api-key') {
    const apiKey = process.env.GOOGLE_DRIVE_API_KEY!
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true&key=${encodeURIComponent(apiKey)}`
    const res = await fetch(url, { headers: requestHeaders })
    if (res.ok && res.body) {
      return { stream: res.body as ReadableStream<Uint8Array>, status: res.status, headers: pickHeadersFromHeaders(res.headers) }
    }
  }

  // Public-download fallback (tries standard download, then Google Docs PDF export)
  const exportUrls = [
    `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`,
    `https://docs.google.com/presentation/d/${encodeURIComponent(fileId)}/export/pdf`,
    `https://docs.google.com/document/d/${encodeURIComponent(fileId)}/export?format=pdf`,
  ]

  for (const url of exportUrls) {
    try {
      const res = await fetch(url, { headers: requestHeaders, redirect: 'follow' })
      const ct = res.headers.get('content-type') || ''
      if (res.ok && res.body && (ct.includes('pdf') || ct.includes('octet-stream') || ct.includes('image') || !ct.includes('html'))) {
        return { stream: res.body as ReadableStream<Uint8Array>, status: res.status, headers: pickHeadersFromHeaders(res.headers) }
      }
    } catch (_) {}
  }

  // Final attempt: standard download URL
  const defaultUrl = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`
  const res = await fetch(defaultUrl, { headers: requestHeaders, redirect: 'follow' })
  if (!res.body) throw new Error('Drive public fetch returned no body')
  return { stream: res.body as ReadableStream<Uint8Array>, status: res.status, headers: pickHeadersFromHeaders(res.headers) }
}

function pickHeaders(raw: any): Record<string, string> {
  const out: Record<string, string> = {}
  if (!raw) return out
  for (const k of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'etag', 'last-modified']) {
    const v = raw[k]
    if (typeof v === 'string') out[k] = v
  }
  return out
}

function pickHeadersFromHeaders(h: Headers): Record<string, string> {
  const out: Record<string, string> = {}
  for (const k of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'etag', 'last-modified']) {
    const v = h.get(k)
    if (v) out[k] = v
  }
  return out
}
