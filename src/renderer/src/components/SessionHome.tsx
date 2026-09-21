import type { JSX } from 'react'
import type { Language } from '../i18n'
import { tr } from '../i18n'
import { BrandLogo } from './BrandLogo'

export function SessionHome({ language, welcomeHeading, sessionCount, onCreate, onView }: { language: Language; welcomeHeading: string; sessionCount: number; onCreate: () => void; onView: () => void }): JSX.Element {
  const lines = welcomeHeading.split(/\r?\n/).map(line => line.trim()).filter(Boolean).slice(0, 2)
  return <section className="session-home" aria-labelledby="session-home-title">
    <BrandLogo />
    <div className="session-home-copy">
      <p className="eyebrow">{tr(language, 'Không gian chụp của bạn', 'Your photo workspace')}</p>
      <h1 id="session-home-title">{lines.map((line, index) => <span key={`${line}-${index}`}>{line}</span>)}</h1>
      <p>{tr(language, 'Tạo một phiên mới hoặc quay lại phiên đang làm dở. Mọi ảnh và vị trí trong frame đều được giữ trên máy này.', 'Start something new or return to a work in progress. Every photo and frame position stays on this computer.')}</p>
    </div>
    <div className="session-home-actions">
      <button className="create-session-button" onClick={onCreate}><span>{tr(language, 'Tạo phiên mới', 'Create new session')}</span><small>{tr(language, 'Chọn frame và bắt đầu chụp', 'Choose a frame and start capturing')}</small></button>
      <button className="view-sessions-button" onClick={onView}><span>{tr(language, 'Xem danh sách phiên', 'View session list')}</span><small>{tr(language, `${sessionCount} phiên đã lưu`, `${sessionCount} saved session${sessionCount === 1 ? '' : 's'}`)}</small></button>
    </div>
  </section>
}
