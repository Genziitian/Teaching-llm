/**
 * Google Drive helpers for streaming course videos and documents through our own API.
 *
 * Auth resolution order:
 *   1. Service account (preferred) — uses GOOGLE_SERVICE_ACCOUNT_EMAIL + _PRIVATE_KEY
 *      with the `drive.readonly` scope. Files must be shared with the SA email.
 *      If that fails and GOOGLE_WORKSPACE_ADMIN_EMAIL is set, the same service
 *      account retries while impersonating that Workspace user (domain-wide
 *      delegation), so files the admin can open need no extra sharing.
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

/* Which Google identity the server uses when it talks to Drive.
 *
 *   service-account  — the service account itself. Only sees files that are
 *                      shared directly with the SA email (or with a group the
 *                      SA is a member of).
 *   delegated-admin  — the same service account impersonating
 *                      GOOGLE_WORKSPACE_ADMIN_EMAIL through domain-wide
 *                      delegation (the mechanism Google Group sync already
 *                      uses). Sees everything that Workspace user can see, so
 *                      restricted files work without sharing each one with the
 *                      SA. Requires the `drive.readonly` scope to be authorised
 *                      for the SA's client ID in the Workspace Admin console.
 *
 * NOTE: a student's own Google account is never used here. Students sign in to
 * the app with Google only to prove who they are; the video bytes are always
 * fetched by the server. So "the student's email can open the file in Drive"
 * does not help unless one of the two identities above can open it too.
 */
export type DriveIdentity = 'service-account' | 'delegated-admin'

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.readonly'
const driveClients: Partial<Record<DriveIdentity, drive_v3.Drive>> = {}
// Identity that last worked for a file, so Range requests don't re-try the failing one.
const fileIdentity = new Map<string, DriveIdentity>()
// When delegation itself is refused (scope not authorised) skip it for a while.
let delegationBlockedUntil = 0

function readServiceAccountCredentials(): { email: string; key: string } | null {
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
  return { email: email.trim(), key }
}

function getDriveClient(identity: DriveIdentity): drive_v3.Drive | null {
  const cached = driveClients[identity]
  if (cached) return cached
  const creds = readServiceAccountCredentials()
  if (!creds) return null

  let subject: string | undefined
  if (identity === 'delegated-admin') {
    subject = process.env.GOOGLE_WORKSPACE_ADMIN_EMAIL?.trim()
    if (!subject) return null
  }

  try {
    const auth = new google.auth.JWT({
      email: creds.email,
      key: creds.key,
      subject,
      scopes: [DRIVE_SCOPE],
    })
    const client = google.drive({ version: 'v3', auth })
    driveClients[identity] = client
    return client
  } catch (err: any) {
    console.warn(`[drive] Failed to initialize Drive client (${identity}):`, err?.message || err)
    return null
  }
}

function identitiesFor(fileId: string): DriveIdentity[] {
  const all: DriveIdentity[] = ['service-account']
  if (process.env.GOOGLE_WORKSPACE_ADMIN_EMAIL && Date.now() >= delegationBlockedUntil) {
    all.push('delegated-admin')
  }
  const known = fileIdentity.get(fileId)
  if (known && all.includes(known)) return [known, ...all.filter(i => i !== known)]
  return all
}

function rememberIdentity(fileId: string, identity: DriveIdentity) {
  if (fileIdentity.size > 5000) fileIdentity.clear()
  fileIdentity.set(fileId, identity)
}

/* Turn a googleapis error into something a human can act on. */
function describeDriveError(err: any): { code: string; message: string; authFailure: boolean } {
  const oauthError = err?.response?.data?.error
  const authFailure =
    typeof oauthError === 'string' && ['unauthorized_client', 'invalid_grant', 'access_denied', 'invalid_client'].includes(oauthError)
  const code = String(authFailure ? oauthError : err?.code ?? err?.response?.status ?? 'unknown')
  const message =
    err?.response?.data?.error_description ||
    err?.errors?.[0]?.message ||
    (typeof oauthError === 'object' ? oauthError?.message : undefined) ||
    err?.message ||
    'Unknown Drive error'
  return { code, message: String(message), authFailure }
}

function noteIdentityFailure(identity: DriveIdentity, fileId: string, err: any) {
  const d = describeDriveError(err)
  if (identity === 'delegated-admin' && d.authFailure) {
    // Delegation is not authorised for the Drive scope — retrying on every
    // Range request would only add latency.
    delegationBlockedUntil = Date.now() + 10 * 60 * 1000
  }
  if (fileIdentity.get(fileId) === identity) fileIdentity.delete(fileId)
  console.warn(`[drive] ${identity} could not read file ${fileId}: [${d.code}] ${d.message}`)
}

export type DriveDiagnosis = {
  fileId: string
  authMode: DriveAuthMode
  serviceAccountEmail: string | null
  delegatedAdminEmail: string | null
  attempts: Array<{
    identity: DriveIdentity
    ok: boolean
    fileName?: string
    mimeType?: string
    errorCode?: string
    error?: string
  }>
  hint: string
}

/* Manager-only diagnostic: asks Drive, as each server identity, whether it can
 * see the file, and reports Google's real answer instead of a generic 502.
 */
