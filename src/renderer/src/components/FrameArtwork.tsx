import { useEffect, useRef, type CSSProperties, type JSX, type PointerEvent } from 'react'
import { getTemplateCopy, type FrameBackground, type FrameLayer, type FrameSlot, type TemplateManifest } from '../templates'
import { StickerIcon } from './StickerIcon'
import { tr, type Language } from '../i18n'
import { shapeBorderRadius, shapeClipPath } from '../lib/frameGeometry'
import type { PhotoTransform } from '../types'
import { loadFrameFonts } from '../lib/frameFonts'

interface FrameArtworkProps {
  template: TemplateManifest
  photos?: Array<string | null>
  activeSlot?: number
  onSlotClick?: (slotIndex: number) => void
  selected?: boolean
  label?: string
  language?: Language
  photoPositions?: number[]
  photoTransforms?: PhotoTransform[]
  onPhotoTransform?: (slotIndex: number, transform: PhotoTransform) => void
}

export function FrameArtwork({ template, photos = [], activeSlot, onSlotClick, selected = false, label, language = 'vi', photoPositions = [], photoTransforms = [], onPhotoTransform }: FrameArtworkProps): JSX.Element {
  const dragRef = useRef<{ slotIndex: number; pointerId: number; x: number; y: number; transform: PhotoTransform } | null>(null)
  useEffect(() => { void loadFrameFonts(template) }, [template])
  const getTransform = (index: number): PhotoTransform => photoTransforms[index] ?? { x: 0, y: ((photoPositions[index] ?? 50) - 50) * 2, scale: 1 }
  const pointerDown = (event: PointerEvent<HTMLElement>, index: number) => {
    if (!onPhotoTransform || !photos[index]) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { slotIndex: index, pointerId: event.pointerId, x: event.clientX, y: event.clientY, transform: getTransform(index) }
  }
  const pointerMove = (event: PointerEvent<HTMLElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId || !onPhotoTransform) return
    const rect = event.currentTarget.getBoundingClientRect()
    onPhotoTransform(drag.slotIndex, { ...drag.transform, x: Math.max(-100, Math.min(100, drag.transform.x - (event.clientX - drag.x) / rect.width * 200)), y: Math.max(-100, Math.min(100, drag.transform.y - (event.clientY - drag.y) / rect.height * 200)) })
  }
  const pointerUp = (event: PointerEvent<HTMLElement>) => { if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null }
  const themeStyle = {
    aspectRatio: `${template.output.width} / ${template.output.height}`,
    '--frame-ratio': template.output.width / template.output.height,
    '--frame-paper': template.theme.paper,
    '--frame-ink': template.theme.ink,
    '--frame-accent': template.theme.accent,
    '--frame-slot-light': template.theme.slotLight,
    '--frame-slot-dark': template.theme.slotDark,
    background: backgroundCss(template.background, template.theme.paper)
  } as CSSProperties
  // The canvas has one reliable stacking contract: artwork below the photo
  // plane, then guest photos, then decorations above them. This means an
  // imported background can never cover the photographs just because its DOM
  // node happens to be rendered later.
  const lowerLayers = (template.layers ?? []).filter(layer => layer.zIndex < 10)
  const upperLayers = (template.layers ?? []).filter(layer => layer.zIndex >= 10)
  return (
    <div className={`frame-artwork ${selected ? 'selected' : ''}`} aria-label={label ?? `${tr(language, 'Xem trước khung', 'Frame preview')}: ${getTemplateCopy(language, template).name}`} role="img" style={themeStyle}>
      {lowerLayers.map(layer => <ArtworkLayer key={layer.id} layer={layer} />)}
      <div className="frame-slots">
        {template.slots.map((slot, index) => {
          const transform = getTransform(index)
          const content = <>{photos[index] ? <img alt={tr(language, `Ảnh đã chọn cho ô ${index + 1}`, `Selected photo for slot ${index + 1}`)} draggable={false} src={photos[index]!} style={{ objectFit: 'cover', objectPosition: `${(transform.x + 100) / 2}% ${(transform.y + 100) / 2}%`, transform: `scale(${transform.scale})` }} /> : <i>{index + 1}</i>}</>
          const className = `frame-slot ${activeSlot === index ? 'active' : ''} ${photos[index] ? 'filled' : ''}`
          // Slots are stored in normalized coordinates for the complete print canvas.
          // Keeping previews on that same canvas prevents landscape and mosaic layouts
          // from being stretched into a fixed, portrait-only middle area.
          const slotStyle = { left: `${slot.x * 100}%`, top: `${slot.y * 100}%`, width: `${slot.width * 100}%`, height: `${slot.height * 100}%`, clipPath: shapeClipPath(slot.shape), borderRadius: shapeBorderRadius(slot.shape, slot.radius), transform: slot.rotation ? `rotate(${slot.rotation}deg)` : undefined, zIndex: slot.zIndex ?? 10, boxShadow: slot.strokeWidth ? `inset 0 0 0 ${slot.strokeWidth}px ${slot.stroke ?? template.theme.ink}` : undefined, display: slot.hidden ? 'none' : undefined }
          const pointerProps = onPhotoTransform ? { onPointerDown: (event: PointerEvent<HTMLElement>) => pointerDown(event, index), onPointerMove: pointerMove, onPointerUp: pointerUp, onPointerCancel: pointerUp } : {}
          return onSlotClick ? <button aria-label={tr(language, `Thay ảnh trong ô ${index + 1}`, `Replace photo in slot ${index + 1}`)} className={className} key={slot.id} style={slotStyle} onClick={() => onSlotClick(index)} {...pointerProps}>{content}</button> : <span className={className} key={slot.id} style={slotStyle} {...pointerProps}>{content}</span>
        })}
      </div>
      {upperLayers.map(layer => <ArtworkLayer key={layer.id} layer={layer} />)}
      {(template.layers?.length ?? 0) === 0 && <><span className="frame-topline">LUMA BOOTH</span><span className="frame-footer">A MOMENT, KEPT</span></>}
    </div>
  )
}

