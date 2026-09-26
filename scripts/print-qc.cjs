const { app, BrowserWindow } = require('electron')
const { copyFile, mkdtemp, writeFile } = require('node:fs/promises')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const { pathToFileURL } = require('node:url')

app.on('window-all-closed', () => {})

async function main() {
  const { buildPrintPage, printPageSizeMicrons } = await import('../src/main/printPage.ts')
  const directory = await mkdtemp(join(tmpdir(), 'luma-print-qc-'))
  const fixture = join(__dirname, '../src/renderer/src/assets/penci-sky-bg.jpg')
  await copyFile(fixture, join(directory, 'photo.jpg'))

  for (const [label, width, height] of [['portrait-4x6', 4, 6], ['landscape-6x4', 6, 4]]) {
    const page = join(directory, `${label}.html`)
    await writeFile(page, buildPrintPage(width, height), 'utf8')
    const window = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } })
    try {
      await window.loadURL(pathToFileURL(page).toString())
      await window.webContents.executeJavaScript('document.images[0].decode()')
      const size = printPageSizeMicrons(width, height)
      if (size.width !== width * 25400 || size.height !== height * 25400) throw new Error(`Wrong printer dimensions for ${label}`)
      const pdf = await window.webContents.printToPDF({ preferCSSPageSize: true, printBackground: true, margins: { top: 0, bottom: 0, left: 0, right: 0 } })
      const pdfText = pdf.toString('latin1')
      if (!pdfText.includes(`/MediaBox [0 0 ${width * 72} ${height * 72}]`)) throw new Error(`Wrong PDF paper size for ${label}`)
      if ((pdfText.match(/\/Type \/Page\b/g) || []).length !== 1) throw new Error(`Expected exactly one PDF page for ${label}`)
      if (pdf.length < 100_000) throw new Error(`Image may be missing from ${label}`)
      const output = join(directory, `${label}.pdf`)
      await writeFile(output, pdf)
      console.log(output)
    } finally { window.destroy() }
  }
}

app.whenReady().then(main).then(() => app.quit()).catch(error => {
  console.error(error)
  process.exit(1)
})
