import type { JSX } from 'react'
import { tr, type Language } from '../i18n'
import type { TemplateManifest } from '../templates'
import type { BoothSession, SessionFrameSet } from '../types'
import { FrameArtwork } from './FrameArtwork'

interface SessionFramesProps {
  language: Language
  session: BoothSession
  templates: TemplateManifest[]
  onBack: () => void
  onNew: () => void
  onOpen: (frame: SessionFrameSet) => void
  onDelete: (frame: SessionFrameSet) => void
}

function NewFrameCard({ language, onClick }: { language: Language; onClick: () => void }): JSX.Element {
  return <button className="new-frame-card" onClick={onClick}><span aria-hidden="true">＋</span><strong>{tr(language, 'Frame mới', 'New frame')}</strong><small>{tr(language, 'Chọn layout rồi bắt đầu chụp', 'Choose a layout and start capturing')}</small></button>
}

export function SessionFrames({ language, session, templates, onBack, onNew, onOpen, onDelete }: SessionFramesProps): JSX.Element {
  return <section className="session-frames-page" aria-labelledby="session-frames-title">
    <header className="session-frames-heading"><div><button className="back-link" onClick={onBack}>← {tr(language, 'Các phiên', 'Sessions')}</button><p className="eyebrow">{tr(language, 'Phiên làm việc', 'Working session')}</p><h1 id="session-frames-title">{session.name}</h1><p>{tr(language, `${session.frames.length} frame trong phiên này`, `${session.frames.length} frame${session.frames.length === 1 ? '' : 's'} in this session`)}</p></div></header>
    <div className="session-frame-list">
      {session.frames.map((frame, index) => {
        const template = templates.find(item => item.id === frame.templateId) ?? templates[0]
        if (!template) return null
        const photos = frame.assignments.map(id => frame.photos.find(photo => photo.id === id)?.dataUrl ?? null)
        const complete = photos.filter(Boolean).length === template.requiredSlots
        return <article className="captured-frame-card" key={frame.id}><button className="captured-frame-open" onClick={() => onOpen(frame)}><div className="captured-frame-preview"><FrameArtwork language={language} photos={photos} template={template} /></div><div className="captured-frame-copy"><span>{String(index + 1).padStart(2, '0')} · {complete ? tr(language, 'Hoàn tất', 'Complete') : tr(language, 'Bản nháp', 'Draft')}</span><h2>{template.name}</h2><p>{tr(language, `${photos.filter(Boolean).length}/${template.requiredSlots} ô · ${frame.photos.length} ảnh`, `${photos.filter(Boolean).length}/${template.requiredSlots} slots · ${frame.photos.length} captures`)}</p></div></button><button className="frame-card-delete" onClick={() => onDelete(frame)}>{tr(language, 'Xóa', 'Delete')}</button></article>
      })}
      <NewFrameCard language={language} onClick={onNew} />
    </div>
  </section>
}