function ArtworkLayer({ layer }: { layer: FrameLayer }): JSX.Element | null {
  if (layer.hidden) return null
  if (layer.type === 'freehand') {
    const points = layer.points.map(point => `${point.x * 100},${point.y * 100}`).join(' ')
    return <svg className="frame-layer frame-drawing-layer" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ zIndex: layer.zIndex }} aria-hidden="true"><polyline points={points} fill="none" stroke={layer.color} strokeWidth={layer.strokeWidth} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" /></svg>
  }
  const style = { left: `${layer.x * 100}%`, top: `${layer.y * 100}%`, width: `${layer.width * 100}%`, height: `${layer.height * 100}%`, transform: layer.rotation ? `rotate(${layer.rotation}deg)` : undefined, zIndex: layer.zIndex } as CSSProperties
  if (layer.type === 'image') {
    const transforms = [layer.rotation ? `rotate(${layer.rotation}deg)` : '', layer.artworkScale && layer.artworkScale !== 1 ? `scale(${layer.artworkScale})` : ''].filter(Boolean).join(' ')
    return <img className="frame-layer frame-image-layer" src={layer.src} alt="" style={{ ...style, transform: transforms || undefined, transformOrigin: 'center', opacity: layer.opacity, objectFit: layer.fit ?? 'contain', objectPosition: `${layer.focusX ?? 50}% ${layer.focusY ?? 50}%` }} />
  }
  if (layer.type === 'text') return <span className="frame-layer frame-text-layer" style={{ ...style, color: layer.color, fontSize: `${layer.fontSize}cqi`, fontWeight: layer.fontWeight, fontFamily: fontFamily(layer.fontFamily), fontStyle: layer.italic ? 'italic' : undefined, letterSpacing: `${layer.letterSpacing ?? 0}em`, textShadow: layer.shadowBlur ? `0 ${layer.shadowBlur / 2}px ${layer.shadowBlur}px ${layer.shadowColor ?? '#00000055'}` : undefined, WebkitTextStroke: layer.strokeWidth ? `${layer.strokeWidth}px ${layer.stroke ?? 'transparent'}` : undefined, textAlign: layer.align }}>{layer.text}</span>
  if (layer.type === 'sticker') return <span className="frame-layer frame-sticker-layer" style={style}><StickerIcon kind={layer.sticker} color={layer.color} secondaryColor={layer.secondaryColor} stroke={layer.stroke} strokeWidth={layer.strokeWidth} /></span>
  const shape = { id: layer.id, x: 0, y: 0, width: 1, height: 1, shape: layer.shape } as FrameSlot
  return <span className={`frame-layer frame-shape-layer shape-${layer.shape}`} style={{ ...style, background: layer.fill, border: `${layer.strokeWidth}px solid ${layer.stroke}`, clipPath: shapeClipPath(shape.shape), borderRadius: shapeBorderRadius(shape.shape, shape.radius) }} />
}

function fontFamily(font?: string): string {
  if (font === 'mono') return 'ui-monospace, SFMono-Regular, Menlo, monospace'
  if (font === 'serif') return 'Georgia, Times New Roman, serif'
  if (font === 'script') return 'Snell Roundhand, Apple Chancery, Brush Script MT, cursive'
  if (font === 'display') return 'var(--font-display)'
  if (font?.startsWith('LUMA Custom ')) return `"${font}", var(--font-body)`
  return 'var(--font-body)'
}

function backgroundCss(background: FrameBackground | undefined, fallback: string): string {
  if (!background || background.kind === 'solid') return background?.color ?? fallback
  const size = Math.max(4, background.scale)
  if (background.kind === 'checker') return `conic-gradient(${background.color} 25%, ${background.secondaryColor} 0 50%, ${background.color} 0 75%, ${background.secondaryColor} 0) 0 0 / ${size}cqi ${size}cqi`
  if (background.kind === 'grid') return `linear-gradient(${background.secondaryColor} 1px, transparent 1px), linear-gradient(90deg, ${background.secondaryColor} 1px, ${background.color} 1px) 0 0 / ${size}cqi ${size}cqi`
  if (background.kind === 'dots') return `radial-gradient(circle, ${background.secondaryColor} 0 18%, transparent 20%) 0 0 / ${size}cqi ${size}cqi, ${background.color}`
  if (background.kind === 'stripes') return `repeating-linear-gradient(${background.angle}deg, ${background.color} 0 ${size / 2}cqi, ${background.secondaryColor} ${size / 2}cqi ${size}cqi)`
  return `linear-gradient(${background.angle}deg, ${background.color}, ${background.secondaryColor})`
}
