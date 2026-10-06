import { OAuth2Client } from 'google-auth-library'
import { createServer } from 'node:http'
import { randomBytes } from 'node:crypto'
import { writeFile, chmod, realpath } from 'node:fs/promises'
import { isAbsolute, dirname, join, basename, relative } from 'node:path'
import { GoogleClient } from '../lib/automation/google'
async function main() {
  if (process.argv.includes('--verify')) {
    const client = new GoogleClient()
    const folder = process.env.AUTOMATION_VERIFY_FOLDER_ID
    const recording = process.env.AUTOMATION_VERIFY_RECORDING_ID
    const note = process.env.AUTOMATION_VERIFY_NOTE_ID
    if (!folder || !recording || !note) throw new Error('Set verification folder, recording and note IDs.')
    await client.folder(folder); await client.verify(recording, 'video'); await client.verify(note, 'note')
    let count = 0
    for await (const _ of client.recordings(new Date(Date.now() - 7 * 86400000), new Date())) count++
    console.log(`Verified folder, private playback, notes and Meet discovery (${count} recordings).`)
    return
  }
  const outputIndex = process.argv.indexOf('--output')
  const output = outputIndex >= 0 ? process.argv[outputIndex + 1] : undefined
  if (!output) throw new Error('Specify --output /absolute/private/path/google-token.json (outside the repository).')
  if (!isAbsolute(output)) throw new Error('Specify an absolute output path outside the repository.')
  const actualOutput = join(await realpath(dirname(output)), basename(output))
  const within = relative(await realpath(process.cwd()), actualOutput)
  if (!within.startsWith('..') && !isAbsolute(within)) throw new Error('Specify an output path outside the repository.')
  const state = randomBytes(32).toString('hex')
  const redirect = 'http://127.0.0.1:8787/oauth/callback'
  const client = new OAuth2Client(process.env.AUTOMATION_GOOGLE_CLIENT_ID, process.env.AUTOMATION_GOOGLE_CLIENT_SECRET, redirect)
  const { codeVerifier, codeChallenge } = await client.generateCodeVerifierAsync()
  const { CodeChallengeMethod } = await import('google-auth-library')
  const server = createServer(async (req, res) => {
    const url = new URL(req.url || '/', redirect)
    if (url.pathname !== '/oauth/callback') { res.writeHead(404).end(); return }
    if (url.searchParams.get('state') !== state || !url.searchParams.get('code')) { res.writeHead(400).end('Invalid authorization response.'); return }
    try {
      const { tokens } = await client.getToken({ code: url.searchParams.get('code')!, codeVerifier, redirect_uri: redirect })
      if (!tokens.refresh_token) throw new Error('No refresh token')
      await writeFile(actualOutput, JSON.stringify({ AUTOMATION_GOOGLE_REFRESH_TOKEN: tokens.refresh_token }, null, 2), { mode: 0o600, flag: 'wx' })
      await chmod(actualOutput, 0o600)
      res.end('Authorization saved. You can close this window.')
      console.log('Refresh token written to the requested private file. Transfer it to Render secrets, then securely remove the local file.')
    } catch { res.writeHead(500).end('Authorization could not be saved. Check the setup instructions.'); process.exitCode = 1 }
    finally { clearTimeout(timeout); server.close() }
  })
  const timeout = setTimeout(() => { console.error('Authorization timed out.'); server.close(); process.exitCode = 1 }, 10 * 60000)
  server.listen(8787, '127.0.0.1', () => console.log('Open this URL in your browser:\n' + client.generateAuthUrl({ access_type: 'offline', prompt: 'consent', state, code_challenge: codeChallenge, code_challenge_method: CodeChallengeMethod.S256, scope: ['https://www.googleapis.com/auth/meetings.space.readonly', 'https://www.googleapis.com/auth/drive.readonly'] })))
}
main().catch(e => { console.error(e.message?.startsWith('Specify') || e.message?.startsWith('Set verification') ? e.message : 'Google setup failed. Check credentials and setup instructions.'); process.exitCode = 1 })
