import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type JSX } from 'react'
import type { CameraState } from '../hooks/useCamera'
import { tr, type Language } from '../i18n'
import type { TemplateManifest } from '../templates'
import type { BoothSettings, SessionFrameSet } from '../types'
import { FrameArtwork } from './FrameArtwork'
import { OutputEditor } from './OutputEditor'
import { encodeCapturedCanvas } from '../lib/captureEncoding'
import { useFrameQr } from '../hooks/useFrameQr'
import { renderTemplate } from '../lib/renderTemplate'
import { effectiveFrameQrPlacement } from '../lib/frameQr'
import { photoEffectFilter } from '../lib/photoEffect'

interface Props {
  camera: CameraState; language: Language; settings: BoothSettings; template: TemplateManifest
  sessionId: string; sessionName: string; qrEnabled: boolean; frame: SessionFrameSet; controlsPosition: 'bottom' | 'left' | 'right'; eventPrintCount: number; onPrinted: (copies: number) => void; initialSlot: number
  onAccept: (photo: string, preview: string, aspectRatio: number, slotIndex: number) => void
  onChange: (frame: SessionFrameSet) => void; onDelete: () => void; onCancel: () => void; onNextFrame: () => void
  onRetryCamera: () => void
}

export function SlotCapture({ camera, language, settings, template, sessionId, sessionName, qrEnabled, frame, controlsPosition, eventPrintCount, onPrinted, initialSlot, onAccept, onChange, onDelete, onCancel, onNextFrame, onRetryCamera }: Props): JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null)
  const mountedRef = useRef(false)
  const timerRef = useRef<number | null>(null)
  const reviewTimerRef = useRef<number | null>(null)
  const captureQueueRef = useRef<number[]>([])
  const slotDragRef = useRef<{ pointerId: number; source: number; x: number; y: number } | null>(null)
  const queuedFrameRef = useRef(false)
  const suppressSlotClick = useRef(false)
  const [selectedSlot, setSelectedSlot] = useState(initialSlot)
  const [view, setView] = useState<'camera' | 'photo'>('camera')
  const [countdown, setCountdown] = useState<number | null>(null)
  const [countdownDeadline, setCountdownDeadline] = useState<number | null>(null)
  const [countdownTargetSlot, setCountdownTargetSlot] = useState<number | null>(null)
  const [resolution, setResolution] = useState({ width: 0, height: 0 })
  const [printPreview, setPrintPreview] = useState(false)
  const [previewRailOpen, setPreviewRailOpen] = useState(false)
  const [sequenceRunning, setSequenceRunning] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [captureError, setCaptureError] = useState('')
  const [reviewImage, setReviewImage] = useState<string | null>(null)
  const [awaitingManualTrigger, setAwaitingManualTrigger] = useState(false)
  const autoPrintOpened = useRef(false)
  const autoSequenceStarted = useRef(false)
  const { qr, retry: retryQr } = useFrameQr(sessionId, sessionName, frame.id, `${template.name} · ${frame.createdAt.slice(0, 10)}`, qrEnabled)
  const assignments = useMemo(() => frame.assignments.map(id => frame.photos.find(photo => photo.id === id)?.dataUrl ?? null), [frame])
  const previews = useMemo(() => frame.assignments.map(id => { const photo = frame.photos.find(item => item.id === id); return photo?.previewDataUrl ?? photo?.dataUrl ?? null }), [frame])
  const filled = assignments.filter(Boolean).length
  const complete = filled === template.requiredSlots
  useEffect(() => {
    if (!complete || !settings.printAutomatically || autoPrintOpened.current) return
    autoPrintOpened.current = true
    setPrintPreview(true)
  }, [complete, settings.printAutomatically])
  useEffect(() => {
    if (!complete || !qrEnabled || !qr.url || queuedFrameRef.current || !window.booth) return
    queuedFrameRef.current = true
    const photos = frame.assignments.map(id => frame.photos.find(photo => photo.id === id))
    if (photos.some(photo => !photo)) { queuedFrameRef.current = false; return }
    const frameName = `${template.name} · ${frame.createdAt.slice(0, 10)}`
    void (async () => {
      const finalImage = await renderTemplate({ eventName: settings.eventName, photos: photos.map(photo => photo!.dataUrl), template, outputJpegQuality: settings.outputJpegQuality, photoTransforms: frame.slotTransforms, qr: { url: qr.url!, placement: effectiveFrameQrPlacement(frame.qrPlacement, template) } })
      await window.booth!.driveQueueFrame({ sessionId, sessionName, frameId: frame.id, frameName, finalImage, photos: photos.map(photo => ({ id: photo!.id, dataUrl: photo!.dataUrl })), shareFrame: true })
      void window.booth!.driveProcessQueue()
    })().catch(() => { queuedFrameRef.current = false })
  }, [complete, qr.url, qrEnabled, frame.assignments, frame.photos, frame.qrPlacement, frame.slotTransforms, sessionId, sessionName, template, settings.eventName, settings.outputJpegQuality])
  const selectedPhoto = assignments[selectedSlot]
  const slot = template.slots[selectedSlot]
  const aspectRatio = (slot.width * template.output.width) / (slot.height * template.output.height)
  const looksLikeScreenCapture = /screen|display|capture|obs|ndi|manycam|snap camera|virtual/i.test(settings.cameraName)

  const updateResolution = useCallback(() => {
    const video = videoRef.current
    if (video?.videoWidth && video.videoHeight) setResolution({ width: video.videoWidth, height: video.videoHeight })
  }, [])
  const attachVideo = useCallback((video: HTMLVideoElement | null) => {
    videoRef.current = video
    if (!video || !camera.stream) return
    video.srcObject = camera.stream
    void video.play().then(updateResolution).catch(() => undefined)
  }, [camera.stream, updateResolution])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !camera.stream) return
    video.srcObject = camera.stream
    void video.play().then(updateResolution).catch(() => undefined)
    video.addEventListener('loadedmetadata', updateResolution)
    video.addEventListener('resize', updateResolution)
    return () => { video.removeEventListener('loadedmetadata', updateResolution); video.removeEventListener('resize', updateResolution) }
  }, [camera.stream, updateResolution])
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
      if (reviewTimerRef.current !== null) window.clearTimeout(reviewTimerRef.current)
      // React StrictMode replays effects in development. Reset this guard when
      // that replay clears the first countdown, otherwise it stays marked as
      // started and the second effect setup never starts a new timer.
      autoSequenceStarted.current = false
    }
  }, [])

  async function captureSlot(slotIndex: number) {
    const video = videoRef.current
    if (!video?.videoWidth || !video.videoHeight || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || camera.stream?.getVideoTracks()[0]?.readyState !== 'live') { setSequenceRunning(false); setCaptureError(tr(language, 'Camera chưa sẵn sàng. Hãy thử lại.', 'Camera is not ready. Please try again.')); return }
    setProcessing(true)
    setCaptureError('')
    try {
    const targetSlot = template.slots[slotIndex]
    const targetRatio = (targetSlot.width * template.output.width) / (targetSlot.height * template.output.height)
    const sourceAspect = video.videoWidth / video.videoHeight
    let sourceCanvas: CanvasImageSource = video
    let sourceWidth = video.videoWidth; let sourceHeight = video.videoHeight
    if (settings.cameraRotation !== 0) {
      const rotated = document.createElement('canvas')
      const quarterTurn = settings.cameraRotation === 90 || settings.cameraRotation === 270
      rotated.width = quarterTurn ? video.videoHeight : video.videoWidth
      rotated.height = quarterTurn ? video.videoWidth : video.videoHeight
      const rotatedContext = rotated.getContext('2d', { alpha: false })
      if (!rotatedContext) throw new Error('Could not rotate the camera image.')
      rotatedContext.translate(rotated.width / 2, rotated.height / 2)
      rotatedContext.rotate(settings.cameraRotation * Math.PI / 180)
      rotatedContext.drawImage(video, -video.videoWidth / 2, -video.videoHeight / 2)
      sourceCanvas = rotated; sourceWidth = rotated.width; sourceHeight = rotated.height
    }
    let sx = 0; let sy = 0
    if (sourceAspect > targetRatio) { sourceWidth = video.videoHeight * targetRatio; sx = (video.videoWidth - sourceWidth) / 2 }
    else { sourceHeight = video.videoWidth / targetRatio; sy = (video.videoHeight - sourceHeight) / 2 }
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(sourceWidth)); canvas.height = Math.max(1, Math.round(sourceHeight))
    const context = canvas.getContext('2d', { alpha: false })
    if (!context) throw new Error('Canvas is unavailable.')
    context.filter = photoEffectFilter(settings.photoEffect)
    if (settings.mirrorCamera) { context.translate(canvas.width, 0); context.scale(-1, 1) }
    context.drawImage(sourceCanvas, sx, sy, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height)
    const { dataUrl, previewDataUrl: preview } = await encodeCapturedCanvas(canvas, settings.captureJpegQuality)
    if (!mountedRef.current) return
    // The review fills the viewfinder; a 480px thumbnail looks visibly soft here.
    // Keep the small preview only for the thumbnail rail and persistence UI.
    setReviewImage(dataUrl)
    setView('photo')
    onAccept(dataUrl, preview, targetRatio, slotIndex)
    setSelectedSlot(slotIndex)
    setProcessing(false)
    reviewTimerRef.current = window.setTimeout(() => {
      reviewTimerRef.current = null
      const nextSlot = captureQueueRef.current.shift()
      if (nextSlot !== undefined) runCountdown(nextSlot)
      else setSequenceRunning(false)
    }, settings.postCaptureReviewMs)
    } catch (error) {
      if (!mountedRef.current) return
      setProcessing(false)
      setSequenceRunning(false)
      setCaptureError(error instanceof Error ? error.message : tr(language, 'Không thể lưu ảnh chụp.', 'Could not capture the photo.'))
    }
  }

  function runCountdown(slotIndex: number) {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    timerRef.current = null
    setReviewImage(null)
    setAwaitingManualTrigger(false)
    void videoRef.current?.play().catch(() => undefined)
    setSelectedSlot(slotIndex)
    setView('camera')
    const isFirstPhoto = frame.photos.length === 0 && slotIndex === initialSlot
    let remaining = isFirstPhoto ? settings.firstPhotoCountdownSeconds : settings.nextPhotoCountdownSeconds
    if (remaining <= 0) {
      setCountdownDeadline(null)
      setCountdownTargetSlot(null)
      if (settings.autoTriggerAfterCountdown) void captureSlot(slotIndex)
      else { setCountdown(0); setAwaitingManualTrigger(true) }
      return
    }
    remaining = Math.max(1, Math.min(30, Math.round(remaining)))
    setCountdown(remaining)
    setCountdownTargetSlot(slotIndex)
    setCountdownDeadline(Date.now() + remaining * 1000)
  }
  useEffect(() => {
    if (countdownDeadline === null || countdownTargetSlot === null) return
    let cancelled = false
    const tick = () => {
      if (cancelled) return
      const millisecondsLeft = countdownDeadline - Date.now()
      const secondsLeft = Math.max(0, Math.ceil(millisecondsLeft / 1000))
      if (secondsLeft === 0) {
        timerRef.current = null
        setCountdownDeadline(null)
        setCountdownTargetSlot(null)
        if (settings.autoTriggerAfterCountdown) {
          setCountdown(null)
          void captureSlot(countdownTargetSlot)
        } else {
          setCountdown(0)
          setAwaitingManualTrigger(true)
        }
        return
      }
      setCountdown(current => current === secondsLeft ? current : secondsLeft)
      const untilNextSecond = millisecondsLeft - (secondsLeft - 1) * 1000
      timerRef.current = window.setTimeout(tick, Math.max(25, untilNextSecond))
    }
    tick()
    return () => {
      cancelled = true
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [countdownDeadline, countdownTargetSlot, settings.autoTriggerAfterCountdown])
  useEffect(() => {
    const video = videoRef.current
    if (!settings.autoTriggerAfterCountdown || !camera.stream || !video || autoSequenceStarted.current) return

    // A MediaStream can exist before the <video> has decoded its first frame.
    // Starting the countdown at that point can make the first automatic shot
    // fail (or appear to do nothing) on slower cameras and virtual webcams.
    const startWhenReady = () => {
      if (autoSequenceStarted.current || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return
      if (camera.stream?.getVideoTracks()[0]?.readyState !== 'live') return
      autoSequenceStarted.current = true
      captureQueueRef.current = template.slots.map((_, index) => index).filter(index => index !== initialSlot && !frame.assignments[index])
      setSequenceRunning(true)
      runCountdown(initialSlot)
    }

    video.addEventListener('loadeddata', startWhenReady)
    video.addEventListener('canplay', startWhenReady)
    video.addEventListener('playing', startWhenReady)
    startWhenReady()
    return () => {
      video.removeEventListener('loadeddata', startWhenReady)
      video.removeEventListener('canplay', startWhenReady)
      video.removeEventListener('playing', startWhenReady)
    }
  }, [camera.stream, settings.autoTriggerAfterCountdown, template.slots, initialSlot, frame.assignments])
  const startSequence = () => {
    // A complete frame can still retake the currently selected slot. Only
    // block capture when every slot is filled and the selected slot is empty
    // (which is not a valid state), or while another sequence is running.
    if (!camera.stream || sequenceRunning || (complete && !selectedPhoto)) return
    captureQueueRef.current = template.slots
      .map((_, index) => index)
      .filter(index => index !== selectedSlot && !frame.assignments[index])
    setSequenceRunning(true)
    runCountdown(selectedSlot)
  }
  const selectSlot = (index: number) => { setReviewImage(null); setSelectedSlot(index); const nextView = assignments[index] ? 'photo' : 'camera'; setView(nextView); if (nextView === 'camera') void videoRef.current?.play().catch(() => undefined) }
  const swapSlots = (source: number, target: number) => {
    if (source === target || !frame.assignments[source] || sequenceRunning) return
    const sourceSlot = template.slots[source]
    const targetSlot = template.slots[target]
    const sourceRatio = sourceSlot.width / sourceSlot.height
    const targetRatio = targetSlot.width / targetSlot.height
    if (Math.abs(sourceRatio - targetRatio) / targetRatio > .01) {
      setCaptureError(tr(language, 'Hai ô có tỷ lệ khác nhau. Hãy chụp riêng để ảnh không bị cắt.', 'These slots have different ratios. Capture each separately to avoid cropping.'))
      return
    }
    const next = [...frame.assignments]
    ;[next[source], next[target]] = [next[target], next[source]]
    onChange({ ...frame, assignments: next, updatedAt: new Date().toISOString() })
    setSelectedSlot(target)
    setCaptureError('')
  }
  const cropWidth = resolution.width && resolution.height ? Math.round(Math.min(resolution.width, resolution.height * aspectRatio)) : 0
  const cropHeight = resolution.width && resolution.height ? Math.round(Math.min(resolution.height, resolution.width / aspectRatio)) : 0

  return <section className="capture-workstation" data-controls-position={controlsPosition} aria-label={tr(language, 'Trạm chụp ảnh', 'Capture workstation')}>
    <header className="workstation-topbar"><button className="workstation-exit" onClick={onCancel}>← {tr(language, 'Phiên chụp', 'Session')}</button><div><strong>{template.name}</strong><span>{filled}/{template.requiredSlots} {tr(language, 'ảnh', 'photos')}</span></div></header>
    {previewRailOpen && <button className="capture-rail-scrim" type="button" aria-label={tr(language, 'Đóng danh sách ảnh', 'Close photo list')} onClick={() => setPreviewRailOpen(false)} />}
    {previewRailOpen && <aside className="capture-rail" id="capture-photo-rail" aria-label={tr(language, 'Ảnh trong frame', 'Frame photos')}>
      <div className="capture-rail-heading"><strong>{tr(language, 'Ảnh trong frame', 'Frame photos')}</strong><button type="button" onClick={() => setPreviewRailOpen(false)} aria-label={tr(language, 'Đóng danh sách ảnh', 'Close photo list')}>×</button></div>
      <button className={`rail-live ${view === 'camera' ? 'active' : ''}`} onClick={() => { setView('camera'); void videoRef.current?.play().catch(() => undefined) }}><span aria-hidden="true">●</span>{tr(language, 'Camera', 'Live')}</button>
      <div className="capture-thumbnails">{template.slots.map((item, index) => <button className={`capture-thumbnail ${selectedSlot === index ? 'active' : ''}`} key={item.id} data-slot-index={index} draggable={Boolean(frame.assignments[index]) && !sequenceRunning} onDragStart={event => event.dataTransfer.setData('text/luma-slot-index', String(index))} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); const source = Number(event.dataTransfer.getData('text/luma-slot-index')); if (Number.isInteger(source)) swapSlots(source, index) }} onPointerDown={event => { if (!(event.target instanceof HTMLElement) || !event.target.closest('.capture-slot-grip') || !frame.assignments[index] || sequenceRunning) return; event.currentTarget.setPointerCapture(event.pointerId); slotDragRef.current = { pointerId: event.pointerId, source: index, x: event.clientX, y: event.clientY } }} onPointerUp={event => { const drag = slotDragRef.current; if (!drag || drag.pointerId !== event.pointerId) return; slotDragRef.current = null; if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 12) return; suppressSlotClick.current = true; const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-slot-index]'); if (target) swapSlots(drag.source, Number(target.dataset.slotIndex)) }} onPointerCancel={() => { slotDragRef.current = null }} onClick={() => { if (suppressSlotClick.current) { suppressSlotClick.current = false; return } selectSlot(index) }} aria-label={tr(language, `Xem ảnh ${index + 1}; kéo số để đổi vị trí`, `View photo ${index + 1}; drag number to reorder`)}><span className="capture-slot-grip" aria-hidden="true">{String(index + 1).padStart(2, '0')}<small>⠿</small></span><div style={{ aspectRatio: (item.width * template.output.width) / (item.height * template.output.height) }}>{previews[index] ? <img src={previews[index]!} alt="" /> : <i>＋</i>}</div></button>)}</div>
    </aside>}
    <main className="capture-focus"><div className="workstation-viewfinder" style={{ aspectRatio, '--capture-ratio': aspectRatio } as CSSProperties}>
      <video ref={attachVideo} onLoadedMetadata={updateResolution} className="camera-video" style={{ filter: photoEffectFilter(settings.photoEffect), transform: `rotate(${settings.cameraRotation}deg) ${settings.mirrorLiveView ? 'scaleX(-1)' : ''}`, visibility: settings.liveViewEnabled ? 'visible' : 'hidden' }} autoPlay muted playsInline />
      {!settings.liveViewEnabled && <div className="live-view-disabled">{tr(language, 'Xem trước camera đang tắt', 'Live view is disabled')}</div>}
      {view === 'photo' && (reviewImage || assignments[selectedSlot]) && <img className="capture-review-photo" src={reviewImage || assignments[selectedSlot]!} alt={tr(language, `Ảnh ${selectedSlot + 1}`, `Photo ${selectedSlot + 1}`)} />}
      {!camera.stream && <div className="workstation-camera-recovery" role="alert"><strong>{camera.status === 'requesting' ? tr(language, 'Đang kết nối camera…', 'Connecting to camera…') : tr(language, 'Camera chưa sẵn sàng', 'Camera is not ready')}</strong><p>{camera.errorCode === 'permissionDenied' ? tr(language, 'Hãy cấp quyền camera cho LUMA Booth trong cài đặt hệ điều hành, rồi thử lại.', 'Allow LUMA Booth to use the camera in system settings, then retry.') : camera.errorCode === 'notFound' ? tr(language, 'Không tìm thấy camera. Kiểm tra kết nối hoặc bật webcam rồi thử lại.', 'No camera found. Check the connection or turn on the webcam, then retry.') : camera.errorCode === 'unsupported' ? tr(language, 'Môi trường này không hỗ trợ camera.', 'Camera access is unsupported in this environment.') : tr(language, 'Không mở được camera đã chọn. App sẽ tự thử camera khác khi bạn kết nối lại.', 'Could not open the selected camera. The app will try another available camera when you retry.')}</p>{camera.status !== 'requesting' && <button type="button" onClick={onRetryCamera}>{tr(language, 'Thử kết nối lại', 'Retry camera')}</button>}</div>}
      {countdown !== null && !awaitingManualTrigger && <strong className="countdown" aria-live="assertive">{countdown}</strong>}
      <span className="workstation-badge">{view === 'photo' ? tr(language, `Ảnh ${selectedSlot + 1}`, `Photo ${selectedSlot + 1}`) : resolution.width ? `${cropWidth} × ${cropHeight} · ${aspectRatio.toFixed(2)}:1` : `${aspectRatio.toFixed(2)}:1`}</span>
      {view === 'photo' && <button className="back-to-live" onClick={() => { setView('camera'); void videoRef.current?.play().catch(() => undefined) }}>{tr(language, 'Quay lại camera', 'Back to camera')}</button>}
    </div></main>
    <aside className="capture-actions" data-position={controlsPosition} aria-label={tr(language, 'Thao tác chụp và in', 'Capture and print actions')}>
      <button className="capture-rail-toggle" type="button" aria-expanded={previewRailOpen} aria-controls="capture-photo-rail" onClick={() => setPreviewRailOpen(value => !value)} aria-label={tr(language, `Danh sách ảnh, ${filled} trên ${template.requiredSlots}`, `Photo list, ${filled} of ${template.requiredSlots}`)}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 4v16M10.5 9h7M10.5 12h7M10.5 15h5"/></svg><span>{tr(language, 'Danh sách', 'List')}</span><strong>{filled}/{template.requiredSlots}</strong></button>
      <button className="workstation-capture" disabled={!camera.stream || (sequenceRunning && !awaitingManualTrigger) || (complete && !selectedPhoto)} onClick={awaitingManualTrigger ? () => { setAwaitingManualTrigger(false); setCountdown(null); void captureSlot(selectedSlot) } : startSequence}><span aria-hidden="true" />{processing ? tr(language, 'Đang xử lý…', 'Processing…') : awaitingManualTrigger ? tr(language, 'Chụp ngay', 'Take photo') : countdown !== null ? countdown : sequenceRunning ? view === 'photo' ? tr(language, 'Đang xem', 'Reviewing') : tr(language, 'Đang chụp', 'Capturing') : selectedPhoto ? tr(language, 'Chụp lại', 'Retake') : tr(language, 'Chụp', 'Capture')}</button>
      <button className="workstation-print" disabled={!complete} onClick={() => setPrintPreview(true)}><span aria-hidden="true">▧</span><strong>{settings.showPrintButton ? tr(language, 'In', 'Print') : tr(language, 'Xuất', 'Export')}</strong><small>{complete ? tr(language, 'Sẵn sàng', 'Ready') : `${filled}/${template.requiredSlots}`}</small></button>
    </aside>
    {captureError ? <p className="camera-source-hint" role="alert">{captureError}</p> : looksLikeScreenCapture && <p className="camera-source-hint" role="status">{tr(language, 'Nếu ảnh bị lặp cửa sổ hoặc dính chữ, hãy chọn Virtual Camera của webcam, không chọn Screen / Display Capture.', 'If the photo repeats app windows or text, choose the webcam Virtual Camera output—not Screen / Display Capture.')}</p>}
    {printPreview && <OutputEditor language={language} settings={settings} sessionId={sessionId} sessionName={sessionName} qrEnabled={qrEnabled} qrPreparation={qr} onRetryQr={retryQr} template={template} frame={frame} eventPrintCount={eventPrintCount} onPrinted={onPrinted} autoPrint={settings.printAutomatically} assignments={assignments} onChange={onChange} onClose={() => setPrintPreview(false)} onSaveExit={onCancel} onNextFrame={onNextFrame} onDelete={onDelete} />}
  </section>
}
