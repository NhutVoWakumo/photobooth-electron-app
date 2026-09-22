import type { Language, TemplateCopy } from './i18n'

export type TemplateId = string
export type CustomLayoutKind = 'strip-3' | 'strip-4' | 'grid-6' | 'portrait' | 'landscape' | 'triple' | 'mosaic-3a' | 'mosaic-3b' | 'mosaic-4' | 'duo-vertical' | 'duo-horizontal'

export type FrameSlotShape = 'rectangle' | 'rounded' | 'circle' | 'ellipse' | 'arch' | 'heart' | 'diamond' | 'star' | 'scallop' | 'blob' | 'ticket'
export type FrameStickerKind = 'heart' | 'sparkle' | 'flower' | 'bow' | 'smile' | 'music' | 'cloud' | 'bolt' | 'cherry' | 'star'
export function stickerGlyph(sticker: FrameStickerKind): string {
  return { heart: '♥', sparkle: '✦', flower: '✿', bow: '⋈', smile: '☺', music: '♫', cloud: '☁', bolt: 'ϟ', cherry: '●●', star: '★' }[sticker]
}
export type FrameBackgroundKind = 'solid' | 'checker' | 'grid' | 'dots' | 'stripes' | 'gradient'
export interface FrameBackground { kind: FrameBackgroundKind; color: string; secondaryColor: string; scale: number; angle: number }
export interface FrameFontAsset { id: string; name: string; family: string; src: string }
export interface FrameSlot {
  id: string
  x: number
  y: number
  width: number
  height: number
  shape?: FrameSlotShape
  radius?: number
  rotation?: number
  zIndex?: number
  stroke?: string
  strokeWidth?: number
  hidden?: boolean
  locked?: boolean
  fit?: 'cover' | 'contain'
}
interface FrameLayerState { hidden?: boolean; locked?: boolean }
export interface FrameTextLayer extends FrameLayerState { id: string; type: 'text'; x: number; y: number; width: number; height: number; text: string; color: string; fontSize: number; fontWeight: number; align: 'left' | 'center' | 'right'; fontFamily?: string; letterSpacing?: number; italic?: boolean; stroke?: string; strokeWidth?: number; shadowColor?: string; shadowBlur?: number; rotation?: number; zIndex: number }
export interface FrameShapeLayer extends FrameLayerState { id: string; type: 'shape'; x: number; y: number; width: number; height: number; shape: FrameSlotShape; fill: string; stroke: string; strokeWidth: number; rotation?: number; zIndex: number }
export interface FrameImageLayer extends FrameLayerState { id: string; type: 'image'; x: number; y: number; width: number; height: number; src: string; opacity: number; fit?: 'contain' | 'cover'; rotation?: number; zIndex: number }
export interface FrameFreehandLayer extends FrameLayerState { id: string; type: 'freehand'; points: Array<{ x: number; y: number }>; color: string; strokeWidth: number; zIndex: number }
export interface FrameStickerLayer extends FrameLayerState { id: string; type: 'sticker'; x: number; y: number; width: number; height: number; sticker: FrameStickerKind; color: string; secondaryColor: string; stroke: string; strokeWidth: number; rotation?: number; zIndex: number }
export type FrameLayer = FrameTextLayer | FrameShapeLayer | FrameImageLayer | FrameFreehandLayer | FrameStickerLayer
export interface FrameTheme { id: string; label: string; paper: string; ink: string; accent: string; slotLight: string; slotDark: string }
export interface TemplateManifest {
  id: TemplateId
  name: string
  description: string
  rows: number
  columns: number
  requiredSlots: number
  printLabel: string
  output: { width: number; height: number; ppi: number }
  slots: FrameSlot[]
  layers?: FrameLayer[]
  fontAssets?: FrameFontAsset[]
  background?: FrameBackground
  theme: FrameTheme
  builtIn?: boolean
  createdAt?: string
}

const standardPadding = .075
const header = .12
const footer = .08
const gap = .025

