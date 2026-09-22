import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { parseFrameImport, type FrameFontAsset, type FrameImageLayer, type TemplateManifest } from '../templates'

const MAX_PACK_BYTES = 24 * 1024 * 1024
const assetMime: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', svg: 'image/svg+xml', woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf' }

type PackManifest = Omit<TemplateManifest, 'layers' | 'fontAssets'> & { schemaVersion: 1; layers?: Array<Omit<FrameImageLayer, 'src'> & { src: string } | unknown>; fontAssets?: Array<Omit<FrameFontAsset, 'src'> & { src: string }> }

function dataUrl(path: string, bytes: Uint8Array): string {
  const extension = path.split('.').pop()?.toLowerCase() ?? ''
  const mime = assetMime[extension]
  if (!mime) throw new Error(`Unsupported asset: ${path}.`)
  if (mime === 'image/svg+xml') return `data:${mime};base64,${btoa(String.fromCharCode(...bytes))}`
  let binary = ''
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  return `data:${mime};base64,${btoa(binary)}`
}

/** Imports an offline Frame Pack and embeds referenced visual assets in the manifest. */
export async function importFramePack(file: File): Promise<TemplateManifest> {
  if (file.size > MAX_PACK_BYTES) throw new Error('Frame Pack is larger than 24 MB.')
  const files = unzipSync(new Uint8Array(await file.arrayBuffer()))
  const source = files['manifest.json']
  if (!source) throw new Error('Frame Pack must contain manifest.json.')
  const manifest = JSON.parse(strFromU8(source)) as PackManifest
  if (manifest.schemaVersion !== 1) throw new Error('Unsupported Frame Pack version.')
  const layers = (manifest.layers ?? []).map(layer => {
    if (!layer || typeof layer !== 'object' || !('type' in layer) || layer.type !== 'image' || !('src' in layer) || typeof layer.src !== 'string') return layer
    const asset = files[layer.src]
    if (!asset) throw new Error(`Missing asset: ${layer.src}`)
    return { ...layer, src: dataUrl(layer.src, asset) }
  })
  const fontAssets = (manifest.fontAssets ?? []).map(font => {
    const asset = files[font.src]
    if (!asset) throw new Error(`Missing font asset: ${font.src}`)
    return { ...font, src: dataUrl(font.src, asset) }
  })
  return parseFrameImport(JSON.stringify({ ...manifest, layers, fontAssets }))
}

/** A portable original demo pack. It validates the same zip route used by Figma/Canva handoffs. */
export function makeDemoFramePack(): File {
  const backdrop = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 1800"><rect width="600" height="1800" fill="#fff4e8"/><path d="M0 245C145 185 250 285 390 215s160-26 210 7v-222H0z" fill="#ffd7ba"/><path d="M0 1630c130-96 245 12 365-63s168 2 235-35v268H0z" fill="#b9dccb"/><g fill="#f1976b" opacity=".65"><circle cx="73" cy="214" r="13"/><circle cx="515" cy="1680" r="16"/><circle cx="468" cy="188" r="8"/></g></svg>`
  const overlay = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 1800"><g fill="none" stroke="#1d4738" stroke-width="7" stroke-linecap="round"><path d="M70 115c24-34 56-35 79-9M470 110c22-30 48-25 65-5M64 1690c24 25 55 25 82 0M449 1692c24 25 55 25 82 0"/></g><g fill="#1d4738" font-family="Arial, sans-serif" text-anchor="middle"><text x="300" y="105" font-size="32" font-weight="700" letter-spacing="8">GARDEN CLUB</text><text x="300" y="1740" font-size="17" letter-spacing="4">A DAY TO KEEP</text></g></svg>`
  const manifest: PackManifest = {
    schemaVersion: 1, id: 'garden-club-demo', name: 'Garden club', description: 'Original demo Frame Pack with separate background and transparent overlay.', rows: 3, columns: 1, requiredSlots: 3, printLabel: '2 × 6 in strip', output: { width: 600, height: 1800, ppi: 300 }, theme: { id: 'garden-club', label: 'Garden club', paper: '#fff4e8', ink: '#1d4738', accent: '#f1976b', slotLight: '#f7d9c4', slotDark: '#c98d70' },
    slots: [
      { id: 'slot-1', x: .11, y: .17, width: .78, height: .21, shape: 'rounded', radius: .08, fit: 'cover', stroke: '#ffffff', strokeWidth: 8, zIndex: 10 },
      { id: 'slot-2', x: .11, y: .405, width: .78, height: .21, shape: 'arch', fit: 'cover', stroke: '#ffffff', strokeWidth: 8, zIndex: 10 },
      { id: 'slot-3', x: .11, y: .64, width: .78, height: .21, shape: 'scallop', fit: 'cover', stroke: '#ffffff', strokeWidth: 8, zIndex: 10 }
    ],
    layers: [
      { id: 'background', type: 'image', x: 0, y: 0, width: 1, height: 1, src: 'assets/background.svg', opacity: 1, zIndex: 0, locked: true },
      { id: 'overlay', type: 'image', x: 0, y: 0, width: 1, height: 1, src: 'assets/overlay.svg', opacity: 1, zIndex: 30, locked: true }
    ]
  }
  const zip = zipSync({ 'manifest.json': strToU8(JSON.stringify(manifest, null, 2)), 'assets/background.svg': strToU8(backdrop), 'assets/overlay.svg': strToU8(overlay) })
  return new File([zip], 'garden-club-demo.luma-frame.zip', { type: 'application/zip' })
}

export function exportFramePack(template: TemplateManifest): Blob {
  const assets: Record<string, Uint8Array> = {}
  let assetIndex = 0
  const layers = (template.layers ?? []).map(layer => {
    if (layer.type !== 'image' || !layer.src.startsWith('data:image/')) return layer
    const match = /^data:image\/(png|jpeg|webp|svg\+xml);base64,(.+)$/i.exec(layer.src)
    if (!match) return layer
    const extension = match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase() === 'svg+xml' ? 'svg' : match[1].toLowerCase()
    const path = `assets/layer-${String(++assetIndex).padStart(2, '0')}.${extension}`
    const binary = atob(match[2])
    assets[path] = Uint8Array.from(binary, character => character.charCodeAt(0))
    return { ...layer, src: path }
  })
  const fontAssets = (template.fontAssets ?? []).map(font => {
    const match = /^data:font\/(woff2?|ttf|otf);base64,(.+)$/i.exec(font.src)
    if (!match) return font
    const extension = match[1].toLowerCase()
    const path = `assets/font-${String(++assetIndex).padStart(2, '0')}.${extension}`
    const binary = atob(match[2])
    assets[path] = Uint8Array.from(binary, character => character.charCodeAt(0))
    return { ...font, src: path }
  })
  const manifest: PackManifest = { ...template, schemaVersion: 1, requiredSlots: template.slots.length, layers, fontAssets }
  return new Blob([zipSync({ 'manifest.json': strToU8(JSON.stringify(manifest, null, 2)), ...assets })], { type: 'application/zip' })
}
