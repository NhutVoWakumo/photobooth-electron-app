import { useEffect, useRef, useState, type JSX } from 'react'
import QRCode from 'qrcode'
import { tr, type Language } from '../i18n'
import { renderTemplate } from '../lib/renderTemplate'
import type { TemplateManifest } from '../templates'
import type { BoothSession, BoothSettings, SessionFrameSet } from '../types'
import { FrameArtwork } from './FrameArtwork'
import { PageShell } from './PageShell'
import { defaultFrameQrPlacement } from '../lib/frameQr'

interface SessionFramesProps {
  language: Language
  session: BoothSession
  templates: TemplateManifest[]
  settings: BoothSettings
  onBack: () => void
  onNew: () => void
  onOpen: (frame: SessionFrameSet) => void
  onDelete: (frame: SessionFrameSet) => void
  onChangeSession: (session: BoothSession) => void
}

function NewFrameCard({ language, onClick }: { language: Language; onClick: () => void }): JSX.Element {
  return <button className="new-frame-card" onClick={onClick}><span aria-hidden="true">＋</span><strong>{tr(language, 'Frame mới', 'New frame')}</strong><small>{tr(language, 'Chọn layout rồi bắt đầu chụp', 'Choose a layout and start capturing')}</small></button>
}

export function SessionFrames({ language, session, templates, settings, onBack, onNew, onOpen, onDelete, onChangeSession }: SessionFramesProps): JSX.Element {
  const [drive, setDrive] = useState<{ configured: boolean; connected: boolean; pending: number; message: string } | null>(null)
  const [cloudError, setCloudError] = useState('')
  const [cloudBusy, setCloudBusy] = useState(false)
  const [cloudLinks, setCloudLinks] = useState<Record<string, { url: string; expiresAt: string }>>({})
  const [cloudQrImages, setCloudQrImages] = useState<Record<string, string>>({})
  const [sessionLink, setSessionLink] = useState<{ url: string; expiresAt: string } | null>(null)
  const [qr, setQr] = useState<{ url: string; image: string; expiresAt: string; title: string } | null>(null)
  const syncingSignature = useRef<string | null>(null)
  const completedFrames = session.frames.flatMap(frame => {
    const template = templates.find(item => item.id === frame.templateId)
    return template && frame.assignments.length === template.requiredSlots && frame.assignments.every(id => frame.photos.some(photo => photo.id === id)) ? [{ frame, template }] : []
  })
  const qrEnabled = Boolean(drive?.connected && session.qrEnabled !== false)
  const syncSignature = completedFrames.map(({ frame }) => `${frame.id}:${frame.updatedAt}`).join('|')
  const refresh = async () => {
    if (!window.booth) return
    setDrive(await window.booth.driveStatus())
    setSessionLink(await window.booth.driveSessionLink(session.id))
    const links = await Promise.all(session.frames.map(async frame => [frame.id, await window.booth!.driveFrameLink(session.id, frame.id)] as const))
    const linked = links.filter((item): item is readonly [string, { url: string; expiresAt: string }] => Boolean(item[1]))
    setCloudLinks(Object.fromEntries(linked))
    setCloudQrImages(Object.fromEntries(await Promise.all(linked.map(async ([id, link]) => [id, await QRCode.toDataURL(link.url, { width: 256, margin: 0 })] as const))))
  }
  useEffect(() => {
    void refresh()
    const onDriveChange = () => { void refresh() }
    window.addEventListener('luma-drive-changed', onDriveChange)
    return () => window.removeEventListener('luma-drive-changed', onDriveChange)
  }, [session.id, session.frames.length])
  const run = async (action: () => Promise<void>) => {
    setCloudBusy(true); setCloudError('')
    try { await action(); await refresh() } catch (error) { setCloudError(error instanceof Error ? error.message : String(error)) }
    finally { setCloudBusy(false) }
  }
  const uploadFrame = async (frame: SessionFrameSet, template: TemplateManifest, shareFrame: boolean) => {
    if (!window.booth) throw new Error('Drive sharing requires the desktop app.')
    const photos = frame.assignments.map(id => frame.photos.find(photo => photo.id === id)).filter((photo): photo is NonNullable<typeof photo> => Boolean(photo))
    if (photos.length !== template.requiredSlots) throw new Error('Complete all frame slots before sharing.')
    const url = await window.booth.drivePrepareFrame({ sessionId: session.id, sessionName: session.name, frameId: frame.id, frameName: `${template.name} · ${frame.createdAt.slice(0, 10)}`, shareFrame })
    const finalImage = await renderTemplate({ eventName: settings.eventName, photos: photos.map(photo => photo.dataUrl), template, outputJpegQuality: settings.outputJpegQuality, photoTransforms: frame.slotTransforms, qr: { url, placement: frame.qrPlacement ?? defaultFrameQrPlacement(template) } })
    await window.booth.driveQueueFrame({ sessionId: session.id, sessionName: session.name, frameId: frame.id, frameName: `${template.name} · ${frame.createdAt.slice(0, 10)}`, finalImage, photos: photos.map(photo => ({ id: photo.id, dataUrl: photo.dataUrl })), shareFrame })
  }
  const publishSession = () => run(async () => {
    if (completedFrames.length === 0) return
    for (const item of completedFrames) await uploadFrame(item.frame, item.template, true)
    await window.booth!.driveProcessQueue()
    const status = await window.booth!.driveStatus()
    if (status.message) throw new Error(status.message)
    await window.booth!.driveSetSessionSharing(session.id, true)
    onChangeSession({ ...session, qrSyncedSignature: syncSignature })
  })
  useEffect(() => {
    if (!qrEnabled || !syncSignature || syncSignature === session.qrSyncedSignature || syncingSignature.current === syncSignature || cloudBusy) return
    syncingSignature.current = syncSignature
    void publishSession()
  }, [qrEnabled, syncSignature, session.qrSyncedSignature, cloudBusy])
  const toggleQr = () => run(async () => {
    if (qrEnabled) {
      await window.booth!.driveSetSessionSharing(session.id, false)
      onChangeSession({ ...session, qrEnabled: false, qrSyncedSignature: undefined })
    } else {
      onChangeSession({ ...session, qrEnabled: true, qrSyncedSignature: undefined })
    }
  })
  const showQr = async (link: { url: string; expiresAt: string }, title: string) => {
    setQr({ ...link, title, image: await QRCode.toDataURL(link.url, { width: 440, margin: 2 }) })
  }
  return <PageShell className="session-frames-page" eyebrow={tr(language, 'Phiên làm việc', 'Working session')} title={session.name} description={tr(language, `${session.frames.length} frame trong phiên này`, `${session.frames.length} frame${session.frames.length === 1 ? '' : 's'} in this session`)} backLabel={tr(language, 'Các phiên', 'Sessions')} onBack={onBack}>
    {window.booth && <section className="drive-panel" aria-label={tr(language, 'Chia sẻ qua Google Drive', 'Google Drive sharing')}>
      <div><strong>{tr(language, 'QR cho phiên này', 'QR for this session')}</strong><p>{drive?.connected ? cloudBusy ? tr(language, 'Đang đồng bộ ảnh…', 'Syncing photos…') : qrEnabled ? tr(language, 'Tự động lưu ảnh lên Drive và tạo QR.', 'Automatically upload photos and create QR codes.') : tr(language, 'Đã tắt. Ảnh vẫn lưu trên máy.', 'Off. Photos stay on this computer.') : tr(language, 'Kết nối Google Drive trong Settings để dùng QR.', 'Connect Google Drive in Settings to use QR.')}</p></div>
      <div className="drive-actions"><button className="drive-qr-toggle" type="button" role="switch" aria-checked={qrEnabled} disabled={!drive?.connected || cloudBusy} onClick={() => void toggleQr()}>{qrEnabled ? tr(language, 'QR bật', 'QR on') : tr(language, 'QR tắt', 'QR off')}</button></div>
      {(cloudError || drive?.message) && <p className="drive-error" role="alert">{cloudError || drive?.message}</p>}
      {cloudError && qrEnabled && <button className="drive-qr-view" onClick={() => { syncingSignature.current = null; void publishSession() }}>{tr(language, 'Thử lại', 'Retry')}</button>}
      {qrEnabled && sessionLink && <button className="drive-qr-view" onClick={() => void showQr(sessionLink, tr(language, 'Ảnh của phiên này', 'Photos in this session'))}>{tr(language, 'Xem mã QR', 'View QR code')}</button>}
    </section>}
    <div className="session-frame-list">
      {session.frames.map((frame, index) => {
        const template = templates.find(item => item.id === frame.templateId) ?? templates[0]
        if (!template) return null
        const photos = frame.assignments.map(id => { const photo = frame.photos.find(item => item.id === id); return photo?.previewDataUrl ?? photo?.dataUrl ?? null })
        const complete = photos.filter(Boolean).length === template.requiredSlots
        return <article className="captured-frame-card" key={frame.id}><button className="captured-frame-open" onClick={() => onOpen(frame)}><div className="captured-frame-preview"><FrameArtwork language={language} photos={photos} template={template} qrDataUrl={qrEnabled ? cloudQrImages[frame.id] : undefined} qrPlacement={frame.qrPlacement ?? defaultFrameQrPlacement(template)} /></div><div className="captured-frame-copy"><span>{String(index + 1).padStart(2, '0')} · {complete ? tr(language, 'Hoàn tất', 'Complete') : tr(language, 'Bản nháp', 'Draft')}</span><h2>{template.name}</h2><p>{tr(language, `${photos.filter(Boolean).length}/${template.requiredSlots} ô · ${frame.photos.length} ảnh`, `${photos.filter(Boolean).length}/${template.requiredSlots} slots · ${frame.photos.length} captures`)}</p></div></button><div className="frame-cloud-actions">{qrEnabled && cloudLinks[frame.id] && <button onClick={() => void showQr(cloudLinks[frame.id], tr(language, 'Ảnh của bạn', 'Your photos'))}>{tr(language, 'Xem QR', 'View QR')}</button>}<button className="frame-card-delete" onClick={() => onDelete(frame)}>{tr(language, 'Xóa', 'Delete')}</button></div></article>
      })}
      <NewFrameCard language={language} onClick={onNew} />
    </div>
    {qr && <div className="drive-qr-backdrop" role="dialog" aria-modal="true" aria-label="Drive QR"><div className="drive-qr-card"><button className="drive-qr-close" onClick={() => setQr(null)} aria-label={tr(language, 'Đóng', 'Close')}>×</button><h2>{qr.title}</h2><img src={qr.image} alt={tr(language, 'Mã QR mở ảnh trên Drive', 'QR code for photos on Drive')} /><button className="drive-owner-link" onClick={() => void window.booth?.driveOpenFolder(qr.url)}>{tr(language, 'Mở thư mục ảnh', 'Open photo folder')}</button><p>{tr(language, 'Hết hạn', 'Expires')}: {new Date(qr.expiresAt).toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US')}</p></div></div>}
  </PageShell>
}
