import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

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

const highResolutionConstraints: MediaTrackConstraints = {
  width: { ideal: 3840 },
  height: { ideal: 2160 },
  frameRate: { ideal: 30, max: 60 }
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

    await track.applyConstraints({
      width: { ideal: width },
      height: { ideal: height },
      ...(frameRate ? { frameRate: { ideal: Math.min(frameRate, 30) } } : {})
    })
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
  const [state, setState] = useState<CameraState>({ devices: [], stream: null, status: 'idle', errorMessage: null, errorCode: null })

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      setState(current => ({ ...current, status: 'unavailable', errorMessage: 'This device does not support camera access.', errorCode: 'unsupported' }))
      return []
    }

    const devices = (await navigator.mediaDevices.enumerateDevices())
      .filter(device => device.kind === 'videoinput')
      .map((device, index) => ({ id: device.deviceId, label: displayName(device, index) }))

    setState(current => ({ ...current, devices }))
    return devices
  }, [])

  const stopCamera = useCallback(() => {
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
    setState(current => ({ ...current, status: 'requesting', errorMessage: null, errorCode: null }))

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: preferredId
          ? { ...highResolutionConstraints, deviceId: { exact: preferredId } }
          : { ...highResolutionConstraints, facingMode: 'user' },
        audio: false
      })
      await preferHighestTrackResolution(stream.getVideoTracks()[0])
      streamRef.current = stream
      const devices = await refreshDevices()
      const track = stream.getVideoTracks()[0]
      const activeDevice = devices.find(device => device.id === track?.getSettings().deviceId) ?? devices[0] ?? null

      setState(current => ({ ...current, stream, devices, status: 'ready', errorMessage: null, errorCode: null }))
      return activeDevice
    } catch (error) {
      const name = error instanceof DOMException ? error.name : ''
      const errorCode = name === 'NotAllowedError' ? 'permissionDenied' : name === 'NotFoundError' ? 'notFound' : 'openFailed'
      const message = name === 'NotAllowedError'
        ? 'Camera permission was denied. Allow camera access in macOS and restart the session.'
        : name === 'NotFoundError'
          ? 'No camera was found. Connect a camera or use the MacBook webcam.'
          : 'The selected camera could not be opened. Try another camera.'
      setState(current => ({ ...current, stream: null, status: name === 'NotAllowedError' ? 'denied' : 'error', errorMessage: message, errorCode }))
      return null
    }
  }, [refreshDevices, stopCamera])

  useEffect(() => {
    void refreshDevices()
    navigator.mediaDevices?.addEventListener?.('devicechange', refreshDevices)
    return () => {
      navigator.mediaDevices?.removeEventListener?.('devicechange', refreshDevices)
      streamRef.current?.getTracks().forEach(track => track.stop())
    }
  }, [refreshDevices])

  return useMemo(() => ({ ...state, refreshDevices, startCamera, stopCamera }), [state, refreshDevices, startCamera, stopCamera])
}
