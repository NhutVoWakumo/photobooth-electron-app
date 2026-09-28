import { useEffect, useRef, useState, type JSX } from 'react'
import { tr, type Language } from '../i18n'
import { renderPrintSheet, renderTemplate } from '../lib/renderTemplate'
import type { TemplateManifest } from '../templates'
import type { BoothSettings, PhotoTransform, SessionFrameSet } from '../types'
import { FrameArtwork } from './FrameArtwork'
import { clampFrameQrPlacement, effectiveFrameQrPlacement, type FrameQrPlacement } from '../lib/frameQr'
import type { FrameQrState } from '../hooks/useFrameQr'
import { paperSizes } from '../../../shared/printProfile'

interface Props {
  language: Language
  settings: BoothSettings
  sessionId: string
  sessionName: string
  qrEnabled: boolean
  qrPreparation: FrameQrState
  onRetryQr: () => Promise<string>
  template: TemplateManifest
  frame: SessionFrameSet
  eventPrintCount: number
  onPrinted: (copies: number) => void
  autoPrint?: boolean
  assignments: Array<string | null>
  onChange: (frame: SessionFrameSet) => void
  onClose: () => void
  onSaveExit?: () => void
  onNextFrame?: () => void
  onDelete?: () => void
}

const DEFAULT_TRANSFORM: PhotoTransform = { x: 0, y: 0, scale: 1 }

