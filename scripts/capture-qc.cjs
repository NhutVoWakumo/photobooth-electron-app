const { app, BrowserWindow } = require('electron')
const { build } = require('esbuild')
const { mkdtemp, writeFile } = require('node:fs/promises')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const { pathToFileURL } = require('node:url')

app.on('window-all-closed', () => {})

async function main() {
  const { defaultSettings } = await import('../src/renderer/src/types.ts')
  if (defaultSettings.countdownSeconds !== 10 || defaultSettings.postCaptureReviewMs !== 2000) throw new Error('Wrong default capture timing.')
  const directory = await mkdtemp(join(tmpdir(), 'luma-capture-qc-'))
  const bundle = await build({ entryPoints: [join(__dirname, '../src/renderer/src/lib/captureEncoding.ts')], bundle: true, write: false, format: 'iife', globalName: 'CaptureEncoding' })
  await writeFile(join(directory, 'capture.js'), bundle.outputFiles[0].contents)
  await writeFile(join(directory, 'test.html'), '<!doctype html><meta charset="utf-8"><script src="capture.js"></script>')
  const window = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } })
  try {
    await window.loadURL(pathToFileURL(join(directory, 'test.html')).toString())
    const result = await window.webContents.executeJavaScript(`(async () => {
      const canvas = document.createElement('canvas')
      canvas.width = 3840; canvas.height = 2160
      const context = canvas.getContext('2d')
      context.fillStyle = '#3ba5ff'; context.fillRect(0, 0, 3840, 2160)
      context.fillStyle = '#ffcc38'; context.fillRect(500, 500, 1000, 800)
      const started = performance.now()
      const { dataUrl, previewDataUrl } = await CaptureEncoding.encodeCapturedCanvas(canvas, 0.92)
      const original = new Image(); original.src = dataUrl; await original.decode()
      const preview = new Image(); preview.src = previewDataUrl; await preview.decode()
      return { original: [original.naturalWidth, original.naturalHeight], preview: [preview.naturalWidth, preview.naturalHeight], bytes: Math.round(dataUrl.length * .75), ms: Math.round(performance.now() - started) }
    })()`, true)
    if (result.original[0] !== 3840 || result.original[1] !== 2160) throw new Error('Full-resolution JPEG was changed.')
    if (Math.max(...result.preview) > 480) throw new Error('Preview JPEG is too large.')
    console.log(JSON.stringify(result))
  } finally { window.destroy() }
}

app.whenReady().then(main).then(() => app.quit()).catch(error => { console.error(error); process.exit(1) })
