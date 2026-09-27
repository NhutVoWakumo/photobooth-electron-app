import { openCameraStream } from '../src/renderer/src/lib/cameraAccess'
import { encodeCapturedCanvas } from '../src/renderer/src/lib/captureEncoding'

export async function testCamera(): Promise<{ devices: string[]; selected: string; width: number; height: number; active: boolean; frameCaptured: boolean }> {
  const devices = await navigator.mediaDevices.enumerateDevices()
  const stream = await openCameraStream(navigator.mediaDevices, 'expired-camera-id-for-qc')
  try {
    const track = stream.getVideoTracks()[0]
    const settings = track.getSettings()
    const video = document.createElement('video')
    video.muted = true
    video.srcObject = stream
    await video.play()
    if (!video.videoWidth || !video.videoHeight) await new Promise<void>(resolve => video.addEventListener('loadedmetadata', () => resolve(), { once: true }))
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)
    const encoded = await encodeCapturedCanvas(canvas, .9)
    return {
      devices: devices.filter(device => device.kind === 'videoinput').map(device => device.label || 'Unlabeled camera'),
      selected: track.label,
      width: settings.width ?? 0,
      height: settings.height ?? 0,
      active: track.readyState === 'live',
      frameCaptured: canvas.width > 0 && canvas.height > 0 && encoded.dataUrl.startsWith('data:image/jpeg;base64,') && encoded.previewDataUrl.startsWith('data:image/jpeg;base64,')
    }
  } finally { stream.getTracks().forEach(track => track.stop()) }
}
