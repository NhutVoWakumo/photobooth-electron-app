import { app, BrowserWindow, ClipboardItem, clipboard, dialog, ipcMain, session } from 'electron'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { buildPrintPage, printPageSizeMicrons } from './printPage'
import { isPrinterProfile, paperDimensions, type PrinterProfile } from '../shared/printProfile'
import { cleanupExpired, configureDrive, connectDrive, driveStatus, frameLink, openDriveFolder, prepareFrameShare, processQueue, queueDriveDeletion, queueFrame, sessionFolder, sessionLink, setSessionSharing, type UploadJob } from './drive'

interface SaveSessionInput {
  eventName: string
  photos: string[]
  strip: string
  printSheet: string
  printLayout: {
    id: 'single-4x6' | 'two-up-4x6'
    width: number
    height: number
    copiesPerSheet: number
  }
  templateId: string
  slotAssignments: Record<string, string>
}

interface StoredWorkspace {
  id: string
  updatedAt: string
  [key: string]: unknown
}

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#070b09',
    title: 'LUMA Booth',
    titleBarStyle: 'default',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    window.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function toBuffer(dataUrl: string): Buffer {
  const content = dataUrl.split(',')[1]
  if (!content) throw new Error('Invalid image data.')
  return Buffer.from(content, 'base64')
}

function safeName(value: string): string {
  return value.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/(^-|-$)/g, '') || 'photobooth-session'
}

function workspaceDirectory(): string {
  return join(app.getPath('userData'), 'session-library')
}

function workspacePath(id: string): string {
  if (!/^[a-zA-Z0-9-]{1,80}$/.test(id)) throw new Error('Invalid session id.')
  return join(workspaceDirectory(), `${id}.json`)
}

function settingsPath(): string {
  return join(app.getPath('userData'), 'booth-settings.json')
}

async function loadSettings(): Promise<unknown | null> {
  try { return JSON.parse(await readFile(settingsPath(), 'utf8')) }
  catch { return null }
}

async function saveSettings(value: unknown): Promise<void> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid settings.')
  await mkdir(app.getPath('userData'), { recursive: true })
  const target = settingsPath()
  const temporary = `${target}.${process.pid}-${randomUUID()}.tmp`
  await writeFile(temporary, JSON.stringify(value), 'utf8')
  await rename(temporary, target)
}

async function listWorkspaces(): Promise<StoredWorkspace[]> {
  const directory = workspaceDirectory()
  await mkdir(directory, { recursive: true })
  const files = await readdir(directory)
  const workspaces = await Promise.all(files.filter(file => file.endsWith('.json')).map(async file => {
    try { return JSON.parse(await readFile(join(directory, file), 'utf8')) as StoredWorkspace } catch { return null }
  }))
  return workspaces.filter((workspace): workspace is StoredWorkspace => Boolean(workspace?.id)).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
}

const workspaceWrites = new Map<string, Promise<void>>()

async function writeWorkspace(workspace: StoredWorkspace): Promise<void> {
  if (!workspace || typeof workspace.id !== 'string') throw new Error('Invalid session.')
  await mkdir(workspaceDirectory(), { recursive: true })
  const target = workspacePath(workspace.id)
  const temporary = `${target}.${process.pid}-${randomUUID()}.tmp`
  await writeFile(temporary, JSON.stringify(workspace), 'utf8')
  await rename(temporary, target)
}

function saveWorkspace(workspace: StoredWorkspace): Promise<void> {
  if (!workspace || typeof workspace.id !== 'string') return Promise.reject(new Error('Invalid session.'))
  const previous = workspaceWrites.get(workspace.id) ?? Promise.resolve()
  const pending = previous.catch(() => undefined).then(() => writeWorkspace(workspace))
  workspaceWrites.set(workspace.id, pending)
  void pending.finally(() => { if (workspaceWrites.get(workspace.id) === pending) workspaceWrites.delete(workspace.id) }).catch(() => undefined)
  return pending
}

async function deleteWorkspace(id: string): Promise<void> {
  await workspaceWrites.get(id)?.catch(() => undefined)
  await rm(workspacePath(id), { force: true })
}

