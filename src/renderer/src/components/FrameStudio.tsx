import { useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type JSX, type ReactNode, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react'
import { HexColorPicker } from 'react-colorful'
import { framePrintLayout, frameThemes, getPhysicalPrintSize, isTwoUpCompatible, parseFrameImport, type FrameBackgroundKind, type FrameFontAsset, type FrameLayer, type FramePrintLayout, type FrameSlot, type FrameSlotShape, type FrameStickerKind, type TemplateManifest } from '../templates'
import { StickerIcon } from './StickerIcon'
import { FrameArtwork } from './FrameArtwork'
import { SlotMaskEditor } from './SlotMaskEditor'
import { tr, type Language } from '../i18n'
import { shapeBorderRadius, shapeClipPath } from '../lib/frameGeometry'
import { slotMaskStyle, svgToSlotMask } from '../lib/slotMask'
import { exportFramePack, importFramePack } from '../lib/framePack'
import { loadFrameFonts } from '../lib/frameFonts'
import { listStudioAssets, saveStudioAsset, type StudioAsset } from '../lib/studioAssetStore'
import { clampFrameQrPlacement, defaultFrameQrPlacement, type FrameQrPlacement } from '../lib/frameQr'

interface FrameStudioProps {
  language: Language
  initialTemplate?: TemplateManifest
  onClose: () => void
  onSave: (template: TemplateManifest) => void
}

type Selection = { kind: 'slot' | 'layer'; id: string } | null
type CanvasInteraction = {
  mode: 'move' | 'resize' | 'rotate' | 'artwork-pan'
  target: Exclude<Selection, null>
  startX: number
  startY: number
  x: number
  y: number
  width: number
  height: number
  rotation?: number
  centerX?: number
  centerY?: number
  startAngle?: number
  focusX?: number
  focusY?: number
  groupOrigins?: Record<string, { x: number; y: number }>
  preview?: Partial<Record<'x' | 'y' | 'width' | 'height' | 'rotation' | 'focusX' | 'focusY', number>>
}
type CanvasPreset = 'strip' | 'portrait' | 'landscape' | 'square'
type SlotArrangement = 'stack' | 'tiles' | 'split'

const artworkFocusPoints = [
  { x: 0, y: 0, label: 'Top left' }, { x: 50, y: 0, label: 'Top' }, { x: 100, y: 0, label: 'Top right' },
  { x: 0, y: 50, label: 'Left' }, { x: 50, y: 50, label: 'Center' }, { x: 100, y: 50, label: 'Right' },
  { x: 0, y: 100, label: 'Bottom left' }, { x: 50, y: 100, label: 'Bottom' }, { x: 100, y: 100, label: 'Bottom right' }
]

const presetMap: Record<CanvasPreset, { width: number; height: number; label: string; printLabel: string }> = {
  strip: { width: 600, height: 1800, label: '2 × 6 in', printLabel: '2 × 6 in strip' },
  portrait: { width: 1200, height: 1800, label: '4 × 6 in', printLabel: '4 × 6 in postcard' },
  landscape: { width: 1800, height: 1200, label: '6 × 4 in', printLabel: '6 × 4 in postcard' },
  square: { width: 1200, height: 1200, label: '4 × 4 in', printLabel: '4 × 4 in square' }
}
const shapeChoices: Array<{ value: FrameSlotShape; label: string }> = [
  { value: 'rectangle', label: 'Rectangle' }, { value: 'rounded', label: 'Rounded' }, { value: 'circle', label: 'Circle' }, { value: 'ellipse', label: 'Ellipse' }, { value: 'arch', label: 'Arch' }, { value: 'heart', label: 'Heart' }, { value: 'diamond', label: 'Diamond' }, { value: 'star', label: 'Star' }, { value: 'scallop', label: 'Scallop' }, { value: 'blob', label: 'Blob' }, { value: 'ticket', label: 'Ticket' }
]
const stickerChoices: FrameStickerKind[] = ['heart', 'sparkle', 'flower', 'bow', 'smile', 'music', 'cloud', 'bolt', 'cherry', 'star']

function newDocument(): TemplateManifest {
  return {
    id: `custom-${crypto.randomUUID()}`,
    name: 'Untitled frame',
    description: 'Custom frame made in LUMA Frame Studio.',
    rows: 1,
    columns: 1,
    requiredSlots: 1,
    printLabel: presetMap.portrait.printLabel,
    output: { width: presetMap.portrait.width, height: presetMap.portrait.height, ppi: 300 },
    background: { kind: 'solid', color: frameThemes[0].paper, secondaryColor: frameThemes[0].slotLight, scale: 8, angle: 45 },
    slots: [{ id: `slot-${crypto.randomUUID()}`, x: .1, y: .16, width: .8, height: .62, shape: 'rounded', radius: .04, fit: 'contain', zIndex: 10 }],
    // A new frame is a document, not a branded starter template. Designers
    // decide whether it needs a title, caption, logo, or no text at all.
    layers: [],
    theme: { ...frameThemes[0] },
    createdAt: new Date().toISOString()
  }
}

export function FrameStudio({ language, initialTemplate, onClose, onSave }: FrameStudioProps): JSX.Element {
  const initialDraftRef = useRef<TemplateManifest>(initialTemplate ? structuredClone(initialTemplate) : newDocument())
  const [draft, setDraftState] = useState<TemplateManifest>(initialDraftRef.current)
  const draftRef = useRef(draft)
  const historyRef = useRef<TemplateManifest[]>([])
  const futureRef = useRef<TemplateManifest[]>([])
  const historyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [, setHistoryVersion] = useState(0)
  const [selection, setSelection] = useState<Selection>(() => ({ kind: 'slot', id: draft.slots[0].id }))
  const [qrSelected, setQrSelected] = useState(false)
  const qrDragRef = useRef<{ pointerId: number; startX: number; startY: number; placement: FrameQrPlacement; preview: FrameQrPlacement } | null>(null)
  const [drawing, setDrawing] = useState(false)
  const [maskDrawing, setMaskDrawing] = useState(false)
  const [editingTextId, setEditingTextId] = useState<string | null>(null)
  const [assetLibrary, setAssetLibrary] = useState<StudioAsset[]>([])
  const [status, setStatus] = useState('')
  const [zoom, setZoom] = useState(100)
  const [fitCanvasWidth, setFitCanvasWidth] = useState(0)
  const assetPlacementRef = useRef<'background' | 'overlay' | 'sticker'>('overlay')
  const canvasRef = useRef<HTMLDivElement>(null)
  const canvasViewportRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const designRef = useRef<HTMLInputElement>(null)
  const fontRef = useRef<HTMLInputElement>(null)
  const maskRef = useRef<HTMLInputElement>(null)
  const interactionRef = useRef<CanvasInteraction | null>(null)
  const drawingLayerRef = useRef<string | null>(null)

  useEffect(() => { void loadFrameFonts(draft) }, [draft.fontAssets])
  useEffect(() => { setMaskDrawing(false) }, [selection?.id])
  useEffect(() => { void listStudioAssets().then(setAssetLibrary).catch(() => setStatus(tr(language, 'Không thể mở thư viện asset local.', 'Could not open the local asset library.'))) }, [language])
  useEffect(() => {
    const viewport = canvasViewportRef.current
    if (!viewport) return
    const updateFitWidth = () => {
      const ratio = draft.output.width / draft.output.height
      const availableWidth = Math.max(1, viewport.clientWidth - 40)
      const availableHeight = Math.max(1, viewport.clientHeight - 40)
      setFitCanvasWidth(Math.min(availableWidth, Math.min(availableHeight, 768) * ratio))
    }
    updateFitWidth()
    const observer = new ResizeObserver(updateFitWidth)
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [draft.output.height, draft.output.width])

  const setDraft = (update: TemplateManifest | ((current: TemplateManifest) => TemplateManifest)) => {
    const current = draftRef.current
    const next = typeof update === 'function' ? update(current) : update
    if (next === current) return
    if (!historyTimerRef.current) historyRef.current = [...historyRef.current.slice(-49), structuredClone(current)]
    else clearTimeout(historyTimerRef.current)
    historyTimerRef.current = setTimeout(() => { historyTimerRef.current = null }, 280)
    futureRef.current = []
    draftRef.current = next
    setDraftState(next)
    setHistoryVersion(version => version + 1)
  }
  const undo = () => {
    const previous = historyRef.current.pop()
    if (!previous) return
    if (historyTimerRef.current) clearTimeout(historyTimerRef.current)
    historyTimerRef.current = null
    futureRef.current.push(structuredClone(draftRef.current))
    draftRef.current = previous
    setDraftState(previous)
    setSelection(null)
    setHistoryVersion(version => version + 1)
  }
  const redo = () => {
    const next = futureRef.current.pop()
    if (!next) return
    historyRef.current.push(structuredClone(draftRef.current))
    draftRef.current = next
    setDraftState(next)
    setSelection(null)
    setHistoryVersion(version => version + 1)
  }

  const selectedSlot = selection?.kind === 'slot' ? draft.slots.find(item => item.id === selection.id) : undefined
  const selectedLayer = selection?.kind === 'layer' ? (draft.layers ?? []).find(item => item.id === selection.id) : undefined
  const selectedItem = selectedSlot ?? selectedLayer
  const hasBackgroundArtwork = (draft.layers ?? []).some(layer => layer.type === 'image' && layer.zIndex <= 0)
  const lowerPhotoLayers = (draft.layers ?? []).filter(layer => layer.zIndex < 10)
  const upperPhotoLayers = (draft.layers ?? []).filter(layer => layer.zIndex >= 10)
  const preset = useMemo(() => Object.entries(presetMap).find(([, value]) => value.width === draft.output.width && value.height === draft.output.height)?.[0] ?? 'custom', [draft.output])
  const qrPlacement = defaultFrameQrPlacement(draft)
  const printLayout = framePrintLayout(draft)
  const twoUpCompatible = isTwoUpCompatible(draft)
  const updatePrintLayout = (patch: Partial<FramePrintLayout>) => setDraft(current => ({ ...current, printLayout: { ...framePrintLayout(current), ...patch } }))
  const updateQrPlacement = (placement: FrameQrPlacement) => setDraft(current => ({ ...current, qrPlacement: clampFrameQrPlacement(placement, current) }))
  const startQrDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (drawing) return
    event.stopPropagation()
    setSelection(null)
    setQrSelected(true)
    qrDragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, placement: qrPlacement, preview: qrPlacement }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const moveQrDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = qrDragRef.current
    const bounds = canvasRef.current?.getBoundingClientRect()
    if (!drag || drag.pointerId !== event.pointerId || !bounds) return
    const next = clampFrameQrPlacement({ ...drag.placement, x: drag.placement.x + (event.clientX - drag.startX) / bounds.width, y: drag.placement.y + (event.clientY - drag.startY) / bounds.height }, draft)
    drag.preview = next
    event.currentTarget.style.left = `${(next.x - next.size * .09) * 100}%`
    event.currentTarget.style.top = `${(next.y - next.size * draft.output.width / draft.output.height * .09) * 100}%`
  }
  const stopQrDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = qrDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    qrDragRef.current = null
    updateQrPlacement(drag.preview)
  }
  const placeQr = (column: number, row: number) => {
    const height = qrPlacement.size * draft.output.width / draft.output.height
    const quietX = qrPlacement.size * .09
    const quietY = height * .09
    const positionsX = [quietX, (1 - qrPlacement.size) / 2, 1 - qrPlacement.size - quietX]
    const positionsY = [quietY, (1 - height) / 2, 1 - height - quietY]
    updateQrPlacement({ ...qrPlacement, x: positionsX[column], y: positionsY[row] })
    setSelection(null)
    setQrSelected(true)
  }

  const updateSlot = (id: string, patch: Partial<FrameSlot>) => setDraft(current => ({ ...current, slots: current.slots.map(slot => slot.id === id ? fitItem({ ...slot, ...patch }) : slot) }))
  const importSlotMask = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !selectedSlot) return
    if (file.size > 1_000_000) return setStatus(tr(language, 'Shape phải nhỏ hơn 1 MB.', 'Shape must be smaller than 1 MB.'))
    const slotId = selectedSlot.id
    const apply = (mask: string) => {
      updateSlot(slotId, { shape: 'custom', mask, strokeWidth: 0 })
      setMaskDrawing(false)
      setStatus(tr(language, 'Đã import đường bao. Ảnh sẽ được cắt giống nhau khi xem trước và xuất file.', 'Shape imported. Preview and export now use the same photo cutout.'))
    }
    if (/\.svg$/i.test(file.name) || file.type === 'image/svg+xml') {
      void file.text().then(source => apply(svgToSlotMask(source))).catch(error => setStatus(error instanceof Error ? error.message : 'Invalid SVG shape.'))
    } else if (/\.png$/i.test(file.name) || file.type === 'image/png') {
      const reader = new FileReader()
      reader.onload = () => {
        const mask = String(reader.result)
        const image = new Image()
        image.onload = () => {
          const sample = document.createElement('canvas')
          sample.width = sample.height = 64
          const context = sample.getContext('2d')
          if (!context) return setStatus('Could not inspect the PNG shape.')
          context.drawImage(image, 0, 0, 64, 64)
          const pixels = context.getImageData(0, 0, 64, 64).data
          if (!Array.from({ length: 64 * 64 }, (_, index) => pixels[index * 4 + 3]).some(alpha => alpha < 250)) return setStatus(tr(language, 'PNG cần nền trong suốt để cắt ảnh.', 'PNG needs a transparent background to cut out the photo.'))
          apply(mask)
        }
        image.onerror = () => setStatus(tr(language, 'Không đọc được PNG.', 'Could not read the PNG.'))
        image.src = mask
      }
      reader.readAsDataURL(file)
    } else setStatus(tr(language, 'Dùng SVG hoặc PNG nền trong suốt.', 'Use SVG or a transparent PNG.'))
  }
  const updateLayer = (id: string, patch: Partial<FrameLayer>) => setDraft(current => ({ ...current, layers: (current.layers ?? []).map(layer => {
    if (layer.id !== id) return layer
    const next = { ...layer, ...patch } as FrameLayer
    return 'x' in next ? fitItem(next, .015) : next
  }) }))

  const groupSelectedWithNext = () => {
    if (!selection || !selectedItem) return
    const groupId = selectedItem.groupId ?? `group-${crypto.randomUUID()}`
    if (selection.kind === 'slot') {
      const index = draft.slots.findIndex(slot => slot.id === selection.id)
      const sibling = draft.slots[index + 1] ?? draft.slots[index - 1]
      if (!sibling) return setStatus(tr(language, 'Cần ít nhất hai đối tượng để nhóm.', 'Select an object with a sibling to create a group.'))
      setDraft(current => ({ ...current, slots: current.slots.map(slot => slot.id === selection.id || slot.id === sibling.id ? { ...slot, groupId } : slot) }))
    } else {
      const layers = draft.layers ?? []
      const index = layers.findIndex(layer => layer.id === selection.id)
      const sibling = layers[index + 1] ?? layers[index - 1]
      if (!sibling) return setStatus(tr(language, 'Cần ít nhất hai đối tượng để nhóm.', 'Select an object with a sibling to create a group.'))
      setDraft(current => ({ ...current, layers: (current.layers ?? []).map(layer => layer.id === selection.id || layer.id === sibling.id ? { ...layer, groupId } : layer) }))
    }
    setStatus(tr(language, 'Đã nhóm đối tượng với phần tử kế bên. Kéo một phần tử để di chuyển cả nhóm.', 'Grouped with the adjacent object. Drag one member to move the group.'))
  }

  const ungroupSelected = () => {
    if (!selection || !selectedItem?.groupId) return
    const groupId = selectedItem.groupId
    setDraft(current => ({ ...current, slots: current.slots.map(slot => slot.groupId === groupId ? { ...slot, groupId: undefined } : slot), layers: (current.layers ?? []).map(layer => layer.groupId === groupId ? { ...layer, groupId: undefined } : layer) }))
  }

  const addSlot = () => {
    const slot: FrameSlot = { id: `slot-${crypto.randomUUID()}`, x: .16, y: .18, width: .68, height: .28, shape: 'rounded', radius: .05, fit: 'contain', zIndex: 10 }
    setDraft(current => ({ ...current, slots: [...current.slots, slot], requiredSlots: current.slots.length + 1 }))
    setSelection({ kind: 'slot', id: slot.id })
  }
  const addText = () => {
    // Never drop every new line of copy on the document title. It is a useful
    // default for a blank canvas, but a frustrating surprise in real designs.
    const existingTextCount = (draft.layers ?? []).filter(layer => layer.type === 'text').length
    const y = clamp(.13 + existingTextCount * .1, .13, .78)
    const layer: FrameLayer = { id: `text-${crypto.randomUUID()}`, type: 'text', x: .1, y, width: .8, height: .08, text: 'YOUR EVENT', color: draft.theme.ink, fontSize: 5, fontWeight: 800, align: 'center', zIndex: 30 }
    addLayer(layer)
  }
  const addShape = () => {
    const layer: FrameLayer = { id: `shape-${crypto.randomUUID()}`, type: 'shape', x: .1, y: .82, width: .8, height: .08, shape: 'rounded', fill: draft.theme.accent, stroke: 'transparent', strokeWidth: 0, zIndex: 20 }
    addLayer(layer)
  }
  const addSticker = (sticker: FrameStickerKind) => {
    const layer: FrameLayer = { id: `sticker-${crypto.randomUUID()}`, type: 'sticker', x: .7, y: .08, width: .2, height: .1, sticker, color: draft.theme.accent, secondaryColor: '#ffffff', stroke: draft.theme.ink, strokeWidth: 1, rotation: -8, zIndex: 40 }
    addLayer(layer)
  }
  const addLayer = (layer: FrameLayer) => {
    setDraft(current => ({ ...current, layers: [...(current.layers ?? []), layer] }))
    setSelection({ kind: 'layer', id: layer.id })
  }

  const removeSelected = () => {
    if (!selection) return
    if (selection.kind === 'slot') {
      if (draft.slots.length === 1) return setStatus(tr(language, 'Frame phải có ít nhất một ô ảnh.', 'A frame needs at least one photo slot.'))
      setDraft(current => ({ ...current, slots: current.slots.filter(slot => slot.id !== selection.id), requiredSlots: current.slots.length - 1 }))
    } else setDraft(current => ({ ...current, layers: (current.layers ?? []).filter(layer => layer.id !== selection.id) }))
    setSelection(null)
  }

  const duplicateSelected = () => {
    if (!selection || !selectedItem) return
    if (selection.kind === 'slot') {
      const copy = fitItem({ ...structuredClone(selectedSlot!), id: `slot-${crypto.randomUUID()}`, x: selectedSlot!.x + .03, y: selectedSlot!.y + .03 })
      setDraft(current => ({ ...current, slots: [...current.slots, copy], requiredSlots: current.slots.length + 1 }))
      setSelection({ kind: 'slot', id: copy.id })
    } else {
      const source = structuredClone(selectedLayer!)
      const copy = 'x' in source ? fitItem({ ...source, id: `${source.type}-${crypto.randomUUID()}`, x: source.x + .03, y: source.y + .03 }, .015) : { ...source, id: `${source.type}-${crypto.randomUUID()}` }
      setDraft(current => ({ ...current, layers: [...(current.layers ?? []), copy] }))
      setSelection({ kind: 'layer', id: copy.id })
    }
  }
  const alignSelected = (axis: 'horizontal' | 'vertical') => {
    if (!selection || !selectedItem || !('x' in selectedItem)) return
    const patch = axis === 'horizontal' ? { x: (1 - selectedItem.width) / 2 } : { y: (1 - selectedItem.height) / 2 }
    selection.kind === 'slot' ? updateSlot(selection.id, patch) : updateLayer(selection.id, patch)
  }
  const toggleSelectedState = (key: 'hidden' | 'locked') => {
    if (!selection || !selectedItem) return
    const patch = { [key]: !selectedItem[key] }
    selection.kind === 'slot' ? updateSlot(selection.id, patch) : updateLayer(selection.id, patch)
  }

  const shiftSelected = (amount: number) => {
    if (!selection) return
    if (selection.kind === 'slot') updateSlot(selection.id, { zIndex: clamp((selectedSlot?.zIndex ?? 10) + amount, 1, 100) })
    else updateLayer(selection.id, { zIndex: clamp((selectedLayer?.zIndex ?? 20) + amount, 1, 100) })
  }

  const setPreset = (value: CanvasPreset) => {
    const next = presetMap[value]
    setDraft(current => ({ ...current, output: { width: next.width, height: next.height, ppi: 300 }, printLabel: next.printLabel }))
  }

  // A designer should be able to establish a usable composition before they
  // ever need precision controls. Dragging remains the way to art-direct it.
  const arrangeSlots = (arrangement: SlotArrangement) => {
    const count = draft.slots.length
    if (count === 0) return
    const gutter = .035
    const inset = .08
    const usableWidth = 1 - inset * 2
    const usableHeight = 1 - inset * 2
    const slots = draft.slots.map((slot, index) => {
      if (arrangement === 'split' && count === 2) {
        return { ...slot, x: index === 0 ? inset : .515, y: .17, width: .405, height: .66 }
      }
      if (arrangement === 'tiles') {
        const columns = count === 1 ? 1 : 2
        const rows = Math.ceil(count / columns)
        const width = (usableWidth - gutter * (columns - 1)) / columns
        const height = (usableHeight - gutter * (rows - 1)) / rows
        return { ...slot, x: inset + (index % columns) * (width + gutter), y: inset + Math.floor(index / columns) * (height + gutter), width, height }
      }
      const height = (usableHeight - gutter * (count - 1)) / count
      return { ...slot, x: inset, y: inset + index * (height + gutter), width: usableWidth, height }
    })
    setDraft(current => ({ ...current, slots }))
    setStatus(tr(language, 'Đã sắp ô ảnh. Bạn có thể kéo từng ô trực tiếp trên board để tinh chỉnh.', 'Photo slots are arranged. Drag any slot on the board to fine-tune it.'))
  }

  const changeZoom = (amount: number) => setZoom(current => clamp(current + amount, 50, 175))
  const handleCanvasWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (!event.ctrlKey && !event.metaKey) return
    event.preventDefault()
    changeZoom(event.deltaY < 0 ? 10 : -10)
  }

  const pointerPosition = (event: ReactPointerEvent): { x: number; y: number } => {
    const bounds = canvasRef.current!.getBoundingClientRect()
    return { x: Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)), y: Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height)) }
  }
  const startMove = (event: ReactPointerEvent, next: Exclude<Selection, null>, x: number, y: number) => {
    if (drawing) return
    event.stopPropagation()
    setQrSelected(false)
    setSelection(next)
    const point = pointerPosition(event)
    const item = next?.kind === 'slot' ? draft.slots.find(candidate => candidate.id === next.id) : (draft.layers ?? []).find(candidate => candidate.id === next?.id)
    if (!item || !('width' in item)) return
    // Background art is intentionally locked against accidental resize, but it
    // must still be directly art-directable: dragging pans its crop.
    if (next.kind === 'layer' && 'type' in item && item.type === 'image' && (item.zIndex ?? 20) <= 0) {
      interactionRef.current = { mode: 'artwork-pan', target: next, startX: point.x, startY: point.y, x, y, width: item.width, height: item.height, focusX: item.focusX ?? 50, focusY: item.focusY ?? 50 }
    } else {
      if (item.locked) return
      const groupId = item.groupId
      const groupOrigins = groupId ? Object.fromEntries([
        ...draft.slots.filter(slot => slot.groupId === groupId).map(slot => [slot.id, { x: slot.x, y: slot.y }] as const),
        ...(draft.layers ?? []).filter(layer => layer.groupId === groupId && 'x' in layer).map(layer => { const positioned = layer as Extract<FrameLayer, { x: number; y: number }>; return [layer.id, { x: positioned.x, y: positioned.y }] as const })
      ]) : undefined
      interactionRef.current = { mode: 'move', target: next, startX: point.x, startY: point.y, x, y, width: item.width, height: item.height, groupOrigins }
    }
    canvasRef.current?.setPointerCapture(event.pointerId)
  }
  const startResize = (event: ReactPointerEvent, next: Exclude<Selection, null>, item: { x: number; y: number; width: number; height: number; locked?: boolean }) => {
    if (drawing || item.locked) return
    event.stopPropagation()
    setSelection(next)
    const point = pointerPosition(event)
    interactionRef.current = { mode: 'resize', target: next, startX: point.x, startY: point.y, ...item }
    canvasRef.current?.setPointerCapture(event.pointerId)
  }
  const startRotate = (event: ReactPointerEvent, next: Exclude<Selection, null>, item: { x: number; y: number; width: number; height: number; rotation?: number; locked?: boolean }) => {
    if (drawing || item.locked) return
    event.stopPropagation()
    setSelection(next)
    const bounds = canvasRef.current!.getBoundingClientRect()
    const centerX = bounds.left + (item.x + item.width / 2) * bounds.width
    const centerY = bounds.top + (item.y + item.height / 2) * bounds.height
    interactionRef.current = { mode: 'rotate', target: next, startX: 0, startY: 0, x: item.x, y: item.y, width: item.width, height: item.height, rotation: item.rotation ?? 0, centerX, centerY, startAngle: Math.atan2(event.clientY - centerY, event.clientX - centerX) }
    canvasRef.current?.setPointerCapture(event.pointerId)
  }
  const previewItem = (id: string, patch: NonNullable<CanvasInteraction['preview']>) => {
    for (const element of Array.from(canvasRef.current?.querySelectorAll<HTMLElement>('[data-studio-id]') ?? []).filter(node => node.dataset.studioId === id)) {
      if (patch.x !== undefined) element.style.left = `${patch.x * 100}%`
      if (patch.y !== undefined) element.style.top = `${patch.y * 100}%`
      if (patch.width !== undefined) element.style.width = `${patch.width * 100}%`
      if (patch.height !== undefined) element.style.height = `${patch.height * 100}%`
      if (patch.rotation !== undefined) element.style.transform = `rotate(${patch.rotation}deg)`
      if (patch.focusX !== undefined || patch.focusY !== undefined) {
        const image = element.querySelector('img')
        if (image) image.style.objectPosition = `${patch.focusX ?? 50}% ${patch.focusY ?? 50}%`
      }
    }
  }
  const moveSelected = (event: ReactPointerEvent) => {
    const interaction = interactionRef.current
    if (!interaction) return
    if (interaction.mode === 'rotate') {
      const angle = Math.atan2(event.clientY - interaction.centerY!, event.clientX - interaction.centerX!)
      const rotation = Math.round((interaction.rotation ?? 0) + (angle - interaction.startAngle!) * 180 / Math.PI)
      interaction.preview = { rotation }
      previewItem(interaction.target.id, interaction.preview)
      return
    }
    const point = pointerPosition(event)
    const deltaX = point.x - interaction.startX
    const deltaY = point.y - interaction.startY
    if (interaction.mode === 'artwork-pan') {
      interaction.preview = { focusX: clamp((interaction.focusX ?? 50) - deltaX * 180, 0, 100), focusY: clamp((interaction.focusY ?? 50) - deltaY * 180, 0, 100) }
      previewItem(interaction.target.id, interaction.preview)
      return
    }
    const patch = interaction.mode === 'move'
      ? { x: clamp(interaction.x + deltaX, 0, 1 - interaction.width), y: clamp(interaction.y + deltaY, 0, 1 - interaction.height) }
      : { width: clamp(interaction.width + deltaX, interaction.target.kind === 'layer' ? .015 : .04, 1 - interaction.x), height: clamp(interaction.height + deltaY, interaction.target.kind === 'layer' ? .015 : .04, 1 - interaction.y) }
    if (interaction.mode === 'move') {
      const currentItem = interaction.target.kind === 'slot' ? draft.slots.find(slot => slot.id === interaction.target.id) : (draft.layers ?? []).find(layer => layer.id === interaction.target.id)
      const groupId = currentItem?.groupId
      if (groupId) {
        const origins = interaction.groupOrigins ?? {}
        interaction.preview = { x: deltaX, y: deltaY }
        for (const [id, origin] of Object.entries(origins)) previewItem(id, { x: origin.x + deltaX, y: origin.y + deltaY })
        return
      }
    }
    interaction.preview = patch
    previewItem(interaction.target.id, patch)
  }
  const stopMove = () => {
    const interaction = interactionRef.current
    interactionRef.current = null
    drawingLayerRef.current = null
    if (!interaction?.preview) return
    const { target, preview } = interaction
    if (interaction.mode === 'move' && interaction.groupOrigins) {
      const origins = interaction.groupOrigins
      setDraft(current => ({ ...current, slots: current.slots.map(slot => origins[slot.id] ? fitItem({ ...slot, x: origins[slot.id].x + (preview.x ?? 0), y: origins[slot.id].y + (preview.y ?? 0) }) : slot), layers: (current.layers ?? []).map(layer => 'x' in layer && origins[layer.id] ? fitItem({ ...layer, x: origins[layer.id].x + (preview.x ?? 0), y: origins[layer.id].y + (preview.y ?? 0) }, .015) : layer) }))
    } else if (target.kind === 'slot') updateSlot(target.id, preview)
    else updateLayer(target.id, preview)
  }

  const drawStart = (event: ReactPointerEvent) => {
    if (!drawing) return
    const point = pointerPosition(event)
    const layer: FrameLayer = { id: `draw-${crypto.randomUUID()}`, type: 'freehand', points: [point], color: draft.theme.ink, strokeWidth: 3, zIndex: 40 }
    addLayer(layer)
    drawingLayerRef.current = layer.id
    interactionRef.current = { mode: 'move', target: { kind: 'layer', id: layer.id }, startX: point.x, startY: point.y, x: 0, y: 0, width: 1, height: 1 }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const drawMove = (event: ReactPointerEvent) => {
    if (!drawing || !interactionRef.current || !drawingLayerRef.current) return
    const point = pointerPosition(event)
    const layerId = drawingLayerRef.current
    setDraft(current => ({ ...current, layers: (current.layers ?? []).map(layer => layer.id === layerId && layer.type === 'freehand' ? { ...layer, points: [...layer.points, point] } : layer) }))
  }

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (file.name.endsWith('.zip')) {
      void importFramePack(file).then(imported => { setDraft(imported); setSelection({ kind: 'slot', id: imported.slots[0].id }); setStatus(tr(language, 'Đã mở Frame Pack để tiếp tục chỉnh sửa.', 'Frame Pack opened and ready to edit.')) }).catch(error => setStatus(error instanceof Error ? error.message : 'Invalid Frame Pack.'))
      event.target.value = ''
      return
    }
    if (file.type === 'application/json' || file.name.endsWith('.json')) {
      const reader = new FileReader()
      reader.onload = () => {
        try { const imported = parseFrameImport(String(reader.result)); setDraft(imported); setSelection({ kind: 'slot', id: imported.slots[0].id }); setStatus(tr(language, 'Đã mở frame để tiếp tục chỉnh sửa.', 'Frame opened and ready to edit.')) }
        catch (error) { setStatus(error instanceof Error ? error.message : 'Invalid frame file.') }
      }
      reader.readAsText(file)
    }
    event.target.value = ''
  }

  const handleDesignAsset = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(file.type)) return setStatus(tr(language, 'Hãy dùng PNG, JPEG, WebP hoặc SVG.', 'Use a PNG, JPEG, WebP, or SVG file.'))
    if (file.size > 6_000_000) return setStatus(tr(language, 'Asset phải nhỏ hơn 6 MB để lưu local ổn định.', 'Keep assets under 6 MB for reliable local storage.'))
    const reader = new FileReader()
    reader.onload = () => {
      const sticker = assetPlacementRef.current === 'sticker'
      const src = String(reader.result)
      if (assetPlacementRef.current === 'background') {
        const layer: FrameLayer = { id: `background-artwork-${crypto.randomUUID()}`, type: 'image', x: 0, y: 0, width: 1, height: 1, src, opacity: 1, fit: 'cover', focusX: 50, focusY: 50, zIndex: 0, locked: true }
        setDraft(current => ({ ...current, layers: [...(current.layers ?? []).filter(item => item.type !== 'image' || item.zIndex > 0), layer] }))
        setSelection({ kind: 'layer', id: layer.id })
        setStatus(tr(language, 'Đã thay ảnh nền. Ảnh được crop theo khổ in và nằm dưới mọi ô ảnh.', 'Background artwork replaced. It crops to the print size and stays below every photo slot.'))
      } else addLayer({ id: `image-${crypto.randomUUID()}`, type: 'image', x: sticker ? .68 : 0, y: sticker ? .08 : 0, width: sticker ? .22 : 1, height: sticker ? .12 : 1, src, opacity: 1, fit: 'contain', zIndex: 30 })
      if (sticker) {
        const asset: StudioAsset = { id: `sticker-${crypto.randomUUID()}`, kind: 'sticker', name: file.name.replace(/\.[^.]+$/, ''), src, createdAt: new Date().toISOString() }
        void saveStudioAsset(asset).then(() => setAssetLibrary(current => [asset, ...current])).catch(() => setStatus(tr(language, 'Sticker đã thêm vào frame nhưng chưa lưu được vào thư viện.', 'Sticker was added to this frame but could not be saved to the library.')))
      }
    }
    reader.readAsDataURL(file)
    event.target.value = ''
  }
  const chooseAsset = (placement: 'background' | 'overlay') => { assetPlacementRef.current = placement; designRef.current?.click() }
  const useMaskReferenceArtwork = (src: string) => {
    const layer: FrameLayer = { id: `background-artwork-${crypto.randomUUID()}`, type: 'image', x: 0, y: 0, width: 1, height: 1, src, opacity: 1, fit: 'contain', focusX: 50, focusY: 50, zIndex: 0, locked: true }
    setDraft(current => ({ ...current, layers: [...(current.layers ?? []).filter(item => item.type !== 'image' || item.zIndex > 0), layer] }))
    setStatus(tr(language, 'Đã đặt ảnh mẫu làm nền frame. Giờ có thể vẽ ô ảnh đè lên đúng vị trí.', 'Design image added as the frame background. Trace the photo opening over it.'))
  }
  const removeBackgroundArtwork = () => {
    setDraft(current => ({ ...current, layers: (current.layers ?? []).filter(layer => layer.type !== 'image' || layer.zIndex > 0) }))
    setSelection(null)
    setStatus(tr(language, 'Đã gỡ ảnh nền.', 'Background artwork removed.'))
  }
  const addPersonalSticker = () => { assetPlacementRef.current = 'sticker'; designRef.current?.click() }
  const handleFont = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!/\.(woff2?|ttf|otf)$/i.test(file.name)) { setStatus(tr(language, 'Dùng WOFF2, WOFF, TTF hoặc OTF.', 'Use WOFF2, WOFF, TTF, or OTF.')); return }
    if (file.size > 1_000_000) { setStatus(tr(language, 'Font phải nhỏ hơn 1 MB để frame lưu local ổn định.', 'Keep fonts below 1 MB for reliable local frame storage.')); return }
    const reader = new FileReader()
    reader.onload = () => {
      const extension = file.name.split('.').pop()?.toLowerCase() ?? 'woff2'
      const mime = extension === 'ttf' ? 'font/ttf' : extension === 'otf' ? 'font/otf' : extension === 'woff' ? 'font/woff' : 'font/woff2'
      const family = `LUMA Custom ${crypto.randomUUID()}`
      const font: FrameFontAsset = { id: `font-${crypto.randomUUID()}`, name: file.name.replace(/\.[^.]+$/, ''), family, src: String(reader.result).replace(/^data:[^;]+/, `data:${mime}`) }
      setDraft(current => ({ ...current, fontAssets: [...(current.fontAssets ?? []), font] }))
      const asset: StudioAsset = { id: `asset-${font.id}`, kind: 'font', name: font.name, family, src: font.src, createdAt: new Date().toISOString() }
      void saveStudioAsset(asset).then(() => setAssetLibrary(current => [asset, ...current])).catch(() => setStatus(tr(language, 'Font đã thêm vào frame nhưng chưa lưu được vào thư viện.', 'Font was added to this frame but could not be saved to the library.')))
      void new FontFace(family, `url(${font.src})`).load().then(face => { document.fonts.add(face); setStatus(tr(language, `Đã thêm font ${font.name}.`, `${font.name} is ready to use.`)) }).catch(() => setStatus(tr(language, 'Không thể đọc font này.', 'This font could not be loaded.')))
    }
    reader.readAsDataURL(file)
    event.target.value = ''
  }
  const useLibraryAsset = (asset: StudioAsset) => {
    if (asset.kind === 'sticker') {
      const layer: FrameLayer = { id: `image-${crypto.randomUUID()}`, type: 'image', x: .68, y: .08, width: .22, height: .12, src: asset.src, opacity: 1, zIndex: 30 }
      addLayer(layer)
      return
    }
    if (!asset.family) return
    const font: FrameFontAsset = { id: `font-${crypto.randomUUID()}`, name: asset.name, family: asset.family, src: asset.src }
    setDraft(current => ({ ...current, fontAssets: current.fontAssets?.some(item => item.family === font.family) ? current.fontAssets : [...(current.fontAssets ?? []), font] }))
    if (selectedLayer?.type === 'text') updateLayer(selectedLayer.id, { fontFamily: font.family })
  }

  const exportFrame = () => {
    const blob = exportFramePack({ ...draft, requiredSlots: draft.slots.length })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${draft.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'luma-frame'}.luma-frame.zip`
    anchor.click()
    URL.revokeObjectURL(url)
    setStatus(tr(language, 'Đã export Frame Pack có thể import và sửa lại.', 'Editable Frame Pack exported.'))
  }

  const save = () => onSave({ ...draft, requiredSlots: draft.slots.length, rows: 1, columns: draft.slots.length, builtIn: false, createdAt: draft.createdAt ?? new Date().toISOString() })

  return <section className="frame-studio" aria-label={tr(language, 'Xưởng thiết kế frame', 'Frame Studio')}>
    <header className="frame-studio-header">
      <div><button className="text-button" type="button" onClick={onClose}>{tr(language, 'Quay lại thư viện', 'Back to library')}</button><h3>{tr(language, 'Frame Studio', 'Frame Studio')}</h3></div>
      <div className="frame-studio-actions"><button className="studio-history-button" type="button" onClick={undo} disabled={historyRef.current.length === 0}>{tr(language, 'Hoàn tác', 'Undo')}</button><button className="studio-history-button" type="button" onClick={redo} disabled={futureRef.current.length === 0}>{tr(language, 'Làm lại', 'Redo')}</button><button className="secondary-button" type="button" onClick={() => fileRef.current?.click()}>{tr(language, 'Mở file', 'Open file')}</button><button className="secondary-button" type="button" onClick={exportFrame}>{tr(language, 'Export', 'Export')}</button><button className="primary-button" type="button" onClick={save}>{tr(language, 'Lưu vào thư viện', 'Save to library')}</button></div>
      <input ref={fileRef} className="visually-hidden" type="file" accept="application/zip,.zip,.luma-frame.zip,application/json,.json,.luma-frame.json" onChange={handleFile} />
    </header>

    <div className="frame-studio-grid">
      <aside className="studio-tools" aria-label={tr(language, 'Công cụ', 'Tools')}>
        <StudioAccordion title={tr(language, 'Kích thước & in', 'Size & print')} description={`${getPhysicalPrintSize(draft)} · ${draft.output.ppi} PPI`} open={!initialTemplate}>
        <label>{tr(language, 'Tên frame', 'Frame name')}<input value={draft.name} maxLength={48} onChange={event => setDraft(current => ({ ...current, name: event.target.value }))} /></label>
        <label>{tr(language, 'Kích thước in', 'Print size')}<select value={preset} onChange={event => event.target.value !== 'custom' && setPreset(event.target.value as CanvasPreset)}>{preset === 'custom' && <option value="custom">{tr(language, 'Kích thước tùy chỉnh', 'Custom size')}</option>}{Object.entries(presetMap).map(([id, item]) => <option value={id} key={id}>{item.label} - {item.width} × {item.height}px</option>)}</select></label>
        <div className="studio-dimensions"><label>{tr(language, 'Rộng (px)', 'Width (px)')}<input type="number" min="300" max="6000" step="10" value={draft.output.width} onChange={event => setDraft(current => ({ ...current, output: { ...current.output, width: Number(event.target.value) }, printLabel: `Custom ${event.target.value} × ${current.output.height}px` }))} /></label><label>{tr(language, 'Cao (px)', 'Height (px)')}<input type="number" min="300" max="6000" step="10" value={draft.output.height} onChange={event => setDraft(current => ({ ...current, output: { ...current.output, height: Number(event.target.value) }, printLabel: `Custom ${current.output.width} × ${event.target.value}px` }))} /></label></div>
        <label>PPI<input type="number" min="72" max="600" step="1" value={draft.output.ppi} onChange={event => setDraft(current => ({ ...current, output: { ...current.output, ppi: clamp(Number(event.target.value), 72, 600) } }))} /><small>{tr(language, 'Dùng 300 PPI cho máy in ảnh tiêu chuẩn.', 'Use 300 PPI for standard photo printing.')}</small></label>
        <section className="studio-tool-group studio-print-layout" aria-label={tr(language, 'Bố cục bản in', 'Print layout')}>
          <strong>{tr(language, 'Bố cục bản in', 'Print layout')}</strong>
          <small>{tr(language, 'Frame là một thiết kế; bản in quyết định đặt bao nhiêu bản lên một tờ giấy.', 'The frame is one design; the print layout places one or more copies on a sheet.')}</small>
          <div className="studio-print-options" role="group" aria-label={tr(language, 'Chọn số bản trên giấy', 'Choose copies per sheet')}>
            <button type="button" className={printLayout.mode === 'single' ? 'active' : ''} aria-pressed={printLayout.mode === 'single'} onClick={() => updatePrintLayout({ mode: 'single' })}>{tr(language, 'Một bản', 'One copy')}</button>
            <button type="button" disabled={!twoUpCompatible} className={printLayout.mode === 'duplicate-2up' ? 'active' : ''} aria-pressed={printLayout.mode === 'duplicate-2up'} onClick={() => updatePrintLayout({ mode: 'duplicate-2up' })}>{tr(language, 'Hai strip', 'Two strips')}</button>
          </div>
          {twoUpCompatible && <><small>{tr(language, 'Giấy 4 × 6 in. Hai strip 2 × 6 được in cạnh nhau; một bản sẽ nằm giữa tờ giấy.', '4 × 6 in sheet. Two 2 × 6 strips sit side by side; one copy is centered.')}</small>{printLayout.mode === 'duplicate-2up' && <><label>{tr(language, 'Khoảng hở giữa 2 strip', 'Gap between strips')}<input type="range" min="0" max="5" step="0.5" value={printLayout.gutterMm} onChange={event => updatePrintLayout({ gutterMm: Number(event.target.value) })} /><output>{printLayout.gutterMm} mm</output></label><label className="studio-check"><input type="checkbox" checked={printLayout.cutGuide} disabled={printLayout.gutterMm < 1} onChange={event => updatePrintLayout({ cutGuide: event.target.checked })} />{tr(language, 'Đường cắt ở khoảng hở', 'Cut guide in the gap')}</label></>}</>}
          {!twoUpCompatible && <small>{tr(language, 'Bố cục hai strip chỉ dùng cho frame có tỷ lệ 2 × 6.', 'Two-up printing is only available for a 2 × 6 strip frame.')}</small>}
          <div className={`studio-print-sheet ${twoUpCompatible ? 'strip-sheet' : ''} ${printLayout.mode}`} style={{ aspectRatio: twoUpCompatible ? '2 / 3' : `${draft.output.width} / ${draft.output.height}`, '--print-gutter': twoUpCompatible && printLayout.mode === 'duplicate-2up' ? `${printLayout.gutterMm / 101.6 * 100}%` : '0%' } as CSSProperties} aria-label={tr(language, 'Xem trước tờ in', 'Print sheet preview')}>
            {Array.from({ length: printLayout.mode === 'duplicate-2up' ? 2 : 1 }, (_, index) => <FrameArtwork key={index} template={draft} language={language} />)}
            {twoUpCompatible && printLayout.mode === 'duplicate-2up' && printLayout.cutGuide && printLayout.gutterMm >= 1 && <span className="studio-print-cut-guide" aria-hidden="true" />}
          </div>
        </section>
        <div className="studio-tool-group studio-qr-defaults"><strong>{tr(language, 'Vị trí QR mặc định', 'Default QR placement')}</strong><small>{tr(language, 'Chỉ hiện khi phiên bật QR. Lưu cùng frame và tự áp dụng cho mọi lần chụp mới.', 'Only appears when a session has QR on. Saved with this frame and applied to new captures.')}</small><div className="studio-qr-position-grid" role="group" aria-label={tr(language, 'Chọn vị trí QR', 'Choose QR position')}>{[0, 1, 2].flatMap(row => [0, 1, 2].map(column => <button key={`${row}-${column}`} type="button" aria-label={tr(language, `QR hàng ${row + 1}, cột ${column + 1}`, `QR row ${row + 1}, column ${column + 1}`)} onClick={() => placeQr(column, row)}><i /></button>))}</div><label>{tr(language, 'Kích thước QR', 'QR size')}<input type="range" min="8" max="35" step="1" value={Math.round(qrPlacement.size * 100)} onChange={event => updateQrPlacement({ ...qrPlacement, size: Number(event.target.value) / 100 })} /><output>{Math.round(qrPlacement.size * draft.output.width / draft.output.ppi * 25.4)} mm</output></label></div>
        </StudioAccordion>
        <StudioAccordion title={tr(language, 'Thêm vào thiết kế', 'Add to design')} description={tr(language, 'Ảnh, chữ, hình và sticker', 'Photos, text, shapes & stickers')} open>
        <div className="studio-tool-group"><strong>{tr(language, 'Thêm vào canvas', 'Add to canvas')}</strong><div className="studio-tool-buttons"><button type="button" onClick={addSlot}>+ {tr(language, 'Ô ảnh từ booth', 'Photo from booth')}</button><button type="button" onClick={addText}>+ {tr(language, 'Chữ', 'Text')}</button><button type="button" onClick={addShape}>+ {tr(language, 'Hình', 'Shape')}</button><button type="button" onClick={() => chooseAsset('overlay')}>+ {tr(language, 'Ảnh / logo', 'Image / logo')}</button><button className={drawing ? 'active' : ''} type="button" aria-pressed={drawing} onClick={() => setDrawing(value => !value)}>{tr(language, 'Vẽ tự do', 'Draw')}</button></div></div>
        <div className="studio-tool-group"><strong>{tr(language, 'Sticker', 'Stickers')}</strong><div className="studio-sticker-grid">{stickerChoices.map(sticker => <button type="button" key={sticker} aria-label={`${tr(language, 'Thêm sticker', 'Add sticker')} ${sticker}`} title={sticker} onClick={() => addSticker(sticker)}><StickerIcon kind={sticker} color={draft.theme.ink} secondaryColor={draft.theme.accent} stroke={draft.theme.ink} strokeWidth={1.5} /></button>)}</div><button className="studio-upload-button" type="button" onClick={addPersonalSticker}>{tr(language, 'Upload sticker riêng', 'Upload personal sticker')}</button></div>
        </StudioAccordion>
        <StudioAccordion title={tr(language, 'Bố cục ảnh', 'Photo layout')} description={tr(language, `${draft.slots.length} ô ảnh`, `${draft.slots.length} ${draft.slots.length === 1 ? 'photo slot' : 'photo slots'}`)}>
        <div className="studio-tool-group studio-arrange-group"><strong>{tr(language, 'Sắp ô ảnh nhanh', 'Quick photo layout')}</strong><small>{tr(language, 'Chọn bố cục, rồi kéo trực tiếp ô ảnh trên board để căn theo ý bạn. Không cần nhập tọa độ.', 'Pick a layout, then drag photo slots on the board to art-direct it. No coordinates required.')}</small><div className="studio-arrange-buttons"><button type="button" onClick={() => arrangeSlots('stack')}><i className="arrange-stack" /><span>{tr(language, 'Xếp dọc', 'Stack')}</span></button><button type="button" onClick={() => arrangeSlots('tiles')}><i className="arrange-tiles" /><span>{tr(language, 'Ô lưới', 'Tiles')}</span></button><button type="button" disabled={draft.slots.length !== 2} onClick={() => arrangeSlots('split')}><i className="arrange-split" /><span>{tr(language, 'Chia đôi', 'Split')}</span></button></div></div>
        </StudioAccordion>
        <StudioAccordion title={tr(language, 'Ảnh nền & giao diện', 'Artwork & appearance')} description={tr(language, 'Nền, font, màu và thư viện', 'Background, fonts, colors & library')}>
        <div className="studio-tool-group studio-background-artwork"><strong>{tr(language, 'Ảnh nền artwork', 'Background artwork')}</strong><small>{tr(language, 'Một ảnh phủ toàn khổ in, giống layer nền của Penci. Ảnh được crop vừa khung và nằm dưới ảnh khách.', 'One image fills the whole print, like Penci’s background layer. It crops to the canvas and stays behind guest photos.')}</small><div><button className="studio-upload-button" type="button" onClick={() => chooseAsset('background')}>{hasBackgroundArtwork ? tr(language, 'Thay ảnh nền', 'Replace background') : tr(language, 'Upload ảnh nền', 'Upload background')}</button>{hasBackgroundArtwork && <button className="studio-clear-background" type="button" onClick={removeBackgroundArtwork}>{tr(language, 'Gỡ nền', 'Remove')}</button>}</div></div>
        <input ref={designRef} className="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,.png,.jpg,.jpeg,.webp,.svg" onChange={handleDesignAsset} />
        <div className="studio-tool-group"><strong>{tr(language, 'Font của frame', 'Frame fonts')}</strong><button className="studio-upload-button" type="button" onClick={() => fontRef.current?.click()}>{tr(language, 'Upload font', 'Upload font')}</button><small>{tr(language, 'WOFF2 nên dùng nhất; font được nhúng khi export Frame Pack.', 'WOFF2 is recommended; fonts are embedded in Frame Packs.')}</small>{(draft.fontAssets ?? []).map(font => <button key={font.id} className="studio-font-asset" type="button" style={{ fontFamily: `\"${font.family}\", var(--font-body)` }} onClick={() => selectedLayer?.type === 'text' && updateLayer(selectedLayer.id, { fontFamily: font.family })}>{font.name}</button>)}</div>
        <input ref={fontRef} className="visually-hidden" type="file" accept=".woff2,.woff,.ttf,.otf,font/woff2,font/woff,font/ttf,font/otf" onChange={handleFont} />
        <div className="studio-tool-group studio-asset-library"><strong>{tr(language, 'Thư viện cá nhân', 'Your library')}</strong><small>{tr(language, 'Sticker và font đã upload có thể dùng lại cho mọi frame trên máy này.', 'Uploaded stickers and fonts can be reused in every frame on this computer.')}</small>{assetLibrary.length === 0 ? <p>{tr(language, 'Chưa có asset nào. Upload sticker hoặc font để bắt đầu.', 'No assets yet. Upload a sticker or font to start.')}</p> : <div className="studio-library-grid">{assetLibrary.map(asset => <button key={asset.id} type="button" className={`studio-library-item ${asset.kind}`} onClick={() => useLibraryAsset(asset)} title={asset.name}>{asset.kind === 'sticker' ? <img src={asset.src} alt="" /> : <span style={{ fontFamily: `\"${asset.family}\", var(--font-body)` }}>Aa</span>}<em>{asset.name}</em></button>)}</div>}</div>
        <div className="studio-tool-group"><strong>{tr(language, 'Nền canvas', 'Canvas background')}</strong><div className="studio-pattern-picker">{(['solid', 'checker', 'grid', 'dots', 'stripes', 'gradient'] as FrameBackgroundKind[]).map(pattern => <button key={pattern} type="button" className={`${draft.background?.kind === pattern ? 'active' : ''} pattern-${pattern}`} onClick={() => setDraft(current => ({ ...current, background: { kind: pattern, color: current.background?.color ?? current.theme.paper, secondaryColor: current.background?.secondaryColor ?? current.theme.slotLight, scale: current.background?.scale ?? 8, angle: current.background?.angle ?? 45 } }))}><i /><span>{pattern}</span></button>)}</div><label>{tr(language, 'Hoạ tiết', 'Pattern')}<select value={draft.background?.kind ?? 'solid'} onChange={event => setDraft(current => ({ ...current, background: { kind: event.target.value as FrameBackgroundKind, color: current.background?.color ?? current.theme.paper, secondaryColor: current.background?.secondaryColor ?? current.theme.slotLight, scale: current.background?.scale ?? 8, angle: current.background?.angle ?? 45 } }))}><option value="solid">Solid</option><option value="checker">Checker</option><option value="grid">Grid</option><option value="dots">Dots</option><option value="stripes">Stripes</option><option value="gradient">Gradient</option></select></label><div className="studio-colors"><label>{tr(language, 'Màu nền', 'Base')}<input type="color" value={draft.background?.color ?? draft.theme.paper} onChange={event => setDraft(current => ({ ...current, background: { kind: current.background?.kind ?? 'solid', color: event.target.value, secondaryColor: current.background?.secondaryColor ?? current.theme.slotLight, scale: current.background?.scale ?? 8, angle: current.background?.angle ?? 45 } }))} /></label><label>{tr(language, 'Màu phụ', 'Second')}<input type="color" value={draft.background?.secondaryColor ?? draft.theme.slotLight} onChange={event => setDraft(current => ({ ...current, background: { kind: current.background?.kind ?? 'solid', color: current.background?.color ?? current.theme.paper, secondaryColor: event.target.value, scale: current.background?.scale ?? 8, angle: current.background?.angle ?? 45 } }))} /></label></div>{draft.background?.kind !== 'solid' && <label>{tr(language, 'Độ lớn hoạ tiết', 'Pattern scale')}<input type="range" min="2" max="30" step="1" value={draft.background?.scale ?? 8} onChange={event => setDraft(current => ({ ...current, background: { kind: current.background?.kind ?? 'solid', color: current.background?.color ?? current.theme.paper, secondaryColor: current.background?.secondaryColor ?? current.theme.slotLight, scale: Number(event.target.value), angle: current.background?.angle ?? 45 } }))} /></label>}</div>
        <label>{tr(language, 'Theme bắt đầu', 'Theme preset')}<select value={frameThemes.some(theme => theme.id === draft.theme.id) ? draft.theme.id : 'custom'} onChange={event => { const theme = frameThemes.find(item => item.id === event.target.value); if (theme) setDraft(current => ({ ...current, theme: { ...theme } })) }}><option value="custom">Custom</option>{frameThemes.map(theme => <option value={theme.id} key={theme.id}>{theme.label}</option>)}</select></label>
        <div className="studio-colors"><label>{tr(language, 'Nền', 'Paper')}<input type="color" value={draft.theme.paper} onChange={event => setDraft(current => ({ ...current, theme: { ...current.theme, id: 'custom', label: 'Custom', paper: event.target.value } }))} /></label><label>{tr(language, 'Chữ', 'Ink')}<input type="color" value={draft.theme.ink} onChange={event => setDraft(current => ({ ...current, theme: { ...current.theme, id: 'custom', label: 'Custom', ink: event.target.value } }))} /></label><label>{tr(language, 'Màu chính', 'Accent')}<input type="color" value={draft.theme.accent} onChange={event => setDraft(current => ({ ...current, theme: { ...current.theme, id: 'custom', label: 'Custom', accent: event.target.value } }))} /></label><label>{tr(language, 'Ô ảnh sáng', 'Photo light')}<input type="color" value={draft.theme.slotLight} onChange={event => setDraft(current => ({ ...current, theme: { ...current.theme, id: 'custom', label: 'Custom', slotLight: event.target.value } }))} /></label><label>{tr(language, 'Ô ảnh tối', 'Photo dark')}<input type="color" value={draft.theme.slotDark} onChange={event => setDraft(current => ({ ...current, theme: { ...current.theme, id: 'custom', label: 'Custom', slotDark: event.target.value } }))} /></label></div>
        </StudioAccordion>
      </aside>

      <main className="studio-workspace">
        <div className="studio-canvas-toolbar">
          <div className="studio-size-label"><strong>{getPhysicalPrintSize(draft)}</strong><span>{draft.output.width} × {draft.output.height}px at {draft.output.ppi} PPI</span></div>
          <div className="studio-zoom-controls" aria-label={tr(language, 'Điều khiển zoom canvas', 'Canvas zoom controls')}>
            <button type="button" onClick={() => changeZoom(-25)} disabled={zoom <= 50} aria-label={tr(language, 'Thu nhỏ canvas', 'Zoom out canvas')}>−</button>
            <label><span>{tr(language, 'Zoom', 'Zoom')}</span><input type="range" min="50" max="175" step="25" value={zoom} onChange={event => setZoom(Number(event.target.value))} aria-label={tr(language, 'Mức zoom canvas', 'Canvas zoom level')} /></label>
            <output aria-live="polite">{zoom}%</output>
            <button type="button" onClick={() => changeZoom(25)} disabled={zoom >= 175} aria-label={tr(language, 'Phóng to canvas', 'Zoom in canvas')}>+</button>
            <button className="studio-zoom-fit" type="button" onClick={() => setZoom(100)} disabled={zoom === 100}>{tr(language, 'Vừa khung', 'Fit')}</button>
          </div>
        </div>
        <div ref={canvasViewportRef} className="studio-canvas-wrap" onWheel={handleCanvasWheel}>
          <div className="studio-canvas-zoom-stage" style={{ width: fitCanvasWidth ? `${fitCanvasWidth * zoom / 100}px` : undefined, aspectRatio: `${draft.output.width}/${draft.output.height}` }}>
            <div ref={canvasRef} className={`studio-canvas ${drawing ? 'drawing' : ''}`} style={{ '--studio-ratio': draft.output.width / draft.output.height, aspectRatio: `${draft.output.width}/${draft.output.height}`, background: backgroundCss(draft) } as CSSProperties} onPointerDown={drawStart} onPointerMove={event => drawing ? drawMove(event) : moveSelected(event)} onPointerUp={stopMove} onPointerCancel={stopMove}>
              {lowerPhotoLayers.map(layer => <StudioLayer key={layer.id} layer={layer} selected={selection?.id === layer.id} editing={editingTextId === layer.id} onPointerDown={event => layer.type !== 'freehand' && startMove(event, { kind: 'layer', id: layer.id }, layer.x, layer.y)} onResize={event => layer.type !== 'freehand' && startResize(event, { kind: 'layer', id: layer.id }, layer)} onRotate={event => layer.type !== 'freehand' && startRotate(event, { kind: 'layer', id: layer.id }, layer)} onSelect={() => setSelection({ kind: 'layer', id: layer.id })} onEdit={() => layer.type === 'text' && setEditingTextId(layer.id)} onTextChange={text => layer.type === 'text' && updateLayer(layer.id, { text })} onFinishEdit={() => setEditingTextId(null)} />)}
              {draft.slots.map((slot, index) => <button key={slot.id} data-studio-id={slot.id} type="button" className={`studio-canvas-item studio-slot shape-${slot.shape ?? 'rectangle'}`} style={{ ...itemStyle(slot), clipPath: shapeClipPath(slot.shape), borderRadius: shapeBorderRadius(slot.shape, slot.radius), ...slotMaskStyle(slot.shape === 'custom' ? slot.mask : undefined), display: slot.hidden ? 'none' : undefined, boxShadow: slot.strokeWidth ? `inset 0 0 0 ${slot.strokeWidth}px ${slot.stroke ?? draft.theme.ink}` : undefined }} onPointerDown={event => startMove(event, { kind: 'slot', id: slot.id }, slot.x, slot.y)}><span>{index + 1}</span></button>)}
              {upperPhotoLayers.map(layer => <StudioLayer key={layer.id} layer={layer} selected={selection?.id === layer.id} editing={editingTextId === layer.id} onPointerDown={event => layer.type !== 'freehand' && startMove(event, { kind: 'layer', id: layer.id }, layer.x, layer.y)} onResize={event => layer.type !== 'freehand' && startResize(event, { kind: 'layer', id: layer.id }, layer)} onRotate={event => layer.type !== 'freehand' && startRotate(event, { kind: 'layer', id: layer.id }, layer)} onSelect={() => setSelection({ kind: 'layer', id: layer.id })} onEdit={() => layer.type === 'text' && setEditingTextId(layer.id)} onTextChange={text => layer.type === 'text' && updateLayer(layer.id, { text })} onFinishEdit={() => setEditingTextId(null)} />)}
              {selection && selectedItem && 'x' in selectedItem && !selectedItem.hidden && editingTextId !== selectedItem.id && <div data-studio-id={selectedItem.id} className="studio-selection-box" style={itemStyle({ ...selectedItem, zIndex: 999 })} aria-label={tr(language, 'Đối tượng đang chọn', 'Selected object')}>
                {!selectedItem.locked && <><button type="button" className="studio-rotate-handle" aria-label={tr(language, 'Kéo để xoay', 'Drag to rotate')} onPointerDown={event => startRotate(event, selection, selectedItem)} /><button type="button" className="studio-resize-handle" aria-label={tr(language, 'Kéo để đổi kích thước', 'Drag to resize')} onPointerDown={event => startResize(event, selection, selectedItem)} /></>}
                {selectedLayer?.type === 'text' && <button type="button" className="studio-inline-edit" onPointerDown={event => event.stopPropagation()} onClick={() => setEditingTextId(selectedLayer.id)}>{tr(language, 'Sửa chữ', 'Edit text')}</button>}
              </div>}
              <button type="button" className={`studio-qr-marker ${qrSelected ? 'selected' : ''}`} aria-label={tr(language, 'Chọn và kéo QR mặc định', 'Select and drag default QR')} aria-pressed={qrSelected} style={{ left: `${(qrPlacement.x - qrPlacement.size * .09) * 100}%`, top: `${(qrPlacement.y - qrPlacement.size * draft.output.width / draft.output.height * .09) * 100}%`, width: `${qrPlacement.size * 1.18 * 100}%` }} onPointerDown={startQrDrag} onPointerMove={moveQrDrag} onPointerUp={stopQrDrag} onPointerCancel={stopQrDrag}>QR</button>
            </div>
          </div>
        </div>
      </main>

      <aside className="studio-inspector" aria-label={tr(language, 'Thuộc tính', 'Inspector')}>
        <div className="studio-inspector-title"><strong>{qrSelected ? 'QR' : selectedSlot ? tr(language, 'Ô ảnh', 'Photo slot') : selectedLayer ? tr(language, 'Layer', 'Layer') : tr(language, 'Chưa chọn', 'Nothing selected')}</strong>{selectedItem && <button type="button" onClick={removeSelected}>{tr(language, 'Xóa', 'Delete')}</button>}</div>
        {qrSelected && <StudioAccordion title={tr(language, 'Vị trí QR', 'QR position')} description={tr(language, 'Kéo trực tiếp trên board hoặc chỉnh tại đây', 'Drag on the board or adjust here')} open><div className="studio-number-grid"><NumberField label="X" value={qrPlacement.x} onChange={x => updateQrPlacement({ ...qrPlacement, x })} /><NumberField label="Y" value={qrPlacement.y} onChange={y => updateQrPlacement({ ...qrPlacement, y })} /></div><label>{tr(language, 'Kích thước QR', 'QR size')}<input type="range" min="8" max="35" step="1" value={Math.round(qrPlacement.size * 100)} onChange={event => updateQrPlacement({ ...qrPlacement, size: Number(event.target.value) / 100 })} /></label></StudioAccordion>}
        {selectedItem && <StudioAccordion title={tr(language, 'Vị trí & căn chỉnh', 'Position & align')} description={tr(language, 'Kéo trên canvas hoặc nhập giá trị', 'Drag on canvas or enter values')} open>
        {selectedItem && 'x' in selectedItem && <><div className="studio-number-grid"><NumberField label="X" value={selectedItem.x} onChange={value => selection?.kind === 'slot' ? updateSlot(selection.id, { x: value }) : updateLayer(selection!.id, { x: value })} /><NumberField label="Y" value={selectedItem.y} onChange={value => selection?.kind === 'slot' ? updateSlot(selection.id, { y: value }) : updateLayer(selection!.id, { y: value })} /><NumberField label="W" value={selectedItem.width} onChange={value => selection?.kind === 'slot' ? updateSlot(selection.id, { width: value }) : updateLayer(selection!.id, { width: value })} /><NumberField label="H" value={selectedItem.height} onChange={value => selection?.kind === 'slot' ? updateSlot(selection.id, { height: value }) : updateLayer(selection!.id, { height: value })} /></div></>}
        {selectedItem && 'x' in selectedItem && <label>{tr(language, 'Xoay', 'Rotation')}<input type="range" min="-180" max="180" step="1" value={selectedItem.rotation ?? 0} onChange={event => selection?.kind === 'slot' ? updateSlot(selection.id, { rotation: Number(event.target.value) }) : updateLayer(selection!.id, { rotation: Number(event.target.value) })} /></label>}
        {selectedItem && <><div className="studio-layer-order"><button type="button" onClick={() => shiftSelected(-1)}>{tr(language, 'Đưa xuống', 'Send back')}</button><button type="button" onClick={() => shiftSelected(1)}>{tr(language, 'Đưa lên', 'Bring forward')}</button><button type="button" onClick={duplicateSelected}>{tr(language, 'Nhân đôi', 'Duplicate')}</button><button type="button" onClick={() => alignSelected('horizontal')}>{tr(language, 'Căn giữa ngang', 'Center X')}</button><button type="button" onClick={() => alignSelected('vertical')}>{tr(language, 'Căn giữa dọc', 'Center Y')}</button><button type="button" onClick={() => toggleSelectedState('locked')}>{selectedItem.locked ? tr(language, 'Mở khoá', 'Unlock') : tr(language, 'Khoá', 'Lock')}</button><button type="button" onClick={() => toggleSelectedState('hidden')}>{selectedItem.hidden ? tr(language, 'Hiện', 'Show') : tr(language, 'Ẩn', 'Hide')}</button></div><div className="studio-group-actions"><button type="button" onClick={groupSelectedWithNext}>{tr(language, 'Nhóm với phần kế', 'Group with next')}</button>{selectedItem.groupId && <button type="button" onClick={ungroupSelected}>{tr(language, 'Bỏ nhóm', 'Ungroup')}</button>}</div></>}
        </StudioAccordion>}
        {selectedItem && <StudioAccordion title={tr(language, 'Tùy chỉnh đối tượng', 'Object options')} description={selectedSlot ? tr(language, 'Khung ảnh và viền', 'Photo shape and border') : selectedLayer?.type ?? ''} open>
        {selectedSlot && <>
          <label>{tr(language, 'Hình dạng', 'Shape')}<select value={selectedSlot.shape ?? 'rectangle'} onChange={event => updateSlot(selectedSlot.id, { shape: event.target.value as FrameSlotShape, mask: undefined })}>{shapeChoices.map(shape => <option key={shape.value} value={shape.value}>{shape.label}</option>)}{selectedSlot.shape === 'custom' && <option value="custom">{tr(language, 'Đường bao riêng', 'Custom outline')}</option>}</select></label>
          <div className="studio-mask-tools"><strong>{tr(language, 'Đường bao ảnh tự do', 'Freeform photo shape')}</strong><small>{tr(language, 'Mở bảng vẽ để đặt oval, chữ nhật, bút điểm hoặc vẽ tay đè lên ảnh mẫu. Cũng có thể import SVG / PNG trong suốt.', 'Open the tracing workbench for oval, rectangle, point pen, or freehand over the design image. You can also import an SVG / transparent PNG.')}</small><div><button type="button" onClick={() => { setDrawing(false); setMaskDrawing(true) }}>{tr(language, 'Mở bảng vẽ', 'Open workbench')}</button><button type="button" onClick={() => maskRef.current?.click()}>{tr(language, 'Import shape', 'Import shape')}</button></div></div>
          <input ref={maskRef} className="visually-hidden" type="file" accept="image/svg+xml,image/png,.svg,.png" onChange={importSlotMask} />
          {selectedSlot.shape === 'rounded' && <label>{tr(language, 'Bo góc', 'Corner radius')}<input type="range" min="0" max=".5" step=".01" value={selectedSlot.radius ?? .08} onChange={event => updateSlot(selectedSlot.id, { radius: Number(event.target.value) })} /><small>{Math.round((selectedSlot.radius ?? .08) * 100)}%</small></label>}
          <label>{tr(language, 'Cách đặt ảnh', 'Photo fitting')}<select value={selectedSlot.fit ?? 'contain'} onChange={event => updateSlot(selectedSlot.id, { fit: event.target.value as 'cover' | 'contain' })}><option value="contain">{tr(language, 'Giữ toàn bộ ảnh', 'Fit whole photo')}</option><option value="cover">{tr(language, 'Lấp đầy khung (có thể cắt)', 'Fill frame (may crop)')}</option></select></label>
          {selectedSlot.shape !== 'custom' && <><label>{tr(language, 'Màu viền ảnh', 'Photo border')}<input type="color" value={selectedSlot.stroke ?? draft.theme.paper} onChange={event => updateSlot(selectedSlot.id, { stroke: event.target.value })} /></label><label>{tr(language, 'Độ dày viền', 'Border width')}<input type="range" min="0" max="20" step="1" value={selectedSlot.strokeWidth ?? 0} onChange={event => updateSlot(selectedSlot.id, { strokeWidth: Number(event.target.value) })} /></label></>}
        </>}
        {selectedLayer?.type === 'text' && <><button className="studio-edit-text" type="button" onClick={() => setEditingTextId(selectedLayer.id)}>{tr(language, 'Sửa chữ ngay trên board', 'Edit text on board')}</button><div className="studio-text-align" role="group" aria-label={tr(language, 'Căn chữ', 'Text alignment')}>{(['left', 'center', 'right'] as const).map(align => <button key={align} type="button" aria-pressed={selectedLayer.align === align} className={selectedLayer.align === align ? 'active' : ''} onClick={() => updateLayer(selectedLayer.id, { align })}>{tr(language, align === 'left' ? 'Trái' : align === 'center' ? 'Giữa' : 'Phải', align === 'left' ? 'Left' : align === 'center' ? 'Center' : 'Right')}</button>)}</div><label>{tr(language, 'Kiểu chữ', 'Typeface')}<div className="studio-font-picker">{([{ id: 'display', name: 'Display' }, { id: 'sans', name: 'Sans' }, { id: 'serif', name: 'Serif' }, { id: 'script', name: 'Script' }, { id: 'mono', name: 'Mono' }, ...(draft.fontAssets ?? []).map(font => ({ id: font.family, name: font.name }))] as Array<{ id: string; name: string }>).map(font => <button key={font.id} type="button" className={selectedLayer.fontFamily === font.id ? 'active' : ''} style={{ fontFamily: studioFont(font.id) }} onClick={() => updateLayer(selectedLayer.id, { fontFamily: font.id })}>{font.name}</button>)}</div></label><label>{tr(language, 'Cỡ chữ', 'Text size')}<input type="range" min="1" max="24" step=".5" value={selectedLayer.fontSize} onChange={event => updateLayer(selectedLayer.id, { fontSize: Number(event.target.value) })} /></label><label>{tr(language, 'Khoảng cách chữ', 'Letter spacing')}<input type="range" min="-.08" max=".4" step=".01" value={selectedLayer.letterSpacing ?? 0} onChange={event => updateLayer(selectedLayer.id, { letterSpacing: Number(event.target.value) })} /></label><label className="studio-check"><input type="checkbox" checked={selectedLayer.italic ?? false} onChange={event => updateLayer(selectedLayer.id, { italic: event.target.checked })} />{tr(language, 'Chữ nghiêng', 'Italic')}</label><ColorField label={tr(language, 'Màu chữ', 'Text color')} value={selectedLayer.color} onChange={color => updateLayer(selectedLayer.id, { color })} /><ColorField label={tr(language, 'Màu outline', 'Outline color')} value={selectedLayer.stroke ?? draft.theme.paper} onChange={color => updateLayer(selectedLayer.id, { stroke: color })} /><label>{tr(language, 'Độ dày outline', 'Outline width')}<input type="range" min="0" max="5" step=".25" value={selectedLayer.strokeWidth ?? 0} onChange={event => updateLayer(selectedLayer.id, { strokeWidth: Number(event.target.value) })} /></label><label>{tr(language, 'Độ mờ bóng', 'Shadow blur')}<input type="range" min="0" max="20" step="1" value={selectedLayer.shadowBlur ?? 0} onChange={event => updateLayer(selectedLayer.id, { shadowBlur: Number(event.target.value), shadowColor: selectedLayer.shadowColor ?? '#000000' })} /></label></>}
        {selectedLayer?.type === 'shape' && <><label>{tr(language, 'Màu hình', 'Shape color')}<input type="color" value={selectedLayer.fill} onChange={event => updateLayer(selectedLayer.id, { fill: event.target.value })} /></label><label>{tr(language, 'Màu viền', 'Border color')}<input type="color" value={selectedLayer.stroke === 'transparent' ? draft.theme.ink : selectedLayer.stroke} onChange={event => updateLayer(selectedLayer.id, { stroke: event.target.value })} /></label><label>{tr(language, 'Độ dày viền', 'Border width')}<input type="range" min="0" max="12" step="1" value={selectedLayer.strokeWidth} onChange={event => updateLayer(selectedLayer.id, { strokeWidth: Number(event.target.value) })} /></label><label>{tr(language, 'Hình dạng', 'Shape')}<select value={selectedLayer.shape} onChange={event => updateLayer(selectedLayer.id, { shape: event.target.value as FrameSlotShape })}>{shapeChoices.map(shape => <option key={shape.value} value={shape.value}>{shape.label}</option>)}</select></label></>}
        {selectedLayer?.type === 'sticker' && <><label>{tr(language, 'Sticker', 'Sticker')}<select value={selectedLayer.sticker} onChange={event => updateLayer(selectedLayer.id, { sticker: event.target.value as FrameStickerKind })}>{stickerChoices.map(sticker => <option key={sticker} value={sticker}>{sticker}</option>)}</select></label><label>{tr(language, 'Màu sticker', 'Sticker color')}<input type="color" value={selectedLayer.color} onChange={event => updateLayer(selectedLayer.id, { color: event.target.value })} /></label><label>{tr(language, 'Màu bóng', 'Offset color')}<input type="color" value={selectedLayer.secondaryColor} onChange={event => updateLayer(selectedLayer.id, { secondaryColor: event.target.value })} /></label><label>{tr(language, 'Màu viền', 'Outline color')}<input type="color" value={selectedLayer.stroke} onChange={event => updateLayer(selectedLayer.id, { stroke: event.target.value })} /></label></>}
        {selectedLayer?.type === 'image' && <><label>{tr(language, 'Cách đặt artwork', 'Artwork fitting')}<select value={selectedLayer.fit ?? 'contain'} onChange={event => updateLayer(selectedLayer.id, { fit: event.target.value as 'cover' | 'contain' })}><option value="cover">{tr(language, 'Phủ kín khung (crop)', 'Fill canvas (crop)')}</option><option value="contain">{tr(language, 'Giữ toàn bộ ảnh', 'Fit whole artwork')}</option></select></label><div className="studio-artwork-pan"><strong>{tr(language, 'Căn ảnh trực tiếp', 'Direct artwork positioning')}</strong><small>{tr(language, 'Chọn ảnh nền trên board rồi kéo để căn phần trời, cỏ hoặc hoạ tiết. Dùng thanh Zoom để phóng to chi tiết.', 'Select the background on the board and drag to position sky, grass, or artwork. Use Zoom to enlarge details.')}</small><label>{tr(language, 'Ngang', 'Horizontal')}<input type="range" min="0" max="100" value={selectedLayer.focusX ?? 50} onChange={event => updateLayer(selectedLayer.id, { focusX: Number(event.target.value) })} /></label><label>{tr(language, 'Dọc', 'Vertical')}<input type="range" min="0" max="100" value={selectedLayer.focusY ?? 50} onChange={event => updateLayer(selectedLayer.id, { focusY: Number(event.target.value) })} /></label><label>{tr(language, 'Phóng to artwork', 'Artwork zoom')}<input type="range" min="1" max="3" step=".01" value={selectedLayer.artworkScale ?? 1} onChange={event => updateLayer(selectedLayer.id, { artworkScale: Number(event.target.value) })} /></label><button type="button" className="studio-artwork-reset" onClick={() => updateLayer(selectedLayer.id, { focusX: 50, focusY: 50, artworkScale: 1, fit: 'cover' })}>{tr(language, 'Căn lại ảnh nền', 'Reset background fit')}</button></div><div className="studio-artwork-focus"><span>{tr(language, 'Điểm crop nhanh', 'Quick crop focus')}</span><div>{artworkFocusPoints.map(point => { const selected = (selectedLayer.focusX ?? 50) === point.x && (selectedLayer.focusY ?? 50) === point.y; return <button key={`${point.x}-${point.y}`} type="button" className={selected ? 'active' : ''} aria-label={tr(language, `Căn crop: ${point.label}`, `Crop focus: ${point.label}`)} aria-pressed={selected} onClick={() => updateLayer(selectedLayer.id, { focusX: point.x, focusY: point.y })}><i /></button> })}</div></div><label>{tr(language, 'Độ trong suốt', 'Opacity')}<input type="range" min=".1" max="1" step=".05" value={selectedLayer.opacity} onChange={event => updateLayer(selectedLayer.id, { opacity: Number(event.target.value) })} /></label></>}
        {selectedLayer?.type === 'freehand' && <><label>{tr(language, 'Màu nét vẽ', 'Stroke color')}<input type="color" value={selectedLayer.color} onChange={event => updateLayer(selectedLayer.id, { color: event.target.value })} /></label><label>{tr(language, 'Độ dày nét', 'Stroke width')}<input type="range" min="1" max="12" step="1" value={selectedLayer.strokeWidth} onChange={event => updateLayer(selectedLayer.id, { strokeWidth: Number(event.target.value) })} /></label></>}
        </StudioAccordion>}
        {!selectedItem && <p>{tr(language, 'Chọn một ô ảnh hoặc layer trên canvas để chỉnh kích thước và vị trí.', 'Select a photo slot or layer on the canvas to edit its size and position.')}</p>}
        <div className="studio-layer-list"><strong>{tr(language, 'Layers', 'Layers')}</strong><button className={qrSelected ? 'active' : ''} type="button" onClick={() => { setSelection(null); setQrSelected(true) }}>QR<span>{tr(language, 'Mặc định', 'default')}</span></button>{[...(draft.layers ?? [])].reverse().map(layer => <button className={`${selection?.id === layer.id ? 'active' : ''} ${layer.hidden ? 'muted' : ''}`} type="button" key={layer.id} onClick={() => { setQrSelected(false); setSelection({ kind: 'layer', id: layer.id }) }}>{layer.id.startsWith('social-') ? layer.id.slice(7).replaceAll('-', ' ') : layer.type}<span>{layer.groupId ? `group ${layer.groupId.slice(-4)}` : layer.locked ? 'locked' : layer.hidden ? 'hidden' : layer.id.startsWith('social-') ? layer.type : layer.id.slice(0, 6)}</span></button>)}{draft.slots.map((slot, index) => <button className={`${selection?.id === slot.id ? 'active' : ''} ${slot.hidden ? 'muted' : ''}`} type="button" key={slot.id} onClick={() => { setQrSelected(false); setSelection({ kind: 'slot', id: slot.id }) }}>{tr(language, `Ảnh ${index + 1}`, `Photo ${index + 1}`)}<span>{slot.groupId ? `group ${slot.groupId.slice(-4)}` : slot.locked ? 'locked' : slot.hidden ? 'hidden' : slot.shape ?? 'rectangle'}</span></button>)}</div>
      </aside>
    </div>
    {maskDrawing && selectedSlot && <SlotMaskEditor language={language} slot={selectedSlot} template={draft} onClose={() => setMaskDrawing(false)} onArtworkImport={useMaskReferenceArtwork} onApply={(mask, bounds) => { updateSlot(selectedSlot.id, { ...bounds, shape: 'custom', mask, strokeWidth: 0 }); setMaskDrawing(false); setStatus(tr(language, 'Đã căn ô ảnh theo đường bao mới.', 'Photo slot updated to the new cutout.')) }} />}
    <footer className="frame-studio-status"><span>{status || tr(language, 'PNG, JPEG, WebP và SVG được nhúng vào frame. Lưu vào thư viện để giữ lại trên máy.', 'PNG, JPEG, WebP, and SVG assets are embedded. Save to library to keep them on this computer.')}</span></footer>
  </section>
}

