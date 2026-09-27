const { app, BrowserWindow } = require('electron')
const { build } = require('esbuild')
const { mkdtemp, writeFile } = require('node:fs/promises')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const { pathToFileURL } = require('node:url')

app.on('window-all-closed', () => {})

async function main() {
  const directory = await mkdtemp(join(tmpdir(), 'luma-mask-qc-'))
  const bundle = await build({ entryPoints: [join(__dirname, 'slot-mask-qc-entry.ts')], bundle: true, write: false, format: 'iife', globalName: 'MaskQC', platform: 'browser' })
  await writeFile(join(directory, 'mask-qc.js'), bundle.outputFiles[0].contents)
  await writeFile(join(directory, 'test.html'), '<!doctype html><meta charset="utf-8"><script src="mask-qc.js"></script>')
  const window = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } })
  try {
    await window.loadURL(pathToFileURL(join(directory, 'test.html')).toString())
    const result = await window.webContents.executeJavaScript('MaskQC.runSlotMaskQc()', true)
    console.log(JSON.stringify(result))
  } finally { window.destroy() }
}

app.whenReady().then(main).then(() => app.quit()).catch(error => { console.error(error); process.exit(1) })