export async function diagnoseDriveAccess(fileId: string): Promise<DriveDiagnosis> {
  const creds = readServiceAccountCredentials()
  const adminEmail = process.env.GOOGLE_WORKSPACE_ADMIN_EMAIL?.trim() || null
  const out: DriveDiagnosis = {
    fileId,
    authMode: getDriveAuthMode(),
    serviceAccountEmail: creds?.email ?? null,
    delegatedAdminEmail: adminEmail,
    attempts: [],
    hint: '',
  }

  if (!creds) {
    out.hint =
      'GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY are not set on this server, so it can only download files shared as "Anyone with the link". Set both env vars on the hosting dashboard and redeploy.'
    return out
  }

  const identities: DriveIdentity[] = adminEmail ? ['service-account', 'delegated-admin'] : ['service-account']
  for (const identity of identities) {
    const drive = getDriveClient(identity)
    if (!drive) {
      out.attempts.push({ identity, ok: false, errorCode: 'init', error: 'Could not build a Drive client (private key malformed?)' })
      continue
    }
    try {
      const meta = await drive.files.get({ fileId, fields: 'id, name, mimeType', supportsAllDrives: true })
      out.attempts.push({ identity, ok: true, fileName: meta.data.name || undefined, mimeType: meta.data.mimeType || undefined })
    } catch (err: any) {
      const d = describeDriveError(err)
      out.attempts.push({ identity, ok: false, errorCode: d.code, error: d.message })
    }
  }

  if (out.attempts.some(a => a.ok)) {
    out.hint = 'The server can read this file. If playback still fails the problem is elsewhere (network, file format, quota).'
  } else {
    const sa = out.attempts.find(a => a.identity === 'service-account')
    const keyProblem = sa && ['invalid_grant', 'invalid_client', 'init'].includes(sa.errorCode || '')
    out.hint = keyProblem
      ? 'Google rejected the service account key itself (deleted, rotated or mangled). Create a new key for the service account and update GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.'
      : `No server identity can see this file. Share the file (or better, its parent folder / shared drive) with ${creds.email} as Viewer` +
        (adminEmail
          ? `, or authorise the scope ${DRIVE_SCOPE} for this service account under Admin console > Security > API controls > Domain-wide delegation so it can read as ${adminEmail}.`
          : '.')
  }
  return out
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
    for (const identity of identitiesFor(fileId)) {
      const drive = getDriveClient(identity)
      if (!drive) continue

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
          rememberIdentity(fileId, identity)
          return {
            stream: res.data as unknown as Readable,
            status: (res as any).status || 200,
            headers,
          }
        }
      } catch (metaErr: any) {
        const d = describeDriveError(metaErr)
        if (d.authFailure || d.code === '404') {
          // This identity cannot authenticate / cannot see the file at all —
          // the media download would fail the same way, so move on.
          noteIdentityFailure(identity, fileId, metaErr)
          continue
        }
        // Otherwise fall through to the media download attempt
        console.warn(`[drive] metadata check error (${identity}), falling back to direct download:`, d.message)
      }

      try {
        const res = await drive.files.get(
          { fileId, alt: 'media', supportsAllDrives: true },
          { responseType: 'stream', headers: requestHeaders }
        )
        rememberIdentity(fileId, identity)
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
            rememberIdentity(fileId, identity)
            return {
              stream: res.data as unknown as Readable,
              status: (res as any).status || 200,
              headers,
            }
          } catch (_) {}
        }
        noteIdentityFailure(identity, fileId, err)
      }
    }
    console.warn(`[drive] no server identity could read ${fileId}; falling back to public download (works only for "Anyone with the link" files)`)
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

  const ct = res.headers.get('content-type') || ''
  if (ct.includes('html')) {
    // Google Drive often returns an HTML confirmation page for large files (virus scan warning)
    const text = await res.text()
    let confirmUrl: string | null = null
    const linkMatch = text.match(/href="(\/uc\?export=download[^"]+confirm=[^"]+)"/i) ||
      text.match(/href="(https:\/\/drive\.usercontent\.google\.com\/download[^"]+confirm=[^"]+)"/i)
    if (linkMatch) {
      confirmUrl = linkMatch[1].startsWith('/') ? `https://drive.google.com${linkMatch[1]}` : linkMatch[1]
      confirmUrl = confirmUrl.replace(/&amp;/g, '&')
    } else {
      const actionMatch = text.match(/action="(https:\/\/drive\.usercontent\.google\.com\/download[^"]*|\/uc\?export=download[^"]*)"/i)
      if (actionMatch) {
        const baseAction = actionMatch[1].startsWith('/') ? `https://drive.google.com${actionMatch[1]}` : actionMatch[1]
        const formInputs = Array.from(text.matchAll(/<input[^>]+name="([^"]+)"[^>]+value="([^"]*)"/gi))
        const params = new URLSearchParams()
        for (const input of formInputs) {
          params.set(input[1], input[2])
        }
        if (!params.has('id')) params.set('id', fileId)
        if (!params.has('export')) params.set('export', 'download')
        confirmUrl = `${baseAction}?${params.toString()}`
      }
    }

    if (confirmUrl) {
      const setCookies = res.headers.get('set-cookie')
      const confirmHeaders: Record<string, string> = { ...requestHeaders }
      if (setCookies) confirmHeaders['Cookie'] = setCookies

      const confirmRes = await fetch(confirmUrl, { headers: confirmHeaders, redirect: 'follow' })
      const confirmCt = confirmRes.headers.get('content-type') || ''
      if (confirmRes.ok && confirmRes.body && !confirmCt.includes('html')) {
        return {
          stream: confirmRes.body as ReadableStream<Uint8Array>,
          status: confirmRes.status,
          headers: pickHeadersFromHeaders(confirmRes.headers),
        }
      }
    }

    throw new Error(
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
        ? 'Google Drive file is restricted and the server account has no access to it. A manager must share the file or its folder with the server service account.'
        : 'Google Drive file is restricted and no service account is configured on the server. Configure the Google service account or set sharing to "Anyone with the link".'
    )
  }

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
