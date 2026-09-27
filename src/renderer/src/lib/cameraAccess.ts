const highResolutionConstraints: MediaTrackConstraints = {
  width: { ideal: 3840 },
  height: { ideal: 2160 },
  frameRate: { ideal: 30, max: 60 }
}

function isPermissionError(error: unknown): boolean {
  const name = error instanceof Error ? error.name : ''
  return name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError'
}

/** A saved device ID can expire after a reconnect or OS update. Never strand capture on it. */
export async function openCameraStream(mediaDevices: Pick<MediaDevices, 'getUserMedia'>, preferredId?: string): Promise<MediaStream> {
  const attempts: MediaStreamConstraints[] = [
    ...(preferredId ? [{ video: { ...highResolutionConstraints, deviceId: { exact: preferredId } }, audio: false }] : []),
    { video: highResolutionConstraints, audio: false },
    { video: true, audio: false }
  ]
  let lastError: unknown
  for (const constraints of attempts) {
    try { return await mediaDevices.getUserMedia(constraints) }
    catch (error) {
      if (isPermissionError(error)) throw error
      lastError = error
    }
  }
  throw lastError
}