function StudioAccordion({ title, description, open = false, children }: { title: string; description?: string; open?: boolean; children: ReactNode }): JSX.Element {
  const [expanded, setExpanded] = useState(open)
  return <details className="studio-accordion" open={expanded} onToggle={event => setExpanded(event.currentTarget.open)}>
    <summary><span><strong>{title}</strong>{description && <small>{description}</small>}</span><i aria-hidden="true" /></summary>
    <div className="studio-accordion-body">{children}</div>
  </details>
}

function itemStyle(item: { x: number; y: number; width: number; height: number; rotation?: number; zIndex?: number }): CSSProperties {
  return { left: `${item.x * 100}%`, top: `${item.y * 100}%`, width: `${item.width * 100}%`, height: `${item.height * 100}%`, transform: item.rotation ? `rotate(${item.rotation}deg)` : undefined, zIndex: item.zIndex ?? 10 }
}

function StudioLayer({ layer, selected, editing, onPointerDown, onResize, onRotate, onSelect, onEdit, onTextChange, onFinishEdit }: { layer: FrameLayer; selected: boolean; editing: boolean; onPointerDown: (event: ReactPointerEvent) => void; onResize: (event: ReactPointerEvent) => void; onRotate: (event: ReactPointerEvent) => void; onSelect: () => void; onEdit: () => void; onTextChange: (text: string) => void; onFinishEdit: () => void }): JSX.Element {
  if (layer.type === 'freehand') return <svg className={`studio-canvas-item studio-freehand ${selected ? 'selected' : ''}`} viewBox="0 0 100 100" preserveAspectRatio="none" style={{ zIndex: layer.zIndex, display: layer.hidden ? 'none' : undefined }} onPointerDown={event => { event.stopPropagation(); onSelect() }}><polyline points={layer.points.map(point => `${point.x * 100},${point.y * 100}`).join(' ')} fill="none" stroke={layer.color} strokeWidth={layer.strokeWidth} vectorEffect="non-scaling-stroke" strokeLinecap="round" /></svg>
  const style = itemStyle(layer)
  const visibility = layer.hidden ? { display: 'none' } : undefined
  void onResize
  void onRotate
  if (layer.type === 'image') return <button data-studio-id={layer.id} type="button" className={`studio-canvas-item studio-image ${layer.zIndex <= 0 ? 'studio-background-image' : ''}`} style={{ ...style, ...visibility, opacity: layer.opacity }} onPointerDown={onPointerDown}><img src={layer.src} alt="" style={{ objectFit: layer.fit ?? 'contain', objectPosition: `${layer.focusX ?? 50}% ${layer.focusY ?? 50}%`, transform: layer.artworkScale && layer.artworkScale !== 1 ? `scale(${layer.artworkScale})` : undefined }} /></button>
  if (layer.type === 'text') {
    const textStyle = { ...style, ...visibility, color: layer.color, fontSize: `${layer.fontSize}cqi`, fontWeight: layer.fontWeight, fontFamily: studioFont(layer.fontFamily), fontStyle: layer.italic ? 'italic' : undefined, letterSpacing: `${layer.letterSpacing ?? 0}em`, WebkitTextStroke: layer.strokeWidth ? `${layer.strokeWidth}px ${layer.stroke ?? 'transparent'}` : undefined, textShadow: layer.shadowBlur ? `0 ${layer.shadowBlur / 2}px ${layer.shadowBlur}px ${layer.shadowColor ?? '#00000055'}` : undefined, textAlign: layer.align } as CSSProperties
    if (editing) return <div data-studio-id={layer.id} className="studio-canvas-item studio-text studio-text-editing" contentEditable suppressContentEditableWarning ref={node => { if (node && document.activeElement !== node) node.focus() }} style={textStyle} onPointerDown={event => event.stopPropagation()} onBlur={event => { onTextChange(event.currentTarget.textContent ?? ''); onFinishEdit() }} onKeyDown={event => { if (event.key === 'Escape' || (event.key === 'Enter' && !event.shiftKey)) { event.preventDefault(); event.currentTarget.blur() } }}>{layer.text}</div>
    return <div data-studio-id={layer.id} role="button" tabIndex={0} className="studio-canvas-item studio-text" style={textStyle} onPointerDown={onPointerDown} onDoubleClick={onEdit} onKeyDown={event => { if (event.key === 'Enter') onEdit() }}>{layer.text}</div>
  }
  if (layer.type === 'sticker') return <button data-studio-id={layer.id} type="button" className="studio-canvas-item studio-sticker" style={{ ...style, ...visibility }} onPointerDown={onPointerDown}><StickerIcon kind={layer.sticker} color={layer.color} secondaryColor={layer.secondaryColor} stroke={layer.stroke} strokeWidth={layer.strokeWidth} /></button>
  return <button data-studio-id={layer.id} type="button" className={`studio-canvas-item studio-shape shape-${layer.shape}`} style={{ ...style, ...visibility, background: layer.fill, borderColor: layer.stroke, borderWidth: layer.strokeWidth, clipPath: shapeClipPath(layer.shape), borderRadius: shapeBorderRadius(layer.shape) }} onPointerDown={onPointerDown} />
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }): JSX.Element {
  const [draftValue, setDraftValue] = useState(() => String(Number(value.toFixed(2))))
  const [editing, setEditing] = useState(false)
  useEffect(() => { if (!editing) setDraftValue(String(Number(value.toFixed(2)))) }, [value, editing])
  const commit = () => {
    setEditing(false)
    const parsed = Number(draftValue.replace(',', '.'))
    if (Number.isFinite(parsed)) onChange(Math.min(1, Math.max(0, parsed)))
    else setDraftValue(String(Number(value.toFixed(2))))
  }
  return <label>{label}<input type="text" inputMode="decimal" value={draftValue} onFocus={() => setEditing(true)} onChange={event => setDraftValue(event.target.value)} onBlur={commit} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { setDraftValue(String(Number(value.toFixed(2)))); event.currentTarget.blur() } }} /></label>
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }): JSX.Element {
  const [open, setOpen] = useState(false)
  return <div className="studio-color-field"><span>{label}</span><button type="button" className="studio-color-trigger" aria-expanded={open} onClick={() => setOpen(current => !current)}><i style={{ background: value }} /><code>{value.toUpperCase()}</code></button>{open && <div className="studio-color-popover"><HexColorPicker color={value} onChange={onChange} /><input aria-label={label} value={value} maxLength={7} onChange={event => /^#[0-9a-fA-F]{0,6}$/.test(event.target.value) && onChange(event.target.value)} /></div>}</div>
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum))
}

