import type { BoothSession, SessionFrameSet } from '../types'

const databaseName = 'luma-booth'
const storeName = 'sessions'
const databaseVersion = 1

type LegacySession = BoothSession & { templateId?: string; photos?: SessionFrameSet['photos']; assignments?: SessionFrameSet['assignments'] }

function normalizeSessions(source: LegacySession[]): BoothSession[] {
  return source.map(session => {
    if (Array.isArray(session.frames)) return session
    const legacyFrame: SessionFrameSet | null = session.templateId ? { id: crypto.randomUUID(), templateId: session.templateId, createdAt: session.createdAt, updatedAt: session.updatedAt, status: session.assignments?.every(Boolean) ? 'complete' : 'draft', photos: session.photos ?? [], assignments: session.assignments ?? [] } : null
    return { id: session.id, name: session.name, createdAt: session.createdAt, updatedAt: session.updatedAt, frames: legacyFrame ? [legacyFrame] : [] }
  }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, databaseVersion)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(storeName)) database.createObjectStore(storeName, { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function listIndexedSessions(): Promise<BoothSession[]> {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readonly')
    const request = transaction.objectStore(storeName).getAll()
    request.onsuccess = () => resolve(normalizeSessions(request.result as LegacySession[]))
    request.onerror = () => reject(request.error)
    transaction.oncomplete = () => database.close()
  })
}

export async function listStoredSessions(): Promise<BoothSession[]> {
  if (!window.booth) return listIndexedSessions()
  const diskSessions = normalizeSessions(await window.booth.listWorkspaces() as LegacySession[])
  if (diskSessions.length > 0) return diskSessions
  try {
    const browserSessions = await listIndexedSessions()
    await Promise.all(browserSessions.map(session => window.booth!.saveWorkspace(session)))
    return browserSessions
  } catch {
    return []
  }
}

export async function saveStoredSession(session: BoothSession): Promise<void> {
  if (window.booth) return window.booth.saveWorkspace(session)
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite')
    transaction.objectStore(storeName).put(session)
    transaction.oncomplete = () => { database.close(); resolve() }
    transaction.onerror = () => { database.close(); reject(transaction.error) }
  })
}

export async function deleteStoredSession(id: string): Promise<void> {
  if (window.booth) return window.booth.deleteWorkspace(id)
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite')
    transaction.objectStore(storeName).delete(id)
    transaction.oncomplete = () => { database.close(); resolve() }
    transaction.onerror = () => { database.close(); reject(transaction.error) }
  })
}
