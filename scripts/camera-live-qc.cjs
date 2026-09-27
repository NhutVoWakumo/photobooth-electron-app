const { app, BrowserWindow, session } = require('electron')
const { build } = require('esbuild')
const { mkdtemp, writeFile } = require('node:fs/promises')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const { pathToFileURL } = require('node:url')

app.on('window-all-closed', () => {})

async function main() {
  const directory = await mkdtemp(join(tmpdir(), 'luma-camera-qc-'))
  const bundle = await build({ entryPoints: [join(__dirname, 'camera-live-qc-entry.ts')], bundle: true, write: false, format: 'iife', globalName: 'CameraQC', platform: 'browser' })
  await writeFile(join(directory, 'test.js'), bundle.outputFiles[0].contents)
  await writeFile(join(directory, 'index.html'), '<!doctype html><meta charset="utf-8"><script src="test.js"></script>')
  session.defaultSession.setPermissionRequestHandler((_contents, permission, callback) => callback(permission === 'media'))
  const window = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } })
  try {
    await window.loadURL(pathToFileURL(join(directory, 'index.html')).toString())
    const result = await Promise.race([
      window.webContents.executeJavaScript('CameraQC.testCamera()', true),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Camera request timed out after 15 seconds.')), 15000))
    ])
    if (!result.active || !result.width || !result.height || !result.frameCaptured) throw new Error(`Camera stream or in-memory capture failed: ${JSON.stringify(result)}`)
    console.log(JSON.stringify(result))
  } finally { window.destroy() }
}

app.whenReady().then(main).then(() => app.quit()).catch(error => { console.error(error); process.exit(1) })
