interface SaveSessionInput {
  eventName: string
  photos: string[]
  strip: string
  printSheet: string
  printLayout: {
    id: 'single-4x6' | 'two-up-4x6'
    width: number
    height: number
    copiesPerSheet: number
  }
  templateId: string
  slotAssignments: Record<string, string>
}

interface Window {
  booth?: {
    saveSession: (input: SaveSessionInput) => Promise<{ outputPath: string; printSheetPath: string; sessionPath: string }>
    listWorkspaces: () => Promise<import('./types').BoothSession[]>
    saveWorkspace: (workspace: import('./types').BoothSession) => Promise<void>
    deleteWorkspace: (id: string) => Promise<void>
    loadSettings: () => Promise<unknown | null>
    saveSettings: (settings: unknown) => Promise<void>
    checkForUpdates: () => Promise<{ currentVersion: string; latestVersion: string; updateAvailable: boolean; releaseUrl: string }>
    openUpdatePage: (url: string) => Promise<void>
    exportImage: (input: { eventName: string; dataUrl: string }) => Promise<{ outputPath: string }>
    listPrinters: () => Promise<Array<{ name: string; displayName: string; description: string }>>
    printImage: (input: { printerName: string; dataUrl: string; width: number; height: number; ppi: number; profile: import('../../shared/printProfile').PrinterProfile; autoRotate?: boolean; copies?: number }) => Promise<void>
    driveConnect: () => Promise<void>
    driveImportOAuthFile: () => Promise<boolean>
    driveStatus: () => Promise<{ configured: boolean; connected: boolean; pending: number; message: string }>
    driveQueueFrame: (job: { sessionId: string; sessionName: string; frameId: string; frameName: string; finalImage: string; photos: Array<{ id: string; dataUrl: string }>; shareFrame?: boolean }) => Promise<void>
    drivePrepareFrame: (job: { sessionId: string; sessionName: string; frameId: string; frameName: string; shareFrame: boolean }) => Promise<string>
    driveProcessQueue: () => Promise<void>
    driveFrameLink: (sessionId: string, frameId: string) => Promise<{ url: string; expiresAt: string } | null>
    driveSessionFolder: (sessionId: string) => Promise<string | null>
    driveSessionLink: (sessionId: string) => Promise<{ url: string; expiresAt: string } | null>
    driveSetSessionSharing: (sessionId: string, enabled: boolean) => Promise<void>
    driveOpenFolder: (url: string) => Promise<void>
    driveQueueDeletion: (sessionId: string, frameId?: string) => Promise<void>
  }
}
