import { useState, type JSX } from 'react'
import { tr, type Language } from '../i18n'
import { renderTemplate } from '../lib/renderTemplate'
import type { TemplateManifest } from '../templates'
import type { BoothSettings, PhotoTransform, SessionFrameSet } from '../types'
import { FrameArtwork } from './FrameArtwork'

interface Props {
  language: Language
  settings: BoothSettings
  template: TemplateManifest
  frame: SessionFrameSet
  assignments: Array<string | null>
  onChange: (frame: SessionFrameSet) => void
  onClose: () => void
  onSaveExit?: () => void
  onDelete?: () => void
}

const DEFAULT_TRANSFORM: PhotoTransform = { x: 0, y: 0, scale: 1 }

export function OutputEditor({ language, settings, template, frame, assignments, onChange, onClose, onSaveExit, onDelete }: Props): JSX.Element {
  const [selectedSlot, setSelectedSlot] = useState(0)
  const [status, setStatus] = useState<'idle' | 'exporting' | 'done' | 'error'>('idle')
  const [outputPath, setOutputPath] = useState('')
  const transforms = Array.from({ length: template.requiredSlots }, (_, index) => frame.slotTransforms?.[index] ?? { x: 0, y: ((frame.slotPositions?.[index] ?? 50) - 50) * 2, scale: 1 })
  const activeTransform = transforms[selectedSlot] ?? DEFAULT_TRANSFORM

  const updateTransform = (slotIndex: number, transform: PhotoTransform) => {
    const next = transforms.map(item => ({ ...item }))
    next[slotIndex] = transform
    onChange({ ...frame, slotTransforms: next, updatedAt: new Date().toISOString() })
  }
  const resetCrop = () => updateTransform(selectedSlot, DEFAULT_TRANSFORM)
  const exportImage = async () => {
    if (!window.booth) { setStatus('error'); return }
    setStatus('exporting')
    try {
      const dataUrl = await renderTemplate({ eventName: settings.eventName, photos: assignments.filter((photo): photo is string => Boolean(photo)), template, outputJpegQuality: settings.outputJpegQuality, photoTransforms: transforms })
      const result = await window.booth.exportImage({ eventName: settings.eventName, dataUrl })
      setOutputPath(result.outputPath)
      setStatus('done')
    } catch {
      setStatus('error')
    }
  }

  return <div className="quick-print-preview" role="dialog" aria-modal="true" aria-labelledby="output-editor-title">
    <header><div><p className="eyebrow">{tr(language, 'Bản ảnh cuối', 'Final image')}</p><h1 id="output-editor-title">{tr(language, 'Căn ảnh rồi xuất.', 'Adjust, then export.')}</h1></div><button onClick={onClose} aria-label={tr(language, 'Đóng', 'Close')}>×</button></header>
    <div className="quick-print-canvas">
      <FrameArtwork template={template} photos={assignments} photoTransforms={transforms} activeSlot={selectedSlot} onSlotClick={setSelectedSlot} onPhotoTransform={updateTransform} language={language} />
      <p className="crop-touch-hint">{tr(language, 'Chạm một ô, rồi kéo ảnh trực tiếp để căn crop.', 'Tap a slot, then drag the photo to adjust its crop.')}</p>
    </div>
    <aside className="quick-print-controls">
      <div className="crop-control-heading"><span>{tr(language, `Ảnh ${selectedSlot + 1}`, `Photo ${selectedSlot + 1}`)}</span><strong>{tr(language, 'Kéo để căn · trượt để zoom', 'Drag to position · slide to zoom')}</strong></div>
      <label className="zoom-control"><span>{tr(language, 'Thu phóng', 'Zoom')}</span><output>{Math.round(activeTransform.scale * 100)}%</output><input type="range" min="1" max="2.5" step="0.01" value={activeTransform.scale} onChange={event => updateTransform(selectedSlot, { ...activeTransform, scale: Number(event.target.value) })} /></label>
      <button className="crop-reset" onClick={resetCrop}>{tr(language, 'Đặt lại crop', 'Reset crop')}</button>
      <div className="output-primary-actions"><button className="quick-export-primary" disabled={status === 'exporting'} onClick={() => void exportImage()}>{status === 'exporting' ? tr(language, 'Đang xuất…', 'Exporting…') : tr(language, 'Xuất ảnh', 'Export image')}</button><button className="quick-print-primary" onClick={() => window.print()}>{tr(language, 'In ngay', 'Print now')}</button></div>
      {status === 'done' && <div className="export-success" role="status"><strong>{tr(language, 'Đã lưu và copy vào clipboard', 'Saved and copied to clipboard')}</strong><span>{outputPath}</span></div>}
      {status === 'error' && <p className="export-error" role="alert">{tr(language, 'Không thể xuất ảnh. Hãy mở bằng ứng dụng desktop rồi thử lại.', 'Could not export. Open the desktop app and try again.')}</p>}
      <div className="output-secondary-actions">{onSaveExit && <button onClick={onSaveExit}>{tr(language, 'Lưu & thoát', 'Save & exit')}</button>}<button onClick={onClose}>{tr(language, 'Tiếp tục chỉnh', 'Keep editing')}</button>{onDelete && <button className="quick-delete" onClick={onDelete}>{tr(language, 'Xóa frame', 'Delete frame')}</button>}</div>
    </aside>
  </div>
}
