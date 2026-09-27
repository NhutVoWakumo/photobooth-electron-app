const { app, BrowserWindow } = require('electron')
const { build } = require('esbuild')
const { mkdtemp, writeFile } = require('node:fs/promises')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const { pathToFileURL } = require('node:url')

app.on('window-all-closed', () => {})

async function main() {
  const directory = await mkdtemp(join(tmpdir(), 'luma-capture-flow-qc-'))
  const bundle = await build({ entryPoints: [join(__dirname, 'capture-flow-qc-entry.tsx')], bundle: true, write: false, format: 'iife', platform: 'browser', loader: { '.png': 'dataurl', '.jpg': 'dataurl', '.svg': 'dataurl' } })
  await writeFile(join(directory, 'test.js'), bundle.outputFiles[0].contents)
  await writeFile(join(directory, 'index.html'), '<!doctype html><html><body><div id="root"></div><script src="test.js"></script></body></html>')
  const window = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } })
  try {
    await window.loadURL(pathToFileURL(join(directory, 'index.html')).toString())
    const result = await window.webContents.executeJavaScript(`(async () => {
      const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
      for (let i = 0; i < 100; i++) {
        const video = document.querySelector('video')
        if (video?.videoWidth && video.readyState >= 2) break
        await wait(50)
      }
      const button = document.querySelector('.workstation-capture')
      if (!button || button.disabled) throw new Error('Capture button is unavailable.')
      button.click()
      for (let i = 0; i < 200; i++) {
        if (window.__captureResult) {
          const image = document.querySelector('.capture-review-photo')
          if (!image) throw new Error('The full-size review image is missing.')
          await image.decode()
          return { ...window.__captureResult, reviewWidth: image.naturalWidth }
        }
        await wait(50)
      }
      throw new Error('Three-photo sequence did not complete.')
    })()`, true)
    if (result.photos !== 3 || result.unique !== 3 || !result.complete || !result.previewReady || result.thumbnailCount !== 3 || !result.cameraLive || result.reviewWidth <= 480) throw new Error(`Capture flow failed: ${JSON.stringify(result)}`)
    console.log(JSON.stringify(result))
  } finally { window.destroy() }
}

app.whenReady().then(main).then(() => app.quit()).catch(error => { console.error(error); process.exit(1) })
