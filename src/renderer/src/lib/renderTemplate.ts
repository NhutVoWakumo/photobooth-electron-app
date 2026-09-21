import type { FrameBackground, FrameLayer, FrameSlot, FrameStickerLayer, TemplateManifest } from '../templates'
import { radialShapePoints } from './frameGeometry'
import type { PhotoTransform } from '../types'

export interface TemplateRenderOptions {
  eventName: string
  photos: string[]
  template: TemplateManifest
  outputJpegQuality: number
  photoTransforms?: PhotoTransform[]
}

export interface PrintSheet {
  dataUrl: string
  layoutId: 'single-4x6' | 'two-up-4x6'
  width: number
  height: number
  copiesPerSheet: number
}

export async function renderTemplate({ eventName, photos, template, outputJpegQuality, photoTransforms = [] }: TemplateRenderOptions): Promise<string> {
  const canvas = document.createElement('canvas')
  canvas.width = template.output.width
  canvas.height = template.output.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not create the template canvas.')

  const { width, height } = canvas
  drawBackground(context, template.background, template.theme.paper, width, height)
  context.textAlign = 'center'
  if ((template.layers?.length ?? 0) === 0) {
    context.fillStyle = template.theme.ink
    context.fillRect(0, 0, width, Math.max(12, height * 0.008))
    context.fillStyle = template.theme.ink
    context.font = `600 ${Math.max(28, width * 0.047)}px Georgia`
    context.fillText(eventName || 'LUMA Booth', width / 2, height * 0.052)
    context.font = `600 ${Math.max(12, width * 0.02)}px system-ui`
    context.fillStyle = template.theme.accent
    context.fillText('A MOMENT, KEPT', width / 2, height * 0.075)
  }

  const images = await Promise.all(photos.slice(0, template.requiredSlots).map(loadImage))
  const renderables = [
    ...template.slots.map((slot, index) => ({ kind: 'slot' as const, zIndex: slot.zIndex ?? 10, slot, image: images[index] })).filter(item => !item.slot.hidden),
    ...(template.layers ?? []).filter(layer => !layer.hidden).map(layer => ({ kind: 'layer' as const, zIndex: layer.zIndex, layer }))
  ].sort((a, b) => a.zIndex - b.zIndex)

  for (const item of renderables) {
    if (item.kind === 'layer') {
      await drawLayer(context, item.layer, width, height)
      continue
    }
    const x = Math.round(item.slot.x * width)
    const y = Math.round(item.slot.y * height)
    const slotWidth = Math.round(item.slot.width * width)
    const slotHeight = Math.round(item.slot.height * height)
    drawSlot(context, item.slot, item.image, x, y, slotWidth, slotHeight, template.theme.slotLight, photoTransforms[template.slots.indexOf(item.slot)])
  }

  if ((template.layers?.length ?? 0) === 0) {
    context.fillStyle = template.theme.ink
    context.font = `600 ${Math.max(13, width * 0.021)}px system-ui`
    context.fillText('LUMA PHOTO BOOTH', width / 2, height - height * 0.034)
    context.fillStyle = template.theme.accent
    context.font = `${Math.max(12, width * 0.018)}px system-ui`
    context.fillText(new Date().toLocaleDateString(), width / 2, height - height * 0.018)
  }

  return canvas.toDataURL('image/jpeg', outputJpegQuality)
}

function drawSlot(context: CanvasRenderingContext2D, slot: FrameSlot, image: HTMLImageElement | undefined, x: number, y: number, width: number, height: number, fill: string, transform?: PhotoTransform): void {
  context.save()
  context.translate(x + width / 2, y + height / 2)
  context.rotate((slot.rotation ?? 0) * Math.PI / 180)
  context.translate(-width / 2, -height / 2)
  slotPath(context, slot, width, height)
  context.clip()
  context.fillStyle = fill
  context.fillRect(0, 0, width, height)
  if (image) (slot.fit ?? 'contain') === 'cover'
    ? drawCover(context, image, 0, 0, width, height, transform)
    : drawContain(context, image, 0, 0, width, height)
  if (slot.strokeWidth && slot.stroke) {
    slotPath(context, slot, width, height)
    context.strokeStyle = slot.stroke
    context.lineWidth = slot.strokeWidth
    context.stroke()
  }
  context.restore()
}