export function OutputEditor({ language, settings, sessionId, sessionName, qrEnabled, qrPreparation, onRetryQr, template, frame, eventPrintCount, onPrinted, autoPrint = false, assignments, onChange, onClose, onSaveExit, onNextFrame, onDelete }: Props): JSX.Element {
  const [selectedSlot, setSelectedSlot] = useState(0)
  const [status, setStatus] = useState<'idle' | 'exporting' | 'done' | 'error' | 'printing' | 'printed' | 'print-error'>('idle')
  const [outputPath, setOutputPath] = useState('')
  const [printError, setPrintError] = useState('')
  const [qrBusy, setQrBusy] = useState(false)
  const [qrError, setQrError] = useState('')
  const [printCopies, setPrintCopies] = useState(1)
  const [printConfirmationOpen, setPrintConfirmationOpen] = useState(false)
  const [printSubmitting, setPrintSubmitting] = useState(false)
  const autoSyncStarted = useRef(false)
  const autoPrintStarted = useRef(false)
  const printLimitReached = (frame.printCount ?? 0) >= settings.maxPrintsPerSession || eventPrintCount >= settings.maxPrintsPerEvent
  const copiesAvailable = Math.max(0, Math.min(settings.maxPrintsPerSession - (frame.printCount ?? 0), settings.maxPrintsPerEvent - eventPrintCount, 99))
  const showQr = qrEnabled && qrPreparation.status !== 'off'
  const qrPlacement = effectiveFrameQrPlacement(frame.qrPlacement, template)
  const updateQr = (next: FrameQrPlacement) => onChange({ ...frame, qrPlacement: clampFrameQrPlacement(next, template), updatedAt: new Date().toISOString() })
  const queueQrUpload = async (url: string): Promise<void> => {
    if (!window.booth) throw new Error('Drive sharing requires the desktop app.')
    setQrBusy(true); setQrError('')
    try {
      const photos = frame.assignments.map(id => frame.photos.find(photo => photo.id === id))
      if (photos.length !== template.requiredSlots || photos.some(photo => !photo)) throw new Error('Complete every photo slot first.')
      const frameName = `${template.name} · ${frame.createdAt.slice(0, 10)}`
      const finalImage = await renderTemplate({ eventName: settings.eventName, photos: photos.map(photo => photo!.dataUrl), template, outputJpegQuality: settings.outputJpegQuality, photoTransforms: transforms, qr: { url, placement: qrPlacement } })
      await window.booth.driveQueueFrame({ sessionId, sessionName, frameId: frame.id, frameName, finalImage, photos: photos.map(photo => ({ id: photo!.id, dataUrl: photo!.dataUrl })), shareFrame: true })
      void window.booth.driveProcessQueue().then(() => window.booth!.driveStatus()).then(result => { if (result.message) setQrError(result.message) }).catch(error => setQrError(error instanceof Error ? error.message : String(error)))
    } catch (error) { setQrError(error instanceof Error ? error.message : String(error)); throw error }
    finally { setQrBusy(false) }
  }
  useEffect(() => {
    if (!showQr || !qrPreparation.url || autoSyncStarted.current || frame.assignments.some(id => !id)) return
    autoSyncStarted.current = true
    void queueQrUpload(qrPreparation.url).catch(() => { autoSyncStarted.current = false })
  }, [showQr, qrPreparation.url, frame.assignments])
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
      const url = qrEnabled ? qrPreparation.url ?? await onRetryQr() : null
      const dataUrl = await renderTemplate({ eventName: settings.eventName, photos: assignments.filter((photo): photo is string => Boolean(photo)), template, outputJpegQuality: settings.outputJpegQuality, photoTransforms: transforms, qr: url ? { url, placement: qrPlacement } : undefined })
      const result = await window.booth.exportImage({ eventName: settings.eventName, dataUrl })
      setOutputPath(result.outputPath)
      setStatus('done')
      if (url) void queueQrUpload(url).catch(() => undefined)
    } catch {
      setStatus('error')
    }
  }
  const printImage = async (copies = 1) => {
    if (!window.booth) { setPrintError(tr(language, 'Chỉ in được trong ứng dụng desktop.', 'Printing requires the desktop app.')); setStatus('print-error'); return }
    if (printLimitReached) { setPrintError(tr(language, 'Đã đạt giới hạn số lượt in.', 'The print limit has been reached.')); setStatus('print-error'); return }
    if (!settings.printerName || settings.printerName === 'none') { setPrintError(tr(language, 'Hãy chọn máy in trong Settings trước.', 'Select a printer in Settings first.')); setStatus('print-error'); return }
    const profile = settings.printerProfiles?.[settings.printerName]
    if (!profile) { setPrintError(tr(language, 'Hãy chọn khổ giấy cho máy in trong Settings trước.', 'Choose the printer paper size in Settings first.')); setStatus('print-error'); return }
    setStatus('printing')
    setPrintError('')
    try {
      const url = qrEnabled ? qrPreparation.url ?? await onRetryQr() : null
      const output = await renderTemplate({ eventName: settings.eventName, photos: assignments.filter((photo): photo is string => Boolean(photo)), template, outputJpegQuality: settings.outputJpegQuality, photoTransforms: transforms, qr: url ? { url, placement: qrPlacement } : undefined })
      const sheet = await renderPrintSheet(output, template, settings.outputJpegQuality, { twoBySix: settings.printTwoBySix })
      await window.booth.printImage({ printerName: settings.printerName, dataUrl: sheet.dataUrl, width: sheet.width, height: sheet.height, ppi: sheet.ppi, profile, autoRotate: settings.autoRotatePrint, copies })
      setStatus('printed')
      onPrinted(copies)
      setPrintConfirmationOpen(false)
      if (url) void queueQrUpload(url).catch(() => undefined)
    } catch (error) {
      setPrintError(error instanceof Error ? error.message : String(error))
      setStatus('print-error')
    }
  }

  useEffect(() => {
    if (!autoPrint || autoPrintStarted.current || printLimitReached) return
    autoPrintStarted.current = true
    void printImage()
  }, [autoPrint, printLimitReached])

  const openPrintConfirmation = () => {
    if (printLimitReached || copiesAvailable < 1) return
    setPrintCopies(1)
    setPrintConfirmationOpen(true)
  }

  return <div className="quick-print-preview" role="dialog" aria-modal="true" aria-labelledby="output-editor-title">
    <header><div><p className="eyebrow">{tr(language, 'Bản ảnh cuối', 'Final image')}</p><h1 id="output-editor-title">{tr(language, 'Căn ảnh rồi xuất.', 'Adjust, then export.')}</h1></div><button onClick={onClose} aria-label={tr(language, 'Đóng', 'Close')}>×</button></header>
    <div className="quick-print-canvas">
      <FrameArtwork template={template} photos={assignments} photoTransforms={transforms} activeSlot={selectedSlot} onSlotClick={setSelectedSlot} onPhotoTransform={updateTransform} qrDataUrl={showQr ? qrPreparation.image ?? undefined : undefined} qrPlacement={qrPlacement} onQrPlacementChange={showQr ? updateQr : undefined} language={language} />
    </div>
    <aside className="quick-print-controls">
      <div className="crop-control-heading"><span>{tr(language, `Ảnh ${selectedSlot + 1}`, `Photo ${selectedSlot + 1}`)}</span><strong>{tr(language, 'Kéo để căn · trượt để zoom', 'Drag to position · slide to zoom')}</strong></div>
      <label className="zoom-control"><span>{tr(language, 'Thu phóng', 'Zoom')}</span><output>{Math.round(activeTransform.scale * 100)}%</output><input type="range" min="1" max="2.5" step="0.01" value={activeTransform.scale} onChange={event => updateTransform(selectedSlot, { ...activeTransform, scale: Number(event.target.value) })} /></label>
      <button className="crop-reset" onClick={resetCrop}>{tr(language, 'Đặt lại crop', 'Reset crop')}</button>
      {showQr && <p className="qr-inline-hint" role="status">{qrPreparation.status === 'ready' ? qrBusy ? tr(language, 'QR đã sẵn sàng · đang đưa ảnh vào hàng đợi tải lên…', 'QR ready · queueing photos for upload…') : tr(language, 'QR đã sẵn sàng. Ảnh sẽ tải lên Drive trong nền.', 'QR ready. Photos upload to Drive in the background.') : qrPreparation.status === 'error' ? tr(language, 'Không tạo được QR tự động.', 'Automatic QR preparation failed.') : tr(language, `Đang chuẩn bị QR · lần ${qrPreparation.attempts || 1}/3…`, `Preparing QR · attempt ${qrPreparation.attempts || 1}/3…`)}</p>}
      {showQr && qrPreparation.status === 'error' && <div className="qr-retry-panel" role="alert"><span>{qrPreparation.error}</span><button type="button" onClick={() => void onRetryQr().catch(() => undefined)}>{tr(language, 'Thử lại QR', 'Retry QR')}</button></div>}
      {qrError && <div className="qr-retry-panel" role="alert"><span>{qrError}</span><button type="button" onClick={() => { setQrError(''); if (qrPreparation.url) void queueQrUpload(qrPreparation.url).catch(() => undefined) }}>{tr(language, 'Tải ảnh lên lại', 'Retry upload')}</button></div>}
      <div className="output-primary-actions"><button className="quick-export-primary" disabled={status === 'exporting' || status === 'printing' || (qrEnabled && qrPreparation.status !== 'ready')} onClick={() => void exportImage()}>{status === 'exporting' ? tr(language, 'Đang xuất…', 'Exporting…') : tr(language, 'Xuất ảnh', 'Export image')}</button>{settings.showPrintButton && !(printLimitReached && settings.hidePrintButtonAfterLimit) && <button className="quick-print-primary" disabled={status === 'exporting' || status === 'printing' || printLimitReached} onClick={openPrintConfirmation}>{tr(language, 'In ảnh…', 'Print…')}</button>}</div>
      {printLimitReached && <p className="export-error" role="status">{tr(language, 'Đã đạt giới hạn in của frame hoặc sự kiện.', 'The frame or event print limit has been reached.')}</p>}
      {status === 'done' && <div className="export-success" role="status"><strong>{tr(language, 'Đã lưu và copy vào clipboard', 'Saved and copied to clipboard')}</strong><span>{outputPath}</span></div>}
      {status === 'error' && <p className="export-error" role="alert">{tr(language, 'Không thể xuất ảnh. Hãy mở bằng ứng dụng desktop rồi thử lại.', 'Could not export. Open the desktop app and try again.')}</p>}
      {status === 'printed' && <p className="export-success" role="status">{tr(language, 'Đã gửi ảnh vào hàng đợi in. Hãy kiểm tra máy in.', 'Sent to the print queue. Check the printer.')}</p>}
      {status === 'print-error' && <p className="export-error" role="alert">{printError}</p>}
      <div className="output-secondary-actions">{onNextFrame && <button onClick={onNextFrame}>{tr(language, 'Chụp frame tiếp →', 'Capture next frame →')}</button>}{onSaveExit && <button onClick={onSaveExit}>{tr(language, 'Lưu & thoát', 'Save & exit')}</button>}<button onClick={onClose}>{tr(language, 'Tiếp tục chỉnh', 'Keep editing')}</button>{onDelete && <button className="quick-delete" onClick={onDelete}>{tr(language, 'Xóa frame', 'Delete frame')}</button>}</div>
    </aside>
    {printConfirmationOpen && <div className="print-confirm-overlay" role="dialog" aria-modal="true" aria-labelledby="print-confirm-title"><button className="print-confirm-close" type="button" onClick={() => setPrintConfirmationOpen(false)} aria-label={tr(language, 'Đóng', 'Close')}>×</button><div className="print-confirm-art"><FrameArtwork template={template} photos={assignments} photoTransforms={transforms} qrDataUrl={showQr ? qrPreparation.image ?? undefined : undefined} qrPlacement={qrPlacement} language={language} /></div><aside className="print-confirm-panel"><p className="eyebrow">{tr(language, 'Xác nhận máy in', 'Print confirmation')}</p><h2 id="print-confirm-title">{tr(language, 'In ảnh này?', 'Print this photo?')}</h2><p>{tr(language, `Máy in: ${settings.printerName}`, `Printer: ${settings.printerName}`)}</p><p>{tr(language, `Khổ giấy: ${profilePaper(settings)}`, `Paper: ${profilePaper(settings)}`)}</p><div className="print-copy-stepper" aria-label={tr(language, 'Số bản in', 'Number of copies')}><button type="button" disabled={printCopies <= 1 || printSubmitting} onClick={() => setPrintCopies(value => Math.max(1, value - 1))} aria-label={tr(language, 'Giảm số bản', 'Decrease copies')}>−</button><output aria-live="polite">{printCopies}<small>{tr(language, 'bản', 'copies')}</small></output><button type="button" disabled={printCopies >= copiesAvailable || printSubmitting} onClick={() => setPrintCopies(value => Math.min(copiesAvailable, value + 1))} aria-label={tr(language, 'Tăng số bản', 'Increase copies')}>＋</button></div><p className="print-quota-note">{tr(language, `Còn ${copiesAvailable} bản theo giới hạn bộ ảnh/sự kiện.`, `${copiesAvailable} copies remain within the photo-set and event limits.`)}</p>{printError && <p className="export-error" role="alert">{printError}</p>}<div className="print-confirm-actions"><button type="button" onClick={() => setPrintConfirmationOpen(false)} disabled={printSubmitting}>{tr(language, 'Hủy', 'Cancel')}</button><button type="button" onClick={() => { setPrintSubmitting(true); void printImage(printCopies).finally(() => setPrintSubmitting(false)) }} disabled={printSubmitting || printCopies > copiesAvailable}>{printSubmitting ? tr(language, 'Đang gửi lệnh…', 'Sending…') : tr(language, `Chốt in · ${printCopies} bản`, `Confirm print · ${printCopies}`)}</button></div></aside></div>}
  </div>
}

function profilePaper(settings: BoothSettings): string {
  const paper = settings.printerProfiles?.[settings.printerName]?.paper
  return paper ? paperSizes[paper].label : '—'
}