export const frameThemes: FrameTheme[] = [
  { id: 'luma', label: 'LUMA sage', paper: '#f8faf4', ink: '#193525', accent: '#8fbd87', slotLight: '#d8ead4', slotDark: '#7ca374' },
  { id: 'peach', label: 'Peach club', paper: '#fff5ee', ink: '#462519', accent: '#ec9a70', slotLight: '#ffd3bd', slotDark: '#c96848' },
  { id: 'night', label: 'After dark', paper: '#17231e', ink: '#f7faf3', accent: '#d1ee85', slotLight: '#557564', slotDark: '#284235' },
  { id: 'rose', label: 'Rose garden', paper: '#fff6f7', ink: '#522536', accent: '#eaa6b9', slotLight: '#f9d4dc', slotDark: '#c56e87' }
]

function createSlots(rows: number, columns: number): FrameSlot[] {
  const availableWidth = 1 - standardPadding * 2 - gap * (columns - 1)
  const availableHeight = 1 - header - footer - standardPadding * 2 - gap * (rows - 1)
  const slotWidth = availableWidth / columns
  const slotHeight = availableHeight / rows
  return Array.from({ length: rows * columns }, (_, index) => {
    const row = Math.floor(index / columns)
    const column = index % columns
    return { id: `slot-${index + 1}`, x: standardPadding + column * (slotWidth + gap), y: header + standardPadding + row * (slotHeight + gap), width: slotWidth, height: slotHeight, fit: 'contain' }
  })
}

const layouts: Record<CustomLayoutKind, { rows: number; columns: number; slots: FrameSlot[] }> = {
  'strip-3': { rows: 3, columns: 1, slots: createSlots(3, 1) },
  'strip-4': { rows: 4, columns: 1, slots: createSlots(4, 1) },
  'grid-6': { rows: 3, columns: 2, slots: createSlots(3, 2) },
  portrait: { rows: 1, columns: 1, slots: createSlots(1, 1) },
  landscape: { rows: 1, columns: 1, slots: [{ id: 'slot-1', x: .075, y: .205, width: .85, height: .58, fit: 'contain' }] },
  triple: { rows: 1, columns: 3, slots: createSlots(1, 3) },
  'mosaic-3a': { rows: 2, columns: 2, slots: [{ id: 'slot-1', x: .075, y: .205, width: .42, height: .28 }, { id: 'slot-2', x: .075, y: .515, width: .42, height: .28 }, { id: 'slot-3', x: .525, y: .36, width: .4, height: .435 }] },
  'mosaic-3b': { rows: 2, columns: 2, slots: [{ id: 'slot-1', x: .075, y: .205, width: .42, height: .28 }, { id: 'slot-2', x: .075, y: .515, width: .42, height: .28 }, { id: 'slot-3', x: .525, y: .205, width: .4, height: .28 }] },
  'mosaic-4': { rows: 2, columns: 3, slots: [{ id: 'slot-1', x: .075, y: .52, width: .265, height: .275 }, { id: 'slot-2', x: .365, y: .52, width: .265, height: .275 }, { id: 'slot-3', x: .655, y: .52, width: .27, height: .275 }, { id: 'slot-4', x: .365, y: .205, width: .56, height: .275 }] },
  'duo-vertical': { rows: 2, columns: 1, slots: createSlots(2, 1) },
  'duo-horizontal': { rows: 1, columns: 2, slots: createSlots(1, 2) }
}

function preset(id: string, name: string, description: string, kind: CustomLayoutKind, printLabel: string, output: TemplateManifest['output'], theme = frameThemes[0]): TemplateManifest {
  const layout = layouts[kind]
  return { id, name, description, rows: layout.rows, columns: layout.columns, requiredSlots: layout.slots.length, printLabel, output, slots: layout.slots.map(slot => ({ ...slot, fit: slot.fit ?? 'contain' })), theme, builtIn: true }
}

