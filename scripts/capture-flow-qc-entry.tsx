import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { SlotCapture } from '../src/renderer/src/components/SlotCapture'
import { appendCapture } from '../src/renderer/src/lib/appendCapture'
import { defaultSettings, type SessionFrameSet } from '../src/renderer/src/types'
import { templates } from '../src/renderer/src/templates'

const template = templates.find(item => item.id === 'strip-3')!
const start: SessionFrameSet = { id: 'qc-frame', templateId: template.id, createdAt: '0', updatedAt: '0', status: 'draft', photos: [], assignments: [null, null, null] }
const source = document.createElement('canvas')
source.width = 640
source.height = 480
const context = source.getContext('2d')!
let tick = 0
const draw = () => {
  context.fillStyle = ['#df4b36', '#31a66a', '#3789db'][tick % 3]
  context.fillRect(0, 0, source.width, source.height)
  tick += 1
}
draw()
window.setInterval(draw, 80)
const stream = source.captureStream(30)

function Harness() {
  const [frame, setFrame] = useState(start)
  useEffect(() => {
    if (frame.photos.length !== 3) return
    const ids = frame.assignments.filter(Boolean)
    ;(window as typeof window & { __captureResult?: unknown }).__captureResult = {
      photos: frame.photos.length,
      unique: new Set(ids).size,
      complete: frame.status === 'complete',
      previewReady: frame.photos.every(photo => photo.previewDataUrl?.startsWith('data:image/jpeg')),
      thumbnailCount: document.querySelectorAll('.capture-thumbnail img').length,
      cameraLive: stream.getVideoTracks()[0]?.readyState === 'live'
    }
  }, [frame])
  return <SlotCapture camera={{ devices: [], stream, status: 'ready', errorCode: null, errorMessage: null }} language="en" settings={{ ...defaultSettings, countdownSeconds: 0, postCaptureReviewMs: 180, preCaptureDelayMs: 0 }} template={template} sessionId="qc-session" sessionName="QC" qrEnabled={false} frame={frame} initialSlot={0} onAccept={(dataUrl, previewDataUrl, aspectRatio, slotIndex) => setFrame(current => appendCapture({ id: 'qc-session', name: 'QC', createdAt: '0', updatedAt: current.updatedAt, frames: [current] }, current.id, slotIndex, { id: crypto.randomUUID(), dataUrl, previewDataUrl, capturedAt: new Date().toISOString(), pinned: false, slotAspectRatio: aspectRatio }).frames[0])} onChange={setFrame} onDelete={() => undefined} onCancel={() => undefined} onRetryCamera={() => undefined} />
}

createRoot(document.getElementById('root')!).render(<Harness />)
