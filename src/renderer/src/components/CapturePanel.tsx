import { useCallback, useEffect, useRef, useState, type JSX } from 'react'
import type { CameraState } from '../hooks/useCamera'
import { getTemplateCopy, type TemplateManifest } from '../templates'
import type { BoothSettings, BoothStage } from '../types'
import { FrameArtwork } from './FrameArtwork'
import { SelectionBoard } from './SelectionBoard'
import { StripPreview } from './StripPreview'
import { BrandLogo } from './BrandLogo'
import { t, tr } from '../i18n'

interface CapturePanelProps {
  camera: CameraState & { startCamera: (preferredId?: string) => Promise<unknown> }
  sessionKey: number
  stage: BoothStage
  settings: BoothSettings
  template: TemplateManifest
  onBegin: () => void
  onRestart: () => void
  onStageChange: (stage: BoothStage) => void
}

export function CapturePanel(props: CapturePanelProps): JSX.Element {
  const { camera, sessionKey, stage, settings, template, onBegin, onRestart, onStageChange } = props
  const videoRef = useRef<HTMLVideoElement>(null)
  const captureInFlightRef = useRef(false)
  const [countdown, setCountdown] = useState(settings.countdownSeconds)
  const [captures, setCaptures] = useState<string[]>([])
  const [assignedPhotos, setAssignedPhotos] = useState<Array<string | null>>([])
  const [pendingPhoto, setPendingPhoto] = useState<string | null>(null)
  const [activeSlot, setActiveSlot] = useState(0)
  const [attempts, setAttempts] = useState(0)
  const [reviewUnlocked, setReviewUnlocked] = useState(false)

  const isGuidedMode = settings.captureMode === 'guided'
  const hasUnlimitedRetakes = settings.retakePolicy === 'unlimited'
  const maxAttempts = hasUnlimitedRetakes ? null : template.requiredSlots + settings.extraCaptureAllowance
  const filledSlots = assignedPhotos.filter(Boolean).length
  const emptySlots = template.requiredSlots - filledSlots
  const canRetake = hasUnlimitedRetakes || (maxAttempts !== null && attempts < maxAttempts && maxAttempts - attempts > emptySlots)
  const canCaptureMore = hasUnlimitedRetakes || (maxAttempts !== null && attempts < maxAttempts)
  const attemptLimitLabel = maxAttempts === null ? 'unlimited' : String(maxAttempts)

  useEffect(() => {
    captureInFlightRef.current = false
    setCaptures([])
    setAssignedPhotos(Array.from({ length: template.requiredSlots }, () => null))
    setPendingPhoto(null)
    setActiveSlot(0)
    setAttempts(0)
    setReviewUnlocked(false)
  }, [sessionKey, template.requiredSlots])

  const attachVideo = useCallback((video: HTMLVideoElement | null) => {
    videoRef.current = video
    if (!video || !camera.stream) return
    video.srcObject = camera.stream
    void video.play().catch(() => undefined)
  }, [camera.stream])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !camera.stream) return
    video.srcObject = camera.stream
    void video.play().catch(() => undefined)
  }, [camera.stream])

  useEffect(() => {
    if (stage !== 'capture' || !camera.stream) return
    const timer = window.setTimeout(() => onStageChange('countdown'), settings.preCaptureDelayMs)
    return () => window.clearTimeout(timer)
  }, [stage, camera.stream, onStageChange, settings.preCaptureDelayMs])

  useEffect(() => {
    if (stage !== 'countdown') return
    captureInFlightRef.current = false
    let remainingSeconds = settings.countdownSeconds
    setCountdown(remainingSeconds)
    if (remainingSeconds === 0) {
      const timer = window.setTimeout(captureFrame, 0)
      return () => window.clearTimeout(timer)
    }
    const timer = window.setInterval(() => {
      remainingSeconds -= 1
      setCountdown(remainingSeconds)
      if (remainingSeconds <= 0) {
        window.clearInterval(timer)
        captureFrame()
      }
    }, 1000)
    return () => window.clearInterval(timer)
  // captureFrame reads the current video element when the countdown ends.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, settings.countdownSeconds])

  useEffect(() => {
    if (stage !== 'photo-review') return
    setReviewUnlocked(false)
    const timer = window.setTimeout(() => setReviewUnlocked(true), settings.postCaptureReviewMs)
    return () => window.clearTimeout(timer)
  }, [stage, settings.postCaptureReviewMs])

  const captureFrame = () => {
    if (captureInFlightRef.current) return
    captureInFlightRef.current = true
    const video = videoRef.current
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      captureInFlightRef.current = false
      onStageChange('capture')
      return
    }

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d')
    if (!context) {
      captureInFlightRef.current = false
      onStageChange('capture')
      return
    }

    if (settings.mirrorCamera) {
      context.translate(canvas.width, 0)
      context.scale(-1, 1)
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    const photo = canvas.toDataURL('image/jpeg', settings.captureJpegQuality)
    setAttempts(current => current + 1)
    if (isGuidedMode) {
      setPendingPhoto(photo)
      onStageChange('photo-review')
      return
    }

    setCaptures(current => [...current, photo])
    onStageChange(captures.length + 1 >= template.requiredSlots ? 'selection' : 'capture')
  }

  const usePendingPhoto = () => {
    if (!pendingPhoto) return
    setCaptures(current => [...current, pendingPhoto])
    const next = [...assignedPhotos]
    next[activeSlot] = pendingPhoto
    setAssignedPhotos(next)
    setPendingPhoto(null)
    const nextEmptySlot = next.findIndex(photo => !photo)
    if (nextEmptySlot === -1) {
      onStageChange('selection')
      return
    }
    setActiveSlot(nextEmptySlot)
    onStageChange('capture')
  }

  const retake = () => {
    if (!canRetake) return
    setPendingPhoto(null)
    onStageChange('capture')
  }

  const replaceSlot = (slotIndex: number) => {
    if (!canRetake || stage !== 'capture') return
    setActiveSlot(slotIndex)
    onStageChange('countdown')
  }

  const assignCandidate = (photo: string) => {
    const next = assignedPhotos.map(assignedPhoto => assignedPhoto === photo ? null : assignedPhoto)
    next[activeSlot] = photo
    setAssignedPhotos(next)
  }

  const captureAnother = () => {
    if (!canCaptureMore) return
    onStageChange('capture')
  }

  if (stage === 'idle') {
    return <WelcomeScreen language={settings.language} welcomeHeading={settings.welcomeHeading} onBegin={onBegin} />
  }

  if (stage === 'review') {
    const copy = getTemplateCopy(settings.language, template)
    return (
      <section className="review-layout" aria-labelledby="review-heading">
        <div className="review-copy">
          <p className="eyebrow">{tr(settings.language, 'Hoàn tất phiên chụp', 'Session complete')}</p>
          <h1 id="review-heading">{tr(settings.language, 'Giữ bộ ảnh này?', 'Keep this set?')}</h1>
          <p>{t(settings.language, 'reviewSummary', { required: template.requiredSlots, print: copy.printLabel })}</p>
          <div className="action-row"><button className="secondary-button" onClick={onRestart}>{tr(settings.language, 'Chụp lại toàn bộ', 'Retake all')}</button><button className="secondary-button" onClick={() => onStageChange('idle')}>{tr(settings.language, 'Kết thúc', 'Finish test')}</button></div>
        </div>
        <StripPreview assignments={assignedPhotos} captures={captures} photos={assignedPhotos.filter((photo): photo is string => Boolean(photo))} settings={settings} template={template} />
      </section>
    )
  }

  if (stage === 'selection') {
    return <SelectionBoard
      language={settings.language}
      activeSlot={activeSlot}
      assignments={assignedPhotos}
      canCaptureMore={canCaptureMore}
      captures={captures}
      template={template}
      onAssign={assignCandidate}
      onCaptureAnother={captureAnother}
      onContinue={() => onStageChange('review')}
      onSelectSlot={setActiveSlot}
    />
  }

  if (stage === 'photo-review') {
    return (
      <section className="guided-review" aria-labelledby="photo-review-heading">
        <div className="frozen-photo"><img alt={tr(settings.language, 'Ảnh vừa chụp', 'Most recently captured photo')} src={pendingPhoto ?? ''} /></div>
        <div className="review-decision">
          <p className="eyebrow">{tr(settings.language, `Ảnh ${attempts} · ${hasUnlimitedRetakes ? 'chụp lại không giới hạn' : `tối đa ${attemptLimitLabel}`}`, `Photo ${attempts} · ${hasUnlimitedRetakes ? 'unlimited retakes' : `${attemptLimitLabel} maximum`}`)}</p>
          <h1 id="photo-review-heading">{tr(settings.language, `Dùng ảnh này cho ô ${activeSlot + 1}?`, `Use this for slot ${activeSlot + 1}?`)}</h1>
          <p>{reviewUnlocked ? tr(settings.language, 'Chọn ảnh này hoặc chụp lại trước khi hoàn tất khung.', 'Choose this photo or take another before filling the frame.') : tr(settings.language, 'Hãy xem ảnh một lát.', 'Take a moment to see the photo.')}</p>
          <div className="decision-actions">
            <button className="primary-button" disabled={!reviewUnlocked} onClick={usePendingPhoto}>{tr(settings.language, 'Dùng ảnh này', 'Use this photo')}</button>
            {canRetake && <button className="secondary-button" disabled={!reviewUnlocked} onClick={retake}>{tr(settings.language, 'Chụp lại', 'Retake')}</button>}
          </div>
          {!canRetake && reviewUnlocked && <p className="quota-note">{tr(settings.language, 'Dùng ảnh này để dành đủ lượt cho các ô còn trống.', 'Use this photo to keep enough shots for every empty slot.')}</p>}
        </div>
        <div className="guided-frame">
          <FrameArtwork language={settings.language} activeSlot={activeSlot} photos={assignedPhotos} template={template} />
          <p>{tr(settings.language, `Ô ${activeSlot + 1} đang chờ ảnh này.`, `Slot ${activeSlot + 1} is waiting for this photo.`)}</p>
        </div>
      </section>
    )
  }

  const isRequesting = camera.status === 'requesting'
  const hasError = Boolean(camera.errorMessage)
  return (
    <section className="capture-layout" aria-labelledby="capture-heading">
      <div className="capture-sidebar">
        <p className="eyebrow">{tr(settings.language, isGuidedMode ? 'Duyệt từng ảnh' : 'Chụp liên tục', isGuidedMode ? 'Guided review' : 'Batch review')}</p>
        <h1 id="capture-heading">{stage === 'countdown' ? tr(settings.language, `Ảnh ${attempts + 1}${hasUnlimitedRetakes ? '' : ` / ${attemptLimitLabel}`}`, `Photo ${attempts + 1}${hasUnlimitedRetakes ? '' : ` of ${attemptLimitLabel}`}`) : isGuidedMode ? tr(settings.language, `Chuẩn bị cho ô ${activeSlot + 1}.`, `Get ready for slot ${activeSlot + 1}.`) : tr(settings.language, 'Chuẩn bị.', 'Get ready.')}</h1>
        <p>{stage === 'countdown' ? tr(settings.language, 'Nhìn vào ống kính.', 'Look into the lens.') : isGuidedMode ? tr(settings.language, `Đã điền ${filledSlots} / ${template.requiredSlots} ô.`, `${filledSlots} of ${template.requiredSlots} frame slots filled.`) : tr(settings.language, `Đã chụp ${captures.length} ảnh.`, `${captures.length} photos captured.`)}</p>
        <div className="shot-progress" aria-label={tr(settings.language, `${filledSlots} / ${template.requiredSlots} ô đã có ảnh`, `${filledSlots} of ${template.requiredSlots} frame slots filled`)}>
          {Array.from({ length: template.requiredSlots }, (_, index) => <span className={assignedPhotos[index] ? 'complete' : ''} key={index} />)}
        </div>
        {hasError && <p className="camera-error" role="alert">{camera.errorCode === 'unsupported' ? t(settings.language, 'cameraErrorUnsupported') : camera.errorCode === 'permissionDenied' ? t(settings.language, 'cameraErrorDenied') : camera.errorCode === 'notFound' ? t(settings.language, 'cameraErrorNotFound') : t(settings.language, 'cameraErrorOpenFailed')}</p>}
        {isRequesting && <p className="camera-wait" role="status">{tr(settings.language, 'Đang mở máy ảnh…', 'Opening camera…')}</p>}
        <p className="capture-budget">{t(settings.language, 'attemptsUsed', { attempts })}{hasUnlimitedRetakes ? ` · ${t(settings.language, 'unlimitedRetakeShort')}` : ` · ${t(settings.language, 'maximumShort', { limit: attemptLimitLabel })}`}</p>
      </div>
      <div className="camera-and-template">
        <div className="camera-frame">
          <div className="viewfinder-corner top-left" /><div className="viewfinder-corner top-right" /><div className="viewfinder-corner bottom-left" /><div className="viewfinder-corner bottom-right" />
          <span className="live-badge"><i /> {camera.stream ? tr(settings.language, 'Xem trước trực tiếp', 'Live preview') : tr(settings.language, 'Máy ảnh ngoại tuyến', 'Camera offline')}</span>
          <video ref={attachVideo} className={`camera-video ${settings.mirrorCamera ? 'mirrored' : ''}`} autoPlay muted playsInline aria-label={t(settings.language, 'liveCameraPreview')} />
          {!camera.stream && !isRequesting && <span className="camera-note">{tr(settings.language, 'Cho phép máy ảnh để bắt đầu phiên chụp', 'Allow camera access to start your session')}</span>}
          {stage === 'countdown' && <strong className="countdown" aria-live="assertive">{countdown || '✓'}</strong>}
        </div>
        <aside className="live-template"><FrameArtwork language={settings.language} activeSlot={activeSlot} onSlotClick={isGuidedMode && canRetake ? replaceSlot : undefined} photos={assignedPhotos} template={template} /><p>{isGuidedMode ? canRetake ? t(settings.language, 'tapFilledSlot') : t(settings.language, 'remainingShotsReserved') : t(settings.language, 'chooseFinalBatch')}</p></aside>
      </div>
    </section>
  )
}

function WelcomeScreen({ language, welcomeHeading, onBegin }: { language: BoothSettings['language']; welcomeHeading: string; onBegin: () => void }): JSX.Element {
  const headingLines = welcomeHeading.split(/\r?\n/).map(line => line.trim()).filter(Boolean).slice(0, 2)
  const displayLines = headingLines.length > 0 ? headingLines : [tr(language, 'Sẵn sàng', 'Step into'), tr(language, 'lên hình?', 'the frame.')]

  return (
    <section className="welcome" aria-labelledby="welcome-heading">
      <div className="welcome-brand welcome-reveal"><BrandLogo /></div>
      <div className="welcome-copy">
        <h1 id="welcome-heading" className="welcome-heading">
          {displayLines.map((line, index) => <span className="welcome-reveal" key={`${line}-${index}`}>{line}</span>)}
        </h1>
        <p className="welcome-description welcome-reveal">{tr(language, 'Chọn khung, tạo dáng và mang khoảnh khắc này về.', 'Choose a frame, strike a pose, keep the moment.')}</p>
      </div>

      <div className="welcome-start welcome-reveal">
        <button className="start-button" onClick={onBegin}>
          {tr(language, 'Bắt đầu', 'Start session')}
        </button>
      </div>
    </section>
  )
}
