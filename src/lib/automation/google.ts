import { OAuth2Client, JWT } from 'google-auth-library'

export class ImportError extends Error {
  constructor(public code: string, message: string, public retryable = false, public retryAt?: Date) { super(message); Object.setPrototypeOf(this, new.target.prototype) }
}
export function safeError(error: unknown): ImportError {
  if (error instanceof ImportError) return error
  // Never serialize Google request configs, headers or tokens into reports.
  return new ImportError('INTERNAL_ERROR', 'Unexpected backend error; inspect server diagnostics.')
}
export type Recording = { name: string; conferenceName: string; meetCode: string; startTime: Date; endTime: Date | null; state: string; fileId: string | null }
export type DriveFile = { id: string; name: string; mimeType: string; modifiedTime?: string; trashed?: boolean; capabilities?: { canDownload?: boolean } }
export interface GoogleSource {
  recordings(start: Date, end: Date): AsyncIterable<Recording>
  recording(name: string, conferenceName: string, code: string): Promise<Recording>
  notes(folderId: string): AsyncIterable<DriveFile>
  verify(fileId: string, kind: 'video' | 'note'): Promise<DriveFile>
  folder(folderId: string): Promise<void>
}
function secret(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new ImportError('CONFIGURATION', `Missing ${name}`)
  return value
}
export class GoogleClient implements GoogleSource {
  private organizer: OAuth2Client
  private playback: JWT
  constructor(private check = () => {}) {
    this.organizer = new OAuth2Client(secret('AUTOMATION_GOOGLE_CLIENT_ID'), secret('AUTOMATION_GOOGLE_CLIENT_SECRET'))
    this.organizer.transporter.defaults.timeout = 30000
    this.organizer.setCredentials({ refresh_token: secret('AUTOMATION_GOOGLE_REFRESH_TOKEN') })
    this.playback = new JWT({ email: secret('GOOGLE_SERVICE_ACCOUNT_EMAIL'), key: secret('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY').replace(/^"|"$/g, '').replace(/\\n/g, '\n'), scopes: ['https://www.googleapis.com/auth/drive.readonly'] })
    this.playback.transporter.defaults.timeout = 30000
  }
  private async request(url: string, playback = false, probe = false): Promise<any> {
    for (let attempt = 0; attempt < 4; attempt++) {
      this.check()
      let token: string | null | undefined
      try { token = (await (playback ? this.playback : this.organizer).getAccessToken()).token }
      catch (error: any) {
        const invalid = error?.response?.data?.error === 'invalid_grant'
        throw new ImportError(invalid ? 'AUTH_REQUIRED' : 'AUTH_UNAVAILABLE', invalid ? 'Reconnect the organizer Google account.' : 'Google authentication is unavailable.', !invalid)
      }
      let response: Response
      try { response = await fetch(url, { headers: { Authorization: `Bearer ${token}`, ...(probe && !url.includes('/export?') ? { Range: 'bytes=0-0' } : {}) }, signal: AbortSignal.timeout(30000) }) }
      catch { if (attempt < 3) { await new Promise(r => setTimeout(r, 500 * 2 ** attempt)); continue }; throw new ImportError('GOOGLE_TIMEOUT', 'Google request timed out.', true) }
      if (response.ok) {
        if (probe) { await response.body?.cancel(); return null }
        return response.json()
      }
      await response.body?.cancel()
      if (response.status === 401) throw new ImportError('AUTH_REQUIRED', 'Reconnect the Google account.')
      if (response.status === 403 || response.status === 404) throw new ImportError('FILE_ACCESS', 'Google resource is missing or access is denied.')
      if (response.status === 429 || response.status >= 500) {
        const retry = response.headers.get('retry-after')
        const delay = retry ? (/^\d+$/.test(retry) ? Number(retry) * 1000 : Math.max(0, Date.parse(retry) - Date.now())) : 500 * 2 ** attempt + Math.random() * 250
        if (delay > 5000 || attempt === 3) throw new ImportError('GOOGLE_RETRY', 'Google is temporarily unavailable or rate limited.', true, new Date(Date.now() + Math.max(delay || 0, 60000)))
        await new Promise(r => setTimeout(r, delay)); continue
      }
      throw new ImportError('GOOGLE_REQUEST', `Google rejected request (${response.status}).`)
    }
  }
  private async *pages(base: string, collection: string) {
    let pageToken: string | undefined
    do {
      const url = new URL(base)
      if (pageToken) url.searchParams.set('pageToken', pageToken)
      const page = await this.request(url.toString())
      for (const item of page[collection] || []) yield item
      pageToken = page.nextPageToken
    } while (pageToken)
  }
  private normalize(r: any, conferenceName: string, code: string): Recording {
    return { name: r.name, conferenceName, meetCode: code, startTime: new Date(r.startTime), endTime: r.endTime ? new Date(r.endTime) : null, state: r.state, fileId: r.driveDestination?.file || null }
  }
  async *recordings(start: Date, end: Date) {
    const url = new URL('https://meet.googleapis.com/v2/conferenceRecords')
    // Include conferences spanning the lower boundary, including reused rooms.
    url.searchParams.set('filter', `end_time >= "${start.toISOString()}" AND start_time <= "${end.toISOString()}"`)
    for await (const conference of this.pages(url.toString(), 'conferenceRecords')) {
      let code = conference.space?.meetingCode
      const spaceName = typeof conference.space === 'string' ? conference.space : conference.space?.name
      if (!code && spaceName) {
        const space = await this.request(`https://meet.googleapis.com/v2/${spaceName}`)
        code = space.meetingCode
      }
      for await (const r of this.pages(`https://meet.googleapis.com/v2/${conference.name}/recordings`, 'recordings')) yield this.normalize(r, conference.name, code || '')
    }
  }
  async recording(name: string, conferenceName: string, code: string) {
    return this.normalize(await this.request(`https://meet.googleapis.com/v2/${name}`), conferenceName, code)
  }
  async *notes(folderId: string) {
    if (!/^[\w-]+$/.test(folderId)) throw new ImportError('FOLDER_ID', 'Invalid folder ID.')
    const url = new URL('https://www.googleapis.com/drive/v3/files')
    url.searchParams.set('q', `'${folderId}' in parents and trashed = false`)
    url.searchParams.set('fields', 'nextPageToken,files(id,name,mimeType,modifiedTime,trashed)')
    url.searchParams.set('pageSize', '1000')
    url.searchParams.set('supportsAllDrives', 'true'); url.searchParams.set('includeItemsFromAllDrives', 'true')
    for await (const file of this.pages(url.toString(), 'files')) yield file as DriveFile
  }
  async folder(id: string) {
    const f = await this.request(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=mimeType,trashed&supportsAllDrives=true`)
    if (f.trashed || f.mimeType !== 'application/vnd.google-apps.folder') throw new ImportError('FOLDER_ID', 'Select an accessible Drive folder.')
  }
  async verify(id: string, kind: 'video' | 'note'): Promise<DriveFile> {
    const base = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}`
    const file: DriveFile = await this.request(`${base}?fields=id,name,mimeType,modifiedTime,trashed,capabilities(canDownload)&supportsAllDrives=true`, true)
    const native = ['application/vnd.google-apps.document', 'application/vnd.google-apps.presentation'].includes(file.mimeType)
    if (file.trashed || file.capabilities?.canDownload === false) throw new ImportError('FILE_ACCESS', 'Playback account cannot download this file.')
    if (kind === 'video' ? !file.mimeType.startsWith('video/') : !(file.mimeType === 'application/pdf' || native)) throw new ImportError('FILE_TYPE', 'Unsupported file type.')
    await this.request(native ? `${base}/export?mimeType=application/pdf` : `${base}?alt=media&supportsAllDrives=true`, true, true)
    return file
  }
}