function slotPath(context: CanvasRenderingContext2D, slot: FrameSlot, width: number, height: number): void {
  context.beginPath()
  if (slot.shape === 'circle' || slot.shape === 'ellipse') context.ellipse(width / 2, height / 2, width / 2, height / 2, 0, 0, Math.PI * 2)
  else if (slot.shape === 'rounded') context.roundRect(0, 0, width, height, Math.min(width, height) * (slot.radius ?? .08))
  else if (slot.shape === 'arch') {
    context.moveTo(0, height)
    context.lineTo(0, height * .35)
    context.bezierCurveTo(0, -height * .05, width, -height * .05, width, height * .35)
    context.lineTo(width, height)
    context.closePath()
  } else if (slot.shape === 'heart') {
    context.moveTo(width / 2, height * .94)
    context.bezierCurveTo(width * .38, height * .78, 0, height * .58, width * .04, height * .29)
    context.bezierCurveTo(width * .07, height * .04, width * .36, height * .01, width / 2, height * .25)
    context.bezierCurveTo(width * .64, height * .01, width * .93, height * .04, width * .96, height * .29)
    context.bezierCurveTo(width, height * .58, width * .62, height * .78, width / 2, height * .94)
    context.closePath()
  } else if (slot.shape === 'diamond') {
    context.moveTo(width / 2, 0); context.lineTo(width, height / 2); context.lineTo(width / 2, height); context.lineTo(0, height / 2); context.closePath()
  } else if (slot.shape === 'star') {
    for (let point = 0; point < 10; point += 1) {
      const angle = -Math.PI / 2 + point * Math.PI / 5
      const radius = point % 2 === 0 ? .5 : .22
      const px = width / 2 + Math.cos(angle) * width * radius
      const py = height / 2 + Math.sin(angle) * height * radius
      point === 0 ? context.moveTo(px, py) : context.lineTo(px, py)
    }
    context.closePath()
  } else if (slot.shape === 'ticket') {
    context.moveTo(0, 0); context.lineTo(width, 0); context.lineTo(width, height * .36); context.lineTo(width * .92, height * .5); context.lineTo(width, height * .64); context.lineTo(width, height); context.lineTo(0, height); context.lineTo(0, height * .64); context.lineTo(width * .08, height * .5); context.lineTo(0, height * .36); context.closePath()
  } else if (slot.shape === 'blob' || slot.shape === 'scallop') {
    radialShapePoints(slot.shape).forEach(([px, py], index) => index === 0 ? context.moveTo(px * width, py * height) : context.lineTo(px * width, py * height))
    context.closePath()
  } else context.rect(0, 0, width, height)
}

