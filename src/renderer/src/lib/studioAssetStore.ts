export type StudioAssetKind = 'sticker' | 'font'

export interface StudioAsset {
  id: string
  kind: StudioAssetKind
  name: string
  src: string
  family?: string
  createdAt: string
}

const databaseName = 'luma-frame-studio-assets'
const storeName = 'assets'

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(storeName, { keyPath: 'id' })
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function listStudioAssets(): Promise<StudioAsset[]> {
  const database = await openDatabase()
  return await new Promise((resolve, reject) => {
    const request = database.transaction(storeName, 'readonly').objectStore(storeName).getAll()
    request.onsuccess = () => { database.close(); resolve((request.result as StudioAsset[]).sort((a, b) => b.createdAt.localeCompare(a.createdAt))) }
    request.onerror = () => { database.close(); reject(request.error) }
  })
}

export async function saveStudioAsset(asset: StudioAsset): Promise<void> {
  const database = await openDatabase()
  await new Promise<void>((resolve, reject) => {
    const request = database.transaction(storeName, 'readwrite').objectStore(storeName).put(asset)
    request.onsuccess = () => { database.close(); resolve() }
    request.onerror = () => { database.close(); reject(request.error) }
  })
}
