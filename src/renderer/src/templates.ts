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
export interface FrameImageLayer extends FrameLayerState { id: string; type: 'image'; x: number; y: number; width: number; height: number; src: string; opacity: number; rotation?: number; zIndex: number }
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

// Original vector art for the garden strip. Keeping background and foreground
// separate makes the design editable in Frame Studio and preserves its print
// quality at every output resolution.
function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;base64,${btoa(svg)}`
}

const gardenPicnicBackground = svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 1800">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2=".85" y2="1"><stop stop-color="#a9d3f3"/><stop offset=".28" stop-color="#d7e5fb"/><stop offset=".52" stop-color="#fae9f1"/><stop offset=".74" stop-color="#d9eeb5"/><stop offset="1" stop-color="#b7db72"/></linearGradient>
    <filter id="wash"><feTurbulence baseFrequency=".015" numOctaves="2" seed="8" type="fractalNoise"/><feColorMatrix values="1 0 0 0 0 0 1 0 0 0 .7 0 .7 0 0 0 0 0 .16 0"/></filter>
  </defs>
  <rect width="600" height="1800" fill="url(#sky)"/>
  <rect width="600" height="1800" filter="url(#wash)" opacity=".42"/>
  <path d="M0 1310c60-43 104-27 162 10 61 39 117 21 180-12 91-48 172-26 258 25v467H0z" fill="#b9df72" opacity=".72"/>
  <path d="M0 1450c86-73 148-57 228-5 95 61 182 18 264-31 36-22 72-26 108-14v400H0z" fill="#d8ed86" opacity=".78"/>
  <g fill="#fff" opacity=".55"><circle cx="52" cy="225" r="5"/><circle cx="94" cy="548" r="3"/><circle cx="548" cy="336" r="5"/><circle cx="518" cy="770" r="3"/><circle cx="61" cy="1041" r="4"/><circle cx="556" cy="1190" r="5"/></g>
</svg>`)

const gardenPicnicOverlay = svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 1800">
  <g stroke="#83b74e" stroke-width="8" stroke-linecap="round" opacity=".9">
    <path d="M34 1800c5-112 31-198 70-287M99 1800c-2-88-26-174-69-251M170 1800c-7-118 20-185 57-260M433 1800c3-124-25-204-72-278M510 1800c-4-96 25-189 65-270M570 1800c-4-83-35-151-75-210"/>
  </g>
  <g fill="#ffcedb" stroke="#fff9f5" stroke-width="3">
    <g transform="translate(63 1530)"><circle cx="0" cy="-18" r="17"/><circle cx="18" cy="0" r="17"/><circle cx="0" cy="18" r="17"/><circle cx="-18" cy="0" r="17"/><circle fill="#ff9fb9" cx="0" cy="0" r="8"/></g>
    <g transform="translate(151 1652) scale(.82)"><circle cx="0" cy="-18" r="17"/><circle cx="18" cy="0" r="17"/><circle cx="0" cy="18" r="17"/><circle cx="-18" cy="0" r="17"/><circle fill="#ff9fb9" cx="0" cy="0" r="8"/></g>
    <g transform="translate(449 1580) scale(1.06)"><circle cx="0" cy="-18" r="17"/><circle cx="18" cy="0" r="17"/><circle cx="0" cy="18" r="17"/><circle cx="-18" cy="0" r="17"/><circle fill="#ff9fb9" cx="0" cy="0" r="8"/></g>
    <g transform="translate(548 1700) scale(.8)"><circle cx="0" cy="-18" r="17"/><circle cx="18" cy="0" r="17"/><circle cx="0" cy="18" r="17"/><circle cx="-18" cy="0" r="17"/><circle fill="#ff9fb9" cx="0" cy="0" r="8"/></g>
  </g>
  <g fill="#fff3a4" opacity=".95"><circle cx="78" cy="1285" r="8"/><circle cx="112" cy="1332" r="5"/><circle cx="491" cy="1302" r="7"/><circle cx="526" cy="1370" r="5"/></g>
  <g fill="#f8b1ca" opacity=".92"><circle cx="33" cy="1460" r="9"/><circle cx="575" cy="1450" r="11"/><circle cx="288" cy="1740" r="7"/></g>
</svg>`)

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
  },
  {
    id: 'garden-picnic', name: 'Garden picnic', description: 'Four family moments over an airy painted garden strip.', rows: 4, columns: 1, requiredSlots: 4, printLabel: '2 × 6 in strip', output: { width: 600, height: 1800, ppi: 300 }, builtIn: true,
    theme: { id: 'garden-picnic', label: 'Garden picnic', paper: '#dbe9e7', ink: '#31543a', accent: '#ef92ae', slotLight: '#edf5e1', slotDark: '#98be7a' },
    background: { kind: 'solid', color: '#dbe9e7', secondaryColor: '#dbe9e7', scale: 8, angle: 0 },
    slots: [
      { id: 'slot-1', x: .055, y: .022, width: .89, height: .192, shape: 'rounded', radius: .105, fit: 'cover', stroke: '#ffffff', strokeWidth: 5, zIndex: 10 },
      { id: 'slot-2', x: .055, y: .255, width: .89, height: .192, shape: 'rounded', radius: .105, fit: 'cover', stroke: '#ffffff', strokeWidth: 5, zIndex: 10 },
      { id: 'slot-3', x: .055, y: .488, width: .89, height: .192, shape: 'rounded', radius: .105, fit: 'cover', stroke: '#ffffff', strokeWidth: 5, zIndex: 10 },
      { id: 'slot-4', x: .055, y: .721, width: .89, height: .192, shape: 'rounded', radius: .105, fit: 'cover', stroke: '#ffffff', strokeWidth: 5, zIndex: 10 }
    ],
    layers: [
      { id: 'garden-background', type: 'image', x: 0, y: 0, width: 1, height: 1, src: gardenPicnicBackground, opacity: 1, zIndex: 0, locked: true },
      { id: 'garden-foreground', type: 'image', x: 0, y: 0, width: 1, height: 1, src: gardenPicnicOverlay, opacity: 1, zIndex: 30, locked: true }
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
    if (typeof layer.src !== 'string' || !/^data:image\/(png|jpeg|svg\+xml);/i.test(layer.src)) throw new Error(`Image layer ${index + 1} must contain an embedded PNG, JPEG, or SVG.`)
    return { ...layer, ...geometry, opacity: Math.max(.05, Math.min(1, finiteOr(layer.opacity, 1))) }
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
