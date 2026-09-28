import { useCallback, useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'

export interface FrameQrState {
  status: 'off' | 'preparing' | 'ready' | 'error'
  url: string | null
  image: string | null
  error: string
  attempts: number
}

const initialState: FrameQrState = { status: 'preparing', url: null, image: null, error: '', attempts: 0 }

export function useFrameQr(sessionId: string, sessionName: string, frameId: string, frameName: string, enabled: boolean): { qr: FrameQrState; retry: () => Promise<string> } {
  const [qr, setQr] = useState<FrameQrState>(enabled ? initialState : { ...initialState, status: 'off' })
  const pending = useRef<Promise<string> | null>(null)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])

  const prepare = useCallback((): Promise<string> => {
    if (pending.current) return pending.current
    const request = (async () => {
      if (!enabled || !window.booth) throw new Error('Google Drive QR is unavailable.')
      setQr(current => ({ ...current, status: 'preparing', error: '' }))
      let lastError: unknown
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        if (mounted.current) setQr(current => ({ ...current, attempts: attempt }))
        try {
          const drive = await window.booth.driveStatus()
          if (!drive.connected) throw new Error(drive.message || 'Google Drive is not connected. Connect it in Settings.')
          const url = await window.booth.drivePrepareFrame({ sessionId, sessionName, frameId, frameName, shareFrame: true })
          const image = await QRCode.toDataURL(url, { width: 512, margin: 0 })
          if (mounted.current) setQr({ status: 'ready', url, image, error: '', attempts: attempt })
          return url
        } catch (error) {
          lastError = error
          if (attempt < 3) await new Promise(resolve => window.setTimeout(resolve, attempt * 1000))
        }
      }
      const message = lastError instanceof Error ? lastError.message : String(lastError)
      if (mounted.current) setQr({ status: 'error', url: null, image: null, error: message, attempts: 3 })
      throw new Error(message)
    })().finally(() => { pending.current = null })
    pending.current = request
    return request
  }, [enabled, sessionId, sessionName, frameId, frameName])

  useEffect(() => {
    if (!enabled || !window.booth) { setQr({ ...initialState, status: 'off' }); return }
    void prepare().catch(() => undefined)
  }, [enabled, prepare])

  return { qr, retry: prepare }
}
