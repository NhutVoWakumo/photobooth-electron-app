import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties, type JSX, type PointerEvent } from 'react'
import { tr, type Language } from '../i18n'
import { drawnSlotMask, slotMaskStyle, type MaskPoint } from '../lib/slotMask'
import type { FrameImageLayer, FrameSlot, TemplateManifest } from '../templates'

type Tool = 'select' | 'ellipse' | 'rectangle' | 'pen' | 'brush'
interface Props {
  language: Language
  slot: FrameSlot
  template: TemplateManifest
  onApply: (mask: string, bounds: Pick<FrameSlot, 'x' | 'y' | 'width' | 'height'>) => void
  onArtworkImport: (src: string) => void
  onClose: () => void
}

const tools: Array<{ id: Tool; vi: string; en: string; icon: string }> = [
  { id: 'select', vi: 'Chọn / di chuyển', en: 'Select / move', icon: '↖' },
  { id: 'ellipse', vi: 'Oval', en: 'Oval', icon: '◯' },
  { id: 'rectangle', vi: 'Chữ nhật', en: 'Rectangle', icon: '□' },
  { id: 'pen', vi: 'Bút điểm', en: 'Point pen', icon: '⌁' },
  { id: 'brush', vi: 'Vẽ tay', en: 'Freehand', icon: '✎' }
]

function clamp(value: number): number { return Math.max(0, Math.min(1, value)) }
function polygonPath(points: MaskPoint[]): string { return points.length ? `M ${points.map(point => `${point.x * 1000} ${point.y * 1000}`).join(' L ')} Z` : '' }
function hitPolygon(points: MaskPoint[], point: MaskPoint): boolean {
  let inside = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i], b = points[j]
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}
function geometry(tool: 'ellipse' | 'rectangle', a: MaskPoint, b: MaskPoint): MaskPoint[] {
  const left = Math.min(a.x, b.x), right = Math.max(a.x, b.x), top = Math.min(a.y, b.y), bottom = Math.max(a.y, b.y)
  if (tool === 'rectangle') return [{ x: left, y: top }, { x: right, y: top }, { x: right, y: bottom }, { x: left, y: bottom }]
  return Array.from({ length: 72 }, (_, index) => {
    const angle = index * Math.PI * 2 / 72
    return { x: (left + right) / 2 + Math.cos(angle) * (right - left) / 2, y: (top + bottom) / 2 + Math.sin(angle) * (bottom - top) / 2 }
  })
}