export const templates: TemplateManifest[] = [
  preset('classic-4x1', 'Classic strip', 'Four portraits, stacked.', 'strip-4', '2 × 6 in strip', { width: 600, height: 1800, ppi: 300 }),
  preset('strip-3', 'Three on a strip', 'A shorter vertical sequence.', 'strip-3', '2 × 6 in strip', { width: 600, height: 1800, ppi: 300 }, frameThemes[3]),
  preset('grid-3x2', 'Six-frame grid', 'Three rows, two columns.', 'grid-6', '4 × 6 in postcard', { width: 1200, height: 1800, ppi: 300 }),
  preset('portrait-1x1', 'Full portrait', 'One photograph, generous scale.', 'portrait', '4 × 6 in postcard', { width: 1200, height: 1800, ppi: 300 }),
  preset('landscape-1x1', 'Wide single', 'One wide landscape photograph.', 'landscape', '6 × 4 in postcard', { width: 1800, height: 1200, ppi: 300 }, frameThemes[1]),
  preset('triple-landscape', 'Three across', 'A horizontal three-photo story.', 'triple', '6 × 4 in postcard', { width: 1800, height: 1200, ppi: 300 }),
  preset('mosaic-3a', 'Corner story', 'Three photos with an editorial lead.', 'mosaic-3a', '4 × 6 in postcard', { width: 1200, height: 1800, ppi: 300 }, frameThemes[1]),
  preset('mosaic-3b', 'Gallery trio', 'A quiet three-photo composition.', 'mosaic-3b', '4 × 6 in postcard', { width: 1200, height: 1800, ppi: 300 }, frameThemes[3]),
  preset('mosaic-4', 'Four part', 'A feature image with three moments.', 'mosaic-4', '4 × 6 in postcard', { width: 1200, height: 1800, ppi: 300 }, frameThemes[2]),
  preset('duo-vertical', 'Vertical duo', 'Two moments, one strip.', 'duo-vertical', '4 × 6 in postcard', { width: 1200, height: 1800, ppi: 300 }),
  preset('duo-horizontal', 'Side by side', 'Two photographs in a landscape pair.', 'duo-horizontal', '6 × 4 in postcard', { width: 1800, height: 1200, ppi: 300 }, frameThemes[2]),
  {
    id: 'lucky-pop', name: 'Lucky pop', description: 'Playful Y2K scrapbook with shaped portraits.', rows: 3, columns: 1, requiredSlots: 3, printLabel: '2 × 6 in strip', output: { width: 600, height: 1800, ppi: 300 }, builtIn: true,
    theme: { id: 'lucky-pop', label: 'Lucky pop', paper: '#e8f1a9', ink: '#284b35', accent: '#ff78a7', slotLight: '#d9e8cb', slotDark: '#88aa78' },
    background: { kind: 'checker', color: '#edf5bc', secondaryColor: '#e1ec99', scale: 8, angle: 0 },
    slots: [
      { id: 'slot-1', x: .09, y: .14, width: .82, height: .22, shape: 'blob', fit: 'cover', stroke: '#ffffff', strokeWidth: 8, zIndex: 10 },
      { id: 'slot-2', x: .09, y: .39, width: .82, height: .22, shape: 'heart', fit: 'cover', stroke: '#ffffff', strokeWidth: 8, zIndex: 10 },
      { id: 'slot-3', x: .09, y: .64, width: .82, height: .22, shape: 'scallop', fit: 'cover', stroke: '#ffffff', strokeWidth: 8, zIndex: 10 }
    ],
    layers: [
      { id: 'title', type: 'text', x: .08, y: .045, width: .84, height: .07, text: 'LUCKY DAY', color: '#284b35', fontSize: 7, fontWeight: 900, align: 'center', fontFamily: 'display', letterSpacing: .08, stroke: '#ffffff', strokeWidth: 1.5, rotation: -2, zIndex: 30 },
      { id: 'heart', type: 'sticker', x: .02, y: .05, width: .18, height: .06, sticker: 'heart', color: '#ff78a7', secondaryColor: '#ffffff', stroke: '#ffffff', strokeWidth: 2, rotation: -14, zIndex: 35 },
      { id: 'flower', type: 'sticker', x: .78, y: .1, width: .18, height: .06, sticker: 'flower', color: '#ffffff', secondaryColor: '#ffbf47', stroke: '#284b35', strokeWidth: 1.5, rotation: 12, zIndex: 35 },
      { id: 'sparkle', type: 'sticker', x: .03, y: .57, width: .14, height: .045, sticker: 'sparkle', color: '#ffbf47', secondaryColor: '#ffffff', stroke: '#284b35', strokeWidth: 1, rotation: -8, zIndex: 35 },
      { id: 'footer', type: 'text', x: .08, y: .91, width: .84, height: .04, text: 'YOU MAKE TODAY BRIGHT', color: '#284b35', fontSize: 2.6, fontWeight: 800, align: 'center', fontFamily: 'sans', letterSpacing: .12, zIndex: 30 }
    ]
  },
  {
    id: 'family-story', name: 'Family story', description: 'Four soft-edged moments on a clean 5 × 15 cm strip.', rows: 4, columns: 1, requiredSlots: 4, printLabel: '2 × 6 in strip', output: { width: 600, height: 1800, ppi: 300 }, builtIn: true,
    theme: { id: 'family-story', label: 'Family story', paper: '#ffffff', ink: '#2d4933', accent: '#9caf78', slotLight: '#edf1e9', slotDark: '#b9c7ac' },
    background: { kind: 'solid', color: '#ffffff', secondaryColor: '#ffffff', scale: 8, angle: 0 },
    slots: [
      { id: 'slot-1', x: .09, y: .045, width: .82, height: .195, shape: 'rounded', radius: .105, fit: 'cover', zIndex: 10 },
      { id: 'slot-2', x: .09, y: .275, width: .82, height: .195, shape: 'rounded', radius: .105, fit: 'cover', zIndex: 10 },
      { id: 'slot-3', x: .09, y: .505, width: .82, height: .195, shape: 'rounded', radius: .105, fit: 'cover', zIndex: 10 },
      { id: 'slot-4', x: .09, y: .735, width: .82, height: .195, shape: 'rounded', radius: .105, fit: 'cover', zIndex: 10 }
    ],
    layers: [
      { id: 'family-wordmark', type: 'text', x: .12, y: .945, width: .76, height: .038, text: 'Family', color: '#92a46e', fontSize: 7.4, fontWeight: 500, align: 'center', fontFamily: 'script', italic: true, zIndex: 30 }
    ]
  }
]

