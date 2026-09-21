import { useMemo, useState, type DragEvent, type JSX } from 'react'
import type { Language } from '../i18n'
import { tr } from '../i18n'
import type { TemplateManifest } from '../templates'
import type { BoothSettings, SessionFrameSet } from '../types'
import { FrameArtwork } from './FrameArtwork'
import { OutputEditor } from './OutputEditor'

export function FrameSetEditor({ language, settings, sessionName, frame, template, onBack, onChange, onCaptureSlot }: { language: Language; settings: BoothSettings; sessionName: string; frame: SessionFrameSet; template: TemplateManifest; onBack: () => void; onChange: (frame: SessionFrameSet) => void; onCaptureSlot: (slotIndex: number) => void }): JSX.Element {
  const [activeSlot, setActiveSlot] = useState(0)
  const [previewPhotoId, setPreviewPhotoId] = useState<string | null>(null)
  const [showOutput, setShowOutput] = useState(false)
  const [assignmentMessage, setAssignmentMessage] = useState('')
  const assignments = useMemo(() => frame.assignments.map(id => frame.photos.find(photo => photo.id === id)?.dataUrl ?? null), [frame])
  const activePhotoId = frame.assignments[activeSlot]
  const activePhoto = frame.photos.find(photo => photo.id === activePhotoId)

  const update = (changes: Partial<SessionFrameSet>) => onChange({ ...frame, ...changes, updatedAt: new Date().toISOString() })
  const assignPhoto = (slotIndex: number, photoId: string) => {
    const photo = frame.photos.find(item => item.id === photoId)
    const slot = template.slots[slotIndex]
    if (!photo || !slot) return
    const targetRatio = (slot.width * template.output.width) / (slot.height * template.output.height)
    if (Math.abs(photo.slotAspectRatio - targetRatio) / targetRatio > .01) {
      setAssignmentMessage(tr(language, `Ảnh này có tỷ lệ khác ô ${slotIndex + 1}. Hãy chụp riêng cho ô này để không bị cắt.`, `This photo has a different ratio from slot ${slotIndex + 1}. Capture this slot separately to avoid cropping.`))
      return
    }
    const next = frame.assignments.map(id => id === photoId ? null : id)
    next[slotIndex] = photoId
    setAssignmentMessage('')
    update({ assignments: next })
  }
  const removePhoto = (photoId: string) => update({ photos: frame.photos.filter(photo => photo.id !== photoId), assignments: frame.assignments.map(id => id === photoId ? null : id) })
  const movePhoto = (event: DragEvent, slotIndex: number) => { event.preventDefault(); const photoId = event.dataTransfer.getData('text/luma-photo'); if (photoId) assignPhoto(slotIndex, photoId) }
  const filled = assignments.filter(Boolean).length

  return <section className="session-detail-page" aria-labelledby="session-detail-title">
    <header className="session-detail-heading"><div><button className="back-link" onClick={onBack}>← {sessionName}</button><p className="eyebrow">{tr(language, 'Chỉnh sửa frame đã chụp', 'Edit captured frame')}</p><h1 id="session-detail-title">{template.name}</h1><p>{tr(language, `${frame.photos.length} ảnh đã chụp · ${filled}/${template.requiredSlots} ô đã điền`, `${frame.photos.length} captures · ${filled}/${template.requiredSlots} slots filled`)}</p></div><div className="session-detail-actions"><button className="primary-button" disabled={filled !== template.requiredSlots} onClick={() => setShowOutput(value => !value)}>{showOutput ? tr(language, 'Đóng bản in', 'Close output') : tr(language, 'In / xuất ảnh', 'Print / export')}</button></div></header>

    {showOutput && <OutputEditor language={language} settings={settings} template={template} frame={frame} assignments={assignments} onChange={onChange} onClose={() => setShowOutput(false)} />}

    <div className="session-workspace">
      <aside className="session-frame-panel"><div className="session-frame-art"><FrameArtwork activeSlot={activeSlot} onSlotClick={setActiveSlot} photos={assignments} template={template} language={language} /></div><div className="slot-toolbar"><div><span>{tr(language, `Đang chọn ô ${activeSlot + 1}`, `Slot ${activeSlot + 1} selected`)}</span><strong>{activePhoto ? tr(language, 'Đã có ảnh', 'Photo assigned') : tr(language, 'Đang trống', 'Empty')}</strong></div><button className="primary-button" onClick={() => onCaptureSlot(activeSlot)}>{activePhoto ? tr(language, 'Chụp lại ô này', 'Retake this slot') : tr(language, 'Chụp ô này', 'Capture this slot')}</button></div><div className="slot-drop-list" aria-label={tr(language, 'Các vị trí ảnh', 'Photo slots')}>{template.slots.map((slot, index) => <button className={activeSlot === index ? 'active' : ''} key={slot.id} onClick={() => setActiveSlot(index)} onDragOver={event => event.preventDefault()} onDrop={event => movePhoto(event, index)}><span>{String(index + 1).padStart(2, '0')}</span><div style={{ aspectRatio: (slot.width * template.output.width) / (slot.height * template.output.height) }}>{assignments[index] ? <img src={assignments[index]!} alt="" /> : <i>{tr(language, 'Thả ảnh vào đây', 'Drop photo here')}</i>}</div></button>)}</div></aside>

      <main className="session-photo-library"><div className="library-heading"><div><p className="eyebrow">{tr(language, 'Tất cả ảnh', 'All captures')}</p><h2>{tr(language, 'Thư viện ảnh', 'Photo library')}</h2></div><button className="secondary-button" onClick={() => onCaptureSlot(activeSlot)}>{tr(language, `Chụp cho ô ${activeSlot + 1}`, `Capture for slot ${activeSlot + 1}`)}</button></div>
        {assignmentMessage && <p className="assignment-message" role="status">{assignmentMessage}</p>}
        {frame.photos.length === 0 ? <div className="photo-library-empty"><strong>{tr(language, 'Chưa có ảnh nào.', 'No photos yet.')}</strong><p>{tr(language, 'Chọn một ô trong frame rồi bắt đầu chụp. Ảnh sẽ xuất hiện ở đây.', 'Choose a frame slot and capture it. Every take will appear here.')}</p><button className="primary-button" onClick={() => onCaptureSlot(activeSlot)}>{tr(language, 'Chụp ảnh đầu tiên', 'Capture first photo')}</button></div> : <div className="session-photo-grid">{[...frame.photos].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.capturedAt.localeCompare(a.capturedAt)).map((photo, index) => {
          const slotIndex = frame.assignments.indexOf(photo.id)
          return <article className={`session-photo-card ${slotIndex >= 0 ? 'assigned' : ''}`} draggable onDragStart={event => event.dataTransfer.setData('text/luma-photo', photo.id)} key={photo.id}><button className="photo-view-button" onClick={() => setPreviewPhotoId(photo.id)}><img src={photo.dataUrl} alt={tr(language, `Ảnh ${index + 1}`, `Capture ${index + 1}`)} /><span>{slotIndex >= 0 ? tr(language, `Ô ${slotIndex + 1}`, `Slot ${slotIndex + 1}`) : tr(language, 'Chưa dùng', 'Unassigned')}</span></button><div className="photo-card-actions"><button aria-pressed={photo.pinned} onClick={() => update({ photos: frame.photos.map(item => item.id === photo.id ? { ...item, pinned: !item.pinned } : item) })}>{photo.pinned ? tr(language, 'Bỏ ghim', 'Unpin') : tr(language, 'Ghim', 'Pin')}</button><button onClick={() => assignPhoto(activeSlot, photo.id)}>{tr(language, `Đặt vào ô ${activeSlot + 1}`, `Use in slot ${activeSlot + 1}`)}</button><button className="danger" onClick={() => removePhoto(photo.id)}>{tr(language, 'Xóa', 'Delete')}</button></div></article>
        })}</div>}
      </main>
    </div>
    {previewPhotoId && <div className="photo-lightbox" role="dialog" aria-modal="true" aria-label={tr(language, 'Xem ảnh', 'Photo preview')}><button className="lightbox-close" onClick={() => setPreviewPhotoId(null)}>×</button><img src={frame.photos.find(photo => photo.id === previewPhotoId)?.dataUrl} alt={tr(language, 'Ảnh phóng to', 'Enlarged capture')} /></div>}
  </section>
}