export function SlotMaskEditor({ language, slot, template, onApply, onArtworkImport, onClose }: Props): JSX.Element {
  const [tool, setTool] = useState<Tool>('ellipse')
  const [contours, setContours] = useState<MaskPoint[][]>([])
  const [active, setActive] = useState<MaskPoint[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [referenceOpacity, setReferenceOpacity] = useState(85)
  const [fullFrame, setFullFrame] = useState(false)
  const [error, setError] = useState('')
  const [localArtwork, setLocalArtwork] = useState<string | null>(null)
  const activeRef = useRef<MaskPoint[]>([])
  const boardRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const uploadRef = useRef<HTMLInputElement>(null)
  const interactionRef = useRef<{ pointer: number; start: MaskPoint; original?: MaskPoint[]; index?: number } | null>(null)
  const background = template.layers?.find((layer): layer is FrameImageLayer => layer.type === 'image' && layer.zIndex <= 0)
  const reference = localArtwork ?? background?.src
  const referenceBounds = localArtwork ? { x: 0, y: 0, width: 1, height: 1, fit: 'contain' as const, focusX: 50, focusY: 50 } : background
  const focusedRegion = {
    x: Math.max(0, slot.x - slot.width * .25), y: Math.max(0, slot.y - slot.height * .25),
    width: Math.min(1, slot.x + slot.width * 1.25) - Math.max(0, slot.x - slot.width * .25),
    height: Math.min(1, slot.y + slot.height * 1.25) - Math.max(0, slot.y - slot.height * .25)
  }
  const region = fullFrame ? { x: 0, y: 0, width: 1, height: 1 } : focusedRegion

  useEffect(() => {
    closeRef.current?.focus()
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [onClose])

  const position = (event: PointerEvent<HTMLDivElement>): MaskPoint => {
    const bounds = boardRef.current!.getBoundingClientRect()
    return { x: clamp((event.clientX - bounds.left) / bounds.width), y: clamp((event.clientY - bounds.top) / bounds.height) }
  }
  const pointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const point = position(event)
    setError('')
    if (tool === 'pen') { activeRef.current = [...activeRef.current, point].slice(0, 1000); setActive(activeRef.current); return }
    if (tool === 'select') {
      let index = -1
      for (let candidate = contours.length - 1; candidate >= 0; candidate -= 1) {
        if (hitPolygon(contours[candidate], point)) { index = candidate; break }
      }
      setSelected(index < 0 ? null : index)
      if (index < 0) return
      interactionRef.current = { pointer: event.pointerId, start: point, original: contours[index], index }
    } else {
      interactionRef.current = { pointer: event.pointerId, start: point }
      activeRef.current = [point]
      setActive([point])
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const pointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const interaction = interactionRef.current
    if (!interaction || interaction.pointer !== event.pointerId) return
    const point = position(event)
    if (tool === 'select' && interaction.original && interaction.index !== undefined) {
      const dx = point.x - interaction.start.x, dy = point.y - interaction.start.y
      setContours(current => current.map((contour, index) => index === interaction.index ? interaction.original!.map(node => ({ x: clamp(node.x + dx), y: clamp(node.y + dy) })) : contour))
    } else if (tool === 'ellipse' || tool === 'rectangle') { activeRef.current = geometry(tool, interaction.start, point); setActive(activeRef.current) }
    else if (tool === 'brush' && activeRef.current.length < 1000 && Math.hypot(point.x - activeRef.current.at(-1)!.x, point.y - activeRef.current.at(-1)!.y) >= .004) {
      activeRef.current = [...activeRef.current, point]
      setActive(activeRef.current)
    }
  }
  const pointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const interaction = interactionRef.current
    if (!interaction || interaction.pointer !== event.pointerId) return
    interactionRef.current = null
    if (tool === 'select') return
    const point = position(event)
    const next = tool === 'ellipse' || tool === 'rectangle' ? geometry(tool, interaction.start, point) : activeRef.current
    try {
      drawnSlotMask(next)
      setContours(current => [...current, next])
      setSelected(contours.length)
      activeRef.current = []
      setActive([])
    } catch (cause) { activeRef.current = []; setActive([]); setError(cause instanceof Error ? cause.message : 'Could not create that shape.') }
  }
  const finishPen = () => {
    try {
      const next = activeRef.current
      drawnSlotMask(next)
      setContours(current => [...current, next])
      setSelected(contours.length)
      activeRef.current = []
      setActive([])
      setTool('select')
      setError('')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not close that path.') }
  }
  const scaleSelected = (factor: number) => {
    if (selected === null) return
    setContours(current => current.map((contour, index) => {
      if (index !== selected) return contour
      const cx = contour.reduce((sum, point) => sum + point.x, 0) / contour.length
      const cy = contour.reduce((sum, point) => sum + point.y, 0) / contour.length
      return contour.map(point => ({ x: clamp(cx + (point.x - cx) * factor), y: clamp(cy + (point.y - cy) * factor) }))
    }))
  }
  const importArtwork = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 6_000_000) { setError(tr(language, 'Dùng ảnh PNG/JPEG/WebP dưới 6 MB.', 'Use a PNG/JPEG/WebP image under 6 MB.')); return }
    const reader = new FileReader()
    reader.onload = () => {
      const src = String(reader.result)
      setLocalArtwork(src)
      if (!fullFrame) switchRegion()
      setError('')
    }
    reader.onerror = () => setError(tr(language, 'Không thể đọc ảnh mẫu.', 'Could not read the design image.'))
    reader.readAsDataURL(file)
  }
  const apply = () => {
    try {
      const points = contours.flat()
      const left = Math.min(...points.map(point => point.x)), right = Math.max(...points.map(point => point.x))
      const top = Math.min(...points.map(point => point.y)), bottom = Math.max(...points.map(point => point.y))
      if (right - left < .02 || bottom - top < .02) throw new Error('Draw a larger photo opening.')
      const normalized = contours.map(contour => contour.map(point => ({ x: clamp((point.x - left) / (right - left)), y: clamp((point.y - top) / (bottom - top)) })))
      const bounds = { x: region.x + left * region.width, y: region.y + top * region.height, width: (right - left) * region.width, height: (bottom - top) * region.height }
      const mask = drawnSlotMask(normalized)
      if (localArtwork) onArtworkImport(localArtwork)
      onApply(mask, bounds)
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not use this shape.') }
  }

  const switchRegion = () => {
    const nextRegion = fullFrame ? focusedRegion : { x: 0, y: 0, width: 1, height: 1 }
    if (fullFrame && [...contours.flat(), ...activeRef.current].some(point => point.x < nextRegion.x || point.x > nextRegion.x + nextRegion.width || point.y < nextRegion.y || point.y > nextRegion.y + nextRegion.height)) {
      setError(tr(language, 'Đường vẽ nằm ngoài vùng phóng to. Giữ chế độ xem toàn frame để không mất nét.', 'Some strokes are outside the focused area. Stay on the full frame so nothing is lost.'))
      return
    }
    const convert = (point: MaskPoint): MaskPoint => ({
      x: clamp((region.x + point.x * region.width - nextRegion.x) / nextRegion.width),
      y: clamp((region.y + point.y * region.height - nextRegion.y) / nextRegion.height)
    })
    setContours(current => current.map(contour => contour.map(convert)))
    activeRef.current = activeRef.current.map(convert)
    setActive(activeRef.current)
    interactionRef.current = null
    setError('')
    setFullFrame(value => !value)
  }

  const artworkStyle = reference && referenceBounds ? {
    left: `${(referenceBounds.x - region.x) / region.width * 100}%`, top: `${(referenceBounds.y - region.y) / region.height * 100}%`,
    width: `${referenceBounds.width / region.width * 100}%`, height: `${referenceBounds.height / region.height * 100}%`,
    objectFit: referenceBounds.fit ?? 'cover', objectPosition: `${referenceBounds.focusX ?? 50}% ${referenceBounds.focusY ?? 50}%`, opacity: referenceOpacity / 100
  } as CSSProperties : undefined
  const existingStyle = {
    left: `${(slot.x - region.x) / region.width * 100}%`, top: `${(slot.y - region.y) / region.height * 100}%`,
    width: `${slot.width / region.width * 100}%`, height: `${slot.height / region.height * 100}%`,
    borderRadius: slot.shape === 'custom' ? undefined : '50%', ...slotMaskStyle(slot.shape === 'custom' ? slot.mask : undefined)
  } as CSSProperties
  const boardRatio = region.width * template.output.width / (region.height * template.output.height)
  return <div className="studio-mask-editor-backdrop" role="presentation">
    <div className="studio-mask-editor studio-mask-workbench" role="dialog" aria-modal="true" aria-label={tr(language, 'Thiết kế vùng ảnh', 'Design photo cutout')}>
      <header className="studio-mask-editor-heading"><div><strong>{tr(language, 'Thiết kế vùng ảnh', 'Design photo cutout')}</strong><span>{tr(language, 'Vẽ đè lên ảnh mẫu. Ô ảnh tự căn vị trí và kích thước theo đường bao mới.', 'Trace over the design image. The photo slot follows the new outline automatically.')}</span></div><button ref={closeRef} type="button" onClick={onClose} aria-label={tr(language, 'Đóng bảng vẽ', 'Close shape editor')}>×</button></header>
      <div className="studio-mask-workbench-body">
        <div className="studio-mask-workbench-tools"><strong>{tr(language, 'Công cụ', 'Tools')}</strong>{tools.map(item => <button key={item.id} type="button" className={tool === item.id ? 'active' : ''} aria-pressed={tool === item.id} onClick={() => { setTool(item.id); activeRef.current = []; setActive([]) }}><span aria-hidden="true">{item.icon}</span>{tr(language, item.vi, item.en)}</button>)}<div className="studio-mask-tool-divider" /><button type="button" onClick={switchRegion}>{fullFrame ? tr(language, 'Xem quanh ô ảnh', 'Focus on photo') : tr(language, 'Xem toàn frame', 'Show full frame')}</button><button type="button" onClick={() => uploadRef.current?.click()}>{tr(language, 'Import ảnh mẫu', 'Import design image')}</button><input ref={uploadRef} className="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" onChange={importArtwork} /><label>{tr(language, 'Độ rõ ảnh mẫu', 'Design visibility')}<input type="range" min="20" max="100" step="5" value={referenceOpacity} onChange={event => setReferenceOpacity(Number(event.target.value))} /></label></div>
        <div className="studio-mask-editor-stage"><div ref={boardRef} className="studio-mask-drawing" style={{ aspectRatio: String(boardRatio), '--board-ratio': boardRatio } as CSSProperties} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} role="img" aria-label={tr(language, 'Bảng vẽ trên ảnh mẫu', 'Drawing board over design image')}>{reference && <img className="studio-mask-reference" src={reference} alt="" style={artworkStyle} draggable={false} />}{contours.length === 0 && (slot.shape === 'ellipse' || slot.shape === 'circle' || slot.shape === 'custom') && <div className="studio-mask-existing" style={existingStyle} />}<svg viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true"><path fillRule="evenodd" d={contours.map(polygonPath).join(' ')} /><path className="studio-mask-active" d={polygonPath(active)} />{tool === 'pen' && active.map((point, index) => <circle key={index} cx={point.x * 1000} cy={point.y * 1000} r="9" />)}</svg></div></div>
        <div className="studio-mask-workbench-inspector"><strong>{tr(language, 'Tinh chỉnh', 'Refine')}</strong><p>{reference ? tr(language, 'Ảnh mẫu đang nằm dưới đường vẽ. Vẽ sát mép vùng muốn đặt ảnh, chừa phần hoa văn ở ngoài.', 'The design sits beneath your outline. Trace the photo opening and leave decorative artwork outside.') : tr(language, 'Import ảnh mẫu để căn đường bao theo thiết kế.', 'Import a design image to trace its photo opening.')}</p>{slot.mask && contours.length === 0 && <small>{tr(language, 'Đường bao cũ vẫn còn trên frame; nét mới sẽ thay thế khi bạn bấm Dùng đường bao.', 'The old cutout stays on the frame until you apply a new one.')}</small>}{tool === 'pen' && <><small>{tr(language, `${active.length} điểm — chạm từng góc, rồi khép đường.`, `${active.length} points — tap around the edge, then close.`)}</small><button type="button" disabled={active.length < 3} onClick={finishPen}>{tr(language, 'Khép đường', 'Close path')}</button><button type="button" disabled={active.length === 0} onClick={() => { activeRef.current = activeRef.current.slice(0, -1); setActive(activeRef.current) }}>{tr(language, 'Lùi một điểm', 'Undo point')}</button></>}{selected !== null && contours[selected] && <><small>{tr(language, `Đang chọn vùng ${selected + 1}. Kéo trực tiếp trên bảng để di chuyển.`, `Region ${selected + 1} selected. Drag it on the board to move.`)}</small><div><button type="button" onClick={() => scaleSelected(.96)}>− {tr(language, 'Thu', 'Shrink')}</button><button type="button" onClick={() => scaleSelected(1.04)}>+ {tr(language, 'Nở', 'Grow')}</button></div><button type="button" onClick={() => { setContours(current => current.filter((_, index) => index !== selected)); setSelected(null) }}>{tr(language, 'Xoá vùng này', 'Delete region')}</button></>}{contours.length > 0 && <button type="button" onClick={() => { setContours(current => current.slice(0, -1)); setSelected(null) }}>{tr(language, 'Hoàn tác vùng cuối', 'Undo last region')}</button>}<small>{tr(language, 'Có thể thêm nhiều vùng; vẽ một vùng nằm trong vùng khác để tạo lỗ.', 'You can add multiple regions; draw one inside another to make a hole.')}</small></div>
      </div>
      <footer className="studio-mask-editor-actions"><span role="status">{error || tr(language, `${contours.length} vùng ảnh`, `${contours.length} regions`)}</span><button type="button" onClick={onClose}>{tr(language, 'Huỷ', 'Cancel')}</button><button type="button" disabled={contours.length === 0} onClick={apply}>{tr(language, 'Dùng đường bao', 'Use cutout')}</button></footer>
    </div>
  </div>
}