export function getTemplate(id: TemplateId, customTemplates: TemplateManifest[] = []): TemplateManifest {
  const template = [...templates, ...customTemplates].find(item => item.id === id)
  if (!template) throw new Error(`Unknown template: ${id}`)
  return template
}

function tidyDimension(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, '')
}

export function getPhysicalPrintSize(template: TemplateManifest): string {
  const ppi = Math.max(1, template.output.ppi || 300)
  const widthInches = template.output.width / ppi
  const heightInches = template.output.height / ppi
  const widthMm = widthInches * 25.4
  const heightMm = heightInches * 25.4
  return `${tidyDimension(widthInches)} × ${tidyDimension(heightInches)} in / ${tidyDimension(widthMm)} × ${tidyDimension(heightMm)} mm`
}

export function createCustomTemplate(name: string, kind: CustomLayoutKind, themeId: string): TemplateManifest {
  const layout = layouts[kind]
  const theme = frameThemes.find(item => item.id === themeId) ?? frameThemes[0]
  const landscape = kind === 'landscape' || kind === 'triple' || kind === 'duo-horizontal'
  return { id: `custom-${crypto.randomUUID()}`, name: name.trim() || 'Untitled frame', description: 'A custom layout made in LUMA Booth.', rows: layout.rows, columns: layout.columns, requiredSlots: layout.slots.length, printLabel: landscape ? '6 × 4 in postcard' : '4 × 6 in postcard', output: landscape ? { width: 1800, height: 1200, ppi: 300 } : { width: 1200, height: 1800, ppi: 300 }, slots: layout.slots.map(slot => ({ ...slot, fit: slot.fit ?? 'contain' })), theme, createdAt: new Date().toISOString() }
}

