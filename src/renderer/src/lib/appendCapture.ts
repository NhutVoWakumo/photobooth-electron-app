import type { BoothSession, SessionPhoto } from '../types'

export function appendCapture(session: BoothSession, frameId: string, slotIndex: number, photo: SessionPhoto): BoothSession {
  const frame = session.frames.find(item => item.id === frameId)
  if (!frame || slotIndex < 0 || slotIndex >= frame.assignments.length) return session
  const assignments = [...frame.assignments]
  assignments[slotIndex] = photo.id
  const updatedAt = photo.capturedAt
  return {
    ...session,
    updatedAt,
    frames: session.frames.map(item => item.id === frameId ? {
      ...item,
      photos: [...item.photos, photo],
      assignments,
      status: assignments.every(Boolean) ? 'complete' as const : 'draft' as const,
      updatedAt
    } : item)
  }
}
