import type { JSX } from 'react'
import type { TemplateManifest } from '../templates'
import { FrameArtwork } from './FrameArtwork'
import { tr, type Language } from '../i18n'

interface SelectionBoardProps {
  language: Language
  activeSlot: number
  assignments: Array<string | null>
  canCaptureMore: boolean
  captures: string[]
  template: TemplateManifest
  onAssign: (photo: string) => void
  onCaptureAnother: () => void
  onContinue: () => void
  onSelectSlot: (slotIndex: number) => void
}

export function SelectionBoard({ language, activeSlot, assignments, canCaptureMore, captures, template, onAssign, onCaptureAnother, onContinue, onSelectSlot }: SelectionBoardProps): JSX.Element {
  const isComplete = assignments.every(Boolean)

  return (
    <section className="selection-board" aria-labelledby="selection-heading">
      <div className="selection-copy">
        <p className="eyebrow">{tr(language, 'Chọn & sắp ảnh', 'Choose & arrange')}</p>
        <h1 id="selection-heading">{tr(language, `Hoàn thiện ${template.requiredSlots} ảnh.`, `Make the final ${template.requiredSlots}.`)}</h1>
        <p>{tr(language, 'Chọn một ô trên khung, rồi chọn ảnh bên dưới. Một ảnh chỉ được dùng một lần.', 'Select a frame slot, then choose a photo below. A photo can only be used once.')}</p>
        <div className="selection-actions">
          {canCaptureMore && <button className="secondary-button" onClick={onCaptureAnother}>{tr(language, 'Chụp thêm', 'Capture another option')}</button>}
          <button className="primary-button" disabled={!isComplete} onClick={onContinue}>{tr(language, 'Tiếp tục', 'Continue')}</button>
        </div>
        {!isComplete && <p className="selection-note" role="status">{tr(language, `Chọn thêm ${assignments.filter(photo => !photo).length} ảnh để tiếp tục.`, `Choose ${assignments.filter(photo => !photo).length} more photos to continue.`)}</p>}
      </div>

      <div className="selection-frame">
        <FrameArtwork activeSlot={activeSlot} onSlotClick={onSelectSlot} photos={assignments} template={template} language={language} label={tr(language, 'Bố cục khung cuối. Chọn một ô để chỉnh.', 'Final frame arrangement. Select a slot to edit it.')} />
        <p>{tr(language, `Đang sửa ô ${activeSlot + 1} / ${template.requiredSlots}`, `Editing slot ${activeSlot + 1} of ${template.requiredSlots}`)}</p>
      </div>

      <div className="candidate-pool" aria-label={tr(language, 'Các lựa chọn ảnh đã chụp', 'Captured photo options')}>
        <div className="pool-heading"><h2>{tr(language, 'Ảnh đã chụp', 'Captured photos')}</h2><span>{tr(language, `${captures.length} lựa chọn`, `${captures.length} options`)}</span></div>
        {captures.length === 0 ? <p className="pool-empty" role="status">{tr(language, 'Ảnh đã chụp sẽ xuất hiện ở đây.', 'Your captured photos will appear here.')}</p> : <div className="candidate-grid">
          {captures.map((photo, index) => {
            const assignedSlot = assignments.indexOf(photo)
            const isSelected = assignments[activeSlot] === photo
            return <button aria-pressed={isSelected} className={`candidate-photo ${isSelected ? 'selected' : ''}`} key={photo} onClick={() => onAssign(photo)}>
              <img alt={tr(language, `Ảnh đã chụp ${index + 1}${assignedSlot >= 0 ? `, hiện ở ô ${assignedSlot + 1}` : ''}`, `Captured photo ${index + 1}${assignedSlot >= 0 ? `, currently in slot ${assignedSlot + 1}` : ''}`)} src={photo} />
              <span>{assignedSlot >= 0 ? tr(language, `Ô ${assignedSlot + 1}`, `Slot ${assignedSlot + 1}`) : tr(language, 'Có thể chọn', 'Available')}</span>
            </button>
          })}
        </div>}
      </div>
    </section>
  )
}