export function parseFrameImport(source: string): TemplateManifest {
  const value = JSON.parse(source) as Partial<TemplateManifest>
  if (!value.id || !value.name || !value.output || !Array.isArray(value.slots) || value.slots.length < 1 || value.slots.length > 12) throw new Error('This file is not a valid LUMA frame manifest.')
  if (!Number.isFinite(value.output.width) || !Number.isFinite(value.output.height) || value.output.width! < 300 || value.output.width! > 6000 || value.output.height! < 300 || value.output.height! > 6000) throw new Error('Frame dimensions must be between 300 and 6000 pixels.')
  const slots: FrameSlot[] = value.slots.map((slot, index) => {
    if (![slot.x, slot.y, slot.width, slot.height].every(number => typeof number === 'number' && number >= 0 && number <= 1)) throw new Error(`Slot ${index + 1} has invalid coordinates.`)
    if (!slot.width || !slot.height || slot.x! + slot.width! > 1 || slot.y! + slot.height! > 1) throw new Error(`Slot ${index + 1} falls outside the canvas.`)
    const shape = slot.shape && ['rectangle', 'rounded', 'circle', 'ellipse', 'arch', 'heart', 'diamond', 'star', 'scallop', 'blob', 'ticket'].includes(slot.shape) ? slot.shape : 'rectangle'
    return { id: slot.id || `slot-${index + 1}`, x: slot.x!, y: slot.y!, width: slot.width!, height: slot.height!, shape, radius: finiteOr(slot.radius, .08), rotation: finiteOr(slot.rotation, 0), zIndex: finiteOr(slot.zIndex, 10), stroke: typeof slot.stroke === 'string' ? slot.stroke : undefined, strokeWidth: Math.max(0, Math.min(20, finiteOr(slot.strokeWidth, 0))), hidden: Boolean(slot.hidden), locked: Boolean(slot.locked), fit: slot.fit === 'cover' ? 'cover' : 'contain' }
  })
  if (Array.isArray(value.layers) && value.layers.length > 100) throw new Error('A frame can contain at most 100 layers.')
  const layers = Array.isArray(value.layers) ? value.layers.map((layer, index) => parseLayer(layer, index)) : []
  const fontAssets = Array.isArray(value.fontAssets) ? value.fontAssets.slice(0, 8).flatMap((font, index) => {
    if (!font || typeof font !== 'object' || typeof font.id !== 'string' || typeof font.name !== 'string' || typeof font.family !== 'string' || typeof font.src !== 'string' || !/^data:font\/(woff2?|ttf|otf);base64,/i.test(font.src)) throw new Error(`Font ${index + 1} is invalid.`)
    return [{ id: font.id.slice(0, 80), name: font.name.slice(0, 80), family: font.family.slice(0, 80), src: font.src }]
  }) : []
  const theme = value.theme
  const safeTheme = theme && [theme.paper, theme.ink, theme.accent, theme.slotLight, theme.slotDark].every(color => typeof color === 'string')
    ? { id: typeof theme.id === 'string' ? theme.id : 'custom', label: typeof theme.label === 'string' ? theme.label : 'Custom', paper: theme.paper, ink: theme.ink, accent: theme.accent, slotLight: theme.slotLight, slotDark: theme.slotDark }
    : frameThemes[0]
  const background = value.background && ['solid', 'checker', 'grid', 'dots', 'stripes', 'gradient'].includes(value.background.kind) ? { kind: value.background.kind, color: value.background.color || safeTheme.paper, secondaryColor: value.background.secondaryColor || safeTheme.slotLight, scale: Math.max(2, Math.min(30, finiteOr(value.background.scale, 8))), angle: finiteOr(value.background.angle, 0) } : undefined
  return { id: value.id.startsWith('custom-') ? value.id : `custom-${value.id}`, name: value.name.slice(0, 48), description: value.description?.slice(0, 120) || 'Imported custom layout.', rows: value.rows || 1, columns: value.columns || 1, requiredSlots: slots.length, printLabel: value.printLabel || '4 × 6 in postcard', output: { width: value.output.width || 1200, height: value.output.height || 1800, ppi: Math.max(72, Math.min(600, finiteOr(value.output.ppi, 300))) }, slots, layers, fontAssets, background, theme: safeTheme, createdAt: value.createdAt || new Date().toISOString() }
}

