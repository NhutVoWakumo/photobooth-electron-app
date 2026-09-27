import { drawnSlotMask, slotMaskStyle, svgToSlotMask } from '../src/renderer/src/lib/slotMask'
import { parseFrameImport, type TemplateManifest } from '../src/renderer/src/templates'
import { exportFramePack, importFramePack } from '../src/renderer/src/lib/framePack'
import { renderTemplate } from '../src/renderer/src/lib/renderTemplate'

async function colourAt(dataUrl: string, x: number, y: number): Promise<number[]> {
  const image = new Image()
  image.src = dataUrl
  await image.decode()
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 300
  const context = canvas.getContext('2d')!
  context.drawImage(image, 0, 0)
  return Array.from(context.getImageData(x, y, 1, 1).data)
}

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message)
}

export async function runSlotMaskQc(): Promise<Record<string, unknown>> {
  const mask = svgToSlotMask('<svg viewBox="0 0 1000 1000"><path d="M100 100H900V400H550V900H100Z"/></svg>')
  const drawn = drawnSlotMask([{ x: .1, y: .1 }, { x: .9, y: .1 }, { x: .9, y: .9 }, { x: .1, y: .9 }])
  assert(drawn.startsWith('data:image/svg+xml'), 'Drawing did not produce an SVG mask.')
  const donut = drawnSlotMask([
    [{ x: .05, y: .05 }, { x: .95, y: .05 }, { x: .95, y: .95 }, { x: .05, y: .95 }],
    [{ x: .35, y: .35 }, { x: .65, y: .35 }, { x: .65, y: .65 }, { x: .35, y: .65 }]
  ])
  const template: TemplateManifest = {
    id: 'custom-mask-qc', name: 'Mask QC', description: 'Synthetic QC', rows: 1, columns: 1, requiredSlots: 1,
    printLabel: 'QC', output: { width: 300, height: 300, ppi: 300 },
    slots: [{ id: 'slot-1', x: 0, y: 0, width: 1, height: 1, shape: 'custom', mask, fit: 'cover' }],
    layers: [{ id: 'empty-drawing', type: 'freehand', points: [], color: '#000000', strokeWidth: 1, zIndex: 20 }],
    theme: { id: 'qc', label: 'QC', paper: '#ff0000', ink: '#000000', accent: '#000000', slotLight: '#ff0000', slotDark: '#ff0000' }
  }
  const photo = document.createElement('canvas')
  photo.width = photo.height = 300
  photo.getContext('2d')!.fillStyle = '#0000ff'
  photo.getContext('2d')!.fillRect(0, 0, 300, 300)
  const output = await renderTemplate({ eventName: '', photos: [photo.toDataURL()], template, outputJpegQuality: .95 })
  const inside = await colourAt(output, 150, 150)
  const outside = await colourAt(output, 210, 210)
  assert(inside[2] > 180 && inside[0] < 80, 'Photo was not visible inside the imported concave shape.')
  assert(outside[0] > 180 && outside[2] < 80, 'Photo was not clipped outside the imported concave shape.')
  const reloaded = parseFrameImport(JSON.stringify(template))
  assert(reloaded.slots[0].mask?.startsWith('data:image/svg+xml'), 'Manifest lost the mask.')
  const pack = new File([exportFramePack(template)], 'mask.luma-frame.zip', { type: 'application/zip' })
  const unpacked = await importFramePack(pack)
  assert(unpacked.slots[0].mask?.startsWith('data:image/svg+xml'), 'Frame Pack lost the mask.')
  const png = document.createElement('canvas')
  png.width = png.height = 100
  const pngContext = png.getContext('2d')!
  pngContext.fillStyle = '#ffffff'
  pngContext.beginPath()
  pngContext.arc(50, 50, 35, 0, Math.PI * 2)
  pngContext.fill()
  const pngTemplate = { ...template, slots: [{ ...template.slots[0], mask: png.toDataURL('image/png') }] }
  const pngOutput = await renderTemplate({ eventName: '', photos: [photo.toDataURL()], template: pngTemplate, outputJpegQuality: .95 })
  const pngInside = await colourAt(pngOutput, 150, 150)
  const pngOutside = await colourAt(pngOutput, 20, 20)
  assert(pngInside[2] > 180 && pngOutside[0] > 180, 'Transparent PNG shape did not clip correctly.')
  const donutOutput = await renderTemplate({ eventName: '', photos: [photo.toDataURL()], template: { ...template, slots: [{ ...template.slots[0], mask: donut }] }, outputJpegQuality: .95 })
  const donutHole = await colourAt(donutOutput, 150, 150)
  const donutRing = await colourAt(donutOutput, 50, 150)
  assert(donutHole[0] > 180 && donutRing[2] > 180, 'Nested outlines did not produce a transparent hole.')
  const style = slotMaskStyle(mask)
  assert(Boolean(style.WebkitMaskImage), 'Preview does not have a CSS mask.')
  let blocked = false
  try { svgToSlotMask('<svg viewBox="0 0 1 1"><script>alert(1)</script></svg>') } catch { blocked = true }
  assert(blocked, 'Script-only SVG was accepted.')
  return { passed: true, svgInside: inside.slice(0, 3), svgOutside: outside.slice(0, 3), pngInside: pngInside.slice(0, 3), pngOutside: pngOutside.slice(0, 3), donutHole: donutHole.slice(0, 3), roundTrip: true }
}