async function saveSession(input: SaveSessionInput): Promise<{ outputPath: string; printSheetPath: string; sessionPath: string }> {
  if (!Array.isArray(input.photos) || input.photos.length === 0 || typeof input.strip !== 'string' || typeof input.printSheet !== 'string' || !input.printLayout) {
    throw new Error('Invalid session.')
  }

  const day = new Date().toISOString().slice(0, 10)
  const sessionId = new Date().toISOString().replace(/[:.]/g, '-')
  const sessionRoot = join(app.getPath('pictures'), 'LUMA Booth Photos', `${day}-${safeName(input.eventName)}`, sessionId)
  const originalsPath = join(sessionRoot, 'originals')
  const outputPath = join(sessionRoot, 'outputs')

  await mkdir(originalsPath, { recursive: true })
  await mkdir(outputPath, { recursive: true })

  await Promise.all(input.photos.map((photo, index) => writeFile(join(originalsPath, `capture-${index + 1}.jpg`), toBuffer(photo))))
  const stripPath = join(outputPath, 'strip.jpg')
  const printSheetPath = join(outputPath, 'print-sheet-4x6.jpg')
  const sessionPath = join(sessionRoot, 'session.json')
  await writeFile(stripPath, toBuffer(input.strip))
  await writeFile(printSheetPath, toBuffer(input.printSheet))
  await writeFile(sessionPath, JSON.stringify({
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    eventName: input.eventName,
    templateId: input.templateId,
    captures: input.photos.map((_photo, index) => ({ id: `capture-${index + 1}`, file: `originals/capture-${index + 1}.jpg` })),
    slotAssignments: input.slotAssignments,
    outputs: {
      final: 'outputs/strip.jpg',
      printSheet: 'outputs/print-sheet-4x6.jpg',
      mimeType: 'image/jpeg'
    },
    printLayout: {
      ...input.printLayout,
      media: '4 × 6 in',
      ppi: 300
    }
  }, null, 2))

  return { outputPath: stripPath, printSheetPath, sessionPath }
}

async function exportImage(input: { eventName: string; dataUrl: string }): Promise<{ outputPath: string }> {
  if (!input?.dataUrl?.startsWith('data:image/')) throw new Error('Invalid image data.')
  const day = new Date().toISOString().slice(0, 10)
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const directory = join(app.getPath('pictures'), 'LUMA Booth Photos', 'Exports', `${day}-${safeName(input.eventName)}`)
  const outputPath = join(directory, `luma-booth-${timestamp}.jpg`)
  await mkdir(directory, { recursive: true })
  await writeFile(outputPath, toBuffer(input.dataUrl))
  const imageBytes = new Uint8Array(toBuffer(input.dataUrl))
  await clipboard.write([new ClipboardItem({ 'image/jpeg': new Blob([imageBytes], { type: 'image/jpeg' }) })])
  return { outputPath }
}

interface PrintImageInput {
  printerName: string
  dataUrl: string
  width: number
  height: number
  ppi: number
  profile: PrinterProfile
}

let printInProgress = false

async function listPrinters(): Promise<Array<{ name: string; displayName: string; description: string }>> {
  const window = BrowserWindow.getAllWindows().find(item => !item.isDestroyed())
  if (!window) return []
  const printers = await window.webContents.getPrintersAsync()
  return printers.map(({ name, displayName, description }) => ({ name, displayName, description }))
}

async function printImage(input: PrintImageInput): Promise<void> {
  if (printInProgress) throw new Error('A print job is already in progress.')
  if (!input || typeof input.printerName !== 'string' || !input.printerName || input.printerName === 'none') throw new Error('Select a printer in Settings first.')
  if (typeof input.dataUrl !== 'string' || !/^data:image\/jpeg;base64,/.test(input.dataUrl)) throw new Error('Invalid print image.')
  if (![input.width, input.height, input.ppi].every(Number.isFinite) || input.width < 300 || input.height < 300 || input.ppi < 72) throw new Error('Invalid print dimensions.')
  if (!isPrinterProfile(input.profile)) throw new Error('Choose a paper size for this printer in Settings.')
  const paper = paperDimensions(input.profile, input.width > input.height)
  const printers = await listPrinters()
  if (!printers.some(printer => printer.name === input.printerName)) throw new Error('The selected printer is no longer available. Reconnect it or choose another printer in Settings.')

  printInProgress = true
  const directory = join(app.getPath('temp'), `luma-print-${randomUUID()}`)
  const window = new BrowserWindow({ show: false, webPreferences: { sandbox: true, nodeIntegration: false, contextIsolation: true } })
  try {
    await mkdir(directory, { recursive: true })
    const photo = toBuffer(input.dataUrl)
    if (photo.length > 50 * 1024 * 1024) throw new Error('Print image is too large.')
    await writeFile(join(directory, 'photo.jpg'), photo)
    const pagePath = join(directory, 'print.html')
    await writeFile(pagePath, buildPrintPage(paper.widthMm, paper.heightMm, input.profile.marginMm, input.profile.fit), 'utf8')
    await window.loadURL(pathToFileURL(pagePath).toString())
    await window.webContents.executeJavaScript('document.images[0].decode()')
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('The printer did not respond in time. Check its queue before retrying.')), 30000)
      window.webContents.print({
        silent: true,
        deviceName: input.printerName,
        printBackground: true,
        margins: { marginType: 'none' },
        pageSize: printPageSizeMicrons(paper.widthMm, paper.heightMm),
        landscape: false,
        copies: 1
      }, (success, reason) => {
        clearTimeout(timeout)
        if (success) resolve()
        else reject(new Error(reason || 'The print job was rejected by the printer.'))
      })
    })
  } finally {
    if (!window.isDestroyed()) window.destroy()
    await rm(directory, { recursive: true, force: true }).catch(() => undefined)
    printInProgress = false
  }
}