async function drawLayer(context: CanvasRenderingContext2D, layer: FrameLayer, canvasWidth: number, canvasHeight: number): Promise<void> {
  if (layer.type === 'freehand') {
    if (layer.points.length < 2) return
    context.save()
    context.strokeStyle = layer.color
    context.lineWidth = layer.strokeWidth * canvasWidth / 100
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.beginPath()
    layer.points.forEach((point, index) => index === 0 ? context.moveTo(point.x * canvasWidth, point.y * canvasHeight) : context.lineTo(point.x * canvasWidth, point.y * canvasHeight))
    context.stroke()
    context.restore()
    return
  }
  const x = layer.x * canvasWidth
  const y = layer.y * canvasHeight
  const width = layer.width * canvasWidth
  const height = layer.height * canvasHeight
  context.save()
  context.translate(x + width / 2, y + height / 2)
  context.rotate((layer.rotation ?? 0) * Math.PI / 180)
  context.translate(-width / 2, -height / 2)
  if (layer.type === 'image') {
    const image = await loadImage(layer.src)
    context.globalAlpha = layer.opacity
    drawContain(context, image, 0, 0, width, height)
  } else if (layer.type === 'text') {
    context.fillStyle = layer.color
    context.font = `${layer.italic ? 'italic ' : ''}${layer.fontWeight} ${Math.max(10, layer.fontSize * canvasWidth / 100)}px ${canvasFont(layer.fontFamily)}`
    context.shadowColor = layer.shadowColor ?? 'transparent'
    context.shadowBlur = layer.shadowBlur ?? 0
    context.letterSpacing = `${(layer.letterSpacing ?? 0) * Math.max(10, layer.fontSize * canvasWidth / 100)}px`
    context.textAlign = layer.align
    context.textBaseline = 'middle'
    const textX = layer.align === 'left' ? 0 : layer.align === 'right' ? width : width / 2
    if (layer.strokeWidth && layer.stroke) { context.strokeStyle = layer.stroke; context.lineWidth = layer.strokeWidth * canvasWidth / 100; context.strokeText(layer.text, textX, height / 2, width) }
    context.fillText(layer.text, textX, height / 2, width)
  } else if (layer.type === 'sticker') {
    drawSticker(context, layer, width, height, canvasWidth)
  } else {
    slotPath(context, { id: layer.id, x: 0, y: 0, width: 1, height: 1, shape: layer.shape }, width, height)
    context.fillStyle = layer.fill
    context.fill()
    if (layer.strokeWidth > 0 && layer.stroke !== 'transparent') {
      context.strokeStyle = layer.stroke
      context.lineWidth = layer.strokeWidth * canvasWidth / 100
      context.stroke()
    }
  }
  context.restore()
}

