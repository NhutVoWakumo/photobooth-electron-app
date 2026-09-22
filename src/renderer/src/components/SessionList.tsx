import type { JSX } from 'react'
import type { Language } from '../i18n'
import { tr } from '../i18n'
import type { BoothSession } from '../types'
import type { TemplateManifest } from '../templates'
import { FrameArtwork } from './FrameArtwork'
import { PageShell } from './PageShell'

export function SessionList({ language, sessions, templates, onBack, onCreate, onOpen, onDelete }: { language: Language; sessions: BoothSession[]; templates: TemplateManifest[]; onBack: () => void; onCreate: () => void; onOpen: (session: BoothSession) => void; onDelete: (session: BoothSession) => void }): JSX.Element {
  return <PageShell className="sessions-page" eyebrow={tr(language, 'Thư viện cục bộ', 'Local library')} title={tr(language, 'Các phiên chụp.', 'Your sessions.')} description={tr(language, 'Mở lại bất kỳ phiên nào để sắp ảnh, chụp lại hoặc xuất bản in.', 'Open any session to rearrange photos, retake a slot, or prepare a print.')} backLabel={tr(language, 'Trang chính', 'Main page')} onBack={onBack} actions={<button className="primary-button" onClick={onCreate}>{tr(language, 'Tạo phiên mới', 'Create new session')}</button>}>
    {sessions.length === 0 ? <div className="session-empty" role="status"><strong>{tr(language, 'Chưa có phiên nào.', 'No sessions yet.')}</strong><p>{tr(language, 'Tạo phiên đầu tiên; ảnh sẽ tự động lưu vào thư viện này.', 'Create your first one; captures will be saved here automatically.')}</p></div> : <div className="session-list-grid">{sessions.map(session => {
      const latestFrame = session.frames[0]
      const template = latestFrame ? templates.find(item => item.id === latestFrame.templateId) ?? templates[0] : templates[0]
      const photos = latestFrame && template ? latestFrame.assignments.map(id => latestFrame.photos.find(photo => photo.id === id)?.dataUrl ?? null) : []
      const captureCount = session.frames.reduce((sum, frame) => sum + frame.photos.length, 0)
      return <article className="session-card" key={session.id}><button className="session-card-open" onClick={() => onOpen(session)}><div className="session-card-art">{template && latestFrame ? <FrameArtwork language={language} photos={photos} template={template} /> : <span className="empty-session-mark">＋</span>}</div><div><span>{new Date(session.updatedAt).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' })}</span><h2>{session.name}</h2><p>{tr(language, `${session.frames.length} frame · ${captureCount} ảnh`, `${session.frames.length} frames · ${captureCount} captures`)}</p></div></button><button className="text-danger-button" onClick={() => onDelete(session)}>{tr(language, 'Xóa', 'Delete')}</button></article>
    })}</div>}
  </PageShell>
}
