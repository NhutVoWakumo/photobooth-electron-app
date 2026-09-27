import { app, safeStorage, shell } from 'electron'
import { createHash, randomBytes } from 'node:crypto'
import { createServer } from 'node:http'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const API = 'https://www.googleapis.com/drive/v3/files'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files'
const SCOPE = 'https://www.googleapis.com/auth/drive.file'
const RETENTION_DAYS = 30
const ROOT_FOLDER_NAME = 'LUMA Booth'
const FOLDER_MIME = 'application/vnd.google-apps.folder'
declare const __LUMA_GOOGLE_CLIENT_ID__: string
const BUNDLED_CLIENT_ID = typeof __LUMA_GOOGLE_CLIENT_ID__ === 'string' ? __LUMA_GOOGLE_CLIENT_ID__ : ''

interface Token { access_token: string; refresh_token: string; expires_at: number }
interface CloudFrame { folderId: string; permissionId: string; url: string; expiresAt: string; files: Record<string, string> }
interface CloudSession { folderId: string; frames: Record<string, CloudFrame>; permissionId?: string; expiresAt?: string }
interface CloudState { clientId: string; rootFolderId?: string; sessions: Record<string, CloudSession>; queue: UploadJob[]; deletions: Array<{ sessionId: string; frameId?: string }> }
export interface UploadJob { sessionId: string; sessionName: string; frameId: string; frameName: string; finalImage: string; photos: Array<{ id: string; dataUrl: string }>; shareFrame?: boolean }

let token: Token | null = null
let clientSecret: string | null = null
let processing: Promise<void> | null = null
let statusMessage = ''