function finiteOr(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function parseLayer(layer: FrameLayer, index: number): FrameLayer {
  if (!layer || typeof layer.id !== 'string' || !['text', 'shape', 'image', 'freehand', 'sticker'].includes(layer.type)) throw new Error(`Layer ${index + 1} is invalid.`)
  const zIndex = finiteOr(layer.zIndex, 20)
  if (layer.type === 'freehand') {
    if (!Array.isArray(layer.points) || layer.points.length > 10_000 || layer.points.some(point => !point || !Number.isFinite(point.x) || !Number.isFinite(point.y) || point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1)) throw new Error(`Drawing layer ${index + 1} is invalid.`)
    return { ...layer, color: typeof layer.color === 'string' ? layer.color : '#193525', strokeWidth: Math.max(1, Math.min(20, finiteOr(layer.strokeWidth, 3))), zIndex }
  }
  if (![layer.x, layer.y, layer.width, layer.height].every(number => typeof number === 'number' && Number.isFinite(number) && number >= 0 && number <= 1) || layer.width <= 0 || layer.height <= 0 || layer.x + layer.width > 1 || layer.y + layer.height > 1) throw new Error(`Layer ${index + 1} falls outside the canvas.`)
  const geometry = { x: layer.x, y: layer.y, width: layer.width, height: layer.height, rotation: finiteOr(layer.rotation, 0), zIndex }
  if (layer.type === 'text') return { ...layer, ...geometry, text: String(layer.text ?? '').slice(0, 500), color: typeof layer.color === 'string' ? layer.color : '#193525', fontSize: Math.max(1, Math.min(30, finiteOr(layer.fontSize, 5))), fontWeight: Math.max(100, Math.min(900, finiteOr(layer.fontWeight, 700))), align: ['left', 'center', 'right'].includes(layer.align) ? layer.align : 'center', fontFamily: typeof layer.fontFamily === 'string' && layer.fontFamily.length <= 80 ? layer.fontFamily : 'sans' }
  if (layer.type === 'image') {
    if (typeof layer.src !== 'string' || !/^data:image\/(png|jpeg|webp|svg\+xml);/i.test(layer.src)) throw new Error(`Image layer ${index + 1} must contain an embedded PNG, JPEG, WebP, or SVG.`)
    return { ...layer, ...geometry, opacity: Math.max(.05, Math.min(1, finiteOr(layer.opacity, 1))), fit: layer.fit === 'cover' ? 'cover' : 'contain' }
  }
  if (layer.type === 'sticker') {
    const sticker = ['heart', 'sparkle', 'flower', 'bow', 'smile', 'music', 'cloud', 'bolt', 'cherry', 'star'].includes(layer.sticker) ? layer.sticker : 'star'
    return { ...layer, ...geometry, sticker, color: typeof layer.color === 'string' ? layer.color : '#8fbd87', secondaryColor: typeof layer.secondaryColor === 'string' ? layer.secondaryColor : '#ffffff', stroke: typeof layer.stroke === 'string' ? layer.stroke : '#193525', strokeWidth: Math.max(0, Math.min(20, finiteOr(layer.strokeWidth, 1))) }
  }
  const shape = ['rectangle', 'rounded', 'circle', 'ellipse', 'arch', 'heart', 'diamond', 'star', 'scallop', 'blob', 'ticket'].includes(layer.shape) ? layer.shape : 'rectangle'
  return { ...layer, ...geometry, shape, fill: typeof layer.fill === 'string' ? layer.fill : '#8fbd87', stroke: typeof layer.stroke === 'string' ? layer.stroke : 'transparent', strokeWidth: Math.max(0, Math.min(20, finiteOr(layer.strokeWidth, 0))) }
}

export function getTemplateCopy(language: Language, template: TemplateManifest): TemplateCopy {
  if (template.id !== 'classic-4x1' && template.id !== 'grid-3x2' && template.id !== 'portrait-1x1') return { name: template.name, description: template.description, printLabel: template.printLabel }
  if (language === 'en') return { name: template.name, description: template.description, printLabel: template.printLabel }
  if (template.id === 'classic-4x1') return { name: 'Dải ảnh cổ điển', description: 'Bốn chân dung xếp dọc.', printLabel: 'Dải 2 × 6 inch' }
  if (template.id === 'grid-3x2') return { name: 'Lưới sáu ảnh', description: 'Ba hàng, hai cột.', printLabel: 'Bưu thiếp 4 × 6 inch' }
  return { name: 'Chân dung toàn khung', description: 'Một ảnh với kích thước rộng rãi.', printLabel: 'Bưu thiếp 4 × 6 inch' }
}