function drawSticker(context: CanvasRenderingContext2D, layer: FrameStickerLayer, width: number, height: number, canvasWidth: number): void {
  const sx = width / 100
  const sy = height / 100
  const line = Math.max(1, layer.strokeWidth * canvasWidth / 100)
  const finish = (fill = layer.color) => { context.fillStyle = fill; context.fill(); if (layer.strokeWidth > 0) { context.strokeStyle = layer.stroke; context.lineWidth = line; context.lineJoin = 'round'; context.lineCap = 'round'; context.stroke() } }
  const path = (points: Array<[number, number]>) => { context.beginPath(); points.forEach(([x, y], index) => index === 0 ? context.moveTo(x * sx, y * sy) : context.lineTo(x * sx, y * sy)); context.closePath() }
  if (layer.sticker === 'heart') { context.beginPath(); context.moveTo(50 * sx, 88 * sy); context.bezierCurveTo(39 * sx, 76 * sy, 11 * sx, 61 * sy, 9 * sx, 35 * sy); context.bezierCurveTo(7 * sx, 14 * sy, 33 * sx, 7 * sy, 50 * sx, 29 * sy); context.bezierCurveTo(67 * sx, 7 * sy, 93 * sx, 14 * sy, 91 * sx, 35 * sy); context.bezierCurveTo(89 * sx, 61 * sy, 61 * sx, 76 * sy, 50 * sx, 88 * sy); finish(); return }
  if (layer.sticker === 'sparkle') { path([[50,5],[61,37],[94,50],[61,63],[50,95],[39,63],[6,50],[39,37]]); finish(); context.beginPath(); context.arc(78*sx,20*sy,7*Math.min(sx,sy),0,Math.PI*2); finish(layer.secondaryColor); return }
  if (layer.sticker === 'flower') { for (let petal = 0; petal < 5; petal += 1) { context.save(); context.translate(50*sx,50*sy); context.rotate(petal*Math.PI*2/5); context.beginPath(); context.ellipse(0,-25*sy,14*sx,23*sy,0,0,Math.PI*2); finish(); context.restore() } context.beginPath(); context.ellipse(50*sx,50*sy,15*sx,15*sy,0,0,Math.PI*2); finish(layer.secondaryColor); return }
  if (layer.sticker === 'bow') { context.beginPath(); context.moveTo(46*sx,44*sy); context.bezierCurveTo(31*sx,19*sy,8*sx,18*sy,10*sx,42*sy); context.bezierCurveTo(11*sx,58*sy,27*sx,62*sy,46*sx,54*sy); context.lineTo(23*sx,87*sy); context.lineTo(51*sx,69*sy); context.lineTo(77*sx,87*sy); context.lineTo(54*sx,54*sy); context.bezierCurveTo(73*sx,62*sy,89*sx,58*sy,90*sx,42*sy); context.bezierCurveTo(92*sx,18*sy,69*sx,19*sy,54*sx,44*sy); finish(); context.beginPath(); context.roundRect(40*sx,39*sy,20*sx,24*sy,7*Math.min(sx,sy)); finish(layer.secondaryColor); return }
  if (layer.sticker === 'smile') { context.beginPath(); context.ellipse(50*sx,50*sy,40*sx,40*sy,0,0,Math.PI*2); finish(); context.fillStyle=layer.stroke; context.beginPath(); context.arc(36*sx,42*sy,5*Math.min(sx,sy),0,Math.PI*2); context.arc(64*sx,42*sy,5*Math.min(sx,sy),0,Math.PI*2); context.fill(); context.beginPath(); context.arc(50*sx,53*sy,22*Math.min(sx,sy),.35,Math.PI-.35); context.strokeStyle=layer.stroke; context.lineWidth=line*2; context.stroke(); return }
  if (layer.sticker === 'music') { context.strokeStyle=layer.stroke; context.lineWidth=line*3; context.beginPath(); context.moveTo(38*sx,21*sy); context.lineTo(38*sx,70*sy); context.moveTo(38*sx,31*sy); context.lineTo(78*sx,22*sy); context.lineTo(78*sx,65*sy); context.stroke(); context.beginPath(); context.ellipse(25*sx,73*sy,15*sx,11*sy,0,0,Math.PI*2); finish(); context.beginPath(); context.ellipse(65*sx,68*sy,15*sx,11*sy,0,0,Math.PI*2); finish(layer.secondaryColor); return }
  if (layer.sticker === 'cloud') { context.beginPath(); context.moveTo(25*sx,75*sy); context.bezierCurveTo(7*sx,75*sy,7*sx,49*sy,25*sx,46*sy); context.bezierCurveTo(27*sx,24*sy,57*sx,17*sy,68*sx,35*sy); context.bezierCurveTo(91*sx,32*sy,98*sx,64*sy,78*sx,73*sy); context.closePath(); finish(); return }
  if (layer.sticker === 'bolt') { path([[54,4],[20,55],[45,55],[40,96],[80,37],[55,37]]); finish(); return }
  if (layer.sticker === 'cherry') { context.strokeStyle=layer.stroke; context.lineWidth=line*2; context.beginPath(); context.moveTo(48*sx,51*sy); context.quadraticCurveTo(55*sx,20*sy,72*sx,12*sy); context.moveTo(53*sx,32*sy); context.quadraticCurveTo(38*sx,16*sy,23*sx,21*sy); context.stroke(); context.beginPath(); context.ellipse(34*sx,68*sy,20*sx,20*sy,0,0,Math.PI*2); finish(); context.beginPath(); context.ellipse(69*sx,68*sy,20*sx,20*sy,0,0,Math.PI*2); finish(layer.secondaryColor); return }
  path([[50,5],[63,34],[95,37],[71,59],[78,91],[50,75],[22,91],[29,59],[5,37],[37,34]]); finish()
}

function canvasFont(font?: string): string {
  if (font === 'mono') return 'ui-monospace, Menlo, monospace'
  if (font === 'serif') return 'Georgia, serif'
  return 'system-ui, sans-serif'
}

