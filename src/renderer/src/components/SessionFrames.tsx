import { useEffect, useRef, useState, type JSX } from 'react'
import QRCode from 'qrcode'
import { tr, type Language } from '../i18n'
import { renderTemplate } from '../lib/renderTemplate'
import type { TemplateManifest } from '../templates'
import type { BoothSession, BoothSettings, SessionFrameSet } from '../types'
import { FrameArtwork } from './FrameArtwork'
import { PageShell } from './PageShell'
import { effectiveFrameQrPlacement } from '../lib/frameQr'
import { paperSizes } from '../../../shared/printProfile'

interface SessionFramesProps {
  language: Language
  session: BoothSession
  templates: TemplateManifest[]
  settings: BoothSettings
  onBack: () => void
  onNew: () => void
  onOpen: (frame: SessionFrameSet) => void
  onDelete: (frame: SessionFrameSet) => Promise<void>
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
  const [renaming, setRenaming] = useState(false)
  const [draftName, setDraftName] = useState(session.name)
  const [sessionSettingsOpen, setSessionSettingsOpen] = useState(false)
  const [sessionSettingsTab, setSessionSettingsTab] = useState<'sharing' | 'printing' | 'capture'>('sharing')
  const settingsDialogRef = useRef<HTMLDialogElement>(null)
  const settingsCloseRef = useRef<HTMLButtonElement>(null)
  const settingsTriggerRef = useRef<HTMLButtonElement>(null)
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
  const deleteFrame = (frame: SessionFrameSet) => run(async () => { await onDelete(frame) })
  const uploadFrame = async (frame: SessionFrameSet, template: TemplateManifest, shareFrame: boolean) => {
    if (!window.booth) throw new Error('Drive sharing requires the desktop app.')
    const photos = frame.assignments.map(id => frame.photos.find(photo => photo.id === id)).filter((photo): photo is NonNullable<typeof photo> => Boolean(photo))
    if (photos.length !== template.requiredSlots) throw new Error('Complete all frame slots before sharing.')
    const url = await window.booth.drivePrepareFrame({ sessionId: session.id, sessionName: session.name, frameId: frame.id, frameName: `${template.name} · ${frame.createdAt.slice(0, 10)}`, shareFrame })
    const finalImage = await renderTemplate({ eventName: settings.eventName, photos: photos.map(photo => photo.dataUrl), template, outputJpegQuality: settings.outputJpegQuality, photoTransforms: frame.slotTransforms, qr: { url, placement: effectiveFrameQrPlacement(frame.qrPlacement, template) } })
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
  const saveName = () => {
    const name = draftName.trim().slice(0, 60)
    if (name && name !== session.name) onChangeSession({ ...session, name, updatedAt: new Date().toISOString(), qrSyncedSignature: undefined })
    setRenaming(false)
  }
  const updatePrintSettings = (patch: Partial<NonNullable<BoothSession['printSettings']>>) => onChangeSession({ ...session, printSettings: { ...session.printSettings, ...patch }, updatedAt: new Date().toISOString() })
  const globalPaper = settings.printerProfiles?.[settings.printerName]?.paper
  const sessionPaper = session.printSettings?.paper ?? null
  useEffect(() => {
    const dialog = settingsDialogRef.current
    if (sessionSettingsOpen && dialog && !dialog.open) {
      dialog.showModal()
      settingsCloseRef.current?.focus()
    } else if (!sessionSettingsOpen && dialog?.open) {
      dialog.close()
    }
  }, [sessionSettingsOpen])
  const sessionQrSummary = drive?.connected
    ? qrEnabled ? tr(language, 'QR đang bật', 'QR on') : tr(language, 'QR đang tắt', 'QR off')
    : tr(language, 'Chưa kết nối Drive', 'Drive not connected')
  const sessionPrinterSummary = settings.printerName === 'none'
    ? tr(language, 'Chưa chọn máy in', 'No printer selected')
    : `${settings.printerName} · ${paperSizes[sessionPaper ?? globalPaper ?? '4x6'].label}`
  return <PageShell className="session-frames-page" eyebrow={tr(language, 'Phiên làm việc', 'Working session')} title={session.name} description={tr(language, `${session.frames.length} frame trong phiên này`, `${session.frames.length} frame${session.frames.length === 1 ? '' : 's'} in this session`)} backLabel={tr(language, 'Các phiên', 'Sessions')} onBack={onBack} actions={<button className="secondary-button" type="button" onClick={() => { setDraftName(session.name); setRenaming(true) }}>{tr(language, 'Đổi tên phiên', 'Rename session')}</button>}>
    {cloudError && <p className="drive-error session-drive-error" role="alert">{cloudError}</p>}
    {renaming && <div className="session-name-backdrop" role="dialog" aria-modal="true" aria-label={tr(language, 'Đổi tên phiên', 'Rename session')}><form className="session-name-dialog" onSubmit={event => { event.preventDefault(); saveName() }}><h2>{tr(language, 'Tên phiên chụp', 'Session name')}</h2><label htmlFor="session-name-input">{tr(language, 'Tên hiển thị trong danh sách', 'Name shown in the session list')}</label><input id="session-name-input" autoFocus maxLength={60} value={draftName} onChange={event => setDraftName(event.target.value)} /><div><button type="button" className="secondary-button" onClick={() => setRenaming(false)}>{tr(language, 'Hủy', 'Cancel')}</button><button className="primary-button" disabled={!draftName.trim()} type="submit">{tr(language, 'Lưu tên', 'Save name')}</button></div></form></div>}
    <section className="session-setup-summary" aria-label={tr(language, 'Thiết lập phiên', 'Session setup')}>
      <div className="session-setup-status"><strong>{tr(language, 'Thiết lập phiên', 'Session setup')}</strong><div><span className={qrEnabled ? 'session-status-chip is-enabled' : 'session-status-chip'}>{sessionQrSummary}</span><span className="session-printer-chip">{sessionPrinterSummary}</span></div></div>
      <button ref={settingsTriggerRef} className="primary-button" type="button" onClick={() => { setSessionSettingsTab('sharing'); setSessionSettingsOpen(true) }}>{tr(language, 'Quản lý thiết lập', 'Manage setup')}</button>
    </section>
    <div className="session-frame-list">
      {session.frames.map((frame, index) => {
        const template = templates.find(item => item.id === frame.templateId) ?? templates[0]
        if (!template) return null
        const photos = frame.assignments.map(id => { const photo = frame.photos.find(item => item.id === id); return photo?.previewDataUrl ?? photo?.dataUrl ?? null })
        const complete = photos.filter(Boolean).length === template.requiredSlots
        return <article className="captured-frame-card" key={frame.id}><button className="captured-frame-open" onClick={() => onOpen(frame)}><div className="captured-frame-preview"><FrameArtwork language={language} photos={photos} template={template} qrDataUrl={qrEnabled ? cloudQrImages[frame.id] : undefined} qrPlacement={effectiveFrameQrPlacement(frame.qrPlacement, template)} /></div><div className="captured-frame-copy"><span>{String(index + 1).padStart(2, '0')} · {complete ? tr(language, 'Hoàn tất', 'Complete') : tr(language, 'Bản nháp', 'Draft')}</span><h2>{template.name}</h2><p>{tr(language, `${photos.filter(Boolean).length}/${template.requiredSlots} ô · ${frame.photos.length} ảnh`, `${photos.filter(Boolean).length}/${template.requiredSlots} slots · ${frame.photos.length} captures`)}</p></div></button><div className="frame-cloud-actions">{qrEnabled && cloudLinks[frame.id] && <button disabled={cloudBusy} onClick={() => void showQr(cloudLinks[frame.id], tr(language, 'Ảnh của bạn', 'Your photos'))}>{tr(language, 'Xem QR', 'View QR')}</button>}<button className="frame-card-delete" disabled={cloudBusy} aria-label={tr(language, `Xóa frame ${index + 1} khỏi session và Drive`, `Delete frame ${index + 1} from session and Drive`)} onClick={() => void deleteFrame(frame)}>{cloudBusy ? tr(language, 'Đang xóa…', 'Deleting…') : tr(language, 'Xóa frame', 'Delete frame')}</button></div></article>
      })}
      <NewFrameCard language={language} onClick={onNew} />
    </div>
    <dialog ref={settingsDialogRef} className="session-settings-dialog" aria-labelledby="session-settings-title" onClose={() => { setSessionSettingsOpen(false); settingsTriggerRef.current?.focus() }}>
      <header className="session-settings-heading">
        <div><h2 id="session-settings-title">{tr(language, 'Thiết lập phiên', 'Session setup')}</h2><p>{tr(language, 'Cài đặt chỉ áp dụng cho phiên này.', 'Changes apply only to this session.')}</p></div>
        <button ref={settingsCloseRef} type="button" className="session-settings-close" onClick={() => setSessionSettingsOpen(false)} aria-label={tr(language, 'Đóng thiết lập', 'Close session setup')}>×</button>
      </header>
      <div className="session-settings-tabs" role="group" aria-label={tr(language, 'Nhóm thiết lập', 'Settings categories')}>
        <button type="button" aria-pressed={sessionSettingsTab === 'sharing'} onClick={() => setSessionSettingsTab('sharing')}>{tr(language, 'QR & chia sẻ', 'QR & sharing')}</button>
        <button type="button" aria-pressed={sessionSettingsTab === 'printing'} onClick={() => setSessionSettingsTab('printing')}>{tr(language, 'In ảnh', 'Printing')}</button>
        <button type="button" aria-pressed={sessionSettingsTab === 'capture'} onClick={() => setSessionSettingsTab('capture')}>{tr(language, 'Màn chụp', 'Capture screen')}</button>
      </div>
      <div className="session-settings-content">
        {sessionSettingsTab === 'sharing' ? <section className="session-settings-section" aria-labelledby="session-sharing-title">
          <div className="session-settings-section-heading"><div><h3 id="session-sharing-title">{tr(language, 'Chia sẻ ảnh bằng QR', 'Share photos with QR')}</h3><p>{drive?.connected ? cloudBusy ? tr(language, 'Đang đồng bộ ảnh lên Google Drive.', 'Photos are syncing to Google Drive.') : qrEnabled ? tr(language, 'Ảnh sẽ được lưu lên Drive và có thể mở bằng QR.', 'Photos upload to Drive and can be opened with a QR code.') : tr(language, 'Tắt. Ảnh vẫn được lưu trên máy này.', 'Off. Photos remain saved on this computer.') : tr(language, 'Kết nối Google Drive trong Settings để bật QR.', 'Connect Google Drive in Settings to enable QR.')}</p></div>
            <button className="drive-qr-toggle" type="button" role="switch" aria-checked={qrEnabled} disabled={!drive?.connected || cloudBusy} onClick={() => void toggleQr()}>{qrEnabled ? tr(language, 'QR bật', 'QR on') : tr(language, 'QR tắt', 'QR off')}</button>
          </div>
          {(cloudError || drive?.message) && <p className="drive-error" role="alert">{cloudError || drive?.message}</p>}
          <div className="session-settings-actions">{qrEnabled && sessionLink && <button className="secondary-button" type="button" onClick={() => void showQr(sessionLink, tr(language, 'Ảnh của phiên này', 'Photos in this session'))}>{tr(language, 'Xem QR phiên', 'View session QR')}</button>}{cloudError && qrEnabled && <button className="secondary-button" type="button" onClick={() => { syncingSignature.current = null; void publishSession() }}>{tr(language, 'Thử đồng bộ lại', 'Retry sync')}</button>}</div>
        </section> : sessionSettingsTab === 'printing' ? <section className="session-settings-section" aria-labelledby="session-print-title">
          <div className="session-settings-section-heading"><div><h3 id="session-print-title">{tr(language, 'Thiết lập in', 'Print setup')}</h3><p>{tr(language, 'Mặc định lấy từ Settings. Thay đổi tại đây chỉ áp dụng cho phiên này.', 'Uses Settings defaults. Changes here apply only to this session.')}</p></div><span className="session-print-summary">{sessionPrinterSummary}</span></div>
          <label className="session-paper-field"><span>{tr(language, 'Khổ giấy', 'Paper size')}</span><select value={sessionPaper ?? ''} onChange={event => updatePrintSettings({ paper: event.target.value ? event.target.value as NonNullable<typeof globalPaper> : null })}><option value="">{tr(language, `Theo mặc định${globalPaper ? ` · ${paperSizes[globalPaper].label}` : ''}`, `Use default${globalPaper ? ` · ${paperSizes[globalPaper].label}` : ''}`)}</option>{Object.entries(paperSizes).map(([value, paper]) => <option key={value} value={value}>{paper.label}</option>)}</select></label>
          <div className="session-print-switches">
            <SessionPrintSwitch language={language} label={tr(language, 'Tự động in khi hoàn tất', 'Print automatically')} checked={session.printSettings?.printAutomatically ?? settings.printAutomatically} onChange={value => updatePrintSettings({ printAutomatically: value })} />
            <SessionPrintSwitch language={language} label={tr(language, 'Hiện nút in', 'Show print button')} checked={session.printSettings?.showPrintButton ?? settings.showPrintButton} onChange={value => updatePrintSettings({ showPrintButton: value })} />
            <SessionPrintSwitch language={language} label={tr(language, 'Tự xoay theo frame', 'Auto-rotate to fit')} checked={session.printSettings?.autoRotatePrint ?? settings.autoRotatePrint} onChange={value => updatePrintSettings({ autoRotatePrint: value })} />
            <SessionPrintSwitch language={language} label={tr(language, 'Ẩn nút khi hết lượt', 'Hide button at print limit')} checked={session.printSettings?.hidePrintButtonAfterLimit ?? settings.hidePrintButtonAfterLimit} onChange={value => updatePrintSettings({ hidePrintButtonAfterLimit: value })} />
            <SessionPrintSwitch language={language} label={tr(language, 'In strip 2 × 6', 'Print 2 × 6 strips')} checked={session.printSettings?.printTwoBySix ?? settings.printTwoBySix} onChange={value => updatePrintSettings({ printTwoBySix: value })} />
          </div>
          <div className="session-print-ranges"><SessionPrintRange label={tr(language, 'Số bản tối đa cho một bộ ảnh', 'Maximum prints per photo set')} value={session.printSettings?.maxPrintsPerSession ?? settings.maxPrintsPerSession} min={1} max={20} onChange={value => updatePrintSettings({ maxPrintsPerSession: value })} /><SessionPrintRange label={tr(language, 'Số bản toàn sự kiện', 'Prints per event')} value={session.printSettings?.maxPrintsPerEvent ?? settings.maxPrintsPerEvent} min={1} max={500} onChange={value => updatePrintSettings({ maxPrintsPerEvent: value })} /></div>
          <small className="session-print-help">{tr(language, 'Giới hạn bộ ảnh tính riêng cho từng frame. Giới hạn sự kiện cộng dồn các bản in trong phiên.', 'The photo-set limit applies per frame. The event limit counts prints across this session.')}</small>
          {session.printSettings && <button className="session-print-reset" type="button" onClick={() => onChangeSession({ ...session, printSettings: undefined, updatedAt: new Date().toISOString() })}>{tr(language, 'Khôi phục mặc định', 'Restore defaults')}</button>}
        </section> : <section className="session-settings-section" aria-labelledby="session-capture-title">
          <div className="session-settings-section-heading"><div><h3 id="session-capture-title">{tr(language, 'Vị trí nút thao tác', 'Capture controls position')}</h3><p>{tr(language, 'Chọn vị trí cụm nút danh sách, chụp và in trên màn hình camera.', 'Choose where the list, capture, and print controls sit over the camera view.')}</p></div></div>
          <div className="session-control-position" role="group" aria-label={tr(language, 'Vị trí cụm nút', 'Control dock position')}>
            {(['bottom', 'left', 'right'] as const).map(position => <button key={position} type="button" aria-pressed={(session.captureControlsPosition ?? 'bottom') === position} onClick={() => onChangeSession({ ...session, captureControlsPosition: position, updatedAt: new Date().toISOString() })}>
              <span className={`session-control-position-preview ${position}`} aria-hidden="true"><i /></span>
              <strong>{position === 'bottom' ? tr(language, 'Dưới', 'Bottom') : position === 'left' ? tr(language, 'Bên trái', 'Left') : tr(language, 'Bên phải', 'Right')}</strong>
            </button>)}
          </div>
        </section>}
      </div>
      <footer className="session-settings-footer"><span>{tr(language, 'Thay đổi được lưu tự động.', 'Changes are saved automatically.')}</span><button className="primary-button" type="button" onClick={() => setSessionSettingsOpen(false)}>{tr(language, 'Xong', 'Done')}</button></footer>
    </dialog>
    {qr && <div className="drive-qr-backdrop" role="dialog" aria-modal="true" aria-label="Drive QR"><div className="drive-qr-card"><button className="drive-qr-close" onClick={() => setQr(null)} aria-label={tr(language, 'Đóng', 'Close')}>×</button><h2>{qr.title}</h2><img src={qr.image} alt={tr(language, 'Mã QR mở ảnh trên Drive', 'QR code for photos on Drive')} /><button className="drive-owner-link" onClick={() => void window.booth?.driveOpenFolder(qr.url)}>{tr(language, 'Mở thư mục ảnh', 'Open photo folder')}</button><p>{tr(language, 'Hết hạn', 'Expires')}: {new Date(qr.expiresAt).toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US')}</p></div></div>}
  </PageShell>
}

function SessionPrintSwitch({ language, label, checked, onChange }: { language: Language; label: string; checked: boolean; onChange: (checked: boolean) => void }): JSX.Element {
  return <label className="session-print-switch"><span>{label}</span><input type="checkbox" role="switch" checked={checked} onChange={event => onChange(event.target.checked)} aria-label={`${label} · ${tr(language, checked ? 'bật' : 'tắt', checked ? 'on' : 'off')}`} /></label>
}

function SessionPrintRange({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }): JSX.Element {
  return <label className="session-print-range"><span><strong>{label}</strong><output>{value}</output></span><input type="range" min={min} max={max} step="1" value={value} onChange={event => onChange(Number(event.target.value))} /></label>
}