app.setName('LUMA Booth')

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'media')
  })
  ipcMain.handle('storage:save-session', (_event, input: SaveSessionInput) => saveSession(input))
  ipcMain.handle('storage:list-workspaces', () => listWorkspaces())
  ipcMain.handle('storage:save-workspace', (_event, workspace: StoredWorkspace) => saveWorkspace(workspace))
  ipcMain.handle('storage:delete-workspace', (_event, id: string) => deleteWorkspace(id))
  ipcMain.handle('storage:load-settings', () => loadSettings())
  ipcMain.handle('storage:save-settings', (_event, value: unknown) => saveSettings(value))
  ipcMain.handle('output:export-image', (_event, input: { eventName: string; dataUrl: string }) => exportImage(input))
  ipcMain.handle('printer:list', () => listPrinters())
  ipcMain.handle('printer:print-image', (_event, input: PrintImageInput) => printImage(input))
  ipcMain.handle('drive:connect', async () => { await connectDrive(); await cleanupExpired(); await processQueue() })
  ipcMain.handle('drive:import-oauth-file', async () => {
    const result = await dialog.showOpenDialog({ title: 'Choose Google Desktop OAuth JSON', properties: ['openFile'], filters: [{ name: 'Google OAuth JSON', extensions: ['json'] }] })
    if (result.canceled || !result.filePaths[0]) return false
    const source = await readFile(result.filePaths[0], 'utf8')
    if (source.length > 64_000) throw new Error('OAuth JSON file is too large.')
    const file = JSON.parse(source) as { installed?: { client_id?: string; client_secret?: string } }
    if (!file.installed || typeof file.installed.client_id !== 'string' || typeof file.installed.client_secret !== 'string') throw new Error('Choose a Desktop OAuth JSON file downloaded from Google Cloud.')
    await configureDrive(file.installed.client_id, file.installed.client_secret)
    return true
  })
  ipcMain.handle('drive:status', () => driveStatus())
  ipcMain.handle('drive:queue-frame', (_event, job: UploadJob) => queueFrame(job))
  ipcMain.handle('drive:prepare-frame', (_event, job: Pick<UploadJob, 'sessionId' | 'sessionName' | 'frameId' | 'frameName' | 'shareFrame'>) => prepareFrameShare(job))
  ipcMain.handle('drive:process-queue', () => processQueue())
  ipcMain.handle('drive:frame-link', (_event, sessionId: string, frameId: string) => frameLink(sessionId, frameId))
  ipcMain.handle('drive:session-folder', (_event, sessionId: string) => sessionFolder(sessionId))
  ipcMain.handle('drive:session-link', (_event, sessionId: string) => sessionLink(sessionId))
  ipcMain.handle('drive:session-sharing', (_event, sessionId: string, enabled: boolean) => setSessionSharing(sessionId, enabled))
  ipcMain.handle('drive:open-folder', (_event, url: string) => openDriveFolder(url))
  ipcMain.handle('drive:queue-deletion', (_event, sessionId: string, frameId?: string) => queueDriveDeletion(sessionId, frameId))
  void cleanupExpired().then(() => processQueue())
  setInterval(() => { void cleanupExpired().then(() => processQueue()) }, 60 * 60 * 1000).unref()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