function drawBackground(context: CanvasRenderingContext2D, background: FrameBackground | undefined, fallback: string, width: number, height: number): void {
  context.fillStyle = background?.color ?? fallback
  context.fillRect(0, 0, width, height)
  if (!background || background.kind === 'solid') return
  if (background.kind === 'gradient') {
    const angle = background.angle * Math.PI / 180
    const x = Math.cos(angle) * width / 2
    const y = Math.sin(angle) * height / 2
    const gradient = context.createLinearGradient(width / 2 - x, height / 2 - y, width / 2 + x, height / 2 + y)
    gradient.addColorStop(0, background.color); gradient.addColorStop(1, background.secondaryColor)
    context.fillStyle = gradient; context.fillRect(0, 0, width, height); return
  }
  const size = Math.max(8, width * background.scale / 100)
  context.fillStyle = background.secondaryColor
  if (background.kind === 'checker') {
    for (let y = 0; y < height; y += size) for (let x = 0; x < width; x += size) if ((Math.floor(x / size) + Math.floor(y / size)) % 2 === 0) context.fillRect(x, y, size, size)
  }
  else if (background.kind === 'grid') { context.strokeStyle = background.secondaryColor; context.lineWidth = Math.max(1, width / 600); for (let x = 0; x < width; x += size) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke() } for (let y = 0; y < height; y += size) { context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke() } }
  else if (background.kind === 'dots') for (let y = size / 2; y < height; y += size) for (let x = size / 2; x < width; x += size) { context.beginPath(); context.arc(x, y, size * .13, 0, Math.PI * 2); context.fill() }
  else if (background.kind === 'stripes') { context.save(); context.translate(width / 2, height / 2); context.rotate(background.angle * Math.PI / 180); for (let x = -width - height; x < width + height; x += size * 2) context.fillRect(x, -width - height, size, (width + height) * 2); context.restore() }
}

/**
 * Makes the exact file Phase 3 will hand to an OS printer. A 2 × 6 strip is
 * duplicated side-by-side on a 4 × 6 sheet; 4 × 6 templates stay one-up.
 */
export async function renderPrintSheet(strip: string, template: TemplateManifest, outputJpegQuality: number): Promise<PrintSheet> {
  const printWidth = 1200
  const printHeight = 1800

  const isTwoBySixStrip = template.output.width * 3 === template.output.height
  if (!isTwoBySixStrip) {
    return {
      dataUrl: strip,
      layoutId: 'single-4x6',
      width: printWidth,
      height: printHeight,
      copiesPerSheet: 1
    }
  }

  const image = await loadImage(strip)
  const canvas = document.createElement('canvas')
  canvas.width = printWidth
  canvas.height = printHeight
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not create the print sheet canvas.')

  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, printWidth, printHeight)
  context.drawImage(image, 0, 0, printWidth / 2, printHeight)
  context.drawImage(image, printWidth / 2, 0, printWidth / 2, printHeight)

  return {
    dataUrl: canvas.toDataURL('image/jpeg', outputJpegQuality),
    layoutId: 'two-up-4x6',
    width: printWidth,
    height: printHeight,
    copiesPerSheet: 2
  }
}

function drawCover(context: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, targetWidth: number, targetHeight: number, transform?: PhotoTransform): void {
  const zoom = Math.max(1, transform?.scale ?? 1)
  const scale = Math.max(targetWidth / image.width, targetHeight / image.height) * zoom
  const sourceWidth = targetWidth / scale
  const sourceHeight = targetHeight / scale
  const focalX = (Math.min(100, Math.max(-100, transform?.x ?? 0)) + 100) / 200
  const focalY = (Math.min(100, Math.max(-100, transform?.y ?? 0)) + 100) / 200
  const sourceX = (image.width - sourceWidth) * focalX
  const sourceY = (image.height - sourceHeight) * focalY
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, targetWidth, targetHeight)
}

function drawContain(context: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, targetWidth: number, targetHeight: number): void {
  const scale = Math.min(targetWidth / image.width, targetHeight / image.height)
  const width = image.width * scale
  const height = image.height * scale
  context.drawImage(image, x + (targetWidth - width) / 2, y + (targetHeight - height) / 2, width, height)
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('One captured photo could not be rendered.'))
    image.src = source
  })
}