function root(): string { return join(app.getPath('userData'), 'drive-sync') }
function statePath(): string { return join(root(), 'state.json') }
function tokenPath(): string { return join(root(), 'token.bin') }
function secretPath(): string { return join(root(), 'client-secret.bin') }
async function loadState(): Promise<CloudState> {
  try { const data = JSON.parse(await readFile(statePath(), 'utf8')) as CloudState; return { clientId: data.clientId ?? '', rootFolderId: data.rootFolderId, sessions: data.sessions ?? {}, queue: data.queue ?? [], deletions: data.deletions ?? [] } }
  catch { return { clientId: '', sessions: {}, queue: [], deletions: [] } }
}
async function atomicWrite(path: string, bytes: string | Buffer): Promise<void> {
  await mkdir(root(), { recursive: true })
  const temp = `${path}.${process.pid}.tmp`
  await writeFile(temp, bytes, { mode: 0o600 })
  await rename(temp, path)
}
async function saveState(state: CloudState): Promise<void> { await atomicWrite(statePath(), JSON.stringify(state)) }
async function loadToken(): Promise<void> {
  if (token || !safeStorage.isEncryptionAvailable()) return
  try { token = JSON.parse(safeStorage.decryptString(await readFile(tokenPath()))) as Token } catch { token = null }
}
async function saveToken(value: Token): Promise<void> {
  token = value
  if (safeStorage.isEncryptionAvailable()) await atomicWrite(tokenPath(), safeStorage.encryptString(JSON.stringify(value)))
}
async function loadClientSecret(): Promise<string | null> {
  if (clientSecret) return clientSecret
  if (!safeStorage.isEncryptionAvailable()) return null
  try { clientSecret = safeStorage.decryptString(await readFile(secretPath())); return clientSecret }
  catch { return null }
}
function dataBytes(dataUrl: string): Buffer {
  if (!/^data:image\/jpeg;base64,/.test(dataUrl)) throw new Error('Only JPEG photos can be uploaded.')
  const result = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64')
  if (!result.length || result.length > 60 * 1024 * 1024) throw new Error('Invalid photo size.')
  return result
}
async function refresh(): Promise<void> {
  await loadToken()
  if (!token) throw new Error('Connect Google Drive first.')
  if (token.expires_at > Date.now() + 60_000) return
  const state = await loadState()
  const secret = await loadClientSecret()
  const clientId = state.clientId || BUNDLED_CLIENT_ID
  if (!clientId) throw new Error('Google Drive sign-in is not configured in this build.')
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: tokenRequestParams({ client_id: clientId, grant_type: 'refresh_token', refresh_token: token.refresh_token }, secret) })
  if (!response.ok) { token = null; await rm(tokenPath(), { force: true }); throw new Error(`Drive sign-in expired (${response.status}). Connect again.`) }
  const next = await response.json() as { access_token: string; expires_in: number }
  await saveToken({ ...token, access_token: next.access_token, expires_at: Date.now() + next.expires_in * 1000 })
}
export function tokenRequestParams(fields: Record<string, string>, secret: string | null): URLSearchParams {
  return new URLSearchParams({ ...fields, ...(secret ? { client_secret: secret } : {}) })
}
async function request(url: string, init: RequestInit = {}): Promise<Response> {
  await refresh()
  const response = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token!.access_token}`, ...init.headers } })
  if (!response.ok) {
    if (response.status === 401) { token = null; await rm(tokenPath(), { force: true }); throw new Error('Drive sign-in expired. Connect again.') }
    const detail = (await response.text()).slice(0, 400)
    throw new Error(`Google Drive ${response.status}: ${detail}`)
  }
  return response
}
async function json<T>(url: string, init: RequestInit = {}): Promise<T> { return await (await request(url, init)).json() as T }
async function folder(name: string, parent?: string): Promise<string> {
  const item = await json<{ id: string }>(`${API}?fields=id`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, mimeType: FOLDER_MIME, ...(parent ? { parents: [parent] } : {}) }) })
  return item.id
}
async function ensureRootFolder(state: CloudState): Promise<string> {
  if (state.rootFolderId) return state.rootFolderId
  // drive.file can see folders this app created or was explicitly granted, not every
  // unrelated folder in the user's Drive. Reuse a visible exact-name root if present.
  const query = new URLSearchParams({
    q: `name = '${ROOT_FOLDER_NAME}' and mimeType = '${FOLDER_MIME}' and 'root' in parents and trashed = false`,
    fields: 'nextPageToken,files(id,name,mimeType,parents,trashed)',
    pageSize: '1000',
    orderBy: 'createdTime'
  })
  const result = await json<{ files?: Array<{ id: string }> }>(`${API}?${query}`)
  const id = result.files?.[0]?.id ?? await folder(ROOT_FOLDER_NAME)
  state.rootFolderId = id
  await saveState(state)
  return id
}
async function upload(name: string, bytes: Buffer, folderId: string, existingId?: string): Promise<string> {
  if (existingId) {
    await request(`${UPLOAD}/${encodeURIComponent(existingId)}?uploadType=media`, { method: 'PATCH', headers: { 'Content-Type': 'image/jpeg' }, body: new Uint8Array(bytes) })
    return existingId
  }
  const boundary = `luma${randomBytes(12).toString('hex')}`
  const prefix = Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name, mimeType: 'image/jpeg', parents: [folderId] })}\r\n--${boundary}\r\nContent-Type: image/jpeg\r\n\r\n`)
  const result = await json<{ id: string }>(`${UPLOAD}?uploadType=multipart&fields=id`, { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body: new Uint8Array(Buffer.concat([prefix, bytes, Buffer.from(`\r\n--${boundary}--`) ])) })
  return result.id
}
function validateJob(job: UploadJob): void {
  if (!job || ![job.sessionId, job.frameId].every(id => /^[a-zA-Z0-9-]{1,80}$/.test(id)) || !Array.isArray(job.photos) || job.photos.length === 0 || job.photos.length > 30) throw new Error('Invalid frame upload.')
  dataBytes(job.finalImage)
  job.photos.forEach(photo => { if (!/^[a-zA-Z0-9-]{1,80}$/.test(photo.id)) throw new Error('Invalid photo id.'); dataBytes(photo.dataUrl) })
}
export async function configureDrive(clientId: string, secret: string): Promise<void> {
  if (!/^[0-9]+-[a-z0-9_-]+\.apps\.googleusercontent\.com$/.test(clientId)) throw new Error('Enter a Google OAuth Desktop client ID.')
  if (typeof secret !== 'string' || secret.length < 8 || secret.length > 512) throw new Error('Enter the Desktop OAuth client secret.')
  const state = await loadState()
  if (state.clientId !== clientId) { token = null; await rm(tokenPath(), { force: true }) }
  state.clientId = clientId
  clientSecret = secret
  if (safeStorage.isEncryptionAvailable()) await atomicWrite(secretPath(), safeStorage.encryptString(secret))
  await saveState(state)
}
export async function connectDrive(): Promise<void> {
  const state = await loadState()
  const clientId = state.clientId || BUNDLED_CLIENT_ID
  if (!clientId) throw new Error('Google Drive sign-in is not configured in this build. Ask the app owner to set it up.')
  const secret = await loadClientSecret()
  if (!state.clientId) { state.clientId = clientId; await saveState(state) }
  const verifier = randomBytes(32).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  const nonce = randomBytes(24).toString('hex')
  const server = createServer()
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Could not start OAuth callback.')
  const redirect = `http://127.0.0.1:${address.port}/callback`
  const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  for (const [key, value] of Object.entries({ client_id: clientId, redirect_uri: redirect, response_type: 'code', scope: SCOPE, access_type: 'offline', prompt: 'consent', code_challenge: challenge, code_challenge_method: 'S256', state: nonce })) auth.searchParams.set(key, value)
  try {
    const code = new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Google sign-in timed out.')), 180_000)
      server.on('request', (req, res) => {
        const url = new URL(req.url ?? '/', redirect)
        if (url.pathname !== '/callback') { res.writeHead(404).end(); return }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end('<h1>LUMA Booth</h1><p>You can return to the app.</p>')
        clearTimeout(timeout)
        if (url.searchParams.get('state') !== nonce) reject(new Error('OAuth state mismatch.'))
        else if (!url.searchParams.get('code')) reject(new Error(url.searchParams.get('error') ?? 'Google sign-in cancelled.'))
        else resolve(url.searchParams.get('code')!)
      })
    })
    await shell.openExternal(auth.toString())
    const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: tokenRequestParams({ client_id: clientId, code: await code, code_verifier: verifier, redirect_uri: redirect, grant_type: 'authorization_code' }, secret) })
    if (!response.ok) {
      const failure = await response.json().catch(() => ({})) as { error?: string; error_description?: string }
      throw new Error(`Google sign-in failed (${response.status}): ${failure.error ?? 'unknown_error'}${failure.error_description ? ` — ${failure.error_description}` : ''}`)
    }
    const result = await response.json() as { access_token: string; refresh_token?: string; expires_in: number }
    if (!result.refresh_token) throw new Error('Google did not return offline access. Reconnect and approve Drive access.')
    await saveToken({ access_token: result.access_token, refresh_token: result.refresh_token, expires_at: Date.now() + result.expires_in * 1000 })
    await ensureRootFolder(state)
  } finally { server.close() }
}
export async function driveStatus(): Promise<{ configured: boolean; connected: boolean; pending: number; message: string }> {
  const state = await loadState(); await loadToken()
  return { configured: Boolean(state.clientId || BUNDLED_CLIENT_ID), connected: Boolean(token), pending: state.queue.length + state.deletions.length, message: statusMessage }
}
export async function queueFrame(job: UploadJob): Promise<void> {
  validateJob(job)
  await processing
  const state = await loadState()
  state.queue = [...state.queue.filter(item => !(item.sessionId === job.sessionId && item.frameId === job.frameId)), job]
  await saveState(state)
}
export async function queueDriveDeletion(sessionId: string, frameId?: string): Promise<void> {
  if (!/^[a-zA-Z0-9-]{1,80}$/.test(sessionId) || (frameId && !/^[a-zA-Z0-9-]{1,80}$/.test(frameId))) throw new Error('Invalid Drive deletion target.')
  await processing
  const state = await loadState()
  state.queue = state.queue.filter(job => job.sessionId !== sessionId || (frameId && job.frameId !== frameId))
  if (state.sessions[sessionId] && (!frameId || state.sessions[sessionId].frames[frameId])) {
    if (!state.deletions.some(item => item.sessionId === sessionId && item.frameId === frameId)) state.deletions.push({ sessionId, frameId })
  }
  await saveState(state)
  void processQueue()
}
async function deleteRemote(state: CloudState, target: { sessionId: string; frameId?: string }): Promise<void> {
  const session = state.sessions[target.sessionId]
  if (!session) return
  if (!target.frameId && session.permissionId) {
    await request(`${API}/${session.folderId}/permissions/${session.permissionId}`, { method: 'DELETE' })
    session.permissionId = undefined
    session.expiresAt = undefined
    await saveState(state)
  }
  const frames = target.frameId ? [session.frames[target.frameId]].filter((item): item is CloudFrame => Boolean(item)) : Object.values(session.frames)
  for (const frame of frames) {
    if (!frame.permissionId) continue
    await request(`${API}/${frame.folderId}/permissions/${frame.permissionId}`, { method: 'DELETE' })
    frame.permissionId = ''
    await saveState(state)
  }
  if (target.frameId) {
    const frame = session.frames[target.frameId]
    if (frame) { await request(`${API}/${frame.folderId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }) }); delete session.frames[target.frameId] }
  } else {
    await request(`${API}/${session.folderId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }) })
    delete state.sessions[target.sessionId]
  }
  await saveState(state)
}
async function ensureFrameFolder(state: CloudState, job: Pick<UploadJob, 'sessionId' | 'sessionName' | 'frameId' | 'frameName' | 'shareFrame'>): Promise<CloudFrame> {
  let session = state.sessions[job.sessionId]
  if (!session) {
    const rootFolderId = await ensureRootFolder(state)
    session = { folderId: await folder(`LUMA · ${job.sessionName}`, rootFolderId), frames: {} }
    state.sessions[job.sessionId] = session
    await saveState(state)
  }
  let frame = session.frames[job.frameId]
  if (!frame) {
    const folderId = await folder(job.frameName, session.folderId)
    frame = { folderId, permissionId: '', url: `https://drive.google.com/drive/folders/${folderId}`, expiresAt: new Date(Date.now() + RETENTION_DAYS * 86400_000).toISOString(), files: {} }
    session.frames[job.frameId] = frame
    await saveState(state)
  }
  if (job.shareFrame !== false && !frame.permissionId) {
    const permission = await json<{ id: string }>(`https://www.googleapis.com/drive/v3/files/${frame.folderId}/permissions?fields=id`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'anyone', role: 'reader' }) })
    frame.permissionId = permission.id
  }
  frame.expiresAt = new Date(Date.now() + RETENTION_DAYS * 86400_000).toISOString()
  await saveState(state)
  return frame
}
export async function prepareFrameShare(job: Pick<UploadJob, 'sessionId' | 'sessionName' | 'frameId' | 'frameName' | 'shareFrame'>): Promise<string> {
  if (![job.sessionId, job.frameId].every(id => /^[a-zA-Z0-9-]{1,80}$/.test(id))) throw new Error('Invalid frame id.')
  await processing
  const state = await loadState()
  await refresh()
  return (await ensureFrameFolder(state, job)).url
}
async function syncFrame(job: UploadJob, state: CloudState): Promise<void> {
  const frame = await ensureFrameFolder(state, job)
  frame.files.final = await upload('final.jpg', dataBytes(job.finalImage), frame.folderId, frame.files.final)
  await saveState(state)
  for (const [index, photo] of job.photos.entries()) {
    frame.files[photo.id] = await upload(`capture-${String(index + 1).padStart(2, '0')}.jpg`, dataBytes(photo.dataUrl), frame.folderId, frame.files[photo.id])
    await saveState(state)
  }
  const current = new Set(['final', ...job.photos.map(photo => photo.id)])
  for (const [id, fileId] of Object.entries(frame.files)) {
    if (current.has(id)) continue
    await request(`${API}/${fileId}`, { method: 'DELETE' })
    delete frame.files[id]
    await saveState(state)
  }
}
export function processQueue(): Promise<void> {
  if (processing) return processing
  processing = (async () => {
    try {
    const state = await loadState()
    if (!state.queue.length && !state.deletions.length) { statusMessage = ''; return }
    await refresh()
    while (state.deletions.length) {
      await deleteRemote(state, state.deletions[0])
      state.deletions.shift()
      await saveState(state)
    }
    while (state.queue.length) {
      await syncFrame(state.queue[0], state)
      state.queue.shift()
      await saveState(state)
    }
    statusMessage = ''
    } catch (error) { statusMessage = error instanceof Error ? error.message : String(error) }
  })().finally(() => { processing = null })
  return processing
}
export async function frameLink(sessionId: string, frameId: string): Promise<{ url: string; expiresAt: string } | null> {
  const session = (await loadState()).sessions[sessionId]
  const frame = session?.frames[frameId]
  if (!frame || Date.parse(frame.expiresAt) <= Date.now()) return null
  if (frame.permissionId) return { url: frame.url, expiresAt: frame.expiresAt }
  if (session.permissionId && session.expiresAt && Date.parse(session.expiresAt) > Date.now()) return { url: frame.url, expiresAt: new Date(Math.min(Date.parse(frame.expiresAt), Date.parse(session.expiresAt))).toISOString() }
  return null
}
export async function sessionFolder(sessionId: string): Promise<string | null> {
  const id = (await loadState()).sessions[sessionId]?.folderId
  return id ? `https://drive.google.com/drive/folders/${id}` : null
}
export async function sessionLink(sessionId: string): Promise<{ url: string; expiresAt: string } | null> {
  if (!/^[a-zA-Z0-9-]{1,80}$/.test(sessionId)) throw new Error('Invalid session id.')
  const session = (await loadState()).sessions[sessionId]
  return session?.permissionId && session.expiresAt && Date.parse(session.expiresAt) > Date.now()
    ? { url: `https://drive.google.com/drive/folders/${session.folderId}`, expiresAt: session.expiresAt }
    : null
}
export async function setSessionSharing(sessionId: string, enabled: boolean): Promise<void> {
  if (!/^[a-zA-Z0-9-]{1,80}$/.test(sessionId)) throw new Error('Invalid session id.')
  await processing
  const state = await loadState()
  const session = state.sessions[sessionId]
  if (!session) {
    if (!enabled) return
    throw new Error('Upload a completed frame before sharing this session.')
  }
  if (enabled) {
    if (Object.keys(session.frames).length === 0) throw new Error('This session has no uploaded frames.')
    if (!session.permissionId) {
      const permission = await json<{ id: string }>(`${API}/${session.folderId}/permissions?fields=id`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'anyone', role: 'reader' }) })
      session.permissionId = permission.id
    }
    session.expiresAt = new Date(Date.now() + RETENTION_DAYS * 86400_000).toISOString()
  } else {
    if (session.permissionId) {
      await request(`${API}/${session.folderId}/permissions/${session.permissionId}`, { method: 'DELETE' })
      session.permissionId = undefined
      session.expiresAt = undefined
    }
    for (const frame of Object.values(session.frames)) {
      if (!frame.permissionId) continue
      await request(`${API}/${frame.folderId}/permissions/${frame.permissionId}`, { method: 'DELETE' })
      frame.permissionId = ''
    }
  }
  await saveState(state)
}
export async function openDriveFolder(url: string): Promise<void> {
  if (!/^https:\/\/drive\.google\.com\/drive\/folders\/[A-Za-z0-9_-]+$/.test(url)) throw new Error('Invalid Drive folder URL.')
  await shell.openExternal(url)
}
export async function cleanupExpired(): Promise<void> {
  await processing
  const state = await loadState()
  try { await refresh() } catch { return }
  for (const session of Object.values(state.sessions)) {
    if (!session.permissionId || !session.expiresAt || Date.parse(session.expiresAt) > Date.now()) continue
    try {
      await request(`${API}/${session.folderId}/permissions/${session.permissionId}`, { method: 'DELETE' })
      session.permissionId = undefined
      session.expiresAt = undefined
      await saveState(state)
    } catch (error) { statusMessage = error instanceof Error ? error.message : String(error) }
  }
  for (const session of Object.values(state.sessions)) for (const [id, frame] of Object.entries(session.frames)) {
    if (Date.parse(frame.expiresAt) > Date.now()) continue
    try {
      if (frame.permissionId) {
        await request(`${API}/${frame.folderId}/permissions/${frame.permissionId}`, { method: 'DELETE' })
        frame.permissionId = ''
        await saveState(state)
      }
      await request(`${API}/${frame.folderId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }) })
      delete session.frames[id]
      await saveState(state)
    } catch (error) { statusMessage = error instanceof Error ? error.message : String(error) }
  }
}