function fitItem<T extends { x: number; y: number; width: number; height: number }>(item: T, minimum = .04): T {
  const width = clamp(item.width, minimum, 1)
  const height = clamp(item.height, minimum, 1)
  return { ...item, width, height, x: clamp(item.x, 0, 1 - width), y: clamp(item.y, 0, 1 - height) }
}

function studioFont(font?: string): string {
  if (font === 'mono') return 'ui-monospace, SFMono-Regular, Menlo, monospace'
  if (font === 'serif') return 'Georgia, Times New Roman, serif'
  if (font === 'script') return 'Snell Roundhand, Apple Chancery, Brush Script MT, cursive'
  if (font === 'display') return 'var(--font-display)'
  if (font?.startsWith('LUMA Custom ')) return `"${font}", var(--font-body)`
  return 'var(--font-body)'
}

function backgroundCss(template: TemplateManifest): string {
  const background = template.background
  if (!background || background.kind === 'solid') return background?.color ?? template.theme.paper
  const size = Math.max(4, background.scale)
  if (background.kind === 'checker') return `conic-gradient(${background.color} 25%, ${background.secondaryColor} 0 50%, ${background.color} 0 75%, ${background.secondaryColor} 0) 0 0 / ${size}cqi ${size}cqi`
  if (background.kind === 'grid') return `linear-gradient(${background.secondaryColor} 1px, transparent 1px), linear-gradient(90deg, ${background.secondaryColor} 1px, ${background.color} 1px) 0 0 / ${size}cqi ${size}cqi`
  if (background.kind === 'dots') return `radial-gradient(circle, ${background.secondaryColor} 0 18%, transparent 20%) 0 0 / ${size}cqi ${size}cqi, ${background.color}`
  if (background.kind === 'stripes') return `repeating-linear-gradient(${background.angle}deg, ${background.color} 0 ${size / 2}cqi, ${background.secondaryColor} ${size / 2}cqi ${size}cqi)`
  return `linear-gradient(${background.angle}deg, ${background.color}, ${background.secondaryColor})`
}
