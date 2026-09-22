import { useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type JSX, type PointerEvent as ReactPointerEvent } from 'react'
import { frameThemes, getPhysicalPrintSize, parseFrameImport, type FrameBackgroundKind, type FrameLayer, type FrameSlot, type FrameSlotShape, type FrameStickerKind, type TemplateManifest } from '../templates'
import { StickerIcon } from './StickerIcon'
import { tr, type Language } from '../i18n'
import { shapeBorderRadius, shapeClipPath } from '../lib/frameGeometry'
import { exportFramePack, importFramePack } from '../lib/framePack'

interface FrameStudioProps {
  language: Language
  initialTemplate?: TemplateManifest
  onClose: () => void
  onSave: (template: TemplateManifest) => void
}

type Selection = { kind: 'slot' | 'layer'; id: string } | null
type CanvasInteraction = {
  mode: 'move' | 'resize'
  target: Exclude<Selection, null>
  startX: number
  startY: number
  x: number
  y: number
  width: number
  height: number
}
type CanvasPreset = 'strip' | 'portrait' | 'landscape' | 'square'

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
    layers: [
      { id: `text-${crypto.randomUUID()}`, type: 'text', x: .1, y: .055, width: .8, height: .06, text: 'LUMA BOOTH', color: frameThemes[0].ink, fontSize: 4.5, fontWeight: 800, align: 'center', zIndex: 30 },
      { id: `text-${crypto.randomUUID()}`, type: 'text', x: .1, y: .91, width: .8, height: .04, text: 'A MOMENT, KEPT', color: frameThemes[0].accent, fontSize: 2.5, fontWeight: 700, align: 'center', zIndex: 30 }
    ],
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
  const [drawing, setDrawing] = useState(false)
  const [status, setStatus] = useState('')
  const assetPlacementRef = useRef<'background' | 'overlay'>('overlay')
  const canvasRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const designRef = useRef<HTMLInputElement>(null)
  const interactionRef = useRef<CanvasInteraction | null>(null)
  const drawingLayerRef = useRef<string | null>(null)

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
  const preset = useMemo(() => Object.entries(presetMap).find(([, value]) => value.width === draft.output.width && value.height === draft.output.height)?.[0] ?? 'custom', [draft.output])

  const updateSlot = (id: string, patch: Partial<FrameSlot>) => setDraft(current => ({ ...current, slots: current.slots.map(slot => slot.id === id ? fitItem({ ...slot, ...patch }) : slot) }))
  const updateLayer = (id: string, patch: Partial<FrameLayer>) => setDraft(current => ({ ...current, layers: (current.layers ?? []).map(layer => {
    if (layer.id !== id) return layer
    const next = { ...layer, ...patch } as FrameLayer
    return 'x' in next ? fitItem(next) : next
  }) }))

  const addSlot = () => {
    const slot: FrameSlot = { id: `slot-${crypto.randomUUID()}`, x: .16, y: .18, width: .68, height: .28, shape: 'rounded', radius: .05, fit: 'contain', zIndex: 10 }
    setDraft(current => ({ ...current, slots: [...current.slots, slot], requiredSlots: current.slots.length + 1 }))
    setSelection({ kind: 'slot', id: slot.id })
  }
  const addText = () => {
    const layer: FrameLayer = { id: `text-${crypto.randomUUID()}`, type: 'text', x: .1, y: .06, width: .8, height: .08, text: 'YOUR EVENT', color: draft.theme.ink, fontSize: 5, fontWeight: 800, align: 'center', zIndex: 30 }
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
      const copy = 'x' in source ? fitItem({ ...source, id: `${source.type}-${crypto.randomUUID()}`, x: source.x + .03, y: source.y + .03 }) : { ...source, id: `${source.type}-${crypto.randomUUID()}` }
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

  const pointerPosition = (event: ReactPointerEvent): { x: number; y: number } => {
    const bounds = canvasRef.current!.getBoundingClientRect()
    return { x: Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)), y: Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height)) }
  }
  const startMove = (event: ReactPointerEvent, next: Exclude<Selection, null>, x: number, y: number) => {
    if (drawing) return
    event.stopPropagation()
    setSelection(next)
    const point = pointerPosition(event)
    const item = next?.kind === 'slot' ? draft.slots.find(candidate => candidate.id === next.id) : (draft.layers ?? []).find(candidate => candidate.id === next?.id)
    if (!item || !('width' in item) || item.locked) return
    interactionRef.current = { mode: 'move', target: next, startX: point.x, startY: point.y, x, y, width: item.width, height: item.height }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const startResize = (event: ReactPointerEvent, next: Exclude<Selection, null>, item: { x: number; y: number; width: number; height: number; locked?: boolean }) => {
    if (drawing || item.locked) return
    event.stopPropagation()
    setSelection(next)
    const point = pointerPosition(event)
    interactionRef.current = { mode: 'resize', target: next, startX: point.x, startY: point.y, ...item }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const moveSelected = (event: ReactPointerEvent) => {
    const interaction = interactionRef.current
    if (!interaction) return
    const point = pointerPosition(event)
    const deltaX = point.x - interaction.startX
    const deltaY = point.y - interaction.startY
    const patch = interaction.mode === 'move'
      ? { x: clamp(interaction.x + deltaX, 0, 1 - interaction.width), y: clamp(interaction.y + deltaY, 0, 1 - interaction.height) }
      : { width: clamp(interaction.width + deltaX, .04, 1 - interaction.x), height: clamp(interaction.height + deltaY, .04, 1 - interaction.y) }
    interaction.target.kind === 'slot' ? updateSlot(interaction.target.id, patch) : updateLayer(interaction.target.id, patch)
  }
  const stopMove = () => { interactionRef.current = null; drawingLayerRef.current = null }

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
    if (!['image/png', 'image/jpeg', 'image/svg+xml'].includes(file.type)) return setStatus(tr(language, 'Hãy dùng PNG, JPEG hoặc SVG.', 'Use a PNG, JPEG, or SVG file.'))
    if (file.size > 4_000_000) return setStatus(tr(language, 'Asset phải nhỏ hơn 4 MB để lưu local ổn định.', 'Keep assets under 4 MB for reliable local storage.'))
    const reader = new FileReader()
    reader.onload = () => addLayer({ id: `image-${crypto.randomUUID()}`, type: 'image', x: 0, y: 0, width: 1, height: 1, src: String(reader.result), opacity: 1, zIndex: assetPlacementRef.current === 'background' ? 0 : 30, locked: assetPlacementRef.current === 'background' })
    reader.readAsDataURL(file)
    event.target.value = ''
  }
  const chooseAsset = (placement: 'background' | 'overlay') => { assetPlacementRef.current = placement; designRef.current?.click() }

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
        <label>{tr(language, 'Tên frame', 'Frame name')}<input value={draft.name} maxLength={48} onChange={event => setDraft(current => ({ ...current, name: event.target.value }))} /></label>
        <label>{tr(language, 'Kích thước in', 'Print size')}<select value={preset} onChange={event => event.target.value !== 'custom' && setPreset(event.target.value as CanvasPreset)}>{preset === 'custom' && <option value="custom">{tr(language, 'Kích thước tùy chỉnh', 'Custom size')}</option>}{Object.entries(presetMap).map(([id, item]) => <option value={id} key={id}>{item.label} - {item.width} × {item.height}px</option>)}</select></label>
        <div className="studio-dimensions"><label>{tr(language, 'Rộng (px)', 'Width (px)')}<input type="number" min="300" max="6000" step="10" value={draft.output.width} onChange={event => setDraft(current => ({ ...current, output: { ...current.output, width: Number(event.target.value) }, printLabel: `Custom ${event.target.value} × ${current.output.height}px` }))} /></label><label>{tr(language, 'Cao (px)', 'Height (px)')}<input type="number" min="300" max="6000" step="10" value={draft.output.height} onChange={event => setDraft(current => ({ ...current, output: { ...current.output, height: Number(event.target.value) }, printLabel: `Custom ${current.output.width} × ${event.target.value}px` }))} /></label></div>
        <label>PPI<input type="number" min="72" max="600" step="1" value={draft.output.ppi} onChange={event => setDraft(current => ({ ...current, output: { ...current.output, ppi: clamp(Number(event.target.value), 72, 600) } }))} /><small>{tr(language, 'Dùng 300 PPI cho máy in ảnh tiêu chuẩn.', 'Use 300 PPI for standard photo printing.')}</small></label>
        <div className="studio-tool-group"><strong>{tr(language, 'Thêm vào canvas', 'Add to canvas')}</strong><div className="studio-tool-buttons"><button type="button" onClick={addSlot}>+ {tr(language, 'Ô ảnh', 'Photo')}</button><button type="button" onClick={addText}>+ {tr(language, 'Chữ', 'Text')}</button><button type="button" onClick={addShape}>+ {tr(language, 'Hình', 'Shape')}</button><button type="button" onClick={() => chooseAsset('background')}>+ {tr(language, 'Nền ảnh', 'Background')}</button><button type="button" onClick={() => chooseAsset('overlay')}>+ {tr(language, 'Overlay / logo', 'Overlay / logo')}</button><button className={drawing ? 'active' : ''} type="button" aria-pressed={drawing} onClick={() => setDrawing(value => !value)}>{tr(language, 'Vẽ tự do', 'Draw')}</button></div></div>
        <div className="studio-tool-group"><strong>{tr(language, 'Sticker', 'Stickers')}</strong><div className="studio-sticker-grid">{stickerChoices.map(sticker => <button type="button" key={sticker} aria-label={`${tr(language, 'Thêm sticker', 'Add sticker')} ${sticker}`} title={sticker} onClick={() => addSticker(sticker)}><StickerIcon kind={sticker} color={draft.theme.ink} secondaryColor={draft.theme.accent} stroke={draft.theme.ink} strokeWidth={1.5} /></button>)}</div></div>
        <input ref={designRef} className="visually-hidden" type="file" accept="image/png,image/jpeg,image/svg+xml,.png,.jpg,.jpeg,.svg" onChange={handleDesignAsset} />
        <div className="studio-tool-group"><strong>{tr(language, 'Nền canvas', 'Canvas background')}</strong><label>{tr(language, 'Hoạ tiết', 'Pattern')}<select value={draft.background?.kind ?? 'solid'} onChange={event => setDraft(current => ({ ...current, background: { kind: event.target.value as FrameBackgroundKind, color: current.background?.color ?? current.theme.paper, secondaryColor: current.background?.secondaryColor ?? current.theme.slotLight, scale: current.background?.scale ?? 8, angle: current.background?.angle ?? 45 } }))}><option value="solid">Solid</option><option value="checker">Checker</option><option value="grid">Grid</option><option value="dots">Dots</option><option value="stripes">Stripes</option><option value="gradient">Gradient</option></select></label><div className="studio-colors"><label>{tr(language, 'Màu nền', 'Base')}<input type="color" value={draft.background?.color ?? draft.theme.paper} onChange={event => setDraft(current => ({ ...current, background: { kind: current.background?.kind ?? 'solid', color: event.target.value, secondaryColor: current.background?.secondaryColor ?? current.theme.slotLight, scale: current.background?.scale ?? 8, angle: current.background?.angle ?? 45 } }))} /></label><label>{tr(language, 'Màu phụ', 'Second')}<input type="color" value={draft.background?.secondaryColor ?? draft.theme.slotLight} onChange={event => setDraft(current => ({ ...current, background: { kind: current.background?.kind ?? 'solid', color: current.background?.color ?? current.theme.paper, secondaryColor: event.target.value, scale: current.background?.scale ?? 8, angle: current.background?.angle ?? 45 } }))} /></label></div>{draft.background?.kind !== 'solid' && <label>{tr(language, 'Độ lớn hoạ tiết', 'Pattern scale')}<input type="range" min="2" max="30" step="1" value={draft.background?.scale ?? 8} onChange={event => setDraft(current => ({ ...current, background: { kind: current.background?.kind ?? 'solid', color: current.background?.color ?? current.theme.paper, secondaryColor: current.background?.secondaryColor ?? current.theme.slotLight, scale: Number(event.target.value), angle: current.background?.angle ?? 45 } }))} /></label>}</div>
        <label>{tr(language, 'Theme bắt đầu', 'Theme preset')}<select value={frameThemes.some(theme => theme.id === draft.theme.id) ? draft.theme.id : 'custom'} onChange={event => { const theme = frameThemes.find(item => item.id === event.target.value); if (theme) setDraft(current => ({ ...current, theme: { ...theme } })) }}><option value="custom">Custom</option>{frameThemes.map(theme => <option value={theme.id} key={theme.id}>{theme.label}</option>)}</select></label>
        <div className="studio-colors"><label>{tr(language, 'Nền', 'Paper')}<input type="color" value={draft.theme.paper} onChange={event => setDraft(current => ({ ...current, theme: { ...current.theme, id: 'custom', label: 'Custom', paper: event.target.value } }))} /></label><label>{tr(language, 'Chữ', 'Ink')}<input type="color" value={draft.theme.ink} onChange={event => setDraft(current => ({ ...current, theme: { ...current.theme, id: 'custom', label: 'Custom', ink: event.target.value } }))} /></label><label>{tr(language, 'Màu chính', 'Accent')}<input type="color" value={draft.theme.accent} onChange={event => setDraft(current => ({ ...current, theme: { ...current.theme, id: 'custom', label: 'Custom', accent: event.target.value } }))} /></label><label>{tr(language, 'Ô ảnh sáng', 'Photo light')}<input type="color" value={draft.theme.slotLight} onChange={event => setDraft(current => ({ ...current, theme: { ...current.theme, id: 'custom', label: 'Custom', slotLight: event.target.value } }))} /></label><label>{tr(language, 'Ô ảnh tối', 'Photo dark')}<input type="color" value={draft.theme.slotDark} onChange={event => setDraft(current => ({ ...current, theme: { ...current.theme, id: 'custom', label: 'Custom', slotDark: event.target.value } }))} /></label></div>
      </aside>

      <main className="studio-workspace">
        <div className="studio-size-label"><strong>{getPhysicalPrintSize(draft)}</strong><span>{draft.output.width} × {draft.output.height}px at {draft.output.ppi} PPI</span></div>
        <div className="studio-canvas-wrap">
          <div ref={canvasRef} className={`studio-canvas ${drawing ? 'drawing' : ''}`} style={{ '--studio-ratio': draft.output.width / draft.output.height, aspectRatio: `${draft.output.width}/${draft.output.height}`, background: backgroundCss(draft) } as CSSProperties} onPointerDown={drawStart} onPointerMove={event => drawing ? drawMove(event) : moveSelected(event)} onPointerUp={stopMove} onPointerCancel={stopMove}>
            {draft.slots.map((slot, index) => <button key={slot.id} type="button" className={`studio-canvas-item studio-slot ${selection?.id === slot.id ? 'selected' : ''} shape-${slot.shape ?? 'rectangle'}`} style={{ ...itemStyle(slot), clipPath: shapeClipPath(slot.shape), borderRadius: shapeBorderRadius(slot.shape, slot.radius), display: slot.hidden ? 'none' : undefined, boxShadow: slot.strokeWidth ? `inset 0 0 0 ${slot.strokeWidth}px ${slot.stroke ?? draft.theme.ink}` : undefined }} onPointerDown={event => startMove(event, { kind: 'slot', id: slot.id }, slot.x, slot.y)}><span>{index + 1}</span>{selection?.id === slot.id && !slot.locked && <i className="studio-resize-handle" onPointerDown={event => startResize(event, { kind: 'slot', id: slot.id }, slot)} />}</button>)}
            {(draft.layers ?? []).map(layer => <StudioLayer key={layer.id} layer={layer} selected={selection?.id === layer.id} onPointerDown={event => layer.type !== 'freehand' && startMove(event, { kind: 'layer', id: layer.id }, layer.x, layer.y)} onResize={event => layer.type !== 'freehand' && startResize(event, { kind: 'layer', id: layer.id }, layer)} onSelect={() => setSelection({ kind: 'layer', id: layer.id })} />)}
          </div>
        </div>
      </main>

      <aside className="studio-inspector" aria-label={tr(language, 'Thuộc tính', 'Inspector')}>
        <div className="studio-inspector-title"><strong>{selectedSlot ? tr(language, 'Ô ảnh', 'Photo slot') : selectedLayer ? tr(language, 'Layer', 'Layer') : tr(language, 'Chưa chọn', 'Nothing selected')}</strong>{selectedItem && <button type="button" onClick={removeSelected}>{tr(language, 'Xóa', 'Delete')}</button>}</div>
        {selectedItem && 'x' in selectedItem && <><div className="studio-number-grid"><NumberField label="X" value={selectedItem.x} onChange={value => selection?.kind === 'slot' ? updateSlot(selection.id, { x: value }) : updateLayer(selection!.id, { x: value })} /><NumberField label="Y" value={selectedItem.y} onChange={value => selection?.kind === 'slot' ? updateSlot(selection.id, { y: value }) : updateLayer(selection!.id, { y: value })} /><NumberField label="W" value={selectedItem.width} onChange={value => selection?.kind === 'slot' ? updateSlot(selection.id, { width: value }) : updateLayer(selection!.id, { width: value })} /><NumberField label="H" value={selectedItem.height} onChange={value => selection?.kind === 'slot' ? updateSlot(selection.id, { height: value }) : updateLayer(selection!.id, { height: value })} /></div></>}
        {selectedItem && 'x' in selectedItem && <label>{tr(language, 'Xoay', 'Rotation')}<input type="range" min="-180" max="180" step="1" value={selectedItem.rotation ?? 0} onChange={event => selection?.kind === 'slot' ? updateSlot(selection.id, { rotation: Number(event.target.value) }) : updateLayer(selection!.id, { rotation: Number(event.target.value) })} /></label>}
        {selectedItem && <><div className="studio-layer-order"><button type="button" onClick={() => shiftSelected(-1)}>{tr(language, 'Đưa xuống', 'Send back')}</button><button type="button" onClick={() => shiftSelected(1)}>{tr(language, 'Đưa lên', 'Bring forward')}</button><button type="button" onClick={duplicateSelected}>{tr(language, 'Nhân đôi', 'Duplicate')}</button><button type="button" onClick={() => alignSelected('horizontal')}>{tr(language, 'Căn giữa ngang', 'Center X')}</button><button type="button" onClick={() => alignSelected('vertical')}>{tr(language, 'Căn giữa dọc', 'Center Y')}</button><button type="button" onClick={() => toggleSelectedState('locked')}>{selectedItem.locked ? tr(language, 'Mở khoá', 'Unlock') : tr(language, 'Khoá', 'Lock')}</button><button type="button" onClick={() => toggleSelectedState('hidden')}>{selectedItem.hidden ? tr(language, 'Hiện', 'Show') : tr(language, 'Ẩn', 'Hide')}</button></div></>}
        {selectedSlot && <><label>{tr(language, 'Hình dạng', 'Shape')}<select value={selectedSlot.shape ?? 'rectangle'} onChange={event => updateSlot(selectedSlot.id, { shape: event.target.value as FrameSlotShape })}>{shapeChoices.map(shape => <option key={shape.value} value={shape.value}>{shape.label}</option>)}</select></label><label>{tr(language, 'Cách đặt ảnh', 'Photo fitting')}<select value={selectedSlot.fit ?? 'contain'} onChange={event => updateSlot(selectedSlot.id, { fit: event.target.value as 'cover' | 'contain' })}><option value="contain">{tr(language, 'Giữ toàn bộ ảnh', 'Fit whole photo')}</option><option value="cover">{tr(language, 'Lấp đầy khung (có thể cắt)', 'Fill frame (may crop)')}</option></select></label><label>{tr(language, 'Màu viền ảnh', 'Photo border')}<input type="color" value={selectedSlot.stroke ?? draft.theme.paper} onChange={event => updateSlot(selectedSlot.id, { stroke: event.target.value })} /></label><label>{tr(language, 'Độ dày viền', 'Border width')}<input type="range" min="0" max="20" step="1" value={selectedSlot.strokeWidth ?? 0} onChange={event => updateSlot(selectedSlot.id, { strokeWidth: Number(event.target.value) })} /></label></>}
        {selectedLayer?.type === 'text' && <><label>{tr(language, 'Nội dung', 'Content')}<textarea value={selectedLayer.text} onChange={event => updateLayer(selectedLayer.id, { text: event.target.value })} /></label><label>{tr(language, 'Kiểu chữ', 'Typeface')}<select value={selectedLayer.fontFamily ?? 'sans'} onChange={event => updateLayer(selectedLayer.id, { fontFamily: event.target.value as 'display' | 'sans' | 'mono' | 'serif' })}><option value="display">Display</option><option value="sans">Sans</option><option value="serif">Serif</option><option value="mono">Mono</option></select></label><label>{tr(language, 'Cỡ chữ', 'Text size')}<input type="range" min="1" max="24" step=".5" value={selectedLayer.fontSize} onChange={event => updateLayer(selectedLayer.id, { fontSize: Number(event.target.value) })} /></label><label>{tr(language, 'Khoảng cách chữ', 'Letter spacing')}<input type="range" min="-.08" max=".4" step=".01" value={selectedLayer.letterSpacing ?? 0} onChange={event => updateLayer(selectedLayer.id, { letterSpacing: Number(event.target.value) })} /></label><label className="studio-check"><input type="checkbox" checked={selectedLayer.italic ?? false} onChange={event => updateLayer(selectedLayer.id, { italic: event.target.checked })} />{tr(language, 'Chữ nghiêng', 'Italic')}</label><label>{tr(language, 'Màu chữ', 'Text color')}<input type="color" value={selectedLayer.color} onChange={event => updateLayer(selectedLayer.id, { color: event.target.value })} /></label><label>{tr(language, 'Màu outline', 'Outline color')}<input type="color" value={selectedLayer.stroke ?? draft.theme.paper} onChange={event => updateLayer(selectedLayer.id, { stroke: event.target.value })} /></label><label>{tr(language, 'Độ dày outline', 'Outline width')}<input type="range" min="0" max="5" step=".25" value={selectedLayer.strokeWidth ?? 0} onChange={event => updateLayer(selectedLayer.id, { strokeWidth: Number(event.target.value) })} /></label><label>{tr(language, 'Độ mờ bóng', 'Shadow blur')}<input type="range" min="0" max="20" step="1" value={selectedLayer.shadowBlur ?? 0} onChange={event => updateLayer(selectedLayer.id, { shadowBlur: Number(event.target.value), shadowColor: selectedLayer.shadowColor ?? '#000000' })} /></label></>}
        {selectedLayer?.type === 'shape' && <><label>{tr(language, 'Màu hình', 'Shape color')}<input type="color" value={selectedLayer.fill} onChange={event => updateLayer(selectedLayer.id, { fill: event.target.value })} /></label><label>{tr(language, 'Màu viền', 'Border color')}<input type="color" value={selectedLayer.stroke === 'transparent' ? draft.theme.ink : selectedLayer.stroke} onChange={event => updateLayer(selectedLayer.id, { stroke: event.target.value })} /></label><label>{tr(language, 'Độ dày viền', 'Border width')}<input type="range" min="0" max="12" step="1" value={selectedLayer.strokeWidth} onChange={event => updateLayer(selectedLayer.id, { strokeWidth: Number(event.target.value) })} /></label><label>{tr(language, 'Hình dạng', 'Shape')}<select value={selectedLayer.shape} onChange={event => updateLayer(selectedLayer.id, { shape: event.target.value as FrameSlotShape })}>{shapeChoices.map(shape => <option key={shape.value} value={shape.value}>{shape.label}</option>)}</select></label></>}
        {selectedLayer?.type === 'sticker' && <><label>{tr(language, 'Sticker', 'Sticker')}<select value={selectedLayer.sticker} onChange={event => updateLayer(selectedLayer.id, { sticker: event.target.value as FrameStickerKind })}>{stickerChoices.map(sticker => <option key={sticker} value={sticker}>{sticker}</option>)}</select></label><label>{tr(language, 'Màu sticker', 'Sticker color')}<input type="color" value={selectedLayer.color} onChange={event => updateLayer(selectedLayer.id, { color: event.target.value })} /></label><label>{tr(language, 'Màu bóng', 'Offset color')}<input type="color" value={selectedLayer.secondaryColor} onChange={event => updateLayer(selectedLayer.id, { secondaryColor: event.target.value })} /></label><label>{tr(language, 'Màu viền', 'Outline color')}<input type="color" value={selectedLayer.stroke} onChange={event => updateLayer(selectedLayer.id, { stroke: event.target.value })} /></label></>}
        {selectedLayer?.type === 'image' && <label>{tr(language, 'Độ trong suốt', 'Opacity')}<input type="range" min=".1" max="1" step=".05" value={selectedLayer.opacity} onChange={event => updateLayer(selectedLayer.id, { opacity: Number(event.target.value) })} /></label>}
        {selectedLayer?.type === 'freehand' && <><label>{tr(language, 'Màu nét vẽ', 'Stroke color')}<input type="color" value={selectedLayer.color} onChange={event => updateLayer(selectedLayer.id, { color: event.target.value })} /></label><label>{tr(language, 'Độ dày nét', 'Stroke width')}<input type="range" min="1" max="12" step="1" value={selectedLayer.strokeWidth} onChange={event => updateLayer(selectedLayer.id, { strokeWidth: Number(event.target.value) })} /></label></>}
        {!selectedItem && <p>{tr(language, 'Chọn một ô ảnh hoặc layer trên canvas để chỉnh kích thước và vị trí.', 'Select a photo slot or layer on the canvas to edit its size and position.')}</p>}
        <div className="studio-layer-list"><strong>{tr(language, 'Layers', 'Layers')}</strong>{[...(draft.layers ?? [])].reverse().map(layer => <button className={`${selection?.id === layer.id ? 'active' : ''} ${layer.hidden ? 'muted' : ''}`} type="button" key={layer.id} onClick={() => setSelection({ kind: 'layer', id: layer.id })}>{layer.type}<span>{layer.locked ? 'locked' : layer.hidden ? 'hidden' : layer.id.slice(0, 6)}</span></button>)}{draft.slots.map((slot, index) => <button className={`${selection?.id === slot.id ? 'active' : ''} ${slot.hidden ? 'muted' : ''}`} type="button" key={slot.id} onClick={() => setSelection({ kind: 'slot', id: slot.id })}>{tr(language, `Ảnh ${index + 1}`, `Photo ${index + 1}`)}<span>{slot.locked ? 'locked' : slot.hidden ? 'hidden' : slot.shape ?? 'rectangle'}</span></button>)}</div>
      </aside>
    </div>
    <footer className="frame-studio-status"><span>{status || tr(language, 'PNG, JPEG và SVG được nhúng vào frame. Sau khi thêm vào thư viện, bấm Lưu cài đặt để lưu local.', 'PNG, JPEG, and SVG assets are embedded. Add the frame to your library, then choose Save settings to persist it locally.')}</span></footer>
  </section>
}

