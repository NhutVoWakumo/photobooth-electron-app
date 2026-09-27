import { useEffect, useRef, useState, type JSX } from 'react'
import QRCode from 'qrcode'
import { tr, type Language } from '../i18n'
import { renderPrintSheet, renderTemplate } from '../lib/renderTemplate'
import type { TemplateManifest } from '../templates'
import type { BoothSettings, PhotoTransform, SessionFrameSet } from '../types'
import { FrameArtwork } from './FrameArtwork'
import { clampFrameQrPlacement, defaultFrameQrPlacement, type FrameQrPlacement } from '../lib/frameQr'

interface Props {
  language: Language
  settings: BoothSettings
  sessionId: string
  sessionName: string
  qrEnabled: boolean
  template: TemplateManifest
  frame: SessionFrameSet
  assignments: Array<string | null>
  onChange: (frame: SessionFrameSet) => void
  onClose: () => void
  onSaveExit?: () => void
  onDelete?: () => void
}

const DEFAULT_TRANSFORM: PhotoTransform = { x: 0, y: 0, scale: 1 }

export function OutputEditor({ language, settings, sessionId, sessionName, qrEnabled, template, frame, assignments, onChange, onClose, onSaveExit, onDelete }: Props): JSX.Element {
  const [selectedSlot, setSelectedSlot] = useState(0)
  const [status, setStatus] = useState<'idle' | 'exporting' | 'done' | 'error' | 'printing' | 'printed' | 'print-error'>('idle')
  const [outputPath, setOutputPath] = useState('')
  const [printError, setPrintError] = useState('')
  const [qrLink, setQrLink] = useState<string | null>(null)
  const [qrPreview, setQrPreview] = useState<string | null>(null)
  const [qrBusy, setQrBusy] = useState(false)
  const [qrError, setQrError] = useState('')
  const [driveConnected, setDriveConnected] = useState(false)
  const autoSyncStarted = useRef(false)
  const showQr = qrEnabled && driveConnected
  const qrPlacement = clampFrameQrPlacement(frame.qrPlacement ?? defaultFrameQrPlacement(template), template)
  useEffect(() => {
    let active = true
    void window.booth?.driveStatus().then(status => { if (active) setDriveConnected(status.connected) })
    void window.booth?.driveFrameLink(sessionId, frame.id).then(link => { if (active) setQrLink(link?.url ?? null) })
    return () => { active = false }
  }, [sessionId, frame.id])
  useEffect(() => {
    let active = true
    if (qrLink) void QRCode.toDataURL(qrLink, { width: 512, margin: 0 }).then(data => { if (active) setQrPreview(data) })
    return () => { active = false }
  }, [qrLink])
  const updateQr = (next: FrameQrPlacement) => onChange({ ...frame, qrPlacement: clampFrameQrPlacement(next, template), updatedAt: new Date().toISOString() })
  const syncQr = async (): Promise<string> => {
    if (!window.booth) throw new Error('Drive sharing requires the desktop app.')
    setQrBusy(true); setQrError('')
    try {
      const photos = frame.assignments.map(id => frame.photos.find(photo => photo.id === id))
      if (photos.length !== template.requiredSlots || photos.some(photo => !photo)) throw new Error('Complete every photo slot first.')
      const frameName = `${template.name} · ${frame.createdAt.slice(0, 10)}`
      const url = await window.booth.drivePrepareFrame({ sessionId, sessionName, frameId: frame.id, frameName, shareFrame: true })
      const finalImage = await renderTemplate({ eventName: settings.eventName, photos: photos.map(photo => photo!.dataUrl), template, outputJpegQuality: settings.outputJpegQuality, photoTransforms: transforms, qr: { url, placement: qrPlacement } })
      await window.booth.driveQueueFrame({ sessionId, sessionName, frameId: frame.id, frameName, finalImage, photos: photos.map(photo => ({ id: photo!.id, dataUrl: photo!.dataUrl })), shareFrame: true })
      await window.booth.driveProcessQueue()
      const result = await window.booth.driveStatus()
      if (result.message) throw new Error(result.message)
      setQrLink(url)
      return url
    } catch (error) { setQrError(error instanceof Error ? error.message : String(error)); throw error }
    finally { setQrBusy(false) }
  }
  useEffect(() => {
    if (!showQr || qrLink || autoSyncStarted.current || frame.assignments.some(id => !id)) return
    autoSyncStarted.current = true
    void syncQr().catch(() => { autoSyncStarted.current = false })
  }, [showQr, qrLink, frame.assignments])
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
      const url = qrEnabled && (await window.booth.driveStatus()).connected ? await syncQr() : null
      const dataUrl = await renderTemplate({ eventName: settings.eventName, photos: assignments.filter((photo): photo is string => Boolean(photo)), template, outputJpegQuality: settings.outputJpegQuality, photoTransforms: transforms, qr: url ? { url, placement: qrPlacement } : undefined })
      const result = await window.booth.exportImage({ eventName: settings.eventName, dataUrl })
      setOutputPath(result.outputPath)
      setStatus('done')
    } catch {
      setStatus('error')
    }
  }
  const printImage = async () => {
    if (!window.booth) { setPrintError(tr(language, 'Chỉ in được trong ứng dụng desktop.', 'Printing requires the desktop app.')); setStatus('print-error'); return }
    if (!settings.printerName || settings.printerName === 'none') { setPrintError(tr(language, 'Hãy chọn máy in trong Settings trước.', 'Select a printer in Settings first.')); setStatus('print-error'); return }
    setStatus('printing')
    setPrintError('')
    try {
      const url = qrEnabled && (await window.booth.driveStatus()).connected ? await syncQr() : null
      const output = await renderTemplate({ eventName: settings.eventName, photos: assignments.filter((photo): photo is string => Boolean(photo)), template, outputJpegQuality: settings.outputJpegQuality, photoTransforms: transforms, qr: url ? { url, placement: qrPlacement } : undefined })
      const sheet = await renderPrintSheet(output, template, settings.outputJpegQuality)
      await window.booth.printImage({ printerName: settings.printerName, dataUrl: sheet.dataUrl, width: sheet.width, height: sheet.height, ppi: template.output.ppi })
      setStatus('printed')
    } catch (error) {
      setPrintError(error instanceof Error ? error.message : String(error))
      setStatus('print-error')
    }
  }

  return <div className="quick-print-preview" role="dialog" aria-modal="true" aria-labelledby="output-editor-title">
    <header><div><p className="eyebrow">{tr(language, 'Bản ảnh cuối', 'Final image')}</p><h1 id="output-editor-title">{tr(language, 'Căn ảnh rồi xuất.', 'Adjust, then export.')}</h1></div><button onClick={onClose} aria-label={tr(language, 'Đóng', 'Close')}>×</button></header>
    <div className="quick-print-canvas">
      <FrameArtwork template={template} photos={assignments} photoTransforms={transforms} activeSlot={selectedSlot} onSlotClick={setSelectedSlot} onPhotoTransform={updateTransform} qrDataUrl={showQr ? qrPreview ?? undefined : undefined} qrPlacement={qrPlacement} onQrPlacementChange={showQr ? updateQr : undefined} language={language} />
      <p className="crop-touch-hint">{tr(language, 'Chạm một ô, rồi kéo ảnh trực tiếp để căn crop.', 'Tap a slot, then drag the photo to adjust its crop.')}</p>
    </div>
    <aside className="quick-print-controls">
      <div className="crop-control-heading"><span>{tr(language, `Ảnh ${selectedSlot + 1}`, `Photo ${selectedSlot + 1}`)}</span><strong>{tr(language, 'Kéo để căn · trượt để zoom', 'Drag to position · slide to zoom')}</strong></div>
      <label className="zoom-control"><span>{tr(language, 'Thu phóng', 'Zoom')}</span><output>{Math.round(activeTransform.scale * 100)}%</output><input type="range" min="1" max="2.5" step="0.01" value={activeTransform.scale} onChange={event => updateTransform(selectedSlot, { ...activeTransform, scale: Number(event.target.value) })} /></label>
      <button className="crop-reset" onClick={resetCrop}>{tr(language, 'Đặt lại crop', 'Reset crop')}</button>
      {showQr && <p className="qr-inline-hint">{qrBusy ? tr(language, 'Đang đồng bộ QR…', 'Syncing QR…') : tr(language, 'QR sẽ được thêm tự động. Kéo mã trên ảnh để đổi vị trí.', 'QR is added automatically. Drag it on the image to reposition.')}</p>}
      {qrError && <p className="export-error" role="alert">{qrError}</p>}
      <div className="output-primary-actions"><button className="quick-export-primary" disabled={status === 'exporting' || status === 'printing'} onClick={() => void exportImage()}>{status === 'exporting' ? tr(language, 'Đang xuất…', 'Exporting…') : tr(language, 'Xuất ảnh', 'Export image')}</button><button className="quick-print-primary" disabled={status === 'exporting' || status === 'printing'} onClick={() => void printImage()}>{status === 'printing' ? tr(language, 'Đang gửi lệnh in…', 'Sending to printer…') : tr(language, 'In ngay', 'Print now')}</button></div>
      {status === 'done' && <div className="export-success" role="status"><strong>{tr(language, 'Đã lưu và copy vào clipboard', 'Saved and copied to clipboard')}</strong><span>{outputPath}</span></div>}
      {status === 'error' && <p className="export-error" role="alert">{tr(language, 'Không thể xuất ảnh. Hãy mở bằng ứng dụng desktop rồi thử lại.', 'Could not export. Open the desktop app and try again.')}</p>}
      {status === 'printed' && <p className="export-success" role="status">{tr(language, 'Đã gửi ảnh vào hàng đợi in. Hãy kiểm tra máy in.', 'Sent to the print queue. Check the printer.')}</p>}
      {status === 'print-error' && <p className="export-error" role="alert">{printError}</p>}
      <div className="output-secondary-actions">{onSaveExit && <button onClick={onSaveExit}>{tr(language, 'Lưu & thoát', 'Save & exit')}</button>}<button onClick={onClose}>{tr(language, 'Tiếp tục chỉnh', 'Keep editing')}</button>{onDelete && <button className="quick-delete" onClick={onDelete}>{tr(language, 'Xóa frame', 'Delete frame')}</button>}</div>
    </aside>
  </div>
}
