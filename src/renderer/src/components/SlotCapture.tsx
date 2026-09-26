import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type JSX } from 'react'
import type { CameraState } from '../hooks/useCamera'
import { tr, type Language } from '../i18n'
import type { TemplateManifest } from '../templates'
import type { BoothSettings, SessionFrameSet } from '../types'
import { FrameArtwork } from './FrameArtwork'
import { OutputEditor } from './OutputEditor'
import { encodeCapturedCanvas } from '../lib/captureEncoding'

interface Props {
  camera: CameraState; language: Language; settings: BoothSettings; template: TemplateManifest
  frame: SessionFrameSet; initialSlot: number
  onAccept: (photo: string, preview: string, aspectRatio: number, slotIndex: number) => void
  onChange: (frame: SessionFrameSet) => void; onDelete: () => void; onCancel: () => void
}

export function SlotCapture({ camera, language, settings, template, frame, initialSlot, onAccept, onChange, onDelete, onCancel }: Props): JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null)
  const mountedRef = useRef(false)
  const timerRef = useRef<number | null>(null)
  const reviewTimerRef = useRef<number | null>(null)
  const captureQueueRef = useRef<number[]>([])
  const [selectedSlot, setSelectedSlot] = useState(initialSlot)
  const [view, setView] = useState<'camera' | 'photo'>('camera')
  const [countdown, setCountdown] = useState<number | null>(null)
  const [resolution, setResolution] = useState({ width: 0, height: 0 })
  const [printPreview, setPrintPreview] = useState(false)
  const [sequenceRunning, setSequenceRunning] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [captureError, setCaptureError] = useState('')
  const [reviewImage, setReviewImage] = useState<string | null>(null)
  const assignments = useMemo(() => frame.assignments.map(id => frame.photos.find(photo => photo.id === id)?.dataUrl ?? null), [frame])
  const previews = useMemo(() => frame.assignments.map(id => { const photo = frame.photos.find(item => item.id === id); return photo?.previewDataUrl ?? photo?.dataUrl ?? null }), [frame])
  const filled = assignments.filter(Boolean).length
  const complete = filled === template.requiredSlots
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
      if (timerRef.current !== null) window.clearInterval(timerRef.current)
      if (reviewTimerRef.current !== null) window.clearTimeout(reviewTimerRef.current)
    }
  }, [])

  async function captureSlot(slotIndex: number) {
    const video = videoRef.current
    if (!video?.videoWidth || !video.videoHeight) { setSequenceRunning(false); setCaptureError(tr(language, 'Camera chưa sẵn sàng. Hãy thử lại.', 'Camera is not ready. Please try again.')); return }
    setProcessing(true)
    setCaptureError('')
    try {
    const targetSlot = template.slots[slotIndex]
    const targetRatio = (targetSlot.width * template.output.width) / (targetSlot.height * template.output.height)
    const sourceAspect = video.videoWidth / video.videoHeight
    let sx = 0; let sy = 0; let sourceWidth = video.videoWidth; let sourceHeight = video.videoHeight
    if (sourceAspect > targetRatio) { sourceWidth = video.videoHeight * targetRatio; sx = (video.videoWidth - sourceWidth) / 2 }
    else { sourceHeight = video.videoWidth / targetRatio; sy = (video.videoHeight - sourceHeight) / 2 }
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(sourceWidth)); canvas.height = Math.max(1, Math.round(sourceHeight))
    const context = canvas.getContext('2d', { alpha: false })
    if (!context) throw new Error('Canvas is unavailable.')
    if (settings.mirrorCamera) { context.translate(canvas.width, 0); context.scale(-1, 1) }
    context.drawImage(video, sx, sy, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height)
    const { dataUrl, previewDataUrl: preview } = await encodeCapturedCanvas(canvas, settings.captureJpegQuality)
    if (!mountedRef.current) return
    video.pause()
    setReviewImage(preview)
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
    setReviewImage(null)
    void videoRef.current?.play().catch(() => undefined)
    setSelectedSlot(slotIndex)
    setView('camera')
    let remaining = settings.countdownSeconds
    if (remaining <= 0) { captureSlot(slotIndex); return }
    setCountdown(remaining)
    timerRef.current = window.setInterval(() => {
      remaining -= 1
      if (remaining <= 0) { if (timerRef.current !== null) window.clearInterval(timerRef.current); timerRef.current = null; setCountdown(null); captureSlot(slotIndex) }
      else setCountdown(remaining)
    }, 1000)
  }
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
  const cropWidth = resolution.width && resolution.height ? Math.round(Math.min(resolution.width, resolution.height * aspectRatio)) : 0
  const cropHeight = resolution.width && resolution.height ? Math.round(Math.min(resolution.height, resolution.width / aspectRatio)) : 0

  return <section className="capture-workstation" aria-label={tr(language, 'Trạm chụp ảnh', 'Capture workstation')}>
    <header className="workstation-topbar"><button className="workstation-exit" onClick={onCancel}>← {tr(language, 'Phiên chụp', 'Session')}</button><div><strong>{template.name}</strong><span>{filled}/{template.requiredSlots} {tr(language, 'ảnh', 'photos')}</span></div></header>
    <aside className="capture-rail" aria-label={tr(language, 'Ảnh trong frame', 'Frame photos')}>
      <button className={`rail-live ${view === 'camera' ? 'active' : ''}`} onClick={() => { setView('camera'); void videoRef.current?.play().catch(() => undefined) }}><span aria-hidden="true">●</span>{tr(language, 'Camera', 'Live')}</button>
      <div className="capture-thumbnails">{template.slots.map((item, index) => <button className={`capture-thumbnail ${selectedSlot === index ? 'active' : ''}`} key={item.id} onClick={() => selectSlot(index)} aria-label={tr(language, `Xem ảnh ${index + 1}`, `View photo ${index + 1}`)}><span>{String(index + 1).padStart(2, '0')}</span><div style={{ aspectRatio: (item.width * template.output.width) / (item.height * template.output.height) }}>{previews[index] ? <img src={previews[index]!} alt="" /> : <i>＋</i>}</div></button>)}</div>
    </aside>
    <main className="capture-focus"><div className="workstation-viewfinder" style={{ aspectRatio, '--capture-ratio': aspectRatio } as CSSProperties}>
      <video ref={attachVideo} onLoadedMetadata={updateResolution} className={`camera-video ${settings.mirrorCamera ? 'mirrored' : ''}`} autoPlay muted playsInline />
      {view === 'photo' && (reviewImage || previews[selectedSlot]) && <img className="capture-review-photo" src={reviewImage || previews[selectedSlot]!} alt={tr(language, `Ảnh ${selectedSlot + 1}`, `Photo ${selectedSlot + 1}`)} />}
      {!camera.stream && <p className="camera-note">{tr(language, 'Không có tín hiệu camera.', 'Camera is not available.')}</p>}
      {countdown !== null && <strong className="countdown" aria-live="assertive">{countdown}</strong>}
      <span className="workstation-badge">{view === 'photo' ? tr(language, `Ảnh ${selectedSlot + 1}`, `Photo ${selectedSlot + 1}`) : resolution.width ? `${cropWidth} × ${cropHeight} · ${aspectRatio.toFixed(2)}:1` : `${aspectRatio.toFixed(2)}:1`}</span>
      {view === 'photo' && <button className="back-to-live" onClick={() => { setView('camera'); void videoRef.current?.play().catch(() => undefined) }}>{tr(language, 'Quay lại camera', 'Back to camera')}</button>}
    </div></main>
    <aside className="capture-actions">
      <div className="active-slot-label"><span>{tr(language, 'Đang chọn', 'Selected')}</span><strong>{tr(language, `Ảnh ${selectedSlot + 1}`, `Photo ${selectedSlot + 1}`)}</strong></div>
      <button className="workstation-capture" disabled={!camera.stream || sequenceRunning || (complete && !selectedPhoto)} onClick={startSequence}><span aria-hidden="true" />{processing ? tr(language, 'Đang xử lý…', 'Processing…') : countdown !== null ? countdown : sequenceRunning ? view === 'photo' ? tr(language, 'Đang xem', 'Reviewing') : tr(language, 'Đang chụp', 'Capturing') : selectedPhoto ? tr(language, 'Chụp lại', 'Retake') : tr(language, 'Chụp', 'Capture')}</button>
      <button className="workstation-print" disabled={!complete} onClick={() => setPrintPreview(true)}>{tr(language, 'Xem & in', 'Review & print')}<small>{complete ? tr(language, 'Frame đã sẵn sàng', 'Frame is ready') : tr(language, `Còn ${template.requiredSlots - filled} ảnh`, `${template.requiredSlots - filled} photos left`)}</small></button>
    </aside>
    {captureError ? <p className="camera-source-hint" role="alert">{captureError}</p> : looksLikeScreenCapture && <p className="camera-source-hint" role="status">{tr(language, 'Nếu ảnh bị lặp cửa sổ hoặc dính chữ, hãy chọn Virtual Camera của webcam, không chọn Screen / Display Capture.', 'If the photo repeats app windows or text, choose the webcam Virtual Camera output—not Screen / Display Capture.')}</p>}
    {printPreview && <OutputEditor language={language} settings={settings} template={template} frame={frame} assignments={assignments} onChange={onChange} onClose={() => setPrintPreview(false)} onSaveExit={onCancel} onDelete={onDelete} />}
  </section>
}