function itemStyle(item: { x: number; y: number; width: number; height: number; rotation?: number; zIndex?: number }): CSSProperties {
  return { left: `${item.x * 100}%`, top: `${item.y * 100}%`, width: `${item.width * 100}%`, height: `${item.height * 100}%`, transform: item.rotation ? `rotate(${item.rotation}deg)` : undefined, zIndex: item.zIndex ?? 10 }
}

function StudioLayer({ layer, selected, onPointerDown, onResize, onSelect }: { layer: FrameLayer; selected: boolean; onPointerDown: (event: ReactPointerEvent) => void; onResize: (event: ReactPointerEvent) => void; onSelect: () => void }): JSX.Element {
  if (layer.type === 'freehand') return <svg className={`studio-canvas-item studio-freehand ${selected ? 'selected' : ''}`} viewBox="0 0 100 100" preserveAspectRatio="none" style={{ zIndex: layer.zIndex, display: layer.hidden ? 'none' : undefined }} onPointerDown={event => { event.stopPropagation(); onSelect() }}><polyline points={layer.points.map(point => `${point.x * 100},${point.y * 100}`).join(' ')} fill="none" stroke={layer.color} strokeWidth={layer.strokeWidth} vectorEffect="non-scaling-stroke" strokeLinecap="round" /></svg>
  const style = itemStyle(layer)
  const visibility = layer.hidden ? { display: 'none' } : undefined
  const handle = selected && !layer.locked ? <i className="studio-resize-handle" onPointerDown={onResize} /> : null
  if (layer.type === 'image') return <button type="button" className={`studio-canvas-item studio-image ${selected ? 'selected' : ''}`} style={{ ...style, ...visibility, opacity: layer.opacity }} onPointerDown={onPointerDown}><img src={layer.src} alt="" />{handle}</button>
  if (layer.type === 'text') return <button type="button" className={`studio-canvas-item studio-text ${selected ? 'selected' : ''}`} style={{ ...style, ...visibility, color: layer.color, fontSize: `${layer.fontSize}cqi`, fontWeight: layer.fontWeight, fontFamily: studioFont(layer.fontFamily), fontStyle: layer.italic ? 'italic' : undefined, letterSpacing: `${layer.letterSpacing ?? 0}em`, WebkitTextStroke: layer.strokeWidth ? `${layer.strokeWidth}px ${layer.stroke ?? 'transparent'}` : undefined, textShadow: layer.shadowBlur ? `0 ${layer.shadowBlur / 2}px ${layer.shadowBlur}px ${layer.shadowColor ?? '#00000055'}` : undefined, textAlign: layer.align }} onPointerDown={onPointerDown}>{layer.text}{handle}</button>
  if (layer.type === 'sticker') return <button type="button" className={`studio-canvas-item studio-sticker ${selected ? 'selected' : ''}`} style={{ ...style, ...visibility }} onPointerDown={onPointerDown}><StickerIcon kind={layer.sticker} color={layer.color} secondaryColor={layer.secondaryColor} stroke={layer.stroke} strokeWidth={layer.strokeWidth} />{handle}</button>
  return <button type="button" className={`studio-canvas-item studio-shape shape-${layer.shape} ${selected ? 'selected' : ''}`} style={{ ...style, ...visibility, background: layer.fill, borderColor: layer.stroke, borderWidth: layer.strokeWidth, clipPath: shapeClipPath(layer.shape), borderRadius: shapeBorderRadius(layer.shape) }} onPointerDown={onPointerDown}>{handle}</button>
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }): JSX.Element {
  return <label>{label}<input type="number" min="0" max="1" step=".01" value={Number(value.toFixed(2))} onChange={event => onChange(Math.min(1, Math.max(0, Number(event.target.value))))} /></label>
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum))
}

function fitItem<T extends { x: number; y: number; width: number; height: number }>(item: T): T {
  const width = clamp(item.width, .04, 1)
  const height = clamp(item.height, .04, 1)
  return { ...item, width, height, x: clamp(item.x, 0, 1 - width), y: clamp(item.y, 0, 1 - height) }
}

function studioFont(font?: string): string {
  if (font === 'mono') return 'ui-monospace, SFMono-Regular, Menlo, monospace'
  if (font === 'serif') return 'Georgia, Times New Roman, serif'
  if (font === 'display') return 'var(--font-display)'
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
