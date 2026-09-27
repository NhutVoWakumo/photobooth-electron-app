import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { openCameraStream } from '../lib/cameraAccess'

export interface CameraDevice {
  id: string
  label: string
}

export type CameraStatus = 'idle' | 'requesting' | 'ready' | 'denied' | 'unavailable' | 'error'
export type CameraErrorCode = 'unsupported' | 'permissionDenied' | 'notFound' | 'openFailed' | null

export interface CameraState {
  devices: CameraDevice[]
  stream: MediaStream | null
  status: CameraStatus
  errorMessage: string | null
  errorCode: CameraErrorCode
}

function numericMaximum(value: MediaTrackCapabilities[keyof MediaTrackCapabilities]): number | undefined {
  if (!value || typeof value !== 'object' || !('max' in value)) return undefined
  const maximum = value.max
  return typeof maximum === 'number' && Number.isFinite(maximum) ? maximum : undefined
}

async function preferHighestTrackResolution(track: MediaStreamTrack | undefined): Promise<void> {
  if (!track?.getCapabilities || !track.applyConstraints) return

  try {
    const capabilities = track.getCapabilities()
    const width = numericMaximum(capabilities.width)
    const height = numericMaximum(capabilities.height)
    const frameRate = numericMaximum(capabilities.frameRate)
    if (!width || !height) return

    const upgrade = track.applyConstraints({
      width: { ideal: width },
      height: { ideal: height },
      ...(frameRate ? { frameRate: { ideal: Math.min(frameRate, 30) } } : {})
    })
    await Promise.race([upgrade, new Promise<void>(resolve => window.setTimeout(resolve, 2500))])
  } catch {
    // Some camera drivers advertise modes they cannot apply. The already-open
    // high-resolution stream remains valid, so capture can continue normally.
  }
}

function displayName(device: MediaDeviceInfo, index: number): string {
  return device.label || `Camera ${index + 1}`
}

export function useCamera() {
  const streamRef = useRef<MediaStream | null>(null)
  const requestIdRef = useRef(0)
  const [state, setState] = useState<CameraState>({ devices: [], stream: null, status: 'idle', errorMessage: null, errorCode: null })

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      setState(current => ({ ...current, status: 'unavailable', errorMessage: 'This device does not support camera access.', errorCode: 'unsupported' }))
      return []
    }

    try {
      const devices = (await navigator.mediaDevices.enumerateDevices())
        .filter(device => device.kind === 'videoinput')
        .map((device, index) => ({ id: device.deviceId, label: displayName(device, index) }))
      setState(current => ({ ...current, devices }))
      return devices
    } catch {
      // Enumeration can fail even after a usable stream has opened. Keep it.
      return []
    }
  }, [])

  const stopCamera = useCallback(() => {
    requestIdRef.current += 1
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
    setState(current => ({ ...current, stream: null, status: current.status === 'ready' ? 'idle' : current.status }))
  }, [])

  const startCamera = useCallback(async (preferredId?: string): Promise<CameraDevice | null> => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setState(current => ({ ...current, status: 'unavailable', errorMessage: 'This device does not support camera access.', errorCode: 'unsupported' }))
      return null
    }

    stopCamera()
    const requestId = requestIdRef.current
    setState(current => ({ ...current, status: 'requesting', errorMessage: null, errorCode: null }))

    try {
      const stream = await openCameraStream(navigator.mediaDevices, preferredId)
      if (requestId !== requestIdRef.current) { stream.getTracks().forEach(track => track.stop()); return null }
      await preferHighestTrackResolution(stream.getVideoTracks()[0])
      if (requestId !== requestIdRef.current) { stream.getTracks().forEach(track => track.stop()); return null }
      streamRef.current = stream
      const devices = await refreshDevices()
      if (requestId !== requestIdRef.current) return null
      const track = stream.getVideoTracks()[0]
      track?.addEventListener('ended', () => {
        if (streamRef.current !== stream) return
        streamRef.current = null
        setState(current => ({ ...current, stream: null, status: 'error', errorMessage: 'Camera disconnected.', errorCode: 'openFailed' }))
      }, { once: true })
      const deviceId = track?.getSettings().deviceId
      const activeDevice = devices.find(device => device.id === deviceId) ?? (deviceId ? { id: deviceId, label: track.label || devices[0]?.label || 'Camera' } : devices[0]) ?? { id: '', label: track?.label || 'Camera' }

      setState(current => ({ ...current, stream, devices, status: 'ready', errorMessage: null, errorCode: null }))
      return activeDevice
    } catch (error) {
      if (requestId !== requestIdRef.current) return null
      const name = error instanceof Error ? error.name : ''
      const denied = name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError'
      const errorCode = denied ? 'permissionDenied' : name === 'NotFoundError' || name === 'DevicesNotFoundError' ? 'notFound' : 'openFailed'
      const message = denied
        ? 'Camera permission was denied. Allow camera access in macOS and restart the session.'
        : errorCode === 'notFound'
          ? 'No camera was found. Connect a camera or use the MacBook webcam.'
          : 'The selected camera could not be opened. Try another camera.'
      setState(current => ({ ...current, stream: null, status: denied ? 'denied' : 'error', errorMessage: message, errorCode }))
      return null
    }
  }, [refreshDevices, stopCamera])

  useEffect(() => {
    void refreshDevices()
    navigator.mediaDevices?.addEventListener?.('devicechange', refreshDevices)
    return () => {
      requestIdRef.current += 1
      navigator.mediaDevices?.removeEventListener?.('devicechange', refreshDevices)
      streamRef.current?.getTracks().forEach(track => track.stop())
    }
  }, [refreshDevices])

  return useMemo(() => ({ ...state, refreshDevices, startCamera, stopCamera }), [state, refreshDevices, startCamera, stopCamera])
}
